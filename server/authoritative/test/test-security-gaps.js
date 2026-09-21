'use strict';
// #217 — Mercury 사전 감사(acceptance-audit.md)·PD 감사(msg_2c1dbdd3d215)가 지목한 경계를 직접 검증한다.
// v4: 엔진 상태를 직접 조작하는 픽스처는 H.both()로 두 좌석 엔진에 같이 적용한다(한쪽만 바꾸면 락스텝 검사가 룸을 VOID로 닫는다).
const H = require('./helpers');
const { STATES, both, byId, snap, act } = H;
const { ok, done } = H.makeCounter('security-gaps');

function battlePair(T, cur) {
  const other = 1 - cur;
  return {
    att: T.S.pieces.find((p) => p.owner === cur && p.type === 'minion' && p.alive).id,
    def: T.S.pieces.find((p) => p.owner === other && p.type === 'minion' && p.alive).id,
  };
}

// ===== PD 감사: auto/clear/roster/setupDone/selTray는 IN_PROGRESS 중 applyAction에 닿으면 안 된다 =====
{
  const room = H.startedRoom(10);
  const cur = room.engine.S.current;
  for (const bad of [{ t: 'auto' }, { t: 'clear' }, { t: 'roster', rid: 'X' }, { t: 'setupDone' }, { t: 'selTray', id: 'X' }]) {
    const before = snap(room);
    const res = act(room, cur, bad);
    ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION', `IN_PROGRESS 중 ${bad.t} 거부: ` + JSON.stringify(res));
    ok(snap(room) === before, `${bad.t} 거부는 revision·두 엔진 상태를 전혀 바꾸지 않음`);
  }
}

// ===== 회귀 방지 근거: 가드가 없으면 실제로 보드가 붕괴한다 (원본 clearPlaceCore는 phase 가드가 없다) =====
{
  const room = H.startedRoom(11);
  const T = room.engine;
  const before = T.S.pieces.filter((p) => p.alive && p.placed).length;
  H.withEngine(T, () => { T.S.pieces.filter((x) => x.owner === T.S.setupPlayer).forEach((x) => { x.placed = false; }); });
  const after = T.S.pieces.filter((p) => p.alive && p.placed).length;
  ok(before === 28 && after < before, '가드 없이 clearPlaceCore 로직을 실행하면 실제로 배치가 사라짐 — SETUP_ONLY_ACTIONS 차단이 막는 위협');
}

// ===== 존재하지 않는 대상 heal — v4: 판정 단계에서 거부(v3는 수락하고 revision만 올렸다) =====
{
  const room = H.startedRoom(12);
  const cur = room.engine.S.current;
  const before = snap(room);
  const res = act(room, cur, { t: 'heal', id: 'no-such-piece-id-xyz' });
  ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION', '존재하지 않는 id의 heal은 E_ILLEGAL_ACTION: ' + JSON.stringify(res));
  ok(snap(room) === before, '거부된 heal은 revision·엔진 상태를 전혀 바꾸지 않음');
}
{
  const room = H.startedRoom(13);
  const cur = room.engine.S.current;
  const before = snap(room);
  const res = act(room, 1 - cur, { t: 'act', k: 0 });
  ok(res.reason === 'E_NOT_ACTOR', '전투 밖에서도 상대 좌석의 act는 E_NOT_ACTOR: ' + JSON.stringify(res));
  ok(snap(room) === before, '거부된 act는 엔진 상태를 전혀 바꾸지 않음');
  const res2 = act(room, cur, { t: 'act', k: 0 });
  ok(res2.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, '행동자라도 전투 밖 act는 E_ILLEGAL_ACTION·불변');
}

