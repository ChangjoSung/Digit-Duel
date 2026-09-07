/* #95 공격형 연속 공격 위력 완화 — 시드 고정 1:1 단독 전투 before/after 비교
   사용: node demo/test/attack_balance_compare.js [--n 150] [--seed 5000] [--html <index.html>] [--out <json>] [--no-symmetry]
   기본은 stdout 만 낸다(Saturn --read-only 재실행 경로: --out 을 주지 않으면 파일을 하나도 만들지 않는다).

   실험 조건 (docs/v0.4.4-gameplay-spec.md 3장 "실험 조건" 재현):
   - demo/index.html 을 harness.js 로 메모리 로드, 실제 execSlot·nextPhase·judge 와 5급 전투 AI(aiBattleAction)로 1:1 단독 전투.
   - 동일 속성(무상성) 공격형 vs 5아키타입 × 4속성 × 역할 2(R1 선공=공격측 / R1 후공=방어측) × 조합당 N판, 시드 seed+i.
   - dmgVar 0.2 · statusProb 0.7 기본값 그대로. 아이템 0(S.inv 비움)·볼 0(S.balls=[0,0]) → 회복약·포획 경로 차단.
   - 도망(#13)은 5급 AI 규칙에 남아 있으므로 막지 않고 "미결(flee)"로 따로 센다. 승률은 결판난 판(즉사·판정) 기준과 전체 판 기준을 둘 다 낸다.
   - 두 변형은 같은 코드 위에서 상수만 메모리에서 바꿔 돌린다: v0.4.3 (공격형 atk 26 · 결정타 pow 44) / V6 (atk 25 · pow 40).
     양측 로스터가 같은 ROSTER 를 읽으므로 공격형 미러전은 두 측 모두 너프가 반영된다.
   - 파일에 실제로 적힌 값(file)은 따로 찍는다 — 새 HTML 이면 V6 와, eff5c16 HTML(--html)이면 v0.4.3 과 같아야 한다.

   대칭성 검사(--no-symmetry 로 생략): 5아키타입 각각을 "피험자"로 놓고 같은 격자를 돌려, 후공-선공 격차가 공격형만의 것인지
   구조(교대 선공·판정 동률 방어자 승·도망 규칙)에서 오는 것인지 분리한다. 미러전(X vs X)은 같은 판을 양쪽에서 본 것이라
   선공 승률 + 후공 승률 ≈ 100% 이고, 그 격차는 어느 쪽 수치를 바꿔도(양측 동시 적용) 사라지지 않는다.

   이 스크립트의 승률은 5급 AI 고정 정책 아래의 모형 추정치이며 제품 승률·사람 체감의 보장이 아니다. */
"use strict";
const fs=require("fs");
const H=require("./harness");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const N=Number(opt("--n",150)), SEED=Number(opt("--seed",5000)), OUT=opt("--out",null), SYM=!args.includes("--no-symmetry");
const T=H.load(opt("--html",undefined));

const ARCHS=["std","atk","def","swift","sustain"], ELEMS=["fire","water","grass","lightning"];
const ATK_IDS=T.ROSTER.filter(r=>r.arch==="atk").map(r=>r.id);
const idOf=(el,arch)=>T.ROSTER.find(r=>r.element===el&&r.arch===arch).id;
const VARIANTS=[{name:"v0.4.3",atk:26,sig:44},{name:"V6",atk:25,sig:40}];
const fileVals={atk:[...new Set(T.ROSTER.filter(r=>r.arch==="atk").map(r=>r.atk))],sig:T.SKILLS.sig_atk.pow,
  hp:[...new Set(T.ROSTER.filter(r=>r.arch==="atk").map(r=>r.hp))],skillAtk:[...new Set(T.ROSTER.filter(r=>r.arch==="atk").map(r=>r.skill))]};
function applyVariant(v){ for(const r of T.ROSTER) if(r.arch==="atk") r.atk=v.atk; T.SKILLS.sig_atk.pow=v.sig; }

/* 1:1 단독 전투 한 판. subjAtt=true 면 피험자가 공격측(R1 선공). 반환: 결과·라운드·종료 유형 */
function duel(subjId,oppId,subjAtt,seed){
  T.setSeed(seed); T.newGame("sim",{aiLevel:["grade5","grade5"]});
  const S=T.S;
  S.roster[0]=[subjAtt?subjId:oppId]; S.roster[1]=[subjAtt?oppId:subjId]; T.applyRoster(0); T.applyRoster(1);
  S.inv=[[],[]]; S.balls=[0,0];
  const A=S.pieces.find(x=>x.owner===0&&x.type==="minion"), D=S.pieces.find(x=>x.owner===1&&x.type==="minion");
  const k0=S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,A,7,4); H.place(T,D,6,4); H.place(T,k0,13,1); H.place(T,k1,1,7);
  S.phase="play"; S.current=0; S.mainUsed=true; S.battlesUsed=0; T.TQ.length=0;
  T.startRounds(A,D,A,D);
  let n=0, rounds=1;
  while(S.battle&&T.TQ.length&&n<10000){ rounds=S.battle.round; T.TQ.shift()(); n++; }
  T.TQ.length=0; // 전투 뒤 AI 턴 진행 타이머는 버린다 (단독 전투만 본다)
  if(S.battle) throw new Error("전투 미종료 seed="+seed);
  const subjWon=subjAtt?!D.alive:!A.alive, oppWon=subjAtt?!A.alive:!D.alive;
  const res=subjWon?"win":oppWon?"lose":"flee";
  return {res,rounds,how:S.metrics.judged?"judge":S.metrics.fleeOks?"flee":"ko"};
}

