'use strict';
// #234 (GDD-23 6장 로스터·스킬 개편) 서버 경계 검사 — Jupiter 명세 2장 4번의 네 경계를 고정한다.
//   1) 락스텝 요약 분기 감지: 새 전투 상태가 한 좌석에서만 갈리면 lockstepDigest 도 반드시 갈린다.
//      필드 목록은 서버 사본이 아니라 demo/index.html 의 V2_TIMED·V2_TIMED_MAG·resetV2 본문에서 읽는다 — 엔진이 필드를
//      늘렸는데 요약이 따라가지 않으면(드리프트) 여기서 실패한다.
//   2) 좌석 프레임: 상대의 미공개 스킬 칸 수(= 등급, 7.9)와 종류가 나가지 않는다. 미공개 상대 왕·동료의 element 와
//      새 말 필드(allyKind·leaderElChosen·legend)가 상대 프레임에 없다.
//   3) 합법성: 뿌리 고정(fleeLock) 도망 거부, 탐색 recruit 기술 교체 단계 거부(CJ 결정 2026-09-17).
//   4) REVISE 2차 사신의 낫(CJ 결정 2026-09-17): reaperSeal 요약 분기·소유자 전용 프레임·4R/봉인/수면 포자 합법성.
//   5) REVISE 4차 전투 순서(CJ 결정 2026-09-17): B.firstSideR1 요약 분기·좌석 프레임 비노출·R2 기준 교대와 actor+phase 복원 정합.
const { withEngine } = require('../engine');
const H = require('./helpers');
const { both, byId, snap, act, lockstepDigest } = H;
const { ok, done } = H.makeCounter('issue234-boundary');

function minionPair(T, cur) {
  return {
    att: T.S.pieces.find((p) => p.owner === cur && p.type === 'minion' && p.alive).id,
    def: T.S.pieces.find((p) => p.owner === 1 - cur && p.type === 'minion' && p.alive).id,
  };
}
function battleRoom(seed) {
  const room = H.startedRoom(seed);
  const T = room.engine;
  const cur = T.S.current;
  const ids = minionPair(T, cur);
  both(room, (E) => { E.initBattle(byId(E, ids.att), byId(E, ids.def)); });
  if (!T.S.battle || room._pendingModal()) throw new Error('fixture: minion battle did not open directly');
  return { room, T, cur, ids };
}
// 좌석1 엔진에서만 fn 을 적용하고 두 요약이 갈리는지 본 뒤, undo 로 되돌려 다시 같아지는지 확인한다.
function diverges(room, fn, undo) {
  withEngine(room.engines[1], () => fn(room.engines[1]));
  const split = lockstepDigest(room.engines[0]) !== lockstepDigest(room.engines[1]);
  withEngine(room.engines[1], () => undo(room.engines[1]));
  const back = lockstepDigest(room.engines[0]) === lockstepDigest(room.engines[1]);
  return split && back;
}

