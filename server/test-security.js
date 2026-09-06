// #62 보안 회귀 테스트 — 순수 유틸 단위 + 실서버 통합.
// 서버는 PORT=0(임의 포트)·루프백 바인드로 따로 띄우므로 이미 떠 있는 8080 을 건드리지 않는다.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const WebSocket = require('ws');
const S = require('./security');

const CODE = 'TESTCODE2345';           // DD_ACCESS_CODE 로 주입 — 콘솔 파싱 없이 결정적으로 검증
const MARKER = S.PROTOCOL_MARKER;
let failures = 0;
let PORT = 0;
let child = null;

/* ===== 최소 어서션 헬퍼 ===== */

function ok(cond, label) {
  if (cond) return true;
  failures += 1;
  console.error('  FAIL:', label);
  return false;
}
const eq = (actual, expected, label) => ok(actual === expected, `${label} — expected ${expected}, got ${actual}`);
// { ok:false, reason } 형태 판정기의 거부 사유 확인
const rejects = (r, reason, label) => ok(r && r.ok === false && r.reason === reason, `${label} — got ${JSON.stringify(r)}`);
const section = (name) => console.log('-', name);

/* ===== 1. 순수 유틸 (I/O 없음) ===== */

function unitTests() {
  section('IP 판정');
  eq(S.normalizeIp('::ffff:127.0.0.1'), '127.0.0.1', 'IPv4-mapped 정규화');
  eq(S.normalizeIp('fe80::1%eth0'), 'fe80::1', '존 인덱스 제거');
  ok(S.isLoopbackIp('::1') && S.isLoopbackIp('127.0.0.5'), '루프백 인식');
  ok(!S.isLoopbackIp('192.168.0.2'), 'LAN 은 루프백이 아님');
  ok(S.isPrivateIp('10.0.0.1') && S.isPrivateIp('172.16.0.1') && S.isPrivateIp('192.168.1.9'), '사설 대역 허용');
  ok(!S.isPrivateIp('8.8.8.8') && !S.isPrivateIp('172.32.0.1'), '공인 IP 거부');

  section('접근 코드 비교');
  ok(S.safeEqual(CODE, CODE) && !S.safeEqual(CODE, CODE + 'X') && !S.safeEqual(CODE, null), '상수시간 비교 판정');
  ok(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/.test(S.generateAccessCode()), '생성 코드 알파벳·길이');

  section('정적 경로');
  const root = path.join(__dirname, '..', 'demo');
  ok(S.resolveStaticPath(root, '/index.html').ok && S.resolveStaticPath(root, '/').ok, '정상 경로·디렉터리 인덱스');
  // %2F 로 감춘 구분자는 URL 정규화를 통과하므로, 디코드 후 세그먼트 검사가 마지막 방어선이다.
  rejects(S.resolveStaticPath(root, '/a%2F..%2Fserver/security.js'), 'traversal', '인코딩 구분자 경로 이탈');
  rejects(S.resolveStaticPath(root, '/%252e%252e/x.html'), 'double_encoding', '이중 인코딩');
  rejects(S.resolveStaticPath(root, '/..%5cserver/x.html'), 'backslash', '역슬래시');
  rejects(S.resolveStaticPath(root, '/.env'), 'dotfile', '숨김 파일');
  rejects(S.resolveStaticPath(root, '/index.html%00.png'), 'control_char', '널 문자');
  rejects(S.resolveStaticPath(root, '/server.log'), 'extension_not_allowed', '허용 밖 확장자');

  section('릴레이 메시지 봉투');
  ok(S.validateRelayMessage(JSON.stringify({ t: 'a', a: { move: 1 } }), false).ok, '정상 봉투 통과');
  rejects(S.validateRelayMessage(Buffer.from([1, 2, 3]), true), 'binary_not_allowed', '바이너리');
  rejects(S.validateRelayMessage(JSON.stringify({ t: 'a', type: 'opponent_left' }), false), 'reserved_key_type', '예약 키 type');
  rejects(S.validateRelayMessage(JSON.stringify({ t: 'x', p: 'y'.repeat(20000) }), false), 'too_large', '크기 상한');
  rejects(S.validateRelayMessage('{oops', false), 'invalid_json', '깨진 JSON');
  rejects(S.validateRelayMessage('[1,2]', false), 'not_an_object', '최상위 배열');
  rejects(S.validateRelayMessage(JSON.stringify({ x: 1 }), false), 'bad_t', 't 누락');
  let deep = { t: 'a' }; let cur = deep;
  for (let i = 0; i < 12; i++) { cur.n = {}; cur = cur.n; }
  rejects(S.validateRelayMessage(JSON.stringify(deep), false), 'too_deep', '중첩 깊이');

  section('하위 프로토콜 파서·선택');
  const parsed = S.parseOfferedProtocols(`${MARKER}, ${CODE}`);
  ok(parsed.ok && parsed.protocols.length === 2, '토큰 2개 파싱');
  rejects(S.parseOfferedProtocols(''), 'absent', '헤더 부재');
  rejects(S.parseOfferedProtocols('a,b,c,d,e'), 'too_many', '토큰 과다');
  rejects(S.parseOfferedProtocols('bad token'), 'bad_token', '허용 밖 문자');
  eq(S.presentedAccessCode(`${MARKER},${CODE}`).code, CODE, '코드 추출');
  rejects(S.presentedAccessCode(`wrong,${CODE}`), 'bad_marker', '마커 불일치');
  rejects(S.presentedAccessCode(`${MARKER},${CODE},${CODE}`), 'bad_shape', '토큰 3개(대입 우회)');
  eq(S.selectProtocol([MARKER, CODE]), MARKER, '공개 마커만 선택');
  eq(S.selectProtocol(new Set([CODE])), false, '마커 없으면 아무것도 선택하지 않음');
  ok(S.selectProtocol([MARKER, CODE]) !== CODE, '비밀 코드는 절대 선택되지 않음');
}

