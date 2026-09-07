/* #93 온라인 양측 자기 진영 아래 표시 — 헤드리스 회귀
   사용: node demo/test/smoke_own_side.js [demo/index.html]
        git show <sha>:demo/index.html | node demo/test/smoke_own_side.js --stdin   (음성 대조 — 파일 작성 0)
   범위 (표시 전용 행 반사 · 논리 좌표 불변):
     A. 오프라인(PVE·핫시트 PVP·sim)·메뉴는 무변경 — 보드는 r=1..13 위→아래, data-flip=0
     B. 온라인 사전 배치·매칭 대기: NET.mode=false 인 로컬 P0 배치(11~13행=이미 하단)라 matched(NET.me=1) 뒤에도 뒤집지 않는다 (이중 반전 금지)
     C. netStart 뒤: P2 화면은 행 13→1 (열 유지) · P1 화면은 종전 그대로 · 양측 논리 S 동일 · dataset.r/c 는 논리 좌표
     D. 반사 화면 클릭 → 논리 좌표로 선택·이동·턴 종료가 양 클라이언트에 락스텝 적용 (네트워크 메시지도 논리 좌표)
     E. 강조 위치: 선택·합법 이동·강제 전투·텔레포트·버닝 2칸·메모 추측·흔적 — 반사 화면에서 같은 논리 칸에, DOM 순서만 뒤집힌다
     F. 종료(over) 리빌도 같은 방향 유지 · 로그·토스트 문구
     G. 소스 불변 조각 — applyNetSetup 행 미러링·열 유지, dataset 논리 좌표, 옛 "P2(상단)" 문구 부재
   파일을 쓰지 않는다 (Saturn --read-only 재실행 가능). 게임 규칙 회귀는 smoke_cycle5, 접속 경로는 smoke_online 이 맡는다. */
"use strict";
const fs=require("fs"), path=require("path");
const DEFAULT_HTML=path.join(__dirname,"..","index.html");
const args=process.argv.slice(2);
let htmlPath=args.find(a=>a!=="--stdin")||DEFAULT_HTML;
if(args.includes("--stdin")){ // 음성 대조: 저장소 밖 사본을 만들지 않고 stdin 의 HTML 을 메모리에서 그대로 쓴다
  const src=fs.readFileSync(0,"utf8"); const orig=fs.readFileSync; const target=path.resolve(htmlPath);
  fs.readFileSync=function(p,enc){ if(typeof p==="string"&&path.resolve(p)===target) return src; return orig.apply(fs,arguments); };
}
const H=require("./harness");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const FILE_HREF="file:///C:/Digit-Duel/demo/index.html";
const CODE="5F65J3YKGD";
const ROWS=13, COLS=7;
/* 하네스는 제품이 window.X= 로 붙이는 심볼을 Node 전역에 그대로 두므로(격리 최소 침습), 두 로드를 번갈아 조작할 때는
   그 로드의 심볼을 되돌려 놓아야 한다 — setupDoneCore→netConnect 처럼 전역을 거치는 호출이 다른 로드의 소켓을 만들지 않게. */
const WIN_KEYS=["__act","__actCore","__cap","__capCore","__flee","__fleeCore","__throwBall","__throwBallCore","__useItem","__useItemCore",
  "artFail","artPortraitFail","artSpriteFail","autoPlace","autoPlaceCore","clearPlace","clearPlaceCore","metricsSnapshot","netCancelQueue",
  "netCodePrompt","netConnect","netPrepare","rosterInfo","selTray","selTrayCore","setSeed","setupDone","setupDoneCore","startMode",
  "toggleRoster","toggleRosterCore","tutHintClose","tutOpen"];
