'use strict';
// #217 서버 권위 규칙 엔진 어댑터 — demo/index.html의 실제 규칙 엔진을 서버가 헤드리스로 직접 구동한다.
// 새 규칙 모듈을 만들지 않고 Mars의 기존 헤드리스 하네스(demo/test/shared/harness.js)를 그대로 재사용한다.
// demo/**는 읽기만 한다 — 이 파일은 server/authoritative/에 있다.
//
// 실행 환경 격리 (v3부터): 엔진마다 완전히 분리된 V8 컨텍스트(Node vm)에서 harness.js 자체를 실행한다.
// harness가 `global.setTimeout=...` 등을 덮어써도 그 컨텍스트의 global 하나에만 적용되고 실제 프로세스의
// global(server.js heartbeat/sweeper, room.js 이탈 유예 타이머)은 절대 건드리지 않는다.
//
// v4 — 서버 스케줄러 (Saturn REVISE msg_9a62b8728ecf): harness의 가짜 타이머는 clearTimeout이 없고, setTimeout이
// 항상 0을 돌려주며, drain이 지연 시간을 무시하고 FIFO로 돌다가 5백만 콜백에서 **조용히** 멈췄다. 게임은 연출
// 지연(msgStep 600ms·roundEndFx 1000ms·watchdog 1000ms …)의 **상대 순서**에 의존한다 — 브라우저에서는 600ms
// 메시지가 1000ms 워치독보다 먼저 온다. 그래서 load() 직후 이 컨텍스트의 타이머 전역을 아래 createScheduler()로
// 교체한다:
//   - setTimeout(fn, delay, ...args) → 고유한 양의 정수 id. 가상 시계 기준 due = now + max(0, delay).
//   - clearTimeout(id) → 실제로 취소한다.
//   - drain() → (due, 등록 순서) 오름차순으로 실행하고 가상 시계를 due로 옮긴다(브라우저의 지연 순서 보존).
//     한 번의 drain이 콜백 수 예산(maxCallbacks) 또는 가상 시간 예산(maxVirtualMs)을 넘기면 **남은 큐를 비우고
//     EngineFault를 던진다** — 조용히 멈추지 않는다. 콜백이 예외를 던져도 큐를 비우고 EngineFault로 감싸 던진다.
//     호출자(room.js)는 그 룸을 VOID(NO_CONTEST, E_INTERNAL)로 닫는다(fail-closed).
//   - setInterval(fn, delay) → 고유 id를 돌려주되 **발화하지 않는다**. index.html의 setInterval은 두 곳뿐이다:
//     netPump(80ms, 락스텝 릴레이 수신 큐 펌프 — 서버는 applyAction을 직접 부르므로 NET.queue가 항상 비어 있다)와
//     netResumeTick(1000ms, 클라이언트 재접속 재시도). 둘 다 규칙 상태를 만들지 않으며, 끝없이 반복되는 콜백을
//     drain 안에서 돌리면 drain이 유한할 수 없다. clearInterval(id)는 기록을 지운다.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HARNESS_PATH = path.join(__dirname, '..', '..', 'demo', 'test', 'shared', 'harness.js');
const HARNESS_DIR = path.dirname(HARNESS_PATH);
const HARNESS_SRC = fs.readFileSync(HARNESS_PATH, 'utf8');
// 소스는 프로세스당 한 번만 읽고 vm.Script로 한 번만 컴파일해 엔진마다 재사용한다(실행 컨텍스트만 새로 만든다).
const HARNESS_SCRIPT = new vm.Script(HARNESS_SRC, { filename: HARNESS_PATH });

const DEFAULT_MAX_CALLBACKS_PER_DRAIN = 200000;
// 한 행동이 만드는 연출 체인의 가상 시간 상한. 가장 긴 정상 체인(10라운드 전투의 메시지 재생·배너·워치독)도
// 수십 초 수준이다 — 30분은 "끝나지 않는 예약 루프"만 잡는 넉넉한 경계다.
const DEFAULT_MAX_VIRTUAL_MS_PER_DRAIN = 30 * 60 * 1000;

class EngineFault extends Error {
  constructor(kind, message, cause) {
    super(message);
    this.name = 'EngineFault';
    this.kind = kind; // 'budget_callbacks' | 'budget_time' | 'callback_threw'
    if (cause) this.cause = cause;
  }
}

