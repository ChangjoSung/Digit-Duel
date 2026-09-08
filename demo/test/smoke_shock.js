/* #96 감전 부여 확률 하향 (v0.4.4 §4) 헤드리스 회귀 — node demo/test/smoke_shock.js [demo/index.html]
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전). 음성 대조(J절)는 메모리 안에서 변형한 HTML 을 harness.load({html}) 로 올린다.
   계약: BAL.shockProb=0.5 신설 · 감전(효과기 경로·레거시 비지속형)만 shockProb · 화상·약화는 statusProb 0.7 · 잔류장·레거시 지속형 100% · 보장 경로 rand 미소비 · 문구 50% · AI +4 유지 */
"use strict";
const fs=require("fs"), path=require("path");
const H=require("./harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","index.html");
const T=H.load(htmlPath);
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
const ROS=id=>T.ROSTER.find(r=>r.id===id);
function giveSpecies(T,m,r){ m.rosterId=r.id; m.name=r.name; m.element=r.element; m.hp=r.hp; m.maxHp=r.hp; m.atk=r.atk; m.skillAtk=r.skill; m.cdMax=r.cd; m.skills=T.archSkills(r.arch,r.element); m.cds=[0,0,0,0]; m.revealedSkills=[]; }
/* 레거시(로스터 미적용) 하수인: skills=null · element/skillAtk 직접 — 제품 플레이에서는 도달하지 않는 테스트 호환 경로 */
function giveLegacy(T,m,el,rosterId){ m.rosterId=rosterId||null; m.name=null; m.element=el; m.hp=100; m.maxHp=100; m.atk=20; m.skillAtk=35; m.cdMax=2; m.cd=0; m.skills=null; m.cds=[0,0,0,0]; m.revealedSkills=null; }
/* 1:1 전투 장면 — 공격측 m(A) vs 방어측 e(D). 왕은 구석, 전멸 방지 하수인 1기. 반환: {m,e} */
function arena(T,mode){
  H.freshPlay(T,mode||"pvp"); H.clearBoard(T);
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  const k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,m,7,4); H.place(T,e,6,4); H.place(T,k0,13,1); H.place(T,k1,1,7);
  H.place(T,T.S.pieces.filter(x=>x.owner===0&&x.type==="minion")[1],12,7);
  H.place(T,T.S.pieces.filter(x=>x.owner===1&&x.type==="minion")[1],2,1);
  return {m,e};
}
/* 시드 고정 후 fn 실행 → 소비한 rand 횟수 (mulberry32 결정론: 다음 값이 시드 재생 몇 번째인가) */
function randConsumed(T,seed,fn){
  T.setSeed(seed); fn(); const nxt=T.rand();
  T.setSeed(seed); let k=0; while(k<200){ if(T.rand()===nxt) break; k++; } return k;
}
/* 전투 1회 준비 — 같은 두 말로 startRounds 를 다시 연다 (S.battle 교체·상태 초기화·쿨 0) */
function openBattle(T,m,e){ T.S.battle=null; T.S.battlesUsed=0; m.hp=m.maxHp; e.hp=e.maxHp; m.cds=[0,0,0,0]; e.cds=[0,0,0,0]; m.cd=0; e.cd=0; T.TQ.length=0; T.startRounds(m,e,m,e); T.TQ.length=0; }
/* N회 시행: 매회 새 전투·시드 base+i → A 가 slot 실행 → 판정자 pred(opp) 참/거짓 집계 + rand 소비 분포 */
function trials(T,m,e,N,base,act,pred){
  let hit=0; const consumed={};
  for(let i=0;i<N;i++){ openBattle(T,m,e);
    const k=randConsumed(T,base+i,()=>act(T)); consumed[k]=(consumed[k]||0)+1;
    if(pred(e)) hit++; }
  return {hit,rate:hit/N,consumed};
}
const shockPct=(T,m,e,N,base,slot)=>trials(T,m,e,N,base,T2=>T2.execSlot("A",slot),o=>o.shock===1&&o.shockFresh===true);
const readSrc=p=>fs.readFileSync(path.join(__dirname,p),"utf8");