// ===== 전투 서브페이즈 행위자 교차검증 — netActor()/actorOfPhase()는 S.current만으로 정해지지 않는다 =====
{
  const room = H.startedRoom(14);
  const T = room.engine;
  const cur = T.S.current, other = 1 - cur;
  const ids = battlePair(T, cur);
  both(room, (E) => { E.initBattle(byId(E, ids.att), byId(E, ids.def)); });
  ok(!!T.S.battle && T.actorOfPhase() === 'A' && T.netActor() === cur, '전투 A-phase 행위자는 공격자');
  {
    const before = snap(room);
    const res = act(room, other, { t: 'act', k: 0 });
    ok(res.reason === 'E_NOT_ACTOR', 'A-phase에 방어자가 행동하면 거부: ' + JSON.stringify(res));
    ok(snap(room) === before, 'A-phase 거부된 방어자 행동은 전투 상태를 바꾸지 않음');
  }
  const step1 = act(room, cur, { t: 'act', k: 0 });
  ok(step1.ok && !step1.noop, 'A-phase 공격자 행동 성공: ' + JSON.stringify(step1.reason));
  if (T.S.battle) {
    ok(T.actorOfPhase() === 'D' && T.netActor() === other, 'D-phase로 전환 — 행위자는 방어자');
    const before2 = snap(room);
    const res2 = act(room, cur, { t: 'act', k: 1 });
    ok(res2.reason === 'E_NOT_ACTOR', 'D-phase에 예전 공격자가 다시 행동하면 거부: ' + JSON.stringify(res2));
    ok(snap(room) === before2, 'D-phase 거부된 재행동은 전투 상태를 바꾸지 않음');
  }
}

// ===== 오래된 baseRevision은 전투 중에도 그대로 막는다 (C3 교차) =====
{
  const room = H.startedRoom(15);
  const T = room.engine;
  const cur = T.S.current;
  const ids = battlePair(T, cur);
  both(room, (E) => { E.initBattle(byId(E, ids.att), byId(E, ids.def)); });
  const before = snap(room);
  const res = room._handleAction(cur, { baseRevision: room.revision - 1, action: { t: 'act', k: 0 } });
  ok(res.reason === 'E_STALE_REVISION', '전투 중 낡은 baseRevision도 거부: ' + JSON.stringify(res.reason));
  ok(snap(room) === before, '전투 중 낡은 revision 거부는 상태를 바꾸지 않음');
}

// ===== 좌석 뷰 — 진행 중 모달(2차 선택)은 소유 좌석에만 실제 내용을 준다 =====
{
  const room = H.startedRoom(16);
  const T = room.engine;
  const own = T.S.current;
  const p = T.S.pieces.find((x) => x.owner === own && x.type === 'minion' && x.alive && x.placed);
  both(room, (E) => {
    E.S.recruit = { owner: own, pieceId: p.id, species: E.ROSTER[0].id, stage: 'root', skill: null, targetId: null, recvId: null, token: p.id + '#1' };  // #245: 토큰은 발급형("말id#발급번호")이어야 한다 — 임의 값이면 손상 기록으로 거부된다
    E.recruitModal();
  });
  const viewOwner = room.toSeatView(own);
  const viewOther = room.toSeatView(1 - own);
  ok(!!viewOwner.modal && viewOwner.modal.owner === own, '소유 좌석 뷰에 modal.owner 존재');
  ok(typeof viewOwner.modal.html === 'string' && viewOwner.modal.html.length > 0, '소유 좌석 뷰에 실제 modal.html 전달');
  ok(Array.isArray(viewOwner.modal.buttons) && viewOwner.modal.buttons.length === viewOwner.modal.count && viewOwner.modal.count > 0, '소유 좌석 뷰에 실제 버튼 배열(count와 같은 길이)');
  ok(!!viewOther.modal && viewOther.modal.owner === own, '비소유 좌석도 누가 응답 대기 중인지는 안다(seq/owner)');
  ok(!('html' in viewOther.modal) && !('buttons' in viewOther.modal), '비소유 좌석 뷰에는 실제 문구·버튼이 전혀 없음');
  ok(viewOwner.modal.seq === viewOther.modal.seq, '양쪽이 같은 seq를 봄');
  // 비소유 좌석 엔진의 DOM은 원본 modal 래퍼가 마스킹했다 — 서버가 그 좌석에 원문을 만들지 않는다는 교차 확인
  const otherBox = room.engines[1 - own].byId('overlayBox').innerHTML;
  ok(/상대 선택 대기 중/.test(otherBox) && room.engines[1 - own].byId('obBtns').children.length === 0, '비소유 좌석 엔진 화면은 원본 마스킹("상대 선택 대기 중")·버튼 0개');
  // 두 번째 모달이 열려도 버튼이 누적되지 않는다 (하네스 스텁의 obBtns 누적 복원)
  both(room, (E) => { E.recruitModal(); });
  const again = room.toSeatView(own).modal;
  ok(again && again.seq === viewOwner.modal.seq + 1 && again.buttons.length === again.count, '재오픈된 모달의 버튼 수가 누적 없이 count와 일치: ' + JSON.stringify(again && [again.count, again.buttons.length]));
}

