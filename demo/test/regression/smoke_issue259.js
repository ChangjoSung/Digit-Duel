/* #259 아이디 계정 클라이언트 회귀 — node demo/test/regression/smoke_issue259.js
   서버(/api/auth/*)는 fetch 스텁으로 흉내 낸다. 서버 쪽 정확성(해시·세션·코드·쿠키)은 server 테스트가 본다.
     A. 계정 없는 경로는 증명된 두 경우만(file://·DB 없는 서버 503 E_ACCOUNTS_DISABLED) 기존 그대로.
        연결 실패·모르는 응답·형식 오류·404(JSON 이든 아니든)는 닫힘(입장 차단·다시 시도) · 확인 중(checking)에는 어떤 입장도 없다
     B. 로그인 필요 — 모든 게임 입장(대전 시작·PVE·공개 방)이 막히고 로그인 폼·잠긴 Google 버튼이 보인다
     C. 로그인 — 요청 형식(같은 출처 JSON)·아이디 정규화·실패 문구 구분 없음·비밀번호 칸 비움·닉네임 이스케이프
     D. 가입 — 이메일 필수(다른 계정과 같은 이메일 허용 — CJ 2026-09-27)·입력 검증·복구 코드 UI 없음·가입 즉시 입장
     E. 아이디 전용 비밀번호 재설정(CJ 2026-09-27: 요청 {userId} → 6자리 확인 {userId,code} → 새 비밀번호) · 없는 아이디 404 · 이메일 미등록 409 ·
        202 만 코드 단계 · 이메일 주소 비표시 · 같은 이메일 두 계정의 대상 분리 ·
        메일 불가 503 · 틀린/만료 코드 · 재발송 간격 · 직전 비밀번호 409 · 허가 만료 · 자동 로그인 없음 · 늦은 응답(대상 변경·뒤로·재발송) ·
        코드·허가가 어디에도 남지 않음 · 이메일 없는 기존 계정의 선택 등록(중복 이메일 성공·입장 비차단) · 로그아웃
     F. 비보안 원격 HTTP 에서는 비밀번호 칸 자체가 없다
     G. 좌석 재접속 기록(dd_seat.<아이디>) — 공개 방 입장 전 세션 확인·기록/삭제·새로고침 재접속·계정별 격리·밀려난 탭
     I. 로그아웃·서버 세션 종료(E_SESSION_ENDED·login_replaced·close 4003)는 열린 방 소켓을 닫고 재접속하지 않는다 · 재접속 거절 원인 확인
     J. 닉네임 = 한글 완성형·영문·숫자·밑줄 2~12자
     K. 늦게 도착한 계정 응답 — 로그아웃·세션 종료·계정 전환 뒤 도착한 옛 세션 확인은 신원을 되살리거나 방 소켓을 열지 않는다
     L. 같은 브라우저 프로필의 두 탭(쿠키·저장소 공유, CJ QA REVISE 2026-09-27 재현) — 다른 탭 로그인이 옛 신원의 방 소켓·재접속을 끊고,
        다른 계정의 좌석 기록을 지우거나 이어받지 않는다
     M. 서버 공개 닉네임(players) 표시·E_SAME_ACCOUNT 안내
     W. 방 소켓 없는 로그인 탭의 백그라운드 세션 대조(보이는 동안 5초·포커스·다시 보임, 숨은 탭 생략) — 자동 로그아웃·깜빡임 없음·늦은 응답·중복 없음·재접속 없음 */
"use strict";
const H=require("../shared/harness");
const htmlPath=process.argv[2]||require("path").join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const MARKER="digit-duel.v1", HTTPS="https://dd.example.com/", EPOCH="0123abcd", TOK="A".repeat(22);
const ALICE={userId:"alice_1",nickname:"앨리스",hasEmail:true}, BOB={userId:"bob_22",nickname:"밥돌이",hasEmail:true};
const OTP="482913", GRANT="G".repeat(43), MAIL="alice@example.com";
const calls=[]; let routes={};
global.fetch=async(url,init)=>{
  init=init||{}; calls.push({url:String(url),init});
  const h=routes[(init.method||"GET")+" "+url];
  if(!h) throw new TypeError("fetch failed");
  const r=await (typeof h==="function"?h(init):h); // Promise 를 돌려주면 그 시점까지 응답을 늦춘다(지연 응답 재현)
  if(r==="hang") return new Promise(()=>{}); // 응답이 오지 않는 서버 — 계정 상태 미확정(checking)
  const [status,body]=r;
  return {status,json:async()=>{ if(body===undefined) throw new SyntaxError("not json"); return body; }}; // body 생략 = JSON 아닌 응답(옛 릴레이 정적 404)
};
const tick=async()=>{ for(let i=0;i<12;i++) await new Promise(r=>setImmediate(r)); }; // 지연 응답 사슬(약속→fetch→json→then)이 끝까지 돌게 넉넉히
async function boot(href,rt,st,storage){
  routes=Object.assign({},rt); calls.length=0; // 사본 — 테스트가 routes[...] 를 바꿔도 공용 IN·ANON 픽스처는 그대로
  const T=H.load(htmlPath,{href,fetch:global.fetch,storage:storage||H.mkStorage(Object.assign({tutorialSeen:"1"},st||{}))});
  await tick(); return T;
}
/* #260: 로비에 들어오면 방 목록 소켓(l-)을 로딩과 함께 연다. 이 파일의 소켓 단언은 방 생성·참가·재접속(cp-/p-/r-) 소켓에 대한 것이라 목록 소켓만 뺀다 */
const rs=T=>T.wsLog.filter(w=>!/^l-/.test((w.protocols||[])[1]||""));
const panel=T=>T.byId("acctPanel").innerHTML;
const msg=T=>T.byId("acctMsg").textContent;
const toasts=T=>(T.byId("toasts").children||[]).map(x=>x.textContent).join("|");
const setv=(T,id,v)=>{ T.byId(id).value=v; };
const posts=()=>calls.filter(c=>c.init.method==="POST");
const body=c=>JSON.parse(c.init.body);
const SK="dd_seat.alice_1";
const seat=(T,k)=>T.storage.getItem(k||SK);
const rec=(o)=>JSON.stringify(Object.assign({u:"alice_1",epoch:EPOCH,roomId:7,seat:0,seatToken:TOK,tokenGen:0},o||{}));
const IN={"GET /api/auth/session":[200,ALICE]}, ANON={"GET /api/auth/session":[401,{error:"E_NO_SESSION"}]};
function frame(ws,m){ ws.onmessage({data:JSON.stringify(Object.assign({v:1,epoch:EPOCH,seq:1},m))}); }
function openWs(ws){ ws.readyState=1; ws.protocol=MARKER; if(ws.onopen) ws.onopen(); return ws; }
function later(){ let release; const p=new Promise(r=>{ release=r; }); return {p,release}; }
const signupFill=(T,o)=>{ o=Object.assign({id:"new_user",nick:"플레이어",email:MAIL,pw:"password1",pw2:"password1"},o||{});
  setv(T,"acctId",o.id); setv(T,"acctNick",o.nick); setv(T,"acctEmail",o.email); setv(T,"acctPw",o.pw); setv(T,"acctPw2",o.pw2); };

(async()=>{
/* ===== A. 계정 없는 경로 ===== */
{
  const T=await boot("file:///C:/Digit-Duel/demo/index.html");
  ok(calls.length===0&&T.AUTH.state==="off"&&panel(T)==="","A1 file:// — fetch 0회·state off·계정 패널 비어 있음");
  T.uiStart(); ok(T.UI.entered===true,"A2 file:// — 대전 시작은 기존 그대로 입장");
  T.startMode("pve",{aiLevel:"grade5"}); ok(T.S.mode==="pve"&&T.S.phase==="setup","A3 file:// — PVE 시작 무변경");
}
for(const [name,rt] of [["DB 없는 서버(503 E_ACCOUNTS_DISABLED)",{"GET /api/auth/session":[503,{error:"E_ACCOUNTS_DISABLED"}]}]]){
  const T=await boot(HTTPS,rt);
  T.uiStart();
  ok(T.AUTH.state==="off"&&T.UI.entered===true&&calls.length===1,"A4 "+name+" — state off·게이트 없음");
}
/* 계정 없음으로 추정하지 않는다 — 모두 닫힘 */
for(const [name,rt] of [["연결 실패(fetch 예외)",{}],["모르는 5xx",{"GET /api/auth/session":[500]}],["DB 장애 503",{"GET /api/auth/session":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]}],
  ["모르는 503 코드",{"GET /api/auth/session":[503,{error:"E_SOMETHING"}]}],["JSON 404",{"GET /api/auth/session":[404,{error:"E_NOT_FOUND"}]}],["JSON 아닌 404(Saturn REVISE MEDIUM)",{"GET /api/auth/session":[404]}],
  ["코드 없는 401",{"GET /api/auth/session":[401,{}]}],["200 형식 오류(userId 없음)",{"GET /api/auth/session":[200,{ok:true}]}],["200 JSON 아님",{"GET /api/auth/session":[200]}],["403",{"GET /api/auth/session":[403,{error:"E_BAD_ORIGIN"}]}]]){
  const T=await boot(HTTPS,rt);
  T.uiStart(); const u=T.UI.entered;
  T.UI.entered=true; T.startMode("pve",{aiLevel:"grade5"}); const ph=T.S.phase;
  T.UI.entered=true; T.netCreatePublicRoom(); T.netJoinPublicRoom("3"); await tick();
  ok(T.AUTH.state==="down"&&u===false&&ph==="menu"&&rs(T).length===0&&/다시 시도/.test(panel(T)),"A5 "+name+" → 닫힘: 대전 시작·PVE·방 생성/참가 모두 차단 + 다시 시도");
}
{
  const T=await boot(HTTPS,{});
  routes=ANON; await T.acct.acctCheck();
  ok(T.AUTH.state==="anon","A6 다시 시도 → 서버가 답하면 로그인 화면으로 풀린다");
}
{
  const T=await boot(HTTPS,{"GET /api/auth/session":()=>"hang"});
  ok(T.AUTH.state==="checking","A7 응답 전 = checking");
  T.uiStart(); ok(T.UI.entered===false,"A8 checking — 대전 시작 차단");
  T.UI.entered=true; T.startMode("pve",{aiLevel:"grade5"}); ok(T.S.phase==="menu"&&T.S.mode!=="pve","A9 checking — startMode 직접 호출도 게임을 만들지 않는다");
  T.UI.entered=true; T.startMode("sim"); ok(T.S.phase==="menu","A10 checking — 관전도 차단");
  const n=calls.length; T.UI.entered=true; T.netCreatePublicRoom(); T.netJoinPublicRoom("3"); await tick();
  ok(rs(T).length===0&&calls.length===n,"A11 checking — 방 생성·참가 소켓 없음(세션 재확인 요청도 없음)");
}

/* ===== B. 로그인 필요 ===== */
{
  const T=await boot(HTTPS,ANON);
  ok(T.AUTH.state==="anon","B1 세션 없음(401) → anon");
  ok(/id="acctPw" type="password"/.test(panel(T))&&/autocomplete="current-password"/.test(panel(T)),"B2 로그인 폼(비밀번호 칸·current-password)");
  ok(/<button[^>]*disabled[^>]*>🔒 Google 로그인 — 추후 공개/.test(panel(T)),"B3 Google 로그인은 잠긴 버튼 + 추후 공개 안내");
  T.uiStart(); ok(T.UI.entered===false&&/로그인한 뒤 입장/.test(toasts(T)),"B4 대전 시작 차단 + 안내");
  T.UI.entered=true; T.startMode("pve",{aiLevel:"grade5"});
  ok(T.S.phase==="menu"&&T.UI.entered===false,"B5 PVE 직접 호출도 차단 → 타이틀");
  T.startMode("sim"); ok(T.S.phase==="menu","B6 AI 관전도 차단");
  T.netCreatePublicRoom(); T.netJoinPublicRoom("3"); await tick();
  ok(rs(T).length===0,"B7 공개 방 생성·참가 소켓을 열지 않는다");
  const D=await boot(HTTPS,{"GET /api/auth/session":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]});
  D.uiStart(); ok(D.AUTH.state==="down"&&D.UI.entered===false&&/다시 시도/.test(panel(D)),"B8 DB 장애(503 E_ACCOUNTS_UNAVAILABLE) → 입장 차단 + 다시 시도");
}

