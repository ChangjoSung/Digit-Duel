/* #263 클라이언트(Mars) — 배치 90초 · 게임 행동 30초 · 단절 정지 입력 잠금 · 6칸 진열/SOLD OUT 화면
   실행: node demo/test/regression/smoke_issue263_client.js [demo/index.html]
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).
   근거: Issue #263 본문(2026-09-25 CJ Q1=A·Q2=A) · GDD-23 2.2·2.4 · docs/milestone/v0.4.11/issues/263/Jupiter/report.md 4절

   절
     A  진열 6칸 · 산 칸 SOLD OUT 은 화면에서도 구매 불가 (서버 {key,grade,soldOut,sold} 좌석 뷰 모양 포함)
     B  로컬(PVE·핫시트) 배치 90초 — 직접 완료한 좌석만 · 시간 초과 좌석은 다시 걸지 않는다 · 가림 불산입 · 만료 = 자동 배치 + 준비
     C  로컬 행동 30초 — 전투 판정·연출 중 정지(Q2=A) · 만료 1회 턴 넘김 · 출전 후보도 같은 30초 · AI 턴엔 없다
     D  온라인 — 서버 시계(room_state.clock)의 place·act 를 표시만 한다(로컬 마감 0) · running:false 는 "(정지)"
     E  단절 정지 — 양측 게임 입력·기권 잠금(사유 표시) · 복구 시 해제
     F  정지 중 송신 끝(Saturn REVISE) — 상점 window.__shop · B08 · **먼저 열려 있던** 기권 확인 창이 netAction 을
        우회해 보내던 구멍 · 정지 중 잠긴 모습 · 복구 뒤 입력 복원 · 복구 명령(leave)은 잠기지 않는다
   Core·서버 규칙은 Jupiter 소관이라 여기서 다시 검사하지 않는다 (server/authoritative/test/test-issue263-timers.js). */
"use strict";
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(got===want,name+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }

/* 가짜 시계 — 하네스 스텁 타이머는 지연을 무시하므로 이 파일은 자기 시계를 건다. setInterval 은 실제처럼 되풀이한다:
   #263 정지 해제(전투·연출·가림이 끝난 자리)는 다시 그리기가 아니라 이 간격이 알아채므로 그 경로를 그대로 검사한다. */
const C={now:1e9,q:[],id:0};
function arm(){ // load() 가 스텁으로 되돌리므로 로드마다 다시 건다
  global.setTimeout=(fn,ms)=>{ const id=++C.id; C.q.push({id,at:C.now+(ms||0),fn}); return id; };
  global.clearTimeout=id=>{ C.q=C.q.filter(x=>x.id!==id); };
  global.setInterval=(fn,ms)=>{ const id=++C.id; C.q.push({id,at:C.now+(ms||1),fn,every:ms||1}); return id; };
  global.clearInterval=id=>{ C.q=C.q.filter(x=>x.id!==id); };
}
function adv(ms){ const end=C.now+ms;
  for(let guard=0;guard<500000;guard++){
    const due=C.q.filter(x=>x.at<=end).sort((a,b)=>a.at-b.at||a.id-b.id)[0]; if(!due) break;
    C.now=due.at; if(due.every) due.at=C.now+due.every; else C.q=C.q.filter(x=>x!==due);
    due.fn();
  }
  C.now=end;
}
const saved={st:global.setTimeout,ct:global.clearTimeout,si:global.setInterval,ci:global.clearInterval,now:Date.now};
Date.now=()=>C.now;
const load=()=>H.load(htmlPath);
const boot=(mode,opts)=>{ const T=load(); arm(); T.FX.force=true; if(T.TUT.open) T.tutClose(); C.q=[]; T.startMode(mode,opts); return T; };
const act=(T,a)=>T.dispatchCoreAction(a);
const covered=T=>T.byId("overlay").classList.contains("handoff");
const confirmCover=T=>{ const k=T.byId("obBtns").children, b=k.slice().reverse().find(x=>/확인 — 시작/.test(x.textContent)); k.length=0; if(b) b.onclick(); return !!b; };
const unplaced=(T,p)=>T.S.pieces.filter(x=>x.owner===p&&!x.placed).length;
/* S01 을 **직접** 끝낸다 (시간 초과가 아니라) — 노출 칸을 필드가 찰 때까지 사고 완료를 누른다 */
function buyAllAndDone(T,p){
  const S=T.S;
  for(let n=0;n<12&&T.ecoEmptyField(S,p).length;n++){ const i=T.ecoBuyable(S,p); if(i<0) break;
    act(T,{t:"shopBuy",player:p,i,seq:S.eco.shop.seq[p]}); }
  act(T,{t:"shopDone",player:p});
}
/* 공개 방 좌석 뷰 한 장 (room.js toSeatView 모양) — clock/pause 만 바꿔 가며 표시·잠금을 본다 */
function netBoot(){ const N=load(); arm(); N.NET.me=0; N.NET.publicMode=true; N.NET.mode=true; N.NET.started=true; C.q=[]; return N; }
function netFrame(clock,pause){
  const own={id:"u-m1",r:10,c:4,owner:0,type:"minion",element:"fire",name:"x",hp:10,maxHp:10,atk:5,skillAtk:5,
    rosterId:null,skills:[],cdMax:0,immobile:0,cap:null,alive:true,placed:true,movedEver:false,revealed:false};
  const f={seat:0,state:"IN_PROGRESS",phase:"play",revision:1,turnCount:3,current:0,mainUsed:false,battlesUsed:0,
    seats:{ready:[true,true]},units:[{id:"u-o1",r:4,c:4,owner:1,alive:true,immobile:0}],
    you:{pieces:[own],inv:[],balls:0,reserve:null,pkgs:{itemGift:0,battleBuff:0},selected:null,placed:true,teleUsed:0,
      eco:{coins:3,tickets:0,buffInv:{power:0,time:0,escape:0},soldHp:{},bag:[]}},
    battle:null,fleePick:null,modal:null,log:[],events:[],result:null,turn:null,
    fx:{firstSeq:null,lastSeq:0,events:[]},clock};
  if(pause) f.pause=pause;
  return f;
}
/* #263 Saturn REVISE 절 F — 경제 공개 방 한 판(로컬 경제 상태 + 공개 방 좌석) · 회선 송신을 세는 가짜 소켓 */
function ecoNetBoot(){ const T=boot("pve",{aiLevel:"grade5"});
  T.NET.me=0; T.NET.publicMode=true; T.NET.mode=true; T.NET.started=true; T.NET.roomId=9;
  const sent=[]; T.NET.ws={readyState:1,send:m=>sent.push(JSON.parse(m))}; T.sent=sent; return T; }
