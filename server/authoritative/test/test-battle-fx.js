'use strict';
// #217 전투 표시 이벤트(fx) 회귀 — battle-fx-protocol.md 제안 스키마의 순서·중복(재전송/resync)·유한 보관·
// 정보 은닉을 고정한다. engine.js가 이미 만들어지는 구조화 신호(FX.log·S.battle.msgQ)를 소비 직후 버려지기
// 전에 캡처만 하는지, room.js가 그것을 화이트리스트로만 재구성해 내려보내는지를 검증한다 — 규칙/RNG/인가는
// 이 스위트가 다루지 않는다(다른 스위트가 이미 고정).
const H = require('./helpers');
const { both, byId, act, STATES } = H;
const { ok, done } = H.makeCounter('battle-fx');

const MSG_FX_KEYS = new Set(['shake', 'sig', 'flash', 'ko', 'float', 'hp', 'st']);
const MSG_EVENT_KEYS = new Set(['seq', 'src', 'battleId', 'round', 'actSeq', 'key', 'big', 'txt', 'fx']);
const STAGE_EVENT_KEYS = new Set(['seq', 'src', 'battleId', 'turn', 'key', 'kind', 'title', 'sub', 'cls', 'cells', 'scene']);
const SCENE_SIDE_KEYS = new Set(['owner', 'type', 'element', 'bodyFight', 'rosterId', 'artRosterId']);

// T12 후속 REVISE(msg_08775b7992e3, PD 재지적 msg_91f8c67f6fd3) — PID(mkPiece의 `id:PID++`)는 작은 정수라
// fx JSON 전체에 대한 순진한 `.includes(id)` 부분 문자열 검색은 hp.val·seq·round·actSeq·turn·cells 좌표 등
// **무관한 숫자 안의 겹치는 자릿수**와 우연히 일치해 간헐적으로(관측 15~20%) 오탐 실패한다(예: id=3가 hp
// 37·seq 13·round 3턴 등과 충돌). 아래 두 헬퍼를 쓰되, **어느 쪽도 그 자체로는 "값 자체가 같은" 우연까지
// 막아 주지 않는다** — PD 지적대로 hidden.id=7일 때 정상 seq:7이나 hp.val:7은 숫자 경계 규약을 지킨 채로도
// 정확히 같은 값이라 `numberAppearsStandalone` 단독으로는 collision-free를 주장할 수 없다:
// 1) hasUnsafeIdKey — **구조적 화이트리스트** 검사. fx 이벤트/씬 스키마(위 *_KEYS)는 애초에 원시 id를 담을
//    키가 없다(rosterId/artRosterId/battleId만 있고 셋 다 문자열 종 코드이거나 룸 수명 카운터이지 숫자
//    PID가 아니다) — 이 검사는 **키 이름**만 보므로가 값의 우연한 숫자 겹침·일치와 무관하게 항상 참인
//    구조적 불변이다(진짜 collision-free).
// 2) numberAppearsStandalone — "37 안의 3·7"처럼 더 큰 수의 부분 문자열로 우연히 걸리는 것만 배제한다
//    (그 수가 JSON에서 독립된 토큰으로 나타날 때만 매치). **이것만으로는 부족**하다 — hp/seq/round 같은
//    합법적인 필드가 정확히 같은 정수 값을 가질 가능성은 여전히 남는다. 그래서 이 함수는 반드시 실제
//    hidden.id가 아니라, 아래 T12에서 만드는 **정상 게임 수치 범위 밖의 sentinel 값**(예: 900000001)에만
//    적용한다 — hp·seq·round·cells 등 어떤 합법 필드도 그런 자릿수에 도달하지 않으므로 그 조합에서만
//    비로소 collision-free가 성립한다(값 자체의 우연한 일치까지 구조적으로 배제).
const SAFE_ID_KEYS = new Set(['rosterId', 'artRosterId', 'battleId']); // rosterId/artRosterId=문자열 종 코드(§2.6.2 공개), battleId=룸 수명 단조 카운터(§4) — 셋 다 원시 PID가 아니라 이미 스키마로 허용된 값
function hasUnsafeIdKey(node) {
  if (Array.isArray(node)) return node.some(hasUnsafeIdKey);
  if (node && typeof node === 'object') {
    return Object.keys(node).some((k) => (/id$/i.test(k) && !SAFE_ID_KEYS.has(k)) || hasUnsafeIdKey(node[k]));
  }
  return false;
}
function numberAppearsStandalone(text, n) {
  return new RegExp('(^|[^0-9])' + n + '(?:[^0-9]|$)').test(text);
}

function battlePair(T, cur) {
  const other = 1 - cur;
  return {
    att: T.S.pieces.find((p) => p.owner === cur && p.type === 'minion' && p.alive).id,
    def: T.S.pieces.find((p) => p.owner === other && p.type === 'minion' && p.alive).id,
  };
}

function startBattle(room) {
  const T = room.engine;
  const cur = T.S.current;
  H.openBattle(room, battlePair(T, cur)); // #245 인접 전제를 실제로 만든 뒤 합법 경로로 연다(helpers.openBattle)
  return cur;
}

// 한쪽이 죽을 때까지(또는 안전 상한) 기본 공격만 반복해 실제 전투를 자연스럽게 끝낸다 — HP를 직접 조작하지 않는다.
function driveBattleToEnd(room, cap) {
  const T = room.engine;
  for (let i = 0; i < (cap || 60) && T.S.battle; i++) {
    const actor = T.netActor();
    const r = act(room, actor, { t: 'act', k: 0 });
    if (!r.ok) return r;
  }
  return { ok: true };
}

