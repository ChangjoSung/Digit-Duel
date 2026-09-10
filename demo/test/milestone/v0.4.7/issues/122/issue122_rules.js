/* #122 · #124 · #126 — 헤드리스 계약 게이트 (Node · DOM 스텁 · Chrome 없음)
   사용: node demo/test/milestone/v0.4.7/issues/122/issue122_rules.js [demo/index.html]

   이 파일이 고정하는 것 (브라우저 없이 확인 가능한 계약만 — 실제 레이아웃·픽셀은 같은 폴더의 ui_cdp.js 가 본다):
     A. 화면 상태 — 한 문서 안의 S.phase 4종 + 타이틀을 data-screen 으로 비추는 매핑, 마크업이 사라지지 않고 보이기만 바뀐다.
     B. 같은 문서 로비/재대전 — location.reload() 를 부르지 않고, 온라인 상태를 완전히 해제하며,
        **튜토리얼 자동 표시 플래그(TUT.seenThisLoad)를 건드리지 않는다**(#128 정책 불변).
     C. #126 경기 종료 연출 — 경기당 정확히 1회, 전투 결과와 문구·클래스가 구분되고,
        **전투 결과 배너 + 경기 결과 배너를 직렬로 두 번 재생하지 않는다**, 전투 무승부 갈래를 만들지 않는다(동률=방어자 승),
        sim·헤드리스에서는 0ms 동기 처리라 규칙 결과·난수 소비가 불변이다.
     D. #124 왕·동료 아트 훅 — 자산이 로드되기 전에는 현행 이모지 폴백, 로드된 뒤에만 그림,
        미공개 말에는 어떤 경로에도 정체 값이 만들어지지 않는다.
     E. 보존 — 보드 상시 종료 버튼 없음·조건부 '싸우지 않고 종료', 전투 4슬롯 전부 불가 시에만 수동 [턴 종료],
        전투 모달의 buttons 는 계속 빈 배열(온라인 인덱스 중계 미사용).

   저장소에 파일을 쓰지 않는다. 종료 코드 1 = 판정 실패, 2 = 예외. */
