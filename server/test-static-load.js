// #201 정적 서빙 부하 회귀 — "온라인에서 아트가 일부만 안 나온다"의 서버측 원인을 잡아 둔다.
//
// 무엇을 지키는가: 클라이언트(demo/index.html artPreload)는 페이지를 열 때마다 정체와 무관한
// **고정 집합**(index.html + 하수인 20종 × {icon,battle} + 왕·동료 2종 × {icon64,battle256} = 45건)을
// 한꺼번에 요청한다. 이 집합이 HTTP 요청 속도 제한에 걸리면 클라이언트는 그 실패를 그 종의
// **영구 실패로 기록**한다(icon.png 실패 → ART.failed → 세션 내내 이모지 폴백). 그래서 "늦게 요청된
// 것만 빠진 부분 아트 손실"로 보인다.
//
// 검증 방향은 셋이다:
//   (1) 정상 로드는 전량 200 — 장면마다 **버킷이 가득 찬 새 서버**를 띄워 서로 간섭하지 않게 한다
//   (2) 남발은 여전히 유한하게 429 — 제한을 끄거나 무력화하는 방식의 "수리"를 막는다
//   (3) negative — 수정 전 예산(버스트 60 · 초당 30)이면 (1)의 동시 2명 장면이 실제로 깨진다.
//       실서버를 그 값으로 띄우는 경로는 두지 않으므로(env override 없음) 제품과 같은
//       S.TokenBucket 으로 같은 요청 순서를 돌려 결정적으로 보인다.
//
// 서버는 PORT=0(임의 포트)·루프백 바인드로 자식 프로세스로 띄우고 끝나면 닫는다 — 떠 있는 운영
// 서버(8080)를 건드리지 않는다. 접근 코드는 쓰지 않는다 (정적 서빙은 인증 경계가 아니다).
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const S = require('./security');

const DEMO = path.join(__dirname, '..', 'demo');
const BUDGET = S.STATIC_BUDGET;
const BURST = BUDGET.pageLoadRequests * BUDGET.concurrentPageLoads; // server.js LIMITS 와 같은 식
const RPS = BUDGET.pageLoadRequests * 2;
const OLD_BURST = 60;  // 수정 전 값 — negative 검증에만 쓴다
const OLD_RPS = 30;

let failures = 0;
const children = [];

function ok(cond, label) {
  if (cond) return true;
  failures += 1;
  console.error('  FAIL:', label);
  return false;
}
const section = (name) => console.log('-', name);

/* ===== 1. 프리로드 코퍼스 — 클라이언트 계약과 같은 고정 집합을 실제 자산에서 만든다 =====
 * 하드코딩한 목록을 쓰지 않는 이유: 자산이 늘어 예산을 넘기면 이 테스트가 바로 깨져야 한다.
 * 디렉터리 엔트리만 센다 — assets/minions/README.md 같은 파일은 종 폴더가 아니다.
 */
function pageLoadCorpus() {
  const dirs = fs.readdirSync(path.join(DEMO, 'assets', 'minions'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort();
  const corpus = ['/'];
  for (const d of dirs) for (const f of ['icon.png', 'battle.png']) corpus.push(`/assets/minions/${d}/${f}`);
  for (const d of ['companion', 'king']) for (const f of ['icon64.png', 'battle256.png']) corpus.push(`/assets/leaders/${d}/${f}`);
  return corpus;
}

/* ===== 2. 서버 기동·종료 — 장면마다 새 서버(= 가득 찬 버킷) ===== */

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: '0', DD_LAN: '0', DD_ACCESS_CODE: 'TESTCODE2345' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    children.push(child);
    let log = '';
    const timer = setTimeout(() => reject(new Error('server did not start')), 15000);
    child.stdout.on('data', (c) => {
      log += c.toString();
      const m = log.match(/접속 주소: http:\/\/127\.0\.0\.1:(\d+)/);
      if (!m || !log.includes('listening')) return;
      clearTimeout(timer);
      resolve({ child, port: Number(m[1]) });
    });
    child.once('error', reject);
  });
}

const stop = (child) => { try { child.kill(); } catch (e) { /* 이미 종료 */ } };

// 한 요청의 수명 상한. 응답이 오지 않아도 회귀가 무한정 매달리지 않게 하고, 그 요청은 실패(status 0)로
// 확정해 어서션에 드러낸다 — 조용히 빠지면 "실패 0건"이 거짓으로 통과할 수 있다.
const REQUEST_TIMEOUT_MS = 10000;

