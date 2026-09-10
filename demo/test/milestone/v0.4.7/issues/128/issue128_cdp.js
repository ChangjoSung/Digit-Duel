/* #128 튜토리얼 노출 정책 — 문서 로드당 1회 · 실제 브라우저 증빙 (헤드리스 Chrome · CDP · 실제 마우스 클릭)

   사용: node demo/test/milestone/v0.4.7/issues/128/issue128_cdp.js
           [--out <dir>] [--chrome <chrome.exe>] [--read-only] [--no-shots] [--port <n>]

   무엇을 보는가 (헤드리스 하네스가 볼 수 없는 것만 — 실제 문서 로드 경계):
     1. 저장키 있음 → 새 접속 표시 — 프로필에 tutorialSeen="1" 과 netServer 를 **미리 심어 두고** 같은
        origin 에 접속해, 그래도 1단계부터 자동으로 뜨는지 본다. 옛 정책에서는 여기서 뜨지 않았다.
     2. 닫힘 → 새로고침 표시 — 실제 [건너뛰기] 버튼을 마우스로 눌러 닫고, Page.reload 로 진짜 새로고침한 뒤
        다시 1단계부터 뜨는지 본다.
     3. 새 탭 표시 — 같은 프로필·같은 origin 을 **새 탭**으로 열어 또 뜨는지 본다.
     4. 같은 페이지 무재표시 — 그 탭에서 모드 선택·새 게임·모드 변경을 실제로 조작해도 다시 뜨지 않는지 본다.
     5. 수동 재보기·정상 진행 — 헤더 '?' 버튼을 실제로 눌러 다시 열고, [다음]/[이전] 으로 단계가 움직이며
        Esc 로 닫히는지 본다. 10단계 강제 완주가 아님도 함께 본다(1단계에서 건너뛰기 한 번으로 닫힌다).
     6. 두 번째 독립 프로필 — 서로 다른 user-data-dir 로 같은 origin 을 열어 양쪽 모두 뜨는지 본다.
        (새 정책에서는 프로필이 무엇을 갖고 있든 결과가 같다 — 저장값을 아예 읽지 않기 때문이다.)
     7. 서버 재시작 후 새 접속 — 검증용 서버를 닫고 **같은 포트**로 다시 띄운 뒤 새 페이지를 열어 뜨는지 본다.
     8. 저장값 보존 — 위 과정을 전부 마친 뒤에도 tutorialSeen 과 netServer 가 심어 둔 값 그대로인지,
        튜토리얼이 어떤 키도 새로 쓰거나 지우지 않았는지 프로필 저장소를 직접 읽어 본다.

   한계 (명시):
     · 6번은 **같은 머신의 독립 Chrome 프로필 두 개**다. 물리적으로 다른 두 PC 로 같은 서버에 접속한
       종단간 검증이 아니다. 초기 #128 의 '두 PC 가 seen 을 공유한다' 신고는 이 도구로도 재현하지 않았고,
       미재현 이력은 그대로 남는다 — 다만 새 정책에서는 제품이 저장값을 읽지 않으므로 그 질문 자체가
       구조적으로 사라졌다(1번·8번이 그 근거다).
     · 7번의 '서버 재시작'은 같은 포트를 다시 bind 하는 것이지 LAN 상의 다른 호스트 재부팅이 아니다.
       같은 포트를 다시 잡지 못하면 새 임의 포트로 진행하고 그 사실을 LIMIT 로 남긴다.
     · BFCache 복원은 헤드리스 단일 탭에서 신뢰성 있게 유도할 수 없어 이 도구가 주장하지 않는다.
       (같은 문서에서 스크립트가 다시 돌지 않는다는 것은 4번의 조작 무재표시로만 확인한다.)

   소스: **현재 작업 트리**의 demo/index.html 을 로컬 HTTP(127.0.0.1)로 서빙한다. localStorage 는 file:
     스킴에서 origin 이 브라우저마다 달라 계약을 확인할 수 없다. 어떤 바이트를 봤는지 증명하려고
     git blob hash(sha1 · CRLF→LF 정규화 후 = 커밋되는 바이트)와 파일 sha256 을 남긴다.

   --read-only: Saturn 독립 재검증용 — 산출물 0건(스크린샷·JSON 없음), stdout 만.

   RESOURCE/CLEANUP: 이 실행이 만든 것만 정리한다 — 자기가 spawn 한 Chrome 프로세스(PID 기록)와
     자기가 mkdtemp 로 만든 임시 프로필 디렉터리(정확한 절대경로 기록), 자기가 listen 한 검증용 HTTP
     서버뿐이다. 사용자가 이미 띄워 둔 브라우저·서버는 찾지도, 종료하지도 않는다. 삭제는 기록해 둔
     정확한 경로 목록에 대해서만 하고 glob·접두사 검색을 쓰지 않는다.

   의존: Node 22+(내장 WebSocket) + 로컬 Chrome. 외부 패키지 0. 종료 코드 1 = 판정 실패, 2 = 환경 오류. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), http=require("http"), crypto=require("crypto"), {spawn}=require("child_process");
const args=process.argv.slice(2);
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(ROOT,"docs","milestone","v0.4.7","issues","128","Mars","artifacts")));
const READ_ONLY=args.includes("--read-only")||args.includes("--no-write");
const SHOTS=!args.includes("--no-shots")&&!READ_ONLY;
const WANT_PORT=Number(opt("--port",0))||0;
const CHROME=opt("--chrome",[process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const HTML=path.resolve(path.join(ROOT,"demo","index.html"));
const VP={width:1280,height:1000};

function blobHashNormalized(file){ const raw=fs.readFileSync(file);
  const b=Buffer.from(raw.toString("utf8").replace(/\r\n/g,"\n"),"utf8");
  return crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0","utf8"),b])).digest("hex"); }
function sha256(file){ return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }

let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond){pass++; console.log("PASS "+name);} else {fail++; fails.push(name); console.error("FAIL "+name);} }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const rel=f=>path.relative(ROOT,f).replace(/\\/g,"/");

/* ── 이 실행이 소유한 자원만 기록·정리 (정확한 절대경로·PID 목록 · glob 금지) ── */
const OWNED={procs:[],dirs:[],servers:[]};
/* Windows 는 Chrome 이 완전히 끝나기 전에는 프로필 디렉터리를 잠가 둔다 — 죽이고 **종료를 기다린 뒤** 지운다.
   지우는 대상은 이 실행이 mkdtemp 로 만들어 OWNED.dirs 에 넣어 둔 정확한 절대경로뿐이다 (glob·접두사 검색 없음).
   그래도 남는 것이 있으면 숨기지 않고 LEFTOVER 로 보고한다. */
