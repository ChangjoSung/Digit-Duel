"use strict";
/* ===== #259 아이디 계정 — 로그인·가입(이메일 필수)·이메일 코드 비밀번호 재설정·세션 확인 · 새로고침/브라우저 재시작 후 좌석 재접속 =====
   서버 계약: server/authoritative/accounts.js (/api/auth/*). 같은 출처 JSON fetch 만 쓴다.
   - 세션 쿠키(dd_sid)는 HttpOnly 라 JS 가 읽지도 저장하지도 않는다 — 브라우저가 같은 출처 요청·WebSocket 에 스스로 싣는다.
   - 비밀번호 재설정(CJ 2026-09-27 아이디 전용): 아이디만 입력 → 그 계정에 등록된 이메일로 받은 6자리 코드 확인 → 새 비밀번호.
     이메일은 계정끼리 겹칠 수 있어(가입 필수·중복 허용) 대상은 아이디로만 정하고, 화면에 이메일 주소를 보이지 않는다.
     아이디는 이 메모리(AUTH.reset)에만 두고 재발송·확인에 그대로 쓴다. 코드는 입력 칸에서 바로 보내고 어디에도 두지 않는다.
     확인 뒤 받은 재설정 허가(resetToken)도 AUTH.reset 에만 두고 끝나거나 화면을 떠나면 버린다. 저장소·주소·로그에 쓰지 않는다.
   - 계정 없는 기존 경로(state="off")는 **증명된 두 경우만**이다: file:// · DB 없는 서버의 JSON 503 E_ACCOUNTS_DISABLED.
     연결 실패·모르는 응답·형식이 틀린 응답·404 는 계정 없음으로 추정하지 않고 "down"(입장 차단 + 다시 시도)으로 닫는다.
   - AUTH.gen: 신원이 바뀔 때(익명이 됨·다른 계정) 1 오른다. 신원을 세우거나 입장을 이어 가는 비동기 응답은 요청 때의 gen 과
     다르면 버린다. AUTH.rgen: 재설정 단계·화면이 바뀔 때 1 오른다 — 늦게 온 옛 단계 응답이 지금 화면을 바꾸지 못하게.
   - 한 브라우저 프로필(같은 창의 여러 탭)은 쿠키 하나를 나눠 쓴다 — 탭마다 다른 계정을 둘 수 없다. 이 탭에서 신원이 바뀌면
     dd_acct 에 알리고(storage 이벤트), 다른 탭은 옛 신원의 방 소켓·재접속을 끊고 프로필의 실제 로그인을 다시 본다(#259 CJ QA REVISE).
   - DB 가 켜진 서버면 게임 입장(공개 방 · 엔진 진입점 startMode) 전에 로그인이 필요하다. 타이틀은 열려 있다(#260: 제품 튜토리얼·PVE·핫시트 진입점 없음).
   state: off | checking(확인 중 — 입장 차단) | anon(로그인 필요) | in | down(계정 상태를 확인하지 못함 — 입장 차단) */
const AUTH={state:"off",user:null,view:"login",busy:false,gen:0,rgen:0,reset:null,probing:false,was:null,watch:null}; // was: 서버·다른 탭이 끝낸 이 탭의 옛 아이디(전환 안내용) · watch: 세션 대조 타이머
const ACCT_ID_RE=/^[a-z0-9_]{4,20}$/, ACCT_NICK_RE=/^[가-힣A-Za-z0-9_]{2,12}$/, ACCT_PW_MIN=8, ACCT_PW_MAX=128; // 서버 accounts.js 와 같은 규칙
const ACCT_EMAIL_RE=/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/; // 서버 EMAIL_RE 와 같다
const ACCT_RESEND_MS=60000; // 서버 재발송 간격(코드 10분 유효·5회 틀리면 무효)
const ACCT_ERR={
  E_BAD_INPUT:"입력 형식을 확인해 주세요.",
  E_ID_TAKEN:"이미 사용 중인 아이디입니다.",
  E_NICKNAME_TAKEN:"이미 사용 중인 닉네임입니다.",
  E_EMAIL_ALREADY_SET:"이미 이메일이 등록되어 있습니다.",
  E_RATE_LIMITED:"시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
  E_INSECURE_TRANSPORT:"보안 연결(HTTPS)에서만 비밀번호를 입력할 수 있습니다.",
  E_BAD_ORIGIN:"요청 출처가 올바르지 않습니다. 페이지를 새로 열어 주세요.",
  E_ACCOUNTS_UNAVAILABLE:"계정 서버에 일시적으로 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  E_ACCOUNTS_DISABLED:"이 서버는 계정 기능을 쓰지 않습니다.",
  E_NO_SESSION:"로그인이 만료되었습니다. 다시 로그인해 주세요.",
  E_ID_NOT_FOUND:"존재하지 않는 아이디입니다", // CJ 지정 문구 그대로
  E_EMAIL_REQUIRED:"이 아이디에는 등록된 이메일이 없어 비밀번호를 재설정할 수 없습니다. 로그인한 뒤 이메일을 등록해 주세요.",
  E_MAIL_UNAVAILABLE:"지금은 인증 메일을 보낼 수 없어 비밀번호를 재설정할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  E_CODE_INVALID:"인증 코드가 올바르지 않거나 만료되었습니다. 메일의 가장 최근 코드를 확인하거나 코드를 다시 받아 주세요.",
  E_RESET_INVALID:"재설정 시간이 지났거나 이미 처리되었습니다. 인증 코드를 다시 받아 주세요.",
  E_SAME_PASSWORD:"직전 비밀번호와 같습니다"}; // CJ 지정 문구 그대로
