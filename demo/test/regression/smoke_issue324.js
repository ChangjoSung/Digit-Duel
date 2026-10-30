/* #265·#322·#324 (v0.4.16 · 튜토리얼 Rev2) 싱글플레이 클라이언트 회귀 — node demo/test/regression/smoke_issue324.js
   서버(/api/auth/* · POST /api/profile/tutorial v2 · POST /api/profile/ai-clear)는 fetch 스텁이다 — SERVER Operations(Jupiter) v2 카테고리 계약,
   의미·문구는 PLAN Singleplayer Draft §3R(Venus · 단계·문구·트리거 유일 표 3R.3). 실서버 저장 E2E 는 이 파일이 아니다(Mars artifact 의 브라우저 증빙).
   기본 B1~B9 는 **실제 엔진**의 고정 합법 보드 위에서 실제 입력 경로(onCell · netAction · __shop)로 끝까지 간다 — 경기 종료를 주입하지 않는다.
   '통제 종료'(dispatch gameOver)는 심화 자유 경기·저장 경계·401 처럼 경기 내용과 무관한 분기에서만 쓰고, 그 줄의 이름에 적는다(실제 완주가 아니다).
     A. 진입 분기(§2 · 3R.1) — 미해금만 질문(카테고리별 문구) · 해금·면제는 로비 · 카테고리 없음·형식 이상·순서 이상은 확인 불가 → 로비 · 좌석 우선 · 계정 없음
     B. 첫 질문 건너뛰기(3R.5) — POST v2 all/skip 1회 · ACK 뒤에만 로비 + 해금 알림 1회 · 유실·401·계정 전환·409 처리됨 ACK · 명시적 거절
     C. 기본(3R.3 B1~B9 · 3R.4) — 실제 탐색·강제 이동·보장 전투(기본 공격만)·회복 자세+차례 종료 회복·텔레포트 끝줄 승리 · 조기 종료 0 · 대상 하나 · 숨은 말 미노출
     D. 진행도·저장(BP · 3R.5) — ACK 와 이동 연출 둘 다 · 늦은 ACK·연타 중복 0 · 기본만으로 해금 0 · ⚙ 기본 건너뛰기 · 중단 = 저장 0 · 시드 원복
     E. 심화(A1~A11) — 실제 구매·속성·아이템·배치 3동작 · 플레이어 선공 · 실제 본 것(상점·버닝)만 기록 · 못 본 연습 0/1/2 · 남은 연습·⚙ 건너뛰기 · 결과 보존 · 해금 1회
     F. 싱글 화면(§5·§6·§7) — P01·P02 · 새 티어 승리만 저장 · 확인 불가 재조회 · 계정 없는 체험
     H. 401 원 화면 보존·좌석 우선·유한 마감·같은 계정 새 세대
     T. 정지 범위 — 튜토리얼 말풍선·모달 동안만 시계·AI 보류 · 일반 PVE·온라인 무관 · tutHint 0
     G. AI 티어(§8) — 데이터 표 값 · 고정 프로필은 난수 미소비 · 티어 없는 기존 경로 rand 순서 불변 */
"use strict";
const H=require("../shared/harness");
const fs=require("fs"), path=require("path");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const HTTPS="https://dd.example.com/";
const NEO={userId:"neo_1",nickname:"네오",hasEmail:true}, OLD={userId:"old_1",nickname:"고참",hasEmail:true};
const PG=(b,a,t)=>({tutorialDone:a!=="pending",aiClearedTier:t||0,tutorial:{basic:b,advanced:a}});
const NEW=PG("pending","pending"), MID=PG("completed","pending"), DONE=t=>PG("completed","completed",t), EXEMPT=t=>PG("exempt","exempt",t);
const PROF={nickname:"네오",representativeMinion:"M-F1",stats:{wins:0,losses:0},matches:[],pendingMatches:0};
const calls=[]; let routes={};
const fetchStub=async(url,init)=>{
  init=init||{}; calls.push({url:String(url),init});
  const h=routes[(init.method||"GET")+" "+url];
  if(!h) throw new TypeError("fetch failed");
  const r=await (typeof h==="function"?h(init):h);
  if(r==="hang") return new Promise(()=>{});
  return {status:r[0],json:async()=>r[1]};
};
const tick=async()=>{ for(let i=0;i<14;i++) await new Promise(r=>setImmediate(r)); };
async function boot(href,rt,storage){
  routes=Object.assign({"GET /api/profile":[200,PROF]},rt); calls.length=0;
  const T=H.load(htmlPath,{href,fetch:fetchStub,storage:storage||H.mkStorage(),winEvents:true});
  await tick(); return T;
}
const posts=p=>calls.filter(c=>c.init.method==="POST"&&(!p||c.url===p));
const gets=p=>calls.filter(c=>!c.init.method&&c.url===p);
const body=c=>JSON.parse(c.init.body);
const sess=(u,p)=>[200,Object.assign({},u,p===undefined?{}:{progress:p})];
const dlg=T=>T.byId("spGuide");
const dlgOpen=T=>!dlg(T).classList.contains("hidden")&&dlg(T).innerHTML!==""; // 헤드리스 요소는 HTML 의 초기 class 를 모른다 — 닫힘 = 비운 innerHTML 도 본다
const coach=T=>T.byId("spCoach").innerHTML;
const txt=h=>String(h).replace(/<[^>]+>/g," ").replace(/\s+/g," ");
const side=T=>T.byId("sidePanel").innerHTML;
const assetsLoad=T=>{ for(const a of T.LOBBY.assets||[]) if(a.state==="loading") a.img.onload(); };
const later=()=>{ let release; const p=new Promise(r=>{ release=r; }); return {p,release}; };
const TUT_API="/api/profile/tutorial", CLR_API="/api/profile/ai-clear", SESS="/api/auth/session";
const end=(T,winner,winType)=>{ T.dispatchCoreAction({t:"gameOver",winner,winType}); T.render(); }; // 통제 종료 — 실제 완주가 아니다(이름에 적는다)
const toast=T=>T.LOBBY.toast?T.LOBBY.toast.t:"";
/* 서버 스텁 — v2 의미(3R.6)를 그대로 흉내 낸다: all = 대기 전부 건너뜀 · 같은 결과 반복 200 · 다른 결과 409 + 현재 상태 · 심화는 기본 처리 뒤에만 */
function tutServer(start){
  const st={basic:start.tutorial.basic,advanced:start.tutorial.advanced}, cur=()=>PG(st.basic,st.advanced,start.aiClearedTier);
  const want=b=>b.end==="skip"?"skipped":"completed";
  return {st,cur,post:init=>{ const b=JSON.parse(init.body);
    if(b.v!==2) return [400,{error:"E_CLIENT_OUTDATED"}];
    if(b.category==="all"){ for(const k of ["basic","advanced"]) if(st[k]==="pending") st[k]="skipped"; return [200,{progress:cur()}]; }
    if(b.category==="advanced"&&st.basic==="pending") return [409,{error:"E_BASIC_REQUIRED",progress:cur()}];
    if(st[b.category]!=="pending"&&st[b.category]!==want(b)) return [409,{error:"E_TUTORIAL_CONFLICT",progress:cur()}];
    st[b.category]=want(b); return [200,{progress:cur()}]; }};
}
async function tutAsk(rt,prog){ const T=await boot(HTTPS,Object.assign({"GET /api/auth/session":sess(NEO,prog||NEW)},rt)); T.uiStart(); return T; }
/* 기본 보드를 실제 입력으로 한 단계씩 — 차례 넘김(자동 종료 · 상대 대본)은 타이머를 돌려 기다린다 */
const pump=(T,until,n)=>{ for(let i=0;i<(n||40)&&!until();i++){ T.drain(400); T.render(); } return until(); };
const pc=(T,id)=>T.S.pieces.find(x=>x.id===id);
/* 주변 가림막(Dim) 기하 — 헤드리스 요소에는 크기가 없다: 실제 보드 칸(13×7)에 40px 격자 사각형(dy = 스크롤 이동)과 창 크기를 주고 제품의 window 리스너로 다시 그린다 */
const geo=(T,W,H,dy,extra,ev)=>{ global.innerWidth=W; global.innerHeight=H;
  for(const c of T.byId("board").children){ const x=+c.dataset.c*40, y=+c.dataset.r*40+(dy||0); c.getBoundingClientRect=()=>({left:x,top:y,width:40,height:40,right:x+40,bottom:y+40}); }
  T.byId("board").getBoundingClientRect=()=>({left:40,top:40+(dy||0),width:280,height:520,right:320,bottom:560+(dy||0)});
  for(const [el,r] of extra||[]) el.getBoundingClientRect=()=>r;
  T.winDispatch(ev||"resize"); };
const ungeo=T=>{ delete global.innerWidth; delete global.innerHeight; delete T.byId("board").getBoundingClientRect; for(const c of T.byId("board").children) delete c.getBoundingClientRect; };
const dimOn=T=>/<svg class="spDim" width="(\d+)" height="(\d+)"/.exec(T.byId("spSpot").innerHTML);
const holes=T=>[...T.byId("spSpot").innerHTML.matchAll(/<rect x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)" rx/g)].map(m=>m.slice(1,5).join(","));
const cellHole=(r,c,dy)=>[c*40-8,r*40+(dy||0)-8,56,56].join(","); // ART: 실제 경계 + 8 CSS px
function basicTo(T,step){
  const X=T.single, Tt=X.SP.tut, I=Tt.ids, order=["B1","B2","B3","B4","B5","B6","B7","B8","B9"];
  T.BAL.fx.autoEnd=true; // 기본 보드는 현행 자동 턴 종료 그대로(하네스 기본은 꺼 둔다)
  const go=()=>{ const s=Tt.step;
    if(s==="B1"||s==="B3"||s==="B4") X.spNext();
    else if(s==="B2"){ const K=pc(T,I.K); T.onCell(K.r,K.c); T.ui238.infoSlotOpen(I.K,null); T.render(); X.spNext(); }
    else if(s==="B5"){ const M=pc(T,I.M); T.onCell(M.r,M.c); T.netAction({t:"search"}); pump(T,()=>Tt.step!=="B5"); }
    else if(s==="B6"){ const M=pc(T,I.M); T.onCell(M.r,M.c); T.onCell(I.dest[0],I.dest[1]); T.drain(50); } // 전투 창은 render() 없이 열린다 — 손으로 다시 그리지 않는다
    else if(s==="B7"){ for(let i=0;i<80&&T.S.battle;i++){ const B=T.S.battle, sd=T.actorOfPhase(), own=(sd==="A"?B.attP:B.defP).owner;
        if(own===0){ global.__menu("fight"); global.__act(0); } T.drain(400); T.render(); } pump(T,()=>Tt.step!=="B7"); }
    else if(s==="B8"){ const M=pc(T,I.M); T.onCell(M.r,M.c); T.netAction({t:"heal",id:I.M}); T.render(); pump(T,()=>Tt.f.gain!=null); X.spNext(); pump(T,()=>T.S.current===0&&T.S.turnCount>=Tt.t0+6); }
  };
  for(let n=0;n<12&&Tt.step!==step&&order.indexOf(Tt.step)>=0;n++) go();
  return Tt.step===step;
}

(async()=>{
/* ===== A. 진입 분기 ===== */
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,NEW)});
  ok(T.AUTH.state==="in"&&T.uiScreenName()==="title"&&!T.single.SP.ask,"A1 세션 복원 직후에는 타이틀 그대로(분기는 [시작] 뒤)");
  T.uiStart();
  ok(T.S.mode==="pve"&&T.S.phase==="play"&&T.single.SP.tut&&T.single.SP.tut.cat==="basic"&&T.uiScreenName()!=="lobby","A2 기본 대기 → [시작] 이 로비 대신 기본 연습 보드(실제 엔진 경기)");
  const d=dlg(T).innerHTML;
  ok(T.single.SP.ask&&dlgOpen(T)&&/튜토리얼로 배워 볼까요\?/.test(d)&&/기본 규칙을 익히고 AI와 첫 경기를 해요\. 공식 전적에는 들어가지 않아요\./.test(d)&&/>진행</.test(d)&&/>건너뛰기</.test(d),"A3 질문 1회 — 3R.3 Q 기본 문구 · [진행][건너뛰기]");
  T.document.dispatch("keydown",{key:"Escape",preventDefault(){},stopImmediatePropagation(){}});
  ok(T.single.SP.ask&&dlgOpen(T),"A3b Esc 로 사라지지 않는다");
  ok(T.byId("app").getAttribute("inert")===""&&T.byId("overlay").getAttribute("inert")==="","A4 질문 동안 게임 화면·게임 모달은 inert");
  ok(!coach(T),"A4c 질문 동안 마녀 말풍선 없음(질문 하나만)");
  const tag=fs.readFileSync(htmlPath,"utf8"), g=tag.match(/<div id="spGuide"[^>]*>/)[0], c=tag.match(/<div id="spCoach"[^>]*>/)[0];
  ok(/role="dialog"/.test(g)&&/aria-modal="true"/.test(g)&&/role="region"/.test(c)&&!/aria-modal/.test(c)&&/<div id="spSpot"[^>]*aria-hidden="true"/.test(tag),"A4b 질문·패널 = 모달 대화상자 · 말풍선 = 비모달 영역 · 스포트라이트 = 읽지 않는 층");
  ok(posts().length===0,"A5 입장만으로는 저장 요청 0");
}
{
  const T=await tutAsk({},MID);
  const d=dlg(T).innerHTML;
  ok(T.single.SP.tut.cat==="advanced"&&T.S.phase==="setup"&&/심화 튜토리얼을 이어서 할까요\?/.test(d)&&/상점과 배치를 배우고 AI와 첫 경기를 해요\./.test(d),"A5b 기본 처리 · 심화 대기 → 심화 질문 문구 · 시작 상점(실제 경기 준비)");
}
for(const [nm,p] of [["심화 완료",DONE(0)],["이관 면제",EXEMPT(1)],["모두 건너뜀",PG("skipped","skipped")]]){
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(OLD,p)});
  T.uiStart(); assetsLoad(T); await tick();
  ok(T.uiScreenName()==="lobby"&&!T.single.SP.ask&&!T.single.SP.tut&&!/튜토리얼|학습 완료/.test(txt(side(T)))&&T.byId("spLive").textContent==="","A6 "+nm+" — [시작] 은 로비 · 해금 알림·학습 완료 표시 없음");
}
for(const [nm,p] of [["필드 없음",undefined],["카테고리 없음(옛 서버)",{tutorialDone:false,aiClearedTier:0}],["카테고리 값 이상",{tutorialDone:false,aiClearedTier:0,tutorial:{basic:"done",advanced:"pending"}}],
  ["해금 파생 불일치",{tutorialDone:true,aiClearedTier:0,tutorial:{basic:"completed",advanced:"pending"}}],["순서 이상(심화만 처리)",{tutorialDone:true,aiClearedTier:0,tutorial:{basic:"pending",advanced:"skipped"}}],
  ["범위 밖 티어",{tutorialDone:false,aiClearedTier:4,tutorial:{basic:"pending",advanced:"pending"}}],["null",null],
  ["미해금인데 클리어 있음",{tutorialDone:false,aiClearedTier:3,tutorial:{basic:"pending",advanced:"pending"}}],["기본만 면제",{tutorialDone:false,aiClearedTier:0,tutorial:{basic:"exempt",advanced:"pending"}}],["기본 면제·심화 완료",{tutorialDone:true,aiClearedTier:0,tutorial:{basic:"exempt",advanced:"completed"}}]]){
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,p)});
  T.uiStart();
  ok(T.uiScreenName()==="lobby"&&T.single.SP.progress===null&&!T.single.SP.ask,`A7 progress ${nm} = 확인 불가 → 로비(대기로도 해금으로도 보지 않음)`);
}
for(const [nm,p] of [["완료/면제(옛 서버 롤백 뒤)",PG("completed","exempt")],["건너뜀/면제(옛 서버 롤백 뒤)",PG("skipped","exempt",1)]]){
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,p)});
  T.uiStart();
  ok(T.uiScreenName()==="lobby"&&T.single.SP.progress&&T.single.SP.progress.tutorialDone&&T.single.SP.progress.tutorial.advanced==="exempt"&&!T.single.SP.ask,`A7b ${nm} = 유효(007·accounts 가 실제로 내는 값) → 해금 로비`);
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]});
  T.uiStart(); ok(T.AUTH.state==="down"&&T.S.phase==="menu"&&!T.single.SP.ask,"A8 계정 서버 장애 — 튜토리얼로 보내지 않는다(입장 차단 그대로)");
}
{
  const st=H.mkStorage({"dd_seat.neo_1":JSON.stringify({u:"neo_1",epoch:"0123abcd",roomId:7,seat:0,seatToken:"A".repeat(22),tokenGen:0})});
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,NEW)},st);
  T.uiStart(); ok(T.NET.roomId===7&&T.S.mode!=="pve"&&!T.single.SP.ask,"A9 진행 중 좌석 재접속이 우선 — 튜토리얼로 끌고 가지 않는다");
}
{
  const T=await boot("file:///C:/Digit-Duel/demo/index.html",{});
  T.uiStart(); ok(T.AUTH.state==="off"&&T.uiScreenName()==="lobby"&&!T.single.SP.ask,"A10 file:// — 튜토리얼 강요 없이 로비");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":[401,{error:"E_NO_SESSION"}],"POST /api/auth/signup":[201,Object.assign({},NEO,{progress:NEW})]});
  T.acct.acctView("signup"); T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; T.byId("acctPw2").value="pw123456"; T.byId("acctNick").value="네오"; T.byId("acctEmail").value="neo@example.com";
  await T.acct.acctSubmit(); await tick();
  ok(T.AUTH.state==="in"&&T.single.SP.progress.tutorial.basic==="pending"&&T.S.mode==="pve"&&T.single.SP.ask&&dlgOpen(T),"A11 새 가입 성공(대기) → 추가 [시작] 없이 튜토리얼 질문");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":[401,{error:"E_NO_SESSION"}],"POST /api/auth/login":[200,Object.assign({},OLD,{progress:EXEMPT(1)})]});
  T.byId("acctId").value="old_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.uiScreenName()==="lobby"&&!T.single.SP.ask&&T.S.mode!=="pve","A12 새 로그인 성공(이관 면제) → 추가 [시작] 없이 로비 로딩");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":[401,{error:"E_NO_SESSION"}],"POST /api/auth/login":[200,Object.assign({},NEO,{})]});
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.uiScreenName()==="lobby"&&!T.single.SP.ask&&T.single.SP.progress===null,"A13 새 로그인 · progress 확인 불가 → 로비(튜토리얼 강제 없음)");
}
{
  const st=H.mkStorage({"dd_seat.neo_1":JSON.stringify({u:"neo_1",epoch:"0123abcd",roomId:7,seat:0,seatToken:"A".repeat(22),tokenGen:0})});
  const T=await boot(HTTPS,{"GET /api/auth/session":[401,{error:"E_NO_SESSION"}],"POST /api/auth/login":[200,Object.assign({},NEO,{progress:NEW})]},st);
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.NET.roomId===7&&T.S.mode!=="pve"&&!T.single.SP.ask,"A14 새 로그인 · 남은 좌석 기록 → 재접속이 우선(튜토리얼 자동 진입 없음)");
}

