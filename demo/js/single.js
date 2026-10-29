"use strict";
/* ===== #265·#322·#324 (v0.4.16 · CJ 2026-10-30 승인) 싱글플레이 — 학습 경기 온보딩 · P01 싱글 선택 · P02 무제한 AI 난이도 · S04p PVE 결과 =====
   의미·문구는 PLAN Singleplayer Draft 'v0.4.16 확정 계약'(Venus), API 는 SERVER Operations(Jupiter)가 정본이다:
     signup 201 · login 200 · GET /api/auth/session 200 의 progress:{tutorialDone:boolean, aiClearedTier:0..3}
     POST /api/profile/tutorial {v:1,userId,end:"skip"|"king"|"edge"|"wipe"} · POST /api/profile/ai-clear {v:1,userId,tier:1..3,end:"king"|"edge"|"wipe"} → 200 {progress}
   - 상태는 셋: 확인됨·완료 / 확인됨·미완료 / 확인 불가(오류·필드 누락·형식 이상). 확인 불가는 미완료로도 완료로도 취급하지 않는다.
   - 분기(§2 · CJ 원문 2026-10-30 PM 정정): 새 로그인·가입 성공은 추가 [시작] 없이 로딩 → 미완료 학습 경기 · 완료 로비. 유효 세션 페이지 재진입은 타이틀 먼저 → [시작].
     좌석 재접속(#237)과 401 로 멈춘 같은 계정 저장 확인이 먼저다.
   - 진행은 서버 200 의 progress 로만 바뀐다(낙관적 해금 없음). 저장 요청은 정상 종료(왕 제거·끝줄·전멸)의 승·패·명시적 건너뛰기뿐.
   - 응답 유실(503·연결 실패·시간 초과)은 상태 조회 1회만 자동. 재시도는 사용자 버튼(조회 → 필요할 때만 저장). 요청 때의 계정·AUTH.gen 과 다른 응답은 버린다.
     401 은 같은 계정으로 다시 로그인했을 때만 조회 뒤 다시 보낸다 — 계정 사이로 옮기지 않는다.
   - 계정 없는 경로(file:// · DB 없는 서버 = AUTH off)는 학습을 강요하지 않고, 실버·골드 해금은 이번 로드 메모리만(SP.local).
   - 브라우저 AI 경기의 자기신고(② 등급) 진행 표시다 — 공식 전적·최근 20경기·재화·랭킹·보상과 무관하고 승리 증명이 아니다. */
const SP_API={tutorial:"/api/profile/tutorial",clear:"/api/profile/ai-clear"};
const SP_TIERS=["bronze","silver","gold"];                       // AI_TIER 키 — 서버 tier = 순서 + 1
const SP_FUTURE=["플래티넘","다이아","마스터","그랜드마스터","천상계"]; // 추후 공개 — 서버·엔진 모두 없다(골드 클리어가 열지 않는다)
const SP_TUT_LEVEL="bronze", SP_ENDS=["king","edge","wipe"];
/* uid: progress 의 주인 · tut/run: 학습 경기·무제한 AI 경기({game:S}) · ask/guide: 열린 질문·안내(이 동안 시계·AI 정지) · gq: 첫 발생 안내 대기
   save: 마지막 저장 {kind,body,uid,st:busy|ok|fail|auth,msg,unknown} · pending: 401 로 멈춘 저장 · note: 해금 알림 1회 · held: 직전 정지 여부 · local: 계정 없는 체험의 클리어(이번 로드) */
const SP={uid:null,progress:/** @type {null|{tutorialDone:boolean,aiClearedTier:number}} */(null),tut:/** @type {any} */(null),run:/** @type {any} */(null),
  ask:false,guide:/** @type {null|string} */(null),gq:/** @type {string[]} */([]),save:/** @type {any} */(null),pending:/** @type {any} */(null),note:"",held:false,restore:/** @type {any} */(null),local:0,gen:-1}; // gen: progress 를 받은 인증 세대(AUTH.gen)

