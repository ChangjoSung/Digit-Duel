/* #96 감전 부여 확률 하향 — 실제 브라우저(헤드리스 Chrome · CDP) 좁은 실측 + 스크린샷 (file:// · desktop-1280 만)
   사용: node demo/test/issue96_cdp.js [--html <index.html>] [--out <dir>] [--chrome <chrome.exe>] [--no-shots] [--read-only]
   --read-only: Saturn 독립 재검증용. 검증 산출물 0 — 스크린샷·보고서 JSON 을 만들지 않고 stdout 으로만 보고한다.
                헤드리스 Chrome 임시 프로필(os.tmpdir()/shock96cdp-*)만 부수 생성되며 이 실행이 mkdtemp 로 만든 정확한 경로 하나만 종료 시 정리한다.
   장면 4개 (작은 상수·분기 변경이라 표기와 실제 사용자 흐름만 좁게 본다):
     1-roster-info : 로스터 정보 팝업(M-L1 스파크) — 감전 침 설명 "50% 확률 감전(후공 1회)"
     2-battle-cmd  : PVE 전투 커맨드 — 감전 침 버튼 title "50% 확률 감전(후공 1회)" · 페이지 안 BAL.shockProb 0.5 · statusProb 0.7
     3-shock-apply : 실제 버튼 경로(__act(1) → netAction → execSlot)로 감전 침 사용, 감전 성공 시드 → 로그 "감전 — 다음 1라운드 후공!" · 상태 "⚡감전1R"
     4-shock-fail  : 같은 경로, 실패 시드 → 로그 "상태이상 부여 실패!" · 감전 없음
   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 없음. 종료 코드 1 = 실측 문제 발견. issue91_cdp.js 의 기동·측정 골격을 재사용한다. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","qa","issue96")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(opt("--html",path.join(__dirname,"..","index.html")));
const FILE_URL="file:///"+HTML.replace(/\\/g,"/");
const VP={name:"desktop-1280", w:1280,h:800, dpr:1};
const DESC="50% 확률 감전(후공 1회)";

/* ── 페이지 안에서 도는 스크립트 ─────────────────────────────────────────── */
const PREP=`(()=>{ try{ localStorage.setItem("tutorialSeen","1"); }catch(e){} if(typeof tutClose==="function") try{ tutClose(); }catch(e){} return true; })()`;
const CONSTS=`(()=>({shockProb:BAL.shockProb,statusProb:BAL.statusProb,desc:SKILLS.lightning_effect.desc,fireDesc:SKILLS.fire_effect.desc,waterDesc:SKILLS.water_effect.desc,sigDesc:SKILLS.sig_sustain.desc,has70:/70% 확률 감전/.test(document.documentElement.outerHTML)}))()`;
const SCENE_ROSTER=`(()=>{ newGame("pve",{aiLevel:"grade5"}); rosterInfo("M-L1"); const t=document.getElementById("overlayBox").innerText;
  return {text:t.slice(0,600),hasName:/스파크/.test(t),hasSkill:/감전 침/.test(t),has50:t.indexOf(${JSON.stringify(DESC)})>=0,has70:/70% 확률 감전/.test(t),hidden:document.getElementById("overlay").classList.contains("hidden")}; })()`;
/* PVE: 내 표준형 번개(M-L1) 하수인 vs 상대 표준형 풀(M-G1) 하수인 — 인접 배치 후 전투 개시 (하수인끼리라 출전 선택 없음) */
const GIVE=`const give=(m,r)=>{ m.rosterId=r.id; m.name=r.name; m.element=r.element; m.hp=r.hp; m.maxHp=r.hp; m.atk=r.atk; m.skillAtk=r.skill; m.cdMax=r.cd; m.skills=archSkills(r.arch,r.element); m.cds=[0,0,0,0]; m.revealedSkills=[]; };
  const adjacent=(a,b)=>{ const occ=S.pieces.find(x=>x.placed&&x.alive&&x.r===a.r-1&&x.c===a.c&&x.id!==b.id); if(occ) occ.placed=false; b.r=a.r-1; b.c=a.c; b.placed=true; b.alive=true; };`;