function get(port, agent, urlPath) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (r) => { if (settled) return; settled = true; resolve(r); };
    const req = http.request(
      { host: '127.0.0.1', port, path: urlPath, method: 'GET', agent, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        res.resume();
        res.on('end', () => done({ urlPath, status: res.statusCode }));
        res.on('error', (e) => done({ urlPath, status: 0, err: (e && e.code) || 'res_error' }));
      });
    // 'timeout' 은 소켓 유휴 한도를 알릴 뿐 요청을 끊지 않는다 — 직접 끊고 실패로 확정한다.
    req.on('timeout', () => { req.destroy(new Error('request timeout')); done({ urlPath, status: 0, err: 'timeout' }); });
    req.on('error', (e) => done({ urlPath, status: 0, err: (e && e.code) || 'req_error' }));
    req.end();
  });
}

// 브라우저 한 탭의 로드를 그대로 모사한다 — origin 당 소켓 6개 keep-alive (HTTP/1.1 기본 한도와 같다).
async function loadPage(port, corpus) {
  const agent = new http.Agent({ keepAlive: true, maxSockets: 6 });
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < corpus.length) {
      const p = corpus[i];
      i += 1;
      out.push(await get(port, agent, p));
    }
  }));
  agent.destroy();
  return out;
}

const notOk = (results) => results.filter((r) => r.status !== 200);
const describe = (bad) => bad.length === 0 ? '실패 0건'
  : `${bad.length}건 실패 (상태 ${[...new Set(bad.map((b) => b.status))].join(',')}, 예: ${bad.slice(0, 3).map((b) => b.urlPath).join(' ')})`;

/* ===== 3. 정상 로드는 전량 200 — 장면마다 새 서버 ===== */

async function coldSingleLoad(corpus) {
  const { child, port } = await startServer();
  const bad = notOk(await loadPage(port, corpus));
  section(`냉시작 클라이언트 1개 (${corpus.length}건) — ${describe(bad)}`);
  ok(bad.length === 0, '냉시작 1명의 프리로드가 전량 200');
  stop(child);
}

async function coldTwoConcurrentLoads(corpus) {
  const { child, port } = await startServer();
  const [t1, t2] = await Promise.all([loadPage(port, corpus), loadPage(port, corpus)]);
  const bad = notOk(t1).concat(notOk(t2));
  section(`같은 IP 냉시작 2개 동시 (${corpus.length * 2}건) — ${describe(bad)}`);
  ok(bad.length === 0, '같은 IP 동시 2명의 프리로드가 전량 200 (#201 원래 증상 장면)');
  stop(child);
}

// 같은 버킷에서 연달아 3회 로드한다 — 브라우저 캐시 동작을 가정하지 않고, 서버가 그 요청량을
// 받아낼 수 있는지만 본다 (응답에 Cache-Control: no-store 가 붙어 있으므로 재요청은 올 수 있다).
async function rapidSuccessiveLoads(corpus) {
  const { child, port } = await startServer();
  let bad = [];
  for (let i = 0; i < 3; i++) bad = bad.concat(notOk(await loadPage(port, corpus)));
  section(`같은 버킷 연속 3회 로드 (${corpus.length * 3}건) — ${describe(bad)}`);
  ok(bad.length === 0, '같은 버킷에서 연달아 3회 로드해도 전량 200');
  stop(child);
}

/* ===== 4. 남발은 여전히 유한하게 429 ===== */

