'use strict';
// #245 서버 권위 런타임 — 브라우저가 demo/index.html 에서 로드하는 **그 제품 스크립트**(demo/js/*.js)를
// 서버가 직접 읽어 실행한다. 규칙 사본은 한 줄도 없다: 이 파일이 만드는 것은 실행 환경뿐이다
// (타이머 포트·표시 싱크·모달 표면·네임스페이스).
//
// #217~#244 까지는 demo/test/shared/harness.js(테스트 하네스)를 서버 런타임으로 썼다. 하네스는 범용 DOM 스텁
// (요소 트리·선택자 파서·포커스/activeElement·쿠키·웹스토리지·WebSocket 스텁)과 손으로 유지하는 200행짜리
// 심볼 노출표를 갖고 있어, 제품이 아니라 **테스트 도구**가 권위 런타임의 계약을 쥐고 있었다. 여기서 끊는다:
//   - 스크립트 목록과 순서는 demo/index.html 이 그대로 소유한다(여기서 읽는다 — 사본을 두지 않는다).
//   - 네임스페이스는 소스의 최상위 선언에서 자동으로 만든다(손으로 유지하는 노출표 없음 → 드리프트 없음).
//   - 표시 계층은 DOM 이 아니라 **최소 인메모리 표시 호환 싱크 그래프**다. 제품 코드가 쓰고 읽는 대로
//     children·parentNode, classList·속성, innerHTML·textContent·value·disabled, style·dataset 을 실제
//     가변 상태로 들고 있고, scroll·client·offset 수치와 isConnected 는 제품이 예외 없이 읽고 지나가도록 둔
//     비활성 자리값이라 갱신되지 않는다. parentNode 뒷참조는 제품의 토스트 자동 제거·아트 교체 경로가 쓴다
//     (아래 mkSink 참조).
//     없는 것은 선택자 엔진·HTML 파싱·ownerDocument·태그/노드 식별자와 nodeType 이다. 제품의
//     `liveBattleDom()`·`fxLive()` 가 `nodeType===1` 로 실물 DOM 을 확인하므로 이 싱크 위에서 liveBattleDom() 은
//     항상 false 이고, fxLive() 도 평시 서버 운영에서는 false 다(테스트 전용 스위치 `FX.force` 만 true 로 되돌릴 수 있다).
//     그래서 제품은 스스로 헤드리스 경로를 탄다(연출 재생 없음) — 서버가 규칙을 우회하는 것이 아니다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DEMO_DIR = path.join(__dirname, '..', '..', 'demo');
const INDEX_PATH = path.join(DEMO_DIR, 'index.html');

// 브라우저가 실제로 로드하는 순서 그대로. 목록의 주인은 제품 문서다.
function productFiles() {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const files = [];
  const re = /<script\s+src="js\/([A-Za-z0-9_.-]+)"\s*><\/script>/g;
  let m;
  while ((m = re.exec(html))) files.push(m[1]);
  if (!files.length) throw new Error('demo/index.html 에서 제품 스크립트 목록을 찾지 못함 — 문서 구조 변경 가능성');
  return files;
}

/* 최상위 선언 이름 수집 — 스크립트 최상위의 function·var 는 이미 전역 객체 프로퍼티지만
   const·let·class 는 전역 렉시컬 환경에만 있어 밖에서 집을 수 없다. 그래서 소스와 같은 스코프에서
   getter 를 만들어 준다(구분 없이 수집한 이름 전부에 대해 만든다 — 전역 프로퍼티인 것도 같이 노출된다).
   한 줄에 선언이 여러 개인 경우(`const COLS=7, ROWS=13;`)도 받는다.
   식별자가 아닌 후보(배열 리터럴 안의 문자열 등)는 정규식이 거르고, 그래도 남은 오탐은 아래 typeof
   가드로 undefined 가 될 뿐이라 해롭지 않다 — 빠뜨리는 쪽만 위험하고, 그건 서버 테스트가 잡는다. */
