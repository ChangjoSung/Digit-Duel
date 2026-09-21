"use strict";
/* ===== 모달·핸드오프 ===== */
/* #11·#36 추측 메모 UI 상태 (게임 상태 S와 분리) — btns/piece: 테스트·포커스용.
   #94 token: 지금 오버레이를 소유한 메모 피커의 토큰(다른 modal()/close()가 오면 null) · seq: 피커 발급 번호 · overlayOpen: 오버레이 표시 여부 */
const MEMO_UI={btns:[],piece:null,token:null,seq:0,overlayOpen:false};
function modal(html,buttons){
  MEMO_UI.token=null; MEMO_UI.overlayOpen=true; // #94 새 모달이 오버레이를 가져간다 — 열려 있던 메모 피커 콜백은 무효
  UI.ask=null; if(UI.hold) aiHoldRelease();      // #122 REVISE: 뒤로가기 확인창도 함께 무효 (옛 버튼이 새 창을 닫지 못한다) · 확인창이 사라졌으면 AI 보류도 푼다
  try{ const ob0=$("overlayBox"); if(ob0&&ob0.classList) ob0.classList.remove("battleBox"); }catch(e){} // #122 전투 화면 전용 레이아웃 클래스 해제
  $("overlayBox").innerHTML=html+`<div class="row" id="obBtns"></div>`;
  const ob=$("obBtns");
  /* 버튼 튜플은 [문구, 콜백] 또는 [문구, 콜백, disabled] 다. Saturn REVISE P2: "선택 불가"를 문구로만 알리지 않고
     실제 disabled 를 건다 — 키보드·스크린리더·중복 클릭·동기화 중계 모두에서 같은 의미가 된다.
     disabled 버튼은 콜백을 걸지 않으므로 온라인 인덱스 중계로도 눌릴 수 없다. */
  for(const [txt,fn,dis] of buttons){const b=document.createElement("button"); b.textContent=txt;
    if(dis){ b.disabled=true; b.setAttribute("aria-disabled","true"); }
    else b.onclick=()=>{ if(fxLocked()) return; fn(); };
    b.className="primary"; ob.appendChild(b);} // #106: 연출 잠금 중 모달 버튼 무시
  $("overlay").classList.remove("hidden");
}
function close(){MEMO_UI.token=null; MEMO_UI.overlayOpen=false; $("overlay").classList.add("hidden");
  if(UI.ask){ UI.ask=null; if(UI.hold) aiHoldRelease(); } } // #122 REVISE: 다른 경로로 확인창이 닫혀도 AI 보류가 남지 않는다
/* #11·#36 추측 메모: 게임 중 정체 미공개 상대 말 클릭(전투 지정 경로 외) → 8종 이모지 피커 — 뷰어(PVE:0 / PVP:현재 플레이어)별 비공개, 인메모리만(로그·영구 저장 없음)
   #94 상대 턴·AI 턴에도 뷰어가 고정된 모드(온라인 NET.me · PVE 0)에서는 로컬로 연다 — 진입은 onCell → memoClickTarget (네트워크·RNG·selected·게임 로그 무변화) */
function memoSet(v,pid,key){ // key: MEMO_OPTS 키 또는 null(삭제). 그 외 값은 무시 — 상대 말·게임 중에만
  const pc=S.pieces.find(x=>x.id===pid); if(!pc||pc.owner===v||(v!==0&&v!==1)) return false;
  if(key===null||key===undefined){ delete S.memos[v][pid]; return true; }
  if(!memoOpt(key)) return false;
  S.memos[v][pid]=key; return true;
}
/* #94 메모 대상 자격 — 살아 있고 배치된, 미공개, 뷰어가 볼 수 있는 상대 말 (죽은 말·비가시·자기 말·공개된 말은 불가) */
function memoTargetOk(v,pc){ return !!pc&&pc.alive&&pc.placed&&!pc.revealed&&pc.owner!==v&&visibleTo(v,pc); }
/* #94 이 셀 클릭이 "순수 로컬 메모"인가 — 맞으면 대상 말, 아니면 null(현행 netAction 경로 그대로).
   (a) 상대 턴·AI 턴 — 뷰어 고정 모드(온라인 NET.me · PVE 0)에서 뷰어가 볼 수 있는 상대 말. 공개된 말도 여기로 와서 memoModal의 기존 안내 토스트를 받는다.
       핫시트 PVP는 뷰어=현재 플레이어라 "상대 턴"이 없다(상대 메모 세트 오염 방지) · sim은 대상 아님.
   (b) 자기 턴 — onCellCore의 우선순위(강제 전투 대상 → 텔레포트 → 자기 말 선택 → 인접 전투 지정)를 그대로 흉내 내어,
       원래 memoModal 분기에 도달할 클릭만 로컬 처리(송신 0). 이동·전투·탐색·텔레포트 권한 가드는 건드리지 않는다.
   오버레이가 열려 있으면(전투 모달·상대 선택 대기·이미 열린 피커) 로컬 분기를 쓰지 않는다 — 원격 모달 권한·대기 큐를 가리지 않는다. */
function memoClickTarget(r,c){
  if(!S||S.phase!=="play"||S.battle||NET.replaying||MEMO_UI.overlayOpen) return null;
  if(fxLocked()) return null; // #106 3.2: 배너·연출 잠금 중에는 메모 피커도 열지 않는다 (잠금이 풀리면 종전대로)
  const v=humanViewer(); if(v!==0&&v!==1) return null;
  const p=at(r,c); if(!p||p.owner===v||!visibleTo(v,p)) return null;
  if(S.fleePick) return (NET.mode&&S.fleePick.owner!==NET.me)?p:null; // #114 도망 교환 선택 중: 소유자 클릭은 규칙 경로(cell 액션), 온라인 대기자는 로컬 메모만
  const myTurn=NET.mode?netActor()===NET.me:!isAI(S.current);
  if(!myTurn) return (NET.mode||S.mode==="pve")?p:null; // (a)
  if(S.teleport) return null;
  if(forcedPickOk(p)) return null;
  if(p.owner===S.current) return null;
  const s=S.selected&&!S.selected.tray?S.selected:null;
  if(s&&adj(s,p)&&canBattle(s,p)) return null;
  return p; // (b)
}
function memoModal(pc){
  if(S.phase!=="play"||!pc) return;
  if(NET.replaying) return; // 온라인: 상대 클릭 재생 시 내 메모 팝업 금지 (메모는 뷰어 전용·비동기화)
  const v=humanViewer();
  if(pc.owner===v) return;
  if(!pc.alive||!pc.placed||!visibleTo(v,pc)) return; // #94 죽은 말·비가시 말은 대상이 아니다
  if(pc.revealed){ showToast(`이미 공개된 말: ${idLabel(v,pc)}`); return; } // 실제 정체가 우선 — 추측 불필요
  const cur=S.memos[v][pc.id]||null;
  /* #94 오래된 콜백 무효: 이 피커의 토큰이 오버레이 소유권을 잃었거나(다른 모달·close·새 게임) 대상이 공개·사망·비가시가 되면
     저장·삭제·닫기 콜백은 메모 세트를 바꾸지 않는다. 소유권을 잃은 경우에는 close()·render()도 하지 않는다 — 새 모달(전투·상대 선택 대기)을 가리지 않는다. */
  const tk={game:S,piece:pc.id,viewer:v,seq:++MEMO_UI.seq};
  const live=()=>MEMO_UI.token===tk&&S===tk.game;
  const commit=key=>{ if(!live()) return; MEMO_UI.token=null;
    const cur2=S.pieces.find(x=>x.id===pc.id);
    if(S.phase==="play"&&memoTargetOk(v,cur2)) memoSet(v,pc.id,key); else showToast("대상 말의 상태가 바뀌어 추측을 적용하지 않았습니다.");
    close(); render(); };
  const dismiss=()=>{ if(!live()) return; MEMO_UI.token=null; close(); };
  netLocalModal(); // 메모 피커는 로컬 전용 모달
  modal(`<h2>📝 정체 추측 — ? (${pc.r}행 ${pc.c}열)</h2>
    <small>이 물음표 말이 무엇일지 골라 두세요. 나만 보이는 메모이며 상대·AI에게는 보이지 않아요.</small>
    <div class="memo-grid" id="memoOpts" role="group" aria-label="정체 추측 선택"></div>`,
    [["추측 삭제",()=>commit(null)],["닫기",dismiss]]);
  MEMO_UI.token=tk; // modal()이 토큰을 비운 뒤에 이 피커가 오버레이를 소유한다
  const grid=$("memoOpts"); MEMO_UI.btns=[]; MEMO_UI.piece=pc.id;
  for(const o of MEMO_OPTS){
    /* #201 후속: 추측 격자의 기호도 보드와 **같은 도형**을 쓴다 — 한쪽만 이모지/글자로 갈라지지 않는다 (기존 aria-label 문구는 그대로) */
    const b=document.createElement("button"); b.className="memo-opt";
    b.innerHTML=`<span class="ico${SYM_SVG[o.key]?" sv":""}" aria-hidden="true">${SYM_SVG[o.key]?symSvgHtml(o.key):o.emoji}</span><span>${o.ko}</span>`;
    b.setAttribute("type","button"); b.setAttribute("aria-label",`${o.ko} ${o.emoji} 추측`); b.setAttribute("aria-pressed",o.key===cur?"true":"false"); b.dataset.key=o.key;
    b.onclick=()=>commit(o.key);
    grid.appendChild(b); MEMO_UI.btns.push(b);
  }
  const del=/** @type {any} */($("obBtns").children[0]); if(del) del.disabled=!cur;
  const focusTo=MEMO_UI.btns.find(b=>b.dataset.key===cur)||MEMO_UI.btns[0]; try{ if(focusTo) focusTo.focus(); }catch(e){}
}
function handoff(title,after){
  if(NET.mode){after();return;} // 온라인: 기기 넘김 불필요 — 즉시 진행
  clearToasts();
  modal(`<h2>🔄 기기를 넘기세요</h2><p style="margin:10px 0">${title}</p><small>상대는 화면을 보지 마세요.</small>`,
    [["확인 — 시작",()=>{close();after();}]]);
}

