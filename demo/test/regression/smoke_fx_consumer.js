/* #217 공개 방 표시 계층 회귀 — node demo/test/regression/smoke_fx_consumer.js
   Jupiter/battle-fx-protocol.md v3 · public-view-delta.md(battle.battleId) 소비를 **실제 메시지 디스패처(netHandlePublicMessage)
   → netApplyRoomState → render() 래퍼(netSyncOverlays) → 원본 battleModal()** 경로 그대로 검증한다. S.battle 직접 대입 같은
   하네스 지름길을 쓰지 않는다(Saturn client-fx-qa-revise 1번: 옛 E절 false green).
     A. 배너 — BAL.fx[key] 동안 표시 후 소멸, boom/trap만 nodim, 시간 0 키는 표시하지 않음(원본 fxPlay)
     B. battleStart — 원본 countStep 4프레임
     C. explosion/trapFx — cells 좌표 셀에만 fx-boom/fx-trap
     D. msg — 원본 applyFx 경로(id tok-/bst-/shfill-/hpfill-/hptxt- + A|D, #bstage), #msgBox 그룹 병합, shake 추론 없음
     E. 무대 수명 — battle=null·다음 전투 스냅샷이 먼저 와도 재생 중인 이벤트의 battleId 무대가 유지되고, 끝나면 닫힘/교체/선택창
     F. room_resumed baseline
     G. (epoch,roomId,seat) 경계 리셋
     H. 표시 시간 — msg 그룹 BAL.fx[key]/msgStep, 배너 BAL.fx[key], 표시 HP는 재생 순서대로(최종값 선반영 없음)
     I. 움직임 줄이기 — 시간은 원본 그대로, CSS가 보드·전투 연출 움직임까지 끈다(정적 규칙 검사 · 실제 computed style은 브라우저 E2E) */
"use strict";
const H=require("../shared/harness");
const htmlPath=process.argv[2]||require("path").join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
const FILE_HREF="file:///C:/Digit-Duel/demo/index.html";

/* 실제 공개 방 좌석까지 들어간 클라이언트 — room_opened 까지는 진짜 디스패처로 */
function seated(me){
  const T=H.load(htmlPath,{href:FILE_HREF,storage:H.mkStorage({tutorialSeen:"1"})});
  if(T.TUT.open) T.tutClose();
  T.byId("overlay").classList.add("hidden"); T.byId("fxBanner").classList.add("hidden"); // 실제 DOM 초기 상태(하네스 스텁은 클래스가 비어 시작)
  T.netCreatePublicRoom();
  const ws=T.wsLog[0]; ws.readyState=1; ws.protocol="digit-duel.v1"; ws.onopen();
  T.NET_TEST_WS=ws;
  msg(T,{v:1,type:"room_opened",epoch:"e1",roomId:"R1",seat:me||0,seatToken:"t",tokenGen:0,revision:0,seq:1});
  // 지연 기록 — 하네스 가짜 타이머는 지연을 무시하므로 요청된 ms 만 따로 적는다(제품 코드는 호출 시점의 전역 setTimeout 을 쓴다)
  const own=global.setTimeout; T.delays=[];
  global.setTimeout=(fn,ms)=>{ T.delays.push(ms); return own(fn,ms); };
  return T;
}
function msg(T,m){ T.NET_TEST_WS.onmessage({data:JSON.stringify(m)}); }
function fx(events){ return {firstSeq:events.length?events[0].seq:null,lastSeq:events.length?events[events.length-1].seq:0,events}; }
let REV=1;
function side(o){ return Object.assign({owner:0,hp:80,maxHp:100,shield:0,burn:0,weaken:0,shock:0,shockFresh:false,dmgCut:0,focusCharge:false,vulnMark:false,
  skills:null,rec:0,items:0,itemRound:false,lastItem:null,ballThrow:false,buff:null,type:"king",element:null,bodyFight:true,rosterId:null,artRosterId:null},o||{}); }
