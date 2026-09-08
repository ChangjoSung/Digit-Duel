/* #93/#104 온라인 보드 방향(orientation) 독립 감사 — 헤드리스 2클라이언트 (Mars_3, 2026-09-08)
   사용: node demo/test/smoke_orientation_audit.js                 # 기본: git show 6baa0b5:demo/index.html 을 메모리로 로드 (작업 트리 무관·파일 쓰기 0)
        node demo/test/smoke_orientation_audit.js --ref <sha>     # 다른 고정 ref
        node demo/test/smoke_orientation_audit.js --path demo/index.html   # 작업 트리 파일
        git show <sha>:demo/index.html | node demo/test/smoke_orientation_audit.js --stdin
        옵션: --verbose (매핑 예시·통계) · --seeds N (퍼즈 시드 수, 기본 6) · --steps M (퍼즈 최대 행동, 기본 400)

   무엇을 재는가 (기존 smoke_own_side 63 · smoke_online_sync 23 을 대체하지 않고 사각지대를 메운다):
     · 화면 좌표는 dataset 이 아니라 **DOM 순서(index)** 로 잰다: #board 는 7열 grid(row-major) 이므로 DOM index i → 화면 (⌊i/7⌋+1, i%7+1).
       그 칸의 dataset(r,c) 와 그 칸의 칩(owner 클래스·own·hiddenId·아트 img 경로)이 **이 테스트가 독자 구현한 변환**
       (P1: 항등 / P2: 행 반사 row=14−r, col=c — 규격 5장) 및 **상대 클라이언트의 S** 로 예측한 값과 일치하는지 본다.
       같은 자리에서 180° 회전 가설(row=14−r, col=8−c)·항등 가설이 몇 칸이나 맞는지도 센다(가설 구분 근거).
     · 매 행동 뒤 양측 정규 S 동일 + 양측 91칸 전수 대조 + 이동한 말의 **화면 이동 벡터**(P1: (dr,dc) / P2: (−dr,dc)) + 강조(hl-sel/hl-move) 화면 위치.
     · 14 경기 = 열 7 × 유형 2 (자연 로스터·수동 배치·실제 matched→hello→hello2). 유형 post: BT 이전 1칸 전·후·측면 → 65턴 → 2칸 전·후·측면 → 중앙 7행·양쪽 숲 횡단 → 2행/12행.
       유형 pre: **65턴 이전에** 1칸씩 중앙 7행·양쪽 숲을 넘어 2행/12행까지(양 플레이어·모든 열) → 텔레포트 → 자연 턴 교대로 65턴 → 두 번째 하수인 2칸 전·후 + 65턴 이후 중앙 횡단. 턴 수는 강제 대입하지 않고 실제 턴 교대만 쓴다.
     · 숨은 말 2칸 충돌(#104 케이스) 을 P1 행위자·P2 행위자 양방향으로 자연 흐름에서 재현하고 전투를 실제 버튼으로 완주.
     · 역할 교대(같은 로드가 P2 가 되는 재매칭)·종료(over) 화면·상대 화면 강조 비노출·픽스처 91칸 전수(4회 렌더)·시드 퍼즈.
   회계 (rev 3, Saturn_1 REVISE 반영 — 이전 판은 step() 의 불일치를 fails 목록에만 넣고 fail 카운터·종료 코드에 반영하지 않는 false-green 이 있었다):
     · 모든 step()(행동 → 릴레이 → 양측 S 동일 + 양 화면 91칸 대조)이 ok() 로 집계된다 — 불일치 1건 = fail 1 = 종료 코드 1. 호출자가 반환값을 버려도 결과가 사라지지 않는다.
     · AUDIT.done/skipped(실제 91칸 대조 수행/오버레이로 생략) 와 step 수를 절마다 검사하고 요약에 출력한다: 횡단 경기는 생략 0, 전투 절은 battleLoop 완주(전투·오버레이 닫힘) 를 명시 검사한 뒤 대조.
     · 자기 검사(SELF): 제품을 바꾸지 않고 테스트 쪽 DOM 스텁만 손상시켜(owner 클래스·칩 제거·DOM 순서·data-flip) 오라클이 각 결함을 잡는지, step() 경로가 그 불일치를 실패로 기록하는지 확인한다.
     · 종료 코드: 0 = 전부 통과 · 1 = 판정 실패(fail>0 또는 fails 비어있지 않음) · 2 = 도구 오류(변이 앵커 없음 등, 대조 시작 전) · 3 = 대조 도중 스크립트 예외(그때까지의 집계를 출력).
   파일을 쓰지 않는다. */
"use strict";
const fs=require("fs"), path=require("path"), {execFileSync}=require("child_process");
const ROOT=path.resolve(__dirname,"..","..");
const DEFAULT_HTML=path.join(__dirname,"..","index.html");
const args=process.argv.slice(2);
const optStr=(k,d)=>{ const i=args.indexOf(k); return i>=0&&args[i+1]?args[i+1]:d; };
const optNum=(k,d)=>{ const i=args.indexOf(k); return i>=0&&args[i+1]?Number(args[i+1]):d; };
const VERBOSE=args.includes("--verbose"), SEEDS=optNum("--seeds",6), STEPS=optNum("--steps",400);
const REF=optStr("--ref",null), PATH_=optStr("--path",null);

