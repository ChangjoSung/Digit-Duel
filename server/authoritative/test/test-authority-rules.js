'use strict';
// #217 v4 — Saturn 최종 소스 스냅샷 REVISE(msg_9a62b8728ecf)의 재현 결함을 하나씩 회귀로 고정한다.
// 각 절은 "v3에서 실제로 재현된 잘못된 결과"를 적고, 수정 후의 정확한 기대 결과를 검증한다.
const H = require('./helpers');
const { ok, done } = H.makeCounter('authority-rules');
const { STATES, both, byId, snap, act } = H;

function firstOf(T, owner, type) {
  return T.S.pieces.find((p) => p.owner === owner && p.type === type && p.alive && p.placed);
}

// ===== P0-1 방어자 소유 모달 — owner는 NET.syncModal.owner이지 netActor/current가 아니다 =====
// v3 재현: current=공격자, modal.owner=방어자에서 방어자 E_NOT_ACTOR, 공격자가 같은 seq/index로 방어자 선택을 대신 실행.
{
  const room = H.startedRoom(101);
  const T = room.engine;
  const cur = T.S.current, def = 1 - cur;
  const attId = firstOf(T, cur, 'minion').id;
  const kingId = firstOf(T, def, 'king').id;
  both(room, (E) => {
    const k = byId(E, kingId);
    k.cap = { element: 'water', hp: 100, maxHp: 100, atk: 20, skillAtk: 30, cd: 0, cdMax: 2, skills: E.archSkills('std', 'water'), cds: [0, 0, 0, 0], revealedSkills: [] };
    E.initBattle(byId(E, attId), k);
  });
  const pm = room._pendingModal();
  ok(!!pm && pm.owner === def, 'VIP 출전 선택 모달의 소유자는 방어자(왕 소유 좌석): ' + JSON.stringify(pm && { owner: pm.owner, cur }));
  ok(T.S.current === cur && T.netActor() === cur, '픽스처 확인: S.current·netActor()는 공격자 좌석');

  const vAtt = room.toSeatView(cur), vDef = room.toSeatView(def);
  ok(vDef.modal && vDef.modal.owner === def && typeof vDef.modal.html === 'string' && vDef.modal.buttons.length === pm.count, '방어자 뷰에 실제 모달 문구·버튼');
  ok(vAtt.modal && vAtt.modal.owner === def && !('html' in vAtt.modal) && !('buttons' in vAtt.modal), '공격자 뷰에는 owner/seq/count만(문구·버튼 없음)');
  ok(vDef.modal.html.indexOf('포획 하수인') === -1 || JSON.stringify(vAtt).indexOf('포획 하수인') === -1, '대리 출전 정보는 공격자 뷰 어디에도 없음');

  // 공격자가 같은 seq/index로 방어자 선택을 대신하려 하면 거부 + 완전 불변
  let before = snap(room);
  let res = act(room, cur, { t: 'modal', seq: pm.seq, i: 1 });
  ok(!res.ok && res.reason === 'E_NOT_ACTOR', '공격자의 방어자 모달 응답은 E_NOT_ACTOR: ' + JSON.stringify(res));
  ok(snap(room) === before, '공격자의 대리 선택 거부는 상태·revision 불변');

  // 모달이 떠 있는 동안 다른 행동 전부 거부 (공격자·방어자 모두)
  for (const [seat, a] of [[cur, { t: 'skipMain' }], [cur, { t: 'tele' }], [cur, { t: 'endTurn' }], [cur, { t: 'act', k: 0 }],
    [def, { t: 'skipMain' }], [def, { t: 'act', k: 'basic' }], [def, { t: 'cell', r: 7, c: 4 }], [def, { t: 'tele' }]]) {
    before = snap(room);
    res = act(room, seat, a);
    ok(!res.ok, `모달 대기 중 좌석${seat === cur ? '(공격자)' : '(방어자)'} ${a.t} 거부: ` + JSON.stringify(res));
    ok(snap(room) === before, `모달 대기 중 ${a.t} 거부는 불변`);
  }
  // 범위 밖 인덱스·낡은 seq
  for (const bad of [{ t: 'modal', seq: pm.seq, i: pm.count }, { t: 'modal', seq: pm.seq, i: -1 }, { t: 'modal', seq: pm.seq - 1, i: 0 }, { t: 'modal', seq: pm.seq + 1, i: 0 }]) {
    before = snap(room);
    res = act(room, def, bad);
    ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION', '잘못된 모달 응답 거부: ' + JSON.stringify(bad) + ' → ' + JSON.stringify(res));
    ok(snap(room) === before, '잘못된 모달 응답 거부는 불변');
  }

  // 정당한 방어자 선택 — "포획 하수인 출전"(i=1) → 방어 전투원이 cap으로 확정되고 전투가 시작된다
  const rev0 = room.revision;
  res = act(room, def, { t: 'modal', seq: pm.seq, i: 1 });
  ok(res.ok && !res.noop && room.revision === rev0 + 1, '방어자 본인의 모달 응답은 수락, revision +1: ' + JSON.stringify({ ok: res.ok, reason: res.reason }));
  // 원본 흐름: 양측 출전 선택이 끝나면 공개 후 행동자(공격자) 소유의 "전투 시작" 확인 모달이 뜬다
  const pmStart = room._pendingModal();
  ok(!!pmStart && pmStart.owner === cur && pmStart.seq === pm.seq + 1 && pmStart.count === 1, '출전 선택 후 공격자 소유 "전투 시작" 모달: ' + JSON.stringify(pmStart && { owner: pmStart.owner, seq: pmStart.seq, buttons: pmStart.buttons }));
  before = snap(room);
  res = act(room, def, { t: 'modal', seq: pmStart.seq, i: 0 });
  ok(res.reason === 'E_NOT_ACTOR' && snap(room) === before, '방어자는 공격자의 "전투 시작"을 누를 수 없음·불변');
  res = act(room, cur, { t: 'modal', seq: pmStart.seq, i: 0 });
  ok(res.ok && !res.noop, '공격자 "전투 시작" 수락');
  const B0 = room.engines[0].S.battle, B1 = room.engines[1].S.battle;
  ok(!!B0 && !!B1 && B0.fd === byId(room.engines[0], kingId).cap && B1.fd === byId(room.engines[1], kingId).cap, '방어자 선택(포획 하수인 출전)이 두 좌석 엔진 모두에 반영');
  ok(room._pendingModal() === null, '전투 시작 후 모달 대기 해제(전투 화면은 버튼 중계 모달이 아니다)');
  // 같은 seq 재전송(중복·늦은 콜백) — 이미 소비됨
  before = snap(room);
  res = act(room, def, { t: 'modal', seq: pm.seq, i: 0 });
  ok(!res.ok, '처리된 모달 seq 재전송 거부: ' + JSON.stringify(res));
  ok(snap(room) === before, '처리된 모달 재전송 거부는 불변');
}

