'use strict';
// #264 버전 관리 마이그레이션 — 파일 한 개로 끝나는 최소 러너.
//
// 왜 도구를 안 붙이나: 필요한 것은 "번호 순서대로 한 번만, 트랜잭션 안에서, 적용 이력을 남기며"
// 세 가지뿐이고 그건 아래 60줄이다. 마이그레이션 프레임워크는 설정·CLI·플러그인이 따라온다.
//
// 계약 (전부 fail-closed — 애매하면 적용하지 않고 멈춘다):
//   - 파일명은 NNN_snake_case.sql. 정렬은 파일명순 = 버전순이다.
//   - 이미 적용된 파일의 내용이 바뀌면(checksum 불일치) 적용하지 않고 중단한다. 적용된 과거를
//     고치는 대신 새 번호 파일을 추가하라.
//   - DB 에 이 코드가 모르는 버전이 있으면(코드가 DB 보다 낡음) 중단한다. 낡은 코드로 새 DB 를
//     되돌리는 사고를 막는다.
//   - 각 파일은 트랜잭션 1개로 적용된다. 실패하면 rollback 하고 즉시 멈춘다(뒤 파일로 넘어가지 않는다).
//   - 여러 프로세스가 동시에 돌아도 advisory lock 으로 한 번에 하나만 적용한다.
//
// 사용:
//   node db-migrate.js status                 # 적용/미적용/불일치 표시 (DB 변경 없음)
//   node db-migrate.js up                     # 미적용 파일 적용
//   node db-migrate.js meta                   # db_meta 조회
//   node db-migrate.js meta <key> <value>      # db_meta 갱신 (만료일 기록 등)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const MIGRATION_DIR = path.join(__dirname, 'db', 'migrations');
const NAME_RE = /^(\d{3})_[a-z0-9_]+\.sql$/;
const LOCK_KEY = 264264; // #264 — 임의의 고정 정수. 같은 키를 쓰는 다른 작업이 이 저장소에 없다.

const LEDGER_DDL = `create table if not exists schema_migrations (
  version    text primary key,
  name       text not null,
  checksum   text not null,
  applied_at timestamptz not null default now()
)`;

function sha256(s) { return crypto.createHash('sha256').update(s, 'utf8').digest('hex'); }

function loadMigrations(dir) {
  dir = dir || MIGRATION_DIR;
  const files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.sql')).sort();
  const out = [];
  for (const file of files) {
    const m = NAME_RE.exec(file);
    if (!m) throw new Error(`마이그레이션 파일명 규칙 위반: ${file} (NNN_snake_case.sql)`);
    if (out.some((x) => x.version === m[1])) throw new Error(`마이그레이션 버전 중복: ${m[1]}`);
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    // 체크섬은 LF 로 맞춘 내용 기준 — Windows(autocrlf) 체크아웃과 Render(LF) 체크아웃이 같은 해시를 낸다.
    // legacyChecksum: 이 규칙 이전에 CRLF 체크아웃에서 원문 바이트로 기록된 원장 행을 같은 SQL 로 인정한다
    // (원장은 고치지 않는다). 예전 LF 원문 해시는 새 체크섬과 같다. 실제 내용이 바뀌면 둘 다 어긋나 멈춘다.
    const lf = sql.replace(/\r\n/g, '\n');
    out.push({ version: m[1], name: file, sql, checksum: sha256(lf), legacyChecksum: sha256(lf.replace(/\n/g, '\r\n')) });
  }
  return out;
}

// Pool 이면 클라이언트 하나를 체크아웃해서 돌려준다. pg 의 advisory lock 은 **세션(연결) 단위**라
// Pool.query 로 잠그면 lock·DDL·unlock 이 서로 다른 연결에서 실행돼 잠금이 아무것도 막지 못한다
// (심하면 잠긴 연결이 풀에 남아 다른 요청이 그 잠금을 물고 돈다). 그래서 up() 전체를 한 연결로 묶는다.
async function acquire(poolOrClient) {
  if (typeof poolOrClient.connect === 'function') {
    const client = await poolOrClient.connect();
    return { client, release: () => client.release() };
  }
  return { client: poolOrClient, release: () => {} };
}