function assertEventShape(evt, label) {
  if (evt.src === 'msg') {
    ok(Object.keys(evt).every((k) => MSG_EVENT_KEYS.has(k)), label + ' msg 이벤트 키 화이트리스트 안: ' + JSON.stringify(Object.keys(evt)));
    ok(typeof evt.seq === 'number' && typeof evt.txt === 'string' && typeof evt.big === 'boolean', label + ' msg 필수 필드 타입');
    if (evt.fx) {
      ok(Object.keys(evt.fx).every((k) => MSG_FX_KEYS.has(k)), label + ' fx 서브필드 화이트리스트 안: ' + JSON.stringify(Object.keys(evt.fx)));
      if (evt.fx.float) {
        ok(typeof evt.fx.float.amount === 'number' && (evt.fx.float.sign === 'pos' || evt.fx.float.sign === 'neg'), label + ' float은 원시 {side,sign,amount} — HTML 아님');
        ok(!('html' in evt.fx.float), label + ' float에 원시 html 미포함');
      }
      ok(!('piece' in evt.fx) && !('hold' in evt.fx) && !('onStart' in evt.fx) && !('onEnd' in evt.fx), label + ' fx에 piece/hold/콜백 없음');
      for (const k of Object.keys(evt.fx)) ok(typeof evt.fx[k] !== 'function', label + ' fx.' + k + '는 함수가 아님');
    }
  } else if (evt.src === 'stage') {
    ok(Object.keys(evt).every((k) => STAGE_EVENT_KEYS.has(k)), label + ' stage 이벤트 키 화이트리스트 안: ' + JSON.stringify(Object.keys(evt)));
    ok(typeof evt.title === 'string' && typeof evt.sub === 'string', label + ' stage title/sub는 문자열');
    ok(!('hold' in evt), label + ' stage에 hold(원시 piece 참조) 없음');
    if ('battleId' in evt) ok(evt.battleId === null || Number.isInteger(evt.battleId), label + ' battleId는 정수 또는 null');
    if (evt.cells !== undefined) {
      ok(Array.isArray(evt.cells) && evt.cells.every((c) => Array.isArray(c) && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1])), label + ' cells는 [r,c] 숫자쌍 배열만');
    }
    if (evt.scene !== undefined && evt.scene !== null) {
      for (const sideKey of ['a', 'd']) {
        const s = evt.scene[sideKey];
        if (!s) continue;
        ok(Object.keys(s).every((k) => SCENE_SIDE_KEYS.has(k)), label + ' scene.' + sideKey + ' 키 화이트리스트 안: ' + JSON.stringify(Object.keys(s)));
        ok(!('skills' in s) && !('cap' in s) && !('hp' in s) && !('id' in s), label + ' scene에 skills/cap/hp/raw id 없음');
      }
    }
  } else {
    ok(false, label + ' 알 수 없는 src: ' + evt.src);
  }
}

// ===== 1) 순서·모양 — 실제 공격 한 번이 만드는 이벤트 시퀀스 =====
{
  const room = H.startedRoom(950);
  const cur = startBattle(room);
  // PR239 CI battle-fx447pass1fail — 이 절은 "실제 타격(damageFx+float)이 만들어진다"만 보고 회피·치명타
  // 자체는 다루지 않는다(그건 다른 스위트 소관). rand() 기반 회피(①, 상한 40%)가 기본 아키타입 dodge(5~10%)
  // 확률로 이번 첫 공격을 회피로 만들면 fx.float가 아예 생기지 않아 간헐적으로 실패했다. 두 전투원의
  // dodge/evadeBuff를 0으로 고정해 회피 판정(rand()<0)이 항상 거짓이 되게 해 첫 공격이 반드시 명중하게
  // 만든다 — 피해량 자체(치명타 여부·분산 roll)는 그대로 rand()에 맡겨 이 절이 검증하는 것 이상을 고정하지 않는다.
  both(room, (E) => { const B = E.S.battle; B.fa.dodge = 0; B.fa.evadeBuff = 0; B.fd.dodge = 0; B.fd.evadeBuff = 0; });
  const r = act(room, cur, { t: 'act', k: 0 });
  ok(r.ok, '공격 행동 수락: ' + JSON.stringify(r.reason));
  const fx = room.toSeatView(cur).fx;
  ok(fx.events.length > 0, '공격 한 번으로 fx 이벤트가 생성됨: ' + fx.events.length);
  ok(fx.firstSeq === fx.events[0].seq && fx.lastSeq === fx.events[fx.events.length - 1].seq, 'firstSeq/lastSeq가 창의 첫/끝 seq와 일치');
  for (let i = 1; i < fx.events.length; i++) {
    ok(fx.events[i].seq === fx.events[i - 1].seq + 1, '엔진당 seq는 빈틈없이 1씩 증가: ' + fx.events[i - 1].seq + '→' + fx.events[i].seq);
  }
  ok(fx.events.some((e) => e.src === 'msg' && e.key === 'damageFx' && e.fx && e.fx.float), '실제 타격 신호(damageFx + float) 포함');
  ok(fx.events.some((e) => e.src === 'stage'), '무대 배너(turnBanner/contactBanner 등) 포함');
  for (const e of fx.events) assertEventShape(e, 'T1');
  ok(fx.events.every((e) => e.src !== 'msg' || (e.round != null && e.actSeq != null)), 'msg 이벤트는 round/actSeq를 동반');
}

// ===== 2) 종료 직후 battle=null에도 결과·마지막 타격이 남는다 (room은 IN_PROGRESS 유지) =====
{
  const room = H.startedRoom(951);
  startBattle(room);
  const r = driveBattleToEnd(room);
  ok(r.ok, '전투가 실제로 끝날 때까지 공격 반복 성공');
  const v = room.toSeatView(0);
  ok(v.battle === null, '전투 종료 후 battle=null');
  ok(room.state === STATES.IN_PROGRESS, '한 전투만 끝난 것 — 매치는 계속 IN_PROGRESS: ' + room.state);
  ok(v.fx.events.length > 0, 'battle=null이어도 fx.events는 비지 않음');
  ok(v.fx.events.some((e) => e.src === 'stage' && e.kind === 'result'), '승패 결과 배너(resultBanner) 이벤트 보존');
  ok(v.fx.events.some((e) => e.src === 'msg' && /쓰러졌다|즉사/.test(e.txt)), '마지막 타격/KO 문구 이벤트 보존');
}

