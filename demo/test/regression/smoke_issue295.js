/* #295 방 대기(L03) 연결 끊김 · 내보내기 · 상대↔서버 지연 · 내 공식 전적 다시 받기 — node demo/test/regression/smoke_issue295.js
   서버는 스텁이다(Jupiter 회선 계약: lobby.kickInMs 정수|null · lobby.canKick · 최상위 peerPingMs · peer_ping{ms} · lobby_kick 명령).
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).
     A  끊김·내보내기 — 서버 peerConnected=false 만 끊김 · 방장만 30초 카운트다운+[내보내기] · canKick 때만 활성 · 참가자는 버튼 없음 · 복귀 = 해제
     B  지연 — 서버가 잰 상대↔서버 ms · 높은 값은 끊김이 아니다 · peer_ping 실시간 갱신 · 이상값 —
     C  전적 — 방 대기에 들어올 때 한 번(하트비트마다 아님) · 저장 대기 = '저장 중' + 확정까지 재시도 · 실패 = 옛 승·패 숨김 · 계정 전환 뒤 늦은 응답 버림
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
  ok(/id="peerPing"[^>]*title="서버가 잰 상대와 게임 서버 사이의 왕복 시간입니다\. 나와 상대 사이의 직접 핑이 아닙니다\.">상대↔서버 42ms</.test(w()),"B1 상대 카드 = 서버가 잰 상대↔서버 ms · 직접 핑 아님 표시");
  T.netHandlePublicMessage({type:"peer_ping",ms:4800});
  ok(N.peerPing===4800&&/상대↔서버 4800ms/.test(w())&&!/연결 끊김|내보내기/.test(w()),"B2 peer_ping 갱신 · 높은 지연만으로 끊김·내보내기 없음");
  for(const bad of [-1,1.5,"9",null]){ T.netHandlePublicMessage({type:"peer_ping",ms:bad}); if(N.peerPing!==null) ok(false,"B3 이상값 "+bad); }
  ok(/상대↔서버 —/.test(w()),"B3 이상값·null = —");

  /* ===== A 끊김·내보내기 ===== */
  T.netHandlePublicMessage({type:"room_state",data:WAIT(8,{kickInMs:30000,canKick:false}),peerConnected:false,peerPingMs:null});
  let h=w();
  ok(/연결 끊김/.test(h)&&/<span id="lobbyKickCd">30<\/span>초 뒤 내보내기 가능/.test(h)&&/disabled onclick="lobbyWaitSend\(netLobbyKick\)">내보내기/.test(h),"A1 방장 — 서버 확정 끊김 · 30초 카운트다운 · [내보내기] 비활성");
  global.netLobbyKick(); ok(!sent.some(m=>m.t==="lobby_kick"),"A2 canKick 전에는 명령을 보내지 않는다");
  N.lobby.at-=31000; ok(/disabled onclick="lobbyWaitSend\(netLobbyKick\)"/.test(w()),"A3 로컬 카운트다운이 끝나도 서버 canKick 전에는 비활성");
  T.netHandlePublicMessage({type:"room_state",data:WAIT(9,{kickInMs:0,canKick:true}),peerConnected:false});
  h=w(); ok(/지금 내보낼 수 있습니다/.test(h)&&/class="danger"  onclick="lobbyWaitSend\(netLobbyKick\)">내보내기/.test(h),"A4 서버 canKick = [내보내기] 활성");
  global.netLobbyKick(); const k=sent.find(m=>m.t==="lobby_kick");
  ok(!!k&&k.round===1&&typeof k.requestId==="string","A5 lobby_kick = 인증 좌석 명령(round·requestId·seatToken 봉투)");
  N.me=1; T.netHandlePublicMessage({type:"room_state",data:WAIT(10,{kickInMs:null,canKick:false}),peerConnected:false});
  h=w(); ok(/방장 연결이 끊겼습니다/.test(h)&&!/내보내기|lobbyKickCd/.test(h),"A6 참가자 — 방장 끊김 표시만 · 내보내기 없음");
  N.me=0; T.netHandlePublicMessage({type:"room_state",data:WAIT(11,{kickInMs:null,canKick:false}),peerConnected:true,peerPingMs:50});
  h=w(); ok(!/연결 끊김|내보내기|lobbyKickCd/.test(h)&&/상대↔서버 50ms/.test(h),"A7 60초 전 복귀 = 끊김·카운트다운·버튼 해제");
  T.netHandlePublicMessage({type:"room_state",data:WAIT(12,{peerInResult:true,kickInMs:30000,canKick:false}),peerConnected:false});
  ok(/연결 끊김/.test(w())&&/lobbyKickCd/.test(w()),"A8 FINISHED(상대 결과 화면) 중 끊김도 방장이 방 대기에 돌아온 뒤 같은 내보내기 흐름");

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
  const toasts=[]; const box=T.byId("toasts"), ap=box.appendChild.bind(box); box.appendChild=el=>{ toasts.push(String(el.textContent||"")); return ap(el); };
  N.resuming=true; N.roomId=7;
  T.netHandlePublicMessage({type:"error",code:"E_SEAT_TOKEN_INVALID"});
  ok(!N.resuming&&N.roomId===null&&T.LOBBY.view==="rooms"&&toasts.some(t=>/이 방의 자리가 종료되었습니다/.test(t))&&!toasts.some(t=>/추방|차단|강퇴/.test(t)),"D1 재개 거부 = 공통 좌석 종료 안내 → 방 목록(사유·차단 표현 없음)");

  console.log(`smoke_issue295: ${pass} passed, ${fail} failed`);
  process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
