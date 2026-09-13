// #217 실브라우저 재접속 증빙용 TCP 중계 (Mars 소유, 클라이언트 테스트 도구).
// 브라우저 ↔ 이 중계 ↔ 공개 방 서버. drop(ms) 는 지금 열린 모든 TCP 연결을 끊고 ms 동안 새 연결을 받지 않는다 —
// 케이블이 빠졌다 돌아오는 것과 같은 실제 네트워크 단절이다. 페이지 스크립트·게임 상태는 전혀 건드리지 않는다.
// (CDP Network.emulateNetworkConditions(offline)는 이미 열린 WebSocket 을 끊지 못해 이전 run2/run3 에서 재현이 흔들렸다.)
'use strict';
const net = require('net');

function startDropProxy(listenPort, targetPort, host) {
  host = host || '127.0.0.1';
  const live = new Set();
  let blockedUntil = 0;
  const stats = { accepted: 0, refused: 0, dropped: 0 };
  const server = net.createServer((client) => {
    if (Date.now() < blockedUntil) { stats.refused++; client.destroy(); return; }
    stats.accepted++;
    const upstream = net.connect(targetPort, host);
    const pair = { client, upstream };
    live.add(pair);
    const end = () => { live.delete(pair); client.destroy(); upstream.destroy(); };
    client.on('error', end); upstream.on('error', end);
    client.on('close', end); upstream.on('close', end);
    client.pipe(upstream); upstream.pipe(client);
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(listenPort, host, () => resolve({
      port: server.address().port,
      stats,
      liveCount: () => live.size,
      drop(ms) { blockedUntil = Date.now() + (ms || 0); for (const p of [...live]) { stats.dropped++; p.client.destroy(); p.upstream.destroy(); } live.clear(); },
      close() { for (const p of live) { p.client.destroy(); p.upstream.destroy(); } return new Promise((r) => server.close(r)); },
    }));
  });
}

module.exports = { startDropProxy };
