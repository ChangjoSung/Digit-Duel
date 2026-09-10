/* #146 도망·수동 대기 · #131 텔레포트 함정 차단 · #130 보호막 합산 · #128 튜토리얼 프로필 독립 — 헤드리스 회귀
   사용: node demo/test/regression/smoke_issue146.js [demo/index.html]

   계약 원본: CJ 최종 승인 2026-09-10 (v0.4.7 / Milestone13). 기준 HEAD 33bbc19e · demo/index.html blob 4535791b.
   이 파일은 구현을 베끼지 않고 **계약 원문의 AC** 를 검사한다. 절 구성은 이슈 번호를 따른다.

     A. #146 도망 — HP 조건 폐지 · 기본 30% · 도망의 수호자 70%(치환) · 경계 난수 · 실패 반격 삭제(자기 행동 1회만)
     B. #146 수동 대기 — 4슬롯 전부 불가 시 기본 공격 없음 · 안내 + 수동 [턴 종료] · 하나라도 합법이면 예외 없음
                         · 왕·동료 본체는 기본 공격 유지 · 비공개(상대 화면 누출 금지) · 아이템/버프/포획/도망 유지
                         · 쿨링수 사용 후 재평가 · stale/중복/다른 actor/불법 basic 차단 · AI 두 난이도
     C. #130 보호막 — 3경로 전부 합산(보조기·공격 부가·레거시) · 부분 소모 뒤 합산 · 막 > maxHP 허용 · 전투 종료·새 게임 초기화
     D. #131 텔레포트 — 함정에 걸린 말(immobile>0)은 양끝 모두 거부 · 단계 유지 · 거부 안내 · 실행 직전 재검사 · 거부 시 상태 불변
     E. #128 튜토리얼 — 저장 프로필별 독립 · 단일 키 · origin 밖 공유 경로 없음 · 저장 차단에도 게임 진행 · 수동 재보기 상시
        (실제 두 브라우저 프로필·같은 HTTP origin 의 종단간 확인은 이 파일이 아니라
         demo/test/milestone/v0.4.6/issues/146/issue146_cdp.js 가 실제 Chrome 으로 수행한다.)

   저장소에 파일을 쓰지 않는다 (Saturn --read-only 재실행 가능). 종료 코드 1 = 판정 실패, 2 = 예외. */
"use strict";
const H=require("../shared/harness"), path=require("path");
const htmlPath=process.argv[2]&&!process.argv[2].startsWith("--")?process.argv[2]:path.join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
/* 절 단위 예외 격리 — 음성 대조(변경 전 소스)에서 없는 심볼로 죽지 않고 **모든 절의 계약 차이**를 한 번에 보고한다 */
function section(name,fn){ try{ fn(); }catch(e){ fail++; fails.push(name+" — 예외 "+e.message); console.error("FAIL(예외): "+name+" — "+(e.stack||e.message)); } }
const J=x=>JSON.stringify(x);

/* 브라우저처럼: overlayBox.innerHTML 교체는 그 안의 옛 #obBtns 버튼을 없앤다 (smoke_search_packages 와 같은 스텁 보정) */
function load(opts){ const X=H.load(htmlPath,opts);
  const box=X.byId("overlayBox"), ob=X.byId("obBtns");
  Object.defineProperty(box,"innerHTML",{configurable:true,get(){return this._html;},set(v){this._html=v; this.children.length=0; ob.children.length=0;}});
  X.BAL.dmgVar=0; X.BAL.statusProb=1; X.BAL.shockProb=1;
  return X; }
const ob=X=>X.byId("overlayBox").innerHTML;
/* 소유자 전용 안내는 토스트로만 나온다 — 공용 보드 로그(S.log)와 구분해서 본다 */
const toasts=X=>((X.byId("toasts").children)||[]).map(c=>c.textContent).join(" | ");
const boardLog=X=>X.S.log.map(l=>l.msg).join(" | ");

function giveSpecies(X,m,r){ m.rosterId=r.id; m.name=r.name; m.element=r.element; m.hp=r.hp; m.maxHp=r.hp; m.atk=r.atk; m.skillAtk=r.skill; m.cdMax=r.cd; m.skills=X.archSkills(r.arch,r.element); m.cds=[0,0,0,0]; m.revealedSkills=[]; }
const R=(X,id)=>X.ROSTER.find(r=>r.id===id);
/* 내 하수인(12,4)·상대 하수인(11,4)·왕 둘·동료 하나 */
function setup(X,mode){
  H.freshPlay(X,mode||"pvp"); H.clearBoard(X);
  const me=X.S.pieces.find(x=>x.owner===0&&x.type==="minion"), em=X.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  const k0=X.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=X.S.pieces.find(x=>x.owner===1&&x.type==="king");
  const ally0=X.S.pieces.filter(x=>x.owner===0&&x.type==="ally")[0];
  H.place(X,k0,13,1); H.place(X,k1,1,7); H.place(X,me,12,4); H.place(X,em,11,4); H.place(X,ally0,13,3);
  X.S.balls=[3,3]; X.S.reserve=[null,null]; X.S.inv=[[],[]]; X.TQ.length=0;
  return {me,em,k0,k1,ally0};
}
function openBattle(X,a,d){ X.S.battle=null; X.S.battlesUsed=0; a.hp=a.maxHp; d.hp=d.maxHp;
  if(a.skills) a.cds=[0,0,0,0]; if(d.skills) d.cds=[0,0,0,0]; a.cd=0; d.cd=0;
  a.shield=0; d.shield=0; a.burn=0; d.burn=0; a.shock=0; d.shock=0; a.weaken=0; d.weaken=0;
  a.powerBuff=false; d.powerBuff=false; a.fleeBoost=false; d.fleeBoost=false;
  X.TQ.length=0; X.startRounds(a,d,a,d); X.TQ.length=0; }
/* 공격측(A) 이 행동 차례가 되도록 맞춘다 */
function actAsA(X){ const B=X.S.battle; for(let i=0;i<2;i++){ if(X.actorOfPhase()==="A") return true; B.phase=B.phase===0?1:0; } return X.actorOfPhase()==="A"; }
function freshModal(X){ X.byId("obBtns").children.length=0; X.battleModal(); }

