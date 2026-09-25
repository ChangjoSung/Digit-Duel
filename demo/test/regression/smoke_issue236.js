/* #236 경제 — 시작·정기 상점 · 성장 · 가방 · 원장 · 수풀 코인 · 전투 포획 · B08 · 티켓 · 공정 관측 · 경기 종료 우선 계약 검사
   실행: node demo/test/regression/smoke_issue236.js [demo/index.html]
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전). 근거: GDD-23 2.1~2.4 · 7장 · docs/milestone/v0.4.11/issues/236/Venus/report.md AC01~AC43.

   절 (AC 번호는 Venus 보고서 9장)
     A  S01 시작 상점 — 🪙10·지급 0·6칸 진열·산 칸 SOLD OUT·필드→가방·예비 재화·완료·S01 전용 품목·속성·시간 초과 (AC01~08 · AC44 · AC45 · #263)
     S  상점 시너지 현황 — S01 미리보기·정기 실제 집계·죽은 동료·갱신 시점·소유자 전용 (AC46~AC48 · 5차 E16)
     B  정기 상점 시점 — 20·40·60·80턴 보너스·경기 종료 우선·보드 잠금·순서 (AC09~11 · AC39 · AC40)
     C  진열 — 등급 확률·제외·후보 고갈·새로 고침 (AC12~15)
     D  승급·합성·동종 1마리·사망 종 재구매 (AC16~20)
     E  가방·교체·전멸·공개 표식 (AC21~23)
     F  판매·원장·판매 잠금·HP 비율·차익 없음 (AC24~27)
     G  수풀 코인 (AC28)
     H  전투 보상·포획·B08 (AC29~33)
     J  대리 출전 (AC34) · K 티켓 (AC35) · L 중복·거부 무변경 (AC36)
     M  AI 공정 관측·완주 (AC37) · N 비공개 (AC38) · O 온라인 경계 (D3 · AC41)
     Q  상점 90초 — PVE·핫시트 좌석마다 표시 순간부터 · 가림 불산입 · 만료 · 누수 없음 (AC39 · AC40 · 2026-09-24 CJ D1)
   모든 거래 거부는 "코인·원장·HP·가방·진열 불변"을 함께 본다. */
"use strict";
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(got===want,name+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }

