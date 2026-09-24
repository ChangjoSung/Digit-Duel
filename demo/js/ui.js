"use strict";
/* ===== 유틸 ===== */
/* #93 온라인 P2 화면 행 반사 — 표시 전용. 논리 좌표(S·dataset.r/c·클릭·통신·로그)는 불변이고 열 순서도 그대로다.
   조건은 NET.mode(=netStart 이후)이지 NET.me 단독이 아니다: 사전 배치·매칭 대기는 NET.mode=false 인 로컬 P0 배치(11~13행 = 이미 하단)라
   matched 로 NET.me=1 이 정해진 뒤에도 뒤집지 않는다 — netStart 의 applyNetSetup 이 P2 말을 1~3행으로 옮긴 뒤부터만 반사한다(이중 반전 방지).
   종료(over) 화면도 같은 방향을 유지한다. 핫시트 PVP·PVE·sim 은 NET.mode=false 라 무변경. */
const boardFlipped=()=> NET.mode&&NET.me===1;
/* #245 Saturn REVISE(M2): 공개 기록에 줄을 더하는 일은 권위 상태 변경이라 Core(core.js addLog)가 소유한다.
   표시 계층에 남는 것은 renderLog() 뿐이고, Core 는 UI_PORT.logged() 로 그것을 부른다. */
function showToast(msg,kind){
  try{
    const box=$("toasts"); if(!box||!box.appendChild) return;
    while(box.children&&box.children.length>=3) box.removeChild(box.firstChild);
    const t=document.createElement("div"); t.className="toast"+(kind?" "+kind:""); t.textContent=msg;
    box.appendChild(t);
    setTimeout(()=>{if(t.parentNode)t.parentNode.removeChild(t);},2300);
  }catch(e){}
}
/** #245 Saturn REVISE(M1·M3): **표시 전용** 소비기 — 여기서 하는 일은 화면을 그리는 것뿐이다.
    규칙 진행(전투 개시·경기 개시·탐색 완료 래치·도망 교환·예약 효과)은 Core 가 dispatch 안에서 이미 끝냈다.
    이 파일이 통째로 없어도(서버 권위 런타임) 같은 규칙이 같은 순서로 돌고, 달라지는 것은 화면뿐이다.
    Core 는 이벤트를 한 건씩 UI_PORT.event(=applyUiEvent) 로 넘긴다.
    @param {CoreEvent} event */
function applyUiEvent(event){ applyUiEvents([event]); }
/** @param {CoreEvent[]} events */
function applyUiEvents(events){
  for(const event of events||[]){
    if(event.type==="render"){ render(); continue; }
    if(event.type==="toast"){ showToast(event.message,event.kind); continue; }
    if(event.type==="logAppended"){ renderLog(); continue; }
    if(event.type==="battleRedraw"){ battleModal(); continue; }
    if(event.type==="closeOverlay"){ closeModal(); continue; }
    if(event.type==="gameReset"){ fxReleaseAll(); shopClockStop(); bagClockStop(); continue; } // #236 이전 경기의 상점·B08 마감도 새 경기로 넘어가지 않는다
    if(event.type==="tutHint"){ tutHint(event.key); continue; }
    if(event.type==="memoPick"){ memoModal(event.piece); continue; }
    if(event.type==="contactSituation"){ situationFx(event.att,event.def); continue; }
    if(event.type==="contactBanner"){ contactBannerFx(event.piece,event.sub); continue; }
    if(event.type==="matchBanner"){ // #126 경기 결과 배너 — 1회 보장 판정은 Core 가 이미 했다
      try{ fxReleaseAll(); }catch(e){} // 남아 있던 표시 큐를 먼저 걷어낸다 (Venus 3.2 · L5)
      fxPlay({key:"resultBanner",kind:"result",cls:event.banner.cls,title:event.banner.title,sub:event.banner.sub});
      continue;
    }
    if(event.type==="searchBanner"){ // #129 계약 8·9 — 완료 토큰·자동 종료 재평가는 Core 소유, 여기는 연출뿐
      closeModal();
      if(event.title) fxPlay({key:event.fxKey,kind:"banner",title:event.title,sub:event.sub});
      continue;
    }
    if(event.type==="searchEndLatched"){ searchEndCheck(); continue; } // 사람 클라이언트 편의: 자동 턴 종료 재평가
    if(event.type==="fx"){ fxPlay(event.item); continue; }             // 연출 큐 — 실리는 것은 값뿐이다 (콜백 없음)
    if(event.type==="battleEndFx"){ battleEndFx(event); continue; }    // 남은 메시지 → 결과 배너 → 창 닫기
    if(event.type==="aiTurn"){ aiSchedule(); continue; }               // AI 어댑터 — 규칙은 이미 끝났고 여기서는 다음 수를 예약만 한다
    if(event.type==="aiSetupTurn"){ aiAutoPlace(event.player); continue; }
    if(event.type==="aiRecruitTurn"){ const p=S.pieces.find(x=>x.id===event.pieceId); if(p) aiRecruitResolve(event.owner,p); continue; }
    if(event.type==="turnReady"){ // #106 턴 시작 후처리 — 핫시트는 기기 넘김 뒤 배너
      if(event.handoff) handoff(pname(event.player)+" 턴 시작", ()=>{ turnBannerFx(); render(); });
      else { turnBannerFx(); render(); }
      continue;
    }
    /* #236 경제 화면 — 규칙·회계는 Core 가 끝냈고 여기는 소유자 시점으로 상태를 읽어 그린다 */
    if(event.type==="shopOpened"){ shopShow(true); continue; }
    if(event.type==="shopChanged"){ if(event.toast&&shopViewer()===event.player) showToast(event.toast); shopShow(false); continue; }
    if(event.type==="shopRefused"){ if(shopViewer()===event.player) showToast("🛒 "+event.message); shopShow(false); continue; }
    if(event.type==="shopHandoff"){ shopShow(true); continue; }
    if(event.type==="shopClosed"){ if(isAI(event.player)&&!event.all) continue; shopClockStop(); if(event.kind==="start"){ UI.prep="place"; render(); } else closeModal(); continue; } // AI 완료는 사람 상점 창을 닫지 않는다
    if(event.type==="aiShopTurn"){ aiShop(event.player); continue; }
    if(event.type==="aiBagPickTurn"){ aiBagPick(event.owner); continue; }
    if(event.type==="bagPickOpen"){ const g=S; fxWhenIdle(()=>{ if(S===g&&S.eco.bagPick) bagPickShow(); }); continue; } // 전투 종료 연출이 창을 닫은 뒤
    if(event.type==="bagPickDone"){ if(isAI(event.owner)) continue; bagClockStop(); closeModal(); if(S.mode==="pvp"&&event.owner!==S.current&&S.phase==="play") handoff(pname(S.current)+" 턴 계속",render); continue; }
    if(event.type==="battleEntryPrompt"&&event.bag){ // #236 가방 대리 출전 — 본체 또는 가방 말 1마리 (소유자만)
      /* Saturn REVISE HIGH1: 핫시트에서 소유자가 차례 주인이 아니면(방어자 등) 가림 뒤에 열고, 고른 뒤 가림을 다시 거쳐 차례 주인에게 돌려준다 (B08 과 같은 규칙) */
      const side=event.side, g=S, away=S.mode==="pvp"&&event.owner!==S.current;
      const pick=(what,uid)=>{ closeModal(); const go=()=>{ if(S===g) dispatchCoreAction({t:"battleEntryPick",side,what,uid}); };
        if(away) handoff(pname(S.current)+" 턴 계속",go); else go(); };
      const show=()=>{ if(S!==g||!S.entryPick||S.entryPick.stage!==side) return;
        modal(`<h2>🔒 ${pname(event.owner)}만 확인${S.mode==="pvp"?" (상대는 시선 회피)":""}</h2>
        <p>${TYPE_KO[event.pieceType]} 출전 선택 — 대리가 지면 ${event.pieceType==="king"?"경기 패배":"그 동료도 제거"}, 이기면 받은 피해를 안고 가방으로 돌아옵니다.</p>`,
        [["본체 출전",()=>pick("body")]].concat(event.bag.map(u=>[`대리: ${u.name} ⭐${u.grade} HP ${u.hp}/${u.maxHp}`,()=>pick("bag",u.uid)]))); };
      if(away) handoff(`${pname(event.owner)} — ${TYPE_KO[event.pieceType]} 출전 선택`,show); else show();
      continue;
    }
    if(event.type==="battleEntryPrompt"){ // #12 대리 출전 — 비공개 선택. 답은 Core 액션으로만 돌아간다
      netModalOwner(event.owner); // 온라인: 이 비공개 선택의 주인은 해당 말 소유자 (방어자 포함)
      const res=event.reserve, cap=event.cap, side=event.side;
      const pick=what=>{ closeModal(); dispatchCoreAction({t:"battleEntryPick",side,what}); };
      modal(`<h2>🔒 ${pname(event.owner)}만 확인${S.mode==="pvp"&&!NET.mode?" (상대는 시선 회피)":""}</h2>
        <p>${TYPE_KO[event.pieceType]} 출전 선택 — 어느 쪽이 패배해도 ${event.pieceType==="king"?"경기 패배":"동료·포획 하수인 동시 제거"}입니다.</p>`,
        [["본체 출전",()=>pick("body")],
         res?[`예비 하수인(${ELEM_KO[res.element]}) HP ${res.hp}/${res.maxHp} 대리 출전`,()=>pick("cap")]
            :[`포획 하수인(${ELEM_KO[cap.element]}) HP ${cap.hp}/${cap.maxHp} 출전`,()=>pick("cap")]]);
      continue;
    }
    if(event.type==="battleEntryReveal"){
      modal(`<h2>출전 공개</h2><p>${event.desc}</p>`,[["전투 시작",()=>{ closeModal(); dispatchCoreAction({t:"battleEntryGo"}); }]]);
      continue;
    }
    if(event.type==="resignPrompt"){ // 확인 창은 표시 계층 소유. 확정은 종전처럼 사람 입력 경로로 되돌아간다
      const game=S, turn=event.turn;
      netLocalModal(); // 확인 모달은 로컬 전용 — 확정만 동기화
      modal(`<h2>🏳️ 기권</h2><p>정말 기권하시겠습니까?</p>`,
        [["기권 확정",()=>{ if(S!==game||S.turnCount!==turn) return; closeModal(); netAction({t:"resign"}); }], // 늦은 확인이 다음 턴을 기권시키지 않는다
         ["취소",closeModal]]);
      continue;
    }
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
    if(event.type==="setupHandoff"){ if(S.eco) UI.prep="roster"; handoff(pname(event.player)+" 배치",render); continue; } // #236: 다음 사람은 시작 상점부터
    if(event.type==="recruitOpened"||event.type==="recruitStage"){ recruitModal(); if(event.type==="recruitOpened") render(); continue; } // 단계 전이는 Core 가 끝냈고 여기는 그 단계의 화면만 (AI 해결·튜토리얼은 Core 소유)
    if(event.type==="recruitClosed"){ closeModal(); continue; }        // 늦은 콜백·새 게임·턴 교대·말 사망 — 화면만 닫는다
    if(event.type==="matchEnded"){ // 상태·결과 배너·기권 문구는 Core 가 끝냈고 여기는 남은 화면 정리뿐
      if(event.interrupted){
        /* Saturn 추가 P2: **살아 있던 전투를 걷어냈을 때만** 열린 전투 모달을 닫고 낡은 마크업·연출 큐를 비운다.
           상태만 지우고 화면을 두면 buff-power 같은 CSS 애니메이션이 무한히 돌고 낡은 모달이 입력 면으로 남는다 (계약 3.1 은 표시까지 포함).
           정상 승패·판정·도망·적 포획은 이 지점 전에 이미 전투를 비웠고 battleEndFx 가 결과 연출 뒤 닫으므로 건드리지 않는다. */
        try{ closeModal(); }catch(e){}
        try{ const ob=$("overlayBox"); if(ob) ob.innerHTML=""; }catch(e){}
        try{ fxReleaseAll(); }catch(e){} // 남은 연출 큐·잠금도 함께 해제 (무한 애니메이션·입력 잠금 잔존 방지)
      }
      continue;
    }
    /* #245 전투 커맨드 — 합법성·자원 회계·난수는 Core 가 끝냈고 여기는 **화면만** 그린다. */
    if(event.type==="pkgOpenModal"){ pkgOpenModal(event.kind,event.owner,event.round,event.id); continue; }      // #121 개봉 선택 화면 (재고는 확정에서만 움직인다)
  }
}
function clearToasts(){try{const box=$("toasts"); if(box) box.innerHTML="";}catch(e){}}
/* HTML 속성값 이스케이프 — innerHTML 템플릿에 "밖에서 온 값"을 넣을 때만 쓴다.
   저장소(localStorage)나 사용자 입력에서 온 값은 저장 시점에 정규화했더라도 신뢰하지 않는다:
   따옴표 하나면 value="…" 를 닫고 onerror= 같은 속성을 덧붙일 수 있어, 저장값이 곧 스크립트 주입이 된다.
   & 를 먼저 바꿔야 이미 이스케이프된 실체를 두 번 감싸지 않는다. */