/* ══════════════ A. #146 도망 ══════════════ */
section("A",()=>{
  const T=load();
  ok(T.BAL.fleeProb===0.3,"A1 기본 도망 성공률 30% (BAL.fleeProb)");
  ok(T.BAL.fleeProbGuard===0.7,"A2 도망의 수호자 성공률 70% (BAL.fleeProbGuard)");
  ok(/70%/.test(T.BUFFS.escape.desc)&&!/조건 해제/.test(T.BUFFS.escape.desc),"A3 버프 설명이 새 계약(이 전투 도망 성공률 70%)을 말한다 — "+T.BUFFS.escape.desc);
  ok(typeof T.fleeCounter==="undefined"&&!/function fleeCounter/.test(T.html),"A4 도망 실패 반격(fleeCounter)이 소스에서 삭제됐다");

  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1")); giveSpecies(T,P.em,R(T,"M-G1"));
  openBattle(T,P.me,P.em); const B=T.S.battle; actAsA(T); B.fa.hp=B.fa.maxHp; freshModal(T);
  ok(!/50% 미만이어야 합니다/.test(ob(T))&&/HP 조건 없음/.test(ob(T)),"A5 만피에서도 도망 가능 — HP 조건 안내 자체가 없다");
  ok(!/<button class="danger" disabled/.test(ob(T))&&/성공 30%/.test(ob(T)),"A6 도망 버튼 활성 · 표기 30%");
  ok(T.fleeProbOf(B.fa)===0.3&&T.fleeProbOf(B.fd)===0.3,"A7 판정 확률도 30% (표기와 같은 원천)");
  B.fa.fleeBoost=true; freshModal(T);
  ok(/성공 70%/.test(ob(T))&&T.fleeProbOf(B.fa)===0.7&&T.fleeProbOf(B.fd)===0.3,"A8 도망의 수호자는 **그 전투원만** 70% (가산 아님 · 상대 30% 그대로)");

  /* A9 경계 난수 — 시드를 훑어 첫 rand() 가 특정 구간에 오는 시드를 찾고, 그 시드로 실제 __fleeCore 를 돌린다.
     (met·bmsg 는 난수를 쓰지 않으므로 setSeed 직후의 첫 rand() 가 곧 도망 판정 난수다.)
       r < 0.3        → 30%·70% 모두 성공
       0.3 ≤ r < 0.7  → 30% 실패 · 70% 성공   ← 두 계약의 차이가 드러나는 구간
       r ≥ 0.7        → 30%·70% 모두 실패     ← 70% 가 "1회 성공 보장"이 아님 */
  function seedIn(lo,hi){ const X=load();
    for(let k=1;k<=4000;k++){ X.setSeed(k); const v=X.rand(); if(v>=lo&&v<hi) return {seed:k,v}; }
    return null; }
  function fleeOnce(seed,boost,power){
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle; actAsA(X); Bx.fa.fleeBoost=!!boost;
    if(power) Bx.fd.powerBuff=true;   // #122 CJ QA 2: 반격자(D)의 💪 힘의 수호자
    freshModal(X);
    const tries0=X.S.metrics.fleeTries;
    X.setSeed(seed); X.__fleeCore(); X.drain(20000);
    const r={tries:X.S.metrics.fleeTries-tries0,oks:X.S.metrics.fleeOks,battleOver:X.S.battle===null,X,Bx,Q};
    return r; }
  const lo=seedIn(0.00,0.29), mid=seedIn(0.31,0.69), hi=seedIn(0.71,0.99);
  ok(lo&&mid&&hi,"A9 경계 시드 확보 (r<0.3 · 0.3≤r<0.7 · r≥0.7) — "+J([lo&&lo.v.toFixed(3),mid&&mid.v.toFixed(3),hi&&hi.v.toFixed(3)]));
  if(lo&&mid&&hi){
    ok(fleeOnce(lo.seed,false).oks===1,"A9a r<0.3: 기본 30% 성공");
    ok(fleeOnce(lo.seed,true).oks===1,"A9b r<0.3: 70% 도 성공");
    ok(fleeOnce(mid.seed,false).oks===0,"A9c 0.3≤r<0.7: 기본 30% **실패**");
    ok(fleeOnce(mid.seed,true).oks===1,"A9d 0.3≤r<0.7: 70% 는 **성공** — 두 확률이 실제로 갈린다");
    ok(fleeOnce(hi.seed,false).oks===0&&fleeOnce(hi.seed,true).oks===0,"A9e r≥0.7: 70% 도 실패한다 — 1회 성공 보장이 아니다");
  }

  /* A10 실패 처리 — #122 REVISE(2026-09-10 CJ QA 2): #146 이 지웠던 반격이 **기본 공격 한정**으로 되살아났다.
     도망을 시도한 A 측만 그 피해를 맞고, 반격한 D 측 HP 는 그대로다. 나머지 #146 계약(자기 전투 행동 1회 · 주 행동 불변)은 유지된다. */
  if(mid){
    const {X,Bx,Q}=fleeOnce(mid.seed,false);
    const blog=Bx.blog.join("|");
    ok(/도망 실패/.test(blog),"A10 전제: 도망이 실패했다");
    ok(Bx.fa.hp<Bx.fa.maxHp,"A10a 도망 실패 → 도망친 쪽이 상대의 기본 공격 피해를 받는다 (#122 CJ QA 2)");
    ok(Bx.fd.hp===Bx.fd.maxHp,"A10a2 반격한 상대는 피해를 받지 않는다");
    ok(/반격 — 기본 공격/.test(blog)&&/피해!/.test(blog),"A10b 전투 로그에 기본 공격 반격이 남는다");
    ok(!/의 [^|]*탄!|의 [^|]*강타!/.test(blog),"A10b2 반격은 기술이 아니라 기본 공격이다 (기술 이름이 로그에 없다)");
    ok(X.S.battle===Bx&&(Bx.phase===1||Bx.round>1),"A10c 자기 전투 행동 1회만 소모돼 차례가 넘어갔다 (nextPhase)");
    ok(X.S.mainUsed===false,"A10d 보드 주 행동은 소모되지 않는다");
    ok(Bx.fa.weaken===0&&Bx.fd.weaken===0,"A10e 도망 쪽 약화 잔여 횟수는 소모되지 않는다 (반격자는 실제 공격이므로 별도)");
    /* A10f #122 CJ QA 2: 💪 힘의 수호자를 쓴 반격자는 기본 공격이 **분산 상단 고정** = 최대 피해가 된다.
       같은 실패 시드 둘에서 피해가 서로 같고(분산이 고정됐다), 버프 없는 같은 시드보다 작지 않다. */
    const dmgOf=(seed,pw)=>{ const F=fleeOnce(seed,false,pw); return F.Bx.fa.maxHp-F.Bx.fa.hp; };
    if(hi){
      const bMid=dmgOf(mid.seed,true), bHi=dmgOf(hi.seed,true);
      ok(bMid===bHi&&bMid>0,"A10f 힘의 수호자 반격은 시드와 무관하게 같은 피해 — 분산이 상단으로 고정된다 ("+bMid+")");
      ok(bMid>=dmgOf(mid.seed,false)&&bMid>=dmgOf(hi.seed,false),"A10g 그 값은 버프 없는 같은 시드의 피해보다 작지 않다 (최대 피해)");
    }
    X.TQ.length=0;
  }
  /* A11 성공 처리 — 전투 즉시 종료 · 판정·제거 없음 · 전투 회계 유지 · **후방 교환 → 밀기**가 실제로 일어난다 (#114 계약) */
  if(lo){
    const {X,Bx,Q}=fleeOnce(lo.seed,false);
    ok(X.S.battle===null,"A11 성공: 전투가 즉시 끝난다");
    ok(Q.me.alive&&Q.em.alive,"A11a 판정·제거가 없다 (양측 생존)");
    ok(X.S.metrics.judged===0,"A11b 판정이 돌지 않았다");
    /* 후방 후보(내 진영 쪽 행)가 실제로 있으므로 소유자 선택 대기 상태여야 한다 */
    const fp=X.S.fleePick;
    ok(!!fp&&fp.owner===Q.me.owner&&fp.pieceId===Q.me.id&&fp.cands.length>0,
      "A11c 후방 교환 선택 대기 — 소유자·도망친 말·후보 목록이 실제로 잡혀 있다 ("+(fp?fp.cands.length+"후보":"없음")+")");
    ok(fp&&fp.cands.every(id=>{ const x=X.S.pieces.find(y=>y.id===id); return x&&x.owner===Q.me.owner&&x.alive&&x.r>Q.me.r; }),
      "A11c2 후보는 전부 내 진영 쪽(행이 더 뒤)에 살아 있는 내 말이다");
    /* 실제로 교환한다 — 도망친 말과 후방 말의 자리가 바뀌고, 전선의 말과 상대가 한 칸씩 밀린다 */
    const swapId=fp.cands[0], rear=X.S.pieces.find(y=>y.id===swapId);
    const before={me:[Q.me.r,Q.me.c],rear:[rear.r,rear.c],em:[Q.em.r,Q.em.c],push:X.S.metrics.fleePushes,bu:X.S.battlesUsed};
    X.applyAction({t:"fleeSwap",id:swapId,pick:fp.token}); X.drain(20000);
    ok(J([Q.me.r,Q.me.c])===J(before.rear),"A11d 도망친 말이 후방 말의 자리로 갔다 "+J(before.me)+" → "+J([Q.me.r,Q.me.c]));
    ok(J([rear.r,rear.c])!==J(before.rear),"A11e 후방 말이 전선으로 나왔다 "+J(before.rear)+" → "+J([rear.r,rear.c]));
    ok(X.S.metrics.fleePushes>before.push,"A11f 교환 뒤 밀기가 실제로 일어났다 (fleePushes "+before.push+" → "+X.S.metrics.fleePushes+")");
    ok(X.S.battlesUsed===before.bu,"A11g 전투 회계(battlesUsed)는 그대로다");
    ok(!X.S.fleePick,"A11h 선택 상태가 정리됐다");
    X.TQ.length=0;
  }
  /* A11i 생략 경로도 확인한다 — 교환을 생략하면 도망친 말과 상대를 민다 */
  if(lo){
    const {X,Q}=fleeOnce(lo.seed,false);
    const fp=X.S.fleePick;
    ok(!!fp,"A11i 전제: 교환 선택 대기");
    const before={me:[Q.me.r,Q.me.c],em:[Q.em.r,Q.em.c],push:X.S.metrics.fleePushes};
    X.applyAction({t:"fleeSkip",pick:fp.token}); X.drain(20000);
    ok(X.S.metrics.fleePushes>before.push,"A11j 생략해도 밀기가 일어난다 (fleePushes "+before.push+" → "+X.S.metrics.fleePushes+")");
    ok(J([Q.me.r,Q.me.c])!==J(before.me)||J([Q.em.r,Q.em.c])!==J(before.em),"A11k 도망친 말·상대의 좌표가 실제로 움직였다");
    ok(!X.S.fleePick,"A11l 선택 상태가 정리됐다");
    X.TQ.length=0;
  }
  /* A11m 대기 중인 강제 전투 큐는 밀기·재배치가 끝난 뒤에 승격된다 (#114) */
  if(lo){
    const {X,Q}=fleeOnce(lo.seed,false);
    const fp=X.S.fleePick;
    const other=X.S.pieces.find(y=>y.owner===0&&y.type==="minion"&&y.id!==Q.me.id&&y.alive); // setup() 이 보드를 비웠으므로 placed 는 아래에서 직접 놓는다
    const foe=X.S.pieces.find(y=>y.owner===1&&y.type==="minion"&&y.id!==Q.em.id&&y.alive);
    if(fp&&other&&foe){
      H.place(X,other,10,2); H.place(X,foe,9,2);
      X.S.forcedQueue=[{pid:other.id,targets:[foe.id]}];
      X.S.battlesUsed=0;
      X.applyAction({t:"fleeSkip",pick:fp.token}); X.drain(20000);
      ok(X.S.forcedQueue.length===0,"A11m 대기 중이던 강제 전투 큐가 밀기 뒤에 소비됐다");
      ok(!!X.S.battle||!!(X.S.forcedTargets&&X.S.forcedTargets.length)||X.S.log.some(l=>/강제 전투 면제/.test(l.msg)),
        "A11n 승격 결과가 실제로 남았다 (전투 개시·대상 표시·면제 로그 중 하나)");
    } else ok(false,"A11m 전제 구성 실패");
    X.TQ.length=0;
  }
  /* A12 시도 상한 신설 없음 — 같은 전투에서 반복 시도할 수 있다 */
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle; let tries=0;
    for(let n=0;n<6&&X.S.battle;n++){ actAsA(X); freshModal(X); const t0=X.S.metrics.fleeTries;
      X.setSeed(mid?mid.seed:9); X.__fleeCore(); X.drain(20000); if(X.S.metrics.fleeTries>t0) tries++; }
    ok(tries>=3,"A12 시도 횟수 상한을 신설하지 않았다 (같은 전투에서 "+tries+"회 시도 성립)");
    X.TQ.length=0;
  }
  /* A13 stale/다른 actor 방어 — 옛 모달 클로저로 상대 차례에 호출해도 아무 일도 없다 */
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle; actAsA(X); freshModal(X);
    Bx.phase=Bx.phase===0?1:0;                       // 차례가 상대에게 넘어간 뒤 옛 클로저 호출
    const snap=J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp,X.S.metrics.fleeTries]);
    X.__fleeCore(); X.drain(20000);
    ok(J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp,X.S.metrics.fleeTries])===snap,"A13 상대 차례의 옛 도망 클로저는 아무 일도 하지 않는다 (actor 가드)");
    X.TQ.length=0;
  }
  T.TQ.length=0;
});