// ===== 좌석 뷰 — battleModal()이 실제로 쓰는 필드가 빠짐없이 나간다 (Mars 조율 msg_e1b20ffcddd6) =====
{
  const room = H.startedRoom(18);
  const T = room.engine;
  const cur = T.S.current;
  const ids = battlePair(T, cur);
  both(room, (E) => { E.initBattle(byId(E, ids.att), byId(E, ids.def)); });
  const v = room.toSeatView(cur);
  ok(v.battle && 'phase' in v.battle && 'maxRounds' in v.battle && 'actSeq' in v.battle && v.battle.actor === 'A', 'battle에 phase·maxRounds·actSeq·actor');
  for (const side of [v.battle.a, v.battle.d]) {
    ok('rec' in side && 'items' in side && 'itemRound' in side && 'lastItem' in side && 'ballThrow' in side && 'buff' in side,
      'battle.a/d에 rec/items/itemRound/lastItem/ballThrow/buff 존재: ' + JSON.stringify(Object.keys(side)));
  }
  ok(v.battle.a.owner === byId(T, ids.att).owner && v.battle.d.owner === byId(T, ids.def).owner, 'battle.a는 공격자, battle.d는 방어자');
  const vo = room.toSeatView(1 - cur);
  ok(vo.battle.a.skills.every((s) => s.revealed === false ? !('id' in s) && !('name' in s) : true), '상대 전투원의 미공개 기술은 id·이름 없음');
}

// ===== 좌석 뷰 — #217 art-restore-fields delta(Jupiter ctx_7293bb90151c): 왕/동료 본체 vs 포획·예비 대리 출전
// 아트 식별자(type/element/bodyFight/rosterId/artRosterId)와 대리 출전 skills 소스 버그 수정을 회귀로 고정한다.
// 근거: docs/milestone/v0.4.10/issues/217/Jupiter/art-restore-fields.md, Earth/art-omission-audit.md P0.
function resolveSyncModals(room, seatHint, maxSteps) {
  // "출전 공개" 확인처럼 선택지가 없는 단일 버튼 동기화 모달을 자동 진행한다 — 항상 버튼 0("본체 출전"/유일 버튼)을 누른다.
  for (let i = 0; i < (maxSteps || 5); i++) {
    const v = room.toSeatView(seatHint);
    if (!v.modal) return;
    const r = act(room, v.modal.owner, { t: 'modal', seq: v.modal.seq, i: 0 });
    if (!r.ok) throw new Error('sync modal 진행 실패: ' + JSON.stringify(r));
  }
}

// 자기 보드 하수인 rosterId — 상대 미공개 유닛에는 필드 자체가 없어야 한다
{
  const room = H.startedRoom(19);
  const T = room.engine;
  const cur = T.S.current, other = 1 - cur;
  const v = room.toSeatView(cur);
  const myMinion = v.you.pieces.find((p) => p.type === 'minion');
  ok(myMinion && typeof myMinion.rosterId === 'string' && myMinion.rosterId.length > 0, '자기 하수인 rosterId 노출(보드 아이콘용): ' + JSON.stringify(myMinion && myMinion.rosterId));
  const vo = room.toSeatView(other);
  const oppUnit = vo.units.find((u) => u.owner === cur);
  ok(oppUnit && !('rosterId' in oppUnit), '미공개 상대 유닛에는 rosterId 필드 자체가 없음: ' + JSON.stringify(oppUnit));
}

// 하수인 vs 하수인 본체 전투 — bodyFight=true, rosterId 있음·artRosterId 없음, 상대도 이미 units C-2와 동치 정보만 추가로 받는다
{
  const room = H.startedRoom(20);
  const T = room.engine;
  const cur = T.S.current;
  const ids = battlePair(T, cur);
  both(room, (E) => { E.initBattle(byId(E, ids.att), byId(E, ids.def)); });
  const v = room.toSeatView(cur);
  ok(v.battle.a.bodyFight === true && v.battle.d.bodyFight === true, '하수인 vs 하수인: 양쪽 bodyFight=true');
  ok(typeof v.battle.a.rosterId === 'string' && v.battle.a.artRosterId === null, '본체 출전 a측: rosterId 있음·artRosterId 없음: ' + JSON.stringify([v.battle.a.rosterId, v.battle.a.artRosterId]));
  const vo = room.toSeatView(1 - cur);
  ok(vo.battle.d.type === 'minion' && typeof vo.battle.d.rosterId === 'string',
    '전투 중인 상대 하수인의 type/rosterId — 이미 units 등급 C-2(name이 종을 유일 특정)로 나가는 값과 동치라 새 노출이 아님');
}