function escAttr(v){
  return String(v===undefined||v===null?"":v)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/`/g,"&#96;");
}

const $=id=>/** @type {any} */(document.getElementById(id)); // #245: DOM 접근은 동적 — 이 검사의 대상은 상태·액션·이벤트·프로토콜 계약이지 DOM 타입이 아니다

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
  return S.phase==="menu"?"lobby":S.phase==="setup"?"prep":(S.phase==="play"||S.phase==="shop"||S.phase==="bagPick")?"board":"result"; // #236 상점·B08 은 보드 위 팝업
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
   아니면 아무것도 하지 않는다: 특히 **closeModal() 도 부르지 않아** 지금 떠 있는 남의 창을 닫아 버리지 않는다. */
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
      [["로비로 돌아가기",()=>{ if(!uiAskMine(tok,game)) return; UI.ask=null; closeModal(); toLobby(); }],
       ["계속 준비하기",()=>{ if(!uiAskMine(tok,game)) return; UI.ask=null; closeModal(); }]]);
    UI.ask=tok; // modal() 이 토큰을 비우므로 연 뒤에 세운다
    return;
  }
  /* 실제 대전 중 (board) */
  if(S&&S.mode==="sim"){ // AI vs AI 관전 — 기권할 주체가 없다. 확인 뒤 관전만 끝낸다 (승패·규칙 무변경)
    if(fxLocked()){ showToast("연출이 끝난 뒤에 눌러 주세요."); return; }
    const game=S, tok={};
    modal(`<h2>← 관전 종료</h2><p>AI vs AI 관전을 끝내고 로비로 돌아갈까요?</p>`
      +`<small>이 경기의 진행은 저장되지 않습니다. [계속 관전]을 누르면 그대로 이어집니다.</small>`,
      [["로비로 돌아가기",()=>{ if(!uiAskMine(tok,game)) return; UI.ask=null; closeModal(); toLobby(); }],
       ["계속 관전",()=>{ if(!uiAskMine(tok,game)) return; UI.ask=null; closeModal(); aiHoldRelease(); }]]);
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
/* ===== #245 표시 자원(아트 이미지·프리로드·캔버스 글리프 측정) — 표시 계층 소유 =====
   분리 전 data.js 에 있던 것을 그대로 옮겼다. 요청 집합·타이밍·폴백 문구·복구 예산은 글자 단위로 같고,
   data.js 에는 document·setTimeout·canvas 가 한 곳도 남지 않는다 — 데이터 파일은 표·정의만 갖는다.
   판정(어느 파일을 다시 볼지·영구 결손인지)은 data.js 의 ART·artFilesOf·artScheduleRecovery 가 그대로 갖는다. */
/* 한 번만 예약되는 재그리기 — artFail·artLeaderReady·#201 복구 성공이 이 한 자리를 함께 쓴다.
   전투 모달을 다시 부르지 않으므로 메시지 재생·FX·전투 타이밍에 재진입하지 않는다 */
function artRerender(){
  if(ART.rerender) return;
  ART.rerender=setTimeout(()=>{ART.rerender=null; try{if(S&&S.phase!=="menu") render();}catch(e){}},0);
}
/* 그 종에 더 할 일이 남았는가 — 모든 파일이 loaded 이거나 gone 이면 굳는다 */
function artMarkSettled(dir){
  const done=artFilesOf(dir).every(f=>ART.loaded.has(dir+"/"+f)||ART.gone.has(dir+"/"+f));
  if(done) ART.settled.add(dir); else ART.settled.delete(dir);
}
/* force = 방금 실제로 실패한 파일. 그 파일은 이미 로드된 적이 있어도 다시 확인한다.
   나머지 파일은 "아직 확인되지 않은 것"만 부른다 — 멀쩡한 파일을 덤으로 다시 요청하지 않는다.
   예외 하나: 그 종이 폴백으로 내려가 있으면(ART.failed) 아이콘은 다시 확인한다. 보드 얼굴을 되돌릴 유일한 근거이기 때문이다. */
function artScheduleRecovery(dir,force){
  if(!dir) return;
  if(!ART_DIR_SET.has(dir)&&!LEADER_DIR_SET.has(dir)) return;   // 허용 목록 밖 값으로는 경로를 만들지 않는다
  for(const f of artFilesOf(dir)){
    if(f!==force&&ART.loaded.has(dir+"/"+f)&&!(f===artIconFile(dir)&&ART.failed.has(dir))) continue;
    artScheduleFile(dir,f);
  }
}
function artScheduleFile(dir,f){
  const k=dir+"/"+f;
  if(ART.gone.has(k)) return;                                   // 영구 결손 — 다시 조회하지 않는다
  let st=ART.retry.get(k); if(!st){st={n:0,total:0,timer:null,busy:false,dl:null}; ART.retry.set(k,st);}
  if(st.timer||st.busy) return;                                 // 예약됐거나 조회 중 — 파일당 한 벌 (능동 마감이 busy 를 반드시 푼다)
  if(st.n>=ART_RETRY.max||st.total>=ART_RETRY.hardMax){ ART.gone.add(k); artMarkSettled(dir); return; }
  const wait=ART_RETRY.delays[Math.min(st.n,ART_RETRY.delays.length-1)];
  st.n++; st.total++;
  st.timer=setTimeout(()=>{ st.timer=null; artProbeFile(dir,f,st); },wait);
}
/* 판정은 전부 **이번 조회의 결과**로만 한다 — 지난 프리로드가 남긴 ART.loaded 를 "지금 성공"으로 오해하면
   실패한 자산을 복구했다고 착각하거나(ART.failed 오삭제), 반대로 폴백을 못 걷어내고 굳는다.
   끝날 때는 반드시 마감 타이머를 끄고 핸들러를 떼어, 뒤늦게 도착한 이벤트가 상태를 다시 건드리지 못하게 한다. */
function artProbeFile(dir,f,st){
  const k=dir+"/"+f;
  let im=null, fin=false;
  const finish=loaded=>{
    if(fin) return; fin=true;
    st.busy=false;
    if(st.dl){ try{clearTimeout(st.dl);}catch(e){} st.dl=null; }
    if(im) try{ im.onload=null; im.onerror=null; }catch(e){}    // 늦게 오는 이벤트를 안전하게 끊는다
    if(loaded){
      const isNew=!ART.loaded.has(k);
      ART.loaded.add(k); st.n=0;                                 // 있다는 것이 확인됐으니 연속 실패 기록을 지운다
      const wasFailed=ART.failed.has(dir);
      if(f===artIconFile(dir)&&wasFailed) ART.failed.delete(dir); // 아이콘이 살아났다 → 그 종을 다시 그림으로 돌린다
      if(isNew||(f===artIconFile(dir)&&wasFailed)) artRerender(); // 얻은 게 있을 때만 다시 그린다 (재그리기 고리 없음)
      artMarkSettled(dir);
      return;
    }
    if(st.n>=ART_RETRY.max||st.total>=ART_RETRY.hardMax){ ART.gone.add(k); artMarkSettled(dir); return; } // 유한 종료
    artScheduleFile(dir,f);
  };
  st.busy=true;
  st.dl=setTimeout(()=>{ st.dl=null; finish(false); },ART_RETRY.deadlineMs); // 능동 마감 — 아무 이벤트도 오지 않아도 끝난다
  try{
    im=document.createElement("img");
    im.onload=()=>finish(true);
    im.onerror=()=>finish(false);
    im.src=artUrl(dir,f);
  }catch(e){ finish(false); }
}
/* 로드 실패: 그 종만 텍스트·기호 폴백으로 되돌리고 한 번만 다시 그린다. onerror 를 즉시 끊어 재요청 고리를 만들지 않는다.
   #201: 화면은 종전과 똑같이 즉시 안전 폴백으로 가고, 그와 **별도로** 유한 복구 조회를 예약한다 */
window.artFail=function(dir,el){
  if(el) try{el.onerror=null;}catch(e){}
  if(!dir) return;
  const first=!ART.failed.has(dir);
  ART.failed.add(dir);
  /* 이미 실패로 기록된 종이어도 복구 예약은 매번 시도한다 — 겹침은 예약·진행 중 검사가 걸러낸다.
     여기서 일찍 빠져나가면 "조회가 끝난 뒤 다시 실패한" 종이 다시 예약될 기회를 영영 잃는다.
     실패한 것은 보드 아이콘이므로 그 파일을 지목해 확인한다. */
  artScheduleRecovery(dir,artIconFile(dir));
  if(first) artRerender();   // 재그리기는 종전대로 상태가 바뀔 때 한 번만
};
/* 전투 도트 실패: 지금 보고 있는 전투에서도 즉시 현행 이모지 토큰으로 바꿔 끼운다 — 전투원 자리가 비어 보이지 않는다.
   battleModal() 을 다시 부르지 않으므로 메시지 재생·FX 에 재진입하지 않고, 토큰의 id·위치 클래스는 그대로라 shake·ko·dmgfloat 경로가 유지된다 */
window.artSpriteFail=function(dir,el){
  if(el) try{el.onerror=null;}catch(e){}
  /* #201: 지금 이 전투의 토큰은 아래에서 즉시 이모지로 바뀌고(연출 타이밍 불변), 복구는 다음 렌더부터 반영된다.
     전투 파일만 영영 없는 종이면 아이콘 조회가 성공해 보드 얼굴은 곧 아트로 돌아오고, 전투 파일은 gone 으로 굳어
     다음 전투창이 그 파일을 다시 요청하지 않는다 — 실패→종 폴백→재요청의 왕복이 생기지 않는다. */
  if(dir){ ART.failed.add(dir); artScheduleRecovery(dir,artBattleFile(dir)); }
  const tok=el&&el.parentNode;
  try{
    const B=S&&S.battle;
    if(tok&&tok.classList&&B&&(tok.id==="tok-A"||tok.id==="tok-D")){
      const sid=tok.id==="tok-A"?"A":"D", pf=sid==="A"?B.fa:B.fd, piece=sid==="A"?B.attP:B.defP;
      tok.classList.remove("art");
      const lb=pf===piece&&(piece.type==="king"||piece.type==="ally"); // #234: 왕·동료 본체는 속성을 가져도 현행 이모지 토큰 유지(표시 개편은 #238) — 속성은 패널 배지로 보인다
      tok.style.background=pf.element&&!lb?`var(--${pf.element})`:"#5a6377";
      const emo=lb?(piece.type==="king"?"👑":"🤝"):pf.element?ELEM_EMO[pf.element]:(piece.type==="king"?"👑":piece.type==="ally"?"🤝":"❔");
      tok.innerHTML=`${emo}<small>${pf.element&&!lb?ELEM_KO[pf.element]:TYPE_KO[piece.type]}</small>`;
      return;
    }
  }catch(e){}
  try{el.style.display="none";}catch(e){}
};
/* 설명창 일러스트: webp(배포본) → png(원본) → 숨김. 각 단계에서 onerror 를 끊으므로 고리가 생기지 않는다 */
window.artPortraitFail=function(el,dir){
  if(!el) return;
  try{el.onerror=null;}catch(e){}
  const stage=(el._artStage||1)+1; el._artStage=stage;
  if(stage===2&&ART_DIR_SET.has(dir)){ el.onerror=function(){artPortraitFail(el,dir);}; el.src=artUrl(dir,"portrait.png"); return; }
  // 둘 다 실패: 자리를 유지한 채 대체 표시로 바꾼다 — 이미지를 지워 모달 레이아웃이 튀지 않게 한다
  try{
    const box=el.parentNode;
    if(box&&box.classList&&box.classList.contains("rosterArt")){ box.classList.add("fb"); box.innerHTML=`<span>이미지를 불러오지 못했습니다</span>`; return; }
  }catch(e){}
  try{el.style.display="none";}catch(e){}
};
/* 프리로드는 페이지 로드 시 20종 일괄이다 — 개별 말이 개별 파일을 요청하지 않으므로 요청 목록이 정체와 상관관계를 만들지 않는다.
   설명창 원본(portrait 20종 약 3.1MB)은 여기서 받지 않고 설명창을 열 때만 받는다 */
function artPreload(){
  if(ART.preloaded) return; ART.preloaded=true;
  for(const dir of ART_DIRS) for(const f of ["icon.png","battle.png"]){
    try{
      const im=document.createElement("img");
      im.onload=()=>{ART.loaded.add(dir+"/"+f);};
      im.onerror=()=>{if(f==="icon.png") ART.failed.add(dir); artScheduleRecovery(dir,f);}; // #201 유한 복구 — 떨어진 그 파일만
      im.src=artUrl(dir,f);
    }catch(e){}
  }
  /* #124: 왕·동료 2종도 같은 시점에 같은 고정 집합으로 요청한다 (정체와 무관 — 요청 목록이 상관관계를 만들지 않는다).
     아직 납품 전이면 여기서 실패해 ART.failed 에 들어가고 화면은 현행 이모지 그대로다. */
  for(const dir of LEADER_DIRS) for(const f of [LEADER_FILES.icon,LEADER_FILES.battle]){
    try{
      const im=document.createElement("img");
      im.onload=()=>{ART.loaded.add(dir+"/"+f); artLeaderReady();};
      /* #201: 왕·동료는 ART.loaded 확인 경로가 프리로드뿐이라, 여기서 한 번 놓치면 종전에는 영원히 이모지였다 */
      im.onerror=()=>{if(f===LEADER_FILES.icon) ART.failed.add(dir); artScheduleRecovery(dir,f);};
      im.src=artUrl(dir,f);
    }catch(e){}
  }
}
function artLeaderReady(){ artRerender(); } // 자산이 늦게 도착했을 때 한 번만 다시 그린다 (artFail 과 같은 1회 예약 자리를 공유한다)
/* 플랫폼 글리프 지원 확인 — 일부 환경에는 최신 이모지 글리프가 어떤 설치 폰트에도 없어 빈 네모(두부)로 그려진다.
   실측(Windows 10 19045 · Chrome): 🪤(U+1FAA4)는 sans-serif · "Segoe UI Emoji" · Apple/Noto 를 모두 얹은 스택에서 폭이 두부와 같다 —
   즉 CSS 폰트 스택으로는 해결되지 않는 폰트 커버리지 문제다. 기호 계약은 그대로 두고, 그릴 수 없는 기호만 현행 텍스트 라벨로 되돌린다.
   측정이 불가능한 환경(canvas 없음)에서는 "지원함"으로 본다 — 기본 계약은 이모지다. */
const GLYPH={cache:{},font:'16px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif',NOTDEF:"\u{10FFFD}"};
function glyphOk(ch){
  if(!ch) return false;
  if(ch in GLYPH.cache) return GLYPH.cache[ch];
  let ok=true;
  try{
    const cv=document.createElement("canvas"), c=cv.getContext&&cv.getContext("2d");
    if(c&&c.measureText&&c.getImageData){
      cv.width=28; cv.height=28; // 캔버스 크기를 먼저 정하고(상태 초기화) 폰트를 건다
      c.font=GLYPH.font;
      const w=c.measureText(ch).width, tw=c.measureText(GLYPH.NOTDEF).width;
      /* 폭이 같다는 사실만으로 "글리프 없음"이라고 단정하지 않는다 — 정상 글리프도 같은 advance 를 가질 수 있다.
         폭 일치는 값싼 1차 거름이고, 확증은 실제로 그려 본 픽셀이 "그리지 못한 그림"과 완전히 같은지로 한다. */
      if(w>0&&tw>0&&Math.abs(w-tw)<0.01){
        const px=s=>{ c.clearRect(0,0,cv.width,cv.height); c.fillStyle="#fff"; c.textBaseline="top"; c.font=GLYPH.font;
                      c.fillText(s,2,2); return c.getImageData(0,0,cv.width,cv.height).data; };
        const a=px(ch), b=px(GLYPH.NOTDEF);
        let same=a.length===b.length;
        for(let i=0;same&&i<a.length;i++) if(a[i]!==b[i]) same=false;
        ok=!same;
      }
    }
  }catch(e){ ok=true; } // 측정 불가 환경에서는 기본 계약(이모지)을 유지한다
  GLYPH.cache[ch]=ok; return ok;
}
/* #245 전투 화면의 DOM 토글 — 표시 계층 소유. core.js 의 전투 모달은 이 이름만 부르고 DOM 을 직접 만지지 않는다.
   마크업·클래스·aria 계약은 분리 전과 글자 단위로 같다 (옮기기만 했다). */
function uiBattleBox(){ try{ const ob=$("overlayBox"); if(ob&&ob.classList) ob.classList.add("battleBox"); }catch(e){} }
function uiSkillInfoExpanded(i){ // ⓘ 버튼의 aria-expanded — i 가 null 이면 전부 닫힘 표시
  try{ const ob=$("overlayBox"); const btn=ob&&ob.querySelectorAll?ob.querySelectorAll(".skillInfoBtn"):[];
    Array.prototype.forEach.call(btn,b=>{ if(i===null) b.setAttribute("aria-expanded","false");
      else if(b.getAttribute("onclick")===`window.__skillInfo(${i})`) b.setAttribute("aria-expanded","true"); }); }catch(e){}
}
function uiSkillInfoToggle(i,t){ // 같은 ⓘ 를 다시 누르거나 [닫기]로 닫는다
  const box=$("skillInfoBox"); if(!box||!t) return;
  const open=!box.classList.contains("hidden")&&box.getAttribute&&box.getAttribute("data-idx")===String(i);
  uiSkillInfoExpanded(null);
  if(open){ box.classList.add("hidden"); box.innerHTML=""; if(box.setAttribute) box.setAttribute("data-idx",""); return; }
  box.innerHTML=`<b>${escAttr(t.label)}</b><div>${escAttr(t.tip)}</div><button type="button" class="skillInfoClose" onclick="window.__skillInfo(${i})">닫기</button>`;
  if(box.setAttribute) box.setAttribute("data-idx",String(i)); box.classList.remove("hidden");
  uiSkillInfoExpanded(i);
}
function uiBattleMenu(menu){ // 행동창 아래 '← 뒤로'는 하위 메뉴가 열렸을 때만
  try{ const bb=$("bmenuBack"); if(bb&&bb.classList){ if(menu) bb.classList.remove("hidden"); else bb.classList.add("hidden"); } }catch(e){}
  try{ const root=$("bmenu"); if(root){ if(menu) root.classList.add("hidden"); else root.classList.remove("hidden"); }
    for(const k of ["fight","bag","ball","flee"]){ const el=$("bsub-"+k); if(el){ if(k===menu) el.classList.remove("hidden"); else el.classList.add("hidden"); } } }catch(e){}
}
/* ===== #245 표시 계층이 소유하는 DOM·타이머 =====
   여기 아래 블록은 분리 전 core.js 에 있던 것을 그대로 옮긴 것이다. 규칙 판정은 한 줄도 없고,
   반대로 core.js 에는 document·setTimeout·querySelector 가 한 곳도 남지 않는다 —
   Core 는 규칙과 표시 **이벤트**만 내고, 화면과 시간은 이 파일이 맡는다. */
function autoEndReady(){
  if(!BAL.fx.autoEnd||!humanActorNow()||fxLocked()) return null;
  if(TUT.open||S.teleport||(S.forcedTargets&&S.forcedTargets.length)||(S.forcedQueue&&S.forcedQueue.length)) return null;
  if(NET.publicMode&&NET.autoEndBlockRev!=null&&NET.autoEndBlockRev===NET.revision) return null; // #217 서버가 같은 상태에서 자동 입력을 거부했다 — 상태가 바뀔 때까지 다시 보내지 않는다
  try{ if(!$("overlay").classList.contains("hidden")) return null; }catch(e){ return null; }
  if(!S.mainUsed) return anyMainActionLeft()?null:"skip";
  return optionalBattleLeft()?null:"end";
}
function autoEndCheck(){
  const what=autoEndReady(); if(!what){ FX.auto=null; return; }
  if(FX.auto&&FX.auto.turn===S.turnCount&&FX.auto.gen===FX.gen&&FX.auto.what===what) return; // 이미 예약됨
  const tk={gen:FX.gen,turn:S.turnCount,what,input:FX.inputSeq,game:S}; FX.auto=tk;
  setTimeout(()=>{
    if(FX.auto!==tk||FX.gen!==tk.gen||S!==tk.game||S.turnCount!==tk.turn) return; // 오래된 예약
    FX.auto=null;
    if(FX.inputSeq!==tk.input){ autoEndCheck(); return; } // 그 사이 입력이 있었으면 재평가
    if(autoEndReady()!==what) { autoEndCheck(); return; }
    if(what==="skip"){ showToast("가능한 주 행동이 없습니다 — 주 행동을 생략합니다."); NET.autoSending=true; try{ netAction({t:"skipMain"}); } finally{ NET.autoSending=false; } return; }
    showToast("할 수 있는 행동이 없어 턴을 종료합니다.");
    netAction({t:"endTurn",auto:true}); // auto 표식은 액션 프레임에 실려 양 클라이언트가 같은 지표(autoEnds)를 기록한다
  }, fxLive()?(BAL.fx.autoEndGrace||0):0);
}
let MSGQ=[], MSGPLAYING=false, MSGAFTER=null;
function liveBattleDom(){ // 실제 DOM에 msgBox가 있을 때만 재생 (sim·헤드리스 스텁 제외)
  try{const mb=$("msgBox"); return S.mode!=="sim"&&!!mb&&mb.nodeType===1;}catch(e){return false;}
}
function playMsgs(q,after){ // 그룹 단위 순차 재생 (계약 5.4) — 재생 불가 환경은 즉시 완료. 재생 중은 fxLocked() (입력 잠금·수신 보류)
  MSGQ.push(...q); MSGAFTER=after||null;
  if(MSGPLAYING) return;
  if(!liveBattleDom()){ MSGQ.length=0; const fn=MSGAFTER; MSGAFTER=null; if(fn)fn(); return; }
  MSGPLAYING=true; fxSetLockClass(true);
  const gen=FX.gen;
  (function step(){
    if(FX.gen!==gen) return; // 새 게임 — 옛 세대의 step 은 아무것도 만지지 않는다: MSGQ·MSGPLAYING·MSGAFTER 는 fxReleaseAll 이 이미 비웠고 그 뒤 새 게임의 재생이 소유한다 (REVISE msg_d847280b3dba)
    const m=MSGQ.shift();
    if(!m){ MSGPLAYING=false; if(!FX.cur&&!FX.q.length) fxSetLockClass(false); const fn=MSGAFTER; MSGAFTER=null; if(fn)fn(); fxIdle(); return; }
    const lines=[m.txt]; applyFx(m.fx);
    while(MSGQ.length&&!MSGQ[0].key){ const n=MSGQ.shift(); lines.push(n.txt); applyFx(n.fx); } // 같은 그룹의 후속 줄 즉시 병합
    try{ const mb=$("msgBox"); if(mb){ mb.innerHTML=lines.join("<br>"); if(mb.classList){ if(m.big) mb.classList.add("big"); else mb.classList.remove("big"); } } }catch(e){}
    const ms=m.key?fxMs(m.key):(fxLive()?BAL.fx.msgStep:0);
    setTimeout(step,ms>0?ms:600);
  })();
}
/* #106 5.5 HP 바 지연 표시 토큰 (side 별 일련번호) — 표시 계층 전용, 규칙 상태(S)·난수와 무관.
   한 피해 이벤트가 방어막과 HP 를 모두 줄이면 방어막 바만 즉시 줄이고(CSS 전환 .35s) HP 바·숫자는 BAL.fx.barStep 뒤에 쓴다 → 화면에서 방어막 흡수가 먼저 보이고 HP 가 그 다음 줄어든다.
   두 전환(0.35s + 0.35s = 700ms)은 damageFx(#125 1200ms) 안에서 여유 500ms 를 남기고 끝난다. 표시값 dispHp 는 종전처럼 즉시 갱신하므로 재렌더는 항상 최신 값을 그린다.
   지연 콜백은 게임 세대(FX.gen)·같은 전투 객체·같은 HP 바 DOM 노드·같은 side 일련번호가 모두 일치할 때만 쓴다 — 옛 게임·닫힌 전투·다시 그려진 모달·뒤따른 HP 갱신을 덮어쓰지 않는다.
   헤드리스·sim(fxLive() false)은 barStep 0 → 종전처럼 동기 즉시 쓰기 (REVISE msg_d847280b3dba 2번: setter 순서가 아니라 실제 시간 단계로 분리) */
const HPSTAGE={A:0,D:0};
function applyFx(fx){ // CSS 이펙트(흔들림·속성 플래시·피해 팝·HP바·방어막 바·상태 아이콘) — 실패는 조용히 무시
  if(!fx) return;
  try{
    const B=S?S.battle:null;
    let stage=0; // 5.5: 같은 side 의 방어막·HP 가 이번 이벤트로 함께 줄 때만 HP 표시를 barStep 만큼 늦춘다 (회복·방어막만 감소·HP 만 감소는 즉시)
    if(fx.st&&fx.st.max&&fx.hp&&fx.hp.side===fx.st.side&&B){
      const side=fx.st.side, prevSh=B["dispSh"+side]!==undefined?B["dispSh"+side]:0, prevHp=B["dispHp"+side];
      if(prevSh>(fx.st.shield||0)&&prevHp!==undefined&&prevHp>fx.hp.val) stage=fxMs("barStep"); }
    if(fx.st){ const s=$("bst-"+fx.st.side); if(s) s.textContent=fx.st.text;
      if(fx.st.max){ if(B) B["dispSh"+fx.st.side]=fx.st.shield||0; // #106 5.5 방어막 바 — 항상 즉시 (흡수가 먼저 줄고 HP 는 barStep 뒤)
        const sb=$("shfill-"+fx.st.side); if(sb) sb.style.width=Math.max(0,Math.min(100,(fx.st.shield||0)/fx.st.max*100))+"%"; } }
    if(fx.hp){ const side=fx.hp.side; if(B) B["dispHp"+side]=fx.hp.val;
      const seq=++HPSTAGE[side], bar=$("hpfill-"+side), t=$("hptxt-"+side); // 새 HP 갱신은 같은 side 의 대기 중인 지연 쓰기를 무효화한다 (최신 값이 이긴다)
      const write=()=>{ if(bar) bar.style.width=Math.max(0,fx.hp.val/fx.hp.max*100)+"%"; if(t) t.textContent=fx.hp.val; };
      if(stage>0){ const gen=FX.gen;
        setTimeout(()=>{ if(FX.gen!==gen||!S||S.battle!==B||HPSTAGE[side]!==seq) return; // 옛 게임·끝난 전투·뒤따른 갱신 → 무효
          if($("hpfill-"+side)!==bar) return; // 모달이 다시 그려져 노드가 바뀌었다 — 재렌더가 dispHp 로 이미 최신 값을 그렸다
          try{ write(); }catch(e){} },stage); }
      else write(); }
    if(fx.shake){ const t=$("tok-"+fx.shake); if(t){t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake");} }
    if(fx.flash){ const st=$("bstage"); if(st){st.style.boxShadow=`inset 0 0 70px var(--${fx.flash})`;
      setTimeout(()=>{try{st.style.boxShadow="";}catch(e){}},380);} }
    if(fx.sig){ const st=$("bstage"); if(st&&st.classList){st.classList.remove("sigblink"); void st.offsetWidth; st.classList.add("sigblink");
      setTimeout(()=>{try{st.classList.remove("sigblink");}catch(e){}},750);} } // 시그니처 전용 강조 (테두리 점멸)
    if(fx.float){ const t=$("tok-"+fx.float.side); if(t&&t.appendChild){const d=document.createElement("div");
      d.className="dmgfloat"; d.innerHTML=fx.float.html; t.appendChild(d);
      setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d);},1100);} }
    if(fx.ko){ const t=$("tok-"+fx.ko); if(t) t.classList.add("ko"); }
  }catch(e){}
}
function fxTurnLabel(p,battle){ // "나의 턴!/상대 턴!" (PVE·온라인) · 핫시트 전투 라운드는 "P1 턴!/P2 턴!", 보드는 기기를 받은 현재 플레이어 시점 = "나의 턴!"
  if(S.mode==="pvp"&&!NET.mode) return battle?`P${p+1} 턴!`:"나의 턴!";
  return viewerIsOwner(p)?"나의 턴!":"상대 턴!";
}
/* 4.1 턴 시작 배너 (+ 4.1 버닝 타임 배너 1회) — startTurn 직후, 핫시트는 handoff 확인 뒤 호출된다 */
function turnBannerFx(){
  if(S.phase!=="play"||S.mode==="sim") return;
  if(S.btBannerDue){ dispatchCoreAction({t:"btBannerShown"}); fxPlay({key:"turnBanner",kind:"bt",title:"버닝타임입니다! 2칸씩 이동 가능합니다",sub:"직선 2칸 이동 강화 (폭탄 포함 · 함정 제외 · 적진·적 숲은 1칸)"}); }
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
    : S.phase==="play" ? `— ${pname(S.current)} 턴 ${S.turnCount+1}${isBurning()?" 🔥BT":""}` : S.phase==="over"?"— 종료"
    : S.phase==="shop" ? `— 🛒 ${S.eco.shop.turn}턴 상점` : S.phase==="bagPick" ? "— 🎒 가방 초과" : "";
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
    const cell=/** @type {any} */(document.createElement("div")); // dataset 에 논리 좌표를 **숫자 그대로** 넣는다 (하네스 회귀 G2 가 그 원문을 본다)
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
        if(p.swapMark&&!known){ chip.innerHTML+=`<span class="swapMark" title="상점에서 교체됨">↺</span>`; chip.setAttribute("title","상점에서 교체됨 (정체 비공개)"); } // #236 (7.5) 공개 칸에 들어온 비공개 말
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
  const p = NET.mode?NET.me:(S.mode==="pvp"?humanViewer():0); // 온라인: 사이드 패널은 항상 내 정보 · #236 핫시트 상점·B08 은 그 화면 주인
  let h=`<h2>${pname(p)}</h2>
  <div class="row"><span class="badge">몬스터볼 ${S.balls[p]}</span>
  <span class="badge">아이템 ${S.inv[p].length}</span>${S.pkgs?`<span class="badge">🎁 ${S.pkgs[p].itemGift}</span><span class="badge">✨ ${S.pkgs[p].battleBuff}</span>`:""}
  <span class="badge">전투 ${S.battlesUsed}/2</span>
  ${S.reserve[p]?`<span class="badge">예비 하수인(${ELEM_KO[S.reserve[p].element]}) HP ${S.reserve[p].hp}/${S.reserve[p].maxHp}</span>`:""}
  <span class="badge">${S.mainUsed?"주 행동 완료":"주 행동 가능"}</span></div>
  <div class="row">${S.inv[p].map(i=>`<span class="badge">${ITEMS[i].ko}</span>`).join("")||"<small>아이템 없음</small>"}</div>`;
  if(S.eco) h+=`<div class="row"><span class="badge">🪙 ${S.eco.coins[p]}</span><span class="badge">🎟 ${S.eco.tickets[p]}</span>${BUFF_KEYS.map(k=>S.eco.buffInv[p][k]?`<span class="badge">${BUFFS[k].ko} ${S.eco.buffInv[p][k]}</span>`:"").join("")}</div>
    <div class="row">${[0,1,2].map(i=>{ const u=S.eco.bag[p][i]; return `<span class="badge">🎒 ${u?`${u.name} ${ecoStars(u.grade)} HP ${u.hp}/${u.maxHp}`:"빈칸"}</span>`; }).join("")}</div>`; // #236 소유자 전용 (7.9) // #121 계약 2.1: 보유 상한 없음 — 분모를 쓰지 않는다
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
  const nextShop=S.eco?ECO.shopTurns.find(t=>t>S.turnCount):undefined; // #236 (8.2) 닫힌 상점: 다음 오픈까지 남은 턴
  el.innerHTML=`<span class="who">${who} · ${S.turnCount+1}턴${isBurning()?" 🔥BT":""}${S.eco?` · 🪙${S.eco.coins[p]} · 🛒${nextShop!==undefined?` ${nextShop-S.turnCount}턴 뒤`:" 끝"}`:""}</span>`
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
    <button type="button" data-prep-step="roster" aria-pressed="${UI.prep==="roster"}" onclick="uiPrep('roster')">01 ${S.eco?"시작 상점":"로스터 선택"} ${sel.length}/6</button>
    <button type="button" data-prep-step="place" aria-pressed="${UI.prep==="place"}" onclick="uiPrep('place')">02 비공개 배치 ${14-unplaced.length}/14</button></div>
  <section class="prepStep" data-step="roster">`;
  if(S.eco){ // #236 S01 — 무료 로스터 선택 대신 🪙10 으로 ⭐1 6명을 산다 (8.1 ⑪)
    h+=S.eco.shop.done[p]?`<h2>🛒 시작 상점 완료</h2><small>02 비공개 배치로 넘어가세요.</small>`:shopHtml(p);
  } else {
  h+=`<h2>${NET.preparing?"🌐 온라인 대전 — 내":pname(p)} 로스터 선택 (${sel.length}/6)</h2>
  <small>30종 중 6종을 중복 없이 선택 (카드 클릭 → 정보 팝업에서 선택). 속성은 종에 고정 · 경기 시작은 모두 ⭐1(1차 기본기).</small>`;
  for(const el of V2_ELEM_ORDER){ // #234 (GDD-23 6.3): 5속성 × 6아키타입
    h+=`<div class="row">`;
    for(const rd of ROSTER.filter(r=>r.element===el))
      h+=`<div class="rosterCard ${sel.includes(rd.id)?"on":""}" onclick="rosterInfo('${rd.id}')">
        <b class="el-${rd.element}">${rd.name}</b>
        <small>${ELEM_KO[rd.element]}·${ARCH_KO[rd.arch]} · HP${rd.hp} 공${rd.atk} · ${speciesSkills(rd.id,4).map(s=>SKILLS[s].ko).join("·")}</small></div>`;
    h+=`</div>`;
  }
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
  if(S.eco&&!S.eco.shop.done[p]) shopClockStart(p); // #236 S01 90초는 상점이 실제로 그려진 뒤 시작 (가림 중이면 shopClockStart 가 거절)
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
/* #245 Saturn REVISE(M1): 종전 data.js 에 있던 window.setSeed 미러를 여기로 옮겼다 — window 를 아는 파일은 표시 계층뿐이다.
   노출 대상·의미는 그대로다 (CDP·콘솔에서 시드를 고정하는 진단 훅이고, 규칙은 언제나 rand() 를 경유한다). */
window.setSeed=setSeed;

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
  try{ closeModal(); }catch(e){}
  try{ const ob=$("overlayBox"); if(ob) ob.innerHTML=""; }catch(e){}
  try{ clearToasts(); }catch(e){}
  UI.drawer=null; UI.prep="roster";
  shopClockStop(); bagClockStop(); // #236 이전 경기의 상점·B08 타이머 잔존 0
  UI.ask=null; UI.hold=false; UI.holdQ=[]; // #122 REVISE: 확인창 소유권·AI 보류 큐도 함께 정리 (이전 경기 잔존 0)
}
window.toLobby=()=>{
  const wasPublic=NET.publicMode; // #217 공개 방 경기에서 돌아오면 공개 방 목록을 바로 새로 불러온다
  uiResetScreen(); netLeave();
  newGame("pvp",{phase:"menu"}); UI.entered=true;
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
  newGame(mode,{aiLevel:lv,eco:!NET.mode}); // #236: 새 경제는 로컬 모드(PVE·핫시트·sim)만 — 온라인(릴레이 재생성 포함)은 #237 전환 전까지 종전 경제
  if(mode==="pvp"||mode==="pve"){
    addLog(mode==="pve"?`PVE(${AI_LEVEL_KO[S.aiLevel[1]]}${S.aiLevel[1]==="dan5"?" · 탐색·추론 기반 강AI":""}) — 당신의 14개 말을 배치하세요.`:"PVP — 두 플레이어가 번갈아 비공개 배치합니다.","sys");
    if(S.eco&&mode==="pve") aiShop(1); // #236 GDD-23 2.3: 사람 S01(90초)이 열리는 순간 AI 는 즉시 완료 — 배치(aiAutoPlace)는 종전대로 사람 배치 뒤
    render();
  } else { // sim
    aiAutoPlace(0);
    aiAutoPlace(1);
    beginPlay();
  }
};
/* #106 턴 시작 공통 후처리의 표시 몫 — 규칙(경기 개시·AI 예약)은 Core 의 afterTurnStart 가 소유한다.
   기존 회귀 호환 진입점: 같은 turnReady 이벤트를 그대로 그린다 */
function afterStartTurn(){ applyUiEvent({type:"turnReady",player:S.current,handoff:offlinePvp()}); }

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
    [[on?"선택 해제":"선택하기",()=>{closeModal(); toggleRoster(rid);}],["닫기",closeModal]]);
};
function fillRosterRandom(p){ // 미선택분을 무작위 종으로 채움 (중복 없음)
  const rest=shuffle(ROSTER.filter(r=>!S.roster[p].includes(r.id)).map(r=>r.id));
  while(S.roster[p].length<6) S.roster[p].push(rest.pop());
  applyRoster(p);
}
window.autoPlaceCore=()=>dispatchCoreAction({t:"auto"});
window.clearPlaceCore=()=>dispatchCoreAction({t:"clear"});
window.setupDoneCore=()=>dispatchCoreAction({t:"setupConfirm",preparing:NET.preparing,publicMode:NET.publicMode});

