/* QA 사이클 5 (#19 → #20 #21) 헤드리스 회귀 — node demo/test/regression/smoke_cycle5.js [demo/index.html] */
"use strict";
const H=require("../shared/harness");
const T=H.load(process.argv[2]);
const S=()=>T.S;
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
T.BAL.dmgVar=0; T.BAL.statusProb=1; T.BAL.shockProb=1; // #96: 감전 확률도 함께 고정 (테스트 결정론)
const realRandom=Math.random;

/* ===== A. #20-1 지표 분리·이중 집계 정합 (sim 완주 후 합산 = byPlayer[0]+byPlayer[1]) ===== */
{
  let allOk=true, firstOk=true, winnerOk=true, winTypes=new Set();
  for(let i=0;i<6;i++){
    const r=H.runSim(T,i%2?["dan5","grade5"]:["grade5","grade5"],100+i,{check:50});
    if(r.phase!=="over") allOk=false;
    if(r.viol.length){allOk=false; console.error("  viol:",r.viol.slice(0,5));}
    if(r.snap.firstPlayer!==0&&r.snap.firstPlayer!==1) firstOk=false;
    if(r.snap.winner!==r.winner||r.snap.total.winner!==r.winner) winnerOk=false;
    winTypes.add(r.winType);
    for(const k of T.PLAYER_METRIC_KEYS) if((r.snap.byPlayer[0][k]||0)+(r.snap.byPlayer[1][k]||0)!==(r.snap.total[k]||0)) allOk=false;
  }
  ok(allOk,"A1 sim 6판 완주·불변식·플레이어별 합 = 합산 지표");
  ok(firstOk,"A2 선공(firstPlayer) 저장");
  ok(winnerOk,"A3 승자 저장(metrics.winner = S.winner)");
  ok(S().metrics.minionEventUses===undefined&&S().metrics.minionSearches!==undefined,"A4 minionEventUses → minionSearches 명칭 변경");
  T.renderMetrics();
  const mh=T.els.metrics.innerHTML;
  ok(/하수인 탐색/.test(mh)&&!/하수인 이벤트/.test(mh),"A5 지표 표시 '하수인 탐색' (구 '하수인 이벤트' 제거)");
  ok(/선공/.test(mh)&&/승자/.test(mh)&&/적 포획 시도/.test(mh)&&/폭탄 이동/.test(mh)&&/함정 발동/.test(mh),"A6 지표 표시에 선공·승자·적 포획 시도·폭탄 이동·함정 발동");
  ok(/AI-1\(5급\)/.test(mh)&&/AI-2\(5급\)/.test(mh)||/AI-1\(5단\)/.test(mh),"A7 플레이어별 지표 행 표시");
}

/* ===== B. #20-2 battleRefusals 오탐 제거 ===== */
{
  const refusals=()=>S().metrics.battleRefusals;
  // B1: 내 하수인이 공개된 적 하수인과 인접 + 전투 안 함 → 회피 1
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  let m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  let k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,m,7,4); H.place(T,e,6,4); H.place(T,k0,13,1); H.place(T,k1,1,7);
  T.S.mainUsed=true; T.endTurn();
  ok(refusals()===1&&S().metrics.byPlayer[0].battleRefusals===1,"B1 canBattle 가능한 인접 대상 무시 → 회피 1 (P1 귀속)");
  // B2: 내 폭탄만 적과 인접 → 회피 아님
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  let b=T.S.pieces.find(x=>x.owner===0&&x.type==="bomb"); e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"); k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,b,7,4); H.place(T,e,6,4); H.place(T,k0,13,1); H.place(T,k1,1,7);
  T.S.mainUsed=true; T.endTurn();
  ok(refusals()===0,"B2 폭탄만 인접 → 회피 미집계");
  // B3: 왕 vs 왕만 인접 → #122 REVISE(2026-09-10 CJ QA 6)로 불가침이 폐지돼 이제 **전투 가능** = 회피로 집계된다
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"); k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"); H.place(T,m,13,7);
  H.place(T,k0,7,4); H.place(T,k1,6,4);
  T.S.mainUsed=true; T.endTurn();
  ok(refusals()===1,"B3 왕 vs 왕 인접 → 전투 가능(불가침 폐지)이므로 회피 집계 (#122 CJ QA 6)");
  // B4: 전투를 이미 했으면 회피 아님
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"); e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"); k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,m,7,4); H.place(T,e,6,4); H.place(T,k0,13,1); H.place(T,k1,1,7);
  T.S.mainUsed=true; T.S.battlesUsed=1; T.endTurn();
  ok(refusals()===0,"B4 전투 수행 턴은 회피 미집계");
}

