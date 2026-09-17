/* #241 스킬 정리 — 교체 4종 · 단순화 12 · 회피율 감소 전환 · Q3 ⌛ 증가 Fresh · AI 예정 선턴 집중 회귀
   실행: node demo/test/regression/smoke_issue241.js [demo/index.html]
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).

   근거(구현 입력 우선순위): 최종 구현 기획서(docs/milestone/v0.4.11/issues/234/Mercury/final-implementation-plan.md 1·2장, CJ 승인 2026-09-17)
   > Venus final-plan-review.md(번개 꼬리 1.2 · 해일 예고 2.2 · 거울 수면 3.1 · 단순화 4장 · 회피율 감소 5.2 · AI 5.4)
   > Venus skill-cut-review.md 2.3 > Mars cleanup-feasibility.md.

   절 ↔ 명세 2장
     L  번개 꼬리(R1 · 1)          T  해일 예고(R2 · 2)        M  거울 수면(R3 · 3)
     V  회피율 감소(V1 · 4·5)       S  단순화 12(6) · P2(7)     Q  Q3 ⌛ 증가 Fresh(8)
     A  AI 예정 선턴 · 새 스킬(10)
   모든 검사는 실제 엔진 경로(execSlot → execV2 → resolveHit · nextPhase · battleModal 코어 · aiBattleAction)로 몰아서 본다. */
"use strict";
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
const T=H.load(htmlPath);
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(got===want,name+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }
const near=(a,b)=>Math.abs(a-b)<1e-9;

const realRandom=Math.random;
function fixRand(v){ T.setSeed(null); Math.random=()=>v; }
function unfix(){ Math.random=realRandom; T.setSeed(null); }
const SK=id=>T.SKILLS[id];

/* ===== 전투 무대 — smoke_issue234 와 같은 실제 startRounds 경로 ===== */
function arena(){
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,m,7,4); H.place(T,e,6,4);
  H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
  H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  return {m,e};
}
/* 기본 수치: 공격 20 · 방어 0 · 회피 0 · 치명 0 · 무속성 · 속도 10(동률이면 A 선턴) */
function openBattle(A,D){
  const {m,e}=arena();
  const setup=(p,o)=>{ o=o||{}; p.hp=o.hp!==undefined?o.hp:100; p.maxHp=o.maxHp!==undefined?o.maxHp:100;
    p.atk=o.atk!==undefined?o.atk:20; p.def=o.def||0; p.spd=o.spd!==undefined?o.spd:10; p.dodge=o.dodge||0; p.crit=o.crit||0;
    p.statusPct=o.statusPct||0; p.grade=o.grade!==undefined?o.grade:1; p.element=o.element!==undefined?o.element:null;
    p.shieldStartPct=0; p.skills=o.skills||["M-F1-1"]; p.revealedSkills=[]; p.legend=o.legend||null; };
  setup(m,A); setup(e,D);
  T.S.battle=null; T.S.battlesUsed=0; T.TQ.length=0;
  T.startRounds(m,e,m,e); T.TQ.length=0;
  const B=T.S.battle; B.msgQ.length=0;
  return {B,a:B.fa,d:B.fd};
}
function act(side,slot){ const B=T.S.battle; B.phase=(B.firstSide===side)?0:1; T.execSlot(side,slot); T.TQ.length=0; if(T.S.battle) T.S.battle.msgQ.length=0; }
/* 추가 공격 단계에서는 차례(phase)를 건드리지 않고 그대로 이어 쓴다 */
function bonusAct(slot){ T.execSlot(T.S.battle.bonus.side,slot); T.TQ.length=0; if(T.S.battle) T.S.battle.msgQ.length=0; }
function endRound(){ const B=T.S.battle; if(!B) return; B.phase=1; T.nextPhase(); T.TQ.length=0; if(T.S.battle) T.S.battle.msgQ.length=0; }
const FOX=["M-L4-1","M-L4-2","M-L4-3","M-L4-4"], SHAMAN=["M-W5-1","M-W5-2","M-W5-3","M-W5-4"], FAIRY=["M-W1-1","M-W1-2","M-W1-3","M-W1-4"];

