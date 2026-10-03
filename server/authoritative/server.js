'use strict';
// #217 서버 권위 인증 서버 — protocol.md의 구현. 기존 코드 접속 릴레이(#276 이후 server/test/relay/server.js 테스트 fixture)와
// 별도 프로세스/포트(DD_AUTH_PORT, 기본 8081)로 뜬다. 오프라인 클라이언트·LAN 릴레이 기본 동작에 영향이 없다.
//
// v4 — 정적 호스팅 (Saturn REVISE: "authoritative HTTP는 health 외 404, npm start는 이전 8080 relay"):
// 이 서버가 demo/(게임 클라이언트 index.html + assets)를 릴레이와 **같은 security.js 검사**(피어 주소·요청 예산·
// 메서드·Host·URL 길이·Origin·정적 경로 잠금)로 직접 서빙한다. 그래서 http://127.0.0.1:8081 을 열면 클라이언트의
// 기본 접속 주소(netServerDefault() = location.host)가 곧 이 인증 서버가 된다 — 클라이언트 코드 변경 없이 공개 로비가
// 기본 경로로 붙는다(Mars 확인 msg 2026-09-13). package.json의 npm start / start:lan 이 이 서버를 띄운다.
//
// WAN 배포 준비(analysis.md §2.1): DD_AUTH_PUBLIC_HOST 로 배포 도메인을 지정하면 Host 화이트리스트에 더해진다.
// 실제 구매·배포는 하지 않는다 — 기본(미설정)은 localhost·사설 대역만 허용한다.
//
// #217 WAN 옵트인(Jupiter deploy-readiness): 위 §2.1은 Host 허용 목록만 다뤘다. 실제 Render 등 리버스
// 프록시 배포에는 두 가지가 더 필요했다 — (1) 플랫폼이 주입하는 PORT를 듣는 것(DD_AUTH_PORT만 보면
// Render가 실제로 트래픽을 보내는 포트를 놓친다), (2) 소켓의 직접 피어가 항상 플랫폼 엣지 프록시이지
// 실제 클라이언트가 아니므로 LAN 옵트인의 "피어가 사설 대역인가" 판정을 그대로 쓸 수 없는 것. 그래서
// DD_LAN(같은 공유기 신뢰)과는 별개로 DD_AUTH_PUBLIC_DEPLOY(리버스 프록시 뒤 배포 신뢰)를 둔다.
// 켜면 peerAllowed()가 소켓 피어 IP 검사를 건너뛰고 Host·Origin·좌석 토큰만으로 막는다 — 그게 이 배포
// 형태의 실질 경계다. DD_AUTH_PUBLIC_HOST 없이 켜면 모든 요청이 400(bad host)이 되므로 기동을 막는다.
// 미설정(기본)은 기존 로컬/LAN 동작을 그대로 유지한다.
const http = require('http');
const https = require('https');
const tls = require('tls');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, OPEN } = require('ws');
const S = require('../security');
const { Lobby } = require('./lobby');
const { STATES } = require('./room');
const { validateEnvelope, normalizeRoomName, isEmoteId } = require('./protocol');
const { isWellFormedToken } = require('./seatToken');
const db = require('../db'); // #264 — DATABASE_URL 이 없으면 전부 비활성(기존 동작 그대로)
const mig = require('../db-migrate'); // pg 를 require 하지 않는다 — 무DB 설치에서도 안전
const A = require('./accounts');
const { createOutbox } = require('./resultOutbox');

// DD_AUTH_PORT 를 명시하면 그대로 우선한다(기존 로컬/LAN 실행기·문서 그대로). 미설정이면 플랫폼이
// 주입하는 PORT(Render 등)를 듣는다 — 없으면 기존 기본값 8081.
const PORT = Number(process.env.DD_AUTH_PORT || process.env.PORT || 8081);
const LAN_OPT_IN = process.env.DD_LAN === '1' || process.argv.includes('--lan');
// 리버스 프록시(Render 등) 뒤 공개 배포 옵트인. DD_LAN(같은 공유기 신뢰)과는 별개 축이다 — 위 주석 참조.
const PUBLIC_DEPLOY = process.env.DD_AUTH_PUBLIC_DEPLOY === '1';
const PUBLIC_HOST = process.env.DD_AUTH_PUBLIC_HOST || null; // §2.1 DD_PUBLIC_HOST 상당
const PUBLIC_HOST_CHECK = PUBLIC_HOST ? S.validatePublicHost(PUBLIC_HOST) : { ok: true, host: null };
// #313 커스텀 도메인 — DD_AUTH_PUBLIC_HOST 를 공식 도메인으로 바꿔도 Render 가 주입하는 기본 onrender.com 주소
// (RENDER_EXTERNAL_HOSTNAME)를 기술 대체·롤백 경로로 함께 허용한다. 공개 배포 옵트인일 때만, 같은 형식 검증을 통과할 때만
// 더한다 — 형식이 어긋나면 더하지 않고(닫힘) 경고만 남긴다(플랫폼 주입값 하나로 운영 서버 기동을 막지 않는다).
const RENDER_HOST_RAW = process.env.RENDER_EXTERNAL_HOSTNAME || null;
const RENDER_HOST_CHECK = PUBLIC_DEPLOY && RENDER_HOST_RAW ? S.validatePublicHost(RENDER_HOST_RAW) : { ok: false, reason: 'absent' };
const PUBLIC_HOSTS = [PUBLIC_HOST_CHECK.host, RENDER_HOST_CHECK.ok && RENDER_HOST_CHECK.host].filter(Boolean);

// #276 네이티브 HTTPS 옵트인 — LAN 에서 로그인하려면 TLS 가 필요하다(평문 원격 인증은 accounts.transport() 가 계속 403).
// 둘 다 없으면 기존 HTTP 그대로(Render 는 엣지 TLS). 둘 다 있으면 같은 포트·핸들러·WebSocket 을 TLS 로 연다.
// 하나만 있거나·상대 경로·읽기 실패·PEM 오류·키 불일치면 HTTP 로 내려가지 않고 멈춘다 — 사유는 오류 코드만(경로·키 내용 없음).
function loadTls(certPath, keyPath) {
  if (!certPath && !keyPath) return { ok: true, options: null };
  if (!certPath || !keyPath) return { ok: false, reason: 'pair_incomplete' };
  if (!path.isAbsolute(certPath) || !path.isAbsolute(keyPath)) return { ok: false, reason: 'path_not_absolute' };
  try {
    const options = { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath), minVersion: 'TLSv1.2' };
    tls.createSecureContext(options); // 깨진 PEM·키 불일치를 여기서 던진다
    return { ok: true, options };
  } catch (e) {
    return { ok: false, reason: (e && e.code) || 'invalid_pem' };
  }
}
const TLS = loadTls(process.env.DD_AUTH_TLS_CERT, process.env.DD_AUTH_TLS_KEY);
if (!TLS.ok) {
  const msg = `[보안] DD_AUTH_TLS_CERT·DD_AUTH_TLS_KEY 가 올바르지 않습니다 (사유: ${TLS.reason}). 둘 다 PEM 파일 절대 경로로 지정하거나 둘 다 지우세요. HTTP 로 대신 뜨지 않고 기동을 중단합니다.`;
  if (require.main === module) { console.error(msg); process.exit(1); }
  throw new Error(msg); // require 로 불러도 HTTP 서버를 만들지 않는다
}
const SCHEME = TLS.options ? 'https' : 'http';

