/* #36 추측 메모 이모지 피커 헤드리스 회귀 — node demo/test/regression/smoke_memo.js [demo/index.html]
   범위: 8종 선택지·저장/변경/삭제·보드 물음표 자리 반투명 추측 렌더·실제 공개 우선·viewer 격리(PVP)·AI 비관측·공용 로그 비노출·
   구 📝 배지/자유 텍스트 input 제거·접근성(group·aria-pressed·label)·인메모리만(영구 저장 없음)·전투 우선 클릭 경로·제거된 말 메모 정리
   #94 D절: 상대 턴(온라인 락스텝 2클라이언트·주입 상대)·AI 턴(PVE) 로컬 메모 — 송신 0(연결 소켓 sent)·권한 가드 불변·오래된 피커 콜백 무효·
   원격 모달/대기 큐 비차단·자기 턴 우선순위 보존·핫시트/sim 현행·AI 결과/RNG/selected 불변·인메모리 변이본 음성 대조 */
"use strict";
const H=require("../shared/harness");
const htmlPath=process.argv[2];
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
/* #54: 기록형 인메모리 스토리지 — 메모가 실제로 무엇을 저장하는지 관찰한다.
   #128: 심어 둔 tutorialSeen 은 **더 이상 자동 표시를 억제하지 않는다**(제품이 저장소를 읽지 않는다).
   이제 이 값은 "사용자 프로필에 과거 키가 남아 있어도 메모 동작이 달라지지 않는다"는 배경일 뿐이고,
   튜토리얼이 열려 있는 상태는 아래 ovHidden 이 제품의 오버레이 소유 상태로 구분한다. */
const LS=H.setStorage(H.mkStorage({tutorialSeen:"1"}));
const WANT=[["king","👑","왕"],["ally","🤝","동료"],["minion_fire","🔥","불 하수인"],["minion_grass","🌿","풀 하수인"],["minion_water","💧","물 하수인"],["minion_lightning","⚡","전기 하수인"],["bomb","💣","폭탄"],["trap","🪤","함정"]];
/* #128: 튜토리얼이 로드마다 자동으로 뜨면서 배경 inert 처리가 #overlay 엘리먼트를 **먼저 만들어 둔다** —
   "엘리먼트 미접근 = 열린 적 없음"이라는 옛 heuristic 은 더 이상 성립하지 않는다.
   대신 제품이 스스로 들고 있는 오버레이 소유 상태를 본다: modal() 이 true, close() 가 false 로 두는 유일한 값이다. */
function ovHidden(T){ return !T.MEMO_UI.overlayOpen; }
function cellOf(T,r,c){ return T.els.board.children.find(x=>x.dataset.r===r&&x.dataset.c===c); }
function chipOf(T,r,c){ const cell=cellOf(T,r,c); return cell&&cell.children.find(x=>/^pc /.test(x.className)); }
function guessOf(T,r,c){ const ch=chipOf(T,r,c); return ch&&/memo-guess/.test(ch.className)?ch.innerHTML.match(/class="guess"[^>]*>([^<]*)</)[1]:null; }
function setup(T,mode){ // 인간(0) 하수인 12,4 · 상대 말 3개(왕 2,4 · 폭탄 5,4[숲, 인접으로 보임] · 하수인 11,4 인접)
  H.freshPlay(T,mode); H.clearBoard(T);
  const me=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), king0=T.S.pieces.find(x=>x.owner===0&&x.type==="king");
  const ek=T.S.pieces.find(x=>x.owner===1&&x.type==="king"), eb=T.S.pieces.find(x=>x.owner===1&&x.type==="bomb"), em=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,me,12,4); H.place(T,king0,13,1); H.place(T,ek,2,4); H.place(T,eb,5,7); H.place(T,em,11,4);
  for(const x of [ek,eb,em]) x.revealed=false;
  T.S.selected=null; T.render();
  return {me,king0,ek,eb,em};
}