fixRand(0.5); // 회피 0 · 분산 ×1.0 · 치명 없음

/* ===================== L. 번개 꼬리 — CJ 설계 R1 · Venus 1.2 기본값 ===================== */
{
  let t=openBattle({skills:FOX},{hp:300,maxHp:300});
  t.a.cds=[0,1,2,0]; t.d.dodgeForce=true; act("A",3);
  ok(t.d.hp===300&&t.B.bonus&&t.B.bonus.stage==="active"&&t.B.phase===0&&T.actorOfPhase()==="A","L1 첫 타격이 회피돼도 추가 공격 단계 — 턴이 넘어가지 않는다 (L1)");
  ok(t.a.cds[1]===0&&t.a.cds[2]===0&&t.a.cds[3]===4&&JSON.stringify(t.B.bonus.saved)===JSON.stringify({1:1,2:2}),"L2 이번 턴만 2·3차 ⌛0 · 사본 저장 · 번개 꼬리 ⌛4");
  ok(T.slotUsable(t.a,0,"A")&&T.slotUsable(t.a,1,"A")&&T.slotUsable(t.a,2,"A"),"L3 후보 = 기본기 · 스파크 스침 · 전광석화 (L2·L3)");
  t.a.cds[3]=0; ok(!T.slotUsable(t.a,3,"A"),"L4 번개 꼬리 자신은 ⌛0 이어도 추가 공격 후보가 아니다"); t.a.cds[3]=4;
  /* L17 — 추가 공격 중 도망 · 아이템 · 패스 · 볼 금지 (실제 코어) */
  T.byId("obBtns").children.length=0; T.battleModal();
  const tries=T.S.metrics.fleeTries; T.S.inv[0]=["potion"]; t.a.hp=50; t.B.itemRoundA=false;
  window.__fleeCore(); window.__useItemCore(0); window.__passCore(); window.__throwBallCore(); T.TQ.length=0;
  ok(T.S.metrics.fleeTries===tries&&T.S.inv[0].length===1&&t.a.hp===50&&t.B.bonus&&t.B.phase===0,"L5 추가 공격 중 도망 · 아이템 · 패스 · 볼 거부 (L5·L17)");
  const html=T.byId("overlayBox").innerHTML;
  ok(/추가 공격/.test(html)&&/disabled onclick="window\.__menu\('flee'\)"/.test(html)&&/disabled onclick="window\.__menu\('bag'\)"/.test(html),"L6 화면 — 추가 공격 안내 · 가방·도망 메뉴 비활성 (L22)");
  t.a.hp=100;
  /* 전광석화 추가 공격: 42%(=8) · 가장 긴 다른 ⌛(방금 4 가 된 번개 꼬리) −1 · 끝나면 2·3차 사본 복원 */
  bonusAct(2);
  ok(300-t.d.hp===Math.round(20*0.7*0.6)&&!t.B.bonus&&t.B.phase===1,"L7 전광석화 추가 공격 피해 60% (70% → 8) · 턴 종료");
  eq(JSON.stringify(t.a.cds),"[0,1,2,3]","L8 턴 끝에 2·3차 ⌛ 사본 복원(쿨타임 디버프 포함) · 번개 꼬리 4→3 (L7·L9·L11)");
}
{ /* 추가 공격 60% 는 피해만 — 스파크 스침 감전 30% 는 그대로 (L6) */
  const t=openBattle({skills:FOX,statusPct:0.3},{hp:300,maxHp:300}); act("A",3); bonusAct(1);
  ok(300-t.d.hp===20+Math.round(20*1.2*0.6)&&t.d.shock>0,"L9 스파크 스침 72% · 감전 확률(30%+💫30%=60%)은 ×0.6(36%) 하지 않는다 — 난수 0.5 로 부여");
}
{ /* 환영 무도로 번개 꼬리가 무효면 추가 공격도 없다 (L12 · P6 · P21) */
  const t=openBattle({skills:FOX},{hp:300,maxHp:300}); t.a.nullifyNext=true; act("A",3);
  ok(!t.B.bonus&&t.B.phase===1&&t.d.hp===300&&t.a.cds[3]===4&&t.a.cds[1]===0,"L10 무효된 번개 꼬리 — 추가 공격 없음 · ⌛4 소모 · 2·3차 그대로");
}
{ /* 추가 공격으로 쓰러뜨리면 전투 종료 (L21) */
  const t=openBattle({skills:FOX},{hp:25,maxHp:100}); act("A",3); bonusAct(0);
  ok(!T.S.battle&&t.d.hp<=0,"L11 추가 공격(기본기 60%)으로 쓰러뜨리면 전투 종료");
}
{ /* 이전 렌더의 늦은 콜백은 추가 공격을 대신 쓰지 못한다 */
  const t=openBattle({skills:FOX},{hp:300,maxHp:300});
  T.byId("obBtns").children.length=0; T.battleModal(); const stale=window.__actCore;
  act("A",3); const hp=t.d.hp; stale(1); T.TQ.length=0;
  ok(t.d.hp===hp&&t.B.bonus&&t.B.bonus.stage==="active","L12 번개 꼬리 이전 모달의 콜백 거부 (actSeq)");
  window.__actCore(1); T.TQ.length=0; ok(!t.B.bonus&&300-t.d.hp===20+14,"L13 현재 모달 콜백으로는 추가 공격 실행");
}
{ /* 추가 공격은 두 번째 행동 — 빙벽 반사가 한 번 더 걸린다 (L15) */
  const t=openBattle({skills:FOX},{hp:300,maxHp:300}); t.d.reflectR=2; act("A",3); bonusAct(0);
  eq(100-t.a.hp,6+4,"L14 반사 2회 — 20×30%=6 · 12×30%=3.6→4");
}
{ /* AI 가 추가 공격 단계에서 합법 슬롯만 고른다 (두 난이도) */
  for(const level of ["grade5","dan5"]){
    const t=openBattle({skills:FOX,hp:40},{hp:300,maxHp:300});
    T.S.mode="sim"; T.S.aiLevel={0:level,1:level};
    for(const o of [0,1]){ T.S.pkgs[o]={itemGift:1,battleBuff:1}; T.S.inv[o]=["potion","cure"]; T.S.balls[o]=0; }
    act("A",3); const tries=T.S.metrics.fleeTries, pk=JSON.stringify(T.S.pkgs[0]);
    T.byId("obBtns").children.length=0; T.battleModal(); T.TQ.length=0; T.aiBattleAction(); T.TQ.length=0;
    ok(!t.B.bonus&&t.B.phase===1&&T.S.metrics.fleeTries===tries&&T.S.inv[0].length===2&&JSON.stringify(T.S.pkgs[0])===pk&&300-t.d.hp>20,
      `L15 ${level} AI — 추가 공격을 합법 스킬로 쓰고 아이템·패키지·도망을 쓰지 않는다`);
  }
}

