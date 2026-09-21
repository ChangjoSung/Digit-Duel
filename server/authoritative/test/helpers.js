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

module.exports = { makeCounter, fakeWs, makeSetup, setupRoom, startedRoom, both, byId, snap, act, withFrame, Room, STATES, createEngine, withEngine, lockstepDigest, battleFrame };