/* ===== C. 로그인 ===== */
{
  const T=await boot(HTTPS,Object.assign({},ANON,{"POST /api/auth/login":i=>JSON.parse(i.body).password==="password1"?[200,{userId:"alice_1",nickname:"<b>앨리스</b>",hasEmail:true}]:[401,{error:"E_AUTH_FAILED"}]}));
  setv(T,"acctId"," Alice_1 "); setv(T,"acctPw","wrong-pass");
  await T.acct.acctSubmit();
  const p0=posts()[0];
  ok(p0&&p0.url==="/api/auth/login"&&p0.init.credentials==="same-origin"&&p0.init.headers["Content-Type"]==="application/json","C1 같은 출처 JSON POST");
  ok(body(p0).userId==="alice_1","C2 아이디는 앞뒤 공백 제거·소문자로 보낸다");
  ok(T.AUTH.state==="anon"&&msg(T)==="아이디 또는 비밀번호가 올바르지 않습니다."&&T.byId("acctPw").value==="","C3 실패 — 원인 구분 없는 문구·비밀번호 칸 비움");
  setv(T,"acctPw","password1"); await T.acct.acctSubmit();
  ok(T.AUTH.state==="in"&&T.AUTH.user.userId==="alice_1","C4 로그인 성공 → in");
  ok(/&lt;b&gt;앨리스&lt;\/b&gt;/.test(panel(T))&&!/<b><b>/.test(panel(T)),"C5 닉네임은 이스케이프해 표시");
  T.uiStart(); ok(T.UI.entered===true,"C6 로그인 후 대전 시작 입장");
  ok(!JSON.stringify(T.storage.st).includes("password1")&&T.cookieWrites.length===0,"C7 비밀번호·쿠키를 JS 가 저장하지 않는다");
  const R=await boot(HTTPS,Object.assign({},ANON,{"POST /api/auth/login":[429,{error:"E_RATE_LIMITED"}]}));
  setv(R,"acctId","alice_1"); setv(R,"acctPw","password1"); await R.acct.acctSubmit();
  ok(/너무 잦습니다/.test(msg(R)),"C8 429 → 잠시 후 다시 시도 안내");
  const U=await boot(HTTPS,Object.assign({},ANON,{"POST /api/auth/login":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]}));
  setv(U,"acctId","alice_1"); setv(U,"acctPw","password1"); await U.acct.acctSubmit();
  ok(U.AUTH.state==="down","C9 로그인 중 DB 장애 → down(입장 차단)");
}

/* ===== D. 가입 (이메일 필수 · 복구 코드 없음) ===== */
{
  const T=await boot(HTTPS,Object.assign({},ANON,{"POST /api/auth/signup":[201,{userId:"new_user",nickname:"플레이어_1",hasEmail:true}]}));
  T.acct.acctView("signup");
  ok(/id="acctNick"/.test(panel(T))&&/id="acctEmail" type="email" autocomplete="email"/.test(panel(T))&&/id="acctPw2"/.test(panel(T))&&/new-password/.test(panel(T)),"D1 가입 폼 — 아이디·닉네임·이메일(type=email)·비밀번호·확인");
  const bad=[[{id:"ab"},"아이디"],[{nick:"a b"},"닉네임"],[{nick:"가나다라마바사아자차카타파"},"닉네임"],[{email:""},"이메일"],[{email:"alice@example"},"이메일"],[{email:"alice example.com"},"이메일"],
    [{email:"앨리스@example.com"},"이메일"],[{email:"a".repeat(65)+"@example.com"},"이메일"],[{pw:"short",pw2:"short"},"비밀번호"],[{pw2:"password2"},"일치"],[{nick:"a"},"닉네임"]];
  for(const [o,want] of bad){ signupFill(T,o); await T.acct.acctSubmit();
    ok(posts().length===0&&msg(T).includes(want),"D2 입력 검증 "+JSON.stringify(o)+" → 요청 없이 '"+want+"' 안내"); }
  signupFill(T,{nick:"가나다라마바사아자차카타",email:"  Alice.Kim+dd@Example.co.kr "});
  await T.acct.acctSubmit();
  const b=posts().length===1&&body(posts()[0]);
  ok(b&&b.nickname==="가나다라마바사아자차카타"&&b.email==="Alice.Kim+dd@Example.co.kr"&&Object.keys(b).sort().join()==="email,nickname,password,userId","D3 한글 12자 닉네임·이메일(앞뒤 공백만 제거) 포함 가입 요청");
  ok(T.AUTH.state==="in"&&T.AUTH.code===undefined&&!/복구 코드|recovery/i.test(panel(T)),"D4 가입 성공 → 바로 로그인 · 복구 코드 화면 없음");
  T.uiStart(); ok(T.UI.entered===true,"D5 가입 즉시 입장(코드 저장 확인 게이트 없음)");
  ok(!JSON.stringify(T.storage.st).includes("password1")&&!JSON.stringify(T.storage.st).includes("Example.co.kr"),"D6 비밀번호·이메일을 저장소에 쓰지 않는다");
  ok(calls.every(c=>c.url==="/api/auth/signup"||c.url==="/api/auth/session"||c.url==="/api/profile"),"D3b 이메일 중복 확인 요청 없음 — 가입 요청 하나뿐(형식만 클라이언트가 본다)");
  for(const [code,want] of [["E_NICKNAME_TAKEN","이미 사용 중인 닉네임"],["E_ID_TAKEN","이미 사용 중인 아이디"]]){
    const N=await boot(HTTPS,Object.assign({},ANON,{"POST /api/auth/signup":[409,{error:code}]}));
    N.acct.acctView("signup"); signupFill(N); await N.acct.acctSubmit();
    ok(N.AUTH.state==="anon"&&msg(N).includes(want)&&N.byId("acctPw").value==="","D7 "+code+"(409) 안내·비밀번호 칸 비움");
  }
  // 다른 계정이 이미 쓰는 이메일로 가입 — 서버가 받으면 그대로 성공, 클라이언트에는 이메일 중복 안내가 없다
  const S=await boot(HTTPS,Object.assign({},ANON,{"POST /api/auth/signup":[201,{userId:"bob_22",nickname:"밥돌이",hasEmail:true}]}));
  S.acct.acctView("signup"); signupFill(S,{id:"bob_22",nick:"밥돌이",email:MAIL}); await S.acct.acctSubmit();
  ok(S.AUTH.state==="in"&&S.AUTH.user.userId==="bob_22"&&body(posts()[0]).email===MAIL,"D8 같은 이메일로 두 번째 계정 가입 성공");
  const src=require("fs").readFileSync(require("path").join(require("path").dirname(htmlPath),"js","account.js"),"utf8");
  ok(!/E_EMAIL_TAKEN|이미 사용 중인 이메일/.test(src),"D9 이메일 중복 오류 코드·문구가 클라이언트에 없다");
}