/* ===== A. 선택지 8종·팝업 접근성·저장/변경/삭제 ===== */
{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  ok(T.MEMO_OPTS.length===8&&WANT.every((w,i)=>T.MEMO_OPTS[i].key===w[0]&&T.MEMO_OPTS[i].emoji===w[1]&&T.MEMO_OPTS[i].ko===w[2]),"A1 선택지 8종 순서·키·이모지·라벨 (왕·동료·불/풀/물/전기 하수인·폭탄·함정)");
  ok(new Set(T.MEMO_OPTS.map(o=>o.key)).size===8&&T.MEMO_OPTS.every(o=>/^[a-z_]+$/.test(o.key)),"A2 저장 키는 고유한 안정 문자열");
  ok(guessOf(T,2,4)===null&&chipOf(T,2,4).innerHTML==="?","A3 메모 없는 상대 말은 물음표");
  T.onCell(2,4);
  ok(!ovHidden(T)&&/정체 추측/.test(T.els.overlayBox.innerHTML)&&/role="group" aria-label="정체 추측 선택"/.test(T.els.overlayBox.innerHTML),"A4 물음표 상대 말 클릭 → 피커 팝업 (role=group·이름)");
  ok(T.MEMO_UI.btns.length===8&&T.MEMO_UI.btns.every((b,i)=>b.dataset.key===WANT[i][0]&&b.getAttribute("type")==="button"&&b.getAttribute("aria-pressed")==="false"&&b.getAttribute("aria-label")===`${WANT[i][2]} ${WANT[i][1]} 추측`&&b.innerHTML.includes(WANT[i][1])&&b.innerHTML.includes(WANT[i][2])),"A5 버튼 8개: type·aria-label·aria-pressed=false·이모지+라벨");
  ok(!/memoIn|<input/.test(T.els.overlayBox.innerHTML),"A6 자유 텍스트 input 없음");
  const ob=T.els.obBtns.children; ok(ob.length===2&&ob[0].textContent==="추측 삭제"&&ob[0].disabled===true&&ob[1].textContent==="닫기","A7 하단 버튼: 추측 삭제(메모 없으면 비활성)·닫기");
  ok(global.document.activeElement===T.MEMO_UI.btns[0],"A8 열리면 첫 선택지(또는 현재 선택)에 포커스");
  T.MEMO_UI.btns[6].onclick();
  ok(T.S.memos[0][P.ek.id]==="bomb"&&ovHidden(T),"A9 폭탄 선택 즉시 저장(key) + 닫힘");
  const ch=chipOf(T,2,4);
  ok(guessOf(T,2,4)==="💣"&&/hiddenId/.test(ch.className)&&/memo-guess/.test(ch.className)&&/추측/.test(ch.getAttribute("title"))&&/추측: 폭탄/.test(ch.getAttribute("aria-label"))&&/미공개/.test(ch.getAttribute("aria-label")),"A10 보드 물음표 자리에 💣 (전용 클래스·title/aria-label에 추측 명시)");
  ok(!cellOf(T,2,4).children.some(x=>x.className==="memo")&&!/\.cell \.memo\{/.test(T.html)&&!/📝";/.test(T.html),"A11 구 📝 작은 배지 제거 (DOM·CSS·코드)");
  ok(/\.pc\.memo-guess \.guess\{[^}]*opacity:\.5\b/.test(T.html)&&/\.pc\.memo-guess\{[^}]*dashed/.test(T.html),"A12 추측 이모지 opacity .5·점선 테두리 CSS");
  T.onCell(2,4);
  ok(T.MEMO_UI.btns[6].getAttribute("aria-pressed")==="true"&&T.MEMO_UI.btns.filter(b=>b.getAttribute("aria-pressed")==="true").length===1&&T.els.obBtns.children[0].disabled===false&&global.document.activeElement===T.MEMO_UI.btns[6],"A13 다시 클릭: 현재 선택 aria-pressed=true·삭제 활성·현재 선택에 포커스");
  T.MEMO_UI.btns[0].onclick(); ok(T.S.memos[0][P.ek.id]==="king"&&guessOf(T,2,4)==="👑","A14 변경: 👑");
  for(let i=0;i<8;i++){ T.onCell(2,4); T.MEMO_UI.btns[i].onclick(); ok(T.S.memos[0][P.ek.id]===WANT[i][0]&&guessOf(T,2,4)===WANT[i][1],"A15."+(i+1)+" 8종 각각 선택→보드 표시 "+WANT[i][1]); }
  /* #94: 현재 피커의 버튼 행(rowBtns)을 누른다 — 스텁 obBtns 는 이전 모달의 버튼을 지우지 않으므로 children[0/1] 은 첫 피커의 오래된 버튼이고,
     오래된 피커 콜백은 #94 계약상 무효(D7b)라 실제 브라우저처럼 "지금 열린 피커의 버튼"을 눌러야 한다. */
  T.onCell(2,4); rowBtns(T)[1].onclick(); ok(T.S.memos[0][P.ek.id]==="trap"&&ovHidden(T),"A16 닫기는 변경 없음");
  T.onCell(2,4); rowBtns(T)[0].onclick(); ok(!(P.ek.id in T.S.memos[0])&&guessOf(T,2,4)===null&&chipOf(T,2,4).innerHTML==="?","A17 추측 삭제 → 물음표 복귀");
  ok(T.memoSet(0,P.ek.id,"dragon")===false&&!(P.ek.id in T.S.memos[0])&&T.memoSet(0,P.me.id,"bomb")===false&&!(P.me.id in T.S.memos[0])&&T.memoSet(2,P.ek.id,"bomb")===false,"A18 memoSet: 미정의 키·자기 말·잘못된 뷰어 거부");
  // 사이드 패널
  T.memoSet(0,P.ek.id,"bomb"); T.memoSet(0,P.em.id,"minion_fire"); T.render();
  const sp=T.els.sidePanel.innerHTML;
  ok(/📝 추측 메모/.test(sp)&&/💣<\/span> 2행 4열 — 폭탄 추측/.test(sp)&&/🔥<\/span> 11행 4열 — 불 하수인 추측/.test(sp)&&!/<input/.test(sp),"A19 사이드 패널 목록: 이모지 + 쉬운 라벨 + 위치");
  /* #54 REVISE: 판정을 (1) MEMO 구간 저장 API 직접 금지 (2) 런타임 저장 불변식 두 가지로 한다.
     "저장 키 추출 정규식"은 localStorage["setItem"](…)·별칭·직접 대입 같은 대체 표기를 놓치므로 판정 근거에서 뺀다.
     구간 직접 금지는 이름이 등장하는지만 보므로 표기법과 무관하고, 런타임 불변식은 아예 표기와 상관이 없다. */
  const memoSrc=T.html.slice(T.html.indexOf("const MEMO_UI="),T.html.indexOf("function handoff"));
  ok(H.persistApiHits(memoSrc).length===0,
    "A20 메모 구간에 저장·전송 API 이름이 하나도 없음 (localStorage·sessionStorage·indexedDB·cookie·fetch 등 직접 금지)");
  // 런타임 불변식: 메모를 실제로 만들고 바꾸고 지워도 이 로드의 저장소·쿠키·sessionStorage·indexedDB에 흔적이 없다
  const M=H.load(htmlPath,{storage:H.mkStorage({tutorialSeen:"1"})}); const MP=setup(M,"pve");
  const before=H.storageSnapshot(M.storage);
  M.memoSet(0,MP.ek.id,"bomb"); M.memoSet(0,MP.em.id,"minion_fire"); M.memoSet(0,MP.ek.id,"king"); M.memoSet(0,MP.em.id,null);
  M.onCell(2,4); if(M.MEMO_UI.btns[0]) M.MEMO_UI.btns[0].onclick(); M.render();
  ok(H.storageSnapshot(M.storage)===before&&H.storageTrace(M.storage).writes.length===0
    &&H.storageTrace(M.sessionStorage).all.length===0&&M.cookieWrites.length===0&&M.indexedDB.opens.length===0,
    "A20b 런타임 저장 불변식: 메모 생성·변경·삭제·피커 조작 후 저장소 무변화 (쓰기 0·직접 대입 0·쿠키 0·indexedDB 0)");
  const T3=H.load(htmlPath); // #54: 새 로드 = 새로고침 — 앞에서 저장한 추측이 살아 돌아오지 않아야 인메모리 증명
  ok(Object.keys(T3.S.memos[0]).length===0&&Object.keys(T3.S.memos[1]).length===0&&LS.getItem("netServer")===null
    &&H.storageTrace(LS).all.every(k=>k==="tutorialSeen"),
    "A21 새로고침(재로드) 시 이전 추측 메모가 남지 않음 (메모는 인메모리 · 공유 저장소 흔적은 tutorialSeen뿐)");
  /* #54 REVISE: 탐지기 자체의 대체 표기 회귀 — 아래 우회 표기가 하나라도 "저장 없음"으로 통과하면 안 된다.
     (구 판정인 키 추출 정규식은 점 표기 setItem만 봤기 때문에 1~3번을 모두 놓쳤다.) */
  const EVADE=[
    ['localStorage["setItem"]("memoGuess","1")',"대괄호 문자열 접근"],
    ['const zz=window.localStorage; zz.setItem("memoGuess","1")',"별칭 변수 경유"],
    ['localStorage.memoGuess="1"',"직접 프로퍼티 대입"],
    ['sessionStorage["setItem"]("memoGuess","1")',"sessionStorage 대괄호"],
    ['document.cookie="memoGuess=1"',"쿠키"]];
  ok(EVADE.every(([snip])=>H.persistApiHits(snip).length>0),
    "A22 구간 직접 금지 검사가 대체 표기를 모두 잡는다 ("+EVADE.map(e=>e[1]).join("·")+")");
  // 직접 대입(localStorage.k="v")은 정적 검사만으로는 키를 못 뽑는다 — 기록형 스텁이 런타임에서 잡는지 확인
  const probe=H.mkStorage(); probe.memoGuess="1"; probe["또다른"]="2";
  ok(H.storageExtras(probe).join(",")==="memoGuess,또다른"&&H.storageTrace(probe).all.includes("memoGuess"),
    "A23 기록형 저장소 스텁은 setItem 없이 직접 대입한 저장도 흔적으로 잡는다");
}

/* ===== B. 실제 공개 우선 · 공개된 말 클릭 · 전투 우선 · 제거된 말 정리 ===== */
{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  T.memoSet(0,P.em.id,"bomb"); T.render(); ok(guessOf(T,11,4)==="💣","B1 전제: 11,4 하수인에 💣 추측");
  P.em.revealed=true; T.render();
  const ch=chipOf(T,11,4);
  /* #89 공개된 하수인은 이름 텍스트가 아니라 종 아이콘으로 그려진다 — 판정 대상은 그대로다(추측 이모지가 숨고 실제 정체가 우선한다).
     "이름 문자열이 있다"를 "그 말의 종 아이콘이 있다"로 바꾼 것이지 검사를 빼거나 약화한 것이 아니다. */
  const dirB2=T.artDirOf(P.em);
  ok(!/memo-guess/.test(ch.className)&&!/💣/.test(ch.innerHTML)&&!!dirB2
    &&ch.innerHTML.includes(`src="assets/minions/${dirB2}/icon.png"`)&&/class="icon"/.test(ch.innerHTML)
    &&ch.getAttribute("title")===null&&!/추측/.test(ch.getAttribute("aria-label")||""),"B2 실제 공개되면 실제 렌더(종 아이콘) 우선·추측 이모지 숨김");
  ok(new RegExp("💣</span> 11행 4열 — 폭탄 추측 \\(공개됨: ").test(T.els.sidePanel.innerHTML),"B3 사이드 패널은 추측 + 공개된 실제 정체 병기");
  T.onCell(11,4); ok(ovHidden(T)&&T.MEMO_UI.piece!==P.em.id,"B4 공개된 말 클릭은 피커를 열지 않음 (실제 정체 우선)");
  P.em.revealed=false; T.render(); ok(guessOf(T,11,4)==="💣","B5 (테스트) 다시 미공개면 추측 표시 복귀");
  // 전투 우선: 내 말 선택 후 인접 적 클릭 → 전투
  T.onCell(12,4); ok(T.S.selected&&T.S.selected.id===P.me.id,"B6 전제: 내 하수인 선택");
  T.onCell(11,4); ok(!!T.S.battle&&ovHidden(T)===false&&!/정체 추측/.test(T.els.overlayBox.innerHTML),"B7 전투 가능한 인접 적 클릭은 전투가 우선 (피커 아님)");
  // 제거된 말 메모 정리
  const T2=H.load(htmlPath); const Q=setup(T2,"pve");
  T2.memoSet(0,Q.eb.id,"trap"); Q.eb.alive=false; Q.eb.placed=false; T2.S.current=0; T2.startTurn();
  ok(!(Q.eb.id in T2.S.memos[0]),"B8 제거된 말의 메모는 턴 시작 시 정리");
  T2.TQ.length=0;
}

/* ===== C. PVP viewer 격리 · AI 비관측 · 공용 로그 비노출 ===== */
{
  const T=H.load(htmlPath); const P=setup(T,"pvp");
  T.onCell(2,4); T.MEMO_UI.btns[6].onclick();
  ok(T.S.memos[0][P.ek.id]==="bomb"&&Object.keys(T.S.memos[1]).length===0&&guessOf(T,2,4)==="💣","C1 PVP P1이 상대 왕에 💣 추측 (P2 메모 없음)");
  T.S.current=1; T.S.selected=null; T.render();
  /* #89 확정 표시가 메모와 같은 이모지 어휘를 쓰게 되었으므로(P2 자기 폭탄 = 💣), "보드에 💣 문자가 없다"는 더 이상 격리의 근거가 아니다.
     추측이 새는 경로 자체 — memo-guess 클래스 · class="guess" 요소 · 추측 문구가 든 title/aria-label — 를 전부 검사한다. 범위를 좁힌 것이 아니라 넓혔다. */
  const dumpC2=JSON.stringify(T.els.board.children.map(c=>c.children.map(x=>[x.className,x.innerHTML,x.getAttribute("title"),x.getAttribute("aria-label")])));
  ok(chipOf(T,2,4).innerHTML!=="?"&&/👑/.test(chipOf(T,2,4).innerHTML)
    &&!/memo-guess/.test(dumpC2)&&!/class=\\"guess\\"/.test(dumpC2)&&!/추측/.test(dumpC2)
    &&!/추측 메모/.test(T.els.sidePanel.innerHTML),"C2 P2 시점: P1의 추측이 보드·사이드 패널에 없음 (자기 왕은 실제로 보임)");
  ok(!/memo-guess/.test(JSON.stringify(T.els.board.children.map(c=>c.children.map(x=>x.className)))),"C3 P2 시점 보드에 memo-guess 클래스 0");
  T.onCell(11,4); ok(T.S.selected&&T.S.selected.id===P.em.id&&ovHidden(T),"C4 P2가 자기 말 클릭 → 선택 (피커 없음)");
  T.S.selected=null; T.onCell(12,4); T.MEMO_UI.btns[7].onclick();
  ok(T.S.memos[1][P.me.id]==="trap"&&T.S.memos[0][P.ek.id]==="bomb"&&guessOf(T,12,4)==="🪤","C5 P2가 P1 하수인에 🪤 추측 — 각자 저장, P1 메모 유지");
  T.S.current=0; T.S.selected=null; T.render();
  ok(guessOf(T,2,4)==="💣"&&guessOf(T,12,4)===null&&/폭탄 추측/.test(T.els.sidePanel.innerHTML)&&!/함정 추측/.test(T.els.sidePanel.innerHTML),"C6 P1 시점 복귀: 자기 추측만 보임");
  ok(T.S.log.every(l=>!/추측|💣|🪤|👑|폭탄 추측/.test(l.msg))&&!/추측/.test(T.els.log?T.els.log.innerHTML:""),"C7 공용 로그에 추측 흔적 없음");
  ok(!/memos|MEMO_OPTS|memoOpt|memoSet/.test(T.html.slice(T.html.indexOf("/* ===== AI (공정 관측"),T.html.indexOf("/* ===== 모달·핸드오프"))),"C8 AI 코드(휴리스틱·5단)에 memos/MEMO 참조 없음 (정적)");
  // AI 결정 동일성: 같은 시드에서 메모 유무가 AI 행동을 바꾸지 않음
  const run=(withMemo)=>{ const X=H.load(htmlPath); X.setSeed(4242); H.freshPlay(X,"pve","dan5");
    if(withMemo){ for(const e of X.S.pieces.filter(x=>x.owner===1)) X.S.memos[0][e.id]=WANT[e.id%8][0]; }
    X.S.current=1; X.S.mainUsed=false; X.aiMain(1); X.drain(200);
    return JSON.stringify(X.S.pieces.map(p=>[p.id,p.r,p.c,p.alive,p.hp]))+"|"+X.S.log.map(l=>l.msg).join("/"); };
  const a=run(false), b=run(true);
  ok(a===b,"C9 AI 턴 결과·로그가 메모 유무와 무관 (시드 4242 동일)");
  ok(!/memos/.test(String(T.aiMain)+String(T.aiMainStrong)+String(T.aiStep)+String(T.aiVisible)+String(T.aiBattleAction)+String(T.aiBattleActionStrong)),"C10 AI 함수 본문에 memos 참조 없음");
  T.TQ.length=0;
}


/* ===== D. #94 상대 턴·AI 턴 로컬 메모 — 온라인 락스텝 2클라이언트 · 단일 클라이언트+주입 상대 · PVE AI 턴 · 오래된 콜백 · 음성 대조 =====
   송신 0 판정은 wsLog.length(소켓 생성 수)가 아니라 "연결된 소켓의 실제 ws.sent 길이"로 한다(#91 QA 지적). 같은 검사기를 D12에서
   불필요한 netSend 를 심은 인메모리 변이본에 돌려 실패함을 증명한다(파일 쓰기 없음). */
const HTTP_HREF="http://127.0.0.1:8080/index.html", CODE="5F65J3YKGD", MARKER="digit-duel.v1";
/* D절은 결정적으로 돌린다 — 자동 배치·P1 시드 선택이 Math.random 을 쓰므로 고정 LCG 로 바꿔 끼우고 절 끝에서 되돌린다 */
const REAL_RANDOM=Math.random; { let z=20260907; Math.random=()=>{ z=(z*1664525+1013904223)>>>0; return z/4294967296; }; }
/* 블록 단위 보호: 한 블록의 예외가 뒤 블록 결과를 숨기지 않도록 예외를 그 블록의 FAIL 로 기록한다 (변경 전 소스 음성 대조에서도 끝까지 돈다) */
function block(name,fn){ try{ fn(); }catch(err){ ok(false,name+" — 예외: "+(err&&err.message)); } }
function toasts(T){ return (T.byId("toasts").children||[]).map(x=>x.textContent); }
function clearT(T){ T.byId("toasts").innerHTML=""; }
function pickerOpen(T){ return T.MEMO_UI.overlayOpen===true&&!T.els.overlay.classList.contains("hidden")&&/정체 추측/.test(T.byId("overlayBox").innerHTML); }
function rowBtns(T){ const ch=T.els.obBtns.children; return ch.slice(-2); } // 현재 모달의 [추측 삭제, 닫기] — 스텁은 이전 모달의 버튼 행을 지우지 않는다(실제 DOM은 innerHTML 대입으로 새 노드)
function sentN(T){ return T.ws.sent.length; }
/* 게임 상태 스냅샷(메모 제외) — 두 클라이언트 일치·메모 조작 전후 무변화 판정용 */
function snapS(T){ const S=T.S; return JSON.stringify({phase:S.phase,cur:S.current,turn:S.turnCount,main:S.mainUsed,bu:S.battlesUsed,
  pieces:S.pieces.map(p=>[p.id,p.r,p.c,p.alive,p.placed,p.hp,p.revealed,p.immobile]),log:S.log.map(l=>l.msg).filter(m=>!/당신은 P[12]/.test(m)).map(m=>m.replace(/(나|상대)\((P[12])\)/g,"$2")),sel:S.selected?S.selected.id:null,
  tele:!!S.teleport,forced:S.forcedTargets,moved:S.movedPiece?S.movedPiece.id:null,battle:!!S.battle,
  seq:T.NET.modalSeq,sync:T.NET.syncModal?T.NET.syncModal.seq:null,queue:T.NET.queue.length,ev:S.events.map(e=>[e.r,e.c,!!e.consumed])}); }
/* 온라인 클라이언트 1개: 코드 입력 → 사전 배치 → 매칭 큐(가짜 소켓 open). T.ws = 연결된 소켓 스텁, T.recv = 서버→클라이언트 프레임 주입 */
function netClient(html){
  const T=H.load(htmlPath,{href:HTTP_HREF,storage:H.mkStorage({tutorialSeen:"1"}),html});
  T.byId("netCode").value=CODE; T.netPrepare(); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  const ws=T.wsLog[T.wsLog.length-1]; ws.readyState=1; ws.protocol=MARKER; ws.onopen(); ws.fwd=0; T.ws=ws;
  T.recv=m=>{ T.activate(); ws.onmessage({data:typeof m==="string"?m:JSON.stringify(m)}); }; // 수신 재생은 그 로드의 window 진입점·타이머로
  return T;
}
/* 실제 2클라이언트 락스텝: A=p1·B=p2, hello/hello2 교환 → 같은 시드로 두 게임 생성. relay()는 두 소켓의 미전달 송신을 서로에게 전부 넘긴다.
   W = 지금 상대 턴을 기다리는 쪽, X = 행동 차례인 쪽. 한 프로세스에 두 로드가 있으므로 어느 쪽을 조작하기 전에 use(T)=T.activate() 로 전역 주인을 바꾼다 */
function pair(){
  const A=netClient(), B=netClient();
  A.recv({type:"matched",room:"r",you:"p1"}); B.recv({type:"matched",room:"r",you:"p2"});
  const relay=()=>{ let n=0; for(let g=0;g<50;g++){ let moved=false;
    while(A.ws.sent.length>A.ws.fwd){ B.recv(A.ws.sent[A.ws.fwd++]); moved=true; n++; }
    while(B.ws.sent.length>B.ws.fwd){ A.recv(B.ws.sent[B.ws.fwd++]); moved=true; n++; }
    if(!moved) break; } return n; };
  relay();
  const W=A.S.current===A.NET.me?B:A, X=W===A?B:A;
  return {A,B,W,X,relay,use:T=>T.activate()};
}
/* 단일 클라이언트(p2) + 주입 상대(p1): 상대 배치는 내 배치의 거울. wantOppTurn 에 맞는 선공이 나올 때까지 시드를 바꾼다 */
function solo(wantOppTurn,html){
  for(let seed=1;seed<300;seed++){
    const T=netClient(html); T.recv({type:"matched",room:"r",you:"p2"});
    T.recv({t:"hello",seed,setup:T.NET.mySetup});
    if(T.NET.started&&T.S.phase==="play"&&((T.S.current!==T.NET.me)===wantOppTurn)){ T.ws.fwd=T.ws.sent.length; return T; }
  }
  throw new Error("solo(): 원하는 선공 시드를 찾지 못함");
}
function enemyOf(T,pred){ const v=T.NET.mode?T.NET.me:0; return T.S.pieces.find(x=>x.owner!==v&&x.alive&&x.placed&&x.type!=="king"&&(!pred||pred(x))); }
function myPiece(T,pred){ const v=T.NET.mode?T.NET.me:0; return T.S.pieces.find(x=>x.owner===v&&x.alive&&x.placed&&x.type==="minion"&&(!pred||pred(x))); }
/* 양쪽 게임에 같은 테스트 변형을 가한다(락스텝 유지) — 말은 id 로 찾는다 */
function both(P,fn){ for(const T of [P.A,P.B]) fn(T,id=>T.S.pieces.find(x=>x.id===id)); }
function emptyCell(T){ for(let r=6;r<=8;r++) for(let c=1;c<=7;c++) if(!T.at(r,c)) return [r,c]; return null; }

/* --- D1~D5: 실제 2클라이언트 락스텝 --- */
block("D1~D5 락스텝 블록",()=>{
  const P=pair(); const {W,X,relay,use}=P; use(W);
  ok(P.A.NET.started&&P.B.NET.started&&P.A.S.phase==="play"&&P.B.S.phase==="play"&&snapS(P.A)===snapS(P.B)&&W.S.current!==W.NET.me&&X.S.current===X.NET.me,
    "D0 전제: 온라인 2클라이언트가 같은 시드로 시작해 상태가 일치하고, W 는 상대 턴·X 는 자기 턴");
  use(W); const e=enemyOf(W,x=>x.type==="minion"&&!x.revealed);
  const s0=[sentN(W),sentN(X)], snap0=[snapS(W),snapS(X)];
  ok(!!e&&W.visibleTo(W.NET.me,e)&&guessOf(W,e.r,e.c)===null&&chipOf(W,e.r,e.c).innerHTML==="?","D1a 전제: W 가 볼 수 있는 미공개 상대 하수인(물음표)");
  cellOf(W,e.r,e.c).onclick(); // 실제 셀 onclick 경로
  ok(pickerOpen(W)&&W.MEMO_UI.piece===e.id&&W.MEMO_UI.btns.length===8,"D1 온라인 상대 턴에 미공개 상대 말 클릭 → 메모 피커가 열린다");
  ok(sentN(W)===s0[0]&&sentN(X)===s0[1]&&relay()===0,"D1b 피커 열기 송신 0 (연결된 소켓 sent 무변화 · 릴레이 전달 0)"); use(W);
  ok(W.NET.syncModal===null&&W.S.selected===null&&snapS(W)===snap0[0]&&snapS(X)===snap0[1],"D1d 피커 열기는 selected·seq·syncModal·게임 상태를 바꾸지 않는다 (양쪽 스냅샷 동일)");
  ok(!toasts(W).some(t=>/상대 턴/.test(t)),"D1e 상대 턴 차단 토스트가 뜨지 않는다 (메모는 차단 대상이 아님)");
  use(W); W.MEMO_UI.btns[6].onclick();
  ok(W.S.memos[W.NET.me][e.id]==="bomb"&&!pickerOpen(W)&&guessOf(W,e.r,e.c)==="💣","D2 상대 턴에 💣 저장 → 내 보드 물음표 자리에 추측 표시");
  ok(Object.keys(X.S.memos[0]).length===0&&Object.keys(X.S.memos[1]).length===0&&Object.keys(W.S.memos[1-W.NET.me]).length===0
    &&!/memo-guess/.test(JSON.stringify(X.els.board.children.map(c=>c.children.map(x=>x.className)))),"D2b 상대(X) 클라이언트에는 메모가 없고 보드에도 추측 흔적 0");
  ok(sentN(W)===s0[0]&&sentN(X)===s0[1]&&relay()===0&&snapS(W)===snap0[0]&&snapS(X)===snap0[1]&&W.S.log.every(l=>!/추측|💣/.test(l.msg)),
    "D2c 저장 후에도 송신 0 · 릴레이 0 · 양쪽 게임 상태 불변 · 로그 무흔적");
  ok(/📝 추측 메모/.test(W.els.sidePanel.innerHTML)&&/💣<\/span> \d+행 \d+열 — 폭탄 추측/.test(W.els.sidePanel.innerHTML),"D2d 상대 턴에도 내 사이드 패널에 추측 메모 목록이 보인다");
  ok(!/추측 메모/.test(X.els.sidePanel.innerHTML),"D2e 상대(X) 사이드 패널에는 추측 메모 없음");
  // 권한 가드 불변 — 이동·선택·텔레포트·턴 종료는 여전히 차단
  use(W); clearT(W); const m=myPiece(W);
  cellOf(W,m.r,m.c).onclick();
  ok(W.S.selected===null&&toasts(W).some(t=>/상대 턴/.test(t))&&sentN(W)===s0[0],"D3 상대 턴에 자기 말 클릭 → 차단 토스트 · 선택 없음 · 송신 0");
  clearT(W); const ec=emptyCell(W); cellOf(W,ec[0],ec[1]).onclick();
  ok(toasts(W).some(t=>/상대 턴/.test(t))&&sentN(W)===s0[0]&&!pickerOpen(W),"D3b 상대 턴에 빈 칸 클릭 → 차단 토스트 · 송신 0 · 피커 없음");
  clearT(W); W.netAction({t:"tele"}); W.netAction({t:"endTurn"}); W.netAction({t:"skipMain"});
  ok(toasts(W).filter(t=>/상대 턴/.test(t)).length===3&&sentN(W)===s0[0]&&!W.S.teleport&&snapS(W)===snap0[0],"D3c 상대 턴에 텔레포트·턴 종료·주 행동 생략 → 모두 차단 · 상태 불변");
  ok(W.els.turnBar.children.filter(b=>b.textContent).every(b=>b.disabled!==false||/상대 턴/.test(b.textContent)),"D3d 상대 턴 턴바 버튼은 비활성");
  // 공개된 말 · 비가시(숲) 말 · 죽은 말 · 왕(공개 전) 은 메모 대상 판정이 각각 다르다
  const e2=enemyOf(W,x=>x.type==="minion"&&x.id!==e.id); both(P,(T,f)=>{ f(e2.id).revealed=true; });
  clearT(W); cellOf(W,e2.r,e2.c).onclick();
  ok(!pickerOpen(W)&&toasts(W).some(t=>/이미 공개된 말/.test(t))&&sentN(W)===s0[0]&&!(e2.id in W.S.memos[W.NET.me]),"D4 상대 턴에 공개된 상대 말 클릭 → 기존 '이미 공개된 말' 안내 · 송신 0 · 메모 없음");
  const e3=enemyOf(W,x=>x.type==="minion"&&x.id!==e.id&&x.id!==e2.id);
  const fr=W.NET.me===0?5:9; // W 의 말(자기 진영)과 인접하지 않은 숲 칸 → 비가시
  both(P,(T,f)=>{ const x=f(e3.id); x.r=fr; x.c=4; });
  use(X); X.render(); use(W); W.render();
  ok(!W.visibleTo(W.NET.me,e3)&&!cellOf(W,fr,4).children.length,"D4b 전제: 숲으로 옮긴 상대 말은 W 에게 보이지 않고 렌더되지 않는다");
  clearT(W); cellOf(W,fr,4).onclick();
  ok(!pickerOpen(W)&&toasts(W).some(t=>/상대 턴/.test(t))&&sentN(W)===s0[0]&&!(e3.id in W.S.memos[W.NET.me])&&W.memoClickTarget(fr,4)===null,"D4c 상대 턴에 비가시 숲 칸 클릭 → 메모 아님(차단 토스트) · 송신 0");
  const e4=enemyOf(W,x=>x.type==="minion"&&![e.id,e2.id,e3.id].includes(x.id)); both(P,(T,f)=>{ f(e4.id).alive=false; }); use(X); X.render(); use(W); W.render();
  clearT(W); cellOf(W,e4.r,e4.c).onclick();
  ok(!pickerOpen(W)&&sentN(W)===s0[0]&&!(e4.id in W.S.memos[W.NET.me])&&W.memoTargetOk(W.NET.me,e4)===false,"D4d 죽은 말 자리 클릭 → 메모 없음 · 송신 0");
  ok(W.memoClickTarget(m.r,m.c)===null&&W.memoTargetOk(W.NET.me,m)===false,"D4e 자기 말은 메모 대상이 아니다");
  both(P,(T,f)=>{ f(e2.id).revealed=false; });
  // D5: 피커가 열린 채 상대가 실제로 행동(선택·이동)해도 안전 — 대상이 유효하면 저장은 그대로 적용
  use(W); clearT(W); cellOf(W,e.r,e.c).onclick(); ok(pickerOpen(W)&&W.MEMO_UI.btns[6].getAttribute("aria-pressed")==="true","D5 전제: W 피커 재오픈 (현재 추측 💣 표시)");
  use(X); const dir=X.NET.me===0?-1:1; // 자기 진영에서 중앙 쪽으로 한 칸
  /* 이동 말은 메모 대상(e)과 다른 말 · 목적지는 숲(4·5·9·10행)이 아닌 빈 칸 — 메모 대상이 그대로 유효한 채 상대가 실제로 이동하는 경우를 만든다 */
  let xm=null, tgt=null;
  for(const cand0 of X.S.pieces.filter(x=>x.owner===X.NET.me&&x.alive&&x.placed&&x.type==="minion"&&x.immobile===0&&x.id!==e.id)){
    for(const cand of [[cand0.r,cand0.c+1],[cand0.r,cand0.c-1],[cand0.r+dir,cand0.c]])
      if(cand[1]>=1&&cand[1]<=7&&![4,5,9,10].includes(cand[0])&&!X.at(cand[0],cand[1])&&X.canMoveTo(cand0,cand[0],cand[1])){ xm=cand0; tgt=cand; break; }
    if(xm) break; }
  const xs=sentN(X);
  cellOf(X,xm.r,xm.c).onclick(); ok(X.S.selected&&X.S.selected.id===xm.id&&sentN(X)===xs+1,"D5a X(자기 턴) 말 선택은 송신 1 (권한 경로 불변)");
  ok(!!tgt,"D5b 전제: X 가 이동할 빈 칸이 있다");
  if(tgt) cellOf(X,tgt[0],tgt[1]).onclick();
  const nrelay=relay(); use(W);
  ok(X.S.mainUsed===true&&nrelay===2&&snapS(W)===snapS(X)&&W.S.pieces.find(x=>x.id===xm.id).r===tgt[0],"D5c X 이동이 W 에 릴레이·재생되어 양쪽 상태 일치 (2 메시지)");
  ok(pickerOpen(W)&&W.MEMO_UI.piece===e.id,"D5d 상대 이동 재생 중에도 W 의 피커는 그대로 열려 있다 (모달 교체 없음)");
  use(W); W.MEMO_UI.btns[0].onclick();
  ok(W.S.memos[W.NET.me][e.id]==="king"&&!pickerOpen(W)&&sentN(W)===s0[0]&&snapS(W)===snapS(X),"D5e 대상이 여전히 유효하므로 저장 적용(👑) · 송신 0 · 상태 일치 유지");
  use(X); cellOf(X,xm.r,xm.c).onclick(); // 선택 해제/재선택은 그대로 권한 경로
  X.netAction({t:"endTurn"}); relay(); use(W);
  ok(W.S.current===W.NET.me&&X.S.current!==X.NET.me&&snapS(W)===snapS(X),"D5f 턴 종료가 릴레이되어 이제 W 의 턴");
  // (b) 자기 턴 원래 메모 분기도 송신 0 — 우선순위(선택·전투)는 그대로 netAction
  const wsent=sentN(W), xsnap=snapS(X);
  const e5=enemyOf(W,x=>x.type==="minion"&&x.alive&&!x.revealed&&W.visibleTo(W.NET.me,x)&&!W.S.pieces.some(y=>y.owner===W.NET.me&&y.alive&&y.placed&&W.adjEnemies(y).some(z=>z.id===x.id)));
  use(W); cellOf(W,e5.r,e5.c).onclick();
  ok(pickerOpen(W)&&sentN(W)===wsent&&relay()===0&&snapS(X)===xsnap,"D5g 자기 턴의 원래 메모 분기(비인접 미공개 상대 말)도 송신 0 · 상대 상태 불변");
  use(W); W.MEMO_UI.btns[7].onclick(); ok(W.S.memos[W.NET.me][e5.id]==="trap"&&sentN(W)===wsent&&relay()===0,"D5h 자기 턴 메모 저장도 송신 0");
  use(W); const wm=myPiece(W); cellOf(W,wm.r,wm.c).onclick(); relay(); use(W);
  ok(W.S.selected&&W.S.selected.id===wm.id&&sentN(W)===wsent+1&&snapS(W)===snapS(X),"D5i 자기 턴 자기 말 선택은 여전히 송신 1 (우선순위·권한 경로 보존)");
  P.B.TQ.length=0;
});

/* --- D6~D9: 단일 온라인 클라이언트 + 주입 상대 — 오래된 피커 콜백 무효 · 원격 모달·대기 큐 비차단 --- */
block("D6~D10 오래된 콜백 블록",()=>{
  // (a) 대상이 공개되면: 피커가 아직 오버레이 소유 → 저장 안 함 + 안내 + 닫힘
  const T=solo(true); const e=enemyOf(T,x=>x.type==="minion"&&!x.revealed);
  cellOf(T,e.r,e.c).onclick(); const b1=T.MEMO_UI.btns.slice(), r1=rowBtns(T);
  ok(pickerOpen(T)&&sentN(T)===T.ws.fwd,"D6 전제: 상대 턴 피커 열림 · 송신 0");
  e.revealed=true; T.render();
  b1[6].onclick();
  ok(!(e.id in T.S.memos[T.NET.me])&&!pickerOpen(T)&&T.els.overlay.classList.contains("hidden")&&toasts(T).some(t=>/상태가 바뀌어/.test(t)),"D6a 피커 열린 뒤 대상이 공개되면 저장 콜백은 메모를 만들지 않고 피커만 닫는다 (안내 토스트)");
  e.revealed=false; clearT(T);
  cellOf(T,e.r,e.c).onclick(); const b2=T.MEMO_UI.btns.slice(); e.alive=false; b2[6].onclick();
  ok(!(e.id in T.S.memos[T.NET.me])&&!pickerOpen(T),"D6b 대상이 죽으면 저장 콜백 무효 · 메모 없음");
  e.alive=true; clearT(T);
  cellOf(T,e.r,e.c).onclick(); const b3=T.MEMO_UI.btns.slice(); const fr=T.NET.me===0?5:9; const [or,oc]=[e.r,e.c]; e.r=fr; e.c=4; T.render(); b3[6].onclick();
  ok(!(e.id in T.S.memos[T.NET.me])&&!pickerOpen(T),"D6c 대상이 비가시(숲)로 옮겨지면 저장 콜백 무효 · 메모 없음");
  e.r=or; e.c=oc; T.render();
  // 유효한 대상은 같은 경로로 정상 저장 — 검사기가 "항상 실패"가 아님을 같은 파일에서 증명
  cellOf(T,e.r,e.c).onclick(); T.MEMO_UI.btns[6].onclick();
  ok(T.S.memos[T.NET.me][e.id]==="bomb"&&!pickerOpen(T)&&sentN(T)===T.ws.fwd,"D6d 대조: 대상이 그대로면 같은 콜백이 정상 저장한다 (송신 0)");
  // (b) 오래된 피커(닫힌 뒤) 버튼은 새 피커에 손대지 않는다
  cellOf(T,e.r,e.c).onclick(); const old=T.MEMO_UI.btns.slice(), oldRow=rowBtns(T); oldRow[1].onclick();
  ok(!pickerOpen(T),"D7 전제: 첫 피커를 닫기로 닫음");
  const e2=enemyOf(T,x=>x.type==="minion"&&x.id!==e.id&&!x.revealed); cellOf(T,e2.r,e2.c).onclick();
  ok(pickerOpen(T)&&T.MEMO_UI.piece===e2.id,"D7a 두 번째 피커(다른 말) 열림");
  old[0].onclick(); oldRow[0].onclick(); oldRow[1].onclick();
  ok(pickerOpen(T)&&T.MEMO_UI.piece===e2.id&&T.S.memos[T.NET.me][e.id]==="bomb"&&!(e2.id in T.S.memos[T.NET.me]),"D7b 오래된 피커의 저장·삭제·닫기 콜백은 새 피커를 닫지도, 메모를 바꾸지도 않는다");
  T.MEMO_UI.btns[2].onclick(); ok(T.S.memos[T.NET.me][e2.id]==="minion_fire"&&!pickerOpen(T),"D7c 새 피커의 저장은 정상 적용");
  // (c) 피커가 열린 채 상대 전투가 도착 — 전투 모달이 우선하고 오래된 콜백은 전투 모달을 가리지 않으며 전투 진행(대기 큐)도 막지 않는다
  const T2=solo(true); const o=enemyOf(T2,x=>x.type==="minion"&&x.immobile===0), mine=myPiece(T2); const target=enemyOf(T2,x=>x.type==="minion"&&x.id!==o.id);
  o.r=7; o.c=4; mine.r=8; mine.c=4; T2.S.selected=null; T2.render();
  cellOf(T2,target.r,target.c).onclick(); const bb=T2.MEMO_UI.btns.slice(), rr=rowBtns(T2);
  ok(pickerOpen(T2)&&T2.MEMO_UI.piece===target.id,"D8 전제: 상대 턴 피커 열림(제3의 말)");
  T2.recv({t:"a",a:{t:"cell",r:7,c:4}}); T2.recv({t:"a",a:{t:"cell",r:8,c:4}});
  ok(!!T2.S.battle&&T2.S.battle.attP.id===o.id&&T2.S.battle.defP.id===mine.id&&!/정체 추측/.test(T2.byId("overlayBox").innerHTML)&&T2.MEMO_UI.token===null,"D8a 상대의 선택·공격이 재생되어 전투 모달이 피커를 대체 (토큰 무효)");
  const ovHtml=T2.byId("overlayBox").innerHTML, memosBefore=JSON.stringify(T2.S.memos);
  bb[6].onclick(); rr[0].onclick(); rr[1].onclick();
  ok(!T2.els.overlay.classList.contains("hidden")&&T2.byId("overlayBox").innerHTML===ovHtml&&JSON.stringify(T2.S.memos)===memosBefore&&!!T2.S.battle,
    "D8b 오래된 저장·삭제·닫기 콜백은 전투 모달을 닫거나 덮지 않고 메모도 바꾸지 않는다");
  T2.drain(2000); const blog0=T2.S.battle.blog.length, hp0=T2.S.battle.fd.hp;
  T2.recv({t:"a",a:{t:"act",k:"basic"}}); T2.netPump(); T2.drain(3000); T2.netPump(); T2.drain(3000);
  ok(T2.NET.queue.length===0&&!!T2.S.battle&&T2.S.battle.blog.length>blog0&&(T2.S.battle.fd.hp<hp0||T2.S.battle.round>1),"D8c 이후 상대의 전투 행동이 대기 큐를 통해 정상 재생된다 (메모가 진행을 막지 않음)");
  // (d) 동기화 모달(상대 선택 대기)이 피커를 대체 — 오래된 콜백이 syncModal 을 지우거나 대기 화면을 닫지 않는다
  const T3=solo(true); const t3=enemyOf(T3,x=>x.type==="minion"&&!x.revealed);
  cellOf(T3,t3.r,t3.c).onclick(); const b3s=T3.MEMO_UI.btns.slice(), r3=rowBtns(T3);
  let fired=0; T3.modal("<h2>상대 결정</h2>",[["확인",()=>{fired++;}]]);
  const sync=T3.NET.syncModal;
  ok(!!sync&&sync.owner!==T3.NET.me&&/상대 선택 대기 중/.test(T3.byId("overlayBox").innerHTML)&&T3.MEMO_UI.token===null,"D9 전제: 상대 소유 동기화 모달이 피커를 대체(대기 화면)");
  b3s[6].onclick(); r3[0].onclick(); r3[1].onclick();
  ok(T3.NET.syncModal===sync&&!T3.els.overlay.classList.contains("hidden")&&/상대 선택 대기 중/.test(T3.byId("overlayBox").innerHTML)&&!(t3.id in T3.S.memos[T3.NET.me]),"D9a 오래된 콜백은 syncModal·대기 화면을 건드리지 않고 메모도 없음");
  T3.recv({t:"a",a:{t:"modal",seq:sync.seq,i:0}});
  ok(fired===1&&T3.NET.queue.length===0,"D9b 상대의 모달 선택이 그대로 재생된다 (권한·대기 큐 비차단)");
  // (e) 새 게임으로 교체되면 오래된 콜백은 새 게임 상태에 손대지 않는다
  const T4=solo(true); const t4=enemyOf(T4,x=>x.type==="minion"&&!x.revealed);
  cellOf(T4,t4.r,t4.c).onclick(); const b4=T4.MEMO_UI.btns.slice(), r4=rowBtns(T4), oldS=T4.S;
  T4.newGame("pve"); T4.S.phase="play"; T4.render();
  let threw=false; try{ b4[6].onclick(); r4[0].onclick(); r4[1].onclick(); }catch(err){ threw=true; }
  ok(!threw&&T4.S!==oldS&&Object.keys(T4.S.memos[0]).length===0&&Object.keys(T4.S.memos[1]).length===0&&!(t4.id in oldS.memos[T4.NET.me]),"D10 새 게임 뒤 오래된 콜백은 예외 없이 무시되고 새 게임·옛 게임 메모 모두 무변화");
  // 오버레이가 열려 있는 동안(전투·대기 화면)에는 로컬 메모 분기가 열리지 않는다
  const T5=solo(true); const t5=enemyOf(T5,x=>x.type==="minion"&&!x.revealed);
  T5.modal("<h2>x</h2>",[["ok",()=>{}]]); const before5=sentN(T5);
  ok(T5.memoClickTarget(t5.r,t5.c)===null,"D10a 오버레이(동기화 모달)가 열려 있으면 로컬 메모 분기 없음 — 원격 모달 권한을 가리지 않는다");
  cellOf(T5,t5.r,t5.c).onclick();
  ok(!/정체 추측/.test(T5.byId("overlayBox").innerHTML)&&sentN(T5)===before5&&toasts(T5).some(t=>/상대 턴/.test(t)),"D10b 그 클릭은 현행 차단 경로(토스트) · 송신 0 · 대기 화면 유지");
  T5.TQ.length=0;
});

/* --- D11: PVE AI 턴 메모 · AI 결과·RNG·selected 불변 · 사이드 패널 --- */
block("D11 PVE 블록",()=>{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  T.S.current=1; T.S.selected=null; T.render(); const tq=T.TQ.length;
  cellOf(T,2,4).onclick();
  ok(pickerOpen(T)&&T.MEMO_UI.piece===P.ek.id&&T.S.selected===null,"D11a PVE AI 턴에 상대 왕 클릭 → 피커");
  T.MEMO_UI.btns[6].onclick();
  ok(T.S.memos[0][P.ek.id]==="bomb"&&guessOf(T,2,4)==="💣"&&T.TQ.length===tq&&T.S.current===1&&T.S.selected===null,"D11b AI 턴 저장 → 보드 추측 표시 · 타이머 큐·current·selected 무변화");
  ok(/📝 추측 메모/.test(T.els.sidePanel.innerHTML)&&/폭탄 추측/.test(T.els.sidePanel.innerHTML),"D11c AI 턴에도 사이드 패널 메모 목록 표시");
  cellOf(T,12,4).onclick(); ok(T.S.selected===null&&!pickerOpen(T),"D11d AI 턴에 자기 말 클릭은 여전히 아무 일도 없음 (선택 불가)");
  P.em.revealed=true; T.render(); clearT(T); cellOf(T,11,4).onclick();
  ok(!pickerOpen(T)&&toasts(T).some(t=>/이미 공개된 말/.test(t)),"D11e AI 턴에 공개된 말 클릭 → 기존 안내");
  P.em.revealed=false;
  // 쌍둥이 실행: 같은 시드에서 AI 턴 중 메모 조작(피커 열기·저장·삭제)이 AI 결과·RNG 소비·selected·로그를 바꾸지 않는다
  const run=(memo)=>{ const X=H.load(htmlPath); X.setSeed(777); H.freshPlay(X,"pve","grade5"); X.S.current=1; X.S.mainUsed=false; X.render();
    if(memo){ const en=X.S.pieces.filter(x=>x.owner===1&&x.alive&&x.placed&&!X.inForest(x)).slice(0,3);
      for(const [i,x] of en.entries()){ cellOf(X,x.r,x.c).onclick(); if(!pickerOpen(X)) throw new Error("피커 안 열림"); X.MEMO_UI.btns[i].onclick(); }
      cellOf(X,en[0].r,en[0].c).onclick(); rowBtns(X)[0].onclick(); }
    X.aiMain(1); X.drain(500);
    if(memo){ const en=X.S.pieces.filter(x=>x.owner===1&&x.alive&&x.placed&&!x.revealed&&X.visibleTo(0,x)).slice(0,1); for(const x of en){ cellOf(X,x.r,x.c).onclick(); if(pickerOpen(X)) X.MEMO_UI.btns[4].onclick(); } }
    X.drain(500);
    return {X,snap:snapS(X),r:[X.rand(),X.rand(),X.rand()]}; };
  const a=run(false), b=run(true);
  ok(a.snap===b.snap&&JSON.stringify(a.r)===JSON.stringify(b.r)&&Object.keys(b.X.S.memos[0]).length>=2&&Object.keys(a.X.S.memos[0]).length===0,
    "D11f 쌍둥이 실행(시드 777): AI 턴 중 메모 열기·저장·삭제가 AI 행동·로그·RNG 소비·selected 를 바꾸지 않는다");
  a.X.TQ.length=0; b.X.TQ.length=0; T.TQ.length=0;
});

/* --- D12: 자기 턴 우선순위 보존 · 핫시트/sim 현행 유지 · 정적 계약 · 음성 대조(변이본) --- */
block("D12 우선순위·정적 블록",()=>{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  // 강제 전투 대상 클릭은 메모가 가로채지 않는다
  H.place(T,P.me,10,4); H.place(T,P.em,9,4); P.em.revealed=false; T.S.movedPiece=P.me; T.S.forcedTargets=[P.em.id]; T.S.mainUsed=true; T.S.selected=null; T.render();
  ok(T.memoClickTarget(9,4)===null,"D12 자기 턴 강제 전투 대상은 로컬 메모 분기가 아니다");
  cellOf(T,9,4).onclick(); ok(!!T.S.battle&&!pickerOpen(T)&&!/정체 추측/.test(T.byId("overlayBox").innerHTML),"D12a 강제 대상 클릭 → 전투 진입 (피커 아님)");
  T.close(); T.S.battle=null; T.TQ.length=0;
  // 텔레포트 단계 중 상대 말 클릭은 현행대로 무시(메모 아님)
  const T2=H.load(htmlPath); const Q=setup(T2,"pve"); T2.S.teleport={stage:1,piece:null}; T2.render();
  ok(T2.memoClickTarget(2,4)===null,"D12b 텔레포트 선택 중에는 로컬 메모 분기 없음");
  cellOf(T2,2,4).onclick(); ok(!pickerOpen(T2)&&T2.S.teleport.stage===1,"D12c 텔레포트 중 상대 말 클릭은 현행대로 무시");
  T2.S.teleport=null;
  // 인접 전투 지정은 전투 우선 (B7 과 같은 경로를 memoClickTarget 으로 재확인)
  T2.S.selected=Q.me; T2.render(); ok(T2.memoClickTarget(11,4)===null,"D12d 선택한 내 말과 인접한 상대 말은 전투 지정 경로 (메모 아님)");
  ok(T2.memoClickTarget(2,4)===Q.ek,"D12e 비인접 미공개 상대 말은 자기 턴 (b) 로컬 메모 분기");
  // 핫시트 PVP: 뷰어=현재 플레이어 — 상대 턴 메모 없음(항상 자기 턴), 각자 자기 세트
  const T3=H.load(htmlPath); const R=setup(T3,"pvp");
  ok(T3.memoClickTarget(2,4)===R.ek&&T3.memoClickTarget(12,4)===null,"D12f 핫시트 P1 턴: 상대 왕은 (b) 메모 · 자기 말은 아님");
  T3.S.current=1; T3.S.selected=null; T3.render();
  ok(T3.memoClickTarget(12,4)===R.me&&T3.memoClickTarget(2,4)===null&&T3.humanViewer()===1,"D12g 핫시트 P2 턴: 뷰어가 P2 로 교대 — P1 하수인은 P2 의 (b) 메모, 자기 왕은 아님");
  cellOf(T3,12,4).onclick(); T3.MEMO_UI.btns[7].onclick();
  ok(T3.S.memos[1][R.me.id]==="trap"&&Object.keys(T3.S.memos[0]).length===0,"D12h 핫시트 P2 메모는 P2 세트에만");
  // sim: 대상 아님
  const T4=H.load(htmlPath); T4.newGame("sim"); T4.aiAutoPlace(0); T4.aiAutoPlace(1); T4.S.phase="play"; T4.S.current=1; T4.render();
  const anyE=T4.S.pieces.find(x=>x.owner===1&&x.placed&&!T4.inForest(x));
  ok(T4.memoClickTarget(anyE.r,anyE.c)===null,"D12i sim 관전 모드는 로컬 메모 분기 없음");
  // 정적 계약: onCell 은 memoClickTarget 을 먼저 보고, netAction 의 상대 턴 가드·onCellCore 의 AI 가드는 그대로
  ok(/memoClickTarget\(r,c\)/.test(String(T.onCell))&&/netAction\(\{t:"cell",r,c\}\)/.test(String(T.onCell)),"D12j onCell = 로컬 메모 분기 → 그 외 netAction (정적)");
  ok(/a\.t==="resign"\?S\.current:netActor\(\)/.test(String(T.netAction))&&/!==NET\.me/.test(String(T.netAction))&&/상대 턴입니다/.test(String(T.netAction)),"D12k #114 선택 소유자 가드·기권은 현재 플레이어 소유 (실행 회귀 smoke_issue114)");
  ok(/isAI\(S\.current\)\) return;/.test(T.html.slice(T.html.indexOf("function onCellCore"),T.html.indexOf("function observeMove"))),"D12l onCellCore 의 AI 턴 가드는 그대로 (메모는 onCell 단에서만 분기)");
  ok(!/netSend|netAction|rand\(/.test(String(T.memoClickTarget)+String(T.memoModal)+String(T.memoTargetOk)+String(T.memoSet)),"D12m 메모 경로(memoClickTarget·memoModal·memoTargetOk·memoSet)에 송신·액션·난수 호출 없음 (정적)");
  T.TQ.length=0; T2.TQ.length=0; T3.TQ.length=0; T4.TQ.length=0;
});
block("D13 변이본 음성 대조 블록",()=>{
  /* 음성 대조 (인메모리 변이본 — 파일 쓰기 없음): 같은 검사기(sentN 무변화 · pickerOpen)가 결함을 실제로 잡는지 증명한다.
     M1: memoModal 에 불필요한 netSend 를 심음 → D1b/D2c 형 검사기(연결된 소켓 sent)가 실패해야 한다.
     M2: onCell 을 변경 전(netAction 만)으로 되돌림 → D1 형 검사기(피커 열림)가 실패하고 차단 토스트가 떠야 한다. */
  const src=H.load(htmlPath).html;
  const A1="netLocalModal(); // 메모 피커는 로컬 전용 모달", A2='function onCell(r,c){ const m=memoClickTarget(r,c); if(m){ memoModal(m); return; } netAction({t:"cell",r,c}); }';
  ok(src.includes(A1)&&src.includes(A2),"D13 전제: 변이 앵커 2개가 소스에 있다");
  const M1=src.replace(A1,'netLocalModal(); netSend({t:"a",a:{t:"memo"}});'), M2=src.replace(A2,'function onCell(r,c){ netAction({t:"cell",r,c}); }');
  const m1=solo(true,M1); const e1=enemyOf(m1,x=>x.type==="minion"&&!x.revealed); const s1=sentN(m1); cellOf(m1,e1.r,e1.c).onclick();
  ok(pickerOpen(m1)&&sentN(m1)===s1+1&&m1.ws.sent[m1.ws.sent.length-1].includes('"memo"'),"D13a M1(불필요 netSend 변이): 피커는 열리지만 연결된 소켓 sent 가 1 늘어 송신 0 검사기가 실패한다 (검사기 유효)");
  ok(m1.wsLog.length===1,"D13b (참고) wsLog.length 는 변이 전후 모두 1 — 소켓 생성 수는 송신 판정 근거가 될 수 없다");
  const m2=solo(true,M2); const e2=enemyOf(m2,x=>x.type==="minion"&&!x.revealed); const s2=sentN(m2); cellOf(m2,e2.r,e2.c).onclick();
  ok(!pickerOpen(m2)&&sentN(m2)===s2&&toasts(m2).some(t=>/상대 턴/.test(t)),"D13c M2(변경 전 onCell 변이): 상대 턴 클릭이 차단 토스트로 막혀 피커 검사기가 실패한다 (검사기 유효)");
  m1.TQ.length=0; m2.TQ.length=0;
});
Math.random=REAL_RANDOM;

console.log(`\n=== smoke_memo: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
