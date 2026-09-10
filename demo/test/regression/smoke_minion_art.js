/* #89 하수인 아트 게임 적용 헤드리스 회귀 — node demo/test/regression/smoke_minion_art.js [demo/index.html]
   범위: 양측 말 공통 아이콘 체계 · known/unknown/invisible 렌더 · 메모 8종 · 미공개 정보 비노출(DOM·src·요청·a11y) ·
   HP 표시 대상과 자릿수 · 20종 허용 목록과 rosterId 없음/오염 시 폴백 · 배치 트레이 · 로스터 설명창 일러스트 ·
   전투 토큰(본체/대리 출전) · 로드 실패 폴백 · 납품 아트 바이트 보존 · #91 포획/예비 하수인 대리 출전 정체·아트·정보 경계(K 절).
   이 파일은 기계로 판정 가능한 불변식만 다룬다. 선명도·대비·사람 식별성은 실제 브라우저 시각 검수 소관이며 여기 숫자로 대체하지 않는다. */
"use strict";
const H=require("../shared/harness");
const fs=require("fs"), path=require("path"), crypto=require("crypto");
const htmlPath=process.argv[2];
const ROOT=path.resolve(__dirname,"..","..",".."); // 저장소 루트
const ASSETS=path.join(ROOT,"demo","assets","minions");
let pass=0,fail=0; const fails=[];
/* #91 대리 출전 종 폴더 헬퍼 — 기준선(변경 전) html 로 A/B 대조 실행할 때도 크래시 대신 실패로 집계되게 감싼다 */
const adf=(T,pf,piece)=>typeof T.artDirOfFighter==="function"?T.artDirOfFighter(pf,piece):"missing";
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
  /* #122 (v0.4.7): 128px 전투 도트 두 개와 양측 HP 패널이 200px 안에서 서로를 덮어, PD 실제 화면 검토 뒤 무대 높이를 288px 로 올렸다.
     검사 대상은 "무대 높이가 한 곳에서 정해진다"는 계약이고 값은 그 승인된 현행값을 따른다. */
  ok(/#bstage\{[^}]*height:288px/.test(T.html),"G5 전투 영역 높이 288px (#122 — 종전 200px)");
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
  /* #91: 이전 G9 는 코드 문자열(pf===piece?artDirOf(piece):null)을 정규식으로 고정했다. 이제는 행동으로 확인한다 —
     대리 출전 전투원(pf!==piece)에게 본체 말의 종 폴더를 절대 돌려주지 않고, 왕·동료 본체는 계속 null 이다. 대리 출전의 양성 경로는 K 절. */
  const kingLike={type:"king",rosterId:"M-F1",artRosterId:"M-F1",element:null,cap:cap}; // 오염: 왕에 rosterId 가 붙어도 본체 그림은 없다
  ok(adf(T3,kingLike,kingLike)===null&&adf(T3,R.king0,R.king0)===null&&adf(T3,R.ally0,R.ally0)===null,"G9a 왕·동료 본체(pf===piece)는 rosterId·artRosterId 가 붙어 있어도 종 폴더 없음 (artDirOf 의 type 검사 그대로)");
  ok(adf(T3,R.me,R.me)===T3.artDirOf(R.me)&&!!T3.artDirOf(R.me),"G9b 하수인 본체(pf===piece)는 #89 그대로 자기 종 폴더");
  const minionCap=Object.assign({},cap,{artRosterId:R.me.rosterId,element:R.me.element}); R.me.cap=minionCap;
  ok(adf(T3,minionCap,R.me)===T3.artDirOf({type:"minion",rosterId:R.me.rosterId})&&adf(T3,minionCap,R.me)!==null,"G9c 대리 출전(pf!==piece)은 본체 말이 아니라 cap 에 기록된 종만 본다 (같은 종이면 같은 폴더)");
  const other=Object.assign({},cap,{artRosterId:"M-L5",element:"lightning"}); R.me.cap=other;
  ok(adf(T3,other,R.me)==="lightning_sustain"&&adf(T3,other,R.me)!==T3.artDirOf(R.me),"G9d 대리 출전 전투원의 종 폴더는 본체 하수인의 종과 무관 — 본체 그림 오용 차단을 행동으로 확인");
  ok(adf(T3,other,R.king0)===null&&adf(T3,cap,R.me)===null,"G9e pf 가 그 말의 cap 객체가 아니면(다른 말의 cap · 떠도는 객체) 종 폴더 없음");
  R.me.cap=null; T3.TQ.length=0;
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
  const manifest=path.join(ROOT,"docs","milestone","v0.4.3","assets","minions","delivery-manifest.csv");
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
  /* Saturn 2차 QA(#89) 후속: 핫시트(pvp) 로 고정한다. pve 에서는 D(AI) 가 타이머로 뒤이어 행동해 J13f/g 의 변화량이 "내가 넣은 행동 1회" 로
     한정되지 않았다. J9~J13e 는 모드와 무관하다 (A 토큰은 두 모드 모두 tok-me · 대체 분기는 S.battle 과 id 만 본다). */
  const T2=H.load(htmlPath); const Q=setup(T2,"pvp");
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
    /* Saturn 2차 QA(#89) 지적 수정 — 이전 J13f 는 `B.blog.length>0` 을 봤는데 startRounds 가 "전투 개시" 로그를 이미 넣어 두므로 __act 가
       아무 일도 하지 않아도 통과했고, 이전 J13g 는 `fxD||fxA` 라서 대체된 tok-A 의 FX 가 사라져도 tok-D 의 FX 로 통과했다.
       지금은 (1) 행동 전 HP·라운드·단계·로그 길이를 잡아 실제 변화량을 증명하고 (2) 대체된 tok-A 가 피격 대상이 되도록 D(P2) 의
       행동 차례에서 기본 공격을 넣으며 (3) 행동 전 FX 잔재를 지우고 그 뒤 같은 노드에 새로 붙는 FX 만 센다.
       같은 검사기(j13Arm/j13Check)를 무효 행동(J13j)·엉뚱한 노드(J13k) 에 돌려 각각 실패함을 이 파일 안에서 증명한다. */
    const s=j13Arm(T2,B,live);
    ok(s.clean,"J13i 전제: 행동 전 대체 토큰에 FX 잔재 없음 (shake·ko·dmgfloat 0 — 이후 FX 는 이번 행동이 붙인 것만 센다)");
    global.__act("basic"); T2.drain(5000);
    const v=j13Check(T2,B,live,s);
    ok(v.progress,"J13f 실패 후에도 전투가 실제로 진행된다 — A HP 감소량 == 로그의 피해 합(>0) · D HP 불변(피격 대상은 A) · 라운드 +1 · 로그 증가 · 전투 유지 ["+v.detail+"]");
    ok(v.fx,"J13g 실패 후 FX 가 대체된 바로 그 노드(tok-A)에 새로 붙는다 — shake · dmgfloat(-피해량) 1개 · HP 표시 동기화 · tok-D 는 흔들리지 않음 ["+v.detail+"]");
    ok(live.id==="tok-A"&&!live.classList.contains("art"),"J13h 전투 진행 후에도 실패 토큰은 id 유지·art 미복원 (실패 종 재요청 없음)"); }
  T2.close(); T2.S.battle=null; T2.TQ.length=0;

  // 음성 대조 1 — 무효 행동: __act 를 메모리에서 no-op 로 바꾸면 J13f·J13g 검사기가 둘 다 실패해야 한다 (이전 J13f 는 여기서 통과했다)
  { const N=j13Fresh(); const s=j13Arm(N.T,N.B,N.live);
    const real=global.__act; global.__act=()=>{}; global.__act("basic"); N.T.drain(5000); global.__act=real;
    const v=j13Check(N.T,N.B,N.live,s);
    ok(s.clean&&!v.progress&&!v.fx&&N.B.fa.hp===s.hpA&&N.B.blog.length===s.blog,"J13j 음성 대조: no-op __act 는 J13f(진행)·J13g(FX) 검사기를 둘 다 통과하지 못한다 ["+v.detail+"]");
    N.T.close(); N.T.S.battle=null; N.T.TQ.length=0; }
  // 음성 대조 2 — 엉뚱한 노드: 제품이 id 로 찾는 tok-A 가 대체된 노드가 아니면(FX 가 다른 노드로 감) 진행은 되어도 J13g 검사기는 실패해야 한다
  { const N=j13Fresh(); const s=j13Arm(N.T,N.B,N.live);
    const orig=N.T.document.getElementById, decoy=N.T.document.createElement("div");
    N.T.document.getElementById=id=>id==="tok-A"?decoy:orig(id);
    global.__act("basic"); N.T.drain(5000);
    N.T.document.getElementById=orig;
    const v=j13Check(N.T,N.B,N.live,s);
    ok(s.clean&&v.progress&&!v.fx&&decoy.classList.contains("shake")&&!N.live.classList.contains("shake")&&s.floats.length===0,
      "J13k 음성 대조: FX 가 대체된 노드가 아닌 다른 노드(decoy)로 가면 진행(J13f)은 참이어도 J13g 검사기는 실패한다 ["+v.detail+"]");
    N.T.close(); N.T.S.battle=null; N.T.TQ.length=0; }
}
/* ===== K. #91 공용/적 포획 하수인 대리 출전 아트 — 정체 보존 · 표시 전용 · 안전 폴백 · 정보 경계 ===== */
const stdOf=(T,el)=>T.ROSTER.find(r=>r.element===el&&r.arch==="std");
/* #121 계약 6 (v0.4.7 승인): 숲 포획은 더 이상 공용 템플릿(100/20/30·CD2·std 기술)이 아니다 —
   **뽑힌 ROSTER 종의 HP·최대 HP·ATK·기술 수치·CD·4기술·아트 정체를 그대로** 쓴다. 그래서 기준이 BAL.captured 가 아니라 종 데이터(rd)다.
   전투 중 적 포획(finishByCapture → 예비)의 HP 70/최대 100 규격은 계약 6 "범위 밖"이라 그대로이며 아래 capStatsLegacy 로 계속 검사한다. */
