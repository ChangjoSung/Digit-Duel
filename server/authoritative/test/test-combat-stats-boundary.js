'use strict';
// #233 (GDD-23 3·4장) 전투 스탯 직렬화·락스텝 경계 회귀.
//
// 무엇을 고정하나 — 딱 두 가지다.
//   (1) **정보 경계**: 새 8스탯·지속 상태가 어느 뷰에 실리고 어느 뷰에 실리지 않는지. 자기 좌석(등급 A)은 받고,
//       공개된 상대 보드 말(등급 C-2)은 받지 않으며, 진행 중 전투 문맥(§2.6.2)은 화면이 실제로 그리는 것만 받는다.
//   (2) **락스텝 감지력**: 좌석별 엔진 하나의 새 규칙 필드가 어긋나면 lockstepDigest가 반드시 달라진다.
//       #233의 resolveHit는 한 타격에 rand()를 최대 3회(① 회피·③ 분산·⑦ 치명) 쓰므로, 두 엔진의 난수 소비가
//       한 번만 어긋나도 이후 경기가 갈린다 — 요약이 그 상태를 덮지 못하면 fail-closed VOID가 발동하지 못한다.
//
// 규칙 계산 자체(피해 파이프라인·상성·행동 순서)는 이 스위트의 범위가 아니다. 그것은 demo/ 헤드리스 회귀가 맡는다.
const H = require('./helpers');
const { both, byId, lockstepDigest, startedRoom } = H;
const { ok, done } = H.makeCounter('combat-stats-boundary');

// netStubStats(demo/index.html)가 `typeof u.def==="number"` 하나로 분기해 함께 읽는 묶음. 부분 전송은 계약 위반이다.
const STAT_BUNDLE = ['def', 'spd', 'dodge', 'crit', 'statusPct'];
// 어떤 상대 뷰에도 실리면 안 되는 것 — 등급(7.9 소유자 전용) + 표시 소비자가 없는 내부 상태.
const NEVER_TO_OPPONENT = STAT_BUNDLE.concat(['grade', 'shieldStartPct', 'shieldLayers', 'evadeBuff', 'dmgUpBuff',
  'crack', 'harden', 'hardenPct', 'absorbed', 'pendingFx']);
// 전투 문맥에 실리면 안 되는 것 — 화면이 그리지 않거나(§2.6.2 최소 공개) 기술 은닉을 역산하게 해 주는 값.
// #233 최종 엔진분 추가: 지속 카운터(…R)·1회용 게이트(…Fresh)·확정 효과(critForce·dodgeForce)·순서 효과
// (vanguardTurn)는 모두 stIcons(demo/index.html) 목록에 없다. 공개 방 클라이언트는 피해를 계산하지 않으므로
// (서버 권위) 표시에도 계산에도 쓰이지 않는다 — 엔진에 필드가 늘었다는 이유만으로 공개 범위를 넓히지 않는다.
const NEVER_IN_BATTLE = STAT_BUNDLE.concat(['grade', 'shieldStartPct', 'shieldLayers', 'evadeBuff', 'dmgUpBuff',
// (shockFresh 는 예외 — #233 이전부터 전투 뷰에 실렸고 netSynthFighter 가 읽는다. 종전 계약 그대로 둔다.)
  'absorbed', 'pendingFx', 'stats', 'evadeBuffR', 'dmgUpBuffR', 'crackFresh', 'hardenFresh',
  'evadeBuffRFresh', 'dmgUpBuffRFresh', 'critForce', 'dodgeForce', 'vanguardTurn', 'burnFresh']);

function ownOf(view, pred) { return view.you.pieces.filter(pred); }