/* ===== #245 Saturn REVISE(M1) 전투·모집·패키지 화면 — Core 에서 옮겨 온 그대로 =====
   Core 는 HTML 을 만들지도, window 콜백을 달지도 않는다. 아래 세 화면과 그 버튼이 부르는 Core 액션 중계는
   전부 표시 계층 소유다. 판정·자원 회계·난수는 여전히 Core 의 reducer 한 곳뿐이고 여기는 그 입력을 만들 뿐이다.
   battleModal(board): 인자를 주면 **그 전투 보드**를 그린다 — 지난 전투 스냅샷을 그릴 때 전역 S.battle 을 잠시
   갈아끼우지 않기 위한 유일한 확장이다 (network.js netRenderBattleStage). 인자가 없으면 종전대로 S.battle 이다. */
function recruitModal(){
  const st=recruitState(); if(!st){ closeModal(); return; }
  const {R,p,rd}=st, own=R.owner;
  /* 동기화 모달의 버튼은 modal() 래퍼가 {t:"modal",seq,i} 로 이미 중계한다 — 콜백에서 netAction 을 겹쳐 부르면
     로컬이 두 프레임을 보내고 원격이 같은 선택을 두 번 적용한다. 그래서 **코어를 직접** 부른다 (PD 검토 3). */
  const tk=R.token; // #245 Saturn REVISE: 이 화면이 연 recruit 의 토큰을 버튼에 고정 — 새 탐색이 열린 뒤의 늦은 클릭은 코어가 거부한다
  const btn=(label,step,i)=>[label,()=>window.__recruitCore(step,i,tk)];
  const skCard=(sid,head,extra)=>{ const sk=SKILLS[sid];
    return `<div class="fighter"><b>${head} ${skillNameKo(sid,null)}</b><small>${sk.cls?`<span class="badge">${SKILL_CLS_KO[sk.cls]} 분류</span> `:sk.el?`<span class="badge el-${sk.el}">${ELEM_KO[sk.el]}</span> `:""}${SKILL_TIER_KO[sk.tier]||SKIND_KO[sk.kind]} · 위력 ${sk.pow?sk.pow:"-"} · 쿨 ${sk.reaper?"봉인":sk.cd}<br>${sk.desc}${extra||""}</small></div>`; };
  if(R.stage==="root"){
    const recv=capReceivers(own);
    modal(`<h2>🌿 숲에서 무언가를 찾았다</h2><p>기술을 배우거나, 공용 하수인을 포획할 수 있습니다.<br><small>포기해도 이 칸은 다시 쓸 수 없습니다.</small></p>
      <div class="fighter"><b>📘 기술 교체</b><small>신규 공용 기술 3종 중 하나를 직접 골라, 내 최초 하수인 6명 중 살아 있는 말의 4슬롯 어디든 바꿉니다.</small></div>
      <div class="fighter"><b>🔴 하수인 포획</b><small>${recv.length?`동료·왕 중 포획 슬롯이 빈 말 ${recv.length}기가 받을 수 있습니다 (보유 볼 ${S.balls[own]})`:"<b>포획 슬롯이 빈 동료·왕이 없습니다 — 포획 불가</b>"}</small></div>`,
      (V2_INTERP.recruitSkillSwap?[btn("📘 기술 교체","skills",0)]:[["📘 기술 교체 (v0.4.11 과도기 — 닫힘)",null,true]]).concat(recv.length?[btn("🔴 하수인 포획","cap",0)]:[]).concat([btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="skill"){
    /* 계약 4.2-1·5: 3종을 모두 보여 주고 직접 고른다. 난수 없음. 이미 그 기술을 가진 말만 다음 단계에서 비활성이 되므로
       여기서는 "내 6명 중 아직 그 기술이 없는 말이 한 명도 없으면" 그 제안을 비활성으로 표시한다 */
    const openFor=sid=>rosterMinions(own).some(m=>m.alive&&m.placed&&m.skills&&!m.skills.includes(sid));
    modal(`<h2>📘 배울 기술 선택</h2><p>하나를 고르세요.<br><small>같은 말에 같은 기술을 두 번 장착할 수 없습니다.</small></p>
      ${NEW_SKILLS.map((sid,i)=>skCard(sid,`${i+1}.`,openFor(sid)?"":" <b>· 내 모든 하수인이 이미 보유</b>")).join("")}`,
      NEW_SKILLS.map((sid,i)=>openFor(sid)?btn(`${i+1}. ${SKILLS[sid].ko}`,"skill",i):[`${i+1}. ${SKILLS[sid].ko} (보유)`,null,true])
        .concat([btn("← 뒤로","back",0),btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="target"){
    /* 계약 4.2-2·4: 대상 말을 고르기 전 4슬롯은 ? 로 가린다. 죽은 말은 보이되 비활성 */
    const ms=rosterMinions(own);
    const row=(m,i)=>{ const dead=!m.alive||!m.placed, has=m.skills&&m.skills.includes(R.skill);
      return `<div class="fighter"><b>${i+1}. ${m.name||TYPE_KO.minion}${m.element?` <span class="badge el-${m.element}">${ELEM_KO[m.element]}</span>`:""}</b>
        <small>${dead?"<b>제거됨 — 선택 불가</b>":`HP ${m.hp}/${m.maxHp} · 공 ${m.atk} · 기술 ? ? ? ?`}${has?" · <b>이미 이 기술 보유</b>":""}</small></div>`; };
    modal(`<h2>📘 ${SKILLS[R.skill].ko} — 대상 말</h2><p>이 기술을 배울 말을 고르세요. 고르면 그 말의 4슬롯이 보입니다.</p>
      ${ms.map(row).join("")}`,
      ms.map((m,i)=>{ const sel=m.alive&&m.placed&&m.skills&&!m.skills.includes(R.skill);
        const why=(!m.alive||!m.placed)?"제거됨":"이미 보유";
        return sel?btn(`${i+1}. ${m.name||"하수인"}`,"target",i)
                 :[`${i+1}. ${m.name||"하수인"} (${why})`,null,true]; })
        .concat([btn("← 뒤로","back",0),btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="slot"){
    const m=S.pieces.find(x=>x.id===R.targetId);
    if(!m||!m.alive||!m.skills){ window.__recruitCore("back",0,tk); return; } // #245 되돌림도 Core 가 소유한다 (표시 계층은 단계를 쓰지 않는다)
    modal(`<h2>📘 ${SKILLS[R.skill].ko} → ${m.name||"하수인"}</h2><p>바꿀 슬롯을 고르세요.<br><small>새 기술은 그 자리의 남은 쿨타임을 이어받습니다.</small></p>
      ${skCard(R.skill,"새 기술:")}
      <p style="margin:6px 0 2px"><small>${m.name||"하수인"}의 현재 4슬롯</small></p>
      ${m.skills.map((sid,i)=>skCard(sid,`슬롯 ${i+1}:`,m.cds[i]?` · 남은 쿨 ${m.cds[i]}`:"")).join("")}`,
      m.skills.map((sid,i)=>btn(`슬롯 ${i+1} 교체 (${SKILLS[sid].ko})`,"slot",i))
        .concat([btn("← 뒤로","back",0),btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="capRecv"){
    const recv=capReceivers(own);
    if(!recv.length){ window.__recruitCore("back",0,tk); return; } // #245 되돌림도 Core 가 소유한다 (capRecv → root)
    modal(`<h2>🔴 포획 하수인을 받을 말</h2><p>받을 말을 고르세요.<br><small>공격 포획이 실패하면 피해는 탐색한 ${idLabel(own,p)}가 받습니다.</small></p>
      ${recv.map((x,i)=>`<div class="fighter"><b>${i+1}. ${TYPE_KO[x.type]}</b><small>HP ${x.hp}/${x.maxHp} · 포획 슬롯 비어 있음</small></div>`).join("")}`,
      recv.map((x,i)=>btn(`${i+1}. ${TYPE_KO[x.type]}`,"recv",i)).concat([btn("← 뒤로","back",0),btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="capMode"){
    /* 계약 6: 뽑힌 종의 스탯·4기술·아트 정체를 그대로 적용한다. 후보는 위에서 고정했으므로 방법을 바꿔도 같은 종이다 */
    const b=S.balls[own], recv=S.pieces.find(x=>x.id===R.recvId);
    const opt=(name,cost,rate,risk)=>`<div class="fighter"><b>${name}</b><small>볼 ${cost} · 성공 ${rate}${risk?" · "+risk:""}</small></div>`;
    modal(`<h2>🔴 포획 시도 (몬스터볼 ${b})</h2>
      <div class="fighter"><b>발견: ${rd.name} <span class="badge el-${rd.element}">${ELEM_KO[rd.element]}</span></b>
        <small>HP ${rd.hp} · 공 ${rd.atk} · ⭐1 스킬 ${speciesSkills(rd.id,1).map(s=>SKILLS[s].ko).join("·")} — 이 종의 ⭐1 수치·스킬로 합류합니다<br>받을 말: ${recv?TYPE_KO[recv.type]:"-"}</small></div>
      <small>공격 포획 실패 시 <b>탐색 말</b>이 최대 HP 25% 피해!</small>
      ${opt("안전 포획",2,"100%","")}${opt("위험 포획",1,"50%","실패 시 소멸")}${opt("공격 포획",1,"70%","실패 시 소멸 + 탐색 말 HP 25% 피해")}`,
      [["안전 포획 (볼 2)",b>=2?()=>window.__recruitCore("mode",0,tk):null,b<2],
       ["위험 포획 (볼 1)",b>=1?()=>window.__recruitCore("mode",1,tk):null,b<1],
       ["공격 포획 (볼 1)",b>=1?()=>window.__recruitCore("mode",2,tk):null,b<1],
       btn("← 뒤로","back",0),btn("포기","giveup",0)]);
    return;
  }
  closeModal();
}
function pkgOpenModal(kind,ownerP,round,id){
  if(kind==="itemGift"){
    const row=k=>`<div class="fighter"><b>${GIFT_KO[k]}</b><small>${k==="ball"?`보유 ${S.balls[ownerP]} → ${S.balls[ownerP]+1}`:ITEMS[k].desc}</small></div>`;
    modal(`<h2>🎁 아이템 선물 패키지</h2><p>하나를 골라 지금 받습니다. 취소하면 패키지는 그대로 남습니다.</p>
      ${GIFT_PICKS.map(row).join("")}`,
      GIFT_PICKS.map((k,i)=>[GIFT_KO[k],()=>window.__pkgPickCore("gift",i,id)]).concat([["취소",()=>window.__pkgCancelCore(id)]]));
    return;
  }
  const r1=round===1; // 계약 3.3: 시간의 수호자는 사용자 자기 행동의 1라운드에만
  const row=key=>`<div class="fighter"><b>${BUFFS[key].ko}</b><small>${BUFFS[key].desc}${key==="time"&&!r1?" · <b>1라운드에만 선택 가능</b>":""}</small></div>`;
  modal(`<h2>✨ 전투 버프 패키지</h2><p>하나를 골라 이번 전투에만 적용합니다. 전투당 1개이며 취소하면 패키지는 그대로 남습니다.</p>
    ${BUFF_KEYS.map(row).join("")}`,
    BUFF_KEYS.map((key,i)=>{ const no=key==="time"&&!r1; // 계약 3.3: 시간은 1라운드에만 — 문구가 아니라 실제 disabled
      return [BUFFS[key].ko+(no?" (1R 전용)":""),no?null:()=>window.__pkgPickCore("buff",i,id),no]; })
      .concat([["취소",()=>window.__pkgCancelCore(id)]]));
}
function battleModal(board){
  const B=board||S.battle; if(!B) return;
  /* #245 Saturn REVISE(M2): 지난 전투 스냅샷을 그릴 때 전역 S.battle 을 잠시 갈아끼우던 자리.
     판정 보드를 인자로 넘기므로 권위 상태는 이 렌더 동안 한 번도 바뀌지 않는다 (관찰자·서버 엔진이 새 전투로 오해하지 않는다). */
  const ST=(B===S.battle)?S:Object.assign({},S,{battle:B});
  const side=actorOfPhase(ST), f=side==="A"?B.fa:B.fd, opp=side==="A"?B.fd:B.fa;
  const ownerP=side==="A"?B.attP.owner:B.defP.owner;
  const aiActor=isAI(ownerP);
  const viewer=S.mode==="sim"?2:(S.mode==="pve"?0:NET.mode?NET.me:ownerP); // 기술 공개 기준 시점 (핫시트는 행동자·온라인은 내 화면 고정)
  const busy=B.msgQ.length>0||fxLocked(); // 메시지 재생·연출 대기 중 커맨드 비활성 (#106: 배너·카운트다운 잠금 포함)
  /* #146 Saturn REVISE P1 — 이 렌더가 낸 버튼이 전투 행동을 **정확히 한 번만** 소비하게 하는 가드.
     `S.battle===B` 와 `actorOfPhase()===side` 만으로는 부족하다: 라운드 경계에서 같은 전투원이 연속으로
     행동할 차례가 오면(R1 후공 D → R2 선공 D) 옛 모달 클로저 하나가 두 번째 행동까지 그대로 소비한다.
     그래서 **공유 게임 상태**로 행동 전환을 센다: actSeq 는 `nextPhase()`(= 전투 행동 하나가 끝나고 다음 차례로
     넘어가는 유일한 지점)마다 1 늘고, 도망·패스 코어가 자기 행동을 확정하는 순간에도 늘린다.
     여기에 그 시점의 (round, phase) 스냅샷을 함께 가둬, **일반 공격·포획 실패 같은 다른 행동으로 차례가 넘어간
     뒤에 남아 있던 옛 도망·패스 콜백도** 거부한다. 렌더 횟수가 아니라 게임 상태를 세므로 온라인 양측이
     서로 다른 횟수로 다시 그려도 판정이 갈리지 않는다.
     연출·메시지 재생 중에도 거부한다 — 두 번 클릭·늦은 콜백이 재생 중인 행동 위에 겹치지 않게 한다.
     아이템·패키지 개봉 같은 **행동 내 무료 선택**은 차례를 넘기지 않으므로 이 값이 그대로여서 정상 동작한다.
     (온라인 수신 재생은 netReady 가 이미 잠금 해제·빈 msgQ 를 기다리므로 이 가드에 걸리지 않는다.) */
  /* #245 전투 커맨드 프레임 — 이 렌더의 전투 인스턴스·행동자·행동 토큰(recruit 의 token 과 같은 역할, 회선 미전송) */
  const frame={B,side,seq:B.actSeq||0,round:B.round,phase:B.phase};
  const inBonus=!!(B.bonus&&B.bonus.stage==="active"&&B.bonus.side===side); // #241 R1 번개 꼬리 추가 공격 단계 — 스킬 선택만 (도망 · 볼 · 아이템 · 패키지 · 패스 불가 L17)
  const mySide=S.mode==="pve"?(B.attP.owner===0?"A":"D"):NET.mode?(B.attP.owner===NET.me?"A":"D"):"A", topSide=mySide==="A"?"D":"A";
  const panel=sid=>{ // 전투원 정보 패널: 이름·아키타입/속성 배지·HP바·방어막 바(#106 5.5)·상태. "가한 유효 피해" 게이지는 HP 비율 판정(H1)과 달라 제거 — recA/recD 는 지표로만 기록
    const pf=sid==="A"?B.fa:B.fd, piece=sid==="A"?B.attP:B.defP;
    const rd=pf===piece&&piece.rosterId?ROSTER.find(x=>x.id===piece.rosterId):null;
    const dhp=B["dispHp"+sid]!==undefined?B["dispHp"+sid]:pf.hp; // 표시 HP (메시지 재생과 동기화)
    const dsh=B["dispSh"+sid]!==undefined?B["dispSh"+sid]:(pf.shield||0);
    /* #122: 이름·배지·HP/방어막 바·HP 수치는 **고정 머리(.fhead)** 다. 보호막과 상태 이상이 한꺼번에 걸려 길어지는
       상태 목록과 기술 4슬롯만 **.fscroll** 안에서 세로로 스크롤한다 — 좁은 폭에서도 이름·HP 가 밀려나지 않고
       7상태를 전부 읽을 수 있으며 판이 자라 전투원 도트를 덮지도 않는다 (Saturn·PD 실측 지적).
       마크업 조각·id(hpfill-·shfill-·hptxt-·bst-)와 문구는 종전 그대로라 연출(applyFx)·비공개 마스킹 경로는 불변이다. */
    return `<div class="fighter"><div class="fhead">
      <b>${fighterName(sid,B)}</b> <small>(${pname(piece.owner)})</small>
      ${rd?`<span class="badge">${ARCH_KO[rd.arch]}</span>`:""}${pf.element?`<span class="badge el-${pf.element}">${ELEM_KO[pf.element]}</span>`:""}
      <div class="hpbar"><div id="hpfill-${sid}" style="width:${Math.max(0,dhp/pf.maxHp*100)}%"></div>${pf.tideMark>0?`<i class="tideline" title="해일 예고 ${pf.tideMark}" style="left:${Math.min(100,pf.tideMark/pf.maxHp*100)}%"></i>`:""}</div>
      <div class="shbar" title="방어막"><div id="shfill-${sid}" style="width:${Math.max(0,Math.min(100,dsh/pf.maxHp*100))}%"></div></div>
      <div class="status">HP <span id="hptxt-${sid}">${dhp}</span>/${pf.maxHp}</div>
      </div><div class="fscroll">
      <div class="status"><span id="bst-${sid}">${stIcons(pf)}</span></div>
      ${pf.skills?`<div class="status">${(()=>{
        /* #234 (GDD-23 7.9): 등급·미사용 스킬은 비공개 — 보유 칸 수가 곧 등급이므로 상대 화면에는 공개된 스킬만 이름으로 쓰고
           나머지는 개수 없이 "?" 하나로 묶는다. 소유자·관전(sim)은 전부 본다. */
        const all=viewer===2||piece.owner===viewer;
        const parts=pf.skills.map((sid2,i)=>(all||(pf.revealedSkills&&pf.revealedSkills.includes(i)))?`${skillNameKo(sid2,pf.element)}${pf.cds[i]?`(쿨${pf.cds[i]})`:""}`:null);
        const shown=parts.filter(x=>x!==null); if(!all&&shown.length<parts.length) shown.push("? 미공개");
        return shown.join(" · ");
      })()}</div>`:""}
    </div></div>`;
  };
  const token=sid=>{ // 스테이지 토큰: 하수인 본체·대리 출전 포획 하수인은 128 전투 도트, 자산 규격이 없는 왕·동료 본체는 현행 속성색 원형 + 이모지 유지 (규격 6.3 · #91)
    const pf=sid==="A"?B.fa:B.fd, piece=sid==="A"?B.attP:B.defP;
    /* #121 계약 3.1·9: **적용된 효과는 상대에게도 공개**된다 (재고·선택만 비공개) — 그래서 버프 표시는 양측 화면에 그린다.
       시간의 수호자는 전투 전체에 걸리므로 그 버프를 쓴 side 의 토큰에 붙인다. */
    const bkey=sid==="A"?B.buffA:B.buffD;
    const bcls=bkey?" buff-"+bkey:"";
    const lb=pf===piece&&(piece.type==="king"||piece.type==="ally"); // #234: 왕·동료 본체 토큰은 현행 이모지·라벨 유지(속성은 패널 배지) — 표시 개편은 #238
    const pos=sid===mySide?"tok-me":"tok-op", label=pf.element&&!lb?ELEM_KO[pf.element]:TYPE_KO[piece.type];
    // #89/#91 지금 실제로 싸우는 전투원 기준: 본체면 그 말의 종, 대리 출전(포획·예비 하수인)이면 cap 에 기록된 종. 왕·동료 본체 그림은 없으므로 null → 이모지
    const dir=artDirOfFighter(pf,piece);
    if(artBattleOk(dir))   // #201: 전투 파일이 영구 결손으로 판정되면 다시 내보내지 않는다 (요청 왕복·보드 아이콘 억제 방지)
      return `<div class="btok art ${pos}${bcls}" id="tok-${sid}"><img class="bsprite" src="${artUrl(dir,"battle.png")}" alt="${fighterName(sid,B)}" width="128" height="128" onerror="artSpriteFail('${dir}',this)"><small>${label}</small></div>`;
    /* #124: 왕·동료 **본체** 출전이면 새 아트를 그 정체 역할로 그린다. 대리 출전(포획 하수인)은 위 분기라 여기 오지 않는다.
       자산이 없거나 실패하면 아래 현행 이모지 토큰으로 그대로 되돌아간다 (artSpriteFail 이 같은 자리를 바꿔 끼운다) */
    const ld=leaderBattleDir(pf,piece);
    if(ld)
      return `<div class="btok art ${pos}${bcls}" id="tok-${sid}"><img class="bsprite leader" src="${artUrl(ld,LEADER_FILES.battle)}" alt="${fighterName(sid,B)}" width="128" height="128" onerror="artSpriteFail('${ld}',this)"><small>${label}</small></div>`;
    const col=pf.element&&!lb?`var(--${pf.element})`:"#5a6377";
    const emo=lb?(piece.type==="king"?"👑":"🤝"):pf.element?ELEM_EMO[pf.element]:(piece.type==="king"?"👑":piece.type==="ally"?"🤝":"❔");
    return `<div class="btok ${pos}${bcls}" id="tok-${sid}" style="background:${col}">${emo}<small>${label}</small></div>`;
  };
  // #121 계약 2.3: itemRound(라운드 1회)만 실제 게이트다. itemsX·lastItemX 는 기록으로만 남아 더 이상 버튼을 막지 않는다
  const itemRound=side==="A"?B.itemRoundA:B.itemRoundD;
  const dis=aiActor||busy||(NET.mode&&ownerP!==NET.me); // 온라인: 상대 행동 차례엔 조작 불가
  /* Saturn REVISE P1(비공개): 마스킹 기준은 **소유자 관측**이다 — 온라인·PVE·핫시트를 함께 처리한다 */
  const mineView=viewerIsOwner(ownerP);
  /* #235 비공개: 💪 시너지 가산(synAtk)은 **그 좌석의 필드 아키타입 집계**에서 나온다. 위력 표기에 그대로 실으면
     종·등급이 이미 공개된 전투원 옆에서 상대가 가산분을 역산해 로스터 구성을 읽는다(7.9 소유자 전용).
     그래서 비소유자 화면의 위력 표기만 가산 없는 사본으로 뽑는다 — 규칙 사본을 만들지 않고 같은 Core 함수(slotPow·effAtk)를 그대로 쓴다.
     실제 피해는 언제나 Core 가 낸다. 소유자 화면은 execSlot 과 같은 값을 본다. */
  const fShow=mineView?f:Object.assign({},f,{synAtk:0});
  /* #146: 지금 이 전투원이 **합법으로 쓸 수 있는 공격 수단이 하나도 없는가**. 왕·동료 본체(skills 없음)는 기본 공격이 있으므로 항상 false.
     비공개: "공격할 것이 없습니다"는 **상대의 미공개 기술 4칸이 전부 막혀 있다**는 사실을 그대로 알려 주는 정보다.
     그래서 안내도 [턴 종료] 버튼도 **소유자 화면에만** 그린다 (비소유자에게는 종전처럼 마스킹된 4슬롯 버튼만 보인다). */
  const noAtk=!!f.skills&&!f.skills.some((sid2,i)=>slotUsable(f,i,side,ST));
  const noAtkShow=noAtk&&mineView;
  let cmdBtns; const skillTips=[]; // skillTips: ⓘ 설명 버튼이 여는 [{label,tip}] (정체를 아는 기술만)
  if(f.skills){ // 4슬롯 커맨드 — 기본 공격 버튼 없음. 전부 불가하면 공격 대신 수동 [턴 종료] (#146)
    const maskCmd=viewer!==2&&ownerP!==viewer;
    cmdBtns=f.skills.map((sid2,i)=>{
      const sk2=SKILLS[sid2], onCd=f.cds[i]>0;
      const known=!maskCmd||(f.revealedSkills&&f.revealedSkills.includes(i));
      if(!known) return ""; // #234 (7.9): 상대 화면에는 미공개 칸을 칸 수만큼 그리지 않는다(아래에서 "?" 하나로 묶는다)
      /* #121 계약 5.3: 사신의 낫은 쿨이 아니라 **봉인**으로 막힌다. 표시도 "봉인"이고 사유를 그대로 보여 준다
         (쿨링수·냉각·전술 연계·급속 순환으로는 풀리지 않는다 — 게이트가 cds[] 와 분리되어 있다) */
      const seal=sk2.reaper?reaperWhy(side,ST):null;
      const cond=!onCd&&!seal&&!slotUsable(f,i,side,ST); // #234: 전투당 1회 사용 · 사용 조건 미충족 · 수면 포자(기본기만)
      const locked=onCd||!!seal||cond;
      const label=known?`${skillNameKo(sid2,f.element)}${sk2.pow?" "+dmgRange(slotPow(fShow,sk2)):""}${onCd?` (쿨${f.cds[i]})`:seal?" (봉인)":cond?" (불가)":""}`:`? ${SKIND_KO[sk2.kind]}`;
      const cross=known&&sk2.el&&f.element&&sk2.el!==f.element; // #92 본체와 다른 속성의 공격기 — 판정 속성을 설명에 덧붙여 비교 가능하게
      const tip=known?sk2.desc+(cross?` · ${ELEM_KO[sk2.el]} 속성으로 판정`:"")+(sk2.cls?` · ${SKILL_CLS_KO[sk2.cls]} 분류(상성표 밖)`:"")+(seal?` · ${seal}`:""):"";
      skillTips[i]=known&&tip?{label,tip}:null;
      /* v0.4.10 CJ 모바일 QA: hover 가 없는 터치 기기에서도 기술 설명을 볼 수 있게 기술 버튼 옆에 ⓘ 설명 버튼을 둔다.
         설명 버튼은 표시 전용이다 — 송신·규칙 상태·전투 행동·턴 소비가 없고, 내 차례가 아니거나 기술이 쿨·봉인이어도 열린다.
         정체를 모르는 기술(비공개 "? 종류")에는 설명 버튼을 만들지 않는다(tip 이 비어 있다). PC hover(title)는 그대로다. */
      return `<span class="skillCmd"><button ${dis||locked?"disabled":""} title="${escAttr(tip)}" onclick="window.__act(${i})">${label}</button>${skillTips[i]?`<button type="button" class="skillInfoBtn" aria-label="${escAttr(label)} 설명 보기" aria-controls="skillInfoBox" aria-expanded="false" onclick="window.__skillInfo(${i})">ⓘ</button>`:""}</span>`;
    }).join("");
    if(maskCmd&&f.skills.some((x,i)=>!(f.revealedSkills&&f.revealedSkills.includes(i)))) cmdBtns+=`<span class="skillCmd"><button disabled>? 미공개</button></span>`;
    /* #146 계약 (v0.4.7 CJ 2026-09-10) — #121 계약 5.3 의 "폴백 기본 공격"을 **철회**한다.
       4슬롯이 전부 쿨·봉인·조건 미충족으로 불가하면 **어떤 공격도 제공하지 않는다**. 안내와 명시적 수동 [턴 종료]만 둔다.
       · 보조기·시그니처가 하나라도 합법이면 예외 없이 그 슬롯을 쓴다 (여기 오지 않는다).
       · 왕·동료 본체(f.skills 없음)는 아래 else 분기라 기본 공격을 그대로 유지한다.
       · [턴 종료]는 **자기 전투 행동 1회**(nextPhase)를 넘기는 것이지 보드 턴이 아니다 — 주 행동·턴당 전투 횟수는 그대로다.
       · 버튼을 누르기 전에는 아무것도 자동으로 진행하지 않는다. 가방·패키지·포획·도망 메뉴는 그대로 쓸 수 있고,
         쿨링수로 쿨이 풀리면 다음 렌더에서 이 판정이 다시 계산돼 공격 슬롯이 되살아난다. */
    if(noAtkShow) cmdBtns+=`<button class="primary" ${dis?"disabled":""} title="이번 전투 행동을 넘깁니다 (주 행동·턴당 전투 횟수·약화 횟수는 소모하지 않습니다)" onclick="window.__pass()">턴 종료</button>`;
  } else { // 왕·동료 본체·구형 경로: 기본 공격 유지
    const canSkill=f.skillAtk&&f.cd===0;
    /* #235: 기본 공격의 실제 위력은 execSlot 이 effAtk(f) 로 낸다 — 표기도 같은 Core 함수를 본다(위 fShow 마스킹 동일) */
    cmdBtns=`<button ${dis?"disabled":""} onclick="window.__act('basic')">기본 공격 ${dmgRange(effAtk(fShow))}</button>`
      +(f.skillAtk?`<button ${dis||!canSkill?"disabled":""} onclick="window.__act('skill')">${f.element?SKILL_KO[f.element]:"스킬"} ${dmgRange(f.skillAtk)}${f.cd?` (쿨${f.cd})`:""}</button>`:"");
  }
  // #12 볼 투척: 대상이 적 하수인·HP<30%·볼 보유·예비 슬롯 빈 상태·라운드당 1회 / #13 도망: 자기 HP<50%
  const oppPiece=side==="A"?B.defP:B.attP, thrown=side==="A"?B.ballThrowA:B.ballThrowD;
  const throwWhy=ballWhy(ST,side)||"", canThrow=!throwWhy; // #236: 투척 가능 판정은 Core 한 곳 (전설·보유 종 제외 포함)
  /* #146 계약: 도망에는 **HP 조건도 시도 횟수 상한도 없다**. 성공률만 전투원별로 다르다 (기본 30% · 도망의 수호자 70%) */
  const fleeP=fleeProbOf(f);
  const fleeNote=f.fleeBoost?" · 🏃 도망의 수호자 — 이 전투 도망 성공률 70%":"";
  const ballBtn=`<button ${dis||!canThrow?"disabled":""} title="적 하수인 HP 30% 미만·볼 1개 소모·성공 시 포획 종료 (라운드당 1회)" onclick="window.__throwBall()">🔴 던지기 (성공 ${pct(BAL.enemyCapProb)})</button>`;
  const fleeBtn=`<button class="danger" ${dis||f.fleeLock?"disabled":""} title="HP 조건 없이 언제나 시도 · 실패하면 상대의 기본 공격 1회를 맞고 내 전투 행동 1회를 소모합니다" onclick="window.__flee()">🏃 도망 (성공 ${pct(fleeP)})</button>`;
  /* #121 계약 2.3: 아이템 사용 제한은 **플레이어별 라운드 1회**만 남는다 — 전투당 2회(itemPerBattle)와 연속 동일 금지(lastItem)는 제거됐다.
     두 값은 BAL 에서 Infinity / 미참조가 되었고, 여기서도 더 이상 버튼을 막지 않는다. */
  /* Saturn REVISE P1(비공개): 마스킹 기준을 **소유자 관측**으로 바꾼다. 종전 `NET.mode&&ownerP!==NET.me` 는 온라인만 가려서
     PVE 의 AI 행동 차례에 AI 의 가방·패키지 재고가 사람 화면에 그대로 보였다. viewerIsOwner() 는 온라인·PVE·핫시트를 함께 처리한다.
     (mineView 는 위 #146 비공개 판정과 같은 값을 쓰도록 전투원 판정 앞에서 한 번만 계산한다.) */
  let itemBtns=!mineView?`<small>상대 아이템 비공개</small>`:S.inv[ownerP].map((k,i)=>
    `<button ${dis||itemRound?"disabled":""} title="${ITEMS[k].desc}" onclick="window.__useItem(${i})">${ITEMS[k].ko}</button>`).join("");
  /* #121 계약 2.2·3.1 패키지: 재고·개봉 선택은 **소유자에게만** 보인다. 개봉·버프 선택은 무료 보너스 행동이라
     주 행동·전투 행동·아이템 라운드 카운터를 하나도 소모하지 않는다 (확정 순간에만 재고가 움직인다). */
  const pk=S.pkgs[ownerP], buffUsed=(side==="A"?B.buffA:B.buffD);
  /* 계약 9: 한 전투 안의 UI 표시 — 양측에 적용된 버프를 상태줄로 보여 준다 (적용된 효과는 공개 정보) */
  const buffLine=(B.buffA||B.buffD)?`<div class="status">✨ ${[B.buffA?`${fighterName("A",B)} ${BUFFS[B.buffA].ko}`:"",B.buffD?`${fighterName("D",B)} ${BUFFS[B.buffD].ko}`:""].filter(Boolean).join(" · ")}</div>`:"";
  let pkgBtns=!mineView?`<small>상대 패키지 비공개</small>`:S.eco?BUFF_KEYS.map(k=>`<button ${dis||S.eco.buffInv[ownerP][k]<=0||!!buffUsed||(k==="time"&&B.round!==1)?"disabled":""} onclick="window.__buffUse('${k}')">${BUFFS[k].ko} ${S.eco.buffInv[ownerP][k]}</button>`).join(""):
    [`<button ${dis||pk.itemGift<=0?"disabled":""} title="아이템 선물 패키지를 열어 회복약·쿨링수·해독제·공용 볼 중 1개를 받습니다 (행동 미소모)" onclick="window.__openPkg('itemGift')">🎁 아이템 선물 ${pk.itemGift}</button>`,
     `<button ${dis||pk.battleBuff<=0||!!buffUsed?"disabled":""} title="${buffUsed?"이번 전투에 이미 버프를 적용했습니다 (전투당 1개)":"전투 버프 패키지를 열어 힘·시간·도망 중 1개를 적용합니다 (행동 미소모)"}" onclick="window.__openPkg('battleBuff')">✨ 전투 버프 ${pk.battleBuff}</button>`].join("");
  const turnLabel=fxTurnLabel(ownerP,true); // T3: 현재 행동자 대형 표시 (#106: 핫시트 "P1 턴!", PVE·온라인 "나의 턴!/상대 턴!")
  if(noAtkShow&&!aiActor&&S.mode!=="sim") tutHint("noatk"); // #26·#146 4슬롯 전부 불가가 처음 나올 때 1회 (표시 계층 전용 — 게임 상태·난수·저장소 무변경)
  const menu=B.menu||null; // #106 5.3 4카테고리 하위 메뉴 — 로컬 표시 상태(송신 없음). 모든 하위 패널을 그려 두고 활성 패널만 보인다
  /* #122 REVISE(2026-09-10 CJ QA 4): 하위 메뉴의 '← 뒤로'를 **하위 메뉴 패널 바로 아래**로 내린다 (직전 REVISE의 제목 옆 좌상단을 대체).
     핸들러는 종전 그대로 window.__menu(null) 시맨틱 호출이며(모달 buttons 인덱스 중계 아님) 전투에서 강제로 빠져나가는 버튼은 만들지 않는다 */
  const sub=(key,inner)=>`<div class="bsub${menu===key?"":" hidden"}" id="bsub-${key}">${inner}</div>`;
  modal(`<div class="bhead"><h2 style="font-size:22px">▶ ${turnLabel}${aiActor?" 🤖":""}</h2></div>
    <div style="font-size:12px;color:var(--dim);margin:2px 0 6px">⚔️ 라운드 ${B.round}/${battleMaxRounds(ST)}${B.maxRounds?" 🧭":""}</div>
    <div id="bstage" class="scene"><div class="bslot slot-op">${panel(topSide)}</div>${token(topSide)}<div class="bslot slot-me">${panel(mySide)}</div>${token(mySide)}</div>
    ${buffLine}
    <div id="msgBox">${busy?"":inBonus?`⚡ ${fighterName(side,B)} 추가 공격 — ${mineView?"기본기 · 2차 · 3차 중 선택 (피해 60%)":"선택을 기다리는 중"}`:(noAtkShow?NO_ATTACK_MSG:`${fighterName(side,B)}의 행동을 선택하세요.`)}</div>
    <div class="bmenu${menu?" hidden":""}" id="bmenu"><b style="grid-column:1/-1;font-size:12px;color:var(--dim)">${pname(ownerP)}:</b>
      <button ${dis?"disabled":""} onclick="window.__menu('fight')">⚔️ 싸우기</button><button ${dis||inBonus?"disabled":""} onclick="window.__menu('bag')">🎒 가방</button>
      <button ${dis||inBonus?"disabled":""} onclick="window.__menu('ball')">🔴 포획</button><button ${dis||inBonus?"disabled":""} onclick="window.__menu('flee')">🏃 도망가기</button>
      ${noAtkShow?`<button class="primary" style="grid-column:1/-1" ${dis?"disabled":""} title="이번 전투 행동을 넘깁니다 (주 행동·턴당 전투 횟수·약화 횟수는 소모하지 않습니다)" onclick="window.__pass()">턴 종료</button>`:""}</div>
    ${sub("fight",`<small>⚔️ 싸우기 — 기술 4슬롯</small>${noAtkShow?`<div class="status">${NO_ATTACK_MSG}</div>`:""}<div class="row">${cmdBtns}</div><div id="skillInfoBox" class="skillInfoBox hidden" role="note" aria-live="polite"></div>`)}
    ${sub("bag",`<small>🎒 가방 — 아이템은 보너스 행동 (라운드당 1회, 전투 횟수·연속 동일 제한 없음) · 사용 후 같은 행동자의 메뉴로 복귀${itemRound?" · <b>이번 라운드에 이미 사용</b>":""}</small>
      <div class="row">${itemBtns||"<small>아이템 없음</small>"}</div>
      <small>📦 패키지 — 개봉·버프 적용은 행동·아이템 카운터를 소모하지 않습니다${buffUsed?` · 적용된 버프: <b>${BUFFS[buffUsed].ko}</b>`:""}</small>
      <div class="row">${pkgBtns}</div>`)}
    ${sub("ball",`<small>🔴 포획 — 상대 하수인 HP 30% 미만 · 볼 ${mineView?`${S.balls[ownerP]}개`:"비공개"} · 성공 ${pct(BAL.enemyCapProb)}${mineView&&throwWhy?` · <b>${throwWhy}</b>`:""}</small><div class="row">${ballBtn}</div>`)}
    ${sub("flee",`<small>🏃 도망가기 — HP 조건 없음 · 성공 ${pct(fleeP)} · 실패하면 상대의 <b>기본 공격 1회</b>를 맞고 내 전투 행동 1회를 소모${fleeNote}</small><div class="row">${fleeBtn}</div>`)}
    <button id="bmenuBack" class="bmenuBack${menu?"":" hidden"}" type="button" onclick="window.__menu(null)">← 뒤로</button>
    <details><summary style="font-size:11px;color:var(--dim)">전투 이력</summary><div id="battleLog">${B.blog.slice(-30).join("<br>")}</div></details>`,
    []); // #122·Venus I-4: 전투는 인덱스 중계가 아니라 시맨틱 액션이므로 buttons 는 계속 빈 배열이다
  uiBattleBox(); // #122 세로 전투 화면 레이아웃 — DOM 은 표시 계층이 만진다
  window.__skillInfo=i=>uiSkillInfoToggle(i,skillTips[i]);  // 기술 설명 토글 — 표시 전용(송신 0 · 규칙 상태 무변경 · 전투 행동/턴 소비 없음)
  window.__menu=key=>{ // 하위 메뉴 전환 — 로컬 전용(송신 0), 규칙 상태 무변경, 재렌더 없이 패널 표시만 바꾼다
    if(S.battle!==B) return; B.menu=key||null;
    uiBattleMenu(B.menu);
  };
  /* #245 전투 커맨드 진입점 — 규칙·자원 회계는 전부 Core reducer(pkgOpen·pkgPick·item·ball·flee·pass·act)가 소유한다.
     여기 남는 것은 **버튼 이름과 액션을 잇는 한 줄**뿐이다: 렌더가 전투원·차례·행동 토큰을 들고 다니던 구조가 사라져
     늦은 콜백이 다른 차례를 대신 쓰는 경로 자체가 없어진다 (#146 Saturn REVISE P1 의 actSeq 스냅샷 가드가 막던 것).
     이름과 배치는 그대로 둔다 — AI(패키지)·패키지 모달 버튼·netReady 의 전투 화면 준비 판정이 이 이름을 쓴다. */
  window.__openPkgCore=(kind,wire)=>dispatchCoreAction({t:"pkgOpen",kind,frame,wire});
  window.__pkgPickCore=(what,i,id)=>dispatchCoreAction({t:"pkgPick",what,i,id,frame});                 // id = 그 개봉 화면이 받은 표 번호 (없으면 인가되지 않는다)
  window.__pkgCancelCore=id=>dispatchCoreAction({t:"pkgCancel",id,frame}); // 취소도 표시 계층이 아니라 Core 경계가 처리한다 — 자기 번호의 표만 회수한다
  window.__useItemCore=(i,wire)=>dispatchCoreAction({t:"item",i,frame,wire});
  window.__buffUse=key=>dispatchCoreAction({t:"buffUse",key,frame}); // #236 산 버프 (로컬 전용 — 회선 어휘 아님)
  window.__throwBallCore=wire=>dispatchCoreAction({t:"ball",frame,wire});
  /* 도망·넘기기는 자기 전투 행동 1회를 소모한다 — 연출 재생 중(표시 잠금)에는 받지 않는다. 잠금은 표시 계층의 사실이라
     여기서 보고, 같은 렌더의 행동을 두 번 쓰지 못하게 하는 규칙 대조는 Core 의 strict 프레임 검사가 맡는다. */
  window.__fleeCore=wire=>{ if(fxLocked()) return; dispatchCoreAction({t:"flee",frame,wire}); };
  window.__passCore=wire=>{ if(fxLocked()) return; dispatchCoreAction({t:"pass",frame,wire}); };
  window.__actCore=(kind,wire)=>dispatchCoreAction({t:"act",k:kind,frame,wire});
  /* #106 5.1·5.2 표시 순서: (1) 진입 카운트다운 3·2·1·배틀 시작! (1회) → (2) 남은 메시지 재생 → (3) 행동(phase) 배너 "나의 턴!/상대 턴!" (행동마다 1회) → (4) 메뉴 활성 / AI 스케줄.
     각 단계는 끝나면 battleModal 을 다시 그려 다음 단계로 간다 — 플래그(intro·bannerKey)로 같은 단계를 두 번 재생하지 않는다. 헤드리스·sim 은 (1)(3) 이 0ms 라 종전 흐름과 같다 */
  if(!B.intro){ B.intro=true;
    if(fxLive()){ for(const t of ["3","2","1","배틀 시작!"]) fxPlay({key:"countStep",kind:"count",title:t}); fxWhenIdle(()=>{ if(S.battle===B) battleModal(); }); return; } }
  if(B.msgQ.length){ playMsgs(B.msgQ.splice(0),()=>{ if(S.battle===B) battleModal(); }); return; }
  const bkey=B.round+"-"+B.phase;
  if(B.bannerKey!==bkey){ B.bannerKey=bkey;
    if(fxLive()){ fxPlay({key:"roundBanner",kind:"banner",cls:viewerIsOwner(ownerP)&&!(S.mode==="pvp"&&!NET.mode)?"mine":"",title:turnLabel,sub:`Round ${B.round} / ${BAL.maxRounds}`}); fxWhenIdle(()=>{ if(S.battle===B) battleModal(); }); return; } }
  if(aiActor) aiScheduleBattle();
}
window.__recruitCore=(step,i,token)=>{ dispatchCoreAction({t:"recruit",step,i,token}); };

/* ===== #245 Saturn REVISE(M1) 표시 연출·기호·말 마크업 — Core·Data 에서 옮겨 온 그대로 =====
   Core 는 연출 큐(FX·MSGQ)를, Data 는 캔버스 글리프 측정(glyphOk)을 더 이상 건드리지 않는다.
   문구·순서·시간·폴백 규칙은 글자 단위로 같다 — 옮긴 것은 소유 파일뿐이다. */
function searchEndCheck(){
  if(!BAL.fx.autoEnd) return;                 // 자동 턴 종료 스위치가 꺼진 환경(기존 헤드리스 회귀)은 종전 동작 유지
  if(autoEndReady()!=="end") return;           // 잠금·모달·강제 전투·텔레포트·남은 선택 전투 → 종료하지 않는다
  FX.auto=null;                                // 전역 grace 예약을 흡수 (이중 종료 방지)
  showToast("탐색을 마쳤습니다 — 턴을 종료합니다.");
  netAction({t:"endTurn",auto:true});          // auto 표식으로 양 클라이언트가 같은 지표(autoEnds)를 기록
}
/* #106 5.6 전투 종료 연출 공통: 남은 메시지 재생 → 결과 배너(뷰어 기준 문구) → 창 닫기. 헤드리스는 즉시.
   spec={queue,banner} — 이어지는 규칙은 Core 의 resumeCoreAction 이 UI_PORT.defer 로 따로 맡긴다
   (그 액션은 이 연출이 끝난 뒤 fxIdle 에서 실행되므로 순서는 종전과 같다). */
function battleEndFx(spec){
  const q=spec.queue, banner=spec.banner;
  const after=()=>{ if(!S.battle) closeModal(); };
  const run=()=>fxPlay({key:"resultBanner",kind:"result",cls:banner.cls||"",title:banner.title,sub:banner.sub||"",onEnd:after});
  if(liveBattleDom()) playMsgs(q,run); else { MSGQ.length=0; run(); }
}
/* #126 경기 종료 배너 — 경기당 1회. 1회 보장 플래그(S.matchFxDone)와 문구 선택은 Core 의 matchEndBanner 가 소유한다.
   Core 의 matchEnded 규칙이 matchBanner 이벤트로 넘기므로 이 래퍼는 기존 회귀 호환 진입점이다. */
function matchEndFx(){
  const b=matchEndBanner(); if(!b) return;
  applyUiEvent({type:"matchBanner",banner:b});
}
/* 기호 도형 1개. 크기는 담는 자리(.sym·.guess·.ico)의 CSS 가 정한다 — 보드 32px, 정보 행·메모 격자는 그 자리 크기 그대로 */
function symSvgHtml(key){
  const g=SYM_SVG[key]; if(!g) return "";
  /* data-sym 은 **이미 정해진 그 기호가 무엇인가**만 적는다 — 이 함수는 정체가 공개됐거나(known) 뷰어가 스스로 적은 추측일 때만 불린다.
     미공개 상대 말은 애초에 호출 경로에 들어오지 않으므로 이 속성이 새 정보를 새게 하지 않는다 (테스트·QA 의 식별자). */
  return `<svg class="symv" data-sym="${key}" viewBox="0 0 32 32" focusable="false" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
}
/* 기호 1개를 그린다 — 전용 도형이 있으면 도형(폰트 무관), 없으면 그릴 수 있는 이모지, 그것도 없으면 같은 뜻의 짧은 텍스트.
   확정·추측이 같은 규칙을 쓴다: 정체를 밝히는 것은 호출 여부이지 이 함수가 아니다 (미공개 말은 애초에 호출되지 않는다). */
function glyphSpan(key,cls){
  const o=memoOpt(key); if(!o) return "";
  if(SYM_SVG[key]) return `<span class="${cls} sv" aria-hidden="true">${symSvgHtml(key)}</span>`;
  return glyphOk(o.emoji)?`<span class="${cls}" aria-hidden="true">${o.emoji}</span>`
                         :`<span class="${cls} ng">${memoShort(key)}</span>`;
}
function pieceEmoji(p){ // 기호 문자 자체 (테스트·라벨용)
  if(!p) return "";
  if(p.type==="minion") return p.element?memoEmoji("minion_"+p.element):"";
  return memoEmoji(p.type); // king·ally·bomb·trap 는 MEMO_OPTS 키와 이름이 같다
}
function pieceMemoKey(p){ return !p?null:(p.type==="minion"?(p.element?"minion_"+p.element:null):(memoOpt(p.type)?p.type:null)); }
/* 확정(known) 말의 얼굴 — 하수인은 종 아이콘, 그 외는 같은 메모 기호. 자산이 없거나 실패하면 현행 텍스트로 복귀한다 (규격 14.6.4) */
function pcFaceHtml(p){
  const dir=artDirOf(p);
  if(artOk(dir)) return `<img class="icon" src="${artUrl(dir,"icon.png")}" alt="" aria-hidden="true" width="32" height="32" onerror="artFail('${dir}',this)">`;
  /* #124: 왕·동료도 보드에서 그 정체 역할로 보인다 (Venus 6장 AC-A5 정정). 자산이 로드된 뒤에만 그림이고 그 전에는 아래 이모지 그대로다.
     이 파생본은 1254px 원본을 단순 축소한 **픽셀 스타일 아트**이고 하수인처럼 32px 도트로 그린 원본이 아니다.
     그래서 32px 표시에는 최근접 확대(pixelated) 대신 브라우저 보간을 쓴다 (.pc .icon.leader) — 하수인 렌더 계약은 그대로다 */
  const ld=leaderArtDir(p);
  if(ld) return `<img class="icon leader" src="${artUrl(ld,LEADER_FILES.icon)}" alt="" aria-hidden="true" width="32" height="32" onerror="artFail('${ld}',this)">`;
  const key=p.type!=="minion"?pieceMemoKey(p):null;
  if(key) return `<span class="face">${glyphSpan(key,"sym")}</span>`;
  return `<span class="face"><span class="nm">${p.type==="minion"&&p.name?p.name:(TYPE_KO[p.type]||"?")}</span></span>`;
}
/* 정보 행 — 원소 기호(하수인만) + 현재 HP(하수인·동료·왕만). 폭탄·함정은 전체 공개에서도 HP 를 표시하지 않는다 (규격 7.8·7.9) */
function pcInfoHtml(p){
  const key=p.type==="minion"?pieceMemoKey(p):null;
  const hp=(p.type==="minion"||p.type==="ally"||p.type==="king")?String(p.hp):"";
  if(!key&&!hp) return "";
  return `<span class="info">${key?glyphSpan(key,"sym"):""}${hp?`<span class="hp">${hp}</span>`:""}</span>`;
}
function pcLabel(p){ // 확정 말의 접근성 문구 — 이미 공개된 값만 쓴다
  return (p.type==="minion"&&p.name?p.name:TYPE_KO[p.type])+(p.type==="minion"&&p.element?" · "+ELEM_KO[p.element]:"")
    +((p.type==="minion"||p.type==="ally"||p.type==="king")?" · HP "+p.hp:"");
}
/* 말판과 배치 트레이가 같은 함수를 쓴다 — 한쪽만 아이콘으로 바뀌는 불일치가 생기지 않는다 (규격 7.10.4) */
function pcBodyHtml(p){return pcFaceHtml(p)+pcInfoHtml(p);}

/* ===== #236 상점·가방·B08 화면 — 플레이 QA 용 기능형 최소 UI (최종 카드·레드닷 위치·연출은 #238) =====
   화면은 소유자 시점 상태만 읽고, 입력은 전부 Core 액션 하나로 보낸다. 거래 판정·회계는 Core(ecoReduce) 한 곳이다.
   확인 팝업은 승급·판매·티켓만(GDD-23 7.5·8.2), 버튼은 누르는 순간 잠긴다(once). 상점 90초는 사람 좌석마다(PVE·핫시트 — 2026-09-24 CJ D1)
   자기 상점이 처음 보이는 순간부터 흐른다: 가림이 떠 있는 동안은 시작하지 않고, 가림 확인 뒤 상점이 그려질 때 시작한다. B08 20초도 같은 원칙(가림 뒤). */
const once=fn=>{ let used=false; return ()=>{ if(used) return; used=true; fn(); }; };
const SHOPCLK={t:null,iv:null,key:null,dl:0}, BAGCLK={t:null,iv:null};
function shopViewer(){ // 지금 이 기기에서 상점을 쓰는 사람 (없으면 null)
  const sh=S&&S.eco?S.eco.shop:null; if(!sh) return null;
  if(sh.kind==="start") return S.phase==="setup"&&!isAI(S.setupPlayer)&&!sh.done[S.setupPlayer]?S.setupPlayer:null;
  if(S.phase!=="shop") return null;
  if(sh.active!==null) return sh.active;
  const p=[0,1].find(x=>!isAI(x)&&!sh.done[x]); return p===undefined?null:p;
}
function ecoName(k){ const r=ROSTER.find(x=>x.id===k); if(r) return `${ELEM_EMO[r.element]}${r.name}`; const L=LEGEND_ROSTER.find(x=>x.id===k); return L?`${L.emo}${L.name}`:"?"; }
function ecoStars(g){ return "⭐".repeat(Math.min(5,g||1)); }
function shopHtml(p){
  const sh=S.eco.shop, start=sh.kind==="start", coins=S.eco.coins[p];
  const cost=s=>{ const u=ecoUnitOf(S,p,s.key); if(!u) return {c:ecoPrice(s.grade),up:null};
    const c=s.grade>u.grade?ecoPrice(s.grade)-ecoPrice(u.grade):ecoPrice(s.grade);
    return {c,full:ecoPrice(s.grade),up:`⭐${u.grade} → ${s.grade>u.grade?s.grade:u.grade+1}`}; };
  const slots=sh.slots[p].map((s,i)=>{
    if(!s) return `<div class="fighter"><small>${i+1}. 빈칸 (살 수 없음)</small></div>`;
    if(sh.sold[p].includes(s.key)) return `<div class="fighter"><small>${i+1}. ${ecoName(s.key)} ${ecoStars(s.grade)} — <b>판매함</b></small></div>`;
    const pr=cost(s);
    return `<div class="fighter"><b>${i+1}. ${ecoName(s.key)} ${ecoStars(s.grade)}</b> ${pr.up?`<span class="badge">${pr.up}</span>`:""}
      <button ${pr.c>coins?"disabled":""} onclick="window.__shop('buy',${i})">${pr.up&&pr.full!==pr.c?`🪙<s>${pr.full}</s> → ${pr.c}`:`🪙${pr.c}`}</button></div>`;
  }).join("");
  const goods=(start?ECO.startGoods:ECO.goods).map(k=>`<button ${coins<ECO.goodPrice||!ecoReserveOk(S,p,ECO.goodPrice)?"disabled":""} onclick="window.__shop('good','${k}')">${GOOD_KO[k]} 🪙${ECO.goodPrice}</button>`).join("");
  const field=S.pieces.filter(x=>x.owner===p&&x.type==="minion").map(x=>!ecoKey(x)?`<span class="badge">빈칸</span>`
    :`<span class="badge">${x.fresh?"🔴 ":""}${x.alive?"":"💀 "}${x.name} ${ecoStars(/** @type {any} */(x).grade)} HP ${x.hp}/${x.maxHp}</span>`).join("");
  const bag=[0,1,2].map(i=>{ const u=S.eco.bag[p][i]; if(!u) return `<div class="fighter"><small>가방 ${i+1} — 빈칸</small></div>`;
    return `<div class="fighter"><b>${u.fresh?"🔴 ":""}${u.name} ${ecoStars(u.grade)}</b> <small>HP ${u.hp}/${u.maxHp} · 원장 🪙${u.paid||0}</small>
      <button onclick="window.__shop('swap',${u.uid})">교체</button><button class="danger" onclick="window.__shop('sell',${u.uid})">판매 +🪙${u.paid||0}</button></div>`; }).join("");
  const leaders=S.pieces.filter(x=>x.owner===p&&(x.type==="king"||x.type==="ally"));
  const lead=start?`<h3>왕·동료 속성 (무료 — 고르지 않으면 필드 최다 속성)</h3>`+leaders.map(x=>`<div class="row"><small>${TYPE_KO[x.type]}${x.leaderElChosen?` · ${ELEM_KO[x.element]} 선택됨`:""}</small>`
      +V2_ELEM_ORDER.map(el=>`<button ${x.leaderElChosen&&x.element===el?"disabled":""} onclick="window.__shop('lead',${x.id},'${el}')">${ELEM_EMO[el]}</button>`).join("")+`</div>`).join("")
    :`<div class="row"><button ${S.eco.tickets[p]>0?"":"disabled"} onclick="window.__shop('ticket')">🎟 티켓 사용 (${S.eco.tickets[p]})</button></div>`;
  const empty=ecoEmptyField(S,p).length, noBuy=ecoBuyable(S,p)<0;
  return `<h2>🛒 ${start?"시작 상점":`${sh.turn}턴 상점`} — ${pname(p)}</h2>
    <div class="row"><span class="badge">🪙 ${coins}</span><span class="badge" id="shopClock">${shopClockText(p)}</span>
      ${start?`<span class="badge">필드 ${ECO.field-empty}/${ECO.field}</span>`:""}</div>
    ${start&&empty?`<small>필드 빈칸 ${empty}개 — 남은 필수 비용 🪙${ecoReserveNeed(S,p)}(하수인 ${empty}명 + 필요한 새로 고침). 소모품은 산 뒤에도 🪙${ecoReserveNeed(S,p)}, 🔄 새로 고침은 새 진열 ${ECO.slots}칸 기준 🪙${ecoReserveNeed(S,p,ECO.slots)}이 남아야 합니다.</small>`:""}
    ${shopSynHtml(p)}
    <h3>진열</h3>${slots}
    ${start&&empty&&noBuy?`<small>살 수 있는 칸이 없습니다 — 🔄 새로 고침으로 새 진열을 받으세요.</small>`:""}
    <div class="row"><button ${coins<ECO.refresh||!ecoReserveOk(S,p,ECO.refresh,ECO.slots)?"disabled":""} onclick="window.__shop('refresh')">🔄 새로 고침 🪙${ECO.refresh}</button></div>
    <h3>소모품${start?"":" · 버프 · 티켓"}</h3><div class="row">${goods}</div>
    <h3>필드</h3><div class="row">${field}</div>
    <h3>가방 (${S.eco.bag[p].length}/${ECO.bagMax})</h3>${bag}
    ${lead}
    <div class="row"><button class="primary" ${start&&empty?"disabled":""} onclick="window.__shop('done')">완료${start?" → 배치":""}</button></div>`;
}
/* 5차 E16 — 내 왕국·아키타입 칸 수 · 달성 단계 · 다음 단계까지. 단계 경계는 #235 상수 그대로 (새 효과·수치 없음) */
function shopSynHtml(p){
  const v=ecoSynView(S,p), start=S.eco.shop.kind==="start";
  const stage=(n,steps)=>{ let i=-1; steps.forEach((s,k)=>{ if(n>=s) i=k; }); const nx=steps[i+1];
    return `${i<0?"미달":`(${steps[i]}) 달성`}${nx?` · (${nx})까지 ${nx-n}칸`:" · 최고 단계"}`; };
  const el=V2_ELEM_ORDER.map(k=>`<span class="badge el-${k}">${ELEM_EMO[k]} ${ELEM_KO[k]} ${v.el[k]}칸 · ${stage(v.el[k],V2_KINGDOM_STEPS)}</span>`).join("");
  const arch=Object.keys(V2_ARCH_SYN).map(k=>`<span class="badge">${ARCH_KO[k]} ${v.arch[k]}칸 · ${stage(v.arch[k],V2_ARCH_STEPS.slice(0,V2_ARCH_SYN[k].length))}</span>`).join("");
  const d=v.deadAllies;
  const lead=start?(v.pending.length?`<small>미선택 — 상점 완료 때 필드 최다 속성으로 자동 배정: ${v.pending.map(x=>TYPE_KO[x.type]).join("·")} (위 칸 수에 아직 없음)</small>`:"")
    :`<small>왕·동료 시너지: 죽은 동료 ${d}/2 — ${d>=2?`${SKILLS["LD-REVENGE"].ko} · ${SKILLS["LD-WRATH"].ko}`:d===1?`${SKILLS["LD-REVENGE"].ko} · 2명이면 ${SKILLS["LD-WRATH"].ko}`:`미달 · 1명이면 ${SKILLS["LD-REVENGE"].ko}`}</small>`;
  return `<h3>📊 내 시너지 현황${start?" (미리보기 — 필드에 산 하수인 + 고른 왕·동료 속성)":""}</h3>
    <div class="row">${el}</div><div class="row">${arch}</div>${lead}`;
}
function shopShow(cover){
  const p=shopViewer(); if(p===null) return;
  if(S.eco.shop.kind==="start"){ closeModal(); render(); return; }       // S01 은 출전 준비 화면 안에 그린다 (renderSetup)
  const open=()=>{ if(shopViewer()!==p) return; modal(shopHtml(p),[]); shopClockStart(p); };
  if(cover&&S.mode==="pvp") handoff(`${pname(p)} — 🛒 ${S.eco.shop.turn}턴 상점`,open); else open();
}
function shopClockStart(p){
  if(!fxLive()||NET.mode||isAI(p)) return;                                  // 사람 좌석만 (온라인 종전 경제·AI·sim 제외)
  const o=$("overlay"); if(o&&o.classList&&o.classList.contains("handoff")) return; // 가림 중에는 누구의 90초도 흐르지 않는다
  const key=S.eco.shop.kind+S.eco.shop.turn+":"+p; if(SHOPCLK.key===key) return; // 같은 좌석의 다시 그리기 = 마감 유지
  shopClockStop(); SHOPCLK.key=key;
  const g=S; SHOPCLK.dl=Date.now()+ECO.shopSec*1000;
  SHOPCLK.t=setTimeout(()=>{ if(S!==g||!S.eco.shop||S.eco.shop.done[p]) return; closeModal(); dispatchCoreAction({t:"shopTimeout",player:p}); },ECO.shopSec*1000); // 확정 거래는 보존 · 열린 확인 창(미확정)만 취소
  const tick=()=>{ const el=$("shopClock"); if(el) el.textContent=shopClockText(p); }; tick();
  SHOPCLK.iv=setInterval(tick,500);
}
function shopClockStop(){ clearTimeout(SHOPCLK.t); clearInterval(SHOPCLK.iv); SHOPCLK.t=SHOPCLK.iv=SHOPCLK.key=null; SHOPCLK.dl=0; }
function shopClockText(p){ return SHOPCLK.key&&SHOPCLK.key.endsWith(":"+p)?`⏱ ${Math.max(0,Math.ceil((SHOPCLK.dl-Date.now())/1000))}초`:""; }
function bagClockStop(){ clearTimeout(BAGCLK.t); clearInterval(BAGCLK.iv); BAGCLK.t=BAGCLK.iv=null; }
window.__shop=(op,a,b)=>{
  const p=shopViewer(); if(p===null) return;
  const go=act=>dispatchCoreAction(Object.assign({player:p},act));
  const back=()=>shopShow(false);
  const confirm=(html,label,act)=>modal(html,[[label,once(()=>go(act))],["취소",back]]);
  if(op==="buy"){
    const s=S.eco.shop.slots[p][a]; if(!s) return;
    const u=ecoUnitOf(S,p,s.key), act={t:"shopBuy",i:a,seq:S.eco.shop.seq[p]};
    if(!u){ go(act); return; }                                        // 신규 구매는 확인 없이 확정 · 신규 표시(🔴)
    const g=s.grade>u.grade?s.grade:u.grade+1, c=s.grade>u.grade?ecoPrice(s.grade)-ecoPrice(u.grade):ecoPrice(s.grade);
    confirm(`<h2>승급 확인</h2><p>${u.name} ⭐${u.grade} → ⭐${g} · 🪙${c}</p><small>그 자리에서 오르고 새 최대 HP 까지 회복하며 스킬 칸이 열립니다.</small>`,"승급",act);
    return;
  }
  if(op==="refresh"){ go({t:"shopRefresh",seq:S.eco.shop.seq[p]}); return; }
  if(op==="good"){ go({t:"shopGood",item:a}); return; }
  if(op==="lead"){ go({t:"leaderEl",pieceId:a,el:b}); return; }
  if(op==="done"){ go({t:"shopDone"}); return; }
  if(op==="sell"){ const u=S.eco.bag[p].find(x=>x.uid===a); if(!u) return;
    confirm(`<h2>판매 확인</h2><p>${u.name} ${ecoStars(u.grade)} — 🪙${u.paid||0} 환급 (원장 100%)</p><small>이번 상점에서는 이 종을 다시 살 수 없고, 다음에 사면 지금 HP 비율(${pct(u.hp/u.maxHp)})로 들어옵니다.</small>`,"판매",{t:"shopSell",uid:a});
    return; }
  if(op==="swap"){ const f=S.pieces.filter(x=>x.owner===p&&x.type==="minion"&&x.alive&&ecoKey(x));
    modal(`<h2>교체 대상</h2><p>가방 말과 1:1 로 바꿀 살아 있는 필드 하수인을 고르세요. HP 는 그대로입니다.</p>`,
      f.map(x=>[`${x.name} ${ecoStars(/** @type {any} */(x).grade)} HP ${x.hp}/${x.maxHp}`,once(()=>go({t:"shopSwap",pieceId:x.id,uid:a}))]).concat([["취소",back]]));
    return; }
  if(op==="ticket"){ const ls=S.pieces.filter(x=>x.owner===p&&(x.type==="king"||x.type==="ally")&&x.alive);
    modal(`<h2>🎟 시너지 교체 티켓</h2><p>속성을 바꿀 왕·동료를 고르세요.</p>`,ls.map(x=>[`${TYPE_KO[x.type]} (${ELEM_KO[x.element]||"-"})`,()=>
      modal(`<h2>새 속성</h2>`,V2_ELEM_ORDER.filter(el=>el!==x.element).map(el=>[`${ELEM_EMO[el]} ${ELEM_KO[el]}`,()=>
        confirm(`<h2>티켓 사용 확인</h2><p>${TYPE_KO[x.type]} ${ELEM_KO[x.element]} → ${ELEM_KO[el]} (스킬도 바뀝니다 · HP 유지 · 다음 전투부터 시너지 반영)</p>`,"사용",{t:"shopTicket",pieceId:x.id,el})]).concat([["취소",back]]))]).concat([["취소",back]]));
  }
};
function bagPickShow(){
  const bp=S.eco.bagPick, p=bp.owner, tok=bp.token;
  const go=i=>{ bagClockStop(); closeModal(); dispatchCoreAction({t:"bagPick",i,token:tok}); };
  const show=()=>{ if(S.eco.bagPick!==bp) return;
    modal(`<h2>🎒 가방이 가득 찼습니다 — ${pname(p)}만 확인</h2><p>4마리 중 1마리를 내보냅니다. 내보낸 말은 원장만큼 자동 판매됩니다.</p>
      <small>고르지 않으면 포획한 말을 내보냅니다 (기존 가방 말은 그대로).</small> <span class="badge" id="bagClock"></span>`,
      S.eco.bag[p].map((u,i)=>[`${u.name} ${ecoStars(u.grade)} HP ${u.hp}/${u.maxHp} · +🪙${u.paid||0}`,once(()=>go(i))])
        .concat([[`포획한 ${bp.unit.name} ${ecoStars(bp.unit.grade)} 내보내기 (🪙0)`,once(()=>go(S.eco.bag[p].length))]]));
    if(fxLive()){ bagClockStop(); const dl=Date.now()+ECO.bagPickSec*1000; // 20초는 소유자에게 창이 보이는 순간부터 (핫시트는 가림 뒤 — GDD-23 7.7, PD 확인)
      BAGCLK.t=setTimeout(()=>{ if(S.eco.bagPick===bp) go(S.eco.bag[p].length); },ECO.bagPickSec*1000); // 무응답 → 포획한 말만 방출
      BAGCLK.iv=setInterval(()=>{ const el=$("bagClock"); if(el) el.textContent=`⏱ ${Math.max(0,Math.ceil((dl-Date.now())/1000))}초`; },500); } };
  if(S.mode==="pvp"&&S.current!==p) handoff(`${pname(p)} — 가방 초과 선택`,show); else show(); // 핫시트: 포획한 쪽이 화면 주인이 아니면 가림 먼저
}
/* ===== #245 Saturn REVISE(M1·M6) 표시 포트 설치 =====
   state.js 가 선언한 무동작 기본 구현을 브라우저 구현으로 갈아 끼운다. 이 파일이 실린 뒤에만 화면이 움직이므로,
   data.js·state.js·core.js 만 실은 런타임(서버 권위 엔진)은 같은 규칙을 화면 없이 그대로 실행한다.
   좌석·입력·AI 는 network.js·ai.js 의 함수를 **이름으로** 가리킨다 — 호출 시점 조회라 로드 순서에 매이지 않는다. */
function uiInstallCorePort(){
  UI_PORT.event=event=>applyUiEvent(event);              // 의미 이벤트 → 화면·연출·AI 어댑터 (위 applyUiEvents 한 곳)
  UI_PORT.defer=action=>{ fxWhenIdle(()=>dispatchCoreAction(action)); return true; }; // 연출이 끝난 자리에서 Core 가 준 액션을 그대로 되돌려 보낸다
  UI_PORT.seat=()=>NET.mode?NET.me:null;                 // 오프라인(핫시트·PVE·sim)은 좌석이 없다
  UI_PORT.replaying=()=>!!NET.replaying;
}
uiInstallCorePort(); // ui.js 가 실리는 순간 설치 — state.js 가 이미 UI_PORT 를 선언했다
