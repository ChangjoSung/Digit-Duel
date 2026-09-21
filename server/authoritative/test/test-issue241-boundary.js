'use strict';
// #241 (CJ 승인 2026-09-17 스킬 정리 — 최종 구현 기획서 1·2장 R1·R2·V1·Q3) 서버 경계 검사. Mars 보고서 9장 S1~S8 을 고정한다.
//   1) 요약 키: 서버 V2_TIMED_KEYS 가 엔진 V2_TIMED 와 순서까지 같다(S1). 엔진에서 삭제된 필드는 요약 코드에도 없다(S2·S3).
//   2) 요약 분기 감지: 해일 표식(tideMark·tideBy·tideHeld) · Q3 cdUpFresh · 회피율 감소(evadeDown·evadeDownR) · 번개 꼬리
//      추가 공격 상태(B.bonus 의 side·stage·allowed·saved·tailSlot)가 한 좌석만 갈리면 요약도 갈린다(S2·S4).
//   3) 합법성: 번개 꼬리 추가 공격 중에는 허용 슬롯(기본기·2·3차)만 — 도망·볼·아이템·패키지·패스·턴 종료 거부(S5·S6, L5·L17).
//   4) 좌석 프레임(GDD-23 7.9): 해일 표식 X·보류와 회피율 감소는 양쪽 공개, 추가 공격 side 는 양쪽·allowed 는 소유자만,
//      ⌛ 사본(saved)·tailSlot·cdUpFresh·tideBy 는 어느 좌석에도 없다(S7·S8).
const fs = require('fs');
const path = require('path');
const { withEngine } = require('../engine');
const H = require('./helpers');
const { both, byId, snap, act, lockstepDigest } = H;
const { ok, done } = H.makeCounter('issue241-boundary');

function battleRoom(seed) {
  const room = H.startedRoom(seed);
  const T = room.engine;
  const cur = T.S.current;
  H.openBattle(room); // #245 인접 전제를 실제로 만든 뒤 합법 경로로 연다(helpers.openBattle)
  if (room._pendingModal()) throw new Error('fixture: minion battle did not open directly');
  return { room, T, cur };
}
function diverges(room, fn, undo) {
  withEngine(room.engines[1], () => fn(room.engines[1]));
  const split = lockstepDigest(room.engines[0]) !== lockstepDigest(room.engines[1]);
  withEngine(room.engines[1], () => undo(room.engines[1]));
  const back = lockstepDigest(room.engines[0]) === lockstepDigest(room.engines[1]);
  return split && back;
}
// 스킬 fx 로 (종 id, 칸) 을 찾는다 — 스킬 id 를 하드코딩하지 않는다.
function speciesWith(T, fx) {
  for (const r of T.ROSTER) {
    const sk = T.speciesSkills(r.id, 4);
    const i = sk ? sk.findIndex((id) => T.SKILLS[id] && T.SKILLS[id].fx === fx) : -1;
    if (i >= 0) return { rosterId: r.id, skills: sk.slice(), idx: i };
  }
  return null;
}
// 이번 전투 행동 차례의 전투원에게 종 스킬 4칸을 장착한다. 상대는 버티게(HP 9999)·회피 0 으로 둔다.
function equipActor(room, sp) {
  const T = room.engine;
  const side = T.actorOfPhase();
  const key = side === 'A' ? 'fa' : 'fd', okey = side === 'A' ? 'fd' : 'fa';
  const seat = side === 'A' ? T.S.battle.attP.owner : T.S.battle.defP.owner;
  both(room, (E) => {
    const B = E.S.battle, f = B[key], o = B[okey];
    f.skills = sp.skills.slice(); f.cds = f.skills.map(() => 0);
    o.maxHp = 9999; o.hp = 9999; o.dodge = 0; o.evadeBuff = 0; o.dodgeForce = false; o.shield = 0; o.shieldLayers = [];
    // #245 행동 메뉴 재렌더가 필요 없다 — 전투 명령의 슬롯 합법성은 Core 가 상태에서 직접 본다
  });
  return { side, key, okey, seat };
}

