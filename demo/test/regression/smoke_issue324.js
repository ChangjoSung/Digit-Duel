/* #265·#322·#324 (v0.4.16) 싱글플레이 클라이언트 회귀 — node demo/test/regression/smoke_issue324.js
   서버(/api/auth/* · POST /api/profile/tutorial · POST /api/profile/ai-clear)는 fetch 스텁이다 — SERVER Operations 2026-10-30(Jupiter) 계약,
   의미·문구는 PLAN Singleplayer Draft 'v0.4.16 확정 계약'(Venus). 실서버 저장 E2E 는 이 파일이 아니다(Mars artifact 의 브라우저 증빙).
     A. 진입 분기(§2) — 타이틀 [시작] → 로비로 보내는 지점에서 서버 미완료만 학습 경기(질문 1회) · 완료는 로비 · 확인 불가(필드 누락·형식·장애)는 로비 ·
        좌석 재접속 우선 · 계정 없는 경로 강요 없음
     B. 건너뛰기(§3.1·§3.6·§3.7) — ACK 뒤에만 로비 + 해금 알림 1회 · 유실은 조회 1회 자동 · [다시 시도]는 조회 → 필요할 때만 저장 · 401 같은 계정만 ·
        다른 계정·늦은 응답 차단 · 명시적 거절
     C. 학습 종료 사유(§3.5) — king/edge/wipe 승·패만 저장 · 기권·무승부 0건 · [로비로] ACK 전 비활성 · R 복습(확인함/다음 경기에서)
     D. 학습 정지(§3.4) — 질문·안내 동안 준비·정기 상점·B08 마감 정지·남은 시간 재개 · 행동·전투·대상 선택 paused · AI 보류·재개 · 일반 PVE 무관
     E. 안내(§3.3) — H1~H6 확정 문구·장면 첫 발생 1회 · Core tutHint 는 학습 경기에서만 · H5 순환 = BEATS · Esc·[확인]
     F. 싱글 화면(§5·§6·§7) — P01 카드 2장 · P02 8칸 상태 글자(도전 가능·클리어·잠김·추후 공개) · 새 티어 승리만 저장 · 결과 [다시 도전]·[난이도로] ·
        확인 불가 재조회 · 계정 없는 체험 = 이번 로드 메모리 해금
     G. AI 티어(§8) — 데이터 표 값 · 고정 프로필은 난수 미소비 · 티어 없는 기존 경로 rand 순서 불변 */
"use strict";
const H=require("../shared/harness");
const fs=require("fs"), path=require("path");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const HTTPS="https://dd.example.com/";
const NEO={userId:"neo_1",nickname:"네오",hasEmail:true}, OLD={userId:"old_1",nickname:"고참",hasEmail:true};
const PG=(d,t)=>({tutorialDone:d,aiClearedTier:t||0});
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
  const T=H.load(htmlPath,{href,fetch:fetchStub,storage:storage||H.mkStorage()});
  await tick(); return T;
}
const posts=p=>calls.filter(c=>c.init.method==="POST"&&(!p||c.url===p));
const gets=p=>calls.filter(c=>!c.init.method&&c.url===p);
const body=c=>JSON.parse(c.init.body);
const sess=(u,p)=>[200,Object.assign({},u,p===undefined?{}:{progress:p})];
const dlg=T=>T.byId("spGuide");
const dlgOpen=T=>!dlg(T).classList.contains("hidden")&&dlg(T).innerHTML!==""; // 헤드리스 요소는 HTML 의 초기 class 를 모른다 — 닫힘 = 비운 innerHTML 도 본다
const txt=h=>String(h).replace(/<[^>]+>/g," ").replace(/\s+/g," ");
const side=T=>T.byId("sidePanel").innerHTML;
const assetsLoad=T=>{ for(const a of T.LOBBY.assets||[]) if(a.state==="loading") a.img.onload(); };
const later=()=>{ let release; const p=new Promise(r=>{ release=r; }); return {p,release}; };
const TUT_API="/api/profile/tutorial", CLR_API="/api/profile/ai-clear", SESS="/api/auth/session";
const end=(T,winner,winType)=>{ T.dispatchCoreAction({t:"gameOver",winner,winType}); T.render(); }; // 실제 경기는 종료 뒤 다시 그린다
const toast=T=>T.LOBBY.toast?T.LOBBY.toast.t:"";
async function tutAsk(rt){ const T=await boot(HTTPS,Object.assign({"GET /api/auth/session":sess(NEO,PG(false))},rt)); T.uiStart(); return T; }

