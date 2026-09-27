'use strict';
/* #263 배치·행동 타이머와 경기 상점 6칸 자동 처리 — 서버 권위 경계만 본다 (GDD-23 2.2·2.4 · 2026-09-25 CJ Q1=A·Q2=A).
   규칙(가격·예비 재화·진열·자동 배치 좌표)은 Core 가 판정하고 demo/test/regression/smoke_issue236.js·smoke_issue234.js 가 본다.
   여기서 보는 것: 6칸 진열과 SOLD OUT 의 회선 모양 · S01 시간 초과의 자동 구매(새로 고침 0회)와 자동 배치·준비 ·
   직접 완료 좌석만 받는 배치 90초 · 행동 30초(출전 후보 포함, 전투 판정 중 정지) · 단절 60초가 그 셋을 모두 멈추고
   기권까지 막는 것 · 유예 만료 몰수·경기 전 취소 보존. #236/#237 의 서버 권위·비공개 계약은 그대로다.
   2026-09-25 후속 CJ(T1~T4) — 7~12절: 빈손 만료의 턴 넘김(강제 표식이 남아 있어도 막히지 않는다) · 적격 대상 1개
   즉시 전투 / 2개 이상 새 30초와 균등 권위 난수 자동 선택(선택당 rand 1회 · 마감 시점 재검증) · 텔레포트 강제 전투
   큐의 순차 처리 · B02 방어자 단계로 시계가 옮겨 가되 다시 세지 않는 것 · 전투 행동 60초가 쓸 수 있는 기술이 있어도
   그 행동 1회만 건너뛰고 전투를 잇는 것 · 60초·20초·유예 60초가 서로 다른 시계라는 것. */
const H = require('./helpers');
const { makeCounter, fakeWs, both, STATES } = H;

const { ok, done } = makeCounter('issue263-timers');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/* 벽시계 대신 **상태**를 기다린다. 개시는 만료 연쇄(S01 60ms → 자동 구매 → 자동 배치 → 개시)의 끝이라
   고정 sleep 으로 창을 재면 느린 기계에서 창을 넘겨 다른 단계를 검사하게 된다(간헐 실패). 조건이 서면
   곧바로 진행하므로 빠르기도 하다. 시한 자체를 재는 자리(잔여 시간·정지)는 종전대로 실제 sleep 을 쓴다. */
async function until(cond, why, ms) {
  const end = Date.now() + (ms || 3000);
  while (Date.now() < end) { if (cond()) return; await sleep(5); }
  throw new Error('fixture timeout: ' + why);
}
const started = (room) => until(() => room.state === STATES.IN_PROGRESS && room.engines && S0(room).phase === 'play', '경기 개시');
const settled = (room) => until(() => room.state !== STATES.IN_PROGRESS && room.state !== STATES.SETUP, '경기 종료 전이');

// 시계는 테스트 주입값으로 돌린다 — 기본은 Core 상수(ECO.shopSec·placeSec·actSec)다.
function ecoRoom(id, opts) {
  const room = new H.Room(id, Object.assign(
    { isPublic: false, epoch: 'aaaaaaaa', graceMs: 5000, economy: true, seed: 263, shopMs: 60000, bagPickMs: 60000, placeMs: 60000, actMs: 60000 },
    opts || {}));
  room.openHostSeat(fakeWs());
  room.joinGuestSeat(fakeWs());
  return room;
}
const S0 = (room) => room.engines[0].S;
const view = (room, seat) => room.toSeatView(seat);
function shop(room, seat, t, extra) {
  const v = view(room, seat);
  return room._handleAction(seat, { baseRevision: 0, action: Object.assign({ t, shop: v.shop.shop, seq: v.shop.seq }, extra || {}) });
}
const openSlot = (v) => v.shop.slots.findIndex((x) => x && !x.sold);
// S01 을 합법 경로로 직접 끝낸다 — #263 이후 6칸 진열만으로 필드 6칸이 차므로 새로 고침이 필요 없다.
function finishStart(room, seat) {
  for (let n = 0; n < 12; n++) {
    const v = view(room, seat);
    if (v.shop.done) return;
    const empty = S0(room).pieces.filter((p) => p.owner === seat && p.type === 'minion' && !p.rosterId).length;
    const r = empty ? shop(room, seat, 'shopBuy', { i: openSlot(v) }) : shop(room, seat, 'shopDone');
    if (!r.ok) throw new Error('fixture S01 failed: ' + r.reason);
  }
  throw new Error('fixture S01 did not finish');
}

/* #263 T2·T3 픽스처 — 한 칸 이동으로 **신규 인접이 정확히 n 개** 생기는 보드를 만든다. 게이트를 끄지 않고
   그 게이트가 통과시키는 정상 상태를 만든다: 쓰는 다섯 칸을 비우고(있던 말은 빈 칸으로 물린다) 이동하는 말과
   대상만 그 자리에 놓는다. 좌표는 두 좌석 엔진에 같은 값을 쓰므로 락스텝은 그대로다(both 이 요약 일치를 본다).
   이동 자체는 사람과 같은 경로(셀 클릭 2회 → Core move)로 넣는다. 반환: {cur, mover, targets, from, to}. */
const MOVER = [8, 4], DEST = [7, 4], T1C = [7, 3], T2C = [7, 5], FAR = [6, 4]; // FAR 은 도착 칸의 남은 이웃 — 비워 둬야 신규 인접 수가 정확하다
function forcedBoard(room, n, allyTarget) {
  const T = room.engines[0], cur = T.S.current;
  const pick = (own) => T.S.pieces.filter((p) => p.owner === own && p.type === 'minion' && p.alive && p.placed && !p.immobile);
  const mover = pick(cur)[0], foes = pick(1 - cur);
  if (!mover || foes.length < n) throw new Error('fixture: 쓸 말이 모자람');
  const targets = foes.slice(0, n).map((p) => p.id);
  if (allyTarget) { // 둘째 대상을 상대 동료로 — 고르면 출전 선택(B02)이 먼저 열린다
    const ally = T.S.pieces.find((p) => p.owner !== cur && p.type === 'ally' && p.alive && p.placed);
    if (!ally) throw new Error('fixture: 상대 동료가 없음');
    targets[1] = ally.id;
  }
  const spots = [MOVER, DEST, T1C, T2C, FAR];
  both(room, (E) => {
    const S = E.S, busy = new Set(spots.map((q) => q.join('_')));
    const at = (r, c) => S.pieces.find((p) => p.alive && p.placed && p.r === r && p.c === c);
    const free = () => {
      for (let r = 1; r <= E.ROWS; r++) for (let c = 1; c <= E.COLS; c++) if (!busy.has(r + '_' + c) && !at(r, c)) return [r, c];
      throw new Error('fixture: 물릴 빈 칸이 없음');
    };
    for (const [r, c] of spots) { const occ = at(r, c); if (occ) { const q = free(); occ.r = q[0]; occ.c = q[1]; } }
    const put = (id, q) => { const p = S.pieces.find((x) => x.id === id); p.r = q[0]; p.c = q[1]; };
    put(mover.id, MOVER);
    targets.forEach((id, i) => put(id, i === 0 ? T1C : T2C));
    Object.assign(S, { current: cur, mainUsed: false, battlesUsed: 0, forcedTargets: [], forcedQueue: [], movedPiece: null, selected: null, teleport: null });
  });
  room._syncClock();
  return { cur, mover: mover.id, targets, from: MOVER, to: DEST };
}
// 사람과 같은 입력 경로: 내 말 선택 → 목적 칸 클릭.
function moveVia(room, seat, from, to) {
  const a = room._handleAction(seat, { baseRevision: room.revision, action: { t: 'cell', r: from[0], c: from[1] } });
  if (!a.ok) throw new Error('fixture: 말 선택 거부 ' + a.reason);
  const b = room._handleAction(seat, { baseRevision: room.revision, action: { t: 'cell', r: to[0], c: to[1] } });
  if (!b.ok) throw new Error('fixture: 이동 거부 ' + b.reason);
}