/* ===== #26·#32·#42 첫 플레이어용 ELI5 튜토리얼 — 게임 상태 S와 완전 분리 (TUT) ·
   #128(2026-09-10 CJ 승인): 자동 표시는 **문서 로드당 1회**다. 영구 저장을 아예 보지 않는다 — 읽지도 쓰지도 않는다.
   그래서 새 탭·새 창·새로고침·브라우저 재실행·서버 재시작 후 새 접속은 매번 1단계부터 뜨고,
   같은 문서 안의 새 게임·재대전·모드 변경·WS 재연결·백그라운드 복귀·BFCache 복원은 스크립트를 다시 돌리지 않으므로 추가로 뜨지 않는다.
   과거 키 "tutorialSeen"은 무시한다 — 남아 있어도 표시 정책에 영향이 없고, 제품이 지우지도 않는다(사용자 저장값 보존).
   게임 내부 모달(#tutOverlay, 외부 서버·창·이미지 없음) · 10단계 한 화면 한 개념 · 단계마다 (1)~(n) 독립 카드(번호·제목·그림·결과·설명, #42 DOM 블록 구조) ·
   상황 도움말(텔레포트·버닝 타임)은 첫 발생 시 1회, 게임 상태 무변경 ===== */
/* #42 장면 도우미 — 카드 안의 '그림'만 만든다. 공간 도형(미니 보드·화살표·토큰·HP 막대)은 소형 인라인 SVG, 나머지 텍스트·목록·흐름은 DOM 조각.
   SVG <text>에는 이모지·기호만 넣고(한글·숫자 금지) 모든 문장은 DOM으로 렌더링해 자연 줄바꿈된다. DOM·canvas·네트워크·외부 리소스 없음 */
