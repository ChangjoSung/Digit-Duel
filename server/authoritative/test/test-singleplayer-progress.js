'use strict';
// v0.4.16 싱글 진행 저장(#324 튜토리얼 기본·심화 카테고리(007) · #322 무제한 AI 3단계 최고 클리어) — 서버 쪽 경계.
//   읽기: 가입·로그인·세션 응답의 progress{tutorialDone, aiClearedTier, tutorial{basic, advanced}}. 쓰기: POST /api/profile/tutorial(v:2) · /api/profile/ai-clear.
//   세션·CSRF·JSON · 입력/버전 검증(v:1 = E_CLIENT_OUTDATED) · 계정 일치 · 카테고리 단조·멱등·충돌 409 · 기본만으로 해금 없음 · 심화 선행 조건
//   · 전체 스킵 · n+1 · 동시 요청 · 단일 로그인 교체 · DB 장애 503 · 공식 전적 무관 · DB 없는 서버.
// 저장소는 기본이 메모리 대역이고, DD_TEST_DATABASE_URL 이 있으면 실제 Postgres(pgStore + 001~007)로 같은 검사를 돌고
// 006 이관(기존 계정 = 완료 간주) → 007(그 계정 = 면제 · 006 뒤 미완료 계정 = 미결) · 제약 · 옛 서버 쓰기 · 행 잠금까지 본다
// (그 DB 의 표를 지운다 — 전용 테스트 DB 에만).
const http = require('http');
const { server, useAccounts } = require('../server');
const A = require('../accounts');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

/* ===== 저장소 대역 — 이 테스트가 부르는 pgStore 메서드만, 같은 계약으로 ===== */
function memStore() {
  const accts = new Map(), sessions = new Map();
  let seq = 0, down = false;
  const guard = () => { if (down) { const e = new Error('connect ECONNREFUSED 10.0.0.5:5432'); e.code = 'ECONNREFUSED'; throw e; } };
  const prog = (a) => ({ tutorial_done: a.tutorial_done_at != null, ai_cleared_tier: a.ai_cleared_tier, tutorial_basic: a.tutorial_basic, tutorial_advanced: a.tutorial_advanced });
  const addSess = (a, sess) => sessions.set(sess.hash, { account_id: a.id, expires: Date.now() + sess.ttlMs, lgen: a.login_gen });
  return {
    setDown(v) { down = v; },
    async createAccount({ userId, nickname, email, passwordHash }, sess) {
      guard();
      if ([...accts.values()].some((a) => a.user_id === userId)) return { taken: 'userId' };
      const a = { id: String(++seq), user_id: userId, nickname, email, password_hash: passwordHash, credential_gen: 0, login_gen: 0,
        tutorial_done_at: null, ai_cleared_tier: 0, tutorial_basic: null, tutorial_advanced: null };
      accts.set(a.id, a);
      addSess(a, sess);
      return { id: a.id, login_gen: 0 };
    },
    async findAccount(u) { guard(); const a = [...accts.values()].find((x) => x.user_id === u); return a ? Object.assign({ has_email: true }, a) : null; },
    async loginSession(id, gen, sess) {
      guard();
      const a = accts.get(String(id));
      a.login_gen += 1;
      for (const [h, s] of sessions) if (s.account_id === a.id) sessions.delete(h);
      addSess(a, sess);
      return Object.assign({ login_gen: a.login_gen }, prog(a));
    },
    async findSession(h) {
      guard();
      const s = sessions.get(h);
      const a = s && accts.get(s.account_id);
      if (!a || s.expires <= Date.now() || a.login_gen !== s.lgen) return null;
      return Object.assign({ id: a.id, user_id: a.user_id, nickname: a.nickname, has_email: true, rep_minion: 'M-F1', expires_at: s.expires, login_gen: s.lgen }, prog(a));
    },
    async deleteSession(h) { guard(); sessions.delete(h); },
    async getProfile(id) { guard(); const a = accts.get(String(id)); return a && { nickname: a.nickname, rep_minion: 'M-F1', wins: 0, losses: 0 }; },
    async recentMatches() { guard(); return []; },
    async saveTutorial(id, basic, advanced) {
      guard();
      const a = accts.get(String(id));
      if (!a) return null;
      const setBasic = basic != null && a.tutorial_basic == null && a.tutorial_done_at == null;
      const setAdv = advanced != null && a.tutorial_done_at == null && (a.tutorial_basic != null || basic != null);
      if (setBasic) a.tutorial_basic = basic;
      if (setAdv) { a.tutorial_advanced = advanced; a.tutorial_done_at = new Date(); }
      return prog(a);
    },
    async clearAiTier(id, tier) {
      guard();
      const a = accts.get(String(id));
      if (!a) return null;
      const saved = a.tutorial_done_at != null && tier <= a.ai_cleared_tier + 1;
      if (saved) a.ai_cleared_tier = Math.max(a.ai_cleared_tier, tier);
      return Object.assign(prog(a), { saved });
    },
  };
}

async function pgFixture(url) {
  const { Pool } = require('pg');
  const mig = require('../../db-migrate');
  const pool = new Pool({ connectionString: url, max: 8 });
  await pool.query('DROP TABLE IF EXISTS match_results, password_resets, sessions, accounts, db_meta, schema_migrations');
  const all = mig.loadMigrations();
  // 006 이전 DB 에 계정이 있는 상태 → 006(기존 계정 이관 = 완료) → 006 뒤 가입(미완료) 계정 → 007.
  const acct = async (u, pw) => pool.query(`INSERT INTO accounts (user_id, nickname, password_hash, email, email_norm) VALUES ($1, $1, $2, 'l@example.com', 'l@example.com')`,
    [u, await A.hashSecret(pw)]);
  await mig.up(pool, all.filter((m) => m.version < '006'));
  await acct('legacy_sp', 'legacy-pass-1');
  const applied = await mig.up(pool, all.filter((m) => m.version < '007'));
  await acct('pend_sp', 'pend-pass-1');
  applied.push(...await mig.up(pool, all));
  let down = false;
  const query = (t, p) => (down ? Promise.reject(Object.assign(new Error('down'), { code: 'ECONNREFUSED' })) : pool.query(t, p));
  return { store: Object.assign(A.pgStore(query), { setDown(v) { down = v; } }), pool, applied, mig, all };
}

