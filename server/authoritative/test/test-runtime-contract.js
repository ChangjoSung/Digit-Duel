'use strict';
/* #245 권위 런타임 계약 — "규칙 소스만 돌고, 테스트 하네스도 표시 계층도 브라우저 전역도 없다"를 실제로 확인한다.
   음성 대조(negative control)는 전부 결정적이다: 타이밍·난수·네트워크에 기대지 않는다.

   이번 tranche 로 계약이 좁아졌다. 종전 런타임은 demo/index.html 의 스크립트 **전부**(ui.js·ai.js·ui-overlays.js·
   network.js·bootstrap.js 포함)를 싣고, 그 표시 코드가 헤드리스로 지나가도록 서버가 document 싱크·window·타이머
   전역을 세워 줬다. 이제는 브라우저 비의존 3종(data.js·state.js·core.js)만 싣고 state.js 의 UI_PORT 네 자리만 채운다.
   그래서 이 파일의 검사도 함께 좁아진다 — 아래 각 절에 무엇이 어떻게 바뀌었는지 그 자리에 적는다. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { createEngine, withEngine } = require('../engine');
const { productFiles, AUTHORITATIVE_FILES, PRODUCT_SOURCE } = require('../runtime');
const { makeCounter, startedRoom, act, byId, both, lockstepDigest } = require('./helpers');

const c = makeCounter('runtime-contract');
const ok = (v, m) => c.ok(v, m);
const AUTH = path.join(__dirname, '..');
const DEMO = path.join(__dirname, '..', '..', '..', 'demo');

/* 결정적 구동 — 권위 런타임에는 AI 가 없다(ai.js 는 클라이언트 소유다). 그래서 종전의 "AI vs AI 한 판 완주"를
   이 파일에서 재현할 수 없다. 대신 **좌석 입력만으로** 규칙 경로를 넓게 지나는 고정 각본을 돌린다: 자동 배치 →
   경기 개시 → 매 걸음 지금 상태가 요구하는 합법 입력 하나. 선택은 테스트 소유의 작은 LCG 로 하므로 게임 RNG 를
   한 번도 건드리지 않고, 같은 seed 는 언제나 같은 경기를 만든다. (AI 완주 회귀는 ai.js 를 함께 싣는 클라이언트
   회귀 demo/test/regression/smoke_ai_completion.js 가 계속 담당한다.) */