function createScheduler(opts) {
  opts = opts || {};
  const maxCallbacks = opts.maxCallbacksPerDrain || DEFAULT_MAX_CALLBACKS_PER_DRAIN;
  const maxVirtualMs = opts.maxVirtualMsPerDrain || DEFAULT_MAX_VIRTUAL_MS_PER_DRAIN;
  const timers = new Map(); // id -> {id, fn, args, due, order}
  const intervals = new Set();
  let nextId = 1;
  let order = 0;
  let now = 0;
  let draining = false;
  const stats = { scheduled: 0, cleared: 0, fired: 0, drains: 0 };

  function toDelay(delay) {
    const d = Number(delay);
    return Number.isFinite(d) && d > 0 ? d : 0;
  }

  function setTimeoutV(fn, delay, ...args) {
    const id = nextId++;
    if (typeof fn !== 'function') return id; // 문자열 코드 평가는 지원하지 않는다(브라우저 전용 경로도 쓰지 않는다)
    timers.set(id, { id, fn, args, due: now + toDelay(delay), order: order++ });
    stats.scheduled++;
    return id;
  }

  function clearTimeoutV(id) {
    if (timers.delete(id)) stats.cleared++;
  }

  function setIntervalV() {
    const id = nextId++;
    intervals.add(id);
    return id;
  }

  function clearIntervalV(id) {
    intervals.delete(id);
    clearTimeoutV(id);
  }

  function pickNext() {
    let best = null;
    for (const t of timers.values()) {
      if (!best || t.due < best.due || (t.due === best.due && t.order < best.order)) best = t;
    }
    return best;
  }

  function clear() {
    timers.clear();
    intervals.clear();
  }

  function drain() {
    if (draining) throw new EngineFault('reentrant', 'scheduler.drain() re-entered');
    draining = true;
    stats.drains++;
    const start = now;
    let n = 0;
    try {
      for (;;) {
        const t = pickNext();
        if (!t) break;
        if (n >= maxCallbacks) {
          throw new EngineFault('budget_callbacks', `drain exceeded ${maxCallbacks} callbacks (pending ${timers.size})`);
        }
        if (t.due - start > maxVirtualMs) {
          throw new EngineFault('budget_time', `drain exceeded ${maxVirtualMs}ms virtual time (pending ${timers.size})`);
        }
        timers.delete(t.id);
        now = t.due;
        n++;
        stats.fired++;
        try {
          t.fn.apply(undefined, t.args);
        } catch (e) {
          throw new EngineFault('callback_threw', 'engine timer callback threw: ' + (e && e.message), e);
        }
      }
      return n;
    } catch (e) {
      clear(); // 실패한 drain의 잔여 큐를 남기지 않는다 — 다음 호출이 반쯤 진행된 연출을 이어 돌리지 않게
      throw e;
    } finally {
      draining = false;
    }
  }

  return {
    setTimeout: setTimeoutV,
    clearTimeout: clearTimeoutV,
    setInterval: setIntervalV,
    clearInterval: clearIntervalV,
    drain,
    clear,
    pending: () => timers.size,
    intervalCount: () => intervals.size,
    now: () => now,
    stats,
  };
}

function sandboxRequire(specifier) {
  // harness.js는 require("fs")·require("path")만 쓴다. 내장 모듈은 상태를 공유하지 않는 순수 함수 묶음이다.
  if (specifier === 'fs' || specifier === 'path') return require(specifier);
  throw new Error('server/authoritative/engine.js sandbox: unexpected require("' + specifier + '")');
}

