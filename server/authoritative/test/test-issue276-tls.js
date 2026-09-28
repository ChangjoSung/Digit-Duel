'use strict';
/* #276 네이티브 HTTPS 옵트인(DD_AUTH_TLS_CERT·DD_AUTH_TLS_KEY) 회귀.
 * 임시 폴더에 openssl 로 자체 서명 leaf(localhost·127.0.0.1)를 만들고 끝나면 지운다. 클라이언트는 그 인증서만 ca 로
 * 신뢰한다(rejectUnauthorized:false 를 쓰지 않는다). 계정은 스텁 — 실제 DB·메일·사용자 인증서를 건드리지 않는다.
 * (1) 가져오기(require)도 짝이 안 맞으면 던진다 — HTTP 서버를 만들지 않는다.
 * (2) 같은 프로세스 HTTPS: 페이지 200 · 로그인이 403 이 아니라 계정 로직에 닿고 Secure 쿠키 · 모르는 CA 거부 ·
 *     같은 포트 평문 요청은 계정 로직에 닿지 않음 · WSS 로비 업그레이드 · WSS 다른 Origin 403.
 * (3) 자식 프로세스 기동: 짝 누락·키 불일치 = exit 1(키 내용 없음) · 정상 = https 주소만 안내 · LAN+TLS = 인터페이스 URL 없이 바인딩만. */
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const path = require('path');
const WebSocket = require('ws');
const S = require('../../security');
const { ok, done } = require('./helpers').makeCounter('issue276-tls');

const SERVER_JS = path.join(__dirname, '..', 'server.js');
const MODULE_PATH = require.resolve('../server');
const ENV_KEYS = ['DATABASE_URL', 'DD_LAN', 'DD_AUTH_PUBLIC_DEPLOY', 'DD_AUTH_PUBLIC_HOST', 'DD_AUTH_PORT', 'PORT', 'DD_AUTH_BIND', 'DD_AUTH_TLS_CERT', 'DD_AUTH_TLS_KEY'];
for (const k of ENV_KEYS) delete process.env[k];

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-tls-'));
const CERT = path.join(dir, 'cert.pem');
const KEY = path.join(dir, 'key.pem');
const OTHER_KEY = path.join(dir, 'other-key.pem');

function makeFixture() {
  const r = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', KEY, '-out', CERT, '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('openssl 로 테스트 인증서를 만들지 못했다: ' + (r.error ? r.error.code : r.stderr));
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  fs.writeFileSync(OTHER_KEY, privateKey.export({ type: 'pkcs8', format: 'pem' }));
}

function send(mod, port, opts, body) {
  return new Promise((resolve) => {
    const req = mod.request(Object.assign({ host: '127.0.0.1', port, method: 'GET', path: '/' }, opts), (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', (e) => resolve({ error: e.code || e.message }));
    req.end(body);
  });
}

function wss(port, origin, ca) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`wss://127.0.0.1:${port}/`, [S.PROTOCOL_MARKER, 'l-tls276'], { ca, origin });
    ws.on('message', (d) => { resolve({ frame: JSON.parse(d) }); ws.close(); });
    ws.on('unexpected-response', (req, res) => { resolve({ status: res.statusCode }); req.destroy(); });
    ws.on('error', (e) => resolve({ error: e.code || e.message }));
  });
}

function runChild(env, waitFor) {
  return new Promise((resolve) => {
    const childEnv = Object.assign({}, process.env, env);
    const child = spawn(process.execPath, [SERVER_JS], { env: childEnv });
    let out = '', err = '';
    const finish = (code) => { clearTimeout(timer); resolve({ code, out, err }); };
    const timer = setTimeout(() => { child.kill(); }, 10000);
    child.stdout.on('data', (d) => { out += d; if (waitFor && out.includes(waitFor)) child.kill(); });
    child.stderr.on('data', (d) => { err += d; });
    child.on('exit', finish);
  });
}

