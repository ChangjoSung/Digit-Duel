'use strict';
// #259 아이디 계정 — 가입·로그인(단일)·로그아웃·세션 복원·이메일 6자리 코드 비밀번호 재설정.
//
// 계약 (CJ 확정):
//   - 로그인 아이디(비공개)와 닉네임(공개 표시 이름, 필수)은 별개다. 가입에는 이메일도 필수다(2026-09-27).
//     이메일은 유일하지 않다(2026-09-27 CJ · 004) — 아이디·닉네임만 유일. 재설정은 아이디로만 계정을 고른다.
//   - 세션: 로그인 시점부터 절대 30일. **마지막 로그인만 산다**(2026-09-27) — 다른 곳에서 로그인에 성공하면 그 계정의 옛 세션과
//     열린 WS 가 끝난다. 실패한 로그인은 아무도 끊지 않는다. 로그아웃은 이 세션만.
//   - 복구 코드 제도는 폐기(2026-09-27). 재설정 = **아이디만** 입력(CJ 2026-09-27 최신) → 없는 아이디는 404 '존재하지 않는 아이디입니다'
//     → 있으면 DB 에 등록된 그 계정의 이메일로만 6자리 코드(주소는 받지도 돌려주지도 않는다) → 아이디·코드 확인
//     → 서버가 준 재설정 허가로 새 비밀번호. 코드·허가는 그 한 계정의 행에만 묶인다.
//     새 비밀번호가 직전(현재) 비밀번호와 같으면 거부('직전 비밀번호와 같습니다'). 재설정은 모든 세션을 끊고 자동 로그인하지 않는다.
//   - DB 가 권위다. DB 가 없거나 실패하면 계정 쓰기를 거부한다(메모리·SQLite 로 대체하지 않는다).
//
// 비밀 값 저장: 비밀번호는 scrypt(무작위 salt), 세션 토큰·재설정 허가는 sha256(256비트 난수라 느린 해시가 필요 없다),
// 6자리 코드는 HMAC-SHA256(프로세스마다 새로 만드는 키 — DB·로그·파일에 없다. 유출된 DB 로 100만 개를 대입할 수 없다).
// 느린 해시는 비동기 crypto.scrypt 로만 돌린다 — 게임 서버의 이벤트 루프를 막지 않는다.
const crypto = require('crypto');
const { promisify } = require('util');
const S = require('../security');

const scrypt = promisify(crypto.scrypt);

// sessionTtlMs 는 CJ 확정값. login* 과 reset* 은 PD 구현 기본값(2026-09-27 Mercury GO)이다.
const POLICY = {
  sessionTtlMs: 30 * 24 * 3600 * 1000, // 절대 만료(로그인 시점부터, 사용해도 연장하지 않는다)
  loginMaxFailures: 10,                  // 아이디별(존재 여부와 무관) 창 안 실패 상한
  loginWindowMs: 15 * 60 * 1000,
  resetCodeTtlMs: 10 * 60 * 1000,        // 코드 유효 10분
  resetResendMs: 60 * 1000,              // 재발송 간격 60초
  resetMaxAttempts: 5,                   // 코드 하나당 틀린 시도 5회면 그 코드는 죽는다
  resetMaxSends: 10,                     // 계정당 24시간 발송 10회 → 하루 추측 상한 50회(성공 확률 ≈ 5e-5)
  resetSendWindowMs: 24 * 3600 * 1000,
  resetGrantTtlMs: 10 * 60 * 1000,       // 코드 확인 뒤 새 비밀번호를 정할 수 있는 시간
};

const USER_ID_RE = /^[a-z0-9_]{4,20}$/; // 002_accounts.sql CHECK 와 같은 규칙
// 닉네임(CJ 2026-09-26 확정): 완성형 한글 음절(U+AC00–U+D7A3)·ASCII 영문·숫자·밑줄 2~12자, NFC 정규화 뒤 검사.
// 낱자모(ㄱ)·다른 문자 체계·공백·기호는 받지 않는다. 영문 대소문자만 다른 닉네임은 같은 닉네임이다(002 lower() 유일 인덱스).
const NICKNAME_RE = /^[가-힣A-Za-z0-9_]{2,12}$/;
// 이메일(PD 기본값): ASCII 주소만, 254자 이하, local@domain.tld. 줄바꿈·공백이 들어갈 수 없어 메일 헤더 주입도 막힌다.
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const COOKIE = 'dd_sid';
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32바이트 base64url — 세션 토큰·재설정 허가
const SAME_PASSWORD_MSG = '직전 비밀번호와 같습니다'; // CJ 지정 문구 그대로
const ID_NOT_FOUND_MSG = '존재하지 않는 아이디입니다'; // CJ 지정 문구 그대로

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

