'use strict';
// #217 서버 권위 인증 서버 — protocol.md의 구현. 기존 코드 접속 릴레이(server/server.js, 기본 8080)는 건드리지 않고
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
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer, OPEN } = require('ws');
const S = require('../security');
const { Lobby } = require('./lobby');
const { STATES } = require('./room');
const { validateEnvelope } = require('./protocol');
const { isWellFormedToken } = require('./seatToken');

// DD_AUTH_PORT 를 명시하면 그대로 우선한다(기존 로컬/LAN 실행기·문서 그대로). 미설정이면 플랫폼이
// 주입하는 PORT(Render 등)를 듣는다 — 없으면 기존 기본값 8081.
const PORT = Number(process.env.DD_AUTH_PORT || process.env.PORT || 8081);
const LAN_OPT_IN = process.env.DD_LAN === '1' || process.argv.includes('--lan');
// 리버스 프록시(Render 등) 뒤 공개 배포 옵트인. DD_LAN(같은 공유기 신뢰)과는 별개 축이다 — 위 주석 참조.
const PUBLIC_DEPLOY = process.env.DD_AUTH_PUBLIC_DEPLOY === '1';
const PUBLIC_HOST = process.env.DD_AUTH_PUBLIC_HOST || null; // §2.1 DD_PUBLIC_HOST 상당
const PUBLIC_HOST_CHECK = PUBLIC_HOST ? S.validatePublicHost(PUBLIC_HOST) : { ok: true, host: null };

const bindChoice = S.resolveBindAddress(process.env.DD_AUTH_BIND, LAN_OPT_IN || PUBLIC_DEPLOY);
const BIND = bindChoice.ok ? bindChoice.bind : '127.0.0.1';

const EPOCH = crypto.randomBytes(4).toString('hex'); // 8자 16진 (analysis.md §2.4.1.1)

// 게임 클라이언트 정적 서빙 위치 — 릴레이(server/server.js)와 같은 탐색 순서.
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
const lobby = new Lobby({ epoch: EPOCH });

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
  return S.isAllowedHost(hostHeader, PUBLIC_HOST ? [PUBLIC_HOST.toLowerCase()] : []);
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

const server = http.createServer((req, res) => {
  const ip = S.normalizeIp(req.socket.remoteAddress);
  if (!peerAllowed(ip)) return deny(res, 403, LAN_OPT_IN ? 'LAN only' : 'localhost only');
  if (!bucketFor(httpBuckets, ip, LIMITS.httpBurst, LIMITS.httpReqPerSec).take(1)) return deny(res, 429, 'too many requests');
  if (!S.ALLOWED_METHODS.has(req.method)) {
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

  const resolved = S.resolveStaticPath(ROOT, req.url);
  if (!resolved.ok) return deny(res, resolved.status, resolved.reason);
  fs.readFile(resolved.file, (e, data) => {
    if (e) return deny(res, 404, 'not found');
    sendHead(res, 200, { 'Content-Type': resolved.mime, 'Content-Length': String(data.length) });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  });
});

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
  try { pathname = new URL(req.url || '/', 'http://placeholder.invalid').pathname; } catch (e) { /* 기본값 유지 */ }
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

  if (wss.clients.size >= LIMITS.maxConnections) return rejectUpgrade(socket, 503, 'Service Unavailable');
  if ((connectionsByIp.get(ip) || 0) >= LIMITS.maxConnectionsPerIp) {
    return rejectUpgrade(socket, 429, 'Too Many Requests');
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    ws.ddIp = ip;
    ws.ddCred = presented.cred;
    wss.emit('connection', ws, req);
  });
});

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
  sendFrame(s.ws, { v: 1, type: 'room_state', epoch: EPOCH, revision: room.revision, seat, data: room.toSeatView(seat), seq: bumpSeq(room, seat) });
}

// 모든 룸 공통 — 타이머·정리로 일어난 종료 전이는 응답할 명령이 없으므로 양 좌석에 결과를 푸시한다.
function attachNotifier(room) {
  room.onFinalize = () => { pushState(room, 0); pushState(room, 1); };
}