function spParseProgress(p){
  return p&&typeof p==="object"&&typeof p.tutorialDone==="boolean"&&Number.isInteger(p.aiClearedTier)&&p.aiClearedTier>=0&&p.aiClearedTier<=3
    ?{tutorialDone:p.tutorialDone,aiClearedTier:p.aiClearedTier}:null;
}
/* acctSetUser 가 서버 신원 응답마다 부른다. 다른 계정이면 옛 계정의 진행·경기·저장을 모두 버린다. 같은 계정은 단조로만 합친다 */
function spOnUser(b){
  const uid=String(b.userId);
  if(SP.uid!==uid){
    const kept=SP.pending&&SP.pending.game===S; // 401 로 남겨 둔 옛 계정의 경기 — 다른 계정에게 보이지 않게 버린다
    SP.uid=uid; SP.progress=null; SP.tut=null; SP.run=null; SP.save=null; SP.pending=null; SP.note=""; SP.gq=[]; SP.ask=false; SP.guide=null; spDlgClose(); spSync();
    if(kept){ uiResetScreen(); newGame("pvp",{phase:"menu"}); }
  } else if(SP.gen!==AUTH.gen) SP.progress=null; // 같은 계정의 새 인증 세대(로그아웃·재로그인·다른 탭) — 옛 캐시를 버린다: 이번 응답에 progress 가 없으면 '확인 불가'(미완료로 오인하지 않는다)
  SP.gen=AUTH.gen;
  const p=spParseProgress(b.progress), o=SP.progress;
  if(p) SP.progress=o?{tutorialDone:o.tutorialDone||p.tutorialDone,aiClearedTier:Math.max(o.aiClearedTier,p.aiClearedTier)}:p;
}
function spSignedIn(){ return AUTH.state==="in"&&!!AUTH.user&&SP.uid===AUTH.user.userId; }
function spNeedTut(){ return spSignedIn()&&!!SP.progress&&!SP.progress.tutorialDone; } // 서버가 미완료라고 답했을 때만
function spHeld(){ return SP.ask||!!SP.guide; }
/* 정지 ↔ 재개 전이 — 준비·정기 상점·B08 마감(clkHold), 행동·전투·대상 선택 시계(turnClockWants 가 spHeld 를 본다), AI 예약(aiHeldNow) */
function spSync(){
  const h=spHeld(); if(h===SP.held) return; SP.held=h;
  clkHold(h); try{ turnClockSync(); }catch(e){}
  if(!h) aiHoldRelease();
}
function spAnnounce(t){ showToast(t); const el=$("spLive"); if(el) el.textContent=t; }
function spTierKo(i){ return AI_LEVEL_KO[SP_TIERS[i]]; }

/* ===== 진입 분기 ===== */
/* 로그인·가입·세션 복원 뒤(account.js). fresh = 이 탭에서 새로 로그인·가입에 성공했다.
   ① 401 로 멈췄던 같은 계정의 저장이 먼저다(§3.7): 남겨 둔 원 결과·질문 화면으로 되돌리고 상태 조회만 한다 — 아직이면 [다시 시도](사용자)로만 다시 보낸다.
      좌석 재접속이 시작됐으면 화면을 바꾸지 않는다(재접속 우선).
   ② 새 로그인·가입은 추가 [시작] 없이 로딩으로 — 미완료면 학습 질문, 완료·확인 불가면 로비(uiStart 가 가른다). 좌석 재접속이 시작됐거나 이미 입장했으면 하지 않는다.
   ③ 유효 세션으로 페이지를 다시 연 경우(fresh 아님)는 종전대로 타이틀 먼저 → [시작] 에서 가른다. */
function spRoute(fresh){
  if(AUTH.state!=="in") return;
  const v=SP.pending;
  if(v&&v.uid===AUTH.user.userId){ spRestore(v); return; }
  if(fresh) spEnter();
}
/* 남은 저장 문맥(v)을 원 화면으로 되돌리고 상태 조회만 한다. 좌석 재접속이 진행 중이면 화면에서만 걷고(종전 순서) 문맥은 SP.pending 에 그대로 둔다 —
   좌석이 끝나 로비로 오는 순간(spGate) 같은 경기 객체를 단일 커밋 지점(commitNewGame)으로 다시 세우고 이어 간다. 상태가 확정되기 전에는 새 학습을 시작하지 않는다 */
