/* #95 공격형 연속 공격 위력 완화 (V6) — 수치 고정 헤드리스 회귀
   node demo/test/smoke_attack_balance.js [demo/index.html]
   계약(docs/v0.4.4-gameplay-spec.md 3장): ROSTER 공격형 4종 atk 26→25, SKILLS.sig_atk.pow 44→40. 그 밖의 종·기술·쿨·HP·라운드 구조·상성·분산은 불변.
   여기서는 (A) 상수 두 개와 그 밖의 모든 종·기술 값 스냅샷 (B) slotPow 파생값 (C) 실제 execSlot 연속 구간 피해 (D) 전투 UI 위력 범위 표기 (E) 로스터 팝업 표기를 고정한다. */
"use strict";
const H=require("./harness");
const htmlPath=process.argv[2];
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

/* ===== A. 상수 — 변경 2개 + 나머지 전부 불변 (eff5c16 스냅샷) ===== */
{
  const T=H.load(htmlPath);
  const atk=T.ROSTER.filter(r=>r.arch==="atk");
  ok(atk.length===4&&atk.map(r=>r.id).join()==="M-F2,M-W2,M-G2,M-L2","A1 공격형 4종 M-F2/W2/G2/L2");
  ok(atk.every(r=>r.atk===25),"A2 공격형 atk 26→25 (4종 모두)");
  ok(atk.every(r=>r.hp===90&&r.skill===40&&r.cd===3),"A3 공격형 HP 90 · skill 40 · cd 3 불변");
  ok(T.SKILLS.sig_atk.pow===40,"A4 SKILLS.sig_atk.pow 44→40");
  ok(T.SKILLS.sig_atk.cd===4&&T.SKILLS.sig_atk.selfVuln===0.15&&T.SKILLS.sig_atk.kind==="sig"&&T.SKILLS.sig_atk.ko==="결정타","A5 결정타 cd 4 · selfVuln 0.15 · kind sig · 이름 불변");
  // 변경 전 스냅샷 (eff5c16) — 공격형 4종을 뺀 16종은 값이 그대로여야 한다
  const OTHER={"M-F1":[100,22,35,2],"M-F3":[120,18,30,2],"M-W1":[100,22,35,2],"M-W3":[120,18,30,2],"M-G1":[100,22,35,2],"M-G3":[120,18,30,2],
    "M-L1":[100,22,35,2],"M-L3":[120,18,30,2],"M-F4":[85,24,30,1],"M-W4":[85,24,30,1],"M-G4":[85,24,30,1],"M-L4":[85,24,30,1],
    "M-F5":[95,20,28,2],"M-W5":[95,20,28,2],"M-G5":[95,20,28,2],"M-L5":[95,20,28,2]};
  const others=T.ROSTER.filter(r=>r.arch!=="atk");
  ok(others.length===16&&others.every(r=>{const e=OTHER[r.id]; return e&&r.hp===e[0]&&r.atk===e[1]&&r.skill===e[2]&&r.cd===e[3];}),"A6 다른 16종 hp/atk/skill/cd 불변 (eff5c16 스냅샷)");
  ok(T.ROSTER.length===20&&T.ROSTER.filter(r=>r.arch==="swift").every(r=>r.atk===24)&&atk.every(r=>r.atk>24),"A7 공격형 atk 25 > 속공형 24 서열 유지");
  const POW={fire_stable:26,fire_effect:22,fire_heavy:38,water_stable:26,water_effect:22,water_heavy:32,grass_stable:26,grass_effect:20,grass_heavy:34,
    lightning_stable:26,lightning_effect:22,lightning_heavy:34,sig_std:30,sig_swift:22,sig_sustain:18};
  ok(Object.entries(POW).every(([k,p])=>T.SKILLS[k]&&T.SKILLS[k].pow===p),"A8 다른 피해 기술 15종 pow 불변");
  const CD={fire_stable:0,fire_effect:2,fire_heavy:3,water_stable:0,water_effect:2,water_heavy:3,grass_stable:0,grass_effect:2,grass_heavy:3,lightning_stable:0,lightning_effect:2,lightning_heavy:3,
    sup_heal:3,sup_guard:3,sup_focus:3,sup_cool:4,sup_cleanse:3,sup_evade:3,sig_std:3,sig_atk:4,sig_def:4,sig_swift:2,sig_sustain:3};
  ok(Object.keys(T.SKILLS).length===23&&Object.entries(CD).every(([k,c])=>T.SKILLS[k].cd===c),"A9 기술 23종 쿨 불변");
  ok(T.SKILLS.sig_atk.pow>Math.max(...["fire_heavy","water_heavy","grass_heavy","lightning_heavy"].map(k=>T.SKILLS[k].pow)),"A10 결정타 40 > 모든 heavy(≤38) — 시그니처 정체성 유지");
  ok(T.BAL.dmgVar===0.2&&T.BAL.statusProb===0.7&&T.BAL.advMult===1.3&&T.BAL.disMult===0.75&&T.BAL.maxRounds===6,"A11 분산 ±20% · 상태 확률 0.7 · 상성 1.3/0.75 · 6라운드 불변");
  ok(!/pow:44|atk:26/.test(T.html),"A12 소스에 옛 값(pow:44 · atk:26) 잔재 없음");
}

