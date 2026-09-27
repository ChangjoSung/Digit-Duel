"use strict";
/* ===== #260 계정 로비 — 타이틀 [시작] → 실제 로딩(화면 자산·계정 프로필 · 방 목록은 막지 않음) → 로비 =====
   화면 이름은 종전 그대로 "lobby"(uiScreenName)이고, 로딩은 그 안의 한 상태(LOBBY.ready=false)다 — 새 문서·라우터가 아니다.
   - 진행률 숫자를 만들지 않는다. 항목마다 실제 완료·대체 표시·오류만 보인다(자산 n/m 은 실제로 끝난 요청 수).
   - 계정 프로필은 시간 제한(LOBBY_TIMEOUT_MS)이 있는 같은 출처 fetch 하나다. 실패하면 로딩 화면에서 오류·[다시 시도]를 보이고
     전적을 0 으로 꾸미지 않는다. 세션 만료(401 E_NO_SESSION)는 #259 acctEndSession 그대로 로그인 화면으로 간다.
   - 방 목록은 로딩과 함께 요청하지만 기다리지 않는다 — 실패해도 로비는 열리고 방 카드 안에서 다시 시도한다(#217 netRoomsHtml).
   - 재화는 0 고정, 잠긴 메뉴는 누르면 '추후 공개' 안내만 한다(CJ 2026-09-27). 싱글 두 카드도 잠금이다.
   - 대표 하수인: 일반 ROSTER 30종 중 하나(기본 M-F1 새끼 화룡). 서버가 검증·저장하고, 방에는 입장 때 값이 고정된다(서버).
     전투 성능·상점·소유권과 무관한 프로필 표시다. 아트가 없는 10종은 기존 속성 이모지(ELEM_EMO)로 그린다.
   서버 계약: GET /api/profile → {nickname, representativeMinion, stats:{wins,losses}, matches:[≤20 {result:WIN|LOSS|NO_CONTEST, reason,
   opponentNickname, turns, durationMs, endedAt}], pendingMatches} · POST /api/profile/representative {minionId} → {representativeMinion}.
   필드 해석은 LOBBY_API·lobbyParseProfile 두 곳에만 둔다. */
const LOBBY_API={profile:"/api/profile",rep:"/api/profile/representative"}; // Jupiter #260 확정 계약(PD 2026-09-27) — 프로필·최근 기록은 GET 하나
const LOBBY_TIMEOUT_MS=8000, LOBBY_HISTORY_MAX=20, LOBBY_REP_DEFAULT="M-F1";
const LOBBY_ASSETS=["assets/ui/icons.svg","assets/ui/panel.svg"]; // #253 Earth 공용 UI — 실패하면 이모지·CSS 테두리로 그린다
const LOBBY_ICON={help:0,detail:1,history:2,back:3,close:4,resign:5,timer:6,refresh:7,currency:8,lock:9,done:10,loading:11}; // icons.svg 24px 칸 순서
const LOBBY_LOCKED=[["settings","설정"],["currency","재화 획득"],["mission","미션"],["event","이벤트"],["shop","로비 상점"],["minions","하수인 설정"],["rank","랭크"]];
/* assets: null(아직) | [{url,state:"loading"|"ok"|"fail"}] · prof: idle|loading|ok|off|err · profile: 서버 값만 */
const LOBBY={gen:0,assets:null,prof:"idle",profile:null,err:null,repBusy:false,notice:"",focused:false,
  view:"home",next:null,q:"",name:"",nameErr:"",poll:null,rtt:{n:0,t0:0,ms:null,st:"wait",pending:false}}; // #261 view: home(L01)|rooms(L02) · next: 로비에 들어올 때 열 view(방 나가기 → L02)

function lobbyReady(){ return LOBBY.gen===0||!!LOBBY.assets&&LOBBY.assets.every(a=>a.state!=="loading")&&(LOBBY.prof==="ok"||LOBBY.prof==="off"); }
function lobbyArtOk(){ return !!LOBBY.assets&&LOBBY.assets.every(a=>a.state==="ok"); }