// ===== 3) 엔진이 완전히 사라져도(VOID) 마지막 fx 창은 Room._fxCache로 남는다 =====
{
  const room = H.startedRoom(952);
  const cur = startBattle(room);
  act(room, cur, { t: 'act', k: 0 });
  const before = room.toSeatView(cur).fx;
  ok(before.events.length > 0, 'VOID 前 fx 존재');
  room._finalize(STATES.VOID, { type: 'NO_CONTEST', winner: null }, {});
  ok(room.engines === null, '_finalize(VOID)가 실제로 engines를 비움(전제 확인)');
  const after = room.toSeatView(cur);
  ok(after.state === STATES.VOID, 'room 상태는 VOID');
  ok(JSON.stringify(after.fx) === JSON.stringify(before), 'engines가 사라져도 동일한 fx 창이 그대로 재사용됨(Room._fxCache)');
}

// ===== 4) 재전송/resync 안전성 — 같은 상태를 다시 읽어도 seq·내용이 재계산되지 않는다(중복 재생 방지 전제) =====
{
  const room = H.startedRoom(953);
  const cur = startBattle(room);
  act(room, cur, { t: 'act', k: 0 });
  const v1 = room.toSeatView(cur).fx;
  const v2 = room.toSeatView(cur).fx; // 새 행동 없이 재조회(= resync/dedup 재전송과 같은 조건)
  ok(JSON.stringify(v1) === JSON.stringify(v2), '행동 없이 재조회하면 seq·이벤트가 완전히 동일 — 재생 시 중복 없음');
  const v3 = room.handleCommand(cur, { t: 'resync' });
  ok(v3.ok && v3.noop === true, 'resync 명령은 noop');
  ok(JSON.stringify(v3.data.fx) === JSON.stringify(v1), 'resync 응답의 fx도 직전 창과 동일(새 seq를 만들어내지 않음)');
}

// ===== 5) 좌석별 독립 — 두 엔진(좌석)의 fx는 서로 다른 카운터·시점 텍스트를 가진다 =====
// PD 지적(msg_467892193706): mineText/otherText가 없으면 검사를 조용히 생략하던 것을 고쳐 존재 자체를 먼저 단언한다.
{
  const room = H.startedRoom(954);
  const cur = startBattle(room);
  act(room, cur, { t: 'act', k: 0 });
  const f0 = room.toSeatView(0).fx, f1 = room.toSeatView(1).fx;
  ok(f0.events.length > 0 && f1.events.length > 0, '양쪽 좌석 모두 자기 엔진 기준 fx를 받는다');
  ok(f0.events.length === f1.events.length, '같은 action이 두 엔진에 동일하게 적용되므로 이벤트 개수는 같다(구조 동형)');
  const mineText = f0.events.find((e) => e.key === 'turnBanner');
  const otherText = f1.events.find((e) => e.key === 'turnBanner');
  ok(!!mineText && !!otherText, 'T5 전제: 두 좌석 모두 turnBanner 이벤트를 실제로 만들어냄(없으면 이하 검사가 무의미) — 없으면 이 fixture부터 실패해야 한다: ' + JSON.stringify([!!mineText, !!otherText]));
  ok(mineText.title !== otherText.title, '같은 실제 전환에 대해 두 좌석의 문구가 서로 다르다(거울 — 텍스트를 그대로 복제 전송하지 않음)');
  ok(mineText.title === '나의 턴!' || otherText.title === '나의 턴!', '둘 중 정확히 그 턴의 좌석 쪽에만 "나의 턴!"이 붙는다: ' + JSON.stringify([mineText.title, otherText.title]));
}

// ===== 6) 유한 보관 — 40개를 넘으면 오래된 항목을 버리고 최근 창만 유지한다 =====
// PD 지적: lastSeq>40 fixture 전제를 검사 없이 통과시키던 것을 고쳐, 실제로 40을 넘을 때까지 전투를 반복하고
// 넘기지 못하면(픽스처 결함) 이 블록 자체가 실패하게 한다.
{
  const room = H.startedRoom(955);
  let fx = null;
  for (let round = 0; round < 12; round++) {
    const T = room.engine;
    const alive = T.S.pieces.filter((p) => p.alive && p.placed && p.type === 'minion');
    const mine = alive.find((p) => p.owner === 0), theirs = alive.find((p) => p.owner === 1);
    if (!mine || !theirs) break; // 한쪽 하수인이 전멸 — 더 전투를 못 만든다(아래에서 lastSeq 전제로 감지)
    H.openBattle(room, { att: mine.id, def: theirs.id });
    driveBattleToEnd(room, 60);
    fx = room.toSeatView(0).fx;
    if (fx.lastSeq > 40) break;
  }
  ok(!!fx && fx.lastSeq > 40, 'T6 전제: 반복 전투로 실제 40개 초과 발급 — 아니면 유한 보관 검사 자체가 무의미: lastSeq=' + (fx && fx.lastSeq));
  ok(fx.events.length <= 40, '내부 보관 상한(40)을 넘지 않음: ' + fx.events.length);
  ok(fx.firstSeq === fx.lastSeq - fx.events.length + 1, '오래된 이벤트가 잘려나가면 firstSeq가 그만큼 전진(빈틈 없는 최근 창)');
  ok(fx.firstSeq > 1, '40개를 넘긴 뒤에는 최초 이벤트(seq=1)가 더 이상 창에 없음 — 유한 보관 확인');
}