function spRestore(v){
  if(NET.roomId!=null||!!NET.ws&&!NET.lobbyOnly){ SP.ask=false; spDlgClose(); spSync(); if(S===v.game){ uiResetScreen(); newGame("pvp",{phase:"menu"}); } return; }
  SP.pending=null;
  if(v.game&&v.game.phase!=="menu"){ netLeave(); if(S!==v.game) commitNewGame(v.game); UI.entered=true; SP.ask=!!v.ask; render(); } // 되살린 로컬 경기도 spStart 와 같은 경계 — 좌석 뒤 로비 진입이 연 방 목록 소켓을 닫는다(남으면 행동이 공개 방 회선으로 간다)
  spSync(); spRecheck(v,false);
}
/* 로비로 보내려는 순간([시작]·toLobby·로비 진입) — 남은 저장 문맥이 먼저, 그다음 미완료 학습. 좌석 재접속 중이면 아무것도 하지 않는다 */
function spGate(){
  if(AUTH.state!=="in"||NET.roomId!=null) return false;
  const v=SP.pending; if(v&&v.uid===AUTH.user.userId){ uiResetScreen(); spRestore(v); return true; }
  if(spNeedTut()){ uiResetScreen(); spTutEnter(); return true; }
  return false;
}
function spEnter(){ if(AUTH.state==="in"&&!UI.entered&&!NET.ws&&NET.roomId==null) uiStart(); }
/* 학습 경기 입장 — 진입마다 건너뛰기 질문 1회. 질문이 떠 있는 동안 준비 180초·AI 는 멈춰 있다 */
/* 로컬 PVE 시작 전에 로비 방 목록 소켓을 닫는다 — 열린 채면 NET.publicMode 가 켜져 있어 PVE 행동이 공개 방 회선으로 간다(toLobby 와 같은 netLeave · 좌석 기록은 건드리지 않는다) */
function spStart(level){ netLeave(); startMode("pve",{aiLevel:level}); }
function spTutEnter(){
  SP.ask=true;
  spStart(SP_TUT_LEVEL);
  if(!S||S.mode!=="pve"){ SP.ask=false; spSync(); return; } // 입장 게이트(계정 확인 중 등)에 막혔다
  SP.tut={game:S,seen:{}}; SP.run=null; SP.save=null; SP.gq=[];
  spSync(); spAskRender();
}
const _spUiStart=window.uiStart;
window.uiStart=function(){ if(!acctGateMsg()&&spGate()) return; _spUiStart(); }; // 타이틀 [시작] — 남은 저장 문맥 · 미완료 계정은 로비 대신
const _spToLobby=window.toLobby;
window.toLobby=function(){ if(spGate()) return; _spToLobby(); }; // 결과·준비의 로비 복귀도 같다(미완료면 다시 질문부터)
const _spRematch=window.rematch;
window.rematch=function(){ if(SP.run&&SP.run.game===S){ const t=SP.run.tier; uiResetScreen(); spPlay(t-1); return; } _spRematch(); };
/* 로비에 들어오는 순간(lobbyLoad) — 다른 경로(좌석 종료·재접속 포기 등)로 들어와도 남은 저장 문맥 → 미완료 학습 순서로 · 해금 알림은 로딩이 끝난 뒤 한 번 */
function spLobbyEnter(){
  if(NET.roomId==null&&(SP.pending||spNeedTut())){ setTimeout(()=>{ if(uiScreenName()==="lobby") spGate(); },0); return; }
  spNote();
}
function spNote(){ if(SP.note&&uiScreenName()==="lobby"&&lobbyReady()){ const t=SP.note; SP.note=""; spAnnounce(t); } } // lobbyRerender 도 부른다
const SP_UNLOCK_NOTE="🔓 무제한 AI 대전이 열렸어요. 브론즈부터 도전해 보세요.";

/* ===== 질문·안내 창 (#spGuide) — 게임 모달·전투 위, 재접속 줄 아래. 열린 동안 #app·#overlay 는 inert(tutSetInert) ===== */
function spDlgShow(html){
  const el=$("spGuide"); if(!el) return;
  if(!el.innerHTML){ const a=document.activeElement; SP.restore=a&&a!==document.body?a:null; } // 비어 있음 = 닫혀 있었다(다시 그리기는 복귀 자리를 바꾸지 않는다)
  el.innerHTML=html; el.classList.remove("hidden"); tutSetInert(true);
  try{ const b=el.querySelector("button.primary"); if(b&&!b.disabled) b.focus({preventScroll:true}); }catch(e){}
}
function spDlgClose(){
  const el=$("spGuide"); if(!el||!el.innerHTML) return;
  el.classList.add("hidden"); el.innerHTML=""; if(!TUT.open) tutSetInert(false);
  const r=SP.restore; SP.restore=null;
  try{ if(r&&r.isConnected!==false&&!r.disabled&&r.focus) r.focus({preventScroll:true}); else modalFocus(); }catch(e){}
}
/* 저장 줄(§3.6) — 저장 중·저장됨·저장하지 못했어요·저장 여부 불명. 실패는 role=alert, 그 밖은 role=status */
function spSaveLine(v,okText){
  if(!v) return "";
  if(v.st==="busy"||v.st==="auth") return `<p class="lobbyNotice spSave" role="status">저장 중…</p>`;
  if(v.st==="ok") return `<p class="lobbyNotice spSave" role="status">✓ ${okText||"저장됨"}</p>`;
  return `<p class="acctMsg err spSave" role="alert">${escAttr(v.msg)}</p>`;
}
function spAskRender(){
  const v=SP.save, busy=!!v&&v.st==="busy", dis=busy?" disabled":"";
  spDlgShow(`<div class="histCard spCard"><h2 id="spDlgT">첫 경기로 배워 볼까요?</h2>
    <p id="spDlgD">AI와 연습 경기를 하며 기본 규칙을 배워요. 이 경기는 공식 전적에 들어가지 않아요.</p>
    ${v?spSaveLine(v):""}<div class="row"><button type="button" class="primary" onclick="spAskGo()"${dis}>진행</button><button type="button" onclick="spAskSkip()"${dis}>건너뛰기</button></div></div>`);
}
function spAskGo(){ if(!SP.ask||SP.save&&SP.save.st==="busy") return; SP.ask=false; SP.save=null; spDlgClose(); spSync(); render(); }
function spAskSkip(){ if(!SP.ask||SP.save&&SP.save.st==="busy") return; if(SP.save&&SP.save.st==="fail") spRetry(); else spSave("tutorial",{end:"skip"}); }