/* 제한 시간이 있는 같은 출처 JSON 요청 — 응답이 오지 않는 서버에 갇히지 않는다(AbortController 가 없으면 경주만으로 끝낸다) */
function lobbyFetch(path,init){
  const ac=typeof AbortController==="function"?new AbortController():null;
  let timer=null;
  const late=new Promise(res=>{ timer=setTimeout(()=>{ try{ if(ac) ac.abort(); }catch(e){} res({status:0,body:{},timeout:true}); },LOBBY_TIMEOUT_MS); });
  const go=(async()=>{
    try{
      const r=await fetch(path,Object.assign({credentials:"same-origin",cache:"no-store"},ac?{signal:ac.signal}:{},init||{}));
      let j=null; try{ j=await r.json(); }catch(e){}
      return {status:r.status,body:j&&typeof j==="object"?j:{}};
    }catch(e){ return {status:0,body:{}}; }
  })();
  return Promise.race([go,late]).then(r=>{ try{ clearTimeout(timer); }catch(e){} return r; });
}

/* 서버 프로필 → 화면 값. 모르는·틀린 칸은 꾸미지 않고 null(표시: 확인 불가) */
function lobbyRepOk(id){ return ROSTER.some(r=>r.id===id); }
function lobbyCount(v){ return Number.isInteger(v)&&v>=0?v:null; }
function lobbyParseProfile(b){
  if(!b||typeof b.nickname!=="string"||!ACCT_NICK_RE.test(b.nickname)) return null;
  const st=b.stats&&typeof b.stats==="object"?b.stats:{};
  return {nickname:b.nickname,repMinion:lobbyRepOk(b.representativeMinion)?b.representativeMinion:LOBBY_REP_DEFAULT,
    wins:lobbyCount(st.wins),losses:lobbyCount(st.losses),pending:lobbyCount(b.pendingMatches), // pending: 결과 저장을 기다리는 경기 수(음 아닌 정수) — 모르면 null
    history:Array.isArray(b.matches)?b.matches.slice(0,LOBBY_HISTORY_MAX).map(lobbyParseHist).filter(Boolean):null};
}
const LOBBY_RESULTS={WIN:"win",LOSS:"loss",NO_CONTEST:"void"};
function lobbyParseHist(h){
  if(!h||typeof h!=="object"||!LOBBY_RESULTS[h.result]) return null;
  const ms=lobbyCount(h.durationMs);
  return {result:LOBBY_RESULTS[h.result],opponent:typeof h.opponentNickname==="string"&&ACCT_NICK_RE.test(h.opponentNickname)?h.opponentNickname:null,
    reason:typeof h.reason==="string"?h.reason.toLowerCase():"",turns:lobbyCount(h.turns),sec:ms===null?null:Math.round(ms/1000)};
}

/* ===== 로딩 ===== */
/* 로비에 들어오는 순간 uiApply 가 부른다(ui.js) — 여기서는 화면 전환을 모른다 */
function lobbyLoad(){
  const g=++LOBBY.gen;
  LOBBY.err=null; LOBBY.notice=""; LOBBY.focused=false;
  LOBBY.view=LOBBY.next||"home"; LOBBY.next=null; // #261 결과·타이틀에서 오면 L01, 방 나가기·재접속 포기면 L02
  if(!LOBBY.assets||LOBBY.assets.some(a=>a.state==="fail")) lobbyLoadAssets(g); // 성공한 자산은 다시 받지 않는다(실패한 것만 다시 시도)
  if(AUTH.state==="in") lobbyLoadProfile(g);
  else { LOBBY.prof="off"; LOBBY.profile=null; } // 증명된 계정 없는 서버(file://·DB 없음) — 프로필 없이 로비
  if(/^https?:$/.test(location.protocol)&&!NET.roomId) try{ netListRooms(); }catch(e){} // 기다리지 않는다
  render(); lobbyFocus(); if(lobbyReady()) LOBBY.focused=true; // 이미 끝난 로딩(계정 없는 서버·자산 재사용)은 로비 제목으로 바로
}
/* 화면이 바뀌면 그 화면의 제목으로 키보드·스크린리더 초점을 옮긴다 — 로딩 제목 → (끝나면) 로비 닉네임 제목 */
function lobbyFocus(){ const h=$(!lobbyReady()?"lobbyLoadTitle":LOBBY.view==="rooms"?"roomsTitle":"lobbyNick"); try{ if(h&&h.focus) h.focus({preventScroll:true}); }catch(e){} }
function lobbyLoadAssets(g){
  LOBBY.assets=LOBBY_ASSETS.map(url=>{ const old=(LOBBY.assets||[]).find(a=>a.url===url); return old&&old.state==="ok"?old:{url,state:"loading"}; });
  for(const a of LOBBY.assets.filter(x=>x.state==="loading")){
    const done=st=>{ if(g!==LOBBY.gen||a.state!=="loading") return; a.state=st;
      if(lobbyArtOk()){ const el=$("app"); if(el&&el.classList) el.classList.add("uiArt"); } // 둘 다 실제로 왔을 때만 그림 아이콘·테두리(아니면 이모지·CSS)
      lobbyRerender(); };
    try{
      const im=document.createElement("img"); a.img=im; // 테스트가 onload/onerror 를 직접 부른다
      im.onload=()=>done("ok"); im.onerror=()=>done("fail");
      setTimeout(()=>done("fail"),LOBBY_TIMEOUT_MS); // 응답이 오지 않는 요청도 대체 표시로 끝낸다
      im.src=a.url;
    }catch(e){ a.state="fail"; }
  }
}
function lobbyLoadProfile(g){
  LOBBY.prof="loading"; LOBBY.profile=null;
  const ag=AUTH.gen;
  lobbyFetch(LOBBY_API.profile).then(r=>{
    if(g!==LOBBY.gen||ag!==AUTH.gen) return; // 다른 로딩·다른 신원의 늦은 응답은 버린다
    if(r.status===401&&r.body.error==="E_NO_SESSION"){ LOBBY.prof="idle"; acctEndSession(ACCT_SESSION_ENDED); return; }
    const p=r.status===200?lobbyParseProfile(r.body):null;
    if(p){ LOBBY.profile=p; LOBBY.prof="ok"; }
    else { LOBBY.prof="err"; LOBBY.err=r.timeout?"계정 정보 응답이 늦어 중단했습니다.":r.status===0?"서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.":"계정 정보를 불러오지 못했습니다."; }
    lobbyRerender();
  });
}
function lobbyRerender(){ try{ if(uiScreenName()!=="lobby") return; render(); if(lobbyReady()&&!LOBBY.focused){ LOBBY.focused=true; lobbyFocus(); } }catch(e){} } // 로딩이 끝난 순간 한 번만
function lobbyRetry(){ lobbyLoad(); }

