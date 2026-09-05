/* #36 추측 메모 이모지 피커 헤드리스 회귀 — node demo/test/smoke_memo.js [demo/index.html]
   범위: 8종 선택지·저장/변경/삭제·보드 물음표 자리 반투명 추측 렌더·실제 공개 우선·viewer 격리(PVP)·AI 비관측·공용 로그 비노출·
   구 📝 배지/자유 텍스트 input 제거·접근성(group·aria-pressed·label)·인메모리만(영구 저장 없음)·전투 우선 클릭 경로·제거된 말 메모 정리 */
"use strict";
const H=require("./harness");
const htmlPath=process.argv[2];
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
// #54: 기록형 인메모리 스토리지 — 튜토리얼 자동 표시를 억제(tutorialSeen)하면서 메모가 실제로 무엇을 저장하는지 관찰한다.
const LS=H.setStorage(H.mkStorage({tutorialSeen:"1"}));
const WANT=[["king","👑","왕"],["ally","🤝","동료"],["minion_fire","🔥","불 하수인"],["minion_grass","🌿","풀 하수인"],["minion_water","💧","물 하수인"],["minion_lightning","⚡","전기 하수인"],["bomb","💣","폭탄"],["trap","🪤","함정"]];
function ovHidden(T){ return !T.els.overlay||T.els.overlay.classList.contains("hidden"); } // overlay 미접근 = 열린 적 없음
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
  T.onCell(2,4); T.els.obBtns.children[1].onclick(); ok(T.S.memos[0][P.ek.id]==="trap"&&ovHidden(T),"A16 닫기는 변경 없음");
  T.onCell(2,4); T.els.obBtns.children[0].onclick(); ok(!(P.ek.id in T.S.memos[0])&&guessOf(T,2,4)===null&&chipOf(T,2,4).innerHTML==="?","A17 추측 삭제 → 물음표 복귀");
  ok(T.memoSet(0,P.ek.id,"dragon")===false&&!(P.ek.id in T.S.memos[0])&&T.memoSet(0,P.me.id,"bomb")===false&&!(P.me.id in T.S.memos[0])&&T.memoSet(2,P.ek.id,"bomb")===false,"A18 memoSet: 미정의 키·자기 말·잘못된 뷰어 거부");
  // 사이드 패널
  T.memoSet(0,P.ek.id,"bomb"); T.memoSet(0,P.em.id,"minion_fire"); T.render();
  const sp=T.els.sidePanel.innerHTML;
  ok(/📝 추측 메모/.test(sp)&&/💣<\/span> 2행 4열 — 폭탄 추측/.test(sp)&&/🔥<\/span> 11행 4열 — 불 하수인 추측/.test(sp)&&!/<input/.test(sp),"A19 사이드 패널 목록: 이모지 + 쉬운 라벨 + 위치");
  // #54: 전역 localStorage 문자열 개수가 아니라 (1) MEMO 구간 정적 검사 (2) 파일 전체 저장 키 화이트리스트
  //      (3) 메모 조작 후 실제 저장소 무변화로 판정한다. 온라인 서버 주소(netServer)는 메모 범위 밖의 의도된 저장이므로 오탐 대상이 아니다.
  const memoSrc=T.html.slice(T.html.indexOf("const MEMO_UI="),T.html.indexOf("function handoff"));
  const keys=H.storageKeys(T.html).map(k=>k==="TUT_KEY"?T.TUT_KEY:k);
  ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(memoSrc)
    &&keys.length>0&&keys.every(k=>k===T.TUT_KEY||k==="netServer")&&!keys.some(k=>/memo/i.test(k))
    &&Object.keys(LS.st).join(",")==="tutorialSeen",
    "A20 메모 코드에 영구 저장 없음 (MEMO 구간 저장소 0 · 저장 키는 "+[...new Set(keys)].join("·")+"뿐 · 메모 조작 후 새 키 없음)");
  const T3=H.load(htmlPath); // #54: 새 로드 = 새로고침 — 앞에서 저장한 추측이 살아 돌아오지 않아야 인메모리 증명
  ok(Object.keys(T3.S.memos[0]).length===0&&Object.keys(T3.S.memos[1]).length===0&&LS.getItem("netServer")===null,
    "A21 새로고침(재로드) 시 이전 추측 메모가 남지 않음 (메모는 인메모리 · 저장소에 메모 흔적 없음)");
}

/* ===== B. 실제 공개 우선 · 공개된 말 클릭 · 전투 우선 · 제거된 말 정리 ===== */
{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  T.memoSet(0,P.em.id,"bomb"); T.render(); ok(guessOf(T,11,4)==="💣","B1 전제: 11,4 하수인에 💣 추측");
  P.em.revealed=true; T.render();
  const ch=chipOf(T,11,4);
  ok(!/memo-guess/.test(ch.className)&&!/💣/.test(ch.innerHTML)&&new RegExp(P.em.name||"하수인").test(ch.innerHTML)&&ch.getAttribute("title")===null,"B2 실제 공개되면 실제 렌더 우선·추측 이모지 숨김");
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
  ok(chipOf(T,2,4).innerHTML!=="?"&&!/memo-guess|💣/.test(T.els.board.innerHTML+JSON.stringify(T.els.board.children.map(c=>c.children.map(x=>x.className+x.innerHTML))))&&!/추측 메모/.test(T.els.sidePanel.innerHTML),"C2 P2 시점: P1의 추측이 보드·사이드 패널에 없음 (자기 왕은 실제로 보임)");
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

console.log(`\n=== smoke_memo: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