/* ===== B. 첫 질문 [건너뛰기] — 대기 카테고리 전부 건너뜀(1요청) ===== */
{
  const L=later(), srv=tutServer(NEW);
  const T=await tutAsk({"POST /api/profile/tutorial":init=>L.p.then(()=>srv.post(init))});
  T.single.spAskSkip(); await tick();
  const p=posts(TUT_API), d=dlg(T).innerHTML;
  ok(p.length===1&&JSON.stringify(body(p[0]))===JSON.stringify({v:2,userId:"neo_1",category:"all",end:"skip"})&&p[0].init.headers["Content-Type"]==="application/json","B1 [건너뛰기] = POST {v:2,userId,category:all,end:skip} JSON 1회");
  ok(/저장 중…/.test(d)&&(d.match(/ disabled>/g)||[]).length===2&&T.uiScreenName()!=="lobby","B2 저장 중 — 두 버튼 비활성 · 로비 아님(ACK 전)");
  T.single.spAskSkip(); T.single.spAskGo(); await tick(); ok(posts(TUT_API).length===1,"B2b 저장 중 연타 — 중복 요청 0");
  L.release(); await tick();
  ok(T.uiScreenName()==="lobby"&&!dlgOpen(T)&&!T.single.SP.ask&&T.single.SP.progress.tutorialDone&&T.single.SP.progress.tutorial.basic==="skipped","B3 ACK 뒤 바로 로비 · 두 카테고리 건너뜀");
  assetsLoad(T); await tick();
  ok(T.byId("spLive").textContent==="🔓 무제한 AI 대전이 열렸어요. 브론즈부터 도전해 보세요.","B4 해금 알림 — 확정 문구 · 상태 공지(로비 로딩 뒤)");
  T.byId("spLive").textContent=""; T.toLobby(); assetsLoad(T); await tick();
  ok(T.byId("spLive").textContent==="","B5 해금 알림은 1회");
  ok(/class="l01Single" id="l01Single" onclick="spOpen\(\)"/.test(side(T))&&!/data-lock="single"/.test(side(T)),"B6 같은 세션 로비에서 싱글플레이 즉시 활성");
  ok(T.single.rng()===null&&!T.single.SP.rng,"B6b 로비로 나오면 튜토리얼 시드가 원래 RNG(Math.random)로 돌아왔다");
}
{ // 503 → 조회 1회: 커밋됨 → 성공(재전송 없음)
  let n=0;
  const T=await tutAsk({"GET /api/auth/session":()=>sess(NEO,n++>0?PG("skipped","skipped"):NEW),"POST /api/profile/tutorial":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]});
  T.single.spAskSkip(); await tick();
  ok(posts(TUT_API).length===1&&T.uiScreenName()==="lobby"&&T.single.SP.progress.tutorialDone,"B7 503(불명) → 조회가 처리됨을 보이면 재전송 없이 성공");
}
{ // 연결 실패 → 조회 대기 → '저장하지 못했어요.' → [건너뛰기]=다시 시도 → 같은 본문 → 성공
  let fails=1; const srv=tutServer(NEW);
  const T=await tutAsk({"POST /api/profile/tutorial":init=>fails-->0?Promise.reject(new TypeError("x")):srv.post(init)});
  T.single.spAskSkip(); await tick();
  ok(T.single.SP.ask&&T.single.SP.save.st==="fail"&&/저장하지 못했어요\./.test(dlg(T).innerHTML)&&/role="alert"/.test(dlg(T).innerHTML)&&!/ disabled>/.test(dlg(T).innerHTML),"B8 유실 → 조회 1회(대기) → 같은 질문 화면에 실패 · [진행]도 그대로");
  ok(posts(TUT_API).length===1&&gets(SESS).length===2&&T.uiScreenName()!=="lobby","B8b 자동 반복 재시도 없음 · 해금 0");
  T.single.spAskSkip(); await tick();
  const p=posts(TUT_API);
  ok(p.length===2&&p[0].init.body===p[1].init.body&&T.uiScreenName()==="lobby","B9 다시 누르면 같은 요청(멱등) → ACK 뒤 로비");
}
{ // 조회도 실패 → '저장 여부를 확인하지 못했어요.' → 다시 시도 = 조회 먼저(커밋돼 있으면 POST 없음)
  let sessOk=true;
  const T=await tutAsk({"GET /api/auth/session":()=>sessOk?sess(NEO,NEW):Promise.reject(new TypeError("x")),"POST /api/profile/tutorial":()=>{ sessOk=false; return Promise.reject(new TypeError("x")); }});
  T.single.spAskSkip(); await tick();
  ok(T.single.SP.save.st==="fail"&&T.single.SP.save.unknown&&/저장 여부를 확인하지 못했어요\./.test(dlg(T).innerHTML),"B10 조회도 실패 → '저장 여부를 확인하지 못했어요.'");
  routes["GET /api/auth/session"]=sess(NEO,PG("skipped","skipped")); T.single.spAskSkip(); await tick();
  ok(posts(TUT_API).length===1&&T.uiScreenName()==="lobby","B11 [다시 시도] = 조회 먼저 — 커밋돼 있으면 POST 없이 성공");
}
{ // 401 → 로그인 화면(경기·질문 문맥 보존) · 같은 계정 재로그인 → 원 질문 화면 · 상태 조회만(자동 POST 0) → [건너뛰기]=다시 시도 → ACK → 로비
  let st="in"; const srv=tutServer(NEW);
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,srv.cur()),
    "POST /api/profile/tutorial":init=>{ if(st==="in"){ st="gone"; return [401,{error:"E_NO_SESSION"}]; } return srv.post(init); },"POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:srv.cur()})]; }});
  const game=T.S;
  T.single.spAskSkip(); await tick();
  ok(T.AUTH.state==="anon"&&T.uiScreenName()==="title"&&T.S===game&&!dlgOpen(T)&&T.single.SP.pending&&T.single.SP.pending.uid==="neo_1","B12 401 → 로그인 화면 · 질문 창 닫힘 · 경기·저장 문맥은 원래 계정에 묶여 보존");
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(posts(TUT_API).length===1&&T.S===game&&T.single.SP.ask&&dlgOpen(T)&&/저장하지 못했어요/.test(dlg(T).innerHTML)&&!/ disabled>/.test(dlg(T).innerHTML),"B13 같은 계정 재로그인 → 원 질문 화면 · 상태 조회만(자동 재전송 0) · 대기면 [다시 시도] 대기");
  T.single.spAskSkip(); await tick();
  const p=posts(TUT_API);
  ok(p.length===2&&body(p[1]).userId==="neo_1"&&body(p[1]).category==="all"&&T.uiScreenName()==="lobby","B13b 사용자가 다시 누를 때만 같은 저장 → ACK 뒤 로비");
}
{ // 401 → 다른 계정 로그인 → 옛 저장 재전송 없음
  let gone=false;
  const T=await tutAsk({"GET /api/auth/session":()=>gone?[401,{error:"E_NO_SESSION"}]:sess(NEO,NEW),"POST /api/profile/tutorial":()=>{ gone=true; return [401,{error:"E_NO_SESSION"}]; },"POST /api/auth/login":[200,Object.assign({},OLD,{progress:EXEMPT(2)})]});
  T.single.spAskSkip(); await tick();
  T.byId("acctId").value="old_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(posts(TUT_API).length===1&&T.single.SP.pending===null&&T.single.SP.uid==="old_1"&&T.single.SP.progress.aiClearedTier===2&&T.uiScreenName()==="lobby"&&!T.single.SP.ask,"B14 다른 계정 재로그인 — 옛 계정 저장을 넘기지 않고 그 계정 상태(면제)로 로비");
}
{ // 늦은 응답 — 다른 탭 계정 전환 뒤 도착한 200
  const L=later();
  const T=await tutAsk({"POST /api/profile/tutorial":()=>L.p.then(()=>[200,{progress:PG("skipped","skipped")}])});
  T.single.spAskSkip(); await tick();
  routes["GET /api/auth/session"]=sess(OLD,NEW);
  T.acct.acctOnStorage({key:"dd_acct",newValue:JSON.stringify({u:"old_1",t:1})}); await tick();
  L.release(); await tick();
  ok(T.AUTH.user.userId==="old_1"&&T.single.SP.uid==="old_1"&&T.single.SP.progress.tutorialDone===false&&!T.single.SP.note,"B15 계정 전환 뒤 늦은 저장 응답은 새 계정에 반영·알림되지 않는다");
}
for(const [code,err] of [[409,"E_ACCOUNT_MISMATCH"],[400,"E_BAD_INPUT"],[400,"E_CLIENT_OUTDATED"]]){
  const T=await tutAsk({"POST /api/profile/tutorial":[code,{error:err}]});
  T.single.spAskSkip(); await tick();
  ok(posts(TUT_API).length===1&&T.single.SP.save.st==="fail"&&!T.single.SP.save.unknown&&/저장하지 못했어요\./.test(dlg(T).innerHTML)&&!T.single.SP.progress.tutorialDone,`B16 ${code} ${err} — 명시적 실패(자동 재시도·해금 0)`);
}
{ // 409 + 현재 상태가 처리됨 = 먼저 저장된 값이 ACK(3R.1) · 409 인데 상태가 대기면 실패
  const T=await tutAsk({"POST /api/profile/tutorial":[409,{error:"E_TUTORIAL_CONFLICT",progress:PG("completed","skipped")}]});
  T.single.spAskSkip(); await tick();
  ok(posts(TUT_API).length===1&&T.uiScreenName()==="lobby"&&T.single.SP.progress.tutorial.basic==="completed","B17 409 E_TUTORIAL_CONFLICT + 처리된 progress → ACK(재시도 반복 없음) · 서버 값 그대로");
  const U=await tutAsk({"POST /api/profile/tutorial":[409,{error:"E_TUTORIAL_CONFLICT",progress:NEW}]});
  U.single.spAskSkip(); await tick();
  ok(U.single.SP.save.st==="fail"&&U.single.SP.ask&&!U.single.SP.progress.tutorialDone,"B17b 409 + 여전히 대기 → 실패 · 해금 0");
  const V=await tutAsk({"POST /api/profile/tutorial":[409,{error:"E_TUTORIAL_CONFLICT"}]});
  V.single.spAskSkip(); await tick();
  ok(V.single.SP.save.st==="fail"&&!V.single.SP.save.unknown,"B17c 409 인데 progress 없음 → 실패(지어낸 ACK 없음)");
}

