// 서버를 자식 프로세스로 띄우고 매칭/릴레이/이탈 알림을 자동 검증한다.
// #62 이후: 임의 포트(PORT=0)로 띄우고, 콘솔에 단독 출력된 런타임 접근 코드를
// WebSocket 하위 프로토콜(Sec-WebSocket-Protocol)로만 제시해 인증한다.
// URL·쿼리에는 코드를 싣지 않는다 (HTTP 페이지 자체는 인증이 없다).
// 고정 포트를 쓰지 않으므로 이미 떠 있는 운영 서버(8080)와 충돌하지 않는다.
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { PROTOCOL_MARKER } = require('./security');

const server = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: '0', DD_LAN: '0' },
  stdio: ['ignore', 'pipe', 'inherit'],
});

let PORT = 0;
let CODE = '';
let started = false;

function fail(msg) {
  console.error('FAIL:', msg);
  server.kill();
  process.exit(1);
}

function url() {
  return `ws://127.0.0.1:${PORT}/`;
}

// 접근 코드는 오직 하위 프로토콜 헤더로만 전달한다 (계약: [공개 마커, 접근 코드] 2개).
// 첫 프레임(waiting)이 핸드셰이크 응답과 같은 TCP 세그먼트로 오면 'open' 직후 nextTick 에
// 'message' 가 터지는데, 이는 await 재개(마이크로태스크)보다 빠르다. 그때 리스너를 붙이면
// 프레임을 놓쳐 간헐적으로 타임아웃한다 — 그래서 소켓 생성 즉시 수신 큐를 붙인다.
function connect() {
  const ws = new WebSocket(url(), [PROTOCOL_MARKER, CODE]);
  ws.queue = [];
  ws.waiters = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    const waiter = ws.waiters.shift();
    if (waiter) waiter(msg); else ws.queue.push(msg);
  });
  return ws;
}

function opened(ws) {
  return new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

// 큐에 이미 들어온 프레임이 있으면 즉시, 없으면 다음 프레임을 기다린다.
function next(ws, label) {
  return new Promise((resolve, reject) => {
    if (ws.queue.length) return resolve(ws.queue.shift());
    const t = setTimeout(() => reject(new Error(`timeout: ${label}`)), 3000);
    ws.waiters.push((msg) => { clearTimeout(t); resolve(msg); });
  });
}

async function run() {
  const a = connect();
  await opened(a);
  // 서버는 공개 마커만 되돌려준다 — 접근 코드가 응답에 실려 오면 유출이다
  if (a.protocol !== PROTOCOL_MARKER) fail('unexpected selected subprotocol: ' + a.protocol);
  const w = await next(a, 'waiting');
  if (w.type !== 'waiting') fail('expected waiting, got ' + JSON.stringify(w));

  const b = connect();
  await opened(b);
  const [ma, mb] = await Promise.all([next(a, 'matched a'), next(b, 'matched b')]);
  if (ma.type !== 'matched' || mb.type !== 'matched') fail('expected matched for both');
  if (ma.room !== mb.room) fail('room mismatch');
  if (ma.you === mb.you) fail('both got same player slot');

  // 릴레이 a -> b (현행 게임 프로토콜 봉투: { t, ... })
  const pb = next(b, 'relay a->b');
  a.send(JSON.stringify({ t: 'a', a: { move: 1 } }));
  const got = await pb;
  if (got.t !== 'a' || !got.a || got.a.move !== 1) fail('relay a->b broken');

  // 릴레이 b -> a — hello/hello2 등 실제 핸드셰이크 메시지도 그대로 통과해야 한다
  const pa = next(a, 'relay b->a');
  b.send(JSON.stringify({ t: 'hello', seed: 12345, setup: { roster: [1, 2, 3, 4, 5, 6] } }));
  const back = await pa;
  if (back.t !== 'hello' || back.seed !== 12345) fail('relay b->a broken');

  // 이탈 알림
  const pLeft = next(b, 'opponent_left');
  a.close();
  if ((await pLeft).type !== 'opponent_left') fail('no opponent_left notice');

  // 대기자 이탈 후 새 매치가 정상 성사되는지 (waiting 슬롯 정리 검증)
  const c = connect();
  await opened(c);
  const wc = await next(c, 'waiting c');
  if (wc.type !== 'waiting') fail('c should be waiting');
  c.close();
  const d = connect();
  await opened(d);
  const wd = await next(d, 'waiting d');
  if (wd.type !== 'waiting') fail('d should be waiting (stale slot not cleared)');

  console.log('ALL TESTS PASSED');
  b.close();
  d.close();
  server.kill();
  process.exit(0);
}

// 기동 로그를 모아 두었다가 포트·접근 코드가 모두 확인되면 시작한다 (청크 분할 대비).
let bootLog = '';
server.stdout.on('data', (chunk) => {
  bootLog += chunk.toString();
  if (started) return;
  const addr = bootLog.match(/접속 주소: http:\/\/127\.0\.0\.1:(\d+)/);
  const code = bootLog.match(/접속 코드: ([A-Z0-9]+)/);
  if (!addr || !code || !bootLog.includes('listening')) return;
  PORT = Number(addr[1]);
  CODE = code[1];
  started = true;
  run().catch((e) => fail(e.message));
});

setTimeout(() => fail('server did not start in time'), 15000).unref();
