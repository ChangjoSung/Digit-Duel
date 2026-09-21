'use strict';
// #245 권위 런타임 계약 — "제품 소스만 돌고, 테스트 하네스도 DOM도 없다"를 실제로 확인한다.
// 음성 대조(negative control)는 전부 결정적이다: 타이밍·난수·네트워크에 기대지 않는다.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { createEngine, withEngine } = require('../engine');
const { productFiles, PRODUCT_SOURCE } = require('../runtime');
const { makeCounter } = require('./helpers');

const c = makeCounter('runtime-contract');
const ok = (v, m) => c.ok(v, m);
const AUTH = path.join(__dirname, '..');
const DEMO = path.join(__dirname, '..', '..', '..', 'demo');

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
// 더 강한 음성 대조 — demo/test/** 를 **읽을 수 없게 막은** 자식 프로세스에서도 엔진이 만들어지고
// 한 판을 완주한다. 소스에 그 경로가 없다는 것보다, 있어도 못 쓴다는 것이 실제 계약이다.
{
  const blocked = 'const fs=require("fs"),real=fs.readFileSync;'
    // 경로 구분자는 플랫폼마다 다르므로 `.` 로 받는다 (demo/test/ · demo\test\ 둘 다).
    + 'fs.readFileSync=function(p){if(/demo.test./.test(String(p)))'
    + 'throw new Error("blocked: "+p);return real.apply(fs,arguments);};'
    + 'const E=require(' + JSON.stringify(path.join(AUTH, 'engine.js')) + ');'
    + 'const T=E.createEngine();E.withEngine(T,function(){T.setSeed(11);T.startMode("sim",{aiLevel:["dan5","dan5"]});});'
    + 'console.log(JSON.stringify({turns:T.S.turnCount,winner:T.S.winner,type:T.S.metrics.winType}));';
  const res = JSON.parse(execFileSync(process.execPath, ['-e', blocked], { encoding: 'utf8' }));
  ok(res.turns === 130 && res.winner === 0 && res.type === 'wipe',
    'demo/test/** 읽기를 차단해도 엔진이 로드되고 같은 결과로 완주한다: ' + JSON.stringify(res));
}

// ===== 2) 실행되는 것은 제품 규칙 소스 그 자체 =====
{
  const listed = [...fs.readFileSync(path.join(DEMO, 'index.html'), 'utf8')
    .matchAll(/<script\s+src="js\/([A-Za-z0-9_.-]+)"\s*><\/script>/g)].map((m) => m[1]);
  ok(listed.length > 0 && JSON.stringify(productFiles()) === JSON.stringify(listed),
    '런타임이 읽는 스크립트 목록·순서의 주인은 demo/index.html 이다: ' + listed.join(','));
  const onDisk = listed.map((f) => fs.readFileSync(path.join(DEMO, 'js', f), 'utf8')).join('\n;\n');
  ok(PRODUCT_SOURCE === onDisk, '실행 소스가 demo/js/*.js 원문과 바이트 단위로 같다 (사본·변형 없음)');
  ok(['data.js', 'state.js', 'core.js', 'ai.js'].every((f) => listed.includes(f)), '규칙 소스(data·state·core·ai)가 모두 실행된다');
}

