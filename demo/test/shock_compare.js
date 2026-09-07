/* #96 같은 시드 실제 제품 before/after 대조 — node demo/test/shock_compare.js [--base <git ref>=dadc8bc] [--html <현행 index.html>] [--sims N=40]
   before = `git show <ref>:demo/index.html` 을 메모리로 읽어 harness.load({html}) — 파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).
   기본 기준판 dadc8bc = origin/dev 통합 시점(#91+#95 공격형 너프 반영, #96 미반영). #95 이후를 기준으로 삼아 before/after 차이를 #96(shockProb) 단독으로 귀속한다.
   최초 납품 보고(docs/qa/issue96-mars.md 3.3)의 dcb668e 기준 수치는 `--base dcb668e` 로 재현 가능한 역사 자료이며 #95 변수가 섞여 있다.
   after  = 현행 demo/index.html. 두 제품을 같은 시드로 돌려 (1) 감전 침 부여율 (2) 화상·약화 시드별 결과 완전 일치 (3) shockProb=0.7 이면 옛 제품과 로그 완전 일치
   (4) 잔류장 100% 양쪽 동일 (5) AI vs AI 시뮬 같은 시드 N판의 감전·화상·약화 부여 횟수 총합 을 보고한다. 종료 코드 1 = 대조 판정 실패. */
"use strict";
const path=require("path"), {execSync}=require("child_process");
const H=require("./harness");
const args=process.argv.slice(2); const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const REF=opt("--base","dadc8bc"), HTML=path.resolve(opt("--html",path.join(__dirname,"..","index.html"))), SIMS=Number(opt("--sims","40"));
const ROOT=path.resolve(__dirname,"..","..");
const baseHtml=execSync(`git show ${REF}:demo/index.html`,{cwd:ROOT,encoding:"utf8",maxBuffer:64*1024*1024});
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
const load=(html)=>{ const T=html?H.load(HTML,{html}):H.load(HTML); return T; };
const ROS=(T,id)=>T.ROSTER.find(r=>r.id===id);
function giveSpecies(T,m,r){ m.rosterId=r.id; m.name=r.name; m.element=r.element; m.hp=r.hp; m.maxHp=r.hp; m.atk=r.atk; m.skillAtk=r.skill; m.cdMax=r.cd; m.skills=T.archSkills(r.arch,r.element); m.cds=[0,0,0,0]; m.revealedSkills=[]; }
function arena(T){ H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  const k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,m,7,4); H.place(T,e,6,4); H.place(T,k0,13,1); H.place(T,k1,1,7);
  H.place(T,T.S.pieces.filter(x=>x.owner===0&&x.type==="minion")[1],12,7); H.place(T,T.S.pieces.filter(x=>x.owner===1&&x.type==="minion")[1],2,1); return {m,e}; }
function openBattle(T,m,e){ T.S.battle=null; T.S.battlesUsed=0; m.hp=m.maxHp; e.hp=e.maxHp; m.cds=[0,0,0,0]; e.cds=[0,0,0,0]; T.TQ.length=0; T.startRounds(m,e,m,e); T.TQ.length=0; }
/* 시드별 단발 결과 벡터 — A 가 slot 실행 후 pred(e) */
function vec(T,m,e,N,base,slot,pred){ const out=[]; for(let i=0;i<N;i++){ openBattle(T,m,e); T.setSeed(base+i); T.execSlot("A",slot); out.push(pred(e)?1:0); } return out; }
/* 전투 1판 완주 로그 — 양측이 고정 순서(라운드마다 슬롯 순환)로 execSlot, 사망·판정까지. finishBattle 후 S.battle 이 null 이 되므로 blog 참조를 붙잡아 둔다 */
function fullBattleLog(T,m,e,seed){ openBattle(T,m,e); T.setSeed(seed); const B=T.S.battle; let guard=0;
  while(T.S.battle===B&&guard++<60){ const side=(()=>{ let f=B.round%2===1; if(f&&B.fa.shock) f=false; if(!f&&B.fd.shock) f=true; return B.phase===0?(f?"A":"D"):(f?"D":"A"); })();
    const f=side==="A"?B.fa:B.fd; let slot=-1; for(const s of [(B.round+B.phase)%4,1,0,3,2]) if(f.cds[s]===0){ slot=s; break; } T.execSlot(side,slot); }
  return {blog:B.blog.slice(),hpA:m.hp,hpD:e.hp,ended:T.S.battle!==B}; }
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