/* ===================== T. 해일 예고 — CJ 설계 R2 · Venus 2.2 기본값 ===================== */
{
  let t=openBattle({skills:SHAMAN},{hp:300,maxHp:300,def:20}); t.d.weaken=1; act("A",3);
  eq(t.d.tideMark,Math.round(20*1.5*0.8),"T1 X = 💪 × (120% + 약화 1 × 30%) × 방어력 20% 감소 = 24 (사용 시 ①~⑩)");
  ok(t.d.hp===300&&t.a.onceUsed["M-W5-4"]&&/🌊해일≤24/.test(T.stIcons(t.d)),"T2 즉시 피해 없음 · 전투당 1회 · 상태 아이콘에 X");
  T.byId("obBtns").children.length=0; T.battleModal(); const html=T.byId("overlayBox").innerHTML;
  ok(/class="tideline"/.test(html)&&(html.match(/🌊해일≤24/g)||[]).length>=1,"T3 전투 화면 — 대상 HP 바에 X 선 · 표식(양쪽 패널이 같은 stIcons 를 그린다)");
  t.d.def=0; ok(t.d.tideMark===24,"T4 사용 뒤 방어력이 바뀌어도 X 불변 (T7)");
  t=openBattle({skills:SHAMAN},{hp:300,maxHp:300}); t.d.dodgeForce=true; act("A",3);
  ok(!(t.d.tideMark>0)&&t.a.onceUsed["M-W5-4"]&&!T.slotUsable(t.a,3,"A"),"T5 사용 순간 회피 → 표식 없음 · 전투당 1회 소모 (T4)");
  t=openBattle({skills:SHAMAN},{hp:20}); act("A",3);
  ok(!T.S.battle&&t.d.hp===0,"T6 사용 직후 이미 HP ≤ X(24) 면 즉시 발동 · 사망");
  /* 방어막은 HP 와 합산 (T8) */
  t=openBattle({skills:SHAMAN},{skills:["M-F1-1"],hp:20}); T.shieldAdd(t.d,10,"x"); act("A",3);
  ok(!!T.S.battle&&t.d.tideMark===24,"T7 HP 20 + 방어막 10 = 30 > 24 — 대기");
  act("D",0); act("D",0); act("A",0);
  ok(!T.S.battle&&t.d.hp===0,"T8 방어막이 깨져 HP+방어막 ≤ X 가 된 행동 직후 발동 (방어막째 사망)");
  /* 천년목 — 켜진 동안 보류(효과 소모 없음), 끝난 뒤 조건이면 사망 (③④) */
  t=openBattle({skills:SHAMAN},{hp:20}); t.d.enduredR=2; t.d.enduredUsed=false; act("A",3);
  ok(!!T.S.battle&&t.d.tideMark===24&&t.d.tideHeld&&!t.d.enduredUsed&&t.d.hp===20,"T9 천년목이 켜져 있으면 보류 · 버티기 소모 없음");
  endRound(); ok(!!T.S.battle&&t.d.enduredR===1,"T10 R1 종료 — 아직 켜짐");
  endRound(); ok(!T.S.battle&&t.d.hp===0,"T11 천년목이 끝난 라운드 종료 처리 직후 발동 · 사망");
  /* 철벽 돌파 — 무효 1회가 남은 동안 보류, 쓰이면 그 행동 뒤 발동 */
  t=openBattle({skills:SHAMAN},{skills:["M-F1-1"],hp:20}); t.d.nullHitR=2; t.d.nullHitN=1; act("A",3);
  ok(!!T.S.battle&&t.d.tideHeld,"T12 철벽 돌파가 켜져 있으면 보류");
  act("D",0); act("D",0); act("A",0);
  ok(!T.S.battle&&t.d.nullHitN===0,"T13 철벽 무효가 쓰인 행동 뒤 발동");
  /* 과부하 방벽 */
  t=openBattle({skills:SHAMAN},{hp:20}); t.d.overloadR=1; act("A",3);
  ok(!!T.S.battle,"T14 과부하 방벽이 켜져 있으면 보류"); endRound(); ok(!T.S.battle,"T15 만료된 라운드 종료 처리 직후 발동");
  /* 해제 · 이동 불가 (T19) */
  t=openBattle({skills:SHAMAN},{skills:["M-W1-1","M-W1-3"],hp:300,maxHp:300}); act("A",3); t.d.burn=2;
  act("D",1); ok(t.d.tideMark===24&&t.d.burn===0,"T16 맑은 물은 상태이상을 풀지만 해일 표식은 남는다");
  T.S.inv[1]=["cure"]; t.B.itemRoundD=false; t.B.phase=(t.B.firstSide==="D")?0:1; T.battleModal(); window.__useItemCore(0); T.TQ.length=0;
  ok(t.d.tideMark===24,"T17 해독제로도 해제되지 않는다");
  ok(T.v2PeekStatus(t.d)===null,"T18 거울 수면이 옮길 상태이상 목록에 없다");
  ok(!(t.a.pendingFx&&t.a.pendingFx.length)&&!(t.d.pendingFx&&t.d.pendingFx.length)&&T.v2RoundStart===undefined,"T19 예약 효과(pendingFx 해일 경로 · 라운드 시작 훅) 정리");
}

