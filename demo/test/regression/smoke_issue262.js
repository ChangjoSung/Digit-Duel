/* #262 경기 중 이모티콘 — 클라이언트(Mars) 회선·표시 계약
   실행: node demo/test/regression/smoke_issue262.js [demo/index.html]
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).
   근거: 2026-09-27 CJ 승인(6종 · 서버 좌석별 5초 · 표시 2.5초 · 경기 전반 양쪽 차례 · 브라우저 상대 숨김) ·
         PD msg_676b615b44e2 회선(성공 emote{epoch,roomId,from,id} · 보낸 쪽만 requestId/cooldownMs · 거부 emote_result ·
         peerConnected · room_resumed.emoteRetryMs)

   절
     A  목록 — 화면 6종 = 서버 EMOTE_IDS(server/authoritative/protocol.js 를 읽어 대조) · 승인 문구 그대로
     B  보낼 수 있는 때 — OPEN(상대 없음)·오프라인 숨김 · SETUP/IN_PROGRESS/FINISHED 가능 · 정지·재접속 중·상대 끊김 잠금
     C  전송 — 전용 emote 봉투 하나만(게임 액션·resync 0) · 응답 전 성공 표시 없음 · 대기 중 중복 전송 없음
     D  내 성공 — 말풍선·간격 5초 초읽기 · 2.5초 뒤 사라짐
     E  상대 — 말풍선·읽어 주기 · 다른 방/에폭/목록 밖 무시 · 숨김(저장·예외 저장소) · 내 것은 계속 보임
     F  거부 — emote_result 의 retryMs 로 초읽기 · 일반 오류 경로(재동기·토스트) 없음 · 지난 응답 무시
     G  재개·나가기 — emoteRetryMs 로 이어 세기 · 말풍선 정리 · 나가면 잔존 0
   서버 판정(허용 ID·간격·정지·기록 없음)은 Jupiter 테스트 소관이라 여기서 다시 검사하지 않는다. */