const bindChoice = S.resolveBindAddress(process.env.DD_AUTH_BIND, LAN_OPT_IN || PUBLIC_DEPLOY);
const BIND = bindChoice.ok ? bindChoice.bind : '127.0.0.1';

const EPOCH = crypto.randomBytes(4).toString('hex'); // 8자 16진 (analysis.md §2.4.1.1)

// 게임 클라이언트 정적 서빙 위치 — 저장소 demo/ 우선, 독립 배포는 ./client/demo.
const ROOT = [
  path.join(__dirname, '..', '..', 'demo'),
  path.join(__dirname, '..', 'client', 'demo'),
].find((p) => fs.existsSync(path.join(p, 'index.html'))) || path.join(__dirname, '..', '..', 'demo');

const PAGE_LOAD_REQUESTS = S.STATIC_BUDGET.pageLoadRequests;
const CONCURRENT_PAGE_LOADS = S.STATIC_BUDGET.concurrentPageLoads;

const LIMITS = {
  maxUrlLength: 2048,
  maxConnections: Number(process.env.DD_AUTH_MAX_CONNECTIONS || 64),
  maxConnectionsPerIp: Number(process.env.DD_AUTH_MAX_CONNECTIONS_PER_IP || 8),
  httpReqPerSec: PAGE_LOAD_REQUESTS * 2,
  httpBurst: PAGE_LOAD_REQUESTS * CONCURRENT_PAGE_LOADS,
  upgradePerMin: 60,
  authFailures: 10,
  authWindowMs: 5 * 60 * 1000,
};

const httpBuckets = new Map();
const upgradeBuckets = new Map();
const connectionsByIp = new Map();
const authLimiter = new S.AttemptLimiter(LIMITS.authFailures, LIMITS.authWindowMs);
/* #237 경제 경기가 기본이다(온라인 클라이언트 연결 완료). DD_ECONOMY=0 은 종전 무료 로스터 경기 — 되돌림(rollback)과
   구 공개방 회귀 검증(smoke_public_live.js) 용도로만 남긴다. */
const ECONOMY = process.env.DD_ECONOMY !== '0';
const lobby = new Lobby({ epoch: EPOCH, economy: ECONOMY });

// #259 계정 — DB 가 있는 서버에서만 켠다. 켜지면 온라인 방 생성·참가·재접속이 로그인을 요구한다.
// DB 가 없는 서버(오프라인·LAN·로컬 회귀)는 계정 없이 기존 그대로다 — 계정 API 는 503 E_ACCOUNTS_DISABLED.
// DB 가 켜졌는데 장애면 계정 API·방 접속 모두 503 이다(메모리로 대신하지 않는다).
// 메일(비밀번호 재설정 코드)은 DD_SMTP_URL·DD_MAIL_FROM 이 있을 때만 — 없으면 재설정 요청은 503 E_MAIL_UNAVAILABLE(accounts.js smtpMailer).
// #260 완료된 경기 결과의 내구 아웃박스(resultOutbox.js) — DB 가 켜진 서버에서만. 기본 경로는 server/data/(.gitignore)이고,
// 운영·QA 는 DD_RESULT_OUTBOX 로 체크아웃 밖의 비공개·영속 디스크를 지정한다. 열지 못하면 기동하지 않는다(결과를 잃는 서버를 띄우지 않는다).
function openOutbox() {
  try { return createOutbox(process.env.DD_RESULT_OUTBOX || path.join(__dirname, '..', 'data', 'match-results-outbox.jsonl'), 200); }
  catch (e) {
    console.error(`[전적] 결과 아웃박스를 열 수 없습니다(오류 코드 ${(e && e.code) || '없음'}). DD_RESULT_OUTBOX 경로·권한을 확인하세요 — E_OUTBOX_INSECURE 는 이미 있는 폴더·파일에 다른 계정 권한이 있다는 뜻이며 서버는 그것을 고치지 않습니다. 기동을 중단합니다.`);
    process.exit(1);
  }
}
let accounts = db.enabled() ? A.createAccounts(A.pgStore(db.query), null, A.smtpMailer(process.env), openOutbox()) : null;
const authBuckets = new Map(); // scrypt 를 부르는 계정 요청(가입·로그인·복구·재발급)의 IP당 예산

// PUBLIC_DEPLOY: 소켓의 직접 피어는 항상 리버스 프록시(플랫폼 엣지)이지 실제 클라이언트가 아니다.
// 그 피어의 주소 대역을 신뢰 판정에 쓰지 않는다(임의 프록시 뒤 IP를 그대로 믿지 않는다는 원칙) —
// 대신 이 경로에서는 Host·Origin·좌석 토큰이 실질 경계가 된다(둘 다 peerAllowed 뒤에서 그대로 검사).
// 부작용: 모든 요청·연결이 같은 소켓 피어(프록시) 주소로 보이므로, 아래 httpBuckets·upgradeBuckets·
// connectionsByIp·authLimiter 의 "IP당" 한도가 실제로는 이 배포 인스턴스 전체가 나누는 공유 한도가
// 된다 — 한 사용자가 몰아 쓰면 다른 사용자도 같이 막힐 수 있다(가용성 저하일 뿐 인증 우회는 아니다).
// X-Forwarded-For 로 원 클라이언트 IP를 복원하는 것은 프록시가 그 헤더를 덮어쓰는지 이 프로젝트가
// 검증하지 못했으므로 임의로 신뢰하지 않는다 — 하지 않는다(§217 deploy-readiness 문서 참조).
function peerAllowed(ip) {
  if (PUBLIC_DEPLOY) return true;
  return LAN_OPT_IN ? S.isPrivateIp(ip) : S.isLoopbackIp(ip);
}

function allowedHost(hostHeader) {
  return S.isAllowedHost(hostHeader, PUBLIC_HOSTS);
}

function bucketFor(map, ip, capacity, refill) {
  let b = map.get(ip);
  if (!b) { b = new S.TokenBucket(capacity, refill); map.set(ip, b); }
  return b;
}

/* ===== HTTP — 헬스체크 + 게임 클라이언트 정적 서빙 (인증 없음 — 저장소에 들어 있는 공개 클라이언트뿐) ===== */

function sendHead(res, status, extra) {
  res.writeHead(status, Object.assign({}, S.SECURITY_HEADERS, extra || {}));
}
function deny(res, status, message) {
  sendHead(res, status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message || String(status));
}

