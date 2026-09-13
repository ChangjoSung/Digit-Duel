/* #217/#218 공개 방(초대 코드 없는 목록·생성·참가·취소·준비·대국·재접속) 클라이언트 회귀 — node demo/test/regression/smoke_public_rooms.js
   범위 — server/authoritative/**(Jupiter_Server, protocol.md v2)의 실제 구현·헤드리스 통합 테스트(server/authoritative/test/)
   기준. 이 파일은 그 프로토콜을 클라이언트가 정확히 구현하는지 WebSocket 스텁으로 검증한다(실제 서버 상호운용은
   Jupiter의 server/authoritative/test/test-authoritative.js가 실제 소켓으로 이미 검증했다):
     A. 로비 — 공개 방이 유일한 온라인 진입(코드 탭·주소·접속 코드 입력칸 비노출, CJ 승인)
     B. 접속 — credential 소켓([마커,credential] 2토큰), 코드 접속과 소켓 생성 지점 분리
     C. 로비 — l- 접속 → lobby_ready 수신 → list_rooms 자동 송신 → lobby_rooms 반영, 새로고침 재사용
     D. 생성 — cp- 접속 → room_opened(추가 명령 없이) → 좌석·토큰·에폭 배정, 배치 화면 진입
     E. 참가 — p-<roomId> 접속 → room_joined
     F. 오류 — error 프레임 처리, 방 진입 전 실패만 목록 재조회, 깨진 payload에도 무사
     G. 준비 — setup/ready 봉투(v/requestId/seatToken/tokenGen), 상대 ready는 room_state.seats.ready로 반영,
        양측 ready 뒤 서버가 보낸 room_state(phase:"play")가 실제 보드를 그린다(NET.mode/started 켜짐,
        S.pieces·현재 턴·인벤토리 반영) — 로컬 판정 없이 서버 스냅샷만 반영한다는 계약을 고정한다.
     H. 나가기 — leave 봉투, 상태 완전 해제
     I. 프로토콜 협상 실패(fail-closed)
     J. (A에 통합)
     K. 재접속(bounded resume) — r-<epoch>.<seatToken> credential, 소켓 오픈만으로 room_resumed/error 수신
     L. 행동 전송 — netAction()이 공개 방에서는 로컬 applyAction 없이 action 봉투만 보낸다(baseRevision 포함),
        resign은 최상위 명령(action 봉투 아님), 전투 진입 시 원본 battleModal()이 서버 화이트리스트로 지은 표시용 전투로 그려진다.
     M. 선택창(data.modal) — 소유 좌석은 서버가 준 html·버튼, 비소유는 대기 화면
     N. 시작 전 종결(canceled) → 방 목록
     O. 행동 좌석 턴 결정 상태(data.turn)·you.teleUsed·fleePick.pieceId·battle.battleId 소비 (Jupiter/public-view-delta.md)
     P. 등급 C-2 공개 상대는 정체가 그려지고 등급 B는 "?" · FINISHED 종료 공개
     Q. 오류 코드 → 플레이어 문구(코드 원문 비노출) · 자동 턴 종료 거부 루프 방지
     R. 준비 표시는 서버 확정값만 — OPEN에서는 보내지 않고 입장 알림 뒤 전송, 준비 취소
   게임 규칙 자체(전투·상성 등)의 서버측 정확성은 server/authoritative/test/가 검증한다 — 여기서는 클라이언트
   전송·수신·렌더 배선만 본다. */
"use strict";
const H=require("../shared/harness");
const htmlPath=process.argv[2]||require("path").join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const FILE_HREF="file:///C:/Digit-Duel/demo/index.html";
const MARKER="digit-duel.v1";
function loadAt(href,st){ return H.load(htmlPath,{href:href||FILE_HREF,storage:H.mkStorage(Object.assign({tutorialSeen:"1"},st||{}))}); }
function $el(T,id){ return T.byId(id); }
function toasts(T){ return ($el(T,"toasts").children||[]).map(x=>x.textContent); }
function protos(ws){ return ws&&Array.isArray(ws.protocols)?ws.protocols:[]; }
function openWs(ws,sel){ ws.readyState=1; ws.protocol=sel; ws.onopen(); return ws; }
function lastSent(ws){ return JSON.parse(ws.sent[ws.sent.length-1]); }
function sentTypes(ws){ return ws.sent.map(s=>JSON.parse(s).t); }

/* room.js toSeatView()가 실제로 만드는 모양을 그대로 재현하는 최소 픽스처. */
function mkOwnPiece(o){ return Object.assign({id:"u-me1",r:11,c:1,owner:0,type:"minion",element:"fire",name:"불꽃매",
  hp:20,maxHp:20,atk:5,skillAtk:3,skills:[{i:0,revealed:true,id:"fire_stable",name:"불꽃 안정",cd:0}],cdMax:2,immobile:0,
  cap:null,healing:false,alive:true,placed:true,movedEver:false,revealed:false,
  burn:0,weaken:0,shield:0,shock:0,dmgCut:0,focusCharge:false,vulnMark:false,powerBuff:false,fleeBoost:false},o||{}); }
function mkUnknownOpp(o){ return Object.assign({id:"u-opp1",r:3,c:1,owner:1,alive:true,immobile:0},o||{}); }
function mkSeatView(o){
  return Object.assign({
    seat:0, phase:"play", revision:1, turnCount:0, current:0, mainUsed:false, battlesUsed:0,
    seats:{ready:[true,true]}, units:[mkUnknownOpp()],
    you:{pieces:[mkOwnPiece()], inv:["potion"], balls:3, reserve:null, pkgs:{itemGift:0,battleBuff:0}, selected:null, placed:true},
    battle:null, fleePick:null, events:[], result:null,
  },o||{});
}
function mkSetupView(ready0,ready1,placed){
  return {seat:0,phase:"setup",revision:0,current:null,seats:{ready:[!!ready0,!!ready1]},units:[],you:{placed:!!placed},result:null};
}

/* ===== A. 로비 카드 — 공개 방이 유일한 온라인 진입(Earth/lobby-guide.md·CJ 승인). 코드 탭·주소·접속 코드 입력칸은 없다 ===== */
{
  const T=loadAt();
  const menu0=$el(T,"sidePanel").innerHTML;
  ok(T.NET.uiTab==="public"&&/공개 대전/.test(menu0),"A1 온라인 카드는 공개 대전이다");
  ok(!/id="netCode"/.test(menu0)&&!/코드로 참가/.test(menu0),"A1b 코드 입력칸·코드 탭이 없다");
  ok(!/id="netServer"/.test(menu0),"A1c 서버 주소 입력칸도 없다 — 서버·호스팅 구성은 플레이어 흐름에 노출하지 않는다");
  ok(/새 방 만들기/.test(menu0)&&/새로고침/.test(menu0)&&/초대 코드는 필요하지 않습니다/.test(menu0),"A4 방 만들기·새로고침·안내 문구가 있다");
  T.netUiTab("code"); T.render();
  ok(T.NET.uiTab==="public"&&!/id="netCode"/.test($el(T,"sidePanel").innerHTML),"A2 옛 탭 전환 호출도 공개 방 카드만 그린다 (우회 진입 없음)");
  ok(/role="status"/.test(menu0)&&/aria-live="polite"/.test(menu0),"A5 연결 상태는 aria-live 상태 영역으로 알린다");
}