// 엔진 하나 = 독립된 V8 컨텍스트 하나 + 그 안에서 harness.load()를 한 번 실행해 얻은 인스턴스 하나.
function createEngine(opts) {
  const sandbox = {};
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.console = console;
  // harness.js(mkLocation)가 URL을 bare 식별자로 쓴다 — 새 vm 컨텍스트에는 기본으로 없다.
  sandbox.URL = URL;
  sandbox.URLSearchParams = URLSearchParams;
  const context = vm.createContext(sandbox);

  const moduleObj = { exports: {} };
  sandbox.module = moduleObj;
  sandbox.exports = moduleObj.exports;
  sandbox.require = sandboxRequire;
  sandbox.__filename = HARNESS_PATH;
  sandbox.__dirname = HARNESS_DIR;

  HARNESS_SCRIPT.runInContext(context);
  const harnessExports = moduleObj.exports;
  if (typeof harnessExports.load !== 'function') throw new Error('harness.js가 module.exports.load를 노출하지 않음 — 계약 변경 가능성');

  const T = harnessExports.load();

  // 타이머 전역을 서버 스케줄러로 교체한다(위 머리 주석). load() 도중 harness 가짜 큐에 쌓인 콜백이 있으면
  // 등록 순서대로 지연 0으로 옮긴다(harness 큐는 지연을 기록하지 않았다).
  const sched = createScheduler(opts);
  sandbox.setTimeout = sched.setTimeout;
  sandbox.clearTimeout = sched.clearTimeout;
  sandbox.setInterval = sched.setInterval;
  sandbox.clearInterval = sched.clearInterval;
  for (const fn of T.TQ.splice(0)) sched.setTimeout(fn, 0);
  T.scheduler = sched;
  T.drain = sched.drain;

  // 브라우저에서 overlayBox.innerHTML 교체는 그 안의 옛 #obBtns(와 버튼)를 없앤다. 하네스 스텁은 id 레지스트리라
  // obBtns 요소가 재사용돼 버튼이 누적된다 — 동기화 모달의 버튼 인덱스·disabled 판정이 어긋난다.
  // 기존 락스텝 회귀(demo/test/regression/smoke_online_sync.js load())와 같은 방식으로 브라우저 의미를 복원한다.
  const box = T.byId('overlayBox');
  const ob = T.byId('obBtns');
  Object.defineProperty(box, 'innerHTML', {
    configurable: true,
    get() { return this._html; },
    set(v) { this._html = v; this.children.length = 0; ob.children.length = 0; },
  });

  T.__vmContext = context; // T 생존 기간 동안 컨텍스트 참조 유지
  ensureFxCapture(T);
  return T;
}

// ===== #217 전투 표시 이벤트(fx) 캡처 =====
// Mars/report.md §6: 서버 snapshot·사람이 읽는 battle.log만으로는 라운드 배너·타격 플래시·승패 배너를 복원할
// 수 없다. demo/index.html은 이미 구조화된 표시 신호를 만든다 — bmsg(txt,fx,opts)가 S.battle.msgQ에 파는
// {txt,fx,key,big}, fxPlay(item)가 헤드리스에서도 FX.log에 남기는 {key,title,sub,kind,turn,ms,t,shown}(1602행,
// ms<=0 조기 반환보다 먼저 실행되는 진단 기록). 문제는 헤드리스 재생 경로(playMsgs)가 그 값을 소비 직후
// 버린다는 것뿐이다(liveBattleDom()===false → MSGQ.length=0). 아래 훅은 그 값이 사라지기 전에 "이미 만들어진
// 값"을 그대로 옮겨 담을 뿐 — 규칙 함수를 호출하지도, 새 값을 계산하지도, bmsg/fxPlay 자체를 재바인딩하지도
// 않는다(내부 코드는 여전히 원본 함수를 그대로 호출한다 — 이 파일이 관찰하는 것은 그 함수들이 이미 쓰는
// 공유 가변 배열의 push 호출 순간뿐이다). demo/index.html·harness.js는 건드리지 않는다 — 위 197행
// Object.defineProperty(box,'innerHTML',...)와 같은 기법을 배열 인스턴스에 적용한다(새 패턴 아님).
const FX_RETAIN = 40; // 기존 battle.log/room log의 .slice(-40) 관례와 동일 크기로 통일 — 유한 보관

// #217 PD REVISE(msg_c0657afb7242) 대응: countStep/roundBanner의 fxPlay 호출 자체가 `if(fxLive())` 안에 있어
// (index.html:3353·3357) 헤드리스에서는 호출조차 되지 않는다 — FX.log 훅만으로는 절대 복구할 수 없다. 대신
// demo/index.html이 **이미 계산해 battle 객체에 써 두는 확정 상태**(`battle.intro`·`battle.bannerKey` — 원본이
// "이 배너를 이미 보여줬다"를 추적하려고 스스로 세우는 플래그, 헤드리스에서도 그대로 세워진다)를 그대로
// 읽어 "지금 이 전환에 배너가 필요하다"만 판단하고, 실제 문구는 원본이 노출하는 순수 함수(`actorOfPhase`·
// `fxTurnLabel`·`viewerIsOwner` — 전부 harness.js가 이미 T에 노출)를 그대로 호출해 얻는다. 규칙 함수 호출도
// 새 판정도 없다 — 확정된 상태 전환 근거로만 선언적 신호를 만든다(원 태스크 계약 그대로).
function fxAppend(T, evt) {
  const store = T.__fx;
  evt.seq = store.nextSeq++;
  store.items.push(evt);
  if (store.items.length > FX_RETAIN) store.items.splice(0, store.items.length - FX_RETAIN);
}