// #217 PD REVISE(msg_c0657afb7242) 대응 회귀 — 아래부터 신규.
function resolveSyncModals(room, seatHint, maxSteps) {
  for (let i = 0; i < (maxSteps || 5); i++) {
    const v = room.toSeatView(seatHint);
    if (!v.modal) return;
    const r = act(room, v.modal.owner, { t: 'modal', seq: v.modal.seq, i: 0 });
    if (!r.ok) throw new Error('sync modal 진행 실패: ' + JSON.stringify(r));
  }
}

// ===== 7) battleStart 선언적 이벤트 — headless에서도 fxPlay가 아예 안 불리는 countStep을 대신한다 =====
{
  const room = H.startedRoom(956);
  const cur = startBattle(room);
  const fx = room.toSeatView(cur).fx; // initBattle 직후 즉시(첫 act 이전에도) 존재해야 한다
  const starts = fx.events.filter((e) => e.key === 'battleStart');
  ok(starts.length === 1, 'initBattle 한 번에 battleStart 정확히 1회: ' + starts.length);
  const bs = starts[0];
  ok(bs.src === 'stage' && bs.kind === 'count', 'battleStart는 stage/count');
  ok(Number.isInteger(bs.battleId) && bs.battleId > 0, 'battleStart에 유효한 battleId');
  ok(bs.scene && bs.scene.a && bs.scene.d, 'battleStart에 공개 scene(a/d) 동봉');
  ok(bs.scene.a.type === 'minion' && bs.scene.d.type === 'minion' && bs.scene.a.bodyFight === true, 'scene 필드는 본체 출전 하수인 정체(이미 §2.6.1로 공개된 값)');
  assertEventShape(bs, 'T7');
}

// ===== 8) roundBanner — headless에서도 원본과 같은 (round,phase) 전환마다, 좌석별 거울 문구로 재생된다 =====
{
  const room = H.startedRoom(957);
  const cur = startBattle(room), other = 1 - cur;
  act(room, cur, { t: 'act', k: 0 }); // A-phase 소진 → D-phase 배너
  act(room, other, { t: 'act', k: 0 }); // D-phase 소진 → round 2 배너
  const f0 = room.toSeatView(0).fx, f1 = room.toSeatView(1).fx;
  const rb0 = f0.events.filter((e) => e.key === 'roundBanner');
  const rb1 = f1.events.filter((e) => e.key === 'roundBanner');
  ok(rb0.length >= 3 && rb0.length === rb1.length, 'round 1(A-phase)·round 1(D-phase)·round 2 진입까지 최소 3개, 양쪽 좌석 개수 동일: ' + rb0.length);
  ok(rb0.every((e) => e.sub.startsWith('Round ')), 'roundBanner sub는 "Round N / max" 형식');
  ok(new Set(rb0.map((e) => e.sub)).size >= 2, '라운드가 실제로 진행되며 sub(Round N/max)가 바뀜: ' + JSON.stringify(rb0.map((e) => e.sub)));
  for (let i = 0; i < rb0.length; i++) {
    const mine = rb0[i].title === '나의 턴!', theirs = rb1[i].title === '나의 턴!';
    ok(mine !== theirs, '같은 전환에 대해 두 좌석 중 정확히 한쪽만 "나의 턴!"(거울): ' + JSON.stringify([rb0[i].title, rb1[i].title]));
    ok(rb0[i].cls === (mine ? 'mine' : undefined) || (!mine && rb0[i].cls === undefined), 'cls는 자기 턴일 때만 "mine"');
  }
  for (const e of rb0.concat(rb1)) assertEventShape(e, 'T8');
}

// ===== 9) 연속 전투 — battleId가 매번 새로 발급되고, 새 전투 이후 이벤트에 옛 battleId가 다시 붙지 않는다 =====
{
  const room = H.startedRoom(958);
  // 서버 엔진 rand()는 기본 미시드(Math.random)라 첫 전투 길이가 매번 다르다. 길어지면 fx 유한 보관
  // (engine.js FX_RETAIN=40)이 첫 battleStart를 밀어내 starts.length가 1이 된다(PR239 CI B 실패, 로컬 약 2.7%).
  // 이 절은 battleId 단조성만 보므로 시드를 고정해 전투 길이를 결정적으로 만든다(고정 시 fx 32개 < 40).
  both(room, (E) => { E.setSeed(12345); });
  startBattle(room);
  /* #235: 시너지가 켜지면 첫 전투가 내는 fx 가 어느 시드에서든 유한 보관(engine.js FX_RETAIN=40)을 넘어
     첫 battleStart 가 창 밖으로 밀린다. 그래서 첫 battleStart 는 **발급된 그 자리에서** 집어 둔다 —
     이 절이 보는 것은 battleId 의 단조성이지 보관 창 크기가 아니므로 검사 강도는 그대로다. */
  const start1 = room.toSeatView(0).fx.events.filter((e) => e.key === 'battleStart').pop();
  ok(!!start1, '첫 initBattle 이 battleStart 를 발급했음');
  driveBattleToEnd(room, 60);
  const T = room.engine;
  const remaining = T.S.pieces.filter((p) => p.alive && p.placed && p.type === 'minion');
  const byOwner = { 0: remaining.filter((p) => p.owner === 0), 1: remaining.filter((p) => p.owner === 1) };
  ok(byOwner[0].length && byOwner[1].length, '두 번째 전투를 시작할 살아있는 하수인이 양쪽에 남아 있음(픽스처 전제)');
  H.openBattle(room, { att: byOwner[0][0].id, def: byOwner[1][0].id });
  const afterStart = room.toSeatView(0).fx;
  const b2 = afterStart.events.filter((e) => e.key === 'battleStart').pop();
  ok(!!b2 && b2.seq > start1.seq, '두 번째 initBattle 로 battleStart 가 하나 더 생김: ' + JSON.stringify([start1 && start1.seq, b2 && b2.seq]));
  ok(!!b2 && b2.battleId === start1.battleId + 1, '두 번째 battleId는 첫 번째보다 정확히 1 큼(룸 수명 동안 유일·단조): ' + JSON.stringify([start1 && start1.battleId, b2 && b2.battleId]));
  const leaking = afterStart.events.filter((e) => e.seq > b2.seq && e.battleId === start1.battleId);
  ok(leaking.length === 0, '두 번째 battleStart 이후 이벤트에 첫 전투(battleId=' + start1.battleId + ')가 다시 붙지 않음');
}