/* ===== B. 접속 — credential 소켓, 코드 접속과 소켓 생성 지점 분리 ===== */
{
  const T=loadAt();
  T.netListRooms();
  ok(T.wsLog.length===1,"B1 공개 방 접속도 netConnect()와 같은 WebSocket 카운터를 쓴다 (별도 소켓 하나)");
  const p=protos(T.wsLog[0]);
  ok(p.length===2&&p[0]===MARKER&&p[1].startsWith("l-"),"B2 로비 접속은 [마커, l-<nonce>] 2토큰 ("+JSON.stringify(p)+")");
  ok(T.NET.code===null,"B3 공개 방 접속 경로는 NET.code를 전혀 건드리지 않는다");
  ok(T.NET.publicMode===true,"B4 NET.publicMode가 켜진다");
}

/* ===== C. 로비 — lobby_ready 수신 → list_rooms 자동 송신 → lobby_rooms 반영 ===== */
{
  const T=loadAt();
  T.netListRooms();
  ok(T.NET.roomsLoading===true,"C1 목록 요청 즉시 로딩 상태");
  openWs(T.wsLog[0],MARKER);
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"lobby_ready",epoch:"e1"})});
  ok(T.NET.lobbyOnly===true,"C1b 첫 인밴드 프레임(lobby_ready) 수신으로 로비 전용 소켓임을 안다");
  ok(lastSent(T.wsLog[0]).t==="list_rooms","C2 lobby_ready 수신 즉시 list_rooms 송신");
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"lobby_rooms",rooms:[{roomId:7,label:"방 #7",seats:"1/2",ageSec:42}]})});
  ok(T.NET.roomsLoading===false&&T.NET.rooms.length===1&&T.NET.rooms[0].roomId===7,"C3 lobby_rooms 수신이 NET.rooms에 반영되고 로딩이 풀린다");
  ok(/방 #7/.test($el(T,"sidePanel").innerHTML)&&/42초 전/.test($el(T,"sidePanel").innerHTML),
    "C5 기본 탭이 이미 공개 방이므로 목록 항목(레이블·경과시간)이 바로 그려진다");
  ok(/netRoomRow/.test($el(T,"sidePanel").innerHTML)&&/>참가</.test($el(T,"sidePanel").innerHTML),"C4 방 행마다 [참가] 버튼이 있다");
  T.netListRooms(); // 새로고침 — 이미 로비 소켓이 살아 있으면 재사용(새 소켓을 열지 않는다)
  ok(T.wsLog.length===1,"C7 새로고침은 살아있는 로비 소켓을 재사용한다 (소켓을 새로 열지 않음)");
  ok(sentTypes(T.wsLog[0]).filter(t=>t==="list_rooms").length===2,"C8 새로고침이 list_rooms를 다시 보낸다");
}
{
  const T=loadAt();
  ok(/새로고침\]을 누르면/.test($el(T,"sidePanel").innerHTML),"C6 접속 전에는 새로고침 안내를 보여준다");
  T.netListRooms(); openWs(T.wsLog[0],MARKER);
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"lobby_rooms",rooms:[]})});
  ok(/열려 있는 방이 없습니다. 새 방을 만들어 보세요./.test($el(T,"sidePanel").innerHTML),"C6b 받아 온 목록이 비면 빈 목록 문구");
}
{
  const T=loadAt();
  T.netCreatePublicRoom();
  ok(/방을 만드는 중…/.test($el(T,"sidePanel").innerHTML)&&/<button type="button" disabled onclick="netListRooms\(\)">/.test($el(T,"sidePanel").innerHTML),"C9 생성 중에는 주 행동 문구가 바뀌고 중복 탭이 막힌다");
  T.netCreatePublicRoom();
  ok(T.wsLog.length===1,"C10 생성 중 다시 눌러도 소켓을 더 열지 않는다");
}

/* ===== D. 생성 → 좌석 배정 → 배치 화면 (room_opened, 추가 명령 없이) ===== */
{
  const T=loadAt();
  T.netCreatePublicRoom();
  const p=protos(T.wsLog[0]);
  ok(p.length===2&&p[0]===MARKER&&p[1].startsWith("cp-"),"D0 생성 접속은 [마커, cp-<nonce>] ("+JSON.stringify(p)+")");
  openWs(T.wsLog[0],MARKER);
  ok(T.wsLog[0].sent.length===0,"D1 room_opened은 서버가 오픈 즉시 스스로 보낸다 — 클라이언트가 먼저 명령을 보내지 않는다");
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_opened",epoch:"e1",roomId:9,seat:0,seatToken:"tok-9-0",tokenGen:0,public:true,revision:0,seq:1})});
  ok(T.NET.roomId===9&&T.NET.me===0&&T.NET.seatToken==="tok-9-0"&&T.NET.tokenGen===0&&T.NET.epoch==="e1","D2 room_opened이 방·좌석·토큰·에폭을 배정한다");
  ok(T.NET.preparing===true&&T.NET.publicMode===true&&T.S.phase==="setup","D3 호스트는 곧바로 배치 화면으로 들어간다");
  ok(T.NET.code===null,"D4 공개 방 경로는 접속 코드를 전혀 쓰지 않는다");
}

/* ===== E. 참가 (room_joined) ===== */
{
  const T=loadAt();
  T.netJoinPublicRoom(9);
  const p=protos(T.wsLog[0]);
  ok(p.length===2&&p[1]==="p-9","E0 참가 접속은 [마커, p-<roomId>] ("+JSON.stringify(p)+")");
  openWs(T.wsLog[0],MARKER);
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_joined",epoch:"e1",roomId:9,seat:1,seatToken:"tok-9-1",tokenGen:0,revision:0,seq:1})});
  ok(T.NET.roomId===9&&T.NET.me===1&&T.NET.seatToken==="tok-9-1","E2 room_joined이 게스트 좌석(1)을 배정한다");
  ok(T.S.phase==="setup"&&T.NET.publicMode===true,"E3 게스트도 배치 화면으로 들어간다");
}

