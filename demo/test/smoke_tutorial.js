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
function setLS(obj){ // 테스트용 localStorage 스텁 (null → 미지원)
  if(obj===null){ Object.defineProperty(global,"localStorage",{value:undefined,configurable:true,writable:true}); return; }
  Object.defineProperty(global,"localStorage",{value:obj,configurable:true,writable:true});
}
function memLS(){ const st={}, log=[]; return {st,log,getItem:k=>(k in st?st[k]:null),setItem(k,v){st[k]=String(v); log.push(k);},removeItem(k){delete st[k];}}; }
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

/* ===== G. #32 장면 그림 — 단계별 고유 인라인 SVG·접근성·문단↔장면 대응·외부 리소스 없음 ===== */
{
  setLS(memLS());
  const T=H.load(htmlPath);
  const sc=T.TUT_STEPS.map(s=>s.scene);
  ok(sc.every(s=>typeof s==="string"&&/^<svg viewBox="0 0 320 \d+" role="img" aria-label="[^"]{40,}" focusable="false">[\s\S]*<\/svg>$/.test(s)),"G1 모든 단계가 인라인 SVG 장면 (viewBox·role=img·40자 이상 aria-label)");
  ok(new Set(sc).size===N&&new Set(T.TUT_STEPS.map(s=>s.scene.match(/aria-label="([^"]*)"/)[1])).size===N,"G2 10개 장면·대체 텍스트가 서로 다름 (고유)");
  const kinds=s=>["rect","circle","text","line","polygon"].filter(k=>new RegExp("<"+k+"[ >]").test(s)).length;
  const shapes=s=>(s.match(/<(rect|circle|line|polygon)[ >]/g)||[]).length, texts=s=>(s.match(/<text[ >]/g)||[]).length;
  ok(sc.every(s=>s.length>2500&&kinds(s)>=4&&shapes(s)>=12&&texts(s)>=6),"G3 장면이 단순 이모지 나열이 아닌 구성 요소(도형 12+·글 6+·요소 종류 4+) — "+sc.map(s=>shapes(s)+"/"+texts(s)).join(" "));
  ok(sc.every(s=>/<polygon/.test(s))&&sc.filter(s=>/stroke-width="2.5"|✗/.test(s)).length>=7,"G4 행동·결과 표현: 모든 장면에 화살표, 7단계 이상에 ✗(제거·불가) 표시");
  ok(T.TUT_STEPS.every(st=>st.lines.every((_,k)=>new RegExp('class="tut-sn" data-n="'+(k+1)+'"').test(st.scene))&&!new RegExp('data-n="'+(st.lines.length+1)+'"').test(st.scene)),"G5 문단 번호 ①..n 이 장면 안의 번호 배지와 1:1 대응");
  const bad=/<img|<image|<iframe|<video|<audio|<object|<embed|<foreignObject|<use|xlink:href|href=|url\(|https?:|data:|canvas|<script|<style/i;
  ok(sc.every(s=>!bad.test(s)),"G6 장면에 외부 이미지·URL·iframe·foreignObject·use·canvas·스크립트 없음");
  ok(sc.every(s=>!/aria-hidden="true"/.test(s.slice(0,120))),"G7 그림 전체를 aria-hidden으로 숨기지 않음 (role=img + aria-label로 노출)");
  const alts=T.TUT_STEPS.map(s=>s.scene.match(/aria-label="([^"]*)"/)[1]);
  ok(alts.every((a,i)=>T.TUT_STEPS[i].lines.every((_,k)=>a.includes((k+1)+"번"))),"G8 대체 텍스트가 문단 번호별 장면을 서술 (1번…n번)");
  ok(/30%|25%/.test(alts[6])&&/70/.test(alts[6])&&/50%/.test(alts[6])&&/65/.test(alts[8])&&/2번/.test(alts[7])&&/6개/.test(alts[0]),"G9 대체 텍스트에도 핵심 수치(포획 30%/70·도망 50%·턴 65·텔레포트 2번·하수인 6개)");
  // 렌더: 현재 단계의 장면이 대화상자에 그대로 삽입되고 tut-scene 컨테이너·번호 배지가 있다
  T.tutGo(4);
  ok(T.els.tutBox.innerHTML.includes(sc[4])&&/class="tut-scene"/.test(T.els.tutBox.innerHTML)&&(T.els.tutBox.innerHTML.match(/class="tut-n"/g)||[]).length===T.TUT_STEPS[4].lines.length,"G10 렌더된 대화상자에 현재 단계 장면 + 문단 번호 배지");
  ok(!/tut-pic|tut-icon/.test(T.els.tutBox.innerHTML)&&!/class="tut-pic"/.test(T.html),"G11 이모지 토큰 나열(tut-pic) 제거");
  ok(/\.tut-scene svg\{[^}]*width:100%/.test(T.html)&&/\.tut-scene svg\{[^}]*height:auto/.test(T.html),"G12 SVG는 폭 100%·높이 자동 (viewBox 비율 유지, 360px에서 축소 표시)");
  // #32 REVISE — 글자 크기: 소스 단위 최소 13 + CSS에서 유도한 최악 배율(360px 폭)로 렌더 12 CSS px 이상
  const TSV=new Function(T.html.slice(T.html.indexOf("const TSV={"),T.html.indexOf("const TUT_SCENES="))+";return TSV;")(); // 하네스가 노출하지 않는 장면 도우미를 소스에서 재구성
  const fsAll=sc.flatMap(s=>(s.match(/font-size="([0-9.]+)"/g)||[]).map(m=>parseFloat(m.slice(11))));
  const minFs=Math.min(...fsAll);
  ok(fsAll.length>=150&&minFs>=13&&TSV.MIN_FS>=13,"G13 장면 글자 크기 최소 13 (viewBox 단위) — 실측 최소 "+minFs+" / "+fsAll.length+"개");
  ok(/font-size="13"/.test(TSV.t(0,0,"x",{fs:5}))&&/font-size="13"/.test(TSV.t(0,0,"x"))&&/font-size="13"/.test(TSV.tok(0,0,"x","me",7)),"G13b TSV.t / TSV.tok 이 13 미만 요청을 13으로 올림 (기본값 포함)");
  const cssNum=(re)=>{ const m=T.html.match(re); return m?parseFloat(m[1]):NaN; };
  const geo=(vw)=>{ // 장면 SVG 폭(CSS px) = 뷰포트 폭 → 오버레이 여백 → 박스 max-width·좌우 padding·border → 장면 좌우 padding
    const mob=vw<=480;
    const ovPad=mob?cssNum(/@media \(max-width:480px\)\{[\s\S]*?#tutOverlay\{[^}]*padding:([0-9.]+)px/):cssNum(/#tutOverlay\{[^}]*padding:([0-9.]+)px/);
    const boxPadX=mob?cssNum(/@media \(max-width:480px\)\{[\s\S]*?#tutBox\{[^}]*padding:[0-9.]+px ([0-9.]+)px/):cssNum(/#tutBox\{[^}]*padding:[0-9.]+px ([0-9.]+)px/);
    const boxMax=cssNum(/#tutBox\{[^}]*max-width:([0-9.]+)px/), border=cssNum(/#tutBox\{[^}]*border:([0-9.]+)px/);
    const scPadX=mob?cssNum(/@media \(max-width:480px\)\{[\s\S]*?\.tut-scene\{[^}]*padding:[0-9.]+px ([0-9.]+)px/):cssNum(/\.tut-scene\{[^}]*padding:[0-9.]+px ([0-9.]+)px/);
    const boxW=Math.min(boxMax,vw-2*ovPad), svgW=boxW-2*(boxPadX+border+scPadX);
    return {ovPad,boxPadX,boxMax,border,scPadX,svgW,scale:svgW/320};
  };
  const g360=geo(360), g1280=geo(1280);
  ok([g360,g1280].every(g=>Object.values(g).every(v=>Number.isFinite(v))),"G14a CSS 기하(오버레이·박스·장면 padding·border·max-width) 파싱 가능 — "+JSON.stringify({g360,g1280}));
  ok(g360.svgW===314&&Math.abs(g360.scale-0.98125)<1e-6,"G14b 360px 폭에서 장면 SVG 폭 314px → 배율 0.981 (viewBox 320) — 실측 "+g360.svgW+" / "+g360.scale.toFixed(4));
  const minPx360=minFs*g360.scale, minPx1280=minFs*g1280.scale;
  ok(minPx360>=12&&minPx1280>=12&&TSV.MIN_FS*g360.scale>=12,"G14c 렌더 글자 최소 12 CSS px (배율 반영·정적): 360px→"+minPx360.toFixed(2)+"px · 1280px→"+minPx1280.toFixed(2)+"px");
  ok(sc.every(s=>{ const m=s.match(/viewBox="0 0 (\d+) (\d+)"/); return m&&+m[1]===320; })&&/\.tut-scene svg\{[^}]*width:100%/.test(T.html)&&!/\.tut-scene svg\{[^}]*max-width/.test(T.html)&&!/\.tut-scene svg\{[^}]*transform/.test(T.html),
    "G14d 모든 장면 viewBox 폭 320·SVG 폭 100% (추가 축소 규칙 없음) — 배율 유도 전제 유지");
  // #32 REVISE — 3단계 방향 라벨: 한 줄 긴 문장 대신 두 줄, x=50 중앙 정렬, 12..88 안에 들어갈 길이(각 줄 6 글자 이하), 세로 18 단위 간격
  const s3=sc[2], lab=[...s3.matchAll(/<text x="([0-9.]+)" y="([0-9.]+)" font-size="([0-9.]+)"[^>]*text-anchor="(\w+)"[^>]*>(위·아래·옆만|대각선 ✗)<\/text>/g)].map(m=>({x:+m[1],y:+m[2],fs:+m[3],an:m[4],s:m[5]}));
  ok(!/위·아래·옆만, 대각선/.test(s3)&&lab.length===2&&lab.every(l=>l.x===50&&l.an==="middle"&&l.fs>=13&&l.s.replace(/[·\s]/g,"").length<=6)&&Math.abs(lab[0].y-lab[1].y)>=18,
    "G15 3단계 방향 라벨: '위·아래·옆만' / '대각선 ✗' 두 줄·x=50 중앙·줄당 6자 이하·세로 18 이상 간격 — "+JSON.stringify(lab));
  const vb3=+s3.match(/viewBox="0 0 320 (\d+)"/)[1];
  ok(lab.length===2&&Math.max(...lab.map(l=>l.y))+9<=vb3-2&&Math.min(...lab.map(l=>l.y))-9>=0,"G15b 3단계 라벨 세로 위치가 viewBox 높이 "+vb3+" 안 (글자 높이 절반 9 + 여유 2)");
  // #37 데스크톱(≥768px) 장면 실제 폭: width:100% 복구 → 박스 가용 폭(max-width − 좌우 padding·border − 장면 padding)을 그대로 사용, ~320px 수축 없음
  const dsk=T.html.match(/@media \(min-width:768px\)\{([\s\S]*?)\n  \}/), big=T.html.match(/@media \(min-width:1400px\) and \(min-height:960px\)\{([\s\S]*?)\n  \}/);
  ok(!!dsk&&/\.tut-scene\{[^}]*width:100%/.test(dsk[1])&&!/\.tut-scene\{[^}]*max-width:min\(480px/.test(dsk[1]),"G16 데스크톱 .tut-scene width:100% 복구 (480px 상한 제거)");
  const dGeo=(blk,boxMaxDefault)=>{ const bm=parseFloat((blk.match(/#tutBox\{[^}]*max-width:([0-9.]+)px/)||[])[1]||boxMaxDefault), bp=parseFloat(blk.match(/#tutBox\{[^}]*padding:[0-9.]+px ([0-9.]+)px/)[1]), sp=parseFloat(blk.match(/\.tut-scene\{[^}]*padding:[0-9.]+px ([0-9.]+)px/)[1]);
    return {boxMax:bm,svgW:bm-2*(bp+1+sp)}; };
  const gD=dsk&&dGeo(dsk[1]), gB=big&&dGeo(big[1]);
  ok(gD&&gD.boxMax===640&&gD.svgW>=560&&gD.svgW/320>=1.75,"G17 일반 PC(768~1399px 또는 높이<960): 장면 SVG 폭 "+(gD&&gD.svgW)+"px (배율 "+(gD&&(gD.svgW/320).toFixed(2))+") — 이전 ~320px 대비 명백히 확대");
  ok(gB&&gB.boxMax===760&&gB.svgW>=660&&gB.svgW>gD.svgW,"G18 대형 PC(≥1400×960): 장면 SVG 폭 "+(gB&&gB.svgW)+"px — 일반 PC보다 큼");
  ok(/\.tut-scene\{[^}]*max-width:min\(100%,calc\(100vh - \d+px\)\)/.test(dsk[1])&&/\.tut-scene\{[^}]*max-width:min\(100%,calc\(100vh - \d+px\)\)/.test(big[1]),"G19 장면 폭 상한은 100% + (100vh − 본문 예산) — 낮은 화면(768px)에서만 축소해 팝업 내부 스크롤 방지");
  const maxH=Math.max(...sc.map(s=>+s.match(/viewBox="0 0 320 (\d+)"/)[1]));
  ok(maxH<=174&&(gD.svgW*maxH/320+2*10)<=0.92*768-300,"G20 가장 높은 장면(viewBox "+maxH+")도 768px 높이 데스크톱에서 장면 "+Math.round(gD.svgW*maxH/320+20)+"px ≤ 92vh−본문 예산 300px (정적)");
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
  H.freshPlay(T,"pvp"); const snap=sSnap(T); T.tutOpen(); T.render(); ok(sSnap(T)===snap&&T.TUT.open,"F5 튜토리얼 열린 채 render()해도 상태·튜토리얼 유지"); T.tutSkip();
  const src=T.html.slice(T.html.indexOf("첫 플레이어용 ELI5 튜토리얼"), T.html.indexOf("/* ===== 시작: 모드 선택 화면")).replace(/\/\*[\s\S]*?\*\//g,"").replace(/\/\/[^\r\n]*/g,""); // 주석 제외
  ok(src.length>1000&&!/window\.open|https?:\/\/|fetch\(|XMLHttpRequest|<iframe|WebSocket|navigator\.sendBeacon|<img|canvas|new Image/.test(src),"F6 튜토리얼 코드에 외부 창·서버·사이트·이미지·canvas 연동 없음");
  ok(!/localStorage\.(getItem|setItem)\(\s*["'](?!tutorialSeen)/.test(T.html)&&(T.html.match(/localStorage/g)||[]).length<=4,"F7 localStorage 사용은 tutStore(tutorialSeen)로 한정");
  const lines=T.TUT_STEPS.map(s=>s.lines.map(strip));
  ok(lines.every(ls=>ls.length>=3&&ls.length<=4&&ls.every(l=>l.length<=78)),"F8 한 화면 3~4문단·문단 78자 이하 ("+lines.map(ls=>ls.map(l=>l.length).join("/")).join(" | ")+")");
  ok(lines.every(ls=>ls.every(l=>/[요!][.!]?\s*$/.test(l.trim()))),"F9 모든 문단이 '~요'/'!'로 끝나는 쉬운 말투");
  const all=lines.flat().join(" ");
  ok(/강제 전투\(무조건 싸움\)/.test(all)&&/HP\(체력\)/.test(all)&&/탐색\(찾아보기\)/.test(all)&&/하수인\(싸우는 말\)/.test(all)&&/텔레포트\(순간이동\)/.test(all)&&/버닝 타임\(불타는 시간\)/.test(all),"F10 전문어 즉시 풀이: 강제 전투·HP·탐색·하수인·텔레포트·버닝 타임");
  ok(T.TUT_STEPS.every(s=>s.icon&&s.title&&s.scene&&s.lines.length&&!("pic" in s)),"F11 모든 단계에 아이콘·제목·장면 그림·본문 (구 pic 필드 없음)");
  ok(/@media \(max-width:480px\)\{[\s\S]*#tutBox\{[^}]*max-height:calc\(100dvh - 16px\)/.test(T.html)&&/#tutBox\{[^}]*max-width:420px/.test(T.html)&&/\.tut-nav button\{[^}]*min-height:42px/.test(T.html),"F12 모바일 레이아웃: ≤480px 미디어쿼리·박스 max-width 420·버튼 높이 42px");
  ok(/#tutOverlay\{[^}]*padding:12px/.test(T.html)&&/#tutBox\{[^}]*overflow-y:auto/.test(T.html)&&/#tutHint\{[^}]*width:min\(94vw,440px\)/.test(T.html)&&/\.tut-scene\{[^}]*overflow:hidden/.test(T.html),"F13 360px 폭 수용: 오버레이 여백·박스 내부 스크롤·도움말 폭 94vw·장면 컨테이너 넘침 방지");
}

console.log(`
=== smoke_tutorial: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
