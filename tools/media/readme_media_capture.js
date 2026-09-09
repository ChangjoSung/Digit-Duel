/* #105 README 미디어 — 출시 태그의 실제 게임 화면(튜토리얼 10단계)을 헤드리스 Chrome(CDP)으로 캡처하고, README 의 로컬 이미지·링크와
   GitHub 렌더 결과를 검증하는 도구. 제품 코드(demo/·server/)는 읽기만 하며 어떤 경우에도 수정하지 않는다.

   사용:
     node tools/media/readme_media_capture.js capture [--ref v0.4.3] [--out docs/media] [--viewport 1280x900] [--dpr 2] [--chrome <chrome.exe>]
       - 태그의 demo/* 는 `git show <ref>:<path>` (읽기 전용) 로 꺼낸 바이트를 127.0.0.1:0 임시 서버가 메모리에서 그대로 서빙한다.
         디스크에 HTML 사본을 만들지 않으며, 실제 자산 상대경로(demo/assets/…)가 출시 상태 그대로 동작한다.
       - 새 프로필(=tutorialSeen 없음)로 열면 게임이 스스로 튜토리얼을 자동 표시한다. 1단계는 그 자동 표시, 2~10단계는 실제 '다음 ▶' 버튼 클릭으로 이동한다.
       - 10단계 모두 #tutBox 의 실측 사각형을 합집합으로 잡아 같은 클립(동일 크기)으로 캡처 → docs/media/tutorial-01.png … tutorial-10.png
       - 캡처 결과 JSON(단계 제목·클립·해시·환경)은 --manifest <path> 로 저장
         (기본: docs/milestone/v0.4.4/issues/105/Mars/artifacts/capture-manifest.json — 저장소 루트 기준 고정 경로이며 --out 을 따라가지 않는다)
     node tools/media/readme_media_capture.js verify [--readme README.md] [--out docs/milestone/v0.4.4/issues/105/Mars/artifacts] [--viewport 1100x900] [--no-gh] [--no-render] [--full]
       - README 의 로컬 상대 이미지·링크(마크다운·HTML 양쪽)와 #앵커를 파일 시스템·헤딩 슬러그로 검사한다 (대소문자 정확 일치).
       - tutorial-01..10.png 의 크기가 서로 같은지(IHDR) 검사한다.
       - `gh api markdown --input -` (stdin, 읽기 전용 렌더 요청 — GitHub 쓰기·임시 파일 없음) 로 GitHub 가 실제로 sanitize 한 HTML 을 받아
         근사 GitHub CSS 를 붙인 페이지를 같은 임시 서버가 메모리에서 서빙 → 헤드리스 Chrome 이 렌더한다 (디스크 사본 없음).
         이미지 로드(naturalWidth>0)·링크·앵커 해석, 가로 넘침(페이지 폭 vs 뷰포트), 표별 내부 가로 스크롤(display:block 표의 scrollWidth>clientWidth) 을 보고하고
         머리(H1)·H2 섹션별(section-NN.png)·<details> 갤러리(펼친 상태) 캡처(--full 이면 전체 페이지도)와 sanitize HTML 원문·verify-report.json 을 <out> 에 남긴다.
       - --viewport WxH (기본 1100x900). 1100 이 아니면 산출물 이름에 -w<W> 가 붙는다 (예: section-00-w390.png · verify-report-w390.json).
       - 주의: 렌더 CSS 는 GitHub 마크다운 CSS 의 근사(콘텐츠 폭 1012px·표 display:block·768px 미만 padding 16px)다. 레이아웃·이미지·링크 해석 검증용이며 github.com 과 픽셀 동일을 주장하지 않는다.
     node tools/media/readme_media_capture.js verify --read-only [--viewport 1100x900|390x844] [--no-gh] [--no-render]
       - Saturn 독립 재검증용. 위 verify 와 같은 검사(헤드리스 Chrome 실제 렌더 포함)를 수행하되 stdout 으로만 보고한다 — HTML·PNG·JSON 어느 것도 저장하지 않는다.
     node tools/media/readme_media_capture.js capture --read-only [--allow-hash-diff]
       - 파일을 쓰지 않고 같은 절차로 10단계를 다시 캡처해 메모리에서 docs/media/tutorial-NN.png 와 크기·sha256 을 비교한다.
       - 판정: 10장 바이트 동일 = PASS(0). 바이트가 다르면 기본은 FAIL(1) — 같은 기기·같은 Chrome 이면 동일해야 한다.
         다른 기기·폰트·Chrome 버전이 원인인 경우에만 --allow-hash-diff 로 크기·단계 제목 일치 기준 CONDITIONAL(0) 로 낮출 수 있으며, 요약 행에 불일치 장수와 사람 검수 필요를 명시한다 (전체 PASS 로 표기하지 않음).
     gh 렌더 실패 처리: verify 에서 --no-gh 를 명시하지 않았는데 `gh api markdown` 이 실패하면 필수 검증 미수행 = FAIL 로 보고하고 종료 코드 2(환경 오류)로 끝난다. WARN 후 0 으로 끝나지 않는다.
       오프라인 로컬 검사만 원하면 --no-gh 를 명시한다 (요약 행에 '부분 검증' 표기).
     node tools/media/readme_media_capture.js selfcheck
       - 이 파일의 소스를 정적 검사한다: fs 변경 호출이 허용 지점(writeArtifact·ensureDir·launchChrome·killChrome) 밖에 하나도 없는지, git/gh 자식 프로세스가 읽기 전용 동사만 쓰는지.

   READ_ONLY (--read-only) 보증 — 세 겹:
     1) 정적 검사(selfcheck)를 실행 시작 시 자동 수행. 허용 지점 밖의 fs 변경 호출이 소스에 있으면 즉시 종료(코드 3).
     2) 런타임 게이트: fs 의 변경 API(writeFileSync·mkdirSync·mkdtempSync·rmSync·unlinkSync·renameSync·copyFileSync·createWriteStream·promises.* 등)를
        이 프로세스에서 가로채, 이 실행이 만든 Chrome 프로필 경로(os.tmpdir()/readme-media-profile-*) 안이 아니면 예외(코드 3)로 중단한다.
        artifact 쓰기 헬퍼(writeArtifact·ensureDir)는 게이트와 별개로 READ_ONLY 면 항상 거부한다.
     3) 실행 전후 관측: README·docs/media·docs/milestone/v0.4.4/issues/105/Mars/artifacts·tools/media/readme_media_capture.js 의 크기·mtime·sha256 스냅샷과
        os.tmpdir() 의 readme-media-* 항목 목록을 비교해 WRITE-CHECK 행으로 보고한다 (변화가 있으면 실패).
     허용되는 유일한 부수 쓰기 = 헤드리스 Chrome 이 쓰는 이 실행 전용 프로필 디렉터리 하나. 종료 시 그 정확한 경로만(다른 프로필·서버 8080 무관) 정리하고 RESOURCE/CLEANUP 행으로 PID·경로를 남긴다.
     gh 는 GH_NO_UPDATE_NOTIFIER=1 로 실행해 갱신 확인 상태 파일 쓰기를 막는다.

   의존: Node 22+(내장 WebSocket · fetch) + 로컬 Chrome + git (+ verify 렌더에 gh CLI). 외부 패키지 없음.
   종료 코드: 0 = 성공 · 1 = 검증 실패(깨진 링크·크기 불일치·캡처 불일치·가로 넘침) · 2 = 환경 오류(Chrome/git/gh 없음) · 3 = READ_ONLY 위반(쓰기 게이트·정적 검사·전후 스냅샷). */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), http=require("http"), crypto=require("crypto");
const {spawn,execFileSync}=require("child_process");