// ===== 1) 요약 분기 감지 — 엔진 원본에서 읽은 새 전투 상태 필드 전부 =====
{
  const { room, T } = battleRoom(2341);
  const html = T.html;
  const timed = JSON.parse((/const\s+V2_TIMED\s*=\s*(\[[^\]]*\])/.exec(html) || [])[1].replace(/\s+/g, ''));
  const magSrc = (/const\s+V2_TIMED_MAG\s*=\s*\{([\s\S]*?)\};/.exec(html) || [])[1] || '';
  const mag = [...magSrc.matchAll(/"(\w+)"/g)].map((m) => m[1]);
  const resetSrc = (/function\s+resetV2\(f\)\{([\s\S]*?)\n\}/.exec(html) || [])[1] || '';
  const reset = [...resetSrc.matchAll(/\bf\.(\w+)\s*=/g)].map((m) => m[1]).filter((k) => k !== 'cds');
  // #241 (CJ 승인 2026-09-17) V2_TIMED 19 → 16: spdDownR→evadeDownR 교체 · mirrorR(R3 거울 수면)·burrowR·fortressR(단순화) 삭제.
  // resetV2 는 삭제 9 · 추가 4(tideMark·tideBy·tideHeld·cdUpFresh)로 25. 필드 전수 분기 감지는 아래에서 그대로 본다.
  ok(timed.length >= 16 && mag.length >= 8 && reset.length >= 25,
    '엔진 원본에서 V2_TIMED·V2_TIMED_MAG·resetV2 필드 목록을 읽음: ' + JSON.stringify([timed.length, mag.length, reset.length]));
  const fields = [...new Set([...timed, ...timed.map((k) => k + 'Fresh'), ...mag, ...reset])];
  const missed = [];
  for (const side of ['fa', 'fd']) {
    for (const k of fields) {
      let saved;
      const split = diverges(room, (E) => {
        const f = E.S.battle[side];
        saved = f[k];
        if (typeof saved === 'boolean') f[k] = !saved;
        else if (typeof saved === 'number') f[k] = saved + 1;
        else if (saved && typeof saved === 'object') f[k] = Object.assign({}, saved, { 'X-ONCE': true });
        else f[k] = saved === 0 ? 1 : 0; // null 소유자(mossBy·breedBy·permShockBy) → 좌석 번호
      }, (E) => { E.S.battle[side][k] = saved; });
      if (!split) missed.push(side + '.' + k);
    }
  }
  ok(missed.length === 0, '새 전투 상태 한 좌석 분기 → 요약 분기 (' + fields.length + '필드 × 2전투원): 놓친 필드 ' + JSON.stringify(missed));

  // 개별 모양 — 숫자 카운터로 바뀐 vanguardTurn(1R vs 2R), 소수 누계 mitigated, 한 행동 1회 게이트
  // (#241 R2: 해일 예고가 조건 표식으로 바뀌어 pendingFx.atStart 는 엔진에서 폐지 — 표식 분기는 test-issue241-boundary.js 가 본다)
  both(room, (E) => { E.S.battle.fa.vanguardTurn = 1; E.S.battle.fa.mitigated = 0.25; });
  ok(diverges(room, (E) => { E.S.battle.fa.vanguardTurn = 2; }, (E) => { E.S.battle.fa.vanguardTurn = 1; }), 'vanguardTurn 1R vs 2R (boolean 접기 금지)');
  ok(diverges(room, (E) => { E.S.battle.fa.mitigated = 0.5; }, (E) => { E.S.battle.fa.mitigated = 0.25; }), 'mitigated 소수 누계 0.25 vs 0.5');
  both(room, (E) => { E.S.battle.fd.pendingFx.push({ roundsLeft: 1, tag: 'fixture:delayed', run() {} }); });
  ok(diverges(room, (E) => { E.S.battle.fd.pendingFx[E.S.battle.fd.pendingFx.length - 1].roundsLeft = 2; },
    (E) => { E.S.battle.fd.pendingFx[E.S.battle.fd.pendingFx.length - 1].roundsLeft = 1; }), 'pendingFx 같은 tag 의 roundsLeft 차이 (#233 대기열 계약 유지)');
  for (const k of ['reflectSeq', 'counterSeq']) {
    ok(diverges(room, (E) => { E.S.battle[k] = 7; }, (E) => { delete E.S.battle[k]; }), '전투 객체 B.' + k + ' 분기');
  }
  const king = T.S.pieces.find((p) => p.type === 'king');
  const ally = T.S.pieces.find((p) => p.type === 'ally');
  ok(diverges(room, (E) => { byId(E, ally.id).allyKind = ally.allyKind === 'shield' ? 'assassin' : 'shield'; }, (E) => { byId(E, ally.id).allyKind = ally.allyKind; }), '말 allyKind 분기');
  ok(diverges(room, (E) => { byId(E, king.id).leaderElChosen = !king.leaderElChosen; }, (E) => { byId(E, king.id).leaderElChosen = king.leaderElChosen; }), '말 leaderElChosen 분기');
  const m = T.S.pieces.find((p) => p.type === 'minion' && !p.legend);
  ok(diverges(room, (E) => { byId(E, m.id).legend = 'X'; }, (E) => { byId(E, m.id).legend = m.legend; }), '말 legend 분기');
  // 한 좌석 분기가 실제 명령 경로에서 fail-closed VOID 로 이어지는지 (요약이 서버 판정에 쓰인다).
  // 행동으로 소모되지 않는 필드를 고른다 — 다음 피해 스킬 1회성(nextPowUp 등)은 피해 스킬 사용 시 양쪽 모두 0 으로 돌아가
  // (demo/index.html execV2) 정당하게 다시 수렴한다(1회차 실행에서 확인한 검사 설계 오류).
  withEngine(room.engines[1], () => { byId(room.engines[1], king.id).leaderElChosen = !king.leaderElChosen; });
  const side = T.actorOfPhase();
  const f = side === 'A' ? T.S.battle.fa : T.S.battle.fd;
  const seat = side === 'A' ? T.S.battle.attP.owner : T.S.battle.defP.owner;
  const slot = f.skills.findIndex((_, i) => T.slotUsable(f, i, side));
  const res = act(room, seat, { t: 'act', k: slot });
  ok(!res.ok && res.reason === 'E_INTERNAL' && room.state === H.STATES.VOID, '새 말 필드(leaderElChosen) 한 좌석 분기 → 다음 행동에서 VOID: ' + JSON.stringify([res.reason, room.state]));
}