// ===== 10) resultBanner — battle=null이 된 뒤에도 scene을 동봉해 "어느 무대에 마지막 타격을 그릴지" 알 수 있다 =====
{
  const room = H.startedRoom(959);
  startBattle(room);
  driveBattleToEnd(room);
  const v = room.toSeatView(0);
  ok(v.battle === null, '전투 종료 후 battle=null(전제)');
  const result = v.fx.events.filter((e) => e.key === 'resultBanner');
  ok(result.length === 1, 'resultBanner 정확히 1회: ' + result.length);
  ok(result[0].scene && result[0].scene.a && result[0].scene.d, 'battle=null 이후에도 resultBanner에 scene 동봉 — 마지막 타격을 그릴 무대 식별 가능');
  ok(Number.isInteger(result[0].battleId), 'resultBanner도 그 전투의 battleId를 그대로 유지');
}

// ===== 11) 좌석별 프라이버시 — 포획 대리 출전(vipChoice) 상황에서도 scene에 cap/미공개 기술/raw id가 새지 않는다 =====
{
  const room = H.startedRoom(960);
  const T = room.engine;
  const ally0 = T.S.pieces.find((p) => p.owner === 0 && p.type === 'ally');
  const king1 = T.S.pieces.find((p) => p.owner === 1 && p.type === 'king');
  const rd = T.ROSTER[3];
  both(room, (E) => {
    const a0 = byId(E, ally0.id);
    a0.cap = { element: rd.element, hp: rd.hp, maxHp: rd.hp, atk: rd.atk, skillAtk: rd.skill, cd: 0, cdMax: rd.cd,
      skills: E.archSkills(rd.arch, rd.element), cds: [0, 0, 0, 0], revealedSkills: [], rosterId: rd.id, artRosterId: rd.id };
  });
  H.openBattle(room, { att: ally0.id, def: king1.id });
  const v0Pre = room.toSeatView(0);
  ok(v0Pre.modal && v0Pre.modal.owner === 0 && v0Pre.modal.count === 2, '동료+포획 하수인 보유: 본체/대리 2지선다 모달(전제)');
  act(room, v0Pre.modal.owner, { t: 'modal', seq: v0Pre.modal.seq, i: 1 }); // "포획 하수인 … 출전" 선택
  resolveSyncModals(room, 0);
  const v0 = room.toSeatView(0), v1 = room.toSeatView(1);
  ok(!!v0.battle && v0.battle.a.bodyFight === false, '대리 출전으로 battle 시작(전제)');
  const bs = v0.fx.events.find((e) => e.key === 'battleStart');
  ok(!!bs, '대리 출전 전투도 battleStart를 만든다');
  ok(bs.scene.a.bodyFight === false && bs.scene.a.artRosterId === rd.id && bs.scene.a.rosterId === null,
    'scene도 battle.a와 동일 계약 — 대리 출전은 artRosterId만, rosterId는 null: ' + JSON.stringify(bs.scene.a));
  ok(bs.scene.a.type === 'ally', 'scene.type은 원 소유 말(ally) 유지 — battle.a.type과 동일 계약');
  const raw = JSON.stringify(v0.fx) + JSON.stringify(v1.fx);
  ok(!/"cap"/.test(raw), 'fx 전체(양 좌석)에 cap 필드 자체가 없음');
  ok(!/"skills"/.test(raw), 'fx 전체에 skills 필드 자체가 없음(scene은 정체만, msg fx는 shake/float/hp/st만)');
  ok(!raw.includes(rd.id + '"') || raw.includes('"artRosterId":"' + rd.id + '"'), 'roster id가 나온다면 오직 artRosterId 경로로만(원본 battle.a와 동일 노출 경계)');
  for (const e of v0.fx.events.concat(v1.fx.events)) assertEventShape(e, 'T11');
}