const Tb=load(baseHtml), Ta=load(null);
console.log(`before = git ${REF}:demo/index.html (statusProb ${Tb.BAL.statusProb}, shockProb ${Tb.BAL.shockProb}) · after = ${path.relative(ROOT,HTML).replace(/\\/g,"/")} (statusProb ${Ta.BAL.statusProb}, shockProb ${Ta.BAL.shockProb})`);
ok(Tb.BAL.shockProb===undefined&&Ta.BAL.shockProb===0.5&&Tb.BAL.statusProb===0.7&&Ta.BAL.statusProb===0.7,"0 기준판에는 shockProb 없음 · 현행 0.5 · statusProb 양쪽 0.7");

/* 1. 감전 침 1000회 × 5 시드 창 — before ≈70% / after ≈50% */
{
  const rows=[];
  for(const base of [96000,10000,20000,30000,40000]){
    const {m:mb,e:eb}=arena(Tb); giveSpecies(Tb,mb,ROS(Tb,"M-L1")); giveSpecies(Tb,eb,ROS(Tb,"M-G1"));
    const {m:ma,e:ea}=arena(Ta); giveSpecies(Ta,ma,ROS(Ta,"M-L1")); giveSpecies(Ta,ea,ROS(Ta,"M-G1"));
    const vb=vec(Tb,mb,eb,1000,base,1,o=>o.shock===1), va=vec(Ta,ma,ea,1000,base,1,o=>o.shock===1);
    const hb=vb.reduce((a,b)=>a+b,0), ha=va.reduce((a,b)=>a+b,0);
    const subset=va.every((v,i)=>!v||vb[i]===1);
    rows.push({base,before:hb,after:ha,subset});
  }
  console.log("1. 감전 침 1000회 부여 (시드 base+i):"); for(const r of rows) console.log(`   base ${r.base}: before ${r.before}/1000 (${(r.before/10).toFixed(1)}%) → after ${r.after}/1000 (${(r.after/10).toFixed(1)}%) · after 성공 ⊂ before 성공 = ${r.subset}`);
  ok(rows.every(r=>r.after>=450&&r.after<=550),"1a after 감전 침 부여율 5창 모두 45~55%");
  ok(rows.every(r=>r.before>=650&&r.before<=750),"1b before 감전 침 부여율 5창 모두 65~75% (기준판 70%)");
  ok(rows.every(r=>r.subset&&r.after<r.before),"1c 같은 시드에서 after 성공 ⊂ before 성공 (같은 난수·낮은 문턱) · 빈도 감소");
}