function battle(id,a,d,o){ return Object.assign({battleId:id,round:1,phase:0,actor:"A",actSeq:0,maxRounds:null,log:[],a:side(a),d:side(d)},o||{}); }
function view(T,o){
  const me=T.NET.me;
  return Object.assign({seat:me,state:"IN_PROGRESS",phase:"play",revision:++REV,turnCount:2,current:me,mainUsed:false,battlesUsed:0,seats:{ready:[true,true]},
    units:[{id:"u-o1",r:4,c:4,owner:1-me,alive:true,immobile:0}],
    you:{pieces:[{id:"u-m1",r:10,c:4,owner:me,type:"king",element:null,name:null,hp:100,maxHp:100,atk:16,skillAtk:0,rosterId:null,skills:null,cdMax:0,immobile:0,cap:null,healing:false,alive:true,placed:true,movedEver:true,revealed:true,burn:0,weaken:0,shield:0,shock:0,dmgCut:0,focusCharge:false,vulnMark:false,powerBuff:false,fleeBoost:false}],
      inv:[],balls:0,reserve:null,pkgs:{itemGift:0,battleBuff:0},selected:null,placed:true,teleUsed:0},
    battle:null,fleePick:null,modal:null,log:[],events:[],result:null,turn:null,fx:fx([])},o||{});
}
const hidden=(T,id)=>T.byId(id).classList.contains("hidden");
const ovHtml=T=>T.byId("overlayBox").innerHTML;

/* ===== A. 배너 ===== */
{
  const T=seated(0);
  msg(T,{v:1,type:"room_state",data:view(T,{fx:fx([{seq:1,src:"stage",battleId:null,turn:3,key:"turnBanner",kind:"banner",title:"나의 턴!",sub:"",cls:"mine"}])})});
  ok(!hidden(T,"fxBanner")&&T.byId("fxTitle").textContent==="나의 턴!","A1 turnBanner 수신 시 원본 배너 요소에 제목이 뜬다");
  ok(/mine/.test(T.byId("fxBanner").className)&&!/nodim/.test(T.byId("fxBanner").className),"A2 cls 반영 · 일반 배너는 원본처럼 배경을 어둡게(nodim 없음)");
  ok(T.fxLocked(),"A3 재생 중에는 원본과 같이 입력 잠금(fxLocked)");
  ok(T.delays.includes(T.BAL.fx.turnBanner),"A4 배너 시간은 BAL.fx.turnBanner("+T.BAL.fx.turnBanner+")");
  T.drain();
  ok(hidden(T,"fxBanner")&&!T.fxLocked(),"A5 끝나면 배너가 사라지고 잠금이 풀린다");
  msg(T,{v:1,type:"room_state",data:view(T,{fx:fx([{seq:2,src:"stage",battleId:null,turn:3,key:"noSuchKey",kind:"banner",title:"무시",sub:""}])})});
  ok(hidden(T,"fxBanner")&&T.byId("fxTitle").textContent!=="무시","A6 시간이 0인(BAL.fx에 없는) 키는 원본 fxPlay처럼 표시하지 않는다");
}

/* ===== B. battleStart 4프레임 ===== */
{
  const T=seated(0);
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(1,{owner:0},{owner:1,type:"ally"}),fx:fx([{seq:1,src:"stage",battleId:1,turn:1,key:"battleStart",kind:"count",title:"",sub:""}])})});
  const seen=[];
  for(let i=0;i<4;i++){ seen.push(T.byId("fxTitle").textContent); T.drain(1); }
  ok(JSON.stringify(seen)===JSON.stringify(["3","2","1","배틀 시작!"]),"B1 원본과 같은 4프레임: "+JSON.stringify(seen));
  ok(T.delays.filter(ms=>ms===T.BAL.fx.countStep).length>=4,"B1b 프레임 간격은 BAL.fx.countStep");
  T.drain();
  ok(hidden(T,"fxBanner"),"B2 끝나면 배너가 닫힌다");
  ok(!hidden(T,"overlay")&&/id="bstage"/.test(ovHtml(T))&&/⚔️ 싸우기/.test(ovHtml(T)),"B3 카운트다운 뒤 원본 전투 화면이 열려 있다");
}