/* ══════════════ B. #146 4슬롯 전부 불가 → 기본 공격 없음 · 수동 [턴 종료] ══════════════ */
section("B",()=>{
  /* 픽스처: 슬롯0 = 사신(쿨 0 이지만 라운드 조건 미충족으로 봉인) · 나머지 3슬롯 쿨 → 네 슬롯 모두 불가 */
  function noAtkFixture(mode){
    const X=load(); const Q=setup(X,mode); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
    Bx.fa.skills=["reaper_scythe","dragon_breath","witch_prank","sup_heal"];
    Bx.fa.cds=[0,2,2,2]; Bx.fa.revealedSkills=[]; Bx.round=1; Bx.phase=0; actAsA(X); freshModal(X);
    return {X,Bx,Q};
  }
  const {X,Bx,Q}=noAtkFixture();
  ok([0,1,2,3].every(i=>X.slotUsable(Bx.fa,i,"A")===false),"B1 전제: 네 슬롯 모두 지금 쓸 수 없다");
  ok(!/__act\('basic'\)/.test(ob(X))&&!/기본 공격 \d+~\d+/.test(ob(X)),"B2 기본 공격 버튼이 없다");
  ok(ob(X).indexOf(X.NO_ATTACK_MSG)>=0,"B3 안내 문구 '"+X.NO_ATTACK_MSG+"'");
  ok(ob(X).indexOf("__pass()")>=0,"B4 명시적 수동 [턴 종료] 버튼");
  ok(/🎒 가방/.test(ob(X))&&/🔴 포획/.test(ob(X))&&/🏃 도망가기/.test(ob(X)),"B5 아이템·버프·포획·도망 메뉴는 그대로 유지된다");
  /* B5b (Saturn msg_31b27e86d2e2): 안내와 **같은 화면**에서 바로 실행할 수 있어야 한다 —
     루트 전투 메뉴(4카테고리 블록)에도 명시적 [턴 종료]가 보이고, 싸우기 하위 패널의 버튼과 같은 handler(window.__pass)를 쓴다. */
  const rootMenu=X=>{ const h=ob(X), i=h.indexOf('id="bmenu"'); return i<0?"":h.slice(i,h.indexOf("</div>",i)+6); };
  ok(rootMenu(X).indexOf("__pass()")>=0,"B5b 루트 전투 메뉴에도 [턴 종료] 버튼이 바로 보인다 (안내와 같은 화면에서 실행 가능)");
  ok(/⚔️ 싸우기/.test(rootMenu(X))&&/🎒 가방/.test(rootMenu(X))&&/🔴 포획/.test(rootMenu(X))&&/🏃 도망가기/.test(rootMenu(X)),
    "B5c 기존 4카테고리(싸우기·가방·포획·도망)가 루트에 그대로 남는다");
  /* B6 버튼을 누르기 전에는 아무것도 진행되지 않는다 */
  const snapB=J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp]);
  X.drain(20000);
  ok(J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp])===snapB&&X.S.battle===Bx,"B6 누르기 전에는 강제 진행이 없다 (타이머를 다 돌려도 상태 불변)");
  /* B7 불법 basic 은 UI 밖 경로로도 통하지 않는다 */
  X.netAction({t:"act",k:"basic"}); X.drain(20000);
  ok(J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp])===snapB,"B7 UI 밖 basic 호출은 조용히 거부된다 (피해·행동 0)");
  ok(!/사신의 낫/.test(Bx.blog.join("|"))&&!Bx.fa.revealedSkills.includes(0),"B7a 거부가 미공개 기술을 공용 로그·공개 기록에 남기지 않는다");
  /* B8 수동 [턴 종료] — 자기 전투 행동 1회만 */
  const bu0=X.S.battlesUsed, main0=X.S.mainUsed, wk0=Bx.fa.weaken;
  X.netAction({t:"pass"}); X.drain(20000);
  ok(Bx.phase!==0||Bx.round!==1,"B8 [턴 종료]로 자기 전투 행동 1회가 넘어간다 (nextPhase)");
  ok(X.S.battlesUsed===bu0&&X.S.mainUsed===main0&&Bx.fa.weaken===wk0,"B8a 보드 주 행동·턴당 전투 횟수·약화 잔여는 소모되지 않는다");
  ok(X.S.battle===Bx,"B8b 보드 턴이 아니라 전투 행동만 넘어갔다 (전투는 계속된다)");
  X.TQ.length=0;

  /* B9 하나라도 합법이면 예외가 없다 — 보조기·시그니처만 남아도 안내·[턴 종료]가 나오지 않는다 */
  for(const [slot,label] of [[3,"보조기(응급 치유)"],[1,"공격기(드래곤 숨결)"]]){
    const F=noAtkFixture(); F.Bx.fa.cds[slot]=0; freshModal(F.X);
    ok(F.X.slotUsable(F.Bx.fa,slot,"A")===true,"B9-"+label+" 전제: 그 슬롯이 합법이다");
    ok(ob(F.X).indexOf(F.X.NO_ATTACK_MSG)<0&&ob(F.X).indexOf("__pass()")<0,"B9-"+label+": 안내·[턴 종료]가 나오지 않는다");
    ok(!/__act\('basic'\)/.test(ob(F.X))&&!/기본 공격 \d+~\d+/.test(ob(F.X)),"B9-"+label+": 기본 공격도 여전히 없다 (4슬롯 전투원)");
    /* 그 상태에서 __passCore 를 불러도 거부된다 */
    const s0=J([F.Bx.round,F.Bx.phase]); F.X.netAction({t:"pass"}); F.X.drain(20000);
    ok(J([F.Bx.round,F.Bx.phase])===s0,"B9-"+label+": 합법 슬롯이 있으면 [턴 종료] 호출도 거부된다");
    F.X.TQ.length=0;
  }
  /* B10 시그니처만 합법인 경우도 같다 (보조/시그니처 예외 없음) */
  {
    const F=load(); const Q2=setup(F); giveSpecies(F,Q2.me,R(F,"M-F1")); giveSpecies(F,Q2.em,R(F,"M-G1"));
    openBattle(F,Q2.me,Q2.em); const B2=F.S.battle;
    B2.fa.skills=["fire_stable","fire_effect","sup_heal","sig_atk"]; B2.fa.cds=[2,2,2,0]; actAsA(F); freshModal(F);
    ok(F.slotUsable(B2.fa,3,"A")===true&&ob(F).indexOf(F.NO_ATTACK_MSG)<0,"B10 시그니처 하나만 합법이어도 예외 없음 (안내 없음)");
    F.TQ.length=0;
  }
  /* B11 왕·동료 본체는 기본 공격을 유지한다 */
  {
    const F=load(); const Q3=setup(F);
    const ally=Q3.ally0; ally.skills=undefined; ally.cds=undefined; ally.skillAtk=0; ally.cd=0;
    openBattle(F,ally,Q3.em); const B3=F.S.battle; actAsA(F); freshModal(F);
    ok(/기본 공격/.test(ob(F)),"B11 동료 본체(4슬롯 없음)는 기본 공격 버튼을 유지한다");
    ok(ob(F).indexOf(F.NO_ATTACK_MSG)<0&&ob(F).indexOf("__pass()")<0,"B11a 그 경로에는 안내·[턴 종료]가 없다");
    const hp0=B3.fd.hp; F.netAction({t:"act",k:"basic"}); F.drain(20000);
    ok(B3.fd.hp<hp0||F.S.battle===null,"B11b 본체 기본 공격은 정상 동작한다");
    F.TQ.length=0;
  }
  /* B12 비공개 — 상대(비소유자) 화면에는 안내도 [턴 종료]도 나오지 않는다.
     "공격할 것이 없습니다" 는 상대의 미공개 기술 4칸이 전부 막혔다는 사실을 그대로 알려 주는 정보다. */
  {
    const F=noAtkFixture("pve");           // PVE: 뷰어는 항상 0번
    F.X.S.mode="pve";
    /* 방어측(상대, owner 1)이 행동자인 상황을 만든다 */
    const B4=F.Bx;
    B4.fd.skills=["reaper_scythe","dragon_breath","witch_prank","sup_heal"]; B4.fd.cds=[0,2,2,2];
    for(let i=0;i<2;i++){ if(F.X.actorOfPhase()==="D") break; B4.phase=B4.phase===0?1:0; }
    ok(F.X.actorOfPhase()==="D","B12 전제: 상대(방어측)가 행동자");
    freshModal(F.X);
    ok(ob(F.X).indexOf(F.X.NO_ATTACK_MSG)<0,"B12a 상대의 '공격할 것이 없습니다' 안내가 내 화면에 누출되지 않는다");
    ok(ob(F.X).indexOf("__pass()")<0,"B12b 상대의 [턴 종료] 버튼도 그려지지 않는다");
    F.X.TQ.length=0;
  }
  /* B13 쿨링수(cool) 로 쿨을 풀면 같은 전투 안에서 재평가돼 공격이 되살아난다 */
  {
    const F=noAtkFixture();
    F.Bx.fa.cds=[9,2,2,2];                          // 슬롯0 도 실제 쿨 → 사신 봉인과 무관하게 전부 불가
    F.Bx.fa.skills=["fire_stable","fire_effect","sup_heal","sig_atk"];
    F.X.S.inv[0]=["cool"]; F.Bx.itemRoundA=false; actAsA(F.X); freshModal(F.X);
    ok(ob(F.X).indexOf(F.X.NO_ATTACK_MSG)>=0,"B13 전제: 전 슬롯 쿨 → 안내 표시");
    F.X.netAction({t:"item",i:0}); F.X.drain(20000);
    ok(J(F.Bx.fa.cds)===J([0,0,0,0]),"B13a 쿨링수가 4슬롯 쿨을 초기화했다");
    ok(ob(F.X).indexOf(F.X.NO_ATTACK_MSG)<0,"B13b 같은 전투 안에서 재평가돼 안내가 사라졌다");
    ok(/__act\(0\)/.test(ob(F.X)),"B13c 공격 슬롯 버튼이 되살아났다");
    F.X.TQ.length=0;
  }
  /* B14 AI 두 난이도 — 합법 슬롯이 없으면 기본 공격이 아니라 pass 로 진행하고, 전투가 멈추지 않는다 */
  for(const lv of ["grade5","dan5"]){
    const F=load(); const Q4=setup(F,"pve"); F.S.aiLevel=[null,lv];
    F.S.pkgs=[{itemGift:0,battleBuff:0},{itemGift:0,battleBuff:0}]; F.S.inv=[[],[]]; F.S.balls=[0,0]; // 무료 패키지·아이템·볼이 있으면 AI 가 그쪽을 먼저 쓴다 — pass 경로만 남긴다
    giveSpecies(F,Q4.me,R(F,"M-F1")); giveSpecies(F,Q4.em,R(F,"M-G1"));
    openBattle(F,Q4.me,Q4.em); const B5=F.S.battle;
    B5.fd.skills=["reaper_scythe","dragon_breath","witch_prank","sup_heal"]; B5.fd.cds=[0,3,3,3];
    B5.round=1; for(let i=0;i<2;i++){ if(F.actorOfPhase()==="D") break; B5.phase=B5.phase===0?1:0; }
    freshModal(F); // 실제 흐름과 같게 그 차례의 전투 모달을 그린다 (…Core 클로저가 그 side 로 묶인다)
    ok(F.actorOfPhase()==="D"&&[0,1,2,3].every(i=>F.slotUsable(B5.fd,i,"D")===false),"B14-"+lv+" 전제: AI 차례 · 합법 슬롯 0");
    const hp0=B5.fa.hp, ph0=B5.phase, rd0=B5.round;
    F.aiBattleAction(); F.drain(20000);
    ok(B5.fa.hp===hp0,"B14-"+lv+": AI 도 기본 공격을 내지 않는다 (상대 HP 무변화)");
    ok(B5.phase!==ph0||B5.round!==rd0||F.S.battle===null,"B14-"+lv+": AI 가 전투 행동을 넘겨 전투가 멈추지 않는다");
    F.TQ.length=0;
  }
  /* B15 AI vs AI 완주 — 새 pass 경로가 들어간 채로 두 난이도 조합이 끝까지 간다 */
  {
    const F=load();
    const r=H.runSim(F,["grade5","dan5"],14601,{check:200,cap:3000000});
    ok(r.phase==="over"&&r.viol.length===0,"B15 AI vs AI 완주·불변식 0 (턴 "+r.turns+"·스텝 "+r.steps+")");
    F.TQ.length=0;
  }
});