// bmsg()의 float 표시는 고정 템플릿(<span class="pos|neg">±숫자</span>) 하나뿐이다 — 자유 텍스트 로그를
// 파싱해 효과를 추론하는 것이 아니라, 이미 구조화된 부호+숫자를 감싼 고정 포맷을 그대로 디코드하는 것이다.
const FLOAT_RE = /^<span class="(pos|neg)">([+-]?\d+)<\/span>$/;
function decodeFloat(f) {
  if (!f || typeof f.html !== 'string') return undefined;
  const m = FLOAT_RE.exec(f.html);
  if (!m || (f.side !== 'A' && f.side !== 'D')) return undefined;
  return { side: f.side, sign: m[1], amount: Math.abs(Number(m[2])) || 0 };
}

// bmsg의 fx 인자를 알려진 원시 필드만 남기고 재구성한다 — 객체를 통째로 전달하지 않는다
// (room.js _serializeOwn/_serializeBattle 등 기존 화이트리스트 관례와 동일). piece·DOM·함수 참조는 여기 없다.
function normalizeMsgFx(fx) {
  if (!fx || typeof fx !== 'object') return null;
  const out = {};
  if (fx.shake === 'A' || fx.shake === 'D') out.shake = fx.shake;
  if (fx.sig === true) out.sig = true;
  if (typeof fx.flash === 'string') out.flash = fx.flash;
  if (fx.ko === 'A' || fx.ko === 'D') out.ko = fx.ko;
  const float = decodeFloat(fx.float);
  if (float) out.float = float;
  if (fx.hp && (fx.hp.side === 'A' || fx.hp.side === 'D')) {
    out.hp = { side: fx.hp.side, val: Number(fx.hp.val) || 0, max: Number(fx.hp.max) || 0 };
  }
  if (fx.st && (fx.st.side === 'A' || fx.st.side === 'D')) {
    out.st = {
      side: fx.st.side, text: typeof fx.st.text === 'string' ? fx.st.text : '',
      shield: Number(fx.st.shield) || 0, max: Number(fx.st.max) || 0,
    };
  }
  return Object.keys(out).length ? out : null;
}

// bmsg가 만드는 항목의 모양(index.html:3593 `{txt,fx:fx||null,key:...,big:!!...}`)에만 반응한다 — 다른 배열
// (S.pieces·DOM children 등)에 우연히 이 4개 키가 다 있을 가능성은 사실상 없고, 있어도 push를 원본에 그대로
// 위임하므로 게임 동작에는 영향이 없다(잘못 캡처돼도 표시 전용 부가 데이터가 늘어날 뿐).
function isBmsgItem(v) {
  return !!v && typeof v === 'object' && typeof v.txt === 'string' && 'fx' in v && 'key' in v && typeof v.big === 'boolean';
}

// S.battle.msgQ는 전투마다 새로 만들어지는 배열이다(initBattle) — 이 배열 "인스턴스"에만 push를 얹는다
// (Array.prototype은 건드리지 않는다 — 다른 배열·다른 엔진(좌석)은 전혀 영향받지 않는다).
function hookMsgQ(T, msgQ) {
  if (!Array.isArray(msgQ) || msgQ.__ddHooked) return;
  Object.defineProperty(msgQ, '__ddHooked', { value: true, enumerable: false, configurable: true });
  const realPush = Array.prototype.push;
  msgQ.push = function pushAndCapture(...items) {
    for (const it of items) {
      if (!isBmsgItem(it)) continue;
      try {
        const S = T.S, B = S && S.battle;
        fxAppend(T, {
          src: 'msg', battleId: T.__fx.lastBattleId || null,
          round: B ? B.round : null, actSeq: B ? (B.actSeq || 0) : null,
          key: it.key || null, big: !!it.big, txt: it.txt, fx: normalizeMsgFx(it.fx),
        });
      } catch (e) { /* 캡처 실패는 표시 계층 손실일 뿐 — 게임 진행을 막지 않는다(원본 push는 아래에서 계속 진행) */ }
    }
    return realPush.apply(this, items);
  };
}