function coded(message) {
  const e = new Error(message);
  e.ddSafe = true; // 우리가 쓴 문구 — 비밀 값이 없으니 그대로 로그해도 된다
  return e;
}

// **읽기 전용** — DDL 을 돌리지 않는다. 원장이 없으면 "전부 미적용"으로 읽는다.
// client 는 pg 의 Pool·Client 또는 query(text, params) 를 가진 무엇이든 된다(테스트용 주입).
async function status(client, migrations) {
  const probe = await client.query("select to_regclass('schema_migrations') is not null as present");
  const rows = probe.rows[0] && probe.rows[0].present
    ? (await client.query('select version, name, checksum from schema_migrations order by version')).rows
    : [];
  const byVersion = new Map(rows.map((r) => [r.version, r]));
  const pending = [];
  const drift = [];
  for (const m of migrations) {
    const applied = byVersion.get(m.version);
    if (!applied) pending.push(m);
    else if (applied.checksum !== m.checksum && applied.checksum !== m.legacyChecksum) drift.push(m);
  }
  const unknown = rows.filter((r) => !migrations.some((m) => m.version === r.version));
  return { applied: rows, pending, drift, unknown };
}

async function up(poolOrClient, migrations) {
  const { client, release } = await acquire(poolOrClient);
  try {
    // 잠금·원장 생성·적용·해제가 전부 이 한 연결에서 일어난다(위 acquire 주석).
    await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);
    try {
      await client.query(LEDGER_DDL); // 원장 생성은 잠금 안에서만 — status() 는 읽기 전용이다
      const s = await status(client, migrations);
      if (s.drift.length) {
        throw coded(`이미 적용된 마이그레이션의 내용이 바뀌었다: ${s.drift.map((m) => m.name).join(', ')} — 과거 파일을 고치지 말고 새 번호로 추가하라. 아무것도 적용하지 않았다.`);
      }
      if (s.unknown.length) {
        throw coded(`DB 에 이 코드가 모르는 마이그레이션이 있다: ${s.unknown.map((r) => r.version).join(', ')} — 코드가 DB 보다 낡았다. 아무것도 적용하지 않았다.`);
      }
      const done = [];
      for (const m of s.pending) {
        await client.query('begin');
        try {
          await client.query(m.sql);
          await client.query('insert into schema_migrations (version, name, checksum) values ($1, $2, $3)', [m.version, m.name, m.checksum]);
          await client.query('commit');
        } catch (e) {
          await client.query('rollback');
          // pg 의 원문 메시지는 싣지 않는다(연결 메타데이터가 섞일 수 있다) — 파일명과 SQLSTATE 만.
          throw coded(`${m.name} 적용 실패 — rollback 했다 (SQLSTATE ${e && e.code ? e.code : '없음'}).`);
        }
        done.push(m.name);
      }
      return done;
    } finally {
      await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
    }
  } finally {
    release();
  }
}

// 앱이 실제로 읽고 쓰는 표·열 (authoritative/accounts.js 의 SQL 그대로). 원장은 "적용했다"는 기록일 뿐이라
// 표·열이 나중에 지워져도 원장은 멀쩡하다 — 그래서 기동 게이트와 /readyz 는 이 목록을 실제 카탈로그와 대조한다.
// db_meta 는 CLI(meta) 전용이라 넣지 않는다. 앱 SQL 이 새 표·열을 쓰게 되면 여기에도 더한다.
// ponytail: 표·열 존재만 본다 — 타입·제약·인덱스까지 필요해지면 그때 넓힌다.
const REQUIRED_SCHEMA = {
  accounts: ['id', 'user_id', 'nickname', 'password_hash', 'credential_gen', 'login_gen', 'email', 'email_norm', 'rep_minion'],
  sessions: ['token_hash', 'account_id', 'expires_at', 'credential_gen', 'login_gen'],
  password_resets: ['account_id', 'code_hash', 'code_expires_at', 'attempts', 'sent_at', 'send_count', 'window_start', 'grant_hash', 'grant_expires_at', 'grant_gen'],
  match_results: ['id', 'match_id', 'account_id', 'result', 'reason', 'opponent_nickname', 'turns', 'duration_ms', 'ended_at'],
};