/* ══════════════ C. #130 보호막 합산 ══════════════ */
section("C",()=>{
  /* 세 경로: (1) 보조기·시그니처 sk.shieldPct (2) 공격 부가 sk.selfShieldPct (3) 레거시 본체 grass sp.shieldPct */
  const T=load();
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1")); giveSpecies(T,P.em,R(T,"M-G1"));
  const mx=P.me.maxHp;
  const pctOf=p=>Math.round(mx*p);

  // C1 같은 기술을 이어 쓰면 합산된다
  P.me.skills=["sup_guard","sig_def","fire_stable","fire_effect"];
  openBattle(T,P.me,P.em); let B=T.S.battle; actAsA(T);
  const g=T.SKILLS.sup_guard.shieldPct, d=T.SKILLS.sig_def.shieldPct;
  T.execSlot("A",0); T.drain(20000);
  const s1=B.fa.shield;
  ok(s1===pctOf(g),"C1 첫 보호막 = maxHp×"+g+" = "+pctOf(g));
  B.fa.cds=[0,0,0,0]; actAsA(T); T.execSlot("A",0); T.drain(20000);
  ok(B.fa.shield===pctOf(g)*2,"C1a 같은 기술 두 번 → 합산 ("+pctOf(g)+"+"+pctOf(g)+"="+B.fa.shield+", 종전 최대값 갱신이면 "+pctOf(g)+")");

  // C2 다른 기술도 합산 · 부분 소모 뒤에도 남은 양에 더해진다
  openBattle(T,P.me,P.em); B=T.S.battle; actAsA(T);
  B.fa.shield=10; B.fa.cds=[0,0,0,0];
  T.execSlot("A",1); T.drain(20000);
  ok(B.fa.shield===10+pctOf(d),"C2 남은 보호막 10 + 다른 기술 "+pctOf(d)+" = "+B.fa.shield+" (부분 소모 뒤 합산)");

  // C3 공격 부가 보호막(selfShieldPct)도 같은 규칙
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-G1")); giveSpecies(X,Q.em,R(X,"M-F1"));
    Q.me.skills=["grass_heavy","fire_stable","fire_effect","sup_heal"];
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle; actAsA(X);
    const sp=X.SKILLS.grass_heavy.selfShieldPct, want=Math.round(Bx.fa.maxHp*sp);
    Bx.fa.shield=5; X.setSeed(11); X.execSlot("A",0); X.drain(20000);
    ok(Bx.fa.shield===5+want,"C3 공격 부가(가시 폭발 "+sp+") 도 합산: 5+"+want+"="+Bx.fa.shield);
    X.TQ.length=0;
  }
  // C4 레거시 본체 경로(풀 속성·4슬롯 없음)도 합산 — 직접 대입이 남아 있지 않다
  {
    const X=load(); const Q=setup(X);
    const ally=Q.ally0; ally.skills=undefined; ally.cds=undefined; ally.element="grass"; ally.skillAtk=20; ally.cd=0; ally.atk=20; ally.rosterId=null;
    openBattle(X,ally,Q.em); const Bx=X.S.battle; actAsA(X);
    const want=Math.round(Bx.fa.maxHp*X.BAL.shieldPct);
    Bx.fa.shield=7; X.setSeed(5); X.__actCore("skill"); X.drain(20000);
    ok(Bx.fa.shield===7+want,"C4 레거시 풀 경로도 합산: 7+"+want+"="+Bx.fa.shield+" (직접 대입이면 "+want+")");
    X.TQ.length=0;
  }
  // C5 누적이 maxHP 를 넘어도 수치가 손실되지 않는다 · 표시(막대)는 100% 에서 멈춘다
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    Q.me.skills=["sup_guard","sig_def","fire_stable","fire_effect"];
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
    const mh=Bx.fa.maxHp; let n=0;
    while(Bx.fa.shield<=mh&&n<20){ actAsA(X); Bx.fa.cds=[0,0,0,0]; X.execSlot("A",0); X.drain(20000); n++; }
    ok(Bx.fa.shield>mh,"C5 보호막이 최대 HP("+mh+")를 넘어 "+Bx.fa.shield+" 까지 쌓인다 (상한을 새로 만들지 않았다)");
    ok(X.stIcons(Bx.fa).indexOf("🛡"+Bx.fa.shield)>=0,"C5a 상태 표기는 실제 수치를 그대로 보여 준다 (손실 없음)");
    const fx=X.stFx?null:null; X.applyFx({st:{side:"A",text:X.stIcons(Bx.fa),shield:Bx.fa.shield,max:mh}});
    const w=parseFloat(String(X.byId("shfill-A").style.width));
    ok(w===100,"C5b 시각 영역(막대)은 100% 에서 멈춘다 — 폭만 포화하고 수치는 살아 있다 (실측 "+w+"%)");
    /* 보호막 우선 흡수: HP 는 막이 다 빠질 때까지 줄지 않는다 */
    const hp0=Bx.fd.hp; Bx.fd.shield=Bx.fd.maxHp*3;
    for(let i=0;i<2;i++){ actAsA(X); Bx.fa.cds=[0,0,0,0]; X.setSeed(3+i); X.execSlot("A",2); X.drain(20000); }
    ok(Bx.fd.hp===hp0,"C5c 보호막이 HP 보다 커도 우선 흡수 — HP 가 줄지 않는다");
    X.TQ.length=0;
  }
  // C6 화상은 보호막을 우회한다 (계약 유지)
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
    Bx.fd.shield=999; Bx.fd.burn=2; Bx.fd.burnBy="A"; const hp0=Bx.fd.hp, sh0=Bx.fd.shield;
    Bx.phase=1; X.nextPhase(); X.drain(20000);
    ok(Bx.fd.hp<hp0&&Bx.fd.shield===sh0,"C6 화상 피해는 보호막을 우회한다 (막 "+sh0+" 그대로 · HP 감소)");
    X.TQ.length=0;
  }
  // C7 전투가 끝나면 초기화 · 새 게임에서도 0
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
    Bx.fa.shield=500; Bx.fd.shield=0; Bx.fd.hp=1; actAsA(X); Bx.fa.cds=[0,0,0,0];
    X.setSeed(7); X.execSlot("A",0); X.drain(20000);
    ok(X.S.battle===null,"C7 전제: 전투가 끝났다");
    ok(Q.me.shield===0,"C7a 전투 종료 시 보호막이 초기화된다 (본체 출전이라 말에 남으면 다음 전투로 샌다)");
    X.startMode("pvp");
    ok(X.S.pieces.every(p=>!p.shield),"C7b 새 게임: 모든 말의 보호막 0");
    X.TQ.length=0;
  }
  // C8 absorbCapPct 는 지표 집계용 상한이지 보호막 상한이 아니다 (계약 유지)
  ok(T.BAL.absorbCapPct===0.3&&/absorbCapPct/.test(T.html),"C8 absorbCapPct 0.3 유지 — 유효 피해 집계용 (막 상한 아님)");
  ok(!/Math\.max\(f\.shield/.test(T.html),"C9 소스에 최대값 갱신(Math.max(f.shield …)) 이 남아 있지 않다");
  T.TQ.length=0;
});

