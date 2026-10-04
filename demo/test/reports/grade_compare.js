/* #325·#328 등급 성장 현재/후보 비교 — 실제 엔진(startRounds → execSlot → nextPhase → judge)의 1:1 단독 전투, 시드 고정 짝 비교.
   사용: node demo/test/reports/grade_compare.js [--n 200] [--seed 32800] [--ai grade5|dan5] [--only A,B] [--same-seed] [--out <md>]
   기본은 stdout 만 낸다(--out 을 주지 않으면 파일을 만들지 않는다). 어서션은 시작 자기검사 하나뿐이라 게이트가 아니다.

   - 같은 코드 위에서 **전투원의 HP·공격력만** 표 값으로 덮어쓴다(applySpecies 뒤 round(1성 값 × 배율%)). 방어·속도·회피·치명·
     상태 가산·스킬 해금·선턴 규칙·경제는 엔진 그대로다. 시작 자기검사가 엔진(gradeHp·gradeAtk·LEGEND_BASE)이 current 표 또는 candidate 표와
     같은지 확인한다 — #328 적용 뒤에는 candidate 와 같아야 한다.
   - 한 칸 = 개시자 2(높은 쪽이 A / D) × N판. 시드는 A 개시 seed+i · D 개시 seed+N+i 이고 현재·후보가 같은 시드를 쓴다(짝 비교).
     --same-seed 는 두 개시자에 같은 시드를 준다 — 등급이 다르면 개시자가 선턴·난수 순서에 들어가지 않는다는 것을 보는 용도다.
   - 아이템 0 · 볼 0 · 도망 없음(양측 뿌리 고정 플래그) → 모든 판이 처치 또는 판정으로 끝난다. 필드 시너지는 시나리오가 놓은 칸만 센다.
   - 승률은 고정 AI 정책 아래의 모형 추정치다. 제품 승률·사람 체감의 보장이 아니다. */
"use strict";
const fs=require("fs");
const H=require("../shared/harness");
const args=process.argv.slice(2), opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const N=Number(opt("--n",200)), SEED=Number(opt("--seed",32800)), AI=opt("--ai","grade5"), OUT=opt("--out",null), ONLY=opt("--only",null), SAME=args.includes("--same-seed");
const T=H.load();

/* 1성 대비 배율(%). current = v0.4.14 엔진 식 그대로(float): round(1성×(1+0.15×(등급−1))) 은 .5 경계 두 칸에서 정확한 산술과 다르다
   (공격형 ⭐2 HP 103.5→103 · 보호형 ⭐2 HP 126.5→126). candidate = #328 확정 계약(정수 % · round(값×%/100) · 경계는 올림).
   전설: legend = 고정값(v0.4.14) · legendPct = 대응 아키타입 ⭐4 **정수값** 대비 배율(%)을 다시 반올림(spec §3.2).
   2026-10-04 정정: 종전 도구는 전설을 round(1성×⭐4배율×1.2)(반올림 1회)로 계산해 사신을 243/57 로 쟀다 — 계약은 244/58 이다. */
const OLD_LEGEND={dragon:{hp:175,atk:35},witch:{hp:165,atk:32},reaper:{hp:158,atk:40}};
const TABLES={
  current:{float:[0.15,0.10],legend:OLD_LEGEND},
  "candidate-L":{hp:[100,135,175,225],atk:[100,125,155,190],legend:OLD_LEGEND},
  candidate:{hp:[100,135,175,225],atk:[100,125,155,190],legendPct:120}
};
const LEGEND_ARCH={dragon:"std",witch:"sustain",reaper:"atk"};
const gstat=(tab,arch,g)=>{ const b=T.ARCHETYPE_BASE[arch];
  return tab.float?{hp:Math.round(b.hp*(1+tab.float[0]*(g-1))),atk:Math.round(b.atk*(1+tab.float[1]*(g-1)))}
    :{hp:Math.round(b.hp*tab.hp[g-1]/100),atk:Math.round(b.atk*tab.atk[g-1]/100)}; };
const lstat=(tab,key)=>{ if(tab.legend) return tab.legend[key]; const s=gstat(tab,LEGEND_ARCH[key],4);
  return {hp:Math.round(s.hp*tab.legendPct/100),atk:Math.round(s.atk*tab.legendPct/100)}; };
const engineIs=name=>Object.keys(T.ARCHETYPE_BASE).every(a=>[1,2,3,4].every(g=>{ const s=gstat(TABLES[name],a,g), b=T.ARCHETYPE_BASE[a];
  return s.hp===T.gradeHp(b.hp,g)&&s.atk===T.gradeAtk(b.atk,g); }))
  &&Object.keys(LEGEND_ARCH).every(k=>{ const s=lstat(TABLES[name],k); return s.hp===T.LEGEND_BASE[k].hp&&s.atk===T.LEGEND_BASE[k].atk; });
