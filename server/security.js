'use strict';
// #62 방어적 릴레이 하드닝 — 순수 검증 유틸 모음.
// server.js 는 이 모듈의 판정만 사용하고, 여기 함수들은 I/O 없이 단위 테스트 가능하게 유지한다.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/* ===== 네트워크 주소 판정 ===== */

// IPv4-mapped IPv6(::ffff:a.b.c.d)·존 인덱스(fe80::1%eth0)를 벗겨 비교용 형태로 정규화
function normalizeIp(ip) {
  if (typeof ip !== 'string' || !ip) return '';
  let out = ip.trim().toLowerCase();
  if (out.startsWith('[') && out.endsWith(']')) out = out.slice(1, -1);
  out = out.replace(/^::ffff:/, '');
  const zone = out.indexOf('%');
  if (zone >= 0) out = out.slice(0, zone);
  return out;
}

function isLoopbackIp(ip) {
  const a = normalizeIp(ip);
  if (!a) return false;
  return a === '::1' || a === '0:0:0:0:0:0:0:1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a);
}

// 사설 대역(같은 공유기/네트워크) + 로컬호스트. 공인 IP는 전부 거부한다.
function isPrivateIp(ip) {
  const a = normalizeIp(ip);
  if (!a) return false;
  if (isLoopbackIp(a)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(a)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(a)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(a)) return true;
  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(a)) return true; // link-local
  if (/^fe[89ab][0-9a-f]:/.test(a)) return true;           // IPv6 link-local
  if (/^f[cd][0-9a-f]{2}:/.test(a)) return true;           // IPv6 unique-local
  return false;
}

/* ===== 바인드 주소 판정 (기동 fail-closed) ===== */

// 모든 인터페이스를 뜻하는 와일드카드. 이것만은 LAN 옵트인의 기본값이라 예외로 다룬다.
const WILDCARD_BINDS = new Set(['0.0.0.0', '::', '*']);

// DD_BIND 를 노출 정책(LAN 옵트인 여부)과 대조한다. 피어 검사(peerAllowed)가 뒤에서 한 번 더
// 거르지만, 그건 이미 열린 소켓에 붙은 상대를 돌려보내는 것이지 소켓을 안 여는 것이 아니다.
// 루프백 전용 모드에서 DD_BIND=0.0.0.0 을 조용히 받아들이면 "이 PC 전용"이라고 안내하면서
// 실제로는 모든 인터페이스에서 listen 하게 된다 — 그래서 여기서 기동 자체를 막는다.
// 반환: { ok:true, bind, source } 또는 { ok:false, reason }
function resolveBindAddress(rawBind, lanOptIn) {
  const raw = typeof rawBind === 'string' ? rawBind.trim() : '';
  if (!raw) return { ok: true, bind: lanOptIn ? '0.0.0.0' : '127.0.0.1', source: 'default' };

  const addr = normalizeIp(raw);
  const wildcard = WILDCARD_BINDS.has(addr);
  const bind = wildcard ? (addr === '*' ? '0.0.0.0' : addr) : addr;

  if (!lanOptIn) {
    // 옵트인 없이는 명시적 루프백 주소만. 와일드카드·호스트명·그 밖의 주소는 전부 거부한다.
    if (wildcard) return { ok: false, reason: 'wildcard_without_lan' };
    if (!isLoopbackIp(addr)) return { ok: false, reason: 'not_loopback' };
    return { ok: true, bind, source: 'env' };
  }
  // LAN 옵트인이어도 공인 주소에는 바인드하지 않는다 (외부망 공개 경로는 위협 모델 밖).
  if (wildcard) return { ok: true, bind, source: 'env' };
  if (!isPrivateIp(addr)) return { ok: false, reason: 'not_private' };
  return { ok: true, bind, source: 'env' };
}

/* ===== 접근 코드 (런타임 생성 — 저장소에 비밀값을 커밋하지 않는다) ===== */

// 혼동하기 쉬운 글자(I·L·O·U·0·1)를 뺀 Crockford 계열 알파벳
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

// 10자 × log2(30) ≒ 49비트. 매 기동마다 새로 만들어 콘솔에만 단독 출력하고,
// 어떤 URL·쿼리에도 붙이지 않는다. 사용자가 클라이언트에 직접 입력하면
// WebSocket 업그레이드의 하위 프로토콜 헤더로만 전달된다.
function generateAccessCode(length = 10) {
  const bytes = crypto.randomBytes(length * 2);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// 길이 노출·조기 반환을 피한 상수시간 비교
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hb = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb) && a.length === b.length;
}