// **읽기 전용** — 빠진 것을 'table' 또는 'table.column' 으로 돌려준다(빈 배열 = 온전). 고치지 않는다.
async function missingSchema(client) {
  const { rows } = await client.query(
    'select table_name, column_name from information_schema.columns where table_schema = current_schema() and table_name = any($1)',
    [Object.keys(REQUIRED_SCHEMA)],
  );
  const have = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  const missing = [];
  for (const [table, cols] of Object.entries(REQUIRED_SCHEMA)) {
    if (!rows.some((r) => r.table_name === table)) missing.push(table);
    else for (const col of cols) if (!have.has(`${table}.${col}`)) missing.push(`${table}.${col}`);
  }
  return missing;
}

// 기동 게이트 — 연결·원장·실제 스키마를 확인한다. 실패하면 throw 해서 서버가 뜨지 않게 한다.
async function verify(client, migrations) {
  await client.query('select 1');
  const s = await status(client, migrations || loadMigrations());
  const problems = [];
  if (s.pending.length) problems.push(`미적용 마이그레이션 ${s.pending.map((m) => m.name).join(', ')}`);
  if (s.drift.length) problems.push(`내용이 바뀐 마이그레이션 ${s.drift.map((m) => m.name).join(', ')}`);
  if (s.unknown.length) problems.push(`코드가 모르는 버전 ${s.unknown.map((r) => r.version).join(', ')}`);
  const missing = await missingSchema(client);
  if (missing.length) problems.push(`필수 스키마 누락 ${missing.join(', ')} (원장과 실제 DB 가 다르다 — 자동 복구하지 않는다)`);
  if (problems.length) throw coded(problems.join(' · '));
  return s;
}

/* ===== CLI ===== */

async function main(argv) {
  const cmd = argv[0] || 'status';
  const migrations = loadMigrations();
  if (!db.enabled()) {
    console.error('DATABASE_URL 이 없다. QA DB 를 붙일 때만 이 명령을 쓴다 (비밀 값은 셸 이력에 남기지 말 것).');
    return 1;
  }
  console.log(db.describe());
  const client = db.getPool();

  if (cmd === 'status') {
    const s = await status(client, migrations);
    for (const r of s.applied) console.log(`  적용됨  ${r.version} ${r.name}`);
    for (const m of s.pending) console.log(`  미적용  ${m.version} ${m.name}`);
    for (const m of s.drift) console.log(`  불일치  ${m.version} ${m.name} — 적용된 내용과 파일이 다르다`);
    for (const r of s.unknown) console.log(`  미지    ${r.version} ${r.name} — 코드에 없는 버전`);
    return s.drift.length || s.unknown.length ? 1 : 0;
  }
  if (cmd === 'up') {
    const done = await up(client, migrations);
    console.log(done.length ? `적용: ${done.join(', ')}` : '적용할 마이그레이션 없음');
    return 0;
  }
  if (cmd === 'meta') {
    if (argv.length >= 3) {
      await client.query(
        'insert into db_meta (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value, updated_at = now()',
        [argv[1], argv[2]],
      );
    }
    const { rows } = await client.query('select key, value, updated_at from db_meta order by key');
    for (const r of rows) console.log(`  ${r.key} = ${r.value} (${r.updated_at.toISOString ? r.updated_at.toISOString() : r.updated_at})`);
    return 0;
  }
  console.error(`알 수 없는 명령: ${cmd} (status | up | meta)`);
  return 1;
}

if (require.main === module) {
  main(process.argv.slice(2))
    .then((code) => db.close().then(() => process.exit(code)))
    .catch((e) => {
      console.error(`[마이그레이션 중단] ${db.safeErrorText(e)}`);
      db.close().then(() => process.exit(1), () => process.exit(1));
    });
}

module.exports = { loadMigrations, status, up, verify, missingSchema, REQUIRED_SCHEMA, acquire, MIGRATION_DIR, LEDGER_DDL, LOCK_KEY, sha256 };