// ===== 3) DOM 없음 (음성 대조) =====
{
  const before = global.document;
  const T = createEngine();
  ok(global.document === before && typeof global.document === 'undefined', '엔진을 만들어도 서버 프로세스에는 document 가 없다');
  const el = T.byId('board');
  ok(el.nodeType === undefined && el.ownerDocument === undefined && el.tagName === undefined && el.nodeName === undefined,
    '표시 싱크는 DOM 노드가 아니다 (nodeType·ownerDocument·tagName 없음)');
  ok(el.querySelector('#board .cell') === null && el.querySelectorAll('.cell').length === 0
    && T.__vmContext.document.querySelector('#board') === null,
    '선택자 엔진이 없다 — 질의는 항상 빈 결과다');
  // 제품이 스스로 "실물 DOM 인가"를 묻는 두 지점이 모두 false 여야 헤드리스 규칙 경로를 탄다.
  withEngine(T, () => { T.newGame('pvp'); });
  ok(T.fxLive() === false && T.liveBattleDom() === false, '제품의 실물 DOM 판정(fxLive·liveBattleDom)이 false — 연출 재생 경로가 열리지 않는다');
  for (const g of ['localStorage', 'sessionStorage', 'indexedDB', 'WebSocket', 'XMLHttpRequest', 'fetch', 'navigator', 'require', 'process']) {
    ok(T.__vmContext[g] === undefined, '권위 런타임 컨텍스트에 ' + g + ' 가 없다 (영속·외부 통로 0)');
  }
  ok(T.TQ === undefined && T.els && typeof T.byId === 'function', '하네스 가짜 큐 없이 서버 소유 표시 싱크만 있다');
  ok(typeof T.html === 'string' && T.html.includes('function newGame(') && !T.html.includes('<script') && !T.html.includes('<!DOCTYPE'),
    'T.html 은 경계 검사가 읽는 제품 규칙 소스 원문이다 (HTML 문서가 아니다)');
}

// ===== 4) 엔진 격리 — 컨텍스트·스케줄러·상태·표시 싱크가 전부 독립 =====
{
  const E = [createEngine(), createEngine(), createEngine()];
  E.forEach((T, i) => withEngine(T, () => { T.setSeed(i + 1); T.startMode('pvp'); }));
  ok(new Set(E.map((T) => T.__vmContext)).size === 3 && new Set(E.map((T) => T.scheduler)).size === 3,
    '엔진 3개가 각자 독립 V8 컨텍스트·스케줄러를 갖는다');
  ok(new Set(E.map((T) => T.S)).size === 3 && new Set(E.map((T) => T.byId('overlayBox'))).size === 3,
    '상태와 표시 싱크도 엔진마다 별개다');
  const neighbor = JSON.stringify(E[1].S);
  withEngine(E[0], () => { E[0].S.pieces[0].hp = 1; E[0].byId('overlayBox').innerHTML = '<b>only-0</b>'; });
  ok(E[1].S.pieces[0].hp !== 1 && E[2].S.pieces[0].hp !== 1, '한 엔진의 상태 변경이 다른 엔진에 새지 않는다');
  ok(E[1].byId('overlayBox').innerHTML === '' && E[2].byId('overlayBox').innerHTML === '', '한 엔진의 표시 변경도 새지 않는다');
  ok(JSON.stringify(E[1].S) === neighbor, '이웃 엔진의 상태는 한 글자도 바뀌지 않았다');
}

// ===== 5) 모달 결정 포트 — 서버가 읽는 표면은 제품 modal()/close() 가 만든 그대로다 =====
{
  const T = createEngine();
  withEngine(T, () => { T.newGame('pvp'); });
  withEngine(T, () => { T.modal('<b>선택</b>', [['가', () => {}], ['나', null, true]]); });
  const overlay = T.byId('overlay'), ob = T.byId('obBtns'), box = T.byId('overlayBox');
  ok(overlay.classList.contains('hidden') === false, 'modal() 이 오버레이를 연다');
  ok(box.innerHTML.indexOf('<b>선택</b>') === 0, '본문 html 은 제품이 만든 문자열 그대로다');
  ok(ob.children.length === 2 && ob.children[0].textContent === '가' && ob.children[1].textContent === '나',
    '버튼 목록·문구가 제품이 만든 그대로다');
  ok(ob.children[0].disabled === false && ob.children[1].disabled === true, 'disabled 가 인덱스 중계와 같은 의미로 보존된다');
  withEngine(T, () => { T.modal('<i>두번째</i>', [['ㄱ', () => {}]]); });
  ok(ob.children.length === 1 && ob.children[0].textContent === 'ㄱ', '새 모달이 옛 버튼을 누적하지 않는다 (브라우저 innerHTML 교체 의미)');
  withEngine(T, () => { T.close(); });
  ok(overlay.classList.contains('hidden') === true, 'close() 가 오버레이를 닫는다');
}