(async()=>{
/* ===== A. 진입 분기 ===== */
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,PG(false))});
  ok(T.AUTH.state==="in"&&T.uiScreenName()==="title"&&!T.single.SP.ask,"A1 세션 복원 직후에는 타이틀 그대로(분기는 로비로 보내는 지점)");
  T.uiStart();
  ok(T.S.mode==="pve"&&T.S.phase==="setup"&&T.S.aiLevel[1]==="bronze"&&T.uiScreenName()!=="lobby","A2 미완료 → [시작] 이 로비 대신 학습 경기(브론즈 AI)");
  const d=dlg(T).innerHTML;
  ok(T.single.SP.ask&&dlgOpen(T)&&/첫 경기로 배워 볼까요\?/.test(d)&&/AI와 연습 경기를 하며 기본 규칙을 배워요\. 이 경기는 공식 전적에 들어가지 않아요\./.test(d)&&/>진행</.test(d)&&/>건너뛰기</.test(d),"A3 스킵 질문 1회 — 확정 문구 · [진행][건너뛰기]");
  T.document.dispatch("keydown",{key:"Escape",preventDefault(){},stopImmediatePropagation(){}});
  ok(T.single.SP.ask&&dlgOpen(T),"A3b Esc 로 사라지지 않는다");
  ok(T.byId("app").getAttribute("inert")===""&&T.byId("overlay").getAttribute("inert")==="","A4 질문 동안 게임 화면·게임 모달은 inert");
  const tag=fs.readFileSync(htmlPath,"utf8").match(/<div id="spGuide"[^>]*>/)[0];
  ok(/role="dialog"/.test(tag)&&/aria-modal="true"/.test(tag)&&/aria-labelledby="spDlgT"/.test(tag),"A4b 질문·안내 창 = aria-modal 대화상자");
  ok(posts().length===0,"A5 입장만으로는 저장 요청 0");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(OLD,PG(true,0))});
  T.uiStart(); ok(T.uiScreenName()==="lobby"&&!T.single.SP.ask,"A6 완료 계정(기존 계정 이관) — [시작] 은 로비");
}
for(const [nm,p] of [["필드 없음",undefined],["형식 오류",{tutorialDone:"no",aiClearedTier:0}],["범위 밖",{tutorialDone:false,aiClearedTier:4}],["null",null]]){
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,p)});
  T.uiStart();
  ok(T.uiScreenName()==="lobby"&&T.single.SP.progress===null&&!T.single.SP.ask,`A7 progress ${nm} = 확인 불가 → 로비(미완료로 강제하지 않음)`);
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]});
  T.uiStart(); ok(T.AUTH.state==="down"&&T.S.phase==="menu"&&!T.single.SP.ask,"A8 계정 서버 장애 — 학습으로 보내지 않는다(입장 차단 그대로)");
}
{
  const st=H.mkStorage({"dd_seat.neo_1":JSON.stringify({u:"neo_1",epoch:"0123abcd",roomId:7,seat:0,seatToken:"A".repeat(22),tokenGen:0})});
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,PG(false))},st);
  T.uiStart(); ok(T.NET.roomId===7&&T.S.mode!=="pve"&&!T.single.SP.ask,"A9 진행 중 좌석 재접속이 우선 — 학습 경기로 끌고 가지 않는다");
}
{
  const T=await boot("file:///C:/Digit-Duel/demo/index.html",{});
  T.uiStart(); ok(T.AUTH.state==="off"&&T.uiScreenName()==="lobby"&&!T.single.SP.ask,"A10 file:// — 학습 강요 없이 로비");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":[401,{error:"E_NO_SESSION"}],"POST /api/auth/signup":[201,Object.assign({},NEO,{progress:PG(false)})]});
  T.acct.acctView("signup"); T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; T.byId("acctPw2").value="pw123456"; T.byId("acctNick").value="네오"; T.byId("acctEmail").value="neo@example.com";
  await T.acct.acctSubmit(); await tick();
  ok(T.AUTH.state==="in"&&T.single.SP.progress.tutorialDone===false&&T.S.mode==="pve"&&T.single.SP.ask&&dlgOpen(T),"A11 새 가입 성공(미완료) → 추가 [시작] 없이 학습 질문");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":[401,{error:"E_NO_SESSION"}],"POST /api/auth/login":[200,Object.assign({},OLD,{progress:PG(true,1)})]});
  T.byId("acctId").value="old_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.uiScreenName()==="lobby"&&!T.single.SP.ask&&T.S.mode!=="pve","A12 새 로그인 성공(완료) → 추가 [시작] 없이 로비 로딩");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":[401,{error:"E_NO_SESSION"}],"POST /api/auth/login":[200,Object.assign({},NEO,{})]});
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.uiScreenName()==="lobby"&&!T.single.SP.ask&&T.single.SP.progress===null,"A13 새 로그인 · progress 확인 불가 → 로비(학습 강제 없음)");
}
{
  const st=H.mkStorage({"dd_seat.neo_1":JSON.stringify({u:"neo_1",epoch:"0123abcd",roomId:7,seat:0,seatToken:"A".repeat(22),tokenGen:0})});
  const T=await boot(HTTPS,{"GET /api/auth/session":[401,{error:"E_NO_SESSION"}],"POST /api/auth/login":[200,Object.assign({},NEO,{progress:PG(false)})]},st);
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.NET.roomId===7&&T.S.mode!=="pve"&&!T.single.SP.ask,"A14 새 로그인 · 남은 좌석 기록 → 재접속이 우선(학습 자동 진입 없음)");
}

