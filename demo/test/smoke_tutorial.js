/* #26 튜토리얼 헤드리스 회귀 — node demo/test/smoke_tutorial.js [demo/index.html]
   범위: 8단계 내용·S 분리·최초 1회 자동 표시·건너뛰기/이전/다음/다시 보기·tutorialSeen 단일 키·localStorage 미지원/예외 허용·
   텔레포트/버닝 타임 1회 도움말(게임 상태 무변경)·키보드/포커스/aria·기존 모달 비충돌·외부 연동 없음·ELI5 문장 규격 */
"use strict";
const H=require("./harness");
const htmlPath=process.argv[2];
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function setLS(obj){ // 테스트용 localStorage 스텁 (null → 미지원)
  if(obj===null){ Object.defineProperty(global,"localStorage",{value:undefined,configurable:true,writable:true}); return; }
  Object.defineProperty(global,"localStorage",{value:obj,configurable:true,writable:true});
}
function memLS(){ const st={}, log=[]; return {st,log,getItem:k=>(k in st?st[k]:null),setItem(k,v){st[k]=String(v); log.push(k);},removeItem(k){delete st[k];}}; }
function strip(s){return String(s).replace(/<[^>]+>/g,"");}
function sSnap(T){ const s=T.S; return JSON.stringify({mode:s.mode,phase:s.phase,cur:s.current,main:s.mainUsed,tele:s.teleUsed,bu:s.battlesUsed,tp:s.teleport,sel:s.selected&&s.selected.id,
  pcs:s.pieces.map(p=>[p.id,p.r,p.c,p.alive,p.placed,p.hp]),m:T.metricsSnapshot(),log:s.log.length}); }

/* ===== A. 최초 방문 자동 표시 (localStorage 미지원) · 8단계 내용 · S와 분리 ===== */
{
  setLS(null);
  const T=H.load(htmlPath);
  ok(T.TUT.open===true&&T.TUT.step===0&&T.TUT.auto===true,"A1 localStorage 미지원 환경에서도 최초 로드 시 자동 표시 (step 0)");
  ok(!T.els.tutOverlay.classList.contains("hidden")&&T.els.tutOverlay.getAttribute("aria-hidden")===null,"A2 튜토리얼 오버레이 표시 (hidden 제거·aria-hidden 해제)");
  ok(T.TUT_STEPS.length===8,"A3 기본 8단계");
  const titles=T.TUT_STEPS.map(s=>s.title), body=T.TUT_STEPS.map(s=>strip(s.lines.join(" ")));
  const want=[[/이기/,/왕/],[/5가지|다섯/,/물음표|숨/],[/움직|이동/,/숲/],[/흔적/,/탐색/],[/옆|인접/,/강제 전투/],[/폭탄/,/함정/],[/잡아오기|포획|몬스터볼/,/도망/,/자리를 바꿀/],[/이기는 법|이기는 방법/,/시작/]];
  ok(want.every((rs,i)=>rs.every(r=>r.test(titles[i]+" "+body[i]))),"A4 8단계 주제 순서: 승리 목표→말 5종·정체→이동·숲→흔적·탐색→인접·강제 전투→폭탄·함정→포획·도망 교환→승리 조건·시작");
  ok(/6개/.test(body[1])&&/2개/.test(body[1])&&/3개/.test(body[1])&&/14개/.test(body[1]),"A5 말 구성 수치가 엔진과 일치 (하수인 6·동료 2·왕 1·폭탄 3·함정 2 = 14)");
  ok(/30%/.test(body[6])&&/50%/.test(body[6]),"A6 포획(HP 30% 미만)·도망(HP 50% 미만) 수치가 엔진 규칙과 일치");
  ok(/①/.test(body[7])&&/②/.test(body[7])&&/③/.test(body[7]),"A7 마지막 단계에 승리 조건 3가지 요약");
  // S와 분리: 튜토리얼 열기/이동/닫기가 S를 바꾸지 않고, S에 튜토리얼 키가 없다
  const before=sSnap(T);
  T.tutNext(); T.tutNext(); T.tutPrev(); T.tutGo(7); T.tutGo(0);
  ok(sSnap(T)===before&&!Object.keys(T.S).some(k=>/tut/i.test(k))&&T.TUT!==T.S,"A8 튜토리얼 조작이 게임 상태 S를 변경하지 않음 · S에 튜토리얼 키 없음");
  ok(T.els.app.hasAttribute("inert")&&T.els.app.getAttribute("aria-hidden")==="true"&&T.els.overlay.hasAttribute("inert"),"A9 열린 동안 게임 화면·게임 모달은 inert/aria-hidden");
  ok(/role="dialog"/.test(T.html)&&/aria-modal="true"/.test(T.html)&&/aria-labelledby="tutTitle"/.test(T.html)&&/aria-describedby="tutBody"/.test(T.html),"A10 대화상자 마크업: role=dialog·aria-modal·labelledby·describedby");
  ok(/id="tutCount" aria-live="polite"/.test(T.els.tutBox.innerHTML)&&/id="tutTitle"/.test(T.els.tutBox.innerHTML)&&/id="tutBody"/.test(T.els.tutBox.innerHTML),"A11 단계 카운터 aria-live·제목/본문 id 렌더");
}

