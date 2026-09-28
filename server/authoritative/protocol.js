'use strict';
// 명령 봉투 검사 — analysis.md §2.5.1·§2.5.5.

const ERROR_CODES = new Set([
  'E_BAD_ENVELOPE', 'E_SEAT_TOKEN_INVALID', 'E_TOKEN_GEN_STALE', 'E_ROOM_NOT_FOUND',
  'E_ROOM_CLOSED', 'E_EPOCH', 'E_STALE_REVISION', 'E_NOT_ACTOR', 'E_NOT_OWNER',
  'E_ILLEGAL_ACTION', 'E_MATCH_STARTED', 'E_SUPERSEDED', 'E_CAPACITY', 'E_RATE_LIMITED',
  'E_INTERNAL', 'E_DRAINING',
  // #237 GDD-23 2.4 — 단절 중 입력 정지 · 지난 진열/지난 B08 · 서버 시각 마감
  'E_PAUSED', 'E_SHOP_STALE', 'E_DEADLINE',
  // #259 세션이 끝난(로그아웃·재설정·다른 곳 로그인·절대 만료) 소켓 — 이 프레임 뒤 close 4003
  'E_SESSION_ENDED', 'E_SAME_ACCOUNT', // 같은 계정은 상대 좌석에 참가할 수 없다
  'E_BAD_ROOM_NAME', // #261 생성 소켓의 rn 이 허용 문자·길이를 벗어났다 — 방을 만들지 않는다
]);

// #261 rtt 는 로비 전용 소켓의 실측 왕복 요청이다(좌석 없는 명령 — list_rooms 와 같이 credential 을 싣지 않는다).
const COMMAND_TYPES = new Set(['setup', 'ready', 'unready', 'action', 'resign', 'leave', 'resync', 'list_rooms', 'rtt', 'emote']);
const SEATLESS = new Set(['list_rooms', 'rtt']);
const RTT_MAX = 2147483647;
// #262 경기 중 이모티콘 — 허용 ID(2026-09-27 CJ 승인 6종). 화면 목록과 같은지는 Mars 테스트가 이 값을 읽어 대조한다.
// id 는 봉투에서 보지 않는다 — 틀린 id 도 전용 응답(emote_result E_BAD_ENVELOPE)으로 돌려준다(server.js).
const EMOTE_IDS = Object.freeze(['hello', 'nice', 'wow', 'think', 'oops', 'gg']);
const isEmoteId = (id) => typeof id === 'string' && EMOTE_IDS.includes(id);

// #261 방 이름 — 원문 전체가 완성형 한글·영문·숫자·공백(U+0020)·_·- 여야 한다(그 밖의 문자는 지우지 않고 거부).
// 그 뒤 앞뒤 공백 제거·연속 공백 1칸으로 정리해 2~20자. 반환: 정리된 이름 | null(거부).
const ROOM_NAME_CHARS = /^[가-힣A-Za-z0-9 _-]*$/;
function normalizeRoomName(raw) {
  if (typeof raw !== 'string' || raw.length > 64 || !ROOM_NAME_CHARS.test(raw)) return null;
  const name = raw.trim().replace(/ {2,}/g, ' ');
  return name.length >= 2 && name.length <= 20 ? name : null;
}
// room.js의 ACTION_TYPES와 같은 집합이다 — demo/index.html:4993-5026 applyAction의 실제 어휘.
const ACTION_TYPES = new Set([
  'cell', 'selTray', 'roster', 'auto', 'clear', 'setupDone', 'skipMain', 'search', 'tele',
  'endTurn', 'heal', 'fleeSwap', 'fleeSkip', 'resign', 'act', 'item', 'ball', 'flee', 'pass',
  'pkgOpen', 'modal',
  // #237 경제 어휘 (demo/js/core.js ecoReduce · buffUse). shopTimeout 은 서버 시계만 낸다 — 회선 어휘가 아니다.
  'shopBuy', 'shopRefresh', 'shopGood', 'shopSell', 'shopSwap', 'shopTicket', 'leaderEl', 'shopDone', 'bagPick', 'buffUse',
]);

const MAX_ENVELOPE_BYTES = 8 * 1024;
const MAX_REQUEST_ID_LEN = 128;

function validateEnvelope(raw) {
  if (typeof raw !== 'string' && !Buffer.isBuffer(raw)) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  const str = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw;
  if (Buffer.byteLength(str, 'utf8') > MAX_ENVELOPE_BYTES) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  let msg;
  try { msg = JSON.parse(str); } catch (e) { return { ok: false, reason: 'E_BAD_ENVELOPE' }; }
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  if (msg.v !== 1) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  if (!COMMAND_TYPES.has(msg.t)) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  if (msg.t === 'rtt' && !(Number.isInteger(msg.n) && msg.n >= 0 && msg.n <= RTT_MAX)) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  if (!SEATLESS.has(msg.t)) {
    if (typeof msg.requestId !== 'string' || msg.requestId.length === 0 || msg.requestId.length > MAX_REQUEST_ID_LEN) {
      return { ok: false, reason: 'E_BAD_ENVELOPE' };
    }
    if (typeof msg.seatToken !== 'string') return { ok: false, reason: 'E_BAD_ENVELOPE' };
    if (!Number.isInteger(msg.tokenGen) || msg.tokenGen < 0) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  }
  if (msg.t === 'action') {
    if (!msg.action || typeof msg.action !== 'object') return { ok: false, reason: 'E_BAD_ENVELOPE' };
    if (!ACTION_TYPES.has(msg.action.t)) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  }
  if (msg.t === 'setup') {
    if (!Array.isArray(msg.roster) || !Array.isArray(msg.pos)) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  }
  if ('baseRevision' in msg && !Number.isInteger(msg.baseRevision)) return { ok: false, reason: 'E_BAD_ENVELOPE' };
  return { ok: true, msg };
}

module.exports = { ERROR_CODES, COMMAND_TYPES, ACTION_TYPES, validateEnvelope, MAX_ENVELOPE_BYTES, normalizeRoomName, EMOTE_IDS, isEmoteId };