/* ===================== M. 거울 수면 — CJ 결정 R3 · Venus 3.1 기본값 ===================== */
{
  let t=openBattle({skills:FAIRY},{hp:300,maxHp:300}); t.a.weaken=2; t.a.weakenMag=0.2; act("A",3);
  ok(t.a.weaken===0&&t.d.weaken===2&&t.d.weakenMag===0.2,"M1 자기 약화 2회(20%)를 대상에게 그대로 옮김 (수치 · 남은 횟수)");
  eq(300-t.d.hp,16,"M2 순서 = 자기 해제 → 💪80% (해제된 약화는 이번 타격에 걸리지 않는다: 16)");
  t=openBattle({skills:FAIRY},{hp:300,maxHp:300}); t.a.burn=2; t.a.burnMag=0.05; t.d.dodgeForce=true; act("A",3);
  ok(t.a.burn===0&&!(t.d.burn>0),"M3 대상이 회피하면 해제만 된다");
  t=openBattle({skills:FAIRY},{hp:300,maxHp:300}); t.a.burn=3; t.a.burnNoCure=true; t.a.shock=1; act("A",3);
  ok(t.a.burn===3&&t.a.burnNoCure&&t.a.shock===0&&t.d.shock===1&&!(t.d.burn>0),"M4 영겁의 재 화상은 건너뛰고 다음 순서(감전)를 옮긴다 (N1 · P2)");
  t=openBattle({skills:FAIRY},{hp:300,maxHp:300}); t.a.shock=1; t.d.immuneShockR=2; act("A",3);
  ok(t.a.shock===0&&!(t.d.shock>0),"M5 대상이 감전 면역이면 해제만 (N1)");
  t=openBattle({skills:FAIRY},{hp:300,maxHp:300}); t.a.mossR=2; t.a.mossPct=0.04; t.a.mossBy="D"; act("A",3);
  ok(t.a.mossR===0&&t.d.mossR===2&&t.d.mossBy==="A","M6 이끼 잠식 — 부여자를 거울 사용자로 (기본값 4)");
  t=openBattle({skills:FAIRY},{hp:300,maxHp:300}); t.a.evadeDownR=2; t.a.evadeDown=0.2; act("A",3);
  ok(t.a.evadeDownR===0&&t.d.evadeDown===0.2&&t.d.evadeDownR===2&&t.d.evadeDownRFresh===true,"M7 회피율 감소도 옮긴다 · 대상에게는 새 부여(부여 라운드 제외)");
  t=openBattle({skills:FAIRY},{hp:300,maxHp:300}); act("A",3); ok(300-t.d.hp===16,"M8 옮길 상태이상이 없으면 💪80% 만");
}