/* ===== 비밀 값 ===== */

async function hashSecret(secret) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(secret, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

async function verifySecret(secret, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'base64');
  const want = Buffer.from(parts[5], 'base64');
  const got = await scrypt(secret, salt, want.length, { N, r, p });
  return crypto.timingSafeEqual(got, want);
}

// 없는 아이디도 같은 시간이 걸리게 — 응답 시간으로 아이디 존재를 알 수 없게 한다(처음 쓸 때 한 번 만든다).
let dummy = null;
const dummyHash = () => (dummy || (dummy = hashSecret(crypto.randomBytes(16).toString('hex'))));

function newToken() { return crypto.randomBytes(32).toString('base64url'); }
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function newResetCode() { return String(crypto.randomInt(0, 1000000)).padStart(6, '0'); } // CSPRNG, 균등

/* ===== 입력 검증 (신뢰 경계) ===== */

function normalizeUserId(s) {
  if (typeof s !== 'string') return null;
  const id = s.trim().toLowerCase();
  return USER_ID_RE.test(id) ? id : null;
}
function normalizeNickname(s) {
  if (typeof s !== 'string') return null;
  const n = s.normalize('NFC').trim();
  return NICKNAME_RE.test(n) ? n : null;
}
// → 저장·발송용 주소(앞뒤 공백만 제거) | null. email_norm(003 CHECK)은 소문자 전체 주소(emailKey) — 제공자별 접기 없음.
function normalizeEmail(s) {
  if (typeof s !== 'string') return null;
  const e = s.trim();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}
const emailKey = (e) => e.toLowerCase();
function validPassword(s) {
  return typeof s === 'string' && s.length >= PASSWORD_MIN && s.length <= PASSWORD_MAX;
}

/* ===== 메일 — 범용 SMTP (nodemailer, https://nodemailer.com/smtp) =====
 * DD_SMTP_URL(smtp:// 또는 smtps://, 사용자·비밀번호는 URL 인코딩) 와 DD_MAIL_FROM 이 둘 다 있을 때만 켠다. 없으면 null →
 * 있는 아이디의 재설정 요청이 503 E_MAIL_UNAVAILABLE(없는 아이디는 먼저 404). smtps:// 는 처음부터 TLS, smtp:// 는 STARTTLS 필수(코드가 평문으로 나가지 않게).
 * URL 을 nodemailer 에 그대로 넘기지 않는다 — nodemailer 는 URL 질의(?requireTLS=false&ignoreTLS=true · tls.* · debug · service …)로
 * 우리 옵션을 덮는다(Saturn #259 2026-09-27). 호스트·포트·계정만 뽑고 TLS 옵션은 여기서 고정하며, 질의·프래그먼트·경로가 있는 URL 은
 * 잘못된 설정으로 끈다(fail-closed — 미설정과 같은 503). 설정 값·코드·주소·오류는 로그에 쓰지 않는다. */
function smtpOptions(env) {
  if (!env.DD_MAIL_FROM || !env.DD_SMTP_URL) return null;
  try {
    const u = new URL(env.DD_SMTP_URL);
    const smtps = u.protocol === 'smtps:';
    if (!(smtps || u.protocol === 'smtp:') || !u.hostname || u.search || u.hash || (u.pathname && u.pathname !== '/')) return null;
    return {
      host: u.hostname.replace(/^\[|\]$/g, ''), port: u.port ? Number(u.port) : undefined,
      secure: smtps, requireTLS: !smtps, ignoreTLS: false,
      auth: u.username || u.password ? { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password) } : undefined,
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
    };
  } catch (e) { return null; } // 깨진 URL·잘못된 퍼센트 인코딩 — 값은 싣지 않는다
}
function smtpMailer(env) {
  const opts = smtpOptions(env);
  if (!opts) return null;
  const from = env.DD_MAIL_FROM;
  const t = require('nodemailer').createTransport(opts);
  return {
    send: (to, code) => t.sendMail({
      from, to, subject: '[Digit Duel] 비밀번호 재설정 코드',
      text: `비밀번호 재설정 코드: ${code}\n\n10분 동안 한 번만 쓸 수 있습니다. 요청하지 않았다면 이 메일을 무시하세요.`,
    }),
  };
}