// ===== P0-1b 공격자는 방어자의 왕 cap 선택을 고를 수 없다 — 본체 선택(i=0) 대리 시도도 동일 =====
{
  const room = H.startedRoom(102);
  const T = room.engine;
  const cur = T.S.current, def = 1 - cur;
  const attId = firstOf(T, cur, 'minion').id;
  const kingId = firstOf(T, def, 'king').id;
  both(room, (E) => {
    const k = byId(E, kingId);
    k.cap = { element: 'fire', hp: 90, maxHp: 100, atk: 20, skillAtk: 30, cd: 0, cdMax: 2, skills: E.archSkills('std', 'fire'), cds: [0, 0, 0, 0], revealedSkills: [] };
    E.initBattle(byId(E, attId), k);
  });
  const pm = room._pendingModal();
  const before = snap(room);
  const res = act(room, cur, { t: 'modal', seq: pm.seq, i: 0 });
  ok(res.reason === 'E_NOT_ACTOR' && snap(room) === before, '공격자의 "본체 출전" 대리 선택도 거부·불변');
  const res2 = act(room, def, { t: 'modal', seq: pm.seq, i: 0 });
  const start = room._pendingModal();
  const res3 = start ? act(room, cur, { t: 'modal', seq: start.seq, i: 0 }) : { ok: false };
  ok(res2.ok && res3.ok && room.engines.every((E) => E.S.battle && E.S.battle.fd === byId(E, kingId)), '방어자 "본체 출전" 선택은 수락되어 왕 본체가 방어');
}

// ===== P0-1c disabled 버튼 인덱스 거부 — 전투 버프 패키지의 "시간의 수호자"는 1라운드 밖에서 disabled (3라운드: 공격자 선공) =====
{
  const room = H.startedRoom(103);
  const T = room.engine;
  const cur = T.S.current, def = 1 - cur;
  const attId = firstOf(T, cur, 'minion').id, dId = firstOf(T, def, 'minion').id;
  both(room, (E) => { E.S.pkgs[cur].battleBuff = 1; E.initBattle(byId(E, attId), byId(E, dId)); E.S.battle.round = 3; E.battleModal(); });
  let res = act(room, cur, { t: 'pkgOpen', kind: 'battleBuff' });
  ok(res.ok, '전투 중 행동자의 패키지 개봉 수락: ' + JSON.stringify(res.reason));
  const pm = room._pendingModal();
  const timeIdx = T.BUFF_KEYS.indexOf('time');
  ok(!!pm && pm.owner === cur && pm.disabled[timeIdx] === true, '버프 선택 모달에서 시간의 수호자 버튼이 disabled: ' + JSON.stringify(pm && pm.disabled));
  let before = snap(room);
  res = act(room, cur, { t: 'modal', seq: pm.seq, i: timeIdx });
  ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, 'disabled 버튼 인덱스 응답은 거부·불변(재고 소비 없음)');
  const powerIdx = T.BUFF_KEYS.indexOf('power');
  res = act(room, cur, { t: 'modal', seq: pm.seq, i: powerIdx });
  ok(res.ok && room.engines.every((E) => E.S.pkgs[cur].battleBuff === 0 && (E.S.battle.attP.owner === cur ? E.S.battle.buffA : E.S.battle.buffD) === 'power'), '활성 버튼(힘의 수호자) 선택은 수락·재고 1 소비');
  // 무료 선택은 전투 행동 차례를 넘기지 않는다
  ok(room.engine.actorOfPhase() === (room.engine.S.battle.attP.owner === cur ? 'A' : 'D'), '패키지 선택 후에도 같은 행동자 차례');
}