/* ===================== V. 회피율 감소 — CJ 승인 Q2 · Venus 5.2 ===================== */
{
  ok(near(T.effEvade({dodge:0.1,evadeBuff:0.3,evadeDownR:2,evadeDown:0.2}),0.2),"V1 최종 회피 = 기본 10 + 증가 30 − 감소 20 = 20%");
  ok(T.effEvade({dodge:0,evadeDownR:1,evadeDown:0.15})===0,"V2 최소 0%");
  ok(near(T.effEvade({dodge:0.15,evadeBuff:0.4}),0.4),"V3 최대 40%");
  ok(near(T.effEvade({dodge:0.15,evadeBuff:0.4,evadeDownR:1,evadeDown:0.2}),0.35),"V4 한 식으로 자른다 — 55 − 20 = 35% (상한을 먼저 자르지 않음)");
  ok(T.effEvade({dodge:0.1,evadeDownR:0,evadeDown:0.2})===0.1,"V5 지속이 끝난 감소 수치는 쓰지 않는다");
  let t=openBattle({skills:["M-F1-1"]},{hp:300,maxHp:300,dodge:0.1}); fixRand(0.05); act("A",0); fixRand(0.5);
  ok(t.d.hp===300,"V6 대조 — 회피 10% 상대에 난수 0.05 는 회피");
  t=openBattle({skills:["M-F1-1"]},{hp:300,maxHp:300,dodge:0.1}); t.d.evadeDownR=1; t.d.evadeDown=0.1; fixRand(0.05); act("A",0); fixRand(0.5);
  ok(t.d.hp<300,"V7 회피율 −10%p 면 같은 난수로 적중 (실제 resolveHit ①)");
  t=openBattle({skills:["M-E4-1","M-E4-3","M-E4-4"]},{skills:["M-F1-1"],hp:300,maxHp:300}); act("A",2); act("D",0); act("A",1);
  ok(t.d.evadeDown===0.2&&t.d.evadeDownR===2,"V8 중첩 — 모래 폭풍 −20%p 위 모래바람 −10%p 는 큰 값 · 긴 지속 유지 (5.6)");
  t=openBattle({skills:T.LEGEND_ROSTER[0].skills.slice(),legend:"dragon"},{hp:300,maxHp:300}); act("A",2);
  ok(t.d.evadeDownR===2&&/💨회피−15%p·2R/.test(T.stIcons(t.d)),"V9 날개 강타 −15%p(2R) · 상태 아이콘");
  endRound(); eq(t.d.evadeDownR,2,"V10 부여 라운드 종료에는 세지 않는다"); endRound(); eq(t.d.evadeDownR,1,"V11 R2 종료 1"); endRound();
  ok(t.d.evadeDownR===0&&t.d.evadeDown===0,"V12 R3 종료에 해제 (2R)");
  t=openBattle({skills:["M-W1-1","M-W1-3"]},{}); t.a.evadeDownR=2; t.a.evadeDown=0.2; act("A",1);
  ok(t.a.evadeDownR===0&&t.a.evadeDown===0,"V13 맑은 물로 해제 (상태이상)");
  t=openBattle({skills:["M-F1-1"]},{}); t.a.evadeDownR=2; t.a.evadeDown=0.2; T.S.inv[0]=["cure"]; t.B.itemRoundA=false; T.battleModal(); window.__useItemCore(0); T.TQ.length=0;
  ok(t.a.evadeDownR===0,"V14 해독제로 해제");
  eq(JSON.stringify(T.V2_INTERP.cleanseOrder),JSON.stringify(["burn","weaken","shock","crack","evadeDown","healCut","moss"]),"V15 P2 해제 순서표 — '속도 감소' 자리를 '회피율 감소'가 대신한다");
  const o={}; T.resetV2(o);
  ok(!("spdDown" in o)&&!("spdDownR" in o)&&T.effSpd({spd:10,spdBuff:0,spdDown:5})===10,"V16 속도 감소 필드 폐지 — 1라운드 속도 판정에 감소가 없다");
}