/* ===== 학습 안내 H1~H6 (PLAN §3.3 확정 문구) — 그 장면이 처음 올 때 한 장씩. 예외 이동 등 기존 상황 도움말(TUT_HINTS)은 Core 가 낼 때 같은 창으로 =====
   H5 의 순환은 BEATS(spCycleText)와 같아야 한다 — 회귀가 대조한다. 새 규칙·10장 설명을 되살리지 않는다 */
function spCycleText(){ return elemCycle().reverse().map(k=>ELEM_KO[k]).join("→"); }
const SP_GUIDE={
  H1:{icon:"🛒",t:"시작 상점",x:"시작 상점에서 하수인을 사서 필드를 채워요. 남은 코인으로 아이템·버프도 살 수 있어요."},
  H2:{icon:"🎭",t:"배치",x:"말을 배치해요. 상대에게 내 말은 정체를 알 수 없는 ?로 보여요. 왕을 숨기세요."},
  H3:{icon:"🏆",t:"이기는 법",x:"상대 왕 잡기 · 내 왕이 상대 끝줄에 서기 · 상대 하수인·동료 전멸, 셋 중 하나면 이겨요."},
  H4:{icon:"🌲",t:"움직이기",x:"말 하나를 위·아래·옆으로 한 칸 움직여요(대각선 X). 숲의 말은 바로 옆에서만 보여요. 예외 이동은 생길 때 따로 알려 드려요."},
  H5:{icon:"⚔️",t:"강제 전투와 상성",x:"옆에 새로 붙으면 꼭 싸워요. 불→풀→땅→번개→물→불 순서로 상성이 있어요(화살표 왼쪽이 유리)."},
  H6:{icon:"🛒",t:"정기 상점",x:"정기 상점이에요. 하수인과 상품을 사고 팔 수 있어요."}};
const SP_H=["H1","H2","H3","H4","H5","H6"];
function spForced(){ return !!(S.forcedTargets&&S.forcedTargets.length)||!!(S.battle&&S.movedPiece&&S.battle.attP===S.movedPiece); } // 옆에 새로 붙은 말의 전투(선택 전투가 아니다)
function spGuideNext(T){
  const q=SP.gq.find(k=>!T.seen[k]); if(q) return q;
  const want=S.phase==="setup"?[UI.prep==="place"?"H2":"H1"]
    :S.phase==="shop"?(shopViewer()===0?["H6"]:[])
    :S.phase==="play"?[spForced()?"H5":"",!S.battle&&S.current===0?"H3":"",!S.battle&&S.current===0&&S.selected&&!S.selected.tray&&S.selected.owner===0?"H4":""]:[];
  return want.find(k=>k&&!T.seen[k])||null;
}
function spGuideCheck(){
  if((SP.ask||SP.guide)&&S.phase==="menu"){ SP.ask=false; SP.guide=null; spDlgClose(); spSync(); } // 학습 경기가 걷혔다(세션 종료·계정 전환 → 타이틀) — 질문·안내도 닫는다
  const T=SP.tut; if(!T||T.game!==S||SP.ask||SP.guide||S.phase==="over"||S.phase==="menu") return;
  const k=spGuideNext(T); if(k) spGuideOpen(k);
}
function spGuideEvent(key){ const T=SP.tut; if(!T||T.game!==S||!TUT_HINTS[key]||T.seen[key]||SP.gq.includes(key)) return; SP.gq.push(key); spGuideCheck(); } // Core tutHint — 학습 경기에서만
function spGuideOpen(k){
  const T=SP.tut, H=TUT_HINTS[k], g=SP_GUIDE[k]||{icon:H.icon,t:"알아 두기",x:H.text};
  T.seen[k]=true; SP.gq=SP.gq.filter(x=>x!==k); SP.guide=k; spSync();
  spDlgShow(`<div class="histCard spCard"><p class="spKicker">학습 경기 안내${SP_GUIDE[k]?` · ${k}`:""}</p>
    <h2 id="spDlgT"><span aria-hidden="true">${g.icon}</span> ${g.t}</h2><p id="spDlgD">${escAttr(g.x)}</p>
    <small>안내가 떠 있는 동안 시간과 AI가 멈춰 있어요.</small><div class="row"><button type="button" class="primary" onclick="spGuideClose()">확인</button></div></div>`);
}
function spGuideClose(){ if(!SP.guide) return; SP.guide=null; spDlgClose(); spSync(); render(); } // 다음 장면 안내는 다시 그릴 때(render → spGuideCheck)
if(typeof document!=="undefined"&&document.addEventListener) document.addEventListener("keydown",e=>{
  const el=$("spGuide"); if(!el||!el.innerHTML) return;
  if(e.key==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); if(SP.guide) spGuideClose(); return; } // 질문(진행/건너뛰기)은 Esc 로 사라지지 않는다(§3.1)
  if(e.key!=="Tab") return;
  e.stopImmediatePropagation(); // 아래 게임 모달의 Tab 순환이 inert 창으로 포커스를 끌지 않게
  const f=[...el.querySelectorAll("button:not([disabled])")]; if(!f.length) return;
  const i=f.indexOf(/** @type {any} */(document.activeElement)), to=e.shiftKey?(i<=0?f.length-1:i-1):(i<0||i>=f.length-1?0:i+1);
  e.preventDefault(); f[to].focus();
},true);

