/* #122 REVISE (2026-09-10 CJ QA) — 좌상단 뒤로가기 · 어두운 배경 계약 게이트 (Node · DOM 스텁 · Chrome 없음)
   사용: node demo/test/milestone/v0.4.7/issues/122/back_nav.js [demo/index.html]

   이 파일이 고정하는 것 (브라우저 없이 확인 가능한 계약만 — 실제 픽셀·대비는 같은 폴더의 ui_cdp.js 와 실촬영 증빙이 본다):
     A. 화면별 뒤로가기 표시 — 타이틀에는 없고(이전 화면이 없다), 나머지 4화면에는 문구·설명이 붙는다.
     B. 안전한 뒤로가기 — 로비→타이틀 · 배치→로스터(선택 보존) · 결과→로비.
     C. 준비 취소 확인 — 사라질 준비가 있을 때만 확인을 묻고, [계속 준비하기]는 아무것도 지우지 않는다.
     D. 서랍 우선 — 보드에서 서랍이 열려 있으면 뒤로가기는 서랍만 닫는다 (화면 유지).
     E. 경기 중 출구 없음 — 실제 대전의 뒤로가기는 toLobby()·초기화를 직접 부르지 않고 기존 기권 확인으로만 간다.
        상대 턴·AI 턴·온라인 상대 차례에는 아무 일도 하지 않고, 열린 모달을 덮어쓰지 않는다.
     F. sim 관전 — 기권할 주체가 없는 AI vs AI 관전만 확인 뒤 로비로 나간다. 취소하면 관전이 이어지고,
        나간 뒤 남아 있던 AI 콜백이 새 로비를 오염시키지 않는다.
     G. 보존 — location.reload() 없음 · 튜토리얼 자동 표시 플래그(#128) 무변경 · 저장소 무변경 ·
        전투 하위 메뉴 '← 뒤로'는 계속 window.__menu(null) 시맨틱 핸들러(모달 buttons 빈 배열).
     H. 어두운 배경 — :root 팔레트가 이전 게임(2055d5a~1) 값이고, 아이보리 리스킨 값이 남아 있지 않으며,
        #tutOverlay 잠금 블록이 그대로 있어 승인된 튜토리얼 10단계 화면이 흔들리지 않는다.

   저장소에 파일을 쓰지 않는다. 종료 코드 1 = 판정 실패, 2 = 예외. */
