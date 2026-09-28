// #264 DB 연결·마이그레이션 회귀 — **살아 있는 Postgres 없이** 돌아간다.
//
// 여기서 검증하는 것:
//   1. DSN 정책 — 인터넷을 건너는 연결의 TLS 강등을 거부하고, 내부/루프백은 평문을 허용한다.
//   2. 마이그레이션 러너 — 순서·1회성(멱등)·트랜잭션·체크섬 불일치·미지 버전에서의 중단.
//   3. fail-closed 런타임 — DATABASE_URL 없이 query() 는 throw 한다(빈 결과로 대체하지 않는다).
//   4. fail-closed 기동 — 닿지 않는 DATABASE_URL 이면 서버가 listen 하지 않고 exit != 0,
//      DATABASE_URL 이 없으면 기존처럼 뜨고 /readyz 가 200 "ok (no db)".
//
// 실제 Postgres 왕복(연결·pg_dump·복원)은 이 세션에 DB·psql·docker 가 없어 검증하지 못했다 —
// 절차는 docs/milestone/v0.4.11/issues/264/Jupiter/report.md 에 적었고 CI 게이트로 넣지 않았다.
const assert = require('assert');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const db = require('./db');
const mig = require('./db-migrate');

let failures = 0;
function check(label, fn) {
  try { fn(); console.log('  ok  ', label); }
  catch (e) { failures += 1; console.error('  FAIL', label, '—', e.message); }
}
async function checkAsync(label, fn) {
  try { await fn(); console.log('  ok  ', label); }
  catch (e) { failures += 1; console.error('  FAIL', label, '—', e.message); }
}
const section = (name) => console.log('-', name);

/* ===== 1. DSN·TLS 정책 ===== */

section('DSN·TLS 정책 (dbConfig)');
const ENV = {}; // DD_DB_CA_CERT 미설정 기준