async function cleanup(){
  for(const p of OWNED.procs){ try{ if(p&&p.pid&&p.exitCode===null) process.kill(p.pid); }catch(e){} }
  await Promise.all(OWNED.procs.map(p=>new Promise(r=>{
    if(!p||p.exitCode!==null) return r();
    const t=setTimeout(r,8000); p.once("exit",()=>{ clearTimeout(t); r(); }); })));
  for(const s of OWNED.servers){ try{ s.close(); }catch(e){} }
  const left=[];
  for(const d of OWNED.dirs){
    let gone=false;
    for(let i=0;i<12&&!gone;i++){
      try{ fs.rmSync(d,{recursive:true,force:true,maxRetries:5,retryDelay:200}); }catch(e){}
      gone=!fs.existsSync(d);
      if(!gone) await sleep(300);
    }
    if(!gone) left.push(d);
  }
  if(left.length) console.error("LEFTOVER 임시 프로필을 지우지 못했습니다 (직접 지워 주세요): "+JSON.stringify(left));
  return left;
}
const BOUND=[]; // 이 실행이 listen 한 검증 서버 주소 전부 (닫은 것 포함)
function ownership(){ return {chromePids:OWNED.procs.map(p=>p.pid),profileDirs:OWNED.dirs.slice(),servers:BOUND.slice()}; }

