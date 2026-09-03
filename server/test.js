// 서버를 자식 프로세스로 띄우고 매칭/릴레이/이탈 알림을 자동 검증한다.
const { spawn } = require('child_process');
const WebSocket = require('ws');

const PORT = 19123;
const server = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'inherit'],
});

function fail(msg) {
  console.error('FAIL:', msg);
  server.kill();
  process.exit(1);
}

function opened(ws) {
  return new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
}

function next(ws, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout: ${label}`)), 3000);
    ws.once('message', (data) => {
      clearTimeout(t);
      resolve(JSON.parse(data.toString()));
    });
  });
}

async function run() {
  const a = new WebSocket(`ws://localhost:${PORT}`);
  await opened(a);
  const w = await next(a, 'waiting');
  if (w.type !== 'waiting') fail('expected waiting, got ' + JSON.stringify(w));

  const b = new WebSocket(`ws://localhost:${PORT}`);
  await opened(b);
  const [ma, mb] = await Promise.all([next(a, 'matched a'), next(b, 'matched b')]);
  if (ma.type !== 'matched' || mb.type !== 'matched') fail('expected matched for both');
  if (ma.room !== mb.room) fail('room mismatch');
  if (ma.you === mb.you) fail('both got same player slot');

  // 릴레이 a -> b
  const pb = next(b, 'relay a->b');
  a.send(JSON.stringify({ type: 'move', x: 1 }));
  const got = await pb;
  if (got.type !== 'move' || got.x !== 1) fail('relay a->b broken');

  // 릴레이 b -> a
  const pa = next(a, 'relay b->a');
  b.send(JSON.stringify({ type: 'attack' }));
  if ((await pa).type !== 'attack') fail('relay b->a broken');

  // 이탈 알림
  const pLeft = next(b, 'opponent_left');
  a.close();
  if ((await pLeft).type !== 'opponent_left') fail('no opponent_left notice');

  // 대기자 이탈 후 새 매치가 정상 성사되는지 (waiting 슬롯 정리 검증)
  const c = new WebSocket(`ws://localhost:${PORT}`);
  await opened(c);
  const wc = await next(c, 'waiting c');
  if (wc.type !== 'waiting') fail('c should be waiting');
  c.close();
  const d = new WebSocket(`ws://localhost:${PORT}`);
  await opened(d);
  const wd = await next(d, 'waiting d');
  if (wd.type !== 'waiting') fail('d should be waiting (stale slot not cleared)');

  console.log('ALL TESTS PASSED');
  b.close();
  d.close();
  server.kill();
  process.exit(0);
}

server.stdout.on('data', (chunk) => {
  if (chunk.toString().includes('listening')) {
    run().catch((e) => fail(e.message));
  }
});