check('외부 호스트 기본 = TLS 검증 on', () => {
  const c = db.dbConfig('postgres://u:p@dpg-x-a.singapore-postgres.render.com/dd', ENV);
  assert.strictEqual(c.ok, true);
  assert.deepStrictEqual(c.config.ssl, { rejectUnauthorized: true });
  assert.strictEqual(c.internal, false);
});
check('외부 호스트 + sslmode=disable = 거부(기동 차단)', () => {
  const c = db.dbConfig('postgres://u:p@db.example.com/dd?sslmode=disable', ENV);
  assert.deepStrictEqual(c, { ok: false, reason: 'ssl_downgrade' });
});
check('외부 호스트 + sslmode=no-verify = 거부 (libpq 에 없는 pg 전용 값 — bad_sslmode)', () => {
  assert.strictEqual(db.dbConfig('postgres://u:p@db.example.com/dd?sslmode=no-verify', ENV).reason, 'bad_sslmode');
});
check('외부 호스트 + sslmode=verify-full = 검증 on', () => {
  const c = db.dbConfig('postgres://u:p@db.example.com/dd?sslmode=verify-full', ENV);
  assert.deepStrictEqual(c.config.ssl, { rejectUnauthorized: true });
});
check('Render 내부 호스트(점 없음) = 평문 허용', () => {
  const c = db.dbConfig('postgres://u:p@dpg-abc123-a:5432/dd', ENV);
  assert.strictEqual(c.ok, true);
  assert.strictEqual(c.config.ssl, false);
  assert.strictEqual(c.internal, true);
});
check('내부 호스트 + sslmode=require = 암호화 on (조용히 평문으로 내려가지 않는다)', () => {
  // Render 공식 문서: 내부 연결도 TLS 를 받아들이지만 인증서가 self-signed 다.
  // require 를 평문으로 처리하면 요청한 암호화가 조용히 사라진다.
  const c = db.dbConfig('postgres://u:p@dpg-abc-a/dd?sslmode=require', ENV);
  assert.deepStrictEqual(c.config.ssl, { rejectUnauthorized: false });
  assert.strictEqual(c.tls, true);
  assert.strictEqual(c.verified, false);
  assert.ok(c.note && /미검증/.test(c.note), `상황 표시 없음: ${c.note}`);
});
check('내부 호스트 + sslmode=require + CA 지정 = 검증까지 on', () => {
  const c = db.dbConfig('postgres://u:p@dpg-abc-a/dd?sslmode=require', { DD_DB_CA_CERT: __filename });
  assert.strictEqual(c.config.ssl.rejectUnauthorized, true);
  assert.ok(c.config.ssl.ca, 'CA 를 실어야 한다');
  assert.strictEqual(c.verified, true);
});
check('describe() 가 미검증 TLS 를 숨기지 않는다', () => {
  const line = db.describe({ DATABASE_URL: 'postgres://u:p@dpg-abc-a/dd?sslmode=require' });
  assert.ok(/미검증/.test(line), line);
});
check('내부 호스트도 sslmode=verify-full 이면 검증 on', () => {
  assert.deepStrictEqual(db.dbConfig('postgres://u:p@dpg-abc-a/dd?sslmode=verify-full', ENV).config.ssl, { rejectUnauthorized: true });
});
check('루프백 = 평문 허용', () => {
  assert.strictEqual(db.dbConfig('postgres://u:p@127.0.0.1:5432/dd', ENV).config.ssl, false);
});
check('공인 IPv6 리터럴 = 외부 — TLS 검증 on, 괄호를 벗겨 pg 에 넘긴다 (Saturn REVISE)', () => {
  // "점이 없으면 내부" 판정은 [2001:4860:4860::8888] 을 평문 내부로 보냈다.
  const c = db.dbConfig('postgres://u:p@[2001:4860:4860::8888]:5432/dd', ENV);
  assert.strictEqual(c.ok, true);
  assert.strictEqual(c.internal, false);
  assert.deepStrictEqual(c.config.ssl, { rejectUnauthorized: true });
  assert.strictEqual(c.config.host, '2001:4860:4860::8888');
  for (const mode of ['disable', 'prefer', 'allow']) {
    assert.strictEqual(db.dbConfig(`postgres://u:p@[2001:4860:4860::8888]/dd?sslmode=${mode}`, ENV).reason, 'ssl_downgrade', mode);
  }
});
check('IPv6 루프백 [::1] 만 내부로 본다', () => {
  const c = db.dbConfig('postgres://u:p@[::1]/dd', ENV);
  assert.strictEqual(c.internal, true);
  assert.strictEqual(c.config.host, '::1');
  assert.strictEqual(db.dbConfig('postgres://u:p@[fd00::5]/dd', ENV).internal, false, '사설 IPv6 도 검증 대상');
});
check('IPv4 리터럴(사설 포함)은 외부 — 검증 on', () => {
  for (const h of ['8.8.8.8', '10.0.0.5']) assert.deepStrictEqual(db.dbConfig(`postgres://u:p@${h}/dd`, ENV).config.ssl, { rejectUnauthorized: true }, h);
});
check('분류할 수 없는 호스트는 거부 (bad_host) — resolver 가 IPv4 로 읽는 한 단어 숫자 포함', () => {
  for (const h of ['0x08080808', '134744072', '0177.1', '1.2.3', '8.8.8.0x8', 'dpg%2Dx', 'a_b', '-bad', 'bad-', 'x..y']) {
    assert.strictEqual(db.dbConfig(`postgres://u:p@${h}/dd`, ENV).reason, 'bad_host', h);
  }
});
check('오타·모르는·중복 sslmode 는 내부든 외부든 거부 — 조용히 평문이 되지 않는다 (Saturn REVISE 2)', () => {
  for (const host of ['dpg-abc123-a', 'localhost', 'db.example.com']) {
    for (const q of ['sslmode=requre', 'sslmode=verify', 'sslmode=verifyfull', 'sslmode=no-verify', 'sslmode=', 'sslmode=require&sslmode=disable']) {
      assert.strictEqual(db.dbConfig(`postgres://u:p@${host}/dd?${q}`, ENV).reason, 'bad_sslmode', `${host} ?${q}`);
    }
  }
  assert.strictEqual(db.dbConfig('postgres://u:p@dpg-abc123-a/dd?sslmode=REQUIRE', ENV).tls, true, '대소문자는 libpq 처럼 무시');
});
check('내부 호스트 + sslmode=prefer = 암호화 on (평문으로 깎지 않는다)', () => {
  const c = db.dbConfig('postgres://u:p@dpg-abc123-a/dd?sslmode=prefer', ENV);
  assert.deepStrictEqual(c.config.ssl, { rejectUnauthorized: false });
  assert.ok(/미검증/.test(c.note), c.note);
});
check('평문 내부는 근거 있는 형태만 — 다른 한 단어 이름은 거부 (Saturn REVISE 2)', () => {
  for (const h of ['db', 'postgres', 'intranet', 'dpg', 'dpg-abc', 'dpg-abc-b', 'xdpg-abc-a', 'dpg-ab_c-a']) {
    assert.strictEqual(db.dbConfig(`postgres://u:p@${h}/dd`, ENV).reason, 'bad_host', h);
  }
  assert.strictEqual(db.classifyHost('DPG-ABC123-A').kind, 'internal', '호스트는 대소문자 무시');
  assert.strictEqual(db.classifyHost('dpg-abc123-a.oregon-postgres.render.com').kind, 'external', '같은 DB 의 외부 주소는 검증 대상');
});
check('깨진 퍼센트 이스케이프·URL 파싱 오류 = malformed, 예외를 던지지 않는다', () => {
  for (const dsn of ['postgres://u:p%zz@db.example.com/dd', 'postgres://u%E0%A4%A@db.example.com/dd', 'postgres://u:p@db.example.com/d%ZZ', 'postgres://u:p@db.example.com:99999/dd', 'postgres://u:p@[::1/dd']) {
    assert.deepStrictEqual(db.dbConfig(dsn, ENV), { ok: false, reason: 'malformed' }, dsn);
    const line = db.describe({ DATABASE_URL: dsn });
    assert.ok(/malformed/.test(line) && !line.includes('p%zz') && !line.includes('db.example.com'), line);
  }
});
check('스킴·DB 이름·형식 오류는 각각의 사유로 거부', () => {
  assert.strictEqual(db.dbConfig('mysql://u:p@h/dd', ENV).reason, 'bad_scheme');
  assert.strictEqual(db.dbConfig('postgres://u:p@h.example.com/', ENV).reason, 'no_database');
  assert.strictEqual(db.dbConfig('not a url', ENV).reason, 'malformed');
  assert.strictEqual(db.dbConfig('', ENV).reason, 'absent');
  assert.strictEqual(db.dbConfig(null, ENV).reason, 'absent');
});
check('CA 파일을 못 읽으면 거부(조용히 시스템 CA 로 내려가지 않는다)', () => {
  const c = db.dbConfig('postgres://u:p@db.example.com/dd', { DD_DB_CA_CERT: path.join(__dirname, 'no-such-ca.pem') });
  assert.strictEqual(c.reason, 'ca_unreadable');
});
check('퍼센트 인코딩된 사용자·비밀번호를 디코드한다', () => {
  const c = db.dbConfig('postgres://us%40er:p%40ss%2F1@db.example.com/dd', ENV);
  assert.strictEqual(c.config.user, 'us@er');
  assert.strictEqual(c.config.password, 'p@ss/1');
});
check('pg 를 최상위에서 require 하지 않는다 (ws 만 깔린 기존 로컬 설치 보호)', () => {
  // 원클릭 실행기는 `if not exist node_modules` 만 보고 설치를 건너뛴다 — 최상위 require 면
  // pg 추가 전에 설치한 사용자의 오프라인·LAN 실행이 MODULE_NOT_FOUND 로 죽는다.
  assert.ok(!Object.keys(require.cache).some((f) => f.includes(`${path.sep}node_modules${path.sep}pg${path.sep}`)),
    'db.js·db-migrate.js 를 require 한 것만으로 pg 가 로드됐다');
});
check('describe() 는 호스트·사용자·비밀번호를 흘리지 않는다', () => {
  const line = db.describe({ DATABASE_URL: 'postgres://user1:secret@db.example.com/dd' });
  for (const leak of ['secret', 'user1', 'db.example.com', 'dd']) assert.ok(!line.includes(leak), `누출: ${leak} in "${line}"`);
  assert.ok(line.includes('TLS'));
});

