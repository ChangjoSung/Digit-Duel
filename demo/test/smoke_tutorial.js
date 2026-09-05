/* #26·#32 튜토리얼 헤드리스 회귀 — node demo/test/smoke_tutorial.js [demo/index.html]
   범위: 10단계 내용·규칙 수치 일치·장면 그림(인라인 SVG 10종 고유·접근성 대체 텍스트·문단↔장면 번호 대응)·S 분리·최초 1회 자동 표시·
   건너뛰기/이전/다음/다시 보기·tutorialSeen 단일 키·localStorage 미지원/예외 허용·텔레포트/버닝 타임 1회 도움말(게임 상태 무변경)·
   키보드/포커스/aria·기존 모달 비충돌·외부 연동 없음·ELI5 문장 규격 ·
   #32 REVISE: 장면 글자 최소 13 viewBox 단위 + CSS에서 유도한 최악 배율(360px 폭 → SVG 314px, 0.981)로 렌더 12 CSS px 이상 · 3단계 방향 라벨 두 줄 분리·안전 좌표 (정적 검증) —
   실제 Chromium 360×640·1280×800 렌더 측정(글자 px·bbox·무스크롤)은 별도 CDP 러너로 수행하며 이 파일에는 포함하지 않는다 */
"use strict";
const H=require("./harness");
const htmlPath=process.argv[2];
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
/* #54 REVISE: 저장소는 전역에 직접 꽂지 않고 하네스의 "명시적 사전 설치" 계약으로 넘긴다.
   (load()는 storage 옵션이 없으면 빈 저장소를 새로 만들고, setStorage()로 설치한 것만 물려받는다 —
    앞선 load가 남긴 저장소를 우연히 물려받는 비결정성 제거) */
function setLS(obj){ return H.setStorage(obj); } // null → 웹 스토리지 미지원 환경
function memLS(){ return H.mkStorage(); }        // st·log(setItem 키 목록)·writes 기록형 인메모리 스텁
function strip(s){return String(s).replace(/<[^>]+>/g,"");}
function sSnap(T){ const s=T.S; return JSON.stringify({mode:s.mode,phase:s.phase,cur:s.current,main:s.mainUsed,tele:s.teleUsed,bu:s.battlesUsed,tp:s.teleport,sel:s.selected&&s.selected.id,
  pcs:s.pieces.map(p=>[p.id,p.r,p.c,p.alive,p.placed,p.hp]),m:T.metricsSnapshot(),log:s.log.length}); }
const N=10, LAST=N-1;