// ===== 1) 요약 키 — 서버 사본과 엔진 원본 대조, 삭제 필드 잔존 금지 =====
{
  const T = H.startedRoom(2410).engine;
  const html = T.html;
  const engTimed = JSON.parse((/const\s+V2_TIMED\s*=\s*(\[[^\]]*\])/.exec(html) || [])[1].replace(/\s+/g, ''));
  const roomSrc = fs.readFileSync(path.join(__dirname, '..', 'room.js'), 'utf8');
  const srvTimed = JSON.parse((/const\s+V2_TIMED_KEYS\s*=\s*Object\.freeze\((\[[^\]]*\])\)/.exec(roomSrc) || [])[1].replace(/\s+/g, '').replace(/'/g, '"'));
  ok(JSON.stringify(srvTimed) === JSON.stringify(engTimed), 'S1 서버 V2_TIMED_KEYS = 엔진 V2_TIMED (순서 포함): ' + JSON.stringify([srvTimed, engTimed]));
  ok(engTimed.includes('evadeDownR') && !engTimed.includes('spdDownR'), '전제: 엔진 지속 키가 spdDownR → evadeDownR (V1)');
  const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const digestCode = code(lockstepDigest.toString());
  const removed = ['spdDown', 'spdDownR', 'mirrorR', 'burrowR', 'fortressR', 'counterRound', 'burnBonus', 'nextDmgUp', 'nextFlat',
    'nextShockForce', 'sandWind', 'sporePending', 'permShockR', 'permShockBy', 'atStart'];
  const resetSrc = (/function\s+resetV2\(f\)\{([\s\S]*?)\n\}/.exec(html) || [])[1] || '';
  const stale = removed.filter((k) => new RegExp('\\b' + k + '\\b').test(digestCode) || new RegExp('\\b' + k + '\\b').test(srvTimed.join(' ')));
  const engStale = removed.filter((k) => new RegExp('\\bf\\.' + k + '\\s*=').test(resetSrc) || engTimed.includes(k));
  ok(engStale.length === 0, '전제: 엔진 resetV2·V2_TIMED 에 삭제 필드 없음: ' + JSON.stringify(engStale));
  ok(stale.length === 0, 'S2·S3 요약 코드(주석 제외)에 삭제 필드 없음: ' + JSON.stringify(stale));
  for (const k of ['tideMark', 'tideBy', 'tideHeld', 'cdUpFresh', 'evadeDown', 'bonus']) {
    ok(new RegExp('\\b' + k + '\\b').test(digestCode), `요약 코드가 ${k} 를 읽음`);
  }
}