// 최상위 await 는 CommonJS 에서 쓸 수 없다 — 아래 비동기 구간은 main() 안이다.
async function main() {
/* ===== 2. 마이그레이션 러너 (가짜 client) ===== */

section('마이그레이션 러너');

// 진짜 Postgres 대신 최소 원장과 **세션 단위 advisory lock** 을 흉내내는 가짜 풀.
// 실제 SQL 을 해석하지는 않지만, 러너가 내는 명령의 순서·트랜잭션·원장 효과를 관찰하고
// **잠금을 쥔 연결에서만 원장을 만지는지**를 강제한다 — Pool.query 로 잠그면(연결이 매번
// 달라진다) 여기서 바로 실패한다. pg 의 advisory lock 은 세션(연결) 단위다.
function fakePool(opts) {
  opts = opts || {};
  const state = {
    ledger: (opts.ledger || []).slice(),
    present: !!(opts.ledger && opts.ledger.length),
    log: [],
    lockedBy: null,
    waiters: [],
    released: 0,
    connections: 0,
  };
  let nextId = 0;

  function needsLock(id, sql) {
    if (state.lockedBy === null || state.lockedBy === id) return;
    throw new Error(`잠금을 쥔 연결(${state.lockedBy}) 이 아닌 연결(${id}) 이 원장을 만졌다: ${sql}`);
  }

  function makeClient() {
    const id = (nextId += 1);
    state.connections += 1;
    return {
      id,
      release() { state.released += 1; },
      query(text, params) {
        const sql = String(text).trim().replace(/\s+/g, ' ');
        state.log.push({ id, sql: sql.slice(0, 60) });
        if (/pg_advisory_lock/.test(sql)) {
          if (state.lockedBy === null) { state.lockedBy = id; return Promise.resolve({ rows: [] }); }
          return new Promise((resolve) => state.waiters.push(() => { state.lockedBy = id; resolve({ rows: [] }); }));
        }
        if (/pg_advisory_unlock/.test(sql)) {
          state.lockedBy = null;
          const next = state.waiters.shift();
          if (next) next();
          return Promise.resolve({ rows: [] });
        }
        if (/to_regclass/.test(sql)) return Promise.resolve({ rows: [{ present: state.present }] });
        if (/^create table if not exists schema_migrations/i.test(sql)) {
          needsLock(id, sql); state.present = true; return Promise.resolve({ rows: [] });
        }
        if (/^select version, name, checksum from schema_migrations/.test(sql)) {
          needsLock(id, sql);
          return Promise.resolve({ rows: state.ledger.slice().sort((a, b) => a.version.localeCompare(b.version)) });
        }
        if (/^insert into schema_migrations/.test(sql)) {
          needsLock(id, sql);
          if (state.ledger.some((r) => r.version === params[0])) {
            return Promise.reject(Object.assign(new Error('duplicate key'), { code: '23505' }));
          }
          state.ledger.push({ version: params[0], name: params[1], checksum: params[2] });
          return Promise.resolve({ rows: [] });
        }
        if (/^(begin|commit|rollback)$/.test(sql)) needsLock(id, sql);
        if (opts.failOn && opts.failOn.test(sql)) return Promise.reject(Object.assign(new Error('boom'), { code: '42601' }));
        return Promise.resolve({ rows: [] });
      },
    };
  }

  return { state, client: makeClient, connect: () => Promise.resolve(makeClient()) };
}

// 단일 client 로 쓰는 편의 래퍼 — 기존 어서션(c.log / c.ledger)을 그대로 쓴다.
function fakeClient(opts) {
  const pool = fakePool(opts);
  const c = pool.client();
  Object.defineProperty(c, 'log', { get: () => pool.state.log.map((e) => e.sql) });
  Object.defineProperty(c, 'ledger', { get: () => pool.state.ledger });
  c.state = pool.state;
  return c;
}

const M = [
  { version: '001', name: '001_a.sql', sql: 'create table a()', checksum: 'ca' },
  { version: '002', name: '002_b.sql', sql: 'create table b()', checksum: 'cb' },
];

await checkAsync('빈 DB — 번호 순서대로 전부 적용하고 원장에 기록한다', async () => {
  const c = fakeClient();
  const done = await mig.up(c, M);
  assert.deepStrictEqual(done, ['001_a.sql', '002_b.sql']);
  assert.deepStrictEqual(c.ledger.map((r) => r.version), ['001', '002']);
  const begins = c.log.filter((s) => s === 'begin').length;
  const commits = c.log.filter((s) => s === 'commit').length;
  assert.strictEqual(begins, 2, '파일마다 트랜잭션 1개');
  assert.strictEqual(commits, 2);
  assert.ok(c.log.some((s) => s.includes('pg_advisory_lock')), 'advisory lock 획득');
  assert.ok(c.log.some((s) => s.includes('pg_advisory_unlock')), 'advisory lock 해제');
  assert.ok(c.log.indexOf('create table a()') < c.log.indexOf('create table b()'), '순서 보존');
});

await checkAsync('두 번째 실행은 아무것도 적용하지 않는다(멱등)', async () => {
  const c = fakeClient();
  await mig.up(c, M);
  const again = await mig.up(c, M);
  assert.deepStrictEqual(again, []);
  assert.strictEqual(c.ledger.length, 2);
});

await checkAsync('동시에 두 번 up() 해도 직렬화되고 각 파일은 한 번만 적용된다', async () => {
  // 가짜 풀이 "잠금을 쥔 연결에서만 원장을 만진다"를 강제한다 — Pool.query 로 잠그면
  // 연결이 매번 달라져 여기서 실패한다(pg 의 advisory lock 은 세션 단위다).
  const pool = fakePool();
  const [a, b] = await Promise.all([mig.up(pool, M), mig.up(pool, M)]);
  assert.deepStrictEqual([].concat(a, b).sort(), ['001_a.sql', '002_b.sql']);
  assert.deepStrictEqual(pool.state.ledger.map((r) => r.version), ['001', '002']);
  assert.strictEqual(pool.state.connections, 2, 'up() 마다 연결 1개를 체크아웃한다');
  assert.strictEqual(pool.state.released, 2, '체크아웃한 연결을 모두 반납한다');
  assert.strictEqual(pool.state.lockedBy, null, '잠금이 남지 않는다');
  // 잠금·원장 조작·해제가 각 up() 안에서 같은 연결로만 갔는지 (잠금 구간별 연결 id 단일)
  const ids = new Set(pool.state.log.filter((e) => /schema_migrations|begin|commit/.test(e.sql)).map((e) => e.id));
  assert.strictEqual(ids.size, 2, `원장을 만진 연결 수 ${ids.size}`);
});

await checkAsync('예외가 나도 연결을 반납한다', async () => {
  const pool = fakePool({ ledger: [{ version: '001', name: '001_a.sql', checksum: 'OLD' }] });
  await assert.rejects(() => mig.up(pool, M));
  assert.strictEqual(pool.state.released, 1);
  assert.strictEqual(pool.state.lockedBy, null, '실패해도 잠금을 놓는다');
});

await checkAsync('중간 실패 = rollback 하고 즉시 중단(뒤 파일로 넘어가지 않는다)', async () => {
  const c = fakeClient({ failOn: /create table b/ });
  await assert.rejects(() => mig.up(c, M), /002_b\.sql 적용 실패/);
  assert.deepStrictEqual(c.ledger.map((r) => r.version), ['001'], '실패한 파일은 원장에 없다');
  assert.strictEqual(c.log.filter((s) => s === 'rollback').length, 1);
  assert.ok(c.log.some((s) => s.includes('pg_advisory_unlock')), '실패해도 lock 을 놓는다');
});

await checkAsync('적용된 파일 내용이 바뀌면 아무것도 적용하지 않고 중단', async () => {
  const c = fakeClient({ ledger: [{ version: '001', name: '001_a.sql', checksum: 'OLD' }] });
  await assert.rejects(() => mig.up(c, M), /내용이 바뀌었다/);
  assert.strictEqual(c.ledger.length, 1, '002 도 적용하지 않는다');
});

await checkAsync('코드가 모르는 버전이 DB 에 있으면 중단(낡은 코드 보호)', async () => {
  const c = fakeClient({ ledger: [{ version: '009', name: '009_future.sql', checksum: 'cf' }] });
  await assert.rejects(() => mig.up(c, M), /모르는 마이그레이션/);
  assert.strictEqual(c.ledger.length, 1);
});

await checkAsync('verify() — 미적용이 있으면 실패, 다 적용되면 통과', async () => {
  const c = fakeClient();
  await assert.rejects(() => mig.verify(c, M), /미적용 마이그레이션/);
  await mig.up(c, M);
  await mig.verify(c, M);
});

await checkAsync('status() 는 읽기 전용 — DDL 도 돌리지 않는다', async () => {
  const c = fakeClient();
  const s2 = await mig.status(c, M);
  assert.deepStrictEqual(c.ledger, []);
  assert.strictEqual(c.state.present, false, '원장을 만들지 않는다');
  assert.ok(!c.log.some((sql) => /create table/i.test(sql)), `DDL 실행: ${c.log.join(' | ')}`);
  assert.ok(!c.log.includes('begin'));
  assert.strictEqual(s2.pending.length, M.length, '원장이 없으면 전부 미적용으로 읽는다');
});

await checkAsync('verify() 도 원장을 만들지 않고 미적용으로 판정한다 (기동 게이트가 DB 를 바꾸지 않는다)', async () => {
  const c = fakeClient();
  await assert.rejects(() => mig.verify(c, M), /미적용/);
  assert.strictEqual(c.state.present, false);
});

/* ===== 3. 실제 마이그레이션 파일 ===== */

section('저장소의 마이그레이션 파일');
check('파일명 규칙·중복 버전 검사를 통과하고 체크섬이 안정적이다', () => {
  const loaded = mig.loadMigrations();
  assert.ok(loaded.length >= 1, '마이그레이션이 하나도 없다');
  assert.deepStrictEqual(loaded.map((m) => m.version), mig.loadMigrations().map((m) => m.version));
  assert.strictEqual(loaded[0].checksum, mig.sha256(loaded[0].sql));
  assert.ok(/^\d{3}_/.test(loaded[0].name));
});
// #259 이후: 계정 스키마는 002 에만 있고(001 은 #264 그대로). #260 이후: 경기 **결과** 기록(match_results)만 005 에 있고,
// 방·진행 중 경기 상태의 영속화는 여전히 범위 밖이다.
check('계정 스키마는 002 에만 · 결과 기록은 005 에만 · 방·경기 상태 영속화 스키마는 없다', () => {
  const ms = mig.loadMigrations();
  const first = ms.find((m) => m.version === '001').sql.toLowerCase();
  for (const forbidden of ['create table accounts', 'create table sessions', 'password']) {
    assert.ok(!first.includes(forbidden), `001 에 계정 스키마: ${forbidden}`);
  }
  const all = ms.map((m) => m.sql.toLowerCase()).join('\n');
  for (const forbidden of ['create table rooms', 'create table matches', 'create table match_state']) {
    assert.ok(!all.includes(forbidden), `범위 밖 스키마: ${forbidden}`);
  }
  const results = ms.filter((m) => m.sql.toLowerCase().includes('create table match_results')).map((m) => m.version);
  assert.deepStrictEqual(results, ['005'], `match_results 는 005 에만: ${results}`);
});

/* ===== 4. fail-closed 런타임·기동 ===== */

section('fail-closed 런타임');
await checkAsync('DATABASE_URL 없이 query() 는 throw 한다 (빈 결과로 대체하지 않는다)', async () => {
  const saved = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    await assert.rejects(() => db.query('select 1'), (e) => e.code === 'E_DB_DISABLED');
    assert.strictEqual(db.enabled(), false);
  } finally { if (saved !== undefined) process.env.DATABASE_URL = saved; }
});