const TSV={
  C:{own:"#2f3a5e",op:"#5e2f3a",forest:"#23422f",mid:"#2b3140",line:"#3d475e",txt:"#e8ecf5",dim:"#9aa3b8",acc:"#5b8cff",bad:"#ff5b6e",ok:"#4fd88a",gold:"#ffd84d"},
  esc:s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/"/g,"&quot;"),
  /* --- SVG 조각 (viewBox는 각 그림 크기, preserveAspectRatio meet로 카드 폭·높이에 맞춰 축소만 됨 → 잘림 없음) --- */
  svg(w,h,alt,body,cls){ return `<svg class="${cls||"tut-fig"}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${TSV.esc(alt)}" focusable="false">${body}</svg>`; },
  g(x,y,s,fs,col){ return `<text x="${x}" y="${y}" font-size="${fs||13}" fill="${col||TSV.C.txt}" text-anchor="middle" dominant-baseline="middle">${s}</text>`; }, // 이모지·기호 글리프 전용
  cell(x,y,k,s,o){ s=s||22; return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="3" fill="${TSV.C[k||"mid"]}" stroke="${o&&o.st||TSV.C.line}"${o&&o.sw?` stroke-width="${o.sw}"`:""}/>`; },
  grid(x,y,cols,rows,kf,s){ s=s||22; let o=""; for(let r=0;r<rows;r++) for(let c=0;c<cols;c++) o+=TSV.cell(x+c*s,y+r*s,kf?kf(r,c):"mid",s); return o; },
  tok(cx,cy,g,side,r){ r=r||9; const f=side==="op"||side==="opghost"?"#7a3644":side==="hid"?"#3a4152":"#3a4a80"; const st=side==="me"||side==="ghost"?"#dfe6ff":"#0008";
    const dash=/ghost/.test(side)?' stroke-dasharray="3 2" opacity=".55"':""; return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" stroke="${st}" stroke-width="1.5"${dash}/>`+TSV.g(cx,cy+0.5,g,Math.max(10,Math.round(r*1.1))); },
  arrow(x1,y1,x2,y2,col,w,dash){ col=col||TSV.C.acc; w=w||2; const a=Math.atan2(y2-y1,x2-x1), h=6; const hx=x2-Math.cos(a)*h, hy=y2-Math.sin(a)*h;
    const p1=[hx+Math.sin(a)*4,hy-Math.cos(a)*4], p2=[hx-Math.sin(a)*4,hy+Math.cos(a)*4];
    return `<line x1="${x1}" y1="${y1}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="${col}" stroke-width="${w}"${dash?' stroke-dasharray="4 3"':""}/><polygon points="${x2},${y2} ${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}" fill="${col}"/>`; },
  x(cx,cy,r,col){ r=r||6; col=col||TSV.C.bad; return `<line x1="${cx-r}" y1="${cy-r}" x2="${cx+r}" y2="${cy+r}" stroke="${col}" stroke-width="2.5"/><line x1="${cx-r}" y1="${cy+r}" x2="${cx+r}" y2="${cy-r}" stroke="${col}" stroke-width="2.5"/>`; },
  hp(x,y,w,p,col){ return `<rect x="${x}" y="${y}" width="${w}" height="7" rx="3" fill="#333"/><rect x="${x}" y="${y}" width="${Math.round(w*p)}" height="7" rx="3" fill="${col||TSV.C.ok}"/>`; },
  /* --- DOM 조각 --- */
  dtok(g,side,sm){ return `<span class="tut-tok ${side}${sm?" sm":""}">${g}</span>`; },
  ico(g,side,alt,xed){ return TSV.svg(28,28,alt,TSV.tok(14,14,g,side,11)+(xed?TSV.x(14,14,8):""),"tut-ico"); }, // 엑스 표시가 필요한 토큰만 소형 SVG
  arr(col){ col=col||TSV.C.acc; return `<svg class="tut-arr" viewBox="0 0 24 12" aria-hidden="true" focusable="false">${TSV.arrow(1,6,23,6,col,2)}</svg>`; },
  lbl(s,cls){ return `<span class="tut-lbl${cls?" "+cls:""}">${s}</span>`; },
  pill(s,cls){ return `<span class="tut-pill${cls?" "+cls:""}">${s}</span>`; },
  row(){ return `<div class="tut-row">${Array.prototype.join.call(arguments,"")}</div>`; },
  stack(){ return `<div class="tut-stack">${Array.prototype.join.call(arguments,"")}</div>`; },
  dhp(p,cls){ return `<span class="tut-hp${cls?" "+cls:""}" aria-hidden="true"><i style="width:${Math.round(p*100)}%"></i></span>`; }
};
/* #42 단계별 카드 목록 — 카드 = {t:제목, vis:그림(HTML 조각), res:결과 한 줄(선택), tone:ok|bad(선택)}. 설명 문장은 TUT_STEPS.lines[k]가 k번 카드에 1:1로 붙는다 */
const TUT_SCENES={
  win(){ const C=TSV.C;
    const g1=TSV.grid(2,2,3,3,()=>"op")+TSV.tok(35,57,"⚔","me")+TSV.tok(35,13,"👑","op")+TSV.arrow(35,45,35,25)+TSV.x(35,13,7);
    const g2=TSV.grid(2,2,3,3,()=>"op")+`<rect x="2" y="2" width="66" height="22" rx="3" fill="none" stroke="${C.gold}" stroke-width="2"/>`+TSV.tok(35,57,"👑","me")+TSV.tok(35,13,"👑","ghost")+TSV.arrow(35,45,35,25);
    let g3=""; [0,1,2,3].forEach(i=>{ const x=12+i*24; g3+=TSV.tok(x,12,"⚔","op")+TSV.x(x,12,7)+TSV.tok(x,38,i<2?"⚔":"🤝","op")+TSV.x(x,38,7); });
    return [
      {t:"상대 왕 잡기",vis:TSV.svg(70,70,"내 하수인이 상대 진영의 상대 왕을 공격해 지우는 장면",g1),res:"왕을 잡으면 승리",tone:"ok"},
      {t:"내 왕이 끝줄 닿기",vis:TSV.svg(70,70,"내 왕이 상대편 맨 끝줄(금색 테두리 줄)까지 올라가 서는 장면",g2),res:"맨 끝줄에 서면 승리 · 밀려서 닿아도 승리",tone:"ok"},
      {t:"싸우는 말 전멸",vis:TSV.svg(96,50,"상대의 하수인 6개와 동료 2개가 모두 엑스 표시로 지워진 장면",g3),res:"하수인 6 + 동료 2 모두 없애면 승리",tone:"ok"}]; },
  pieces(){
    /** @type {[string,number,string][]} */
    const rows=[["하수인",6,"⚔"],["동료",2,"🤝"],["왕",1,"👑"],["폭탄",3,"💣"],["함정",2,"🪤"]];
    const list=hid=>`<div class="tut-plist">`+rows.map(r=>`<span class="tut-lbl">${r[0]} ${r[1]}</span><span class="tut-toks">${Array.from({length:r[1]},()=>TSV.dtok(hid?"?":r[2],hid?"hid":"me",1)).join("")}</span>`).join("")+`</div>`;
    return [
      {t:"내 눈: 내 말 14개",vis:list(false),res:"종류별로 다 보여요"},
      {t:"상대 눈: 전부 ?",vis:TSV.row(TSV.lbl("👁 상대가 보면"))+list(true),res:"상대에겐 전부 물음표"},
      {t:"싸우면 정체 공개",vis:TSV.row(TSV.dtok("?","hid"),TSV.lbl("⚔ 싸움","bad"),TSV.arr(),TSV.dtok("⚔","me")),res:"싸우고 나면 정체가 드러나요"}]; },
  move(){ const C=TSV.C;
    let g1=TSV.grid(12,12,3,3)+TSV.tok(45,45,"⚔","me")+TSV.arrow(45,34,45,18)+TSV.arrow(45,56,45,72)+TSV.arrow(34,45,18,45)+TSV.arrow(56,45,72,45);
    [[23,23],[67,23],[23,67],[67,67]].forEach(p=>{ g1+=TSV.x(p[0],p[1],3.5); });
    const g2=TSV.grid(2,2,3,1,()=>"forest")+TSV.tok(13,13,"⚔","ghost")+TSV.tok(95,13,"?","op")+TSV.g(52,13,"🙈",12)
      +TSV.grid(2,32,3,1,()=>"forest")+TSV.tok(13,43,"⚔","me")+TSV.tok(35,43,"?","op")+TSV.g(72,43,"👁",12);
    const g3=TSV.grid(2,14,3,1,()=>"forest")+TSV.tok(13,25,"⚔","ghost")+TSV.arrow(21,25,27,25)+TSV.tok(35,25,"⚔","me")+TSV.tok(57,25,"?","op")+TSV.g(46,7,"💥",12);
    return [
      {t:"한 칸 이동",vis:TSV.svg(90,90,"내 말에서 위, 아래, 왼쪽, 오른쪽 한 칸으로 화살표가 나가고 대각선 네 방향에는 엑스 표시",g1),res:"위·아래·옆만 · 대각선 ✗"},
      {t:"숲에 숨기",vis:TSV.svg(110,56,"숲 칸의 내 말이 멀리 있는 상대에게는 흐리게 숨겨지고, 상대가 바로 옆에 오면 또렷하게 보이는 두 장면",g2),res:"멀면 안 보임 🙈 · 옆이면 보임 👁 · 떨어지면 다시 숨어요"},
      {t:"숨은 말 충돌",vis:TSV.svg(70,56,"내 말이 숨은 상대 말이 있는 숲 칸으로 가다 부딪혀 그 앞 칸에 멈추고 둘 다 공개되는 장면",'<g transform="translate(0 6)">'+g3+'</g>'),res:"앞 칸에 멈춤 · 둘 다 공개 👁 (이번 차례만)"}]; },
  search(){ const C=TSV.C;
    const g1=TSV.grid(2,12,3,1,()=>"forest")+TSV.tok(13,23,"⚔","ghost")+TSV.arrow(22,23,26,23)+TSV.tok(35,23,"⚔","me")+TSV.g(51,13,"🔍",11);
    const g2=TSV.cell(2,8,"forest")+TSV.tok(13,19,"⚔","me")+TSV.g(30,11,"🔍",11);
    /* #121 계약 1.1: 숲마다 선물 3종이 각 1개 — 보드 전체 6개. 종류는 고정이고 칸만 무작위다 */
    const gifts=[["🎁","아이템 선물"],["✨","전투 버프"],["📘","기술 교체·포획"]];
    return [
      {t:"이번 차례: 흔적 발견",vis:TSV.svg(70,46,"내 말이 숲 칸에 서자 돋보기 흔적 표시가 뜨는 장면",g1),res:"말이 서면 🔍 흔적 표시"},
      {t:"다음 차례: 탐색",vis:TSV.row(TSV.svg(44,36,"흔적 표시가 있는 숲 칸 위의 내 말",g2,"tut-ico lg"),TSV.pill("탐색","acc"),TSV.arr(),`<span class="tut-big">🎁</span>`),res:"버튼 → 선물 · 고르기를 마치면 바로 턴이 끝나요"},
      {t:"탐색 가능한 말",vis:TSV.row(TSV.dtok("⚔","me",1),TSV.dtok("🤝","me",1),TSV.dtok("👑","me",1),TSV.lbl("✓","ok"),`<span class="tut-sep"></span>`,TSV.ico("💣","me","폭탄 토큰 위에 엑스 표시",1),TSV.ico("🪤","me","함정 토큰 위에 엑스 표시",1),TSV.lbl("못 해요","bad")),res:"폭탄·함정은 못 해요",tone:"bad"},
      {t:"선물 3가지 (숲마다 하나씩)",vis:`<div class="tut-gifts">${gifts.map(g=>`<div><span class="tut-big">${g[0]}</span><span>${g[1]}</span></div>`).join("")}</div>`,
       res:"🎁·✨ 는 전투 중 가방에서 개봉 · 📘 는 기술 3개 중 직접 골라 내 하수인 4칸 어디든 교체하거나 포획"}]; },
  battle(){ const C=TSV.C;
    const g1=TSV.grid(2,2,4,1)+TSV.tok(13,13,"⚔","me")+TSV.arrow(24,13,38,13)+TSV.tok(57,13,"?","op")
      +TSV.grid(2,34,4,1)+TSV.tok(35,45,"⚔","me")+TSV.tok(57,45,"?","op")+TSV.g(46,30,"⚔",11);
    const E=[["🔥",C.fire||"#ff7a4d",65,20],["🌿","#5fd06b",115,50],["⚡","#ffd84d",65,80],["💧","#4da3ff",15,50]];
    let g2=""; E.forEach(e=>{ g2+=`<circle cx="${e[2]}" cy="${e[3]}" r="13" fill="${e[1]}"/>`+TSV.g(e[2],e[3]+0.5,e[0],13); });
    g2+=TSV.arrow(76,28,104,43,C.txt)+TSV.arrow(107,62,76,75,C.txt)+TSV.arrow(54,75,23,62,C.txt)+TSV.arrow(24,40,54,26,C.txt);
    return [
      {t:"옆에 붙으면 강제 전투",vis:TSV.svg(90,58,"내 하수인이 한 칸 움직여 상대 물음표 말 바로 옆에 붙자 칼 표시와 함께 싸움이 시작되는 전후 장면",g1),res:"한 차례 싸움 최대 2번 ⚔⚔"},
      {t:"속성 가위바위보",vis:TSV.svg(130,100,"불, 풀, 번개, 물 네 원이 고리로 이어져 불은 풀을, 풀은 번개를, 번개는 물을, 물은 불을 이기는 화살표",g2),res:"🔥불 → 🌿풀 → ⚡번개 → 💧물 → 🔥불 순서로 이겨요"},
      {t:"싸움이 끝나면",vis:TSV.stack(TSV.row(TSV.dhp(0.6),TSV.lbl("HP 60 그대로","txt")),TSV.row(TSV.lbl("⏳ 쿨타임 그대로","txt")),TSV.row(`<span class="tut-strike">🔥 화상 · ☠ 약화</span>`,TSV.arr(),TSV.lbl("상태이상은 사라져요 ✓","ok"))),res:"HP·쿨타임 유지 · 상태이상 해제"},
      {t:"6라운드가 끝나면",vis:TSV.row(TSV.dhp(0.6),TSV.lbl("HP 60%","ok"),TSV.lbl("vs"),TSV.dhp(0.4,"bad"),TSV.lbl("HP 40%","bad"),TSV.arr(),TSV.lbl("60% 승 ✓","ok")),res:"남은 HP 비율이 높은 쪽 승리 · 같으면 지킨 쪽",tone:"ok"}, // #106 T6
      /* #122 REVISE(2026-09-10 CJ QA 1·6): #114 상황 8(동료·왕끼리는 밀기)과 왕 vs 왕 불가침이 **모두 폐지**됐다 */
      {t:"동료·왕끼리도 싸워요",vis:TSV.row(TSV.dtok("🤝","me",1),TSV.lbl("vs","txt"),TSV.dtok("🤝","op",1),TSV.arr(C.bad),TSV.lbl("배틀!","bad")),
        res:"동료↔동료 · 동료↔왕 · 왕↔왕 모두 배틀 · 왕 본체가 지면 그 자리에서 경기 패배"},
      /* #146: 4칸이 전부 못 쓰는 상태이면 기본 공격이 나오지 않는다는 새 규칙 */
      {t:"공격할 게 없을 때",vis:TSV.stack(TSV.row(TSV.pill("⏳"),TSV.pill("⏳"),TSV.pill("⏳"),TSV.pill("🔒"),TSV.arr(C.bad),TSV.lbl("공격 없음","bad")),
        TSV.row(TSV.lbl("기본 공격","bad"),TSV.arr(C.bad),TSV.lbl("나오지 않아요","bad")),TSV.row(TSV.pill("턴 종료","acc"),TSV.lbl("직접 눌러요"))),
       res:"누르기 전에는 저절로 진행되지 않아요 · 🎒 가방·🔴 포획·🏃 도망은 그대로 · 왕·동료 본체는 기본 공격 유지",tone:"bad"},
      /* #130: 보호막 합산 규칙 */
      {t:"보호막은 쌓여요",vis:TSV.stack(TSV.row(TSV.pill("🛡 18"),TSV.lbl("+"),TSV.pill("🛡 22"),TSV.arr(),TSV.lbl("🛡 40","ok")),
        TSV.row(TSV.pill("🛡 40"),TSV.lbl("−10"),TSV.arr(),TSV.pill("🛡 30"),TSV.lbl("+"),TSV.pill("🛡 22"),TSV.arr(),TSV.lbl("🛡 52","ok"))),
       res:"남은 보호막 + 새로 받은 보호막 · 10을 깎인 뒤 22를 더 받으면 52 · HP보다 먼저 깎여요",tone:"ok"}]; },
  bombtrap(){ const C=TSV.C;
    const g1=TSV.grid(2,2,3,1)+TSV.tok(13,13,"💣","me")+TSV.arrow(24,13,42,13)+TSV.grid(2,34,2,1)+TSV.tok(13,45,"🪤","me")+TSV.g(35,45,"🔒",12);
    const g2=TSV.tok(14,20,"⚔","me")+TSV.arrow(24,20,32,20,C.bad)+TSV.tok(44,20,"💣","op")+TSV.g(29,6,"💥",12)+TSV.x(14,20,7)+TSV.x(44,20,7)
      +TSV.tok(14,52,"👑","me")+TSV.arrow(24,52,32,52,C.bad)+TSV.tok(44,52,"💣","op")+TSV.g(29,38,"💥",12)+TSV.x(44,52,7)+TSV.g(64,52,"✓",12,C.ok);
    const g3=TSV.tok(14,20,"⚔","me")+TSV.arrow(24,20,32,20,C.bad)+TSV.tok(44,20,"🪤","op")+TSV.x(44,20,7)
      +TSV.tok(30,52,"⚔","me")+TSV.g(48,44,"🔒",13);
    return [
      {t:"움직임",vis:TSV.svg(70,64,"폭탄은 한 칸 화살표로 움직이고, 함정은 자물쇠로 스스로는 못 움직임",g1),res:"폭탄 1칸 (버닝 땐 2칸) · 함정은 스스로 못 움직여요"},
      {t:"폭탄을 건드리면",vis:TSV.svg(76,72,"하수인이 폭탄을 건드리면 둘 다 엑스로 사라지고, 왕이 건드리면 폭탄만 사라지고 왕은 살아남는 장면",'<g transform="translate(0 6)">'+g2+'</g>'),res:"하수인 ✗ 둘 다 사라짐 · 동료·왕 ✓ 살아남음 · 내 폭탄이 붙어도 펑 · 폭탄끼리·폭탄↔함정도 ✗ 둘 다 사라짐"},
      {t:"함정을 밟으면",vis:TSV.svg(76,66,"함정을 밟으면 함정이 사라지고 밟은 말은 자물쇠와 함께 정지하는 장면",g3),res:"함정 ✗ · 밟은 말은 내 차례 2번 정지 · 둘 다 정체 공개 · 밀리면 함정도 옮겨져요"}]; },
  capture(){ const C=TSV.C;
    const g1=TSV.tok(22,16,"⚔","op",11)+TSV.hp(4,32,36,0.25,C.bad);
    const g3=TSV.tok(22,16,"⚔","me",11)+TSV.hp(4,32,36,0.4,C.gold);
    return [
      {t:"볼 던지기: HP 30% 아래",vis:TSV.row(TSV.svg(44,44,"HP 막대가 25%까지 줄어든 상대 하수인",g1,"tut-ico lg"),TSV.lbl("HP 25%","bad"),`<span class="tut-big">🔴</span>`,TSV.arr(),TSV.lbl("성공률 70%","gold")),
       res:"상대 하수인 HP 30% 아래 → 몬스터볼 · 아이템은 한 라운드에 한 번"},
      {t:"결과: 둘 다 볼 −1",vis:TSV.stack(TSV.row(TSV.lbl("✓ 성공","ok"),TSV.pill("예비 HP 70/100","own")),TSV.row(TSV.lbl("✗ 실패","bad"),TSV.lbl("볼이 튕겨요")),TSV.row(TSV.pill("🔴 볼 −1"))),
       res:"성공·실패 모두 볼 1개 소모 · 숲 포획은 그 종 그대로 · ✨ 버프는 한 싸움에 하나"},
      {t:"도망: 언제든 가능",vis:TSV.row(TSV.svg(44,44,"HP 막대가 40%까지 줄어든 내 하수인",g3,"tut-ico lg"),TSV.lbl("HP 조건 없음","gold"),`<span class="tut-big">🏃</span>`,TSV.arr(),TSV.lbl("성공률 30%","gold"),TSV.lbl("✨ 쓰면 70%","ok")),res:"HP 조건 없음 · 기본 30% · 🏃 도망의 수호자를 쓰면 그 싸움 동안 70%"},
      {t:"도망 성공",vis:TSV.row(TSV.lbl("✓ 성공","ok"),TSV.dtok("⚔","me",1),TSV.lbl("⇄","txt"),TSV.dtok("💣","me",1),TSV.arr(),TSV.lbl("한 칸씩 밀기","txt")),res:"뒷말 고르기(생략 가능) → 교환 → 한 칸씩 밀기 · 싸움 횟수는 그대로",tone:"ok"},
      /* #122 REVISE(2026-09-10 CJ QA 2): 실패 페널티가 생겼다 — 상대의 기본 공격 1회 */
      {t:"도망 실패",vis:TSV.row(TSV.lbl("✗ 실패","bad"),TSV.dtok("⚔","op",1),TSV.arr(C.bad),TSV.lbl("기본 공격 1번","bad"),TSV.arr(),TSV.lbl("내 차례 한 번 지나가요","txt")),res:"상대의 <b>기본 공격 한 번</b>을 맞아요 · 그 뒤 상대는 자기 차례를 그대로 해요",tone:"bad"}]; },
  teleport(){ const C=TSV.C;
    const g1=TSV.grid(6,2,3,4,r=>r<3?"op":"forest",16)+TSV.tok(30,26,"⚔","me",7);
    const g2=TSV.cell(4,9)+TSV.cell(64,9)+TSV.tok(15,20,"💣","me")+TSV.tok(75,20,"⚔","me")+TSV.arrow(28,16,62,16)+TSV.arrow(62,24,28,24);
    const g3=TSV.tok(14,24,"⚔","me",8)+TSV.tok(34,24,"?","op",8)+TSV.g(24,9,"⚔",11)+TSV.tok(66,24,"🤝","me",8)+TSV.tok(86,24,"?","op",8)+TSV.g(76,9,"⚔",11);
    return [
      {t:"조건",vis:TSV.svg(60,70,"상대 땅 3줄 안에 내 말이 들어가 있는 장면",g1),res:"상대 땅에 내 말 → 🌀 켜짐 ✓",tone:"ok"},
      {t:"둘 자리 바꾸기",vis:TSV.svg(90,40,"내 폭탄과 내 하수인 두 말의 자리가 양방향 화살표로 바뀌는 장면",g2),res:"왕·폭탄·함정도 OK · 횟수 제한 없음 🌀 (한 차례에 주 행동 1개)"},
      {t:"각자 싸움",vis:TSV.svg(100,42,"바뀐 두 말이 각각 상대 옆에 붙어 따로 싸우는 장면",'<g transform="translate(0 2)">'+g3+'</g>')+TSV.row(TSV.pill("남은 싸움 부족","op"),TSV.lbl("🌀 ✗ 못 써요","bad")),res:"따로따로 싸워요"},
      /* #131: 함정에 걸려 멈춘 말은 양끝 어느 쪽으로도 고를 수 없다 */
      {t:"함정에 걸린 말은 ✗",vis:TSV.row(TSV.ico("⚔","me","함정에 걸려 멈춘 내 말 위에 엑스 표시",1),TSV.lbl("🪤 걸림","bad"),TSV.lbl("🌀","txt"),TSV.arr(C.bad),TSV.lbl("못 골라요","bad")),
       res:"먼저 고르는 말도, 바꿀 상대 말도 ✗ · 「함정에 걸린 하수인은 텔레포트를 사용할 수 없습니다」 · 고르던 단계는 그대로",tone:"bad"}]; },
  burning(){ const C=TSV.C;
    const g1=TSV.grid(2,2,1,3)+TSV.tok(13,57,"⚔","me")+TSV.arrow(13,46,13,8)+TSV.arrow(24,35,44,35,C.dim,2,1)+TSV.x(44,35,5);
    const g2=TSV.grid(2,2,1,3,r=>r===0?"op":r===1?"forest":"mid")+TSV.tok(13,57,"⚔","me")+TSV.arrow(13,46,13,28)+TSV.arrow(13,24,13,8,C.dim,2,1)+TSV.x(13,13,5);
    const g3=TSV.grid(2,2,1,3)+TSV.tok(13,57,"💣","me")+TSV.arrow(13,46,13,8)+TSV.g(13,74,"✓",11,C.ok)+TSV.tok(50,57,"🪤","me")+TSV.g(50,34,"🔒",14);
    const legend=`<div class="tut-legend"><span><i class="tut-sw op"></i>상대 땅</span><span><i class="tut-sw forest"></i>상대 숲</span></div>`;
    return [
      {t:"곧게 2칸",vis:TSV.svg(60,80,"내 하수인이 곧게 2칸 올라가는 화살표와 꺾는 길에는 엑스",g1),res:"곧게만 2칸까지 · 꺾기 ✗"},
      {t:"상대 숲·땅은 1칸",vis:TSV.row(TSV.svg(30,80,"상대 숲과 상대 땅으로 들어가는 길은 첫 칸까지만 화살표가 그려지고 둘째 칸은 엑스",g2,"tut-fig"),legend),res:"들어가면 1칸"},
      {t:"폭탄·함정",vis:TSV.svg(70,80,"폭탄은 2칸 화살표에 체크, 함정은 자물쇠로 스스로는 못 움직임",g3),res:"폭탄 2칸 ✓ · 함정은 스스로 못 움직여요 🔒 (밀리면 옮겨져요)"}]; },
  recap(){
    return [
      {t:"이기는 길 셋",vis:TSV.row(TSV.pill("👑 상대 왕 잡기"),TSV.pill("🏁 내 왕이 끝줄"),TSV.pill("💀 상대 전멸"))},
      {t:"내 차례 흐름",vis:`<div class="tut-flow"><span class="tut-flow-box">주 행동 1개<small>이동·탐색·텔레포트·회복</small></span>${TSV.arr()}<span class="tut-flow-box">옆에 붙었으면 ⚔<small>꼭 싸움 (최대 2번)</small></span>${TSV.arr()}<span class="tut-flow-box acc">턴 종료 ▶<small>할 게 없으면 자동 · 싸울 상대만 남으면 [싸우지 않고 종료]</small></span></div>`,res:"회복: 고른 말이 나와 상대 차례가 끝날 때마다 최대 HP 5%씩 나아요 (이동·탐색·텔레포트·싸움으로 풀려요)"},
      {t:"기억할 것",vis:TSV.row(TSV.pill("🌲 숲에 숨기"),TSV.pill("🔍 흔적 찾기"),TSV.pill("❓ 물음표 추리"))}]; }
};
const TUT_STEPS=[
  {icon:"🏆",title:"이기는 법 세 가지",cards:TUT_SCENES.win(),
   lines:["상대 <b>왕</b>을 찾아서 잡으면 이겨요.","내 <b>왕</b>이 상대편 <b>맨 끝줄</b>에 서도 이겨요. 스스로 걸어가도, 상대에게 <b>밀려서</b> 닿아도 승리예요.","상대의 싸우는 말(<b>하수인</b> 6개 + <b>동료</b> 2개)을 모두 없애도 이겨요."]},
  {icon:"🎭",title:"말 5가지와 숨은 정체",cards:TUT_SCENES.pieces(),
   lines:["내 말은 모두 <b>14개</b>예요. <b>하수인</b>(싸우는 말) 6개, <b>동료</b> 2개, <b>왕</b> 1개, <b>폭탄</b> 3개, <b>함정</b> 2개예요.","상대에게 내 말은 전부 <b>물음표(?)</b>로 보여요. 상대 말도 나에게는 물음표예요.","싸우고 나면 그 말의 정체가 드러나요. <b>함정</b>을 밟으면 함정과 밟은 말도 드러나요."]},
  {icon:"🌲",title:"움직이기와 숲에 숨기",cards:TUT_SCENES.move(),
   lines:["내 차례에 말 <b>하나</b>를 위·아래·옆으로 <b>한 칸</b> 움직여요. 대각선은 안 돼요.","초록 칸은 <b>숲</b>이에요. 숲의 말은 상대가 <b>바로 옆</b>에 올 때만 보이고, 떨어지면 다시 숨어요.","숨은 말이 있는 칸으로 가면 <b>부딪혀요</b>. 그 앞 칸에 멈추고, 둘 다 이번 차례 동안 보여요."]},
  {icon:"🔍",title:"흔적과 탐색",cards:TUT_SCENES.search(),
   lines:["숲 어딘가에 <b>선물</b>이 숨어 있어요. 말이 그 칸에 서면 <b>흔적</b> 표시가 떠요.",
     "그 말로 <b>다음 차례</b>에 <b>탐색</b>(찾아보기) 버튼을 누르면 선물을 받아요.",
     "탐색은 <b>하수인·동료·왕</b>만 할 수 있어요. <b>폭탄·함정은 못</b> 해요.",
     "선물은 <b>🎁 아이템 선물</b>(회복약·몬스터볼 등)·<b>✨ 전투 버프</b>·<b>📘 기술 교체</b> 셋이에요!"]},
  {icon:"⚔️",title:"옆에 붙으면 꼭 싸워요",cards:TUT_SCENES.battle(),
   lines:["내 말이 움직여서 상대 말 <b>바로 옆</b>에 새로 붙으면 꼭 싸워요. 이게 <b>강제 전투</b>(무조건 싸움)예요. 한 차례에 싸움은 <b>최대 2번</b>이에요.",/* #233 (GDD-23 4.1, 2026-09-16 CJ 승인): 5속성 순환 불→풀→땅→번개→물→불로 개편 — 땅은 #234 전까지 실제로 고를 수 있는 속성이
   아니므로(ELEMS 밖), 지금 플레이에서 실제로 보이는 4종 사이의 관계만 문장으로 남긴다. 풀·번개는 땅을 거치므로 더는 서로 안 물린다. */
"싸움은 불·물·풀·번개 <b>가위바위보</b>예요. <b>불→풀</b>, <b>번개→물→불</b> 순서로 이겨요. 풀과 번개는 서로 상성이 없어요.","싸움이 끝나도 <b>HP</b>(체력)와 기술 <b>쿨타임</b>은 그대로예요. 화상 같은 <b>상태이상</b>은 사라져요.","싸움은 최대 <b>6라운드</b>예요. 끝까지 가면 <b>남은 HP 비율</b>이 높은 쪽이 이겨요. 같으면 지킨 쪽이 이겨요.","<b>동료·왕</b>끼리도 모두 <b>싸워요</b>(왕↔왕 포함). <b>왕 본체</b>가 지면 그 자리에서 <b>경기 패배</b>예요.","기술 <b>4칸</b>이 전부 못 쓰는 상태면 <b>기본 공격도 나오지 않아요</b>. 「턴 종료」를 눌러야 내 <b>싸움 차례 한 번</b>만 넘어가요.","<b>보호막(🛡)</b>은 겹쳐 쓰면 <b>남은 양에 더해져요</b>. 18에 22를 더 받으면 <b>40</b>이에요."]},
  {icon:"💣",title:"폭탄과 함정",cards:TUT_SCENES.bombtrap(),
   lines:["<b>폭탄</b>은 한 칸씩 움직일 수 있어요(버닝 타임엔 2칸). 상대 옆에 새로 붙으면 터져요. <b>함정</b>은 <b>스스로 움직일 수 없어요</b>.","<b>하수인</b>이 폭탄을 건드리면 둘 다 사라져요. <b>동료·왕</b>은 살아남아요. 폭탄끼리·폭탄과 함정은 <b>그 자리에서 터져 둘 다 사라져요</b>.","<b>함정</b>을 건드리면 함정은 사라지고 그 말은 <b>내 차례 2번</b> 못 움직여요. 둘 다 정체가 드러나요. 함정도 <b>밀기·재배치</b>로 옮겨질 수 있어요."]},
  {icon:"🔴",title:"잡아오기와 도망치기",cards:TUT_SCENES.capture(),
   lines:["싸울 때 상대 <b>하수인</b> HP가 <b>30%</b> 아래면 <b>몬스터볼</b>을 던져요. 성공률 <b>70%</b>예요.",
     "성공하면 내 <b>예비 하수인</b>(HP 70/100)이 돼요. 성공·실패 모두 볼 <b>1개</b>가 없어져요.",
     "<b>도망</b>은 <b>HP 조건 없이</b> 언제든 칠 수 있어요. 기본 성공률은 <b>30%</b>예요.",
     "성공하면 <b>뒤에 있는 내 말</b>과 교환하거나 생략하고, 상대를 <b>한 칸씩</b> 밀어요.",
     "실패하면 <b>상대의 기본 공격 한 번</b>을 맞고, 내 <b>싸움 차례 한 번</b>이 지나가요."]},
  {icon:"🌀",title:"텔레포트(순간이동)",cards:TUT_SCENES.teleport(),
   lines:["내 말이 <b>상대편 땅</b>(상대 진영 3줄)에 들어가 있으면 <b>텔레포트</b>(순간이동)를 쓸 수 있어요.","텔레포트는 내 말 <b>두 개</b>의 자리를 서로 바꿔요. 왕·폭탄·함정도 돼요. 한 경기에 <b>몇 번이든</b> 쓸 수 있지만, 한 차례의 <b>주 행동</b>을 써요.","바뀐 두 말이 각각 상대 옆에 새로 붙으면 <b>각자 따로</b> 싸워요. 남은 싸움 횟수가 모자라면 못 써요.","<b>함정</b>에 걸려 멈춘 말은 텔레포트로 <b>자리를 바꿀 수 없어요</b>. 양쪽 어느 자리든 안 돼요."]},
  {icon:"🔥",title:"버닝 타임(불타는 시간)",cards:TUT_SCENES.burning(),banner:"턴 65부터 🔥 버닝 타임",
   lines:["<b>65번째 턴</b>부터 <b>버닝 타임</b>(불타는 시간)이에요. 말이 <b>곧게 2칸</b>까지 움직일 수 있어요.","상대편 <b>숲</b>이나 상대편 <b>땅</b>에 있거나, 들어가거나, 지나갈 때는 그대로 <b>1칸</b>이에요.","<b>폭탄</b>도 2칸 움직여요. <b>함정</b>은 버닝 타임에도 <b>스스로는</b> 못 움직여요. 밀리면 옮겨져요."]},
  {icon:"🏁",title:"빠른 복습 — 첫 차례 체크리스트",cards:TUT_SCENES.recap(),
   lines:["이기는 길은 셋! 상대 <b>왕</b> 잡기, 내 왕이 상대 <b>끝줄</b>에 서기, 상대 <b>하수인·동료 전멸</b>이에요.","<b>주 행동 하나</b> 뒤 새로 붙은 상대와 꼭 싸워요. 할 게 없으면 <b>턴 종료</b>는 자동이에요. 싸울 상대만 남으면 <b>싸우지 않고 종료</b>를 눌러요.","<b>회복</b>은 나와 상대 차례 끝마다 최대 HP의 <b>5%</b>씩 나아요. 만피도 고를 수 있어요. 이동·탐색·텔레포트·싸움으로 풀려요. 이제 시작해요!"]}
];
const TUT_HINTS={ // 첫 발생 시 1회 짧은 상황 도움말 (게임 상태 S 무변경 · 저장 안 함)
  teleport:{icon:"🌀",text:"텔레포트(순간이동)를 쓸 수 있어요! 내 말이 상대편 땅에 들어가 있으면, 내 말 두 개의 자리를 서로 바꿀 수 있어요. 횟수 제한은 없지만 한 차례의 주 행동을 써요."},
  burning:{icon:"🔥",text:"버닝 타임(불타는 시간)이 시작됐어요! 이제부터 말이 곧게 2칸까지 움직일 수 있어요. 함정은 스스로는 못 움직여요."},
  /* #121 계약 10 — 새 규칙의 첫 발생 지점 2곳. 게임 상태·난수·저장소를 건드리지 않는 표시 계층 전용이다 */
  pkg:{icon:"📦",text:"상자를 받았어요! 싸울 때 🎒 가방에서 열면 무엇을 받을지 직접 골라요. 🎁 은 회복약·쿨링수·해독제·몬스터볼 중 하나, ✨ 은 💪 힘·🧭 시간(1라운드에만, 그 싸움 3라운드)·🏃 도망(그 싸움 동안 성공률 70%) 중 하나예요. 상자를 열고 버프를 쓰는 것은 차례를 쓰지 않고, 버프는 한 싸움에 하나만 쓸 수 있어요. 아이템을 실제로 쓰는 건 한 라운드에 한 번이고 다음 라운드엔 같은 것도 또 써요."},
  /* #146·#131 계약 — 새 규칙의 첫 발생 지점 2곳. 표시 계층 전용이라 게임 상태·난수·저장소를 건드리지 않는다 */
  noatk:{icon:"⏭",text:"기술 4칸이 전부 쿨타임이거나 못 쓰는 상태예요. 이럴 때는 기본 공격이 나오지 않아요 — 「턴 종료」를 눌러야 내 싸움 차례 한 번만 넘어가요. 누르기 전에는 아무것도 저절로 진행되지 않고, 🎒 가방·🔴 포획·🏃 도망은 그대로 쓸 수 있어요. 쿨링수로 쿨타임을 풀면 다시 공격할 수 있어요."},
  teletrap:{icon:"🪤",text:"함정에 걸려 멈춘 말은 텔레포트로 자리를 바꿀 수 없어요. 먼저 고르는 말도, 바꿀 상대 말도 안 돼요. 다른 말을 고르거나, 멈춤이 풀릴 때까지 기다려요."},
  recruit:{icon:"📘",text:"새 기술을 배우거나 공용 하수인을 잡을 수 있어요! 기술은 🐉 드래곤 숨결·🕯 마녀의 장난·💀 사신의 낫 중에서 직접 고르고, 내 하수인 6개 중 살아 있는 말의 기술 4칸 어디든 바꿀 수 있어요. 같은 기술은 한 말에 두 번 못 넣어요. 잡은 하수인은 동료나 왕이 받고 그 종의 능력 그대로 와요. 포기해도 이 칸은 다시 쓸 수 없어요."}
};
const TUT={open:false,step:0,seenThisLoad:false,auto:false,hints:{teleport:false,burning:false,pkg:false,recruit:false,noatk:false,teletrap:false},hintShown:null,restore:null,btns:[]};
/* #128 seenThisLoad 의 의미: "이 문서 로드에서 튜토리얼을 이미 띄웠다". 그 뿐이고 그 이상이 아니다 —
   tutOpen 이 (자동·수동 어느 쪽이든) 세우고, tutClose 가 닫힘 경로에서 다시 못박는다. 문서가 새로 로드되면 자연히 false 로 돌아간다.
   저장소를 읽지 않으므로 localStorage 미지원·SecurityError·시크릿 모드 같은 환경 차이가 표시 여부를 바꾸지 못한다(예외 처리할 것도 없다). */
