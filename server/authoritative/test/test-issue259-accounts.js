'use strict';
// #259 계정 — 가입(이메일 필수)·단일 로그인·로그아웃·세션 복원·이메일 코드 재설정·기존 계정 이메일 등록·WS 좌석 계정 바인딩.
// 실제 HTTP·WebSocket 으로 서버를 통해 검증한다. 저장소는 기본이 메모리 대역(test double)이고,
// DD_TEST_DATABASE_URL 이 있으면 **같은 시나리오를 실제 Postgres(pgStore + 마이그레이션)** 로 돌린다
// (그 DB 의 계정 표를 지우고 다시 만든다 — 전용 테스트 DB 에만 쓸 것). CI 에는 Postgres 가 없어 메모리 대역만 돈다.
// 메일은 주입한 테스트 전송으로만 받는다 — 실제 받은편지함 발송은 이 테스트가 증명하지 않는다.
const http = require('http');
const WebSocket = require('ws');
const { server, useAccounts } = require('../server');
const A = require('../accounts');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

/* ===== 저장소 대역 — pgStore 와 같은 계약(한 메서드 = 한 원자 단위) ===== */
function memStore() {
  const accts = new Map();
  const sessions = new Map();
  const resets = new Map();
  let seq = 0;
  let down = false;
  const guard = () => { if (down) { const e = new Error('connect ECONNREFUSED 10.0.0.5:5432'); e.code = 'ECONNREFUSED'; throw e; } };
  const byUser = (u) => [...accts.values()].find((a) => a.user_id === u) || null;
  const addSess = (a, sess) => sessions.set(sess.hash, { account_id: a.id, expires: Date.now() + sess.ttlMs, cgen: a.credential_gen, lgen: a.login_gen });
  const wipe = (id) => { for (const [h, s] of sessions) if (s.account_id === id) sessions.delete(h); };
  return {
    accts, sessions, resets, setDown(v) { down = v; },
    // 003 이전(이메일 없는) 계정을 흉내 낸다.
    legacy(userId, nickname, passwordHash) {
      const id = String(++seq);
      accts.set(id, { id, user_id: userId, nickname, password_hash: passwordHash, credential_gen: 0, login_gen: 0, email: null, email_norm: null });
    },
    async createAccount({ userId, nickname, email, passwordHash }, sess) {
      guard();
      if (byUser(userId)) return { taken: 'userId' };
      if ([...accts.values()].some((a) => a.nickname.toLowerCase() === nickname.toLowerCase())) return { taken: 'nickname' };
      const id = String(++seq);
      const a = { id, user_id: userId, nickname, password_hash: passwordHash, credential_gen: 0, login_gen: 0, email, email_norm: email.toLowerCase() };
      accts.set(id, a);
      addSess(a, sess);
      return { id, login_gen: 0 };
    },
    async findAccount(u) { guard(); const a = byUser(u); return a && Object.assign({}, a, { has_email: !!a.email }); },
    async loginSession(id, gen, sess) {
      guard();
      const a = accts.get(id);
      if (a.credential_gen !== gen) return null;
      a.login_gen += 1;
      wipe(id);
      addSess(a, sess);
      return a.login_gen;
    },
    async findSession(h) {
      guard();
      const s = sessions.get(h);
      if (!s || s.expires <= Date.now()) return null;
      const a = accts.get(s.account_id);
      if (a.credential_gen !== s.cgen || a.login_gen !== s.lgen) return null;
      return { id: a.id, user_id: a.user_id, nickname: a.nickname, has_email: !!a.email, expires_at: s.expires, login_gen: s.lgen };
    },
    async deleteSession(h) { guard(); sessions.delete(h); },
    async setEmail(id, gen, email) {
      guard();
      const a = accts.get(id);
      if (a.email || a.credential_gen !== gen) return false;
      Object.assign(a, { email, email_norm: email.toLowerCase() });
      return true;
    },
    async startReset(id, codeHash, P) {
      guard();
      const a = accts.get(id);
      if (!a || !a.email) return null;
      const t = Date.now();
      const p = resets.get(a.id);
      if (p) {
        const fresh = p.window_start <= t - P.resetSendWindowMs;
        if (p.sent_at > t - P.resetResendMs || (!fresh && p.send_count >= P.resetMaxSends)) return null;
        Object.assign(p, { code_hash: codeHash, code_expires_at: t + P.resetCodeTtlMs, attempts: 0, sent_at: t,
          send_count: fresh ? 1 : p.send_count + 1, window_start: fresh ? t : p.window_start });
      } else {
        resets.set(a.id, { code_hash: codeHash, code_expires_at: t + P.resetCodeTtlMs, attempts: 0, sent_at: t, send_count: 1, window_start: t, grant_hash: null });
      }
      return { id: a.id, email: a.email };
    },
    async dropResetCode(id, codeHash) { guard(); const p = resets.get(id); if (p && p.code_hash === codeHash) p.code_hash = null; },
    async verifyReset(userId, codeHash, grantHash, P) {
      guard();
      const a = byUser(userId);
      const p = a && resets.get(a.id);
      if (!p || !p.code_hash || p.code_expires_at <= Date.now() || p.attempts >= P.resetMaxAttempts) return false;
      if (p.code_hash !== codeHash) { p.attempts += 1; return false; }
      Object.assign(p, { code_hash: null, grant_hash: grantHash, grant_expires_at: Date.now() + P.resetGrantTtlMs, grant_gen: a.credential_gen });
      return true;
    },
    async findGrant(gh) {
      guard();
      for (const [id, p] of resets) {
        const a = accts.get(id);
        if (p.grant_hash === gh && p.grant_expires_at > Date.now() && p.grant_gen === a.credential_gen) return Object.assign({}, a);
      }
      return null;
    },
    async completeReset(id, gh, gen, passwordHash) {
      guard();
      const p = resets.get(id), a = accts.get(id);
      if (!p || p.grant_hash !== gh || p.grant_expires_at <= Date.now()) return null;
      Object.assign(p, { grant_hash: null, code_hash: null });
      if (a.credential_gen !== gen) return null;
      Object.assign(a, { password_hash: passwordHash, credential_gen: a.credential_gen + 1, login_gen: a.login_gen + 1 });
      wipe(id);
      return a.login_gen;
    },
  };
}