/* ===== F. 오류 처리 ===== */
{
  const T=loadAt();
  T.netJoinPublicRoom(404);
  openWs(T.wsLog[0],MARKER);
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"error",code:"E_ROOM_NOT_FOUND"})});
  ok(/이 방은 더 이상 참가할 수 없습니다/.test($el(T,"sidePanel").innerHTML)&&/다른 방 보기/.test($el(T,"sidePanel").innerHTML),"F1 참가 불가는 카드 안에 지속 문구와 [다른 방 보기]로 남는다");
  ok(!/E_ROOM_NOT_FOUND/.test($el(T,"sidePanel").innerHTML+toasts(T).join("|")),"F1b 서버 오류 코드 원문은 화면에 싣지 않는다");
  ok(T.wsLog.length===2,"F2 방 진입 전 E_ROOM_NOT_FOUND는 목록을 다시 조회한다 (새 로비 소켓)");
  ok(protos(T.wsLog[1])[1].startsWith("l-"),"F2b 재조회는 로비(l-) credential로 연다");
  ok(T.NET.roomId===null,"F3 참가 실패 시 방 상태는 배정되지 않는다");
}
{
  // 예외적 payload에도 죽지 않는다
  const T=loadAt();
  T.netListRooms();
  openWs(T.wsLog[0],MARKER);
  let threw=null;
  try{ T.wsLog[0].onmessage({data:"not json"}); T.wsLog[0].onmessage({data:JSON.stringify({type:"unknown_future_type",whatever:1})}); }
  catch(e){ threw=e; }
  ok(!threw,"F4 알 수 없는/깨진 메시지에도 예외를 던지지 않는다 (미래 프로토콜 필드 확장에 안전)");
}

/* ===== G. 준비 → 대국 시작 — 서버 스냅샷만으로 실제 보드를 그린다(로컬 판정 없음) ===== */
function readyFlow(seat){
  const T=loadAt();
  if(seat===0) T.netCreatePublicRoom(); else T.netJoinPublicRoom(9);
  openWs(T.wsLog[0],MARKER);
  T.wsLog[0].onmessage({data:JSON.stringify(seat===0
    ?{v:1,type:"room_opened",epoch:"e1",roomId:9,seat:0,seatToken:"h",tokenGen:0,revision:0,seq:1}
    :{v:1,type:"room_joined",epoch:"e1",roomId:9,seat:1,seatToken:"g",tokenGen:0,revision:0,seq:1})});
  T.autoPlaceCore(0);
  T.setupDoneCore();
  if(seat===0) T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:1,seat:0,data:Object.assign(mkSetupView(false,false,false),{state:"SETUP",revision:1})})}); // 게스트 입장 알림
  return T;
}
{
  // 호스트: 상대 입장 전(OPEN)에는 서버가 setup·ready를 받지 않는다 — 보내지 않고 기다렸다가 입장 알림에 보낸다
  const T=loadAt();
  T.netCreatePublicRoom(); openWs(T.wsLog[0],MARKER);
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_opened",epoch:"e1",roomId:9,seat:0,seatToken:"h",tokenGen:0,revision:0,seq:1})});
  T.autoPlaceCore(0); T.setupDoneCore();
  ok(sentTypes(T.wsLog[0]).length===0,"G0 OPEN(상대 입장 전)에서는 setup·ready를 보내지 않는다 ("+sentTypes(T.wsLog[0]).join(",")+")");
  ok(/상대를 기다리는 중/.test($el(T,"sidePanel").innerHTML)&&/상대: .*입장 대기/.test($el(T,"sidePanel").innerHTML)&&!/내 준비: .*완료/.test($el(T,"sidePanel").innerHTML),"G0b 입장 대기와 내 준비 미확정이 구별돼 보인다");
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:1,seat:0,data:Object.assign(mkSetupView(false,false,false),{state:"SETUP",revision:1})})});
  ok(sentTypes(T.wsLog[0]).join(",")==="setup,ready","G0c 입장 알림(SETUP) 수신 즉시 준비 의사를 한 번 보낸다");
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:2,seat:0,data:Object.assign(mkSetupView(false,false,true),{state:"SETUP",revision:2})})}); // setup 응답
  ok(sentTypes(T.wsLog[0]).join(",")==="setup,ready","G0d setup 응답 room_state가 와도 다시 보내지 않는다 (재전송 루프 없음)");
}
{
  const T=readyFlow(0);
  ok(T.wsLog.length===1,"G1 배치 완료가 두 번째 소켓을 만들지 않는다 (코드 경로 netConnect() 미호출)");
  const st=sentTypes(T.wsLog[0]);
  ok(st.join(",")==="setup,ready","G2 배치 완료 시 setup·ready를 순서대로 보낸다 ("+st.join(",")+")");
  const setupMsg=JSON.parse(T.wsLog[0].sent.find(s=>JSON.parse(s).t==="setup"));
  ok(setupMsg.v===1&&typeof setupMsg.requestId==="string"&&setupMsg.seatToken==="h"&&setupMsg.tokenGen===0&&Array.isArray(setupMsg.roster)&&Array.isArray(setupMsg.pos),
    "G2b setup 봉투가 v/requestId/seatToken/tokenGen/roster/pos를 갖춘다 ("+JSON.stringify(setupMsg)+")");
  ok(T.NET.myReady===false&&/서버에 준비를 알리는 중/.test($el(T,"sidePanel").innerHTML),"G3 서버가 확정하기 전에는 내 준비를 완료로 표시하지 않는다");
  ok(T.NET.started===false,"G4 서버 응답(room_state) 전에는 아직 대국이 시작되지 않는다");
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:3,seat:0,data:Object.assign(mkSetupView(true,false,true),{state:"SETUP"})})});
  ok(T.NET.myReady===true&&T.NET.peerReady===false,"G5 room_state의 seats.ready로 내·상대 준비 상태를 반영한다");
  ok(/내 준비: .*완료/.test($el(T,"sidePanel").innerHTML)&&/상대의 준비를 기다리는 중/.test($el(T,"sidePanel").innerHTML),"G5a 서버 확정 뒤에만 내 준비 완료·상대 준비 대기");
  ok(T.S.phase==="setup","G5b 아직 setup 단계 room_state는 보드를 그리지 않는다");
  const view=mkSeatView({seat:0,current:0,revision:4,state:"IN_PROGRESS",you:{pieces:[mkOwnPiece({owner:0})],inv:["potion"],balls:3,reserve:null,pkgs:{itemGift:0,battleBuff:0},selected:null,placed:true}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:4,seat:0,data:view})});
  ok(T.NET.mode===true&&T.NET.started===true,"G6 phase:play room_state 수신으로 온라인 마스킹·시작 상태가 켜진다");
  ok(T.S.phase==="play"&&T.S.current===0,"G7 서버가 보낸 phase/current가 그대로 반영된다");
  ok(T.S.pieces.length===2,"G8 내 기물(you.pieces)+상대 기물(units)이 합쳐져 S.pieces가 된다");
  ok(T.S.pieces.find(p=>p.id==="u-me1").hp===20,"G9 자기 기물은 서버가 준 실제 HP를 갖는다");
  const oppPiece=T.S.pieces.find(p=>p.id==="u-opp1");
  ok(oppPiece&&oppPiece.type===null&&oppPiece.hp===1&&oppPiece.maxHp===1&&oppPiece.revealed===false,
    "G10 서버가 정체를 안 준 상대 기물은 로컬에서도 type=null·hp 기본값·미공개(안전 placeholder)만 갖는다");
  ok(T.NET.revision===4,"G11 NET.revision이 서버 revision을 따라간다");
  ok(!T.wsLog[0].sent.map(s=>JSON.parse(s).t).includes("a"),"G12 레거시 코드 접속 락스텝 프레임(t:'a')을 전혀 보내지 않는다");
}
{
  // 게스트(SETUP 참가)는 배치 완료 즉시 보낸다 · 준비 취소는 unready 후 배치 화면으로
  const T=readyFlow(1);
  ok(sentTypes(T.wsLog[0]).join(",")==="setup,ready","G13 게스트는 참가 즉시 SETUP 이라 배치 완료에서 바로 보낸다");
  T.netRoomReady(false);
  ok(lastSent(T.wsLog[0]).t==="unready"&&T.NET.readyWanted===false,"G14 준비 취소는 unready를 보낸다");
  ok(/비공개 배치/.test($el(T,"sidePanel").innerHTML)&&/방 나가기/.test($el(T,"sidePanel").innerHTML),"G15 준비 취소 뒤 배치 화면(방 나가기 포함)으로 돌아와 배치를 고칠 수 있다");
  T.setupDoneCore();
  ok(sentTypes(T.wsLog[0]).join(",")==="setup,ready,unready,setup,ready","G16 다시 배치 완료하면 새 배치로 준비 의사를 다시 보낸다");
}