/* ===== A. 상수·문구 (AC 1·6) ===== */
{
  ok(T.BAL.statusProb===0.7,"A1 BAL.statusProb 0.7 불변");
  ok(T.BAL.shockProb===0.5,"A2 BAL.shockProb 0.5 신설");
  ok(T.SKILLS.lightning_effect.desc==="50% 확률 감전(후공 1회)","A3 감전 침 desc '50% 확률 감전(후공 1회)' ["+T.SKILLS.lightning_effect.desc+"]");
  ok(T.SKILLS.fire_effect.desc==="70% 확률 화상 2R"&&T.SKILLS.water_effect.desc==="70% 확률 약화 2회","A4 화상·약화 desc 70% 유지");
  ok(T.SKILLS.sig_sustain.desc==="자기 속성 상태효과 부여 (100%)"&&T.SKILLS.sig_sustain.statusSelf===true,"A5 잔류장 desc·statusSelf 불변");
  ok(!/70% 확률 감전/.test(T.html),"A6 소스에 '70% 확률 감전' 잔존 0");
  const other=["fire_effect","water_effect","lightning_effect","lightning_stable","lightning_heavy","sig_sustain"].map(k=>{const s=Object.assign({},T.SKILLS[k]); delete s.desc; return JSON.stringify(s);}).join("|");
  ok(other==='{"ko":"잔불 표식","kind":"attack","el":"fire","tier":"effect","cd":2,"pow":22,"status":true}|{"ko":"침식 수류","kind":"attack","el":"water","tier":"effect","cd":2,"pow":22,"status":true}|{"ko":"감전 침","kind":"attack","el":"lightning","tier":"effect","cd":2,"pow":22,"status":true}|{"ko":"전기탄","kind":"attack","el":"lightning","tier":"stable","cd":0,"pow":26}|{"ko":"연쇄 번개","kind":"attack","el":"lightning","tier":"heavy","cd":3,"pow":34,"bonusVsStatus":6}|{"ko":"잔류장","kind":"sig","cd":3,"pow":18,"statusSelf":true}',"A7 관련 기술의 desc 외 필드(위력·쿨·플래그) 불변 — #92 기술 속성 필드 el·tier 만 추가");
}

/* ===== B. 감전 침 1000회 부여율 (AC 3) — 실제 execSlot · 표준형 번개(M-L1, 슬롯1=lightning_effect) vs 풀 표준형(M-G1, 상성 없음·상태 없음) ===== */
let B_RATE=null;
{
  const {m,e}=arena(T,"pvp"); giveSpecies(T,m,ROS("M-L1")); giveSpecies(T,e,ROS("M-G1"));
  ok(m.skills[1]==="lightning_effect"&&T.SKILLS[m.skills[1]].status===true,"B0 표준형 번개 슬롯1 = 감전 침(status)");
  const r=shockPct(T,m,e,1000,96000,1); B_RATE=r;
  ok(r.rate>=0.45&&r.rate<=0.55,"B1 감전 침 1000회 부여율 45~55% [실측 "+r.hit+"/1000 = "+(r.rate*100).toFixed(1)+"%]");
  ok(Object.keys(r.consumed).join(",")==="2","B2 매 시행 rand 소비 2회(분산 1 + 감전 판정 1) — 새 RNG 소비 없음 ["+JSON.stringify(r.consumed)+"]");
  const met=T.S.metrics; ok(met.statusApplied+met.statusFailed>=1000,"B3 statusApplied+statusFailed 집계 유지 ("+met.statusApplied+"+"+met.statusFailed+")");
  // 결정론: 같은 시드 → 같은 결과
  const r2=shockPct(T,m,e,200,96000,1);
  let same=true; for(let i=0;i<200;i++){ openBattle(T,m,e); T.setSeed(96000+i); T.execSlot("A",1); const a=e.shock===1; openBattle(T,m,e); T.setSeed(96000+i); T.execSlot("A",1); if(a!==(e.shock===1)) same=false; }
  ok(same&&r2.hit===trials(T,m,e,200,96000,T2=>T2.execSlot("A",1),o=>o.shock===1).hit,"B4 같은 시드 → 같은 감전 결과 (결정론)");
  // 감전 침 사용 후 상태: shock=1 · shockFresh · 라운드 종료 시 shockFresh 해제 → 다음 라운드 후공 → 그 라운드 종료 시 해제 (지속·해제·순서 불변)
  let seed=-1; for(let i=0;i<200;i++){ openBattle(T,m,e); T.setSeed(96000+i); T.execSlot("A",1); if(e.shock===1){ seed=96000+i; break; } }
  ok(seed>=0,"B5 감전 성공 시드 확보 ("+seed+")");
  const B=T.S.battle;
  ok(B.round===1&&B.phase===1&&e.shock===1&&e.shockFresh===true,"B6 R1 A 행동 후 phase 1 · D 감전 1R·fresh");
  T.execSlot("D",0); // D 의 R1 행동 → 라운드 종료 처리
  ok(T.S.battle===B&&B.round===2&&B.phase===0&&e.shock===1&&e.shockFresh===false,"B7 R1 종료: 부여 라운드에는 소진되지 않음 (shock 1 · fresh 해제)");
  const order=(()=>{ const B=T.S.battle; let firstIsAtt=B.round%2===1; if(firstIsAtt&&B.fa.shock) firstIsAtt=false; if(!firstIsAtt&&B.fd.shock) firstIsAtt=true; return firstIsAtt?"A":"D"; })();
  ok(order==="A","B8 R2(짝수: 원래 D 선공) 에서 감전된 D 가 후공 → A 선공");
  T.execSlot("A",0); T.execSlot("D",0);
  ok(T.S.battle===B&&B.round===3&&e.shock===0&&B.blog.some(l=>/감전이 풀렸다/.test(l)),"B9 R2 종료 시 감전 해제 로그·shock 0 (1R 지속)");
  ok(B.blog.filter(l=>/감전 — 다음 1라운드 후공/.test(l)).length===1,"B10 감전 로그 문구 '다음 1라운드 후공' 1회");
}

