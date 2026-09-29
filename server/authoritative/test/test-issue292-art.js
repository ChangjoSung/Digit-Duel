'use strict';
// #292 공개 아트 정체 — ① 공개된 상대 전설 보드 말은 rosterId=ecoKey(L-*) ② 경제 가방(구매·포획) 대리 출전 전투원은
// artRosterId=그 개체 ecoKey. 양 좌석·재연결 뒤에도 같고, 미공개 상대 전설·출전하지 않은 가방·등급·원시 legend 는 새지 않는다.
const H = require('./helpers');
const { makeCounter, fakeWs, both, STATES } = H;
const { ok, done } = makeCounter('issue292-art');

function ecoRoom(id) {
  const room = new H.Room(id, { isPublic: false, epoch: 'aaaaaaaa', graceMs: 5000, economy: true, seed: 292, shopMs: 60000, bagPickMs: 60000, placeMs: 60000, actMs: 60000 });
  room.openHostSeat(fakeWs());
  room.joinGuestSeat(fakeWs());
  return room;
}
const S0 = (room) => room.engines[0].S;
// test-issue237-economy.js 의 S01·배치 픽스처와 같은 합법 경로
function startedEco(id) {
  const room = ecoRoom(id);
  for (const seat of [0, 1]) {
    for (let n = 0; n < 20; n++) {
      const v = room.toSeatView(seat);
      if (v.phase !== 'shop') break;
      const empty = S0(room).pieces.filter((p) => p.owner === seat && p.type === 'minion' && !p.rosterId).length;
      const i = v.shop.slots.findIndex((x) => x && !x.sold);
      const t = !empty ? 'shopDone' : i >= 0 ? 'shopBuy' : 'shopRefresh';
      const r = room._handleAction(seat, { baseRevision: 0, action: Object.assign({ t, shop: v.shop.shop, seq: v.shop.seq }, t === 'shopBuy' ? { i } : {}) });
      if (!r.ok) throw new Error('fixture S01 failed: ' + r.reason);
    }
  }
  const pos = H.makeSetup().pos;
  for (const s of [0, 1]) room.handleCommand(s, { t: 'setup', roster: S0(room).roster[s].slice(), pos });
  room.handleCommand(0, { t: 'ready' }); room.handleCommand(1, { t: 'ready' });
  if (room.state !== STATES.IN_PROGRESS) throw new Error('fixture eco room did not start: ' + JSON.stringify(room.lastFault));
  return room;
}
function reconnect(room, seat) {
  room.socketClosed(seat);
  const r = room.resumeSeat(seat, room.seats[seat].credential.current, fakeWs());
  if (!r.ok) throw new Error('fixture resume failed: ' + r.reason);
}
const HIDDEN_KEYS = new Set(['id', 'r', 'c', 'owner', 'alive', 'immobile', 'swapMark']);

// ===== 1. 보드 — 공개 상대 전설 vs 미공개 상대 전설 (양 좌석 · 재연결) =====
[0, 1].forEach((seat) => {
  const room = startedEco(2920 + seat);
  const T0 = room.engines[0], foe = 1 - seat;
  const vis = S0(room).pieces.filter((p) => p.owner === foe && p.type === 'minion' && p.alive && T0.visibleTo(seat, p));
  ok(vis.length >= 2, '전제: 좌석 ' + seat + ' 에게 보이는 상대 하수인 2개 이상');
  const [qa, qb] = vis;
  both(room, (E) => {
    [[qa, 'L-DRAGON', true], [qb, 'L-WITCH', false]].forEach(([q, key, rev]) => {
      const p = E.S.pieces.find((x) => x.id === q.id), u = E.ecoMakeUnit(E.S, key);
      Object.assign(p, { legend: u.legend, rosterId: u.rosterId || null, name: u.name, revealed: rev });
    });
  });
  const check = (label) => {
    const v = room.toSeatView(seat);
    const ua = v.units.find((u) => u.id === room._alias(qa.id)), ub = v.units.find((u) => u.id === room._alias(qb.id));
    ok(ua && ua.rosterId === 'L-DRAGON' && !('legend' in ua) && !('grade' in ua), label + ' 공개 상대 전설 rosterId=L-DRAGON: ' + JSON.stringify(ua));
    ok(ub && Object.keys(ub).every((k) => HIDDEN_KEYS.has(k)), label + ' 미공개 상대 전설은 위치·생존만: ' + JSON.stringify(ub));
    const raw = JSON.stringify(v);
    ok(!raw.includes('L-WITCH') && !raw.includes('"legend"'), label + ' 좌석 프레임 어디에도 미공개 전설 종 키·원시 legend 없음');
    const own = room.toSeatView(foe).you.pieces.find((p) => p.id === room._alias(qb.id));
    ok(own && own.rosterId === 'L-WITCH', label + ' 소유자에게는 자기 전설 종 키 그대로');
  };
  check('좌석 ' + seat);
  reconnect(room, seat);
  check('좌석 ' + seat + ' 재연결 뒤');
  room._clearClock();
});