/* ===== E. 아이디 전용 이메일 코드 비밀번호 재설정 ===== */
{
  let sent=0, lastPw=null; const ID="alice_1";
  const RT=Object.assign({},ANON,{
    "POST /api/auth/password-reset/request":()=>{ sent++; return [202,{ok:true}]; },
    "POST /api/auth/password-reset/verify":i=>{ const b=JSON.parse(i.body); return b.code===OTP&&b.userId===ID?[200,{resetToken:GRANT}]:[401,{error:"E_CODE_INVALID"}]; },
    "POST /api/auth/password-reset/complete":i=>{ const b=JSON.parse(i.body); lastPw=b.newPassword;
      return b.resetToken!==GRANT?[401,{error:"E_RESET_INVALID"}]:b.newPassword==="oldpass123"?[409,{error:"E_SAME_PASSWORD",message:"직전 비밀번호와 같습니다"}]:[200,{ok:true}]; }});
  const T=await boot(HTTPS,RT);
  ok(/비밀번호 찾기/.test(panel(T))&&!/복구 코드/.test(panel(T)),"E1 로그인 화면 탭에 '비밀번호 찾기' · 복구 코드 문구 없음");
  T.acct.acctView("reset");
  ok(/id="acctId"/.test(panel(T))&&!/id="acctEmail"/.test(panel(T))&&!/id="acctPw"/.test(panel(T))&&!/id="acctCode"/.test(panel(T))&&!/복구 코드/.test(panel(T))&&/>인증 코드 받기</.test(panel(T)),
    "E2 1단계 — 아이디 칸만(이메일·코드·새 비밀번호 칸 없음) + [인증 코드 받기]");
  for(const id of ["","ab","alice-1"]){
    setv(T,"acctId",id); await T.acct.acctSubmit();
    ok(posts().length===0&&msg(T).includes("아이디")&&T.AUTH.reset.step==="id","E3 형식 오류 "+JSON.stringify(id)+" → 요청 없음"); }
  setv(T,"acctId"," Alice_1 "); await T.acct.acctSubmit();
  const rb=posts().length===1&&body(posts()[0]);
  ok(rb&&posts()[0].url==="/api/auth/password-reset/request"&&rb.userId===ID&&Object.keys(rb).join()==="userId","E4 코드 요청 = {userId(소문자·공백 제거)} 만");
  ok(T.AUTH.reset.step==="code"&&/id="acctCode"/.test(panel(T))&&/one-time-code/.test(panel(T))&&/inputmode="numeric"/.test(panel(T))&&!/id="acctPw"/.test(panel(T))&&panel(T).includes(ID),
    "E5 202 → 2단계: 입력한 아이디 안내·6자리 칸(one-time-code) · 새 비밀번호 칸은 아직 없음");
  ok(/등록한 이메일로 6자리 인증 코드를 보냈습니다/.test(panel(T))&&!panel(T).includes("@")&&/>아이디 다시 입력</.test(panel(T)),"E6 202 → 등록된 이메일로 보냈다는 안내 · 실제 이메일 주소는 보이지 않는다");
  await T.acct.acctResetSend(true);
  ok(sent===1&&/초 뒤에/.test(msg(T)),"E7 60초 안 재발송 → 요청 없이 남은 시간 안내");
  T.AUTH.reset.sentAt-=60001; await T.acct.acctResetSend(true);
  const rs=body(posts().filter(c=>/request/.test(c.url)).pop());
  ok(sent===2&&T.AUTH.reset.step==="code"&&/새 코드를 보냈습니다/.test(msg(T))&&rs.userId===ID&&Object.keys(rs).join()==="userId","E8 60초 뒤 재발송 = 같은 {userId} → 새 코드 안내");
  setv(T,"acctCode","12a45"); await T.acct.acctSubmit();
  ok(!posts().some(c=>/verify/.test(c.url))&&/6자리/.test(msg(T)),"E9 6자리 숫자가 아니면 확인 요청 없음");
  setv(T,"acctCode","000000"); await T.acct.acctSubmit();
  ok(T.AUTH.reset.step==="code"&&!/id="acctPw"/.test(panel(T))&&/올바르지 않거나 만료/.test(msg(T))&&T.byId("acctCode").value==="","E10 틀린·만료 코드(401 E_CODE_INVALID) → 2단계 유지·안내·코드 칸 비움 · 새 비밀번호 칸 없음");
  setv(T,"acctCode"," 482 913 "); await T.acct.acctSubmit();
  const vb=body(posts().filter(c=>/verify/.test(c.url)).pop());
  ok(vb.code===OTP&&vb.userId===ID&&Object.keys(vb).sort().join()==="code,userId","E11 코드 확인 = {userId, code}(공백 제거)");
  ok(T.AUTH.reset.step==="pw"&&/id="acctPw"/.test(panel(T))&&/id="acctPw2"/.test(panel(T))&&!/id="acctCode"/.test(panel(T)),"E12 확인 200 뒤에만 3단계(새 비밀번호) 표시");
  setv(T,"acctPw","newpass1"); setv(T,"acctPw2","newpass2"); await T.acct.acctSubmit();
  ok(!posts().some(c=>/complete/.test(c.url))&&/일치/.test(msg(T)),"E13 새 비밀번호 확인 불일치 → 요청 없음");
  setv(T,"acctPw","oldpass123"); setv(T,"acctPw2","oldpass123"); await T.acct.acctSubmit();
  ok(msg(T)==="직전 비밀번호와 같습니다"&&T.AUTH.reset.step==="pw"&&T.AUTH.reset.token===GRANT&&T.byId("acctPw").value==="","E14 직전 비밀번호(409 E_SAME_PASSWORD) → 정확한 문구 '직전 비밀번호와 같습니다'·허가 유지·칸 비움");
  setv(T,"acctPw","brandnew12"); setv(T,"acctPw2","brandnew12"); await T.acct.acctSubmit();
  const cb=body(posts().filter(c=>/complete/.test(c.url)).pop());
  ok(cb.resetToken===GRANT&&cb.newPassword==="brandnew12"&&Object.keys(cb).sort().join()==="newPassword,resetToken","E15 같은 허가로 다른 비밀번호 재시도 = {resetToken,newPassword}");
  ok(T.AUTH.state==="anon"&&T.AUTH.reset===null&&T.AUTH.view==="login"&&/id="acctId"/.test(panel(T))&&/새 비밀번호로 로그인/.test(msg(T))&&!posts().some(c=>/login/.test(c.url)),
    "E16 성공 → 자동 로그인 없이 로그인 화면 + 안내");
  const hay=[JSON.stringify(H.storageTrace(T.storage)),JSON.stringify(T.storage.st),JSON.stringify(T.sessionStorage.st),T.cookieWrites.join("|"),
    toasts(T),T.byId("log").innerHTML,T.location.href,calls.map(c=>c.url).join("|"),panel(T)].join("\u0000");
  ok(!hay.includes(OTP)&&!hay.includes(GRANT)&&!hay.includes("brandnew12")&&!hay.includes("oldpass123"),"E17 코드·허가·비밀번호는 저장소·쿠키·토스트·로그·URL·화면 어디에도 없다");
  const kept=[JSON.stringify(T.storage.st),JSON.stringify(T.sessionStorage.st),T.cookieWrites.join("|"),T.location.href].join("\u0000");
  ok(!kept.includes(ID),"E17b 재설정 대상 아이디는 메모리에만 — 저장소·쿠키·주소에 없다");
  ok(JSON.parse(T.storage.getItem("dd_acct")).u===null,"E18 재설정 성공은 같은 프로필의 다른 탭에 '로그인 끝남'을 알린다(서버가 모든 세션을 끊었다)");

  // 허가 만료·이미 사용 → 1단계부터(아이디 유지)
  const X=await boot(HTTPS,Object.assign({},RT,{"POST /api/auth/password-reset/complete":[401,{error:"E_RESET_INVALID"}]}));
  X.acct.acctView("reset"); setv(X,"acctId",ID); await X.acct.acctSubmit(); setv(X,"acctCode",OTP); await X.acct.acctSubmit();
  setv(X,"acctPw","brandnew12"); setv(X,"acctPw2","brandnew12"); await X.acct.acctSubmit();
  ok(X.AUTH.reset.step==="id"&&X.AUTH.reset.token===null&&X.byId("acctId").value===ID&&/인증 코드를 다시/.test(msg(X))&&!/id="acctPw"/.test(panel(X)),"E19 허가 무효(401 E_RESET_INVALID) → 1단계·아이디 유지·허가 폐기");
  // 1단계에 머무는 요청 실패 — 없는 아이디·이메일 미등록·메일 불가·잦은 요청·202 가 아닌 성공 코드. 코드 칸도 "보냈다"는 안내도 없다
  const firstStep=async(res,name,check)=>{
    const F=await boot(HTTPS,Object.assign({},ANON,{"POST /api/auth/password-reset/request":res}));
    F.acct.acctView("reset"); setv(F,"acctId",ID); await F.acct.acctSubmit();
    ok(F.AUTH.reset.step==="id"&&F.AUTH.reset.userId===""&&!/id="acctCode"/.test(panel(F))&&!/보냈습니다/.test(panel(F)+msg(F))&&F.AUTH.busy===false&&check(msg(F),panel(F)),name);
  };
  await firstStep([404,{error:"E_ID_NOT_FOUND"}],"E47 404 E_ID_NOT_FOUND → 정확한 문구 '존재하지 않는 아이디입니다'·1단계 유지·코드 칸 없음",m=>m==="존재하지 않는 아이디입니다");
  await firstStep([409,{error:"E_EMAIL_REQUIRED"}],"E48 409 E_EMAIL_REQUIRED → 등록 이메일 없음 안내(주소 없음)·1단계 유지",(m,p)=>/등록된 이메일이 없어/.test(m)&&!(m+p).includes("@"));
  await firstStep([200,{ok:true}],"E49 202 가 아닌 200 → 코드 단계로 가지 않는다(202 만 진행)",()=>true);
  await firstStep([503,{error:"E_MAIL_UNAVAILABLE"}],"E20 503 E_MAIL_UNAVAILABLE(발송 실패) → 1단계 유지·코드 칸 없음·내부 설정 문구 없음",
    (m,p)=>/인증 메일을 보낼 수 없어/.test(m)&&!/SMTP|smtp|nodemailer|메일 설정|서버 설정|환경 ?변수|DD_|MAIL_/i.test(m+p));
  await firstStep([429,{error:"E_RATE_LIMITED"}],"E21 429 → 1단계 유지·잠시 후 안내",m=>/너무 잦습니다/.test(m));

  // 늦은 응답 — 화면을 떠난 뒤 온 코드 요청·확인 응답은 화면을 바꾸지 않는다
  const d1=later(), d2=later();
  const L=await boot(HTTPS,Object.assign({},RT,{"POST /api/auth/password-reset/request":()=>d1.p.then(()=>[202,{ok:true}])}));
  L.acct.acctView("reset"); setv(L,"acctId",ID); const p1=L.acct.acctSubmit(); await tick();
  L.acct.acctView("login"); d1.release(); await p1; await tick();
  ok(L.AUTH.view==="login"&&L.AUTH.reset===null&&!/id="acctCode"/.test(panel(L))&&L.AUTH.busy===false,"E22 코드 요청 대기 중 로그인 화면으로 → 늦은 202 가 2단계를 띄우지 않는다");
  routes["POST /api/auth/password-reset/request"]=[202,{ok:true}];
  routes["POST /api/auth/password-reset/verify"]=()=>d2.p.then(()=>[200,{resetToken:GRANT}]);
  L.acct.acctView("reset"); setv(L,"acctId",ID); await L.acct.acctSubmit(); setv(L,"acctCode",OTP); const p2=L.acct.acctSubmit(); await tick();
  L.acct.acctView("reset"); d2.release(); await p2; await tick();
  ok(L.AUTH.reset.step==="id"&&L.AUTH.reset.token===null&&!/id="acctPw"/.test(panel(L)),"E23 코드 확인 대기 중 처음부터 → 늦은 200 허가를 받지 않고 새 비밀번호 칸도 없음");
  const n=posts().length; setv(L,"acctId",ID); await L.acct.acctSubmit();
  ok(posts().length===n+1,"E24 늦은 응답을 버린 뒤에도 버튼이 잠겨 있지 않다(다시 요청 가능)");
}
{
  // 같은 이메일을 쓰는 두 계정 — 대상은 아이디로만 갈린다. 서버 흉내: 아이디마다 다른 코드·허가, 확인은 {userId,code} 짝이 맞아야 한다
  const CODES={alice_1:"111111",bob_22:"222222"}, GR={alice_1:"A".repeat(43),bob_22:"B".repeat(43)}, dv=later(), dr=later();
  let holdV=null, holdR=null;
  const T=await boot(HTTPS,Object.assign({},ANON,{
    "POST /api/auth/password-reset/request":()=>holdR?holdR.p.then(()=>[202,{ok:true}]):[202,{ok:true}],
    "POST /api/auth/password-reset/verify":i=>{ const b=JSON.parse(i.body), r=CODES[b.userId]===b.code?[200,{resetToken:GR[b.userId]}]:[401,{error:"E_CODE_INVALID"}];
      return holdV?holdV.p.then(()=>r):r; }}));
  const toCode=async id=>{ T.acct.acctView("reset"); setv(T,"acctId",id); await T.acct.acctSubmit(); };
  await toCode("alice_1"); const pa=panel(T); await toCode("bob_22");
  const reqs=posts().filter(c=>/request/.test(c.url)).map(body);
  ok(reqs.length===2&&reqs[0].userId==="alice_1"&&reqs[1].userId==="bob_22"&&reqs.every(b=>Object.keys(b).join()==="userId"),"E40 같은 이메일 두 계정 → 코드 요청이 아이디로 갈린다(이메일을 보내지 않음)");
  ok(pa.replace(/alice_1/g,"X")===panel(T).replace(/bob_22/g,"X"),"E41 대상이 달라도 같은 안내(입력값만 다름 — 가입 여부를 드러내지 않음)");
  setv(T,"acctCode",CODES.alice_1); await T.acct.acctSubmit();
  ok(T.AUTH.reset.step==="code"&&T.AUTH.reset.token===null&&/올바르지 않거나/.test(msg(T)),"E42 bob 대상에 alice 코드 → 거절(코드가 대상 사이에 섞이지 않음)");
  setv(T,"acctCode",CODES.bob_22); await T.acct.acctSubmit();
  ok(T.AUTH.reset.step==="pw"&&T.AUTH.reset.token===GR.bob_22&&body(posts().filter(c=>/verify/.test(c.url)).pop()).userId==="bob_22","E43 bob 코드 → bob 허가");
  // 확인 대기 중 [다시 입력]으로 대상을 바꾸면 옛 대상의 늦은 200 허가는 버린다
  await toCode("alice_1"); setv(T,"acctCode",CODES.alice_1); holdV=dv; const pv=T.acct.acctSubmit(); await tick();
  holdV=null; await toCode("bob_22");
  dv.release(); await pv; await tick();
  ok(T.AUTH.reset.step==="code"&&T.AUTH.reset.userId==="bob_22"&&T.AUTH.reset.token===null&&!/id="acctPw"/.test(panel(T))&&T.AUTH.busy===false,"E44 대상 변경 뒤 옛 대상(alice)의 늦은 200 → 허가·새 비밀번호 칸 없음, 새 대상(bob) 2단계 유지");
  // 재발송 대기 중 [다시 입력] → 늦은 202 가 새 1단계를 바꾸지 않는다
  T.AUTH.reset.sentAt-=60001; holdR=dr; const pr=T.acct.acctResetSend(true); await tick();
  T.acct.acctView("reset"); holdR=null; dr.release(); await pr; await tick();
  ok(T.AUTH.reset.step==="id"&&T.AUTH.reset.userId===""&&T.AUTH.busy===false&&/id="acctId"/.test(panel(T)),"E45 재발송 대기 중 [다시 입력] → 늦은 202 무시·1단계·버튼 잠금 없음");
  // 허가를 받은 뒤 화면을 떠나면 허가·대상을 버린다
  await toCode("bob_22"); setv(T,"acctCode",CODES.bob_22); await T.acct.acctSubmit();
  const had=T.AUTH.reset.token===GR.bob_22; T.acct.acctView("login");
  ok(had&&T.AUTH.reset===null,"E46 허가 뒤 화면 이동 → 허가·대상 폐기");
}
{
  // 재발송 실패(Saturn MEDIUM) — 서버는 가장 최근 요청의 코드만 유효하고 새 발송이 실패하면 옛 코드도 지운다. 429(간격·일일 상한)는 옛 코드가 살아 있다
  let reqRes=[202,{ok:true}], hold=null;
  const T=await boot(HTTPS,Object.assign({},ANON,{
    "POST /api/auth/password-reset/request":()=>{ const r=reqRes; return hold?hold.p.then(()=>r):r; },
    "POST /api/auth/password-reset/verify":i=>JSON.parse(i.body).code===OTP?[200,{resetToken:GRANT}]:[401,{error:"E_CODE_INVALID"}]}));
  const toCode=async id=>{ reqRes=[202,{ok:true}]; T.acct.acctView("reset"); setv(T,"acctId",id); await T.acct.acctSubmit(); T.AUTH.reset.sentAt-=60001; };
  await toCode("alice_1"); reqRes=[503,{error:"E_MAIL_UNAVAILABLE"}]; await T.acct.acctResetSend(true);
  ok(T.AUTH.reset.step==="id"&&T.AUTH.reset.userId===""&&T.AUTH.reset.token===null&&!/id="acctCode"/.test(panel(T))&&T.byId("acctId").value==="alice_1"
    &&/인증 메일을 보낼 수 없어/.test(msg(T))&&!/보냈습니다/.test(panel(T)+msg(T))&&T.AUTH.busy===false,"E50 재발송 503 E_MAIL_UNAVAILABLE → 옛 코드 화면 폐기·1단계·아이디 채움·메일 불가 안내(보냈다고 하지 않음)");
  reqRes=[202,{ok:true}]; await T.acct.acctSubmit();
  ok(T.AUTH.reset.step==="code"&&body(posts().filter(c=>/request/.test(c.url)).pop()).userId==="alice_1","E50b 1단계에서 다시 [인증 코드 받기] → 새 요청으로 코드 단계");
  T.AUTH.reset.sentAt-=60001; reqRes=[429,{error:"E_RATE_LIMITED"}]; await T.acct.acctResetSend(true);
  ok(T.AUTH.reset.step==="code"&&/id="acctCode"/.test(panel(T))&&/너무 잦습니다/.test(msg(T)),"E51 재발송 429 → 코드 화면 유지(옛 코드 유효)");
  setv(T,"acctCode",OTP); await T.acct.acctSubmit();
  ok(T.AUTH.reset.step==="pw"&&T.AUTH.reset.token===GRANT,"E51b 429 뒤 옛 코드로 확인 → 허가");
  // 늦은 재발송 실패 — 기다리는 동안 [아이디 다시 입력]으로 새 흐름을 시작했으면 늦은 503 은 새 흐름을 되돌리거나 옛 흐름을 살리지 않는다
  await toCode("alice_1"); hold=later(); reqRes=[503,{error:"E_MAIL_UNAVAILABLE"}]; const pr=T.acct.acctResetSend(true); await tick();
  const h=hold; hold=null; await toCode("bob_22"); h.release(); await pr; await tick();
  ok(T.AUTH.reset.step==="code"&&T.AUTH.reset.userId==="bob_22"&&/id="acctCode"/.test(panel(T))&&!/인증 메일을 보낼 수 없어/.test(msg(T))&&T.AUTH.busy===false,"E52 늦은 재발송 503 → 새 대상(bob) 코드 단계 그대로·안내 없음");
}
{
  // 이메일 없는 기존 계정 — 선택 등록, 입장은 막지 않는다
  const LEG={"GET /api/auth/session":[200,{userId:"alice_1",nickname:"앨리스",hasEmail:false}]};
  const T=await boot(HTTPS,Object.assign({},LEG,{"POST /api/auth/email":i=>{ const b=JSON.parse(i.body); return b.password!=="password1"?[401,{error:"E_AUTH_FAILED"}]:[200,{ok:true,hasEmail:true}]; }}));
  ok(T.AUTH.user.hasEmail===false&&/이메일 등록/.test(panel(T)),"E25 이메일 없는 기존 계정 → [이메일 등록] 안내");
  T.uiStart(); ok(T.UI.entered===true,"E26 이메일이 없어도 입장은 막지 않는다(강제 이전 없음)");
  T.UI.entered=false; T.acct.acctView("email");
  ok(/id="acctEmail"/.test(panel(T))&&/current-password/.test(panel(T)),"E27 등록 폼 — 이메일 + 현재 비밀번호");
  setv(T,"acctEmail",MAIL); setv(T,"acctPw","wrong-pass"); await T.acct.acctEmailSubmit();
  ok(msg(T)==="비밀번호가 올바르지 않습니다."&&T.byId("acctPw").value===""&&T.AUTH.user.hasEmail===false,"E28 틀린 비밀번호 → 안내·칸 비움");
  const n0=calls.length; setv(T,"acctEmail",MAIL); setv(T,"acctPw","password1"); await T.acct.acctEmailSubmit(); // MAIL 은 다른 계정(D8·E40)도 쓰는 주소
  const eb=body(posts().pop());
  ok(calls.length===n0+1&&eb.email===MAIL&&eb.password==="password1"&&T.AUTH.user.hasEmail===true&&!/이메일 등록/.test(panel(T))&&/로그아웃/.test(panel(T)),"E30 다른 계정과 같은 이메일 등록 성공(중복 확인 요청 없음) → 안내 사라짐");
  const H2=await boot(HTTPS,IN); ok(!/이메일 등록/.test(panel(H2)),"E31 이메일 있는 계정에는 등록 안내 없음");
}
{
  const L=await boot(HTTPS,Object.assign({},IN,{"POST /api/auth/logout":[200,{ok:true}]}),{[SK]:rec()});
  L.NET.ws&&openWs(L.NET.ws); // 로드 재접속 소켓(G6) — 로그아웃 경로만 본다
  await L.acct.acctLogout();
  ok(L.AUTH.state==="anon"&&seat(L)===null&&posts().some(c=>c.url==="/api/auth/logout")&&JSON.parse(L.storage.getItem("dd_acct")).u===null,"E32 로그아웃 → anon + 이 계정 좌석 기록 삭제 + 다른 탭에 알림");
  const F=await boot(HTTPS,Object.assign({},IN,{"POST /api/auth/logout":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]}));
  await F.acct.acctLogout();
  ok(F.AUTH.state==="in"&&/로그아웃하지 못했습니다/.test(msg(F)),"E33 로그아웃 실패는 성공으로 보이지 않는다");
}