/* ===== 저장소 — Postgres (유일한 운영 구현) =====
 * 여러 행을 바꾸는 쓰기는 **한 문장(CTE)** 으로 묶는다 — 문장 하나는 원자적이라 반쪽 상태가 남지 않는다.
 * 세션 유효 = 만료 전 + 세션의 credential_gen·login_gen 이 계정의 현재 값과 같음. 세대는 같은 행 UPDATE 로만 오르므로
 * 행 잠금으로 직렬화되고, 늦게 커밋된 옛 세대 세션 행은 존재해도 무효다(스냅샷·커밋 순서와 무관). */
function pgStore(query) {
  const one = (r) => (r.rows[0] || null);
  const ms = (n) => `${Math.round(n)} milliseconds`;
  const taken = (e) => {
    if (!e || e.code !== '23505') throw e;
    return { taken: e.constraint === 'accounts_nickname_key' ? 'nickname' : 'userId' };
  };

  return {
    // → {id, login_gen} | {taken:'userId'|'nickname'}
    async createAccount({ userId, nickname, email, passwordHash }, sess) {
      try {
        return one(await query(`WITH acct AS (
            INSERT INTO accounts (user_id, nickname, email, email_norm, password_hash) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, credential_gen, login_gen),
          ins AS (INSERT INTO sessions (token_hash, account_id, expires_at, credential_gen, login_gen)
                  SELECT $6, id, now() + $7::interval, credential_gen, login_gen FROM acct)
          SELECT id, login_gen FROM acct`, [userId, nickname, email, emailKey(email), passwordHash, sess.hash, ms(sess.ttlMs)]));
      } catch (e) { return taken(e); }
    },
    async findAccount(userId) {
      return one(await query('SELECT id, user_id, nickname, password_hash, credential_gen, email IS NOT NULL AS has_email FROM accounts WHERE user_id = $1', [userId]));
    },
    // 로그인 성공: 세대를 올리고 그 세대로 세션 하나를 넣고 그 계정의 다른 세션 행을 지운다(지우기는 청소일 뿐 — 유효성은 세대가 정한다).
    // gen = 비밀번호를 검증할 때 읽은 자격 세대. 그 사이 재설정이 끝났으면 아무것도 바꾸지 않고 null(→ 로그인 실패, 아무도 끊지 않음).
    async loginSession(accountId, gen, sess) {
      const row = one(await query(`WITH acct AS (
            UPDATE accounts SET login_gen = login_gen + 1 WHERE id = $1 AND credential_gen = $4 RETURNING id, credential_gen, login_gen),
          ins AS (INSERT INTO sessions (token_hash, account_id, expires_at, credential_gen, login_gen)
                  SELECT $2, id, now() + $3::interval, credential_gen, login_gen FROM acct),
          wipe AS (DELETE FROM sessions WHERE account_id IN (SELECT id FROM acct))
        SELECT login_gen FROM acct`, [accountId, sess.hash, ms(sess.ttlMs), gen]));
      return row ? row.login_gen : null;
    },
    async findSession(hash) {
      return one(await query(`SELECT a.id, a.user_id, a.nickname, a.email IS NOT NULL AS has_email, s.expires_at, s.login_gen FROM sessions s
        JOIN accounts a ON a.id = s.account_id AND a.credential_gen = s.credential_gen AND a.login_gen = s.login_gen
        WHERE s.token_hash = $1 AND s.expires_at > now()`, [hash]));
    },
    async deleteSession(hash) {
      await query('DELETE FROM sessions WHERE token_hash = $1', [hash]);
    },
    // 이메일이 없는(기존) 계정에만 한 번 등록한다(다른 계정과 같은 주소 허용). → true | false(이미 있음·그 사이 재설정)
    async setEmail(accountId, gen, email) {
      return !!one(await query('UPDATE accounts SET email = $2, email_norm = $3 WHERE id = $1 AND email IS NULL AND credential_gen = $4 RETURNING id',
        [accountId, email, emailKey(email), gen]));
    },
    // 새 코드를 건다(옛 코드는 덮여 즉시 무효, 시도 0). 재발송 간격·24시간 발송 상한 안에서만.
    // 대상 = 등록 이메일이 있는 그 한 계정. → {id, email(발송 주소 — 같은 문장에서 DB 가 준 등록 주소)} | null(이메일 없음·제한)
    async startReset(accountId, codeHash, P) {
      return one(await query(`WITH up AS (
          INSERT INTO password_resets AS p (account_id, code_hash, code_expires_at, attempts, sent_at, send_count, window_start)
          SELECT id, $2, now() + $3::interval, 0, now(), 1, now() FROM accounts WHERE id = $1 AND email IS NOT NULL
          ON CONFLICT (account_id) DO UPDATE SET code_hash = EXCLUDED.code_hash, code_expires_at = EXCLUDED.code_expires_at,
            attempts = 0, sent_at = now(),
            send_count = CASE WHEN p.window_start <= now() - $5::interval THEN 1 ELSE p.send_count + 1 END,
            window_start = CASE WHEN p.window_start <= now() - $5::interval THEN now() ELSE p.window_start END
          WHERE p.sent_at <= now() - $4::interval AND (p.window_start <= now() - $5::interval OR p.send_count < $6)
          RETURNING account_id)
        SELECT a.id, a.email FROM up JOIN accounts a ON a.id = up.account_id`,
      [accountId, codeHash, ms(P.resetCodeTtlMs), ms(P.resetResendMs), ms(P.resetSendWindowMs), P.resetMaxSends]));
    },
    // 발송 실패 — 아무도 받지 못한 코드를 치운다(그 코드일 때만).
    async dropResetCode(accountId, codeHash) {
      await query('UPDATE password_resets SET code_hash = NULL WHERE account_id = $1 AND code_hash = $2', [accountId, codeHash]);
    },
    // 코드 확인 — 한 문장: 맞으면 코드를 소비(CAS, 1회)하고 허가를 건다, 틀리면 시도 +1. 살아 있는 코드가 없거나(만료·소비·상한)
    // 그 아이디의 계정이 없으면 0행. 같은 코드 동시 확인은 행 잠금으로 직렬화돼 뒤 요청이 소비된 행(code_hash NULL)을 다시 보고 0행이다.
    async verifyReset(userId, codeHash, grantHash, P) {
      const row = one(await query(`UPDATE password_resets p SET
          attempts = p.attempts + CASE WHEN p.code_hash = $2 THEN 0 ELSE 1 END,
          grant_hash = CASE WHEN p.code_hash = $2 THEN $3 ELSE p.grant_hash END,
          grant_expires_at = CASE WHEN p.code_hash = $2 THEN now() + $4::interval ELSE p.grant_expires_at END,
          grant_gen = CASE WHEN p.code_hash = $2 THEN a.credential_gen ELSE p.grant_gen END,
          code_hash = CASE WHEN p.code_hash = $2 THEN NULL ELSE p.code_hash END
        FROM accounts a
        WHERE a.user_id = $1 AND p.account_id = a.id AND p.code_hash IS NOT NULL AND p.code_expires_at > now() AND p.attempts < $5
        RETURNING p.code_hash IS NULL AS ok`, [userId, codeHash, grantHash, ms(P.resetGrantTtlMs), P.resetMaxAttempts]));
      return !!(row && row.ok);
    },
    // 살아 있는 허가 → 그 계정의 현재 비밀번호 해시(직전 비밀번호 비교용) | null. 허가 뒤 비밀번호가 바뀌었으면 무효.
    async findGrant(grantHash) {
      return one(await query(`SELECT a.id, a.user_id, a.password_hash, a.credential_gen FROM password_resets p JOIN accounts a ON a.id = p.account_id
        WHERE p.grant_hash = $1 AND p.grant_expires_at > now() AND p.grant_gen = a.credential_gen`, [grantHash]));
    },
    // 허가 소비(CAS) + 비밀번호 교체 + 두 세대 +1 + 세션 전부 삭제. 새 세션은 만들지 않는다(자동 로그인 없음). → 새 login_gen | null
    async completeReset(accountId, grantHash, gen, passwordHash) {
      const row = one(await query(`WITH g AS (
            UPDATE password_resets SET grant_hash = NULL, grant_expires_at = NULL, code_hash = NULL
            WHERE account_id = $1 AND grant_hash = $2 AND grant_expires_at > now() RETURNING account_id),
          acct AS (UPDATE accounts SET password_hash = $3, credential_gen = credential_gen + 1, login_gen = login_gen + 1
                   WHERE id IN (SELECT account_id FROM g) AND credential_gen = $4 RETURNING id, login_gen),
          wipe AS (DELETE FROM sessions WHERE account_id IN (SELECT id FROM acct))
        SELECT login_gen FROM acct`, [accountId, grantHash, passwordHash, gen]));
      return row ? row.login_gen : null;
    },
  };
}