/* ===== C. 기본 B1~B9 — 실제 엔진 고정 보드 ===== */
{
  const srv=tutServer(NEW);
  const T=await tutAsk({"POST /api/profile/tutorial":init=>srv.post(init)});
  T.BAL.fx.autoEnd=true; // 기본도 현행 자동 턴 종료 그대로(하네스 기본은 꺼 둔다)
  const X=T.single, Tt=X.SP.tut, I=Tt.ids, D=X.SP_BASIC;
  /* 고정 보드 합법성(3R.4) */
  const foe0=JSON.stringify(T.S.pieces.filter(x=>x.owner===1).map(x=>[x.id,x.r,x.c]));
  const per=o=>{ const c={}; for(const x of T.S.pieces.filter(y=>y.owner===o)) c[x.type]=(c[x.type]||0)+1; return JSON.stringify(c); };
  const cells=new Set(T.S.pieces.filter(x=>x.placed&&x.alive).map(x=>x.r+"_"+x.c));
  ok(per(0)===per(1)&&per(0)===JSON.stringify({minion:6,bomb:3,ally:2,trap:2,king:1})&&cells.size===28&&T.S.pieces.every(x=>x.placed&&x.alive&&T.boardCellOk(x.r,x.c)),"C0 고정 보드 — 진영마다 하수인 6·폭탄 3·동료 2·함정 2·왕 1 · 겹침·보드 밖 0");
  ok(T.byId("board").children.length===91&&Math.max(...T.S.pieces.map(x=>x.r))===13&&T.S.mode==="pve"&&!T.S.eco&&T.S.turnCount===12&&T.S.current===0&&T.S.phase==="play","C0b 실제 13행×7열 · PVE 엔진 · 턴 13(표시) 내 차례");
  ok(T.S.pieces.filter(x=>x.owner===0&&x.type==="trap").every(x=>T.zoneOf(0).includes(x.r)),"C0c 함정은 자기 진영(이동 불가 말)");
  ok(T.isBurning()===false&&T.S.turnCount+7<20,"C0d B9 까지 +7 턴 — 정기 상점(20)·버닝(65)에 닿지 않는다");
  X.spAskGo();
  ok(Tt.step==="B1"&&/기본 1\/9/.test(coach(T))&&coach(T).includes(X.SP_SAY.B1)&&/>다음</.test(coach(T)),"C1 B1 — '기본 1/9' · 3R.3 문구 · [다음]");
  const zone=X.spSpec(Tt).zone; ok(zone&&zone[0][0]===11&&zone[0][1]===13,"C1b B1 강조 = 내 진영 11~13행(전체 13×7 보드 위)");
  ok(X.spClockHeld()&&!X.spHeld(),"C1c 기본 말풍선 동안 시계 정지(보드 시계 없음) · 상대 보류는 아님");
  X.spNext(); ok(Tt.step==="B2"&&coach(T).includes(X.SP_SAY.B2),"C2 B2 문구");
  const K=pc(T,I.K), g2=X.spGateSet();
  ok(g2&&g2.out.length===1&&g2.out[0]===T.byId("board").querySelector(`.cell[data-r="${K.r}"][data-c="${K.c}"]`),"C2b B2 대상 하나 = 내 왕 칸");
  { const mk=X.spTagPieces(Tt);
    ok(mk.length===5&&JSON.stringify(mk.map(x=>x.type))===JSON.stringify(["minion","king","ally","bomb","trap"])&&mk.every(x=>x.owner===0&&x.alive&&x.r>=11)&&mk[1].id===I.K,"C2j 이름표·번호 5개는 모두 내 진영(11~13행)의 실제 내 말 — 왕 = 대상(제품 선택 그대로)"); }
  ok(/<ul class="srOnly">/.test(coach(T))&&["하수인 — 싸우는 말","왕 — 잃으면 패배","동료 — 왕을 돕는 싸움꾼","폭탄 — 닿은 하수인과 함께 사라짐","함정 — 밟은 말은 2차례 못 움직임"].every(t=>coach(T).includes(t)),"C2i 떠 있는 이름표(읽지 않는 층)의 5개 역할 문구는 말풍선 안 화면 밖 목록으로 읽힌다");
  ok(JSON.stringify(Object.values(X.SP_TAGS))===JSON.stringify(["싸우는 말","잃으면 패배","왕을 돕는 싸움꾼","닿은 하수인과 함께 사라짐","밟은 말은 2차례 못 움직임"])&&X.spSpec(Tt).tags,"C2c B2 내 말 5종 짧은 이름표(따로 띄우는 창 없음)");
  X.spNext(); ok(Tt.step==="B2","C2d 왕 정보 창을 열기 전 [다음] 은 진행하지 않는다");
  { const blocked={closest:()=>null,parentNode:null}; let stop=0; X.spGateEv({type:"click",target:blocked,preventDefault(){},stopImmediatePropagation(){ stop++; },stopPropagation(){}});
    const cell=g2.out[0]; cell.closest=()=>null; let stop2=0; X.spGateEv({type:"click",target:cell,preventDefault(){},stopImmediatePropagation(){ stop2++; },stopPropagation(){}});
    const gear={closest:s=>/\.flowGear/.test(s)?{}:null}; let stop3=0; X.spGateEv({type:"click",target:gear,preventDefault(){},stopImmediatePropagation(){ stop3++; },stopPropagation(){}});
    ok(stop===1&&stop2===0&&stop3===0,"C2e 대상 밖 누름은 막고 · 대상과 ⚙ 는 통과(앱 전체 inert 아님)"); }
  T.onCell(K.r,K.c); ok(T.S.selected&&T.S.selected.id===I.K,"C2f 실제 셀 입력으로 왕 선택");
  X.spHit(Tt); T.ui238.infoSlotOpen(I.K,null); T.ui238.synHelpClose(true); T.drain(5); // 실제 브라우저처럼 — [말 정보] 누름(대상 통과) → 설명 창 열고 닫기, 다시 그리기 없음
  ok(Tt.f.info&&/>다음</.test(coach(T)),"C2g 왕 정보 창(실제 [말 정보] 누름) → 다시 그리기 없이도 [다음](브라우저 run1 첫 실패 재현 방지)");
  Tt.f.legend=true; T.render(); // 좁은 화면에서 떠 있는 이름표가 겹치면 쓰는 범례(같은 문구 · 칸 안 번호와 짝)
  ok(["하수인 — 싸우는 말","왕 — 잃으면 패배","동료 — 왕을 돕는 싸움꾼","폭탄 — 닿은 하수인과 함께 사라짐","함정 — 밟은 말은 2차례 못 움직임"].every((t,i)=>coach(T).includes(`${i+1}</b>${t}`)),"C2h 범례 모드 — 5개 역할 문구 그대로 · 번호 1~5 순서");
  Tt.f.legend=false; T.render();
  X.spNext(); ok(Tt.step==="B3"&&coach(T).includes(X.SP_SAY.B3),"C3 B3 문구");
  const F=pc(T,I.F), hid=T.S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.r===9&&x.c===7), ring=X.spSpec(Tt).ring.cell;
  ok(T.visibleTo(0,F)&&T.inForest(F)&&!F.revealed&&ring[0]===F.r&&ring[1]===F.c,"C3b 강조 = 숲 안 '보이는 ?'(존재만 · 정체 미공개)");
  ok(hid&&T.inForest(hid)&&!T.visibleTo(0,hid)&&T.byId("board").querySelector(`.cell[data-r="${hid.r}"][data-c="${hid.c}"]`).children.length===0&&!(ring[0]===hid.r&&ring[1]===hid.c),"C3c 떨어진 숲의 상대 말은 칸에 그려지지 않고(존재도 비공개) 강조도 가리키지 않는다");
  X.spNext(); ok(Tt.step==="B4"&&X.spSpec(Tt).pics==="win"&&/상대 왕 잡기/.test(coach(T))&&/내 왕이 상대 끝줄/.test(coach(T))&&/상대 하수인\+동료 전멸/.test(coach(T))&&/폭탄·함정·왕은 세지 않음/.test(coach(T)),"C4 B4 승리 도해 3장(보드 조작 없음)");
  X.spNext(); ok(Tt.step==="B5"&&coach(T).includes(X.SP_SAY.B5),"C5 B5 문구");
  const M=pc(T,I.M), ev=T.S.events[I.ev];
  ok(ev.r===M.r&&ev.c===M.c&&!ev.consumed&&T.S.traces[0].has(ev.r+"_"+ev.c),"C5b 내 하수인이 '발견된' 흔적 칸 위");
  T.onCell(M.r,M.c); const g5=X.spGateSet(); ok(g5&&g5.out.length===1&&g5.out[0].textContent==="탐색","C5c 말 선택 뒤 대상 = 실제 [탐색] 버튼 하나");
  T.netAction({t:"search"}); T.render();
  ok(T.S.events[I.ev].consumed&&T.S.pkgs[0].itemGift===1&&T.S.metrics.byPlayer[0].searches===1,"C5d 실제 탐색 — 흔적 소모 · 선물(아이템 선물 패키지) · 탐색 1회(주 행동)");
  pump(T,()=>Tt.step==="B6");
  ok(Tt.step==="B6"&&T.S.current===0&&T.S.turnCount===14&&T.S.phase==="play","C5e 현행 자동 차례 종료 → 상대 대본(행동 없이 종료) → 내 차례 ②");
  ok(JSON.stringify(T.S.pieces.filter(x=>x.owner===1).map(x=>[x.id,x.r,x.c]))===foe0&&T.S.metrics.byPlayer[1].searches===0&&T.S.metrics.byPlayer[1].battles===0,"C5f 상대는 탐색·전투·이동 0(행동 없이 차례 종료 대본)");
  const M6=pc(T,I.M); T.onCell(M6.r,M6.c);
  const g6=X.spGateSet(); ok(g6.out[0]===T.byId("board").querySelector(`.cell[data-r="8"][data-c="2"]`)&&T.canMoveTo(pc(T,I.M),8,2),"C6 B6 대상 = 표시된 칸 하나(합법 1칸 이동)");
  T.onCell(8,2); T.drain(20); // 다시 그리기 없이 — 실제 브라우저처럼 전투 창만 그려진다(브라우저 run2 첫 실패 재현 방지)
  const B=T.S.battle;
  ok(Tt.step==="B7"&&!!B&&B.attP.id===I.M&&B.defP.id===I.E&&T.S.metrics.forcedBattles===1,"C6b 새로 붙어 강제 전투 시작(실제 이동 경로) → 다시 그리기 없이 B7");
  ok(B.fa.element==="water"&&B.fd.element==="fire"&&T.BEATS.water==="fire","C7 상성 유리 짝(물 → 불 · 기존 데이터 그대로)");
  ok(coach(T).includes(X.SP_SAY.B7)&&X.SP_SAY.B7.startsWith(X.spCycleText()),"C7b B7 문구 · 순환 = 현행 BEATS");
  { const B0=T.S.battle, m0=B0.menu; B0.menu=null; const a=X.spSpec(Tt).tg.sel; B0.menu="fight"; const b=X.spSpec(Tt).tg.sel; B0.menu=m0;
    ok(a===`button[onclick="window.__menu('fight')"]`&&b===`button[onclick="window.__act(0)"]`,"C7c B7 대상 = [싸우기] → 강조된 기본 공격(1번 칸) 하나 — 가방·포획·도망은 대상 밖(막힘)"); }
  let hpBefore=pc(T,I.M).hp; basicTo(T,"B8");
  const E=pc(T,I.E), M8=pc(T,I.M);
  ok(!E.alive&&M8.alive&&!T.S.battle&&T.S.phase==="play","C7d 실제 전투 엔진 — E 제거(보장 경로 · 보정 없음)");
  ok(M8.hp<M8.maxHp,"C7e M 이 실제로 다쳤다(B8 회복 대상)");
  ok(T.S.pieces.filter(x=>x.owner===1&&(x.type==="minion"||x.type==="ally")&&x.alive).length>=2&&T.S.winner===null,"C7f B7 뒤 상대 하수인+동료 2 이상 · 조기 승리 0");
  ok(Tt.step==="B8"&&T.S.current===0&&T.S.turnCount===16,"C8 상대 차례(대본) 뒤 내 차례 ③ = B8");
  T.onCell(M8.r,M8.c); const g8=X.spGateSet(); ok(g8.out[0].textContent==="🌿 회복","C8b 대상 = [회복]");
  const hp0=M8.hp; T.netAction({t:"heal",id:I.M}); T.render();
  ok(pc(T,I.M).healing&&pc(T,I.M).hp===hp0&&Tt.hold&&X.spHeld(),"C8c 회복 = 자세 지정(즉시 회복 없음) · 상대 차례 보류 시작");
  pump(T,()=>Tt.f.gain!=null);
  const gain=Tt.f.gain;
  ok(gain===Math.round(pc(T,I.M).maxHp*0.05)||gain===pc(T,I.M).hp-hp0,"C8d 내 차례 종료 처리에서 HP 증가(최대 HP 5%)");
  ok(T.S.current===1&&T.UI.holdQ.length>=1&&T.S.metrics.byPlayer[1].autoEnds===0&&new RegExp(`HP \\+${gain}`).test(coach(T)),"C8e HP 증가를 보이는 동안 상대 차례 보류 · [다음] 대기");
  X.spNext(); pump(T,()=>T.S.current===0&&T.S.turnCount>=Tt.t0+6);
  ok(Tt.step==="B9"&&T.S.current===0&&T.S.turnCount===18&&!Tt.hold,"C9 [다음] → 상대 차례(대본) → 내 차례 ④ = B9");
  ok(coach(T).includes(X.SP_SAY.B9)&&X.spGateSet().out[0].textContent==="🌀 텔레포트","C9b B9 문구 · 대상 = [텔레포트]");
  const Tp=pc(T,I.T), K9=pc(T,I.K);
  ok(Tp.r===1&&T.teleportSwapBlock(Tp,K9)===null&&T.S.winner===null&&posts(TUT_API).length===0,"C9c 상대 끝줄의 내 말 · 사전 차단 없음 · 그 전 승리·저장 0");
  T.netAction({t:"tele"}); T.render(); ok(X.spGateSet().out[0]===T.byId("board").querySelector(`.cell[data-r="1"][data-c="7"]`),"C9d 다음 대상 = 상대 끝줄의 내 말");
  T.onCell(Tp.r,Tp.c); T.render(); ok(X.spGateSet().out[0]===T.byId("board").querySelector(`.cell[data-r="${K9.r}"][data-c="${K9.c}"]`),"C9e 다음 대상 = 내 왕");
  T.onCell(K9.r,K9.c); await tick();
  ok(T.S.phase==="over"&&T.S.winner===0&&T.S.metrics.winType==="edge"&&pc(T,I.K).r===1,"C9f 엔진의 실제 끝줄 승리(텔레포트 교환 · 주입 없음)");
  const p=posts(TUT_API);
  ok(p.length===1&&JSON.stringify(body(p[0]))===JSON.stringify({v:2,userId:"neo_1",category:"basic",end:"edge"}),"C9g 기본 = 완료 저장 1회 {v:2,category:basic,end:edge}");
  ok(T.single.SP.progress.tutorial.basic==="completed"&&!T.single.SP.progress.tutorialDone&&!T.single.SP.note&&T.single.spTierState(0)==="locked","C9h 기본만 처리 — 해금 0 · 해금 알림 0");
  ok(T.S.metrics.byPlayer[1].battles===0&&T.S.pieces.filter(x=>x.owner===1&&x.alive).length===13,"C9i 상대는 처음부터 끝까지 전투 개시·탐색·이동 0(행동 없이 종료만)");
}
{ // B7 실패 → B6 시작 상태부터 다시(저장 0 · 소프트락 없음)
  const T=await tutAsk({}); const X=T.single, Tt=X.SP.tut; X.spAskGo();
  basicTo(T,"B7"); const game=T.S;
  T.S.battle=null; T.render(); // E 가 남은 채 전투가 끝난 상황(통제 — 보장 경로에서는 나오지 않는다)
  ok(Tt.step==="B6"&&T.S!==game&&Tt.attempt===1&&T.S.turnCount===14&&T.S.events[Tt.ids.ev].consumed&&pc(T,Tt.ids.E).alive&&posts(TUT_API).length===0,"C10 B7 패배·E 남음 → 같은 B6 시작 상태(턴 15 · 흔적 소모)로 새 보드 · 저장 0");
}