// 전투 한 쪽(공격/방어)의 "겉모습 정체"만 — room.js _serializeBattle의 side() 화이트리스트와 완전히 같은
// 필드(owner,type,element,bodyFight,rosterId,artRosterId)만 남긴다. hp·shield·skills·cap 등은 절대 포함하지
// 않는다(#217 PD REVISE 5번 "private raw id/cap/미공개기술 등 금지 필드" — scene은 규칙 판정에 안 쓰이는
// 표시 전용 스냅샷이라 room.js가 매 프레임 재구성하는 battle.a/d보다 더 적게만 담는다). room.js와 필드
// 목록이 갈리면 안 되므로 바뀌면 양쪽을 함께 고친다(battle-fx-protocol.md에 명시).
function sceneSideOf(f, piece) {
  const bodyFight = f === piece;
  return {
    owner: piece.owner, type: piece.type, element: f.element || null, bodyFight,
    rosterId: bodyFight && piece.type === 'minion' ? (piece.rosterId || null) : null,
    artRosterId: bodyFight ? null : (f.artRosterId || null),
  };
}
function sceneOf(battle) {
  return { a: sceneSideOf(battle.fa, battle.attP), d: sceneSideOf(battle.fd, battle.defP) };
}

// 이 시점(stage 이벤트 캡처 시점)에 표시해야 할 battleId — 전투가 아직 열려 있으면 그 전투, 막 끝나
// battle=null이 된 직후의 트레일링 배너(resultBanner)는 직전 전투의 것을 그대로 쓴다(§2 "종료 문맥").
// 전투와 무관한 배너(턴/접촉/밀기/도망)는 배틀이 없으면 null — 옛 전투에 잘못 걸리지 않는다.
// Saturn REVISE(startedRoom(1874206), fx-qa-revise.md P1 #2) — "직전 전투의 것을 그대로 쓴다"는 그 전투가
// 끝난 바로 그 withEngine 호출(=그 resultBanner를 실제로 만든 호출) 안에서만 참이다. 예전 코드는 lastBattleId를
// 영구히 반환해, 한참 뒤 완전히 무관한 사유(예: 별도의 gameOver(0,"king"))로 생긴 resultBanner에도 옛
// battleId·scene이 계속 달라붙었다 — "그 결과가 실제로 그 전투에서 유래했을 때만" 붙여야 한다. hookBattleAccessor의
// set(null)이 배틀이 닫히는 바로 그 withEngine 세대(T.__fx.gen)를 T.__fx.resultCtxGen에 남겨 두므로, 지금
// 세대가 그것과 같을 때만(=같은 호출 안에서 난 트레일링 배너일 때만) lastBattleId를 이어 붙인다.
function currentBattleIdFor(T, key) {
  if (T.S && T.S.battle) return T.__fx.lastBattleId || null;
  if (key === 'resultBanner' && T.__fx.resultCtxGen === T.__fx.gen) return T.__fx.lastBattleId || null;
  return null;
}

// S.battle은 전투마다 재할당된다(index.html:2956 initBattle) — "대입되는 순간"을 놓치지 않도록 S 인스턴스당
// 1회 접근자를 건다. get/set은 그대로 backing 변수를 오가므로 JSON.stringify(S)·lockstepDigest 등 기존 관찰
// 지점의 값·타이밍은 전혀 바뀌지 않는다(__ddFxHooked는 non-enumerable이라 직렬화에도 잡히지 않는다).
// 새 battle이 열리는 이 순간에 battleId를 새로 발급하고(룸/엔진 수명 동안 유일·재사용 없음) 공개 scene을
// 한 번 떠 둔다 — battle=null 이후에도(§2) T.__fx.lastBattleId/lastScene에 남아 트레일링 이벤트가 참조한다.
// 여기서 emit하는 declarative "battleStart"는 원본이 진짜로 재생했을 카운트다운(3·2·1·배틀 시작!)의 문구를
// 서버가 새로 짓지 않는다 — 그 4개 문구는 상태와 무관한 고정 상수라 서버가 알 근거가 없다. 서버는 "지금
// 카운트다운을 재생해도 되는 확정 근거(전투 시작)"만 선언하고, 실제 프레임 구성은 Mars 표시 계층이 맡는다.
function hookBattleAccessor(T, S) {
  if (!S || Object.prototype.hasOwnProperty.call(S, '__ddFxHooked')) return;
  let backing = S.battle;
  Object.defineProperty(S, 'battle', {
    configurable: true, enumerable: true,
    get() { return backing; },
    set(v) {
      const wasOpen = !!backing;
      backing = v;
      if (v && Array.isArray(v.msgQ)) {
        hookMsgQ(T, v.msgQ);
        T.__fx.battleSeq = (T.__fx.battleSeq || 0) + 1;
        T.__fx.lastBattleId = T.__fx.battleSeq;
        try { T.__fx.lastScene = sceneOf(v); } catch (e) { T.__fx.lastScene = null; }
        fxAppend(T, { src: 'stage', turn: T.S && typeof T.S.turnCount === 'number' ? T.S.turnCount : null,
          key: 'battleStart', kind: 'count', title: '', sub: '',
          battleId: T.__fx.lastBattleId, scene: T.__fx.lastScene });
        return;
      }
      // Saturn REVISE(fx-qa-revise.md P1 #2) — 전투가 방금(이 대입으로) 닫혔다면, "직전 전투 문맥을 그대로
      // 이어 붙여도 되는" 창을 이번 withEngine 호출(T.__fx.gen)로만 한정한다. currentBattleIdFor가 같은
      // 세대의 resultBanner에만 이 값을 소비하므로, 이후 완전히 다른(무관한) 호출에서 난 resultBanner는
      // 자동으로 battleId:null이 된다 — "결과가 실제로 그 전투에서 유래했을 때만" 문맥을 붙인다.
      if (wasOpen) T.__fx.resultCtxGen = T.__fx.gen;
    },
  });
  Object.defineProperty(S, '__ddFxHooked', { value: true, enumerable: false, configurable: true });
  if (backing && Array.isArray(backing.msgQ)) hookMsgQ(T, backing.msgQ);
}