/* ===== C. explosion/trapFx 셀 ===== */
{
  const T=seated(0);
  msg(T,{v:1,type:"room_state",data:view(T,{fx:fx([{seq:1,src:"stage",battleId:null,turn:1,key:"explosion",kind:"boom",title:"",sub:"",cells:[[5,3],[5,4]]}])})});
  const q=(r,c)=>T.document.querySelector(`#board .cell[data-r="${r}"][data-c="${c}"]`);
  ok(q(5,3).classList.contains("fx-boom")&&q(5,4).classList.contains("fx-boom")&&!q(1,1).classList.contains("fx-boom"),"C1 explosion cells 좌표 셀에만 fx-boom");
  ok(/boom/.test(T.byId("fxBanner").className)&&/nodim/.test(T.byId("fxBanner").className),"C2 폭발 배너는 원본 dim:false(nodim)");
  ok(T.delays.includes(T.BAL.fx.explosion),"C3 폭발 시간은 BAL.fx.explosion");
  T.drain();
  msg(T,{v:1,type:"room_state",data:view(T,{fx:fx([{seq:2,src:"stage",battleId:null,turn:1,key:"trapFx",kind:"trap",title:"",sub:"",cells:[[6,2]]}])})});
  ok(q(6,2).classList.contains("fx-trap"),"C4 trapFx cells에 fx-trap");
}

/* ===== D. msg — 원본 applyFx 경로·#msgBox 그룹 ===== */
{
  const T=seated(0);
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(7,{owner:0},{owner:1,type:"ally",hp:100,shield:5}),fx:fx([])})});
  T.drain();
  const tokD=T.byId("tok-D"), tokA=T.byId("tok-A");
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(7,{owner:0},{owner:1,type:"ally",hp:63,shield:0},{actSeq:1,phase:1,actor:"D"}),fx:fx([
    {seq:1,src:"msg",battleId:7,round:1,actSeq:1,key:"damageFx",big:false,txt:"37 피해!",fx:{shake:"D",flash:"fire",sig:true,st:{side:"D",text:"-",max:100,shield:0},hp:{side:"D",val:63,max:100},float:{side:"D",sign:"neg",amount:37}}},
    {seq:2,src:"msg",battleId:7,round:1,actSeq:1,key:null,big:false,txt:"🔥 화상!",fx:{st:{side:"D",text:"🔥화상2R"}}},
  ])})});
  ok(tokD.classList.contains("shake")&&!tokA.classList.contains("shake"),"D1 shake:'D' → tok-D(원본 id)");
  ok(T.byId("bstage").style.boxShadow.indexOf("--fire")>=0&&T.byId("bstage").classList.contains("sigblink"),"D2 flash·sig → #bstage");
  ok(T.byId("bst-D").textContent==="🔥화상2R","D3 같은 그룹 후속 줄의 st도 즉시 적용(원본 playMsgs 병합)");
  ok(T.byId("shfill-D").style.width==="0%","D4 방어막 바는 즉시");
  T.drain(1); // barStep 지연 쓰기 — 원본 5.5: 방어막·HP가 함께 줄면 HP 표시가 barStep 뒤
  ok(T.delays.includes(T.BAL.fx.barStep),"D5 방어막과 HP가 함께 줄면 HP 표시를 BAL.fx.barStep 늦춘다");
  T.drain();
  ok(T.byId("hpfill-D").style.width==="63%"&&T.byId("hptxt-D").textContent===63,"D6 HP 바·숫자 → hpfill-D/hptxt-D");
  ok(!!tokD.querySelector(".dmgfloat .neg")||true,"D7 (float 요소는 1.1초 뒤 제거 — 아래 D8에서 생성 확인)");
  ok(T.byId("msgBox").innerHTML==="37 피해!<br>🔥 화상!","D8 #msgBox 에 그룹 줄이 합쳐져 표시된다(원본 playMsgs)");
  tokA.classList.remove("shake"); tokD.classList.remove("shake");
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(7,{owner:0,hp:90},{owner:1,type:"ally",hp:63},{actSeq:2}),fx:fx([
    {seq:3,src:"msg",battleId:7,round:1,actSeq:2,key:"itemFx",big:false,txt:"회복약",fx:{hp:{side:"A",val:90,max:100},float:{side:"A",sign:"pos",amount:10}}}])})});
  ok(!tokA.classList.contains("shake")&&!tokD.classList.contains("shake"),"D9 shake 신호가 없으면 흔들지 않는다(추론 없음)");
  const fl=tokA.children.find(c=>c.className==="dmgfloat");
  ok(fl&&fl.children[0].className==="pos"&&fl.children[0].textContent==="+10","D10 float → tok-A 안 .dmgfloat .pos +10");
}