{ // 연출 중 전이 — 다시 그리기는 연출 중에만 있었고 연출이 끝나도 다시 그리지 않는다(브라우저 run5 B7→B8 멈춤 재현 방지)
  const T=await tutAsk({}); const X=T.single, Tt=X.SP.tut; X.spAskGo(); basicTo(T,"B8");
  ok(Tt.step==="B8","C11 (전제) 실제 경로로 B8");
  Tt.step="B7"; T.FX.cur={key:"turnBanner"}; T.render();
  ok(Tt.step==="B8","C11b 전투가 끝났고 내 차례면 연출 중이어도 B8(연출 끝을 기다리는 전이 없음)");
  T.FX.cur=null;
  const U=await tutAsk({}); const Y=U.single, Ut=Y.SP.tut; Y.spAskGo(); basicTo(U,"B7"); const g0=U.S;
  U.S.battle=null; U.FX.cur={key:"battleEnd"}; U.render(); // E 가 남은 채 전투가 끝났는데 연출 중(통제 — 보장 경로에서는 나오지 않는다)
  ok(Ut.step==="B7"&&U.S===g0&&Ut.idle&&U.FX.idle.length>=1,"C12 실패 재시작은 연출 뒤 — 연출이 끝날 때 한 번 다시 판정하도록 대기 1개(폴링 없음)");
  U.render(); ok(U.FX.idle.length===1,"C12b 다시 그려도 대기는 하나뿐");
  U.FX.cur=null; for(const f of U.FX.idle.splice(0)) f();
  ok(Ut.step==="B6"&&U.S!==g0&&Ut.attempt===1,"C12c 연출이 끝나면 B6 시작 상태부터 다시");
  const V=await tutAsk({}); const Z=V.single, Vt=Z.SP.tut; Z.spAskGo(); basicTo(V,"B7");
  V.S.battle=null; V.FX.cur={key:"battleEnd"}; V.render(); const pend=V.FX.idle.splice(0); V.FX.cur=null;
  V.toLobby(); const g1=V.S; for(const f of pend) f();
  ok(V.S===g1&&Vt.step==="B7"&&Vt.attempt===0,"C12d 문맥이 바뀐 뒤(로비·다른 경기) 늦은 연출 대기는 아무것도 하지 않는다");
  const W=await tutAsk({}); const Wx=W.single, Wt=Wx.SP.tut; Wx.spAskGo(); basicTo(W,"B7"); const g2=W.S;
  W.S.battle=null; W.FX.cur={key:"battleEnd"}; W.render(); const pend2=W.FX.idle.splice(0); W.FX.cur=null;
  W.acct.acctEndSession("세션 종료",false,true); // 같은 경기·문맥을 남긴 채 로그아웃(401 keep 경로와 같은 함수)
  ok(W.AUTH.state!=="in"&&W.S===g2,"C12e (전제) 로그아웃 · 경기 객체 그대로");
  for(const f of pend2) f(); W.render();
  ok(W.S===g2&&Wt.step==="B7"&&Wt.attempt===0&&!coach(W)&&!dlgOpen(W)&&Wt.idle===null,"C12f 로그아웃 중 연출 대기 — 재시작·말풍선·창 0 · 자기 대기 표시만 지움");
}

{ // 늦은 그리기(대상 누름 뒤 setTimeout) — 경기 종료·로그아웃 뒤에는 말풍선을 되살리지 않는다(브라우저 BP 뒤 '기본 9/9' 잔상 재현 방지)
  const T=await tutAsk({"POST /api/profile/tutorial":init=>tutServer(NEW).post(init)}); const X=T.single, Tt=X.SP.tut; X.spAskGo(); basicTo(T,"B9");
  const Tp=pc(T,Tt.ids.T), K=pc(T,Tt.ids.K); T.netAction({t:"tele"}); T.onCell(Tp.r,Tp.c);
  X.spHit(Tt); T.onCell(K.r,K.c); await tick(); T.drain(20); // 마지막 대상 누름의 늦은 그리기가 승리·진행도 뒤에 돈다
  ok(T.S.phase==="over"&&X.SP.dlg==="bp"&&!coach(T),"C13 끝줄 승리 뒤 늦은 그리기 — 말풍선 잔상 0(진행도만)");
  const U=await tutAsk({}); const Y=U.single, Ut=Y.SP.tut; Y.spAskGo(); Y.spNext();
  Y.spHit(Ut); U.acct.acctEndSession("세션 종료",false,true); U.drain(20);
  ok(U.AUTH.state!=="in"&&!coach(U),"C13b 로그아웃(경기 보존) 뒤 늦은 그리기 — 말풍선 0");
}
{ // C14 창 resize·scroll(제품이 실제로 등록한 리스너) — 질문·확인 창·로그아웃·401 보류·다른 계정·다른 경기에서는 말풍선·스포트라이트·초점·읽기 공지 0 · 같은 계정 복원 뒤에는 다시 그린다(spDraw 단일 관문)
  const win=(T,Tt,ev)=>{ Tt.focus=""; T.byId("spLive").textContent=""; return (ev?[ev]:["resize","scroll"]).map(e=>T.winDispatch(e)); }; // 그린 흔적(초점 키·공지)을 지우고 리스너를 부른다
  const quiet=(T,Tt)=>!coach(T)&&!T.byId("spSpot").innerHTML&&Tt.focus===""&&T.byId("spLive").textContent==="";
  const each=(T,Tt,f)=>["resize","scroll"].every(e=>(win(T,Tt,e),f(T,Tt))); // 이벤트 하나씩 따로(초점 키·공지를 매번 지우므로 앞 이벤트의 그림이 뒤 판정을 가리지 않는다)
  let who=NEO; const T=await tutAsk({"GET /api/auth/session":()=>who===NEO?sess(NEO,NEW):who?sess(OLD,EXEMPT(0)):[401,{error:"E_NO_SESSION"}],"POST /api/auth/login":()=>{ who=OLD; return [200,Object.assign({},OLD,{progress:EXEMPT(0)})]; }}); const X=T.single, Tt=X.SP.tut; // 로그인 뒤 세션 조회도 그 계정 · 끝난 세션은 401
  const n=win(T,Tt); ok(n[0]>=1&&n[1]>=1&&X.SP.ask&&quiet(T,Tt),"C14 (전제) resize·scroll 리스너 등록 · 첫 질문 보류 중 그리기 0");
  X.spAskGo(); X.spNext(); win(T,Tt);
  ok(Tt.step==="B2"&&coach(T)&&Tt.focus.startsWith("B2|")&&!!T.byId("spLive").textContent,"C14a 평소 B2 — resize·scroll 이 안내를 다시 그린다");
  X.spSkipAsk();
  ok(X.SP.dlg==="skipq"&&each(T,Tt,quiet),"C14b ⚙ 건너뛰기 확인 창 뒤 — resize·scroll 이 말풍선·스포트라이트·초점·공지를 되살리지 않는다");
  X.spSkipNo(); win(T,Tt);
  ok(!X.SP.dlg&&coach(T)&&Tt.focus.startsWith("B2|"),"C14c [계속하기] 뒤 — 다시 그린다");
  who=null; T.acct.acctEndSession("세션 종료",false,true); await tick(); win(T,Tt); // 실제로 끝난 세션(재조회 401)
  ok(T.AUTH.state!=="in"&&X.SP.tut===Tt&&quiet(T,Tt),"C14d 로그아웃(경기 보존 · 창 없음) — 그리기 0");
  T.byId("acctId").value="old_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick(); win(T,Tt);
  ok(T.AUTH.user.userId==="old_1"&&X.SP.tut!==Tt&&quiet(T,Tt),"C14e 다른 계정 로그인 — 옛 문맥 그리기 0");
  let st="in"; const srv=tutServer(MID);
  const U=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,srv.cur()),
    "POST /api/profile/tutorial":init=>{ if(st==="in"){ st="gone"; return [401,{error:"E_NO_SESSION"}]; } return srv.post(init); },
    "POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:srv.cur()})]; }},MID); const Y=U.single, Ut=Y.SP.tut;
  Y.spAskGo(); const game=U.S; Y.spSkipAsk(); Y.spSkipGo(); await tick();
  ok(Ut.step==="A1"&&U.AUTH.state==="anon"&&U.S===game&&Y.SP.tut===Ut&&Y.SP.pending&&each(U,Ut,quiet),"C14f A1 ⚙ 건너뛰기 POST 401 + 세션 401(경기·문맥 보존 · 로그인 화면) — resize·scroll 그리기 0");
  U.byId("acctId").value="neo_1"; U.byId("acctPw").value="pw123456"; await U.acct.acctSubmit(); await tick(); U.render(); win(U,Ut);
  ok(U.S===game&&Y.SP.tut===Ut&&!Y.SP.pending&&Y.SP.dlg==="skipq"&&dlgOpen(U)&&quiet(U,Ut),"C14g 같은 계정 복원 — 확인 창 다시 · 그 뒤 말풍선 0");
  Y.spSkipNo();
  ok(!Y.SP.dlg&&coach(U)&&each(U,Ut,(U,Ut)=>Ut.focus.startsWith("A1|")&&!!U.byId("spLive").textContent),"C14h 복원 뒤 [계속하기] — 정상 안내 · resize·scroll 이 다시 그린다");
  U.newGame("pvp",{phase:"menu"}); U.render(); win(U,Ut);
  ok(U.S!==game&&quiet(U,Ut),"C14i 다른 경기 — 옛 튜토리얼 문맥 그리기 0");
}
{ // C15 주변 가림막(Dim) — 구멍 = 입력 문(spGateSet)이 받는 실제 대상 사각형 + 배울 자리 · 대상 없음/화면 밖 = 가림막 0(단계·저장 그대로) · resize·scroll 다시 계산 · 창·로그아웃·다른 경기 0
  let live=true; const T=await tutAsk({"GET /api/auth/session":()=>live?sess(NEO,NEW):[401,{error:"E_NO_SESSION"}]}); const X=T.single, Tt=X.SP.tut, I=Tt.ids, sp=()=>T.byId("spSpot").innerHTML; // 끝난 세션은 재조회 401
  geo(T,390,844); ok(X.SP.ask&&!dimOn(T),"C15 (전제) 첫 질문 동안 가림막 0");
  X.spAskGo(); geo(T,390,844);
  ok(Tt.step==="B1"&&dimOn(T)&&dimOn(T)[1]==="390"&&dimOn(T)[2]==="844"&&JSON.stringify(holes(T))===JSON.stringify(["32,432,296,136","32,32,296,536"]),"C15a B1 설명 — 창 크기 가림막 · 구멍 = 내 진영 11~13행 + 보드 전체(배울 자리)");
  X.spNext(); geo(T,390,844); const K=pc(T,I.K), tags=X.spTagPieces(Tt), foe=T.S.pieces.find(x=>x.owner===1&&x.alive);
  ok(Tt.step==="B2"&&holes(T)[0]===cellHole(K.r,K.c)&&tags.length===5&&tags.every(p=>holes(T).includes(cellHole(p.r,p.c)))&&holes(T).length===6&&!holes(T).includes(cellHole(foe.r,foe.c)),"C15b B2 — 구멍 = 대상(내 왕 칸) + 이름표 붙은 내 말 5칸 · 상대 말 칸은 어둡다");
  basicTo(T,"B3"); geo(T,390,844); { const F=pc(T,I.F), hid=T.S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.r===9&&x.c===7), tr=T.S.pieces.find(x=>x.owner===0&&x.r===11&&x.c===5);
    ok(Tt.step==="B3"&&JSON.stringify(holes(T))===JSON.stringify([cellHole(F.r,F.c),cellHole(tr.r,tr.c)])&&!holes(T).includes(cellHole(hid.r,hid.c)),"C15b2 B3 — 구멍 = 보이는 ? + 그 옆 내 함정만 · 숲에 숨은 상대 말 칸은 밝히지 않는다"); }
  basicTo(T,"B4"); geo(T,390,844); ok(Tt.step==="B4"&&dimOn(T)&&holes(T).length===0&&/spPics/.test(coach(T)),"C15b3 B4 도해 설명 — 배경 가림막(뚫린 곳 0) · 도해·[다음]은 말풍선 층");
  geo(T,-390,844); const negV=!/spDim/.test(sp()); geo(T,Infinity,844);
  ok(negV&&!/spDim/.test(sp())&&Tt.step==="B4"&&posts().length===0,"C15b4 B4 [다음] 안내 — 창 크기가 음수·무한이면 resize 뒤 가림막 0(잘못된 SVG 없음) · 단계·저장 그대로"); geo(T,390,844);
  basicTo(T,"B5"); const M=pc(T,I.M); geo(T,390,844);
  const gate=()=>X.spGateSet().out.map(e=>{ const r=e.getBoundingClientRect(); return [r.left-8,r.top-8,r.width+16,r.height+16].join(","); });
  ok(Tt.step==="B5"&&JSON.stringify(holes(T))===JSON.stringify([cellHole(M.r,M.c)])&&JSON.stringify(gate())===JSON.stringify(holes(T)),"C15c B5 — 구멍 하나 = 입력 문이 받는 바로 그 칸(흔적 위의 내 말)");
  geo(T,390,844,-2000,null,"scroll"); ok(Tt.step==="B5"&&!dimOn(T),"C15d 대상이 화면 밖(scroll) — 검은 벽 없음 · 단계 그대로");
  geo(T,390,844,-380,null,"scroll"); ok(dimOn(T)&&JSON.stringify(holes(T))===JSON.stringify([cellHole(M.r,M.c,-380)]),"C15e 대상이 화면 위 끝에 걸침 — 가림막 · 구멍은 실제 자리(잘린 부분은 화면 밖)");
  geo(T,1280,800); ok((dimOn(T)||[])[1]==="1280"&&(dimOn(T)||[])[2]==="800"&&holes(T)[0]===cellHole(M.r,M.c),"C15f resize — 창 크기·구멍 다시 계산");
  T.onCell(M.r,M.c); geo(T,390,844); const sb=X.spGateSet().out[0];
  ok(sb&&sb.textContent==="탐색"&&!dimOn(T)&&Tt.step==="B5"&&posts().length===0,"C15g 대상([탐색])의 크기를 못 얻음 — 가림막 0 · 자동 진행·저장 0");
  const sbR=()=>[[X.spGateSet().out[0],{left:100,top:700,width:80,height:44,right:180,bottom:744}]]; // 다시 그린 차례 줄의 지금 [탐색] 버튼
  geo(T,390,844,0,sbR()); ok(JSON.stringify(holes(T))===JSON.stringify(["92,692,96,60"]),"C15h 대상이 생기면 resize 로 — 구멍 = 그 버튼 하나(말 칸은 어둡다)");
  sb.disabled=true; ok(["resize","scroll"].every(e=>(geo(T,390,844,0,sbR(),e),!/spDim/.test(sp())))&&Tt.step==="B5"&&posts().length===0,"C15h2 보이는 같은 [탐색]이 비활성 — resize·scroll 리스너 뒤 가림막 0 · 단계·저장 그대로");
  sb.disabled=false; geo(T,390,844,0,sbR(),"scroll"); ok(JSON.stringify(holes(T))===JSON.stringify(["92,692,96,60"])&&Tt.step==="B5","C15h3 다시 활성 — scroll 로 가림막·구멍(그 버튼) 되살아남");
  geo(T,390,844,0,[[sb,{left:100,top:700,width:Infinity,height:44,right:Infinity,bottom:744}]]); const infR=!/spDim/.test(sp()); geo(T,Infinity,844,0,sbR());
  ok(infR&&!/spDim/.test(sp())&&Tt.step==="B5"&&posts().length===0,"C15h4 대상 너비·창 너비가 유한하지 않음 — 가림막 0(Infinity SVG 없음) · 단계·저장 그대로");
  X.spSkipAsk(); geo(T,390,844); ok(X.SP.dlg==="skipq"&&!sp(),"C15i ⚙ 건너뛰기 확인 창 — 가림막 0(resize 뒤에도)");
  X.spSkipNo(); geo(T,390,844,0,sbR()); ok(!X.SP.dlg&&JSON.stringify(holes(T))===JSON.stringify(["92,692,96,60"]),"C15j [계속하기] — 다시 그린다");
  live=false; T.acct.acctEndSession("세션 종료",false,true); await tick(); geo(T,390,844); ok(T.AUTH.state!=="in"&&!sp(),"C15k 로그아웃(경기 보존) — 가림막 0 · resize 로 되살아나지 않음");
  T.newGame("pvp",{phase:"menu"}); T.render(); geo(T,390,844); ok(!sp(),"C15l 다른 경기 — 가림막 0");
  ungeo(T);
}

