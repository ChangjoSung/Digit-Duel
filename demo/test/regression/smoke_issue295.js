/* #295 방 대기(L03) 연결 끊김 · 내보내기 · 지연(나↔서버·상대↔서버) · 방장 승계 · 내 공식 전적 다시 받기 — node demo/test/regression/smoke_issue295.js
   서버는 스텁이다(Jupiter 회선 계약: 최상위 selfPingMs·peerPingMs · self_ping/peer_ping{ms} · lobby_kick 명령 · E_NO_GUEST · room_state 최상위 seat).
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).
     A  끊김·내보내기 — 서버 peerConnected=false 만 끊김(상대 칸 '재연결 중' 빗금 막대) · 방장 [내보내기] 항상 활성(30초 대기 없음) · 참가자는 버튼 없음 · 복귀 = 해제
     B  지연 — 좌석 카드 오른쪽 ms+막대(내 칸 = 나↔서버 · 상대 칸 = 상대↔서버) · 높은 값은 끊김이 아니다 · 실시간 갱신 · 이상값 —
     P  방장 이탈 → room_state 의 좌석 0 이 권위(참가자가 곧바로 방장 👑 · 시작·내보내기)
     R  결과 화면(FINISHED) — 양쪽 서버 실측 핑·단절 · [내보내기] 없음(CJ 2026-09-30 REVISE · 방장·참가자 모두) · 방장 끊김 = 참가자 좌석 1·결과 유지 owner 1 · 복귀 = 좌석 0
     W  익명 좌석(CJ 2026-09-30 REVISE) — players·reps null 이어도 서버 대기방 뷰면 찬 좌석(중립 '상대'/'방장' · '?' · 핑) · 끊긴 상대 = 어두운 카드 + 재연결 중 · OPEN = 입장 대기 · 참가자 [방 나가기] 한 줄
     C  전적 — 방 대기에 들어올 때 한 번(하트비트마다 아님) · 저장 대기 = '저장 중' + 확정까지 재시도 · 실패 = 옛 승·패 숨김 · 계정 전환 뒤 늦은 응답 버림
     G  끊긴 참가자 재연결 유예 — 서버 lobby.peerGraceMs 받은 시각 기준 남은 초(참가자 카드 오른쪽 위 · 0에서 멈춤 · OPEN·재접속·새 방이면 사라짐) · 방장 나가기 = leave 후 닫기
     D  재개 실패(내보내기·자동 비움 = E_SEAT_TOKEN_INVALID) = 공통 좌석 종료 안내 → 방 목록 */
"use strict";
const H=require("../shared/harness");
const path=require("path");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
let pass=0,fail=0;
function ok(cond,name){ if(cond) pass++; else { fail++; console.error("FAIL: "+name); } }

const ALICE={userId:"alice_1",nickname:"앨리스",hasEmail:true};
const prof=(w,pend)=>({nickname:"앨리스",representativeMinion:"M-F1",stats:{wins:w,losses:1},matches:[],pendingMatches:pend});
let routes={}; const calls=[];
const fetchStub=async(url,init)=>{ init=init||{}; calls.push(String(url)); const h=routes[(init.method||"GET")+" "+url]; if(!h) throw new TypeError("fetch failed");
  const r=typeof h==="function"?h():h; if(r==="hang") return new Promise(()=>{}); return {status:r[0],json:async()=>r[1]}; };
const tick=async()=>{ for(let i=0;i<12;i++) await new Promise(r=>setImmediate(r)); };
const step=T=>T.TQ.splice(0).forEach(f=>f()); // 이미 예약된 타이머만(방금 연 요청의 8초 제한은 돌리지 않는다)
const profGets=()=>calls.filter(u=>u==="/api/profile").length;
const WAIT=(rev,lobby,extra)=>({state:"WAITING",phase:"waiting",revision:rev,round:1,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,economy:true,
  lobby:Object.assign({guestReady:false,countdownMs:null,peerInResult:false},lobby||{}),...(extra||{})});