/* ── 소스 확보: 고정 ref(기본 6baa0b5) 를 메모리로 — 작업 트리의 demo/index.html 은 병렬 작업(#106) 중이라 기본으로 읽지 않는다 ── */
let SRC, SRC_LABEL;
if(args.includes("--stdin")){ SRC=fs.readFileSync(0,"utf8"); SRC_LABEL="stdin"; }
else if(PATH_){ SRC=fs.readFileSync(path.resolve(PATH_),"utf8"); SRC_LABEL=PATH_; }
else { const ref=REF||"6baa0b5"; SRC=execFileSync("git",["show",ref+":demo/index.html"],{cwd:ROOT,maxBuffer:64*1024*1024}).toString("utf8"); SRC_LABEL="git:"+ref; }
/* ── 음성 대조용 변이(메모리 전용·파일 쓰기 0): --mutate <name> — 감사가 각 가설의 결함을 실제로 잡는지 증명한다 ── */
const MUTANTS={
  rotate180:[/for\(let c=1;c<=COLS;c\+\+\)\{\n    const r=flip\?ROWS\+1-i:i;/, "for(let c0=1;c0<=COLS;c0++){ const c=flip?COLS+1-c0:c0;\n    const r=flip?ROWS+1-i:i;"], // P2 화면을 180° 회전으로 (좌상→우하)
  flipByTurn:[/const boardFlipped=\(\)=> NET\.mode&&NET\.me===1;/, "const boardFlipped=()=> NET.mode&&S.current===1;"],                 // 반사가 뷰어가 아니라 현재 턴을 따름
  flipOnCross:[/const boardFlipped=\(\)=> NET\.mode&&NET\.me===1;/, "const boardFlipped=()=> NET.mode&&NET.me===1&&!alivePieces().some(p=>p.owner===1&&p.r>7);"], // 말이 중앙을 넘으면 반사 해제
  setupColMirror:[/x\.c=data\.pos\[i\]\[1\]; x\.placed=true;/, "x.c=(p===1)?(COLS+1-data.pos[i][1]):data.pos[i][1]; x.placed=true;"],      // P2 배치의 열을 미러 (렌더는 그대로) → 자기 배치가 좌우 반전되어 보임
  no104:[/p\.owner!==S\.current&&visibleTo\(S\.current,p\)\)\{/, "p.owner!==S.current&&visibleTo(humanViewer(),p)){"],   // #104 수정 제거 (뷰어 시점 분기)
  datasetSwap:[/cell\.dataset\.r=r; cell\.dataset\.c=c;/, "cell.dataset.r=flip?i:r; cell.dataset.c=c;"],                                         // dataset 에 화면 행을 넣음 (역변환 누락형 결함)
  // Saturn_1 REVISE 재현용 (2026-09-08): P2 화면에서 텔레포트 2단계 선택 중에만 칩의 owner 클래스를 뒤집는다 — 다음 렌더에서 원상복구되므로 step() 회계가 없으면 놓친다
  teleOwnerStage2:[/cell\.appendChild\(chip\);/, "if(NET.mode&&NET.me===1&&S.teleport&&S.teleport.stage===2) chip.className=chip.className.replace(/\\bp([01])\\b/,(m,o)=>\"p\"+(1-o)); cell.appendChild(chip);"],
};
const MUT=optStr("--mutate",null);
if(MUT){ const m=MUTANTS[MUT]; if(!m){ console.error("unknown mutant "+MUT+" — "+Object.keys(MUTANTS).join(",")); process.exit(2); }
  if(!m[0].test(SRC)){ console.error("mutant anchor not found: "+MUT); process.exit(2); } const mutated=SRC.replace(m[0],m[1]);
  if(mutated===SRC){ console.error("mutant produced no change: "+MUT); process.exit(2); } SRC=mutated; SRC_LABEL+="+mutate:"+MUT; console.log("MUTANT "+MUT+" applied (anchor matched, source changed)"); }
const H=require("./harness");
const ROWS=13, COLS=7, FILE_HREF="file:///C:/Digit-Duel/demo/index.html", CODE="5F65J3YKGD";
let pass=0,fail=0; const fails=[];
function ok(cond,name,detail){ if(cond) pass++; else { fail++; fails.push(name+(detail?" — "+detail:"")); console.error("FAIL: "+name+(detail?" — "+detail:"")); } }
let REC=ok; // step() 의 기록기 — 기본은 ok(); SELF 자기 검사에서만 잠시 포획기로 바꿔 회계 경로 자체를 검사한다
const log=(...a)=>{ if(VERBOSE) console.log(...a); };
const AUDIT={done:0,skipped:0,agreeFull:0,agreePartial:0,steps:0}; // done/skipped: auditScreen 실제 수행/생략 · agreeFull: 양 화면 모두 대조된 agree · agreePartial: 한쪽이라도 생략된 agree · steps: step() 호출 수
function summary(){
  console.log(`AUDIT done=${AUDIT.done} skipped=${AUDIT.skipped} agreeFull=${AUDIT.agreeFull} agreePartial=${AUDIT.agreePartial} steps=${AUDIT.steps}`);
  console.log(`\n=== smoke_orientation_audit [${SRC_LABEL}]: pass ${pass} / fail ${fail} ===`);
  if(fails.length){ console.log(fails.map(f=>"  - "+f).join("\n")); }
}
process.on("uncaughtException",e=>{ console.error("ABORT (script exception during audit): "+(e&&e.stack||e)); summary(); process.exit(3); });

/* ══════════════ 독자 변환 (제품 코드·dataset 을 쓰지 않는다) ══════════════ */
const XF={
  reflect:(v,r,c)=>v===1?{row:ROWS+1-r,col:c}:{row:r,col:c},          // 규격 5장 계약: 온라인 P2 행 반사·열 유지
  rotate:(v,r,c)=>v===1?{row:ROWS+1-r,col:COLS+1-c}:{row:r,col:c},   // CJ 가설: 180° 회전 (좌상 → 우하)
  identity:(v,r,c)=>({row:r,col:c}),
};
const idxOf=(row,col)=>(row-1)*COLS+(col-1);
const screenOf=i=>({row:Math.floor(i/COLS)+1,col:i%COLS+1});
/* 독자 가시성 (제품 visibleTo 를 부르지 않는다) */
const alive=S=>S.pieces.filter(p=>p.alive&&p.placed);
const inForestR=r=>(r>=4&&r<=5)||(r>=9&&r<=10);
const adjXY=(a,b)=>Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1;
function visIndep(S,viewer,e){ if(viewer===2||e.owner===viewer) return true; if(!inForestR(e.r)) return true; if(S.tempReveal.has(e.id)) return true; return alive(S).some(m=>m.owner===viewer&&adjXY(m,e)); }

/* ══════════════ 두 로드 락스텝 픽스처 ══════════════ */
function load(){
  const T=H.load(DEFAULT_HTML,{html:SRC,href:FILE_HREF,storage:H.mkStorage({tutorialSeen:"1"})});
  const box=T.byId("overlayBox"), ob=T.byId("obBtns"); // 브라우저처럼 overlayBox 교체 시 옛 #obBtns 버튼 제거 (스텁 id 캐시 누적 방지 — 테스트 쪽 조치)
  Object.defineProperty(box,"innerHTML",{configurable:true,get(){return this._html;},set(v){this._html=v; this.children.length=0; ob.children.length=0;}});
  if(/id="overlay"[^>]*class="[^"]*\bhidden\b/.test(SRC)) T.byId("overlay").classList.add("hidden"); // 실제 HTML 초기 상태(class="overlay hidden") 재현 — 스텁은 빈 클래스로 시작한다
  return T;
}
const act=(T,fn)=>{ T.activate(); const r=fn(); T.drain(); return r; };
const overlayOpen=T=>!T.byId("overlay")._cls.has("hidden");
const curBtns=(T,n)=>T.byId("obBtns").children.slice(-n);
const pickerOpen=T=>overlayOpen(T)&&/정체 추측/.test(T.byId("overlayBox").innerHTML);

/* 로스터 6종 × 14개 수동 배치 — 각 경기는 서로 다른 로스터·배치 (SETUP 생성기: 비운 칸 집합을 받아 나머지 14칸을 채운다) */
const ROSTER_SETS=[["M-F2","M-W1","M-G3","M-L4","M-F5","M-W2"],["M-L1","M-G2","M-W3","M-F4","M-L5","M-G1"],["M-F1","M-W4","M-G5","M-L2","M-F3","M-W5"],
  ["M-G4","M-L3","M-F4","M-W2","M-G1","M-L5"],["M-W1","M-F5","M-L1","M-G2","M-W3","M-F2"],["M-L4","M-G3","M-W5","M-F1","M-L2","M-G5"],["M-F3","M-W4","M-G4","M-L3","M-W2","M-F5"]];
const TYPE_ORDER=["minion","minion","minion","minion","minion","minion","bomb","bomb","bomb","ally","ally","trap","trap","king"]; // newGame 의 소유자별 말 순서
function mkSetup(rosterIdx,empties,front){ // empties: 로컬(11~13행) 기준 비울 칸 "r_c" 집합 · front: 첫 하수인(횡단 말)을 둘 칸
  const cells=[]; for(const r of [11,12,13]) for(let c=1;c<=COLS;c++) if(!empties.has(r+"_"+c)&&!(front&&front[0]===r&&front[1]===c)) cells.push([r,c]);
  if(cells.length+(front?1:0)!==14) throw new Error("setup cells "+cells.length);
  const pos={minion:[],bomb:[],ally:[],trap:[],king:[]}; let k=0;
  for(const t of TYPE_ORDER){ if(t==="minion"&&front&&!pos.minion.length){ pos.minion.push(front); continue; } pos[t].push(cells[k++]); }
  return {roster:ROSTER_SETS[rosterIdx%ROSTER_SETS.length],pos};
}
function prepare(T,setup){ // 실제 경로: netPrepare → 로스터 토글 → selTray → onCell → setupDone (배치 단계 DOM 위치 기록)
  T.byId("netCode").value=CODE;
  act(T,()=>global.netPrepare());
  for(const rid of setup.roster) act(T,()=>global.toggleRoster(rid));
  const used={}, placedIdx=[];
  for(const p of T.S.pieces.filter(x=>x.owner===0)){
    const k=used[p.type]=(used[p.type]||0); used[p.type]++;
    const [r,c]=setup.pos[p.type][k];
    act(T,()=>global.selTray(p.id)); act(T,()=>T.onCell(r,c));
    const cells=T.byId("board").children; const i=cells.findIndex(x=>+x.dataset.r===r&&+x.dataset.c===c); // 배치 단계 화면 위치 (P0 로컬 프레임)
    placedIdx.push({type:p.type,rosterId:p.rosterId,localR:r,localC:c,domIdx:i,chipThere:!!cells[i].children.find(k=>/\bpc\b/.test(k.className))});
  }
  const flipSetup=String(T.byId("board").dataset.flip);
  act(T,()=>global.setupDone());
  return {placedIdx,flipSetup};
}
function pair(setups,order){ // order: [T1 이 받을 you, T2 가 받을 you] — 기본 T1=p1
  order=order||["p1","p2"];
  const T1=load(), T2=load();
  const prep=[prepare(T1,setups[0]),prepare(T2,setups[1])];
  const ws=[T1.wsLog[T1.wsLog.length-1],T2.wsLog[T2.wsLog.length-1]]; ws.forEach(w=>{ w.readyState=1; });
  const R={T:[T1,T2],ws,sent:[0,0],prep,flipSeen:[new Set(),new Set()]};
  const deliver=(i,m)=>act(R.T[i],()=>ws[i].onmessage({data:JSON.stringify(m)}));
  const first=order[0]==="p1"?0:1; // 서버는 p1 에게 먼저 matched 를 보낸다
  deliver(first,{type:"matched",room:1,you:"p1"}); deliver(1-first,{type:"matched",room:1,you:"p2"});
  relay(R);
  R.P=[R.T.find(T=>T.NET.me===0),R.T.find(T=>T.NET.me===1)]; // R.P[m] = 플레이어 m 의 클라이언트
  return R;
}
function relay(R){
  for(let k=0;k<60;k++){ let moved=0;
    for(const i of [0,1]){ const w=R.ws[i];
      while(R.sent[i]<w.sent.length){ const m=JSON.parse(w.sent[R.sent[i]++]); act(R.T[1-i],()=>R.ws[1-i].onmessage({data:JSON.stringify(m)})); moved++; } }
    if(!moved) break; }
  for(const T of R.T) act(T,()=>T.netPump());
}
function canon(S){ return S.pieces.map(p=>({id:p.id,owner:p.owner,type:p.type,rosterId:p.rosterId,name:p.name,element:p.element,hp:p.hp,maxHp:p.maxHp,atk:p.atk,skills:p.skills,cds:p.cds,
  r:p.r,c:p.c,placed:p.placed,alive:p.alive,revealed:p.revealed,immobile:p.immobile,cap:p.cap?{el:p.cap.element,hp:p.cap.hp}:null,burn:p.burn,weaken:p.weaken,shield:p.shield,shock:p.shock,movedEver:p.movedEver})); }
