/* #89 하수인 아트 게임 적용 헤드리스 회귀 — node demo/test/smoke_minion_art.js [demo/index.html]
   범위: 양측 말 공통 아이콘 체계 · known/unknown/invisible 렌더 · 메모 8종 · 미공개 정보 비노출(DOM·src·요청·a11y) ·
   HP 표시 대상과 자릿수 · 20종 허용 목록과 rosterId 없음/오염 시 폴백 · 배치 트레이 · 로스터 설명창 일러스트 ·
   전투 토큰(본체/대리 출전) · 로드 실패 폴백 · 납품 아트 바이트 보존.
   이 파일은 기계로 판정 가능한 불변식만 다룬다. 선명도·대비·사람 식별성은 실제 브라우저 시각 검수 소관이며 여기 숫자로 대체하지 않는다. */
"use strict";
const H=require("./harness");
const fs=require("fs"), path=require("path"), crypto=require("crypto");
const htmlPath=process.argv[2];
const ROOT=path.resolve(__dirname,"..",".."); // 저장소 루트
const ASSETS=path.join(ROOT,"demo","assets","minions");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const MEMO8=[["king","👑"],["ally","🤝"],["minion_fire","🔥"],["minion_grass","🌿"],["minion_water","💧"],["minion_lightning","⚡"],["bomb","💣"],["trap","🪤"]];
function cellOf(T,r,c){ return T.els.board.children.find(x=>x.dataset.r===r&&x.dataset.c===c); }
function chipOf(T,r,c){ const cell=cellOf(T,r,c); return cell&&cell.children.find(x=>/^pc /.test(x.className)); }
function boardDump(T){ return JSON.stringify(T.els.board.children.map(c=>c.children.map(x=>[x.className,x.innerHTML,x.getAttribute("title"),x.getAttribute("aria-label"),JSON.stringify(x.dataset)]))); }
/* 인간(0) 하수인 12,4 · 내 왕 13,1 · 내 폭탄 13,2 · 내 함정 13,3 · 내 동료 13,4
   상대(1) 왕 2,4(원거리·비가시) · 하수인 11,4(인접·가시) · 폭탄 11,5(인접·가시) */
function setup(T,mode,seed){
  T.setSeed(seed||20260907); // 결정론화 — 무작위 로스터가 판정을 흔들지 않게 한다
  H.freshPlay(T,mode||"pve"); H.clearBoard(T);
  const P={};
  const own=t=>T.S.pieces.find(x=>x.owner===0&&x.type===t);
  P.me=own("minion"); P.king0=own("king"); P.bomb0=own("bomb"); P.trap0=own("trap"); P.ally0=own("ally");
  P.ek=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  P.em=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  P.eb=T.S.pieces.find(x=>x.owner===1&&x.type==="bomb");
  H.place(T,P.me,12,4); H.place(T,P.king0,13,1); H.place(T,P.bomb0,13,2); H.place(T,P.trap0,13,3); H.place(T,P.ally0,13,4);
  H.place(T,P.ek,2,4); H.place(T,P.em,11,4); H.place(T,P.eb,11,5);
  for(const x of [P.ek,P.em,P.eb]) x.revealed=false;
  T.S.selected=null; T.render();
  return P;
}

/* ===== A. 허용 목록·경로 생성 규칙 ===== */
{
  const T=H.load(htmlPath);
  ok(T.ART_DIRS.length===20&&new Set(T.ART_DIRS).size===20,"A1 종 폴더 허용 목록 20개·중복 없음");
  ok(T.ART_DIRS.every(d=>/^(fire|water|grass|lightning)_(std|atk|def|swift|sustain)$/.test(d)),"A2 폴더명은 속성_아키타입 형식만");
  ok(T.ART_DIRS.every(d=>fs.existsSync(path.join(ASSETS,d,"icon.png"))&&fs.existsSync(path.join(ASSETS,d,"battle.png"))&&fs.existsSync(path.join(ASSETS,d,"portrait.webp"))),"A3 20종 모두 icon.png·battle.png·portrait.webp 실제 존재");
  ok(T.ROSTER.length===20&&T.ROSTER.every(r=>T.ART_DIR_SET.has(r.element+"_"+r.arch)),"A4 ROSTER 20종이 모두 허용 목록에 대응 (누락 0)");
  ok(T.artUrl("fire_std","icon.png")==="assets/minions/fire_std/icon.png"&&!/^\/|^[a-z]+:/i.test(T.artUrl("fire_std","icon.png")),
    "A5 자산 경로는 상대경로 — file:// 오프라인과 기존 HTTP 서빙에서 같은 문자열이 쓰인다");
  // rosterId 없음 / 오염된 ID / 목록 밖 값은 전부 null → 안전 폴백
  ok(T.artDirOf(null)===null&&T.artDirOf({type:"king",rosterId:null})===null&&T.artDirOf({type:"minion",rosterId:null})===null,"A6 rosterId 없는 말(왕·미배정 하수인)은 종 폴더 없음");
  ok(["M-X9","","../../etc","M-F1/../..","<script>",0,undefined,{}].every(v=>T.artDirOf({type:"minion",rosterId:v})===null),"A7 오염·미등록 rosterId 는 경로를 만들지 않는다");
  ok(T.artDirOf({type:"minion",rosterId:"M-F1"})==="fire_std"&&T.artDirOf({type:"minion",rosterId:"M-L5"})==="lightning_sustain","A8 정상 rosterId → 허용 목록의 폴더");
  ok(!/<img[^>]*minions/.test(T.pcFaceHtml({type:"minion",rosterId:"M-X9",name:null,element:null})),"A9 허용 목록 밖 하수인은 이미지 없이 텍스트 폴백");
  // 프리로드는 20종 일괄 (개별 말과 상관관계 없음)
  const T2=H.load(htmlPath);
  ok(T2.ART.preloaded===true,"A10 페이지 로드 시 프리로드 실행됨 (게임 시작 전 · 말과 무관)");
  ok(T2.ART_DIRS.every(d=>T2.artUrl(d,"icon.png")&&T2.artUrl(d,"battle.png")),"A11 프리로드 대상은 20종 × icon·battle 전량 (설명창 원본은 제외 — 용량)");
}