/* ===== C. 화상·약화는 statusProb, 감전만 shockProb — 키 분리 (AC 1·2) ===== */
{
  const {m,e}=arena(T,"pvp");
  const N=1000, cases=[["M-F1","fire_effect",o=>o.burn===T.BAL.burnRounds,"화상"],["M-W1","water_effect",o=>o.weaken===T.BAL.weakenHits,"약화"],["M-L1","lightning_effect",o=>o.shock===1,"감전"]];
  const rates={};
  for(const [rid,sk,pred,ko] of cases){ giveSpecies(T,m,ROS(rid)); giveSpecies(T,e,ROS("M-G1")); ok(m.skills[1]===sk,"C0 "+rid+" 슬롯1 = "+sk);
    rates[ko]=trials(T,m,e,N,96000,T2=>T2.execSlot("A",1),pred); }
  ok(rates["화상"].rate>=0.65&&rates["화상"].rate<=0.75,"C1 화상 1000회 부여율 65~75% (statusProb 0.7) [실측 "+(rates["화상"].rate*100).toFixed(1)+"%]");
  ok(rates["약화"].rate>=0.65&&rates["약화"].rate<=0.75,"C2 약화 1000회 부여율 65~75% (statusProb 0.7) [실측 "+(rates["약화"].rate*100).toFixed(1)+"%]");
  ok(rates["감전"].rate>=0.45&&rates["감전"].rate<=0.55,"C3 감전 1000회 부여율 45~55% (shockProb 0.5) [실측 "+(rates["감전"].rate*100).toFixed(1)+"%]");
  ok([rates["화상"],rates["약화"],rates["감전"]].every(r=>Object.keys(r.consumed).join(",")==="2"),"C4 세 상태 모두 rand 소비 2회 (판정 1회) — 소비 순서·횟수 동일");
  // 같은 시드에서 화상·약화·감전의 판정 난수는 같은 값이므로: 감전 성공 집합 ⊂ 화상 성공 집합 (0.5 < 0.7 — 같은 rand 를 다른 문턱으로 봄)
  let subset=true, shockHits=0, burnHits=0;
  for(let i=0;i<300;i++){ giveSpecies(T,m,ROS("M-L1")); openBattle(T,m,e); T.setSeed(96000+i); T.execSlot("A",1); const s=e.shock===1;
    giveSpecies(T,m,ROS("M-F1")); openBattle(T,m,e); T.setSeed(96000+i); T.execSlot("A",1); const b=e.burn>0;
    if(s&&!b) subset=false; if(s) shockHits++; if(b) burnHits++; }
  ok(subset&&shockHits<burnHits,"C5 같은 시드: 감전 성공 ⊂ 화상 성공 (같은 난수, 문턱 0.5<0.7) ["+shockHits+"⊂"+burnHits+"/300]");
  // 키 격리: statusProb 만 1 → 화상·약화 100%, 감전은 0.5 그대로 / shockProb 만 1 → 감전 100%, 화상·약화 0.7 그대로
  const sv=T.BAL.statusProb, sh=T.BAL.shockProb;
  T.BAL.statusProb=1; T.BAL.shockProb=0;
  giveSpecies(T,m,ROS("M-F1")); const f1=trials(T,m,e,100,500,T2=>T2.execSlot("A",1),o=>o.burn>0).rate;
  giveSpecies(T,m,ROS("M-W1")); const w1=trials(T,m,e,100,500,T2=>T2.execSlot("A",1),o=>o.weaken>0).rate;
  giveSpecies(T,m,ROS("M-L1")); const l0=trials(T,m,e,100,500,T2=>T2.execSlot("A",1),o=>o.shock>0).rate;
  ok(f1===1&&w1===1&&l0===0,"C6 statusProb=1·shockProb=0 → 화상 100%·약화 100%·감전 0% (감전은 statusProb 를 읽지 않는다)");
  T.BAL.statusProb=0; T.BAL.shockProb=1;
  giveSpecies(T,m,ROS("M-F1")); const f0=trials(T,m,e,100,500,T2=>T2.execSlot("A",1),o=>o.burn>0).rate;
  giveSpecies(T,m,ROS("M-W1")); const w0=trials(T,m,e,100,500,T2=>T2.execSlot("A",1),o=>o.weaken>0).rate;
  giveSpecies(T,m,ROS("M-L1")); const l1=trials(T,m,e,100,500,T2=>T2.execSlot("A",1),o=>o.shock>0).rate;
  ok(f0===0&&w0===0&&l1===1,"C7 statusProb=0·shockProb=1 → 화상 0%·약화 0%·감전 100% (화상·약화는 shockProb 를 읽지 않는다)");
  T.BAL.statusProb=sv; T.BAL.shockProb=sh;
  // 실패 시 문구·집계
  giveSpecies(T,m,ROS("M-L1")); let seedFail=-1; for(let i=0;i<100;i++){ openBattle(T,m,e); T.setSeed(96000+i); T.execSlot("A",1); if(!e.shock){ seedFail=96000+i; break; } }
  ok(seedFail>=0&&T.S.battle.blog.some(l=>l==="상태이상 부여 실패!")&&!T.S.battle.blog.some(l=>/감전 —/.test(l)),"C8 감전 실패 시 '상태이상 부여 실패!' 로그·감전 로그 없음 (시드 "+seedFail+")");
}