// ===== P0-2 전투 중 보드 행동 차단 — v3: 방어자 차례 skipMain이 공격자 mainUsed=true로 바꾸고 전투는 그대로 =====
{
  const room = H.startedRoom(104);
  const T = room.engine;
  const cur = T.S.current, def = 1 - cur;
  const attId = firstOf(T, cur, 'minion').id, dId = firstOf(T, def, 'minion').id;
  both(room, (E) => { E.initBattle(byId(E, attId), byId(E, dId)); });
  ok(T.actorOfPhase() === 'A' && !T.S.mainUsed, '픽스처: 전투 A 차례, mainUsed=false');
  let res = act(room, cur, { t: 'act', k: 0 });
  ok(res.ok, '공격자 슬롯0 공격 수락: ' + JSON.stringify(res.reason));
  if (T.S.battle) {
    ok(T.actorOfPhase() === 'D', 'D 차례로 전환');
    const mainUsedBefore = T.S.mainUsed;
    for (const a of [{ t: 'skipMain' }, { t: 'tele' }, { t: 'endTurn' }, { t: 'search' }, { t: 'cell', r: 7, c: 4 }, { t: 'fleeSkip' }]) {
      const before = snap(room);
      res = act(room, def, a);
      ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION', `방어자 전투 차례의 ${a.t} 거부: ` + JSON.stringify(res));
      ok(snap(room) === before, `방어자 ${a.t} 거부는 불변 (공격자 mainUsed·전투 상태 그대로)`);
    }
    ok(T.S.mainUsed === mainUsedBefore && !!T.S.battle, '공격자 mainUsed 불변·전투 계속');
    for (const a of [{ t: 'skipMain' }, { t: 'tele' }, { t: 'act', k: 0 }]) {
      const before = snap(room);
      res = act(room, cur, a);
      ok(!res.ok && res.reason === 'E_NOT_ACTOR' && snap(room) === before, `공격자가 방어자 차례에 ${a.t} → E_NOT_ACTOR·불변`);
    }
    res = act(room, def, { t: 'act', k: T.S.battle.fd.skills.findIndex((_, i) => T.slotUsable(T.S.battle.fd, i, 'D')) });
    ok(res.ok, '방어자 본인의 전투 행동은 수락');
  }
}

// ===== P0-2b 전투 어휘의 자원 합법성 — 쿨 슬롯·없는 아이템·볼 조건·패스 조건·빈 패키지 =====
{
  const room = H.startedRoom(105);
  const T = room.engine;
  const cur = T.S.current, def = 1 - cur;
  const attId = firstOf(T, cur, 'minion').id, dId = firstOf(T, def, 'minion').id;
  /* #234 (GDD-23 3.4·6장): 경기 시작 하수인은 ⭐1 = 스킬 1칸이다. 이 절은 "4칸 전투원의 쿨 슬롯·레거시 kind 매핑" 합법성을
     보므로, 종전 암묵 전제(모든 하수인 4칸)를 픽스처에 명시한다 — 1칸 그대로 슬롯0 을 쿨로 막으면 합법 칸이 없어 pass 가
     정당하게 수락된다(규칙 변경이지 서버 결함이 아니다). 사용 조건이 없는 레거시 4칸 키트(포획 픽스처와 같은 archSkills)를 쓴다. */
  both(room, (E) => {
    E.initBattle(byId(E, attId), byId(E, dId));
    const fa = E.S.battle.fa; fa.skills = E.archSkills('std', fa.element); fa.cds = [2, 0, 0, 0]; fa.revealedSkills = [];
    E.S.inv[cur] = []; E.S.balls[cur] = 0; E.S.pkgs[cur].itemGift = 0; E.battleModal();
  });
  for (const a of [{ t: 'act', k: 0 }, { t: 'act', k: 7 }, { t: 'act', k: 'basic' }, { t: 'item', i: 0 }, { t: 'ball' }, { t: 'pass' }, { t: 'pkgOpen', kind: 'itemGift' }, { t: 'pkgOpen', kind: 'nope' }]) {
    const before = snap(room);
    const res = act(room, cur, a);
    ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, `불법 전투 입력 ${JSON.stringify(a)} 거부·불변: ` + JSON.stringify(res));
  }
  for (const a of [{ t: 'act', k: 'foo' }, { t: 'act', k: 1.5 }, { t: 'act' }]) {
    const res = act(room, cur, a);
    ok(!res.ok && res.reason === 'E_BAD_ENVELOPE', `형식 오류 act ${JSON.stringify(a)} → E_BAD_ENVELOPE`);
  }
  const res = act(room, cur, { t: 'act', k: 'skill' }); // 4슬롯 전투원의 'skill' = 슬롯1(사용 가능)
  ok(res.ok && !res.noop, "4슬롯 전투원의 레거시 'skill'(슬롯1)은 수락");
}