// ===== 2) 좌석 프레임 — 미공개 스킬 칸 수·종류 비노출 (7.9) =====
{
  const { room, T, cur, ids } = battleRoom(2342);
  const rd = T.ROSTER.find((r) => T.speciesSkills(r.id, 4) && T.speciesSkills(r.id, 4).length === 4);
  const setDef = (grade, revealed) => both(room, (E) => {
    const fd = E.S.battle.fd;
    fd.skills = E.speciesSkills(rd.id, grade).slice(); fd.cds = fd.skills.map(() => 0); fd.revealedSkills = revealed.slice();
  });
  const oppSkills = () => room.toSeatView(cur).battle.d.skills;
  setDef(1, []); const g1 = JSON.stringify(oppSkills());
  setDef(4, []); const g4 = JSON.stringify(oppSkills());
  ok(g1 === g4 && g4 === JSON.stringify([{ revealed: false }]), '상대 ⭐1 과 ⭐4(미공개) 프레임이 같고 자리표시 하나뿐: ' + g1 + ' / ' + g4);
  setDef(4, [2]);
  const s42 = oppSkills();
  ok(s42.length === 2 && s42[0].revealed === true && s42[0].i === 2 && s42[0].id === T.speciesSkills(rd.id, 4)[2]
    && JSON.stringify(s42[1]) === '{"revealed":false}', '상대 ⭐4 슬롯2 공개: 공개 칸 하나 + 개수 없는 자리표시: ' + JSON.stringify(s42));
  setDef(4, [0, 1, 2, 3]);
  ok(oppSkills().length === 4 && oppSkills().every((s) => s.revealed === true), '전부 공개되면 자리표시 없이 공개 칸만');
  setDef(4, [1]);
  const bv = room.toSeatView(cur).battle;
  ok(!/"kind"/.test(JSON.stringify([bv.a.skills, bv.d.skills])), '상대 좌석 전투 뷰의 스킬 배열에 kind 없음');
  const own = room.toSeatView(1 - cur).battle.d.skills;
  ok(own.length === 4 && own.every((s) => s.revealed === true && typeof s.id === 'string'), '소유자 뷰는 4칸 전부(등급 A)');
  void ids;
}