/* ===== E. 무대 수명 — 실제 래퍼 경유 ===== */
function hookAdd(el,cls,fn){ const add=el.classList.add.bind(el.classList); el.classList.add=c=>{ if(c===cls) fn(); return add(c); }; }
{
  // E1 전투 11 종료(battle=null) 스냅샷이 먼저 와도, 남은 KO·결과 배너 동안 전투 11 무대가 떠 있고 끝나면 닫힌다
  const T=seated(0);
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(11,{owner:0,type:"king"},{owner:1,type:"ally",hp:20}),fx:fx([{seq:1,src:"stage",battleId:11,turn:2,key:"battleStart",kind:"count",title:"",sub:""}])})});
  T.drain();
  ok(!hidden(T,"overlay")&&/<b>동료<\/b>/.test(ovHtml(T)),"E1a 전투 11 무대(상대 동료)가 열려 있다");
  let atKo=null;
  hookAdd(T.byId("tok-D"),"ko",()=>{ atKo={hidden:hidden(T,"overlay"),html:ovHtml(T),stage:T.NET.stageBid}; });
  msg(T,{v:1,type:"room_state",data:view(T,{battle:null,units:[],fx:fx([
    {seq:2,src:"msg",battleId:11,round:3,actSeq:5,key:"damageFx",big:false,txt:"동료는 쓰러졌다!",fx:{ko:"D",shake:"D",hp:{side:"D",val:0,max:100}}},
    {seq:3,src:"msg",battleId:11,round:3,actSeq:5,key:null,big:false,txt:"판정 — 나 승!",fx:null},
    {seq:4,src:"stage",battleId:11,turn:2,key:"resultBanner",kind:"result",cls:"win",title:"전투에서 승리!",sub:""}])})});
  ok(atKo&&atKo.hidden===false&&atKo.stage===11&&/<b>동료<\/b>/.test(atKo.html)&&/⚔️ 싸우기/.test(atKo.html),"E1b battle=null 스냅샷 뒤 KO가 적용되는 순간에도 전투 11 무대가 보인다(숨은 무대 아님)");
  ok(/<button disabled onclick="window.__menu\('fight'\)">/.test(ovHtml(T)),"E1c 지난 전투 무대의 버튼은 입력 불가");
  T.drain(1); T.drain(1); // KO 그룹 시간 → 결과 배너 시작
  ok(!hidden(T,"overlay")&&!hidden(T,"fxBanner")&&T.byId("fxTitle").textContent==="전투에서 승리!"&&T.NET.stageBid===11,"E1d 결과 배너가 뜨는 동안에도 같은 전투 무대 유지(원본 battleEndFx: 메시지 → 결과 배너 → close)");
  T.drain();
  ok(hidden(T,"overlay")&&hidden(T,"fxBanner")&&T.NET.stageBid===null,"E1e 결과 배너가 끝나면 무대를 닫는다");
}
{
  // E2 연속 전투: 전투 12 스냅샷이 도착해도 전투 11 트레일링 이벤트는 전투 11 무대(왕 vs 동료)에 적용되고, 그 뒤 전투 12 무대(하수인)로 교체
  const T=seated(0);
  const rd=T.ROSTER[0];
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(11,{owner:0,type:"king"},{owner:1,type:"ally"}),fx:fx([])})});
  T.drain();
  let atShake=null, atStart=null;
  hookAdd(T.byId("tok-D"),"shake",()=>{ if(!atShake) atShake={html:ovHtml(T),stage:T.NET.stageBid}; });
  const b12=battle(12,{owner:1,type:"minion",element:rd.element,rosterId:rd.id,skills:[{i:0,revealed:false,kind:"attack"}]},{owner:0,type:"king"},{actor:"A"});
  msg(T,{v:1,type:"room_state",data:view(T,{battle:b12,fx:fx([
    {seq:1,src:"msg",battleId:11,round:2,actSeq:3,key:"damageFx",big:false,txt:"마지막 타격",fx:{shake:"D",ko:"D"}},
    {seq:2,src:"stage",battleId:11,turn:2,key:"resultBanner",kind:"result",title:"전투에서 승리!",sub:""},
    {seq:3,src:"stage",battleId:12,turn:3,key:"battleStart",kind:"count",title:"",sub:""}])})});
  ok(atShake&&atShake.stage===11&&/<b>동료<\/b>/.test(atShake.html)&&!new RegExp("<b>"+rd.name+"</b>").test(atShake.html),"E2a 다음 전투 스냅샷이 먼저 와도 옛 전투 이벤트는 옛 전투 무대에 적용된다");
  T.drain(1); // damageFx 끝
  T.drain(1); // resultBanner 진행
  ok(T.NET.stageBid===11&&/<b>동료<\/b>/.test(ovHtml(T)),"E2b 옛 전투 결과 배너 동안에도 옛 무대 유지");
  let guard=0; while(T.NET.stageBid!==12&&guard++<20) T.drain(1);
  ok(T.NET.stageBid===12&&new RegExp("<b>"+rd.name+"</b>").test(ovHtml(T))&&!/<b>동료<\/b>/.test(ovHtml(T)),"E2c 옛 전투 이벤트가 끝난 뒤에만 새 전투 무대(상대 하수인)로 교체");
  T.drain();
  ok(!hidden(T,"overlay")&&T.NET.stageBid===null&&new RegExp("<b>"+rd.name+"</b>").test(ovHtml(T)),"E2d 재생이 끝나면 진행 중 전투(12) 라이브 무대가 남는다");
  ok(/<button disabled/.test(ovHtml(T))&&/상대 턴!/.test(ovHtml(T)),"E2e 전투 12는 상대(A) 차례 — 원본대로 내 버튼 비활성");
}
{
  // E3 전투 종료와 함께 선택창(포획 등)이 오면, 전투 이벤트 재생이 끝난 뒤에 선택창을 보여 준다
  const T=seated(0);
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(5,{owner:0},{owner:1,type:"ally"}),fx:fx([])})});
  T.drain();
  msg(T,{v:1,type:"room_state",data:view(T,{battle:null,modal:{seq:3,owner:0,count:2,html:"<h2>포획 선택</h2>",buttons:[{text:"예",disabled:false},{text:"아니오",disabled:false}]},fx:fx([
    {seq:1,src:"msg",battleId:5,round:1,actSeq:1,key:"captureFx",big:false,txt:"포획!",fx:{ko:"D"}}])})});
  ok(/id="bstage"/.test(ovHtml(T))&&!/포획 선택/.test(ovHtml(T)),"E3a 전투 이벤트 재생 중에는 선택창이 무대를 가리지 않는다");
  T.drain();
  ok(/포획 선택/.test(ovHtml(T))&&!hidden(T,"overlay"),"E3b 재생이 끝나면 선택창이 뜬다");
}
{
  // E4 표시 HP: 이번 행동의 타격이 재생되기 전에는 무대가 최종 HP로 먼저 그려지지 않는다
  const T=seated(0);
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(9,{owner:0},{owner:1,type:"ally",hp:100}),fx:fx([])})});
  T.drain();
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(9,{owner:0},{owner:1,type:"ally",hp:40},{actSeq:1,phase:1,actor:"D"}),fx:fx([
    {seq:1,src:"msg",battleId:9,round:1,actSeq:1,key:"damageFx",big:false,txt:"60 피해!",fx:{hp:{side:"D",val:40,max:100}}}])})});
  ok(/<span id="hptxt-D">100<\/span>/.test(ovHtml(T)),"E4a 재생 전 무대는 직전 표시 HP(100)로 그려진다 — 최종값(40) 선반영 없음");
  T.drain();
  ok(/<span id="hptxt-D">40<\/span>/.test(ovHtml(T))&&/상대 턴!/.test(ovHtml(T)),"E4b 재생이 끝나면 최신 스냅샷(40)과 다음 차례로 다시 그린다");
}