(async()=>{
  routes={"GET /api/auth/session":[200,ALICE],"GET /api/profile":[200,prof(3,0)]};
  const T=H.load(htmlPath,{href:"https://dd.example.com/",fetch:fetchStub,storage:H.mkStorage()}); await tick();
  const N=T.NET, sent=[];
  T.startMode("pvp"); T.S.eco=null; T.UI.entered=true; T.LOBBY.profile=T.lobby.lobbyParseProfile(prof(3,0));
  Object.assign(N,{publicMode:true,economy:true,started:false,roomId:7,roomName:"adw",me:0,players:["창조","test"],reps:["M-F1","M-W1"],roomState:"FINISHED",peerConnected:true,revision:5,
    ws:{readyState:1,send(x){ sent.push(JSON.parse(x)); },close(){}}});
  const w=()=>T.rooms.lobbyWaitHtml();

  /* ===== C1 결과에서 방 대기로 복귀 → 전적 한 번 다시 받기(저장 대기) ===== */
  routes["GET /api/profile"]=[200,prof(3,1)]; calls.length=0;
  T.netHandlePublicMessage({type:"room_state",data:WAIT(6),peerConnected:true,peerPingMs:42});
  ok(T.uiScreenName()==="room"&&profGets()===1&&/전적 확인 중/.test(w())&&!/3승 1패/.test(w()),"C1 방 대기 진입 = GET /api/profile 1회 · 받는 동안 옛 승·패를 확정처럼 보이지 않는다");
  await tick();
  ok(/결과 저장 중/.test(w())&&!/3승 1패/.test(w()),"C2 pendingMatches>0 = '결과 저장 중'");
  T.netHandlePublicMessage({type:"room_state",data:WAIT(7),peerConnected:true});
  ok(profGets()===1,"C3 같은 방 대기의 후속 room_state(하트비트)마다 다시 받지 않는다");
  routes["GET /api/profile"]=[200,prof(4,0)]; step(T); await tick();
  ok(profGets()===2&&/4승 1패/.test(w())&&!/저장 중/.test(w()),"C4 저장 확정까지 재시도 → 확정 전적 표시");
  step(T); await tick();
  ok(profGets()===2,"C5 확정 뒤에는 재시도를 멈춘다");

  /* ===== B 지연 ===== */
  const peerCard=h=>(h.match(/<span id="peerPing"[^]*?<\/span><\/span>/)||[""])[0], selfCard=h=>(h.match(/<span id="selfPing"[^]*?<\/span><\/span>/)||[""])[0];
  ok(/title="서버가 잰 상대와 게임 서버 사이의 왕복 시간입니다\. 나와 상대 사이의 직접 핑이 아닙니다\."><b aria-hidden="true">42ms<\/b><span class="pingBars" role="img" aria-label="상대↔서버 왕복 42ms">(<i class="on"><\/i>){4}</.test(w()),"B1 상대 칸 = 서버가 잰 상대↔서버 ms + 막대 · 직접 핑 아님 안내");
  T.netHandlePublicMessage({type:"peer_ping",ms:4800});
  ok(N.peerPing===4800&&/4800ms/.test(peerCard(w()))&&(peerCard(w()).match(/class="on"/g)||[]).length===1&&!/연결 끊김|재연결 중/.test(w()),"B2 peer_ping 갱신 · 높은 지연 = 막대 1칸일 뿐 끊김 아님");
  for(const bad of [-1,1.5,"9",null]){ T.netHandlePublicMessage({type:"peer_ping",ms:bad}); if(N.peerPing!==null) ok(false,"B3 이상값 "+bad); }
  ok(/>—<\/b>/.test(peerCard(w()))&&!/class="on"/.test(peerCard(w())),"B3 이상값·null = — · 막대 0");
  ok(N.selfPing===null&&/>—<\/b>/.test(selfCard(w()))&&/title="서버가 잰 내 브라우저와 게임 서버 사이의 왕복 시간입니다\."/.test(w()),"B4 내 칸 — 측정 전 —");
  T.netHandlePublicMessage({type:"room_state",data:WAIT(8),peerConnected:true,peerPingMs:42,selfPingMs:10});
  ok(N.selfPing===10&&/>10ms<\/b>/.test(selfCard(w()))&&/aria-label="내↔서버 왕복 10ms"/.test(w()),"B5 방 프레임 selfPingMs = 내 칸 ms+막대");
  T.netHandlePublicMessage({type:"self_ping",ms:180}); ok(N.selfPing===180&&/>180ms<\/b>/.test(selfCard(w())),"B6 self_ping 실시간 갱신");

  /* ===== A 끊김·내보내기 ===== */
  let h=w();
  ok(/class="danger" onclick="netLobbyKick\(\)">내보내기/.test(h)&&!/lobbyKickCd|초 뒤 내보내기/.test(h),"A0 방장 [내보내기] = 상대 연결 중에도 활성");
  T.netHandlePublicMessage({type:"room_state",data:WAIT(9,{kickInMs:30000,canKick:false}),peerConnected:false,peerPingMs:null});
  h=w();
  ok(/연결 끊김/.test(h)&&/재연결 중/.test(peerCard(h))&&/class="pingBars off" role="img" aria-label="상대 재연결 중"/.test(h)&&!/lobbyKickCd|초 뒤|30초/.test(h)&&/class="danger" onclick="netLobbyKick\(\)">내보내기/.test(h),
    "A1 방장 — 서버 확정 끊김 = 상대 칸 재연결 중 빗금 막대 · 30초 카운트다운 없음 · [내보내기] 활성");
  ok(/1분 안에 돌아오지 않으면 자리가 자동으로 비워집니다/.test(h),"A2 서버 60초 자동 비움 안내는 유지");
  global.netLobbyKick(); const k=sent.find(m=>m.t==="lobby_kick");
  ok(!!k&&k.round===1&&typeof k.requestId==="string","A3 lobby_kick = 인증 좌석 명령(round·requestId·seatToken 봉투) · 서버 canKick 을 기다리지 않는다");
  ok(/<button type="button" class="primary waitMain"[^>]*>시작<\/button><button type="button" class="danger" onclick="netLobbyKick\(\)">내보내기<\/button>\s*<button type="button" class="danger waitLeave"/.test(h),"A4 윗줄 [시작] · 아랫줄 [내보내기] 왼쪽 · [방 나가기] 오른쪽");
  N.me=1; T.netHandlePublicMessage({type:"room_state",seat:1,data:WAIT(10),peerConnected:false});
  h=w(); ok(/방장 연결이 끊겼습니다/.test(h)&&!/내보내기|lobbyKickCd/.test(h)&&/class="waitMain primary"/.test(h)&&/class="danger waitLeave"/.test(h),"A6 참가자 — [준비] 윗줄 · 내보내기 없음 · [방 나가기] 오른쪽 칸");
  const nk=sent.length; global.netLobbyKick(); ok(sent.length===nk,"A6b 참가자는 lobby_kick 을 보내지 않는다");
  N.me=0; T.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(11),peerConnected:true,peerPingMs:50});
  h=w(); ok(!/연결 끊김|재연결 중|lobbyKickCd/.test(h)&&/>50ms<\/b>/.test(peerCard(h)),"A7 60초 전 복귀 = 끊김 해제 · 상대 지연 다시 표시");
  T.netHandlePublicMessage({type:"room_state",data:WAIT(12,{peerInResult:true}),peerConnected:false});
  ok(/연결 끊김/.test(w())&&/netLobbyKick\(\)/.test(w()),"A8 FINISHED(상대 결과 화면) 중 끊김도 같은 내보내기 흐름");
  /* 빈 자리(OPEN) — [시작] 비활성 · [내보내기] 활성 · 서버 E_NO_GUEST 안내 */
  const OPEN=rev=>({state:"OPEN",phase:"setup",revision:rev,round:1,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,economy:true});
  T.netHandlePublicMessage({type:"room_state",seat:0,data:OPEN(13),players:["창조",null],reps:["M-F1",null],peerConnected:false});
  h=w(); ok(/입장 대기/.test(h)&&!/id="peerPing"/.test(h)&&/class="primary waitMain" disabled/.test(h)&&/class="danger" onclick="netLobbyKick\(\)">내보내기/.test(h),"A9 빈 대기방 — [시작] 비활성 · [내보내기] 활성 · 빈 자리에 지연 없음");
  const toasts=[]; const box=T.byId("toasts"), ap=box.appendChild.bind(box); box.appendChild=el=>{ toasts.push(String(el.textContent||"")); return ap(el); };
  sent.length=0; global.netLobbyKick(); ok(sent.some(m=>m.t==="lobby_kick"),"A10 빈 자리에서도 lobby_kick 을 보낸다(판정은 서버)");
  T.netHandlePublicMessage({type:"error",code:"E_NO_GUEST"}); ok(toasts.some(t=>/내보낼 참가자가 없습니다/.test(t)),"A11 서버 E_NO_GUEST = 안내");

  /* ===== P 방장 승계 ===== */
  N.me=1; N.players=["창조","test"]; T.netHandlePublicMessage({type:"room_state",seat:1,data:WAIT(14),peerConnected:true});
  T.netHandlePublicMessage({type:"room_state",seat:0,data:OPEN(15),players:["test",null],reps:["M-W1",null],peerConnected:false});
  h=w(); const mine=(h.match(/<li class="waitSeat me">[^]*?<\/li>/)||[""])[0];
  ok(N.me===0&&/<span class="who"><i class="gi"[^>]*><\/i> <b>test<\/b>/.test(mine)&&/netLobbyStart/.test(h)&&/netLobbyKick/.test(h)&&!/netLobbyReady/.test(h),"P1 방장 이탈 → 서버 좌석 0 = 곧바로 방장(👑 · 시작 · 내보내기)");

  /* ===== K 앞 요청 대기 중에도 [내보내기] (Saturn REVISE · CJ '항상 사용 가능') — 렌더된 버튼 onclick 을 그대로 실행한다(lobbyWaitSend 는 테스트가 주입) ===== */
  { const T4=H.load(htmlPath), N4=T4.NET, s4=[]; T4.startMode("pvp"); T4.UI.entered=true;
    Object.assign(N4,{publicMode:true,economy:true,started:false,roomId:7,roomName:"adw",me:0,players:["창조","test"],reps:["M-F1","M-W1"],roomState:"FINISHED",peerConnected:true,revision:5,
      ws:{readyState:1,send(x){ s4.push(JSON.parse(x)); },close(){}}});
    T4.netHandlePublicMessage({type:"room_state",data:WAIT(6,{guestReady:true}),peerConnected:true});
    const click=(h,label)=>{ const m=h.match(new RegExp(`<button[^>]*onclick="([^"]*)"[^>]*>${label}`)); if(!m) return false; new Function("lobbyWaitSend",m[1])(T4.rooms.lobbyWaitSend); return true; };
    const n=t=>s4.filter(m=>m.t===t).length;
    ok(click(T4.rooms.lobbyWaitHtml(),"시작")&&n("lobby_start")===1,"K1 [시작] = lobby_start 1회 · 요청 대기 시작");
    const h=T4.rooms.lobbyWaitHtml();
    ok(/class="primary waitMain" disabled/.test(h)&&(T4.rooms.lobbyWaitSend(global.netLobbyStart),n("lobby_start")===1),"K2 대기 중 [시작] 잠금·중복 전송 없음(요청 가드 유지)");
    ok(/class="danger" onclick="netLobbyKick\(\)">내보내기/.test(h)&&click(h,"내보내기")&&n("lobby_kick")===1,"K3 [시작] 응답 대기 중에도 [내보내기] 활성 · lobby_kick 1회 전송");
    ok(click(T4.rooms.lobbyWaitHtml(),"내보내기")&&n("lobby_kick")===2&&n("lobby_start")===1,"K4 [내보내기]는 시작 대기를 건드리지 않고 다시 눌러도 전송(판정은 서버)");
    T4.LOBBY.req=null; T4.rooms.lobbyWaitSend(global.netLobbyStart); ok(n("lobby_start")===2,"K5 대기가 풀리면 [시작] 다시 전송");
    /* CJ 2026-09-30 REVISE: 결과 화면에는 [내보내기]가 없다 — [방으로 돌아가기]만 */
    T4.LOBBY.req={rev:N4.revision,t:Date.now()}; N4.roomState="FINISHED"; N4.started=true; T4.S.phase="over"; T4.S.winner=0; T4.renderSide();
    ok(!click(T4.byId("sidePanel").innerHTML,"내보내기")&&/netReturnToRoom\(\)/.test(T4.byId("sidePanel").innerHTML),"K6 방장 결과 화면 = [내보내기] 없음 · [방으로 돌아가기] 유지"); }

  /* ===== R 결과 화면(FINISHED) — 양쪽 서버 실측 핑·단절 · 방장만 [내보내기] · 방장 단절 뒤 참가자 복귀 = 방장 승계 ===== */
  { const T3=H.load(htmlPath), N3=T3.NET, s3=[]; T3.startMode("pvp"); T3.UI.entered=true;
    Object.assign(N3,{publicMode:true,economy:true,mode:true,started:true,roomId:7,roomName:"adw",me:0,players:["창조","test"],reps:["M-F1","M-W1"],roomState:"FINISHED",round:1,revision:20,
      peerConnected:true,peerPing:40,selfPing:12,final:null,ws:{readyState:1,send(x){ s3.push(JSON.parse(x)); },close(){}}});
    T3.S.phase="over"; T3.S.winner=0;
    const sp=()=>{ T3.renderSide(); return T3.byId("sidePanel").innerHTML; };
    let r=sp();
    ok(/Win!/.test(r)&&/id="selfPing"[^]*?>12ms</.test(r)&&/id="peerPing"[^]*?>40ms</.test(r)&&/직접 핑이 아닙니다/.test(r)&&!/netLobbyKick|내보내기/.test(r)&&/netReturnToRoom\(\)/.test(r),"R1 방장 결과 = 내·상대 서버 실측 핑 · [방으로 돌아가기] · [내보내기] 없음");
    global.netLobbyKick(); ok(s3.some(m=>m.t==="lobby_kick"&&m.round===1),"R2 결과 화면에서도 방장은 바로 lobby_kick");
    /* Jupiter FINISHED 계약: 방장 전송 끊김 → 살아 있는 참가자는 좌석 1·원래 결과·최종 판 그대로 data.owner 1(지금 방장) · 평소 owner 0 */
    const FIN=(rev,owner)=>({seat:1,state:"FINISHED",phase:"over",revision:rev,round:1,owner,turnCount:5,current:0,mainUsed:false,battlesUsed:0,seats:{ready:[true,true]},units:[],
      you:{pieces:[],inv:[],balls:0,reserve:null,pkgs:{itemGift:0,battleBuff:0},selected:null,placed:true},battle:null,fleePick:null,events:[],result:{type:"WIN",winner:0,winType:"king"}});
    N3.me=1; s3.length=0;
    T3.netHandlePublicMessage({type:"room_state",seat:1,data:FIN(21,0),peerConnected:true,peerPingMs:40,selfPingMs:12}); r=sp();
    ok(N3.owner===0&&T3.S.phase==="over"&&/Lose!/.test(r)&&/id="peerPing"[^]*?>40ms</.test(r)&&!/netLobbyKick/.test(r),"R3 참가자 결과(owner 0) = 결과 유지 · 양쪽 핑 · 내보내기 없음");
    global.netLobbyKick(); ok(!s3.some(m=>m.t==="lobby_kick"),"R4 owner 0 참가자는 lobby_kick 을 보내지 않는다");
    T3.netHandlePublicMessage({type:"room_state",seat:1,data:FIN(22,1),peerConnected:false,peerPingMs:null,selfPingMs:15}); r=sp();
    const mineCard=(r.match(/<section class="resultSeat mine[^]*?<\/section>/)||[""])[0];
    ok(N3.me===1&&N3.owner===1&&/Lose!/.test(mineCard)&&/<span>나<\/span>/.test(mineCard)&&/Win!/.test(r)&&/창조/.test(r)&&T3.S.winner===0,"R5 방장 끊김 → 좌석 1·원래 Lose!/Win!·상대 이름 그대로");
    ok(/id="selfPing"[^]*?>15ms</.test(r)&&/id="peerPing"[^]*?재연결 중/.test(r)&&/class="pingBars off"/.test(r)&&!/lobbyKickCd|초 뒤|30초/.test(r),"R6 끊김 중에도 두 결과 카드 핑 유지(내 칸 실측 · 상대 칸 재연결 중) · 30초 상자 없음");
    ok(!/netLobbyKick|내보내기/.test(r)&&/netReturnToRoom\(\)/.test(r),"R7 지금 방장(owner 1)인 참가자 결과 화면도 [내보내기] 없음 · 복귀 유지");
    global.netLobbyKick(); ok(s3.some(m=>m.t==="lobby_kick"&&m.round===1),"R8 owner 1 참가자는 lobby_kick 을 보낸다(빈 자리 판정은 서버)");
    T3.netHandlePublicMessage({type:"self_ping",ms:33}); ok(/>33ms</.test(T3.byId("selfPing").innerHTML)&&/Lose!/.test(sp()),"R9 끊김 중 내 핑 실시간 갱신 · 결과 유지");
    T3.netHandlePublicMessage({type:"room_state",seat:0,players:["test",null],reps:["M-W1",null],peerConnected:false,
      data:{state:"OPEN",phase:"setup",revision:23,round:1,owner:0,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,economy:true}});
    const w3=T3.rooms.lobbyWaitHtml();
    ok(N3.me===0&&T3.uiScreenName()==="room"&&/netLobbyStart/.test(w3)&&/netLobbyKick/.test(w3)&&/<li class="waitSeat me">[^]*?<span class="who"><i class="gi"[^>]*><\/i> <b>test<\/b>/.test(w3),"R10 lobby_return → 좌석 0 OPEN(owner 0) = 곧바로 방장 대기방"); }

  /* ===== W 익명 좌석 · 끊긴 상대 · 빈 자리 · 버튼 배치 (라이브 QA: /api/profile 503 → 서버 players·reps null) ===== */
  { const T5=H.load(htmlPath), N5=T5.NET; T5.startMode("pvp"); T5.UI.entered=true;
    Object.assign(N5,{publicMode:true,economy:true,started:false,roomId:3,roomName:"asd",me:0,players:null,reps:null,roomState:"OPEN",peerConnected:null,revision:1,
      ws:{readyState:1,send(){},close(){}}});
    const OPEN5=rev=>({state:"OPEN",phase:"setup",revision:rev,round:1,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,economy:true});
    const seats=h=>h.match(/<li class="waitSeat[^"]*">[^]*?<\/li>/g)||[];
    const peer=h=>seats(h)[0]||"", mine=h=>seats(h)[1]||"";
    let h;
    T5.netHandlePublicMessage({type:"room_state",seat:0,data:OPEN5(2),players:[null,"옛참가자"],reps:[null,"M-W1"],peerConnected:false}); h=T5.rooms.lobbyWaitHtml();
    ok(/class="waitSeat empty"/.test(peer(h))&&/입장 대기/.test(peer(h))&&!/옛참가자|id="peerPing"|repImg|<img/.test(peer(h))&&/id="selfPing"/.test(mine(h))&&/<b>나<\/b>/.test(mine(h)),"W1 OPEN = 상대 칸 입장 대기(옛 이름·대표·핑 없음) · 내 칸 나+핑");
    T5.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(3),players:[null,null],reps:[null,null],peerConnected:true,peerPingMs:61,selfPingMs:9}); h=T5.rooms.lobbyWaitHtml();
    ok(!/empty/.test(peer(h))&&/<b>상대<\/b>/.test(peer(h))&&!/입장 대기/.test(h)&&/repFace lg" aria-hidden="true">\?</.test(peer(h))&&/id="peerPing"[^]*?>61ms</.test(peer(h))&&/id="selfPing"[^]*?>9ms</.test(mine(h))&&/준비 전/.test(peer(h)),
      "W2 익명 참가자 착석(WAITING · players/reps null) = 중립 '상대' · '?' 얼굴 · 상대↔서버 핑 · 준비 상태");
    T5.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(4),peerConnected:false,peerPingMs:null}); h=T5.rooms.lobbyWaitHtml();
    ok(/class="waitSeat off"/.test(peer(h))&&/<b>상대<\/b>/.test(peer(h))&&/class="pingBars off" role="img" aria-label="상대 재연결 중"/.test(peer(h))&&/재연결 중/.test(peer(h))&&!/입장 대기/.test(h)&&!/ off/.test(mine(h).match(/<li[^>]*>/)[0]),
      "W3 끊긴 익명 상대 = 좌석 유지 · 어두운 카드(off) · 빗금 막대 재연결 중 · 내 칸은 그대로");
    ok(/<button type="button" class="primary waitMain"[^>]*>시작<\/button><button type="button" class="danger" onclick="netLobbyKick\(\)">내보내기<\/button>\s*<button type="button" class="danger waitLeave"/.test(h),"W4 방장 = 윗줄 [시작] · 아랫줄 [내보내기] 왼쪽 · [방 나가기] 오른쪽");
    T5.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(5,{peerInResult:true}),peerConnected:true,peerPingMs:70}); h=T5.rooms.lobbyWaitHtml();
    ok(/<b>상대<\/b>/.test(peer(h))&&/결과 확인 중/.test(peer(h))&&/>70ms</.test(peer(h))&&!/ off/.test(peer(h).match(/<li[^>]*>/)[0]),"W5 결과 복귀 후 상대가 결과 화면 = 찬 좌석 · 결과 확인 중 · 핑");
    /* 참가자 시점 — 방장 좌석 익명 = 👑 방장 · 끊기면 off · [준비] 윗줄 · [방 나가기] 바로 뒤(내보내기 없음 → CSS 한 줄 전체) */
    N5.me=1; T5.netHandlePublicMessage({type:"room_state",seat:1,data:WAIT(6),players:[null,null],reps:[null,null],peerConnected:false}); h=T5.rooms.lobbyWaitHtml();
    ok(/<span class="who"><i class="gi[^"]*"[^>]*><\/i> <b>방장<\/b>/.test(peer(h))&&/class="waitSeat off"/.test(peer(h))&&/재연결 중/.test(peer(h))&&/<b>나<\/b>/.test(mine(h))&&/id="selfPing"/.test(mine(h)),"W6 참가자 — 익명 방장 = 👑 방장 · 끊기면 어두운 카드·재연결 중");
    ok(/<button type="button" class="waitMain primary"[^]*?>준비<\/button>\s*<button type="button" class="danger waitLeave"/.test(h)&&!/내보내기/.test(h),"W7 참가자 — [준비] 바로 뒤 [방 나가기](내보내기 없음)");
    const css=require("fs").readFileSync(path.join(path.dirname(htmlPath),"css","game.css"),"utf8");
    ok(/\.waitScreen \.netRoomActions \.waitMain\+\.waitLeave\{grid-column:1\/-1;\}/.test(css)&&/\.waitScreen \.netRoomActions \.waitMain\{grid-column:1\/-1;\}/.test(css)&&/\.waitScreen \.waitSeat\.off\{background:/.test(css),"W8 CSS — 참가자 [방 나가기] 한 줄 전체 · [시작]/[준비] 한 줄 전체 · 끊긴 좌석 배경");
    /* 계정 프로필이 있으면 종전 그대로 닉네임·대표 */
    N5.me=0; T5.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(7),players:["창조","test"],reps:["M-F1","M-W1"],peerConnected:true}); h=T5.rooms.lobbyWaitHtml();
    ok(/<b>test<\/b>/.test(peer(h))&&!/<b>상대<\/b>/.test(h)&&/<b>창조<\/b> <small>\(나\)<\/small>/.test(mine(h)),"W9 인증 프로필 경로 유지 — 실제 닉네임(지어낸 이름 없음)");
    /* 결과 화면 — 참가자(owner 0)도 [내보내기] 없음 */
    N5.roomState="FINISHED"; N5.started=true; T5.S.phase="over"; T5.S.winner=0; N5.me=1; N5.owner=0; T5.renderSide();
    ok(!/내보내기|netLobbyKick/.test(T5.byId("sidePanel").innerHTML)&&/netReturnToRoom/.test(T5.byId("sidePanel").innerHTML),"W10 참가자 결과 화면 [내보내기] 없음 · 복귀 유지"); }

  /* ===== G 끊긴 참가자 재연결 유예(CJ 2026-09-30 REVISE 3) — 서버 lobby.peerGraceMs(실제 만료 기준) → 참가자 카드 오른쪽 위 남은 초 · 표시 전용 ===== */
  { const T6=H.load(htmlPath), N6=T6.NET, s6=[]; let closed=0; T6.startMode("pvp"); T6.UI.entered=true;
    Object.assign(N6,{publicMode:true,economy:true,started:false,roomId:4,roomName:"grace",me:0,players:["창조","test"],reps:["M-F1","M-W1"],roomState:"WAITING",peerConnected:true,revision:1,
      ws:{readyState:1,send(x){ s6.push(JSON.parse(x)); },close(){ closed=s6.length; }}});
    const peer=h=>((h.match(/<li class="waitSeat[^"]*">[^]*?<\/li>/g)||[])[0]||""), g=()=>T6.rooms.lobbyWaitHtml();
    const OPEN6=rev=>({state:"OPEN",phase:"setup",revision:rev,round:1,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,economy:true});
    T6.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(2,{peerGraceMs:45000}),peerConnected:false,peerPingMs:null}); let h=g();
    ok(/class="seatSide"><span id="peerGrace" class="graceTimer" role="timer"[^>]*>[^]*?재연결 대기 남은 시간 <\/span><b id="peerGraceN">45<\/b>초<\/span><span id="peerPing"[^]*?pingBars off/.test(peer(h))&&!/aria-live/.test(peer(h)),
      "G1 방장 — 끊긴 참가자 카드 = 오른쪽 위 45초(role=timer · 초마다 읽지 않음) + 아래 빗금 핑");
    const n0=s6.length; N6.lobby.at-=12400; T6.TQ.splice(0).forEach(f=>f());
    ok(T6.byId("peerGraceN").textContent==="33"&&s6.length===n0,"G2 받은 시각 기준 표시만 줄인다(33초) · 추가 요청 없음");
    N6.lobby.at-=60000; T6.TQ.splice(0).forEach(f=>f());
    ok(T6.byId("peerGraceN").textContent==="0"&&T6.TQ.length===0&&/<b id="peerGraceN">0<\/b>/.test(g())&&s6.length===n0,"G3 0에서 멈춘다 · 자리 비움 요청을 보내지 않는다(서버만 비운다)");
    T6.netHandlePublicMessage({type:"room_state",seat:0,data:OPEN6(3),players:["창조",null],reps:["M-F1",null],peerConnected:false}); h=g();
    ok(!/peerGrace/.test(h)&&/입장 대기/.test(peer(h)),"G4 서버 자리 비움(OPEN) = 타이머 사라짐 · 빈 자리");
    T6.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(4,{peerGraceMs:60000}),players:["창조","test"],reps:["M-F1","M-W1"],peerConnected:false});
    ok(/<b id="peerGraceN">60<\/b>/.test(g()),"G5 새 끊김 = 새 유예값");
    T6.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(5),peerConnected:true,peerPingMs:40}); h=g();
    ok(!/peerGrace/.test(h)&&/>40ms</.test(peer(h)),"G6 재접속 = 타이머 사라짐 · 핑 복귀");
    T6.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(6,{peerGraceMs:"30000"}),peerConnected:false});
    ok(!/peerGrace/.test(g())&&/재연결 중/.test(g()),"G7 이상값·값 없음 = 타이머 없음(끊김 표시는 유지)");
    T6.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(7,{peerGraceMs:30000}),peerConnected:true});
    ok(!/peerGrace/.test(g()),"G8 연결된 상대에게는 값이 와도 그리지 않는다");
    N6.me=1; T6.netHandlePublicMessage({type:"room_state",seat:1,data:WAIT(8,{peerGraceMs:30000}),peerConnected:false});
    ok(!/peerGrace/.test(g())&&/방장 연결이 끊겼습니다/.test(g()),"G9 참가자 시점 끊긴 방장 카드에는 타이머 없음(참가자 카드 전용)");
    N6.me=0; T6.netHandlePublicMessage({type:"room_state",seat:0,data:WAIT(9,{peerGraceMs:30000}),peerConnected:false});
    /* 방장 [방 나가기] — leave 를 소켓을 닫기 전에 보내고 방 목록으로 · 타이머 잔존 없음 */
    s6.length=0; global.netLeaveRoom();
    ok(s6[0]&&s6[0].t==="leave"&&s6[0].round===1&&closed===1&&N6.roomId===null&&T6.LOBBY.view==="rooms"&&T6.uiScreenName()!=="room"&&!/peerGrace/.test(g()),"G10 방장 나가기 = leave 먼저 → 소켓 닫기 → 방 목록 · 타이머 없음");
    T6.netHandlePublicMessage({type:"room_opened",roomId:5,seat:0,seatToken:"t5",tokenGen:0,revision:0});
    ok(N6.lobby===null&&!/peerGrace/.test(g()),"G11 새 방 = 옛 유예 없음"); }

  /* ===== C6·C7 실패·계정 전환 ===== */
  T.netApplyRoomState({state:"FINISHED",phase:"over",revision:13});
  routes["GET /api/profile"]=[500,{}]; T.netHandlePublicMessage({type:"room_state",data:WAIT(14),peerConnected:true}); await tick();
  ok(/전적 확인 불가/.test(w())&&!/4승 1패/.test(w()),"C6 받기 실패 = '전적 확인 불가'(옛 승·패를 확정처럼 보이지 않는다)");
  routes["GET /api/profile"]=()=>{ T.AUTH.gen++; return [200,prof(9,0)]; }; step(T); await tick();
  ok(!/9승/.test(w()),"C7 계정이 바뀐 뒤 도착한 옛 응답은 버린다");

  /* ===== B4 새 방 첫 프레임 — 이 프레임의 지연은 살리고 옛 방 값은 버린다 ===== */
  { const T2=H.load(htmlPath), N2=T2.NET; N2.peerPing=999;
    T2.netHandlePublicMessage({type:"room_joined",roomId:8,seat:1,seatToken:"t",tokenGen:0,revision:0,peerConnected:true,peerPingMs:37});
    const first=N2.peerPing; N2.peerPing=999;
    T2.netHandlePublicMessage({type:"room_opened",roomId:9,seat:0,seatToken:"t2",tokenGen:0,revision:0});
    ok(first===37&&N2.peerPing===null,"B4 room_joined 첫 프레임 peerPingMs 유지 · 값 없는 새 방은 옛 지연을 버린다"); }

  /* ===== D 재개 실패 ===== */
  toasts.length=0; N.resuming=true; N.roomId=7;
  T.netHandlePublicMessage({type:"error",code:"E_SEAT_TOKEN_INVALID"});
  ok(!N.resuming&&N.roomId===null&&T.LOBBY.view==="rooms"&&toasts.some(t=>/이 방의 자리가 종료되었습니다/.test(t))&&!toasts.some(t=>/추방|차단|강퇴/.test(t)),"D1 재개 거부 = 공통 좌석 종료 안내 → 방 목록(사유·차단 표현 없음)");

  console.log(`smoke_issue295: ${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
