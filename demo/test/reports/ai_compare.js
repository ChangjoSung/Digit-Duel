/* #21 시드 고정 다경기 비교 — node demo/test/reports/ai_compare.js [N=40] [seedBase=1000] [out.md]
   구성: 5단 vs 5급(자리 교대) · 5급 vs 5급(기준선 대칭성) · 5단 vs 5단. 시드는 경기별 seedBase+i (재현 가능). */
"use strict";
const H=require("../shared/harness");
const fs=require("fs");
const T=H.load();
const N=Number(process.argv[2]||40), seedBase=Number(process.argv[3]||1000), out=process.argv[4];
const KEYS=["battles","forcedBattles","teleports","searches","minionSearches","captures","enemyCapTries","enemyCaptures","fleeTries","fleeOks","bombMoves","kingForestTurns","battleRefusals"];

function series(name,levelsFn){
  const rows=[], wins={dan5:0,grade5:0,draw:0}, side={p0:0,p1:0}, wt={}, use={dan5:{},grade5:{}}, turnsArr=[], think=[], viol=0;
  for(let i=0;i<N;i++){
    const lv=levelsFn(i);
    const r=H.runSim(T,lv,seedBase+i,{check:50});
    if(r.viol.length) viol++;
    const w=r.winner;
    if(w===null) wins.draw++; else { wins[lv[w]]++; side[w===0?"p0":"p1"]++; }
    wt[r.winType]=(wt[r.winType]||0)+1; turnsArr.push(r.turns); think.push(r.thinkMax);
    for(const p of [0,1]) for(const k of KEYS) use[lv[p]][k]=(use[lv[p]][k]||0)+(r.snap.byPlayer[p][k]||0);
    rows.push({i,seed:seedBase+i,lv:lv.join("/"),winner:w===null?"draw":lv[w]+"(p"+w+")",turns:r.turns,winType:r.winType,thinkMax:r.thinkMax});
  }
  const cnt=lv=>N*(levelsFn(0).filter(x=>x===lv).length+levelsFn(1).filter(x=>x===lv).length)/2; // 레벨별 출전 경기 수
  const nDan=(levelsFn(0).includes("dan5")?1:0)*N, nGrade=(levelsFn(0).includes("grade5")?1:0)*N;
  const avg=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1):"-";
  const pct=(a,b)=>b?Math.round(a/b*100)+"%":"-";
  return {name,rows,wins,side,wt,use,turnsAvg:avg(turnsArr),thinkMaxAvg:avg(think),thinkMax:Math.max(...think),viol,nDan,nGrade,
    perGame:{dan5:Object.fromEntries(KEYS.map(k=>[k,cnt("dan5")?(use.dan5[k]||0)/cnt("dan5"):0])),grade5:Object.fromEntries(KEYS.map(k=>[k,cnt("grade5")?(use.grade5[k]||0)/cnt("grade5"):0]))},pct};
}
const A=series("5단 vs 5급 (자리 교대)",i=>i%2?["grade5","dan5"]:["dan5","grade5"]);
const B=series("5급 vs 5급 (기준선)",()=>["grade5","grade5"]);
const C=series("5단 vs 5단",()=>["dan5","dan5"]);

const md=[];
md.push(`# 5단 vs 5급 시드 고정 다경기 비교 리포트`);
md.push(`- 경기 수: 구성당 ${N} · 시드 ${seedBase}~${seedBase+N-1} · simMaxTurns ${T.BAL.simMaxTurns} · 판단 상한 ${T.BAL.aiStrongBudgetMs}ms · 생성 ${new Date().toISOString()}`);
md.push(`- 재현: \`node demo/test/reports/ai_compare.js ${N} ${seedBase}\` (동일 시드 → 동일 결과, 시간 상한 미도달 시)`);
md.push(``);
md.push(`## 요약`);
md.push(`| 구성 | 5단 승 | 5급 승 | 무승부 | 5단 승률(무승부 제외) | p0 승/p1 승 | 평균 턴 | 판단 최대 ms(평균/최대) | 불변식 위반 |`);
md.push(`|---|---|---|---|---|---|---|---|---|`);
for(const s of [A,B,C]){
  const decided=s.wins.dan5+s.wins.grade5;
  md.push(`| ${s.name} | ${s.wins.dan5} | ${s.wins.grade5} | ${s.wins.draw} | ${s.name.startsWith("5단 vs 5급")?s.pct(s.wins.dan5,decided):"-"} | ${s.side.p0}/${s.side.p1} | ${s.turnsAvg} | ${s.thinkMaxAvg}/${s.thinkMax} | ${s.viol} |`);
}
md.push(``);
md.push(`## 승리 유형`);
for(const s of [A,B,C]) md.push(`- ${s.name}: ${Object.entries(s.wt).map(([k,v])=>k+" "+v).join(" · ")}`);
md.push(``);
md.push(`## 경기당 평균 기능 사용 (5단 vs 5급 구성, 레벨별)`);
md.push(`| 지표 | 5단 | 5급 |`); md.push(`|---|---|---|`);
for(const k of KEYS) md.push(`| ${k} | ${A.perGame.dan5[k].toFixed(2)} | ${A.perGame.grade5[k].toFixed(2)} |`);
md.push(``);
md.push(`## 경기별 결과 (5단 vs 5급)`);
md.push(`| # | seed | p0/p1 | 승자 | 턴 | 유형 | 판단 최대 ms |`); md.push(`|---|---|---|---|---|---|---|`);
for(const r of A.rows) md.push(`| ${r.i} | ${r.seed} | ${r.lv} | ${r.winner} | ${r.turns} | ${r.winType} | ${r.thinkMax} |`);
const text=md.join("\n");
console.log(text);
if(out) fs.writeFileSync(out,text,"utf8");