/* ===== 경기 종료 → 저장 (ui.js matchEnded) ===== */
function spMatchEnded(ev){
  const T=SP.tut, R=SP.run, tut=!!T&&T.game===S, run=!!R&&R.game===S; if(!tut&&!run) return;
  if(SP.guide){ SP.guide=null; spDlgClose(); spSync(); }                       // 끝난 경기의 안내는 닫는다
  const end=SP_ENDS.includes(ev.winType)?ev.winType:null;                      // 기권·무승부는 요청하지 않는다
  if(!end) return;
  if(tut){ spSave("tutorial",{end}); return; }                                 // 승·패 무관 정상 종료
  if(ev.winner!==0) return;
  if(AUTH.state==="off"){ if(R.tier>SP.local){ SP.local=R.tier; spUnlockNote(R.tier); } return; } // 계정 없는 체험 — 이번 로드 메모리만
  if(!SP.progress||R.tier>SP.progress.aiClearedTier) spSave("clear",{tier:R.tier,end}); // 새 티어 승리만 — 재도전 승리는 바뀔 것이 없다(§6 생략 허용)
}
function spSave(kind,x){
  if(!spSignedIn()) return; // 계정 없는 체험 — 저장하지 않는다
  spSend({kind,body:Object.assign({v:1,userId:AUTH.user.userId},x),uid:AUTH.user.userId,st:"busy",msg:"",unknown:false});
}
function spSatisfied(v){ const p=SP.progress; return !!p&&(v.kind==="tutorial"?p.tutorialDone:p.aiClearedTier>=v.body.tier); }
const SP_FAIL="저장하지 못했어요.", SP_UNKNOWN="저장 여부를 확인하지 못했어요.";
function spSend(v){
  SP.save=v; SP.pending=null; v.st="busy"; v.msg=""; v.unknown=false;
  spPaint();
  const ag=AUTH.gen;
  lobbyFetch(SP_API[v.kind],{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(v.body)}).then(r=>{
    if(SP.save!==v||ag!==AUTH.gen) return; // 다른 저장·다른 신원으로 바뀐 뒤의 늦은 응답
    const p=r.status===200?spParseProgress(r.body.progress):null;
    if(p){ spOnUser({userId:v.uid,progress:p}); if(spSatisfied(v)) spOk(v); else spFail(v,SP_FAIL,false); return; }
    if(r.status===401){ spAuthLost(v); return; }
    if(r.body.error==="E_ACCOUNT_MISMATCH"){ spFail(v,SP_FAIL,false); acctResumeProbe(); return; } // 다른 계정 세션 — 대조가 로그인 화면으로 보낸다
    if(r.body.error==="E_TIER_LOCKED"){ spFail(v,SP_FAIL,false); spRecheck(null,false); return; } // 진행이 어긋났다 — 표시만 서버 값으로
    if(r.status>=400&&r.status<500) { spFail(v,SP_FAIL,false); return; }                     // 명시적 거절
    spRecheck(v,false); // 503·연결 실패·시간 초과·모르는 응답 — 저장됐는지 모른다 → 조회 1회만 자동
  });
}
/* 커밋 여부 조회 — 같은 계정의 서버 progress 로만 판단한다. v=null 이면 진행 표시만 새로 받는다. send: 아직이면 이어서 저장(사용자 [다시 시도]만).
   GET 도 로비와 같은 유한 마감(lobbyFetch 8초) — 응답이 오지 않으면 '저장 여부를 확인하지 못했어요' + [다시 시도]로 닫는다 */