/* ===== C. #20-3 적 포획 예비 하수인 HP 70/100, 숲 포획 100/100, UI 표기 ===== */
{
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  const k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,m,7,4); H.place(T,e,6,4); H.place(T,k0,13,1); H.place(T,k1,1,7);
  H.place(T,T.S.pieces.filter(x=>x.owner===1&&x.type==="minion")[1],2,1); // 전멸 방지
  T.startRounds(m,e,m,e);
  T.finishByCapture("A");
  const rs=T.S.reserve[0];
  ok(rs&&rs.hp===70&&rs.maxHp===100,"C1 finishByCapture 예비 하수인 HP 70/maxHP 100");
  ok(!e.alive&&S().metrics.enemyCaptures===1&&S().metrics.byPlayer[0].enemyCaptures===1,"C2 적 포획 제거·지표 P1 귀속");
  T.renderSide();
  ok(/예비 하수인\([^)]*\) HP 70\/100/.test(T.els.sidePanel.innerHTML),"C3 예비 슬롯 배지 'HP 70/100' 표기");
  // 숲 공용 포획 100/100
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const a=T.S.pieces.find(x=>x.owner===0&&x.type==="ally"); H.place(T,a,9,3);
  H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.S.balls[0]=3; const r=T.tryCapture(a,"safe");
  ok(r.ok&&a.cap.hp===100&&a.cap.maxHp===100&&S().metrics.captures===1&&S().metrics.byPlayer[0].captures===1,"C4 숲 공용 포획(tryCapture) 100/100 유지·중립 포획 성공 지표");
  T.S.balls[0]=1; T.setSeed(null); global.Math.random=()=>0.99; const r2=T.tryCapture(a,"risky"); global.Math.random=realRandom;
  ok(!r2.ok&&S().metrics.captureFails===1&&S().metrics.byPlayer[0].captureFails===1,"C5 중립 포획 실패 지표");
  // 출전 선택 모달 라벨
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const a2=T.S.pieces.find(x=>x.owner===0&&x.type==="ally"), e2=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,a2,7,4); H.place(T,e2,6,4); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.S.reserve[0]={element:"fire",hp:70,maxHp:100,atk:20,skillAtk:30,cd:0,cdMax:2,skills:["fire_stable","fire_effect","sup_heal","sig_std"],cds:[0,0,0,0],revealedSkills:[]};
  T.vipChoice(a2,e2);
  const btnTxt=T.els.obBtns.children.map(b=>b.textContent).join("|");
  ok(/예비 하수인\(불\) HP 70\/100 대리 출전/.test(btnTxt),"C6 출전 선택 UI에 '예비 하수인 HP 70/100' 명시 ("+btnTxt+")");
  T.S.battle=null; T.TQ.length=0;
}

