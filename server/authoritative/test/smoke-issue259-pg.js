'use strict';
// #259 실제 서버 프로세스 + 실제 Postgres 2클라이언트 스모크 — CI 밖 수동 검증용(DD_TEST_DATABASE_URL 필요, 그 DB 의 표를 지운다).
//   1. 스키마 미적용 DB 로는 기동하지 않는다(#264 게이트가 001~004 를 요구) · DD_DB_MIGRATE_ON_START=1 이면 적용 후 listen
//   2. 두 계정(서로 다른 쿠키 병) 가입 → 같은 계정 참가 거부 → 방 생성·초대 참가(players 두 닉네임) → 양쪽 배치·준비 → play
//   3. 양쪽 단절 → 다른 계정 + 훔친 좌석 토큰 거부 → 각자 자기 계정으로 재접속 room_resumed(신원 분리 유지)
//   3b. 다른 곳 로그인 → 옛 소켓 E_SESSION_ENDED(login_replaced) · 메일 미설정 재설정 요청 503
//   4. 서버 재시작 뒤에도 세션이 DB 에서 그대로 복원된다
// 실행: DD_TEST_DATABASE_URL=postgres://user:pw@127.0.0.1:5432/testdb node authoritative/test/smoke-issue259-pg.js
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');
const { makeSetup } = require('./helpers');

const URL_ = process.env.DD_TEST_DATABASE_URL;
if (!URL_) { console.log('smoke-issue259-pg: DD_TEST_DATABASE_URL 없음 — 건너뜀'); process.exit(0); }

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }
const PORT = 18000 + Math.floor(Math.random() * 1000);

function boot(extraEnv) {
  const env = Object.assign({}, process.env, { DATABASE_URL: URL_, DD_AUTH_PORT: String(PORT), DD_ECONOMY: '0' }, extraEnv || {});
  delete env.DD_TEST_DATABASE_URL;
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  const exited = new Promise((r) => p.on('exit', (code) => r(code)));
  const ready = new Promise((resolve) => {
    const t = setInterval(() => { if (/listening on/.test(out)) { clearInterval(t); resolve(true); } }, 50);
    exited.then(() => { clearInterval(t); resolve(false); });
  });
  return { p, ready, exited, log: () => out };
}

