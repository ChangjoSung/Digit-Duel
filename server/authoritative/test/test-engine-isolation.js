'use strict';
// #217 v3 — 룸마다 완전히 분리된 V8 컨텍스트(engine.js) 검증.
// Mercury 사전 감사(acceptance-audit.md "PD 추가 확인")의 핵심 주장을 직접 증명한다:
// (1) 엔진 로드/구동이 진짜 프로세스 global(setTimeout/setInterval/clearInterval 등)을 절대 건드리지 않는다.
// (2) 진짜 네이티브 타이머(room.js 이탈 유예, server.js heartbeat/sweeper가 쓰는 것과 같은 종류)는
//     엔진을 만들고 쓰는 동안에도 계속 정상 작동한다.
// (3) 여러 룸이 동시에 살아 있어도 서로의 상태(S·NET·가짜 타이머 큐)를 절대 보지 못한다.
// (4) 한 룸의 엔진 실행 중 예외가 나도 다른 룸·프로세스 전역은 오염되지 않는다.
const { createEngine, withEngine } = require('../engine');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  // ===== (1) 진짜 프로세스 global 정체성 불변 =====
  const realSetTimeout = global.setTimeout;
  const realSetInterval = global.setInterval;
  const realClearInterval = global.clearInterval;
  const realClearTimeout = global.clearTimeout;
  const realDocument = global.document;

  const T1 = createEngine();
  const T2 = createEngine();
  const T3 = createEngine();

  ok(global.setTimeout === realSetTimeout, '엔진 3개 로드 후에도 진짜 global.setTimeout 정체성 불변');
  ok(global.setInterval === realSetInterval, '엔진 3개 로드 후에도 진짜 global.setInterval 정체성 불변 (v2 회귀 지점 — 제품 스크립트가 로드 중 setInterval 을 건다)');
  ok(global.clearInterval === realClearInterval, '엔진 3개 로드 후에도 진짜 global.clearInterval 정체성 불변');
  ok(global.clearTimeout === realClearTimeout, '엔진 3개 로드 후에도 진짜 global.clearTimeout 정체성 불변');
  ok(global.document === realDocument, '엔진 3개 로드 후에도 진짜 global.document 정체성 불변 (보통 undefined)');

  // #245 — 종전 `startMode('pvp')`(ui.js)는 newGame 에 표시 초기화·렌더를 덧붙인 래퍼였다. 규칙 3종만 싣는
  // 권위 런타임에서 새 경기를 만드는 자리는 state.js 의 newGame 하나다(그 래퍼가 부르던 것도 이것이다).
  withEngine(T1, () => { T1.setSeed(1); T1.newGame('pvp', {}); });
  withEngine(T2, () => { T2.setSeed(2); T2.newGame('pvp', {}); });
  withEngine(T3, () => { T3.setSeed(3); T3.newGame('pvp', {}); });

  ok(global.setTimeout === realSetTimeout, '새 경기 생성 후에도 진짜 global.setTimeout 정체성 불변');
  ok(global.setInterval === realSetInterval, '새 경기 생성 후에도 진짜 global.setInterval 정체성 불변');

  // ===== (2) 네이티브 setInterval이 엔진 사용 중에도 실제로 흐른다 =====
  let ticks = 0;
  const iv = realSetInterval(() => { ticks++; }, 5);
  if (iv.unref) iv.unref();
  for (let i = 0; i < 20; i++) {
    withEngine(T1, () => { T1.applyAction({ t: 'skipMain' }); });
    withEngine(T2, () => { T2.applyAction({ t: 'skipMain' }); });
  }
  await sleep(60);
  realClearInterval(iv);
  ok(ticks > 0, '엔진들을 번갈아 구동하는 동안 진짜 setInterval이 실제로 발화함 (콜백 소비 " + ticks + "회) — v2였다면 0');

  // ===== (3) 룸 간 완전 격리 — 상태·호스트 포트·타이머 큐 =====
  ok(T1.S !== T2.S && T2.S !== T3.S, '세 엔진의 S가 서로 다른 객체');
  // #245 — 종전 NET 자리. 좌석·재생 질의를 담는 호스트 포트도 엔진마다 독립이어야 한다(UI_PORT 자체도 컨텍스트마다 새 객체).
  ok(T1.host !== T2.host && T1.UI_PORT !== T2.UI_PORT, '세 엔진의 호스트 포트가 서로 다른 객체');
  ok(T1.scheduler !== T2.scheduler && T2.scheduler !== T3.scheduler, '세 엔진의 서버 스케줄러(타이머 큐)가 서로 다른 인스턴스');
  T1.scheduler.setTimeout(() => {}, 100);
  ok(T1.scheduler.pending() === 1 && T2.scheduler.pending() === 0, 'T1에 예약한 타이머는 T2 큐에 보이지 않음');
  T1.drain();
  T1.host.seat = 0;
  ok(T2.host.seat === null && T2.UI_PORT.seat() === null, 'T1의 좌석을 건드려도 T2의 좌석 시점은 무영향');
  T1.S.turnCount = 999;
  ok(T2.S.turnCount !== 999, 'T1.S를 건드려도 T2.S는 무영향');

  // ===== (4) 한 엔진의 예외가 다른 엔진·프로세스 전역을 오염시키지 않는다 =====
  let threw = false;
  try {
    withEngine(T3, () => { T3.applyAction(null); }); // 원본 applyAction은 a.pick 접근에서 방어가 없다 — null이면 TypeError
  } catch (e) { threw = true; }
  ok(threw, 'T3에 고의로 깨진 액션을 넣으면 예외가 남');
  ok(global.setTimeout === realSetTimeout, 'T3 예외 이후에도 진짜 global.setTimeout 정체성 불변');
  ok(global.setInterval === realSetInterval, 'T3 예외 이후에도 진짜 global.setInterval 정체성 불변');
  // T1/T2는 T3의 예외와 무관하게 계속 정상 동작해야 한다.
  const beforeTurn = T1.S.turnCount;
  withEngine(T1, () => { T1.applyAction({ t: 'skipMain' }); });
  ok(T1.S.mainUsed === true, 'T3가 예외를 던진 뒤에도 T1은 계속 정상 동작함');

  console.log(`engine-isolation: ${pass} passed, ${fail} failed`);
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