/* ===== D. 진행도(BP) · 저장 ===== */
{ // ACK 와 이동 연출이 둘 다 끝나야 [다음 단계로] — 늦은 ACK · 연타 · 중복 0
  const L=later(), srv=tutServer(NEW);
  const T=await tutAsk({"POST /api/profile/tutorial":init=>L.p.then(()=>srv.post(init))}); const X=T.single, Tt=X.SP.tut;
  X.spAskGo(); basicTo(T,"B9");
  T.FX.force=true; // 실제 연출 시간 — 이동 연출이 타이머로 끝난다
  const Tp=pc(T,Tt.ids.T), K=pc(T,Tt.ids.K); T.netAction({t:"tele"}); T.onCell(Tp.r,Tp.c); T.onCell(K.r,K.c); await tick();
  T.fxReleaseAll(); T.render(); X.spTick();
  const goBtn=()=>(dlg(T).innerHTML.match(/<button[^>]*id="spGo"[^>]*>/)||[""])[0];
  ok(X.SP.dlg==="bp"&&dlgOpen(T)&&/기본 완료/.test(dlg(T).innerHTML)&&dlg(T).innerHTML.includes(X.SP_SAY.BPdone)&&/저장 중…/.test(dlg(T).innerHTML)&&/disabled/.test(goBtn()),"D1 승리 연출 뒤 진행도 — '기본을 마쳤어요!' · 저장 중 · [다음 단계로] 비활성");
  L.release(); await tick();
  ok(/✓ 저장됨/.test(dlg(T).innerHTML)&&!Tt.anim&&/disabled/.test(goBtn()),"D2 ACK 만 끝남(마녀 이동 중) — 여전히 비활성");
  X.spBpNext(); ok(X.SP.dlg==="bp","D2b 이동 중 눌러도 넘어가지 않는다");
  T.drain(20);
  ok(Tt.anim&&!/disabled/.test(goBtn())&&/class="spProg go"/.test(dlg(T).innerHTML),"D3 ACK + 이동 끝 → [다음 단계로] 활성 · 마녀가 심화 칸");
  X.spBpNext(); X.spBpNext(); T.FX.force=false;
  ok(posts(TUT_API).length===1&&!dlgOpen(T)&&X.SP.tut.cat==="advanced"&&X.SP.tut.step==="A1"&&!X.SP.ask&&T.S.phase==="setup","D4 [다음 단계로] → 질문 없이 심화 A1(시작 상점) · 연타에도 저장 1회");
  ok(T.single.rng()===null,"D4b 심화로 넘어가며 기본 보드 시드가 원래 RNG 로 돌아왔다");
}
{ // 진행도 이동 연출(실제 시간) 중 401 → 늦은 타이머가 진행도를 다시 열거나 이동 끝을 세우지 않는다 → 같은 계정 재로그인 → 연출 다시 · ACK 뒤 활성
  let st="in"; const L=later(), srv=tutServer(NEW);
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,srv.cur()),
    "POST /api/profile/tutorial":init=>{ if(st==="in") return L.p.then(()=>{ st="gone"; return [401,{error:"E_NO_SESSION"}]; }); return srv.post(init); },
    "POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:srv.cur()})]; }}); const X=T.single, Tt=X.SP.tut;
  X.spAskGo(); basicTo(T,"B9"); T.FX.force=true;
  const Tp=pc(T,Tt.ids.T), K=pc(T,Tt.ids.K); T.netAction({t:"tele"}); T.onCell(Tp.r,Tp.c); T.onCell(K.r,K.c); await tick();
  T.fxReleaseAll(); T.render(); const game=T.S;
  ok(X.SP.dlg==="bp"&&dlgOpen(T)&&!Tt.anim&&Tt.f.anim,"D5c (전제) 진행도 열림 · 마녀 이동 연출 시작(실제 시간 타이머 대기)");
  L.release(); await tick();
  ok(T.AUTH.state==="anon"&&X.SP.pending&&!dlgOpen(T),"D5d 저장 401 → 로그인 화면 · 진행도 닫힘 · 문맥 보존");
  T.drain(50); T.render();
  ok(!dlgOpen(T)&&!Tt.anim&&!Tt.f.anim&&!coach(T),"D5e 늦은 연출 타이머 — 진행도 다시 열기·이동 끝 표시 0(자기 시작 표시만 지움)");
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick(); T.render();
  ok(T.S===game&&X.SP.dlg==="bp"&&dlgOpen(T)&&/disabled/.test((dlg(T).innerHTML.match(/<button[^>]*id="spGo"[^>]*>/)||[""])[0]),"D5f 같은 계정 재로그인 → 진행도 복원 · 아직 비활성");
  T.drain(50); X.spRetry(); await tick(); T.drain(50);
  ok(Tt.anim&&X.SP.save.st==="ok"&&!/disabled/.test((dlg(T).innerHTML.match(/<button[^>]*id="spGo"[^>]*>/)||[""])[0]),"D5g 연출 다시 끝까지 + 재시도 ACK → [다음 단계로] 활성(멈춤 없음)");
  T.FX.force=false;
}
{ // 움직임 줄이기(헤드리스 = 정적) — 이동은 즉시, ACK 만 기다린다
  const L=later();
  const T=await tutAsk({"POST /api/profile/tutorial":init=>L.p.then(()=>tutServer(NEW).post(init))}); const X=T.single, Tt=X.SP.tut;
  X.spAskGo(); basicTo(T,"B9"); const Tp=pc(T,Tt.ids.T), K=pc(T,Tt.ids.K); T.netAction({t:"tele"}); T.onCell(Tp.r,Tp.c); T.onCell(K.r,K.c); await tick(); T.render();
  const goBtn=()=>(dlg(T).innerHTML.match(/<button[^>]*id="spGo"[^>]*>/)||[""])[0];
  ok(Tt.anim&&/class="spProg go"/.test(dlg(T).innerHTML)&&/disabled/.test(goBtn()),"D5 움직임 줄이기 — 마녀가 바로 심화 칸 · ACK 전 비활성");
  L.release(); await tick();
  ok(/✓ 저장됨/.test(dlg(T).innerHTML)&&!/disabled/.test(goBtn()),"D5b ACK 뒤 활성");
}
{ // ⚙ 기본 건너뛰기 → 기본만 건너뜀 → 진행도(건너뜀 문구) → 심화
  const srv=tutServer(NEW);
  const T=await tutAsk({"POST /api/profile/tutorial":init=>srv.post(init)}); const X=T.single, Tt=X.SP.tut; X.spAskGo(); X.spNext();
  ok(/튜토리얼 건너뛰기/.test(T.renderBoardInfo()||T.byId("boardInfo").innerHTML)&&!/나가기 \(기권 확인\)/.test(T.byId("boardInfo").innerHTML),"D6 ⚙ — 기권 자리에 '튜토리얼 건너뛰기'(기권과 다른 글자)");
  X.spSkipAsk(); const d=dlg(T).innerHTML;
  ok(X.SP.dlg==="skipq"&&/기본 튜토리얼을 건너뛸까요\?/.test(d)&&/건너뛰면 심화 튜토리얼로 넘어가요\./.test(d)&&/class="primary" onclick="spSkipNo\(\)"/.test(d)&&X.spHeld(),"D7 확인 창 — 3R.3 문구 · [계속하기] 기본 초점 · 그동안 보류");
  T.document.dispatch("keydown",{key:"Escape",preventDefault(){},stopImmediatePropagation(){}});
  ok(!X.SP.dlg&&!dlgOpen(T)&&Tt.step==="B2"&&posts().length===0,"D8 Esc = [계속하기] — 그대로 계속 · 저장 0");
  X.spSkipAsk(); X.spSkipGo(); X.spSkipGo(); await tick();
  const p=posts(TUT_API);
  ok(p.length===1&&JSON.stringify(body(p[0]))===JSON.stringify({v:2,userId:"neo_1",category:"basic",end:"skip"})&&srv.st.advanced==="pending","D9 [건너뛰기] → 기본 = 건너뜀 1회(심화는 그대로 대기)");
  ok(X.SP.dlg==="bp"&&/기본 건너뜀/.test(dlg(T).innerHTML)&&dlg(T).innerHTML.includes(X.SP_SAY.BPskip)&&/건너뜀/.test(txt(dlg(T).innerHTML)),"D10 진행도 — 건너뜀 문구·표시(완료로 표시하지 않음)");
  ok(!coach(T)&&!T.byId("spSpot").innerHTML,"D10c 진행도가 뜨는 순간 뒤의 말풍선·스포트라이트 0(다시 그리기 없이)");
  ok(!X.SP.progress.tutorialDone&&!X.SP.note,"D10b 기본 건너뜀만으로 해금 0");
  X.spBpNext(); ok(X.SP.tut.cat==="advanced"&&X.SP.tut.step==="A1","D11 [다음 단계로] → 심화");
}
{ // 중단 — 새로고침·기권·무승부는 저장 0 · 다음 진입 때 그 카테고리 처음
  const T=await tutAsk({}); const X=T.single; X.spAskGo(); X.spNext();
  end(T,1,"resign"); await tick();
  ok(posts(TUT_API).length===0&&/학습이 끝나지 않았어요/.test(side(T))&&/>다시 시작</.test(side(T)),"D12 기권(통제 종료) — 저장 0 · '학습이 끝나지 않았어요' · [다시 시작]");
  T.toLobby(); ok(T.S.mode==="pve"&&X.SP.ask&&dlgOpen(T)&&X.SP.tut.cat==="basic"&&X.SP.tut.step===null,"D13 [다시 시작] → 질문부터(기본 처음)");
  const U=await tutAsk({},MID); U.single.spAskGo(); end(U,null,"draw"); await tick();
  ok(posts(TUT_API).length===0&&/학습이 끝나지 않았어요/.test(side(U)),"D14 심화 무승부(통제 종료) — 저장 0");
  const V=await tutAsk({},MID); ok(V.single.SP.tut.cat==="advanced"&&posts().length===0,"D15 새로 불러오기(새로고침) = 저장 0 · 미처리 카테고리(심화)부터 다시 · 자동 건너뜀 0");
}

