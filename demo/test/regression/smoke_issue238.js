/* #238 경기 UI 시스템 — 클라이언트(Mars) 화면 계약
   실행: node demo/test/regression/smoke_issue238.js [demo/index.html]
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).
   근거: GDD-23 2.2·7.9·8.2 · GDD-24 00.5~00.9 · Venus 2026-09-28 #238 화면 매트릭스 · Jupiter data.final / fx.cast 회선 합의

   절
     A  S01 상품 8종 실제 구매(예비 재화 유지) · 티켓 '사용'은 정기 상점 전용 · 예비 재화 문구
     B  상점 시트 — 진열 6카드 · SOLD OUT 카드에 구매 없음 · 필드 6/가방 3 고정 슬롯 · 레드닷 없음
     C  보드 HUD — 상점 Dim + 다음 오픈까지 남은 턴 · 가방 버튼
     D  S04 — 오프라인은 Core synView 원값 · 보드 9칸(폭탄·함정 제외) + 가방 · 종료 전에는 그리지 않음
     E  S04 온라인 — data.final 만 읽는다(없으면 재계산 없이 안내) · 상대 HP 는 싸운 개체만 실제 값
     F  기술 연출 — Core 가 cast 측을 싣는다 · 공용 30종(6×5) · 전설 3종 · CSS 1.2초 이하 · 움직임 줄이기
     G  X01·X03 — 맨 위 층 · 아래 화면 inert · X03 카운트다운·[포기] 없음 · 복구 시 해제
     H  시작 전 [방 나가기] = 확인 창(취소 = Esc 대상) · 헤더 ← 도 같은 확인 → leave 명령이 소켓 닫기보다 먼저 · 제품 진입점에 핫시트 없음
     K  2026-09-28 CJ 재수정 8항목 — L02 ←·만들기 창 · L01 전적 배지 · L03 준비/시작/5초 · S01 왕·동료 카드 · 역할 그림 · 전투 우상단 칩 · 시너지 안내 · 공용 팝업 · 결과 말판·방 복귀
     I  공개 경제 방 — 실제 서버 Room 좌석 뷰(room_state) 수화: 01/02 탭·늦은 콜백은 서버 시작 상점 단계를 넘지 못한다 · S01/S02(편집·대기) ← = 확인 · PVE 자유 전환 유지
     (온라인 시전 연출·전설 정체는 smoke_fx_consumer K절, X03 서버 권위 재시도는 smoke_public_rooms K12~K14b) */
