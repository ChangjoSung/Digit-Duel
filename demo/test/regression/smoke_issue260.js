/* #260 계정 로비 클라이언트 회귀 — node demo/test/regression/smoke_issue260.js
   서버(/api/auth/session·GET /api/profile·POST /api/profile/representative)는 fetch 스텁이다 — PD 확정 계약(2026-09-27):
   GET /api/profile → {nickname, representativeMinion, stats:{wins,losses}, matches:[≤20 {result:WIN|LOSS|NO_CONTEST, reason, opponentNickname, turns, durationMs, endedAt}], pendingMatches}
     A. 제품 진입점 제거 — 페이지 로드 튜토리얼 자동 표시·타이틀/상단 튜토리얼 버튼·옛 PVE 5급/5단·핫시트·관전 링크 없음 · 경기 중 도움말 미표시 · 엔진 진입점은 그대로
     B. 로그인 유지 상태에서도 타이틀 → [시작] → 실제 로딩 → 로비 · 가짜 진행률 없음 · 자산 성공/실패/무응답(대체 표시로 끝남)
     C. 계정 프로필 — 서버 값만 표시(전적·닉네임·대표 하수인) · 실패·무응답은 오류+다시 시도(0 전적으로 꾸미지 않음) · 401 은 로그인 화면
     D. 최근 기록(같은 응답) 최대 20 · 결과 대문자·ms 시간 · 저장 대기 표시 · 닉네임 형식 검사 · 방 목록 실패는 로비를 막지 않는다
     E. 잠긴 메뉴·싱글 두 카드 — 키보드로 닿는 aria-disabled 버튼 + 안내 · 재화 0
     F. 대표 하수인 — 일반 30종만 · 기본 새끼 화룡 · 서버 저장 성공 때만 바뀜 · 아트 없는 종은 이모지 · 방 좌석 reps 표시 */
"use strict";
const H=require("../shared/harness");
const fs=require("fs"), path=require("path");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
const JS=f=>fs.readFileSync(path.join(path.dirname(htmlPath),"js",f),"utf8");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const HTTPS="https://dd.example.com/", ALICE={userId:"alice_1",nickname:"앨리스",hasEmail:true};
const M=i=>({result:["WIN","LOSS","NO_CONTEST"][i%3],opponentNickname:i===0?"<b>x</b>":"밥돌이",reason:["resign","forfeit","both_disconnected"][i%3],turns:30+i,durationMs:125400,endedAt:"2026-09-27T00:00:00Z"});
const PROF={nickname:"앨리스",representativeMinion:"M-L2",stats:{wins:3,losses:1},matches:Array.from({length:25},(_,i)=>M(i)),pendingMatches:0}; // 서버는 ≤20 을 보내지만 넘쳐도 20 만 그린다
const calls=[]; let routes={};
const fetchStub=async(url,init)=>{
  init=init||{}; calls.push({url:String(url),init});
  const h=routes[(init.method||"GET")+" "+url];
  if(!h) throw new TypeError("fetch failed");
  const r=typeof h==="function"?await h(init):h;
  if(r==="hang") return new Promise(()=>{});
  return {status:r[0],json:async()=>r[1]};
};
const tick=async()=>{ for(let i=0;i<12;i++) await new Promise(r=>setImmediate(r)); };
const IN={"GET /api/auth/session":[200,ALICE],"GET /api/profile":[200,PROF]};
async function boot(href,rt){
  routes=Object.assign({},rt); calls.length=0;
  const T=H.load(htmlPath,{href,fetch:fetchStub,storage:H.mkStorage()});
  await tick(); return T;
}
const side=T=>T.byId("sidePanel").innerHTML;
const assetsLoad=(T,how)=>{ for(const a of T.LOBBY.assets) if(a.state==="loading") a.img[how||"onload"](); };
const gets=p=>calls.filter(c=>c.url===p&&!(c.init.method));