const capSpecies=(T,c,rd)=>c&&rd&&c.element===rd.element&&c.hp===rd.hp&&c.maxHp===rd.hp&&c.atk===rd.atk&&c.skillAtk===rd.skill&&c.cd===0&&c.cdMax===rd.cd
  &&c.artRosterId===rd.id&&c.rosterId===rd.id
  &&JSON.stringify(c.skills)===JSON.stringify(T.archSkills(rd.arch,rd.element))
  &&JSON.stringify(c.cds)==="[0,0,0,0]"&&JSON.stringify(c.revealedSkills)==="[]";
const capStatsLegacy=(T,c,hp)=>c&&c.hp===hp&&c.maxHp===T.BAL.captured.hp&&c.atk===T.BAL.captured.atk&&c.skillAtk===T.BAL.captured.skill&&c.cd===0&&c.cdMax===T.BAL.captured.cd
  &&JSON.stringify(c.cds)==="[0,0,0,0]"&&JSON.stringify(c.revealedSkills)==="[]";
/* 하수인 말에 로스터 종 r 을 주입 (applyRoster 와 같은 필드) */
function giveSpecies(T,m,r){ m.rosterId=r.id; m.name=r.name; m.element=r.element; m.hp=r.hp; m.maxHp=r.hp; m.atk=r.atk; m.skillAtk=r.skill; m.cdMax=r.cd; m.skills=T.archSkills(r.arch,r.element); m.cds=[0,0,0,0]; m.revealedSkills=[]; }
const tokOf=(T,sid)=>{ const m=T.byId("overlayBox").innerHTML.match(new RegExp('<div class="btok[^"]*" id="tok-'+sid+'"[^>]*>[\\s\\S]*?<\\/div>')); return m?m[0]:""; };
const srcOf=t=>(tokImg(t)||{}).src;
const tokImg=t=>{ const m=t.match(/<img class="bsprite" src="([^"]+)" alt="([^"]*)"/); return m?{src:m[1],alt:m[2]}:null; };
/* 지정 속성의 숲 포획 하수인을 만든다 (제품 tryCapture 경로 그대로).
   #121 계약 6: 후보 종은 **탐색 시점에 이미 고정**되어 tryCapture 의 인자로 들어오므로, 속성을 시드로 더듬을 필요가 없다.
   아래 절들은 "그 속성의 표준형 종" 아트 정체를 전제하므로 기본 후보를 stdOf 로 준다 (아트 매핑 검사의 입력 고정). */
function neutralCap(T,piece,el,rdOpt){ const rd=rdOpt||stdOf(T,el); T.setSeed(1); piece.cap=null;
  T.tryCapture(piece,"safe",piece,rd); return !!(piece.cap&&piece.cap.element===el&&piece.cap.artRosterId===rd.id); }