/* ===== F. 비보안 원격 HTTP ===== */
{
  const T=await boot("http://192.168.0.5:8081/",Object.assign({},ANON,{"POST /api/auth/login":[200,ALICE]}));
  ok(!/type="password"/.test(panel(T))&&/HTTPS/.test(panel(T)),"F1 원격 HTTP — 비밀번호 칸 없음 + HTTPS 안내");
  setv(T,"acctId","alice_1"); setv(T,"acctPw","password1"); await T.acct.acctSubmit();
  ok(posts().length===0&&T.AUTH.state==="anon","F2 원격 HTTP — 비밀번호 요청을 보내지 않는다");
  const Lb=await boot("http://127.0.0.1:8081/",ANON);
  ok(/type="password"/.test(panel(Lb)),"F3 루프백(이 PC)은 로그인 가능 — 서버 경계와 같다");
}

/* ===== G. 좌석 재접속 기록 (계정별 키) ===== */
{
  let sessionOk=true;
  const T=await boot(HTTPS,{"GET /api/auth/session":()=>sessionOk?[200,ALICE]:[401,{error:"E_NO_SESSION"}]});
  T.uiStart(); calls.length=0;
  T.netCreatePublicRoom();
  ok(rs(T).length===0&&calls.filter(c=>!/^\/api\/profile/.test(c.url)).length===1&&calls[0].url==="/api/auth/session","G1 방 생성 — 소켓보다 세션 확인이 먼저");
  await tick();
  const ws=rs(T)[0];
  ok(ws&&ws.protocols[1].startsWith("cp-"),"G2 세션 확인 뒤 생성 소켓");
  openWs(ws); frame(ws,{type:"room_opened",roomId:7,seat:0,seatToken:TOK,tokenGen:0,revision:0,economy:false});
  const r=JSON.parse(seat(T)||"null");
  ok(r&&r.u==="alice_1"&&r.roomId===7&&r.seatToken===TOK&&r.epoch===EPOCH&&Object.keys(r).sort().join()==="epoch,roomId,seat,seatToken,tokenGen,u"&&T.storage.getItem("dd_seat")===null,
    "G3 좌석 기록은 계정별 키(dd_seat.<아이디>) — 좌석 정보와 아이디만");
  T.netLeaveRoom();
  ok(seat(T)===null,"G4 나가기 → 기록 삭제");
  T.UI.entered=true; sessionOk=false; const n=rs(T).length; T.netJoinPublicRoom("9"); await tick();
  ok(rs(T).slice(n).every(w=>!/^p-/.test(w.protocols[1]))&&T.AUTH.state==="anon"&&T.UI.entered===false&&/만료/.test(toasts(T)),"G5 세션 만료 → 참가 소켓 없이 로그인 화면");

  const R=await boot(HTTPS,IN,{[SK]:rec()});
  const rw=rs(R)[0];
  ok(rw&&rw.protocols[1]==="r-"+EPOCH+"."+TOK&&R.NET.resuming===true&&R.UI.entered===true,"G6 로드 시 저장된 좌석으로 재접속(r-<epoch>.<token>)");
  const TOK2="B".repeat(22);
  openWs(rw); frame(rw,{type:"room_resumed",roomId:7,seat:0,seatToken:TOK2,tokenGen:1,revision:3,economy:false});
  ok(JSON.parse(seat(R)).seatToken===TOK2&&JSON.parse(seat(R)).tokenGen===1,"G7 재개 성공 → 회전한 토큰으로 기록 갱신");
  const TOK3="C".repeat(22); R.storage.setItem(SK,rec({seatToken:TOK3,tokenGen:2}));
  const before=rs(R).length;
  frame(rw,{type:"error",code:"E_SUPERSEDED"});
  ok(R.NET.roomId===null&&R.NET.resuming===false&&/다른 창에서 이 경기에 다시 접속/.test(toasts(R)),"G8 밀려난 탭(같은 계정 마지막 탭 규칙 유지) → 로비 안내");
  ok(rs(R).slice(before).every(w=>!/^r-/.test(w.protocols[1]))&&JSON.parse(seat(R)).seatToken===TOK3,"G9 되찾기 재접속 없음 + 다른 탭의 기록 보존");

  const F=await boot(HTTPS,IN,{[SK]:rec()});
  frame(rs(F)[0],{type:"error",code:"E_ROOM_NOT_FOUND"});
  ok(seat(F)===null&&F.NET.roomId===null,"G10 재접속 실패(방 없음·유예 만료) → 기록 삭제");
  const bobRec=rec({u:"bob_22"});
  const B=await boot(HTTPS,IN,{"dd_seat.bob_22":bobRec});
  ok(rs(B).length===0&&seat(B,"dd_seat.bob_22")===bobRec,"G11 다른 계정의 기록 → 재접속하지 않고 지우지도 않는다");
  const X=await boot(HTTPS,IN,{[SK]:rec({u:"bob_22"})});
  ok(rs(X).length===0,"G11b 키와 기록 속 아이디가 다르면(조작) 재접속하지 않는다");
  const A=await boot(HTTPS,ANON,{[SK]:rec()});
  ok(rs(A).length===0,"G12 로그인 안 됨 → 재접속하지 않는다");
  const M=await boot(HTTPS,IN,{[SK]:rec({seatToken:"bad token"})});
  ok(rs(M).length===0&&seat(M)===null,"G13 형식이 틀린 기록 → 재접속하지 않고 삭제");
  const O=await boot("file:///C:/Digit-Duel/demo/index.html",{},{[SK]:rec()});
  ok(rs(O).length===0,"G14 계정 없는 경로는 기록을 쓰지도 읽지도 않는다");
}