/* ===== A. 최초 방문 자동 표시 (localStorage 미지원) · 10단계 내용·순서 · 규칙 수치 일치 · S와 분리 ===== */
{
  setLS(null);
  const T=H.load(htmlPath);
  ok(T.TUT.open===true&&T.TUT.step===0&&T.TUT.auto===true,"A1 localStorage 미지원 환경에서도 최초 로드 시 자동 표시 (step 0)");
  ok(!T.els.tutOverlay.classList.contains("hidden")&&T.els.tutOverlay.getAttribute("aria-hidden")===null,"A2 튜토리얼 오버레이 표시 (hidden 제거·aria-hidden 해제)");
  ok(T.TUT_STEPS.length===N,"A3 기본 10단계");
  const titles=T.TUT_STEPS.map(s=>s.title), body=T.TUT_STEPS.map(s=>strip(s.lines.join(" ")));
  const want=[[/이기/,/왕/,/끝줄/,/하수인/,/동료/],[/5가지|다섯/,/물음표/,/14개/],[/움직|이동/,/숲/,/부딪/],[/흔적/,/탐색/,/다음 차례/],[/옆/,/강제 전투/,/가위바위보/],[/폭탄/,/함정/],
    [/몬스터볼|포획|잡아오기/,/도망/,/예비 하수인/],[/텔레포트/,/두 개/,/따로/],[/버닝 타임/,/2칸/,/1칸/],[/복습|체크리스트/,/이기는 길/,/턴 종료/,/시작/]];
  ok(want.every((rs,i)=>rs.every(r=>r.test(titles[i]+" "+body[i]))),"A4 10단계 주제 순서: 승리 3조건→말 5종·정체→이동·숲→흔적·탐색→강제 전투·속성→폭탄·함정→포획·도망→텔레포트→버닝 타임→복습");
  ok(/6개/.test(body[1])&&/2개/.test(body[1])&&/1개/.test(body[1])&&/3개/.test(body[1])&&/14개/.test(body[1]),"A5 말 구성 수치가 엔진과 일치 (하수인 6·동료 2·왕 1·폭탄 3·함정 2 = 14)");
  ok(/왕/.test(body[0])&&/끝줄/.test(body[0])&&/하수인.*6개/.test(body[0])&&/동료.*2개/.test(body[0])&&/모두 없애/.test(body[0]),"A6 1단계에 승리 조건 3가지 모두(왕 제거·끝줄·전멸) — 마지막 복습과 범위 동일");
  ok(/한 칸/.test(body[2])&&/대각선/.test(body[2])&&/바로 옆/.test(body[2])&&/다시 숨/.test(body[2])&&/앞 칸에 멈추/.test(body[2]),"A7 이동 1칸 직교·숲 은폐/공개/재은폐·숨은 말 충돌 정지 규칙");
  ok(/다음 차례/.test(body[3])&&/하수인·동료·왕/.test(body[3])&&/폭탄·함정은 못/.test(body[3])&&/몬스터볼/.test(body[3])&&/버프/.test(body[3]),"A8 흔적→다음 턴 탐색·탐색 가능 말(하수인·동료·왕)·보상 요약");
  const bt=T.BEATS, cyc=`${{fire:"불",water:"물",grass:"풀",lightning:"번개"}.fire}→${({fire:"불",water:"물",grass:"풀",lightning:"번개"})[bt.fire]}→${({fire:"불",water:"물",grass:"풀",lightning:"번개"})[bt[bt.fire]]}→${({fire:"불",water:"물",grass:"풀",lightning:"번개"})[bt[bt[bt.fire]]]}→불`;
  ok(body[4].includes(cyc)&&/최대 2번/.test(body[4])&&/HP\(체력\)/.test(body[4])&&/쿨타임.*그대로/.test(body[4])&&/상태이상.*사라/.test(body[4]),"A9 강제 전투·최대 2회·상성 순환("+cyc+")이 엔진 BEATS와 일치·HP/쿨 유지·상태이상 해제");
  ok(/폭탄.*한 칸/.test(body[5])&&/2칸/.test(body[5])&&/함정.*못 움직/.test(body[5])&&/둘 다 사라/.test(body[5])&&/동료·왕.*살아남/.test(body[5])&&/2번/.test(body[5]),"A10 폭탄 1칸/BT 2칸·함정 고정·폭탄 vs 하수인 동귀·동료/왕 생존·함정 2턴 정지");
  ok(/30%/.test(body[6])&&/70%/.test(body[6])&&/70\/100/.test(body[6])&&/볼.*1개.*없어/.test(body[6])&&/50%.*도망/.test(body[6])&&/성공률 ?(은 )?<?b?>?50%/.test(strip(T.TUT_STEPS[6].lines[2]))&&/바로 한 번 더/.test(body[6])&&/뒤에 있는 내 말/.test(body[6]),
    "A11 포획(HP<30%·70%·예비 70/100·볼 소모)·도망(HP<50%·50%·실패 시 즉시 공격·후방 교환) 수치가 엔진과 일치");
  ok(Math.round(T.BAL.enemyCapProb*100)===70&&Math.round(T.BAL.fleeProb*100)===50&&T.BAL.enemyCapHp===70&&T.BAL.captured.hp===100,"A11b 엔진 상수 전제 (enemyCapProb .7·fleeProb .5·enemyCapHp 70/100)");
  ok(/상대편 땅/.test(body[7])&&/두 개/.test(body[7])&&new RegExp(T.BAL.teleMax+"번").test(body[7])&&/각자 따로/.test(body[7])&&/모자라면 못/.test(body[7]),"A12 텔레포트 조건·스왑·경기당 "+T.BAL.teleMax+"회·양측 독립 강제 전투·슬롯 부족 차단");
  ok(new RegExp(T.BAL.burnStart+"번째 턴").test(body[8])&&/곧게 2칸/.test(body[8])&&/숲.*땅.*1칸/.test(body[8])&&/폭탄.*2칸/.test(body[8])&&/함정.*고정/.test(body[8]),"A13 버닝 타임 턴 "+T.BAL.burnStart+"·직선 2칸·상대 숲/진영 1칸·폭탄 2칸·함정 고정");
  ok(/왕/.test(body[9])&&/끝줄/.test(body[9])&&/전멸/.test(body[9])&&/주 행동 하나/.test(body[9])&&/턴 종료/.test(body[9]),"A14 복습: 승리 3조건·주 행동 1개·강제 전투·턴 종료 체크리스트");
  // S와 분리
  const before=sSnap(T);
  T.tutNext(); T.tutNext(); T.tutPrev(); T.tutGo(LAST); T.tutGo(0);
  ok(sSnap(T)===before&&!Object.keys(T.S).some(k=>/tut/i.test(k))&&T.TUT!==T.S,"A15 튜토리얼 조작이 게임 상태 S를 변경하지 않음 · S에 튜토리얼 키 없음");
  ok(T.els.app.hasAttribute("inert")&&T.els.app.getAttribute("aria-hidden")==="true"&&T.els.overlay.hasAttribute("inert"),"A16 열린 동안 게임 화면·게임 모달은 inert/aria-hidden");
  ok(/role="dialog"/.test(T.html)&&/aria-modal="true"/.test(T.html)&&/aria-labelledby="tutTitle"/.test(T.html)&&/aria-describedby="tutBody"/.test(T.html),"A17 대화상자 마크업: role=dialog·aria-modal·labelledby·describedby");
  ok(/id="tutCount" aria-live="polite"/.test(T.els.tutBox.innerHTML)&&/id="tutTitle"/.test(T.els.tutBox.innerHTML)&&/id="tutBody"/.test(T.els.tutBox.innerHTML),"A18 단계 카운터 aria-live·제목/본문 id 렌더");
}

