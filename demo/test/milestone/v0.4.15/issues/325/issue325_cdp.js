/* #325 (#326·#327·#329) 실제 브라우저 렌더 확인 — 320×568 · 390×844 에서 전투 여섯 칸 · 스텟 설명 창 · 폭탄/함정 말 정보 창.
   사용: node demo/test/milestone/v0.4.15/issues/325/issue325_cdp.js [--out <dir>] [--chrome <chrome.exe>] [--read-only]
   기본 출력: os.tmpdir()/digitduel-issue325-evidence — **저장소 밖**이다(스크린샷을 저장소에 넣지 않는다). --read-only 면 스크린샷 0건 · Chrome 임시 프로필은 생성 후 정리.

   한계(그대로 보고한다): 전투 장면은 **페이지 안 제품 함수로 직접 세운다**(newGame · applySpecies · startRounds) — 로비 · 상점 · 배치를 사람이 거친 경로가 아니다.
   버튼 누름 · 바깥 누름 · Tab · Esc 는 실제 입력 이벤트(Input.dispatch*)다. file:// 오프라인 PVE 한 장면만 본다 — 공개 방(서버 kingdomProc)은 헤드리스 회귀와 Jupiter 서버 검사가 본다. */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), {spawn}=require("child_process");
const args=process.argv.slice(2), opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const ROOT=path.resolve(__dirname,"..","..","..","..","..","..");
const OUT=path.resolve(opt("--out",path.join(os.tmpdir(),"digitduel-issue325-evidence")));
const SHOTS=!args.includes("--read-only");
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome","/usr/bin/chromium"].filter(Boolean).find(p=>fs.existsSync(p)));
if(!CHROME){ console.error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); process.exit(2); }
const URL_="file:///"+path.join(ROOT,"demo","index.html").replace(/\\/g,"/");
let pass=0,fail=0; const ok=(c,n)=>{ if(c){pass++; console.log("PASS "+n);} else {fail++; console.error("FAIL "+n);} };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

/* 장면 — 내 전투원: 🔥 지속형 ⭐2 + 필드 🔥 4칸(왕국 (4) 40%) + 지속형 2칸(+5%p) + 기본 +10%p = 55% · 상대: 혼자 선 🌿 방어형(미활성). 내가 더 빨라 내 차례에서 멈춘다 */
const STAGE=`(()=>{ if(typeof TUT!=="undefined"&&TUT.open) tutSkip(); newGame("pve",{});
  for(const x of S.pieces){ x.placed=false; if(x.type==="minion"){ x.element=null; x.rosterId=null; } else { x.element=null; x.leaderElChosen=true; } }
  const ms=o=>S.pieces.filter(x=>x.owner===o&&x.type==="minion"), put=(p,r,c)=>{ p.r=r; p.c=c; p.placed=true; p.alive=true; }, R=id=>ROSTER.find(r=>r.id===id);
  const me=ms(0), op=ms(1); applySpecies(me[0],R("M-F5"),2); put(me[0],7,4);
  ["M-F1","M-F2","M-F3","M-W5"].forEach((id,i)=>{ applySpecies(me[i+1],R(id),1); put(me[i+1],12,i+1); });
  applySpecies(op[0],R("M-G3"),1); put(op[0],6,4);
  for(const k of S.pieces.filter(x=>x.type==="king")) put(k,k.owner===0?13:1,k.owner===0?7:1);
  const b=S.pieces.find(x=>x.owner===0&&x.type==="bomb"), t=S.pieces.find(x=>x.owner===0&&x.type==="trap"); put(b,11,1); put(t,11,2);
  S.phase="play"; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.inv=[[],[]]; S.balls=[0,0]; render();
  return {bomb:b.id,trap:t.id,me:me[0].id,op:op[0].id}; })()`;
const CHIPS=`[...document.querySelectorAll(".bslot")].map(s=>[...s.querySelectorAll(".bStats li")].map(li=>({t:li.textContent,a:li.getAttribute("aria-label"),cut:li.scrollWidth>li.clientWidth,w:[li.scrollWidth,li.clientWidth]})))`;
const RECT=sel=>`(()=>{ const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; const r=e.getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2,l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}; })()`;