{ // 정본 ACK(409) — 다른 창이 먼저 정한 값을 그대로 보이고 다음 행동도 그 값을 따른다(3R.1)
  for(const [nm,resp,title,say,btn,next] of [
    ["다른 창에서 기본 건너뜀",PG("skipped","pending"),"기본 건너뜀","BPskip","다음 단계로","A1"],
    ["다른 창에서 심화까지 정함",PG("completed","skipped"),"기본 완료","BPdone","로비로","lobby"],
    ["면제(이관)",PG("exempt","exempt"),"기본 면제","BPskip","로비로","lobby"]]){
    const T=await tutAsk({"POST /api/profile/tutorial":[409,{error:"E_TUTORIAL_CONFLICT",progress:resp}]}); const X=T.single;
    X.spAskGo(); end(T,0,"edge"); await tick(); T.render(); // 통제 종료 — 저장 경계의 표시만 본다(실제 완주 아님)
    const d=dlg(T).innerHTML;
    ok(X.SP.save.st==="ok"&&new RegExp(`<h2 id="spDlgT">${title}</h2>`).test(d)&&d.includes(X.SP_SAY[say])&&new RegExp(`>${btn}</button>`).test(d),`D16 ${nm} — 409 정본 ACK: 제목 '${title}' · 문구 · [${btn}]`);
    const ko={completed:"완료",skipped:"건너뜀",exempt:"면제",pending:"다음"};
    ok(new RegExp(`심화 ${ko[resp.tutorial.advanced]}"`).test(d)&&new RegExp(`st-${resp.tutorial.advanced}"><b>심화`).test(d),`D16c ${nm} — 진행도 심화 칸·읽는 이름도 정본(${ko[resp.tutorial.advanced]})`);
    X.spBpNext(); assetsLoad(T); await tick();
    ok(next==="A1"?X.SP.tut&&X.SP.tut.cat==="advanced"&&X.SP.tut.step==="A1":T.uiScreenName()==="lobby"&&!X.SP.tut&&posts(TUT_API).length===1,`D16b ${nm} → ${next==="A1"?"심화 A1":"이미 정해진 심화를 다시 하지 않고 로비"}`);
  }
  const T=await tutAsk({"POST /api/profile/tutorial":[409,{error:"E_TUTORIAL_CONFLICT",progress:PG("completed","skipped")}]},MID); const X=T.single, A=X.SP.tut;
  X.spAskGo(); T.aiAutoPlace(0); global.setupDone(); T.drain(50); A.step=null; A.seen.shop=A.seen.burn=true; T.render();
  end(T,0,"king"); await tick(); T.render();
  const d=dlg(T).innerHTML;
  ok(/<h2 id="spDlgT">심화 건너뜀<\/h2>/.test(d)&&d.includes(X.SP_SAY.A11skip)&&!d.includes(X.SP_SAY.A11done)&&/st-skipped/.test(d),"D17 심화 완료 요청에 409 정본 '건너뜀' — 결과 제목·문구·칩 모두 건너뜀(완료라 쓰지 않음)");
}

/* ===== E. 심화 A1~A11 ===== */
{
  const srv=tutServer(MID);
  const T=await tutAsk({"POST /api/profile/tutorial":init=>srv.post(init)},MID); const X=T.single, A=X.SP.tut;
  X.spAskGo();
  const i=A.f.slot, key=A.f.key;
  ok(A.step==="A1"&&/심화 1\/11/.test(coach(T))&&coach(T).includes(X.SP_SAY.A1)&&T.S.eco.shop.kind==="start"&&key,"E1 A1 — '심화 1/11' · 실제 시작 상점");
  ok(X.spSpec(A).tg.sel===`[onclick="unitHelpSlot(${i},this)"]`&&T.S.eco.shop.slots[0][i].key===key,"E1b A1 첫 대상 = 살 수 있는 카드의 상세 창 하나");
  ok(X.spClockHeld()&&!X.spHeld(),"E1c 심화 말풍선 동안 준비 시계 정지 · AI 보류는 아님");
  T.ui238.unitHelpSlot(i,null); A.f.a1info=true; // 상세 창(실제 진열 설명 창)
  ok(X.spSpec(A).tg.sel===`[onclick="window.__shop('buy',${i})"]`,"E1d 다음 대상 = 그 카드의 구매 버튼");
  T.__shop("buy",i); T.render();
  ok(T.ecoUnitOf(T.S,0,key)&&A.step==="A2","E2 실제 구매 1회 → A2");
  ok(coach(T).includes(X.SP_SAY.A2)&&/>다음</.test(coach(T)),"E2b A2 시너지 문구 · [다음]");
  X.spNext(); ok(A.step==="A3"&&coach(T).includes(X.SP_SAY.A3)&&X.spSpec(A).tg.sel===".leadRow button","E3 A3 문구 · 대상 = 누를 수 있는 속성 버튼(초점이 묶음 div 가 아니라 버튼에)");
  const king=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), coins=T.S.eco.coins[0];
  T.__shop("lead",king.id,"water"); T.render();
  ok(A.step==="A4"&&pc(T,king.id).element==="water"&&pc(T,king.id).leaderElChosen&&T.S.eco.coins[0]===coins,"E3b 실제 속성 변경 1회(무료) → A4");
  X.spNext(); ok(A.step==="A4","E4 아이템 칸을 보기 전 [다음] 은 진행하지 않는다");
  A.f.item=true; geo(T,390,844); ok(A.step==="A4"&&dimOn(T)&&holes(T).length===0&&/>다음</.test(coach(T)),"E4a 아이템 칸을 본 뒤 [다음] 만 남은 안내 — 주변 가림막(CJ 범위 확인: 말풍선 버튼이 입력을 붙잡는 단계)"); ungeo(T);
  X.spNext(); ok(A.step==="A5"&&X.spGateSet()===null,"E4b 아이템 칸 → [다음] → A5 자유 구매(막지 않음)");
  geo(T,390,844); ok(!dimOn(T),"E4c A5 자유 구매 — 가림막 0"); ungeo(T);
  T.aiShop(0); T.render(); // 남은 코인으로 필드 채우고 [다음 단계](실제 상점 경로)
  ok(A.step==="A6"&&T.UI.prep==="place"&&coach(T).includes(X.SP_SAY.A6),"E5 [다음 단계] → A6 배치");
  const my=T.S.pieces.filter(x=>x.owner===0);
  global.selTray(my[0].id); T.render();
  const z=T.byId("board").querySelector(`.cell[data-r="12"][data-c="1"]`), zFoe=T.byId("board").querySelector(`.cell[data-r="2"][data-c="1"]`);
  ok(z.getAttribute("tabindex")==="0"&&z.getAttribute("role")==="button"&&/12행 1열 빈칸/.test(z.getAttribute("aria-label"))&&zFoe.getAttribute("tabindex")===null&&X.spGateSet().out.includes(z),"E6a 말을 고른 뒤 내 진영 빈칸 = 키보드 대상(Tab · 이름 · 상대 진영 칸은 아님)");
  geo(T,390,844); { const zc=X.spGateSet().out;
    ok(dimOn(T)&&zc.length>1&&zc.every(c=>holes(T).includes(cellHole(+c.dataset.r,+c.dataset.c)))&&!holes(T).includes(cellHole(2,1)),"E6d A6 가림막 구멍 = 놓을 수 있는 내 진영 빈칸 전부(하나로 줄이지 않음) · 상대 진영은 어둡다"); } ungeo(T);
  z.onkeydown({key:"Enter",preventDefault(){}}); T.render(); ok(A.f.pid===my[0].id&&!A.f.back&&T.S.pieces.find(x=>x.id===my[0].id).r===12,"E6 말 하나 놓기(Enter — 실제 셀 입력 경로)");
  T.onCell(12,1); T.render(); ok(A.f.back,"E6b 놓은 말 눌러 회수");
  global.autoPlace(); T.render(); ok(A.step==="A7"&&T.S.pieces.filter(x=>x.owner===0).every(x=>x.placed),"E6c [무작위 배치] → A7");
  const r0=(T.setSeed(77),T.rand()); T.setSeed(77);
  global.setupDone(); T.drain(50); T.render();
  ok(T.S.phase==="play"&&T.S.current===0&&T.S.metrics.firstPlayer===0&&/선공: 플레이어/.test(T.S.log.map(l=>l.msg).join("\n"))&&!/무작위 선공/.test(T.S.log.map(l=>l.msg).join("\n")),"E7 [배치 완료] → 브론즈 AI전 · 플레이어 선공(무작위 아님)");
  ok(T.S.aiLevel[1]==="bronze"&&T.S.eco&&A.step==="A7"&&/>확인</.test(coach(T))&&coach(T).includes(X.SP_SAY.A7),"E7b 정상 경제 브론즈 경기 · A7 말풍선 [확인]");
  geo(T,390,844); ok(dimOn(T)&&X.spGateSet()!==null,"E7b2 [확인] 이 입력을 붙잡는 동안 — 주변 가림막(CJ: 자유 경기는 확인 뒤)"); ungeo(T);
  X.spNext(); ok(A.step===null&&!coach(T)&&!X.spClockHeld()&&X.spGateSet()===null,"E7c [확인] → 안내 없는 자유 경기(시계 정상 · 입력 제한 없음)");
  geo(T,390,844); ok(!T.byId("spSpot").innerHTML,"E7d 확인 뒤 자유 경기 — 가림막 0"); ungeo(T);
  /* 자유 경기 — 실제 20턴 정기 상점(통제: 턴 수만 미리 세운 고정 장면 아님 — 실제 endTurn 경로) */
  T.S.turnCount=19; T.S.current=1; T.dispatchCoreAction({t:"endTurn"}); T.render();
  ok(T.S.phase==="shop"&&A.step==="A8"&&coach(T).includes(X.SP_SAY.A8)&&X.SP_SHOP_TIERS.every(([t,g,b],k)=>T.ECO.shopTurns[k]===t&&T.ECO.bonus[t]===b),"E8 실제 20턴 정기 상점이 열린 순간 A8 · 도해 = ECO 값(20/40/60/80 · 보너스)");
  geo(T,390,844); ok(dimOn(T)&&/spTiers2/.test(coach(T)),"E8c A8 도해 [확인] — 배경 가림막 · 등급 도해는 말풍선 층"); ungeo(T);
  X.spNext(); ok(A.seen.shop&&!A.seen.burn&&A.step===null,"E8b [확인] → 본 여부: 상점 = 예(턴 수가 아니라 확인으로)");
  /* 통제 종료 — 패배(왕 제거) */
  end(T,1,"king"); await tick();
  ok(A.step==="A10"&&coach(T).includes(X.SP_SAY.A10loss)&&/남은 연습 건너뛰기/.test(coach(T))&&posts(TUT_API).length===0,"E9 실제 패배 뒤 A10 '아쉬워요!' · [남은 연습 건너뛰기] · 아직 저장 0");
  geo(T,390,844); ok(dimOn(T)&&posts(TUT_API).length===0,"E9b A10 결과 요약([다음]·[남은 연습 건너뛰기]) — 주변 가림막 · 저장 0"); ungeo(T);
  const match=T.S;
  X.spNext();
  ok(A.practice==="burn"&&A.step==="A10b"&&/연습 장면/.test(coach(T))&&coach(T).includes(X.SP_SAY.A10b)&&T.isBurning()&&T.S.turnCount===64&&T.S.current===0,"E10 못 본 것만 — 상점은 봤으니 버닝 연습만(65턴 내 차례 · '연습 장면')");
  const P=pc(T,A.f.burnId); ok(T.canMoveTo(P,6,4)&&P.r===8&&/const expedZone=\(owner,r\)=> owner===0 \? r<=5 : r>=9;/.test(fs.readFileSync(path.join(__dirname,"..","..","js","core.js"),"utf8")),"E10b 곧게 2칸 합법 · 상대 숲·진영(1~5행)은 2칸 불가 구역");
  ok(JSON.stringify(X.spSpec(A).zone)===JSON.stringify([[1,5,"1칸"],[6,13,"2칸"]]),"E10c 보드 위 허용 구역 비교(1칸 · 2칸)");
  T.onCell(P.r,P.c); T.onCell(6,4); await tick();
  const p=posts(TUT_API);
  ok(T.S===match&&T.S.winner===1&&T.S.metrics.winType==="king"&&A.res==="completed"&&p.length===1&&JSON.stringify(body(p[0]))===JSON.stringify({v:2,userId:"neo_1",category:"advanced",end:"king"}),"E11 연습 마침 → 원래 경기 결과(패배 · 왕 제거) 그대로 · 심화 = 완료 {end:king}");
  ok(X.SP.dlg==="a11"&&/심화 완료/.test(dlg(T).innerHTML)&&dlg(T).innerHTML.includes(X.SP_SAY.A11done)&&/✓ 저장됨/.test(dlg(T).innerHTML),"E11b A11 결과 패널 · 저장됨");
  ok(posts(CLR_API).length===0&&X.SP.progress.aiClearedTier===0,"E11c 튜토리얼·연습에서 PVE 클리어·보상 0");
  X.spA11Go(); assetsLoad(T); await tick();
  ok(T.uiScreenName()==="lobby"&&T.byId("spLive").textContent==="🔓 무제한 AI 대전이 열렸어요. 브론즈부터 도전해 보세요."&&X.spTierState(0)==="open","E12 [로비로] → 로비 + 해금 알림 1회 · 브론즈 열림");
  ok(T.single.rng()===null,"E12b 연습 장면 시드도 원래 RNG 로");
}
for(const [nm,seen,want] of [["둘 다 못 봄(20턴 전 종료)",{},["shop","burn"]],["버닝만 못 봄",{shop:true},["burn"]],["둘 다 봄",{shop:true,burn:true},[]]]){
  const T=await tutAsk({"POST /api/profile/tutorial":init=>tutServer(MID).post(init)},MID); const X=T.single, A=X.SP.tut;
  X.spAskGo(); T.aiAutoPlace(0); global.setupDone(); T.drain(50); A.step=null; Object.assign(A.seen,seen); T.render();
  end(T,0,"edge"); await tick();
  const order=[]; for(let n=0;n<4&&A.step!==null&&!X.SP.dlg;n++){ if(A.step==="A10"){ X.spNext(); continue; } order.push(A.practice);
    if(A.practice==="shop"){ ok(T.S.phase==="shop"&&T.shopViewer()===0&&T.S.eco.shop.turn===20&&coach(T).includes(X.SP_SAY.A8),"E13 상점 연습 — 20턴 정기 상점 열림(고정 장면)"); A.f.card=true; X.spNext(); }
    else { const P=pc(T,A.f.burnId); T.onCell(P.r,P.c); T.onCell(6,4); await tick(); } }
  ok(JSON.stringify(order)===JSON.stringify(want)&&X.SP.dlg==="a11"&&body(posts(TUT_API)[0]).end==="edge"&&T.S.winner===0,`E14 ${nm} → 연습 ${want.length?want.join("→"):"없음"} → 심화 완료(end=edge · 승리 보존)`);
}
{ // [남은 연습 건너뛰기] = 심화 건너뜀(해금 · 모든 학습 완료 아님)
  const srv=tutServer(MID);
  const T=await tutAsk({"POST /api/profile/tutorial":init=>srv.post(init)},MID); const X=T.single, A=X.SP.tut;
  X.spAskGo(); T.aiAutoPlace(0); global.setupDone(); T.drain(50); A.step=null; T.render(); end(T,0,"wipe"); await tick();
  X.spNext(); ok(A.practice==="shop","E15 (전제) 상점 연습 중");
  ok(/남은 연습 건너뛰기/.test(T.byId("boardInfo").innerHTML+coach(T)),"E15b 연습 중 ⚙·말풍선 = [남은 연습 건너뛰기]");
  X.spPracticeSkip(); await tick();
  ok(srv.st.advanced==="skipped"&&body(posts(TUT_API)[0]).end==="skip"&&X.SP.dlg==="a11"&&/심화 건너뜀/.test(dlg(T).innerHTML)&&dlg(T).innerHTML.includes(X.SP_SAY.A11skip)&&T.S.metrics.winType==="wipe","E15c 심화 = 건너뜀 · '남은 학습을 건너뛰었어요' · 원래 경기 결과 보존");
  ok(X.SP.progress.tutorialDone&&X.SP.progress.tutorial.advanced==="skipped","E15d 해금(건너뜀으로 — 완료 표시 아님)");
}
{ // 심화 ⚙ 건너뛰기 → 확인 창 저장 중 → ACK → 로비 + 해금 알림
  const L=later(), srv=tutServer(MID);
  const T=await tutAsk({"POST /api/profile/tutorial":init=>L.p.then(()=>srv.post(init))},MID); const X=T.single;
  X.spAskGo(); X.spSkipAsk(); const d=dlg(T).innerHTML;
  ok(/심화 튜토리얼을 건너뛸까요\?/.test(d)&&/싱글플레이는 열리지만 남은 학습은 건너뜀으로 남아요\./.test(d),"E16 심화 확인 창 문구");
  X.spSkipGo(); await tick();
  ok(/저장 중…/.test(dlg(T).innerHTML)&&X.SP.dlg==="skipq"&&T.uiScreenName()!=="lobby","E16b 확인 창 '저장 중…' · ACK 전 로비 아님");
  L.release(); await tick(); assetsLoad(T); await tick();
  ok(T.uiScreenName()==="lobby"&&srv.st.advanced==="skipped"&&T.byId("spLive").textContent==="🔓 무제한 AI 대전이 열렸어요. 브론즈부터 도전해 보세요.","E16c ACK → 로비 + 해금 알림");
}
{ // 버닝(실제) — 65턴 이후 첫 내 차례에 A9 · 곧게 2칸 갈 수 있는 말 강조
  const T=await tutAsk({},MID); const X=T.single, A=X.SP.tut;
  X.spAskGo(); T.aiAutoPlace(0); global.setupDone(); T.drain(50); A.step=null; A.seen.shop=true;
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.placed); m.r=8; m.c=3;
  T.S.turnCount=63; T.S.current=1; T.dispatchCoreAction({t:"endTurn"}); T.render();
  ok(A.step==="A9"&&coach(T).includes(X.SP_SAY.A9)&&A.f.burnId!=null&&T.canMoveTo(pc(T,A.f.burnId),pc(T,A.f.burnId).r-2,pc(T,A.f.burnId).c)||A.step==="A9"&&T.canMoveTo(pc(T,A.f.burnId),pc(T,A.f.burnId).r+2,pc(T,A.f.burnId).c),"E17 실제 버닝 첫 내 차례 → A9 · 곧게 2칸 갈 수 있는 내 말 강조");
  X.spNext(); ok(A.seen.burn&&A.step===null,"E17b [확인] → 본 여부: 버닝 = 예");
}

