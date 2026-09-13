'use strict';
// 룸 레지스트리 + 공개 로비 — analysis.md §2.3(초대 코드)·§2.4.1(생성 억제)·
// public-rooms-analysis.md §4(목록 필드)·§5(IP별 OPEN 상한).
const crypto = require('crypto');
const { Room, STATES } = require('./room');

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 0 O 1 I L 제외 (analysis.md §2.3)
const INVITE_LEN = 6;
const INVITE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_MAX_ROOMS = 200;
const DEFAULT_MAX_OPEN_PUBLIC_PER_IP = 2;

function generateInviteCode() {
  let s = '';
  const bytes = crypto.randomBytes(INVITE_LEN);
  for (let i = 0; i < INVITE_LEN; i++) s += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
  return s;
}

class Lobby {
  constructor(opts) {
    opts = opts || {};
    this.epoch = opts.epoch;
    this.maxRooms = opts.maxRooms != null ? opts.maxRooms : DEFAULT_MAX_ROOMS;
    this.maxOpenPublicPerIp = opts.maxOpenPublicPerIp != null ? opts.maxOpenPublicPerIp : DEFAULT_MAX_OPEN_PUBLIC_PER_IP;
    this.rooms = new Map(); // roomId -> Room
    this.inviteIndex = new Map(); // code -> {roomId, expiresAt}
    this.nextRoomId = 1;
    this.draining = false;
  }

  activeRoomCount() {
    let n = 0;
    for (const r of this.rooms.values()) {
      if (r.state !== STATES.CANCELED && r.state !== STATES.VOID && r.state !== STATES.CLOSED) n++;
    }
    return n;
  }

  _openPublicCountForIp(ip) {
    let n = 0;
    for (const r of this.rooms.values()) {
      if (r.isPublic && r.state === STATES.OPEN && r.creatorIp === ip) n++;
    }
    return n;
  }

  createRoom(ip, { isPublic }) {
    if (this.draining) return { ok: false, reason: 'E_DRAINING' };
    if (this.activeRoomCount() >= this.maxRooms) return { ok: false, reason: 'E_CAPACITY' };
    if (isPublic && this._openPublicCountForIp(ip) >= this.maxOpenPublicPerIp) {
      return { ok: false, reason: 'E_CAPACITY' };
    }
    const roomId = this.nextRoomId++;
    const room = new Room(roomId, { isPublic, epoch: this.epoch });
    room.creatorIp = ip;
    if (!isPublic) {
      const code = this._issueInvite(roomId);
      room.inviteCode = code;
    }
    this.rooms.set(roomId, room);
    return { ok: true, room };
  }

  _issueInvite(roomId) {
    let code;
    do { code = generateInviteCode(); } while (this.inviteIndex.has(code));
    this.inviteIndex.set(code, { roomId, expiresAt: Date.now() + INVITE_TTL_MS });
    return code;
  }

  reissueInvite(roomId) {
    const room = this.rooms.get(roomId);
    if (!room || room.state !== STATES.OPEN) return { ok: false, reason: 'E_ROOM_CLOSED' };
    for (const [code, entry] of this.inviteIndex) if (entry.roomId === roomId) this.inviteIndex.delete(code);
    const code = this._issueInvite(roomId);
    room.inviteCode = code;
    return { ok: true, code };
  }

  findByInvite(code) {
    const entry = this.inviteIndex.get(code);
    if (!entry) return { ok: false, reason: 'E_ROOM_NOT_FOUND' };
    if (entry.expiresAt < Date.now()) { this.inviteIndex.delete(code); return { ok: false, reason: 'E_ROOM_NOT_FOUND' }; }
    const room = this.rooms.get(entry.roomId);
    if (!room || room.state !== STATES.OPEN) { this.inviteIndex.delete(code); return { ok: false, reason: 'E_ROOM_NOT_FOUND' }; }
    // 1회용 — 첫 참가 성공 시 즉시 무효화 (호출부가 참가 성공 후 invalidate 호출)
    return { ok: true, room, code };
  }

  invalidateInvite(code) {
    this.inviteIndex.delete(code);
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  listPublicOpenRooms() {
    const rows = [];
    for (const r of this.rooms.values()) {
      if (r.isListable()) rows.push(r.lobbyRow());
    }
    return rows;
  }

  sweep() {
    const cutoffClosed = [];
    for (const [id, r] of this.rooms) {
      r.sweepDedup();
      if (r.state === STATES.FINISHED && !r._closeAt) r._closeAt = Date.now() + 5 * 60 * 1000;
      if ((r.state === STATES.CANCELED || r.state === STATES.VOID) && !r._closeAt) r._closeAt = Date.now();
      if (r._closeAt && Date.now() >= r._closeAt) cutoffClosed.push(id);
    }
    for (const id of cutoffClosed) {
      const r = this.rooms.get(id);
      // close()는 CLOSED 전이(revision 1회 증가)를 좌석에 푸시한 뒤 소켓을 닫는다 — 조용히 사라지지 않는다.
      if (r && r.state !== STATES.CLOSED) r.close();
      this.rooms.delete(id);
    }
    for (const [code, entry] of this.inviteIndex) {
      if (entry.expiresAt < Date.now()) this.inviteIndex.delete(code);
    }
  }

  voidAllForRestart() {
    for (const r of this.rooms.values()) r.voidForRestart();
  }

  startDraining() { this.draining = true; }
}

module.exports = { Lobby, generateInviteCode, INVITE_ALPHABET, INVITE_LEN };
