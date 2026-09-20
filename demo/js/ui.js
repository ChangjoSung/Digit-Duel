"use strict";
/* ===== 유틸 ===== */
const isAI=p=>(S.mode==="pve"&&p===1)||S.mode==="sim";
const humanViewer=()=> NET.mode ? NET.me : (S.mode==="pvp" ? (S.phase==="setup"?S.setupPlayer:(S.fleePick?S.fleePick.owner:S.current)) : 0); // 온라인: 항상 내 시점 고정 · 핫시트: 도망 교환 선택 중에는 도망친 말의 소유자 시점(기기 공유 — 상대는 시선 회피)
/* #93 온라인 P2 화면 행 반사 — 표시 전용. 논리 좌표(S·dataset.r/c·클릭·통신·로그)는 불변이고 열 순서도 그대로다.
   조건은 NET.mode(=netStart 이후)이지 NET.me 단독이 아니다: 사전 배치·매칭 대기는 NET.mode=false 인 로컬 P0 배치(11~13행 = 이미 하단)라
   matched 로 NET.me=1 이 정해진 뒤에도 뒤집지 않는다 — netStart 의 applyNetSetup 이 P2 말을 1~3행으로 옮긴 뒤부터만 반사한다(이중 반전 방지).
   종료(over) 화면도 같은 방향을 유지한다. 핫시트 PVP·PVE·sim 은 NET.mode=false 라 무변경. */
const boardFlipped=()=> NET.mode&&NET.me===1;
const alivePieces=()=>S.pieces.filter(p=>p.alive&&p.placed);
const at=(r,c)=>alivePieces().find(p=>p.r===r&&p.c===c);
const inForest=p=>(p.r>=4&&p.r<=5)||(p.r>=9&&p.r<=10);
const zoneOf=p=> p===0 ? [11,12,13] : [1,2,3];
const adj=(a,b)=>Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1;
/* 버닝 타임 (GDD-13 4.11): 표시 턴 65부터 직선 2칸 이동 강화 (폭탄 포함·함정 제외) */
const isBurning=()=>S.turnCount+1>=BAL.burnStart;
/* 원정 구역 = 자기 기준 상대 측 숲+상대 진영 (BT 2칸 이동 불가 구역) */
const expedZone=(owner,r)=> owner===0 ? r<=5 : r>=9;
function adjEnemies(p){return alivePieces().filter(e=>e.owner!==p.owner&&adj(p,e));}
function visibleTo(viewer,e){
  if(e.owner===viewer) return true;
  if(!inForest(e)) return true;
  if(S.tempReveal.has(e.id)) return true;
  return alivePieces().some(m=>m.owner===viewer&&adj(m,e));
}
function idLabel(viewer,p){
  if(p.owner===viewer||p.revealed||viewer===2) return (p.type==="minion"&&p.name?p.name:TYPE_KO[p.type])+(p.element?"·"+ELEM_KO[p.element]:"");
  return "?";
}
function addLog(msg,cls){S.log.push({msg,cls:cls||""}); renderLog();}
function showToast(msg,kind){
  try{
    const box=$("toasts"); if(!box||!box.appendChild) return;
    while(box.children&&box.children.length>=3) box.removeChild(box.firstChild);
    const t=document.createElement("div"); t.className="toast"+(kind?" "+kind:""); t.textContent=msg;
    box.appendChild(t);
    setTimeout(()=>{if(t.parentNode)t.parentNode.removeChild(t);},2300);
  }catch(e){}
}
function applyUiEvents(events){
  for(const event of events||[]){
    if(event.type==="render"){ render(); continue; }
    if(event.type==="toast"){ showToast(event.message); continue; }
    if(event.type==="setupRosterChanged"){
      if(event.complete&&UI.prep==="roster") UI.prep="place";
      render(); continue;
    }
    if(event.type==="setupNetworkReady"){
      NET.mySetup=event.setup;
      if(event.publicMode) netRoomReady(true);
      else { NET.queued=true; render(); netConnect(); }
      continue;
    }
    if(event.type==="teleTrapped"){ // #131·#245 텔레포트 함정 거부 — 사유는 소유자 화면에만 (공용 로그·렌더 없음)
      if(viewerIsOwner(event.player)){ showToast(event.message); if(S.mode!=="sim") tutHint("teletrap"); } // #26 첫 1회 도움말 (게임 상태 무변경)
      continue;
    }
    if(event.type==="setupHandoff"){ handoff(pname(event.player)+" 배치",render); continue; }
    if(event.type==="setupBegin"){ beginPlay(); continue; }
    if(event.type==="setupAiBegin"){ aiAutoPlace(1); addLog("AI 배치 완료.","ai"); beginPlay(); continue; }
    if(event.type==="healStarted"){ // #106 T2 · #245 회복 자세 시작 — H8: 미공개 상대 말은 중립 문구로만
      const piece=event.piece, viewer=humanViewer();
      if(S.mode==="sim"||healVisibleTo(viewer,piece)){
        const message=`🌿 ${idLabel(viewer,piece)} 회복 자세 시작 (턴마다 최대 HP ${pct(BAL.healPostPct)})`;
        addLog(message,"imp"); if(!isAI(piece.owner)) showToast(message);
      }
      else addLog("상대가 말 회복 행동을 했습니다.","imp"); // 미공개 말: 대상·위치 비공개 (중립 문구)
      render(); continue;
    }
    if(event.type==="moved"){ // #245 평이동 — 상태는 Core 가 끝냈고 여기는 로그·재렌더만
      if(event.healBroken) healBreakLog(event.piece);
      if(event.trace&&!isAI(event.piece.owner)){ addLog(TRACE_FOUND_MSG,"imp"); showToast(TRACE_FOUND_MSG); }
      render(); continue;
    }
    if(event.type==="mainSkipped"){
      const ai=event.origin==="ai", msg=ai?"🤖 AI 주 행동 생략":`${pname(event.player)} 주 행동 생략`;
      addLog(msg,ai?"ai":"");
      if(ai&&event.toast!==false) showToast(msg);
      render();
    }
  }
}
function clearToasts(){try{const box=$("toasts"); if(box) box.innerHTML="";}catch(e){}}
function pct(n){return Math.round(n*100)+"%";}
/* HTML 속성값 이스케이프 — innerHTML 템플릿에 "밖에서 온 값"을 넣을 때만 쓴다.
   저장소(localStorage)나 사용자 입력에서 온 값은 저장 시점에 정규화했더라도 신뢰하지 않는다:
   따옴표 하나면 value="…" 를 닫고 onerror= 같은 속성을 덧붙일 수 있어, 저장값이 곧 스크립트 주입이 된다.
   & 를 먼저 바꿔야 이미 이스케이프된 실체를 두 번 감싸지 않는다. */