function grid(subjArch){ // 피험자 아키타입 vs 5아키타입 × 4속성 × 역할 2 × N
  const cells=[];
  for(const el of ELEMS) for(const oppArch of ARCHS) for(const role of ["first","second"]){
    const c={el,oppArch,role,win:0,lose:0,flee:0,judge:0,rounds:0,n:N};
    for(let i=0;i<N;i++){ const r=duel(idOf(el,subjArch),idOf(el,oppArch),role==="first",SEED+i);
      c[r.res]++; if(r.how==="judge") c.judge++; c.rounds+=r.rounds; }
    cells.push(c);
  }
  return cells;
}
const sum=(cells,k)=>cells.reduce((a,c)=>a+c[k],0);
const pct=(a,b)=>b?(a/b*100):0;
const f1=x=>x.toFixed(1);
function agg(cells){ const win=sum(cells,"win"),lose=sum(cells,"lose"),flee=sum(cells,"flee"),n=sum(cells,"n");
  return {n,win,lose,flee,judge:sum(cells,"judge"),winDecided:pct(win,win+lose),winAll:pct(win,n),fleeShare:pct(flee,n),avgRounds:sum(cells,"rounds")/n}; }
function byRole(cells){ return {first:agg(cells.filter(c=>c.role==="first")),second:agg(cells.filter(c=>c.role==="second"))}; }

const t0=Date.now();
const out={html:opt("--html","demo/index.html"),n:N,seedBase:SEED,file:fileVals,variants:{},symmetry:{},generated:new Date().toISOString()};
for(const v of VARIANTS){
  applyVariant(v);
  const cells=grid("atk"), r=byRole(cells);
  out.variants[v.name]={values:{atk:v.atk,sig:v.sig},role:r,gap:r.second.winDecided-r.first.winDecided,gapAll:r.second.winAll-r.first.winAll,
    byOpp:Object.fromEntries(ARCHS.map(a=>[a,byRole(cells.filter(c=>c.oppArch===a))])),
    byEl:Object.fromEntries(ELEMS.map(e=>[e,byRole(cells.filter(c=>c.el===e))])),cells};
  if(SYM){ out.symmetry[v.name]={};
    for(const sa of ARCHS){ const cs=grid(sa), rr=byRole(cs);
      const mirror=byRole(cs.filter(c=>c.oppArch===sa));
      const q=byRole(cs.filter(c=>c.oppArch!==sa));
      out.symmetry[v.name][sa]={role:rr,gap:rr.second.winDecided-rr.first.winDecided,gapAll:rr.second.winAll-rr.first.winAll,mirror,
        nonMirror:{first:q.first,second:q.second,gap:q.second.winDecided-q.first.winDecided,gapAll:q.second.winAll-q.first.winAll}}; } }
}
applyVariant(fileVals.atk.length===1?{atk:fileVals.atk[0],sig:fileVals.sig}:VARIANTS[1]); // 파일 값 복원
out.elapsedMs=Date.now()-t0;

/* ── 출력 ── */
const L=[];
L.push(`# #95 공격형 1:1 단독 전투 before/after 비교 (5급 AI · 동일 속성 · 조합당 ${N}판 · 시드 ${SEED}+i)`);
L.push(`- 파일 값: 공격형 atk ${fileVals.atk.join("/")} · HP ${fileVals.hp.join("/")} · skill ${fileVals.skillAtk.join("/")} · 결정타 pow ${fileVals.sig} (${out.html})`);
L.push(`- 재현: \`node demo/test/attack_balance_compare.js --n ${N} --seed ${SEED}\` · 소요 ${out.elapsedMs}ms · 생성 ${out.generated}`);
L.push(`- 승률(결판) = 승 ÷ (승+패), 즉사·판정만. 승률(전체) = 승 ÷ 전체 판(도망 미결 포함). 격차 = 후공 − 선공 (pt).`);
L.push(``);
L.push(`## 1. 공격형 승률 — 역할별`);
L.push(`| 변형 | 값 | 선공 승률(결판) | 후공 승률(결판) | 격차 | 선공(전체) | 후공(전체) | 격차(전체) | 도망 미결 | 판정 종료 | 평균 라운드 |`);
L.push(`|---|---|---|---|---|---|---|---|---|---|---|`);
for(const v of VARIANTS){ const x=out.variants[v.name], r=x.role;
  L.push(`| ${v.name} | atk ${v.atk} · 결정타 ${v.sig} | ${f1(r.first.winDecided)}% | ${f1(r.second.winDecided)}% | **${x.gap>=0?"+":""}${f1(x.gap)}** | ${f1(r.first.winAll)}% | ${f1(r.second.winAll)}% | ${x.gapAll>=0?"+":""}${f1(x.gapAll)} | ${f1(pct(r.first.flee+r.second.flee,r.first.n+r.second.n))}% | ${r.first.judge+r.second.judge} | ${f1((r.first.avgRounds+r.second.avgRounds)/2)} |`); }