const ROOT=path.resolve(__dirname,"..","..");
const args=process.argv.slice(2);
const cmd=args[0]&&!args[0].startsWith("--")?args[0]:"help";
const opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
const has=k=>args.includes(k);
const READ_ONLY=has("--read-only")||has("--no-write");
let ENV_FAIL=false; // 필수 검증을 환경 문제(gh 실패 등)로 수행하지 못함 → 종료 코드 2
const rel=p=>path.relative(ROOT,p).replace(/\\/g,"/");
const sha256=buf=>crypto.createHash("sha256").update(buf).digest("hex");
const log=(...a)=>console.log(...a);
const parseViewport=(s,d)=>{ const m=String(s||d).match(/^(\d+)x(\d+)$/); if(!m){ const e=new Error("--viewport 형식은 WxH (예: 1100x900)"); e.code=2; throw e; } return [Number(m[1]),Number(m[2])]; };

/* ═════════════════════ READ_ONLY 게이트 ═════════════════════ */
const PROFILE_PREFIX=path.join(os.tmpdir(),"readme-media-profile-");
const OWNED_TMP=new Set(); // 이 실행이 mkdtemp 로 만든 Chrome 프로필 경로 — READ_ONLY 에서 유일하게 허용되는 쓰기 대상
function isOwnedTmp(p){ if(typeof p!=="string"&&!Buffer.isBuffer(p)&&!(p instanceof URL)) return false; const a=path.resolve(p instanceof URL?p.pathname:String(p)); for(const o of OWNED_TMP){ if(a===o||a.startsWith(o+path.sep)) return true; } return false; }
function roViolation(what){ const e=new Error(`READ_ONLY 위반: ${what}`); e.code=3; return e; }
function installReadOnlyGate(){
  // 경로 인자 위치: 대상이 될 수 있는 인자만 검사한다 (writeFileSync 의 data 인자는 경로가 아니다)
  const SITES={writeFileSync:[0],appendFileSync:[0],mkdirSync:[0],rmSync:[0],rmdirSync:[0],unlinkSync:[0],renameSync:[0,1],copyFileSync:[1],truncateSync:[0],symlinkSync:[1],linkSync:[1],chmodSync:[0],utimesSync:[0],createWriteStream:[0],
    writeFile:[0],appendFile:[0],mkdir:[0],rm:[0],rmdir:[0],unlink:[0],rename:[0,1],copyFile:[1],truncate:[0],symlink:[1],link:[1],chmod:[0],utimes:[0]};
  const wrap=(target,name,idx,label)=>{ const orig=target[name]; if(typeof orig!=="function") return;
    target[name]=function(...a){ for(const i of idx){ if(!isOwnedTmp(a[i])) throw roViolation(`${label}.${name}(${String(a[i])}) — 소유 Chrome 프로필 밖 쓰기`); } return orig.apply(this,a); }; };
  for(const [name,idx] of Object.entries(SITES)){ wrap(fs,name,idx,"fs"); wrap(fs.promises,name,idx,"fs.promises"); }
  // openSync/open 은 읽기에도 쓰이므로 flags 가 쓰기일 때만 막는다
  const wo=/[wa+]/; const openSync=fs.openSync; fs.openSync=function(p,flags,...r){ if(flags!==undefined&&typeof flags==="string"&&wo.test(flags)&&!isOwnedTmp(p)) throw roViolation(`fs.openSync(${p},${flags})`); if(typeof flags==="number"&&(flags&3)!==0&&!isOwnedTmp(p)) throw roViolation(`fs.openSync(${p},${flags})`); return openSync.call(this,p,flags,...r); };
  // mkdtemp: 프로필 접두어로만, 결과 경로를 소유 목록에 등록
  const mkdtempSync=fs.mkdtempSync; fs.mkdtempSync=function(prefix,...r){ if(path.resolve(String(prefix))!==path.resolve(PROFILE_PREFIX)) throw roViolation(`fs.mkdtempSync(${prefix}) — 프로필 접두어 아님`); const d=mkdtempSync.call(this,prefix,...r); OWNED_TMP.add(path.resolve(d)); return d; };
  fs.mkdtemp=function(){ throw roViolation("fs.mkdtemp (비동기) 사용 금지"); }; fs.promises.mkdtemp=async function(){ throw roViolation("fs.promises.mkdtemp 사용 금지"); };
  log(`READ_ONLY gate: fs 변경 API ${Object.keys(SITES).length+2}종 가로챔 · 허용 접두어 ${PROFILE_PREFIX}*`);
}

/* ── 정적 자기 검사 (selfcheck) — 이 파일 소스에서 fs 변경 호출·자식 프로세스 동사를 열거해 허용 목록과 대조 ── */
const FS_MUTATORS="writeFileSync|appendFileSync|mkdirSync|mkdtempSync|rmSync|rmdirSync|unlinkSync|renameSync|copyFileSync|truncateSync|symlinkSync|linkSync|chmodSync|utimesSync|createWriteStream|writeFile|appendFile|mkdir|mkdtemp|rm|rmdir|unlink|rename|copyFile|truncate|symlink|link|chmod|utimes|openSync|open";
const ALLOWED_SITES={ // 함수 이름 → 그 안에서 허용되는 fs 변경 호출
  writeArtifact:["writeFileSync"], ensureDir:["mkdirSync"], launchChrome:["mkdtempSync"], killChrome:["rmSync"],
  installReadOnlyGate:["openSync","mkdtempSync","mkdtemp","open"] /* 원본 보관·대체용 참조 (호출은 게이트 통과 후 원본으로) */ };
function selfcheck(){
  const src=fs.readFileSync(__filename,"utf8"), lines=src.split(/\r?\n/);
  const findings=[]; let fn="(top)"; let inHeader=true;
  const callRe=new RegExp(`\\bfs(?:\\.promises)?\\.(${FS_MUTATORS})\\s*(?:\\(|=)`,"g");
  lines.forEach((ln,i)=>{
    if(inHeader){ if(ln.includes("*/")) inHeader=false; return; } // 머리 주석은 제외
    const f=ln.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)||ln.match(/^const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[\w$,\s]*\)?\s*=>/); if(f) fn=f[1];
    for(const m of ln.matchAll(callRe)){ const ok=(ALLOWED_SITES[fn]||[]).includes(m[1]); findings.push({line:i+1,fn,call:m[0].replace(/\s*[(=]$/,""),ok}); }
  });
  // 자식 프로세스: git 은 show/rev-parse/config --get 만, gh 는 api markdown 만
  const procs=[]; lines.forEach((ln,i)=>{ for(const m of ln.matchAll(/(?:execFileSync|spawn|execSync|exec|spawnSync)\(\s*("git"|"gh"|CHROME)\s*,\s*\[([^\]]*)\]/g)){
    const bin=m[1].replace(/"/g,""), a=m[2]; let ok=true, why="";
    if(bin==="git"){ ok=/^"(show|rev-parse|config)"/.test(a.trim()); if(a.includes('"config"')) ok=ok&&a.includes('"--get"'); why=ok?"":"허용 동사(show·rev-parse·config --get) 아님"; }
    if(bin==="gh"){ ok=/^"api"\s*,\s*"markdown"/.test(a.trim()); why=ok?"":"gh api markdown 이외"; }
    procs.push({line:i+1,bin,args:a.trim().slice(0,80),ok,why}); } });
  const badF=findings.filter(f=>!f.ok), badP=procs.filter(p=>!p.ok);
  const verbs=[...src.matchAll(/\["(commit|push|stash|checkout|reset|add|merge|rebase|tag|branch)"/g)].map(m=>m[1]);
  return {file:rel(__filename),sha256:sha256(src),lines:lines.length,fsCalls:findings,procCalls:procs,gitWriteVerbs:verbs,ok:badF.length===0&&badP.length===0&&verbs.length===0};
}
function printSelfcheck(sc){
  log(`== selfcheck ${sc.file} (${sc.lines}줄, sha256=${sc.sha256})`);
  for(const f of sc.fsCalls) log(`${f.ok?"OK  ":"FAIL"} L${f.line} ${f.fn}(): ${f.call}${f.ok?"":"  ← 허용 지점 밖 fs 변경 호출"}`);
  for(const p of sc.procCalls) log(`${p.ok?"OK  ":"FAIL"} L${p.line} child ${p.bin} [${p.args}] ${p.why}`);
  log(`git 쓰기 동사(commit/push/stash/…) 출현 ${sc.gitWriteVerbs.length}건 · 허용 지점: ${Object.entries(ALLOWED_SITES).filter(([k])=>k!=="installReadOnlyGate").map(([k,v])=>k+"("+v.join(",")+")").join(" · ")}`);
  log(`=== selfcheck: ${sc.ok?"OK":"FAIL"}`);
}

/* ── 실행 전후 스냅샷 (READ_ONLY 관측) ── */
const WATCH=()=>[path.join(ROOT,"README.md"),path.join(ROOT,"docs","media"),path.join(ROOT,"docs","milestone","v0.4.4","issues","105","Mars","artifacts"),__filename];
function snapshotFiles(){
  const m=new Map(); const add=f=>{ try{ const st=fs.statSync(f); if(st.isDirectory()){ for(const n of fs.readdirSync(f)) add(path.join(f,n)); } else m.set(rel(f),{size:st.size,mtime:st.mtimeMs,sha:sha256(fs.readFileSync(f))}); }catch(e){} };
  for(const f of WATCH()) add(f);
  let tmpEntries=[]; try{ tmpEntries=fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith("readme-media-")); }catch(e){}
  return {files:m,tmpEntries};
}
function diffSnapshots(a,b){
  const changed=[]; for(const [k,v] of a.files){ const w=b.files.get(k); if(!w) changed.push(`삭제됨 ${k}`); else if(w.size!==v.size||w.sha!==v.sha||w.mtime!==v.mtime) changed.push(`변경됨 ${k}`); }
  for(const k of b.files.keys()) if(!a.files.has(k)) changed.push(`생성됨 ${k}`);
  const newTmp=b.tmpEntries.filter(n=>!a.tmpEntries.includes(n));
  return {changed,newTmp,count:a.files.size};
}