function gameCanon(T){ const S=T.S; return {phase:S.phase,current:S.current,turn:S.turnCount,mainUsed:S.mainUsed,battlesUsed:S.battlesUsed,
  sel:S.selected?(S.selected.tray?"tray":S.selected.id):null,forced:S.forcedTargets.slice(),tele:S.teleport?{stage:S.teleport.stage,piece:S.teleport.piece?S.teleport.piece.id:null}:null,
  moved:S.movedPiece?S.movedPiece.id:null,battle:S.battle?{att:S.battle.attP.id,def:S.battle.defP.id,round:S.battle.round,phase:S.battle.phase}:null,
  events:S.events.map(e=>[e.r,e.c,e.kind,e.consumed]),balls:S.balls.slice(),inv:S.inv.map(a=>a.slice()),reserve:S.reserve.map(x=>x?x.element:null),
  traces:S.traces.map(t=>[...t].sort()),tempReveal:[...S.tempReveal].sort(),teleUsed:S.teleUsed.slice(),winner:S.winner,seq:T.NET.modalSeq,pieces:canon(S)}; }
function firstDiff(a,b,p){ if(typeof a!=="object"||typeof b!=="object"||a===null||b===null) return a===b?null:`${p}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`;
  for(const k of new Set([...Object.keys(a),...Object.keys(b)])){ const d=firstDiff(a[k],b[k],p+"."+k); if(d) return d; } return null; }

/* ══════════════ 핵심 대조: DOM(index) ↔ 독자 변환 ↔ 상대 S ══════════════ */
const ROSTER_ARCH=T=>Object.fromEntries(T.ROSTER.map(r=>[r.id,r.element+"_"+r.arch]));
/* T 의 화면을 Sref(기본: 상대 클라이언트의 S) 로 예측한다. 반환: {bad:첫 불일치|null, hyp:{reflect,rotate,identity} 각 가설이 맞춘 칸 수, chips} */
function auditScreen(T,Sref,label,force){
  Sref=Sref||T.S;
  const me=T.NET.me, viewer=(T.S.phase==="over"||T.S.mode==="sim")?2:me, flipExpect=T.NET.mode&&me===1;
  const bd=T.byId("board"), cells=bd.children;
  if(!force&&(T.S.battle||overlayOpen(T))){ AUDIT.skipped++; return {skipped:true}; } // 오버레이 뒤의 보드는 닫힐 때 다시 그린다 — 닫힌 상태에서만 대조
  AUDIT.done++;
  if(cells.length!==ROWS*COLS) return {bad:`${label}: cells ${cells.length}`};
  if(String(bd.dataset.flip)!==(flipExpect?"1":"0")) return {bad:`${label}: data-flip=${bd.dataset.flip} expected ${flipExpect?1:0}`};
  const hyp={reflect:0,rotate:0,identity:0}; const arch=ROSTER_ARCH(T);
  const byCell={}; for(const p of alive(Sref)) byCell[p.r+"_"+p.c]=p;
  const chips=[];
  for(let i=0;i<cells.length;i++){
    const x=cells[i], r=+x.dataset.r, c=+x.dataset.c, sc=screenOf(i);
    for(const h of Object.keys(XF)){ const e=XF[h](me===1?1:0,r,c); if(e.row===sc.row&&e.col===sc.col) hyp[h]++; }
    // 1) 이 DOM 자리(화면 좌표)에 와야 할 논리 칸 = 역변환(반사는 자기 역함수)
    const want=XF.reflect(me===1?1:0,sc.row,sc.col);
    if(want.row!==r||want.col!==c) return {bad:`${label}: DOM#${i} screen(${sc.row},${sc.col}) holds logical (${r},${c}); reflect-contract expects (${want.row},${want.col})`,hyp};
    // 2) 진영 색 클래스는 논리 행 기준
    const zone=r<=3?"zA":r<=5?"forest":r<=8?"":r<=10?"forest":"zB";
    if(zone&&!new RegExp("\\b"+zone+"\\b").test(x.className)) return {bad:`${label}: zone class at (${r},${c}) ${x.className}`,hyp};
    // 3) 칩: 상대 S 의 그 논리 칸 말 → 이 뷰어에게 보이는가·소유자·공개·아트
    const p=byCell[r+"_"+c]||null, chip=x.children.find(k=>/\bpc\b/.test(k.className))||null;
    const vis=!!p&&visIndep(Sref,viewer,p);
    if(!!chip!==vis) return {bad:`${label}: chip ${chip?"present":"missing"} at screen(${sc.row},${sc.col}) logical (${r},${c}) piece=${p?p.id+"/P"+(p.owner+1):"-"} viewer=${viewer}`,hyp};
    if(chip){ const known=viewer===2||p.owner===viewer||p.revealed;
      if(!new RegExp("\\bp"+p.owner+"\\b").test(chip.className)) return {bad:`${label}: owner class at (${r},${c}) ${chip.className}`,hyp};
      if((p.owner===viewer)!==/\bown\b/.test(chip.className)) return {bad:`${label}: own class at (${r},${c})`,hyp};
      if(known===/\bhiddenId\b/.test(chip.className)) return {bad:`${label}: known/hiddenId at (${r},${c})`,hyp};
      if(known&&p.type==="minion"&&p.rosterId){ const dir=arch[p.rosterId]; const m=chip.innerHTML.match(/src="([^"]+)"/);
        if(m&&!m[1].includes("/"+dir+"/")) return {bad:`${label}: art dir at (${r},${c}) ${m[1]} ≠ ${dir}`,hyp}; }
      if(!known&&chip.innerHTML!=="?"&&!/guess/.test(chip.className)) return {bad:`${label}: hidden body at (${r},${c})`,hyp};
      chips.push({i,screen:sc,r,c,id:p.id,owner:p.owner,known}); }
  }
  return {bad:null,hyp,chips,viewer,flip:flipExpect};
}
/* 강조 화면 위치: hl-sel/hl-move/hl-attack 이 붙은 DOM index 목록 */
function hl(T){ const out={sel:[],move:[],attack:[]}; T.byId("board").children.forEach((x,i)=>{ if(x._cls.has("hl-sel")) out.sel.push(i); if(x._cls.has("hl-move")) out.move.push(i); if(x._cls.has("hl-attack")) out.attack.push(i); }); return out; }
/* 양측 전체 대조 (매 행동 뒤) */
function agree(R,tag){
  const [A,B]=R.P; const d=firstDiff(gameCanon(A),gameCanon(B),"S");
  const q=A.NET.queue.length+B.NET.queue.length;
  if(d||q) return `${tag}: ${d||""}${q?` queue P1=${A.NET.queue.length} P2=${B.NET.queue.length}`:""}`;
  const a=auditScreen(A,B.S,tag+" P1-screen←P2.S"), b=auditScreen(B,A.S,tag+" P2-screen←P1.S");
  if(a.skipped||b.skipped) AUDIT.agreePartial++; else AUDIT.agreeFull++;
  if(a.bad) return a.bad; if(b.bad) return b.bad;
  for(const [i,T] of R.T.entries()) R.flipSeen[i].add(String(T.byId("board").dataset.flip));
  return null;
}
function actorClient(R){ const a=act(R.P[0],()=>R.P[0].netActor()); return R.P[a]; }
/* 행동 1회 = 집계 1회: 불일치는 fails 목록이 아니라 REC(=ok) 로 기록되어 fail 카운터·종료 코드에 반드시 반영된다 (rev 3). 반환값은 호출자 편의일 뿐 회계와 무관 */
function step(R,tag,fn){ const X=actorClient(R); act(X,()=>fn(X)); relay(R); const bad=agree(R,tag); AUDIT.steps++; R.steps=(R.steps||0)+1; REC(!bad,`${tag} — 양측 S 동일·양 화면 91칸 대조`,bad); return !bad; }
function passTurn(R,tag){ return step(R,tag+" skip",X=>X.netAction({t:"skipMain"}))&&step(R,tag+" end",X=>X.netAction({t:"endTurn"})); }
function untilActor(R,me,tag){ let n=0; const ready=()=>{ const X=actorClient(R); return X.NET.me===me&&!X.S.mainUsed&&!X.S.battle&&!X.S.forcedTargets.length; };
  while(!ready()&&n++<8){ if(!passTurn(R,tag)) return false; } return ready(); }