const setPause=(T,on)=>{ T.NET.pause=on?[{seat:1,graceLeftMs:42000}]:[]; };
const toastText=T=>T.byId("toasts").children.map(x=>x.textContent).join("|");
const lastBtns=(T,n)=>T.byId("obBtns").children.slice(-n); // 스텁 문서는 obBtns 를 비우지 않는다 — 마지막 창의 버튼만 본다
const sentActs=T=>T.sent.map(x=>x.t==="action"?x.action.t:x.t);

const P90=90000, A30=30000;

/* #263 후속(T1~T4) 절 I·J·K 용 — S01 을 시간 초과로 끝내고 곧바로 경기 중(play)으로 들어간 판.
   주 행동은 이미 썼다고 두어(mainUsed) 남는 시한이 "고르는 시간"뿐이게 한다. 턴 시작 연출은 흘려 보드 30초를 흐르게 한다. */
function playBoot(){
  const T=boot("pve",{aiLevel:"grade5"}), S=T.S;
  act(T,{t:"shopTimeout",player:0}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  S.current=0; S.mainUsed=true; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; S.movedPiece=null;
  T.render(); adv(4000);
  return T;
}
const leftSec=c=>Math.round((c.dl?c.dl-C.now:c.left)/1000); // 시계 하나의 남은 초 (흐르는 중이면 마감까지)
/* 이동으로 새 인접이 생긴 판을 **보드째** 세운다 — 적격 강제 대상 n개(n=1·2). 판정(adjEnemies·contactEligible)은 Core 가 그대로 한다.
   실제 이동 경로를 흉내 내지 않는 이유는 이 파일이 **시한**을 보기 때문이다 (이동·접촉 규칙은 #18·#245 회귀가 본다). */
function forceAdj(T,n){
  const S=T.S;
  const free=[]; for(let r=2;r<11;r++) for(let c=0;c<7;c++) free.push([r,c]);
  const at=(r,c)=>S.pieces.find(x=>x.alive&&x.placed&&x.r===r&&x.c===c);
  const evict=(r,c)=>{ const o=at(r,c); if(!o) return;
    const spot=free.find(([rr,cc])=>!at(rr,cc)&&Math.abs(rr-r)+Math.abs(cc-c)>2); if(spot){ o.r=spot[0]; o.c=spot[1]; } };
  const mine=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive&&x.placed);
  const foes=S.pieces.filter(x=>x.owner===1&&x.type==="minion"&&x.alive&&x.placed).slice(0,n);
  const put=(p,r,c)=>{ evict(r,c); p.r=r; p.c=c; };
  put(mine,6,3); put(foes[0],6,4);
  if(n>1) put(foes[1],5,3);
  S.movedPiece=mine; S.forcedTargets=foes.map(x=>x.id); S.tempReveal.add(foes[0].id);
  if(n>1) S.tempReveal.add(foes[1].id);
  return {mine,foes};
}