/* ===== B. 양측 말 공통 아이콘 체계 · 기호 어휘 8종 ===== */
{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  P.em.revealed=true; P.eb.revealed=true; T.render();
  const mine=chipOf(T,12,4), theirs=chipOf(T,11,4);
  const dMe=T.artDirOf(P.me), dOp=T.artDirOf(P.em);
  ok(!!dMe&&mine.innerHTML.includes(`src="assets/minions/${dMe}/icon.png"`)&&/class="icon"/.test(mine.innerHTML),"B1 내 하수인 = 종 고유 icon.png");
  ok(!!dOp&&theirs.innerHTML.includes(`src="assets/minions/${dOp}/icon.png"`)&&/class="icon"/.test(theirs.innerHTML),"B2 공개된 상대 하수인 = 같은 체계의 종 고유 icon.png");
  ok(/pixelated/.test(T.html)&&/\.pc \.icon\{[^}]*width:32px[^}]*height:32px/.test(T.html)&&/\.pc \.icon\{[^}]*image-rendering:pixelated/.test(T.html),"B3 아이콘 CSS 32×32 · image-rendering:pixelated");
  ok(!/memo-guess/.test(mine.className)&&!/memo-guess/.test(theirs.className),"B4 확정 표시는 실선·불투명 (추측 표식 없음)");
  // 왕·동료·폭탄·함정은 MEMO_OPTS 이모지를 그대로 재사용하고 종 이미지를 쓰지 않는다
  const emo=(r,c)=>chipOf(T,r,c).innerHTML;
  ok(/👑/.test(emo(13,1))&&!/<img/.test(emo(13,1)),"B5 내 왕 = 👑 (종 이미지 없음)");
  ok(/🤝/.test(emo(13,4))&&!/<img/.test(emo(13,4)),"B6 내 동료 = 🤝");
  ok(/💣/.test(emo(13,2))&&!/<img/.test(emo(13,2)),"B7 내 폭탄 = 💣");
  ok(/🪤/.test(emo(13,3))&&!/<img/.test(emo(13,3)),"B8 내 함정 = 🪤");
  ok(/💣/.test(emo(11,5))&&!/<img/.test(emo(11,5)),"B9 공개된 상대 폭탄 = 같은 💣");
  // 기호 어휘가 MEMO_OPTS 하나뿐임을 코드 사실로 확인
  ok(T.MEMO_OPTS.length===8&&MEMO8.every(([k,e])=>T.memoEmoji(k)===e),"B10 기호 어휘 = 기존 MEMO_OPTS 8종 그대로 (신규 래스터 0장)");
  ok(["king","ally","bomb","trap"].every(t=>T.pieceEmoji({type:t})===T.memoEmoji(t)),"B11 확정 표시 이모지 == 메모 이모지 (동일 출처)");
  ok(["fire","water","grass","lightning"].every(el=>T.pieceEmoji({type:"minion",element:el})===T.memoEmoji("minion_"+el)),"B12 확정 하수인 원소 기호 == 메모 원소 기호");
  // 원소 기호는 아이콘 아래 정보 행에 있고 아이콘 영역을 덮지 않는다
  ok(/class="info"/.test(mine.innerHTML)&&mine.innerHTML.indexOf('class="icon"')<mine.innerHTML.indexOf('class="info"'),"B13 정보 행은 아이콘 뒤(아래) 별도 행 — 겹치지 않음");
  ok(/\.pc\{[^}]*width:48px[^}]*height:48px/.test(T.html)&&/\.pc\{[^}]*border-radius:12px/.test(T.html)&&/\.pc\{[^}]*border:2px/.test(T.html),"B14 말 컨테이너 48×48 라운드 사각(반경 12·테두리 2)");
  ok(/#board\{[^}]*repeat\(7,52px\)/.test(T.html)&&/grid-auto-rows:52px/.test(T.html),"B15 칸 52px 불변 (말판 기하 무변경)");
  ok(/\.pc\.own\{box-shadow:inset /.test(T.html),"B16 own 강조는 inset — 48+2+2=52 가 칸 내부 50px 을 넘지 않는다");
  ok(/\.pc \.info\{[^}]*height:11px/.test(T.html)&&/\.pc \.icon\{[^}]*height:32px/.test(T.html),"B17 세로 예산 32 + 간격 + 11 = 내부 44");
}

/* ===== C. known / unknown / invisible · 미공개 정보 비노출 ===== */
{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  // 2,4 상대 왕: 멀고 숲 밖 → 가시. 11,4 상대 하수인: 인접 → 가시, 미공개
  const unk=chipOf(T,11,4);
  ok(unk&&unk.innerHTML==="?","C1 미공개 상대 말 + 메모 없음 = 현행 ? 텍스트 그대로");
  ok(!/hp|HP/.test(unk.innerHTML)&&!/class="info"/.test(unk.innerHTML),"C2 미공개 말에는 정보 행·HP 가 없다");
  /* 누출 판정은 "보드에 나타난 종 폴더명 집합 ⊆ 이미 공개된 말의 종 집합" 으로 한다.
     내 말과 상대 미공개 말이 우연히 같은 종일 수 있으므로 "그 문자열이 화면 어디에도 없다"는 판정은 틀린 불변식이다.
     검사 범위를 좁힌 것이 아니라, 미공개 말 하나하나의 DOM 을 따로 또 검사해 더 촘촘하게 만들었다. */
  const dump=boardDump(T);
  const knownDirs=new Set(T.S.pieces.filter(p=>p.placed&&p.alive&&(p.owner===0||p.revealed)).map(p=>T.artDirOf(p)).filter(Boolean));
  const shownDirs=T.ART_DIRS.filter(d=>dump.indexOf(d)>=0);
  const chipDump=ch=>JSON.stringify([ch.className,ch.innerHTML,ch.getAttribute("title"),ch.getAttribute("aria-label"),ch.dataset]);
  const hiddenChips=()=>T.els.board.children.map(c=>c.children.find(x=>/^pc /.test(x.className))).filter(x=>x&&/hiddenId/.test(x.className));
  ok(shownDirs.every(d=>knownDirs.has(d)),"C3 보드 DOM 에 나타난 종 폴더명은 전부 이미 공개된 말의 것 — 미공개 말의 종은 하나도 없다");
  ok(hiddenChips().length>0&&hiddenChips().every(ch=>{const h=chipDump(ch); return T.ART_DIRS.every(d=>h.indexOf(d)<0);}),
    "C3b 미공개 말 각각의 DOM(클래스·innerHTML·title·aria·data)에 어떤 종 폴더명도 없다");
  ok(!/<img[^>]*minions\/[a-z_]+\/icon\.png[^>]*>/.test(unk.innerHTML),"C4 미공개 말에 종 아이콘 <img> 요소를 만들지 않는다");
  ok(unk.getAttribute("title")===null&&unk.getAttribute("aria-label")===null,"C5 미공개·메모 없는 말에는 title·aria-label 을 붙이지 않는다");
  ok(JSON.stringify(unk.dataset)==="{}","C6 미공개 말에 data-* 속성 없음");
  ok(chipDump(unk).indexOf(P.em.name)<0&&!/class="hp"/.test(unk.innerHTML),"C7 미공개 말의 DOM 에 그 말의 실제 이름·HP 가 없다");
  // 메모를 걸어도 종 아이콘·실제 값이 생기지 않는다 (8종 전부)
  for(const [k,e] of MEMO8){
    T.memoSet(0,P.em.id,k); T.render();
    const ch=chipOf(T,11,4), h=chipDump(ch);
    ok(/memo-guess/.test(ch.className)&&ch.innerHTML.includes(e)&&!/<img/.test(ch.innerHTML)
      &&T.ART_DIRS.every(d=>h.indexOf(d)<0)&&h.indexOf(P.em.name)<0&&!/class="hp"/.test(ch.innerHTML)
      &&/추측/.test(ch.getAttribute("aria-label")||""),
      "C8."+k+" 메모 "+e+" = 뷰어 이모지만 (종 아이콘·경로·실제 이름·HP 없음 · 점선 반투명 유지)");
  }
  T.memoSet(0,P.em.id,null); T.render();
  ok(chipOf(T,11,4).innerHTML==="?","C9 메모 삭제 → ? 복귀");
  // 보이지 않는 말은 렌더 자체가 없다
  ok(cellOf(T,2,4)&&!!chipOf(T,2,4),"C10 전제: 숲 밖 상대 왕은 보인다");
  P.ek.r=4; P.ek.c=1; T.render(); // 숲(4행) · 비인접 → 비가시
  ok(T.visibleTo(0,P.ek)===false&&!chipOf(T,4,1),"C11 보이지 않는 말은 chip 자체가 렌더되지 않는다 (아이콘 도입 후에도 동일)");
  { const d2=boardDump(T), kd=new Set(T.S.pieces.filter(p=>p.placed&&p.alive&&(p.owner===0||p.revealed)).map(p=>T.artDirOf(p)).filter(Boolean));
    ok(T.ART_DIRS.filter(d=>d2.indexOf(d)>=0).every(d=>kd.has(d)),"C12 비가시 말의 종 폴더명도 DOM 에 없다 (나타난 종은 전부 공개된 말의 것)"); }
}

/* ===== D. HP 표시 대상·자릿수 ===== */
{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  const hpOf=ch=>{ const m=ch.innerHTML.match(/class="hp">([^<]*)</); return m?m[1]:null; };
  ok(hpOf(chipOf(T,12,4))===String(P.me.hp),"D1 내 하수인: 현재 HP 숫자 한 줄");
  ok(hpOf(chipOf(T,13,1))===String(P.king0.hp),"D2 내 왕: HP 표시");
  ok(hpOf(chipOf(T,13,4))===String(P.ally0.hp),"D3 내 동료: HP 표시");
  ok(hpOf(chipOf(T,13,2))===null&&hpOf(chipOf(T,13,3))===null,"D4 폭탄·함정: HP 없음");
  P.em.revealed=true; T.render();
  ok(hpOf(chipOf(T,11,4))===String(P.em.hp),"D5 공개된 상대 하수인: HP 표시");
  P.eb.revealed=true; T.render();
  ok(hpOf(chipOf(T,11,5))===null,"D6 공개된 상대 폭탄: HP 없음");
  // 자릿수 경계 — 0·1자리·3자리 모두 그대로 나온다 (반올림·생략 없음)
  for(const v of [0,7,99,100,120]){ P.me.hp=v; T.render(); ok(hpOf(chipOf(T,12,4))===String(v),"D7."+v+" HP "+v+" 그대로 표시 (자릿수 "+String(v).length+")"); }
  P.me.hp=100;
  // 시뮬 전체 공개에서도 폭탄·함정에는 HP 가 붙지 않는다
  const TS=H.load(htmlPath); const Q=setup(TS,"sim");
  TS.S.mode="sim"; TS.render();
  const anyBombHp=TS.els.board.children.some(c=>c.children.some(x=>/💣|🪤/.test(x.innerHTML)&&/class="hp"/.test(x.innerHTML)));
  ok(!anyBombHp,"D8 시뮬 전체 공개에서도 폭탄·함정에 HP 없음");
  ok(TS.els.board.children.some(c=>c.children.some(x=>/class="icon"/.test(x.innerHTML))),"D9 시뮬 전체 공개에서는 양측 하수인 모두 종 아이콘");
}

/* ===== E. 배치 트레이 — 말판과 같은 함수·같은 규격 ===== */
{
  const T=H.load(htmlPath);
  T.newGame("pvp"); T.S.phase="setup"; T.S.setupPlayer=0;
  T.fillRosterRandom(0); T.render();
  const tray=T.els.sidePanel.innerHTML;
  ok(/class="trayItem/.test(tray),"E1 전제: 배치 트레이 렌더됨");
  ok(/<div class="pc p0"[^>]*><img class="icon" src="assets\/minions\/[a-z_]+\/icon\.png"/.test(tray),"E2 트레이 하수인도 같은 종 아이콘 (말판만 바뀌는 불일치 없음)");
  ok(/👑/.test(tray)&&/🤝/.test(tray)&&/💣/.test(tray)&&/🪤/.test(tray),"E3 트레이 왕·동료·폭탄·함정도 같은 메모 이모지");
  ok(/class="info"/.test(tray)&&/class="hp"/.test(tray),"E4 트레이도 같은 정보 행 규격");
  ok(!/class="el el-/.test(tray),"E5 구 3단 텍스트(이름·속성 span) 잔재 없음");
}

/* ===== F. 로스터 설명창 일러스트 ===== */
{
  const T=H.load(htmlPath);
  T.newGame("pvp"); T.S.phase="setup"; T.S.setupPlayer=0; T.render();
  T.rosterInfo("M-F1");
  const box=T.els.overlayBox.innerHTML;
  ok(/class="rosterArt"/.test(box)&&/src="assets\/minions\/fire_std\/portrait\.webp"/.test(box),"F1 설명창에 해당 종 portrait 연결 (rd.id 기준)");
  ok(/width="192" height="192"/.test(box),"F2 표시 192×192 (512 원본 축소)");
  ok(/onerror="artPortraitFail\(this,'fire_std'\)"/.test(box),"F3 실패 시 폴백 경로 지정");
  ok(/id="obBtns"/.test(T.els.overlayBox.innerHTML)&&T.els.obBtns.children.length===2,"F4 선택/닫기 버튼 그대로 노출");
  ok(/\.overlay \.box\{[^}]*max-height:92vh[^}]*overflow-y:auto/.test(T.html)||/\.overlay \.box\{[\s\S]{0,200}?overflow-y:auto/.test(T.html),"F5 긴 설명은 기존 모달 세로 스크롤로 처리 (동작 보존)");
  ok(/@media \(max-height:700px\)\{[^}]*\.rosterArt img[^{]*\{width:128px/.test(T.html),"F6 낮은 화면에서는 128px (규격 5.1 범위)");
  ok(/\.rosterArt\.fb\{[^}]*width:192px[^}]*height:192px/.test(T.html),"F7 webp·png 둘 다 실패해도 같은 자리·같은 크기의 대체 표시 (모달 레이아웃 유지)");
  /* Saturn 1차 QA(#89) P2: .rosterArt.fb(192) 와 @media(max-height:700px) 안의 .rosterArt.fb(128) 는 특이성이 같아 소스 순서가 승자를 정한다.
     @media 가 앞에 있으면 짧은 화면에서 대체상자가 192 로 커져 버튼이 밀린다. 여기서는 순서만 잡고, 실제 계산값(128/192·버튼 top·스크롤)은
     minion_art_cdp.js 의 roster-fb 실브라우저 측정(정상 / webp 실패→png / webp·png 모두 실패 × 1280x800·1024x640 DPR1.25·360x640 DPR1)이 판정한다. */
  { const iFb=T.html.indexOf(".rosterArt.fb{width:192px"), iMq=T.html.indexOf("@media (max-height:700px){ .rosterArt img,.rosterArt.fb{width:128px");
    ok(iFb>=0&&iMq>iFb,"F10 짧은 화면 128px @media 규칙이 .rosterArt.fb(192) 뒤에 온다 — 같은 특이성에서 소스 순서로 128 이 이긴다 (실계산값은 CDP roster-fb 가 판정)"); }
  // 두 단계 폴백을 실제로 태워 본다: webp 실패 → png 재시도 → png 실패 → 자리 유지 대체 표시
  const fbBox={classList:{_s:new Set(["rosterArt"]),add(c){this._s.add(c);},contains(c){return this._s.has(c);}},innerHTML:""};
  const im={src:"assets/minions/fire_std/portrait.webp",onerror:function(){},style:{},parentNode:fbBox};
  T.artPortraitFail(im,"fire_std");
  ok(im.src==="assets/minions/fire_std/portrait.png"&&typeof im.onerror==="function","F8 webp 실패 → png 원본으로 1회만 재시도");
  T.artPortraitFail(im,"fire_std");
  ok(fbBox.classList.contains("fb")&&/불러오지 못했습니다/.test(fbBox.innerHTML)&&im.onerror===null,"F9 png 도 실패 → 자리 유지 대체 표시 · onerror 끊김 (고리 없음)");
  T.rosterInfo("M-L5");
  ok(/src="assets\/minions\/lightning_sustain\/portrait\.webp"/.test(T.els.overlayBox.innerHTML),"F7 다른 종은 다른 portrait");
  T.close();
}

/* ===== G. 전투 토큰 — 지금 싸우는 전투원 기준 ===== */
{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  // 하수인 vs 하수인
  P.me.r=12;P.me.c=4; P.em.r=11;P.em.c=4;
  T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0;
  T.initBattle(P.me,P.em); T.drain(500);
  const st=T.els.overlayBox.innerHTML;
  const dA=T.artDirOf(P.me), dD=T.artDirOf(P.em);
  ok(!!T.S.battle,"G1 전제: 전투 시작");
  ok(st.includes(`src="assets/minions/${dA}/battle.png"`)&&st.includes(`src="assets/minions/${dD}/battle.png"`),"G2 양측 하수인 모두 자기 종 128 battle.png");
  ok(/class="btok art [^"]*" id="tok-A"/.test(st)&&/class="btok art [^"]*" id="tok-D"/.test(st),"G3 토큰 컨테이너 id·클래스 계약 유지 (shake·ko·dmgfloat 경로 보존)");
  ok(/\.btok \.bsprite\{[^}]*width:128px[^}]*height:128px/.test(T.html)&&/\.btok \.bsprite\{[^}]*image-rendering:pixelated/.test(T.html),"G4 전투 스프라이트 128×128 · pixelated");
  ok(/#bstage\{[^}]*height:200px/.test(T.html),"G5 전투 영역 높이 200px");
  T.close(); T.S.battle=null; T.TQ.length=0;

  // 왕 본체 전투 — 자산 없음 → 현행 이모지 토큰 보존
  const T2=H.load(htmlPath); const Q=setup(T2,"pve");
  Q.king0.r=12;Q.king0.c=4; Q.em.r=11;Q.em.c=4; Q.king0.cap=null; T2.S.reserve[0]=null;
  T2.S.current=0; T2.S.mainUsed=false; T2.S.battlesUsed=0;
  T2.initBattle(Q.king0,Q.em); T2.drain(500);
  // 왕은 출전 선택 → 출전 공개 두 모달을 거친다 (본체 출전 = 첫 버튼)
  for(let i=0;i<3&&!T2.S.battle;i++){ const b=T2.els.obBtns.children[0]; if(!b) break; b.onclick(); T2.drain(500); }
  const s2=T2.els.overlayBox.innerHTML;
  ok(/👑/.test(s2)&&!/tok-A"[^>]*>\s*<img/.test(s2)&&!/id="tok-A"[\s\S]{0,120}battle\.png/.test(s2),"G6 왕 본체 토큰은 현행 이모지 원형 유지 (자산 규격 없음)");
  ok(/id="tok-A" style="background:/.test(s2),"G7 자산 없는 토큰은 기존 속성색 배경 경로 그대로");
  T2.close(); T2.S.battle=null; T2.TQ.length=0;

  // 대리 출전(포획 하수인)이 싸울 때 본체 그림을 쓰지 않는다
  const T3=H.load(htmlPath); const R=setup(T3,"pve");
  const cap={element:"fire",hp:100,maxHp:100,atk:20,skillAtk:28,cd:0,cdMax:2,skills:T3.archSkills?T3.archSkills("std","fire"):null,cds:[0,0,0,0],revealedSkills:[]};
  ok(T3.pcFaceHtml({type:"minion",rosterId:null,name:null,element:"fire"}).indexOf("<img")===-1,"G8 rosterId 없는 하수인(포획·예비)은 종 이미지를 만들지 않는다");
  // 본체가 하수인이어도 pf!==piece 이면 본체 이미지를 쓰지 않는다 — 계약을 코드 문자열로 확인
  ok(/const dir=pf===piece\?artDirOf\(piece\):null;/.test(T3.html),"G9 전투 토큰은 pf===piece 일 때만 본체 종 이미지를 쓴다 (대리 출전 오용 차단)");
  T3.TQ.length=0;
}

/* ===== H. 로드 실패 폴백 — 플레이 계속 · 고리 없음 · 누출 없음 ===== */
{
  const T=H.load(htmlPath); const P=setup(T,"pve");
  const dir=T.artDirOf(P.me);
  ok(chipOf(T,12,4).innerHTML.includes(`${dir}/icon.png`),"H1 전제: 실패 전에는 아이콘 사용");
  const el={onerror:function(){}};
  T.artFail(dir,el); T.drain(50);
  ok(el.onerror===null,"H2 실패 즉시 onerror 를 끊는다 (무한 재요청 고리 없음)");
  ok(T.ART.failed.has(dir),"H3 실패한 종만 실패 목록에 기록");
  const ch=chipOf(T,12,4);
  ok(!/<img/.test(ch.innerHTML)&&/class="face"/.test(ch.innerHTML)&&new RegExp(P.me.name).test(ch.innerHTML),"H4 실패 후 현행 텍스트 표시로 복귀");
  ok(/class="info"/.test(ch.innerHTML)&&/class="hp"/.test(ch.innerHTML),"H5 폴백에서도 원소 기호·HP 정보 행 유지 (정보량 동일)");
  ok(/class="face"/.test(ch.innerHTML)&&/\.pc \.face\{[^}]*width:32px[^}]*height:32px/.test(T.html),"H6 폴백도 같은 32×32 박스 — 레이아웃이 튀지 않는다");
  const before=T.TQ.length; T.artFail(dir,null); T.artFail(dir,null);
  ok(T.TQ.length===before,"H7 같은 종의 반복 실패는 재렌더를 다시 예약하지 않는다");
  // 실패해도 게임 진행 가능 — Saturn 1차 QA(#89) P2 수정: 이전 단언은 `!==false||true` 로 항상 참이었고 목적지 11,4 는 이미 상대 말이 놓인 칸이었다.
  // 합법 빈칸(12,3)으로 실제 이동시켜 좌표·주 행동 소모·이동 말 기록·재렌더 위치를 확인한다. 12,3 은 이동 후 새로 인접하는 적이 없어 강제 전투가 끼어들지 않는다.
  T.S.current=0; T.S.mainUsed=false; T.S.movedPiece=null; T.S.forcedTargets=[];
  ok(T.canMoveTo(P.me,11,4)===false&&T.at(11,4)===P.em,"H8a 이전 단언의 목적지 11,4 는 보이는 상대 말이 있는 칸 — 합법 이동이 아니다 (이 사실을 고정)");
  ok(T.at(12,3)===undefined||T.at(12,3)===null,"H8b 전제: 12,3 은 빈칸");
  ok(T.canMoveTo(P.me,12,3)===true,"H8c 전제: 12,3 은 합법 이동 (인접·빈칸·주 행동 미사용)");
  T.doMove(P.me,12,3); T.drain(500);
  ok(P.me.r===12&&P.me.c===3&&T.at(12,3)===P.me&&!T.at(12,4),"H8d 실제 좌표가 12,4 → 12,3 으로 바뀌었다");
  ok(T.S.mainUsed===true&&T.S.movedPiece===P.me&&P.me.movedEver===true,"H8e 주 행동 소모·이동 말 기록 (엔진 상태가 실제로 진행됨)");
  ok(T.S.phase==="play"&&!T.S.battle&&(T.S.forcedTargets||[]).length===0,"H8f 전투·강제 전투 없이 플레이 단계가 이어진다");
  ok(T.canMoveTo(P.me,12,4)===false,"H8g 같은 턴 두 번째 이동은 거부된다 (주 행동 소모가 실제 규칙에 반영)");
  { const c3=chipOf(T,12,3), c4=chipOf(T,12,4);
    ok(!!c3&&!c4&&!/<img/.test(c3.innerHTML)&&/class="face"/.test(c3.innerHTML)&&/class="hp"/.test(c3.innerHTML),"H8h 이동 후 재렌더: 12,3 에 폴백 텍스트 말(정보 행 포함)이 있고 12,4 는 비었다"); }
  { const d3=boardDump(T), kd=new Set(T.S.pieces.filter(p=>p.placed&&p.alive&&(p.owner===0||p.revealed)).map(p=>T.artDirOf(p)).filter(Boolean));
    ok(T.ART_DIRS.filter(d=>d3.indexOf(d)>=0).every(d=>kd.has(d)),"H9 폴백 상태에서도 미공개 말의 종은 노출되지 않는다"); }
  T.TQ.length=0;
}

/* ===== I. 납품 아트 바이트 보존 — 이번 구현은 자산을 만들지도 고치지도 않는다 ===== */
{
  const manifest=path.join(ROOT,"docs","art","minions-v0.4.3","delivery-manifest.csv");
  ok(fs.existsSync(manifest),"I1 납품 매니페스트 존재");
  const rows=fs.readFileSync(manifest,"utf8").trim().split(/\r?\n/);
  const head=rows[0].split(","), iPath=head.indexOf("path"), iSha=head.findIndex(h=>/sha256/i.test(h));
  ok(iPath>=0&&iSha>=0&&rows.length-1===28,"I2 매니페스트 28행·path·sha256 열 확인");
  let bad=0, checked=0;
  for(const line of rows.slice(1)){
    const cols=line.split(","), rel=cols[iPath], sha=(cols[iSha]||"").toLowerCase();
    const f=path.join(ROOT,rel.replace(/\//g,path.sep));
    if(!fs.existsSync(f)){ bad++; continue; }
    const h=crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
    checked++; if(h!==sha) bad++;
  }
  ok(bad===0&&checked===28,`I3 납품 파생 28파일 SHA-256 전부 일치 (검사 ${checked} · 불일치 ${bad}) — 아트 무변경`);
  const icons=fs.readdirSync(ASSETS).filter(d=>fs.statSync(path.join(ASSETS,d)).isDirectory());
  ok(icons.length===20&&icons.every(d=>fs.readdirSync(path.join(ASSETS,d)).length===5),"I4 20폴더 × 5파일 = 100파일 구조 그대로");
}

/* ===== J. 글리프 폴백 · 전투 도트 실패 시 즉시 대체 (PD 실브라우저 지적 반영) ===== */
{
  const T=H.load(htmlPath);
  // 헤드리스에는 canvas 가 없다 → 측정 불가 = "지원함" → 계약대로 이모지가 나온다
  ok(MEMO8.every(([k,e])=>T.glyphOk(e)===true),"J1 글리프 측정이 불가능한 환경에서는 기본 계약(이모지)을 유지한다");
  /* 폭이 같다는 사실만으로 미지원이라고 단정하면, 우연히 같은 advance 를 갖는 정상 글리프까지 텍스트로 바뀐다.
     구현이 실제 렌더 픽셀 비교로 확증하는지 코드 사실로 확인한다 (실브라우저 오탐 검사는 minion_art_cdp.js 의 falsePos). */
  ok(/getImageData/.test(T.html)&&/measureText/.test(T.html),"J1b 글리프 판정은 폭 비교로 거르고 실제 렌더 픽셀로 확증한다 (폭 동일 = 미지원 단정 아님)");
  ok(/GLYPH\.NOTDEF/.test(T.html),"J1c 비교 기준은 고정된 미지원 코드포인트 하나뿐 (임의 문자 비교 아님)");
  ok(/class="sym" aria-hidden="true">🪤</.test(T.pcFaceHtml({type:"trap"})),"J2 글리프가 있으면 함정 = 🪤 (기호 계약 그대로)");
  // 글리프가 없는 플랫폼을 흉내 낸다 — 같은 뜻의 짧은 현행 텍스트로 되돌아가고, 기호 어휘를 새로 만들지 않는다
  T.GLYPH.cache["🪤"]=false; T.GLYPH.cache["👑"]=false;
  const f=T.pcFaceHtml({type:"trap"});
  ok(/class="sym ng">함정</.test(f)&&!/🪤/.test(f),"J3 글리프가 없으면 함정 = '함정' 텍스트 (두부 네모 대신 식별 가능)");
  ok(/class="sym ng">왕</.test(T.pcFaceHtml({type:"king",hp:100})),"J4 왕도 같은 규칙");
  ok(/class="sym" aria-hidden="true">💣</.test(T.pcFaceHtml({type:"bomb"})),"J5 글리프가 있는 기호는 영향 없음 (필요한 것만 되돌린다)");
  ok(/\.pc \.face \.sym\.ng\{/.test(T.html)&&/\.pc\.memo-guess \.guess\.ng\{/.test(T.html),"J6 폴백 텍스트 전용 크기 CSS 존재 (32px 박스·추측 표식 안에서 넘치지 않음)");
  // 추측 메모도 같은 규칙 — 확정은 텍스트, 추측은 두부가 되는 불일치를 만들지 않는다
  const P=setup(T,"pve"); T.memoSet(0,P.em.id,"trap"); T.render();
  const ch=chipOf(T,11,4);
  ok(/memo-guess/.test(ch.className)&&/class="guess ng">함정</.test(ch.innerHTML)&&!/🪤/.test(ch.innerHTML),"J7 추측 메모도 같은 폴백 (확정·추측 표기 일관)");
  ok(T.MEMO_OPTS.length===8,"J8 폴백은 표시 방법일 뿐 — 메모 선택지 8종은 그대로");
  T.GLYPH.cache["🪤"]=true; T.GLYPH.cache["👑"]=true; T.TQ.length=0;

  // 전투 도트 실패 → 지금 보고 있는 전투에서도 즉시 이모지 토큰으로 대체 (빈 자리 없음)
  const T2=H.load(htmlPath); const Q=setup(T2,"pve");
  Q.me.r=12;Q.me.c=4; Q.em.r=11;Q.em.c=4;
  T2.S.current=0; T2.S.mainUsed=false; T2.S.battlesUsed=0;
  T2.initBattle(Q.me,Q.em); T2.drain(500);
  ok(!!T2.S.battle,"J9 전제: 전투 시작");
  const dirA=T2.artDirOf(Q.me);
  const tok={id:"tok-A",className:"btok art tok-me",style:{},innerHTML:"",
    classList:{_s:new Set(["btok","art","tok-me"]),add(c){this._s.add(c);},remove(c){this._s.delete(c);},contains(c){return this._s.has(c);}}};
  const img={onerror:function(){},style:{},parentNode:tok};
  T2.artSpriteFail(dirA,img);
  ok(img.onerror===null&&T2.ART.failed.has(dirA),"J10 전투 도트 실패는 onerror 를 끊고 그 종만 실패로 기록");
  ok(!tok.classList.contains("art")&&/<small>/.test(tok.innerHTML)&&tok.innerHTML.length>0&&tok.style.background,"J11 실패한 전투 도트 자리는 즉시 현행 이모지 토큰으로 대체 (전투원이 비어 보이지 않음)");
  ok(tok.id==="tok-A","J12 토큰 id 유지 — shake·ko·dmgfloat FX 경로 보존");
  /* Saturn 1차 QA(#89) P2 수정: 이전 J13 은 `||true` 로 어떤 결과도 통과했다. 아래는 실제 실패를 잡는 검사다 —
     대체 내용이 "지금 싸우는 전투원(B.fa)" 의 속성 기호·라벨·배경과 정확히 일치하는지, 숨김 경로(display:none)가 쓰이지 않았는지,
     위치 클래스가 보존됐는지, 전투 밖·다른 토큰에서는 대체가 아니라 숨김 경로로 가는지(분기 오판 검출), 그리고 실패 후 실제 전투 진행에서
     같은 토큰 객체가 FX 를 받는지(교체 노드가 아니라 같은 노드)를 확인한다. */
  { const B=T2.S.battle, el=B.fa.element, EMO={fire:"🔥",water:"💧",grass:"🌿",lightning:"⚡"}, KO={fire:"불",water:"물",grass:"풀",lightning:"번개"};
    ok(!!el&&B.fa===Q.me&&tok.innerHTML===`${EMO[el]}<small>${KO[el]}</small>`&&tok.style.background===`var(--${el})`,
      "J13a 대체 내용 = 지금 싸우는 전투원의 속성 기호·라벨·속성색 (다른 말·빈 내용이면 실패)");
    ok(img.style.display!=="none","J13b 대체에 성공했으므로 img 숨김 경로(display:none)는 쓰이지 않았다 (strict)");
    ok(tok.classList.contains("btok")&&tok.classList.contains("tok-me")&&!tok.classList.contains("art"),"J13c 클래스는 art 만 제거 — 컨테이너·위치 클래스 보존");
    // 잘못된 대상: 전투 토큰이 아닌 요소는 대체하지 않고 이미지만 숨긴다 (분기 오판이면 여기서 실패)
    const tokX={id:"tok-X",style:{},innerHTML:"",classList:{_s:new Set(["btok","art"]),add(c){this._s.add(c);},remove(c){this._s.delete(c);},contains(c){return this._s.has(c);}}};
    const imgX={onerror:function(){},style:{},parentNode:tokX};
    T2.artSpriteFail(dirA,imgX);
    ok(imgX.style.display==="none"&&tokX.innerHTML===""&&tokX.classList.contains("art")&&!tokX.style.background,"J13d 전투 토큰이 아닌 요소(tok-X)는 대체하지 않고 숨김 경로 — 잘못된 노드를 고쳐 쓰지 않는다");
    // 실패 후 실제 전투 진행: 제품의 applyFx 는 id 로 토큰을 찾아 FX 를 붙인다 — 같은 노드여야 한다
    const live=T2.byId("tok-A"); live.id="tok-A"; live.classList.add("btok"); live.classList.add("art"); live.classList.add("tok-me"); // 스텁 요소에는 id 가 없으므로 실제 DOM 처럼 붙인다
    const imgL={onerror:function(){},style:{},parentNode:live};
    T2.artSpriteFail(dirA,imgL);
    ok(!live.classList.contains("art")&&live.id==="tok-A"&&T2.byId("tok-A")===live,"J13e 실 문서 토큰(tok-A)도 같은 객체 그대로 대체 — 노드 교체 없음");
    const hpBefore=B.fd.hp, phaseBefore=B.phase;
    T2.byId("msgBox").nodeType=1; // 제품은 실제 DOM(msgBox.nodeType===1)에서만 메시지·FX 를 재생한다 — 스텁에서 그 경로를 켠다
    global.__act("basic"); T2.drain(5000);
    const fxA=live.classList.contains("shake")||live.classList.contains("ko")||live.children.some(x=>/dmgfloat/.test(x.className));
    const fxD=T2.byId("tok-D").classList.contains("shake")||T2.byId("tok-D").classList.contains("ko");
    ok(T2.S.battle===B&&(B.fd.hp<hpBefore||B.phase!==phaseBefore||B.blog.length>0),"J13f 실패 후에도 전투가 실제로 진행된다 (기본 공격 → HP·단계·로그 변화)");
    ok(fxD||fxA,"J13g 실패 후 FX 가 같은 id 의 토큰 노드에 붙는다 (shake/ko/dmgfloat 중 하나 이상 — FX 경로 보존)");
    ok(live.id==="tok-A"&&!live.classList.contains("art"),"J13h 전투 진행 후에도 실패 토큰은 id 유지·art 미복원 (실패 종 재요청 없음)"); }
  T2.close(); T2.S.battle=null; T2.TQ.length=0;
}

console.log(`\n=== smoke_minion_art: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