/* ===== 화면 ===== */
function lobbyIcon(key,emoji){ return `<span class="uiIco" style="--i:${LOBBY_ICON[key]}" aria-hidden="true">${emoji}</span>`; }
function lobbyRepHtml(id,cls){
  const rd=ROSTER.find(r=>r.id===id)||ROSTER.find(r=>r.id===LOBBY_REP_DEFAULT);
  const dir=artDirOf({type:"minion",rosterId:rd.id});
  const art=dir&&artOk(dir)&&ART.loaded.has(dir+"/icon.png")?`<img src="${artUrl(dir,"icon.png")}" alt="">`:`<span aria-hidden="true">${ELEM_EMO[rd.element]}</span>`;
  return `<span class="repFace ${cls||""} el-${rd.element}">${art}</span>`;
}
function lobbyLoadingHtml(){
  const a=LOBBY.assets||[], done=a.filter(x=>x.state!=="loading").length;
  const aLabel=done<a.length?`${done}/${a.length} 불러오는 중…`:a.some(x=>x.state==="fail")?"일부 기본 표시로 대체":"완료";
  const pLabel=LOBBY.prof==="off"?"계정 없는 서버":LOBBY.prof==="ok"?"완료":LOBBY.prof==="err"?"오류":"불러오는 중…";
  const rLabel=location.protocol==="file:"?"이 주소에서는 사용할 수 없음":NET.roomsLoading?"불러오는 중… (기다리지 않음)":NET.lobbyMsg?"오류 — 로비에서 다시 시도":NET.roomsLoaded?"완료":"로비에서 불러옵니다";
  return `<div class="lobbyLoading" aria-busy="${LOBBY.prof==="err"?"false":"true"}">
    <h2 id="lobbyLoadTitle" tabindex="-1">${lobbyIcon("loading","⏳")} 로비를 준비하는 중</h2>
    <ul class="loadList" aria-labelledby="lobbyLoadTitle">
      <li><span>화면 자산</span><b role="status">${aLabel}</b></li>
      <li><span>계정 정보</span><b role="status">${pLabel}</b></li>
      <li><span>방 목록</span><b role="status">${rLabel}</b></li>
    </ul>
    ${LOBBY.prof==="err"?`<p class="acctMsg err" role="alert">${escAttr(LOBBY.err)}</p><button type="button" class="primary big" onclick="lobbyRetry()">${lobbyIcon("refresh","↻")} 다시 시도</button>`:""}
  </div>`;
}
function lobbyStatsHtml(p){
  if(!p) return `<small>계정 서버에 로그인하면 닉네임·전적·대표 하수인이 표시됩니다.</small>`;
  const rec=p.wins===null||p.losses===null?"전적 확인 불가":`${p.wins}승 ${p.losses}패`;
  return `<span class="badge" aria-label="공식 전적 ${rec}">${lobbyIcon("history","📜")} ${rec}</span>`;
}
function lobbyHistHtml(p){
  if(!p) return "";
  const RES={win:"승",loss:"패",void:"무효"};
  /* 서버 사유(accounts.js matchReason): 승리 유형(WINTYPE_KO) · forfeit · 무효 3종. 모르는 값은 "경기 종료" — 내부 코드는 화면에 싣지 않는다 */
  const REASON=Object.assign({forfeit:"연결 종료 몰수",both_disconnected:"양쪽 연결이 모두 끊겨 무효",server_restart:"서버 재시작으로 무효",server_error:"서버 문제로 중단"},WINTYPE_KO);
  const dur=s=>s===null?"":` · ${Math.floor(s/60)}분 ${s%60}초`;
  const hs=p.history;
  const pend=p.pending?`<p class="lobbyNotice" role="status">결과 저장을 기다리는 경기 ${p.pending}건 — 저장되면 전적·기록에 반영됩니다.</p>`:"";
  const rows=hs===null?`<small>기록을 확인할 수 없습니다.</small>`
    :hs.length?`<ol class="histList">${hs.map(h=>`<li class="h-${h.result}"><b>${RES[h.result]}</b> vs ${escAttr(h.opponent||"알 수 없음")}
      <small>${escAttr(REASON[h.reason]||"경기 종료")}${h.turns===null?"":` · ${h.turns}턴`}${dur(h.sec)}</small></li>`).join("")}</ol>`
    :`<small>아직 공식 멀티 경기 기록이 없습니다.</small>`;
  return `<section class="lobbyCard" aria-labelledby="histTitle"><h2 id="histTitle">최근 기록 <small>(최근 ${LOBBY_HISTORY_MAX}경기)</small></h2>${pend}${rows}</section>`;
}
function lobbyHtml(){
  if(!lobbyReady()) return lobbyLoadingHtml();
  if(LOBBY.view==="rooms") return lobbyRoomsHtml();
  const p=LOBBY.profile, rd=p?ROSTER.find(r=>r.id===p.repMinion):null;
  const lockBtn=([k,t])=>`<button type="button" class="locked" aria-disabled="true" data-lock="${k}" onclick="lobbyLocked('${t}')">${lobbyIcon("lock","🔒")} ${t}</button>`;
  return `<section class="lobbyProfile" aria-labelledby="lobbyNick">
      ${p?`<button type="button" class="repBtn" onclick="lobbyRepOpen()" aria-label="대표 하수인 변경 — 지금 ${escAttr(rd.name)}">${lobbyRepHtml(p.repMinion)}</button>`:""}
      <div class="lobbyWho"><h2 id="lobbyNick" tabindex="-1">${p?escAttr(p.nickname):"게스트"}</h2>
        ${p?`<small>대표 하수인: ${escAttr(rd.name)}</small>`:""}
        <div class="row">${lobbyStatsHtml(p)}<span class="badge" aria-label="재화 0 — 획득은 추후 공개">${lobbyIcon("currency","💰")} 0</span></div></div>
    </section>
    <p id="lobbyNotice" class="lobbyNotice" role="status" aria-live="polite">${escAttr(LOBBY.notice)}</p>
    <section class="lobbyCard net" aria-labelledby="netLobbyTitle"><span class="tagPill">멀티</span>
      <h2 id="netLobbyTitle">멀티 — 공개 대전</h2>
      <small>방 이름으로 찾아 참가 대기 방에 바로 참가하세요. 초대 코드는 필요하지 않습니다.</small>
      ${lobbyFileWarn()}
      <button type="button" class="primary big" onclick="lobbyRooms()">방 목록 열기</button>
      ${lobbyNetMsgHtml()}
      <span class="badge netStatusLine" id="netStatus" role="status" aria-live="polite" style="display:none"></span></section>
    <section class="lobbyCard" aria-labelledby="singleTitle"><span class="tagPill">싱글</span>
      <h2 id="singleTitle">싱글</h2>
      <div class="lockCards">${["무제한 AI 대전","도전! 왕국 대전"].map(t=>`<button type="button" class="locked lockCard" aria-disabled="true" onclick="lobbyLocked('${t}')">${lobbyIcon("lock","🔒")} <b>${t}</b><small>추후 공개</small></button>`).join("")}</div>
    </section>
    ${lobbyHistHtml(p)}
    <nav class="lockGrid" aria-label="추후 공개 메뉴">${LOBBY_LOCKED.map(lockBtn).join("")}</nav>`;
}
/* 잠긴 메뉴 — 기능 없이 안내만. 버튼은 disabled 가 아니라 aria-disabled 라 키보드로 닿고 Enter·Space 로 안내를 듣는다 */
function lobbyLocked(name){ lobbyNotify(`🔒 ${name} — 추후 공개 예정입니다.`); }
function lobbyNotify(t){ LOBBY.notice=t; const n=$("lobbyNotice"); if(n) n.textContent=t; }
function lobbyFileWarn(){ return location.protocol==="file:"?`<p style="margin:6px 0"><small style="color:var(--buff)">⚠️ html 파일을 직접 연 상태(file://)에서는 공개 대전에 접속할 수 없습니다. 공개 방 서버가 서빙하는 주소로 페이지를 열어 주세요.</small></p>`:""; }
function lobbyNetMsgHtml(){ const m=NET.lobbyMsg; return m?`<div class="netLobbyMsg err" role="alert">${escAttr(m.text)}
    <div class="row"><button type="button" onclick="netListRooms()">${m.kind==="gone"?"다른 방 보기":"다시 시도"}</button></div></div>`:""; }