// 실제 Postgres: 001·002 까지만 적용해 **003 이전 계정·세션**을 만든 뒤 003·004 를 적용한다(적용된 DB 위의 추가 마이그레이션 증명).
async function pgFixture(url) {
  const { Pool } = require('pg');
  const mig = require('../../db-migrate');
  const pool = new Pool({ connectionString: url, max: 4 });
  await pool.query('DROP TABLE IF EXISTS match_results, password_resets, sessions, accounts, db_meta, schema_migrations'); // #260 match_results 는 accounts 를 참조한다
  const all = mig.loadMigrations();
  await mig.up(pool, all.filter((m) => m.version <= '002'));
  // 002 는 계정당 세션 개수를 막지 않았다 — 기기별 중복 세션을 그대로 만든다. 003 은 계정마다 **만료 안 됐고 자격 세대가 현재인**
  // 세션 중 created_at(로그인 시각) 최신 1개만 남겨야 한다(동률은 expires_at → token_hash 내림차순). 행·계정·비밀번호는 보존.
  const pw = await A.hashSecret('legacy-pass-1');
  const acct = async (user, nick, cgen) => (await pool.query(`INSERT INTO accounts (user_id, nickname, password_hash, recovery_hash, recovery_expires_at, credential_gen)
    VALUES ($1, $2, $3, 'scrypt$x', now() + interval '365 days', $4) RETURNING id`, [user, nick, pw, cgen])).rows[0].id;
  const sess = (t, id, created, expires, cgen) => pool.query(`INSERT INTO sessions (token_hash, account_id, created_at, expires_at, credential_gen)
    VALUES ($1, $2, now() + $3::interval, now() + $4::interval, $5)`, [A.tokenHash(t), id, created, expires, cgen]);
  const tok = (ch) => ch.repeat(43);
  const id1 = await acct('legacy_01', '옛계정', 1); // 재설정을 한 번 거친 계정(credential_gen 1)
  await sess(tok('A'), id1, '-2 hours', '1 day', 1);        // 유효하지만 더 오래됨 → 무효가 돼야 한다
  await sess(tok('L'), id1, '-1 hours', '1 day', 1);        // 유효 중 최신 → 유일하게 남아야 한다
  await sess(tok('E'), id1, '-1 minutes', '-1 seconds', 1); // 더 최신이지만 만료 → 이길 수 없다
  await sess(tok('C'), id1, '0 seconds', '1 day', 0);       // 가장 최신이지만 옛 자격 세대 → 이길 수 없다
  const id2 = await acct('legacy_02', '옛계정둘', 0);
  const tie = new Date(Date.now() - 3600 * 1000).toISOString(); // 두 행이 같은 created_at·expires_at
  for (const ch of ['T', 'U']) {
    await pool.query("INSERT INTO sessions (token_hash, account_id, created_at, expires_at, credential_gen) VALUES ($1, $2, $3::timestamptz, $3::timestamptz + interval '30 days', 0)", [A.tokenHash(tok(ch)), id2, tie]);
  }
  const before = (await pool.query('SELECT token_hash, account_id, created_at, expires_at, credential_gen FROM sessions ORDER BY token_hash')).rows;
  await mig.up(pool, all);
  let down = false;
  const query = (t, p) => (down ? Promise.reject(Object.assign(new Error('down'), { code: 'ECONNREFUSED' })) : pool.query(t, p));
  const tieWin = [tok('T'), tok('U')].sort((x, y) => (A.tokenHash(x) < A.tokenHash(y) ? 1 : -1))[0]; // token_hash 내림차순 첫 행
  return { store: Object.assign(A.pgStore(query), { setDown(v) { down = v; } }), pool, legacyCookie: 'dd_sid=' + tok('L'), legacy: { tok, tieWin, before, pw } };
}

/* ===== HTTP·WS 도우미 ===== */
let PORT;
function req(method, path, { body, cookie, origin = true, type = 'application/json', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const h = Object.assign({}, headers);
    if (origin) h.Origin = origin === true ? `http://127.0.0.1:${PORT}` : origin;
    if (cookie) h.Cookie = cookie;
    const data = body === undefined ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    if (data !== null) { h['Content-Type'] = type; h['Content-Length'] = Buffer.byteLength(data); }
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path, headers: h }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        let json = null; try { json = JSON.parse(buf); } catch (e) { /* 본문이 JSON 이 아님 */ }
        const set = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : null;
        resolve({ status: res.statusCode, json, text: buf, setCookie: set, cookie: set && !set.split(';')[0].endsWith('=') ? set.split(';')[0] : null });
      });
    });
    r.on('error', reject);
    if (data !== null) r.write(data);
    r.end();
  });
}
const post = (path, body, opts) => req('POST', path, Object.assign({ body }, opts || {}));
const valid = async (cookie) => !!cookie && (await req('GET', '/api/auth/session', { cookie })).status === 200;