/* ===== D. #20-4 탐색 실행 가능 말 경계 (minion/ally/king만) ===== */
{
  const setup=(type)=>{
    H.freshPlay(T,"pvp"); H.clearBoard(T);
    const p=T.S.pieces.find(x=>x.owner===0&&x.type===type);
    H.place(T,p,9,3); if(type!=="king") H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
    H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
    /* #121 계약 1.1 (v0.4.7 승인): 이벤트 종류가 6종 → itemGift·battleBuff·recruit 3종으로 바뀌었다.
       옛 "buff"(다음 전투 공격 +15%)는 계약 1.3 으로 **대체 보상 없이 폐기**됐다 — 여기서는 현행 종류를 쓴다 */
    T.S.events=[{r:9,c:3,kind:"battleBuff",consumed:false}]; T.S.traces[0].add("9_3");
    return {p,ev:T.S.events[0]};
  };
  for(const type of ["bomb","trap"]){
    const {p,ev}=setup(type);
    ok(!T.canSearchPiece(p),"D1 canSearchPiece("+type+")=false");
    const r=T.doSearch(p,ev);
    ok(r===false&&!ev.consumed&&!T.S.mainUsed&&S().metrics.searches===0&&T.S.pkgs[0].battleBuff===0,"D2 "+type+" doSearch 거부 (이벤트·주행동·지표·패키지 재고 미변경)");
  }
  for(const type of ["minion","ally","king"]){
    const {p,ev}=setup(type);
    ok(T.canSearchPiece(p),"D3 canSearchPiece("+type+")=true");
    T.doSearch(p,ev);
    /* #121 계약 1.3: 탐색으로 `nextBattleBuff`(다음 전투 공격 +15%)를 **더 이상 얻을 수 없다**. 대신 계약 2·3 의
       패키지 재고가 +1 되고, 실제 내용 선택(개봉)은 전투 중 가방에서 한다. 옛 단언보다 약해지지 않도록
       "폐기된 보상이 켜지지 않는다"까지 함께 본다 (음성 조건). */
    ok(ev.consumed&&T.S.mainUsed&&S().metrics.searches===1&&S().metrics.byPlayer[0].searches===1
       &&T.S.pkgs[0].battleBuff===1&&!p.nextBattleBuff,"D4 "+type+" 탐색 실행·전투 버프 패키지 +1·지표 · 폐기된 일시버프 미부여");
    ok(S().metrics.minionSearches===(type==="minion"?1:0),"D5 "+type+" 하수인 탐색 카운트 "+(type==="minion"?"1":"0"));
  }
  // 폭탄이 이벤트 칸에 이동해 흔적 발견은 가능 (탐색 버튼만 불가)
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const b=T.S.pieces.find(x=>x.owner===0&&x.type==="bomb"); H.place(T,b,11,3);
  H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.S.events=[{r:10,c:3,kind:"itemGift",consumed:false}]; // #121 계약 1.1: 옛 "ball" 종류는 폐기 — 흔적 발견은 종류와 무관
  T.doMove(b,10,3);
  ok(T.S.traces[0].has("10_3")&&S().metrics.bombMoves===1&&S().metrics.byPlayer[0].bombMoves===1,"D6 폭탄 이동으로 흔적 발견 가능 + 폭탄 이동 지표");
  T.S.mainUsed=false; T.S.selected=b; T.render(); // 턴바 렌더: 탐색 버튼 비활성
  const tb=T.els.turnBar.children.find(x=>x.textContent==="탐색");
  ok(tb&&tb.disabled===true,"D7 폭탄 선택 시 탐색 버튼 비활성");
  // AI(5급·5단) — 폭탄만 흔적 위에 있으면 탐색하지 않음
  for(const lv of ["grade5","dan5"]){
    H.freshPlay(T,"sim",[lv,lv]); H.clearBoard(T);
    const bb=T.S.pieces.find(x=>x.owner===0&&x.type==="bomb"); H.place(T,bb,10,3);
    H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
    H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="minion"),12,5);
    T.S.events=[{r:10,c:3,kind:"recruit",consumed:false}]; T.S.traces[0].add("10_3");
    T.setSeed(7); if(lv==="dan5") T.aiMainStrong(0); else T.aiMain(0);
    ok(!T.S.events[0].consumed&&S().metrics.searches===0&&!bb.cap,"D8 AI("+lv+") 폭탄 위 흔적 탐색 실행 안 함·cap 미부여");
  }
}