/* ===== D. 잔류장(번개 지속형 시그니처) 100% · 보장 경로 rand 미소비 (AC 4) ===== */
{
  const {m,e}=arena(T,"pvp"); giveSpecies(T,m,ROS("M-L5")); giveSpecies(T,e,ROS("M-G1"));
  ok(m.skills[3]==="sig_sustain"&&m.skills[0]==="lightning_effect","D0 지속형 번개: 슬롯3 잔류장 · 슬롯0 감전 침");
  const sv=T.BAL.statusProb, sh=T.BAL.shockProb;
  const r=shockPct(T,m,e,300,7000,3);
  ok(r.rate===1&&Object.keys(r.consumed).join(",")==="1","D1 잔류장 300회 감전 100% · rand 소비 1회(분산만 — 판정 난수 없음) ["+JSON.stringify(r.consumed)+"]");
  T.BAL.shockProb=0; T.BAL.statusProb=0;
  const r0=shockPct(T,m,e,100,7000,3);
  ok(r0.rate===1&&Object.keys(r0.consumed).join(",")==="1","D2 shockProb=0·statusProb=0 이어도 잔류장 감전 100% · rand 소비 1회 (확률 키를 읽지 않는다)");
  const r1=shockPct(T,m,e,300,7000,0);
  ok(r1.rate===0,"D3 shockProb=0 → 지속형 본체의 감전 침(효과기 경로)은 0% — 잔류장과 분리");
  T.BAL.shockProb=sh; T.BAL.statusProb=sv;
  const r2=shockPct(T,m,e,1000,7000,0);
  ok(r2.rate>=0.45&&r2.rate<=0.55,"D4 지속형 번개의 감전 침 1000회도 45~55% (아키타입 무관 — 효과기 경로) [실측 "+(r2.rate*100).toFixed(1)+"%]");
  // 불 지속형 잔류장(화상 100%)도 rand 1회 — 보장 경로 공통
  giveSpecies(T,m,ROS("M-F5")); const fb=trials(T,m,e,100,7000,T2=>T2.execSlot("A",3),o=>o.burn>0);
  ok(fb.rate===1&&Object.keys(fb.consumed).join(",")==="1","D5 불 잔류장 화상 100% · rand 소비 1회 (보장 경로 변경 없음)");
  // 잔류장 감전 후 지속 1R (부채 (b): 잔류장·감전 침 shock=1 — 이번 범위에서 고치지 않음)
  giveSpecies(T,m,ROS("M-L5")); openBattle(T,m,e); T.setSeed(7000); T.execSlot("A",3);
  ok(e.shock===1&&e.shockFresh===true,"D6 잔류장 감전 = shock 1 · fresh (현행 유지 — 부채 (b) 기록만)");
}