/* 왕(포획 하수인 보유)이 인접 상대 말을 공격하고, 출전 선택에서 대리(두 번째 버튼)/본체(첫 버튼)를 고른 뒤 출전 공개를 지나 전투에 들어간다 */
/* 헤드리스 스텁의 obBtns 는 모달이 바뀌어도 이전 버튼이 남는다(overlayBox.innerHTML 대입이 obBtns 자식을 지우지 않음) — 새 모달의 버튼은 항상 끝에 붙으므로 끝에서 센다 */
const modalBtn=(T,total,i)=>{ const ch=T.byId("obBtns").children; const b=ch[ch.length-total+i]; if(!b) return false; b.onclick(); T.drain(500); return true; };
function proxyBattle(T,att,def,pickA,pickD){
  T.byId("obBtns").children.length=0;
  T.initBattle(att,def); T.drain(500);
  if(["king","ally"].includes(att.type)&&!T.S.battle&&/출전 선택/.test(T.byId("overlayBox").innerHTML)) modalBtn(T,2,pickA?1:0);
  if(["king","ally"].includes(def.type)&&!T.S.battle&&/출전 선택/.test(T.byId("overlayBox").innerHTML)) modalBtn(T,2,pickD?1:0);
  if(!T.S.battle&&/출전 공개/.test(T.byId("overlayBox").innerHTML)) modalBtn(T,1,0);
  return T.S.battle;
}
{
  /* K1 숲 포획 (#121 계약 6): ROSTER 20종 균등 추첨 · 뽑힌 종의 수치·4기술·아트 정체를 **그대로** · rand 소비량 고정.
     종전(#20)은 속성만 무작위이고 수치는 공용 100/20/30·std 템플릿이었다 — 그 단언은 승인된 계약 6 으로 갱신한다. */
  const T=H.load(htmlPath); const P=setup(T,"pvp");
  // K1a 20종 전부를 후보로 주면 그 종 그대로 들어온다 (수치·4기술·아트 정체·rosterId)
  let allGood=true; const seenSp={};
  for(const rd of T.ROSTER){
    T.setSeed(11); T.S.balls[0]=5; P.ally0.cap=null;
    const res=T.tryCapture(P.ally0,"safe",P.ally0,rd); const c=P.ally0.cap;
    if(!res.ok||!capSpecies(T,c,rd)||res.el!==rd.element) allGood=false; else seenSp[rd.id]=c.hp+"/"+c.atk;
  }
  ok(allGood&&Object.keys(seenSp).length===20,"K1a 숲 포획 cap 은 ROSTER 20종 각각의 HP·최대HP·ATK·기술 수치·CD·4기술·정체(rosterId·artRosterId)를 그대로 갖는다 — 계약 6 \"그 종 그대로\"는 기술 ID 뿐 아니라 archOf 파생 동작까지 보존한다 (cds 0 · 공개 기록 [])");
  const hps=new Set(T.ROSTER.map(r=>r.hp)), atks=new Set(T.ROSTER.map(r=>r.atk));
  ok(hps.size>1&&atks.size>1&&Math.min(...hps)===85&&Math.max(...hps)===120&&Math.min(...atks)===18&&Math.max(...atks)===25,
     "K1a' 종별 편차가 실제로 생긴다 — HP 85~120 · ATK 18~25 (공용 템플릿 100/20 단일값이 아니다)");
  // K1b 기술 배열은 복사본이다 (원본 템플릿·다른 cap 과 참조를 공유하지 않는다 — 계약 6)
  T.setSeed(11); T.S.balls[0]=5; P.ally0.cap=null; T.tryCapture(P.ally0,"safe",P.ally0,stdOf(T,"fire"));
  T.S.balls[0]=5; P.king0.cap=null; T.tryCapture(P.king0,"safe",P.king0,stdOf(T,"fire"));
  const c1=P.ally0.cap, c2=P.king0.cap; c1.skills[0]="water_stable";
  ok(c1.skills!==c2.skills&&c2.skills[0]!=="water_stable","K1b 기술 배열은 복사본 — 한 cap 의 슬롯 변경이 다른 cap·템플릿에 번지지 않는다");
  // K1c 종 추첨은 탐색 시점 rand 1회, 포획 판정은 rand 1회 — 방법을 바꿔도 같은 종 (계약 6 후보 고정)
  let rngGood=true, fixedSpecies=true;
  for(let seed=1;seed<=40;seed++){
    T.setSeed(seed); const ref=[]; for(let i=0;i<3;i++) ref.push(T.rand()); // 기대 소비량: 성공 판정 1회뿐 → 두 번째 값이 "다음 rand"
    T.setSeed(seed); T.S.balls[0]=9; P.ally0.cap=null;
    T.tryCapture(P.ally0,"safe",P.ally0,stdOf(T,"grass"));
    if(T.rand()!==ref[1]) rngGood=false;                  // 속성 shuffle 3회가 사라져 소비가 1회로 줄었다
    const first=P.ally0.cap.rosterId;
    P.ally0.cap=null; T.S.balls[0]=9; T.tryCapture(P.ally0,"risky",P.ally0,stdOf(T,"grass"));
    if(P.ally0.cap&&P.ally0.cap.rosterId!==first) fixedSpecies=false;
  }
  ok(rngGood,"K1c 포획 판정은 rand 1회만 쓴다 (종전 속성 shuffle 3회 소비가 사라졌다 — 종 추첨은 탐색 시점에 이미 끝났다)");
  ok(fixedSpecies,"K1c' 포획 방법을 바꿔도 같은 종 — 후보는 탐색 중 한 번 결정되고 재추첨하지 않는다 (계약 6)");
  // K1d 탐색 시점의 종 추첨이 ROSTER 20종 균등이고 rand 를 딱 1회 쓴다
  {
    const U=H.load(htmlPath); const Q=H.freshPlay(U,"pvp");
    const king=U.S.pieces.find(x=>x.owner===0&&x.type==="king"); H.clearBoard(U);
    H.place(U,king,9,3); H.place(U,U.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
    const hit={}; let drawGood=true;
    for(let seed=1;seed<=400;seed++){
      U.S.events=[{r:9,c:3,kind:"recruit",consumed:false}]; U.S.traces[0].add("9_3");
      U.S.mainUsed=false; U.S.current=0; U.S.recruit=null;
      U.setSeed(seed); const ref=[]; for(let i=0;i<3;i++) ref.push(U.rand());
      U.setSeed(seed); U.doSearch(king,U.S.events[0]);
      const R=U.S.recruit; if(!R||!R.species){ drawGood=false; break; }
      hit[R.species]=(hit[R.species]||0)+1;
      if(U.rand()!==ref[1]) drawGood=false;               // 종 추첨은 rand 1회
      U.close();
    }
    ok(drawGood&&Object.keys(hit).length===20,"K1d 탐색 시 후보 종은 ROSTER 20종 전체에서 나오고 추첨에 rand 를 딱 1회 쓴다 (관측 "+Object.keys(hit).length+"종/400시드)");
  }
  T.setSeed(7); T.S.balls[0]=5; P.ally0.cap=null; P.ally0.hp=P.ally0.maxHp;
  let fails=0, okc=0; for(let i=0;i<40;i++){ P.ally0.cap=null; const r=T.tryCapture(P.ally0,"risky"); if(r.ok) okc++; else fails++; }
  ok(okc>0&&fails>0&&T.S.balls[0]===5-40,"K1c 위험 포획의 성공/실패 판정과 볼 소모(1)는 변하지 않았다 [성공 "+okc+" · 실패 "+fails+"]");
  T.TQ.length=0;
}
{
  // K2 적 하수인 포획(전투 중 볼 적중): 원래 종 rosterId·arch 를 보존 — 20종 전부 · HP 70/최대 100 · 공용 스탯 · 기술 템플릿은 원래 아키타입
  const T=H.load(htmlPath);
  let good=0, dirs=new Set(), filesOk=true, detail=[];
  for(const r of T.ROSTER){
    const P=setup(T,"pvp"); giveSpecies(T,P.em,r);
    T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0; T.S.reserve[0]=null;
    T.initBattle(P.me,P.em); T.drain(500);
    if(!T.S.battle){ detail.push(r.id+":no-battle"); continue; }
    T.finishByCapture("A"); const rv=T.S.reserve[0];
    const cond=rv&&rv.artRosterId===r.id&&rv.rosterId===undefined&&rv.arch===undefined&&rv.element===r.element&&capStatsLegacy(T,rv,T.BAL.enemyCapHp)
      &&JSON.stringify(rv.skills)===JSON.stringify(T.archSkills(r.arch,r.element))&&P.em.alive===false&&T.S.battle===null;
    if(cond){ good++; P.ally0.cap=rv; const d=adf(T,rv,P.ally0); dirs.add(d); if(d!==r.element+"_"+r.arch||!fs.existsSync(path.join(ASSETS,d,"battle.png"))) filesOk=false; }
    else detail.push(r.id);
    T.TQ.length=0;
  }
  ok(good===20,"K2a 적 포획 예비 하수인은 20종 전부 원래 종 외형 정체(artRosterId)·속성을 보존하고(rosterId·arch 필드 없음 = 변경 전과 동일) HP 70/100·공용 스탯·원래 아키타입 기술 템플릿·즉시 제거·전투 종료는 그대로 ["+(detail.join(",")||"20/20")+"]");
  ok(dirs.size===20&&filesOk,"K2b 대리 출전 시 20종 → 20개 서로 다른 허용 폴더로 대응하고 battle.png 가 실제 존재 (신규 아트 0)");
  const P=setup(T,"pvp"); P.em.rosterId=null; P.em.name=null; P.em.element="fire"; P.em.skills=null; P.em.revealedSkills=null;
  T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0; T.S.reserve[0]=null;
  T.initBattle(P.me,P.em); T.drain(500); T.finishByCapture("A"); const rv=T.S.reserve[0]; P.ally0.cap=rv;
  ok(rv&&rv.artRosterId===null&&rv.rosterId===undefined&&rv.element==="fire"&&adf(T,rv,P.ally0)===null&&JSON.stringify(rv.skills)===JSON.stringify(T.archSkills("std","fire")),"K2c 원래 종을 모르는 적 포획(rosterId 없음)은 임의 종으로 가장하지 않는다 — artRosterId null · std 템플릿 · 대리 출전 그림 없음");
  T.TQ.length=0;
}
{
  // K3 대리 출전 전투 토큰 — PVE: 내 왕이 중립 포획 하수인(fire_std)으로 대리 출전 → tok-A 에 fire_std/battle.png · 상대 하수인 본체는 자기 종 그대로
  const T=H.load(htmlPath); const P=setup(T,"pve");
  H.place(T,P.king0,12,4); H.place(T,P.em,11,4); T.S.balls[0]=5; T.S.reserve[0]=null;
  ok(neutralCap(T,P.king0,"fire")&&P.king0.cap.artRosterId==="M-F1","K3a 전제: 왕이 중립 포획 하수인(불 · M-F1 표준형) 보유");
  T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0;
  const B=proxyBattle(T,P.king0,P.em,true,false);
  ok(!!B&&B.fa===P.king0.cap&&B.fa!==B.attP&&B.attP===P.king0&&B.fd===P.em,"K3b 전제: 대리 출전 전투 — fa 는 왕의 cap 객체(pf!==piece), 방어는 하수인 본체");
  const tA=tokOf(T,"A"), tD=tokOf(T,"D"), iA=tokImg(tA), iD=tokImg(tD);
  ok(!!iA&&iA.src==="assets/minions/fire_std/battle.png"&&/class="btok art tok-me" id="tok-A"/.test(tA),"K3c 대리 출전 포획 하수인 토큰 = 그 종(fire_std)의 기존 battle.png · art 클래스·tok-me·id 계약 유지");
  ok(!!iA&&iA.alt==="포획 하수인·불"&&/<small>불<\/small>/.test(tA),"K3d alt·라벨은 기존 fighterName/속성 문구 그대로 (표시 정체 외 새 문구 없음)");
  ok(!!iD&&iD.src==="assets/minions/"+T.artDirOf(P.em)+"/battle.png"&&/id="tok-D"/.test(tD),"K3e 상대 하수인 본체 토큰은 #89 그대로 자기 종");
  ok(/onerror="artSpriteFail\('fire_std',this\)"/.test(tA),"K3f 대리 출전 토큰도 같은 실패 폴백 경로(artSpriteFail) 연결");
  ok(!/👑/.test(tA)&&!tA.includes(T.artDirOf(P.em)),"K3g 대리 출전 토큰에 왕 이모지·상대 종 폴더가 섞이지 않는다");
  const hpD=B.fd.hp, blog=B.blog.length; global.__act("basic"); T.drain(5000);
  ok(T.S.battle===B&&B.fd.hp<hpD&&B.blog.length>blog,"K3h 대리 출전 전투가 실제로 진행된다 (D HP "+hpD+"→"+B.fd.hp+")");
  T.close(); T.S.battle=null; T.TQ.length=0;
}
{
  // K4 양측 대리 출전 — 핫시트: 1P 왕(중립 포획 물 표준형) vs 2P 동료(적 포획 예비 = 1P 의 원래 하수인 종 M-L5 번개 지속형)
  const T=H.load(htmlPath); const P=setup(T,"pvp");
  const eAlly=T.S.pieces.find(x=>x.owner===1&&x.type==="ally");
  giveSpecies(T,P.me,T.ROSTER.find(r=>r.id==="M-L5"));
  T.S.current=1; T.S.mainUsed=false; T.S.battlesUsed=0; T.initBattle(P.em,P.me); T.drain(500); T.finishByCapture("A"); T.TQ.length=0;
  const rv=T.S.reserve[1];
  ok(!!rv&&rv.artRosterId==="M-L5"&&rv.element==="lightning"&&P.me.alive===false,"K4a 전제: 2P 예비 하수인 = 포획한 1P 하수인의 원래 종(M-L5 번개 지속형)");
  P.em.placed=false; H.place(T,P.king0,12,4); H.place(T,eAlly,11,4); T.S.balls[0]=5; T.S.reserve[0]=null;
  ok(neutralCap(T,P.king0,"water")&&P.king0.cap.artRosterId==="M-W1","K4b 전제: 1P 왕이 중립 포획 하수인(물 · M-W1) 보유");
  T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0; T.S.selected=null; T.render();
  // #114 VIP끼리는 대리 전투가 없으므로 각각 하수인을 상대로 실제 대리 출전 경로를 검증한다.
  eAlly.placed=false;H.place(T,P.em,11,4);
  const BA=proxyBattle(T,P.king0,P.em,true,false), iA=tokImg(tokOf(T,"A")), tokA=tokOf(T,"A");
  const attackerCapOk=!!BA&&BA.fa===P.king0.cap;
  T.close();T.S.battle=null;T.TQ.length=0;T.S.battlesUsed=0;P.king0.placed=false;P.em.placed=false;
  P.me.hp=P.me.maxHp;H.place(T,P.me,12,4);H.place(T,eAlly,11,4);
  const B=proxyBattle(T,P.me,eAlly,false,true);
  ok(attackerCapOk&&!!B&&B.fd===eAlly.cap&&eAlly.cap===rv&&T.S.reserve[1]===null,"K4c #114 공격/방어 대리는 각각 하수인 상대 전투에서 검증·예비 cap 이전");
  const iD=tokImg(tokOf(T,"D"));
  ok(!!iA&&iA.src==="assets/minions/water_std/battle.png"&&!!iD&&iD.src==="assets/minions/lightning_sustain/battle.png","K4d 양측 토큰이 각자 실제 대리 전투원의 종 — A water_std · D lightning_sustain (동료 본체 🤝·왕 본체 👑 아님)");
  ok(eAlly.cap.artRosterId==="M-L5"&&eAlly.cap===rv,"K4d2 예비→cap 이전(useRes) 후에도 같은 객체·외형 정체 유지 (AC 5)");
  ok(!!iD&&iD.alt==="포획 하수인·번개"&&/<small>번개<\/small>/.test(tokOf(T,"D")),"K4e D 라벨·alt 는 기존 문구 그대로");
  const st=T.byId("overlayBox").innerHTML;
  ok(!/👑|🤝/.test(tokA+tokOf(T,"D")),"K4f 대리 출전 토큰에는 왕·동료 이모지가 없다 (본체 표현은 본체 출전 때만)");
  ok(B.fd.hp===T.BAL.enemyCapHp&&B.fd.maxHp===T.BAL.captured.hp&&B.fd.atk===T.BAL.captured.atk&&B.fd.skillAtk===T.BAL.captured.skill&&B.fd.cdMax===T.BAL.captured.cd,"K4g 표시 종이 붙어도 전투 수치는 포획 공용 규격(HP 70/100 · 공 20 · 기 30 · CD 2) — 종 스탯(M-L5 95/20/28)으로 바뀌지 않는다");
  ok(/HP <span id="hptxt-D">70<\/span>\/100/.test(st),"K4h 정보 패널 HP 표기도 70/100");
  T.close(); T.S.battle=null; T.TQ.length=0;
  // 본체 출전은 그대로 (본체 vs 본체는 규칙상 밀어내기이므로 각각 하수인을 상대로 연다): 왕 본체(포획 보유) vs 하수인 → 👑 · 하수인 vs 동료 본체(예비 보유) → 🤝
  const T2=H.load(htmlPath); const Q=setup(T2,"pvp"); const eAlly2=T2.S.pieces.find(x=>x.owner===1&&x.type==="ally");
  H.place(T2,Q.king0,12,4); H.place(T2,Q.em,11,4); T2.S.balls[0]=5; ok(neutralCap(T2,Q.king0,"grass"),"K4 전제: 왕 풀 cap");
  T2.S.reserve[1]={element:"grass",hp:70,maxHp:100,atk:20,skillAtk:30,cd:0,cdMax:2,skills:T2.archSkills("std","grass"),cds:[0,0,0,0],revealedSkills:[],artRosterId:"M-G1"};
  T2.S.current=0; T2.S.mainUsed=false; T2.S.battlesUsed=0;
  const B2=proxyBattle(T2,Q.king0,Q.em,false,false);
  const a2=tokOf(T2,"A");
  ok(!!B2&&B2.fa===Q.king0&&B2.attP===Q.king0&&!!Q.king0.cap,"K4i 왕 본체 출전 선택 시 fa 는 본체이고 cap 은 그대로 보유");
  ok(/👑/.test(a2)&&!/<img/.test(a2)&&!/minions\//.test(a2)&&!/grass_std/.test(T2.byId("overlayBox").innerHTML),"K4j 왕 본체 토큰은 현행 이모지 그대로 — 보유 중인 포획 하수인의 종(grass_std)이 전투 화면 어디에도 없다");
  T2.close(); T2.S.battle=null; T2.TQ.length=0;
  H.place(T2,Q.me,12,3); H.place(T2,eAlly2,11,3); T2.S.current=0; T2.S.mainUsed=false; T2.S.battlesUsed=0;
  const B3=proxyBattle(T2,Q.me,eAlly2,false,false);
  const d3=tokOf(T2,"D");
  ok(!!B3&&B3.fd===eAlly2&&B3.fa===Q.me&&T2.S.reserve[1]!==null&&!eAlly2.cap,"K4k 동료 본체 출전 선택 시 fd 는 본체이고 예비는 소모되지 않는다");
  ok(/🤝/.test(d3)&&!/<img/.test(d3)&&!/grass_std/.test(T2.byId("overlayBox").innerHTML),"K4l 동료 본체 토큰은 현행 이모지 그대로 — 예비 하수인의 종(grass_std)이 전투 화면에 없다");
  T2.close(); T2.S.battle=null; T2.TQ.length=0;
}
{
  // K5 잘못된/누락 식별자 안전 폴백 — 화이트리스트 밖·오염·속성 불일치 → 이모지 토큰 · <img>·경로 없음
  const T=H.load(htmlPath); const P=setup(T,"pvp");
  H.place(T,P.king0,12,4); H.place(T,P.em,11,4); T.S.balls[0]=5;
  ok(neutralCap(T,P.king0,"grass"),"K5 전제: 풀 중립 포획");
  T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0;
  const B=proxyBattle(T,P.king0,P.em,true,false);
  ok(!!B&&B.fa===P.king0.cap&&srcOf(tokOf(T,"A"))==="assets/minions/grass_std/battle.png","K5a 전제: 정상 정체(grass_std)에서는 그림");
  const bad=[["M-X9","미등록 id"],["","빈 문자열"],["../../etc","경로 조작"],["M-F1/../..","경로 조작 2"],["<script>","마크업"],[0,"숫자 0"],[null,"null"],[undefined,"undefined"],[{},"객체"],["M-F1","속성 불일치(불 id · 풀 cap)"]];
  for(const [v,label] of bad){
    B.fa.artRosterId=v; T.battleModal(); const t=tokOf(T,"A");
    ok(!/<img/.test(t)&&!/minions\//.test(t)&&t.includes("🌿")&&/<small>풀<\/small>/.test(t)&&/style="background:var\(--grass\)"/.test(t)&&/id="tok-A"/.test(t),"K5b."+label+" → 그림 없이 현행 속성 이모지 토큰(풀·속성색) · 경로 문자열 없음 · id 유지");
  }
  B.fa.artRosterId="M-G1"; T.battleModal();
  ok(srcOf(tokOf(T,"A"))==="assets/minions/grass_std/battle.png","K5c 정상 id 복귀 시 다시 그림 (폴백은 상태를 오염시키지 않음)");
  B.fa.artRosterId="M-X9"; T.battleModal(); const hpD=B.fd.hp; global.__act("basic"); T.drain(5000);
  ok(T.S.battle===B&&B.fd.hp<hpD,"K5d 오염된 id 상태에서도 전투 진행 (D HP "+hpD+"→"+B.fd.hp+")");
  T.close(); T.S.battle=null; T.TQ.length=0;
}
{
  // K6 이미지 로드 실패 → 대리 출전 토큰도 즉시 현행 이모지로 대체되고 전투가 이어진다 (J11~J13 계약을 대리 출전에 적용)
  const T=H.load(htmlPath); const P=setup(T,"pvp");
  H.place(T,P.king0,12,4); H.place(T,P.em,11,4); T.S.balls[0]=5;
  ok(neutralCap(T,P.king0,"lightning"),"K6 전제: 번개 중립 포획");
  T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0;
  const B=proxyBattle(T,P.king0,P.em,true,false);
  ok(!!B&&srcOf(tokOf(T,"A"))==="assets/minions/lightning_std/battle.png","K6a 전제: 대리 출전 lightning_std 그림");
  const live=T.byId("tok-A"); live.id="tok-A"; live.classList.add("btok"); live.classList.add("art"); live.classList.add("tok-me");
  const img={onerror:function(){},style:{},parentNode:live};
  T.artSpriteFail("lightning_std",img);
  ok(img.onerror===null&&T.ART.failed.has("lightning_std")&&!live.classList.contains("art")&&live.innerHTML==="⚡<small>번개</small>"&&live.style.background==="var(--lightning)"&&img.style.display!=="none",
    "K6b 실패 즉시 같은 노드가 '지금 싸우는 대리 전투원'의 속성 이모지·라벨·속성색으로 대체 (왕 이모지 아님 · 숨김 경로 아님)");
  T.battleModal();
  ok(!/<img/.test(tokOf(T,"A"))&&/⚡/.test(tokOf(T,"A"))&&!!tokImg(tokOf(T,"D")),"K6c 재렌더에서도 실패한 종은 이모지, 상대 본체 종은 그림 유지 (그 종만 실패 처리)");
  const hpD=B.fd.hp; global.__act("basic"); T.drain(5000);
  ok(T.S.battle===B&&B.fd.hp<hpD,"K6d 실패 후 전투 진행 (D HP "+hpD+"→"+B.fd.hp+")");
  T.close(); T.S.battle=null; T.TQ.length=0;
}
{
  // K7 전투 불변: 외형 정체(artRosterId)는 표시 전용 — 같은 시드에서 rosterId 를 지운 대리 전투원과 로그·HP 가 완전히 같다.
  //    지속형(M-F5 fire_sustain) 예비를 대리로 세워 archOf 계열(지속형 화상 3R·상태 100%)이 cap 에 새지 않음을 화상 지속 라운드로 확인한다.
  const run=(strip)=>{
    const T=H.load(htmlPath); const P=setup(T,"pvp"); T.BAL.statusProb=1; T.BAL.shockProb=1; T.BAL.dmgVar=0; // #96: shockProb도 고정
    const eAlly=T.S.pieces.find(x=>x.owner===1&&x.type==="ally");
    giveSpecies(T,P.me,T.ROSTER.find(r=>r.id==="M-F5"));
    T.S.current=1; T.S.mainUsed=false; T.S.battlesUsed=0; T.initBattle(P.em,P.me); T.drain(500); T.finishByCapture("A"); T.TQ.length=0;
    P.em.placed=false; H.place(T,P.king0,12,4); H.place(T,eAlly,11,4); T.S.balls[0]=5; T.S.reserve[0]=null;
    neutralCap(T,P.king0,"water");
    if(strip){ for(const c of [P.king0.cap,T.S.reserve[1]]){ delete c.artRosterId; } }
    T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0; T.setSeed(99);
    // #114 VIP 접촉은 밀기로 끝난다. 이 항목은 접촉 규칙이 아닌 두 포획 전투원의 순수 표시/계산 불변성 픽스처다.
    eAlly.cap=T.S.reserve[1];T.S.reserve[1]=null;
    T.startRounds(P.king0,eAlly,P.king0.cap,eAlly.cap);T.drain(500);const B=T.S.battle;
    const dirs=[adf(T,B.fa,B.attP),adf(T,B.fd,B.defP)], hasId=!!(B.fa.artRosterId&&B.fd.artRosterId);
    let i=0; while(T.S.battle===B&&i<12){ global.__act("basic"); T.drain(5000); i++; } // 지속형 슬롯0 = 효과기(화상) → 기본 공격 반복이면 D 의 첫 행동에서 화상 부여
    return {T,B,hasId,blog:B.blog.slice(),hpA:B.fa.hp,hpD:B.fd.hp,burnMax:Math.max(0,...B.blog.map(l=>{const m=/화상을 입었다! \((\d+)R\)/.exec(l); return m?+m[1]:0;})),dirs};
  };
  const a=run(false), b=run(true);
  ok(a.hasId&&!b.hasId&&JSON.stringify(a.dirs)==='["water_std","fire_sustain"]'&&JSON.stringify(b.dirs)==='[null,null]',"K7a 전제: 한쪽은 정체 있음(그림 water_std·fire_sustain), 다른 쪽은 정체 제거(그림 없음)");
  ok(a.blog.length>4&&JSON.stringify(a.blog)===JSON.stringify(b.blog)&&a.hpA===b.hpA&&a.hpD===b.hpD,"K7b 같은 시드·같은 행동에서 전투 로그·HP 가 완전히 동일 — 정체는 전투에 영향 0 ["+a.blog.length+"줄]");
  /* #121 계약 6 (v0.4.7 승인) — **두 포획 경로가 갈라진다.** 이 절의 전투원은 서로 다른 경로로 만들어졌다:
       · B.fa = 내 왕의 **숲 포획** cap → 계약 6 "그 종 그대로"라 rosterId 를 갖고 archOf 가 그 종의 아키타입을 돌려준다.
       · B.fd = 상대의 **전투 중 적 포획** 예비 → 계약 6 "범위 밖"이라 종전대로 rosterId 가 없고 archOf 는 null,
               수치는 공용 규격(HP 70/최대 100)이다.
       화상을 부여하는 쪽은 fd(지속형 종 정체의 예비 하수인)다. 그 경로는 바뀌지 않았으므로 화상은 여전히 공용 규격 2R 이다 —
       4슬롯 경로의 상태 부여는 BAL.burnRounds 를 직접 읽고 skillParamsOf(아키타입 파생)를 거치지 않기 때문이며,
       이는 일반 로스터 하수인도 마찬가지다. 기대값을 낮춘 것이 아니라 **두 경로의 분리**를 그대로 단언한다. */
  const faArch=a.T.archOf(a.B.fa), fdArch=a.T.archOf(a.B.fd);
  ok(faArch==="std"&&a.B.fa.rosterId==="M-W1","K7c 숲 포획 cap 은 그 종 정체(rosterId M-W1 · archOf std)를 갖는다 — 계약 6 '그 종 그대로' (관측 "+faArch+")");
  ok(fdArch===null&&a.B.fd.rosterId===undefined&&a.B.fd.maxHp===a.T.BAL.captured.hp,"K7c' 전투 중 적 포획 예비는 종전 공용 규격 유지 — rosterId 없음·archOf null·최대 HP "+a.B.fd.maxHp+" (계약 6 범위 밖)");
  ok(a.burnMax>0&&a.burnMax===a.T.BAL.burnRounds,"K7c'' 예비 하수인(지속형 종 정체)의 화상은 공용 규격 "+a.T.BAL.burnRounds+"R — 4슬롯 경로의 상태 부여는 BAL 값을 직접 읽고 아키타입 파생(skillParamsOf)을 타지 않는다 [관측 "+a.burnMax+"R]");
  a.T.TQ.length=0; b.T.TQ.length=0;
}
{
  // K8 온라인 양측 정체 일치 — 같은 시드에서 두 독립 인스턴스(1P 화면·2P 화면)가 같은 cap/reserve 정체를 만든다 · 네트워크 송신 0
  //    송신 0 은 "연결된 소켓(NET.ws, readyState 1)의 실제 send 호출 수"로 잰다 — wsLog 는 생성된 소켓 수라 메시지 수가 아니다 (Saturn REVISE).
  //    K8d 가 같은 검사기로 음성 대조: 제품의 실제 netSend 경로(netAction)로 보내면 같은 판정이 반드시 실패한다.
  const mk=(me)=>{ const T=H.load(htmlPath); const P=setup(T,"pvp"); T.NET.mode=true; T.NET.me=me;
    const ws=new T.WebSocketCtor("ws://127.0.0.1:8080/",[T.NET_PROTOCOL_MARKER,"qa-k8-code"]); ws.readyState=1; T.NET.ws=ws; // 연결된 소켓 준비 — 이 소켓의 send 만이 실제 송신이다
    return {T,P,ws}; };
  const A=mk(0), Bb=mk(1);
  /* 검사기: fn 동안 (1) 연결 소켓의 실제 send 증분 (2) 새 소켓 생성 수 (3) 감시 중인 소켓이 여전히 NET.ws 이며 열려 있는지 — (3) 이 깨지면 다른 소켓으로 샌 송신을 놓칠 수 있으므로 함께 판정 */
  const sentBy=({T,ws},fn)=>{ const s0=ws.sent.length, k0=T.wsLog.length; const out=fn(); return {out,sent:ws.sent.length-s0,socks:T.wsLog.length-k0,live:T.NET.ws===ws&&ws.readyState===1}; };
  const silent=r=>r.sent===0&&r.socks===0&&r.live;
  const capOf=(X)=>sentBy(X,()=>{ X.T.setSeed(4242); X.T.S.balls[0]=5; X.P.king0.cap=null; X.T.tryCapture(X.P.king0,"safe"); return X.P.king0.cap; });
  const ca=capOf(A), cb=capOf(Bb);
  ok(ca.out&&cb.out&&ca.out.artRosterId===cb.out.artRosterId&&ca.out.element===cb.out.element&&ca.out.artRosterId===stdOf(A.T,ca.out.element).id,"K8a 중립 포획: 1P·2P 인스턴스가 같은 정체("+ca.out.artRosterId+") — 시드 결정론만으로 일치, 프로토콜 무변경");
  ok(silent(ca)&&silent(cb),"K8b 중립 포획의 정체 기록은 연결된 소켓으로 아무것도 보내지 않는다 (실제 send 1P "+ca.sent+"·2P "+cb.sent+" · 새 소켓 0 · 연결 유지)");
  const resOf=(X)=>{ const {T,P}=X; giveSpecies(T,P.em,T.ROSTER.find(r=>r.id==="M-G2")); T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0; T.S.reserve[0]=null; T.initBattle(P.me,P.em); T.drain(500);
    const r=sentBy(X,()=>{ T.finishByCapture("A"); return T.S.reserve[0]; }); T.TQ.length=0; return r; };
  const ra=resOf(A), rb=resOf(Bb);
  ok(ra.out&&rb.out&&ra.out.artRosterId==="M-G2"&&rb.out.artRosterId==="M-G2"&&ra.out.hp===rb.out.hp,"K8c 적 포획: 양측 인스턴스 모두 원래 종(M-G2) 보존 — 전투 공개 시점(포획 순간)에 이미 양측이 아는 정보");
  ok(silent(ra)&&silent(rb),"K8c' 적 포획(finishByCapture)의 정체 기록도 연결된 소켓으로 아무것도 보내지 않는다 (실제 send 1P "+ra.sent+"·2P "+rb.sent+")");
  // 음성 대조 — 제품의 실제 송신 경로(netAction → netSend → NET.ws.send)로 한 건 보내면 같은 검사기·같은 판정이 반드시 실패해야 한다 (검사기가 살아 있음을 증명)
  A.T.S.current=0; // netActor()===NET.me(0) 이어야 netAction 이 송신한다 — 포획 뒤 턴 상태를 명시
  const neg=sentBy(A,()=>A.T.netAction({t:"qa-unwanted-send"}));
  ok(neg.sent===1&&!silent(neg)&&/qa-unwanted-send/.test(A.ws.sent[A.ws.sent.length-1])&&neg.socks===0&&neg.live,"K8d 음성 대조: 실제 netSend 한 건이면 같은 검사기가 송신 "+neg.sent+"건으로 잡아 K8b/K8c' 판정이 실패한다 (wsLog 는 여전히 0 증가 — 소켓 수로는 잡히지 않는다)");
  A.T.TQ.length=0; Bb.T.TQ.length=0;
}
{
  // K9 정보 경계 — 보드·사이드·출전 선택·출전 공개 모달에는 포획/예비 하수인의 종 폴더가 나타나지 않고, 전투 스테이지에서만(출전 공개 후) 나타난다
  const T=H.load(htmlPath); const P=setup(T,"pve");
  H.place(T,P.king0,12,4); H.place(T,P.em,11,4); T.S.balls[0]=5; T.S.balls[1]=5;
  ok(neutralCap(T,P.king0,"fire")&&neutralCap(T,P.ek,"water"),"K9 전제: 내 왕 불 cap · 상대 왕 물 cap");
  T.S.reserve[1]={element:"grass",hp:70,maxHp:100,atk:20,skillAtk:30,cd:0,cdMax:2,skills:T.archSkills("std","grass"),cds:[0,0,0,0],revealedSkills:[],artRosterId:"M-G1"};
  T.S.reserve[0]={element:"lightning",hp:70,maxHp:100,atk:20,skillAtk:30,cd:0,cdMax:2,skills:T.archSkills("sustain","lightning"),cds:[0,0,0,0],revealedSkills:[],artRosterId:"M-L5"};
  T.S.current=0; T.S.selected=P.king0; T.render();
  const knownDirs=new Set(T.S.pieces.filter(p=>p.placed&&p.alive&&(p.owner===0||p.revealed)).map(p=>T.artDirOf(p)).filter(Boolean));
  const hidden=["fire_std","water_std","grass_std","lightning_sustain"].filter(d=>!knownDirs.has(d));
  const dom=()=>boardDump(T)+"|"+T.byId("sidePanel").innerHTML+"|"+T.byId("overlayBox").innerHTML;
  ok(hidden.length>=3&&hidden.every(d=>dom().indexOf(d)<0),"K9a 보드·사이드 패널(선택된 왕 정보 포함)에 내/상대 포획·예비 하수인의 종 폴더가 없다 ["+hidden.join(",")+"]");
  ok(/예비 하수인\(번개\) HP 70\/100/.test(T.byId("sidePanel").innerHTML)&&/포획 하수인\(불\) HP 100\/100/.test(T.byId("sidePanel").innerHTML),"K9b 예비·포획 배지는 기존처럼 속성·HP 텍스트만");
  T.S.mainUsed=false; T.S.battlesUsed=0; T.byId("obBtns").children.length=0;
  T.initBattle(P.king0,P.em); T.drain(500);
  ok(/출전 선택/.test(T.byId("overlayBox").innerHTML)&&hidden.every(d=>T.byId("overlayBox").innerHTML.indexOf(d)<0),"K9c 출전 선택 모달(비공개 선택)에 종 폴더 없음");
  modalBtn(T,2,1);
  ok(/출전 공개/.test(T.byId("overlayBox").innerHTML)&&/포획 하수인\(불\)/.test(T.byId("overlayBox").innerHTML)&&hidden.every(d=>T.byId("overlayBox").innerHTML.indexOf(d)<0),"K9d 출전 공개 모달은 기존 문구(포획 하수인(불))만 — 그림·폴더는 아직 없음");
  modalBtn(T,1,0);
  const st=T.byId("overlayBox").innerHTML;
  ok(!!T.S.battle&&st.indexOf("fire_std")>=0&&hidden.filter(d=>d!=="fire_std").every(d=>st.indexOf(d)<0),"K9e 전투 스테이지(출전 공개 후)에서만 대리 전투원의 종이 나타나고, 상대 왕의 미공개 cap·양측 예비의 종은 여전히 없다");
  ok(hidden.filter(d=>d!=="fire_std").every(d=>boardDump(T).indexOf(d)<0&&T.byId("sidePanel").innerHTML.indexOf(d)<0),"K9f 전투 중에도 보드·사이드에는 비공개 cap/예비 종이 없다");
  T.close(); T.S.battle=null; T.TQ.length=0;
}
{
  // K10 AI 공정 관측 — 상대 cap/예비의 외형 정체(artRosterId)는 AI 평가에 쓰이지 않는다: 정체를 지워도 평가값이 같고, AI 함수 소스에 정체 필드 참조가 없다
  const T=H.load(htmlPath); const P=setup(T,"pve");
  H.place(T,P.king0,12,4); H.place(T,P.em,11,4); T.S.balls[0]=5;
  T.setSeed(5); T.tryCapture(P.king0,"safe"); P.king0.revealed=true;
  const evWith=T.aiBattleEV(P.em,P.king0,1);
  const saved={artRosterId:P.king0.cap.artRosterId}; delete P.king0.cap.artRosterId;
  const evWithout=T.aiBattleEV(P.em,P.king0,1);
  Object.assign(P.king0.cap,saved);
  ok(JSON.stringify(evWith)===JSON.stringify(evWithout),"K10a AI 전투 기대치는 상대 cap 정체 유무와 무관 (같은 값)");
  const aiFns=["aiMain","aiMainStrong","aiBattleAction","aiBattleActionStrong","aiBattleEV","aiEvalPos","aiEvalBattles","aiEvalBattlesStrong","aiThreatOf","aiStaticRisk","aiProf"].filter(k=>typeof T[k]==="function");
  ok(aiFns.length>=8&&aiFns.every(k=>!/artRosterId|artDirOf/.test(T[k].toString())),"K10b AI 함수 "+aiFns.length+"개 소스에 artRosterId·아트 헬퍼 참조 없음 (외형 정체 필드는 표시 계층 전용)");
  T.TQ.length=0;
}

/* J13f/g 검사기 — 양성(J13f·g)과 음성 대조(J13j·k)가 같은 함수를 쓴다.
   j13Fresh: 핫시트 전투를 열고 실 문서 토큰 tok-A 를 전투 도트 실패로 대체한 상태.
   j13Arm : 메시지·FX 재생 경로를 켜고(msgBox.nodeType=1), A 의 phase 0 이 지난 뒤(phase=1) 를 재렌더해 D(P2) 의 행동 차례로 만든다 —
            이제 기본 공격의 피격 대상은 대체된 tok-A 다. 행동 전 FX 잔재를 지우고 appendChild 를 감시해 새로 붙는 dmgfloat 만 기록한다
            (제품은 dmgfloat 를 1.1초 뒤 떼어내므로 drain 후 children 만 보면 항상 0 — 그래서 기록이 필요하다).
   j13Check: progress = 전투 유지 · A HP 감소량 == 새 로그의 "N 피해!" 합(>0) · D HP 불변 · 라운드 +1/phase 0 · 로그 증가
             fx       = 같은 노드(byId 동일 객체)에 shake · dmgfloat 정확히 1개(그 피해량) · hptxt-A/dispHpA 가 실제 HP 와 동기화 · tok-D 는 shake 없음 */
function j13Fresh(){
  const T=H.load(htmlPath); const Q=setup(T,"pvp");
  T.S.current=0; T.S.mainUsed=false; T.S.battlesUsed=0;
  T.initBattle(Q.me,Q.em); T.drain(500);
  const B=T.S.battle, live=T.byId("tok-A");
  live.id="tok-A"; live.classList.add("btok"); live.classList.add("art"); live.classList.add("tok-me");
  T.artSpriteFail(T.artDirOf(Q.me),{onerror:function(){},style:{},parentNode:live});
  return {T,B,live};
}
function j13Arm(T,B,live){
  T.byId("msgBox").nodeType=1; // 제품은 실제 DOM(msgBox.nodeType===1)에서만 메시지·FX 를 재생한다 — 스텁에서 그 경로를 켠다
  B.phase=1; T.battleModal();   // A 의 phase 0 이 지난 상태 → 행동자 D(P2) · __actCore 의 side="D" · 피격 대상 A
  live.classList.remove("shake"); live.classList.remove("ko"); live.children.length=0; // 잔재 제거 — 이후 붙는 것만 이번 행동의 FX
  const floats=[], orig=live.appendChild;
  live.appendChild=function(c){ if(/dmgfloat/.test(c.className)) floats.push(c); return orig.call(this,c); };
  const clean=!live.classList.contains("shake")&&!live.classList.contains("ko")&&live.children.length===0&&floats.length===0&&B.phase===1&&T.S.battle===B;
  return {hpA:B.fa.hp,hpD:B.fd.hp,blog:B.blog.length,round:B.round,floats,clean};
}
function j13Check(T,B,live,s){
  const dHp=s.hpA-B.fa.hp, logDmg=B.blog.slice(s.blog).reduce((a,l)=>{const m=/^(\d+) 피해!/.exec(l); return a+(m?+m[1]:0);},0);
  const progress=T.S.battle===B&&dHp>0&&dHp===logDmg&&B.fd.hp===s.hpD&&B.round===s.round+1&&B.phase===0&&B.blog.length>s.blog;
  const tokD=T.byId("tok-D");
  const fx=T.byId("tok-A")===live&&live.classList.contains("shake")&&s.floats.length===1&&s.floats[0].parentNode===live
    &&s.floats[0].innerHTML.indexOf(`>-${dHp}<`)>=0&&String(T.byId("hptxt-A").textContent)===String(B.fa.hp)&&B.dispHpA===B.fa.hp&&!tokD.classList.contains("shake");
  const detail=`A ${s.hpA}→${B.fa.hp} · 로그 피해 ${logDmg} · D ${s.hpD}→${B.fd.hp} · R${s.round}→R${B.round} p${B.phase} · 로그 +${B.blog.length-s.blog} · shake ${live.classList.contains("shake")} · float ${s.floats.length}`;
  return {progress,fx,detail};
}

console.log(`\n=== smoke_minion_art: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