// ===== 1) 자기 좌석(등급 A) — 8스탯 묶음과 새 지속 상태가 통째로 온다 =====
{
  const room = startedRoom('r-233-own');
  const v = room.toSeatView(0);

  const mine = view => ownOf(view, () => true);
  ok(mine(v).length > 0, '자기 말 뷰가 비어 있지 않다');

  for (const p of mine(v)) {
    if (p.type === 'bomb' || p.type === 'trap') continue; // 전투원이 아니다 — mkPiece가 0으로 채운다
    const label = `자기 ${p.type}`;
    ok(typeof p.def === 'number', label + ' def 전송');
    // 묶음 원자성 — def만 오고 나머지가 빠지면 클라이언트가 조용히 0으로 덮는다.
    for (const k of STAT_BUNDLE) ok(typeof p[k] === 'number', `${label} 스탯 묶음 ${k} 함께 전송`);
    ok('grade' in p, label + ' grade 키 존재(⭐1이 null로 덮이지 않게)');
    for (const k of ['crack', 'harden', 'hardenPct', 'evadeBuff', 'dmgUpBuff']) {
      ok(typeof p[k] === 'number', `${label} 새 지속 상태 ${k} 전송`);
    }
    ok(!('shieldStartPct' in p), label + ' shieldStartPct는 보내지 않는다(소비자 없음)');
    ok(!('shieldLayers' in p), label + ' shieldLayers는 보내지 않는다(합계 shield만 표시)');
  }

  // 3.5 — 하수인은 ⭐ 등급을 갖고, 왕·동료는 등급이 없다(null).
  const minion = mine(v).find((p) => p.type === 'minion');
  const king = mine(v).find((p) => p.type === 'king');
  ok(minion && minion.grade === 1, '자기 하수인 grade=1 (3.4 ⭐1 — null로 덮이지 않았다)');
  ok(king && king.grade === null, '자기 왕 grade=null (3.5 등급 없음)');

  /* 이 패치가 실제로 고치는 버그 — 엔진은 동료의 암살자/방패병 구분을 mkPiece(allyIdx)에서만 쓰고 말에 남기지
     않는다. 그래서 클라이언트 폴백은 자기 동료 둘을 모두 암살자로 본다. 서버가 주입된 값 자체를 보내므로
     두 동료의 스탯이 서로 달라야 하고, 방패병은 3.5의 제 블록(def 20·spd 6)을 되찾아야 한다. */
  const allies = mine(v).filter((p) => p.type === 'ally');
  ok(allies.length === 2, '자기 동료 2명');
  if (allies.length === 2) {
    ok(allies[0].def !== allies[1].def, '동료 둘의 def가 서로 다르다(암살자/방패병 구분이 살아 있다)');
    const assassin = allies.find((a) => a.def === 5), shield = allies.find((a) => a.def === 20);
    ok(!!assassin && assassin.spd === 12 && assassin.dodge === 0.10 && assassin.crit === 0.10, '동료(암살자) = def5·spd12·회피10%·치명10% (3.5)');
    ok(!!shield && shield.spd === 6 && shield.dodge === 0 && shield.crit === 0, '동료(방패병) = def20·spd6·회피0·치명0 (3.5) — 암살자 폴백이 아니다');
  }
  ok(king && king.def === 10 && king.spd === 8 && king.atk === 16, '왕 = def10·spd8·공격16 (3.5)');
}

// ===== 2) 상대 보드 뷰(등급 B·C-2) — 새 스탯은 경계를 넘지 않는다 =====
{
  const room = startedRoom('r-233-opp');
  const T = room.engine;
  // 공개된 상대(C-2)를 하나 만든다. 좌석 0 시점에서 상대 말 하나를 revealed로 세운다.
  const oppId = T.S.pieces.find((p) => p.owner === 1 && p.type === 'minion' && p.placed).id;
  both(room, (E) => { byId(E, oppId).revealed = true; });
  const v = room.toSeatView(0);

  const known = v.units.filter((u) => u.type !== undefined && u.type !== null);
  const unknown = v.units.filter((u) => u.type === undefined || u.type === null);
  ok(known.length > 0, '공개된 상대 말이 뷰에 있다(C-2 픽스처 성립)');

  for (const u of v.units) {
    for (const k of NEVER_TO_OPPONENT) {
      ok(!(k in u), `상대 보드 말에 ${k} 미전송 (등급 ${u.type ? 'C-2' : 'B'})`);
    }
  }
  ok(unknown.every((u) => !('hp' in u) && !('element' in u)), '미공개 상대(등급 B)는 종전대로 위치·생존만');
  // 공개 하수인은 rosterId를 받으므로 클라이언트가 ARCHETYPE_BASE에서 같은 값을 스스로 유도한다 — 그래서
  // 서버가 스탯을 보내지 않아도 정보량 손실이 없다(보류 판단의 전제).
  ok(known.every((u) => u.type !== 'minion' || typeof u.rosterId === 'string'),
    '공개 상대 하수인은 rosterId를 받는다(클라이언트가 스탯을 유도할 근거)');
}