// ===== 2b) 미공개 상대 왕·동료 element · 새 말 필드 비노출 =====
{
  const room = H.startedRoom(2343);
  const T = room.engine;
  const leaders = T.S.pieces.filter((p) => p.type === 'king' || p.type === 'ally');
  ok(leaders.length === 6 && leaders.every((p) => typeof p.element === 'string'), '픽스처: 왕·동료 6기 모두 속성 보유(GDD-23 2.2 기본값)');
  for (const seat of [0, 1]) {
    // 상대 왕·동료를 전부 보이게(인접·공개 여부와 무관하게 등급 B 경로를 밟도록) 미공개로 둔다
    both(room, (E) => { for (const p of E.S.pieces) if (p.owner !== seat && (p.type === 'king' || p.type === 'ally')) p.revealed = false; });
    const v = room.toSeatView(seat);
    const raw = JSON.stringify(v);
    ok(!/"allyKind"|"leaderElChosen"|"legend"/.test(raw), `좌석${seat} 프레임 어디에도 allyKind·leaderElChosen·legend 없음`);
    const oppLeaderAliases = new Set(leaders.filter((p) => p.owner !== seat).map((p) => room._aliasByPid.get(p.id)).filter(Boolean));
    const recs = v.units.filter((u) => oppLeaderAliases.has(u.id));
    ok(recs.every((u) => Object.keys(u).every((k) => ['id', 'r', 'c', 'owner', 'alive', 'immobile'].includes(k))),
      `좌석${seat}: 미공개 상대 왕·동료 레코드는 위치·생존만(element 없음): ` + JSON.stringify(recs));
  }
  // 공개(참전)된 상대 왕은 element 를 받는다 — 2.2 "전투에 참전해 공개될 때 상대도 알게 됩니다"
  const oppKing = T.S.pieces.find((p) => p.owner === 1 && p.type === 'king');
  both(room, (E) => { byId(E, oppKing.id).revealed = true; });
  const vk = room.toSeatView(0).units.find((u) => u.id === room._aliasByPid.get(oppKing.id));
  ok(!vk || vk.element === oppKing.element, '공개된 상대 왕은 element 공개(2.2 참전 공개): ' + JSON.stringify(vk));
}

// ===== 3a) 합법성 — 뿌리 고정 도망 거부 =====
{
  const { room, T } = battleRoom(2344);
  const side = T.actorOfPhase();
  const seat = side === 'A' ? T.S.battle.attP.owner : T.S.battle.defP.owner;
  const key = side === 'A' ? 'fa' : 'fd';
  both(room, (E) => { E.S.battle[key].fleeLock = true; });
  const before = snap(room);
  const res = act(room, seat, { t: 'flee' });
  ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, 'fleeLock 전투원의 도망 거부·불변: ' + JSON.stringify(res));
  both(room, (E) => { E.S.battle[key].fleeLock = false; });
  const res2 = act(room, seat, { t: 'flee' });
  ok(res2.ok && !res2.noop, '대조: fleeLock 이 없으면 도망 수락: ' + JSON.stringify(res2.reason));
}