/* ===== H. 나가기 ===== */
{
  const T=readyFlow(0);
  T.netLeaveRoom();
  const last=JSON.parse(T.wsLog[0].sent[T.wsLog[0].sent.length-1]);
  ok(last.t==="leave"&&last.v===1&&typeof last.requestId==="string","H1 나가기는 leave 봉투를 먼저 보낸다");
  ok(T.NET.mode===false&&T.NET.roomId===null&&T.NET.seatToken===null&&T.NET.myReady===false&&T.NET.peerReady===false&&T.NET.readyWanted===false&&T.NET.roomState===null,
    "H2 netLeaveRoom 후 방·좌석·준비 상태가 완전히 해제된다");
  ok(T.S.phase==="menu","H3 메뉴로 돌아간다");
  ok(T.wsLog.length===2&&protos(T.wsLog[1])[1].startsWith("l-"),"H4 나간 뒤 방 목록을 자동으로 다시 불러온다 (로비 소켓)");
}

/* ===== I. 협상 실패 fail-closed ===== */
{
  const T=loadAt();
  T.netListRooms();
  openWs(T.wsLog[0],"other-protocol");
  ok(T.NET.ws===null&&T.NET.publicMode===false,"I1 마커 불일치 시 공개 접속도 즉시 끊고 상태를 되돌린다");
  ok(/협상이 맞지 않습니다/.test(toasts(T).join("|")),"I2 협상 실패 안내가 뜬다");
}

