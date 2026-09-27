'use strict';
// #264 QA용 Postgres 연결 — **선택적**이고 **fail-closed** 다.
//
// 선택적: DATABASE_URL 이 없으면 이 모듈은 전부 비활성이고 서버는 기존 무DB 동작 그대로 뜬다
// (오프라인·LAN·현재 Render 배포가 그대로 돌아간다). #264 는 "붙일 수 있게 준비"까지이고
// 계정·로그인(#259)이나 방·경기 영속화는 이 파일에 없다.
//
// fail-closed: 켜졌는데 못 붙거나 스키마가 안 맞으면 **조용히 성공한 척하지 않는다**.
//   - 기동: DATABASE_URL 이 있는데 연결·마이그레이션 확인이 실패하면 listen 하지 않고 exit 1
//     (authoritative/server.js). 반쯤 붙은 서버가 "저장됐다"고 답하는 상태를 만들지 않는다.
//   - 런타임: query() 는 비활성/미설정/장애를 전부 throw 한다. 빈 결과로 대체하지 않는다.
//   - 관측: /readyz 가 DB 왕복을 실제로 해 보고 503 을 낸다. /healthz 는 DB와 무관하게 200 "ok"
//     를 유지한다(#217 배포 계약 — 헬스체크가 DB로 흔들리면 서비스가 재시작 루프에 빠진다).
//
// TLS 정책(직접 DSN 을 파싱하는 이유): pg 의 ConnectionParameters 는 connectionString 을 파싱한
// 결과를 **명시 옵션 위에 덮어쓴다**(node_modules/pg/lib/connection-parameters.js 의
// `Object.assign({}, config, parse(config.connectionString))`). 그래서 connectionString 과 ssl 을
// 같이 넘기면 DSN 의 `?sslmode=disable` 이 우리가 켠 TLS 를 끌 수 있다(pg-connection-string 이
// ssl:false 를 내놓는 것을 실측 확인). 아래는 DSN 을 직접 뜯어 개별 필드로만 넘긴다.
const fs = require('fs');
const net = require('net');
// pg 는 DATABASE_URL 이 있을 때만 require 한다. 기존 로컬·LAN 설치(node_modules 에 ws 만 있는
// 상태)에서 원클릭 실행기가 MODULE_NOT_FOUND 로 죽지 않게 하려는 것이다 — 실행기는
// `if not exist node_modules` 만 보고 설치를 건너뛰므로 최상위 require 면 기존 설치가 깨진다.

// Render 의 내부 연결 주소는 `dpg-<id>-a` 형태의 한 단어 호스트로 사설망 안에서만 닿고,
// 외부 연결 주소는 `.render.com` 같은 FQDN 으로 인터넷을 건넌다. 인터넷을 건너는 쪽에만 TLS 를
// 강제한다 — 내부/루프백은 평문을 허용하되, sslmode 로 암호화·검증을 요구하면 따른다.
//
// 분류는 **허용 목록**이다. 평문이 허용되는 "내부" 는 근거가 있는 형태만이다:
//   internal = localhost · 127.0.0.1 · ::1 (이 기계 안)
//              · `dpg-<영숫자>-a` (Render Postgres 내부 URL 형태 — Render 연결 문서의 예시 형식. 추론·실측 전)
//   external = 점으로 이은 DNS 이름·IPv4 리터럴 · 그 밖의 모든 IPv6 리터럴 → TLS + 검증
//   null     = 그 밖 전부 → dbConfig 가 거부한다. 여기에는 **다른 한 단어 이름**(`db`·`postgres`)도
//              든다 — 한 단어 이름은 resolver 의 search domain 을 타고 어디로든 풀릴 수 있어
//              "사설망" 이라는 근거가 없다. `0x08080808`·`134744072` 같은 한 단어 숫자(=8.8.8.8)도 같다.
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);
const RENDER_INTERNAL_RE = /^dpg-[a-z0-9]+-a$/;
const SSLMODES = new Set(['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full']);
const DNS_NAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+\.?$/;