/* ===== B. 건너뛰기 ===== */
{
  const L=later();
  const T=await tutAsk({"POST /api/profile/tutorial":()=>L.p.then(()=>[200,{progress:PG(true)}])});
  T.single.spAskSkip(); await tick();
  const p=posts(TUT_API), d=dlg(T).innerHTML;
  ok(p.length===1&&JSON.stringify(body(p[0]))===JSON.stringify({v:1,userId:"neo_1",end:"skip"})&&p[0].init.headers["Content-Type"]==="application/json","B1 [건너뛰기] = POST {v:1,userId,end:skip} JSON 1회");
  ok(/저장 중…/.test(d)&&(d.match(/ disabled>/g)||[]).length===2&&T.uiScreenName()!=="lobby","B2 저장 중 — 두 버튼 비활성 · 로비 아님(ACK 전)");
  L.release(); await tick();
  ok(T.uiScreenName()==="lobby"&&!dlgOpen(T)&&!T.single.SP.ask&&T.single.SP.progress.tutorialDone,"B3 ACK 뒤 바로 로비");
  assetsLoad(T); await tick();
  ok(T.byId("spLive").textContent==="🔓 무제한 AI 대전이 열렸어요. 브론즈부터 도전해 보세요.","B4 해금 알림 — 확정 문구 · 상태 공지(로비 로딩 뒤)");
  T.byId("spLive").textContent=""; T.toLobby(); assetsLoad(T); await tick();
  ok(T.byId("spLive").textContent==="","B5 해금 알림은 1회");
  ok(/class="l01Single" id="l01Single" onclick="spOpen\(\)"/.test(side(T))&&!/data-lock="single"/.test(side(T)),"B6 같은 세션 로비에서 싱글플레이 즉시 활성");
}
{ // 503 → 조회 1회: 커밋됨 → 성공(재전송 없음)
  let n=0;
  const T=await tutAsk({"GET /api/auth/session":()=>sess(NEO,PG(n++>0)),"POST /api/profile/tutorial":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]});
  T.single.spAskSkip(); await tick();
  ok(posts(TUT_API).length===1&&T.uiScreenName()==="lobby"&&T.single.SP.progress.tutorialDone,"B7 503(불명) → 조회가 완료를 보이면 재전송 없이 성공");
}
{ // 연결 실패 → 조회 미완료 → '저장하지 못했어요.' → [건너뛰기]=다시 시도 → 같은 본문 → 성공
  let fails=1;
  const T=await tutAsk({"POST /api/profile/tutorial":()=>fails-->0?Promise.reject(new TypeError("x")):[200,{progress:PG(true)}]});
  T.single.spAskSkip(); await tick();
  ok(T.single.SP.ask&&T.single.SP.save.st==="fail"&&/저장하지 못했어요\./.test(dlg(T).innerHTML)&&/role="alert"/.test(dlg(T).innerHTML)&&!/ disabled>/.test(dlg(T).innerHTML),"B8 유실 → 조회 1회(미완료) → 같은 질문 화면에 실패 · [진행]도 그대로");
  ok(posts(TUT_API).length===1&&gets(SESS).length===2&&T.uiScreenName()!=="lobby","B8b 자동 반복 재시도 없음 · 해금 0");
  T.single.spAskSkip(); await tick();
  const p=posts(TUT_API);
  ok(p.length===2&&p[0].init.body===p[1].init.body&&T.uiScreenName()==="lobby","B9 다시 누르면 같은 요청(멱등) → ACK 뒤 로비");
}
{ // 조회도 실패 → '저장 여부를 확인하지 못했어요.' → 다시 시도 = 조회 먼저(커밋돼 있으면 POST 없음)
  let sessOk=true;
  const T=await tutAsk({"GET /api/auth/session":()=>sessOk?sess(NEO,PG(false)):Promise.reject(new TypeError("x")),"POST /api/profile/tutorial":()=>{ sessOk=false; return Promise.reject(new TypeError("x")); }});
  T.single.spAskSkip(); await tick();
  ok(T.single.SP.save.st==="fail"&&T.single.SP.save.unknown&&/저장 여부를 확인하지 못했어요\./.test(dlg(T).innerHTML),"B10 조회도 실패 → '저장 여부를 확인하지 못했어요.'");
  routes["GET /api/auth/session"]=sess(NEO,PG(true)); T.single.spAskSkip(); await tick();
  ok(posts(TUT_API).length===1&&T.uiScreenName()==="lobby","B11 [다시 시도] = 조회 먼저 — 커밋돼 있으면 POST 없이 성공");
}
{ // 401 → 로그인 화면(경기·질문 문맥 보존) · 같은 계정 재로그인 → 원 질문 화면 · 상태 조회만(자동 POST 0) → [건너뛰기]=다시 시도 → ACK → 로비
  let st="in";
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,PG(false)),
    "POST /api/profile/tutorial":()=>{ if(st==="in"){ st="gone"; return [401,{error:"E_NO_SESSION"}]; } return [200,{progress:PG(true)}]; },"POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:PG(false)})]; }});
  const game=T.S;
  T.single.spAskSkip(); await tick();
  ok(T.AUTH.state==="anon"&&T.uiScreenName()==="title"&&T.S===game&&!dlgOpen(T)&&T.single.SP.pending&&T.single.SP.pending.uid==="neo_1","B12 401 → 로그인 화면 · 질문 창 닫힘 · 경기·저장 문맥은 원래 계정에 묶여 보존");
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(posts(TUT_API).length===1&&T.S===game&&T.single.SP.ask&&dlgOpen(T)&&/저장하지 못했어요/.test(dlg(T).innerHTML)&&!/ disabled>/.test(dlg(T).innerHTML),"B13 같은 계정 재로그인 → 원 질문 화면 · 상태 조회만(자동 재전송 0) · 미완료면 [다시 시도] 대기");
  T.single.spAskSkip(); await tick();
  const p=posts(TUT_API);
  ok(p.length===2&&body(p[1]).userId==="neo_1"&&body(p[1]).end==="skip"&&T.uiScreenName()==="lobby","B13b 사용자가 다시 누를 때만 같은 저장 → ACK 뒤 로비");
}
{ // 401 → 다른 계정 로그인 → 옛 저장 재전송 없음
  let gone=false;
  const T=await tutAsk({"GET /api/auth/session":()=>gone?[401,{error:"E_NO_SESSION"}]:sess(NEO,PG(false)),"POST /api/profile/tutorial":()=>{ gone=true; return [401,{error:"E_NO_SESSION"}]; },"POST /api/auth/login":[200,Object.assign({},OLD,{progress:PG(true,2)})]});
  T.single.spAskSkip(); await tick();
  T.byId("acctId").value="old_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(posts(TUT_API).length===1&&T.single.SP.pending===null&&T.single.SP.uid==="old_1"&&T.single.SP.progress.aiClearedTier===2&&T.uiScreenName()==="lobby"&&!T.single.SP.ask,"B14 다른 계정 재로그인 — 옛 계정 저장을 넘기지 않고 그 계정 상태(완료)로 로비");
}
{ // 늦은 응답 — 다른 탭 계정 전환 뒤 도착한 200
  const L=later();
  const T=await tutAsk({"POST /api/profile/tutorial":()=>L.p.then(()=>[200,{progress:PG(true)}])});
  T.single.spAskSkip(); await tick();
  routes["GET /api/auth/session"]=sess(OLD,PG(false));
  T.acct.acctOnStorage({key:"dd_acct",newValue:JSON.stringify({u:"old_1",t:1})}); await tick();
  L.release(); await tick();
  ok(T.AUTH.user.userId==="old_1"&&T.single.SP.uid==="old_1"&&T.single.SP.progress.tutorialDone===false&&!T.single.SP.note,"B15 계정 전환 뒤 늦은 저장 응답은 새 계정에 반영·알림되지 않는다");
}
for(const [code,err] of [[409,"E_ACCOUNT_MISMATCH"],[400,"E_BAD_INPUT"]]){
  const T=await tutAsk({"POST /api/profile/tutorial":[code,{error:err}]});
  T.single.spAskSkip(); await tick();
  ok(posts(TUT_API).length===1&&T.single.SP.save.st==="fail"&&!T.single.SP.save.unknown&&/저장하지 못했어요\./.test(dlg(T).innerHTML)&&!T.single.SP.progress.tutorialDone,`B16 ${code} ${err} — 명시적 실패(자동 재시도·해금 0)`);
}

