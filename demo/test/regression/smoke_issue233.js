/* #233 전투 엔진 개편 (GDD-23 3·4장 + 5.6 공통 규칙) 집중 회귀 —
   실행: node demo/test/regression/smoke_issue233.js [demo/index.html]
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).

   이 스위트가 보는 것 — **실제 엔진 함수**를 직접 부르거나 실제 전투 경로로 몰아서 본다. 헬퍼 전용 대체물이 아니다.
     A. 3.4 등급 성장 공식과 "방어력·속도·회피·치명·💫는 등급으로 바뀌지 않는다"
     B. 3.3/3.5/3.6 아키타입·왕·동료·전설 기본 스탯표
     C. 4.1 5속성 상성 순환(땅 포함)
     D. 4.2 피해 계산 ①~⑪ — 단계별 배율·상한·**단일 반올림**·최소 1, GDD 4.7 예시 실측 대조
     E. 3.2 방어막 층 — LIFO·깨짐(breaks) 집계·제거/즉사는 깨짐이 아님
     F. 4.3 일반 피해가 아닌 피해 — 반사·반격·지속(방어막 무시)·예고(지연)·즉사 + 4.6 연쇄 금지
     G. 4.4 선턴·후턴 — 순서 효과 > 속도 > (양쪽 모두 등급일 때만) 낮은 등급 > 접촉 개시자, **라운드 시작 시 확정**
     H. 4.5/5.6 상태·버프 — 중첩(큰 값·긴 지속)·부여 라운드 제외·약화 횟수제
     I. 4.6/5.6 전투 사이 HP만 유지 — 상태·버프·방어막·쿨(슬롯/레거시 스칼라)·예고 초기화
     J. 3.2 💫 상태이상 부여 확률 %p 가산·상한 100%
     K. 3.2 확정 회피/확정 치명 — 확률 판정을 건너뛰고 상한보다 우선, rand 미소비, 1회 소모
     L. 현행 보존 — 전투 판정용 유효 피해 흡수 상한, 동률 = 접촉을 받은 쪽(D) 승

   #234~#238(신규 로스터·시너지 수집·경제·네트워킹·UI 개편)은 이 Issue 범위가 아니다. 균열·경화·회피 증가·
   가하는 피해 증가·확정 효과·반사·반격·예고·즉사는 **아직 거는 기술이 없어** 엔진 계약을 직접 호출해 검증한다. */
"use strict";
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
const T=H.load(htmlPath);
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(got===want,name+` [기대 ${want} · 실측 ${got}]`); }

const realRandom=Math.random;
/* 대본 난수 — rand() 호출 순서대로 값을 먹인다. 반환값은 "지금까지 소비한 개수"를 주는 함수다.
   resolveHit 의 소비 순서는 ① 회피 → ③ 분산 → ⑦ 치명타 이고, 확정 효과(dodgeForce/critForce)는 소비하지 않는다.
   대본이 바닥나면 0.999999 를 준다 — 대본보다 많이 소비하면 소비 개수 단언이 그 사실을 드러낸다. */
function script(vals){ let i=0; T.setSeed(null); Math.random=()=>{ const v=vals[i++]; return v===undefined?0.999999:v; }; return ()=>i; }
function unscript(){ Math.random=realRandom; T.setSeed(null); }

/* 1:1 전투 무대 — 공격측(접촉 개시자) A vs 방어측 D. 실제 startRounds 를 타서 S.battle 을 연다. */
function arena(){
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,m,7,4); H.place(T,e,6,4);
  H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
  H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  H.place(T,T.S.pieces.filter(x=>x.owner===0&&x.type==="minion")[1],12,7);
  H.place(T,T.S.pieces.filter(x=>x.owner===1&&x.type==="minion")[1],2,1);
  return {m,e};
}
/* 전투를 열고 두 전투원의 신규 스탯을 **전투 시작 전에** 고정한다 (4.4 선턴은 startRounds 에서 한 번 굳으므로
   시작 뒤에 spd·grade 를 바꿔도 그 라운드 순서는 바뀌지 않는다 — 조건은 반드시 시작 전에 심는다). */
function openBattle(opts){
  opts=opts||{};
  const {m,e}=arena();
  const setup=(p,o)=>{ p.hp=o.hp!==undefined?o.hp:100; p.maxHp=o.maxHp!==undefined?o.maxHp:100;
    p.atk=o.atk!==undefined?o.atk:20; p.def=o.def!==undefined?o.def:0; p.spd=o.spd!==undefined?o.spd:10;
    p.dodge=o.dodge!==undefined?o.dodge:0; p.crit=o.crit!==undefined?o.crit:0;
    p.statusPct=o.statusPct!==undefined?o.statusPct:0; p.grade=o.grade!==undefined?o.grade:1;
    p.element=o.element!==undefined?o.element:null; p.shieldStartPct=o.shieldStartPct||0;
    p.vanguardTurn=false; p.shock=0; p.shockFresh=false;
    if(o.skills!==undefined) p.skills=o.skills; };
  setup(m,opts.A||{}); setup(e,opts.D||{});
  T.S.battle=null; T.S.battlesUsed=0; T.TQ.length=0;
  T.startRounds(m,e,m,e); T.TQ.length=0;
  const B=T.S.battle; B.msgQ.length=0;
  return {B,fa:B.fa,fd:B.fd,m,e};
}
/* 라운드 1개를 끝까지 넘긴다 (phase 1 에서 nextPhase 를 부르면 라운드 종료 처리 → 다음 라운드 진입) */
function endRound(B){ B.phase=1; T.nextPhase(); T.TQ.length=0; if(B.msgQ) B.msgQ.length=0; }

/* ===== A. 3.4 등급 성장 — 일반 하수인 ===== */
{
  eq(T.gradeHp(100,1),100,"A1 ⭐1 HP 성장 없음");
  eq(T.gradeHp(100,2),115,"A2 ⭐2 HP ×1.15");
  eq(T.gradeHp(100,3),130,"A3 ⭐3 HP ×1.30");
  eq(T.gradeHp(100,4),145,"A4 ⭐4 HP ×1.45 (GDD 3.4 예: 표준형 ⭐4 = 145)");
  eq(T.gradeAtk(22,1),22,"A5 ⭐1 공격력 성장 없음");
  eq(T.gradeAtk(22,2),24,"A6 ⭐2 공격력 22×1.10=24.2 → 24 (정수 반올림)");
  eq(T.gradeAtk(22,3),26,"A7 ⭐3 공격력 22×1.20=26.4 → 26 (GDD 4.7 예시 기준값)");
  eq(T.gradeAtk(22,4),29,"A8 ⭐4 공격력 22×1.30=28.6 → 29 (GDD 3.4 예: 표준형 ⭐4 = 29)");
  eq(T.gradeHp(95,2),109,"A9 지속형 ⭐2 HP 95×1.15=109.25 → 109 (GDD 4.7 고대 골렘)");
  /* GDD 3.6 의 "일반 ⭐4 대조표" 세 줄을 그대로 맞춘다 — 전설 수치를 넣기 전 기준선이 맞는지 본다 */
  eq(T.gradeHp(95,4),138,"A10 지속형 ⭐4 HP = 138 (GDD 3.6 대조표)");
  eq(T.gradeAtk(20,4),26,"A11 지속형 ⭐4 공격력 = 26 (GDD 3.6 대조표)");
  eq(T.gradeHp(90,4),131,"A12 공격형 ⭐4 HP = 131 (GDD 3.6 대조표)");
  eq(T.gradeAtk(25,4),33,"A13 공격형 ⭐4 공격력 = 33 (GDD 3.6 대조표)");
  /* 등급 없음(null/0/undefined)은 ⭐1 과 같게 취급한다 — 왕·동료·등급 필드 없는 레거시 하수인 */
  eq(T.gradeHp(100,null),100,"A14 등급 없음(null) = 성장 없음");
  eq(T.gradeHp(100,undefined),100,"A15 등급 없음(undefined) = 성장 없음");
  /* "방어력·속도·회피·치명·💫는 등급으로 바뀌지 않는다" (3.4) */
  const f1={},f4={};
  T.applyArchStats(f1,"std",1); T.applyArchStats(f4,"std",4);
  ok(f1.def===f4.def&&f1.spd===f4.spd&&f1.dodge===f4.dodge&&f1.crit===f4.crit&&f1.statusPct===f4.statusPct,
     "A16 등급이 올라도 def·spd·dodge·crit·💫는 그대로 (3.4)");
  eq(f4.grade,4,"A17 applyArchStats 가 등급을 심는다");
}

