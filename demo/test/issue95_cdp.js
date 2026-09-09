/* #95 공격형 위력 표기 — 실제 브라우저(헤드리스 Chrome · CDP) 소수 증빙
   사용: node demo/test/issue95_cdp.js [--html <index.html>] [--out <dir>] [--chrome <chrome.exe>] [--no-http] [--read-only]
   --read-only: Saturn 독립 재검증용. 검증 산출물 0 — 스크린샷·JSON 을 만들지 않고 stdout 으로만 보고한다.
                Chrome 임시 프로필(os.tmpdir()/i95cdp-*)만 실행 부수 리소스로 생성·정리한다(RESOURCE/CLEANUP 행).
   무엇을 재는가 (헤드리스 DOM 스텁이 아니라 진짜 렌더 트리·실제 클릭 흐름):
     1) 로스터 설명창 rosterInfo("M-F2") 텍스트 — "HP 90 · 공격 25", 위력 30/43/45
     2) PVE 실제 전투 진입 후 내 화염 투사(M-F2) 커맨드 버튼 텍스트 — 화염탄 24~36 · 폭염 강타 34~52 · 결정타 36~54
     3) 결정타 버튼을 실제로 클릭(분산 0 고정 · 같은 속성 표준형 상대) → 전투 이력에 "45 피해" · 상대 HP 100→55 · 반동 문구
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 없음. 종료 코드 1 = 문제 발견, 2 = 실행 실패. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.4","issues","95","Mars","artifacts")));
const READ_ONLY=args.includes("--read-only");
const USE_HTTP=!args.includes("--no-http");
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(opt("--html",path.join(__dirname,"..","index.html")));
const FILE_URL="file:///"+HTML.replace(/\\/g,"/");
const VP={name:"desktop-1280",w:1280,h:800,dpr:1};

/* 기대값 — docs/v0.4.4-gameplay-spec.md 3장 V6 (atk 25 · 결정타 40 → stable 30 · heavy 43 · 결정타 45 · 기본 25) */
const EXP={roster:["HP 90 · 공격 25","위력 30","위력 43 · 쿨 3","위력 45 · 쿨 4"],
  battle:["화염탄 24~36","폭염 강타 34~52","집중","결정타 36~54"],
  old:["공격 26","위력 45 · 쿨 3","위력 52","결정타 42~62","폭염 강타 36~54","화염탄 25~37"]};