// ===== 3) 전투 문맥(§2.6.2) — 화면이 그리는 것만, 그리지 않는 것은 하나도 =====
{
  const room = startedRoom('r-233-battle');
  const T = room.engine;
  const cur = T.S.current, other = 1 - cur;
  const att = T.S.pieces.find((p) => p.owner === cur && p.type === 'minion' && p.alive).id;
  const def = T.S.pieces.find((p) => p.owner === other && p.type === 'minion' && p.alive).id;
  both(room, (E) => { E.initBattle(byId(E, att), byId(E, def)); });

  // 균열·경화를 실제 값으로 걸어 둔다(#234 전까지 이를 거는 기술이 없어 라이브로는 0이지만, 계약은 값이 있을 때
  // 그 값이 그대로 양쪽 화면에 도달하는지로 판정해야 한다 — stIcons가 hardenPct를 숫자로 찍는다).
  both(room, (E) => { E.S.battle.fa.crack = 2; E.S.battle.fd.harden = 3; E.S.battle.fd.hardenPct = 0.25; });

  for (const seat of [0, 1]) {
    const b = room.toSeatView(seat).battle;
    ok(!!b, `좌석 ${seat} 전투 뷰 존재`);
    for (const sideKey of ['a', 'd']) {
      const s = b[sideKey];
      const label = `좌석 ${seat} battle.${sideKey}`;
      for (const k of ['crack', 'harden', 'hardenPct']) ok(typeof s[k] === 'number', `${label} ${k} 전송(stIcons가 그린다)`);
      for (const k of NEVER_IN_BATTLE) ok(!(k in s), `${label} ${k} 미전송`);
    }
    // 뷰어와 무관하게 양쪽 전투원의 값이 그대로 온다 — 원본 stIcons가 두 패널을 마스킹 없이 그리는 것과 같다.
    ok(b.a.crack === 2, `좌석 ${seat} 공격 측 균열 2R이 양쪽 화면에 도달`);
    ok(b.d.harden === 3 && b.d.hardenPct === 0.25, `좌석 ${seat} 방어 측 경화 25%·3R이 양쪽 화면에 도달`);
  }

  // 방어막은 종전대로 합계 하나만 — 층 배열(획득원 태그가 아키타입·미사용 기술을 역산하게 해 준다)은 나가지 않는다.
  both(room, (E) => { E.shieldAdd(E.S.battle.fd, 12, 'guardStart'); E.shieldAdd(E.S.battle.fd, 7, 'sup_shield'); });
  const bv = room.toSeatView(0).battle;
  ok(bv.d.shield === 19, '방어막은 층 합계 하나로만 전송(12+7=19)');
  ok(JSON.stringify(bv).indexOf('guardStart') === -1, '층 획득원 태그가 전투 프레임 어디에도 없다');

  /* #233 (GDD-23 4.4) 선턴 — 프레임에 B.firstSide 를 **새로 싣지 않는다.** 클라이언트가 행위자를 알아야 하는
     것은 맞지만, 서버는 이미 battle.actor(= actorOfPhase())를 공개로 내려보내고 있고 firstSide 는 actor 와
     phase 로 완전히 유도되는 중복 1비트다(phase 0 이면 firstSide === actor, phase 1 이면 그 반대).
     firstSide 를 굳힌 **입력**(상대 spd·grade·순서 효과)은 GDD-23 7.9 가 소유자 전용으로 못박은 값이라
     전투 뷰로 열 수 없다 — 그래서 결과값 actor 만 공개하는 종전 경계가 유지되는지 여기서 고정한다. */
  for (const seat of [0, 1]) {
    const b = room.toSeatView(seat).battle;
    ok(!('firstSide' in b), `좌석 ${seat} battle 프레임에 firstSide 미전송(actor 로 유도되는 중복 값)`);
    ok(b.actor === 'A' || b.actor === 'D', `좌석 ${seat} battle.actor 가 공개 행위자 원본으로 온다`);
  }
}

