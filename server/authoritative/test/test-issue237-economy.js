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
  const room = new H.Room(id, Object.assign({ isPublic: false, epoch: 'aaaaaaaa', graceMs: 5000, economy: true, seed: 237, shopMs: 60000, bagPickMs: 60000, placeMs: 60000, actMs: 60000 }, opts || {}));
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
    ok(v0.you.eco.coins === 10 && v0.you.eco.bag.length === 0 && v0.shop.slots.length === 6 && v0.shop.slots.every((x) => x && x.grade === 1), '🪙10 · 가방 0 · ⭐1 진열 6칸 (#263)');
    ok(v0.clock && v0.clock.running && v0.clock.leftMs <= 60000 && v1.clock.running, '좌석마다 상점 시계가 표시 순간부터 흐른다');
    ok(S0(room).eco.shop.active === null, '온라인 상점은 순차(active)가 아니라 동시다');
    ok(!('units' in v0) || v0.units.length === 0, 'S01 동안 상대 말은 없다');

    const before1 = stable(view(room, 1));
    const r = shop(room, 0, 'shopBuy', { i: 0 });
    const a = view(room, 0);
    ok(r.ok && a.you.eco.coins === 9 && a.shop.slots.length === 6 && a.shop.slots[0] && a.shop.slots[0].soldOut && a.shop.slots[0].sold && a.shop.seq === 1,
      '구매 수락: 🪙-1 · 산 칸은 SOLD OUT 으로 남고 6칸은 그대로 · 진열 번호 +1 (#263)');
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

    // 예비 재화(2.2 · #263): 🪙9 · 빈 필드 k=5 · 살 수 있는 칸 v=5(6칸 중 1칸 품절) → 필수 5 → 칸 밖 지출은 🪙4 까지. 다섯째는 전부 거부.
    for (let n = 0; n < 4; n++) shop(room, 0, 'shopGood', { item: 'ball' });
    const s3 = snap(room);
    const fourth = shop(room, 0, 'shopGood', { item: 'ball' });
    ok(!fourth.ok && fourth.reason === 'E_ILLEGAL_ACTION' && snap(room) === s3 && S0(room).eco.coins[0] === 5 && S0(room).balls[0] === 5, // #285 시작 볼1 + 산 볼4
      '예비 재화 위반 거래는 전부 거부(코인·볼·진열 불변) — Core 판정을 서버가 거부로 돌려준다');
    const ticket = shop(room, 0, 'shopGood', { item: 'ticket' });
    ok(!ticket.ok && snap(room) === s3, 'S01 티켓도 예비 재화 위반이면 거부 (#238 — 품목 자체는 S01 판매)');
    // 좌석 1 거부 거래도 상태 0변경 — 서버의 온라인 상점 보정(setupPlayer)까지 되돌린다. 이어서 좌석 1 유효 거래는 반영된다.
    const q4 = snap(room), sv4 = [0, 1].map((s) => stable(view(room, s))), rv4 = room.revision, sp4 = room.engines.map((T) => T.S.setupPlayer);
    const t1 = shop(room, 1, 'shopGood', { item: 'bogus' }); // #238: 티켓은 이제 S01 상품이라 없는 품목으로 거부를 만든다
    const same = !t1.ok && t1.reason === 'E_ILLEGAL_ACTION' && snap(room) === q4 && [0, 1].every((s) => stable(view(room, s)) === sv4[s]) && room.revision === rv4
      && JSON.stringify(room.engines.map((T) => T.S.setupPlayer)) === JSON.stringify(sp4);
    const c1 = S0(room).eco.coins[1], g1 = shop(room, 1, 'shopGood', { item: 'ball' });
    ok(same && g1.ok && S0(room).eco.coins[1] < c1 && room.engines[1].S.eco.coins[1] === S0(room).eco.coins[1] && snap(room) !== q4,
      '좌석 1 거부 거래: fingerprint·양 좌석 뷰·revision·setupPlayer 불변 · 이어진 좌석 1 유효 거래는 두 엔진에 반영 ' + JSON.stringify([t1, sp4]));

    finishStart(room, 0);
    const d = view(room, 0);
    ok(d.phase === 'setup' && d.shop.done && S0(room).pieces.filter((p) => p.owner === 0 && p.type === 'minion' && p.rosterId).length === 6,
      '새로 고침 없이 6칸에서 여섯을 사고 완료 → 배치 단계 (#263)');
    // #263: 직접 완료한 좌석은 상점 시계 대신 배치 90초를 받는다.
    ok(d.clock && d.clock.key === 'place' && d.clock.running, '직접 완료 → 배치 시계 시작 (#263)');
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

  // ===== 1b. #238 S01 상품 8종 실구매 — 아이템 5종 · 전투 버프 3종, 예비 재화 · 사용 시점 · 만료 자동 구매 =====
  {
    const room = ecoRoom(238, { shopMs: 200 });
    const store = (seat, k) => {
      const S = S0(room);
      return k === 'ball' ? S.balls[seat] : k === 'ticket' ? S.eco.tickets[seat] : S.eco.buffInv[seat][k] !== undefined ? S.eco.buffInv[seat][k] : S.inv[seat].filter((x) => x === k).length;
    };
    for (const [seat, goods] of [[0, ['ticket', 'power', 'time', 'escape']], [1, ['potion', 'cool', 'cure', 'ball']]]) {
      for (const k of goods) {
        const c = S0(room).eco.coins[seat], n = store(seat, k);
        const r = shop(room, seat, 'shopGood', { item: k });
        ok(r.ok && S0(room).eco.coins[seat] === c - 1 && store(seat, k) === n + 1 && room.engines[1 - seat].S.eco.coins[seat] === c - 1,
          `S01 ${k} 구매 수락: 🪙-1 · 보관처 +1 · 두 엔진 반영`);
      }
      const s5 = snap(room), g5 = shop(room, seat, 'shopGood', { item: 'potion' });
      ok(!g5.ok && g5.reason === 'E_ILLEGAL_ACTION' && snap(room) === s5 && S0(room).eco.coins[seat] === 6, `좌석 ${seat} 다섯째 상품은 예비 재화(빈 칸 6)로 거부 · 상태 불변`);
    }
    ok(!JSON.stringify(view(room, 1)).includes('"tickets":1') && view(room, 0).you.eco.tickets === 1 && view(room, 0).you.eco.buffInv.escape === 1, 'S01 상품 보유는 소유자 뷰에만');
    const king = view(room, 0).you.pieces.find((p) => p.type === 'king').id, s6 = snap(room);
    const use = shop(room, 0, 'shopTicket', { id: king, el: 'water' });
    ok(!use.ok && snap(room) === s6, 'S01 티켓 사용은 여전히 거부 — 사용 시점은 [기획 필요]');
    await sleep(320);
    const S = S0(room);
    ok([0, 1].every((s) => S.pieces.filter((x) => x.owner === s && x.type === 'minion' && x.rosterId).length === 6 && S.eco.coins[s] === 0),
      '상품 4개를 산 뒤 만료 → 남은 🪙6으로 6명 자동 구매 · 🪙0 (예비 재화가 자동 구매를 보장)');
    ok(S.eco.tickets[0] === 1 && S.eco.buffInv[0].power === 1 && S.balls[1] === 2 && S.inv[1].includes('cure'), '만료 뒤에도 S01 상품은 보존');
    room._clearClock();
  }

  // ===== 2. S01 서버 시계 만료 — 자동 구매·속성 자동 배정·자동 배치(#263), 명령 없는 전이 알림 =====
  {
    const room = ecoRoom(2, { shopMs: 60, placeMs: 60000, actMs: 60000 });
    let pushed = 0; room.onUpdate = () => { pushed++; };
    shop(room, 1, 'shopBuy', { i: 2 });
    await sleep(160);
    ok(S0(room).pieces.filter((p) => p.owner === 1 && p.type === 'minion' && p.rosterId).length === 6,
      '만료 → 확정 거래 보존 + 노출 칸 자동 구매(필드 6칸)');
    ok(S0(room).pieces.filter((p) => p.owner === 1 && (p.type === 'king' || p.type === 'ally')).every((p) => p.element), '미선택 왕·동료 속성 자동 배정');
    // #263: 시간 초과 좌석은 그 자리에서 자동 배치·준비까지 끝난다 — 양측이 만료됐으므로 경기가 곧바로 시작된다.
    ok(room.seats.every((st) => st.shopTimedOut && st.placed && st.ready) && room.state === STATES.IN_PROGRESS && S0(room).phase === 'play',
      '시간 초과 좌석은 자동 배치·준비 → 배치 90초 없이 개시 (#263)');
    ok(S0(room).pieces.every((p) => p.placed), '자동 배치된 말은 모두 합법 위치에 놓인다');
    ok(pushed >= 2, '두 좌석 만료가 양측 푸시로 알려진다');
    const c = room._act; // #263 행동 30초는 방이 하나만 들고 owner 로 답할 좌석을 가리킨다
    ok(c && c.key.startsWith('act:') && c.owner === S0(room).current, '개시 뒤에는 차례 좌석의 행동 30초가 선다 (#263)');
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
    const owned = new Set(S0(room).pieces.filter((p) => p.rosterId).map((p) => p.rosterId)); // 양 좌석 보유 종 제외 — 비노출 검사가 상대 말 이름에 걸리지 않게
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
    // #263: 비소유자에게 B08 시계는 나가지 않는다. 자기 행동 30초를 들고 있으면 그것이 보이되 **멈춰 있어야** 한다(20초와 별개의 시계).
    ok(JSON.stringify(v1.bagPick) === JSON.stringify({ owner: 0 })
      && (v1.clock === null || (v1.clock.key === 'act' && v1.clock.running === false))
      && !JSON.stringify(v1).includes(free[3]), '상대: 누가 고르는 중인지만 — 포획 말·가방 비노출');
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
  /* #263 (2026-09-25 CJ): 단절 정지 중에는 **기권도** 막는다 — #237 의 "항복은 단절 중에도 받는다"를 대체한다.
     복구(재접속)가 끝나면 종전대로 즉시 종료다. 유예 만료 몰수는 아래 15장에서 따로 본다. */
  {
    const room = startedEco(13);
    const cur = S0(room).current;
    room.socketClosed(1 - cur);
    const r = room._handleAction(cur, { baseRevision: room.revision, action: { t: 'resign' } });
    const cmd = room.handleCommand(cur, { t: 'resign' });
    ok(!r.ok && r.reason === 'E_PAUSED' && !cmd.ok && cmd.reason === 'E_PAUSED' && room.state === STATES.IN_PROGRESS,
      '단절 정지 중에는 기권도 거부(E_PAUSED) — 경기는 그대로 (#263)');
    room.resumeSeat(1 - cur, room.seats[1 - cur].credential.current, fakeWs());
    const after = room.handleCommand(cur, { t: 'resign' });
    ok(after.ok && room.state === STATES.FINISHED && room.result.winner === 1 - cur, '재접속 뒤 기권은 종전대로 즉시 종료');
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
    const room = ecoRoom(21);
    finishStart(room, 0);
    for (let n = 0; S0(room).eco.bag[1].length < 1 && n < 20; n++) { // #238 픽스처: 좌석 1 은 일곱째 하수인을 사서 가방에 1명
      const i = firstBuyable(view(room, 1));
      if (!(i >= 0 ? shop(room, 1, 'shopBuy', { i }) : shop(room, 1, 'shopRefresh')).ok) throw new Error('fixture bag buy failed');
    }
    finishStart(room, 1);
    placeAndStart(room);
    const cur = S0(room).current;
    ok(!('final' in view(room, 0)) && !('final' in view(room, 1)), '#238 S04 final 은 경기 중에는 없다');
    // 픽스처: 양측 하수인 하나씩 사망 · 좌석 1 의 살아 있는 하수인 하나는 싸운 개체(hpSeen)
    both(room, (E) => {
      for (const s of [0, 1]) E.S.pieces.find((p) => p.owner === s && p.type === 'minion' && p.alive).alive = false;
      Object.assign(E.S.pieces.find((p) => p.owner === 1 && p.type === 'minion' && p.alive), { hpSeen: true });
    });
    const r = room.handleCommand(1 - cur, { t: 'resign' });
    ok(r.ok && room.state === STATES.FINISHED && room.result.type === 'WIN' && room.result.winner === cur && room.result.winType === 'resign',
      '상대 차례에도 항복 가능 → 그 좌석 패배');
    ok(view(room, cur).log.some((l) => /기권/.test(l.msg)) && view(room, 1 - cur).log.some((l) => /기권/.test(l.msg)), '양 좌석 로그에 기권 문구');
    // #238 S04 — 양측 필드 9칸(사망 포함) + Core synView 그대로 · 비공개 필드 없음 · 엔진과 참조 분리
    const f0 = view(room, 0).final, T = room.engines[0];
    const keys = new Set(['type', 'rosterId', 'name', 'element', 'alive', 'hp', 'maxHp', 'hpSeen']);
    ok(f0 && f0.sides.length === 2 && f0.sides.every((sd, s) => sd.seat === s && sd.pieces.length === 9 && sd.pieces.filter((p) => !p.alive).length === 1
      && sd.pieces.filter((p) => p.type === 'minion').length === 6 && sd.pieces.every((p) => Object.keys(p).every((k) => keys.has(k)))),
    'final: 양측 9칸(하수인 6 · 왕 · 동료 2) · 사망 포함 · 화이트리스트 필드만(별칭·위치·등급·스킬·원장·가방 없음)');
    ok(f0.sides.every((sd, s) => JSON.stringify(sd.syn) === JSON.stringify(T.synView(s, T.S))), 'final.syn 은 Core synView 그대로(새 산식 없음)');
    const field = (s) => T.S.pieces.filter((p) => p.owner === s && p.placed && T.SYN_FIELD_TYPES.includes(p.type));
    const real = (list, eng) => list.every((p, i) => p.hp === eng[i].hp && p.maxHp === eng[i].maxHp);
    const opp = f0.sides[1].pieces, seenIdx = opp.findIndex((p) => p.hpSeen);
    ok(opp.filter((p) => p.hpSeen).length === 1 && real([opp[seenIdx]], [field(1)[seenIdx]]) && opp.filter((p) => !p.hpSeen).every((p) => p.maxHp === 100)
      && real(f0.sides[0].pieces, field(0)),
      '상대 HP 는 싸운 개체만 실제값 · 나머지 100 눈금 · 내 말은 실제값');
    const h0 = snap(room);
    f0.sides[0].syn.el.fire = 99; f0.sides[0].pieces[0].hp = -1;
    const bag0 = f0.sides[1].bag, bag1 = view(room, 1).final.sides[1].bag, eb = T.S.eco.bag[1];
    ok(f0.sides[0].bag.length === 0 && bag0.length === 1 && bag0[0].type === 'minion' && bag0[0].rosterId === T.ecoKey(eb[0]) && Object.keys(bag0[0]).every((k) => keys.has(k))
      && bag0[0].maxHp === 100 && real(bag1, eb), 'final.bag: 양측 가방 하수인 · 같은 화이트리스트 · 상대에게는 100 눈금 · 소유자는 실제값');
    ok(snap(room) === h0 && view(room, 0).final.sides[0].pieces[0].hp !== -1 && T.synView(0, T.S).el.fire !== 99, '뷰를 고쳐도 엔진 · 다음 뷰는 그대로');
  }
  {
    const room = startedEco(22);
    const cur = openRegular(room);
    const other = 1 - cur;
    shop(room, other, 'shopGood', { item: 'potion' });
    const coins = S0(room).eco.coins.slice(), inv = S0(room).inv[other].join();
    room.socketClosed(cur);
    const blocked = room.handleCommand(other, { t: 'resign' });
    ok(!blocked.ok && blocked.reason === 'E_PAUSED' && room.state === STATES.IN_PROGRESS, '정기 상점 · 상대 단절 정지 중 기권 거부 (#263)');
    room.resumeSeat(cur, room.seats[cur].credential.current, fakeWs());
    const r = room.handleCommand(other, { t: 'resign' });
    ok(r.ok && room.state === STATES.FINISHED && room.result.winner === cur, '재접속 뒤 정기 상점 중 항복은 즉시 종료');
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
    ok(!/"(grade|coins|bag|soldHp|buffInv|tickets|syn|paid|legend|hpSeen)"/.test(opp), '상대 말 레코드에 등급·경제·시너지 키 없음 · 전투 전에는 hpSeen 없음');
    // #262 CJ QA(2026-09-27) — 전투에 나서 HP 가 공개된 개체(hpSeen)는 보드에서도 실제 현재 HP/최대 HP. HP 밖 비공개 필드는 그대로 없다.
    both(room, (E) => { E.S.pieces.find((x) => x.id === q.id).hpSeen = true; });
    const u2 = unitOf();
    ok(u2 && u2.hpSeen === true && u2.hp === q.hp && u2.maxHp === q.maxHp &&!('grade' in u2) && !('def' in u2) && !('skills' in u2) && !('paid' in u2) && !('cap' in u2) && !('reaperSeal' in u2),
      '전투 노출(hpSeen) 상대 말: 실제 HP/최대 HP · 등급·스탯·스킬·원장·포획·봉인 없음 ' + JSON.stringify(u2));
    // 미공개 상대 말은 hpSeen 이 있어도 위치·생존만 — HP·정체·표식 없음
    both(room, (E) => { E.S.pieces.find((x) => x.id === q.id).revealed = false; });
    const u3 = unitOf();
    ok(u3 && !['hp', 'maxHp', 'name', 'type', 'element', 'rosterId', 'hpSeen'].some((k) => k in u3), '미공개 상대 말: hpSeen 이어도 HP·정체·표식 없음 ' + JSON.stringify(u3));
  }

  {
    // #238 B04 — battle.ownSyn: 이 좌석 Core synView 스냅샷만 · 전투 전·종료 뒤 없음 · 참전 스냅샷 고정 · 엔진과 참조 분리
    const room = startedEco(35);
    const cur = S0(room).current;
    ok([0, 1].every((s) => !view(room, s).battle), 'ownSyn: 전투 전에는 battle 자체가 없다');
    const att = S0(room).pieces.find((p) => p.owner === cur && p.type === 'minion');
    const foe = S0(room).pieces.find((p) => p.owner === 1 - cur && p.type === 'minion');
    H.openBattle(room, { att: att.id, def: foe.id });
    for (let n = 0; n < 4 && !S0(room).battle; n++) { const pm = room._pendingModal(); if (!pm) break; H.act(room, pm.owner, { t: 'modal', seq: pm.seq, i: 0 }); }
    const keys = ['arch', 'bonus', 'dead', 'el', 'stage'];
    const src = (s) => JSON.stringify(room.engines[s].synView(s, room.engines[s].S));
    const own = (s) => view(room, s).battle.ownSyn;
    ok(S0(room).battle && [0, 1].every((s) => room.engines[s].S.battle.syn && own(s) && JSON.stringify(Object.keys(own(s)).sort()) === JSON.stringify(keys)
      && JSON.stringify(own(s)) === src(s) && Object.keys(view(room, s).battle).filter((k) => /syn/i.test(k)).join() === 'ownSyn'),
    'ownSyn: 좌석별 자기 엔진 synView 그대로(el·arch·dead·stage·bonus) · 상대 syn 필드 없음');
    const before = [0, 1].map((s) => JSON.stringify(own(s)));
    both(room, (E) => { E.S.pieces.find((p) => p.owner === cur && p.type === 'minion' && p.alive && p.id !== att.id).alive = false; });
    ok([0, 1].every((s) => JSON.stringify(own(s)) === before[s]), 'ownSyn: 전투 중 보드가 바뀌어도 참전 스냅샷 고정');
    const h = snap(room), v0 = own(0);
    v0.el.fire = 99; v0.stage.fire = 99; v0.dead = 99;
    ok(snap(room) === h && JSON.stringify(own(0)) === before[0], 'ownSyn: 뷰를 고쳐도 엔진 · 다음 뷰는 그대로');
    ok(room.handleCommand(1 - cur, { t: 'resign' }).ok && room.state === STATES.FINISHED
      && [0, 1].every((s) => { const v = view(room, s); return (!v.battle || !('ownSyn' in v.battle) || v.battle.ownSyn === null) && v.final.sides.length === 2; }),
    'ownSyn: 종료(FINISHED) 뒤 없음 · 결과는 final.sides 양측');
  }
  {
    // #262 CJ QA(2026-09-27) — 전투 중에는 두 전투원 모두 실제 HP/최대 HP(패널·fx·해일 X·문구·기록 피해). 종전 #237 상대 100 눈금 폐지.
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
      const v = view(room, s);
      if (v.battle) {
        for (const [l, real] of [['a', B.fa], ['d', B.fd]]) {
          const o = v.battle[l];
          if (o.hp !== real.hp || o.maxHp !== real.maxHp || o.shield !== (real.shield || 0)) bad.push(['panel', s, l, o]);
          checked++;
        }
      }
      for (const e of v.fx.events) {
        const fx = e.fx || {};
        if (fx.hp) { checked++; if (fx.hp.max !== (fx.hp.side === 'A' ? B.fa : B.fd).maxHp) bad.push(['hp', s, fx.hp]); }
        if (fx.st) { checked++; if (fx.st.max !== (fx.st.side === 'A' ? B.fa : B.fd).maxHp) bad.push(['st', s, fx.st]); }
      }
    }
    ok(B && checked >= 4 && bad.length === 0, '전투 양쪽 패널·fx HP/방어막은 실제 값(두 좌석 동일) ' + JSON.stringify(bad).slice(0, 300));
    // 전투 시작이 실제 전투원(본체 출전)에 hpSeen 을 세운다 — Core startRounds 계약(Mars)
    ok(!!(B && B.fa.hpSeen && B.fd.hpSeen), '전투원 fa/fd 에 hpSeen 표식');
    // 해일 X(HP 선) — 두 좌석 모두 양쪽 실제 값
    const tide = () => JSON.stringify([0, 1].map((s) => { const v = view(room, s); return [v.battle.a.tideMark, v.battle.d.tideMark]; }));
    both(room, (E) => { E.S.battle.fa.tideMark = 37; E.S.battle.fd.tideMark = 23; });
    const t1 = tide();
    both(room, (E) => { E.S.battle.fa.tideMark = 0; E.S.battle.fd.tideMark = 0; });
    ok(t1 === JSON.stringify([[37, 23], [37, 23]]), `전투 해일 X: 두 좌석 모두 실제 값 ${t1}`);
    ok(!JSON.stringify(view(room, 0).fx).includes('"sides"'), 'fx 이벤트에 내부 쪽별 값(sides) 없음');

    /* 문구 경계 — 주어가 있는 전투 문구·상태 아이콘은 두 좌석 모두 원문(실제 값). 주어 불명 줄만 HP 계열 수치를 '?' 로 가린다(#237 유지). */
    const HP_NUM = /(^|[^⌛⭐P\d.])(\d+)(?![\d.]|\s*(?:%|R|회|차|턴|라운드|칸|개|명|마리|초|·\s*\d+\s*차))/g;
    const mask = (t) => String(t).replace(HP_NUM, (a, p) => p + '?');
    const subj = (fx) => fx && ((fx.hp && fx.hp.side) || (fx.float && fx.float.side) || (fx.st && fx.st.side) || fx.ko || fx.shake);
    let withSubj = 0, leaks = [];
    for (const s of [0, 1]) {
      const raw = room.engines[s].__fx.items, vv = view(room, s), byseq = new Map(vv.fx.events.map((e) => [e.seq, e]));
      for (const e of raw) {
        if (e.src !== 'msg' || !/\d/.test(e.txt)) continue;
        const out = byseq.get(e.seq);
        if (subj(e.fx)) { withSubj++; if (!out || out.txt !== e.txt) leaks.push([s, 'subj', e.txt, out && out.txt]); }
        else if (!out || (out.txt !== e.txt && out.txt !== mask(e.txt))) leaks.push([s, 'nosubj', e.txt, out && out.txt]);
        if (out && out.fx && out.fx.st && e.fx.st && out.fx.st.text !== e.fx.st.text) leaks.push([s, 'st', e.fx.st.text, out.fx.st.text]);
        if (out && out.fx && out.fx.float && e.fx.float && out.fx.float.amount !== e.fx.float.amount) leaks.push([s, 'float', e.fx.float, out.fx.float]);
      }
      if (vv.battle) {
        const txts = new Set(vv.fx.events.map((e) => e.txt));
        if (!vv.battle.log.every((l) => txts.has(l))) leaks.push([s, 'battle.log 원문']);
        const Braw = room.engines[s].S.battle;
        if (vv.battle.a.rec !== (Braw.recA || 0) || vv.battle.d.rec !== (Braw.recD || 0)) leaks.push([s, 'rec', Braw.recA, Braw.recD, vv.battle.a.rec, vv.battle.d.rec]);
      }
    }
    ok(withSubj > 0 && leaks.length === 0, `전투 문구·상태 아이콘·떠오르는 수치·전투 로그·기록 피해: 실제 값(${withSubj}줄) · 주어 불명만 '?' ` + JSON.stringify(leaks).slice(0, 400));
    // 전투 뒤(또는 중) 보드 — 전투에 나선 상대 말은 실제 현재 HP/최대 HP + hpSeen, 나서지 않은 공개 상대 말은 100 눈금
    for (let n = 0; n < 20 && S0(room).battle; n++) {
      const T = room.engines[0], Bn = T.S.battle, side = T.actorOfPhase();
      H.act(room, side === 'A' ? Bn.attP.owner : Bn.defP.owner, { t: 'act', k: 0 });
    }
    const other = S0(room).pieces.find((p) => p.owner === 1 - cur && p.type === 'minion' && p.id !== foe.id && p.alive && p.placed && room.engines[0].visibleTo(cur, p));
    both(room, (E) => { E.S.pieces.find((x) => x.id === other.id).revealed = true; });
    const units = view(room, cur).units, byId = (id) => units.find((u) => u.id === room._alias(id));
    const foeNow = S0(room).pieces.find((x) => x.id === foe.id), fu = byId(foe.id), ou = byId(other.id);
    // 전투 뒤 시야에서 빠지면 레코드 자체가 없다(등급 A · 안개 유지) — 그래도 표식은 개체에 남아 다시 보일 때 실제 값이 된다(직렬화기 직접 확인)
    const fk = room._serializeKnownOpponent(foeNow);
    ok(foeNow.hpSeen === true && fk.hpSeen === true && fk.hp === foeNow.hp && fk.maxHp === foeNow.maxHp
      && (!fu || (fu.hpSeen === true && fu.hp === foeNow.hp && fu.maxHp === foeNow.maxHp))
      && (fu || !room.engines[0].visibleTo(cur, foeNow) || !foeNow.alive)
      && ou && !('hpSeen' in ou) && ou.maxHp === 100 && ou.hp === Math.ceil((other.hp * 100) / other.maxHp)
      && !/"(grade|def|spd|skills|cds|cap|paid|reaperSeal|synAtk|coins|bag)"/.test(JSON.stringify(units)),
    '전투 뒤 보드: 나선 상대 말 실제 HP · 안 나선 공개 말 100 눈금 · HP 밖 비공개 필드 없음 ' + JSON.stringify([fu, fk, ou]).slice(0, 300));
  }
  {
    // 보드 회복 틱 로그 "HP +N" — 전투에 안 나선 상대 말은 100 눈금, 자기 말과 전투 노출(hpSeen) 상대 말은 실제 값(#262)
    const room = startedEco(35);
    const cur = S0(room).current;
    const mineP = S0(room).pieces.find((p) => p.owner === cur && p.type === 'minion');
    const oppP = S0(room).pieces.find((p) => p.owner === 1 - cur && p.type === 'minion');
    const seenP = S0(room).pieces.find((p) => p.owner === 1 - cur && p.type === 'minion' && p.id !== oppP.id && p.name !== oppP.name);
    both(room, (E) => {
      for (const id of [mineP.id, oppP.id, seenP.id]) { const p = E.S.pieces.find((x) => x.id === id); p.healing = true; p.hp = Math.max(1, p.maxHp - 50); }
      E.S.pieces.find((x) => x.id === oppP.id).revealed = true;
      Object.assign(E.S.pieces.find((x) => x.id === seenP.id), { revealed: true, hpSeen: true });
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
    const seenName = S0(room).pieces.find((x) => x.id === seenP.id);
    ok(lines.some((m) => m.includes(seenName.name) && m.includes(`HP +${gain(seenName)} (회복 자세)`)) && !lines.some((m) => m.includes(seenName.name) && m.includes('%')),
      '보드 회복 로그: 전투 노출(hpSeen) 상대 말은 실제 값(% 없음) ' + JSON.stringify(lines));
  }

  // ===== 10b. #285 필드 판매 회선 — shopSell 은 가방 uid 또는 자기 필드 별칭 id 중 하나만 받는다 =====
  // 서버 경계(형태·좌석 별칭 해석·진열 번호)만 본다. 필드 판매 자체의 합법성·환급·6칸 복구는 Core(Mars) 판정이다.
  {
    const room = ecoRoom(285);
    for (const s of [0, 1]) shop(room, s, 'shopBuy', { i: firstBuyable(view(room, s)) });
    const mine = view(room, 0).you.pieces.find((p) => p.type === 'minion' && p.rosterId).id;
    const theirs = view(room, 1).you.pieces.find((p) => p.type === 'minion' && p.rosterId).id;
    const v = view(room, 0), s0 = snap(room);
    const refused = (extra, reason) => { const r = shop(room, 0, 'shopSell', extra); return !r.ok && r.reason === reason && snap(room) === s0; };
    ok(refused({ uid: 1, id: mine }, 'E_BAD_ENVELOPE') && refused({}, 'E_BAD_ENVELOPE') && refused({ id: 7 }, 'E_BAD_ENVELOPE'),
      '#285 uid·id 동시/둘 다 없음/숫자 id 는 봉투 거부 · 상태 불변');
    ok(refused({ id: theirs }, 'E_ILLEGAL_ACTION') && refused({ id: 'u-stale000' }, 'E_ILLEGAL_ACTION'),
      '#285 상대 필드 별칭·모르는 별칭은 같은 거부(존재 비노출) · 상태 불변');
    const stale = room._handleAction(0, { baseRevision: 0, action: { t: 'shopSell', shop: v.shop.shop, seq: v.shop.seq - 1, id: mine } });
    ok(!stale.ok && stale.reason === 'E_SHOP_STALE' && snap(room) === s0, '#285 지난 진열 번호의 필드 판매 거부');
    const pid = room._pidByAlias.get(mine);
    const tr = room._authorizeEco(0, { t: 'shopSell', shop: v.shop.shop, seq: v.shop.seq, id: mine, player: 1, owner: 1, paid: 99 });
    ok(tr.ok && JSON.stringify(tr.action) === JSON.stringify({ t: 'shopSell', player: 0, seq: v.shop.seq, pieceId: pid })
      && S0(room).pieces.find((p) => p.id === pid).owner === 0, '#285 자기 필드 별칭 → 내부 pieceId 로 번역 · 클라이언트 player/owner/가격 무시 ' + JSON.stringify(tr));
    const bag = room._authorizeEco(0, { t: 'shopSell', shop: v.shop.shop, seq: v.shop.seq, uid: 5 });
    ok(bag.ok && bag.action.uid === 5 && !('pieceId' in bag.action), '#285 가방 판매(uid)는 종전 그대로');

    // 끝에서 끝: 새로 고침(진열 6칸 확보) → 별칭 판매 → 원장 환급 · 칸 비움 · 종 잠금 → 다시 채우기. 두 엔진이 같은 결과를 본다.
    ok(shop(room, 0, 'shopRefresh').ok, '#285 fixture: 판매 전 새로 고침');
    const key = S0(room).pieces.find((p) => p.id === pid).rosterId, paid = S0(room).pieces.find((p) => p.id === pid).paid, c0 = S0(room).eco.coins[0];
    const sold = shop(room, 0, 'shopSell', { id: mine });
    const sv = view(room, 0), eng = room.engines.map((T) => T.S.pieces.find((p) => p.id === pid));
    ok(sold.ok && paid === 1 && S0(room).eco.coins[0] === c0 + paid && room.engines[1].S.eco.coins[0] === c0 + paid && sv.you.eco.coins === c0 + paid,
      '#285 별칭 필드 판매 수락: 원장 paid 만큼 환급 · 두 엔진·소유자 뷰 반영 ' + JSON.stringify(sold));
    ok(eng.every((p) => p.owner === 0 && p.rosterId === null && !p.paid) && !sv.you.pieces.some((p) => p.type === 'minion' && p.rosterId),
      '#285 판매한 필드 칸은 빈칸(종·원장 제거)');
    ok(sv.shop.sold.includes(key) && room.engines[1].S.eco.shop.sold[0].includes(key), '#285 판매한 종은 이번 오픈 동안 잠금');
    const again = shop(room, 0, 'shopSell', { id: mine }), s1 = snap(room);
    ok(!again.ok && snap(room) === s1, '#285 빈칸이 된 별칭의 재판매 거부 · 상태 불변');
    const ri = firstBuyable(sv), refill = shop(room, 0, 'shopBuy', { i: ri });
    const filled = S0(room).pieces.filter((p) => p.owner === 0 && p.type === 'minion' && p.rosterId);
    ok(refill.ok && filled.length === 1 && filled[0].rosterId !== key && filled[0].paid === 1 && S0(room).eco.coins[0] === c0 + paid - 1,
      '#285 판매 뒤 유효한 다시 채우기 수락(잠긴 종 제외)');
  }

  // ===== 10b. #285 경기 전 뷰의 자기 보유 — S01 볼·아이템 구매가 상점·배치·ready·재연결 뷰에 그대로 실린다(상대 뷰엔 없다) =====
  {
    const room = ecoRoom(285);
    const v0 = view(room, 0);
    const inv0 = S0(room).inv[0].join(), inv1 = view(room, 1).you.inv.join();
    ok(v0.you.balls === 1 && Array.isArray(v0.you.inv) && v0.you.inv.join() === inv0 && !inv0.includes('cure'), '#285 S01 첫 뷰: 시작 볼1 · 시작 아이템 그대로');
    const g = shop(room, 0, 'shopGood', { item: 'ball' }), p = shop(room, 0, 'shopGood', { item: 'cure' });
    const a = view(room, 0), b = view(room, 1);
    ok(g.ok && p.ok && a.phase === 'shop' && a.you.balls === 2 && a.you.balls === S0(room).balls[0] && a.you.inv.join() === S0(room).inv[0].join()
      && a.you.inv.includes('cure') && a.you.eco.coins === 8, '#285 S01 볼·해독 구매 → 자기 뷰 balls 2 · inv +해독 · 🪙8 (서버와 일치)');
    ok(b.you.balls === 1 && b.you.inv.join() === inv1 && !JSON.stringify(b).includes('cure'), '#285 상대 뷰는 자기 보유만 — 상대 구매 미노출');
    finishStart(room, 0);
    const pos = H.makeSetup().pos;
    ok(room.handleCommand(0, { t: 'setup', roster: S0(room).roster[0].slice(), pos }).ok && room.handleCommand(0, { t: 'ready' }).ok, 'fixture: 좌석 0 배치·ready');
    const r = view(room, 0);
    ok(room.state === STATES.SETUP && r.phase === 'setup' && r.seats.ready[0] && r.you.balls === 2 && r.you.inv.includes('cure'), '#285 상점 완료·ready 뒤 경기 전 뷰에도 balls·inv 유지');
    room.socketClosed(0);
    const res = room.resumeSeat(0, room.seats[0].credential.current, fakeWs());
    const rv = view(room, 0);
    ok(res.ok && rv.you.balls === 2 && rv.you.inv.includes('cure'), '#285 경기 전 재연결 뷰에도 balls·inv 복원');
    finishStart(room, 1);
    ok(room.handleCommand(1, { t: 'setup', roster: S0(room).roster[1].slice(), pos }).ok && room.handleCommand(1, { t: 'ready' }).ok && room.state === STATES.IN_PROGRESS, 'fixture: 개시');
    const iv = view(room, 0);
    ok(iv.you.balls === 2 && iv.you.inv.includes('cure'), '#285 개시 뒤 경기 중 뷰와 같은 값');
    room._clearClock();
  }
  {
    const room = new H.Room(2851, { isPublic: false, epoch: 'aaaaaaaa', economy: true, seed: 285 });
    room.openHostSeat(fakeWs());
    const o = view(room, 0);
    ok(room.state === STATES.OPEN && !('inv' in o.you) && !('balls' in o.you), '#285 OPEN(엔진 전)에는 보유 필드 없음');
  }

  // ===== 11. 실제 WebSocket — 같은 requestId 는 한 번만 처리(저장 응답 재전송) =====
  {
    const { server, lobby } = require('../server');
    lobby.economy = true;
    lobby.startGate = false; // #238 참가 즉시 시작 상점을 보는 회귀 — 대기방은 test-issue238-lobby.js
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