/* ===== C. 학습 경기 종료 ===== */
for(const [wt,winner,want] of [["king",1,"king"],["edge",0,"edge"],["wipe",1,"wipe"],["resign",1,null],["draw",null,null]]){
  const L=later();
  const T=await tutAsk({"POST /api/profile/tutorial":()=>L.p.then(()=>[200,{progress:PG(true)}])});
  T.single.spAskGo(); T.single.spGuideClose();
  end(T,winner,wt); await tick();
  const p=posts(TUT_API);
  if(want){
    ok(p.length===1&&body(p[0]).end===want,`C1 ${wt} (${winner===0?"승":"패"}) → 학습 완료 저장 end=${want}`);
    ok(/<button type="button" class="primary big" id="spGo" disabled onclick="toLobby\(\)">로비로<\/button>/.test(side(T))&&/저장 중…/.test(side(T)),`C2 ${wt} — ACK 전 [로비로] 비활성 · 저장 중`);
    L.release(); await tick();
    const s=side(T);
    ok(/✓ 저장됨/.test(s)&&/id="spGo" onclick="toLobby\(\)">로비로/.test(s)&&/공식 전적/.test(s),`C3 ${wt} — ACK 뒤 저장됨 · [로비로] 활성`);
    ok(/확인함/.test(s)&&/다음 경기에서/.test(s)&&(s.match(/<li>/g)||[]).length>=6,`C4 ${wt} — R 복습 H1~H6(본 것 '확인함' · 못 본 것 '다음 경기에서')`);
  } else {
    ok(p.length===0,`C5 ${wt} → 저장 요청 0`);
    ok(/학습이 끝나지 않았어요/.test(side(T))&&/>다시 시작</.test(side(T)),`C6 ${wt} — '학습이 끝나지 않았어요' · [다시 시작]`);
    T.toLobby(); ok(T.S.mode==="pve"&&T.single.SP.ask&&dlgOpen(T),`C7 ${wt} 뒤 [다시 시작] → 스킵 질문부터(미완료 유지)`);
  }
}

/* ===== D. 학습 정지 ===== */
{
  const T=await tutAsk({});
  T.FX.force=true; T.uiResetScreen(); T.single.SP.ask=false; T.single.SP.held=false;
  T.single.spTutEnter(); // 실제 시계를 거는 조건(fxLive)으로 다시 들어간다
  const P=T.PREPCLK;
  ok(P.g===T.S&&P.t===null&&P.pz>T.ECO.prepSec*1000-500&&P.pz<=T.ECO.prepSec*1000&&/정지/.test(T.turnClockText("prep")),"D1 질문 중 준비 180초는 시작하지 않은 채 멈춰 있다(표시 '정지')");
  P.pz=123456; T.single.spAskGo();
  ok(T.single.SP.guide==="H1"&&P.pz!==null&&P.pz<=123456&&P.pz>123300,"D2 [진행] → 곧바로 H1 안내 — 같은 남은 시간으로 정지 유지");
  T.single.spGuideClose();
  ok(P.pz===null&&P.t!==null&&Math.abs(P.dl-Date.now()-123456)<200,"D3 [확인] → 그 남은 시간부터 재개(새 180초 아님)");
  for(const [nm,C] of [["정기 상점",T.single.SHOPCLK],["B08 가방",T.single.BAGCLK]]){
    let fired=0; C.fire=()=>{ fired++; }; C.t=1; C.dl=Date.now()+5000; C.pz=null;
    T.single.clkHold(true);
    ok(C.pz>4800&&C.pz<=5000&&C.t===null&&T.single.clkLeft(C)===C.pz,`D4 ${nm} 마감 — 정지 동안 남은 시간 보존`);
    T.single.clkHold(false);
    ok(C.pz===null&&C.t!==null&&fired===0&&Math.abs(C.dl-Date.now()-5000)<300,`D5 ${nm} — 재개(만료 처리 없음)`);
    C.t=null; C.fire=null;
  }
  T.uiResetScreen(); T.startMode("pve",{aiLevel:"bronze"}); T.aiAutoPlace(0); T.aiAutoPlace(1); // 경제 PVE 를 곧바로 대전 단계로
  T.S.eco.shop=null; T.S.phase="play"; T.S.current=0; T.S.mainUsed=false; T.TQ.length=0;
  T.single.SP.tut={game:T.S,seen:{H1:1,H2:1,H3:1,H4:1,H5:1,H6:1}}; T.single.SP.ask=false; T.single.SP.guide=null; T.single.SP.held=false;
  const w0=T.turnClockWants(); T.single.SP.guide="H3"; const w1=T.turnClockWants(); T.single.SP.guide=null;
  ok(w0.length>0&&w0.every(w=>!w.paused)&&w1.length===w0.length&&w1.every(w=>w.paused),"D6 보드 행동 시계 — 평소 흐르고 안내 동안 paused");
  T.S.current=1; T.single.SP.guide="H3"; T.single.SP.held=true; T.TQ.length=0; T.AI.pending=false;
  T.aiSchedule(); T.drain(50);
  ok(T.UI.holdQ.length===1&&T.S.current===1&&!T.S.mainUsed,"D7 안내 동안 학습 AI 예약은 보류(수 0)");
  T.single.spGuideClose(); T.drain(5000);
  ok(T.UI.holdQ.length===0&&(T.S.mainUsed||T.S.current!==1||T.S.phase!=="play"),"D8 [확인] → AI 가 이어서 둔다");
  T.uiResetScreen(); T.FX.force=false;
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,PG(true,0))});
  T.FX.force=true; T.single.spPlay(0);
  ok(!T.single.spHeld()&&T.single.SP.tut===null&&T.PREPCLK.pz===null&&T.PREPCLK.t!==null,"D9 일반 PVE(무제한 AI) — 학습 정지 없음 · 준비 시계 종전대로 흐름");
  T.uiResetScreen(); T.FX.force=false;
}

