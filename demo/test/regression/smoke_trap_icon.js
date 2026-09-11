/* #201 후속(2026-09-11 CJ 지시) 함정 전용 아이콘 계약 회귀 — node demo/test/regression/smoke_trap_icon.js [demo/index.html]
   무엇을 지키는가
     A. 원본 자산(demo/assets/symbols/trap.svg)과 문서 안 인라인 도형이 **같은 도형**이다 — 한쪽만 고쳐 갈라지는 것을 막는다.
     B. 함정 도형은 폰트를 보지 않는다 — glyphOk 가 참이든 거짓이든 같은 결과이고, 두부·'함정' 텍스트로 되돌아가지 않는다.
     C. 보드 얼굴·배치 트레이·추측 격자·추측 목록이 모두 같은 도형을 쓴다 (한 곳만 갈라지지 않는다).
     D. **은폐 불변식**: 보이지 않는/미공개 상대 함정은 물음표이고, 그 칸 DOM 어디에도 함정 도형·정체가 없다.
     E. 새 HTTP 요청을 만들지 않는다 — 인라인이라 <img>·url() 로 자산을 부르지 않는다.
   범위 밖(이번 보완에서 일부러 건드리지 않음): 튜토리얼 그림·.cell.fx-trap 연출 이모지·토스트 문구. */
"use strict";
const fs=require("fs"), path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2];
const ROOT=path.resolve(__dirname,"..","..","..");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const TRAPSVG=/<svg class="symv" data-sym="trap"/;
/* dataset 은 하네스 스텁에서 숫자로 들어온다 — 다른 회귀 파일과 같은 느슨한 비교를 쓴다 */
const cellOf=(T,r,c)=>T.els.board.children.find(x=>x.dataset.r==r&&x.dataset.c==c);
const chipOf=(T,r,c)=>{ const cell=cellOf(T,r,c); return cell&&cell.children.find(x=>/^pc /.test(x.className)); };
/* 칸 전체를 문자열로 — 자식 DOM·속성까지 눌러 담는다 (은폐 검사는 innerHTML 만 봐서는 부족하다) */
function dump(el){ if(!el) return ""; let s=el.className+" "+JSON.stringify(el._attrs||{})+" "+(el.innerHTML||"")+" "+(el.textContent||"");
  for(const c of (el.children||[])) s+=" "+dump(c); return s; }

