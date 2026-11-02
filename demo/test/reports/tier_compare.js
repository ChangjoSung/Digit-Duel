/* #322 무제한 AI 티어(브론즈·실버·골드) 순서 실측 — PLAN Singleplayer Draft v0.4.16 §9 · node demo/test/reports/tier_compare.js [--n 20] [--seed 1] [--out 파일.md]
   모든 구성이 같은 시드 seed..seed+n-1 을 쓰고, 시드마다 자리를 바꿔 한 번 더 둔다(선후공 교대 → 구성당 2n판):
     ① 인접 티어 맞대결: 브론즈↔실버 · 실버↔골드
     ② 같은 기준 상대: 각 티어 vs 현행 grade5(판마다 무작위 성향)
   판정 조건(§9.4): 인접 쌍마다 상위 티어가 결정된 판의 과반 승리 · 기준 상대 승률 브론즈 < 실버 < 골드. 미충족이면 값을 바꾸지 않고 결과를 Venus 에 넘긴다(§9.5).
   결정 1회 시간은 AI 어댑터 기록(AI.lastThinkMs — dan5 만 · Date.now 예산 120ms 는 결정 한 번 상한)이고, 쌍 실행 시간은 헤드리스 runSim 전체 벽시계다(AI 지연·연출 0).
   어서션·종료 코드가 없는 리포트이며 게이트가 아니다. 사람 체감·실제 승률·모바일 판단 시간은 이 표로 정하지 않는다(§9.6). */
"use strict";
const H=require("../shared/harness");
const fs=require("fs"), os=require("os");
const arg=(k,d)=>{ const i=process.argv.indexOf("--"+k); return i>0?process.argv[i+1]:d; };
const N=Number(arg("n",20)), SEED=Number(arg("seed",1)), OUT=arg("out",null);
const T=H.load();
const KO=l=>T.AI_LEVEL_KO[l]||l;
/* --set bronze.caution=0.7,silver.eps=0.15 — 제품 값(data.js)을 바꾸지 않고 이 실행의 후보 값만 덮어쓴다(§9.5 Venus 조정안 측정용 · 보고서 머리에 남는다) */
const SET=arg("set","");
for(const kv of SET.split(",").filter(Boolean)){ const m=/^(bronze|silver)\.(aggression|capture|kingRush|caution|eps)=([0-9.]+)$/.exec(kv); if(!m) throw new Error("--set 형식: "+kv); T.AI_TIER[m[1]].prof[m[2]]=Number(m[3]); }

function series(a,b){
  const r={a,b,win:{[a]:0,[b]:0},draw:0,first:{p0:0,p1:0},types:{},turns:[],think:[],thinkAvg:[],viol:0,games:0,ms:0};
  const t0=Date.now();
  for(let i=0;i<N;i++) for(const swap of [false,true]){
    const lv=swap?[b,a]:[a,b], g=H.runSim(T,lv,SEED+i,{check:200});
    r.games++; r.turns.push(g.turns); if(g.thinkMax){ r.think.push(g.thinkMax); r.thinkAvg.push(g.thinkAvg); } if(g.viol.length) r.viol++;
    if(g.winner===null) r.draw++; else { r.win[lv[g.winner]]++; r.first[g.winner===0?"p0":"p1"]++; }
    r.types[g.winType||"none"]=(r.types[g.winType||"none"]||0)+1;
  }
  r.ms=Date.now()-t0; return r;
}
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0, max=a=>a.length?Math.max(...a):0;
const pct=(w,n)=>n?(w/n*100).toFixed(1)+"%":"-";
const head=[series("bronze","silver"),series("silver","gold")];
const base=["bronze","silver","gold"].map(k=>series(k,"grade5"));

