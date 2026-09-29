/* #286 HotFix — 모바일 S03 말판 한 화면 (fitBoard 높이 맞춤)
   실행: node demo/test/regression/smoke_issue286.js [demo/index.html]
   파일을 쓰지 않는다. 실제 픽셀·히트 좌표는 실브라우저 측정(Mars 보고)이 맡고, 여기서는 배율 계산 계약만 본다:
     A  대전 화면: --bs = min(폭/376, 남은 높이/700) — 남은 높이는 #screenBody 에서 말판 위를 뺀 실측(스크롤 위치 무관)
     B  하한 칸 32px(32/52): 더 낮은 화면은 32px 로 두고 스크롤(#238 폴백) · 폭이 더 좁으면 폭이 이긴다
     C  배치(prep)·결과 화면은 종전 폭 맞춤 그대로
     D  상대 차례 배지는 DOM·문구 그대로, 보드 화면에서만 숨김(HUD .sel 과 중복 · 독 높이 고정) · 낮은 화면 행동 버튼 44px 유지 */
"use strict";
const fs=require("fs"), path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
const css=fs.readFileSync(path.join(path.dirname(htmlPath),"css","game.css"),"utf8");
let pass=0,fail=0;
function ok(cond,name){ if(cond) pass++; else { fail++; console.error("FAIL: "+name); } }

const T=H.load(htmlPath);
/* 스텁 DOM 에 390×844 실측값(appBar62 · 위 여백8 · HUD82 · 간격10 · 독74)을 얹는다 */
function geo(screen,{wrapW,bodyH,boardTop,scrollTop=0}){
  const w=T.byId("boardWrap"), b=T.byId("screenBody"), app=T.byId("app");
  const vars={}; w.style.setProperty=(k,v)=>{ vars[k]=v; };
  w.clientWidth=wrapW; b.clientHeight=bodyH; b.scrollTop=scrollTop;
  b.getBoundingClientRect=()=>({top:62}); w.getBoundingClientRect=()=>({top:62+boardTop-scrollTop});
  app.setAttribute("data-screen",screen);
  T.fitBoard(); return Number(vars["--bs"]);
}
const bs390=geo("board",{wrapW:374,bodyH:708,boardTop:100});
ok(bs390===0.868&&bs390*52>=44,`A1 390×844 대전: 높이 608/700 → --bs 0.868 (칸 ${(bs390*52).toFixed(1)}px ≥ 44) [실측 ${bs390}]`);
ok(bs390*700<=608,"A2 말판 높이가 남은 높이를 넘지 않는다 (내림)");
ok(geo("board",{wrapW:374,bodyH:708,boardTop:100,scrollTop:40})===bs390,"A3 스크롤 위치와 무관하게 같은 배율");
ok(geo("board",{wrapW:416,bodyH:764,boardTop:100})===0.948,"A4 432×936 대전: 높이가 폭보다 먼저 제한");
const bs320=geo("board",{wrapW:304,bodyH:518,boardTop:81});
ok(Math.abs(bs320*52-32.4)<0.1&&bs320*700<=437,`B1 320×640(압축 HUD73·독60): 칸 ${(bs320*52).toFixed(1)}px ≥ 32 · 스크롤 없음`);
ok(geo("board",{wrapW:828,bodyH:268,boardTop:90})===0.615,"B2 844×390 가로: 하한 32px(0.615)에서 멈추고 스크롤 폴백");
ok(geo("board",{wrapW:200,bodyH:268,boardTop:90})===0.531,"B3 폭 200: 폭 맞춤이 하한보다 우선 (가로 넘침 없음)");
ok(geo("prep",{wrapW:374,bodyH:500,boardTop:10})===0.994,"C1 배치 화면은 폭 맞춤만 (종전 그대로)");
ok(geo("result",{wrapW:304,bodyH:300,boardTop:400})===0.808,"C2 결과 화면도 폭 맞춤만");

H.freshPlay(T,"pve","grade5"); T.S.current=1; T.renderTurnBar();
const badge=T.byId("turnBar").children.find(c=>/AI 행동 중/.test(c.textContent));
ok(!!badge&&/\bturnWait\b/.test(badge.className),"D1 AI 차례 배지 DOM·문구 유지 + turnWait 표식");
ok(/#app\[data-screen="board"\] #turnBar \.badge\.turnWait\{display:none;\}/.test(css),"D2 보드 화면에서만 숨김");
const m=css.match(/@media \(max-height:760px\)\{([\s\S]*?)\n\}/);
ok(!!m&&/#turnBar button\[data-ico\],#app\[data-screen="board"\] #turnBar \.hudIco\{min-height:44px;\}/.test(m[1]),"D3 낮은 화면 압축에서도 행동 버튼 44px");
ok(!!m&&!/#board\b|\.cell/.test(m[1]),"D4 압축은 HUD·독만 — 칸 기하(52px)는 CSS 에서 불변");

console.log(`smoke_issue286: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