/* ===== WebSocket 하위 프로토콜 = 접근 코드 전달 통로 =====
 * 접근 코드는 오직 WebSocket 업그레이드의 Sec-WebSocket-Protocol 헤더로만 전달된다.
 * URL·쿼리·쿠키·리다이렉트를 쓰지 않으므로 주소창·히스토리·Referer·프록시 액세스 로그
 * 어디에도 코드가 남지 않는다.
 *
 * 계약: 클라이언트는 토큰 **정확히 2개**를 이 순서로 제시한다.
 *   new WebSocket('ws://<host>:<port>/', [PROTOCOL_MARKER, accessCode])
 * 서버는 코드를 검증한 뒤 **공개 마커(PROTOCOL_MARKER)만 선택해 되돌려준다**.
 * 비밀값인 코드는 절대 선택·반향하지 않는다 — 선택하면 응답 헤더
 * `Sec-WebSocket-Protocol: <코드>` 로 비밀값이 그대로 돌아가고 클라이언트 ws.protocol·
 * 중계 프록시 로그에 남는다.
 *
 * 마커가 필요한 이유: 클라이언트가 하위 프로토콜을 제시했는데 서버가 하나도 선택하지 않으면
 * 브라우저(Chromium: "Sent non-empty 'Sec-WebSocket-Protocol' header but no response was
 * received")와 ws 클라이언트("Server sent no subprotocol")가 핸드셰이크를 실패 처리한다.
 * 그래서 되돌려줘도 안전한 공개 마커를 따로 두고, 그것만 선택한다.
 *
 * 토큰 개수를 2개로 못 박는 이유: 여러 개를 나열할 수 있으면 한 번의 핸드셰이크로
 * 코드 여러 개를 대입해 실패 시도 제한(AttemptLimiter)을 우회할 수 있다.
 */

// 공개 상수 — 비밀값이 아니다. 서버가 응답에 되돌려주는 유일한 하위 프로토콜.
const PROTOCOL_MARKER = 'digit-duel.v1';

const MAX_OFFERED_PROTOCOLS = 4;
const MAX_PROTOCOL_LENGTH = 64;
// RFC 7230 token — 하위 프로토콜 이름에 허용되는 문자 집합
const PROTOCOL_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

// Sec-WebSocket-Protocol 헤더 값 → 제시된 토큰 배열.
// 반환: { ok:true, protocols } 또는 { ok:false, reason }
function parseOfferedProtocols(header) {
  let raw = header;
  if (Array.isArray(raw)) raw = raw.join(',');
  if (typeof raw !== 'string' || raw.trim() === '') return { ok: false, reason: 'absent' };
  if (raw.length > (MAX_PROTOCOL_LENGTH + 2) * MAX_OFFERED_PROTOCOLS) {
    return { ok: false, reason: 'too_many' };
  }
  const parts = raw.split(',');
  if (parts.length > MAX_OFFERED_PROTOCOLS) return { ok: false, reason: 'too_many' };
  const protocols = [];
  for (const part of parts) {
    const token = part.trim();
    if (!token) return { ok: false, reason: 'empty_token' };
    if (token.length > MAX_PROTOCOL_LENGTH) return { ok: false, reason: 'token_too_long' };
    if (!PROTOCOL_TOKEN.test(token)) return { ok: false, reason: 'bad_token' };
    protocols.push(token);
  }
  return { ok: true, protocols };
}

// 업그레이드 요청에서 접근 코드를 꺼낸다. [마커, 코드] 정확히 2개일 때만 성립한다.
// 반환: { ok:true, code } 또는 { ok:false, reason }
// reason==='absent' 는 "코드를 아예 제시하지 않음"이라 대입 시도로 세지 않는다(그 외 실패는 센다).
function presentedAccessCode(header) {
  const parsed = parseOfferedProtocols(header);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  if (parsed.protocols.length !== 2) return { ok: false, reason: 'bad_shape' };
  if (parsed.protocols[0] !== PROTOCOL_MARKER) return { ok: false, reason: 'bad_marker' };
  return { ok: true, code: parsed.protocols[1] };
}