// ===== 3b) 합법성 — 탐색 recruit 기술 교체 거부 (CJ 결정 2026-09-17) =====
{
  const room = H.startedRoom(2345);
  const T = room.engine;
  const cur = T.S.current;
  ok(T.V2_INTERP && T.V2_INTERP.recruitSkillSwap === false, '전제: 엔진 V2_INTERP.recruitSkillSwap=false');
  const pid = T.S.pieces.find((p) => p.owner === cur && p.type === 'minion' && p.alive && p.placed).id;
  const openRecruit = (stage) => both(room, (E) => {
    E.S.recruit = { owner: cur, pieceId: pid, species: E.ROSTER[0].id, stage, skill: stage === 'target' || stage === 'slot' ? E.NEW_SKILLS[0] : null,
      targetId: stage === 'slot' ? pid : null, recvId: null, token: 1 };
    E.recruitModal();
  });
  openRecruit('root');
  let pm = room._pendingModal();
  ok(!!pm && pm.owner === cur && pm.disabled[0] === true && /기술 교체/.test(pm.buttons[0].text), '루트 화면의 기술 교체 버튼은 비활성: ' + JSON.stringify(pm && pm.buttons));
  let before = snap(room);
  let res = act(room, cur, { t: 'modal', seq: pm.seq, i: 0 });
  ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, '비활성 기술 교체 버튼 응답 거부·불변');
  // 어떤 경로로든 기술 교체 단계가 열려 있으면 그 화면 응답 전체를 거부한다
  for (const stage of ['skill', 'target', 'slot']) {
    openRecruit(stage);
    pm = room._pendingModal();
    ok(!!pm && pm.disabled.some((d) => !d), `픽스처: 기술 교체 ${stage} 단계 모달에 활성 버튼 존재`);
    if (!pm) continue;
    for (let i = 0; i < pm.count; i++) {
      if (pm.disabled[i]) continue;
      before = snap(room);
      res = act(room, cur, { t: 'modal', seq: pm.seq, i });
      ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, `기술 교체 ${stage} 단계 버튼 ${i} 거부·불변: ` + JSON.stringify(res));
    }
  }
  // 대조: 루트로 돌아오면 포기는 수락된다
  openRecruit('root');
  pm = room._pendingModal();
  const give = pm ? pm.buttons.findIndex((b) => b.text === '포기') : -1;
  res = give >= 0 ? act(room, cur, { t: 'modal', seq: pm.seq, i: give }) : { ok: false };
  ok(res.ok && !res.noop, '대조: 루트 화면 포기는 수락: ' + JSON.stringify(res.reason));
}

// ===== 4) REVISE 2차 (CJ 결정 2026-09-17) 사신의 낫 — reaperSeal 요약·좌석 프레임·합법성 =====
// 결정: 절대 판정 즉사 · 4라운드부터 · 전투를 넘는 봉인(말 단위 reaperSeal 0/1/2, 전투 종료 초기화 밖).
{
  const { room, T, cur, ids } = battleRoom(2346);
  // 4a) 요약 분기 — 전투원(fa/fd)·전투 밖 말·포획(cap)·예비(reserve) 네 위치 모두
  for (const side of ['fa', 'fd']) {
    ok(diverges(room, (E) => { E.S.battle[side].reaperSeal = 1; }, (E) => { delete E.S.battle[side].reaperSeal; }),
      `전투원 ${side}.reaperSeal 한 좌석 분기 → 요약 분기`);
  }
  const idle = T.S.pieces.find((p) => p.alive && p.id !== ids.att && p.id !== ids.def);
  for (const v of [1, 2]) {
    ok(diverges(room, (E) => { byId(E, idle.id).reaperSeal = v; }, (E) => { delete byId(E, idle.id).reaperSeal; }),
      `전투 밖 말 reaperSeal=${v} 한 좌석 분기 → 요약 분기`);
  }
  both(room, (E) => { byId(E, idle.id).reaperSeal = 1; });
  ok(diverges(room, (E) => { byId(E, idle.id).reaperSeal = 2; }, (E) => { byId(E, idle.id).reaperSeal = 1; }),
    '전투 밖 말 reaperSeal 1 vs 2 (접기 금지)');
  both(room, (E) => { delete byId(E, idle.id).reaperSeal; });
  const leader = T.S.pieces.find((p) => p.alive && (p.type === 'king' || p.type === 'ally') && p.id !== ids.att && p.id !== ids.def);
  both(room, (E) => { byId(E, leader.id).cap = { element: 'fire', hp: 50, maxHp: 50 }; });
  ok(diverges(room, (E) => { byId(E, leader.id).cap.reaperSeal = 1; }, (E) => { delete byId(E, leader.id).cap.reaperSeal; }),
    '포획 하수인(cap) reaperSeal 한 좌석 분기 → 요약 분기');
  both(room, (E) => { byId(E, leader.id).cap = null; E.S.reserve[0] = { element: 'water', hp: 40, maxHp: 40 }; });
  ok(diverges(room, (E) => { E.S.reserve[0].reaperSeal = 1; }, (E) => { delete E.S.reserve[0].reaperSeal; }),
    '예비 하수인 reaperSeal 한 좌석 분기 → 요약 분기');
  both(room, (E) => { E.S.reserve[0] = null; });

  // 4b) 좌석 프레임 — 소유자 좌석에만. 상대가 공개된 말이거나 지금 싸우는 상대 전투원이어도 키 자체가 없다.
  both(room, (E) => {
    for (const p of E.S.pieces) { p.reaperSeal = 1; p.revealed = true; }
    E.S.battle.fa.reaperSeal = 1; E.S.battle.fd.reaperSeal = 2;
  });
  for (const seat of [0, 1]) {
    const v = room.toSeatView(seat);
    const oppRaw = JSON.stringify([v.units, v.battle[T.S.battle.attP.owner === seat ? 'd' : 'a']]);
    ok(!/reaperSeal/.test(oppRaw), `좌석${seat}: 상대 말(공개 포함)·상대 전투원 뷰에 reaperSeal 없음`);
    // 본체 출전 전투원은 말 객체 자체라 fd 쪽 말은 2 가 된다 — 엔진 말 값과 그대로 대조한다.
    const want = T.S.pieces.filter((p) => p.owner === seat && p.alive && p.placed).map((p) => p.reaperSeal).sort();
    const got = v.you.pieces.map((u) => u.reaperSeal).sort();
    ok(want.length > 0 && want.every((x) => x >= 1) && JSON.stringify(got) === JSON.stringify(want),
      `좌석${seat}: 자기 말 reaperSeal 이 엔진 값 그대로 포함(재연결 복원): ` + JSON.stringify(got));
    const ownSide = v.battle[T.S.battle.attP.owner === seat ? 'a' : 'd'];
    const wantF = T.S.battle.attP.owner === seat ? 1 : 2;
    ok(ownSide.reaperSeal === wantF, `좌석${seat}: 자기 전투원 뷰 reaperSeal=${wantF}: ` + ownSide.reaperSeal);
  }
  both(room, (E) => { E.S.reserve[cur] = { element: 'water', hp: 40, maxHp: 40, reaperSeal: 2 }; });
  ok(room.toSeatView(cur).you.reserve.reaperSeal === 2 && !/reaperSeal/.test(JSON.stringify(room.toSeatView(1 - cur).units)),
    '예비 하수인 reaperSeal 은 소유자 you.reserve 에만');
}