const SP_SESSION="/api/auth/session";
function spRecheck(v,send){
  if(v){ SP.save=v; SP.pending=null; v.st="busy"; spPaint(); }
  const ag=AUTH.gen;
  lobbyFetch(SP_SESSION).then(r=>{
    if(ag!==AUTH.gen||v&&SP.save!==v) return;
    if(acctIsUser(r)&&r.body.userId===SP.uid){
      acctSetUser(r.body);
      if(!v){ spPaint(); return; }
      if(spSatisfied(v)) spOk(v); else if(!spParseProgress(r.body.progress)) spFail(v,SP_UNKNOWN,true); else if(send) spSend(v); else spFail(v,SP_FAIL,false);
      return; }
    if(r.status===401&&r.body.error==="E_NO_SESSION"){ if(v) spAuthLost(v); else acctEndSession(ACCT_SESSION_ENDED); return; }
    if(acctIsUser(r)){ acctEndSession(ACCT_TAB_SWITCHED); return; } // 다른 계정 — 이 저장을 옮기지 않는다
    if(v) spFail(v,SP_UNKNOWN,true); else spPaint();
  });
}
/* 401 — 끝난 경기(결과·질문)를 지우지 않고 로그인 화면으로. 같은 계정이 다시 로그인하면 spRestore 가 그 화면으로 되돌리고 · 다른 계정이면 spOnUser 가 버린다 */
function spAuthLost(v){ v.st="auth"; v.game=S; v.ask=SP.ask; SP.pending=v; if(SP.ask) spDlgClose(); acctEndSession(ACCT_SESSION_ENDED,false,true); }
function spFail(v,msg,unknown){ v.st="fail"; v.msg=msg; v.unknown=unknown; spPaint(); if(!SP.ask&&uiScreenName()!=="result") showToast("⚠️ "+msg); } // 화면 밖(재접속 우선으로 되돌리지 못한 경우)이면 토스트로
/* [다시 시도] — 저장 여부 불명이면 조회 → 필요할 때만 저장, 아니면 같은 요청을 다시(멱등) */
function spRetry(){ const v=SP.save; if(!v||v.st!=="fail"||!spSignedIn()||v.uid!==AUTH.user.userId) return; if(v.unknown) spRecheck(v,true); else spSend(v); }
function spOk(v){
  v.st="ok";
  if(v.kind==="tutorial"){
    SP.note=SP_UNLOCK_NOTE;
    if(NET.roomId!=null){ SP.ask=false; spDlgClose(); spSync(); return; }    // 좌석 재접속 중 — 로비로 끌고 가지 않는다(재접속 우선)
    if(SP.ask){ SP.ask=false; spDlgClose(); spSync(); toLobby(); return; }     // 건너뛰기 — 저장 확인 뒤 바로 로비(§3.1)
    if(!(SP.tut&&SP.tut.game===S&&S.phase==="over")){ toLobby(); return; }     // 재로그인 뒤 다시 보낸 저장 — 결과 화면이 이미 없다
  } else spUnlockNote(v.body.tier);
  spPaint();
  try{ const b=$("spGo"); if(b&&b.focus) b.focus({preventScroll:true}); }catch(e){} // ACK 뒤 [로비로] 활성·초점(§3.6)
}
function spUnlockNote(tier){ spAnnounce(tier<3?`🔓 ${spTierKo(tier)}가 열렸어요.`:`🏅 ${spTierKo(2)} 클리어!`); } // 다음 티어 해금 1회 · 골드는 상위를 열지 않는다
function spPaint(){ if(SP.ask) spAskRender(); else if(uiScreenName()==="result"||uiScreenName()==="lobby") render(); }