/* ===== I. 로그아웃·세션 종료 — 열린 방 소켓 정리 ===== */
async function inRoom(extra,T0){
  const T=T0||await boot(HTTPS,Object.assign({},IN,extra));
  T.uiStart(); T.netCreatePublicRoom(); await tick();
  const ws=openWs(rs(T)[rs(T).length-1]); frame(ws,{type:"room_opened",roomId:7,seat:0,seatToken:TOK,tokenGen:0,revision:0,economy:false});
  return {T,ws};
}
{
  const {T,ws}=await inRoom({"POST /api/auth/logout":[200,{ok:true}]});
  ok(T.NET.roomId===7&&seat(T)!==null,"I0 방 안 + 좌석 기록 있음");
  const n=rs(T).length;
  await T.acct.acctLogout();
  ok(ws.closed===true&&T.NET.ws===null&&T.NET.roomId===null&&seat(T)===null,"I1 로그아웃 성공 → 방 소켓 닫힘·좌석 기록 삭제");
  ok(T.AUTH.state==="anon"&&T.UI.entered===false&&T.NET.resuming===false&&rs(T).length===n,"I2 로그인 화면으로 · 재접속 소켓 없음");
}
{
  const {T,ws}=await inRoom({"POST /api/auth/logout":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]});
  await T.acct.acctLogout();
  ok(T.AUTH.state==="in"&&ws.closed===false&&T.NET.ws===ws&&T.NET.roomId===7&&seat(T)!==null,"I3 로그아웃 실패 → 로그인·방 소켓·좌석 기록 그대로");
  const {T:T2,ws:ws2}=await inRoom({});
  await T2.acct.acctLogout();
  ok(T2.AUTH.state==="in"&&ws2.closed===false&&T2.NET.roomId===7,"I4 로그아웃 연결 실패도 성공으로 보지 않는다");
}
{
  const {T,ws}=await inRoom({});
  const n=rs(T).length;
  routes=Object.assign({},ANON); // 서버가 끝낸 세션 — 이후 세션 확인은 401
  frame(ws,{type:"error",code:"E_SESSION_ENDED"}); await tick();
  ok(T.AUTH.state==="anon"&&ws.closed===true&&T.NET.ws===null&&T.NET.roomId===null&&T.NET.resuming===false&&rs(T).length===n,"I5 서버 E_SESSION_ENDED → 로그인 화면·방 소켓 닫힘·자동 재접속 없음");
  ok(JSON.parse(seat(T)||"null")&&JSON.parse(seat(T)).seatToken===TOK,"I6 비자발 세션 종료는 좌석 기록을 남긴다(#237 60초 유예 재접속용)");
  ws.onclose&&ws.onclose({code:4003}); ok(rs(T).length===n,"I7 뒤이은 close 4003 도 재접속을 부르지 않는다");
  routes=Object.assign({},ANON,{"POST /api/auth/login":[200,ALICE]});
  setv(T,"acctId","alice_1"); setv(T,"acctPw","password1"); await T.acct.acctSubmit();
  const rw=rs(T)[n];
  ok(T.AUTH.state==="in"&&rw&&rw.protocols[1]==="r-"+EPOCH+"."+TOK&&T.NET.resuming===true,"I8 이 브라우저에서 같은 계정으로 다시 로그인 → 남은 좌석으로 재접속");
}
{
  const {T,ws}=await inRoom({});
  const n=rs(T).length;
  routes=Object.assign({},ANON);
  frame(ws,{type:"error",code:"E_SESSION_ENDED",reason:"login_replaced"}); await tick();
  ok(T.AUTH.state==="anon"&&ws.closed===true&&T.NET.resuming===false&&rs(T).length===n&&/새로 로그인해 이 창은 자동으로 로그아웃/.test(toasts(T)),
    "I9 E_SESSION_ENDED reason=login_replaced(다른 기기·브라우저의 새 로그인) → 명확한 자동 로그아웃 안내·재접속 없음");
  frame(ws,{type:"error",code:"E_SESSION_ENDED",reason:"login_replaced"}); await tick();
  ok((toasts(T).match(/자동으로 로그아웃/g)||[]).length===1,"I10 닫힌 소켓의 늦은 두 번째 알림은 무시");
}
{
  const {T,ws}=await inRoom({});
  const n=rs(T).length;
  routes=Object.assign({},ANON);
  ws.readyState=3; ws.onclose({code:4003}); await tick(); // 오류 프레임 없이 close 4003 만 온 경우
  ok(T.AUTH.state==="anon"&&T.NET.ws===null&&T.NET.roomId===null&&T.NET.resuming===false&&rs(T).length===n&&seat(T)!==null&&/로그아웃되었거나/.test(toasts(T)),"I11 close 4003 단독 → 일반 안내·재접속 없음·좌석 기록 유지");
  const C=await boot(HTTPS,ANON); C.storage.setItem(SK,rec());
  setv(C,"acctId","bob_22"); setv(C,"acctPw","password1"); routes=Object.assign({},ANON,{"POST /api/auth/login":[200,BOB]}); await C.acct.acctSubmit();
  ok(C.AUTH.user.userId==="bob_22"&&seat(C)===rec()&&rs(C).length===0,"I12 다른 계정으로 로그인 → 앨리스 좌석 기록을 지우지도 재접속하지도 않는다");
}
{
  // 재접속 도중 세션이 사라졌다(다른 곳 새 로그인) — 업그레이드 401 로 열리지 않는 소켓을 60초 헛재시도하지 않는다
  const {T,ws}=await inRoom({});
  ws.readyState=3; ws.onclose({code:1006});
  const rw=rs(T)[rs(T).length-1];
  ok(T.NET.resuming===true&&/^r-/.test(rw.protocols[1]),"I13 단절 → 재접속 시도");
  routes=Object.assign({},ANON);
  rw.readyState=3; rw.onclose({code:1006}); await tick();
  ok(T.AUTH.state==="anon"&&T.NET.resuming===false&&T.NET.roomId===null&&/로그아웃되었거나/.test(toasts(T)),"I14 열리지 못한 재접속 소켓 → 세션 확인 401 → 재시도 중단·로그인 화면");
  const {T:U,ws:w2}=await inRoom({});
  w2.readyState=3; w2.onclose({code:1006});
  const rw2=rs(U)[rs(U).length-1]; routes["GET /api/auth/session"]=()=>{ throw new TypeError("offline"); };
  rw2.readyState=3; rw2.onclose({code:1006}); await tick();
  ok(U.AUTH.state==="in"&&U.NET.resuming===true,"I15 네트워크 단절(확인도 실패)이면 로그인 유지·유예 안 재시도 계속");
}