(async()=>{
/* ===== A. 제품 진입점 ===== */
{
  const T=await boot("file:///C:/Digit-Duel/demo/index.html");
  const html=fs.readFileSync(htmlPath,"utf8");
  ok(T.TUT.open===false&&T.TUT.seenThisLoad===false,"A1 페이지 로드 튜토리얼 자동 표시 없음");
  ok(!/tutOpen\(/.test(html)&&!/id="tutBtn"/.test(html)&&!/tutOpen/.test(JS("bootstrap.js")),"A2 타이틀·상단 바·부트스트랩에 튜토리얼 진입점 없음");
  ok(/>시작 →</.test(html),"A3 타이틀 버튼은 [시작]");
  T.uiStart(); assetsLoad(T); T.render();
  const s=side(T);
  ok(T.uiScreenName()==="lobby"&&T.lobby.lobbyReady(),"A4 계정 없는 경로(file://) — 자산 뒤 로비");
  ok(!/startMode\(|핫시트|5급|5단|AI vs AI|튜토리얼|tutOpen/.test(s),"A5 로비에 옛 PVE·핫시트·관전·튜토리얼 진입점 없음");
  const ui=JS("ui.js");
  ok(!/\btutHint\(/.test(ui)&&/event\.type==="tutHint"\) continue;/.test(ui),"A6 경기 중 도움말 — 화면 소비기가 띄우지 않는다(Core 이벤트는 그대로)");
  ok(typeof T.tutOpen==="function"&&typeof T.tutHint==="function","A7 튜토리얼 모듈은 회귀 검사용으로 남는다");
  T.startMode("pve"); ok(T.S.mode==="pve"&&T.S.phase==="setup","A8 엔진 진입점 startMode 는 그대로(테스트 호출)");
}

/* ===== B. 로그인 유지 → 타이틀 → [시작] → 실제 로딩 → 로비 ===== */
{
  const T=await boot(HTTPS,IN);
  ok(T.AUTH.state==="in"&&T.UI.entered===false&&T.uiScreenName()==="title","B1 로그인 유지 상태여도 타이틀에서 시작");
  ok(gets("/api/profile").length===0,"B2 [시작] 전에는 프로필을 부르지 않는다");
  T.uiStart();
  ok(T.UI.entered===true&&T.uiScreenName()==="lobby"&&!T.lobby.lobbyReady(),"B3 [시작] 직후 로딩 상태");
  ok(T.document.activeElement===T.byId("lobbyLoadTitle"),"B3b 로딩 제목에 초점");
  const s=side(T);
  ok(/화면 자산/.test(s)&&/계정 정보/.test(s)&&/방 목록/.test(s)&&/0\/2 불러오는 중/.test(s)&&!/\d+%/.test(s),"B4 항목별 실제 상태 · 퍼센트 진행률 없음");
  await tick();
  ok(!T.lobby.lobbyReady(),"B5 프로필이 와도 자산이 끝나기 전에는 로비가 아니다");
  const [a0,a1]=T.LOBBY.assets; a0.img.onload(); ok(/1\/2 불러오는 중/.test(side(T)),"B6 끝난 자산 수만 센다");
  a1.img.onerror();
  ok(T.lobby.lobbyReady()&&/앨리스/.test(side(T)),"B7 자산 하나가 실패해도 대체 표시로 로비");
  ok(T.document.activeElement===T.byId("lobbyNick")&&/id="lobbyNick" tabindex="-1"/.test(side(T)),"B7b 로딩이 끝나면 초점이 로비 제목으로 간다(키보드·스크린리더)");
  ok(!T.byId("app").classList.contains("uiArt"),"B8 자산이 모두 오지 않으면 그림 아이콘을 켜지 않는다(이모지·CSS)");
  ok(T.wsLog.length===1&&/l-/.test((T.wsLog[0].protocols||[])[1]||""),"B9 방 목록은 로딩과 함께 요청(기다리지 않음)");
  T.byId("overlay").classList.add("hidden"); T.byId("tutOverlay").classList.add("hidden"); global.uiBack(); ok(T.UI.entered===false,"B10 로비·로딩에서 ← 는 타이틀");
  const okImg=T.LOBBY.assets[0].img;
  T.uiStart(); ok(T.LOBBY.assets[0].state==="ok"&&T.LOBBY.assets[0].img===okImg&&T.LOBBY.assets[1].state==="loading","B11 다시 시작하면 실패한 자산만 다시 받는다(성공한 것은 그대로)");
  assetsLoad(T); await tick();
  ok(T.byId("app").classList.contains("uiArt"),"B12 모두 오면 #253 아이콘·패널을 쓴다");
  /* 무응답 자산 — 시간 제한 타이머로 대체 표시 */
  const U=await boot(HTTPS,IN); U.uiStart(); await tick();
  ok(!U.lobby.lobbyReady(),"B13 무응답 자산은 아직 로딩"); U.drain();
  ok(U.lobby.lobbyReady()&&U.LOBBY.assets.every(a=>a.state==="fail"),"B14 시간 제한이 지나면 대체 표시로 로비(무한 대기 없음)");
}

/* ===== C. 프로필 — 서버 값만 ===== */
{
  const T=await boot(HTTPS,IN); T.uiStart(); assetsLoad(T); await tick();
  const s=side(T);
  ok(/3승 1패/.test(s)&&/뇌격수/.test(s)&&/aria-label="재화 0/.test(s),"C1 서버 전적·대표 하수인·재화 0");
  ok(!/⭐|HP|atk/.test(s.replace(/<[^>]+>/g,"")),"C2 프로필에 전투 수치가 없다");
  const bad=await boot(HTTPS,Object.assign({},IN,{"GET /api/profile":[500,{}]})); bad.uiStart(); assetsLoad(bad); await tick();
  ok(!bad.lobby.lobbyReady()&&bad.LOBBY.prof==="err"&&/다시 시도/.test(side(bad))&&!/승 .*패/.test(side(bad)),"C3 프로필 오류 — 로딩에 오류·다시 시도, 전적을 꾸미지 않음");
  bad.drain(); // 남은 시간 제한 타이머가 이미 끝난 결과를 바꾸지 않는다
  ok(bad.LOBBY.prof==="err","C4 늦은 타이머가 결과를 바꾸지 않는다");
  routes["GET /api/profile"]=[200,PROF]; bad.lobby.lobbyRetry(); await tick();
  ok(bad.lobby.lobbyReady()&&/3승 1패/.test(side(bad)),"C5 다시 시도 성공");
  const slow=await boot(HTTPS,Object.assign({},IN,{"GET /api/profile":"hang"})); slow.uiStart(); assetsLoad(slow); await tick();
  ok(slow.LOBBY.prof==="loading"&&/계정 정보<\/span><b role="status">불러오는 중/.test(side(slow)),"C6 느린 네트워크 — 불러오는 중 표시");
  slow.drain(); await tick();
  ok(slow.LOBBY.prof==="err"&&/응답이 늦어/.test(side(slow)),"C7 시간 제한 뒤 오류(무한 대기 없음)");
  const exp=await boot(HTTPS,Object.assign({},IN,{"GET /api/profile":[401,{error:"E_NO_SESSION"}]})); exp.uiStart(); routes["GET /api/auth/session"]=[401,{error:"E_NO_SESSION"}]; await tick(); // 서버가 세션을 끝냈다
  ok(exp.AUTH.state!=="in"&&exp.UI.entered===false,"C8 계정 만료 — 로그인 화면(#259 경로)");
  const odd=await boot(HTTPS,Object.assign({},IN,{"GET /api/profile":[200,{nickname:"앨리스",representativeMinion:"L-DRAGON",stats:{wins:-1,losses:"2"}}]})); odd.uiStart(); assetsLoad(odd); await tick();
  ok(odd.LOBBY.profile.repMinion==="M-F1"&&/전적 확인 불가/.test(side(odd))&&/새끼 화룡/.test(side(odd))&&/기록을 확인할 수 없습니다/.test(side(odd)),"C9 모르는 대표·전적·기록 값은 꾸미지 않는다(기본 새끼 화룡·확인 불가)");
  const nick=await boot(HTTPS,Object.assign({},IN,{"GET /api/profile":[200,{nickname:"<img src=x>",stats:{wins:0,losses:0}}]})); nick.uiStart(); assetsLoad(nick); await tick();
  ok(nick.LOBBY.prof==="err"&&!/<img src=x>/.test(side(nick)),"C10 형식이 틀린 닉네임은 받지 않는다");
  const R=await boot(HTTPS,IN); R.uiStart(); assetsLoad(R); await tick();
  ok(gets("/api/profile").length===1&&calls.every(c=>c.url!=="/api/profile/matches"),"C11a 첫 입장에 프로필 GET 1회(기록도 같은 응답 — 별도 요청 없음)");
  R.startMode("pve"); R.toLobby(); await tick();
  ok(gets("/api/profile").length===2,"C11 경기·준비에서 로비로 돌아오면 프로필·기록을 다시 불러온다(새 결과 반영)");
  R.render(); await tick(); ok(gets("/api/profile").length===2,"C12 로비에 머무는 동안 다시 그려도 새로 요청하지 않는다");
  R.startMode("pve"); global.netLeaveRoom(); await tick(); // R 이 가장 최근 로드라 전역 진입점이 R 의 것이다
  ok(gets("/api/profile").length===3,"C13 방 나가기·재접속 실패처럼 다른 경로로 들어와도 불러온다(영원한 로딩 없음)");
}

/* ===== D. 기록·방 목록은 로비를 막지 않는다 ===== */
{
  const T=await boot(HTTPS,IN); T.uiStart(); assetsLoad(T); await tick();
  const s=side(T);
  ok((s.match(/<li class="h-/g)||[]).length===20,"D1 최근 20경기만 표시");
  ok(/&lt;b&gt;x&lt;\/b&gt;|알 수 없음/.test(s)&&!/<b>x<\/b>/.test(s),"D2 상대 닉네임은 형식 검사·이스케이프");
  ok(/<b>승<\/b>/.test(s)&&/<b>패<\/b>/.test(s)&&/<b>무효<\/b>/.test(s)&&/기권/.test(s)&&/연결 종료 몰수/.test(s)&&/양쪽 연결이 모두 끊겨 무효/.test(s)&&/30턴/.test(s)&&/2분 5초/.test(s),"D3 WIN/LOSS/NO_CONTEST·사유·턴·durationMs→분초");
  ok(!/저장을 기다리는/.test(s),"D4 저장 대기 0 이면 안내 없음");
  const h=await boot(HTTPS,Object.assign({},IN,{"GET /api/profile":[200,Object.assign({},PROF,{pendingMatches:2,matches:[{result:"DRAW?"},M(1)]})]})); h.uiStart(); assetsLoad(h); await tick();
  ok(/결과 저장을 기다리는 경기 2건/.test(side(h))&&(side(h).match(/<li class="h-/g)||[]).length===1,"D5 pendingMatches 는 저장 대기로 정직하게 표시 · 모르는 결과 값은 버린다");
  const h2=await boot(HTTPS,Object.assign({},IN,{"GET /api/profile":[200,Object.assign({},PROF,{pendingMatches:[1,2]})]})); h2.uiStart(); assetsLoad(h2); await tick();
  ok(h2.LOBBY.profile.pending===null&&!/저장을 기다리는/.test(side(h2)),"D5b pendingMatches 는 음 아닌 정수만(배열 등은 표시하지 않는다)");
  const w=T.wsLog[T.wsLog.length-1]; w.onerror&&w.onerror();
  ok(T.lobby.lobbyReady()&&/공개 방을 불러오지 못했습니다/.test(side(T)),"D6 방 목록 실패 — 로비 유지·방 카드 안 다시 시도");
  /* 서버 E_RESULTS_BACKLOG(미저장 결과 200건·outbox 쓰기 실패) — 방 생성·참가 거부. 잠시 후 다시 시도 안내, 로비·프로필·입력은 그대로 */
  for(const [label,go] of [["생성",()=>T.netCreatePublicRoom()],["참가",()=>T.netJoinPublicRoom("5")]]){
    const n=T.wsLog.length; go(); await tick();
    const w=T.wsLog[T.wsLog.length-1]; ok(T.wsLog.length===n+1,"D7 "+label+" 소켓"); w.readyState=1; w.protocol="digit-duel.v1"; w.onopen&&w.onopen();
    const prof=T.LOBBY.profile;
    w.onmessage({data:JSON.stringify({v:1,type:"error",code:"E_RESULTS_BACKLOG"})});
    const s2=side(T);
    ok(/지난 경기 결과를 저장하는 중/.test(s2)&&/잠시 후 다시 시도/.test(s2)&&!/E_RESULTS_BACKLOG|200|outbox/i.test(s2.replace(/<[^>]+>/g,"")),"D7 "+label+" 거부 — 한국어 다시 시도 안내(내부 코드·건수 없음)");
    ok(T.NET.lobbyPending===null&&T.NET.roomId===null&&T.LOBBY.profile===prof&&/3승 1패/.test(s2)&&/다시 시도<\/button>/.test(s2)&&!/disabled onclick="netCreatePublicRoom/.test(s2),"D7 "+label+" 뒤 로비·프로필 유지·버튼 다시 누를 수 있음");
  }
}

/* ===== D8. Saturn REVISE — 무효 경기 사유는 한국어로, 내부 코드는 화면에 없다 ===== */
{
  const reasons=["both_disconnected","server_restart","server_error","mystery_code"];
  const P=Object.assign({},PROF,{matches:reasons.map(r=>Object.assign(M(2),{reason:r}))});
  const T=await boot(HTTPS,Object.assign({},IN,{"GET /api/profile":[200,P]})); T.uiStart(); assetsLoad(T); await tick();
  const txt=side(T).replace(/<[^>]+>/g,"");
  ok(/양쪽 연결이 모두 끊겨 무효/.test(txt)&&/서버 재시작으로 무효/.test(txt)&&/서버 문제로 중단/.test(txt)&&/경기 종료/.test(txt),"D8 무효 사유 3종 한국어 · 모르는 값은 '경기 종료'");
  ok(!/both_disconnected|server_restart|server_error|mystery_code|NO_CONTEST/.test(txt),"D8b 내부 사유 코드·결과 코드가 화면 글자에 없다");
}

/* ===== E. 잠금 ===== */
{
  const T=await boot(HTTPS,IN); T.uiStart(); assetsLoad(T); await tick();
  const s=side(T);
  const locked=s.match(/<button type="button" class="locked[^"]*" aria-disabled="true"/g)||[];
  ok(locked.length===9,"E1 잠긴 버튼 9개(싱글 2 + 메뉴 7): "+locked.length);
  ok(/무제한 AI 대전/.test(s)&&/도전! 왕국 대전/.test(s)&&/설정/.test(s)&&/재화 획득/.test(s)&&/미션/.test(s)&&/이벤트/.test(s)&&/로비 상점/.test(s)&&/하수인 설정/.test(s)&&/랭크/.test(s),"E2 지정 메뉴 전부");
  ok(!/class="locked[^>]*\sdisabled[\s>]/.test(s),"E3 disabled 가 아니라 aria-disabled — 키보드 포커스·Enter/Space 로 안내");
  T.lobby.lobbyLocked("미션");
  ok(/미션 — 추후 공개/.test(T.byId("lobbyToast").innerHTML),"E4 누르면 추후 공개 안내(#238 CJ 최신 1: 사라지는 토스트)");
  ok(/id="lobbyToast"[^>]*role="status"[^>]*aria-live="polite"/.test(s),"E5 안내는 스크린리더에 알린다");
  ok(/Google 로그인 — 추후 공개/.test(JS("account.js")),"E6 Google 로그인 잠금(#259 그대로)");
}

/* ===== F. 대표 하수인 ===== */
{
  const T=await boot(HTTPS,IN); T.uiStart(); assetsLoad(T); await tick();
  T.lobby.lobbyRepOpen();
  const box=T.byId("overlayBox").innerHTML;
  ok((box.match(/class="repPick"/g)||[]).length===30&&T.ROSTER.length===30,"F1 일반 30종만");
  const ids=(box.match(/lobbyRepPick\('([^']+)'\)/g)||[]).map(x=>x.slice(14,-2));
  ok(ids.length===30&&ids.every(id=>/^M-[FWGLE]\d$/.test(id))&&new Set(ids).size===30&&ids.every(id=>T.ROSTER.some(r=>r.id===id)),"F2 왕·동료·전설 없이 일반 ROSTER ID 만");
  ok(/aria-pressed="true"[^>]*onclick="lobbyRepPick\('M-L2'\)"/.test(box),"F3 지금 대표가 눌림 표시");
  routes["POST /api/profile/representative"]=[200,{representativeMinion:"M-E1"}];
  await T.lobby.lobbyRepPick("M-E1");
  const post=calls.filter(c=>c.init.method==="POST").pop();
  ok(post&&post.url==="/api/profile/representative"&&JSON.parse(post.init.body).minionId==="M-E1","F4 서버에 {minionId} 저장 요청");
  ok(T.LOBBY.profile.repMinion==="M-E1"&&/바위 두더지/.test(side(T))&&/🗻/.test(side(T)),"F5 저장 성공 뒤 반영 · 아트 없는 종은 속성 이모지");
  routes["POST /api/profile/representative"]=[400,{error:"E_BAD_INPUT"}];
  await T.lobby.lobbyRepPick("M-F2");
  ok(T.LOBBY.profile.repMinion==="M-E1","F6 서버 거부면 이전 값 유지");
  routes["POST /api/profile/representative"]=[200,{representativeMinion:"M-F1"}];
  await T.lobby.lobbyRepPick("M-F2");
  ok(T.LOBBY.profile.repMinion==="M-E1","F6b 서버가 다른 값을 확정하면 요청값으로 꾸미지 않는다");
  const n=calls.length; await T.lobby.lobbyRepPick("K-1");
  ok(calls.length===n,"F7 30종 밖 ID 는 요청하지 않는다");
  /* 방 좌석: 서버가 입장 때 고정한 reps — 일반 30종 ID 만 그린다 */
  T.NET.me=0; T.NET.players=["앨리스","밥돌이"]; T.NET.reps=["M-F1","M-W2"];
  ok(/밥돌이 · 심해 사냥꾼/.test(T.lobby.lobbySeatRepHtml(1)),"F8 상대 좌석 닉네임·대표 하수인");
  T.NET.reps=["M-F1",null]; ok(T.lobby.lobbySeatRepHtml(1)==="","F9 모르는 대표는 그리지 않는다");
  const net=JS("network.js");
  ok(/NET\.reps=\[0,1\]\.map\(i=>lobbyRepOk\(m\.reps\[i\]\)\?m\.reps\[i\]:null\)/.test(net),"F10 수신 reps 는 30종 ID 검사를 거친다");
}

/* ===== G. Saturn REVISE — 계정 패널 터치 44px · 제품 화면에 내부 기획 문서 안내 없음 ===== */
{
  const css=fs.readFileSync(path.join(path.dirname(htmlPath),"css","game.css"),"utf8"), html=fs.readFileSync(htmlPath,"utf8");
  const esc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const mh=sel=>{ const m=new RegExp(esc(sel)+"\\{[^}]*min-height:(\\d+)px").exec(css); return m?+m[1]:0; };
  ok(mh("#acctPanel button")>=44&&mh("#acctPanel .acctTabs button")>=44&&/#acctPanel input\[type=email\]\{min-height:44px/.test(css),"G1 계정 탭·버튼·입력 44px 이상");
  ok(!/@media[^{]*\{[^}]*#acctPanel[^}]*min-height:(\d|[1-3]\d|4[0-3])px/.test(css),"G2 어떤 뷰포트 미디어 규칙도 계정 패널 높이를 44 아래로 내리지 않는다");
  ok(mh(".lockGrid button,.lobbyLoading button,#app[data-screen=\"lobby\"] #sidePanel button")>=44&&mh(".repPick")>=44&&mh(".lockCard")>=44,"G3 새 로비 컨트롤(잠금·재시도·대표 선택) 44px 이상");
  ok(!/id="drawerRef"|GDD-|스캐폴드|간소화 범위|\[DATA\]/.test(html),"G4 제품 화면에 내부 기획·구현 문서 안내가 없다");
}

console.log(`smoke_issue260: ${pass} passed, ${fail} failed`);
if(fail){ console.error(fails.join("\n")); process.exit(1); }
})().catch(e=>{ console.error(e); process.exit(1); });