/* ===== #261 L02 멀티 방 목록 · L03 방 대기 (GDD-24 00.2 'L02 · L03 멀티 방') =====
   - 방 이름·검색어: 정리 전 원문을 허용 문자로 먼저 검사한다(자모·태그 기호·제어 문자·이모지는 여기서 걸린다) → 앞뒤 공백 제거·연속 공백 1칸.
     이름 2~20자(서버가 같은 규칙으로 다시 거부한다 E_BAD_ROOM_NAME), 검색어 1~20자(비면 전체). 표시는 언제나 escAttr 텍스트다.
   - 목록: 서버 행 {roomId,roomName,state,seats,ageSec,players,reps} 중 화면에 필요한 것만 쓴다. 참가는 OPEN 만, 그 밖은 이유를 알리는 aria-disabled.
   - 5초 갱신·핑: L02 가 보이고 로비 소켓이 있을 때만 도는 interval 하나. 다른 화면·방 입장·소켓 없음이면 멈추고, 탭이 숨으면 보내지 않는다.
   - 핑: 로비 소켓의 {t:"rtt",n} ↔ {type:"rtt",n} 실측 왕복(ms 정수). 지금 보낸 n 의 응답만 받는다 — 3초가 지나면 '측정 불가'로 닫고 늦은 응답은 버린다.
     게임 판정·타이머·재접속 유예에는 쓰지 않는다. */