function handleRequest(req, res) {
  const ip = S.normalizeIp(req.socket.remoteAddress);
  if (!peerAllowed(ip)) return deny(res, 403, LAN_OPT_IN ? 'LAN only' : 'localhost only');
  if (!bucketFor(httpBuckets, ip, LIMITS.httpBurst, LIMITS.httpReqPerSec).take(1)) return deny(res, 429, 'too many requests');
  const authPath = /^\/api\/(auth\/|profile(?:[/?]|$))/.test(req.url || ''); // #260 /api/profile* 도 같은 계정 경계(CSRF·본문 상한·DB 503)
  if (!S.ALLOWED_METHODS.has(req.method) && !(authPath && req.method === 'POST')) {
    sendHead(res, 405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('method not allowed');
  }
  if (!allowedHost(req.headers.host)) return deny(res, 400, 'bad host');
  if ((req.url || '').length > LIMITS.maxUrlLength) return deny(res, 414, 'uri too long');
  const origin = req.headers.origin;
  if (origin && !S.isSameOrigin(origin, req.headers.host)) return deny(res, 403, 'bad origin');

  let pathname = '/';
  try { pathname = new URL(req.url || '/', 'http://placeholder.invalid').pathname; } catch (e) { /* 기본값 유지 */ }
  if (pathname === '/healthz') {
    sendHead(res, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end(req.method === 'HEAD' ? undefined : 'ok');
  }
  // #264 /readyz — DB 왕복을 실제로 해 보고, 앱이 쓰는 표·열이 지금도 있는지 본다(기동 게이트와 같은 검사 —
  // 기동 뒤에 표가 지워져도 원장은 그대로라 원장만으로는 모른다). /healthz 와 분리한 이유: 플랫폼 헬스체크가 DB 로
  // 흔들리면 DB 장애가 서비스 재시작 루프가 된다. DB 를 안 쓰는 배포에서는 그냥 200 "ok (no db)".
  // 본문에 호스트·오류 문구·빠진 표 이름을 싣지 않는다(정보 노출 없이 상태만).
  if (pathname === '/readyz') {
    if (!db.enabled()) {
      sendHead(res, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(req.method === 'HEAD' ? undefined : 'ok (no db)');
    }
    return mig.missingSchema({ query: db.query }).then(
      (missing) => {
        if (missing.length) return deny(res, 503, 'db schema incomplete');
        sendHead(res, 200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(req.method === 'HEAD' ? undefined : 'ok (db)');
      },
      () => deny(res, 503, 'db unavailable'),
    );
  }

  if (authPath) {
    // 비밀번호·복구 코드는 HTTPS 이거나 이 PC(루프백)에서만 받는다 — 판정과 그 전제는 accounts.js transport().
    const t = A.transport(req, ip, PUBLIC_DEPLOY, S.isLoopbackIp);
    return A.handleAuth(req, res, pathname, {
      accounts,
      send: (r, status, headers, body) => { sendHead(r, status, headers); r.end(body); },
      secure: t.secure,
      secretOk: t.secretOk,
      sameOrigin: !!origin, // 다른 출처 Origin 은 위에서 이미 403 이다 — 여기서는 "있는가"만 본다
      takeBucket: () => bucketFor(authBuckets, ip, 20, 1).take(1),
      revoke: endSessions,
    }).catch(() => { if (!res.headersSent) deny(res, 500, 'internal error'); else res.destroy(); }); // 처리되지 않은 reject 로 프로세스가 죽지 않게
  }

  const resolved = S.resolveStaticPath(ROOT, req.url);
  if (!resolved.ok) return deny(res, resolved.status, resolved.reason);
  fs.readFile(resolved.file, (e, data) => {
    if (e) return deny(res, 404, 'not found');
    sendHead(res, 200, { 'Content-Type': resolved.mime, 'Content-Length': String(data.length) });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  });
}
const server = TLS.options ? https.createServer(TLS.options, handleRequest) : http.createServer(handleRequest);

server.maxHeadersCount = 64;
server.headersTimeout = 10000;
server.requestTimeout = 30000;
server.on('clientError', (e, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
  else socket.destroy();
});

/* ===== credential 파서 (protocol.md §1) ===== */

const RE_NONCE = /^[A-Za-z0-9_-]{1,64}$/;
const RE_INVITE = /^[A-Za-z0-9]{6}$/;
const RE_ROOMID = /^[0-9]{1,10}$/;
const RE_EPOCH = /^[0-9a-f]{8}$/;

function parseCredential(cred) {
  if (typeof cred !== 'string' || cred.length === 0 || cred.length > 96) return null;
  if (cred.startsWith('cp-')) return RE_NONCE.test(cred.slice(3)) ? { kind: 'create', isPublic: true } : null;
  if (cred.startsWith('c-')) return RE_NONCE.test(cred.slice(2)) ? { kind: 'create', isPublic: false } : null;
  if (cred.startsWith('j-')) { const code = cred.slice(2); return RE_INVITE.test(code) ? { kind: 'join', code } : null; }
  if (cred.startsWith('p-')) { const id = cred.slice(2); return RE_ROOMID.test(id) ? { kind: 'joinPublic', roomId: Number(id) } : null; }
  if (cred.startsWith('l-')) return RE_NONCE.test(cred.slice(2)) ? { kind: 'lobby' } : null;
  if (cred.startsWith('r-')) {
    const rest = cred.slice(2);
    const dot = rest.indexOf('.');
    if (dot < 0) return null;
    const epoch = rest.slice(0, dot);
    const token = rest.slice(dot + 1);
    if (!RE_EPOCH.test(epoch) || !isWellFormedToken(token)) return null;
    return { kind: 'resume', epoch, token };
  }
  return null;
}

function presentedCredential(header) {
  const parsed = S.parseOfferedProtocols(header);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  if (parsed.protocols.length !== 2) return { ok: false, reason: 'bad_shape' };
  if (parsed.protocols[0] !== S.PROTOCOL_MARKER) return { ok: false, reason: 'bad_marker' };
  const cred = parseCredential(parsed.protocols[1]);
  if (!cred) return { ok: false, reason: 'bad_credential' };
  return { ok: true, cred };
}

/* ===== WebSocket ===== */

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: 8 * 1024,
  clientTracking: true,
  handleProtocols: S.selectProtocol,
});

function rejectUpgrade(socket, status, reason) {
  const text = `HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`;
  try { socket.write(text); } catch (e) { /* 소켓 이미 닫힘 */ }
  socket.destroy();
}

server.on('upgrade', (req, socket, head) => {
  const ip = S.normalizeIp(req.socket.remoteAddress);
  if (!peerAllowed(ip)) return rejectUpgrade(socket, 403, 'Forbidden');
  if (!bucketFor(upgradeBuckets, ip, LIMITS.upgradePerMin, LIMITS.upgradePerMin / 60).take(1)) {
    return rejectUpgrade(socket, 429, 'Too Many Requests');
  }
  if (!allowedHost(req.headers.host)) return rejectUpgrade(socket, 400, 'Bad Request');

  let pathname = '/';
  let roomNames = []; // #261 생성 소켓의 방 이름 ?rn= (credential 토큰은 64자 ASCII 라 한글 이름을 싣지 못한다)
  try {
    const u = new URL(req.url || '/', 'http://placeholder.invalid');
    pathname = u.pathname; roomNames = u.searchParams.getAll('rn');
  } catch (e) { /* 기본값 유지 */ }
  if (pathname !== '/') return rejectUpgrade(socket, 404, 'Not Found');

  const origin = req.headers.origin;
  if (origin && !S.isSameOrigin(origin, req.headers.host)) return rejectUpgrade(socket, 403, 'Forbidden');

  if (authLimiter.isBlocked(ip)) return rejectUpgrade(socket, 429, 'Too Many Requests');
  const presented = presentedCredential(req.headers['sec-websocket-protocol']);
  if (!presented.ok) {
    if (presented.reason !== 'absent') authLimiter.fail(ip);
    return rejectUpgrade(socket, 400, 'Bad Request');
  }
  authLimiter.reset(ip);

  const accept = (account) => {
    if (socket.destroyed) return;
    if (wss.clients.size >= LIMITS.maxConnections) return rejectUpgrade(socket, 503, 'Service Unavailable');
    if ((connectionsByIp.get(ip) || 0) >= LIMITS.maxConnectionsPerIp) {
      return rejectUpgrade(socket, 429, 'Too Many Requests');
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.ddIp = ip;
      ws.ddCred = presented.cred;
      ws.ddRoomNames = roomNames;
      ws.ddAccount = account; // #259 {id,userId,nickname} | null(계정 없는 서버·로비 목록)
      wss.emit('connection', ws, req);
    });
  };
  // #259 좌석을 얻거나 되찾는 연결(생성·참가·재접속)은 서버 쪽 세션 검증을 통과해야 한다. 로비 목록은 읽기 전용이라 예외.
  // #238 로비 목록도 세션 쿠키가 있으면 조회해 접속 인원에 센다 — 없거나 틀리거나 DB 장애면 종전처럼 익명 읽기 전용으로 받는다.
  const lobbyOnly = presented.cred.kind === 'lobby';
  const token = A.sessionTokenFrom(req);
  if (!accounts || (lobbyOnly && !token)) return accept(null);
  // 조회가 도는 동안 일어난 폐기는 이 기록에 쌓인다(endSessions). 조회는 폐기 전 DB 상태를 읽었을 수 있다 — 그 결과로
  // 소켓을 인가하지 않는다. 기록의 수명은 이 조회 하나의 수명과 같다(시계·시간 기반 정리 없음 — 잊을 수 없다).
  const lookup = { revoked: [] };
  pendingLookups.add(lookup);
  accounts.resolve(token).then(
    (who) => {
      pendingLookups.delete(lookup);
      if (who && lookup.revoked.some((r) => revokes(who, r))) who = null;
      return who || lobbyOnly ? accept(who) : (!socket.destroyed && rejectUpgrade(socket, 401, 'Unauthorized'));
    },
    () => { pendingLookups.delete(lookup); if (lobbyOnly) accept(null); else if (!socket.destroyed) rejectUpgrade(socket, 503, 'Service Unavailable'); }, // DB 장애 — 좌석 연결은 무계정으로 통과시키지 않는다
  ).catch(() => socket.destroy());
});

// #259 진행 중인 업그레이드 세션 조회들 — 조회 결과가 돌아와 소켓이 등록되기 전에 일어난 폐기를 놓치지 않으려고 둔다.
const pendingLookups = new Set();

// #259 세션이 끝난(로그아웃·재설정·절대 만료) 소켓은 더 행동하지 못한다. 좌석은 일반 단절처럼 60초 유예에 들어가므로
// 같은 계정으로 다시 로그인하면 그 안에 좌석 토큰으로 재접속할 수 있다(#237 유예·좌석 계정 바인딩 그대로).
// 클라이언트 계약: error E_SESSION_ENDED 프레임 뒤 close 4003 'session ended' — 자동 재접속하지 말고 로그인으로.
// ponytail: 폐기는 이 프로세스 안의 로그아웃·재설정 경로에서만 알린다(인스턴스 1개 전제). 여러 인스턴스면 주기적 DB 재확인이나 pub/sub 이 필요하다.
function sessionOver(ws) {
  return !!(ws.ddSessionEnded || (ws.ddAccount && Date.now() >= ws.ddAccount.expiresAt));
}
function endSession(ws, reason) {
  if (ws.ddLobbyOnly) { ws.ddAccount = null; return; } // #238 방 찾기는 읽기 전용 — 세션이 끝나면 끊지 않고 익명으로 남는다(접속 인원에서만 빠진다)
  if (ws.ddSessionEnded) return;
  ws.ddSessionEnded = true;
  sendFrame(ws, Object.assign({ v: 1, type: 'error', code: 'E_SESSION_ENDED' }, reason ? { reason } : {})); // reason 'login_replaced' = 다른 곳에서 로그인
  try { ws.close(4003, 'session ended'); } catch (e) { /* noop */ }
}
// #238 현재 멀티 접속 인원 — 열린 WS 중 유효 세션 계정의 고유 수(같은 계정 여러 소켓 = 1). 유예 중 좌석·익명·오프라인은 소켓이 없거나 계정이 없다.
// ponytail: 목록 요청마다 wss.clients 한 바퀴(최대 연결 상한까지) — 캐시·타이머 없음
function onlineCount() {
  const ids = new Set();
  for (const ws of wss.clients) if (ws.readyState === OPEN && ws.ddAccount && !sessionOver(ws)) ids.add(ws.ddAccount.id);
  return ids.size;
}
// 폐기 기술자(accounts.js): {sessionHash} = 그 세션 하나 · {accountId, belowLoginGen} = 그 계정의 **더 낮은 세대** 세션만.
// 세대 비교라, 늦게 끝난 옛 로그인·재설정의 폐기가 그보다 새 로그인의 소켓이나 진행 중 조회를 끊지 못한다.
function revokes(a, d) {
  return !!a && (a.sessionHash === d.sessionHash || (a.id === d.accountId && a.loginGen < d.belowLoginGen));
}
function endSessions(desc) {
  for (const p of pendingLookups) p.revoked.push(desc); // 아직 소켓이 되지 않은 조회에도 알린다
  for (const ws of wss.clients) if (revokes(ws.ddAccount, desc)) endSession(ws, desc.reason);
}

// #259 좌석을 계정에 묶는다. 이후 그 좌석의 재접속은 같은 계정 세션에서만 된다. 공개 닉네임도 여기서 붙인다(표시용 — 아이디·이메일·계정 id 는 프레임에 싣지 않는다).
function bindSeat(room, seat, ws) {
  room.seats[seat].accountId = ws.ddAccount ? ws.ddAccount.id : null;
  room.seats[seat].nickname = ws.ddAccount ? ws.ddAccount.nickname : null;
  room.seats[seat].rep = ws.ddAccount ? ws.ddAccount.repMinion : null; // #260 입장 당시 대표 하수인 — 이 방이 끝날 때까지 고정(재접속은 bindSeat 를 거치지 않는다)
}
// 좌석별 서버 권위 공개 닉네임 [좌석0, 좌석1] — 빈 좌석·계정 없는 서버는 null.
const playersOf = (room) => [0, 1].map((i) => room.seats[i].nickname || null);
// #260 좌석별 대표 하수인 ID [좌석0, 좌석1] — 프로필 표현일 뿐 전투 정보가 아니다. 빈 좌석·계정 없는 서버는 null.
const repsOf = (room) => [0, 1].map((i) => room.seats[i].rep || null);
// #295 상대 좌석 소켓의 서버 실측 왕복(ms, 짝 맞은 ping/pong) — 상대가 연결돼 있고 한 번 이상 잰 뒤에만. 표시 전용: 단절 판정은 close·pong 누락뿐이다.
const peerPingOf = (room, seat) => {
  const w = room.peerConnected(seat) ? room.seats[1 - seat].ws : null;
  return w && Number.isInteger(w.ddRtt) ? w.ddRtt : null;
};
// #295 연결 표시 칸 — 상대 연결·상대 왕복·내 소켓의 서버 실측 왕복(selfPingMs, 아직 재지 않았으면 null). 보낼 때의 값이다.
const liveOf = (room, seat) => {
  const w = room.seats[seat].ws;
  return { peerConnected: room.peerConnected(seat), peerPingMs: peerPingOf(room, seat), selfPingMs: w && Number.isInteger(w.ddRtt) ? w.ddRtt : null };
};
// #295 소켓의 현재 좌석 번호 — 번호를 소켓에 굳히지 않고 자격 객체·연결 세대로 찾는다. 승격된 참가자(1→0)는 같은 소켓·토큰으로
// 따라가고, 무효화된 방장·내보낸 참가자·밀려난 낡은 연결은 -1 이다.
const seatOf = (room, ws) => room.seats.findIndex((s) => !!s.credential && s.credential === ws.ddSeatCred && s.credential.connGen === ws.ddConnGen);
// 같은 계정이 상대 좌석을 잡지 못한다(자기 방 참가 금지). 자기 좌석 재접속(resume)은 별개 경로다.
const sameAccount = (room, ws) => !!ws.ddAccount && room.seats[0].accountId === ws.ddAccount.id;

function sendFrame(ws, obj) {
  if (!ws || ws.readyState !== OPEN) return;
  try { ws.send(JSON.stringify(obj)); } catch (e) { /* noop */ }
}

function bumpSeq(room, seat) {
  room.seats[seat].seq += 1;
  return room.seats[seat].seq;
}

// 한 좌석에 현재 룸 상태를 능동적으로 밀어준다 (명령 응답이 아닌 전이: 참가 알림·유예 만료·로비 정리·엔진 장애).
function pushState(room, seat) {
  const s = room.seats[seat];
  if (!s.ws || s.ws.readyState !== OPEN) return;
  sendFrame(s.ws, { v: 1, type: 'room_state', epoch: EPOCH, revision: room.revision, seat, data: room.toSeatView(seat), players: playersOf(room), reps: repsOf(room), ...liveOf(room, seat), seq: bumpSeq(room, seat) });
}

// 모든 룸 공통 — 타이머·정리로 일어난 종료 전이는 응답할 명령이 없으므로 양 좌석에 결과를 푸시한다.
function attachNotifier(room) {
  room.onFinalize = () => { pushState(room, 0); pushState(room, 1); };
  room.onUpdate = room.onFinalize; // #237 게임 시계 만료(상점·B08)도 명령 없이 일어난 전이다
  // #260 보드 경기 종료 — 좌석(계정)별 전적 기록. 좌석의 계정·닉네임은 입장 때 묶인 값(경기 당시 스냅샷)이다.
  room.onResult = (ended) => { if (accounts) accounts.recordMatch(ended, room.seats); };
}

function firstFrame(ws, type, room, seat, issued, extra) {
  ws.ddRoomId = room.roomId; ws.ddConnGen = issued.connGen;
  ws.ddSeatCred = room.seats[seat].credential; // #238 비워진 참가자 좌석의 옛 소켓 — 새 참가자의 connGen 과 번호가 겹쳐도 자격 객체가 다르다
  sendFrame(ws, Object.assign({
    v: 1, type, epoch: EPOCH, roomId: room.roomId, seat,
    seatToken: issued.seatToken, tokenGen: issued.tokenGen,
    revision: room.revision, seq: bumpSeq(room, seat), economy: room.economy, // #237 첫 프레임부터 경제 방 여부
    roomName: room.name,      // #261 서버가 정한 방 이름 — 새로고침·재접속에도 같은 값
    players: playersOf(room), // #259 서버 권위 공개 닉네임
    reps: repsOf(room),       // #260 입장 때 고정된 대표 하수인 ID
    ...liveOf(room, seat), // #262 상대 연결 여부 · #295 상대/내 실측 왕복(ms) | null
  }, extra || {}));
}

// #262 이모티콘 — 게임 명령 경로(중복 제거·handleCommand·revision·seq·room_state)를 타지 않는 일회성 전달. 저장·재전송 없음.
// 상대 사본에는 requestId(클라이언트가 정한 자유 문자열)를 싣지 않는다. 틀린 id 는 되돌려 보내지 않는다.
function sendEmote(room, seat, ws, msg) {
  const r = isEmoteId(msg.id) ? room.emote(seat) : { ok: false, reason: 'E_BAD_ENVELOPE' };
  if (!r.ok) return sendFrame(ws, Object.assign({ v: 1, type: 'emote_result', ok: false, requestId: msg.requestId, code: r.reason }, r.retryMs ? { retryMs: r.retryMs } : {}));
  const base = { v: 1, type: 'emote', epoch: EPOCH, roomId: room.roomId, from: seat, id: msg.id };
  sendFrame(ws, Object.assign({}, base, { requestId: msg.requestId, cooldownMs: r.cooldownMs }));
  sendFrame(room.seats[1 - seat].ws, base);
}

// 게스트 참가 성공 직후 — 호스트는 OPEN→SETUP 전이를 이 푸시로만 안다(Mars 실통합 msg_31cb978ea815: 없으면
// 호스트가 게스트 도착 전에 보낸 setup/ready가 E_ILLEGAL_ACTION이 되고 재전송 시점을 알 수 없었다).
function guestJoined(ws, room, issued) {
  firstFrame(ws, 'room_joined', room, 1, issued);
  pushState(room, 0);
}

wss.on('connection', (ws) => {
  const ip = ws.ddIp;
  connectionsByIp.set(ip, (connectionsByIp.get(ip) || 0) + 1);
  ws.isAlive = true;
  ws.on('pong', (data) => {
    ws.isAlive = true;
    // #295 짝 맞은 pong 만 왕복으로 잰다 — 좌석 소켓이면 나에게 self_ping, 상대에게 peer_ping 으로 알린다(seq 없는 일회성 프레임). 값이 커도 단절로 보지 않는다.
    const p = ws.ddPing;
    if (!p || data.toString() !== p.n) return;
    ws.ddPing = null;
    ws.ddRtt = Math.round(performance.now() - p.at);
    const room = !ws.ddLobbyOnly && lobby.getRoom(ws.ddRoomId);
    const at = room ? seatOf(room, ws) : -1;
    if (at < 0) return;
    sendFrame(ws, { v: 1, type: 'self_ping', ms: ws.ddRtt });
    sendFrame(room.seats[1 - at].ws, { v: 1, type: 'peer_ping', ms: ws.ddRtt });
  });

  const cred = ws.ddCred;
  const failClose = (code) => { sendFrame(ws, { v: 1, type: 'error', code }); ws.close(1008, code); };

  // #260 DB 에 쓰지 못한 결과가 상한(200경기) 이상이거나 아웃박스 파일이 어긋났으면 새 공식 경기(방 생성·참가)를 받지 않는다.
  // 진행 중인 경기의 재접속(resume)은 막지 않는다 — 끝나야 결과가 남는다. 완료된 결과는 어떤 경우에도 버리지 않는다.
  if (accounts && /^(create|join|joinPublic)$/.test(cred.kind) && accounts.resultsBlocked()) return failClose('E_RESULTS_BACKLOG');

  if (cred.kind === 'lobby') {
    ws.ddLobbyOnly = true;
    sendFrame(ws, { v: 1, type: 'lobby_ready', epoch: EPOCH });
  } else if (cred.kind === 'create') {
    // #261 rn 이 없으면(옛 클라이언트) 기본 이름. 보냈으면 정확히 1개·허용 문자·2~20자여야 한다 — 틀린 이름을 기본값으로 바꾸지 않는다.
    const rn = ws.ddRoomNames;
    const name = rn.length === 0 ? undefined : (rn.length === 1 ? normalizeRoomName(rn[0]) : null);
    if (name === null) return failClose('E_BAD_ROOM_NAME');
    const created = lobby.createRoom(ip, { isPublic: cred.isPublic, name });
    if (!created.ok) return failClose(created.reason);
    attachNotifier(created.room);
    const issued = created.room.openHostSeat(ws);
    bindSeat(created.room, 0, ws);
    firstFrame(ws, 'room_opened', created.room, 0, issued, {
      inviteCode: created.room.inviteCode || undefined, public: created.room.isPublic,
    });
  } else if (cred.kind === 'join') {
    const found = lobby.findByInvite(cred.code);
    if (!found.ok) return failClose(found.reason);
    if (sameAccount(found.room, ws)) return failClose('E_SAME_ACCOUNT'); // 방·초대 코드를 건드리기 전에 거부
    const res = found.room.joinGuestSeat(ws);
    if (!res.ok) return failClose(res.reason);
    bindSeat(found.room, 1, ws);
    lobby.invalidateInvite(found.code); // 1회용 (analysis.md §2.3)
    guestJoined(ws, found.room, res.issued);
  } else if (cred.kind === 'joinPublic') {
    const room = lobby.getRoom(cred.roomId);
    if (!room || !room.isPublic || room.state !== STATES.OPEN) return failClose('E_ROOM_NOT_FOUND');
    if (sameAccount(room, ws)) return failClose('E_SAME_ACCOUNT');
    const res = room.joinGuestSeat(ws);
    if (!res.ok) return failClose(res.reason);
    bindSeat(room, 1, ws);
    guestJoined(ws, room, res.issued);
  } else if (cred.kind === 'resume') {
    // §2.4.1.1 — 에폭이 다르면 토큰을 검증하지 않고 즉시 E_EPOCH. VOID (몰수 아님).
    if (cred.epoch !== EPOCH) return failClose('E_EPOCH');
    let match = null;
    for (const room of lobby.rooms.values()) {
      for (let s = 0; s < 2; s++) {
        const c = room.seats[s].credential;
        if (c && c.classify(cred.token) !== 'invalid') { match = { room, seat: s }; break; }
      }
      if (match) break;
    }
    if (!match) return failClose('E_SEAT_TOKEN_INVALID');
    // #259 좌석 토큰만 훔쳐서는 안 된다 — 그 좌석을 얻은 계정의 세션이어야 한다. 좌석을 회전·교체하기 **전에** 본다.
    // 응답은 토큰이 틀린 것과 같다(토큰이 맞았다는 사실을 알려 주지 않는다). 계정 없는 서버는 양쪽 다 null 이라 그대로다.
    const owner = match.room.seats[match.seat].accountId || null;
    if (owner !== (ws.ddAccount ? ws.ddAccount.id : null)) return failClose('E_SEAT_TOKEN_INVALID');
    const result = match.room.resumeSeat(match.seat, cred.token, ws);
    if (!result.ok) return failClose(result.reason);
    firstFrame(ws, 'room_resumed', match.room, match.seat, result.issued, { data: match.room.toSeatView(match.seat), emoteRetryMs: match.room.emoteRetryMs(match.seat) }); // #262 좌석 쿨다운 잔여(ms)
    pushState(match.room, 1 - match.seat); // #237 상대의 "연결 대기" 해제·시계 재개를 알린다(2.4)
  }

  ws.on('message', (data, isBinary) => {
    if (isBinary) { ws.close(1003, 'binary not supported'); return; }
    if (sessionOver(ws)) { endSession(ws); if (!ws.ddLobbyOnly) return; } // #259 끝난 세션의 소켓은 어떤 명령도(읽기 포함) 처리하지 않는다

    if (ws.ddLobbyOnly) {
      const v = validateEnvelope(data);
      if (v.ok && v.msg.t === 'list_rooms') sendFrame(ws, { v: 1, type: 'lobby_rooms', rooms: lobby.listPublicOpenRooms(), onlineCount: onlineCount() });
      if (v.ok && v.msg.t === 'rtt') sendFrame(ws, { v: 1, type: 'rtt', n: v.msg.n }); // #261 실측 왕복 — 즉시 되돌려 준다(연결 생존 ping/pong 과 별개)
      return;
    }

    const room = lobby.getRoom(ws.ddRoomId);
    if (!room) { sendFrame(ws, { v: 1, type: 'error', code: 'E_ROOM_CLOSED' }); return; }
    // 연결 펜싱 — 더 이상 이 소켓이 어느 좌석의 최신 연결도 아니면 무시한다 (analysis.md §2.4.4 · #295 무효화된 방장).
    const seatIndex = seatOf(room, ws);
    if (seatIndex < 0) { try { ws.close(4001, 'superseded'); } catch (e) { /* noop */ } return; }
    const seat = room.seats[seatIndex];

    const parsed = validateEnvelope(data);
    if (!parsed.ok) { sendFrame(ws, { v: 1, type: 'error', code: parsed.reason, seq: bumpSeq(room, seatIndex) }); return; }
    const msg = parsed.msg;

    if (msg.t === 'rtt') return; // #261 로비 전용 소켓에서만 답한다 — 좌석 소켓은 seq 를 건드리지 않고 무시
    if (msg.t === 'list_rooms') { // 읽기 전용 — 상태를 바꾸지 않는다
      sendFrame(ws, { v: 1, type: 'lobby_rooms', rooms: lobby.listPublicOpenRooms(), onlineCount: onlineCount(), seq: bumpSeq(room, seatIndex) });
      return;
    }

    // 좌석 토큰 인증 — §2.4.3. **leave를 포함한 모든 상태 변경 명령**이 여기를 통과해야 한다
    // (v3는 leave 분기가 이 검사보다 앞에 있어 위조 토큰으로 OPEN 룸을 취소할 수 있었다 — Saturn msg_eb240f4c5b27).
    // previous 토큰은 재개 전용이라 일반 명령에는 허용하지 않는다.
    // #262 이모티콘의 거부는 일반 error 가 아니라 전용 emote_result 다(seq 를 올리지 않는다 — 클라이언트의 명령 오류 처리를 타지 않게).
    const refuse = (code) => sendFrame(ws, msg.t === 'emote'
      ? { v: 1, type: 'emote_result', ok: false, requestId: msg.requestId, code }
      : { v: 1, type: 'error', requestId: msg.requestId, code, seq: bumpSeq(room, seatIndex) });
    const cls = seat.credential.classify(msg.seatToken);
    if (cls === 'invalid') return refuse('E_SEAT_TOKEN_INVALID');
    if (cls === 'previous' || msg.tokenGen !== seat.credential.tokenGen) return refuse('E_TOKEN_GEN_STALE');
    seat.credential.verifyForCommand(msg.seatToken, msg.tokenGen); // ack — 직전 토큰 폐기

    if (msg.t === 'emote') return sendEmote(room, seatIndex, ws, msg);

    // #238 경기 번호 경계는 중복 제거보다 먼저 — 지난 경기의 저장 응답을 재전송하지 않는다. 거부는 저장하지 않는다(최신 뷰 동봉).
    if (room.roundStale(msg)) {
      sendFrame(ws, { v: 1, type: 'error', requestId: msg.requestId, code: 'E_STALE_REVISION', revision: room.revision, data: room.toSeatView(seatIndex), ...liveOf(room, seatIndex), seq: bumpSeq(room, seatIndex) });
      return;
    }

    // 중복 제거 — §2.5.3. (roomId,seat,requestId) 키, 재실행하지 않고 저장된 응답을 재전송한다.
    const cached = room.checkDedup(seatIndex, msg.requestId);
    if (cached) { sendFrame(ws, Object.assign({}, cached, liveOf(room, seatIndex), { seq: bumpSeq(room, seatIndex) })); return; }

    const peer = room.seats[1 - seatIndex];
    const outcome = room.handleCommand(seatIndex, msg);
    // #238 -1 = 이 좌석은 비워졌다(응답을 새 참가자의 중복 제거 표에 남기지 않는다) · #295 다른 번호 = 결과 복귀로 방장이 됐다
    const at = room.seats.indexOf(seat);
    const me = at < 0 ? seatIndex : at;
    let frame;
    if (!outcome.ok) {
      frame = { v: 1, type: 'error', requestId: msg.requestId, code: outcome.reason, revision: room.revision };
      if (outcome.staleView) frame.data = outcome.staleView;
    } else {
      frame = { v: 1, type: outcome.type, requestId: msg.requestId, epoch: EPOCH, revision: room.revision, seat: me, data: outcome.data };
    }
    if (at >= 0) room.storeDedup(at, msg.requestId, frame);
    sendFrame(ws, Object.assign({}, frame, liveOf(room, me), { seq: ++seat.seq })); // 연결 표시 칸은 보낼 때의 값(캐시에 넣지 않는다)

    // 상대에게도 같은 revision의 갱신 뷰를 보낸다 — 실제로 상태가 바뀐 성공 명령만(noop·오류는 보내지 않는다).
    // #295 상대가 승격됐으면(방장 나가기) 그 새 좌석 번호로 보낸다.
    const pAt = room.seats.indexOf(peer);
    if (outcome.ok && (!outcome.noop || at !== seatIndex)) pushState(room, pAt >= 0 ? pAt : 1 - me);

    // #295 내보낸 참가자 — 닫힘 뷰를 보내고 그 소켓을 닫는다(옛 토큰은 이미 좌석에 없다).
    if (outcome.kicked && peer.ws) {
      sendFrame(peer.ws, { v: 1, type: 'room_state', epoch: EPOCH, reason: 'kicked', revision: room.revision, seat: 1, data: outcome.kicked, seq: ++peer.seq });
      try { peer.ws.close(1000, 'kicked'); } catch (e) { /* noop */ }
    }

    // 종료된 경기에서의 leave — 응답을 보낸 뒤 이 소켓만 닫는다.
    if (outcome.ok && msg.t === 'leave' && (room.state === STATES.FINISHED || at < 0)) {
      seat.connected = false;
      try { ws.close(1000, 'leave'); } catch (e) { /* noop */ }
    }
  });

  ws.on('close', () => {
    const n = (connectionsByIp.get(ip) || 1) - 1;
    if (n <= 0) connectionsByIp.delete(ip); else connectionsByIp.set(ip, n);
    if (ws.ddLobbyOnly) return;
    const room = lobby.getRoom(ws.ddRoomId);
    if (!room) return;
    // 연결 펜싱(§2.4.4) — 재개로 밀려난 낡은 소켓·무효화된 방장·내보낸 참가자의 뒤늦은 close는 지금 좌석을 끊지 않는다.
    const at = seatOf(room, ws);
    if (at < 0) return;
    room.socketClosed(at);
    // #237 상대 화면에 "상대 연결 대기"(2.4) · #295 승격된 방장에게 새 좌석·방 상태 — 두 좌석 모두(빈 좌석은 건너뛴다)
    pushState(room, 0); pushState(room, 1);
  });

  ws.on('error', () => ws.terminate());
});

// #295 10초 — 직전 ping 의 pong 이 없으면 끊는다(close → 좌석 유예 시작). ping 마다 번호를 실어 짝 맞은 pong 으로 왕복을 잰다.
let pingSeq = 0;
function heartbeatTick() {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ddPing = { n: String(++pingSeq), at: performance.now() };
    ws.ping(ws.ddPing.n);
  }
}
const heartbeat = setInterval(heartbeatTick, 10000);