/* ===== E. #20 함정 발동·왕 숲 체류·적 포획 시도/실패·도망 지표 ===== */
{
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), tr=T.S.pieces.find(x=>x.owner===1&&x.type==="trap");
  H.place(T,m,7,4); H.place(T,tr,6,4); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.initBattle(m,tr);
  ok(S().metrics.trapTriggers===1&&S().metrics.byPlayer[1].trapTriggers===1&&S().metrics.byPlayer[0].battles===1&&m.immobile===2,"E1 함정 발동 지표(함정 소유자 P2)·전투 지표(공격자 P1)");
  // 왕 숲 체류: 자기 턴 종료 시 자기 왕만
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,k0,10,4); H.place(T,k1,1,7); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="minion"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="minion"),2,1);
  T.S.mainUsed=true; T.endTurn(); // P1 턴 종료
  ok(S().metrics.kingForestTurns===1&&S().metrics.byPlayer[0].kingForestTurns===1,"E2 P1 턴 종료: P1 왕 숲 체류 +1");
  T.S.mainUsed=true; T.endTurn(); // P2 턴 종료 — P1 왕은 집계 안 됨
  ok(S().metrics.kingForestTurns===1&&S().metrics.byPlayer[1].kingForestTurns===0,"E3 P2 턴 종료: P1 왕 이중 집계 없음");
  // 적 포획 시도/실패
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m2=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), e2=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,m2,7,4); H.place(T,e2,6,4); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.S.balls[0]=2; e2.hp=20; T.startRounds(m2,e2,m2,e2);
  T.setSeed(null); global.Math.random=()=>0.99; window.__throwBall(); // 실패
  ok(S().metrics.enemyCapTries===1&&S().metrics.enemyCapFails===1&&S().metrics.enemyCaptures===0&&S().metrics.byPlayer[0].enemyCapTries===1,"E4 적 포획 시도 1·실패 1");
  T.S.battle=null; T.TQ.length=0; // 새 전투로 성공 케이스
  H.place(T,T.S.pieces.filter(x=>x.owner===1&&x.type==="minion")[1],2,1);
  T.S.battlesUsed=0; e2.hp=20; T.startRounds(m2,e2,m2,e2);
  global.Math.random=()=>0.01; window.__throwBall(); // 성공
  ok(S().metrics.enemyCapTries===2&&S().metrics.enemyCapFails===1&&S().metrics.enemyCaptures===1&&T.S.reserve[0].hp===70,"E5 적 포획 시도 2·성공 1·예비 HP 70");
  global.Math.random=realRandom;
  // 도망 시도/성공 (플레이어별)
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m3=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), e3=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,m3,7,4); H.place(T,e3,6,4); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  m3.hp=30; T.startRounds(m3,e3,m3,e3);
  global.Math.random=()=>0.01; window.__flee();
  ok(S().metrics.fleeTries===1&&S().metrics.fleeOks===1&&S().metrics.byPlayer[0].fleeTries===1&&S().metrics.byPlayer[0].fleeOks===1&&!T.S.battle,"E6 도망 시도·성공 P1 귀속");
  global.Math.random=realRandom;
  T.TQ.length=0;
}

/* ===== F. #21-3 관측 누수 제거 — 숨은 숲 내부 이동은 AI 기억에 기록되지 않음 ===== */
{
  H.freshPlay(T,"pve"); H.clearBoard(T);
  const e=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"); // 사람(0) 말이 AI(1) 관측 대상
  H.place(T,e,9,1); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
  H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="minion"),2,7);
  T.S.current=0; T.S.mainUsed=false;
  ok(!T.visibleTo(1,e),"F0 전제: 숲 속 말이 AI에게 비가시");
  T.doMove(e,10,1); // 숲 내부 이동 (전후 모두 비가시)
  ok(e.movedPreBT===true&&!T.aiSeenMoved(1,e)&&T.aiThreatOf(1,e)==="unknownStatic","F1 숨은 숲 내부 이동: movedPreBT는 참이지만 AI 기억(aiSeenMoved)에 미기록 → unknownStatic");
  T.S.mainUsed=false; T.doMove(e,11,1); // 숲→진영(공개 칸)으로 나옴: 목격
  ok(T.aiSeenMoved(1,e)&&T.aiThreatOf(1,e)==="unknownMoved","F2 공개 칸으로 나온 이동은 목격 → unknownMoved");
  // 공개 칸 → 숲 진입도 목격 (사라짐을 목격)
  H.freshPlay(T,"pve"); H.clearBoard(T);
  const e2=T.S.pieces.find(x=>x.owner===0&&x.type==="minion");
  H.place(T,e2,11,1); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
  H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="minion"),2,7);
  T.S.current=0; T.S.mainUsed=false; T.doMove(e2,10,1);
  ok(T.aiSeenMoved(1,e2),"F3 공개 칸에서 숲으로 들어가는 이동은 목격");
  // 5단·5급 모두 movedPreBT 직접 참조 없음 (소스 검사)
  const src=T.html;
  const aiSrc=src.slice(src.indexOf("/* ===== AI (공정 관측 휴리스틱"));
  const reads=(aiSrc.match(/\.movedPreBT/g)||[]).length;
  ok(reads===0,"F4 AI 코드 블록에 movedPreBT 참조 없음 (발견 "+reads+")");
}