// ===== 4) 락스텝 감지력 — 새 규칙 필드가 어긋나면 요약이 반드시 달라진다 =====
{
  const room = startedRoom('r-233-digest');
  const T = room.engine;
  const cur = T.S.current, other = 1 - cur;
  const att = T.S.pieces.find((p) => p.owner === cur && p.type === 'minion' && p.alive).id;
  const def = T.S.pieces.find((p) => p.owner === other && p.type === 'minion' && p.alive).id;
  both(room, (E) => { E.initBattle(byId(E, att), byId(E, def)); });

  const base = lockstepDigest(room.engines[0]);
  ok(base === lockstepDigest(room.engines[1]), '두 좌석 엔진이 같은 상태에서 같은 요약을 낸다');

  // 한쪽 엔진만 어긋뜨렸다 되돌린다 — 되돌린 뒤 요약이 base로 복귀해야 검사 자체가 신뢰할 수 있다.
  const detects = (label, mutate, restore) => {
    const E = room.engines[0];
    mutate(E);
    ok(lockstepDigest(E) !== base, `락스텝 감지: ${label}`);
    restore(E);
    ok(lockstepDigest(E) === base, `되돌리면 요약 복귀: ${label}`);
  };
  const fa = () => room.engines[0].S.battle.fa;

  for (const k of ['crack', 'harden', 'hardenPct', 'evadeBuff', 'dmgUpBuff', 'absorbed']) {
    detects(`전투원 ${k}`, (E) => { E.S.battle.fa[k] = (E.S.battle.fa[k] || 0) + 1; },
      (E) => { E.S.battle.fa[k] = (E.S.battle.fa[k] || 1) - 1; });
  }
  for (const k of STAT_BUNDLE.concat(['grade'])) {
    detects(`전투원 8스탯 ${k}`, (E) => { const f = E.S.battle.fa; f['__old_' + k] = f[k]; f[k] = 999; },
      (E) => { const f = E.S.battle.fa; f[k] = f['__old_' + k]; delete f['__old_' + k]; });
  }

  // 방어막 층 — 합계가 같아도 **경계와 순서**가 다르면 다음 타격의 깨짐 수·잔량이 달라진다(3.2 LIFO).
  detects('방어막 층 존재', (E) => { E.shieldAdd(E.S.battle.fa, 10, 'x'); },
    (E) => { E.S.battle.fa.shieldLayers = []; E.S.battle.fa.shield = 0; });
  {
    const E = room.engines[0], f = E.S.battle.fa;
    f.shieldLayers = [{ amt: 4, src: 'a' }, { amt: 6, src: 'b' }]; f.shield = 10;
    const split = lockstepDigest(E);
    f.shieldLayers = [{ amt: 6, src: 'b' }, { amt: 4, src: 'a' }];
    ok(lockstepDigest(E) !== split, '락스텝 감지: 같은 합계의 방어막 층 순서 차이(3.2 LIFO)');
    f.shieldLayers = [{ amt: 10, src: 'a' }];
    ok(lockstepDigest(E) !== split, '락스텝 감지: 같은 합계의 방어막 층 경계 차이');
    f.shieldLayers = []; f.shield = 0;
    ok(lockstepDigest(E) === base, '방어막 층 정리 후 요약 복귀');
  }

  // 예고·지연 피해 대기열(4.3) — 콜백은 요약에 넣을 수 없으니 [남은 라운드, 안정 식별자]로 본다.
  detects('예고 피해 대기열', (E) => { E.scheduleDelayed(E.S.battle.fa, 2, () => {}); },
    (E) => { E.S.battle.fa.pendingFx = []; });
  {
    /* 같은 라운드 · 다른 예고 피해 — roundsLeft 만 보면 두 상태가 같게 읽힌다. 엔진이 항목에 안정 식별자를
       붙이면(tag) 요약이 그 차이를 잡아야 한다. 아직 엔진이 tag 를 붙이지 않으면 항목은 null 로 떨어져
       종전과 같은 감지력을 유지할 뿐 깨지지 않는다 — 그 **역호환**까지 여기서 함께 고정한다. */
    const E = room.engines[0], f = E.S.battle.fa;
    /* 실제 엔진 경로로 먼저 확인한다 — scheduleDelayed(f,delayRounds,run,tag) 가 tag 를 항목에 실어야
       요약이 구분할 수 있다. 합성 픽스처만 쓰면 엔진이 tag 를 버려도 검사가 통과한다. */
    E.scheduleDelayed(f, 2, () => {}, 'tide_warning');
    ok(f.pendingFx.length === 1 && f.pendingFx[0].tag === 'tide_warning',
      '엔진 scheduleDelayed 가 tag 를 항목에 싣는다(요약이 읽는 키와 일치)');
    const engineTagged = lockstepDigest(E);
    f.pendingFx = [];
    E.scheduleDelayed(f, 2, () => {});
    ok(f.pendingFx[0].tag === null, '엔진이 tag 미지정 시 null 로 채운다(서버 역호환 모양과 일치)');
    ok(lockstepDigest(E) !== engineTagged,
      '락스텝 감지(실제 엔진 경로): 같은 라운드 예약에서 tag 유무가 요약을 가른다');
    f.pendingFx = [];

    f.pendingFx = [{ roundsLeft: 2, run: () => {} }];
    const noTag = lockstepDigest(E);
    f.pendingFx = [{ roundsLeft: 2, tag: 'tide_warning', run: () => {} }];
    const tagA = lockstepDigest(E);
    ok(tagA !== noTag, '락스텝 감지: tag 없는 예고와 tag 붙은 예고를 구분한다(역호환 — 없으면 null)');
    f.pendingFx = [{ roundsLeft: 2, tag: 'volcano_blast', run: () => {} }];
    ok(lockstepDigest(E) !== tagA, '락스텝 감지: 같은 라운드에 예약된 서로 다른 예고 피해를 구분한다');
    ok(lockstepDigest(E).indexOf('function') === -1, '콜백(run)은 요약에 직렬화되지 않는다');
    f.pendingFx = [];
    ok(lockstepDigest(E) === base, '예고 대기열 정리 후 요약 복귀');
  }

  /* ===== #233 최종 엔진 상태 — 지속 카운터 · 1회용 게이트 · 확정 효과 · 순서 효과 ===== */

  /* 지속(R)은 세기와 별개 상태다 — 엔진은 R 이 0 이 될 때 비로소 세기를 0 으로 내린다(nextPhase).
     세기만 보면 "회피 +10% 가 1R 남음"과 "3R 남음"이 같게 읽혀 다음 라운드부터 갈라진다. */
  for (const k of ['evadeBuffR', 'dmgUpBuffR']) {
    detects(`지속 카운터 ${k}`, (E) => { E.S.battle.fa[k] = (E.S.battle.fa[k] || 0) + 2; },
      (E) => { E.S.battle.fa[k] = (E.S.battle.fa[k] || 2) - 2; });
  }

  /* 1회용 게이트(GDD-23 5.6 "부여된 라운드는 세지 않는다") — 잔여 라운드가 같아도 게이트가 선 쪽과 아닌 쪽은
     다음 라운드 종료에서 값이 갈린다. shockFresh 는 #233 이전부터 있었지만 요약에는 없던 구멍이다. */
  for (const k of ['shockFresh', 'crackFresh', 'hardenFresh', 'evadeBuffRFresh', 'dmgUpBuffRFresh']) {
    detects(`지속 게이트 ${k}`, (E) => { E.S.battle.fa[k] = true; }, (E) => { E.S.battle.fa[k] = false; });
  }

  /* 화상 게이트 (GDD-23 4.7) — 위 넷과 **모양이 다르다.** 저쪽은 라운드 종료에 감소만 하므로 게이트가 어긋나면
     잔여 라운드가 갈리지만, 화상은 라운드 종료에 **피해도** 주므로 게이트가 어긋나면 **그 라운드에 HP 가 바로
     갈린다** — 요약에서 빠졌을 때 손해가 가장 큰 게이트다. 같은 잔여 라운드(burn 2R)에서 게이트만 다른 두
     상태가 반드시 다른 요약을 내야 한다. */
  {
    const E = room.engines[0], f = E.S.battle.fa;
    /* 실제 엔진이 이 필드를 **소유하는지** 먼저 확인한다. 요약이 읽는 이름과 엔진이 쓰는 이름이 갈리면
       `!!f.burnFresh`는 조용히 항상 false 가 되어 검사도 통과하고 감지력만 사라진다 — 합성 픽스처만으로는
       그 죽은 상태를 잡을 수 없다. resetBattleTemps 가 전투 개시 때 초기화하므로 키 존재로 계약을 고정한다. */
    ok('burnFresh' in f, '엔진이 burnFresh 를 전투원에 초기화한다(요약이 읽는 이름과 일치)');
    f.burn = 2;
    const burning = lockstepDigest(E);
    f.burnFresh = true;
    ok(lockstepDigest(E) !== burning,
      '락스텝 감지: 같은 화상 잔여(2R)에서 부여 라운드 게이트만 다른 상태 — 다음 라운드 종료의 피해 유무가 갈린다');
    f.burnFresh = false;
    ok(lockstepDigest(E) === burning, '되돌리면 요약 복귀: 화상 게이트');
    f.burn = 0;
    ok(lockstepDigest(E) === base, '화상 정리 후 요약 복귀');
  }

  /* 확정 효과 — 이 둘은 **난수 소비 자체를 바꾼다.** resolveHit 는 ① 회피와 ⑦ 치명에서 각각 rand() 를 쓰는데
     플래그가 서 있으면 그 판정을 건너뛰고 플래그를 소모한다. 한쪽 좌석에만 남아 있으면 그 타격에서 rand()
     호출 수가 어긋나 이후 모든 판정이 갈린다 — 요약에서 가장 빠뜨리면 안 되는 두 필드다. */
  for (const k of ['critForce', 'dodgeForce']) {
    detects(`확정 효과 ${k}(난수 정렬)`, (E) => { E.S.battle.fa[k] = true; }, (E) => { E.S.battle.fa[k] = false; });
  }

  // 순서 효과 — decideFirstSide 가 fighterOrderCat 으로 읽는다(#234 전까지 켜는 기술 없음, 계약만 존재).
  detects('순서 효과 vanguardTurn', (E) => { E.S.battle.fa.vanguardTurn = true; },
    (E) => { E.S.battle.fa.vanguardTurn = false; });

  /* B.firstSide (GDD-23 4.4) — 라운드 시작 시 한 번 굳는 **저장 상태**다. 종전 순서는 round·phase·shock 로
     매번 재계산되는 파생값이라 요약에 따로 넣을 게 없었다. 지금은 두 좌석이 서로 다른 선턴을 굳혀도 다른
     필드는 전부 같을 수 있고, 그러면 양쪽이 서로 다른 행위자에게 행동권을 준 채 요약만 일치한다. */
  {
    const E = room.engines[0], B = E.S.battle;
    const first0 = B.firstSide;
    ok(first0 === 'A' || first0 === 'D', 'initBattle 이 B.firstSide 를 굳혀 둔다(4.4 라운드 시작 시 확정)');
    B.firstSide = first0 === 'A' ? 'D' : 'A';
    ok(lockstepDigest(E) !== base, '락스텝 감지: 두 좌석이 서로 다른 선턴을 굳힌 상태');
    B.firstSide = first0;
    ok(lockstepDigest(E) === base, '되돌리면 요약 복귀: B.firstSide');
  }

  // 말 자체가 지니는 스탯(본체 출전이면 말 === 전투원)과 예비(포획) 하수인 승계분.
  // 원래 값을 먼저 잡아 둔다 — 본체 출전이라 byId(E,att) === fa() 이므로 어긋뜨린 뒤에는 읽어도 이미 오염돼 있다.
  const attDef0 = fa().def, attGrade0 = fa().grade;
  detects('말의 8스탯', (E) => { byId(E, att).def = 77; }, (E) => { byId(E, att).def = attDef0; });
  detects('말의 등급', (E) => { byId(E, att).grade = 4; }, (E) => { byId(E, att).grade = attGrade0; });
  {
    const E = room.engines[0];
    const reserve = { element: 'fire', hp: 50, def: 10, spd: 10, dodge: 0, crit: 0, statusPct: 0, grade: 1 };
    E.S.reserve[0] = reserve;
    const withReserve = lockstepDigest(E);
    reserve.def = 20;
    ok(lockstepDigest(E) !== withReserve, '락스텝 감지: 예비 하수인의 승계 스탯 차이');
    E.S.reserve[0] = null;
    ok(lockstepDigest(E) === base, '예비 정리 후 요약 복귀');
  }

  // 요약은 서버 안에서만 산다 — 어떤 좌석 프레임에도 그 모양이 실리지 않는다.
  const frame = JSON.stringify(room.toSeatView(0));
  ok(frame.indexOf('"stats"') === -1 && frame.indexOf('pendingFx') === -1 && frame.indexOf('shieldLayers') === -1,
    '락스텝 요약 전용 필드가 좌석 프레임에 없다');
  // #233 최종 엔진분 — 요약에 새로 넣은 필드도 같은 규칙을 탄다. 요약은 서버 안에서만 살고 어떤 좌석
  // 프레임에도 실리지 않는다(shockFresh 만 예외 — #233 이전부터 전투 뷰에 있던 공개 필드다).
  for (const k of ['"evadeBuffR"', '"dmgUpBuffR"', '"crackFresh"', '"hardenFresh"', '"evadeBuffRFresh"',
    '"dmgUpBuffRFresh"', '"critForce"', '"dodgeForce"', '"vanguardTurn"', '"firstSide"', '"burnFresh"']) {
    ok(frame.indexOf(k) === -1, `요약 전용 필드 ${k} 가 좌석 프레임에 없다`);
  }
}

done();
