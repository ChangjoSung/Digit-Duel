/* Issue114: real Chrome two-tab + real relay, public setup API, deterministic battle fixtures,
   actual mouse flee/category/candidate/skip/resign clicks. Optional --shots records fixture UI proof, not release capture.
   node demo/test/milestone/v0.4.5/issues/114/issue114_cdp.js [--read-only] [--out docs/milestone/v0.4.5/issues/114/Mars/artifacts] [--shots]
   Gameplay fixtures shorten unrelated effects; flee selection/push effects retain 2000ms.
   Only this run's child processes and exact temporary profile are cleaned up. */
"use strict";
const fs=require("fs"),path=require("path"),os=require("os"),crypto=require("crypto"),assert=require("assert/strict"),{spawn}=require("child_process");
const ROOT=path.resolve(__dirname,"../../../../../.."),args=process.argv.slice(2),READ=args.includes("--read-only");
const OUT=path.resolve(args.includes("--out")?args[args.indexOf("--out")+1]:path.join(ROOT,"docs/milestone/v0.4.5/issues/114/Mars/artifacts"));
const SHOTS=args.includes("--shots")&&!READ;
const CHROME=[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium"].filter(Boolean).find(p=>fs.existsSync(p));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let chrome,server,profile,cdp;const results=[];
function note(name,detail){results.push({name,detail});console.log("PASS "+name+" "+JSON.stringify(detail||{}));}
async function until(fn,label,ms=15000){const end=Date.now()+ms;while(Date.now()<end){const r=await fn();if(r)return r;await sleep(80);}throw Error("Timeout: "+label);}
class CDP{
  constructor(ws){this.ws=ws;this.seq=0;this.pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data),p=this.pending.get(m.id);if(p){this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}};}
  send(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++this.seq,timer=setTimeout(()=>reject(Error("CDP timeout "+method)),15000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params,sessionId}));});}
}
async function start(){
  assert(CHROME,"Chrome installed");profile=fs.mkdtempSync(path.join(os.tmpdir(),"issue114-"));
  chrome=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+profile,"--no-first-run","--no-default-browser-check","--disable-background-timer-throttling","--disable-renderer-backgrounding","about:blank"],{windowsHide:true,stdio:["ignore","pipe","pipe"]});
  let stderr="";chrome.stderr.on("data",b=>stderr+=b);const endpoint=await until(()=>stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1],"Chrome launch");
  const ws=new WebSocket(endpoint);await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});cdp=new CDP(ws);
  server=spawn(process.execPath,[path.join(ROOT,"server/server.js")],{windowsHide:true,env:{...process.env,PORT:"0"},stdio:["ignore","pipe","pipe"]});
  let output="";server.stdout.on("data",b=>output+=b);server.stderr.on("data",b=>output+=b);
  const net=await until(()=>{const port=output.match(/listening on [\d.]+:(\d+)/),code=output.match(/접속 코드: (\S+)/);return port&&code?{port:+port[1],code:code[1]}:null;},"relay launch");
  console.log("RESOURCE chromePID="+chrome.pid+" serverPID="+server.pid+" profile="+profile);return net;
}
async function tab(url){
  const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"});const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true});
  await cdp.send("Page.enable",{},sid);await cdp.send("Runtime.enable",{},sid);await cdp.send("Emulation.setDeviceMetricsOverride",{width:1280,height:1000,deviceScaleFactor:1,mobile:false},sid);
  const t={sid,ev:async expression=>{const r=await cdp.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true},sid);if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;},click:async sel=>{
    const p=await t.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);assert(p,"click target "+sel);
    for(const type of ["mousePressed","mouseReleased"])await cdp.send("Input.dispatchMouseEvent",{type,...p,button:"left",clickCount:1},sid);await sleep(80);
  }};
  await cdp.send("Page.navigate",{url},sid);await until(()=>t.ev("typeof netPrepare==='function'"),"page load");
  await t.ev(`(()=>{tutSkip();window.__errors=[];window.addEventListener('error',e=>__errors.push(e.message));window.__sent=[];window.__received=0;window.__defaultFx={...BAL.fx};const send=WebSocket.prototype.send;WebSocket.prototype.send=function(raw){const m=JSON.parse(raw);if(m.t==='a')__sent.push(m.a);return send.call(this,raw);};return true;})()`);return t;
}
const cell=(r,c)=>`.cell[data-r="${r}"][data-c="${c}"]`;
const state=`(()=>({phase:S.phase,fp:S.fleePick,cur:S.current,battles:S.battlesUsed,battle:!!S.battle,locked:fxLocked(),queue:NET.queue.length,me:NET.me,sent:__sent,received:__received,errors:__errors}))()`;
// Existing pname mirrors "나(P1)"/"상대(P1)" per viewer. Normalize labels only; retain message order/content.
const canon=`JSON.stringify({pieces:S.pieces,current:S.current,turn:S.turnCount,main:S.mainUsed,battles:S.battlesUsed,fp:S.fleePick,forced:S.forcedTargets,queue:S.forcedQueue,metrics:S.metrics,log:S.log.map(l=>({...l,msg:l.msg.replace(/(?:나|상대)\\(P([12])\\)/g,'P$1')})),traces:S.traces.map(x=>[...x])})`;
async function same(clients,logs=true){const [a,b]=await Promise.all(clients.map(async t=>JSON.parse(await t.ev(canon))));if(!logs){delete a.log;delete b.log;}function diff(x,y,p="S"){if(JSON.stringify(x)===JSON.stringify(y))return null;if(!x||!y||typeof x!=="object"||typeof y!=="object")return p+": "+JSON.stringify(x)+" != "+JSON.stringify(y);for(const k of new Set([...Object.keys(x),...Object.keys(y)])){const d=diff(x[k],y[k],p+"."+k);if(d)return d;}}assert.equal(diff(a,b),null);}
async function idle(t){return t.ev("!fxLocked()&&NET.queue.length===0");}
async function shot(t,name){if(!SHOTS)return;fs.mkdirSync(OUT,{recursive:true});await cdp.send("Page.bringToFront",{},t.sid);await sleep(100);const {data}=await cdp.send("Page.captureScreenshot",{format:"png"},t.sid);fs.writeFileSync(path.join(OUT,name+".png"),Buffer.from(data,"base64"));console.log("SHOT "+path.relative(ROOT,path.join(OUT,name+".png")));}
const fixture=owner=>`(()=>{
  close();fxReleaseAll();BAL.fx.autoEnd=false;for(const k of Object.keys(BAL.fx))if(typeof BAL.fx[k]==='number')BAL.fx[k]=0;BAL.fx.fleeFx=2000;BAL.fx.pushBanner=2000;BAL.fx.watchdog=1000;
  for(const p of S.pieces){p.placed=false;p.alive=true;p.revealed=false;p.healing=false;p.hp=p.maxHp;}
  S.phase='play';S.current=0;S.turnCount=10;S.mainUsed=true;S.battlesUsed=0;S.battle=null;S.fleePick=null;S.selected=null;S.teleport=null;S.forcedTargets=[];S.forcedQueue=[];S.movedPiece=null;S.contactSet=[];S.log=[];
  const get=(o,t,n=0)=>S.pieces.filter(p=>p.owner===o&&p.type===t)[n],put=(p,r,c)=>{p.r=r;p.c=c;p.placed=true;};
  for(const o of [0,1]){put(get(o,'king'),o?1:13,o?7:1);put(get(o,'minion',5),o?1:13,o?1:7);}
  const a=get(0,'minion'),b=get(1,'minion'),rear=get(${owner},'trap');put(a,7,4);put(b,6,4);put(rear,${owner}?3:10,4);a.hp=b.hp=20;
  startRounds(a,b,a,b);S.battle.phase=${owner};S.battle.msgQ=[];fxReleaseAll();battleModal();setSeed(114);render();__sent.length=0;__received=0;
  // Seed selected by examining the seeded stream, then reset: guarantees a successful real flee action, not a patched RNG.
  let seed=1;for(;seed<1000;seed++){setSeed(seed);if(rand()<BAL.fleeProb)break;}setSeed(seed);
  return {rear:[rear.r,rear.c],id:rear.id,seed};
})()`;
(async()=>{
  let failed=null;
  try{
    const net=await start(),tabs=[await tab(`http://127.0.0.1:${net.port}/index.html`),await tab(`http://127.0.0.1:${net.port}/index.html`)];
    for(const t of tabs)await t.ev(`(()=>{$('netCode').value=${JSON.stringify(net.code)};netPrepare();autoPlace();setupDone();return true;})()`);
    await until(async()=>(await Promise.all(tabs.map(t=>t.ev("NET.started&&S.phase==='play'")))).every(Boolean),"actual matching");
    await until(async()=>(await Promise.all(tabs.map(idle))).every(Boolean),"start idle");
    const clients=[];for(const t of tabs){clients[await t.ev("NET.me")]=t;await t.ev("NET.ws.addEventListener('message',e=>{if(JSON.parse(e.data).t==='a')__received++;});true");}
    note("real relay matched two Chrome clients through public setup APIs");
    for(const owner of [1,0])for(const skip of [false,true]){
      const f=[];for(const t of clients)f.push(await t.ev(fixture(owner)));
      await same(clients);
      const own=clients[owner],other=clients[1-owner];
      await own.click("#bmenu button:last-child");await own.click("#bsub-flee button.danger");
      await until(async()=>(await Promise.all(clients.map(t=>t.ev("!!S.fleePick")))).every(Boolean),"flee selection");
      const locked=await own.ev("fxLocked()");assert(locked);const n=(await own.ev(state)).sent.length;await own.click(cell(...f[owner].rear));assert.equal((await own.ev(state)).sent.length,n);
      await until(async()=>(await Promise.all(clients.map(idle))).every(Boolean),"flee banner idle",12000);
      assert.equal(await own.ev("document.querySelectorAll('.cell.hl-move').length"),await own.ev("S.fleePick.cands.length"));
      assert.equal(await other.ev("document.querySelectorAll('.cell.hl-move').length"),0);
      const beforeOther=(await other.ev(state)).sent.length;await other.click(cell(...f[owner].rear));assert.equal((await other.ev(state)).sent.length,beforeOther);
      assert(await other.ev("document.getElementById('sidePanel').textContent.includes('상대가 말을 교체 중')"));
      if(SHOTS&&owner===1&&!skip){
        // The nonowner click legitimately opens a private memo. Dismiss it with its real button for waiting-state proof.
        await other.click("#obBtns button:last-child");
        assert(await other.ev("!!S.fleePick&&document.getElementById('overlay').classList.contains('hidden')"));
        await shot(own,"flee-defender-choice");await shot(other,"flee-attacker-waiting");
      }
      if(skip)await own.click("#turnBar button:first-child");else await own.click(cell(...f[owner].rear));
      await until(async()=>(await Promise.all(clients.map(t=>t.ev("!S.fleePick&&!fxLocked()&&NET.queue.length===0")))).every(Boolean),"push settle");
      await same(clients);assert.equal(await own.ev("S.battlesUsed"),1);assert.equal(await own.ev("rand()"),await other.ev("rand()"));
      const states=await Promise.all(clients.map(t=>t.ev(state)));assert.equal(states[1-owner].sent.length,0);assert.equal(states[owner].sent.length,2);assert.equal(states[1-owner].received,2);
      assert(states.every(s=>s.queue===0&&s.errors.length===0));
      note("flee owner "+owner+" "+(skip?"skip":"candidate click"),{sent:states.map(s=>s.sent.length),received:states.map(s=>s.received),battlesUsed:1,defaultFleeAndPushMs:2000});
    }
    // Relocation rules are reached through a real online bomb/trap contact click.
    const reloc=`(()=>{close();fxReleaseAll();for(const p of S.pieces)p.placed=false;S.current=0;S.mainUsed=true;S.battlesUsed=0;S.fleePick=null;S.battle=null;S.forcedTargets=[];S.forcedQueue=[];S.log=[];const g=(o,t,n=0)=>S.pieces.filter(p=>p.owner===o&&p.type===t)[n],put=(p,r,c)=>{p.r=r;p.c=c;p.placed=true;p.alive=true;p.revealed=false;};put(g(0,'king'),13,1);put(g(1,'king'),1,7);put(g(0,'bomb'),7,4);put(g(1,'trap'),6,4);put(g(0,'trap'),8,4);put(g(1,'bomb'),5,4);S.selected=g(0,'bomb');render();__sent.length=0;__received=0;return true;})()`;
    for(const t of clients){await t.ev(reloc);await t.ev("S.movedPiece=S.selected;S.forcedTargets=[at(6,4).id];S.contactSet=S.forcedTargets.slice();render();true");}await clients[0].click(cell(6,4));
    await until(async()=>(await Promise.all(clients.map(idle))).every(Boolean),"relocation settle");await same(clients);
    assert(await clients[0].ev("S.metrics.relocations>0"));note("live bomb/trap contact relocates both, canonical states including logs match");
    // Full HP wait and real auto end: only the current actor emits the end action.
    for(const t of clients)await t.ev(reloc); // reset common fixture
    for(const t of clients)await t.ev(`(()=>{for(const p of S.pieces)p.placed=false;for(const o of [0,1]){const k=S.pieces.find(p=>p.owner===o&&p.type==='king');k.placed=true;k.r=o?1:13;k.c=o?7:1;k.hp=k.maxHp;k.healing=false;}S.current=0;S.mainUsed=false;S.battlesUsed=0;S.selected=S.pieces.find(p=>p.owner===0&&p.type==='king');BAL.fx.autoEnd=true;BAL.fx.autoEndGrace=1000;render();return true;})()`);
    await clients[0].click("#turnBar button:nth-child(3)");await until(async()=>(await Promise.all(clients.map(t=>t.ev("S.current===1")))).every(Boolean),"healing auto end");
    await same(clients,false);assert.equal(await clients[1].ev("__sent.length"),0);assert.equal(await clients[0].ev("__sent.filter(a=>a.t==='endTurn').length"),1);
    assert(await clients[1].ev("!S.log.some(l=>l.msg.includes('왕 회복'))"));
    const healLogs=await Promise.all(clients.map(t=>t.ev("S.log.map(l=>l.msg)")));
    const publicHeal=logs=>logs.filter(l=>!/(최대 HP — 회복 자세 유지|HP \+\d+ \(회복 자세\))/.test(l)).map(l=>/회복 자세 시작|상대가 말 회복 행동/.test(l)?"HEAL_ACTION":l.replace(/(?:나|상대)\(P([12])\)/g,"P$1"));
    assert.equal(publicHeal(healLogs[0]).filter(l=>l==="HEAL_ACTION").length,1);assert.deepEqual(publicHeal(healLogs[0]),publicHeal(healLogs[1]));
    note("full HP healing wait auto-ends once from owner only; state agrees, healing identity stays private");
    if(SHOTS){
      for(const t of clients){await t.ev(fixture(0));await t.ev("S.battle=null;close();fxReleaseAll();S.battlesUsed=0;S.selected=at(7,4);renderLog();clearToasts();render();true");}
      assert(await clients[0].ev("[...document.querySelectorAll('#turnBar button')].some(b=>b.textContent==='싸우지 않고 종료'&&!b.disabled)"));
      await shot(clients[0],"conditional-end-option");
    }
    for(const t of clients){await t.ev(fixture(1));await t.ev("S.battle=null;close();fxReleaseAll();fleeSwapPrompt(at(6,4),at(7,4));true");}
    await until(async()=>(await Promise.all(clients.map(idle))).every(Boolean),"resign selection idle");
    assert(await clients[1].ev("document.querySelector('#turnBar button.danger').disabled"));
    await clients[0].click("#turnBar button.danger");await clients[0].click("#obBtns button:first-child");
    await until(async()=>(await Promise.all(clients.map(t=>t.ev("S.phase==='over'&&S.winner===1")))).every(Boolean),"current player resignation");
    assert.equal(await clients[1].ev("__sent.length"),0);note("current player resignation works during defender-owned flee selection");
    const local=await tab(`http://127.0.0.1:${net.port}/index.html`);
    await local.ev("newGame('pvp');aiAutoPlace(0);aiAutoPlace(1);S.phase='play';true");
    await local.ev(fixture(0));await local.ev("S.battle=null;close();fxReleaseAll();fleeSwapPrompt(at(7,4),at(6,4));window.__stale=document.querySelector('#turnBar button').onclick;window.__pending=FX.cur;newGame('pvp');window.__before=JSON.stringify(S);__stale();true");
    await sleep(2300);assert(await local.ev("JSON.stringify(S)===__before"));note("old DOM flee callback and pending 2s banner cannot mutate a new game");
  }catch(e){failed=e.stack||String(e);console.error(failed);}
  finally{
    if(cdp){try{await cdp.send("Browser.close");}catch{}try{cdp.ws.close();}catch{}}
    for(const p of [chrome,server])if(p&&!p.killed){p.kill();console.log("CLEANUP owned PID="+p.pid);}
    if(profile){await sleep(600);const exact=path.resolve(profile);assert(path.dirname(exact)===path.resolve(os.tmpdir())&&path.basename(exact).startsWith("issue114-"));try{fs.rmSync(exact,{recursive:true,force:true});console.log("CLEANUP exact profile="+exact);}catch(e){console.log("CLEANUP profile remaining: "+e.code);}}
  }
  const report={source:"demo/index.html",sha256:crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT,"demo/index.html"))).digest("hex"),date:new Date().toISOString(),passed:results.length,failed,results};
  if(!READ){fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(path.join(OUT,"issue114_cdp_report.json"),JSON.stringify(report,null,2));}
  console.log("issue114_cdp: "+results.length+" checks, failed="+!!failed);process.exitCode=failed?1:0;
})();