// FX.log는 게임 내내 재할당되지 않는 module-scope 객체(const FX={...,log:[]})의 프로퍼티라 1회만 걸면 된다.
// 여기 실리는 것은 fxLive()===true 여야만 fxPlay가 실제로 큐잉하는 배너 중, 그래도 헤드리스에서 무조건
// 호출되는 것들뿐이다(turnBanner·contactBanner·pushBanner·fleeFx 등 — 호출부 자체에 fxLive() 게이트가 없는
// 것들). countStep/roundBanner처럼 호출부 자체가 `if(fxLive())`로 감싸인 것은 여기 절대 안 걸린다 — 그건
// hookBattleAccessor의 battleStart·아래 syncRoundBanner가 대신 담당한다(PD REVISE 1번).
// explosion/trapFx는 **일부러 여기서 건너뛴다**: Mars 훅(§5)이 있으면 hookFxCellsQueue(아래
// ensureFxCellsQueue)가 cells까지 채운 완전한 이벤트를 S.__ddFxCells.push 호출 그 순간(원래 FX 지점)에
// 만든다 — 여기서도 똑같이 만들면 좌표 없는 것 하나 + 좌표 있는 것 하나, 실제로는 하나뿐인 폭발/함정이
// 이벤트 두 개로 중복된다(2026-09-13 실측으로 발견·수정). Mars 훅이 아직 없으면(오래된 demo 빌드)
// S.__ddFxCells가 항상 비어 있으므로 이 두 키는 그 순간 아무 이벤트도 못 만든다 — "신호는 있는데 좌표만
// 없음"보다 "훅이 붙으면 완전한 신호, 안 붙으면 무신호"가 Mars 쪽에서 분기 처리하기 더 단순하고, 실제로
// 이 branch가 실행될 시점(오늘 기준)엔 이미 훅이 반영돼 있다.
function hookFxLog(T) {
  const log = T.FX && T.FX.log;
  if (!Array.isArray(log) || log.__ddHooked) return;
  Object.defineProperty(log, '__ddHooked', { value: true, enumerable: false, configurable: true });
  const realPush = Array.prototype.push;
  log.push = function pushAndCapture(...items) {
    for (const it of items) {
      try {
        const key = it.key || null;
        if (key === 'explosion' || key === 'trapFx') continue; // hookFxCellsQueue가 대신 담당(아래 주석)
        const battleId = currentBattleIdFor(T, key);
        // Saturn REVISE(fx-qa-revise.md P1 #2) — scene도 battleId와 같은 조건으로만 동봉한다: 이 resultBanner가
        // 실제로 직전 전투에서 유래했다고 판정됐을 때(battleId != null)만 그 무대를 붙인다. 무관한 resultBanner에
        // battleId:null만 붙이고 scene은 그대로 옛 것을 남기면 절반만 고친 것이 된다.
        fxAppend(T, {
          src: 'stage', battleId,
          turn: typeof it.turn === 'number' ? it.turn : null,
          key, kind: it.kind || 'banner',
          title: typeof it.title === 'string' ? it.title : '', sub: typeof it.sub === 'string' ? it.sub : '',
          scene: (key === 'resultBanner' && battleId != null) ? (T.__fx.lastScene || null) : undefined,
        });
      } catch (e) { /* 캡처 실패는 표시 계층 손실일 뿐 — 게임 진행을 막지 않는다 */ }
    }
    return realPush.apply(this, items);
  };
}