/* ===== B. slotPow 파생값 — 공격형 4종 (계약 표: stable 30 · heavy 43/36/39/39 · 결정타 45) ===== */
{
  const T=H.load(htmlPath);
  const pow=(id,sid)=>{const rd=T.ROSTER.find(r=>r.id===id); return Math.round(T.SKILLS[sid].pow*rd.atk/22);};
  const exp={"M-F2":{stable:30,heavy:43,sig:45},"M-W2":{stable:30,heavy:36,sig:45},"M-G2":{stable:30,heavy:39,sig:45},"M-L2":{stable:30,heavy:39,sig:45}};
  const ELM={"M-F2":"fire","M-W2":"water","M-G2":"grass","M-L2":"lightning"};
  ok(Object.entries(exp).every(([id,e])=>pow(id,ELM[id]+"_stable")===e.stable&&pow(id,ELM[id]+"_heavy")===e.heavy&&pow(id,"sig_atk")===e.sig),"B1 공격형 파생 위력 stable 30 · heavy 43/36/39/39 · 결정타 45");
  ok(pow("M-F2","fire_heavy")+pow("M-F2","sig_atk")===88,"B2 불 공격형 연속 구간 heavy+결정타 = 88 (변경 전 97)");
  ok(Math.round(43*1.2)+Math.round(45*1.2)===106&&Math.round(43*0.8)+Math.round(45*0.8)===70,"B3 연속 구간 분산 상단 106 · 하단 70 (변경 전 상단 116)");
  ok(pow("M-F1","fire_stable")===26&&pow("M-F1","sig_std")===30&&pow("M-F4","sig_swift")===24&&pow("M-F3","fire_heavy")===31&&pow("M-F5","sig_sustain")===16,"B4 다른 종 파생 위력 불변 (표준 26/30 · 속공 24 · 방어 heavy 31 · 지속 16)");
  // 실제 로스터 주입값(applyRoster) 과 전투원 atk 도 25
  T.newGame("pvp"); T.S.roster[0]=["M-F2","M-W2","M-G2","M-L2","M-F1","M-F4"]; T.applyRoster(0);
  const ms=T.S.pieces.filter(x=>x.owner===0&&x.type==="minion");
  ok(ms.slice(0,4).every(m=>m.atk===25&&m.hp===90&&m.maxHp===90&&m.skillAtk===40&&m.cdMax===3)&&ms[4].atk===22&&ms[5].atk===24,"B5 applyRoster 주입: 공격형 atk 25 / HP 90 · 표준 22 · 속공 24");
  ok(ms[0].skills.join()==="fire_stable,fire_heavy,sup_focus,sig_atk","B6 공격형 슬롯 템플릿 stable/heavy/집중/결정타 불변");
}