const md=[];
md.push("# 무제한 AI 티어 순서 실측 (#322 · PLAN §9)");
md.push(`- 시드 ${SEED}~${SEED+N-1} × 선후공 교대 = 구성당 ${N*2}판 · simMaxTurns ${T.BAL.simMaxTurns} · dan5 결정 예산 ${T.BAL.aiStrongBudgetMs}ms · 생성 ${new Date().toISOString()}`);
md.push(`- 실행 환경: Node ${process.version} · ${os.platform()} ${os.release()} · ${os.cpus()[0].model} ×${os.cpus().length} · 헤드리스 하네스(AI 지연·연출 0)`);
md.push(`- 티어 설정(AI_TIER): ${Object.entries(T.AI_TIER).map(([k,v])=>`${KO(k)}=${v.engine}${v.prof?` ${JSON.stringify(v.prof)}`:" (종전 dan5 고정 성향)"}`).join(" · ")}`);
if(SET) md.push(`- **후보 값 덮어쓰기(제품 data.js 아님): ${SET}**`);
md.push(`- 재현: \`node demo/test/reports/tier_compare.js --n ${N} --seed ${SEED}${SET?` --set ${SET}`:""}\` — 같은 시드는 같은 결과(단 dan5 는 Date.now 예산이라 기기 속도에 따라 달라질 수 있다)`);
md.push("");
md.push("## ① 인접 티어 맞대결");
md.push("| 맞대결 | 하위 승 | 상위 승 | 무 | 상위 승률(결정된 판) | 선공/후공 승 | 평균 턴 | dan5 결정 ms 평균/최대 | 쌍 실행 ms | 불변식 위반 판 |");
md.push("|---|---|---|---|---|---|---|---|---|---|");
for(const s of head){ const dec=s.win[s.a]+s.win[s.b];
  md.push(`| ${KO(s.a)} vs ${KO(s.b)} | ${s.win[s.a]} | ${s.win[s.b]} | ${s.draw} | ${pct(s.win[s.b],dec)} | ${s.first.p0}/${s.first.p1} | ${avg(s.turns).toFixed(1)} | ${s.think.length?avg(s.thinkAvg).toFixed(1)+"/"+max(s.think):"-"} | ${s.ms} | ${s.viol} |`); }
md.push("");
md.push("## ② 같은 기준 상대(현행 grade5 · 판마다 무작위 성향)");
md.push("| 티어 | 티어 승 | 기준 승 | 무 | 티어 승률(결정된 판) | 선공/후공 승 | 평균 턴 | dan5 결정 ms 평균/최대 | 쌍 실행 ms | 불변식 위반 판 |");
md.push("|---|---|---|---|---|---|---|---|---|---|");
for(const s of base){ const dec=s.win[s.a]+s.win.grade5;
  md.push(`| ${KO(s.a)} | ${s.win[s.a]} | ${s.win.grade5} | ${s.draw} | ${pct(s.win[s.a],dec)} | ${s.first.p0}/${s.first.p1} | ${avg(s.turns).toFixed(1)} | ${s.think.length?avg(s.thinkAvg).toFixed(1)+"/"+max(s.think):"-"} | ${s.ms} | ${s.viol} |`); }
md.push("");
md.push("## 승리 유형(winType)");
for(const s of head.concat(base)) md.push(`- ${KO(s.a)} vs ${KO(s.b)}: ${Object.entries(s.types).map(([k,v])=>`${T.WINTYPE_KO[k]||k} ${v}`).join(" · ")}`);
md.push("");
const upOk=head.map(s=>s.win[s.b]>(s.win[s.a]+s.win[s.b])/2), rate=base.map(s=>{ const d=s.win[s.a]+s.win.grade5; return d?s.win[s.a]/d:0; });
const baseOk=rate[0]<rate[1]&&rate[1]<rate[2];
md.push("## 판정(§9.4 조건 · 관측 사실만)");
md.push(`- 인접 쌍 상위 티어 과반 승: 브론즈<실버 ${upOk[0]?"충족":"미충족"} · 실버<골드 ${upOk[1]?"충족":"미충족"}`);
md.push(`- 기준 상대 승률 브론즈 < 실버 < 골드: ${baseOk?"충족":"미충족"} (${rate.map(x=>(x*100).toFixed(1)+"%").join(" / ")})`);
md.push(`- 종합: ${upOk.every(Boolean)&&baseOk?"순서 확인(품질 확정 아님)":"순서 미확인 — 값을 바꾸지 않고 Venus 조정 판단으로 넘긴다(§9.5)"}`);
md.push(`- 무승부는 sim 턴 상한(simDraw)에서만 난다 — 실제 PVE 에는 이 상한 경로가 없다(§3.5 정적 판단).`);
md.push(`- 전체 ${((head.concat(base).reduce((n,s)=>n+s.ms,0))/1000).toFixed(1)}초 · 헤드리스 Node 실측이며 브라우저·모바일 체감 시간이 아니다.`);
const text=md.join("\n");
console.log(text);
if(OUT) fs.writeFileSync(OUT,text+"\n","utf8");