/* ===== E. 레거시 경로 (로스터 미적용 하수인 · __actCore('skill') · tryStatus) — 비지속형 50% · 지속형 100% (AC 5) ===== */
{
  const {m,e}=arena(T,"pvp"); giveLegacy(T,m,"lightning",null); giveLegacy(T,e,"grass",null);
  const legacyAct=T2=>{ if(typeof global.__actCore!=="function") throw new Error("__actCore 미노출"); global.__actCore("skill"); };
  openBattle(T,m,e); ok(m.skills===null&&T.archOf(m)===null&&typeof global.__actCore==="function","E0 레거시 하수인(skills null·archOf null)·__actCore 노출");
  const r=trials(T,m,e,1000,96000,legacyAct,o=>o.shock===1&&o.shockFresh===true);
  ok(r.rate>=0.45&&r.rate<=0.55&&Object.keys(r.consumed).join(",")==="2","E1 레거시 비지속형 번개 1000회 감전 45~55% · rand 2회 [실측 "+(r.rate*100).toFixed(1)+"% "+JSON.stringify(r.consumed)+"]");
  const sv=T.BAL.statusProb, sh=T.BAL.shockProb;
  T.BAL.statusProb=1; T.BAL.shockProb=0; const l0=trials(T,m,e,100,500,legacyAct,o=>o.shock>0).rate;
  T.BAL.statusProb=0; T.BAL.shockProb=1; const l1=trials(T,m,e,100,500,legacyAct,o=>o.shock>0).rate;
  ok(l0===0&&l1===1,"E2 레거시 번개는 shockProb 만 읽는다 (statusProb=1·shockProb=0 → 0% / 반대 → 100%)");
  giveLegacy(T,m,"fire",null); const f1=trials(T,m,e,100,500,legacyAct,o=>o.burn>0).rate; T.BAL.statusProb=1; T.BAL.shockProb=0; const f2=trials(T,m,e,100,500,legacyAct,o=>o.burn>0).rate;
  ok(f1===0&&f2===1,"E3 레거시 화상은 statusProb 만 읽는다 (shockProb=1·statusProb=0 → 0% / 반대 → 100%)");
  T.BAL.statusProb=sv; T.BAL.shockProb=sh;
  giveLegacy(T,m,"fire",null); const fr=trials(T,m,e,1000,96000,legacyAct,o=>o.burn>0);
  ok(fr.rate>=0.65&&fr.rate<=0.75,"E4 레거시 화상 1000회 65~75% 유지 [실측 "+(fr.rate*100).toFixed(1)+"%]");
  // 지속형(archOf==='sustain' — rosterId 만 지속형, skills null) → 100% · shock 2R · rand 1회
  giveLegacy(T,m,"lightning","M-L5"); ok(T.archOf(m)==="sustain"&&m.skills===null,"E5 레거시 지속형 구성 (rosterId M-L5 · skills null)");
  T.BAL.shockProb=0; T.BAL.statusProb=0;
  const rs=trials(T,m,e,200,7000,legacyAct,o=>o.shock===2&&o.shockFresh===true);
  ok(rs.rate===1&&Object.keys(rs.consumed).join(",")==="1","E6 레거시 지속형 번개 200회 감전 100%(확률 키 0 이어도) · 2R · rand 1회 (판정 난수 없음)");
  T.BAL.shockProb=sh; T.BAL.statusProb=sv;
  ok(T.S.battle.blog.some(l=>/감전 — 다음 2라운드 후공/.test(l)),"E7 레거시 지속형 로그 '다음 2라운드 후공' (부채 (b): 4슬롯 1R 와의 차이는 기록만)");
}