// ===== P1 왕/동료 본체 act — v3: _sanitizeAction이 문자열 k를 E_BAD_ENVELOPE로 거부 =====
// #234 (GDD-23 3.5·6.2): 왕 본체는 이제 스킬 2칸(K-1 기본기 · K-2-속성)을 가진다(전투 개시 syncLeaderSkills).
// 종전 "기술 슬롯 없음 → 숫자 슬롯·'common' 거부, 'basic' 은 순수 기본 공격" 기대는 규칙 변경으로 다음으로 대체한다:
// 숫자 슬롯 0 수락 · 없는 칸(2·'common') 거부 · 합법 칸이 있으므로 pass 거부 · 레거시 'basic' = 슬롯0 수락.
{
  const room = H.startedRoom(106);
  const T = room.engine;
  const cur = T.S.current, def = 1 - cur;
  const kingId = firstOf(T, cur, 'king').id, dId = firstOf(T, def, 'minion').id;
  both(room, (E) => { E.initBattle(byId(E, kingId), byId(E, dId)); });
  // 왕이 끼는 전투는 "출전 공개" 확인 모달(행동자 소유)을 거친 뒤 전투가 열린다
  const reveal = room._pendingModal();
  ok(!!reveal && reveal.owner === cur && /출전 공개/.test(reveal.html), '왕 출전 공개 모달은 공격자 소유: ' + JSON.stringify(reveal && reveal.owner));
  if (reveal) ok(act(room, cur, { t: 'modal', seq: reveal.seq, i: 0 }).ok, '공격자 "전투 시작" 수락');
  /* #233 (GDD-23 4.4): 선턴은 속도로 갈린다 — 왕(spd 8)은 표준형 하수인(spd 10)보다 느려 방어자가 선턴이다.
     이 절의 목적은 왕 본체의 행동 어휘이므로 순서를 가정하지 않고 실제 행위자를 따라가 왕의 차례까지 진행시킨다. */
  if (T.S.battle && T.actorOfPhase() === 'D') {
    const dSlot = T.S.battle.fd.skills.findIndex((_, i) => T.slotUsable(T.S.battle.fd, i, 'D'));
    ok(act(room, def, { t: 'act', k: dSlot }).ok, '방어자가 선턴을 소비(속도 10 > 왕 8, GDD-23 4.4)');
  }
  const fa = T.S.battle && T.S.battle.fa;
  ok(!!fa && Array.isArray(fa.skills) && fa.skills.length === 2 && T.actorOfPhase() === 'A' && !room._pendingModal(),
    '픽스처: 왕 본체(스킬 2칸, GDD-23 6.2) 공격 차례, 모달 없음: ' + JSON.stringify(fa && fa.skills));
  for (const a of [{ t: 'act', k: 2 }, { t: 'act', k: 3 }, { t: 'act', k: 'common' }, { t: 'pass' }]) {
    const before = snap(room);
    const res = act(room, cur, a);
    ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, `2칸 왕 본체의 ${JSON.stringify(a)} 거부·불변(없는 칸·합법 칸 보유)`);
  }
  const hpBefore = T.S.battle.fd.hp, seqBefore = T.S.battle.actSeq || 0, rev = room.revision;
  const res = act(room, cur, { t: 'act', k: 'basic' });
  ok(res.ok && !res.noop && room.revision === rev + 1, "왕 본체 레거시 act k='basic'(= 슬롯0 K-1) 수락: " + JSON.stringify(res.reason));
  const B = room.engine.S.battle;
  ok(!B || B.fd.hp < hpBefore || (B.actSeq || 0) > seqBefore, '슬롯0 기본기가 실제로 적용됨(피해 또는 차례 진행)');
}