async function main() {
  makeFixture();
  const ca = fs.readFileSync(CERT);

  // (1) 가져오기도 fail-closed
  process.env.DD_AUTH_TLS_CERT = CERT;
  let threw = null;
  try { require('../server'); } catch (e) { threw = e.message; }
  delete require.cache[MODULE_PATH];
  ok(threw && threw.includes('pair_incomplete'), 'require: 인증서만 있으면 던진다 — ' + threw);

  // (2) 같은 프로세스 HTTPS
  process.env.DD_AUTH_TLS_KEY = KEY;
  const { server, useAccounts, SCHEME } = require('../server');
  ok(SCHEME === 'https' && server instanceof https.Server, 'TLS 짝이 있으면 https.Server');
  let logins = 0;
  useAccounts({
    login: async () => { logins += 1; return { status: 200, body: { ok: true }, session: { token: 'a'.repeat(43), ttlMs: 60000 } }; },
    resolve: async () => null, sweep() {}, flushPending: async () => {}, resultsBlocked: () => false, pendingCount: () => 0,
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const host = `127.0.0.1:${port}`;

  const page = await send(https, port, { ca, headers: { Host: host } });
  ok(page.status === 200 && /<html/i.test(page.body), 'HTTPS 게임 페이지 200 — ' + (page.status || page.error));

  const login = await send(https, port, { ca, method: 'POST', path: '/api/auth/login',
    headers: { Host: host, Origin: `https://${host}`, 'Content-Type': 'application/json' } }, JSON.stringify({ userId: 'tester1', password: 'x' }));
  ok(login.status === 200 && logins === 1, 'HTTPS 로그인은 403 이 아니라 계정 로직에 닿는다 — ' + (login.status || login.error));
  ok(/;\s*Secure/.test(String(login.headers && login.headers['set-cookie'])), 'HTTPS 세션 쿠키에 Secure');

  const unknownCa = await send(https, port, { headers: { Host: host } });
  ok(/SELF_SIGNED|UNABLE_TO_VERIFY/.test(String(unknownCa.error)), '모르는 CA 는 클라이언트가 거부 — ' + JSON.stringify(unknownCa));

  const plain = await send(http, port, { method: 'POST', path: '/api/auth/login',
    headers: { Host: host, Origin: `http://${host}`, 'Content-Type': 'application/json' } }, JSON.stringify({ userId: 'tester1', password: 'x' }));
  ok(!(plain.status >= 200 && plain.status < 300) && logins === 1, '같은 포트 평문 로그인은 계정 로직에 닿지 않는다 — ' + JSON.stringify(plain.status || plain.error));

  const good = await wss(port, `https://${host}`, ca);
  ok(good.frame && good.frame.type === 'lobby_ready', 'WSS 로비 업그레이드 — ' + JSON.stringify(good));
  const bad = await wss(port, 'https://evil.example', ca);
  ok(bad.status === 403, 'WSS 다른 Origin 은 403 — ' + JSON.stringify(bad));
  await new Promise((r) => server.close(r));

  // (3) 자식 프로세스 기동
  const onlyCert = await runChild({ DD_AUTH_TLS_CERT: CERT, DD_AUTH_TLS_KEY: '' });
  ok(onlyCert.code === 1 && onlyCert.err.includes('pair_incomplete') && !onlyCert.out.includes('listening'), '짝 누락 → exit 1 · 리슨 없음');
  const mismatch = await runChild({ DD_AUTH_TLS_CERT: CERT, DD_AUTH_TLS_KEY: OTHER_KEY });
  ok(mismatch.code === 1 && mismatch.err.includes('DD_AUTH_TLS') && !/PRIVATE KEY|BEGIN/.test(mismatch.err + mismatch.out), '키 불일치 → exit 1 · 키 내용 없음 — ' + mismatch.err.trim());
  const up = await runChild({ DD_AUTH_TLS_CERT: CERT, DD_AUTH_TLS_KEY: KEY, DD_AUTH_PORT: '0' }, '헬스체크');
  ok(up.out.includes('접속 주소: https://127.0.0.1:') && up.out.includes('헬스체크: https://') && !/http:\/\//.test(up.out), '정상 기동은 https 주소만 안내 — ' + up.out.trim());
  // LAN+TLS: 인터페이스를 훑은 URL(인증서 SAN 밖일 수 있음)을 안내하지 않고 바인딩만 알린다. 루프백에만 묶는다.
  const lan = await runChild({ DD_AUTH_TLS_CERT: CERT, DD_AUTH_TLS_KEY: KEY, DD_AUTH_PORT: '0', DD_LAN: '1', DD_AUTH_BIND: '127.0.0.1' }, '헬스체크');
  ok(lan.out.includes('내부망: 127.0.0.1:') && lan.out.includes('TLS 바인딩') && !lan.out.includes('내부망 주소:') && !/http:\/\//.test(lan.out),
    'LAN+TLS 기동은 인터페이스 URL 대신 바인딩만 안내 — ' + lan.out.trim());
}

main()
  .catch((e) => ok(false, 'threw: ' + (e && e.stack)))
  .finally(() => { fs.rmSync(dir, { recursive: true, force: true }); done(); process.exit(process.exitCode || 0); });