/* ===== F. 해제 경로 불변: 해독제·정화·전투 종료 ===== */
{
  const {m,e}=arena(T,"pvp"); giveSpecies(T,m,ROS("M-L1")); giveSpecies(T,e,ROS("M-L5")); // e: 지속형(슬롯2 정화)
  const sh=T.BAL.shockProb; T.BAL.shockProb=1;
  openBattle(T,m,e); T.setSeed(1); T.execSlot("A",1); ok(e.shock===1,"F0 감전 부여(shockProb=1)");
  T.execSlot("D",2); ok(e.shock===0&&e.shockFresh===false&&T.S.battle.blog.some(l=>/감전이 정화되었다/.test(l)),"F1 정화(sup_cleanse)로 감전 해제");
  openBattle(T,m,e); T.setSeed(1); T.execSlot("A",1); T.S.inv[1]=["cure"]; T.S.battle.itemsD=0; T.S.battle.itemRoundD=false;
  T.battleModal(); ok(e.shock===1&&typeof global.__useItemCore==="function","F2a 감전 상태에서 D 차례 · __useItemCore 노출");
  global.__useItemCore(0);
  ok(e.shock===0&&e.shockFresh===false&&T.S.battle.blog.some(l=>/해독제 — 상태이상 해제/.test(l)),"F2 해독제(cure)로 감전 해제 (shock 0 · fresh 해제 · 로그)");
  openBattle(T,m,e); T.setSeed(1); T.execSlot("A",1); e.hp=1; T.execSlot("A",0);
  ok(!T.S.battle&&e.shock===0&&e.shockFresh===false,"F3 전투 종료(즉사) 후 resetAfter 로 감전 해제");
  T.BAL.shockProb=sh;
}

/* ===== G. AI: 상태 미부여 상대 +4 가산 유지 · 확률 미반영 (계약: AI 가산 유지) ===== */
{
  const src5=String(T.aiBattleAction), srcD=String(T.aiBattleActionStrong);
  ok(/statusKey=\{fire:"burn",water:"weaken",lightning:"shock"\}/.test(src5)&&/sk\.status&&statusKey&&!opp\[statusKey\]\) sc\+=4/.test(src5),"G1 5급 전투 AI: 상태 키 매핑·미부여 상대 +4 가산 그대로");
  ok(/statusKey=\{fire:"burn",water:"weaken",lightning:"shock"\}/.test(srcD)&&/sk\.status&&statusKey&&!opp\[statusKey\]\) sc\+=4/.test(srcD),"G2 5단 전투 AI: 상태 키 매핑·+4 가산 그대로");
  ok(!/shockProb/.test(src5)&&!/shockProb/.test(srcD)&&!/statusProb/.test(src5)&&!/statusProb/.test(srcD),"G3 전투 AI 는 shockProb·statusProb 를 읽지 않는다 (확률 미반영 유지)");
  // 같은 시드 AI 대전 완주 (기본 확률 그대로) — 감전 변경이 게임 루프를 깨지 않는다
  const r=H.runSim(T,["grade5","grade5"],9601,{check:50});
  ok(r.phase==="over"&&r.viol.length===0,"G4 AI vs AI 시뮬 완주·불변식 0 (seed 9601, "+r.turns+"턴)");
  ok(T.BAL.statusProb===0.7&&T.BAL.shockProb===0.5,"G5 시뮬 후 확률 상수 유지");
}