async function limiterStillFinite() {
  const { child, port } = await startServer();
  const total = BURST * 4;
  const agent = new http.Agent({ keepAlive: true, maxSockets: 16 });
  const out = [];
  let i = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (i < total) { i += 1; out.push(await get(port, agent, '/index.html')); }
  }));
  const elapsed = (Date.now() - t0) / 1000;
  agent.destroy();

  const served = out.filter((r) => r.status === 200).length;
  const limited = out.filter((r) => r.status === 429).length;
  // 토큰 버킷의 상한은 정확히 capacity + refill × 경과시간이다. 반올림 여유 2건만 더해 묶는다.
  const bound = Math.ceil(BURST + RPS * elapsed) + 2;

  section(`남발 ${total}건 (${elapsed.toFixed(2)}초) → 200 ${served} · 429 ${limited}`);
  ok(limited > 0, '남발 요청이 429 로 거부된다 — 제한이 살아 있다');
  ok(served < total, `남발 전체가 통과하지 않는다 (200 ${served} < ${total})`);
  ok(served <= bound, `허용량이 유한하다 — 200 ${served} ≤ 상한 ${bound} (버스트 ${BURST} + ${RPS}/s × ${elapsed.toFixed(2)}s)`);

  stop(child);

  // "소진되면 거부한다"를 실HTTP 로 한 건씩 확인하면 경합이 된다 — 마지막 응답과 다음 요청 사이에
  // 10.4ms(=1/96초)만 흘러도 토큰 하나가 정당하게 회복돼 그 요청은 200 이 된다. 그래서 같은 성질은
  // 시간 인자를 직접 넣은 제품 버킷으로 결정적으로 확인하고, 실HTTP 쪽 근거는 위 집계 상한에 맡긴다.
  const drained = new S.TokenBucket(BURST, RPS, 0);
  for (let k = 0; k < BURST; k++) drained.take(1, 0);
  ok(!drained.take(1, 0), '버킷이 소진되면 같은 시각의 추가 요청은 거부된다 (결정적)');
  ok(drained.take(1, Math.ceil(1000 / RPS) + 1), `소진 후 ${Math.ceil(1000 / RPS) + 1}ms 뒤에는 한 건이 회복된다 — 영구 차단이 아니다`);
}

/* ===== 5. negative — 수정 전 예산이면 같은 요청 순서가 깨진다 =====
 * 제품 서버를 옛 값으로 띄우는 경로(env override)는 일부러 두지 않았으므로, 제품과 같은 클래스인
 * S.TokenBucket 에 옛 파라미터를 넣고 같은 요청 수를 흘려 보낸다. 시간 인자를 직접 넣어 결정적이다.
 */
function oldBudgetRejectsCorpus(corpus) {
  const n = corpus.length * 2;       // 같은 IP 동시 2명
  const spanMs = 300;                // 루프백에서 실측한 정도의 짧은 버스트
  const count = (capacity, refill) => {
    const b = new S.TokenBucket(capacity, refill, 0);
    let rejected = 0;
    for (let i = 0; i < n; i++) if (!b.take(1, Math.round((i * spanMs) / n))) rejected += 1;
    return rejected;
  };
  const oldRejected = count(OLD_BURST, OLD_RPS);
  const newRejected = count(BURST, RPS);
  section(`동시 2명 ${n}건 / ${spanMs}ms — 수정 전 예산 거부 ${oldRejected}건 · 수정 후 거부 ${newRejected}건`);
  ok(oldRejected > 0, `수정 전 예산(버스트 ${OLD_BURST} · 초당 ${OLD_RPS})은 같은 IP 동시 2명을 거부한다 — 고장이 실재한다`);
  ok(newRejected === 0, `수정 후 예산(버스트 ${BURST} · 초당 ${RPS})은 같은 요청을 전부 받는다`);
}

/* ===== 6. 예산 상수 계약 ===== */

function budgetContract(corpus) {
  section(`예산 상수 계약 — 코퍼스 ${corpus.length}건 · 예산 ${BUDGET.pageLoadRequests}건 × ${BUDGET.concurrentPageLoads}`);
  ok(corpus.length <= BUDGET.pageLoadRequests,
    `실제 프리로드 코퍼스 ${corpus.length}건 ≤ 선언 예산 ${BUDGET.pageLoadRequests}건 ` +
    '(자산이 늘었으면 security.js STATIC_BUDGET.pageLoadRequests 를 함께 올려야 한다)');
  ok(BUDGET.concurrentPageLoads >= 2, '같은 IP 동시 로드를 2회 이상 담는다');
  ok(Number.isFinite(BURST) && Number.isFinite(RPS) && BURST > 0 && RPS > 0, '예산이 유한한 양수다');
}

/* ===== 실행 ===== */

(async () => {
  try {
    const corpus = pageLoadCorpus();
    budgetContract(corpus);
    oldBudgetRejectsCorpus(corpus);
    await coldSingleLoad(corpus);
    await coldTwoConcurrentLoads(corpus);
    await rapidSuccessiveLoads(corpus);
    await limiterStillFinite();
  } catch (e) {
    failures += 1;
    console.error('  FAIL: 예외 —', e && e.message);
  }
  for (const c of children) stop(c);
  if (failures) {
    console.error(`STATIC LOAD TESTS FAILED (${failures})`);
    process.exit(1);
  }
  console.log('ALL STATIC LOAD TESTS PASSED');
  process.exit(0);
})();