/* ===== 서비스 ===== */

// revoke 기술자(server.js endSessions): {sessionHash} = 그 세션 하나 · {accountId, belowLoginGen, reason?} = 그 계정에서
// **그 세대보다 낮은** 세션만. 세대 비교라 늦게 도착한 옛 로그인의 폐기가 더 새 로그인의 소켓·조회를 건드리지 못한다.
function createAccounts(store, policy, mailer) {
  const P = Object.assign({}, POLICY, policy || {});
  const loginLimiter = new S.AttemptLimiter(P.loginMaxFailures, P.loginWindowMs);
  const otpKey = crypto.randomBytes(32); // ponytail: 프로세스 키 — 재시작하면 대기 중 코드가 무효(10분짜리라 허용). 인스턴스 여럿이면 공유 비밀 env 로.
  const codeHash = (code) => crypto.createHmac('sha256', otpKey).update(code).digest('hex');
  const newSession = () => { const token = newToken(); return { token, hash: tokenHash(token), ttlMs: P.sessionTtlMs }; };
  const ok = (status, body, session) => ({ status, body, session });
  const AUTH_FAILED = ok(401, { error: 'E_AUTH_FAILED' });
  const BAD_INPUT = ok(400, { error: 'E_BAD_INPUT' });
  const LIMITED = ok(429, { error: 'E_RATE_LIMITED' });
  const CODE_INVALID = ok(401, { error: 'E_CODE_INVALID' });
  const MAIL_UNAVAILABLE = ok(503, { error: 'E_MAIL_UNAVAILABLE' });
  const RESET_INVALID = ok(401, { error: 'E_RESET_INVALID' });
  const user = (a, hasEmail) => ({ userId: a.user_id, nickname: a.nickname, hasEmail: !!hasEmail });
  // 새 세션을 받은 요청이 들고 온 다른 세션(이 브라우저가 쓰던 옛 쿠키) — 성공한 뒤에만 지우고 그 소켓을 끊는다.
  // 지우기가 실패해도 쿠키는 새 것으로 바뀌므로 소켓만은 끊는다(그 토큰은 이 응답 뒤 브라우저에 남지 않는다).
  const dropCarried = async (carried, revoke) => {
    if (!TOKEN_RE.test(carried || '')) return;
    const hash = tokenHash(carried);
    try { await store.deleteSession(hash); } catch (e) { /* 새 로그인은 이미 커밋됐다 — 청소 실패로 되돌리지 않는다 */ }
    revoke.push({ sessionHash: hash });
  };

  return {
    policy: P,
    mailEnabled: !!mailer,
    sweep: (t) => loginLimiter.sweep(t),

    async signup({ userId, nickname, password, email }, carried) {
      const id = normalizeUserId(userId);
      const nick = normalizeNickname(nickname);
      const mail = normalizeEmail(email);
      if (!id || !nick || !mail || !validPassword(password)) return BAD_INPUT;
      const sess = newSession();
      const row = await store.createAccount({ userId: id, nickname: nick, email: mail, passwordHash: await hashSecret(password) }, sess);
      if (row.taken) return ok(409, { error: row.taken === 'nickname' ? 'E_NICKNAME_TAKEN' : 'E_ID_TAKEN' });
      const revoke = [];
      await dropCarried(carried, revoke);
      return Object.assign(ok(201, { userId: id, nickname: nick, hasEmail: true }, sess), { revoke });
    },

    async login({ userId, password }, carried) {
      const id = normalizeUserId(userId);
      if (!id || !validPassword(password)) return AUTH_FAILED;
      // 시도를 검증 **전에** 센다 — 동시 요청 묶음으로 상한을 건너뛰지 못하게. 성공하면 지운다.
      // 아이디 키라 존재하지 않는 아이디도 똑같이 잠긴다(잠김 여부로 존재를 알 수 없다).
      if (loginLimiter.isBlocked(id)) return LIMITED;
      loginLimiter.fail(id);
      const acct = await store.findAccount(id);
      const good = await verifySecret(password, acct ? acct.password_hash : await dummyHash());
      if (!acct || !good) return AUTH_FAILED; // 실패는 아무 세션·소켓도 건드리지 않는다
      const sess = newSession();
      // 검증한 비밀번호가 아직 현재 자격일 때만 세션을 쓴다 — 그 사이 재설정이 이겼으면 같은 일반 실패다.
      const gen = await store.loginSession(acct.id, acct.credential_gen, sess);
      if (gen == null) return AUTH_FAILED;
      loginLimiter.reset(id);
      const revoke = [{ accountId: String(acct.id), belowLoginGen: gen, reason: 'login_replaced' }];
      await dropCarried(carried, revoke);
      return Object.assign(ok(200, user(acct, acct.has_email), sess), { revoke });
    },

    // 이 세션만 끝낸다. revoke: 이미 열린 WS 도 끊으라는 신호(server.js) — DB 에서 지운 **뒤에만**.
    async logout(token) {
      if (!TOKEN_RE.test(token || '')) return ok(200, { ok: true });
      const hash = tokenHash(token);
      await store.deleteSession(hash);
      return Object.assign(ok(200, { ok: true }), { revoke: [{ sessionHash: hash }] });
    },

    // 세션 토큰 → {id, userId, nickname, hasEmail, sessionHash, loginGen, expiresAt(ms)} | null. 형식이 틀린 토큰은 DB 까지 가지 않는다.
    async resolve(token) {
      if (!TOKEN_RE.test(token || '')) return null;
      const hash = tokenHash(token);
      const row = await store.findSession(hash);
      return row ? {
        id: String(row.id), userId: row.user_id, nickname: row.nickname, hasEmail: !!row.has_email,
        sessionHash: hash, loginGen: Number(row.login_gen), expiresAt: new Date(row.expires_at).getTime(),
      } : null;
    },

    // 이메일 없는 기존 계정의 등록 — 로그인 세션 + 현재 비밀번호. 이미 이메일이 있으면 바꾸지 않는다(주소 변경 경로는 아직 없다).
    async setEmail(account, { password, email }) {
      if (!account) return ok(401, { error: 'E_NO_SESSION' });
      const mail = normalizeEmail(email);
      if (!mail || !validPassword(password)) return BAD_INPUT;
      if (account.hasEmail) return ok(409, { error: 'E_EMAIL_ALREADY_SET' });
      if (loginLimiter.isBlocked(account.userId)) return LIMITED;
      loginLimiter.fail(account.userId);
      const acct = await store.findAccount(account.userId);
      if (!acct || !(await verifySecret(password, acct.password_hash))) return AUTH_FAILED;
      loginLimiter.reset(account.userId);
      const done = await store.setEmail(acct.id, acct.credential_gen, mail);
      if (!done) return acct.has_email ? ok(409, { error: 'E_EMAIL_ALREADY_SET' }) : AUTH_FAILED;
      return ok(200, { ok: true, hasEmail: true });
    },

    // 1) 코드 요청 {userId} (CJ 2026-09-27) — 순서: 없는 아이디 404 → 이메일 없는 계정 409 → 메일 미설정 503 → 발송 제한 429.
    //    발송을 기다린 뒤에만 202 — 실패하면 그 코드를 치우고 503(첫 화면에 머문다). 코드·주소는 응답에 싣지 않는다.
    async resetRequest({ userId }) {
      if (typeof userId !== 'string' || !userId.trim()) return BAD_INPUT;
      const id = normalizeUserId(userId);
      const acct = id && await store.findAccount(id);
      if (!acct) return ok(404, { error: 'E_ID_NOT_FOUND', message: ID_NOT_FOUND_MSG });
      if (!acct.has_email) return ok(409, { error: 'E_EMAIL_REQUIRED' }); // 주소를 지어내지 않는다 — 로그인 뒤 등록(/api/auth/email)
      if (!mailer) return MAIL_UNAVAILABLE;
      const code = newResetCode();
      const h = codeHash(code);
      const row = await store.startReset(acct.id, h, P);
      if (!row) return LIMITED; // 재발송 간격·24시간 상한
      try { await mailer.send(row.email, code); } catch (e) {
        await store.dropResetCode(row.id, h).catch(() => {}); // 원문 오류는 삼킨다(주소·호스트·자격이 섞일 수 있다)
        return MAIL_UNAVAILABLE;
      }
      return ok(202, { ok: true });
    },

    // 2) 코드 확인 {userId, code} → 재설정 허가(메모리에만 두는 256비트 토큰, 10분). 틀림·만료·재사용·상한·없는 아이디는 같은 401.
    async resetVerify({ userId, code }) {
      const id = normalizeUserId(userId);
      if (!id || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) return CODE_INVALID;
      const grant = newToken();
      if (!(await store.verifyReset(id, codeHash(code.trim()), tokenHash(grant), P))) return CODE_INVALID;
      return ok(200, { resetToken: grant });
    },

    // 3) 새 비밀번호 — 직전(현재) 비밀번호와 같으면 409(허가는 그대로 — 다른 비밀번호로 다시 시도). 성공은 모든 세션·소켓을 끊고
    //    자동 로그인하지 않는다. 쿠키는 이 브라우저가 든 세션이 재설정 계정의 것이거나 무효일 때만 지운다 — 다른 계정(B)으로
    //    로그인한 브라우저에서 A 를 재설정해도 B 는 로그인 상태로 남는다(Saturn #259 2026-09-27).
    async resetComplete({ resetToken, newPassword }, carried) {
      if (!validPassword(newPassword)) return BAD_INPUT;
      if (!TOKEN_RE.test(resetToken || '')) return RESET_INVALID;
      const gh = tokenHash(resetToken);
      const acct = await store.findGrant(gh);
      if (!acct) return RESET_INVALID;
      if (await verifySecret(newPassword, acct.password_hash)) return ok(409, { error: 'E_SAME_PASSWORD', message: SAME_PASSWORD_MSG });
      const who = await this.resolve(carried); // 재설정 **전에** 본다 — 뒤에는 A 의 세션이 이미 지워져 구분할 수 없다
      const gen = await store.completeReset(acct.id, gh, acct.credential_gen, await hashSecret(newPassword));
      if (gen == null) return RESET_INVALID; // 같은 허가를 다른 요청이 먼저 썼거나 그 사이 비밀번호가 바뀌었다
      loginLimiter.reset(acct.user_id);
      return Object.assign(ok(200, { ok: true }), { clear: !who || who.id === String(acct.id), revoke: [{ accountId: String(acct.id), belowLoginGen: gen }] });
    },
  };
}