function escAttr(v){
  return String(v===undefined||v===null?"":v)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/`/g,"&#96;");
}

const $=id=>document.getElementById(id);

/* ===== #122 (v0.4.7) 세로 UI 셸 — 표시 계층 전용 =====
   규칙 상태는 종전대로 S.phase 하나뿐이다. 여기서 기억하는 것은 (a) 타이틀 화면을 지났는가 (b) 어떤 서랍이 열려 있는가
   (c) 출전 준비의 어느 단계를 보고 있는가 — 셋 다 표시 상태이고 난수·저장소·네트워크를 건드리지 않는다.
   화면 전환은 같은 문서 안에서 일어나므로 **새 문서 로드가 아니다** — #128 "새 문서 로드당 1회" 튜토리얼 경계는 그대로다. */
/* #122 REVISE 추가 필드 —
   ask: 지금 뒤로가기가 연 확인창의 소유 토큰. modal() 이 다른 창으로 갈아 끼우면 무효가 되어, 남아 있던 옛 버튼이
        **새 창을 닫지 못한다** (오래된 확인 버튼이 새 게임 모달을 close 하는 사고 방지).
   hold/holdQ: sim 관전 종료 확인창이 떠 있는 동안 AI **예약 실행**만 잠시 미뤄 두는 표시 제어.
        AI 판단·난수·승패·시간표를 바꾸지 않는다 — "언제 다음 수를 두는가"만 미루고, 취소하면 그대로 이어진다. */
const UI={entered:false,drawer:null,prep:"roster",ask:null,hold:false,holdQ:[]};
function uiScreenName(){
  if(!UI.entered) return "title";
  if(!S) return "lobby";
  return S.phase==="menu"?"lobby":S.phase==="setup"?"prep":S.phase==="play"?"board":"result";
}
function uiApply(){
  try{
    const a=$("app"); if(!a||!a.setAttribute) return;
    const sc=uiScreenName();
    a.setAttribute("data-screen",sc);
    a.setAttribute("data-prep",UI.prep);
    if(sc==="board"&&UI.drawer) a.setAttribute("data-drawer",UI.drawer);
    else if(a.removeAttribute) a.removeAttribute("data-drawer");
    const t=$("drawerTitle");
    if(t) t.textContent=UI.drawer==="log"?"📜 공개 기록":UI.drawer==="metrics"?"📊 지표":"📋 내 정보 · 선택 말 · 추측 메모";
    /* 기록·지표는 접힌 <details> 다. 서랍으로 열 때는 요약 줄을 감추고 내용을 보여야 하므로 open 을 실제로 세운다
       (data-drawer 만 바꾸면 제목과 닫기 버튼만 남고 로그 본문이 보이지 않는다 — PD 실제 PNG 검토 지적). */
    const setOpen=(id,on)=>{ try{ const el=$(id); if(!el) return;
      if(on){ if(el.setAttribute) el.setAttribute("open",""); }
      else if(el.removeAttribute) el.removeAttribute("open");
      try{ el.open=!!on; }catch(e2){} }catch(e){} };
    setOpen("drawerLog",sc==="board"&&UI.drawer==="log");
    setOpen("drawerMetrics",sc==="board"&&UI.drawer==="metrics");
    const bs=$("btnDrawerSide"), bl=$("btnDrawerLog");
    if(bs&&bs.setAttribute) bs.setAttribute("aria-pressed",UI.drawer==="side"?"true":"false");
    if(bl&&bl.setAttribute) bl.setAttribute("aria-pressed",UI.drawer==="log"?"true":"false");
    /* #122 REVISE(2026-09-10 CJ QA 3): 출전 준비 2단계 탭의 **눌림 표시**를 여기서 함께 맞춘다.
       종전에는 aria-pressed 를 renderSetup() 만 찍었는데 uiPrep() 는 uiApply() 만 부르고 패널을 다시 그리지 않아
       (data-prep 은 바뀌어 내용은 전환되는데) '01 로스터 선택' 이 계속 파랗게 눌린 채 남았다 — CJ 관측 "시스템은 정상, UI 전환은 안 됨".
       탭 줄은 배치 단계에서 말판 아래로 내려가지만 화면 안에 있으므로 스크롤은 건드리지 않는다 (말판이 위에 그대로 보여야 배치할 수 있다). */
    try{ const tabs=a.querySelectorAll?a.querySelectorAll(".prepTabs button[data-prep-step]"):null;
      if(tabs) for(const b of tabs) if(b.setAttribute) b.setAttribute("aria-pressed",b.getAttribute("data-prep-step")===UI.prep?"true":"false"); }catch(e){}
    /* #122 REVISE: 좌상단 뒤로가기 — 화면마다 "어디로 가는지"를 문구·설명으로 밝힌다 */
    const bk=$("btnBack"), spec=uiBackSpec();
    if(bk){
      if(!spec){ if(bk.classList) bk.classList.add("hidden"); }
      else{
        if(bk.classList) bk.classList.remove("hidden");
        bk.textContent=spec.label;
        if(bk.setAttribute){ bk.setAttribute("title",spec.title); bk.setAttribute("aria-label",spec.title); }
      }
    }
  }catch(e){}
}
window.uiDrawer=function(k){ UI.drawer=(k&&UI.drawer===k)?null:(k||null); uiApply(); try{ fitBoard(); }catch(e){} };
window.uiStart=function(){ UI.entered=true; uiApply(); try{ render(); }catch(e){} };
/* 단계를 바꾸면 말판이 보이거나 숨겨지므로 그 자리에서 보드 배율을 다시 잰다 (숨어 있는 동안에는 폭이 0 이라 잴 수 없다) */
window.uiPrep=function(step){ UI.prep=(step==="place")?"place":"roster"; uiApply(); try{ fitBoard(); }catch(e){} };

/* ===== #122 REVISE (2026-09-10 CJ QA) — 좌상단 뒤로가기 =====
   원칙 세 가지만 지킨다:
   1) **되돌리기가 아니다.** 이미 확정된 행동·전투·턴을 무르지 않고, 규칙·난수·저장소·튜토리얼 표시 정책을 건드리지 않는다.
   2) **주인을 빼앗지 않는다.** 전투 모달·기기 넘김·메모 피커·패키지 선택처럼 지금 화면의 주인이 있는 창이 열려 있으면
      뒤로가기는 아무 일도 하지 않는다 (열린 창을 덮어쓰지 않는다).
   3) **경기 중에는 새 출구를 만들지 않는다.** 실제 대전 중의 뒤로가기는 toLobby()·초기화를 직접 부르지 않고,
      기존 기권 확인(confirmResign)으로만 이어진다 — 소유자·AI 턴·온라인 가드가 그대로 적용된다.
   전투 화면 안의 '← 뒤로'는 종전대로 window.__menu(null) 시맨틱 핸들러이며(버튼 인덱스 중계 아님) 여기서 바뀌지 않는다. */
function uiOverlayOpen(){ // 게임 모달(#overlay)·튜토리얼 모달(#tutOverlay) 중 하나라도 열려 있는가
  try{
    const o=$("overlay"); if(o&&o.classList&&!o.classList.contains("hidden")) return true;
    const t=$("tutOverlay"); if(t&&t.classList&&!t.classList.contains("hidden")) return true;
  }catch(e){}
  return false;
}
/* 이 확인창이 아직 내 것인가 — 다른 modal() 이 오버레이를 가져갔거나(UI.ask 교체) 게임이 바뀌었으면 아니다.
   아니면 아무것도 하지 않는다: 특히 **close() 도 부르지 않아** 지금 떠 있는 남의 창을 닫아 버리지 않는다. */
function uiAskMine(tok,game){ return UI.ask===tok&&S===game; }
function uiBackSpec(){ // null = 이전 화면이 없다(타이틀) → 버튼을 숨긴다
  const sc=uiScreenName();
  if(sc==="title") return null;
  if(sc==="lobby") return {label:"← 타이틀",title:"타이틀 화면으로 돌아갑니다"};
  if(sc==="prep"){
    if(NET.queued) return {label:"← 대기 취소",title:"매칭 대기를 취소합니다 (배치는 그대로 유지됩니다)"};
    if(UI.prep==="place") return {label:"← 로스터",title:"01 로스터 선택으로 돌아갑니다 (고른 로스터와 배치는 그대로 유지됩니다)"};
    return {label:"← 로비",title:"출전 준비를 그만두고 로비로 돌아갑니다 (준비한 내용이 있으면 먼저 확인을 묻습니다)"};
  }
  if(sc==="board"){
    if(UI.drawer) return {label:"← 닫기",title:"열려 있는 정보 서랍을 닫습니다"};
    if(S&&S.mode==="sim") return {label:"← 관전 종료",title:"AI vs AI 관전을 끝내고 로비로 돌아갑니다 (먼저 확인을 묻습니다)"};
    return {label:"←",title:"대전 중에는 기권 확인을 거쳐야 로비로 나갈 수 있습니다"};
  }
  return {label:"← 로비",title:"로비로 돌아갑니다"}; // result
}
window.uiBack=function(){
  const sc=uiScreenName();
  if(sc==="title") return;
  if(sc==="board"&&UI.drawer){ uiDrawer(null); return; } // 서랍이 열려 있으면 서랍부터 닫는다 (화면은 그대로)
  if(uiOverlayOpen()){ showToast("진행 중인 창을 먼저 마쳐 주세요."); return; }
  if(sc==="lobby"){ UI.entered=false; UI.drawer=null; uiApply(); return; }
  if(sc==="result"){ // #126 종료 연출이 재생 중이면 결과 패널의 [로비로]와 같은 잠금을 따른다
    if(fxLocked()){ showToast("연출이 끝난 뒤에 눌러 주세요."); return; }
    toLobby(); return;
  }
  if(sc==="prep"){
    if(NET.queued){ netCancelQueue(); return; }                 // 기존 [매칭 취소 (배치 유지)] 와 같은 경로
    if(UI.prep==="place"){ uiPrep("roster"); return; }           // 표시 단계만 되돌린다 — 로스터·배치는 S 안에 그대로 남는다
    /* 로스터 단계에서 나가면 준비가 사라진다. 사라질 것이 있을 때만 확인을 묻는다 */
    const dirty=!!(NET.preparing||(S&&(S.roster[0].length||S.roster[1].length||S.pieces.some(x=>x.placed))));
    if(!dirty){ toLobby(); return; }
    const game=S, tok={};
    netLocalModal(); // 확인 모달은 로컬 전용 (온라인 중계·seq 제외)
    modal(`<h2>← 로비로 돌아가기</h2><p>출전 준비를 그만두고 로비로 돌아갈까요?</p>`
      +`<small>지금까지 고른 로스터와 배치는 사라집니다.${NET.preparing?" 온라인 대전 준비도 함께 취소됩니다.":""}</small>`,
      [["로비로 돌아가기",()=>{ if(!uiAskMine(tok,game)) return; UI.ask=null; close(); toLobby(); }],
       ["계속 준비하기",()=>{ if(!uiAskMine(tok,game)) return; UI.ask=null; close(); }]]);
    UI.ask=tok; // modal() 이 토큰을 비우므로 연 뒤에 세운다
    return;
  }
  /* 실제 대전 중 (board) */
  if(S&&S.mode==="sim"){ // AI vs AI 관전 — 기권할 주체가 없다. 확인 뒤 관전만 끝낸다 (승패·규칙 무변경)
    if(fxLocked()){ showToast("연출이 끝난 뒤에 눌러 주세요."); return; }
    const game=S, tok={};
    modal(`<h2>← 관전 종료</h2><p>AI vs AI 관전을 끝내고 로비로 돌아갈까요?</p>`
      +`<small>이 경기의 진행은 저장되지 않습니다. [계속 관전]을 누르면 그대로 이어집니다.</small>`,
      [["로비로 돌아가기",()=>{ if(!uiAskMine(tok,game)) return; UI.ask=null; close(); toLobby(); }],
       ["계속 관전",()=>{ if(!uiAskMine(tok,game)) return; UI.ask=null; close(); aiHoldRelease(); }]]);
    UI.ask=tok;
    /* 확인창이 떠 있는 동안에만 AI 예약 실행을 미룬다 — 그러지 않으면 약 simDelay 뒤 AI 가 다음 수를 두면서
       전투 모달·종료 연출로 이 확인창을 덮어쓴다 (aiStep 은 오버레이를 보지 않는다). 판단·난수는 그대로다. */
    UI.hold=true;
    return;
  }
  if(!S||S.phase!=="play"||isAI(S.current)||(NET.mode&&S.current!==NET.me)){
    showToast("내 차례에만 나갈 수 있습니다 (기권 확인)."); return;
  }
  confirmResign(); // 기존 기권 확인 — 소유자·AI·온라인 가드는 그 안에 그대로 있다
};
/* 보드 스케일 — 칸 기하(7×52px)와 말 규격(48/32/11)은 CSS 에서 불변이고, 세로 화면 맞춤은 이 --bs 하나로만 한다.
   transform 스케일이라 클릭 판정 좌표계도 함께 변형되므로 칸 히트 영역이 어긋나지 않는다.
   실제 DOM 이 있을 때만 측정한다 — 헤드리스 스텁은 기본값 1 그대로다 (기존 회귀의 기하 전제 불변). */
function fitBoard(){
  try{
    const w=$("boardWrap"), a=$("app"); if(!w||!w.style||!w.style.setProperty) return;
    const avail=w.clientWidth||0; if(!avail) return;
    const bar=$("appBar"), dock=$("actionDock"), info=$("boardInfo");
    const used=(bar&&bar.offsetHeight||0)+(dock&&dock.offsetHeight||0)+(info&&info.offsetHeight||0);
    /* 세로 높이는 **뷰포트** 기준으로 잡는다 — #app 은 내용이 넘치면 같이 커지므로 그 값을 쓰면 배율이 수렴하지 않는다.
       넓은 화면에서 프레임 위아래에 둔 여백(body padding)은 프레임 상단 좌표에서 되읽어 뺀다. */
    const top=(a&&a.getBoundingClientRect)?Math.max(0,a.getBoundingClientRect().top):0;
    const vh=((typeof window!=="undefined"&&window.innerHeight)||0)-top*2;
    const boxH=vh-used-30;
    let s=Math.min(avail/376,1);
    if(S&&S.phase==="play"&&boxH>140) s=Math.min(s,boxH/700);
    if(!(s>0.2)) s=1;
    w.style.setProperty("--bs",String(Math.round(s*1000)/1000));
  }catch(e){}
}
if(typeof window!=="undefined"&&window.addEventListener) window.addEventListener("resize",()=>{try{fitBoard();}catch(e){}});

/* ===== #106 연출 잠금·배너 큐 (turn-flow 계약 3장) =====
   원칙: 규칙 상태(S) 전이는 종전처럼 동기·즉시. 여기 있는 것은 표시 계층(배너 오버레이·입력 잠금·표시 유지)뿐이며 rand() 를 쓰지 않고
   규칙 함수를 부르지 않는다 (예외 두 가지 — 행동자 클라이언트의 자동 턴 종료 '입력 액션' 발생, AI 스케줄 idle 콜백 — 은 계약 3.1-3).
   - 큐: fxPlay(item) 로 항목을 순서대로 재생. 항목이 하나라도 남아 있으면 fxLocked() — 보드 셀·턴바·전투 커맨드·동기 모달 버튼 입력이 무시된다(기권 제외).
   - 토큰: FX.gen(게임 세대)·항목 id 로 오래된 타이머를 무효화한다 (불변식 1). 새 게임(newGame)에서 fxReleaseAll().
   - 워치독: 모든 항목은 선언 시간 + BAL.fx.watchdog 안에 반드시 끝난다 (불변식 2). onStart/onEnd 예외도 큐를 막지 못한다.
   - 시간 0(헤드리스·sim·fxLive() false)이면 항목을 즉시 동기 처리하고 FX.log 에만 기록한다 — 기존 회귀·AI vs AI 결과 불변.
   - idle: 큐와 전투 메시지 재생이 모두 끝나면 fxIdle() 이 대기 콜백(AI 스케줄·전투 재렌더)을 실행하고 수신 큐(netPump)·자동 턴 종료 평가를 돌린다. */
const FX={q:[],cur:null,gen:0,seq:0,force:false,idle:[],hold:[],log:[],inputSeq:0,auto:null};
function fxLive(){ // 실제 DOM 이 있고 사람이 보는 모드일 때만 시간이 흐른다 (sim·헤드리스 스텁은 0). FX.force 는 타이머 테스트 전용 스위치
  if(FX.force) return true;
  if(!S||S.mode==="sim") return false;
  try{ const el=$("fxBanner"); return !!el&&el.nodeType===1; }catch(e){ return false; }
}
function fxMs(key){ return fxLive()?(BAL.fx[key]||0):0; }
function fxLocked(){ return !!FX.cur||FX.q.length>0||MSGPLAYING||netFxBusyNow(); }
function netFxBusyNow(){ try{ return !!NET.publicMode&&(NET.fxPlaying||NET.fxQueue.length>0||NET.resuming); }catch(e){ return false; } } // #217 공개 방: 서버 fx 재생 중·재접속 중에도 원본과 같은 입력 잠금 (NET 선언 전 호출 안전)
function fxSetLockClass(on){ try{ const b=document.body; if(b&&b.classList){ if(on) b.classList.add("fx-lock"); else b.classList.remove("fx-lock"); } }catch(e){} }
/* #126 (v0.4.7): 결과 배너의 섬광·파편 레이어. 각도·거리·지연이 전부 **인덱스 계산**이라 rand() 도 Math.random 도 쓰지 않는다
   — 시드 스트림·락스텝·AI vs AI 완주 결과에 영향이 0 이다. 결과가 아닌 항목에서는 비워 두므로 다른 배너에는 아무것도 얹히지 않는다.
   CSS 애니메이션은 전부 유한(forwards)이라 배너가 닫힌 뒤 도는 것이 남지 않는다. */
const FXFX_N=16, FXFX_D=[128,96,152,110];
function fxFxLayer(item){
  try{
    const fl=$("fxFx"); if(!fl) return;
    if((item.kind||"")!=="result"){ if(fl.innerHTML) fl.innerHTML=""; return; }
    let h="";
    for(let i=0;i<FXFX_N;i++) h+=`<i style="--a:${Math.round(i*360/FXFX_N)+(i%2?11:0)}deg;--d:${FXFX_D[i%4]}px;--x:${(i-(FXFX_N-1)/2)*23}px;--i:${i}"></i>`;
    fl.innerHTML=h;
  }catch(e){}
}
function fxShow(item){
  fxSetLockClass(true);
  try{
    const el=$("fxBanner"); if(!el) return;
    el.className=(item.kind||"banner")+(item.cls?" "+item.cls:"")+(item.dim===false?" nodim":"");
    const t=$("fxTitle"), s=$("fxSub"); if(t) t.textContent=item.title||""; if(s) s.textContent=item.sub||"";
    fxFxLayer(item); // #126
    el.classList.remove("hidden");
    if(item.cells&&el.nodeType===1) for(const [r,c] of item.cells){ const cell=document.querySelector(`#board .cell[data-r="${r}"][data-c="${c}"]`); if(cell) cell.classList.add(item.cellCls||"fx-boom"); }
  }catch(e){}
}
function fxHide(){
  fxSetLockClass(false);
  try{ const el=$("fxBanner"); if(el) el.classList.add("hidden"); }catch(e){}
}
/* item: {key, title, sub, kind:"banner"|"count"|"result"|"contact"|"bt"|"boom"|"trap", cls, dim:false→투명, cells:[[r,c]], cellCls, hold:[{piece,r,c}], onStart, onEnd, ms(선택 — 기본은 BAL.fx[key])} */
function fxPlay(item){
  const ms=item.ms!==undefined?item.ms:fxMs(item.key);
  const entry={key:item.key,title:item.title||"",sub:item.sub||"",kind:item.kind||"banner",cls:item.cls,turn:S?S.turnCount:-1,ms,t:Date.now(),shown:0}; FX.log.push(entry); item._log=entry; // 진단 기록(테스트·리포트용, 규칙 무관) — #217 공개 방 서버가 이 FX.log 항목을 그대로 후킹해 resultBanner 등의 cls를 wire 이벤트로 넘긴다(battle-fx-protocol.md §6). cls 를 빠뜨리면 roundBanner처럼 서버가 따로 재계산해 주는 것 말고는 전부 결과 배너 기본색(노랑)·이펙트 없음으로 떨어진다.
  if(ms<=0){ try{ if(item.onStart) item.onStart(); }catch(e){} try{ if(item.onEnd) item.onEnd(); }catch(e){} return; }
  FX.q.push(Object.assign({},item,{ms}));
  if(!FX.cur) fxNext();
}
function fxNext(){
  const item=FX.q.shift();
  if(!item){ FX.cur=null; FX.hold=[]; fxHide(); fxIdle(); return; }
  FX.cur=item; const gen=FX.gen, id=++FX.seq; item.id=id; if(item._log) item._log.shown=Date.now();
  if(item.hold){ FX.hold=item.hold.slice(); try{ renderBoard(); }catch(e){} }
  fxShow(item);
  try{ if(item.onStart) item.onStart(); }catch(e){}
  const done=()=>{
    if(FX.gen!==gen||!FX.cur||FX.cur.id!==id) return; // 오래된 타이머(새 게임·이미 넘어간 항목)는 무효
    FX.cur=null;
    if(item.hold){ FX.hold=[]; try{ if(S&&S.phase!=="menu") renderBoard(); }catch(e){} } // 이 항목의 표시 유지는 onEnd 전에 걷는다 — onEnd 가 새 항목을 시작하면 그 항목의 hold 가 대신 선다
    try{ if(item.onEnd) item.onEnd(); }catch(e){}
    if(FX.gen!==gen) return; // onEnd 가 새 게임을 열었다 — 옛 항목의 다음 항목 진행은 새 게임 큐를 건드리지 않는다 (msg_3e9ac3ba0ea9)
    if(FX.cur) return; // 같은 세대 재진입: onEnd(결과 배너 닫기 → 도망 교환 → 추가 접촉 배너 등)가 이미 새 현재 항목을 시작했다 — 그 항목이 큐를 소유하므로 여기서 fxNext 를 부르면 그 항목이 즉시 버려진다 (Saturn msg_db013b1c24df)
    fxNext();
  };
  setTimeout(done,item.ms);
  setTimeout(done,item.ms+(BAL.fx.watchdog||1000)); // 하드 데드라인 — 첫 타이머가 어떤 이유로든 못 돌아도 선언 시간 + 1초 안에 푼다
}
function fxWhenIdle(fn){ if(!fxLocked()) fn(); else FX.idle.push(fn); }
function fxIdle(){ // 큐·메시지 재생이 모두 끝났을 때 한 번 — 대기 콜백 → 수신 큐 → 자동 턴 종료 평가
  if(fxLocked()) return;
  const gen=FX.gen, cbs=FX.idle.splice(0);
  for(let i=0;i<cbs.length;i++){ try{ cbs[i](); }catch(e){}
    if(FX.gen!==gen) return; // 콜백이 새 게임(fxReleaseAll)을 열었다 — 옛 세대의 남은 콜백은 실행도 재적재도 하지 않는다 (PD 리뷰 msg_3e9ac3ba0ea9)
    if(fxLocked()){ FX.idle.unshift(...cbs.slice(i+1)); return; } } // 콜백이 새 연출을 시작하면 남은 콜백은 (순서 유지) 다음 idle 로 넘긴다 — PD 리뷰 msg_41fdc516c9ba
  try{ if(NET.mode) netPump(); }catch(e){}
  try{ if(S&&S.phase==="play") renderTurnBar(); }catch(e){}
  try{ autoEndCheck(); }catch(e){}
}
function fxReleaseAll(){ FX.gen++; FX.q.length=0; FX.cur=null; FX.idle.length=0; FX.hold=[]; FX.auto=null; FX.log.length=0; MSGQ.length=0; MSGPLAYING=false; MSGAFTER=null; fxHide(); }
/* 뷰어가 지금 턴(또는 전투 행동)의 행동자인가 — 거울 문구(4.7) 기준. 핫시트·sim 은 항상 행동자 시점 */
function viewerIsOwner(p){ if(NET.mode) return p===NET.me; if(S.mode==="pve") return p===0; return true; }
function fxTurnLabel(p,battle){ // "나의 턴!/상대 턴!" (PVE·온라인) · 핫시트 전투 라운드는 "P1 턴!/P2 턴!", 보드는 기기를 받은 현재 플레이어 시점 = "나의 턴!"
  if(S.mode==="pvp"&&!NET.mode) return battle?`P${p+1} 턴!`:"나의 턴!";
  return viewerIsOwner(p)?"나의 턴!":"상대 턴!";
}
/* 4.1 턴 시작 배너 (+ 4.1 버닝 타임 배너 1회) — startTurn 직후, 핫시트는 handoff 확인 뒤 호출된다 */
function turnBannerFx(){
  if(S.phase!=="play"||S.mode==="sim") return;
  if(S.btBannerDue){ S.btBannerDue=false; fxPlay({key:"turnBanner",kind:"bt",title:"버닝타임입니다! 2칸씩 이동 가능합니다",sub:"직선 2칸 이동 강화 (폭탄 포함 · 함정 제외 · 적진·적 숲은 1칸)"}); }
  const mine=(S.mode==="pvp"&&!NET.mode)||viewerIsOwner(S.current);
  fxPlay({key:"turnBanner",kind:"banner",cls:mine?"mine":"",title:fxTurnLabel(S.current,false),
    sub:mine?"말 이동 / 수풀 탐색 / 말 회복 행동 중 하나를 실행하세요!":"상대가 행동을 선택하고 있습니다"});
}
/* 4.3.2 접촉 상황 문구 — 행동자 화면 / 4.7 거울(상대 화면). 현행 로그가 이미 공개하는 사실만 담는다 */
function contactText(att,def,mine){
  const vip=x=>x.type==="ally"||x.type==="king";
  const dName=TYPE_KO[def.type]||"말";
  if(att.type==="bomb"){
    if(def.type==="minion") return mine?"폭탄이 터져 상대 하수인과 함께 제거됩니다.":"상대 폭탄이 터져 내 하수인이 제거됩니다.";
    if(vip(def)) return mine?"상대 말이 내 폭탄을 제거하였습니다.":"내 말이 상대 폭탄을 제거하였습니다.";
    return mine?"폭탄이 터져 상대 폭탄·함정과 함께 제거됩니다.":"상대 폭탄이 터져 내 폭탄·함정과 함께 제거됩니다."; // #122 REVISE(2026-09-10 CJ QA 5): #114 상황 6(밀기)을 폐지 — 그 자리에서 폭탄 접촉 발동, 둘 다 제거
  }
  /* #122 REVISE(2026-09-10 CJ QA 1): #114 상황 8(동료/왕 ↔ 동료/왕 = 전투 없이 밀기)을 **폐지**한다.
     동료↔동료·동료↔왕은 이제 보통 전투로 이어지므로 아래 공통 "배틀을 시작합니다" 문구를 그대로 탄다.
     #122 REVISE(2026-09-10 CJ QA 6)로 왕 ↔ 왕 불가침까지 폐지됐으므로 동료·왕의 모든 조합이 같은 문구를 쓴다. */
  if(def.type==="bomb"){
    if(att.type==="minion") return mine?"폭탄이 터져 내 하수인이 제거됩니다.":"내 폭탄이 터져 상대 하수인이 제거됩니다.";
    return mine?"상대 폭탄이 터졌지만 내 말은 생존했습니다.":"상대 말이 내 폭탄을 제거하였습니다.";
  }
  if(def.type==="trap"){
    const a=att.type==="minion"?"하수인":"말";
    return mine?`함정에 걸려 내 ${a}의 이동이 2턴간 제한됩니다.`:`상대 ${a}이 내 함정에 걸렸습니다! (정체 공개 · 2턴 이동 불가)`;
  }
  if(mine) return vip(att)?"배틀을 시작합니다. (출전을 선택하세요)":"배틀을 시작합니다.";
  return `상대가 내 ${dName}에게 배틀을 걸었습니다.`;
}
function contactBannerFx(att,sub){ // "⚠️ 상대 말 접촉!" (거울: 내 말 접촉!) — 추가 접촉·숲 충돌 부제 포함
  const mine=viewerIsOwner(att.owner);
  const again=S.contactKind==="again";
  const title=mine?(again?"⚠️ 상대 말 추가 접촉!":"⚠️ 상대 말 접촉!"):(again?"⚠️ 내 말 추가 접촉!":"⚠️ 내 말 접촉!");
  const base=S.contactKind==="collision"?"이동 중 숨은 말과 충돌! 위치가 일시 공개되었습니다":(S.contactKind==="tele"?"텔레포트로 새로 인접했습니다":"");
  fxPlay({key:"contactBanner",kind:"contact",title,sub:[base,sub||""].filter(Boolean).join("\n")});
}
function situationFx(att,def){ fxPlay({key:"contactBanner",kind:"contact",title:viewerIsOwner(att.owner)?"⚠️ 상대 말 접촉!":"⚠️ 내 말 접촉!",sub:contactText(att,def,viewerIsOwner(att.owner))}); }

