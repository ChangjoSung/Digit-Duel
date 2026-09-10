/* #132 AI vs AI 완주 게이트 (CI 필수) — node demo/test/regression/smoke_ai_completion.js [demo/index.html]
   목적: CLAUDE.md 의 "AI vs AI 완주 확인" 을 리포트가 아니라 판정으로 만든다.
   demo/test/reports/ai_compare.js 는 표를 stdout 에 찍고 끝나 process.exit 도 어서션도 없다 (항상 0) — 게이트가 될 수 없다.
   이 파일은 고정 시드·상한 걸린 스텝 예산으로 sim 을 완주시키고, 규칙 불변식과 종료 상태 적법성만 본다.

   범위 (기대 승자·턴 수 같은 밸런스 수치는 일절 고정하지 않는다 — 밸런싱 변경에 영향받지 않는 게이트):
     A. 완주      — 모든 조합이 스텝 예산 안에서 phase==="over" 에 도달하고, 예산에 닿아 잘린 것이 아님(steps<cap)
     B. 불변식    — 진행 중 주기 검사(check)와 종료 시점 모두 위반 0 (겹침·보드 밖·HP 범위·battlesUsed·텔레포트·지표 이중집계)
     C. 종료 적법 — winner ∈ {0,1,null} · winType ∈ {king,wipe,edge,draw} (demo/index.html gameOver 호출 지점 전수)
                    · winner===null 은 draw 일 때만, draw 는 winner===null 일 때만
     D. 지표 정합 — 모든 PLAYER_METRIC_KEYS 에서 byPlayer[0]+byPlayer[1] === total
     E. 결정론    — 같은 시드 2회 실행이 승자·턴·유형·지표 스냅샷까지 완전 일치 (5급×5급 한정, 아래 참조)
     F. 비공허    — 스위트 전체에서 전투·탐색이 실제로 일어났고 모든 판이 턴을 진행했다
                    (0수 즉시 종료로 A~D 가 공허하게 통과하는 것 방지)

   E 를 5급×5급 으로 한정하는 이유 (제품 소스 근거):
     5단(dan5) 주 판단 aiMainStrong 은 demo/index.html:2773 에서 `deadline=Date.now()+BAL.aiStrongBudgetMs` 를 잡고
     :2847 `if(Date.now()>deadline)` · :2767 `Date.now()>deadline` (aiWorstReply) 로 탐색을 실제 시각으로 잘라낸다.
     따라서 5단이 끼면 결과가 기기 속도에 의존한다 — 예산이 물리는 순간 같은 시드라도 갈라질 수 있다.
     5급(aiMain)에는 그 마감이 없으므로 결정론을 요구할 수 있는 것은 5급×5급 뿐이다.
     5단 조합은 A~D(완주·불변식·적법·정합)만 요구한다. 이것은 검사를 약화한 것이 아니라
     제품이 시간 예산 설계를 가진 결과이며, 시간에 의존하지 않는 성질만 단언한 것이다.

   종료 코드: 0 = 전부 통과 · 1 = 실패 (실패 목록을 stderr 에 남긴다). 파일을 쓰지 않는다. */
"use strict";
const H=require("../shared/harness");

const T=H.load(process.argv[2]);
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

/* 스텝 예산 — 완주는 이 한참 아래에서 끝나야 한다. 예산에 닿으면 "완주"가 아니라 "잘림"으로 본다. */
const CAP=300000;
const WIN_TYPES=new Set(["king","wipe","edge","draw"]); // demo/index.html gameOver 호출 지점 전수 (resign 은 사람·온라인 전용)

/* 고정 시드 — 재현 가능하고 유한하다. 밸런스 수치가 아니라 RNG 진입점일 뿐이라 기획 변경과 무관하다. */
const DETERMINISTIC=[{levels:["grade5","grade5"],seeds:[13201,13202,13203,13204]}];
const COMPLETION_ONLY=[
  {levels:["dan5","grade5"],seeds:[13211,13212]},
  {levels:["grade5","dan5"],seeds:[13213,13214]},
  {levels:["dan5","dan5"],seeds:[13215]},
];