await checkAsync('설정 오류(TLS 강등)도 동기 throw 가 아니라 reject 로 온다', async () => {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://u:p@db.example.com/dd?sslmode=disable';
  try {
    await assert.rejects(() => db.query('select 1'), (e) => e.code === 'E_DB_CONFIG');
    await assert.rejects(() => db.ping(), (e) => e.code === 'E_DB_CONFIG');
  } finally { if (saved === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved; }
});

await checkAsync('깨진 퍼센트 이스케이프 DSN = 정제된 E_DB_CONFIG reject, 문구에 DSN 조각이 없다', async () => {
  const saved = process.env.DATABASE_URL;
  process.env.DATABASE_URL = 'postgres://dduser:sekrit%zz@db.example.com/dd';
  try {
    await assert.rejects(() => db.query('select 1'), (e) => {
      const text = db.safeErrorText(e);
      assert.strictEqual(e.code, 'E_DB_CONFIG');
      for (const leak of ['sekrit', 'dduser', 'db.example.com', '%zz']) assert.ok(!text.includes(leak) && !String(e.stack).includes(leak), `누출: ${leak}`);
      assert.ok(/malformed/.test(text), text);
      return true;
    });
  } finally { if (saved === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = saved; }
});

check('safeErrorText 는 pg 원문 메시지를 흘리지 않는다', () => {
  const pgErr = Object.assign(new Error('connect ECONNREFUSED 10.1.2.3:5432'), { code: 'ECONNREFUSED' });
  const text = db.safeErrorText(pgErr);
  assert.ok(!text.includes('10.1.2.3'), text);
  assert.ok(text.includes('ECONNREFUSED'), text);
  assert.strictEqual(db.safeErrorText(new Error('원문')), '알 수 없는 오류(코드 없음)');
});

const SERVER = path.join(__dirname, 'authoritative', 'server.js');

function spawnServer(env) {
  const child = spawn(process.execPath, [SERVER], {
    env: Object.assign({}, process.env, { DD_AUTH_PORT: '0' }, env),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  return { child, text: () => out };
}

function waitExit(child, ms) {
  return new Promise((resolve) => {
    const t = setTimeout(() => { child.kill(); resolve({ timedOut: true }); }, ms);
    child.on('exit', (code) => { clearTimeout(t); resolve({ code }); });
  });
}

function waitLine(handle, re, ms) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = setInterval(() => {
      const m = re.exec(handle.text());
      if (m) { clearInterval(tick); resolve(m); }
      else if (Date.now() - started > ms) { clearInterval(tick); reject(new Error(`시간 초과 — 출력:\n${handle.text()}`)); }
    }, 100);
  });
}

function get(port, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

section('fail-closed 기동 (실제 자식 프로세스)');

await checkAsync('닿지 않는 DATABASE_URL = listen 하지 않고 exit != 0', async () => {
  // 127.0.0.1:1 은 즉시 연결 거부된다 — 외부 네트워크를 쓰지 않는다.
  const h = spawnServer({ DATABASE_URL: 'postgres://u:p@127.0.0.1:1/dd' });
  const r = await waitExit(h.child, 30000);
  assert.ok(!r.timedOut, `기동을 중단하지 않았다 — 출력:\n${h.text()}`);
  assert.notStrictEqual(r.code, 0, `exit code ${r.code}`);
  assert.ok(/기동을 중단합니다/.test(h.text()), `안내 문구 없음:\n${h.text()}`);
  assert.ok(!/listening on/.test(h.text()), 'listen 해 버렸다');
});

await checkAsync('TLS 강등 DATABASE_URL = 연결을 시도하기도 전에 기동 중단', async () => {
  const h = spawnServer({ DATABASE_URL: 'postgres://u:p@db.example.com/dd?sslmode=disable' });
  const r = await waitExit(h.child, 30000);
  assert.ok(!r.timedOut, `기동을 중단하지 않았다 — 출력:\n${h.text()}`);
  assert.notStrictEqual(r.code, 0);
  assert.ok(/ssl_downgrade/.test(h.text()), `사유 표시 없음:\n${h.text()}`);
});

await checkAsync('DATABASE_URL 없으면 기존처럼 뜨고 /healthz 200 · /readyz 200 "ok (no db)"', async () => {
  const h = spawnServer({ DATABASE_URL: '' });
  try {
    const m = await waitLine(h, /listening on [^:]+:(\d+)/, 20000);
    const port = Number(m[1]);
    const health = await get(port, '/healthz');
    assert.strictEqual(health.status, 200);
    assert.strictEqual(health.body, 'ok');
    const ready = await get(port, '/readyz');
    assert.strictEqual(ready.status, 200);
    assert.strictEqual(ready.body, 'ok (no db)');
  } finally { h.child.kill(); }
});

/* ===== 결과 ===== */

  await db.close();
}

main().then(() => {
  if (failures) { console.error(`\n#264 DB 회귀 실패 ${failures}건`); process.exit(1); }
  console.log('\n#264 DB 회귀 통과');
}, (e) => { console.error('테스트 자체가 죽었다:', e); process.exit(1); });