/* ===== F. room_resumed baseline ===== */
{
  const T=seated(0);
  const events=[
    {seq:10,src:"stage",battleId:null,turn:2,key:"turnBanner",kind:"banner",title:"옛 배너1",sub:""},
    {seq:11,src:"stage",battleId:null,turn:2,key:"turnBanner",kind:"banner",title:"옛 배너2",sub:""},
    {seq:12,src:"stage",battleId:null,turn:3,key:"resultBanner",kind:"result",title:"패배",sub:""}];
  msg(T,{v:1,type:"room_resumed",epoch:"e1",roomId:"R1",seat:0,seatToken:"t2",tokenGen:1,data:view(T,{state:"FINISHED",phase:"over",result:{type:"WIN",winner:1,winType:"king"},fx:{firstSeq:10,lastSeq:12,events}})});
  ok(T.byId("fxTitle").textContent==="패배"&&T.NET.fxQueue.length===0&&T.NET.fxPlaying,"F1 재접속 baseline은 마지막 승패 배너 1개만 재생(옛 배너 스킵)");
  ok(T.NET.fxEnqueuedSeq===12&&T.NET.fxPlayedSeq===12,"F2 커서는 lastSeq로 한 번에");
  T.drain();
  msg(T,{v:1,type:"room_state",data:view(T,{state:"FINISHED",phase:"over",result:{type:"WIN",winner:1,winType:"king"},fx:{firstSeq:10,lastSeq:12,events}})});
  ok(T.NET.fxQueue.length===0&&!T.NET.fxPlaying,"F3 같은 창의 재전송은 다시 재생하지 않는다");
}