/* ===== B. 이전/다음/건너뛰기/다시 보기 · 버튼 구성 · tutorialSeen 단일 키 ===== */
{
  const ls=memLS(); setLS(ls);
  const T=H.load(htmlPath);
  ok(T.TUT.open===true,"B1 tutorialSeen 없음 → 자동 표시");
  const txt=()=>T.TUT.btns.map(b=>b.textContent+(b.disabled?"(x)":"")).join("|");
  ok(/이전\(x\)/.test(txt())&&/다음/.test(txt())&&/건너뛰기/.test(txt()),"B2 1단계 버튼: 이전(비활성)·다음·건너뛰기 ("+txt()+")");
  T.tutPrev(); ok(T.TUT.step===0,"B3 1단계에서 이전은 무동작");
  for(let i=0;i<7;i++) T.tutNext();
  ok(T.TUT.step===7&&/게임 시작/.test(txt())&&/처음부터/.test(txt())&&!/건너뛰기/.test(txt()),"B4 8단계 버튼: 이전·게임 시작·처음부터 ("+txt()+")");
  T.TUT.btns.find(b=>/처음부터/.test(b.textContent)).onclick(); ok(T.TUT.open&&T.TUT.step===0,"B5 '처음부터' → 1단계로 (열린 상태 유지)");
  ok(ls.log.length===0,"B6 열람·이동 중에는 저장하지 않음");
  T.tutGo(7); T.TUT.btns.find(b=>/게임 시작/.test(b.textContent)).onclick();
  ok(T.TUT.open===false&&T.els.tutOverlay.classList.contains("hidden")&&T.els.tutOverlay.getAttribute("aria-hidden")==="true","B7 '게임 시작' → 닫힘");
  ok(ls.st.tutorialSeen==="1"&&Object.keys(ls.st).length===1&&ls.log.every(k=>k==="tutorialSeen"),"B8 저장 키는 tutorialSeen 하나뿐");
  ok(!T.els.app.hasAttribute("inert")&&T.els.app.getAttribute("aria-hidden")===null,"B9 닫힌 후 게임 화면 inert/aria-hidden 해제");
  T.tutOpen(); ok(T.TUT.open&&T.TUT.step===0&&T.TUT.auto===false,"B10 다시 보기(tutOpen) → 1단계부터 재표시");
  T.tutSkip(); ok(!T.TUT.open&&ls.st.tutorialSeen==="1","B11 건너뛰기 → 닫힘·seen 유지");
  T.tutOpen(); T.tutNext(); T.tutOpen(); ok(T.TUT.open&&T.TUT.step===0,"B12 열린 상태에서 다시 보기 → 1단계로 리셋"); T.tutSkip();
  // 재방문: tutorialSeen=1 이면 자동 표시 안 함, 다시 보기는 가능
  const T2=H.load(htmlPath);
  ok(T2.TUT.open===false&&T2.TUT.btns.length===0,"B13 tutorialSeen=1 재방문 → 자동 표시 없음");
  ok(/id="tutOverlay" class="hidden" aria-hidden="true"/.test(T2.html)&&/id="tutHint" class="hidden"/.test(T2.html),"B14 초기 마크업은 오버레이·도움말 모두 hidden");
  T2.tutOpen(); ok(T2.TUT.open&&T2.TUT.step===0,"B15 재방문에서도 다시 보기 가능"); T2.tutSkip();
  ok(/튜토리얼 다시 보기/.test(T2.els.sidePanel.innerHTML)&&/id="tutBtn"/.test(T2.html)&&/onclick="tutOpen\(\)"/.test(T2.html),"B16 메뉴 '튜토리얼 다시 보기' 버튼 + 헤더 ? 버튼");
}