function firstFrame(ws, type, room, seat, issued, extra) {
  ws.ddRoomId = room.roomId; ws.ddSeat = seat; ws.ddConnGen = issued.connGen;
  sendFrame(ws, Object.assign({
    v: 1, type, epoch: EPOCH, roomId: room.roomId, seat,
    seatToken: issued.seatToken, tokenGen: issued.tokenGen,
    revision: room.revision, seq: bumpSeq(room, seat),
  }, extra || {}));
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
  ws.on('pong', () => { ws.isAlive = true; });

  const cred = ws.ddCred;
  const failClose = (code) => { sendFrame(ws, { v: 1, type: 'error', code }); ws.close(1008, code); };

  if (cred.kind === 'lobby') {
    ws.ddLobbyOnly = true;
    sendFrame(ws, { v: 1, type: 'lobby_ready', epoch: EPOCH });
  } else if (cred.kind === 'create') {
    const created = lobby.createRoom(ip, { isPublic: cred.isPublic });
    if (!created.ok) return failClose(created.reason);
    attachNotifier(created.room);
    const issued = created.room.openHostSeat(ws);
    firstFrame(ws, 'room_opened', created.room, 0, issued, {
      inviteCode: created.room.inviteCode || undefined, public: created.room.isPublic,
    });
  } else if (cred.kind === 'join') {
    const found = lobby.findByInvite(cred.code);
    if (!found.ok) return failClose(found.reason);
    const res = found.room.joinGuestSeat(ws);
    if (!res.ok) return failClose(res.reason);
    lobby.invalidateInvite(found.code); // 1회용 (analysis.md §2.3)
    guestJoined(ws, found.room, res.issued);
  } else if (cred.kind === 'joinPublic') {
    const room = lobby.getRoom(cred.roomId);
    if (!room || !room.isPublic || room.state !== STATES.OPEN) return failClose('E_ROOM_NOT_FOUND');
    const res = room.joinGuestSeat(ws);
    if (!res.ok) return failClose(res.reason);
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
    const result = match.room.resumeSeat(match.seat, cred.token, ws);
    if (!result.ok) return failClose(result.reason);
    firstFrame(ws, 'room_resumed', match.room, match.seat, result.issued, { data: match.room.toSeatView(match.seat) });
  }

  ws.on('message', (data, isBinary) => {
    if (isBinary) { ws.close(1003, 'binary not supported'); return; }

    if (ws.ddLobbyOnly) {
      const v = validateEnvelope(data);
      if (v.ok && v.msg.t === 'list_rooms') sendFrame(ws, { v: 1, type: 'lobby_rooms', rooms: lobby.listPublicOpenRooms() });
      return;
    }

    const room = lobby.getRoom(ws.ddRoomId);
    if (!room) { sendFrame(ws, { v: 1, type: 'error', code: 'E_ROOM_CLOSED' }); return; }
    const seatIndex = ws.ddSeat;
    const seat = room.seats[seatIndex];

    // 연결 펜싱 — 더 이상 이 소켓이 그 좌석의 최신 연결이 아니면 무시한다 (analysis.md §2.4.4).
    if (seat.credential.connGen !== ws.ddConnGen) { try { ws.close(4001, 'superseded'); } catch (e) { /* noop */ } return; }

    const parsed = validateEnvelope(data);
    if (!parsed.ok) { sendFrame(ws, { v: 1, type: 'error', code: parsed.reason, seq: bumpSeq(room, seatIndex) }); return; }
    const msg = parsed.msg;

    if (msg.t === 'list_rooms') { // 읽기 전용 — 상태를 바꾸지 않는다
      sendFrame(ws, { v: 1, type: 'lobby_rooms', rooms: lobby.listPublicOpenRooms(), seq: bumpSeq(room, seatIndex) });
      return;
    }

    // 좌석 토큰 인증 — §2.4.3. **leave를 포함한 모든 상태 변경 명령**이 여기를 통과해야 한다
    // (v3는 leave 분기가 이 검사보다 앞에 있어 위조 토큰으로 OPEN 룸을 취소할 수 있었다 — Saturn msg_eb240f4c5b27).
    // previous 토큰은 재개 전용이라 일반 명령에는 허용하지 않는다.
    const cls = seat.credential.classify(msg.seatToken);
    if (cls === 'invalid') { sendFrame(ws, { v: 1, type: 'error', requestId: msg.requestId, code: 'E_SEAT_TOKEN_INVALID', seq: bumpSeq(room, seatIndex) }); return; }
    if (cls === 'previous' || msg.tokenGen !== seat.credential.tokenGen) {
      sendFrame(ws, { v: 1, type: 'error', requestId: msg.requestId, code: 'E_TOKEN_GEN_STALE', seq: bumpSeq(room, seatIndex) });
      return;
    }
    seat.credential.verifyForCommand(msg.seatToken, msg.tokenGen); // ack — 직전 토큰 폐기

    // 중복 제거 — §2.5.3. (roomId,seat,requestId) 키, 재실행하지 않고 저장된 응답을 재전송한다.
    const cached = room.checkDedup(seatIndex, msg.requestId);
    if (cached) { sendFrame(ws, Object.assign({}, cached, { seq: bumpSeq(room, seatIndex) })); return; }

    const outcome = room.handleCommand(seatIndex, msg);
    let frame;
    if (!outcome.ok) {
      frame = { v: 1, type: 'error', requestId: msg.requestId, code: outcome.reason, revision: room.revision };
      if (outcome.staleView) frame.data = outcome.staleView;
    } else {
      frame = { v: 1, type: outcome.type, requestId: msg.requestId, epoch: EPOCH, revision: room.revision, seat: seatIndex, data: outcome.data };
    }
    room.storeDedup(seatIndex, msg.requestId, frame);
    sendFrame(ws, Object.assign({}, frame, { seq: bumpSeq(room, seatIndex) }));

    // 상대에게도 같은 revision의 갱신 뷰를 보낸다 — 실제로 상태가 바뀐 성공 명령만(noop·오류는 보내지 않는다).
    if (outcome.ok && !outcome.noop) pushState(room, 1 - seatIndex);

    // 종료된 경기에서의 leave — 응답을 보낸 뒤 이 소켓만 닫는다.
    if (outcome.ok && msg.t === 'leave' && room.state === STATES.FINISHED) {
      seat.connected = false;
      try { ws.close(1000, 'leave'); } catch (e) { /* noop */ }
    }
  });

  ws.on('close', () => {
    const n = (connectionsByIp.get(ip) || 1) - 1;
    if (n <= 0) connectionsByIp.delete(ip); else connectionsByIp.set(ip, n);
    if (ws.ddLobbyOnly) return;
    const room = lobby.getRoom(ws.ddRoomId);
    if (!room || !Number.isInteger(ws.ddSeat)) return;
    const seat = room.seats[ws.ddSeat];
    // 연결 펜싱(§2.4.4) — 재개로 밀려난 낡은 소켓의 뒤늦은 close는 새로 붙은 좌석을 끊지 않는다.
    if (!seat.credential || seat.credential.connGen !== ws.ddConnGen) return;
    room.socketClosed(ws.ddSeat);
  });

  ws.on('error', () => ws.terminate());
});