/* ===== G. #21-4 시드 RNG 재현성 ===== */
{
  T.BAL.aiStrongBudgetMs=1e9; // 시간 상한 영향 제거
  const a=H.runSim(T,["dan5","grade5"],4242), b=H.runSim(T,["dan5","grade5"],4242);
  ok(JSON.stringify(a.snap)===JSON.stringify(b.snap)&&a.turns===b.turns&&a.winner===b.winner,"G1 동일 시드 5단 vs 5급 완전 재현 (턴 "+a.turns+" 승자 "+a.winner+")");
  const c=H.runSim(T,["grade5","grade5"],99), d=H.runSim(T,["grade5","grade5"],99);
  ok(JSON.stringify(c.snap)===JSON.stringify(d.snap),"G2 동일 시드 5급 vs 5급 재현");
  const e=H.runSim(T,["grade5","grade5"],100);
  ok(JSON.stringify(c.snap)!==JSON.stringify(e.snap),"G3 다른 시드는 다른 경기");
  T.setSeed(null);
  ok(typeof window.setSeed==="function"&&typeof window.metricsSnapshot==="function","G4 window.setSeed / metricsSnapshot 훅 노출");
}

/* ===== H. #21-1/2 난이도 선택·표기·완주·기능 사용 ===== */
{
  T.newGame("pvp"); T.S.phase="menu"; T.renderSide();
  const menu=T.els.sidePanel.innerHTML;
  ok(/5급/.test(menu)&&/5단/.test(menu)&&/탐색·추론 기반 강AI/.test(menu)&&!/학습 AI/.test(menu),"H1 PVE 시작 화면 5급·5단 선택 + '탐색·추론 기반 강AI' 문구, '학습 AI' 없음");
  ok(!/학습 AI/.test(T.html),"H2 HTML 전체에 '학습 AI' 문구 없음");
  T.startMode("pve",{aiLevel:"dan5"});
  ok(T.S.aiLevel[1]==="dan5"&&T.S.aiLevel[0]==="grade5"&&/5단/.test(T.S.log[0].msg),"H3 startMode('pve',{aiLevel:'dan5'}) → S.aiLevel=[grade5,dan5]");
  T.startMode("pve");
  ok(T.S.aiLevel[1]==="grade5","H4 기본 PVE는 5급");
  T.startMode("pvp"); ok(T.S.mode==="pvp"&&T.S.phase==="setup","H5 PVP 경로 유지");
  // 완주·불변식 (5급·5단 각각), 5단 기능 사용 집계
  T.BAL.aiStrongBudgetMs=120;
  const use={teleports:0,enemyCapTries:0,fleeTries:0,bombMoves:0,searches:0,battles:0,captures:0};
  let done=0, viol=0, thinkMax=0, thinkSum=0, thinkN=0;
  for(let i=0;i<8;i++){
    const lv=i%2?["grade5","dan5"]:["dan5","grade5"], me=i%2?1:0;
    const r=H.runSim(T,lv,900+i,{check:25});
    if(r.phase==="over") done++; if(r.viol.length){viol++; console.error("  viol",r.viol.slice(0,4));}
    for(const k in use) use[k]+=r.snap.byPlayer[me][k]||0;
    thinkMax=Math.max(thinkMax,r.thinkMax); thinkSum+=r.thinkAvg; thinkN++;
  }
  ok(done===8&&viol===0,"H6 5단 포함 sim 8판 완주·불변식 (완주 "+done+"/8, 위반 "+viol+")");
  console.error("  5단 기능 사용(8판 합):",JSON.stringify(use),"판단 ms 평균",(thinkSum/thinkN).toFixed(1),"최대",thinkMax);
  ok(use.battles>0&&use.searches>0&&use.bombMoves>0,"H7 5단 전투·탐색·폭탄 이동 사용");
  ok(use.teleports+use.enemyCapTries+use.fleeTries>0,"H8 5단 텔레포트/적 포획/도망 중 최소 1종 사용 (tele "+use.teleports+" cap "+use.enemyCapTries+" flee "+use.fleeTries+")");
  ok(thinkMax<=T.BAL.aiStrongBudgetMs*3,"H9 5단 판단 시간 상한 준수 (최대 "+thinkMax+"ms, 상한 "+T.BAL.aiStrongBudgetMs+"ms×3 허용)");
  // PVE 5급: 기본 프로파일(무작위) · 5단: 고정 프로파일
  H.freshPlay(T,"pve",["grade5","dan5"]); const pf=T.aiProf(1);
  ok(pf.eps===0&&pf.aggression===1,"H10 5단 고정 프로파일(ε=0)");
  H.freshPlay(T,"pve",["grade5","grade5"]); const pg=T.aiProf(1);
  ok(pg.eps>=0.05&&pg.eps<=0.15,"H11 5급 무작위 프로파일 유지");
}