const ROOM_NAME_RAW=/^[가-힣A-Za-z0-9 _-]*$/;
const ROOM_STATE_KO={OPEN:"참가 대기",SETUP:"준비 중",IN_PROGRESS:"대전 중"};
const LOBBY_POLL_MS=5000, LOBBY_RTT_TIMEOUT_MS=3000, ROOM_NAME_MAX=20;
const LOBBY_SEARCH_ERR="검색어는 1~20자의 한글·영문·숫자·공백·밑줄(_)·하이픈(-)만 쓸 수 있습니다.";
function roomNameNorm(raw){ return typeof raw==="string"&&ROOM_NAME_RAW.test(raw)?raw.trim().replace(/ {2,}/g," "):null; }
function lobbyRoomsOn(){ return uiScreenName()==="lobby"&&LOBBY.view==="rooms"&&!NET.roomId; }
function lobbySock(){ return !!(NET.ws&&NET.lobbyOnly&&NET.ws.readyState===1); }

function lobbyRooms(){
  LOBBY.view="rooms"; LOBBY.notice=""; LOBBY.rtt={n:LOBBY.rtt.n,t0:0,ms:null,st:/^https?:$/.test(location.protocol)?"wait":"off",pending:false};
  render(); lobbyFocus();
  if(LOBBY.rtt.st==="off") return; // file:// — 접속할 서버가 없다
  netListRooms(); lobbyPollStart(); // 소켓이 아직 열리는 중이면 lobby_ready 가 다시 부른다
}
function lobbyHome(){ LOBBY.view="home"; LOBBY.notice=""; lobbyPollStop(); render(); lobbyFocus(); }
function lobbyPollStart(){
  if(!lobbyRoomsOn()) return;
  if(!LOBBY.poll){ LOBBY.poll=setInterval(lobbyPollTick,LOBBY_POLL_MS); if(LOBBY.poll&&typeof LOBBY.poll.unref==="function") LOBBY.poll.unref(); }
  lobbyRttSend(); // 들어온 순간 한 번 — 이후는 5초마다
}
function lobbyPollStop(){ if(LOBBY.poll){ try{ clearInterval(LOBBY.poll); }catch(e){} } LOBBY.poll=null; LOBBY.rtt.pending=false; }
function lobbyPollTick(){
  if(!lobbyRoomsOn()||!NET.ws){ lobbyPollStop(); return; } // 다른 화면·방 안·소켓 없음 — 경기로 타이머를 끌고 가지 않는다
  if(document.hidden===true||!lobbySock()) return;      // 탭이 숨으면 보내지 않는다(다시 보이면 다음 tick 부터)
  netSend({v:1,t:"list_rooms"}); lobbyRttSend();
}
function lobbyRttNow(){ return typeof performance!=="undefined"&&performance.now?performance.now():Date.now(); }
function lobbyRttSend(){
  if(!lobbySock()) return;
  const r=LOBBY.rtt, n=r.n=r.n%2147483647+1;
  r.t0=lobbyRttNow(); r.pending=true; if(r.st==="off") r.st="wait";
  netSend({v:1,t:"rtt",n});
  setTimeout(()=>{ if(r!==LOBBY.rtt||r.n!==n||!r.pending) return; r.pending=false; r.st="fail"; lobbyPingPaint(); },LOBBY_RTT_TIMEOUT_MS);
}
function lobbyRttReply(n){
  const r=LOBBY.rtt; if(!r.pending||n!==r.n) return; // 지난 요청·시간 초과 뒤의 늦은 응답은 버린다
  r.pending=false; r.ms=Math.max(0,Math.round(lobbyRttNow()-r.t0)); r.st="ok"; lobbyPingPaint();
}
function lobbyRttOff(){ LOBBY.rtt.pending=false; LOBBY.rtt.st="off"; lobbyPingPaint(); }
function lobbyPingText(){ const r=LOBBY.rtt; return r.st==="ok"?`핑 ${r.ms}ms`:r.st==="fail"?"핑 측정 불가":r.st==="off"?"연결 끊김":"핑 측정 중"; }
function lobbyPingPaint(){ if(!lobbyRoomsOn()) return; const el=$("pingBadge"); if(el) el.textContent=lobbyPingText(); }
/* 목록만 다시 그린다 — 5초 갱신이 입력 중인 검색어·방 이름 칸의 포커스를 빼앗지 않게 */
function lobbyRoomsPaint(){
  if(lobbyRoomsOn()){ const el=$("roomList"); if(el){ el.innerHTML=lobbyRoomListHtml(); try{ el.setAttribute("aria-busy",NET.roomsLoading?"true":"false"); }catch(e){} return; } }
  render();
}
function lobbySearchQuery(){ const q=roomNameNorm(LOBBY.q); return q!==null&&q.length<=ROOM_NAME_MAX?q:null; } // null = 잘못된 검색어
function lobbySearch(v){ LOBBY.q=String(v); const m=$("roomSearchMsg"); if(m) m.textContent=lobbySearchQuery()===null?LOBBY_SEARCH_ERR:""; lobbyRoomsPaint(); }
function lobbyNameInput(v){ LOBBY.name=String(v); }
function lobbyCreateRoom(){
  const n=roomNameNorm(LOBBY.name);
  if(n===null||n.length<2||n.length>ROOM_NAME_MAX){ LOBBY.nameErr=NET_LOBBY_MSG.badName; const m=$("roomNameMsg"); if(m) m.textContent=LOBBY.nameErr; return; }
  LOBBY.nameErr=""; LOBBY.name=n; netCreatePublicRoom(n);
}
function lobbyRoomLocked(st){ lobbyNotify(`이 방은 ${ROOM_STATE_KO[st]||"참가할 수 없는 상태"}이라 참가할 수 없습니다. 참가 대기 방만 들어갈 수 있습니다.`); }
function lobbySeatHtml(nick,rep){
  if(typeof nick!=="string"||!ACCT_NICK_RE.test(nick)) return "";
  return `<span class="roomSeat">${lobbyRepOk(rep)?lobbyRepHtml(rep,"xs"):""}${escAttr(nick)}</span>`;
}
function lobbyRoomRows(){
  const q=lobbySearchQuery(), ql=q?q.toLowerCase():"", age=r=>r.age===null?1e9:r.age;
  const st=rm=>rm.state===undefined?"OPEN":rm.state; // #261 이전 서버는 참가 대기(OPEN) 방만 state 없이 보냈다
  return (NET.rooms||[]).filter(rm=>rm&&Number.isInteger(rm.roomId)&&ROOM_STATE_KO[st(rm)])
    .map(rm=>({id:rm.roomId,name:netRoomName(rm.roomName)||("방 "+rm.roomId),st:st(rm),seats:rm.seats==="2/2"?"2/2":"1/2",age:lobbyCount(rm.ageSec),
      players:Array.isArray(rm.players)?rm.players:[],reps:Array.isArray(rm.reps)?rm.reps:[]}))
    .filter(r=>!ql||r.name.toLowerCase().includes(ql))
    .sort((a,b)=>(+(a.st!=="OPEN"))-(+(b.st!=="OPEN"))||age(a)-age(b)||b.id-a.id); // 참가 대기 먼저, 같은 상태는 최근 방 먼저
}
function lobbyRoomListHtml(){
  const pend=NET.lobbyPending, rows=lobbyRoomRows();
  const empty=NET.roomsLoading?"목록을 불러오는 중…":!NET.roomsLoaded?"[새로 고침]을 누르면 방 목록을 불러옵니다."
    :lobbySearchQuery()&&(NET.rooms||[]).length?"검색 결과가 없습니다.":"열려 있는 방이 없습니다. 새 방을 만들어 보세요.";
  return lobbyNetMsgHtml()+(rows.length?`<ul class="roomList">${rows.map(r=>`<li class="roomRow st-${r.st}">
      <div class="roomHead"><b class="roomName">${escAttr(r.name)}</b> <small class="roomNo">#${r.id}</small></div>
      <div class="roomMeta"><span class="badge roomSt">${ROOM_STATE_KO[r.st]}</span><span class="badge" aria-label="인원 ${r.seats}">${r.seats}</span>${lobbySeatHtml(r.players[0],r.reps[0])}${lobbySeatHtml(r.players[1],r.reps[1])}</div>
      ${r.st==="OPEN"?`<button type="button" ${pend?"disabled":""} aria-label="${escAttr(r.name)} #${r.id} 참가" onclick="netJoinPublicRoom(${r.id})">${pend==="join:"+r.id?"방에 참가하는 중…":"참가"}</button>`
        :`<button type="button" aria-disabled="true" onclick="lobbyRoomLocked('${r.st}')">참가 불가 · ${ROOM_STATE_KO[r.st]}</button>`}</li>`).join("")}</ul>`
    :`<p class="roomEmpty"><small>${empty}</small></p>`);
}
function lobbyRoomsHtml(){
  const pend=NET.lobbyPending;
  return `<section class="roomsScreen" aria-labelledby="roomsTitle">
    <div class="roomsHead"><h2 id="roomsTitle" tabindex="-1">멀티 방 목록</h2><span id="pingBadge" class="badge pingBadge" title="내 브라우저와 게임 서버 사이의 왕복 시간">${lobbyPingText()}</span></div>
    ${lobbyFileWarn()}
    <p id="lobbyNotice" class="lobbyNotice" role="status" aria-live="polite">${escAttr(LOBBY.notice)}</p>
    <div class="roomSearch"><label for="roomSearch">방 이름 검색</label>
      <div class="row"><input id="roomSearch" type="search" maxlength="40" autocomplete="off" value="${escAttr(LOBBY.q)}" oninput="lobbySearch(this.value)" aria-describedby="roomSearchMsg">
      <button type="button" ${pend?"disabled":""} onclick="netListRooms()">${lobbyIcon("refresh","↻")} 새로 고침</button></div>
      <p id="roomSearchMsg" class="acctMsg err" role="alert">${lobbySearchQuery()===null?LOBBY_SEARCH_ERR:""}</p></div>
    <div id="roomList" class="netRoomList" aria-busy="${NET.roomsLoading?"true":"false"}">${lobbyRoomListHtml()}</div>
    <form class="roomCreate" onsubmit="lobbyCreateRoom();return false;" aria-labelledby="roomCreateTitle">
      <h3 id="roomCreateTitle">새 방 만들기</h3>
      <label for="roomName">방 이름 (2~20자)</label>
      <input id="roomName" type="text" maxlength="40" autocomplete="off" value="${escAttr(LOBBY.name)}" oninput="lobbyNameInput(this.value)" aria-describedby="roomNameHint roomNameMsg">
      <small id="roomNameHint">한글·영문·숫자·공백·밑줄(_)·하이픈(-)만 쓸 수 있습니다. 개인정보를 방 이름에 입력하지 마세요.</small>
      <p id="roomNameMsg" class="acctMsg err" role="alert">${escAttr(LOBBY.nameErr)}</p>
      <button type="submit" class="primary big" ${pend?"disabled":""}>${pend==="create"?"방을 만드는 중…":"방 만들기"}</button>
    </form>
    <span class="badge netStatusLine" id="netStatus" role="status" aria-live="polite" style="display:none"></span>
  </section>`;
}
/* L03 — 방을 만든 사람만 OPEN 동안 여기서 기다린다. 두 번째 참가자가 앉으면(SETUP) 기존 시작 상점으로 간다. 새 준비 버튼·대기 시간 없음 */
function lobbyWaitHtml(){
  const me=NET.me===1?1:0;
  const seat=i=>{ const n=NET.players&&NET.players[i], rep=NET.reps&&NET.reps[i];
    const face=lobbyRepOk(rep)?lobbyRepHtml(rep):`<span class="repFace" aria-hidden="true">${i===me?"?":"…"}</span>`;
    return `<li class="waitSeat${n||i===me?"":" empty"}">${face}<b>${n?escAttr(n):i===me?"나":"입장 대기"}</b>${n&&i===me?" <small>(나)</small>":""}</li>`; };
  return `<section class="waitScreen" aria-labelledby="netRoomTitle">
    <h2 id="netRoomTitle" tabindex="-1">${escAttr(NET.roomName||("방 "+NET.roomId))} <small>#${escAttr(String(NET.roomId))}</small></h2>
    <p class="lobbyNotice" role="status" aria-live="polite">상대를 기다리는 중… 상대가 들어오면 시작 상점(90초)이 열립니다.</p>
    <ul class="waitSeats" aria-label="참가자">${seat(me)}${seat(1-me)}</ul>
    <div class="row netRoomActions"><button type="button" class="danger" onclick="netLeaveRoom()">방 나가기</button></div>
  </section>`;
}