/* ===== A. 원본 자산 ↔ 인라인 도형 일치 ===== */
{
  const T=H.load(htmlPath);
  const assetPath=path.join(ROOT,"demo","assets","symbols","trap.svg");
  ok(fs.existsSync(assetPath),"A1 Earth 납품 원본 자산 demo/assets/symbols/trap.svg 가 있다");
  const asset=fs.readFileSync(assetPath,"utf8");
  ok(/viewBox="0 0 32 32"/.test(asset),"A2 원본 자산이 32×32 viewBox 다");
  ok(/viewBox="0 0 32 32"/.test(T.symSvgHtml("trap")),"A2b 인라인 렌더도 같은 32×32 viewBox 를 쓴다 — 두 좌표계가 같아야 좌표 비교가 뜻을 가진다");
  /* 도형 비교: 두 쪽에서 그리기 요소(path·circle)를 순서대로 뽑아, **좌표와 칠(fill·stroke·굵기·이음새)** 을 함께 맞춘다.
     좌표만 보면 같은 윤곽에 색만 바뀐 그림이 통과하므로, "같은 그림"이라고 말하려면 칠까지 봐야 한다.
     공백·들여쓰기·속성 순서 같은 표기 차이는 정규화해 무시한다. */
  const PAINT=["fill","stroke","stroke-width","stroke-linejoin","stroke-linecap"];
  const geo=src=>(src.match(/<(?:path|circle)\b[^>]*>/g)||[]).map(x=>{
    const g=k=>{ const m=x.match(new RegExp('(?:^|\\s)'+k+'="([^"]*)"')); return m?m[1].replace(/\s+/g," ").trim():""; };
    const shape=/^<path/.test(x)?"d:"+g("d"):"c:"+g("cx")+","+g("cy")+","+g("r");
    return shape+"|"+PAINT.map(k=>k+"="+g(k)).join(";");
  });
  const inlineSrc=(T.html.match(/const SYM_SVG=\{[\s\S]*?\};/)||[""])[0];
  ok(inlineSrc.length>0,"A3 문서 안에 SYM_SVG 정의가 있다");
  const a=geo(asset), b=geo(inlineSrc);
  const same=(x,y)=>x.length>0&&x.length===y.length&&x.every((v,i)=>v===y[i]);
  /* fill="none" 인 요소도 있으므로 "색이 있다"가 아니라 "값이 실제로 뽑혔다"로 본다:
     모든 요소가 비어 있지 않은 좌표를 갖고, 칠 항목 중 최소 하나가 값을 갖는다. */
  const filled=x=>{ const [shape,paint]=x.split("|");
    return shape.length>2 && paint.split(";").some(kv=>kv.split("=")[1]); };
  ok(a.every(filled)&&b.every(filled),
     `A3c 좌표·칠이 실제로 추출됐다 — 전부 빈 문자열이라 A4 가 거저 통과하는 경우를 배제한다 (예: ${JSON.stringify(a[0])})`);
  ok(a.length>=9,`A3b 비교 대상 도형 요소가 실제로 뽑혔다 (${a.length}개) — A4 가 빈 배열끼리 비교해 통과하지 않는다`);
  ok(same(a,b),`A4 인라인 도형이 원본 자산과 같은 그림이다 — 좌표와 칠(fill·stroke·굵기) 전부 일치 (원본 ${a.length}개 · 인라인 ${b.length}개)`);
  /* 음성 대조 — 좌표만 바꾼 경우와 **색만** 바꾼 경우를 둘 다 잡는지 이 파일 안에서 증명한다 */
  ok(!same(geo(asset.replace('cx="4"','cx="9"')),b),"A5 음성 대조: 좌표를 하나 바꾼 자산은 A4 검사기를 통과하지 못한다");
  ok(!same(geo(asset.replace('fill="#c99b58"','fill="#ff0000"')),b),"A5b 음성 대조: 좌표가 같아도 **색만** 바꾼 자산은 A4 검사기를 통과하지 못한다");
  ok(T.SYM_SVG&&typeof T.SYM_SVG.trap==="string"&&Object.keys(T.SYM_SVG).length===1,
     "A6 전용 도형은 함정 하나뿐 (나머지 7종은 종전 이모지 계약 그대로)");
}

/* ===== B. 폰트 독립 ===== */
{
  const T=H.load(htmlPath);
  const face=()=>T.pcFaceHtml({type:"trap"});
  const withGlyph=face();
  T.GLYPH.cache["🪤"]=false;               // 글리프가 없는 플랫폼(실측 Windows 10 Chrome)을 흉내 낸다
  const withoutGlyph=face();
  ok(TRAPSVG.test(withGlyph),"B1 글리프가 있을 때 함정 = 전용 도형");
  ok(TRAPSVG.test(withoutGlyph),"B2 글리프가 없을 때도 함정 = 같은 전용 도형 (두부·텍스트 폴백 없음)");
  ok(withGlyph===withoutGlyph,"B3 두 경우의 마크업이 **완전히 같다** — 렌더가 폰트 지원 여부를 아예 보지 않는다");
  ok(!/🪤/.test(withoutGlyph)&&!/class="sym ng"/.test(withoutGlyph),"B4 함정 자리에 이모지 글자도 '함정' 텍스트 폴백도 없다");
  /* 함정만 예외로 두고 나머지 계약을 깨지 않았는지 — 도형이 없는 기호는 종전 폴백 그대로여야 한다 */
  T.GLYPH.cache["👑"]=false;
  ok(/class="sym ng">왕</.test(T.pcFaceHtml({type:"king",hp:100})),"B5 도형이 없는 왕은 종전 텍스트 폴백 그대로 (#89 계약 유지)");
  T.GLYPH.cache["💣"]=true;
  ok(/class="sym" aria-hidden="true">💣</.test(T.pcFaceHtml({type:"bomb"})),"B6 글리프가 있는 폭탄은 종전 이모지 그대로");
  ok(T.memoEmoji("trap")==="🪤"&&T.pieceEmoji({type:"trap"})==="🪤",
     "B7 MEMO_OPTS 의 기호 어휘(🪤)는 바뀌지 않았다 — 바뀐 것은 그리는 방법뿐 (저장 키·라벨 계약 불변)");
}