/* ===== I. #21-3 공정 관측 — 숨은 적 정체 치환 불변성 (AI 결정이 비가시·미공개 말의 정체·이동 이력에 의존하지 않음) ===== */
{
  T.BAL.aiStrongBudgetMs=1e9;
  function deepClone(v){ if(v instanceof Set) return new Set(v); if(Array.isArray(v)) return v.map(deepClone);
    if(v&&typeof v==="object"){const o={}; for(const k in v) o[k]=deepClone(v[k]); return o;} return v; }
  function outcome(){ const s=T.S; return JSON.stringify({pos:s.pieces.filter(x=>x.owner===s.current).map(x=>[x.id,x.r,x.c,x.placed]),main:s.mainUsed,tele:s.teleUsed,ev:s.events.map(e=>e.consumed),ft:s.forcedTargets,fq:s.forcedQueue,last:s.log[s.log.length-1].msg});}
  function permuteHidden(me){ // 미공개 적 말(가시 여부 무관, 왕 제외 — 왕 vs 왕 불가침은 엔진 canBattle이 사람에게도 노출)의 정체·cap·버프·이동 이력을 서로 치환
    const hid=T.S.pieces.filter(x=>x.owner!==me&&x.alive&&x.placed&&!x.revealed&&x.type!=="king");
    if(hid.length<2) return false;
    const keys=["type","element","hp","maxHp","atk","skillAtk","rosterId","name","cdMax","cd","skills","cds","revealedSkills","cap","nextBattleBuff","movedPreBT","movedEver"];
    const vals=hid.map(x=>Object.fromEntries(keys.map(k=>[k,x[k]])));
    const idx=hid.map((_,i)=>i); for(let i=idx.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1)); [idx[i],idx[j]]=[idx[j],idx[i]];}
    hid.forEach((x,i)=>{ for(const k of keys) x[k]=vals[idx[i]][k]; });
    return true;
  }
  const res={grade5:{n:0,diff:0,tele:0},dan5:{n:0,diff:0,tele:0}};
  for(const lv of ["grade5","dan5"]){
    for(let g=0;g<3;g++){
      // 중반 상태 표본: sim을 일정 스텝 진행한 뒤 AI 주 행동 직전 상태를 복제
      T.setSeed(500+g); T.TQ.length=0; T.startMode("sim",[lv,lv]);
      let steps=0, elig=0, samples=0;
      while(T.TQ.length&&T.S.phase==="play"&&steps<6000&&samples<150){
        const eligible=T.S.phase==="play"&&!T.S.battle&&!T.S.mainUsed&&!(T.S.forcedTargets&&T.S.forcedTargets.length)&&T.S.turnCount>=6;
        if(!eligible||(elig++%3)!==0){ T.TQ.shift()(); steps++; continue; }
        steps++; samples++;
        const me=T.S.current, base=deepClone(T.S), q=T.TQ.splice(0);
        const run=()=>{ T.setSeed(777); (lv==="dan5"?T.aiMainStrong:T.aiMain)(me); const o=outcome(); return o; };
        const o1=run();
        T.S=deepClone(base); if(!permuteHidden(me)){ T.S=base; T.TQ.push(...q); continue; }
        const o2=run();
        res[lv].n++; if(o1!==o2){res[lv].diff++; if(/텔레포트 스왑 차단/.test(o1+o2)) res[lv].tele++; else if(res[lv].diff<=2) console.error("  ["+lv+"] 결정 차이:",o1.slice(0,160),"\n      vs",o2.slice(0,160));}
        T.S=base; T.TQ.push(...q);
      }
    }
    console.error("  ["+lv+"] 치환 불변성 표본",res[lv].n,"차이",res[lv].diff,"(텔레포트 차단 기인",res[lv].tele+")");
  }
  ok(res.dan5.n>=20&&res.dan5.diff-res.dan5.tele===0,"I1 5단 결정은 숨은 적 정체·이동 이력 치환에 불변 (표본 "+res.dan5.n+", 차이 "+res.dan5.diff+")");
  ok(res.grade5.n>=20&&res.grade5.diff-res.grade5.tele===0,"I2 5급 결정은 숨은 적 정체·이동 이력 치환에 불변 (표본 "+res.grade5.n+", 차이 "+res.grade5.diff+")");
  T.setSeed(null); T.BAL.aiStrongBudgetMs=120;
}