function req(method, p, body, cookie) {
  return new Promise((resolve, reject) => {
    const h = { Origin: `http://127.0.0.1:${PORT}` };
    if (cookie) h.Cookie = cookie;
    const data = body ? JSON.stringify(body) : null;
    if (data) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(data); }
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path: p, headers: h }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; });
      res.on('end', () => { let j = null; try { j = JSON.parse(b); } catch (e) { /* 평문 */ } resolve({ status: res.statusCode, json: j, text: b, cookie: res.headers['set-cookie'] ? res.headers['set-cookie'][0].split(';')[0] : null }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function ws(cred, cookie) {
  return new Promise((resolve) => {
    const s = new WebSocket(`ws://127.0.0.1:${PORT}/`, ['digit-duel.v1', cred], { headers: cookie ? { Cookie: cookie } : {} });
    const frames = [];
    s.on('message', (d) => frames.push(JSON.parse(d.toString())));
    s.on('unexpected-response', (_q, res) => resolve({ status: res.statusCode }));
    s.on('open', () => resolve({ status: 101, s, frames }));
    s.on('error', () => {});
  });
}
async function waitFor(frames, pred, ms = 5000) {
  const end = Date.now() + ms;
  for (;;) { const f = frames.find(pred); if (f) return f; if (Date.now() > end) return null; await new Promise((r) => setTimeout(r, 20)); }
}
const cmd = (c, tok, gen, obj) => c.s.send(JSON.stringify(Object.assign({ v: 1, seatToken: tok, tokenGen: gen }, obj)));

async function main() {
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: URL_ });
  await pool.query('DROP TABLE IF EXISTS password_resets, sessions, accounts, db_meta, schema_migrations');

  // 1. 게이트
  let srv = boot();
  ok(!(await srv.ready) && (await srv.exited) === 1, '스키마 미적용 DB → listen 하지 않고 exit 1');
  srv = boot({ DD_DB_MIGRATE_ON_START: '1' });
  ok(await srv.ready, 'DD_DB_MIGRATE_ON_START=1 → 001·002 적용 후 listen: ' + srv.log().slice(-300));
  ok(/002_accounts\.sql, 003_email_single_login\.sql, 004_email_not_unique\.sql/.test(srv.log()) && /재설정 메일: 미설정/.test(srv.log()), '기동 로그에 002·003·004 적용 · 메일 미설정 표시');
  const ready = await req('GET', '/readyz');
  ok(ready.status === 200 && ready.text === 'ok (db)', '/readyz ok (db)');

  // 2. 두 계정 → 방 → play
  const a = await req('POST', '/api/auth/signup', { userId: 'smoke_host', nickname: '호스트', password: 'host-pass-1', email: 'host@example.com' });
  const b = await req('POST', '/api/auth/signup', { userId: 'smoke_guest', nickname: '게스트', password: 'guest-pass-1', email: 'guest@example.com' });
  ok(a.status === 201 && b.status === 201 && a.cookie && b.cookie, '두 계정 가입');
  ok((await ws('c-anon')).status === 401, '세션 없는 방 생성 401');
  const host = await ws('c-smoke', a.cookie);
  const opened = await waitFor(host.frames, (f) => f.type === 'room_opened');
  const self = await ws('j-' + opened.inviteCode, a.cookie);
  ok(self.s && (await waitFor(self.frames, (f) => f.type === 'error')).code === 'E_SAME_ACCOUNT', '같은 계정 참가 거부');
  const guest = await ws('j-' + opened.inviteCode, b.cookie);
  const joined = await waitFor(guest.frames, (f) => f.type === 'room_joined');
  ok(opened && joined && JSON.stringify(joined.players) === '["호스트","게스트"]', '생성·초대 참가 · players 두 닉네임');
  cmd(host, opened.seatToken, opened.tokenGen, Object.assign({ requestId: 's1', t: 'setup' }, makeSetup()));
  cmd(guest, joined.seatToken, joined.tokenGen, Object.assign({ requestId: 's2', t: 'setup' }, makeSetup()));
  await waitFor(host.frames, (f) => f.requestId === 's1'); await waitFor(guest.frames, (f) => f.requestId === 's2');
  cmd(host, opened.seatToken, opened.tokenGen, { requestId: 's3', t: 'ready' });
  await waitFor(host.frames, (f) => f.requestId === 's3');
  cmd(guest, joined.seatToken, joined.tokenGen, { requestId: 's4', t: 'ready' });
  const go = await waitFor(guest.frames, (f) => f.requestId === 's4');
  ok(go && go.data && go.data.phase === 'play', '양쪽 준비 → play');

  // 3. 단절·탈취·재접속
  host.s.close(); guest.s.close();
  await new Promise((r) => setTimeout(r, 200));
  const thief = await ws(`r-${opened.epoch}.${opened.seatToken}`, b.cookie);
  ok(thief.s && (await waitFor(thief.frames, (f) => f.type === 'error')).code === 'E_SEAT_TOKEN_INVALID', '다른 계정 + 훔친 좌석 토큰 거부');
  const back = await ws(`r-${opened.epoch}.${opened.seatToken}`, a.cookie);
  const resumed = back.s && await waitFor(back.frames, (f) => f.type === 'room_resumed');
  ok(resumed && resumed.seat === 0 && resumed.data.phase === 'play', '같은 계정 60초 유예 안 재접속 → room_resumed(play 유지)');
  const gBack = await ws(`r-${joined.epoch}.${joined.seatToken}`, b.cookie);
  const gRes = gBack.s && await waitFor(gBack.frames, (f) => f.type === 'room_resumed');
  ok(gRes && gRes.seat === 1 && JSON.stringify(gRes.players) === '["호스트","게스트"]' && JSON.stringify(resumed.players) === '["호스트","게스트"]', '게스트도 자기 계정으로 재접속 · 두 신원 분리 유지');
  // 3b. 다른 곳 로그인 → 옛 소켓 종료. 메일 미설정 → 재설정 요청 503.
  const a2 = await req('POST', '/api/auth/login', { userId: 'smoke_host', password: 'host-pass-1' });
  const endF = await waitFor(back.frames, (f) => f.code === 'E_SESSION_ENDED');
  ok(a2.status === 200 && endF && endF.reason === 'login_replaced' && (await req('GET', '/api/auth/session', null, a.cookie)).status === 401, '다른 곳 로그인 → 옛 소켓·세션 종료');
  const mr = await req('POST', '/api/auth/password-reset/request', { userId: 'smoke_host' });
  ok(mr.status === 503 && mr.json.error === 'E_MAIL_UNAVAILABLE', '메일 미설정 재설정 요청 503');
  a.cookie = a2.cookie;
  [self, thief, back, gBack].forEach((c) => c.s && c.s.close());

  // 4. 재시작 뒤 세션 유지(DB 가 권위)
  srv.p.kill(); await srv.exited;
  srv = boot();
  ok(await srv.ready, '재기동(마이그레이션 이미 적용 → 게이트 통과)');
  const who = await req('GET', '/api/auth/session', null, a.cookie);
  ok(who.status === 200 && who.json.nickname === '호스트', '재시작 뒤 세션 복원: ' + who.text);
  const { rows } = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
  ok(rows.map((r) => r.version).join() === '001,002,003,004', 'schema_migrations 001,002,003,004');
  srv.p.kill(); await srv.exited;
  await pool.end();
  console.log(`smoke-issue259-pg: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