// ===== 12) 실제 상황에서의 미공개 상대 정보 부재 — PD 지적(msg_467892193706): 키 모양 화이트리스트만으로
// 프라이버시를 "증명"하지 말고, 전투에 관여하지 않는 실제 미공개 상대 하수인의 식별자·기술이 그 좌석의 fx
// 전체(문자열)에 단 하나도 없는지 실측한다. seed도 함께 확인한다(A4 전례 — test-room.js와 동일 관례).
{
  const room = H.startedRoom(961);
  const T0 = room.engines[0];
  const enemyMinions = T0.S.pieces.filter((p) => p.owner === 1 && p.type === 'minion' && p.alive);
  ok(enemyMinions.length >= 2, 'T12 전제: 상대 하수인이 최소 2기(하나는 전투, 하나는 미공개로 남겨 대조) — ' + enemyMinions.length);
  const fighter = enemyMinions[0], hidden = enemyMinions[1];
  ok(fighter.rosterId !== hidden.rosterId, 'T12 전제: 전투에 쓸 개체와 숨겨 둘 개체는 서로 다른 종(rosterId 충돌 없이 검사 가능): ' + JSON.stringify([fighter.rosterId, hidden.rosterId]));
  const myMinion = T0.S.pieces.find((p) => p.owner === 0 && p.type === 'minion' && p.alive && p.id !== fighter.id);
  ok(!!myMinion, 'T12 전제: 좌석0 자기 하수인 존재');
  const v0Before = room.toSeatView(0);
  const hiddenSeen = v0Before.units.find((u) => 'rosterId' in u); // A/B 등급은 rosterId 필드 자체가 없어야 함(전제 재확인)
  ok(!hiddenSeen, 'T12 전제: 아직 미공개인 상대 유닛에는 rosterId 필드 자체가 없음(§2.6.1 — battle-fx 이전부터 참인 전제)');
  // REVISE(msg_08775b7992e3) — hidden의 실제 PID(mkPiece `id:PID++`)는 hp/dmg 값과 같은 작은 정수 구간을
  // 공유해, "독립된 숫자로도" 정확히 같은 값이 우연히 나올 확률이 0이 아니다(관측: 20회 중 1회, id=44가 hp
  // 44와 정확히 값 일치). 그 우연조차 배제하려고 hidden의 id를 **양 엔진에 동일하게(락스텝 유지)** 절대
  // 나올 수 없는 sentinel 값으로 바꿔치기한다 — 스킬 판정·소유자·타입 등 게임 로직은 id 값 자체를 쓰지
  // 않으므로 이후 흐름에 영향이 없다. 이 sentinel과의 값 일치만 검사하면 hp/round/seq/cells의 정상 범위와
  // 절대 겹치지 않는다(collision-free by construction).
  const hiddenOriginalId = hidden.id;
  const HIDDEN_ID_SENTINEL = 900000001; // 정상 게임에서 나올 수 없는 자리수 — hp/seq/round/cells와 값으로도 절대 겹치지 않음
  both(room, (E) => { const h = E.S.pieces.find((p) => p.id === hiddenOriginalId); if (h) h.id = HIDDEN_ID_SENTINEL; });
  H.openBattle(room, { att: myMinion.id, def: fighter.id });
  driveBattleToEnd(room, 60);
  const v0 = room.toSeatView(0);
  const rawFx0 = JSON.stringify(v0.fx);
  // 원시 id 부재는 이제 두 겹으로 확인한다: 스키마에 애초에 그런 키가 없다는 구조적 사실(hasUnsafeIdKey,
  // 값의 우연한 자릿수·값 일치와 전혀 무관)과, hidden의 (sentinel로 치환된) id 값이 fx 어디에도 "독립된
  // 숫자"로 나타나지 않는다는 사실(numberAppearsStandalone) — 종전의 `rawFx0.includes(hidden.id)`가
  // 만들던 간헐적 오탐(관측 15~20%, 부분 문자열 겹침 + 드물게 값 자체 일치)을 둘 다 제거한다. 부정 검증
  // (음성 통제)과 아래 rosterId/skills/seed/cap 양성 대조 통제는 그대로 유지한다.
  ok(!hasUnsafeIdKey(v0.fx), 'T12: fx 이벤트 구조에 원시 id 계열 키 자체가 없음(화이트리스트 스키마상 애초에 나올 수 없음 — rosterId/artRosterId/battleId만 허용)');
  ok(!numberAppearsStandalone(rawFx0, HIDDEN_ID_SENTINEL), 'T12: 미공개 상대 하수인의 원시 id(sentinel ' + HIDDEN_ID_SENTINEL + '로 치환)가 fx 문자열에 독립된 숫자로도 나타나지 않음(hp/seq/round/cells 등과 값으로도 절대 겹치지 않는 sentinel)');
  ok(!hidden.rosterId || !rawFx0.includes('"' + hidden.rosterId + '"'), 'T12: 미공개 상대 하수인의 rosterId(종)가 fx 문자열 어디에도 없음: ' + hidden.rosterId);
  if (hidden.name) ok(!rawFx0.includes(hidden.name), 'T12: 미공개 상대 하수인의 이름이 fx 문자열 어디에도 없음');
  if (Array.isArray(hidden.skills)) {
    for (const sid of hidden.skills) ok(!rawFx0.includes('"' + sid + '"'), 'T12: 미공개 상대 하수인의 기술 id(' + sid + ')가 fx 문자열에 없음');
  }
  ok(!/seed/i.test(rawFx0), 'T12: fx 문자열 어디에도 seed 키가 없음(A4 관례와 동일)');
  ok(!/"cap"\s*:/.test(rawFx0), 'T12: fx 문자열에 cap 필드 자체가 없음');
  ok(rawFx0.includes(fighter.rosterId), 'T12 대조군: 실제 이번 전투에서 싸운 개체의 rosterId는(이미 §2.6.2로 공개) 정상적으로 보임 — 검사 자체가 유효함을 확인');
}