function drive(T, seed, steps) {
  withEngine(T, () => { T.setSeed(seed); T.newGame('pvp', {}); });
  for (let p = 0; p < 2; p++) withEngine(T, () => { T.dispatchCoreAction({ t: 'auto' }); T.dispatchCoreAction({ t: 'setupConfirm' }); });
  withEngine(T, () => { T.dispatchCoreAction({ t: 'beginPlay' }); });
  let x = (seed * 2654435761) >>> 0;
  const rnd = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296);
  const pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
  for (let i = 0; i < steps && T.S.phase === 'play'; i++) {
    withEngine(T, () => {
      const S = T.S, M = T.__modal;
      // 대기 중인 동기화 모달이 있으면 **회선 어휘 그대로** 답한다 — 마지막 활성 버튼(포기/취소/확인)을 고른다.
      // 결정 상태에서 화면을 파생하고 인덱스를 다시 Core 액션으로 돌려보내는 호환 경로 전체가 이 한 줄에 걸린다.
      if (M.view) { const bs = M.view.buttons; for (let k = bs.length - 1; k >= 0; k--) if (!bs[k].disabled) { T.applyAction({ t: 'modal', seq: M.seq, i: k }); return; } }
      if (S.battle) { T.applyAction({ t: 'act', k: 'basic', bf: T.battleActionFrame(S) }); return; }
      if (S.fleePick) { T.applyAction({ t: 'fleeSkip', pick: S.fleePick.token }); return; }
      const mine = S.pieces.filter((p) => p.owner === S.current && p.alive && p.placed && p.type !== 'trap');
      if (!mine.length) { T.dispatchCoreAction({ t: 'endTurn' }); return; }
      /* 탐색은 **이동보다 먼저** 시도한다 — 흔적은 그 칸에 올라선 순간에 기록되고(core.js move reducer) 주 행동은
         턴당 하나라, 같은 턴에 이동하고 탐색하면 언제나 mainUsed 에 걸린다. 그래서 전 턴에 올라선 말이 이번 턴에 캔다. */
      const seen = S.traces[S.current];
      const onEv = mine.find((p) => S.events.some((e) => e.r === p.r && e.c === p.c && !e.consumed && seen.has(e.r + '_' + e.c)));
      if (onEv && T.dispatchCoreAction({ t: 'search', id: onEv.id, r: onEv.r, c: onEv.c })) { T.dispatchCoreAction({ t: 'endTurn' }); return; }
      const m = pick(mine);
      /* 목표를 향하게 한다 — 무작위로만 밀면 한 판 안에 접촉도 탐색도 한 번 안 나는 seed 가 생겨(실측: seed 44·55)
         전투·강제 전투·탐색 경로가 검사에서 통째로 빠진다. 걸음마다 숲(미소모 이벤트 칸)과 적을 번갈아 겨냥하고,
         그쪽으로 한 칸 가는 것을 먼저 시도한 뒤 막히면 나머지 세 방향을 돈다. 고르는 방법이 결정적이라
         같은 seed 는 언제나 같은 경기를 만든다(게임 RNG 는 한 번도 건드리지 않는다). */
      const evs = S.events.filter((e) => !e.consumed);
      const targets = (i % 2 === 0 && evs.length) ? evs : S.pieces.filter((p) => p.owner !== m.owner && p.alive && p.placed);
      const near = targets.reduce((a, b) => (Math.abs(b.r - m.r) + Math.abs(b.c - m.c) < Math.abs(a.r - m.r) + Math.abs(a.c - m.c) ? b : a), targets[0]);
      const toward = near ? (Math.abs(near.r - m.r) >= Math.abs(near.c - m.c)
        ? [m.r + Math.sign(near.r - m.r), m.c] : [m.r, m.c + Math.sign(near.c - m.c)]) : null;
      const order = [[m.r + 1, m.c], [m.r - 1, m.c], [m.r, m.c + 1], [m.r, m.c - 1]];
      const start = Math.floor(rnd() * order.length) % order.length;
      const tries = (toward ? [toward] : []).concat(order.slice(start), order.slice(0, start));
      for (const [r, cc] of tries) if (T.dispatchCoreAction({ t: 'move', id: m.id, r, c: cc })) break;
      T.dispatchCoreAction({ t: 'endTurn' });
    });
  }
  return T;
}

// ===== 1) 테스트 하네스 없음 (음성 대조) =====
// 엔진만 require 한 깨끗한 자식 프로세스의 모듈 그래프에 demo/test/** 가 한 개도 없어야 한다.
// 같은 프로세스에서 보면 이 테스트가 끌어온 helpers 때문에 판정이 흐려지므로 자식에서 본다.
{
  const probe = 'require(' + JSON.stringify(path.join(AUTH, 'engine.js')) + ').createEngine();'
    + 'const bad=Object.keys(require.cache).filter(p=>/demo[\\\\/]test[\\\\/]/.test(p));'
    + 'console.log(JSON.stringify({bad:bad,n:Object.keys(require.cache).length}));';
  const out = JSON.parse(execFileSync(process.execPath, ['-e', probe], { encoding: 'utf8' }));
  ok(out.bad.length === 0, '엔진을 로드·생성해도 demo/test/** 모듈이 하나도 들어오지 않는다: ' + JSON.stringify(out.bad));
  ok(out.n > 0, '자식 프로세스 모듈 그래프 관측 자체는 성립');
}
// 더 강한 음성 대조 — demo/test/** 를 **읽을 수 없게 막은** 자식 프로세스에서도 엔진이 만들어지고 규칙이 돈다.
// 소스에 그 경로가 없다는 것보다, 있어도 못 쓴다는 것이 실제 계약이다.
{
  const blocked = 'const fs=require("fs"),real=fs.readFileSync;'
    // 경로 구분자는 플랫폼마다 다르므로 `.` 로 받는다 (demo/test/ · demo\test\ 둘 다).
    + 'fs.readFileSync=function(p){if(/demo.test./.test(String(p)))'
    + 'throw new Error("blocked: "+p);return real.apply(fs,arguments);};'
    + 'const E=require(' + JSON.stringify(path.join(AUTH, 'engine.js')) + ');'
    + 'const T=E.createEngine();'
    + 'E.withEngine(T,function(){T.setSeed(11);T.newGame("pvp",{});});'
    + 'for(var p=0;p<2;p++)E.withEngine(T,function(){T.dispatchCoreAction({t:"auto"});T.dispatchCoreAction({t:"setupConfirm"});});'
    + 'E.withEngine(T,function(){T.dispatchCoreAction({t:"beginPlay"});});'
    + 'console.log(JSON.stringify({phase:T.S.phase,placed:T.S.pieces.filter(function(x){return x.placed;}).length,first:T.S.metrics.firstPlayer}));';
  const res = JSON.parse(execFileSync(process.execPath, ['-e', blocked], { encoding: 'utf8' }));
  ok(res.phase === 'play' && res.placed === 28 && (res.first === 0 || res.first === 1),
    'demo/test/** 읽기를 차단해도 엔진이 로드되고 규칙이 그대로 돈다: ' + JSON.stringify(res));
}