/* ===== C. 실제 execSlot — 연속 구간·기본 공격·집중·상성 (분산 0 고정) ===== */
function setupDuel(T,aId,dId){
  T.newGame("pvp"); const S=T.S;
  S.roster[0]=[aId]; S.roster[1]=[dId]; T.applyRoster(0); T.applyRoster(1);
  S.inv=[[],[]]; S.balls=[0,0];
  const A=S.pieces.find(x=>x.owner===0&&x.type==="minion"), D=S.pieces.find(x=>x.owner===1&&x.type==="minion");
  const k0=S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,A,7,4); H.place(T,D,6,4); H.place(T,k0,13,1); H.place(T,k1,1,7);
  S.phase="play"; S.current=0; S.mainUsed=true; S.battlesUsed=0; T.TQ.length=0;
  T.startRounds(A,D,A,D);
  return {A,D};
}
{
  const T=H.load(htmlPath); T.BAL.dmgVar=0; T.BAL.statusProb=1; T.BAL.shockProb=1; // #96: 감전 확률도 함께 고정 (AC 7 · smoke_shock H1)
  // C1: 공격형(불)이 R1 후공 — R1 2번째(heavy) + R2 1번째(결정타) 연속 구간 → 표준형 100 HP 가 12 남는다 (변경 전 3)
  let {A,D}=setupDuel(T,"M-F1","M-F2");
  T.execSlot("A",2); // 표준형 R1 선공: 보조기(응급 치유, 비피해) — 방어측 HP 변화 없음
  ok(T.S.battle&&T.S.battle.round===1&&T.S.battle.phase===1,"C0 R1 후공 차례 (phase 1)");
  T.execSlot("D",1); // 공격형 폭염 강타 43
  ok(A.hp===100-43,"C1a R1 후공 폭염 강타 43 (변경 전 45) → 표준형 HP 57");
  ok(T.S.battle.round===2&&T.S.battle.phase===0,"C1b R2 진입 · 짝수 라운드 방어측 선공");
  T.execSlot("D",3); // 결정타 45
  ok(A.hp===100-88&&A.alive,"C1c R2 선공 결정타 45 (변경 전 52) → 연속 구간 88, 표준형 HP 12 생존");
  ok(D.vulnMark===true,"C1d 결정타 반동(다음 피격 +15%) 유지");
  // C2: 기본 공격 = atk 25 (전 슬롯 쿨 폴백 경로) — 공격형이 공격측
  ({A,D}=setupDuel(T,"M-W2","M-W1"));
  T.execSlot("A",-1);
  ok(D.hp===100-25,"C2 공격형 기본 공격 25 (변경 전 26)");
  // C3: 집중(+20%) → 물 heavy 36×1.2 = 43
  ({A,D}=setupDuel(T,"M-W2","M-W1"));
  T.execSlot("A",2); T.execSlot("D",0); // 집중 · 상대 안정기
  ok(A.focusCharge===true,"C3a 집중 충전");
  T.execSlot("A",1);
  ok(D.hp===100-43&&A.focusCharge===false,"C3b 집중 발동 쇄도 파도 36×1.2=43 (변경 전 38×1.2=46)");
  // C4: 상성 — 불 공격형 heavy 43 → 풀(우위) 56 · 물(열위) 32
  ({A,D}=setupDuel(T,"M-F2","M-G1")); T.execSlot("A",1);
  ok(D.hp===100-56,"C4a 상성 우위 43×1.3=56 (변경 전 45×1.3=59)");
  ({A,D}=setupDuel(T,"M-F2","M-W1")); T.execSlot("A",1);
  ok(D.hp===100-32,"C4b 상성 열위 43×0.75=32 (변경 전 34)");
  // C5: 결정타 상성 우위 45×1.3=59 (변경 전 68) · 다른 종 결정타 없음 — 표준형 전술 연계 30 그대로
  ({A,D}=setupDuel(T,"M-L2","M-W1")); T.execSlot("A",3);
  ok(D.hp===100-59,"C5a 번개 공격형 결정타 vs 물 우위 45×1.3=59 (변경 전 68)");
  ({A,D}=setupDuel(T,"M-G1","M-G3")); T.execSlot("A",3);
  ok(D.hp===120-30,"C5b 표준형 전술 연계 30 불변 (공격형 외 영향 없음)");
  // C6: 분산 ±20% 경계 — 결정타 45 → 36~54 · heavy 43 → 34~52 (rand 극단값 주입)
  T.BAL.dmgVar=0.2;
  const rr=Math.random; // setSeed(null) 이면 rand()=Math.random
  T.setSeed(null);
  ({A,D}=setupDuel(T,"M-F2","M-F1")); Math.random=()=>0; T.execSlot("A",3); Math.random=rr;
  ok(D.hp===100-36,"C6a 결정타 분산 하단 36");
  ({A,D}=setupDuel(T,"M-F2","M-F1")); Math.random=()=>0.9999999; T.execSlot("A",3); Math.random=rr;
  ok(D.hp===100-54,"C6b 결정타 분산 상단 54 (변경 전 62)");
  ({A,D}=setupDuel(T,"M-F2","M-F1")); Math.random=()=>0.9999999; T.execSlot("A",1); Math.random=rr;
  ok(D.hp===100-52,"C6c 폭염 강타 분산 상단 52 — 연속 구간 상단 52+54=106 (변경 전 116), 상단 굴림에서는 여전히 100 HP 제거 가능 [사실 기록]");
}