// ===== 13) explosion/trap cells 훅 계약(PD REVISE msg_16e693d42efe) — 서버가 non-enumerable 큐를 설치하고,
// Mars(demo)는 guard된 push만 한다는 계약을 고정한다. 여러 항목이 한 번에 쌓여도(연쇄 폭발) 순서대로 각각
// 별도 이벤트가 되고, 이미 확정된(seq가 붙은) 이전 이벤트는 그 값이 절대 바뀌지 않는다. =====
{
  const room = H.startedRoom(962);
  const T = room.engine;
  both(room, () => {}); // withEngine을 한 번 이상 거쳐야 설치된다(§ensureFxCapture — netStart 직후 아직 S가 없어 그 첫 호출에선 설치되지 않는 lazy 계약)
  ok(Array.isArray(T.S.__ddFxCells), 'T13: 서버가 S에 __ddFxCells 배열을 설치함(Mars 훅 없이도 항상 존재)');
  ok(!Object.keys(T.S).includes('__ddFxCells'), 'T13: __ddFxCells는 non-enumerable — JSON.stringify(S)·_stateFingerprint에 안 잡힘');
  ok(JSON.stringify(T.S).indexOf('ddFxCells') === -1, 'T13: 실제 JSON.stringify(S) 결과에도 흔적이 없음');

  const beforeFx = room.toSeatView(0).fx;
  const beforeSnapshot = JSON.stringify(beforeFx.events); // 이미 확정된 이전 이벤트들의 스냅샷
  // Mars가 실제로 추가할 guard된 push를 그대로 재현 — 한 action 안에서 폭발이 두 번(연쇄) 발생했다고 가정
  both(room, (E) => {
    if (Array.isArray(E.S.__ddFxCells)) {
      E.S.__ddFxCells.push({ key: 'explosion', cells: [[3, 4]] });
      E.S.__ddFxCells.push({ key: 'trapFx', cells: [[5, 6], [5, 7]] });
    }
  });
  const afterFx = room.toSeatView(0).fx;
  ok(afterFx.events.length === beforeFx.events.length + 2, 'T13: 큐에 쌓인 두 항목이 각각 별도 이벤트로 나뉘어 추가됨(결합해 하나로 뭉개지지 않음)');
  ok(JSON.stringify(afterFx.events.slice(0, beforeFx.events.length)) === beforeSnapshot, 'T13: 이미 확정된 이전 이벤트 내용은 전혀 바뀌지 않음(불변)');
  const added = afterFx.events.slice(beforeFx.events.length);
  ok(added[0].key === 'explosion' && added[1].key === 'trapFx', 'T13: 큐에 넣은 순서 그대로 이벤트화됨(연쇄를 순서대로 결합)');
  ok(JSON.stringify(added[0].cells) === JSON.stringify([[3, 4]]) && JSON.stringify(added[1].cells) === JSON.stringify([[5, 6], [5, 7]]),
    'T13: cells 값이 큐에 넣은 그대로(가공 없이) 실림');
  ok(added.every((e) => e.seq === added[0].seq + added.indexOf(e)), 'T13: 두 이벤트 모두 새 seq를 받음(재사용 없음)');
  ok(T.S.__ddFxCells.length === 0, 'T13: 소비 후 큐는 즉시 비워짐(다음 action에 남아 재생되지 않음)');
  for (const e of added) assertEventShape(e, 'T13');
}

// ===== 14) explosion/trap — 실제 demo/index.html 훅(2026-09-13 Mars 반영, index.html:2792·2796) 경유
// end-to-end. 합성이 아니라 진짜 explosionFx()/trapFxPlay() 호출로 cells가 실제로 실리는지, 그리고
// FX.log 경로와 cells 큐 경로가 같은 실제 사건을 두 번 이벤트화(중복)하지 않는지 고정한다(2026-09-13
// 실측으로 발견해 hookFxLog에서 explosion/trapFx를 건너뛰도록 고친 회귀). =====
{
  const room = H.startedRoom(963);
  const T = room.engine;
  const bomb = T.S.pieces.find((p) => p.type === 'bomb' && p.owner === 0);
  const enemyMinion = T.S.pieces.find((p) => p.type === 'minion' && p.owner === 1);
  ok(!!bomb && !!enemyMinion, 'T14 전제: 좌석0 폭탄·좌석1 하수인 존재');
  H.openBattle(room, { att: bomb.id, def: enemyMinion.id });
  const fx = room.toSeatView(0).fx;
  const explosions = fx.events.filter((e) => e.key === 'explosion');
  ok(explosions.length === 1, 'T14: 실제 폭탄 접촉 1회 = explosion 이벤트 정확히 1개(FX.log 경로와 cells 큐 경로가 중복 생성하지 않음): ' + explosions.length);
  ok(!!explosions[0] && JSON.stringify(explosions[0].cells) === JSON.stringify([[bomb.r, bomb.c], [enemyMinion.r, enemyMinion.c]]),
    'T14: 실제 폭탄·피격 하수인의 좌표가 그대로 cells에 실림(가공·추측 없음)');
  assertEventShape(explosions[0], 'T14');
}
{
  const room = H.startedRoom(964);
  const T = room.engine;
  const trap = T.S.pieces.find((p) => p.type === 'trap' && p.owner === 0);
  const enemyMinion = T.S.pieces.find((p) => p.type === 'minion' && p.owner === 1);
  ok(!!trap && !!enemyMinion, 'T14 전제: 좌석0 함정·좌석1 하수인 존재');
  H.openBattle(room, { att: enemyMinion.id, def: trap.id });
  const fx = room.toSeatView(0).fx;
  const traps = fx.events.filter((e) => e.key === 'trapFx');
  ok(traps.length === 1, 'T14: 실제 함정 발동 1회 = trapFx 이벤트 정확히 1개(중복 없음): ' + traps.length);
  ok(!!traps[0] && JSON.stringify(traps[0].cells) === JSON.stringify([[trap.r, trap.c], [enemyMinion.r, enemyMinion.c]]),
    'T14: 실제 함정·걸린 말의 좌표가 그대로 cells에 실림');
  assertEventShape(traps[0], 'T14');
}

// ===== 15) [REVISE 회귀] Saturn P1 startedRoom(1874205) — 실제 원인(explosion)이 결과(resultBanner)보다
// 먼저 기록된다. 폭탄 접촉이 곧장 전멸(경기 종료)로 이어지는 실전 시나리오를 재현한다: 상대(owner1)의
// 나머지 전투 가능 말을 모두 제거해 두고 실제 initBattle(bomb,victim)을 호출한다(합성이 아니라 진짜
// bombAttack→explosionFx→checkWipe→gameOver 경로). =====
{
  const room = H.startedRoom(1874205);
  const T = room.engine;
  const bomb = T.S.pieces.find((p) => p.type === 'bomb' && p.owner === 0);
  const victim = T.S.pieces.find((p) => p.type === 'minion' && p.owner === 1 && p.alive);
  ok(!!bomb && !!victim, 'T15 전제: 좌석0 폭탄·좌석1 하수인 존재');
  both(room, (E) => {
    for (const p of E.S.pieces) {
      if (p.owner === 1 && p.alive && p.placed && (p.type === 'minion' || p.type === 'ally') && p.id !== victim.id) p.alive = false;
    }
  });
  H.openBattle(room, { att: bomb.id, def: victim.id });
  const fx = room.toSeatView(0).fx;
  const explosion = fx.events.find((e) => e.key === 'explosion');
  const result = fx.events.find((e) => e.key === 'resultBanner');
  ok(!!explosion, 'T15 전제: 실제 폭탄 접촉으로 explosion 이벤트 생성');
  ok(!!result, 'T15 전제: 이 접촉이 전멸을 유발해 resultBanner(경기 결과)도 함께 생성됨');
  ok(explosion.seq < result.seq, 'T15: 실제 원인(explosion)이 결과(resultBanner)보다 먼저 기록됨: explosion seq=' + explosion.seq + ' result seq=' + result.seq);
  for (const e of fx.events) assertEventShape(e, 'T15');
}