/* ===== 렌더 ===== */
function render(){
  $("phaseLabel").textContent = S.phase==="menu" ? ""
    : S.phase==="setup" ? `— 배치: ${pname(S.setupPlayer)}`
    : S.phase==="play" ? `— ${pname(S.current)} 턴 ${S.turnCount+1}${isBurning()?" 🔥BT":""}` : S.phase==="over"?"— 종료":"";
  renderBoard(); renderSide(); renderTurnBar(); renderMetrics();
  try{ uiApply(); renderBoardInfo(); fitBoard(); }catch(e){} // #122 표시 계층 — 화면 상태·상태 줄·보드 스케일
  try{ autoEndCheck(); }catch(e){} // #106 T7: 상태가 그려질 때마다 자동 턴 종료 조건 재평가 (예약은 1회, 발화는 행동자 클라이언트만)
}
function renderBoard(){
  const bd=$("board"); bd.innerHTML="";
  const viewer = S.phase==="menu"?0 : (S.mode==="sim"||S.phase==="over")?2 : humanViewer(); // #11 종료 리빌: over 시 전체 공개 시점
  const flip=boardFlipped(); bd.dataset.flip=flip?"1":"0"; // #93 표시 메타데이터만 — 화면 행 i 에 논리 행 r=14−i (열 유지)
  for(let i=1;i<=ROWS;i++) for(let c=1;c<=COLS;c++){
    const r=flip?ROWS+1-i:i;
    const cell=document.createElement("div");
    cell.className="cell"+(r<=3?" zA":r<=5?" forest":r<=8?"":r<=10?" forest":" zB");
    cell.dataset.r=r; cell.dataset.c=c;
    if(S.phase!=="menu"){
      const ev=S.events.find(e=>e.r===r&&e.c===c&&!e.consumed);
      if(ev&&viewer!==2&&S.traces[viewer]&&S.traces[viewer].has(ev.r+"_"+ev.c)){const t=document.createElement("span");t.className="trace";t.textContent="🔍";cell.appendChild(t);}
      const live=at(r,c), ghost=!live&&FX.hold.length?FX.hold.find(h=>h.r===r&&h.c===c):null; // #106 폭발 표시 유지(hold): 제거된 말을 연출이 끝날 때까지 그린다 (공개 이벤트 — 가시성 무관)
      const p=live||(ghost?ghost.piece:null);
      if(p&&(ghost||viewer===2||visibleTo(viewer,p))){
        const chip=document.createElement("div");
        const known = viewer===2||p.owner===viewer||p.revealed;
        const healVis=!!p.healing&&(viewer===2||p.owner===viewer||p.revealed); // #106 H8: 회복 이펙트는 소유자 화면 항상, 상대 화면은 공개 말만
        /* #122 (CJ 추가 피드백): 이 칸이 실제 수풀이면 표시만 반투명으로 낮춘다 (inbush). 규칙·가시성 판정은 위에서 이미 끝났고
           여기서 바뀌는 것은 없다 — 안 보이는 말은 이 분기에 들어오지도 않는다. */
        chip.className="pc p"+p.owner+(p.owner===viewer?" own":"")+(known?"":" hiddenId")+(p.immobile>0?" immob":"")+(healVis?" healing":"")+(ghost?" fx-ghost":"")+(inForest({r})?" inbush":"");
        const g=!known&&S.phase==="play"&&viewer!==2?memoOpt(S.memos[viewer][p.id]):null; // #36 뷰어 전용 추측 — 실제 공개(known)면 실제 렌더 우선
        // #89 확정 말은 종 아이콘(하수인) 또는 같은 메모 이모지 + 정보 행. 미공개 말은 현행 그대로 ? 또는 뷰어 자신의 추측 이모지만 — 종 아이콘·경로를 만들지 않는다
        chip.innerHTML = known
          ? pcBodyHtml(p)
          : g ? glyphSpan(g.key,"guess") : "?"; // 추측도 확정과 같은 기호 규칙 — 그릴 수 없는 기호만 같은 뜻의 텍스트로
        if(known) chip.setAttribute("aria-label",pcLabel(p)); // 이미 공개된 값만 — 미공개 말에는 붙이지 않는다
        if(g){ chip.className+=" memo-guess"; chip.setAttribute("title",`추측: ${g.ko} (내 메모 · 정체 미공개)`); chip.setAttribute("aria-label",`정체 미공개 상대 말 — 내 추측: ${g.ko}`); }
        cell.appendChild(chip);
      }
      if(S.selected&&!isAI(S.current)&&(!NET.mode||netActor()===NET.me)){ // 온라인: 상대 선택 하이라이트 비노출 (숨은 말 위치 누출 방지)
        const s=S.selected;
        if(S.phase==="setup"&&s.tray&&zoneOf(S.setupPlayer).includes(r)&&!at(r,c)) cell.classList.add("hl-move");
        if(S.phase==="play"&&!s.tray){
          if(s.id&&p&&p.id===s.id) cell.classList.add("hl-sel");
          if(canMoveTo(s,r,c)) cell.classList.add("hl-move");
          if(p&&p.owner!==s.owner&&adj(s,p)&&visibleTo(viewer===2?0:viewer,p)&&canBattle(s,p)) cell.classList.add("hl-attack");
        }
      }
      if(S.phase==="play"&&fleePickMine()&&p&&p.owner===S.fleePick.owner){ // #114 도망 교환: 소유자 화면에만 후방 후보(파란)·도망친 말(흰) 강조 — 상대 화면 비노출
        if(S.fleePick.cands.includes(p.id)) cell.classList.add("hl-move");
        if(p.id===S.fleePick.pieceId) cell.classList.add("hl-sel");
      }
      if(S.phase==="play"&&!isAI(S.current)&&(!NET.mode||S.current===NET.me)){ // 온라인: 상대 턴 강제 대상·텔레포트 하이라이트 비노출
        if(S.forcedTargets&&S.forcedTargets.length&&p&&S.forcedTargets.includes(p.id)) cell.classList.add("hl-attack"); // T1 강제 대상
        if(S.teleport){ // #14 스왑형: 자기 말 2개 선택 하이라이트
          if(S.teleport.stage===1){ if(p&&p.owner===S.current&&p.immobile===0) cell.classList.add("hl-move"); }
          else { if(p&&p.owner===S.current&&p.immobile===0&&p.id!==S.teleport.piece.id) cell.classList.add("hl-move");
            if(p&&S.teleport.piece&&p.id===S.teleport.piece.id) cell.classList.add("hl-sel"); }
        }
      }
    }
    const game=S, pick=S.fleePick;
    cell.onclick=()=>{if(S===game&&S.fleePick===pick) onCell(r,c);}; // #114 오래된 도망 후보 DOM은 새 선택·새 게임에 입력하지 않는다
    bd.appendChild(cell);
  }
}
function canMoveTo(p,r,c){
  if(S.phase!=="play"||S.mainUsed||p.owner!==S.current) return false;
  if(p.type==="trap") return false; // 함정은 상시 고정 (GDD-13 4.5 개정 — 폭탄만 이동 상시화)
  if(p.immobile>0) return false;
  const d=Math.abs(p.r-r)+Math.abs(p.c-c);
  if(d!==1){
    // BT 이동 강화: 직선 2칸 (폭탄 포함·함정 제외, 출발·경유·도착이 원정 구역이면 불가)
    if(d!==2||(p.r!==r&&p.c!==c)||!isBurning()) return false;
    if(expedZone(p.owner,p.r)||expedZone(p.owner,(p.r+r)/2)||expedZone(p.owner,r)) return false;
    const m=at((p.r+r)/2,(p.c+c)/2);
    if(m&&visibleTo(p.owner,m)) return false; // 경유 칸의 보이는 말 차단 (숨은 적 충돌은 doMove가 해석)
  }
  const o=at(r,c);
  if(o&&o.owner===p.owner) return false;
  if(o&&visibleTo(p.owner,o)) return false;
  return true;
}
function canBattle(att,def){
  if(S.phase!=="play"||att.owner!==S.current||S.battlesUsed>=2) return false;
  if(att.type==="bomb"||att.type==="trap") return false;
  /* #122 REVISE(2026-09-10 CJ QA 6): **왕 vs 왕 불가침을 폐지**한다 — CJ 실플레이에서 텔레포트로 두 왕이
     맞닿는 상황이 실제로 나왔고, 그때 아무 일도 일어나지 않는 것이 아니라 전투가 되어야 한다는 결정이다.
     남는 전투 불가 조합은 폭탄·함정이 공격측일 때뿐이다(위 두 줄). 패배 결과는 기존 규칙 그대로 — 왕 본체가 지면 그 즉시 경기 패배다. */
  if(S.forcedTargets&&S.forcedTargets.length&&(att!==S.movedPiece||!S.forcedTargets.includes(def.id))) return false; // T1: 강제 대상 외 전투 봉쇄
  if(S.battlesUsed===1){
    // #14: 텔레포트 스왑 둘째 말의 승계 강제 전투는 연쇄(첫 전투 승리) 조건 면제
    const forcedOk=S.forcedTargets&&S.forcedTargets.length&&att===S.movedPiece&&S.forcedTargets.includes(def.id);
    if(!forcedOk){
      if(!S.firstBattleWonByMover||!att.alive||att!==S.movedPiece) return false;
      if(!S.contactSet.includes(def.id)) return false;
    }
  }
  return true;
}
function renderTurnBar(){
  const tb=$("turnBar"); tb.innerHTML="";
  if(S.phase!=="play") return;
  const aiTurn=isAI(S.current)||(NET.mode&&S.current!==NET.me); // 온라인: 상대 턴이면 조작 불가
  const game=S, turn=S.turnCount, pick=S.fleePick;
  const fresh=()=>S===game&&S.turnCount===turn&&S.fleePick===pick;
  const mk=(txt,fn,dis,cls)=>{const b=document.createElement("button");b.textContent=txt;b.onclick=()=>{if(fresh()) fn();};b.disabled=!!dis||aiTurn;if(cls)b.className=cls;tb.appendChild(b);return b;};
  if(S.fleePick){ // #114 도망 교환 선택 중: 소유자(S.current 와 다를 수 있음)만 [교환 생략] — 그 외 턴 조작은 전부 숨긴다. 기권은 자기 턴 규칙 그대로
    const mine=fleePickMine();
    const b=document.createElement("button"); b.textContent="교환 생략 (그대로 밀어내기)"; b.onclick=()=>{if(fresh()) netAction({t:"fleeSkip"});}; b.disabled=!mine; b.className="primary"; tb.appendChild(b);
    mk("기권",confirmResign,false,"danger");
    const s=document.createElement("span"); s.className="badge"; s.textContent=mine?"🏃 도망 성공 — 후방 말(파란 칸)을 클릭해 교환하거나 생략":"🏃 상대가 말을 교체 중입니다…"; tb.appendChild(s);
    return;
  }
  const sel=S.selected&&!S.selected.tray?S.selected:null;
  const ev=sel?S.events.find(e=>e.r===sel.r&&e.c===sel.c&&!e.consumed&&S.traces[S.current].has(e.r+"_"+e.c)):null;
  mk("탐색",()=>netAction({t:"search"}),!(sel&&ev&&!S.mainUsed&&sel.owner===S.current&&canSearchPiece(sel))); // #20: 폭탄·함정은 탐색 실행 불가
  const teleDis=S.mainUsed||!teleportAvailable(S.current)||S.teleUsed[S.current]>=BAL.teleMax;
  mk(S.teleport?"텔레포트 취소":"🌀 텔레포트",()=>netAction({t:"tele"}),teleDis); // #14 스왑형 · #114 경기당 횟수 제한 없음 (주 행동 1회 소모)
  if(!teleDis&&!aiTurn&&S.mode!=="sim") tutHint("teleport"); // #26 사람 턴에 텔레포트가 처음 가능해질 때 1회 도움말 (게임 상태 무변경)
  mk("🌿 회복",()=>netAction({t:"heal",id:sel?sel.id:null}),!(sel&&canHeal(sel))); // #106 T2 회복 주 행동 — 자기 말 선택·하수인/동료/왕 (#114: 만피 말도 '기다리기'로 지정 가능)
  const forced=S.forcedTargets&&S.forcedTargets.length>0;
  /* #114 CJ 선택 A: 평소 [주 행동 생략]·[턴 종료] 버튼은 없다 — 할 수 있는 행동이 없으면 자동으로 넘어간다(autoEndCheck).
     주 행동을 마친 뒤 선택 전투가 남아 있을 때만 "싸우지 않고 종료" 를 표시해 기존 전투 선택권을 유지한다. 강제 대상이 남으면 표시하지 않는다 */
  if(S.mainUsed&&!forced&&!S.forcedQueue.length&&!S.teleport&&!fxLocked()&&$("overlay").classList.contains("hidden")&&optionalBattleLeft()) mk("싸우지 않고 종료",()=>netAction({t:"endTurn"}),false,"primary");
  mk("기권",confirmResign,false,"danger");
  if(forced){const s=document.createElement("span");s.className="badge";s.textContent="⚔️ 강제 전투 대상 선택";tb.appendChild(s);}
  if(aiTurn){const s=document.createElement("span");s.className="badge";s.textContent=(NET.mode&&!isAI(S.current))?"🌐 상대 턴 진행 중…":"🤖 AI 행동 중…";tb.appendChild(s);}
}
/* #114 도망 교환 선택의 입력 주인이 이 화면의 사람인가 — PVE: 사람(0) · 핫시트: 기기 공유(소유자 시점으로 전환) · 온라인: NET.me */
function fleePickMine(){
  if(!S||!S.fleePick||isAI(S.fleePick.owner)) return false;
  return NET.mode?S.fleePick.owner===NET.me:true;
}
function renderSide(){
  const sp=$("sidePanel");
  /* #217 실브라우저 E2E로 발견: 이 재접속 배너가 renderSetup() 안에만 있어 배치(setup) 단계에서 끊겼을
     때만 보였다 — 실제 대국 중(play)에 끊기면 화면이 그냥 마지막 상태에 멈춰 아무 피드백이 없었다(진짜
     클라이언트 버그, 테스트 오탐과는 별개). phase 분기보다 먼저 확인해 어느 단계에서 끊겨도 동일하게 뜨게
     한다 — renderSetup() 안의 원래 분기는 이제 도달하지 않는 죽은 코드라 함께 지운다. */
  if(NET.publicMode&&NET.resuming){
    const remain=Math.max(0,Math.ceil((NET.resumeDeadline-Date.now())/1000));
    sp.innerHTML=`<h2>🌐 재접속 중…</h2>
      <p style="margin:8px 0;color:var(--dim)" aria-live="polite">연결이 끊겼습니다. 자동으로 다시 연결을 시도합니다 (남은 시간 ${remain}초).</p>
      <div class="row"><span class="badge">방 #${NET.roomId}</span><span class="badge">시도 ${NET.resumeAttempts}회</span></div>
      <div class="row"><button class="danger" onclick="netCancelResume()">재접속 포기하고 방 목록으로</button></div>`;
    return;
  }
  if(S.phase==="menu"){
    /* #122: 카드 세 장으로 나눈 세로 로비. 진입점·문구·입력칸(주소/코드 2개)·관전 링크·튜토리얼 버튼은 종전 그대로다 */
    sp.innerHTML=`<h2>오늘은 누구와 겨룰까요?</h2>
      <p style="margin:6px 0 8px;font-size:12.5px;color:var(--dim)">7×13 전장에서 정체와 숲 속 위치를 감춘 14개의 말을 운용해 상대 왕을 제거하세요.</p>
      <div class="lobbyCard net" aria-labelledby="netLobbyTitle"><span class="tagPill">공개 방</span>
      <h2 id="netLobbyTitle">공개 대전</h2>
      <small>열린 방을 골라 바로 참가하세요. 초대 코드는 필요하지 않습니다.</small>
      ${location.protocol==="file:"?`<p style="margin:6px 0"><small style="color:var(--buff)">⚠️ html 파일을 직접 연 상태(file://)에서는 공개 대전에 접속할 수 없습니다. 공개 방 서버가 서빙하는 주소로 페이지를 열어 주세요.</small></p>`:""}
      ${netRoomsHtml()}
      <span class="badge netStatusLine" id="netStatus" role="status" aria-live="polite" style="display:none"></span></div>
      <div class="lobbyCard"><span class="tagPill">혼자서</span>
      <h2>PVE (AI 대전) — 난이도 선택</h2>
      <div class="row"><button class="primary big" onclick="startMode('pve',{aiLevel:'grade5'})">5급 — 기본 AI</button>
        <button class="primary big" onclick="startMode('pve',{aiLevel:'dan5'})">5단 — 탐색·추론 기반 강AI</button></div>
      <small>5급: 휴리스틱 기준선 AI · 5단: 공정 관측 아래 2수 앞(상대 최선 응수)까지 평가하는 제한 탐색 AI</small></div>
      <div class="lobbyCard"><span class="tagPill">한 기기 2인</span>
      <div class="row" style="margin-top:2px"><button class="big" onclick="startMode('pvp')">PVP (핫시트 2인)</button></div>
      <small>기기를 번갈아 건네며 대전합니다. 교대할 때마다 화면이 가려집니다.</small></div>
      <div class="row"><a class="simlink" onclick="startMode('sim')">AI vs AI 시뮬레이션(관전 · 5급 vs 5급)</a>
        <a class="simlink" onclick="startMode('sim',{aiLevel:['dan5','grade5']})">5단 vs 5급 관전</a></div>
      <div class="row" style="margin-top:10px"><button type="button" onclick="tutOpen()">📖 튜토리얼 다시 보기</button></div>`;
    return;
  }
  if(S.phase==="setup"){renderSetup(sp);return;}
  if(S.phase==="over"){
    /* #122: 경기 결과 화면. 종전의 [처음으로](location.reload)는 **같은 문서 안의** [로비로 돌아가기]·[다시 대전]으로 바뀐다 —
       #128 자동 튜토리얼은 새 문서 로드에서만 뜨므로, 같은 문서의 로비 복귀·재대전에서는 다시 뜨지 않는다 (정책 그대로).
       온라인은 매칭·프로토콜을 새로 타야 하므로 재대전 버튼을 만들지 않고 로비 복귀만 둔다 (서버·계정·매칭 무변경). */
    const draw=S.winner===null;
    const neutral=S.mode==="sim"||(S.mode==="pvp"&&!NET.mode);
    const mine=!draw&&!neutral&&viewerIsOwner(S.winner);
    const crest=draw?"draw":(neutral?"":(mine?"":"lose"));
    sp.innerHTML=`<small>MATCH COMPLETE</small>
    <div class="resultCrest ${crest}">${draw?"DRAW":(neutral?"MATCH<br>COMPLETE":(mine?"VICTORY":"DEFEAT"))}</div>
    <h2>경기 종료</h2><p style="font-size:18px;margin:8px 0">${draw?(NET.publicMode?"무효 경기 (양측 연결 종료)":"무승부 (시뮬레이션 턴 상한 도달)"):pname(S.winner)+" 승리! 🏆"}</p>
    ${S.metrics.winType&&WINTYPE_KO[S.metrics.winType]?`<p style="margin:4px 0;color:var(--dim)">승리 유형: ${WINTYPE_KO[S.metrics.winType]}</p>`:""}
    ${NET.publicMode&&S.metrics.winType==="forfeit"?`<p style="margin:4px 0;color:var(--dim)">${viewerIsOwner(S.winner)?"상대의 연결이 끊긴 채 유예 시간이 지나 몰수승입니다.":"연결이 끊긴 채 유예 시간이 지나 몰수패 처리되었습니다."}</p>`:""}
    <p style="margin:4px 0;color:var(--dim)">총 진행 ${S.turnCount}턴</p>
    ${S.mode!=="sim"&&(!NET.publicMode||NET.finalReveal)?`<p style="margin:4px 0;color:var(--dim)">🔍 종료 공개 — 보드의 모든 말 위치·정체가 공개되었습니다.</p>`:""}
    <div class="row" style="margin-top:10px;justify-content:center">
      <button class="primary big" onclick="toLobby()">로비로 돌아가기</button>
      ${NET.mode?"":`<button class="big" onclick="rematch()">다시 대전</button>`}</div>
    ${NET.publicMode?`<small>새 대전은 로비의 공개 방 목록에서 방을 만들거나 참가하세요.</small>`:NET.mode?`<small>온라인 재대전은 로비에서 서버 주소·접속 코드를 넣고 다시 매칭합니다.</small>`:""}`;
    return;
  }
  const p = NET.mode?NET.me:(S.mode==="pvp"?S.current:0); // 온라인: 사이드 패널은 항상 내 정보
  let h=`<h2>${pname(p)}</h2>
  <div class="row"><span class="badge">몬스터볼 ${S.balls[p]}</span>
  <span class="badge">아이템 ${S.inv[p].length}</span>${S.pkgs?`<span class="badge">🎁 ${S.pkgs[p].itemGift}</span><span class="badge">✨ ${S.pkgs[p].battleBuff}</span>`:""}
  <span class="badge">전투 ${S.battlesUsed}/2</span>
  ${S.reserve[p]?`<span class="badge">예비 하수인(${ELEM_KO[S.reserve[p].element]}) HP ${S.reserve[p].hp}/${S.reserve[p].maxHp}</span>`:""}
  <span class="badge">${S.mainUsed?"주 행동 완료":"주 행동 가능"}</span></div>
  <div class="row">${S.inv[p].map(i=>`<span class="badge">${ITEMS[i].ko}</span>`).join("")||"<small>아이템 없음</small>"}</div>`; // #121 계약 2.1: 보유 상한 없음 — 분모를 쓰지 않는다
  if(S.selected&&!S.selected.tray&&!isAI(S.current)&&(!NET.mode||S.current===NET.me)){ // 온라인: 상대가 선택한 말 정보(HP 등) 비노출
    const s=S.selected;
    h+=`<h2>선택: ${idLabel(p,s)}</h2><div class="status">HP ${s.hp}/${s.maxHp}${s.immobile>0?` · 이동 불가 ${s.immobile}턴`:""}${s.cap?` · 포획 하수인(${ELEM_KO[s.cap.element]}) HP ${s.cap.hp}/${s.cap.maxHp}`:""}${s.healing?` · 🌿회복 자세(턴마다 +${Math.round(s.maxHp*BAL.healPostPct)})`:""}</div>
    ${s.skills?`<div class="status">${s.skills.map((id,i)=>skillNameKo(id,s.element)+(s.cds[i]?`(쿨${s.cds[i]})`:"")).join(" · ")}</div>`:""}
    <small>이동: 파란 칸 · 전투: 빨간 칸 클릭</small>`;
  } else if(!isAI(S.current)) h+=`<small>자기 말을 클릭해 선택하세요.</small>`;
  /* #131 (v0.4.7 CJ 2026-09-10): 텔레포트 2단계 안내 문구는 계약 문자열 그대로 쓴다.
     함정에 걸린 말(immobile>0)은 **양끝 어느 쪽으로도** 고를 수 없고 실행도 되지 않는다 (함정 유닛 자체를 막는 규칙이 아니다 —
     막히는 것은 "함정에 걸려 이동 불가 상태인 말"이다). 도망 교환·강제 밀기에는 이 제한을 확장하지 않는다. */
  if(S.teleport&&!isAI(S.current)&&(!NET.mode||S.current===NET.me))
    h+=`<h2>🌀 텔레포트 스왑</h2><small>${S.teleport.stage===1?TELE_PICK1_MSG:TELE_PICK2_MSG}</small>`
      +(S.teleport.stage===1?"":`<small>첫 말을 다시 클릭하면 선택이 취소됩니다.</small>`);
  if(S.fleePick) h+=fleePickMine() // #114 도망 교환: 소유자 안내 / 상대 대기 (거울) — 후보·위치는 소유자 화면에만
    ?`<h2>🏃 도망 성공 — 위치 교환</h2><small>${S.mode==="pvp"&&!NET.mode?`🔒 ${pname(S.fleePick.owner)}만 확인 (상대는 시선 회피) · `:""}후방의 자기 말(파란 칸)을 클릭하면 도망친 말과 자리를 바꿉니다. 교환 후 전선의 말과 상대 말을 한 칸씩 밀어냅니다. 생략하면 도망친 말과 상대 말을 밀어냅니다.</small>`
    :`<h2>🛗 도망 성공!</h2><small>상대가 말을 교체 중입니다. 교체 후 말을 한칸씩 밀어냅니다.</small>`;
  if(S.forcedTargets&&S.forcedTargets.length&&!isAI(S.current)&&(!NET.mode||S.current===NET.me)) h+=`<h2>⚔️ 강제 전투</h2><small>새로 인접한 적(빨간 표시) 중 하나와 전투해야 턴을 마칠 수 있습니다.</small>`;
  if(!isAI(S.current)||NET.mode||S.mode==="pve"){ // #11·#36 추측 메모 목록 (뷰어 전용 — 상대 비노출): 이모지 + 쉬운 라벨, 공개된 말은 실제 정체 병기 · #94 온라인·PVE는 상대 턴·AI 턴에도 표시(메모 편집 가능)
    const mm=Object.entries(S.memos[p]).map(([id,k])=>{
      const x=S.pieces.find(z=>String(z.id)===id), o=memoOpt(k); // #217 공개 방의 말 id는 불투명 별칭 문자열이다 — 숫자 id도 문자열 비교로 같다
      /* #201 후속: 보드·추측 격자와 같은 도형을 이 목록에서도 쓴다 (전용 도형이 있는 기호만 · 뒤따르는 "— 함정 추측" 문구는 그대로) */
      const sym=o&&SYM_SVG[k]?`<span class="guess sv" aria-hidden="true">${symSvgHtml(k)}</span>`:`<span class="guess" aria-hidden="true">${o?o.emoji:""}</span>`;
      return x&&x.alive&&x.placed&&o?`<div class="status">${sym} ${x.r}행 ${x.c}열 — ${o.ko} 추측${x.revealed?` (공개됨: ${idLabel(p,x)})`:""}</div>`:"";
    }).filter(Boolean).join("");
    if(mm) h+=`<h2>📝 추측 메모</h2>${mm}<small>물음표 말 클릭으로 변경·삭제</small>`;
  }
  sp.innerHTML=h;
}
/* #122 보드 화면의 얇은 상태 줄 — 상시 사이드바를 없앤 대신 "지금 누구 차례·무엇을 골랐나"만 남긴다.
   내용은 전부 renderSide 가 이미 같은 뷰어 기준으로 계산해 둔 값의 요약이라 새 정보를 만들지 않는다 (비공개 경계 동일). */
function renderBoardInfo(){
  const el=$("boardInfo"); if(!el) return;
  if(!S||S.phase!=="play"){ el.innerHTML=""; return; }
  const p=NET.mode?NET.me:(S.mode==="pvp"?S.current:0);
  const mineTurn=!isAI(S.current)&&(!NET.mode||S.current===NET.me);
  const sel=(S.selected&&!S.selected.tray&&mineTurn)?S.selected:null;
  const who=isAI(S.current)?`🤖 ${pname(S.current)}`:fxTurnLabel(S.current,false);
  const info=sel?`${idLabel(p,sel)} · HP ${sel.hp}/${sel.maxHp}`
    :(!mineTurn?"상대가 행동을 선택하고 있습니다":(S.mainUsed?"주 행동 완료":"자기 말을 선택하세요"));
  el.innerHTML=`<span class="who">${who} · ${S.turnCount+1}턴${isBurning()?" 🔥BT":""}</span>`
    +`<span class="sel">${info} · 전투 ${S.battlesUsed}/2</span>`
    +`<button type="button" class="more" onclick="uiDrawer('side')">상세 ›</button>`;
}
function renderSetup(sp){
  const p=S.setupPlayer;
  if(NET.queued){ // 온라인: 배치 완료 → 매칭 대기
    sp.innerHTML=`<h2>🌐 매칭 대기 중…</h2>
      <p style="margin:8px 0;color:var(--dim)">배치가 저장되었습니다. 상대도 배치를 마치고 매칭을 시작하면 자동으로 대전이 시작됩니다.</p>
      <div class="row"><span class="badge" id="netStatus">🌐 서버 접속 중…</span></div>
      <div class="row"><button class="danger" onclick="netCancelQueue()">매칭 취소 (배치 유지)</button></div>`;
    return;
  }
  if(NET.mode&&p!==NET.me){ // 온라인: 상대 배치 화면(로스터·배치 상황) 비노출
    sp.innerHTML=`<h2>🌐 상대 배치 중…</h2><small>상대가 로스터 선택과 비공개 배치를 진행하고 있습니다. 완료되면 자동으로 진행됩니다.</small>`;
    return;
  }
  // (재접속 배너는 renderSide() 최상단으로 옮겼다 — 배치 단계만이 아니라 대국 중 단절에도 뜨도록. §위 주석 참조)
  if(NET.publicMode&&!NET.started&&NET.readyWanted){ // #217/#218 공개 방: 준비 의사 이후 — 표시는 서버가 확정한 값(room_state state·seats.ready)만 쓴다
    /* 상대 입장 대기(OPEN)와 상대 준비 대기(SETUP)를 서버 상태로 구별한다(Earth/lobby-guide.md). 내 준비는 서버가
       seats.ready 로 확정하기 전까지 "요청 중"이다 — 두 참가자 준비 뒤에도 서버 시작 상태 전에는 로컬로 시작하지 않는다. */
    const opp=NET.roomState==="OPEN"?"입장 대기":NET.peerReady?"준비 완료":"준비 중";
    const line=NET.roomState==="OPEN"?"상대를 기다리는 중…":!NET.myReady?"서버에 준비를 알리는 중…":NET.peerReady?"두 참가자가 준비했습니다. 서버가 대국을 시작하는 중…":"상대의 준비를 기다리는 중…";
    sp.innerHTML=`<h2 id="netRoomTitle">공개 방 #${escAttr(String(NET.roomId))}</h2>
      <p style="margin:8px 0;color:var(--dim)" role="status" aria-live="polite">${line}</p>
      <div class="row"><span class="badge">내 준비: ${NET.myReady?"<span class=\"netOkDot\" aria-hidden=\"true\">●</span> 완료":NET.roomState==="OPEN"?"상대 입장 후 전송":"요청 중…"}</span><span class="badge">상대: ${NET.peerReady?"<span class=\"netOkDot\" aria-hidden=\"true\">●</span> ":""}${opp}</span></div>
      <div class="row netRoomActions"><button type="button" onclick="netRoomReady(false)">준비 취소</button><button type="button" class="danger" onclick="netLeaveRoom()">방 나가기</button></div>`;
    return;
  }
  const sel=S.roster[p], rosterDone=sel.length===6;
  const unplaced=S.pieces.filter(x=>x.owner===p&&!x.placed);
  /* #122: 출전 준비를 "01 로스터 선택 / 02 비공개 배치" 두 단계로 나눠 보여 준다. 두 절 모두 항상 DOM 에 있고
     CSS 로 한 쪽만 보인다 — 안내 문구·버튼·트레이 마크업은 종전 그대로다. 배치 단계에서는 트레이가 화면 아래에 고정되어
     "트레이 말 탭 → 보드 칸 탭" 조작이 스크롤로 끊기지 않는다. */
  let h=(NET.publicMode&&!NET.started?`<div class="netRoomBar"><b id="netRoomTitle">공개 방 #${escAttr(String(NET.roomId))}</b>
    <span class="badge" role="status" aria-live="polite">상대: ${NET.roomState==="OPEN"?"입장 대기":NET.peerReady?"준비 완료":"준비 중"}</span>
    <button type="button" class="danger" onclick="netLeaveRoom()">방 나가기</button></div>`:"")+`<div class="prepTabs">
    <button type="button" data-prep-step="roster" aria-pressed="${UI.prep==="roster"}" onclick="uiPrep('roster')">01 로스터 선택 ${sel.length}/6</button>
    <button type="button" data-prep-step="place" aria-pressed="${UI.prep==="place"}" onclick="uiPrep('place')">02 비공개 배치 ${14-unplaced.length}/14</button></div>
  <section class="prepStep" data-step="roster">
  <h2>${NET.preparing?"🌐 온라인 대전 — 내":pname(p)} 로스터 선택 (${sel.length}/6)</h2>
  <small>30종 중 6종을 중복 없이 선택 (카드 클릭 → 정보 팝업에서 선택). 속성은 종에 고정 · 경기 시작은 모두 ⭐1(1차 기본기).</small>`;
  for(const el of V2_ELEM_ORDER){ // #234 (GDD-23 6.3): 5속성 × 6아키타입
    h+=`<div class="row">`;
    for(const rd of ROSTER.filter(r=>r.element===el))
      h+=`<div class="rosterCard ${sel.includes(rd.id)?"on":""}" onclick="rosterInfo('${rd.id}')">
        <b class="el-${rd.element}">${rd.name}</b>
        <small>${ELEM_KO[rd.element]}·${ARCH_KO[rd.arch]} · HP${rd.hp} 공${rd.atk} · ${speciesSkills(rd.id,4).map(s=>SKILLS[s].ko).join("·")}</small></div>`;
    h+=`</div>`;
  }
  h+=`</section><section class="prepStep" data-step="place">
  <h2>비공개 배치 (${14-unplaced.length}/14)</h2>
  <small>말을 클릭 → 자기 진영 칸 클릭. 배치된 말 클릭 시 회수.${rosterDone?"":" <b>하수인은 로스터 6종 선택 후 활성됩니다.</b>"}</small>
  <div class="tray">`;
  for(const x of unplaced){
    if(x.type==="minion"&&!rosterDone) continue;
    h+=`<div class="trayItem ${S.selected&&S.selected.id===x.id?"sel":""}" onclick="selTray(${x.id})">
      <div class="pc p${p}" aria-label="${pcLabel(x)}">${pcBodyHtml(x)}</div>
    </div>`;
  }
  h+=`</div><div class="row">
    <button onclick="autoPlace()">무작위 배치</button>
    <button onclick="clearPlace()">전체 회수</button>
    <button class="primary" onclick="setupDone()" ${unplaced.length||!rosterDone?"disabled":""}>${NET.publicMode?"배치 완료 → 준비 완료":NET.preparing?"배치 완료 → 매칭 시작":"배치 완료"}</button></div></section>`;
  sp.innerHTML=h;
}
function renderLog(){
  const el=$("log");
  el.innerHTML=S.log.slice(-60).map(l=>`<div class="${l.cls}">${l.msg}</div>`).join("");
  el.scrollTop=el.scrollHeight;
}
function renderMetrics(){
  if(S.phase==="menu"){$("metrics").textContent="모드를 선택하면 지표 수집을 시작합니다.";return;}
  const m=S.metrics;
  const total=`[${S.mode.toUpperCase()}] 턴 ${S.turnCount} · 선공 ${m.firstPlayer===null?"-":pname(m.firstPlayer)} · 전투 ${m.battles} (판정 ${m.judged}·동률 ${m.ties}) · 공격측 승 ${m.attackerWins}/방어측 승 ${m.defenderWins} · 밀어내기 ${m.pushes} · 강제 전투 ${m.forcedBattles} · 텔레포트 ${m.teleports} · 상태 부여 ${m.statusApplied}/실패 ${m.statusFailed} · 적진 진입 ${m.minionInvades} · 탐색 ${m.searches} · 하수인 탐색 ${m.minionSearches} · 중립 포획 ${m.captures}(실패 ${m.captureFails}) · 적 포획 시도 ${m.enemyCapTries}/성공 ${m.enemyCaptures}/실패 ${m.enemyCapFails} · 도망 ${m.fleeOks}/${m.fleeTries} · 폭탄 이동 ${m.bombMoves} · 함정 발동 ${m.trapTriggers} · 폭탄: 하수인 소모 ${m.bombHitsMinion}/VIP 제거 ${m.bombClearedByVip} · 왕 숲 체류 ${m.kingForestTurns}턴 · 전투 회피 ${m.battleRefusals} · ${m.btReached?`🔥BT 진입 턴 ${m.btEnterTurn}`:"BT 미도달"}${S.phase==="over"?` · 종료 턴 ${m.endTurn}${m.winType?` · 승리 유형 ${WINTYPE_KO[m.winType]}`:""} · 승자 ${S.winner===null?"없음(무승부)":pname(S.winner)}`:""}`;
  // #20 플레이어별 핵심 행동 (합산과 이중 집계 정합: 각 키의 [0]+[1] = 합산)
  const per=[0,1].map(p=>`<div style="margin-top:3px"><b>${pname(p)}</b>${p===m.firstPlayer?" (선공)":""}${S.phase==="over"&&S.winner===p?" 🏆승자":""}: `+
    PLAYER_METRIC_KEYS.map(k=>`${PLAYER_METRIC_KO[k]} ${m.byPlayer[p][k]||0}`).join(" · ")+`</div>`).join("");
  $("metrics").innerHTML=total+per;
}
/* #20 지표 저장용 스냅샷 (합산 + 플레이어별 + 승자·선공·승리 유형) — 헤드리스·리포트 공용 */
function metricsSnapshot(){
  const m=S.metrics;
  return {mode:S.mode,aiLevel:S.aiLevel.slice(),turn:S.turnCount,phase:S.phase,firstPlayer:m.firstPlayer,winner:S.winner,winType:m.winType,endTurn:m.endTurn,
    total:Object.fromEntries(Object.keys(m).filter(k=>k!=="byPlayer").map(k=>[k,m[k]])),
    byPlayer:[Object.assign({},m.byPlayer[0]),Object.assign({},m.byPlayer[1])]};
}
window.metricsSnapshot=metricsSnapshot;

/* ===== #122 (v0.4.7) 같은 문서 안의 로비 복귀·재대전 =====
   location.reload() 를 부르지 않는 출구라 #128 자동 튜토리얼은 다시 뜨지 않는다 (새 문서 로드에서만 뜬다 — 정책 그대로).
   저장소·상황 도움말 이력·사용자 저장값은 하나도 건드리지 않는다. */
function netLeave(){ // 온라인 상태 완전 해제 — 이 정리 없이 로비로 가면 다음 오프라인 경기가 온라인 게이팅·보드 반전·인덱스 중계를 그대로 물고 간다
  try{ if(NET.ws) NET.ws.close(); }catch(e){}
  NET.mode=false; NET.me=null; NET.ws=null; NET.replaying=false; NET.queue=[]; NET.modalSeq=0; NET.syncModal=null;
  NET.localOpen=false; NET.modalOwner=null; NET.started=false; NET.preparing=false; NET.queued=false;
  NET.mySetup=null; NET.pendingSeed=null; NET.code=null; // 접속 코드는 탭 메모리에만 있었고 여기서 버린다 (재입력)
  NET.rooms=[]; NET.roomsLoading=false; NET.roomId=null; NET.seatToken=null; NET.publicMode=false;
  NET.myReady=false; NET.peerReady=false; NET.waitingForPeer=false; NET.pendingRoomAction=null; // #217/#218 공개 방 상태도 함께 해제
  netClearResume(); NET.explicitLeave=false; NET.epoch=null; NET.tokenGen=0; // #217 재접속 타이머·유예 상태도 함께 해제
  NET.roomState=null; NET.readyWanted=false; NET.readySent=false; NET.lobbyPending=null; NET.result=null; NET.finalReveal=false; NET.autoEndBlockRev=null; NET.lastActionAuto=false;
  /* #217 표시 계층(fx 재생 큐·전투 무대·오버레이 소유)도 해제 — 옛 방의 예약 콜백은 세대 증가로 스스로 멈춘다 */
  NET.fxGen=(NET.fxGen||0)+1; NET.fxQueue=[]; NET.fxPlaying=false; NET.fxCur=null; NET.fxEpoch=null; NET.fxRoomId=null; NET.fxSeat=null;
  NET.fxBattleSnaps={}; NET.fxDisp={}; NET.stageBid=null; NET.fxLiveBid=null; NET.battleMenu=null; NET.overlaySig=null; NET._overlayOpen=false;
  try{ fxSetLockClass(false); const fb=$("fxBanner"); if(fb&&fb.classList) fb.classList.add("hidden"); }catch(e){}
  setSeed(null); // 공유 시드 해제 — 이후 오프라인 경기는 다시 Math.random
}
function uiResetScreen(){ // 이전 경기의 연출 큐·모달·토스트 잔존 0 (DOM 을 비워 무한 버프 애니메이션까지 멈춘다)
  try{ fxReleaseAll(); }catch(e){}
  try{ close(); }catch(e){}
  try{ const ob=$("overlayBox"); if(ob) ob.innerHTML=""; }catch(e){}
  try{ clearToasts(); }catch(e){}
  UI.drawer=null; UI.prep="roster";
  UI.ask=null; UI.hold=false; UI.holdQ=[]; // #122 REVISE: 확인창 소유권·AI 보류 큐도 함께 정리 (이전 경기 잔존 0)
}
window.toLobby=()=>{
  const wasPublic=NET.publicMode; // #217 공개 방 경기에서 돌아오면 공개 방 목록을 바로 새로 불러온다
  uiResetScreen(); netLeave();
  newGame("pvp"); S.phase="menu"; S.selected=null; UI.entered=true;
  addLog("🏠 로비로 돌아왔습니다. 모드를 다시 고르세요.","sys");
  render();
  if(wasPublic) netListRooms();
};
window.rematch=()=>{
  if(NET.mode){ showToast("🌐 온라인 재대전은 로비에서 다시 매칭합니다."); return; }
  const mode=S.mode, lv=S.aiLevel.slice();
  uiResetScreen();
  startMode(mode, mode==="pve"?{aiLevel:lv[1]}:(mode==="sim"?{aiLevel:lv}:{}));
};

/* ===== 모드 시작 ===== */
window.startMode=(mode,opts)=>{
  opts=opts||{};
  UI.entered=true; UI.drawer=null; UI.prep="roster"; // #122 표시 상태만 초기화 (규칙·저장소 무관)
  let lv=opts.aiLevel; // #21: 문자열(PVE 상대 난이도) 또는 [p0,p1] 배열(sim)
  if(typeof lv==="string") lv=["grade5",lv];
  newGame(mode,{aiLevel:lv});
  if(mode==="pvp"||mode==="pve"){
    addLog(mode==="pve"?`PVE(${AI_LEVEL_KO[S.aiLevel[1]]}${S.aiLevel[1]==="dan5"?" · 탐색·추론 기반 강AI":""}) — 당신의 14개 말을 배치하세요.`:"PVP — 두 플레이어가 번갈아 비공개 배치합니다.","sys");
    render();
  } else { // sim
    aiAutoPlace(0);
    aiAutoPlace(1);
    beginPlay();
  }
};
function beginPlay(){
  S.phase="play";
  S.current=Math.floor(rand()*2); // 무작위 선공 (Q6 확정)
  S.metrics.firstPlayer=S.current; // #20 선공 저장
  addLog(`무작위 선공: ${pname(S.current)}`,"sys");
  startTurn();
  afterStartTurn();
}
/* #106 턴 시작 공통 후처리: 핫시트는 기기 넘김 확인 뒤, 그 외는 즉시 턴 배너(+버닝 타임 배너 1회) → 렌더 → AI 스케줄(연출 idle 후) */
function afterStartTurn(){
  if(S.mode==="pvp"&&!NET.mode) handoff(pname(S.current)+" 턴 시작", ()=>{ turnBannerFx(); render(); });
  else { turnBannerFx(); render(); if(isAI(S.current)) aiSchedule(); }
}

/* ===== 배치 ===== */
window.selTrayCore=id=>dispatchCoreAction({t:"selTray",id});
window.toggleRosterCore=rid=>dispatchCoreAction({t:"roster",rid});
window.rosterInfo=rid=>{ // 로스터 정보 팝업 — [선택하기]/[선택 해제]는 toggleRoster와 동일 동작 (6/6·중복 불가 유지)
  const rd=ROSTER.find(r=>r.id===rid); if(!rd) return;
  const on=S.roster[S.setupPlayer].includes(rid);
  const slots=speciesSkills(rd.id,4); // #234 (GDD-23 6.1): ⭐N 은 1~N차 보유 — 4칸 모두 보여 주고 열리는 등급을 표시
  const rows=slots.map((sid,i)=>{const sk=SKILLS[sid];
    return `<div style="font-size:13px;margin:3px 0"><span class="badge">${i+1}차 · ⭐${i+1}</span> <b>${sk.ko}</b> <small>[${SKIND_KO[sk.kind]}] — ${sk.desc}</small></div>`;
  }).join("");
  netLocalModal(); // 로스터 정보 팝업은 로컬 전용 — 선택 확정(toggleRoster)만 동기화
  // #89 설명창 일러스트: 자기 로스터를 고르는 화면이므로 정보 은닉 대상이 아니다 (규격 5.3). 512 원본을 192로 축소 표시하고 실패 시 png → 숨김
  const rdir=rd.element+"_"+rd.arch;
  const rart=ART_DIR_SET.has(rdir)?`<div class="rosterArt"><img src="${artUrl(rdir,"portrait.webp")}" alt="${rd.name} 일러스트" width="192" height="192" onerror="artPortraitFail(this,'${rdir}')"></div>`:"";
  modal(`<h2 class="el-${rd.element}">${rd.name}</h2>${rart}
    <div class="row"><span class="badge el-${rd.element}">${ELEM_KO[rd.element]}</span><span class="badge">${ARCH_KO[rd.arch]}형</span>${on?`<span class="badge">✔ 선택됨</span>`:""}</div>
    <div class="status" style="margin:6px 0">⭐1 HP ${rd.hp} · 공격 ${rd.atk} (스킬 위력 💪N% = 공격력 × N%)</div>
    ${rows}`,
    [[on?"선택 해제":"선택하기",()=>{close(); toggleRoster(rid);}],["닫기",close]]);
};
function fillRosterRandom(p){ // 미선택분을 무작위 종으로 채움 (중복 없음)
  const rest=shuffle(ROSTER.filter(r=>!S.roster[p].includes(r.id)).map(r=>r.id));
  while(S.roster[p].length<6) S.roster[p].push(rest.pop());
  applyRoster(p);
}
window.autoPlaceCore=()=>dispatchCoreAction({t:"auto"});
window.clearPlaceCore=()=>dispatchCoreAction({t:"clear"});
window.setupDoneCore=()=>dispatchCoreAction({t:"setupConfirm",preparing:NET.preparing,publicMode:NET.publicMode});
