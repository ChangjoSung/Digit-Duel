'use strict';
// #217 v4 — 서버 스케줄러(engine.js createScheduler) 회귀. Saturn REVISE msg_9a62b8728ecf:
// "scheduler clearTimeout undefined, setTimeout returns 0, drain ignores delays and silently stops at 5 million".
// 각 단언은 그 네 결함 중 하나를 되돌리면 실패한다.
const { createScheduler, createEngine, withEngine, EngineFault } = require('../engine');
const H = require('./helpers');
const { ok, done } = H.makeCounter('scheduler');

const nativeSetTimeout = global.setTimeout;
const nativeClearTimeout = global.clearTimeout;
const nativeSetInterval = global.setInterval;
const nativeClearInterval = global.clearInterval;
function sleep(ms) { return new Promise((r) => nativeSetTimeout(r, ms)); }

async function main() {
  // ===== 1) id — 고유한 양의 정수 (v3: 항상 0) =====
  {
    const s = createScheduler();
    const ids = [s.setTimeout(() => {}, 0), s.setTimeout(() => {}, 5), s.setInterval(() => {}, 80), s.setTimeout(() => {}, 1)];
    ok(ids.every((id) => Number.isInteger(id) && id > 0), 'setTimeout/setInterval id는 양의 정수: ' + ids);
    ok(new Set(ids).size === ids.length, 'id는 서로 다름');
  }

  // ===== 2) clearTimeout이 실제로 취소한다 (v3: 엔진 컨텍스트에 clearTimeout 자체가 없었다) =====
  {
    const s = createScheduler();
    const log = [];
    const a = s.setTimeout(() => log.push('a'), 10);
    s.setTimeout(() => log.push('b'), 20);
    s.clearTimeout(a);
    s.clearTimeout(999999); // 없는 id — 무해
    const n = s.drain();
    ok(log.join() === 'b' && n === 1, 'clearTimeout으로 취소된 콜백은 실행되지 않음: ' + log.join());
    // 콜백 안에서 다른 대기 타이머 취소
    const log2 = [];
    let victim = 0;
    s.setTimeout(() => { log2.push('first'); s.clearTimeout(victim); }, 5);
    victim = s.setTimeout(() => log2.push('victim'), 10);
    s.drain();
    ok(log2.join() === 'first', '실행 중 콜백이 뒤 타이머를 취소하면 그 타이머는 발화하지 않음');
  }

  // ===== 3) 지연 순서 보존 (v3: FIFO — 지연 무시) =====
  {
    const s = createScheduler();
    const log = [];
    s.setTimeout(() => log.push('watchdog1000'), 1000);
    s.setTimeout(() => log.push('msg600'), 600);
    s.setTimeout(() => log.push('zeroA'), 0);
    s.setTimeout(() => log.push('zeroB'), 0);
    s.setTimeout(() => log.push('neg→0'), -5);
    s.setTimeout(() => log.push('nan→0'), NaN);
    s.drain();
    ok(log.join() === 'zeroA,zeroB,neg→0,nan→0,msg600,watchdog1000', '(due, 등록 순서) 오름차순: ' + log.join());
    // 중첩: 600ms 콜백이 500ms 뒤를 예약하면 가상 시각 1100 → 1000 워치독 뒤에 온다
    const s2 = createScheduler();
    const log2 = [];
    s2.setTimeout(() => { log2.push('msg@600'); s2.setTimeout(() => log2.push('next@1100'), 500); }, 600);
    s2.setTimeout(() => log2.push('watchdog@1000'), 1000);
    s2.drain();
    ok(log2.join() === 'msg@600,watchdog@1000,next@1100', '중첩 예약도 가상 시계 기준으로 정렬: ' + log2.join());
    ok(s2.now() === 1100, '가상 시계는 마지막 발화 due로 이동: ' + s2.now());
    s2.setTimeout((x, y) => log2.push('args:' + x + y), 0, 'p', 'q');
    s2.drain();
    ok(log2[log2.length - 1] === 'args:pq', 'setTimeout 추가 인자 전달');
  }

  // ===== 4) 유한성 — 예산 초과는 조용히 멈추지 않고 EngineFault + 큐 비움 (v3: 5백만에서 잔여 큐를 보존한 채 조용히 반환) =====
  {
    const s = createScheduler({ maxCallbacksPerDrain: 1000, maxVirtualMsPerDrain: 1e12 });
    let fired = 0;
    const spin = () => { fired++; s.setTimeout(spin, 0); }; // 영원히 자기 재예약(지연 0)
    s.setTimeout(spin, 0);
    let thrown = null;
    try { s.drain(); } catch (e) { thrown = e; }
    ok(thrown instanceof EngineFault && thrown.kind === 'budget_callbacks', '콜백 수 예산 초과 → EngineFault(budget_callbacks): ' + (thrown && thrown.kind));
    ok(fired === 1000 && s.pending() === 0, '예산만큼만 실행하고 잔여 큐는 비움: fired=' + fired + ' pending=' + s.pending());
    ok(s.drain() === 0, '비워진 뒤 다음 drain은 아무것도 실행하지 않음(반쯤 진행된 연출을 잇지 않음)');
  }
  {
    const s = createScheduler({ maxCallbacksPerDrain: 1e9, maxVirtualMsPerDrain: 60 * 1000 });
    let fired = 0;
    const poll = () => { fired++; s.setTimeout(poll, 1000); }; // 1초마다 끝없이 폴링
    s.setTimeout(poll, 1000);
    let thrown = null;
    try { s.drain(); } catch (e) { thrown = e; }
    ok(thrown instanceof EngineFault && thrown.kind === 'budget_time' && fired === 60 && s.pending() === 0, '가상 시간 예산 초과 → EngineFault(budget_time), 60회 후 중단·큐 비움: ' + fired);
  }
  {
    const s = createScheduler();
    const log = [];
    s.setTimeout(() => { throw new Error('boom'); }, 10);
    s.setTimeout(() => log.push('after'), 20);
    let thrown = null;
    try { s.drain(); } catch (e) { thrown = e; }
    ok(thrown instanceof EngineFault && thrown.kind === 'callback_threw' && /boom/.test(thrown.message) && thrown.cause && thrown.cause.message === 'boom', '콜백 예외 → EngineFault(callback_threw, cause 보존)');
    ok(log.length === 0 && s.pending() === 0, '예외 이후 잔여 콜백은 실행하지 않고 큐 비움(fail-closed)');
    let reent = null;
    s.setTimeout(() => { try { s.drain(); } catch (e) { reent = e; } }, 0);
    s.drain();
    ok(reent instanceof EngineFault && reent.kind === 'reentrant', '콜백 안의 재진입 drain은 거부');
  }

  // ===== 5) setInterval은 발화하지 않는 기록 — drain 유한성 보장, clearInterval로 제거 =====
  {
    const s = createScheduler();
    let ticks = 0;
    const iv = s.setInterval(() => { ticks++; }, 80);
    ok(s.intervalCount() === 1 && s.drain() === 0 && ticks === 0, 'setInterval 콜백은 drain에서 발화하지 않음(drain 유한)');
    s.clearInterval(iv);
    ok(s.intervalCount() === 0, 'clearInterval로 기록 제거');
  }

  // ===== 6) 실제 엔진 — 타이머 전역이 스케줄러로 교체되고, 네이티브 프로세스 타이머는 불변 =====
  const T1 = createEngine();
  const T2 = createEngine();
  ok(global.setTimeout === nativeSetTimeout && global.clearTimeout === nativeClearTimeout && global.setInterval === nativeSetInterval && global.clearInterval === nativeClearInterval, '엔진 생성 후 프로세스 타이머 전역 정체성 불변');
  const ctx1 = T1.__vmContext;
  ok(ctx1.setTimeout === T1.scheduler.setTimeout && ctx1.clearTimeout === T1.scheduler.clearTimeout && ctx1.setInterval === T1.scheduler.setInterval, '엔진 컨텍스트의 setTimeout/clearTimeout/setInterval은 그 엔진의 스케줄러');
  ok(T1.scheduler !== T2.scheduler && ctx1.setTimeout !== T2.__vmContext.setTimeout, '엔진마다 독립 스케줄러');
  ok(T1.TQ === undefined, '#245: harness 가짜 큐(TQ)가 런타임에 아예 없다 — 로드 중 예약도 처음부터 스케줄러가 받는다');
  // #245: 제품 스크립트 자체가 로드 중 netPump(80ms) 인터벌을 건다 — 이제 그것도 이 스케줄러가 받는다(발화는 여전히 없다).
  const iv0 = T1.scheduler.intervalCount();
  ok(iv0 >= 1, '제품 로드 중 등록된 setInterval도 스케줄러가 기록(발화 없음): ' + iv0);
  const ivId = ctx1.setInterval(() => {}, 80);
  ok(Number.isInteger(ivId) && ivId > 0 && T1.scheduler.intervalCount() === iv0 + 1, '엔진 컨텍스트 setInterval은 발화하지 않는 기록으로 등록(양의 id)');
  ctx1.clearInterval(ivId);
  ok(T1.scheduler.intervalCount() === iv0, 'clearInterval로 기록 제거');
  ok(typeof ctx1.clearTimeout === 'function', 'v3 결함: 엔진 컨텍스트에 clearTimeout이 존재');

  // 실제 게임 코드의 지연 타이머가 스케줄러로 실행된다 — 헤드리스는 fxLive()=false라 연출 지연은 0(동기)이고,
  // 남는 실제 지연은 토스트 자동 제거(2300ms) 같은 표시 타이머다. 회복 지정은 소유자 토스트를 띄운다.
  {
    const room = H.startedRoom(301);
    const cur = room.engine.S.current;
    const E = room.engines[cur];
    const own = room.toSeatView(cur).you.pieces.find((p) => p.type === 'minion');
    const sched0 = E.scheduler.stats.scheduled, fired0 = E.scheduler.stats.fired;
    const res = H.act(room, cur, { t: 'heal', id: own.id });
    const toasts = E.byId('toasts').children.length;
    ok(res.ok && E.scheduler.stats.scheduled > sched0 && E.scheduler.stats.fired > fired0, '회복 토스트의 2300ms 제거 타이머가 스케줄러에 예약·실행됨: ' + JSON.stringify(E.scheduler.stats));
    ok(E.scheduler.pending() === 0 && toasts === 0, 'drain 뒤 남는 예약 없음·토스트 제거 콜백이 실제로 돌아 DOM에서 빠짐: toasts=' + toasts);
    ok(E.scheduler.now() >= 2300, '가상 시계가 토스트 지연만큼 전진: ' + E.scheduler.now());
    ok(E.TQ === undefined, '#245: harness 가짜 큐가 존재하지 않음');
  }

  // ===== 7) 네이티브 타이머·여러 룸·오류 정리 — 엔진을 쓰는 동안 실제 setTimeout/setInterval이 계속 흐른다 =====
  {
    let ticks = 0, timeouts = 0;
    const iv = nativeSetInterval(() => { ticks++; }, 5);
    const to = nativeSetTimeout(() => { timeouts++; }, 15);
    const rooms = [H.startedRoom(302), H.startedRoom(303), H.startedRoom(304)];
    for (let k = 0; k < 6; k++) {
      for (const room of rooms) {
        if (room.state !== H.STATES.IN_PROGRESS) continue;
        const S = room.engine.S;
        if (!S.mainUsed) H.act(room, S.current, { t: 'skipMain' }); else H.act(room, S.current, { t: 'endTurn' });
      }
      await sleep(5);
    }
    // 한 룸에 오류 콜백 주입 → 그 룸만 VOID, 다른 룸·네이티브 타이머 무영향
    rooms[1].engines[1].scheduler.setTimeout(() => { throw new Error('injected'); }, 0);
    const bad = H.act(rooms[1], rooms[1].engine.S.current, rooms[1].engine.S.mainUsed ? { t: 'endTurn' } : { t: 'skipMain' });
    ok(!bad.ok && bad.reason === 'E_INTERNAL' && rooms[1].state === H.STATES.VOID && rooms[1].engines === null, '오류 룸만 VOID·엔진 해제');
    const before0 = rooms[0].revision, before2 = rooms[2].revision;
    const r0 = H.act(rooms[0], rooms[0].engine.S.current, rooms[0].engine.S.mainUsed ? { t: 'endTurn' } : { t: 'skipMain' });
    const r2 = H.act(rooms[2], rooms[2].engine.S.current, rooms[2].engine.S.mainUsed ? { t: 'endTurn' } : { t: 'skipMain' });
    ok(r0.ok && r2.ok && rooms[0].revision === before0 + 1 && rooms[2].revision === before2 + 1, '다른 룸들은 계속 정상 진행');
    // 룸 이탈 유예 타이머(네이티브 setTimeout)도 발화한다
    const grace = H.setupRoom(305, { graceMs: 20 });
    grace.socketClosed(1);
    await sleep(80);
    nativeClearInterval(iv);
    nativeClearTimeout(to);
    ok(ticks > 0, '엔진 구동 중에도 네이티브 setInterval 발화: ' + ticks);
    ok(timeouts === 1, '엔진 구동 중에도 네이티브 setTimeout 발화');
    ok(grace.state === H.STATES.CANCELED, '룸 유예 타이머(네이티브) 만료 → CANCELED');
  }

  done();
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