const load=()=>H.load(htmlPath);
const E=T=>T.S.eco;
const act=(T,a)=>T.dispatchCoreAction(a);
const kind=r=>r&&r.events&&r.events[0]&&r.events[0].type;
/* 거래가 건드릴 수 있는 칸 전부의 지문 — 거부 뒤 이것이 그대로여야 한다 */
const ecoSig=T=>JSON.stringify({eco:E(T),inv:T.S.inv,balls:T.S.balls,pieces:T.S.pieces.map(p=>[p.id,p.rosterId,p.legend,p.grade,p.hp,p.maxHp,p.paid,p.alive,p.element,p.revealed])});
function refusedClean(T,a,name){ const before=ecoSig(T), r=act(T,a); ok(kind(r)==="shopRefused"&&ecoSig(T)===before,name); return r; }
const field=(T,p)=>T.S.pieces.filter(x=>x.owner===p&&x.type==="minion");
/* 테스트 가방 말 — 실제 생성 경로(applySpecies / applyLegend)로 만든다 */
function unit(T,key,grade,paid){
  const u={uid:++E(T).unitSeq,paid:paid||0,fresh:false,revealed:false,reaperSeal:0,cap:null};
  const L=T.LEGEND_ROSTER.find(x=>x.id===key);
  if(L) T.applyLegend(u,L.key); else T.applySpecies(u,T.ROSTER.find(r=>r.id===key),grade);
  return u;
}
function pveSetup(seed){ const T=load(); T.setSeed(seed); T.startMode("pve",{aiLevel:"grade5"}); T.TQ.length=0; return T; }
/* S01 → 배치 → 경기 시작 (PVE). 사람 차례 0 으로 고정하고 예약된 AI 수는 버린다 */
function pvePlay(seed){
  const T=pveSetup(seed);
  act(T,{t:"shopTimeout",player:0}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  const S=T.S; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; S.movedPiece=null; T.TQ.length=0;
  return T;
}
function hotseatPlay(seed){
  const T=load(); T.setSeed(seed); T.startMode("pvp");
  act(T,{t:"shopTimeout",player:0}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  act(T,{t:"shopTimeout",player:1}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  const S=T.S; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; T.TQ.length=0;
  return T;
}
/* turn 번째 턴이 막 끝나게 만든다 (S.turnCount = turn-1 에서 endTurn) */
function endTurnAt(T,turn){ const S=T.S; S.phase="play"; S.battle=null; S.fleePick=null; S.teleport=null; S.forcedTargets=[]; S.forcedQueue=[]; S.turnCount=turn-1; return act(T,{t:"endTurn"}); }
const ownKeys=(T,p)=>T.S.pieces.filter(x=>x.owner===p&&x.type==="minion"&&x.alive&&T.ecoKey(x)).map(T.ecoKey).concat(E(T).bag[p].map(T.ecoKey));
const uniqueOwned=(T,p)=>{ const k=ownKeys(T,p); return new Set(k).size===k.length; };
/* 진열을 직접 세운다 (그 오픈의 상태) — 규칙 경로는 그대로 reducer 가 판정한다 */
function setSlots(T,p,slots){ E(T).shop.slots[p]=slots.map(s=>s?{key:s[0],grade:s[1]}:null); }

/* ===== A. S01 시작 상점 ===== */
{
  const T=pveSetup(11), S=T.S;
  const G=load(); G.newGame("pve",{eco:true}); const S0=G.S; // 지급 시점 — startMode 는 AI S01 을 곧바로 끝내므로(2.3) 그 전 상태를 본다
  ok(!!S0.eco&&S0.eco.coins[0]===10&&S0.eco.coins[1]===10,"AC01 로컬 새 경기: 양측 🪙10");
  ok(S0.inv[0].length===0&&S0.inv[1].length===0&&S0.balls[0]===0&&S0.balls[1]===0,"AC01 소모품·볼 지급 0");
  ok(S.eco.coins[0]===10&&S.inv[0].length===0&&S.balls[0]===0,"AC01 사람 S01 은 🪙10·지급 0 그대로 열린다");
  ok(S.eco.bag[0].length===0&&S.reserve[0]===null&&S.pieces.every(p=>!p.cap),"AC01 가방 비어 있음 · 예비·cap 경로 미사용");
  ok(S.phase==="setup"&&S.eco.shop&&S.eco.shop.kind==="start","S01 은 배치 전 setup 단계에 열린다");
  const sl=S.eco.shop.slots[0];
  ok(sl.length===6&&sl.every(s=>s&&s.grade===1)&&new Set(sl.map(s=>s.key)).size===6&&sl.every(s=>T.ROSTER.some(r=>r.id===s.key)),"AC02 진열 6칸 = 서로 다른 ⭐1 일반 종 (#263)");
  const k0=sl[0].key, seq0=S.eco.shop.seq[0];
  const r=act(T,{t:"shopBuy",player:0,i:0,seq:seq0});
  const f0=field(T,0)[0];
  ok(kind(r)==="shopChanged"&&E(T).coins[0]===9&&f0.rosterId===k0&&f0.grade===1&&f0.paid===1&&f0.fresh===true,"AC02·AC03 구매 → 🪙1 차감 · 첫 필드 칸 · 원장 1 · 신규 표시");
  const nsl=E(T).shop.slots[0];
  ok(nsl.length===6&&nsl[0]&&nsl[0].soldOut&&nsl[0].key===k0&&JSON.stringify(nsl.slice(1))===JSON.stringify(sl.slice(1)),
    "AC44/#263 산 칸은 SOLD OUT 으로 남고(비지 않는다) 나머지 칸은 그대로 — 즉시 보충 없음");
  ok(E(T).shop.seq[0]===seq0+1,"구매마다 진열 번호 +1");
  refusedClean(T,{t:"shopBuy",player:0,i:1,seq:seq0},"AC36 지난 진열 번호로 온 구매는 거부 · 상태 불변");
  refusedClean(T,{t:"shopBuy",player:0,i:0,seq:E(T).shop.seq[0]},"AC44/#263 품절 칸 재구매 거부 · 상태 불변");
  for(let n=1;n<6;n++) act(T,{t:"shopBuy",player:0,i:n,seq:E(T).shop.seq[0]});
  ok(E(T).shop.slots[0].length===6&&E(T).shop.slots[0].every(s=>s&&s.soldOut)&&T.ecoBuyable(T.S,0)===-1&&E(T).coins[0]===4&&T.ecoEmptyField(T.S,0).length===0,
    "AC44/#263 6칸을 다 사면 6칸 모두 SOLD OUT · 살 칸 0 · 필드 6칸 (새로 고침 없이 완결)");
  ok(kind(act(T,{t:"shopRefresh",player:0,seq:E(T).shop.seq[0]}))==="shopChanged"&&E(T).coins[0]===3,"AC44 수동 새로 고침 🪙1 — 품절이 다시 채워지는 유일한 길");
  const rsl=E(T).shop.slots[0];
  ok(rsl.every(s=>s&&s.grade===1&&!s.soldOut&&!ownKeys(T,0).includes(s.key))&&new Set(rsl.map(s=>s.key)).size===6,"AC44 새로 고침 진열 = 서로 다른 미보유 ⭐1 6칸");
  for(let n=0;n<3;n++) act(T,{t:"shopBuy",player:0,i:n,seq:E(T).shop.seq[0]});
  ok(E(T).bag[0].length===3&&E(T).coins[0]===0&&E(T).bag[0].every(u=>u.grade===1&&u.paid===1&&u.fresh),"AC03 7번째부터 가방 3칸");
  E(T).coins[0]=1; refusedClean(T,{t:"shopBuy",player:0,i:3,seq:E(T).shop.seq[0]},"AC03 가방 3칸 초과 신규 구매 거부 · 상태 불변");
  ok(uniqueOwned(T,0),"AC19 S01 에서도 같은 종 2마리 없음");
  ok(T.S.roster[0].length===6&&T.S.roster[0].every((k,i)=>field(T,0)[i].rosterId===k),"S01 산 필드가 배치 로스터와 같은 순서로 이어진다");
}
{ /* AC04 예비 재화 — 필수(k, v) = k + ⌈max(0, k − v) ÷ 6⌉. #263: 진열 6칸 = 필드 6칸이라 시작 필수는 곧 빈 칸 수다 */
  const T=pveSetup(12);
  eq(T.ecoReserveNeed(T.S,0),6,"AC04/#263 시작 🪙10·k=6·v=6 → 필수 6 (빈 칸 수만큼)");
  { const T2=pveSetup(12); ok(kind(act(T2,{t:"shopRefresh",player:0,seq:E(T2).shop.seq[0]}))==="shopChanged","AC04 볼 0개일 때 k=6 새로 고침 허용 (🪙9 ≥ 6)"); }
  for(let n=0;n<4;n++) ok(kind(act(T,{t:"shopGood",player:0,item:"ball"}))==="shopChanged","AC04 k=6 볼 "+(n+1)+"번째 허용");
  refusedClean(T,{t:"shopGood",player:0,item:"ball"},"AC04 k=6 볼 5번째 거부 (지출 뒤 🪙5 < 6) · 상태 불변");
  refusedClean(T,{t:"shopRefresh",player:0,seq:E(T).shop.seq[0]},"AC04 k=6 새로 고침 거부 (지출 뒤 🪙5 < 필수(6, 6)=6)");
  act(T,{t:"shopBuy",player:0,i:0,seq:E(T).shop.seq[0]});
  eq(E(T).coins[0]-T.ecoReserveNeed(T.S,0),0,"AC04 하수인 구매는 🪙·k·v 를 함께 1 줄여 여유(🪙 − 필수)는 그대로");
  refusedClean(T,{t:"shopGood",player:0,item:"potion"},"AC04 여유 0 이면 소모품 거부");
  eq(T.S.balls[0],4,"AC04 확정된 볼 4개 보존");
  /* AC05·AC06 */
  refusedClean(T,{t:"shopDone",player:0},"AC05 필드 5칸 이하면 완료 거부");
  refusedClean(T,{t:"shopGood",player:0,item:"ticket"},"AC06 S01 에서 티켓 거부");
  for(const k of ["power","time","escape"]) refusedClean(T,{t:"shopGood",player:0,item:k},"AC06 S01 에서 전투 버프 거부: "+k);
  /* AC07 속성 */
  const king=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), allies=T.S.pieces.filter(x=>x.owner===0&&x.type==="ally");
  ok(kind(act(T,{t:"leaderEl",player:0,pieceId:king.id,el:"land"}))==="shopChanged"&&king.element==="land"&&king.leaderElChosen&&king.skills[1]==="K-2-land","AC07 왕 속성 무료 선택 — 스킬 칸도 그 속성");
  refusedClean(T,{t:"shopTicket",player:0,pieceId:king.id,el:"fire"},"AC35 S01 에서 티켓 사용 거부");
  /* AC08 시간 초과 — 필드 1칸 산 상태 */
  const slot0=E(T).shop.slots[0][T.ecoBuyable(T.S,0)].key;
  act(T,{t:"shopTimeout",player:0});
  const S=T.S, seqAtTimeout=S.eco.shop.seq[0], cnt={}; for(const m of field(T,0)) cnt[m.element]=(cnt[m.element]||0)+1;
  const top=Math.max(...T.V2_ELEM_ORDER.map(el=>cnt[el]||0)), tied=T.V2_ELEM_ORDER.filter(el=>(cnt[el]||0)===top);
  ok(T.ecoEmptyField(S,0).length===0&&S.eco.shop.done[0]&&field(T,0)[1].rosterId===slot0,"AC08 시간 초과 → 노출된 적격 칸을 ①부터 자동 구매 · 6칸 · 완료");
  ok(S.eco.shop.slots[0].every(s=>s&&s.soldOut),"AC08/#263 자동 구매한 칸도 SOLD OUT 으로 남는다 (자동 새로 고침 0회)");
  eq(S.balls[0],4,"AC08 확정 거래(볼) 보존");
  ok(S.eco.coins[0]>=0,"AC08 코인 음수 없음");
  ok(king.element==="land"&&new Set(allies.map(a=>a.element)).size===1&&tied.includes(allies[0].element),
    "AC07/#263 고른 속성은 유지 · 안 고른 동료는 공동 1위 왕국 중 하나를 셋이 함께 받는다(난수 1회)");
  ok(S.pieces.filter(x=>x.owner===0).every(x=>x.placed&&T.zoneOf(0).includes(x.r)&&x.c>=1&&x.c<=7),
    "AC08/#263 시간 초과 좌석은 모든 말이 자기 진영 합법 위치에 자동 배치된다");
  refusedClean(T,{t:"shopGood",player:0,item:"ball"},"AC05 완료 뒤 모든 S01 거래 거부");
  ok(field(T,0).every(m=>!m.fresh),"S01 완료로 신규 표시 해제");
}
{ /* AC05 완료 허용 · 배치 → 경기 시작 (AI 도 같은 S01) */
  const T=pvePlay(13), S=T.S;
  ok(S.phase==="play"&&S.eco.shop===null,"S01 → 배치 → 경기 시작, 시작 상점은 닫힌다");
  ok(field(T,1).every(m=>m.rosterId&&m.grade===1)&&T.ecoEmptyField(S,1).length===0,"AI 도 S01 에서 ⭐1 6명을 산다");
  ok(S.eco.coins[1]<10&&S.eco.coins[1]>=0,"AI 의 S01 지출은 🪙10 안");
  ok(uniqueOwned(T,1),"AI 도 같은 종 2마리 없음");
}
{ /* 2.3 (Saturn REVISE M1): 사람 S01 이 열리는 순간 AI 는 이미 완료 — 사람 배치를 기다리지 않는다. 배치는 여전히 사람 뒤 */
  const T=pveSetup(13), S=T.S;
  ok(S.phase==="setup"&&S.eco.shop.kind==="start"&&S.eco.shop.done[0]===false,"2.3 사람 S01 은 열려 있다 (미완료)");
  ok(S.eco.shop.done[1]===true&&T.ecoEmptyField(S,1).length===0,"2.3 PVE AI S01 은 시작 즉시 완료 · 필드 6칸");
  ok(S.pieces.filter(x=>x.owner===1).every(x=>!x.placed),"2.3 AI 말 배치는 아직 없다 (사람 배치 뒤)");
  const T2=pveSetup(13); ok(JSON.stringify(T2.S.eco)===JSON.stringify(S.eco),"2.3 같은 시드 → 같은 AI 상점 결과");
}

{ /* AC08 필드 0칸 만료 · AC45 막힘 없음 불변식 (5차 · D9 — 2026-09-24 CJ 확정) */
  const T=pveSetup(14); act(T,{t:"shopTimeout",player:0});
  ok(E(T).shop.done[0]&&T.ecoEmptyField(T.S,0).length===0&&E(T).coins[0]===4&&E(T).shop.slots[0].every(s=>s&&s.soldOut),
    "AC08/#263 필드 0칸 만료 → 노출 6종 전부 구매 · 새로 고침 0회 · 🪙10−6=4 보존 · 6칸 모두 SOLD OUT");
  let lcg=7; const rnd=n=>{ lcg=(lcg*1103515245+12345)&0x7fffffff; return lcg%n; };
  let stuck=0, runs=0;
  for(let seed=0;seed<40;seed++){
    const X=pveSetup(300+seed), S=X.S, ld=S.pieces.filter(x=>x.owner===0&&(x.type==="king"||x.type==="ally"));
    for(let n=0;n<30&&!S.eco.shop.done[0];n++){
      const seq=S.eco.shop.seq[0], bag=S.eco.bag[0], fm=field(X,0).filter(m=>X.ecoKey(m)), pick=rnd(7);
      const a=pick===0?{t:"shopRefresh",seq}:pick===1?{t:"shopGood",item:["potion","cool","cure","ball"][rnd(4)]}
        :pick===2?{t:"leaderEl",pieceId:ld[rnd(3)].id,el:["fire","water","lightning","land","grass"][rnd(5)]}
        :pick===3&&bag.length?{t:"shopSell",uid:bag[0].uid}:pick===4&&bag.length&&fm.length?{t:"shopSwap",pieceId:fm[rnd(fm.length)].id,uid:bag[0].uid}
        :{t:"shopBuy",i:rnd(6),seq};
      act(X,Object.assign({player:0},a));
      if(X.ecoEmptyField(S,0).length&&X.ecoBuyable(S,0)<0&&kind(X.reduceCoreAction(S,{t:"shopRefresh",player:0,seq:S.eco.shop.seq[0]}))!=="shopChanged") stuck++;
    }
    if(!S.eco.shop.done[0]) act(X,{t:"shopTimeout",player:0});
    if(S.eco.shop.done[0]&&X.ecoEmptyField(S,0).length===0&&S.eco.coins[0]>=0) runs++;
  }
  eq(stuck,0,"AC45 시드 40개 × 무작위 합법 요청 30회 — '빈 필드 > 0 · 살 칸 0 · 새로 고침 거부' 막힘 상태 없음");
  eq(runs,40,"AC45 무작위 요청 뒤 시간 초과까지 항상 필드 6칸 · 🪙 ≥ 0 · 완료");
  const A=pveSetup(15); ok(A.S.eco.shop.done[1]&&A.S.eco.coins[1]>=0&&A.S.eco.shop.slots[1].some(s=>s&&s.soldOut)&&A.ecoEmptyField(A.S,1).length===0,"AC45/#263 PVE AI S01 — 산 칸 SOLD OUT · 6칸 진열만으로 필드 6칸 완료");
}

/* ===== B. 정기 상점 시점 ===== */
{
  const T=pvePlay(21), S=T.S;
  const c0=S.eco.coins.slice();
  endTurnAt(T,19); ok(S.phase==="play"&&!S.eco.shop,"AC09 19턴 끝에는 열리지 않는다");
  S.current=0; T.TQ.length=0;
  const r=endTurnAt(T,20);
  ok(S.phase==="shop"&&S.eco.shop.kind==="regular"&&S.eco.shop.turn===20&&S.turnCount===20,"AC09 20턴 끝 → 정기 상점");
  eq(S.eco.coins[0],c0[0]+2,"AC09 사람 보너스 🪙+2");
  ok(S.eco.shop.done[1]===true,"AC40 PVE AI 는 상점을 즉시 처리");
  /* AC11 보드 잠금 */
  const mine=T.alivePieces().find(p=>p.owner===0&&p.type==="minion");
  ok(!T.canMoveTo(mine,mine.r-1,mine.c)&&T.reduceCoreAction(S,{t:"move",id:mine.id,r:mine.r-1,c:mine.c})===null,"AC11 상점 동안 이동 거부");
  const enemy=T.alivePieces().find(p=>p.owner===1);
  ok(T.reduceCoreAction(S,{t:"battleStart",attId:mine.id,defId:enemy.id})===null,"AC11 상점 동안 전투 거부");
  ok(T.reduceCoreAction(S,{t:"search",id:mine.id,r:mine.r,c:mine.c,ei:0}).events.length===0,"AC11 상점 동안 탐색 거부");
  const tc=S.turnCount; act(T,{t:"endTurn"}); eq(S.turnCount,tc,"AC11 상점 동안 turnCount 불변 (버닝 진입 턴 영향 없음)");
  act(T,{t:"shopDone",player:0});
  ok(S.phase==="play"&&!S.eco.shop&&S.turnCount===20&&S.current===1,"상점이 닫히면 미뤄 둔 다음 턴(상대)이 열린다");
  T.TQ.length=0;
  S.current=0; endTurnAt(T,21); ok(S.phase==="play","AC09 21턴 끝에는 열리지 않는다");
  for(const [t,b] of [[40,3],[60,4],[80,5]]){
    T.TQ.length=0; S.current=0; const c=S.eco.coins[0];
    endTurnAt(T,t); ok(S.phase==="shop"&&S.eco.shop.turn===t&&S.eco.coins[0]===c+b,`AC09 ${t}턴 → 보너스 🪙+${b} 후 상점`);
    act(T,{t:"shopDone",player:0});
  }
  T.TQ.length=0; S.current=0; endTurnAt(T,100); ok(S.phase==="play","AC09 80턴 뒤 추가 상점 없음 (100턴)");
  T.TQ.length=0;
}
{ /* AC10 · E15 — 20번째 턴의 전투로 왕 제거 → 상점·보너스 없이 종료 */
  const T=pvePlay(22), S=T.S;
  S.turnCount=19; const c0=S.eco.coins.slice();
  const att=T.alivePieces().find(p=>p.owner===0&&p.type==="minion"), king=S.pieces.find(p=>p.owner===1&&p.type==="king");
  T.startRounds(att,king,att,king); S.battle.fd.hp=0; T.checkDeath();
  ok(S.phase==="over"&&S.winner===0,"AC10 왕 제거로 경기 종료");
  act(T,{t:"endTurn"});
  ok(S.phase==="over"&&!S.eco.shop&&S.turnCount===19&&S.eco.coins[0]===c0[0]&&S.eco.coins[1]===c0[1],"AC10 경기 종료가 우선 — 상점·턴 보너스·전투 보상 없음");
}
{ /* AC39 핫시트 순서 — 20턴 P2 먼저 → 가림 → P1, 40턴은 P1 먼저 */
  const T=hotseatPlay(23), S=T.S;
  endTurnAt(T,20);
  ok(S.phase==="shop"&&S.eco.shop.active===1&&T.humanViewer()===1,"AC39 20턴 상점은 P2 먼저 (시점 = 지금 상점 쓰는 사람)");
  refusedClean(T,{t:"shopGood",player:0,item:"ball"},"AC39 차례 아닌 사람의 거래는 거부");
  const r=act(T,{t:"shopDone",player:1});
  ok(r.events.some(e=>e.type==="shopHandoff"&&e.player===0)&&S.eco.shop.active===0&&T.humanViewer()===0,"AC39 P2 완료 → 가림(핸드오프) → P1");
  refusedClean(T,{t:"shopGood",player:1,item:"ball"},"2.3 완료한 쪽은 다시 열 수 없다");
  act(T,{t:"shopDone",player:0});
  ok(S.phase==="play"&&S.current===1,"양측 완료 → 닫힘");
  S.current=0; endTurnAt(T,40);
  eq(S.eco.shop.active,0,"AC39 40턴 상점은 순서 교대 — P1 먼저");
  /* 리듀서 상태가 전역 S 와 달라도 순서는 받은 상태(mode)로 정해진다 */
  const alt=Object.assign({},S,{mode:"pve",phase:"play",turnCount:59,eco:Object.assign({},S.eco,{shop:null})});
  const res=T.reduceCoreAction(alt,{t:"endTurn"});
  ok(res.state.phase==="shop"&&res.state.eco.shop.active===null&&S.eco.shop.active===0,"상점 오픈 판정은 reducer 가 받은 상태만 읽는다 (전역 S 무관)");
}

/* ===== C. 진열 ===== */
{
  const T=pvePlay(31), S=T.S; T.setSeed(31);
  const probe=turn=>{ const st={eco:Object.assign({},S.eco),pieces:S.pieces}; const out=[];
    for(let n=0;n<400;n++){ T.ecoOpenShop(st,"regular",turn); for(const s of st.eco.shop.slots[0]) if(s) out.push(s); } return {st,out}; };
  const d20=probe(20).out, low=d20.filter(s=>s.grade===1).length/d20.length;
  ok(d20.length>1900&&low>0.56&&low<0.64,`AC12 20턴 낮은 등급 약 60% (실측 ${(low*100).toFixed(1)}%)`);
  const d80=probe(80).out, legends=d80.filter(s=>s.grade===5);
  ok(legends.length>0&&legends.every(s=>T.LEGEND_ROSTER.some(L=>L.id===s.key))&&d80.every(s=>s.grade===4||s.grade===5),"AC12 80턴 높은 등급 = 전설 3종 중 하나");
  ok(d80.every(s=>s.grade!==5||T.ecoPrice(5)===10),"전설 가격 🪙10");
  /* AC13 제외 */
  const f=field(T,0);
  T.applySpecies(f[0],T.ROSTER.find(r=>r.id===f[0].rosterId),3);
  T.applySpecies(f[1],T.ROSTER.find(r=>r.id===f[1].rosterId),4);
  S.eco.bag[0]=[unit(T,"L-DRAGON",5,10)];
  const p40=probe(40).out, p20=probe(20).out, p80=probe(80).out;
  ok(!p20.some(s=>s.key===f[0].rosterId)&&p40.filter(s=>s.key===f[0].rosterId).every(s=>s.grade===3),"AC13 내 ⭐3 종의 ⭐2 이하는 진열되지 않는다");
  ok(![...p20,...p40,...p80].some(s=>s.key===f[1].rosterId),"AC13 최대 등급(⭐4) 종은 진열되지 않는다");
  ok(!p80.some(s=>s.key==="L-DRAGON"),"AC13 보유 전설은 진열되지 않는다");
  ok((()=>{ const st={eco:Object.assign({},S.eco),pieces:S.pieces}; for(let n=0;n<200;n++){ T.ecoOpenShop(st,"regular",40); const k=st.eco.shop.slots[0].filter(Boolean).map(s=>s.key); if(new Set(k).size!==k.length) return false; } return true; })(),"AC13 한 진열에 같은 종 1번");
  /* AC14 후보 고갈 */
  S.eco.bag[0]=T.LEGEND_ROSTER.map(L=>unit(T,L.id,5,10));
  const p80b=probe(80).out; ok(p80b.length>0&&p80b.every(s=>s.grade===4),"AC14 전설 3종 모두 보유 → ⭐4 로 다시 뽑는다");
  const st={eco:Object.assign({},S.eco,{coins:[5,5]}),pieces:S.pieces,phase:"shop",mode:"pve",setupPlayer:0,inv:S.inv,balls:S.balls,roster:S.roster};
  T.ecoOpenShop(st,"regular",80);
  st.eco.shop.sold[0]=T.ROSTER.map(r=>r.id).concat(T.LEGEND_ROSTER.map(L=>L.id));
  const res=T.reduceCoreAction(st,{t:"shopRefresh",player:0,seq:st.eco.shop.seq[0]});
  ok(res.state.eco.shop.slots[0].every(s=>s===null)&&res.state.eco.coins[0]===4,"AC14 두 등급 모두 후보가 없으면 빈칸 (새로 고침도 같은 규칙)");
  ok(kind(T.reduceCoreAction(res.state,{t:"shopBuy",player:0,i:0,seq:res.state.eco.shop.seq[0]}))==="shopRefused","AC14 빈칸 구매 거부");
}
{ /* AC15 새로 고침 */
  const T=pvePlay(32), S=T.S; endTurnAt(T,20);
  const c=S.eco.coins[0], seq=S.eco.shop.seq[0];
  act(T,{t:"shopRefresh",player:0,seq}); act(T,{t:"shopRefresh",player:0,seq:seq+1});
  ok(S.eco.coins[0]===c-2&&S.eco.shop.seq[0]===seq+2,"AC15 새로 고침 🪙1 · 무제한 · 진열 번호 +1");
  ok(S.eco.shop.slots[0].length===6,"새로 고침 뒤 6칸 (#263)");
  S.eco.coins[0]=0; refusedClean(T,{t:"shopRefresh",player:0,seq:S.eco.shop.seq[0]},"AC15 잔액 0 이면 새로 고침 거부 · 상태 불변");
}

/* ===== D. 승급·합성 ===== */
{
  const T=pvePlay(41), S=T.S; endTurnAt(T,20);
  const m=field(T,0)[0], key=m.rosterId, id=m.id, pos=[m.r,m.c];
  m.hp=10; S.eco.coins[0]=10;
  setSlots(T,0,[[key,3],null,null,null,null]); // 40턴급 진열을 세운다 — 판정은 reducer 가 한다
  act(T,{t:"shopBuy",player:0,i:0,seq:S.eco.shop.seq[0]});
  const rd=T.ROSTER.find(r=>r.id===key);
  ok(S.eco.coins[0]===8&&m.grade===3&&m.paid===3&&m.id===id&&m.r===pos[0]&&m.c===pos[1],"AC16 ⭐1 보유 + ⭐3 진열 → 🪙2 · 원장 3 · 그 자리 ⭐3");
  ok(m.maxHp===T.gradeHp(rd.hp,3)&&m.hp===m.maxHp&&m.skills.length===3&&m.cds.every(c=>c===0),"AC16 새 최대 HP 까지 회복 · 스킬 칸 1~3차");
  ok(S.eco.shop.slots[0][0]&&S.eco.shop.slots[0][0].soldOut&&S.eco.shop.slots[0][0].key===key,"정기 상점/#263: 산 칸은 비지 않고 SOLD OUT 으로 남는다"); // 진열은 위 setSlots 픽스처가 세운 것이라 길이는 보지 않는다
  const u=unit(T,T.ROSTER.find(r=>!ownKeys(T,0).includes(r.id)).id,2,2); u.hp=5; S.eco.bag[0]=[u];
  setSlots(T,0,[[T.ecoKey(u),2],null,null,null,null]);
  act(T,{t:"shopBuy",player:0,i:0,seq:S.eco.shop.seq[0]});
  const u2=S.eco.bag[0][0];
  ok(S.eco.coins[0]===6&&u2.grade===3&&u2.paid===4&&u2.hp===u2.maxHp&&u2.uid===u.uid,"AC17 ⭐2 보유 + ⭐2 진열 → 🪙2 · ⭐3 · 원장 4 (가방 제자리)");
  /* AC18 */
  const fill=T.ROSTER.filter(r=>!ownKeys(T,0).includes(r.id)).slice(0,2).map(r=>unit(T,r.id,1,1));
  S.eco.bag[0]=[u2].concat(fill);
  const newKey=T.ROSTER.find(r=>!ownKeys(T,0).includes(r.id)).id;
  setSlots(T,0,[[newKey,1],[T.ecoKey(u2),3],null,null,null]);
  refusedClean(T,{t:"shopBuy",player:0,i:0,seq:S.eco.shop.seq[0]},"AC18 가방 가득 + 신규 종 → 거부 · 상태 불변");
  ok(kind(act(T,{t:"shopBuy",player:0,i:1,seq:S.eco.shop.seq[0]}))==="shopChanged"&&S.eco.bag[0][0].grade===4&&S.eco.bag[0].length===3,"AC18 가방 가득 + 보유 종 승급 → 허용 (새 칸 불필요)");
  refusedClean(T,{t:"shopBuy",player:0,i:1,seq:S.eco.shop.seq[0]},"AC36 같은 칸 두 번 → 두 번째 거부");
  S.eco.coins[0]=0; setSlots(T,0,[[newKey,1],null,null,null,null]); S.eco.bag[0].pop();
  refusedClean(T,{t:"shopBuy",player:0,i:0,seq:S.eco.shop.seq[0]},"E5 코인 부족 거부 · 상태 불변");
  ok(uniqueOwned(T,0),"AC19 승급·구매 뒤에도 같은 종 2마리 없음");
  /* AC20 사망 종 재구매 */
  S.eco.coins[0]=5; const dead=field(T,0)[2]; dead.alive=false; const dk=dead.rosterId;
  setSlots(T,0,[[dk,1],null,null,null,null]);
  act(T,{t:"shopBuy",player:0,i:0,seq:S.eco.shop.seq[0]});
  const back=S.eco.bag[0].find(x=>T.ecoKey(x)===dk);
  ok(!!back&&back.hp===back.maxHp&&back.grade===1&&!dead.alive,"AC20 사망한 종은 다시 살 수 있다 (가방 · 풀 HP) · 사망 칸은 그대로");
}

/* ===== E. 가방·교체 ===== */
{
  const T=pvePlay(51), S=T.S;
  const f=field(T,0)[0], u=unit(T,T.ROSTER.find(r=>!ownKeys(T,0).includes(r.id)).id,2,2);
  u.hp=33; f.hp=40; S.eco.bag[0]=[u];
  refusedClean(T,{t:"shopSwap",player:0,pieceId:f.id,uid:u.uid},"AC21 상점 밖 교체 거부");
  endTurnAt(T,20);
  f.revealed=true; f.revealedSkills=[0];
  const fKey=f.rosterId, pos=[f.r,f.c], fid=f.id;
  act(T,{t:"shopSwap",player:0,pieceId:f.id,uid:u.uid});
  const out=S.eco.bag[0][0];
  ok(f.id===fid&&f.r===pos[0]&&f.c===pos[1]&&T.ecoKey(f)===T.ecoKey(u)&&f.hp===33&&f.grade===2&&f.paid===2,"AC21 가방 말이 나간 말의 칸에 그대로 · HP 동결(33)");
  ok(T.ecoKey(out)===fKey&&out.hp===40&&out.revealed===true,"AC21 나간 말은 HP 그대로 가방으로 (공개 상태도 그 개체와 함께)");
  ok(f.revealed===false&&f.swapMark===true,"AC23 공개 칸에 비공개 말 → '상점에서 교체됨' 표식 · 비공개 유지");
  act(T,{t:"shopSwap",player:0,pieceId:f.id,uid:out.uid});
  ok(f.revealed===true&&f.swapMark===false&&f.rosterId===fKey&&f.hp===40,"AC23 공개된 말은 가방을 거쳐 돌아와도 공개 유지 · HP 회복 없음");
  const dead=field(T,0)[3]; dead.alive=false;
  refusedClean(T,{t:"shopSwap",player:0,pieceId:dead.id,uid:S.eco.bag[0][0].uid},"AC21 사망 칸 교체 거부 (부활 없음)");
  const king=S.pieces.find(x=>x.owner===0&&x.type==="king");
  refusedClean(T,{t:"shopSwap",player:0,pieceId:king.id,uid:S.eco.bag[0][0].uid},"AC21 왕·동료 칸 교체 거부");
  /* AC23 H — 상대(AI 좌석) 화면에는 교체 표식만 */
  f.revealed=false; f.swapMark=true; act(T,{t:"shopDone",player:0}); T.TQ.length=0;
}
{ /* AC22 가방 생존 말은 전멸 패배를 막지 못한다 */
  const T=pvePlay(52), S=T.S;
  S.eco.bag[0]=[unit(T,T.ROSTER.find(r=>!ownKeys(T,0).includes(r.id)).id,3,3)];
  for(const x of S.pieces) if(x.owner===0&&(x.type==="minion"||x.type==="ally")) x.alive=false;
  T.checkWipe();
  ok(S.phase==="over"&&S.winner===1&&S.metrics.winType==="wipe","AC22 필드 하수인 6·동료 2 전멸 → 가방에 생존 말이 있어도 패배");
}

/* ===== F. 판매·원장 ===== */
{
  const T=pvePlay(61), S=T.S; endTurnAt(T,20);
  const ks=T.ROSTER.filter(r=>!ownKeys(T,0).includes(r.id)).slice(0,2).map(r=>r.id);
  const a=unit(T,ks[0],3,3), cap=unit(T,ks[1],2,0), lg=unit(T,"L-WITCH",5,10);
  a.hp=Math.round(a.maxHp*0.5); S.eco.bag[0]=[a,cap,lg];
  const c=S.eco.coins[0];
  act(T,{t:"shopSell",player:0,uid:a.uid}); act(T,{t:"shopSell",player:0,uid:cap.uid}); act(T,{t:"shopSell",player:0,uid:lg.uid});
  eq(S.eco.coins[0],c+13,"AC24 판매 = 원장 100% (구매·승급 3 + 포획 0 + 전설 10)");
  refusedClean(T,{t:"shopSell",player:0,uid:a.uid},"AC36 같은 판매 두 번 → 두 번째 거부 · 상태 불변");
  const fm=field(T,0)[0];
  refusedClean(T,{t:"shopSell",player:0,uid:fm.id},"AC24 필드 말은 판매 거부 (가방만)");
  ok(S.eco.shop.sold[0].includes(ks[0])&&Math.abs(S.eco.soldHp[0][ks[0]]-0.5)<0.01,"AC26 판매 당시 HP 비율 기록");
  setSlots(T,0,[[ks[0],3],null,null,null,null]);
  refusedClean(T,{t:"shopBuy",player:0,i:0,seq:S.eco.shop.seq[0]},"AC25 판매한 종은 이번 오픈 동안 구매 잠금 ('판매함')");
  ok(/판매함/.test(T.shopHtml(0)),"AC25 이미 진열된 칸은 '판매함' 표시");
  let seen=false; S.eco.coins[0]=999;
  for(let n=0;n<60;n++){ act(T,{t:"shopRefresh",player:0,seq:S.eco.shop.seq[0]}); if(S.eco.shop.slots[0].some(s=>s&&s.key===ks[0])) seen=true; }
  ok(!seen,"AC25 새로 고침에도 판매한 종이 나오지 않는다");
  act(T,{t:"shopDone",player:0}); T.TQ.length=0;
  /* AC26 다음 오픈 재구매 HP */
  S.current=0; endTurnAt(T,40);
  setSlots(T,0,[[ks[0],3],null,null,null,null]); S.eco.coins[0]=10;
  act(T,{t:"shopBuy",player:0,i:0,seq:S.eco.shop.seq[0]});
  const re=S.eco.bag[0].find(x=>T.ecoKey(x)===ks[0]);
  ok(!!re&&re.hp===Math.round(re.maxHp*0.5)&&re.paid===3,"AC26 다음 오픈 재구매 HP = round(새 최대 HP × 0.5)");
  setSlots(T,0,[[ks[0],4],null,null,null,null]);
  act(T,{t:"shopBuy",player:0,i:0,seq:S.eco.shop.seq[0]});
  const up=S.eco.bag[0].find(x=>T.ecoKey(x)===ks[0]);
  ok(up.grade===4&&up.hp===up.maxHp&&up.paid===4,"AC26 이후 정상 승급하면 풀 회복");
  /* AC27 차익 없음 */
  /* AC27 교체 반복은 코인·HP 를 바꾸지 않고, 판매 환급은 낸 만큼뿐이다 */
  const fm2=field(T,0)[1]; fm2.hp=Math.max(1,fm2.maxHp-30); up.hp=up.maxHp-7;
  const c1=S.eco.coins[0], hpSum=()=>fm2.hp+S.eco.bag[0].reduce((a,x)=>a+x.hp,0), h1=hpSum();
  for(let n=0;n<6;n++){ const b=S.eco.bag[0].find(x=>T.ecoKey(x)!==T.ecoKey(fm2)); act(T,{t:"shopSwap",player:0,pieceId:fm2.id,uid:(b||S.eco.bag[0][0]).uid}); }
  ok(S.eco.coins[0]===c1&&hpSum()===h1,"AC27 교체를 반복해도 코인·HP 가 늘지 않는다");
  const target=S.eco.bag[0].find(x=>T.ecoKey(x)===ks[0]);
  act(T,{t:"shopSell",player:0,uid:target.uid});
  refusedClean(T,{t:"shopSell",player:0,uid:target.uid},"AC27 판매는 한 번뿐");
  ok(S.eco.coins[0]===c1+4&&!S.eco.bag[0].some(x=>T.ecoKey(x)===ks[0]),"AC27 판매 환급 = 원장(1+3) — 사고팔아 코인이 늘지 않는다");
}

/* ===== G. 수풀 코인 ===== */
{
  const T=pvePlay(71), S=T.S;
  ok(S.events.length===8&&S.events.every(e=>e.kind==="coin")&&S.events.filter(e=>e.r<=5).length===4,"AC28 수풀 구역당 4개 · 총 8개 · 코인 전용 (패키지·포획·기술 교체 미생성)");
  const top=S.events.filter(e=>e.r<=5), bot=S.events.filter(e=>e.r>=9);
  const searcher=p=>T.alivePieces().find(x=>x.owner===p&&x.type==="minion");
  const doSearch=(p,ev)=>{ const m=searcher(p); H.place(T,m,ev.r,ev.c); S.current=p; S.mainUsed=false; S.phase="play"; S.traces[p].add(ev.r+"_"+ev.c);
    return act(T,{t:"search",id:m.id,r:ev.r,c:ev.c,ei:S.events.indexOf(ev)}); };
  const c=S.eco.coins.slice();
  doSearch(0,top[0]); eq(S.eco.coins[0],c[0]+1,"AC28 위 수풀 1번째 = 🪙1");
  doSearch(1,top[1]); eq(S.eco.coins[1],c[1]+2,"AC28 누가 찾든 구역 공통 — 위 수풀 2번째(상대) = 🪙2");
  doSearch(0,bot[0]); eq(S.eco.coins[0],c[0]+2,"AC28 아래 수풀은 따로 센다 — 1번째 = 🪙1");
  doSearch(0,top[2]); doSearch(1,top[3]);
  eq(S.eco.coins[0]+S.eco.coins[1]-c[0]-c[1],1+2+1+3+4,"AC28 구역당 합계 🪙10");
  ok(!S.log.some(l=>/🪙/.test(l.msg)),"AC38 공개 기록에 수풀 금액 없음");
  ok(S.pkgs[0].itemGift===0&&S.pkgs[0].battleBuff===0&&!S.recruit,"AC28 패키지·중립 포획 없음");
}

/* ===== H. 전투 보상 · 포획 · B08 ===== */
const realRandom=Math.random;
function fixRand(T,v){ T.setSeed(null); Math.random=()=>v; }
function unfix(){ Math.random=realRandom; }
function duel(T,att,def){ T.startRounds(att,def,att,def); return T.S.battle; }
{
  const T=pvePlay(81), S=T.S;
  const a=T.alivePieces().find(p=>p.owner===0&&p.type==="minion"), d=T.alivePieces().find(p=>p.owner===1&&p.type==="minion");
  let c=S.eco.coins.slice(); duel(T,a,d); S.battle.fd.hp=0; T.checkDeath();
  ok(S.eco.coins[0]===c[0]+3&&S.eco.coins[1]===c[1]+1,"AC29 승 🪙3 · 패 🪙1");
  S.phase="play"; S.battlesUsed=0; S.current=0; T.TQ.length=0;
  const a2=T.alivePieces().find(p=>p.owner===0&&p.type==="minion"), d2=T.alivePieces().find(p=>p.owner===1&&p.type==="minion");
  c=S.eco.coins.slice(); duel(T,a2,d2);
  fixRand(T,0); act(T,{t:"flee",frame:T.battleCmdFrame()}); unfix();
  ok(!S.battle&&S.eco.coins[0]===c[0]&&S.eco.coins[1]===c[1],"AC29 도망 성공 = 양측 🪙0");
  if(S.fleePick) act(T,{t:"fleeSkip"}); if(S.fleePick) T.fleeResolve(null);
}
{
  const T=pvePlay(82), S=T.S;
  const a=T.alivePieces().find(p=>p.owner===0&&p.type==="minion");
  const d=T.alivePieces().find(p=>p.owner===1&&p.type==="minion"&&!ownKeys(T,0).includes(p.rosterId));
  const B=duel(T,a,d);
  const mySide=B.attP.owner===0?"A":"D";
  ok(/하수인 HP|30%/.test(T.ballWhy(S,mySide))||T.ballWhy(S,mySide)==="몬스터볼이 없습니다","AC30 HP 30% 이상·볼 없음이면 던질 수 없다");
  S.balls[0]=2; B.fd.hp=Math.floor(B.fd.maxHp*0.3)-1;
  ok(T.ballWhy(S,"A")===null,"AC30 조건 충족 (일반 하수인 · HP<30% · 볼 · 라운드 1회)");
  const keep=B.fd.rosterId; B.fd.rosterId=a.rosterId; ok(/이미 가진 종/.test(T.ballWhy(S,"A")),"AC30 내가 가진 종은 포획 대상 제외 (사유는 내 화면)"); B.fd.rosterId=keep;
  B.fd.legend="dragon"; ok(/전설/.test(T.ballWhy(S,"A")),"AC30 전설 제외"); B.fd.legend=null;
  if(T.actorOfPhase()!=="A") B.phase=1-B.phase; // 행동 차례를 A(사람)로
  fixRand(T,0.99); const bl=S.balls[0]; act(T,{t:"ball",frame:T.battleCmdFrame()}); unfix();
  ok(S.balls[0]===bl-1&&!!S.battle&&B.ballThrowA,"AC30 실패도 볼 소모 · 라운드당 1회");
  ok(/이미 던졌습니다/.test(T.ballWhy(S,"A")),"AC30 같은 라운드 두 번째 투척 불가");
  B.ballThrowA=false; B.phase=T.actorOfPhase()==="A"?B.phase:1-B.phase;
  const c=S.eco.coins.slice(), dGrade=d.grade, dSkills=d.skills.slice();
  fixRand(T,0); act(T,{t:"ball",frame:T.battleCmdFrame()}); unfix();
  const cu=S.eco.bag[0].find(u=>T.ecoKey(u)===d.rosterId);
  ok(!S.battle&&!!cu&&cu.grade===dGrade&&JSON.stringify(cu.skills)===JSON.stringify(dSkills),"AC31 포획 성공 → 가방 · 등급·스킬 승계");
  ok(cu&&cu.hp===Math.round(cu.maxHp*0.7)&&cu.paid===0&&cu.cds.every(x=>x===0)&&!cu.burn,"AC31 HP 최대의 70% · ⌛0 · 원장 🪙0");
  ok(!d.alive&&d.placed,"AC31 포획당한 칸은 사망 칸처럼 동결");
  ok(S.eco.coins[0]===c[0]+3&&S.eco.coins[1]===c[1]+1,"AC29 포획으로 끝난 전투 = 포획한 쪽 🪙3 · 당한 쪽 🪙1");
  ok(uniqueOwned(T,0),"AC19 포획 뒤에도 같은 종 2마리 없음");
}
{ /* AC32 B08 */
  const T=pvePlay(83), S=T.S;
  const fillers=T.ROSTER.filter(r=>!ownKeys(T,0).includes(r.id)&&!field(T,1).some(m=>m.rosterId===r.id)).slice(0,3).map((r,i)=>unit(T,r.id,1,i+1));
  S.eco.bag[0]=fillers.slice();
  const a=T.alivePieces().find(p=>p.owner===0&&p.type==="minion");
  const d=T.alivePieces().find(p=>p.owner===1&&p.type==="minion"&&!ownKeys(T,0).includes(p.rosterId));
  const B=duel(T,a,d); S.balls[0]=1; B.fd.hp=1; if(T.actorOfPhase()!=="A") B.phase=1-B.phase;
  fixRand(T,0); act(T,{t:"ball",frame:T.battleCmdFrame()}); unfix();
  ok(S.phase==="bagPick"&&S.eco.bagPick&&S.eco.bagPick.owner===0&&S.eco.bag[0].length===3,"AC32 가방 가득 포획 → B08 (보드 잠김)");
  ok(!T.canMoveTo(a,a.r-1,a.c)&&T.humanViewer()===0,"AC32 B08 동안 보드 잠김 · 소유자 시점");
  refusedClean(T,{t:"shopGood",player:0,item:"ball"},"B08 은 상점이 아니다");
  const tok=S.eco.bagPick.token, c=S.eco.coins[0], cap=S.eco.bagPick.unit;
  act(T,{t:"bagPick",i:1,token:tok+1}); ok(S.phase==="bagPick","AC36 다른 토큰의 선택은 무시");
  act(T,{t:"bagPick",i:1,token:tok});
  ok(S.phase==="play"&&!S.eco.bagPick&&S.eco.bag[0][1]===cap&&S.eco.coins[0]===c+2&&S.eco.soldHp[0][T.ecoKey(fillers[1])]!==undefined,"AC32 기존 말 선택 → 원장 환급 자동 판매 · 포획한 말이 그 칸");
  act(T,{t:"bagPick",i:3,token:tok}); ok(S.eco.coins[0]===c+2,"AC36 해결된 B08 은 다시 적용되지 않는다");
}
{ /* AC32 무응답 = 포획한 말만 방출 (UI 20초 타이머가 보내는 액션과 같은 것) */
  const T=pvePlay(84), S=T.S;
  S.eco.bag[0]=T.ROSTER.filter(r=>!ownKeys(T,0).includes(r.id)&&!field(T,1).some(m=>m.rosterId===r.id)).slice(0,3).map(r=>unit(T,r.id,2,2));
  const snap=JSON.stringify(S.eco.bag[0]);
  const a=T.alivePieces().find(p=>p.owner===0&&p.type==="minion"), d=T.alivePieces().find(p=>p.owner===1&&p.type==="minion"&&!ownKeys(T,0).includes(p.rosterId));
  const B=duel(T,a,d); S.balls[0]=1; B.fd.hp=1; if(T.actorOfPhase()!=="A") B.phase=1-B.phase;
  fixRand(T,0); act(T,{t:"ball",frame:T.battleCmdFrame()}); unfix();
  const c=S.eco.coins[0];
  act(T,{t:"bagPick",i:S.eco.bag[0].length,token:S.eco.bagPick.token});
  ok(S.phase==="play"&&JSON.stringify(S.eco.bag[0])===snap&&S.eco.coins[0]===c,"AC32 무응답 → 포획한 말만 내보낸다 (기존 가방·코인 불변)");
}
{ /* AC33 포획으로 상대 전멸 → B08 없이 종료 */
  const T=pvePlay(85), S=T.S;
  S.eco.bag[0]=T.ROSTER.filter(r=>!ownKeys(T,0).includes(r.id)).slice(0,3).map(r=>unit(T,r.id,1,1));
  const a=T.alivePieces().find(p=>p.owner===0&&p.type==="minion"), d=T.alivePieces().find(p=>p.owner===1&&p.type==="minion"&&!ownKeys(T,0).includes(p.rosterId));
  for(const x of S.pieces) if(x.owner===1&&x!==d&&(x.type==="minion"||x.type==="ally")) x.alive=false;
  const c=S.eco.coins.slice();
  const B=duel(T,a,d); S.balls[0]=1; B.fd.hp=1; if(T.actorOfPhase()!=="A") B.phase=1-B.phase;
  fixRand(T,0); act(T,{t:"ball",frame:T.battleCmdFrame()}); unfix();
  ok(S.phase==="over"&&S.winner===0&&!S.eco.bagPick&&S.eco.coins[0]===c[0],"AC33 포획으로 전멸 → B08·보상 없이 경기 종료 (종료 우선)");
}

/* ===== J. 대리 출전 ===== */
function proxyBattle(T,win){
  const S=T.S, king=S.pieces.find(x=>x.owner===0&&x.type==="king"), foe=T.alivePieces().find(p=>p.owner===1&&p.type==="minion");
  const u=unit(T,T.ROSTER.find(r=>!ownKeys(T,0).includes(r.id)).id,2,2); S.eco.bag[0]=[u];
  H.place(T,king,7,3); H.place(T,foe,7,4); S.current=0; S.battlesUsed=0; S.phase="play";
  const evs=[]; const orig=T.UI_PORT.event; T.UI_PORT.event=e=>{ evs.push(e); };
  act(T,{t:"battleStart",attId:king.id,defId:foe.id});
  const pr=evs.find(e=>e.type==="battleEntryPrompt");
  T.UI_PORT.event=orig;
  ok(pr&&pr.bag&&pr.bag.length===1&&pr.bag[0].uid===u.uid&&pr.owner===0,"AC34 대리 후보 = 가방 말 (소유자 프롬프트)");
  act(T,{t:"battleEntryPick",side:"A",what:"bag",uid:u.uid});
  act(T,{t:"battleEntryGo"});
  ok(S.battle&&S.battle.fa===u&&S.battle.attP===king,"AC34 가방 말이 대리로 참전");
  if(win){ u.hp=20; S.battle.fd.hp=0; T.checkDeath(); }
  else { S.battle.fa.hp=0; T.checkDeath(); }
  return {king,u};
}
{
  const T=pvePlay(91), S=T.S; const {king,u}=proxyBattle(T,true);
  ok(king.alive&&S.eco.bag[0][0]===u&&u.hp===20,"AC34 대리 승리 → 받은 피해를 안고 가방 복귀");
}
{
  const T=pvePlay(92), S=T.S; proxyBattle(T,false);
  ok(S.phase==="over"&&S.winner===1&&S.eco.bag[0].length===0,"AC34 왕 대리 패배 → 대리 제거 · 경기 패배");
}
{
  const T=pvePlay(93), S=T.S; const king=S.pieces.find(x=>x.owner===0&&x.type==="king"), foe=T.alivePieces().find(p=>p.owner===1&&p.type==="minion");
  S.eco.bag[0]=[]; H.place(T,king,7,3); H.place(T,foe,7,4); S.current=0; S.battlesUsed=0;
  act(T,{t:"battleStart",attId:king.id,defId:foe.id}); if(S.entryPick) act(T,{t:"battleEntryGo"});
  ok(S.battle&&S.battle.fa===king,"AC34 가방이 비면 본체 자동 출전");
}
{ /* Saturn REVISE HIGH1 — 핫시트 가방 대리 선택은 소유자에게 가림 뒤에만 보이고, 고른 뒤 가림을 다시 거쳐 차례 주인에게 돌아간다 */
  const scr=T=>T.byId("overlayBox").innerHTML+T.byId("obBtns").children.map(b=>b.textContent).join("|"); // 화면 = 본문 + 버튼 문구
  const T=hotseatPlay(94), S=T.S, box=()=>scr(T);
  const click=re=>{ const k=T.byId("obBtns").children, b=k.find(x=>re.test(x.textContent)); ok(!!b,"HIGH1 버튼 "+re); k.length=0; if(b) b.onclick(); }; // 스텁 버튼 줄은 창마다 비워지지 않는다 — 누르기 전에 비운다
  const foe=T.alivePieces().find(p=>p.owner===0&&p.type==="minion"), king2=S.pieces.find(x=>x.owner===1&&x.type==="king");
  const u=unit(T,T.ROSTER.find(r=>!ownKeys(T,1).includes(r.id)).id,2,2); S.eco.bag[1]=[u];
  H.place(T,foe,7,3); H.place(T,king2,7,4); S.current=0; S.battlesUsed=0; S.phase="play";
  T.byId("obBtns").children.length=0;
  /* HIGH1-2: 가림 = #overlay.handoff(불투명) + #app inert·aria-hidden. 일반 창("open")은 셋 다 없어야 한다 */
  const cov=X=>{ const o=X.byId("overlay"), a=X.byId("app"), h=o.classList.contains("handoff"), i=a.hasAttribute("inert")&&a.getAttribute("aria-hidden")==="true";
    return h&&i?"cover":!h&&!i&&!a.hasAttribute("aria-hidden")?"open":"MIXED"; };
  const untut=X=>{ if(X.TUT.open) X.tutClose(); }; untut(T); // 문서 로드 자동 튜토리얼이 #app 을 따로 잡고 있다 — 닫고 본다
  const covSeq=[]; const click0=click; const clickC=re=>{ click0(re); covSeq.push(cov(T)); };
  act(T,{t:"battleStart",attId:foe.id,defId:king2.id});                 // P1 차례 — 방어자(P2 왕)의 가방 선택
  covSeq.push(cov(T));
  ok(S.entryPick&&S.entryPick.stage==="D"&&/기기를 넘기세요/.test(box())&&!box().includes(u.name)&&!box().includes("HP "+u.hp),"HIGH1 P1 차례: P2 가방 선택 전에 가림 · 이름/HP 비노출");
  clickC(/확인/); ok(box().includes(u.name),"HIGH1 가림 뒤 P2 가 자기 가방 후보를 본다");
  clickC(/대리/); ok(S.entryPick&&S.entryPick.stage==="D"&&/기기를 넘기세요/.test(box())&&!box().includes(u.name),"HIGH1 P2 선택 뒤 가림으로 P1 에게 돌려준다 (선택 비노출)");
  clickC(/확인/); ok(S.entryPick&&S.entryPick.stage==="reveal"&&S.entryPick.dU===u.uid,"HIGH1 가림 확인 뒤 선택 확정 → 공개");
  eq(covSeq.join(","),"cover,open,cover,open","HIGH1-2 가림→선택→가림→공개: 가림만 불투명·#app 차단, 다음 창에서 매번 해제");
  const T2=hotseatPlay(95), S2=T2.S, king1=S2.pieces.find(x=>x.owner===0&&x.type==="king"), m2=T2.alivePieces().find(p=>p.owner===1&&p.type==="minion");
  const u1=unit(T2,T2.ROSTER.find(r=>!ownKeys(T2,0).includes(r.id)).id,2,2); S2.eco.bag[0]=[u1];
  H.place(T2,king1,7,3); H.place(T2,m2,7,4); S2.current=0; S2.battlesUsed=0; S2.phase="play";
  T2.byId("obBtns").children.length=0;
  untut(T2); act(T2,{t:"battleStart",attId:king1.id,defId:m2.id});                // 공격자 = 차례 주인 — 가림 없이 바로
  ok(scr(T2).includes(u1.name)&&!/기기를 넘기세요/.test(scr(T2)),"HIGH1 차례 주인(공격자)의 가방 선택은 가림 없이");
  eq(cov(T2),"open","HIGH1-2 가림 없는 일반 창은 반투명 배경 그대로 (#app 차단 없음)");
  /* 모든 핫시트 가림이 같은 함수를 지난다 — 턴 넘김 가림도 불투명 · 확인하면 해제 · 튜토리얼이 끼어들어도 #app 차단 유지 */
  const T3=hotseatPlay(96); untut(T3); T3.byId("obBtns").children.length=0; endTurnAt(T3,5);
  ok(/기기를 넘기세요/.test(scr(T3)),"HIGH1-2 턴 넘김 가림 표시"); eq(cov(T3),"cover","HIGH1-2 턴 넘김 가림도 불투명·#app 차단");
  T3.tutOpen(); T3.tutClose(); eq(cov(T3),"cover","HIGH1-2 가림 중 튜토리얼을 열고 닫아도 #app 차단 유지");
  const k3=T3.byId("obBtns").children; k3.find(b=>/확인/.test(b.textContent)).onclick();
  ok(T3.byId("overlay").classList.contains("hidden")||cov(T3)==="open","HIGH1-2 턴 가림 확인 뒤 해제"); eq(cov(T3),"open","HIGH1-2 턴 가림 확인 뒤 불투명·차단 잔존 없음");
  T3.modal("<p>일반</p>",[["닫기",()=>T3.close()]]); eq(cov(T3),"open","HIGH1-2 일반 모달은 가림 상태를 물려받지 않는다");
  const T4=pvePlay(97); untut(T4); T4.modal("<p>x</p>",[]); eq(cov(T4),"open","HIGH1-2 PVE 모달 무변경");
  /* 스텁은 계산 스타일이 없다 — 규칙 원문으로 본다: 가림은 알파 없는 배경, 일반 창은 종전 반투명 #000c */
  const css=require("fs").readFileSync(path.join(path.dirname(htmlPath),"css","game.css"),"utf8");
  const rule=(css.match(/\.overlay\.handoff\{([^}]*)\}/)||[])[1]||"";
  ok(/background:\s*#000(000)?\s*(;|$)/.test(rule)&&!/opacity/.test(rule),"HIGH1-2 .overlay.handoff 배경 불투명 (#000) · "+rule);
  ok(/\.overlay\{[^}]*background:#000c;/.test(css),"HIGH1-2 일반 .overlay 배경은 종전 #000c 유지");
}

/* ===== K. 티켓 ===== */
{
  const T=pvePlay(101), S=T.S; endTurnAt(T,20); S.eco.coins[0]=5;
  const ally=S.pieces.find(x=>x.owner===0&&x.type==="ally");
  refusedClean(T,{t:"shopTicket",player:0,pieceId:ally.id,el:"land"},"AC35 티켓 없으면 거부");
  act(T,{t:"shopGood",player:0,item:"ticket"}); eq(S.eco.tickets[0],1,"AC35 정기 상점에서 티켓 🪙1");
  const hp=ally.hp=50, other=["fire","water","lightning","land","grass"].find(e=>e!==ally.element);
  refusedClean(T,{t:"shopTicket",player:0,pieceId:ally.id,el:ally.element},"AC35 같은 속성 거부");
  act(T,{t:"shopTicket",player:0,pieceId:ally.id,el:other});
  ok(ally.element===other&&ally.hp===hp&&ally.skills[1].endsWith("-"+other)&&S.eco.tickets[0]===0,"AC35 속성·스킬 변경 · HP 유지");
  ok(T.synCount(0,S).el[other]>=1,"AC35 바뀐 속성은 다음 전투 스냅샷 집계에 들어간다");
  act(T,{t:"shopGood",player:0,item:"ticket"}); const dead=S.pieces.filter(x=>x.owner===0&&x.type==="ally")[1]; dead.alive=false;
  refusedClean(T,{t:"shopTicket",player:0,pieceId:dead.id,el:"fire"},"AC35 죽은 동료 거부");
  act(T,{t:"shopGood",player:0,item:"power"}); eq(S.eco.buffInv[0].power,1,"E13 정기 상점 전투 버프 구매");
  act(T,{t:"shopDone",player:0}); T.TQ.length=0;
  S.current=0; S.phase="play"; S.battlesUsed=0;
  const a=T.alivePieces().find(p=>p.owner===0&&p.type==="minion"), d=T.alivePieces().find(p=>p.owner===1&&p.type==="minion");
  const B=duel(T,a,d); if(T.actorOfPhase()!=="A") B.phase=1-B.phase;
  act(T,{t:"buffUse",key:"power",frame:T.battleCmdFrame()});
  ok(B.buffA==="power"&&a.powerBuff&&S.eco.buffInv[0].power===0,"E13 산 버프는 전투에서 1개 사용");
  act(T,{t:"buffUse",key:"power",frame:T.battleCmdFrame()}); eq(S.eco.buffInv[0].power,0,"E13 한 전투 1개");
}

/* ===== L. UI 확인 버튼 연타 = 1회 ===== */
{
  const T=pvePlay(111), S=T.S; endTurnAt(T,20);
  const u=unit(T,T.ROSTER.find(r=>!ownKeys(T,0).includes(r.id)).id,2,2); S.eco.bag[0]=[u];
  const c=S.eco.coins[0];
  T.__shop("sell",u.uid);
  const bs=T.byId("obBtns").children, btn=bs[bs.length-2]; // 확인 창의 [판매] (스텁은 이전 창 버튼을 남기므로 끝에서 센다)
  ok(btn&&btn.textContent==="판매","판매 확인 팝업 1회");
  btn.onclick(); btn.onclick();
  eq(S.eco.coins[0],c+2,"AC36 확인 버튼은 누르는 순간 잠긴다 — 연타해도 1회");
  ok(/시작 상점|턴 상점/.test(T.shopHtml(0))&&T.shopViewer()===0,"H 기능형 상점 화면이 소유자 시점으로 그려진다");
}

/* ===== M. AI 공정 관측 · 완주 ===== */
{
  /* 상대(사람) 재화·가방·진열이 달라도 AI 의 상점 결과는 같다 — AI 는 자기 칸만 읽는다 */
  const run=mut=>{ const T=pvePlay(121), S=T.S; mut(T); S.current=1; S.turnCount=19; S.phase="play";
    const snap=()=>JSON.stringify({c:S.eco.coins[1],b:S.eco.bag[1].map(u=>[T.ecoKey(u),u.grade,u.hp]),f:field(T,1).map(m=>[m.rosterId,m.grade,m.hp]),balls:S.balls[1],inv:S.inv[1]});
    T.setSeed(777); act(T,{t:"endTurn"}); return snap(); };
  const A=run(()=>{}), B=run(T=>{ T.S.eco.coins[0]=99; T.S.eco.bag[0]=[unit(T,"L-DRAGON",5,10)]; });
  ok(A===B,"AC37 AI 상점 결과는 상대 재화·가방과 무관 (공정 관측)");
  const T=load(); const res=[];
  for(const seed of [5,17,29]){ const r=H.runSim(T,["grade5","grade5"],seed,{check:250});
    res.push(r); ok(r.phase==="over"&&r.viol.length===0,`AC37 AI vs AI 완주 · 불변식 (seed ${seed}: ${r.turns}턴 ${r.winType})`);
    const S=T.S; ok([0,1].every(p=>uniqueOwned(T,p)&&S.eco.bag[p].length<=3&&S.eco.coins[p]>=0),`E6 동종 1마리 · 가방 ≤3 · 코인 ≥0 (seed ${seed})`); }
  const r2=H.runSim(T,["dan5","grade5"],41,{check:250});
  ok(r2.phase==="over"&&r2.viol.length===0,"AC37 5단 vs 5급 완주");
}

/* ===== N. 비공개 ===== */
{
  const T=pvePlay(131), S=T.S; endTurnAt(T,20);
  act(T,{t:"shopGood",player:0,item:"ball"}); act(T,{t:"shopDone",player:0}); T.TQ.length=0;
  const aiBag=S.eco.bag[1].map(u=>u.name);
  ok(!S.log.some(l=>/🪙|원장/.test(l.msg))&&!S.log.some(l=>aiBag.some(n=>l.msg.includes(n))),"AC38 공개 기록에 재화·가방·원장 없음 (중립 문구만)");
  ok(S.log.some(l=>/상점을 이용했습니다/.test(l.msg)),"AC38 상대에게는 '상점을 이용했습니다' 중립 문구");
  T.renderSide(); const sp=T.byId("sidePanel").innerHTML;
  ok(sp.includes("🪙 "+S.eco.coins[0])&&!aiBag.some(n=>sp.includes(n)),"AC38 PVE 사이드 패널은 사람(소유자) 재화·가방만");
}
{
  const T=hotseatPlay(132), S=T.S; const f=field(T,1)[0]; H.place(T,f,7,4); f.revealed=false; f.swapMark=true; S.current=0;
  T.renderBoard(); const cell=T.byId("board").children.find(c=>+c.dataset.r===7&&+c.dataset.c===4);
  const chip=cell&&cell.children.find(k=>/\bpc\b/.test(k.className));
  ok(!!chip&&/↺/.test(chip.innerHTML)&&!chip.innerHTML.includes(f.name),"AC23 상대 화면: 교체 표식만 · 정체 비공개");
}

/* ===== O. 온라인 경계 (D3) ===== */
{
  const T=load(); T.newGame("pvp"); const S=T.S;
  ok(S.eco===undefined&&S.balls[0]===2&&S.inv[0].length===3&&S.events.length===6&&S.events.some(e=>e.kind==="itemGift"),"D3 온라인·권위 서버 경로(newGame 직접)는 종전 경제 그대로 — 상태 모양 불변");
  const legacy=T.S, snap=JSON.stringify(legacy,(k,v)=>v instanceof Set?[...v]:v);
  const rs=["shopBuy","shopRefresh","shopGood","shopSell","shopSwap","shopTicket","leaderEl","shopDone","shopTimeout","bagPick"].map(t=>T.reduceCoreAction(legacy,{t,player:0,i:0,seq:0,uid:1,token:1,item:"ball"}));
  ok(rs.every(r=>r&&r.state===legacy&&r.events.every(e=>e.type==="shopRefused"))&&JSON.stringify(legacy,(k,v)=>v instanceof Set?[...v]:v)===snap,"D3 종전 경제 상태에 경제 액션이 오면 거부 · 상태 불변 (예외 없음)");
  T.NET.mode=true; T.startMode("pvp"); ok(T.S.eco===undefined,"D3 온라인 중(NET.mode) 재생성도 종전 경제"); T.NET.mode=false;
  T.startMode("pvp"); ok(!!T.S.eco,"D3 핫시트는 새 경제");
  ok(T.reduceCoreAction(T.S,{t:"roster",rid:T.ROSTER[0].id})===null,"8.1 ⑪ 로컬 경제는 무료 로스터 선택 거부");
}

/* ===== S. 상점 시너지 현황 (5차 E16 · AC46~AC48) ===== */
{ /* AC46 S01 미리보기 */
  const T=pveSetup(16), S=T.S, fire=T.ROSTER.filter(r=>r.element==="fire"), water=T.ROSTER.find(r=>r.element==="water");
  const king=S.pieces.find(x=>x.owner===0&&x.type==="king");
  setSlots(T,0,[[fire[0].id,1],[fire[1].id,1],[water.id,1],[fire[2].id,1],[T.ROSTER.find(r=>r.element==="grass").id,1]]);
  act(T,{t:"shopBuy",player:0,i:0,seq:E(T).shop.seq[0]}); act(T,{t:"shopBuy",player:0,i:1,seq:E(T).shop.seq[0]});
  let v=T.ecoSynView(S,0);
  ok(v.el.fire===2&&v.el.water===0&&T.synView(0,S).el.fire===0,"AC46 배치 전(placed:false) synView 는 0 · 미리보기는 산 불 하수인 2");
  ok(Object.values(v.arch).reduce((a,b)=>a+b,0)===2&&v.arch[fire[0].arch]>=1,"AC46 아키타입도 산 하수인 2칸만 (왕·동료는 아키타입 집계에 없음)");
  ok(v.pending.length===3&&/미선택/.test(T.shopHtml(0)),"AC46 속성을 고르지 않은 왕·동료는 0 으로 세고 '미선택' 표시");
  const before=T.shopHtml(0);
  act(T,{t:"leaderEl",player:0,pieceId:king.id,el:"fire"}); v=T.ecoSynView(S,0);
  ok(v.el.fire===3&&v.pending.length===2&&T.shopHtml(0).includes("불 3칸 · (2) 달성 · (4)까지 1칸")&&T.shopHtml(0)!==before,"AC46 왕 🔥 선택 → 불 3칸 · (2) 달성 · (4)까지 1칸");
  refusedClean(T,{t:"leaderEl",player:0,pieceId:king.id,el:"nope"},"AC47 거부 요청은 상태 불변"); eq(T.ecoSynView(S,0).el.fire,3,"AC47 거부 요청 뒤 집계 불변");
  /* 필드를 마저 채우고 가방에 불 하수인 → 가방은 세지 않는다 */
  for(let n=0;n<12&&T.ecoEmptyField(S,0).length;n++){ const i=T.ecoBuyable(S,0); act(T,i<0?{t:"shopRefresh",player:0,seq:E(T).shop.seq[0]}:{t:"shopBuy",player:0,i,seq:E(T).shop.seq[0]}); }
  const pv=T.ecoSynView(S,0), fb=fire.find(r=>!ownKeys(T,0).includes(r.id));
  setSlots(T,0,[[fb.id,1],null,null,null,null]); act(T,{t:"shopBuy",player:0,i:0,seq:E(T).shop.seq[0]});
  ok(E(T).bag[0].length===1&&T.ecoSynView(S,0).el.fire===pv.el.fire,"AC46 가방 하수인은 세지 않는다");
  /* 완료 · 배치 뒤 실제 집계 = 미리보기 + 자동 배정분 */
  act(T,{t:"shopDone",player:0}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  const real=T.synView(0,S), autoEl=S.pieces.find(x=>x.owner===0&&x.type==="ally").element;
  ok(Object.keys(pv.el).every(k=>real.el[k]===pv.el[k]+(k===autoEl?2:0))&&JSON.stringify(real.arch)===JSON.stringify(pv.arch),
    "AC46 배치 뒤 synView 왕국·아키타입 = 미리보기 + 자동 배정 동료 2");
}
{ /* AC47 정기 상점 = 실제 집계 + 죽은 동료 수 · 확정 거래마다 갱신 */
  const T=pvePlay(17), S=T.S; endTurnAt(T,20);
  let v=T.ecoSynView(S,0), sv=T.synView(0,S);
  ok(JSON.stringify(v.el)===JSON.stringify(sv.el)&&JSON.stringify(v.arch)===JSON.stringify(sv.arch)&&v.deadAllies===0,"AC47 정기 상점 = 소유자 synView 그대로");
  const ally=S.pieces.find(x=>x.owner===0&&x.type==="ally"), m=field(T,0)[0]; ally.alive=false; m.alive=false;
  v=T.ecoSynView(S,0);
  ok(v.deadAllies===1&&v.dead===2&&v.el[m.element]===sv.el[m.element]&&/죽은 동료 1\/2/.test(T.shopHtml(0)),"AC47 죽은 동료 1 (synView.dead 2 는 하수인 포함) · 사망 칸 동결");
  const king=S.pieces.find(x=>x.owner===0&&x.type==="king"), to=["fire","water","lightning","land","grass"].find(e=>e!==king.element), from=king.element;
  E(T).tickets[0]=1; refusedClean(T,{t:"shopTicket",player:0,pieceId:king.id,el:from},"AC47 같은 속성 티켓 거부 · 상태 불변");
  const n0=T.ecoSynView(S,0).el; act(T,{t:"shopTicket",player:0,pieceId:king.id,el:to}); const n1=T.ecoSynView(S,0).el;
  ok(n1[to]===n0[to]+1&&n1[from]===n0[from]-1,"AC47 티켓 확정 → 속성 칸 수 즉시 반영");
  const alive=field(T,0).find(x=>x.alive&&T.ecoKey(x)), other=T.ROSTER.find(r=>r.element!==alive.element&&!ownKeys(T,0).includes(r.id));
  S.eco.bag[0]=[unit(T,other.id,alive.grade,1)]; const e0=T.ecoSynView(S,0).el, outEl=alive.element;   // 커밋은 말 객체를 제자리 갱신하므로 먼저 적어 둔다
  act(T,{t:"shopSwap",player:0,pieceId:alive.id,uid:S.eco.bag[0][0].uid}); const e1=T.ecoSynView(S,0).el;
  ok(e1[other.element]===e0[other.element]+1&&e1[outEl]===e0[outEl]-1,"AC47 교체 확정 → 속성 칸 수 즉시 반영");
  T.__shop("sell",S.eco.bag[0][0].uid); ok(JSON.stringify(T.ecoSynView(S,0).el)===JSON.stringify(e1),"AC47 판매 확인 창(미확정)만으로는 집계 불변");
}
{ /* AC48 소유자 전용 — 상대 칸은 내 현황에 없고 · 핫시트 가림 화면에는 현황이 없다 */
  const T=hotseatPlay(18), S=T.S; endTurnAt(T,20);
  const p=S.eco.shop.active, ov=T.byId("overlay");
  ok(ov.classList.contains("handoff")&&!/시너지 현황|칸 · /.test(T.byId("overlayBox").innerHTML),"AC48 핫시트 가림 화면에 시너지 현황 없음");
  const h0=T.shopHtml(p); S.pieces.filter(x=>x.owner===1-p&&x.type==="minion").forEach(x=>{ x.element="grass"; x.alive=false; });
  S.pieces.filter(x=>x.owner===1-p&&x.type==="ally").forEach(x=>{ x.alive=false; });
  ok(T.shopHtml(p)===h0,"AC48 상대 칸·사망을 바꿔도 내 상점 화면(현황) 불변");
  ok(!S.log.some(l=>/시너지 현황|칸 · \(/.test(l.msg)),"AC48 공개 로그에 칸 수·단계 없음");
  ok(!/ecoSynView|shopSynHtml/.test(T.aiShop.toString()),"AC48 AI 상점 판단은 시너지 현황을 입력으로 쓰지 않는다");
}

/* ===== Q. 상점 90초 — 사람 좌석마다, 자기 상점이 보이는 순간부터 (2026-09-24 CJ D1 · AC39 · AC40) =====
   하네스 스텁 타이머는 지연을 무시하므로 여기서만 가짜 시계(Date.now·setTimeout·clearTimeout)를 건다. 경과는 adv(ms) 로만 흐른다. */
{
  const saved={st:global.setTimeout,ct:global.clearTimeout,si:global.setInterval,ci:global.clearInterval,now:Date.now};
  const C={now:1e9,q:[],id:0};
  const arm=()=>{ global.setTimeout=(fn,ms)=>{ const id=++C.id; C.q.push({id,at:C.now+(ms||0),fn}); return id; }; // load() 가 스텁으로 되돌리므로 로드마다 다시 건다
    global.clearTimeout=id=>{ C.q=C.q.filter(x=>x.id!==id); }; global.setInterval=()=>0; global.clearInterval=()=>{}; };
  Date.now=()=>C.now;
  const adv=ms=>{ const end=C.now+ms; for(;;){ const due=C.q.filter(x=>x.at<=end).sort((a,b)=>a.at-b.at||a.id-b.id)[0]; if(!due) break;
    C.q=C.q.filter(x=>x!==due); C.now=due.at; due.fn(); } C.now=end; };
  const S90=90000;
  const boot=(mode,opts)=>{ const T=load(); arm(); T.FX.force=true; if(T.TUT.open) T.tutClose(); C.q=[]; T.startMode(mode,opts); return T; };
  const covered=T=>T.byId("overlay").classList.contains("handoff");
  const confirm=T=>{ const k=T.byId("obBtns").children, b=k.slice().reverse().find(x=>/확인 — 시작/.test(x.textContent)); ok(!!b,"Q 가림 확인 버튼"); k.length=0; if(b) b.onclick(); };
  try{
    /* Q1 PVE (회귀): S01 이 그려지는 순간부터 90초 · 다시 그려도 마감 유지 · 만료 = 자동 구매 완료 */
    { const T=boot("pve",{aiLevel:"grade5"}), S=T.S;
      eq(T.byId("shopClock").textContent,"⏱ 90초","Q1 PVE S01 표시 즉시 남은 시간 90초");
      adv(40000); T.render(); T.render(); ok(T.shopHtml(0).includes("⏱ 50초"),"Q1 다시 그리기는 마감을 되돌리지 않는다 (남은 50초)");
      adv(S90-40000-1); ok(!S.eco.shop.done[0],"Q1 PVE S01 89.999초엔 진행 중");
      /* #263 (2026-09-25 CJ): 만료 좌석은 자동 구매에 이어 **자동 배치·준비**까지 그 자리에서 끝난다 — 배치 90초를 다시 걸지 않는다 */
      adv(1); ok(T.ecoEmptyField(S,0).length===0&&!S.pieces.some(x=>x.owner===0&&!x.placed)&&S.phase==="play",
        "Q1 PVE S01 90초 만료 → 빈 필드 자동 구매 · 자동 배치 · 곧바로 준비(경기 시작)");
      /* 정기 상점: 확정 거래 보존 · 미확정 확인 창 취소 */
      const P=S; P.current=0; P.mainUsed=false; P.battlesUsed=0; P.forcedTargets=[]; P.forcedQueue=[]; P.movedPiece=null;
      C.q=[]; endTurnAt(T,20); ok(S.phase==="shop"&&!S.eco.shop.done[0]&&S.eco.shop.done[1],"Q1 PVE 20턴 상점 — AI 즉시 완료, 사람 대기");
      const u=unit(T,T.ROSTER.find(r=>!ownKeys(T,0).includes(r.id)).id,2,2); S.eco.bag[0]=[u];
      adv(10000); const c0=S.eco.coins[0]; act(T,{t:"shopGood",player:0,item:"ball"}); T.__shop("sell",u.uid);   // 볼 = 확정 · 판매 = 확인 창만
      adv(S90-10000-1); ok(S.phase==="shop","Q1 PVE 정기 상점 89.999초엔 진행 중");
      adv(1); ok(S.phase==="play"&&S.eco.coins[0]===c0-1&&S.eco.bag[0].includes(u)&&S.balls[0]===1,"Q1 PVE 만료 → 확정 구매 보존 · 미확정 판매 취소 · 상점 종료");
    }
    /* Q2 핫시트 S01: P1 표시 순간 90초 → 가림(시간 불산입) → 가림 확인 뒤 P2 90초 */
    const T=boot("pvp"), S=T.S;
    ok(!covered(T)&&S.setupPlayer===0,"Q2 P1 S01 은 첫 화면에서 바로 보인다");
    eq(T.byId("shopClock").textContent,"⏱ 90초","Q2 P1 S01 표시 즉시 90초 시작");
    adv(S90-1); ok(!S.eco.shop.done[0],"Q2 P1 S01 89.999초엔 진행 중");
    adv(1); ok(T.ecoEmptyField(S,0).length===0&&!S.pieces.some(x=>x.owner===0&&!x.placed),"Q2 P1 S01 90초 만료 → 자동 구매 · 자동 배치");
    ok(covered(T)&&S.setupPlayer===1,"Q2 P1 은 그 자리에서 준비까지 끝나 곧바로 P2 가림 (#263 배치 90초 재발행 없음)");
    T.render(); T.render();                                              // 가림 뒤에서 다시 그려져도 P2 시간은 시작하지 않는다
    adv(10*S90); ok(!S.eco.shop.done[1]&&T.ecoEmptyField(S,1).length===6,"Q2 가림이 15분 떠 있어도 P2 S01 은 만료되지 않는다 (가림 불산입)");
    confirm(T); ok(!covered(T),"Q2 가림 확인 → P2 상점 표시");
    eq(T.byId("shopClock").textContent,"⏱ 90초","Q2 P2 S01 은 가림 확인 뒤 표시 순간부터 90초");
    adv(45000); T.render(); adv(S90-45000-1); ok(!S.eco.shop.done[1],"Q2 P2 S01 89.999초엔 진행 중 (중간 다시 그리기 무관)");
    adv(1); ok(T.ecoEmptyField(S,1).length===0&&!S.pieces.some(x=>x.owner===1&&!x.placed),"Q2 P2 S01 90초 만료 → 자동 구매 · 자동 배치");
    ok(S.phase==="play","Q2 P2 도 곧바로 준비 → 두 좌석 배치 확정으로 경기 시작 (#263)");
    /* Q3 핫시트 정기 상점 (20턴 P2 먼저): 가림 대기 불산입 · 좌석마다 새 90초 · 확정 보존 / 미확정 취소 */
    confirm(T); S.current=0; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; S.movedPiece=null;
    endTurnAt(T,20); const first=S.eco.shop.active, second=1-first;
    ok(S.phase==="shop"&&first===1&&covered(T),"Q3 20턴 상점 — P2 먼저, 가림부터");
    adv(10*S90); ok(!S.eco.shop.done[first],"Q3 첫 좌석 가림 대기는 시간에 들어가지 않는다");
    confirm(T); eq(T.byId("shopClock").textContent,"⏱ 90초","Q3 첫 좌석 가림 확인 → 90초 시작");
    const u=unit(T,T.ROSTER.find(r=>!ownKeys(T,first).includes(r.id)).id,2,2); S.eco.bag[first]=[u];
    adv(20000); const c1=S.eco.coins[first], b1=S.balls[first];
    act(T,{t:"shopGood",player:first,item:"ball"}); T.__shop("sell",u.uid);             // 확정 구매 1 + 열린 판매 확인 창
    adv(S90-20000-1); ok(!S.eco.shop.done[first],"Q3 첫 좌석 89.999초엔 진행 중 (거래·다시 그리기 뒤에도 마감 유지)");
    adv(1); ok(S.eco.shop.done[first]&&S.eco.coins[first]===c1-1&&S.balls[first]===b1+1&&S.eco.bag[first].includes(u),"Q3 첫 좌석 만료 → 확정 구매 보존 · 미확정 판매 취소");
    ok(S.phase==="shop"&&S.eco.shop.active===second&&covered(T),"Q3 만료 뒤 가림을 거쳐 다음 좌석");
    adv(10*S90); ok(!S.eco.shop.done[second],"Q3 둘째 좌석 가림 대기 불산입 (앞 좌석 시계 누수 없음)");
    confirm(T); eq(T.byId("shopClock").textContent,"⏱ 90초","Q3 둘째 좌석도 자기 상점 표시 순간부터 새 90초");
    adv(S90-1); ok(S.phase==="shop"&&!S.eco.shop.done[second],"Q3 둘째 좌석 89.999초엔 진행 중");
    adv(1); ok(S.phase==="play"&&!S.eco.shop,"Q3 둘째 좌석 만료 → 상점 종료 · 순차 합계 최대 180초 (가림 제외)");
    /* Q4 좌석이 먼저 끝내면 그 시계는 멈춘다 · 새 경기로 옛 마감이 새지 않는다 */
    confirm(T); S.current=0; S.phase="play"; endTurnAt(T,40); const f2=S.eco.shop.active;
    ok(f2===0,"Q4 40턴 상점은 P1 먼저 (교대)");
    confirm(T); adv(30000); act(T,{t:"shopDone",player:f2}); confirm(T);             // P1 30초에 완료 → P2 가림 확인
    adv(S90-30000+1); ok(S.phase==="shop"&&!S.eco.shop.done[1-f2],"Q4 먼저 끝낸 좌석의 옛 시계는 다음 좌석을 끝내지 않는다");
    const T5=boot("pve",{aiLevel:"grade5"}); adv(60000); if(T5.TUT.open) T5.tutClose(); T5.startMode("pve",{aiLevel:"grade5"});   // 재시작 경로(초기화 없이) — gameReset 이 옛 마감을 지운다
    adv(S90-60000+1); ok(!T5.S.eco.shop.done[0],"Q4 새 경기 S01 은 옛 경기 마감(90초)에 끝나지 않는다");
    adv(60000-2); ok(!T5.S.eco.shop.done[0],"Q4 새 경기 S01 89.999초엔 진행 중"); adv(1); ok(T5.S.phase==="play"&&!T5.S.eco.shop,"Q4 새 경기 S01 은 자기 90초에 만료 (자동 구매·배치·준비까지)");
    /* Q5 sim(AI vs AI) 은 상점 시계를 걸지 않는다 (온라인 종전 경제는 O 절) */
    const T6=boot("sim"); ok(C.q.every(x=>x.at-C.now<S90),"Q5 AI vs AI 에는 90초 상점 시계가 없다");
  } finally { global.setTimeout=saved.st; global.clearTimeout=saved.ct; global.setInterval=saved.si; global.clearInterval=saved.ci; Date.now=saved.now; }
}

/* ===== P. 실제 브라우저 적재 방식 (#236 라이브 실패) =====
   하네스는 모든 <script> 를 한 함수로 이어 eval 하지만 브라우저는 파일마다 따로 전역에 적재한다. 전역 선언이 호스트의
   구성 불가(configurable:false) window 멤버와 겹치면 그 파일 전체가 SyntaxError 로 버려진다 — Orca 내장 브라우저는
   window.close 가 구성 불가라 `function close()` 하나 때문에 ui-overlays.js 가 통째로 빠져 handoff 가 없었다.
   여기서는 index.html 의 src 순서대로 파일마다 따로 적재하고, Window 멤버 이름을 모두 구성 불가로 막아 둔다.
   런타임 오류(DOM 부재)는 상관없다 — 선언 인스턴스화가 성공했는지만 본다: 파일의 최상위 함수가 모두 전역에 있어야 한다. */
{
  const vm=require("vm"), fs=require("fs");
  const html=fs.readFileSync(htmlPath,"utf8"), dir=path.dirname(htmlPath);
  const srcs=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
  const WIN=["close","open","stop","focus","blur","print","alert","confirm","prompt","postMessage","name","status","closed","frames",
    "length","top","opener","parent","self","window","document","location","history","navigator","origin","screen","event","external",
    "scroll","scrollTo","scrollBy","find","moveTo","moveBy","resizeTo","resizeBy","localStorage","sessionStorage","customElements"];
  const ctx=vm.createContext({});
  vm.runInContext(`for(const n of ${JSON.stringify(WIN)}) Object.defineProperty(globalThis,n,{value:function(){},configurable:false,writable:false});`,ctx);
  ok(srcs.length>=8,"P 외부 스크립트 목록을 읽었다 ["+srcs.join(",")+"]");
  for(const s of srcs){
    const code=fs.readFileSync(path.join(dir,s),"utf8"); let err=null;
    try{ new vm.Script(code,{filename:s}).runInContext(ctx); }catch(e){ err=e; }
    const fns=[...code.matchAll(/^(?:async\s+)?function\s+([\w$]+)/gm)].map(m=>m[1]);
    const lost=fns.filter(n=>vm.runInContext("typeof "+n,ctx)!=="function");
    ok(!lost.length,`P ${s} 가 따로 적재돼도 최상위 함수 ${fns.length}개가 전역에 선다`+(lost.length?` [없음 ${lost.slice(0,5)} · ${err&&err.name}: ${err&&err.message}]`:""));
  }
  ok(["handoff","handoffCover","modal","closeModal","memoModal","tutOpen"].every(n=>vm.runInContext("typeof "+n,ctx)==="function"),
    "P 교대 가림(handoff·handoffCover)·창(modal·closeModal) 이 다른 파일에서 보인다");
}

console.log(`=== smoke_issue236: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("failed: "+fails.join(" | ")); process.exit(1); }
