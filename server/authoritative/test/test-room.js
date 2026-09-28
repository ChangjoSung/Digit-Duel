'use strict';
// Room 상태 기계 + 실제 규칙 엔진(engine.js → demo/index.html) 통합 단위 테스트.
// 타이머(graceMs)는 짧게 주입해 60초 대기 없이 F1/F2/F6/F7을 검증한다.
// v4: 매치 엔진은 좌석 시점 엔진 쌍(room.engines)이다 — 엔진 상태를 직접 조작할 때는 H.both()로 두 엔진에 같이 적용한다.
const H = require('./helpers');
const { STATES, both, byId } = H;
const { ok, done } = H.makeCounter('room');

const realSetTimeout = global.setTimeout;
function sleep(ms) { return new Promise((r) => realSetTimeout(r, ms)); }
const { fakeWs, makeSetup } = H;

async function main() {
  // ===== 매치 시작 — 원자성(F4)과 실제 엔진 기동 =====
  const room1 = new H.Room(1, { isPublic: false, epoch: 'aaaaaaaa', graceMs: 50 });
  room1.openHostSeat(fakeWs());
  room1.joinGuestSeat(fakeWs());
  const setup0 = makeSetup(), setup1 = makeSetup();
  const s1 = room1._handleSetup(0, setup0);
  ok(s1.ok, 'setup(0) 수락: ' + JSON.stringify(s1.reason));
  const s2 = room1._handleSetup(1, setup1);
  ok(s2.ok, 'setup(1) 수락: ' + JSON.stringify(s2.reason));
  const r1 = room1._handleReady(0, true);
  ok(r1.data.phase === 'setup' && r1.data.state === 'SETUP', '한쪽만 ready면 아직 setup 단계');
  const r2 = room1._handleReady(1, true);
  ok(room1.state === STATES.IN_PROGRESS, 'F4 양쪽 ready → 원자적으로 IN_PROGRESS: ' + room1.state);
  ok(Array.isArray(room1.engines) && room1.engines.length === 2 && room1.engines[0] !== room1.engines[1], '좌석 시점 엔진 쌍이 생성됨');
  // #245 — 좌석 시점은 호스트 포트가 준다(종전 NET.me/NET.mode). Core 는 UI_PORT.seat() 로만 시점을 읽는다.
  ok(room1.engines[0].host.seat === 0 && room1.engines[1].host.seat === 1
    && room1.engines.every((E, i) => E.UI_PORT.seat() === i), '엔진마다 좌석 시점이 그 좌석으로 고정(원본 온라인 시점)');
  ok(H.lockstepDigest(room1.engines[0]) === H.lockstepDigest(room1.engines[1]), '시작 직후 두 엔진의 규칙 상태 일치(락스텝)');
  ok(room1.engine.S.pieces.filter((p) => p.alive && p.placed).length === 28, '양측 14기씩 총 28기 배치');
  ok(r2.data.phase === 'play' && r2.data.state === 'IN_PROGRESS', 'F4 시작 후 phase=play: ' + JSON.stringify(r2.data.phase));

  const lateSetup = room1._handleSetup(0, setup0);
  ok(lateSetup.reason === 'E_MATCH_STARTED', '시작 후 setup 거부: ' + JSON.stringify(lateSetup));
  const lateReady = room1._handleReady(0, true);
  ok(lateReady.reason === 'E_MATCH_STARTED', '시작 후 ready 거부: ' + JSON.stringify(lateReady));

  // ===== A1/A5 — 좌석 뷰 화이트리스트 =====
  const view0 = room1.toSeatView(0);
  ok(view0.you.pieces.length === 14, '자기 좌석 뷰에는 14기 전부: ' + view0.you.pieces.length);
  ok(view0.you.pieces.every((p) => 'hp' in p && 'type' in p && 'skills' in p), '자기 유닛은 전체 필드를 가진다');
  for (const u of view0.units) {
    const keys = Object.keys(u);
    ok(!keys.includes('hp') && !keys.includes('type') && !keys.includes('skills') && !keys.includes('name'), 'A5 미공개 상대 유닛에 정체/HP/스킬 미노출: ' + JSON.stringify(keys));
  }
  ok(view0.units.length > 0, 'A5 숲 밖 상대 유닛은 보인다(위치·생존만): ' + view0.units.length);
  const view1 = room1.toSeatView(1);
  ok(view1.units.length === view0.you.pieces.filter((p) => p.alive).length, '시작 시점엔 상대 전 병력이 숲 밖이라 전부 위치가 보임(등급 A 없음)');
  const bothViews = JSON.stringify([view0, view1]);
  ok(!/seed/i.test(bothViews), 'A4 좌석 뷰 어디에도 seed 키가 없음');
  ok(view0.log.some((l) => /당신은 P1/.test(l.msg)) && view1.log.some((l) => /당신은 P2/.test(l.msg)), '좌석마다 자기 시점 엔진의 로그(원본 netStart 문구 "당신은 P1/P2")');

  // ===== 인가 — 상대 턴 이동 시도 거부 (B1) =====
  const current = room1.engine.S.current;
  const notCurrent = 1 - current;
  const mv = room1._handleAction(notCurrent, { baseRevision: room1.revision, action: { t: 'cell', r: 1, c: 1 } });
  ok(mv.reason === 'E_NOT_ACTOR', 'B1 상대 턴 행동 거부: ' + JSON.stringify(mv));

  // ===== 정상 이동 + endTurn → 턴 교대 =====
  const mine = room1.engine.S.pieces.filter((p) => p.owner === current && p.alive && p.placed && p.type === 'minion')[0];
  const dr = current === 0 ? mine.r - 1 : mine.r + 1;
  const selectRes = room1._handleAction(current, { baseRevision: room1.revision, action: { t: 'cell', r: mine.r, c: mine.c } });
  ok(selectRes.ok, '자기 말 선택: ' + JSON.stringify(selectRes.reason));
  const moveRes = room1._handleAction(current, { baseRevision: room1.revision, action: { t: 'cell', r: dr, c: mine.c } });
  ok(moveRes.ok && room1.engines.every((E) => E.S.mainUsed === true && byId(E, mine.id).r === dr), '이동 성공 — 두 엔진 모두 mainUsed=true·좌표 반영');
  const endRes = room1._handleAction(current, { baseRevision: room1.revision, action: { t: 'endTurn' } });
  ok(endRes.ok && room1.engine.S.current === notCurrent, 'endTurn 후 턴 교대: ' + room1.engine.S.current);

  // ===== A1 — 등급 A(숲 안·비인접·tempReveal 없음)는 레코드 자체가 빠진다 =====
  {
    const victim = room1.engine.S.pieces.find((p) => p.owner === notCurrent && p.alive && p.placed && p.type !== 'trap');
    const saved = room1.engines.map((E) => E.S.pieces.map((p) => [p.r, p.c, p.revealed]));
    both(room1, (E) => {
      for (const p of E.S.pieces) if (p.owner === current && p.alive && p.placed) { p.r = 12; p.c = (p.c % 7) + 1; }
      const v = byId(E, victim.id); v.r = 4; v.c = 4; v.revealed = false;
    });
    const viewOfCurrent = room1.toSeatView(current);
    ok(!viewOfCurrent.units.some((u) => u.id === room1._alias(victim.id)), 'A1 숲 속·비인접 상대 유닛은 units에서 완전히 빠짐');
    both(room1, (E) => { E.S.pieces.forEach((p, i) => { const s = saved[E.host.seat][i]; p.r = s[0]; p.c = s[1]; p.revealed = s[2]; }); });
  }

  // ===== C3 — 낡은 baseRevision =====
  const stale = room1._handleAction(notCurrent, { baseRevision: room1.revision - 1, action: { t: 'endTurn' } });
  ok(stale.reason === 'E_STALE_REVISION' && stale.staleView && stale.staleView.revision === room1.revision, 'C3 낡은 baseRevision 거부 + 최신 뷰 동봉: ' + JSON.stringify(stale.reason));

  // ===== 기권 =====
  const wrongResign = room1._handleResign(current);
  ok(wrongResign.reason === 'E_NOT_ACTOR', '기권도 S.current 기준: ' + JSON.stringify(wrongResign));
  const revBeforeResign = room1.revision;
  const resign = room1._handleResign(notCurrent);
  ok(resign.ok && room1.state === STATES.FINISHED && room1.result.type === 'WIN' && room1.result.winner === current,
    '기권 후 상대 승리 확정: ' + JSON.stringify(room1.result));
  ok(room1.revision === revBeforeResign + 1, '기권 종료 전이는 revision을 정확히 한 번 올림: ' + (room1.revision - revBeforeResign));
  ok(resign.data.phase === 'over' && resign.data.state === 'FINISHED', '기권 응답 뷰 phase=over');

  // ===== B6 — 독립 배치(순서 무관, 동시 ready) =====
  {
    const room2 = new H.Room(2, { isPublic: false, epoch: 'bbbbbbbb', graceMs: 50 });
    room2.openHostSeat(fakeWs());
    room2.joinGuestSeat(fakeWs());
    room2._handleSetup(1, makeSetup());
    room2._handleSetup(0, makeSetup());
    room2._handleReady(1, true);
    ok(room2.state === STATES.SETUP, 'B6 한쪽만 ready — 아직 시작 전');
    const rev = room2.revision;
    const again = room2._handleReady(1, true);
    ok(again.ok && again.noop && room2.revision === rev, '이미 ready인 좌석의 ready 재전송은 noop(revision 불변)');
    room2._handleReady(0, true);
    ok(room2.state === STATES.IN_PROGRESS, 'B6 순서 무관 — 양쪽 ready 시 시작');
  }
  // 자기 배치 수정은 자기 ready만 해제한다
  {
    const room = H.setupRoom(21);
    room._handleSetup(0, makeSetup()); room._handleSetup(1, makeSetup());
    room._handleReady(1, true);
    room._handleSetup(1, makeSetup());
    ok(room.seats[1].ready === false && room.state === STATES.SETUP, '배치를 다시 보낸 좌석의 ready만 해제');
    room._handleReady(0, true);
    ok(room.seats[0].ready === true && room.state === STATES.SETUP, '상대 ready는 유지, 아직 시작 전');
  }

  // ===== F1/F2/F6/F7 — 생명주기 (그레이스 타이머 — 네이티브 setTimeout) =====
  {
    const room = new H.Room(3, { isPublic: false, epoch: 'aaaaaaaa', graceMs: 30 });
    room.openHostSeat(fakeWs());
    room.joinGuestSeat(fakeWs());
    const rev = room.revision;
    room.socketClosed(1);
    await sleep(80);
    ok(room.state === STATES.CANCELED && room.revision === rev + 1, 'F1 SETUP 유예 만료 → CANCELED, revision +1: ' + room.state);
    ok(room.result === null && room.toSeatView(0).phase === 'canceled', 'F1 CANCELED는 승패 없음·phase=canceled');
  }
  {
    const room = H.startedRoom(4, { graceMs: 30 });
    room.socketClosed(1);
    await sleep(80);
    ok(room.state === STATES.FINISHED && room.result.type === 'FORFEIT' && room.result.winner === 0, 'F2 경기 중 유예 만료 → 상대 몰수승: ' + JSON.stringify(room.result));
  }
  {
    const room = H.startedRoom(41, { graceMs: 60 });
    room.socketClosed(1);
    await sleep(10);
    const res = room.resumeSeat(1, room.seats[1].credential.current, fakeWs());
    await sleep(100);
    ok(res.ok && room.state === STATES.IN_PROGRESS && room.seats[1].connected, '유예 중 재개하면 몰수 타이머 취소·경기 유지');
  }
  {
    const room = H.setupRoom(5, { graceMs: 500 });
    const res = room.explicitLeave(1);
    ok(res.ok && room.state === STATES.CANCELED, 'F6 SETUP에서 명시적 leave는 즉시 CANCELED');
    ok(room.seats.every((s) => s.credential.classify(s.credential.current) === 'current') && res.data.phase === 'canceled', 'CANCELED 뷰 phase=canceled');
  }
  {
    const room = H.startedRoom(6, { graceMs: 500 });
    const rev = room.revision;
    const res = room.explicitLeave(1);
    ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && room.state === STATES.IN_PROGRESS && room.revision === rev, 'F6 경기 중 leave는 거부되고 상태·revision 불변');
  }
  {
    const room = H.startedRoom(7, { graceMs: 30 });
    room.socketClosed(0);
    await sleep(10);
    room.socketClosed(1);
    await sleep(80);
    ok(room.state === STATES.FINISHED && room.result.type === 'FORFEIT' && room.result.winner === 1, 'F7 먼저 만료된 좌석(0)이 몰수패: ' + JSON.stringify(room.result));
  }
  {
    const room = H.startedRoom(8, { graceMs: 30 });
    const t = Date.now() - 1;
    room.seats[0].disconnectExpiry = t; room.seats[1].disconnectExpiry = t;
    room.seats[0].connected = false; room.seats[1].connected = false;
    room._onGraceExpireInProgress(0);
    ok(room.state === STATES.FINISHED && room.result.type === 'NO_CONTEST' && room.result.winner === null, 'F7 동시 만료는 NO_CONTEST: ' + JSON.stringify(room.result));
  }

  // ===== 손상된 배치 데이터 — v4: 서버가 먼저 거부한다(무작위 대체로 경기를 시작하지 않는다) =====
  {
    const room = H.setupRoom(9, { graceMs: 500 });
    const bad = room._handleSetup(0, { roster: ['x', 'y', 'z', 'a', 'b', 'c'], pos: [[11, 1]] });
    ok(!bad.ok && bad.reason === 'E_ILLEGAL_ACTION' && room.seats[0].placed === false && room.seats[0].rawSetup === null, '위조 로스터·말 수 불일치 배치 거부, 좌석 상태 불변: ' + JSON.stringify(bad));
    room._handleSetup(1, makeSetup());
    const rr = room._handleReady(0, true);
    room._handleReady(1, true);
    ok(!rr.ok && room.state === STATES.SETUP && room.engines === null, '거부된 배치 좌석은 ready 불가 — 매치 미시작');
  }

  done();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