/* ===== G. #42 장면 = (1)~(n) 독립 카드 블록 — 번호 배지·제목·그림·결과·설명이 DOM, 공간 도형만 소형 SVG/DOM 격자 · 절대좌표 텍스트 없음 · 반응형 격자 ===== */
{
  setLS(memLS());
  const T=H.load(htmlPath);
  const steps=T.TUT_STEPS, cards=steps.map(s=>s.cards);
  ok(cards.every((cs,i)=>Array.isArray(cs)&&cs.length===steps[i].lines.length&&cs.length>=3&&cs.length<=4),"G1 모든 단계가 카드 배열 — 카드 수 = 설명 문단 수 (3~4) — "+cards.map(c=>c.length).join("/"));
  ok(cards.every(cs=>cs.every(c=>typeof c.t==="string"&&c.t.length>=2&&c.t.length<=16&&typeof c.vis==="string"&&c.vis.length>20&&(c.res===undefined||typeof c.res==="string"))),"G2 카드 = 제목(2~16자)·그림(vis)·결과(선택) 구조");
  ok(cards.every(cs=>new Set(cs.map(c=>c.t)).size===cs.length),"G3 한 단계 안의 카드 제목은 서로 다름");
  const allVis=cards.flat().map(c=>c.vis), allSvg=allVis.flatMap(v=>v.match(/<svg[\s\S]*?<\/svg>/g)||[]);
  ok(allSvg.length>=20&&allSvg.every(sv=>/^<svg class="tut-(fig|ico|ico lg|arr)" viewBox="0 0 \d+ \d+"/.test(sv)&&/preserveAspectRatio="xMidYMid meet"|aria-hidden="true"/.test(sv)&&/focusable="false"/.test(sv)),"G4 소형 SVG는 고유 viewBox + meet 비율 유지(잘림 없음) + focusable=false — "+allSvg.length+"개");
  const figs=allSvg.filter(sv=>/class="tut-(fig|ico)"/.test(sv));
  ok(figs.every(sv=>/role="img" aria-label="[^"]{8,}"/.test(sv)),"G5 그림 SVG마다 role=img + 8자 이상 대체 텍스트 (장식 화살표만 aria-hidden)");
  const vb=figs.map(sv=>sv.match(/viewBox="0 0 (\d+) (\d+)"/).slice(1,3).map(Number));
  ok(vb.every(([w,h])=>w<=160&&h<=100)&&!/viewBox="0 0 320 /.test(T.html),"G6 큰 단일 320×H 장면 SVG 제거 — 모든 그림은 소형(폭 ≤160·높이 ≤100 단위) — 최대 "+Math.max(...vb.map(v=>v[0]))+"×"+Math.max(...vb.map(v=>v[1])));
  const svgTexts=allSvg.flatMap(sv=>(sv.match(/<text[^>]*>([^<]*)<\/text>/g)||[]).map(m=>m.replace(/<[^>]+>/g,"")));
  ok(svgTexts.length>=40&&svgTexts.every(t=>!/[가-힣A-Za-z0-9%]/.test(t)),"G7 SVG <text>는 이모지·기호 글리프만 (한글·영문·숫자는 전부 DOM 텍스트) — "+svgTexts.length+"개, 위반: "+svgTexts.filter(t=>/[가-힣A-Za-z0-9%]/.test(t)).join(","));
  const domTxt=allVis.map(v=>v.replace(/<svg[\s\S]*?<\/svg>/g,"").replace(/<[^>]+>/g,"").trim()).filter(Boolean);
  ok(domTxt.length>=14&&domTxt.some(t=>/70%/.test(t))&&domTxt.some(t=>/50%/.test(t))&&domTxt.some(t=>/하수인 6/.test(t))&&domTxt.some(t=>/턴 종료/.test(t)),"G8 수치·이름 라벨(70%·50%·하수인 6·턴 종료 …)은 DOM 텍스트로 렌더 — 카드 그림 DOM 텍스트 "+domTxt.length+"개");
  const bad=/<img|<image|<iframe|<video|<audio|<object|<embed|<foreignObject|<use|xlink:href|href=|url\(|https?:|data:|canvas|<script|<style/i;
  ok(allVis.every(v=>!bad.test(v)),"G9 카드 그림에 외부 이미지·URL·iframe·foreignObject·use·canvas·스크립트 없음");
  ok(allVis.every(v=>!/position\s*:|\bleft\s*:|\btop\s*:|transform\s*:/.test(v)),"G10 카드 그림에 절대좌표 인라인 스타일(position/left/top/transform) 없음 — 간격은 CSS gap/padding");
  // 렌더: 현재 단계가 카드(article) n개로 그려지고 배지·제목·그림·설명이 카드 안에 있다
  for(const i of [0,3,6,8]){
    T.tutGo(i); const h=T.els.tutBox.innerHTML, n=steps[i].cards.length;
    const arts=h.match(/<article class="tut-card"[\s\S]*?<\/article>/g)||[];
    ok(arts.length===n&&arts.every((a,k)=>new RegExp('<span class="tut-sn" data-n="'+(k+1)+'">'+(k+1)+'</span>').test(a)&&a.includes('<h3 id="tutCard'+k+'">'+steps[i].cards[k].t+'</h3>')&&a.includes('<div class="tut-vis">'+steps[i].cards[k].vis+'</div>')&&a.includes('<p class="tut-txt">'+steps[i].lines[k]+'</p>')&&(!steps[i].cards[k].res||a.includes(steps[i].cards[k].res))),
      "G11 "+(i+1)+"단계 렌더: article.tut-card × "+n+" — 각 카드에 번호 배지(data-n) · 제목 h3 · 그림 · 결과 · 설명 문단 1:1");
    ok(/<div id="tutBody" class="tut-scene">/.test(h)&&!new RegExp('data-n="'+(n+1)+'"').test(h)&&!/tut-body|tut-pic|class="tut-n"/.test(h),"G12 "+(i+1)+"단계: 카드 격자가 aria-describedby 대상(tutBody) · 여분 배지·구 tut-body/tut-pic 없음");
  }
  T.tutGo(8); ok(/<div class="tut-banner">턴 65부터 🔥 버닝 타임<\/div>/.test(T.els.tutBox.innerHTML)&&(T.els.tutBox.innerHTML.match(/tut-banner/g)||[]).length===1,"G13 9단계 상단 배너(턴 65부터 버닝 타임)는 격자 전체 폭 1개");
  T.tutGo(4); ok(!/tut-banner/.test(T.els.tutBox.innerHTML),"G13b 다른 단계엔 배너 없음");
  // CSS 구조: 격자 auto-fit/minmax · 간격은 변수 · 배지 place-items:center · 텍스트 자연 줄바꿈 · 절대좌표 없음
  const css=T.html.slice(T.html.indexOf("/* ===== #26 튜토리얼 모달"),T.html.indexOf("</style>"));
  ok(/\.tut-scene\{[^}]*display:grid;[^}]*grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,var\(--tut-card-min\)\),1fr\)\);[^}]*gap:var\(--tut-gap\)/.test(css),"G14 .tut-scene = CSS Grid auto-fit/minmax(var(--tut-card-min)) + gap 변수");
  ok(/\.tut-sn\{[^}]*display:grid;[^}]*place-items:center/.test(css),"G15 번호 원형 배지는 display:grid + place-items:center");
  ok(/\.tut-card\{[^}]*min-width:0/.test(css)&&/\.tut-txt\{[^}]*overflow-wrap:anywhere/.test(css)&&/\.tut-card-h h3\{[^}]*overflow-wrap:anywhere/.test(css)&&/\.tut-res\{[^}]*overflow-wrap:anywhere/.test(css),"G16 카드·제목·결과·설명은 min-width:0 + overflow-wrap:anywhere (좁은 열에서 자연 줄바꿈, 넘침 없음)");
  ok(!/position:absolute/.test(css)&&(css.match(/position:fixed/g)||[]).length===2,"G17 튜토리얼 CSS에 position:absolute 없음 (fixed는 오버레이·도움말 2곳뿐)");
  ok(/\.tut-vis svg\.tut-fig\{[^}]*width:100%;[^}]*height:var\(--tut-vis-h\)/.test(css)&&/#tutBox\{[^}]*--tut-vis-h:/.test(css),"G18 그림 SVG 높이는 --tut-vis-h 변수, 폭 100% (meet 비율로 카드 안에 맞춤)");
  // 반응형 열 수 (정적 계산): 뷰포트 → 오버레이 여백 → 박스 max-width·padding·border → 카드 최소폭·gap
  const num=(blk,re,d)=>{ const m=blk.match(re); return m?parseFloat(m[1]):d; };
  const base={ov:num(css,/#tutOverlay\{[^}]*padding:([0-9.]+)px/),max:num(css,/#tutBox\{[^}]*max-width:([0-9.]+)px/),padX:num(css,/#tutBox\{[^}]*padding:[0-9.]+px ([0-9.]+)px/),min:num(css,/#tutBox\{[^}]*--tut-card-min:([0-9.]+)px/),gap:num(css,/#tutBox\{[^}]*--tut-gap:([0-9.]+)px/)};
  const blk=(re)=>{ const m=css.match(re); return m?m[1]:""; };
  const mob=blk(/@media \(max-width:480px\)\{([\s\S]*?)\n  \}/), dsk=blk(/@media \(min-width:600px\)\{([\s\S]*?)\n  \}/), big=blk(/@media \(min-width:1400px\) and \(min-height:960px\)\{([\s\S]*?)\n  \}/);
  const tier=(b,parent)=>({ov:num(b,/#tutOverlay\{[^}]*padding:([0-9.]+)px/,parent.ov),max:num(b,/#tutBox\{[^}]*max-width:([0-9.]+)px/,parent.max),padX:num(b,/#tutBox\{[^}]*padding:[0-9.]+px ([0-9.]+)px/,parent.padX),min:num(b,/#tutBox\{[^}]*--tut-card-min:([0-9.]+)px/,parent.min),gap:num(b,/#tutBox\{[^}]*--tut-gap:([0-9.]+)px/,parent.gap)});
  const tMob=tier(mob,base), tDsk=tier(dsk,base), tBig=tier(big,tDsk);
  const cols=(t,vw)=>{ const box=Math.min(t.max,vw-2*t.ov), inner=box-2*t.padX-2; return {box,inner,cols:Math.max(1,Math.floor((inner+t.gap)/(t.min+t.gap)))}; };
  const c360=cols(tMob,360), c640=cols(tDsk,640), c768=cols(tDsk,768), c1024=cols(tDsk,1024), c1280=cols(tDsk,1280), c1440=cols(tDsk,1440), c1920=cols(tBig,1920);
  ok([base,tMob,tDsk,tBig].every(t=>Object.values(t).every(Number.isFinite)),"G19 CSS 기하(오버레이 여백·박스 max-width/padding·카드 최소폭·gap) 3단계 모두 파싱 — "+JSON.stringify({base,tMob,tDsk,tBig}));
  ok(tDsk.max>=1000&&tBig.max>tDsk.max&&tDsk.max<=1280,"G20 PC 팝업 최대폭 확대: ≥600px "+tDsk.max+"px · 큰 PC "+tBig.max+"px (기존 640/760 대비)");
  ok(c1280.cols===4&&c1440.cols===4&&c1920.cols===4&&c1024.cols>=3&&c768.cols>=3,"G21 열 수(정적): 1280→"+c1280.cols+" · 1440→"+c1440.cols+" · 1920→"+c1920.cols+" · 1024→"+c1024.cols+" · 768→"+c768.cols+" (3~4열, 4카드 단계도 한 줄)");
  ok(c1280.inner/4-tDsk.gap>=200&&c1920.inner/4-tBig.gap>=230,"G22 4열일 때 카드 폭 ≥200px(1280) / ≥230px(1920) — "+Math.floor(c1280.inner/4-tDsk.gap)+" / "+Math.floor(c1920.inner/4-tBig.gap));
  ok(c640.cols===2&&c360.cols===1,"G23 reflow: 200% 줌 상당(CSS 640px)→"+c640.cols+"열 · 모바일 360px→"+c360.cols+"열");
  ok(/#tutBox\{[^}]*max-height:92vh;[^}]*overflow-y:auto/.test(css)&&/#tutBox>\*\{flex-shrink:0;\}/.test(css),"G24 높이 부족 시 박스 내부 세로 스크롤 (카드 찌그러짐 없음)");
  ok(/@media \(max-width:480px\)/.test(css)&&/#tutBox\{[^}]*max-width:420px/.test(css)&&tMob.min>=200,"G25 모바일(≤480px)은 1열 카드 (카드 최소폭 "+tMob.min+"px)");
  T.tutSkip();
}

/* ===== B. 이전/다음/건너뛰기/다시 보기 · 버튼 구성 · tutorialSeen 단일 키 ===== */
{
  const ls=memLS(); setLS(ls);
  const T=H.load(htmlPath);
  ok(T.TUT.open===true,"B1 tutorialSeen 없음 → 자동 표시");
  const txt=()=>T.TUT.btns.map(b=>b.textContent+(b.disabled?"(x)":"")).join("|");
  ok(/이전\(x\)/.test(txt())&&/다음/.test(txt())&&/건너뛰기/.test(txt()),"B2 1단계 버튼: 이전(비활성)·다음·건너뛰기 ("+txt()+")");
  T.tutPrev(); ok(T.TUT.step===0,"B3 1단계에서 이전은 무동작");
  for(let i=0;i<LAST;i++) T.tutNext();
  ok(T.TUT.step===LAST&&/게임 시작/.test(txt())&&/처음부터/.test(txt())&&!/건너뛰기/.test(txt()),"B4 10단계 버튼: 이전·게임 시작·처음부터 ("+txt()+")");
  T.tutNext(); ok(T.TUT.open===false,"B4b 마지막 단계에서 다음(→)은 완료로 닫힘");
  T.tutOpen(); T.tutGo(LAST);
  T.TUT.btns.find(b=>/처음부터/.test(b.textContent)).onclick(); ok(T.TUT.open&&T.TUT.step===0,"B5 '처음부터' → 1단계로 (열린 상태 유지)");
  T.tutGo(LAST); T.TUT.btns.find(b=>/게임 시작/.test(b.textContent)).onclick();
  ok(T.TUT.open===false&&T.els.tutOverlay.classList.contains("hidden")&&T.els.tutOverlay.getAttribute("aria-hidden")==="true","B7 '게임 시작' → 닫힘");
  ok(ls.st.tutorialSeen==="1"&&Object.keys(ls.st).length===1&&ls.log.every(k=>k==="tutorialSeen"),"B8 저장 키는 tutorialSeen 하나뿐");
  ok(!T.els.app.hasAttribute("inert")&&T.els.app.getAttribute("aria-hidden")===null,"B9 닫힌 후 게임 화면 inert/aria-hidden 해제");
  T.tutOpen(); ok(T.TUT.open&&T.TUT.step===0&&T.TUT.auto===false,"B10 다시 보기(tutOpen) → 1단계부터 재표시");
  T.tutSkip(); ok(!T.TUT.open&&ls.st.tutorialSeen==="1","B11 건너뛰기 → 닫힘·seen 유지");
  T.tutOpen(); T.tutNext(); T.tutOpen(); ok(T.TUT.open&&T.TUT.step===0,"B12 열린 상태에서 다시 보기 → 1단계로 리셋"); T.tutSkip();
  const T2=H.load(htmlPath);
  ok(T2.TUT.open===false&&T2.TUT.btns.length===0,"B13 tutorialSeen=1 재방문 → 자동 표시 없음");
  ok(/id="tutOverlay" class="hidden" aria-hidden="true"/.test(T2.html)&&/id="tutHint" class="hidden"/.test(T2.html),"B14 초기 마크업은 오버레이·도움말 모두 hidden");
  T2.tutOpen(); ok(T2.TUT.open&&T2.TUT.step===0,"B15 재방문에서도 다시 보기 가능"); T2.tutSkip();
  ok(/튜토리얼 다시 보기/.test(T2.els.sidePanel.innerHTML)&&/id="tutBtn"/.test(T2.html)&&/onclick="tutOpen\(\)"/.test(T2.html),"B16 메뉴 '튜토리얼 다시 보기' 버튼 + 헤더 ? 버튼");
  ok(ls.log.every(k=>k==="tutorialSeen")&&ls.log.length>=2,"B17 여러 번 열고 닫아도 저장은 tutorialSeen만 반복 ("+ls.log.length+"회)");
}

/* ===== C. localStorage 접근·쓰기 예외 허용 ===== */
{
  setLS(H.throwingStorage("SecurityError: denied")); // 접근 자체가 던지는 환경 (시크릿 모드·정책 차단)
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
  T.TUT.btns[2].focus(); a=ev("Tab"); T.tutKeydown(a.e);
  ok(D.activeElement===T.TUT.btns[1]&&a.pd,"D4 Tab 순환: 마지막 버튼 → 첫 활성 버튼 (비활성 '이전' 건너뜀)");
  a=ev("Tab"); a.e.shiftKey=true; T.tutKeydown(a.e);
  ok(D.activeElement===T.TUT.btns[2],"D5 Shift+Tab 순환: 첫 활성 버튼 → 마지막 버튼");
  T.els.tutOverlay.dispatch("keydown",ev("ArrowRight").e); ok(T.TUT.step===1,"D6 오버레이 keydown 리스너 등록 (dispatch로 다음 단계)");
  T.tutGo(LAST); a=ev("ArrowRight"); T.tutKeydown(a.e); ok(T.TUT.open&&T.TUT.step===LAST,"D6b 마지막 단계에서 → 키는 닫지 않음 (게임 시작은 버튼으로만)");
  T.tutGo(1);
  a=ev("Escape"); T.tutKeydown(a.e); ok(!T.TUT.open&&ls.st.tutorialSeen==="1","D7 Esc: 건너뛰기(닫힘·seen)");
  ok(T.tutKeydown(ev("ArrowRight").e)===false&&T.TUT.step===1,"D8 닫힌 뒤 키 입력은 무시");
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
  H.place(T,m,3,4);
  const before=sSnap(T);
  T.render();
  ok(T.TUT.hints.teleport===true&&!T.els.tutHint.classList.contains("hidden")&&/텔레포트\(순간이동\)/.test(T.els.tutHint.innerHTML),"E2 사람 턴에 텔레포트가 처음 가능해지면 도움말 1회 (전문어 즉시 풀이)");
  ok(sSnap(T)===before,"E3 도움말 표시가 게임 상태 S를 변경하지 않음");
  const okBtn=T.els.tutHint.children.find(b=>/알겠어요/.test(b.textContent));
  ok(!!okBtn&&okBtn.getAttribute("aria-label")==="도움말 닫기","E4 도움말 닫기 버튼(알겠어요)");
  okBtn.onclick(); ok(T.els.tutHint.classList.contains("hidden"),"E5 닫기 후 숨김");
  T.render(); ok(T.els.tutHint.classList.contains("hidden")&&T.tutHint("teleport")===false,"E6 두 번째부터는 표시 안 함 (1회)");
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="minion"),12,3); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="minion"),2,3);
  H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1); H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.S.turnCount=T.BAL.burnStart-2; T.S.mainUsed=true;
  const b2=sSnap(T); T.endTurn();
  ok(T.S.metrics.btReached===true&&T.TUT.hints.burning===true&&/버닝 타임\(불타는 시간\)/.test(T.els.tutHint.innerHTML),"E7 버닝 타임 첫 진입 시 도움말 1회 (전문어 즉시 풀이)");
  ok(JSON.parse(sSnap(T)).m.total.btEnterTurn===T.BAL.burnStart&&b2!==sSnap(T),"E8 엔진의 BT 진입 처리(btReached·btEnterTurn)는 기존과 동일");
  T.tutHintClose(); T.S.mainUsed=true; T.endTurn();
  ok(T.els.tutHint.classList.contains("hidden")&&T.tutHint("burning")===false,"E9 이후 턴에는 재표시 없음");
  T.TUT.hints.teleport=false; T.TUT.hints.burning=false; T.tutHintClose();
  const r=H.runSim(T,["grade5","grade5"],321);
  ok(r.phase==="over"&&T.TUT.hints.teleport===false&&T.TUT.hints.burning===false&&T.els.tutHint.classList.contains("hidden"),"E10 sim 모드에서는 도움말 미발생 · sim 완주 정상");
  ok(T.TUT.hints.teleport===false&&H.storageTrace(T.storage).all.every(k=>k==="tutorialSeen")&&T.cookieWrites.length===0,"E11 도움말은 저장하지 않음 (이 로드의 저장 흔적은 tutorialSeen뿐·쿠키 0)");
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
  H.freshPlay(T,"pvp"); const snap=sSnap(T); T.tutOpen(); T.render(); ok(sSnap(T)===snap&&T.TUT.open,"F5 튜토리얼 열린 채 render()해도 상태·튜토리얼 유지"); T.tutSkip();
  const src=T.html.slice(T.html.indexOf("첫 플레이어용 ELI5 튜토리얼"), T.html.indexOf("/* ===== 온라인 PVP")).replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/[^\r\n]*/g,""); // 주석 제외
  ok(src.length>1000&&!/window\.open|https?:\/\/|fetch\(|XMLHttpRequest|<iframe|WebSocket|navigator\.sendBeacon|<img|canvas|new Image/.test(src),"F6 튜토리얼 코드에 외부 창·서버·사이트·이미지·canvas 연동 없음");
  /* #54 REVISE: 저장 범위 판정을 "키 추출 정규식"에서 (1) 구간 직접 금지 (2) 런타임 저장 불변식으로 바꾼다.
     키 추출 파서는 localStorage["setItem"](…)·별칭·직접 대입 같은 대체 표기를 놓친다. 아래 두 가지는 표기법과 무관하다. */
  // src는 구간 머리 주석 안에서 잘려 시작하므로 남은 주석 꼬리(첫 "*/")까지 버리고 코드만 본다
  const tutCode=src.indexOf("*/")>=0?src.slice(src.indexOf("*/")+2):src;
  const tutLines=tutCode.split(/\r?\n/).filter(l=>H.persistApiHits(l).length); // 튜토리얼 구간에서 저장 API 이름이 등장하는 줄
  ok(T.TUT_KEY==="tutorialSeen"&&tutLines.length>0
    &&tutLines.every(l=>/localStorage/.test(l)&&/TUT_KEY/.test(l)&&!/sessionStorage|indexedDB|cookie|openDatabase|caches|sendBeacon|XMLHttpRequest|fetch\s*\(/.test(l)),
    "F7 튜토리얼 구간의 저장 API는 tutStore의 localStorage+TUT_KEY 줄뿐 (다른 저장소·전송 API는 구간 내 직접 금지) — "+tutLines.length+"줄");
  /* 런타임 불변식: 튜토리얼을 실제로 끝까지 조작해도 저장 흔적은 tutorialSeen 하나. 대괄호·별칭·직접 대입도 여기서 잡힌다. */
  const fresh=H.mkStorage(); const T7=H.load(htmlPath,{storage:fresh});
  T7.tutOpen(); for(let i=0;i<LAST;i++) T7.tutNext(); T7.tutSkip(); T7.tutOpen(); T7.tutSkip(); T7.tutHint("teleport"); T7.tutHintClose();
  const tr=H.storageTrace(fresh);
  ok(tr.all.length===1&&tr.all[0]===T.TUT_KEY&&tr.extras.length===0
    &&H.storageTrace(T7.sessionStorage).all.length===0&&T7.cookieWrites.length===0&&T7.indexedDB.opens.length===0,
    "F7b 런타임 저장 불변식: 튜토리얼 전 과정 후 저장 흔적은 ["+tr.all.join(",")+"]뿐 · sessionStorage·쿠키·indexedDB 무기록");
  const lines=T.TUT_STEPS.map(s=>s.lines.map(strip));
  ok(lines.every(ls=>ls.length>=3&&ls.length<=4&&ls.every(l=>l.length<=78)),"F8 한 화면 3~4문단·문단 78자 이하 ("+lines.map(ls=>ls.map(l=>l.length).join("/")).join(" | ")+")");
  ok(lines.every(ls=>ls.every(l=>/[요!][.!]?\s*$/.test(l.trim()))),"F9 모든 문단이 '~요'/'!'로 끝나는 쉬운 말투");
  const all=lines.flat().join(" ");
  ok(/강제 전투\(무조건 싸움\)/.test(all)&&/HP\(체력\)/.test(all)&&/탐색\(찾아보기\)/.test(all)&&/하수인\(싸우는 말\)/.test(all)&&/텔레포트\(순간이동\)/.test(all)&&/버닝 타임\(불타는 시간\)/.test(all),"F10 전문어 즉시 풀이: 강제 전투·HP·탐색·하수인·텔레포트·버닝 타임");
  ok(T.TUT_STEPS.every(s=>s.icon&&s.title&&Array.isArray(s.cards)&&s.cards.length&&s.lines.length&&!("pic" in s)&&!("scene" in s)),"F11 모든 단계에 아이콘·제목·카드 목록·본문 (구 pic·scene 필드 없음)");
  ok(/@media \(max-width:480px\)\{[\s\S]*#tutBox\{[^}]*max-height:calc\(100dvh - 16px\)/.test(T.html)&&/#tutBox\{[^}]*max-width:420px/.test(T.html)&&/\.tut-nav button\{[^}]*min-height:42px/.test(T.html),"F12 모바일 레이아웃: ≤480px 미디어쿼리·박스 max-width 420·버튼 높이 42px");
  ok(/#tutOverlay\{[^}]*padding:12px/.test(T.html)&&/#tutBox\{[^}]*overflow-y:auto/.test(T.html)&&/#tutHint\{[^}]*width:min\(94vw,440px\)/.test(T.html)&&/\.tut-scene\{[^}]*min-width:0/.test(T.html)&&/#tutBox\{[^}]*overflow-x:hidden/.test(T.html),"F13 360px 폭 수용: 오버레이 여백·박스 내부 스크롤·도움말 폭 94vw·격자 min-width:0·가로 넘침 숨김");
}

/* ===== H. #42 REVISE 스크롤·포커스 계약 — 새 단계는 항상 제목(맨 위)부터, 포커스는 스크롤을 끌지 않는다 =====
   회귀: 200% 줌 상당(CSS 640×360)·360px 좁은 폭에서 #tutBox 내용이 넘칠 때, 렌더 끝의 하단 기본 버튼 포커스가
   브라우저 자동 스크롤을 유발해 제목·카드 1~2가 가려진 채 단계가 열렸다. (실측은 tut_layout_cdp.js) */
{
  setLS(memLS());
  const T=H.load(htmlPath); const D=global.document;
  const box=T.els.tutBox, nav=T.els.tutNav;
  nav.parentNode=box;                          // 스텁은 getElementById로 요소를 따로 만들므로 실제 DOM 포함관계(nav ⊂ box)를 명시
  box.scrollHeight=1200; box.clientHeight=344; // 640×360 상당: 내용이 박스보다 세로로 김 → 스크롤 컨테이너
  const primary=()=>T.TUT.btns.find(b=>/다음|게임 시작/.test(b.textContent));
  T.tutOpen();
  ok(box.scrollTop===0,"H1 열릴 때 박스 스크롤이 맨 위 (제목부터) — scrollTop="+box.scrollTop);
  ok(primary()&&primary().focusOpts&&primary().focusOpts.preventScroll===true,"H2 렌더 포커스는 preventScroll:true (포커스가 박스를 아래로 끌지 않음)");
  ok(D.activeElement===primary(),"H3 포커스 의미 보존: 기본 버튼('다음')에 포커스");
  // 다음/이전/처음부터 — 어느 경로로 들어와도 새 단계는 맨 위부터
  let worst=0, badSteps=[];
  for(let i=0;i<LAST;i++){ box.scrollTop=box.scrollHeight-box.clientHeight; T.tutNext(); worst=Math.max(worst,box.scrollTop); if(box.scrollTop!==0) badSteps.push(i+2); }
  ok(worst===0,"H4 '다음'으로 "+LAST+"번 이동 — 매 단계 진입 시 scrollTop 0 (직전 단계에서 맨 아래로 스크롤돼 있어도) 위반 단계: "+(badSteps.join(",")||"없음"));
  worst=0; badSteps=[];
  for(let i=LAST;i>0;i--){ box.scrollTop=800; T.tutPrev(); worst=Math.max(worst,box.scrollTop); if(box.scrollTop!==0) badSteps.push(i); }
  ok(worst===0&&T.TUT.step===0,"H5 '이전'으로 되돌아올 때도 매 단계 scrollTop 0 · 최종 1단계 위반 단계: "+(badSteps.join(",")||"없음"));
  worst=0; badSteps=[];
  for(let i=0;i<N;i++){ box.scrollTop=999; T.tutGo(i); if(box.scrollTop!==0) badSteps.push(i+1);
    if(!(primary()&&primary().focusOpts&&primary().focusOpts.preventScroll===true)) badSteps.push("focus"+(i+1)); }
  ok(badSteps.length===0,"H6 10단계 전부 tutGo 진입 시 scrollTop 0 + preventScroll 포커스 — 위반: "+(badSteps.join(",")||"없음"));
  T.tutGo(LAST); box.scrollTop=700; T.TUT.btns.find(b=>/처음부터/.test(b.textContent)).onclick();
  ok(box.scrollTop===0&&T.TUT.step===0,"H7 '처음부터' 버튼도 1단계를 맨 위부터 연다");
  // Tab 순환은 의도적으로 기본 스크롤 유지 — 포커스한 버튼이 보이도록 브라우저가 스크롤해야 한다
  T.tutGo(2); const f0=T.TUT.btns.filter(b=>!b.disabled);
  const e={key:"Tab",shiftKey:false,preventDefault(){},stopPropagation(){}}; T.tutKeydown(e);
  ok(D.activeElement!==f0[0]&&D.activeElement.focusOpts==null,"H8 Tab 순환 포커스는 preventScroll 없이 기본 동작 (포커스 요소 노출) — 키보드 의미 보존");
  // 닫을 때 복원 포커스도 기본 동작
  T.tutSkip();
  ok(T.els.tutBtn.focusOpts==null&&D.activeElement===T.els.tutBtn,"H9 닫힘 복원 포커스(? 버튼)도 preventScroll 없이 기본 동작");
  // 소스 계약 — 렌더 경로에서만 preventScroll + 최상단 복귀
  ok(/tutFocus\(primary,\{preventScroll:true\}\);\s*\n\s*tutScrollTop\(\);/.test(T.html),"H10 tutRender는 preventScroll 포커스 직후 tutScrollTop()으로 최상단 복귀 (미지원 브라우저 대비 순서)");
  ok(/function tutScrollTop\(\)\{[\s\S]*?box\.scrollTop=0/.test(T.html),"H11 tutScrollTop이 #tutBox.scrollTop=0으로 초기화");
  ok(!/tutFocus\(f\[nx\],\s*\{preventScroll/.test(T.html)&&!/tutFocus\(r,\s*\{preventScroll/.test(T.html),"H12 Tab 순환·닫기 복원 경로에는 preventScroll을 쓰지 않음");
}

console.log(`
=== smoke_tutorial: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