/* ===== J. 닉네임 문자 정책 ===== */
{
  const T=await boot(HTTPS,Object.assign({},ANON,{"POST /api/auth/signup":i=>[201,{userId:"new_user",nickname:JSON.parse(i.body).nickname,hasEmail:true}]}));
  const tryNick=async nick=>{ T.acct.acctView("signup"); const n=posts().length;
    signupFill(T,{nick}); await T.acct.acctSubmit(); const sent=posts().length>n; if(sent) T.AUTH.state="anon"; return sent; };
  for(const nick of ["가나","ab","A_1","Player_12","가".repeat(12),"a".repeat(12),"한글Eng_09"])
    ok(await tryNick(nick),"J1 허용 닉네임 보냄: "+nick);
  for(const [nick,why] of [["가","1자"],["a".repeat(13),"13자"],["ㄱㄴㄷ","자음만"],["ㅏㅑ","모음만"],["가ㅏ","완성형+모음"],["\u1100\u1100\u1100","조합 안 되는 첫소리 자모"],["日本語","한자"],["テスト","가나"],
    ["Ωmega","그리스"],["Привет","키릴"],["ａｂｃ","전각 영문"],["١٢٣","아랍 숫자"],["café","라틴 확장"],["a b","공백"],["a-b","하이픈"],["😀😀","이모지"]])
    ok(!(await tryNick(nick))&&/완성형/.test(msg(T)),"J2 거부("+why+"): 요청 없이 안내");
}

/* ===== K. 늦게 도착한 계정 응답 ===== */
async function lateCase(label,between,entry){
  const d=later();
  const T=await boot(HTTPS,Object.assign({},IN,{"POST /api/auth/logout":[200,{ok:true}],"POST /api/auth/login":[200,BOB]}));
  T.uiStart();
  routes["GET /api/auth/session"]=()=>d.p.then(()=>[200,ALICE]); // 입장 전 세션 확인이 늦게 온다
  entry(T);
  await tick(); ok(rs(T).length===0&&T.AUTH.state==="in","K0 "+label+" — 세션 확인 대기 중(소켓 없음)");
  await between(T);
  d.release(); await tick();
  return T;
}
{
  const T=await lateCase("로그아웃",async T=>{ await T.acct.acctLogout(); },T=>T.netCreatePublicRoom());
  ok(T.AUTH.state==="anon"&&T.AUTH.user===null&&rs(T).length===0&&T.S.phase==="menu"&&T.UI.entered===false,"K1 로그아웃 성공 뒤 도착한 GET session 200 → 익명 유지·방 소켓 0·게임 없음");
}
{
  const T=await lateCase("서버 세션 종료",async T=>{ routes["GET /api/auth/session"]=[401,{error:"E_NO_SESSION"}]; T.acct.acctEndSession("ended"); await tick(); },T=>T.netJoinPublicRoom("3"));
  ok(T.AUTH.state==="anon"&&T.AUTH.user===null&&rs(T).length===0&&T.UI.entered===false,"K2 세션 종료(E_SESSION_ENDED·4003 공통 경로) 뒤 늦은 200 → 익명 유지·참가 소켓 0");
}
{
  const T=await lateCase("계정 전환",async T=>{ await T.acct.acctLogout(); setv(T,"acctId","bob_22"); setv(T,"acctPw","password1"); await T.acct.acctSubmit(); },T=>T.netCreatePublicRoom());
  ok(T.AUTH.state==="in"&&T.AUTH.user.userId==="bob_22"&&rs(T).length===0,"K3 로그아웃→다른 계정 로그인 뒤 늦은 alice 200 → bob 유지·옛 입장 실행 안 함");
}
{
  const d=later();
  const T=await boot(HTTPS,{"GET /api/auth/session":[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]});
  routes["GET /api/auth/session"]=()=>d.p.then(()=>[200,ALICE]);
  const pending=T.acct.acctCheck(); // [다시 시도] — 응답 전에 세션이 끝났다
  T.AUTH.state="in"; T.AUTH.user={userId:"alice_1",nickname:"앨리스",hasEmail:true}; T.acct.acctEndSession("ended");
  d.release(); await pending; await tick();
  ok(rs(T).length===0&&T.NET.resuming===false,"K4 계정 확인(다시 시도) 도중 세션 종료 → 늦은 200 이 재접속·입장을 일으키지 않는다");
}
{
  const T=await boot(HTTPS,IN); T.uiStart();
  routes["GET /api/auth/session"]=[200,BOB]; // 다른 탭이 같은 브라우저 쿠키를 bob 으로 바꿨다(알림 이벤트를 놓친 경우)
  T.netCreatePublicRoom(); await tick();
  ok(T.AUTH.user.userId==="bob_22"&&rs(T).length===0&&/다른 계정/.test(toasts(T)),"K5 입장 직전 확인이 다른 계정을 돌려주면 신원만 갱신하고 옛 입장은 잇지 않는다");
}