const SETUP=`(()=>{
  try{ localStorage.setItem("tutorialSeen","1"); }catch(e){}
  if(typeof tutClose==="function") try{ tutClose(); }catch(e){}
  setSeed(9595); startMode("pve",{aiLevel:"grade5"});
  return S.phase;
})()`;
const OPEN_ROSTER=`(()=>{ rosterInfo("M-F2"); const b=document.getElementById("overlayBox"); return {text:b.innerText.replace(/\\s+/g," "), art:b.innerHTML.indexOf("fire_atk/portrait")>=0}; })()`;
const CLOSE=`(()=>{ close(); return true; })()`;
/* 내 로스터에 화염 투사(M-F2)를 넣고 배치 완료 → 상대 하수인 하나를 내 앞에 끌어와 실제 initBattle 로 전투 진입 (공격측 = 나 = R1 선공) */
const START_BATTLE=`(()=>{
  S.roster[0]=["M-F2","M-W2","M-G2","M-L2","M-F1","M-W1"]; applyRoster(0);
  autoPlaceCore(); setupDoneCore();
  const me=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.placed&&x.rosterId==="M-F2");
  // 상대는 같은 속성(무상성)의 표준형 새끼 화룡(M-F1)으로 고정 — AI 로스터에 없으면 배치된 AI 하수인 하나의 종만 M-F1 로 재주입 (위치 불변)
  const aiMs=S.pieces.filter(x=>x.owner===1&&x.type==="minion");
  let op=aiMs.find(x=>x.placed&&x.rosterId==="M-F1");
  if(!op){ const i=aiMs.findIndex(x=>x.placed); if(i<0) return {err:"no-minions"}; S.roster[1][i]="M-F1"; applyRoster(1); op=aiMs[i]; }
  if(!me||!op) return {err:"no-minions"};
  const occ=S.pieces.find(x=>x.placed&&x.alive&&x.r===me.r-1&&x.c===me.c&&x.id!==op.id); if(occ) occ.placed=false;
  op.r=me.r-1; op.c=me.c;
  S.current=0; S.mainUsed=false; S.battlesUsed=0; S.selected=null; S.inv=[[],[]]; S.balls=[0,0];
  BAL.dmgVar=0; // 클릭 증빙의 피해 수치를 결정적으로 (표기 범위는 이미 캡처했으므로 이후 화면은 분산 0)
  initBattle(me,op);
  if(!S.battle) return {err:"no-battle"};
  return {me:me.rosterId,op:op.rosterId,opHp:S.battle.fd.hp,opMax:S.battle.fd.maxHp,side:actorOfPhase()};
})()`;
const READ_BATTLE_UI=`(()=>{
  const btns=[...document.querySelectorAll("#overlayBox .row button")].map(b=>b.textContent.trim()).filter(t=>/~|집중|기본 공격/.test(t));
  const hp=document.getElementById("hptxt-D"); const ht=document.getElementById("overlayBox").innerText.replace(/\\s+/g," ");
  return {btns, hpD:hp?hp.textContent:null, hasSig:!!document.querySelector("#overlayBox button[title='사용 후 다음 피격 피해 +15%']"), text:ht.slice(0,400)};
})()`;
/* 실제 사용자 흐름: 결정타 버튼을 DOM 클릭 → 메시지 재생(0.6s 간격) 뒤 전투 이력·HP 확인 */
const CLICK_SIG=`(()=>{ const b=document.querySelector("#overlayBox button[title='사용 후 다음 피격 피해 +15%']"); if(!b||b.disabled) return "no-btn"; b.click(); return "clicked"; })()`;
const AFTER_SIG=`(()=>{
  const B=S.battle; if(!B) return {err:"battle-ended"};
  const log=B.blog.slice(-10); // 결정타 이후 AI 응수까지 재생됐을 수 있으므로 반동 표식은 live 플래그가 아니라 이력 문구로 본다
  return {hpD:B.fd.hp, vuln:log.some(l=>/자세가 무너졌다/.test(l)), dispHpD:B.dispHpD, hpTxt:(document.getElementById("hptxt-D")||{}).textContent||null,
    hit:log.find(l=>/피해!/.test(l))||null, log};
})()`;
/* 도표 배경으로 표기 범위 화면을 함께 남기려고 캡처 순서: 로스터 팝업 → 전투 커맨드(분산 0.2 표기) → 결정타 클릭 후 */
const SHOW_RANGES=`(()=>{ BAL.dmgVar=0.2; battleModal(); return [...document.querySelectorAll("#overlayBox .row button")].map(b=>b.textContent.trim()).filter(t=>/~/.test(t)); })()`;
const RESET_VAR0=`(()=>{ BAL.dmgVar=0; battleModal(); return BAL.dmgVar; })()`;

