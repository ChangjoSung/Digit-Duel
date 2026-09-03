const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer, OPEN } = require('ws');

// 내부망 전용: 사설 대역(같은 공유기/네트워크)과 로컬호스트만 허용
function isPrivateIp(ip) {
  if (!ip) return false;
  ip = ip.replace(/^::ffff:/, ''); // IPv4-mapped IPv6 정규화
  return ip === '::1' || ip.startsWith('127.')
    || ip.startsWith('10.') || ip.startsWith('192.168.')
    || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
    || ip.startsWith('fe80');
}

const PORT = process.env.PORT || 8080;

// 클라이언트 정적 서빙 — http://localhost:8080/ 으로 게임 접속
// 위치 자동 탐색: 저장소 server/ 폴더에서 실행(../demo) 또는 독립 폴더에서 실행(client/demo)
const ROOT = [
  path.join(__dirname, '..', 'demo'),
  path.join(__dirname, 'client', 'demo'),
].find((p) => fs.existsSync(path.join(p, 'index.html'))) || path.join(__dirname, '..', 'demo');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};
const server = http.createServer((req, res) => {
  if (!isPrivateIp(req.socket.remoteAddress)) { res.writeHead(403); res.end('LAN only'); return; }
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

let waiting = null; // 매칭 대기 중인 플레이어 (1:1이라 큐 대신 슬롯 하나면 충분)
let nextRoomId = 1;

wss.on('connection', (ws, req) => {
  if (req && !isPrivateIp(req.socket.remoteAddress)) { ws.close(); return; } // 내부망 전용
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  if (waiting && waiting.readyState === OPEN) {
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

  // 상대에게 그대로 중계 (서버는 내용을 해석하지 않음)
  ws.on('message', (data, isBinary) => {
    const opp = ws.opponent;
    if (opp && opp.readyState === OPEN) {
      opp.send(data, { binary: isBinary });
    }
  });

  ws.on('close', () => {
    if (waiting === ws) waiting = null;
    const opp = ws.opponent;
    if (opp) {
      opp.opponent = null;
      if (opp.readyState === OPEN) {
        opp.send(JSON.stringify({ type: 'opponent_left' }));
      }
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

wss.on('close', () => clearInterval(heartbeat));

server.listen(PORT, () => {
  console.log(`PvP relay server listening on :${PORT} (내부망 전용)`);
  console.log(`  클라이언트: ${ROOT}`);
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list)
      if (i.family === 'IPv4' && !i.internal)
        console.log(`  접속 주소: http://${i.address}:${PORT}`);
});