function untilTurn(R,turn,tag){ let n=0; while(R.P[0].S.turnCount<turn&&n++<400){ if(!passTurn(R,tag)) return false; } return R.P[0].S.turnCount>=turn; }
/* 화면 벡터: 말 id 의 칩이 있는 DOM index (dataset 을 쓰지 않고 상대 S 좌표 + 독자 변환으로 예측한 자리에 칩이 있는지) */
function chipIdx(T,Sref,id){ const p=Sref.pieces.find(x=>x.id===id); const e=XF.reflect(T.NET.me===1?1:0,p.r,p.c); const i=idxOf(e.row,e.col); const x=T.byId("board").children[i];
  return x&&x.children.some(k=>/\bpc\b/.test(k.className))?i:-1; }
/* 한 말을 (r,c) 로 실제 클릭 이동 — 선택 강조·이동 벡터·상대 화면 비노출·양측 대조 */
function move(R,me,pieceId,r,c,tag,expectStop){
  if(!untilActor(R,me,tag)) return false;
  const X=R.P[me], Y=R.P[1-me]; const p0=X.S.pieces.find(x=>x.id===pieceId); const from=[p0.r,p0.c];
  let all=step(R,`${tag} sel(${from})`,T=>T.onCell(from[0],from[1]));
  const hx=hl(X), hy=hl(Y);
  const selIdx=chipIdx(X,Y.S,pieceId);
  ok(hx.sel.length===1&&hx.sel[0]===selIdx&&selIdx>=0,`${tag} 행위자 화면 hl-sel 이 그 말의 화면 자리(DOM#${selIdx})에`,JSON.stringify(hx.sel));
  ok(hy.sel.length===0&&hy.move.length===0&&hy.attack.length===0,`${tag} 상대 화면에는 선택·이동 강조 없음`,JSON.stringify(hy));
  const eTarget=XF.reflect(me,r,c); const tIdx=idxOf(eTarget.row,eTarget.col);
  ok(hx.move.includes(tIdx),`${tag} 목표 (${r},${c}) 의 화면 자리 DOM#${tIdx} 가 hl-move 에 포함`,JSON.stringify(hx.move));
  // 화면 방향: 전진(상대 진영 방향)은 두 플레이어 모두 화면 위(row 감소)
  const fwd=me===0?from[0]-r:r-from[0]; const sFrom=screenOf(selIdx), sTo=screenOf(tIdx);
  const expDRow=me===0?(r-from[0]):-(r-from[0]), expDCol=c-from[1];
  ok(sTo.row-sFrom.row===expDRow&&sTo.col-sFrom.col===expDCol,`${tag} 화면 벡터 (${sTo.row-sFrom.row},${sTo.col-sFrom.col}) = 예측 (${expDRow},${expDCol}) [논리 (${r-from[0]},${c-from[1]}) · 전진량 ${fwd}]`);
  if(fwd>0) ok(sTo.row<sFrom.row,`${tag} 전진 = 화면 위`);
  if(fwd<0) ok(sTo.row>sFrom.row,`${tag} 후진 = 화면 아래`);
  all=step(R,`${tag} mv→(${r},${c})`,T=>T.onCell(r,c))&&all;
  const p1=X.S.pieces.find(x=>x.id===pieceId), stop=expectStop||[r,c];
  ok(p1.r===stop[0]&&p1.c===stop[1],`${tag} 이동 적용 (${from})→(${stop}) 행위자 S`,`(${p1.r},${p1.c}) battle=${!!X.S.battle} forced=${X.S.forcedTargets.length}`);
  const p2=Y.S.pieces.find(x=>x.id===pieceId);
  ok(p2.r===p1.r&&p2.c===p1.c,`${tag} 상대 S 도 같은 논리 좌표`);
  if(!X.S.battle&&!overlayOpen(X)&&!overlayOpen(Y)){
    const ix=chipIdx(X,Y.S,pieceId), iy=chipIdx(Y,X.S,pieceId);
    const ex=XF.reflect(me,p1.r,p1.c), ey=XF.reflect(1-me,p1.r,p1.c);
    ok(ix===idxOf(ex.row,ex.col),`${tag} 행위자 화면 칩 DOM#${ix} = 독자 변환 (${ex.row},${ex.col})`);
    const visY=visIndep(X.S,1-me,p1);
    ok(visY?iy===idxOf(ey.row,ey.col):iy===-1,`${tag} 상대 화면 칩 ${visY?`DOM#${iy} = 독자 변환 (${ey.row},${ey.col})`:"비노출(숨은 말)"}`);
  }
  return all;
}

/* ══════════════ 1. 자연 경기 7판: 모든 열 횡단 (BT 이전·이후, 전·후·측면·2칸·중앙 횡단·텔레포트·역할 교대) ══════════════ */
function teleSwap(R,tag,w1,w2){ // 텔레포트 스왑: 상대 진영에 말이 있으므로 가능 — 횡단 말 ↔ 자기 진영 폭탄
  for(const m of [0,1]){ if(!untilActor(R,m,tag+" tele")) break; const X=R.P[m], w=m===0?w1:w2;
    const bomb=X.S.pieces.find(x=>x.owner===m&&x.type==="bomb"&&x.alive&&x.placed); const wid=w.id, bid=bomb.id; const wPos=[w.r,w.c], bPos=[bomb.r,bomb.c];
    ok(act(X,()=>X.teleportAvailable(m)),`${tag} P${m+1} 텔레포트 가능`);
    step(R,`${tag} P${m+1} tele on`,T=>T.netAction({t:"tele"}));
    const h1=hl(X); const eB=XF.reflect(m,bPos[0],bPos[1]);
    ok(h1.move.includes(idxOf(eB.row,eB.col)),`${tag} P${m+1} 텔레포트 1단계 강조가 자기 말 화면 자리에`);
    ok(hl(R.P[1-m]).move.length===0,`${tag} 상대 화면 텔레포트 강조 비노출`);
    step(R,`${tag} P${m+1} tele pick1`,T=>T.onCell(wPos[0],wPos[1]));
    step(R,`${tag} P${m+1} tele pick2`,T=>T.onCell(bPos[0],bPos[1]));
    const w_=X.S.pieces.find(x=>x.id===wid), b_=X.S.pieces.find(x=>x.id===bid), Y=R.P[1-m];
    ok(w_.r===bPos[0]&&w_.c===bPos[1]&&b_.r===wPos[0]&&b_.c===wPos[1],`${tag} P${m+1} 스왑 적용 (행위자 S)`,`w=(${w_.r},${w_.c}) b=(${b_.r},${b_.c}) battle=${!!X.S.battle}`);
    const wy=Y.S.pieces.find(x=>x.id===wid); ok(wy.r===w_.r&&wy.c===w_.c,`${tag} P${m+1} 스왑 상대 S 동일`);
    if(!X.S.battle&&!overlayOpen(X)){ for(const [T,S2,who] of [[X,Y.S,"행위자"],[Y,X.S,"상대"]]){ const ex=XF.reflect(T.NET.me,b_.r,b_.c); const vis=visIndep(S2,T.NET.me,b_); const i=chipIdx(T,S2,bid);
      ok(vis?i===idxOf(ex.row,ex.col):i===-1,`${tag} P${m+1} 스왑 후 폭탄 칩 ${who} 화면 ${vis?`DOM#${i}=(${ex.row},${ex.col})`:"비노출"}`); } }
    if(X.S.phase==="play"&&!X.S.forcedTargets.length&&!X.S.battle) step(R,`${tag} P${m+1} tele end`,T=>T.netAction({t:"endTurn"}));
  }
}
function crossingGame(k,order,pre){
  const wc1=k+1, wc2=((k+3)%7)+1;                 // P1 횡단 열·P2 횡단 열 (열 차 3 이상 → 두 말이 인접할 수 없다)
  const emptiesFor=wc=>{ const s=new Set(); for(const r of [11,12,13]) s.add(r+"_"+wc); for(const r of [11,12]) for(const d of [-1,1]) if(wc+d>=1&&wc+d<=COLS) s.add(r+"_"+(wc+d)); return s; };
  // P1 은 P2 횡단 열(wc2) 주변을, P2 는 P1 횡단 열(wc1) 주변을 비운다 (로컬 11~13행 프레임; P2 는 14−r 로 미러되므로 논리 1~3행에서 같은 모양)
  const e1=emptiesFor(wc2), e2=emptiesFor(wc1);
  // 남는 칸 = 21 − |empties| ; 14 개가 들어가야 하므로 초과분은 채워야 한다 → empties 를 필요한 만큼만 남긴다 (경계 열은 5개만 비므로 14+5=19<21 → 2칸 추가로 비운다)
  const trim=(s,wc)=>{ const need=21-14; const arr=[...s]; while(arr.length>need) arr.pop(); const out=new Set(arr); let c=1; while(out.size<need){ const cand="13_"+c; if(!out.has(cand)&&c!==wc&&Math.abs(c-wc)>1) out.add(cand); c++; } return out; };
  const E1=trim(e1,wc1), E2=trim(e2,wc2);
  const setups=[mkSetup(k,E1,[11,wc1]),mkSetup(k+3,E2,[11,wc2])];
  const R=pair(order[0]==="p1"?setups:[setups[1],setups[0]],order); const [A,B]=R.P; const tag=`G${k+1}${pre?"pre":"post"}(col P1=${wc1},P2=${wc2})`;
  const d0=AUDIT.done, s0=AUDIT.skipped; // 이 경기 동안의 실제 대조 수행 회계 (경기 끝에서 검사)
  ok(A.NET.me===0&&B.NET.me===1&&A.S.phase==="play"&&B.S.phase==="play",`${tag} 시작 (matched→hello→hello2)`);
  // 배치 보존: 각자가 배치 단계에 본 화면 자리(DOM index)와 시작 후 자기 화면 자리가 같다 (P1: 항등 / P2: 미러 후 반사 = 항등)
  for(const m of [0,1]){ const T=R.P[m], i=R.T.indexOf(T), prep=R.prep[i];
    ok(prep.flipSetup==="0",`${tag} P${m+1} 배치 단계 flip=0`);
    const mine=T.S.pieces.filter(x=>x.owner===m); let same=0;
    prep.placedIdx.forEach((q,j)=>{ const p=mine[j]; const e=XF.reflect(m,p.r,p.c); if(idxOf(e.row,e.col)===q.domIdx&&p.type===q.type) same++; });
    ok(same===14,`${tag} P${m+1} 배치 단계 화면 자리 14개가 시작 후 자기 화면 자리와 동일 (배치 보존)`,`same=${same}`);
    // 상대 화면에서는 행 반사 자리 (P2 가 배치한 좌하 → P1 화면 좌상)
    const O=R.P[1-m]; let mirror=0;
    prep.placedIdx.forEach((q,j)=>{ const p=mine[j]; const e=XF.reflect(1-m,p.r,p.c); const s=screenOf(q.domIdx); if(e.row===ROWS+1-s.row&&e.col===s.col) mirror++; });
    ok(mirror===14,`${tag} P${m+1} 의 배치가 상대 화면에서는 행만 뒤집힌 자리(열 동일)`,`mirror=${mirror}`);
  }
  const g0=agree(R,tag+" start"); ok(!g0,`${tag} 시작 직후 양측 S·91칸 대조`,g0||"");
  const a0=auditScreen(A,B.S,"a"), b0=auditScreen(B,A.S,"b");
  if(a0.hyp&&b0.hyp){ log(`${tag} 가설 적중 칸수 P1 화면 ${JSON.stringify(a0.hyp)} · P2 화면 ${JSON.stringify(b0.hyp)}`);
    ok(a0.hyp.reflect===91&&a0.hyp.identity===91&&b0.hyp.reflect===91&&b0.hyp.rotate===13&&b0.hyp.identity===7,`${tag} 가설 판별: P2 화면은 행 반사 91/91, 180° 회전은 중앙열 13칸만, 항등은 7행 7칸만`,JSON.stringify([a0.hyp,b0.hyp])); }
  const w1=A.S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.r===11&&x.c===wc1), w2=B.S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.r===3&&x.c===wc2);
  ok(w1&&w2,`${tag} 횡단 말 (11,${wc1}) · (3,${wc2}) 존재`);
  if(!w1||!w2) return;
  const lat1=wc1+1<=COLS?wc1+1:wc1-1, lat2=wc2+1<=COLS?wc2+1:wc2-1;
  // BT 이전: 전진 3 (11→8 / 3→6) · 측면 · 후진 · 전진 · 측면 복귀
  for(let i=1;i<=3;i++){ move(R,0,w1.id,11-i,wc1,`${tag} pre P1 fwd`); move(R,1,w2.id,3+i,wc2,`${tag} pre P2 fwd`); }
  move(R,0,w1.id,8,lat1,`${tag} pre P1 lateral`); move(R,1,w2.id,6,lat2,`${tag} pre P2 lateral`);
  move(R,0,w1.id,9,lat1,`${tag} pre P1 back`);    move(R,1,w2.id,5,lat2,`${tag} pre P2 back`);
  move(R,0,w1.id,8,lat1,`${tag} pre P1 fwd2`);    move(R,1,w2.id,6,lat2,`${tag} pre P2 fwd2`);
  move(R,0,w1.id,8,wc1,`${tag} pre P1 lateral-back`); move(R,1,w2.id,6,wc2,`${tag} pre P2 lateral-back`);
  ok(A.S.turnCount<64,`${tag} 이 시점은 BT 이전 (turn ${A.S.turnCount+1})`);
  if(!pre){ // ── 경기 유형 A(post): 65턴 이후에 중앙·양쪽 숲을 횡단 (첫 감사와 동일) ──
  // 65턴까지 실제 버튼 경로로 교대 (매 교대마다 양측 91칸 대조)
  ok(untilTurn(R,64,tag+" ff"),`${tag} 65턴까지 턴 교대 (매 교대 대조)`); ok(act(A,()=>A.isBurning()),`${tag} BT 진입`);
  // BT: 2칸 후진·전진·측면·복귀 (원정 구역 밖: P1 6~13행 / P2 1~8행)
  move(R,0,w1.id,10,wc1,`${tag} BT P1 back2`);   move(R,1,w2.id,4,wc2,`${tag} BT P2 back2`);
  move(R,0,w1.id,8,wc1,`${tag} BT P1 fwd2`);     move(R,1,w2.id,6,wc2,`${tag} BT P2 fwd2`);
  const l21=wc1+2<=COLS?wc1+2:wc1-2, l22=wc2+2<=COLS?wc2+2:wc2-2;
  move(R,0,w1.id,8,l21,`${tag} BT P1 lateral2`);  move(R,1,w2.id,6,l22,`${tag} BT P2 lateral2`);
  move(R,0,w1.id,8,wc1,`${tag} BT P1 lateral2-back`); move(R,1,w2.id,6,wc2,`${tag} BT P2 lateral2-back`);
  // 중앙(7행) 횡단 → 상대 숲 → 상대 진영 2행/12행 (1칸씩)
  for(let r=7;r>=2;r--){ move(R,0,w1.id,r,wc1,`${tag} cross P1 →${r}`); move(R,1,w2.id,14-r,wc2,`${tag} cross P2 →${14-r}`); }
  ok(w1.r===2&&w2.r===12,`${tag} 두 말이 상대 진영 2행·12행 도달`,`(${w1.r},${w1.c}) (${w2.r},${w2.c})`);
  ok(R.flipSeen[0].size===1&&R.flipSeen[1].size===1,`${tag} 각 클라이언트의 data-flip 이 경기 내내 불변 (턴 교대·중앙 횡단·BT 무관)`,JSON.stringify(R.flipSeen.map(s=>[...s])));
    teleSwap(R,tag,w1,w2);
  } else { // ── 경기 유형 B(pre): 65턴 **이전**에 1칸씩 중앙 7행·양쪽 숲을 넘어 2행/12행까지 (CJ: 오류는 65턴 이전에도 날 수 있다) ──
    for(let r=7;r>=2;r--){ move(R,0,w1.id,r,wc1,`${tag} PRE65 cross P1 →${r}`); move(R,1,w2.id,14-r,wc2,`${tag} PRE65 cross P2 →${14-r}`); }
    ok(w1.r===2&&w2.r===12&&A.S.turnCount<64,`${tag} PRE65: 두 말이 65턴 이전에 상대 진영 2행·12행 도달 (turn ${A.S.turnCount+1})`,`(${w1.r},${w1.c}) (${w2.r},${w2.c})`);
    ok(R.flipSeen[0].size===1&&R.flipSeen[1].size===1,`${tag} PRE65: 각 클라이언트의 data-flip 이 횡단 내내 불변`,JSON.stringify(R.flipSeen.map(s=>[...s])));
    teleSwap(R,tag+" PRE65",w1,w2);
    // 이어서 자연 턴 교대로 65턴 → 두 번째 하수인으로 BT 2칸 전·후 + 65턴 이후 중앙 횡단(상대 숲 5행/9행까지) — post 유형 보존
    ok(untilTurn(R,64,tag+" ff"),`${tag} 65턴까지 자연 턴 교대 (매 교대 대조)`); ok(act(A,()=>A.isBurning()),`${tag} BT 진입`);
    const c1=A.S.pieces.filter(x=>x.owner===0&&x.type==="minion"&&x.alive&&x.placed&&x.r===11&&x.c!==wc1&&Math.abs(x.c-wc2)>=2);
    const c2=B.S.pieces.filter(x=>x.owner===1&&x.type==="minion"&&x.alive&&x.placed&&x.r===3&&x.c!==wc2&&Math.abs(x.c-wc1)>=2);
    let s1=null,s2=null; for(const a of c1){ for(const b of c2) if(Math.abs(a.c-b.c)>=2){ s1=a; s2=b; break; } if(s1) break; }
    ok(s1&&s2,`${tag} post65 용 두 번째 하수인 선택 (P1 (11,${s1&&s1.c}) · P2 (3,${s2&&s2.c}))`);
    if(s1&&s2){ const x=s1.c, y=s2.c;
      move(R,0,s1.id,10,x,`${tag} post65 P1 fwd`); move(R,1,s2.id,4,y,`${tag} post65 P2 fwd`);
      move(R,0,s1.id,8,x,`${tag} post65 P1 fwd2`); move(R,1,s2.id,6,y,`${tag} post65 P2 fwd2`);
      move(R,0,s1.id,10,x,`${tag} post65 P1 back2`); move(R,1,s2.id,4,y,`${tag} post65 P2 back2`);
      move(R,0,s1.id,8,x,`${tag} post65 P1 fwd2b`); move(R,1,s2.id,6,y,`${tag} post65 P2 fwd2b`);
      for(const r of [7,6,5]){ move(R,0,s1.id,r,x,`${tag} post65 cross P1 →${r}`); move(R,1,s2.id,14-r,y,`${tag} post65 cross P2 →${14-r}`); }
      ok(s1.r===5&&s2.r===9,`${tag} post65: 두 번째 하수인이 65턴 이후 중앙을 넘어 상대 숲 5행/9행 도달`,`(${s1.r},${s1.c}) (${s2.r},${s2.c})`); }
    ok(R.flipSeen[0].size===1&&R.flipSeen[1].size===1,`${tag} 경기 내내 data-flip 불변 (pre·post 모두)`,JSON.stringify(R.flipSeen.map(s=>[...s])));
  }
  // 회계: 이 경기의 모든 step 이 양 화면을 실제로 대조했다 (시작 agree 2 + 가설 판별 2 + step 마다 2) · 오버레이 생략 0 — 공허 통과 차단
  const dDone=AUDIT.done-d0, dSkip=AUDIT.skipped-s0;
  log(`${tag} 회계: step ${R.steps} · 91칸 대조 수행 ${dDone} · 생략 ${dSkip} · turn ${A.S.turnCount+1}`);
  ok(dSkip===0&&dDone===2*R.steps+4,`${tag} 회계: 91칸 대조 실제 수행 ${dDone}회 = step ${R.steps}×2+4 · 생략 ${dSkip}회 (0 이어야 함)`);
  return R;
}
for(let k=0;k<7;k++){ const order=k%2?["p2","p1"]:["p1","p2"]; crossingGame(k,order,false); crossingGame(k,order,true); } // 열 k+1: post 유형·pre 유형 각 1경기 · 홀수 경기는 첫 로드가 P2 — flip 이 로드 순서가 아니라 NET.me 를 따르는지

/* ══════════════ 2. 숨은 말 2칸 충돌(#104) — P1 행위자 · P2 행위자 양방향, 전투 실제 버튼 완주, 밀어내기/공개 후 양 화면 ══════════════ */
function battleLoop(R,tag,limit){ // 동기화 모달·전투 버튼을 소유자/행위자가 실제 클릭 (퍼즈와 동일 경로)
  let n=0; limit=limit||200; let stuck=null;
  while(n++<limit){ const [A,B]=R.P; const X=actorClient(R);
    if(!X.S.battle&&!overlayOpen(A)&&!overlayOpen(B)) break;
    if(A.NET.syncModal&&(overlayOpen(A)||overlayOpen(B))){ const own=A.NET.syncModal.owner, O=R.P[own]; const btns=curBtns(O,O.NET.syncModal.fns.length).filter(b=>!b.disabled); if(!btns.length){ stuck="sync modal no buttons"; break; } act(O,()=>btns[0].onclick()); relay(R); continue; }
    if(X.S.battle){ act(X,()=>global.__act("basic")); relay(R); continue; }
    if(overlayOpen(X)){ const btns=curBtns(X,1); if(btns.length&&btns[0].onclick) act(X,()=>btns[0].onclick()); relay(R); continue; }
    stuck="overlay open on non-actor without sync modal"; break; }
  // 명시 완주 검사 (rev 3): 한도 소진·버튼 없음·오버레이 잔존이면 실패 — 뒤따르는 보드 대조가 생략되어 조용히 통과하는 일이 없게 한다
  const [A,B]=R.P, X=actorClient(R);
  ok(!stuck&&n<=limit&&!X.S.battle&&!A.S.battle&&!B.S.battle&&!overlayOpen(A)&&!overlayOpen(B),`${tag} battleLoop 완주: 전투·오버레이 닫힘 (반복 ${n}/${limit})`,stuck||`battle=${!!X.S.battle} overlayA=${overlayOpen(A)} overlayB=${overlayOpen(B)}`);
  const s0=AUDIT.skipped; const bad=agree(R,tag+" after-battle");
  ok(!bad&&AUDIT.skipped===s0,`${tag} 전투 직후 양측 S·91칸 대조 (실제 수행, 생략 0)`,bad||`skipped +${AUDIT.skipped-s0}`); return !bad;
}
function hiddenCollision(actorMe){
  const me=actorMe, op=1-me; const tag=`H(P${me+1} actor)`;
  // 숨는 말(상대) 열 5, 행위자 2칸 측면 이동: (10,3)→(10,5) [P1] / (4,3)→(4,5) [P2] — 행위자 진영에서 열 5 를 비워 숨은 말이 비인접
  const emptiesActor=new Set(["11_5","12_5","13_5","11_4","11_6","12_4","12_6"]); // 열5 전부 + 열4·6 의 11·12행 → (10,5) 에 인접한 자기 말 없음
  const emptiesHider=new Set(["11_1","12_1","13_1","11_2","12_2","13_2","13_7"]);   // 숨는 쪽은 열 3 이 아닌 곳을 비움 (행위자 말 (10,3)/(4,3) 이 인접하지 않게 열 3 은 유지)
  const setups=[null,null]; setups[me]=mkSetup(me,emptiesActor,[11,3]); setups[op]=mkSetup(op+2,emptiesHider,[11,5]);
  const R=pair(setups); const [A,B]=R.P, X=R.P[me], Y=R.P[op]; // T1=p1 이므로 setups[m] 이 플레이어 m 에게 간다
  const d0=AUDIT.done, f0=AUDIT.agreeFull, p0=AUDIT.agreePartial;
  const g0=agree(R,tag+" start"); ok(!g0,`${tag} 시작 대조`,g0||"");
  const mover=X.S.pieces.find(x=>x.owner===me&&x.type==="minion"&&x.c===3&&(me===0?x.r===11:x.r===3));
  const hider=Y.S.pieces.find(x=>x.owner===op&&x.type==="minion"&&x.c===5&&(op===0?x.r===11:x.r===3));
  ok(mover&&hider,`${tag} 행위자 (${me===0?11:3},3) · 숨는 말 (${op===0?11:3},5)`);
  // 행위자: 1칸 전진 → 자기 숲 앞줄 (10,3)/(4,3)
  move(R,me,mover.id,me===0?10:4,3,`${tag} mover`);
  // 숨는 말: 3→10 / 11→4 까지 1칸씩 횡단 (상대 숲 깊은 행) — 매 이동 양 화면 대조
  const pathH=op===1?[4,5,6,7,8,9,10]:[10,9,8,7,6,5,4];
  for(const r of pathH) move(R,op,hider.id,r,5,`${tag} hider →${r}`);
  const hz=X.S.pieces.find(x=>x.id===hider.id);
  ok(!visIndep(X.S,me,hz),`${tag} 숨은 말이 행위자 시점 비가시 (독자 판정)`); ok(visIndep(Y.S,op,hz),`${tag} 숨은 말은 주인 화면에 표시`);
  ok(untilTurn(R,64,tag+" ff")&&untilActor(R,me,tag),`${tag} 65턴·행위자 턴`);
  const mv=X.S.pieces.find(x=>x.id===mover.id); const tr=mv.r;
  ok(act(X,()=>X.canMoveTo(mv,tr,5)),`${tag} (${tr},3)→(${tr},5) 2칸 측면 이동 합법 (숨은 말 위)`);
  move(R,me,mover.id,tr,5,`${tag} BT lateral2 onto hidden`,[tr,4]); // 경유 칸 정지
  const mX=X.S.pieces.find(x=>x.id===mover.id), mY=Y.S.pieces.find(x=>x.id===mover.id);
  ok(mX.r===tr&&mX.c===4&&mY.r===tr&&mY.c===4&&X.S.tempReveal.has(hider.id)&&Y.S.tempReveal.has(hider.id),`${tag} 양측 모두 경유 칸 (${tr},4) 정지 + 일시 공개 (#104)`,`X=(${mX.r},${mX.c}) Y=(${mY.r},${mY.c})`);
  ok(!!X.S.battle&&!!Y.S.battle,`${tag} 양측 강제 전투 진입`);
  battleLoop(R,tag);
  const bad=agree(R,tag+" post"); ok(!bad,`${tag} 전투 완주 후 양측 S·91칸 대조 (공개·밀어내기 포함)`,bad||"");
  const hz2=X.S.pieces.find(x=>x.id===hider.id), mv2=X.S.pieces.find(x=>x.id===mover.id);
  log(`${tag} 전투 후 mover=(${mv2.r},${mv2.c}) alive=${mv2.alive} hider=(${hz2.r},${hz2.c}) alive=${hz2.alive} pushes=${X.S.metrics.pushes}`);
  for(const q of [hz2,mv2]) if(q.alive&&q.placed) for(const [T,S2,who] of [[X,Y.S,"행위자"],[Y,X.S,"상대"]]){ if(T.S.battle||overlayOpen(T)) continue; const vis=visIndep(S2,T.NET.me,q); const e=XF.reflect(T.NET.me,q.r,q.c); const i=chipIdx(T,S2,q.id);
    ok(vis?i===idxOf(e.row,e.col):i===-1,`${tag} 전투 후 말 ${q.id} ${who} 화면 ${vis?`DOM#${i}=(${e.row},${e.col})`:"비노출"}`); }
  if(X.S.phase==="play") passTurn(R,tag+" post-end");
  // 회계: 전투 중 생략은 정당하지만, 전투 전 횡단·전투 후 대조는 실제로 수행됐어야 한다 (양 화면 모두 대조된 agree 가 step 대부분)
  const dFull=AUDIT.agreeFull-f0, dPart=AUDIT.agreePartial-p0;
  log(`${tag} 회계: step ${R.steps} · 91칸 대조 수행 ${AUDIT.done-d0} · 완전 대조 agree ${dFull} · 부분 생략 agree ${dPart}`);
  ok(AUDIT.done-d0>0&&dPart<=3&&dFull+dPart===R.steps+3,`${tag} 회계: 91칸 대조 실제 수행 ${AUDIT.done-d0}회 · 완전 대조 agree ${dFull} + 부분 생략 ${dPart} = step ${R.steps}+3 · 생략은 전투 열린 step 만(≤3)`);
}
hiddenCollision(0); hiddenCollision(1);

/* ══════════════ 3. 종료(over) 화면·기권·재매칭(역할 교대) ══════════════ */
{
  const setups=[mkSetup(0,new Set(["11_1","11_2","11_3","11_4","11_5","11_6","11_7"]),null),mkSetup(1,new Set(["13_1","13_2","13_3","13_4","13_5","13_6","13_7"]),null)];
  const R=pair(setups); const [A,B]=R.P; const tag="O";
  ok(!agree(R,tag+" start"),`${tag} 시작 대조`);
  const X=actorClient(R); const loser=X.NET.me;
  act(X,()=>X.netAction({t:"resign"})); relay(R);
  ok(A.S.phase==="over"&&B.S.phase==="over"&&A.S.winner===1-loser&&B.S.winner===1-loser,`${tag} 기권 → 양측 over`);
  const a=auditScreen(A,B.S,tag+" P1 over",true), b=auditScreen(B,A.S,tag+" P2 over",true);
  ok(!a.bad&&!b.bad,`${tag} 종료 화면(전체 공개 viewer=2) 91칸 대조 — P2 는 여전히 행 반사`,a.bad||b.bad||"");
  ok(String(B.byId("board").dataset.flip)==="1"&&String(A.byId("board").dataset.flip)==="0",`${tag} over 에서도 flip 유지 (P2=1, P1=0)`);
  ok(b.chips&&b.chips.length===28&&b.chips.every(ch=>ch.known),`${tag} 종료 리빌: P2 화면 28개 칩 전부 공개`);
  // 재매칭: 같은 두 로드가 아니라(새로고침=reload) 새 로드 두 개, 이번엔 첫 로드가 P2
  const R2=pair([mkSetup(2,new Set(["12_1","12_2","12_3","12_4","12_5","12_6","12_7"]),null),mkSetup(3,new Set(["11_1","11_3","11_5","11_7","13_2","13_4","13_6"]),null)],["p2","p1"]);
  ok(R2.T[0].NET.me===1&&R2.T[1].NET.me===0,`${tag} 재매칭에서 첫 로드가 P2`);
  ok(!agree(R2,tag+" rematch"),`${tag} 재매칭 시작 대조 — flip 은 NET.me 를 따른다`);
  ok(String(R2.T[0].byId("board").dataset.flip)==="1"&&String(R2.T[1].byId("board").dataset.flip)==="0",`${tag} 재매칭 flip: 첫 로드(P2)=1, 둘째 로드(P1)=0`);
}

/* ══════════════ 4. 픽스처 전수(91칸): 28개 말을 4회 재배치해 모든 칸을 한 번 이상 덮고 양 화면 대조 (자연 흐름 아님 — 변환 성질 검증) ══════════════ */
{
  const R=pair([mkSetup(4,new Set(["11_1","11_2","11_3","11_4","11_5","11_6","11_7"]),null),mkSetup(5,new Set(["13_1","13_2","13_3","13_4","13_5","13_6","13_7"]),null)]);
  const [A,B]=R.P; const covered=new Set(); let allOk=true;
  const cellsAll=[]; for(let r=1;r<=ROWS;r++) for(let c=1;c<=COLS;c++) cellsAll.push([r,c]);
  for(let round=0;round<4;round++){
    const slice=cellsAll.slice(round*28,round*28+28); while(slice.length<28) slice.push(cellsAll[(round*28+slice.length)%91]);
    for(const T of [A,B]) T.S.pieces.forEach((p,i)=>{ p.r=slice[i][0]; p.c=slice[i][1]; p.placed=true; p.alive=true; });
    for(const [r,c] of slice) covered.add(r+"_"+c);
    for(const T of [A,B]){ T.S.selected=null; T.S.tempReveal.clear(); act(T,()=>T.render()); }
    const a=auditScreen(A,B.S,`F${round} P1`), b=auditScreen(B,A.S,`F${round} P2`);
    ok(!a.skipped&&!b.skipped&&!a.bad&&!b.bad,`F${round} 양 화면 91칸 대조 (실제 수행)`,a.bad||b.bad||(a.skipped||b.skipped?"skipped":""));
    if(a.bad||b.bad||a.skipped||b.skipped) allOk=false;
    if(round===0&&b.hyp) log("F hyp P2", JSON.stringify(b.hyp));
  }
  ok(covered.size===91&&allOk,"F 픽스처: 91칸 전부 말이 놓인 상태를 한 번 이상 포함해 양 화면 91칸×4 회 대조",`covered=${covered.size}`);
  // 매핑 예시 표 (보고용)
  const ex=[[1,1],[1,7],[3,4],[7,1],[7,7],[13,1],[13,7],[11,4]];
  log("매핑 예시 (논리 → P1 화면 / P2 화면 / 180° 회전이라면):");
  for(const [r,c] of ex){ const p1=XF.reflect(0,r,c), p2=XF.reflect(1,r,c), rot=XF.rotate(1,r,c); log(`  (${r},${c}) → P1 (${p1.row},${p1.col}) · P2 (${p2.row},${p2.col}) · rot (${rot.row},${rot.col})`); }
}

/* ══════════════ 5. 시드 퍼즈: 실제 클릭·버튼 경로 무작위 완주 — 매 행동 뒤 양측 S·91칸 대조 (전투·도망·포획·밀어내기·강제 전투·탐색·잡음 클릭 포함) ══════════════ */
function lcg(seed){ let s=seed>>>0; return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
function fuzz(seed){
  const rnd=lcg(seed), pick=a=>a[Math.floor(rnd()*a.length)];
  const R=pair([mkSetup(seed%7,new Set(["11_"+(1+seed%7),"12_"+(1+(seed+2)%7),"13_"+(1+(seed+4)%7),"11_"+(1+(seed+1)%7),"12_"+(1+(seed+5)%7),"13_"+(1+(seed+3)%7),"11_"+(1+(seed+6)%7)]),null),
                 mkSetup((seed+1)%7,new Set(["11_"+(1+(seed+3)%7),"12_"+(1+(seed+1)%7),"13_"+(1+(seed+6)%7),"11_"+(1+(seed+5)%7),"12_"+(1+(seed+2)%7),"13_"+(1+seed%7),"11_"+(1+(seed+4)%7)]),null)]);
  let last=null, steps=0, battles=0, tele=0, pushes=0, flees=0, caps=0, forced=0, moves=0;
  const f0=AUDIT.agreeFull, p0=AUDIT.agreePartial;
  for(;steps<STEPS;steps++){
    const X=actorClient(R); const S=X.S, me=X.NET.me; if(!X.NET.mode||S.phase==="over") break;
    if(rnd()<0.4){ const Y=R.P[1-me]; const r=1+Math.floor(rnd()*ROWS), c=1+Math.floor(rnd()*COLS);
      if(!overlayOpen(Y)) act(Y,()=>{ Y.onCell(r,c); if(pickerOpen(Y)) curBtns(Y,2)[1].onclick(); });
      relay(R); const b=agree(R,`seed ${seed} step ${steps} noise P${2-me} (${r},${c})`); if(b){ last=b; break; } }
    if(X.NET.syncModal&&(overlayOpen(R.P[0])||overlayOpen(R.P[1]))){ const own=X.NET.syncModal.owner, O=R.P[own]; const btns=curBtns(O,O.NET.syncModal.fns.length).filter(b=>!b.disabled); if(!btns.length){ last=`seed ${seed} step ${steps}: sync modal without buttons`; break; } act(O,()=>pick(btns).onclick()); }
    else if(S.battle){ battles++; const B=S.battle; const sd=(B.round%2===1)?(B.phase===0?"A":"D"):(B.phase===0?"D":"A"); const f=sd==="A"?B.fa:B.fd; const slots=f&&f.skills?[0,1,2,3].filter(k=>f.cds[k]===0):[];
      const choice=rnd()<0.15&&S.balls[me]>0&&B.defP.owner!==me?"ball":rnd()<0.12?"flee":slots.length&&rnd()<0.6?pick(slots):"basic"; if(choice==="flee") flees++; if(choice==="ball") caps++;
      act(X,()=>{ if(choice==="ball") global.__throwBall(); else if(choice==="flee") global.__flee(); else global.__act(choice); }); }
    else if(overlayOpen(X)){ const btns=curBtns(X,1); if(btns.length&&btns[0].onclick) act(X,()=>btns[0].onclick()); else { last=`seed ${seed} step ${steps}: overlay stuck`; break; } }
    else if(S.forcedTargets.length){ forced++; const t=pick(S.forcedTargets.map(id=>X.alivePieces().find(p=>p.id===id)).filter(Boolean)); act(X,()=>X.onCell(t.r,t.c)); }
    else if(S.teleport){ const own=X.alivePieces().filter(p=>p.owner===me&&p.immobile===0); if(own.length<2){ act(X,()=>X.netAction({t:"tele"})); } else { const q=pick(own); act(X,()=>X.onCell(q.r,q.c)); } }
    else if(S.mainUsed||rnd()<0.06){ act(X,()=>X.netAction({t:"endTurn"})); }
    else if(rnd()<0.05&&act(X,()=>X.teleportAvailable(me))&&S.teleUsed[me]<X.BAL.teleMax){ tele++; act(X,()=>X.netAction({t:"tele"})); }
    else {
      const mine=X.alivePieces().filter(p=>p.owner===me&&p.immobile===0&&p.type!=="trap"); const cands=[];
      for(const p of mine){ for(let r=1;r<=ROWS;r++) for(let c=1;c<=COLS;c++) if(X.canMoveTo(p,r,c)) cands.push({p,r,c,kind:"move",w:me===0?(p.r-r>0?3:1):(r-p.r>0?3:1)});
        for(const e of X.alivePieces()) if(e.owner!==me&&adjXY(e,p)&&X.visibleTo(me,e)&&X.canBattle(p,e)) cands.push({p,r:e.r,c:e.c,kind:"attack",w:4}); }
      if(!cands.length){ act(X,()=>X.netAction({t:"endTurn"})); }
      else { const tot=cands.reduce((s,x)=>s+x.w,0); let u=rnd()*tot, ch=cands[0]; for(const x of cands){ u-=x.w; if(u<=0){ ch=x; break; } }
        moves++; act(X,()=>X.onCell(ch.p.r,ch.p.c)); relay(R); const b0=agree(R,`seed ${seed} step ${steps} select`); if(b0){ last=b0; break; }
        act(X,()=>X.onCell(ch.r,ch.c)); } }
    relay(R); const b=agree(R,`seed ${seed} step ${steps}`); if(b){ last=b; break; }
    pushes=X.S.metrics.pushes;
  }
  const X=R.P[0], M=X.S.metrics;
  const stat={seed,steps,turn:X.S.turnCount,phase:X.S.phase,bt:M.btReached,battles:M.battles,forced:M.forcedBattles,pushes:M.pushes,tele:M.teleports,flee:M.fleeOks,captures:M.captures+M.enemyCaptures,searches:M.searches,
    agreeFull:AUDIT.agreeFull-f0,agreePartial:AUDIT.agreePartial-p0,last:last||null};
  log(`seed ${seed}: ${JSON.stringify(stat)}`);
  return stat;
}
{
  const res=[]; for(let s=0;s<SEEDS;s++) res.push(fuzz(1000+s));
  ok(res.every(r=>!r.last),"Z 시드 퍼즈: 매 행동 뒤 양측 S·91칸 대조 불일치 0",res.filter(r=>r.last).map(r=>r.last).join(" | "));
  ok(res.every(r=>r.steps>0&&r.agreeFull>0&&r.agreeFull>=r.agreePartial),"Z 퍼즈 회계: 시드마다 양 화면 완전 대조 agree 가 1회 이상이며 생략(전투·오버레이) 회수보다 많다",JSON.stringify(res.map(r=>[r.seed,r.agreeFull,r.agreePartial])));
  const sum=k=>res.reduce((a,r)=>a+(r[k]||0),0);
  ok(res.some(r=>r.bt)&&sum("battles")>0&&sum("forced")>0,"Z 퍼즈 커버리지(필수): BT 도달·전투·강제 전투 1회 이상",JSON.stringify(res));
  console.log(`Z 퍼즈 합계: battles=${sum("battles")} forced=${sum("forced")} pushes=${sum("pushes")} tele=${sum("tele")} flee=${sum("flee")} captures=${sum("captures")} searches=${sum("searches")} BT=${res.filter(r=>r.bt).length}/${res.length} (밀어내기·텔레포트·도망·포획은 시드 의존 — 0 이면 이 절에서는 미커버)`);
}

/* ══════════════ 6. SELF — 감사 오라클·회계 자기 검사 (제품 무변경: 테스트 쪽 DOM 스텁만 손상시킨 뒤 원상복구) ══════════════ */
{
  const R=pair([mkSetup(6,new Set(["11_1","11_2","11_3","11_4","11_5","11_6","11_7"]),null),mkSetup(0,new Set(["13_1","13_2","13_3","13_4","13_5","13_6","13_7"]),null)]);
  const B=R.P[1], bd=B.byId("board"); ok(!agree(R,"SELF start"),"SELF 손상 전 양측 대조 통과");
  const chipCell=bd.children.find(x=>x.children.some(k=>/\bpc\b/.test(k.className))); const chip=chipCell.children.find(k=>/\bpc\b/.test(k.className)); const cls0=chip.className;
  const expect=(what,re,mutate,restore)=>{ mutate(); const bad=agree(R,"SELF "+what); restore(); const after=agree(R,"SELF restore "+what);
    ok(typeof bad==="string"&&re.test(bad)&&!after,`SELF 오라클이 P2 화면 ${what} 손상을 잡고 복구 후 통과한다`,`bad=${bad} after=${after}`); };
  expect("owner 클래스",/owner class/,()=>{ chip.className=cls0.replace(/\bp([01])\b/,(m,o)=>"p"+(1-o)); },()=>{ chip.className=cls0; });
  expect("칩 제거",/chip missing/,()=>{ chipCell._chip=chip; chipCell.children.splice(chipCell.children.indexOf(chip),1); },()=>{ chipCell.children.push(chipCell._chip); });
  expect("DOM 순서(두 칸 교환)",/reflect-contract expects/,()=>{ const c=bd.children; [c[0],c[1]]=[c[1],c[0]]; },()=>{ const c=bd.children; [c[0],c[1]]=[c[1],c[0]]; });
  expect("data-flip",/data-flip/,()=>{ bd.dataset.flip="0"; },()=>{ bd.dataset.flip="1"; });
  // 회계 경로: step() 안에서 일어난 불일치가 기록기(REC) 에 실패로 들어가고 false 를 돌려주는지 — 포획기로 관찰 (실제 fail 카운터는 건드리지 않는다)
  const got=[]; REC=(c,n,d)=>got.push({c,n,d});
  const r=step(R,"SELF step",T=>{ chip.className=cls0.replace(/\bp([01])\b/,(m,o)=>"p"+(1-o)); }); REC=ok; chip.className=cls0;
  ok(r===false&&got.length===1&&got[0].c===false&&/owner class/.test(got[0].d),"SELF step() 경로: 불일치가 기록기에 실패로 기록되고 false 를 돌려준다 (rev 2 의 false-green 회귀 차단)",JSON.stringify(got));
  ok(!agree(R,"SELF end"),"SELF 복구 후 양측 대조 통과");
}

ok(AUDIT.done>0&&AUDIT.agreeFull>0&&AUDIT.steps>0,"회계 총합: 91칸 대조가 실제로 수행됐다 (done>0 · 양 화면 완전 대조 agree>0 · step>0)",JSON.stringify(AUDIT));
ok(fails.length===fail,"회계 일관성: fails 목록 길이 = fail 카운터",`${fails.length} vs ${fail}`);
summary();
process.exit((fail||fails.length)?1:0);