/* 로그인 실패 원인을 구분하지 않는다 — 없는 아이디·틀린 비밀번호는 같은 문구(서버도 같은 응답이다) */
const ACCT_AUTH_FAIL={login:"아이디 또는 비밀번호가 올바르지 않습니다.",email:"비밀번호가 올바르지 않습니다."};

/* 비밀번호를 받아도 되는 전송인가 — HTTPS 이거나 이 PC(루프백). 서버도 같은 경계를 403 으로 지킨다(최종 권위). */
function acctSecure(){ return location.protocol==="https:"||/^(localhost|127(\.\d{1,3}){3}|\[::1\])$/.test(location.hostname||""); }

async function acctApi(path,body){
  let r;
  try{
    r=await fetch("/api/auth/"+path,body===undefined?{credentials:"same-origin",cache:"no-store"}
      :{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  }catch(e){ return {status:0,body:{}}; }
  let j=null; try{ j=await r.json(); }catch(e){}
  return {status:r.status,body:j&&typeof j==="object"?j:{}};
}
function acctErrText(r,kind){
  if(r.status===401&&r.body.error==="E_AUTH_FAILED") return ACCT_AUTH_FAIL[kind]||ACCT_AUTH_FAIL.login;
  return ACCT_ERR[r.body.error]||(r.status===0?"서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.":"요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
}
function acctEmail(v){ const e=String(v||"").trim(); return e.length<=254&&ACCT_EMAIL_RE.test(e)?e:null; }
function acctIsUser(r){ return r.status===200&&typeof r.body.userId==="string"&&typeof r.body.nickname==="string"; }
function acctSetUser(b){
  const u={userId:String(b.userId),nickname:String(b.nickname||""),hasEmail:b.hasEmail!==false};
  if(!AUTH.user||AUTH.user.userId!==u.userId) AUTH.gen++;
  AUTH.state="in"; AUTH.user=u; AUTH.was=null; acctWatch(true);
}
function acctSetAnon(){ acctWatch(false); AUTH.gen++; AUTH.rgen++; AUTH.state="anon"; AUTH.user=null; AUTH.view="login"; AUTH.reset=null; }

/* 페이지 로드(와 [다시 시도]) — 서버 세션으로 로그인 상태를 복원하고, 그 계정의 진행 중 좌석이 있으면 재접속한다.
   passive(이전 아이디 또는 true): 다른 탭·서버가 이 탭의 신원을 끝낸 뒤 프로필의 실제 로그인만 다시 본다 — 재접속은 하지 않는다
   (같은 프로필의 다른 탭이 들고 있는 좌석을 빼앗지 않게). */
async function acctCheck(passive){
  if(!/^https?:$/.test(location.protocol)){ AUTH.state="off"; return; }
  AUTH.state="checking"; acctRender();
  const g=AUTH.gen, r=await acctApi("session");
  if(g!==AUTH.gen) return; // 확인 도중 신원이 바뀌었다 — 옛 응답은 버린다
  if(acctIsUser(r)) acctSetUser(r.body);
  else if(r.status===401&&r.body.error==="E_NO_SESSION") acctSetAnon();
  else if(r.status===503&&r.body.error==="E_ACCOUNTS_DISABLED") AUTH.state="off"; // DB 없는 서버
  else AUTH.state="down"; // 연결 실패·모르는 응답 — 닫는다
  acctRender();
  if(passive){
    if(typeof passive==="string"&&AUTH.state==="in") showToast(AUTH.user.userId!==passive
      ?`👤 이 브라우저의 다른 창에서 ${AUTH.user.nickname}(${AUTH.user.userId}) 계정으로 로그인했습니다. 한 브라우저에서는 한 계정만 쓸 수 있습니다.`
      :"👤 이 브라우저의 다른 창에서 같은 계정으로 새로 로그인해 이 창의 경기 연결을 끝냈습니다.");
    return;
  }
  acctResumeSaved();
}

/* 입장 게이트 — null 이면 들어가도 된다. 서버가 최종 권위이고(WebSocket 401) 이것은 입장 전 안내다. */
function acctGateMsg(){
  if(AUTH.state==="anon") return "로그인한 뒤 입장할 수 있습니다.";
  if(AUTH.state==="down") return "계정 서버에 연결할 수 없어 지금은 입장할 수 없습니다.";
  if(AUTH.state==="checking") return "계정을 확인하는 중입니다. 잠시 후 다시 눌러 주세요.";
  return null;
}
function acctToTitle(msg){
  try{ netLeave(); }catch(e){}
  newGame("pvp",{phase:"menu"}); UI.entered=false; UI.drawer=null;
  render(); acctRender();
  if(msg) showToast("🔒 "+msg);
}
/* 공개 방 생성·참가 소켓을 열기 직전 — 계정 서버면 세션이 아직 살아 있는지 서버에 먼저 묻는다(만료·로그아웃·다른 곳 로그인) */
function acctBeforeConnect(go){
  if(AUTH.state==="off") return go(); // 증명된 계정 없는 서버 — 기존 그대로(동기)
  const gate=acctGateMsg(); if(gate) return acctToTitle(gate); // 확인 중·로그인 필요·장애 — 소켓을 열지 않는다
  const g=AUTH.gen;
  acctApi("session").then(r=>{
    if(g!==AUTH.gen||AUTH.state!=="in") return; // 기다리는 동안 로그아웃·세션 종료·계정 전환 — 옛 입장을 이어 가지 않는다
    if(acctIsUser(r)){
      const same=r.body.userId===AUTH.user.userId;
      acctSetUser(r.body); acctRender();
      if(!same) showToast("🔒 다른 계정으로 로그인되어 있습니다(다른 탭). 확인한 뒤 다시 눌러 주세요."); // 공유 쿠키가 바뀌었다 — 옛 계정의 입장을 새 계정으로 잇지 않는다
      else if(!acctGateMsg()) go();
      return; }
    if(r.status===401){ acctSeatDrop(); acctSetAnon(); acctToTitle(ACCT_ERR.E_NO_SESSION); return; }
    showToast("🌐 "+acctErrText(r,"session"));
  });
}
/* 세션 대조 한 번 — 재접속 소켓이 거절됐을 때(업그레이드 401·좌석 토큰 무효)와 아래 백그라운드 대조가 함께 쓴다. 원인이 이 탭의 신원이면
   끝없이 재시도하거나 "연결이 끊겼습니다"로 얼버무리지 않고 알린다. 세션 없음 = 다른 곳의 새 로그인·로그아웃·재설정·만료 → 로그아웃 안내 ·
   다른 계정 = 같은 프로필의 다른 탭 로그인. 같은 계정 200 은 아무것도 하지 않는다(방을 열거나 재접속하지 않는다). 네트워크·503·429 는 지금 상태 유지.
   확인 중(checking) 상태로 바꾸지 않으므로 화면이 깜빡이지 않고, 한 번에 하나만 돈다(probing). 늦은 응답은 신원 세대(gen)로 버린다. */
function acctResumeProbe(){
  if(AUTH.state!=="in"||AUTH.probing) return;
  const g=AUTH.gen; AUTH.probing=true;
  acctApi("session").then(r=>{
    AUTH.probing=false;
    if(g!==AUTH.gen||AUTH.state!=="in") return;
    if(r.status===401&&r.body.error==="E_NO_SESSION") acctEndSession(ACCT_SESSION_ENDED);
    else if(acctIsUser(r)&&r.body.userId!==AUTH.user.userId) acctEndSession(ACCT_TAB_SWITCHED);
  });
}
/* ===== 방 소켓이 없는 로그인 탭의 세션 대조 (#259 CJ 자동 로그아웃 — PD 기술 기본값: 보이는 동안 5초마다 1회) =====
   타이틀·PVE·로비 목록처럼 계정 소켓이 없는 탭은 서버가 세션을 끝내도(다른 곳 새 로그인·로그아웃·재설정·30일 만료) 알릴 길이 없다.
   보이는 동안 5초마다, 그리고 다시 보이거나 포커스를 얻는 즉시 GET /session 으로 대조한다. 숨은 탭은 건너뛴다.
   방 소켓이 열려 있으면 서버가 그 소켓에 E_SESSION_ENDED 를 직접 보내므로 묻지 않는다. 대조는 세션을 연장하지 않는다(30일 절대 만료 — 서버).
   타이머는 로그인할 때 하나만 켜고 익명이 되면 끈다. 게임 규칙·프로토콜·게임 시계와 무관하다. */
const ACCT_WATCH_MS=5000;
function acctWatch(on){
  if(on&&!AUTH.watch) AUTH.watch=setInterval(acctWatchTick,ACCT_WATCH_MS);
  else if(!on&&AUTH.watch){ clearInterval(AUTH.watch); AUTH.watch=null; }
}
function acctWatchTick(){
  if(AUTH.state!=="in") return acctWatch(false);
  if(typeof document!=="undefined"&&document.hidden) return;
  if(NET.ws&&NET.ws.readyState===1&&NET.roomId!=null&&!NET.lobbyOnly) return;
  acctResumeProbe();
}
if(typeof document!=="undefined"&&document.addEventListener) document.addEventListener("visibilitychange",acctWatchTick); // 다시 보이면 즉시(숨을 때는 tick 이 건너뛴다)
if(typeof window!=="undefined"&&window.addEventListener) window.addEventListener("focus",acctWatchTick);

/* ===== 이 브라우저 프로필의 다른 탭 알림 — storage 이벤트는 같은 출처의 **다른** 탭에서만 불린다 ===== */
const ACCT_TAB_KEY="dd_acct";
const ACCT_TAB_SWITCHED="🔒 이 브라우저의 다른 창에서 로그인 상태가 바뀌어 이 창의 로그인과 경기 연결을 끝냈습니다.";
function acctTell(u){ acctStore(ACCT_TAB_KEY,JSON.stringify({u,t:Date.now()})); } // t: 같은 값이어도 이벤트가 나게
function acctOnStorage(e){
  if(!e||e.key!==ACCT_TAB_KEY||AUTH.state==="off") return;
  let u=null; try{ const v=JSON.parse(e.newValue||"null"); u=v&&typeof v.u==="string"?v.u:null; }catch(_){}
  const mine=AUTH.state==="in"&&AUTH.user?AUTH.user.userId:null;
  if(AUTH.state!=="checking"&&u===mine) return; // 같은 신원 — 같은 계정 재로그인이 옛 세션을 끝냈다면 서버가 소켓에 알린다(E_SESSION_ENDED)
  if(mine) acctEndSession(ACCT_TAB_SWITCHED);
  else { AUTH.gen++; acctCheck(AUTH.was||true); } // 로그인·장애·확인 중 화면의 탭은 프로필의 지금 로그인을 다시 본다 — 확인 중이던 옛 응답(새 쿠키 전의 401 등)은 버린다. 입장은 사용자가 다시 누른다
}
if(typeof window!=="undefined"&&window.addEventListener) window.addEventListener("storage",acctOnStorage);

/* ===== #237 좌석 재접속 기록 — 새로고침·브라우저 재시작 뒤 60초 유예 안의 재접속용 (코디네이터 승인 2026-09-26) =====
   로그인한 계정 서버에서만 쓴다. 서버가 좌석을 accountId 에 묶으므로 이 토큰만으로는 좌석을 가져갈 수 없다.
   계정마다 따로 둔다(dd_seat.<아이디>) — 같은 프로필에서 다른 계정으로 바꿔도 서로의 기록을 지우거나 이어받지 않는다(#259 CJ QA REVISE).
   계정 세션·비밀번호·재설정 코드는 여기 싣지 않는다. 나가기·로비·로그아웃·재접속 실패(netLeave)에서 지운다.
   같은 계정의 새 탭도 이 기록으로 재접속한다 — 마지막 탭이 좌석을 가져가고, 밀려난 탭은 로비로 간다(되찾기 경쟁 없음). */
const ACCT_SEAT_KEY="dd_seat.";
function acctStore(k,v){ try{ localStorage.setItem(k,v); }catch(e){} } // account.js 의 유일한 저장 쓰기 — 좌석 기록·탭 알림 두 키뿐
function acctSeatKey(){ return AUTH.user?ACCT_SEAT_KEY+AUTH.user.userId:null; }
function acctSeatLoad(){
  const k=acctSeatKey(); if(!k) return null;
  let r=null; try{ r=JSON.parse(localStorage.getItem(k)||"null"); }catch(e){ return null; }
  // credential 문자열(r-<epoch>.<token>)로 조립되는 값이므로 서버 형식(server.js parseCredential)과 같게 검사한다
  if(!r||typeof r!=="object"||r.u!==AUTH.user.userId||!/^[0-9a-f]{8}$/.test(r.epoch)||!/^[A-Za-z0-9_-]{22}$/.test(r.seatToken)
    ||!Number.isInteger(r.roomId)||(r.seat!==0&&r.seat!==1)||!Number.isInteger(r.tokenGen)) return null;
  return r;
}
function acctSeatSave(){
  if(AUTH.state!=="in"||!AUTH.user||NET.roomId==null||!NET.seatToken||!NET.epoch) return;
  acctStore(acctSeatKey(),JSON.stringify({u:AUTH.user.userId,epoch:NET.epoch,roomId:NET.roomId,seat:NET.me,seatToken:NET.seatToken,tokenGen:NET.tokenGen}));
}
/* onlyToken: 이 탭이 들고 있던 토큰의 기록일 때만 지운다 — 다른 탭이 좌석을 가져가 새 토큰을 적어 둔 기록은 남긴다 */
function acctSeatDrop(onlyToken){
  const k=acctSeatKey(); if(!k) return;
  try{
    if(onlyToken!==undefined){ const r=acctSeatLoad(); if(!onlyToken||(r&&r.seatToken!==onlyToken)) return; }
    localStorage.removeItem(k);
  }catch(e){}
}
function acctResumeSaved(){
  if(AUTH.state!=="in"||acctGateMsg()||NET.ws||NET.roomId!=null) return;
  const r=acctSeatLoad(); if(!r) return acctSeatDrop();
  UI.entered=true; NET.publicMode=true;
  NET.roomId=r.roomId; NET.me=r.seat; NET.seatToken=r.seatToken; NET.tokenGen=r.tokenGen; NET.epoch=r.epoch;
  netBeginResume(); // 이후는 #237 그대로 — 서버가 유예·토큰·계정을 판정하고, 실패하면 netLeave 가 기록을 지운다
}

/* ===== 화면 (타이틀 화면 안의 #acctPanel) ===== */
function acctField(id,label,type,ac,hint,extra){
  return `<label class="acctField" for="${id}"><span>${label}</span><input id="${id}" type="${type}" autocomplete="${ac}" ${extra||""}>${hint?`<small>${hint}</small>`:""}</label>`;
}
const acctPwField=(id,label,ac,hint)=>acctField(id,label,"password",ac,hint,`maxlength="${ACCT_PW_MAX}" required`);
const acctEmailField=hint=>acctField("acctEmail","이메일","email","email",hint,'maxlength="254" autocapitalize="none" spellcheck="false" required');
function acctFormHtml(){
  const v=AUTH.view;
  const tabs=`<div class="acctTabs" role="group" aria-label="계정">${[["login","로그인"],["signup","회원가입"],["reset","비밀번호 찾기"]].map(([k,t])=>
    `<button type="button" aria-pressed="${v===k}" onclick="acctView('${k}')">${t}</button>`).join("")}</div>`;
  const google=`<button type="button" class="ghost" disabled aria-disabled="true">🔒 Google 로그인 — 추후 공개</button>`;
  if(!acctSecure()) return tabs.replace(/<button /g,"<button disabled ")
    +`<p class="acctMsg err" role="alert">🔒 보안 연결(HTTPS)이 아닌 주소에서는 로그인할 수 없습니다. HTTPS 주소로 접속해 주세요.</p>`+google;
  const idF=acctField("acctId","아이디","text","username","영문 소문자·숫자·밑줄 4~20자",'maxlength="20" autocapitalize="none" spellcheck="false" required');
  const newPw=acctPwField("acctPw",v==="reset"?"새 비밀번호":"비밀번호","new-password",ACCT_PW_MIN+"~"+ACCT_PW_MAX+"자")+acctPwField("acctPw2",v==="reset"?"새 비밀번호 확인":"비밀번호 확인","new-password","");
  const R=AUTH.reset;
  let body="", go="로그인", extra="";
  if(v==="signup"){
    body=idF+acctField("acctNick","닉네임","text","nickname","다른 플레이어에게 보이는 이름 · 한글(완성형)·영문·숫자·밑줄 2~12자, 공백·기호 불가",'maxlength="12" required')
      +acctEmailField("비밀번호를 잊었을 때 인증 코드를 받을 주소")+newPw;
    go="가입하기";
  }else if(v==="reset"&&R&&R.step==="code"){
    body=`<small class="acctNote">아이디 ${escAttr(R.userId)} — 가입할 때 등록한 이메일로 6자리 인증 코드를 보냈습니다. 10분 안에 입력해 주세요. 메일이 없으면 스팸함도 확인해 주세요.</small>`
      +acctField("acctCode","인증 코드","text","one-time-code","숫자 6자리",'inputmode="numeric" maxlength="6" spellcheck="false" required');
    go="코드 확인";
    extra=`<div class="acctRow"><button type="button" onclick="acctResetSend(true)">코드 다시 받기</button><button type="button" onclick="acctView('reset')">아이디 다시 입력</button></div>`;
  }else if(v==="reset"&&R&&R.step==="pw"){
    body=`<small class="acctNote">인증되었습니다. 새 비밀번호를 정해 주세요. 바꾸면 모든 기기에서 로그아웃되고, 새 비밀번호로 다시 로그인합니다.</small>`+newPw;
    go="비밀번호 바꾸기";
  }else if(v==="reset"){
    body=`<small class="acctNote">아이디를 입력하면 가입할 때 등록한 이메일로 6자리 인증 코드를 보내 드립니다.</small>`+idF;
    go="인증 코드 받기";
  }else body=idF+acctPwField("acctPw","비밀번호","current-password","");
  return tabs+`<form class="acctForm" onsubmit="acctSubmit();return false" novalidate>${body}
    <p class="acctMsg err" id="acctMsg" role="alert"></p>
    <button type="submit" class="primary" id="acctGo">${go}</button>${extra}</form>`+google;
}
function acctRender(){
  const el=$("acctPanel"); if(!el) return;
  const s=AUTH.state;
  if(s==="off"){ el.innerHTML=""; return; }
  if(s==="checking"){ el.innerHTML=`<p class="acctMsg" role="status">계정을 확인하는 중…</p>`; return; }
  if(s==="down"){ el.innerHTML=`<p class="acctMsg err" role="alert">${ACCT_ERR.E_ACCOUNTS_UNAVAILABLE}</p><button type="button" onclick="acctCheck()">다시 시도</button>`; return; }
  if(s==="in"){
    if(AUTH.view==="email"){ // 이메일이 없는 기존 계정의 선택 등록 — 입장을 막지 않는다
      el.innerHTML=`<form class="acctForm" onsubmit="acctEmailSubmit();return false" novalidate>
        <small class="acctNote">등록한 이메일로 비밀번호를 재설정할 수 있습니다. 확인을 위해 현재 비밀번호를 입력해 주세요.</small>
        ${acctEmailField("")}${acctPwField("acctPw","현재 비밀번호","current-password","")}
        <p class="acctMsg err" id="acctMsg" role="alert"></p>
        <button type="submit" class="primary" id="acctGo">이메일 등록</button>
        <button type="button" onclick="acctView('login')">취소</button></form>`;
      return;
    }
    el.innerHTML=`<p class="acctUser">👤 <b>${escAttr(AUTH.user.nickname)}</b> <small>(${escAttr(AUTH.user.userId)})</small></p>
      <div class="acctRow"><button type="button" onclick="acctLogout()">로그아웃</button>
      ${AUTH.user.hasEmail?"":`<button type="button" onclick="acctView('email')" ${acctSecure()?"":"disabled"}>이메일 등록</button>`}</div>
      ${AUTH.user.hasEmail?"":`<small class="acctNote">이메일을 등록하면 비밀번호를 잊었을 때 재설정할 수 있습니다.</small>`}
      <p class="acctMsg err" id="acctMsg" role="alert"></p>`;
    return;
  }
  el.innerHTML=acctFormHtml(); // anon
}
function acctMsg(t,okTone){ const m=$("acctMsg"); if(m){ m.textContent=t||""; m.className="acctMsg"+(okTone?"":" err"); } }
function acctBusy(on){ AUTH.busy=on; const b=$("acctGo"); if(b) b.disabled=on; }
function acctVal(id){ const e=$(id); return e?String(e.value||""):""; }
function acctSetVal(id,v){ const e=$(id); if(e) e.value=v; }
function acctClear(){ for(const id of ["acctPw","acctPw2","acctCode"]){ const e=$(id); if(e) e.value=""; } } // 비밀 칸은 실패해도 남기지 않는다
function acctFocus(id){ const f=$(id); if(f&&f.focus) f.focus(); }
function acctView(v){
  AUTH.view=v; AUTH.rgen++; AUTH.busy=false; // 화면을 바꾸면 진행 중이던 재설정 단계의 늦은 응답은 버린다(버튼 잠금도 풀린다) · 허가도 버린다
  AUTH.reset=v==="reset"?{step:"id",userId:"",token:null,sentAt:0}:null;
  acctRender(); acctFocus(v==="email"?"acctEmail":"acctId");
}
/* 새 비밀번호 두 칸 검사 — 통과하면 null */
function acctPwCheck(pw){
  if(pw.length<ACCT_PW_MIN||pw.length>ACCT_PW_MAX) return "비밀번호는 "+ACCT_PW_MIN+"~"+ACCT_PW_MAX+"자입니다.";
  if(pw!==acctVal("acctPw2")) return "비밀번호 확인이 일치하지 않습니다.";
  return null;
}

async function acctSubmit(){
  if(AUTH.busy||AUTH.state!=="anon"||!acctSecure()) return;
  if(AUTH.view==="reset"){ const st=AUTH.reset&&AUTH.reset.step; return st==="code"?acctResetVerify():st==="pw"?acctResetComplete():acctResetSend(false); }
  const kind=AUTH.view==="signup"?"signup":"login";
  const userId=acctVal("acctId").trim().toLowerCase(), pw=acctVal("acctPw");
  let body;
  if(kind==="login"){
    if(!userId||!pw) return acctMsg("아이디와 비밀번호를 입력해 주세요.");
    body={userId,password:pw};
  }else{
    if(!ACCT_ID_RE.test(userId)) return acctMsg("아이디는 영문 소문자·숫자·밑줄 4~20자입니다.");
    const nickname=acctVal("acctNick").normalize("NFC").trim();
    if(!ACCT_NICK_RE.test(nickname)) return acctMsg("닉네임은 한글(완성형 글자)·영문·숫자·밑줄 2~12자입니다. 자음·모음만 쓰거나 다른 문자·공백·기호는 쓸 수 없습니다.");
    const email=acctEmail(acctVal("acctEmail"));
    if(!email) return acctMsg("이메일 주소 형식을 확인해 주세요. (예: name@example.com)");
    const bad=acctPwCheck(pw); if(bad) return acctMsg(bad);
    body={userId,nickname,email,password:pw};
  }
  acctMsg(""); acctBusy(true);
  const g=AUTH.gen, r=await acctApi(kind,body);
  acctBusy(false);
  if(g!==AUTH.gen) return;
  if((r.status===200||r.status===201)&&typeof r.body.userId==="string"&&typeof r.body.nickname==="string"){
    acctSetUser(r.body); acctTell(AUTH.user.userId);
    AUTH.view="login"; acctRender();
    showToast(kind==="signup"?"🎉 가입했습니다.":"👋 로그인했습니다.");
    acctResumeSaved(); // 세션이 끊겼던 같은 계정의 좌석이 남아 있으면 이어서 재접속
    return;
  }
  if(r.status===503&&r.body.error==="E_ACCOUNTS_UNAVAILABLE"){ AUTH.state="down"; acctRender(); return; }
  acctClear();
  acctMsg(acctErrText(r,kind));
}

/* ===== 비밀번호 재설정: 아이디 → 등록 이메일로 받은 6자리 코드 확인 → 새 비밀번호 (자동 로그인 없음) =====
   요청은 {userId}, 확인은 {userId,code} — 코드·허가는 아이디에 묶인다(같은 이메일의 다른 계정과 섞이지 않게). 202 일 때만 코드 단계로 간다.
   404 E_ID_NOT_FOUND·409 E_EMAIL_REQUIRED·503·429 는 1단계 그대로 안내한다. 이메일 주소는 받지도 보이지도 않는다.
   각 단계 응답은 요청 때의 rgen·reset 객체와 같을 때만 반영한다. 코드 확인(200 + resetToken) 전에는 새 비밀번호 칸을 보이지 않는다. */
async function acctResetSend(resend){
  const R=AUTH.reset; if(AUTH.busy||AUTH.state!=="anon"||!R||!acctSecure()) return;
  const userId=resend?R.userId:acctVal("acctId").trim().toLowerCase();
  if(!ACCT_ID_RE.test(userId)) return acctMsg("아이디는 영문 소문자·숫자·밑줄 4~20자입니다.");
  const wait=Math.ceil((R.sentAt+ACCT_RESEND_MS-Date.now())/1000);
  if(resend&&wait>0) return acctMsg(wait+"초 뒤에 코드를 다시 받을 수 있습니다.");
  acctMsg(""); acctBusy(true);
  const rg=AUTH.rgen, r=await acctApi("password-reset/request",{userId});
  if(rg!==AUTH.rgen||AUTH.reset!==R) return; // 그 사이 화면·단계가 바뀌었다 — busy 도 새 화면이 정했다
  acctBusy(false);
  if(r.status===202){
    R.userId=userId; R.step="code"; R.sentAt=Date.now(); AUTH.rgen++;
    acctRender(); acctFocus("acctCode");
    if(resend) acctMsg("새 코드를 보냈습니다. 가장 최근에 받은 코드를 입력해 주세요.",true);
    return;
  }
  if(resend&&r.status===503&&r.body.error==="E_MAIL_UNAVAILABLE"){ // 새 발송 실패는 서버가 옛 코드도 지웠다 — 코드 화면에 남지 않고 1단계로(아이디는 남긴다)
    R.step="id"; R.userId=""; R.token=null; R.sentAt=0; AUTH.rgen++;
    acctRender(); acctSetVal("acctId",userId); acctFocus("acctId");
  } // 429 등은 옛 코드가 아직 유효하므로 코드 화면 유지
  acctMsg(acctErrText(r,"reset")); // 없는 아이디·이메일 미등록·메일 불가·잦은 요청 — 보냈다고 하지 않는다
}
async function acctResetVerify(){
  const R=AUTH.reset; if(!R||R.step!=="code") return;
  const code=acctVal("acctCode").replace(/\s/g,"");
  if(!/^\d{6}$/.test(code)) return acctMsg("메일로 받은 6자리 숫자를 입력해 주세요.");
  acctMsg(""); acctBusy(true);
  const rg=AUTH.rgen, r=await acctApi("password-reset/verify",{userId:R.userId,code});
  if(rg!==AUTH.rgen||AUTH.reset!==R) return;
  acctBusy(false); acctClear();
  if(r.status===200&&typeof r.body.resetToken==="string"&&r.body.resetToken){
    R.token=r.body.resetToken; R.step="pw"; AUTH.rgen++;
    acctRender(); acctFocus("acctPw"); return;
  }
  acctMsg(acctErrText(r,"reset"));
}
async function acctResetComplete(){
  const R=AUTH.reset; if(!R||R.step!=="pw"||!R.token) return;
  const pw=acctVal("acctPw"), bad=acctPwCheck(pw); if(bad) return acctMsg(bad);
  acctMsg(""); acctBusy(true);
  const rg=AUTH.rgen, r=await acctApi("password-reset/complete",{resetToken:R.token,newPassword:pw});
  if(rg!==AUTH.rgen||AUTH.reset!==R) return;
  acctBusy(false); acctClear();
  if(r.status===200){
    AUTH.reset=null; AUTH.view="login"; AUTH.rgen++;
    acctTell(null); // 서버가 이 계정의 모든 세션을 끊고 이 브라우저 쿠키도 지웠다 — 같은 프로필의 다른 탭도 다시 확인한다
    acctRender(); acctFocus("acctId");
    acctMsg("비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요.",true);
    return;
  }
  if(r.status===401&&r.body.error==="E_RESET_INVALID"){ // 허가 만료·이미 사용 — 처음부터(아이디는 남긴다)
    R.token=null; R.step="id"; AUTH.rgen++; acctRender();
    acctSetVal("acctId",R.userId);
    acctMsg(ACCT_ERR.E_RESET_INVALID); return;
  }
  acctMsg(acctErrText(r,"reset")); // E_SAME_PASSWORD 등 — 허가는 그대로, 다른 비밀번호로 다시
}

/* 이메일 없는 기존 계정의 선택 등록 (로그인 + 현재 비밀번호) */
async function acctEmailSubmit(){
  if(AUTH.busy||AUTH.state!=="in"||!acctSecure()) return;
  const email=acctEmail(acctVal("acctEmail")), pw=acctVal("acctPw");
  if(!email) return acctMsg("이메일 주소 형식을 확인해 주세요. (예: name@example.com)");
  if(!pw) return acctMsg("현재 비밀번호를 입력해 주세요.");
  acctMsg(""); acctBusy(true);
  const g=AUTH.gen, r=await acctApi("email",{password:pw,email});
  acctBusy(false);
  if(g!==AUTH.gen||AUTH.state!=="in") return;
  if(r.status===200||r.body.error==="E_EMAIL_ALREADY_SET"){
    AUTH.user.hasEmail=true; AUTH.view="login"; acctRender();
    showToast(r.status===200?"📧 이메일을 등록했습니다.":"📧 "+ACCT_ERR.E_EMAIL_ALREADY_SET); return;
  }
  if(r.status===401&&r.body.error==="E_NO_SESSION") return acctEndSession(ACCT_SESSION_ENDED);
  acctClear();
  acctMsg(acctErrText(r,"email"));
}
async function acctLogout(){
  if(AUTH.busy) return;
  AUTH.busy=true;
  const g=AUTH.gen, r=await acctApi("logout",{});
  AUTH.busy=false;
  if(g!==AUTH.gen) return; // 기다리는 동안 다른 탭·서버가 이미 이 신원을 끝냈다
  // 서버가 이 기기 세션을 지웠을 때만 로그아웃으로 표시한다 — 실패를 성공으로 보이면 공용 기기에 세션이 남는다
  if(r.status!==200) return acctMsg("로그아웃하지 못했습니다. "+acctErrText(r,"logout"));
  acctEndSession("로그아웃했습니다.",true);
}
/* 이 탭의 신원이 끝났다 — 열린 방·목록 소켓을 닫고(netLeave — 자동 재접속 없음) 로그인 화면으로 간다. 두 번째 알림은 무시한다.
   explicit(이 기기 로그아웃 성공): 이 계정의 좌석 기록도 지우고 다른 탭에 알린다.
   아니면(서버 E_SESSION_ENDED/close 4003 · 다른 탭의 신원 변경 · 재접속 거절): 좌석 기록은 남긴다. 서버는 #237 대로
   60초 유예 동안 좌석을 두므로, 이 브라우저에서 같은 계정으로 다시 로그인하면 그 기록으로 재접속한다. 끝낸 뒤 프로필의 실제 로그인을 다시 본다. */
const ACCT_SESSION_ENDED="🔒 로그아웃되었거나 다른 곳의 새 로그인·비밀번호 재설정·만료로 이 창의 로그인이 끝났습니다. 다시 로그인해 주세요.";
/* login_replaced: 다른 브라우저·기기의 같은 계정 새 로그인, 또는 이 브라우저(같은 쿠키)의 다른 창에서 한 새 로그인 — 둘 다 이 문구 */
const ACCT_REPLACED="🔒 다른 브라우저·기기 또는 이 브라우저의 다른 창에서 새로 로그인해 이 창은 자동으로 로그아웃되었습니다. 계속하려면 이 창에서 다시 로그인해 주세요.";
function acctEndSession(msg,explicit){
  if(AUTH.state!=="in") return;
  const was=AUTH.user.userId;
  if(explicit) acctSeatDrop();
  else NET.seatToken=null; // netLeave 의 "이 탭 좌석 기록 삭제"를 건너뛴다
  acctSetAnon(); if(!explicit) AUTH.was=was;
  acctToTitle(null);
  showToast(msg);
  if(explicit) acctTell(null);
  else acctCheck(was);
}

/* 입장 경로 게이트 — 타이틀 [대전 시작] */
const _acctUiStart=window.uiStart;
window.uiStart=function(){
  const gate=acctGateMsg();
  if(gate){ showToast("🔒 "+gate); acctFocus("acctId"); return; }
  _acctUiStart();
};
/* 모든 게임 시작(PVE·핫시트·관전·재대전)의 공통 입구. 계정 상태가 정해지기 전(checking)에도 막는다 */
const _acctStartMode=window.startMode;
window.startMode=function(mode,opts){
  const gate=acctGateMsg();
  if(gate) return acctToTitle(gate);
  return _acctStartMode(mode,opts);
};
const _acctNetCreate=window.netCreatePublicRoom, _acctNetJoin=window.netJoinPublicRoom;
window.netCreatePublicRoom=function(){ if(NET.lobbyPending||NET.roomId) return; acctBeforeConnect(()=>_acctNetCreate()); };
window.netJoinPublicRoom=function(roomId){ if(NET.lobbyPending||NET.roomId) return; acctBeforeConnect(()=>_acctNetJoin(roomId)); };