/* ===== E. 안내 ===== */
{
  const T=await tutAsk({});
  T.single.spAskGo();
  const G=T.single.SP_GUIDE;
  ok(T.single.SP.guide==="H1"&&dlg(T).innerHTML.includes(G.H1.x)&&/>확인</.test(dlg(T).innerHTML),"E1 [진행] 직후 H1(시작 상점) — 확정 문구 · [확인]");
  T.document.dispatch("keydown",{key:"Escape",preventDefault(){},stopImmediatePropagation(){}});
  ok(T.single.SP.guide===null&&!dlgOpen(T),"E2 안내는 Esc 로도 닫힌다");
  T.render(); ok(!dlgOpen(T),"E3 같은 장면 안내는 다시 뜨지 않는다");
  T.S.eco.shop.done[0]=true; T.UI.prep="place"; T.render();
  ok(T.single.SP.guide==="H2"&&dlg(T).innerHTML.includes("말을 배치해요. 상대에게 내 말은 정체를 알 수 없는 ?로 보여요. 왕을 숨기세요."),"E4 배치가 처음 열릴 때 H2");
  T.single.spGuideClose();
  T.single.applyUiEvent({type:"tutHint",key:"teleport"});
  ok(T.single.SP.guide==="teleport"&&dlg(T).innerHTML.includes(T.TUT_HINTS.teleport.text),"E5 Core tutHint(예외 이동 등) → 학습 경기에서는 기존 상황 도움말 문구로");
  T.single.spGuideClose(); T.single.applyUiEvent({type:"tutHint",key:"teleport"});
  ok(T.single.SP.guide===null,"E6 같은 도움말은 한 경기 1회");
  ok(G.H5.x.includes(T.single.spCycleText())&&T.single.spCycleText()==="불→풀→땅→번개→물→불","E7 H5 상성 순환 = 현행 BEATS (V7 대조)");
  ok(G.H3.x==="상대 왕 잡기 · 내 왕이 상대 끝줄에 서기 · 상대 하수인·동료 전멸, 셋 중 하나면 이겨요."&&/대각선 X/.test(G.H4.x)&&G.H6.x==="정기 상점이에요. 하수인과 상품을 사고 팔 수 있어요.","E8 H3·H4·H6 확정 문구");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,PG(true,0))});
  T.single.spPlay(0); T.single.applyUiEvent({type:"tutHint",key:"teleport"}); T.render();
  ok(!dlgOpen(T)&&T.single.SP.guide===null,"E9 학습 경기가 아닌 PVE — 안내 0회(#260 그대로)");
}

/* ===== F. 싱글 화면 ===== */
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,PG(true,1)),"POST /api/profile/ai-clear":[200,{progress:PG(true,2)}]});
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
  ok(posts(CLR_API).length===0&&/이미 클리어한 단계예요/.test(txt(side(T))),"F10 이미 클리어한 단계의 승리 — 요청 생략");
  ok(/>다시 도전</.test(side(T))&&/>난이도로</.test(side(T))&&T.byId("btnBack").textContent==="← 난이도"&&!/방으로 돌아가기|로비로 돌아가기/.test(side(T)),"F11 S04p [다시 도전]·[난이도로] · ← 난이도");
  T.rematch(); ok(T.S.mode==="pve"&&T.S.phase==="setup"&&T.S.aiLevel[1]==="bronze"&&T.single.SP.run.game===T.S,"F12 [다시 도전] = 같은 티어 새 경기");
  T.single.spToTiers(); assetsLoad(T); await tick();
  ok(T.uiScreenName()==="lobby"&&T.LOBBY.view==="tiers","F13 [난이도로] → P02");
  T.single.spPlay(1); end(T,1,"king"); await tick();
  ok(posts(CLR_API).length===0&&/승리하지 않아 실버 클리어가 아니에요/.test(txt(side(T))),"F14 패배 — 요청 0");
  T.rematch(); end(T,0,"resign"); await tick(); ok(posts(CLR_API).length===0,"F15 기권 종료 — 승자여도 요청 0");
  const L=later(); routes["POST /api/profile/ai-clear"]=()=>L.p.then(()=>[200,{progress:PG(true,2)}]);
  T.rematch(); end(T,0,"wipe"); await tick();
  const p=posts(CLR_API);
  ok(p.length===1&&JSON.stringify(body(p[0]))===JSON.stringify({v:1,userId:"neo_1",tier:2,end:"wipe"}),"F16 새 티어 승리 → POST ai-clear {v:1,userId,tier:2,end}");
  ok(/저장 중…/.test(side(T))&&/id="spGo" disabled/.test(side(T))&&T.single.spTierState(2)==="locked","F17 ACK 전 — 저장 중 · 다음 티어 아직 잠김 · 떠나기 비활성");
  L.release(); await tick();
  ok(T.single.SP.progress.aiClearedTier===2&&/✓ 실버 클리어 저장됨/.test(side(T))&&T.byId("spLive").textContent==="🔓 골드가 열렸어요.","F18 ACK 뒤 '저장됨' · '골드가 열렸어요' 1회");
  ok(T.single.spTierState(2)==="open"&&T.single.spTierState(1)==="cleared","F19 골드 도전 가능 · 실버 클리어");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,PG(true,3))});
  T.LOBBY.view="tiers"; const t=txt(T.single.spLobbyHtml());
  ok([0,1,2].every(i=>T.single.spTierState(i)==="cleared")&&/플래티넘 추후 공개/.test(t)&&!/플래티넘 도전 가능/.test(t),"F20 골드 클리어도 상위 티어를 열지 않는다");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,PG(true,0)),"POST /api/profile/ai-clear":[409,{error:"E_TIER_LOCKED"}]});
  T.single.spPlay(0); end(T,0,"king"); await tick();
  ok(T.single.SP.save.st==="fail"&&/저장하지 못했어요/.test(side(T))&&/>다시 시도</.test(side(T))&&gets(SESS).length>=2,"F21 E_TIER_LOCKED — '저장하지 못했어요.' + [다시 시도] · 진행 다시 받기");
}
{ // 확인 불가 → [싱글플레이] 가 다시 조회(§2.5)
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,undefined)});
  T.uiStart(); assetsLoad(T); await tick();
  T.single.spOpen(); await tick();
  ok(T.LOBBY.view==="home"&&toast(T)==="진행 정보를 불러오지 못했어요. 다시 시도해 주세요."&&gets(SESS).length===2,"F22 확인 불가 — 다시 조회 · 또 실패면 안내(학습 강제·해금 없음)");
  routes["GET /api/auth/session"]=sess(NEO,PG(false)); T.single.spOpen(); await tick();
  ok(T.S.mode==="pve"&&T.single.SP.ask,"F23 다시 조회 결과 미완료 → 학습 경기");
  const U=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,undefined)});
  U.uiStart(); assetsLoad(U); await tick();
  routes["GET /api/auth/session"]=sess(NEO,PG(true,0)); U.single.spOpen(); await tick();
  ok(U.LOBBY.view==="single","F24 다시 조회 결과 완료 → P01");
}
{ // 계정 없는 체험 — 이번 로드 메모리
  const T=await boot("file:///C:/Digit-Duel/demo/index.html",{});
  T.uiStart(); assetsLoad(T); T.single.spOpen(); T.single.spView("tiers");
  ok(T.single.spTierState(0)==="open"&&T.single.spTierState(1)==="locked"&&/이 접속에서만 유지 · 저장 안 됨/.test(side(T)),"F25 계정 없는 체험 — 브론즈 열림 · '이 접속에서만 유지 · 저장 안 됨'");
  T.single.spPlay(0); end(T,0,"king"); await tick();
  ok(posts().length===0&&T.single.SP.local===1&&T.single.spTierState(1)==="open"&&/이 접속에서만 유지 · 저장 안 됨/.test(txt(side(T))),"F26 체험 승리 — 요청 0 · 실버는 이번 로드에서만 열림");
  const U=H.load(htmlPath); ok(U.single.SP.local===0,"F27 새로 불러오면 체험 해금은 사라진다(영구 저장 없음)");
}