// ===== P1 배치 검증 — v3: 중복/미지 로스터·말 수 불일치를 수락하고 applyNetSetup이 무작위 대체해 경기 시작 =====
{
  const room = H.setupRoom(107);
  const good = H.makeSetup();
  // 좌석1은 먼저 정상 배치 + ready, 좌석0 잘못된 배치가 그 ready를 건드리지 않아야 한다
  room._handleSetup(1, H.makeSetup()); room._handleReady(1, true);
  room._handleSetup(0, good);
  const T = H.createEngine();
  const unknownRoster = good.roster.slice(0, 5).concat(['NOT-A-MINION']);
  const dupRoster = good.roster.slice(0, 5).concat([good.roster[0]]);
  const otherId = T.ROSTER.map((x) => x.id).find((id) => !good.roster.includes(id));
  const cases = [
    ['중복 로스터', { roster: dupRoster, pos: good.pos }, 'E_ILLEGAL_ACTION'],
    ['알 수 없는 로스터', { roster: unknownRoster, pos: good.pos }, 'E_ILLEGAL_ACTION'],
    ['로스터 5종', { roster: good.roster.slice(0, 5), pos: good.pos }, 'E_ILLEGAL_ACTION'],
    ['로스터 7종', { roster: good.roster.concat([otherId]), pos: good.pos }, 'E_ILLEGAL_ACTION'],
    ['말 13개', { roster: good.roster, pos: good.pos.slice(0, 13) }, 'E_ILLEGAL_ACTION'],
    ['말 15개', { roster: good.roster, pos: good.pos.concat([[13, 7]]) }, 'E_ILLEGAL_ACTION'],
    ['중복 좌표', { roster: good.roster, pos: good.pos.slice(0, 13).concat([good.pos[0]]) }, 'E_ILLEGAL_ACTION'],
    ['진영 밖 행(10)', { roster: good.roster, pos: good.pos.slice(0, 13).concat([[10, 1]]) }, 'E_ILLEGAL_ACTION'],
    ['진영 밖 행(1, 상대 진영)', { roster: good.roster, pos: good.pos.slice(0, 13).concat([[1, 1]]) }, 'E_ILLEGAL_ACTION'],
    ['열 0', { roster: good.roster, pos: good.pos.slice(0, 13).concat([[13, 0]]) }, 'E_ILLEGAL_ACTION'],
    ['열 8', { roster: good.roster, pos: good.pos.slice(0, 13).concat([[13, 8]]) }, 'E_ILLEGAL_ACTION'],
    ['정수 아닌 좌표', { roster: good.roster, pos: good.pos.slice(0, 13).concat([[13, 6.5]]) }, 'E_BAD_ENVELOPE'],
    ['문자열 아닌 로스터', { roster: good.roster.slice(0, 5).concat([7]), pos: good.pos }, 'E_BAD_ENVELOPE'],
  ];
  room._handleReady(0, true);
  ok(room.state === STATES.IN_PROGRESS, '대조군: 정상 배치 양측 ready → 시작');
  // 새 룸에서 음성 케이스
  const room2 = H.setupRoom(108);
  room2._handleSetup(1, H.makeSetup()); room2._handleReady(1, true);
  room2._handleSetup(0, good); // 좌석0 정상 배치(ready 아님) — 잘못된 재배치가 이 rawSetup을 덮지 않아야 한다
  for (const [label, msg, code] of cases) {
    const before = snap(room2);
    const res = room2._handleSetup(0, msg);
    ok(!res.ok && res.reason === code, `배치 거부(${label}) → ${code}: ` + JSON.stringify(res));
    ok(snap(room2) === before, `배치 거부(${label})는 rawSetup·placed·ready·revision 불변 (상대 ready 유지)`);
  }
  ok(room2.seats[1].ready === true && room2.state === STATES.SETUP, '잘못된 배치들이 상대 ready·룸 상태를 바꾸지 않음');
  // 잘못된 배치로는 절대 시작하지 않는다 — 배치 전 좌석은 ready 불가
  const room3 = H.setupRoom(109);
  room3._handleSetup(1, H.makeSetup()); room3._handleReady(1, true);
  room3._handleSetup(0, cases[0][1]);
  const r3 = room3._handleReady(0, true);
  ok(!r3.ok && r3.reason === 'E_ILLEGAL_ACTION' && room3.state === STATES.SETUP && !room3.engines, '거부된 배치만 보낸 좌석은 ready 불가 → 경기 미시작(무작위 대체 없음)');
  // 정상 배치는 그대로(좌석1 미러링) 반영되고 무작위 대체 로그가 없다
  for (const E of room.engines) {
    for (let p = 0; p < 2; p++) {
      const mine = E.S.pieces.filter((x) => x.owner === p);
      const exact = mine.every((x, i) => x.c === good.pos[i][1] && x.r === (p === 1 ? 14 - good.pos[i][0] : good.pos[i][0]));
      ok(exact && E.S.roster[p].join() === good.roster.join(), `제출 배치가 좌석${p} 엔진${E.NET.me}에 정확히 반영(좌석1 미러링)`);
    }
    ok(!E.S.log.some((l) => /배치 데이터 손상/.test(l.msg)), '무작위 대체("배치 데이터 손상") 로그 없음');
  }
}