/* ===== 결과(S04p · 학습 결과) — ui.js renderSide 가 부른다. 학습 경기·무제한 AI 경기가 아니면 null ===== */
function spResultHtml(){
  const T=SP.tut, R=SP.run, tut=!!T&&T.game===S, run=!!R&&R.game===S; if(!tut&&!run) return null;
  const w=S.winner, wt=S.metrics.winType, end=SP_ENDS.includes(wt), v=SP.save&&SP.save.uid===SP.uid?SP.save:null, ok=!!v&&v.st==="ok";
  const why=`<p class="resultWhy">${w===0?"승리":w===1?"패배":"무승부"}${wt&&WINTYPE_KO[wt]?` · ${WINTYPE_KO[wt]}`:""}</p>`;
  const retry=v&&v.st==="fail"?`<button type="button" onclick="spRetry()">다시 시도</button>`:"", dis=v&&!ok?" disabled":"";
  const note=`<p class="spNote"><small>공식 전적·최근 기록·보상에는 들어가지 않아요.</small></p>`;
  if(tut){
    const R6=`<ul class="spReview" aria-label="학습 복습">${SP_H.map(k=>`<li><b>${SP_GUIDE[k].t}</b> <small>${T.seen[k]?"확인함":"다음 경기에서"}</small></li>`).join("")}</ul>`;
    if(!end) return {head:why+`<p class="lobbyNotice" role="status">학습이 끝나지 않았어요.</p>`+R6+note,btns:`<button type="button" class="primary big" id="spGo" onclick="toLobby()">다시 시작</button>`};
    return {head:why+spSaveLine(v)+R6+note,btns:`${retry}<button type="button" class="primary big" id="spGo"${ok?"":" disabled"} onclick="toLobby()">로비로</button>`}; // ACK 전 비활성
  }
  const nm=spTierKo(R.tier-1), off=AUTH.state==="off";
  const line=!(end&&w===0)?`<p class="lobbyNotice" role="status">승리하지 않아 ${nm} 클리어가 아니에요.</p>`
    :off?`<p class="lobbyNotice" role="status">${nm} 클리어 — 이 접속에서만 유지 · 저장 안 됨</p>`
    :v?spSaveLine(v,`${nm} 클리어 저장됨`):`<p class="lobbyNotice" role="status">${nm}은(는) 이미 클리어한 단계예요.</p>`;
  return {head:why+line+note,btns:`${retry}<button type="button" class="primary big" id="spGo"${dis} onclick="rematch()">다시 도전</button><button type="button" class="big"${dis} onclick="spToTiers()">난이도로</button>`}; // 저장 중에는 떠나지 않는다(새 경기가 늦은 응답을 버리지 않게)
}