const sweeper = setInterval(() => {
  lobby.sweep();
  authLimiter.sweep(Date.now());
  if (accounts) { accounts.sweep(Date.now()); accounts.flushPending().catch(() => {}); } // #260 보류 중인 전적 기록 재시도
  for (const ws of wss.clients) if (ws.ddAccount && sessionOver(ws)) endSession(ws); // 명령 없이 열려만 있는 소켓도 만료 시 끊는다
  if (authBuckets.size > 256) authBuckets.clear();
  if (httpBuckets.size > 256) httpBuckets.clear();
  if (upgradeBuckets.size > 256) upgradeBuckets.clear();
}, 30000);

heartbeat.unref?.();
sweeper.unref?.();

if (require.main === module) {
  if (!bindChoice.ok) {
    console.error(`[보안] DD_AUTH_BIND 가 노출 정책과 맞지 않습니다 (사유: ${bindChoice.reason}). 기동을 중단합니다.`);
    process.exit(1);
  }
  if (PUBLIC_HOST && !PUBLIC_HOST_CHECK.ok) {
    console.error(`[보안] DD_AUTH_PUBLIC_HOST 값이 올바르지 않습니다 (사유: ${PUBLIC_HOST_CHECK.reason}). 스킴·포트·경로 없이 호스트명만 적으세요 (예: my-service.onrender.com). 기동을 중단합니다.`);
    process.exit(1);
  }
  if (PUBLIC_DEPLOY && !PUBLIC_HOST) {
    console.error('[보안] DD_AUTH_PUBLIC_DEPLOY=1 인데 DD_AUTH_PUBLIC_HOST 가 없습니다. 이 상태로 뜨면 모든 요청이 Host 불일치(400)로 거부됩니다. 배포 도메인을 DD_AUTH_PUBLIC_HOST 로 지정하세요. 기동을 중단합니다.');
    process.exit(1);
  }
  // #264 DB 기동 게이트 — DATABASE_URL 이 있으면 **연결과 스키마를 실제로 확인한 뒤에만** listen 한다.
  // 반쯤 붙은 서버가 뜨는 것이 최악이다(나중에 계정 쓰기가 조용히 실패한다). 확인 실패 = exit 1.
  // DD_DB_MIGRATE_ON_START=1 은 셸이 없는 Render Free 용 옵트인이다(기본은 적용하지 않고 게이트만).
  if (db.enabled()) {
    Promise.resolve()
      .then(() => db.getPool()) // 설정 오류(TLS 강등·잘못된 DSN)도 여기서 잡아 같은 경로로 중단한다
      .then((client) => (process.env.DD_DB_MIGRATE_ON_START === '1'
        ? mig.up(client, mig.loadMigrations()).then((done) => { if (done.length) console.log(`  DB 마이그레이션 적용: ${done.join(', ')}`); return client; })
        : client))
      .then((client) => mig.verify(client))
      .then(() => {
        console.log(`  ${db.describe()} — 연결·스키마 확인 완료`);
        const n = accounts.pendingCount(); // #260 재시작 전 DB 에 쓰지 못한 결과 — 기동 즉시 다시 쓴다(멱등)
        if (n) console.log(`  [전적] 아웃박스 미저장 결과 ${n}건 — DB 에 다시 쓴다`);
        accounts.flushPending().catch(() => {});
        listen();
      })
      .catch((e) => {
        // pg 원문 메시지는 찍지 않는다 — 호스트·포트가 섞일 수 있다(db.safeErrorText).
        console.error(`[DB] DATABASE_URL 이 설정됐지만 사용할 수 없습니다: ${db.safeErrorText(e)}`);
        console.error('  DB 없이 뜨면 계정·전적 쓰기가 조용히 실패하므로 기동을 중단합니다. DB 를 쓰지 않으려면 DATABASE_URL 을 지우고, 스키마가 미적용이면 `node db-migrate.js up` 을 먼저 실행하세요.');
        process.exit(1);
      });
  } else {
    listen();
  }
}