// ===== 2) 실행되는 것은 제품 규칙 소스 그 자체 — 그리고 **그 셋뿐이다** =====
// #245: 종전에는 index.html 의 목록 전부와 같아야 했다. 이제 런타임은 그중 브라우저 비의존 3종만 고르고,
// 그 상대 순서가 문서와 같은지 대조한다. 표시·네트워크·부트스트랩 소스는 한 바이트도 실리면 안 된다.
{
  const listed = [...fs.readFileSync(path.join(DEMO, 'index.html'), 'utf8')
    .matchAll(/<script\s+src="js\/([A-Za-z0-9_.-]+)"\s*><\/script>/g)].map((m) => m[1]);
  ok(listed.length > 0, 'demo/index.html 이 스크립트 목록의 주인이다: ' + listed.join(','));
  ok(JSON.stringify(productFiles()) === JSON.stringify(['data.js', 'state.js', 'core.js'])
    && JSON.stringify(AUTHORITATIVE_FILES) === JSON.stringify(productFiles()),
    '권위 런타임이 싣는 것은 data·state·core 셋뿐이다: ' + productFiles().join(','));
  ok(JSON.stringify(listed.filter((f) => AUTHORITATIVE_FILES.includes(f))) === JSON.stringify(AUTHORITATIVE_FILES),
    '그 셋의 상대 순서는 demo/index.html 과 같다 (문서가 순서의 주인)');
  const onDisk = AUTHORITATIVE_FILES.map((f) => fs.readFileSync(path.join(DEMO, 'js', f), 'utf8')).join('\n;\n');
  ok(PRODUCT_SOURCE === onDisk, '실행 소스가 demo/js 원문과 바이트 단위로 같다 (사본·변형 없음)');
  for (const f of ['ui.js', 'ai.js', 'ui-overlays.js', 'network.js', 'bootstrap.js']) {
    const src = fs.readFileSync(path.join(DEMO, 'js', f), 'utf8');
    const probe = src.split('\n').find((l) => l.length > 60 && !/^\s*[/*]/.test(l));
    ok(!!probe && PRODUCT_SOURCE.indexOf(probe) === -1, '실행 소스에 ' + f + ' 의 본문이 들어 있지 않다');
  }
}

// ===== 3) 브라우저 전역 없음 (음성 대조) =====
// #245: 종전에는 "서버가 세운 표시 싱크가 DOM 이 아니다"를 봤다. 이제 그 싱크 자체가 없다 — 규칙 3종이
// document 를 한 번도 읽지 않으므로 컨텍스트에 아무것도 주지 않는다. 더 강한 계약이라 그대로 단언한다.
{
  const before = global.document;
  const T = createEngine();
  ok(global.document === before && typeof global.document === 'undefined', '엔진을 만들어도 서버 프로세스에는 document 가 없다');
  for (const g of ['document', 'window', 'self', 'location', 'navigator', 'setTimeout', 'clearTimeout', 'setInterval',
    'clearInterval', 'localStorage', 'sessionStorage', 'indexedDB', 'WebSocket', 'XMLHttpRequest', 'fetch', 'require', 'process']) {
    ok(T.__vmContext[g] === undefined, '권위 런타임 컨텍스트에 ' + g + ' 가 없다 (표시·영속·외부 통로 0)');
  }
  ok(T.TQ === undefined && T.byId === undefined && T.els === undefined, '하네스 가짜 큐도, 서버 표시 싱크도 없다');
  ok(typeof T.UI_PORT === 'object' && typeof T.UI_PORT.event === 'function' && T.UI_PORT.defer({ t: 'x' }) === false,
    '바깥으로 나가는 통로는 UI_PORT 네 자리뿐이고 defer 는 기본값(미루지 않음)이다');
  ok(typeof T.html === 'string' && T.html.includes('function newGame(') && !T.html.includes('<script') && !T.html.includes('<!DOCTYPE'),
    'T.html 은 경계 검사가 읽는 제품 규칙 소스 원문이다 (HTML 문서가 아니다)');
}

// ===== 4) 엔진 격리 — 컨텍스트·스케줄러·상태·호스트 포트가 전부 독립 =====
{
  const E = [createEngine(), createEngine(), createEngine()];
  E.forEach((T, i) => withEngine(T, () => { T.setSeed(i + 1); T.newGame('pvp', {}); }));
  ok(new Set(E.map((T) => T.__vmContext)).size === 3 && new Set(E.map((T) => T.scheduler)).size === 3,
    '엔진 3개가 각자 독립 V8 컨텍스트·스케줄러를 갖는다');
  ok(new Set(E.map((T) => T.S)).size === 3 && new Set(E.map((T) => T.host)).size === 3 && new Set(E.map((T) => T.UI_PORT)).size === 3,
    '상태와 호스트 포트도 엔진마다 별개다');
  const neighbor = JSON.stringify(E[1].S);
  withEngine(E[0], () => { E[0].S.pieces[0].hp = 1; E[0].host.seat = 1; });
  ok(E[1].S.pieces[0].hp !== 1 && E[2].S.pieces[0].hp !== 1, '한 엔진의 상태 변경이 다른 엔진에 새지 않는다');
  ok(E[1].host.seat === null && E[1].UI_PORT.seat() === null, '한 엔진의 좌석 시점도 새지 않는다');
  ok(JSON.stringify(E[1].S) === neighbor, '이웃 엔진의 상태는 한 글자도 바뀌지 않았다');
}

// ===== 5) 모달 결정 표면 — 서버가 읽는 것은 Core 결정 상태에서 파생된 값이다 =====
// #245: 종전에는 제품 modal()/close() 가 만든 **DOM**(overlay·obBtns·overlayBox)을 그대로 읽었다. 그 함수들은
// ui-overlays.js/network.js 소유라 권위 런타임에 없다. 회선 모양(seq·owner·count·html·buttons·disabled)은 그대로
// 두고, 만드는 근거만 Core 결정 상태(S.recruit·S.entryPick·S.battle.pkgSel)로 옮겼다 — uicompat.pendingModal.
{
  const room = startedRoom('rc-modal');
  const T = room.engine;
  const own = T.S.current;
  const p = T.S.pieces.find((x) => x.owner === own && x.type === 'minion' && x.alive && x.placed);
  ok(room._pendingModal() === null, '결정 상태가 없으면 대기 중인 모달도 없다');
  both(room, (E) => {
    E.S.recruit = { owner: own, pieceId: p.id, species: E.ROSTER[0].id, stage: 'root', skill: null, targetId: null, recvId: null, token: p.id + '#1' };
  });
  const pm = room._pendingModal();
  ok(!!pm && pm.owner === own && pm.count === pm.buttons.length && pm.count > 0, '결정 상태가 곧 대기 중인 모달이다: ' + JSON.stringify(pm && [pm.owner, pm.count]));
  ok(typeof pm.html === 'string' && pm.html.indexOf('<h2>🌿 숲에서 무언가를 찾았다</h2>') === 0, '본문 html 은 회선 클라이언트가 그대로 그리는 그 문자열이다');
  ok(pm.disabled.length === pm.count && pm.disabled[0] === true,
    'disabled 가 인덱스 중계와 같은 의미로 보존된다 (기술 교체는 V2_INTERP 로 닫혀 있다)');
  ok(room.toSeatView(1 - own).modal && !('html' in room.toSeatView(1 - own).modal), '비소유 좌석에는 문구·버튼이 나가지 않는다');
  both(room, (E) => { E.S.recruit = null; });
  ok(room._pendingModal() === null, '결정 상태가 사라지면 모달도 닫힌다');
}

// ===== 5b) 락스텝 요약 — 탐색 보류 결정(S.recruit)의 정본 표현 (Saturn M1) =====
{
  const room = startedRoom('rc-digest-recruit');
  const T = room.engine;
  const own = T.S.current;
  const p = T.S.pieces.find((x) => x.owner === own && x.type === 'minion' && x.alive && x.placed);
  both(room, (E) => {
    E.S.recruit = { owner: own, pieceId: p.id, species: E.ROSTER[0].id, stage: 'root', skill: null, targetId: null, recvId: null, token: p.id + '#1' };
  });
  /* #245 (Saturn M1) 락스텝 요약 — 탐색 보류 결정은 **어느 말이 어떤 종을 물었는지**까지 본다. 소유자·단계·
     토큰만 보면 서로 다른 포획을 예약한 두 좌석이 같은 요약을 내 fail-closed VOID 가 발동하지 못한다.
     모달 seq 는 "화면이 바뀐 횟수"라 기록을 갈아끼우는 것만으로도 오르내린다 — 그 표시 계층 카운터가 차이를
     대신 만들어 주지 못하도록 0 으로 지우고 비교한다(요약이 결정 상태 자체로 갈리는지만 본다). */
  const E1 = room.engines[1];
  const R0 = E1.S.recruit;
  const other = T.S.pieces.find((x) => x.owner === own && x.type === 'minion' && x.alive && x.placed && x.id !== p.id);
  const stripSeq = (d) => { const o = JSON.parse(d); o.modalSeq = 0; return JSON.stringify(o); };
  const dig = (patch) => { withEngine(E1, () => { E1.S.recruit = Object.assign({}, R0, patch); }); return stripSeq(lockstepDigest(E1)); };
  const baseD = dig({});
  ok(!!other && T.ROSTER[1].id !== R0.species, '전제: 다른 수령 말·다른 후보 종을 고를 수 있다');
  ok(baseD === stripSeq(lockstepDigest(room.engines[0])), '같은 탐색 보류 결정 → 두 좌석 같은 요약');
  for (const [label, patch] of [['수령 말(pieceId)', { pieceId: other.id }], ['후보 종(species)', { species: T.ROSTER[1].id }]]) {
    ok(dig(patch) !== baseD, '락스텝 감지: 탐색 보류 ' + label + ' 하나만 다른 두 상태');
    ok(dig({}) === baseD, '되돌리면 요약 복귀: ' + label);
  }
}

// ===== 6) 규칙 경로 전수 — 좌석 입력만으로 배치·보드·턴·전투를 지나는 결정적 완주 =====
/* #245 골든 교체 근거(의도된 변경, 값을 낮춘 것이 아니다):
   종전 골든은 `startMode('sim', {aiLevel:['dan5','dan5']})` 로 AI 두 명이 둔 한 판의 최종 해시였다. 그 경로는
   **ai.js 와 ui.js 를 서버에 싣고 있었기에만** 가능했다. 권위 런타임이 규칙 3종으로 좁아진 지금 서버에는 AI 도
   연출 스케줄도 없으므로 그 판을 재현할 방법 자체가 없다 — 같은 숫자를 다시 만들 수 없다.
   그래서 이 절의 고정 대상을 "AI 가 둔 한 판"에서 "좌석 입력이 만든 한 판"으로 바꾼다. 아래 값은 위 drive()
   각본을 실제로 돌려 뜬 것이고, 같은 각본이 **두 엔진에서 한 글자도 다르지 않게** 재현되는지를 같은 자리에서
   함께 확인한다(결정성 자체가 검사다). 스케줄러 기대값이 전부 0 인 것도 계약이다 — 제품이 타이머를 걸지 않는다.
   AI 완주 회귀는 ai.js 를 함께 싣는 클라이언트 회귀(demo/test/regression/smoke_ai_completion.js)가 담당한다. */
/* 아래 값은 위 drive() 각본을 **반복 실행해 같은 값이 나오는 것을 확인한 뒤** 그대로 박은 고정 기대값이다
   (2026-09-22, 엔진 3개 독립 실행 대조). 쌍둥이 실행 비교는 그대로 두되 **그것만으로 끝내지 않는다** — 같은
   코드가 같은 결과를 내는 것은 규칙이 바뀌어도 성립하므로, 규칙이 바뀌면 반드시 어긋나는 고정 해시를 함께 건다. */
/* #235 시너지(왕국 · 아키타입 · 전설 패시브) 가 실제 규칙으로 켜지면서 같은 각본의 결과가 바뀌었다 — 위 주석이 말하는 "규칙이 바뀌면 반드시 어긋나는" 그 자리다.
   2026-09-22 재기준선: DD_GOLDEN=1 로 두 번 돌려 같은 값임을 확인했고, 아래 쌀둥이 실행 비교가 결정성을 그대로 다시 건다.
   값을 구현에 맞춰 낮춘 것이 아니라, 승인된 규칙 변경의 새 기준선이다. */
/* #263 (2026-09-25 CJ Q1=A) 재기준선: 왕·동료의 미선택 왕국 동률이 고정 순서에서 **난수 1회**로 바뀌었다 —
   난수 소비가 늘어 같은 시드의 각본이 다른 판이 된다. 위 주석이 말하는 "규칙이 바뀌면 반드시 어긋나는" 그 자리다.
   DD_GOLDEN=1 로 두 번 돌려 같은 값임을 확인하고 박았다. 값을 구현에 맞춰 낮춘 것이 아니라 승인된 규칙 변경의 새 기준선이다. */
const GOLDEN = [
  { seed: 11, turns: 71, phase: 'play', winner: null, battles: 0, forced: 0, searches: 3,
    state: '483b50ecf58f344c', log: 'd2b6a79974bda20c', logN: 84, fx: '9802fc2eaad2f033', fxN: 40, metrics: 'fff2fbfce4478d8e' },
  { seed: 44, turns: 111, phase: 'over', winner: 0, battles: 2, forced: 2, searches: 3,
    state: '54be1eac51496282', log: 'eb3ab1f5bc3fe290', logN: 128, fx: '0b8775810364dfca', fxN: 40, metrics: '7e0297c8192fe704' },
  { seed: 55, turns: 135, phase: 'play', winner: null, battles: 9, forced: 9, searches: 6,
    state: '35850223cf001bbf', log: '3fac178ebf3512f3', logN: 172, fx: 'bd52ade6a2b27033', fxN: 40, metrics: '8a1facbfd255a2c4' },
];
const rep = (k, v) => (v instanceof Set ? [...v] : v);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
for (const g of GOLDEN) {
  const T = drive(createEngine(), g.seed, 400);
  const S = T.S, M = S.metrics;
  // 규칙이 바뀜 때 고정 기대값을 다시 뜨는 덤프 — DD_GOLDEN=1 로 두 번 돌려 같은 값이 나오는 것을 확인한 뒤 아래 GOLDEN 에 박는다.
  if (process.env.DD_GOLDEN) console.log(JSON.stringify({ seed: g.seed, turns: S.turnCount, phase: S.phase, winner: S.winner, battles: M.battles, forced: M.forcedBattles, searches: M.searches, state: sha(JSON.stringify(S, rep)), log: sha(JSON.stringify(S.log)), logN: S.log.length, fx: sha(JSON.stringify(T.__fx.items)), fxN: T.__fx.items.length, metrics: sha(JSON.stringify(M)) }));
  ok(S.turnCount === g.turns && S.phase === g.phase && S.winner === g.winner,
    'seed ' + g.seed + ': 완주 결과 동일 (turns=' + S.turnCount + ' phase=' + S.phase + ' winner=' + S.winner + ')');
  ok(sha(JSON.stringify(S, rep)) === g.state, 'seed ' + g.seed + ': 최종 상태 스냅샷 동일');
  ok(S.log.length === g.logN && sha(JSON.stringify(S.log)) === g.log, 'seed ' + g.seed + ': 공개 기록(log) 동일 (' + S.log.length + '줄)');
  ok(T.__fx.items.length === g.fxN && sha(JSON.stringify(T.__fx.items)) === g.fx, 'seed ' + g.seed + ': 표시 이벤트(fx) 동일 (' + T.__fx.items.length + '건)');
  ok(sha(JSON.stringify(M)) === g.metrics, 'seed ' + g.seed + ': 지표 동일');
  ok(M.battles === g.battles && M.forcedBattles === g.forced && M.searches === g.searches,
    'seed ' + g.seed + ': 전투·강제 전투·탐색 경로를 실제로 지났다 (battles=' + M.battles + ' forced=' + M.forcedBattles + ' searches=' + M.searches + ')');
  ok(JSON.stringify(T.scheduler.stats) === JSON.stringify({ scheduled: 0, cleared: 0, fired: 0, drains: T.scheduler.stats.drains })
    && T.scheduler.now() === 0,
    'seed ' + g.seed + ': 규칙만 도는 런타임은 타이머를 하나도 걸지 않는다: ' + JSON.stringify(T.scheduler.stats));
  // 쌍둥이 음성 대조 — 독립 엔진(새 V8 컨텍스트)이 같은 각본에서 한 글자도 다르지 않아야 한다.
  const U = drive(createEngine(), g.seed, 400);
  ok(JSON.stringify(U.S, rep) === JSON.stringify(S, rep) && JSON.stringify(U.__fx.items) === JSON.stringify(T.__fx.items),
    'seed ' + g.seed + ': 독립 엔진 쌍둥이 실행이 상태·fx 까지 동일 (컨텍스트 간 누수 없음)');
}

c.done();