/* ===== C. localStorage 접근·쓰기 예외 허용 ===== */
{
  Object.defineProperty(global,"localStorage",{configurable:true,get(){throw new Error("SecurityError: denied");}});
  let T=null, err=null;
  try{ T=H.load(htmlPath); }catch(e){ err=e; }
  ok(!err&&T&&T.TUT.open===true,"C1 localStorage 접근 자체가 예외를 던져도 로드·자동 표시 정상 ("+(err&&err.message)+")");
  let err2=null; try{ T.tutSkip(); }catch(e){ err2=e; }
  ok(!err2&&!T.TUT.open&&T.tutSeen()===true,"C2 예외 환경에서 건너뛰기 정상 + 이번 로드 내 seen 유지(메모리)");
  ok(T.tutStore.set()===false&&T.tutStore.get()===false,"C3 tutStore.get/set은 예외를 삼키고 false 반환");
  const ls=memLS(); ls.setItem=()=>{throw new Error("QuotaExceededError");}; setLS(ls);
  const T3=H.load(htmlPath); let err3=null; try{ T3.tutNext(); T3.tutSkip(); }catch(e){ err3=e; }
  ok(!err3&&!T3.TUT.open&&T3.TUT.seenThisLoad===true,"C4 setItem 예외(용량·시크릿 모드)에서도 닫힘·메모리 seen 정상");
}

/* ===== D. 키보드·포커스 ===== */
{
  const ls=memLS(); setLS(ls);
  const T=H.load(htmlPath); const D=global.document;
  const ev=k=>{let pd=false; const e={key:k,shiftKey:false,preventDefault(){pd=true;},stopPropagation(){}}; return {e,get pd(){return pd;}};};
  ok(D.activeElement===T.TUT.btns[1]&&/다음/.test(D.activeElement.textContent),"D1 열리면 '다음' 버튼에 포커스");
  let a=ev("ArrowRight"); T.tutKeydown(a.e); ok(T.TUT.step===1&&a.pd,"D2 → 키: 다음 단계 (기본 동작 차단)");
  a=ev("ArrowLeft"); T.tutKeydown(a.e); ok(T.TUT.step===0&&a.pd,"D3 ← 키: 이전 단계");
  // Tab 순환: 1단계에서 활성 버튼은 [다음, 건너뛰기] — 마지막에서 Tab → 첫 활성, 첫에서 Shift+Tab → 마지막
  T.TUT.btns[2].focus(); a=ev("Tab"); T.tutKeydown(a.e);
  ok(D.activeElement===T.TUT.btns[1]&&a.pd,"D4 Tab 순환: 마지막 버튼 → 첫 활성 버튼 (비활성 '이전' 건너뜀)");
  a=ev("Tab"); a.e.shiftKey=true; T.tutKeydown(a.e);
  ok(D.activeElement===T.TUT.btns[2],"D5 Shift+Tab 순환: 첫 활성 버튼 → 마지막 버튼");
  // 리스너가 오버레이에 등록되어 있고 dispatch로도 동작
  T.els.tutOverlay.dispatch("keydown",ev("ArrowRight").e); ok(T.TUT.step===1,"D6 오버레이 keydown 리스너 등록 (dispatch로 다음 단계)");
  a=ev("Escape"); T.tutKeydown(a.e); ok(!T.TUT.open&&ls.st.tutorialSeen==="1","D7 Esc: 건너뛰기(닫힘·seen)");
  ok(T.tutKeydown(ev("ArrowRight").e)===false&&T.TUT.step===1,"D8 닫힌 뒤 키 입력은 무시");
  // 포커스 복원: 열기 전 요소로, 없으면 헤더 ? 버튼으로
  const x=D.createElement("button"); x.focus(); T.tutOpen(); ok(D.activeElement!==x,"D9 열리면 포커스가 대화상자 안으로 이동");
  T.tutSkip(); ok(D.activeElement===x,"D10 닫히면 원래 요소로 포커스 복원");
  x.focus(); T.tutOpen(); x.isConnected=false; T.tutSkip(); ok(D.activeElement===T.els.tutBtn,"D11 원래 요소가 문서에서 사라지면 헤더 ? 버튼으로 안전 복원");
  x.isConnected=true; x.focus(); T.tutOpen(); x.disabled=true; T.tutSkip(); ok(D.activeElement===T.els.tutBtn,"D12 원래 요소가 비활성이면 ? 버튼으로 복원");
  D.activeElement=D.body; T.tutOpen(); T.tutSkip(); ok(D.activeElement===T.els.tutBtn,"D13 열기 전 포커스가 body면 ? 버튼으로");
}