"use strict";
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
let pass=0,fail=0;
function ok(cond,name){ if(cond) pass++; else { fail++; console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(JSON.stringify(got)===JSON.stringify(want),name+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }

/* 가짜 시계 — 하네스 스텁 타이머는 지연을 무시하므로 간격·표시 시간은 이 시계로 본다 (smoke_issue263_client.js 와 같은 방식) */
const C={now:1e9,q:[],id:0};
function arm(){
  global.setTimeout=(fn,ms)=>{ const id=++C.id; C.q.push({id,at:C.now+(ms||0),fn}); return id; };
  global.clearTimeout=id=>{ C.q=C.q.filter(x=>x.id!==id); };
}
function adv(ms){ const end=C.now+ms;
  for(let g=0;g<100000;g++){ const due=C.q.filter(x=>x.at<=end).sort((a,b)=>a.at-b.at||a.id-b.id)[0]; if(!due) break;
    C.now=due.at; C.q=C.q.filter(x=>x!==due); due.fn(); }
  C.now=end; }
Date.now=()=>C.now;

const MARKER="digit-duel.v1";
function boot(storage){
  const T=H.load(htmlPath,{href:"http://127.0.0.1:8084/",storage:storage||H.mkStorage({tutorialSeen:"1"})}); arm(); C.q=[];
  T.netCreatePublicRoom(); const ws=T.wsLog[T.wsLog.length-1]; ws.readyState=1; ws.protocol=MARKER; ws.onopen();
  T.ws=ws; T.recv=f=>ws.onmessage({data:JSON.stringify(f)});
  T.recv({v:1,type:"room_opened",epoch:"e1",roomId:7,seat:0,seatToken:"tok-7-0",tokenGen:0,revision:0,peerConnected:false,seq:1});
  return T; }
function toSetup(T,extra){ T.recv(Object.assign({v:1,type:"room_state",epoch:"e1",revision:1,seat:0,peerConnected:true,
  data:{seat:0,state:"SETUP",phase:"setup",revision:1,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,pause:null}},extra||{})); }
const el=(T,id)=>T.byId(id);
const hidden=(T,id)=>el(T,id).classList.contains("hidden");
const sent=T=>T.ws.sent.map(s=>JSON.parse(s));
const toastTexts=T=>(el(T,"toasts").children||[]).map(x=>x.textContent);

/* ===== A. 목록 ===== */
{
  const T=boot();
  const server=require(path.join(__dirname,"..","..","..","server","authoritative","protocol.js"));
  eq(T.emote.EMOTES.map(e=>e[0]),[...server.EMOTE_IDS],"A1 화면 ID 6종 = 서버 EMOTE_IDS (순서 포함)");
  eq(T.emote.EMOTES.map(e=>e[1]+e[2]),["👋안녕하세요","👍좋은 수예요","😮놀라워요","🤔고민 중이에요","😅아차","🤝좋은 경기였어요"],"A2 CJ 승인 그림·문구 그대로");
  toSetup(T);
  const html=el(T,"emoteSet").innerHTML;
  eq((html.match(/<button type="button" data-emote="/g)||[]).length,6,"A3 고르기 창은 네이티브 버튼 6개");
  ok(T.emote.EMOTES.every(e=>!/[<>&"']/.test(e.join(""))),"A4 목록 문자열에 HTML 특수문자가 없다 (고정 문구만 그린다)");
}

/* ===== B. 보낼 수 있는 때 ===== */
{
  const T=boot();
  ok(hidden(T,"emoteLayer")&&!T.emote.netEmoteCanSend(),"B1 OPEN(상대 입장 전)에는 층이 숨고 보낼 수 없다");
  toSetup(T);
  ok(!hidden(T,"emoteLayer")&&T.emote.netEmoteCanSend()&&!el(T,"emoteSet").disabled,"B2 SETUP(시작 상점·배치)에서는 보이고 보낼 수 있다");
  for(const st of ["IN_PROGRESS","FINISHED"]){ T.NET.roomState=st; ok(T.emote.netEmoteCanSend(),"B3 "+st+" 에서도 보낼 수 있다 (내 차례·상대 차례 무관)"); }
  T.NET.roomState="SETUP";
  toSetup(T,{data:{seat:0,state:"SETUP",phase:"setup",revision:1,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,pause:[{seat:1,graceLeftMs:50000}]}});
  ok(!T.emote.netEmoteCanSend()&&el(T,"emoteSet").disabled&&/상대 연결/.test(el(T,"emoteWhy").textContent),"B4 단절 정지 중에는 잠기고 사유를 보인다");
  toSetup(T);
  ok(T.emote.netEmoteCanSend(),"B5 정지가 풀리면 다시 보낼 수 있다 (쌓아 둔 전송 없음)");
  toSetup(T,{peerConnected:false});
  ok(!T.emote.netEmoteCanSend()&&el(T,"emoteSet").disabled,"B6 서버가 상대 끊김(peerConnected:false)을 알리면 결과 화면처럼 정지가 없어도 잠긴다");
  toSetup(T);
  T.NET.resuming=true; ok(!T.emote.netEmoteCanSend(),"B7 내가 재접속 중이면 보낼 수 없다"); T.NET.resuming=false;
  T.NET.ws.readyState=3; ok(!T.emote.netEmoteCanSend(),"B8 소켓이 열려 있지 않으면 보낼 수 없다"); T.NET.ws.readyState=1;
  const O=H.load(htmlPath,{storage:H.mkStorage({tutorialSeen:"1"})}); O.startMode("pve"); O.render();
  ok(O.byId("emoteLayer").classList.contains("hidden"),"B9 오프라인 경기에는 층이 없다");
}

/* ===== C·D. 전송과 내 성공 ===== */
{
  const T=boot(); toSetup(T);
  const n0=T.ws.sent.length, rev=T.NET.revision, last=T.NET.lastAction;
  T.emote.emoteToggle();
  ok(!hidden(T,"emotePop")&&el(T,"emoteBtn").getAttribute("aria-expanded")==="true","C1 여는 버튼이 고르기 창을 연다 (aria-expanded)");
  T.emote.emoteSend("nice");
  const f=sent(T).slice(n0);
  eq(f.length,1,"C2 프레임은 하나만 나간다");
  const x=f[0]||{};
  ok(x.v===1&&x.t==="emote"&&x.id==="nice"&&x.seatToken==="tok-7-0"&&x.tokenGen===0&&typeof x.requestId==="string"&&x.requestId.length>0,"C3 전용 emote 봉투(v·requestId·seatToken·tokenGen·id)");
  eq(Object.keys(x).sort(),["id","requestId","seatToken","t","tokenGen","v"],"C4 봉투에 다른 칸(action·baseRevision·화면 정보)이 없다");
  ok(T.NET.revision===rev&&T.NET.lastAction===last,"C5 게임 액션 경로(revision·lastAction)를 건드리지 않는다");
  ok(hidden(T,"emotePop")&&hidden(T,"emoteBubMe"),"C6 보내면 창이 닫히고, 서버 응답 전에는 내 말풍선을 그리지 않는다");
  ok(!T.emote.netEmoteCanSend()&&el(T,"emoteSet").disabled,"C7 응답 대기 중에는 다시 보낼 수 없다");
  T.emote.emoteSend("wow"); eq(T.ws.sent.length,n0+1,"C8 대기 중 두 번째 전송은 나가지 않는다");

  T.recv({v:1,type:"emote",epoch:"e1",roomId:7,from:0,id:"nice",requestId:x.requestId,cooldownMs:5000});
  ok(!hidden(T,"emoteBubMe")&&el(T,"emoteBubMe").textContent==="👍 좋은 수예요","D1 내 emote 프레임을 받으면 내 말풍선");
  ok(T.NET.emoteReq===null&&T.NET.emoteUntil===C.now+5000,"D2 대기 해제 · 간격은 서버 cooldownMs 로");
  eq(el(T,"emoteBtn").textContent,"💬5","D3 여는 버튼에 남은 초");
  ok(/5초 후/.test(el(T,"emoteBtn").getAttribute("aria-label")),"D4 남은 초를 버튼 이름으로도 알린다");
  adv(1000); eq(el(T,"emoteBtn").textContent,"💬4","D5 1초 뒤 4");
  adv(1500); ok(hidden(T,"emoteBubMe"),"D6 표시 2.5초 뒤 말풍선이 사라진다");
  adv(2500); ok(el(T,"emoteBtn").textContent==="💬"&&T.emote.netEmoteCanSend()&&!el(T,"emoteSet").disabled,"D7 5초가 지나면 다시 보낼 수 있다");
  ok(!C.q.length,"D8 간격·표시가 끝나면 남은 타이머가 없다");
}

/* ===== E. 상대 이모티콘 · 숨김 ===== */
{
  const st=H.mkStorage({tutorialSeen:"1"});
  const T=boot(st); toSetup(T);
  T.recv({v:1,type:"emote",epoch:"e1",roomId:7,from:1,id:"hello"});
  ok(!hidden(T,"emoteBubOpp")&&el(T,"emoteBubOpp").textContent==="👋 안녕하세요","E1 상대 말풍선");
  eq(el(T,"emoteLive").textContent,"상대: 안녕하세요","E2 화면 밖 aria-live 로 읽어 준다");
  ok(T.NET.emoteUntil===0,"E3 상대 이모티콘은 내 간격에 영향이 없다");
  adv(3000);
  for(const [f,why] of [[{epoch:"e0"},"다른 에폭"],[{roomId:8},"다른 방"],[{id:"<img src=x>"},"목록 밖 ID"],[{from:2},"없는 좌석"]]){
    T.recv(Object.assign({v:1,type:"emote",epoch:"e1",roomId:7,from:1,id:"gg"},f));
    ok(hidden(T,"emoteBubOpp"),"E4 "+why+" 프레임은 그리지 않는다");
  }
  T.emote.emoteSetMuted(true);
  eq(st.st.dd_emote_mute,"1","E5 숨김은 이 브라우저에 저장된다");
  T.recv({v:1,type:"emote",epoch:"e1",roomId:7,from:1,id:"gg"});
  ok(hidden(T,"emoteBubOpp")&&el(T,"emoteLive").textContent==="","E6 숨긴 동안 상대 것은 그리지도 읽지도 않는다");
  T.recv({v:1,type:"emote",epoch:"e1",roomId:7,from:0,id:"oops",cooldownMs:5000});
  ok(!hidden(T,"emoteBubMe"),"E7 숨겨도 내 것은 보인다");
  T.emote.emoteSetMuted(false); adv(6000);
  ok(hidden(T,"emoteBubOpp"),"E8 숨김을 풀어도 숨긴 동안 온 것을 다시 보여 주지 않는다");
  const T2=boot(H.mkStorage({tutorialSeen:"1",dd_emote_mute:"1"})); toSetup(T2);
  ok(T2.byId("emoteMute").checked===true,"E9 다음 경기(새 로드)에도 숨김이 유지된다");
  const T3=boot(H.throwingStorage()); toSetup(T3);
  T3.emote.emoteSetMuted(true);
  T3.recv({v:1,type:"emote",epoch:"e1",roomId:7,from:1,id:"gg"});
  ok(T3.byId("emoteBubOpp").classList.contains("hidden"),"E10 저장소가 막힌 환경에서도 이 탭에서는 숨김이 동작한다");
}

/* ===== F. 거부 ===== */
{
  const T=boot(); toSetup(T);
  T.emote.emoteSend("think"); const rid=sent(T).pop().requestId, n0=T.ws.sent.length;
  T.recv({v:1,type:"emote_result",ok:false,requestId:"old-req",code:"E_RATE_LIMITED",retryMs:4000});
  ok(T.NET.emoteReq===rid,"F1 다른(지난) 요청의 응답은 무시한다");
  T.recv({v:1,type:"emote_result",ok:false,requestId:rid,code:"E_RATE_LIMITED",retryMs:3200});
  ok(T.NET.emoteReq===null&&T.NET.emoteUntil===C.now+3200,"F2 retryMs 로 서버 간격을 이어 센다 (쿨다운 사본 갱신)");
  eq(el(T,"emoteBtn").textContent,"💬4","F3 3.2초 → 4 로 올림 표시");
  ok(T.ws.sent.length===n0&&!toastTexts(T).length,"F4 일반 오류 경로(resync 송신·토스트)를 타지 않는다");
  ok(hidden(T,"emoteBubMe"),"F5 거부는 성공 표시가 없다");
  adv(3200);
  T.emote.emoteSend("gg"); const r2=sent(T).pop().requestId;
  T.recv({v:1,type:"emote_result",ok:false,requestId:r2,code:"E_PAUSED"});
  ok(T.NET.emoteReq===null&&T.NET.emoteUntil<=C.now&&toastTexts(T).some(s=>/상대 연결/.test(s)),"F6 정지 거부는 간격 없이 사유만 알린다");
}

/* ===== G. 재개 · 나가기 ===== */
{
  const T=boot(); toSetup(T);
  T.recv({v:1,type:"emote",epoch:"e1",roomId:7,from:1,id:"wow"});
  T.ws.onclose({code:1006});
  ok(hidden(T,"emoteBubOpp")&&T.NET.resuming,"G1 소켓이 끊기면 말풍선을 지우고 재접속한다");
  const ws2=T.wsLog[T.wsLog.length-1]; ws2.readyState=1; ws2.protocol=MARKER; ws2.onopen&&ws2.onopen();
  ws2.onmessage({data:JSON.stringify({v:1,type:"room_resumed",epoch:"e1",roomId:7,seat:0,seatToken:"tok-7-0b",tokenGen:1,revision:1,emoteRetryMs:2600,peerConnected:true,
    data:{seat:0,state:"SETUP",phase:"setup",revision:1,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,pause:null}})});
  ok(T.NET.emoteUntil===C.now+2600&&el(T,"emoteBtn").textContent==="💬3","G2 새로고침·재접속해도 서버가 준 남은 간격을 이어 센다");
  ok(!T.emote.netEmoteCanSend(),"G3 남은 간격 동안은 보낼 수 없다");
  T.emote.emoteToggle();
  T.netLeaveRoom();
  ok(T.NET.emoteUntil===0&&T.NET.emoteReq===null&&T.NET.peerConnected===null,"G4 나가면 간격 사본·대기·상대 연결 값이 남지 않는다");
  ok(hidden(T,"emoteLayer")&&hidden(T,"emotePop")&&hidden(T,"emoteBubMe")&&hidden(T,"emoteBubOpp"),"G5 나가면 층·창·말풍선이 모두 닫힌다");
  ok(!T.emote.EMO.tick&&T.emote.EMO.bub.every(x=>x===null),"G6 이모티콘 타이머 잔존 0");
}

console.log((fail?"FAIL":"PASS")+" smoke_issue262: "+pass+" passed, "+fail+" failed");
process.exit(fail?1:0);
