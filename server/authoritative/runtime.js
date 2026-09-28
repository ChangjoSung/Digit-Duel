'use strict';
// #245 서버 권위 런타임 — 브라우저가 demo/index.html 에서 로드하는 **그 제품 스크립트**를 서버가 직접 읽어
// 실행한다. 규칙 사본은 한 줄도 없다: 이 파일이 만드는 것은 실행 환경뿐이다.
//
// #245 최종 tranche — 싣는 것은 **브라우저 비의존 3종(data.js·state.js·core.js)뿐**이다.
// 종전에는 index.html 의 스크립트 목록 전체(ui.js·ai.js·ui-overlays.js·network.js·bootstrap.js 포함)를 실어
// 놓고, 그 표시 코드가 헤드리스로 지나가도록 서버가 document 싱크·window·타이머 전역을 세워 줬다. 즉
// **권위 런타임이 표시 계층을 통째로 안고 있었다.** 이제는 아니다:
//   - state.js 의 UI_PORT 가 Data·State·Core 가 바깥을 부르는 유일한 통로다(event·defer·seat·replaying).
//     서버는 그 네 자리만 채운다 — document·window·location·setTimeout·localStorage·WebSocket 은 **하나도 없다**.
//   - defer 는 기본값(false) 그대로 둔다: 연출이 없는 런타임에서 Core 는 이어지는 액션을 그 자리에서 실행한다
//     (도망 교환·탐색 완료 래치가 화면 없이도 멈추지 않는다). 그래서 제품이 예약하는 타이머 자체가 없다.
//   - 네임스페이스는 소스의 최상위 선언에서 자동으로 만든다(손으로 유지하는 노출표 없음 → 드리프트 없음).
// 표시 이벤트를 회선 fx 프레임으로 옮기는 호환 계층은 engine.js·uicompat.js 가 맡는다 — 규칙은 여기에도
// 거기에도 없다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DEMO_DIR = path.join(__dirname, '..', '..', 'demo');
const INDEX_PATH = path.join(DEMO_DIR, 'index.html');

// 권위 런타임이 싣는 제품 스크립트 — 순서는 index.html 과 같은 상대 순서다(아래 productFiles 가 대조한다).
const AUTHORITATIVE_FILES = Object.freeze(['data.js', 'state.js', 'core.js']);

// 브라우저가 실제로 로드하는 목록을 읽어, 위 3종이 **그 문서에 그 순서로** 실려 있는지 확인한다.
// 목록의 주인은 제품 문서이고 서버는 그중 규칙 3종만 고른다 — 파일이 사라지거나 순서가 뒤집히면 여기서 걸린다.
function productFiles() {
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const listed = [];
  const re = /<script\s+src="js\/([A-Za-z0-9_.-]+)"\s*><\/script>/g;
  let m;
  while ((m = re.exec(html))) listed.push(m[1]);
  if (!listed.length) throw new Error('demo/index.html 에서 제품 스크립트 목록을 찾지 못함 — 문서 구조 변경 가능성');
  const picked = listed.filter((f) => AUTHORITATIVE_FILES.includes(f));
  if (picked.join(',') !== AUTHORITATIVE_FILES.join(',')) {
    throw new Error('demo/index.html 의 규칙 스크립트 순서가 서버 계약과 다름: ' + JSON.stringify(picked));
  }
  return AUTHORITATIVE_FILES.slice();
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

/* 엔진 하나 = 독립된 V8 컨텍스트 하나 + 그 안에서 규칙 3종을 한 번 실행해 얻은 네임스페이스 하나.
   sandbox 에 두는 전역은 console 하나뿐이다 — document·window·location·타이머·localStorage·WebSocket 은
   일부러 주지 않는다. 규칙 3종이 그 무엇도 읽지 않으므로(정적 검사·서버 테스트가 대조한다) 없어도 그대로 돈다. */
function createRuntime() {
  const sandbox = { console };
  const context = vm.createContext(sandbox);
  SCRIPT.runInContext(context);

  const ns = sandbox.__NS;
  if (!ns || typeof ns.newGame !== 'function') throw new Error('제품 스크립트가 네임스페이스를 만들지 못함 — demo/js 구조 변경 가능성');
  // 프로토타입을 컨텍스트 전역으로 둔다 → 수집된 최상위 선언(function·var·const·let·class 전부)은 위에서
  // 만든 자체 getter 가 노출하고, 제품이 나중에 전역에 붙이는 값이 있으면 그 최신값이 계속 보인다.
  Object.setPrototypeOf(ns, sandbox);

  ns.html = SRC.script; // 제품 규칙 소스 원문 — 경계 검사가 상수·본문을 원본에서 읽는다(서버 사본 금지 계약)
  ns.__vmContext = context; // ns 생존 기간 동안 컨텍스트 참조 유지

  /* #245 호스트 어댑터 — state.js UI_PORT 의 네 자리를 서버 값으로 채운다. 규칙 판정·상태 전이·난수는
     이 경계를 넘어오지 않는다(state.js 계약 그대로). defer 는 기본값(false)을 **그대로 둔다** — 연출이
     없으므로 Core 가 이어지는 액션을 그 자리에서 실행한다. */
  ns.host = { seat: null, replaying: false, sink: null };
  ns.UI_PORT.seat = () => ns.host.seat;
  ns.UI_PORT.replaying = () => ns.host.replaying;
  ns.UI_PORT.event = (ev) => { if (ns.host.sink) ns.host.sink(ev); };

  /* 서버 권위 실행은 사람이 보는 화면이 아니다 — 연출 대기·AI 생각 지연은 0 이고, 자동 턴 종료는
     좌석 입력이 아니라 서버 판정이 몰아야 하므로 끈다. (#217 부터 이어지는 서버 엔진 계약 그대로) */
  ns.BAL.aiDelay = 0;
  ns.BAL.simDelay = 0;
  if (ns.BAL.fx) ns.BAL.fx.autoEnd = false;
  return ns;
}

module.exports = { createRuntime, productFiles, AUTHORITATIVE_FILES, PRODUCT_SOURCE: SRC.script };