/* ===================== S. 단순화 12 — CJ 승인 Q1 · skill-cut-review 2.3 ===================== */
{
  const o={}; T.resetV2(o);
  ok(["mirrorR","sandWind","nextShockForce","nextFlat","nextDmgUp","sporePending","burnBonus","fortressR","counterRound","burrowR","permShockR","permShockBy"].every(k=>!(k in o)),"S1 필요 없어진 전용 필드 초기화 대상에서 삭제");
  let t=openBattle({skills:["M-F5-1","M-F5-4"]},{skills:["M-W1-1","M-W1-3"]}); act("A",1); act("D",1);
  ok(t.d.burn>0&&t.d.burnNoCure,"S2 영겁의 재 — 맑은 물로 해제되지 않는다(어떤 해제로도)");
  t=openBattle({skills:["M-F5-1","M-F5-4"]},{skills:T.LEGEND_ROSTER[1].skills.slice(),legend:"witch"}); act("A",1); act("D",2);
  ok(t.d.burn>0&&t.d.burnNoCure,"S3 영겁의 재 — 변덕 주문으로도 해제되지 않는다");
  t=openBattle({skills:T.LEGEND_ROSTER[1].skills.slice(),legend:"witch"},{hp:300,maxHp:300}); fixRand(0.3); act("A",1); fixRand(0.5);
  ok(t.d.burn>0&&t.d.weaken>0,"S4 독약 병 — 화상 50% · 약화 50% 각각 판정 (난수 0.3 둘 다 부여)");
  t=openBattle({skills:T.LEGEND_ROSTER[1].skills.slice(),legend:"witch"},{hp:300,maxHp:300}); fixRand(0.6); act("A",1); fixRand(0.5);
  ok(!(t.d.burn>0)&&!(t.d.weaken>0),"S5 독약 병 — 난수 0.6 은 둘 다 실패(50%)");
  t=openBattle({skills:["M-E1-1","M-E1-3","M-E1-4"]},{}); act("A",1);
  ok(t.a.hardenPct===0.4&&t.a.harden===1&&t.a.burrowRound===1,"S6 굴 파기 — 경화 40%(1R) · 지하 매복 조건 기록");
  t=openBattle({skills:["M-W6-1","M-W6-4"]},{skills:["M-F1-1"],hp:300,maxHp:300}); T.shieldAdd(t.a,10,"x"); act("A",1); act("D",0);
  ok(300-t.d.hp===5&&t.a.hp===90,"S7 집게 반격 — 방어막이 막은 10 의 50% 반사(5) · 초과 10 은 HP");
  act("D",0); act("A",0); ok(t.a.hp===70&&300-t.d.hp===5+20,"S8 방어막이 막지 못한 타격에는 반사 없음");
  t=openBattle({skills:["M-L5-1","M-L5-4"]},{}); t.d.immuneShockR=2; act("A",1); ok(!(t.d.shock>0),"S9 영구 자기장 — 접지 감전 면역이면 거부");
}