function declaredNames(src) {
  const names = new Set();
  for (const line of src.split('\n')) {
    const fn = /^(?:function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/.exec(line);
    if (fn) { names.add(fn[1]); continue; }
    if (!/^(?:const|let|var)\s/.test(line)) continue;
    const re = /(?:^(?:const|let|var)\s+|,\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*(?==|;|,|$)/g;
    let q;
    while ((q = re.exec(line))) names.add(q[1]);
  }
  return [...names];
}

function buildSource() {
  const script = productFiles().map((f) => fs.readFileSync(path.join(DEMO_DIR, 'js', f), 'utf8')).join('\n;\n');
  const getters = declaredNames(script)
    .map((n) => `get ${n}(){return typeof ${n}==="undefined"?undefined:${n};}`)
    .join(',');
  // S 는 newGame() 이 통째로 재할당하므로 getter 로 읽고(항상 최신), 쓰기도 원본 바인딩으로 보낸다.
  const tail = `\n;globalThis.__NS={${getters},set S(v){S=v;}};`;
  return { script, code: script + tail };
}

const SRC = buildSource();
// 소스는 프로세스당 한 번만 읽고 한 번만 컴파일해 엔진마다 재사용한다(실행 컨텍스트만 새로 만든다).
const SCRIPT = new vm.Script(SRC.code, { filename: path.join(DEMO_DIR, 'js', '<product>') });

/* 표시 싱크 하나 — DOM 노드가 아니라 **최소 인메모리 표시 호환 객체**다.
   제품 코드가 쓰고 읽는 대로 실제 가변 상태로 들고 있는 것: children·parentNode(아래 appendChild/removeChild),
   classList 와 setAttribute 계열 속성, innerHTML·textContent·value·disabled, style·dataset.
   src 도 평범한 가변 문자열이라 제품이 쓰면 그대로 남는다(artPortraitFail 의 폴백 경로가 이것으로 동작한다) —
   다만 저장될 뿐, 이미지 로더·onload/onerror 발화·네트워크 요청은 아무것도 일어나지 않는다.
   isConnected 와 scroll·client·offset 수치는 제품의 표시 코드가 예외 없이 읽고 지나가도록 둔 비활성 자리값이라
   갱신되지 않는다. 없는 것: 선택자 엔진(querySelector 는 언제나 빈 결과), HTML 파싱, ownerDocument,
   태그/노드 식별자, nodeType — 그래서 제품의 liveBattleDom() 은 항상 false, fxLive() 도 평시 서버 운영에서는
   false(테스트 전용 스위치 FX.force 만 예외)라 헤드리스 경로를 탄다. */
function mkSink() {
  const cls = new Set(), attrs = {};
  return {
    _html: '', textContent: '', className: '', value: '', disabled: false, onclick: null, onload: null, onerror: null,
    src: '', style: {}, dataset: {}, children: [], parentNode: null, isConnected: true,
    scrollTop: 0, scrollHeight: 0, clientHeight: 0, scrollWidth: 0, clientWidth: 0, offsetWidth: 0,
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = v; this.children.length = 0; },
    get firstChild() { return this.children[0] || null; },
    classList: {
      add(c) { cls.add(c); }, remove(c) { cls.delete(c); }, contains(c) { return cls.has(c); },
      toggle(c, on) { if (on === undefined ? cls.has(c) : !on) cls.delete(c); else cls.add(c); },
    },
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null; },
    hasAttribute(k) { return Object.prototype.hasOwnProperty.call(attrs, k); },
    removeAttribute(k) { delete attrs[k]; },
    // parentNode 뒷참조 — 제품이 자기가 붙인 요소를 다시 떼는 경로(showToast 의 2300ms 자동 제거,
    // artSpriteFail 의 토큰 교체)가 이것으로 동작한다.
    appendChild(c) { this.children.push(c); if (c) c.parentNode = this; return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); if (c) c.parentNode = null; } return c; },
    addEventListener() {}, removeEventListener() {}, focus() {}, blur() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, contains() { return false; },
  };
}

// id 레지스트리 — 요소를 처음 찾을 때 싱크를 하나 만들어 그 id 에 고정한다(id→싱크 사전 조회이지 탐색이 아니다).
function mkDisplayPort() {
  const els = Object.create(null);
  const byId = (id) => els[id] || (els[id] = mkSink());
  const body = mkSink();
  return {
    els,
    byId,
    document: {
      getElementById: byId,
      createElement: () => mkSink(),
      body,
      activeElement: body,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
  };
}

/* 주소 포트 — 제품(netServerDefault·netPublicAddr·netUiTab)이 protocol·host 만 읽는다.
   서버 엔진은 어떤 소켓도 열지 않으므로 브라우저가 html 파일을 직접 연 것과 같은 값을 고정으로 준다. */
const LOCATION = Object.freeze({
  href: 'file:///demo/index.html', protocol: 'file:', host: '', hostname: '', port: '',
  pathname: '/demo/index.html', search: '', hash: '', origin: 'null',
  toString() { return this.href; },
});

/* 엔진 하나 = 독립된 V8 컨텍스트 하나 + 그 안에서 제품 스크립트를 한 번 실행해 얻은 네임스페이스 하나.
   timers: 이 컨텍스트의 setTimeout/clearTimeout/setInterval/clearInterval 로 설치할 서버 스케줄러.
   localStorage·sessionStorage·indexedDB·WebSocket 은 **일부러 주지 않는다** — 제품의 모든 접근이 try/catch
   안이라 없으면 그냥 "저장소 없는 환경"이 되고, 권위 런타임이 어떤 영속·외부 통로도 갖지 않는다. */
function createRuntime(timers) {
  const port = mkDisplayPort();
  const sandbox = {
    console,
    document: port.document,
    location: LOCATION,
    setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout,
    setInterval: timers.setInterval, clearInterval: timers.clearInterval,
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  const context = vm.createContext(sandbox);
  SCRIPT.runInContext(context);

  const ns = sandbox.__NS;
  if (!ns || typeof ns.newGame !== 'function') throw new Error('제품 스크립트가 네임스페이스를 만들지 못함 — demo/js 구조 변경 가능성');
  // 프로토타입을 컨텍스트 전역으로 둔다 → 수집된 최상위 선언(function·var·const·let·class 전부)은 위에서
  // 만든 자체 getter 가 노출한다. 프로토타입이 공급하는 것은 수집된 선언이 아닌, 제품이 나중에 붙이는
  // window.__act·window.toLobby 같은 런타임 추가 window/전역 진입점뿐이고 그 최신값이 계속 보인다.
  Object.setPrototypeOf(ns, sandbox);

  ns.byId = port.byId;
  ns.els = port.els;
  ns.html = SRC.script; // 제품 규칙 소스 원문 — 경계 검사가 상수·본문을 원본에서 읽는다(서버 사본 금지 계약)
  ns.__vmContext = context; // ns 생존 기간 동안 컨텍스트 참조 유지

  /* 서버 권위 실행은 사람이 보는 화면이 아니다 — 연출 대기·AI 생각 지연은 0 이고, 자동 턴 종료는
     좌석 입력이 아니라 서버 판정이 몰아야 하므로 끈다. (#217 부터 이어지는 서버 엔진 계약 그대로) */
  ns.BAL.aiDelay = 0;
  ns.BAL.simDelay = 0;
  if (ns.BAL.fx) ns.BAL.fx.autoEnd = false;
  return ns;
}

module.exports = { createRuntime, productFiles, PRODUCT_SOURCE: SRC.script };