// 왕 vs 왕 본체 전투(실제 "출전 공개" 동기화 모달 경유) — rosterId/artRosterId 둘 다 null.
// #234 (GDD-23 3.5·6.2): 왕·동료 본체도 스킬 칸을 가진다(왕 1차 기본기 + 2차 속성 스킬 = 2칸, 동료 사망 시 🪄 추가).
// 종전 "skills=null(기본 공격 경로)" 단언은 규칙 변경으로 대체한다 — 기대값을 낮춘 것이 아니라 GDD 6.2 의 칸 구성을 고정한다.
{
  const room = H.startedRoom(21);
  const T = room.engine;
  const king0 = T.S.pieces.find((p) => p.owner === 0 && p.type === 'king');
  const king1 = T.S.pieces.find((p) => p.owner === 1 && p.type === 'king');
  both(room, (E) => { E.initBattle(byId(E, king0.id), byId(E, king1.id)); });
  resolveSyncModals(room, 0);
  const v = room.toSeatView(0);
  ok(!!v.battle, '왕 vs 왕: 동기화 모달(출전 공개) 확인 후 battle 시작');
  ok(v.battle.a.bodyFight === true && v.battle.a.type === 'king' && v.battle.a.rosterId === null && v.battle.a.artRosterId === null,
    '왕 본체: bodyFight=true, rosterId/artRosterId 둘 다 null: ' + JSON.stringify(v.battle.a));
  const kingEl = byId(T, king0.id).element;
  ok(Array.isArray(v.battle.a.skills) && v.battle.a.skills.length === 2 && v.battle.a.skills.every((s) => s.revealed === true)
    && v.battle.a.skills[0].id === 'K-1' && v.battle.a.skills[1].id === 'K-2-' + kingEl,
    '#234 6.2 왕 본체 자기 뷰: 2칸 [K-1, K-2-속성] 전부 공개: ' + JSON.stringify(v.battle.a.skills));
  const vo = room.toSeatView(1);
  ok(Array.isArray(vo.battle.a.skills) && vo.battle.a.skills.length === 1 && vo.battle.a.skills[0].revealed === false
    && Object.keys(vo.battle.a.skills[0]).join() === 'revealed',
    '#234 7.9 상대 왕 본체(아직 스킬 미사용): 칸 수·종류 없이 자리표시 하나: ' + JSON.stringify(vo.battle.a.skills));
}

// 포획 하수인 대리 출전(vipChoice 실제 모달 경유) — bodyFight=false, artRosterId만 노출, 대리 출전 skills 버그 수정 확인
{
  const room = H.startedRoom(22);
  const T = room.engine;
  const ally0 = T.S.pieces.find((p) => p.owner === 0 && p.type === 'ally');
  const king1 = T.S.pieces.find((p) => p.owner === 1 && p.type === 'king');
  const rd = T.ROSTER[3];
  both(room, (E) => {
    const a0 = byId(E, ally0.id);
    a0.cap = { element: rd.element, hp: rd.hp, maxHp: rd.hp, atk: rd.atk, skillAtk: rd.skill, cd: 0, cdMax: rd.cd,
      skills: E.archSkills(rd.arch, rd.element), cds: [0, 0, 0, 0], revealedSkills: [], rosterId: rd.id, artRosterId: rd.id };
  });
  both(room, (E) => { E.initBattle(byId(E, ally0.id), byId(E, king1.id)); });
  let v = room.toSeatView(0);
  ok(v.modal && v.modal.owner === 0 && v.modal.count === 2, '동료+포획 하수인 보유: 소유자에게만 본체/대리 2지선다 모달');
  act(room, v.modal.owner, { t: 'modal', seq: v.modal.seq, i: 1 }); // "포획 하수인 … 출전" 선택
  resolveSyncModals(room, 0); // 왕(king1)은 cap/reserve 없어 자동 본체, 이어서 "출전 공개" 확인만 남음
  v = room.toSeatView(0);
  ok(!!v.battle && v.battle.a.bodyFight === false, '대리 출전 선택 후 battle 시작, bodyFight=false');
  ok(v.battle.a.type === 'ally' && v.battle.a.rosterId === null && v.battle.a.artRosterId === rd.id,
    '대리 출전: piece.type은 원 소유 말(ally) 유지, rosterId 없이 artRosterId만: ' + JSON.stringify([v.battle.a.type, v.battle.a.rosterId, v.battle.a.artRosterId]));
  ok(v.battle.a.element === rd.element, '대리 출전 element는 cap의 종 속성: ' + v.battle.a.element);
  ok(Array.isArray(v.battle.a.skills) && v.battle.a.skills.length === 4 && v.battle.a.skills[0].revealed === true,
    '회귀 방지: 대리 출전 skills가 cap 기준으로 채워짐(수정 전엔 piece(ally).skills가 항상 null이라 대리 출전 4기술이 전혀 안 나갔다)');
  const vo = room.toSeatView(1);
  ok(vo.battle.a.artRosterId === rd.id, '상대 화면에도 대리 출전 개체의 artRosterId 노출(#91 원본 token()이 이미 양쪽에 그리던 표시의 복원 — art-restore-fields.md 근거)');
  ok(vo.battle.a.skills.every((s) => s.revealed === false ? !('id' in s) && !('name' in s) : true), '대리 출전이어도 상대에게 미공개 기술 id/name은 여전히 안 나감(은닉 범위 확대 없음)');
}