/* ══════════════ D. #131 텔레포트 — 함정에 걸린 말 차단 ══════════════ */
section("D",()=>{
  const T=load();
  ok(T.TELE_PICK1_MSG==="먼저 텔레포트를 할 말을 선택해주세요! (함정에 걸린 말은 제외)","D1 1단계 안내 문구");
  ok(T.TELE_PICK2_MSG==="교체할 말을 선택해주세요","D2 2단계 안내 문구");
  ok(T.TELE_TRAP_MSG==="함정에 걸린 하수인은 텔레포트를 사용할 수 없습니다","D3 거부 안내 문구");

  /* 픽스처: 내 하수인 2기가 상대 진영에 들어가 있어 텔레포트가 가능한 상태 */
  function teleFixture(){
    const X=load(); H.freshPlay(X,"pvp"); H.clearBoard(X);
    const a=X.S.pieces.filter(p=>p.owner===0&&p.type==="minion")[0];
    const b=X.S.pieces.filter(p=>p.owner===0&&p.type==="minion")[1];
    const c=X.S.pieces.filter(p=>p.owner===0&&p.type==="minion")[2];
    const k0=X.S.pieces.find(p=>p.owner===0&&p.type==="king"), k1=X.S.pieces.find(p=>p.owner===1&&p.type==="king");
    H.place(X,k0,13,1); H.place(X,k1,1,7); H.place(X,a,2,2); H.place(X,b,12,4); H.place(X,c,12,6);
    X.S.current=0; X.S.mainUsed=false; X.S.battlesUsed=0; X.S.teleport={stage:1,piece:null}; X.TQ.length=0;
    return {X,a,b,c};
  }
  const F=teleFixture();
  ok(F.X.teleportAvailable(0)===true,"D4 전제: 텔레포트 가능 (상대 진영에 내 말)");
  F.X.render();
  ok(F.X.byId("sidePanel").innerHTML.indexOf(T.TELE_PICK1_MSG)>=0,"D5 1단계 화면에 계약 문구가 그대로 나온다");

  /* D6 1단계에서 함정에 걸린 말을 고르면 거부되고 **단계가 유지**된다 */
  F.b.immobile=2;
  F.X.applyAction({t:"cell",r:F.b.r,c:F.b.c});
  ok(F.X.S.teleport&&F.X.S.teleport.stage===1&&F.X.S.teleport.piece===null,"D6 1단계 거부: 단계가 그대로 1 (선택되지 않는다)");
  /* Saturn REVISE P1(비공개): 거부 사유는 **소유자 화면의 토스트로만** 나오고 공용 보드 로그에는 남지 않는다.
     S.log 는 양측이 공유하는 상태라 온라인 재생에서 상대 화면에도 그대로 렌더된다. */
  ok(toasts(F.X).indexOf(T.TELE_TRAP_MSG)>=0,"D6a 거부 안내가 소유자 토스트로 나온다");
  ok(boardLog(F.X).indexOf(T.TELE_TRAP_MSG)<0&&boardLog(F.X).indexOf("함정")<0,"D6b 공용 보드 로그에는 사유가 남지 않는다 (상대 화면 누출 금지)");

  /* D7 유효한 첫 말을 고르면 2단계로 넘어가고 2단계 문구가 나온다 */
  F.X.applyAction({t:"cell",r:F.a.r,c:F.a.c});
  ok(F.X.S.teleport&&F.X.S.teleport.stage===2&&F.X.S.teleport.piece===F.a,"D7 유효한 첫 말 선택 → 2단계");
  F.X.render();
  ok(F.X.byId("sidePanel").innerHTML.indexOf(T.TELE_PICK2_MSG)>=0,"D7a 2단계 화면에 계약 문구가 그대로 나온다");

  /* D8 2단계에서 함정에 걸린 말을 고르면 거부되고 2단계·첫 말 선택이 유지된다 */
  const before=J([F.a.r,F.a.c,F.b.r,F.b.c,F.X.S.mainUsed,F.X.S.teleUsed[0],F.X.S.metrics.teleports]);
  F.X.applyAction({t:"cell",r:F.b.r,c:F.b.c});
  ok(F.X.S.teleport&&F.X.S.teleport.stage===2&&F.X.S.teleport.piece===F.a,"D8 2단계 거부: 단계·첫 말 선택 유지");
  ok(J([F.a.r,F.a.c,F.b.r,F.b.c,F.X.S.mainUsed,F.X.S.teleUsed[0],F.X.S.metrics.teleports])===before,"D8a 거부 시 좌표·주 행동·텔레포트 횟수·지표가 모두 불변");

  /* D9 첫 말 재클릭은 종전대로 선택 취소(1단계 복귀) */
  F.X.applyAction({t:"cell",r:F.a.r,c:F.a.c});
  ok(F.X.S.teleport&&F.X.S.teleport.stage===1&&F.X.S.teleport.piece===null,"D9 첫 말 재클릭 → 1단계 복귀 (취소)");

  /* D10 정상 교환은 그대로 동작한다 (차단이 기능을 죽이지 않았다) */
  F.X.applyAction({t:"cell",r:F.a.r,c:F.a.c});
  const ar=F.a.r, ac=F.a.c, cr=F.c.r, cc=F.c.c;
  F.X.applyAction({t:"cell",r:F.c.r,c:F.c.c}); F.X.drain(20000);
  ok(F.a.r===cr&&F.a.c===cc&&F.c.r===ar&&F.c.c===ac,"D10 함정에 걸리지 않은 두 말은 정상 교환된다");
  ok(F.X.S.mainUsed===true&&F.X.S.metrics.teleports===1,"D10a 정상 교환은 주 행동 1회·지표 1을 소모한다");
  F.X.TQ.length=0;

  /* D11 실행 직전 재검사 — 선택 이후에 함정에 걸려도(늦은 프레임) 실행되지 않는다 */
  {
    const G=teleFixture();
    ok(G.X.teleportSwapValid(G.a,G.c)===null,"D11 전제: 지금은 유효한 교환이다");
    G.c.immobile=2;                                        // 선택 뒤 상태 변화
    ok(G.X.teleportSwapValid(G.a,G.c)===T.TELE_TRAP_MSG,"D11a 실행 직전 재검사가 함정 상태를 잡는다");
    const snap=J([G.a.r,G.a.c,G.c.r,G.c.c,G.X.S.mainUsed,G.X.S.teleUsed[0],G.X.S.metrics.teleports,G.X.S.forcedQueue.length,G.a.hp,G.c.hp,G.a.revealed,G.c.revealed]);
    const rand0=(G.X.setSeed(31),G.X.rand());
    G.X.setSeed(31);
    ok(G.X.doTeleportSwap(G.a,G.c)===false,"D11b 실행이 거부된다");
    ok(J([G.a.r,G.a.c,G.c.r,G.c.c,G.X.S.mainUsed,G.X.S.teleUsed[0],G.X.S.metrics.teleports,G.X.S.forcedQueue.length,G.a.hp,G.c.hp,G.a.revealed,G.c.revealed])===snap,
      "D11c 거부 시 자원·좌표·HP·공개·강제 전투 큐가 모두 불변");
    ok(G.X.rand()===rand0,"D11d 거부는 난수를 소비하지 않는다 (RNG 스트림 불변)");
    G.X.TQ.length=0;
  }
  /* D12 재검사 항목: 소유자·생존·배치·차례·주 행동·같은 말 금지 */
  {
    const G=teleFixture();
    const enemy=G.X.S.pieces.find(p=>p.owner===1&&p.type==="minion");
    H.place(G.X,enemy,11,4);
    ok(G.X.teleportSwapValid(G.a,enemy)!==null,"D12 상대 말은 교환 대상이 될 수 없다");
    ok(G.X.teleportSwapValid(G.a,G.a)!==null,"D12a 같은 말 두 번은 거부된다");
    G.c.alive=false; ok(G.X.teleportSwapValid(G.a,G.c)!==null,"D12b 죽은 말은 거부된다"); G.c.alive=true;
    G.c.placed=false; ok(G.X.teleportSwapValid(G.a,G.c)!==null,"D12c 보드에 없는 말은 거부된다"); G.c.placed=true;
    G.X.S.mainUsed=true; ok(G.X.teleportSwapValid(G.a,G.c)!==null,"D12d 주 행동을 이미 썼으면 거부된다"); G.X.S.mainUsed=false;
    G.X.S.current=1; ok(G.X.teleportSwapValid(G.a,G.c)!==null,"D12e 내 차례가 아니면 거부된다"); G.X.S.current=0;
    ok(G.X.teleportSwapValid(G.a,G.c)===null,"D12f 조건을 되돌리면 다시 유효하다");
    G.X.TQ.length=0;
  }
  /* D13 함정 유닛 자체를 막는 규칙이 아니다 — 걸리지 않은 내 함정 말은 교환 가능 */
  {
    const G=teleFixture();
    const trap=G.X.S.pieces.filter(p=>p.owner===0&&p.type==="trap")[0];
    H.place(G.X,trap,12,2); trap.immobile=0;
    ok(G.X.teleportSwapValid(G.a,trap)===null,"D13 내 함정(trap) 말 자체는 교환 대상으로 허용된다 (막히는 것은 immobile 상태다)");
    G.X.TQ.length=0;
  }
  /* D14 도망 교환·강제 밀기에는 이 제한을 확장하지 않는다 */
  ok(!/immobile/.test(String(T.fleeResolve))&&!/immobile/.test(String(T.pushResolve)),"D14 도망 교환·밀기 경로에는 immobile 제한이 추가되지 않았다");
  T.TQ.length=0;
});

/* ══════════════ E. #128 튜토리얼 노출 정책 — 문서 로드당 1회 ══════════════
   이력: 이 절은 처음에 "브라우저별 영구 최초 1회 + 저장 프로필 독립"을 고정했다. 초기 #128 의 '두 PC 가 서로 봤음을 공유한다'
   신고는 그 정책 아래에서 **재현되지 않았고**(같은 프로필·같은 origin 재접속이 원인으로 설명됐다), 그 미재현 이력은 그대로 남는다.
   2026-09-10 CJ 승인으로 정책 자체가 바뀌었다 — 이제 자동 표시는 **문서 로드당 1회**이고 영구 저장을 아예 보지 않는다.
   그래서 '프로필이 seen 을 공유하는가'라는 질문은 구조적으로 사라졌다: 읽을 저장값이 없다. 아래는 그 새 정책을 고정한다. */
section("E",()=>{
  /* E1 저장소에 무엇이 들어 있든 자동 표시된다 — 빈 저장소 · 과거 키가 남은 저장소 · 다른 값만 있는 저장소 모두 같다 */
  const A=H.mkStorage(), Bs=H.mkStorage({tutorialSeen:"1"}), Cs=H.mkStorage({netServer:"ws://127.0.0.1:8787"});
  const HREF="http://127.0.0.1:8080/index.html";
  const TA=H.load(htmlPath,{storage:A,href:HREF});
  ok(TA.TUT.open===true&&TA.TUT.auto===true&&TA.TUT.step===0,"E1 빈 저장소: 1단계부터 자동 표시");
  TA.tutClose("finish");
  ok(H.storageTrace(A).all.length===0,"E1a 완료해도 저장 흔적 0 — '봤음'을 남기지 않는다 "+J(H.storageTrace(A).all));
  const TB=H.load(htmlPath,{storage:Bs,href:HREF});
  ok(TB.TUT.open===true&&TB.TUT.auto===true,"E1b **과거 tutorialSeen=1 이 남아 있어도 자동 표시된다** (과거 키 무시)");
  TB.tutClose("skip");
  ok(Bs.getItem("tutorialSeen")==="1"&&Bs.writes.length===0,"E1c 과거 키를 지우거나 다시 쓰지 않는다 (사용자 저장값 보존) "+J(Bs.writes));
  const TC0=H.load(htmlPath,{storage:Cs,href:HREF});
  ok(TC0.TUT.open===true&&Cs.getItem("netServer")==="ws://127.0.0.1:8787"&&Cs.writes.length===0,"E1d 다른 저장값(netServer)이 있어도 자동 표시되고 그 값은 그대로다");
  TC0.tutClose("finish");
  /* E2 같은 저장소로 몇 번을 다시 로드해도 매번 다시 뜬다 — 새로고침·새 탭·브라우저 재실행·서버 재시작 후 재접속의 헤드리스 등가물.
     (옛 정책에서는 두 번째 로드부터 생략됐다. 이 절이 그 회귀를 막는다.) */
  const rep=[];
  for(let i=0;i<3;i++){ const X=H.load(htmlPath,{storage:Bs,href:HREF}); rep.push(X.TUT.open===true&&X.TUT.step===0&&X.TUT.auto===true); X.tutClose(i%2?"skip":"finish"); }
  ok(rep.every(Boolean),"E2 앞 로드를 완료/건너뛰기 한 뒤 다시 로드해도 매번 1단계 자동 표시 "+J(rep));
  ok(Bs.writes.length===0&&H.storageTrace(A).all.length===0,"E2a 반복 로드에도 저장 쓰기 0회");
  /* E2b 같은 로드 안에서는 추가 표시가 없다 — 새 게임·모드 변경·재대전은 스크립트를 다시 돌리지 않는다.
     (이 불변식은 #128 변경 전후가 같다. 새 정책이 '로드마다'를 '조작마다'로 번지지 않았음을 고정한다.) */
  const TL=H.load(htmlPath,{storage:H.mkStorage(),href:HREF});
  TL.tutClose("finish");
  TL.startMode("pvp"); TL.startMode("pve"); TL.startMode("pvp");
  ok(TL.TUT.open===false&&TL.TUT.seenThisLoad===true,"E2b 같은 로드에서 모드 변경·새 게임을 반복해도 튜토리얼이 다시 뜨지 않는다");
  TL.TQ.length=0;
  /* E3 어떤 영구·외부 저장 통로도 쓰지 않는다 (sessionStorage 대체도 금지 — '새로고침마다 표시' 요구와 어긋난다) */
  const C=H.mkStorage();
  const TC=H.load(htmlPath,{storage:C,href:HREF});
  TC.tutOpen(); for(let i=0;i<9;i++) TC.tutNext(); TC.tutClose("finish"); TC.tutOpen(); TC.tutSkip();
  const tr=H.storageTrace(C);
  ok(tr.all.length===0,"E3 튜토리얼 전 과정 후 localStorage 흔적 0 — "+J(tr.all));
  ok(H.storageTrace(TC.sessionStorage).all.length===0&&TC.cookieWrites.length===0&&TC.indexedDB.opens.length===0,
    "E3a sessionStorage·쿠키·indexedDB 무기록 (기기 지문·계정 공유 통로 없음·sessionStorage 대체 없음)");
  ok(TC.wsLog.length===0,"E3b 튜토리얼 전 과정에서 네트워크(WebSocket) 송신 0 — 서버 전역 seen 이 없다");
  /* E4 서버·전역 공유 경로가 소스에 없다 */
  ok(!/tutorialSeen[^\n]{0,80}(fetch|XMLHttpRequest|netSend|BroadcastChannel)/.test(TC.html),"E4 tutorialSeen 을 서버·탭 간 통로로 보내는 코드가 없다");
  ok(!/\bTUT\b/.test(String(TC.applyAction))&&!/tutorial/i.test(String(TC.applyAction)),"E4a 온라인 액션 재생 경로가 튜토리얼 상태를 다루지 않는다 (S 와 분리)");
  /* E5 표시 판단의 유일한 근거는 메모리 플래그다 — 저장 헬퍼가 아예 없다 */
  ok(TC.TUT_KEY===undefined&&TC.tutStore===undefined&&!/tutStore/.test(TC.html)&&TC.tutSeen()===TC.TUT.seenThisLoad,
    "E5 TUT_KEY·tutStore 부재 · tutSeen()은 이 로드의 seenThisLoad 그 자체");
  /* E6 저장이 막힌 환경에서도 동일하다 — 이제는 애초에 저장소를 건드리지 않으므로 환경 차이가 표시를 바꾸지 못한다 */
  {
    const TD=H.load(htmlPath,{storage:H.throwingStorage("SecurityError: denied"),href:"https://example.test/index.html"});
    ok(TD.TUT.open===true,"E6 저장소 접근이 예외인 환경에서도 튜토리얼이 뜬다");
    TD.tutClose("finish");
    ok(TD.TUT.open===false&&TD.TUT.seenThisLoad===true,"E6a 그 환경에서도 이번 로드에서는 재표시되지 않는다");
    TD.startMode("pvp");
    ok(TD.S&&TD.S.phase==="setup","E6b 저장이 막혀도 게임은 정상 시작된다");
    TD.TQ.length=0;
  }
  {
    const TE=H.load(htmlPath,{storage:null,href:HREF});
    ok(TE.TUT.open===true,"E6c 웹 스토리지 미지원 환경에서도 튜토리얼이 뜬다");
    TE.startMode("pvp"); ok(TE.S&&TE.S.phase==="setup","E6d 그 환경에서도 게임이 시작된다");
    TE.TQ.length=0;
  }
  /* E7 수동 재보기·건너뛰기·10단계 강제 완주 없음은 그대로 유지된다 */
  ok(/id="tutBtn"[^>]*onclick="tutOpen\(\)"/.test(TC.html),"E7 헤더의 '?' 수동 재보기 버튼은 상시 존재한다");
  const TF=H.load(htmlPath,{storage:C,href:HREF});
  ok(TF.TUT.open===true&&TF.TUT.auto===true,"E7a 전제: 이 로드에서도 자동으로 떠 있다");
  TF.tutSkip();
  ok(TF.TUT.open===false&&TF.TUT.step===0,"E7b 1단계에서 건너뛰기 한 번으로 닫힌다 (10단계 강제 완주 없음)");
  TF.tutOpen();
  ok(TF.TUT.open===true&&TF.TUT.step===0&&TF.TUT.auto===false,"E7c 닫은 뒤에도 수동으로 처음부터 다시 볼 수 있다");
  TF.tutClose("finish");
  H.resetStorage();
});