// ===== 2. 전투 — 경제 가방 말(구매·포획 모양 모두 ecoMakeUnit) 대리 출전 artRosterId (양 좌석 · 재연결) =====
{
  const probe = startedEco(2930);
  const owned = new Set(S0(probe).pieces.map((p) => p.rosterId).filter(Boolean));
  const free = probe.engines[0].ROSTER.map((r) => r.id).filter((id) => !owned.has(id));
  probe._clearClock();
  [free[0], 'L-REAPER'].forEach((key) => {
    const room = startedEco(2930); // 같은 시드 — free 종이 필드와 겹치지 않는다
    const cur = S0(room).current, foe = 1 - cur;
    const other = free[1]; // 출전하지 않는 가방 말 — 상대에게 새면 안 된다
    both(room, (E) => { E.S.eco.bag[cur].push(E.ecoMakeUnit(E.S, key, 2), E.ecoMakeUnit(E.S, other, 3)); });
    const ally = S0(room).pieces.find((p) => p.owner === cur && p.type === 'ally' && p.alive);
    const tgt = S0(room).pieces.find((p) => p.owner === foe && p.type === 'minion' && p.alive && p.placed);
    H.openBattle(room, { att: ally.id, def: tgt.id });
    for (let n = 0; n < 6 && !S0(room).battle; n++) {
      const pm = room._pendingModal();
      if (!pm) break;
      H.act(room, pm.owner, { t: 'modal', seq: pm.seq, i: pm.count > 1 ? 1 : 0 }); // 가방 첫 말(key) 대리 출전
    }
    const B = S0(room).battle;
    ok(B && B.fa !== B.attP && room.engines[0].ecoKey(B.fa) === key, '전제 ' + key + ': 가방 말이 대리 출전해 전투가 열렸다');
    const check = (label) => {
      for (const seat of [cur, foe]) {
        const v = room.toSeatView(seat), a = v.battle && v.battle.a;
        ok(a && a.bodyFight === false && a.type === 'ally' && a.artRosterId === key && a.rosterId === null,
          label + ' 좌석 ' + seat + (seat === cur ? '(소유자)' : '(상대)') + ' battle.a artRosterId=' + (a && a.artRosterId));
        ok(a && !('legend' in a) && !('grade' in a) && !('cap' in a) && !('uid' in a), label + ' 좌석 ' + seat + ' 원시 legend·grade·cap·uid 없음');
        const bs = v.fx.events.find((e) => e.key === 'battleStart');
        ok(bs && bs.scene.a.artRosterId === key && bs.scene.a.rosterId === null, label + ' 좌석 ' + seat + ' battleStart scene.a 같은 값: ' + JSON.stringify(bs && bs.scene.a));
      }
      const fv = JSON.stringify(room.toSeatView(foe));
      ok(!fv.includes('"' + other + '"'), label + ' 상대 프레임에 출전하지 않은 가방 말 종 키 없음');
    };
    check('가방 ' + key);
    reconnect(room, foe); reconnect(room, cur);
    check('가방 ' + key + ' 재연결 뒤');
    room._clearClock();
  });
}

process.exit(done());