/* ===================== Q. Q3 ⌛ 증가 Fresh — 사실 확인 뒤 적용 (CJ 승인) ===================== */
{
  const run=fresh=>{ T.V2_INTERP.cdUpFresh=fresh;
    /* D 선턴(속도 14) · 동결 시전자 A 는 R1 후턴. D 의 2차는 ⌛0 */
    const t=openBattle({skills:["M-W3-1","M-W3-3"],spd:6},{skills:["M-F1-1","M-F1-2"],spd:14,hp:300,maxHp:300});
    act("D",0); act("A",1); const afterEnd=t.d.cds[1], usable=T.slotUsable(t.d,1,"D");
    act("A",0); act("D",0); return {t,afterEnd,usable,afterR2:t.d.cds[1]}; };
  const off=run(false);
  ok(off.t.B.round===3&&off.afterEnd===0&&off.usable===true,"Q1 [사실 확인] Fresh 없이는 후턴 시전자의 ⌛0 +1 이 R1 종료에 사라진다(효과 0) — 코드 근거가 실제로 성립");
  const on=run(true);
  ok(on.afterEnd===1&&on.usable===false&&on.afterR2===0,"Q2 Fresh 적용 — +1 이 R2 에 남아 사용을 막고 R2 종료에 0");
  T.V2_INTERP.cdUpFresh=true;
  const t=openBattle({skills:["M-W3-1","M-W3-3"]},{skills:["M-F1-1","M-F1-2"],hp:300,maxHp:300}); t.d.cds=[0,2]; act("A",1); endRound();
  eq(t.d.cds[1],2,"Q3 ⌛2 에 건 +1 은 평소처럼 감소 (3 → 2) — Fresh 는 ⌛0 에서 올린 +1 만");
  const t2=openBattle({skills:["M-L5-1","M-L5-3"]},{skills:["M-F1-1","M-F1-2"],hp:300,maxHp:300}); t2.d.shock=1; act("A",1); endRound();
  eq(t2.d.cds[1],1,"Q4 자기장도 같은 규칙 (A 선턴 · ⌛0 +1 → R1 종료 뒤 1)");
}