function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i95cdp-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--allow-file-access-from-files","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map(); this.waiters=[]; this.console=[];
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
      if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); }
      else if(m.method){ if(m.method==="Runtime.exceptionThrown") this.console.push("exception "+JSON.stringify(m.params.exceptionDetails&&m.params.exceptionDetails.text));
        if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error") this.console.push("console.error "+JSON.stringify((m.params.args||[]).map(a=>a.value||a.description)));
        const w=this.waiters.find(x=>x.method===m.method&&(!x.sid||x.sid===m.sessionId)); if(w){ this.waiters.splice(this.waiters.indexOf(w),1); w.res(m.params); } } }; }
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
  once(method,sid){ return new Promise(res=>this.waiters.push({method,sid,res})); }
}
function connect(url){ return new Promise((res,rej)=>{ const ws=new WebSocket(url); ws.onopen=()=>res(new CDP(ws)); ws.onerror=()=>rej(new Error("WS 오류 "+url)); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function startServer(){ // 기존 사용자 서버(8080)는 건드리지 않는다 — PORT=0 임의 포트 전용 서버
  return new Promise((res,rej)=>{
    const p=spawn(process.execPath,[path.join(ROOT,"server","server.js")],{env:Object.assign({},process.env,{PORT:"0"}),stdio:["ignore","pipe","pipe"]});
    let out=""; const t=setTimeout(()=>{ try{p.kill();}catch(e){} rej(new Error("서버 기동 대기 시간 초과\n"+out)); },15000);
    const onData=d=>{ out+=d; const m=out.match(/listening on ([\d.]+):(\d+)/); if(m){ clearTimeout(t); res({proc:p,host:m[1],port:Number(m[2])}); } };
    p.stdout.on("data",onData); p.stderr.on("data",onData);
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("서버 종료 "+c+"\n"+out)); });
  });
}

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  let server=null, httpError=null;
  if(USE_HTTP){ try{ server=await startServer(); }catch(e){ httpError=e.message; } }
  const schemes=[{name:"file",url:FILE_URL}];
  if(server) schemes.push({name:"http",url:`http://127.0.0.1:${server.port}/index.html`});
  const {proc,ws,udd}=await launch();
  console.log(`RESOURCE chrome pid=${proc.pid} profile=${udd}`);
  if(server) console.log(`RESOURCE qa-server pid=${server.proc.pid} addr=${server.host}:${server.port}`);
  const report=[], shots=[]; let bad=0;
  const note=(scheme,what,r)=>{ report.push(Object.assign({scheme,what},r)); if(r.error||(r.issues&&r.issues.length)) bad++; };
  if(USE_HTTP&&!server){ note("http","server",{error:"필수 HTTP 검증 불가: "+(httpError||"서버 미기동")+" (file 단독은 --no-http 명시)",issues:[]}); }
  try{
    const cdp=await connect(ws);
    const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
    const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
    await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid);
    const ev=async expr=>(await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true},sid)).result.value;
    const shot=async name=>{ if(READ_ONLY) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
      const f=path.join(OUT,name+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); shots.push(path.relative(ROOT,f).replace(/\\/g,"/")); };
    for(const sc of schemes){
      const tag=`${sc.name}_${VP.name}`;
      cdp.console.length=0;
      await cdp.send("Emulation.setDeviceMetricsOverride",{width:VP.w,height:VP.h,deviceScaleFactor:VP.dpr,mobile:false},sid);
      const loaded=cdp.once("Page.loadEventFired",sid);
      await cdp.send("Page.navigate",{url:sc.url},sid); await loaded; await sleep(250);
      const phase=await ev(SETUP);
      // 1) 로스터 설명창
      const ro=await ev(OPEN_ROSTER); await sleep(300); await shot(`${tag}_1-roster-M-F2`);
      { const issues=[]; for(const s of EXP.roster) if(ro.text.indexOf(s)<0) issues.push("설명창 누락: "+s);
        for(const s of EXP.old) if(ro.text.indexOf(s)>=0) issues.push("설명창 옛 값 잔재: "+s);
        if(!ro.art) issues.push("설명창 일러스트(fire_atk) 미연결");
        note(sc.name,"roster",{phase,text:ro.text.slice(0,300),issues}); }
      await ev(CLOSE); await sleep(100);
      // 2) 실제 전투 진입 → 커맨드 버튼 표기 (분산 0.2 표기)
      const st=await ev(START_BATTLE);
      if(st.err){ note(sc.name,"battle",{error:st.err,issues:[]}); continue; }
      const ranges=await ev(SHOW_RANGES); await sleep(200); await shot(`${tag}_2-battle-commands`);
      const ui=await ev(READ_BATTLE_UI);
      { const issues=[]; for(const s of EXP.battle) if(!ui.btns.some(b=>b.indexOf(s)>=0)) issues.push("커맨드 누락: "+s);
        for(const s of EXP.old) if(ui.btns.some(b=>b.indexOf(s)>=0)) issues.push("커맨드 옛 값 잔재: "+s);
        if(!ui.hasSig) issues.push("결정타 버튼(title) 없음"); if(st.side!=="A") issues.push("R1 선공이 공격측이 아님 "+st.side);
        note(sc.name,"battle",{me:st.me,op:st.op,opHp:st.opHp+"/"+st.opMax,btns:ui.btns,ranges,hpD:ui.hpD,issues}); }
      // 3) 결정타 실제 클릭 (분산 0) → 45 피해 · 상대 HP -45 · 반동 표식
      await ev(RESET_VAR0); await sleep(150);
      const clicked=await ev(CLICK_SIG); await sleep(3200); // 메시지 재생 0.6s × (행동·피해·반동 …) 대기
      const af=await ev(AFTER_SIG); await shot(`${tag}_3-after-sig-click`);
      { const issues=[]; if(clicked!=="clicked") issues.push("결정타 클릭 실패 "+clicked);
        if(af.err) issues.push(af.err);
        else { if(af.hpD!==st.opHp-45) issues.push(`결정타 피해 불일치 hp ${st.opHp}→${af.hpD} (기대 -45)`);
          if(!/^45 피해!/.test(af.hit||"")) issues.push("이력에 '45 피해!' 없음: "+af.hit);
          if(af.vuln!==true) issues.push("결정타 반동 문구 없음"); }
        note(sc.name,"sig-click",{clicked,hpD:af.hpD,hpTxt:af.hpTxt,dispHpD:af.dispHpD,hit:af.hit,vuln:af.vuln,log:af.log,issues}); }
      const errs=cdp.console.filter(x=>!/favicon/.test(x));
      note(sc.name,"console",{errors:errs,issues:errs.length?["콘솔 오류 "+errs.length+"건"]:[]});
    }
  } finally {
    try{proc.kill();}catch(e){}
    if(server) try{server.proc.kill();}catch(e){}
    const uddAbs=path.resolve(udd), tmpAbs=path.resolve(os.tmpdir());
    const safe=path.dirname(uddAbs)===tmpAbs&&/^i95cdp-[A-Za-z0-9]+$/.test(path.basename(uddAbs));
    let removed=false;
    if(safe) for(let i=0;i<10;i++){ try{ fs.rmSync(uddAbs,{recursive:true,force:true}); }catch(e){} removed=!fs.existsSync(uddAbs); if(removed) break; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150); }
    console.log(`CLEANUP chrome pid=${proc.pid} profile=${uddAbs} guard=${safe} removed=${removed}`+(server?` qa-server pid=${server.proc.pid}`:""));
  }
  const payload={html:path.relative(ROOT,HTML).replace(/\\/g,"/"),viewport:VP,schemes:schemes.map(s=>s.name),expected:EXP,shots,report,generated:new Date().toISOString()};
  const reportFile=path.join(OUT,"issue95_cdp_report.json");
  if(READ_ONLY) console.log("\n--- READ_ONLY: 검증 산출물 0 (스크린샷·JSON 없음). 측정 원본 JSON ---\n"+JSON.stringify(payload));
  else fs.writeFileSync(reportFile,JSON.stringify(payload,null,1));
  for(const r of report){
    const s=r.what==="roster"?`text="${(r.text||"").slice(0,160)}…"`:r.what==="battle"?`${r.me} vs ${r.op} (HP ${r.opHp}) btns=[${(r.btns||[]).join(" | ")}]`
      :r.what==="sig-click"?`hp→${r.hpD} (표시 ${r.hpTxt}) hit="${r.hit}" vuln=${r.vuln}`:r.what==="console"?`errors=${(r.errors||[]).length}`:"";
    console.log(`  ${r.scheme.padEnd(4)} ${r.what.padEnd(9)}: ${s}${r.issues&&r.issues.length?"  ISSUES: "+r.issues.join(" | "):""}${r.error?"  ERROR "+r.error:""}`);
  }
  console.log(`\n=== issue95_cdp: ${report.length} 측정 · 문제 ${bad}건 · 스킴 [${schemes.map(x=>x.name).join(",")}]`+(READ_ONLY?" · READ_ONLY(산출물 0)":` · 스크린샷 ${shots.length}장 · 보고서 ${path.relative(ROOT,reportFile).replace(/\\/g,"/")}`));
  process.exit(bad?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