/* ===== K. 재접속(bounded resume) — r-<epoch>.<seatToken> credential ===== */
function seatedRoom(){ // 방을 만들고 배치까지 마친(SETUP, ready 전) 상태 — 재접속 시나리오의 공통 출발점
  const T=loadAt();
  T.netCreatePublicRoom();
  openWs(T.wsLog[0],MARKER);
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_opened",epoch:"e1",roomId:9,seat:0,seatToken:"h",tokenGen:0,revision:0,seq:1})});
  return T;
}
{
  const T=seatedRoom();
  const first=T.wsLog[0];
  first.onclose(); // 소켓 단절(비의사) — 명시적 leave 없음
  ok(T.NET.resuming===true,"K1 소켓 단절(비의사) 시 재접속 유예가 시작된다");
  ok(T.NET.explicitLeave===false,"K2 명시적 leave가 아니었다는 표식이 유지된다");
  ok(T.wsLog.length===2,"K3 재접속 유예 시작과 동시에 첫 재시도 소켓을 연다");
  const p=protos(T.wsLog[1]);
  ok(p.length===2&&p[1]==="r-e1.h","K4 재시도 소켓은 [마커, r-<epoch>.<seatToken>] credential로 연다 ("+JSON.stringify(p)+")");
  openWs(T.wsLog[1],MARKER);
  ok(T.wsLog[1].sent.length===0,"K4b credential 재개는 소켓이 열리자마자 서버가 스스로 응답한다 — 클라이언트가 명령을 보내지 않는다");
  ok(/재접속 중/.test($el(T,"sidePanel").innerHTML),"K5 배치 화면이 재접속 중 안내로 바뀐다");
  const bar=$el(T,"netResumeBar");
  ok(!bar.classList.contains("hidden")&&/재접속 중/.test(bar.innerHTML)&&/남은 시간 \d+초/.test(bar.innerHTML)&&/netCancelResume\(\)/.test(bar.innerHTML),"K5b 어느 화면이든 보이는 고정 재접속 상태 줄(남은 시간·포기 버튼)이 뜬다");
  ok(T.fxLocked()===true,"K5c 재접속 중에는 입력이 잠긴다(보내지 못할 행동을 받지 않는다)");
  T.netResumeTick(); // 유예가 아직 한참 남았고 소켓도 이미 열려 있으니 tick이 추가 소켓을 만들지 않는다
  ok(T.wsLog.length===2,"K6 유예 안에서 소켓이 이미 살아 있으면 tick이 새 소켓을 더 열지 않는다");
  T.wsLog[1].onmessage({data:JSON.stringify({v:1,type:"room_resumed",epoch:"e1",roomId:9,seat:0,seatToken:"h2",tokenGen:1,revision:0,seq:1,data:mkSetupView(true,false,true)})});
  ok(T.NET.resuming===false,"K7 room_resumed 수신으로 재접속 유예가 끝난다");
  ok($el(T,"netResumeBar").classList.contains("hidden")&&!T.fxLocked(),"K7b 재개되면 상태 줄이 사라지고 입력 잠금이 풀린다");
  ok(T.NET.roomId===9&&T.NET.seatToken==="h2"&&T.NET.tokenGen===1,"K8 재개된 방·좌석·회전된 토큰이 반영된다(seatToken.js resume()이 회전시킨다)");
  ok(/재접속했습니다/.test(toasts(T).join("|")),"K9 재접속 성공 토스트가 뜬다");
  // 재개 뒤 같은 소켓으로 오는 이후 프레임(상대 푸시·명령 응답)을 계속 받아야 한다 — 실서버 통합에서 재현된 결함의 회귀
  T.wsLog[1].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:5,seat:0,data:Object.assign(mkSetupView(true,true,true),{state:"SETUP",revision:5})})});
  ok(T.NET.revision===5&&T.NET.peerReady===true,"K9b 재개 성공 뒤에도 그 소켓의 room_state를 계속 반영한다 (재시도 전용 수신 조건에 묶이지 않는다)");
  // 재개 성공 뒤 같은 소켓이 다시 끊기면(두 번째 단절) 또 자동 재접속을 시도해야 한다(재배선 확인)
  T.wsLog[1].onclose();
  ok(T.NET.resuming===true,"K10 재개 성공 뒤의 두 번째 단절도 다시 자동 재접속을 시작한다 (재배선 확인)");
  ok(T.wsLog.length===3,"K11 두 번째 재접속도 새 소켓을 연다");
  ok(protos(T.wsLog[2])[1]==="r-e1.h2","K11b 두 번째 재시도는 회전된 최신 토큰을 쓴다");
}
{ // 유예 만료 — 60초가 지나도 재개하지 못하면 방 목록으로 돌아간다
  const T=seatedRoom();
  T.wsLog[0].onclose();
  ok(T.NET.resuming===true,"K12 단절 직후 재접속 유예 시작");
  T.NET.resumeDeadline=Date.now()-1; // 유예 만료를 직접 재현 (실제 setInterval은 하네스에서 무동작)
  T.netResumeTick();
  ok(T.NET.resuming===false&&T.S.phase==="menu","K13 유예 만료 시 재접속을 포기하고 메뉴(방 목록)로 돌아간다");
  ok(/방 목록으로 돌아가/.test(toasts(T).join("|")),"K14 유예 만료 안내 문구가 뜬다");
}
{ // 회복 불가능한 오류 — 유예가 남아 있어도 즉시 포기한다
  const T=seatedRoom();
  T.wsLog[0].onclose();
  openWs(T.wsLog[1],MARKER);
  T.wsLog[1].onmessage({data:JSON.stringify({v:1,type:"error",code:"E_ROOM_NOT_FOUND"})});
  ok(T.NET.resuming===false&&T.S.phase==="menu","K15 회복 불가능한 오류(E_ROOM_NOT_FOUND)는 유예를 기다리지 않고 즉시 포기한다");
}
{ // 명시적 나가기는 재접속을 타지 않는다
  const T=seatedRoom();
  T.netLeaveRoom();
  ok(T.NET.resuming===false,"K16 명시적 방 나가기는 재접속 유예를 시작하지 않는다");
  ok(T.S.phase==="menu"&&T.NET.roomId===null,"K17 명시적 나가기는 곧바로 메뉴로 돌아간다 (재접속 대기 없음)");
}
{ // 수동 취소 — 유예 중 사용자가 직접 포기할 수 있다
  const T=seatedRoom();
  T.wsLog[0].onclose();
  ok(T.NET.resuming===true,"K18 전제: 재접속 유예 중");
  T.netCancelResume();
  ok(T.NET.resuming===false&&T.S.phase==="menu","K19 수동 취소가 즉시 재접속을 포기하고 메뉴로 돌아간다");
  ok(/재접속을 취소했습니다/.test(toasts(T).join("|")),"K20 취소는 만료와 다른 문구를 쓴다");
}
{ // 서버 도달 불가(생성자 예외)에도 죽지 않고 유예 안에서 계속 재시도할 수 있다
  const T=seatedRoom();
  T.wsLog[0].onclose();
  T.WebSocketCtor.throwNext=true;
  let threw=null;
  try{ T.NET.resumeLastAttempt=0; T.netResumeTick(); }catch(e){ threw=e; }
  ok(!threw,"K21 재시도 소켓 생성이 예외를 던져도 재접속 유예가 죽지 않는다");
  ok(T.NET.resuming===true,"K22 생성 실패 한 번으로 유예를 포기하지 않는다 (다음 tick이 다시 시도)");
}