// 멱등 — withEngine마다 불러도 이미 걸린 훅은 다시 걸지 않는다(각 hook*가 자체적으로 재진입을 막는다).
// newGame()이 S를 통째로 재할당하므로(bare `S={...}`) T.S가 바뀔 때마다 새 S에 다시 걸어야 하고, 이 함수를
// 엔진을 구동하는 유일한 공통 지점(withEngine)의 맨 앞에서 매번 불러 그 재할당을 놓치지 않는다.
function ensureFxCapture(T) {
  if (!T.__fx) T.__fx = { items: [], nextSeq: 1, gen: 0 };
  hookFxLog(T);
  if (T.S) { hookBattleAccessor(T, T.S); ensureFxCellsQueue(T, T.S); }
}

// #217 PD REVISE 1번 — roundBanner의 문구/재생 여부를 서버가 새로 판정하지 않는다. 원본이 이미 세워 둔
// `battle.bannerKey`(= `round+"-"+phase`, index.html:3355-3356, 헤드리스에서도 무조건 갱신)가 우리가 마지막
// 으로 내보낸 값과 다르면 "그 사이 원본 기준으로 배너가 한 번 필요했다"는 뜻이므로 그때만 내보낸다. 문구는
// 원본이 이미 노출하는 순수 함수(`actorOfPhase`·`fxTurnLabel`·`viewerIsOwner`)를 그대로 호출해서 얻는다 —
// 텍스트를 새로 짓지 않는다(원본 index.html:3107·3357과 동일 계산). 이 함수는 매 withEngine 호출 끝, 즉
// "이 행동이 만든 연출 체인이 전부 가라앉은 뒤"에 최종 상태만 보고 판단한다 — 규칙 재계산·RNG 없음.
function syncRoundBanner(T) {
  const S = T.S, B = S && S.battle;
  if (!B || B.bannerKey === undefined || B.bannerKey === null) return; // 아직 첫 배너 전이 안 됨(intro 단계)
  if (B.__ddBannerKeyEmitted === B.bannerKey) return;
  Object.defineProperty(B, '__ddBannerKeyEmitted', { value: B.bannerKey, writable: true, enumerable: false, configurable: true });
  try {
    const side = T.actorOfPhase ? T.actorOfPhase() : 'A';
    const ownerP = side === 'A' ? B.attP.owner : B.defP.owner;
    const title = T.fxTurnLabel ? T.fxTurnLabel(ownerP, true) : '';
    const mine = T.viewerIsOwner ? T.viewerIsOwner(ownerP) : false;
    const netMode = !!(T.NET && T.NET.mode);
    const cls = mine && !(S.mode === 'pvp' && !netMode) ? 'mine' : '';
    fxAppend(T, {
      src: 'stage', battleId: T.__fx.lastBattleId || null, turn: typeof S.turnCount === 'number' ? S.turnCount : null,
      key: 'roundBanner', kind: 'banner', title, sub: 'Round ' + B.round + ' / ' + (T.BAL ? T.BAL.maxRounds : ''),
      cls,
    });
  } catch (e) { /* 표시 전용 — 실패해도 게임 진행에 영향 없음 */ }
}