const ENGINE=["current","candidate"].find(engineIs)||"neither";
if(ENGINE==="neither") throw new Error("자기검사 실패: 엔진 gradeHp/gradeAtk · LEGEND_BASE 가 current 표·candidate 표 어느 쪽과도 다르다");

/* 전투원 사양: {id,g} 일반 하수인 · {legend} 전설 · {leader:"king"|"assassin"|"shield"} 왕·동료 본체(등급 없음, 속성 🔥 고정) */
const rosterOf=id=>T.ROSTER.find(r=>r.id===id);
function seat(owner,spec,tab,sc,field){
  const S=T.S, ms=S.pieces.filter(x=>x.owner===owner&&x.type==="minion"), row=owner===0?12:2;
  (field||[]).forEach((id,i)=>{ T.applySpecies(ms[i+1],rosterOf(id),1); H.place(T,ms[i+1],row,i+1); }); // 시너지 집계용 필드 칸(⭐1)
  if(spec.leader){ const p=S.pieces.find(x=>x.owner===owner&&(spec.leader==="king"?x.type==="king":x.allyKind===spec.leader));
    p.element="fire"; p.leaderElChosen=true; T.syncOwnerLeaders(owner); return p; }
  const m=ms[0];
  if(spec.legend){ T.applyLegend(m,spec.legend); Object.assign(m,lstat(tab,spec.legend)); }
  else { const rd=rosterOf(spec.id); T.applySpecies(m,rd,spec.g); Object.assign(m,gstat(tab,rd.arch,spec.g));
    if(sc.basic){ m.skills=m.skills.slice(0,1); m.cds=[0]; } }
  m.maxHp=m.hp; return m;
}
function duel(sc,tab,hiIsA,seed){
  H.freshPlay(T,"sim",[AI,AI]); H.clearBoard(T);
  const S0=T.S; S0.inv=[[],[]]; S0.balls=[0,0]; S0.reserve=[null,null];
  for(const x of S0.pieces) if(x.type==="king"||x.type==="ally"){ x.element=null; x.leaderElChosen=true; } // 참전하지 않는 왕·동료는 왕국 집계에서 뺀다
  const hi=seat(hiIsA?0:1,sc.hi,tab,sc,sc.hiField), lo=seat(hiIsA?1:0,sc.lo,tab,sc,sc.loField);
  const A=hiIsA?hi:lo, D=hiIsA?lo:hi;
  H.place(T,A,7,4); H.place(T,D,6,4);
  for(const k of S0.pieces.filter(x=>x.type==="king"&&!x.placed)) H.place(T,k,k.owner===0?13:1,k.owner===0?1:7);
  S0.phase="play"; S0.current=0; S0.mainUsed=true; S0.battlesUsed=0; T.TQ.length=0;
  T.setSeed(seed); T.startRounds(A,D,A,D);
  const B=T.S.battle; B.fa.fleeLock=B.fd.fleeLock=true; if(sc.maxRounds) B.maxRounds=sc.maxRounds; // 시간의 수호자가 하는 일과 같은 인스턴스 값
  const hiFirst=(B.firstSideR1==="A")===hiIsA;
  let n=0, rounds=1;
  while(T.S.battle&&T.TQ.length&&n<10000){ rounds=T.S.battle.round; T.TQ.shift()(); n++; }
  if(T.S.battle) throw new Error(`전투 미종료 ${sc.label} seed=${seed}`);
  T.TQ.length=0; // 전투 뒤 AI 턴 진행은 버린다 (단독 전투만 본다)
  const pc=id=>T.S.pieces.find(x=>x.id===id), h=pc(hi.id), l=pc(lo.id);
  if(h.alive===l.alive) throw new Error(`미결 전투 ${sc.label} seed=${seed}`);
  const ratio=p=>Math.max(0,p.hp)/p.maxHp;
  return {win:h.alive,judge:T.S.metrics.judged>0,rounds,hiR:ratio(h),loR:ratio(l),hiFirst};
}
function cell(sc,tabName){
  const tab=TABLES[tabName], c={n:0,win:0,winA:0,winD:0,judge:0,rounds:0,margin:0,hiRemain:0,hiFirst:0,out:[]};
  for(const hiIsA of [true,false]) for(let i=0;i<N;i++){ const r=duel(sc,tab,hiIsA,SEED+i+(hiIsA||SAME?0:N));
    c.n++; c.rounds+=r.rounds; c.margin+=r.hiR-r.loR; c.out.push(r.win);
    if(r.win){ c.win++; c[hiIsA?"winA":"winD"]++; c.hiRemain+=r.hiR; } if(r.judge) c.judge++; if(r.hiFirst) c.hiFirst++; }
  return c;
}