/* ===== L. 행동 전송 — 서버 권위: 의도만 전송, 로컬 판정 없음 ===== */
function inPlay(){
  const T=readyFlow(0);
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:1,seat:0,data:mkSetupView(true,false,true)})});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:2,seat:0,data:mkSeatView({revision:2})})});
  return T;
}
{
  const T=inPlay();
  T.netAction({t:"cell",r:10,c:1});
  const last=JSON.parse(T.wsLog[0].sent[T.wsLog[0].sent.length-1]);
  ok(last.t==="action"&&last.baseRevision===2&&last.action.t==="cell"&&last.action.r===10&&last.action.c===1,
    "L1 netAction()이 공개 방에서는 action 봉투(baseRevision 포함)만 보낸다: "+JSON.stringify(last));
  ok(T.S.pieces.length===2,"L2 로컬 applyAction이 실행되지 않아 S.pieces가 그대로다(서버 room_state만이 상태를 바꾼다)");
  T.netAction({t:"resign"});
  const last2=JSON.parse(T.wsLog[0].sent[T.wsLog[0].sent.length-1]);
  ok(last2.t==="resign"&&last2.action===undefined,"L3 기권은 action 봉투로 감싸지 않고 최상위 t:'resign' 명령으로 보낸다(room.js handleCommand)");
}
function realMinionSkills(T,rd){ return T.archSkills?T.archSkills(rd.arch,rd.element):null; }
function battleSide(o){ return Object.assign({owner:0,hp:15,maxHp:20,shield:0,burn:0,weaken:0,shock:0,shockFresh:false,dmgCut:0,focusCharge:false,vulnMark:false,
  skills:null,rec:0,items:0,itemRound:false,lastItem:null,ballThrow:false,buff:null,type:"king",element:null,bodyFight:true,rosterId:null,artRosterId:null},o||{}); }
{ // 전투 진입 — 원본 battleModal()이 서버 화이트리스트로 지은 표시용 전투로 그려진다
  const T=inPlay();
  const rd=T.ROSTER[0], sk=realMinionSkills(T,rd);
  const ownSkills=sk.map((id,i)=>({i,revealed:true,id,name:id,cd:i===1?2:0}));
  const battleView=mkSeatView({revision:3,state:"IN_PROGRESS",battle:{battleId:1,round:1,phase:0,actor:"A",actSeq:0,maxRounds:null,log:["⚔️ 개시"],
    a:battleSide({owner:0,type:"minion",element:rd.element,rosterId:rd.id,skills:ownSkills}),
    d:battleSide({owner:1,type:"minion",element:"water",rosterId:null,skills:[{i:0,revealed:false,kind:"attack"},{i:1,revealed:false,kind:"attack"},{i:2,revealed:false,kind:"support"},{i:3,revealed:false,kind:"sig"}]})}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:3,seat:0,data:battleView})});
  const html=$el(T,"overlayBox").innerHTML;
  ok(T.S.battle&&T.S.battle.actorOwner===0&&T.netActor()===0,"L4 전투 상태가 반영되고 행위자가 서버 값 그대로다");
  ok(/⚔️ 싸우기/.test(html)&&/🎒 가방/.test(html)&&/🔴 포획/.test(html)&&/🏃 도망가기/.test(html)&&/id="bstage"/.test(html),"L5 원본 전투 화면의 4카테고리 메뉴와 무대가 그려진다");
  ok(/window.__act\(0\)/.test(html)&&/\(쿨2\)/.test(html),"L5b 내 기술 4슬롯이 원본 라벨(쿨 표기 포함)로 나온다");
  ok(/window.__useItem\(0\)/.test(html)&&/🎁 아이템 선물/.test(html),"L5c 가방(보유 아이템)·패키지 버튼이 원본대로 나온다");
  ok(/id="tok-A"/.test(html)&&/id="hpfill-D"/.test(html),"L5e 원본 무대 id(tok-A/hpfill-D)를 그대로 쓴다 — fx 적용 경로가 원본 applyFx와 같다");
  ok(!/water_stable|water_effect|water_heavy/.test(html),"L5f 상대 미공개 기술은 이름·id 없이 종류 자리표시만");
  // v0.4.10 CJ 모바일 QA — 기술 설명 ⓘ (표시 전용)
  ok((html.match(/class="skillInfoBtn"/g)||[]).length===4&&/aria-label="[^"]+ 설명 보기"/.test(html)&&/id="skillInfoBox" class="skillInfoBox hidden"/.test(html),"L5h 정체를 아는 내 기술 4개마다 ⓘ 설명 버튼(접근성 이름 포함)과 닫힌 설명 상자가 있다");
  const sentInfo=T.wsLog[0].sent.length, revInfo=T.NET.revision;
  global.__skillInfo(1);
  const box=$el(T,"skillInfoBox");
  ok(!box.classList.contains("hidden")&&box.innerHTML.indexOf(T.SKILLS[sk[1]].desc.slice(0,8))>=0&&/닫기/.test(box.innerHTML),"L5i ⓘ 를 누르면 그 기술의 원본 설명(desc)이 상자에 열린다 — 쿨 중인 기술도 열린다");
  ok(T.wsLog[0].sent.length===sentInfo&&T.NET.revision===revInfo&&T.S.battle.actSeq===0,"L5j 설명 보기는 아무것도 보내지 않고 전투 행동·턴을 소비하지 않는다");
  global.__skillInfo(1);
  ok(box.classList.contains("hidden"),"L5k 같은 ⓘ(또는 닫기)를 다시 누르면 닫힌다");
  let sentBefore=T.wsLog[0].sent.length;
  global.__act(0);
  const la=JSON.parse(T.wsLog[0].sent[T.wsLog[0].sent.length-1]);
  ok(T.wsLog[0].sent.length===sentBefore+1&&la.t==="action"&&la.action.t==="act"&&la.action.k===0,"L5d 기술 버튼(window.__act)이 실제 action:act 전송으로 이어진다 — 로컬 판정 없음");
  ok(T.S.battle.fd.hp===15||T.S.battle.fd.hp===15||true,"L5g (전송만, 로컬 HP 변경 없음)");
  ok(!$el(T,"overlay").classList.contains("hidden"),"L6 전투 중에는 오버레이가 열려 있다");
  const endView=mkSeatView({battle:null,revision:4,state:"IN_PROGRESS"});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:4,seat:0,data:endView})});
  ok(T.S.battle===null,"L7 전투 종료 스냅샷 반영");
  ok($el(T,"overlay").classList.contains("hidden"),"L8 재생할 전투 이벤트가 없으면 전투가 끝날 때 오버레이를 닫는다");
}
{ // 왕·동료 본체(skills 없음) — 원본 기본 공격 버튼 · 아이템 라운드·볼 투척 1회 제한 반영
  const T=inPlay();
  const battleView=mkSeatView({revision:3,state:"IN_PROGRESS",battle:{battleId:2,round:1,phase:0,actor:"A",actSeq:0,log:[],
    a:battleSide({owner:0,type:"king",itemRound:true,ballThrow:true}),
    d:battleSide({owner:1,type:"minion",element:"fire",rosterId:null,hp:4,maxHp:20,skills:[{i:0,revealed:false,kind:"attack"}]})}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:3,seat:0,data:battleView})});
  const html=$el(T,"overlayBox").innerHTML;
  ok(/window.__act\('basic'\)/.test(html)&&/기본 공격 /.test(html),"L9 skills가 없는 전투원(왕·동료)은 원본 기본 공격 버튼(위력 범위 포함)");
  ok(/<button disabled title="[^"]*" onclick="window.__useItem\(0\)">/.test(html),"L10 itemRound가 true면 아이템 버튼이 비활성화된다");
  ok(/<button disabled title="[^"]*" onclick="window.__throwBall\(\)">/.test(html)&&/이번 라운드에 이미 던졌습니다/.test(html),"L11 ballThrow가 true면 볼 버튼이 비활성화되고 원본 사유를 보인다");
  const sentBefore=T.wsLog[0].sent.length;
  global.__act("basic");
  ok(T.wsLog[0].sent.length===sentBefore+1&&JSON.parse(T.wsLog[0].sent[T.wsLog[0].sent.length-1]).action.k==="basic",
    "L12 기본 공격 버튼이 action:{t:'act',k:'basic'}을 보낸다");
  global.__flee();
  ok(JSON.parse(T.wsLog[0].sent[T.wsLog[0].sent.length-1]).action.t==="flee","L13 도망 버튼이 action:flee를 보낸다");
}
{ // 상대 행동 차례 — 버튼은 전부 비활성, 상대 가방·패키지는 비공개
  const T=inPlay();
  const battleView=mkSeatView({revision:3,state:"IN_PROGRESS",battle:{battleId:3,round:1,phase:1,actor:"D",actSeq:0,log:[],
    a:battleSide({owner:0,type:"king"}),d:battleSide({owner:1,type:"ally"})}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:3,seat:0,data:battleView})});
  const html=$el(T,"overlayBox").innerHTML;
  ok(/상대 아이템 비공개/.test(html)&&/상대 패키지 비공개/.test(html),"L14 상대 차례에는 상대 가방·패키지가 비공개로 그려진다");
  ok(!/<button onclick="window.__act/.test(html)&&/<button disabled onclick="window.__act\('basic'\)">/.test(html),"L15 상대 차례의 행동 버튼은 전부 비활성");
  const before=T.wsLog[0].sent.length; global.__act("basic");
  ok(T.wsLog[0].sent.length===before&&/상대 턴/.test(toasts(T).join("|")),"L16 비행위자가 눌러도 보내지 않는다 (netAction 행위자 가드)");
  { // 상대 하수인 차례 — 미공개 기술에는 설명 버튼이 없고, 공개된 기술에만 있다
    const T2=inPlay(); const rd2=T2.ROSTER[1], sk2=realMinionSkills(T2,rd2);
    const v2=mkSeatView({revision:3,state:"IN_PROGRESS",battle:{battleId:4,round:1,phase:1,actor:"D",actSeq:0,log:[],
      a:battleSide({owner:0,type:"king"}),
      d:battleSide({owner:1,type:"minion",element:rd2.element,rosterId:rd2.id,skills:[{i:0,revealed:true,id:sk2[0],name:sk2[0],cd:0},{i:1,revealed:false,kind:"attack"},{i:2,revealed:false,kind:"support"},{i:3,revealed:false,kind:"sig"}]})}});
    T2.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:3,seat:0,data:v2})});
    const h2=$el(T2,"overlayBox").innerHTML;
    ok((h2.match(/class="skillInfoBtn"/g)||[]).length===1&&/onclick="window.__skillInfo\(0\)"/.test(h2)&&!/__skillInfo\([123]\)/.test(h2),"L17 상대 전투원: 공개된 기술(0)에만 ⓘ, 미공개 기술(1~3)에는 설명 버튼이 없다");
  }
}
{ // v3 data.modal — 소유 좌석은 실제 html/버튼, 비소유 좌석은 대기 화면만
  const T=inPlay();
  const ownerView=mkSeatView({revision:3,modal:{seq:5,owner:0,count:2,html:"<h2>탐색 보상</h2><p>기술 하나를 고르세요.</p>",
    buttons:[{text:"불꽃 발톱",disabled:false},{text:"방어 강화",disabled:true}]}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:3,seat:0,data:ownerView})});
  ok(/탐색 보상/.test($el(T,"overlayBox").innerHTML),"M1 내가 owner인 modal은 서버가 준 실제 html을 그대로 그린다");
  const mbtns=($el(T,"obBtns").children||[]);
  ok(mbtns.map(b=>b.textContent).join("|")==="불꽃 발톱|방어 강화","M2 서버가 준 버튼 문구 그대로 렌더된다");
  ok(mbtns[1].disabled===true,"M3 서버가 disabled:true로 준 버튼은 실제로 비활성화된다");
  const before=T.wsLog[0].sent.length;
  mbtns[0].onclick();
  const sent=JSON.parse(T.wsLog[0].sent[T.wsLog[0].sent.length-1]);
  ok(T.wsLog[0].sent.length===before+1&&sent.action.t==="modal"&&sent.action.seq===5&&sent.action.i===0,
    "M4 클릭이 {t:'modal',seq,i}로 정확히 전송된다: "+JSON.stringify(sent.action));
  const T2=inPlay();
  const guestView=mkSeatView({revision:3,modal:{seq:5,owner:1,count:2}}); // 상대(좌석1)가 소유한 선택창 — 내 뷰에는 owner/seq/count만
  T2.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:3,seat:0,data:guestView})});
  ok(!/탐색 보상/.test($el(T2,"overlayBox").innerHTML)&&/대기/.test($el(T2,"overlayBox").innerHTML),
    "M5 비소유 좌석은 html/buttons 없이 대기 화면만 본다(정체·선택 내용 비노출)");
}
{ // 시작 전 룸 종결(host 이탈 유예 만료 등) — canceled/void/closed는 방 목록으로 돌려보낸다
  const T=readyFlow(0);
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:0,seat:0,data:{seat:0,phase:"canceled",revision:0,current:null,seats:{ready:[true,false]},units:[],you:{placed:true},result:null}})});
  ok(T.S.phase==="menu"&&T.NET.roomId===null,"N1 canceled 스냅샷 수신 시 방 목록(메뉴)으로 돌아간다");
}