// ===== 2) 요약 분기 감지 =====
{
  const { room } = battleRoom(2411);
  for (const side of ['fa', 'fd']) {
    ok(diverges(room, (E) => { E.S.battle[side].tideMark = 36; }, (E) => { E.S.battle[side].tideMark = 0; }), `${side}.tideMark 0 vs 36`);
    both(room, (E) => { E.S.battle[side].tideMark = 36; });
    ok(diverges(room, (E) => { E.S.battle[side].tideMark = 37; }, (E) => { E.S.battle[side].tideMark = 36; }), `${side}.tideMark X 36 vs 37`);
    ok(diverges(room, (E) => { E.S.battle[side].tideBy = side === 'fa' ? 'D' : 'A'; }, (E) => { E.S.battle[side].tideBy = null; }), `${side}.tideBy 분기`);
    ok(diverges(room, (E) => { E.S.battle[side].tideHeld = true; }, (E) => { E.S.battle[side].tideHeld = false; }), `${side}.tideHeld 보류 분기`);
    both(room, (E) => { E.S.battle[side].tideMark = 0; });
    ok(diverges(room, (E) => { E.S.battle[side].cdUpFresh = []; E.S.battle[side].cdUpFresh[2] = true; }, (E) => { E.S.battle[side].cdUpFresh = []; }),
      `${side}.cdUpFresh 슬롯2 Fresh 분기 (Q3)`);
    ok(diverges(room, (E) => { E.S.battle[side].cdUpFresh = [true]; }, (E) => { E.S.battle[side].cdUpFresh = []; }) , `${side}.cdUpFresh 슬롯0 분기`);
    both(room, (E) => { E.S.battle[side].evadeDown = 0.10; E.S.battle[side].evadeDownR = 2; });
    ok(diverges(room, (E) => { E.S.battle[side].evadeDown = 0.20; }, (E) => { E.S.battle[side].evadeDown = 0.10; }), `${side}.evadeDown −10%p vs −20%p`);
    ok(diverges(room, (E) => { E.S.battle[side].evadeDownR = 1; }, (E) => { E.S.battle[side].evadeDownR = 2; }), `${side}.evadeDownR 2R vs 1R`);
    ok(diverges(room, (E) => { E.S.battle[side].evadeDownRFresh = true; }, (E) => { E.S.battle[side].evadeDownRFresh = false; }), `${side}.evadeDownRFresh 게이트`);
    both(room, (E) => { E.S.battle[side].evadeDown = 0; E.S.battle[side].evadeDownR = 0; });
    // 엔진에서 사라진 키는 요약이 읽지 않는다 — 이름 교체가 실제로 됐는지(옛 키만 바꿔서는 요약이 갈리지 않는다)
    withEngine(room.engines[1], () => { room.engines[1].S.battle[side].spdDown = 5; room.engines[1].S.battle[side].spdDownR = 2; });
    ok(lockstepDigest(room.engines[0]) === lockstepDigest(room.engines[1]), `${side} 폐지 키 spdDown/spdDownR 는 요약에 없음`);
    withEngine(room.engines[1], () => { delete room.engines[1].S.battle[side].spdDown; delete room.engines[1].S.battle[side].spdDownR; });
  }
  const bonus = (o) => Object.assign({ side: 'A', tailSlot: 3, saved: { 1: 2, 2: 0 }, allowed: [0, 1, 2], stage: 'active' }, o);
  ok(diverges(room, (E) => { E.S.battle.bonus = bonus({}); }, (E) => { E.S.battle.bonus = null; }), 'B.bonus 없음 vs 추가 공격 단계');
  both(room, (E) => { E.S.battle.bonus = bonus({}); });
  const cases = [['stage pending vs active', { stage: 'pending' }], ['side A vs D', { side: 'D' }], ['allowed [0,1,2] vs [0,1]', { allowed: [0, 1] }],
    ['saved ⌛ 사본 2 vs 3', { saved: { 1: 3, 2: 0 } }], ['saved 칸 집합', { saved: { 1: 2 } }], ['tailSlot 3 vs 1', { tailSlot: 1 }]];
  for (const [label, o] of cases) {
    ok(diverges(room, (E) => { E.S.battle.bonus = bonus(o); }, (E) => { E.S.battle.bonus = bonus({}); }), 'B.bonus ' + label);
  }
  both(room, (E) => { E.S.battle.bonus = null; });
}