// ===== 4c) 합법성 — 서버 _legalAct 가 T.slotUsable→reaperWhy 를 그대로 쓴다 (4R · 봉인 · 수면 포자 무시) =====
function reaperRoom(seed, setup) {
  const { room, T } = battleRoom(seed);
  const side = T.actorOfPhase();
  const key = side === 'A' ? 'fa' : 'fd';
  const seat = side === 'A' ? T.S.battle.attP.owner : T.S.battle.defP.owner;
  both(room, (E) => {
    const B = E.S.battle, f = B[key];
    f.skills = f.skills.slice(); f.cds = f.skills.map(() => 0);
    f.skills[1] = 'L-REAPER-4';
    f.hp = 1; // 내 HP 비율 strict 열세
    B.round = 4;
    setup(E, f, B);
  });
  return { room, T, seat, key };
}
{
  ok(H.startedRoom(2350).engine.BAL.reaperRound === 4, '전제: 엔진 BAL.reaperRound=4 (CJ 결정 2026-09-17, 종전 6)');
  const cases = [
    ['3라운드 불법', (E, f, B) => { B.round = 3; }, false],
    ['봉인 1(지난 전투 사용) 불법', (E, f) => { f.reaperSeal = 1; }, false],
    ['봉인 2(이번 전투 사용) 불법', (E, f) => { f.reaperSeal = 2; }, false],
  ];
  let seed = 2347;
  for (const [label, setup] of cases) {
    const { room, seat } = reaperRoom(seed++, setup);
    const before = snap(room);
    const res = act(room, seat, { t: 'act', k: 1 });
    ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, `사신의 낫 ${label}·불변: ` + JSON.stringify(res.reason));
  }
  for (const [label, setup] of [['4라운드 합법', () => {}], ['수면 포자 상태에서도 합법', (E, f) => { f.sleepNext = true; }]]) {
    const { room, T, seat, key } = reaperRoom(seed++, setup);
    const opp = key === 'fa' ? T.S.battle.defP : T.S.battle.attP;
    const res = act(room, seat, { t: 'act', k: 1 });
    ok(res.ok && !res.noop && !opp.alive && room.state !== H.STATES.VOID, `사신의 낫 ${label} → 즉사: ` + JSON.stringify([res.reason, opp.alive, room.state]));
  }
  // 대조: 수면 포자는 다른 비기본 스킬은 계속 막는다(예외는 사신의 낫만)
  const { room, T, seat, key } = reaperRoom(seed++, (E, f) => { f.sleepNext = true; });
  const f = T.S.battle[key];
  const other = f.skills.findIndex((sid, i) => i !== 1 && T.SKILLS[sid] && T.SKILLS[sid].v2 && T.SKILLS[sid].kind !== 'basic');
  if (other >= 0) {
    const before = snap(room);
    const res = act(room, seat, { t: 'act', k: other });
    ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, '대조: 수면 포자 상태 다른 비기본 스킬 거부');
  } else ok(true, '대조 생략: 픽스처에 다른 v2 비기본 스킬 칸 없음(' + JSON.stringify(f.skills) + ')');
}