// ===== P1 자기 말 별칭 — v3: heal에 뷰의 u-별칭을 보내면 수락·revision 증가하지만 healing/mainUsed 불변 =====
{
  const room = H.startedRoom(110);
  const T = room.engine;
  const cur = T.S.current, other = 1 - cur;
  const view = room.toSeatView(cur);
  const own = view.you.pieces.find((p) => p.type === 'minion');
  const real = T.S.pieces.find((p) => p.owner === cur && p.type === 'minion' && room._alias(p.id) === own.id);
  ok(!!real && /^u-/.test(own.id), '뷰의 자기 말 id는 불투명 별칭');
  // 원시 엔진 id(숫자·숫자 문자열)·상대 말 별칭·없는 별칭은 거부
  const oppAlias = room.toSeatView(other).you.pieces[0].id;
  for (const [label, a, code] of [
    ['원시 숫자 id', { t: 'heal', id: real.id }, 'E_BAD_ENVELOPE'],
    ['원시 id 문자열', { t: 'heal', id: String(real.id) }, 'E_ILLEGAL_ACTION'],
    ['상대 말 별칭', { t: 'heal', id: oppAlias }, 'E_ILLEGAL_ACTION'],
    ['없는 별칭', { t: 'heal', id: 'u-nonexist' }, 'E_ILLEGAL_ACTION'],
  ]) {
    const before = snap(room);
    const res = act(room, cur, a);
    ok(!res.ok && res.reason === code && snap(room) === before, `heal(${label}) → ${code}·불변: ` + JSON.stringify(res));
  }
  // 선택 일관성: 셀 클릭으로 선택한 말의 뷰 selected 별칭 == 같은 말의 pieces 별칭
  let res = act(room, cur, { t: 'cell', r: real.r, c: real.c });
  ok(res.ok && res.data.you.selected === own.id, '선택한 말의 you.selected 별칭이 pieces의 별칭과 같음');
  const rev = room.revision;
  res = act(room, cur, { t: 'heal', id: own.id });
  ok(res.ok && !res.noop && room.revision === rev + 1, '자기 말 별칭 heal 수락·revision +1: ' + JSON.stringify(res.reason));
  ok(room.engines.every((E) => byId(E, real.id).healing === true && E.S.mainUsed === true), '두 엔진 모두 healing=true·mainUsed=true');
  ok(res.data.you.pieces.find((p) => p.id === own.id).healing === true, '응답 뷰에 회복 자세 반영');
  // 로그 비공개 — 상대 뷰 로그에는 미공개 말의 이름이 실리지 않는다(v3 공용 로그 누출 회귀)
  const vOther = room.toSeatView(other);
  const hidden = !real.revealed;
  ok(hidden && !vOther.log.some((l) => l.msg.indexOf(real.name) !== -1), '상대 좌석 로그에 미공개 회복 말 이름 없음: ' + JSON.stringify(vOther.log.slice(-3)));
  ok(room.toSeatView(cur).log.some((l) => l.msg.indexOf(real.name) !== -1), '소유 좌석 로그에는 자기 말 이름으로 기록(원본 소유자 시점)');
  // 턴 종료 → 회복 틱: 상대 로그에 여전히 이름 없음
  act(room, cur, { t: 'endTurn' });
  ok(!room.toSeatView(other).log.some((l) => l.msg.indexOf(real.name) !== -1), '회복 틱 이후에도 상대 로그에 미공개 말 이름 없음');
}

// ===== P1 fleeSwap 별칭 — 도망 성공 후 교환 후보는 뷰 별칭으로 지정한다 =====
{
  const room = H.startedRoom(111);
  const T = room.engine;
  const cur = T.S.current, def = 1 - cur;
  // 전선에 가까운 말을 공격자로 — 후방 후보가 생긴다
  const att = T.S.pieces.filter((p) => p.owner === cur && p.type === 'minion').sort((a, b) => (cur === 0 ? a.r - b.r : b.r - a.r))[0];
  const dId = firstOf(T, def, 'minion').id;
  both(room, (E) => { E.BAL.fleeProb = 1; E.initBattle(byId(E, att.id), byId(E, dId)); });
  let res = act(room, cur, { t: 'flee' });
  ok(res.ok && !!T.S.fleePick && T.S.fleePick.owner === cur, '도망 성공 → 교환 선택(fleePick) 진입: ' + JSON.stringify(res.reason));
  if (T.S.fleePick && T.S.fleePick.cands.length) {
    const v = room.toSeatView(cur);
    ok(Array.isArray(v.fleePick.cands) && v.fleePick.cands.every((x) => /^u-/.test(x)), '소유자 뷰의 교환 후보는 별칭');
    ok(room.toSeatView(def).fleePick.cands === undefined, '상대 뷰에는 후보 없음');
    const realCand = T.S.fleePick.cands[0];
    for (const [label, a, code, seat] of [
      ['원시 id', { t: 'fleeSwap', id: String(realCand) }, 'E_ILLEGAL_ACTION', cur],
      ['상대 좌석', { t: 'fleeSwap', id: v.fleePick.cands[0] }, 'E_NOT_ACTOR', def],
      ['후보 아닌 자기 말', { t: 'fleeSwap', id: room._alias(att.id) }, 'E_ILLEGAL_ACTION', cur],
      ['교환 중 skipMain', { t: 'skipMain' }, 'E_ILLEGAL_ACTION', cur],
      ['교환 중 빈 칸 클릭', { t: 'cell', r: 7, c: 4 }, 'E_ILLEGAL_ACTION', cur],
    ]) {
      const before = snap(room);
      const r2 = act(room, seat, a);
      ok(!r2.ok && r2.reason === code && snap(room) === before, `fleeSwap(${label}) → ${code}·불변: ` + JSON.stringify(r2));
    }
    const target = byId(T, realCand);
    const tr = target.r, tc = target.c;
    res = act(room, cur, { t: 'fleeSwap', id: v.fleePick.cands[0] });
    ok(res.ok && !res.noop && room.engines.every((E) => !E.S.fleePick), '별칭 fleeSwap 수락 → 교환 선택 종료');
    ok(room.engines.every((E) => { const p = byId(E, att.id); return p.alive === false || (p.r !== att.r || p.c !== att.c) || (byId(E, realCand).r !== tr || byId(E, realCand).c !== tc); }), '교환이 실제 좌표에 반영');
  } else {
    ok(false, '픽스처가 후방 교환 후보를 만들지 못함');
  }
}