// ===== 3) 합법성 — 번개 꼬리 추가 공격 단계 (실제 명령 경로) =====
{
  const { room, T } = battleRoom(2412);
  const sp = speciesWith(T, 'lightningTail');
  ok(!!sp, '전제: 번개 꼬리 보유 종: ' + JSON.stringify(sp && [sp.rosterId, sp.idx]));
  if (sp) {
    const { side, key, seat } = equipActor(room, sp);
    // 2·3차 ⌛ 를 실제 값으로 걸어 두어 사본·복원을 본다(tail 자신의 칸은 제외)
    const pre = {};
    both(room, (E) => { const f = E.S.battle[key]; for (const i of [1, 2]) if (i !== sp.idx) { f.cds[i] = 2; pre[i] = 2; } });
    const r0 = act(room, seat, { t: 'act', k: sp.idx });
    const B = T.S.battle;
    ok(r0.ok && !r0.noop && !!B && room.state !== H.STATES.VOID, '번개 꼬리 사용 수락: ' + JSON.stringify([r0.reason, room.state]));
    ok(!!B && !!B.bonus && B.bonus.stage === 'active' && B.bonus.side === side && T.actorOfPhase() === side,
      '추가 공격 단계 진입 — 같은 행동자: ' + JSON.stringify(B && B.bonus));
    ok(room.engines.every((E) => E.S.battle && E.S.battle.bonus && E.S.battle.bonus.stage === 'active'), '두 좌석 엔진 모두 추가 공격 단계');
    if (B && B.bonus && B.bonus.stage === 'active') {
      const allowed = B.bonus.allowed.slice();
      ok(JSON.stringify(allowed) === JSON.stringify([0, 1, 2].filter((i) => i !== sp.idx)), '허용 슬롯 = 기본기·2·3차(번개 꼬리 제외): ' + JSON.stringify(allowed));
      // 금지 어휘가 **평소에는 합법인** 조건을 만들어 둔다(대조로 확인) — 그래야 거부가 추가 공격 단계 때문임이 드러난다.
      both(room, (E) => {
        const Bx = E.S.battle;
        E.S.inv[seat] = ['potion']; Bx.itemRoundA = false; Bx.itemRoundD = false;
        E.S.pkgs[seat] = Object.assign({}, E.S.pkgs[seat], { itemGift: 1 });
        Bx[key].fleeLock = false;
      });
      const forbidden = [{ t: 'item', i: 0 }, { t: 'flee' }, { t: 'pkgOpen', kind: 'itemGift' }, { t: 'ball' }, { t: 'pass' }, { t: 'endTurn' }, { t: 'skipMain' }];
      const E0 = room.engines[0];
      for (const a of [{ t: 'item', i: 0 }, { t: 'flee' }, { t: 'pkgOpen', kind: 'itemGift' }]) {
        const keep = E0.S.battle.bonus; E0.S.battle.bonus = null;
        const ctl = room._authorize(seat, H.withFrame(room, a)); // #245 _authorize 직접 호출은 겨냥 프레임(bf)을 스스로 붙인다
        E0.S.battle.bonus = keep;
        ok(ctl.ok === true, `대조: 추가 공격 단계가 아니면 ${a.t} 합법`);
      }
      for (const a of forbidden) {
        const before = snap(room);
        const res = act(room, seat, a);
        ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, `추가 공격 중 ${a.t} 거부·불변: ` + JSON.stringify(res.reason));
      }
      // 허용 밖 칸 — ⌛0 으로 만들어도(쿨이 아니라 단계 규칙으로) 거부. 번개 꼬리 자신의 칸과 legacy 'basic'/'skill'/'common' 매핑 대조.
      both(room, (E) => { E.S.battle[key].cds[sp.idx] = 0; });
      let before = snap(room);
      let res = act(room, seat, { t: 'act', k: sp.idx });
      ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, '추가 공격 중 허용 밖 칸(번개 꼬리, ⌛0) 거부·불변');
      if (sp.skills.length > 3 && !allowed.includes(3)) {
        both(room, (E) => { E.S.battle[key].cds[3] = 0; });
        before = snap(room);
        res = act(room, seat, { t: 'act', k: 3 });
        ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, '추가 공격 중 4번째 칸 거부·불변');
      }
      ok(room.engines.every((E) => allowed.every((i) => E.S.battle[key].cds[i] === 0)), '추가 공격 중 허용 칸 ⌛0 (두 좌석)');
      // 좌석 프레임 (4) 도 여기서 본다 — 실제 추가 공격 단계
      const owner = room.toSeatView(seat).battle, other = room.toSeatView(1 - seat).battle;
      ok(owner.bonus && owner.bonus.side === side && JSON.stringify(owner.bonus.allowed) === JSON.stringify(allowed)
        && Object.keys(owner.bonus).sort().join() === 'allowed,side', '소유자 프레임 bonus = {side, allowed}: ' + JSON.stringify(owner.bonus));
      ok(other.bonus && other.bonus.side === side && Object.keys(other.bonus).join() === 'side', '상대 프레임 bonus = {side} (allowed 는 칸 수 = 등급을 드러냄): ' + JSON.stringify(other.bonus));
      for (const s of [seat, 1 - seat]) {
        const raw = JSON.stringify(room.toSeatView(s));
        ok(!/"saved":|"tailSlot":|"cdUpFresh":|"tideBy":|"stage":/.test(raw), `좌석${s} 프레임에 saved·tailSlot·cdUpFresh·tideBy·stage 키 없음`);
      }
      // 허용 칸(기본기)로 추가 공격 → 단계 종료 · 2·3차 ⌛ 사본 복원 · 차례 진행
      const slot = allowed.find((i) => T.slotUsable(T.S.battle[key], i, side));
      res = act(room, seat, { t: 'act', k: slot });
      const B2 = T.S.battle;
      ok(res.ok && !res.noop && room.state !== H.STATES.VOID, `추가 공격(칸 ${slot}) 수락: ` + JSON.stringify([res.reason, room.state]));
      ok(!B2 || (!B2.bonus && T.actorOfPhase() !== side) || (!B2.bonus && B2.round > 1), '추가 공격 뒤 단계 종료·차례 진행');
      if (B2) {
        const f = B2[key];
        ok(Object.keys(pre).every((i) => f.cds[i] >= Math.max(0, pre[i] - 1) && f.cds[i] > 0), '2·3차 ⌛ 사본 복원(라운드 종료 감소 1 허용): ' + JSON.stringify([pre, f.cds]));
        ok(!room.toSeatView(0).battle.bonus && !room.toSeatView(1).battle.bonus, '단계 종료 뒤 두 좌석 프레임 bonus=null');
      }
      ok(room.engines[0].S.battle === null || lockstepDigest(room.engines[0]) === lockstepDigest(room.engines[1]), '추가 공격 전 과정 두 좌석 요약 일치');
    }
  }
}