try{

/* ===== A. 진열 6칸 · SOLD OUT 은 화면에서도 살 수 없다 ===== */
{
  const T=boot("pve",{aiLevel:"grade5"}), S=T.S;
  eq(S.eco.shop.slots[0].length,6,"A1 S01 진열은 6칸 (#263 5→6)");
  eq((T.shopHtml(0).match(/SOLD OUT/g)||[]).length,0,"A2 구매 전에는 SOLD OUT 이 없다");
  const i=T.ecoBuyable(S,0); act(T,{t:"shopBuy",player:0,i,seq:S.eco.shop.seq[0]});
  const slot=S.eco.shop.slots[0][i];
  ok(!!slot&&slot.soldOut===true,"A3 산 칸은 비지 않고 soldOut 으로 남는다 (즉시 보충 없음)");
  const html1=T.shopHtml(0), line=html1.split("</div>").find(x=>/SOLD OUT/.test(x));
  ok(!!line,"A4 산 칸은 화면에 SOLD OUT 으로 그려진다");
  ok(!!line&&!/__shop\('buy'/.test(line),"A5 SOLD OUT 칸에는 구매 버튼이 없다 (수동 새로 고침 전까지 구매 불가)");
  eq((html1.match(/__shop\('buy'/g)||[]).length,5,"A6 나머지 5칸만 구매 가능 — 자동 보충 없음");
  /* 서버 좌석 뷰 모양 {key,grade,soldOut,sold} 도 같은 화면을 그린다 (room.js _shopView) */
  const k=S.eco.shop.slots[0][(i+1)%6].key;
  S.eco.shop.slots[0][(i+1)%6]={key:k,grade:1,soldOut:false,sold:true}; S.eco.shop.sold[0].push(k);
  ok(/판매함/.test(T.shopHtml(0)),"A7 종전 판매 잠금 칸(sold)은 '판매함' 으로 남는다");
}

/* ===== B. 로컬 배치 90초 ===== */
{
  /* B1 PVE — S01 을 직접 끝내면 그 좌석만 배치 90초를 받는다 */
  const T=boot("pve",{aiLevel:"grade5"}), S=T.S;
  buyAllAndDone(T,0); T.render();
  ok(S.eco.shop.done[0]&&S.phase==="setup"&&T.UI.prep==="place","B1 S01 직접 완료 → 02 비공개 배치");
  eq(T.byId("placeClock").textContent,"⏱ 90초","B2 배치 화면 표시 즉시 남은 시간 90초");
  adv(40000); T.render(); T.render();
  eq(T.byId("placeClock").textContent,"⏱ 50초","B3 다시 그리기는 마감을 되돌리지 않는다");
  adv(P90-40000-1); ok(unplaced(T,0)>0&&S.phase==="setup","B4 89.999초엔 아직 배치 중");
  adv(1); ok(unplaced(T,0)===0&&S.phase==="play","B5 90초 만료 → 미배치 말 자동 배치 + 준비(경기 시작)");
  eq(T.byId("placeClock").textContent,"","B6 경기가 시작되면 배치 시계 표시가 비워진다 (.badge:empty 로 숨는다)")

  /* B7 14개를 다 놓고도 [배치 완료]를 누르지 않은 좌석 — 시계는 **확정 전까지** 흐른다(서버 placed && ready 와 같은 끝 조건).
     만료는 직접 놓은 좌표를 보존하고 못 놓은 말만 채운 뒤 한 번만 확정한다. */
  const T1=boot("pve",{aiLevel:"grade5"}), S1=T1.S;
  buyAllAndDone(T1,0); T1.netAction({t:"auto"}); T1.render();
  eq(unplaced(T1,0),0,"B7 사람이 14개를 모두 배치했다");
  eq(T1.byId("placeClock").textContent,"⏱ 90초","B8 다 놓아도 확정 전까지 배치 90초는 계속 흐른다 (교착 방지)");
  const mine=S1.pieces.filter(x=>x.owner===0);
  const keep=mine.slice(2).map(x=>[x.id,x.r,x.c]);      // 직접 놓은 좌표 — 만료 뒤에도 그대로여야 한다
  mine[0].placed=false; mine[1].placed=false;           // 두 개만 미배치로 되돌려 "못 놓은 말만 채운다"를 본다
  T1.render();
  adv(P90); ok(T1.S.phase==="play","B9 만료 → 미배치 말만 채우고 한 번 확정해 경기가 시작된다");
  ok(keep.every(([id,r,c])=>{ const x=T1.S.pieces.find(y=>y.id===id); return x&&x.r===r&&x.c===c; }),
     "B10 직접 놓은 좌표는 자동 배치가 덮어쓰지 않는다");
  eq(unplaced(T1,0),0,"B11 되돌린 두 말도 합법 위치에 놓였다");

  /* B12 S01 을 90초 만료로 끝낸 좌석은 자동 구매·자동 배치에 이어 **그 자리에서 확정**한다 — 배치 90초를 다시 걸지 않는다 */
  const T2=boot("pve",{aiLevel:"grade5"});
  adv(P90); // 상점 90초 만료 (SHOPCLK) — 실제 화면 경로 그대로
  eq(unplaced(T2,0),0,"B12 S01 시간 초과 좌석은 자동 구매에 이어 자동 배치까지 끝난다");
  ok(T2.S.phase==="play","B13 그 좌석은 곧바로 준비(확정)로 이어져 경기가 시작된다");
  eq(!!T2.TURNCLK.c.place,false,"B14 그 좌석에는 배치 90초가 새로 걸리지 않는다");

  /* B9 핫시트 — 가림(handoff) 중에는 배치 시간이 흐르지 않는다 */
  const T3=boot("pvp"), S3=T3.S;
  buyAllAndDone(T3,0); T3.render();
  eq(T3.byId("placeClock").textContent,"⏱ 90초","B15 P1 배치 90초 시작");
  adv(P90+1); ok(S3.setupPlayer===1&&covered(T3),"B16 P1 만료 → 자동 배치·준비 뒤 P2 가림");
  adv(10*P90); ok(!S3.eco.shop.done[1],"B17 가림이 15분 떠 있어도 P2 시간은 흐르지 않는다");
  ok(confirmCover(T3),"B18 가림 확인");
  buyAllAndDone(T3,1); T3.render();
  eq(T3.byId("placeClock").textContent,"⏱ 90초","B19 P2 도 자기 화면 표시 순간부터 새 90초");
  adv(P90); ok(S3.phase==="play"&&unplaced(T3,1)===0,"B20 P2 만료 → 자동 배치·준비 → 경기 시작");
}

/* ===== C. 로컬 행동 30초 ===== */
{
  const T=boot("pve",{aiLevel:"grade5"}), S=T.S;
  act(T,{t:"shopTimeout",player:0}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  S.current=0; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; S.movedPiece=null;
  T.render();
  eq(T.TURNCLK.c.act&&T.TURNCLK.c.act.key,"act:"+S.turnCount+":0","C1 사람 차례에 행동 30초가 선다");
  eq(T.byId("actClock").textContent,"⏱ 30초 (정지)","C2 턴 시작 연출 동안에는 멈춰 있다 (전투 판정·연출 중 정지)");
  adv(3000); eq(T.byId("actClock").textContent.indexOf("정지"),-1,"C3 연출이 끝나면 남은 시간부터 이어 흐른다");
  const t0=S.turnCount;
  adv(A30+3000); ok(T.S.turnCount>t0,"C4 30초 만료 → 미완료 행동 1회 생략하고 턴을 넘긴다");
  const S2=T.S; S2.current=1; T.render();
  eq(!!T.TURNCLK.c.act,false,"C5 AI 차례에는 행동 30초를 걸지 않는다");
  S2.current=0; T.render(); eq(!!T.TURNCLK.c.act,true,"C6 사람 차례로 돌아오면 다시 선다");

  /* C7 출전 후보(B02)도 같은 30초 안이다 — 만료 시 '본체 출전'으로 대신 고른다 (Q2=A · 전용 타이머 없음) */
  const T4=boot("pve",{aiLevel:"grade5"}), S4=T4.S;
  act(T4,{t:"shopTimeout",player:0}); T4.netAction({t:"auto"}); T4.netAction({t:"setupDone"});
  S4.current=0; S4.mainUsed=false; S4.battlesUsed=0; S4.forcedTargets=[]; S4.forcedQueue=[]; S4.movedPiece=null;
  T4.render(); adv(4000);                                   // 턴 시작 연출을 흘려 시계를 흐르게 한다
  const ally=S4.pieces.find(x=>x.owner===0&&x.type==="ally"), foe=S4.pieces.find(x=>x.owner===1&&x.type==="minion");
  if(!S4.eco.bag[0].length){ const v={uid:++S4.eco.unitSeq,paid:0,fresh:false,revealed:false,reaperSeal:0,cap:null};
    T4.applySpecies(v,T4.ROSTER[0],1); S4.eco.bag[0].push(v); }
  act(T4,{t:"battleEntryBegin",attId:ally.id,defId:foe.id});
  ok(!!T4.S.entryPick&&T4.S.entryPick.stage==="A","C7 왕·동료 + 가방 말 → 출전 후보 선택이 열린다");
  eq(!!T4.TURNCLK.c.act&&!T4.TURNCLK.c.pick,true,"C8 강제 전투와 무관한 후보 선택은 그대로 행동 30초 안이다 (전용 20초 타이머 없음)");
  adv(A30); ok(!T4.S.entryPick||T4.S.entryPick.A==="body"||!!T4.S.battle,"C9 만료 → 서버와 같은 기본 선택(본체 출전)으로 진행한다");

  /* C10 답을 기다리는 탐색 보상 화면도 서버 _autoModalIndex 와 같은 '포기' 자리로 생략하고 턴을 넘긴다 */
  const T5=boot("pve",{aiLevel:"grade5"}), S5=T5.S;
  act(T5,{t:"shopTimeout",player:0}); T5.netAction({t:"auto"}); T5.netAction({t:"setupDone"});
  S5.current=0; S5.mainUsed=false; S5.battlesUsed=0; S5.forcedTargets=[]; S5.forcedQueue=[]; S5.movedPiece=null;
  T5.render(); adv(4000);
  const pc=T5.S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive&&x.placed);
  T5.S.recruitToken=1;
  T5.S.recruit={owner:0,pieceId:pc.id,species:T5.ROSTER[0].id,stage:"root",skill:null,targetId:null,recvId:null,token:pc.id+"#1"};
  const t5=T5.S.turnCount;
  eq(!!T5.TURNCLK.c.act,true,"C10 탐색 보상 선택 중에도 시계는 행동 30초 하나뿐이다");
  adv(A30); ok(!T5.S.recruit&&T5.S.turnCount>t5,"C11 만료 → 탐색 보상을 '포기'로 생략하고 턴을 넘긴다");

  /* C12 T1 (2026-09-25 CJ 후속) — 아무 행동도 고르지 않은 채 만료되면 **이행 불가 강제 표식이 남아 있어도**
     평범한 턴 종료 경로로 넘어간다. 종전에는 Core 가 endTurn 을 거부해 그 좌석이 차례를 쥔 채 경기가 멈췄다
     (폐기된 한계 — Jupiter 보고 5-1 → 7절). 만료 표식(timeout)이 그 거부를 지난다. */
  const T6=boot("pve",{aiLevel:"grade5"}), S6=T6.S;
  act(T6,{t:"shopTimeout",player:0}); T6.netAction({t:"auto"}); T6.netAction({t:"setupDone"});
  S6.current=0; S6.mainUsed=true; S6.battlesUsed=0; S6.forcedQueue=[]; S6.movedPiece=null;
  S6.forcedTargets=[T6.S.pieces.find(x=>x.owner===1&&x.alive&&x.placed).id];
  T6.render(); adv(4000);
  const auto0=T6.S.metrics.byPlayer[0].autoEnds||0, turn6=T6.S.turnCount;
  adv(A30); const auto1=T6.S.metrics.byPlayer[0].autoEnds||0;
  eq(auto1-auto0,1,"C12 그 만료 처리는 1회뿐이다 (간격마다 되풀이 보내지 않는다)");
  ok(T6.S.turnCount>turn6,"C13 T1 — 이행 불가 강제 표식이 남아도 빈손 만료는 턴을 넘긴다");
  eq((T6.S.forcedTargets||[]).length,0,"C14 그 자리에서 강제 표식이 접힌다 (차례를 쥔 채 멈추지 않는다)");
}

/* ===== D. 온라인 — 서버 시계 표시만 ===== */
{
  const N=netBoot();
  N.netApplyRoomState(netFrame({key:"act",leftMs:17000,running:true}),false);
  eq(N.byId("actClock").textContent,"⏱ 17초","D1 온라인 행동 30초는 서버가 보낸 남은 시간을 표시한다");
  eq(Object.keys(N.TURNCLK.c).length,0,"D2 온라인에서는 로컬 마감을 걸지 않는다 (판정은 서버)");
  adv(5000); eq(N.byId("actClock").textContent,"⏱ 12초","D3 받은 순간부터 표시만 줄어든다");
  N.netApplyRoomState(netFrame({key:"act",leftMs:9000,running:false}),false);
  eq(N.byId("actClock").textContent,"⏱ 9초 (정지)","D4 running:false 는 남은 시간을 들고 '(정지)' 로 보인다");
  adv(5000); eq(N.byId("actClock").textContent,"⏱ 9초 (정지)","D5 정지 중에는 표시도 줄지 않는다");
  N.netApplyRoomState(netFrame({key:"bag",leftMs:9000,running:true}),false);
  eq(N.byId("actClock").textContent,"","D6 다른 시한(B08)일 때는 행동 배지가 비어 있다 (.badge:empty 로 숨는다)");
}

/* ===== E. 단절 정지 — 양측 게임 입력·기권 잠금 ===== */
{
  const N=netBoot();
  N.netApplyRoomState(netFrame({key:"act",leftMs:12000,running:true}),false);
  ok(!N.netPaused(),"E1 평시에는 정지가 아니다");
  const live=N.byId("turnBar").children.filter(b=>b.textContent==="기권");
  ok(live.length===1&&live[0].disabled===false,"E2 평시 기권 버튼은 눌린다 (경제 방은 상대 차례에도 가능)");
  N.netApplyRoomState(netFrame({key:"act",leftMs:12000,running:false},[{seat:1,graceLeftMs:42000}]),false);
  ok(N.netPaused(),"E3 서버가 단절을 확정하면(room_state.pause) 정지 상태다");
  const tb=N.byId("turnBar").children;
  const CMD=["탐색","🌀 텔레포트","🌿 회복","기권"]; // 배지(span)가 아니라 조작 버튼만 — 문구 그대로 고른다
  eq(tb.filter(b=>CMD.includes(b.textContent)&&b.disabled===false).length,0,
     "E4 정지 중에는 기권을 포함한 모든 턴 조작 버튼이 비활성이다");
  eq(tb.filter(b=>CMD.includes(b.textContent)).length,CMD.length,"E4b 조작 버튼 4개는 그대로 그려진다 (사라지지 않고 비활성)");
  ok(/⏸ 연결 대기/.test(tb.map(x=>x.textContent).join("|")),"E5 정지 사유를 턴바에 표시한다");
  ok(/disabled/.test(N.netResignBtn())&&/기권도 잠겨/.test(N.netResignBtn()),"E6 상점·B08 화면의 기권 버튼도 사유와 함께 비활성이다");
  const bar=N.document.getElementById("netResumeBar");
  ok(!!bar&&/기권을 포함한 양측 입력이 잠기고/.test(bar.innerHTML),"E7 고정 상태 줄이 정지·유예·입력 잠금을 알린다");
  const rev=N.NET.revision, phase=N.S.phase;
  N.netAction({t:"resign"}); N.netAction({t:"cell",r:9,c:4});
  ok(N.S.phase===phase&&N.NET.revision===rev,"E8 정지 중 기권·보드 입력은 상태를 바꾸지 않는다 (서버 E_PAUSED 와 같은 결론)");
  ok(N.fxLocked(),"E9 정지 중에는 원본 입력 잠금(fxLocked)이 켜진다 — 연출·수신 재생도 함께 멈춘다");
  N.netApplyRoomState(netFrame({key:"act",leftMs:12000,running:true}),false);
  ok(!N.netPaused()&&!N.fxLocked(),"E10 복구되면 정지가 풀린다");
  const back=N.byId("turnBar").children.filter(b=>b.textContent==="기권");
  ok(back.length===1&&back[0].disabled===false,"E11 복구 뒤 기권·조작이 되돌아온다");
  eq(N.byId("actClock").textContent,"⏱ 12초","E12 남은 시간은 서버 값 그대로 이어진다");
}

/* ===== F. 정지 중 송신 끝 — netAction 을 지나지 않는 입력도 막힌다 (Saturn READ_ONLY QA 재현) ===== */
{
  const T=ecoNetBoot();
  eq(T.shopViewer(),0,"F0 시작 상점 화면의 주인이 나다 (공개 방 경제 판)");
  T.__shop("good","ball");
  eq(sentActs(T).join(","),"shopGood","F1 평시에는 상점 구매 의도가 회선으로 나간다");
  setPause(T,true);
  T.__shop("good","ball"); T.__shop("refresh"); T.__shop("done");
  eq(sentActs(T).join(","),"shopGood","F2 정지 중 상점 입력은 한 건도 나가지 않는다 (window.__shop 은 netAction 을 지나지 않는다)");
  ok(/복구될 때까지/.test(toastText(T)),"F3 막힌 이유를 토스트로 알린다");
  const ph=T.shopHtml(0);
  ok(/<fieldset class="pauseLock" disabled/.test(ph),"F4 정지 중 상점은 통째로 잠긴 모습이다 (<fieldset disabled> — 안쪽 버튼 전부 비활성)");
  ok(/상점 조작이 잠겨 있습니다/.test(ph),"F5 상점 화면에 사유를 적는다");
  ok(!/pauseLock/.test((setPause(T,false),T.shopHtml(0))),"F6 복구되면 잠금 래퍼가 사라진다");
  T.__shop("good","ball");
  eq(sentActs(T).join(","),"shopGood,shopGood","F7 복구 뒤 같은 입력이 다시 나간다 (재연결 = 입력 복원)");
}
{ /* B08 — 소유자 선택 창 */
  const T=ecoNetBoot();
  const u={name:"길동",grade:1,hp:5,maxHp:5,paid:3,uid:1};
  T.S.eco.bag[0]=[u,Object.assign({},u,{uid:2}),Object.assign({},u,{uid:3})];
  T.S.eco.bagPick={owner:0,token:"tk",unit:{name:"포획",grade:2}};
  setPause(T,true); T.bagPickShow();
  eq(lastBtns(T,4).filter(b=>b.disabled===true).length,4,"F8 정지 중 B08 선택 버튼 4개가 모두 실제 disabled 다");
  ok(/선택이 잠겨 있습니다/.test(T.byId("overlayBox").innerHTML),"F9 B08 창에도 사유를 적는다");
  eq(T.netSendAction({t:"bagPick",i:0,token:"tk"}),false,"F10 그래도 보내려 하면 송신 끝에서 막히고 false 를 돌려준다");
  eq(sentActs(T).length,0,"F11 정지 중 B08 선택은 회선에 나가지 않는다");
  setPause(T,false); T.bagPickShow();
  eq(lastBtns(T,4).filter(b=>b.disabled===true).length,0,"F12 복구되면 같은 창의 선택이 되돌아온다");
  lastBtns(T,4)[0].onclick();
  eq(sentActs(T).join(","),"bagPick","F13 복구 뒤 선택이 회선으로 나간다");
}
{ /* 먼저 열려 있던 기권 확인 창 — Saturn 이 지적한 netSendCmd("resign") 직행 경로 */
  const T=ecoNetBoot();
  T.netEcoResign();
  const btn=()=>lastBtns(T,2)[0];
  eq(btn().textContent,"기권 확정","F14 평시에는 기권 확인 창이 열린다");
  setPause(T,true);              // 창을 연 **뒤에** 단절이 시작된다
  btn().onclick();
  eq(sentActs(T).length,0,"F15 열려 있던 기권 확인의 확정도 회선에 나가지 않는다 (확정 시점 재검사)");
  ok(!T.byId("overlay").classList.contains("hidden"),"F16 막혔으므로 확인 창을 닫지 않는다 (복구 뒤 다시 누를 수 있다)");
  ok(/복구될 때까지/.test(toastText(T)),"F17 조용히 삼키지 않고 사유를 알린다");
  setPause(T,false);
  btn().onclick();
  eq(sentActs(T).join(","),"resign","F18 복구되면 같은 버튼이 기권을 보낸다");
  ok(T.byId("overlay").classList.contains("hidden"),"F19 보낸 뒤에는 확인 창이 닫힌다");
  /* 위 F15~F17 은 지금의 modal() 이 정지를 알아채기 때문에도 통과할 수 있다 — 구멍의 뿌리는 **기권 확인이 송신 끝을
     건너뛰고 netSendCmd("resign") 를 직접 부르던 것**이었으므로 그 구조 자체를 못 박는다. */
  eq((T.html.match(/netSendCmd\("resign"\)/g)||[]).length,1,"F19b 회선 기권 명령은 단일 송신 끝(netSendAction) 안 한 곳에서만 나간다");
  ok(/기권 확정",\(\)=>\{ if\(!netSendAction\(\{t:"resign"\}\)\)/.test(T.html),"F19c 기권 확인의 확정은 그 송신 끝을 지나고, 막히면 창을 그대로 둔다");
}
{ /* 잠기는 것은 게임 입력뿐 — 복구 경로는 열려 있다 */
  const T=ecoNetBoot();
  setPause(T,true);
  T.netSyncOverlays(true);
  ok(/^P\|/.test(String(T.NET.overlaySig)),"F20 정지 토글을 오버레이 서명이 알아챈다 (상점·B08 이 잠긴 모습으로 다시 그려진다)");
  T.netLeaveRoom();
  ok(T.sent.some(x=>x.t==="leave"),"F21 정지 중에도 방 나가기(복구 포기)는 보낸다 — 잠그는 것은 게임 입력이다");
}


/* ===== G. 정지 중 출전 준비(SETUP) 입력 — Saturn 2차 READ_ONLY 감사 NO-GO 재현 =====
   준비 취소는 netAction 도 netSendAction 도 지나지 않고 netSendCmd("unready") 로 직행했다 — 그것도
   NET.readyWanted/readySent 를 **먼저 지우고** 보냈다. 서버는 E_PAUSED 로 거부하므로 권위 상태는 그대로인데
   화면만 배치 단계로 되돌아가 준비 의사를 잃었다(입력 동결 계약 F 위반). */
function setupNetBoot(ready){
  const T=boot("pvp"); T.NET.me=0; T.NET.publicMode=true; T.NET.started=false; T.NET.roomId=9;
  T.NET.roomState="SETUP"; T.NET.mySetup={roster:[],pos:[]}; T.NET.readyWanted=!!ready; T.NET.readySent=!!ready;
  const sent=[]; T.NET.ws={readyState:1,send:m=>sent.push(JSON.parse(m))}; T.sent=sent;
  T.S.setupPlayer=0; return T;
}
const sideHtml=T=>{ T.renderSide(); return T.byId("sidePanel").innerHTML; };
{
  const T=setupNetBoot(true);
  const live=sideHtml(T);
  ok(/onclick="netRoomReady\(false\)"/.test(live)&&!/pauseLock/.test(live),"G1 평시에는 [준비 취소]가 그대로 동작한다");
  setPause(T,true);
  const html=sideHtml(T);
  ok(/<fieldset class="pauseLock" disabled[^>]*>[\s\S]*?준비 취소<\/button>[\s\S]*?<\/fieldset>/.test(html),"G2 정지 중 [준비 취소]는 잠긴 모습이다 (<fieldset disabled> 안)");
  ok(/준비 취소가 잠겨 있습니다/.test(html),"G3 잠긴 사유를 화면에 적는다");
  ok(/onclick="netLeaveRoom\(\)"/.test(html)&&!/<fieldset[\s\S]*?netLeaveRoom[\s\S]*?<\/fieldset>/.test(html),"G4 복구 입력(방 나가기)은 잠금 밖에 남는다");
  /* 모습뿐 아니라 동작도 — 직접 불러도 상태를 바꾸지도, 보내지도 않는다 */
  T.netRoomReady(false);
  eq(T.sent.length,0,"G5 정지 중 준비 취소는 unready 를 보내지 않는다");
  ok(T.NET.readyWanted===true&&T.NET.readySent===true,"G6 준비 의사(readyWanted/readySent)를 잃지 않는다 — 서버 권위 상태와 갈라지지 않는다");
  ok(/복구될 때까지/.test(toastText(T)),"G7 막힌 이유를 토스트로 알린다");
  ok(/준비 취소<\/button>/.test(sideHtml(T)),"G8 화면도 준비 단계에 그대로 머물러 있다 (배치로 되돌아가지 않는다)");
  /* 준비 의사를 **걸려는** 반대 방향도 같다 — 같은 가드 하나가 둘 다 막는다 */
  T.NET.readyWanted=false; T.NET.readySent=false;
  T.netRoomReady(true);
  eq(T.sent.length,0,"G9 정지 중 준비 의사도 setup·ready 를 보내지 않는다");
  ok(T.NET.readyWanted===false,"G10 정지 중에는 상태를 걸지도 않는다 (송신 전 차단)");
  /* 복구 — 잠금과 사유가 사라지고 같은 버튼이 다시 동작한다 */
  setPause(T,false); T.NET.readyWanted=true; T.NET.readySent=true;
  const back=sideHtml(T);
  ok(!/pauseLock/.test(back)&&/onclick="netRoomReady\(false\)"/.test(back),"G11 복구되면 잠금 래퍼가 사라지고 버튼이 되돌아온다");
  T.netRoomReady(false);
  eq(T.sent.map(x=>x.t).join(","),"unready","G12 복구 뒤 같은 버튼이 unready 를 보낸다");
  ok(T.NET.readyWanted===false&&T.NET.readySent===false,"G13 그때서야 준비 의사를 푼다");
}
{ /* 배치 화면(02 비공개 배치)의 조작 버튼도 같은 잠금을 쓴다 — 종전에는 netAction 토스트만 뜨고 모습은 열려 있었다 */
  const T=setupNetBoot(false);
  setPause(T,true);
  const html=sideHtml(T);
  ok(/<fieldset class="pauseLock" disabled[^>]*>[\s\S]*?autoPlace\(\)[\s\S]*?setupDone\(\)[\s\S]*?<\/fieldset>/.test(html),"G14 정지 중 배치 조작(무작위 배치·전체 회수·배치 완료)이 통째로 잠긴다");
  ok(/배치 조작이 잠겨 있습니다/.test(html),"G15 배치 화면에도 사유를 적는다");
  T.netAction({t:"auto"});
  eq(T.sent.length,0,"G16 정지 중 배치 입력은 회선에 나가지 않는다 (종전 netAction 가드 유지)");
  setPause(T,false);
  ok(!/pauseLock/.test(sideHtml(T)),"G17 복구되면 배치 조작이 되돌아온다");
}

/* ===== H. 정지 해제 순서 — 대기 콜백은 권위 상태 재수화 **뒤**에 돌아야 한다 (Saturn 2차 순서 위험) =====
   종전에는 netApplyRoomState 가 NET.pause 를 갱신한 바로 그 자리에서 fxIdle() 을 불렀다 — NET.revision 은 이미
   새 값이고 S 는 아직 옛 보드라, 대기 콜백과 autoEndCheck 가 낡은 turn/state 로 자동 입력을 보낼 수 있었다. */
{
  const N=netBoot();
  const sent=[]; N.NET.ws={readyState:1,send:m=>sent.push(JSON.parse(m))};
  N.netApplyRoomState(netFrame({key:"act",running:true,remainMs:20000},[{seat:1,graceLeftMs:42000}]));
  ok(N.netPaused(),"H1 정지 프레임을 받으면 멈춰 있다");
  eq(N.S.turnCount,3,"H2 정지 시점의 턴 수");
  const seen=[];
  N.fxWhenIdle(()=>seen.push({turn:N.S.turnCount,rev:N.NET.revision})); // 잠금 중이라 보류된다
  eq(seen.length,0,"H3 정지 중에는 대기 콜백이 돌지 않는다");
  const f=netFrame({key:"act",running:true,remainMs:20000}); f.turnCount=9; f.revision=7; // 정지 해제 + 새 권위 상태
  N.netApplyRoomState(f);
  eq(seen.length,1,"H4 정지가 풀리면 보류된 대기 콜백이 그 프레임에서 하나 돈다");
  eq(seen[0]&&seen[0].turn,9,"H5 그 콜백은 **재수화된** 턴을 읽는다 (옛 3턴이 아니다)");
  eq(seen[0]&&seen[0].rev,7,"H6 revision 과 보드가 같은 시점이다 — 낡은 상태에 새 revision 을 실을 수 없다");
  eq(sent.filter(x=>x.t==="action").length,0,"H7 정지 해제 프레임에서 낡은 자동 입력이 나가지 않는다");
}

/* ===== I. T2·T3 강제 전투 대상 선택 30초 — 적격 대상이 둘 이상일 때만, 보드 30초와 **다른 자리**에서 =====
   근거: Issue #263 본문(2026-09-25 CJ 후속 T2·T3) · Venus timer-rule-sync 1절 · Jupiter 보고 7-2. */
{
  const T=playBoot(), S=T.S;
  const one=forceAdj(T,1);
  T.render();
  eq(!!T.TURNCLK.c.pick,false,"I1 T2 — 적격 대상이 하나면 대상 선택 30초를 새로 세지 않는다 (곧바로 전투다)");
  eq(!!T.TURNCLK.c.act,true,"I1b 그동안 보드 30초는 그대로 돈다");
  ok(!!one,"I1c 대상 하나짜리 판을 세웠다");

  /* I2 대상이 둘 이상이면 **그 자리에서 새 30초**가 서고, 보드 30초는 남은 시간을 지킨 채 멈춘다 */
  const T2=playBoot(), S2=T2.S;
  const base=leftSec(T2.TURNCLK.c.act);
  adv(12000); T2.render();
  eq(leftSec(T2.TURNCLK.c.act),base-12,"I2 보드 30초가 12초를 썼다");
  forceAdj(T2,2); T2.render();
  eq(!!T2.TURNCLK.c.pick,true,"I3 T3 — 적격 대상이 둘 이상이면 대상 선택 30초가 새로 선다");
  eq(leftSec(T2.TURNCLK.c.pick),30,"I4 그 시계는 **전체 30초**로 시작한다 (보드 잔여를 물려받지 않는다)");
  eq(T2.TURNCLK.c.act.dl,0,"I5 보드 30초는 그동안 멈춘다 (마감이 풀려 있다)");
  eq(leftSec(T2.TURNCLK.c.act),base-12,"I6 멈춘 보드 시계는 남은 시간을 그대로 들고 있다 — 고르는 시간이 보드 시간을 깎지 않는다");
  eq(T2.byId("actClock").textContent,"⏱ 30초","I7 보드 배지는 지금 흐르는 시계(대상 선택 30초)를 보여 준다");
  /* I8 만료 → 서버와 같은 Core 어휘(forcedAuto)로 적격 후보 중 하나를 고르고 전투를 연다. 턴은 넘어가지 않는다 */
  const turn2=S2.turnCount, auto2=S2.metrics.byPlayer[0].autoEnds||0;
  adv(A30);
  eq((S2.forcedTargets||[]).length<=1,true,"I8 만료 → 적격 후보가 하나로 좁혀진다 (서버 대행과 같은 Core 어휘)");
  eq(S2.turnCount,turn2,"I9 대상 선택 만료는 **턴을 넘기지 않는다** — 그 선택만 대신한다");
  eq((S2.metrics.byPlayer[0].autoEnds||0)-auto2,0,"I10 자동 턴 종료를 보내지 않는다");
  ok(S2.log.some(l=>/시간 초과/.test(l.msg)),"I11 서버가 대신 고른 사실이 사람의 선택과 구분돼 기록된다 (AC11 · 어느 말인지는 적지 않는다)");
  eq(leftSec(T2.TURNCLK.c.act),base-12,"I12 보드 30초는 그 값 그대로다 (대상 선택이 빼앗지 않았다)");

  /* I13 만료가 **전투를 열면 거기서 멈추고**, 전투가 끝난 자리에서 마무리를 **딱 한 번** 보낸다.
     이것이 만료 1회 래치(fired)가 실제로 지키는 자리다 — 없으면 같은 마무리를 500ms 간격마다 되풀이 보낸다. */
  const T3=playBoot(), S3=T3.S;
  forceAdj(T3,1);
  const turn3=S3.turnCount, auto3=S3.metrics.byPlayer[0].autoEnds||0;
  adv(A30);
  ok(!!S3.battle,"I13 보드 30초 만료가 남은 강제 전투를 연다 (T2 — 적격 대상 하나)");
  eq(S3.turnCount,turn3,"I14 전투가 열린 동안에는 턴을 넘기지 않는다");
  eq((S3.metrics.byPlayer[0].autoEnds||0)-auto3,0,"I15 그 시점에 자동 턴 종료를 보내지 않는다");
  S3.battle=null; S3.forcedTargets=[]; S3.forcedQueue=[]; T3.render(); adv(8000); // 전투가 끝나고 연출 잠금까지 풀린 자리
  const after=S3.metrics.byPlayer[0].autoEnds||0;
  eq(after-auto3,1,"I16 전투가 끝난 자리에서 **한 번만** 마무리한다");
  adv(2000);
  eq((S3.metrics.byPlayer[0].autoEnds||0),after,"I17 같은 자리에서 간격이 네 번 더 돌아도 다시 보내지 않는다 (만료 1회 래치)");
}

/* ===== J. T4 전투 행동 60초 — 그 행동만 건너뛰고 전투는 계속된다 ===== */
{
  const T=playBoot(), S=T.S;
  const base=leftSec(T.TURNCLK.c.act);
  adv(9000);
  eq(leftSec(T.TURNCLK.c.act),base-9,"J1 전투 전 보드 30초가 9초를 썼다");
  const pair=forceAdj(T,1); T.initBattle(pair.mine,pair.foes[0]);
  if(T.S.entryPick) act(T,{t:"battleEntryPick",side:T.S.entryPick.stage,what:"body"});
  /* 선공을 공격자(사람)로 고정한다 — 시계 주인은 S.current 가 아니라 **지금 행동자**라, 선공이 속도로 정해지는
     무작위 로스터에서는 AI 방어자가 먼저 행동하는 판이 섞여 든다(그때는 사람 시계가 없는 것이 옳다 — J14 가 그 반대를 본다). */
  if(S.battle){ S.battle.firstSide="A"; S.battle.phase=0; }
  adv(200); T.battleModal(); // 전투 화면이 그려질 때까지만 — 진입 카운트다운(3·2·1·배틀 시작!)은 아직 흐르는 중이다
  ok(!!S.battle,"J2 전투가 열렸다");
  eq(!!T.TURNCLK.c.battle,true,"J3 전투 행동 60초가 선다 (새 종류의 시계다)");
  eq(leftSec(T.TURNCLK.c.battle),60,"J4 전투 화면에 60초가 전체 시간으로 선다 (AC10)");
  eq(T.byId("battleClock").textContent,"⏱ 60초 (정지)","J4b 진입 카운트다운 동안에는 멈춘 채 보인다");
  adv(9000); // 진입 연출(3·2·1·배틀 시작!)을 흘린다
  const bl=leftSec(T.TURNCLK.c.battle);
  ok(bl>=55&&bl<60,`J4c 연출이 끝난 자리부터 흐른다 — 진입 연출 시간은 60초를 먹지 않는다 [실측 ${bl}]`);
  eq(T.TURNCLK.c.act.dl,0,"J5 보드 30초는 전투 동안 멈춘다");
  eq(leftSec(T.TURNCLK.c.act),base-9,"J6 멈춘 보드 시계는 남은 시간을 그대로 들고 있다");
  const key0=T.TURNCLK.c.battle.key, seq0=S.battle.actSeq||0;
  adv(20000); T.battleModal(); // 하위 메뉴·다시 그리기로는 60초가 되살아나지 않는다
  eq(T.TURNCLK.c.battle.key,key0,"J7 같은 행동을 다시 그려도 같은 시계다 (키 불변)");
  eq(leftSec(T.TURNCLK.c.battle),bl-20,"J8 남은 시간이 그대로 이어진다 (다시 그려도 60초가 되살아나지 않는다)");
  adv(45000);
  ok(!!S.battle,"J9 만료돼도 전투는 계속된다 (전투 취소·즉시 패배 없음)");
  ok((S.battle.actSeq||0)>seq0,"J10 그 전투원의 행동 하나만 건너뛴다 (행동 토큰이 하나 올라간다)");
  ok(S.battle.blog.some(l=>/시간이 초과/.test(l)),"J11 건너뛴 사실이 사람의 넘기기와 구분돼 기록된다 (AC10·AC11)");
  ok(!T.TURNCLK.c.battle||T.TURNCLK.c.battle.key!==key0,"J12 다음 전투 행동에는 새 60초가 선다 (같은 시계가 이어지지 않는다)");
  eq(leftSec(T.TURNCLK.c.act),base-9,"J13 보드 30초는 전투 내내 그 값을 지킨다");
}
{ /* J14 로컬 PVE — **보드 차례가 AI 여도 사람 방어자**가 지금 전투 행동자면 그 좌석의 60초가 선다.
     주인 판정은 S.current 가 아니라 Core actorOfPhase()·attP/defP.owner 다 (Mercury local-battle-actor 경계). */
  const T=playBoot(), S=T.S;
  const pair=forceAdj(T,1);
  S.movedPiece=null; S.forcedTargets=[]; S.current=1; S.mainUsed=true; S.battlesUsed=0; // 보드 차례 = AI 좌석의 선택 전투
  T.initBattle(pair.foes[0],pair.mine);               // 공격자 = AI(1) · 방어자 = 사람(0)
  for(let n=0;n<4&&S.entryPick;n++) act(T,S.entryPick.stage==="reveal"?{t:"battleEntryGo"}:{t:"battleEntryPick",side:S.entryPick.stage,what:"body"});
  adv(200);
  ok(!!S.battle,"J14 전투가 열렸다 (AI 공격 · 사람 방어)");
  if(!S.battle) throw new Error("J14 전제 실패 — 아래 방어자 단언을 건너뛰지 않는다");
  S.battle.firstSide="A"; S.battle.phase=1;           // 후공 = 방어자(사람) 차례
  T.battleModal();
  eq(!!T.TURNCLK.c.act,false,"J15 보드 차례가 AI 라 보드 30초는 서지 않는다");
  eq(!!T.TURNCLK.c.battle,true,"J16 그래도 사람 방어자의 전투 행동 60초는 선다");
  eq(T.TURNCLK.c.battle.p,0,"J17 그 시계의 주인은 지금 행동할 방어자(사람)다 — S.current(AI)가 아니다");
  const seqD=S.battle.actSeq||0;
  adv(9000+60000);                                    // 진입 연출 + 60초
  ok(!S.battle||(S.battle.actSeq||0)>seqD,"J18 만료 → 방어자의 그 행동 하나만 건너뛴다 (전투는 이어진다)");
}

/* ===== K. 온라인 — 서버 시계의 pick·battle 표시 · 늦은 입력 잠금 · 로컬 판정 금지 ===== */
{
  const N=netBoot();
  N.netApplyRoomState(netFrame({key:"pick",leftMs:21000,running:true}),false);
  eq(N.byId("actClock").textContent,"⏱ 21초","K1 대상 선택 30초(pick)도 보드 배지에 그대로 보인다 — 새 카운트다운을 만들지 않는다 (AC9)");
  eq(N.turnClockText("battle"),"","K2 그때 전투 배지는 비어 있다");
  N.netApplyRoomState(netFrame({key:"battle",leftMs:45000,running:true}),false);
  eq(N.turnClockText("battle"),"⏱ 45초","K3 전투 행동 60초는 서버 값 그대로 보인다");
  eq(N.byId("actClock").textContent,"","K4 그때 보드 배지는 비어 있다");
  adv(5000); eq(N.turnClockText("battle"),"⏱ 40초","K5 받은 순간부터 표시만 줄어든다");
  ok(!N.turnClockLate("battle"),"K6 시한 안에서는 늦은 입력이 아니다");
  adv(41000); ok(N.turnClockLate("battle"),"K7 서버 마감이 지나면 늦은 입력으로 판정해 조작을 잠근다 (서버는 E_DEADLINE)");
  N.netApplyRoomState(netFrame({key:"battle",leftMs:9000,running:false}),false);
  ok(!N.turnClockLate("battle"),"K8 정지(running:false) 는 마감 경과가 아니다");
  eq(Object.keys(N.TURNCLK.c).length,0,"K9 온라인에서는 로컬 시계를 하나도 걸지 않는다");
}
{ /* K13 단절 정지는 전투 행동 60초도 멈추고, 재연결 유예 60초만 흐른다 (서로 다른 시계다 — Venus 1절 표) */
  const N=netBoot();
  N.netApplyRoomState(netFrame({key:"battle",leftMs:42000,running:false},[{seat:1,graceLeftMs:55000}]),false);
  ok(N.netPaused(),"K13 서버가 단절을 확정했다");
  eq(N.turnClockText("battle"),"⏱ 42초 (정지)","K14 전투 행동 60초도 잔여를 안고 멈춘다");
  adv(9000);
  eq(N.turnClockText("battle"),"⏱ 42초 (정지)","K15 정지 중에는 전투 시계 표시가 줄지 않는다");
  const bar=N.document.getElementById("netResumeBar");
  ok(/재연결 유예 4[0-9]초/.test(bar.innerHTML),"K16 그동안 재연결 유예 60초만 흐른다 (게임 시계와 별개의 시계)");
  N.netApplyRoomState(netFrame({key:"battle",leftMs:42000,running:true}),false);
  eq(N.turnClockText("battle"),"⏱ 42초","K17 복구되면 남은 42초부터 이어 센다 (새 60초가 아니다)");
}
{ /* K10 온라인에서 클라이언트가 강제 대상·만료를 **스스로** 결정하지 않는다 — 같은 판을 공개 방 좌석으로 바꿔 본다 */
  const T=playBoot(), S=T.S;
  forceAdj(T,2);
  const sent=[]; T.NET.me=0; T.NET.publicMode=true; T.NET.mode=true; T.NET.started=true;
  T.NET.ws={readyState:1,send:m=>sent.push(JSON.parse(m))}; T.sent=sent;
  T.NET.ecoClock={key:"pick",leftMs:1,running:true,at:C.now};
  T.turnClockSync(); adv(5*A30);
  eq(Object.keys(T.TURNCLK.c).length,0,"K10 온라인 판에서는 로컬 마감이 서지 않는다");
  eq((S.forcedTargets||[]).length,2,"K11 대상을 클라이언트가 난수로 좁히지 않는다 (서버 권위)");
  eq(T.sent.filter(x=>x.t==="action").length,0,"K12 만료를 스스로 판정해 보내지도 않는다");
}

} finally {
  global.setTimeout=saved.st; global.clearTimeout=saved.ct; global.setInterval=saved.si; global.clearInterval=saved.ci; Date.now=saved.now;
}

console.log(`=== smoke_issue263_client: pass ${pass} / fail ${fail} ===`);
if(fail){ console.error("실패 목록:\n - "+fails.join("\n - ")); process.exit(1); }