function launch(tag){
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i128cdp-"+tag+"-")); // 정확한 반환 절대경로만 보존한다
    OWNED.dirs.push(udd);
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run",
      "--no-default-browser-check","--disable-gpu","--hide-scrollbars","--lang=ko-KR",
      "--disable-background-timer-throttling","--disable-renderer-backgrounding","about:blank"],{stdio:["ignore","pipe","pipe"]});
    OWNED.procs.push(p);
    let err=""; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map();
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id);
      if(m.error) rej(new Error(m.method+" "+JSON.stringify(m.error))); else res(m.result); } }; }
  send(method,params,sessionId){ const id=++this.id;
    return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
}
async function connect(L){ const cdp=new CDP(new WebSocket(L.ws));
  await new Promise(r=>{ const t=setInterval(()=>{ if(cdp.ws.readyState===1){clearInterval(t);r();} },30); });
  return cdp; }
async function openTab(cdp,url){
  const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});
  const {sessionId:S}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
  await cdp.send("Page.enable",{},S); await cdp.send("Runtime.enable",{},S);
  await cdp.send("Emulation.setDeviceMetricsOverride",{width:VP.width,height:VP.height,deviceScaleFactor:1,mobile:false},S);
  await cdp.send("Page.navigate",{url},S);
  await sleep(900);
  const ev=async expr=>{ const r=await cdp.send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},S);
    if(r.exceptionDetails) throw new Error("page error: "+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)+"\nEXPR: "+expr.slice(0,300));
    return r.result.value; };
  const shot=async name=>{ if(!SHOTS) return null;
    const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},S);
    const f=path.join(OUT,name); fs.writeFileSync(f,Buffer.from(data,"base64")); return rel(f); };
  const nav=async u=>{ await cdp.send("Page.navigate",{url:u},S); await sleep(900); };
  const reload=async ()=>{ await cdp.send("Page.reload",{ignoreCache:false},S); await sleep(900); };
  const clickPt=async box=>{ if(!box) return false;
    await cdp.send("Input.dispatchMouseEvent",{type:"mousePressed",x:box.x,y:box.y,button:"left",clickCount:1},S);
    await cdp.send("Input.dispatchMouseEvent",{type:"mouseReleased",x:box.x,y:box.y,button:"left",clickCount:1},S);
    await sleep(180); return true; };
  const clickSel=async sel=>clickPt(await ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return r.width?{x:r.left+r.width/2,y:r.top+r.height/2}:null;})()`));
  const clickText=async (txt,scope)=>clickPt(await ev(`(()=>{
      const root=document.querySelector(${JSON.stringify(scope||"body")}); if(!root) return null;
      const b=Array.prototype.slice.call(root.querySelectorAll("button"))
        .filter(x=>!x.disabled&&x.getBoundingClientRect().width>0)
        .reverse().find(x=>x.textContent.indexOf(${JSON.stringify(txt)})>=0);
      if(!b) return null; const r=b.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2};})()`));
  const key=async k=>{ await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key:k,code:k,windowsVirtualKeyCode:k==="Escape"?27:0},S);
    await cdp.send("Input.dispatchKeyEvent",{type:"keyUp",key:k,code:k,windowsVirtualKeyCode:k==="Escape"?27:0},S); await sleep(180); };
  const close=async ()=>{ try{ await cdp.send("Target.closeTarget",{targetId}); }catch(e){} };
  return {S,targetId,ev,shot,nav,reload,clickSel,clickText,clickPt,key,close};
}

/* ── 이 실행이 소유한 검증용 정적 HTTP 서버 (127.0.0.1) ── */
const MIME={".html":"text/html; charset=utf-8",".png":"image/png",".webp":"image/webp",".json":"application/json",".js":"text/javascript",".css":"text/css"};
function serveDemo(rootDir,port){ return new Promise((res,rej)=>{
  const s=http.createServer((q,r)=>{
    const u=decodeURIComponent(String(q.url).split("?")[0]);
    const f=path.join(rootDir,u==="/"?"index.html":u.replace(/^\/+/,""));
    if(!path.resolve(f).startsWith(path.resolve(rootDir))){ r.writeHead(403); r.end(); return; }
    fs.readFile(f,(e,b)=>{ if(e){ r.writeHead(404); r.end("404"); return; }
      r.writeHead(200,{"Content-Type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"}); r.end(b); });
  });
  s.on("error",rej);
  OWNED.servers.push(s);
  s.listen(port||0,"127.0.0.1",()=>{ const a=s.address(); BOUND.push(a.address+":"+a.port); res(s); }); }); }
function stopServer(s){ return new Promise(r=>{ const i=OWNED.servers.indexOf(s); if(i>=0) OWNED.servers.splice(i,1); s.close(()=>r()); }); }

/* 페이지 상태 관측 — 표시 여부·단계·저장소를 한 번에 (제품 심볼 부재도 그대로 보고한다) */
const PROBE=`(()=>{ let stored=null,net=null,keys=null,err=null;
  try{ stored=localStorage.getItem("tutorialSeen"); net=localStorage.getItem("netServer"); keys=Object.keys(localStorage).sort(); }catch(e){ err=String(e&&e.message); }
  const ov=document.getElementById("tutOverlay");
  const box=document.getElementById("tutBox");
  return {href:location.href, origin:location.origin,
    open:typeof TUT!=="undefined"?TUT.open:null, step:typeof TUT!=="undefined"?TUT.step:null,
    auto:typeof TUT!=="undefined"?TUT.auto:null, seenThisLoad:typeof TUT!=="undefined"?TUT.seenThisLoad:null,
    overlayHidden:!!(ov&&ov.classList.contains("hidden")),
    heading:box?String(box.textContent||"").replace(/\\s+/g," ").trim().slice(0,60):null,
    appInert:!!(document.getElementById("app")||{}).hasAttribute&&document.getElementById("app").hasAttribute("inert"),
    hasTutKey:typeof TUT_KEY!=="undefined", hasTutStore:typeof tutStore!=="undefined",
    stored, net, keys, storeErr:err, manualBtn:!!document.getElementById("tutBtn"), phase:typeof S!=="undefined"?S.phase:null}; })()`;

/* 프로필에 과거 저장값을 심는다 — 제품이 아니라 이 도구가 쓴다 (사용자 저장값이 남아 있는 상황의 재현) */
const SEED=`(()=>{ localStorage.setItem("tutorialSeen","1"); localStorage.setItem("netServer","192.168.0.77:8787");
  return Object.keys(localStorage).sort(); })()`;

(async()=>{
  if(!READ_ONLY) fs.mkdirSync(OUT,{recursive:true});
  const HASH=blobHashNormalized(HTML), SHA=sha256(HTML);
  console.log("SOURCE   "+rel(HTML)+"  blob sha1 "+HASH);
  console.log("SOURCE   sha256 "+SHA);
  console.log("CHROME   "+CHROME);
  const report={issue:"#128",tool:rel(__filename),source:rel(HTML),blobSha1:HASH,sha256:SHA,chrome:CHROME,
    when:new Date().toISOString(),viewport:VP,steps:[],limits:[],readOnly:READ_ONLY};
  const rec=(name,data)=>{ report.steps.push({name,data}); console.log("OBS      "+name+"  "+JSON.stringify(data)); };
  let srv=null;
  try{
    srv=await serveDemo(path.join(ROOT,"demo"),WANT_PORT);
    const port=srv.address().port, URL0="http://127.0.0.1:"+port+"/index.html";
    console.log("SERVER   "+URL0+"  (이 실행이 listen 한 검증 전용 서버)");
    report.url=URL0; report.port=port;

    const LA=await launch("A"), cA=await connect(LA);
    console.log("PROFILE  A  pid="+LA.proc.pid+"  user-data-dir="+LA.udd);

    /* ── 1. 저장키 있음 → 새 접속 표시 ─────────────────────────────────────── */
    const seedTab=await openTab(cA,URL0);
    const seeded=await seedTab.ev(SEED);
    rec("0 프로필 A 에 과거 저장값 심기",{keys:seeded});
    await seedTab.close();

    const P1=await openTab(cA,URL0); // 저장값이 이미 있는 상태의 '새 접속'
    const s1=await P1.ev(PROBE);
    rec("1 저장키 있음 → 새 접속",s1);
    ok(s1.stored==="1","1a 전제: 이 프로필에는 과거 tutorialSeen=1 이 실제로 남아 있다");
    ok(s1.open===true&&s1.step===0&&s1.auto===true&&s1.overlayHidden===false,
      "1b 그래도 1단계부터 자동으로 뜬다 (#128 새 정책 — 옛 정책에서는 뜨지 않았다)");
    ok(s1.hasTutKey===false&&s1.hasTutStore===false,"1c 제품에 튜토리얼 영구 저장 심볼(TUT_KEY·tutStore)이 없다");
    ok(s1.appInert===true,"1d 열린 동안 배경(#app)은 inert 로 빠진다 (기존 접근성 계약 유지)");
    report.shots=report.shots||{};
    report.shots.load1=await P1.shot("i128-01-load-with-legacy-key.png");

    /* ── 2. 닫힘 → 새로고침 표시 ──────────────────────────────────────────── */
    ok(await P1.clickText("건너뛰기","#tutOverlay"),"2a [건너뛰기] 버튼을 실제 마우스로 눌렀다");
    const s2=await P1.ev(PROBE);
    rec("2 건너뛰기 직후",s2);
    ok(s2.open===false&&s2.overlayHidden===true&&s2.seenThisLoad===true,"2b 한 번의 건너뛰기로 닫힌다 (10단계 강제 완주 없음)");
    ok(s2.stored==="1"&&s2.net==="192.168.0.77:8787","2c 닫혀도 저장값은 그대로다 (지우지도 덮어쓰지도 않는다)");
    report.shots.closed=await P1.shot("i128-02-closed-after-skip.png");
    await P1.reload(); // 진짜 새로고침
    const s3=await P1.ev(PROBE);
    rec("3 같은 탭 새로고침",s3);
    ok(s3.open===true&&s3.step===0&&s3.auto===true,"3a 새로고침하면 1단계부터 다시 뜬다");
    report.shots.reload=await P1.shot("i128-03-after-reload.png");

    /* ── 3. 새 탭 표시 ────────────────────────────────────────────────────── */
    const P2=await openTab(cA,URL0);
    const s4=await P2.ev(PROBE);
    rec("4 같은 프로필 새 탭",s4);
    ok(s4.open===true&&s4.step===0&&s4.auto===true,"4a 같은 프로필·같은 origin 을 새 탭으로 열어도 다시 뜬다");
    report.shots.newTab=await P2.shot("i128-04-new-tab.png");

    /* ── 4. 같은 페이지 안에서는 추가 표시 없음 ──────────────────────────────── */
    await P2.clickText("건너뛰기","#tutOverlay");
    const modes=await P2.ev(`(()=>{ const out=[];
      for(const m of ["pvp","pve","pvp"]){ startMode(m); out.push({mode:m,phase:S.phase,tutOpen:TUT.open}); }
      return out; })()`);
    rec("5 같은 페이지에서 모드 변경·새 게임",modes);
    ok(modes.every(x=>x.tutOpen===false),"5a 같은 문서에서 모드 변경·새 게임을 반복해도 다시 뜨지 않는다");
    const s5=await P2.ev(PROBE);
    ok(s5.open===false&&s5.seenThisLoad===true,"5b 그 탭의 seenThisLoad 는 계속 true (이번 로드에서 이미 봤음)");
    report.shots.sameTab=await P2.shot("i128-05-same-tab-mode-change.png");

    /* ── 5. 수동 재보기·정상 진행·Esc ───────────────────────────────────────── */
    ok(await P2.clickSel("#tutBtn"),"6a 헤더 '?' 버튼을 실제 마우스로 눌렀다");
    const s6=await P2.ev(PROBE);
    rec("6 수동 재보기",s6);
    ok(s6.open===true&&s6.step===0&&s6.auto===false,"6b 수동 재보기는 1단계부터 열리고 auto 가 아니다");
    await P2.clickText("다음","#tutOverlay"); await P2.clickText("다음","#tutOverlay");
    const s7=await P2.ev(PROBE);
    rec("7 [다음] 2회",s7);
    ok(s7.step===2&&s7.open===true,"6c [다음] 을 실제로 눌러 단계가 앞으로 간다 (step "+s7.step+")");
    await P2.clickText("이전","#tutOverlay");
    const s8=await P2.ev(PROBE);
    ok(s8.step===1,"6d [이전] 로 되돌아간다 (step "+s8.step+")");
    report.shots.manual=await P2.shot("i128-06-manual-reopen-step2.png");
    await P2.key("Escape");
    const s9=await P2.ev(PROBE);
    rec("8 Esc",s9);
    ok(s9.open===false&&s9.overlayHidden===true,"6e Esc 로 닫힌다");
    ok(s9.stored==="1"&&s9.net==="192.168.0.77:8787","6f 수동 조작 전 과정에서도 저장값 불변");

    /* ── 6. 두 번째 독립 프로필 ──────────────────────────────────────────── */
    const LB=await launch("B"), cB=await connect(LB);
    console.log("PROFILE  B  pid="+LB.proc.pid+"  user-data-dir="+LB.udd);
    const PB=await openTab(cB,URL0);
    const sb=await PB.ev(PROBE);
    rec("9 독립 프로필 B 최초 접속",sb);
    ok(sb.stored===null&&sb.keys&&sb.keys.length===0,"7a 전제: B 프로필의 저장소는 비어 있다 (A 와 독립)");
    ok(sb.open===true&&sb.step===0&&sb.auto===true,"7b B 도 1단계부터 자동으로 뜬다");
    await PB.clickText("건너뛰기","#tutOverlay");
    await PB.reload();
    const sb2=await PB.ev(PROBE);
    rec("10 B 새로고침",sb2);
    ok(sb2.open===true&&sb2.auto===true,"7c B 도 새로고침마다 다시 뜬다 (저장 프로필 내용과 무관하게 같은 결과)");
    ok(sb2.keys&&sb2.keys.length===0,"7d B 는 끝까지 저장소에 아무것도 쓰지 않았다 "+JSON.stringify(sb2.keys));
    report.shots.profileB=await PB.shot("i128-07-second-profile.png");

    /* ── 7. 서버 재시작 후 새 접속 (같은 포트 우선) ───────────────────────── */
    await stopServer(srv); srv=null;
    let port2=port, samePort=true, bindErr=null;
    try{ srv=await serveDemo(path.join(ROOT,"demo"),port); }
    catch(e){ bindErr=String(e&&e.message); samePort=false; srv=await serveDemo(path.join(ROOT,"demo"),0); port2=srv.address().port; }
    const URL2="http://127.0.0.1:"+port2+"/index.html";
    console.log("SERVER   재시작 "+URL2+(samePort?"  (같은 포트)":"  (같은 포트 재바인드 실패 → 새 임의 포트: "+bindErr+")"));
    const P3=await openTab(cA,URL2);
    const s10=await P3.ev(PROBE);
    rec("11 서버 재시작 후 새 접속",Object.assign({samePort,port:port2},s10));
    ok(s10.open===true&&s10.step===0&&s10.auto===true,"8a 서버를 껐다 켠 뒤 새로 접속해도 1단계부터 뜬다"+(samePort?" (같은 포트)":" (새 포트)"));
    if(!samePort) report.limits.push("서버 재시작을 같은 포트로 재바인드하지 못해 새 임의 포트("+port2+")로 확인했다: "+bindErr);
    report.shots.serverRestart=await P3.shot("i128-08-after-server-restart.png");

    /* ── 8. 저장값 보존 최종 확인 ───────────────────────────────────────── */
    const fin=await P3.ev(PROBE);
    rec("12 전 과정 후 프로필 A 저장소",{keys:fin.keys,stored:fin.stored,net:fin.net});
    ok(fin.stored==="1"&&fin.net==="192.168.0.77:8787","9a 전 과정 후에도 심어 둔 두 값이 그대로다");
    ok(fin.keys&&fin.keys.length===2&&fin.keys.join(",")==="netServer,tutorialSeen",
      "9b 튜토리얼이 키를 새로 만들지도 지우지도 않았다 — 최종 키 "+JSON.stringify(fin.keys));

    /* ── 9. 10단계 본문 동일성 (재촬영 불필요 근거) ─────────────────────── */
    const steps=await P3.ev(`(()=>{ tutOpen(); const out=[];
      for(let i=0;i<TUT_STEPS.length;i++){ tutGo(i); const b=document.getElementById("tutBox");
        out.push({i,title:TUT_STEPS[i].title,cards:TUT_STEPS[i].cards.length,lines:TUT_STEPS[i].lines.length,
          text:b?String(b.textContent||"").replace(/\\s+/g," ").trim():""}); }
      tutSkip(); return out; })()`);
    const digest=crypto.createHash("sha256").update(JSON.stringify(steps.map(s=>[s.title,s.text]))).digest("hex");
    report.tutorialSteps={count:steps.length,renderedDigest:digest,titles:steps.map(s=>s.title)};
    rec("13 10단계 렌더 텍스트 다이제스트",{count:steps.length,sha256:digest});
    ok(steps.length===10&&steps.every(s=>s.cards===s.lines&&s.text.length>0),"10a 10단계가 그대로 렌더된다 (카드 수 = 문단 수)");
    ok(/성공률은 30%/.test(steps.map(s=>s.text).join(" ")),"10b 직전 승인 규칙(#146 도망 30%) 본문이 그대로다 — 단계 본문 미변경");

  }catch(e){
    fail++; fails.push("예외 "+e.message);
    console.error("FAIL(예외) "+(e.stack||e.message));
  }finally{
    report.pass=pass; report.fail=fail; report.fails=fails;
    report.limits.push("프로필 2개는 같은 머신의 독립 Chrome user-data-dir 이다 — 물리적으로 다른 두 PC 종단간 검증이 아니다.");
    report.limits.push("BFCache 복원은 이 도구가 유도·주장하지 않는다. 같은 문서 무재표시는 모드 변경·새 게임 조작으로만 확인했다.");
    report.ownership=ownership();
    console.log("RESOURCE Chrome PID "+JSON.stringify(report.ownership.chromePids)
      +" · 임시 프로필 "+JSON.stringify(report.ownership.profileDirs)
      +" · 검증 서버 "+JSON.stringify(report.ownership.servers));
    const left=await cleanup();
    report.cleanup={removedDirs:OWNED.dirs.filter(d=>left.indexOf(d)<0),leftover:left,killedPids:report.ownership.chromePids};
    console.log("CLEANUP  이 실행이 만든 Chrome 프로세스 "+OWNED.procs.length+"개 · 임시 프로필 "+OWNED.dirs.length+"개(위 정확 경로만) · 검증용 HTTP 서버만 정리"
      +(left.length?" — 남은 디렉터리 "+left.length+"개":" — 전부 삭제 확인")+" (사용자 브라우저·기존 서버는 건드리지 않는다)");
    if(!READ_ONLY){
      const f=path.join(OUT,"i128-browser-report.json");
      fs.writeFileSync(f,JSON.stringify(report,null,2),"utf8"); // 정리 결과까지 담아 한 번만 쓴다
      console.log("REPORT   "+rel(f));
    }
  }
  console.log(`\n=== issue128_cdp (#128): pass ${pass} / fail ${fail} ===`);
  for(const l of report.limits) console.log("LIMIT    "+l);
  if(fail){ console.error("실패: "+fails.join(" | ")); process.exit(1); }
})().catch(async e=>{ console.error(e); await cleanup(); process.exit(2); });