// ===== 5) REVISE 4차 (CJ 결정 2026-09-17 "속도는 첫 라운드 선턴 판별만, 나머지는 기존 전투 방식대로") =====
//   B.firstSideR1 — 2라운드부터 교대 기준. 요약 분기 감지·좌석 프레임 비노출·서버 행위자(actor+phase) 복원 정합.
{
  const { room, T } = battleRoom(2360);
  ok(typeof T.decideFirstSide === 'function', '전제: 엔진이 decideFirstSide 를 노출');
  const B0 = T.S.battle;
  ok((B0.firstSideR1 === 'A' || B0.firstSideR1 === 'D') && B0.firstSideR1 === B0.firstSide,
    'initBattle 이 1라운드 선턴을 B.firstSideR1 로 기록: ' + JSON.stringify([B0.firstSideR1, B0.firstSide]));
  const flip = (s) => (s === 'A' ? 'D' : 'A');

  // 5a) 요약 분기 — R1 한 좌석만 firstSideR1 이 갈려도 요약이 갈린다.
  let saved;
  ok(diverges(room, (E) => { saved = E.S.battle.firstSideR1; E.S.battle.firstSideR1 = flip(saved); },
    (E) => { E.S.battle.firstSideR1 = saved; }), '락스텝 감지: B.firstSideR1 한 좌석 분기(R1)');
  // 5a') 위험 구간 재현 — R2 진입 직전, firstSide·round·순서 효과가 양쪽에서 같고 firstSideR1 만 다르다.
  //      엔진 판정 결과가 실제로 갈리는 상태이며(아래 전제), 요약이 그것을 잡아야 한다.
  both(room, (E) => { const B = E.S.battle; B.round = 2; B.fa.shock = 0; B.fd.shock = 0; B.fa.vanguardTurn = 0; B.fd.vanguardTurn = 0; });
  let seat0Decision;
  withEngine(room.engines[0], () => { seat0Decision = room.engines[0].decideFirstSide(room.engines[0].S.battle); });
  ok(diverges(room, (E) => {
    saved = E.S.battle.firstSideR1; E.S.battle.firstSideR1 = flip(saved);
    ok(seat0Decision !== E.decideFirstSide(E.S.battle), '전제: firstSideR1 차이만으로 R2 선턴 판정이 갈림');
  }, (E) => { E.S.battle.firstSideR1 = saved; }), '락스텝 감지: R2 진입 직전 firstSideR1 만 다른 두 좌석');

  // 5b) 좌석 프레임 — firstSideR1 은 요약 전용. 1라운드 행위자(actor)로 이미 공개된 1비트라 새 정보는 아니지만,
  //     표시·복원 경로(netSynthBattle)가 쓰지 않으므로 싣지 않는다(좌석 프레임 추가 0 원칙).
  for (const seat of [0, 1]) {
    const raw = JSON.stringify(room.toSeatView(seat));
    ok(raw.indexOf('"firstSideR1"') === -1 && raw.indexOf('"firstSide"') === -1, `좌석${seat} 프레임에 firstSideR1·firstSide 없음`);
  }
}
{
  // 5c) 실제 명령 경로 — D 가 훨씬 빠르면 R1 은 D 선턴, R2 는 속도와 무관하게 A 선턴(순서 효과 없음).
  //     서버가 내려보내는 actor+phase 로 공개 방 클라이언트가 복원하는 firstSide 가 엔진 값과 같아야 한다.
  const { room, T } = battleRoom(2361);
  both(room, (E) => {
    const B = E.S.battle;
    for (const f of [B.fa, B.fd]) { f.maxHp = 9999; f.hp = 9999; f.shock = 0; f.vanguardTurn = 0; }
    B.fa.spd = 1; B.fd.spd = 99;
    B.firstSide = E.decideFirstSide(B); B.firstSideR1 = B.firstSide;
    E.battleModal(); // 선턴을 바꿨으면 행동 메뉴를 새 행위자로 다시 그린다(test-authority-rules P0-1c 선례) — 없으면 act 가 noop
  });
  ok(T.S.battle.firstSideR1 === 'D', '전제: R1 선턴은 빠른 D: ' + T.S.battle.firstSideR1);
  const restored = (seat) => { const b = room.toSeatView(seat).battle; return b.phase === 0 ? b.actor : flip(b.actor); };
  const actOnce = () => {
    const B = T.S.battle, side = T.actorOfPhase();
    const f = side === 'A' ? B.fa : B.fd;
    const seat = side === 'A' ? B.attP.owner : B.defP.owner;
    const k = f.skills.findIndex((_, i) => T.slotUsable(f, i, side));
    return act(room, seat, { t: 'act', k });
  };
  const flip = (s) => (s === 'A' ? 'D' : 'A');
  ok([0, 1].every((s) => restored(s) === 'D'), 'R1 phase0: 두 좌석 actor 복원 = D');
  const r1 = [actOnce(), actOnce()];
  const B = T.S.battle;
  ok(r1.every((r) => r.ok && !r.noop) && !!B && B.round === 2 && room.state !== H.STATES.VOID, 'R1 두 행동 수락 → R2 진입: ' + JSON.stringify([r1.map((r) => r.reason), B && B.round, room.state]));
  if (B && B.round === 2) {
    const cat = (f) => (f.shock ? 2 : (f.vanguardTurn ? 0 : 1));
    const ca = cat(B.fa), cd = cat(B.fd);
    const want = ca !== cd ? (ca < cd ? 'A' : 'D') : 'A'; // 순서 효과가 같으면 기준 교대: 짝수 라운드 = R1 반대 측(A)
    ok(B.fd.spd > B.fa.spd && room.engines.every((E) => E.S.battle.firstSide === want),
      `R2 선턴 = ${want} (분류 ${ca}/${cd}; 속도 99 인 D 도 기준 교대로 후순) — 두 좌석 엔진 일치`);
    ok([0, 1].every((s) => restored(s) === want), 'R2 phase0: 공개 방 actor+phase 복원 = 엔진 firstSide');
    const r2 = actOnce();
    ok(r2.ok && !r2.noop && T.S.battle && T.S.battle.phase === 1 && [0, 1].every((s) => restored(s) === want),
      'R2 phase1: actor 가 뒤집혀도 복원 firstSide 불변 = ' + want);
    ok(lockstepDigest(room.engines[0]) === lockstepDigest(room.engines[1]), 'R2 진행 후 두 좌석 요약 일치(firstSideR1 포함)');
  }
}

process.exitCode = done() > 0 ? 1 : 0;