/* ===== H. Saturn 독립 반례(P2×3) — 401 원 화면 보존·명시 재시도 · ACK 전 결과 이탈 금지 · 좌석 우선 · 세션 GET 유한 마감 ===== */
{ // H1·H2 학습 정상 종료(wipe 패) 저장 401 → 같은 계정 재로그인 → 원 결과 화면 · 조회만 · 재시도 400 에도 결과·문맥 유지
  let st="in", n=0;
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,PG(false)),
    "POST /api/profile/tutorial":()=>{ n++; if(st==="in"){ st="gone"; return [401,{error:"E_NO_SESSION"}]; } return n===2?[400,{error:"E_BAD_INPUT"}]:[200,{progress:PG(true)}]; },
    "POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:PG(false)})]; }});
  T.single.spAskGo(); T.single.spGuideClose(); const game=T.S;
  end(T,1,"wipe"); await tick();
  ok(T.AUTH.state==="anon"&&T.uiScreenName()==="title"&&T.S===game&&T.S.phase==="over","H1 저장 401 → 로그인 화면 · 끝난 학습 경기(결과)는 보존");
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.uiScreenName()==="result"&&T.S===game&&posts(TUT_API).length===1&&/저장하지 못했어요/.test(side(T))&&/>다시 시도</.test(side(T))&&/id="spGo" disabled/.test(side(T)),"H1b 같은 계정 재로그인 → 원 결과 화면 · 상태 조회만(자동 POST 0) · [다시 시도] · [로비로] 비활성");
  T.single.spRetry(); await tick();
  ok(posts(TUT_API).length===2&&T.uiScreenName()==="result"&&T.S===game&&T.single.SP.save&&T.single.SP.save.st==="fail"&&!T.single.SP.ask,"H1c 사용자 재시도 400 → 결과 화면·저장 문맥 그대로(새 학습 질문으로 가지 않음)");
  T.fxReleaseAll(); T.byId("overlay").classList.add("hidden"); T.byId("tutOverlay").classList.add("hidden"); T.single.uiBack(); // 결과 연출 잠금·(헤드리스 초기 class 없는) 게임 모달을 걷고 저장 가드만 본다
  ok(T.uiScreenName()==="result"&&T.S===game&&T.single.SP.save.st==="fail","H2 ACK 전 학습 결과 — ← 로 떠나지 않는다(저장 문맥 보존)");
  T.single.spRetry(); await tick();
  ok(posts(TUT_API).length===3&&/✓ 저장됨/.test(side(T))&&/id="spGo" onclick="toLobby\(\)">로비로/.test(side(T)),"H1d 다시 재시도 200 → 저장됨 · [로비로] 활성");
}
{ // H2b 무제한 AI 클리어 저장 실패 — 버튼·← 모두 떠나지 않는다
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,PG(true,0)),"POST /api/profile/ai-clear":[400,{error:"E_BAD_INPUT"}]});
  T.single.spPlay(0); const game=T.S; end(T,0,"king"); await tick();
  T.fxReleaseAll(); T.byId("overlay").classList.add("hidden"); T.byId("tutOverlay").classList.add("hidden"); T.single.uiBack(); // 결과 연출 잠금·(헤드리스 초기 class 없는) 게임 모달을 걷고 저장 가드만 본다
  ok(T.uiScreenName()==="result"&&T.S===game&&T.single.SP.save.st==="fail"&&/id="spGo" disabled/.test(side(T))&&/>다시 시도</.test(side(T)),"H2b 클리어 저장 실패 — [다시 도전]·[난이도로]·← 로 떠나지 않고 [다시 시도]만");
}
{ // H3·H10 건너뛰기 401 → 같은 계정 좌석 기록 생김 → 재로그인 → 좌석 재접속 우선(문맥 보존·자동 POST 0) → 좌석이 끝나 로비로 오면 원 질문 · 상태 조회 · 수동 재시도
  let st="in", done=false;
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,PG(done)),
    "POST /api/profile/tutorial":()=>{ if(st==="in"){ st="gone"; return [401,{error:"E_NO_SESSION"}]; } done=true; return [200,{progress:PG(true)}]; },"POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:PG(false)})]; }});
  const game=T.S;
  T.single.spAskSkip(); await tick();
  T.storage.setItem("dd_seat.neo_1",JSON.stringify({u:"neo_1",epoch:"0123abcd",roomId:7,seat:0,seatToken:"A".repeat(22),tokenGen:0}));
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.NET.roomId===7&&T.NET.publicMode&&!!T.storage.getItem("dd_seat.neo_1")&&!T.single.SP.ask&&!dlgOpen(T)&&T.single.SP.pending&&T.single.SP.pending.game===game&&posts(TUT_API).length===1,"H3 좌석 재접속 우선 — 방·좌석 기록 유지 · 원 저장 문맥은 따로 보존 · 자동 POST 0");
  T.toLobby(); await tick(); for(let i=0;i<50&&T.single.SP.pending;i++) T.drain(1); await tick(); // 로비 진입의 지연 게이트까지만 돌린다(그 뒤 조회 응답이 먼저 오게) // 좌석 흐름이 끝나 로비로(netLeave → 로비 진입)
  ok(T.S===game&&T.single.SP.ask&&dlgOpen(T)&&/저장하지 못했어요/.test(dlg(T).innerHTML)&&posts(TUT_API).length===1&&T.single.SP.save&&T.single.SP.save.st==="fail","H10 좌석 종료 뒤 로비 진입 → 새 학습이 아니라 원 질문 화면 · 상태 조회(미완료) · 자동 POST 0");
  T.single.spAskSkip(); await tick();
  ok(posts(TUT_API).length===2&&T.uiScreenName()==="lobby"&&T.single.SP.progress.tutorialDone,"H10b 사용자 재시도 → ACK → 로비");
}
{ // H11 학습 정상 종료 결과 401 → 좌석 재접속 → 좌석 종료 → 원 결과 화면 · 서버가 이미 완료면 재전송 없이 저장됨
  let st="in";
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,PG(st==="re2")),
    "POST /api/profile/tutorial":()=>{ st="gone"; return [401,{error:"E_NO_SESSION"}]; },"POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:PG(false)})]; }});
  T.single.spAskGo(); T.single.spGuideClose(); const game=T.S;
  end(T,1,"king"); await tick();
  T.storage.setItem("dd_seat.neo_1",JSON.stringify({u:"neo_1",epoch:"0123abcd",roomId:7,seat:0,seatToken:"A".repeat(22),tokenGen:0}));
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  st="re2"; // 좌석 중 다른 기기에서 학습 완료가 커밋됐다
  T.toLobby(); await tick(); for(let i=0;i<50&&T.single.SP.pending;i++) T.drain(1); await tick(); // 로비 진입의 지연 게이트까지만 돌린다(그 뒤 조회 응답이 먼저 오게)
  ok(T.S===game&&T.uiScreenName()==="result"&&/✓ 저장됨/.test(side(T))&&posts(TUT_API).length===1&&!T.single.SP.ask,"H11 좌석 종료 뒤 원 학습 결과 화면 · 상태 조회가 완료를 보여 재전송 없이 저장됨(완료한 학습을 다시 시키지 않음)");
  ok(!T.NET.publicMode&&T.NET.ws===null,"H11b 되살린 결과 화면 — 방 목록 소켓 해제");
}
{ // H12 Saturn P2 — 건너뛰기 401 → 좌석 → 좌석 종료 로비 진입(방 목록 소켓) → 원 질문 복원 → [진행] → H1 [확인] → 실제 상점 입력이 로컬 경기에 적용 · 공개 방 회선 송신 0
  let st="in";
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,PG(false)),
    "POST /api/profile/tutorial":()=>{ st="gone"; return [401,{error:"E_NO_SESSION"}]; },"POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:PG(false)})]; }});
  const game=T.S;
  T.single.spAskSkip(); await tick();
  T.storage.setItem("dd_seat.neo_1",JSON.stringify({u:"neo_1",epoch:"0123abcd",roomId:7,seat:0,seatToken:"A".repeat(22),tokenGen:0}));
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.NET.roomId===7&&T.single.SP.pending&&T.single.SP.pending.game===game,"H12 (전제) 좌석 재접속 우선 · 원 문맥 보존");
  T.toLobby(); await tick();
  const lob=T.NET.ws; if(lob) lob.readyState=1; // 열린 방 목록 소켓 — 남아 있으면 프레임이 실제로 나간다
  ok(!!lob&&T.NET.publicMode&&T.NET.lobbyOnly&&T.single.SP.pending,"H12a (전제) 좌석 종료 뒤 로비 진입이 방 목록 소켓을 열었다 · 지연 게이트 전");
  for(let i=0;i<50&&T.single.SP.pending;i++) T.drain(1); await tick();
  ok(T.S===game&&T.single.SP.ask&&dlgOpen(T)&&!T.NET.publicMode&&T.NET.ws===null&&lob.closed&&T.NET.roomId===null,"H12b 원 질문 복원 — spStart 와 같은 회선 해제(publicMode 끔·ws 닫음 — lobbyOnly 는 ws 없이 읽히지 않는다)");
  lob.onmessage({data:JSON.stringify({type:"lobby_ready"})}); lob.onclose({code:1000});
  ok(!T.NET.publicMode&&T.NET.ws===null&&T.S===game&&T.single.SP.ask,"H12c 닫힌 방 목록 소켓의 늦은 콜백은 되살린 경기·회선 상태를 건드리지 않는다");
  T.single.spAskGo(); ok(T.single.SP.guide==="H1","H12d [진행] → H1"); T.single.spGuideClose();
  const c0=T.S.eco.coins[0], q0=T.S.eco.shop.seq[0], n0=lob.sent.length;
  T.__shop("refresh");
  ok(T.S.eco.coins[0]===c0-1&&T.S.eco.shop.seq[0]===q0+1&&lob.sent.length===n0&&!T.wsLog.some(w=>w.sent.some(m=>/shopRefresh/.test(m))),"H12e 실제 상점 [새로 고침] → 로컬 코인·seq 반영 · 공개 방 회선 송신 0");
  ok(T.single.SP.tut&&T.single.SP.tut.game===game&&T.single.SP.tut.seen.H1&&posts(TUT_API).length===1&&T.single.SP.uid==="neo_1","H12f 원 학습 경기·안내 기록 유지 · 자동 POST 0");
}
{ // H13 학습 정상 종료 결과 401 → 좌석 → 좌석 종료 → 원 결과 화면(미완료) → 사용자 [다시 시도] → 저장됨 · 회선 해제
  let st="in";
  const T=await tutAsk({"GET /api/auth/session":()=>st==="gone"?[401,{error:"E_NO_SESSION"}]:sess(NEO,PG(false)),
    "POST /api/profile/tutorial":()=>{ if(st==="in"){ st="gone"; return [401,{error:"E_NO_SESSION"}]; } return [200,{progress:PG(true)}]; },"POST /api/auth/login":()=>{ st="re"; return [200,Object.assign({},NEO,{progress:PG(false)})]; }});
  T.single.spAskGo(); T.single.spGuideClose(); const game=T.S;
  end(T,0,"edge"); await tick();
  T.storage.setItem("dd_seat.neo_1",JSON.stringify({u:"neo_1",epoch:"0123abcd",roomId:7,seat:0,seatToken:"A".repeat(22),tokenGen:0}));
  T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  T.toLobby(); await tick(); for(let i=0;i<50&&T.single.SP.pending;i++) T.drain(1); await tick();
  ok(T.S===game&&T.uiScreenName()==="result"&&/>다시 시도</.test(side(T))&&posts(TUT_API).length===1&&!T.NET.publicMode&&T.NET.ws===null,"H13 좌석 종료 뒤 원 결과 화면 · 자동 POST 0 · 회선 해제");
  T.single.spRetry(); await tick();
  ok(posts(TUT_API).length===2&&body(posts(TUT_API)[1]).end==="edge"&&/✓ 저장됨/.test(side(T))&&T.S===game,"H13b 사용자 재시도 → 원 결과(end=edge) 저장됨");
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
  const T=await tutAsk({"GET /api/auth/session":()=>gone?[401,{error:"E_NO_SESSION"}]:sess(NEO,PG(false)),"POST /api/profile/tutorial":()=>{ gone=true; return [401,{error:"E_NO_SESSION"}]; },"POST /api/auth/login":[200,Object.assign({},OLD,{progress:PG(true,2)})]});
  const game=T.S; T.single.spAskSkip(); await tick();
  T.byId("acctId").value="old_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
  ok(T.S!==game&&T.S.mode!=="pve"&&T.uiScreenName()==="lobby"&&!T.single.SP.ask&&!T.single.spHeld(),"H5 다른 계정 — 옛 계정의 남겨 둔 학습 경기·질문·정지 상태를 버리고 그 계정 로비로");
}
{ // H6 [싱글플레이] 재조회 무응답 → 유한 마감 뒤 안내
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,undefined)});
  T.uiStart(); assetsLoad(T); await tick();
  routes["GET /api/auth/session"]="hang"; T.single.spOpen(); await tick(); T.drain(50); await tick();
  ok(T.LOBBY.view==="home"&&toast(T)==="진행 정보를 불러오지 못했어요. 다시 시도해 주세요.","H6 확인 불가 재조회 무응답 → 마감 뒤 안내(무기한 대기 없음)");
}

