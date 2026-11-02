/* #401 전투 도트 깜빡임 — 실제 브라우저 집중 검사 (Mars, demo/test/browser)
   사용: node demo/test/browser/issue401_sprite_cdp.js [--chrome <chrome.exe>]
   띄우는 것: demo/ 읽기 전용 정적 서버(운영과 같은 Cache-Control: no-store) + 헤드리스 Chrome 임시 프로필(os.tmpdir) — 끝나면 정리. 저장소에 쓰지 않는다.
   재현 조건: 휴대폰 화면(412x915 @2.625) · 캐시 끔 · 지연 300ms — 새 <img> 가 받은 그림을 다시 쓰지 못하면 다시 받는 동안 도트가 빈다.
   판정: ① 재렌더 뒤 도트 노드가 같은 객체 ② 공격 → AI 차례 내내 빈 도트 프레임 0 ③ 마크업이 다르면 새 노드(폴백 경로 보존). */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), http=require("http"), {spawn}=require("child_process");
const args=process.argv.slice(2), ci=args.indexOf("--chrome");
const CHROME=(ci>=0?args[ci+1]:null)||[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium"].filter(Boolean).find(p=>fs.existsSync(p));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const DEMO=path.resolve(__dirname,"..",".."), sleep=ms=>new Promise(r=>setTimeout(r,ms));
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".png":"image/png",".svg":"image/svg+xml",".webp":"image/webp"};
let fail=0; const ok=(c,n)=>{ console.log((c?"PASS ":"FAIL ")+n); if(!c) fail++; };

(async()=>{
  const srv=http.createServer((req,rsp)=>{ let p=decodeURIComponent(new URL(req.url,"http://x").pathname);
    if(p.startsWith("/api/")){ rsp.writeHead(503,{"Content-Type":"application/json"}); rsp.end('{"error":"E_ACCOUNTS_DISABLED"}'); return; }
    if(p.endsWith("/")) p+="index.html"; const f=path.resolve(DEMO,"."+p);
    if(!f.startsWith(DEMO+path.sep)||!fs.existsSync(f)||!fs.statSync(f).isFile()){ rsp.writeHead(404); rsp.end(); return; }
    rsp.writeHead(200,{"Content-Type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"}); fs.createReadStream(f).pipe(rsp); });
  await new Promise(r=>srv.listen(0,"127.0.0.1",r));
  const prof=fs.mkdtempSync(path.join(os.tmpdir(),"dd401-"));
  const chrome=spawn(CHROME,["--headless=new","--remote-debugging-port=0",`--user-data-dir=${prof}`,"--no-first-run","--mute-audio","about:blank"],{stdio:"ignore"});
  try{
    const pf=path.join(prof,"DevToolsActivePort"); for(let i=0;i<100&&!fs.existsSync(pf);i++) await sleep(100);
    const port=fs.readFileSync(pf,"utf8").split("\n")[0].trim();
    const tgt=(await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(t=>t.type==="page");
    const ws=new WebSocket(tgt.webSocketDebuggerUrl); await new Promise((r,j)=>{ ws.onopen=r; ws.onerror=j; });
    let id=0; const pend=new Map(); ws.onmessage=e=>{ const m=JSON.parse(e.data); const p=pend.get(m.id); if(p){ pend.delete(m.id); m.error?p.j(new Error(JSON.stringify(m.error))):p.r(m.result); } };
    const send=(method,params)=>new Promise((r,j)=>{ const i=++id; pend.set(i,{r,j}); ws.send(JSON.stringify({id:i,method,params:params||{}})); });
    const ev=async x=>{ const r=await send("Runtime.evaluate",{expression:x,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0,600)); return r.result.value; };
    await send("Page.enable"); await send("Network.enable");
    await send("Emulation.setDeviceMetricsOverride",{width:412,height:915,deviceScaleFactor:2.625,mobile:true});
    await send("Page.addScriptToEvaluateOnNewDocument",{source:`(()=>{let s=401>>>0;Math.random=()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};})()`});
    await send("Page.navigate",{url:`http://127.0.0.1:${srv.address().port}/`}); await sleep(1500);
    // 오프라인 PVE 실제 엔진으로 전투를 세운다 (issue335_cdp B03 과 같은 방식) — 양쪽 HP 를 키워 AI 차례까지 전투가 이어지게
    await ev(`(()=>{ if(typeof TUT!=="undefined"&&TUT.open) tutSkip(); UI.entered=true; startMode("pve",{aiLevel:"grade5"});
      dispatchCoreAction({t:"shopTimeout",player:0}); UI.prep="place"; render(); netAction({t:"auto"}); netAction({t:"setupDone"}); fxReleaseAll();
      S.current=0; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; render();
      const a=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive), d=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&x.alive);
      a.spd=99; a.hp=a.maxHp=999; d.hp=d.maxHp=999; startRounds(a,d,a,d); return true; })()`);
    ok(await ev(`(async()=>{ for(let i=0;i<120;i++){ if(!FX.cur&&!FX.q.length&&!MSGPLAYING&&S.battle&&S.battle.msgQ.length) battleModal(); if(!fxLocked()&&S.battle&&!S.battle.msgQ.length) return true; await new Promise(r=>setTimeout(r,150)); } return false; })()`),"전투 명령 대기 도달");
    await sleep(800);
    ok(await ev(`(()=>{ const a=[...document.querySelectorAll("#bstage .bsprite")]; battleModal(); const b=[...document.querySelectorAll("#bstage .bsprite")];
      return a.length===2&&b.length===2&&a.every((x,i)=>x===b[i]&&x.isConnected&&x.complete&&x.naturalWidth>0); })()`),"① 재렌더 뒤 도트 2개가 같은 노드 · 로드 완료");
    ok(await ev(`(()=>{ const o=document.querySelector("#bstage .bsprite"), alt=o.alt; o.alt="바뀐 마크업"; battleModal(); const n=document.querySelector("#bstage .bsprite");
      return n!==o&&n.alt===alt&&!o.isConnected; })()`),"③ 마크업이 다르면 새 노드로 그린다");
    await send("Network.setCacheDisabled",{cacheDisabled:true});
    await send("Network.emulateNetworkConditions",{offline:false,latency:300,downloadThroughput:1.5e6,uploadThroughput:0.75e6});
    const r=await ev(`(async()=>{ let blank=0, frames=0, renders=0; const f=window.battleModal; window.battleModal=function(){ renders++; return f.apply(this,arguments); };
      let on=true; const tick=()=>{ if(!on) return; frames++; const im=[...document.querySelectorAll("#bstage .bsprite")]; if(im.length&&im.some(i=>!i.complete||!i.naturalWidth)) blank++; requestAnimationFrame(tick); }; tick();
      window.__menu("fight"); const btn=[...document.querySelectorAll("#bsub-fight button:not([disabled])")].find(x=>/__act/.test(x.getAttribute("onclick")||"")); if(!btn) return {err:"no skill"}; btn.click();
      await new Promise(r=>setTimeout(r,5000)); on=false; window.battleModal=f; return {blank,frames,renders}; })()`);
    ok(!r.err&&r.renders>=2&&r.blank===0,`② 공격 → AI 차례 재렌더 ${r.renders}회 동안 빈 도트 프레임 ${r.blank}/${r.frames}`);
    ws.close();
  }finally{ chrome.kill(); srv.close(); await sleep(300); try{ fs.rmSync(prof,{recursive:true,force:true}); }catch(e){} }
  console.log(fail?`FAIL ${fail}`:"ALL PASS"); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
