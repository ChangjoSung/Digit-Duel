'use strict';
// 룸 상태 기계 — analysis.md §2.3(생명주기)·§2.4(자격)·§2.5(명령)·§2.6(화이트리스트)의 구현.
// 게임 규칙 자체(이동·전투·상성·스킬·아이템·폭탄·함정·밀어내기·탐색·텔레포트·도망·기권)는 재구현하지 않고
// demo/index.html의 실제 엔진(engine.js가 하네스로 헤드리스 구동)을 그대로 쓴다.
//
// v4 (Saturn REVISE msg_9a62b8728ecf) — 무엇이 바뀌었나:
//
// 1) **좌석별 락스텝 엔진 쌍.** v3는 엔진 하나로 두 좌석을 섬기면서 NET.me를 접근자로 속였다(installModalUnmaskShim).
//    그 결과 (a) 로그 문구가 행동자 시점으로 생성돼 공용 S.log에 행동자 자기 말의 정체(idLabel)가 실려 상대에게
//    나갔고(예: 회복 틱 "🌿 <이름·속성> HP +n"), (b) "나/상대" 인칭이 뒤섞였다. 원래 게임의 온라인 모델은 두
//    클라이언트가 **같은 시드·같은 입력**으로 각자 자기 시점(NET.me)의 엔진을 돌리는 락스텝이고, 규칙 상태는
//    시점과 무관하게 일치하도록 설계·검증돼 있다(demo/test/regression/smoke_online_sync.js 퍼즈). 그래서 서버는
//    좌석마다 NET.me를 고정한 엔진을 하나씩 두고(`engines[0]`·`engines[1]`) 모든 입력을 둘 다에 적용한다.
//    좌석 뷰는 그 좌석의 엔진에서 읽고(로그·전투 로그·모달 문구가 원본 그대로 그 좌석 시점),
//    판정은 `engines[0]`에서 한다. 매 입력 후 두 엔진의 규칙 상태 요약(lockstepDigest)을 비교해 다르면
//    fail-closed로 룸을 VOID 처리한다. NET.me 접근자 트릭은 폐기했다.
//
// 2) **명시적 합법성 판정(_authorize).** UI의 버튼 활성 조건·엔진 코어 가드에 기대지 않고, 서버가 phase·행위자·
//    소유권·자원을 직접 확인한 뒤에만 applyAction을 부른다. 우선순위는 원본 입력 모델과 같다:
//      대기 중인 동기화 모달 > 도망 교환 선택(fleePick) > 전투 > 보드 플레이.
//    - 모달: NET.syncModal.owner(방어자일 수 있다)만, 같은 seq·범위 안·disabled가 아닌 버튼 인덱스만. 모달이
//      떠 있는 동안 다른 모든 행동은 거부한다(v3는 netActor/current로 인가해 공격자가 방어자 선택을 대신했다).
//    - 전투: actorOfPhase() 쪽 소유자만, 전투 어휘(act·item·ball·flee·pass·pkgOpen)만. skipMain·tele·endTurn 등
//      보드 행동은 거부한다(v3는 방어자 차례의 skipMain이 공격자 mainUsed를 바꿨다).
//    - 보드: S.current만. skipMain/tele/search/heal/endTurn 각각 원본 UI·코어와 같은 조건.
//    거부된 입력은 엔진에 닿지 않으므로 상태·revision이 변하지 않는다. 판정을 통과했는데도 상태가 전혀 안 바뀐
//    입력(예: 이미 선택된 말 재클릭)은 성공이지만 revision을 올리지 않는다(noop).
//
// 3) 배치 검증은 준비 상태를 바꾸기 전에 서버가 한다(applyNetSetup의 "손상 → 무작위 대체"에 기대지 않는다).
// 4) 뷰의 자기 말 별칭(u-…)을 heal/fleeSwap 입력에서 실제 id로 되돌린다. 원시 엔진 id는 받지 않는다.
// 5) 종료 전이(_finalize)는 revision을 정확히 한 번 올리고, 시작 전 종료 뷰는 phase를 'canceled'|'void'|'closed'로 준다.
const crypto = require('crypto');
const { SeatCredential } = require('./seatToken');
const { createEngine, withEngine } = require('./engine');

const DISCONNECT_GRACE_MS = 60 * 1000;
const DEDUP_TTL_MS = 120 * 1000;

const STATES = Object.freeze({
  OPEN: 'OPEN', SETUP: 'SETUP', IN_PROGRESS: 'IN_PROGRESS', FINISHED: 'FINISHED',
  CANCELED: 'CANCELED', VOID: 'VOID', CLOSED: 'CLOSED',
});
const TERMINAL_NO_BOARD = new Set([STATES.CANCELED, STATES.VOID, STATES.CLOSED]);

// 클라이언트가 온라인 경로에서 실제로 보내는 액션 어휘 그대로다 (demo/index.html applyAction switch).
const ACTION_TYPES = new Set([
  'cell', 'selTray', 'roster', 'auto', 'clear', 'setupDone', 'skipMain', 'search', 'tele',
  'endTurn', 'heal', 'fleeSwap', 'fleeSkip', 'resign', 'act', 'item', 'ball', 'flee', 'pass',
  'pkgOpen', 'modal',
]);
// 배치 화면 전용 코어(autoPlaceCore/clearPlaceCore/toggleRosterCore/setupDoneCore/selTrayCore)는 S.phase 가드가 없어
// 매치 중에 닿으면 보드를 붕괴시킨다. 이 서버는 배치를 `setup` 명령으로 받으므로 매치 중에는 전부 거부한다.
const SETUP_ONLY_ACTIONS = new Set(['auto', 'clear', 'roster', 'setupDone', 'selTray']);
const ACT_KINDS = new Set(['basic', 'skill', 'common']); // __actCore의 레거시 문자열 kind (왕·동료 본체 UI가 'basic'/'skill'을 보낸다)
const PKG_KINDS = new Set(['itemGift', 'battleBuff']);
const ROSTER_SIZE = 6; // applyNetSetup: data.roster.length===6

function now() { return Date.now(); }
function err(reason) { return { ok: false, reason }; }

// ===== 배치 검증용 카탈로그 — 엔진 하나를 프로세스당 한 번만 띄워 상수만 읽는다 =====
let CATALOG = null;
function catalog() {
  if (CATALOG) return CATALOG;
  const T = createEngine();
  withEngine(T, () => { T.newGame('pvp'); });
  const m = /const\s+COLS\s*=\s*(\d+)\s*,\s*ROWS\s*=\s*(\d+)/.exec(T.html);
  if (!m) throw new Error('demo/index.html에서 COLS/ROWS 상수를 찾지 못함 — 배치 검증 계약 변경 가능성');
  CATALOG = Object.freeze({
    rosterIds: new Set(T.ROSTER.map((r) => r.id)),
    zone0: new Set(T.zoneOf(0)),
    cols: Number(m[1]),
    rows: Number(m[2]),
    piecesPerSeat: T.S.pieces.filter((p) => p.owner === 0).length,
  });
  return CATALOG;
}