function tutSeen(){ return TUT.seenThisLoad; }
function tutAttr(el,k,v){ try{ if(!el) return; if(v===null){ if(el.removeAttribute) el.removeAttribute(k); } else if(el.setAttribute) el.setAttribute(k,String(v)); }catch(e){} }
function tutSetInert(on){ // 배경(게임 화면·게임 모달)을 스크린리더·포커스·클릭에서 제외 — 열릴 때만
  for(const id of ["app","overlay","tutHint"]){ const el=$(id); tutAttr(el,"inert",on?"":null); tutAttr(el,"aria-hidden",on?"true":null); }
}
function tutFocus(el,opt){ // opt.preventScroll: 포커스가 스크롤 컨테이너를 끌지 않게 (미지원 브라우저는 인자 무시 → 아래 tutScrollTop이 되돌린다)
  try{ if(!el||!el.focus) return; if(opt) el.focus(opt); else el.focus(); }catch(e){ try{ el.focus(); }catch(e2){} }
}
function tutScrollTop(){ // #42 REVISE: 새로 그린 단계는 언제나 제목(맨 위)부터 — 스크롤 컨테이너인 #tutBox는 렌더 사이에 살아남아 이전 단계의 오프셋을 물고 온다
  const box=$("tutBox"); if(!box) return;
  try{ box.scrollTop=0; }catch(e){}
  try{ const ov=$("tutOverlay"); if(ov) ov.scrollTop=0; }catch(e){} // 오버레이는 보통 스크롤되지 않지만 방어적으로 함께 초기화
}
function tutOpen(opts){
  opts=opts||{};
  TUT.seenThisLoad=true; // #128 이번 문서 로드에서 표시됨 — 자동 표시는 로드당 1회라는 불변식을 여는 순간 못박는다
  if(TUT.open){ tutGo(0); return; } // 이미 열려 있으면 처음으로
  TUT.open=true; TUT.step=0; TUT.auto=!!opts.auto;
  const ae=document.activeElement;
  TUT.restore=/** @type {any} */((ae&&ae!==document.body&&/** @type {any} */(ae).focus)?ae:null); // 닫을 때 안전 복원
  tutSetInert(true);
  const ov=$("tutOverlay"); if(ov){ ov.classList.remove("hidden"); tutAttr(ov,"aria-hidden",null); }
  tutRender();
}
function tutGo(i){ TUT.step=Math.max(0,Math.min(TUT_STEPS.length-1,i)); tutRender(); }
function tutNext(){ if(!TUT.open) return; if(TUT.step>=TUT_STEPS.length-1) tutClose("finish"); else tutGo(TUT.step+1); }
function tutPrev(){ if(!TUT.open) return; if(TUT.step>0) tutGo(TUT.step-1); }
function tutSkip(){ if(TUT.open) tutClose("skip"); }
function tutClose(reason){
  if(!TUT.open) return;
  TUT.open=false; TUT.seenThisLoad=true; // #128 건너뛰기·완료·Esc 모두 '이번 로드에서 봤음' — 저장은 하지 않는다(다음 문서 로드에서는 다시 뜬다)
  const ov=$("tutOverlay"); if(ov){ ov.classList.add("hidden"); tutAttr(ov,"aria-hidden","true"); }
  tutSetInert(false);
  TUT.btns=[];
  const r=TUT.restore; TUT.restore=null; // 포커스 복원: 원래 요소가 아직 문서에 있고 비활성이 아닐 때만, 아니면 헤더 ? 버튼
  let ok=false;
  if(r&&r.isConnected!==false&&!r.disabled){ tutFocus(r); ok=document.activeElement===r; }
  if(!ok) tutFocus($("tutBtn"));
}
function tutRender(){
  const box=$("tutBox"); if(!box) return;
  const i=TUT.step, st=TUT_STEPS[i], n=TUT_STEPS.length, last=i===n-1;
  box.innerHTML=`<div class="tut-head"><span id="tutCount" aria-live="polite" aria-atomic="true">${i+1} / ${n} 단계</span><span>📖 튜토리얼</span></div>
    <h2 id="tutTitle"><span aria-hidden="true">${st.icon}</span> ${st.title}</h2>
    <div id="tutBody" class="tut-scene">${st.banner?`<div class="tut-banner">${st.banner}</div>`:""}${st.cards.map((c,k)=>`<article class="tut-card" aria-labelledby="tutCard${k}"><div class="tut-card-h"><span class="tut-sn" data-n="${k+1}">${k+1}</span><h3 id="tutCard${k}">${c.t}</h3></div><div class="tut-vis">${c.vis}</div>${c.res?`<p class="tut-res${c.tone?" "+c.tone:""}">${c.res}</p>`:""}<p class="tut-txt">${st.lines[k]}</p></article>`).join("")}</div>
    <div class="tut-dots" aria-hidden="true">${TUT_STEPS.map((_,k)=>`<span class="${k===i?"on":""}"></span>`).join("")}</div>
    <div class="row tut-nav" id="tutNav"></div>`;
  const nav=$("tutNav"); TUT.btns=[];
  const mk=(txt,fn,opt)=>{ opt=opt||{}; const b=document.createElement("button"); b.textContent=txt; b.onclick=fn; b.disabled=!!opt.dis;
    if(opt.cls) b.className=opt.cls; tutAttr(b,"type","button"); if(opt.aria) tutAttr(b,"aria-label",opt.aria); nav.appendChild(b); TUT.btns.push(b); return b; };
  mk("◀ 이전",tutPrev,{dis:i===0,aria:"이전 단계"});
  const primary=last?mk("게임 시작 ▶",()=>tutClose("finish"),{cls:"primary",aria:"튜토리얼 마치고 게임 시작"}):mk("다음 ▶",tutNext,{cls:"primary",aria:"다음 단계"});
  if(last) mk("처음부터",()=>tutGo(0),{aria:"튜토리얼 처음부터 다시 보기"}); else mk("건너뛰기",tutSkip,{aria:"튜토리얼 건너뛰기"});
  /* #42 REVISE 포커스·스크롤 계약: tutOpen·tutGo(다음/이전/처음부터) 모두 tutRender를 거치므로 여기 한 곳에서만 처리한다.
     ① 하단 기본 버튼에 preventScroll로 포커스 → 브라우저가 박스를 맨 아래로 끌어내리지 않음 (200% 줌·360px 좁은 폭에서 제목·카드 1이 가려지던 회귀)
     ② 그 뒤 스크롤을 맨 위로 되돌림 → preventScroll 미지원 브라우저에서도, 그리고 이전 단계에서 남은 오프셋에서도 항상 제목부터 시작
     키보드 의미(Tab 순환·←/→·Esc)는 그대로 — Tab 이동은 기존처럼 기본 스크롤(포커스 요소 노출)을 유지한다. */
  tutFocus(primary,{preventScroll:true});
  tutScrollTop();
}
function tutKeydown(e){ // 대화상자 내부 키보드: Esc=건너뛰기 · ←/→=이전/다음 · Tab=대화상자 안에서 순환 (게임 화면에는 키 핸들러가 없어 충돌 없음)
  if(!TUT.open||!e) return false;
  const k=e.key, stop=()=>{ if(e.preventDefault) e.preventDefault(); if(e.stopPropagation) e.stopPropagation(); };
  if(k==="Escape"){ stop(); tutSkip(); return true; }
  if(k==="ArrowRight"){ stop(); if(TUT.step<TUT_STEPS.length-1) tutNext(); return true; }
  if(k==="ArrowLeft"){ stop(); tutPrev(); return true; }
  if(k==="Tab"){
    const f=TUT.btns.filter(b=>!b.disabled); if(!f.length) return false;
    stop();
    const cur=f.indexOf(document.activeElement);
    const nx=e.shiftKey?(cur<=0?f.length-1:cur-1):(cur<0||cur>=f.length-1?0:cur+1);
    tutFocus(f[nx]); return true;
  }
  return false;
}
function tutHint(key){ // 첫 발생 시 1회 — 두 번째부터 false. 게임 상태·저장소 무변경
  if(TUT.hints[key]!==false) return false;
  const h=TUT_HINTS[key]; if(!h) return false;
  TUT.hints[key]=true; TUT.hintShown=key;
  const box=$("tutHint"); if(!box) return true;
  box.innerHTML=`<span class="tut-hint-icon" aria-hidden="true">${h.icon}</span><span class="tut-hint-text">${h.text}</span>`;
  const b=document.createElement("button"); b.textContent="알겠어요"; b.className="tut-hint-ok"; b.onclick=tutHintClose; tutAttr(b,"type","button"); tutAttr(b,"aria-label","도움말 닫기");
  box.appendChild(b); box.classList.remove("hidden");
  setTimeout(()=>{ if(TUT.hintShown===key) tutHintClose(); },12000);
  return true;
}
function tutHintClose(){ TUT.hintShown=null; const box=$("tutHint"); if(box){ box.classList.add("hidden"); box.innerHTML=""; } }
window.tutOpen=tutOpen; window.tutHintClose=tutHintClose;
(function(){ const ov=$("tutOverlay"); if(ov&&ov.addEventListener) ov.addEventListener("keydown",tutKeydown); })();