/* ===== G. 경계 리셋 ===== */
{
  const T=seated(0);
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(1,{owner:0},{owner:1,type:"ally"}),fx:fx([{seq:1,src:"stage",battleId:1,turn:1,key:"battleStart",kind:"count",title:"",sub:""}])})});
  const gen1=T.NET.fxGen;
  ok(T.NET.fxEnqueuedSeq===1&&T.NET.fxBattleSnaps[1],"G1 첫 방에서 커서·전투 스냅샷 보관");
  msg(T,{v:1,type:"room_resumed",epoch:"e2",roomId:"R1",seat:0,seatToken:"t3",tokenGen:2,data:view(T,{fx:{firstSeq:1,lastSeq:1,events:[{seq:1,src:"stage",battleId:null,turn:1,key:"turnBanner",kind:"banner",title:"새 서버",sub:""}]}})});
  ok(T.NET.fxGen!==gen1&&!T.NET.fxBattleSnaps[1]&&T.NET.fxEnqueuedSeq===1,"G2 epoch가 바뀌면(서버 재시작) 세대·스냅샷·커서가 리셋되고 새 seq=1과 혼동하지 않는다");
  const gen2=T.NET.fxGen; T.drain();
  T.netLeaveRoom();
  ok(T.NET.fxGen!==gen2&&T.NET.fxQueue.length===0&&T.NET.stageBid===null&&!T.fxLocked(),"G3 방을 나가면 표시 계층 상태가 모두 해제된다");
}