/* ===== E. 상황 도움말 — 텔레포트·버닝 타임 첫 발생 1회 · 게임 상태 무변경 · sim 제외 ===== */
{
  setLS(memLS());
  const T=H.load(htmlPath); T.tutSkip();
  H.freshPlay(T,"pve"); H.clearBoard(T);
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion");
  H.place(T,m,11,3); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.render();
  ok(T.TUT.hints.teleport===false&&T.els.tutHint.children.length===0,"E1 텔레포트 불가 상태에서는 도움말 없음");
  H.place(T,m,3,4); // 상대 진영 진입 → 텔레포트 가능
  const before=sSnap(T);
  T.render();
  ok(T.TUT.hints.teleport===true&&!T.els.tutHint.classList.contains("hidden")&&/텔레포트\(순간이동\)/.test(T.els.tutHint.innerHTML),"E2 사람 턴에 텔레포트가 처음 가능해지면 도움말 1회 (전문어 즉시 풀이)");
  ok(sSnap(T)===before,"E3 도움말 표시가 게임 상태 S를 변경하지 않음");
  const okBtn=T.els.tutHint.children.find(b=>/알겠어요/.test(b.textContent));
  ok(!!okBtn&&okBtn.getAttribute("aria-label")==="도움말 닫기","E4 도움말 닫기 버튼(알겠어요)");
  okBtn.onclick(); ok(T.els.tutHint.classList.contains("hidden"),"E5 닫기 후 숨김");
  T.render(); ok(T.els.tutHint.classList.contains("hidden")&&T.tutHint("teleport")===false,"E6 두 번째부터는 표시 안 함 (1회)");
  // 버닝 타임: 첫 진입 턴에 1회
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="minion"),12,3); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="minion"),2,3);
  H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.S.turnCount=T.BAL.burnStart-2; T.S.mainUsed=true;
  const b2=sSnap(T); T.endTurn(); // turnCount → burnStart-1 → 표시 턴 = burnStart → BT 진입
  ok(T.S.metrics.btReached===true&&T.TUT.hints.burning===true&&/버닝 타임\(불타는 시간\)/.test(T.els.tutHint.innerHTML),"E7 버닝 타임 첫 진입 시 도움말 1회 (전문어 즉시 풀이)");
  ok(JSON.parse(sSnap(T)).m.total.btEnterTurn===T.BAL.burnStart&&b2!==sSnap(T),"E8 엔진의 BT 진입 처리(btReached·btEnterTurn)는 기존과 동일");
  T.tutHintClose(); T.S.mainUsed=true; T.endTurn();
  ok(T.els.tutHint.classList.contains("hidden")&&T.tutHint("burning")===false,"E9 이후 턴에는 재표시 없음");
  // sim 모드: 도움말 미발생 (fresh hints)
  T.TUT.hints.teleport=false; T.TUT.hints.burning=false; T.tutHintClose();
  const r=H.runSim(T,["grade5","grade5"],321);
  ok(r.phase==="over"&&T.TUT.hints.teleport===false&&T.TUT.hints.burning===false&&T.els.tutHint.classList.contains("hidden"),"E10 sim 모드에서는 도움말 미발생 · sim 완주 정상");
  ok(T.TUT.hints.teleport===false&&Object.keys(global.localStorage.st).every(k=>k==="tutorialSeen"),"E11 도움말은 저장하지 않음 (localStorage에 tutorialSeen 외 키 없음)");
  T.TQ.length=0;
}