// #217 PD REVISE(msg_16e693d42efe) — explosion/trap 좌표(cells) 훅 계약(Mars 소유, battle-fx-protocol.md §5).
// 처음 제안(데모가 `(S.__ddFxCells||(S.__ddFxCells=[]))`로 스스로 큐를 만드는 방식)은 서버가 없는 PVE/hotseat
// (로컬 단독 실행)에서는 아무도 그 큐를 드레인하지 않아 게임 내내 무한히 쌓인다는 지적을 받았다 — 그래서
// **큐 생성은 서버(여기)만** 하고, 데모는 "이미 배열이면 push, 아니면 아무 것도 안 함"으로 바꾼다: 서버가
// 만든 `S`에서만 `Array.isArray(S.__ddFxCells)`가 참이므로, PVE/hotseat(순수 demo/index.html 실행)에서는
// 이 필드 자체가 아예 없어 데모 쪽 push가 조용히 아무 일도 하지 않는다(무한 보관·규칙 digest 오염 걱정 없음).
//
// Saturn REVISE(startedRoom(1874205), fx-qa-revise.md P1 #1) — 이전 구현은 이 큐를 "매 withEngine 종료 시
// 한 번에" 드레인했다. explosionFx/trapFxPlay는 이 큐에 push한 바로 다음 줄에서 fxPlay(...)를 부르고, 그
// 폭발이 곧장 KO·경기 종료로 이어지면 resultBanner가 **같은 withEngine 호출 안에서 그보다 먼저** FX.log
// 경로로 실시간 캡처된다 — 그 결과 실제로는 explosion이 먼저 일어났는데도 seq는 resultBanner가 앞서고
// explosion이 호출 끝에서야 뒤늦게 발급됐다(원인이 결과보다 늦게 기록됨). 고침: hookMsgQ(§2-2)와 완전히
// 같은 패턴으로 이 배열의 push 자체를 인스턴스 단위로 후킹해, Mars가 실제로 push를 호출하는 그 순간(=
// "원래 FX 지점", fxPlay(explosion/trapFx) 바로 앞)에 즉시 이벤트를 만든다 — 더 이상 withEngine 종료까지
// 미루지 않으므로 이후에 일어나는 resultBanner보다 항상 먼저 seq를 받는다. 실제 배열에는 아무 것도 남기지
// 않는다(this.length는 항상 0) — "소비 후 큐는 즉시 비워짐"(T13) 계약을 실제 저장 없이 그대로 만족한다.
function hookFxCellsQueue(T, arr) {
  if (!Array.isArray(arr) || arr.__ddHooked) return;
  Object.defineProperty(arr, '__ddHooked', { value: true, enumerable: false, configurable: true });
  arr.push = function pushAndCapture(...items) {
    for (const entry of items) {
      try {
        if (!entry || typeof entry.key !== 'string' || !Array.isArray(entry.cells)) continue;
        const cells = entry.cells.filter((c) => Array.isArray(c) && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1])).slice(0, 16);
        if (!cells.length) continue;
        const S = T.S;
        fxAppend(T, {
          src: 'stage', battleId: currentBattleIdFor(T, entry.key), turn: S && typeof S.turnCount === 'number' ? S.turnCount : null,
          key: entry.key, kind: entry.key === 'trapFx' ? 'trap' : 'boom', title: '', sub: '', cells,
        });
      } catch (e) { /* 캡처 실패는 표시 계층 손실일 뿐 — 게임 진행을 막지 않는다 */ }
    }
    return this.length; // 실제 저장 없이 즉시 소비 — 큐는 항상 비어 있다
  };
}

// 새 S 인스턴스마다 non-enumerable로 설치한다(다른 __dd* 마커와 같은 관례 —
// JSON.stringify(S)·_stateFingerprint에도 안 잡힘). 설치와 동시에 push를 후킹해 위 즉시-소비를 건다.
function ensureFxCellsQueue(T, S) {
  if (!S || Object.prototype.hasOwnProperty.call(S, '__ddFxCells')) return;
  const arr = [];
  Object.defineProperty(S, '__ddFxCells', { value: arr, writable: false, enumerable: false, configurable: true });
  hookFxCellsQueue(T, arr);
}

// 엔진 하나의 동기 구간 — 행동을 적용하고, 그 행동이 예약한 연출 체인을 끝까지 흘려 최종 상태를 확정한다.
// fn이나 drain이 예외를 던지면 스케줄러 큐를 비운 뒤 그대로 던진다(호출자가 룸을 VOID로 닫는다).
function withEngine(T, fn) {
  ensureFxCapture(T); // #217 — newGame()의 S 재할당을 놓치지 않도록 매 호출 앞에서 재확인(멱등)
  // Saturn REVISE(fx-qa-revise.md P1 #2) — 이 호출 하나가 한 "세대"다. 배틀이 이 세대 안에서 닫히면
  // (hookBattleAccessor) resultCtxGen에 이 세대가 찍히고, currentBattleIdFor는 같은 세대의 resultBanner에만
  // 그 문맥을 잇는다 — 다음 세대(=다음 withEngine 호출)부터는 자동으로 무관해진다.
  T.__fx.gen = (T.__fx.gen || 0) + 1;
  let result;
  try {
    result = fn(T);
  } catch (e) {
    if (T.scheduler) T.scheduler.clear();
    throw e;
  }
  T.drain();
  // #217 — 이 행동이 만든 연출 체인이 전부 가라앉은 뒤(=최종 상태 확정 후)에만 선언적 stage 이벤트를 만든다.
  // explosion/trapFx(cells)는 더 이상 여기서 드레인하지 않는다 — hookFxCellsQueue(§ensureFxCellsQueue)가
  // Mars의 실제 push 호출 시점에 즉시 이벤트화하므로(원인이 그보다 늦게 나는 결과보다 항상 먼저 seq를 받음).
  syncRoundBanner(T);
  return result;
}

module.exports = { createEngine, withEngine, createScheduler, EngineFault };