/* ===== H. 테스트 결정론 계약 (AC 7): statusProb=1 을 고정하는 스위트는 shockProb=1 도 고정 ===== */
{
  const files=fs.readdirSync(__dirname).filter(f=>/^smoke_.*\.js$/.test(f)&&f!=="smoke_shock.js"); // 앞으로 추가되는 smoke_*.js(예: #95 smoke_attack_balance)도 자동 포함
  let bad=[]; for(const f of files){ const lines=readSrc(f).split(/\r?\n/); lines.forEach((l,i)=>{ if(/statusProb\s*=\s*1\b/.test(l)&&!/shockProb\s*=\s*1\b/.test(l)) bad.push(f+":"+(i+1)); }); }
  ok(bad.length===0,"H1 statusProb=1 고정 행마다 shockProb=1 동반 ["+(bad.join(", ")||"위반 0")+"]");
  const n=files.reduce((a,f)=>a+(readSrc(f).match(/shockProb\s*=\s*1\b/g)||[]).length,0);
  ok(n>=2,"H2 shockProb=1 고정이 cycle5·minion_art 에 존재 ("+n+"곳 · 검사 파일 "+files.length+"개)");
}

/* ===== I. 표시: 전투 버튼 title · 로스터 정보 팝업 문구 50% ===== */
{
  const {m,e}=arena(T,"pvp"); giveSpecies(T,m,ROS("M-L1")); giveSpecies(T,e,ROS("M-G1"));
  openBattle(T,m,e); T.battleModal();
  const html=T.els.overlayBox?T.els.overlayBox.innerHTML:""; const all=Object.values(T.els).map(x=>x._html||"").join("\n");
  ok(/title="50% 확률 감전\(후공 1회\)"/.test(all)&&!/70% 확률 감전/.test(all),"I1 전투 커맨드 버튼 title '50% 확률 감전(후공 1회)' · 70% 없음");
  ok(/title="70% 확률 화상 2R"|title="70% 확률 약화 2회"|title="안정 공격기"/.test(all),"I2 다른 버튼 title 은 기존 desc 그대로");
  T.S.battle=null; if(typeof T.rosterInfo==="function"){ T.rosterInfo("M-L1"); const pop=Object.values(T.els).map(x=>x._html||"").join("\n");
    ok(/감전 침/.test(pop)&&/50% 확률 감전\(후공 1회\)/.test(pop)&&!/70% 확률 감전/.test(pop),"I3 로스터 정보 팝업(M-L1) 감전 침 설명 50%"); }
  else ok(false,"I3 rosterInfo 미노출");
}