/* ===== L. 같은 브라우저 프로필의 두 탭 (쿠키 하나·저장소 하나) ===== */
{
  const profile={cookie:null}, users={alice_1:ALICE,bob_22:BOB};
  const shared=H.mkStorage({tutorialSeen:"1"});
  const PROFILE_RT={
    "GET /api/auth/session":()=>profile.cookie?[200,users[profile.cookie]]:[401,{error:"E_NO_SESSION"}],
    "POST /api/auth/login":i=>{ const id=JSON.parse(i.body).userId; profile.cookie=id; return [200,users[id]]; },
    "POST /api/auth/logout":()=>{ profile.cookie=null; return [200,{ok:true}]; }};
  const storageEvent=(T)=>T.acct.acctOnStorage({key:"dd_acct",newValue:shared.getItem("dd_acct")}); // 브라우저가 다른 탭에만 보내는 storage 이벤트
  const t1=await boot(HTTPS,PROFILE_RT,null,shared);
  const t2=H.load(htmlPath,{href:HTTPS,fetch:global.fetch,storage:shared}); await tick();
  ok(t1.AUTH.state==="anon"&&t2.AUTH.state==="anon","L0 두 탭 모두 로그인 전(같은 프로필)");
  t1.activate(); setv(t1,"acctId","alice_1"); setv(t1,"acctPw","password1"); await t1.acct.acctSubmit();
  storageEvent(t2); await tick();
  ok(t2.AUTH.state==="in"&&t2.AUTH.user.userId==="alice_1"&&rs(t2).length===0,"L1 탭1 로그인 알림 → 탭2 는 프로필의 로그인(alice)을 그대로 보인다(재접속·입장 없음)");
  t2.activate(); t2.AUTH.state="anon"; t2.AUTH.user=null; // CJ 재현 순서: 탭2 는 탭1 로그인 전에 열려 로그인 폼 그대로다(알림이 없던 이전 빌드)
  t1.activate(); const {ws:w1}=await inRoom({},t1);
  ok(t1.NET.roomId===7&&seat(t1)!==null,"L2 탭1(alice) 호스트 좌석 + dd_seat.alice_1");
  const w1n=rs(t1).length;
  t2.activate(); setv(t2,"acctId","bob_22"); setv(t2,"acctPw","password1"); await t2.acct.acctSubmit();
  ok(t2.AUTH.user.userId==="bob_22"&&seat(t2)!==null&&JSON.parse(seat(t2)).u==="alice_1","L3 탭2 bob 로그인 → alice 좌석 기록을 지우지 않는다(종전 빌드는 여기서 지웠다)");
  t1.activate(); storageEvent(t1); await tick();
  ok(w1.closed===true&&t1.NET.roomId===null&&t1.NET.resuming===false&&rs(t1).length===w1n,"L4 탭1: 옛 신원(alice)의 방 소켓을 닫고 재접속하지 않는다");
  ok(t1.AUTH.state==="in"&&t1.AUTH.user.userId==="bob_22"&&/다른 창에서 밥돌이\(bob_22\) 계정으로 로그인/.test(toasts(t1)),"L5 탭1 은 프로필의 실제 계정(bob)을 명시적으로 알린다 — 조용히 alice 로 남지 않는다");
  ok(JSON.parse(seat(t1)).u==="alice_1"&&JSON.parse(seat(t1)).seatToken===TOK,"L6 alice 좌석 기록은 남는다(이 브라우저에서 alice 로 다시 로그인하면 유예 안 재접속)");
  // bob 이 탭2 에서 참가해 좌석을 얻은 뒤 탭1 을 새로고침해도 alice·bob 좌석이 섞이지 않는다
  t2.activate(); shared.setItem("dd_seat.bob_22",rec({u:"bob_22",seat:1,seatToken:"B".repeat(22)}));
  const t1r=H.load(htmlPath,{href:HTTPS,fetch:global.fetch,storage:shared}); await tick();
  const rr=rs(t1r)[0];
  ok(t1r.AUTH.user.userId==="bob_22"&&(!rr||rr.protocols[1]!=="r-"+EPOCH+"."+TOK),"L7 새로고침한 탭1 은 bob — alice 의 호스트 좌석 토큰으로 재접속하지 않는다");
  ok(!rr||rr.protocols[1]==="r-"+EPOCH+"."+"B".repeat(22),"L8 새로고침 탭은 프로필 계정(bob) 자신의 좌석만 쓴다(같은 계정 마지막 탭 규칙 — 계정 간 섞임 없음)");
  // 알림을 놓쳐도: 서버가 옮겨 간 옛 세션을 끊으면(login_replaced) 옛 탭은 끝나고 프로필 계정을 알린다
  profile.cookie="alice_1";
  const a=await boot(HTTPS,PROFILE_RT,null,H.mkStorage({tutorialSeen:"1"}));
  const {ws:aw}=await inRoom({},a); profile.cookie="bob_22"; // 같은 프로필 다른 탭의 bob 로그인(알림 이벤트 없음)
  frame(aw,{type:"error",code:"E_SESSION_ENDED",reason:"login_replaced"}); await tick();
  ok(aw.closed===true&&a.NET.resuming===false&&a.AUTH.user&&a.AUTH.user.userId==="bob_22"&&/밥돌이\(bob_22\)/.test(toasts(a)),"L9 알림 없이 서버 종료(login_replaced)만 와도 옛 탭은 소켓을 닫고 프로필 계정을 알린다");
  // 재접속 중 거절(E_SEAT_TOKEN_INVALID) — 원인이 신원 전환이면 그렇다고 알린다
  profile.cookie="alice_1";
  const b=await boot(HTTPS,PROFILE_RT,null,H.mkStorage({tutorialSeen:"1",[SK]:rec()}));
  profile.cookie="bob_22";
  frame(openWs(rs(b)[0]),{type:"error",code:"E_SEAT_TOKEN_INVALID"}); await tick();
  ok(b.NET.resuming===false&&b.AUTH.user&&b.AUTH.user.userId==="bob_22"&&/밥돌이\(bob_22\)/.test(toasts(b)),"L10 재접속 거절(좌석 계정≠쿠키 계정) → 막연한 '연결 끊김' 대신 계정 전환을 알린다");
  // 실서버 통합에서 찾은 경합: 옮겨 간 옛 세션 종료(이유 없음)가 새 쿠키보다 먼저 와 세션 확인이 401 로 늦게 오는 사이, 다른 탭 알림이 도착
  profile.cookie="alice_1";
  const e=await boot(HTTPS,PROFILE_RT,null,H.mkStorage({tutorialSeen:"1"}));
  const {ws:ew}=await inRoom({},e);
  const d=later(); routes["GET /api/auth/session"]=()=>d.p.then(()=>[401,{error:"E_NO_SESSION"}]); // 새 쿠키 전의 확인
  frame(ew,{type:"error",code:"E_SESSION_ENDED"}); await tick();
  ok(e.AUTH.state==="checking"&&ew.closed===true,"L11 이유 없는 세션 종료 → 방 소켓 닫고 프로필 로그인 확인 중");
  profile.cookie="bob_22"; routes["GET /api/auth/session"]=PROFILE_RT["GET /api/auth/session"];
  e.acct.acctOnStorage({key:"dd_acct",newValue:JSON.stringify({u:"bob_22",t:2})}); d.release(); await tick();
  ok(e.AUTH.state==="in"&&e.AUTH.user.userId==="bob_22"&&/다른 창에서 밥돌이\(bob_22\) 계정으로 로그인/.test(toasts(e))&&e.NET.resuming===false,
    "L12 확인 중 도착한 다른 탭 알림은 버리지 않는다 — 늦은 401 대신 프로필 계정(bob)을 전환 안내와 함께 보인다");
  // 같은 신원 알림·다른 키 이벤트는 무시
  const c=await boot(HTTPS,IN); const cn=calls.length;
  c.acct.acctOnStorage({key:"dd_acct",newValue:JSON.stringify({u:"alice_1",t:1})}); c.acct.acctOnStorage({key:"other",newValue:"x"}); await tick();
  ok(c.AUTH.state==="in"&&calls.length===cn,"L13 같은 계정 알림·관계없는 키 → 아무 일도 없다");
}

/* ===== M. 서버 공개 닉네임·같은 계정 참가 ===== */
{
  const {T,ws}=await inRoom({});
  T.NET.mode=true; // 대국 시작(netStart) 뒤와 같은 좌석 시점
  frame(ws,{type:"room_state",data:null,players:["앨리스","밥돌이"]});
  ok(T.pname(0)==="나(P1 · 앨리스)"&&T.pname(1)==="상대(P2 · 밥돌이)","M1 서버 players 로 내/상대 실제 닉네임 표시");
  frame(ws,{type:"room_state",data:null,players:["<img src=x>",null]});
  ok(T.pname(0)==="나(P1)"&&T.pname(1)==="상대(P2)","M2 닉네임 규칙에 맞지 않는 값·null 은 표시하지 않는다(HTML 주입 없음)");
  T.netLeaveRoom(); ok(T.NET.players===null,"M3 방을 나가면 닉네임도 비운다");
  const J=await boot(HTTPS,IN); J.uiStart(); J.netJoinPublicRoom("5"); await tick();
  const jw=openWs(rs(J)[0]); frame(jw,{type:"error",code:"E_SAME_ACCOUNT"});
  ok(/같은 계정끼리는 대전할 수 없습니다/.test(J.NET.lobbyMsg&&J.NET.lobbyMsg.text||"")&&J.NET.roomId===null,"M4 E_SAME_ACCOUNT → 로비 카드에 명확한 안내");
}