/* ── artifact 쓰기 (유일한 저장소 쓰기 경로 — READ_ONLY 면 항상 거부) ── */
function assertWritable(what){ if(READ_ONLY) throw roViolation(`${what} — READ_ONLY 에서 artifact 쓰기 시도`); }
function writeArtifact(p,buf){ assertWritable(`writeArtifact(${rel(p)})`); fs.writeFileSync(p,buf); return rel(p); }
function ensureDir(d){ assertWritable(`ensureDir(${rel(d)})`); fs.mkdirSync(d,{recursive:true}); }

/* ── PNG IHDR 크기 ───────────────────────────────────────────────────────── */
function pngSize(buf){ if(!buf||buf.length<24||buf.toString("ascii",1,4)!=="PNG") return null; return {w:buf.readUInt32BE(16),h:buf.readUInt32BE(20)}; }

/* ── git 읽기 전용 접근 (show/rev-parse/config --get 만 — 작업 트리·인덱스·refs 를 바꾸는 명령은 이 파일에 없다) ──────────────── */
function gitShow(ref,file){ return execFileSync("git",["show",`${ref}:${file}`],{cwd:ROOT,maxBuffer:64*1024*1024,stdio:["ignore","pipe","ignore"]}); }
function gitRev(ref){ return execFileSync("git",["rev-parse",ref],{cwd:ROOT}).toString().trim(); }
function gitBlob(ref,file){ return execFileSync("git",["rev-parse",`${ref}:${file}`],{cwd:ROOT}).toString().trim(); }
function repoSlug(){ try{ const u=execFileSync("git",["config","--get","remote.origin.url"],{cwd:ROOT}).toString().trim(); const m=u.match(/github\.com[:/]([^/]+\/[^/.]+)/); return m?m[1]:null; }catch(e){ return null; } }

/* ── 헤드리스 Chrome + CDP (demo/test/milestone/v0.4.0/issues/42/tut_layout_cdp.js 의 패턴을 재사용) ───────────────────────────────── */
const CHROME=opt("--chrome",[process.env.CHROME_PATH,"C:/Program Files/Google/Chrome/Application/chrome.exe","C:/Program Files (x86)/Google/Chrome/Application/chrome.exe","/usr/bin/google-chrome","/usr/bin/chromium","/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].filter(Boolean).find(p=>fs.existsSync(p)));
function launchChrome(){
  if(!CHROME){ const e=new Error("Chrome을 찾지 못했습니다 (--chrome <경로> 또는 CHROME_PATH)"); e.code=2; throw e; }
  return new Promise((res,rej)=>{
    const udd=fs.mkdtempSync(PROFILE_PREFIX); // 이 실행 전용 프로필 — 종료 시 이 경로만 정리 (READ_ONLY 게이트가 등록)
    OWNED_TMP.add(path.resolve(udd));
    const p=spawn(CHROME,["--headless=new","--remote-debugging-port=0","--user-data-dir="+udd,"--no-first-run","--no-default-browser-check","--disable-gpu","--hide-scrollbars","--allow-file-access-from-files","--lang=ko-KR","--force-device-scale-factor=1","about:blank"],{stdio:["ignore","pipe","pipe"]});
    let err="", done=false; const t=setTimeout(()=>rej(new Error("Chrome DevTools 포트 대기 시간 초과\n"+err)),20000);
    p.stderr.on("data",d=>{ if(done) return; err+=d; const m=err.match(/DevTools listening on (ws:\/\/\S+)/); if(m){ done=true; clearTimeout(t); log(`RESOURCE chrome pid=${p.pid} profile=${udd}`); res({proc:p,ws:m[1],udd}); } });
    p.on("exit",c=>{ clearTimeout(t); rej(new Error("Chrome 종료 "+c+"\n"+err)); });
  });
}
function killChrome(ch){ // 이 실행이 띄운 PID 와 mkdtemp 경로만 정리 — 절대 경로가 소유 목록·프로필 접두어와 정확히 일치할 때만 rm
  if(!ch) return; try{ ch.proc.kill(); }catch(e){}
  const rm=()=>{ const abs=path.resolve(ch.udd); const own=OWNED_TMP.has(abs)&&abs.startsWith(path.resolve(PROFILE_PREFIX));
    if(own){ try{ fs.rmSync(abs,{recursive:true,force:true}); }catch(e){} }
    log(`CLEANUP chrome pid=${ch.proc.pid} profile=${abs} owned=${own} removed=${!fs.existsSync(abs)}`); };
  return new Promise(res=>setTimeout(()=>{ rm(); res(); },700));
}
class CDP{
  constructor(ws){ this.ws=ws; this.id=0; this.pending=new Map(); this.waiters=[];
    ws.onmessage=ev=>{ const m=JSON.parse(ev.data); if(m.id&&this.pending.has(m.id)){ const {res,rej}=this.pending.get(m.id); this.pending.delete(m.id); m.error?rej(new Error(JSON.stringify(m.error))):res(m.result); }
      else if(m.method){ const w=this.waiters.find(x=>x.method===m.method&&(!x.sid||x.sid===m.sessionId)); if(w){ this.waiters.splice(this.waiters.indexOf(w),1); w.res(m.params); } } }; }
  send(method,params,sessionId){ const id=++this.id; return new Promise((res,rej)=>{ this.pending.set(id,{res,rej}); this.ws.send(JSON.stringify({id,method,params:params||{},sessionId})); }); }
  once(method,sid){ return new Promise(res=>this.waiters.push({method,sid,res})); }
}
function connect(url){ return new Promise((res,rej)=>{ const ws=new WebSocket(url); ws.onopen=()=>res(new CDP(ws)); ws.onerror=()=>rej(new Error("WS 오류 "+url)); }); }
async function openPage(cdp){ const {targetId}=await cdp.send("Target.createTarget",{url:"about:blank"}); const {sessionId:sid}=await cdp.send("Target.attachToTarget",{targetId,flatten:true}); await cdp.send("Page.enable",{},sid); await cdp.send("Runtime.enable",{},sid); return sid; }
async function evalJS(cdp,sid,expression){ const r=await cdp.send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true},sid); if(r.exceptionDetails) throw new Error("페이지 스크립트 예외: "+JSON.stringify(r.exceptionDetails.exception||r.exceptionDetails)); return r.result.value; }
async function navigate(cdp,sid,url){ const loaded=cdp.once("Page.loadEventFired",sid); await cdp.send("Page.navigate",{url},sid); await loaded; await evalJS(cdp,sid,"document.fonts?document.fonts.ready.then(()=>true):true"); }
async function shot(cdp,sid,clip){ const {data}=await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:!!clip,clip:clip?{...clip,scale:1}:undefined},sid); return Buffer.from(data,"base64"); }
function chromeVersion(){ try{ const dirs=fs.readdirSync(path.dirname(CHROME)).filter(d=>/^\d+\.\d+\.\d+\.\d+$/.test(d)); return dirs.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})).pop()||"?"; }catch(e){ return "?"; } }