// ===== 락스텝 규칙 상태 요약 — 시점(NET.me)과 무관해야 하는 필드만 =====
// smoke_online_sync.js gameCanon/canon을 기준으로 전투원·패키지·텔레포트 횟수·도망 선택까지 넓혔다.
// 로그(S.log·B.blog)·연출·메모 같은 시점 의존 표시 상태는 넣지 않는다.
function lockstepDigest(T) {
  const S = T.S;
  const B = S.battle;
  const sm = T.NET.syncModal;
  const fighter = (f) => (f ? {
    hp: f.hp, maxHp: f.maxHp, shield: f.shield || 0, burn: f.burn || 0, weaken: f.weaken || 0, shock: f.shock || 0,
    cd: f.cd || 0, cds: f.cds || null, dmgCut: f.dmgCut || 0, focusCharge: !!f.focusCharge, vulnMark: !!f.vulnMark,
    powerBuff: !!f.powerBuff, fleeBoost: !!f.fleeBoost, revealedSkills: f.revealedSkills || null,
  } : null);
  return JSON.stringify({
    phase: S.phase, current: S.current, turn: S.turnCount, mainUsed: S.mainUsed, battlesUsed: S.battlesUsed,
    sel: S.selected ? (S.selected.tray ? 'tray' : S.selected.id) : null,
    forced: (S.forcedTargets || []).slice(), forcedQueue: (S.forcedQueue || []).length,
    tele: S.teleport ? { stage: S.teleport.stage, piece: S.teleport.piece ? S.teleport.piece.id : null } : null,
    moved: S.movedPiece ? S.movedPiece.id : null,
    battle: B ? {
      att: B.attP.id, def: B.defP.id, round: B.round, phase: B.phase, actSeq: B.actSeq || 0, maxRounds: B.maxRounds || null,
      fa: fighter(B.fa), fd: fighter(B.fd), itemRoundA: !!B.itemRoundA, itemRoundD: !!B.itemRoundD,
      ballThrowA: !!B.ballThrowA, ballThrowD: !!B.ballThrowD, buffA: B.buffA || null, buffD: B.buffD || null,
    } : null,
    fleePick: S.fleePick ? { owner: S.fleePick.owner, cands: S.fleePick.cands.slice(), token: S.fleePick.token } : null,
    events: (S.events || []).map((e) => [e.r, e.c, e.kind, !!e.consumed]),
    balls: S.balls.slice(), inv: S.inv.map((a) => a.slice()), reserve: S.reserve.map((x) => (x ? [x.element, x.hp] : null)),
    pkgs: S.pkgs.map((p) => Object.assign({}, p)), teleUsed: (S.teleUsed || []).slice(),
    traces: S.traces.map((t) => [...t].sort()), tempReveal: [...(S.tempReveal || [])].sort(), winner: S.winner,
    modalSeq: T.NET.modalSeq, sync: sm ? { seq: sm.seq, owner: sm.owner, n: sm.fns ? sm.fns.length : 0 } : null,
    pieces: S.pieces.map((p) => [p.id, p.owner, p.type, p.rosterId, p.element, p.hp, p.maxHp, p.r, p.c, p.placed, p.alive,
      !!p.revealed, p.immobile, !!p.healing, p.skills || null, p.cds || null, p.cap ? [p.cap.element, p.cap.hp] : null]),
  });
}

class Room {
  // seed: 테스트 재현용 엔진 시드 주입(단위 테스트 전용). lobby.createRoom은 절대 넘기지 않는다 — 운영 룸은 매치 시작 시
  // crypto 난수로 비밀 시드를 뽑는다. 어떤 네트워크 입력도 이 값에 닿지 않는다.
  constructor(roomId, { isPublic, epoch, graceMs, seed }) {
    this.roomId = roomId;
    this.isPublic = !!isPublic;
    this.epoch = epoch;
    this.graceMs = graceMs != null ? graceMs : DISCONNECT_GRACE_MS;
    this._testSeed = Number.isInteger(seed) ? seed : null;
    this.state = STATES.OPEN;
    this.createdAt = now();
    this.inviteCode = null; // 비공개 룸만
    this.revision = 0;
    this.result = null; // {type:'WIN'|'FORFEIT'|'NO_CONTEST', winner, ...}
    this.dedup = new Map(); // `${seat}:${requestId}` -> {resp, ts}
    this.seats = [this._newSeat(), this._newSeat()];
    this.engines = null; // [좌석0 시점 엔진, 좌석1 시점 엔진] — 매치 시작 시점에만 생성
    this._aliasByPid = new Map(); // 실제 PID(생성 순서를 노출) → 불투명 별칭
    this._pidByAlias = new Map();
    this._consumedModalSeq = null;
    this.lastFault = null; // 엔진 장애 진단(서버 로그용 — 어떤 프레임에도 싣지 않는다)
    this.onFinalize = null;
    // #217 전투 표시 이벤트(fx) — 좌석별 최근 창(engine.js T.__fx 스냅샷). 엔진 자체가 아니라 Room에 둔다:
    // 경기 종료(_finalize)는 TERMINAL_NO_BOARD 전이에서 this.engines를 즉시 null로 비우므로(메모리 해제),
    // "종료 직후 battle=null에도 결과/마지막 타격 표시" 요구를 만족하려면 engines가 살아있는 마지막 순간
    // (_apply/_handleResign이 finalize를 부르기 直前)에 미리 떠 둬야 한다.
    this._fxCache = [{ firstSeq: null, lastSeq: 0, events: [] }, { firstSeq: null, lastSeq: 0, events: [] }];
  }

  // 판정용 정본 엔진 (테스트·기존 호출부 호환)
  get engine() { return this.engines ? this.engines[0] : null; }

  _newSeat() {
    return {
      credential: null, ws: null, connected: false,
      ready: false, placed: false, rawSetup: null, seq: 0,
      disconnectExpiry: null, disconnectTimer: null,
    };
  }

  // ===== 좌석 부여 =====

  openHostSeat(ws) {
    const seat = this.seats[0];
    seat.credential = new SeatCredential();
    this._attach(0, ws);
    return seat.credential.issue();
  }

  joinGuestSeat(ws) {
    if (this.state !== STATES.OPEN) return err('E_ROOM_NOT_FOUND');
    const seat = this.seats[1];
    seat.credential = new SeatCredential();
    this._attach(1, ws);
    this.state = STATES.SETUP;
    this.revision += 1; // OPEN → SETUP 전이 — 호스트가 받는 알림 room_state의 revision이 새로 선다
    return { ok: true, issued: seat.credential.issue() };
  }

  resumeSeat(seatIndex, token, ws) {
    const seat = this.seats[seatIndex];
    if (!seat.credential) return err('E_SEAT_TOKEN_INVALID');
    if (TERMINAL_NO_BOARD.has(this.state)) return err('E_ROOM_CLOSED');
    const issued = seat.credential.resume(token);
    if (!issued) return err('E_SEAT_TOKEN_INVALID');
    this._clearDisconnectTimer(seatIndex);
    this._attach(seatIndex, ws);
    seat.disconnectExpiry = null;
    return { ok: true, issued };
  }

  _attach(seatIndex, ws) {
    const seat = this.seats[seatIndex];
    if (seat.ws && seat.ws !== ws && seat.ws.readyState === 1 /* OPEN */) {
      try { seat.ws.send(JSON.stringify({ v: 1, type: 'error', code: 'E_SUPERSEDED', seq: ++seat.seq })); } catch (e) { /* 소켓 이미 닫힘 */ }
      try { seat.ws.close(4001, 'superseded'); } catch (e) { /* noop */ }
    }
    seat.ws = ws;
    seat.connected = true;
  }

  // ===== 이탈 =====