"use strict";
const fs=require("fs"), path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
const css=fs.readFileSync(path.join(path.dirname(htmlPath),"css","game.css"),"utf8");
let pass=0,fail=0;
function ok(cond,name){ if(cond) pass++; else { fail++; console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(JSON.stringify(got)===JSON.stringify(want),name+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }
const act=(T,a)=>T.dispatchCoreAction(a);
const kind=r=>r&&r.events&&r.events[0]&&r.events[0].type;
const count=(s,re)=>(s.match(re)||[]).length;
function pveSetup(seed){ const T=H.load(htmlPath); T.setSeed(seed); T.startMode("pve",{aiLevel:"grade5"}); T.TQ.length=0; return T; }
function pvePlay(seed){ const T=pveSetup(seed);
  act(T,{t:"shopTimeout",player:0}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  const S=T.S; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; S.movedPiece=null; T.TQ.length=0; return T; }

/* ===== A. S01 상품 8종 ===== */
{
  const T=pveSetup(31), E={get tickets(){return T.S.eco.tickets;},get buffInv(){return T.S.eco.buffInv;},get coins(){return T.S.eco.coins;}}; // reducer 가 새 상태를 돌려주므로 매번 읽는다
  eq(T.ECO.startGoods,T.ECO.goods,"A1 S01 상품 = 정기 상점 상품 8종 (2026-09-25 CJ · #238)");
  ok(kind(act(T,{t:"shopGood",player:0,item:"ticket"}))==="shopChanged"&&E.tickets[0]===1,"A2 S01 에서 교체 티켓 구매");
  for(const k of ["power","time","escape"]) ok(kind(act(T,{t:"shopGood",player:0,item:k}))==="shopChanged"&&E.buffInv[0][k]===1,"A3 S01 전투 버프 구매: "+k);
  eq(E.coins[0],6,"A4 하수인 외 지출은 🪙4 까지 (🪙10 − 6칸 몫)");
  ok(kind(act(T,{t:"shopGood",player:0,item:"potion"}))==="shopRefused"&&E.coins[0]===6,"A5 예비 재화(빈 칸 6 × 🪙1)는 그대로 막는다");
  const king=T.S.pieces.find(x=>x.owner===0&&x.type==="king");
  ok(kind(act(T,{t:"shopTicket",player:0,pieceId:king.id,el:"fire"}))==="shopRefused","A6 티켓 '사용'은 S01 에서 거부 (정기 상점 전용 유지)");
  const h=T.shopHtml(0);
  eq(count(h,/class="goodCard"/g),8,"A7 상품 카드 8장");
  eq([...h.matchAll(/--g:(\d)"/g)].map(m=>m[1]).join(""),"01234567","A7b Earth goods.svg 8칸을 ECO.goods 순서로 쓴다");
  ok(/하수인 몫 🪙6은 남겨 둡니다/.test(h.replace(/<[^>]+>/g,""))&&!/필요한 새로 고침/.test(h),"A8 예비 재화 문구 = 빈 칸 × 🪙1 (옛 '필요한 새로 고침' 문장 삭제 · 🪙 는 코인 그림 + srOnly 글자)");
  ok(/티켓 1장 보유 — 사용은 정기 상점에서/.test(h)&&!/__shop\('ticket'\)/.test(h),"A9 S01 에는 티켓 사용 버튼 없이 보유 안내만");
}
/* ===== B. 상점 시트 ===== */
{
  const T=pveSetup(32), S=T.S;
  let h=T.shopHtml(0);
  eq(count(h,/class="shopCard/g),6,"B1 진열 6카드 고정");
  act(T,{t:"shopBuy",player:0,i:0,seq:S.eco.shop.seq[0]});
  h=T.shopHtml(0);
  const card=h.split('class="shopCard').find(x=>/SOLD OUT/.test(x));
  ok(!!card&&!/__shop\('buy'/.test(card),"B2 SOLD OUT 카드에는 구매 버튼이 없다");
  eq(count(h,/__shop\('buy'/g),5,"B3 나머지 5칸만 구매 가능");
  const slots=h.split('class="slotGrid').slice(1);
  eq(slots.length,2,"B4 필드·가방 두 슬롯 격자");
  eq(count(slots[0],/class="uSlot/g),6,"B5 필드 6칸 고정 슬롯");
  eq(count(slots[1],/class="uSlot/g),3,"B6 가방 3칸 고정 슬롯 (빈칸 포함)");
  ok(S.pieces.some(x=>x.owner===0&&x.fresh)&&!/🔴/.test(h),"B7 신규 구매 레드닷 없음 (Core fresh 는 보존)");
  T.render(); ok(!/🔴/.test(T.byId("sidePanel").innerHTML),"B8 출전 준비 화면에도 레드닷 없음");
}
/* ===== C. 보드 HUD — #238 시각 REVISE(2026-09-28 CJ): 상점·가방 아이콘은 하단 행동 줄, 위 줄은 ⏱·🔄·🪙 ===== */
{
  const T=pvePlay(33), S=T.S; S.turnCount=7; T.renderTurnBar(); T.ui238.renderBoardInfo();
  const kids=()=>T.byId("turnBar").children, lab=el=>el.getAttribute&&el.getAttribute("aria-label")||"";
  const shop=kids().find(k=>/^상점 — /.test(lab(k)));
  ok(!!shop&&/\bhudIco dim\b/.test(shop.className)&&lab(shop)==="상점 — 13턴 뒤 열림"&&/<span class="num">13<\/span>/.test(shop.innerHTML),"C1 닫힌 상점 = Dim + 남은 턴 13 (행동 줄)");
  const bag=kids().find(k=>/^가방 보기/.test(lab(k)));
  ok(!!bag&&lab(bag)==="가방 보기 (0/3)"&&(bag.onclick(),T.UI.drawer==="side"),"C2 가방 버튼은 내 가방 서랍을 연다");
  T.UI.drawer=null;
  S.turnCount=85; T.renderTurnBar();
  ok(kids().some(k=>lab(k)==="상점 — 더 열리지 않음"),"C3 80턴 뒤에는 '더 열리지 않음'");
  const h=T.byId("boardInfo").innerHTML;
  ok(/id="actClock" role="timer"/.test(h)&&/aria-label="재화 \d+"/.test(h)&&!/상세 ›/.test(h),"C4 위 줄 = 남은 시간(#actClock)·턴·재화 · 옛 [상세 ›] 없음");
  ok(["탐색","🌀 텔레포트","🌿 회복","기권"].every(t=>kids().some(k=>k.textContent===t&&k.getAttribute&&k.getAttribute("data-ico"))),"C5 행동 버튼은 문구 그대로 + 아이콘(data-ico)");
}
/* ===== D. S04 오프라인 ===== */
{
  const T=pvePlay(34), S=T.S;
  T.render(); ok(!/resultSeats/.test(T.byId("sidePanel").innerHTML),"D1 경기 중에는 결과 블록이 없다 (상대 정보 선공개 0)");
  const side=T.ui238.resultSideOffline(1);
  eq(side.pieces.length,9,"D2 보드 9칸 = 왕 1 · 동료 2 · 하수인 6 (폭탄·함정 제외)");
  ok(side.pieces.every(e=>["king","ally","minion"].includes(e.type)&&!("grade" in e)&&!("id" in e)),"D3 항목은 서버 final 과 같은 허용 칸만");
  eq(side.syn,T.synView(1,S),"D4 시너지는 Core synView 원값 그대로 (UI 재계산 없음)");
  S.pieces.find(x=>x.owner===1&&x.type==="minion").alive=false;
  T.gameOver(0,"wipe"); T.drain(); T.render();
  const sp=T.byId("sidePanel").innerHTML;
  eq(count(sp,/class="resultSeat[ "]/g),2,"D5 결과에 양측 두 칸");
  ok(/💀/.test(sp)&&/시너지|칸 · /.test(sp),"D6 사망 말 포함 · 시너지 칩 표시");
}
/* ===== E. S04 온라인 (data.final) ===== */
{
  const T=pvePlay(35), S=T.S, N=T.NET;
  N.publicMode=true; N.mode=true; N.me=0; N.final=null; S.phase="over"; S.winner=0;
  ok(/시너지 정보를 받지 못했습니다/.test(T.ui238.resultSeatsHtml()),"E1 final 이 없으면 재계산 없이 안내만");
  const e=(o)=>Object.assign({type:"minion",rosterId:"M-F1",name:"새끼 화룡",element:"fire",alive:true,hp:40,maxHp:100},o);
  N.final={sides:[{seat:0,pieces:[e({hp:77})],bag:[],syn:{el:{fire:2,water:0,lightning:0,land:0,grass:0},arch:{std:1},dead:0,stage:{fire:0,water:-1,lightning:-1,land:-1,grass:-1}}},
    {seat:1,pieces:[e({hp:55}),e({hp:30,maxHp:90,hpSeen:true,name:"화염 투사"})],bag:[e({hp:12})],syn:{el:{fire:1},arch:{},dead:0}}]};
  const h=T.ui238.resultSeatsHtml();
  ok(/HP 77\/100/.test(h)&&/HP 55%/.test(h)&&/HP 30\/90/.test(h)&&/HP 12%/.test(h),"E2 내 값은 실제, 상대는 싸운 개체만 실제·그 밖은 %");
  ok(/🎒 가방/.test(h)&&h.includes("불 2칸 · (2) 달성")&&h.includes('title="표준 1칸"')&&!h.includes("표준 1칸 ·"),"E3 가방 소절 · 왕국 단계는 서버 stage 그대로 · 아키타입은 칸 수만 (경계 재계산 없음)");
  const src=fs.readFileSync(path.join(path.dirname(htmlPath),"js","network.js"),"utf8");
  ok(/NET\.final=data\.state==="FINISHED"&&data\.final/.test(src)&&/NET\.final=null/.test(fs.readFileSync(path.join(path.dirname(htmlPath),"js","ui.js"),"utf8")),
    "E4 final 은 FINISHED 뷰에서만 받고 나가면 비운다");
}
/* ===== F. 기술 연출 ===== */
{
  const T=H.load(htmlPath); H.freshPlay(T,"pvp"); H.clearBoard(T);
  const me=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), em=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,me,12,4); H.place(T,em,11,4); T.TQ.length=0; T.startRounds(me,em,me,em); T.TQ.length=0;
  const got=[]; const q=T.S.battle.msgQ, push=q.push; q.push=function(...xs){ got.push(...xs); return push.apply(this,xs); };
  T.execSlot("A",0);
  ok(got.some(m=>m.key==="skillFx"&&m.fx&&m.fx.cast==="A"),"F1 기술 사용 메시지에 시전 측 cast:A");
  const tok=T.byId("tok-A"); const seen=new Set();
  for(const el of ["fire","water","lightning","land","grass"]) for(const a of ["std","atk","def","swift","sustain","guard"]){
    const r=T.ROSTER.find(x=>x.element===el&&x.arch===a); if(!r) continue;
    Object.assign(T.S.battle.fa,{rosterId:r.id,element:el,legend:undefined}); T.ui238.castFx("A");
    if(tok.classList.contains("cast")&&tok.classList.contains("ar-"+a)&&tok.style["--castC"]===`var(--${el})`) seen.add(a+"/"+el);
  }
  eq(seen.size,30,"F2 일반 30종 = 아키타입 6 × 속성 5 공용 프리셋");
  for(const k of ["dragon","witch","reaper"]){ Object.assign(T.S.battle.fa,{legend:k,element:null}); T.ui238.castFx("A"); ok(tok.classList.contains("lg-"+k),"F3 전설 전용 연출: "+k); }
  const durs=[...css.matchAll(/\.btok\.(?:ar|lg)-[a-z]+::after\{[^}]*animation:[a-zA-Z]+ ([\d.]+)s/g)].map(m=>+m[1]);
  ok(durs.length===9&&durs.every(d=>d<=1.2),"F4 프리셋 6 + 전설 3 모두 1회 1.2초 이하 "+JSON.stringify(durs));
  ok(/prefers-reduced-motion: reduce\)\{\s*\.btok\.cast::after\{animation:none !important/.test(css),"F5 움직임 줄이기 = 애니메이션 없이 같은 색 테두리");
}
/* ===== F2. 전투 내 시너지 칩 — 소유자만 · 서버 ownSyn / Core selector 의 단계·칸 수 그대로 ===== */
{
  const T=pvePlay(38);
  const own={el:{fire:2,water:0,lightning:0,land:0,grass:0},arch:{std:0,atk:3,def:0,swift:0,sustain:0,guard:0},dead:0,stage:{fire:0,water:-1,lightning:-1,land:-1,grass:-1},bonus:{}};
  const h=T.ui238.battleSynChips(0,{element:"fire"},{syn:[own,null]});
  ok(h.includes('class="bsyn"')&&h.includes("불 왕국 2칸")&&h.includes("공격 아키타입 3칸")&&/synHelp\('atk',3,this\)/.test(h),"F6 내 전투원 칩 = 공급된 stage·칸 수 그대로 (CJ 5: 아이콘 + 칸 수 · 누르면 안내)");
  ok(!T.ui238.battleSynChips(0,{element:"fire"},{syn:[Object.assign({},own,{stage:{fire:-1}}),null]}).includes("왕국"),"F6b 공급 stage 가 -1 이면 칸 수 2 여도 왕국 칩 없음 (UI 경계 재계산 없음)");
  eq(T.ui238.battleSynChips(1,{element:"fire"},{syn:[null,own]}),"","F7 상대 전투원 칩은 그리지 않는다 (비공개)");
  eq(T.ui238.battleSynChips(0,{element:"fire"},{}),"","F8 스냅샷이 없으면 칩 없음");
  /* 온라인 어댑터 — battle.ownSyn 만 내 좌석 칸에, 상대 칸은 null · 없으면 syn 없음 */
  const N=T.NET; N.mode=true; N.publicMode=true; N.me=1;
  const side=(o,id)=>({owner:o,type:"minion",rosterId:id,element:"fire",hp:50,maxHp:100,skills:[]});
  const B1=T.ui238.netSynthBattle({a:side(0,"M-F1"),d:side(1,"M-F2"),ownSyn:own},{pieces:[]});
  ok(B1&&Array.isArray(B1.syn)&&B1.syn[1]===own&&B1.syn[0]===null,"F9 ownSyn → 내 좌석(1) 칸만, 상대 칸 null");
  const B2=T.ui238.netSynthBattle({a:side(0,"M-F1"),d:side(1,"M-F2"),ownSyn:null},{pieces:[]});
  ok(B2&&B2.syn===undefined,"F10 ownSyn 없음/null → 칩 원천 없음 (옛 전투 값 잔존 없음)");
}
/* ===== G. X01 · X03 ===== */
{
  const T=pvePlay(36), N=T.NET; N.publicMode=true; N.mode=true; N.me=0;
  N.pause=[{seat:1,graceLeftMs:40000,at:Date.now()}]; T.ui238.netResumeBarSync();
  const bar=T.byId("netResumeBar"), app=T.byId("app"), emo=T.byId("emoteLayer");
  ok(!bar.classList.contains("hidden")&&/상대 연결 대기/.test(bar.innerHTML)&&/재연결 유예 40초/.test(bar.innerHTML),"G1 X01 = 서버 잔여 유예만 표시");
  ok(app.getAttribute("inert")===""&&emo.getAttribute("inert")==="","G2 X01 동안 게임·이모티콘 층 inert (기권·서랍·이모티콘 포함 잠금)");
  N.pause=null; N.resuming=true; N.resumeAttempts=2; T.ui238.netResumeBarSync();
  const x3=T.byId("netResumeBar").innerHTML;
  ok(/재접속 중/.test(x3)&&/시도 2회/.test(x3)&&!/남은 시간/.test(x3)&&!/netCancelResume/.test(x3),"G3 X03 = 초 카운트다운·[포기] 없음");
  N.resuming=false; T.ui238.netResumeBarSync();
  ok(T.byId("netResumeBar").classList.contains("hidden")&&app.getAttribute("inert")!==""&&emo.getAttribute("inert")!=="","G4 복구되면 inert 해제");
}
/* ===== H. 시작 전 나가기 · 핫시트 진입점 ===== */
{
  const T=pveSetup(37); T.ui238.uiLeaveConfirm();
  const box=T.byId("overlayBox").innerHTML, btns=(T.byId("obBtns").children||[]).map(b=>b.textContent);
  ok(/바로 취소됩니다/.test(box)&&/공식 전적에는 남지 않습니다/.test(box)&&btns.includes("나가기")&&btns.includes("취소"),"H1 [방 나가기] 확인 창 — 즉시 취소 · 전적 없음 · 취소(Esc) 버튼");
  /* H3 Saturn REVISE — 공개 방 시작 전(S01/S02) 헤더 ← 는 소켓만 닫던 toLobby 가 아니라 확인 → netLeaveRoom(leave 명령 → 닫기) */
  const P=H.load(htmlPath,{href:"file:///C:/Digit-Duel/demo/index.html",storage:H.mkStorage({tutorialSeen:"1"})}); if(P.TUT.open) P.tutClose();
  P.netCreatePublicRoom(); const ws=P.wsLog[0]; ws.readyState=1; ws.protocol="digit-duel.v1"; ws.onopen();
  ws.onmessage({data:JSON.stringify({v:1,type:"room_opened",epoch:"e1",roomId:9,seat:0,seatToken:"h",tokenGen:0,revision:0,seq:1})});
  P.NET.roomState="SETUP"; P.UI.entered=true; P.byId("overlay").classList.add("hidden"); P.byId("tutOverlay").classList.add("hidden"); // 실제 DOM 초기 상태
  let atClose=null; const close=ws.close; ws.close=()=>{ atClose=ws.sent.map(x=>JSON.parse(x).t); close(); };
  const btn=t=>P.byId("obBtns").children.find(b=>b.textContent===t);
  const sent0=ws.sent.length;
  for(const step of ["roster","place"]){ // 01 시작 상점 · 02 배치 뒤 준비 대기(S02)
    P.UI.prep=step; P.NET.readyWanted=step==="place"; global.uiBack();
    ok(/바로 취소됩니다/.test(P.byId("overlayBox").innerHTML)&&!!btn("취소")&&ws.sent.length===sent0&&!ws.closed,"H3 "+step+" 헤더 ← = [방 나가기] 확인 창 (아직 보내거나 닫지 않음)");
    btn("취소").onclick();
    ok(P.byId("overlay").classList.contains("hidden")&&ws.sent.length===sent0&&!ws.closed&&P.NET.roomId===9,"H4 "+step+" 취소 = 송신·닫기 없음, 방 유지");
  }
  P.UI.prep="place"; P.NET.readyWanted=false; global.uiBack();
  ok(P.UI.prep==="place"&&/바로 취소됩니다/.test(P.byId("overlayBox").innerHTML)&&ws.sent.length===sent0&&!ws.closed,"H5 02 배치 편집 중 ← 도 확인 창 (01 로 돌아가는 화면 이동 없음 · 승인 S02)");
  btn("취소").onclick(); global.uiBack(); btn("나가기").onclick();
  ok(atClose&&atClose[atClose.length-1]==="leave"&&ws.closed&&P.NET.roomId===null,"H6 확인 → leave 명령을 보낸 뒤에 소켓을 닫는다 "+JSON.stringify(atClose));
  const V=pveSetup(39); V.byId("overlay").classList.add("hidden"); V.byId("tutOverlay").classList.add("hidden"); V.UI.entered=true; V.UI.prep="roster"; V.S.roster[0].push(V.ROSTER[0].id); global.uiBack();
  ok(/출전 준비를 그만두고/.test(V.byId("overlayBox").innerHTML)&&!/바로 취소됩니다/.test(V.byId("overlayBox").innerHTML),"H7 PVE 준비 화면의 ← 는 종전 로컬 확인 그대로");
  const lobby=fs.readFileSync(path.join(path.dirname(htmlPath),"js","lobby.js"),"utf8");
  ok(!/startMode\(\s*["']pvp["']/.test(lobby)&&!/핫시트|한 기기 2인/.test(lobby.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,"")),"H2 제품 로비에 핫시트 진입점 없음");
}
/* ===== I. 공개 경제 방 — 실제 서버 좌석 뷰 수화로 S01 → S02 단계 잠금 (Saturn msg_6750f5fdbf4d) ===== */
{
  const {Room}=require(path.join(__dirname,"..","..","..","server","authoritative","room.js"));
  const sws=()=>({readyState:1,sent:[],send(){},close(){ this.readyState=3; }});
  const room=new Room(11,{isPublic:true,epoch:"e1",graceMs:60000,economy:true,seed:238,shopMs:600000,placeMs:600000,actMs:600000,bagPickMs:600000});
  room.openHostSeat(sws()); room.joinGuestSeat(sws());
  const P=H.load(htmlPath,{href:"file:///C:/Digit-Duel/demo/index.html",storage:H.mkStorage({tutorialSeen:"1"})}); if(P.TUT.open) P.tutClose();
  P.netCreatePublicRoom(); const ws=P.wsLog[0]; ws.readyState=1; ws.protocol="digit-duel.v1"; ws.onopen();
  ws.onmessage({data:JSON.stringify({v:1,type:"room_opened",epoch:"e1",roomId:11,seat:0,seatToken:"h",tokenGen:0,revision:0,seq:1,economy:true})});
  P.UI.entered=true; P.byId("tutOverlay").classList.add("hidden"); // 실제 DOM 초기 상태 (H3 과 같다)
  const feed=()=>{ const v=room.toSeatView(0); ws.onmessage({data:JSON.stringify({v:1,type:"room_state",revision:v.revision,seat:0,data:v})}); P.byId("overlay").classList.add("hidden"); return v; };
  const tab=s=>(P.byId("sidePanel").innerHTML.match(new RegExp('<button[^>]*data-prep-step="'+s+'"[^>]*>'))||[""])[0];
  const btn=t=>P.byId("obBtns").children.slice().reverse().find(b=>b.textContent===t);
  const acts=()=>ws.sent.map(x=>JSON.parse(x)).map(x=>x.t==="action"?x.action.t:x.t);
  const shopAct=(seat,t,extra)=>{ const v=room.toSeatView(seat); return room._handleAction(seat,{baseRevision:v.revision,action:Object.assign({t,shop:v.shop.shop,seq:v.shop.seq},extra||{})}); };
  const finish=seat=>{ for(let n=0;n<20&&room.toSeatView(seat).phase==="shop";n++){ const v=room.toSeatView(seat);
    const empty=room.engines[seat].S.pieces.filter(x=>x.owner===seat&&x.type==="minion"&&!x.rosterId).length, i=v.shop.slots.findIndex(x=>x&&!x.sold);
    shopAct(seat,empty?(i>=0?"shopBuy":"shopRefresh"):"shopDone",empty&&i>=0?{i}:{}); } };
  const leaveAsk=(name)=>{ const n=ws.sent.length; global.uiBack();
    ok(/바로 취소됩니다/.test(P.byId("overlayBox").innerHTML)&&ws.sent.length===n&&!ws.closed,name+" ← = [방 나가기] 확인 창");
    btn("취소").onclick(); ok(P.byId("overlay").classList.contains("hidden")&&ws.sent.length===n&&!ws.closed&&P.NET.roomId===11,name+" 취소 = 송신·닫기 없음"); };

  let v=feed();
  ok(v.phase==="shop"&&P.S.eco&&P.S.eco.shop.kind==="start"&&!P.S.eco.shop.done[0]&&P.UI.prep==="roster","I1 서버 S01 뷰 수화 → 01 시작 상점");
  ok(/disabled/.test(tab("place"))&&!/disabled/.test(tab("roster")),"I2 S01 열린 동안 02 탭 비활성");
  global.uiPrep("place"); ok(P.UI.prep==="roster"&&P.byId("app").getAttribute("data-prep")==="roster","I3 02 탭 호출로 열린 S01 을 건너뛰지 못한다");
  leaveAsk("I4 S01");
  finish(0); v=feed();
  ok(v.phase==="setup"&&P.S.eco.shop.done[0]&&P.UI.prep==="place"&&!P.NET.readyWanted,"I5 내 S01 완료 뷰 → 02 배치 (상대는 아직 상점)");
  ok(/disabled/.test(tab("roster"))&&!/disabled/.test(tab("place")),"I6 S01 완료 뒤 01 탭 비활성");
  global.uiPrep("roster"); ok(P.UI.prep==="place","I7 01 탭 호출로 끝난 S01 을 다시 열지 못한다");
  P.UI.prep="roster"; P.render(); ok(P.UI.prep==="place"&&P.byId("app").getAttribute("data-prep")==="place","I8 늦은 콜백이 UI.prep 을 되돌려도 다음 표시에서 서버 단계로 복귀");
  leaveAsk("I9 S02 편집");
  finish(1); v=feed(); ok(P.UI.prep==="place"&&P.S.eco.shop.done[0],"I10 양측 완료 뷰에도 02 유지");
  global.autoPlace(); global.setupDone(); P.render();
  ok(P.NET.readyWanted&&acts().includes("setup"),"I11 배치 완료 → 서버에 setup·준비 의사 "+JSON.stringify(acts()));
  leaveAsk("I12 S02 대기");
  let atClose=null; const close=ws.close; ws.close=()=>{ atClose=acts(); close(); };
  global.uiBack(); btn("나가기").onclick();
  ok(atClose&&atClose[atClose.length-1]==="leave"&&ws.closed&&P.NET.roomId===null,"I13 확인 → leave 명령 뒤 소켓 닫기 "+JSON.stringify(atClose));
  /* PVE — 서버 단계 잠금 없음 · 종전 자유 전환 */
  const V=pveSetup(40); global.uiPrep("place"); ok(V.UI.prep==="place","I14 PVE 는 S01 중에도 02 탭 전환 (종전)"); global.uiPrep("roster"); ok(V.UI.prep==="roster","I15 PVE 01 복귀 (종전)");
}
/* ===== J. #238 시각 REVISE (2026-09-28 CJ) — 이력 토글 제거 · 13종 아트 연결 · 로비 구성 ===== */
{
  const html=fs.readFileSync(htmlPath,"utf8"), ui=fs.readFileSync(path.join(path.dirname(htmlPath),"js","ui.js"),"utf8");
  ok(!/id="btnDrawerLog"|id="drawerLog"|id="drawerMetrics"|>기록</.test(html)&&!/전투 이력<\/summary>|id="battleLog"/.test(ui),"J1 [기록]·공개 기록·경기 지표·전투 이력 토글이 제품 화면에 없다");
  const T=H.load(htmlPath);
  ok(T.ART_DIRS.length===33&&new Set(T.ART_DIRS).size===33,"J2 아트 폴더 닫힌 목록 33 (기존 20 + 보호형 4 + 땅 6 + 전설 3)");
  ok(T.artDirOf({type:"minion",rosterId:"M-E1"})==="land_std"&&T.artDirOf({type:"minion",rosterId:"M-F6"})==="fire_guard"&&T.artDirOf({type:"minion",rosterId:"L-DRAGON"})==="legend_dragon","J3 땅·보호형·전설 공개 ID → 새 폴더");
  ok(T.artDirOf({type:"minion",rosterId:"L-NOPE"})===null&&T.artDirOf({type:"minion",legend:"../x"})===null&&T.artDirOf({type:"king",rosterId:"L-WITCH"})===null,"J4 목록 밖 전설·오염 키·비하수인은 경로를 만들지 않는다");
  const piece={type:"ally"}, cap={legend:"reaper",element:null}; piece.cap=cap;
  ok(T.artDirOfFighter(cap,piece)==="legend_reaper"&&T.artDirOfFighter({legend:"reaper"},piece)===null,"J5 전설 대리 출전은 그 cap 일 때만 전설 폴더");
  ok(T.ART_DIRS.every(d=>["icon.png","battle.png","battle-grid.png","portrait.png","portrait.webp"].every(f=>fs.existsSync(path.join(path.dirname(htmlPath),"assets","minions",d,f)))),"J6 33 폴더 × 5 파일 실재");
  const sh=pveSetup(36).shopHtml(0);
  ok((sh.match(/class="stars" aria-label="등급 \d"/g)||[]).length===6&&/class="tags" role="img" aria-label="[^"]+ · [^"]+"/.test(sh)&&/class="synChip/.test(sh),"J7 상점 = 한 줄 6행(등급·썸네일·이름·속성/아키타입 아이콘) · 시너지 아이콘 칩");
}
/* ===== K. 2026-09-28 CJ 재수정 8항목 ===== */
{
  const lobbyJs=fs.readFileSync(path.join(path.dirname(htmlPath),"js","lobby.js"),"utf8");
  const T=H.load(htmlPath), N=T.NET, L=T.LOBBY;
  /* 1 L02 */
  const rh=T.rooms.lobbyRoomsHtml(), head=rh.slice(rh.indexOf('class="roomsHead"'),rh.indexOf("</div>",rh.indexOf('class="roomsHead"')));
  ok(head.indexOf("lobbyHome()")>=0&&head.indexOf("lobbyHome()")<head.indexOf('id="roomsTitle"'),"K1 L02 ← 가 제목 앞(좌상단)");
  ok(/id="roomCreate"[^>]*role="dialog"[^>]*onkeydown="if\(event\.key==='Escape'\)lobbyCreateOpen\(false\)"/.test(rh)&&/id="roomMk"/.test(rh)&&/\$\(on\?"roomName":"roomMk"\)/.test(lobbyJs),"K2 방 만들기 창 = 대화상자 · Esc/✕ 닫기 → [생성]으로 초점 복귀");
  ok(/\.roomCreate \.acctHead h3\{[^}]*white-space:nowrap/.test(css)&&/\.roomCreate \.acctHead \.acctX\{flex:0 0 44px; width:44px; height:44px/.test(css),"K3 제목 한 줄 · ✕ 44×44 고정 (종전 .roomCreate button 폭 100% 가 ✕ 를 늘리지 않는다)");
  /* 2 L01 */
  L.gen=0; L.view="home"; L.profile={nickname:"창조",repMinion:"M-F1",wins:2,losses:0,pending:1,history:[]};
  let lh=T.lobby.lobbyHtml();
  ok(/id="l01Rec"[^>]*aria-haspopup="dialog"[^>]*aria-label="전적 기록 — 최근 20경기 보기"[^>]*onclick="lobbyHist\(true\)"><i class="gi" style="--i:\d+" aria-hidden="true"><\/i><\/button>/.test(lh)&&!/<b>2승<\/b>/.test(lh)&&/aria-label="공식 전적 2승 0패"/.test(lh),"K4 (CJ 최신 2) 기록 = 이전 승인 기록 아이콘 · 전체 승·패는 프로필 줄 · 누르면 최근 20경기 창");
  ok(!/\.l01Rec b\{/.test(css),"K4b 기록 아이콘 = 종전 승·패 글자 규칙 삭제 (높이는 CJ 최신 이벤트와 같은 높이 · 실제 DOM 실측이 기준)");
  { /* CJ 최신 1: 잠금 안내 = 사라지는 토스트 · 다시 누르면 갱신 · 옛 타이머가 새 토스트를 지우지 않는다 · 실제 오류 안내는 #lobbyNotice 그대로 */
    const q=[], st=global.setTimeout; global.setTimeout=fn=>{ q.push(fn); return 0; };
    T.lobby.lobbyLocked("미션"); const k1=L.toast; T.lobby.lobbyLocked("랭크"); const k2=L.toast;
    const host=T.byId("lobbyToast").innerHTML;
    ok(k1!==k2&&/랭크 — 추후 공개/.test(host)&&!/미션/.test(host)&&/class="toast"/.test(host)&&q.length===2,"K4c 다시 누르면 새 토스트로 갱신(공용 .toast)");
    q[0](); ok(L.toast===k2&&/랭크/.test(T.byId("lobbyToast").innerHTML),"K4d 옛 타이머는 새 토스트를 지우지 않는다");
    q[1](); ok(L.toast===null&&T.byId("lobbyToast").innerHTML==="","K4e 2.3초 뒤 사라진다");
    global.setTimeout=st;
    lh=T.lobby.lobbyHtml();
    ok(/class="l01Tiles">[\s\S]*id="lobbyToast" class="lobbyToast" role="status" aria-live="polite"><\/div><\/div>/.test(lh)&&!/id="lobbyNotice"/.test(lh)&&/id="lobbyNotice"/.test(T.rooms.lobbyRoomsHtml())&&/id="lobbyToast"/.test(T.rooms.lobbyRoomsHtml()),"K4f 토스트 자리 = 미션 줄 아래(겹침) · L01 고정 안내 삭제 · L02 참가 불가 안내는 유지");
    ok(/\.lobbyToast\{position:absolute;[^}]*pointer-events:none/.test(css),"K4g 배치를 밀지 않고 누름 통과");
  }
  ok(/결과 저장을 기다리는 경기 1건/.test(lh)&&/아직 공식 멀티 경기 기록이 없습니다/.test(lh)&&/role="dialog" aria-modal="true"/.test(lh),"K5 창 안의 대기 중·빈 기록 안내(접근성 대화상자)");
  L.profile.wins=null; lh=T.lobby.lobbyHtml();
  ok(/aria-label="공식 전적 전적 확인 불가/.test(lh)&&!/0승/.test(lh),"K6 전적을 모르면 0 으로 꾸미지 않는다");
  /* 3 L03 */
  T.startMode("pvp"); T.S.eco=null; Object.assign(N,{publicMode:true,economy:true,started:false,roomId:7,roomName:"adw",me:0,players:["창조","test"],reps:["M-F1","M-W1"],roomState:"WAITING",peerConnected:true,revision:5});
  N.lobby={guestReady:false,countdownMs:null,peerInResult:false,at:Date.now()};
  eq(T.ui238.uiScreenName(),"room","K7 WAITING(두 사람 대기방) = L03 화면 — 시작 상점 자동 진입 없음");
  let w=T.rooms.lobbyWaitHtml();
  ok(/class="primary" disabled onclick="lobbyWaitSend\(netLobbyStart\)">시작<\/button>/.test(w)&&/준비 전/.test(w),"K8 방장 [시작]은 참가자 준비 전 비활성");
  N.lobby.guestReady=true; w=T.rooms.lobbyWaitHtml();
  ok(/class="primary"  onclick="lobbyWaitSend\(netLobbyStart\)">시작/.test(w)&&/준비 완료/.test(w),"K9 참가자 준비 → [시작] 활성");
  N.lobby.peerInResult=true; w=T.rooms.lobbyWaitHtml();
  ok(/disabled onclick="lobbyWaitSend\(netLobbyStart\)"/.test(w)&&/결과 확인 중/.test(w),"K10 상대가 결과 화면이면 시작 불가 · 표시");
  N.lobby={guestReady:true,countdownMs:4200,peerInResult:false,at:Date.now()}; w=T.rooms.lobbyWaitHtml();
  ok(/<span id="lobbyCd">5<\/span>초 뒤 시작/.test(w)&&/disabled onclick="lobbyWaitSend\(netLobbyStart\)">시작하는 중…/.test(w),"K11 서버 남은 ms 로 카운트다운 표시 · 중복 시작 버튼 잠금");
  N.me=1; N.lobby={guestReady:false,countdownMs:null,peerInResult:false,at:Date.now()}; w=T.rooms.lobbyWaitHtml();
  ok(/aria-pressed="false"  onclick="lobbyWaitSend\(\(\)=>netLobbyReady\(true\)\)">준비<\/button>/.test(w)&&!/netLobbyStart/.test(w),"K12 참가자 = [준비] (시작 없음)");
  N.lobby.guestReady=true; w=T.rooms.lobbyWaitHtml();
  ok(/netLobbyReady\(false\)\)">준비 취소/.test(w),"K13 준비 뒤 [준비 취소]");
  ok(/채팅 — 추후 공개/.test(w)&&!/<input|<textarea/.test(w)&&T.emote.EMOTES.length===6,"K14 자유 채팅 없음 · 기존 6종 이모티콘");
  const ui=fs.readFileSync(path.join(path.dirname(htmlPath),"js","ui.js"),"utf8");
  ok(/L\.classList\.toggle\("inRoom",!!cl\)/.test(ui)&&/#emoteLayer\.inRoom #emoteBtn\{top:0; right:12px;\}/.test(css),"K15 대기방 이모티콘 = 채팅 🔒 줄 옆");
  /* 8 결과 — 같은 방 복귀 · 최종 말판 */
  N.roomState="FINISHED"; N.me=0; T.S.phase="over"; T.S.winner=0; N.final=null; T.renderSide();
  const sp=T.byId("sidePanel").innerHTML;
  ok(/onclick="this\.disabled=true;netReturnToRoom\(\)">방으로 돌아가기/.test(sp)&&!/toLobby\(\)/.test(sp)&&/최종 공개 말판/.test(sp),"K16 온라인 결과 CTA = 같은 방 복귀 (로비 아님) · 말판 제목");
  ok(!/#app\[data-screen="result"\] #left[^{]*\{display:none/.test(css)&&/#app\[data-screen="result"\] #left\{order:2/.test(css)&&/#app\[data-screen="result"\] #screenBody\{padding:10px 8px;\}/.test(css),"K17 결과 카드 아래 말판(320 폭 보드 304px = 칸 42px)");
  /* 좌상단 ← 도 CTA 와 같은 경로 — 실제 uiBack 호출로 확인 */
  T.UI.entered=true; T.byId("overlay").classList.add("hidden"); T.byId("tutOverlay").classList.add("hidden"); T.uiApply();
  const bk=T.byId("btnBack"), calls=[], rr=global.netReturnToRoom, tl=global.toLobby;
  global.netReturnToRoom=()=>calls.push("room"); global.toLobby=()=>calls.push("lobby");
  ok(bk.textContent==="← 방으로"&&/같은 멀티 대기방/.test(bk.getAttribute("aria-label")),"K16b 온라인 결과 헤더 ← = 같은 방 (문구·접근성 이름)");
  T.FX.q.push({}); global.uiBack(); T.FX.q.length=0; global.uiBack();
  ok(calls.join()==="room"&&N.roomId===7,"K16c 헤더 ← = netReturnToRoom (연출 중 잠금 유지 · 방 유지) "+calls.join());
  N.publicMode=false; global.uiBack(); T.uiApply();
  ok(calls.join()==="room,lobby"&&bk.textContent==="← 로비","K16d 오프라인 결과 헤더 ← = 종전 toLobby "+calls.join());
  global.netReturnToRoom=rr; global.toLobby=tl;
  N.publicMode=false; T.renderSide(); ok(/toLobby\(\)">로비로 돌아가기/.test(T.byId("sidePanel").innerHTML),"K18 오프라인은 종전 [로비로 돌아가기]");
}
{
  /* 4 S01 왕 · 공격 동료 · 방어 동료 */
  const T=pveSetup(41), S=T.S, lead=h=>h.slice(h.indexOf("왕·동료 속성"),h.indexOf("아이템</h3>"));
  let h=lead(T.shopHtml(0));
  eq([...h.matchAll(/class="row leadRow" role="group" aria-label="(왕|공격 동료|방어 동료)/g)].map(m=>m[1]),["왕","공격 동료","방어 동료"],"K19 세 줄 = 왕 · 공격 동료 · 방어 동료");
  ok(!/선택됨/.test(h.replace(/<[^>]*>/g,""))&&(h.match(/aria-pressed=/g)||[]).length===15,"K20 긴 '선택됨' 문장은 화면에 없고(접근성 이름만) · 속성 버튼 5×3");
  const king=S.pieces.find(x=>x.owner===0&&x.type==="king"); T.__shop("lead",king.id,"water"); h=lead(T.shopHtml(0));
  ok(/aria-label="왕 — 물 선택됨"/.test(h)&&/aria-pressed="true" aria-label="왕 물"/.test(h),"K21 선택 = aria-pressed(금색 테두리) · 이름은 접근성 이름에");
  ok(/\.leadRow button\[aria-pressed="true"\]\{[^}]*border:3px solid var\(--gold1\)/.test(css),"K22 선택 테두리 CSS");
  /* 역할 그림 — 아는 역할만 · 모르면 공용 */
  const a0=S.pieces.filter(x=>x.owner===0&&x.type==="ally"), a1=S.pieces.find(x=>x.owner===1&&x.type==="ally"&&x.allyKind==="shield");
  eq(a0.map(x=>T.ui238.allyRole(x)).sort(),["assassin","shield"],"K23 내 동료 역할 = 소유자 값");
  a1.skills=["SH-1","SH-2-fire"]; a1.revealedSkills=[];
  eq(T.ui238.allyRole(a1),null,"K24 상대 동료는 기술이 공개되기 전 역할을 모른다(allyKind·id 로 추정하지 않는다)");
  a1.revealedSkills=[0]; eq(T.ui238.allyRole(a1),"shield","K25 공개된 기술로 드러난 역할만 쓴다");
  T.ART.loaded.clear(); T.ART.failed.clear();
  T.ART.loaded.add("companion/"+T.LEADER_FILES.icon);
  ok(/leaders\/companion\/icon64/.test(T.pcFaceHtml(a0[0])),"K26 역할 그림이 아직이면 공용 companion 으로 내려간다");
  for(const d of ["companion_atk","companion_def"]) T.ART.loaded.add(d+"/"+T.LEADER_FILES.icon);
  const as=a0.find(x=>x.allyKind==="assassin");
  ok(/leaders\/companion_atk\/icon64/.test(T.pcFaceHtml(as))&&/leaders\/companion_def\/icon64/.test(T.pcFaceHtml(a1)),"K27 공격·방어 동료 전용 그림(아는 역할)");
  a1.revealedSkills=[]; ok(/leaders\/companion\/icon64/.test(T.pcFaceHtml(a1)),"K28 모르는 상대 동료 = 공용 그림");
  ok(/leaders\/companion_atk\/icon64/.test(lead(T.shopHtml(0))),"K29 S01 카드 = 말 그림");
  eq(T.LEADER_DIRS,["king","companion","companion_atk","companion_def"],"K30 고정 프리로드 집합(정체와 무관한 닫힌 목록)");
  T.ART.loaded.clear();
  /* 5 전투 우상단 · 6 시너지 안내 */
  const ui=fs.readFileSync(path.join(path.dirname(htmlPath),"js","ui.js"),"utf8");
  ok(/class="bhead"><h2[^\n]*<\/h2>\$\{mySide==="A"\?battleSynChips\(B\.attP\.owner,B\.fa,B\):battleSynChips\(B\.defP\.owner,B\.fd,B\)\}<\/div>/.test(ui)&&!/fscroll">\$\{battleSynChips/.test(ui),"K31 시너지 칩은 전투창 제목 줄 오른쪽 · HP 카드 문장 삭제");
  const U=T.ui238;
  eq([U.synTier("fire",1),U.synTier("fire",5),U.synTier("fire",9),U.synTier("def",6),U.synTier("std",6),U.synTier("atk",1)],[-1,1,3,3,4,-1],"K32 단계 경계 = V2_KINGDOM_STEPS · V2_ARCH_STEPS(배열 길이 상한)");
  const fk=T.V2_KINGDOM_STAGES.fire[1], st=T.V2_ARCH_SYN.std[0];
  eq(U.synTierText("fire",fk),`화상 ${Math.round(fk.p*100)}% 확률 · 라운드마다 최대 HP ${Math.round(fk.mag*100)}% 피해 · ${fk.rounds}라운드`,"K33 왕국 효과 문장 = 원본 표 값");
  eq(U.synTierText("std",st),`공격력 +${Math.round(st.atk*100)}% · 방어력 +${st.def} · 속도 +${st.spd}`,"K34 아키타입 효과 문장 = 원본 표 값");
  const host=T.byId("app"), n0=host.children.length; U.synHelp("def",6,null);
  const d=U.SYNHELP.el;
  ok(!!d&&host.children.length===n0+1&&(d.innerHTML.match(/<li/g)||[]).length===T.V2_ARCH_SYN.def.length&&/<li class="on" aria-current="true"><b>\(5\)<\/b>/.test(d.innerHTML)&&/지금 6칸/.test(d.innerHTML),"K35 안내 = 모든 단계 + 달성 단계 강조(방어 6칸 → 상한 (5))");
  U.synHelp("fire",0,null); ok(host.children.length===n0+1&&/\(2\)부터 효과/.test(U.SYNHELP.el.innerHTML),"K36 다시 열면 하나만 · 미달 안내");
  ok(/role="button" tabindex="0"[^>]*onkeydown="if\(event\.key==='Enter'\|\|event\.key===' '\)/.test(T.shopHtml(0))&&!/uiSynWhy|id="synWhy"/.test(ui),"K37 칩 = 누르기·터치·Enter/Space (정지 fieldset 안에서도 읽기 전용 안내) · 옛 한 줄 안내 대체");
  /* Saturn REVISE(2026-09-28) 1~4: 👑 죽은 동료 안내 · 결과 칩 44 · 감전 효과 · 방 만들기 창 폭 */
  const sh0=S.eco.shop; S.eco.shop=Object.assign({},sh0,{kind:"turn",turn:20}); a0[0].alive=false;
  h=T.shopHtml(0); S.eco.shop=sh0; a0[0].alive=true;
  ok(/aria-label="죽은 동료 1\/2[^"]*— 효과 보기"[^>]*onclick="synHelp\('crown',1,this\)" onkeydown="if\(event\.key==='Enter'\|\|event\.key===' '\)/.test(h),"K39 일반 상점 👑 = 같은 synHelp 칩(누르기·Enter/Space · 44px .synChip)");
  U.synHelp("crown",1,null); const ch=U.SYNHELP.el.innerHTML, R=T.SKILLS["LD-REVENGE"], W=T.SKILLS["LD-WRATH"];
  ok((ch.match(/<li/g)||[]).length===2&&/<li class="on" aria-current="true"><b>\(1\)<\/b> 🪄 동료의 복수 — 위력 220% · 쿨타임 2 · 사용자 속성 왕국의 효과를/.test(ch)&&ch.includes(`위력 ${W.pct}% · 쿨타임 ${W.cd}`)&&R.pct===220&&W.pct===280&&/지금 1명/.test(ch),"K40 👑 안내 = 원본 SKILLS 1명 220%·2명 280% · 쿨 2 · 왕국 효과");
  ok(T.V2_KINGDOM_STAGES.lightning.every(t=>U.synTierText("lightning",t)===`감전 ${Math.round(t.p*100)}% 확률 · 대상은 다음 ${t.rounds}라운드 후공(상대보다 나중에 행동)`),"K41 번개 전 단계 = 감전이 하는 일(후공) · 원본 확률");
  ok(!/\.resultSeat \.synChip\{[^}]*min-(height|width)/.test(css)&&/\.synChip\{min-width:44px; min-height:44px;/.test(css)&&/\.roomsScreen \.roomCreate \.histCard\{width:min\(480px,100%\);\}/.test(css),"K42 결과 칩 44×44 유지 · 방 만들기 창 = 뷰포트 − 32");
  /* 7 공용 팝업 */
  ok(/\.overlay \.box:not\(\.battleBox\)\{background:linear-gradient\(180deg,#132a5c,#0b1a3c\)/.test(css)&&/\.overlay \.box:not\(\.battleBox\) #obBtns button:first-child\{background:linear-gradient\(180deg,var\(--gold1\)/.test(css),"K38 공용 팝업 = 남색·파랑·금색 (전투창 제외)");
}
/* ===== L. 2026-09-28 CJ 최신 3 — 참가자가 나가면 방장은 빈 대기방(Jupiter 계약: OPEN · phase 'setup' · players[1]=null) ===== */
{
  const T=H.load(htmlPath), N=T.NET;
  T.startMode("pvp"); T.S.eco=null;
  Object.assign(N,{publicMode:true,economy:true,started:false,roomId:7,roomName:"adw",me:0,players:["창조","test"],reps:["M-F1","M-W1"],roomState:"WAITING",peerConnected:true,revision:5,
    lobby:{guestReady:true,countdownMs:4000,peerInResult:false,at:Date.now()}});
  const OPEN=(rev,round)=>({state:"OPEN",phase:"setup",revision:rev,round,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,economy:true});
  T.netApplyRoomState(OPEN(6,0));
  let w=T.rooms.lobbyWaitHtml();
  ok(T.ui238.uiScreenName()==="room"&&N.lobby===null&&N.roomState==="OPEN"&&/입장 대기/.test(w)&&!/test|M-W1/.test(w)&&!/netLobbyStart|netLobbyReady|초 뒤 시작/.test(w)&&/상대를 기다리는 중/.test(w)&&/netLeaveRoom\(\)/.test(w),
    "L1 준비·카운트다운 중 참가자가 나가면 방장은 같은 방의 빈 대기방(준비·5초 해제 · 상대 이름·그림 없음)");
  N.players=["창조","new"]; N.reps=["M-F1","M-G1"]; N.peerConnected=true;
  T.netApplyRoomState({state:"WAITING",phase:"waiting",revision:7,round:0,seats:{ready:[false,false]},units:[],you:{placed:false},result:null,economy:true,lobby:{guestReady:false,countdownMs:null,peerInResult:false}});
  w=T.rooms.lobbyWaitHtml();
  ok(T.ui238.uiScreenName()==="room"&&/new/.test(w)&&/준비 전/.test(w)&&/disabled onclick="lobbyWaitSend\(netLobbyStart\)"/.test(w),"L2 새 참가자 입장 → 다시 두 사람 대기방(준비 → 시작 흐름 그대로)");
  /* 결과에서 참가자가 먼저 복귀·이탈 → 방장은 결과 유지 → 방장 복귀 응답 OPEN = 빈 대기방 */
  Object.assign(N,{started:true,mode:true,roomState:"FINISHED",players:["창조","new"],result:{winner:0},final:{units:[]}}); T.S.phase="over";
  T.netApplyRoomState(OPEN(9,1));
  w=T.rooms.lobbyWaitHtml();
  ok(!N.started&&N.result===null&&N.final===null&&T.S.phase==="setup"&&T.ui238.uiScreenName()==="room"&&N.players[1]===null&&!/new/.test(w),"L3 방장 복귀 응답 OPEN → 경기별 상태를 비운 빈 대기방(옛 상대 이름 없음)");
}
/* ===== M. 2026-09-28 CJ 추가 — 방 찾기 위 멀티 접속 인원(lobby_rooms.onlineCount · 서버 집계 그대로) ===== */
{
  const T=H.load(htmlPath), N=T.NET, L=T.LOBBY;
  T.startMode("pvp"); T.S.phase="menu"; T.UI.entered=true; L.gen=1; L.view="rooms"; L.prof="off"; L.assets=[{state:"ok"},{state:"ok"}];
  N.ws={readyState:1,send(){},close(){}}; N.lobbyOnly=true;
  const badge=()=>{ const h=T.rooms.lobbyRoomsHtml(); return h.slice(h.indexOf('id="roomsOnline"'),h.indexOf("</span></span>",h.indexOf('id="roomsOnline"'))); };
  ok(/<b aria-hidden="true">—<\/b>/.test(badge())&&/멀티 접속 확인 불가/.test(badge()),"M1 받기 전 — (0 으로 꾸미지 않는다)");
  T.netHandlePublicMessage({type:"lobby_rooms",rooms:[],onlineCount:7});
  const head=T.rooms.lobbyRoomsHtml().slice(0,T.rooms.lobbyRoomsHtml().indexOf("roomSearch"));
  ok(N.online===7&&/<b aria-hidden="true">7<\/b>/.test(badge())&&/멀티 접속 7명/.test(badge())&&/gi" style="--i:3"/.test(badge())&&/class="roomsHead">[\s\S]*lobbyHome\(\)[\s\S]*id="roomsTitle"[\s\S]*id="roomsOnline"/.test(head)&&/멀티 접속 7명/.test(T.byId("roomsOnline").innerHTML),
    "M2 서버 숫자 그대로 · 팀 아이콘 + 숫자 · ← 제목 뒤 · 목록 갱신 때 헤더도 갱신");
  for(const bad of [-1,1.5,"7",null,NaN,2**60]){ T.netHandlePublicMessage({type:"lobby_rooms",rooms:[],onlineCount:bad}); if(N.online!==null) ok(false,"M3 이상값 "+bad); }
  T.netHandlePublicMessage({type:"lobby_rooms",rooms:[]});
  ok(N.online===null&&/—/.test(badge()),"M3 없는 필드(옛 서버)·음수·소수·문자열·null·NaN·과대값 = —");
  T.netHandlePublicMessage({type:"lobby_rooms",rooms:[],onlineCount:3}); N.ws.readyState=3;
  ok(/—/.test(badge()),"M4 로비 소켓이 끊기면 옛 숫자를 보이지 않는다");
  T.netHandlePublicSocketClosed({code:1006});
  ok(N.online===null,"M5 소켓 종료 시 숫자 비움 → 재접속 lobby_ready 뒤 첫 목록까지 —");
  N.online=4; N.ws={readyState:1,send(){},close(){}}; T.netHandlePublicMessage({type:"lobby_ready"});
  ok(N.online===null,"M6 새 로비 소켓(lobby_ready) = 첫 목록 전까지 —");
  ok(/\.roomsOnline\{flex:0 0 auto;/.test(css),"M7 헤더 한 줄(← · 제목 · 인원)");
}
console.log(`smoke_issue238: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