/* 방 안: 서버가 좌석 입장 때 고정해 보낸 상대 대표 하수인(NET.reps) — 모르면 아무것도 그리지 않는다 */
function lobbySeatRepHtml(seat){
  const id=NET.reps&&NET.reps[seat], rd=id?ROSTER.find(r=>r.id===id):null; if(!rd) return "";
  const n=NET.players&&NET.players[seat];
  return `<span class="badge seatRep" aria-label="${n?escAttr(n)+" · ":""}대표 하수인 ${escAttr(rd.name)}">${lobbyRepHtml(id,"xs")}${n?escAttr(n)+" · ":""}${escAttr(rd.name)}</span>`;
}

/* ===== 대표 하수인 선택 — 일반 30종, 저장은 서버(검증·계정 저장). 방에 들어간 뒤에는 로비가 아니라 이 창이 없다 ===== */
function lobbyRepOpen(){
  const p=LOBBY.profile; if(!p||uiScreenName()!=="lobby"||NET.roomId) return;
  const cards=ROSTER.map(r=>`<button type="button" class="repPick" aria-pressed="${r.id===p.repMinion}" onclick="lobbyRepPick('${r.id}')">${lobbyRepHtml(r.id,"sm")}<span>${escAttr(r.name)}</span><small>${ELEM_KO[r.element]}</small></button>`).join("");
  modal(`<h2 id="repTitle">대표 하수인</h2><p><small>프로필에만 보이는 표시입니다. 전투 성능·상점·소유권과 무관하며, 이미 들어간 방에는 다음 방부터 적용됩니다.</small></p>
    <div class="repGrid" role="group" aria-labelledby="repTitle">${cards}</div>`,[["닫기",closeModal]]);
}
async function lobbyRepPick(id){
  const p=LOBBY.profile; if(!p||LOBBY.repBusy||!lobbyRepOk(id)) return;
  if(id===p.repMinion){ closeModal(); return; }
  LOBBY.repBusy=true;
  const g=LOBBY.gen, ag=AUTH.gen;
  const r=await lobbyFetch(LOBBY_API.rep,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({minionId:id})});
  LOBBY.repBusy=false;
  if(g!==LOBBY.gen||ag!==AUTH.gen||LOBBY.profile!==p) return;
  if(r.status===401&&r.body.error==="E_NO_SESSION") return acctEndSession(ACCT_SESSION_ENDED);
  if(r.status===200&&r.body.representativeMinion===id){ p.repMinion=id; closeModal(); render(); showToast("대표 하수인을 바꿨습니다."); return; }
  showToast("대표 하수인을 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요."); // 이전 값을 그대로 둔다
}