L.push(``);
L.push(`## 2. 상대 아키타입별 (선공 승률 / 후공 승률 · 결판 기준)`);
L.push(`| 상대 | ${VARIANTS.map(v=>v.name+" 선공 / 후공 (격차)").join(" | ")} |`);
L.push(`|---|${VARIANTS.map(()=>"---").join("|")}|`);
for(const a of ARCHS) L.push(`| ${a} | ${VARIANTS.map(v=>{const r=out.variants[v.name].byOpp[a]; return `${f1(r.first.winDecided)} / ${f1(r.second.winDecided)} (${f1(r.second.winDecided-r.first.winDecided)})`;}).join(" | ")} |`);
L.push(``);
L.push(`## 3. 속성별 (선공 / 후공 · 결판)`);
L.push(`| 속성 | ${VARIANTS.map(v=>v.name).join(" | ")} |`);
L.push(`|---|${VARIANTS.map(()=>"---").join("|")}|`);
for(const e of ELEMS) L.push(`| ${e} | ${VARIANTS.map(v=>{const r=out.variants[v.name].byEl[e]; return `${f1(r.first.winDecided)} / ${f1(r.second.winDecided)} (${f1(r.second.winDecided-r.first.winDecided)})`;}).join(" | ")} |`);
if(SYM){
  L.push(``);
  L.push(`## 4. 대칭성 — 피험자 아키타입별 후공−선공 격차 (같은 격자, 결판 기준)`);
  L.push(`| 피험자 | ${VARIANTS.map(v=>v.name+" 선공 / 후공 (격차)").join(" | ")} | ${VARIANTS.map(v=>v.name+" 미러전 선공 / 후공").join(" | ")} | ${VARIANTS.map(v=>v.name+" 비미러 격차").join(" | ")} |`);
  L.push(`|---|${VARIANTS.map(()=>"---|---|---").join("|")}|`);
  for(const sa of ARCHS) L.push(`| ${sa} | ${VARIANTS.map(v=>{const s=out.symmetry[v.name][sa]; return `${f1(s.role.first.winDecided)} / ${f1(s.role.second.winDecided)} (${s.gap>=0?"+":""}${f1(s.gap)})`;}).join(" | ")} | ${VARIANTS.map(v=>{const m=out.symmetry[v.name][sa].mirror; return `${f1(m.first.winDecided)} / ${f1(m.second.winDecided)} (합 ${f1(m.first.winDecided+m.second.winDecided)})`;}).join(" | ")} | ${VARIANTS.map(v=>{const q=out.symmetry[v.name][sa].nonMirror; return `${q.gap>=0?"+":""}${f1(q.gap)}`;}).join(" | ")} |`);
  L.push(``);
  L.push(`### 4b. 미러전(X vs X) 세부 — 같은 판을 양쪽에서 본 것이라 승/패가 서로 거울상이고, 도망 미결이 역할별로 비대칭이다`);
  L.push(`| 피험자 | 변형 | 선공 승/패/도망 (N) | 후공 승/패/도망 (N) | 미러 격차(결판) | 미러 격차(전체) | 비미러 격차(결판) | 비미러 격차(전체) |`);
  L.push(`|---|---|---|---|---|---|---|---|`);
  for(const sa of ARCHS) for(const v of VARIANTS){ const s=out.symmetry[v.name][sa], m=s.mirror, q=s.nonMirror;
    L.push(`| ${sa} | ${v.name} | ${m.first.win}/${m.first.lose}/${m.first.flee} (${m.first.n}) | ${m.second.win}/${m.second.lose}/${m.second.flee} (${m.second.n}) | ${f1(m.second.winDecided-m.first.winDecided)} | ${f1(m.second.winAll-m.first.winAll)} | ${f1(q.gap)} | ${f1(q.gapAll)} |`); }
}
const text=L.join("\n");
console.log(text);
if(OUT){ fs.writeFileSync(OUT,JSON.stringify(out,null,1),"utf8"); console.log(`\nJSON 저장: ${OUT}`); }
