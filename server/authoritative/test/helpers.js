'use strict';
// #217 서버 테스트 공용 픽스처 — Saturn 최소 재현 픽스처(msg_9a62b8728ecf)를 그대로 따른다:
// roster=T.ROSTER.slice(0,6).map(x=>x.id), pos=T.zoneOf(0)의 첫 14칸, Room openHostSeat/joinGuestSeat(OPEN 가짜 소켓),
// 양 좌석 _handleSetup, 양 좌석 _handleReady.
const { Room, STATES, lockstepDigest, BATTLE_CMDS, battleFrame } = require('../room');
const { createEngine, withEngine } = require('../engine');

function makeCounter(name) {
  let pass = 0, fail = 0;
  return {
    ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } },
    done() {
      console.log(`${name}: ${pass} passed, ${fail} failed`);
      process.exitCode = fail > 0 ? 1 : (process.exitCode || 0);
      return fail;
    },
  };
}

function fakeWs() {
  const ws = { readyState: 1, sent: [], closed: null };
  ws.send = (s) => { ws.sent.push(JSON.parse(s)); };
  ws.close = (code, reason) => { ws.closed = { code, reason }; ws.readyState = 3; };
  return ws;
}

let SETUP = null;
function makeSetup() {
  if (!SETUP) {
    const T = createEngine();
    const roster = T.ROSTER.slice(0, 6).map((x) => x.id);
    const pos = [];
    for (const r of T.zoneOf(0)) for (let c = 1; c <= 7 && pos.length < 14; c++) pos.push([r, c]);
    SETUP = { roster, pos };
  }
  return { roster: SETUP.roster.slice(), pos: SETUP.pos.map((q) => q.slice()) };
}

function setupRoom(id, opts) {
  const room = new Room(id, Object.assign({ isPublic: false, epoch: 'aaaaaaaa', graceMs: 5000 }, opts || {}));
  room.openHostSeat(fakeWs());
  room.joinGuestSeat(fakeWs());
  return room;
}

function startedRoom(id, opts) {
  const room = setupRoom(id, opts);
  room._handleSetup(0, makeSetup()); room._handleSetup(1, makeSetup());
  room._handleReady(0, true); room._handleReady(1, true);
  if (room.state !== STATES.IN_PROGRESS) throw new Error('fixture room did not start: ' + JSON.stringify(room.lastFault));
  return room;
}

// 두 좌석 엔진에 같은 조작을 락스텝으로 적용한다. fn(T, seat)는 그 엔진의 객체만 다뤄야 한다 — 말은 id로 찾는다.
function both(room, fn) {
  room.engines.forEach((T, seat) => withEngine(T, () => fn(T, seat)));
  const d0 = lockstepDigest(room.engines[0]), d1 = lockstepDigest(room.engines[1]);
  if (d0 !== d1) throw new Error('test fixture broke lockstep');
}

function byId(T, id) { return T.S.pieces.find((p) => p.id === id); }

// 거부 검증용 — 엔진 두 개의 전체 S·모달 seq·revision·ready를 한 문자열로.
function snap(room) {
  const eng = room.engines ? room.engines.map((T) => JSON.stringify(T.S) + '#' + lockstepDigest(T)).join('|') : 'no-engine';
  return JSON.stringify({ rev: room.revision, state: room.state, ready: room.seats.map((s) => s.ready), placed: room.seats.map((s) => s.placed), raw: room.seats.map((s) => s.rawSetup) }) + eng;
}

/* #245 — 클라이언트 netAction 과 같은 자리에서 전투 어휘에 겨냥 프레임(bf)을 붙인다: 전투가 살아 있고
   bf 를 명시하지 않은 전투 명령만. bf 를 직접 실은(또는 일부러 뺀) 액션은 그대로 보낸다 — 거부 검증용이다. */
function withFrame(room, action) {
  if (!room.engines || !BATTLE_CMDS.has(action.t) || 'bf' in action) return action;
  const bf = battleFrame(room.engines[0]);
  return bf ? Object.assign({}, action, { bf }) : action;
}

function act(room, seat, action) {
  return room._handleAction(seat, { baseRevision: room.revision, action: withFrame(room, action) });
}

/* #245 — 전투 픽스처. battleStart reducer 의 신뢰 경계는 "이 보드에 실제로 서 있는 서로 다른 편의 **인접한**
   두 말"을 요구한다(core.js battleStart: movablePiece · adj · canBattle). 종전 픽스처는 배치 그대로 보드
   양 끝에 있는 두 하수인을 그대로 initBattle 에 넘겼고, 그때는 initBattle 이 넘어온 말을 그대로 믿었다.
   경계를 약하게 만들지 않는다 — **전제를 진짜로 만든다**: 방어자를 공격자 옆 빈 칸으로 옮긴 뒤 연다.
   좌석 엔진마다 같은 좌표를 쓰므로 락스텝은 그대로다(both() 가 요약 일치를 확인한다). */