function wsOpen(cred, cookie) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/`, ['digit-duel.v1', cred], { headers: cookie ? { Cookie: cookie } : {} });
    const frames = [];
    const conn = { status: 101, ws, frames, closeCode: null, first: () => waitFor(frames, () => true) };
    ws.on('message', (d) => frames.push(JSON.parse(d.toString())));
    ws.on('close', (code) => { conn.closeCode = code; });
    ws.on('unexpected-response', (_q, res) => resolve({ status: res.statusCode, ws: null }));
    ws.on('open', () => resolve(conn));
    ws.on('error', () => {});
  });
}
async function waitFor(frames, pred, ms = 3000) {
  const end = Date.now() + ms;
  for (;;) {
    const f = frames.find(pred);
    if (f) return f;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, 10));
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 저장소 호출 한 번을 붙잡아 경합 순서를 결정적으로 재현한다. readFirst=true 면 원래 호출을 먼저 끝내고(= DB 가 그 시점 상태를
// 읽었다/썼다) 결과 반환만 늦춘다. false 면 호출 자체를 늦춘다(= 비밀번호 검증은 끝났고 쓰기 SQL 이 아직 안 나갔다).
function holdOnce(store, method, readFirst) {
  const orig = store[method];
  let release; const gate = new Promise((r) => { release = r; });
  let reached; const hit = new Promise((r) => { reached = r; });
  store[method] = async (...args) => {
    store[method] = orig;
    reached();
    if (readFirst) { const v = await orig(...args); await gate; return v; }
    await gate;
    return orig(...args);
  };
  return { hit, release };
}
// 좌석 토큰이 필요한 읽기 명령 하나 — 응답(requestId 일치)이 오면 그 소켓이 아직 행동할 수 있다는 뜻이다.
let rid = 0;
async function resync(c, seat) {
  const id = 'rs' + (++rid);
  try { c.ws.send(JSON.stringify({ v: 1, t: 'resync', requestId: id, seatToken: seat.seatToken, tokenGen: seat.tokenGen })); } catch (e) { return null; }
  return waitFor(c.frames, (f) => f.requestId === id, 600);
}
async function ended(c, reason) {
  const frame = await waitFor(c.frames, (f) => f.code === 'E_SESSION_ENDED', 1500);
  const end = Date.now() + 1500;
  while (c.closeCode !== 4003 && Date.now() < end) await sleep(10);
  return !!frame && c.closeCode === 4003 && frame.reason === reason;
}
const closeAll = (...cs) => cs.forEach((c) => { try { c && c.ws && c.ws.close(); } catch (e) { /* noop */ } });

async function main() {
  const pgUrl = process.env.DD_TEST_DATABASE_URL;
  const fx = pgUrl ? await pgFixture(pgUrl) : { store: memStore(), pool: null };
  const store = fx.store;
  console.log(`#259 accounts — 저장소: ${pgUrl ? '실제 Postgres(pgStore · 001/002 적용 DB 에 003·004 추가 적용)' : '메모리 대역'}`);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;
  const mails = [];
  const mailer = { send: async (to, code) => { mails.push({ to, code }); } };
  const svc = (policy, m) => A.createAccounts(store, policy, m === undefined ? mailer : m);

  /* ===== 0. 순수 함수 ===== */
  const h = await A.hashSecret('correct horse');
  ok(/^scrypt\$16384\$8\$1\$/.test(h) && !h.includes('correct horse'), 'scrypt 해시 형식·원문 미포함');
  ok(await A.verifySecret('correct horse', h) && !(await A.verifySecret('correct hors', h)), 'verifySecret 일치·불일치');
  ok(A.normalizeUserId(' Alice_01 ') === 'alice_01' && A.normalizeUserId('abc') === null && A.normalizeUserId('ab-cd') === null, '아이디 정규화·형식');
  ok(A.normalizeNickname('가나'.normalize('NFD')) === '가나' && ['x', 'ㄱㄴ', '日本', 'a b', 'ab​'].every((n) => A.normalizeNickname(n) === null), '닉네임 NFC·거부 규칙(기존)');
  ok(A.normalizeEmail(' Kim.Lee+dd@Example.co.kr ') === 'Kim.Lee+dd@Example.co.kr', '이메일: 앞뒤 공백만 제거(점·+ 보존)');
  ok(['a@b', 'a b@c.com', 'a@b..com', '@b.com', 'a@-b.com', 'kim@例え.jp', 'a@b.com\r\nBcc: x@y.com', 'x'.repeat(250) + '@b.com', ['a@b.com']].every((e) => A.normalizeEmail(e) === null),
    '이메일 거부: TLD 없음·공백·빈 부분·하이픈 시작·비ASCII·헤더 주입·254자 초과·배열');
  const codes = new Set(Array.from({ length: 200 }, () => A.newResetCode()));
  ok([...codes].every((c) => /^\d{6}$/.test(c)) && codes.size > 190, '재설정 코드: 6자리 숫자(선행 0 포함)·중복 드묾');
  ok(A.smtpMailer({}) === null && A.smtpMailer({ DD_SMTP_URL: 'smtp://h:587' }) === null && A.smtpMailer({ DD_SMTP_URL: 'http://h', DD_MAIL_FROM: 'a@b.co' }) === null,
    'SMTP 설정 없음·반쪽·다른 스킴 → 메일 꺼짐');
  const unreachable = A.smtpMailer({ DD_SMTP_URL: 'smtp://127.0.0.1:1', DD_MAIL_FROM: 'dd@example.com' });
  ok(!!unreachable && await unreachable.send('x@example.com', '123456').then(() => false, () => true), '실제 nodemailer 전송: 닿지 않는 SMTP 는 reject(동기 throw 없음)');
  // 실제 nodemailer 가 만든 전송의 **최종** 옵션을 본다(네트워크·비밀 없음, example.test). nodemailer 는 URL 질의로 우리 옵션을 덮을 수
  // 있으므로(secure·requireTLS·ignoreTLS·tls.*·debug·service …) 위험한 URL 은 거부(null)되거나 최종 옵션이 안전해야 한다.
  const nm = require('nodemailer');
  const origCreate = nm.createTransport;
  let made = null;
  nm.createTransport = (...args) => (made = origCreate.apply(nm, args));
  const finalOpts = (url) => { made = null; const m = A.smtpMailer({ DD_SMTP_URL: url, DD_MAIL_FROM: 'dd@example.test' }); return m && made ? made.transporter.options : null; };
  const safe = (o) => !!o && o.host === 'example.test' && !o.ignoreTLS && !o.debug && !o.logger && !o.service && !(o.tls && o.tls.rejectUnauthorized === false)
    && (o.secure === true || o.requireTLS === true);
  const unsafeUrls = [
    'smtp://u:p@example.test:587?requireTLS=false&ignoreTLS=true', 'smtp://example.test:587?secure=false&requireTLS=false',
    'smtps://example.test:465?secure=false', 'smtp://example.test:587?tls.rejectUnauthorized=false', 'smtp://example.test:587?debug=true&logger=true',
    'smtp://example.test:587?opportunisticTLS=true&requireTLS=false', 'smtp://example.test:587?service=gmail', 'smtp://example.test:587#x', 'smtp://example.test:587/x'];
  const bad = unsafeUrls.filter((u) => { const o = finalOpts(u); return o !== null && !safe(o); });
  ok(bad.length === 0, 'SMTP: 질의·프래그먼트·경로로 TLS 강제·검증·로깅을 바꾸는 URL 은 거부되거나 최종 옵션이 안전: ' + bad.join(' | '));
  const plain = finalOpts('smtp://us%40er:p%3Ass@example.test:587'), tlsO = finalOpts('smtps://example.test:465/');
  ok(safe(plain) && plain.requireTLS === true && plain.secure === false && plain.port === 587 && plain.auth.user === 'us@er' && plain.auth.pass === 'p:ss',
    'SMTP smtp:// → 최종 requireTLS(STARTTLS 필수)·ignoreTLS 없음·인증 디코드');
  ok(safe(tlsO) && tlsO.secure === true && tlsO.port === 465, 'SMTP smtps:// → 최종 secure(처음부터 TLS) · 루트 경로 / 허용');
  nm.createTransport = origCreate;

  /* ===== 1. DB 없는 서버 — 기존 무계정 경로 그대로 ===== */
  useAccounts(null);
  let r = await req('GET', '/api/auth/session');
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_DISABLED', 'DB 없음: 계정 API 503 E_ACCOUNTS_DISABLED');
  let c = await wsOpen('c-legacy1');
  const c1 = c.status === 101 ? await c.first() : null;
  ok(c1 && c1.type === 'room_opened' && JSON.stringify(c1.players) === '[null,null]', 'DB 없음: 쿠키 없이 방 생성(기존 경로) · players 는 null');
  c.ws && c.ws.close();

  /* ===== 2. 가입(이메일 필수)·세션 복원 ===== */
  let accounts = svc();
  useAccounts(accounts);
  r = await post('/api/auth/signup', { userId: 'Alice_01', nickname: '앨리스', password: 'alice-pass-1', email: 'Alice@Example.com' });
  ok(r.status === 201 && r.json.userId === 'alice_01' && r.json.nickname === '앨리스' && r.json.hasEmail === true && !('recoveryCode' in r.json),
    '가입 201 · hasEmail · 복구 코드 없음 ' + JSON.stringify(r.json));
  ok(/HttpOnly/.test(r.setCookie) && /SameSite=Strict/.test(r.setCookie) && /Max-Age=2592000/.test(r.setCookie) && !/Secure/.test(r.setCookie), '세션 쿠키 HttpOnly·Strict·30일');
  const alice1 = r.cookie;
  ok(!JSON.stringify(r.json).includes(alice1.split('=')[1]), '세션 토큰은 응답 본문에 없다');
  r = await req('GET', '/api/auth/session', { cookie: alice1 });
  ok(r.status === 200 && r.json.userId === 'alice_01' && r.json.hasEmail === true && !('email' in r.json), '세션 복원 · hasEmail(주소는 싣지 않음)');
  r = await post('/api/auth/signup', { userId: 'bob_0001', nickname: '밥돌이', password: 'bob-pass-01' });
  ok(r.status === 400 && r.json.error === 'E_BAD_INPUT', '이메일 없는 가입 400');
  r = await post('/api/auth/signup', { userId: 'eve_0001', nickname: '이브', password: 'eve-pass-01', email: 'ALICE@example.COM' });
  ok(r.status === 201 && r.json.userId === 'eve_0001', '다른 계정과 같은 이메일(대소문자만 다름)로 가입 허용 201(CJ 2026-09-27 · 004)');
  r = await post('/api/auth/signup', { userId: 'bob_0001', nickname: '밥돌이', password: 'bob-pass-01', email: 'a.lice+x@example.com' });
  ok(r.status === 201, '점·+ 가 다른 주소는 다른 이메일(제공자별 접기 없음)');
  const bob1 = r.cookie;
  r = await post('/api/auth/signup', { userId: 'alice_01', nickname: '다른이름', password: 'password1', email: 'n1@example.com' });
  ok(r.status === 409 && r.json.error === 'E_ID_TAKEN', '중복 아이디 409');
  r = await post('/api/auth/signup', { userId: 'carol01', nickname: 'ALICE앨리스', password: 'password1', email: 'n2@example.com' });
  r = await post('/api/auth/signup', { userId: 'carol02', nickname: '앨리스', password: 'password1', email: 'n3@example.com' });
  ok(r.status === 409 && r.json.error === 'E_NICKNAME_TAKEN', '중복 닉네임 409');
  if (!pgUrl) {
    ok(!JSON.stringify([...store.accts.values(), ...store.sessions.keys()]).includes('alice-pass-1'), '저장소에 비밀번호 원문 없음');
  } else {
    const { rows } = await fx.pool.query("SELECT email, email_norm, recovery_hash FROM accounts WHERE user_id = 'alice_01'");
    ok(rows[0].email === 'Alice@Example.com' && rows[0].email_norm === 'alice@example.com' && rows[0].recovery_hash === null, '[pg] 이메일 원형·소문자 키 저장, 새 계정 복구 해시 NULL');
    let chk = null;
    try { await fx.pool.query("UPDATE accounts SET email_norm = 'x@y.z' WHERE user_id = 'alice_01'"); } catch (e) { chk = e.code; }
    ok(chk === '23514', '[pg] 003 CHECK: email_norm 은 lower(email) 이어야 한다');
  }

  /* ===== 3. CSRF·전송 경계 ===== */
  r = await post('/api/auth/login', { userId: 'alice_01', password: 'alice-pass-1' }, { origin: false });
  ok(r.status === 403 && r.json.error === 'E_BAD_ORIGIN', 'Origin 없는 POST 거부');
  r = await post('/api/auth/password-reset/request', 'email=a', { type: 'application/x-www-form-urlencoded' });
  ok(r.status === 415, 'JSON 아닌 본문 415');
  ok((await req('GET', '/api/auth/recover')).status === 404 && (await post('/api/auth/recovery-code', {})).status === 404, '폐기된 복구 코드 경로 404');
  const fake = (method, body) => {
    const q = new (require('events'))();
    Object.assign(q, { method, headers: { 'content-type': 'application/json' } });
    setImmediate(() => { if (body) q.emit('data', Buffer.from(JSON.stringify(body))); q.emit('end'); });
    return q;
  };
  const cap = {};
  for (const p of ['/api/auth/login', '/api/auth/password-reset/request', '/api/auth/password-reset/verify', '/api/auth/password-reset/complete', '/api/auth/email']) {
    await A.handleAuth(fake('POST', {}), null, p, { accounts, send: (_r, status, _h, b) => Object.assign(cap, { status, body: JSON.parse(b) }), secure: false, secretOk: false, sameOrigin: true, takeBucket: () => true });
    ok(cap.status === 403 && cap.body.error === 'E_INSECURE_TRANSPORT', '원격 평문 HTTP 거부: ' + p);
  }

  /* ===== 4. 단일 로그인 — 마지막 로그인만 산다, 실패는 아무도 끊지 않는다 ===== */
  useAccounts(accounts);
  r = await post('/api/auth/login', { userId: 'ALICE_01', password: 'alice-pass-1' });
  ok(r.status === 200 && r.json.hasEmail === true && r.cookie, '로그인(대소문자 무시 아이디) · hasEmail');
  const alice2 = r.cookie;
  ok(!(await valid(alice1)) && await valid(alice2), '다른 곳 로그인 성공 → 옛 세션 무효, 새 세션만 유효');
  const wrongPw = await post('/api/auth/login', { userId: 'alice_01', password: 'wrong-pass-1' });
  const noUser = await post('/api/auth/login', { userId: 'nobody_x', password: 'wrong-pass-1' });
  ok(wrongPw.status === 401 && noUser.status === 401 && wrongPw.text === noUser.text && await valid(alice2), '틀린 비밀번호·없는 아이디 같은 응답 · 실패는 현재 세션을 건드리지 않는다');
  for (let i = 0; i < 10; i++) await post('/api/auth/login', { userId: 'carol01', password: 'wrong-pass-' + i });
  ok((await post('/api/auth/login', { userId: 'carol01', password: 'password1' })).status === 429, '아이디별 로그인 실패 상한(기존)');
  accounts = svc(); // 메모리 로그인 제한기를 비운다(새 서비스 인스턴스)
  useAccounts(accounts);
  // 동시 로그인 두 번 — 둘 다 비밀번호는 맞다. 세대가 행 잠금으로 직렬화돼 정확히 하나만 유효하다.
  const duo = await Promise.all([0, 1].map(() => post('/api/auth/login', { userId: 'alice_01', password: 'alice-pass-1' })));
  const duoValid = await Promise.all(duo.map((x) => valid(x.cookie)));
  ok(duo.every((x) => x.status === 200) && duoValid.filter(Boolean).length === 1 && !(await valid(alice2)), '동시 로그인 2회 → 유효 세션은 정확히 1개: ' + duoValid);
  const alice3 = duo[duoValid.indexOf(true)].cookie;
  r = await post('/api/auth/logout', {}, { cookie: alice3 });
  ok(r.status === 200 && /Max-Age=0/.test(r.setCookie) && !(await valid(alice3)), '로그아웃 200 + 쿠키 삭제 + 세션 무효');

  /* ===== 5. WS 좌석 계정 바인딩 — 분리된 두 쿠키 병(A·B), 같은 계정 대전 금지 ===== */
  useAccounts(accounts);
  const A1 = (await post('/api/auth/login', { userId: 'alice_01', password: 'alice-pass-1' })).cookie; // 쿠키 병 A
  const B1 = (await post('/api/auth/login', { userId: 'bob_0001', password: 'bob-pass-01' })).cookie;   // 쿠키 병 B
  ok(A1 && B1 && A1 !== B1 && !(await valid(bob1)), '두 계정 각자 로그인(B 의 가입 세션은 B 로그인으로 교체)');
  ok((await wsOpen('c-nocookie')).status === 401 && (await wsOpen('j-ABCDEF', 'dd_sid=' + 'B'.repeat(43))).status === 401, '세션 없음·위조 세션 업그레이드 401');
  const lob = await wsOpen('l-look');
  ok(lob.status === 101 && (await lob.first()).type === 'lobby_ready', '로비 목록은 로그인 불필요');
  lob.ws.close();
  const host = await wsOpen('c-alice', A1);
  const opened = await host.first();
  ok(opened.type === 'room_opened' && JSON.stringify(opened.players) === '["앨리스",null]', '방 생성 · players=[호스트 닉네임, null]: ' + JSON.stringify(opened.players));
  // 같은 계정(같은 세션)으로 자기 방 참가 → 거부, 방·초대 코드는 그대로.
  const self = await wsOpen('j-' + opened.inviteCode, A1);
  const selfF = self.ws ? await self.first() : null;
  ok(selfF && selfF.code === 'E_SAME_ACCOUNT', '같은 계정 참가 거부 E_SAME_ACCOUNT: ' + JSON.stringify(selfF));
  const guest = await wsOpen('j-' + opened.inviteCode, B1);
  const joined = await guest.first();
  ok(joined.type === 'room_joined' && JSON.stringify(joined.players) === '["앨리스","밥돌이"]', '거부 뒤 초대 코드 유효 · 다른 계정 참가 · players 두 닉네임: ' + JSON.stringify(joined.players));
  const hostSees = await waitFor(host.frames, (f) => f.type === 'room_state' && f.players && f.players[1] === '밥돌이');
  ok(!!hostSees, '호스트도 상대 닉네임을 서버 권위 푸시로 받는다');
  ok(!JSON.stringify([opened, joined, hostSees]).match(/alice_01|bob_0001|example\.com|accountId/), '게임 프레임에 로그인 아이디·이메일·계정 id 없음');
  // 탈취: B 가 A 의 좌석 토큰으로 재접속 → 거부, A 는 그대로.
  const thief = await wsOpen(`r-${opened.epoch}.${opened.seatToken}`, B1);
  ok(thief.ws && (await thief.first()).code === 'E_SEAT_TOKEN_INVALID', '다른 계정 + 훔친 좌석 토큰 거부');
  await sleep(50);
  ok(host.ws.readyState === WebSocket.OPEN, '탈취 시도는 원래 좌석을 밀어내지 않는다');
  // 양쪽 단절 → 60초 유예 안에 각자 자기 쿠키 병으로 재접속, 신원은 서로 섞이지 않는다.
  host.ws.close(); guest.ws.close();
  await sleep(100);
  const hostBack = await wsOpen(`r-${opened.epoch}.${opened.seatToken}`, A1);
  const guestBack = await wsOpen(`r-${joined.epoch}.${joined.seatToken}`, B1);
  const hb = hostBack.ws ? await hostBack.first() : null, gb = guestBack.ws ? await guestBack.first() : null;
  ok(hb && hb.type === 'room_resumed' && hb.seat === 0 && gb && gb.type === 'room_resumed' && gb.seat === 1, 'A·B 각자 재접속 room_resumed(좌석 0·1)');
  ok(JSON.stringify(hb.players) === '["앨리스","밥돌이"]' && JSON.stringify(gb.players) === '["앨리스","밥돌이"]', '재접속 뒤에도 두 신원 분리 유지');
  const crossed = await wsOpen(`r-${gb.epoch}.${gb.seatToken}`, A1);
  ok(crossed.ws && (await crossed.first()).code === 'E_SEAT_TOKEN_INVALID', 'A 세션으로 B 좌석(회전된 토큰) 재접속 거부');
  closeAll(self, thief, crossed);

  /* ===== 5b. 이미 열린 WS — 다른 곳 로그인·로그아웃·재설정·만료 ===== */
  useAccounts(accounts);
  ok(!!(await resync(hostBack, hb)), '로그인 전: A 소켓 명령 가능');
  r = await post('/api/auth/login', { userId: 'alice_01', password: 'wrong-pass-9' });
  ok(r.status === 401 && !!(await resync(hostBack, hb)) && await valid(A1), '틀린 로그인은 열린 소켓·세션을 끊지 않는다');
  r = await post('/api/auth/login', { userId: 'alice_01', password: 'alice-pass-1' });
  const A2 = r.cookie;
  ok(r.status === 200 && await ended(hostBack, 'login_replaced'), '다른 곳 로그인 성공 → 옛 소켓 E_SESSION_ENDED(reason login_replaced) + 4003');
  ok(!(await resync(hostBack, hb)) && !!(await resync(guestBack, gb)), '끊긴 소켓은 명령 불가 · 다른 계정 소켓은 그대로');
  const hostBack2 = await wsOpen(`r-${hb.epoch}.${hb.seatToken}`, A2);
  const hb2 = hostBack2.ws ? await hostBack2.first() : null;
  ok(hb2 && hb2.type === 'room_resumed', '새 로그인 세션으로 60초 유예 안 재접속');
  // 다른 계정 쿠키를 들고 로그인(같은 브라우저 계정 전환) → 그 옛 세션과 소켓만 끝난다(성공 뒤에만).
  r = await post('/api/auth/login', { userId: 'bob_0001', password: 'wrong-pass-1' }, { cookie: A2 });
  ok(r.status === 401 && await valid(A2) && !!(await resync(hostBack2, hb2)), '다른 계정 쿠키를 든 실패 로그인은 그 세션을 끊지 않는다');
  r = await post('/api/auth/login', { userId: 'bob_0001', password: 'bob-pass-01' }, { cookie: A2 });
  const B2 = r.cookie;
  ok(r.status === 200 && !(await valid(A2)) && await ended(hostBack2, undefined), '다른 계정 쿠키를 든 로그인 성공 → 들고 온 세션 삭제·그 소켓 종료');
  ok(await ended(guestBack, 'login_replaced') && await valid(B2), '같은 로그인이 B 의 옛 소켓도 끊는다(B 단일 로그인)');
  closeAll(hostBack, guestBack, hostBack2);
  // 절대 만료 — 사용 중이어도 연장되지 않고, 만료 시각이 지나면 열린 소켓도 끊긴다(테스트 서비스 만료 500ms).
  useAccounts(svc({ sessionTtlMs: 500 }));
  const g5 = (await post('/api/auth/login', { userId: 'carol01', password: 'password1' })).cookie;
  useAccounts(accounts);
  const w5 = await wsOpen('c-carol5', g5); const s5 = await w5.first();
  ok(s5.type === 'room_opened' && !!(await resync(w5, s5)), '짧은 세션으로 방 생성·명령');
  await sleep(600);
  ok(!(await resync(w5, s5)) && await ended(w5, undefined), '절대 만료 뒤 첫 명령은 처리되지 않고 E_SESSION_ENDED + 4003');
  ok((await wsOpen('c-carol6', g5)).status === 401, '만료 세션으로 새 업그레이드 401');
  closeAll(w5);

  /* ===== 5c. 경합 — 늦게 끝난 옛 요청이 새 권한을 되살리거나 새 권한을 끊지 못한다 ===== */
  useAccounts(accounts);
  // R1. 옛 로그인(L1)의 DB 쓰기는 끝났는데 응답·폐기가 늦는다. 그 사이 L2 가 로그인하고 소켓을 연다. L1 의 늦은 폐기는 L2 소켓을 끊지 못한다.
  let hold = holdOnce(store, 'loginSession', true);
  const L1 = post('/api/auth/login', { userId: 'alice_01', password: 'alice-pass-1' });
  await hold.hit;
  await sleep(30);
  const L2 = await post('/api/auth/login', { userId: 'alice_01', password: 'alice-pass-1' });
  const wsL2 = await wsOpen('c-l2', L2.cookie); const sL2 = await wsL2.first();
  // R2. 최신 세션의 업그레이드 조회가 진행 중일 때 L1 의 늦은 폐기가 도착해도 그 조회를 거부하지 않는다.
  const hold2 = holdOnce(store, 'findSession', true);
  const pendL2 = wsOpen('c-l2b', L2.cookie);
  await hold2.hit;
  hold.release();
  const l1 = await L1;
  hold2.release();
  const pl2 = await pendL2;
  ok(l1.status === 200 && !(await valid(l1.cookie)) && await valid(L2.cookie), 'R1 늦게 끝난 옛 로그인 L1 의 세션은 무효 · 최신 L2 만 유효');
  ok(sL2.type === 'room_opened' && !!(await resync(wsL2, sL2)) && !wsL2.frames.some((f) => f.code === 'E_SESSION_ENDED'), 'R1 옛 로그인의 늦은 폐기가 최신 세대 소켓을 끊지 않는다');
  ok(pl2.status === 101, 'R2 옛 로그인의 늦은 폐기가 최신 세대의 진행 중 업그레이드를 거부하지 않는다: ' + pl2.status);
  closeAll(pl2);
  // R3. 옛 세션의 업그레이드 조회가 새 로그인 **전** 상태를 읽고, 소켓 등록은 새 로그인 폐기 **뒤** → 인가 소켓이 생기지 않는다.
  hold = holdOnce(store, 'findSession', true);
  const pendOld = wsOpen('c-old', L2.cookie);
  await hold.hit;
  await sleep(20);
  const L3 = await post('/api/auth/login', { userId: 'alice_01', password: 'alice-pass-1' });
  hold.release();
  ok(L3.status === 200 && (await pendOld).status === 401 && await ended(wsL2, 'login_replaced'), 'R3 새 로그인 전에 시작된 옛 세션 조회는 401 · 옛 소켓 종료');
  // R4. 옛 비밀번호 검증을 마친 로그인의 세션 쓰기가 재설정 완료 뒤로 밀린다 → 401·쿠키 없음·유효 세션 없음(credential_gen 가드 유지).
  accounts = svc({ resetResendMs: 0 });
  useAccounts(accounts);
  hold = holdOnce(store, 'loginSession', false);
  const lateLogin = post('/api/auth/login', { userId: 'alice_01', password: 'alice-pass-1' });
  await hold.hit;
  await post('/api/auth/password-reset/request', { userId: 'alice_01' });
  let grant = (await post('/api/auth/password-reset/verify', { userId: 'alice_01', code: mails.pop().code })).json.resetToken;
  const resetDone = await post('/api/auth/password-reset/complete', { resetToken: grant, newPassword: 'alice-new-1' }, { cookie: L3.cookie });
  hold.release();
  r = await lateLogin;
  ok(resetDone.status === 200 && r.status === 401 && r.json.error === 'E_AUTH_FAILED' && !r.cookie && !(await valid(L3.cookie)),
    `R4 재설정보다 늦게 쓰인 옛 비밀번호 로그인 → 401·쿠키 없음: reset ${resetDone.status} login ${r.status}`);
  if (pgUrl) {
    const { rows: [a] } = await fx.pool.query("SELECT id, login_gen FROM accounts WHERE user_id = 'alice_01'");
    const stale = 'S'.repeat(43);
    await fx.pool.query("INSERT INTO sessions (token_hash, account_id, expires_at, credential_gen, login_gen) VALUES ($1, $2, now() + interval '1 day', 0, $3)", [A.tokenHash(stale), a.id, a.login_gen]);
    ok(!(await valid('dd_sid=' + stale)), '[pg] 옛 자격 세대 세션 행은 커밋돼 있어도 무효');
  }
  // DB 실패 — 로그인 세션 쓰기가 실패하면 503·쿠키 없음.
  hold = holdOnce(store, 'loginSession', false);
  const failLogin = post('/api/auth/login', { userId: 'alice_01', password: 'alice-new-1' });
  await hold.hit; store.setDown(true); hold.release();
  r = await failLogin; store.setDown(false);
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE' && !r.setCookie, '세션 쓰기 DB 실패 → 503·쿠키 없음');

  /* ===== 6. 이메일 코드 재설정 — 아이디만 입력(CJ 2026-09-27 최신) ===== */
  // 없는 아이디가 먼저 — 메일 미설정이어도 404 · 있는 아이디는 503 E_MAIL_UNAVAILABLE, 코드 없음.
  useAccounts(svc(null, null));
  const m1 = await post('/api/auth/password-reset/request', { userId: 'bob_0001' });
  const m2 = await post('/api/auth/password-reset/request', { userId: 'nobody_x' });
  ok(m1.status === 503 && m1.json.error === 'E_MAIL_UNAVAILABLE' && m2.status === 404 && m2.json.error === 'E_ID_NOT_FOUND',
    '메일 미설정: 있는 아이디 503 E_MAIL_UNAVAILABLE · 없는 아이디는 먼저 404: ' + m1.status + '/' + m2.status);
  // 테스트 전송(재발송 간격 300ms, 만료 테스트는 별도 서비스).
  accounts = svc({ resetResendMs: 300 });
  useAccounts(accounts);
  const bobMail = 'a.lice+x@example.com';
  const bob = (o) => Object.assign({ userId: 'bob_0001' }, o);
  mails.length = 0;
  const q1 = await post('/api/auth/password-reset/request', { userId: ' BOB_0001 ', email: 'attacker@example.com' });
  const q2 = await post('/api/auth/password-reset/request', { userId: 'nobody_x' });
  const q3 = await post('/api/auth/password-reset/request', { userId: 'ab-cd' });
  ok(q1.status === 202 && JSON.stringify(q1.json) === '{"ok":true}' && mails.length === 1 && mails[0].to === bobMail && /^\d{6}$/.test(mails[0].code),
    '요청 {userId}: 202 · 보낸 이메일 필드는 무시하고 DB 등록 주소(원형)로만 1통 · 응답에 주소 없음');
  ok([q2, q3].every((x) => x.status === 404 && x.json.error === 'E_ID_NOT_FOUND' && x.json.message === '존재하지 않는 아이디입니다') && mails.length === 1,
    '없는 아이디·형식 밖 아이디 404 E_ID_NOT_FOUND · 정확한 문구 · 메일 없음');
  r = await post('/api/auth/password-reset/request', { email: bobMail });
  ok(r.status === 400 && r.json.error === 'E_BAD_INPUT' && mails.length === 1, '아이디 없이 이메일만으로는 요청 불가 400');
  const code1 = mails[0].code;
  ok(!q1.text.includes(code1), '응답에 코드 없음');
  if (pgUrl) {
    const { rows } = await fx.pool.query('SELECT p.code_hash FROM password_resets p JOIN accounts a ON a.id = p.account_id WHERE a.email_norm = $1', [bobMail]);
    ok(rows.length === 1 && /^[0-9a-f]{64}$/.test(rows[0].code_hash) && !JSON.stringify(rows).includes(code1), '[pg] 코드는 HMAC 만 저장(원문 없음)');
  }
  r = await post('/api/auth/password-reset/request', bob());
  ok(r.status === 429 && r.json.error === 'E_RATE_LIMITED' && mails.length === 1, '재발송 간격 안의 요청은 429 · 메일 없음');
  const wrong = code1 === '000000' ? '000001' : '000000';
  r = await post('/api/auth/password-reset/verify', bob({ code: wrong }));
  const r2x = await post('/api/auth/password-reset/verify', { userId: 'nobody_x', code: code1 });
  const r3x = await post('/api/auth/password-reset/verify', { userId: 'alice_01', code: code1 });
  const r4x = await post('/api/auth/password-reset/verify', { email: bobMail, code: code1 });
  ok(r.status === 401 && r.json.error === 'E_CODE_INVALID' && [r2x, r3x, r4x].every((x) => x.text === r.text),
    '틀린 코드·없는 아이디·다른 계정 아이디·아이디 없음 모두 같은 401 E_CODE_INVALID');
  await sleep(320);
  await post('/api/auth/password-reset/request', bob());
  const code2 = mails[mails.length - 1].code;
  r = await post('/api/auth/password-reset/verify', bob({ code: code1 }));
  ok(mails.length === 2 && (code1 === code2 || r.status === 401), '새 코드를 받으면 옛 코드는 무효');
  // 동시 확인 — 같은 코드 두 번, 하나만 허가.
  const vv = await Promise.all([0, 1].map(() => post('/api/auth/password-reset/verify', bob({ code: code2 }))));
  ok(vv.filter((x) => x.status === 200).length === 1, '같은 코드 동시 확인 → 1회만 허가: ' + vv.map((x) => x.status));
  grant = vv.find((x) => x.status === 200).json.resetToken;
  ok(/^[A-Za-z0-9_-]{43}$/.test(grant) && !vv.find((x) => x.status === 200).setCookie, '허가: 256비트 토큰 · 쿠키 아님');
  ok((await post('/api/auth/password-reset/verify', bob({ code: code2 }))).status === 401, '쓴 코드 재사용 401');
  // 직전 비밀번호와 같음 — 409·정확한 문구, 비밀번호·세션·허가 그대로.
  const wsB = await wsOpen('c-bobws', B2); const sB = await wsB.first();
  r = await post('/api/auth/password-reset/complete', { resetToken: grant, newPassword: 'bob-pass-01' });
  ok(r.status === 409 && r.json.error === 'E_SAME_PASSWORD' && r.json.message === '직전 비밀번호와 같습니다', '직전 비밀번호 409 E_SAME_PASSWORD · 문구: ' + JSON.stringify(r.json));
  ok(await valid(B2) && !!(await resync(wsB, sB)), '같은 비밀번호 거부는 세션·소켓을 건드리지 않는다');
  // 성공 — 모든 세션·소켓 종료, 쿠키 삭제, 자동 로그인 없음.
  const done = await Promise.all([0, 1].map((i) => post('/api/auth/password-reset/complete', { resetToken: grant, newPassword: 'bob-new-pass' + i }, { cookie: B2 })));
  const win = done.filter((x) => x.status === 200);
  ok(win.length === 1 && done.some((x) => x.status === 401 && x.json.error === 'E_RESET_INVALID'), '같은 허가 동시 완료 → 1회만: ' + done.map((x) => x.status));
  const newPw = 'bob-new-pass' + done.indexOf(win[0]);
  ok(JSON.stringify(win[0].json) === '{"ok":true}' && /Max-Age=0/.test(win[0].setCookie) && !win[0].cookie, '완료 200 {ok:true} · 쿠키 삭제 · 새 세션 없음(자동 로그인 없음)');
  ok(!(await valid(B2)) && await ended(wsB, undefined), '완료 → 기존 세션 무효 · 열린 소켓 E_SESSION_ENDED + 4003');
  ok((await post('/api/auth/login', { userId: 'bob_0001', password: 'bob-pass-01' })).status === 401 && (await post('/api/auth/login', { userId: 'bob_0001', password: newPw })).status === 200,
    '옛 비밀번호 로그인 실패 · 새 비밀번호 로그인');
  ok((await post('/api/auth/password-reset/complete', { resetToken: grant, newPassword: 'bob-again-1' })).status === 401, '쓴 허가 재사용 401');
  closeAll(wsB);
  // 5회 실패면 맞는 코드도 죽는다.
  await sleep(320);
  useAccounts(accounts); // 루프백 한 IP 의 계정 요청 예산을 비운다
  await post('/api/auth/password-reset/request', bob());
  const code3 = mails[mails.length - 1].code;
  for (let i = 0; i < 5; i++) await post('/api/auth/password-reset/verify', bob({ code: String((Number(code3) + 1 + i) % 1000000).padStart(6, '0') }));
  ok((await post('/api/auth/password-reset/verify', bob({ code: code3 }))).status === 401, '5회 실패 뒤 맞는 코드도 401');
  // 만료.
  useAccounts(svc({ resetResendMs: 0, resetCodeTtlMs: 200 }));
  const carol = (o) => Object.assign({ userId: 'carol01' }, o);
  await post('/api/auth/password-reset/request', carol());
  const code4 = mails[mails.length - 1].code;
  await sleep(300);
  ok((await post('/api/auth/password-reset/verify', carol({ code: code4 }))).status === 401, '만료 코드 401');
  // 발송 실패 — 503(첫 화면에 머문다), 그 코드는 치워져 쓸 수 없다, 오류 원문 없음, 비밀번호 그대로.
  let failedCode = null;
  useAccounts(svc({ resetResendMs: 0 }, { send: async (_to, code) => { failedCode = code; throw new Error('smtp 10.0.0.9 auth user@x failed'); } }));
  r = await post('/api/auth/password-reset/request', carol());
  ok(r.status === 503 && r.json.error === 'E_MAIL_UNAVAILABLE' && !/10\.0\.0\.9|user@x/.test(r.text) && failedCode
    && (await post('/api/auth/password-reset/verify', carol({ code: failedCode }))).status === 401, '발송 실패: 503 E_MAIL_UNAVAILABLE · 원문 없음 · 코드 폐기');
  ok((await post('/api/auth/login', { userId: 'carol01', password: 'password1' })).status === 200, '발송 실패 뒤 비밀번호 그대로');
  // 24시간 발송 상한 10.
  const capSvc = svc({ resetResendMs: 0 });
  useAccounts(capSvc);
  await post('/api/auth/signup', { userId: 'dora_001', nickname: '도라', password: 'dora-pass-1', email: 'dora@example.com' });
  mails.length = 0;
  for (let i = 0; i < 12; i++) { useAccounts(capSvc); await post('/api/auth/password-reset/request', { userId: 'dora_001' }); }
  ok(mails.length === 10, '계정당 24시간 발송 상한 10통: ' + mails.length);

  /* ===== 6b. 같은 이메일 두 계정(CJ 2026-09-27) — 재설정은 아이디의 그 한 계정(등록 주소)에만 묶인다 ===== */
  useAccounts(svc({ resetResendMs: 0 }));
  const sa = await post('/api/auth/signup', { userId: 'same_a01', nickname: '같은A', password: 'same-a-pass1', email: 'same@example.com' });
  const sb = await post('/api/auth/signup', { userId: 'same_b01', nickname: '같은B', password: 'same-b-pass1', email: 'SAME@Example.com' });
  ok(sa.status === 201 && sb.status === 201, 'A/B 같은 이메일(대소문자만 다름)로 각각 가입 201');
  if (pgUrl) ok((await fx.pool.query("SELECT count(*)::int AS n FROM accounts WHERE email_norm = 'same@example.com'")).rows[0].n === 2, '[pg] 004: 같은 email_norm 2행');
  const pa = (o) => Object.assign({ userId: 'same_a01' }, o);
  const pb = (o) => Object.assign({ userId: 'same_b01' }, o);
  mails.length = 0;
  await post('/api/auth/password-reset/request', pb());
  await post('/api/auth/password-reset/request', pa());
  ok(mails.length === 2 && mails[0].to === 'SAME@Example.com' && mails[1].to === 'same@example.com', '요청마다 그 아이디 계정의 등록 주소(원형)로만 1통: ' + mails.map((m) => m.to));
  const [cB, cA] = mails.map((m) => m.code);
  ok(cA === cB || ((await post('/api/auth/password-reset/verify', pb({ code: cA }))).status === 401
    && (await post('/api/auth/password-reset/verify', pa({ code: cB }))).status === 401), '다른 계정의 코드는 같은 이메일이어도 401');
  const vA = await post('/api/auth/password-reset/verify', pa({ code: cA }));
  // B 로 로그인한 브라우저(B 쿠키)에서 A 를 재설정 — B 쿠키를 지우지 않는다(Saturn #259 2026-09-27).
  const doneA = await post('/api/auth/password-reset/complete', { resetToken: vA.json.resetToken, newPassword: 'same-a-new1' }, { cookie: sb.cookie });
  ok(vA.status === 200 && doneA.status === 200 && !doneA.setCookie, 'B 쿠키를 든 A 재설정 완료 200 · Set-Cookie 없음(B 쿠키 보존): ' + doneA.setCookie);
  r = await post('/api/auth/password-reset/complete', { resetToken: vA.json.resetToken, newPassword: 'same-a-new2' }, { cookie: sb.cookie });
  ok(r.status === 401 && !r.setCookie, 'A 허가 재사용 401 · 쿠키 그대로');
  ok(!(await valid(sa.cookie)) && await valid(sb.cookie), 'A 재설정은 A 세션만 끊는다 · B 세션 유지');
  const vB = await post('/api/auth/password-reset/verify', pb({ code: cB }));
  ok(vB.status === 200, 'B 의 코드는 A 재설정 뒤에도 살아 있다');
  const B3 = (await post('/api/auth/login', { userId: 'same_b01', password: 'same-b-pass1' })).cookie;
  const A3 = (await post('/api/auth/login', { userId: 'same_a01', password: 'same-a-new1' })).cookie;
  ok(B3 && A3 && (await post('/api/auth/login', { userId: 'same_a01', password: 'same-a-pass1' })).status === 401, 'B 비밀번호 그대로 · A 만 새 비밀번호');
  // 쿠키 없이 B 재설정 완료 — 쿠키 삭제만, 새 세션 없음(자동 로그인 없음) · B 세션만 끝나고 A 는 그대로.
  r = await post('/api/auth/password-reset/complete', { resetToken: vB.json.resetToken, newPassword: 'same-b-new1' });
  ok(r.status === 200 && /Max-Age=0/.test(r.setCookie) && !r.cookie && !(await valid(B3)) && await valid(A3), '쿠키 없는 완료: 삭제 쿠키만 · 자동 로그인 없음 · B 세션만 무효');

  /* ===== 7. 기존(이메일 없는) 계정 — 로그인 유지 · 인증 뒤 이메일 1회 등록 ===== */
  useAccounts(accounts);
  if (!pgUrl) store.legacy('legacy_01', '옛계정', await A.hashSecret('legacy-pass-1'));
  if (pgUrl) {
    r = await req('GET', '/api/auth/session', { cookie: fx.legacyCookie });
    ok(r.status === 200 && r.json.userId === 'legacy_01' && r.json.hasEmail === false, '[pg] 003 적용 전 최신 유효 세션은 적용 뒤에도 유효 · hasEmail false');
    const { tok, tieWin, before, pw } = fx.legacy;
    const st = {};
    for (const ch of ['A', 'E', 'C', 'T', 'U']) st[ch] = (await req('GET', '/api/auth/session', { cookie: 'dd_sid=' + tok(ch) })).status;
    ok(st.A === 401 && st.E === 401 && st.C === 401, '[pg] 003: 더 오래된 유효·만료·옛 자격 세션은 무효(최신 유효 1개만): ' + JSON.stringify(st));
    ok([st.T, st.U].filter((x) => x === 200).length === 1 && st[tieWin[0]] === 200, '[pg] 003: created_at·expires_at 동률은 token_hash 내림차순 1개만: ' + JSON.stringify(st));
    const after = (await fx.pool.query("SELECT token_hash, account_id, created_at, expires_at, credential_gen FROM sessions WHERE account_id IN (SELECT id FROM accounts WHERE user_id IN ('legacy_01', 'legacy_02')) ORDER BY token_hash")).rows;
    ok(JSON.stringify(after) === JSON.stringify(before), '[pg] 003: 기존 세션 행은 지우거나 바꾸지 않는다(login_gen 표시만): ' + after.length + '/' + before.length);
    const creds = (await fx.pool.query("SELECT password_hash, credential_gen FROM accounts WHERE user_id IN ('legacy_01', 'legacy_02') ORDER BY user_id")).rows;
    ok(creds.length === 2 && creds.every((c) => c.password_hash === pw) && creds[0].credential_gen === 1 && creds[1].credential_gen === 0, '[pg] 003: 계정·비밀번호·자격 세대 보존');
  }
  r = await post('/api/auth/login', { userId: 'legacy_01', password: 'legacy-pass-1' });
  const L = r.cookie;
  ok(r.status === 200 && r.json.hasEmail === false, '기존 계정 로그인 · hasEmail false(게임 입장은 막지 않는다)');
  if (pgUrl) ok(!(await valid(fx.legacyCookie)), '[pg] 기존 계정도 새 로그인 뒤 옛 세션 무효');
  mails.length = 0;
  r = await post('/api/auth/password-reset/request', { userId: 'legacy_01' });
  ok(r.status === 409 && r.json.error === 'E_EMAIL_REQUIRED' && mails.length === 0, '이메일 없는 기존 계정 재설정 요청 409 E_EMAIL_REQUIRED · 메일 없음');
  ok((await post('/api/auth/email', { password: 'legacy-pass-1', email: 'old@example.com' })).status === 401, '등록은 로그인 필요');
  ok((await post('/api/auth/email', { password: 'wrong-pass-1', email: 'old@example.com' }, { cookie: L })).json.error === 'E_AUTH_FAILED', '등록은 현재 비밀번호 필요');
  r = await post('/api/auth/email', { password: 'legacy-pass-1', email: 'DORA@example.com' }, { cookie: L });
  ok(r.status === 200 && r.json.hasEmail === true && (await req('GET', '/api/auth/session', { cookie: L })).json.hasEmail === true,
    '다른 계정과 같은 이메일도 첫 등록 200(CJ 2026-09-27 · 004) · 세션 유지 · hasEmail true');
  r = await post('/api/auth/email', { password: 'legacy-pass-1', email: 'new@example.com' }, { cookie: L });
  ok(r.status === 409 && r.json.error === 'E_EMAIL_ALREADY_SET', '이미 이메일이 있으면 변경 불가(주소 변경 경로 없음)');
  ok((await post('/api/auth/email', { password: 'alice-new-1', email: 'z@example.com' }, { cookie: (await post('/api/auth/login', { userId: 'alice_01', password: 'alice-new-1' })).cookie })).json.error === 'E_EMAIL_ALREADY_SET',
    '가입 이메일이 있는 계정도 변경 불가');

  /* ===== 8. DB 장애 — 성공한 척하지 않는다 ===== */
  store.setDown(true);
  r = await post('/api/auth/signup', { userId: 'dave_001', nickname: '데이브', password: 'password1', email: 'dave@example.com' });
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE' && !/10\.0\.0\.5|ECONNREFUSED/.test(r.text), 'DB 장애: 가입 503(오류 원문 없음)');
  r = await post('/api/auth/password-reset/request', { userId: 'dora_001' });
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'DB 장애: 재설정 요청 503');
  ok((await req('GET', '/api/auth/session', { cookie: L })).status === 503 && (await wsOpen('c-down', L)).status === 503, 'DB 장애: 세션 확인·업그레이드 503');
  store.setDown(false);
  ok(await valid(L), 'DB 복구 뒤 세션 그대로');

  if (fx.pool) await fx.pool.end();
  server.close();
  console.log(`#259 accounts: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
