'use strict';
// #235 시너지(왕국 · 아키타입 · 전설 패시브) 서버 경계 검사.
//   1) 규칙 사본 금지: 단계표·집계·수치는 제품 Core(data.js·core.js)에만 있고 서버에는 한 줄도 없다.
//   2) 락스텝: 참전 확정 순간 스냅샷(B.syn)과 전투원 가산칸이 한 좌석만 갈리면 요약도 갈린다(fail-closed VOID).
//   3) 숨은 정보: 스냅샷·상대 칸 수·왕국 효과는 좌석 뷰 어디에도 실리지 않는다 — 실으면 상대 로스터의
//      속성·아키타입 구성이 그대로 역산된다(GDD-23 7.9 소유자 전용).
//   4) 요약 안정성: 상태가 같으면 두 좌석 요약이 글자 하나까지 같다(키 순서가 흔들리지 않는다).
const fs = require('fs');
const path = require('path');
const { withEngine } = require('../engine');
const H = require('./helpers');
const { both, lockstepDigest } = H;
const { ok, done } = H.makeCounter('issue235-boundary');

function battleRoom(seed) {
  const room = H.startedRoom(seed);
  H.openBattle(room);
  if (room._pendingModal()) throw new Error('fixture: minion battle did not open directly');
  return room;
}
function diverges(room, fn, undo) {
  withEngine(room.engines[1], () => fn(room.engines[1]));
  const split = lockstepDigest(room.engines[0]) !== lockstepDigest(room.engines[1]);
  withEngine(room.engines[1], () => undo(room.engines[1]));
  const back = lockstepDigest(room.engines[0]) === lockstepDigest(room.engines[1]);
  return split && back;
}

// ===== 1) 규칙 사본 금지 — 표도 집계도 제품 Core 에만 있다 =====
{
  const T = H.startedRoom(2351).engine;
  const html = T.html; // 권위 런타임이 실제로 실은 제품 소스 원문 (data.js + state.js + core.js)
  ok(/const\s+V2_KINGDOM_STEPS\s*=/.test(html) && /const\s+V2_KINGDOM_STAGES\s*=/.test(html)
    && /const\s+V2_ARCH_SYN\s*=/.test(html) && /const\s+V2_LEGEND_SYN\s*=/.test(html),
    'G1 단계표·수치표가 제품 규칙 소스에 있다');
  for (const name of ['synCount', 'synKingdomStage', 'synKingdomEffect', 'synArchBonus', 'synDragonEl', 'applySynergy', 'synView']) {
    ok(typeof T[name] === 'function', 'G2 서버가 실행하는 네임스페이스에 Core 집계 ' + name + ' 가 그대로 있다');
  }
  const srv = ['room.js', 'engine.js', 'runtime.js', 'uicompat.js']
    .map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  ok(!/V2_KINGDOM_STAGES|V2_ARCH_SYN|V2_LEGEND_SYN|V2_KINGDOM_STEPS/.test(srv),
    'G3 서버 코드(주석 제외)에 시너지 표 이름이 없다 — 값을 복사해 두지 않았다');
  ok(!/synCount|synArchBonus|synKingdomStage|synDragonEl/.test(srv),
    'G4 서버 코드에 집계 재구현이 없다 — 판정은 전부 공용 Core 가 한다');
}

// ===== 2) 락스텝 — 스냅샷과 전투원 가산칸이 요약에 들어간다 =====
{
  const room = battleRoom(2352);
  const T = room.engine;
  const S = T.S;
  ok(!!(S.battle && S.battle.syn && S.battle.syn[0] && S.battle.syn[1]),
    'S1 전제: 참전 확정 순간 스냅샷이 전투 인스턴스에 굳어 있다');
  const el0 = Object.keys(S.battle.syn[0].el)[0];
  const arch0 = Object.keys(S.battle.syn[0].arch)[0];
  const cases = [
    ['속성 칸 수(el)', (E) => { E.S.battle.syn[0].el[el0] += 1; }, (E) => { E.S.battle.syn[0].el[el0] -= 1; }],
    ['타입 칸 수(arch)', (E) => { E.S.battle.syn[1].arch[arch0] += 1; }, (E) => { E.S.battle.syn[1].arch[arch0] -= 1; }],
    ['사망 칸 수(dead)', (E) => { E.S.battle.syn[0].dead += 1; }, (E) => { E.S.battle.syn[0].dead -= 1; }],
  ];
  for (const [label, fn, undo] of cases) ok(diverges(room, fn, undo), 'S2 락스텝 감지: 스냅샷 ' + label + ' 하나만 다른 두 상태');

  const fighterCases = [
    ['synAtk', (f) => { f.synAtk = (f.synAtk || 0) + 0.05; }, (f, v) => { f.synAtk = v; }],
    ['synDef', (f) => { f.synDef = (f.synDef || 0) + 1; }, (f, v) => { f.synDef = v; }],
    ['synSpd', (f) => { f.synSpd = (f.synSpd || 0) + 1; }, (f, v) => { f.synSpd = v; }],
    ['synDodge', (f) => { f.synDodge = (f.synDodge || 0) + 0.03; }, (f, v) => { f.synDodge = v; }],
    ['synCrit', (f) => { f.synCrit = (f.synCrit || 0) + 0.05; }, (f, v) => { f.synCrit = v; }],
    ['synStatusPct', (f) => { f.synStatusPct = (f.synStatusPct || 0) + 0.05; }, (f, v) => { f.synStatusPct = v; }],
    ['synEl(왕국 효과)', (f) => { f.synEl = Object.assign({ 'X-ONCE': true }, f.synEl); }, (f, v) => { f.synEl = v; }],
  ];
  for (const [label, fn, undo] of fighterCases) {
    let saved;
    ok(diverges(room, (E) => { const f = E.S.battle.fa; saved = f[label.split('(')[0]]; fn(f); },
      (E) => { undo(E.S.battle.fa, saved); }), 'S3 락스텝 감지: 전투원 가산칸 ' + label + ' 하나만 다른 두 상태');
  }
  // 요약 안정성 — 같은 상태면 두 좌석이 글자 하나까지 같다(키 순서가 흔들리지 않는다)
  ok(lockstepDigest(room.engines[0]) === lockstepDigest(room.engines[1]), 'S4 같은 상태 → 같은 요약');
  ok(lockstepDigest(room.engines[0]) === lockstepDigest(room.engines[0]), 'S5 같은 엔진을 두 번 요약해도 같은 문자열');
}