// ===== 좌석 뷰 — #217 C-2 board 표시 회귀(Saturn ctx_e6437fa06ae4 REVISE): _serializeKnownOpponent에
// rosterId가 없어 전투 밖(board) 공개 상대 하수인 아이콘(artDirOf)이 계속 폴백했다. 공개 전(B)→전투로 revealed
// 세팅→전투 종료 후(board-only C-2 표시)까지 rosterId 유무 경계를 고정한다. 근거: Jupiter/art-restore-fields.md.
{
  const room = H.startedRoom(23);
  const T = room.engine;
  const cur = T.S.current, other = 1 - cur;
  const ids = battlePair(T, cur); // att: cur 소유, def: other 소유
  const defPiece = byId(T, ids.def);
  const expectedRosterId = defPiece.rosterId;
  ok(typeof expectedRosterId === 'string' && expectedRosterId.length > 0, '픽스처 전제: 상대 하수인은 실제 rosterId를 가짐');

  // 공개 전(B) — cur 시점에서 그 상대 하수인은 위치·생존만, rosterId/name 필드 자체가 없다
  const defAliasId = room._alias(defPiece.id);
  const before = room.toSeatView(cur).units.find((u) => u.id === defAliasId);
  ok(before && !('rosterId' in before) && !('name' in before) && !('type' in before), '공개 전 상대 하수인: rosterId/name/type 필드 자체 없음(등급 B): ' + JSON.stringify(before));

  // 전투 진입 — startRounds가 양쪽 piece.revealed=true를 세운다(art-restore-fields.md 전제)
  both(room, (E) => { E.initBattle(byId(E, ids.att), byId(E, ids.def)); });
  ok(defPiece.revealed === true, '전투 진입으로 상대 하수인이 revealed=true');

  // 전투 종료 후에도 board 표시(C-2)는 남는다 — 라운드 RNG로 실제 전투를 완주시키지 않고, "전투는 끝났지만
  // revealed는 유지된다"는 이미 세팅된 실제 상태만으로 board-only 경로를 재현한다(회귀는 _serializeKnownOpponent
  // 자체이지 전투 종료 로직이 아니다).
  both(room, (E) => { E.S.battle = null; });
  const after = room.toSeatView(cur).units.find((u) => u.id === defAliasId);
  ok(after && after.type === 'minion' && after.name === defPiece.name && after.rosterId === expectedRosterId,
    '전투 후 board 표시(C-2): rosterId가 실제 값과 일치(보드 아이콘 복구, name과 1:1 동치): ' + JSON.stringify(after));

  // 은닉 경계 보존 — 전투에 관여하지 않은 다른 상대 유닛(미공개)은 여전히 rosterId 필드 자체가 없다
  const untouchedOpp = room.toSeatView(cur).units.find((u) => u.owner === other && u.alive && u.id !== defAliasId && !('type' in u));
  ok(untouchedOpp && !('rosterId' in untouchedOpp), '관여하지 않은 다른 미공개 상대 유닛은 여전히 rosterId 필드 자체 없음: ' + JSON.stringify(untouchedOpp));

  // 왕/동료는 하수인이 아니므로 공개되어도 rosterId는 항상 null(형태 확장 없음)
  const king = T.S.pieces.find((p) => p.owner === other && p.type === 'king');
  both(room, (E) => { byId(E, king.id).revealed = true; });
  const kingView = room.toSeatView(cur).units.find((u) => u.owner === other && u.type === 'king');
  ok(kingView && kingView.rosterId === null, '공개된 왕(비-하수인): type=king이어도 rosterId는 항상 null: ' + JSON.stringify(kingView));
}