/* ===== 2. 통합 — 실제 서버 기동 ===== */

function startServer() {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: '0', DD_LAN: '0', DD_ACCESS_CODE: CODE, DD_MAX_CONNECTIONS_PER_IP: '2' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    let log = '';
    const timer = setTimeout(() => reject(new Error('server did not start')), 15000);
    child.stdout.on('data', (c) => {
      log += c.toString();
      const m = log.match(/접속 주소: http:\/\/127\.0\.0\.1:(\d+)/);
      if (!m || !log.includes('listening')) return;
      clearTimeout(timer);
      PORT = Number(m[1]);
      ok(!/[?&]code=/.test(log), '기동 로그에 코드가 붙은 URL 이 없다');
      resolve();
    });
    child.once('error', reject);
  });
}

// HTTP 요청 하나 → { status, headers, body }
function request(method, url) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: PORT, method, path: url }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

// 업그레이드 시도 → { open:true, ws, protocol } 또는 { open:false, status }
function tryConnect(protocols, urlPath) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}${urlPath || '/'}`, protocols);
    // 첫 프레임이 핸드셰이크 응답과 같은 TCP 세그먼트로 오면 'open' 직후 nextTick 에 'message' 가
    // 터진다 — await 재개(마이크로태스크)보다 빠르다. 생성 즉시 큐를 붙여 유실을 막는다.
    ws.queue = [];
    ws.waiters = [];
    ws.on('message', (d) => {
      const msg = JSON.parse(d.toString());
      const waiter = ws.waiters.shift();
      if (waiter) waiter(msg); else ws.queue.push(msg);
    });
    // 리스너가 있으면 ws 는 error 대신 unexpected-response 로만 알린다 — 여기서 직접 매듭짓는다.
    ws.on('unexpected-response', (_req, res) => {
      res.resume();
      ws.terminate();
      resolve({ open: false, status: res.statusCode });
    });
    ws.once('open', () => resolve({ open: true, ws, protocol: ws.protocol }));
    ws.once('error', () => resolve({ open: false, status: 0 }));
  });
}

const auth = (code) => [MARKER, code === undefined ? CODE : code];
const message = (ws, label) => new Promise((resolve, reject) => {
  if (ws.queue.length) return resolve(ws.queue.shift());
  const t = setTimeout(() => reject(new Error('timeout: ' + label)), 3000);
  ws.waiters.push((msg) => { clearTimeout(t); resolve(msg); });
});
const closed = (ws) => new Promise((resolve) => ws.once('close', (c) => resolve(c)));

async function integrationTests() {
  section('HTTP 메서드·경로·보안 헤더');
  const page = await request('GET', '/');
  eq(page.status, 200, 'GET / 200');
  eq(page.headers['x-frame-options'], 'DENY', 'X-Frame-Options');
  eq(page.headers['x-content-type-options'], 'nosniff', 'X-Content-Type-Options');
  eq(page.headers['referrer-policy'], 'no-referrer', 'Referrer-Policy');
  ok((page.headers['content-security-policy'] || '').includes("frame-ancestors 'none'"), 'CSP frame-ancestors');
  ok(!page.body.includes(CODE), 'HTTP 응답 본문에 접근 코드가 없다');
  eq((await request('POST', '/')).status, 405, 'POST 405');
  eq((await request('GET', '/a%2F..%2Fserver/security.js')).status, 403, '경로 이탈 403');
  eq((await request('GET', '/nope.html')).status, 404, '없는 파일 404');

  section('WebSocket 인증 경계');
  eq((await tryConnect(undefined)).status, 401, '코드 미제시 거부');
  eq((await tryConnect(auth('WRONGCODE999'))).status, 401, '틀린 코드 거부');
  eq((await tryConnect([MARKER, CODE, 'ZZZZ9999'])).status, 401, '토큰 3개(복수 대입) 거부');
  // 폐기된 쿼리 코드 흐름 — 저장소에 그 문자열을 남기지 않으려고 조립해서 시도만 해 본다.
  const legacyQuery = '/?' + 'code=' + CODE;
  eq((await tryConnect(undefined, legacyQuery)).status, 401, '쿼리스트링 코드는 인증으로 인정하지 않음');
  eq((await tryConnect(auth(), '/socket')).status, 404, '루트 외 경로 거부');

  section('정상 접속·릴레이');
  const a = await tryConnect(auth());
  ok(a.open, '유효한 [마커, 코드] 로 접속 성립');
  eq(a.protocol, MARKER, '응답 하위 프로토콜은 공개 마커뿐');
  ok(a.protocol !== CODE && !String(a.protocol).includes(CODE), '응답에 비밀 코드가 반향되지 않는다');
  eq((await message(a.ws, 'waiting')).type, 'waiting', '대기 통지');
  const b = await tryConnect(auth());
  ok(b.open, '두 번째 접속 성립');
  const [ma, mb] = await Promise.all([message(a.ws, 'matched a'), message(b.ws, 'matched b')]);
  ok(ma.type === 'matched' && mb.type === 'matched' && ma.room === mb.room, '매칭 성사');
  const relayed = message(b.ws, 'relay');
  a.ws.send(JSON.stringify({ t: 'hello', seed: 7 }));
  const got = await relayed;
  ok(got.t === 'hello' && got.seed === 7, '정상 메시지 릴레이');

  section('연결 수 한도');
  eq((await tryConnect(auth())).status, 429, 'IP당 동시 연결 2개 초과 거부');

  section('메시지 한도 — 초과 페이로드·바이너리');
  const bigClosed = closed(a.ws);
  a.ws.send(JSON.stringify({ t: 'x', p: 'y'.repeat(S.RELAY_LIMITS.maxBytes + 100) }));
  eq(await bigClosed, 1009, '16KB 초과 페이로드 종료(1009)');
  const binClosed = closed(b.ws);
  b.ws.send(Buffer.from([0, 1, 2]), { binary: true });
  eq(await binClosed, 1003, '바이너리 프레임 종료(1003)');
}

/* ===== 실행 ===== */

(async () => {
  try {
    unitTests();
    await startServer();
    await integrationTests();
  } catch (e) {
    failures += 1;
    console.error('  FAIL: 예외 —', e && e.message);
  }
  if (child) child.kill();
  if (failures) {
    console.error(`SECURITY TESTS FAILED (${failures})`);
    process.exit(1);
  }
  console.log('ALL SECURITY TESTS PASSED');
  process.exit(0);
})();