// ===== 보드 플레이 조건 — skipMain 중복·주 행동 전 endTurn·텔레포트 불가 =====
{
  const room = H.startedRoom(112);
  const T = room.engine;
  const cur = T.S.current;
  let before = snap(room);
  let res = act(room, cur, { t: 'endTurn' });
  ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, '주 행동 전 endTurn 거부·불변');
  before = snap(room);
  res = act(room, cur, { t: 'tele' });
  ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, '시작 직후(상대 진영에 말 없음) 텔레포트 거부·불변');
  res = act(room, cur, { t: 'skipMain' });
  ok(res.ok && T.S.mainUsed === true, 'skipMain 수락');
  before = snap(room);
  res = act(room, cur, { t: 'skipMain' });
  ok(!res.ok && snap(room) === before, '두 번째 skipMain 거부·불변');
  before = snap(room);
  res = act(room, cur, { t: 'cell', r: 0, c: 4 });
  ok(!res.ok && res.reason === 'E_ILLEGAL_ACTION' && snap(room) === before, '보드 밖 셀 거부·불변');
  // 판정 통과 + 상태 무변화 입력 = noop(성공이지만 revision 불변)
  const rev = room.revision;
  res = act(room, cur, { t: 'cell', r: 7, c: 4 }); // 선택 없음·빈 칸
  ok(res.ok && res.noop === true && room.revision === rev, '상태를 바꾸지 않는 합법 클릭은 noop — revision 불변: ' + JSON.stringify({ ok: res.ok, noop: res.noop }));
  res = act(room, cur, { t: 'endTurn' });
  ok(res.ok && T.S.current === 1 - cur, '주 행동 후 endTurn 수락·턴 교대');
  // 기권: 이제 current가 아닌 좌석
  before = snap(room);
  res = act(room, cur, { t: 'resign' });
  ok(!res.ok && res.reason === 'E_NOT_ACTOR' && snap(room) === before, '상대 턴 좌석의 action resign 거부·불변');
  const rev2 = room.revision;
  res = act(room, 1 - cur, { t: 'resign' });
  ok(res.ok && room.state === STATES.FINISHED && room.revision === rev2 + 1 && room.result.winner === cur, '기권 → FINISHED, revision 정확히 +1: ' + JSON.stringify({ rev: room.revision, rev2, result: room.result }));
}