// ===== 6) 규칙 경로 전수 — 배치·보드·탐색·전투·지연 스케줄러를 한 판에 다 지나는 결정적 완주 =====
// 기대값은 #245 이전(테스트 하네스 구동) 엔진에서 뜬 것 그대로다 — 런타임 교체가 관측을 바꾸지 않았음을 고정한다.
const GOLDEN = [
  { seed: 11, turns: 130, winner: 0, winType: 'wipe', state: '4c6fb9aa5ee26f1d', log: '3cdb74d97fd6aa78', logN: 549, fx: '6491f3a3f8f54949', fxN: 40, metrics: '1ccff21f3fafc58e', sched: { scheduled: 695, cleared: 0, fired: 695, drains: 1 }, now: 2300 },
  { seed: 44, turns: 101, winner: 0, winType: 'king', state: '97033841e557bf24', log: '8161afd28d88c9f1', logN: 363, fx: 'b753d1a8ee691bb4', fxN: 40, metrics: 'c82e863c551a92cd', sched: { scheduled: 544, cleared: 0, fired: 544, drains: 1 }, now: 2300 },
  { seed: 55, turns: 95, winner: 0, winType: 'edge', state: 'dc3683858503a8fc', log: '9e8f5ad654e1121e', logN: 278, fx: 'c9d4e410a5c0359d', fxN: 33, metrics: 'adea69b26a5411cc', sched: { scheduled: 485, cleared: 0, fired: 485, drains: 1 }, now: 2300 },
];
// aiLastThinkMs 는 벽시계 측정값이라 실행마다 다르다 — 규칙이 아니므로 다이제스트에서 뺀다(그 외 필드는 전부 본다).
const rep = (k, v) => (k === 'aiLastThinkMs' ? 0 : v instanceof Set ? [...v] : v);
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
for (const g of GOLDEN) {
  const T = createEngine();
  withEngine(T, () => { T.setSeed(g.seed); T.startMode('sim', { aiLevel: ['dan5', 'dan5'] }); });
  const S = T.S;
  ok(S.turnCount === g.turns && S.winner === g.winner && S.metrics.winType === g.winType && S.phase === 'over',
    'seed ' + g.seed + ': 완주 결과 동일 (turns=' + S.turnCount + ' winner=' + S.winner + ' type=' + S.metrics.winType + ')');
  ok(sha(JSON.stringify(S, rep)) === g.state, 'seed ' + g.seed + ': 최종 상태 스냅샷 동일');
  ok(S.log.length === g.logN && sha(JSON.stringify(S.log)) === g.log, 'seed ' + g.seed + ': 공개 기록(log) 동일 (' + S.log.length + '줄)');
  ok(T.__fx.items.length === g.fxN && sha(JSON.stringify(T.__fx.items)) === g.fx, 'seed ' + g.seed + ': 전투 표시 이벤트(fx) 동일 (' + T.__fx.items.length + '건)');
  ok(sha(JSON.stringify(S.metrics)) === g.metrics, 'seed ' + g.seed + ': 지표 동일');
  ok(JSON.stringify(T.scheduler.stats) === JSON.stringify(g.sched) && T.scheduler.now() === g.now,
    'seed ' + g.seed + ': 스케줄러 예약·발화·가상 시계 동일 (' + JSON.stringify(T.scheduler.stats) + ' now=' + T.scheduler.now() + ')');
  ok(S.metrics.battles > 0 && S.metrics.searches > 0, 'seed ' + g.seed + ': 탐색·전투 경로를 실제로 지났다');
}

c.done();
