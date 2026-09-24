'use strict';
// #237 온라인 경제 서버 권위 contract — GDD-23 2.2·2.3·2.4·7.5~7.9 · 8.1 ⑦⑲.
// 규칙(가격·예비 재화·진열·원장)은 Core ecoReduce 가 판정한다 — 여기서는 서버 경계만 본다:
// 좌석 인가 · 진열 번호/요청 ID 중복·낡음 · 서버 시각 마감 · 전부 적용/전부 거부 · 좌석별 비노출 · 단절 정지/재개 · 몰수·취소 순서.
const WebSocket = require('ws');
const H = require('./helpers');
const { makeCounter, fakeWs, both, snap, STATES } = H;

const { ok, done } = makeCounter('issue237-economy');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ecoRoom(id, opts) {
  const room = new H.Room(id, Object.assign({ isPublic: false, epoch: 'aaaaaaaa', graceMs: 5000, economy: true, seed: 237, shopMs: 60000, bagPickMs: 60000 }, opts || {}));
  room.openHostSeat(fakeWs());
  room.joinGuestSeat(fakeWs());
  return room;
}
// 클라이언트가 보는 자기 진열(shop·seq)을 그대로 실어 보낸다 — baseRevision 은 일부러 낡은 값(0)이다(경제 어휘는 진열 번호로 가린다).
function shop(room, seat, t, extra) {
  const v = room.toSeatView(seat);
  return room._handleAction(seat, { baseRevision: 0, action: Object.assign({ t, shop: v.shop.shop, seq: v.shop.seq }, extra || {}) });
}
const S0 = (room) => room.engines[0].S;
const view = (room, seat) => room.toSeatView(seat);
// 좌석 뷰에서 시간·revision 처럼 흐르는 값만 뺀 비교용 문자열 — "상대 거래가 내 뷰를 바꾸지 않는다"를 본다.
const stable = (v) => JSON.stringify(Object.assign({}, v, { revision: null, clock: null, fx: null }));
const firstBuyable = (v) => v.shop.slots.findIndex((x) => x && !x.sold);
// S01 을 합법 경로로 끝낸다: 살 수 있는 칸을 사고, 없으면 새로 고침, 필드 6칸이면 완료.
function finishStart(room, seat) {
  for (let n = 0; n < 20; n++) {
    const v = view(room, seat);
    if (v.phase !== 'shop') return;
    const empty = S0(room).pieces.filter((p) => p.owner === seat && p.type === 'minion' && !p.rosterId).length;
    if (!empty) { shop(room, seat, 'shopDone'); continue; }
    const i = firstBuyable(v);
    const r = i >= 0 ? shop(room, seat, 'shopBuy', { i }) : shop(room, seat, 'shopRefresh');
    if (!r.ok) throw new Error('fixture S01 failed: ' + r.reason);
  }
}
function placeAndStart(room) {
  const pos = H.makeSetup().pos;
  for (const s of [0, 1]) {
    const r = room.handleCommand(s, { t: 'setup', roster: S0(room).roster[s].slice(), pos });
    if (!r.ok) throw new Error('fixture setup failed: ' + r.reason);
  }
  room.handleCommand(0, { t: 'ready' }); room.handleCommand(1, { t: 'ready' });
  if (room.state !== STATES.IN_PROGRESS) throw new Error('fixture eco room did not start: ' + JSON.stringify(room.lastFault));
}
function startedEco(id, opts) {
  const room = ecoRoom(id, opts);
  finishStart(room, 0); finishStart(room, 1);
  placeAndStart(room);
  return room;
}
// 20번째 턴 끝 → 정기 상점 (보너스 🪙2). 턴 수만 픽스처로 당기고 나머지는 합법 입력이다.
function openRegular(room) {
  both(room, (E) => { E.S.turnCount = 19; });
  const cur = S0(room).current;
  if (!S0(room).mainUsed) H.act(room, cur, { t: 'skipMain' });
  const r = H.act(room, cur, { t: 'endTurn' });
  if (!r.ok || S0(room).phase !== 'shop') throw new Error('fixture: regular shop did not open ' + JSON.stringify(r));
  return cur;
}