{ // H7·H8 같은 계정 · 새 인증 세대 — 옛 '미완료' 캐시를 쓰지 않는다
  for(const [nm,lp,want] of [["progress 누락",undefined,"lobby"],["다른 기기에서 완료",PG(true,1),"lobby"],["여전히 미완료",PG(false),"pve"]]){
    const T=await boot(HTTPS,{"GET /api/auth/session":sess(NEO,PG(false)),"POST /api/auth/logout":[200,{}],"POST /api/auth/login":[200,Object.assign({},NEO,lp===undefined?{}:{progress:lp})]});
    ok(T.single.SP.progress&&T.single.SP.progress.tutorialDone===false,`H7 (전제) ${nm} — 첫 세대 캐시 = 미완료`);
    await T.acct.acctLogout(); await tick();
    routes["GET /api/auth/session"]=lp===undefined?sess(NEO,undefined):sess(NEO,lp);
    T.byId("acctId").value="neo_1"; T.byId("acctPw").value="pw123456"; await T.acct.acctSubmit(); await tick();
    ok(want==="lobby"?T.uiScreenName()==="lobby"&&!T.single.SP.ask:T.S.mode==="pve"&&T.single.SP.ask,`H8 같은 계정 재로그인 · ${nm} → ${want==="lobby"?"로비(옛 미완료 캐시로 학습 강제 안 함)":"학습 질문"}`);
    if(lp===undefined) ok(T.single.SP.progress===null,"H8b 새 세대에 progress 없음 = 확인 불가(null)");
  }
}