/* ===== J. 레거시 규칙 회귀 (이동·상성·폭탄·함정·밀어내기·왕 불가침·판정) ===== */
{
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  const tr=T.S.pieces.find(x=>x.owner===0&&x.type==="trap");
  H.place(T,m,7,4); H.place(T,k0,13,1); H.place(T,k1,1,7); H.place(T,tr,12,2);
  ok(T.canMoveTo(m,6,4)&&T.canMoveTo(m,7,5)&&!T.canMoveTo(m,5,4)&&!T.canMoveTo(m,6,5),"J1 1칸 직교 이동만");
  ok(!T.canMoveTo(tr,11,2),"J2 함정 이동 불가");
  ok(T.BEATS.fire==="grass"&&T.BEATS.grass==="lightning"&&T.BEATS.lightning==="water"&&T.BEATS.water==="fire","J3 상성 순환");
  const e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion"); H.place(T,e,6,4);
  ok(T.canBattle(m,e)&&T.canBattle(k0,k1),"J4 전투 가능 · 왕 vs 왕도 전투 가능 (#122 CJ QA 6 불가침 폐지)");
  // 폭탄: 하수인 동귀
  const b=T.S.pieces.find(x=>x.owner===1&&x.type==="bomb"); H.place(T,b,7,5);
  T.initBattle(m,b);
  ok(!m.alive&&!b.alive&&S().metrics.bombHitsMinion===1&&S().metrics.byPlayer[1].bombHitsMinion===1,"J5 폭탄 vs 하수인 동귀·지표(폭탄 소유자 P2)");
  // 밀어내기
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const a0=T.S.pieces.find(x=>x.owner===0&&x.type==="ally"), a1=T.S.pieces.find(x=>x.owner===1&&x.type==="ally");
  H.place(T,a0,7,4); H.place(T,a1,6,4); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.S.mode="sim"; T.doPush(a0,a1);
  ok(a1.r===5&&S().metrics.pushes===1&&S().metrics.byPlayer[0].pushes===1,"J6 밀어내기 1칸·지표");
  // 판정: 유효 피해 비율
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m1=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), m2=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,m1,7,4); H.place(T,m2,6,4); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  // #106 T6: 판정은 남은 HP 비율(hp/maxHp) — 누적 유효 피해(recA/recD)는 지표로만 남는다. 옛 규칙이면 D 승(recD 40 > recA 10)이지만 새 규칙은 A 100% > D 60% 로 A 승
  T.startRounds(m1,m2,m1,m2); T.S.battle.recA=10; T.S.battle.recD=40; m2.hp=60; T.judge();
  ok(!m2.alive&&m1.alive&&S().metrics.judged===1&&S().metrics.attackerWins===1,"J7 판정 승 (공격측) — #106 남은 HP 비율 기준 (recA/recD 무관)");
  T.TQ.length=0;
}

console.log(`\n=== smoke_cycle5: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