/* PLAYER_METRIC_KEYS (demo/index.html:571-575) 에 실제로 있는 키만 센다 */
const totals={battles:0,searches:0,teleports:0};
let minTurns=Infinity;
const rows=[];

/* 한 판을 돌리고 A~D 를 판정한다. 반환값은 E(결정론) 비교용 정규화 스냅샷. */
function runOne(levels,seed){
  const t0=Date.now();
  const r=H.runSim(T,levels,seed,{check:25,cap:CAP});
  const label=`${levels.join(" vs ")} seed=${seed}`;

  // A. 완주 — 예산 안에서 끝났고, 예산에 닿아 잘린 것이 아니다
  ok(r.phase==="over"&&r.steps<CAP,`A ${label} 완주 (phase=${r.phase} steps=${r.steps}/${CAP})`);
  // B. 불변식 — 진행 중 + 종료 시점
  ok(r.viol.length===0,`B ${label} 불변식 위반 0`+(r.viol.length?` — ${r.viol.slice(0,4).join(" / ")}`:""));
  // C. 종료 상태 적법성
  const winnerOk=r.winner===0||r.winner===1||r.winner===null;
  const typeOk=WIN_TYPES.has(r.winType);
  const drawPair=(r.winner===null)===(r.winType==="draw");
  ok(winnerOk&&typeOk&&drawPair,`C ${label} 종료 적법 (winner=${JSON.stringify(r.winner)} winType=${JSON.stringify(r.winType)})`);
  // D. 지표 이중 집계 정합
  const bad=T.PLAYER_METRIC_KEYS.filter(k=>(r.snap.byPlayer[0][k]||0)+(r.snap.byPlayer[1][k]||0)!==(r.snap.total[k]||0));
  ok(bad.length===0,`D ${label} 지표 byPlayer 합 = total`+(bad.length?` — 불일치 키 ${bad.join(",")}`:""));

  totals.battles+=r.snap.total.battles||0;
  totals.searches+=r.snap.total.searches||0;
  totals.teleports+=r.snap.total.teleports||0;
  minTurns=Math.min(minTurns,r.turns);
  rows.push(`  ${label.padEnd(28)} turns=${String(r.turns).padStart(3)} steps=${String(r.steps).padStart(6)} winner=${JSON.stringify(r.winner)} type=${r.winType} ${Date.now()-t0}ms`);

  return JSON.stringify({winner:r.winner,turns:r.turns,winType:r.winType,phase:r.phase,snap:r.snap});
}

const startedAt=Date.now();

/* ===== 결정론 대상 (5급×5급) — 같은 시드 2회 ===== */
for(const {levels,seeds} of DETERMINISTIC){
  for(const seed of seeds){
    const first=runOne(levels,seed);
    const second=runOne(levels,seed);
    ok(first===second,`E ${levels.join(" vs ")} seed=${seed} 같은 시드 2회 완전 일치 (승자·턴·유형·지표)`);
  }
}

/* ===== 완주 전용 (5단 포함) — 시간 예산 때문에 결정론은 요구하지 않는다 ===== */
for(const {levels,seeds} of COMPLETION_ONLY) for(const seed of seeds) runOne(levels,seed);

/* ===== F. 비공허 ===== */
ok(totals.battles>0,`F1 스위트 전체에서 전투가 실제로 발생 (battles=${totals.battles})`);
ok(totals.searches>0,`F2 스위트 전체에서 탐색이 실제로 발생 (searches=${totals.searches})`);
ok(minTurns>0,`F3 모든 판이 턴을 진행한 뒤 종료 (최소 턴 수 ${minTurns})`);

console.log(rows.join("\n"));
console.log(`\n=== smoke_ai_completion: pass ${pass} / fail ${fail} === (${((Date.now()-startedAt)/1000).toFixed(1)}s, `
  +`sim ${DETERMINISTIC.reduce((a,g)=>a+g.seeds.length*2,0)+COMPLETION_ONLY.reduce((a,g)=>a+g.seeds.length,0)}판, `
  +`battles=${totals.battles} searches=${totals.searches} teleports=${totals.teleports})`);
if(fail){ console.error("실패: "+fails.join(" | ")); process.exit(1); }