/* ===== B. 3.3/3.5/3.6 기본 스탯표 ===== */
{
  const AB=T.ARCHETYPE_BASE;
  const want={ // GDD 3.3 표 그대로
    std:    {hp:100,atk:22,def:10,spd:10,dodge:0.05,crit:0.05,statusPct:0},
    atk:    {hp:90, atk:25,def:5, spd:10,dodge:0,   crit:0.10,statusPct:0},
    def:    {hp:120,atk:18,def:20,spd:6, dodge:0,   crit:0,   statusPct:0},
    swift:  {hp:85, atk:24,def:5, spd:14,dodge:0.10,crit:0.05,statusPct:0},
    sustain:{hp:95, atk:20,def:10,spd:8, dodge:0.05,crit:0,   statusPct:0.10},
    guard:  {hp:110,atk:19,def:10,spd:7, dodge:0,   crit:0,   statusPct:0}
  };
  let allOk=true;
  for(const k of Object.keys(want)){ const b=AB[k]; if(!b){allOk=false;break;}
    for(const s of Object.keys(want[k])) if(b[s]!==want[k][s]){ allOk=false; console.error(`  B: ${k}.${s} = ${b[s]} (기대 ${want[k][s]})`); } }
  ok(allOk,"B1 아키타입 6종 기본 스탯표 (GDD 3.3) 전 항목 일치");
  eq(AB.guard.shieldStartPct,0.10,"B2 보호형만 전투 시작 시 최대 HP 10% 방어막 (3.3)");
  ok(["std","atk","def","swift","sustain"].every(k=>!AB[k].shieldStartPct),"B3 보호형 외 아키타입은 시작 방어막 0");
  eq(AB.sustain.statusPct,0.10,"B4 지속형만 💫 +10%p (3.3)");
  /* 3.5 왕·동료 — 등급 없음 */
  const KB=T.KING_BASE, LB=T.ALLY_BASE;
  ok(KB.hp===100&&KB.atk===16&&KB.def===10&&KB.spd===8&&KB.dodge===0&&KB.crit===0&&KB.statusPct===0,"B5 왕 기본 스탯 (GDD 3.5)");
  ok(LB.assassin.hp===100&&LB.assassin.atk===18&&LB.assassin.def===5&&LB.assassin.spd===12&&LB.assassin.dodge===0.10&&LB.assassin.crit===0.10,"B6 동료(암살자) 스탯 (GDD 3.5)");
  ok(LB.shield.hp===100&&LB.shield.atk===14&&LB.shield.def===20&&LB.shield.spd===6&&LB.shield.dodge===0&&LB.shield.crit===0,"B7 동료(방패병) 스탯 (GDD 3.5)");
  const kf={}; T.applyFixedStats(kf,KB);
  eq(kf.grade,null,"B8 왕·동료는 등급이 없다(null) — 4.4 등급 비교를 건너뛰는 근거");
  eq(kf.shieldStartPct,0,"B9 왕·동료는 시작 방어막 없음");
  /* 3.6 전설 — 등급 성장 없음, ⭐5 고정으로 비교 */
  const GB=T.LEGEND_BASE;
  ok(GB.dragon.hp===175&&GB.dragon.atk===35&&GB.dragon.def===15&&GB.dragon.spd===11&&GB.dragon.dodge===0.05&&GB.dragon.crit===0.10,"B10 🐉 용 스탯 (GDD 3.6)");
  ok(GB.witch.hp===165&&GB.witch.atk===32&&GB.witch.def===12&&GB.witch.spd===13&&GB.witch.dodge===0.10&&GB.witch.crit===0.05&&GB.witch.statusPct===0.25,"B11 🕯 마녀 스탯 — 💫 +25%p (GDD 3.6)");
  ok(GB.reaper.hp===158&&GB.reaper.atk===40&&GB.reaper.def===8&&GB.reaper.spd===14&&GB.reaper.dodge===0.15&&GB.reaper.crit===0.20,"B12 💀 사신 스탯 (GDD 3.6)");
  ok(GB.dragon.hp>T.gradeHp(100,4)&&GB.witch.hp>T.gradeHp(95,4)&&GB.reaper.hp>T.gradeHp(90,4),"B13 전설 HP는 같은 아키타입 일반 ⭐4 보다 높다 (GDD 3.6 근거)");
  ok(GB.dragon.atk>T.gradeAtk(22,4)&&GB.witch.atk>T.gradeAtk(20,4)&&GB.reaper.atk>T.gradeAtk(25,4),"B14 전설 공격력은 같은 아키타입 일반 ⭐4 보다 높다");
  const lf={}; T.applyFixedStats(lf,GB.dragon,5);
  eq(lf.grade,5,"B15 전설은 ⭐5 고정 등급으로 비교에 참여 (4.4 [설계 보완])");
  /* #234 전까지 라이브 로스터는 20종 그대로다 — 30종·전설·보호형 종을 이 Issue에서 심지 않는다 */
  /* #234 (GDD-23 6.3)이 병합되며 30종이 됐다 — 이 두 줄은 #233 시점의 "아직 없음" 기록이었으므로 #234 계약으로 바꾼다 */
  eq(T.ROSTER.length,30,"B16 로스터 30종 (#234 GDD-23 6.3)");
  ok(T.ROSTER.filter(r=>r.arch==="guard").length===5&&T.ROSTER.every(r=>T.ARCHETYPE_BASE[r.arch]),"B17 보호형 5종 포함 · 모든 종이 3.3 아키타입 표에 대응 (#234)");
}

/* ===== C. 4.1 5속성 상성 순환 ===== */
{
  const B=T.BEATS;
  ok(B.fire==="grass"&&B.grass==="land"&&B.land==="lightning"&&B.lightning==="water"&&B.water==="fire",
     "C1 이기는 순서 🔥→🌿→🗻→⚡→💧→🔥 (GDD 4.1)");
  eq(Object.keys(B).length,5,"C2 순환은 정확히 5속성 (땅 포함)");
  ok(Object.keys(B).every(k=>B[k]!==k),"C3 자기 자신을 이기는 속성은 없다");
  ok(Object.keys(B).every(k=>B[B[k]]!==k),"C4 서로 이기는 쌍이 없다 (순수 순환)");
  /* 순환 일주: 한 속성에서 5번 따라가면 제자리 */
  let cur="fire"; for(let i=0;i<5;i++) cur=B[cur];
  eq(cur,"fire","C5 5번 따라가면 제자리 — 닫힌 순환");
  eq(T.BAL.advMult,1.3,"C6 유리 ×1.3 (GDD 4.1)");
  eq(T.BAL.disMult,0.75,"C7 불리 ×0.75 (GDD 4.1)");
  /* 땅은 상성표에만 있고 실제 플레이 속성(ELEMS)에는 아직 없다 — 땅 종 추가는 #234 */
  ok(T.ELEMS.indexOf("land")<0,"C8 땅 종은 아직 플레이 로스터에 없다 (#234 범위)");
  ok(T.ELEMS.every(e=>B[e]!==undefined),"C9 플레이 가능한 4속성은 모두 순환표에 있다");
}