// ===== 16) [REVISE 회귀] Saturn P1 startedRoom(1874206) — 정상 종료된 전투의 resultBanner 이후, 완전히
// 무관한 사유(별도 gameOver)로 난 resultBanner에는 옛 battleId/scene이 붙지 않는다(그 결과가 실제로 그
// 전투에서 유래했을 때만 문맥을 잇는다). =====
{
  const room = H.startedRoom(1874206);
  startBattle(room);
  const r = driveBattleToEnd(room);
  ok(r.ok, 'T16 전제: 실제 전투가 정상 종료');
  const before = room.toSeatView(0).fx;
  const firstResult = before.events.filter((e) => e.key === 'resultBanner');
  ok(firstResult.length === 1 && Number.isInteger(firstResult[0].battleId), 'T16 전제: 정상 종료 resultBanner는 실제 battleId를 가짐: ' + JSON.stringify(firstResult[0]));
  const lastSeq = before.lastSeq;
  both(room, (E) => { E.gameOver(0, 'king'); });
  const after = room.toSeatView(0).fx;
  const laterResults = after.events.filter((e) => e.seq > lastSeq && e.key === 'resultBanner');
  ok(laterResults.length === 1, 'T16: 무관한 gameOver도 자기 resultBanner를 정확히 1개 냄: ' + laterResults.length);
  ok(laterResults[0].battleId === null, 'T16: 이 전투와 무관한 resultBanner는 옛 battleId를 물려받지 않고 null: ' + JSON.stringify(laterResults[0].battleId));
  ok(laterResults[0].scene === null || laterResults[0].scene === undefined, 'T16: 무관한 resultBanner에는 옛 scene도 동봉되지 않음: ' + JSON.stringify(laterResults[0].scene));
  for (const e of after.events) assertEventShape(e, 'T16');
}

// ===== 17) [REVISE 회귀] Saturn P2 startedRoom(1874204) — toSeatView가 돌려준 msg 이벤트의 중첩 fx(hp 등)를
// 변조해도 내부 저장소가 오염되지 않는다(같은 seq를 재조회해도 sameRef가 아니고 값도 원래대로). =====
{
  const room = H.startedRoom(1874204);
  const cur = startBattle(room);
  // #241 CI B(PR240 1e29f44) 간헐 실패 — 이 절은 "반환값 변조가 내부 저장소를 오염시키지 않는다"만 보고 회피는
  // 다루지 않는다. 첫 공격이 rand() 회피(기본 dodge·evadeBuff, 상한 40%)에 걸리면 엔진은 "회피했다!" msg만
  // 내고 hp 필드를 싣지 않아 전제(hp가 실린 msg)가 없어지고 이후 hpEvt.fx 접근이 TypeError로 죽었다.
  // T1(PR239)과 같은 방식으로 두 전투원의 dodge/evadeBuff를 0으로 고정해 회피 판정(rand()<0)을 항상 거짓으로
  // 만든다 — 명중 시 damageFx에 hp가 항상 실린다. 피해량·치명타는 rand()에 그대로 맡기고 전제 단언은 유지한다.
  both(room, (E) => { const B = E.S.battle; B.fa.dodge = 0; B.fa.evadeBuff = 0; B.fd.dodge = 0; B.fd.evadeBuff = 0; });
  const r17 = act(room, cur, { t: 'act', k: 0 });
  ok(r17.ok, 'T17 전제: 공격 행동 수락: ' + JSON.stringify(r17.reason));
  const v0 = room.toSeatView(cur);
  const hpEvt = v0.fx.events.find((e) => e.src === 'msg' && e.fx && e.fx.hp);
  ok(!!hpEvt, 'T17 전제: hp 표시가 실린 msg 이벤트 존재');
  const origVal = hpEvt.fx.hp.val;
  hpEvt.fx.hp.val = 987654;
  hpEvt.fx.injected = 'LEAK';
  const v1 = room.toSeatView(cur);
  const hpEvt2 = v1.fx.events.find((e) => e.seq === hpEvt.seq);
  ok(!!hpEvt2, 'T17: 같은 seq 이벤트를 재조회 가능');
  ok(hpEvt2.fx !== hpEvt.fx, 'T17: 재조회된 fx는 이전 반환값과 별개 객체(참조 공유 아님, sameRef=false)');
  ok(hpEvt2.fx.hp.val === origVal, 'T17: 변조가 내부 저장소에 반영되지 않음 — 재조회 값은 원래 값 그대로: ' + hpEvt2.fx.hp.val);
  ok(!('injected' in hpEvt2.fx), 'T17: 화이트리스트에 없는 주입 필드는 재구성 시 사라짐');
  const v2 = room.handleCommand(cur, { t: 'resync' });
  const hpEvt3 = v2.data.fx.events.find((e) => e.seq === hpEvt.seq);
  ok(!!hpEvt3 && hpEvt3.fx.hp.val === origVal, 'T17: resync 응답도 변조 이전 값 그대로(resync 스토어까지 오염되지 않음)');
}

process.exit(done());