function seatPair(T, cur) {
  return {
    att: T.S.pieces.find((p) => p.owner === cur && p.type === 'minion' && p.alive && p.placed),
    def: T.S.pieces.find((p) => p.owner === 1 - cur && p.type === 'minion' && p.alive && p.placed),
  };
}

// 방어자를 공격자와 직교 인접한 빈 칸으로 옮긴다. 옮길 칸이 없으면 픽스처 결함이므로 조용히 넘어가지 않는다.
function moveAdjacent(T, attId, defId) {
  const att = byId(T, attId), def = byId(T, defId);
  if (!att || !def) throw new Error('fixture: battle 참가자를 찾지 못함');
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const r = att.r + dr, c = att.c + dc;
    if (r < 1 || r > T.ROWS || c < 1 || c > T.COLS) continue;
    const occ = T.at(r, c);
    if (occ && occ !== def) continue;
    def.r = r; def.c = c;
    return;
  }
  throw new Error('fixture: 공격자 주변에 빈 칸이 없어 인접 배치를 만들 수 없음');
}

/* 두 좌석 엔진에서 같은 두 말을 인접시킨 뒤 전투를 연다 — 합법 경로(battleStart reducer)를 그대로 지난다.
   반환 {att,def} 는 실제로 전투를 연 말 id. 전투가 열리지 않으면 던진다(픽스처 전제 실패를 삼키지 않는다). */
function openBattle(room, ids) {
  const T = room.engine;
  const pair = ids || (() => { const p = seatPair(T, T.S.current); return { att: p.att.id, def: p.def.id }; })();
  both(room, (E) => {
    /* canBattle 은 "지금 차례인 쪽이 건다"를 요구한다(core.js: att.owner!==state.current → false). 픽스처가
       고른 공격자가 그 턴의 주인이 되도록 턴 주인과 턴 소모 칸을 **그 턴의 시작 상태로** 맞춘다 — 게이트를
       끄는 것이 아니라 그 게이트가 통과시키는 정상 상태를 만드는 것이다(종전 initBattle 은 아예 보지 않았다).
       두 좌석 엔진에 같은 값을 쓰므로 락스텝은 그대로다. */
    const att = byId(E, pair.att);
    E.S.current = att.owner;
    E.S.battlesUsed = 0;
    moveAdjacent(E, pair.att, pair.def);
    /* 폭탄은 스스로 전투를 걸 수 없다(canBattle: att.type==='bomb' → false). 폭탄이 전투에 들어가는 유일한
       규칙 경로는 **강제 접촉 이행**이다 — 그 말이 방금 움직였고(movedPiece) 그 상대가 강제 표식에 올라 있을 때.
       그래서 폭탄 픽스처에는 그 전제를 세우고(reducer 의 forced 갈래를 그대로 지난다), 나머지는 비운다. */
    if (att.type === 'bomb') { E.S.movedPiece = att; E.S.forcedTargets = [pair.def]; }
    else { E.S.forcedTargets = []; }
  });
  const liveBefore = [byId(T, pair.att).alive, byId(T, pair.def).alive];
  both(room, (E) => { E.initBattle(byId(E, pair.att), byId(E, pair.def)); });
  /* 접촉이 실제로 처리됐는지만 본다 — 규칙이 정하는 결과는 셋 중 하나다:
       · 전투 인스턴스가 열린다(하수인 등 보통 접촉)
       · **출전 선택(S.entryPick)** 에서 먼저 멈춘다(동료·왕) — 답은 battleEntryPick/battleEntryGo 액션이다
       · 그 자리에서 끝난다(폭탄 발동·함정) — 전투 인스턴스 없이 말이 제거된다
     셋 다 아니면 픽스처 전제가 깨진 것이다(조용히 넘어가지 않는다). */
  const liveAfter = [byId(T, pair.att).alive, byId(T, pair.def).alive];
  const resolved = String(liveBefore) !== String(liveAfter);
  if (!T.S.battle && !T.S.entryPick && !resolved) throw new Error('fixture: battle did not open — ' + JSON.stringify(pair));
  return pair;
}

module.exports = { makeCounter, fakeWs, makeSetup, setupRoom, startedRoom, both, byId, snap, act, withFrame, seatPair, moveAdjacent, openBattle, Room, STATES, createEngine, withEngine, lockstepDigest, battleFrame };
