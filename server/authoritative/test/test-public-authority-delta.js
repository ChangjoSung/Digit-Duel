'use strict';
// #217 Mars ctx_75a85d4c58fb 공개 뷰 델타 — data.turn(현재 행동자 좌석 전용 강제전투/텔레포트/접촉 상태),
// you.teleUsed(자기 텔레포트 사용 횟수), battle.battleId(전투 스냅샷에 직접 동봉된 fx battleId), fleePick.pieceId
// (소유자 전용 별칭 — 도망친 말 자체 강조 표시), FINISHED 종료 리빌(#11 — 경기 종료 후에는 visibleTo/revealed
// 마스킹 없이 살아있는 모든 상대 말의 위치·정체가 보인다). Mars가 msg_db7a8fa06aee로 battle.a/d의 cd/atk/
// skillAtk 추가 요청은 철회했다 — 왕/동료 본체는 skillAtk=0이라 cd가 무의미하고 atk/skillAtk도 자기 정보·
// 공개 ROSTER/BAL로 대부분 유도 가능해 필수가 아니라는 근거다. 기존 스위트(room·battle-fx·authority-rules)는
// 이 필드들을 검증하지 않으므로 이 파일이 전담한다 — 규칙/RNG/인가 자체는 다른 스위트가 이미 고정했다.
const H = require('./helpers');
const { both, byId, act, STATES } = H;
const { ok, done } = H.makeCounter('public-authority-delta');

function driveBattleToEnd(room, cap) {
  const T = room.engine;
  for (let i = 0; i < (cap || 60) && T.S.battle; i++) {
    const actor = T.netActor();
    const r = act(room, actor, { t: 'act', k: 0 });
    if (!r.ok) return r;
  }
  return { ok: true };
}