/* 2. 화상·약화 시드별 결과 완전 일치 (1000 시드) + 불 vs 물 완주 전투 로그 200판 완전 일치 */
{
  let allSame=true; const detail=[];
  for(const [rid,pred,ko] of [["M-F1",o=>o.burn,"화상"],["M-W1",o=>o.weaken,"약화"]]){
    const {m:mb,e:eb}=arena(Tb); giveSpecies(Tb,mb,ROS(Tb,rid)); giveSpecies(Tb,eb,ROS(Tb,"M-G1"));
    const {m:ma,e:ea}=arena(Ta); giveSpecies(Ta,ma,ROS(Ta,rid)); giveSpecies(Ta,ea,ROS(Ta,"M-G1"));
    const vb=vec(Tb,mb,eb,1000,96000,1,pred), va=vec(Ta,ma,ea,1000,96000,1,pred);
    const s=same(vb,va); if(!s) allSame=false; detail.push(`${ko} ${vb.reduce((a,b)=>a+b,0)}/1000 == ${va.reduce((a,b)=>a+b,0)}/1000 일치=${s}`);
  }
  console.log("2. 화상·약화 시드별 부여 결과: "+detail.join(" · "));
  ok(allSame,"2a 화상·약화 1000 시드 결과 벡터 before == after");
  let logSame=0; for(let i=0;i<200;i++){
    const {m:mb,e:eb}=arena(Tb); giveSpecies(Tb,mb,ROS(Tb,"M-F1")); giveSpecies(Tb,eb,ROS(Tb,"M-W5"));
    const {m:ma,e:ea}=arena(Ta); giveSpecies(Ta,ma,ROS(Ta,"M-F1")); giveSpecies(Ta,ea,ROS(Ta,"M-W5"));
    const b=fullBattleLog(Tb,mb,eb,5000+i), a=fullBattleLog(Ta,ma,ea,5000+i);
    if(same(b,a)&&b.ended&&b.blog.length>6) logSame++; }
  ok(logSame===200,"2b 불 표준형 vs 물 지속형(잔류장 약화 100%) 완주 전투 200판 로그·HP before == after ("+logSame+"/200)");
}

/* 3. after 에 shockProb=0.7 을 넣으면 옛 제품과 번개 전투 로그가 완전히 같다 (구조·순서·지속·해제 불변의 등가 증명) */
{
  Ta.BAL.shockProb=0.7; let n=0, nShock=0;
  for(let i=0;i<200;i++){
    const {m:mb,e:eb}=arena(Tb); giveSpecies(Tb,mb,ROS(Tb,"M-L1")); giveSpecies(Tb,eb,ROS(Tb,"M-F3"));
    const {m:ma,e:ea}=arena(Ta); giveSpecies(Ta,ma,ROS(Ta,"M-L1")); giveSpecies(Ta,ea,ROS(Ta,"M-F3"));
    const b=fullBattleLog(Tb,mb,eb,6000+i), a=fullBattleLog(Ta,ma,ea,6000+i);
    if(same(b,a)&&b.ended) n++; if(b.blog.some(l=>/감전 —/.test(l))) nShock++; }
  ok(n===200&&nShock>50,"3a shockProb=0.7 → 번개 표준형 vs 불 방어형 완주 200판 로그·HP 완전 일치 ("+n+"/200, 감전 발생 판 "+nShock+")");
  Ta.BAL.shockProb=0.5; let diff=0, sameCnt=0;
  for(let i=0;i<200;i++){
    const {m:mb,e:eb}=arena(Tb); giveSpecies(Tb,mb,ROS(Tb,"M-L1")); giveSpecies(Tb,eb,ROS(Tb,"M-F3"));
    const {m:ma,e:ea}=arena(Ta); giveSpecies(Ta,ma,ROS(Ta,"M-L1")); giveSpecies(Ta,ea,ROS(Ta,"M-F3"));
    const b=fullBattleLog(Tb,mb,eb,6000+i), a=fullBattleLog(Ta,ma,ea,6000+i); if(same(b,a)) sameCnt++; else diff++; }
  console.log(`3. shockProb 0.5(현행) 같은 시드 번개 전투 200판: 로그 동일 ${sameCnt} · 달라짐 ${diff} (감전 판정이 0.5~0.7 구간에 든 판만 갈라진다)`);
  ok(diff>0&&sameCnt>0,"3b 기본값에서는 일부 판만 갈라진다 (0.5≤r<0.7 인 판정) — 나머지 판은 완전 동일");
}