/* ===== W. 방 소켓 없는 로그인 탭의 백그라운드 세션 대조 (CJ 자동 로그아웃 · Saturn 정적 지적) =====
   하네스 타이머는 무동작 스텁이라 5초 tick·포커스·다시 보임은 모두 같은 처리기(acctWatchTick)를 직접 부른다(결정적). */
{
  const wt=T=>{ if(T.acct.acctWatchTick) T.acct.acctWatchTick(); };
  const sessCalls=()=>calls.filter(c=>c.url==="/api/auth/session").length;
  // W1 타이틀에 가만히 있는 로그인 탭 — 다른 곳 새 로그인·만료로 서버 세션이 사라졌다
  const I=await boot(HTTPS,IN);
  const n0=sessCalls(); routes["GET /api/auth/session"]=[401,{error:"E_NO_SESSION"}];
  wt(I); await tick();
  ok(sessCalls()===n0+2&&I.AUTH.state==="anon"&&/로그아웃되었거나 다른 곳의 새 로그인/.test(toasts(I))&&rs(I).length===0,"W1 방 소켓 없는 로그인 탭 + 서버 세션 없음(401) → 대조 1회로 자동 로그아웃 안내·소켓 0 (요청 2 = 대조 + 로그아웃 뒤 프로필 재확인 1회)");
  // W2 포커스·다시 보임은 즉시 대조, 숨은 탭은 묻지 않는다
  const V=await boot(HTTPS,IN); V.document.hidden=true;
  const n1=sessCalls(); wt(V); wt(V); await tick();
  ok(sessCalls()===n1&&V.AUTH.state==="in","W2 숨은 탭은 tick 이 와도 요청하지 않는다");
  routes["GET /api/auth/session"]=[401,{error:"E_NO_SESSION"}]; V.document.hidden=false; wt(V); await tick(); // visibilitychange → visible
  ok(sessCalls()===n1+2&&V.AUTH.state==="anon","W3 다시 보이는 순간 즉시 대조 → 로그아웃 (요청 2 = 대조 + 프로필 재확인)");
  // W4 네트워크 실패·503·429 는 지금 상태를 지키고 깜빡이지 않는다
  for(const [name,h] of [["연결 실패",()=>{ throw new TypeError("offline"); }],["503",[503,{error:"E_ACCOUNTS_UNAVAILABLE"}]],["429",[429,{error:"E_RATE_LIMITED"}]]]){
    const F=await boot(HTTPS,IN); const d=later(); routes["GET /api/auth/session"]=()=>d.p.then(()=>typeof h==="function"?h():h);
    const html=panel(F); wt(F); await tick();
    const mid=F.AUTH.state; d.release(); await tick();
    ok(mid==="in"&&F.AUTH.state==="in"&&panel(F)===html&&rs(F).length===0,"W4 대조 "+name+" → 대기 중에도 checking 으로 바뀌지 않고 로그인·화면 유지");
  }
  // W5 같은 계정 200 은 아무것도 하지 않는다 — 저장된 좌석이 있어도 방을 열거나 재접속하지 않는다
  const R=await boot(HTTPS,IN); R.storage.setItem(SK,rec()); const nw=rs(R).length, html5=panel(R);
  wt(R); await tick();
  ok(R.AUTH.state==="in"&&rs(R).length===nw&&R.NET.resuming===false&&panel(R)===html5,"W5 같은 계정 200 → 소켓·재접속·화면 변화 없음");
  // W6 한 번에 하나 — tick·포커스·다시 보임이 겹쳐도 요청 1개
  const D=await boot(HTTPS,IN); const dd=later(); routes["GET /api/auth/session"]=()=>dd.p.then(()=>[200,ALICE]);
  const n6=sessCalls(); wt(D); wt(D); wt(D); await tick(); dd.release(); await tick();
  ok(sessCalls()===n6+1,"W6 겹친 tick·포커스 → 진행 중인 대조 하나뿐");
  // W7 늦은 응답 — 대조가 도는 사이 로그아웃·다른 계정 로그인이 끝나면 옛 401/200 은 버린다(부활·잘못된 로그아웃 없음)
  const L=await boot(HTTPS,Object.assign({},IN,{"POST /api/auth/logout":[200,{ok:true}],"POST /api/auth/login":[200,BOB]}));
  const l1=later(); routes["GET /api/auth/session"]=()=>l1.p.then(()=>[200,ALICE]);
  wt(L); await tick(); await L.acct.acctLogout(); l1.release(); await tick();
  ok(L.AUTH.state==="anon"&&L.AUTH.user===null&&rs(L).length===0,"W7 로그아웃 뒤 도착한 옛 대조 200 → 익명 유지(부활 없음)");
  const S=await boot(HTTPS,Object.assign({},IN,{"POST /api/auth/logout":[200,{ok:true}],"POST /api/auth/login":[200,BOB]}));
  const l2=later(); routes["GET /api/auth/session"]=()=>l2.p.then(()=>[401,{error:"E_NO_SESSION"}]);
  wt(S); await tick(); await S.acct.acctLogout(); setv(S,"acctId","bob_22"); setv(S,"acctPw","password1"); await S.acct.acctSubmit();
  l2.release(); await tick();
  ok(S.AUTH.state==="in"&&S.AUTH.user.userId==="bob_22","W8 다른 계정으로 바꾼 뒤 도착한 옛 대조 401 → 새 계정 유지(잘못된 로그아웃 없음)");
  // W9 열린 방 소켓이 있으면 묻지 않는다(서버가 그 소켓에 E_SESSION_ENDED 를 보낸다)
  const {T:G}=await inRoom({}); const n9=sessCalls(); wt(G); await tick();
  ok(sessCalls()===n9&&G.AUTH.state==="in","W9 인증된 방 소켓이 열려 있으면 백그라운드 대조를 하지 않는다");
  // W10 다른 계정 200(같은 프로필 다른 탭, 알림을 놓침) → 전환 안내
  const X=await boot(HTTPS,IN); routes["GET /api/auth/session"]=[200,BOB]; wt(X); await tick();
  ok(X.AUTH.user&&X.AUTH.user.userId==="bob_22"&&/밥돌이\(bob_22\)/.test(toasts(X))&&rs(X).length===0,"W10 대조가 다른 계정을 돌려주면 옛 신원을 끝내고 전환 안내(재접속 없음)");
  // W11 타이머는 로그인에 하나, 익명이 되면 끈다(렌더·재확인으로 늘지 않는다)
  const Z=await boot(HTTPS,Object.assign({},ANON,{"POST /api/auth/login":[200,ALICE],"POST /api/auth/logout":[200,{ok:true}]}));
  const made=[],cleared=[]; const si=global.setInterval, ci=global.clearInterval;
  global.setInterval=(f,ms)=>{ made.push(ms); return 4242; }; global.clearInterval=h=>{ cleared.push(h); };
  setv(Z,"acctId","alice_1"); setv(Z,"acctPw","password1"); await Z.acct.acctSubmit();
  Z.uiStart(); routes["GET /api/auth/session"]=[200,ALICE]; Z.netCreatePublicRoom(); await tick(); // 입장 직전 확인도 acctSetUser 를 부른다
  const madeIn=made.slice();
  await Z.acct.acctLogout();
  global.setInterval=si; global.clearInterval=ci;
  ok(madeIn.length===1&&madeIn[0]===5000&&cleared.includes(4242)&&Z.AUTH.watch===null,"W11 로그인 시 5초 타이머 1개(재확인으로 늘지 않음) · 로그아웃하면 해제 ("+JSON.stringify({madeIn,cleared})+")");
}

/* ===== H. 정적 — 저장 API 는 좌석 기록·탭 알림 두 키뿐, 옛 복구 코드 UI 없음 ===== */
{
  const src=require("fs").readFileSync(require("path").join(__dirname,"..","..","js","account.js"),"utf8");
  const code=src.replace(/\/\*[\s\S]*?\*\//g,"").split(/\r?\n/).map(l=>l.replace(/\/\/.*$/,""));
  const lines=code.filter(l=>/localStorage|sessionStorage|indexedDB|document\.cookie|console\./.test(l));
  ok(lines.length===3&&lines.every(l=>/localStorage\.(setItem\(k,v\)|getItem\(k\)|removeItem\(k\))/.test(l)&&!/code|password|pw|reset|token|email/i.test(l.replace(/seatToken/g,""))),
    "H1 account.js 저장 API 는 세 줄(acctStore·좌석 읽기·좌석 지우기)뿐 — 코드·비밀번호·허가·이메일을 싣는 줄 없음");
  const stores=(code.join("\n").replace("function acctStore(k,v)","").match(/acctStore\([^\s,]+?,/g)||[]).map(s=>s.slice(10,-1));
  ok(stores.length===2&&stores.every(k=>k==="acctSeatKey()"||k==="ACCT_TAB_KEY"),"H2 acctStore 는 좌석 기록(acctSeatKey)·탭 알림(ACCT_TAB_KEY) 두 키에만 쓴다: "+stores.join(","));
  ok(!/document\.cookie/.test(src),"H3 쿠키를 JS 로 읽거나 쓰지 않는다");
  ok(!/recovery|복구 코드|acctReissue|acctCodeDone|acctSaved/.test(src.replace(/\/\*[\s\S]*?\*\//g,"")),"H4 복구 코드 발급·저장 확인·재발급 UI 와 게이트가 코드에 남아 있지 않다");
}

console.log(`\n#259 계정 클라이언트: ${pass} PASS / ${fail} FAIL`);
if(fail){ console.log(fails.join("\n")); process.exit(1); }
})().catch(e=>{ console.error(e); process.exit(1); });