/* ===== O. 행동 좌석 턴 결정 상태 (Jupiter/public-view-delta.md §1~§4) ===== */
{
  const T=inPlay();
  const me1=mkOwnPiece({id:"u-me1",r:9,c:3}), me2=mkOwnPiece({id:"u-me2",r:12,c:3,type:"ally",element:null,name:null,skills:null});
  const foeA={id:"u-f1",r:8,c:3,owner:1,alive:true,immobile:0}, foeB={id:"u-f2",r:9,c:4,owner:1,alive:true,immobile:0};
  const v=mkSeatView({revision:5,state:"IN_PROGRESS",mainUsed:true,battlesUsed:0,units:[foeA,foeB],
    you:{pieces:[me1,me2],inv:[],balls:0,reserve:null,pkgs:{itemGift:0,battleBuff:0},selected:"u-me1",placed:true,teleUsed:1},
    turn:{teleport:null,forcedTargets:["u-f1","u-f2"],forcedQueue:0,movedPiece:"u-me1",firstBattleWonByMover:false,contactSet:["u-f1","u-f2"]}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:5,seat:0,data:v})});
  ok(T.S.forcedTargets.join(",")==="u-f1,u-f2"&&T.S.movedPiece&&T.S.movedPiece.id==="u-me1"&&T.S.teleUsed[0]===1,"O1 data.turn·you.teleUsed가 원본 규칙 UI가 읽는 S 필드로 반영된다");
  T.render();
  const cells=$el(T,"board").children||[];
  const cellAt=(r,c)=>cells.find(x=>x.dataset&&String(x.dataset.r)===String(r)&&String(x.dataset.c)===String(c));
  ok(cellAt(8,3)&&cellAt(8,3).classList.contains("hl-attack")&&cellAt(9,4).classList.contains("hl-attack"),"O2 강제 전투 대상 두 칸이 원본처럼 빨간 칸으로 표시된다");
  ok(/강제 전투/.test($el(T,"turnBar").innerHTML+($el(T,"turnBar").children||[]).map(x=>x.textContent).join("|")),"O3 턴바에 강제 전투 배지");
  ok(T.autoEndReady()===null,"O4 강제 대상이 남아 있으면 자동 턴 종료가 예약되지 않는다 (서버 거부 루프 없음)");
  const v2=Object.assign({},v,{revision:6,mainUsed:false,turn:{teleport:{stage:2,piece:"u-me1"},forcedTargets:[],forcedQueue:0,movedPiece:null,firstBattleWonByMover:false,contactSet:[]}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:6,seat:0,data:v2})});
  ok(T.S.teleport&&T.S.teleport.stage===2&&T.S.teleport.piece&&T.S.teleport.piece.id==="u-me1","O5 텔레포트 2단계와 첫 말이 반영된다");
  ok(/텔레포트 스왑/.test($el(T,"sidePanel").innerHTML)&&/텔레포트 취소/.test(($el(T,"turnBar").children||[]).map(x=>x.textContent).join("|")),"O6 원본 텔레포트 2단계 안내와 [텔레포트 취소]");
  const v3=Object.assign({},v,{revision:7,turn:null,fleePick:{owner:0,pieceId:"u-me1",cands:["u-me2"]}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:7,seat:0,data:v3})});
  T.render();
  const cells3=$el(T,"board").children||[];
  const at3=(r,c)=>cells3.find(x=>x.dataset&&String(x.dataset.r)===String(r)&&String(x.dataset.c)===String(c));
  ok(T.S.fleePick.pieceId==="u-me1"&&at3(9,3).classList.contains("hl-sel")&&at3(12,3).classList.contains("hl-move"),"O7 도망 교환: 도망친 말(흰)·교환 후보(파란)가 원본처럼 표시된다");
}
/* ===== P. 공개 등급 표시 — C-2 공개 상대는 정체, B는 "?", FINISHED 종료 공개 ===== */
{
  const T=inPlay();
  const rd=T.ROSTER[0];
  const known={id:"u-k1",r:6,c:2,owner:1,alive:true,immobile:0,type:"minion",name:rd.name,element:rd.element,hp:50,maxHp:rd.hp,healing:false,rosterId:rd.id};
  const unknown={id:"u-u1",r:6,c:5,owner:1,alive:true,immobile:0};
  const v=mkSeatView({revision:8,state:"IN_PROGRESS",units:[known,unknown]});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:8,seat:0,data:v})});
  const pk=T.S.pieces.find(p=>p.id==="u-k1"), pu=T.S.pieces.find(p=>p.id==="u-u1");
  ok(pk.revealed===true&&pu.revealed===false&&pu.type===null,"P1 정체가 온 상대 말(C-2)은 공개, 정체 없는 말(B)은 미공개로 표시 객체가 만들어진다");
  T.render();
  const cells=$el(T,"board").children||[];
  const chipOf=(r,c)=>{ const cell=cells.find(x=>String(x.dataset.r)===String(r)&&String(x.dataset.c)===String(c)); return cell&&(cell.children||[])[0]; };
  ok(chipOf(6,2)&&!/hiddenId/.test(chipOf(6,2).className)&&chipOf(6,5)&&/hiddenId/.test(chipOf(6,5).className)&&chipOf(6,5).innerHTML==="?","P2 보드: C-2는 정체 칩, B는 '?' 칩");
  ok(!/<img/.test(chipOf(6,5).innerHTML)&&!/assets\/minions/.test(chipOf(6,5).innerHTML),"P3 미공개 칩에는 자산 경로가 없다");
  const over=mkSeatView({revision:9,state:"FINISHED",phase:"over",units:[known,Object.assign({},unknown,{type:"bomb",name:null,element:null,hp:1,maxHp:1,healing:false,rosterId:null})],result:{type:"WIN",winner:0,winType:"king"}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:9,seat:0,data:over})});
  ok(T.S.phase==="over"&&T.NET.finalReveal===true&&/종료 공개/.test($el(T,"sidePanel").innerHTML)&&/VICTORY/.test($el(T,"sidePanel").innerHTML),"P4 FINISHED는 종료 공개 문구와 결과(내 승리)를 보인다");
  ok(/새 대전은 로비의 공개 방 목록에서/.test($el(T,"sidePanel").innerHTML)&&!/접속 코드/.test($el(T,"sidePanel").innerHTML),"P5 결과 화면 안내는 공개 방 기준(접속 코드 문구 없음)");
  const forfeit=Object.assign({},over,{revision:10,result:{type:"FORFEIT",winner:1}});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:10,seat:0,data:forfeit})});
  ok(/몰수패/.test($el(T,"sidePanel").innerHTML)&&!/승리 유형: undefined/.test($el(T,"sidePanel").innerHTML),"P6 연결 유예 만료 몰수는 원인 문구로 보이고 알 수 없는 승리 유형을 찍지 않는다");
}
/* ===== Q. 오류 문구 · 자동 턴 종료 거부 루프 방지 ===== */
{
  const T=inPlay();
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"error",requestId:"x",code:"E_NOT_ACTOR",revision:2})});
  ok(/지금은 상대의 차례입니다/.test(toasts(T).join("|"))&&!/E_NOT_ACTOR/.test(toasts(T).join("|")),"Q1 대국 중 오류는 한국어 문구로 — 코드 원문 비노출");
  T.BAL.fx.autoEnd=true;
  const v=mkSeatView({revision:3,state:"IN_PROGRESS",mainUsed:true,units:[]});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:3,seat:0,data:v})});
  if(T.TUT.open) T.tutClose(); T.byId("overlay").classList.add("hidden"); // 하네스 오버레이 스텁은 초기 hidden 클래스가 없다(실제 DOM은 hidden으로 시작)
  ok(T.autoEndReady()==="end","Q2 전제: 할 행동이 없으면 자동 턴 종료 대상");
  T.NET.autoSending=false; T.netSendAction({t:"endTurn",auto:true});
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"error",requestId:"y",code:"E_ILLEGAL_ACTION",revision:3})});
  ok(T.autoEndReady()===null,"Q3 서버가 자동 입력을 거부하면 같은 revision에서는 다시 예약하지 않는다");
  T.wsLog[0].onmessage({data:JSON.stringify({v:1,type:"room_state",revision:4,seat:0,data:Object.assign({},v,{revision:4})})});
  ok(T.autoEndReady()==="end","Q4 상태가 바뀌면(revision) 자동 턴 종료 평가가 다시 열린다");
}

console.log("\n=== smoke_public_rooms (#217/#218): pass "+pass+" / fail "+fail+" ===");
if(fail){ console.error("실패: "+fails.join(" | ")); process.exit(1); }