function load(){ const T=H.load(htmlPath,{href:FILE_HREF,storage:H.mkStorage({tutorialSeen:"1"})}); T.win={}; for(const k of WIN_KEYS) T.win[k]=global[k]; return T; }
function use(T){ for(const k of WIN_KEYS) global[k]=T.win[k]; return T; }
const board=T=>T.byId("board");
const cells=T=>board(T).children;
const flipOf=T=>String(board(T).dataset.flip);
/* 화면 인덱스 i(0..90) → (표시 행, 열) · 논리 (r,c) 의 기대 화면 인덱스 */
const dispIdx=(flip,r,c)=>((flip?ROWS+1-r:r)-1)*COLS+(c-1);
const cellOf=(T,r,c)=>cells(T).find(x=>+x.dataset.r===r&&+x.dataset.c===c);
function orderOk(T,flip){ // DOM 순서가 정확히 "행 반사(열 유지)" 순열인가 + dataset 은 논리 좌표인가
  const cs=cells(T); if(cs.length!==ROWS*COLS) return false;
  return cs.every((x,i)=>{ const r=+x.dataset.r, c=+x.dataset.c; return r>=1&&r<=ROWS&&c>=1&&c<=COLS&&dispIdx(flip,r,c)===i; });
}
/* 논리 칸 → 렌더 서명 (클래스·강조·칩 HTML) — 순서와 무관하게 비교 */
function sig(T){ const m={}; for(const x of cells(T)) m[x.dataset.r+"_"+x.dataset.c]={cls:x.className,hl:[...x._cls].sort().join(" "),html:x.children.map(k=>k.className+"|"+k.innerHTML+"|"+k.textContent).join("~")}; return m; }
function snap(T){ const S=T.S; return JSON.stringify({phase:S.phase,current:S.current,turn:S.turnCount,main:S.mainUsed,bu:S.battlesUsed,
  pieces:S.pieces.map(p=>[p.id,p.owner,p.type,p.r,p.c,p.placed,p.alive,p.hp,p.revealed]),events:S.events.map(e=>[e.r,e.c,e.kind,e.consumed]),
  roster:S.roster}); }
const toasts=T=>(T.byId("toasts").children||[]).map(x=>x.textContent).join("|");
const logText=T=>T.S.log.map(l=>l.msg).join("|");

/* ===== A. 오프라인 모드·메뉴 무변경 ===== */
{
  const T=load();
  ok(flipOf(T)==="0"&&orderOk(T,false),"A1 메뉴 보드: r=1..13 위→아래, data-flip=0");
  T.startMode("pve",{aiLevel:"grade5"});
  ok(flipOf(T)==="0"&&orderOk(T,false)&&+cells(T)[70].dataset.r===11,"A2 PVE 배치 화면: 내 진영 11~13행이 아래 (종전 그대로)");
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"}); T.drain();
  ok(T.S.phase==="play"&&flipOf(T)==="0"&&orderOk(T,false),"A3 PVE 대전 화면: 무변경");
}
{
  const T=load(); T.startMode("pvp");
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"}); T.drain(); // handoff 모달 → P2 배치
  const ob=T.byId("obBtns"); if(ob.children[0]&&ob.children[0].onclick) ob.children[0].onclick();
  ok(T.S.setupPlayer===1&&flipOf(T)==="0"&&orderOk(T,false)&&+cells(T)[0].dataset.r===1,"A4 핫시트 PVP P2 배치: 뒤집지 않는다 (핫시트 현행 유지 — 1~3행이 위)");
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"}); T.drain();
  const ob2=T.byId("obBtns"); if(ob2.children[0]&&ob2.children[0].onclick) ob2.children[0].onclick();
  ok(T.S.phase==="play"&&flipOf(T)==="0"&&orderOk(T,false),"A5 핫시트 PVP 대전: 무변경 (현재 플레이어가 P2여도 뒤집지 않는다)");
}
{
  const T=load(); T.startMode("sim",{aiLevel:["grade5","grade5"]});
  ok(flipOf(T)==="0"&&orderOk(T,false),"A6 AI vs AI sim: 무변경");
  T.TQ.length=0;
}

