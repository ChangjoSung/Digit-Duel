'use strict';
// Digit Dual PVP 릴레이 서버 — 내부망 전용, 비권위 1:1 중계.
// #62 방어적 하드닝: 기본 루프백 바인드 · 런타임 접근 코드 · Origin/Host 검증 ·
// 정적 경로 잠금 · WebSocket 인증/한도 · 보안 헤더. 게임 프로토콜은 그대로 유지한다.
//
// 인증 경계는 WebSocket 업그레이드 한 곳뿐이다. 정적 페이지(게임 클라이언트)는 인증 없이
// 서빙하고, 접근 코드는 어떤 HTTP·WebSocket URL·쿼리·쿠키·리다이렉트에도 실리지 않는다.
// 코드는 콘솔에 단독으로만 출력되고, 사용자가 클라이언트에 직접 입력하면 업그레이드의
// Sec-WebSocket-Protocol 헤더로만 전달된다. 서버는 그 값을 검증만 하고 선택·반향하지 않는다.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer, OPEN } = require('ws');
const S = require('./security');

/* ===== 설정 ===== */

const PORT = Number(process.env.PORT || 8080);

// 기본은 루프백 전용. LAN 공개는 DD_LAN=1 (또는 --lan) 명시적 옵트인일 때만.
const LAN_OPT_IN = process.env.DD_LAN === '1' || process.argv.includes('--lan');
const BIND = process.env.DD_BIND || (LAN_OPT_IN ? '0.0.0.0' : '127.0.0.1');

// 접근 코드는 매 기동마다 새로 만든다. 저장소에 비밀값을 두지 않는다.
// DD_ACCESS_CODE 로 외부(런처·CI)에서 주입할 수 있으나 기본값은 없다.
const ACCESS_CODE = (process.env.DD_ACCESS_CODE || '').trim() || S.generateAccessCode();
if (ACCESS_CODE.length < 8) {
  console.error('[보안] DD_ACCESS_CODE 는 8자 이상이어야 합니다. 기동을 중단합니다.');
  process.exit(1);
}

const LIMITS = {
  maxUrlLength: 2048,
  maxConnections: Number(process.env.DD_MAX_CONNECTIONS || 16),
  maxConnectionsPerIp: Number(process.env.DD_MAX_CONNECTIONS_PER_IP || 4),
  maxRelayViolations: 5,
  msgPerSec: 40,
  msgBurst: 80,
  bytesPerSec: 128 * 1024,
  bytesBurst: 256 * 1024,
  httpReqPerSec: 30,
  httpBurst: 60,
  upgradePerMin: 60,
  authFailures: 10,
  authWindowMs: 5 * 60 * 1000,
};

// 클라이언트 정적 서빙 위치 자동 탐색 (저장소 server/ 실행 → ../demo, 독립 배포 → ./client/demo)
const ROOT = [
  path.join(__dirname, '..', 'demo'),
  path.join(__dirname, 'client', 'demo'),
].find((p) => fs.existsSync(path.join(p, 'index.html'))) || path.join(__dirname, '..', 'demo');

/* ===== 상태 ===== */

const httpBuckets = new Map();     // ip -> TokenBucket
const upgradeBuckets = new Map();  // ip -> TokenBucket
const connectionsByIp = new Map(); // ip -> count
const authLimiter = new S.AttemptLimiter(LIMITS.authFailures, LIMITS.authWindowMs);

let waiting = null; // 매칭 대기 슬롯 (1:1이라 큐 대신 슬롯 하나면 충분)
let nextRoomId = 1;

function peerAllowed(ip) {
  return LAN_OPT_IN ? S.isPrivateIp(ip) : S.isLoopbackIp(ip);
}

function bucketFor(map, ip, capacity, refill) {
  let b = map.get(ip);
  if (!b) { b = new S.TokenBucket(capacity, refill); map.set(ip, b); }
  return b;
}

function sendHead(res, status, extra) {
  res.writeHead(status, Object.assign({}, S.SECURITY_HEADERS, extra || {}));
}

function deny(res, status, message) {
  sendHead(res, status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message || String(status));
}

/* ===== HTTP — 게임 클라이언트 정적 서빙 (인증 없음) =====
 * 여기서 나가는 것은 저장소에 그대로 들어 있는 데모 클라이언트뿐이고 비밀값이 아니다.
 * 보호 대상(상대와의 릴레이 세션)은 WebSocket 업그레이드에서만 인증한다.
 * 그래도 노출면은 좁게 유지한다: 피어 주소·메서드·Host·Origin·경로를 전부 검사한다.
 */