/* ===== D. 4.2 피해 계산 순서 ①~⑪ ===== */
{
  /* D1 — GDD 4.7 해 보기 실측 대조.
     새끼 화룡(🔥 표준형 ⭐3, 표준형 시너지 +5%)이 불씨 브레스(💪140%)로 고대 골렘(🗻 지속형 ⭐2)을 친다.
     공격력 22 ×⭐3 1.20 = 26 → 시너지 +5% = 27.3 → ② ×140% = 38.22 → ③ 분산 1.0 → ④ 불 대 땅 = 중립
     → ⑤⑥⑦ 없음 → ⑧ ×(1−0.10) = 34.398 → ⑨ 없음 → ⑩ 반올림 1회 = 34 → ⑪ 방어막 0 이므로 HP −34 */
  const {fa,fd}=openBattle({A:{atk:26,element:"fire",crit:0.05,grade:3},
                            D:{element:"land",def:10,dodge:0.05,hp:109,maxHp:109,grade:2}});
  const base=26*1.05*1.40;
  const n=script([0.9,0.5,0.9]); // ① 회피 실패(0.9 ≥ 0.05) · ③ 분산 0.5 → ×1.0 · ⑦ 치명타 실패(0.9 ≥ 0.05)
  const r=T.resolveHit("A",fa,fd,"D",base,0,"fire",null,0);
  const used=n(); unscript();
  eq(r.dmg,34,"D1 GDD 4.7 예시 — 한 대 때린 피해가 34 (26×1.05×1.40×1.0×0.9 = 34.398 → 34)");
  eq(fd.hp,109-34,"D1b 방어막 0이므로 HP 에 34 그대로 (⑪)");
  eq(used,3,"D1c rand 소비는 ①회피·③분산·⑦치명타 3회");
  eq(Math.round(109*T.BAL.burnPct),5,"D1d 같은 타격의 화상 = 최대 HP 109 × 5% = 5 (GDD 4.7)");
}
{
  /* D2 — ④ 상성 세 갈래가 실제로 곱해진다 */
  const mk=(atkEl,defEl)=>{ const {fa,fd}=openBattle({A:{atk:100,element:atkEl},D:{element:defEl,def:0,dodge:0,hp:9999,maxHp:9999}});
    script([0.9,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,atkEl,null,0); unscript(); return r.dmg; };
  eq(mk("fire","grass"),130,"D2 유리(불→풀) ×1.3");
  eq(mk("grass","fire"),75,"D3 불리(풀 대 불) ×0.75");
  eq(mk("fire","water"),75,"D4 불리(불 대 물) ×0.75 — 물이 불을 이긴다");
  eq(mk("fire","lightning"),100,"D5 중립(불 대 번개) ×1.0");
  eq(mk("lightning","water"),130,"D6 유리(번개→물) ×1.3");
}
{
  /* D3 — ③ 분산 0.8~1.2 의 양 끝과 💪 힘의 수호자 1.2 고정 */
  const lo=(()=>{ const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
    script([0.9,0.0,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0); unscript(); return r.dmg; })();
  const hi=(()=>{ const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
    script([0.9,0.999999,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0); unscript(); return r.dmg; })();
  eq(lo,80,"D7 분산 하한 ×0.8");
  ok(hi===120||hi===119,`D8 분산 상한 ×1.2 [실측 ${hi}]`);
  const pb=(()=>{ const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
    fa.powerBuff=true; script([0.9,0.0,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0); unscript(); return r.dmg; })();
  eq(pb,120,"D9 💪 힘의 수호자면 분산은 난수와 무관하게 1.2 고정 (③)");
}
{
  /* D4 — ⑤ 가하는 피해 증가 상한 +50%, ⑧ 받는 피해 감소 상한 50%, ⑨ 받는 피해 증가 */
  const up=(buff,extra)=>{ const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
    fa.dmgUpBuff=buff; script([0.9,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,extra||0); unscript(); return r.dmg; };
  eq(up(0.2,0),120,"D10 ⑤ 가하는 피해 증가 +20%");
  eq(up(0.9,0),150,"D11 ⑤ 가하는 피해 증가 합계 상한 +50% (0.9 → 0.5)");
  eq(up(0.3,0.3),150,"D12 ⑤ 여러 출처를 **합산한 뒤** 상한 +50% (0.3+0.3=0.6 → 0.5)");
  const down=(def,harden)=>{ const {fa,fd}=openBattle({A:{atk:100},D:{def,dodge:0,hp:9999,maxHp:9999}});
    fd.hardenPct=harden||0; script([0.9,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0); unscript(); return r.dmg; };
  eq(down(10,0),90,"D13 ⑧ 방어력 1 = 받는 피해 1% 감소 (3.2)");
  eq(down(20,0),80,"D14 ⑧ 방어력 20 → −20%");
  eq(down(30,0.15),55,"D15 ⑧ 방어력과 경화를 **합산** (0.30+0.15=0.45)");
  eq(down(80,0),50,"D16 ⑧ 받는 피해 감소 합계 상한 50% (방어력 80 → 50%)");
  eq(down(40,0.40),50,"D17 ⑧ 합산이 상한을 넘어도 50% 에서 멈춘다");
  const take=(crack,vuln)=>{ const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
    if(crack) fd.crack=2; if(vuln) fd.vulnMark=true;
    script([0.9,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0); unscript(); return r.dmg; };
  eq(take(true,false),110,"D18 ⑨ 균열 — 받는 피해 +10% (4.5)");
  eq(take(true,true),125,"D19 ⑨ 균열+결정타 반동을 합산 (+10%+15%)");
}
{
  /* D5 — ⑦ 치명타 ×1.5 와 상한 50% */
  const crit=(c,roll)=>{ const {fa,fd}=openBattle({A:{atk:100,crit:c},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
    script([0.9,0.5,roll]); const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0); unscript(); return r; };
  eq(crit(0.5,0.4).dmg,150,"D20 ⑦ 치명타면 ×1.5");
  ok(crit(0.5,0.4).crit===true,"D21 ⑦ 치명타 여부를 반환한다");
  eq(crit(0.5,0.6).dmg,100,"D22 ⑦ 치명타 실패면 배율 없음");
  eq(crit(0.9,0.6).dmg,100,"D23 ⑦ 치명타 확률 상한 50% — 0.9 여도 0.6 롤은 실패 (상한 없으면 치명타였다)");
  eq(crit(0.9,0.4).dmg,150,"D24 ⑦ 상한 안쪽 롤은 그대로 치명타");
}
{
  /* D6 — ① 회피 상한 40% · 회피하면 그 타격이 끝난다 */
  const dg=(d,roll)=>{ const {fa,fd}=openBattle({A:{atk:100},D:{dodge:d,def:0,hp:9999,maxHp:9999}});
    const n=script([roll,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0); const used=n(); unscript();
    return {r,used,hp:fd.hp}; };
  ok(dg(0.4,0.3).r.evaded===true,"D25 ① 회피 성공");
  eq(dg(0.4,0.3).r.dmg,0,"D26 ① 회피하면 피해 0");
  eq(dg(0.4,0.3).hp,9999,"D27 ① 회피하면 HP 가 줄지 않는다");
  eq(dg(0.4,0.3).used,1,"D28 ① 회피하면 그 타격은 여기서 끝 — rand 를 1회만 쓴다 (분산·치명 판정 없음)");
  ok(dg(0.9,0.5).r.evaded===false,"D29 ① 회피율 상한 40% — 0.9 여도 0.5 롤은 회피 실패 (상한 없으면 회피였다)");
  ok(dg(0.9,0.3).r.evaded===true,"D30 ① 상한 안쪽 롤은 그대로 회피");
  /* 회피 증가 버프는 기본 회피율에 더해지고 같은 상한을 받는다 */
  const ev=(()=>{ const {fa,fd}=openBattle({A:{atk:100},D:{dodge:0.1,def:0,hp:9999,maxHp:9999}});
    fd.evadeBuff=0.2; script([0.25,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0); unscript(); return r; })();
  ok(ev.evaded===true,"D31 ① 회피 증가 버프가 기본 회피율에 %p로 더해진다 (0.1+0.2=0.3 > 0.25)");
}
{
  /* D7 — ⑩ 정수 반올림은 **마지막에 딱 한 번**. 중간 반올림이 있으면 값이 달라지는 사례로 본다. */
  const {fa,fd}=openBattle({A:{atk:100},D:{def:10,dodge:0,hp:9999,maxHp:9999}});
  script([0.9,0.5,0.9]);
  const r=T.resolveHit("A",fa,fd,"D",10.5,0,null,null,0);
  unscript();
  eq(r.dmg,9,"D32 ⑩ 단일 반올림 — 10.5×0.9=9.45 → 9 (② 를 먼저 11 로 반올림했다면 10 이 된다)");
  /* 0보다 크면 최소 1 */
  const tiny=(()=>{ const {fa,fd}=openBattle({A:{atk:1},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
    script([0.9,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",0.01,0,null,null,0); unscript(); return r.dmg; })();
  eq(tiny,1,"D33 ⑩ 0보다 크면 최소 1 (0.01 → 1)");
  const zero=(()=>{ const {fa,fd}=openBattle({A:{atk:0},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
    script([0.9,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",0,0,null,null,0); unscript(); return r.dmg; })();
  eq(zero,0,"D34 ⑩ 0 은 0 그대로 (최소 1 은 '0보다 클 때'만)");
  /* ② 스킬 고정 피해는 위력에 더해진 뒤 같은 파이프라인을 탄다 */
  const flat=(()=>{ const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
    script([0.9,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,20,null,null,0); unscript(); return r.dmg; })();
  eq(flat,120,"D35 ② 스킬 고정 피해가 기본 피해에 더해진다");
}
{
  /* D8 — ④ 드래곤 숨결 고유 배율이 상성표를 대체한다 (4.1 "드래곤 숨결만 전설 항목의 고유 배율") */
  const dm=(mult,defEl)=>{ const {fa,fd}=openBattle({A:{atk:100,element:"fire"},D:{element:defEl,def:0,dodge:0,hp:9999,maxHp:9999}});
    script([0.9,0.5,0.9]); const r=T.resolveHit("A",fa,fd,"D",100,0,"fire",mult,0); unscript(); return r.dmg; };
  eq(dm(2.0,"grass"),200,"D36 ④ 고유 배율이 상성 유리(1.3)를 **대체**한다");
  eq(dm(2.0,"water"),200,"D37 ④ 고유 배율은 불리(0.75)도 대체한다");
}

/* ===== E. 3.2 방어막 층 ===== */
{
  const f={shield:0,shieldLayers:[]};
  T.shieldAdd(f,10,"guardStart"); T.shieldAdd(f,5,"skill");
  eq(f.shield,15,"E1 방어막은 얻을 때마다 **층으로 쌓여 합산**된다 (5.6 방어막만 예외)");
  eq(f.shieldLayers.length,2,"E2 획득원마다 층 1개");
  /* 피해는 가장 나중에 얻은 층부터 (LIFO) */
  let r=T.shieldConsume(f,7);
  eq(r.absorbed,7,"E3 흡수량");
  eq(r.breaks,1,"E4 깨짐 1회 — 나중 층(5)이 0이 되고 남은 2가 아래 층으로 넘어갔다");
  eq(f.shieldLayers.length,1,"E5 0이 된 층은 제거된다");
  eq(f.shieldLayers[0].amt,8,"E6 아래 층은 10−2 = 8 (LIFO 순서)");
  eq(f.shield,8,"E7 표시용 합계도 함께 준다");
  /* 한 타격이 여러 층을 깨면 깨진 층 수만큼 센다 */
  const g={shield:0,shieldLayers:[]};
  T.shieldAdd(g,3,"a"); T.shieldAdd(g,4,"b"); T.shieldAdd(g,5,"c");
  r=T.shieldConsume(g,12);
  eq(r.breaks,3,"E8 한 타격이 세 층을 모두 깼다 → 깨짐 3회 (3.2)");
  eq(r.absorbed,12,"E9 세 층 합계 12를 전부 흡수");
  eq(g.shield,0,"E10 남은 방어막 0");
  /* 넘치는 피해는 흡수량에 포함되지 않는다 */
  const h={shield:0,shieldLayers:[]}; T.shieldAdd(h,5,"a");
  r=T.shieldConsume(h,20);
  eq(r.absorbed,5,"E11 방어막보다 큰 피해는 방어막 몫만 흡수");
  eq(r.breaks,1,"E12 깨짐 1회");
  /* 부분 피해는 깨짐이 아니다 */
  const i2={shield:0,shieldLayers:[]}; T.shieldAdd(i2,10,"a");
  r=T.shieldConsume(i2,4);
  eq(r.breaks,0,"E13 층이 남아 있으면 깨짐 0 (남은 양이 0이 된 순간만 깨짐)");
  eq(i2.shield,6,"E14 남은 방어막 6");
  /* 버프 제거는 모든 층을 한꺼번에 지우며 깨짐이 아니다 */
  const j={shield:0,shieldLayers:[]}; T.shieldAdd(j,7,"a"); T.shieldAdd(j,8,"b");
  const had=T.shieldClearAll(j);
  ok(had===true,"E15 제거 대상이 있었음을 알린다 ('방어막 1개'로 센다)");
  eq(j.shield,0,"E16 제거는 모든 층을 한꺼번에 지운다");
  eq(j.shieldLayers.length,0,"E17 층도 비운다");
  ok(T.shieldClearAll({shield:0,shieldLayers:[]})===false,"E18 지울 방어막이 없으면 false — '방어막 1개'로 세지 않는다");
  /* ⑪ 실제 피해 경로: 방어막이 먼저 막고 남은 피해가 HP 를 깎는다 */
  const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:100,maxHp:100}});
  T.shieldAdd(fd,30,"test");
  script([0.9,0.5,0.9]);
  const hit=T.resolveHit("A",fa,fd,"D",50,0,null,null,0);
  unscript();
  eq(hit.dmg,50,"E19 ⑪ 계산된 피해는 50");
  eq(hit.absorbed,30,"E20 ⑪ 방어막 30 이 먼저 막는다");
  eq(fd.hp,80,"E21 ⑪ 남은 20 만 HP 를 깎는다");
  eq(hit.actual,20,"E22 ⑪ '실제로 HP 에 들어간 피해' = 20 (흡수·회복 계산의 기준)");
  eq(hit.breaks,1,"E23 ⑪ 이 타격으로 층이 0이 되었으므로 깨짐 1");
}

/* ===== F. 4.3 일반 피해가 아닌 피해 + 4.6 연쇄 금지 ===== */
{
  /* F1 반사 — 받은 피해의 X% 에서 시작해 ⑧⑨⑩⑪ 만. 회피·분산·상성·치명타 판정이 없다 (rand 미소비). */
  const {fa,fd}=openBattle({A:{atk:100,element:"fire"},D:{element:"grass",def:10,dodge:0.9,crit:0,hp:9999,maxHp:9999}});
  const n=script([]);
  const r=T.resolveReflect("A",fa,fd,"D",100,0.3);
  const used=n(); unscript();
  eq(r.dmg,27,"F1 반사 — 100×30% = 30 → ⑧ 방어력 10% → 27 (상성 없음)");
  eq(used,0,"F2 반사는 회피·분산·치명타 판정이 없다 — rand 0회 소비");
  /* 상성이 유리했더라도 반사에는 안 붙는다: 불→풀 유리지만 27 그대로 */
  ok(r.dmg===27,"F3 반사는 ④ 상성 판정을 타지 않는다 (유리 1.3 이 붙었다면 35)");
}
{
  /* F4 반격 — ② 공격력 × X% 에서 시작해 ④ 상성 → ⑧⑨⑩⑪. 회피·분산·치명타 없다. */
  const adv=(()=>{ const {fa,fd}=openBattle({A:{atk:100,element:"fire"},D:{element:"grass",def:0,dodge:0.9,hp:9999,maxHp:9999}});
    const n=script([]); const r=T.resolveCounter("A",fa,fd,"D",0.5); const used=n(); unscript(); return {r,used}; })();
  eq(adv.r.dmg,65,"F4 반격 — 공격력 100×50% = 50 → ④ 유리 1.3 → 65");
  eq(adv.used,0,"F5 반격도 rand 를 쓰지 않는다 (회피·분산·치명타 없음)");
  const dis=(()=>{ const {fa,fd}=openBattle({A:{atk:100,element:"grass"},D:{element:"fire",def:0,dodge:0,hp:9999,maxHp:9999}});
    script([]); const r=T.resolveCounter("A",fa,fd,"D",0.5); unscript(); return r.dmg; })();
  eq(dis,38,"F6 반격의 불리 배율 — 50×0.75 = 37.5 → 38 (⑩ 반올림 1회)");
  const def=(()=>{ const {fa,fd}=openBattle({A:{atk:100,element:null},D:{element:null,def:20,dodge:0,hp:9999,maxHp:9999}});
    script([]); const r=T.resolveCounter("A",fa,fd,"D",0.5); unscript(); return r.dmg; })();
  eq(def,40,"F7 반격도 ⑧ 방어력을 탄다 (50 → 40)");
}
{
  /* F8 연쇄 금지 (4.6) — 반사·반격 피해가 다시 반사·반격을 일으키지 않는다. 엔진이 직접 막는다. */
  const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:1000,maxHp:1000}});
  const hpBefore=fd.hp;
  const outer=T.resolveTyped("A",fa,fd,"D",50,false,"바깥","🪞");
  const second=T.resolveTyped("A",fa,fd,"D",50,false,"안쪽","🪞"); // chainLock 이 풀린 뒤이므로 이건 정상 실행
  ok(outer.dmg===50&&second.dmg===50,"F8 연쇄가 아닌 별개 호출 2회는 정상 실행된다 (양성 대조)");
  eq(fd.hp,hpBefore-100,"F9 두 번 모두 HP 에 반영");
  /* 진짜 연쇄: resolveTyped 실행 **중**에 다시 부르면 무효 반환 */
  const B2=T.S.battle; const hp2=fd.hp;
  B2.chainLock=true; // resolveTyped 내부에서 서는 것과 같은 상태
  const nested=T.resolveTyped("A",fa,fd,"D",50,false,"연쇄","🪞");
  B2.chainLock=false;
  ok(nested.blocked===true,"F10 4.6 연쇄 금지 — 실행 중 재진입은 무효 반환");
  eq(nested.dmg,0,"F11 연쇄 차단 시 피해 0");
  eq(fd.hp,hp2,"F12 연쇄 차단 시 HP 변화 0");
}
{
  /* F13 지속 피해 — 방어막을 **무시**하고 HP 에 직행한다 (화상, 4.3) */
  const {B,fd}=openBattle({A:{atk:100},D:{def:20,dodge:0,hp:100,maxHp:100}});
  T.shieldAdd(fd,50,"test");
  fd.burn=1; fd.burnBy="A";
  const shieldBefore=fd.shield;
  endRound(B);
  eq(fd.shield,shieldBefore,"F13 화상은 방어막을 깎지 않는다 (4.3 지속 피해)");
  eq(fd.hp,95,"F14 화상은 최대 HP 5% 를 HP 에 직행시킨다 (방어력·균열·치명타 판정 없음)");
}
{
  /* F15 예고(지연) 피해 — 발동 시점에 일반 피해 ①~⑪ 을 모두 탄다. 전투가 먼저 끝나면 취소된다 (4.6). */
  const {B,fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:500,maxHp:500}});
  let fired=0;
  T.scheduleDelayed(fa,2,()=>{ fired++; script([0.9,0.5,0.9]); T.resolveHit("A",fa,fd,"D",100,0,null,null,0); unscript(); });
  eq(fa.pendingFx.length,1,"F15 예고가 등록된다");
  endRound(B);
  eq(fired,0,"F16 1라운드 뒤에는 아직 발동하지 않는다");
  eq(fa.pendingFx.length,1,"F17 대기 중");
  const hpBefore=fd.hp;
  endRound(B);
  eq(fired,1,"F18 2라운드 뒤 발동");
  eq(fd.hp,hpBefore-100,"F19 발동 시 일반 피해 파이프라인을 그대로 탄다");
  eq(fa.pendingFx.length,0,"F20 발동한 예고는 목록에서 빠진다");
  /* 전투가 끝나면 취소된다 */
  const s2=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:500,maxHp:500}});
  let fired2=0;
  T.scheduleDelayed(s2.fa,1,()=>{ fired2++; });
  T.resetAfter(s2.fa); // 전투 종료 정리 경로
  eq(s2.fa.pendingFx.length,0,"F21 전투가 끝나면 예고·지연 효과는 취소된다 (4.6)");
  T.S.battle=null;
  T.tickDelayed(s2.fa);
  eq(fired2,0,"F22 취소된 예고는 이후에도 발동하지 않는다");
}
{
  /* F23 즉사 — 단계 없이 HP 를 0으로. 방어막을 무시하고, 방어막 제거는 '깨짐'이 아니다. */
  const {fd}=openBattle({A:{atk:100},D:{def:50,dodge:0.9,hp:500,maxHp:500}});
  T.shieldAdd(fd,999,"test");
  T.instaKill(fd);
  eq(fd.hp,0,"F23 즉사는 방어력·회피·방어막과 무관하게 HP 를 0으로 만든다");
  eq(fd.shield,0,"F24 즉사는 방어막을 무시한다");
  eq(fd.shieldLayers.length,0,"F25 층도 남지 않는다 (소멸이지 깨짐이 아니다 — 깨짐 이벤트를 내지 않는다)");
}

/* ===== G. 4.4 선턴 · 후턴 ===== */
{
  const cat=f=>T.fighterOrderCat(f);
  eq(cat({}),1,"G1 순서 효과가 없으면 '기본'");
  eq(cat({vanguardTurn:true}),0,"G2 선턴 효과가 있으면 '선턴'");
  eq(cat({shock:1}),2,"G3 감전 같은 후턴 효과가 있으면 '후턴'");
  eq(cat({vanguardTurn:true,shock:1}),2,"G4 **둘 다 있으면 후턴이 우선** (GDD 4.4 1항)");
  /* 선턴 → 기본 → 후턴 */
  const fs=(A,D)=>T.decideFirstSide({fa:A,fd:D});
  eq(fs({vanguardTurn:true,spd:1},{spd:99}),"A","G5 선턴 효과가 속도보다 먼저 (2항 순서)");
  eq(fs({spd:1},{shock:1,spd:99}),"A","G6 기본 > 후턴 — 감전된 쪽이 뒤로");
  eq(fs({shock:1,spd:99},{spd:1}),"D","G7 감전된 쪽은 속도가 높아도 후턴");
  eq(fs({vanguardTurn:true,spd:1},{vanguardTurn:true,spd:99}),"D","G8 같은 분류끼리는 속도로 가른다 (3항-1)");
  /* 같은 분류 → 속도 → 등급 → 접촉 개시자 */
  eq(fs({spd:14},{spd:10}),"A","G9 속도가 더 높은 쪽이 먼저 (3항-1)");
  eq(fs({spd:6},{spd:10}),"D","G10 느린 쪽이 나중");
  eq(fs({spd:10,grade:2},{spd:10,grade:4}),"A","G11 속도가 같으면 **⭐ 등급이 더 낮은** 쪽이 먼저 (3항-2)");
  eq(fs({spd:10,grade:4},{spd:10,grade:2}),"D","G12 등급이 높은 쪽이 나중");
  eq(fs({spd:10,grade:3},{spd:10,grade:3}),"A","G13 등급도 같으면 **접촉을 먼저 건 쪽**(=A) (3항-3)");
  /* [설계 보완] 등급 비교는 양쪽 모두 ⭐ 등급이 있을 때만 */
  eq(fs({spd:10,grade:null},{spd:10,grade:4}),"A","G14 [설계 보완] 왕·동료(등급 null)가 끼면 등급 단계를 **건너뛰고** 접촉 개시자로 (4.4)");
  eq(fs({spd:10,grade:4},{spd:10,grade:null}),"A","G15 [설계 보완] 반대 배치에서도 등급 단계를 건너뛴다 — 등급 4가 '높아서 지는' 일이 없다");
  eq(fs({spd:10,grade:null},{spd:10,grade:null}),"A","G16 양쪽 모두 등급 없음 → 접촉 개시자");
  eq(fs({spd:10,grade:5},{spd:10,grade:2}),"D","G17 전설은 ⭐5 로 비교에 참여한다 (낮은 2가 먼저)");
}
{
  /* G18 — 라운드 시작 시 확정: 라운드 도중 상태가 바뀌어도 그 라운드의 행동자는 흔들리지 않는다 */
  const {B,fa}=openBattle({A:{spd:10},D:{spd:6}});
  eq(B.firstSide,"A","G18 전투 개시 시 선턴이 확정된다");
  eq(T.actorOfPhase(),"A","G19 phase 0 의 행동자는 선턴");
  /* phase 0 이 끝난 뒤 A 가 감전되더라도 이 라운드의 phase 1 행동자는 바뀌지 않는다 */
  fa.shock=1; fa.shockFresh=true;
  B.phase=1;
  eq(T.actorOfPhase(),"D","G20 phase 1 의 행동자는 후턴 — 라운드 도중 감전이 걸려도 이 라운드 순서는 고정 (Saturn 지적)");
  eq(B.firstSide,"A","G21 라운드 중에는 firstSide 를 다시 계산하지 않는다");
  /* 다음 라운드 진입에서 비로소 새 상태로 다시 확정된다 */
  T.nextPhase(); T.TQ.length=0;
  eq(B.round,2,"G22 라운드 2 진입");
  eq(B.firstSide,"D","G23 새 라운드에서 감전된 A 가 후턴이 된다 (라운드 시작 시 재확정)");
  eq(T.actorOfPhase(),"D","G24 라운드 2 phase 0 행동자는 D");
  /* 한 라운드에 각자 정확히 1회 행동한다 */
  B.phase=0; const p0=T.actorOfPhase();
  B.phase=1; const p1=T.actorOfPhase();
  ok(p0!==p1,"G25 한 라운드에서 두 phase 의 행동자가 서로 다르다 — 양측이 각 1회 행동 (4.4 R 정의)");
}
{
  /* G26 — 속도 차가 실제 전투 개시에도 반영된다 (엔진 계약이 아니라 실제 startRounds 경로) */
  const slow=openBattle({A:{spd:6},D:{spd:14}});
  eq(slow.B.firstSide,"D","G26 실제 전투 개시에서도 빠른 쪽이 선턴 — 접촉을 건 A 가 느리면 D 가 먼저");
  eq(T.actorOfPhase(),"D","G27 첫 행동자도 D");
}

/* ===== H. 4.5 / 5.6 상태이상 · 버프 — 중첩 · 지속 · 소모 ===== */
{
  /* H1 중첩: 같은 종류는 1개만. 수치는 큰 값, 지속은 긴 값. 더하지 않는다. */
  const f={};
  T.applyHarden(f,0.10,1);
  eq(f.hardenPct,0.10,"H1 경화 부여 — 수치");
  eq(f.harden,1,"H2 경화 부여 — 지속");
  T.applyHarden(f,0.25,3);
  eq(f.hardenPct,0.25,"H3 재부여 — 수치는 둘 중 **큰 값** (5.6)");
  eq(f.harden,3,"H4 재부여 — 지속은 둘 중 **긴 값** (합산 아님)");
  T.applyHarden(f,0.05,1);
  eq(f.hardenPct,0.25,"H5 더 약한 재부여는 수치를 낮추지 않는다");
  eq(f.harden,3,"H6 더 짧은 재부여는 지속을 줄이지 않는다");
  /* 방어막만 예외로 합산 (5.6) */
  const g={shield:0,shieldLayers:[]};
  T.shieldAdd(g,10,"a"); T.shieldAdd(g,10,"b");
  eq(g.shield,20,"H7 **방어막만 예외** — 큰 값 갱신이 아니라 층으로 합산 (5.6)");
}
{
  /* H8 지속 — "N 라운드" 는 부여된 라운드를 세지 않고 다음 라운드부터 (5.6 · 4.7) */
  const {B,fd}=openBattle({A:{},D:{}});
  T.applyCrack(fd,2); // 라운드 1에서 부여
  eq(fd.crack,2,"H8 균열 2R 부여");
  ok(fd.crackFresh===true,"H9 부여 라운드는 지속을 세지 않는다 (fresh 가드 — 감전과 같은 방식)");
  endRound(B); // 라운드 1 종료
  eq(fd.crack,2,"H10 **부여 라운드 종료에는 줄지 않는다** (5.6)");
  ok(fd.crackFresh===false,"H11 fresh 가드는 한 번만 쓰인다");
  endRound(B); // 라운드 2 종료
  eq(fd.crack,1,"H12 다음 라운드 종료부터 1씩 줄어든다");
  endRound(B); // 라운드 3 종료
  eq(fd.crack,0,"H13 2R 은 부여 다음 2개 라운드의 종료에 걸쳐 해제된다");
}
{
  /* H14 경화도 같은 지속 규칙을 따르고, 해제 시 수치가 0이 된다 */
  const {B,fd}=openBattle({A:{},D:{}});
  T.applyHarden(fd,0.2,1);
  endRound(B);
  eq(fd.harden,1,"H14 경화 — 부여 라운드 종료에는 줄지 않는다");
  eq(fd.hardenPct,0.2,"H15 경화 수치 유지");
  endRound(B);
  eq(fd.harden,0,"H16 1R 경화는 다음 라운드 종료에 해제");
  eq(fd.hardenPct,0,"H17 해제되면 받는 피해 감소 수치도 0이 된다");
}
{
  /* H18 회피 증가·가하는 피해 증가도 "표기된 값 · 지속" 이다 (4.5) */
  const {B,fd}=openBattle({A:{},D:{}});
  T.applyEvadeBuff(fd,0.15,1);
  T.applyDmgUpBuff(fd,0.20,1);
  eq(fd.evadeBuff,0.15,"H18 회피 증가 수치");
  eq(fd.dmgUpBuff,0.20,"H19 가하는 피해 증가 수치");
  endRound(B);
  eq(fd.evadeBuff,0.15,"H20 부여 라운드 종료에는 유지");
  endRound(B);
  eq(fd.evadeBuff,0,"H21 지속이 끝나면 회피 증가가 사라진다");
  eq(fd.dmgUpBuff,0,"H22 지속이 끝나면 가하는 피해 증가가 사라진다");
}
{
  /* H23 재부여가 "지금 새로 거는 것"과 같은 라운드에 끝난다 (applyTimedFx 의 잔여 정규화) */
  const {B,fd}=openBattle({A:{},D:{}});
  T.applyCrack(fd,2);           // R1 부여 → R2·R3 종료에 소모, R3 종료에 해제
  endRound(B); endRound(B);      // R1·R2 종료 (crack 2 → 2 → 1)
  eq(fd.crack,1,"H23 R2 종료 시점 잔여 1");
  T.applyCrack(fd,2);            // R3 에서 재부여 → 새로 거는 2R 과 같아야 한다
  endRound(B);                   // R3 종료 — fresh 라 줄지 않는다
  eq(fd.crack,2,"H24 재부여도 그 라운드 종료에는 줄지 않는다");
  endRound(B); eq(fd.crack,1,"H25 R4 종료");
  endRound(B); eq(fd.crack,0,"H26 R5 종료에 해제 — '새로 거는 2R' 과 같은 라운드에 끝난다");
}
{
  /* H27 해독제는 **상태이상만** 해제하고 버프(경화·방어막)는 건드리지 않는다 (4.5).
     실제 아이템 경로(__useItemCore 의 'cure')를 탄다. */
  const {B,fa}=openBattle({A:{},D:{}});
  fa.burn=2; fa.burnBy="D"; fa.weaken=2; fa.shock=1; fa.shockFresh=true;
  T.applyCrack(fa,2); T.applyHarden(fa,0.2,2); T.shieldAdd(fa,30,"test");
  T.S.inv[0]=["cure"];
  const useItem=T.__useItemCore;
  ok(typeof useItem==="function","H27 해독제 사용 경로가 있다");
  if(typeof useItem==="function"){ useItem(0); T.TQ.length=0; }
  ok(!fa.burn&&!fa.weaken&&!fa.shock,"H28 해독제는 화상·약화·감전을 해제한다");
  eq(fa.crack,0,"H29 균열도 상태이상 분류라 함께 해제된다 (4.5)");
  ok(fa.crackFresh===false,"H30 해제 시 fresh 가드도 함께 지운다 (다음 부여가 오염되지 않는다)");
  eq(fa.harden,2,"H31 **경화는 버프라 해제하지 않는다** (4.5 '해독제는 상태이상만 해제합니다')");
  eq(fa.hardenPct,0.2,"H32 경화 수치도 남는다");
  eq(fa.shield,30,"H33 방어막도 해제하지 않는다 (버프)");
}
{
  /* H34 약화는 예외로 **횟수제** — 대상이 공격할 때마다 1회 소모 (5.6) */
  const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:9999,maxHp:9999}});
  fa.weaken=2;
  script([0.9,0.5,0.9]);
  const r1=T.resolveHit("A",fa,fd,"D",100,0,null,null,0);
  unscript();
  eq(r1.dmg,80,"H34 약화 — 가하는 피해 −20% (⑥)");
  eq(fa.weaken,1,"H35 공격 1회로 1 소모 (라운드가 아니라 횟수)");
  script([0.9,0.5,0.9]);
  T.resolveHit("A",fa,fd,"D",100,0,null,null,0);
  unscript();
  eq(fa.weaken,0,"H36 2회째 공격으로 소진");
  script([0.9,0.5,0.9]);
  const r3=T.resolveHit("A",fa,fd,"D",100,0,null,null,0);
  unscript();
  eq(r3.dmg,100,"H37 소진 뒤에는 감소가 없다");
  /* 회피당해도 카운터는 소모된다 (자기 상태 소모는 '대상 지정 효과'가 아니다) */
  const s=openBattle({A:{atk:100},D:{def:0,dodge:0.4,hp:9999,maxHp:9999}});
  s.fa.weaken=2;
  script([0.1,0.5,0.9]); // ① 회피 성공
  const ev=T.resolveHit("A",s.fa,s.fd,"D",100,0,null,null,0);
  unscript();
  ok(ev.evaded===true,"H38 회피된 공격");
  eq(s.fa.weaken,1,"H39 회피당해도 약화 횟수는 소모된다");
}

/* ===== I. 4.6 / 5.6 전투 사이에는 HP 만 유지 ===== */
{
  const dirty=f=>{ f.burn=2; f.burnBy="A"; f.weaken=2; f.shock=1; f.shockFresh=true;
    f.crack=2; f.crackFresh=true; f.harden=2; f.hardenFresh=true; f.hardenPct=0.3;
    f.evadeBuff=0.2; f.evadeBuffR=2; f.dmgUpBuff=0.2; f.dmgUpBuffR=2;
    f.critForce=true; f.dodgeForce=true; f.focusCharge=true; f.vulnMark=true; f.dmgCut=0.5;
    f.atkBuff=true; f.powerBuff=true; f.fleeBoost=true; f.absorbed=17;
    T.shieldAdd(f,40,"test"); f.cd=3; if(f.skills) f.cds=[2,3,1,4];
    f.pendingFx=[{roundsLeft:2,run:()=>{}}]; };
  const check=(f,tag)=>{
    ok(!f.burn&&!f.burnBy&&!f.weaken&&!f.shock&&!f.shockFresh,tag+" 상태이상(화상·약화·감전) 초기화");
    ok(!f.crack&&!f.crackFresh&&!f.harden&&!f.hardenFresh&&!f.hardenPct,tag+" 균열·경화 초기화");
    ok(!f.evadeBuff&&!f.evadeBuffR&&!f.dmgUpBuff&&!f.dmgUpBuffR,tag+" 회피 증가·가하는 피해 증가 초기화");
    ok(!f.critForce&&!f.dodgeForce,tag+" 확정 치명·확정 회피 플래그 초기화");
    ok(!f.focusCharge&&!f.vulnMark&&!f.dmgCut&&!f.atkBuff&&!f.powerBuff&&!f.fleeBoost,tag+" 기타 일시 버프 초기화");
    ok(!f.shield&&(!f.shieldLayers||!f.shieldLayers.length),tag+" 방어막·층 초기화 (전투 종료 시 사라진다)");
    ok(!f.absorbed,tag+" 유효 피해 흡수 누계 초기화");
    ok(f.cd===0,tag+" **레거시 스칼라 쿨** 0 — 모든 전투는 ⌛0 으로 시작 (5.6)");
    ok(!f.skills||f.cds.every(c=>c===0),tag+" 슬롯별 쿨 4칸 모두 0");
    ok(!f.pendingFx||!f.pendingFx.length,tag+" 예고·지연 효과 취소 (4.6)");
  };
  /* 전투 종료 경로 */
  const a=openBattle({A:{hp:77,maxHp:100},D:{}});
  dirty(a.fa); const hpKept=a.fa.hp;
  T.resetAfter(a.fa);
  check(a.fa,"I1 전투 종료(resetAfter):");
  eq(a.fa.hp,hpKept,"I2 **HP 는 유지된다** — 전투를 넘어 유지되는 전투 상태는 HP 뿐 (5.6)");
  /* 전투 시작 경로 */
  const b=openBattle({A:{hp:55,maxHp:100},D:{}});
  dirty(b.fa); const hpKept2=b.fa.hp;
  T.resetBattleTemps(b.fa);
  check(b.fa,"I3 전투 시작(resetBattleTemps):");
  eq(b.fa.hp,hpKept2,"I4 전투 시작 초기화도 HP 를 건드리지 않는다");
}
{
  /* I5 — 실제 전투 개시 경로에서 쿨이 0 으로 시작한다 (startRounds 를 다시 연다) */
  const {m,e}=arena();
  m.cds=[2,2,2,2]; m.cd=3; e.cds=[1,1,1,1]; e.cd=2;
  m.hp=64; m.maxHp=100;
  T.S.battle=null; T.S.battlesUsed=0; T.TQ.length=0;
  T.startRounds(m,e,m,e); T.TQ.length=0;
  ok(!m.skills||m.cds.every(c=>c===0),"I5 새 전투는 모든 슬롯 쿨 0 으로 시작 (5.6)");
  eq(m.cd,0,"I6 레거시 스칼라 쿨도 0");
  eq(m.hp,64,"I7 직전 전투의 HP 는 그대로 이어받는다");
}
{
  /* I8 — 보호형 기본값: 전투 시작 시 최대 HP 10% 방어막 (3.3) */
  const f={maxHp:200,shield:0,shieldLayers:[],shieldStartPct:0.10,skills:null};
  T.resetBattleTemps(f);
  eq(f.shield,20,"I8 보호형은 전투 시작 시 최대 HP 10% 방어막을 얻는다 (3.3)");
  eq(f.shieldLayers.length,1,"I9 시작 방어막도 층 1개로 쌓인다");
  const g={maxHp:200,shield:0,shieldLayers:[],shieldStartPct:0,skills:null};
  T.resetBattleTemps(g);
  eq(g.shield,0,"I10 보호형이 아니면 시작 방어막 없음");
}

/* ===== J. 3.2 💫 상태이상 부여 확률 ===== */
{
  /* gate() 는 execSlot 안의 지역 함수라 **실제 전투 경로**로 확인한다.
     지속형(💫 +10%p)과 표준형(0%p)이 같은 롤에서 갈리는 경계값을 본다. */
  const trial=(statusPct,roll)=>{
    const {fa,fd}=openBattle({A:{atk:20,element:"fire",statusPct,skills:["fire_stable","fire_effect","sup_heal","sig_std"]},
                              D:{element:"lightning",def:0,dodge:0,hp:9999,maxHp:9999}});
    fa.cds=[0,0,0,0]; fd.burn=0;
    // 공격 ①회피 ③분산 ⑦치명 뒤 상태 판정 rand 가 온다
    script([0.9,0.5,0.9,roll]);
    T.execSlot("A",1,{}); // 잔불 표식(fire_effect) — 화상 부여 시도
    unscript(); T.TQ.length=0;
    return fd.burn>0;
  };
  const p=T.BAL.statusProb; // 0.7
  ok(trial(0,p-0.05)===true,`J1 표준형(💫 0%p) — 기본 확률 ${p} 안쪽 롤은 부여 성공`);
  ok(trial(0,p+0.05)===false,"J2 표준형 — 기본 확률 밖 롤은 실패");
  ok(trial(0.10,p+0.05)===true,"J3 지속형(💫 +10%p) — 같은 롤이 **%p 가산**으로 성공한다 (3.2)");
  ok(trial(0.10,p+0.15)===false,"J4 가산해도 그 밖의 롤은 실패 — 무조건 성공이 아니다");
  ok(trial(0.20,0.95)===false,"J5 💫 가산 합계가 100% 미만(0.7+0.2=0.9)이면 그 밖의 롤은 여전히 실패");
  ok(trial(0.20,0.85)===true,"J6 같은 💫 에서 확률 안쪽 롤은 성공 (0.85 < 0.9)");
  ok(trial(0.30,0.999999)===true,"J7 💫 합계가 100% 에 닿으면(0.7+0.3) 어느 롤이든 성공 — 상한 100% (3.2)");
  ok(trial(0.90,0.999999)===true,"J8 💫 가 더 커도 상한 100% 를 넘지 않고 똑같이 동작한다 (0.7+0.9 → 1.0)");
  /* 구형 속성 스킬 경로(로스터 미적용 하수인 — f.skills 가 null) 에도 **같은 💫 가산**이 걸린다.
     이 경로는 execSlot 이 아니라 __actCore('skill') 의 별도 tryStatus 를 쓰므로 따로 본다
     (한쪽만 고치면 다른 쪽이 조용히 옛 규칙으로 남는다). 지속형은 100% 고정이라 표준형으로 본다. */
  const legacyTrial=(statusPct,roll)=>{
    const {m,e}=arena();
    m.hp=100; m.maxHp=100; m.atk=20; m.skillAtk=35; m.cd=0; m.cdMax=2; m.skills=null; m.cds=[0,0,0,0];
    m.revealedSkills=null; m.element="fire"; m.rosterId=null; m.name=null;
    m.def=0; m.spd=10; m.dodge=0; m.crit=0; m.grade=1; m.statusPct=statusPct; m.shieldStartPct=0;
    e.hp=9999; e.maxHp=9999; e.atk=20; e.element="lightning"; e.def=0; e.spd=10; e.dodge=0; e.crit=0;
    e.grade=1; e.statusPct=0; e.shieldStartPct=0; e.burn=0;
    T.S.battle=null; T.S.battlesUsed=0; T.TQ.length=0;
    T.startRounds(m,e,m,e); T.TQ.length=0;
    const B=T.S.battle; B.fd.burn=0; B.msgQ.length=0;
    script([0.9,0.5,0.9,roll]);
    T.__actCore("skill");
    unscript(); T.TQ.length=0;
    return B.fd.burn>0;
  };
  ok(legacyTrial(0,p-0.05)===true,"J9 구형 속성 스킬 경로 — 기본 확률 안쪽 롤은 성공 (양성 대조)");
  ok(legacyTrial(0,p+0.05)===false,"J10 구형 경로 — 💫 0%p 면 기본 확률 밖 롤은 실패");
  ok(legacyTrial(0.10,p+0.05)===true,"J11 구형 경로도 💫 를 %p 로 가산한다 (3.2) — 두 gate 구현이 같은 규칙을 따른다");
  ok(legacyTrial(0.10,p+0.15)===false,"J12 구형 경로도 가산 밖의 롤은 실패 — 무조건 성공이 아니다");
}

/* ===== K. 3.2 확정 회피 · 확정 치명 ===== */
{
  /* "확정 효과는 확률 판정을 건너뛰므로 상한보다 우선합니다 (확정 효과는 다음 피해 스킬 1회에 소모)" */
  const {fa,fd}=openBattle({A:{atk:100,crit:0},D:{dodge:0,def:0,hp:9999,maxHp:9999}});
  fa.critForce=true;
  const n=script([0.9,0.5]); // ⑦ 치명 판정용 난수를 **주지 않는다** — 소비하면 개수 단언이 어긋나 검출된다
  const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0);
  const used=n(); unscript();
  ok(r.crit===true,"K1 확정 치명 — 치명타 확률 0% 여도 치명타 (상한·확률 판정보다 우선)");
  eq(r.dmg,150,"K2 확정 치명도 ×1.5");
  eq(used,2,"K3 확정 치명은 rand 를 소비하지 않는다 (①회피·③분산 2회만)");
  ok(fa.critForce===false,"K4 확정 치명은 **1회 소모**된다");
  /* 다음 공격에는 적용되지 않는다 */
  script([0.9,0.5,0.9]);
  const r2=T.resolveHit("A",fa,fd,"D",100,0,null,null,0);
  unscript();
  ok(r2.crit===false,"K5 소모 뒤 다음 공격은 평소 확률로 돌아간다");
  eq(r2.dmg,100,"K6 소모 뒤에는 ×1.5 가 붙지 않는다");
}
{
  const {fa,fd}=openBattle({A:{atk:100},D:{dodge:0,def:0,hp:9999,maxHp:9999}});
  fd.dodgeForce=true;
  const n=script([]); // 회피 판정 난수를 주지 않는다
  const r=T.resolveHit("A",fa,fd,"D",100,0,null,null,0);
  const used=n(); unscript();
  ok(r.evaded===true,"K7 확정 회피 — 회피율 0% 여도 회피 (상한·확률 판정보다 우선)");
  eq(used,0,"K8 확정 회피는 rand 를 소비하지 않는다");
  ok(fd.dodgeForce===false,"K9 확정 회피는 1회 소모된다");
  eq(fd.hp,9999,"K10 확정 회피한 타격은 HP 를 깎지 않는다");
  script([0.9,0.5,0.9]);
  const r2=T.resolveHit("A",fa,fd,"D",100,0,null,null,0);
  unscript();
  ok(r2.evaded===false,"K11 소모 뒤 다음 공격은 평소 회피율로 돌아간다");
}

/* ===== L. 현행 보존 — 유효 피해 흡수 상한 · 승패 동률 ===== */
{
  /* 4.2 "전투 판정용 유효 피해 집계(현행 방어막 흡수 상한 규칙)는 바뀌지 않습니다" */
  const {fa,fd}=openBattle({A:{atk:100},D:{def:0,dodge:0,hp:1000,maxHp:100}});
  const cap=Math.round(100*T.BAL.absorbCapPct); // 30
  T.shieldAdd(fd,1000,"test");
  script([0.9,0.5,0.9]);
  const r1=T.resolveHit("A",fa,fd,"D",20,0,null,null,0);
  unscript();
  eq(r1.absorbed,20,"L1 방어막이 전부 흡수");
  eq(r1.counted,0,"L2 상한 안쪽 흡수는 유효 피해로 세지 않는다 (현행 규칙)");
  eq(fd.absorbed,20,"L3 흡수 누계 20");
  script([0.9,0.5,0.9]);
  const r2=T.resolveHit("A",fa,fd,"D",20,0,null,null,0);
  unscript();
  eq(fd.absorbed,cap,`L4 흡수 누계는 최대 HP ${T.BAL.absorbCapPct*100}% 상한(${cap})에서 멈춘다`);
  eq(r2.counted,10,"L5 상한을 넘은 흡수분(20 중 10)은 유효 피해로 집계된다 — 현행 규칙 보존");
}
{
  /* 4.4 "승패 판정은 현행 그대로 — HP 비율로도 갈리지 않으면 **접촉을 받은 쪽이 승리**" */
  openBattle({A:{hp:50,maxHp:100},D:{hp:50,maxHp:100}});
  const beforeD=T.S.metrics.defenderWins, beforeT=T.S.metrics.ties;
  T.TQ.length=0; T.judge(); T.TQ.length=0;
  ok(!T.S.battle,"L6 판정으로 전투가 끝난다");
  eq(T.S.metrics.defenderWins,beforeD+1,"L7 HP 비율 동률이면 **접촉을 받은 쪽(D)** 승 — 현행 유지 (4.4)");
  eq(T.S.metrics.ties,beforeT+1,"L8 동률 지표가 기록된다");
}
{
  openBattle({A:{hp:80,maxHp:100},D:{hp:50,maxHp:100}});
  const before=T.S.metrics.attackerWins;
  T.TQ.length=0; T.judge(); T.TQ.length=0;
  eq(T.S.metrics.attackerWins,before+1,"L9 HP 비율이 높은 쪽이 이긴다 (동률이 아닐 때)");
}

/* ===== M. 4.7·5.6 화상 지속 — 부여 라운드를 세지 않는다 (2026-09-16 PD 결정) ===== */
{
  /* GDD 4.7: "화상은 부여된 라운드를 세지 않으므로 **다음 2개 라운드의 종료 시에 각 5**".
     감전·균열·경화와 달리 화상은 라운드 종료에 **피해도** 주므로, 가드가 부여 라운드의
     피해와 감소를 **둘 다** 건너뛰어야 한다 (감소에만 걸면 R1·R2·R3 3회가 되어 총량이 늘어난다). */
  const {B,fd}=openBattle({A:{},D:{hp:109,maxHp:109}});
  fd.burn=T.BAL.burnRounds; fd.burnFresh=true; fd.burnBy="A"; // 라운드 1에서 부여된 상태
  const tick=Math.round(109*T.BAL.burnPct);
  eq(tick,5,"M1 최대 HP 109 의 화상 1회 피해 = 5 (GDD 4.7)");
  endRound(B); // R1 종료
  eq(fd.hp,109,"M2 **부여 라운드(R1) 종료에는 피해가 없다** (4.7)");
  eq(fd.burn,T.BAL.burnRounds,"M3 부여 라운드 종료에는 지속도 줄지 않는다");
  ok(fd.burnFresh===false,"M4 가드는 한 번만 쓰인다");
  endRound(B); // R2 종료
  eq(fd.hp,109-tick,"M5 다음 라운드(R2) 종료에 첫 피해 5");
  eq(fd.burn,T.BAL.burnRounds-1,"M6 R2 종료에 지속 1 소모");
  endRound(B); // R3 종료
  eq(fd.hp,109-tick*2,"M7 그다음 라운드(R3) 종료에 두 번째 피해 5 — **다음 2개 라운드에 각 5** (4.7)");
  eq(fd.burn,0,"M8 2R 화상은 R3 종료에 해제된다");
  endRound(B); // R4 종료 — 더 이상 피해 없음
  eq(fd.hp,109-tick*2,"M9 해제 뒤에는 더 이상 피해가 없다 — 총 2회로 끝난다 (3회가 되면 총량이 늘어난 것)");
}
{
  /* M10 — 실제 부여 경로(execSlot 의 화상)가 가드를 세운다. 필드를 직접 심은 위 절과 달리 제품 코드가 세우는지 본다. */
  const {fa,fd}=openBattle({A:{atk:20,element:"fire",statusPct:1.0,skills:["fire_stable","fire_effect","sup_heal","sig_std"]},
                            D:{element:"lightning",def:0,dodge:0,hp:200,maxHp:200}});
  fa.cds=[0,0,0,0]; fd.burn=0; fd.burnFresh=false;
  script([0.9,0.5,0.9,0.01]);
  T.execSlot("A",1,{}); // 잔불 표식 — 화상 부여
  unscript(); T.TQ.length=0;
  ok(fd.burn>0,"M10 실제 기술 경로로 화상이 걸린다");
  ok(fd.burnFresh===true,"M11 **실제 부여 경로가 부여 라운드 제외 가드를 세운다** (필드만 있는 게 아니다)");
}
{
  /* M12 — 재부여 시 가드를 다시 세운다 (감전 현행과 같은 방식 — Jupiter 에 전달한 계약) */
  const {B,fd}=openBattle({A:{},D:{hp:200,maxHp:200}});
  fd.burn=1; fd.burnFresh=true; fd.burnBy="A";
  endRound(B); endRound(B); // R1 제외 → R2 종료에 피해·해제
  eq(fd.burn,0,"M12 1R 화상은 다음 라운드 종료 1회로 끝난다");
  const hpAfter=fd.hp;
  fd.burn=2; fd.burnFresh=true; fd.burnBy="A"; // 재부여
  endRound(B);
  eq(fd.hp,hpAfter,"M13 재부여도 그 라운드 종료에는 피해가 없다 (가드 재설정)");
  eq(fd.burn,2,"M14 재부여 라운드에는 지속도 줄지 않는다");
}
{
  /* M15 — 해제 경로가 가드까지 지운다 (다음 부여가 오염되지 않는다) */
  const {fa}=openBattle({A:{},D:{}});
  fa.burn=2; fa.burnFresh=true; fa.burnBy="D";
  T.S.inv[0]=["cure"];
  if(typeof T.__useItemCore==="function"){ T.__useItemCore(0); T.TQ.length=0; }
  eq(fa.burn,0,"M15 해독제가 화상을 해제한다");
  ok(fa.burnFresh===false,"M16 해제 시 부여 라운드 가드도 함께 지운다");
  /* 전투 사이 초기화에서도 마찬가지 */
  const {fd}=openBattle({A:{},D:{}});
  fd.burn=2; fd.burnFresh=true;
  T.resetAfter(fd);
  ok(!fd.burn&&fd.burnFresh===false,"M17 전투 종료 초기화가 화상과 가드를 함께 지운다");
}

/* ===== N. 서버·공개 방 경계 계약 (GDD-23 4.4 · 7.9) ===== */
{
  /* 공개 방 전투 화면은 선턴을 **다시 계산하지 않고** 서버가 보낸 actor 에서 복원한다.
     decideFirstSide 가 읽는 spd·grade·vanguardTurn 은 상대 전투 뷰에 없고(7.9 등급은 소유자 전용)
     앞으로도 보내지 않는다 — 그대로 두면 spd 0·0 / grade null 로 떨어져 **항상 A** 가 되어
     battleModal 이 틀린 패널·행동 메뉴를 그린다. */
  ok(typeof T.netSynthBattle==="function","N1 netSynthBattle 경로가 있다");
  const mkSide=o=>Object.assign({owner:0,hp:80,maxHp:100,shield:0,burn:0,weaken:0,shock:0,shockFresh:false,
    dmgCut:0,focusCharge:false,vulnMark:false,skills:null,rec:0,items:0,itemRound:false,lastItem:null,
    ballThrow:false,buff:null,type:"king",element:null,bodyFight:true,rosterId:null,artRosterId:null},o||{});
  const mkBd=o=>Object.assign({battleId:1,round:1,phase:0,actor:"A",actSeq:0,maxRounds:null,log:[],
    a:mkSide({owner:0}),d:mkSide({owner:1})},o||{});
  const you={pieces:[]};
  /* phase 0 — 지금 행동하는 쪽이 곧 선턴 */
  let B=T.netSynthBattle(mkBd({phase:0,actor:"A"}),you);
  eq(B.firstSide,"A","N2 phase 0 에서 actor A → 선턴 A");
  B=T.netSynthBattle(mkBd({phase:0,actor:"D"}),you);
  eq(B.firstSide,"D","N3 phase 0 에서 actor D → 선턴 D (재계산이면 항상 A 가 나왔다)");
  /* phase 1 — 지금 행동하는 쪽은 후턴이므로 선턴은 반대쪽 */
  B=T.netSynthBattle(mkBd({phase:1,actor:"D"}),you);
  eq(B.firstSide,"A","N4 phase 1 에서 actor D → 선턴은 반대쪽 A");
  B=T.netSynthBattle(mkBd({phase:1,actor:"A"}),you);
  eq(B.firstSide,"D","N5 phase 1 에서 actor A → 선턴은 반대쪽 D");
  /* 복원된 선턴으로 actorOfPhase 가 서버 actor 와 **정확히 일치**한다 (표시 계층의 핵심 불변식) */
  const cases=[["A",0],["D",0],["A",1],["D",1]];
  let agree=true;
  for(const [actor,phase] of cases){
    const b=T.netSynthBattle(mkBd({phase,actor}),you);
    const live=T.S.battle; T.S.battle=b;
    try{ if(T.actorOfPhase()!==actor) agree=false; } finally{ T.S.battle=live; }
  }
  ok(agree,"N6 복원된 선턴으로 actorOfPhase() 가 서버 actor 와 네 조합 모두 일치 — 틀린 패널·행동 메뉴가 나오지 않는다");
  /* 상대의 비공개 스탯을 쓰지 않는다: spd·grade 가 스냅샷에 없어도(=undefined) 위 일치가 성립했다 */
  const probe=T.netSynthBattle(mkBd({phase:1,actor:"D"}),you);
  ok(probe.fa.spd===undefined||probe.fa.spd===0||probe.fa.grade===null||probe.fa.grade===undefined,
     "N7 공개 스냅샷에는 상대 spd·grade 가 없다 (7.9 비공개 원칙) — 그래도 N4 가 성립한다");
}
{
  /* pendingFx 는 서버 락스텝 요약이 콜백 대신 [roundsLeft, tag] 로 읽는다 (Jupiter 계약).
     tag 가 없으면 같은 라운드에 예약된 서로 다른 예고 피해 둘을 구분하지 못해 두 좌석이 갈려도 VOID 가 안 뜬다. */
  const f={pendingFx:[]};
  T.scheduleDelayed(f,2,()=>{},"tide_warning");
  eq(f.pendingFx.length,1,"N8 예고가 등록된다");
  eq(f.pendingFx[0].roundsLeft,2,"N9 roundsLeft 보존");
  eq(f.pendingFx[0].tag,"tide_warning","N10 **안정된 tag 문자열을 함께 저장한다** (서버 요약 식별자)");
  ok(typeof f.pendingFx[0].run==="function","N11 실행 콜백도 그대로 보존");
  /* tag 를 넘기지 않는 구형 호출은 null 로 떨어져 깨지지 않는다 (서버 역호환 계약) */
  const g={pendingFx:[]};
  T.scheduleDelayed(g,1,()=>{});
  eq(g.pendingFx[0].tag,null,"N12 tag 없는 호출은 null — 서버 요약이 방어적으로 읽어도 깨지지 않는다");
  /* 같은 라운드에 예약된 서로 다른 예고를 요약이 구분할 수 있다 */
  const h={pendingFx:[]};
  T.scheduleDelayed(h,2,()=>{},"a"); T.scheduleDelayed(h,2,()=>{},"b");
  const digest=h.pendingFx.map(e=>[e.roundsLeft,e.tag||null]);
  ok(JSON.stringify(digest)==='[[2,"a"],[2,"b"]]',"N13 같은 라운드 예고 둘이 요약에서 구분된다 — tag 가 없으면 [[2,null],[2,null]] 로 뭉개진다");
}

/* ===== O. 실제 스킬 경로 — 단일 반올림 · 재부여 갱신 (PD diff 검토 2건) =====
   공용 헬퍼(resolveHit·applyTimedFx)만 통과하는 것으로는 AC 를 대신할 수 없다. 이 절은 **실제 execSlot 경로**로
   소수 배율을 흘려 넣어 ⑩ 반올림이 정말 한 번뿐인지, 그리고 이미 걸린 상태를 실제 기술이 갱신하는지를 본다. */
{
  /* O1 — 기술 위력 스케일(sk.pow × atk ÷ 22)이 **소수**일 때 중간 반올림이 없어야 한다.
     화염탄(pow 26) · 공격력 20 → 26×20÷22 = 23.6363… (정수가 아니다)
       · 올바름(단일 반올림): 23.6363… × 0.9(방어력 10) = 21.2727… → **21**
       · 틀림(이중 반올림):   round(23.6363…)=24 → 24 × 0.9 = 21.6 → 22
     두 값이 갈리므로 이 한 건이 이중 반올림을 검출한다. */
  const powOf=T.SKILLS["fire_stable"].pow;
  eq(powOf,26,"O1 전제: 화염탄 표기 위력 26");
  const {fa,fd}=openBattle({A:{atk:20,element:"fire",crit:0,skills:["fire_stable","fire_effect","sup_heal","sig_std"]},
                            D:{element:null,def:10,dodge:0,hp:9999,maxHp:9999}});
  fa.cds=[0,0,0,0];
  const before=fd.hp;
  script([0.9,0.5,0.9]); // ①회피 실패 ③분산 1.0 ⑦치명 실패
  T.execSlot("A",0,{});  // 화염탄 — 실제 스킬 경로
  unscript(); T.TQ.length=0;
  const dealt=before-fd.hp;
  eq(dealt,21,"O2 **실제 스킬 경로도 ⑩ 반올림 1회** — 26×20÷22×0.9 = 21.27 → 21 (중간 반올림이 있으면 22)");
  /* 표시용 slotPow 는 정수로 남는다 — 사람이 읽는 라벨·AI 추정은 그대로다 */
  ok(typeof T.slotPow==="function"&&T.slotPow({atk:20},{pow:26})===24,
     "O3 표시용 slotPow 는 여전히 정수 24 (라벨·휴리스틱용) — 피해 경로만 소수를 쓴다");
}
{
  /* O4 — 실제 기술로 남은 1R 화상을 재부여하면 2R 로 **갱신**된다 (GDD 5.6).
     종전에는 applyStatus 가 !opp.burn 으로 재부여 자체를 막아 이 경로가 통째로 죽어 있었다. */
  const {B,fa,fd}=openBattle({A:{atk:20,element:"fire",statusPct:1.0,crit:0,
                                 skills:["fire_stable","fire_effect","sup_heal","sig_std"]},
                              D:{element:null,def:0,dodge:0,hp:9999,maxHp:9999}});
  fa.cds=[0,0,0,0]; fd.burn=0; fd.burnFresh=false;
  script([0.9,0.5,0.9,0.01]);
  T.execSlot("A",1,{}); // 잔불 표식 — 화상 부여
  unscript(); T.TQ.length=0;
  eq(fd.burn,T.BAL.burnRounds,"O4 실제 기술로 화상 2R 부여");
  ok(fd.burnFresh===true,"O5 부여 라운드 제외 가드가 섰다");
  endRound(B); endRound(B); // R1 제외 → R2 종료에 1 소모
  eq(fd.burn,T.BAL.burnRounds-1,"O6 남은 지속 1R");
  /* 남은 1R 에 같은 기술을 다시 맞힌다 */
  fa.cds=[0,0,0,0];
  script([0.9,0.5,0.9,0.01]);
  T.execSlot("A",1,{});
  unscript(); T.TQ.length=0;
  eq(fd.burn,T.BAL.burnRounds,"O7 **이미 걸린 화상도 재부여로 2R 로 갱신된다** (5.6 — 종전 !opp.burn 가드는 이 경로를 통째로 막았다)");
  ok(fd.burnFresh===true,"O8 재부여도 그 라운드를 세지 않는다 (가드 재설정)");
  /* 더하지 않는다 — 2R + 2R 이 4R 이 되면 안 된다 */
  fa.cds=[0,0,0,0];
  script([0.9,0.5,0.9,0.01]);
  T.execSlot("A",1,{});
  unscript(); T.TQ.length=0;
  eq(fd.burn,T.BAL.burnRounds,"O9 재부여는 **합산이 아니다** — 2R 을 넘지 않는다 (5.6 '더하지 않는다')");
}
{
  /* O10 — 약화는 횟수제라 큰 횟수로 갱신된다 (5.6 예외) */
  const {fa,fd}=openBattle({A:{atk:20,element:"water",statusPct:1.0,crit:0,
                               skills:["water_stable","water_effect","sup_heal","sig_std"],},
                            D:{element:null,def:0,dodge:0,hp:9999,maxHp:9999}});
  fa.cds=[0,0,0,0]; fd.weaken=1;
  script([0.9,0.5,0.9,0.01]);
  T.execSlot("A",1,{});
  unscript(); T.TQ.length=0;
  eq(fd.weaken,T.BAL.weakenHits,"O10 남은 1회 약화가 실제 기술 재부여로 2회로 갱신된다 (5.6 횟수제)");
  fa.cds=[0,0,0,0]; fd.weaken=5; // 이미 더 긴 쪽이 걸려 있으면 낮추지 않는다
  script([0.9,0.5,0.9,0.01]);
  T.execSlot("A",1,{});
  unscript(); T.TQ.length=0;
  eq(fd.weaken,5,"O11 더 긴 쪽이 걸려 있으면 재부여가 지속을 **낮추지 않는다** (둘 중 긴 값)");
}
{
  /* O12 — 감전도 같은 규칙. 이미 걸려 있어도 재부여가 막히지 않는다. */
  const {fa,fd}=openBattle({A:{atk:20,element:"lightning",statusPct:1.0,crit:0,
                               skills:["lightning_stable","lightning_effect","sup_heal","sig_std"]},
                            D:{element:null,def:0,dodge:0,hp:9999,maxHp:9999}});
  fa.cds=[0,0,0,0]; fd.shock=1; fd.shockFresh=false;
  script([0.9,0.5,0.9,0.01]);
  T.execSlot("A",1,{});
  unscript(); T.TQ.length=0;
  eq(fd.shock,1,"O12 감전 재부여 — 1R 유지 (합산 아님)");
  ok(fd.shockFresh===true,"O13 감전 재부여도 부여 라운드 제외 가드를 다시 세운다");
}

/* ===== P. 4.5 상태이상 분류 — '상태이상 대상' 추가 위력에 균열이 포함된다 (Saturn 지적) =====
   연쇄 번개(bonusVsStatus 6)는 "대상이 상태이상일 때 +6". GDD 4.5 사전에서 균열은 **상태이상**이고
   경화·흡수·방어막은 **버프**다. 종전 조건은 burn/weaken/shock 만 보아 새 상태이상인 균열을 빠뜨렸다.
   균열 자신의 "받는 피해 +10%"(⑨)와 이 "+6 고정 추가 위력"(②)은 **서로 다른 단계**이므로 나눠서 본다. */
{
  const sk=T.SKILLS["lightning_heavy"];
  eq(sk.bonusVsStatus,6,"P1 전제: 연쇄 번개는 상태이상 대상 +6");
  eq(sk.pow,34,"P2 전제: 표기 위력 34");
  /* 공격력 22 → 위력 스케일 34×22÷22 = 34.0 (소수 없음 — 이 절은 반올림이 아니라 단계 구분을 본다).
     상성: 번개 vs 무속성 대상 = 중립. 방어력 0. 분산 1.0. 치명 없음. */
  const run=(setup)=>{
    const {fa,fd}=openBattle({A:{atk:22,element:"lightning",crit:0,
                                 skills:["lightning_stable","lightning_heavy","sup_focus","sig_atk"]},
                              D:{element:null,def:0,dodge:0,hp:9999,maxHp:9999}});
    fa.cds=[0,0,0,0];
    if(setup) setup(fd);
    const before=fd.hp;
    script([0.9,0.5,0.9]);
    T.execSlot("A",1,{});
    unscript(); T.TQ.length=0;
    return before-fd.hp;
  };
  const plain=run(null);
  eq(plain,34,"P3 기준선 — 상태이상이 없으면 34 (추가 위력 없음)");
  /* 화상: ② 에 +6 만 붙는다 (화상은 받는 피해를 늘리지 않는다) → 40 */
  eq(run(f=>{f.burn=2;}),40,"P4 화상 대상 — ② 에 +6 → 40 (기존 동작)");
  /* 균열: ② 에 +6 **그리고** ⑨ 받는 피해 +10% → (34+6)×1.1 = 44 */
  eq(run(f=>{f.crack=2;}),44,"P5 **균열도 상태이상** — ② +6 과 ⑨ +10% 가 함께 붙어 (34+6)×1.1 = 44 (종전에는 균열 누락으로 34×1.1 = 37)");
  /* 두 단계를 분리해 확인: 균열의 +10% 만 있고 +6 이 없으면 37.4 → 37 이었을 것 */
  ok(run(f=>{f.crack=2;})!==37,"P6 균열이 ⑨ 에만 반영되고 ② 추가 위력에서 빠지는 옛 동작(37)이 아니다");
  /* 경화는 **버프**라 '상태이상 대상' 추가 위력을 켜지 않는다. 받는 피해만 줄인다.
     경화 10% → 34 × (1−0.10) = 30.6 → 31. +6 이 붙었다면 (34+6)×0.9 = 36 이었다. */
  eq(run(f=>{f.harden=2; f.hardenPct=0.10;}),31,"P7 **경화는 버프** — 추가 위력을 켜지 않고 ⑧ 감소만 준다 (34×0.9 = 30.6 → 31, +6 이 붙었다면 36)");
  /* 방어막도 버프다 — 추가 위력을 켜지 않는다 (흡수만 한다) */
  const shieldDealt=(()=>{
    const {fa,fd}=openBattle({A:{atk:22,element:"lightning",crit:0,
                                 skills:["lightning_stable","lightning_heavy","sup_focus","sig_atk"]},
                              D:{element:null,def:0,dodge:0,hp:9999,maxHp:9999}});
    fa.cds=[0,0,0,0]; T.shieldAdd(fd,1000,"test");
    const sh=fd.shield;
    script([0.9,0.5,0.9]);
    T.execSlot("A",1,{});
    unscript(); T.TQ.length=0;
    return sh-fd.shield;
  })();
  eq(shieldDealt,34,"P8 **방어막도 버프** — 추가 위력을 켜지 않는다 (흡수된 값이 34, +6 이 붙었다면 40)");
  /* 균열 + 화상이 같이 걸려도 추가 위력은 **한 번만** 붙는다 (조건이지 스택이 아니다) */
  eq(run(f=>{f.crack=2; f.burn=2;}),44,"P9 상태이상이 여럿이어도 +6 은 한 번만 (조건 충족 여부이지 개수 합산이 아니다)");
}

unscript();
console.log(`\n=== smoke_issue233: pass ${pass} / fail ${fail} ===`);
if(fail){ console.error("실패: "+fails.join(" | ")); process.exit(1); }