{ // H9 로비 자산 로딩 중 재진입(재로그인·로비 복귀·다시 시도) — 끝난 요청이 지금 로비를 끝내 준다(무기한 로딩 없음)
  const T=await boot(HTTPS,{"GET /api/auth/session":sess(OLD,PG(true,0))});
  T.uiStart(); await tick();
  const first=T.LOBBY.assets.slice();
  ok(!T.lobby.lobbyReady()&&first.every(a=>a.state==="loading"),"H9 (전제) 첫 진입 — 자산 2개 받는 중");
  T.lobby.lobbyLoad(); await tick(); // 같은 로딩 중 재진입(gen 증가)
  for(const a of first) a.img.onload(); await tick();
  ok(T.lobby.lobbyReady()&&T.LOBBY.assets.every(a=>a.state==="ok")&&/id="lobbyNick"/.test(side(T)),"H9b 재진입 뒤에도 원래 요청의 완료로 로비가 열린다");
  const U=await boot(HTTPS,{"GET /api/auth/session":sess(OLD,PG(true,0)),"GET /api/profile":()=>later().p}); // 프로필 응답은 오지 않는다
  U.uiStart(); await tick(); const g1=U.LOBBY.gen; U.lobby.lobbyLoad(); await tick();
  ok(U.LOBBY.gen===g1+1&&U.LOBBY.prof==="loading","H9c 프로필(신원) 응답의 gen 가드는 그대로 — 옛 진입의 응답을 새 진입에 쓰지 않는다");
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
}

console.log(`\nsmoke_issue324: ${pass} passed, ${fail} failed`);
if(fail){ console.error(fails.join("\n")); process.exit(1); }
process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