/* ── 메모리 정적 서버 (127.0.0.1:0, 이 실행만 사용, 종료 시 close) ──────────────────────── */
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".json":"application/json",".md":"text/plain; charset=utf-8",".jpg":"image/jpeg",".ico":"image/x-icon",".woff2":"font/woff2"};
function serveGitRef(ref){ // 태그 blob 을 git show 로 읽어 메모리에서 서빙 (디스크 사본 없음)
  const cache=new Map();
  return new Promise(res=>{
    const srv=http.createServer((req,r)=>{
      let p=decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/,"");
      if(!p||p.endsWith("/")) p+="index.html";
      if(!p.startsWith("demo/")||p.includes("..")){ r.writeHead(404); return r.end(); }
      try{ if(!cache.has(p)) cache.set(p,gitShow(ref,p)); const buf=cache.get(p); r.writeHead(200,{"Content-Type":MIME[path.extname(p).toLowerCase()]||"application/octet-stream","Cache-Control":"no-store"}); r.end(buf); }
      catch(e){ r.writeHead(404); r.end(); }
    });
    srv.listen(0,"127.0.0.1",()=>{ log(`RESOURCE http-server pid=${process.pid} port=${srv.address().port} source=git:${ref} (memory)`); res({srv,port:srv.address().port}); });
  });
}
const RENDER_PATH="/__readme-render__.html"; // 렌더 페이지는 서버 루트에 메모리로 두어 README 상대경로(docs/media/…)가 저장소 파일로 해석되게 한다
function serveDir(dir,memPages){ // README 렌더 검증용: 저장소 루트를 읽기 전용으로 서빙 + memPages{path:{body,type}} 메모리 페이지
  return new Promise(res=>{
    const root=path.resolve(dir);
    const srv=http.createServer((req,r)=>{
      let u; try{ u=decodeURIComponent(req.url.split("?")[0]); }catch(e){ r.writeHead(400); return r.end(); }
      if(memPages&&memPages[u]){ r.writeHead(200,{"Content-Type":memPages[u].type,"Cache-Control":"no-store"}); return r.end(memPages[u].body); }
      const p=u.replace(/^\/+/,""); const f=path.resolve(root,p);
      if(!(f===root||f.startsWith(root+path.sep))||p.split(/[\\/]/).includes(".git")||!fs.existsSync(f)||fs.statSync(f).isDirectory()){ r.writeHead(404); return r.end(); }
      r.writeHead(200,{"Content-Type":MIME[path.extname(f).toLowerCase()]||"application/octet-stream"}); r.end(fs.readFileSync(f));
    });
    srv.listen(0,"127.0.0.1",()=>res({srv,port:srv.address().port}));
  });
}

/* ═══════════════════════════════ capture ═══════════════════════════════ */
const PAGE_TUT_STATE=`(()=>{ const t=document.getElementById("tutTitle"), c=document.getElementById("tutCount"), ov=document.getElementById("tutOverlay"), box=document.getElementById("tutBox");
  if(!ov||ov.classList.contains("hidden")||!box) return {open:false};
  const r=box.getBoundingClientRect(); const cards=box.querySelectorAll(".tut-card").length;
  return {open:true,count:c?c.textContent.trim():"",title:t?t.textContent.trim():"",cards,rect:{x:r.left,y:r.top,w:r.width,h:r.height},
    vscroll:box.scrollHeight>box.clientHeight+1,step:(typeof TUT!=="undefined"?TUT.step:null),n:(typeof TUT_STEPS!=="undefined"?TUT_STEPS.length:null),
    expected:(typeof TUT_STEPS!=="undefined"?TUT_STEPS[TUT.step].title:null),
    nav:[...document.querySelectorAll("#tutNav button")].map(b=>b.textContent.trim()+(b.disabled?"(비활성)":""))}; })()`;
const PAGE_CLICK_NEXT=`(()=>{ const b=document.querySelector("#tutNav button.primary"); if(!b||b.disabled||!/다음/.test(b.textContent)) return false; b.click(); return true; })()`;

async function captureTutorial(o){
  const ref=o.ref, refSha=gitRev(ref+"^{commit}"), htmlBlob=gitBlob(ref,"demo/index.html");
  const [vw,vh]=parseViewport(o.viewport,"1280x900"), dpr=o.dpr;
  const htmlBytes=gitShow(ref,"demo/index.html").length; // 읽기 전용 — 작업 트리 demo/index.html 은 건드리지 않고, 디스크 사본도 만들지 않는다
  log(`RESOURCE tag-html ${ref}=${refSha} blob=${htmlBlob} bytes=${htmlBytes} served=memory (no disk copy)`);
  const {srv,port}=await serveGitRef(ref);
  const url=`http://127.0.0.1:${port}/demo/index.html`;
  let ch=null; const frames=[]; let bad=0;
  try{
    ch=await launchChrome(); const cdp=await connect(ch.ws); const sid=await openPage(cdp);
    await cdp.send("Emulation.setDeviceMetricsOverride",{width:vw,height:vh,deviceScaleFactor:dpr,mobile:false},sid);
    await navigate(cdp,sid,url);
    const ua=await evalJS(cdp,sid,"navigator.userAgent");
    // 새 프로필 → tutorialSeen 없음 → 게임이 첫 방문 자동 표시. 자동 표시가 안 됐으면 실패로 기록한다 (tutOpen 강제 호출은 하지 않는다: '처음 켜면 자동으로 열리는' 화면이 목적).
    let st=await evalJS(cdp,sid,PAGE_TUT_STATE);
    if(!st.open){ throw new Error("첫 방문 자동 튜토리얼이 열리지 않음 — "+JSON.stringify(st)); }
    const n=st.n; if(n!==10) log(`WARN 단계 수 ${n} (README 는 10단계 기준)`);
    // 1) 10단계를 실제 '다음 ▶' 클릭으로 순회하며 박스 사각형·제목을 잰다 (합집합 클립 계산)
    const states=[];
    for(let i=0;i<n;i++){
      if(i>0){ const ok=await evalJS(cdp,sid,PAGE_CLICK_NEXT); if(!ok) throw new Error(`'다음 ▶' 클릭 실패 (단계 ${i})`); await new Promise(r=>setTimeout(r,120)); }
      st=await evalJS(cdp,sid,PAGE_TUT_STATE);
      if(!st.open||st.step!==i||!st.title.endsWith(st.expected||"")) { bad++; log(`FAIL 단계 ${i+1}: 상태 불일치 ${JSON.stringify(st)}`); }
      states.push(st);
    }
    const L=Math.floor(Math.min(...states.map(s=>s.rect.x))), T=Math.floor(Math.min(...states.map(s=>s.rect.y)));
    const R=Math.ceil(Math.max(...states.map(s=>s.rect.x+s.rect.w))), B=Math.ceil(Math.max(...states.map(s=>s.rect.y+s.rect.h)));
    const m=o.margin, clip={x:Math.max(0,L-m),y:Math.max(0,T-m),width:Math.min(vw,R+m)-Math.max(0,L-m),height:Math.min(vh,B+m)-Math.max(0,T-m)};
    log(`CLIP x=${clip.x} y=${clip.y} w=${clip.width} h=${clip.height} (css px, dpr ${dpr} → ${clip.width*dpr}x${clip.height*dpr})`);
    // 2) 처음부터 다시 순회하며 같은 클립으로 캡처 — 새로 로드해 1단계는 자동 표시 상태 그대로, 이후는 '다음 ▶' 클릭
    await cdp.send("Runtime.evaluate",{expression:"try{localStorage.removeItem('tutorialSeen')}catch(e){}; true"},sid);
    await navigate(cdp,sid,url);
    for(let i=0;i<n;i++){
      if(i>0){ const ok=await evalJS(cdp,sid,PAGE_CLICK_NEXT); if(!ok) throw new Error(`'다음 ▶' 클릭 실패 (단계 ${i})`); await new Promise(r=>setTimeout(r,120)); }
      st=await evalJS(cdp,sid,PAGE_TUT_STATE);
      await new Promise(r=>setTimeout(r,80));
      const png=await shot(cdp,sid,clip); const sz=pngSize(png);
      const file=`tutorial-${String(i+1).padStart(2,"0")}.png`;
      frames.push({file,step:i+1,count:st.count,title:st.title,cards:st.cards,nav:st.nav,vscroll:st.vscroll,box:{x:Math.round(st.rect.x),y:Math.round(st.rect.y),w:Math.round(st.rect.w),h:Math.round(st.rect.h)},png,size:sz,sha256:sha256(png)});
      log(`STEP ${st.count} "${st.title}" cards=${st.cards} box=${Math.round(st.rect.w)}x${Math.round(st.rect.h)} vscroll=${st.vscroll} → ${file} ${sz.w}x${sz.h} sha256=${sha256(png).slice(0,12)}`);
      if(st.vscroll){ bad++; log(`FAIL 단계 ${i+1}: 박스 내부 세로 스크롤 — 뷰포트를 키워야 전부 보인다`); }
    }
    const env={ref,refSha,htmlBlob,url:`http://127.0.0.1:<port>/demo/index.html (git show ${ref}:demo/* → memory)`,viewport:`${vw}x${vh}`,dpr,clip,chrome:CHROME,chromeVersion:chromeVersion(),userAgent:ua,node:process.version,platform:`${os.platform()} ${os.release()}`,capturedAt:new Date().toISOString()};
    return {env,frames,bad};
  } finally { srv.close(); await killChrome(ch); log(`CLEANUP http-server closed (memory only — no tag-html copy to remove)`); }
}

