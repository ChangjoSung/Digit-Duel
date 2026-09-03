/* #42 튜토리얼 카드 레이아웃 실측 — 헤드리스 Chrome(CDP)으로 demo/index.html을 열고 10단계 전부를 여러 뷰포트에서 측정한다.
   사용: node demo/test/tut_layout_cdp.js [--html <index.html>] [--out <dir>] [--chrome <chrome.exe>] [--shots]
   측정: 페이지·박스 가로 넘침 / 카드가 박스 밖으로 나감 / 카드끼리 겹침 / 카드 안 텍스트·행 요소 잘림(scrollWidth>clientWidth)·카드 밖 이탈·겹침 / 내비 버튼 잘림 / 열 수 / 내부 세로 스크롤 여부
     + #42 REVISE 스크롤·포커스: 단계 진입 시 #tutBox.scrollTop 0 · 제목과 카드 1 머리(번호 배지·제목)가 스크롤 없이 즉시 보임 · 포커스는 내비 기본 버튼.
   경로: 각 뷰포트에서 (go) tutGo(i) 직접 이동 · (next) '다음 ▶' 버튼 클릭 · (prev) '◀ 이전' 버튼 클릭 — next/prev는 직전 단계에서 박스를 맨 아래까지 스크롤한 뒤 이동해 오프셋 잔존 회귀를 잡는다.
   뷰포트: 1280×720 · 1440×900 · 1920×1080 · 1280×720@200% 줌 상당(CSS 640×360, DPR 2) · 360×640(좁은 폭 참고, 데스크톱 모드).
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 없음. 종료 코드 1 = 잘림/겹침/넘침 발견. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const OUT=opt("--out",path.join(os.tmpdir(),"tut_layout_cdp")), SHOTS=args.includes("--shots");
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(opt("--html",path.join(__dirname,"..","index.html"))); // --html: 회귀 재현·비교용 사본 측정
const URL="file:///"+HTML.replace(/\\/g,"/");
const VIEWPORTS=[
  {name:"1280x720",w:1280,h:720,dpr:1},
  {name:"1440x900",w:1440,h:900,dpr:1},
  {name:"1920x1080",w:1920,h:1080,dpr:1},
  {name:"1280x720@200%",w:640,h:360,dpr:2}, // 브라우저 200% 줌 상당: CSS 뷰포트 절반 + DPR 2
  {name:"360x640(narrow)",w:360,h:640,dpr:2} // 참고: mobile:true 에뮬레이션은 게임 화면 #app 고정폭(~722px) 때문에 레이아웃 뷰포트가 722로 넓어져(#42 범위 밖, 기존 동작) 튜토리얼 CSS 자체 검증이 안 되므로 데스크톱 모드 좁은 폭으로 측정
];
/* 페이지 안에서 실행되는 측정 스크립트 — 현재 단계의 카드 격자를 검사해 문제 목록을 돌려준다 */
const MEASURE=`(()=>{
  const $=id=>document.getElementById(id), R=e=>e.getBoundingClientRect();
  const box=$("tutBox"), body=$("tutBody"); if(!box||!body) return {error:"tutBox/tutBody 없음"};
  const cards=[...body.querySelectorAll(".tut-card")], boxR=R(box), issues=[];
  const ov=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
  const pageW=document.documentElement.scrollWidth, appW=document.getElementById("app").scrollWidth; // 튜토리얼 아래 게임 화면(#app: 보드+패널)은 원래 ~720px 고정폭 — 그 폭이 원인이면 튜토리얼 문제가 아니므로 info로만 기록
  const pageHscroll=pageW>window.innerWidth?(pageW+">"+window.innerWidth+(appW>=pageW-1?" (게임 화면 #app 고정폭 기인)":"")):"";
  if(pageW>window.innerWidth&&appW<pageW-1) issues.push("페이지 가로 스크롤(튜토리얼 기인) "+pageW+">"+window.innerWidth);
  if(box.scrollWidth>box.clientWidth+1) issues.push("박스 가로 넘침 "+box.scrollWidth+">"+box.clientWidth);
  if(boxR.left<0||boxR.right>window.innerWidth+0.5||boxR.top<0||boxR.bottom>window.innerHeight+0.5) issues.push("박스가 뷰포트 밖");
  cards.forEach((c,k)=>{ const r=R(c); if(r.left<boxR.left-0.5||r.right>boxR.right+0.5) issues.push("카드"+(k+1)+" 박스 밖(x)"); });
  for(let i=0;i<cards.length;i++) for(let j=i+1;j<cards.length;j++) if(ov(R(cards[i]),R(cards[j]))) issues.push("카드 겹침 "+(i+1)+"/"+(j+1));
  const TXT="h3,.tut-txt,.tut-res,.tut-lbl,.tut-pill,.tut-flow-box,.tut-gifts span,.tut-legend span,.tut-strike,.tut-plist>span,.tut-sn";
  cards.forEach((c,k)=>{ const cr=R(c);
    c.querySelectorAll(TXT).forEach(el=>{ const r=R(el), t=el.textContent.trim().slice(0,14);
      if(el.scrollWidth>el.clientWidth+1) issues.push("잘림 카드"+(k+1)+" ."+el.className.split(" ")[0]+' "'+t+'" '+el.scrollWidth+">"+el.clientWidth);
      if(r.right>cr.right+0.5||r.left<cr.left-0.5||r.bottom>cr.bottom+0.5||r.top<cr.top-0.5) issues.push("카드 밖 이탈 카드"+(k+1)+" ."+el.className.split(" ")[0]+' "'+t+'"'); });
    c.querySelectorAll(".tut-vis,.tut-vis svg").forEach(v=>{ const r=R(v); if(v.scrollWidth>v.clientWidth+1) issues.push("그림 넘침 카드"+(k+1)+" "+v.scrollWidth+">"+v.clientWidth); if(r.right>cr.right+0.5||r.left<cr.left-0.5) issues.push("그림 카드 밖 카드"+(k+1)); });
    c.querySelectorAll(".tut-row,.tut-flow,.tut-card-h,.tut-stack,.tut-plist").forEach(row=>{ const ch=[...row.children];
      for(let i=0;i<ch.length;i++) for(let j=i+1;j<ch.length;j++) if(ov(R(ch[i]),R(ch[j]))) issues.push("행 안 겹침 카드"+(k+1)+" ."+(ch[i].className||ch[i].tagName).split(" ")[0]+"/."+(ch[j].className||ch[j].tagName).split(" ")[0]); });
    const kids=[...c.children]; for(let i=0;i<kids.length;i++) for(let j=i+1;j<kids.length;j++) if(ov(R(kids[i]),R(kids[j]))) issues.push("카드 블록 겹침 카드"+(k+1)+" "+kids[i].className+"/"+kids[j].className);
  });
  const ban=body.querySelector(".tut-banner"); if(ban&&(ban.scrollWidth>ban.clientWidth+1)) issues.push("배너 잘림");
  document.querySelectorAll("#tutNav button").forEach(b=>{ if(b.scrollWidth>b.clientWidth+1) issues.push("버튼 잘림 "+b.textContent); });
  const title=$("tutTitle"); if(title.scrollWidth>title.clientWidth+1) issues.push("제목 잘림");
  /* #42 REVISE — 단계가 열린 "그 순간" 사용자가 무엇을 보는가: 박스가 이미 아래로 스크롤돼 있으면 제목·카드 1이 화면 밖이다.
     가시율 = 요소 세로 길이 중 박스의 보이는 영역(clientRect)과 겹치는 비율. 카드 전체는 작은 뷰포트에서 아래가 잘릴 수 있으므로
     "제목 전체 + 카드 1의 머리(번호 배지·제목 행)"를 즉시 노출 기준으로 삼고, 카드 1 본문 가시율은 참고값으로 기록한다. */
  const de=document.scrollingElement||document.documentElement;
  const frac=el=>{ if(!el) return 0; const r=R(el), h=r.height||1; return Math.max(0,Math.min(r.bottom,boxR.bottom)-Math.max(r.top,boxR.top))/h; };
  const title2=$("tutTitle"), c1=cards[0], head1=c1?c1.querySelector(".tut-card-h"):null;
  const scrollTop=Math.round(box.scrollTop), pageTop=Math.round(de?de.scrollTop:0);
  const titleVis=Math.round(frac(title2)*100), card1Vis=Math.round(frac(c1)*100), head1Vis=Math.round(frac(head1)*100);
  if(scrollTop>1) issues.push("단계 진입 스크롤 오프셋 "+scrollTop+"px (제목부터 보여야 함)");
  if(pageTop>1) issues.push("페이지 세로 스크롤 "+pageTop+"px");
  if(titleVis<99) issues.push("제목 즉시 노출 실패 "+titleVis+"%");
  if(head1Vis<99) issues.push("카드1 머리(번호·제목) 즉시 노출 실패 "+head1Vis+"%");
  if(card1Vis<=0) issues.push("카드1이 전혀 보이지 않음");
  const nav=$("tutNav"), ae=document.activeElement;
  const focusOn=ae&&nav&&nav.contains(ae)?(ae.textContent||"").trim():"";
  if(!focusOn) issues.push("포커스가 내비 버튼 밖 ("+(ae?ae.tagName+(ae.id?"#"+ae.id:""):"none")+")");
  const lefts=[...new Set(cards.map(c=>Math.round(R(c).left)))];
  return {cols:lefts.length,cards:cards.length,pageHscroll,boxW:Math.round(boxR.width),boxH:Math.round(boxR.height),vscroll:box.scrollHeight>box.clientHeight+1?box.scrollHeight+">"+box.clientHeight:"",
    scrollTop,pageTop,titleVis,head1Vis,card1Vis,focusOn,
    minCardW:Math.round(Math.min(...cards.map(c=>R(c).width))),fs:getComputedStyle(cards[0].querySelector(".tut-txt")).fontSize,issues};
})()`;