/* ===== D. 전투 UI 위력 범위 표기 (dmgRange · 자동 파생) ===== */
{
  const T=H.load(htmlPath);
  T.startMode("sim",{aiLevel:["grade5","grade5"]}); // sim 뷰어(2): 양측 기술 전부 공개 표기
  setupDuel(T,"M-F2","M-F1");
  T.S.mode="sim"; T.battleModal();
  const box=T.els.overlayBox.innerHTML;
  ok(/화염탄 24~36/.test(box)&&/폭염 강타 34~52/.test(box)&&/결정타 36~54/.test(box),"D1 공격형(불) 커맨드 표기 화염탄 24~36 · 폭염 강타 34~52 · 결정타 36~54 (변경 전 25~37 · 36~54 · 42~62)");
  ok(!/결정타 42~62/.test(box)&&!/폭염 강타 36~54/.test(box),"D2 옛 범위 표기 없음");
  ok(/집중/.test(box)&&/title="사용 후 다음 피격 피해 \+15%"/.test(box),"D3 보조기 집중 · 결정타 설명 문구 불변");
  // 전 슬롯 쿨 → 기본 공격 폴백 버튼 20~30
  const f=T.S.battle.fa; f.cds=[1,1,1,1]; T.battleModal();
  ok(/기본 공격 20~30/.test(T.els.overlayBox.innerHTML),"D4 기본 공격 폴백 표기 20~30 (변경 전 21~31)");
  T.close();
  // 다른 종 표기 불변 — 표준형(불)이 행동자일 때 화염탄 21~31 · 전술 연계 24~36 (커맨드는 현재 행동자 것만 표시된다)
  setupDuel(T,"M-F1","M-F2"); T.S.mode="sim"; T.battleModal();
  ok(/화염탄 21~31/.test(T.els.overlayBox.innerHTML)&&/전술 연계 24~36/.test(T.els.overlayBox.innerHTML),"D5 표준형 표기 불변 화염탄 21~31 · 전술 연계 24~36");
  T.close();
}

/* ===== E. 로스터 팝업 (rosterInfo) 스탯·위력 표기 ===== */
{
  const T=H.load(htmlPath);
  T.newGame("pvp"); T.S.phase="setup"; T.S.setupPlayer=0; T.render();
  for(const [id,heavy] of [["M-F2",43],["M-W2",36],["M-G2",39],["M-L2",39]]){
    T.rosterInfo(id); const box=T.els.overlayBox.innerHTML;
    ok(/HP 90 · 공격 25 \(기술 위력 = 표기 위력 × 공격\/22\)/.test(box),`E1 ${id} 팝업 HP 90 · 공격 25`);
    ok(new RegExp(`\\[공격기\\] 위력 ${heavy} · 쿨 3`).test(box)&&/\[공격기\] 위력 30 —/.test(box)&&/결정타<\/b> <small>\[시그니처\] 위력 45 · 쿨 4/.test(box),`E2 ${id} 팝업 위력 stable 30 · heavy ${heavy} · 결정타 45`);
    T.close();
  }
  T.rosterInfo("M-F1"); ok(/HP 100 · 공격 22/.test(T.els.overlayBox.innerHTML)&&/위력 26 —/.test(T.els.overlayBox.innerHTML)&&/전술 연계<\/b> <small>\[시그니처\] 위력 30/.test(T.els.overlayBox.innerHTML),"E3 표준형 팝업 불변 (공격 22 · 26 · 30)"); T.close();
  T.rosterInfo("M-F4"); ok(/HP 85 · 공격 24/.test(T.els.overlayBox.innerHTML),"E4 속공형 팝업 불변 (공격 24)"); T.close();
}

/* ===== F. AI 는 slotPow 를 동적으로 읽는다 — 시드 고정 sim 완주·불변식 (수치 변경 후 회귀) ===== */
{
  const T=H.load(htmlPath);
  let done=0, viol=0;
  for(let i=0;i<4;i++){ const r=H.runSim(T,i%2?["dan5","grade5"]:["grade5","grade5"],9500+i,{check:50}); if(r.phase==="over") done++; viol+=r.viol.length; }
  ok(done===4&&viol===0,"F1 sim 4판 완주·불변식 (완주 "+done+"/4, 위반 "+viol+")");
  ok(!/\b52\b.*결정타|결정타.*\b52\b/.test(T.html.replace(/<style>[\s\S]*<\/style>/,"")),"F2 결정타 위력을 상수로 박은 곳 없음 (AI·표기 모두 slotPow 파생)");
}

console.log(`\n=== smoke_attack_balance: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