const server = http.createServer((req, res) => {
  const ip = S.normalizeIp(req.socket.remoteAddress);

  // 1) 피어 주소 — 기본 루프백 전용, LAN 옵트인 시 사설 대역까지
  if (!peerAllowed(ip)) return deny(res, 403, LAN_OPT_IN ? 'LAN only' : 'localhost only');

  // 2) 요청 속도 제한
  if (!bucketFor(httpBuckets, ip, LIMITS.httpBurst, LIMITS.httpReqPerSec).take(1)) {
    return deny(res, 429, 'too many requests');
  }

  // 3) 메서드 — 정적 서빙과 WebSocket 만 있으므로 GET/HEAD 외에는 전부 거부
  if (!S.ALLOWED_METHODS.has(req.method)) {
    sendHead(res, 405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('method not allowed');
  }

  // 4) Host 위조(DNS 리바인딩) 차단
  if (!S.isAllowedHost(req.headers.host)) return deny(res, 400, 'bad host');

  // 5) URL 길이
  if ((req.url || '').length > LIMITS.maxUrlLength) return deny(res, 414, 'uri too long');

  // 6) Origin — 브라우저가 Origin 을 붙인 요청(cross-site fetch 등)은 동일 출처만 허용.
  //    일반 주소창 내비게이션은 Origin 이 없으므로 영향받지 않는다.
  const origin = req.headers.origin;
  if (origin && !S.isSameOrigin(origin, req.headers.host)) return deny(res, 403, 'bad origin');

  // 7) 정적 경로 — 이탈·숨김 파일·확장자 밖·심볼릭 링크 탈출 차단. 쿼리스트링은 무시한다.
  const resolved = S.resolveStaticPath(ROOT, req.url);
  if (!resolved.ok) return deny(res, resolved.status, resolved.reason);

  fs.readFile(resolved.file, (err, data) => {
    if (err) return deny(res, 404, 'not found');
    sendHead(res, 200, { 'Content-Type': resolved.mime, 'Content-Length': String(data.length) });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  });
});

server.maxHeadersCount = 64;
server.headersTimeout = 10000;
server.requestTimeout = 30000;
server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  else socket.destroy();
});

/* ===== WebSocket — 유일한 인증 경계 ===== */

// noServer 로 두고 upgrade 를 직접 검사한다 — 핸드셰이크 성립 전에 거부하기 위함.
const wss = new WebSocketServer({
  noServer: true,
  maxPayload: S.RELAY_LIMITS.maxBytes,
  clientTracking: true,
  // 하위 프로토콜은 접근 코드를 나르는 통로일 뿐이다. 인증은 아래 upgrade 핸들러에서 이미 끝났고,
  // 여기서는 공개 마커(digit-duel.v1)만 골라 되돌려준다. 비밀값인 코드는 절대 선택하지 않는다 —
  // 선택하면 응답 `Sec-WebSocket-Protocol: <코드>` 로 비밀값이 그대로 반향돼
  // 클라이언트 ws.protocol·중계 프록시 로그에 남는다.
  handleProtocols: S.selectProtocol,
});

// 실패 응답에는 상태 코드만 담는다 — 코드 존재 여부·길이·오답 사유를 흘리지 않는다.
function rejectUpgrade(socket, status, reason) {
  const text = `HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`;
  try { socket.write(text); } catch (e) { /* 소켓이 이미 닫힘 */ }
  socket.destroy();
}