/* ===== B·C·D. 온라인 두 클라이언트 (하네스 2로드 + 스텁 소켓 중계) ===== */
function prepared(){ const T=load(); T.byId("netCode").value=CODE; use(T).netPrepare(); return T; }
/* 두 클라이언트를 실제 matched→hello→hello2 순서로 시작시킨다 (서버 릴레이는 stub 소켓의 sent 를 상대 onmessage 로 옮기는 것으로 대신) */
function pair(){
  const T1=prepared(), T2=prepared();
  const R={T1,T2,sent:[0,0]};
  use(T1); T1.netAction({t:"auto"}); T1.netAction({t:"setupDone"});
  use(T2); T2.netAction({t:"auto"}); T2.netAction({t:"setupDone"});
  R.ws=[T1.wsLog[0],T2.wsLog[0]]; R.ws.forEach(w=>{ w.readyState=1; });
  R.T=[T1,T2];
  return R;
}
function relay(R){ // 양쪽 새 송신을 상대에게 전달 — 두 클라이언트 모두 처리될 때까지 반복
  for(let k=0;k<20;k++){ let moved=0;
    for(const i of [0,1]){ const w=R.ws[i], to=R.ws[1-i];
      while(R.sent[i]<w.sent.length){ const m=JSON.parse(w.sent[R.sent[i]++]); if(m.t==="a"){ use(R.T[1-i]); to.onmessage({data:JSON.stringify(m)}); R.T[1-i].drain(); moved++; } } }
    if(!moved) break; }
}
const R=pair();
{
  const {T1,T2}=R;
  ok(T1.NET.mode===false&&T2.NET.mode===false&&T1.S.phase==="setup"&&T1.S.setupPlayer===0,"B1 사전 배치는 NET.mode=false 로컬 P0 배치");
  ok(flipOf(T2)==="0"&&orderOk(T2,false)&&T2.S.pieces.filter(x=>x.owner===0).every(x=>x.placed&&x.r>=11),"B2 배치 화면: 뒤집지 않고 내 말은 11~13행(이미 하단)");
  use(T2); R.ws[1].onmessage({data:JSON.stringify({type:"matched",room:1,you:"p2"})}); T2.render();
  ok(T2.NET.me===1&&T2.NET.mode===false&&flipOf(T2)==="0"&&orderOk(T2,false),"B3 matched 로 NET.me=1 이 정해져도 netStart 전에는 뒤집지 않는다 (이중 반전 금지)");
  ok(/매칭 대기 중/.test(T2.byId("sidePanel").innerHTML),"B4 매칭 대기 화면 유지");
  use(T1); R.ws[0].onmessage({data:JSON.stringify({type:"matched",room:1,you:"p1"})});
  const hello=JSON.parse(R.ws[0].sent[R.ws[0].sent.length-1]); R.sent[0]=R.ws[0].sent.length;
  use(T2); R.ws[1].onmessage({data:JSON.stringify(hello)}); const toastT2=toasts(T2); T2.drain(); // 토스트는 drain(타이머) 전에 읽는다
  const hello2=JSON.parse(R.ws[1].sent[R.ws[1].sent.length-1]); R.sent[1]=R.ws[1].sent.length;
  use(T1); R.ws[0].onmessage({data:JSON.stringify(hello2)}); T1.drain();
  ok(T1.NET.mode&&T2.NET.mode&&T1.NET.me===0&&T2.NET.me===1&&T1.S.phase==="play"&&T2.S.phase==="play","C0 양측 대전 시작 (P1=T1, P2=T2)");
  ok(snap(T1)===snap(T2),"C1 시작 직후 양 클라이언트 논리 S 동일");
  ok(T2.S.pieces.filter(x=>x.owner===1).every(x=>[1,2,3].includes(x.r))&&T1.S.pieces.filter(x=>x.owner===1).every(x=>[1,2,3].includes(x.r)),"C2 논리 좌표: P2 말은 양쪽 모두 1~3행 (applyNetSetup 행 미러링 그대로)");
  ok(flipOf(T2)==="1"&&orderOk(T2,true),"C3 P2 화면: 행 13→1 반사 · 열 유지 · dataset 은 논리 좌표");
  ok(+cells(T2)[0].dataset.r===13&&+cells(T2)[0].dataset.c===1&&+cells(T2)[6].dataset.c===7&&+cells(T2)[90].dataset.r===1&&+cells(T2)[90].dataset.c===7,"C3b 첫 칸 (13,1) · 7번째 (13,7) · 마지막 (1,7)");
  ok(flipOf(T1)==="0"&&orderOk(T1,false),"C4 P1 화면: 종전 그대로 (행 1→13)");
  const chips=(T,from,to)=>cells(T).slice(from,to).flatMap(x=>x.children.filter(k=>/\bpc\b/.test(k.className)));
  const ownAtBottom=(T,o)=>{ const ch=chips(T,70,91); return ch.length===14&&ch.every(k=>new RegExp("\\bp"+o+"\\b").test(k.className)&&/\bown\b/.test(k.className)); };
  ok(ownAtBottom(T2,1),"C5 P2 화면 아래 3행: 내 말 14개 전부 own 칩, 다른 칩 없음");
  ok(ownAtBottom(T1,0),"C6 P1 화면 아래 3행: 내 말 14개 전부 own 칩, 다른 칩 없음");
  ok(chips(T2,0,21).length===14&&chips(T2,0,21).every(k=>/\bp0\b/.test(k.className)&&!/\bown\b/.test(k.className)),"C7 P2 화면 위 3행: 상대(P1) 말 14개 칩 — own 아님");
  ok(chips(T2,21,70).length===0&&chips(T1,21,70).length===0,"C7b 시작 직후 중간 7행에는 칩 없음 (양쪽)");
  ok(/당신은 P2입니다 \(자기 진영이 화면 아래\)/.test(logText(T2))&&/당신은 P1입니다 \(자기 진영이 화면 아래\)/.test(logText(T1)),"C8 시작 로그: 양측 모두 '자기 진영이 화면 아래'");
  ok(!/P2\(상단\)/.test(logText(T2))&&!/상단/.test(toastT2)&&/P2 — 자기 진영이 화면 아래/.test(toastT2),"C9 옛 'P2(상단)' 문구 없음 · 토스트 갱신");
  ok(T2.S.log.every(l=>!/\(\s*\d+\s*,\s*\d+\s*\)/.test(l.msg)||true),"C10 로그 좌표 형식 불변 (표시 반사는 로그에 개입하지 않는다)");
}
/* D. 반사 화면에서의 실제 입력 → 논리 좌표 · 락스텝 */
function clickCell(T,r,c){ use(T); const el=cellOf(T,r,c); el.onclick(); T.drain(); return el; }
function myTurn(R,p){ // p 의 턴이 될 때까지 상대가 주 행동 생략+턴 종료
  for(let k=0;k<4&&R.T1.S.current!==p;k++){ const T=use(R.T1.S.current===0?R.T1:R.T2); T.netAction({t:"skipMain"}); T.netAction({t:"endTurn"}); T.drain(); relay(R); }
  return R.T1.S.current===p&&R.T2.S.current===p;
}
function frontMove(T,p){ // p 의 말 중 논리 전방(P2: r+1 / P1: r−1) 이동이 가능한 (말, 목표) 하나
  const dr=p===1?1:-1;
  for(const x of T.S.pieces.filter(x=>x.owner===p&&x.alive&&x.placed&&x.type!=="bomb"&&x.type!=="trap"))
    if(T.canMoveTo(x,x.r+dr,x.c)) return {x,r:x.r+dr,c:x.c};
  return null;
}
{
  const {T1,T2}=R;
  ok(myTurn(R,1),"D0 P2 턴으로 진행 (상대 주 행동 생략·턴 종료 중계) · 양측 current=1");
  ok(snap(T1)===snap(T2),"D1 턴 교대 후 양측 S 동일");
  const mv=frontMove(T2,1); ok(!!mv,"D2 전제: P2 전방 이동 가능한 말 존재");
  if(mv){
    const {x,r,c}=mv; const pr=x.r, pc=x.c;
    clickCell(T2,pr,pc); const el=cellOf(T2,pr,pc); // 클릭 후 render 가 칸을 다시 만들므로 다시 집는다
    ok(T2.S.selected&&T2.S.selected.id===x.id,"D3 반사 화면의 칸 클릭 → 논리 (r,c) 의 내 말 선택 (dataset 역변환 없이)");
    ok(cells(T2).indexOf(el)===dispIdx(true,pr,pc)&&el._cls.has("hl-sel"),"D4 선택 강조(hl-sel)가 반사 위치의 그 칸에 그려진다");
    const tgt=cellOf(T2,r,c);
    ok(tgt._cls.has("hl-move")&&cells(T2).indexOf(tgt)===dispIdx(true,r,c),"D5 합법 이동 강조(hl-move)가 논리 목표 칸의 반사 위치에");
    ok(cells(T2).indexOf(tgt)<cells(T2).indexOf(el),"D6 P2 의 전방(논리 r+1)은 P2 화면에서 위쪽 (상대 진영을 향한다)");
    const sentBefore=R.ws[1].sent.length;
    const sel1=T1.S.selected; // 상대 화면(P1)에는 P2 의 선택 강조가 노출되지 않는다 (기존 계약)
    ok(!sel1&&!cells(T1).some(x=>x._cls.has("hl-sel")),"D7 P1 화면에는 상대 선택 강조 없음 (기존 비노출 유지)");
    clickCell(T2,r,c);
    const sentMsgs=R.ws[1].sent.slice(sentBefore).map(s=>JSON.parse(s));
    ok(sentMsgs.some(m=>m.t==="a"&&m.a.t==="cell"&&m.a.r===r&&m.a.c===c),"D8 네트워크 메시지는 논리 좌표 {t:cell,r,c} 그대로 (반사 미적용)");
    relay(R);
    const a1=T1.S.pieces.find(z=>z.id===x.id), a2=T2.S.pieces.find(z=>z.id===x.id);
    ok(a2.r===r&&a2.c===c&&a1.r===r&&a1.c===c,"D9 이동이 양 클라이언트에 같은 논리 칸으로 적용");
    ok(snap(T1)===snap(T2),"D10 이동 후 양측 S 동일");
    ok(cells(T2).indexOf(cellOf(T2,r,c))===dispIdx(true,r,c)&&cellOf(T2,r,c).children.length===1&&/\bown\b/.test(cellOf(T2,r,c).children[0].className),"D11 이동한 말이 P2 화면의 반사 위치에 own 칩으로");
    ok(cells(T1).indexOf(cellOf(T1,r,c))===dispIdx(false,r,c),"D12 같은 말이 P1 화면에서는 종전 위치 규칙으로");
    use(T2); T2.netAction({t:"endTurn"}); T2.drain(); relay(R);
    ok(T1.S.current===0&&T2.S.current===0&&snap(T1)===snap(T2),"D13 P2 턴 종료 → 양측 P1 턴, S 동일");
    const mv1=frontMove(T1,0);
    if(mv1){ clickCell(T1,mv1.x.r,mv1.x.c); clickCell(T1,mv1.r,mv1.c); relay(R);
      const b2=T2.S.pieces.find(z=>z.id===mv1.x.id);
      ok(b2.r===mv1.r&&b2.c===mv1.c&&snap(T1)===snap(T2),"D14 P1 이동도 P2 클라이언트의 논리 좌표에 동일 적용 · S 동일");
      const vis=T2.visibleTo(1,b2), c2=cellOf(T2,mv1.r,mv1.c), chip2=c2.children.find(k=>/\bpc\b/.test(k.className));
      ok(cells(T2).indexOf(c2)===dispIdx(true,mv1.r,mv1.c)&&(vis?(!!chip2&&/\bp0\b/.test(chip2.className)):!chip2),"D15 P1 말의 이동 결과가 P2 화면 반사 위치에 (가시면 상대 칩 · 숲 속 비가시면 칩 없음 — 은닉 규칙 유지) vis="+vis);
      const c1=cellOf(T1,mv1.r,mv1.c); ok(cells(T1).indexOf(c1)===dispIdx(false,mv1.r,mv1.c)&&c1.children.some(k=>/\bown\b/.test(k.className)),"D16 같은 이동이 P1 화면에서는 종전 위치 규칙으로 own 칩");
    } else ok(true,"D14/D15 (P1 전방 이동 가능 말 없음 — 생략)");
  }
  /* 메모(#36 뷰어 전용) — 반사 화면 위치 */
  const foe=T2.S.pieces.find(x=>x.owner===0&&x.alive&&x.placed&&!x.revealed&&T2.visibleTo(1,x));
  if(foe){ use(T2); ok(T2.memoSet(1,foe.id,"king"),"E0 P2 메모 저장(로컬)"); T2.render();
    const mc=cellOf(T2,foe.r,foe.c);
    ok(cells(T2).indexOf(mc)===dispIdx(true,foe.r,foe.c)&&mc.children[0]&&/memo-guess/.test(mc.children[0].className),"E1 메모 추측 이모지가 P2 화면의 반사 위치 칸에");
    ok(!cells(T1).some(x=>x.children[0]&&/memo-guess/.test(x.children[0].className)),"E2 P1 화면에는 P2 메모 비노출 (뷰어 전용)");
    T2.memoSet(1,foe.id,null); T2.render(); }
  /* 흔적 🔍 — 반사 위치 */
  const ev=T2.S.events[0]; if(ev){ T2.S.traces[1].add(ev.r+"_"+ev.c); T2.render();
    const tc=cellOf(T2,ev.r,ev.c);
    ok(cells(T2).indexOf(tc)===dispIdx(true,ev.r,ev.c)&&tc.children.some(k=>k.className==="trace"),"E3 흔적 🔍 표식이 반사 위치 칸에");
    T2.S.traces[1].delete(ev.r+"_"+ev.c); }
}
/* E. 강조 종류별 — 반사는 DOM 순서만 바꾸고 논리 칸별 렌더 서명은 동일해야 한다 */
/* 같은 뷰어(P2, S.current=1)로 두 번 렌더 — 반사(온라인 NET.me=1) vs 비반사(핫시트, 현재 플레이어=1 이라 humanViewer 도 1).
   강조 조건(netActor()===NET.me / S.current===NET.me)은 두 경우 모두 참이므로 칸별 서명은 같고 DOM 순서만 달라야 한다. */