async function cmdCapture(){
  const o={ref:opt("--ref","v0.4.3"),out:path.resolve(ROOT,opt("--out","docs/media")),viewport:opt("--viewport","1280x900"),dpr:Number(opt("--dpr","2")),margin:Number(opt("--margin","16"))};
  const manifest=path.resolve(ROOT,opt("--manifest",path.join("docs","milestone","v0.4.4","issues","105","Mars","artifacts","capture-manifest.json")));
  const {env,frames,bad}=await captureTutorial(o);
  let fail=bad;
  if(READ_ONLY){ // 파일을 쓰지 않고 기존 docs/media/tutorial-NN.png 와 비교
    const allowDiff=has("--allow-hash-diff"); let same10=0, diff=0;
    for(const f of frames){ const p=path.join(o.out,f.file); if(!fs.existsSync(p)){ fail++; log(`FAIL ${rel(p)} 없음`); continue; }
      const cur=fs.readFileSync(p), cs=pngSize(cur), same=sha256(cur)===f.sha256; if(same) same10++; else { diff++; if(!allowDiff) fail++; }
      log(`${same?"OK  ":allowDiff?"WARN":"FAIL"} ${rel(p)} 저장본 ${cs?cs.w+"x"+cs.h:"?"} sha256=${sha256(cur).slice(0,12)} · 재캡처 ${f.size.w}x${f.size.h} sha256=${f.sha256.slice(0,12)}${same?" (바이트 동일)":" (바이트 다름 — 같은 기기·Chrome 이면 동일해야 함; 폰트·버전 차이가 원인일 때만 --allow-hash-diff, 사람 검수 필요)"}`);
      if(!cs||cs.w!==f.size.w||cs.h!==f.size.h){ fail++; log(`FAIL ${rel(p)} 크기 불일치`); } }
    const verdict=diff===0&&fail===0?`PASS (바이트 동일 ${same10}/${frames.length})`:diff>0&&allowDiff&&fail===0?`CONDITIONAL (크기·제목 일치, 바이트 불일치 ${diff}장 — --allow-hash-diff 로 실패 처리하지 않음, 사람 검수 필요; 전체 PASS 아님)`:`FAIL (바이트 불일치 ${diff}장 · 그 외 문제 ${fail-(allowDiff?0:diff)}건)`;
    log(`\n=== capture --read-only: ${frames.length}단계 재캡처 비교 · 바이트 동일 ${same10}/${frames.length} · 판정 ${verdict} · artifact 쓰기 0`);
    return fail;
  }
  ensureDir(o.out); ensureDir(path.dirname(manifest));
  const written=[];
  for(const f of frames){ written.push(writeArtifact(path.join(o.out,f.file),f.png)); }
  const man={tool:rel(__filename),command:process.argv.slice(1).map(rel).join(" "),env,frames:frames.map(({png,...r})=>({...r,path:rel(path.join(o.out,r.file)),bytes:png.length}))};
  writeArtifact(manifest,JSON.stringify(man,null,1)+"\n");
  log(`\n=== capture: ${written.length}장 → ${rel(o.out)}/ · 매니페스트 ${rel(manifest)} · 문제 ${fail}건`);
  return fail;
}