// 응답에 실을 하위 프로토콜을 고른다. 공개 마커만 돌려주고 그 밖에는 아무것도 고르지 않는다.
// ws 의 handleProtocols 훅에 그대로 연결한다 (Set 또는 배열 모두 받는다).
function selectProtocol(protocols) {
  const list = protocols instanceof Set ? Array.from(protocols) : (Array.isArray(protocols) ? protocols : []);
  return list.includes(PROTOCOL_MARKER) ? PROTOCOL_MARKER : false;
}

/* ===== 주입된 접근 코드 검증 (기동 fail-closed) ===== */

// DD_ACCESS_CODE 는 Sec-WebSocket-Protocol 토큰으로만 전달되므로, 그 통로가 실어 나를 수 있는
// 값만 허용한다. 공백·쉼표·세미콜론·비ASCII 는 헤더에서 토큰이 쪼개지거나 깨져 "설정은 됐는데
// 아무도 못 붙는" 조용한 고장이 되고, 공개 마커와 같은 값은 비밀이 아니라 누구나 아는 값이 된다.
// 그래서 검증은 서버가 뜨기 전에 하고, 어긋나면 기동을 중단한다(값은 절대 되돌려 담지 않는다).
// 반환: { ok:true, code } 또는 { ok:false, reason }
const MIN_ACCESS_CODE_LENGTH = 8;
const MAX_ACCESS_CODE_LENGTH = MAX_PROTOCOL_LENGTH; // 헤더 토큰 상한과 같게 묶는다

function validateAccessCode(raw) {
  if (typeof raw !== 'string' || raw === '') return { ok: false, reason: 'absent' };
  if (/\s/.test(raw)) return { ok: false, reason: 'whitespace' };            // 앞뒤 공백 포함 — trim 하지 않고 거부
  if (/[^\x21-\x7e]/.test(raw)) return { ok: false, reason: 'non_ascii' };   // 제어문자·비ASCII
  if (raw.length < MIN_ACCESS_CODE_LENGTH) return { ok: false, reason: 'too_short' };
  if (raw.length > MAX_ACCESS_CODE_LENGTH) return { ok: false, reason: 'too_long' };
  if (!PROTOCOL_TOKEN.test(raw)) return { ok: false, reason: 'bad_char' };   // 쉼표·세미콜론·따옴표 등
  if (raw.toLowerCase() === PROTOCOL_MARKER) return { ok: false, reason: 'public_marker' };
  return { ok: true, code: raw };
}

/* ===== HTTP 정적 경로 ===== */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
};

const ALLOWED_METHODS = new Set(['GET', 'HEAD']);