/* ===== 시나리오 — hi = 승률을 재는 쪽(높은 등급 · 전설 · 왕/동료를 치는 하수인) ===== */
const PAIRS=[[1,2],[2,3],[3,4]], ARCH_FIRE={std:"M-F1",atk:"M-F2",def:"M-F3",swift:"M-F4",sustain:"M-F5",guard:"M-F6"};
const pairs=(label,loId,hiId,extra)=>PAIRS.map(([a,b])=>Object.assign({label:`${label} ⭐${a} vs ⭐${b}`,lo:{id:loId,g:a},hi:{id:hiId,g:b}},extra));
const mirror=extra=>Object.entries(ARCH_FIRE).flatMap(([a,id])=>pairs(`${T.ARCH_KO[a]}형 미러(${id})`,id,id,extra));
const BASE2=["current","candidate"];
const SECTIONS=[
  {key:"A",title:"성장만 분리 — 기본기만(1차 스킬 1칸) · 같은 종 미러 · 무상성",tabs:BASE2,list:mirror({basic:true})},
  {key:"B",title:"실제 해금 스킬(⭐N = 1~N차) · 같은 종 미러 · 무상성",tabs:BASE2,list:mirror({})},
  {key:"C",title:"상성·왕국 — 표준형, 실제 스킬",tabs:BASE2,list:[
    ...pairs("낮은 쪽 유리 상성(💧→🔥)","M-W1","M-F1",{}), ...pairs("높은 쪽 유리 상성(💧→🔥)","M-F1","M-W1",{}),
    ...pairs("낮은 쪽 🔥왕국(4) · 무상성","M-F1","M-F1",{loField:["M-F2","M-F3","M-F4"]}),
    ...pairs("낮은 쪽 유리 상성 + 💧왕국(4)","M-W1","M-F1",{loField:["M-W2","M-W3","M-W4"]})]},
  {key:"D",title:"최대 HP 비례 효과(화상·회복·방어막) — 실제 스킬",tabs:BASE2,list:[
    ...pairs("화상 100% 지속형(M-F5) 낮음 vs 표준(M-F1) 높음","M-F5","M-F1",{}), ...pairs("표준(M-F1) 낮음 vs 화상 지속형(M-F5) 높음","M-F1","M-F5",{}),
    ...pairs("방어막·회복 보호형 미러(M-G6)","M-G6","M-G6",{}), ...pairs("흡혈·최대 HP 4% 잠식 지속형 미러(M-G5)","M-G5","M-G5",{})]},
  {key:"E",title:"3라운드(시간의 수호자) — 표준형 미러. 6라운드는 A·B 절의 같은 줄",tabs:BASE2,list:[
    ...pairs("3R 기본기만 표준형 미러","M-F1","M-F1",{basic:true,maxRounds:T.BAL.buffTimeRounds}), ...pairs("3R 실제 스킬 표준형 미러","M-F1","M-F1",{maxRounds:T.BAL.buffTimeRounds})]},
  {key:"F",title:"전설 위계 — hi = 전설, 상대 = ⭐4 (실제 스킬). candidate-L = 성장 표만 올리고 전설은 v0.4.14 값 그대로",tabs:["current","candidate-L","candidate"],
    list:[["dragon","M-F1"],["witch","M-F5"],["witch","M-F1"],["reaper","M-F2"],["reaper","M-F1"]].map(([k,id])=>({label:`${k} vs ⭐4 ${T.ARCH_KO[rosterOf(id).arch]}형(${id})`,lo:{id,g:4},hi:{legend:k}}))},
  {key:"S",title:"한정 대표 부분집합 — 표준형 미러 기본기/실제 스킬 · 약한 칸 2개 · 역상성 · 3R",tabs:BASE2,list:[
    ...pairs("기본기만 표준형 미러","M-F1","M-F1",{basic:true}), ...pairs("실제 스킬 표준형 미러","M-F1","M-F1",{}),
    ...pairs("실제 스킬 방어형 미러","M-F3","M-F3",{}).slice(1,2), ...pairs("실제 스킬 공격형 미러","M-F2","M-F2",{}).slice(2),
    ...pairs("낮은 쪽 유리 상성(💧→🔥)","M-W1","M-F1",{}), ...pairs("3R 실제 스킬 표준형 미러","M-F1","M-F1",{maxRounds:T.BAL.buffTimeRounds})]},
  {key:"L",title:"한정 전설 3종 — hi = 전설, 상대 = 대응 아키타입 ⭐4 (실제 스킬)",tabs:["current","candidate-L","candidate"],
    list:[["dragon","M-F1"],["witch","M-F5"],["reaper","M-F2"]].map(([k,id])=>({label:`${k} vs ⭐4 ${T.ARCH_KO[rosterOf(id).arch]}형(${id})`,lo:{id,g:4},hi:{legend:k}}))},
  {key:"G",title:"왕·동료 취약성 — hi = 표준형 하수인(M-F1), 상대 = 등급 없는 왕·동료 본체(🔥, 무상성 · 도망 없음)",tabs:BASE2,
    list:["king","assassin","shield"].flatMap(k=>[1,2,3,4].map(g=>({label:`⭐${g} 표준형 vs ${k}`,lo:{leader:k},hi:{id:"M-F1",g}})))}
].filter(s=>ONLY?ONLY.split(",").includes(s.key):!"SL".includes(s.key)); // S·L 은 --only 로 부를 때만(기본 실행 = A~G)