const SCENE_BATTLE=`(()=>{ ${GIVE}
  try{ close(); }catch(e){}
  setSeed(9696); newGame("pve",{aiLevel:"grade5"}); aiAutoPlace(0); aiAutoPlace(1);
  S.phase="play"; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.movedPiece=null; S.contactSet=[]; S.forcedTargets=[]; S.forcedQueue=[];
  const me=S.pieces.find(x=>x.owner===0&&x.type==="minion"), op=S.pieces.find(x=>x.owner===1&&x.type==="minion");
  if(!me||!op) return {error:"no-pieces"};
  give(me,ROSTER.find(r=>r.id==="M-L1")); give(op,ROSTER.find(r=>r.id==="M-G1"));
  adjacent(me,op); op.revealed=false; S.selected=null; render();
  window.__96={me,op};
  initBattle(me,op);
  const B=S.battle; if(!B) return {error:"no-battle"};
  const btns=[...document.querySelectorAll("#overlayBox button")].map(b=>({text:b.textContent.trim(),title:b.title,disabled:b.disabled}));
  const shock=btns.find(b=>/^감전 침/.test(b.text));
  return {fa:B.fa.rosterId,fd:B.fd.rosterId,round:B.round,phase:B.phase,btns,shockBtn:shock||null,
    titleOk:!!shock&&shock.title===${JSON.stringify(DESC)},has70:btns.some(b=>/70% 확률 감전/.test(b.title)),
    fireTitle:btns.find(b=>/70% 확률 화상/.test(b.title))?true:false,stageText:(document.getElementById("bstage")||{}).innerText||""}; })()`;
/* 감전 성공/실패 시드: 감전 침(슬롯1) 은 분산 난수 1회 뒤 감전 판정 난수 1회를 소비하므로 시드의 두 번째 rand() 만으로 결과가 정해진다.
   전투를 돌려 찾지 않는 이유 — execSlot 은 전역 메시지 큐(MSGQ)에 재생을 쌓고 0.6초 간격으로 DOM(상태 아이콘·HP)을 갱신하므로, 탐색 중 만든 전투의 재생이 실측 장면을 오염시킨다. */
const SCENE_ACT=want=>`(()=>{ const {me,op}=window.__96||{}; if(!me||!op) return {error:"no-__96"};
  let seed=-1; for(let s=1;s<200;s++){ setSeed(s); rand(); if((rand()<BAL.shockProb)===${want}){ seed=s; break; } }
  if(seed<0) return {error:"no-seed"};
  S.battle=null; S.battlesUsed=0; me.hp=me.maxHp; op.hp=op.maxHp; me.cds=[0,0,0,0]; op.cds=[0,0,0,0];
  try{ close(); }catch(e){} startRounds(me,op,me,op); setSeed(seed);
  return {seed,shockBefore:op.shock,hpD:op.hp,blog:S.battle.blog.length}; })()`;
const PLAYING=`(()=>typeof MSGPLAYING==="undefined"?null:MSGPLAYING)()`;
const CLICK_SHOCK=`(()=>{ const btn=[...document.querySelectorAll("#overlayBox button")].find(b=>/^감전 침/.test(b.textContent.trim()));
  if(!btn||btn.disabled) return {error:"no-shock-button"}; const before={blog:S.battle.blog.length,hpD:window.__96.op.hp,st:(document.getElementById("bst-D")||{}).textContent||""};
  btn.click(); /* onclick="window.__act(1)" → netAction → __actCore(1) → execSlot("A",1) */ return {before,clickedVia:btn.getAttribute("onclick")}; })()`;
const MEASURE_ACT=`(()=>{ const B=S.battle, {me,op}=window.__96||{}; if(!B) return {error:"no battle after act"};
  const t=document.getElementById("overlayBox").innerText;
  return {blog:B.blog.slice(-6),opShock:op.shock,opFresh:op.shockFresh,hpD:op.hp,round:B.round,phase:B.phase,
    logShock:B.blog.some(l=>/감전 — 다음 1라운드 후공/.test(l)),logFail:B.blog.some(l=>l==="상태이상 부여 실패!"),
    uiShock:/⚡감전1R/.test(t),uiFailText:/상태이상 부여 실패/.test(t),uiShockText:/감전 — 다음 1라운드 후공/.test(t),queued:B.msgQ.length,text:t.slice(0,400)}; })()`;