"use strict";
const path=require("path");
const H=require("../../../../shared/harness");
const htmlPath=process.argv[2]&&!process.argv[2].startsWith("--")?process.argv[2]:path.join(__dirname,"..","..","..","..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function block(name,fn){ try{ fn(); }catch(e){ fail++; fails.push(name+" — 예외 "+e.message); console.error("FAIL(예외) "+name+": "+e.stack); } }

const STORE=H.mkStorage({netServer:"127.0.0.1:8080",someUserKey:"keep-me"});
H.setStorage(STORE);
const T=H.load(htmlPath,{storage:"inherit"});
const SRC=T.html;
/* 문서 로드당 1회 자동 튜토리얼(#128)이 열려 있는 채로 시작한다 — 화면 조작 전에 닫는다 (플래그는 그대로 둔다).
   DOM 스텁은 마크업의 class="overlay hidden" 을 읽지 않으므로 게임 모달도 한 번 닫아 '닫힘' 상태에서 시작한다 */
T.tutClose(); T.close();
/* 실제 DOM 에서 #obBtns 는 modal() 이 overlayBox.innerHTML 을 갈아 끼울 때마다 새로 생긴다.
   스텁은 id 별 단일 객체라 이전 모달의 버튼이 남으므로, 누를 때마다 실제와 같이 비우고 시작한다. */
const back=()=>{ T.byId("obBtns").children.length=0; global.uiBack(); };
const btn=()=>T.byId("btnBack");
const overlayOpen=()=>!T.byId("overlay").classList.contains("hidden");
const obButtons=()=>T.byId("obBtns").children;
const clickOb=txt=>{ const b=obButtons().find(x=>x.textContent.indexOf(txt)>=0); if(!b) throw new Error("모달 버튼 없음: "+txt+" (있는 것: "+obButtons().map(x=>x.textContent).join(",")+")"); b.onclick(); };
const boxHtml=()=>T.byId("overlayBox").innerHTML;
function toLobbyState(){ global.toLobby(); }

/* ── A. 화면별 표시 ─────────────────────────────────────────────── */
block("A 화면별 뒤로가기 표시",()=>{
  T.UI.entered=false; T.uiApply();
  ok(T.uiScreenName()==="title","A0 시작 화면은 타이틀");
  ok(btn().classList.contains("hidden"),"A1 타이틀에는 뒤로가기가 없다 (이전 화면이 없다)");

  T.UI.entered=true; T.S.phase="menu"; T.uiApply();
  ok(!btn().classList.contains("hidden")&&/타이틀/.test(btn().textContent),"A2 로비 뒤로가기 = 타이틀");
  ok(/타이틀/.test(btn().getAttribute("title")||""),"A3 설명(title·aria-label)이 어디로 가는지 밝힌다");
  ok(btn().getAttribute("aria-label")===btn().getAttribute("title"),"A4 aria-label 과 title 이 같은 설명");

  T.S.phase="setup"; T.UI.prep="place"; T.uiApply();
  ok(/로스터/.test(btn().textContent),"A5 배치 단계 뒤로가기 = 로스터 단계");
  T.UI.prep="roster"; T.uiApply();
  ok(/로비/.test(btn().textContent),"A6 로스터 단계 뒤로가기 = 로비");

  T.S.phase="play"; T.S.mode="pvp"; T.UI.drawer="log"; T.uiApply();
  ok(/닫기/.test(btn().textContent),"A7 서랍이 열린 보드에서는 = 닫기");
  T.UI.drawer=null; T.uiApply();
  ok(/기권/.test(btn().getAttribute("title")||""),"A8 대전 중 설명에 기권 확인을 명시한다");
  T.S.mode="sim"; T.uiApply();
  ok(/관전/.test(btn().textContent),"A9 sim 관전 중에는 관전 종료 문구");
  T.S.mode="pvp"; T.S.phase="over"; T.uiApply();
  ok(/로비/.test(btn().textContent),"A10 결과 화면 뒤로가기 = 로비");
  /* 서랍 버튼은 보드 화면에서만 보이는 규칙(.barBtn)이 있다 — 뒤로가기가 거기에 걸리면 안 된다 */
  ok(/#appBar \.backBtn\{/.test(SRC),"A11a 뒤로가기는 .barBtn 이 아닌 별도 클래스로 스타일된다");
  ok(/#app:not\(\[data-screen="board"\]\) #appBar \.barBtn\{display:none;\}/.test(SRC),"A11b 서랍 버튼만 보드 화면 전용으로 숨는다");
  const hideRules=SRC.match(/[^;{}]*\{display:none;\}/g)||[];
  ok(hideRules.length>0&&!hideRules.some(r=>/\.backBtn/.test(r)),"A11c 어떤 display:none 규칙도 뒤로가기를 대상으로 삼지 않는다");
  ok(/<button id="btnBack" class="backBtn"[^>]*>[\s\S]{0,40}<\/button>\s*\n\s*<h1>/.test(SRC),"A12 마크업상 #appBar 의 첫 요소 = 좌상단");
});

/* ── B. 안전한 뒤로가기 ─────────────────────────────────────────── */
block("B 안전한 뒤로가기",()=>{
  const reload0=T.location.reloadCount, tut0=T.TUT.seenThisLoad, store0=H.storageSnapshot(STORE);
  T.newGame("pvp"); T.S.phase="menu"; T.UI.entered=true; T.UI.drawer=null; T.uiApply();
  const g=T.S;
  back();
  ok(T.uiScreenName()==="title"&&T.UI.entered===false,"B1 로비 → 타이틀");
  ok(T.S===g&&T.S.phase==="menu","B2 로비→타이틀은 게임 상태를 새로 만들지 않는다 (표시 상태만)");

  /* 배치 단계 → 로스터 단계: 고른 로스터와 이미 놓은 말이 그대로 남는다 */
  T.UI.entered=true; T.startMode("pve",{aiLevel:"grade5"});
  T.fillRosterRandom(0); T.autoPlaceCore(0);
  const roster0=T.S.roster[0].slice(), placed0=T.S.pieces.filter(x=>x.owner===0&&x.placed).length;
  T.UI.prep="place"; T.uiApply();
  back();
  ok(T.UI.prep==="roster","B3 배치 → 로스터 단계로만 돌아간다");
  ok(T.uiScreenName()==="prep"&&T.S.phase==="setup","B4 화면은 여전히 출전 준비 (로비로 나가지 않는다)");
  ok(T.S.roster[0].join()===roster0.join(),"B5 고른 로스터 6종 보존");
  ok(T.S.pieces.filter(x=>x.owner===0&&x.placed).length===placed0,"B6 이미 놓은 말 보존");

  /* 결과 화면 → 로비 */
  H.freshPlay(T,"pve"); T.S.phase="over"; T.S.winner=0; T.UI.entered=true; T.uiApply();
  back();
  ok(T.S.phase==="menu"&&T.uiScreenName()==="lobby","B7 결과 → 로비");
  ok(T.location.reloadCount===reload0,"B8 어떤 경로에서도 location.reload() 를 부르지 않는다 (같은 문서)");
  ok(T.TUT.seenThisLoad===tut0,"B9 튜토리얼 자동 표시 플래그 무변경 (#128 정책 불변)");
  ok(H.storageSnapshot(STORE)===store0,"B10 저장소 무변경 (사용자 값 보존)");
});

/* ── C. 준비 취소 확인 ─────────────────────────────────────────── */
block("C 준비 취소 확인",()=>{
  /* 사라질 준비가 없으면 묻지 않는다 */
  T.UI.entered=true; T.startMode("pvp"); T.UI.prep="roster"; T.close(); T.uiApply();
  ok(T.S.roster[0].length===0&&!T.S.pieces.some(x=>x.placed),"C0 갓 시작한 준비 화면은 비어 있다");
  back();
  ok(T.S.phase==="menu","C1 준비한 것이 없으면 확인 없이 로비로");

  /* 준비가 있으면 확인 모달 — 확정 전에는 아무것도 사라지지 않는다 */
  T.startMode("pvp"); T.fillRosterRandom(0); T.autoPlaceCore(0); T.UI.prep="roster"; T.uiApply();
  const roster0=T.S.roster[0].slice(), g=T.S;
  back();
  ok(overlayOpen(),"C2 준비한 내용이 있으면 확인 모달을 연다");
  ok(T.S===g&&T.S.phase==="setup","C3 확인 전에는 상태가 그대로 (즉시 로비로 가지 않는다)");
  ok(/로비로 돌아가기/.test(boxHtml())&&/사라집니다/.test(boxHtml()),"C4 무엇이 사라지는지 알린다");
  clickOb("계속 준비하기");
  ok(!overlayOpen()&&T.S===g&&T.S.roster[0].join()===roster0.join(),"C5 [계속 준비하기]는 아무것도 지우지 않는다");
  back(); clickOb("로비로 돌아가기");
  ok(T.S.phase==="menu"&&!overlayOpen(),"C6 확정하면 로비로");

  /* 온라인 매칭 대기 중에는 기존 [매칭 취소 (배치 유지)] 와 같은 경로 */
  T.startMode("pvp"); T.fillRosterRandom(0); T.autoPlaceCore(0);
  T.NET.queued=true; T.UI.prep="roster"; T.uiApply();
  const placed1=T.S.pieces.filter(x=>x.owner===0&&x.placed).length;
  back();
  ok(T.NET.queued===false,"C7 매칭 대기 중 뒤로가기 = 매칭 취소");
  ok(T.S.phase==="setup"&&T.S.pieces.filter(x=>x.owner===0&&x.placed).length===placed1,"C8 매칭 취소는 배치를 유지한다");
  T.NET.queued=false; T.close();
});

/* ── D. 서랍 우선 ─────────────────────────────────────────────── */
block("D 서랍 우선",()=>{
  H.freshPlay(T,"pve"); T.UI.entered=true; T.UI.drawer="log"; T.uiApply();
  const g=T.S;
  back();
  ok(T.UI.drawer===null,"D1 서랍이 열려 있으면 서랍부터 닫는다");
  ok(T.S===g&&T.S.phase==="play"&&!overlayOpen(),"D2 서랍만 닫고 화면·게임은 그대로 (기권 확인도 열지 않는다)");
});

/* ── E. 경기 중에는 새 출구를 만들지 않는다 ─────────────────────── */
block("E 경기 중 출구 없음",()=>{
  /* 소스 계약: uiBack 의 board 갈래는 confirmResign 으로만 간다 */
  const fn=SRC.slice(SRC.indexOf("window.uiBack=function()"), SRC.indexOf("window.uiBack=function()")+3000);
  const body=fn.slice(0,fn.indexOf("\n};"));
  ok(/confirmResign\(\)/.test(body),"E0 uiBack 은 기존 기권 확인을 호출한다");
  ok(!/newGame\(|S\.phase\s*=|netLeave\(|location\.reload/.test(body),"E1 uiBack 은 규칙 상태를 직접 건드리지 않는다 (초기화·재생성·reload 없음)");

  H.freshPlay(T,"pvp"); T.S.current=0; T.UI.entered=true; T.UI.drawer=null; T.close(); T.uiApply();
  const g=T.S;
  back();
  ok(overlayOpen()&&/기권/.test(boxHtml()),"E2 대전 중 뒤로가기 = 기존 기권 확인 모달");
  ok(T.S===g&&T.S.phase==="play"&&(T.S.winner===undefined||T.S.winner===null),"E3 확인 전에는 경기가 그대로 진행 중 (승자가 정해지지 않는다)");
  clickOb("취소");
  ok(!overlayOpen()&&T.S===g&&T.S.phase==="play","E4 취소하면 경기가 이어진다 (되돌린 행동 없음)");

  /* AI 턴에는 아무 일도 하지 않는다 */
  H.freshPlay(T,"pve"); T.S.current=1; T.close(); T.uiApply();
  back();
  ok(!overlayOpen()&&T.S.phase==="play","E5 AI 턴에는 기권 확인을 열지 않는다");

  /* 온라인 상대 차례 */
  H.freshPlay(T,"pvp"); T.NET.mode=true; T.NET.me=0; T.S.current=1; T.close(); T.uiApply();
  back();
  ok(!overlayOpen(),"E6 온라인 상대 차례에는 아무 일도 하지 않는다");
  T.NET.mode=false; T.NET.me=0;

  /* 이미 열린 모달(전투·기기 넘김·메모·패키지)의 주인을 빼앗지 않는다 */
  H.freshPlay(T,"pvp"); T.S.current=0; T.uiApply();
  T.modal("<h2>전투 중</h2>",[["아무거나",()=>{}]]);
  const before=boxHtml();
  back();
  ok(overlayOpen()&&boxHtml()===before,"E7 열린 모달이 있으면 뒤로가기가 그 모달을 덮어쓰지 않는다");
  T.close();
});

/* ── F. sim 관전 ─────────────────────────────────────────────── */
block("F sim 관전 종료",()=>{
  H.freshPlay(T,"sim"); T.UI.entered=true; T.UI.drawer=null; T.close(); T.uiApply();
  const g=T.S;
  back();
  ok(overlayOpen()&&/관전/.test(boxHtml()),"F1 sim 에서는 관전 종료 확인을 연다 (기권할 주체가 없다)");
  ok(!/기권/.test(boxHtml()),"F2 관전 종료는 기권이 아니다 (승패 규칙을 새로 만들지 않는다)");
  clickOb("계속 관전");
  ok(!overlayOpen()&&T.S===g&&T.S.phase==="play","F3 [계속 관전]은 관전을 그대로 잇는다");
  /* 나가기 전에 예약된 AI 콜백이 새 로비를 오염시키지 않는다 */
  T.aiSchedule();
  back(); clickOb("로비로 돌아가기");
  ok(T.S!==g&&T.S.phase==="menu","F4 확정하면 로비로 (새 게임 객체)");
  T.drain();
  ok(T.S.phase==="menu"&&T.uiScreenName()==="lobby","F5 남아 있던 AI 콜백이 로비를 오염시키지 않는다 (세대 가드)");

  /* 확인창이 떠 있는 동안 AI 가 다음 수를 두면 전투 모달·종료 연출이 이 창을 덮어쓴다 — 그 동안만 예약 실행을 미룬다 */
  H.freshPlay(T,"sim"); T.UI.entered=true; T.close(); T.uiApply();
  const g2=T.S, turn0=T.S.turnCount;
  T.aiSchedule();
  back();
  ok(overlayOpen()&&/관전/.test(boxHtml()),"F6a 관전 종료 확인창이 열린다");
  ok(T.UI.hold===true,"F6b 확인창이 떠 있는 동안 AI 예약 실행을 보류한다");
  T.drain();
  ok(overlayOpen()&&/관전/.test(boxHtml()),"F6c 예약된 AI 차례가 흘러도 확인창이 그대로 남는다");
  ok(T.S===g2&&T.S.turnCount===turn0,"F6d 보류 중에는 AI 가 수를 두지 않는다 (판단·난수 호출 없음)");
  clickOb("계속 관전");
  ok(T.UI.hold===false&&T.UI.holdQ.length===0,"F7a 취소하면 보류가 풀린다");
  T.drain();
  ok(T.S===g2&&T.S.turnCount>turn0,"F7b 취소 뒤 관전이 그대로 이어진다 (AI 가 다시 둔다)");
  T.close();
});

/* ── F2. 확인창 소유권 ─────────────────────────────────────────── */
block("F2 확인창 소유권",()=>{
  /* 남아 있던 확인 버튼이 **나중에 열린 다른 창**을 닫아 버리면 안 된다 */
  T.startMode("pvp"); T.fillRosterRandom(0); T.autoPlaceCore(0); T.UI.prep="roster"; T.uiApply();
  back();
  ok(overlayOpen(),"F2a 준비 취소 확인창이 열렸다");
  const stale=obButtons().find(x=>/로비로 돌아가기/.test(x.textContent));
  T.modal("<h2>다른 창</h2>",[["확인",()=>{}]]);   // 전투 모달 등 다른 창이 오버레이를 가져간다
  const other=boxHtml();
  stale.onclick();
  ok(overlayOpen()&&boxHtml()===other,"F2b 옛 확인 버튼은 새 창을 닫지 못한다 (close() 조차 부르지 않는다)");
  ok(T.S.phase==="setup","F2c 옛 확인 버튼은 로비로 보내지도 않는다");
  T.close();

  /* 보류 중 다른 창이 오버레이를 가져가면 AI 보류도 함께 풀린다 (영영 멈추지 않는다) */
  H.freshPlay(T,"sim"); T.UI.entered=true; T.close(); T.uiApply();
  back();
  ok(T.UI.hold===true,"F2d sim 확인창이 보류를 걸었다");
  T.modal("<h2>다른 창</h2>",[["확인",()=>{}]]);
  ok(T.UI.hold===false&&T.UI.ask===null,"F2e 다른 창이 오버레이를 가져가면 보류·소유권이 함께 풀린다");
  T.close();
});

/* ── G. 보존 ─────────────────────────────────────────────────── */
block("G 보존 계약",()=>{
  ok(/<div class="bhead"><button id="bmenuBack" class="bmenuBack\$\{menu\?"":" hidden"\}" type="button" onclick="window\.__menu\(null\)">← 뒤로<\/button><h2/.test(SRC),
    "G1a 전투 하위 메뉴 '← 뒤로'는 전투 패널 제목 왼쪽(좌상단)에 있고 핸들러는 계속 window.__menu(null) 시맨틱 호출");
  ok(/const sub=\(key,inner\)=>`<div class="bsub\$\{menu===key\?"":" hidden"\}" id="bsub-\$\{key\}">\$\{inner\}<\/div>`;/.test(SRC),
    "G1b 하위 패널 안에는 중복 뒤로가기를 남기지 않는다");
  ok(/const bb=\$\("bmenuBack"\)[\s\S]{0,160}B\.menu\?bb\.classList\.remove|__menu=key=>\{[\s\S]{0,400}bmenuBack/.test(SRC),
    "G1c 상단 '← 뒤로'는 하위 메뉴가 열렸을 때만 보인다 (같은 __menu 핸들러가 토글)");
  ok(/<\/details>`,\s*\n\s*\[\]\)/.test(SRC),"G2 battleModal 의 buttons 는 계속 빈 배열 (온라인 인덱스 중계 미사용)");
  ok(!/toLobby\(\)"[^>]*>\s*←/.test(SRC),"G3 전투 화면에 강제 이탈(로비 직행) 버튼을 만들지 않았다");
  /* 보드 기하·말 규격·수풀 판정·연출 상수는 이번 수정 범위 밖 */
  ok(/#board\{[^}]*repeat\(7,52px\)/.test(SRC)&&/grid-auto-rows:52px/.test(SRC),"G4 7×13 · 칸 52px 기하 불변");
  ok(/\.pc\{[^}]*width:48px[^}]*height:48px/.test(SRC),"G5 말 48px 규격 불변");
  ok(/\.pc\.inbush::before\{[^}]*opacity:\.5/.test(SRC)&&/\.pc\.inbush \.icon,\.pc\.inbush \.face\{opacity:\.7;\}/.test(SRC),
    "G6 수풀 속 양측 말 반투명(50% / 70%) 불변");
  ok(T.BAL.fx.resultBanner===2500&&T.BAL.fx.damageFx===1200&&T.BAL.fx.barStep===350,"G7 연출 상수 불변 (#125·#126)");
  ok(/#bstage\{[^}]*height:288px/.test(SRC)&&/\.bslot\.slot-op\{top:6px; left:6px;\}/.test(SRC)&&/\.bslot\.slot-me\{bottom:6px; right:6px;\}/.test(SRC),
    "G8 전투 무대 높이·양측 판 배치 불변");
});

/* ── H. 어두운 배경 ─────────────────────────────────────────── */
block("H 어두운 배경",()=>{
  const root=(SRC.match(/:root\{([\s\S]*?)\}/)||[])[1]||"";
  const PREV={ "--bg":"#12151c","--panel":"#1c2130","--panel2":"#242b3d","--line":"#333c52","--txt":"#e8ecf5","--dim":"#8a93a8",
    "--accent":"#5b8cff","--danger":"#ff5b6e","--ok":"#4fd88a","--zoneA":"#2a3350","--zoneB":"#502a33","--forest":"#1f3a2a","--mid":"#2a2f3d" };
  for(const k of Object.keys(PREV))
    ok(new RegExp(k.replace(/-/g,"\\-")+":"+PREV[k]+";").test(root),"H1 "+k+" = 이전 게임 값 "+PREV[k]);
  const IVORY=["#f6f1e5","#e7e0cd","#c7bca1","#17233b","#ece3d2","#dde5f4","#f7e2dc","#8ec98a"];
  for(const v of IVORY) ok(root.indexOf(v)<0,"H2 아이보리 리스킨 값 "+v+" 이 :root 에 남아 있지 않다");
  /* 남색 프레임 토큰과 보드 기하 토큰은 그대로 (세로 셸 계약) */
  ok(/--frame:432px/.test(root)&&/--navy:#132139/.test(root)&&/--boardW:376px/.test(root)&&/--boardH:700px/.test(root),
    "H3 프레임·보드 기하 토큰 불변");
  /* 하드코딩 아이보리 표면이 남아 있지 않다 */
  for(const [v,where] of [["#faf6ecf2","전투 HP 판"],["#fffdf4","전투 메시지 창"],["#d9cfb8","일반 칸 테두리"],["#dcefff","전투 무대 하늘"]])
    ok(SRC.indexOf(v)<0,"H4 하드코딩 아이보리 "+where+"("+v+") 제거");
  ok(/\.cell\.hl-sel\{outline:2px solid #e8ecf5/.test(SRC),"H5 선택 강조는 어두운 판 위에서 보이는 밝은 외곽선");
  /* 승인된 튜토리얼 10단계 화면 잠금 — #tutOverlay 안의 팔레트 블록이 그대로 있다 */
  const tut=(SRC.match(/#tutOverlay\{(--panel[\s\S]*?)\}/)||[])[1]||"";
  for(const k of ["--panel:#1c2130","--panel2:#242b3d","--line:#333c52","--txt:#e8ecf5","--dim:#8a93a8","--accent:#5b8cff","--mid:#2a2f3d","--forest:#1f3a2a"])
    ok(tut.indexOf(k)>=0,"H6 튜토리얼 잠금 블록 유지 — "+k);
  /* 튜토리얼이 쓰는 값들이 :root 와 같아졌으므로 10단계 화면의 계산 결과가 바뀌지 않는다 */
  for(const k of Object.keys(PREV))
    if(k!=="--bg"&&k!=="--danger"&&k!=="--ok"&&k!=="--zoneA"&&k!=="--zoneB")
      ok(tut.indexOf(k+":"+PREV[k])>=0,"H7 튜토리얼 팔레트와 :root 가 같은 값 — "+k);
});

console.log(`=== back_nav (#122 REVISE 뒤로가기·어두운 배경): pass ${pass} / fail ${fail} ===`+(fails.length?"\n실패: "+fails.join(" | "):""));
process.exit(fail?1:0);