/* ===== C. 모든 표시 경로가 같은 도형 ===== */
{
  const T=H.load(htmlPath);
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const myTrap=T.S.pieces.find(x=>x.owner===0&&x.type==="trap");
  const myKing=T.S.pieces.find(x=>x.owner===0&&x.type==="king");
  H.place(T,myTrap,13,3); H.place(T,myKing,13,1); T.render();
  ok(TRAPSVG.test(chipOf(T,13,3).innerHTML),"C1 보드 — 내 함정은 전용 도형");
  ok(/class="face"/.test(chipOf(T,13,3).innerHTML)&&!/class="info"/.test(chipOf(T,13,3).innerHTML),
     "C2 함정은 종전대로 얼굴만 있고 정보 행(HP)이 없다 (규격 7.8·7.9 불변)");
  // 배치 트레이
  T.newGame("pvp"); T.S.phase="setup"; T.S.setupPlayer=0; T.fillRosterRandom(0); T.render();
  ok(TRAPSVG.test(T.els.sidePanel.innerHTML),"C3 배치 트레이 — 같은 도형 (보드와 갈라지지 않는다)");
  // 추측 격자 + 보드 추측 자리 + 사이드 목록
  const T2=H.load(htmlPath);
  H.freshPlay(T2,"pve"); H.clearBoard(T2);
  const me=T2.S.pieces.find(x=>x.owner===0&&x.type==="minion");
  const foe=T2.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T2,me,12,4); H.place(T2,T2.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
  H.place(T2,foe,11,4); foe.revealed=false; T2.S.selected=null; T2.render();
  T2.onCell(11,4);
  const trapBtn=T2.MEMO_UI.btns.find(b=>b.dataset.key==="trap");
  ok(trapBtn&&TRAPSVG.test(trapBtn.innerHTML)&&/함정/.test(trapBtn.innerHTML),"C4 추측 격자 버튼 — 같은 도형 + 기존 '함정' 라벨");
  ok(trapBtn.getAttribute("aria-label")==="함정 🪤 추측","C5 접근성 라벨 문구는 종전 그대로 (도형은 aria-hidden)");
  trapBtn.onclick(); T2.render();
  ok(TRAPSVG.test(chipOf(T2,11,4).innerHTML)&&/memo-guess/.test(chipOf(T2,11,4).className),
     "C6 보드 추측 자리 — 같은 도형 · 점선 반투명 표식 유지");
  ok(TRAPSVG.test(T2.els.sidePanel.innerHTML)&&/함정 추측/.test(T2.els.sidePanel.innerHTML),
     "C7 사이드 패널 추측 목록 — 같은 도형 + 기존 '함정 추측' 문구");
  ok(/\.status \.guess\.sv\{/.test(T2.html)&&/\.memo-opt \.ico\.sv\{/.test(T2.html),"C8 각 자리 전용 크기 CSS 존재 (한 줄 목록·격자에서 넘치지 않음)");
}

/* ===== D. 은폐 불변식 — 미공개 상대 함정은 절대 도형이 되지 않는다 ===== */
{
  const T=H.load(htmlPath);
  H.freshPlay(T,"pve"); H.clearBoard(T);
  const me=T.S.pieces.find(x=>x.owner===0&&x.type==="minion");
  const foeTrap=T.S.pieces.find(x=>x.owner===1&&x.type==="trap");
  H.place(T,me,12,4); H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
  H.place(T,foeTrap,11,4); foeTrap.revealed=false; T.S.selected=null; T.render();
  const ch=chipOf(T,11,4);
  ok(!!ch&&ch.innerHTML==="?","D1 미공개 상대 함정은 물음표 그대로");
  ok(!TRAPSVG.test(dump(cellOf(T,11,4))),"D2 그 칸 DOM 어디에도 함정 도형이 없다 (자식·속성 포함)");
  ok(dump(cellOf(T,11,4)).indexOf("data-sym")<0,"D3 정체 식별자(data-sym)가 미공개 말 칸에 새지 않는다");
  ok(!/함정/.test(dump(cellOf(T,11,4))),"D4 '함정'이라는 말도 그 칸에 없다");
  /* 하네스 스텁의 board.innerHTML 은 자식을 append 해도 비어 있다 — 그 문자열을 보면 무엇을 넣어도 통과한다.
     실제 자식 트리를 재귀로 눌러 담은 dump() 로 본다 (아래 D6 양성 대조가 이 검사기가 살아 있음을 증명한다). */
  const boardDump=dump(T.els.board);
  ok(boardDump.length>0,"D5a 전제: 보드 덤프가 비어 있지 않다 — D5·D7 이 빈 문자열을 검사하지 않는다");
  ok(!TRAPSVG.test(boardDump),"D5 보드 전체를 뒤져도 상대 함정 도형이 없다");
  /* 양성 대조 — 실제로 공개되면 같은 자리에 도형이 나온다 (D2~D5 가 '아무것도 안 그려서' 통과한 것이 아님을 증명) */
  foeTrap.revealed=true; T.render();
  ok(TRAPSVG.test(chipOf(T,11,4).innerHTML),"D6 양성 대조: 정체가 공개되면 같은 자리에 함정 도형이 나온다");
  /* 숲에 숨은 말은 애초에 chip 자체가 만들어지지 않는다. 숲 행은 4~5·9~10 이다 (renderBoard: r<=3 zA · r<=5 forest · r<=8 없음 · r<=10 forest · 그 밖 zB).
     예전 판에서 쓰던 2행은 숲이 아니라 상대 진영이라 "숲 은폐"를 증명하지 못했다 — 그 말은 그냥 보이는 물음표였다. */
  const T3=H.load(htmlPath);
  H.freshPlay(T3,"pve"); H.clearBoard(T3);
  const far=T3.S.pieces.find(x=>x.owner===1&&x.type==="trap");
  const myKing3=T3.S.pieces.find(x=>x.owner===0&&x.type==="king");
  H.place(T3,myKing3,13,1);            // 내 말은 숲에서 멀리 (인접하면 숲 안이 보인다)
  H.place(T3,far,4,4); far.revealed=false; T3.render();
  const farCell=cellOf(T3,4,4), farDump=dump(T3.els.board);
  ok(!!farCell&&/forest/.test(farCell.className),"D7a 전제: 4행 4열이 실제 숲 칸이다 (은폐 전제가 성립한다)");
  ok(!T3.visibleTo(0,far),"D7b 전제: 그 말은 내게 보이지 않는다 (숲 · 인접 아님)");
  ok(!chipOf(T3,4,4),"D7 숲에 숨은 미공개 상대 함정은 chip 자체가 만들어지지 않는다");
  ok(farDump.length>0&&!TRAPSVG.test(farDump),"D7c 보드 어디에도 그 함정 도형이 없다 (빈 문자열 검사가 아니다)");
  /* 양성 대조 — 내 말이 바로 옆에 가면 같은 말이 보이고, 공개까지 되면 같은 자리에 도형이 나온다 */
  H.place(T3,myKing3,4,3); T3.render();
  ok(T3.visibleTo(0,far)&&!!chipOf(T3,4,4),"D7d 양성 대조: 내 말이 인접하면 그 숲 칸의 말이 보인다 (D7 이 '아무것도 안 그려서' 통과한 것이 아니다)");
  ok(!TRAPSVG.test(dump(cellOf(T3,4,4))),"D7e 보이더라도 미공개인 한 함정 도형은 아니다 (가시성과 정체 공개는 별개)");
}

/* ===== E. 새 네트워크 요청 없음 ===== */
{
  const T=H.load(htmlPath);
  const face=T.pcFaceHtml({type:"trap"});
  ok(!/<img/.test(face)&&!/url\(/.test(face)&&!/src=/.test(face),"E1 도형은 인라인 — <img>·url()·src 로 자산을 부르지 않는다");
  /* 주석으로 출처를 적는 것은 참조가 아니다 — 실제로 **불러오는** 표기(src=·url()·fetch)만 금지한다.
     원본 파일은 도형의 출처일 뿐이고 런타임 의존이 아니어야 한다 (요청 목록이 정체와 상관관계를 만들지 않는다). */
  ok(!/(?:src\s*=\s*["'][^"']*|url\(\s*["']?[^"')]*)assets\/symbols\//.test(T.html),
     "E2 문서가 심볼 자산을 src·url() 로 불러오지 않는다 (출처를 적은 주석은 참조가 아니다)");
  ok(/assets\/symbols\/trap\.svg/.test(T.html),"E2b 대신 도형의 출처(원본 자산 경로)가 주석으로 적혀 있다 — 어디서 왔는지 추적 가능");
  ok(/const SYM_SVG=\{/.test(T.html)&&!/fetch\(|XMLHttpRequest/.test((T.html.match(/const SYM_SVG=\{[\s\S]*?\};/)||[""])[0]),
     "E3 도형 구간에 네트워크 API 이름이 없다");
}

console.log(`\n=== smoke_trap_icon (#201 후속): pass ${pass} / fail ${fail} ===`);
if(fail){ console.error("실패 목록:\n - "+fails.join("\n - ")); process.exit(1); }