/* ===== HTTP (/api/auth/*) =====
 * 전송 경계:
 *   - 비밀번호·코드·이메일을 싣는 요청은 HTTPS 이거나 이 PC(루프백)에서만 받는다. 원격 평문 HTTP 는 403.
 *   - 상태를 바꾸는 요청은 POST + Content-Type: application/json + 같은 출처 Origin 필수(CSRF).
 *   - 세션 쿠키: HttpOnly · SameSite=Strict · Path=/ · HTTPS 면 Secure. 토큰은 응답 본문에 싣지 않는다. */

const MAX_BODY = 2048;

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}
function sessionTokenFrom(req) { return parseCookies(req.headers.cookie)[COOKIE] || null; }

function sessionCookie(token, maxAgeMs, secure) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure ? '; Secure' : ''}`;
}

function readJson(req) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    // 상한을 넘으면 더 모으지 않고 바로 거부한다(나머지는 흘려보낸다 — 끝없는 본문은 server.requestTimeout 이 끊는다).
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { chunks.length = 0; resolve(null); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (size > MAX_BODY) return;
      try {
        const v = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        resolve(v && typeof v === 'object' && !Array.isArray(v) ? v : null);
      } catch (e) { resolve(null); }
    });
    req.on('error', () => resolve(null));
  });
}

const ROUTES = {
  'POST /api/auth/signup': { secret: true },
  'POST /api/auth/login': { secret: true },
  'POST /api/auth/email': { secret: true },
  'POST /api/auth/password-reset/request': { secret: true },
  'POST /api/auth/password-reset/verify': { secret: true },
  'POST /api/auth/password-reset/complete': { secret: true },
  'POST /api/auth/logout': {},
  'GET /api/auth/session': {},
  'HEAD /api/auth/session': {},
};

// 비밀 값(비밀번호·코드) 교환을 받아도 되는 전송인가.
//   - TLS 가 이 프로세스에서 끝나면 그대로 HTTPS.
//   - 공개 배포(리버스 프록시 뒤): 프록시가 붙이는 X-Forwarded-Proto: https **와** 브라우저가 붙이는 Origin 의 https 스킴을
//     **둘 다** 요구한다. 헤더 하나는 전송 보안의 증명이 아니다 — 평문 HTTP 페이지의 브라우저 Origin 은 http: 라 이것으로 걸러진다.
//     전제: 컨테이너는 플랫폼 엣지를 통해서만 닿아야 한다(직접 닿으면 XFP·Origin 을 모두 위조할 수 있다 — 그때는 위조한
//     사람 자신의 비밀번호만 평문으로 나간다). 이 전제는 배포 설정의 책임이고 코드로 증명할 수 없다.
//   - 그 밖(로컬·LAN): 이 PC(루프백)만. LAN 평문 HTTP 는 거부.
function transport(req, ip, publicDeploy, isLoopback) {
  if (req.socket && req.socket.encrypted) return { secure: true, secretOk: true };
  if (publicDeploy) {
    const secure = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
    let originHttps = false;
    try { originHttps = new URL(req.headers.origin).protocol === 'https:'; } catch (e) { /* 없음·깨짐 = 아님 */ }
    return { secure, secretOk: secure && originHttps };
  }
  return { secure: false, secretOk: isLoopback(ip) };
}

// ctx: { accounts(null = DB 없음), send(res, status, headers, body), secure, secretOk, sameOrigin, takeBucket(), revoke(desc) }
async function handleAuth(req, res, pathname, ctx) {
  const json = (status, body, extra) => ctx.send(res, status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extra || {}), JSON.stringify(body));
  const route = ROUTES[`${req.method} ${pathname}`];
  if (!route) {
    const known = Object.keys(ROUTES).some((k) => k.endsWith(` ${pathname}`));
    return json(known ? 405 : 404, { error: known ? 'E_METHOD' : 'E_NOT_FOUND' });
  }
  if (!ctx.accounts) return json(503, { error: 'E_ACCOUNTS_DISABLED' }); // DB 없는 서버 — 로그인 없는 기존 경로
  if (route.secret && !ctx.secretOk) return json(403, { error: 'E_INSECURE_TRANSPORT' });
  if (route.secret && !ctx.takeBucket()) return json(429, { error: 'E_RATE_LIMITED' }); // scrypt·메일을 부르는 경로만 센다
  let body = {};
  if (req.method === 'POST') {
    if (!ctx.sameOrigin) return json(403, { error: 'E_BAD_ORIGIN' });
    if (!/^application\/json(;|$)/i.test(req.headers['content-type'] || '')) return json(415, { error: 'E_BAD_INPUT' });
    body = await readJson(req);
    if (!body) return json(400, { error: 'E_BAD_INPUT' });
  }
  const A = ctx.accounts;
  const token = sessionTokenFrom(req);
  let out;
  try {
    switch (pathname) {
      case '/api/auth/signup': out = await A.signup(body, token); break;
      case '/api/auth/login': out = await A.login(body, token); break;
      case '/api/auth/email': out = await A.setEmail(await A.resolve(token), body); break;
      case '/api/auth/password-reset/request': out = await A.resetRequest(body); break;
      case '/api/auth/password-reset/verify': out = await A.resetVerify(body); break;
      case '/api/auth/password-reset/complete': out = await A.resetComplete(body, token); break;
      case '/api/auth/logout': out = await A.logout(token); out.clear = true; break;
      default: { // session
        const who = await A.resolve(token);
        out = who ? { status: 200, body: { userId: who.userId, nickname: who.nickname, hasEmail: who.hasEmail } } : { status: 401, body: { error: 'E_NO_SESSION' } };
      }
    }
  } catch (e) {
    // DB 장애·설정 오류 — 성공한 척하지 않고 기억 장치로 대신하지도 않는다. 원문 오류는 싣지 않는다.
    return json(503, { error: 'E_ACCOUNTS_UNAVAILABLE' });
  }
  if (out.revoke && ctx.revoke) out.revoke.forEach(ctx.revoke); // DB 에 기록된 **뒤에만** — DB 가 권위다
  const headers = {};
  if (out.session) headers['Set-Cookie'] = sessionCookie(out.session.token, out.session.ttlMs, ctx.secure);
  else if (out.clear) headers['Set-Cookie'] = sessionCookie('', 0, ctx.secure);
  return json(out.status, out.body, headers);
}

module.exports = {
  POLICY, COOKIE, USER_ID_RE, SAME_PASSWORD_MSG, ID_NOT_FOUND_MSG,
  hashSecret, verifySecret, normalizeUserId, normalizeNickname, normalizeEmail, tokenHash, newResetCode,
  pgStore, createAccounts, smtpMailer, handleAuth, transport, parseCookies, sessionTokenFrom, sessionCookie,
};