// ===== 4) 좌석 프레임 — 해일 표식 X·보류, 회피율 감소 (양쪽 공개) =====
{
  const { room, T } = battleRoom(2413);
  const sp = speciesWith(T, 'tsunami');
  ok(!!sp, '전제: 해일 예고 보유 종: ' + JSON.stringify(sp && [sp.rosterId, sp.idx]));
  if (sp) {
    const { okey, seat } = equipActor(room, sp);
    const res = act(room, seat, { t: 'act', k: sp.idx });
    const o = T.S.battle && T.S.battle[okey];
    ok(res.ok && !res.noop && !!o && o.tideMark > 0 && room.state !== H.STATES.VOID, '해일 예고 사용 → 대상 표식 X 확정: ' + JSON.stringify([res.reason, o && o.tideMark]));
    ok(room.engines.every((E) => E.S.battle && E.S.battle[okey].tideMark === (o && o.tideMark)), '두 좌석 엔진 표식 X 일치');
    if (o && o.tideMark > 0) {
      const sk = okey === 'fa' ? 'a' : 'd';
      for (const s of [0, 1]) {
        const b = room.toSeatView(s).battle;
        ok(b[sk].tideMark === o.tideMark && b[sk].tideHeld === false, `좌석${s}: 대상 전투원 tideMark=${o.tideMark}·tideHeld=false 공개 (시전자·대상 양쪽)`);
      }
      both(room, (E) => { E.S.battle[okey].tideHeld = true; });
      ok([0, 1].every((s) => room.toSeatView(s).battle[sk].tideHeld === true), '보류 상태 양쪽 공개');
    }
  }
  // 회피율 감소 — 값·지속 모두 양쪽 공개, 옛 키 없음
  both(room, (E) => { if (E.S.battle) { E.S.battle.fa.evadeDown = 0.15; E.S.battle.fa.evadeDownR = 2; } });
  if (T.S.battle) {
    for (const s of [0, 1]) {
      const b = room.toSeatView(s).battle;
      ok(b.a.evadeDown === 0.15 && b.a.evadeDownR === 2 && b.d.evadeDown === 0 && b.d.evadeDownR === 0, `좌석${s}: evadeDown/evadeDownR 두 전투원 모두 전송(💨 아이콘)`);
      ok(!/"spdDown/.test(JSON.stringify(room.toSeatView(s))), `좌석${s} 프레임에 spdDown 계열 키 없음`);
    }
  }
}

process.exitCode = done() > 0 ? 1 : 0;