(async function run() {
  // ===== 1. S01 6칸 진열 · 구매 칸 SOLD OUT · 즉시 보충 없음 =====
  {
    const room = ecoRoom(1);
    const v = view(room, 0);
    ok(v.shop.slots.length === 6 && v.shop.slots.every((x) => x && !x.soldOut && x.grade === 1), 'S01 진열은 6칸 · 처음엔 품절 없음');
    const bought = v.shop.slots[0].key;
    shop(room, 0, 'shopBuy', { i: 0 });
    const a = view(room, 0);
    ok(a.shop.slots.length === 6 && a.shop.slots[0].soldOut && a.shop.slots[0].key === bought && a.shop.slots[0].sold,
      '산 칸은 비지 않고 SOLD OUT 으로 남는다 — 진열은 계속 6칸, 즉시 보충 없음');
    ok(a.shop.slots.filter((x) => x && !x.soldOut).length === 5, '나머지 5칸은 그대로 · 새 상품이 끼어들지 않는다');
    const refuse = shop(room, 0, 'shopBuy', { i: 0 });
    ok(!refuse.ok && refuse.reason === 'E_ILLEGAL_ACTION' && S0(room).eco.coins[0] === 9, '품절 칸 재구매 거부 · 코인 불변');
    const rf = shop(room, 0, 'shopRefresh');
    ok(rf.ok && view(room, 0).shop.slots.every((x) => x && !x.soldOut) && S0(room).eco.coins[0] === 8,
      '수동 새로 고침이 품절을 다시 채우는 유일한 길 (🪙1)');
    room._clearClock();
  }

  /* S01 90초 만료 — 노출 6종 전부 자동 구매(새로 고침 0회) · 10→4 보존.
     상대는 먼저 직접 완료시켜 경기를 열지 않는다(개시하면 beginPlay 가 eco.shop 을 닫아 진열을 볼 수 없다). */
  {
    const room = ecoRoom(2, { shopMs: 120 });
    finishStart(room, 1);
    await sleep(240);
    const S = S0(room);
    ok(S.eco.shop.seq[0] === 6, '0명 산 좌석의 만료 = 구매 6회뿐 — 자동 새로 고침 0회 (진열 번호로 실측)');
    ok(S.eco.coins[0] === 4, '기본 사례 🪙10 → 6명 구매 → 4 보존 (자동 새로 고침 비용 없음)');
    ok(S.pieces.filter((x) => x.owner === 0 && x.type === 'minion' && x.rosterId).length === 6, '노출된 6종을 모두 사서 필드 6칸');
    ok(S.eco.shop.slots[0].length === 6 && S.eco.shop.slots[0].every((x) => x && x.soldOut), '자동 구매한 칸도 SOLD OUT 으로 남는다 — 진열은 6칸 그대로');
    ok(room.seats[0].shopTimedOut && room.seats[0].placed && room.seats[0].ready && room._clock[0] === null,
      '시간 초과 좌석은 그 자리에서 자동 배치·준비 — 배치 90초를 다시 걸지 않는다');
    const zone = new Set(room.engines[0].zoneOf(0));
    ok(S.pieces.filter((x) => x.owner === 0).every((x) => x.placed && zone.has(x.r) && x.c >= 1 && x.c <= 7), '자동 배치는 자기 진영 합법 칸 안에서만');
    ok(new Set(S.pieces.filter((x) => x.placed).map((x) => x.r + '_' + x.c)).size === S.pieces.filter((x) => x.placed).length, '자동 배치에 겹치는 칸이 없다');
    ok(room.state === STATES.SETUP, '상대가 아직 배치 전이면 경기는 시작되지 않는다');
    room._clearClock();
  }
  { // 양측 만료 → 곧바로 개시
    const room = ecoRoom(3, { shopMs: 60 });
    await sleep(170);
    ok(room.state === STATES.IN_PROGRESS && S0(room).phase === 'play' && S0(room).pieces.every((x) => x.placed),
      '양측 S01 만료 → 자동 구매·자동 배치·준비로 곧바로 개시');
    room._clearClock();
  }

  // 1~5명을 이미 샀고 하수인 밖 지출도 한 좌석 — 기존 구매 보존 + 남은 노출 칸으로 6까지
  {
    const room = ecoRoom(4, { shopMs: 200 });
    finishStart(room, 1);
    for (let n = 0; n < 3; n++) shop(room, 0, 'shopBuy', { i: openSlot(view(room, 0)) });
    const g = shop(room, 0, 'shopGood', { item: 'ball' });
    const kept = S0(room).pieces.filter((x) => x.owner === 0 && x.rosterId).map((x) => x.rosterId).join();
    await sleep(320);
    const S = S0(room);
    ok(g.ok && S.balls[0] === 1, '하수인 밖 지출(볼)은 확정된 그대로 보존된다');
    ok(S.pieces.filter((x) => x.owner === 0 && x.rosterId).map((x) => x.rosterId).join().startsWith(kept), '이미 산 3명은 그 자리 그대로');
    ok(S.pieces.filter((x) => x.owner === 0 && x.type === 'minion' && x.rosterId).length === 6 && S.eco.coins[0] >= 0,
      '남은 노출·미구매 적격 칸으로 6명까지 — 예비 재화가 자동 구매 비용을 보장한다');
    ok(S.eco.shop.seq[0] === 6, '구매 3 + 자동 구매 3 = 진열 번호 6 — 새로 고침 0회 (진열 번호는 구매·새로 고침만 올린다)');
    room._clearClock();
  }

  // ===== 2. 배치 90초 — 직접 완료한 좌석만 받는다 · 만료 시 자동 배치·준비 =====
  {
    const room = ecoRoom(5, { placeMs: 80 });
    finishStart(room, 0);
    const v = view(room, 0);
    ok(v.shop.done && v.clock && v.clock.key === 'place' && v.clock.running, '직접 완료(shopDone) → 그 좌석만 배치 90초 시작');
    ok(!room.seats[0].shopTimedOut && !room.seats[0].placed, '전제: 아직 배치 전');
    await sleep(190);
    ok(room.seats[0].placed && room.seats[0].ready && room._clock[0] === null, '배치 만료 → 자동 배치·준비 · 시계 해제');
    ok(S0(room).pieces.filter((x) => x.owner === 0).every((x) => x.placed), '만료 좌석의 말은 모두 합법 위치에 놓인다');
    ok(room.state === STATES.SETUP, '상대가 아직 S01 이면 경기는 시작되지 않는다');
    finishStart(room, 1);
    await sleep(190);
    ok(room.state === STATES.IN_PROGRESS && S0(room).phase === 'play', '양측 준비 → 개시');
    room._clearClock();
  }
  /* 경계: 배치만 보내고 준비를 안 누른 좌석 — 시한의 끝은 placed 가 아니라 **준비까지**다.
     만료는 그 좌석이 고른 자리를 덮어쓰지 않고 준비만 세운다. */
  {
    const room = ecoRoom(50, { placeMs: 120 });
    finishStart(room, 0); finishStart(room, 1);
    const pos = H.makeSetup().pos;
    const sent = room.handleCommand(0, { t: 'setup', roster: S0(room).roster[0].slice(), pos });
    ok(sent.ok && room.seats[0].placed && !room.seats[0].ready, '전제: 배치만 보내고 준비는 안 눌렀다');
    ok(room._clock[0] && room._clock[0].key === 'place' && room._clock[0].deadline != null,
      '배치만 보낸 좌석의 배치 90초는 계속 흐른다 — 준비를 영영 안 눌러도 경기가 멈추지 않게');
    await sleep(240);
    ok(room.seats[0].ready, '만료 → 준비까지 세운다');
    ok(JSON.stringify(room.seats[0].rawSetup.pos) === JSON.stringify(pos), '이미 보낸 배치는 무작위로 덮어쓰지 않는다');
    room._clearClock();
  }
  { // 배치를 다시 보내면 ready 가 풀리고 시한도 다시 선다
    const room = ecoRoom(51, { placeMs: 60000 });
    finishStart(room, 0);
    room.handleCommand(0, { t: 'setup', roster: S0(room).roster[0].slice(), pos: H.makeSetup().pos });
    room.handleCommand(0, { t: 'ready' });
    ok(room.seats[0].ready && room._clock[0] === null, '배치·준비를 마치면 배치 시계는 사라진다');
    room.handleCommand(0, { t: 'setup', roster: S0(room).roster[0].slice(), pos: H.makeSetup().pos });
    ok(!room.seats[0].ready && room._clock[0] && room._clock[0].key === 'place', '배치를 다시 보내면 준비가 풀리고 배치 시계가 다시 선다');
    room._clearClock();
  }

  // ===== 3. 행동 30초 — 미완료 보드 행동 1회 생략 · 늦은/중복 요청 거부 =====
  {
    const room = ecoRoom(6, { shopMs: 60 });
    await started(room); // 양측 S01 만료 → 자동 배치·개시
    ok(room.state === STATES.IN_PROGRESS, '전제: 경기 개시');
    const cur = S0(room).current, turn = S0(room).turnCount;
    const c = room._act; // #263: 행동 30초는 방이 하나만 들고 owner 로 "지금 답할 좌석"을 가리킨다
    ok(c && c.key === 'act:' + turn + ':' + cur && c.owner === cur && c.deadline != null && c.handle, '차례 좌석에 행동 30초가 선다');
    ok(view(room, 1 - cur).clock === null && room._clock[1 - cur] === null, '상대 좌석에는 행동 시계가 없다');
    const staleRev = room.revision;
    /* 만료는 잡아 둔 키로 **한 번만** 태운다 — setTimeout 이 부르는 그 진입점 그대로다(4절도 같은 방식).
       종전 `actMs:90` + `await sleep(220)` 은 만료가 연쇄해(실제 ~105ms 간격으로 턴 1→2→3) 그 창 안의 만료 횟수가
       2회냐 3회냐로 갈렸다 — 짝수면 차례가 제자리로 돌아와 아래 세 단언이 함께 떨어졌다(간헐 실패의 원인).
       행동 시계는 그래서 벽시계로 만료되지 않을 길이(ecoRoom 기본 actMs 60000)로 둔다. 실제 타이머 장착은 위 c.handle 단언이 본다. */
    room._onClock(cur, c.key);
    ok(S0(room).current === 1 - cur, '만료 → 미완료 행동을 1회 생략하고 턴을 넘긴다');
    ok(room._act && room._act.key.startsWith('act:') && room._act.owner === 1 - cur && !room._act.expired, '다음 차례 좌석에 새 행동 시계');
    const late = room._handleAction(cur, { baseRevision: staleRev, action: { t: 'endTurn' } });
    ok(!late.ok && late.reason === 'E_STALE_REVISION', '만료 뒤 도착한 그 턴의 늦은 요청은 거부 — 이중 진행 없음');
    const notActor = room._handleAction(cur, { baseRevision: room.revision, action: { t: 'endTurn' } });
    ok(!notActor.ok && notActor.reason === 'E_NOT_ACTOR', '차례가 아닌 좌석의 중복 종료도 거부');
    room._clearClock();
  }

  // ===== 4. 행동 30초 — 출전 후보 선택 포함(Q2=A) · 서버 대행 선택 · 전투 판정 중 정지 =====
  {
    const room = ecoRoom(7, { shopMs: 60, actMs: 10000 });
    await started(room);
    const cur = S0(room).current;
    const owned = new Set(S0(room).pieces.filter((p) => p.owner === cur && p.rosterId).map((p) => p.rosterId));
    const free = room.engines[0].ROSTER.map((r) => r.id).find((id) => !owned.has(id));
    both(room, (E) => { E.S.eco.bag[cur].push(E.ecoMakeUnit(E.S, free, 2)); });
    const ally = S0(room).pieces.find((p) => p.owner === cur && p.type === 'ally');
    const foe = S0(room).pieces.find((p) => p.owner === 1 - cur && p.type === 'minion' && p.alive && p.placed);
    H.openBattle(room, { att: ally.id, def: foe.id });
    ok(S0(room).entryPick && !S0(room).battle, '전제: 출전 후보 선택이 열렸다(전투는 아직)');
    const during = room._act;
    ok(during && during.key.startsWith('act:') && during.deadline != null, '후보를 고르는 동안에도 행동 30초가 흐른다');
    ok([0, 1].every((s) => room._clock[s] === null) && room._bclock === null,
      '후보 선택 전용 20초 타이머를 만들지 않는다 — 흐르는 것은 행동 30초 하나뿐');
    room._onClock(during.owner, during.key); // 만료
    const B = S0(room).battle;
    ok(B && !S0(room).entryPick, '만료 → 서버가 후보를 대신 골라 전투가 열린다');
    ok(B && B.fa === B.attP, '서버 대행 선택은 본체 출전 — 가방 대리를 임의로 꺼내지 않는다');
    const paused = room._act;
    ok(paused && paused.deadline === null && paused.handle === null, '후보 확정 뒤 전투 판정·연출 동안 행동 시간은 멈춘다');
    ok(room._bclock && room._bclock.key.startsWith('battle:') && room._bclock.deadline != null,
      '그동안 전투 행동 60초가 따로 흐른다 (#263 T4)');
    const turn = S0(room).turnCount, who = S0(room).current;
    both(room, (E) => { E.S.battle = null; }); // 전투 종료만 픽스처로 흉내 — 전투 재생은 이 절의 검사 대상이 아니다
    room._syncClock();
    ok(S0(room).current !== who || S0(room).turnCount !== turn, '전투가 끝나면 이미 만료된 행동 시간으로는 더 두지 않고 턴을 넘긴다');
    room._clearClock();
  }

  // ===== 5. 단절 60초 — 모든 게임 시계 정지 · 양측 입력·기권 금지 · 복구 뒤 잔여 시간 재개 =====
  {
    const room = ecoRoom(8, { shopMs: 60, actMs: 4000, graceMs: 5000 });
    await started(room);
    const cur = S0(room).current, other = 1 - cur;
    await sleep(40);
    room.socketClosed(other);
    const frozen = room._act;
    ok(frozen && frozen.deadline === null && frozen.handle === null && frozen.left > 0 && frozen.left < 4000,
      '단절 확정 → 행동 30초가 남은 시간만 들고 멈춘다: ' + (frozen && frozen.left));
    const pv = view(room, cur);
    ok(pv.pause && pv.pause.some((x) => x.seat === other), '좌석 뷰에 재접속 유예가 보인다');
    ok(pv.clock && pv.clock.running === false, '표시되는 시계도 멈춘 상태');
    const board = room._handleAction(cur, { baseRevision: room.revision, action: { t: 'skipMain' } });
    const quit = room.handleCommand(cur, { t: 'resign' });
    const quit2 = room.handleCommand(other, { t: 'resign' });
    ok(!board.ok && board.reason === 'E_PAUSED', '단절 중에는 연결된 좌석의 게임 입력도 금지');
    ok(!quit.ok && quit.reason === 'E_PAUSED' && !quit2.ok && quit2.reason === 'E_PAUSED' && room.state === STATES.IN_PROGRESS,
      '#263: 단절 중에는 양측 기권 입력도 금지 — #237 의 즉시 종료 허용을 최신 지시가 대체한다');
    const left = frozen.left;
    room.resumeSeat(other, room.seats[other].credential.current, fakeWs());
    const back = room._act;
    ok(back && back.deadline != null && back.left === left, '복구 → 남은 시간 그대로 다시 흐른다');
    ok(room.handleCommand(cur, { t: 'resign' }).ok && room.state === STATES.FINISHED, '복구 뒤 기권은 종전대로 즉시 종료');
  }
  { // 배치 90초도 같은 규칙으로 멈춘다
    const room = ecoRoom(9, { placeMs: 4000, graceMs: 5000 });
    finishStart(room, 0);
    await sleep(40);
    room.socketClosed(1);
    const c = room._clock[0];
    ok(c && c.key === 'place' && c.deadline === null && c.left > 0 && c.left < 4000, '단절 중에는 배치 90초도 남은 시간만 들고 멈춘다');
    room.resumeSeat(1, room.seats[1].credential.current, fakeWs());
    ok(room._clock[0] && room._clock[0].deadline != null, '복구 → 배치 시간도 다시 흐른다');
    room._clearClock();
  }
  { // 진행 중 유예 만료 몰수 (#237 보존)
    const room = ecoRoom(10, { shopMs: 60, actMs: 60000, graceMs: 50 });
    await started(room);
    ok(room.state === STATES.IN_PROGRESS, '전제: 개시');
    room.socketClosed(1);
    await settled(room);
    ok(room.state === STATES.FINISHED && room.result.type === 'FORFEIT' && room.result.winner === 0 && room._clock.every((c) => c === null),
      '진행 중 유예 만료 → 몰수패 보존 · 시계 해제');
  }
  { // 경기 전 취소 · 동시 만료 NO_CONTEST (#237 보존)
    const room = ecoRoom(11, { graceMs: 50 });
    room.socketClosed(0);
    await settled(room);
    ok(room.state === STATES.CANCELED, '경기 전(S01) 유예 만료 → 취소 보존');
  }
  {
    const room = ecoRoom(12, { shopMs: 60, actMs: 60000, graceMs: 60 });
    await started(room);
    room.socketClosed(0); room.socketClosed(1);
    await settled(room);
    ok(room.state === STATES.FINISHED && room.result.type === 'NO_CONTEST' && room.result.winner === null, '진행 중 동시 만료 → NO_CONTEST 보존');
  }

  // ===== 6. Q1=A — 공동 1위 왕국 추첨은 좌석당 1회, 왕·동료 3명이 공유 =====
  {
    const room = ecoRoom(13, { shopMs: 60 });
    await started(room);
    const order = room.engines[0].V2_ELEM_ORDER;
    for (const p of [0, 1]) {
      const cnt = {};
      for (const m of S0(room).pieces.filter((x) => x.owner === p && x.type === 'minion' && x.rosterId)) cnt[m.element] = (cnt[m.element] || 0) + 1;
      const top = Math.max.apply(null, order.map((el) => cnt[el] || 0));
      const tied = order.filter((el) => (cnt[el] || 0) === top);
      const lead = S0(room).pieces.filter((x) => x.owner === p && (x.type === 'king' || x.type === 'ally'));
      ok(lead.length === 3 && new Set(lead.map((x) => x.element)).size === 1 && tied.indexOf(lead[0].element) >= 0,
        'P' + (p + 1) + ': 공동 1위(' + tied.join('/') + ') 중 하나를 왕·동료 3명이 함께 받는다 — 좌석당 추첨 1회');
    }
    room._clearClock();
  }

  // ===== 7. T1 — 빈손 만료는 평범한 턴 종료다. 강제 전투 표식이 남아 있어도 턴 넘기기를 거부하지 않는다 =====
  {
    const room = ecoRoom(14, { shopMs: 60 });
    await started(room);
    const cur = S0(room).current, turn = S0(room).turnCount;
    /* 이행할 수 없는 강제 표식(움직인 말이 없다) — 종전에는 Core endTurn 이 거부해 그 좌석이 차례를 쥔 채 멈췄다.
       T3 의 자동 선택도 고를 대상이 없으므로, 남는 길은 표식을 접고 턴을 넘기는 것뿐이다. */
    const foe = S0(room).pieces.find((p) => p.owner !== cur && p.type === 'minion' && p.alive && p.placed);
    both(room, (E) => { E.S.forcedTargets = [foe.id]; E.S.movedPiece = null; });
    room._onClock(cur, room._act.key);
    ok(S0(room).current === 1 - cur && S0(room).turnCount === turn + 1, '이행 불가 강제 표식이 남아도 빈손 만료는 턴을 넘긴다 (T1)');
    ok(!(S0(room).forcedTargets || []).length, '넘긴 턴에는 강제 표식이 남지 않는다');
    ok(room._act && room._act.owner === 1 - cur && !room._act.expired, '다음 좌석에 새 행동 30초');
    room._clearClock();
  }

  // ===== 8. T2 — 적격 강제 대상이 하나면 선택창 없이 곧바로 전투 · 30초를 새로 세지 않는다 =====
  {
    const room = ecoRoom(15, { shopMs: 60, actMs: 10000 });
    await started(room);
    const f = forcedBoard(room, 1);
    const before = room._act; // 같은 시계인지는 객체 정체성으로 본다(_tick 은 키가 같으면 그 객체를 그대로 들고 간다)
    moveVia(room, f.cur, f.from, f.to);
    const S = S0(room);
    ok(!!S.battle || !!S.entryPick, '적격 대상 1개 — 이동이 끝나는 그 자리에서 전투(또는 출전 선택)가 열린다 (T2)');
    ok(room._act === before && room._act.key === before.key && room._act.left <= 10000,
      '대상이 하나면 선택창이 없으므로 행동 30초를 새로 세지 않는다 — 같은 시계가 멈춰서 이어진다');
    ok(room._act.deadline === null && room._act.handle === null, '전투가 열린 동안 행동 30초는 멈춘다');
    ok(!S.battle || (room._bclock && room._bclock.owner === (room.engines[0].actorOfPhase() === 'A' ? S.battle.attP : S.battle.defP).owner),
      '전투 행동 60초는 그 라운드의 행동자 좌석이 받는다');
    room._clearClock();
  }

  // ===== 9. T3 — 적격 대상 2개 이상: 이동 완료 직후 새 30초 · 만료 시 균등 권위 난수 1회로 자동 선택 =====
  {
    const room = ecoRoom(16, { shopMs: 60, actMs: 10000 });
    await started(room);
    const f = forcedBoard(room, 2);
    const board = room._act;
    await sleep(40); // 주 행동에 실제로 시간을 쓴다 — 그 뒤 남은 시간이 보존되는지 보려면 0 이 아니어야 한다
    moveVia(room, f.cur, f.from, f.to);
    const S = S0(room);
    ok(!S.battle && !S.entryPick && S.forcedTargets.length === 2, '적격 대상 2개 — 전투를 열지 않고 선택을 기다린다');
    ok(room._pick && room._pick.key.startsWith('pick:') && room._pick.left === 10000 && room._pick.deadline != null,
      '이동 완료 직후 30초를 새로 시작한다 (T3)');
    ok(room._act === board && room._act.deadline === null && room._act.left > 0 && room._act.left < 10000,
      '보드 행동 30초는 그 자리에서 멈추고 **주 행동 뒤 남은 시간**을 지킨다: ' + room._act.left);
    ok(room._pick.owner === f.cur && view(room, f.cur).clock.key === 'pick' && view(room, 1 - f.cur).clock === null,
      '선택 시계는 고르는 좌석의 것이고 상대에게는 나가지 않는다');

    /* 난수 계약 — 선택 1회당 rand() 1회, 후보가 하나면 0회. 표본 비율이 아니라 **스트림 위치**로 본다:
       같은 시드의 기준 스트림과 대조하면 그 액션이 정확히 몇 번 뽑았는지가 드러난다(V3 재현). */
    const st = S0(room);
    const baseline = (seed) => { const E = H.createEngine(); E.setSeed(seed); return [E.rand(), E.rand()]; };
    const probe = (seed, state) => {
      const E = H.createEngine(); E.setSeed(seed);
      const r = E.reduceCoreAction(state, { t: 'forcedAuto' });
      return { pick: r.state.forcedTargets[0], next: E.rand(), count: r.events[0] && r.events[0].count };
    };
    const b5 = baseline(5), p5 = probe(5, st);
    ok(p5.count === 2 && f.targets.indexOf(p5.pick) >= 0, '만료 자동 선택은 적격 후보 2개 중 하나를 고른다');
    ok(p5.next === b5[1], '후보 2개 — rand() 를 정확히 한 번 쓴다 (후보마다 다시 뽑지 않는다)');
    ok(probe(5, st).pick === p5.pick, '같은 상태·같은 시드면 같은 대상 — 재현 가능하다');
    const picks = new Set([3, 5, 11, 17, 23, 41].map((s) => probe(s, st).pick));
    ok(picks.size === 2 && [...picks].every((id) => f.targets.indexOf(id) >= 0), '시드가 다르면 두 후보가 모두 나온다 — 한쪽으로 고정돼 있지 않다');

    // 마감 시점 재검증 — 그 사이 대상 하나가 사라지면 남은 적격 후보만 쓰고 난수는 쓰지 않는다
    both(room, (E) => { const d = E.S.pieces.find((p) => p.id === f.targets[1]); d.alive = false; });
    const dead = probe(5, S0(room));
    ok(dead.pick === f.targets[0] && dead.count === 1 && dead.next === b5[0],
      '대상이 사라지면 남은 적격 후보만 쓰고 rand() 를 쓰지 않는다 (마감 시점 재검증)');

    // 실제 만료 — 서버가 대신 고르고 그 자리에서 전투가 열린다(턴은 넘어가지 않는다)
    const turn = S0(room).turnCount, boardLeft = room._act.left;
    room._onClock(room._pick.owner, room._pick.key);
    ok((S0(room).battle || S0(room).entryPick) && S0(room).turnCount === turn,
      '만료 → 서버가 고른 대상으로 전투가 열리고 턴은 그대로다');
    ok(room._pick === null && room._act.left === boardLeft && room._act.deadline === null,
      '선택 시계는 사라지고 보드 행동 30초의 남은 시간은 고르는 데 쓴 시간만큼도 줄지 않았다');
    // 전투가 끝나면 그 남은 시간으로 이어진다 — 턴이 여기서 끝나지 않는다(선택 30초 만료는 보드 시간을 빼앗지 않는다)
    const turn2 = S0(room).turnCount;
    both(room, (E) => { E.S.battle = null; E.S.entryPick = null; }); // 전투 종료만 픽스처로 흉내
    room._syncClock();
    ok(S0(room).turnCount === turn2 && room._act.deadline != null && room._act.left === boardLeft,
      '전투가 끝나면 주 행동 뒤 남은 보드 30초부터 다시 흐른다 (턴 종료 아님)');
    room._clearClock();
  }

  // ===== 10. 강제 전투 큐(텔레포트 두 이동)는 만료에서도 순서대로 처리되고 막히지 않는다 =====
  {
    const room = ecoRoom(17, { shopMs: 60, actMs: 10000 });
    await started(room);
    const f = forcedBoard(room, 1);
    // 주 행동을 이미 쓴 뒤 큐에 남은 둘째 항목 — 스왑 직후 첫 항목이 이미 처리된 상태의 모양 그대로다
    both(room, (E) => {
      const S = E.S, m = S.pieces.find((p) => p.id === f.mover);
      m.r = 7; m.c = 4; // 대상(7,3) 옆
      Object.assign(S, { mainUsed: true, forcedTargets: [], forcedQueue: [{ pid: f.mover, targets: [f.targets[0]] }] });
    });
    room._syncClock();
    const turn = S0(room).turnCount;
    room._onClock(room._act.owner, room._act.key);
    ok((S0(room).battle || S0(room).entryPick) && S0(room).turnCount === turn && !S0(room).forcedQueue.length,
      '큐에 남은 항목은 만료에서 승격돼 전투가 되고 턴은 그대로다 — 순서대로 처리된다');
    room._clearClock();
  }
  { // 큐 항목이 전부 면제(대상 소멸)면 턴이 막히지 않고 넘어간다
    const room = ecoRoom(18, { shopMs: 60, actMs: 10000 });
    await started(room);
    const f = forcedBoard(room, 1);
    both(room, (E) => {
      const S = E.S;
      S.pieces.find((p) => p.id === f.targets[0]).alive = false;
      Object.assign(S, { mainUsed: true, forcedTargets: [], forcedQueue: [{ pid: f.mover, targets: [f.targets[0]] }] });
    });
    room._syncClock();
    const cur = S0(room).current, turn = S0(room).turnCount;
    room._onClock(room._act.owner, room._act.key);
    ok(S0(room).current === 1 - cur && S0(room).turnCount === turn + 1 && !S0(room).forcedQueue.length,
      '이행할 수 없는 큐는 면제되고 턴이 넘어간다 — 교착 없음');
    room._clearClock();
  }

  // ===== 11. B02 — 출전 후보 선택이 방어자 단계로 넘어가면 시계도 따라가되 다시 세지 않는다 =====
  {
    const room = ecoRoom(19, { shopMs: 60, actMs: 10000 });
    await started(room);
    const cur = S0(room).current, foeSeat = 1 - cur;
    const owned = new Set(S0(room).pieces.filter((p) => p.rosterId).map((p) => p.rosterId));
    const free = room.engines[0].ROSTER.map((r) => r.id).find((id) => !owned.has(id));
    both(room, (E) => { E.S.eco.bag[foeSeat].push(E.ecoMakeUnit(E.S, free, 2)); });
    const mine = S0(room).pieces.find((p) => p.owner === cur && p.type === 'minion' && p.alive && p.placed);
    const theirAlly = S0(room).pieces.find((p) => p.owner === foeSeat && p.type === 'ally');
    const clk0 = room._act, dl0 = clk0.deadline;
    H.openBattle(room, { att: mine.id, def: theirAlly.id }); // 픽스처는 엔진을 직접 다룬다 — 시계는 그 뒤에 맞춘다
    room._syncClock();
    const pm = room._pendingModal();
    ok(S0(room).entryPick && pm && pm.owner === foeSeat, '전제: 방어자(동료)의 출전 후보 선택이 열렸다');
    ok(room._act && room._act.owner === foeSeat, 'B02 는 실제 선택자(방어자)가 응답한다 — 시계가 그 좌석으로 옮겨 간다');
    ok(room._act === clk0 && room._act.deadline === dl0 && room._act.left === 10000,
      '옮겨 간 것은 같은 시계다 — 후보마다 30초를 다시 주지 않는다 (Q2=A)');
    ok(view(room, foeSeat).clock && view(room, foeSeat).clock.key === 'act' && view(room, cur).clock === null,
      '남은 시간은 고르는 좌석에게 전달된다');
    ok(room._bclock === null && room._clock.every((c) => c === null), '후보 선택에는 전용 시계를 만들지 않는다');
    room._onClock(foeSeat, room._act.key);
    ok(S0(room).battle && !S0(room).entryPick, '만료 → 서버가 합법 후보를 대신 고르고 전투가 열린다');
    room._clearClock();
  }

  // ===== 12. T4 전투 행동 60초 — 쓸 수 있는 기술이 있어도 그 행동 1회만 건너뛰고 전투는 계속된다 =====
  {
    const room = ecoRoom(20, { shopMs: 60, actMs: 10000, battleMs: 8000 });
    await started(room);
    H.openBattle(room);
    room._syncClock(); // 픽스처는 엔진을 직접 다룬다 — 시계는 그 뒤에 맞춘다
    const S = S0(room), B = S.battle;
    ok(!!B, '전제: 하수인 전투가 열렸다');
    const T = room.engines[0], side = T.actorOfPhase();
    const actorSeat = (side === 'A' ? B.attP : B.defP).owner, fighter = side === 'A' ? B.fa : B.fd;
    const c = room._bclock;
    ok(c && c.key.startsWith('battle:') && c.owner === actorSeat && c.left === 8000 && c.deadline != null,
      '전투 행동 60초는 지금 고르는 전투원의 좌석에 선다');
    ok(view(room, actorSeat).clock.key === 'battle' && view(room, actorSeat).clock.running,
      '회선에는 battle 키로 남은 시간이 나간다');
    ok(fighter.skills && fighter.skills.some((_, i) => T.slotUsable(fighter, i, side)), '전제: 아직 쓸 수 있는 기술이 있다');
    const manual = H.act(room, actorSeat, { t: 'pass' });
    ok(!manual.ok && manual.reason === 'E_ILLEGAL_ACTION', '사람의 수동 넘기기는 기술이 남아 있으면 그대로 불법이다');
    const seq = B.actSeq || 0, round = B.round, actLeft = room._act && room._act.deadline;
    room._onClock(actorSeat, c.key);
    // 시간 초과 넘기기가 Core 에서 거부되면 서버는 fail-closed 로 룸을 닫는다 — 그 갈래를 먼저 잡아 남은 단언이 조용히 터지지 않게 한다.
    ok(!!room.engines && room.state === STATES.IN_PROGRESS, '전투 행동 60초 만료를 Core 가 받아들인다 (쓸 수 있는 기술이 있어도)');
    if (!room.engines) { done(); return; }
    const after = S0(room);
    // 행동 토큰은 pass 와 nextPhase 에서 각각 올라간다(수동 넘기기와 같은 자리) — 늘어났는지만 본다.
    ok(after.battle === B && (B.actSeq || 0) > seq, '만료 → 전투는 계속되고 행동 토큰만 나간다 (전투 취소·즉시 패배 없음)');
    ok(after.phase === 'play' && after.turnCount >= 0 && after.current === S.current, '보드 턴은 그대로다');
    ok(room._act && room._act.deadline === actLeft && room._act.deadline === null, '보드 행동 30초는 그동안 멈춘 채 그대로다');
    ok(room._bclock && room._bclock.key !== c.key && room._bclock.left === 8000 && !room._bclock.expired,
      '다음 전투 행동에는 새 60초를 준다');
    ok(B.round === round || B.round === round + 1, '연달아 만료되면 라운드가 소진될 뿐 — 즉시 종료가 아니다');
    // 단절은 전투 행동 60초도 멈춘다. 그 동안 흐르는 것은 재연결 유예뿐이고 B08 20초와도 별개다.
    await sleep(40); // 실제로 흐른 시간이 있어야 "남은 시간만 들고 멈춘다"를 볼 수 있다
    room.socketClosed(1 - actorSeat);
    ok(room._bclock.deadline === null && room._bclock.handle === null && room._bclock.left > 0 && room._bclock.left < 8000,
      '단절 → 전투 행동 60초도 남은 시간만 들고 멈춘다: ' + room._bclock.left);
    ok(room.seats[1 - actorSeat].disconnectExpiry != null, '흐르는 것은 재연결 유예 60초뿐 — 서로 다른 시계다');
    const blocked = H.act(room, actorSeat, { t: 'pass' });
    ok(!blocked.ok && blocked.reason === 'E_PAUSED', '단절 중에는 전투 입력도 멈춘다');
    const bleft = room._bclock.left;
    room.resumeSeat(1 - actorSeat, room.seats[1 - actorSeat].credential.current, fakeWs());
    ok(room._bclock.deadline != null && room._bclock.left === bleft, '복구 → 전투 행동 60초도 남은 시간 그대로 이어진다');
    room._clearClock();
  }

  /* ===== 13. PD 가 지목한 순서 — 보드 잔여 → 대상 선택 새 30초 → 그 남은 시간으로 B02 → 전투 뒤 보드 잔여 재개 =====
     "보드 12초가 남은 상태에서 이동이 대상 2개를 만들면 새 30초, 27초를 쓰고 고르면 B02 는 남은 3초로 응답하고,
      전투가 끝나면 보드는 12초부터 이어진다." 세 시각이 서로를 침범하지 않는지 값으로 대조한다. */
  {
    const room = ecoRoom(21, { shopMs: 60, actMs: 10000 });
    await started(room);
    const foeSeat = 1 - S0(room).current;
    const owned = new Set(S0(room).pieces.filter((p) => p.rosterId).map((p) => p.rosterId));
    const freeId = room.engines[0].ROSTER.map((r) => r.id).find((id) => !owned.has(id));
    both(room, (E) => { E.S.eco.bag[foeSeat].push(E.ecoMakeUnit(E.S, freeId, 2)); }); // 방어자 동료가 고를 대리가 있어야 B02 화면이 뜬다
    const f = forcedBoard(room, 2, true);
    const board = room._act;
    await sleep(40);                       // 주 행동에 쓴 시간 — 이 잔여가 끝까지 보존돼야 한다
    moveVia(room, f.cur, f.from, f.to);
    const boardLeft = room._act.left;
    ok(room._pick && room._pick.left === 10000 && room._act === board && room._act.deadline === null && boardLeft < 10000,
      '대상 2개 — 새 30초가 서고 보드 잔여는 그 자리에서 멈춘다: 보드 ' + boardLeft);

    await sleep(40);                       // 고르는 데 쓴 시간 — 이것은 선택 시계에서만 빠져야 한다
    const pickClock = room._pick;
    const rTarget = room._handleAction(f.cur, { baseRevision: room.revision, action: { t: 'cell', r: T2C[0], c: T2C[1] } });
    ok(rTarget.ok && S0(room).entryPick && !S0(room).battle, '동료 대상을 고르면 출전 선택(B02)이 먼저 열린다');
    ok(room._pick === pickClock && room._pick.deadline != null && room._pick.left === 10000 && room._pick.owner === foeSeat,
      'B02 는 **대상 선택 시계의 남은 시간**으로 이어지고 실제 선택자(방어자)가 응답한다 — 새 30초가 아니다');
    const shown = view(room, foeSeat).clock;
    ok(shown && shown.key === 'pick' && shown.running && shown.leftMs < 10000 && shown.leftMs > 0,
      '방어자에게 가는 남은 시간은 고르는 데 쓴 만큼 이미 줄어 있다: ' + (shown && shown.leftMs));
    ok(room._act === board && room._act.deadline === null && room._act.left === boardLeft,
      '그동안 보드 30초는 1ms 도 줄지 않는다');

    // 방어자가 본체로 답하고 전투가 열린다 → 선택 시계는 사라지고 보드 잔여는 그대로다
    for (let n = 0; n < 4 && !S0(room).battle; n++) {
      const pm = room._pendingModal();
      if (!pm) break;
      H.act(room, pm.owner, { t: 'modal', seq: pm.seq, i: 0 });
    }
    ok(S0(room).battle && room._pick === null && room._act.left === boardLeft,
      '전투가 열리면 선택 시계는 끝나고 보드 잔여는 그대로다');
    const turn = S0(room).turnCount;
    both(room, (E) => { E.S.battle = null; }); // 전투 종료만 픽스처로 흉내
    room._syncClock();
    ok(S0(room).turnCount === turn && room._act.deadline != null && room._act.left === boardLeft,
      '전투가 끝나면 보드는 **주 행동 뒤 남은 그 시간**부터 이어 흐른다 (턴 종료 아님)');
    room._clearClock();
  }

  // ===== 14. T4 경계 — 개봉 표를 열어도 60초는 그대로 · 추가 공격 단계의 만료도 그 행동만 건너뛴다 =====
  {
    const room = ecoRoom(22, { shopMs: 60, actMs: 10000, battleMs: 8000 });
    await started(room);
    H.openBattle(room);
    room._syncClock();
    const T = room.engines[0], B = S0(room).battle;
    const side = T.actorOfPhase(), seat = (side === 'A' ? B.attP : B.defP).owner;
    const c = room._bclock, dl = c.deadline;
    both(room, (E) => { E.S.battle.pkgSel = { kind: 'itemGift', owner: seat, id: 1, round: E.S.battle.round }; }); // 개봉 표를 연다
    room._syncClock();
    ok(room._bclock === c && room._bclock.deadline === dl && room._bclock.key === c.key,
      '개봉 표(하위 메뉴)를 열어도 전투 행동 60초는 다시 서지 않는다');
    both(room, (E) => { E.S.battle.pkgSel = null; });
    room._syncClock();
    ok(room._bclock === c && room._bclock.deadline === dl, '표를 닫아도 마찬가지다');

    // #241 R1 추가 공격 단계 — 수동 넘기기는 불가이지만 시간 초과는 그 행동만 건너뛴다
    both(room, (E) => { E.S.battle.bonus = { side: E.actorOfPhase(), tailSlot: 0, saved: {}, allowed: [], stage: 'active' }; }); // 번개 꼬리가 세우는 모양 그대로(v2BonusEnd 가 saved 를 되돌린다)
    const seq = B.actSeq || 0;
    const manual = H.act(room, seat, { t: 'pass' });
    ok(!manual.ok && manual.reason === 'E_ILLEGAL_ACTION', '추가 공격 단계에서 수동 넘기기는 그대로 불법이다');
    room._onClock(seat, room._bclock.key);
    ok(!!room.engines && room.state === STATES.IN_PROGRESS, '추가 공격 단계의 60초 만료도 Core 가 받아들인다');
    ok(room.engines && S0(room).battle === B && (B.actSeq || 0) > seq && B.bonus === null,
      '만료 → 추가 공격 한 번만 건너뛰고 전투는 계속된다');
    room._clearClock();
  }

  /* ===== 15. 마감은 지났는데 만료 콜백이 아직 안 돈 창의 늦은 입력 (Saturn REVISE P1) =====
     종전 판정은 `expired` 표식만 봤다. 그 표식은 콜백이 **돈 뒤에야** 서므로 마감 시각과 setTimeout 발화 사이
     (이벤트 루프가 밀리면 넓어진다)로 들어온 입력이 그대로 통과했다 — Saturn 재현에서 늦은 skipMain 이
     ok:true·mainUsed·revision 증가로 받아들여졌다. 판정은 경제 인가와 같은 **서버 시각 대조**여야 한다.
     결정적으로 재현한다: deadline 만 과거로 밀고 expired=false·handle 은 그대로 둔다(= 콜백 대기 상태 그 자체).
     매번 보는 것 셋: 늦은 입력이 E_DEADLINE 으로 떨어진다 · 상태·revision·시계가 하나도 안 바뀐다 ·
     걸려 있던 만료는 예정대로 **한 번** 돈다. */
  { // 보드 행동 30초
    const room = ecoRoom(23, { shopMs: 60, actMs: 60000 });
    await started(room);
    const cur = S0(room).current, c = room._act;
    ok(c && c.deadline != null && !c.expired && c.handle, '전제: 보드 30초가 콜백을 건 채 흐른다');
    c.deadline = Date.now() - 1;
    const rev = room.revision, turn = S0(room).turnCount;
    const late = H.act(room, cur, { t: 'skipMain' });
    ok(!late.ok && late.reason === 'E_DEADLINE', '마감을 넘긴 보드 입력은 콜백 전이어도 거부된다');
    ok(!S0(room).mainUsed && room.revision === rev && S0(room).turnCount === turn && S0(room).current === cur && !c.expired,
      '거부는 상태·revision·시계를 하나도 바꾸지 않는다');
    room._onClock(cur, c.key); // setTimeout 이 부르는 그 진입점
    ok(c.expired && S0(room).turnCount === turn + 1 && S0(room).current === 1 - cur, '걸려 있던 만료 콜백은 예정대로 돈다');
    const after = room.revision;
    room._onClock(cur, c.key);
    ok(room.revision === after && S0(room).turnCount === turn + 1, '같은 만료가 두 번 실행되지 않는다');
    room._clearClock();
  }
  { // 강제 전투 대상 선택 30초 (T3)
    const room = ecoRoom(24, { shopMs: 60, actMs: 60000 });
    await started(room);
    const f = forcedBoard(room, 2);
    moveVia(room, f.cur, f.from, f.to);
    const c = room._pick;
    ok(c && c.deadline != null && !c.expired && S0(room).forcedTargets.length === 2, '전제: 대상 선택 30초가 흐른다');
    c.deadline = Date.now() - 1;
    const rev = room.revision, tgt = S0(room).pieces.find((p) => p.id === S0(room).forcedTargets[0]);
    const late = H.act(room, f.cur, { t: 'cell', r: tgt.r, c: tgt.c });
    ok(!late.ok && late.reason === 'E_DEADLINE', '마감을 넘긴 대상 선택은 거부된다');
    ok(!S0(room).battle && !S0(room).entryPick && room.revision === rev && S0(room).forcedTargets.length === 2 && !c.expired,
      '거부는 전투를 열지 않고 강제 표식·revision 도 그대로다');
    room._onClock(c.owner, c.key);
    ok(c.expired && (S0(room).battle || S0(room).entryPick), '걸려 있던 선택 만료는 예정대로 서버 대행 선택을 한다');
    room._clearClock();
  }
  { // 전투 행동 60초 (T4)
    const room = ecoRoom(25, { shopMs: 60, actMs: 60000, battleMs: 60000 });
    await started(room);
    H.openBattle(room);
    room._syncClock();
    const T = room.engines[0], B = S0(room).battle;
    const seat = (T.actorOfPhase() === 'A' ? B.attP : B.defP).owner;
    const c = room._bclock;
    ok(c && c.deadline != null && !c.expired, '전제: 전투 행동 60초가 흐른다');
    c.deadline = Date.now() - 1;
    const rev = room.revision, seq = B.actSeq || 0;
    const late = H.act(room, seat, { t: 'act', k: 0 });
    ok(!late.ok && late.reason === 'E_DEADLINE', '마감을 넘긴 전투 입력은 거부된다');
    ok(room.revision === rev && (S0(room).battle.actSeq || 0) === seq && !c.expired, '거부는 전투 상태·revision 을 바꾸지 않는다');
    room._onClock(seat, c.key);
    ok(c.expired && (S0(room).battle.actSeq || 0) > seq, '걸려 있던 전투 만료는 예정대로 그 행동 하나를 건너뛴다');
    room._clearClock();
  }
  { // 배치 90초 — 늦은 배치·준비도 같은 문에서 떨어진다. 서버 자신의 자동 배치는 그 문을 지나지 않는다.
    const room = ecoRoom(26, { placeMs: 60000 });
    finishStart(room, 0);
    const c = room._clock[0];
    ok(c && c.key === 'place' && c.deadline != null && !c.expired, '전제: 배치 90초가 흐른다');
    c.deadline = Date.now() - 1;
    const rev = room.revision;
    const lateSetup = room.handleCommand(0, { t: 'setup', roster: S0(room).roster[0].slice(), pos: H.makeSetup().pos });
    const lateReady = room.handleCommand(0, { t: 'ready' });
    ok(!lateSetup.ok && lateSetup.reason === 'E_DEADLINE' && !lateReady.ok && lateReady.reason === 'E_DEADLINE',
      '마감을 넘긴 배치·준비는 콜백 전이어도 거부된다');
    ok(!room.seats[0].placed && !room.seats[0].ready && !room.seats[0].rawSetup && room.revision === rev && !c.expired,
      '거부는 좌석 배치·준비·revision 을 바꾸지 않는다');
    room._onClock(0, 'place');
    ok(c.expired && room.seats[0].placed && room.seats[0].ready && room._clock[0] === null,
      '걸려 있던 배치 만료는 예정대로 자동 배치·준비를 끝낸다 — 서버 자신의 배치는 이 문에 막히지 않는다');
  }
  { // 멈춘 시계는 시한 대조에 걸리지 않는다 — 정지 중에는 deadline 이 없고 남은 시간만 보존된다
    const room = ecoRoom(27, { placeMs: 120, graceMs: 5000 });
    finishStart(room, 0);
    room.socketClosed(1);
    const c = room._clock[0];
    ok(c && c.key === 'place' && c.deadline === null && !c.expired, '전제: 단절로 배치 시계가 남은 시간만 들고 멈췄다');
    await sleep(180); // 멈춰 있는 동안 벽시계로는 원래 시한을 넘겼다
    room.resumeSeat(1, room.seats[1].credential.current, fakeWs());
    const back = room.handleCommand(0, { t: 'setup', roster: S0(room).roster[0].slice(), pos: H.makeSetup().pos });
    ok(back.ok && room.seats[0].placed, '복구 뒤의 배치는 받아들인다 — 멈춰 있던 동안 지난 시간은 시한을 깎지 않는다');
    room._clearClock();
  }

  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