// ===== 3) 숨은 정보 — 스냅샷·가산칸·왕국 효과는 어느 좌석 뷰에도 실리지 않는다 =====
{
  const room = battleRoom(2353);
  const T = room.engine;
  ok(!!(T.S.battle && T.S.battle.syn), '전제: 스냅샷이 있는 전투 뷰를 본다');
  /* synAtk 만 예외다 — 소유자 전투원의 위력 표기(ui.js slotPow/effAtk)가 읽는 값이라 **자기 좌석에만** 간다.
     나머지는 어느 좌석에도 없다. 상대 쪽에는 synAtk 조차 키가 없어야 한다(있으면 0 이어도 존재 자체가 계약 위반이다). */
  const hidden = ['syn', 'synDef', 'synSpd', 'synDodge', 'synCrit', 'synStatusPct', 'synEl'];
  for (const seat of [0, 1]) {
    const v = room.toSeatView(seat);
    const view = JSON.stringify(v);
    const leak = hidden.filter((k) => view.indexOf('"' + k + '"') !== -1);
    ok(leak.length === 0, 'R1 좌석 ' + seat + ' 뷰에 시너지 키가 없다: ' + JSON.stringify(leak));
    const sides = [v.battle.a, v.battle.d];
    const mine = sides.filter((x) => x.owner === seat);
    const theirs = sides.filter((x) => x.owner !== seat);
    ok(mine.length === 1 && theirs.length === 1, 'R1b 전제: 좌석 ' + seat + ' 의 전투 뷰에 내 전투원 1·상대 1');
    ok(Object.prototype.hasOwnProperty.call(mine[0], 'synAtk') && typeof mine[0].synAtk === 'number',
      'R1c 좌석 ' + seat + ' 내 전투원에는 위력 표기용 synAtk 가 온다');
    ok(!Object.prototype.hasOwnProperty.call(theirs[0], 'synAtk'),
      'R1d 좌석 ' + seat + ' 상대 전투원에는 synAtk 키 자체가 없다');
    // 위력 표기 한 곳 말고 다른 경로로 새지 않는다 — 뷰 전체에 synAtk 는 딱 한 번만 나온다(말·예비·요약 어디에도 없다)
    ok(view.split('"synAtk"').length - 1 === 1, 'R1e 좌석 ' + seat + ' 뷰 전체에서 synAtk 는 내 전투원 한 자리뿐');
  }
  /* 역산 금지 — 방어막 층의 획득원 태그(synGuard)는 나가지 않는다. 층 배열 자체가 상대에게 아키타입과
     아직 쓰지 않은 기술을 알려 주기 때문에 #233 부터 뷰에서 빠져 있고, 시너지 층도 같은 경계에 남는다. */
  for (const seat of [0, 1]) {
    const view = JSON.stringify(room.toSeatView(seat));
    ok(view.indexOf('synGuard') === -1 && view.indexOf('shieldLayers') === -1,
      'R2 좌석 ' + seat + ' 뷰에 방어막 층·획득원 태그가 없다 (보호형 시너지 역산 차단)');
  }
  // 요약에는 있고 뷰에는 없다 — 두 경계가 실제로 다른 것을 확인한다(서버 내부 비교 전용)
  ok(lockstepDigest(T).indexOf('"syn"') !== -1, 'R3 요약(서버 내부)에는 시너지가 들어간다');
}

done();