async function main() {
  // ===== 1. S01 동시 오픈 · 좌석별 비노출 · 진열 번호 =====
  {
    const room = ecoRoom(1);
    const v0 = view(room, 0), v1 = view(room, 1);
    ok(room.state === STATES.SETUP && v0.phase === 'shop' && v1.phase === 'shop', '두 좌석이 모이면 S01 이 양측에 동시에 열린다(SETUP=경기 전)');
    ok(v0.you.eco.coins === 10 && v0.you.eco.bag.length === 0 && v0.shop.slots.length === 5 && v0.shop.slots.every((x) => x && x.grade === 1), '🪙10 · 가방 0 · ⭐1 진열 5칸');
    ok(v0.clock && v0.clock.running && v0.clock.leftMs <= 60000 && v1.clock.running, '좌석마다 상점 시계가 표시 순간부터 흐른다');
    ok(S0(room).eco.shop.active === null, '온라인 상점은 순차(active)가 아니라 동시다');
    ok(!('units' in v0) || v0.units.length === 0, 'S01 동안 상대 말은 없다');

    const before1 = stable(view(room, 1));
    const r = shop(room, 0, 'shopBuy', { i: 0 });
    const a = view(room, 0);
    ok(r.ok && a.you.eco.coins === 9 && a.shop.slots[0] === null && a.shop.seq === 1, '구매 수락: 🪙-1 · 산 칸은 빈칸 · 진열 번호 +1');
    ok(a.you.pieces.filter((p) => p.type === 'minion' && p.rosterId).length === 1 && a.you.pieces.some((p) => p.paid === 1 && p.fresh), '산 말은 필드 칸 · 원장 1 · 신규 표시(소유자 뷰)');
    ok(stable(view(room, 1)) === before1, '상대 구매는 내 뷰를 한 글자도 바꾸지 않는다(재화·진열·말·로그)');

    const snapBefore = snap(room);
    const dup = room._handleAction(0, { baseRevision: 0, action: { t: 'shopBuy', shop: 0, seq: 0, i: 1 } });
    ok(!dup.ok && dup.reason === 'E_SHOP_STALE' && snap(room) === snapBefore, '지난 진열 번호의 구매는 거부 · 상태 불변');
    const wrongShop = room._handleAction(0, { baseRevision: 0, action: { t: 'shopBuy', shop: 20, seq: 1, i: 1 } });
    ok(!wrongShop.ok && wrongShop.reason === 'E_SHOP_STALE' && snap(room) === snapBefore, '다른 오픈을 겨냥한 요청 거부');
    const forged = room._handleAction(1, { baseRevision: 0, action: { t: 'shopBuy', shop: 0, seq: 0, i: 0, player: 0 } });
    ok(forged.ok && S0(room).eco.coins[0] === 9 && S0(room).eco.coins[1] === 9, '클라이언트 player 는 무시하고 좌석에서 채운다');
    const oppAlias = view(room, 0).you.pieces.find((p) => p.type === 'king').id;
    const s2 = snap(room);
    const cross = shop(room, 1, 'leaderEl', { id: oppAlias, el: 'fire' });
    ok(!cross.ok && cross.reason === 'E_ILLEGAL_ACTION' && snap(room) === s2, '상대 말 별칭으로 속성 선택 거부');
    const bad = room._handleAction(0, { baseRevision: 0, action: { t: 'shopTimeout', shop: 0, seq: 1 } });
    const env = require('../protocol').validateEnvelope(JSON.stringify({ v: 1, t: 'action', requestId: 'x', seatToken: 't', baseRevision: 0, action: { t: 'shopTimeout' } }));
    ok(!bad.ok && !env.ok && env.reason === 'E_BAD_ENVELOPE' && snap(room) === s2, 'shopTimeout 은 서버 시계 전용 — 회선 봉투·룸 모두 거부');

    // 예비 재화(2.2 · D9): 🪙9 · k=5 · v=4 → 필수 6 → 칸 밖 지출은 🪙3 까지. 넷째는 전부 거부.
    for (let n = 0; n < 3; n++) shop(room, 0, 'shopGood', { item: 'ball' });
    const s3 = snap(room);
    const fourth = shop(room, 0, 'shopGood', { item: 'ball' });
    ok(!fourth.ok && fourth.reason === 'E_ILLEGAL_ACTION' && snap(room) === s3 && S0(room).eco.coins[0] === 6 && S0(room).balls[0] === 3,
      '예비 재화 위반 거래는 전부 거부(코인·볼·진열 불변) — Core 판정을 서버가 거부로 돌려준다');
    const ticket = shop(room, 0, 'shopGood', { item: 'ticket' });
    ok(!ticket.ok && snap(room) === s3, 'S01 에서 티켓 구매 거부');
    // 좌석 1 거부 거래도 상태 0변경 — 서버의 온라인 상점 보정(setupPlayer)까지 되돌린다. 이어서 좌석 1 유효 거래는 반영된다.
    const q4 = snap(room), sv4 = [0, 1].map((s) => stable(view(room, s))), rv4 = room.revision, sp4 = room.engines.map((T) => T.S.setupPlayer);
    const t1 = shop(room, 1, 'shopGood', { item: 'ticket' });
    const same = !t1.ok && t1.reason === 'E_ILLEGAL_ACTION' && snap(room) === q4 && [0, 1].every((s) => stable(view(room, s)) === sv4[s]) && room.revision === rv4
      && JSON.stringify(room.engines.map((T) => T.S.setupPlayer)) === JSON.stringify(sp4);
    const c1 = S0(room).eco.coins[1], g1 = shop(room, 1, 'shopGood', { item: 'ball' });
    ok(same && g1.ok && S0(room).eco.coins[1] < c1 && room.engines[1].S.eco.coins[1] === S0(room).eco.coins[1] && snap(room) !== q4,
      '좌석 1 거부 거래: fingerprint·양 좌석 뷰·revision·setupPlayer 불변 · 이어진 좌석 1 유효 거래는 두 엔진에 반영 ' + JSON.stringify([t1, sp4]));

    finishStart(room, 0);
    const d = view(room, 0);
    ok(d.phase === 'setup' && d.shop.done && d.clock === null && S0(room).pieces.filter((p) => p.owner === 0 && p.type === 'minion' && p.rosterId).length === 6,
      '유료 새로 고침으로 여섯째를 사고 완료 → 배치 단계, 시계 해제');
    const s4 = snap(room);
    const late = room._handleAction(0, { baseRevision: 0, action: { t: 'shopRefresh', shop: 0, seq: d.shop.seq } });
    ok(!late.ok && late.reason === 'E_ILLEGAL_ACTION' && snap(room) === s4, '완료한 상점은 다시 열리지 않는다');
    const badRoster = room.handleCommand(0, { t: 'setup', roster: S0(room).roster[0].slice().reverse(), pos: H.makeSetup().pos });
    ok(!badRoster.ok && badRoster.reason === 'E_ILLEGAL_ACTION', '배치 로스터는 산 필드 순서 그대로여야 한다');
    const early = room.handleCommand(1, { t: 'setup', roster: S0(room).roster[1].slice(), pos: H.makeSetup().pos });
    ok(!early.ok && early.reason === 'E_ILLEGAL_ACTION', '상점을 마치기 전 배치 거부');
    finishStart(room, 1);
    placeAndStart(room);
    ok(room.state === STATES.IN_PROGRESS && S0(room).phase === 'play' && S0(room).eco.shop === null && S0(room).eco.coins[0] === 0,
      '양측 배치·ready → 개시, 산 말·재화 그대로');
    ok(S0(room).pieces.filter((p) => p.owner === 0).every((p) => p.placed), '배치 좌표 적용');
  }

  // ===== 2. S01 서버 시계 만료 — 자동 구매·자동 새로 고침·속성 자동 배정, 명령 없는 전이 알림 =====
  {
    const room = ecoRoom(2, { shopMs: 60 });
    let pushed = 0; room.onUpdate = () => { pushed++; };
    shop(room, 1, 'shopBuy', { i: 2 });
    await sleep(160);
    const v = view(room, 1);
    ok(v.phase === 'setup' && v.shop.done && S0(room).pieces.filter((p) => p.owner === 1 && p.type === 'minion' && p.rosterId).length === 6,
      '만료 → 확정 거래 보존 + 빈 필드 자동 구매(필드 6칸)');
    ok(S0(room).pieces.filter((p) => p.owner === 1 && (p.type === 'king' || p.type === 'ally')).every((p) => p.element), '미선택 왕·동료 속성 자동 배정');
    ok(pushed >= 2 && view(room, 0).phase === 'setup', '두 좌석 만료가 양측 푸시로 알려진다');
    const c = room._clock[0];
    ok(c === null, '완료된 좌석 시계는 남지 않는다');
  }

  // ===== 3. 마감 — 서버 시각이 지난 요청은 타이머 발화 전이라도 거부 =====
  {
    const room = ecoRoom(3);
    room._clock[0].deadline = Date.now() - 1;
    const s = snap(room);
    const r = shop(room, 0, 'shopBuy', { i: 0 });
    ok(!r.ok && r.reason === 'E_DEADLINE' && snap(room) === s, '마감 뒤 도착한 거래 거부 · 상태 불변');
    room._clearClock();
  }

  // ===== 4. 단절 — 입력·게임 시계 정지, 재연결 뒤 잔여 시간 재개, 경기 전 만료는 취소 =====
  {
    const room = ecoRoom(4, { shopMs: 400, graceMs: 5000 });
    await sleep(30);
    room.socketClosed(1);
    const left = view(room, 0).clock.leftMs;
    const s = snap(room);
    const r = shop(room, 0, 'shopBuy', { i: 0 });
    ok(!r.ok && r.reason === 'E_PAUSED' && snap(room) === s, '상대 단절 중 거래 거부(E_PAUSED) · 상태 불변');
    const pv = view(room, 0);
    ok(pv.pause && pv.pause[0].seat === 1 && pv.pause[0].graceLeftMs > 0 && !pv.clock.running, '상대 화면: 연결 대기 표시 · 시계 멈춤');
    await sleep(450);
    ok(view(room, 0).clock.leftMs === left && room._clock[0].expired === false && room.state === STATES.SETUP, '단절 중에는 상점 시간이 흐르지 않는다(만료 없음)');
    const ready = room.handleCommand(0, { t: 'ready' });
    ok(!ready.ok && ready.reason === 'E_PAUSED', '단절 중 ready·배치도 멈춘다');
    const res = room.resumeSeat(1, room.seats[1].credential.current, fakeWs());
    const rv = view(room, 0);
    ok(res.ok && !rv.pause && rv.clock.running && rv.clock.leftMs <= left && rv.clock.leftMs > left - 50, '재연결 → 저장한 잔여 시간부터 재개');
    ok(shop(room, 0, 'shopBuy', { i: 0 }).ok, '재개 뒤 거래 수락');
    room._clearClock();
  }
  {
    const room = ecoRoom(5, { graceMs: 30 });
    room.socketClosed(1);
    await sleep(90);
    ok(room.state === STATES.CANCELED && room.result === null && room.engines === null && room._clock.every((c) => c === null), '시작 상점 중 유예 만료 = 경기 취소(승패 없음) · 시계 해제');
  }

  // ===== 5. 정기 상점 — 동시 오픈·보너스·보드 잠금·좌석별 비노출 =====
  {
    const room = startedEco(6);
    const coins = S0(room).eco.coins.slice();
    const cur = openRegular(room);
    const v0 = view(room, 0), v1 = view(room, 1);
    ok(v0.phase === 'shop' && v1.phase === 'shop' && S0(room).eco.shop.active === null && v0.shop.shop === 20, '20턴 끝 → 양측 동시 정기 상점');
    ok(v0.you.eco.coins === coins[0] + 2 && v1.you.eco.coins === coins[1] + 2, '턴 보너스 🪙2');
    ok(v0.clock.running && v1.clock.running, '양측 90초 시계');
    ok(v0.shop.syn && typeof v0.shop.syn.el === 'object' && Array.isArray(v0.shop.syn.pending), '시너지 현황은 자기 상점 뷰에만');
    const s = snap(room);
    const mv = H.act(room, cur, { t: 'skipMain' });
    ok(!mv.ok && snap(room) === s, '상점 동안 보드 행동 거부(보드 일시 정지) — 항복은 12절');
    const before1 = stable(view(room, 1));
    const g = shop(room, 0, 'shopGood', { item: 'power' });
    ok(g.ok && S0(room).eco.buffInv[0].power === 1, '정기 상점 전투 버프 구매');
    ok(stable(view(room, 1)) === before1, '상대 정기 상점 거래는 내 뷰를 바꾸지 않는다');
    const unit = view(room, 0).you.eco;
    ok(!JSON.stringify(view(room, 1)).includes('"buffInv":{"power":1'), '상대 재고 비노출');
    shop(room, 0, 'shopDone');
    ok(S0(room).phase === 'shop' && view(room, 0).shop.done && !view(room, 1).shop.done, '한쪽 완료 → 상대 완료·만료까지 대기');
    shop(room, 1, 'shopDone');
    ok(S0(room).phase === 'play' && S0(room).eco.shop === null && S0(room).current === 1 - cur && S0(room).turnCount === 20, '양측 완료 → 다음 턴(상대 차례), 턴 수 불변');
    ok(unit.coins === S0(room).eco.coins[0], '수락된 거래 유지');
  }

  // ===== 6. 상점 중 단절 → 거래 유지 → 몰수 → 종료, 몰수 뒤 요청 무효 =====
  {
    const room = startedEco(7, { graceMs: 60 });
    openRegular(room);
    shop(room, 0, 'shopGood', { item: 'potion' });
    const inv = S0(room).inv[0].slice(), coins0 = S0(room).eco.coins[0];
    room.socketClosed(1);
    const p = shop(room, 0, 'shopGood', { item: 'cure' });
    ok(!p.ok && p.reason === 'E_PAUSED', '상대 단절 중 거래 정지');
    await sleep(140);
    ok(room.state === STATES.FINISHED && room.result.type === 'FORFEIT' && room.result.winner === 0, '유예 만료 → 몰수 확정');
    ok(S0(room).inv[0].join() === inv.join() && S0(room).eco.coins[0] === coins0, '단절 전 수락 거래는 유지된다');
    const late = room._handleAction(0, { baseRevision: 0, action: { t: 'shopGood', shop: 20, seq: 0, item: 'cure' } });
    ok(!late.ok && late.reason === 'E_ROOM_CLOSED' && room._clock.every((c) => c === null), '몰수 뒤 도착한 거래 거부 · 시계 해제');
    ok(view(room, 1).phase === 'over' && !JSON.stringify(view(room, 1).you.eco.bag).includes('potion'), '종료 뷰 phase=over');
  }

  // ===== 7. 정기 상점 만료 · 재연결 뒤 새 단절은 유예 새로 60초, 게임 시계는 이어진다 =====
  {
    const room = startedEco(8, { shopMs: 250, graceMs: 5000 });
    openRegular(room);
    room.socketClosed(0);
    await sleep(40);
    room.resumeSeat(0, room.seats[0].credential.current, fakeWs());
    const left = view(room, 1).clock.leftMs;
    ok(left > 150 && left <= 250, '재연결 뒤 잔여 시간 유지: ' + left);
    await sleep(400);
    ok(S0(room).phase === 'play' && S0(room).eco.shop === null, '양측 만료 → 상점 닫힘·다음 턴');
  }

  // ===== 8. B08 — 소유자 전용 선택 · 지난 토큰 · 만료 시 포획 말만 방출 =====
  {
    const room = startedEco(9, { bagPickMs: 60 });
    const owned = new Set(S0(room).pieces.filter((p) => p.owner === 0 && p.rosterId).map((p) => p.rosterId));
    const free = room.engines[0].ROSTER.map((r) => r.id).filter((id) => !owned.has(id)).slice(0, 4);
    both(room, (E) => {
      const S = E.S;
      for (const k of free.slice(0, 3)) { const u = E.ecoMakeUnit(S, k, 1); u.paid = 1; S.eco.bag[0].push(u); }
      const cap = E.ecoMakeUnit(S, free[3], 2);
      S.eco.bagPick = { owner: 0, unit: cap, token: cap.uid }; S.phase = 'bagPick';
    });
    room._syncClock();
    const v0 = view(room, 0), v1 = view(room, 1);
    ok(v0.phase === 'bagPick' && v0.bagPick.unit && v0.bagPick.token && v0.clock.running, '소유자: 포획 말·토큰·20초 시계');
    ok(JSON.stringify(v1.bagPick) === JSON.stringify({ owner: 0 }) && v1.clock === null && !JSON.stringify(v1).includes(free[3]), '상대: 누가 고르는 중인지만 — 포획 말·가방 비노출');
    const s = snap(room);
    const other = room._handleAction(1, { baseRevision: 0, action: { t: 'bagPick', token: v0.bagPick.token, i: 0 } });
    const stale = room._handleAction(0, { baseRevision: 0, action: { t: 'bagPick', token: v0.bagPick.token + 99, i: 0 } });
    ok(!other.ok && other.reason === 'E_NOT_ACTOR' && !stale.ok && stale.reason === 'E_SHOP_STALE' && snap(room) === s, '상대 입력·지난 토큰 거부 · 상태 불변');
    const bag = S0(room).eco.bag[0].map((u) => u.uid).join();
    await sleep(140);
    ok(S0(room).phase === 'play' && !S0(room).eco.bagPick && S0(room).eco.bag[0].map((u) => u.uid).join() === bag, '20초 만료 → 포획 말만 방출, 기존 가방 불변');
  }
  {
    const room = startedEco(10);
    const owned = new Set(S0(room).pieces.filter((p) => p.owner === 1 && p.rosterId).map((p) => p.rosterId));
    const free = room.engines[0].ROSTER.map((r) => r.id).filter((id) => !owned.has(id)).slice(0, 4);
    both(room, (E) => {
      const S = E.S;
      for (const k of free.slice(0, 3)) { const u = E.ecoMakeUnit(S, k, 1); u.paid = 2; S.eco.bag[1].push(u); }
      const cap = E.ecoMakeUnit(S, free[3], 1);
      S.eco.bagPick = { owner: 1, unit: cap, token: cap.uid }; S.phase = 'bagPick';
    });
    room._syncClock();
    const c1 = S0(room).eco.coins[1], tok = view(room, 1).bagPick.token;
    const r = room._handleAction(1, { baseRevision: 0, action: { t: 'bagPick', token: tok, i: 1 } });
    ok(r.ok && S0(room).eco.coins[1] === c1 + 2 && S0(room).eco.bag[1][1].uid === tok && S0(room).phase === 'play', '기존 가방 말 선택 → 원장 환급 매각 · 포획 말이 그 자리');
    const again = room._handleAction(1, { baseRevision: 0, action: { t: 'bagPick', token: tok, i: 0 } });
    ok(!again.ok && S0(room).eco.coins[1] === c1 + 2, '같은 B08 두 번째 응답 거부');
    room._clearClock();
  }

  // ===== 9. 전투 — 가방 대리 출전 모달(소유자 전용) · 전투 버프 사용 =====
  {
    const room = startedEco(11);
    const cur = S0(room).current;
    const owned = new Set(S0(room).pieces.filter((p) => p.owner === cur && p.rosterId).map((p) => p.rosterId));
    const free = room.engines[0].ROSTER.map((r) => r.id).find((id) => !owned.has(id));
    both(room, (E) => { const u = E.ecoMakeUnit(E.S, free, 2); E.S.eco.bag[cur].push(u); E.S.eco.buffInv[cur].power = 1; });
    const ally = S0(room).pieces.find((p) => p.owner === cur && p.type === 'ally');
    const foe = S0(room).pieces.find((p) => p.owner === 1 - cur && p.type === 'minion');
    H.openBattle(room, { att: ally.id, def: foe.id });
    const mv = view(room, cur), ov = view(room, 1 - cur);
    ok(mv.modal && mv.modal.buttons && mv.modal.buttons.length === 2 && /대리/.test(mv.modal.buttons[1].text), '소유자: 본체 + 가방 말 출전 버튼');
    ok(ov.modal && !ov.modal.buttons && !ov.modal.html, '상대: 선택 대기만(문구·버튼 없음)');
    const pick = H.act(room, cur, { t: 'modal', seq: mv.modal.seq, i: 1 });
    ok(pick.ok, '가방 말 대리 선택 수락');
    for (let n = 0; n < 3 && !S0(room).battle; n++) {
      const pm = room._pendingModal();
      if (!pm) break;
      H.act(room, pm.owner, { t: 'modal', seq: pm.seq, i: 0 });
    }
    const B = S0(room).battle;
    ok(B && B.fa && B.fa.uid !== undefined && B.fa.name, '대리 전투원 = 가방 말');
    if (B) {
      const side = room.engines[0].actorOfPhase(), owner = side === 'A' ? B.attP.owner : B.defP.owner;
      if (owner === cur) {
        const s9 = snap(room);
        const badBf = room._handleAction(cur, { baseRevision: room.revision, action: { t: 'buffUse', key: 'power', bf: Object.assign(H.battleFrame(room.engines[0]), { seq: 999 }) } });
        const noBf = room._handleAction(cur, { baseRevision: room.revision, action: { t: 'buffUse', key: 'power' } });
        ok(!badBf.ok && !noBf.ok && snap(room) === s9, 'buffUse 는 BATTLE_CMDS 겨냥 프레임 필수 — 낡은/없는 bf 거부 · 상태 불변');
        const u = H.act(room, cur, { t: 'buffUse', key: 'power' });
        const u2 = H.act(room, cur, { t: 'buffUse', key: 'power' });
        ok(u.ok && S0(room).eco.buffInv[cur].power === 0 && !u2.ok, '전투 버프 사용 · 재고 0 이면 거부');
      } else ok(true, '(선턴이 상대라 버프 검사 생략)');
    }
  }

  // ===== 10. 서버 재시작 · 단절 중 항복 =====
  {
    const room = ecoRoom(12);
    room.voidForRestart();
    ok(room.state === STATES.VOID && room.result.reason === 'RESTART' && room._clock.every((c) => c === null), '서버 재시작 = VOID(무효) · 시계 해제');
  }
  {
    const room = startedEco(13);
    const cur = S0(room).current;
    room.socketClosed(1 - cur);
    const r = room._handleAction(cur, { baseRevision: room.revision, action: { t: 'resign' } });
    ok(r.ok && room.state === STATES.FINISHED && room.result.winner === 1 - cur, '의도적 항복은 단절 중에도 즉시 종료');
  }

  // ===== 12. 항복 — 경기 중 어느 좌석이든 · 경기 전은 취소 · 수락 거래 유지 → 종료 (2.4) =====
  {
    const room = ecoRoom(20);
    shop(room, 0, 'shopBuy', { i: 0 });
    const r = room.handleCommand(1, { t: 'resign' });
    ok(r.ok && r.data.phase === 'canceled' && room.state === STATES.CANCELED && room.result === null && room.engines === null && room._clock.every((c) => c === null),
      'S01(경기 전) 항복 = 경기 취소(승패 없음) · 시계 해제');
  }
  {
    const room = startedEco(21);
    const cur = S0(room).current;
    const r = room.handleCommand(1 - cur, { t: 'resign' });
    ok(r.ok && room.state === STATES.FINISHED && room.result.type === 'WIN' && room.result.winner === cur && room.result.winType === 'resign',
      '상대 차례에도 항복 가능 → 그 좌석 패배');
    ok(view(room, cur).log.some((l) => /기권/.test(l.msg)) && view(room, 1 - cur).log.some((l) => /기권/.test(l.msg)), '양 좌석 로그에 기권 문구');
  }
  {
    const room = startedEco(22);
    const cur = openRegular(room);
    const other = 1 - cur;
    shop(room, other, 'shopGood', { item: 'potion' });
    const coins = S0(room).eco.coins.slice(), inv = S0(room).inv[other].join();
    room.socketClosed(cur);
    const r = room.handleCommand(other, { t: 'resign' });
    ok(r.ok && room.state === STATES.FINISHED && room.result.winner === cur, '정기 상점 · 상대 단절 정지 중에도 항복 즉시 종료');
    ok(S0(room).eco.coins.join() === coins.join() && S0(room).inv[other].join() === inv && room._clock.every((c) => c === null), '수락된 거래 유지 · 시계 해제');
    const late = room._handleAction(other, { baseRevision: 0, action: { t: 'shopGood', shop: 20, seq: 1, item: 'cure' } });
    ok(!late.ok && late.reason === 'E_ROOM_CLOSED' && S0(room).eco.coins.join() === coins.join(), '종료 뒤 거래 거부');
  }
  {
    const room = startedEco(23);
    const owned = new Set(S0(room).pieces.filter((p) => p.owner === 0 && p.rosterId).map((p) => p.rosterId));
    const free = room.engines[0].ROSTER.map((r) => r.id).find((id) => !owned.has(id));
    both(room, (E) => { const cap = E.ecoMakeUnit(E.S, free, 1); E.S.eco.bagPick = { owner: 0, unit: cap, token: cap.uid }; E.S.phase = 'bagPick'; });
    room._syncClock();
    const r = room.handleCommand(1, { t: 'resign' });
    ok(r.ok && room.result.winner === 0 && room._clock.every((c) => c === null), 'B08 중 비소유자 항복 → 종료 · B08 시계 해제');
    const lateBag = room._handleAction(0, { baseRevision: 0, action: { t: 'bagPick', token: S0(room).eco.bagPick.token, i: 0 } });
    ok(!lateBag.ok && lateBag.reason === 'E_ROOM_CLOSED', '종료 뒤 B08 응답 거부');
  }
  {
    const legacy = H.startedRoom(24);
    const cur = legacy.engines[0].S.current;
    const r = legacy.handleCommand(1 - cur, { t: 'resign' });
    ok(!r.ok && r.reason === 'E_NOT_ACTOR' && legacy.state === STATES.IN_PROGRESS, '종전 경기(DD_ECONOMY=0)는 원본 규칙 — 자기 차례에만 기권');
  }

  // ===== 13. B08 마감 · 동시 단절 · 서버 재시작(경기 중) =====
  {
    const room = startedEco(25);
    const owned = new Set(S0(room).pieces.filter((p) => p.owner === 0 && p.rosterId).map((p) => p.rosterId));
    const free = room.engines[0].ROSTER.map((r) => r.id).find((id) => !owned.has(id));
    both(room, (E) => { const cap = E.ecoMakeUnit(E.S, free, 1); E.S.eco.bagPick = { owner: 0, unit: cap, token: cap.uid }; E.S.phase = 'bagPick'; });
    room._syncClock();
    room._clock[0].deadline = Date.now() - 1;
    const s = snap(room);
    const r = room._handleAction(0, { baseRevision: 0, action: { t: 'bagPick', token: view(room, 0).bagPick.token, i: 0 } });
    ok(!r.ok && r.reason === 'E_DEADLINE' && snap(room) === s, 'B08 마감 뒤 응답 거부(E_DEADLINE) · 상태 불변');
    room._clearClock();
  }
  {
    const room = startedEco(26, { graceMs: 60 });
    openRegular(room);
    room.socketClosed(0);
    await sleep(20);
    room.socketClosed(1);
    await sleep(160);
    ok(room.state === STATES.FINISHED && room.result.type === 'FORFEIT' && room.result.winner === 1, '정기 상점 중 양측 단절 → 먼저 만료된 쪽 몰수');
  }
  {
    const room = startedEco(27, { graceMs: 60 });
    openRegular(room);
    room.socketClosed(0); room.socketClosed(1);
    room.seats[1].disconnectExpiry = room.seats[0].disconnectExpiry;
    await sleep(160);
    ok(room.state === STATES.FINISHED && room.result.type === 'NO_CONTEST' && room.result.winner === null, '만료 시각이 같으면 승자 없음');
  }
  {
    // 타이머가 Date.now() 기준 1ms 일찍 깨어나면 대기를 유지·재무장하고, 기록된 만료 시각에 확정한다 — CI 경합 재현(결정적)
    const room = startedEco(27, { graceMs: 60 });
    openRegular(room);
    room.socketClosed(0); room.socketClosed(1);
    room._clearDisconnectTimer(0); room._clearDisconnectTimer(1);
    const t = room.seats[1].disconnectExpiry = room.seats[0].disconnectExpiry;
    const realNow = Date.now;
    try {
      Date.now = () => t - 1;
      room._onGraceExpireInProgress(0);
      ok(room.state === STATES.IN_PROGRESS && room.result === null && room.seats[0].disconnectTimer !== null, '조기 발화(now=만료-1)는 확정하지 않고 남은 시간으로 재무장');
      room._clearDisconnectTimer(0);
      Date.now = () => t;
      room._onGraceExpireInProgress(0);
    } finally { Date.now = realNow; }
    ok(room.state === STATES.FINISHED && room.result.type === 'NO_CONTEST' && room.result.winner === null, '만료 시각 정각 발화 → 같은 만료는 승자 없음');
  }
  // 콜백이 늦어도 기록된 만료 시각이 기준 — 만료 전 재개는 수락, 만료 정각·뒤 재개는 거부하고 몰수·취소를 확정한다(결정적)
  const lateResume = (room, seat, at) => {
    room._clearDisconnectTimer(0); room._clearDisconnectTimer(1); // 콜백 지연 재현
    const tok = room.seats[seat].credential.current, realNow = Date.now;
    Date.now = () => at(room.seats[seat].disconnectExpiry);
    try { return { tok, res: room.resumeSeat(seat, tok, fakeWs()) }; } finally { Date.now = realNow; }
  };
  {
    const room = startedEco(33, { graceMs: 60 });
    room.socketClosed(1);
    const { tok, res } = lateResume(room, 1, (e) => e - 1);
    ok(res.ok && room.state === STATES.IN_PROGRESS && room.seats[1].connected && room.seats[1].disconnectExpiry === null && room.seats[1].credential.current !== tok, '경기 중 만료 1ms 전 재개 수락 · 토큰 회전');
  }
  for (const [d, label] of [[0, '정각'], [1, '+1ms']]) {
    const room = startedEco(34, { graceMs: 60 });
    room.socketClosed(1);
    const { tok, res } = lateResume(room, 1, (e) => e + d);
    ok(!res.ok && res.reason === 'E_ROOM_CLOSED' && room.state === STATES.FINISHED && room.result.type === 'FORFEIT' && room.result.winner === 0 && !room.seats[1].connected && room.seats[1].credential.current === tok,
      '경기 중 만료 ' + label + ' 재개(콜백 전) 거부 → 몰수 확정 · 토큰 불변');
  }
  {
    const room = startedEco(35, { graceMs: 60 });
    room.socketClosed(0); room.socketClosed(1);
    room.seats[0].disconnectExpiry = room.seats[1].disconnectExpiry - 10; // 좌석 0 먼저 만료
    const { res } = lateResume(room, 1, (e) => e - 1); // 좌석 1은 아직 유예 안
    ok(res.ok && room.state === STATES.FINISHED && room.result.type === 'FORFEIT' && room.result.winner === 1, '상대 만료가 지난 뒤 재개 → 먼저 만료된 상대 몰수 확정 후 결과 화면 재개');
  }
  {
    const room = startedEco(36, { graceMs: 60 });
    room.socketClosed(0); room.socketClosed(1);
    room.seats[0].disconnectExpiry = room.seats[1].disconnectExpiry;
    const { res } = lateResume(room, 1, (e) => e);
    ok(!res.ok && room.state === STATES.FINISHED && room.result.type === 'NO_CONTEST' && room.result.winner === null, '같은 만료 정각 재개(콜백 전) 거부 → 승자 없음');
  }
  // 만료 콜백이 먼저 와 FINISHED 가 된 뒤의 재개도 콜백 지연과 같은 판정 — 만료 좌석은 거부·토큰 불변, 미만료 좌석은 결과 화면 재개(결정적)
  const callbackFirst = (room, seat, at, fire) => {
    room._clearDisconnectTimer(0); room._clearDisconnectTimer(1);
    const tok = room.seats[seat].credential.current, realNow = Date.now;
    try {
      Date.now = () => room.seats[fire].disconnectExpiry; room._onGraceExpireInProgress(fire);
      Date.now = () => at(room.seats[seat].disconnectExpiry);
      return { tok, res: room.resumeSeat(seat, tok, fakeWs()) };
    } finally { Date.now = realNow; }
  };
  for (const [d, label] of [[0, '정각'], [1, '+1ms']]) {
    const got = ['first', 'delayed'].map((mode) => {
      const room = startedEco(38, { graceMs: 60 });
      room.socketClosed(1);
      const { tok, res } = mode === 'first' ? callbackFirst(room, 1, (e) => e + d, 1) : lateResume(room, 1, (e) => e + d);
      return !res.ok && res.reason === 'E_ROOM_CLOSED' && room.state === STATES.FINISHED && room.result.type === 'FORFEIT' && room.result.winner === 0 &&
        !room.seats[1].connected && room.seats[1].credential.current === tok;
    });
    ok(got[0] && got[1], '만료 ' + label + ' 재개: 콜백 선행·지연 모두 거부 · 몰수 · 토큰 불변');
  }
  {
    const room = startedEco(39, { graceMs: 60 });
    room.socketClosed(0); room.socketClosed(1);
    room.seats[0].disconnectExpiry = room.seats[1].disconnectExpiry - 10; // 좌석 0 먼저 만료 → 콜백 선행으로 몰수 확정
    const { tok, res } = callbackFirst(room, 1, (e) => e - 1, 0);
    ok(res.ok && room.state === STATES.FINISHED && room.result.winner === 1 && room.seats[1].connected && room.seats[1].credential.current !== tok,
      '상대 몰수(콜백 선행) 뒤 미만료 좌석 결과 화면 재개 · 토큰 회전');
    const tok0 = room.seats[0].credential.current, realNow = Date.now, t1 = room.seats[0].disconnectExpiry + 9;
    let r0;
    try { Date.now = () => t1; r0 = room.resumeSeat(0, tok0, fakeWs()); } finally { Date.now = realNow; }
    ok(!r0.ok && r0.reason === 'E_ROOM_CLOSED' && room.seats[0].credential.current === tok0, '몰수된 만료 좌석의 결과 화면 재개 거부 · 토큰 불변');
  }
  for (const [d, label] of [[-1, '1ms 전'], [0, '정각'], [1, '+1ms']]) {
    const room = ecoRoom(37, { graceMs: 60 });
    room.socketClosed(1);
    const { res } = lateResume(room, 1, (e) => e + d);
    const want = d < 0 ? res.ok && room.state === STATES.SETUP : !res.ok && res.reason === 'E_ROOM_CLOSED' && room.state === STATES.CANCELED && room.result === null;
    ok(want, '경기 전 만료 ' + label + ' 재개: ' + (d < 0 ? '수락' : '거부 → 취소'));
    room._clearClock();
  }
  {
    const room = startedEco(28);
    openRegular(room);
    room.voidForRestart();
    ok(room.state === STATES.VOID && room.result.reason === 'RESTART' && room.engines === null && room._clock.every((c) => c === null), '정기 상점 중 서버 재시작 = VOID · 시계 해제');
  }

  // ===== 14. 뷰 경계 — 경제 방 표시 · 자기 전설 종 키 · 상대 HP 100 눈금(등급 역산 불가) =====
  {
    const open = new H.Room(29, { isPublic: true, epoch: 'aaaaaaaa', economy: true });
    open.openHostSeat(fakeWs());
    const legacy = new H.Room(30, { isPublic: true, epoch: 'aaaaaaaa' });
    legacy.openHostSeat(fakeWs());
    ok(view(open, 0).economy === true && view(open, 0).state === STATES.OPEN && view(legacy, 0).economy === false, 'OPEN 호스트 뷰가 경제 방 여부를 싣는다');
  }
  {
    const room = startedEco(31);
    const pid = S0(room).pieces.find((p) => p.owner === 0 && p.type === 'minion').id;
    both(room, (E) => { const p = E.S.pieces.find((x) => x.id === pid), u = E.ecoMakeUnit(E.S, 'L-DRAGON'); Object.assign(p, { legend: u.legend, rosterId: u.rosterId || null, name: u.name }); });
    const mine = view(room, 0).you.pieces.find((p) => p.name === S0(room).pieces.find((x) => x.id === pid).name);
    ok(mine && mine.rosterId === 'L-DRAGON' && !('legend' in mine), '자기 필드 전설의 rosterId = ecoKey(원시 legend 칸은 싣지 않는다)');
  }
  {
    const room = startedEco(32);
    const T0 = room.engines[0];
    const q = S0(room).pieces.find((p) => p.owner === 1 && p.type === 'minion' && p.alive && T0.visibleTo(0, p));
    const unitOf = () => view(room, 0).units.find((u) => u.id === room._alias(q.id));
    both(room, (E) => { const p = E.S.pieces.find((x) => x.id === q.id); p.revealed = true; p.hp = Math.floor(p.maxHp * 0.37); });
    const u1 = unitOf();
    ok(u1 && u1.maxHp === 100 && u1.hp === Math.ceil((q.hp * 100) / q.maxHp) && !('grade' in u1) && !('def' in u1) && !('skills' in u1) && !('paid' in u1),
      '공개된 상대 말: HP 는 100 눈금 비율만 · 등급·스탯·스킬·원장 없음');
    both(room, (E) => { const p = E.S.pieces.find((x) => x.id === q.id); p.grade = 4; p.maxHp *= 2; p.hp *= 2; });
    ok(JSON.stringify(unitOf()) === JSON.stringify(u1), '같은 종 · 같은 HP 비율이면 등급(최대 HP)이 달라도 상대 뷰가 한 글자도 같다');
    const opp = JSON.stringify(view(room, 0).units);
    ok(!/"(grade|coins|bag|soldHp|buffInv|tickets|syn|paid|legend)"/.test(opp), '상대 말 레코드에 등급·경제·시너지 키 없음');
  }

  {
    // 전투 — 상대 전투원 패널·fx(HP·방어막·떠오르는 수치)도 100 눈금. 자기 전투원은 실제 값.
    const room = startedEco(34);
    const cur = S0(room).current;
    const att = S0(room).pieces.find((p) => p.owner === cur && p.type === 'minion');
    const foe = S0(room).pieces.find((p) => p.owner === 1 - cur && p.type === 'minion');
    H.openBattle(room, { att: att.id, def: foe.id });
    for (let n = 0; n < 4 && !S0(room).battle; n++) { const pm = room._pendingModal(); if (!pm) break; H.act(room, pm.owner, { t: 'modal', seq: pm.seq, i: 0 }); }
    for (let n = 0; n < 4 && S0(room).battle; n++) {
      const T = room.engines[0], B = T.S.battle, side = T.actorOfPhase();
      H.act(room, side === 'A' ? B.attP.owner : B.defP.owner, { t: 'act', k: 0 });
    }
    const B = S0(room).battle;
    let checked = 0, bad = [];
    for (const s of [0, 1]) {
      const v = view(room, s), oppL = S0(room).pieces.find((p) => p.id === att.id).owner === s ? 'D' : 'A';
      if (v.battle) {
        const o = v.battle[oppL.toLowerCase()], m = v.battle[oppL === 'A' ? 'd' : 'a'], real = oppL === 'A' ? B.fa : B.fd, mineReal = oppL === 'A' ? B.fd : B.fa;
        if (o.maxHp !== 100 || o.hp !== Math.ceil((real.hp * 100) / real.maxHp) || m.maxHp !== mineReal.maxHp) bad.push(['panel', s, o, m.maxHp]);
        checked++;
      }
      for (const e of v.fx.events) {
        const fx = e.fx || {};
        if (fx.hp && fx.hp.side === oppL) { checked++; if (fx.hp.max !== 100) bad.push(['hp', s, fx.hp]); }
        if (fx.st && fx.st.side === oppL) { checked++; if (fx.st.max !== 100) bad.push(['st', s, fx.st]); }
      }
    }
    ok(B && checked >= 2 && bad.length === 0, '전투 상대 패널·fx HP/방어막은 100 눈금 · 자기 쪽은 실제 값 ' + JSON.stringify(bad).slice(0, 300));
    // 해일 X(HP 선) — 상대 쪽은 hp 와 같은 100 눈금, 자기 쪽은 실제 값. 최대 HP 를 두 배로 해도(같은 비율) 상대 뷰는 같다.
    const tide = (k) => { const out = []; for (const s of [0, 1]) { const v = view(room, s), mineL = S0(room).pieces.find((p) => p.id === att.id).owner === s ? 'a' : 'd'; out.push([v.battle[mineL].tideMark, v.battle[mineL === 'a' ? 'd' : 'a'].tideMark]); } return JSON.stringify(out) + k; };
    both(room, (E) => { E.S.battle.fa.tideMark = 37; E.S.battle.fd.tideMark = 23; });
    const MA = B.fa.maxHp, MD = B.fd.maxHp, t1 = tide('');
    const wantTide = JSON.stringify([0, 1].map((s) => (S0(room).pieces.find((p) => p.id === att.id).owner === s ? [37, Math.ceil(2300 / MD)] : [23, Math.ceil(3700 / MA)])));
    both(room, (E) => { const b = E.S.battle; b.fd.maxHp *= 2; b.fd.hp *= 2; b.fd.tideMark *= 2; b.fa.maxHp *= 2; b.fa.hp *= 2; b.fa.tideMark *= 2; });
    const t2 = tide('');
    both(room, (E) => { const b = E.S.battle; b.fd.maxHp = MD; b.fd.hp /= 2; b.fa.maxHp = MA; b.fa.hp /= 2; b.fa.tideMark = 0; b.fd.tideMark = 0; });
    ok(t1 === wantTide && JSON.parse(t2).every((r, s) => r[1] === JSON.parse(t1)[s][1]), `전투 해일 X: 상대 100 눈금 · 자기 실제 값 · 최대 HP 역산 불가 ${t1} ${t2} want ${wantTide}`);
    const store = room.engines[0].__fx.items.find((e) => e.sides);
    ok(!!store && !JSON.stringify(view(room, 0).fx).includes('"sides"'), 'fx 내부 쪽별 최대 HP(sides)는 좌석 프레임에 싣지 않는다');

    /* 문구 경계 — 상대가 주어인 전투 문구·상태 아이콘의 HP 계열 수치는 100 눈금, 자기 주어 문구는 원문 그대로.
       원문 수치(최대 HP×비율인 회복·방어막·지속 피해 등)가 상대 좌석 문구에 그대로 남으면 최대 HP=등급이 결정론적으로 역산된다. */
    const HP_NUM = /(^|[^⌛⭐P\d.])(\d+)(?![\d.]|\s*(?:%|R|회|차|턴|라운드|칸|개|명|마리|초|·\s*\d+\s*차))/g;
    // 바꾼 수치 뒤 '%' — 절대 HP 로 읽히지 않고, 다시 통과해도 두 번 바뀌지 않는다(아래 scale(out)===out)
    const scale = (t, M) => String(t).replace(HP_NUM, (a, p, n) => p + (M ? Math.ceil((n * 100) / M) + '%' : '?'));
    const subj = (fx) => fx && ((fx.hp && fx.hp.side) || (fx.float && fx.float.side) || (fx.st && fx.st.side) || fx.ko || fx.shake);
    let opp = 0, own = 0, leaks = [];
    for (const s of [0, 1]) {
      const raw = room.engines[s].__fx.items, vv = view(room, s), byseq = new Map(vv.fx.events.map((e) => [e.seq, e]));
      for (const e of raw) {
        const sd = e.src === 'msg' && subj(e.fx);
        if (!sd || !e.sides || !/\d/.test(e.txt)) continue;
        const out = byseq.get(e.seq), mine = e.sides[sd][0] === s;
        const want = mine ? e.txt : scale(e.txt, e.sides[sd][1]);
        if (mine) own++; else opp++;
        if (!out || out.txt !== want) leaks.push([s, mine ? 'own' : 'opp', e.txt, out && out.txt]);
        if (out && !mine && (scale(out.txt, e.sides[sd][1]) !== out.txt || (want !== e.txt && !/\d%/.test(out.txt)))) leaks.push([s, 'opp %/재변환', e.txt, out.txt]);
        if (out && out.fx && out.fx.st && !mine && e.fx.st && e.fx.st.side === sd && out.fx.st.text !== scale(e.fx.st.text, e.fx.st.max)) leaks.push([s, 'st', e.fx.st.text, out.fx.st.text]);
      }
      if (vv.battle) {
        const txts = new Set(vv.fx.events.map((e) => e.txt));
        if (!vv.battle.log.every((l) => txts.has(l))) leaks.push([s, 'battle.log 원문']);
        const mineL = S0(room).pieces.find((p) => p.id === att.id).owner === s ? 'a' : 'd', Braw = room.engines[s].S.battle;
        const recRaw = mineL === 'a' ? Braw.recA : Braw.recD, oppMax = (mineL === 'a' ? Braw.fd : Braw.fa).maxHp;
        if (vv.battle[mineL].rec !== Math.ceil(((recRaw || 0) * 100) / oppMax)) leaks.push([s, 'rec', recRaw, vv.battle[mineL].rec]);
      }
    }
    ok(opp > 0 && own > 0 && leaks.length === 0, `전투 문구·상태 아이콘·전투 로그·기록 피해: 상대 주어 100 눈금(${opp}줄) · 자기 주어 원문(${own}줄) ` + JSON.stringify(leaks).slice(0, 400));
  }
  {
    // 보드 회복 틱 로그 "HP +N" — 상대 말은 100 눈금, 자기 말은 실제 값
    const room = startedEco(35);
    const cur = S0(room).current;
    const mineP = S0(room).pieces.find((p) => p.owner === cur && p.type === 'minion');
    const oppP = S0(room).pieces.find((p) => p.owner === 1 - cur && p.type === 'minion');
    both(room, (E) => {
      for (const id of [mineP.id, oppP.id]) { const p = E.S.pieces.find((x) => x.id === id); p.healing = true; p.hp = Math.max(1, p.maxHp - 50); }
      E.S.pieces.find((x) => x.id === oppP.id).revealed = true;
    });
    const gain = (p) => Math.min(Math.round(p.maxHp * room.engines[0].BAL.healPostPct), 50);
    if (!S0(room).mainUsed) H.act(room, cur, { t: 'skipMain' });
    H.act(room, cur, { t: 'endTurn' });
    const mineName = S0(room).pieces.find((x) => x.id === mineP.id), oppName = S0(room).pieces.find((x) => x.id === oppP.id);
    const lines = view(room, cur).log.map((l) => l.msg).filter((m) => /HP \+\d+%? \(회복 자세\)/.test(m));
    const wantMine = `HP +${gain(mineName)} (회복 자세)`, wantOpp = `HP +${Math.ceil((gain(oppName) * 100) / oppName.maxHp)}% (회복 자세)`;
    ok(lines.some((m) => m.includes(mineName.name) && m.includes(wantMine)) && lines.some((m) => m.includes(oppName.name) && m.includes(wantOpp))
      && !lines.some((m) => m.includes(oppName.name) && m.includes(`HP +${gain(oppName)} `))
      && lines.some((m) => m.includes(mineName.name) && !m.includes('%')),
    '보드 회복 로그: 자기 말 실제 값(% 없음) · 상대 말 100 눈금 + % ' + JSON.stringify(lines));
  }

  // ===== 11. 실제 WebSocket — 같은 requestId 는 한 번만 처리(저장 응답 재전송) =====
  {
    const { server, lobby } = require('../server');
    lobby.economy = true;
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const conn = (cred) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/`, ['digit-duel.v1', cred]);
      const buf = [];
      ws.on('message', (d) => buf.push(JSON.parse(d.toString())));
      const next = async (pred) => { for (let n = 0; n < 200; n++) { const i = buf.findIndex(pred); if (i >= 0) return buf.splice(i, 1)[0]; await sleep(10); } throw new Error('timeout'); };
      return { ws, next };
    };
    const host = conn('c-eco237');
    const opened = await host.next((m) => m.type === 'room_opened');
    const guest = conn('j-' + opened.inviteCode);
    const joined = await guest.next((m) => m.type === 'room_joined');
    const notice = await host.next((m) => m.type === 'room_state' && !m.requestId);
    ok(notice.data.phase === 'shop' && notice.data.you.eco.coins === 10, 'WS: 참가 알림에 자기 시작 상점');
    const msg = { v: 1, seatToken: joined.seatToken, tokenGen: joined.tokenGen, requestId: 'buy-1', t: 'action', baseRevision: 0,
      action: { t: 'shopBuy', shop: 0, seq: 0, i: 0 } };
    guest.ws.send(JSON.stringify(msg));
    const first = await guest.next((m) => m.requestId === 'buy-1');
    guest.ws.send(JSON.stringify(msg));
    const second = await guest.next((m) => m.requestId === 'buy-1');
    const room = lobby.getRoom(opened.roomId);
    ok(first.type === 'room_state' && second.type === 'room_state' && second.revision === first.revision && room.engines[0].S.eco.coins[1] === 9,
      'WS: 같은 requestId 재전송은 재실행 없이 저장 응답(🪙 한 번만 차감)');
    ok(!JSON.stringify(first.data).includes('"coins":10') || first.data.you.eco.coins === 9, 'WS: 응답은 자기 경제');
    ok(opened.economy === true && joined.economy === true, 'WS: 첫 프레임(room_opened·room_joined)에 경제 방 표시');
    guest.ws.send(JSON.stringify(Object.assign({}, msg, { requestId: 'buy-stale' })));
    const stale = await guest.next((m) => m.requestId === 'buy-stale');
    ok(stale.type === 'error' && stale.code === 'E_SHOP_STALE' && room.engines[0].S.eco.coins[1] === 9, 'WS: 새 requestId 라도 지난 진열 번호면 E_SHOP_STALE');
    guest.ws.close();
    const wait = await host.next((m) => m.type === 'room_state' && m.data.pause);
    ok(wait.data.pause[0].seat === 1 && !wait.data.clock.running, 'WS: 단절 확정 즉시 상대에게 연결 대기 푸시 · 시계 정지');
    host.ws.close();
    // 경기 전 항복(취소) — 응답과 상대 푸시 모두 CANCELED
    const h2 = conn('c-eco237b');
    const o2 = await h2.next((m) => m.type === 'room_opened');
    const g2 = conn('j-' + o2.inviteCode);
    const j2 = await g2.next((m) => m.type === 'room_joined');
    await h2.next((m) => m.type === 'room_state' && !m.requestId);
    g2.ws.send(JSON.stringify({ v: 1, seatToken: j2.seatToken, tokenGen: j2.tokenGen, requestId: 'rs-1', t: 'resign' }));
    const rsp = await g2.next((m) => m.requestId === 'rs-1');
    const push = await h2.next((m) => m.type === 'room_state' && m.data.state === 'CANCELED');
    ok(rsp.data.state === 'CANCELED' && push.data.result === null, 'WS: S01 항복 → 양측 CANCELED(승패 없음)');
    h2.ws.close(); g2.ws.close();
    server.close();
    for (const r of lobby.rooms.values()) r._clearClock();
  }

  done();
  process.exit(process.exitCode || 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