server.on('upgrade', (req, socket, head) => {
  const ip = S.normalizeIp(req.socket.remoteAddress);

  if (!peerAllowed(ip)) return rejectUpgrade(socket, 403, 'Forbidden');
  if (!bucketFor(upgradeBuckets, ip, LIMITS.upgradePerMin, LIMITS.upgradePerMin / 60).take(1)) {
    return rejectUpgrade(socket, 429, 'Too Many Requests');
  }
  if (!S.isAllowedHost(req.headers.host)) return rejectUpgrade(socket, 400, 'Bad Request');

  let pathname = '/';
  try { pathname = new URL(req.url || '/', 'http://placeholder.invalid').pathname; } catch (e) { /* 기본값 유지 */ }
  if (pathname !== '/') return rejectUpgrade(socket, 404, 'Not Found');

  // Origin: 브라우저는 항상 붙인다 → 동일 출처만. WebSocket 은 CORS 보호가 없어 필수 검사다.
  const origin = req.headers.origin;
  if (origin && !S.isSameOrigin(origin, req.headers.host)) return rejectUpgrade(socket, 403, 'Forbidden');

  // 접근 코드 — Sec-WebSocket-Protocol 헤더 단일 경로. 쿼리·쿠키·URL 경로는 읽지 않는다.
  // 상수시간 비교, 실패 누적 시 IP 차단. 실패 응답에는 사유를 싣지 않는다.
  if (authLimiter.isBlocked(ip)) return rejectUpgrade(socket, 429, 'Too Many Requests');
  const presented = S.presentedAccessCode(req.headers['sec-websocket-protocol']);
  if (!presented.ok || !S.safeEqual(presented.code, ACCESS_CODE)) {
    // 코드를 아예 제시하지 않은 요청(absent)은 대입 시도가 아니므로 세지 않는다.
    // 틀린 코드·복수 토큰(한 번에 여러 코드 대입)은 시도로 센다.
    if (presented.reason !== 'absent') authLimiter.fail(ip);
    return rejectUpgrade(socket, 401, 'Unauthorized');
  }
  authLimiter.reset(ip);

  if (wss.clients.size >= LIMITS.maxConnections) return rejectUpgrade(socket, 503, 'Service Unavailable');
  if ((connectionsByIp.get(ip) || 0) >= LIMITS.maxConnectionsPerIp) {
    return rejectUpgrade(socket, 429, 'Too Many Requests');
  }

  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

wss.on('connection', (ws, req) => {
  const ip = S.normalizeIp(req.socket.remoteAddress);
  connectionsByIp.set(ip, (connectionsByIp.get(ip) || 0) + 1);

  ws.ddIp = ip;
  ws.isAlive = true;
  ws.violations = 0;
  ws.msgBucket = new S.TokenBucket(LIMITS.msgBurst, LIMITS.msgPerSec);
  ws.byteBucket = new S.TokenBucket(LIMITS.bytesBurst, LIMITS.bytesPerSec);
  ws.on('pong', () => { ws.isAlive = true; });

  // ==== 게임 프로토콜 (기존과 동일) ====
  if (waiting && waiting !== ws && waiting.readyState === OPEN) {
    const roomId = nextRoomId++;
    const p1 = waiting;
    const p2 = ws;
    waiting = null;
    p1.opponent = p2;
    p2.opponent = p1;
    p1.send(JSON.stringify({ type: 'matched', room: roomId, you: 'p1' }));
    p2.send(JSON.stringify({ type: 'matched', room: roomId, you: 'p2' }));
  } else {
    waiting = ws;
    ws.send(JSON.stringify({ type: 'waiting' }));
  }

  ws.on('message', (data, isBinary) => {
    // 바이너리는 현행 프로토콜에 없다 — 즉시 종료
    if (isBinary) { ws.close(1003, 'binary not supported'); return; }

    const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(String(data));
    if (!ws.msgBucket.take(1) || !ws.byteBucket.take(size)) {
      ws.close(1008, 'rate limit');
      return;
    }

    const check = S.validateRelayMessage(data, isBinary);
    if (!check.ok) {
      ws.violations += 1;
      if (ws.violations >= LIMITS.maxRelayViolations) ws.close(1008, 'invalid message');
      return; // 검증 실패 메시지는 상대에게 절대 중계하지 않는다
    }

    // 상대에게 그대로 중계 (서버는 내용을 해석하지 않는다)
    const opp = ws.opponent;
    if (opp && opp.readyState === OPEN) opp.send(data, { binary: false });
  });

  ws.on('close', () => {
    const n = (connectionsByIp.get(ip) || 1) - 1;
    if (n <= 0) connectionsByIp.delete(ip); else connectionsByIp.set(ip, n);
    if (waiting === ws) waiting = null;
    const opp = ws.opponent;
    if (opp) {
      opp.opponent = null;
      ws.opponent = null;
      if (opp.readyState === OPEN) opp.send(JSON.stringify({ type: 'opponent_left' }));
    }
  });

  ws.on('error', () => ws.terminate());
});

// 응답 없는 연결 정리 (핑 무응답 30초)
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

// 오래된 속도 제한·시도 기록 정리
const sweeper = setInterval(() => {
  const now = Date.now();
  authLimiter.sweep(now);
  if (httpBuckets.size > 256) httpBuckets.clear();
  if (upgradeBuckets.size > 256) upgradeBuckets.clear();
}, 60000);

heartbeat.unref?.();
sweeper.unref?.();
wss.on('close', () => { clearInterval(heartbeat); clearInterval(sweeper); });

/* ===== 기동 =====
 * 주소와 접근 코드를 절대 한 줄로 합치지 않는다. 코드가 붙은 URL 을 만들어 두면
 * 그대로 복사돼 브라우저 주소창·히스토리·Referer 에 남는다.
 */

server.listen(PORT, BIND, () => {
  const actual = server.address().port;
  console.log(`PvP relay server listening on ${BIND}:${actual} (${LAN_OPT_IN ? 'LAN 공개 — 사설 대역만' : '루프백 전용'})`);
  console.log(`  클라이언트: ${ROOT}`);
  console.log(`  접속 주소: http://127.0.0.1:${actual}`);
  if (LAN_OPT_IN) {
    for (const list of Object.values(os.networkInterfaces()))
      for (const i of list)
        if (i.family === 'IPv4' && !i.internal && S.isPrivateIp(i.address))
          console.log(`  내부망 주소: http://${i.address}:${actual}`);
  } else {
    console.log('  LAN 공개가 필요하면 DD_LAN=1 로 기동하세요 (기본은 이 PC 전용).');
  }
  console.log('');
  console.log(`  접속 코드: ${ACCESS_CODE}`);
  console.log('  ↑ 매 기동마다 새로 생성됩니다. 위 접속 주소를 브라우저로 연 뒤,');
  console.log('     클라이언트의 [접속 코드] 입력칸에 이 값을 그대로 입력하세요.');
  console.log('     코드는 WebSocket 하위 프로토콜 헤더로만 전송되며, 주소·쿼리·쿠키에 실리지 않습니다.');
});