/* ===================== A. AI — 예정 선턴 입력 · 새 스킬 (Venus 5.4) ===================== */
{
  eq(T.aiScheduledLead({firstSideR1:"A"},2),"D","A1 예정 선턴 — 짝수 라운드는 R1 반대 측");
  eq(T.aiScheduledLead({firstSideR1:"A"},3),"A","A2 홀수 라운드는 R1 측");
  eq(T.aiScheduledLead({},2),null,"A3 기준이 없으면 모름(null)");
  let t=openBattle({skills:["M-L1-1","M-L1-2"]},{skills:["M-L1-1","M-L1-2"]});
  eq(T.aiV2DmgAdj("A",t.a,SK("M-L1-2"))[1],3,"A4 감전 스킬 — 다음 라운드 예정 선턴이 상대면 가산(뒤집기 유효)");
  eq(T.aiV2DmgAdj("D",t.d,SK("M-L1-2"))[1],-2,"A5 다음 라운드 예정 선턴이 자신이면 감산(헛돎)");
  t=openBattle({skills:["M-L2-1","M-L2-4"]},{}); eq(T.aiV2DmgAdj("A",t.a,SK("M-L2-4"))[0],2,"A6 천둥 낙인 — 이번 라운드 선턴이면 260% 로 추정");
  t=openBattle({skills:FOX},{hp:300,maxHp:300}); act("A",3); eq(T.aiV2DmgAdj("A",t.a,SK("M-L4-2"))[0],0.6,"A7 추가 공격 추정 60%");
  t=openBattle({skills:SHAMAN},{hp:20});
  ok(T.aiV2SupportScore(t.a,SK("M-W5-4"),false,"A",t.d)===95,"A8 해일 예고 — 공개 수치로 곧 발동할 때 최우선");
  t.d.hp=100; ok(T.aiV2SupportScore(t.a,SK("M-W5-4"),false,"A",t.d)===1,"A9 만피 상대에는 아껴 둔다");
  t=openBattle({skills:FAIRY},{}); t.a.burn=2; const withSt=T.aiV2DmgAdj("A",t.a,SK("M-W1-4"))[1]; t.a.burn=0;
  ok(withSt===4&&T.aiV2DmgAdj("A",t.a,SK("M-W1-4"))[1]===0,"A10 거울 수면 — 옮길 자기 상태이상이 있을 때 가산");
}
{ /* AI 전투 완주 — 번개 여우 ⭐4 vs 파도 술사 ⭐4 · 합법 선택만 (시드 1개) */
  unfix();
  const t=openBattle({skills:FOX,hp:123,maxHp:123,atk:31,element:"lightning"},{skills:SHAMAN,hp:138,maxHp:138,atk:26,element:"water"});
  T.S.mode="sim"; T.S.aiLevel={0:"dan5",1:"grade5"};
  for(const o of [0,1]){ T.S.pkgs[o]={itemGift:0,battleBuff:0}; T.S.inv[o]=[]; T.S.balls[o]=0; }
  T.setSeed(241);
  let illegal=0, n=0;
  while(T.S.battle&&n<60){
    const B=T.S.battle, side=T.actorOfPhase(), f=side==="A"?B.fa:B.fd;
    const legal=new Set(f.skills.filter((id,k)=>T.slotUsable(f,k,side)).map(id=>T.SKILLS[id].ko)), all=new Set(f.skills.map(id=>T.SKILLS[id].ko));
    const b0=B.blog.length; T.battleModal(); T.aiBattleAction(); T.TQ.length=0; n++;
    const line=B.blog.slice(b0).find(x=>/의 (.+)!$/.test(x)&&all.has(/의 (.+)!$/.exec(x)[1]));
    if(line&&!legal.has(/의 (.+)!$/.exec(line)[1])) illegal++;
  }
  T.setSeed(null);
  ok(!T.S.battle&&illegal===0,`A11 AI 전투 완주 · 불법 선택 0 (행동 ${n})`);
}
unfix();

console.log(`smoke_issue241: ${pass} pass / ${fail} fail`);
if(fail){ console.error(fails.join("\n")); process.exit(1); }