/* ===== HTTP 도우미 (test-issue260-profile.js 와 같은 모양) ===== */
let PORT;
function req(method, path, { body, cookie, origin = true, type = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const h = {};
    if (origin) h.Origin = `http://127.0.0.1:${PORT}`;
    if (cookie) h.Cookie = cookie;
    const data = body === undefined ? null : JSON.stringify(body);
    if (data !== null) { h['Content-Type'] = type; h['Content-Length'] = Buffer.byteLength(data); }
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path, headers: h }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        let json = null; try { json = JSON.parse(buf); } catch (e) { /* noop */ }
        const set = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : null;
        resolve({ status: res.statusCode, json, cookie: set ? set.split(';')[0] : null });
      });
    });
    r.on('error', reject);
    if (data !== null) r.write(data);
    r.end();
  });
}
const post = (path, body, opts) => req('POST', path, Object.assign({ body }, opts || {}));
// progressIs = 006 호환 두 값 · tutIs = 007 카테고리 + tutorialDone 이 "심화 미결 아님"과 같은지 + 응답 모양(필드 셋 정확히)
const progressIs = (r, t, n) => !!(r.json && r.json.progress) && r.json.progress.tutorialDone === t && r.json.progress.aiClearedTier === n;
const tutIs = (r, b, a) => !!(r.json && r.json.progress && r.json.progress.tutorial)
  && JSON.stringify(r.json.progress.tutorial) === JSON.stringify({ basic: b, advanced: a })
  && r.json.progress.tutorialDone === (a !== 'pending') && Object.keys(r.json.progress).join() === 'tutorialDone,aiClearedTier,tutorial';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 명시적 장벽 — 다음 한 번의 store[method] 호출을 **부르기 전에** 멈춘다(hit = 도착, release = 진행).