// ===== P1 생명주기 — _finalize revision 정확히 1회, 시작 전 종료 뷰 phase, 능동 푸시 =====
{
  const room = H.setupRoom(113, { graceMs: 5000 });
  let notified = 0;
  room.onFinalize = () => { notified++; };
  const rev = room.revision;
  const res = room.explicitLeave(1);
  ok(res.ok && room.state === STATES.CANCELED && room.revision === rev + 1, 'SETUP leave → CANCELED, revision +1 정확히: ' + room.revision);
  ok(res.data.phase === 'canceled' && res.data.state === 'CANCELED', 'CANCELED 뷰 phase는 setup이 아니라 canceled: ' + JSON.stringify(res.data.phase));
  ok(notified === 0, '명령 경로 leave는 onFinalize 푸시 대신 명령 응답·상대 푸시(server.js)로 알린다');
  const again = room._finalize(STATES.CANCELED, null);
  ok(again === false && room.revision === rev + 1, '이미 종료된 룸의 재종료는 무시 — revision 불변');
  ok(room.toSeatView(0).phase === 'canceled', '상대 좌석 뷰도 canceled');
}
{
  const room = H.setupRoom(114, { graceMs: 5000 });
  let pushed = [];
  room.onFinalize = (state) => { pushed.push([state, room.revision, room.toSeatView(0).phase]); };
  const rev = room.revision;
  room.seats[1].connected = false;
  room._onGraceExpirePreStart(1);
  ok(room.state === STATES.CANCELED && room.revision === rev + 1, '유예 만료 CANCELED — revision +1 정확히: ' + (room.revision - rev));
  ok(pushed.length === 1 && pushed[0][0] === 'CANCELED' && pushed[0][1] === rev + 1 && pushed[0][2] === 'canceled', '유예 만료는 갱신된 revision·canceled 뷰로 1회 푸시: ' + JSON.stringify(pushed));
  room._onGraceExpirePreStart(1);
  ok(pushed.length === 1 && room.revision === rev + 1, '중복 만료 콜백은 재전이·재푸시 없음');
}
{
  const room = H.startedRoom(115);
  let pushed = 0;
  room.onFinalize = () => { pushed++; };
  const rev = room.revision;
  room.voidForRestart();
  ok(room.state === STATES.VOID && room.revision === rev + 1 && pushed === 1, 'VOID 전이 revision +1·푸시 1회');
  const v = room.toSeatView(0);
  ok(v.phase === 'void' && v.units.length === 0 && !v.you.pieces && room.engines === null, 'VOID 뷰 phase=void·보드 없음·엔진 해제');
  ok(act(room, 0, { t: 'skipMain' }).reason === 'E_ROOM_CLOSED', 'VOID 후 행동은 E_ROOM_CLOSED');
}
{
  const room = H.startedRoom(116);
  room.voidForRestart();
  const rev = room.revision;
  room.close();
  ok(room.state === STATES.VOID && room.revision === rev, '이미 VOID인 룸의 close()는 전이·revision 없음');
  const room2 = H.setupRoom(117);
  const rev2 = room2.revision;
  let p = 0; room2.onFinalize = () => { p++; };
  room2.close();
  ok(room2.state === STATES.CLOSED && room2.revision === rev2 + 1 && p === 1 && room2.toSeatView(1).phase === 'closed', 'SETUP 룸 close() → CLOSED, revision +1, 푸시 1회, phase=closed');
  ok(room2.seats.every((s) => s.ws.closed && s.ws.closed.code === 1000), 'close()는 좌석 소켓을 닫는다');
}
{
  // 경기 중 몰수(유예 만료) — FINISHED도 revision 정확히 +1, 결과 확정 후 VOID로 덮어쓰지 않음
  const room = H.startedRoom(118);
  let pushed = 0; room.onFinalize = () => { pushed++; };
  const rev = room.revision;
  room.seats[1].connected = false;
  room._onGraceExpireInProgress(1);
  ok(room.state === STATES.FINISHED && room.result.type === 'FORFEIT' && room.revision === rev + 1 && pushed === 1, '경기 중 유예 만료 FORFEIT — revision +1·푸시 1회');
  room.voidForRestart();
  ok(room.state === STATES.FINISHED && room.revision === rev + 1, '확정 결과는 VOID로 덮어쓰지 않음');
  ok(room.toSeatView(0).phase === 'over', 'FINISHED 뷰 phase=over(보드 유지)');
}
{
  // 참가 전이도 revision을 올린다 — 호스트 알림의 기준
  const room = new H.Room(119, { isPublic: true, epoch: 'aaaaaaaa' });
  room.openHostSeat(H.fakeWs());
  const rev = room.revision;
  const j = room.joinGuestSeat(H.fakeWs());
  ok(j.ok && room.state === STATES.SETUP && room.revision === rev + 1, 'OPEN→SETUP 참가 revision +1');
  const j2 = room.joinGuestSeat(H.fakeWs());
  ok(!j2.ok && room.revision === rev + 1, '두 번째 참가 실패는 revision 불변');
}

// ===== 엔진 장애 fail-closed — 콜백 예외는 룸을 VOID(E_INTERNAL)로 닫고 다른 룸은 계속 동작 =====
{
  const bad = H.startedRoom(120);
  const good = H.startedRoom(121);
  let pushed = 0; bad.onFinalize = () => { pushed++; };
  bad.engines[0].scheduler.setTimeout(() => { throw new Error('boom'); }, 10);
  const res = act(bad, bad.engine.S.current, { t: 'skipMain' });
  ok(!res.ok && res.reason === 'E_INTERNAL', '엔진 타이머 콜백 예외 → E_INTERNAL: ' + JSON.stringify(res));
  ok(bad.state === STATES.VOID && bad.result && bad.result.type === 'NO_CONTEST' && bad.result.reason === 'E_INTERNAL' && pushed === 1, '장애 룸은 VOID·NO_CONTEST·푸시 1회');
  ok(bad.lastFault && /boom/.test(bad.lastFault.message) && JSON.stringify(bad.toSeatView(0)).indexOf('boom') === -1, '장애 원인은 서버 진단(lastFault)에만 — 좌석 뷰에 없음');
  const r2 = act(good, good.engine.S.current, { t: 'skipMain' });
  ok(r2.ok && good.state === STATES.IN_PROGRESS, '다른 룸은 영향 없이 계속 동작');
}

done();