/* ===== T. 정지 범위 · 튜토리얼 밖 영향 0 ===== */
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,DONE(0))});
  T.FX.force=true; T.single.spPlay(0);
  ok(!T.single.spHeld()&&!T.single.spClockHeld()&&T.single.SP.tut===null&&T.PREPCLK.pz===null&&T.PREPCLK.t!==null,"T1 일반 PVE(무제한 AI) — 튜토리얼 정지 없음 · 준비 시계 종전대로");
  T.single.applyUiEvent({type:"tutHint",key:"teleport"}); T.render();
  ok(!coach(T)&&!dlgOpen(T)&&T.single.spGearLeave("X")==="X"&&T.single.spFirstPlayer()===null,"T2 일반 PVE — 말풍선·tutHint 0 · ⚙ 종전(기권) · 배치 확정에 선공 없음(무작위)");
  T.uiResetScreen(); T.FX.force=false;
}
{
  const T=await tutAsk({},MID); T.single.spAskGo(); T.aiAutoPlace(0); global.setupDone(); T.drain(50); T.single.SP.tut.step=null;
  T.single.applyUiEvent({type:"tutHint",key:"burning"}); T.render();
  ok(!coach(T)&&!dlgOpen(T),"T3 튜토리얼 자유 경기에도 옛 상황 도움말(tutHint) 0 — 3R.3 말풍선만");
  ok(T.single.spAiScript(false)===false,"T4 심화 실제 경기 — 상대는 종전 브론즈 AI(대본 없음)");
}
{
  const T=await tutAsk({});
  T.FX.force=true; T.uiResetScreen(); T.single.SP.ask=false; T.single.SP.held=false; T.single.SP.tut=null;
  routes["GET /api/auth/session"]=sess(NEO,MID); T.single.SP.progress=MID; T.single.spTutEnter();
  const P=T.PREPCLK;
  ok(P.g===T.S&&P.t===null&&P.pz>T.ECO.prepSec*1000-500&&/정지/.test(T.turnClockText("prep")),"T5 심화 질문 중 준비 180초는 멈춰 있다(표시 '정지')");
  P.pz=123456; T.single.spAskGo();
  ok(T.single.SP.tut.step==="A1"&&P.pz!==null&&P.pz<=123456,"T6 [진행] → A1 말풍선 동안 같은 남은 시간으로 정지 유지");
  T.single.SP.tut.step=null; T.single.spTick();
  ok(P.pz===null&&P.t!==null&&Math.abs(P.dl-Date.now()-123456)<300,"T7 말풍선이 걷히면 그 남은 시간부터 재개(새 180초 아님)");
  for(const [nm,C] of [["정기 상점",T.single.SHOPCLK],["B08 가방",T.single.BAGCLK]]){
    let fired=0; C.fire=()=>{ fired++; }; C.t=1; C.dl=Date.now()+5000; C.pz=null;
    T.single.clkHold(true);
    ok(C.pz>4800&&C.pz<=5000&&C.t===null&&T.single.clkLeft(C)===C.pz,`T8 ${nm} 마감 — 정지 동안 남은 시간 보존`);
    T.single.clkHold(false);
    ok(C.pz===null&&C.t!==null&&fired===0&&Math.abs(C.dl-Date.now()-5000)<300,`T9 ${nm} — 재개(만료 처리 없음)`);
    C.t=null; C.fire=null;
  }
  T.uiResetScreen(); T.FX.force=false;
}

/* ===== F. 싱글 화면 ===== */
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,DONE(1)),"POST /api/profile/ai-clear":[200,{progress:DONE(2)}]});
  T.uiStart(); assetsLoad(T); await tick();
  T.single.spOpen(); let s=side(T);
  ok((s.match(/class="[^"]*spCard"/g)||[]).length===2&&/무제한 AI 대전/.test(s)&&/잠김 · v0\.4\.17 예정/.test(s),"F1 P01 = 카드 2장(무제한 AI · 왕국 '잠김 · v0.4.17 예정')");
  ok(/class="locked spCard" aria-disabled="true" data-lock="kingdom" aria-label="도전! 왕국 대전, 잠김, v0\.4\.17 예정"/.test(s),"F2 왕국 카드 — aria-disabled · 읽는 이름에 상태");
  T.render(); ok(T.byId("btnBack").textContent==="← 로비","F3 P01 ← 로비");
  T.single.spToast("🔒 도전! 왕국 대전은 v0.4.17에 열려요."); ok(/v0\.4\.17에 열려요/.test(T.byId("lobbyToast").innerHTML),"F3b 왕국 안내는 기존 로비 토스트 자리");
  T.single.spView("tiers"); s=side(T); const t=txt(s);
  const order=["브론즈","실버","골드","플래티넘","다이아","마스터","그랜드마스터","천상계"].map(n=>t.indexOf(n+" "));
  ok(order.every((x,i)=>x>=0&&(i===0||x>order[i-1])),"F4 P02 8칸 순서(브론즈→천상계)");
  ok(/브론즈 클리어/.test(t)&&/실버 도전 가능/.test(t)&&/골드 잠김 · 실버에서 이기면 열려요/.test(t)&&/aria-label="골드, 잠김, 실버에서 이기면 열려요"/.test(s),"F5 상태 글자 — 클리어 · 도전 가능 · 잠김 사유(읽는 이름 포함)");
  const fut=s.match(/<button[^>]*st-future[\s\S]*?<\/button>/g)||[];
  ok(fut.length===5&&fut.every(b=>/추후 공개/.test(b)&&!/class="lk"/.test(b)&&/aria-disabled="true"/.test(b)),"F6 상위 5칸 '추후 공개' — 잠금 아이콘 없음(잠김과 다른 표시)");
  ok(/class="lk"/.test((s.match(/<button[^>]*t-gold[\s\S]*?<\/button>/)||[""])[0]),"F6b 잠긴 골드에는 잠금 아이콘");
  T.render(); ok(T.byId("btnBack").textContent==="← 싱글","F7 P02 ← 싱글");
  T.single.spPlay(2); ok(T.S.phase==="menu"&&toast(T)==="실버에서 이기면 열려요","F8 잠긴 골드 — 입장 없이 토스트 '실버에서 이기면 열려요'");
  ok(T.NET.publicMode===true&&!!T.NET.ws,"F8b (전제) HTTP 로비는 방 목록 소켓으로 publicMode 가 켜져 있다");
  T.single.spPlay(0); ok(T.S.mode==="pve"&&T.S.aiLevel[1]==="bronze"&&T.single.SP.run.tier===1,"F9 클리어한 브론즈 재도전(무료)");
  ok(T.NET.publicMode===false&&T.NET.ws===null&&!T.NET.mode,"F9b PVE 시작 전에 방 목록 소켓을 닫는다 — 로컬 경기 행동이 공개 방 회선으로 가지 않는다");
  end(T,0,"king"); await tick();
  ok(posts(CLR_API).length===0&&/이미 클리어한 단계예요/.test(txt(side(T))),"F10 이미 클리어한 단계의 승리(통제 종료) — 요청 생략");
  ok(/>다시 도전</.test(side(T))&&/>난이도로</.test(side(T))&&T.byId("btnBack").textContent==="← 난이도"&&!/방으로 돌아가기|로비로 돌아가기/.test(side(T)),"F11 S04p [다시 도전]·[난이도로] · ← 난이도");
  T.rematch(); ok(T.S.mode==="pve"&&T.S.phase==="setup"&&T.S.aiLevel[1]==="bronze"&&T.single.SP.run.game===T.S,"F12 [다시 도전] = 같은 티어 새 경기");
  T.single.spToTiers(); assetsLoad(T); await tick();
  ok(T.uiScreenName()==="lobby"&&T.LOBBY.view==="tiers","F13 [난이도로] → P02");
  T.single.spPlay(1); end(T,1,"king"); await tick();
  ok(posts(CLR_API).length===0&&/승리하지 않아 실버 클리어가 아니에요/.test(txt(side(T))),"F14 패배 — 요청 0");
  T.rematch(); end(T,0,"resign"); await tick(); ok(posts(CLR_API).length===0,"F15 기권 종료 — 승자여도 요청 0");
  const L=later(); routes["POST /api/profile/ai-clear"]=()=>L.p.then(()=>[200,{progress:DONE(2)}]);
  T.rematch(); end(T,0,"wipe"); await tick();
  const p=posts(CLR_API);
  ok(p.length===1&&JSON.stringify(body(p[0]))===JSON.stringify({v:1,userId:"neo_1",tier:2,end:"wipe"}),"F16 새 티어 승리 → POST ai-clear {v:1,userId,tier:2,end}");
  ok(/저장 중…/.test(side(T))&&/id="spGo" disabled/.test(side(T))&&T.single.spTierState(2)==="locked","F17 ACK 전 — 저장 중 · 다음 티어 아직 잠김 · 떠나기 비활성");
  L.release(); await tick();
  ok(T.single.SP.progress.aiClearedTier===2&&/✓ 실버 클리어 저장됨/.test(side(T))&&T.byId("spLive").textContent==="🔓 골드가 열렸어요.","F18 ACK 뒤 '저장됨' · '골드가 열렸어요' 1회");
  ok(T.single.spTierState(2)==="open"&&T.single.spTierState(1)==="cleared","F19 골드 도전 가능 · 실버 클리어");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,EXEMPT(3))});
  T.LOBBY.view="tiers"; const t=txt(T.single.spLobbyHtml());
  ok([0,1,2].every(i=>T.single.spTierState(i)==="cleared")&&/플래티넘 추후 공개/.test(t)&&!/플래티넘 도전 가능/.test(t),"F20 골드 클리어도 상위 티어를 열지 않는다");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,DONE(0)),"POST /api/profile/ai-clear":[409,{error:"E_TIER_LOCKED"}]});
  T.single.spPlay(0); end(T,0,"king"); await tick();
  ok(T.single.SP.save.st==="fail"&&/저장하지 못했어요/.test(side(T))&&/>다시 시도</.test(side(T))&&gets(SESS).length>=2,"F21 E_TIER_LOCKED — '저장하지 못했어요.' + [다시 시도] · 진행 다시 받기");
}
{ // 확인 불가 → [싱글플레이] 가 다시 조회(§2.6)
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,undefined)});
  T.uiStart(); assetsLoad(T); await tick();
  T.single.spOpen(); await tick();
  ok(T.LOBBY.view==="home"&&toast(T)==="진행 정보를 불러오지 못했어요. 다시 시도해 주세요."&&gets(SESS).length===2,"F22 확인 불가 — 다시 조회 · 또 실패면 안내(튜토리얼 강제·해금 없음)");
  routes["GET /api/auth/session"]=sess(NEO,NEW); T.single.spOpen(); await tick();
  ok(T.S.mode==="pve"&&T.single.SP.ask,"F23 다시 조회 결과 미해금 → 튜토리얼");
  const U=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,undefined)});
  U.uiStart(); assetsLoad(U); await tick();
  routes["GET /api/auth/session"]=sess(NEO,DONE(0)); U.single.spOpen(); await tick();
  ok(U.LOBBY.view==="single","F24 다시 조회 결과 해금 → P01");
}
{ // 계정 없는 체험 — 이번 로드 메모리
  const T=await boot("file:///C:/Digit-Duel/demo/index.html",{});
  T.uiStart(); assetsLoad(T); T.single.spOpen(); T.single.spView("tiers");
  ok(T.single.spTierState(0)==="open"&&T.single.spTierState(1)==="locked"&&/이 접속에서만 유지 · 저장 안 됨/.test(side(T)),"F25 계정 없는 체험 — 브론즈 열림 · '이 접속에서만 유지 · 저장 안 됨'");
  T.single.spPlay(0); end(T,0,"king"); await tick();
  ok(posts().length===0&&T.single.SP.local===1&&T.single.spTierState(1)==="open"&&/이 접속에서만 유지 · 저장 안 됨/.test(txt(side(T))),"F26 체험 승리(통제 종료) — 요청 0 · 실버는 이번 로드에서만 열림");
  const U=H.load(htmlPath); ok(U.single.SP.local===0,"F27 새로 불러오면 체험 해금은 사라진다(영구 저장 없음)");
}