"use strict";
const path=require("path");
const H=require("../../../../shared/harness");
const htmlPath=process.argv[2]&&!process.argv[2].startsWith("--")?process.argv[2]:path.join(__dirname,"..","..","..","..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function block(name,fn){ try{ fn(); }catch(e){ fail++; fails.push(name+" — 예외 "+e.message); console.error("FAIL(예외) "+name+": "+e.stack); } }

/* Saturn REVISE: 인수 없는 storageSnapshot() 은 언제나 "none" 이라 아무 변화도 잡지 못한다.
   사용자 값이 실제로 들어 있는 저장소를 심어 두고 그 **객체**를 넘겨 비교한다. */
const STORE=H.mkStorage({netServer:"127.0.0.1:8080",tutorialSeen:"1",someUserKey:"keep-me"});
H.setStorage(STORE);
const T=H.load(htmlPath,{storage:"inherit"});
const SRC=T.html;
const S=()=>T.S;
const king=o=>T.S.pieces.find(x=>x.owner===o&&x.type==="king");
const ally=o=>T.S.pieces.find(x=>x.owner===o&&x.type==="ally");
const first=(o,t,i)=>T.S.pieces.filter(x=>x.owner===o&&x.type===t)[i||0];
function board(mode,lv){ H.freshPlay(T,mode||"pvp",lv); H.clearBoard(T);
  H.place(T,king(0),13,1); H.place(T,king(1),1,7);
  H.place(T,first(0,"minion",0),8,4); H.place(T,first(1,"minion",0),7,4);
  H.place(T,ally(0),12,2); H.place(T,ally(1),2,6);
  T.FX.log.length=0; T.TQ.length=0; return T.S; }

/* ===== A. 화면 상태 매핑 ===== */
block("A 화면 상태",()=>{
  ok(typeof T.UI==="object"&&T.UI!==null,"A1 표시 상태 UI 객체 존재 (규칙 상태 S 와 분리)");
  T.UI.entered=false;
  ok(T.uiScreenName()==="title","A2 아직 시작하지 않았으면 타이틀 화면");
  T.UI.entered=true;
  T.newGame("pvp"); T.S.phase="menu"; ok(T.uiScreenName()==="lobby","A3 menu → 로비");
  T.S.phase="setup"; ok(T.uiScreenName()==="prep","A4 setup → 출전 준비");
  T.S.phase="play"; ok(T.uiScreenName()==="board","A5 play → 전략 보드");
  T.S.phase="over"; ok(T.uiScreenName()==="result","A6 over → 경기 결과");
  /* 마크업은 어떤 화면에서도 사라지지 않는다 — 보이기만 CSS 로 바뀐다 (테스트·접근성이 innerHTML 을 읽는다) */
  ok(/id="titleScreen"/.test(SRC)&&/id="appBar"/.test(SRC)&&/id="screenBody"/.test(SRC)&&/id="actionDock"/.test(SRC),"A7 셸 구성 요소가 문서에 있다");
  ok(/id="sidePanel"/.test(SRC)&&/id="board"/.test(SRC)&&/id="turnBar"/.test(SRC)&&/id="log"/.test(SRC)&&/id="metrics"/.test(SRC),"A8 기존 id 를 하나도 없애지 않았다");
  ok(/data-screen="title"/.test(SRC),"A9 첫 렌더 이전의 초기 화면은 타이틀");
  ok(!/onclick="location\.reload/.test(SRC),"A10 화면 출구에 문서 재로드 버튼이 남아 있지 않다 (같은 문서 전환)");
  ok(/onclick="toLobby\(\)"/.test(SRC)&&/onclick="rematch\(\)"/.test(SRC),"A10b 결과 화면 출구는 [로비로]·[다시 대전]");
  /* 출전 준비 2단계 — 두 절이 항상 함께 렌더된다 */
  T.startMode("pvp"); T.UI.prep="roster";
  for(const rd of T.ROSTER.slice(0,6)) T.toggleRoster(rd.id); // 실제 입력 경로(netAction → applyAction → toggleRosterCore)
  T.renderSide();
  const sp=T.byId("sidePanel").innerHTML;
  ok(/data-step="roster"/.test(sp)&&/data-step="place"/.test(sp),"A11 로스터·배치 두 절이 동시에 DOM 에 있다 (보이기만 전환)");
  ok(/로스터 선택/.test(sp)&&/비공개 배치/.test(sp)&&/배치 완료/.test(sp),"A12 기존 안내·버튼 문구 보존");
  ok(T.UI.prep==="place","A13 6종을 다 고르면 배치 단계로 넘어간다");
  T.uiPrep("roster"); ok(T.UI.prep==="roster","A14 탭으로 로스터 단계로 되돌아간다");
});

/* ===== B. 같은 문서 로비 복귀·재대전 (#128 정책 불변) ===== */
block("B 로비·재대전",()=>{
  board("pve",["grade5","grade5"]);
  T.S.phase="over"; T.S.winner=0;
  const tutBefore=T.TUT.seenThisLoad, storeBefore=H.storageSnapshot(STORE);
  ok(storeBefore!=="none"&&/someUserKey/.test(storeBefore),"B0 비교 기준이 실제 저장소 스냅샷이다 (빈 'none' 이 아니다)");
  const storeWrites=STORE.writes.length;
  const reloads=T.location.reloadCount;
  T.toLobby();
  ok(T.location.reloadCount===reloads,"B1 [로비로]는 문서를 다시 읽지 않는다 (location.reload 호출 0)");
  ok(T.S.phase==="menu"&&T.uiScreenName()==="lobby","B2 같은 문서에서 로비 상태");
  ok(T.TUT.seenThisLoad===tutBefore,"B3 튜토리얼 자동 표시 플래그를 건드리지 않는다 (#128 — 같은 문서에서는 다시 뜨지 않는다)");
  ok(H.storageSnapshot(STORE)===storeBefore&&STORE.writes.length===storeWrites,
    "B4 사용자 저장값·쓰기 기록 무변경 (실제 저장소 객체 기준)");
  /* 음성 대조: 같은 검사가 실제 변화를 잡는가 */
  STORE.setItem("someUserKey","changed");
  ok(H.storageSnapshot(STORE)!==storeBefore,"B4b 이 검사는 실제 변화를 잡는다 (음성 대조)");
  STORE.setItem("someUserKey","keep-me");
  ok(T.NET.mode===false&&T.NET.started===false&&T.NET.me===null&&T.NET.code===null&&T.NET.queue.length===0,
    "B5 온라인 상태 완전 해제 (다음 오프라인 경기가 온라인 게이팅·보드 반전·인덱스 중계를 물지 않는다)");
  ok(T.byId("overlay")._cls.has("hidden")&&T.byId("overlayBox").innerHTML==="","B6 이전 경기의 모달 잔존 0 (무한 버프 애니메이션까지 DOM 에서 제거)");
  ok(!T.fxLocked(),"B7 연출 잠금 해제");
  /* 재대전 — 같은 모드·같은 난이도로 새 경기 */
  T.startMode("pve",{aiLevel:"dan5"}); T.S.phase="over"; T.S.winner=1;
  T.rematch();
  ok(T.S.phase==="setup"&&T.S.mode==="pve"&&T.S.aiLevel[1]==="dan5","B8 재대전은 같은 모드·같은 AI 난이도로 새 경기");
  ok(T.location.reloadCount===reloads,"B9 재대전도 문서를 다시 읽지 않는다");
  ok(T.S.matchFxDone===false,"B10 새 경기에서 종료 연출 플래그가 초기화된다");
  /* 온라인에서는 재대전을 제공하지 않는다 (범위 밖) */
  T.NET.mode=true; T.NET.me=0; T.S.phase="over"; T.S.winner=0; T.renderSide();
  const over=T.byId("sidePanel").innerHTML;
  ok(/toLobby\(\)/.test(over)&&!/rematch\(\)/.test(over),"B11 온라인 결과 화면에는 [로비로]만 있고 재대전 버튼이 없다");
  T.NET.mode=false; T.NET.me=null;
});

/* ===== C. #126 경기 종료 연출 ===== */
block("C 경기 종료 연출",()=>{
  board("pve",["grade5","grade5"]);
  /* C1 경기당 정확히 1회 */
  T.S.matchFxDone=false;
  const b1=T.matchEndBanner();
  ok(!!b1&&typeof b1.title==="string","C1 경기 종료 배너 항목이 만들어진다");
  ok(T.matchEndBanner()===null,"C2 같은 경기에서 두 번째 호출은 null (직렬 중복 재생 금지)");
  T.newGame("pve"); ok(T.S.matchFxDone===false,"C3 새 경기가 플래그를 되돌린다 (게임 세대가 아니라 경기 기준)");

  /* C4 뷰어 규약 — PVE 는 뷰어 기준, 핫시트는 중립, sim 은 중립, 무승부는 경기에만 */
  board("pve",["grade5","grade5"]); T.S.phase="over"; T.S.winner=0; T.S.metrics.winType="king"; T.S.matchFxDone=false;
  let b=T.matchBannerOf();
  ok(/경기 승리/.test(b.title)&&/\bwin\b/.test(b.cls)&&/match/.test(b.cls),"C4 PVE 뷰어 승리 → '경기 승리!' · match win");
  T.S.winner=1; b=T.matchBannerOf();
  ok(/경기 패배/.test(b.title)&&/\blose\b/.test(b.cls),"C5 PVE 뷰어 패배 → '경기 패배...' · match lose");
  board("pvp"); T.S.phase="over"; T.S.winner=0; T.S.metrics.winType="king"; b=T.matchBannerOf();
  ok(!/경기 승리|경기 패배/.test(b.title)&&/neutral/.test(b.cls),"C6 핫시트는 중립 문구 (같은 기기의 두 사람에게 패배 화면을 씌우지 않는다): "+b.title);
  T.S.winner=null; b=T.matchBannerOf();
  ok(/무승부/.test(b.title)&&/draw/.test(b.cls),"C7 무승부 문구는 **경기** 무승부에만 쓴다");

  /* C8 전투 결과는 승/패 둘 중 하나뿐 — 전투 무승부 갈래를 만들지 않는다 (판정 동률 = 방어자 승) */
  board("pve",["grade5","grade5"]);
  const rb=T.resultBannerOf({owner:0});
  ok(/전투에서 승리/.test(rb.title)&&/\bwin\b/.test(rb.cls),"C8 전투 승리 배너 (뷰어 기준)");
  const rl=T.resultBannerOf({owner:1});
  ok(/전투에서 패배/.test(rl.title)&&/\blose\b/.test(rl.cls),"C9 전투 패배 배너");
  ok(!/finishBattle\(null/.test(SRC)&&!/cls:"draw"/.test(SRC.replace(/match draw/g,"")),"C10 전투 결과에 무승부 분기가 없다 (draw 는 경기 결과 전용)");
  ok(/동률 \$\{pct\(ra\)\} — 방어자 승/.test(SRC),"C11 판정 동률은 종전대로 방어자 승 (규칙 무변경)");

  /* C12 왕 제거로 끝나는 전투 — 배너가 한 번만, 그리고 그것이 경기 결과다 */
  board("pve",["grade5","grade5"]);
  T.FX.log.length=0; T.S.matchFxDone=false;
  const me=first(0,"minion",0), ek=king(1);
  H.place(T,me,2,7); T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0;
  T.startRounds(me,ek,me,ek);
  T.S.battle.fd.hp=0; T.execSlot("A",0); T.drain();
  const banners=T.FX.log.filter(x=>x.key==="resultBanner");
  ok(T.S.phase==="over"&&T.S.metrics.winType==="king","C12 왕 제거로 경기 종료");
  ok(banners.length===1,`C13 결과 배너가 **정확히 1회** (0회도 2회도 아니다 — 실제 ${banners.length}회)`);
  ok(banners.length===1&&banners[0].kind==="result"&&/경기/.test(banners[0].title||""),
    `C13b 그 한 번이 전투 결과가 아니라 **경기 결과** 문구다 (kind=${banners.length?banners[0].kind:"-"} title="${banners.length?banners[0].title:"-"}")`);
  ok(banners.length===1&&!/전투에서/.test(banners[0].title||""),"C13c 전투 결과 문구가 직렬로 함께 재생되지 않았다");
  ok(T.S.matchFxDone===true,"C14 그 한 번이 경기 종료 연출로 소비됐다");

  /* C15 sim·헤드리스는 0ms 동기 — 규칙 결과·난수 소비 불변 */
  board("sim"); T.S.phase="over"; T.S.winner=0; T.S.matchFxDone=false; T.FX.log.length=0; T.TQ.length=0;
  T.matchEndFx();
  ok(!T.fxLocked()&&T.TQ.length===0,"C15 sim·헤드리스에서 종료 연출은 0ms 동기 처리 (잠금·타이머 0)");

  /* C16 파편 레이어는 난수를 쓰지 않는다 — 같은 시드 스트림에서 같은 결과 */
  ok(/for\(let i=0;i<FXFX_N;i\+\+\)/.test(SRC)&&!/fxFxLayer[\s\S]{0,400}rand\(/.test(SRC),"C16 결과 연출 파편은 인덱스 계산 — rand() 미사용");
  ok(/#fxFx/.test(SRC)&&/id="fxFx"/.test(SRC),"C17 파편 레이어가 배너 안에 있다 (별도 창·이미지 없음)");
  ok(/@media \(prefers-reduced-motion: reduce\)/.test(SRC),"C18 움직임 축소 설정 분기 존재");
  ok(/animation:none !important/.test(SRC),"C19 그 분기에서 움직임만 끈다 (문구·색은 위 규칙 그대로)");
  /* C20 새 연출 키를 만들지 않았다 — 기존 resultBanner 시간표 안에서 재생한다 */
  ok(T.BAL.fx.resultBanner===2500,"C20 resultBanner 2500ms 유지 (#125 범위 밖 · 이번에 바꾸지 않았다)");
  const keys=[...new Set((SRC.match(/\{key:"[a-zA-Z_]+"/g)||[]).map(s=>s.slice(6,-1)))].filter(k=>!new Set(T.MEMO_OPTS.map(o=>o.key)).has(k));
  ok(keys.every(k=>typeof T.BAL.fx[k]==="number"&&T.BAL.fx[k]>0),"C21 연출 그룹 키가 모두 시간표 안에 있다 (새 키를 몰래 추가하지 않았다)");
});

/* ===== D. #124 왕·동료 아트 훅 ===== */
block("D 왕·동료 아트 훅",()=>{
  board("pvp");
  ok(T.LEADER_BASE==="assets/leaders/","D1 왕·동료는 하수인과 다른 폴더 (ART_DIRS 허용 목록에 끼워 넣지 않는다)");
  ok(T.LEADER_DIRS.join(",")==="king,companion","D2 폴더 2종: "+T.LEADER_DIRS.join(","));
  ok(T.artUrl("king",T.LEADER_FILES.icon)==="assets/leaders/king/icon64.png","D3 왕 아이콘 경로");
  ok(T.artUrl("companion",T.LEADER_FILES.battle)==="assets/leaders/companion/battle256.png","D4 동료 전투 경로");
  ok(T.artUrl("fire_std","icon.png")==="assets/minions/fire_std/icon.png","D5 하수인 경로는 종전 그대로 (라우팅이 기존 20종을 바꾸지 않는다)");
  const k=king(0), a=ally(0), m=first(0,"minion",0);
  ok(T.leaderDirOf(k)==="king"&&T.leaderDirOf(a)==="companion"&&T.leaderDirOf(m)===null,"D6 말 → 폴더 매핑 (하수인은 대상 아님)");
  /* 자산이 로드되기 전에는 그림을 쓰지 않는다 — 현행 이모지 폴백 */
  T.ART.loaded.clear(); T.ART.failed.clear();
  ok(T.leaderArtDir(k)===null&&T.leaderArtDir(a)===null,"D7 로드 확인 전에는 아트 경로를 만들지 않는다");
  ok(/👑/.test(T.pcFaceHtml(k))&&!/assets\/leaders/.test(T.pcFaceHtml(k)),"D8 왕은 현행 👑 폴백");
  ok(/🤝/.test(T.pcFaceHtml(a))&&!/assets\/leaders/.test(T.pcFaceHtml(a)),"D9 동료는 현행 🤝 폴백");
  /* 로드가 확인되면 그때 그림으로 — 보드에서도 그 정체 역할로 보인다 */
  T.ART.loaded.add("king/"+T.LEADER_FILES.icon); T.ART.loaded.add("companion/"+T.LEADER_FILES.icon);
  ok(/assets\/leaders\/king\/icon64\.png/.test(T.pcFaceHtml(k)),"D10 자산이 로드되면 왕이 그 아트로 보인다");
  ok(/class="icon leader"/.test(T.pcFaceHtml(k)),"D11 1254px 원본을 축소한 픽셀 스타일 아트라 별도 클래스로 보간 렌더 (하수인 32px 최근접 확대 계약 불변)");
  /* 로드 실패는 다시 폴백 */
  T.ART.failed.add("king");
  ok(/👑/.test(T.pcFaceHtml(k))&&!/assets\/leaders/.test(T.pcFaceHtml(k)),"D12 로드 실패 뒤에는 다시 이모지 (재요청 고리 없음)");
  T.ART.failed.clear();
  /* 미공개 말에는 어떤 경로에도 정체 값이 없다 */
  const ek=king(1); ek.revealed=false; T.S.current=0; T.S.phase="play"; T.renderBoard();
  T.ART.loaded.add("king/"+T.LEADER_FILES.icon); T.ART.loaded.add("companion/"+T.LEADER_FILES.icon); // 자산이 있는 상태에서도
  T.renderBoard();
  const hidden=JSON.stringify(T.els.board.children.map(c=>c.children.filter(x=>/hiddenId/.test(x.className)).map(x=>({cls:x.className,html:x.innerHTML,al:x.getAttribute("aria-label"),ti:x.getAttribute("title")}))));
  ok(hidden.indexOf("leaders/")<0&&hidden.indexOf("companion")<0&&hidden.indexOf("king")<0,
    "D13 상대 미공개 왕·동료에는 <img>·src·클래스·라벨 어디에도 정체 값이 없다 (자산이 있어도)");
  /* 대리 출전(포획 하수인)은 여전히 그 하수인 아트 — 왕·동료 아트로 바뀌지 않는다 */
  T.ART.loaded.add("king/"+T.LEADER_FILES.battle);
  ok(T.leaderBattleDir(k,k)==="king","D14 왕 **본체** 출전이면 왕 전투 아트를 쓴다");
  const rd=T.ROSTER.find(r=>r.element==="water"&&r.arch==="std");
  k.cap={element:"water",hp:100,maxHp:100,atk:20,skillAtk:30,cd:0,cdMax:2,skills:T.archSkills("std","water"),cds:[0,0,0,0],revealedSkills:[],artRosterId:rd.id};
  ok(T.leaderBattleDir(k.cap,k)===null,"D15 대리 출전(포획 하수인) 전투원에는 왕·동료 아트를 붙이지 않는다");
  ok(T.artDirOfFighter(k.cap,k)==="water_std","D16 대리 출전은 종전대로 그 하수인의 아트를 쓴다");
  ok(T.artDirOfFighter(k,k)===null,"D17 하수인 아트 경로(artDirOfFighter)는 왕·동료를 계속 모른다 — 별도 조회 경로만 쓴다 (Venus F14)");
  k.cap=null;
  /* 실제 납품 파일이 저장소에 있고 매니페스트와 이름이 맞는가 (경로 오타 음성 대조) */
  const fsx=require("fs"), pathx=require("path");
  const root=pathx.join(__dirname,"..","..","..","..","..","..");
  for(const dir of T.LEADER_DIRS) for(const f of [T.LEADER_FILES.icon,T.LEADER_FILES.battle])
    ok(fsx.existsSync(pathx.join(root,"demo","assets","leaders",dir,f)),`D18 납품 파일 존재: demo/assets/leaders/${dir}/${f}`);
  ok(fsx.existsSync(pathx.join(root,"demo","assets","leaders","leaders-manifest.json")),"D19 납품 매니페스트 존재");
  T.ART.loaded.clear();
});

/* ===== F. 수풀 표시 (CJ 2026-09-10 추가 피드백) — 표시만 바뀌고 은폐 규칙은 그대로 ===== */
block("F 수풀 표시",()=>{
  board("pvp");
  ok(/\.pc\.inbush\{/.test(SRC)&&/\.pc\.inbush::before\{[^}]*opacity:\.5/.test(SRC)&&/\.pc\.inbush \.icon,\.pc\.inbush \.face\{opacity:\.7/.test(SRC),
    "F1 수풀 말 카드 바탕 0.5 · 본체 0.7 CSS (Earth v2 값)");
  ok(/inForest\(\{r\}\)\?" inbush":""/.test(SRC),"F2 클래스는 **칸이 실제 숲인가**로만 붙는다 (가시성 판정과 분리)");
  /* 내 말·상대 말 모두 같은 원칙, 일반 칸은 그대로 */
  const me=first(0,"minion",0), foe=first(1,"minion",0), k=king(0);
  H.clearBoard(T); T.S.phase="play"; T.S.current=0;
  H.place(T,me,9,4); H.place(T,foe,9,5); H.place(T,k,13,1);
  T.renderBoard();
  const chipAt=(r,c)=>{ const cells=T.els.board.children;
    for(const cell of cells) if(String(cell.dataset.r)===String(r)&&String(cell.dataset.c)===String(c)) return cell.children[0]||null;
    return null; };
  const mc=chipAt(9,4), fc=chipAt(9,5), pc=chipAt(13,1);
  ok(!!mc&&/inbush/.test(mc.className),"F3 수풀 칸의 내 말에 inbush");
  ok(!!fc&&/inbush/.test(fc.className)&&/hiddenId/.test(fc.className),"F4 인접해 위치가 드러난 상대 수풀 말도 같은 원칙 — 정체는 여전히 미공개");
  ok(fc.innerHTML==="?","F5 미공개 표시는 종전 그대로 ? (표시 규칙을 새로 만들지 않았다)");
  ok(!!pc&&!/inbush/.test(pc.className),"F6 일반 칸의 말에는 붙지 않는다");
  /* 은폐 규칙 자체는 무변경 — 비인접 수풀의 상대 말은 chip 이 아예 없다 */
  const far=first(1,"minion",1); H.place(T,far,10,1); T.renderBoard();
  const fcell=(()=>{ for(const cell of T.els.board.children) if(String(cell.dataset.r)==="10"&&String(cell.dataset.c)==="1") return cell; return null; })();
  ok(!!fcell&&fcell.children.length===0,"F7 비인접 수풀의 상대 말은 chip·img·?·메모 DOM 이 아예 없다 (visibleTo 무변경)");
  ok(T.visibleTo(0,far)===false&&T.visibleTo(0,foe)===true,"F8 visibleTo 판정 자체가 종전과 같다");
});

/* ===== E. 보존 계약 (이번 리스킨이 규칙 표시를 바꾸지 않았다) ===== */
block("E 보존",()=>{
  board("pve",["grade5","grade5"]);
  T.S.current=0; T.S.mainUsed=false; T.S.selected=null; T.renderTurnBar();
  const tb=()=>T.els.turnBar.children.map(b=>b.textContent).join("|");
  ok(!/턴 종료/.test(tb()),"E1 보드에는 상시 [턴 종료] 버튼이 없다 (#114 CJ 선택 A)");
  T.S.mainUsed=true; T.renderTurnBar();
  ok(!/싸우지 않고 종료/.test(tb())||T.optionalBattleLeft(),"E2 '싸우지 않고 종료'는 선택 전투가 남아 있을 때만");
  ok(/기권/.test(tb()),"E3 기권은 항상 있다");
  /* 전투 모달은 인덱스 중계가 아니라 시맨틱 액션 — buttons 는 빈 배열 그대로 */
  ok(/<\/details>`,\s*\n\s*\[\]\)/.test(SRC),"E4 battleModal 의 buttons 는 계속 빈 배열 (온라인 인덱스 중계 미사용)");
  ok(/__act\(/.test(SRC)&&/__pass\(\)/.test(SRC)&&/__flee\(\)/.test(SRC)&&/__throwBall\(\)/.test(SRC),"E5 전투 시맨틱 액션 단일 경로 유지");
  /* 4슬롯 전부 불가일 때만 수동 [턴 종료] · 소유자 화면 전용 */
  ok(/const noAtkShow=noAtk&&mineView;/.test(SRC),"E6 전투 내 수동 [턴 종료] 는 4슬롯 전부 불가 + 소유자 화면일 때만 (#146)");
  /* 보드 기하·말 규격 CSS 는 그대로 */
  ok(/#board\{[^}]*repeat\(7,52px\)/.test(SRC)&&/grid-auto-rows:52px/.test(SRC),"E7 7×13 · 칸 52px 기하 불변");
  ok(/\.pc\{[^}]*width:48px[^}]*height:48px/.test(SRC)&&/\.pc \.icon\{[^}]*width:32px[^}]*height:32px/.test(SRC)&&/\.pc \.info\{[^}]*height:11px/.test(SRC),
    "E8 말 48px · 아이콘 32px · 속성/HP 정보행 11px 규격 불변");
  ok(/transform:scale\(var\(--bs\)\)/.test(SRC),"E9 세로 화면 맞춤은 기하 변경이 아니라 래퍼 배율 (클릭 판정 좌표계가 함께 변형된다)");
  /* 숲은 표현만 바뀌고 판정은 그대로 */
  ok(/const inForest=/.test(SRC)&&/\.cell\.forest\{/.test(SRC),"E10 숲 판정(inForest)과 표현(.cell.forest)이 계속 분리돼 있다");
  const f=r=>T.inForest({r});
  ok(f(4)&&f(5)&&f(9)&&f(10)&&!f(3)&&!f(6)&&!f(8)&&!f(11),"E11 숲 행 판정 무변경 (4·5·9·10만)");
  ok(/r<=3\?" zA":r<=5\?" forest":r<=8\?"":r<=10\?" forest":" zB"/.test(SRC),"E12 칸 클래스 배정 규칙 무변경 (표현만 바뀌었다)");
});

console.log(`=== issue122_rules (#122·#124·#126): pass ${pass} / fail ${fail} ===`+(fails.length?"\n실패: "+fails.join(" | "):""));
process.exit(fail?1:0);