// URL 경로 → 실제 파일. 경로 이탈·확장자 밖 파일·숨김 파일·심볼릭 링크 탈출을 전부 거부한다.
// 반환: { ok:true, file, mime } 또는 { ok:false, status, reason }
function resolveStaticPath(root, rawUrl) {
  let pathname;
  try {
    pathname = new URL(String(rawUrl || '/'), 'http://placeholder.invalid').pathname;
  } catch (e) {
    return { ok: false, status: 400, reason: 'bad_url' };
  }

  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (e) {
    return { ok: false, status: 400, reason: 'bad_percent_encoding' };
  }
  // 이중 인코딩(%252e%252e)은 1회 디코드 후에도 %가 남는다 — 정적 자산 이름에 % 를 쓰지 않으므로 통째로 거부
  if (decoded.includes('%')) return { ok: false, status: 400, reason: 'double_encoding' };
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(decoded)) return { ok: false, status: 400, reason: 'control_char' };
  if (decoded.includes('\\')) return { ok: false, status: 400, reason: 'backslash' };

  if (decoded.endsWith('/')) decoded += 'index.html';
  const segments = decoded.split('/').filter((s) => s.length > 0);
  for (const seg of segments) {
    if (seg === '.' || seg === '..') return { ok: false, status: 403, reason: 'traversal' };
    if (seg.startsWith('.')) return { ok: false, status: 403, reason: 'dotfile' };
    if (seg.endsWith('.') || seg.endsWith(' ')) return { ok: false, status: 400, reason: 'trailing_dot_or_space' };
    if (/[<>:"|?*]/.test(seg)) return { ok: false, status: 400, reason: 'reserved_char' };
  }
  if (segments.length === 0) return { ok: false, status: 400, reason: 'empty_path' };
  if (segments.length > 16) return { ok: false, status: 400, reason: 'too_deep' };

  const rootReal = path.resolve(root);
  const file = path.resolve(rootReal, ...segments);
  if (file !== rootReal && !file.startsWith(rootReal + path.sep)) {
    return { ok: false, status: 403, reason: 'outside_root' };
  }

  const ext = path.extname(file).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return { ok: false, status: 403, reason: 'extension_not_allowed' };

  // 심볼릭 링크로 ROOT 밖을 가리키는 경우까지 차단
  let real;
  try {
    real = fs.realpathSync(file);
  } catch (e) {
    return { ok: false, status: 404, reason: 'not_found' };
  }
  const rootResolved = (() => {
    try { return fs.realpathSync(rootReal); } catch (e) { return rootReal; }
  })();
  if (real !== rootResolved && !real.startsWith(rootResolved + path.sep)) {
    return { ok: false, status: 403, reason: 'symlink_escape' };
  }
  let st;
  try {
    st = fs.statSync(real);
  } catch (e) {
    return { ok: false, status: 404, reason: 'not_found' };
  }
  if (!st.isFile()) return { ok: false, status: 404, reason: 'not_a_file' };

  return { ok: true, file: real, mime, size: st.size };
}

/* ===== Origin / Host ===== */

// 브라우저가 보낸 Origin 이 이 서버 자신인지 확인한다 (CSRF·WebSocket 하이재킹 방지).
// Origin 부재(비브라우저 클라이언트)는 여기서 판단하지 않고 호출부가 코드 인증으로 처리한다.
function isSameOrigin(originHeader, hostHeader) {
  if (typeof originHeader !== 'string' || !originHeader) return false;
  if (typeof hostHeader !== 'string' || !hostHeader) return false;
  let u;
  try {
    u = new URL(originHeader);
  } catch (e) {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  return u.host.toLowerCase() === hostHeader.trim().toLowerCase();
}

// Host 헤더 위조(DNS 리바인딩 경유 접근) 차단 — 사설/로컬 주소이거나 localhost 만 허용
function isAllowedHost(hostHeader, extraHosts) {
  if (typeof hostHeader !== 'string' || !hostHeader) return false;
  let u;
  try {
    u = new URL('http://' + hostHeader.trim());
  } catch (e) {
    return false;
  }
  const name = u.hostname.toLowerCase();
  if (name === 'localhost') return true;
  if (isPrivateIp(name)) return true;
  if (Array.isArray(extraHosts) && extraHosts.includes(name)) return true;
  return false;
}

/* ===== 릴레이 메시지 검증 =====
 * 서버는 게임 내용을 해석하지 않는 비권위 릴레이다(GDD 원칙). 따라서 t 값 자체는
 * 화이트리스트로 묶지 않고 "봉투(envelope) 형태"만 검사한다.
 *  - 바이너리 프레임 거부 (현행 프로토콜은 JSON 텍스트 전용)
 *  - 크기 상한
 *  - 최상위가 JSON 객체이고 문자열 t 를 가질 것
 *  - 최상위 예약 키 type 금지 — 서버 제어 프레임(waiting/matched/opponent_left) 위조 차단.
 *    현재 클라이언트는 type:'opponent_left' 수신 시 몰수패 처리를 하므로 실제 악용 가능한 경로다.
 *  - 중첩 깊이·키 개수·배열 길이 상한 (파싱 폭탄 방지)
 */

const RELAY_LIMITS = {
  maxBytes: 16 * 1024,
  maxDepth: 8,
  maxKeys: 256,
  maxArray: 512,
  maxTypeLength: 32,
};

function inspectDepth(value, limits, depth) {
  if (depth > limits.maxDepth) return 'too_deep';
  if (Array.isArray(value)) {
    if (value.length > limits.maxArray) return 'array_too_long';
    for (const v of value) {
      const r = inspectDepth(v, limits, depth + 1);
      if (r) return r;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length > limits.maxKeys) return 'too_many_keys';
    for (const k of keys) {
      const r = inspectDepth(value[k], limits, depth + 1);
      if (r) return r;
    }
    return null;
  }
  return null;
}

// 반환: { ok:true, bytes } 또는 { ok:false, reason }
function validateRelayMessage(raw, isBinary, limitsOverride) {
  const limits = Object.assign({}, RELAY_LIMITS, limitsOverride || {});
  if (isBinary) return { ok: false, reason: 'binary_not_allowed' };

  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), 'utf8');
  if (buf.length === 0) return { ok: false, reason: 'empty' };
  if (buf.length > limits.maxBytes) return { ok: false, reason: 'too_large' };

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch (e) {
    return { ok: false, reason: 'invalid_utf8' };
  }

  let msg;
  try {
    msg = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: 'invalid_json' };
  }
  if (msg === null || typeof msg !== 'object' || Array.isArray(msg)) {
    return { ok: false, reason: 'not_an_object' };
  }
  if (Object.prototype.hasOwnProperty.call(msg, 'type')) {
    return { ok: false, reason: 'reserved_key_type' };
  }
  if (typeof msg.t !== 'string' || msg.t.length === 0 || msg.t.length > limits.maxTypeLength) {
    return { ok: false, reason: 'bad_t' };
  }
  const deep = inspectDepth(msg, limits, 1);
  if (deep) return { ok: false, reason: deep };

  return { ok: true, bytes: buf.length };
}