/* ── Chrome 기동 · CDP (issue91_cdp.js 와 같은 방식) ─────────────────────── */
function launch(){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"shock96cdp-"));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--allow-file-access-from-files","--lang=ko-KR","about:blank"],{stdio:["ignore","pipe","pipe"]});
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map(); this.waiters=[];
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data);
      if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); }
      else if(m.method){ const w=this.waiters.find(x=>x.method===m.method&&(!x.sid||x.sid===m.sessionId)); if(w){ this.waiters.splice(this.waiters.indexOf(w),1); w.res(m.params); } } }; }
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
  once(method,sid){ return new Promise(res=>this.waiters.push({method,sid,res})); }
}
function connect(url){ return new Promise((res,rej)=>{ const ws=new WebSocket(url); ws.onopen=()=>res(new CDP(ws)); ws.onerror=()=>rej(new Error("WS 오류 "+url)); }); }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const {proc,ws,udd}=await launch();
  console.log(`RESOURCE chrome pid=${proc.pid} profile=${udd}`);
  const report=[]; let bad=0; const shots=[];
  const note=(scene,r)=>{ report.push(Object.assign({scheme:"file",vp:VP.name,scene},r)); if(r.error||(r.issues&&r.issues.length)) bad++; };
  try{
    const cdp=await connect(ws);
    const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
    const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
    await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid); await cdp.send("Log.enable",{},sid);
    const consoleErrs=[]; const ws2=cdp.ws; const prevMsg=ws2.onmessage;
    ws2.onmessage=ev=>{ try{ const m=JSON.parse(ev.data); if(m.method==="Runtime.exceptionThrown") consoleErrs.push("exception: "+((m.params.exceptionDetails.exception||{}).description||m.params.exceptionDetails.text||"").slice(0,200));
      else if(m.method==="Runtime.consoleAPICalled"&&m.params.type==="error") consoleErrs.push("console.error: "+m.params.args.map(a=>a.value||a.description||"").join(" ").slice(0,200));
      else if(m.method==="Log.entryAdded"&&m.params.entry.level==="error") consoleErrs.push("log: "+(m.params.entry.text||"").slice(0,120)+" "+(m.params.entry.url||"")); }catch(e){} prevMsg(ev); };
    const takeErrs=()=>consoleErrs.splice(0);
    const ev=async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) return {error:"JS 예외: "+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)}; return r.result.value; };
    const shot=async name=>{ if(!SHOTS) return; const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},sid);
      const f=path.join(OUT,name+".png"); fs.writeFileSync(f,Buffer.from(data,"base64")); shots.push(path.relative(ROOT,f).replace(/\\/g,"/")); };
    await cdp.send("Emulation.setDeviceMetricsOverride",{width:VP.w,height:VP.h,deviceScaleFactor:VP.dpr,mobile:false},sid);
    const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url:FILE_URL},sid); await loaded; await sleep(300); await ev(PREP);
    const tag=`file_${VP.name}`;
    // 0) 페이지 안 상수
    const c=await ev(CONSTS); const issues0=[];
    if(c.error) issues0.push(c.error); else { if(c.shockProb!==0.5) issues0.push("BAL.shockProb "+c.shockProb+"≠0.5"); if(c.statusProb!==0.7) issues0.push("BAL.statusProb "+c.statusProb+"≠0.7");
      if(c.desc!==DESC) issues0.push("desc '"+c.desc+"'"); if(c.has70) issues0.push("페이지 소스에 '70% 확률 감전' 잔존"); if(c.fireDesc!=="70% 확률 화상 2R"||c.waterDesc!=="70% 확률 약화 2회") issues0.push("화상·약화 desc 변경됨"); }
    note("0-consts",Object.assign({},c,{issues:issues0,consoleErrors:takeErrs()}));
    // 1) 로스터 정보 팝업
    const s1=await ev(SCENE_ROSTER); const i1=[];
    if(s1.error) i1.push(s1.error); else { if(!s1.hasName||!s1.hasSkill) i1.push("팝업에 스파크/감전 침 없음"); if(!s1.has50) i1.push("팝업에 '"+DESC+"' 없음"); if(s1.has70) i1.push("팝업에 70% 감전 잔존"); if(s1.hidden) i1.push("overlay hidden"); }
    { const e=takeErrs(); if(e.length) i1.push("콘솔 오류 "+e.length+"건: "+e.join(" || ")); note("1-roster-info",Object.assign({},s1,{issues:i1,consoleErrors:e})); }
    await shot(`${tag}_1-roster-info`);
    // 2) 전투 커맨드 title
    const s2=await ev(SCENE_BATTLE); const i2=[];
    if(s2.error) i2.push(s2.error); else { if(!(s2.fa==="M-L1"&&s2.fd==="M-G1"&&s2.round===1&&s2.phase===0)) i2.push("전투 구성 불일치 "+JSON.stringify({fa:s2.fa,fd:s2.fd,round:s2.round,phase:s2.phase}));
      if(!s2.shockBtn) i2.push("감전 침 버튼 없음"); else if(!s2.titleOk) i2.push("감전 침 title '"+s2.shockBtn.title+"' ≠ '"+DESC+"'"); if(s2.has70) i2.push("버튼 title 에 70% 감전 잔존"); }
    { const e=takeErrs(); if(e.length) i2.push("콘솔 오류 "+e.length+"건: "+e.join(" || ")); note("2-battle-cmd",Object.assign({},s2,{issues:i2,consoleErrors:e})); }
    await shot(`${tag}_2-battle-cmd`);
    // 3) 실제 버튼 경로로 감전 침 사용 — 성공 시드
    for(const [want,scene] of [[true,"3-shock-apply"],[false,"4-shock-fail"]]){
      let a=await ev(SCENE_ACT(want)); const iss=[]; let m=null;
      if(!a.error){ let waited=0; while(waited<4000&&(await ev(PLAYING))===true){ await sleep(200); waited+=200; } // 앞 장면의 메시지 재생이 끝난 뒤 클릭
        const c=await ev(CLICK_SHOCK); a=Object.assign({},a,c); if(c.error) a.error=c.error; }
      if(a.error) iss.push(a.error); else { await sleep(3200); m=await ev(MEASURE_ACT);
        if(m.error) iss.push(m.error); else {
          if(!/__act\(1\)/.test(a.clickedVia||"")) iss.push("버튼이 __act(1) 경로가 아님: "+a.clickedVia);
          if(m.hpD>=a.before.hpD) iss.push("피해가 들어가지 않음");
          if(want){ if(!(m.opShock===1&&m.logShock&&m.uiShock)) iss.push("감전 성공 장면 불일치 "+JSON.stringify({opShock:m.opShock,logShock:m.logShock,uiShock:m.uiShock})); if(m.logFail) iss.push("성공인데 실패 로그"); }
          else { if(!(m.opShock===0&&m.logFail&&!m.logShock)) iss.push("감전 실패 장면 불일치 "+JSON.stringify({opShock:m.opShock,logFail:m.logFail,logShock:m.logShock})); if(m.uiShock) iss.push("실패인데 상태 아이콘 감전"); }
          if(m.queued) iss.push("메시지 재생 미완료 "+m.queued); } }
      { const e=takeErrs(); if(e.length) iss.push("콘솔 오류 "+e.length+"건: "+e.join(" || ")); note(scene,Object.assign({act:a},m||{},{issues:iss,consoleErrors:e})); }
      await shot(`${tag}_${scene}`);
    }
  } finally {
    try{proc.kill();}catch(e){}
    const uddAbs=path.resolve(udd), tmpAbs=path.resolve(os.tmpdir());
    const safe=path.dirname(uddAbs)===tmpAbs&&/^shock96cdp-[A-Za-z0-9]+$/.test(path.basename(uddAbs));
    let removed=false;
    if(safe) for(let i=0;i<10;i++){ try{ fs.rmSync(uddAbs,{recursive:true,force:true}); }catch(e){} removed=!fs.existsSync(uddAbs); if(removed) break; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150); }
    console.log(`CLEANUP chrome pid=${proc.pid} killed=${proc.killed||proc.exitCode!==null} profile=${uddAbs} guard=${safe} removed=${removed}`);
  }
  const payload={html:path.relative(ROOT,HTML).replace(/\\/g,"/"),schemes:["file"],viewports:[VP],shots,report};
  const reportFile=path.join(OUT,"issue96_cdp_report.json");
  if(READ_ONLY) console.log("\n--- READ_ONLY: 검증 산출물 0 (스크린샷·보고서 JSON 없음). 측정 원본 JSON ---\n"+JSON.stringify(payload));
  else fs.writeFileSync(reportFile,JSON.stringify(payload,null,1));
  for(const r of report){
    const brief=r.scene==="0-consts"?`shockProb=${r.shockProb} statusProb=${r.statusProb} desc=${JSON.stringify(r.desc)}`
      :r.scene==="1-roster-info"?`has50=${r.has50} has70=${r.has70}`
      :r.scene==="2-battle-cmd"?`fa=${r.fa} fd=${r.fd} shockBtn=${JSON.stringify(r.shockBtn)}`
      :`seed=${r.act&&r.act.seed} opShock=${r.opShock} logShock=${r.logShock} logFail=${r.logFail} uiShock=${r.uiShock} hpD=${r.act&&r.act.before?r.act.before.hpD+"→"+r.hpD:"-"} via=${r.act&&r.act.clickedVia}`;
    console.log(`== ${r.scheme} ${r.vp} ${r.scene}: ${brief} consoleErrors=${(r.consoleErrors||[]).length}${r.issues&&r.issues.length?"  ISSUES: "+r.issues.join(" | "):""}${r.error?"  ERROR "+r.error:""}`);
  }
  console.log(`\n=== issue96_cdp: ${report.length} 측정 · 문제 ${bad}건 · file:// ${VP.name}`+(READ_ONLY?` · READ_ONLY(검증 산출물 0 · 임시 프로필 ${udd} 부수 생성·정리)`:` · 스크린샷 ${shots.length}장 · 보고서 ${path.relative(ROOT,reportFile).replace(/\\/g,"/")}`));
  process.exit(bad?1:0);
})().catch(e=>{ console.error(e); process.exit(2); });