/* 내비 버튼을 실제로 눌러 이동하는 경로 (tutGo 직접 호출과 달리 onclick·포커스 흐름을 그대로 탄다) */
const SCROLL_BOTTOM=`(()=>{const b=document.getElementById("tutBox"); if(!b) return -1; b.scrollTop=b.scrollHeight; return Math.round(b.scrollTop);})()`;
const CLICK_NEXT=`(()=>{const b=document.querySelector("#tutNav button.primary"); if(!b||b.disabled) return false; b.click(); return true;})()`;
const CLICK_PREV=`(()=>{const b=document.querySelector("#tutNav button"); if(!b||b.disabled) return false; b.click(); return true;})()`;

function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"tutcdp-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--allow-file-access-from-files","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map(); this.events=[]; this.waiters=[];
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); }
      else if(m.method){ const w=this.waiters.find(x=>x.method===m.method&&(!x.sid||x.sid===m.sessionId)); if(w){ this.waiters.splice(this.waiters.indexOf(w),1); w.res(m.params); } } }; }
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
  once(method,sid){ return new Promise(res=>this.waiters.push({method,sid,res})); }
}
function connect(url){ return new Promise((res,rej)=>{ const ws=new WebSocket(url); ws.onopen=()=>res(new CDP(ws)); ws.onerror=e=>rej(new Error("WS 오류 "+url)); }); }

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const {proc,ws,udd}=await launch();
  const report=[]; let bad=0;
  try{
    const cdp=await connect(ws);
    const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
    const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
    await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid);
    for(const vp of VIEWPORTS){
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:vp.w,height:vp.h,deviceScaleFactor:vp.dpr,mobile:!!vp.mobile},sid);
      const loaded=cdp.once("Page.loadEventFired",sid);
      await cdp.send("Page.navigate",{url:URL},sid); await loaded;
      // 튜토리얼을 확실히 연다 (tutorialSeen 저장 여부와 무관) — 게임 상태와 분리된 tutOpen()
      await cdp.send("Runtime.evaluate",{expression:"try{localStorage.removeItem('tutorialSeen')}catch(e){}; tutOpen(); true"},sid);
      const nSteps=(await cdp.send("Runtime.evaluate",{expression:"TUT_STEPS.length",returnByValue:true},sid)).result.value;
      const measure=async(nav,step)=>{
        const r=(await cdp.send("Runtime.evaluate",{expression:MEASURE,returnByValue:true},sid)).result.value;
        report.push({vp:vp.name,nav,step,...r});
        if(r.error||(r.issues&&r.issues.length)) bad++;
        return r;
      };
      // 1) tutGo 직접 이동 — 10단계 전부의 카드 격자 기하 + 진입 스크롤·즉시 노출
      for(let i=0;i<nSteps;i++){
        await cdp.send("Runtime.evaluate",{expression:`tutGo(${i}); true`},sid);
        await measure("go",i+1);
        if(SHOTS&&(i===0||i===3||i===6||i===8)){ const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid); fs.writeFileSync(path.join(OUT,`${vp.name.replace(/[^\w@%]/g,"_")}_step${i+1}.png`),Buffer.from(data,"base64")); }
      }
      /* 2) '다음 ▶'·'◀ 이전' 버튼 클릭 경로 — 매 이동 직전에 박스를 맨 아래까지 스크롤해 둔다.
         이전 단계의 스크롤 오프셋이 남거나, 하단 기본 버튼 포커스가 자동 스크롤을 유발하면 여기서 제목·카드 1이 가려진 채 잡힌다. */
      await cdp.send("Runtime.evaluate",{expression:"tutGo(0); true"},sid);
      for(let i=1;i<nSteps;i++){
        await cdp.send("Runtime.evaluate",{expression:SCROLL_BOTTOM,returnByValue:true},sid);
        const clicked=(await cdp.send("Runtime.evaluate",{expression:CLICK_NEXT,returnByValue:true},sid)).result.value;
        if(!clicked){ report.push({vp:vp.name,nav:"next",step:i+1,issues:["'다음' 버튼 클릭 실패"]}); bad++; break; }
        await measure("next",i+1);
      }
      for(let i=nSteps-2;i>=0;i--){
        await cdp.send("Runtime.evaluate",{expression:SCROLL_BOTTOM,returnByValue:true},sid);
        const clicked=(await cdp.send("Runtime.evaluate",{expression:CLICK_PREV,returnByValue:true},sid)).result.value;
        if(!clicked){ report.push({vp:vp.name,nav:"prev",step:i+1,issues:["'이전' 버튼 클릭 실패"]}); bad++; break; }
        await measure("prev",i+1);
      }
    }
  } finally { try{proc.kill();}catch(e){} setTimeout(()=>{ try{fs.rmSync(udd,{recursive:true,force:true});}catch(e){} },500); }
  fs.writeFileSync(path.join(OUT,"tut_layout_report.json"),JSON.stringify(report,null,1));
  /* 요약 표: 뷰포트별 열 수·박스 폭·최소 카드 폭·글자 크기·내부 스크롤·문제 */
  let cur="", curNav=""; for(const r of report){ if(r.vp!==cur||r.nav!==curNav){ cur=r.vp; curNav=r.nav; console.log(`\n== ${cur} [${curNav}]`); }
    console.log(`  step ${String(r.step).padStart(2)}: cols=${r.cols} cards=${r.cards} box=${r.boxW}x${r.boxH} minCardW=${r.minCardW} fs=${r.fs} vscroll=${r.vscroll||"-"} top=${r.scrollTop} title=${r.titleVis}% card1head=${r.head1Vis}% card1=${r.card1Vis}% focus="${r.focusOn||""}"${r.pageHscroll?" pageHscroll="+r.pageHscroll:""}${r.issues&&r.issues.length?"  ISSUES: "+r.issues.join(" | "):""}${r.error?"  ERROR "+r.error:""}`); }
  console.log(`\n=== tut_layout_cdp: ${report.length} 측정 · 문제 ${bad}건 · 보고서 ${path.join(OUT,"tut_layout_report.json")}${SHOTS?" · 스크린샷 "+OUT:""}`);
  process.exit(bad?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