function listen() {
  server.listen(PORT, BIND, () => {
    const actual = server.address().port;
    const mode = PUBLIC_DEPLOY ? '공개 배포(WAN) — 리버스 프록시 뒤, 피어 IP 미검사' : (LAN_OPT_IN ? 'LAN 공개 — 사설 대역만' : '루프백 전용');
    console.log(`Digit Dual 공개 대전 서버(#217 서버 권위) listening on ${BIND}:${actual} (${mode}, epoch ${EPOCH})`);
    console.log(`  클라이언트: ${ROOT}`);
    console.log(`  접속 주소: ${SCHEME}://127.0.0.1:${actual}`);
    if (TLS.options) console.log('  TLS: 네이티브 HTTPS(TLS 1.2+) — 인증서가 이 접속 주소의 이름을 담고 접속 기기가 그 인증서를 신뢰해야 한다');
    if (PUBLIC_DEPLOY) {
      console.log(`  WAN 접속 주소(공식 도메인): https://${PUBLIC_HOST}`);
      if (RENDER_HOST_CHECK.ok && RENDER_HOST_CHECK.host !== PUBLIC_HOST_CHECK.host) console.log(`  플랫폼 기본 주소(대체·롤백, Host 허용): https://${RENDER_HOST_CHECK.host}`);
      else if (RENDER_HOST_RAW && !RENDER_HOST_CHECK.ok) console.log(`  경고: RENDER_EXTERNAL_HOSTNAME 형식 오류(사유: ${RENDER_HOST_CHECK.reason}) — Host 허용 목록에 더하지 않았다`);
      console.log('  주의: 이 모드는 소켓 피어 IP를 신뢰 경계로 쓰지 않는다 — Host·Origin·좌석 토큰만으로 막는다.');
      console.log('  주의: 리버스 프록시 뒤에서는 IP당 요청/연결 한도가 이 인스턴스 전체가 나누는 공유 한도가 된다(docs/milestone/v0.4.10/issues/217/Jupiter/deploy-readiness.md).');
    } else if (LAN_OPT_IN) {
      // TLS 는 인증서에 담긴 이름으로만 접속된다 — 인터페이스를 훑어 인증서 밖 주소를 안내하지 않고 접속 주소는 실행기가 안내한다.
      if (TLS.options) console.log(`  내부망: ${BIND}:${actual} TLS 바인딩 — 인증서에 담긴 주소로만 접속된다(실행기가 안내한 주소 사용)`);
      else {
        console.log('  주의: 평문 HTTP 내부망 주소에서는 로그인·가입이 403 E_INSECURE_TRANSPORT 다 — 로그인은 DD_AUTH_TLS_CERT·DD_AUTH_TLS_KEY(HTTPS)가 필요하다.');
        for (const list of Object.values(os.networkInterfaces())) {
          for (const i of list) {
            if (i.family === 'IPv4' && !i.internal && S.isPrivateIp(i.address)) console.log(`  내부망 주소: ${SCHEME}://${i.address}:${actual}`);
          }
        }
      }
    } else {
      console.log('  LAN 공개가 필요하면 --lan (또는 DD_LAN=1) 로 기동하세요 (기본은 이 PC 전용).');
    }
    console.log(`  헬스체크: ${SCHEME}://127.0.0.1:${actual}/healthz`);
    if (accounts) console.log(`  비밀번호 재설정 메일: ${accounts.mailEnabled ? 'SMTP 설정됨' : '미설정 — 재설정 요청은 503 E_MAIL_UNAVAILABLE'}`); // 설정 값은 찍지 않는다
    if (PUBLIC_HOST && !PUBLIC_DEPLOY) console.log(`  WAN 배포 준비 호스트(Host 허용 목록에만 추가됨): ${PUBLIC_HOST}`);
  });
}

// 테스트 전용 — 살아 있는 Postgres 없이 계정 경로를 돌리려고 저장소를 바꿔 끼운다(운영 경로는 위 db.enabled() 하나).
// 한 IP(루프백)에서 수십 건을 보내는 테스트가 예산에 막히지 않게 예산도 비운다.
function useAccounts(a) { accounts = a; authBuckets.clear(); }

module.exports = { server, wss, lobby, EPOCH, useAccounts, heartbeatTick, ROOT, parseCredential, presentedCredential, peerAllowed, allowedHost, PUBLIC_DEPLOY, PUBLIC_HOST, LAN_OPT_IN, PORT, SCHEME };