/* ═══════════════════════════════ verify ═══════════════════════════════ */
function ghSlug(text){ // GitHub 헤딩 앵커 규칙 근사: 소문자 · 공백→하이픈 · 영숫자/하이픈/유니코드 문자 외 제거
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s\-_]/gu,"").replace(/\s/g,"-");
}
function stripMdLinkText(s){ return s.replace(/!?\[[^\]]*\]\([^)]*\)/g,m=>m.replace(/^!?\[/,"").replace(/\]\([^)]*\)$/,"")).replace(/<[^>]+>/g,"").replace(/[`*_]/g,""); }
function scanReadme(readmePath){
  const md=fs.readFileSync(readmePath,"utf8"), dir=path.dirname(readmePath);
  const refs=[]; // {kind:image|link|anchor, target, line}
  const lines=md.split(/\r?\n/);
  const headings=[]; let inCode=false;
  lines.forEach((ln,i)=>{
    if(/^```/.test(ln)) inCode=!inCode; if(inCode) return;
    const h=ln.match(/^(#{1,6})\s+(.*)$/); if(h) headings.push(ghSlug(stripMdLinkText(h[2])));
    for(const m of ln.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) refs.push({kind:m[1]?"image":"link",target:m[2],line:i+1});
    for(const m of ln.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)) refs.push({kind:"image",target:m[1],line:i+1});
    for(const m of ln.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) refs.push({kind:"link",target:m[1],line:i+1});
  });
  const results=[];
  for(const r of refs){
    const t=r.target;
    if(/^(https?:|mailto:|data:)/i.test(t)){ results.push({...r,ok:true,note:"외부"}); continue; }
    if(t.startsWith("#")){ const s=decodeURIComponent(t.slice(1)).toLowerCase(); const ok=headings.includes(s); results.push({...r,ok,note:ok?"앵커":"앵커 헤딩 없음 (헤딩 슬러그: "+headings.join(", ")+")"}); continue; }
    const clean=decodeURIComponent(t.split("#")[0].split("?")[0]);
    const abs=path.resolve(dir,clean);
    let ok=fs.existsSync(abs), note="";
    if(ok){ // 대소문자 정확 일치 (Windows 는 대소문자 무시라 GitHub Linux 에서만 깨지는 경우를 잡는다)
      const parts=clean.split("/").filter(Boolean); let cur=dir;
      for(const seg of parts){ const names=fs.readdirSync(cur); if(!names.includes(seg)){ ok=false; note="대소문자 불일치: "+seg; break; } cur=path.join(cur,seg); }
      if(ok&&r.kind==="image"&&fs.statSync(abs).isDirectory()){ ok=false; note="이미지가 디렉터리"; }
      if(ok&&r.kind==="image"){ const sz=pngSize(fs.readFileSync(abs)); note=sz?`${sz.w}x${sz.h}`:"(png 아님)"; }
    } else note="파일 없음";
    results.push({...r,ok,note,abs});
  }
  return {results,headings,md};
}
function checkTutorialDims(mediaDir){
  const out=[]; let dims=null, ok=true;
  for(let i=1;i<=10;i++){ const f=path.join(mediaDir,`tutorial-${String(i).padStart(2,"0")}.png`); if(!fs.existsSync(f)){ out.push({file:rel(f),ok:false,note:"없음"}); ok=false; continue; }
    const buf=fs.readFileSync(f), sz=pngSize(buf); if(!sz){ out.push({file:rel(f),ok:false,note:"png 아님"}); ok=false; continue; }
    dims=dims||sz; const same=sz.w===dims.w&&sz.h===dims.h; if(!same) ok=false;
    out.push({file:rel(f),ok:same,size:sz,bytes:buf.length,sha256:sha256(buf),note:same?"":"크기 불일치 (기준 "+dims.w+"x"+dims.h+")"}); }
  return {ok,dims,files:out};
}
function ghRenderMarkdown(md,repo){ // 읽기 전용 렌더 요청 (POST /markdown 은 저장소 상태를 바꾸지 않는다) — 본문은 stdin(--input -)으로 전달, 임시 파일 없음
  const body=JSON.stringify({text:md,mode:"gfm",context:repo});
  return execFileSync("gh",["api","markdown","--input","-","-H","Accept: application/vnd.github+json"],{cwd:ROOT,input:body,maxBuffer:32*1024*1024,env:{...process.env,GH_NO_UPDATE_NOTIFIER:"1",GH_PROMPT_DISABLED:"1"}}).toString();
}
/* 근사 GitHub 마크다운 CSS — 레이아웃·이미지·링크 해석 검증용. github.com 과 픽셀 동일하지 않다.
   표는 GitHub 처럼 display:block + overflow:auto (넘치면 표 안에서 가로 스크롤). td[width] 갤러리 표는 GitHub 실측과 같은 꽉 찬 폭이 되도록 display:table 근사. 768px 미만은 padding 16px. */
const RENDER_CSS=`body{margin:0;background:#fff;color:#1f2328;font:16px/1.5 -apple-system,"Segoe UI","Noto Sans KR","Malgun Gothic",Helvetica,Arial,sans-serif}
.markdown-body{max-width:1012px;margin:0 auto;padding:32px;box-sizing:border-box;overflow-wrap:break-word;word-wrap:break-word}
@media (max-width:767px){.markdown-body{padding:16px}}
.markdown-body img{max-width:100%;box-sizing:border-box;background:#fff}
.markdown-body h1{font-size:2em;border-bottom:1px solid #d1d9e0;padding-bottom:.3em;margin:.67em 0}
.markdown-body h2{font-size:1.5em;border-bottom:1px solid #d1d9e0;padding-bottom:.3em;margin:24px 0 16px}
.markdown-body table{border-collapse:collapse;border-spacing:0;width:auto;max-width:100%;display:block;overflow:auto}
.markdown-body table:has(td[width]){display:table;width:100%}
.markdown-body th,.markdown-body td{border:1px solid #d1d9e0;padding:6px 13px}
.markdown-body tr:nth-child(2n){background:#f6f8fa}
.markdown-body pre{background:#f6f8fa;padding:16px;border-radius:6px;overflow:auto;font:85%/1.45 ui-monospace,Consolas,monospace}
.markdown-body code{background:#818b981f;border-radius:6px;padding:.2em .4em;font:85% ui-monospace,Consolas,monospace}
.markdown-body pre code{background:none;padding:0}
.markdown-body a{color:#0969da;text-decoration:none}
.markdown-body details{margin:16px 0}.markdown-body summary{cursor:pointer}
.markdown-body sub{font-size:.75em}.markdown-body li{margin:.25em 0}.markdown-body p{margin:0 0 16px}
.markdown-body td[align=center]{text-align:center}`;

const PAGE_LAYOUT=(vw)=>`(()=>{ const imgs=[...document.images].map(i=>({src:i.getAttribute("src"),ok:i.naturalWidth>0,w:i.naturalWidth,h:i.naturalHeight,disp:Math.round(i.getBoundingClientRect().width)}));
  const links=[...document.querySelectorAll("a[href]")].map(a=>a.getAttribute("href"));
  const secs=[...document.querySelectorAll("h1,h2")].map(h=>{ const r=h.getBoundingClientRect(); return {tag:h.tagName,text:h.textContent.trim(),top:Math.round(r.top+scrollY)}; });
  const tables=[...document.querySelectorAll("table")].map((t,i)=>{ const r=t.getBoundingClientRect(); const cs=getComputedStyle(t); return {index:i,display:cs.display,rows:t.rows.length,cols:t.rows[0]?t.rows[0].cells.length:0,width:Math.round(r.width),scrollWidth:t.scrollWidth,clientWidth:t.clientWidth,hscroll:t.scrollWidth>t.clientWidth+1,right:Math.round(r.right),inDetails:!!t.closest("details"),firstCell:(t.rows[0]&&t.rows[0].cells[0]?t.rows[0].cells[0].textContent.trim().slice(0,30):"")}; });
  const VW=${vw}; const over=[...document.querySelectorAll(".markdown-body *")].filter(e=>{ const r=e.getBoundingClientRect(); return r.right>VW+1&&r.width>0; }).slice(0,8).map(e=>({tag:e.tagName.toLowerCase(),cls:e.className||"",right:Math.round(e.getBoundingClientRect().right),text:(e.textContent||"").trim().slice(0,30)}));
  return {imgs,links,secs,tables,over,height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,bodyWidth:Math.round(document.querySelector(".markdown-body").getBoundingClientRect().width)}; })()`;
const PAGE_DETAILS=`(()=>{ const d=document.querySelector("details"); if(!d) return null; d.open=true; const r=d.getBoundingClientRect(); return {x:0,y:Math.round(r.top+scrollY)-8,width:Math.round(r.width)+16,height:Math.round(r.height)+16,imgs:[...d.querySelectorAll("img")].map(i=>({ok:i.naturalWidth>0,disp:Math.round(i.getBoundingClientRect().width)})),rows:[...d.querySelectorAll("tr")].length,cells:[...d.querySelectorAll("td")].length}; })()`;
const PAGE_IMAGES_SETTLED="Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r}))).then(()=>true)";