// ===== 좌석 뷰 — 보드 로그는 좌석 시점 엔진의 로그다 (v3: 한 엔진의 공용 로그를 양쪽에 동일하게 보내 소유자 시점 정체가 샜다) =====
{
  const room = H.startedRoom(17);
  const cur = room.engine.S.current;
  act(room, cur, { t: 'skipMain' });
  const v0 = room.toSeatView(0), v1 = room.toSeatView(1);
  ok(Array.isArray(v0.log) && v0.log.length > 0 && v0.log.every((l) => typeof l.msg === 'string' && 'cls' in l), '좌석 뷰 log 각 항목이 {msg,cls}');
  const last0 = v0.log[v0.log.length - 1].msg, last1 = v1.log[v1.log.length - 1].msg;
  const mineLabel = cur === 0 ? '나(P1)' : '나(P2)';
  const theirLabel = cur === 0 ? '상대(P1)' : '상대(P2)';
  ok((cur === 0 ? last0 : last1).indexOf(mineLabel) !== -1 && (cur === 0 ? last1 : last0).indexOf(theirLabel) !== -1, '주 행동 생략 로그의 인칭이 좌석마다 올바름("나"/"상대"): ' + JSON.stringify([last0, last1]));
}

/* ===== #245 전투 어휘의 겨냥 프레임(bf) — Battle→Core 경계 =====
   클라이언트(demo/js/network.js netAction)는 전투 어휘에 보낸 시점의 행동자·전투 진행 지점을 싣는다.
   서버는 그 값을 자기 상태에서 뽑은 프레임과 통째로 대조해 **Core 에 닿기 전에** 거부하고, 통과한 값은
   좌석 엔진까지 그대로 실어 보낸다(엔진 battleCmdCtx 가 같은 대조를 다시 한다). */
{
  const room = H.startedRoom(18);
  const T = room.engine;
  const cur = T.S.current;
  const ids = battlePair(T, cur);
  both(room, (E) => { E.initBattle(byId(E, ids.att), byId(E, ids.def)); });
  const want = H.battleFrame(T);
  ok(want && want.side === T.actorOfPhase() && want.seq === (T.S.battle.actSeq || 0)
    && want.round === T.S.battle.round && want.phase === T.S.battle.phase, '전제: 서버 겨냥 프레임 = side·seq·round·phase: ' + JSON.stringify(want));

  const bad = [
    ['없음', undefined],
    ['null', null],
    ['부분(phase 누락)', { side: want.side, seq: want.seq, round: want.round }],
    ['여분 키', Object.assign({}, want, { extra: 1 })],
    ['배열', [want.side, want.seq, want.round, want.phase]],
    ['낡음/재생(seq-1)', Object.assign({}, want, { seq: want.seq - 1 })],
    ['앞선 seq', Object.assign({}, want, { seq: want.seq + 1 })],
    ['다른 행동자(side)', Object.assign({}, want, { side: want.side === 'A' ? 'D' : 'A' })],
    ['다른 라운드', Object.assign({}, want, { round: want.round + 1 })],
    ['다른 단계', Object.assign({}, want, { phase: want.phase + 1 })],
    ['문자열 seq', Object.assign({}, want, { seq: String(want.seq) })],
  ];
  for (const [label, bf] of bad) {
    const before = snap(room);
    const res = act(room, cur, { t: 'act', k: 0, bf });
    ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION', `겨냥 프레임 ${label} → E_ILLEGAL_ACTION: ` + JSON.stringify(res.reason));
    ok(snap(room) === before, `겨냥 프레임 ${label} 거부는 두 엔진 상태·revision 불변(Core 미도달)`);
  }
  // 좌석·차례 판정이 프레임 검사보다 먼저다 — 상대 좌석은 프레임이 정확해도 E_NOT_ACTOR 다
  ok(act(room, 1 - cur, { t: 'act', k: 0, bf: want }).reason === 'E_NOT_ACTOR', '정확한 프레임이어도 비행위자 좌석은 E_NOT_ACTOR');

  // 통과한 프레임은 좌석 엔진에 넘길 액션에 그대로 실린다(최소 필드로 다시 지으면서 버리지 않는다)
  for (const a of [{ t: 'act', k: 0 }, { t: 'flee' }, { t: 'pkgOpen', kind: 'itemGift' }]) {
    both(room, (E) => { E.S.pkgs[cur] = Object.assign({}, E.S.pkgs[cur], { itemGift: 1 }); E.S.battle[T.actorOfPhase() === 'A' ? 'fa' : 'fd'].fleeLock = false; });
    const auth = room._authorize(cur, Object.assign({ bf: want }, a));
    ok(auth.ok && auth.action.bf === want, `수락된 ${a.t} 액션이 bf 를 보존: ` + JSON.stringify([auth.ok, auth.reason, auth.action && auth.action.bf]));
  }

  const before = snap(room);
  const good = act(room, cur, { t: 'act', k: 0, bf: want });
  ok(good.ok && !good.noop && snap(room) !== before && room.state === STATES.IN_PROGRESS, '정확한 겨냥 프레임은 수락·상태 전진: ' + JSON.stringify(good.reason));
  // 같은 프레임을 다시 보내면(재생) 행동 토큰이 이미 넘어가 거부된다
  if (room.engines && room.engine.S.battle) {
    const b2 = snap(room);
    const replay = act(room, cur, { t: 'act', k: 0, bf: want });
    ok(!replay.ok && snap(room) === b2, '소모된 프레임 재전송(재생)은 거부·불변: ' + JSON.stringify(replay.reason));
  }
}