/* ===== H. 401 원 화면 보존 · 좌석 우선 · 유한 마감 · 같은 계정 새 세대 ===== */
{ // H1 기본 진행도 저장 401 → 같은 계정 재로그인 → 원 진행도 패널 · 조회만 · 재시도 400 에도 문맥 유지 → 200
  let st="in", n=0; const srv=tutServer(NEW);
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,srv.cur()),
    "POST /api/profile/tutorial":init=>{ n++; if(st==="in"){ st="gone"; return [401,{error:"E_NO_SESSION"}]; } return n===2?[400,{error:"E_BAD_INPUT"}]:srv.post(init); },
    "POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:srv.cur()})]; }});
  const X=T.single; X.spAskGo(); basicTo(T,"B9"); const Tt=X.SP.tut, Tp=pc(T,Tt.ids.T), K=pc(T,Tt.ids.K);
  T.netAction({t:"tele"}); T.onCell(Tp.r,Tp.c); T.onCell(K.r,K.c); await tick(); const game=T.S;
  ok(T.AUTH.state==="anon"&&T.uiScreenName()==="title"&&T.S===game&&T.S.phase==="over"&&X.SP.pending&&X.SP.pending.dlg==="bp","H1 저장 401 → 로그인 화면 · 끝난 기본 경기와 진행도 문맥 보존");
  T.render(); for(const f of T.FX.idle.splice(0)) f(); T.render();
  ok(!dlgOpen(T)&&!coach(T),"H1a 로그아웃 중 다시 그리기·연출 대기가 진행도·말풍선을 열지 않는다");
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick(); T.render();
  ok(T.S===game&&X.SP.dlg==="bp"&&dlgOpen(T)&&posts(TUT_API).length===1&&/저장하지 못했어요/.test(dlg(T).innerHTML)&&/>다시 시도</.test(dlg(T).innerHTML)&&/disabled/.test((dlg(T).innerHTML.match(/<button[^>]*id="spGo"[^>]*>/)||[""])[0]),"H1b 같은 계정 재로그인 → 원 진행도 · 상태 조회만(자동 재전송 0) · [다음 단계로] 비활성");
  X.spRetry(); await tick();
  ok(posts(TUT_API).length===2&&X.SP.dlg==="bp"&&T.S===game&&X.SP.save.st==="fail"&&!X.SP.ask,"H1c 사용자 재시도 400 → 진행도·저장 문맥 그대로(새 질문으로 가지 않음)");
  X.spRetry(); await tick();
  ok(posts(TUT_API).length===3&&/✓ 저장됨/.test(dlg(T).innerHTML)&&body(posts(TUT_API)[2]).end==="edge","H1d 다시 재시도 200 → 저장됨(원 결과 end=edge)");
}
{ // H2b 무제한 AI 클리어 저장 실패 — 버튼·← 모두 떠나지 않는다
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,DONE(0)),"POST /api/profile/ai-clear":[400,{error:"E_BAD_INPUT"}]});
  T.single.spPlay(0); const game=T.S; end(T,0,"king"); await tick();
  T.fxReleaseAll(); T.byId("overlay").classList.add("hidden"); T.byId("tutOverlay").classList.add("hidden"); T.single.uiBack();
  ok(T.uiScreenName()==="result"&&T.S===game&&T.single.SP.save.st==="fail"&&/id="spGo" disabled/.test(side(T))&&/>다시 시도</.test(side(T)),"H2b 클리어 저장 실패 — [다시 도전]·[난이도로]·← 로 떠나지 않고 [다시 시도]만");
}
{ // H3·H10 건너뛰기 401 → 같은 계정 좌석 기록 생김 → 재로그인 → 좌석 재접속 우선(문맥 보존·자동 POST 0) → 좌석이 끝나 로비로 오면 원 질문 · 상태 조회 · 수동 재시도
  let st="in"; const srv=tutServer(NEW);
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,srv.cur()),
    "POST /api/profile/tutorial":init=>{ if(st==="in"){ st="gone"; return [401,{error:"E_NO_SESSION"}]; } return srv.post(init); },"POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:srv.cur()})]; }});
  const game=T.S;
  T.single.spAskSkip(); await tick();
  T.storage.setItem("dd_seat.neo_1",JSON.stringify({u:"neo_1",epoch:"0123abcd",roomId:7,seat:0,seatToken:"A".repeat(22),tokenGen:0}));
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.NET.roomId===7&&T.NET.publicMode&&!!T.storage.getItem("dd_seat.neo_1")&&!T.single.SP.ask&&!dlgOpen(T)&&T.single.SP.pending&&T.single.SP.pending.game===game&&posts(TUT_API).length===1,"H3 좌석 재접속 우선 — 방·좌석 기록 유지 · 원 저장 문맥 보존 · 자동 POST 0");
  T.toLobby(); await tick(); for(let i=0;i<50&&T.single.SP.pending;i++) T.drain(1); await tick();
  ok(T.S===game&&T.single.SP.ask&&dlgOpen(T)&&/저장하지 못했어요/.test(dlg(T).innerHTML)&&posts(TUT_API).length===1&&T.single.SP.save&&T.single.SP.save.st==="fail","H10 좌석 종료 뒤 로비 진입 → 새 튜토리얼이 아니라 원 질문 화면 · 조회만");
  ok(!T.NET.publicMode&&T.NET.ws===null,"H10a 되살린 질문 화면 — 방 목록 소켓 해제");
  T.single.spAskSkip(); await tick();
  ok(posts(TUT_API).length===2&&T.uiScreenName()==="lobby"&&T.single.SP.progress.tutorialDone,"H10b 사용자 재시도 → ACK → 로비");
}
{ // H4 POST 503 → 세션 GET 무응답 → 유한 마감 뒤 '저장 여부를 확인하지 못했어요' + 버튼 활성
  const T=await tutAsk({"POST /api/profile/tutorial":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]});
  routes["GET /api/auth/session"]="hang";
  T.single.spAskSkip(); await tick();
  ok(T.single.SP.save.st==="busy","H4 (전제) 조회 응답을 기다리는 중");
  T.drain(50); await tick();
  ok(T.single.SP.save.st==="fail"&&T.single.SP.save.unknown&&/저장 여부를 확인하지 못했어요/.test(dlg(T).innerHTML)&&!/ disabled>/.test(dlg(T).innerHTML),"H4b 세션 GET 마감(8초) → 확인 불가 + 두 버튼 활성(무기한 대기 없음)");
}
{ // H5 401 뒤 다른 계정 로그인 — 남겨 둔 옛 계정 경기를 버린다
  let gone=false;
  const T=await tutAsk({"GET /api/auth/session":()=>gone?[401,{error:"E_NO_SESSION"}]:sess(NEO,NEW),"POST /api/profile/tutorial":()=>{ gone=true; return [401,{error:"E_NO_SESSION"}]; },"POST /api/auth/login":[200,Object.assign({},OLD,{progress:EXEMPT(2)})]});
  const game=T.S; T.single.spAskSkip(); await tick();
  T.byId("acctId").value="old_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.S!==game&&T.S.mode!=="pve"&&T.uiScreenName()==="lobby"&&!T.single.SP.ask&&!T.single.spHeld()&&T.single.rng()===null,"H5 다른 계정 — 옛 계정의 튜토리얼 경기·질문·정지·시드를 버리고 그 계정 로비로");
}
{ // H6 [싱글플레이] 재조회 무응답 → 유한 마감 뒤 안내
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,undefined)});
  T.uiStart(); assetsLoad(T); await tick();
  routes["GET /api/auth/session"]="hang"; T.single.spOpen(); await tick(); T.drain(50); await tick();
  ok(T.LOBBY.view==="home"&&toast(T)==="진행 정보를 불러오지 못했어요. 다시 시도해 주세요.","H6 확인 불가 재조회 무응답 → 마감 뒤 안내(무기한 대기 없음)");
}
{ // H7·H8 같은 계정 · 새 인증 세대 — 옛 '대기' 캐시를 쓰지 않는다
  for(const [nm,lp,want] of [["progress 누락",undefined,"lobby"],["다른 기기에서 해금",DONE(1),"lobby"],["여전히 대기",NEW,"pve"]]){
    const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,NEW),"POST /api/auth/logout":[200,{}],"POST /api/auth/login":[200,Object.assign({},NEO,lp===undefined?{}:{progress:lp})]});
    ok(T.single.SP.progress&&T.single.SP.progress.tutorialDone===false,`H7 (전제) ${nm} — 첫 세대 캐시 = 미해금`);
    await T.acct.acctLogout(); await tick();
    routes["GET /api/auth/session"]=lp===undefined?sess(NEO,undefined):sess(NEO,lp);
    T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
    ok(want==="lobby"?T.uiScreenName()==="lobby"&&!T.single.SP.ask:T.S.mode==="pve"&&T.single.SP.ask,`H8 같은 계정 재로그인 · ${nm} → ${want==="lobby"?"로비(옛 대기 캐시로 튜토리얼 강제 안 함)":"튜토리얼 질문"}`);
    if(lp===undefined) ok(T.single.SP.progress===null,"H8b 새 세대에 progress 없음 = 확인 불가(null)");
  }
}
{ // H9 로비 자산 로딩 중 재진입 — 끝난 요청이 지금 로비를 끝내 준다(무기한 로딩 없음)
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(OLD,EXEMPT(0))});
  T.uiStart(); await tick();
  const first=T.LOBBY.assets.slice();
  ok(!T.lobby.lobbyReady()&&first.every(a=>a.state==="loading"),"H9 (전제) 첫 진입 — 자산 2개 받는 중");
  T.lobby.lobbyLoad(); await tick();
  for(const a of first) a.img.onload(); await tick();
  ok(T.lobby.lobbyReady()&&T.LOBBY.assets.every(a=>a.state==="ok")&&/id="lobbyNick"/.test(side(T)),"H9b 재진입 뒤에도 원래 요청의 완료로 로비가 열린다");
}

/* ===== G. AI 티어 ===== */
{
  const T=H.load(htmlPath), A=T.AI_TIER;
  ok(A.bronze.engine==="grade5"&&JSON.stringify(A.bronze.prof)===JSON.stringify({aggression:0.7,capture:0.7,kingRush:0.6,caution:1.3,eps:0.30})
    &&A.silver.engine==="grade5"&&JSON.stringify(A.silver.prof)===JSON.stringify({aggression:1,capture:1,kingRush:1,caution:1,eps:0.10})&&A.gold.engine==="dan5"&&!A.gold.prof,"G1 §8 확정 초기값 데이터 표");
  for(const k of ["bronze","silver"]){
    H.freshPlay(T,"pve",["grade5",k]); T.setSeed(9); const r0=T.rand(); T.setSeed(9); const pf=T.aiProf(1); const r1=T.rand();
    ok(pf.eps===A[k].prof.eps&&pf.caution===A[k].prof.caution&&r0===r1&&T.aiLevelOf(1)==="grade5",`G2 ${k} 고정 프로필 — 난수 미소비 · grade5 엔진`);
  }
  H.freshPlay(T,"pve",["grade5","gold"]); ok(T.aiLevelOf(1)==="dan5"&&T.aiProf(1).eps===0,"G3 골드 = dan5(고정 성향 · ε 0)");
  H.freshPlay(T,"pve",["grade5","grade5"]); T.setSeed(9); for(let i=0;i<5;i++) T.rand(); const r5=T.rand(); T.setSeed(9); const pg=T.aiProf(1); const rr=T.rand();
  ok(rr===r5&&pg.eps>=0.05&&pg.eps<=0.15,"G4 티어 없는 기존 grade5 — 프로필 난수 5회 소비 그대로(rand 순서 불변)");
  H.freshPlay(T,"pve",["grade5","silver"]); ok(T.pname(1)==="AI(실버)","G5 상대 이름에 티어 이름");
  /* 선공 — 호스트가 선공을 주지 않으면 종전 그대로 난수 1회 */
  T.newGame("pve",{aiLevel:["grade5","bronze"]}); T.aiAutoPlace(0); T.aiAutoPlace(1); T.setSeed(5); const want=Math.floor(T.rand()*2); T.setSeed(5);
  T.S.phase="setup"; T.beginPlay(); ok(T.S.current===want&&T.S.metrics.firstPlayer===want,"G6 튜토리얼 밖 beginPlay — 종전 무작위 선공(난수 1회 · 같은 자리)");
}

console.log(`\nsmoke_issue324: ${pass} passed, ${fail} failed`);
if(fail){ console.error(fails.join("\n")); process.exit(1); }
process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