// URL.hostname → { host(pg 에 넘길 값), kind }. IPv6 는 괄호를 벗겨야 pg 가 접속할 수 있다.
function classifyHost(hostname) {
  const raw = String(hostname || '').toLowerCase();
  const bracketed = raw.startsWith('[') && raw.endsWith(']');
  const host = bracketed ? raw.slice(1, -1) : raw;
  if (bracketed) return net.isIPv6(host) ? { host, kind: LOCAL_HOSTS.has(host) ? 'internal' : 'external' } : { host, kind: null };
  if (LOCAL_HOSTS.has(host)) return { host, kind: 'internal' };
  if (RENDER_INTERNAL_RE.test(host)) return { host, kind: 'internal' };
  if (net.isIPv4(host)) return { host, kind: 'external' };
  // 마지막 라벨이 숫자(8진·16진 포함)인데 정규 IPv4 가 아니면 `0177.1`(=127.0.0.1) 같은 비정규 주소다 — 거부.
  if (DNS_NAME_RE.test(host) && !/^(0x[0-9a-f]*|\d+)$/.test(host.replace(/\.$/, '').split('.').pop())) return { host, kind: 'external' };
  return { host, kind: null };
}

// DSN → pg 설정. 비밀 값은 반환 객체 안에만 있고 어디에도 로그하지 않는다.
function dbConfig(rawUrl, env) {
  env = env || process.env;
  if (!rawUrl) return { ok: false, reason: 'absent' };
  // URL 파싱·퍼센트 디코딩 오류는 전부 사유 코드로만 돌려준다 — Node 의 URL 오류는 입력 DSN 을
  // `input` 에 싣고, 여기서 throw 하면 호출자가 비밀번호가 든 원문을 로그할 수 있다.
  let u, user, password, database;
  try {
    u = new URL(rawUrl);
    user = decodeURIComponent(u.username);
    password = decodeURIComponent(u.password);
    database = decodeURIComponent(u.pathname.replace(/^\//, ''));
  } catch (e) { return { ok: false, reason: 'malformed' }; }
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') return { ok: false, reason: 'bad_scheme' };
  if (!u.hostname) return { ok: false, reason: 'no_host' };
  if (!database) return { ok: false, reason: 'no_database' };

  const { host, kind } = classifyHost(u.hostname);
  if (!kind) return { ok: false, reason: 'bad_host' }; // 분류할 수 없는 호스트는 평문으로도 TLS 로도 붙지 않는다
  const internal = kind === 'internal';
  // libpq 가 아는 값만 받는다. 오타(`requre`)·중복 지정은 조용히 평문으로 해석하지 않고 거부한다.
  const modes = u.searchParams.getAll('sslmode');
  const sslmode = (modes[0] || '').toLowerCase();
  if (modes.length > 1 || (modes.length && !SSLMODES.has(sslmode))) return { ok: false, reason: 'bad_sslmode' };
  // 플랫폼 CA 가 시스템 신뢰 저장소에 없으면(Render 등) 내려받은 CA 파일을 지정한다.
  // 지정했는데 못 읽으면 조용히 시스템 CA 로 내려가지 않고 거부한다.
  let ca;
  if (env.DD_DB_CA_CERT) {
    try { ca = fs.readFileSync(env.DD_DB_CA_CERT, 'utf8'); }
    catch (e) { return { ok: false, reason: 'ca_unreadable' }; }
  }
  const verifyWith = () => (ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true });
  let ssl;
  let note = null;
  if (internal) {
    // 내부(사설망) 호스트. Render 공식 문서는 내부 연결도 TLS 를 받아들이지만 인증서가
    // self-signed 라고 설명한다 — 그래서 sslmode 를 **그대로 존중한다**:
    //   verify-ca·verify-full → 검증까지 켠다(CA 가 있어야 붙는다)
    //   require·prefer → 암호화는 켜고 검증은 하지 않는다(libpq 의 require 의미). self-signed 라
    //              rejectUnauthorized:true 로는 붙지 않으므로, CA 를 주면 검증까지 켜고
    //              없으면 "암호화만" 임을 기동 로그에 적는다. prefer 는 pg 가 평문 재시도를 못 하므로
    //              require 로 올린다 — TLS 를 원한다는 뜻을 평문으로 깎지 않는다.
    //   미지정·disable·allow → 평문(Render 내부 연결 기본값). 사설망을 벗어나지 않는다.
    if (sslmode === 'verify-ca' || sslmode === 'verify-full') ssl = verifyWith();
    else if (sslmode === 'require' || sslmode === 'prefer') {
      if (ca) ssl = verifyWith();
      else { ssl = { rejectUnauthorized: false }; note = `sslmode=${sslmode} · 내부 호스트 · CA 미지정 → 암호화만(인증서 미검증)`; }
    } else ssl = false;
  } else {
    // 인터넷을 건너는 연결에서 평문·검증 생략은 받아들이지 않는다 — 기동을 막는다.
    if (sslmode && sslmode !== 'require' && sslmode !== 'verify-ca' && sslmode !== 'verify-full') {
      return { ok: false, reason: 'ssl_downgrade' };
    }
    ssl = verifyWith();
  }

  return {
    ok: true,
    internal,
    tls: ssl !== false,
    verified: !!(ssl && ssl.rejectUnauthorized),
    note,
    config: {
      host,
      port: u.port ? Number(u.port) : 5432,
      user,
      password,
      database,
      ssl,
      // Free Postgres 는 연결 수가 넉넉하지 않고 이 서비스는 인스턴스 1개다 — 작게 잡는다.
      max: Number(env.DD_DB_POOL_MAX || 3),
      connectionTimeoutMillis: Number(env.DD_DB_CONNECT_TIMEOUT_MS || 10000),
      idleTimeoutMillis: 30000,
      application_name: 'digit-duel',
    },
  };
}

function enabled(env) { return !!((env || process.env).DATABASE_URL); }

let pool = null;

function fail(code, message) {
  const e = new Error(message);
  e.code = code;
  e.ddSafe = true; // 우리가 쓴 문구 — 비밀 값·연결 메타데이터가 없다
  return e;
}

// 로그로 내보낼 수 있는 오류 문구. pg 의 원문 메시지는 호스트·포트 같은 연결 메타데이터를
// 담을 수 있어(`connect ECONNREFUSED 10.0.0.5:5432`) 그대로 찍지 않고 코드만 남긴다.
function safeErrorText(e) {
  if (!e) return '알 수 없는 오류';
  if (e.ddSafe) return e.message;
  return e.code ? `오류 코드 ${e.code}` : '알 수 없는 오류(코드 없음)';
}

function getPool(env) {
  env = env || process.env;
  if (pool) return pool;
  if (!enabled(env)) throw fail('E_DB_DISABLED', 'DATABASE_URL 이 없다 — DB 기능은 꺼져 있다.');
  const cfg = dbConfig(env.DATABASE_URL, env);
  if (!cfg.ok) throw fail('E_DB_CONFIG', `DATABASE_URL 을 쓸 수 없다 (사유: ${cfg.reason}).`);
  const { Pool } = require('pg');
  pool = new Pool(cfg.config);
  // 유휴 클라이언트가 죽어도 프로세스를 내리지 않는다 — 다음 query() 가 정직하게 실패한다.
  pool.on('error', () => {});
  return pool;
}

// 실패를 삼키지 않는다. 호출자가 catch 해서 성공으로 바꾸지 않는 것이 이 모듈의 계약이다.
// 비활성·설정 오류도 동기 throw 가 아니라 rejected promise 로 낸다 — 호출자가 .catch 하나로
// 모든 실패를 같이 받게 해서 "설정 오류만 잡히지 않는" 구멍을 없앤다.
function query(text, params) {
  try { return getPool().query(text, params); }
  catch (e) { return Promise.reject(e); }
}

function ping() {
  return query('select 1').then(() => true);
}

function close() {
  if (!pool) return Promise.resolve();
  const p = pool;
  pool = null;
  return p.end();
}

// 로그·보고용 한 줄. 호스트·사용자·비밀번호·DB 이름을 넣지 않는다.
function describe(env) {
  env = env || process.env;
  if (!enabled(env)) return 'DB 미사용 (DATABASE_URL 없음)';
  const cfg = dbConfig(env.DATABASE_URL, env);
  if (!cfg.ok) return `DB 설정 오류 (사유: ${cfg.reason})`;
  const tls = cfg.tls ? (cfg.verified ? 'TLS 검증 on' : 'TLS 암호화만(미검증)') : 'TLS off';
  return `DB 사용 · ${cfg.internal ? '내부(사설망) 호스트' : '외부 호스트'} · ${tls}${cfg.note ? ` · ${cfg.note}` : ''}`;
}

module.exports = { dbConfig, classifyHost, enabled, getPool, query, ping, close, describe, safeErrorText };
