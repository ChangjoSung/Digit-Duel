'use strict';
// v0.4.16 싱글 진행 저장(#324 튜토리얼 완료 · #322 무제한 AI 3단계 최고 클리어) — 서버 쪽 경계.
//   읽기: 가입·로그인·세션 응답의 progress. 쓰기: POST /api/profile/tutorial · /api/profile/ai-clear.
//   세션·CSRF·JSON · 입력/버전 검증 · 계정 일치 · 단조·멱등 · n+1 · 동시 요청 · 단일 로그인 교체 · DB 장애 503 · 공식 전적 무관 · DB 없는 서버.
// 저장소는 기본이 메모리 대역이고, DD_TEST_DATABASE_URL 이 있으면 실제 Postgres(pgStore + 001~006)로 같은 검사를 돌고
// 006 이관(기존 계정 = 튜토리얼 완료 간주 · 클리어 0)까지 본다(그 DB 의 표를 지운다 — 전용 테스트 DB 에만).
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
  const prog = (a) => ({ tutorial_done: a.tutorial_done_at != null, ai_cleared_tier: a.ai_cleared_tier });
  const addSess = (a, sess) => sessions.set(sess.hash, { account_id: a.id, expires: Date.now() + sess.ttlMs, lgen: a.login_gen });
  return {
    setDown(v) { down = v; },
    async createAccount({ userId, nickname, email, passwordHash }, sess) {
      guard();
      if ([...accts.values()].some((a) => a.user_id === userId)) return { taken: 'userId' };
      const a = { id: String(++seq), user_id: userId, nickname, email, password_hash: passwordHash, credential_gen: 0, login_gen: 0, tutorial_done_at: null, ai_cleared_tier: 0 };
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
    async completeTutorial(id) {
      guard();
      const a = accts.get(String(id));
      if (!a) return null;
      if (a.tutorial_done_at == null) a.tutorial_done_at = new Date();
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
  // 006 이전 DB 에 계정이 있는 상태를 만든 뒤 006 을 적용한다(기존 계정 이관).
  await mig.up(pool, all.filter((m) => m.version < '006'));
  await pool.query(`INSERT INTO accounts (user_id, nickname, password_hash, email, email_norm) VALUES ('legacy_sp', '옛계정', $1, 'l@example.com', 'l@example.com')`,
    [await A.hashSecret('legacy-pass-1')]);
  const applied = await mig.up(pool, all);
  let down = false;
  const query = (t, p) => (down ? Promise.reject(Object.assign(new Error('down'), { code: 'ECONNREFUSED' })) : pool.query(t, p));
  return { store: Object.assign(A.pgStore(query), { setDown(v) { down = v; } }), pool, applied };
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
const P = (tutorialDone, aiClearedTier) => JSON.stringify({ tutorialDone, aiClearedTier });
const progressIs = (r, t, n) => JSON.stringify(r.json && r.json.progress) === P(t, n);
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
  console.log(`싱글 진행 — 저장소: ${pgUrl ? '실제 Postgres(pgStore · 001~006)' : '메모리 대역'}`);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;

  useAccounts(null);
  for (const p of ['/api/profile/tutorial', '/api/profile/ai-clear']) {
    const r = await post(p, { v: 1, userId: 'x', end: 'skip', tier: 1 });
    ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_DISABLED', `S0 DB 없는 서버: ${p} 503 E_ACCOUNTS_DISABLED`);
  }

  const accounts = A.createAccounts(store, null, null);
  useAccounts(accounts);
  const TUT = '/api/profile/tutorial', CLR = '/api/profile/ai-clear';
  const tut = (cookie, userId, body) => post(TUT, Object.assign({ v: 1, userId, end: 'skip' }, body), { cookie });
  const clr = (cookie, userId, tier, body) => post(CLR, Object.assign({ v: 1, userId, tier, end: 'king' }, body), { cookie });
  const session = (cookie) => req('GET', '/api/auth/session', { cookie });
  // 거부 직후 그 계정의 저장값이 그대로인지(세션 재조회 + 실제 Postgres 면 DB 행까지).
  const dbRow = async (u) => fx.pool && (await fx.pool.query(`SELECT tutorial_done_at, ai_cleared_tier FROM accounts WHERE user_id = $1`, [u])).rows[0];
  const unchanged = async (cookie, u, t, n, msg) => {
    const s = await session(cookie), d = await dbRow(u);
    ok(s.status === 200 && progressIs(s, t, n) && (!d || ((d.tutorial_done_at != null) === t && d.ai_cleared_tier === n)),
      msg + ' — 저장 0 ' + JSON.stringify([s.json && s.json.progress, d]));
  };

  // 새 계정 = 미완료 · 0 — 가입·세션·로그인 응답 모두
  let r = await post('/api/auth/signup', { userId: 'alice_sp', nickname: '앨리스', password: 'alice-pass-1', email: 'a@example.com' });
  let alice = r.cookie;
  ok(r.status === 201 && progressIs(r, false, 0) && r.json.userId === 'alice_sp', 'S1 가입 201 · progress 미완료/0 ' + JSON.stringify(r.json));
  r = await session(alice);
  ok(r.status === 200 && progressIs(r, false, 0) && r.json.hasEmail === true, 'S1 세션 복원 · progress 미완료/0');
  const bob = (await post('/api/auth/signup', { userId: 'bob_00sp', nickname: '밥돌', password: 'bobby-pass-1', email: 'b@example.com' })).cookie;

  // 경계 — 세션 · CSRF · JSON
  r = await tut(null, 'alice_sp');
  ok(r.status === 401 && r.json.error === 'E_NO_SESSION', 'S2 세션 없음 → 401');
  r = await clr(null, 'alice_sp', 1);
  ok(r.status === 401 && r.json.error === 'E_NO_SESSION', 'S2 세션 없음(ai-clear) → 401');
  r = await post(TUT, { v: 1, userId: 'alice_sp', end: 'skip' }, { cookie: alice, origin: false });
  ok(r.status === 403 && r.json.error === 'E_BAD_ORIGIN', 'S2 Origin 없는 POST 403');
  r = await post(CLR, { v: 1, userId: 'alice_sp', tier: 1, end: 'king' }, { cookie: alice, type: 'text/plain' });
  ok(r.status === 415, 'S2 JSON 아닌 본문 415');
  r = await req('GET', TUT, { cookie: alice });
  ok(r.status === 405, 'S2 GET /api/profile/tutorial → 405(쓰기 전용)');

  // 입력·버전 검증 — 저장 0
  for (const bad of [{ v: 2 }, { v: '1' }, { v: undefined }, { end: 'resign' }, { end: 'draw' }, { end: '' }, { end: undefined }, { end: ['skip'] }]) {
    r = await tut(alice, 'alice_sp', bad);
    ok(r.status === 400 && r.json.error === 'E_BAD_INPUT', 'S3 tutorial 형식 밖 400: ' + JSON.stringify(bad));
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
  r = await clr(bob, 'alice_sp', 1);
  ok(r.status === 409 && r.json.error === 'E_ACCOUNT_MISMATCH', 'S4 ai-clear 계정 불일치 409');
  await unchanged(alice, 'alice_sp', false, 0, 'S2~S4 거부(401·403·415·405·400·409) 뒤 앨리스 미완료/0');
  await unchanged(bob, 'bob_00sp', false, 0, 'S4 계정 불일치 거부 뒤 밥돌 미완료/0');
  r = await tut(alice, 'ALICE_SP ');
  ok(r.status === 200 && progressIs(r, true, 0), 'S4 같은 아이디(대소문자·공백 정규화)는 일치 → 완료 ' + JSON.stringify(r.json));
  const aliceDoneAt = fx.pool && (await dbRow('alice_sp')).tutorial_done_at.getTime();
  r = await session(bob);
  ok(progressIs(r, false, 0), 'S4 다른 계정(밥돌) 진행은 그대로 미완료/0');

  // 튜토리얼 미완료 계정의 클리어는 잠김
  r = await clr(bob, 'bob_00sp', 1);
  ok(r.status === 409 && r.json.error === 'E_TIER_LOCKED' && progressIs(r, false, 0), 'S5 튜토리얼 미완료 → 브론즈 클리어 409 E_TIER_LOCKED');
  await unchanged(bob, 'bob_00sp', false, 0, 'S5 E_TIER_LOCKED 뒤 밥돌 미완료/0');
  // 승·패 정상 종료도 완료(승리 강제 없음) · 멱등
  r = await tut(bob, 'bob_00sp', { end: 'edge' });
  ok(r.status === 200 && progressIs(r, true, 0), 'S5 정상 종료(edge) 완료 200');
  r = await tut(bob, 'bob_00sp', { end: 'skip' });
  ok(r.status === 200 && progressIs(r, true, 0), 'S5 완료 재전송 200 · 같은 결과(멱등)');
  r = await tut(alice, 'alice_sp', { end: 'wipe' });
  ok(r.status === 200 && progressIs(r, true, 0), 'S5 앨리스 완료 재전송 200');
  if (fx.pool) ok((await dbRow('alice_sp')).tutorial_done_at.getTime() === aliceDoneAt, 'S5 재전송이 최초 완료 시각을 바꾸지 않는다(COALESCE)');

  // n+1 · 단조
  r = await clr(alice, 'alice_sp', 2);
  ok(r.status === 409 && r.json.error === 'E_TIER_LOCKED' && progressIs(r, true, 0), 'S6 브론즈 전 실버 → 409 · 저장 0');
  await unchanged(alice, 'alice_sp', true, 0, 'S6 건너뛴 실버 거부 뒤 앨리스 완료/0');
  r = await clr(alice, 'alice_sp', 1, { end: 'wipe' });
  ok(r.status === 200 && progressIs(r, true, 1), 'S6 브론즈 클리어 → 1');
  r = await clr(alice, 'alice_sp', 1);
  ok(r.status === 200 && progressIs(r, true, 1), 'S6 브론즈 재클리어(중복) 200 · 1 유지');
  r = await clr(alice, 'alice_sp', 3);
  ok(r.status === 409 && progressIs(r, true, 1), 'S6 실버 전 골드 → 409');
  r = await clr(alice, 'alice_sp', 2, { end: 'edge' });
  ok(r.status === 200 && progressIs(r, true, 2), 'S6 실버 클리어 → 2');
  r = await clr(alice, 'alice_sp', 1);
  ok(r.status === 200 && progressIs(r, true, 2), 'S6 낮은 단계 재도전 승리 200 · 2 유지(내려가지 않음)');
  r = await clr(alice, 'alice_sp', 3);
  ok(r.status === 200 && progressIs(r, true, 3), 'S6 골드 클리어 → 3');
  r = await clr(alice, 'alice_sp', 3);
  ok(r.status === 200 && progressIs(r, true, 3), 'S6 골드 재클리어 200 · 3 유지(미구현 단계를 열지 않음)');
  r = await session(alice);
  ok(progressIs(r, true, 3), 'S6 서버 재조회(세션) = 3');
  r = await req('GET', '/api/profile', { cookie: alice });
  ok(r.status === 200 && r.json.stats.wins === 0 && r.json.stats.losses === 0 && r.json.matches.length === 0 && !('progress' in r.json),
    'S7 진행 쓰기는 공식 전적·최근 경기에 0건 ' + JSON.stringify(r.json));

  // 다른 기기 로그인 — 다시 로그인한 응답에 서버 진행 · 옛 세션의 쓰기는 401
  r = await post('/api/auth/login', { userId: 'alice_sp', password: 'alice-pass-1' });
  const alice2 = r.cookie;
  ok(r.status === 200 && progressIs(r, true, 3), 'S8 다른 기기 로그인 응답 progress 유지(기기 간)');
  r = await tut(alice, 'alice_sp');
  ok(r.status === 401 && r.json.error === 'E_NO_SESSION', 'S8 교체된 옛 세션의 완료 요청 401');
  r = await clr(alice, 'alice_sp', 1);
  ok(r.status === 401, 'S8 교체된 옛 세션의 클리어 요청 401');
  alice = alice2;

  // 동시 요청 — 새 계정에서 완료·브론즈 묶음, 그다음 실버·골드 경합
  const carol = (await post('/api/auth/signup', { userId: 'carol_sp', nickname: '캐롤', password: 'carol-pass-1', email: 'c@example.com' })).cookie;
  let burst = await Promise.all(Array.from({ length: 6 }, (_, i) => tut(carol, 'carol_sp', { end: i % 2 ? 'skip' : 'king' })));
  ok(burst.every((x) => x.status === 200 && progressIs(x, true, 0)), 'S9 동시 완료 6건 모두 200 · 같은 결과');
  burst = await Promise.all(Array.from({ length: 6 }, () => clr(carol, 'carol_sp', 1)));
  ok(burst.every((x) => x.status === 200 && x.json.progress.aiClearedTier === 1), 'S9 동시 브론즈 6건 모두 200 · 1');
  burst = await Promise.all([clr(carol, 'carol_sp', 3), clr(carol, 'carol_sp', 2), clr(carol, 'carol_sp', 3), clr(carol, 'carol_sp', 2)]);
  const gold = burst.filter((x, i) => i % 2 === 0), silver = burst.filter((x, i) => i % 2 === 1);
  r = await session(carol);
  const fin = r.json.progress.aiClearedTier;
  ok(silver.every((x) => x.status === 200) && gold.every((x) => x.status === 200 || x.json.error === 'E_TIER_LOCKED')
    && fin === (gold.some((x) => x.status === 200) ? 3 : 2) && burst.every((x) => x.json.progress.aiClearedTier <= fin),
  `S9 실버·골드 경합: 골드는 실버 커밋 뒤에만 · 최종 ${fin} ` + JSON.stringify(burst.map((x) => [x.status, x.json.progress])));

  // DB 장애 — 성공한 척하지 않는다(503), 복구 뒤 재조회 → 같은 요청 재시도로 저장
  const dave = (await post('/api/auth/signup', { userId: 'dave_sp', nickname: '데이브', password: 'dave-pass-1', email: 'd@example.com' })).cookie;
  store.setDown(true);
  r = await tut(dave, 'dave_sp');
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE' && !/10\.0\.0\.5|ECONN/.test(JSON.stringify(r.json)), 'S10 DB 장애: 완료 503(원문 없음)');
  r = await session(dave);
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'S10 DB 장애 중 세션 조회 503(미완료 200 으로 대체하지 않음)');
  store.setDown(false);
  r = await session(dave);
  ok(r.status === 200 && progressIs(r, false, 0), 'S10 복구 뒤 재조회: 저장 안 됨(미완료)');
  failOnce(store, 'completeTutorial', true);
  r = await tut(dave, 'dave_sp');
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'S10 튜토리얼 커밋 후 응답 유실 → 503(성공 여부 불명)');
  r = await session(dave);
  ok(r.status === 200 && progressIs(r, true, 0), 'S10 커밋 후 유실: 재조회로 완료 확인');
  r = await tut(dave, 'dave_sp');
  ok(r.status === 200 && progressIs(r, true, 0), 'S10 같은 요청 재시도 200 · 같은 결과(멱등)');
  // 세션 조회는 성공하고 **쓰기 단계**에서 실패 — 저장 0 · 503
  failOnce(store, 'clearAiTier', false);
  r = await clr(dave, 'dave_sp', 1);
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'S10 쓰기 단계 실패(인증 조회 성공 뒤) 503');
  await unchanged(dave, 'dave_sp', true, 0, 'S10 쓰기 단계 실패 뒤 재조회 완료/0');
  // 커밋된 뒤 응답 유실 — 503 이지만 재조회하면 저장돼 있고, 같은 요청 재시도는 멱등 200
  failOnce(store, 'clearAiTier', true);
  r = await clr(dave, 'dave_sp', 1);
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'S10 커밋 후 응답 유실 → 503(성공 여부 불명)');
  r = await session(dave);
  ok(r.status === 200 && progressIs(r, true, 1), 'S10 커밋 후 유실: 재조회로 저장 확인 1');
  r = await clr(dave, 'dave_sp', 1);
  ok(r.status === 200 && progressIs(r, true, 1), 'S10 커밋 후 유실: 같은 요청 재시도 200 · 1 유지(중복 없음)');

  // 006 이관 — 기존 계정 완료 간주 · 클리어 0 (실제 Postgres 만)
  if (fx.pool) {
    ok(fx.applied.length === 1 && fx.applied[0] === '006_singleplayer_progress.sql', 'S11 006 은 001~005 위에 추가로만 적용 ' + JSON.stringify(fx.applied));
    r = await post('/api/auth/login', { userId: 'legacy_sp', password: 'legacy-pass-1' });
    ok(r.status === 200 && progressIs(r, true, 0), 'S11 기존 계정 로그인 = 튜토리얼 완료 · 클리어 0 ' + JSON.stringify(r.json));
    r = await clr(r.cookie, 'legacy_sp', 1);
    ok(r.status === 200 && progressIs(r, true, 1), 'S11 기존 계정은 바로 브론즈 클리어 저장 가능');
    const t = (await fx.pool.query(`SELECT user_id, tutorial_done_at IS NOT NULL AS done, ai_cleared_tier FROM accounts ORDER BY id`)).rows;
    ok(t.length === 5 && t.filter((x) => x.done).length === 5 && t.find((x) => x.user_id === 'bob_00sp').ai_cleared_tier === 0,
      'S11 DB 행: 모든 계정 완료 · 밥돌 0 ' + JSON.stringify(t));
    await fx.pool.query(`UPDATE accounts SET ai_cleared_tier = 4 WHERE user_id = 'carol_sp'`).then(
      () => ok(false, 'S12 CHECK 가 4단계 저장을 막아야 한다'), (e) => ok(e.code === '23514', 'S12 DB CHECK: 4단계 이상 저장 거부 ' + e.code));
    const n = (await fx.pool.query('SELECT count(*)::int AS n FROM match_results')).rows[0].n;
    ok(n === 0, 'S12 match_results 0행(진행은 공식 전적이 아니다)');
  }

  // S13 로그인 진행 snapshot 경합(Saturn P2) — 비밀번호 검증(findAccount·scrypt) 뒤 · 새 세션 발급(loginSession) 전에
  // 아직 유효한 원래 세션이 튜토리얼 스킵·브론즈를 저장한다. 로그인 응답은 새 세션과 같은 최신 진행이어야 한다(검증 전 false/0 아님).
  const erin = (await post('/api/auth/signup', { userId: 'erin_sp', nickname: '에린', password: 'erin-pass-1', email: 'e@example.com' })).cookie;
  const bar = holdBefore(store, 'loginSession');
  const pendLogin = post('/api/auth/login', { userId: 'erin_sp', password: 'erin-pass-1' });
  await bar.hit;
  r = await tut(erin, 'erin_sp');
  ok(r.status === 200 && progressIs(r, true, 0), 'S13 로그인 대기 중 원래 세션의 스킵 저장 200');
  r = await clr(erin, 'erin_sp', 1);
  ok(r.status === 200 && progressIs(r, true, 1), 'S13 로그인 대기 중 원래 세션의 브론즈 저장 200');
  bar.release();
  const login = await pendLogin;
  ok(login.status === 200 && progressIs(login, true, 1), 'S13 새 로그인 응답 = 발급 시점 최신 진행 완료/1 ' + JSON.stringify(login.json));
  r = await session(login.cookie);
  ok(r.status === 200 && JSON.stringify(r.json.progress) === JSON.stringify(login.json.progress), 'S13 새 세션 조회 = 로그인 응답 진행 ' + JSON.stringify(r.json));
  r = await tut(erin, 'erin_sp');
  ok(r.status === 401 && r.json.error === 'E_NO_SESSION', 'S13 단일 로그인 유지: 교체된 원래 세션 401');

  // S14 실제 Postgres 행 잠금 강제(실제 Postgres 만) — 다른 트랜잭션이 계정 행을 잡은 채 커밋 전이면 로그인·쓰기는 잠금을 기다리고,
  // 커밋된 최신 값으로 판정·응답한다.
  if (fx.pool) {
    const fred = (await post('/api/auth/signup', { userId: 'fred_sp', nickname: '프레드', password: 'fred-pass-1', email: 'f@example.com' })).cookie;
    const FIRST = new Date('2001-02-03T04:05:06Z');
    let c = await fx.pool.connect();
    await c.query('BEGIN');
    await c.query(`UPDATE accounts SET tutorial_done_at = COALESCE(tutorial_done_at, $1) WHERE user_id = 'fred_sp'`, [FIRST]);
    const pl = post('/api/auth/login', { userId: 'fred_sp', password: 'fred-pass-1' });
    const pt = tut(fred, 'fred_sp');
    ok(await lockWaiters(fx.pool, 2), 'S14 커밋 전 진행 트랜잭션: 로그인 발급 UPDATE · 튜토리얼 UPDATE 모두 행 잠금 대기');
    await c.query('COMMIT'); c.release();
    const [l, t] = await Promise.all([pl, pt]);
    ok(l.status === 200 && progressIs(l, true, 0), 'S14 잠금 뒤 로그인 응답 = 커밋된 완료 ' + JSON.stringify(l.json));
    ok(t.status === 200 && progressIs(t, true, 0), 'S14 잠금 뒤 튜토리얼 저장 200(멱등)');
    ok((await dbRow('fred_sp')).tutorial_done_at.getTime() === FIRST.getTime(), 'S14 잠금 대기 뒤 쓰기도 최초 완료 시각 유지(COALESCE)');
    const fred2 = l.cookie;
    ok((await clr(fred2, 'fred_sp', 1)).status === 200, 'S14 브론즈 1');
    // 실버 요청이 다른 트랜잭션(골드 쓰기)의 행 잠금을 기다린 뒤 — 롤백이면 실버 저장, 커밋이면 골드 유지(실버로 덮어 역행하지 않음)
    for (const [end, want] of [['ROLLBACK', 2], ['COMMIT', 3]]) {
      c = await fx.pool.connect();
      await c.query('BEGIN');
      await c.query(`UPDATE accounts SET ai_cleared_tier = 3 WHERE user_id = 'fred_sp'`);
      const pg = clr(fred2, 'fred_sp', 2);
      ok(await lockWaiters(fx.pool, 1), `S14 ${end}: 실버 요청이 골드 트랜잭션의 행 잠금 대기`);
      await c.query(end); c.release();
      r = await pg;
      ok(r.status === 200 && progressIs(r, true, want), `S14 ${end} 뒤 실버 → 200 · ${want} ` + JSON.stringify([r.status, r.json]));
      await unchanged(fred2, 'fred_sp', true, want, `S14 ${end} 뒤 DB·세션 = ${want}`);
    }
  }

  await new Promise((res) => server.close(res));
  if (fx.pool) await fx.pool.end();
  console.log(`\n싱글 진행 저장: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