/* 4. 잔류장(번개 지속형) 100% 양쪽 동일 · rand 소비 동일 */
{
  const {m:mb,e:eb}=arena(Tb); giveSpecies(Tb,mb,ROS(Tb,"M-L5")); giveSpecies(Tb,eb,ROS(Tb,"M-G1"));
  const {m:ma,e:ea}=arena(Ta); giveSpecies(Ta,ma,ROS(Ta,"M-L5")); giveSpecies(Ta,ea,ROS(Ta,"M-G1"));
  const vb=vec(Tb,mb,eb,300,7000,3,o=>o.shock===1), va=vec(Ta,ma,ea,300,7000,3,o=>o.shock===1);
  const nb=[],na=[]; for(let i=0;i<300;i++){ openBattle(Tb,mb,eb); Tb.setSeed(7000+i); Tb.execSlot("A",3); nb.push(Tb.rand()); openBattle(Ta,ma,ea); Ta.setSeed(7000+i); Ta.execSlot("A",3); na.push(Ta.rand()); }
  ok(vb.every(x=>x===1)&&va.every(x=>x===1)&&same(nb,na),"4 잔류장 번개 300회 100% before == after · 이후 난수 상태 동일 (보장 경로 rand 소비 불변)");
}

/* 5. AI vs AI 시뮬 같은 시드 N판 — 감전·화상·약화 부여 횟수 총합 (blog push 가로채기) */
/* 주의: harness 의 가짜 setTimeout 은 전역이라 제품 코드가 미루는 콜백은 "가장 최근 load" 의 큐(Ta.TQ)에 쌓인다 — before(Tb) 시뮬도 그 큐로 돌린다 */
function simCount(T,seed){
  const Q=Ta.TQ; const cnt={shock:0,burn:0,weaken:0,fail:0,battles:0}; const seen=new WeakSet();
  const hook=()=>{ const B=T.S.battle; if(!B||seen.has(B)) return; seen.add(B); cnt.battles++;
    for(const l of B.blog) tally(l);
    B.blog.push=function(){ for(const l of arguments) tally(l); return Array.prototype.push.apply(this,arguments); }; };
  const tally=l=>{ if(/감전 — 다음/.test(l)) cnt.shock++; else if(/화상을 입었다/.test(l)) cnt.burn++; else if(/약화되었다/.test(l)) cnt.weaken++; else if(l==="상태이상 부여 실패!") cnt.fail++; };
  T.setSeed(seed); Q.length=0; T.startMode("sim",{aiLevel:["grade5","grade5"]}); hook();
  let n=0; while(Q.length&&n<5000000){ Q.shift()(); n++; hook(); }
  cnt.phase=T.S.phase; cnt.turns=T.S.turnCount; return cnt;
}
{
  const tot={b:{shock:0,burn:0,weaken:0,fail:0,battles:0},a:{shock:0,burn:0,weaken:0,fail:0,battles:0}}; let over=0;
  for(let i=0;i<SIMS;i++){ const b=simCount(Tb,9600+i), a=simCount(Ta,9600+i); if(b.phase==="over"&&a.phase==="over") over++;
    for(const k of ["shock","burn","weaken","fail","battles"]){ tot.b[k]+=b[k]; tot.a[k]+=a[k]; } }
  console.log(`5. AI vs AI(5급·5급) 같은 시드 ${SIMS}판: before 전투 ${tot.b.battles} 감전 ${tot.b.shock} 화상 ${tot.b.burn} 약화 ${tot.b.weaken} 실패 ${tot.b.fail} → after 전투 ${tot.a.battles} 감전 ${tot.a.shock} 화상 ${tot.a.burn} 약화 ${tot.a.weaken} 실패 ${tot.a.fail} (완주 ${over}/${SIMS})`);
  console.log(`   전투당 감전: before ${(tot.b.shock/tot.b.battles).toFixed(3)} → after ${(tot.a.shock/tot.a.battles).toFixed(3)} · 판당 감전: before ${(tot.b.shock/SIMS).toFixed(2)} → after ${(tot.a.shock/SIMS).toFixed(2)} (시드 분기 후 판이 갈라지므로 총합 비교이지 판별 대응이 아니다)`);
  ok(over===SIMS,"5a 시뮬 완주 before·after 모두 "+SIMS+"판");
  ok(tot.a.shock/tot.a.battles<tot.b.shock/tot.b.battles,"5b 전투당 감전 부여 빈도 감소 (방향성)");
}

console.log(`\n=== shock_compare: pass ${pass} / fail ${fail} === (before git ${REF} · after 현행)`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
