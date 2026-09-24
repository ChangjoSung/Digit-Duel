'use strict';
// 명령 봉투 검사 — analysis.md §2.5.1·§2.5.5.

const ERROR_CODES = new Set([
  'E_BAD_ENVELOPE', 'E_SEAT_TOKEN_INVALID', 'E_TOKEN_GEN_STALE', 'E_ROOM_NOT_FOUND',
  'E_ROOM_CLOSED', 'E_EPOCH', 'E_STALE_REVISION', 'E_NOT_ACTOR', 'E_NOT_OWNER',
  'E_ILLEGAL_ACTION', 'E_MATCH_STARTED', 'E_SUPERSEDED', 'E_CAPACITY', 'E_RATE_LIMITED',
  'E_INTERNAL', 'E_DRAINING',
  // #237 GDD-23 2.4 — 단절 중 입력 정지 · 지난 진열/지난 B08 · 서버 시각 마감
  'E_PAUSED', 'E_SHOP_STALE', 'E_DEADLINE',
]);

const COMMAND_TYPES = new Set(['setup', 'ready', 'unready', 'action', 'resign', 'leave', 'resync', 'list_rooms']);
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
  if (msg.t !== 'list_rooms') {
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

module.exports = { ERROR_CODES, COMMAND_TYPES, ACTION_TYPES, validateEnvelope, MAX_ENVELOPE_BYTES };