/* ===== 속도 제한 ===== */

/* #201 정적 서빙 요청 예산. 고정값이며 env override 는 두지 않는다.
 * 자산이 늘면 같이 커져야 하는 계약이라 순수 상수로 내놓는다 — 회귀 테스트가 실제 자산 수와 대조한다.
 */
const STATIC_BUDGET = {
  pageLoadRequests: 48,    // index.html 1 + 하수인 20×2 + 리더 2×2 = 45, 부수 요청 여유 3
  concurrentPageLoads: 6,  // 같은 IP 에서 겹칠 수 있는 로드 수
};

// 초당 refillPerSec 만큼 회복되는 토큰 버킷. 메시지 수·바이트 수 양쪽에 쓴다.
class TokenBucket {
  constructor(capacity, refillPerSec, now) {
    this.capacity = capacity;
    this.refillPerSec = refillPerSec;
    this.tokens = capacity;
    this.last = typeof now === 'number' ? now : Date.now();
  }
  take(cost, now) {
    const t = typeof now === 'number' ? now : Date.now();
    const elapsed = Math.max(0, t - this.last) / 1000;
    this.last = t;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    const need = typeof cost === 'number' ? cost : 1;
    if (this.tokens < need) return false;
    this.tokens -= need;
    return true;
  }
}

// 실패 시도 누적 → 임계 초과 시 잠금. 접근 코드 무차별 대입 완화.
class AttemptLimiter {
  constructor(maxFailures, windowMs) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.map = new Map();
  }
  _entry(key, now) {
    const e = this.map.get(key);
    if (!e || now - e.first > this.windowMs) {
      const fresh = { count: 0, first: now };
      this.map.set(key, fresh);
      return fresh;
    }
    return e;
  }
  isBlocked(key, now) {
    const t = typeof now === 'number' ? now : Date.now();
    const e = this.map.get(key);
    if (!e) return false;
    if (t - e.first > this.windowMs) { this.map.delete(key); return false; }
    return e.count >= this.maxFailures;
  }
  fail(key, now) {
    const t = typeof now === 'number' ? now : Date.now();
    const e = this._entry(key, t);
    e.count += 1;
    return e.count >= this.maxFailures;
  }
  reset(key) {
    this.map.delete(key);
  }
  sweep(now) {
    const t = typeof now === 'number' ? now : Date.now();
    for (const [k, e] of this.map) if (t - e.first > this.windowMs) this.map.delete(k);
  }
}

/* ===== 보안 헤더 ===== */

// demo/index.html 은 인라인 <script>·인라인 스타일·on* 속성으로 구성된 단일 파일이라
// script-src/style-src 에 'unsafe-inline' 이 불가피하다(제거하면 클라이언트가 깨진다 — Mars 후속 과제).
// 나머지 지시자는 최대한 조인다.
const CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
};

module.exports = {
  normalizeIp,
  isLoopbackIp,
  isPrivateIp,
  generateAccessCode,
  validateAccessCode,
  resolveBindAddress,
  safeEqual,
  resolveStaticPath,
  parseOfferedProtocols,
  presentedAccessCode,
  selectProtocol,
  isSameOrigin,
  isAllowedHost,
  validateRelayMessage,
  TokenBucket,
  AttemptLimiter,
  STATIC_BUDGET,
  MIME,
  ALLOWED_METHODS,
  RELAY_LIMITS,
  SECURITY_HEADERS,
  CODE_ALPHABET,
  PROTOCOL_MARKER,
  MAX_OFFERED_PROTOCOLS,
  MAX_PROTOCOL_LENGTH,
  MIN_ACCESS_CODE_LENGTH,
  MAX_ACCESS_CODE_LENGTH,
  WILDCARD_BINDS,
};