/* ===== J. 음성 대조 — 계약을 어기는 변형 HTML 을 메모리에서 로드해 위 검사기가 실제로 잡는지 확인 (파일 쓰기 없음) ===== */
{
  const src=T.html;
  const mut=(name,from,to)=>{ if(!src.includes(from)) return {name,error:"변형 앵커 없음: "+from}; const html=src.replace(from,to); const M=H.load(htmlPath,{html}); M.BAL.aiDelay=0; return {name,M}; };
  const rateOf=(M,rid,slot,pred,N)=>{ const {m,e}=arena(M,"pvp"); giveSpecies(M,m,M.ROSTER.find(r=>r.id===rid)); giveSpecies(M,e,M.ROSTER.find(r=>r.id==="M-G1")); return trials(M,m,e,N||400,96000,T2=>T2.execSlot("A",slot),pred); };
  // J1: 효과기 경로가 shockProb 를 무시(옛 동작: statusProb 0.7) → B1/C3 의 45~55% 검사기가 잡는다
  let v=mut("effect-ignores-shockProb","gate(force,BAL.shockProb)","gate(force)");
  if(v.M){ const r=rateOf(v.M,"M-L1",1,o=>o.shock===1); ok(r.rate>0.55,"J1 [음성] 효과기가 shockProb 를 무시하면 부여율 "+(r.rate*100).toFixed(1)+"% → 45~55% 검사기가 잡는다"); } else ok(false,"J1 "+v.error);
  // J2: 잔류장이 확률을 굴리게 되면(force 무시) D1 의 100%·rand 1회 검사기가 잡는다
  v=mut("sig-rolls","if(force||rand()<(prob===undefined?BAL.statusProb:prob))","if(rand()<(prob===undefined?BAL.statusProb:prob))");
  if(v.M){ const r=rateOf(v.M,"M-L5",3,o=>o.shock===1); ok(r.rate<1&&Object.keys(r.consumed).join(",")!=="1","J2 [음성] 보장 경로가 난수를 굴리면 100%·rand 1회 검사기가 잡는다 ("+(r.rate*100).toFixed(1)+"% "+JSON.stringify(r.consumed)+")"); } else ok(false,"J2 "+v.error);
  // J3: 화상까지 shockProb 로 내려가면(전역 하향 — Venus 모형과 같은 실수) C1 의 65~75% 검사기가 잡는다
  v=mut("burn-uses-shockProb",'if(atkEl==="fire"&&!opp.burn&&gate(force))','if(atkEl==="fire"&&!opp.burn&&gate(force,BAL.shockProb))'); // #92: 상태 분기는 판정 속성 atkEl 기준
  if(v.M){ const r=rateOf(v.M,"M-F1",1,o=>o.burn>0,1000); ok(r.rate<0.65,"J3 [음성] 화상이 shockProb 를 읽으면 부여율 "+(r.rate*100).toFixed(1)+"% → 65~75% 검사기가 잡는다"); } else ok(false,"J3 "+v.error);
  // J4: 레거시 번개가 statusProb 로 되돌아가면 E1 이 잡는다
  v=mut("legacy-ignores-shockProb","tryStatus(BAL.shockProb)","tryStatus()");
  if(v.M){ const {m,e}=arena(v.M,"pvp"); giveLegacy(v.M,m,"lightning",null); giveLegacy(v.M,e,"grass",null); const r=trials(v.M,m,e,400,96000,()=>global.__actCore("skill"),o=>o.shock===1);
    ok(r.rate>0.55,"J4 [음성] 레거시 번개가 shockProb 를 무시하면 "+(r.rate*100).toFixed(1)+"% → 45~55% 검사기가 잡는다"); } else ok(false,"J4 "+v.error);
  // J5: 문구가 되돌아가면 A3·I1 이 잡는다
  v=mut("desc-70",'desc:"50% 확률 감전(후공 1회)"','desc:"70% 확률 감전(후공 1회)"');
  if(v.M){ ok(v.M.SKILLS.lightning_effect.desc!=="50% 확률 감전(후공 1회)"&&/70% 확률 감전/.test(v.M.html),"J5 [음성] 문구 70% 복귀는 A3/A6 검사기가 잡는다"); } else ok(false,"J5 "+v.error);
  // J6: 보장 경로에서 새 난수를 소비하는 변형(force 여도 rand 호출) → D1/D5 rand 1회 검사기가 잡는다
  v=mut("force-consumes-rand","if(force||rand()<(prob===undefined?BAL.statusProb:prob))","if((rand(),force)||rand()<(prob===undefined?BAL.statusProb:prob))");
  if(v.M){ const r=rateOf(v.M,"M-L5",3,o=>o.shock===1,100); ok(r.rate===1&&Object.keys(r.consumed).join(",")!=="1","J6 [음성] 보장 경로가 난수를 추가 소비하면 rand 1회 검사기가 잡는다 ("+JSON.stringify(r.consumed)+")"); } else ok(false,"J6 "+v.error);
  H.load(htmlPath); // 전역 __act* 를 현행 제품으로 되돌린다
}

console.log(`\n=== smoke_shock: pass ${pass} / fail ${fail} ===`+(B_RATE?` (감전 침 1000회 ${B_RATE.hit}/1000 = ${(B_RATE.rate*100).toFixed(1)}%)`:""));
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