const t0=Date.now(), L=[], f1=x=>x.toFixed(1), pct=(a,b)=>f1(b?a/b*100:0);
L.push(`# #328 등급 성장 현재/후보 비교 (실제 엔진 1:1 · AI ${AI} · 칸당 ${2*N}판 = 개시자 2 × ${N} · 시드 ${SEED}..${SEED+(SAME?N:2*N)-1}${SAME?" · 개시자 공통 시드":""})`);
L.push(`- 엔진(gradeHp·gradeAtk·LEGEND_BASE) = **${ENGINE}** 표와 일치 · 재현: \`node demo/test/reports/grade_compare.js --n ${N} --seed ${SEED} --ai ${AI}${ONLY?" --only "+ONLY:""}${SAME?" --same-seed":""}\``);
L.push(`- 열: 승률 = hi 측 승률(높은 쪽이 개시자일 때 / 수비일 때) · Δ = 현재 표 대비 pt · 뒤집힘 = 같은 시드에서 현재 표 패→이 표 승 / 승→패 · 판정 = 라운드 소진 판정 비율 · HP 비율 차 = 종료 시 (hi 잔여 − lo 잔여) 평균 · hi 승리 잔여 = hi 가 이긴 판의 잔여 HP 비율 평균 · R1 선턴 = hi 가 1라운드 선턴인 비율`);
L.push(``, `## 0. 표 값 (round(1성 × 배율%)) — HP / 공격력`, `| 아키타입 | 표 | ⭐1 | ⭐2 | ⭐3 | ⭐4 | 전설(대응) |`, `|---|---|---|---|---|---|---|`);
const legOf=a=>Object.keys(LEGEND_ARCH).find(k=>LEGEND_ARCH[k]===a);
for(const a of Object.keys(T.ARCHETYPE_BASE)) for(const tn of Object.keys(TABLES)){ const k=legOf(a), s=k?lstat(TABLES[tn],k):null;
  if(tn==="candidate-L"&&!k) continue;
  L.push(`| ${T.ARCH_KO[a]} | ${tn} | ${[1,2,3,4].map(g=>{ const x=gstat(TABLES[tn],a,g); return `${x.hp} / ${x.atk}`; }).join(" | ")} | ${s?`${k} ${s.hp} / ${s.atk}`:"—"} |`); }
let total=0;
for(const sec of SECTIONS){
  L.push(``, `## ${sec.key}. ${sec.title}`, `| 시나리오 | 표 | 승률 (개시 / 수비) | Δ | 뒤집힘 +/− | 판정 | 평균 R | HP 비율 차 | hi 승리 잔여 | R1 선턴 |`, `|---|---|---|---|---|---|---|---|---|---|`);
  for(const sc of sec.list){ let base=null;
    for(const tn of sec.tabs){ const c=cell(sc,tn); total+=c.n; if(!base) base=c;
      const up=c.out.filter((w,i)=>w&&!base.out[i]).length, down=c.out.filter((w,i)=>!w&&base.out[i]).length;
      L.push(`| ${sc.label} | ${tn} | **${pct(c.win,c.n)}%** (${pct(c.winA,N)} / ${pct(c.winD,N)}) | ${c===base?"—":((c.win-base.win)>=0?"+":"")+f1((c.win-base.win)/c.n*100)} | ${c===base?"—":up+" / "+down} | ${pct(c.judge,c.n)}% | ${f1(c.rounds/c.n)} | ${(c.margin/c.n>=0?"+":"")+(c.margin/c.n).toFixed(2)} | ${c.win?(c.hiRemain/c.win).toFixed(2):"—"} | ${pct(c.hiFirst,c.n)}% |`); } }
}
L.push(``, `총 ${total}판 · 소요 ${Date.now()-t0}ms`);
const text=L.join("\n");
console.log(text);
if(OUT){ fs.writeFileSync(OUT,text+"\n","utf8"); console.error(`저장: ${OUT}`); }