/* ══════════════ F. Saturn 1차 독립 검토 REVISE 음성 회귀 (2026-09-10, initial-review.md) ══════════════
   각 항목은 Saturn 이 실제로 재현한 결함이다. 여기서는 **그 재현 절차를 그대로 돌려** 이제는 거부되는지 본다. */
section("F",()=>{
  /* 첫 rand() 가 0.3 이상이라 기본 30% 도망이 실패하는 시드 (실패해야 nextPhase 로 라운드 경계를 넘는다) */
  const failSeed=(()=>{ const X=load(); for(let k=1;k<=4000;k++){ X.setSeed(k); if(X.rand()>=0.35) return k; } return 9; })();
  /* 적 포획이 **실패**하는 시드 (성공하면 전투가 끝나 버려 "차례가 넘어간 뒤" 를 볼 수 없다) — BAL.enemyCapProb=0.7 */
  const capFailSeed=(()=>{ const X=load(); for(let k=1;k<=4000;k++){ X.setSeed(k); if(X.rand()>=X.BAL.enemyCapProb+0.05) return k; } return 9; })();
  function noAtkFix(cds){
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
    Bx.fa.skills=["fire_stable","fire_effect","sup_heal","sig_atk"]; Bx.fa.cds=(cds||[9,9,9,9]).slice();
    Bx.fd.skills=["fire_stable","fire_effect","sup_heal","sig_atk"]; Bx.fd.cds=(cds||[9,9,9,9]).slice();
    Bx.round=1; Bx.phase=0; actAsA(X); freshModal(X);
    return {X,Bx,Q};
  }
  /* F1 (P1 :2363) 같은 pass 코어 콜백이 라운드 경계에서 두 행동을 소모하던 결함 —
     R1 후공 → R2 선공이 같은 전투원이면 actorOfPhase 검사만으로는 두 번째 호출이 통과했다. */
  {
    const {X,Bx}=noAtkFix();
    Bx.phase=1; freshModal(X);
    const side0=X.actorOfPhase();
    const old=X.__passCore;                       // 이 렌더의 클로저를 붙잡아 둔다 (Saturn 재현 그대로)
    old(); X.drain(20000);
    const s1={round:Bx.round,phase:Bx.phase,actor:X.actorOfPhase()};
    old(); X.drain(20000);                         // 같은 클로저 두 번째 호출
    const s2={round:Bx.round,phase:Bx.phase,actor:X.actorOfPhase()};
    ok(s1.round!==1||s1.phase!==1,"F1 전제: 첫 호출은 정상적으로 행동을 넘긴다 ("+JSON.stringify(s1)+")");
    ok(s2.round===s1.round&&s2.phase===s1.phase,"F1a **같은 pass 클로저의 두 번째 호출이 거부된다** (행동 토큰 — "+JSON.stringify(s2)+")");
    ok(side0==="A"||side0==="D","F1b 전제 기록: 첫 호출 시점 actor "+side0);
    X.TQ.length=0;
  }
  /* F2 도망도 같은 토큰을 쓴다 — F1 과 같은 **라운드 경계 연속 행동**(R1 후공 D → R2 선공 D)에서
     붙잡아 둔 클로저의 두 번째 호출이 두 번째 시도를 만들지 않아야 한다. */
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
    Bx.round=1; Bx.phase=1; freshModal(X);
    ok(X.actorOfPhase()==="D","F2 전제: R1 후공은 방어측 — 다음 라운드 선공도 같은 방어측이다");
    const old=X.__fleeCore;
    X.setSeed(failSeed); old(); X.drain(20000);   // 실패하는 시드 → nextPhase 로 라운드 경계를 넘는다
    const t1=X.S.metrics.fleeTries;
    ok(t1===1,"F2a 전제: 첫 도망 시도가 집계됐다");
    ok(X.actorOfPhase()==="D","F2b 전제: 라운드 경계를 넘었는데도 행동자가 같다 (round "+Bx.round+" phase "+Bx.phase+")");
    old(); X.drain(20000);
    ok(X.S.metrics.fleeTries===t1,"F2c **같은 도망 클로저의 두 번째 호출이 거부된다** (행동 토큰 — 시도 집계 불변)");
    X.TQ.length=0;
  }
  /* F3 (P1 :2493) execSlot(side,-1) 직접 호출 — 4슬롯 전투원의 순수 기본 공격이 그대로 나갔다 */
  {
    const {X,Bx}=noAtkFix();
    const before=J([Bx.fa.hp,Bx.fd.hp,Bx.round,Bx.phase,Bx.fa.cds,Bx.fd.cds]);
    X.setSeed(41); const r0=X.rand(); X.setSeed(41);
    X.execSlot("A",-1); X.drain(20000);
    ok(J([Bx.fa.hp,Bx.fd.hp,Bx.round,Bx.phase,Bx.fa.cds,Bx.fd.cds])===before,"F3 **execSlot(A,-1) 직접 호출이 거부된다** — HP·차례·쿨 불변");
    ok(X.rand()===r0,"F3a 거부는 난수를 소비하지 않는다 (RNG 스트림 불변)");
    ok(X.S.battle===Bx,"F3b 전투가 멈추거나 다른 전투로 새지 않는다");
    X.TQ.length=0;
  }
  /* F4 (P1 :2489) 사신 봉인 거부가 **다른 합법 슬롯이 있어도** 기본 공격으로 폴백하던 결함 */
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
    Bx.fa.skills=["reaper_scythe","sup_guard","sig_def","grass_heavy"]; Bx.fa.cds=[0,0,0,0]; Bx.fa.revealedSkills=[];
    Bx.round=1; Bx.phase=0; actAsA(X); freshModal(X);
    ok(X.slotUsable(Bx.fa,1,"A")===true&&X.slotUsable(Bx.fa,0,"A")===false,"F4 전제: 슬롯0 사신은 봉인 · 슬롯1 은 합법");
    const before=J([Bx.fa.hp,Bx.fd.hp,Bx.round,Bx.phase]);
    X.execSlot("A",0); X.drain(20000);
    ok(J([Bx.fa.hp,Bx.fd.hp,Bx.round,Bx.phase])===before,"F4a **불법 사신 호출은 다른 슬롯이 합법이어도 피해·행동이 없다** (기본 공격 폴백 철회)");
    ok(!Bx.fa.revealedSkills.includes(0),"F4b 쓰지 않은 사신 슬롯은 공개 기록에 들어가지 않는다");
    ok(!/사신의 낫/.test(Bx.blog.join("|")),"F4c 공용 전투 로그에 기술명이 남지 않는다");
    X.TQ.length=0;
  }
  /* F5 (P1 :2368) pass 공개 로그에 "쓸 수 있는 공격이 없어" 사유가 노출되던 결함 */
  {
    const {X,Bx}=noAtkFix();
    X.netAction({t:"pass"}); X.drain(20000);
    const blog=Bx.blog.join("|");
    ok(/이번 행동을 넘겼다/.test(blog),"F5 전제: 패스 결과가 공용 전투 로그에 남는다");
    ok(!/쓸 수 있는 공격/.test(blog)&&!/공격이 없/.test(blog),"F5a **공용 로그에 행동 불가 사유가 없다** — 중립적 결과만 공개");
    ok(blog.indexOf(X.NO_ATTACK_MSG)<0,"F5b 안내 문구 자체도 공용 로그에 없다");
    X.TQ.length=0;
  }
  /* F6 (P1) 입력 잠금 — 연출·메시지 재생 중에는 코어에서도 거부된다 (온라인 재생은 netReady 가 idle 을 기다린다) */
  {
    const {X,Bx}=noAtkFix();
    Bx.msgQ.push({txt:"재생 대기",fx:null,key:null,big:false});   // 재생 대기 상태 재현
    const before=J([Bx.round,Bx.phase]);
    X.netAction({t:"pass"}); X.drain(20000);
    ok(J([Bx.round,Bx.phase])===before,"F6 msgQ 재생 대기 중 pass 는 거부된다 (코어 잠금)");
    const t0=X.S.metrics.fleeTries;
    X.setSeed(2); X.__fleeCore(); X.drain(20000);
    ok(X.S.metrics.fleeTries===t0,"F6a 같은 상태에서 도망도 거부된다");
    Bx.msgQ.length=0; freshModal(X);
    X.netAction({t:"pass"}); X.drain(20000);
    ok(J([Bx.round,Bx.phase])!==before,"F6b 재생이 끝나면 정상적으로 넘어간다 (잠금이 기능을 죽이지 않았다)");
    X.TQ.length=0;
  }
  /* F7 (P2 :1556) 복제 객체·중복 id 로 실행하면 두 말이 한 칸에 겹치고 주 행동만 소모되던 결함 */
  {
    const X=load(); H.freshPlay(X,"pvp"); H.clearBoard(X);
    const ms=X.S.pieces.filter(p=>p.owner===0&&p.type==="minion");
    const k0=X.S.pieces.find(p=>p.owner===0&&p.type==="king"), k1=X.S.pieces.find(p=>p.owner===1&&p.type==="king");
    H.place(X,k0,13,1); H.place(X,k1,1,7); H.place(X,ms[0],2,2); H.place(X,ms[1],12,4);
    X.S.current=0; X.S.mainUsed=false; X.S.battlesUsed=0; X.TQ.length=0;
    ok(X.teleportSwapValid(ms[0],ms[1])===null,"F7 전제: 실물 두 말은 유효한 교환이다");
    const fake=Object.assign({},ms[0]);                       // 같은 좌표·같은 소유자를 가진 복제 객체
    const snap=J([ms[0].r,ms[0].c,ms[1].r,ms[1].c,X.S.mainUsed,X.S.teleUsed[0],X.S.metrics.teleports]);
    ok(X.teleportSwapValid(fake,ms[1])!==null,"F7a 복제 객체(같은 id)는 재검사에서 거부된다");
    ok(X.doTeleportSwap(fake,ms[1])===false,"F7b 실행도 거부된다");
    ok(J([ms[0].r,ms[0].c,ms[1].r,ms[1].c,X.S.mainUsed,X.S.teleUsed[0],X.S.metrics.teleports])===snap,"F7c 좌표·주 행동·텔레포트 횟수 불변");
    const fake2=Object.assign({},ms[0],{id:"not-in-board"});   // 보드에 없는 id
    ok(X.teleportSwapValid(fake2,ms[1])!==null&&X.doTeleportSwap(fake2,ms[1])===false,"F7d 보드에 없는 id 도 거부된다");
    ok(J([ms[0].r,ms[0].c,ms[1].r,ms[1].c,X.S.mainUsed,X.S.teleUsed[0],X.S.metrics.teleports])===snap,"F7e 그 경우에도 상태가 불변");
    /* 같은 id 를 가진 말이 둘이면(복제가 보드에 섞였으면) 실물을 특정할 수 없으므로 거부한다 */
    X.S.pieces.push(Object.assign({},ms[0]));
    ok(X.teleportSwapValid(ms[0],ms[1])!==null,"F7f 같은 id 가 둘이면 거부된다 (실물 특정 불가)");
    X.S.pieces.pop();
    ok(X.teleportSwapValid(ms[0],ms[1])===null,"F7g 복제를 치우면 다시 유효하다");
    X.TQ.length=0;
  }
  /* F9 (PD msg_358a94d37af5) 행동 토큰이 **모든 정상 전투 행동 전환**을 따라가는가.
     재현 시나리오: R1 후공 D 의 화면에서 도망·패스 콜백을 붙잡아 둔 뒤 D 가 **일반 공격**으로 차례를 넘기면
     R2 선공도 같은 D 다 — 같은 전투·같은 actor·연출도 끝난 상태라, 행동 전환을 세지 않으면 옛 콜백이 살아남는다. */
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
    Bx.round=1; Bx.phase=1; freshModal(X);
    ok(X.actorOfPhase()==="D","F9 전제: R1 후공은 방어측 D");
    const oldFlee=X.__fleeCore, oldPass=X.__passCore;
    X.setSeed(77); X.execSlot("D",0); X.drain(20000);        // D 가 **일반 공격**으로 자기 행동을 소모
    ok(X.S.battle===Bx&&X.actorOfPhase()==="D","F9a 전제: 라운드 경계를 넘었는데 행동자는 여전히 D (round "+Bx.round+" phase "+Bx.phase+")");
    const t0=X.S.metrics.fleeTries, snap=J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp,X.S.metrics.fleeTries]);
    X.setSeed(failSeed); oldFlee(); X.drain(20000);
    ok(X.S.metrics.fleeTries===t0&&J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp,X.S.metrics.fleeTries])===snap,
      "F9b **일반 공격으로 차례가 넘어간 뒤의 옛 도망 콜백이 거부된다** (행동 전환 토큰)");
    oldPass(); X.drain(20000);
    ok(J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp,X.S.metrics.fleeTries])===snap,"F9c 같은 상황의 옛 패스 콜백도 거부된다 (합법 슬롯 검사와 토큰 둘 다 걸린다)");
    /* 지금 화면(새 렌더)의 도망은 정상 동작해야 한다 — 가드가 기능을 죽이지 않았다 */
    freshModal(X); X.setSeed(failSeed); X.__fleeCore(); X.drain(20000);
    ok(X.S.metrics.fleeTries===t0+1,"F9d 새 렌더의 도망은 정상 동작한다");
    X.TQ.length=0;
  }
  /* F9e **토큰만으로** 거부되는지 분리해서 본다 (Saturn 지적: F9c 는 합법 슬롯이 남아 있어 다른 검사가 먼저 걸렸다).
     조건: 4슬롯이 전부 쿨이라 패스가 **원래 합법**이고, 차례는 도망·패스가 아닌 **포획 실패**로 넘어간다.
     이때 옛 패스 콜백을 거부할 수 있는 근거는 행동 전환 토큰(actSeq·round·phase)뿐이다. */
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
    Bx.fa.skills=["fire_stable","fire_effect","sup_heal","sig_atk"]; Bx.fa.cds=[9,9,9,9];
    Bx.fd.skills=["fire_stable","fire_effect","sup_heal","sig_atk"]; Bx.fd.cds=[9,9,9,9];
    Bx.round=1; Bx.phase=1; freshModal(X);
    const side0=X.actorOfPhase();
    ok([0,1,2,3].every(i=>X.slotUsable(side0==="A"?Bx.fa:Bx.fd,i,side0)===false),"F9e 전제: 행동자의 네 슬롯이 전부 쿨 — 패스가 원래 합법이다");
    const oldPass2=X.__passCore;
    /* 포획 실패로 차례를 넘긴다 (도망·패스가 아닌 정상 전투 행동) */
    const oppSide=side0==="A"?"D":"A", oppF=oppSide==="A"?Bx.fa:Bx.fd, ownerP=side0==="A"?Bx.attP.owner:Bx.defP.owner;
    oppF.hp=Math.floor(oppF.maxHp*0.2); X.S.balls[ownerP]=3; X.S.reserve[ownerP]=null;
    Bx.ballThrowA=false; Bx.ballThrowD=false; freshModal(X);
    const seq0=Bx.actSeq;
    X.setSeed(capFailSeed); X.__throwBallCore(); X.drain(20000);
    ok(X.S.battle===Bx&&Bx.actSeq>seq0,"F9e2 전제: 포획으로 차례가 넘어갔다 (토큰 "+seq0+" → "+Bx.actSeq+")");
    ok(X.actorOfPhase()===side0,"F9e3 전제: 라운드 경계라 행동자가 그대로다 (round "+Bx.round+" phase "+Bx.phase+")");
    const f2=X.actorOfPhase()==="A"?Bx.fa:Bx.fd;
    ok([0,1,2,3].every(i=>X.slotUsable(f2,i,X.actorOfPhase())===false),"F9e4 전제: 지금도 합법 슬롯이 없다 — '합법 슬롯 검사'로는 거부되지 않는다");
    const snap2=J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp]);
    oldPass2(); X.drain(20000);
    ok(J([Bx.round,Bx.phase,Bx.fa.hp,Bx.fd.hp])===snap2,"F9e5 **포획 실패로 차례가 넘어간 뒤의 옛 패스 콜백이 토큰만으로 거부된다**");
    const rp2=J([Bx.round,Bx.phase]);
    freshModal(X); X.netAction({t:"pass"}); X.drain(20000);
    ok(J([Bx.round,Bx.phase])!==rp2,"F9e6 새 렌더의 패스는 정상 동작한다 (가드가 기능을 죽이지 않았다) "+rp2+" → "+J([Bx.round,Bx.phase]));
    X.TQ.length=0;
  }
  /* F10 행동 내 **무료 선택**(아이템·패키지 개봉)은 차례를 넘기지 않으므로 같은 렌더의 행동이 계속 유효하다 */
  {
    const X=load(); const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle; actAsA(X);
    Bx.fa.hp=Bx.fa.maxHp-40; X.S.inv[0]=["potion"]; Bx.itemRoundA=false; freshModal(X);
    const oldFlee=X.__fleeCore, hp0=Bx.fa.hp, seq0=Bx.actSeq, rd0=Bx.round, ph0=Bx.phase;
    X.netAction({t:"item",i:0}); X.drain(20000);
    ok(Bx.fa.hp>hp0,"F10 전제: 아이템(회복약)이 실제로 쓰였다");
    ok(Bx.actSeq===seq0&&Bx.round===rd0&&Bx.phase===ph0,"F10a 무료 선택은 행동 전환을 만들지 않는다 (토큰·round·phase 불변)");
    const t0=X.S.metrics.fleeTries;
    X.setSeed(failSeed); oldFlee(); X.drain(20000);
    ok(X.S.metrics.fleeTries===t0+1,"F10b 아이템을 쓴 뒤에도 같은 렌더의 도망은 정상 동작한다 (가드가 무료 행동을 막지 않는다)");
    X.TQ.length=0;
  }
  /* F11 **온라인 활성 2인스턴스** 락스텝 — 같은 시드로 같은 액션 프레임을 재생하면
     호스트(NET.me=0)와 참가자(NET.me=1)의 공유 상태·행동 토큰·**난수 스트림**이 모두 같아야 한다.
     한쪽만 여러 번 다시 그려 렌더 횟수를 어긋나게 해도(표시 계층) 결과가 갈리지 않아야 한다.
     검사 대상 행동: 포획 실패 · 수동 패스 · 도망 실패 — 셋 다 차례를 넘기고 토큰을 올린다. */
  {
    const mk=(me)=>{
      const X=load(); X.setSeed(4242);
      const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
      openBattle(X,Q.me,Q.em); const Bx=X.S.battle;
      Bx.fa.skills=["fire_stable","fire_effect","sup_heal","sig_atk"]; Bx.fa.cds=[9,9,9,9];
      Bx.fd.skills=["fire_stable","fire_effect","sup_heal","sig_atk"]; Bx.fd.cds=[9,9,9,9];
      Bx.round=1; Bx.phase=0; actAsA(X);
      X.NET.mode=me===0?"host":"join"; X.NET.me=me; X.NET.started=true;
      freshModal(X);
      return {X,Bx,Q};
    };
    const H0=mk(0), H1=mk(1);
    ok(H0.X.NET.me===0&&H1.X.NET.me===1&&!!H0.X.NET.mode&&!!H1.X.NET.mode,"F11 전제: 두 인스턴스가 온라인 활성이고 시점이 서로 다르다");
    const snap=(K)=>J({seq:K.Bx.actSeq,round:K.Bx.round,phase:K.Bx.phase,fa:K.Bx.fa.hp,fd:K.Bx.fd.hp,
      balls:K.X.S.balls.slice(),tries:K.X.S.metrics.fleeTries,oks:K.X.S.metrics.fleeOks,
      capT:K.X.S.metrics.enemyCapTries,capF:K.X.S.metrics.enemyCapFails,bu:K.X.S.battlesUsed,main:K.X.S.mainUsed});
    ok(snap(H0)===snap(H1),"F11a 시작 상태가 같다");
    /* (1) 포획 실패 — 양측이 같은 프레임을 재생한다 */
    for(const K of [H0,H1]){ const B=K.Bx, own=K.X.actorOfPhase()==="A"?B.attP.owner:B.defP.owner;
      const of=K.X.actorOfPhase()==="A"?B.fd:B.fa;
      of.hp=Math.floor(of.maxHp*0.2); K.X.S.balls[own]=3; K.X.S.reserve[own]=null; B.ballThrowA=false; B.ballThrowD=false;
      K.X.setSeed(capFailSeed); freshModal(K.X); }
    for(let i=0;i<3;i++) freshModal(H1.X);            // 참가자 쪽만 추가 렌더 (표시 계층 불일치)
    H0.X.applyAction({t:"ball"}); H0.X.drain(20000);
    H1.X.applyAction({t:"ball"}); H1.X.drain(20000);
    ok(snap(H0)===snap(H1),"F11b 포획 실패 재생 후 양측 상태·토큰 일치 — "+snap(H0));
    ok(H0.X.rand()===H1.X.rand(),"F11c 포획 실패 후 난수 스트림 위치가 같다");
    /* (2) 수동 패스 */
    for(const K of [H0,H1]) freshModal(K.X);
    for(let i=0;i<2;i++) freshModal(H0.X);            // 이번엔 호스트 쪽만 추가 렌더
    const seqBefore=H0.Bx.actSeq;
    H0.X.applyAction({t:"pass"}); H0.X.drain(20000);
    H1.X.applyAction({t:"pass"}); H1.X.drain(20000);
    ok(H0.Bx.actSeq>seqBefore,"F11d 패스가 실제로 재생돼 토큰이 올라갔다");
    ok(snap(H0)===snap(H1),"F11e 패스 재생 후 양측 상태·토큰 일치");
    ok(H0.X.rand()===H1.X.rand(),"F11f 패스는 난수를 쓰지 않으므로 스트림 위치도 같다");
    /* (3) 도망 실패 — 성공률 판정 난수 1회만 쓰고 양측이 같은 결과를 본다 */
    for(const K of [H0,H1]){ K.X.setSeed(failSeed); freshModal(K.X); }
    H0.X.applyAction({t:"flee"}); H0.X.drain(20000);
    H1.X.applyAction({t:"flee"}); H1.X.drain(20000);
    ok(H0.X.S.metrics.fleeTries===H1.X.S.metrics.fleeTries&&H0.X.S.metrics.fleeTries>0,"F11g 도망 시도가 양측에서 같은 횟수로 집계됐다");
    ok(snap(H0)===snap(H1),"F11h 도망 실패 재생 후 양측 상태·토큰 일치");
    ok(H0.X.rand()===H1.X.rand(),"F11i 도망 판정 뒤 난수 스트림 위치가 같다 (실패 반격이 없어 상대 쪽 추가 소비가 없다)");
    for(const K of [H0,H1]){ K.X.NET.mode=null; K.X.NET.me=0; K.X.NET.started=false; K.X.TQ.length=0; }
  }
  /* F12 텔레포트 **접촉 전투 예산 거부**도 소유자 전용이다 (Saturn msg_2b6a30b05bb1) —
     새 강제 전투 수가 남은 전투 슬롯을 넘어 사전 차단될 때, 비소유 클라이언트의 공용 로그·토스트에 사유가 남으면 안 된다. */
  {
    const X=load(); H.freshPlay(X,"pvp"); H.clearBoard(X);
    const a=X.S.pieces.filter(p=>p.owner===0&&p.type==="minion")[0];
    const b=X.S.pieces.filter(p=>p.owner===0&&p.type==="minion")[1];
    const d=X.S.pieces.filter(p=>p.owner===1&&p.type==="minion")[0];
    const e=X.S.pieces.filter(p=>p.owner===1&&p.type==="minion")[1];
    const k0=X.S.pieces.find(p=>p.owner===0&&p.type==="king"), k1=X.S.pieces.find(p=>p.owner===1&&p.type==="king");
    H.place(X,k0,13,1); H.place(X,k1,1,7);
    H.place(X,a,2,2); H.place(X,b,12,4); H.place(X,d,2,3); H.place(X,e,12,5);
    X.S.current=0; X.S.mainUsed=false; X.S.battlesUsed=1; X.S.teleport={stage:2,piece:a};
    ok(X.teleportSwapValid(a,b)===null,"F12 전제: 말 조건은 전부 유효하다");
    const block=X.teleportSwapBlock(a,b);
    ok(!!block&&/전투/.test(block),"F12a 전제: 접촉 전투 예산으로 사전 차단되는 조합이다 — "+block);
    /* 비소유 클라이언트(NET.me=1)가 같은 프레임을 재생하는 상황 */
    X.NET.mode="join"; X.NET.me=1; X.NET.replaying=true;
    const log0=X.S.log.length, snapS=J([a.r,a.c,b.r,b.c,X.S.mainUsed,X.S.teleUsed[0],X.S.metrics.teleports]);
    X.setSeed(31); const r0=X.rand(); X.setSeed(31);
    ok(X.doTeleportSwap(a,b)===false,"F12b 실행이 거부된다");
    X.NET.replaying=false;
    const added=X.S.log.slice(log0).map(l=>l.msg).join(" | ");
    ok(added.indexOf(block)<0&&!/텔레포트 스왑 차단/.test(added),"F12c **비소유 화면의 공용 로그에 차단 사유가 남지 않는다** (추가 로그: "+(added||"없음")+")");
    ok(toasts(X).indexOf("차단")<0,"F12d 비소유 화면에는 토스트도 뜨지 않는다");
    ok(J([a.r,a.c,b.r,b.c,X.S.mainUsed,X.S.teleUsed[0],X.S.metrics.teleports])===snapS,"F12e 거부 시 좌표·주 행동·텔레포트 횟수 불변");
    ok(X.rand()===r0,"F12f 난수 소비 0");
    X.NET.mode=null; X.NET.me=0; X.TQ.length=0;
    /* 소유자 화면에서는 사유가 토스트로 보인다 */
    const Y=load(); H.freshPlay(Y,"pvp"); H.clearBoard(Y);
    const a2=Y.S.pieces.filter(p=>p.owner===0&&p.type==="minion")[0];
    const b2=Y.S.pieces.filter(p=>p.owner===0&&p.type==="minion")[1];
    const d2=Y.S.pieces.filter(p=>p.owner===1&&p.type==="minion")[0];
    const e2=Y.S.pieces.filter(p=>p.owner===1&&p.type==="minion")[1];
    H.place(Y,Y.S.pieces.find(p=>p.owner===0&&p.type==="king"),13,1);
    H.place(Y,Y.S.pieces.find(p=>p.owner===1&&p.type==="king"),1,7);
    H.place(Y,a2,2,2); H.place(Y,b2,12,4); H.place(Y,d2,2,3); H.place(Y,e2,12,5);
    Y.S.current=0; Y.S.mainUsed=false; Y.S.battlesUsed=1; Y.S.teleport={stage:2,piece:a2};
    Y.doTeleportSwap(a2,b2);
    ok(toasts(Y).indexOf("차단")>=0,"F12g 소유자 화면에는 차단 사유가 토스트로 보인다");
    ok(Y.S.log.map(l=>l.msg).join(" | ").indexOf("차단")<0,"F12h 소유자 화면에서도 공용 로그에는 남기지 않는다");
    Y.TQ.length=0;
  }
  /* F8 (P1 :1428/:1573) 텔레포트 거부 사유가 공용 로그를 통해 비소유 화면에 노출되던 결함 */
  {
    const X=load(); H.freshPlay(X,"pvp"); H.clearBoard(X);
    const ms=X.S.pieces.filter(p=>p.owner===0&&p.type==="minion");
    const k0=X.S.pieces.find(p=>p.owner===0&&p.type==="king"), k1=X.S.pieces.find(p=>p.owner===1&&p.type==="king");
    H.place(X,k0,13,1); H.place(X,k1,1,7); H.place(X,ms[0],2,2); H.place(X,ms[1],12,4);
    ms[1].immobile=2;
    X.S.current=0; X.S.mainUsed=false; X.S.teleport={stage:1,piece:null};
    /* 온라인 상대 클라이언트가 같은 셀 프레임을 재생하는 상황 — 뷰어는 상대(1번)다 */
    X.NET.mode="join"; X.NET.me=1; X.NET.replaying=true;
    const log0=X.S.log.length;
    X.applyAction({t:"cell",r:ms[1].r,c:ms[1].c});
    X.NET.replaying=false;
    const added=X.S.log.slice(log0).map(l=>l.msg).join(" | ");
    ok(added.indexOf(X.TELE_TRAP_MSG)<0,"F8 **비소유 클라이언트의 공용 로그에 거부 사유가 남지 않는다** (추가 로그: "+(added||"없음")+")");
    ok(toasts(X).indexOf(X.TELE_TRAP_MSG)<0,"F8a 비소유 화면에는 토스트도 뜨지 않는다");
    ok(X.S.teleport&&X.S.teleport.stage===1,"F8b 단계도 그대로 유지된다");
    X.NET.mode=null; X.NET.me=0; X.TQ.length=0;
  }
});

console.log(`\n=== smoke_issue146 (#146·#131·#130·#128): pass ${pass} / fail ${fail} ===`);
if(fail){ console.error("실패: "+fails.join(" | ")); process.exit(1); }