function main() {
  // ===== 1) 매치 시작 직후 — turn은 S.current 좌석에만, 기본값은 전부 빈 상태 =====
  {
    const room = H.startedRoom(9001);
    const cur = room.engine.S.current, other = 1 - cur;
    const va = room.toSeatView(cur), vo = room.toSeatView(other);
    ok(va.turn !== null && typeof va.turn === 'object', 'turn은 현재 행동자(S.current) 좌석에만 채워짐');
    ok(vo.turn === null, 'turn은 비행동자 좌석에는 null(원본 UI도 이 하이라이트를 S.current 화면에만 그린다)');
    ok(va.turn.teleport === null && va.turn.movedPiece === null && va.turn.forcedQueue === 0
      && Array.isArray(va.turn.forcedTargets) && va.turn.forcedTargets.length === 0
      && Array.isArray(va.turn.contactSet) && va.turn.contactSet.length === 0
      && va.turn.firstBattleWonByMover === false, '시작 직후 turn 기본값 전부 빈 상태: ' + JSON.stringify(va.turn));
    ok(va.you.teleUsed === 0 && vo.you.teleUsed === 0, 'teleUsed는 양 좌석 모두 시작값 0');
  }

  // ===== 2) 실제 강제 전투(다중 대상) 흐름 — doMove()가 만드는 진짜 applyForced() 다중분기, 서버 인가 경유 선택,
  //          그 결과로 열리는 실제 initBattle()의 battleId·fx 대응 =====
  let bId1;
  {
    const room = H.startedRoom(9002);
    const T = room.engine;
    const cur = T.S.current, other = 1 - cur;
    const mover = T.S.pieces.find((p) => p.owner === cur && p.alive && p.placed && p.type === 'minion');
    const enemies = T.S.pieces.filter((p) => p.owner === other && p.alive && p.placed && p.type === 'minion').slice(0, 2);
    ok(enemies.length === 2, '픽스처에 살아있는 상대 하수인 2기 이상 존재(전제)');
    const dest = { r: 7, c: 4 }, srcE1 = { r: 7, c: 5 }, srcE2 = { r: 6, c: 4 };
    both(room, (E) => {
      const m = byId(E, mover.id); m.r = 7; m.c = 1; // dest와 비인접(기존 인접 집합에서 제외)
      const e1 = byId(E, enemies[0].id); e1.r = srcE1.r; e1.c = srcE1.c;
      const e2 = byId(E, enemies[1].id); e2.r = srcE2.r; e2.c = srcE2.c;
    });
    both(room, (E) => { E.doMove(byId(E, mover.id), dest.r, dest.c); }); // 실제 엔진 doMove — applyForced()가 신규 인접 2개를 발견
    const e1Alias = room._alias(enemies[0].id), e2Alias = room._alias(enemies[1].id);
    const va = room.toSeatView(cur), vo = room.toSeatView(other);
    ok(va.turn.movedPiece === room._alias(mover.id), 'movedPiece 별칭이 실제 이동한 말과 일치');
    ok(va.turn.contactSet.length === 2 && va.turn.contactSet.includes(e1Alias) && va.turn.contactSet.includes(e2Alias),
      'contactSet은 이 좌석 뷰에 이미 있는(visibleTo) 신규 인접 적 2기의 별칭: ' + JSON.stringify(va.turn.contactSet));
    ok(va.turn.forcedTargets.length === 2 && va.turn.forcedTargets.includes(e1Alias) && va.turn.forcedTargets.includes(e2Alias),
      'forcedTargets는 실제 applyForced() 다중 후보 분기 결과: ' + JSON.stringify(va.turn.forcedTargets));
    ok(va.turn.forcedQueue === 0, '대기 큐는 아직 없음(개수만 노출)');
    ok(vo.turn === null, '비행동자 좌석은 강제 전투 대기 여부조차 turn으로 보지 않음');
    ok(va.battle === null, '다중 후보라 즉시 전투 개시되지 않고 선택 대기(원본 applyForced list.length>1 분기)');

    // 서버 공개 API(cell)로 실제 강제 대상 하나를 선택 — onCellCore의 forcedPickOk → initBattle 실행 경로
    const pick = act(room, cur, { t: 'cell', r: srcE1.r, c: srcE1.c });
    ok(pick.ok, '강제 대상 선택(cell) 수락: ' + JSON.stringify(pick.reason));
    const vb = room.toSeatView(cur), vbOther = room.toSeatView(other);
    ok(vb.battle && Number.isInteger(vb.battle.battleId), '실제 강제 전투 개시 — battle.battleId 정수로 존재');
    ok(vbOther.battle && vbOther.battle.battleId === vb.battle.battleId, '양 좌석이 같은 battleId를 봄');
    ok(!('cd' in vb.battle.a) && !('atk' in vb.battle.a) && !('skillAtk' in vb.battle.a)
      && !('cd' in vb.battle.d) && !('atk' in vb.battle.d) && !('skillAtk' in vb.battle.d),
      'cd/atk/skillAtk는 Mars 철회(msg_db7a8fa06aee)로 battle.a/d에 노출하지 않음');
    const startFx = vb.fx.events.find((e) => e.key === 'battleStart');
    ok(startFx && startFx.battleId === vb.battle.battleId, 'battle.battleId가 그 전투의 fx battleStart 이벤트 battleId와 일치(대응 관계)');
    bId1 = vb.battle.battleId;

    // ===== 4) 반환 뷰 변조 안전성 — 중첩 객체/배열을 바꿔도 엔진 내부 상태·다음 조회에 새지 않는다 =====
    const rawForcedBefore = T.S.forcedTargets.slice();
    const stale = room.toSeatView(cur);
    stale.turn.forcedTargets.push('u-injected');
    stale.turn.contactSet.length = 0;
    stale.turn.teleport = { stage: 99, piece: 'u-hacked' };
    ok(JSON.stringify(T.S.forcedTargets.slice()) === JSON.stringify(rawForcedBefore), '반환된 turn.forcedTargets 변조가 엔진 S.forcedTargets에 반영되지 않음');
    const fresh = room.toSeatView(cur);
    ok(!fresh.turn.forcedTargets.includes('u-injected'), '다음 조회는 변조 이전 신선한 배열(캐시 오염 없음)');
    const origHp = vb.battle.a.hp;
    const staleBattle = room.toSeatView(cur);
    staleBattle.battle.a.hp = 999999; staleBattle.battle.a.skills = null;
    const freshBattle = room.toSeatView(cur);
    ok(freshBattle.battle.a.hp === origHp, '반환된 battle.a 변조가 다음 조회에 새지 않음(매 호출 새 객체)');

    // ===== 3) 연속 전투 — battleId 단조 증가 + 두 번째 전투에서도 battle.battleId ↔ fx 대응 유지 =====
    driveBattleToEnd(room, 80);
    const remaining = T.S.pieces.filter((p) => p.alive && p.placed && p.type === 'minion');
    const own2 = remaining.find((p) => p.owner === cur), opp2 = remaining.find((p) => p.owner === other);
    if (own2 && opp2) {
      both(room, (E) => { E.initBattle(byId(E, own2.id), byId(E, opp2.id)); });
      const vb2 = room.toSeatView(cur);
      ok(Number.isInteger(vb2.battle.battleId) && vb2.battle.battleId === bId1 + 1, '두 번째 실제 전투 battleId = 첫 번째 + 1(룸 수명 단조): ' + vb2.battle.battleId);
      const starts2 = vb2.fx.events.filter((e) => e.key === 'battleStart');
      ok(starts2.length >= 1 && starts2[starts2.length - 1].battleId === vb2.battle.battleId, '두 번째 전투도 battle.battleId가 자신의 battleStart fx와 대응');
    } else {
      ok(false, '픽스처가 두 번째 전투를 시작할 살아있는 하수인 쌍을 만들지 못함');
    }
  }

  // ===== 5) 실제 텔레포트 stage1→stage2→swap 흐름 — turn.teleport(stage/piece 별칭) 복원 + you.teleUsed 증가 =====
  {
    const room = H.startedRoom(9003);
    const T = room.engine;
    const cur = T.S.current, other = 1 - cur;
    // 픽스처(makeSetup)는 zoneOf(0)의 첫 14칸(2행×7열)만 채운다 — 3번째 행은 비어 있어 충돌 없이 옮겨 둘 수 있다.
    const enemyZoneRow = T.zoneOf(1 - cur)[2];
    const ownMinions = T.S.pieces.filter((p) => p.owner === cur && p.alive && p.placed && p.type === 'minion' && p.immobile === 0);
    ok(ownMinions.length >= 2, '픽스처에 이동 가능한 자기 하수인 2기 이상 존재(전제)');
    const [pc1, pc2] = ownMinions;
    both(room, (E) => { const p1 = byId(E, pc1.id); p1.r = enemyZoneRow; p1.c = 1; }); // teleportAvailable 조건 충족(적 진영 체류)

    const teleStart = act(room, cur, { t: 'tele' });
    ok(teleStart.ok && T.S.teleport && T.S.teleport.stage === 1, '실제 tele 액션 — stage1 진입: ' + JSON.stringify(teleStart.reason));

    const pick1 = act(room, cur, { t: 'cell', r: enemyZoneRow, c: 1 });
    ok(pick1.ok && T.S.teleport && T.S.teleport.stage === 2, '첫 말 선택(cell) — stage2 진입');
    const vTele = room.toSeatView(cur), vTeleOther = room.toSeatView(other);
    ok(vTele.turn && vTele.turn.teleport && vTele.turn.teleport.stage === 2 && vTele.turn.teleport.piece === room._alias(pc1.id),
      'turn.teleport이 stage2·선택된 말 별칭을 그대로 노출(원본 스왑 하이라이트 복원): ' + JSON.stringify(vTele.turn.teleport));
    ok(vTeleOther.turn === null, '비행동자 좌석은 텔레포트 선택 진행 상황을 보지 못함');

    const swap = act(room, cur, { t: 'cell', r: pc2.r, c: pc2.c });
    ok(swap.ok && T.S.teleport === null, '두 번째 말 선택으로 실제 스왑 완료(doTeleportSwap), teleport 상태 정리: ' + JSON.stringify(swap.reason));
    const vAfter = room.toSeatView(cur);
    ok(vAfter.you.teleUsed === 1, '실제 텔레포트 1회 사용 후 you.teleUsed=1(자기 카운트만)');
  }

  // ===== 6) fleePick.pieceId — 소유자 전용 별칭(도망친 말 자체 강조 표시) =====
  {
    const room = H.startedRoom(9004);
    const T = room.engine;
    const cur = T.S.current, other = 1 - cur;
    // 전선에 가까운 말을 공격자로 — 후방 교환 후보가 생기도록(test-authority-rules.js P1과 동일한 픽스처 요령)
    const att = T.S.pieces.filter((p) => p.owner === cur && p.type === 'minion').sort((a, b) => (cur === 0 ? a.r - b.r : b.r - a.r))[0];
    const def = T.S.pieces.find((p) => p.owner === other && p.type === 'minion' && p.alive);
    both(room, (E) => { E.BAL.fleeProb = 1; E.initBattle(byId(E, att.id), byId(E, def.id)); });
    const res = act(room, cur, { t: 'flee' });
    ok(res.ok && T.S.fleePick && T.S.fleePick.owner === cur, '도망 성공 → fleePick 진입(fleeProb=1 강제): ' + JSON.stringify(res.reason));
    if (T.S.fleePick) {
      const v = room.toSeatView(cur), vOther = room.toSeatView(other);
      ok(v.fleePick.pieceId === room._alias(att.id), '소유자 뷰의 fleePick.pieceId가 실제 도망친 말의 별칭과 일치');
      ok(vOther.fleePick.pieceId === undefined, '상대 뷰에는 fleePick.pieceId 자체가 없음(cands와 같은 소유자 전용 게이트)');
    } else {
      ok(false, '픽스처가 fleePick 상태를 만들지 못함');
    }
  }

  // ===== 7) FINISHED 종료 리빌(#11) — 원본 index.html:1705 viewer===2와 동치: 경기가 실제로 끝나면
  //          visibleTo/revealed 마스킹 없이 살아있는 모든 상대 말의 위치·정체가 보인다. 다른 종료 상태
  //          (CANCELED)에는 이 리빌이 새지 않는다(원래도 board 자체가 없음) =====
  {
    const room = H.startedRoom(9005);
    const T = room.engine;
    const cur = T.S.current, other = 1 - cur;
    // 숲 속·비인접(등급 A, 레코드 자체가 빠지는 조건)으로 숨겨 둔 상대 유닛을 하나 만든다.
    const hidden = T.S.pieces.find((p) => p.owner === other && p.alive && p.placed && p.type === 'minion');
    both(room, (E) => {
      for (const p of E.S.pieces) if (p.owner === cur && p.alive && p.placed) { p.r = 12; p.c = (p.c % 7) + 1; } // 내 말들을 멀리 치움
      const h = byId(E, hidden.id); h.r = 4; h.c = 4; h.revealed = false; // 숲(4-5행)·비인접·미공개
    });
    const before = room.toSeatView(cur);
    ok(!before.units.some((u) => u.id === room._alias(hidden.id)), '경기 중에는 숲 속·비인접 상대 유닛이 등급 A로 레코드 자체가 빠짐(전제)');

    both(room, (E) => { E.gameOver(cur, 'king'); }); // 실제 종료 함수 — S.phase="over"
    ok(room.engine.S.phase === 'over', 'gameOver() 이후 실제 엔진 phase=over(전제)');
    // 서버 상태 전이는 room.js가 아니라 _apply/_handleResign 경로에서만 일어나므로, 엔진을 직접 종료시킨 이
    // 픽스처에서는 room.state를 실제 승부 결과와 같은 값으로 맞춰 준다(FINISHED 분기 재현 목적의 최소 개입).
    room.state = STATES.FINISHED; room.result = { type: 'WIN', winner: cur, winType: 'king' };

    const after = room.toSeatView(cur), afterOther = room.toSeatView(other);
    const hiddenAlias = room._alias(hidden.id);
    const revealed = after.units.find((u) => u.id === hiddenAlias);
    ok(!!revealed, 'FINISHED에서는 숲 속·비인접 상대 유닛도 units에 나타남(등급 A 마스킹 해제): ' + JSON.stringify(after.units));
    ok(revealed && revealed.type === 'minion' && typeof revealed.name === 'string' && revealed.rosterId,
      'FINISHED 리빌은 위치뿐 아니라 정체(type/name/rosterId)까지 C-2 등급으로 공개: ' + JSON.stringify(revealed));
    const revealedOther = afterOther.units.find((u) => u.id === room._alias(T.S.pieces.find((p) => p.owner === cur && p.alive && p.placed).id));
    ok(!!revealedOther, '양 좌석 모두 종료 리빌이 적용됨(원본 viewer===2는 양쪽 화면 공통)');

    // 다른 종료 상태(CANCELED)에는 이 리빌이 새지 않는다 — 애초에 board 자체가 비어 있다(TERMINAL_NO_BOARD).
    const room2 = H.setupRoom(9006);
    room2.explicitLeave(1);
    const canceledView = room2.toSeatView(0);
    ok(canceledView.state === 'CANCELED' && canceledView.units.length === 0 && canceledView.phase === 'canceled',
      'CANCELED 등 다른 종료 상태는 board 자체가 비어 있어 리빌이 새지 않음: ' + JSON.stringify(canceledView));
  }

  done();
}

main();