async function renderReadme(html,vw,vh,out,suffix){ // GitHub sanitize HTML → 메모리 페이지 → 헤드리스 Chrome. 반환: {fail, report}. READ_ONLY 면 캡처는 stdout 통계만.
  let fail=0;
  const page=`<!doctype html><meta charset="utf-8"><title>README render</title><style>${RENDER_CSS}</style><article class="markdown-body">${html}</article>`;
  const {srv,port}=await serveDir(ROOT,{[RENDER_PATH]:{body:page,type:"text/html; charset=utf-8"}});
  log(`RESOURCE http-server pid=${process.pid} port=${port} root=${ROOT} (읽기 전용) · render page=${RENDER_PATH} (memory, ${Buffer.byteLength(page)} bytes)`);
  let ch=null; const shots=[];
  try{
    ch=await launchChrome(); const cdp=await connect(ch.ws); const sid=await openPage(cdp);
    await cdp.send("Emulation.setDeviceMetricsOverride",{width:vw,height:vh,deviceScaleFactor:1,mobile:false},sid);
    await navigate(cdp,sid,`http://127.0.0.1:${port}${RENDER_PATH}`);
    await evalJS(cdp,sid,PAGE_IMAGES_SETTLED);
    const info=await evalJS(cdp,sid,PAGE_LAYOUT(vw));
    log(`\n== Chrome 렌더 ${vw}x${vh} (근사 GitHub CSS · 콘텐츠 폭 ${info.bodyWidth}px · 페이지 ${info.width}x${info.height})`);
    const localImgs=info.imgs.filter(i=>!/^(https?:|data:)/i.test(i.src)); // 상대 경로 = 저장소 파일
    for(const i of localImgs){ log(`${i.ok?"OK  ":"FAIL"} img ${i.src} natural=${i.w}x${i.h} display=${i.disp}px`); if(!i.ok) fail++; }
    const badgeImgs=info.imgs.length-localImgs.length; log(`외부 배지 이미지 ${badgeImgs}개 (오프라인 상태면 미로드 정상)`);
    const localLinks=info.links.filter(l=>!/^(https?:|mailto:|#)/i.test(l)).map(l=>decodeURIComponent(l));
    for(const l of localLinks){ const ok=fs.existsSync(path.join(ROOT,l.split("#")[0])); log(`${ok?"OK  ":"FAIL"} link ${l}`); if(!ok) fail++; }
    // gh api markdown 출력은 헤딩 id 를 붙이지 않는다(github.com 이 표시 시점에 user-content-<slug> 를 붙임) → 렌더된 헤딩 텍스트의 슬러그로 대조
    const anchorLinks=info.links.filter(l=>l.startsWith("#")); const slugs=info.secs.map(h=>ghSlug(h.text)).concat((await evalJS(cdp,sid,"[...document.querySelectorAll('h3,h4,h5,h6')].map(h=>h.textContent)")).map(ghSlug));
    for(const a of anchorLinks){ const ok=slugs.includes(decodeURIComponent(a.slice(1)).toLowerCase()); log(`${ok?"OK  ":"FAIL"} anchor ${a} (렌더 헤딩 슬러그 대조)`); if(!ok) fail++; }
    // 표: 내부 가로 스크롤(정상 동작 — GitHub 도 display:block 표는 표 안에서 스크롤) 과 페이지 가로 넘침(깨짐) 을 구분해 보고
    log(`표 ${info.tables.length}개:`);
    for(const t of info.tables) log(`${t.hscroll?"INFO":"OK  "} table#${t.index} ${t.rows}x${t.cols} display=${t.display} width=${t.width} scroll=${t.scrollWidth}/${t.clientWidth}${t.hscroll?" ← 표 내부 가로 스크롤 (레이아웃 깨짐 아님)":""}${t.inDetails?" (details 갤러리)":""} "${t.firstCell}"`);
    const tScroll=info.tables.filter(t=>t.hscroll).length;
    if(info.width>vw){ fail++; log(`FAIL 페이지 가로 넘침 ${info.width}>${vw} — 넘친 요소: ${info.over.map(e=>`<${e.tag}${e.cls?"."+e.cls:""} right=${e.right}>"${e.text}"`).join(", ")||"(추적 실패)"}`); }
    else log(`OK   페이지 가로 넘침 없음 (scrollWidth ${info.width} ≤ ${vw}) · 표 내부 스크롤 ${tScroll}개`);
    // 캡처 — 전체 페이지(--full) · 머리(H1)=section-00 · H2 섹션별=section-01… (다음 헤딩 직전까지) · <details> 갤러리 펼침
    await cdp.send("Emulation.setDeviceMetricsOverride",{width:vw,height:Math.min(info.height,16000),deviceScaleFactor:1,mobile:false},sid);
    const save=(name,buf)=>{ if(READ_ONLY){ const sz=pngSize(buf); log(`SHOT(memory) ${name} ${sz.w}x${sz.h} ${buf.length}B sha256=${sha256(buf).slice(0,12)} — 저장 안 함`); return null; } return writeArtifact(path.join(out,name),buf); };
    if(has("--full")) save(`readme-full${suffix}.png`,await shot(cdp,sid));
    const secs=info.secs;
    for(let i=0;i<secs.length;i++){ const s=secs[i]; const next=secs[i+1]; const y=Math.max(0,s.top-8), h=(next?next.top-8:info.height)-y;
      const name=`section-${String(s.tag==="H1"?0:shots.length).padStart(2,"0")}${suffix}.png`; const buf=await shot(cdp,sid,{x:0,y,width:vw,height:Math.min(h,8000)}); const saved=save(name,buf); shots.push({name,text:s.text,height:h,saved,sha256:sha256(buf)}); if(!READ_ONLY) log(`SHOT ${name} h=${h}`); }
    const det=await evalJS(cdp,sid,PAGE_DETAILS); let gallery=null;
    if(det){ await evalJS(cdp,sid,PAGE_IMAGES_SETTLED);
      const det2=await evalJS(cdp,sid,PAGE_DETAILS); const {imgs:di,rows,cells,...clip2}=det2; clip2.x=0; clip2.width=vw; // 이전 산출물과 같은 뷰포트 전폭 클립
      const buf=await shot(cdp,sid,clip2); const saved=save(`gallery-open${suffix}.png`,buf);
      const okN=di.filter(i=>i.ok).length; const widths=[...new Set(di.map(i=>i.disp))];
      log(`GALLERY <details> 펼침: 이미지 ${okN}/${di.length} 로드 · ${rows}행 × ${cells/rows}열 · 썸네일 표시 폭 ${widths.join("/")}px · 클립 ${clip2.width}x${clip2.height}`); if(okN!==di.length){ fail++; log("FAIL 갤러리 이미지 미로드"); }
      gallery={rows,cols:cells/rows,imgs:di.length,loaded:okN,thumbWidths:widths,clip:clip2,saved,sha256:sha256(buf)}; shots.push({name:`gallery-open${suffix}.png`,text:"details 갤러리(펼침)",height:clip2.height,saved,sha256:sha256(buf)}); }
    return {fail,report:{viewport:`${vw}x${vh}`,cssNote:"approximate GitHub markdown CSS — layout/image/link verification only, not pixel-identical to github.com",pageHeight:info.height,pageWidth:info.width,bodyWidth:info.bodyWidth,sections:secs,tables:info.tables,overflowElements:info.over,shots,localImgs,localLinks,anchorLinks,gallery}};
  } finally { srv.close(); await killChrome(ch); log(`CLEANUP render http-server closed (memory page — no disk copy to remove)`); }
}

async function cmdVerify(){
  const readme=path.resolve(ROOT,opt("--readme","README.md"));
  const out=path.resolve(ROOT,opt("--out","docs/milestone/v0.4.4/issues/105/Mars/artifacts"));
  const [vw,vh]=parseViewport(opt("--viewport","1100x900"),"1100x900"); const suffix=vw===1100?"":`-w${vw}`;
  const doGh=!has("--no-gh"), doRender=!has("--no-render");
  let fail=0;
  /* 1) 로컬 링크·이미지·앵커 */
  const {results,headings,md}=scanReadme(readme);
  log(`== README 로컬 참조 검사 (${rel(readme)} sha256=${sha256(md).slice(0,16)}) · 헤딩 ${headings.length}개`);
  for(const r of results){ if(r.note==="외부") continue; log(`${r.ok?"OK  ":"FAIL"} L${r.line} ${r.kind.padEnd(5)} ${r.target} ${r.note||""}`); if(!r.ok) fail++; }
  const ext=results.filter(r=>r.note==="외부").length; log(`외부 URL ${ext}개는 존재 검사 대상 아님 (오프라인 검증)`);
  /* 2) 튜토리얼 10장 크기 일관성 */
  const td=checkTutorialDims(path.join(ROOT,"docs","media"));
  log(`\n== 튜토리얼 10장 크기 일관성: ${td.ok?"OK":"FAIL"} 기준 ${td.dims?td.dims.w+"x"+td.dims.h:"-"}`);
  for(const f of td.files) log(`${f.ok?"OK  ":"FAIL"} ${f.file} ${f.size?f.size.w+"x"+f.size.h:""} ${f.bytes?f.bytes+"B":""} ${f.sha256?"sha256="+f.sha256:""} ${f.note}`);
  if(!td.ok) fail++;
  /* 2b) README 갤러리 캡션·alt 가 캡처 매니페스트의 실제 단계 제목과 맞는지 (출시 태그 텍스트 ↔ README 문구 어긋남 방지) */
  const manPath=path.resolve(ROOT,opt("--manifest",path.join("docs","milestone","v0.4.4","issues","105","Mars","artifacts","capture-manifest.json")));
  if(fs.existsSync(manPath)){ const man=JSON.parse(fs.readFileSync(manPath,"utf8")); log(`\n== 갤러리 캡션 ↔ 캡처 단계 제목 (${rel(manPath)} · ${man.env.ref}=${man.env.refSha.slice(0,7)})`);
    for(const f of man.frames){ const title=f.title.replace(/^\S+\s/,""); // 앞의 아이콘 제거
      const cell=md.split(/\r?\n/).find(l=>l.includes(f.file)); const alt=cell?(cell.match(/alt="([^"]*)"/)||[])[1]||"":""; const cap=cell?(cell.match(/<sub>([^<]*)<\/sub>/)||[])[1]||"":"";
      const ok=!!cell&&(alt.includes(title)||title.startsWith(cap.replace(/^\d+\.\s*/,"")));
      log(`${ok?"OK  ":"FAIL"} ${f.file} 단계 "${f.count}" 제목 "${title}" ↔ README alt "${alt}" 캡션 "${cap}"`); if(!ok) fail++;
      const saved=td.files.find(x=>x.file===f.path); if(saved&&saved.sha256&&saved.sha256!==f.sha256){ log(`WARN ${f.file} 매니페스트 sha256 ≠ 저장본 (매니페스트 ${f.sha256.slice(0,12)} / 파일 ${saved.sha256.slice(0,12)})`); } } }
  else log(`\nWARN 캡처 매니페스트 없음 (${rel(manPath)}) — 캡션 대조 생략`);
  /* 3) GitHub 렌더 (gh api markdown stdin, 읽기 전용) → 헤드리스 Chrome (메모리 페이지) + 이미지·링크·표·넘침 */
  let renderReport=null, ghInfo=null;
  if(doGh){
    let html=null; const repo=repoSlug()||"ChangjoSung/Digit-Duel";
    try{ html=ghRenderMarkdown(md,repo); log(`\n== GitHub 렌더(gh api markdown --input -, context=${repo}): ${Buffer.byteLength(html)} bytes sha256=${sha256(html).slice(0,16)}`); }
    catch(e){ fail++; ENV_FAIL=true; log(`\nFAIL gh api markdown 실패 — GitHub sanitize·Chrome 렌더 검증을 수행하지 못함 (필수 검증 미수행 = 실패, 종료 코드 2; 오프라인 로컬 검사만 원하면 --no-gh 를 명시): ${String(e.message).split("\n")[0]}`); }
    if(html){
      const imgs=[...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
      const anchors=[...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map(m=>m[1]);
      const dropped=results.filter(r=>r.kind==="image"&&!imgs.some(s=>s.endsWith(r.target)||s===r.target));
      log(`렌더 HTML 의 <img> ${imgs.length}개 · <a> ${anchors.length}개 · <details> ${(html.match(/<details/g)||[]).length}개 · sanitize 로 탈락한 README 이미지 ${dropped.length}개`);
      for(const d of dropped){ fail++; log(`FAIL sanitize 탈락 이미지 L${d.line} ${d.target}`); }
      const hasScript=/<script\b/i.test(html); if(hasScript){ fail++; log("FAIL 렌더 HTML 에 <script> 잔존"); }
      ghInfo={bytes:Buffer.byteLength(html),sha256:sha256(html),imgs:imgs.length,anchors:anchors.length,details:(html.match(/<details/g)||[]).length,dropped:dropped.length,script:hasScript};
      if(!READ_ONLY){ ensureDir(out); writeArtifact(path.join(out,`readme-gh-render${suffix}.html`),html); } // GitHub 가 돌려준 sanitize 된 HTML 원문 (증빙) — READ_ONLY 는 저장 안 함
      if(doRender){ if(!READ_ONLY) ensureDir(out); const r=await renderReadme(html,vw,vh,out,suffix); fail+=r.fail; renderReport=r.report; }
    }
  }
  if(!READ_ONLY){
    const report={tool:rel(__filename),toolSha256:sha256(fs.readFileSync(__filename)),command:process.argv.slice(1).map(rel).join(" "),readme:rel(readme),readmeSha256:sha256(md),at:new Date().toISOString(),viewport:`${vw}x${vh}`,fail,refs:results.map(({abs,...r})=>r),headings,tutorial:td,gh:ghInfo,render:renderReport};
    ensureDir(out); const rp=writeArtifact(path.join(out,`verify-report${suffix}.json`),JSON.stringify(report,null,1)+"\n");
    log(`\n=== verify ${vw}x${vh}: 문제 ${fail}건 · 보고서 ${rp}${doGh?"":" · 부분 검증 (--no-gh: GitHub sanitize·Chrome 렌더 생략)"}`);
  } else log(`\n=== verify --read-only ${vw}x${vh}: 문제 ${fail}건 · artifact 쓰기 0 · 렌더 ${renderReport?"수행":"생략"}${doGh?"":" · 부분 검증 (--no-gh 명시)"}${!doRender&&doGh?" · 부분 검증 (--no-render 명시)":""}`);
  return fail;
}

/* ═══════════════════════════════ main ═══════════════════════════════ */
(async()=>{
  if(cmd==="selfcheck"){ const sc=selfcheck(); printSelfcheck(sc); process.exit(sc.ok?0:3); }
  if(cmd!=="capture"&&cmd!=="verify"){ console.log(fs.readFileSync(__filename,"utf8").split("*/")[0].replace(/^\/\*\s?/,"")); process.exit(cmd==="help"?0:2); }
  let before=null;
  if(READ_ONLY){
    const sc=selfcheck(); printSelfcheck(sc); if(!sc.ok) throw roViolation("정적 검사 실패 — 허용 지점 밖 fs 변경 호출 또는 비허용 자식 프로세스 동사");
    installReadOnlyGate();
    before=snapshotFiles(); log(`READ_ONLY snapshot: 감시 파일 ${before.files.size}개 · tmp readme-media-* 기존 항목 ${before.tmpEntries.length}개${before.tmpEntries.length?" ("+before.tmpEntries.join(", ")+" — 이 실행이 만든 것이 아니므로 건드리지 않음)":""}\n`);
  }
  let fail=cmd==="capture"?await cmdCapture():await cmdVerify();
  if(READ_ONLY){
    const after=snapshotFiles(), d=diffSnapshots(before,after);
    for(const c of d.changed) log(`FAIL WRITE-CHECK ${c}`);
    for(const n of d.newTmp) log(`FAIL WRITE-CHECK tmp 잔존 ${path.join(os.tmpdir(),n)}`);
    const ok=d.changed.length===0&&d.newTmp.length===0;
    log(`WRITE-CHECK ${ok?"OK":"FAIL"}: 감시 파일 ${d.count}개 크기·mtime·sha256 ${ok?"불변":"변화 "+d.changed.length+"건"} · tmp readme-media-* 신규 잔존 ${d.newTmp.length}개 · 소유 프로필 ${[...OWNED_TMP].map(p=>p+(fs.existsSync(p)?"(남음!)":"(정리됨)")).join(", ")||"(없음)"}`);
    if(!ok) process.exit(3);
  }
  process.exit(ENV_FAIL?2:fail?1:0);
})().catch(e=>{ console.error("ERROR",e.message||e); process.exit(e.code===2?2:e.code===3?3:2); });