/* ===== F. 기존 모달·입력과 충돌 없음 · 외부 연동 없음 · ELI5 문장 규격 · 모바일 CSS ===== */
{
  setLS(memLS());
  const T=H.load(htmlPath); T.tutSkip();
  T.modal("<h2>테스트</h2>",[["확인",T.close]]);
  ok(!T.els.overlay.classList.contains("hidden"),"F0 전제: 게임 모달 열림");
  T.tutOpen();
  ok(T.TUT.open&&!T.els.overlay.classList.contains("hidden"),"F1 게임 모달 위에 튜토리얼 열림 (게임 모달 유지)");
  T.tutSkip();
  ok(!T.TUT.open&&!T.els.overlay.classList.contains("hidden"),"F2 튜토리얼 닫기가 게임 모달을 닫지 않음");
  T.tutOpen(); T.close();
  ok(T.TUT.open&&T.els.overlay.classList.contains("hidden")&&!T.els.tutOverlay.classList.contains("hidden"),"F3 게임 모달 close()가 튜토리얼을 닫지 않음");
  T.tutSkip();
  ok(/z-index:60/.test(T.html)&&/#tutHint\{[^}]*z-index:45/.test(T.html),"F4 z-order: 튜토리얼(60) > 게임 모달(50) > 상황 도움말(45)");
  // 게임 입력: 튜토리얼 열린 상태에서도 S 조작 API 자체는 정상 (inert는 브라우저 포인터 차단용)
  H.freshPlay(T,"pvp"); const snap=sSnap(T); T.tutOpen(); T.render(); ok(sSnap(T)===snap&&T.TUT.open,"F5 튜토리얼 열린 채 render()해도 상태·튜토리얼 유지"); T.tutSkip();
  // 외부 연동 없음
  const src=T.html.slice(T.html.indexOf("#26 첫 플레이어용 ELI5 튜토리얼"), T.html.indexOf("/* ===== 시작: 모드 선택 화면"));
  ok(src.length>1000&&!/window\.open|https?:\/\/|fetch\(|XMLHttpRequest|<iframe|WebSocket|navigator\.sendBeacon/.test(src),"F6 튜토리얼 코드에 외부 창·서버·사이트 연동 없음");
  ok(!/localStorage\.(getItem|setItem)\(\s*["'](?!tutorialSeen)/.test(T.html)&&(T.html.match(/localStorage/g)||[]).length<=4,"F7 localStorage 사용은 tutStore(tutorialSeen)로 한정");
  // ELI5: 단계당 문장 ≤3, 문장당 ≤75자, '~요' 체, 전문어 풀이 괄호
  const lines=T.TUT_STEPS.map(s=>s.lines.map(strip));
  ok(lines.every(ls=>ls.length<=3&&ls.every(l=>l.length<=75)),"F8 한 화면 최대 3문단·문단 75자 이하 ("+lines.map(ls=>ls.map(l=>l.length).join("/")).join(" | ")+")");
  ok(lines.every(ls=>ls.every(l=>/[요!][.!]?\s*$/.test(l.trim()))),"F9 모든 문단이 '~요'/'!'로 끝나는 쉬운 말투");
  const all=lines.flat().join(" ");
  ok(/강제 전투\(무조건 싸움\)/.test(all)&&/HP\(체력\)/.test(all)&&/탐색\(찾아보기\)/.test(all)&&/하수인\(싸우는 말\)/.test(all),"F10 전문어 즉시 풀이: 강제 전투·HP·탐색·하수인");
  ok(T.TUT_STEPS.every(s=>s.icon&&s.title&&s.pic&&s.lines.length),"F11 모든 단계에 아이콘·제목·그림·본문");
  // 모바일 360×640: 미디어쿼리·박스 폭·터치 타깃
  ok(/@media \(max-width:480px\)\{[\s\S]*#tutBox\{[^}]*max-height:calc\(100dvh - 16px\)/.test(T.html)&&/#tutBox\{[^}]*max-width:420px/.test(T.html)&&/\.tut-nav button\{[^}]*min-height:42px/.test(T.html),"F12 모바일 레이아웃: ≤480px 미디어쿼리·박스 max-width 420·버튼 높이 42px");
  ok(/#tutOverlay\{[^}]*padding:12px/.test(T.html)&&/#tutBox\{[^}]*overflow-y:auto/.test(T.html)&&/#tutHint\{[^}]*width:min\(94vw,440px\)/.test(T.html),"F13 360px 폭 수용: 오버레이 여백·박스 내부 스크롤·도움말 폭 94vw");
}

console.log(`\n=== smoke_tutorial: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