  // 명시적 나가기 — server.js는 좌석 토큰 인증·중복 제거를 통과한 뒤에만 handleCommand('leave')로 부른다.
  explicitLeave(seatIndex) {
    if (this.state === STATES.OPEN || this.state === STATES.SETUP) {
      this._finalize(STATES.CANCELED, null, { notify: false }); // 응답·상대 푸시는 명령 경로(server.js)가 한다
      return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
    }
    if (this.state === STATES.IN_PROGRESS) return err('E_ILLEGAL_ACTION');
    if (this.state === STATES.FINISHED) {
      // 결과는 이미 확정 — 상태 변화 없음. 소켓 종료는 응답을 보낸 뒤 server.js가 한다.
      return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex), noop: true };
    }
    return err('E_ROOM_CLOSED');
  }

  socketClosed(seatIndex) {
    const seat = this.seats[seatIndex];
    if (!seat.credential) return;
    seat.connected = false;
    seat.ws = null;
    if (this.state === STATES.OPEN || this.state === STATES.SETUP) {
      this._clearDisconnectTimer(seatIndex);
      seat.disconnectTimer = setTimeout(() => this._onGraceExpirePreStart(seatIndex), this.graceMs);
      if (seat.disconnectTimer.unref) seat.disconnectTimer.unref();
      return;
    }
    if (this.state === STATES.IN_PROGRESS) {
      this._clearDisconnectTimer(seatIndex);
      const expiry = now() + this.graceMs;
      seat.disconnectExpiry = expiry;
      seat.disconnectTimer = setTimeout(() => this._onGraceExpireInProgress(seatIndex), this.graceMs);
      if (seat.disconnectTimer.unref) seat.disconnectTimer.unref();
    }
  }

  _clearDisconnectTimer(seatIndex) {
    const seat = this.seats[seatIndex];
    if (seat.disconnectTimer) { clearTimeout(seat.disconnectTimer); seat.disconnectTimer = null; }
  }

  _onGraceExpirePreStart(seatIndex) {
    const seat = this.seats[seatIndex];
    seat.disconnectTimer = null;
    if (seat.connected) return;
    if (this.state !== STATES.OPEN && this.state !== STATES.SETUP) return;
    this._finalize(STATES.CANCELED, null);
  }

  _onGraceExpireInProgress(seatIndex) {
    const seat = this.seats[seatIndex];
    seat.disconnectTimer = null;
    if (this.state !== STATES.IN_PROGRESS) return;
    if (seat.connected) return;
    const other = 1 - seatIndex;
    const otherSeat = this.seats[other];
    if (!otherSeat.connected && otherSeat.disconnectExpiry != null && otherSeat.disconnectExpiry <= now()) {
      if (seat.disconnectExpiry === otherSeat.disconnectExpiry) {
        this._finalize(STATES.FINISHED, { type: 'NO_CONTEST', winner: null });
      } else if (seat.disconnectExpiry < otherSeat.disconnectExpiry) {
        this._finalize(STATES.FINISHED, { type: 'FORFEIT', winner: other });
      } else {
        this._finalize(STATES.FINISHED, { type: 'FORFEIT', winner: seatIndex });
      }
      return;
    }
    this._finalize(STATES.FINISHED, { type: 'FORFEIT', winner: other });
  }

  // 종료 전이의 단일 지점. revision은 여기서 **정확히 한 번** 오른다 — 단, 같은 동기 구간에서 이미 revision을
  // 올린 명령 경로(마지막 행동·기권)는 opts.bump=false로 부른다(전이 하나 = revision 하나).
  // opts.notify=false: 응답과 상대 푸시를 명령 경로(server.js)가 하므로 onFinalize 푸시를 생략한다.
  _finalize(state, result, opts) {
    opts = opts || {};
    if (TERMINAL_NO_BOARD.has(this.state)) return false; // 이미 닫힌 룸은 다시 전이하지 않는다
    if (this.state === STATES.FINISHED && state !== STATES.CLOSED) return false; // 확정된 결과는 덮어쓰지 않는다
    this.state = state;
    if (result) this.result = result;
    if (opts.bump !== false) this.revision += 1;
    for (let i = 0; i < 2; i++) {
      this._clearDisconnectTimer(i);
      const seat = this.seats[i];
      if (TERMINAL_NO_BOARD.has(state) && seat.credential) seat.credential.revokeAll();
    }
    if (TERMINAL_NO_BOARD.has(state) && this.engines) {
      for (const T of this.engines) { try { T.scheduler.clear(); } catch (e) { /* noop */ } }
      this.engines = null; // 보드 없는 종료 — 엔진 메모리 해제
    }
    if (opts.notify !== false && this.onFinalize) this.onFinalize(state, this.result);
    return true;
  }

  voidForRestart() { this._finalize(STATES.VOID, { type: 'NO_CONTEST', winner: null, reason: 'RESTART' }); }

  // 로비 정리(sweep)가 부른다 — 닫힘을 알린 뒤 소켓을 닫는다.
  close() {
    const changed = this._finalize(STATES.CLOSED, null);
    for (const seat of this.seats) {
      try { if (seat.ws) seat.ws.close(1000, 'room closed'); } catch (e) { /* noop */ }
    }
    return changed;
  }

  // 엔진 장애 — fail-closed. 어떤 좌석에도 원인 문자열을 싣지 않는다(서버 진단용 lastFault에만 남긴다).
  _engineFault(e) {
    this.lastFault = { at: now(), message: String((e && e.message) || e), kind: (e && e.kind) || null };
    this._finalize(STATES.VOID, { type: 'NO_CONTEST', winner: null, reason: 'E_INTERNAL' });
    return err('E_INTERNAL');
  }

  // ===== 명령 처리 =====

  handleCommand(seatIndex, msg) {
    if (msg.t === 'setup') return this._handleSetup(seatIndex, msg);
    if (msg.t === 'ready') return this._handleReady(seatIndex, true);
    if (msg.t === 'unready') return this._handleReady(seatIndex, false);
    if (msg.t === 'action') return this._handleAction(seatIndex, msg);
    if (msg.t === 'resign') return this._handleResign(seatIndex);
    if (msg.t === 'leave') return this.explicitLeave(seatIndex);
    if (msg.t === 'resync') return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex), noop: true };
    return err('E_BAD_ENVELOPE');
  }

  _dedupKey(seatIndex, requestId) { return seatIndex + ':' + requestId; }
  checkDedup(seatIndex, requestId) { const hit = this.dedup.get(this._dedupKey(seatIndex, requestId)); return hit ? hit.resp : null; }
  storeDedup(seatIndex, requestId, resp) { this.dedup.set(this._dedupKey(seatIndex, requestId), { resp, ts: now() }); }
  sweepDedup() { const cutoff = now() - DEDUP_TTL_MS; for (const [k, v] of this.dedup) if (v.ts < cutoff) this.dedup.delete(k); }

  // ===== 배치 (setup) — {roster:[6종], pos:[[r,c]×14]} (좌석0 기준 좌표, 좌석1은 엔진이 미러링) =====

  // applyNetSetup()이 "손상"으로 보고 무작위 배치로 대체할 모든 조건을 서버가 먼저 거부한다.
  // 거부는 좌석의 rawSetup·placed·ready를 전혀 바꾸지 않는다.
  _validateSetup(msg) {
    const roster = msg.roster, pos = msg.pos;
    if (!Array.isArray(roster) || !Array.isArray(pos)) return err('E_BAD_ENVELOPE');
    if (!roster.every((x) => typeof x === 'string' && x.length <= 64)) return err('E_BAD_ENVELOPE');
    if (!pos.every((q) => Array.isArray(q) && q.length === 2 && Number.isInteger(q[0]) && Number.isInteger(q[1]))) return err('E_BAD_ENVELOPE');
    const cat = catalog();
    if (roster.length !== ROSTER_SIZE) return err('E_ILLEGAL_ACTION');
    if (new Set(roster).size !== roster.length) return err('E_ILLEGAL_ACTION');
    if (!roster.every((id) => cat.rosterIds.has(id))) return err('E_ILLEGAL_ACTION');
    if (pos.length !== cat.piecesPerSeat) return err('E_ILLEGAL_ACTION');
    if (!pos.every((q) => cat.zone0.has(q[0]) && q[1] >= 1 && q[1] <= cat.cols)) return err('E_ILLEGAL_ACTION');
    if (new Set(pos.map((q) => q[0] + '_' + q[1])).size !== pos.length) return err('E_ILLEGAL_ACTION');
    return { ok: true };
  }

  _handleSetup(seatIndex, msg) {
    if (this.state === STATES.IN_PROGRESS || this.state === STATES.FINISHED) return err('E_MATCH_STARTED');
    if (this.state !== STATES.SETUP) return err('E_ILLEGAL_ACTION');
    const v = this._validateSetup(msg);
    if (!v.ok) return v;
    const seat = this.seats[seatIndex];
    seat.rawSetup = { roster: msg.roster.slice(), pos: msg.pos.map((q) => [q[0], q[1]]) };
    seat.placed = true;
    seat.ready = false; // 자기 배치를 바꾼 좌석의 ready만 해제 (analysis.md §2.3)
    this.revision += 1;
    return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
  }

  _handleReady(seatIndex, wantReady) {
    if (this.state === STATES.IN_PROGRESS || this.state === STATES.FINISHED) return err('E_MATCH_STARTED');
    if (this.state !== STATES.SETUP) return err('E_ILLEGAL_ACTION');
    const seat = this.seats[seatIndex];
    if (wantReady && !seat.placed) return err('E_ILLEGAL_ACTION');
    if (seat.ready === wantReady) return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex), noop: true };
    seat.ready = wantReady;
    this.revision += 1;
    if (this.seats[0].ready && this.seats[1].ready) {
      const started = this._startMatch();
      if (!started.ok) return started;
    }
    return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
  }

  // 원자적 시작 — 동기 구간 안에서 두 좌석 엔진 기동 → 배치 반영 확인 → 락스텝 일치 확인 → 전이.
  // 기존 온라인 경로의 netStart(seed,[setup0,setup1])를 좌석 시점 엔진마다 그대로 부른다.
  _startMatch() {
    const seed = this._testSeed != null ? this._testSeed : (crypto.randomBytes(4).readUInt32BE(0) & 0x7fffffff); // 서버 비밀 시드 — 어떤 프레임에도 나가지 않는다
    const setups = [this.seats[0].rawSetup, this.seats[1].rawSetup];
    let engines;
    try {
      engines = [createEngine(), createEngine()];
      engines.forEach((T, seat) => {
        withEngine(T, () => { T.NET.me = seat; T.netStart(seed, setups); });
        this._assertSetupApplied(T, setups);
      });
      const d0 = lockstepDigest(engines[0]), d1 = lockstepDigest(engines[1]);
      if (d0 !== d1) throw new Error('lockstep divergence at match start');
    } catch (e) {
      if (engines) for (const T of engines) { try { T.scheduler.clear(); } catch (x) { /* noop */ } }
      return this._engineFault(e);
    }
    this.engines = engines;
    this._consumedModalSeq = null;
    this.state = STATES.IN_PROGRESS;
    // revision: 이 시작은 ready 명령과 같은 동기 구간 — _handleReady가 이미 한 번 올렸다.
    return { ok: true };
  }

  // 검증을 통과한 배치가 무작위 대체 없이 그대로 반영됐는지 확인한다(서버 검증과 엔진 검증의 계약 드리프트 감지).
  _assertSetupApplied(T, setups) {
    const S = T.S;
    for (let p = 0; p < 2; p++) {
      const mine = S.pieces.filter((x) => x.owner === p);
      if (S.roster[p].join('|') !== setups[p].roster.join('|')) throw new Error('setup roster not applied for seat ' + p);
      mine.forEach((x, i) => {
        const r = p === 1 ? (catalog().rows + 1 - setups[p].pos[i][0]) : setups[p].pos[i][0];
        if (x.r !== r || x.c !== setups[p].pos[i][1] || !x.placed) throw new Error('setup position not applied for seat ' + p);
      });
    }
  }

  // ===== 게임 중 행동 =====

  _handleAction(seatIndex, msg) {
    if (this.state !== STATES.IN_PROGRESS || !this.engines) return err('E_ROOM_CLOSED');
    if (msg.baseRevision !== this.revision) return { ok: false, reason: 'E_STALE_REVISION', staleView: this.toSeatView(seatIndex) };
    const a = msg.action;
    if (!a || typeof a !== 'object' || !ACTION_TYPES.has(a.t)) return err('E_BAD_ENVELOPE');
    if (SETUP_ONLY_ACTIONS.has(a.t)) return err('E_ILLEGAL_ACTION');
    if (!this._sanitizeAction(a)) return err('E_BAD_ENVELOPE');
    if (a.t === 'resign') return this._handleResign(seatIndex);
    const auth = this._authorize(seatIndex, a);
    if (!auth.ok) return auth;
    return this._apply(seatIndex, auth.action);
  }

  // 필드 형태만 좁힌다 — 게임적 합법성은 _authorize가 판정한다.
  _sanitizeAction(a) {
    const smallInt = (v) => Number.isInteger(v) && v >= -100000 && v <= 100000;
    const smallStr = (v) => typeof v === 'string' && v.length <= 64;
    switch (a.t) {
      case 'cell': return smallInt(a.r) && smallInt(a.c);
      case 'skipMain': case 'search': case 'tele': case 'flee': case 'ball': case 'pass': case 'resign': case 'fleeSkip': return true;
      case 'endTurn': return a.auto === undefined || typeof a.auto === 'boolean';
      case 'heal': case 'fleeSwap': return smallStr(a.id);
      case 'act': return smallInt(a.k) || ACT_KINDS.has(a.k);
      case 'item': return smallInt(a.i);
      case 'pkgOpen': return smallStr(a.kind);
      case 'modal': return smallInt(a.seq) && smallInt(a.i);
      default: return false;
    }
  }

  // 지금 입력을 기다리는 동기화 모달(버튼이 있는 2차 선택 화면). 소유자 좌석의 엔진 DOM에서 실제로 떠 있는지 확인한다:
  // syncModal이 남아 있어도 (a) 이미 그 seq를 처리했거나 (b) 오버레이가 닫혔거나 (c) 다른 모달이 버튼을 교체했으면
  // 대기 중이 아니다(close()는 NET.syncModal을 지우지 않는다).
  _pendingModal() {
    if (!this.engines) return null;
    const sm0 = this.engines[0].NET.syncModal;
    if (!sm0 || !sm0.fns || !sm0.fns.length) return null;
    if (this._consumedModalSeq === sm0.seq) return null;
    const owner = sm0.owner;
    if (owner !== 0 && owner !== 1) return null;
    const To = this.engines[owner];
    const sm = To.NET.syncModal;
    if (!sm || sm.seq !== sm0.seq || !sm.fns || sm.fns.length !== sm0.fns.length) return null;
    const overlay = To.byId('overlay');
    if (!overlay || overlay.classList.contains('hidden')) return null;
    const kids = To.byId('obBtns').children;
    if (kids.length !== sm.fns.length) return null;
    const box = To.byId('overlayBox');
    return {
      seq: sm.seq, owner, count: sm.fns.length,
      disabled: kids.map((b) => !!b.disabled),
      html: box ? String(box.innerHTML).replace(/<div class="row" id="obBtns"><\/div>\s*$/, '') : '',
      buttons: kids.map((b) => ({ text: b.textContent, disabled: !!b.disabled })),
    };
  }

  _resolveOwnAlias(seatIndex, alias) {
    if (typeof alias !== 'string') return null;
    const pid = this._pidByAlias.get(alias);
    if (pid === undefined) return null;
    const p = this.engines[0].S.pieces.find((x) => x.id === pid);
    return p && p.owner === seatIndex ? p : null;
  }

  // 명시적 합법성 판정 — 반환 {ok:true, action:<엔진에 넘길 정규화된 액션>} 또는 거부.
  _authorize(seatIndex, a) {
    const T = this.engines[0];
    const S = T.S;
    if (S.phase !== 'play') return err('E_ILLEGAL_ACTION');

    // 1) 대기 중인 동기화 모달 — 소유자(NET.syncModal.owner)만, 모달 응답만
    const pm = this._pendingModal();
    if (pm) {
      if (seatIndex !== pm.owner) return err('E_NOT_ACTOR');
      if (a.t !== 'modal') return err('E_ILLEGAL_ACTION');
      if (a.seq !== pm.seq || a.i < 0 || a.i >= pm.count || pm.disabled[a.i]) return err('E_ILLEGAL_ACTION');
      return { ok: true, action: { t: 'modal', seq: a.seq, i: a.i } };
    }
    if (a.t === 'modal') return err(seatIndex === T.netActor() ? 'E_ILLEGAL_ACTION' : 'E_NOT_ACTOR');

    // 2) 도망 후 교환 선택 — 도망친 말의 소유자만
    if (S.fleePick) {
      const fp = S.fleePick;
      if (seatIndex !== fp.owner) return err('E_NOT_ACTOR');
      if (a.t === 'fleeSkip') return { ok: true, action: { t: 'fleeSkip', pick: fp.token } };
      if (a.t === 'fleeSwap') {
        const p = this._resolveOwnAlias(seatIndex, a.id);
        if (!p || !fp.cands.includes(p.id)) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'fleeSwap', id: p.id, pick: fp.token } };
      }
      if (a.t === 'cell') {
        const q = this._inBoard(a.r, a.c) ? T.at(a.r, a.c) : null;
        if (!q || !fp.cands.includes(q.id)) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'cell', r: a.r, c: a.c, pick: fp.token } };
      }
      return err('E_ILLEGAL_ACTION');
    }

    // 3) 전투 — 이번 전투 행동 차례(actorOfPhase)의 소유자만, 전투 어휘만
    if (S.battle) {
      const B = S.battle;
      const side = T.actorOfPhase();
      const ownerP = side === 'A' ? B.attP.owner : B.defP.owner;
      if (seatIndex !== ownerP) return err('E_NOT_ACTOR');
      const f = side === 'A' ? B.fa : B.fd;
      const opp = side === 'A' ? B.fd : B.fa;
      switch (a.t) {
        case 'act':
          return this._legalAct(T, f, side, a.k) ? { ok: true, action: { t: 'act', k: a.k } } : err('E_ILLEGAL_ACTION');
        case 'item': {
          const k = (S.inv[ownerP] || [])[a.i];
          if (a.i < 0 || k === undefined || !T.ITEMS || !T.ITEMS[k]) return err('E_ILLEGAL_ACTION');
          if (side === 'A' ? B.itemRoundA : B.itemRoundD) return err('E_ILLEGAL_ACTION'); // 라운드 1회
          return { ok: true, action: { t: 'item', i: a.i } };
        }
        case 'ball': {
          const oppPiece = side === 'A' ? B.defP : B.attP;
          const thrown = side === 'A' ? B.ballThrowA : B.ballThrowD;
          const canThrow = oppPiece.type === 'minion' && opp.hp < opp.maxHp * 0.3 && S.balls[ownerP] > 0 && !S.reserve[ownerP] && !thrown;
          return canThrow ? { ok: true, action: { t: 'ball' } } : err('E_ILLEGAL_ACTION');
        }
        case 'flee':
          return { ok: true, action: { t: 'flee' } };
        case 'pass': {
          const allLocked = !!f.skills && !f.skills.some((_, i) => T.slotUsable(f, i, side));
          return allLocked ? { ok: true, action: { t: 'pass' } } : err('E_ILLEGAL_ACTION');
        }
        case 'pkgOpen': {
          if (!PKG_KINDS.has(a.kind)) return err('E_ILLEGAL_ACTION');
          const pk = S.pkgs[ownerP];
          if (!pk || !(pk[a.kind] > 0)) return err('E_ILLEGAL_ACTION');
          if (a.kind === 'battleBuff' && (side === 'A' ? B.buffA : B.buffD)) return err('E_ILLEGAL_ACTION');
          return { ok: true, action: { t: 'pkgOpen', kind: a.kind } };
        }
        default:
          return err('E_ILLEGAL_ACTION'); // skipMain·tele·endTurn·heal·search·cell·fleeSwap … 전투 중 보드 입력 금지
      }
    }

    // 4) 보드 플레이 — S.current만
    if (seatIndex !== S.current) return err('E_NOT_ACTOR');
    const forcedPending = (S.forcedTargets && S.forcedTargets.length > 0) || (S.forcedQueue && S.forcedQueue.length > 0);
    switch (a.t) {
      case 'cell':
        return this._inBoard(a.r, a.c) ? { ok: true, action: { t: 'cell', r: a.r, c: a.c } } : err('E_ILLEGAL_ACTION');
      case 'skipMain':
        if (S.mainUsed || S.teleport || forcedPending) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'skipMain' } };
      case 'tele': {
        if (S.teleport) return { ok: true, action: { t: 'tele' } }; // 텔레포트 선택 취소
        const teleDis = S.mainUsed || !T.teleportAvailable(S.current) || S.teleUsed[S.current] >= T.BAL.teleMax;
        return teleDis ? err('E_ILLEGAL_ACTION') : { ok: true, action: { t: 'tele' } };
      }
      case 'search': {
        const sel = S.selected && !S.selected.tray ? S.selected : null;
        const ev = sel ? S.events.find((e) => e.r === sel.r && e.c === sel.c && !e.consumed && S.traces[S.current].has(e.r + '_' + e.c)) : null;
        if (!(sel && ev && !S.mainUsed && !S.teleport && sel.owner === S.current && T.canSearchPiece(sel))) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'search' } };
      }
      case 'heal': {
        const p = this._resolveOwnAlias(seatIndex, a.id);
        if (!p || !T.canHeal(p)) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'heal', id: p.id } };
      }
      case 'endTurn':
        // 원본 UI: 주 행동을 마친 뒤(생략 포함)에만 종료가 있다 — 자동 종료도 skipMain을 먼저 보낸다(autoEndCheck).
        if (!S.mainUsed || S.teleport || forcedPending) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: a.auto === true ? { t: 'endTurn', auto: true } : { t: 'endTurn' } };
      default:
        return err('E_ILLEGAL_ACTION'); // act·item·ball·flee·pass·pkgOpen·fleeSwap·fleeSkip — 이 phase의 입력이 아니다
    }
  }

  _inBoard(r, c) {
    const cat = catalog();
    return Number.isInteger(r) && Number.isInteger(c) && r >= 1 && r <= cat.rows && c >= 1 && c <= cat.cols;
  }

  // 전투 기술 입력의 합법성 — __actCore의 kind 해석(숫자 슬롯 / 'basic'·'skill'·'common')과 UI 버튼 활성 조건을 함께 본다.
  _legalAct(T, f, side, k) {
    if (typeof k === 'number') {
      return !!f.skills && Number.isInteger(k) && k >= 0 && k < f.skills.length && T.slotUsable(f, k, side);
    }
    if (k === 'basic') return f.skills ? T.slotUsable(f, 0, side) : true; // 왕·동료 본체: 기본 공격은 항상 가능
    if (k === 'skill') return f.skills ? T.slotUsable(f, 1, side) : (!!f.skillAtk && !f.cd);
    if (k === 'common') return !!f.skills && T.slotUsable(f, 2, side);
    return false;
  }

  _stateFingerprint() {
    return this.engines.map((T) => JSON.stringify(T.S) + '#' + lockstepDigest(T)).join('|');
  }

  // 판정을 통과한 입력을 두 좌석 엔진에 같은 순서로 적용한다(락스텝). NET.replaying=true는 원본 수신측 재생과 같은
  // 모드 — 행동자 화면 전용 로컬 팝업(메모 피커)을 열지 않는다.
  _apply(seatIndex, action) {
    const before = this._stateFingerprint();
    try {
      for (const T of this.engines) {
        withEngine(T, () => {
          T.NET.replaying = true;
          try { T.applyAction(action); } finally { T.NET.replaying = false; }
        });
      }
      if (action.t === 'modal') this._consumedModalSeq = action.seq;
      const d0 = lockstepDigest(this.engines[0]), d1 = lockstepDigest(this.engines[1]);
      if (d0 !== d1) throw new Error('lockstep divergence after ' + action.t);
    } catch (e) {
      return this._engineFault(e);
    }
    // #217 — engines가 살아있는 동안 좌석별 fx 창을 떠 둔다. noop이든(변경 없으면 events도 새로 안 늘어난다)
    // 이 행동이 바로 경기 종료로 이어지든(_finalize가 곧 this.engines=null로 비운다) 이 시점 스냅샷이 항상
    // 마지막으로 유효한 것이 되므로, 아래 분기와 무관하게 먼저 찍는다.
    for (let i = 0; i < 2; i++) this._fxCache[i] = this._snapshotFx(this.engines[i]);
    if (this._stateFingerprint() === before) {
      return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex), noop: true };
    }
    this.revision += 1;
    const S = this.engines[0].S;
    if (S.phase === 'over') {
      this._finalize(STATES.FINISHED, { type: 'WIN', winner: S.winner, winType: S.metrics.winType }, { bump: false, notify: false });
    }
    return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
  }

  // 기권 — 행위자가 아니라 S.current 기준이다(원본 netAction: a.t==="resign"?S.current:netActor(), confirmResign).
  _handleResign(seatIndex) {
    if (this.state !== STATES.IN_PROGRESS || !this.engines) return err('E_ROOM_CLOSED');
    const S = this.engines[0].S;
    if (S.phase !== 'play') return err('E_ILLEGAL_ACTION');
    if (S.current !== seatIndex) return err('E_NOT_ACTOR');
    try {
      for (const T of this.engines) withEngine(T, () => { T.applyAction({ t: 'resign' }); });
      if (lockstepDigest(this.engines[0]) !== lockstepDigest(this.engines[1])) throw new Error('lockstep divergence after resign');
    } catch (e) {
      return this._engineFault(e);
    }
    for (let i = 0; i < 2; i++) this._fxCache[i] = this._snapshotFx(this.engines[i]); // #217 — finalize 전에 마지막 창 확보
    this.revision += 1;
    const S2 = this.engines[0].S;
    this._finalize(STATES.FINISHED, { type: 'WIN', winner: S2.winner, winType: S2.metrics.winType }, { bump: false, notify: false });
    return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
  }

  // ===== 좌석 뷰 (analysis.md §2.6·§2.6.1·§2.6.2 화이트리스트) =====

  _alias(pid) {
    let a = this._aliasByPid.get(pid);
    if (a) return a;
    do { a = 'u-' + crypto.randomBytes(4).toString('base64url'); } while (this._pidByAlias.has(a));
    this._aliasByPid.set(pid, a);
    this._pidByAlias.set(a, pid);
    return a;
  }

  toSeatView(seatIndex) {
    const seat = this.seats[seatIndex];
    const ready = [this.seats[0].ready, this.seats[1].ready];
    if (this.state === STATES.OPEN || this.state === STATES.SETUP) {
      return {
        seat: seatIndex, state: this.state, phase: 'setup', revision: this.revision, current: null,
        seats: { ready }, units: [], you: { placed: seat.placed }, result: null, fx: this._fxCache[seatIndex],
      };
    }
    if (TERMINAL_NO_BOARD.has(this.state) || !this.engines) {
      // #217 — 이 분기는 finalize 직후(this.engines가 이미 null) 도달하지만, _apply/_handleResign이 그 直前에
      // 찍어 둔 _fxCache는 살아있다 — "종료 직후 battle=null에도 결과·마지막 타격 표시" 요구는 이 필드로 만족한다.
      return {
        seat: seatIndex, state: this.state, phase: this.state.toLowerCase(), revision: this.revision, current: null,
        seats: { ready }, units: [], you: { placed: seat.placed }, result: this.result, fx: this._fxCache[seatIndex],
      };
    }
    // 이 좌석 시점의 엔진 — 로그·전투 로그·모달 문구가 원본 그대로 이 좌석 관점이다.
    const T = this.engines[seatIndex];
    const S = T.S;
    const units = [];
    const youPieces = [];
    // #217 Mars 델타(msg_db7a8fa06aee) — 원본 index.html:1705 `viewer = ... (S.mode==="sim"||S.phase==="over")?2:...`
    // (#11 종료 리빌): 경기가 실제로 끝나(FINISHED) phase="over"가 되면 두 화면 모두 viewer===2로 렌더해
    // visibleTo/revealed 마스킹 없이 살아있는 모든 말의 위치·정체를 보여준다. FINISHED만 해당하고, 다른 종료
    // 상태(CANCELED/VOID/CLOSED)는 TERMINAL_NO_BOARD 분기가 애초에 board 자체를 비워 보내므로 이 리빌이
    // 새지 않는다.
    const revealAll = this.state === STATES.FINISHED;
    for (const p of S.pieces) {
      if (!p.alive || !p.placed) continue;
      if (p.owner === seatIndex) { youPieces.push(this._serializeOwn(T, p)); continue; }
      if (!revealAll && !T.visibleTo(seatIndex, p)) continue; // 등급 A — 레코드 자체를 뺀다(종료 리빌 제외)
      units.push(revealAll || p.revealed === true ? this._serializeKnownOpponent(p) : this._serializeUnknownOpponent(p));
    }
    const you = {
      pieces: youPieces,
      inv: (S.inv[seatIndex] || []).slice(),
      balls: S.balls[seatIndex],
      reserve: S.reserve[seatIndex] ? this._serializeOwn(T, S.reserve[seatIndex]) : null,
      pkgs: Object.assign({}, S.pkgs[seatIndex]),
      selected: S.selected && S.selected.owner === seatIndex && !S.selected.tray ? this._alias(S.selected.id) : null,
      placed: seat.placed,
      // #217 Mars ctx_75a85d4c58fb 델타 — 텔레포트 버튼 disable 계산(teleMax 도달)에 필요한 자기 사용 횟수뿐이라
      // 자기 정보다(상대 teleUsed는 내려주지 않는다).
      teleUsed: Number.isInteger(S.teleUsed && S.teleUsed[seatIndex]) ? S.teleUsed[seatIndex] : 0,
    };
    const battle = S.battle ? this._serializeBattle(T, S.battle, seatIndex) : null;
    const fleePick = S.fleePick ? {
      owner: S.fleePick.owner,
      // #217 Mars 델타 — 도망친 말 자체의 강조 표시(hl-sel)에 필요. cands와 같은 소유자 전용 게이트.
      pieceId: S.fleePick.owner === seatIndex ? this._aliasByRealId(S, S.fleePick.pieceId) : undefined,
      cands: S.fleePick.owner === seatIndex ? S.fleePick.cands.map((id) => this._aliasByRealId(S, id)) : undefined,
    } : null;
    // #217 Mars 델타 — 강제 전투/텔레포트 단계의 autoEndReady 오판(false skip/endTurn reject 루프)과 하이라이트
    // 복원에 필요한 최소 필드. 원본 UI도 이 값들을 **S.current 좌석의 화면에만** 그린다(위 index.html 1737-1741·
    // 1900-1906 조건 `!isAI(S.current)&&(!NET.mode||S.current===NET.me)` — 상대는 강제 전투 여부조차 보지 않는다).
    // 그래서 서버도 같은 게이트(S.current===seatIndex)로만 채운다. 별칭은 이 좌석 뷰에서 이미 visibleTo인
    // 말에만 발급한다(contactSet/forcedTargets는 항상 이 좌석 소유 말과 인접한 적이라 원래도 visibleTo이지만,
    // 방어적으로 다시 검사해 "이 좌석 뷰에 이미 있는 것"만 새는 걸 강제한다).
    const visibleTurnAlias = (pid) => {
      if (pid == null) return null;
      const p = S.pieces.find((x) => x.id === pid);
      if (!p || !p.alive || !p.placed) return null;
      if (p.owner !== seatIndex && !T.visibleTo(seatIndex, p)) return null;
      return this._alias(p.id);
    };
    const turn = S.current === seatIndex ? {
      teleport: S.teleport ? { stage: S.teleport.stage, piece: S.teleport.piece ? visibleTurnAlias(S.teleport.piece.id) : null } : null,
      forcedTargets: (S.forcedTargets || []).map(visibleTurnAlias).filter((a) => a !== null),
      forcedQueue: (S.forcedQueue || []).length,
      movedPiece: S.movedPiece ? visibleTurnAlias(S.movedPiece.id) : null,
      firstBattleWonByMover: !!S.firstBattleWonByMover,
      contactSet: (S.contactSet || []).map(visibleTurnAlias).filter((a) => a !== null),
    } : null;
    const events = (S.events || []).filter((e) => S.traces[seatIndex] && S.traces[seatIndex].has(e.r + '_' + e.c) && !e.consumed)
      .map((e) => ({ r: e.r, c: e.c, kind: e.kind }));
    return {
      seat: seatIndex,
      state: this.state,
      phase: this.state === STATES.FINISHED ? 'over' : (S.fleePick ? 'flee' : (S.battle ? 'battle' : 'play')),
      revision: this.revision,
      turnCount: S.turnCount,
      current: S.current,
      mainUsed: S.mainUsed,
      battlesUsed: S.battlesUsed,
      seats: { ready },
      units,
      you,
      turn,
      battle,
      fleePick,
      modal: this._serializeModal(seatIndex),
      log: (S.log || []).slice(-40).map((l) => ({ msg: l.msg, cls: l.cls })),
      events,
      result: this.result,
      // #217 — engines가 살아있는 동안은 T.__fx를 직접(라이브) 읽는다. _apply/_handleResign가 명령 처리
      // 경로로만 _fxCache를 갱신하므로, 그 경로를 거치지 않고 엔진을 직접 조작하는 호출(예: 테스트 픽스처)
      // 뒤에 바로 조회해도 최신 이벤트를 놓치지 않는다 — _fxCache는 engines가 사라지는 종료 분기 전용 백업.
      fx: this._snapshotFx(T),
    };
  }

  // #217 — 전투 표시 이벤트 창. engine.js가 이미 캡처·정규화해 T.__fx에 쌓아 둔 것을 다시 화이트리스트
  // 재구성한다(room.js의 기존 _serialize* 관례 — 캡처 버퍼를 통째로 넘기지 않는다). engines가 살아있는 동안만
  // 부를 수 있다 — toSeatView 본 분기가 매번 라이브로 부르고, _apply/_handleResign도 finalize 直前에 한 번 더
  // 불러 Room._fxCache에 저장해 둔다(engines가 null이 된 뒤 toSeatView의 종료 분기가 그 캐시를 대신 쓴다).
  _snapshotFx(T) {
    const store = T.__fx;
    if (!store || !store.items.length) return { firstSeq: null, lastSeq: store ? store.nextSeq - 1 : 0, events: [] };
    return {
      firstSeq: store.items[0].seq,
      lastSeq: store.nextSeq - 1,
      events: store.items.map((e) => this._serializeFxEvent(e)),
    };
  }

  // #217 PD REVISE 2번 — battleId(연속 전투에서 옛 FX를 새 전투원에 적용 금지)·scene(battle=null 이후에도
  // 마지막 타격을 그릴 무대 식별) 재구성. scene은 engine.js가 이미 만들어 왔어도 여기서 다시 알려진 원시
  // 필드만 골라 재구성한다 — 캡처 경로를 신뢰하지 않는 이중 화이트리스트(room.js 기존 _serialize* 관례).
  _serializeFxScene(scene) {
    if (!scene || typeof scene !== 'object') return null;
    const side = (s) => (s && typeof s === 'object') ? {
      owner: s.owner === 0 || s.owner === 1 ? s.owner : null,
      type: typeof s.type === 'string' ? s.type : null,
      element: typeof s.element === 'string' ? s.element : null,
      bodyFight: !!s.bodyFight,
      rosterId: typeof s.rosterId === 'string' ? s.rosterId : null,
      artRosterId: typeof s.artRosterId === 'string' ? s.artRosterId : null,
    } : null;
    const a = side(scene.a), d = side(scene.d);
    return (a || d) ? { a, d } : null;
  }

  _serializeFxCells(cells) {
    if (!Array.isArray(cells)) return undefined;
    const out = cells.filter((c) => Array.isArray(c) && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1])).map((c) => [c[0], c[1]]).slice(0, 16);
    return out.length ? out : undefined;
  }

  // Saturn REVISE(fx-qa-revise.md P2, startedRoom(1874204)) — engine.js가 이미 normalizeMsgFx로 화이트리스트
  // 재구성한 값이라도, 여기서 그 객체(및 float/hp/st 서브 객체)를 **참조 그대로** 돌려주면 호출자가 반환된
  // view를 변조했을 때 T.__fx.items에 영구히 저장된 바로 그 객체가 함께 오염된다(같은 seq를 다시 읽어도
  // sameRef===true로 변조가 그대로 보임 — resync/재조회 스토어까지 물든다). scene(_serializeFxScene)·
  // cells(_serializeFxCells)처럼 매 호출마다 원시 필드만 골라 **새 객체**를 짓는다 — 내부 저장소와 반환값이
  // 항상 독립된 참조를 갖도록(이중 화이트리스트, room.js 기존 _serialize* 관례와 동일).
  _serializeFxMsgFx(fx) {
    if (!fx || typeof fx !== 'object') return null;
    const out = {};
    if (fx.shake === 'A' || fx.shake === 'D') out.shake = fx.shake;
    if (fx.sig === true) out.sig = true;
    if (typeof fx.flash === 'string') out.flash = fx.flash;
    if (fx.ko === 'A' || fx.ko === 'D') out.ko = fx.ko;
    if (fx.float && (fx.float.side === 'A' || fx.float.side === 'D') && (fx.float.sign === 'pos' || fx.float.sign === 'neg')) {
      out.float = { side: fx.float.side, sign: fx.float.sign, amount: Number(fx.float.amount) || 0 };
    }
    if (fx.hp && (fx.hp.side === 'A' || fx.hp.side === 'D')) {
      out.hp = { side: fx.hp.side, val: Number(fx.hp.val) || 0, max: Number(fx.hp.max) || 0 };
    }
    if (fx.st && (fx.st.side === 'A' || fx.st.side === 'D')) {
      out.st = { side: fx.st.side, text: typeof fx.st.text === 'string' ? fx.st.text : '',
        shield: Number(fx.st.shield) || 0, max: Number(fx.st.max) || 0 };
    }
    return Object.keys(out).length ? out : null;
  }

  _serializeFxEvent(e) {
    if (e.src === 'msg') {
      return {
        seq: e.seq, src: 'msg', battleId: Number.isInteger(e.battleId) ? e.battleId : null,
        round: e.round, actSeq: e.actSeq, key: e.key, big: e.big, txt: e.txt, fx: this._serializeFxMsgFx(e.fx),
      };
    }
    const out = {
      seq: e.seq, src: 'stage', battleId: Number.isInteger(e.battleId) ? e.battleId : null,
      turn: e.turn, key: e.key, kind: e.kind, title: e.title, sub: e.sub,
    };
    if (typeof e.cls === 'string' && e.cls) out.cls = e.cls;
    const cells = this._serializeFxCells(e.cells);
    if (cells) out.cells = cells;
    if (e.key === 'resultBanner' || e.key === 'battleStart') out.scene = this._serializeFxScene(e.scene);
    return out;
  }

  // 동기화 모달 — owner/seq/count는 양쪽에(누가 선택 중인지는 원본도 "상대 선택 대기 중"으로 보여 준다),
  // 실제 문구·버튼은 소유 좌석에만(그 좌석 엔진의 DOM에서 읽는다 — 원본 modal 래퍼가 비소유 엔진에서는 마스킹한다).
  _serializeModal(seatIndex) {
    const pm = this._pendingModal();
    if (!pm) return null;
    const view = { seq: pm.seq, owner: pm.owner, count: pm.count };
    if (pm.owner !== seatIndex) return view;
    view.html = pm.html;
    view.buttons = pm.buttons;
    return view;
  }

  _aliasByRealId(S, realId) {
    const p = S.pieces.find((x) => x.id === realId);
    return p ? this._alias(p.id) : null;
  }

  _serializeOwn(T, p) {
    return {
      id: this._alias(p.id), r: p.r, c: p.c, owner: p.owner, type: p.type, element: p.element,
      name: p.name, hp: p.hp, maxHp: p.maxHp, atk: p.atk, skillAtk: p.skillAtk,
      // #217 Earth art-omission-audit P0(2) — 자기 하수인 보드 아이콘(artDirOf)이 쓰는 유일한 키. 자기 말은 이미
      // type/element/skills까지 전부 공개되므로(§2.6.1) rosterId 추가는 새 노출이 아니다 — 종전 whitelist의 누락이었다.
      rosterId: p.rosterId || null,
      skills: this._skillsFor(T, p, true), cdMax: p.cdMax, immobile: p.immobile, cap: p.cap,
      healing: p.healing, alive: p.alive, placed: p.placed, movedEver: p.movedEver, revealed: p.revealed,
      burn: p.burn, weaken: p.weaken, shield: p.shield, shock: p.shock, dmgCut: p.dmgCut,
      focusCharge: p.focusCharge, vulnMark: p.vulnMark, powerBuff: p.powerBuff, fleeBoost: p.fleeBoost,
    };
  }

  // 등급 C-2 (공개된 상대): 정체·HP까지만. skills/cds/cap/전투 버프는 없다(§2.6.1).
  _serializeKnownOpponent(p) {
    return {
      id: this._alias(p.id), r: p.r, c: p.c, owner: p.owner, alive: p.alive, immobile: p.immobile,
      type: p.type, name: p.name, element: p.element, hp: p.hp, maxHp: p.maxHp, healing: p.healing,
      // #217 Saturn ctx_e6437fa06ae4 REVISE — 공개 상대 보드 하수인 아이콘(artDirOf)이 쓰는 유일한 키.
      // name이 이미 ROSTER 20종을 1:1로 특정하므로(art-restore-fields.md §"새 노출 아님") 형태만 추가하는
      // 표시 whitelist 복구다 — 정보량 증가 없음. 하수인이 아니면(왕/동료) 항상 null.
      rosterId: p.type === 'minion' ? (p.rosterId || null) : null,
    };
  }

  // 등급 B (미공개 상대): 위치·생존만.
  _serializeUnknownOpponent(p) {
    return { id: this._alias(p.id), r: p.r, c: p.c, owner: p.owner, alive: p.alive, immobile: p.immobile };
  }

  // 자기 전투원의 기술은 전부, 상대 전투원의 기술은 revealedSkills에 있는 인덱스만 이름·쿨을 싣는다 (§2.6.2).
  _skillsFor(T, p, mine) {
    if (!p.skills) return null;
    return p.skills.map((sid, i) => {
      const sk = T.SKILLS && T.SKILLS[sid];
      if (mine || (p.revealedSkills && p.revealedSkills.includes(i))) {
        return { i, revealed: true, id: sid, name: T.skillNameKo ? T.skillNameKo(sid, p.element) : sid, cd: p.cds ? p.cds[i] : 0 };
      }
      return { i, revealed: false, kind: sk ? sk.kind : null };
    });
  }

  // 전투 문맥 공개 (§2.6.2) — 그 전투 동안 양쪽이 이미 보는 hp/shield/상태·이 전투에서 쓴 아이템/볼/버프 기록.
  _serializeBattle(T, battle, seatIndex) {
    const side = (owner, f, piece, sfx) => {
      const bodyFight = f === piece; // 본체 출전(f===piece) vs 포획·예비 하수인 대리 출전(#91 artDirOfFighter와 같은 구분)
      return {
        owner, hp: f.hp, maxHp: f.maxHp, shield: f.shield || 0, burn: f.burn || 0, weaken: f.weaken || 0,
        shock: f.shock || 0, shockFresh: !!f.shockFresh, dmgCut: f.dmgCut || 0, focusCharge: !!f.focusCharge,
        // 기존 버그: 대리 출전이면 실제 싸우는 건 f(cap)인데 piece(왕/동료 본체, skills:null)를 읽어 항상 null이 됐다.
        vulnMark: !!f.vulnMark, skills: this._skillsFor(T, f, owner === seatIndex),
        // #217 Mars ctx_75a85d4c58fb 델타 — cd/atk/skillAtk는 제안 후 Mars가 철회했다(msg_db7a8fa06aee):
        // 왕/동료 본체는 BAL.ally/king에 skill이 없어 skillAtk=0·스킬 버튼 자체가 없으므로 cd가 항상 무의미하고,
        // atk/skillAtk도 자기 pieces/cap 또는 공개 ROSTER/BAL로 대부분 유도 가능해 필수 노출이 아니다(포획 대리
        // 출전의 상대 cap 수치만 유도 불가하지만 원본 UI도 그 경우 "?"만 보여줄 뿐이다) — 불필요한 공개 확장은
        // 하지 않는다.
        rec: battle['rec' + sfx] || 0, items: battle['items' + sfx] || 0, itemRound: !!battle['itemRound' + sfx],
        lastItem: battle['lastItem' + sfx] != null ? battle['lastItem' + sfx] : null,
        ballThrow: !!battle['ballThrow' + sfx], buff: battle['buff' + sfx] || null,
        /* #217 Earth art-omission-audit P0(1) — 전투 무대 스프라이트(원본 token()/artDirOfFighter/leaderBattleDir) 복원에
           필요한 최소 식별자. 전투는 지금 이 좌석과 상대가 서로 인접해야만 시작되므로(§4.4 cell 판정) 두 전투원은
           이미 상호 visibleTo이고 startRounds()가 즉시 양쪽 piece.revealed=true를 세운다 — 그래서 상대 쪽에 보내는
           type/element/(본체 minion의) rosterId — **v4.2(Saturn ctx_e6437fa06ae4 REVISE)부터는 `_serializeKnownOpponent`
           (등급 C-2)도 같은 조건(`type==='minion'`)으로 rosterId 를 보내므로 형태까지 동치다**(art-restore-fields.md
           §v4.2). v4.2 이전에도 정보량 자체는 이미 동치였다 — `name`이 로스터 20종을 1:1로 특정하므로(같은 이름을
           쓰는 두 종이 없다), 상대는 units 배열의 name 만으로도 이 rosterId 가 가리키는 동일한 종을 알 수 있었다.
           즉 이 필드가 늘려주는 것은 처음부터 "표시용 키 형태"뿐이었고 판별 가능한 정보량은 v4.2 전후로 변화가 없다.
           진짜 새로 늘어나는 값은 대리 출전(포획/예비)의 artRosterId뿐이다 — 보드 뷰의 cap은 상대에게 절대 안 보내므로
           (§2.6.1) 이 필드만은 형태·정보량 모두 새 노출이다. 다만 정책 신설이 아니라 기존 승인(#91) 동작의 복원이다:
           원본 `token()`/`artDirOfFighter()`(demo/index.html)는 `viewer`/`NET.me`로 분기하지 않고 `pf`(battle.fa/fd)
           기준으로 스프라이트를 그리고, #91 승인 스모크(`smoke_minion_art.js` K9e)가 "전투 스테이지(출전 공개 후)에서만
           대리 전투원의 종이 나타난다"를 명시적으로 고정했다. 권위화 이전 온라인 모델은 두 클라이언트가 각자 전체 로컬
           상태로 같은 락스텝을 돌렸으므로(§0, `hello`/`hello2`) 이 마스킹 없는 렌더가 곧 "양쪽 다 봄"이었다 — 다만 실제
           2브라우저 온라인 접속으로 이 경로를 검증한 기록은 #91 당시에도 없었다(Saturn `issue91-saturn.md`: "실제 온라인
           2연결의 end-to-end 포획/대리 출전 … 은 미검증"). 그래서 이 한 필드는 "코드·승인 계약상 명확히 기존 동작"이되
           "실제 교차 브라우저로 그 순간을 본 적은 없다"는 caveat과 함께 문서화한다(art-restore-fields.md 참조).
           전투가 끝나 battle 객체가 사라지면 이 필드도 함께 사라진다 — board 뷰로 새지 않는다.
           기술 종류(kind)/이름/쿨의 은닉 범위는 그대로다(위 skills 라인). */
        type: piece.type, element: f.element || null, bodyFight,
        rosterId: bodyFight && piece.type === 'minion' ? (piece.rosterId || null) : null,
        artRosterId: bodyFight ? null : (f.artRosterId || null),
      };
    };
    return {
      round: battle.round,
      phase: battle.phase,
      actor: T.actorOfPhase ? T.actorOfPhase() : null,
      actSeq: battle.actSeq || 0,
      maxRounds: battle.maxRounds != null ? battle.maxRounds : null,
      // #217 Mars 델타 — fx.events의 battleId(§7.2)와 같은 값을 battle 스냅샷에도 직접 실어, 연속 전투 중
      // "지금 이 battle 객체가 어느 fx 창 battleId와 대응하는지"를 클라이언트가 fx 이벤트 join 없이 바로 안다.
      // engine.js hookBattleAccessor가 S.battle 대입 순간 발급하는 같은 카운터(T.__fx.lastBattleId)를 읽을
      // 뿐 새 값을 만들지 않는다 — battle이 열려 있는 한 항상 정수다.
      battleId: T.__fx && Number.isInteger(T.__fx.lastBattleId) ? T.__fx.lastBattleId : null,
      a: side(battle.attP.owner, battle.fa, battle.attP, 'A'),
      d: side(battle.defP.owner, battle.fd, battle.defP, 'D'),
      log: (battle.blog || []).slice(-40), // 이 좌석 시점 엔진의 전투 로그
    };
  }

  lobbyRow() {
    return { roomId: this.roomId, label: '방 #' + this.roomId, ageSec: Math.floor((now() - this.createdAt) / 1000), seats: '1/2' };
  }

  isListable() { return this.isPublic && this.state === STATES.OPEN; }
}

module.exports = { Room, STATES, DISCONNECT_GRACE_MS, ACTION_TYPES, lockstepDigest, catalog };