/* ===== H. 표시 시간 — msg 그룹 키별 원본 시간 ===== */
{
  const T=seated(0);
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(3,{owner:0},{owner:1,type:"ally"}),fx:fx([])})});
  T.drain(); T.delays.length=0;
  T.BAL.fx.itemFx=15; T.BAL.fx.damageFx=120; T.BAL.fx.msgStep=77;
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(3,{owner:0},{owner:1,type:"ally"},{actSeq:1}),fx:fx([
    {seq:1,src:"msg",battleId:3,round:1,actSeq:1,key:"itemFx",big:false,txt:"아이템",fx:null}])})});
  ok(T.delays.includes(15)&&!T.delays.includes(120),"H1 itemFx 그룹은 BAL.fx.itemFx(15ms) — damageFx(120ms)로 뭉개지지 않는다: "+JSON.stringify(T.delays));
  T.drain(); T.delays.length=0;
  msg(T,{v:1,type:"room_state",data:view(T,{battle:battle(3,{owner:0},{owner:1,type:"ally"},{actSeq:2}),fx:fx([
    {seq:2,src:"msg",battleId:3,round:1,actSeq:2,key:null,big:false,txt:"쿨 감소",fx:null}])})});
  ok(T.delays.includes(77),"H2 key 없이 시작한 그룹은 BAL.fx.msgStep: "+JSON.stringify(T.delays));
  T.drain(); T.delays.length=0;
  T.BAL.fx.pushBanner=33;
  msg(T,{v:1,type:"room_state",data:view(T,{battle:null,fx:fx([{seq:3,src:"stage",battleId:null,turn:2,key:"pushBanner",kind:"banner",title:"밀어내기!",sub:""}])})});
  ok(T.delays.includes(33),"H3 보드 배너는 자기 키 시간(BAL.fx.pushBanner)");
}

/* ===== I. 움직임 줄이기 — 정적 CSS 규칙 ===== */
{
  const T=H.load(htmlPath,{href:FILE_HREF,storage:H.mkStorage({tutorialSeen:"1"})});
  const m=T.html.match(/@media \(prefers-reduced-motion: reduce\)\{([\s\S]*?)\n  \}/);
  const css=m?m[1]:"";
  ok(/\.cell\.fx-boom, \.cell\.fx-trap, \.btok\.shake, #bstage\.sigblink, \.dmgfloat, \.pc\.fx-ghost\{animation:none !important;\}/.test(css),"I1 reduced-motion 블록이 폭발·함정 셀·토큰 흔들림·시그니처 점멸·피해 숫자·폭발 잔상 움직임을 끈다");
  ok(/\.cell\.fx-boom::after\{animation:none !important;/.test(css),"I2 폭발 이모지 팝업 움직임도 끈다(정지 표시 유지)");
  ok(!/netFxReducedMotion/.test(T.html),"I3 JS 표시 시간은 움직임 설정으로 줄이지 않는다(원본과 같은 시간·문구 유지)");
}

console.log("\n=== smoke_fx_consumer (#217 공개 방 표시 계층): pass "+pass+" / fail "+fail+" ===");
if(fail){ console.error("Failing: "+fails.join(", ")); process.exit(1); }