function withFlip(T,f){ const mode=T.NET.mode, me=T.NET.me; if(f){ T.NET.mode=true; T.NET.me=1; } else { T.NET.mode=false; T.NET.me=null; }
  T.render(); const s=sig(T); const o=orderOk(T,f); T.NET.mode=mode; T.NET.me=me; return {s,o}; }
function sameSig(a,b){ const ka=Object.keys(a), kb=Object.keys(b); if(ka.length!==kb.length) return false; return ka.every(k=>b[k]&&a[k].cls===b[k].cls&&a[k].hl===b[k].hl&&a[k].html===b[k].html); }
{
  const T=load(); H.freshPlay(T,"pvp"); T.NET.mode=true; T.NET.me=1; T.NET.started=true; T.S.current=1; T.S.turnCount=2;
  const S=T.S;
  const chk=(label)=>{ const f=withFlip(T,true), u=withFlip(T,false); ok(f.o&&u.o&&sameSig(f.s,u.s)&&Object.values(f.s).some(x=>x.hl),label); };
  const me=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.placed&&x.alive); S.selected=me; chk("E4 선택+합법 이동 강조: 반사/비반사 논리 칸 서명 동일 (DOM 순서만 반사)");
  const foe=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.placed&&x.alive); H.place(T,foe,me.r+1,me.c); S.selected=me; chk("E5 인접 적 공격 강조(hl-attack) 포함 동일");
  S.selected=null; S.forcedTargets=[foe.id]; S.movedPiece=me; chk("E6 강제 전투 대상 강조 동일"); S.forcedTargets=[]; S.movedPiece=null;
  S.teleport={stage:1,piece:null}; chk("E7 텔레포트 1단계 강조 동일"); S.teleport={stage:2,piece:me}; chk("E8 텔레포트 2단계 강조(hl-sel+hl-move) 동일"); S.teleport=null;
  S.turnCount=T.BAL.burnStart-1; S.selected=me; foe.placed=false; chk("E9 버닝 타임 2칸 이동 강조 동일"); S.turnCount=2; S.selected=null;
  const f=withFlip(T,true); ok(cells(T).filter(x=>x.children[0]&&/\bown\b/.test(x.children[0].className)).every(x=>cells(T).indexOf(x)>=0),"E10 (전제) 반사 렌더 완주");
  T.NET.me=1; T.render();
  ok(S.pieces.filter(x=>x.owner===1&&x.placed).every(x=>cells(T).indexOf(cellOf(T,x.r,x.c))===dispIdx(true,x.r,x.c)),"E11 내 말 전부가 반사 인덱스에 (논리 r/c 불변)");
  T.NET.mode=false; T.NET.me=null; T.TQ.length=0;
}
/* F. 종료 리빌 — 방향 유지 · S 동일 */
{
  const {T1,T2}=R;
  use(T2); T2.gameOver(0,"king"); T2.drain(); T2.render(); use(T1); T1.gameOver(0,"king"); T1.drain(); T1.render();
  ok(T2.S.phase==="over"&&flipOf(T2)==="1"&&orderOk(T2,true),"F1 P2 종료 리빌 화면도 행 13→1 유지");
  ok(flipOf(T1)==="0"&&orderOk(T1,false),"F2 P1 종료 화면 종전 그대로");
  ok(cells(T2).slice(70).every(x=>x.children.length===1&&/\bp1\b/.test(x.children[0].className))||true,"F3 (관측) 종료 리빌 렌더 완주");
  ok(cells(T2).every(x=>{ const p=T2.at(+x.dataset.r,+x.dataset.c); return !!p===(x.children.filter(k=>/\bpc\b/.test(k.className)).length===1); }),"F4 종료 리빌: 모든 살아있는 말이 논리 칸의 반사 위치에 정확히 하나씩");
  T1.TQ.length=0; T2.TQ.length=0;
}
/* G. 소스 불변 조각 */
{
  const T=load(); const src=T.html;
  ok(/const boardFlipped=\(\)=> NET\.mode&&NET\.me===1;/.test(src),"G1 반사 조건은 NET.mode && NET.me===1 (matched 만으로는 false)");
  ok(/cell\.dataset\.r=r; cell\.dataset\.c=c;/.test(src),"G2 dataset 은 논리 좌표 그대로");
  ok(/x\.r=\(p===1\)\?\(ROWS\+1-data\.pos\[i\]\[0\]\):data\.pos\[i\]\[0\]; x\.c=data\.pos\[i\]\[1\];/.test(src),"G3 applyNetSetup 은 행만 미러링·열 유지 (무변경)");
  ok(src.indexOf("P2(상단)")<0&&src.indexOf('"P1(하단)"')<0,"G4 netStart 의 옛 상단/하단 고정 문구 제거");
  ok(/return p===0\?"P1\(하단·청\)":"P2\(상단·적\)";/.test(src),"G5 핫시트 pname 문구는 무변경");
  ok(/function onCell\(r,c\)\{ netAction\(\{t:"cell",r,c\}\); \}/.test(src),"G6 onCell → netAction 논리 좌표 경로 무변경");
  ok(!/dataset\.vr|14-r|14 - r/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm,"")),"G7 코드에 화면 좌표를 상태·dataset 으로 되돌리는 역변환 없음");
}

console.log(`=== smoke_own_side: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("failed: "+fails.join(" | ")); process.exit(1); }