/* ===== #245 패키지 개봉 인가 표(B.pkgSel)는 락스텝 요약에 들어간다 =====
   확정(pkgPick)은 모달 중계를 타서 회선 프레임이 없고, 이 표가 곧 그 확정의 겨냥 문맥이자 재고를 움직일 권한이다.
   요약에 없으면 두 좌석이 서로 다른 표를 들고 있어도 같은 상태로 읽혀 fail-closed VOID 가 발동하지 못한다. */
{
  const room = H.startedRoom(19);
  const T = room.engine;
  const cur = T.S.current;
  const ids = battlePair(T, cur);
  both(room, (E) => { E.initBattle(byId(E, ids.att), byId(E, ids.def)); E.S.pkgs[cur] = Object.assign({}, E.S.pkgs[cur], { itemGift: 1, battleBuff: 1 }); });
  const d0 = H.lockstepDigest(room.engines[0]);
  const res = act(room, cur, { t: 'pkgOpen', kind: 'itemGift' });
  ok(res.ok && room.state === STATES.IN_PROGRESS, '개봉 수락(락스텝 유지): ' + JSON.stringify([res.reason, room.state]));
  const sel = room.engines.map((E) => E.S.battle && E.S.battle.pkgSel);
  ok(sel[0] && sel[1] && JSON.stringify(sel[0]) === JSON.stringify(sel[1]) && sel[0].kind === 'itemGift' && sel[0].owner === cur,
    '두 좌석 엔진이 같은 인가 표를 발급: ' + JSON.stringify(sel));
  ok(H.lockstepDigest(room.engines[0]) !== d0, '발급된 표가 요약을 바꾼다(요약이 표를 본다)');
  // 한 좌석만 **다른** 표를 들면 요약이 갈린다 — 종류·소유자·문맥 네 값 각각
  const base = sel[0];
  for (const [label, patch] of [['종류', { kind: 'battleBuff' }], ['소유자', { owner: 1 - base.owner }],
    ['side', { side: base.side === 'A' ? 'D' : 'A' }], ['seq', { seq: base.seq + 1 }],
    ['round', { round: base.round + 1 }], ['phase', { phase: base.phase + 1 }], ['회수(null)', null]]) {
    room.engines[0].S.battle.pkgSel = patch && Object.assign({}, base, patch);
    ok(H.lockstepDigest(room.engines[0]) !== H.lockstepDigest(room.engines[1]), `표의 ${label} 가 한 좌석만 다르면 요약이 갈린다`);
    room.engines[0].S.battle.pkgSel = base;
  }
  ok(H.lockstepDigest(room.engines[0]) === H.lockstepDigest(room.engines[1]), '복원하면 다시 일치(요약이 표 내용만 본다)');
}

done();
