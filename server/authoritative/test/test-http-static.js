'use strict';
// #217 v4 — 인증 서버의 기본 실행 통합. Saturn REVISE: "authoritative HTTP는 health 외 404, npm start는 이전 8080 relay".
// (1) 인증 서버가 게임 클라이언트(demo/index.html + assets)를 릴레이와 같은 보안 검사로 서빙한다 — 그 페이지의
//     기본 접속 주소(location.host)가 곧 이 서버다.
// (2) 같은 포트에서 WebSocket 공개 로비가 동작한다.
// (3) package.json: npm start/start:lan = 인증 서버, 기존 코드 접속 릴레이는 start:relay/start:relay:lan으로 보존.
//     기존 실행기(서버시작.bat·LAN서버시작.bat)는 릴레이 그대로, 공개 대전 실행기는 별도 파일.
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const S = require('../../security');
const { server, ROOT } = require('../server');
const H = require('./helpers');
const { ok, done } = H.makeCounter('http-static');

function request(port, opts) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port, method: opts.method || 'GET', path: opts.path || '/',
      headers: Object.assign({ Host: `127.0.0.1:${port}` }, opts.headers || {}),
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const demo = path.join(__dirname, '..', '..', '..', 'demo');
  ok(path.resolve(ROOT) === path.resolve(demo), '정적 루트는 저장소 demo/: ' + ROOT);

  // (1) 게임 페이지
  {
    const res = await request(port, { path: '/' });
    const onDisk = fs.readFileSync(path.join(demo, 'index.html'));
    ok(res.status === 200 && res.body.equals(onDisk), 'GET / → demo/index.html 원본 그대로 200');
    ok(/text\/html/.test(res.headers['content-type']) && res.headers['content-security-policy'] === S.SECURITY_HEADERS['Content-Security-Policy'], 'HTML MIME·릴레이와 같은 보안 헤더(CSP)');
    ok(/connect-src 'self' ws: wss:/.test(res.headers['content-security-policy']), 'CSP가 같은 출처 WebSocket 접속을 허용');
    const idx = await request(port, { path: '/index.html' });
    ok(idx.status === 200 && idx.body.equals(onDisk), 'GET /index.html 200');
    const js = await request(port, { path: '/js/core.js' });
    ok(js.status === 200 && /text\/javascript/.test(js.headers['content-type']) && js.body.equals(fs.readFileSync(path.join(demo, 'js', 'core.js'))), 'GET /js/core.js 200·JavaScript MIME');
    const css = await request(port, { path: '/css/game.css' });
    ok(css.status === 200 && /text\/css/.test(css.headers['content-type']) && css.body.equals(fs.readFileSync(path.join(demo, 'css', 'game.css'))), 'GET /css/game.css 200·CSS MIME');
    const head = await request(port, { path: '/', method: 'HEAD' });
    ok(head.status === 200 && head.body.length === 0 && Number(head.headers['content-length']) === onDisk.length, 'HEAD / 200·본문 없음·Content-Length');
  }
  // 하수인 자산 — 페이지가 상대경로로 로드하는 실제 파일 하나
  {
    const minionDir = path.join(demo, 'assets', 'minions');
    const sub = fs.readdirSync(minionDir).find((d) => fs.statSync(path.join(minionDir, d)).isDirectory());
    const file = fs.readdirSync(path.join(minionDir, sub)).find((f) => /\.png$/i.test(f));
    const res = await request(port, { path: `/assets/minions/${encodeURIComponent(sub)}/${encodeURIComponent(file)}` });
    ok(res.status === 200 && /image\/png/.test(res.headers['content-type']) && res.body.equals(fs.readFileSync(path.join(minionDir, sub, file))), '하수인 이미지 자산 200·image/png: ' + sub + '/' + file);
  }
  // 헬스체크 유지
  {
    const res = await request(port, { path: '/healthz' });
    ok(res.status === 200 && res.body.toString() === 'ok', '/healthz 200 ok');
  }
  // 보안 검사 — 릴레이와 같은 거부
  {
    const trav = await request(port, { path: '/../server/security.js' });
    ok(trav.status >= 400 && trav.status !== 200, '경로 이탈 거부: ' + trav.status);
    const enc = await request(port, { path: '/%2e%2e/server/package.json' });
    // WHATWG URL이 %2e%2e를 먼저 정규화해 demo/ 안의 없는 경로가 된다 — 어떤 경우든 server/package.json 내용이 나가지 않아야 한다
    ok(enc.status !== 200 && enc.body.toString().indexOf('digit-duel-server') === -1, '인코딩된 경로 이탈로 루트 밖 파일이 나가지 않음: ' + enc.status);
    const dot = await request(port, { path: '/.git/config' });
    ok(dot.status === 403, '숨김 파일 거부: ' + dot.status);
    const post = await request(port, { path: '/', method: 'POST' });
    ok(post.status === 405 && /GET, HEAD/.test(post.headers.allow || ''), 'POST 405');
    const badHost = await request(port, { path: '/', headers: { Host: 'evil.example:80' } });
    ok(badHost.status === 400, '허용 밖 Host 400(DNS 리바인딩 차단)');
    const badOrigin = await request(port, { path: '/', headers: { Origin: 'http://evil.example' } });
    ok(badOrigin.status === 403, '다른 출처 Origin 403');
    const missing = await request(port, { path: '/no-such-file.html' });
    ok(missing.status === 404, '없는 파일 404');
    const longUrl = await request(port, { path: '/' + 'a'.repeat(2100) + '.html' });
    ok(longUrl.status === 414, '과도한 URL 414');
  }

  // (2) 같은 포트의 WebSocket 공개 로비
  {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/`, ['digit-duel.v1', 'l-nonce'], { headers: { Origin: `http://127.0.0.1:${port}` } });
    const first = await new Promise((resolve, reject) => { ws.once('message', (d) => resolve(JSON.parse(d.toString()))); ws.once('error', reject); });
    ok(first.type === 'lobby_ready' && ws.protocol === 'digit-duel.v1', '페이지와 같은 출처(Origin)로 같은 포트에 로비 소켓 연결·공개 마커만 반향');
    ws.close();
  }

  // (3) 실행 진입점
  {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
    ok(pkg.scripts.start === 'node authoritative/server.js', 'npm start = 인증 서버(공개 로비 기본 경로)');
    ok(pkg.scripts['start:lan'] === 'node authoritative/server.js --lan', 'npm run start:lan = 인증 서버 LAN');
    ok(pkg.scripts['start:relay'] === 'node server.js' && pkg.scripts['start:relay:lan'] === 'node server.js --lan', '기존 코드 접속 릴레이 보존(start:relay·start:relay:lan)');
    const dir = path.join(__dirname, '..', '..');
    const relayLocal = fs.readFileSync(path.join(dir, '서버시작.bat'), 'utf8');
    const relayLan = fs.readFileSync(path.join(dir, 'LAN서버시작.bat'), 'utf8');
    ok(/^node server\.js\r?$/m.test(relayLocal) && /^node server\.js --lan\r?$/m.test(relayLan), '기존 실행기는 릴레이 그대로(LAN 코드 접속 경로 보존)');
    const pubLocal = fs.readFileSync(path.join(dir, '공개서버시작.bat'), 'utf8');
    const pubLan = fs.readFileSync(path.join(dir, '공개LAN서버시작.bat'), 'utf8');
    ok(/^node authoritative\\server\.js\r?$/m.test(pubLocal) && /^node authoritative\\server\.js --lan\r?$/m.test(pubLan), '공개 대전 실행기는 인증 서버 고정 명령');
    ok(!/%[1-9*]/.test(pubLocal) && !/%[1-9*]/.test(pubLan), '공개 대전 실행기는 호출자 인자(%1·%*)를 읽지 않음');
    // 기본 포트 — 릴레이 8080과 겹치지 않는다
    const src = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    ok(/DD_AUTH_PORT \|\| process\.env\.PORT \|\| 8081/.test(src), '인증 서버 기본 포트 8081(릴레이 8080과 분리) — 미설정이면 플랫폼 주입 PORT(Render 등) 폴백');
  }

  server.close();
  done();
}

main().catch((e) => { console.error(e); process.exitCode = 1; try { server.close(); } catch (x) { /* noop */ } });