(async()=>{
  const udd=fs.mkdtempSync(path.join(os.tmpdir(),"i325cdp-"));
  const proc=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu",
    "--hide-scrollbars","--lang=ko-KR","--allow-file-access-from-files","about:blank"],{stdio:["ignore","pipe","pipe"]});
  try{
    const wsUrl=await new Promise((res,rej)=>{ let err=""; const t=setTimeout(()=>rej(new Error("DevTools 포트 대기 초과\n"+err)),20000);
      proc.stderr.on("data",d=>{ err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ clearTimeout(t); res(m[1]); } }); });
    const ws=new WebSocket(wsUrl); await new Promise((res,rej)=>{ ws.onopen=res; ws.onerror=rej; });
    let id=0; const pend=new Map();
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data); const p=pend.get(m.id); if(p){ pend.delete(m.id); m.error?p.rej(new Error(JSON.stringify(m.error))):p.res(m.result); } };
    const send=(method,params,sessionId)=>new Promise((res,rej)=>{ const i=++id; pend.set(i,{res,rej}); ws.send(JSON.stringify({id:i,method,params:params||{},sessionId})); });
    if(SHOTS) fs.mkdirSync(OUT,{recursive:true});
    for(const vp of [{w:320,h:568},{w:390,h:844}]){
      const tag=`${vp.w}x${vp.h}`;
      const {targetId}=await send("Target.createTarget",{url:"about:blank"}), {sessionId:S_}=await send("Target.attachToTarget",{targetId,flatten:true});
      await send("Page.enable",{},S_); await send("Runtime.enable",{},S_);
      await send("Emulation.setDeviceMetricsOverride",{width:vp.w,height:vp.h,deviceScaleFactor:2,mobile:true},S_);
      await send("Page.navigate",{url:URL_},S_); await sleep(1200);
      const ev=async expr=>{ const r=await send("Runtime.evaluate",{expression:expr,returnByValue:true,awaitPromise:true},S_);
        if(r.exceptionDetails) throw new Error("page error: "+(r.exceptionDetails.exception&&r.exceptionDetails.exception.description||r.exceptionDetails.text)+"\nEXPR: "+expr.slice(0,200)); return r.result.value; };
      const shot=async name=>{ if(!SHOTS) return; const {data}=await send("Page.captureScreenshot",{format:"png"},S_); fs.writeFileSync(path.join(OUT,name),Buffer.from(data,"base64")); console.log("SHOT "+path.join(OUT,name).replace(/\\/g,"/")); };
      const click=async(x,y)=>{ for(const type of ["mousePressed","mouseReleased"]) await send("Input.dispatchMouseEvent",{type,x,y,button:"left",clickCount:1},S_); await sleep(120); };
      const key=async(k,code,vk)=>{ for(const type of ["rawKeyDown","keyUp"]) await send("Input.dispatchKeyEvent",{type,key:k,code,windowsVirtualKeyCode:vk},S_); await sleep(80); };
      const inView=r=>r&&r.l>=-0.5&&r.t>=-0.5&&r.r<=vp.w+0.5&&r.b<=vp.h+0.5;

      const ids=await ev(STAGE);
      /* #329 말 정보 창 — 내 폭탄 · 함정 */
      for(const [k,nm] of [["bomb","폭탄"],["trap","함정"]]){
        await ev(`unitHelpPiece(${ids[k]},null)`); await sleep(150);
        const d=await ev(`(()=>{ const e=document.getElementById("synHelp"); return e?{txt:e.textContent,note:UNIT_NOTE[${JSON.stringify(k)}]}:null; })()`), r=await ev(RECT("#synHelp"));
        ok(d&&d.txt.includes(d.note)&&inView(r)&&!/HP|스킬/.test(d.txt),`[${tag}] #329 ${nm} 말 정보 창 = UNIT_NOTE 문장 그대로 · 화면 안 · HP/스킬 없음`);
        await shot(`unitinfo-${k}-${tag}.png`); await ev(`synHelpClose(false)`);
      }
      /* #326 전투 여섯 칸 */
      await ev(`(()=>{ const a=S.pieces.find(x=>x.id===${ids.me}), d=S.pieces.find(x=>x.id===${ids.op}); startRounds(a,d,a,d); })()`);
      for(let i=0;i<60&&await ev(`fxLocked()`);i++) await sleep(250); await sleep(300); // 개시 연출(3·2·1 · 배틀 시작!)이 끝날 때까지 — 연출 중에는 화면 전체가 입력을 막는다(상성표 버튼과 같은 조건)
      let chips=await ev(CHIPS);
      const six=chips.map(c=>c[5]), all=chips.flat();
      ok(chips.length===2&&chips.every(c=>c.length===6)&&all.every(c=>!c.cut),`[${tag}] #326 두 패널 × 여섯 칸 · 잘린 칸 없음 [${all.filter(c=>c.cut).map(c=>c.t+" "+c.w.join(">")).join(" · ")}]`);
      ok(six.some(c=>c.a.startsWith("왕국 효과 발동률 55% · 화상(상대)")&&c.t.endsWith("55%"))&&six.some(c=>c.a==="왕국 효과 미활성 — 같은 속성 2칸부터"&&c.t.endsWith("미활성")),
        `[${tag}] #326 여섯째 칸 — 내 쪽 55%(화상·상대) · 상대 미활성 [${six.map(c=>c.a).join(" | ")}]`);
      await shot(`battle-${tag}.png`);
      await ev(`(()=>{ S.battle.fa.sandStormR=2; battleModal(); })()`); await sleep(200);
      chips=await ev(CHIPS);
      ok(chips.some(c=>c[5].t.endsWith("27.5%")&&!c[5].cut),`[${tag}] #326 상한 뒤 모래 폭풍 절반 = 27.5% · 소수 한 자리 · 안 잘림`);
      await shot(`battle-sandstorm-${tag}.png`);
      /* #327 스텟 설명 버튼 · 창 */
      const sb=await ev(RECT(".bround .statBtn")), cb=await ev(RECT(".bround .cycBtn:not(.statBtn)"));
      ok(sb&&cb&&inView(sb)&&inView(cb)&&Math.round(sb.w)===44&&Math.round(sb.h)===44&&sb.r<=cb.l+0.5,`[${tag}] #327 스텟 버튼 44px · 상성표 왼쪽 · 줄이 화면 안`);
      const row=await ev(`(()=>{ const r=document.querySelector(".bround"), b=r.querySelector(".badge"), t=b.textContent; b.textContent="⏳ 상대 응답 대기"; const o={over:r.scrollWidth>r.clientWidth,w:[r.scrollWidth,r.clientWidth],right:r.querySelector(".cycBtn:not(.statBtn)").getBoundingClientRect().right}; b.textContent=t; return o; })()`);
      ok(!row.over&&row.right<=vp.w+0.5,`[${tag}] #327 가장 긴 줄(라운드 · '⏳ 상대 응답 대기' · 버튼 2개)도 넘치지 않는다 [${row.w.join("/")} · 오른쪽 끝 ${Math.round(row.right)}]`);
      const before=await ev(`JSON.stringify({seq:S.battle.actSeq,round:S.battle.round,phase:S.battle.phase,menu:document.getElementById("bmenu").className,hp:[S.battle.fa.hp,S.battle.fd.hp]})`);
      await click(sb.x,sb.y);
      let h=await ev(`(()=>{ const e=document.getElementById("synHelp"); if(!e) return null; const x=e.querySelector(".acctX").getBoundingClientRect();
        return {title:e.querySelector("h3").textContent,rows:e.querySelectorAll("ol li").length,note:e.querySelector("small").textContent,xr:x.right,xt:x.top,xb:x.bottom,focusIn:e.contains(document.activeElement),
          scroll:e.scrollHeight>e.clientHeight,inBox:!!e.closest("#overlayBox")}; })()`), hr=await ev(RECT("#synHelp"));
      ok(h&&h.title==="하수인 스텟"&&h.rows===6&&h.note==="시너지가 반영된 현재 값입니다."&&inView(hr)&&h.xr<=vp.w&&h.xt>=0&&h.focusIn,
        `[${tag}] #327 창 — 제목 · 6행 · 아래 한 줄 · 화면 안 · ✕ 보임 · 초점이 창 안 (안쪽 스크롤 ${h&&h.scroll?"있음":"없음"})`);
      await shot(`stathelp-${tag}.png`);
      for(let i=0;i<4;i++) await key("Tab","Tab",9);
      ok(await ev(`document.getElementById("synHelp").contains(document.activeElement)`),`[${tag}] #327 Tab 4번 뒤에도 초점이 창 안`);
      /* 바깥 누름 — 창에 가려지지 않은 전투 명령 버튼 자리(없으면 상성표 버튼) */
      const fight=await ev(`(()=>{ const h=document.getElementById("synHelp").getBoundingClientRect(); for(const b of [...document.querySelectorAll("#bmenu button, .bround .cycBtn:not(.statBtn)")]){ const r=b.getBoundingClientRect(), x=r.left+r.width/2, y=r.top+r.height/2;
        if(r.width&&(x<h.left||x>h.right||y<h.top||y>h.bottom)&&y<innerHeight) return {x,y,nm:b.textContent.trim()||b.getAttribute("aria-label")}; } return null; })()`);
      await click(fight.x,fight.y);
      ok(await ev(`!document.getElementById("synHelp")&&document.activeElement===document.querySelector(".bround .statBtn")`)&&await ev(`JSON.stringify({seq:S.battle.actSeq,round:S.battle.round,phase:S.battle.phase,menu:document.getElementById("bmenu").className,hp:[S.battle.fa.hp,S.battle.fd.hp]})`)===before,
        `[${tag}] #327 바깥 누름('${fight.nm}' 버튼 위) — 창만 닫힘 · 초점 = 스텟 버튼 · 전투 상태 · 하위 메뉴 그대로`);
      await click(sb.x,sb.y); await key("Escape","Escape",27);
      ok(await ev(`!document.getElementById("synHelp")&&!!S.battle&&document.activeElement===document.querySelector(".bround .statBtn")`),`[${tag}] #327 Esc — 창만 닫힘(전투 유지) · 초점 = 스텟 버튼`);
      await click(sb.x,sb.y); await ev(`battleModal()`); await sleep(100);
      ok(await ev(`!document.getElementById("synHelp")`),`[${tag}] #327 전투가 다시 그려지면 창이 남지 않는다`);
      await send("Target.closeTarget",{targetId});
    }
    ws.close();
  } finally {
    proc.kill(); await sleep(400); try{ fs.rmSync(udd,{recursive:true,force:true}); console.log("CLEANUP 임시 프로필 삭제 "+udd); }catch(e){ console.log("LEFTOVER "+udd+" "+e.message); }
  }
  console.log(`=== issue325_cdp: pass ${pass} / fail ${fail} ===`); process.exit(fail?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