function holdBefore(store, method) {
  const orig = store[method];
  let release; const gate = new Promise((r) => { release = r; });
  let reached; const hit = new Promise((r) => { reached = r; });
  store[method] = async (...args) => { store[method] = orig; reached(); await gate; return orig(...args); };
  return { hit, release };
}
// 다음 한 번의 store[method] 를 DB 오류로 — afterCommit 이면 실제로 쓴 **뒤에** 던진다(커밋 후 응답 유실).
function failOnce(store, method, afterCommit) {
  const orig = store[method];
  store[method] = async (...args) => {
    store[method] = orig;
    if (afterCommit) await orig(...args);
    throw Object.assign(new Error('read ECONNRESET 10.0.0.5:5432'), { code: 'ECONNRESET' });
  };
}
// 실제 Postgres: 행 잠금을 기다리는 백엔드가 n 개 이상이 될 때까지(최대 5초) — 경합을 "그럴 수도"가 아니라 강제로 만든다.
async function lockWaiters(pool, n) {
  for (let i = 0; i < 100; i++) {
    const k = (await pool.query(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`)).rows[0].n;
    if (k >= n) return true;
    await sleep(50);
  }
  return false;
}

async function main() {
  const pgUrl = process.env.DD_TEST_DATABASE_URL;
  const fx = pgUrl ? await pgFixture(pgUrl) : { store: memStore(), pool: null };
  const store = fx.store;
  console.log(`싱글 진행 — 저장소: ${pgUrl ? '실제 Postgres(pgStore · 001~007)' : '메모리 대역'}`);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;

  useAccounts(null);
  for (const p of ['/api/profile/tutorial', '/api/profile/ai-clear']) {
    const r = await post(p, { v: 2, userId: 'x', category: 'all', end: 'skip', tier: 1 });
    ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_DISABLED', `S0 DB 없는 서버: ${p} 503 E_ACCOUNTS_DISABLED`);
  }

  const accounts = A.createAccounts(store, null, null);
  useAccounts(accounts);
  const TUT = '/api/profile/tutorial', CLR = '/api/profile/ai-clear';
  // 기본값 = 처음 질문의 전체 스킵. 카테고리 쓰기는 body 로 덮는다.
  const tut = (cookie, userId, body) => post(TUT, Object.assign({ v: 2, userId, category: 'all', end: 'skip' }, body), { cookie });
  const cat = (cookie, userId, category, end) => tut(cookie, userId, { category, end });
  const clr = (cookie, userId, tier, body) => post(CLR, Object.assign({ v: 1, userId, tier, end: 'king' }, body), { cookie });
  const session = (cookie) => req('GET', '/api/auth/session', { cookie });
  const signup = async (u) => (await post('/api/auth/signup', { userId: u, nickname: u.slice(0, 8), password: u + '-pass', email: u + '@example.com' })).cookie;
  // 거부 직후 그 계정의 저장값이 그대로인지(세션 재조회 + 실제 Postgres 면 DB 행까지).
  const dbRow = async (u) => fx.pool && (await fx.pool.query(
    `SELECT tutorial_done_at, ai_cleared_tier, tutorial_basic, tutorial_basic_at, tutorial_advanced FROM accounts WHERE user_id = $1`, [u])).rows[0];
  const unchanged = async (cookie, u, t, n, msg) => {
    const s = await session(cookie), d = await dbRow(u);
    ok(s.status === 200 && progressIs(s, t, n) && (!d || ((d.tutorial_done_at != null) === t && d.ai_cleared_tier === n)),
      msg + ' — 저장 0 ' + JSON.stringify([s.json && s.json.progress, d]));
  };
  const tutStays = async (cookie, u, b, a, msg) => {
    const s = await session(cookie), d = await dbRow(u);
    const kind = (x) => (x === 'completed' || x === 'skipped' ? x : null);
    ok(s.status === 200 && tutIs(s, b, a) && (!d || (d.tutorial_basic === kind(b) && d.tutorial_advanced === kind(a))),
      msg + ' ' + JSON.stringify([s.json && s.json.progress, d]));
  };

  // 새 계정 = 미완료 · 0 · 기본·심화 미결 — 가입·세션·로그인 응답 모두
  let r = await post('/api/auth/signup', { userId: 'alice_sp', nickname: '앨리스', password: 'alice-pass-1', email: 'a@example.com' });
  let alice = r.cookie;
  ok(r.status === 201 && progressIs(r, false, 0) && tutIs(r, 'pending', 'pending') && r.json.userId === 'alice_sp', 'S1 가입 201 · 미완료/0 · 기본·심화 미결 ' + JSON.stringify(r.json));
  r = await session(alice);
  ok(r.status === 200 && progressIs(r, false, 0) && tutIs(r, 'pending', 'pending') && r.json.hasEmail === true, 'S1 세션 복원 · 미완료/0 · 미결');
  const bob = (await post('/api/auth/signup', { userId: 'bob_00sp', nickname: '밥돌', password: 'bobby-pass-1', email: 'b@example.com' })).cookie;

  // 경계 — 세션 · CSRF · JSON
  r = await tut(null, 'alice_sp');
  ok(r.status === 401 && r.json.error === 'E_NO_SESSION', 'S2 세션 없음 → 401');
  r = await clr(null, 'alice_sp', 1);
  ok(r.status === 401 && r.json.error === 'E_NO_SESSION', 'S2 세션 없음(ai-clear) → 401');
  r = await post(TUT, { v: 2, userId: 'alice_sp', category: 'all', end: 'skip' }, { cookie: alice, origin: false });
  ok(r.status === 403 && r.json.error === 'E_BAD_ORIGIN', 'S2 Origin 없는 POST 403');
  r = await post(CLR, { v: 1, userId: 'alice_sp', tier: 1, end: 'king' }, { cookie: alice, type: 'text/plain' });
  ok(r.status === 415, 'S2 JSON 아닌 본문 415');
  r = await req('GET', TUT, { cookie: alice });
  ok(r.status === 405, 'S2 GET /api/profile/tutorial → 405(쓰기 전용)');
  r = await post(TUT, { v: 2, userId: 'alice_sp', category: 'all', end: 'skip', pad: 'x'.repeat(3000) }, { cookie: alice });
  ok(r.status === 400 && r.json.error === 'E_BAD_INPUT', 'S2 2KB 넘는 본문 400');

  // 입력·버전 검증 — 저장 0
  for (const bad of [{ v: 3 }, { v: '2' }, { v: undefined }, { end: 'resign' }, { end: 'draw' }, { end: '' }, { end: undefined }, { end: ['skip'] },
    { end: 'edge' }, { category: undefined }, { category: 'Basic' }, { category: '__proto__' }, { category: 'toString' }, { category: ['all'] },
    { category: 'basic', end: 'king' }, { category: 'basic', end: 'wipe' }, { category: 'advanced', end: 'resign' }]) {
    r = await tut(alice, 'alice_sp', bad);
    ok(r.status === 400 && r.json.error === 'E_BAD_INPUT', 'S3 tutorial 형식 밖 400: ' + JSON.stringify(bad));
  }
  // 옛 v1 클라이언트(불리언 완료) — 새 학습 시청으로도 면제로도 저장하지 않는다(명시적 업그레이드 오류)
  for (const end of ['skip', 'king', 'edge', 'wipe']) {
    r = await post(TUT, { v: 1, userId: 'alice_sp', end }, { cookie: alice });
    ok(r.status === 400 && r.json.error === 'E_CLIENT_OUTDATED' && !r.json.progress, 'S3 v:1 튜토리얼 → 400 E_CLIENT_OUTDATED: ' + end);
  }
  for (const bad of [{ tier: 0 }, { tier: 4 }, { tier: 8 }, { tier: '1' }, { tier: 1.5 }, { tier: null }, { end: 'skip' }, { end: 'resign' }, { v: 0 }]) {
    r = await post(CLR, Object.assign({ v: 1, userId: 'alice_sp', tier: 1, end: 'king' }, bad), { cookie: alice });
    ok(r.status === 400 && r.json.error === 'E_BAD_INPUT', 'S3 ai-clear 형식 밖 400: ' + JSON.stringify(bad));
  }
  // 계정 일치 — 다른 계정·빠진 userId 는 409, 저장 0
  for (const u of ['bob_00sp', undefined, 'nobody_x', 7]) {
    r = await tut(alice, u);
    ok(r.status === 409 && r.json.error === 'E_ACCOUNT_MISMATCH', 'S4 본문 userId ≠ 세션 계정 → 409: ' + JSON.stringify(u));
  }
  r = await cat(bob, 'alice_sp', 'basic', 'edge');
  ok(r.status === 409 && r.json.error === 'E_ACCOUNT_MISMATCH', 'S4 기본 카테고리 계정 불일치 409');
  r = await clr(bob, 'alice_sp', 1);
  ok(r.status === 409 && r.json.error === 'E_ACCOUNT_MISMATCH', 'S4 ai-clear 계정 불일치 409');
  await unchanged(alice, 'alice_sp', false, 0, 'S2~S4 거부(401·403·415·405·400·409) 뒤 앨리스 미완료/0');
  await tutStays(alice, 'alice_sp', 'pending', 'pending', 'S2~S4 거부 뒤 앨리스 기본·심화 미결');
  await unchanged(bob, 'bob_00sp', false, 0, 'S4 계정 불일치 거부 뒤 밥돌 미완료/0');
  r = await tut(alice, 'ALICE_SP ');
  ok(r.status === 200 && progressIs(r, true, 0) && tutIs(r, 'skipped', 'skipped'), 'S4 같은 아이디(정규화) 일치 → 처음 질문 전체 스킵 = 둘 다 스킵 · 해금 ' + JSON.stringify(r.json));
  const aliceRow = await dbRow('alice_sp');
  r = await session(bob);
  ok(progressIs(r, false, 0) && tutIs(r, 'pending', 'pending'), 'S4 다른 계정(밥돌) 진행은 그대로 미결');

  // S5 기본 → 심화 순서 · 기본만으로 해금 없음 · 같은 종류 반복 멱등 · 다른 종류 409(덮어쓰지 않음)
  r = await clr(bob, 'bob_00sp', 1);
  ok(r.status === 409 && r.json.error === 'E_TIER_LOCKED' && progressIs(r, false, 0), 'S5 튜토리얼 미결 → 브론즈 클리어 409 E_TIER_LOCKED');
  r = await cat(bob, 'bob_00sp', 'advanced', 'king');
  ok(r.status === 409 && r.json.error === 'E_BASIC_REQUIRED' && tutIs(r, 'pending', 'pending'), 'S5 기본 미결에서 심화 완료 → 409 E_BASIC_REQUIRED · 현재 진행 동봉');
  r = await cat(bob, 'bob_00sp', 'advanced', 'skip');
  ok(r.status === 409 && r.json.error === 'E_BASIC_REQUIRED', 'S5 기본 미결에서 심화 스킵도 409 E_BASIC_REQUIRED');
  await tutStays(bob, 'bob_00sp', 'pending', 'pending', 'S5 E_BASIC_REQUIRED 뒤 저장 0');
  r = await cat(bob, 'bob_00sp', 'basic', 'edge');
  ok(r.status === 200 && tutIs(r, 'completed', 'pending') && progressIs(r, false, 0), 'S5 기본 완료(끝줄) 200 · tutorialDone 그대로 false ' + JSON.stringify(r.json));
  const bobBasicAt = fx.pool && (await dbRow('bob_00sp')).tutorial_basic_at.getTime();
  r = await clr(bob, 'bob_00sp', 1);
  ok(r.status === 409 && r.json.error === 'E_TIER_LOCKED', 'S5 기본만 완료 → 브론즈 클리어 여전히 409(해금 아님)');
  r = await cat(bob, 'bob_00sp', 'basic', 'edge');
  ok(r.status === 200 && tutIs(r, 'completed', 'pending'), 'S5 기본 완료 재전송 200 · 같은 결과(멱등)');
  r = await cat(bob, 'bob_00sp', 'basic', 'skip');
  ok(r.status === 409 && r.json.error === 'E_TUTORIAL_CONFLICT' && tutIs(r, 'completed', 'pending'), 'S5 완료된 기본에 늦은 스킵 → 409 충돌 · 완료 유지');
  r = await cat(bob, 'bob_00sp', 'advanced', 'wipe');
  ok(r.status === 200 && tutIs(r, 'completed', 'completed') && progressIs(r, true, 0), 'S5 심화 완료(전멸) 200 → 해금');
  const bobDoneAt = fx.pool && (await dbRow('bob_00sp')).tutorial_done_at.getTime();
  for (const end of ['king', 'edge', 'wipe']) {
    r = await cat(bob, 'bob_00sp', 'advanced', end);
    ok(r.status === 200 && tutIs(r, 'completed', 'completed'), 'S5 심화 완료 재전송(다른 정상 종료 포함) 200 멱등: ' + end);
  }
  r = await cat(bob, 'bob_00sp', 'advanced', 'skip');
  ok(r.status === 409 && r.json.error === 'E_TUTORIAL_CONFLICT' && tutIs(r, 'completed', 'completed'), 'S5 완료된 심화에 늦은 스킵 → 409 충돌');
  r = await tut(bob, 'bob_00sp');
  ok(r.status === 200 && tutIs(r, 'completed', 'completed'), 'S5 둘 다 정해진 뒤 늦은 전체 스킵 → 200 · 바꾸지 않음');
  if (fx.pool) {
    const d = await dbRow('bob_00sp');
    ok(d.tutorial_basic_at.getTime() === bobBasicAt && d.tutorial_done_at.getTime() === bobDoneAt && d.tutorial_basic_at <= d.tutorial_done_at,
      'S5 반복·충돌 요청이 처음 시각(기본·심화)을 바꾸지 않는다 ' + JSON.stringify(d));
  }
  r = await tut(alice, 'alice_sp');
  ok(r.status === 200 && tutIs(r, 'skipped', 'skipped'), 'S5 앨리스 전체 스킵 재전송 200');
  r = await cat(alice, 'alice_sp', 'basic', 'edge');
  ok(r.status === 409 && r.json.error === 'E_TUTORIAL_CONFLICT' && tutIs(r, 'skipped', 'skipped'), 'S5 스킵된 기본에 늦은 완료 → 409(스킵→완료로도 바꾸지 않음)');
  if (fx.pool) {
    const d = await dbRow('alice_sp');
    ok(d.tutorial_basic_at.getTime() === aliceRow.tutorial_basic_at.getTime() && d.tutorial_done_at.getTime() === aliceRow.tutorial_done_at.getTime()
      && aliceRow.tutorial_basic_at.getTime() === aliceRow.tutorial_done_at.getTime(), 'S5 전체 스킵 = 한 문장(같은 시각) · 재전송이 시각 불변');
  }

  // S6 다른 갈래 — 기본 스킵 → 심화 스킵 · 기본 완료 → 전체 스킵(남은 심화만 스킵)
  const gina = await signup('gina_sp');
  r = await cat(gina, 'gina_sp', 'basic', 'skip');
  ok(r.status === 200 && tutIs(r, 'skipped', 'pending') && progressIs(r, false, 0), 'S6 기본만 스킵 → 기본 스킵 · 해금 없음');
  r = await cat(gina, 'gina_sp', 'advanced', 'skip');
  ok(r.status === 200 && tutIs(r, 'skipped', 'skipped') && progressIs(r, true, 0), 'S6 심화 명시 스킵 → 해금');
  const hank = await signup('hank_sp');
  r = await cat(hank, 'hank_sp', 'basic', 'edge');
  r = await tut(hank, 'hank_sp');
  ok(r.status === 200 && tutIs(r, 'completed', 'skipped'), 'S6 기본 완료 뒤 전체 스킵 → 남은 심화만 스킵(기본 완료 유지)');

  // S7 n+1 · 단조 (해금된 앨리스)
  r = await clr(alice, 'alice_sp', 2);
  ok(r.status === 409 && r.json.error === 'E_TIER_LOCKED' && progressIs(r, true, 0), 'S7 브론즈 전 실버 → 409 · 저장 0');
  await unchanged(alice, 'alice_sp', true, 0, 'S7 건너뛴 실버 거부 뒤 앨리스 완료/0');
  r = await clr(alice, 'alice_sp', 1, { end: 'wipe' });
  ok(r.status === 200 && progressIs(r, true, 1) && tutIs(r, 'skipped', 'skipped'), 'S7 브론즈 클리어 → 1 · 카테고리 동봉');
  r = await clr(alice, 'alice_sp', 1);
  ok(r.status === 200 && progressIs(r, true, 1), 'S7 브론즈 재클리어(중복) 200 · 1 유지');
  r = await clr(alice, 'alice_sp', 3);
  ok(r.status === 409 && progressIs(r, true, 1), 'S7 실버 전 골드 → 409');
  r = await clr(alice, 'alice_sp', 2, { end: 'edge' });
  ok(r.status === 200 && progressIs(r, true, 2), 'S7 실버 클리어 → 2');
  r = await clr(alice, 'alice_sp', 1);
  ok(r.status === 200 && progressIs(r, true, 2), 'S7 낮은 단계 재도전 승리 200 · 2 유지(내려가지 않음)');
  r = await clr(alice, 'alice_sp', 3);
  ok(r.status === 200 && progressIs(r, true, 3), 'S7 골드 클리어 → 3');
  r = await clr(alice, 'alice_sp', 3);
  ok(r.status === 200 && progressIs(r, true, 3), 'S7 골드 재클리어 200 · 3 유지(미구현 단계를 열지 않음)');
  r = await session(alice);
  ok(progressIs(r, true, 3) && tutIs(r, 'skipped', 'skipped'), 'S7 서버 재조회(세션) = 3 · 스킵/스킵');
  r = await req('GET', '/api/profile', { cookie: alice });
  ok(r.status === 200 && r.json.stats.wins === 0 && r.json.stats.losses === 0 && r.json.matches.length === 0 && !('progress' in r.json),
    'S7 진행 쓰기는 공식 전적·최근 경기에 0건 ' + JSON.stringify(r.json));

  // S8 다른 기기 로그인 — 다시 로그인한 응답에 서버 진행 · 옛 세션의 쓰기는 401
  r = await post('/api/auth/login', { userId: 'alice_sp', password: 'alice-pass-1' });
  const alice2 = r.cookie;
  ok(r.status === 200 && progressIs(r, true, 3) && tutIs(r, 'skipped', 'skipped'), 'S8 다른 기기 로그인 응답 progress 유지(기기 간)');
  r = await post('/api/auth/login', { userId: 'bob_00sp', password: 'bobby-pass-1' });
  ok(r.status === 200 && tutIs(r, 'completed', 'completed'), 'S8 밥돌 로그인 응답 완료/완료');
  r = await tut(alice, 'alice_sp');
  ok(r.status === 401 && r.json.error === 'E_NO_SESSION', 'S8 교체된 옛 세션의 튜토리얼 요청 401');
  r = await clr(alice, 'alice_sp', 1);
  ok(r.status === 401, 'S8 교체된 옛 세션의 클리어 요청 401');
  alice = alice2;

  // S9 동시 요청 — 새 계정에서 전체 스킵·브론즈 묶음, 그다음 실버·골드 경합 · 카테고리 경합
  const carol = (await post('/api/auth/signup', { userId: 'carol_sp', nickname: '캐롤', password: 'carol-pass-1', email: 'c@example.com' })).cookie;
  let burst = await Promise.all(Array.from({ length: 6 }, () => tut(carol, 'carol_sp')));
  ok(burst.every((x) => x.status === 200 && tutIs(x, 'skipped', 'skipped')), 'S9 동시 전체 스킵 6건 모두 200 · 같은 결과');
  burst = await Promise.all(Array.from({ length: 6 }, () => clr(carol, 'carol_sp', 1)));
  ok(burst.every((x) => x.status === 200 && x.json.progress.aiClearedTier === 1), 'S9 동시 브론즈 6건 모두 200 · 1');
  burst = await Promise.all([clr(carol, 'carol_sp', 3), clr(carol, 'carol_sp', 2), clr(carol, 'carol_sp', 3), clr(carol, 'carol_sp', 2)]);
  const gold = burst.filter((x, i) => i % 2 === 0), silver = burst.filter((x, i) => i % 2 === 1);
  r = await session(carol);
  const fin = r.json.progress.aiClearedTier;
  ok(silver.every((x) => x.status === 200) && gold.every((x) => x.status === 200 || x.json.error === 'E_TIER_LOCKED')
    && fin === (gold.some((x) => x.status === 200) ? 3 : 2) && burst.every((x) => x.json.progress.aiClearedTier <= fin),
  `S9 실버·골드 경합: 골드는 실버 커밋 뒤에만 · 최종 ${fin} ` + JSON.stringify(burst.map((x) => [x.status, x.json.progress.aiClearedTier])));
  // 카테고리 경합 — 기본 완료·기본 스킵·전체 스킵·심화 완료가 한꺼번에: 응답 200 은 최종 상태와 같은 종류만, 409 는 최종과 다른 쪽만
  for (const u of ['iris_sp', 'jack_sp', 'kate_sp']) {
    const ck = await signup(u);
    const reqs = [['basic', 'edge'], ['all', 'skip'], ['basic', 'skip'], ['advanced', 'king'], ['basic', 'edge'], ['all', 'skip']];
    const out = await Promise.all(reqs.map(([c, e]) => cat(ck, u, c, e)));
    const s = (await session(ck)).json.progress.tutorial;
    const kindOf = (e) => (e === 'skip' ? 'skipped' : 'completed');
    const consistent = out.every((x, i) => {
      const [c, e] = reqs[i];
      if (c === 'all') return x.status === 200 && x.json.progress.tutorial.basic !== 'pending';
      if (x.status === 200) return s[c] === kindOf(e);
      return x.status === 409 && (x.json.error === 'E_TUTORIAL_CONFLICT' ? s[c] !== kindOf(e) : c === 'advanced' && x.json.error === 'E_BASIC_REQUIRED');
    });
    ok(consistent && s.basic !== 'pending' && s.advanced !== 'pending', `S9 카테고리 경합 ${u}: 최종 ${JSON.stringify(s)} · 응답이 최종과 모순 없음 ` + JSON.stringify(out.map((x) => [x.status, x.json.error || ''])));
  }

  // S10 DB 장애 — 성공한 척하지 않는다(503), 복구 뒤 재조회 → 같은 요청 재시도로 저장
  const dave = (await post('/api/auth/signup', { userId: 'dave_sp', nickname: '데이브', password: 'dave-pass-1', email: 'd@example.com' })).cookie;
  store.setDown(true);
  r = await cat(dave, 'dave_sp', 'basic', 'edge');
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE' && !/10\.0\.0\.5|ECONN/.test(JSON.stringify(r.json)), 'S10 DB 장애: 기본 저장 503(원문 없음)');
  r = await session(dave);
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'S10 DB 장애 중 세션 조회 503(미결 200 으로 대체하지 않음)');
  store.setDown(false);
  r = await session(dave);
  ok(r.status === 200 && tutIs(r, 'pending', 'pending'), 'S10 복구 뒤 재조회: 저장 안 됨(미결)');
  failOnce(store, 'saveTutorial', true);
  r = await cat(dave, 'dave_sp', 'basic', 'edge');
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'S10 기본 커밋 후 응답 유실 → 503(성공 여부 불명)');
  r = await session(dave);
  ok(r.status === 200 && tutIs(r, 'completed', 'pending'), 'S10 커밋 후 유실: 재조회로 기본 완료 확인');
  r = await cat(dave, 'dave_sp', 'basic', 'edge');
  ok(r.status === 200 && tutIs(r, 'completed', 'pending'), 'S10 같은 요청 재시도 200 · 같은 결과(멱등)');
  failOnce(store, 'saveTutorial', false);
  r = await cat(dave, 'dave_sp', 'advanced', 'edge');
  ok(r.status === 503, 'S10 심화 쓰기 단계 실패(인증 조회 성공 뒤) 503');
  await tutStays(dave, 'dave_sp', 'completed', 'pending', 'S10 쓰기 단계 실패 뒤 재조회 저장 0');
  r = await cat(dave, 'dave_sp', 'advanced', 'edge');
  ok(r.status === 200 && tutIs(r, 'completed', 'completed'), 'S10 재시도로 심화 완료');
  failOnce(store, 'clearAiTier', false);
  r = await clr(dave, 'dave_sp', 1);
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'S10 클리어 쓰기 단계 실패 503');
  await unchanged(dave, 'dave_sp', true, 0, 'S10 클리어 쓰기 단계 실패 뒤 재조회 완료/0');
  failOnce(store, 'clearAiTier', true);
  r = await clr(dave, 'dave_sp', 1);
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'S10 클리어 커밋 후 응답 유실 → 503(성공 여부 불명)');
  r = await session(dave);
  ok(r.status === 200 && progressIs(r, true, 1), 'S10 커밋 후 유실: 재조회로 저장 확인 1');
  r = await clr(dave, 'dave_sp', 1);
  ok(r.status === 200 && progressIs(r, true, 1), 'S10 커밋 후 유실: 같은 요청 재시도 200 · 1 유지(중복 없음)');

  // S11 006·007 이관 (실제 Postgres 만) — 006 이전 계정 = 면제(해금 유지) · 006 뒤 미완료 계정 = 미결 그대로
  if (fx.pool) {
    ok(JSON.stringify(fx.applied) === JSON.stringify(['006_singleplayer_progress.sql', '007_tutorial_categories.sql']),
      'S11 006 은 001~005 위에, 007 은 006 위에 추가로만 적용 ' + JSON.stringify(fx.applied));
    const ledger = (await fx.pool.query('SELECT version, checksum FROM schema_migrations ORDER BY version')).rows;
    ok(ledger.length === 7 && ledger.every((x, i) => x.checksum === fx.all[i].checksum), 'S11 원장 001~007 = 현재 파일 체크섬(001~006 불변)');
    ok((await fx.mig.missingSchema(fx.pool)).length === 0 && (await fx.mig.verify(fx.pool)).pending.length === 0, 'S11 기동 게이트(verify) · 필수 스키마 온전');
    r = await post('/api/auth/login', { userId: 'legacy_sp', password: 'legacy-pass-1' });
    const legacy = r.cookie;
    ok(r.status === 200 && progressIs(r, true, 0) && tutIs(r, 'exempt', 'exempt'), 'S11 기존(006 이전) 계정 로그인 = 해금 유지 · 면제/면제(완료 아님) ' + JSON.stringify(r.json));
    for (const [c, e] of [['basic', 'edge'], ['advanced', 'king'], ['advanced', 'skip']]) {
      r = await cat(legacy, 'legacy_sp', c, e);
      ok(r.status === 409 && r.json.error === 'E_TUTORIAL_CONFLICT' && tutIs(r, 'exempt', 'exempt'), `S11 면제 계정의 ${c} ${e} → 409 · 면제 유지(완료로 바꾸지 않음)`);
    }
    r = await tut(legacy, 'legacy_sp');
    ok(r.status === 200 && tutIs(r, 'exempt', 'exempt'), 'S11 면제 계정 전체 스킵 → 200 · 면제 그대로');
    r = await clr(legacy, 'legacy_sp', 1);
    ok(r.status === 200 && progressIs(r, true, 1), 'S11 면제 계정은 바로 브론즈 클리어 저장 가능(AI 진행 유지)');
    r = await post('/api/auth/login', { userId: 'pend_sp', password: 'pend-pass-1' });
    const pend = r.cookie;
    ok(r.status === 200 && progressIs(r, false, 0) && tutIs(r, 'pending', 'pending'), 'S11 006 뒤 미완료 계정 = 미결 그대로(면제 아님)');
    r = await clr(pend, 'pend_sp', 1);
    ok(r.status === 409 && r.json.error === 'E_TIER_LOCKED', 'S11 미결 계정 클리어 409');
    const t = (await fx.pool.query(`SELECT user_id, tutorial_basic, tutorial_basic_at, tutorial_advanced FROM accounts WHERE user_id IN ('legacy_sp', 'pend_sp')`)).rows;
    ok(t.length === 2 && t.every((x) => x.tutorial_basic === null && x.tutorial_basic_at === null && x.tutorial_advanced === null), 'S11 007 은 기존 행을 고치지 않는다(백필 UPDATE 없음) ' + JSON.stringify(t));
    // 롤백한 옛 서버(006 SQL)가 기본만 정한 계정에 완료를 쓴 경우 — 제약 위반 없이 저장되고 새 서버는 심화를 면제로 읽는다
    const lena = await signup('lena_sp');
    await cat(lena, 'lena_sp', 'basic', 'edge');
    await fx.pool.query(`UPDATE accounts SET tutorial_done_at = COALESCE(tutorial_done_at, now()) WHERE user_id = 'lena_sp'`);
    r = await session(lena);
    ok(tutIs(r, 'completed', 'exempt') && progressIs(r, true, 0), 'S11 옛 서버 v1 완료 쓰기(롤백 창) → 기본 완료 · 심화 면제 · 해금 ' + JSON.stringify(r.json));
    // DB 제약
    const rejects = async (sql, msg) => fx.pool.query(sql).then(() => ok(false, msg), (e) => ok(e.code === '23514', msg + ' ' + e.code));
    await rejects(`UPDATE accounts SET ai_cleared_tier = 4 WHERE user_id = 'carol_sp'`, 'S12 CHECK: 4단계 이상 저장 거부');
    await rejects(`UPDATE accounts SET tutorial_basic = 'done', tutorial_basic_at = now() WHERE user_id = 'pend_sp'`, 'S12 CHECK: 기본 종류 밖 값 거부');
    await rejects(`UPDATE accounts SET tutorial_basic = 'completed' WHERE user_id = 'pend_sp'`, 'S12 CHECK: 기본 종류만 있고 시각 없음 거부');
    await rejects(`UPDATE accounts SET tutorial_advanced = 'completed', tutorial_done_at = now() WHERE user_id = 'pend_sp'`, 'S12 CHECK: 기본 미결 심화 거부');
    const n = (await fx.pool.query('SELECT count(*)::int AS n FROM match_results')).rows[0].n;
    ok(n === 0, 'S12 match_results 0행(진행은 공식 전적이 아니다)');
  }

  // S13 로그인 진행 snapshot 경합(Saturn P2) — 비밀번호 검증 뒤 · 새 세션 발급 전에 원래 세션이 기본 완료·심화 스킵·브론즈를 저장한다.
  // 로그인 응답은 새 세션과 같은 최신 진행이어야 한다(검증 전 미결 아님).
  const erin = (await post('/api/auth/signup', { userId: 'erin_sp', nickname: '에린', password: 'erin-pass-1', email: 'e@example.com' })).cookie;
  const bar = holdBefore(store, 'loginSession');
  const pendLogin = post('/api/auth/login', { userId: 'erin_sp', password: 'erin-pass-1' });
  await bar.hit;
  r = await cat(erin, 'erin_sp', 'basic', 'edge');
  ok(r.status === 200 && tutIs(r, 'completed', 'pending'), 'S13 로그인 대기 중 원래 세션의 기본 완료 200');
  r = await cat(erin, 'erin_sp', 'advanced', 'skip');
  ok(r.status === 200 && tutIs(r, 'completed', 'skipped'), 'S13 로그인 대기 중 원래 세션의 심화 스킵 200');
  r = await clr(erin, 'erin_sp', 1);
  ok(r.status === 200 && progressIs(r, true, 1), 'S13 로그인 대기 중 원래 세션의 브론즈 저장 200');
  bar.release();
  const login = await pendLogin;
  ok(login.status === 200 && progressIs(login, true, 1) && tutIs(login, 'completed', 'skipped'), 'S13 새 로그인 응답 = 발급 시점 최신 진행 ' + JSON.stringify(login.json));
  r = await session(login.cookie);
  ok(r.status === 200 && JSON.stringify(r.json.progress) === JSON.stringify(login.json.progress), 'S13 새 세션 조회 = 로그인 응답 진행 ' + JSON.stringify(r.json));
  r = await tut(erin, 'erin_sp');
  ok(r.status === 401 && r.json.error === 'E_NO_SESSION', 'S13 단일 로그인 유지: 교체된 원래 세션 401');

  // S14 실제 Postgres 행 잠금 강제(실제 Postgres 만) — 다른 트랜잭션이 계정 행을 잡은 채 커밋 전이면 로그인·쓰기는 잠금을 기다리고,
  // 커밋된 최신 값으로 판정·응답한다(덮어쓰기·잃어버린 갱신 없음).
  if (fx.pool) {
    const fred = (await post('/api/auth/signup', { userId: 'fred_sp', nickname: '프레드', password: 'fred-pass-1', email: 'f@example.com' })).cookie;
    const FIRST = new Date('2001-02-03T04:05:06Z');
    let c = await fx.pool.connect();
    await c.query('BEGIN');
    await c.query(`UPDATE accounts SET tutorial_basic = 'completed', tutorial_basic_at = $1 WHERE user_id = 'fred_sp'`, [FIRST]);
    const pl = post('/api/auth/login', { userId: 'fred_sp', password: 'fred-pass-1' });
    const pt = cat(fred, 'fred_sp', 'basic', 'edge');
    const ps = cat(fred, 'fred_sp', 'basic', 'skip');
    ok(await lockWaiters(fx.pool, 3), 'S14 커밋 전 기본 완료 트랜잭션: 로그인 발급 · 기본 완료 · 기본 스킵 모두 행 잠금 대기');
    await c.query('COMMIT'); c.release();
    const [l, t, sk] = await Promise.all([pl, pt, ps]);
    ok(l.status === 200 && tutIs(l, 'completed', 'pending'), 'S14 잠금 뒤 로그인 응답 = 커밋된 기본 완료 ' + JSON.stringify(l.json));
    ok(t.status === 200 && tutIs(t, 'completed', 'pending'), 'S14 잠금 뒤 같은 종류 기본 완료 200(멱등)');
    ok(sk.status === 409 && sk.json.error === 'E_TUTORIAL_CONFLICT' && tutIs(sk, 'completed', 'pending'), 'S14 잠금 뒤 기본 스킵 → 409(커밋된 완료를 덮지 않음)');
    ok((await dbRow('fred_sp')).tutorial_basic_at.getTime() === FIRST.getTime(), 'S14 잠금 대기 뒤 쓰기도 처음 시각 유지');
    const fred2 = l.cookie;
    // 심화 완료 요청이 다른 트랜잭션(심화 스킵)의 행 잠금을 기다린 뒤 — 롤백이면 완료 저장, 커밋이면 스킵 유지 + 409
    for (const [end, want, status] of [['ROLLBACK', 'completed', 200], ['COMMIT', 'skipped', 409]]) {
      const u = end === 'ROLLBACK' ? 'fred_sp' : 'gus_sp';
      const ck = end === 'ROLLBACK' ? fred2 : await signup('gus_sp');
      if (end === 'COMMIT') await cat(ck, u, 'basic', 'edge');
      c = await fx.pool.connect();
      await c.query('BEGIN');
      await c.query(`UPDATE accounts SET tutorial_advanced = 'skipped', tutorial_done_at = $2 WHERE user_id = $1`, [u, FIRST]);
      const pa = cat(ck, u, 'advanced', 'king');
      ok(await lockWaiters(fx.pool, 1), `S14 ${end}: 심화 완료 요청이 심화 스킵 트랜잭션의 행 잠금 대기`);
      await c.query(end); c.release();
      r = await pa;
      ok(r.status === status && tutIs(r, 'completed', want), `S14 ${end} 뒤 심화 완료 → ${status} · ${want} ` + JSON.stringify([r.status, r.json]));
      await tutStays(ck, u, 'completed', want, `S14 ${end} 뒤 DB·세션 = 심화 ${want}`);
      if (end === 'COMMIT') ok((await dbRow(u)).tutorial_done_at.getTime() === FIRST.getTime(), 'S14 COMMIT 뒤 해금 시각 = 먼저 커밋된 값');
    }
    // 전체 스킵이 기본 완료 트랜잭션을 기다린 뒤 — 기본 완료를 덮지 않고 심화만 스킵
    const ck = await signup('hugo_sp');
    c = await fx.pool.connect();
    await c.query('BEGIN');
    await c.query(`UPDATE accounts SET tutorial_basic = 'completed', tutorial_basic_at = now() WHERE user_id = 'hugo_sp'`);
    const pa = tut(ck, 'hugo_sp');
    ok(await lockWaiters(fx.pool, 1), 'S14 전체 스킵이 기본 완료 트랜잭션의 행 잠금 대기');
    await c.query('COMMIT'); c.release();
    r = await pa;
    ok(r.status === 200 && tutIs(r, 'completed', 'skipped'), 'S14 잠금 뒤 전체 스킵 = 기본 완료 유지 · 심화만 스킵 ' + JSON.stringify(r.json));
  }

  await new Promise((res) => server.close(res));
  if (fx.pool) await fx.pool.end();
  console.log(`\n싱글 진행 저장: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