/* ===== 로비 안의 싱글 화면 — LOBBY.view: single(P01 카드 2장) · tiers(P02 무제한 AI 난이도 8칸) ===== */
/* [싱글플레이] — 확인 불가면 상태를 다시 조회해 미완료 → 학습 · 완료 → P01 · 또 실패 → 안내(§2.5). 학습 강제도 해금도 하지 않는다 */
function spOpen(){
  if(AUTH.state==="off"||spSignedIn()&&SP.progress){ if(spNeedTut()) spTutEnter(); else spView("single"); return; }
  if(AUTH.state!=="in"){ spToast("🔒 "+(acctGateMsg()||"로그인한 뒤 입장할 수 있습니다.")); return; }
  const ag=AUTH.gen;
  lobbyFetch(SP_SESSION).then(r=>{
    if(ag!==AUTH.gen||uiScreenName()!=="lobby") return;
    if(acctIsUser(r)&&r.body.userId===SP.uid){ acctSetUser(r.body); if(SP.progress){ if(spNeedTut()) spTutEnter(); else spView("single"); return; } }
    else if(r.status===401&&r.body.error==="E_NO_SESSION"){ acctEndSession(ACCT_SESSION_ENDED); return; }
    else if(acctIsUser(r)){ acctEndSession(ACCT_TAB_SWITCHED); return; }
    spToast("진행 정보를 불러오지 못했어요. 다시 시도해 주세요.");
  });
}
function spToast(t){ lobbyLocked("",t); } // 기존 로비 토스트(잠금 안내와 같은 자리·시간)
function spView(v){
  if(v==="home"){ lobbyHome(); return; }
  LOBBY.view=v; LOBBY.notice=""; LOBBY.toast=null; LOBBY.hist=false; LOBBY.create=false; lobbyPollStop();
  render(); lobbyFocus();
}
function spToTiers(){ SP.run=null; LOBBY.next="tiers"; toLobby(); }
function spBackSpec(sc){
  if(sc==="lobby"&&LOBBY.view==="single") return {label:"← 로비",title:"싱글 선택을 닫고 로비로 돌아갑니다"};
  if(sc==="lobby"&&LOBBY.view==="tiers") return {label:"← 싱글",title:"싱글 선택(무제한 AI · 왕국 대전)으로 돌아갑니다"};
  if(sc==="result"&&SP.run&&SP.run.game===S) return {label:"← 난이도",title:"무제한 AI 난이도 선택으로 돌아갑니다"};
  if(sc==="result"&&SP.tut&&SP.tut.game===S&&spNeedTut()) return {label:"← 다시 시작",title:"학습 경기를 처음부터 다시 시작합니다 (건너뛰기를 고를 수 있습니다)"};
  return null;
}
function spBack(sc){
  if(!spBackSpec(sc)) return false;
  if(sc==="lobby"){ spView(LOBBY.view==="tiers"?"single":"home"); return true; }
  if(fxLocked()){ showToast("연출이 끝난 뒤에 눌러 주세요."); return true; }
  if(SP.save&&SP.save.st!=="ok"){ showToast("저장을 확인한 뒤에 이동할 수 있어요. [다시 시도]를 눌러 주세요."); return true; } // ACK 전 결과(학습·클리어)를 떠나면 저장 문맥이 사라진다
  if(SP.run&&SP.run.game===S) spToTiers(); else toLobby();
  return true;
}
/* 티어 i(0..2) 상태 — 서버 진행으로만(계정 없는 체험은 이번 로드 메모리) */
function spTierState(i){
  const p=AUTH.state==="off"?{tutorialDone:true,aiClearedTier:SP.local}:spSignedIn()?SP.progress:null; if(!p) return "unknown";
  if(p.aiClearedTier>i) return "cleared";
  return (i===0?p.tutorialDone:p.aiClearedTier>=i)?"open":"locked";
}
function spLockWhy(i){ return i===0?"학습 경기를 마치면 열려요":`${spTierKo(i-1)}에서 이기면 열려요`; }
function spPlay(i){
  const st=spTierState(i);
  if(st==="unknown"){ spToast("진행 정보를 불러오지 못했어요. 다시 시도해 주세요."); return; }
  if(st==="locked"){ spToast(spLockWhy(i)); return; }
  SP.run={tier:i+1,game:null}; SP.tut=null; SP.save=null;
  spStart(SP_TIERS[i]);
  if(S&&S.mode==="pve") SP.run.game=S;
}
function spLobbyHtml(){
  const head=(back,title)=>`<div class="roomsHead"><button type="button" class="icoBtn" aria-label="${back[1]}" onclick="spView('${back[0]}')">${gi("back")}</button>
    <h2 id="spTitle" tabindex="-1">${title}</h2></div>${lobbyToastHost()}`;
  if(LOBBY.view==="single") return `<section class="roomsScreen spScreen" aria-labelledby="spTitle">${head(["home","로비로 돌아가기"],"싱글플레이")}
    <div class="spCards">
      <button type="button" class="primary spCard" onclick="spView('tiers')">${gi("battle")}<b>무제한 AI 대전</b><small>입장 무료 · 횟수 제한 없음</small></button>
      <button type="button" class="locked spCard" aria-disabled="true" data-lock="kingdom" aria-label="도전! 왕국 대전, 잠김, v0.4.17 예정" onclick="spToast('🔒 도전! 왕국 대전은 v0.4.17에 열려요.')">${gi("crown")}<b>도전! 왕국 대전</b><small>잠김 · v0.4.17 예정</small><i class="lk" aria-hidden="true">${gi("lock")}</i></button>
    </div></section>`;
  const TXT={open:"도전 가능",cleared:"클리어",unknown:"확인 불가"};
  const cells=SP_TIERS.map((k,i)=>{ const st=spTierState(i), nm=spTierKo(i), go=st==="open"||st==="cleared", t=st==="locked"?`잠김 · ${spLockWhy(i)}`:TXT[st];
    return `<li><button type="button" class="spTier t-${k} st-${st}${go?" primary":" locked"}"${go?"":` aria-disabled="true"`} aria-label="${nm}, ${t.replace(" · ",", ")}" onclick="spPlay(${i})"><b>${nm}</b><small>${t}</small>${st==="locked"?`<i class="lk" aria-hidden="true">${gi("lock")}</i>`:""}</button></li>`; })
    .concat(SP_FUTURE.map(n=>`<li><button type="button" class="spTier st-future" aria-disabled="true" aria-label="${n}, 추후 공개" onclick="spToast('추후 공개 예정이에요')"><b>${n}</b><small>추후 공개</small></button></li>`)).join(""); // 추후 공개 = 잠금 아이콘 없는 흐린 칸 + 글자(잠김과 다르다)
  return `<section class="roomsScreen spScreen" aria-labelledby="spTitle">${head(["single","싱글 선택으로 돌아가기"],"무제한 AI 대전")}
    ${AUTH.state==="off"?`<p class="lobbyNotice spNote" role="note">이 접속에서만 유지 · 저장 안 됨</p>`:""}
    <ol class="spTiers" aria-label="난이도 — 브론즈부터 천상계까지">${cells}</ol>
    <p class="spNote"><small>입장 무료 · 횟수 제한 없음 · 공식 전적·보상 없음${AUTH.state==="off"?"":" · 이긴 단계는 계정에 저장되어 다른 기기에서도 이어져요"}</small></p></section>`;
}