const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);

const sweeper = setInterval(() => {
  lobby.sweep();
  authLimiter.sweep(Date.now());
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
  server.listen(PORT, BIND, () => {
    const actual = server.address().port;
    const mode = PUBLIC_DEPLOY ? '공개 배포(WAN) — 리버스 프록시 뒤, 피어 IP 미검사' : (LAN_OPT_IN ? 'LAN 공개 — 사설 대역만' : '루프백 전용');
    console.log(`Digit Dual 공개 대전 서버(#217 서버 권위) listening on ${BIND}:${actual} (${mode}, epoch ${EPOCH})`);
    console.log(`  클라이언트: ${ROOT}`);
    console.log(`  접속 주소: http://127.0.0.1:${actual}`);
    if (PUBLIC_DEPLOY) {
      console.log(`  WAN 접속 주소(플랫폼 도메인): https://${PUBLIC_HOST}`);
      console.log('  주의: 이 모드는 소켓 피어 IP를 신뢰 경계로 쓰지 않는다 — Host·Origin·좌석 토큰만으로 막는다.');
      console.log('  주의: 리버스 프록시 뒤에서는 IP당 요청/연결 한도가 이 인스턴스 전체가 나누는 공유 한도가 된다(docs/milestone/v0.4.10/issues/217/Jupiter/deploy-readiness.md).');
    } else if (LAN_OPT_IN) {
      for (const list of Object.values(os.networkInterfaces())) {
        for (const i of list) {
          if (i.family === 'IPv4' && !i.internal && S.isPrivateIp(i.address)) console.log(`  내부망 주소: http://${i.address}:${actual}`);
        }
      }
    } else {
      console.log('  LAN 공개가 필요하면 --lan (또는 DD_LAN=1) 로 기동하세요 (기본은 이 PC 전용).');
    }
    console.log(`  헬스체크: http://127.0.0.1:${actual}/healthz`);
    if (PUBLIC_HOST && !PUBLIC_DEPLOY) console.log(`  WAN 배포 준비 호스트(Host 허용 목록에만 추가됨): ${PUBLIC_HOST}`);
    console.log('  코드 접속(기존 릴레이)은 별도 서버입니다: npm run start:relay (기본 8080).');
  });
}

module.exports = { server, wss, lobby, EPOCH, ROOT, parseCredential, presentedCredential, peerAllowed, PUBLIC_DEPLOY, PUBLIC_HOST, LAN_OPT_IN, PORT };
