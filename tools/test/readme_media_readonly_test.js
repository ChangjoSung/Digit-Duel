/* #105 — tools/readme_media_capture.js 의 READ_ONLY 보증을 도구 바깥에서 관측하는 하네스 (Saturn 재검증용).
   도구 내부 WRITE-CHECK 를 믿지 않고, 이 프로세스가 독립적으로 저장소·tmp 스냅샷을 찍어 전후를 비교하고,
   소스를 변조한 사본으로 정적 검사·런타임 게이트가 실제로 위반을 잡는지(음성 대조) 확인한다.

   사용: node tools/test/readme_media_readonly_test.js [--quick] [--no-gh]
     --quick  capture --read-only (Chrome 재캡처, ~20s) 생략
     --no-gh  네트워크 없는 환경: verify 에 --no-gh 를 넘긴다 (gh 렌더·Chrome 렌더 생략)
   이 하네스가 쓰는 파일: os.tmpdir()/rmc-negtest-* (음성 대조용 사본, 종료 시 이 경로만 삭제). 저장소에는 아무것도 쓰지 않는다.
   종료 코드: 0 = 전부 통과 · 1 = 실패 */
"use strict";
const fs=require("fs"), path=require("path"), os=require("os"), crypto=require("crypto"), {spawnSync}=require("child_process");
const ROOT=path.resolve(__dirname,"..",".."), TOOL=path.join(ROOT,"tools","readme_media_capture.js");
const args=process.argv.slice(2), QUICK=args.includes("--quick"), NOGH=args.includes("--no-gh");
const rel=p=>path.relative(ROOT,p).replace(/\\/g,"/");
const sha=b=>crypto.createHash("sha256").update(b).digest("hex");
let failures=0; const check=(ok,msg)=>{ console.log(`${ok?"PASS":"FAIL"} ${msg}`); if(!ok) failures++; return ok; };
function run(file,a,cwd){ const r=spawnSync(process.execPath,[file,...a],{cwd:cwd||ROOT,encoding:"utf8",maxBuffer:64*1024*1024}); return {code:r.status,out:(r.stdout||"")+(r.stderr||"")}; }

/* 독립 스냅샷: 저장소 감시 대상(README·docs/media·docs/qa/issue105-media·tools/·demo/index.html) + tmp 의 readme-media-* 항목 */
const WATCH=[path.join(ROOT,"README.md"),path.join(ROOT,"docs","media"),path.join(ROOT,"docs","qa","issue105-media"),path.join(ROOT,"tools"),path.join(ROOT,"demo","index.html")];
function snap(){ const m={}; const add=f=>{ let st; try{ st=fs.statSync(f); }catch(e){ return; } if(st.isDirectory()){ for(const n of fs.readdirSync(f)) if(n!=="__pycache__") add(path.join(f,n)); } else m[rel(f)]=`${st.size}|${st.mtimeMs}|${sha(fs.readFileSync(f))}`; };
  for(const w of WATCH) add(w); let tmp=[]; try{ tmp=fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith("readme-media-")).sort(); }catch(e){} return {files:m,tmp}; }
function same(a,b){ const ka=Object.keys(a.files).sort(), kb=Object.keys(b.files).sort(); const diffs=[]; for(const k of new Set([...ka,...kb])) if(a.files[k]!==b.files[k]) diffs.push(k); const newTmp=b.tmp.filter(n=>!a.tmp.includes(n)); return {diffs,newTmp,count:ka.length}; }

console.log(`== READ_ONLY 하네스 · 도구 ${rel(TOOL)} sha256=${sha(fs.readFileSync(TOOL))}`);
/* 1) 정적 자기 검사 */
{ const r=run(TOOL,["selfcheck"]); check(r.code===0&&/=== selfcheck: OK/.test(r.out),`selfcheck exit=${r.code}`); }
/* 2) 실제 READ_ONLY 실행들 — 전후 독립 스냅샷 동일 + tmp 잔존 0 + stdout 의 자기 보고 */
const runs=[["verify","--read-only",...(NOGH?["--no-gh"]:[])],["verify","--read-only","--viewport","390x844",...(NOGH?["--no-gh"]:[])]];
if(!QUICK) runs.push(["capture","--read-only"]);
for(const a of runs){
  const before=snap(); const t=Date.now(); const r=run(TOOL,a); const after=snap(); const d=same(before,after);
  const label=a.join(" ");
  check(r.code===0,`${label}: exit=${r.code} (${((Date.now()-t)/1000).toFixed(1)}s)`);
  check(d.diffs.length===0,`${label}: 독립 스냅샷 ${d.count}개 파일 불변${d.diffs.length?" — 변화: "+d.diffs.join(", "):""}`);
  check(d.newTmp.length===0,`${label}: tmp readme-media-* 신규 잔존 ${d.newTmp.length}개`);
  check(/artifact 쓰기 0/.test(r.out)&&/WRITE-CHECK OK/.test(r.out),`${label}: 도구 자기 보고 'artifact 쓰기 0' + 'WRITE-CHECK OK'`);
  check(/CLEANUP chrome .* owned=true removed=true/.test(r.out)||(NOGH&&a[0]==="verify"),`${label}: Chrome 프로필 소유 확인 후 정리`);
  if(a[0]==="verify"&&!NOGH) check(/Chrome 렌더 \d+x\d+/.test(r.out)&&/GALLERY <details> 펼침: 이미지 10\/10 로드/.test(r.out),`${label}: 헤드리스 렌더 수행 + 갤러리 10/10`);
  if(a[0]==="capture") check(/바이트 동일 10\/10/.test(r.out),`${label}: 저장본 10장과 바이트 동일`);
  if(!/(^|\n)FAIL/.test(r.out)) console.log(`     (stdout FAIL 행 0)`); else { failures++; console.log(`FAIL ${label}: stdout 에 FAIL 행:\n`+r.out.split("\n").filter(l=>/^FAIL/.test(l)).join("\n")); }
}
/* 3) 음성 대조 — 변조 사본에서 위반이 실제로 잡히는가 (사본은 이 하네스 소유 tmp 경로에만) */
const neg=fs.mkdtempSync(path.join(os.tmpdir(),"rmc-negtest-")); fs.mkdirSync(path.join(neg,"tools"));
try{
  const src=fs.readFileSync(TOOL,"utf8"); const marker="  /* 1) 로컬 링크·이미지·앵커 */";
  check(src.includes(marker),"변조 지점(marker) 존재");
  // A) 정적으로 보이는 위반 → selfcheck FAIL(3)
  const a=path.join(neg,"tools","inject_static.js"); fs.writeFileSync(a,src.replace(marker,'  fs.writeFileSync(path.join(ROOT,"STRAY.txt"),"x");\n'+marker));
  const ra=run(a,["selfcheck"],neg); check(ra.code===3&&/FAIL L\d+ cmdVerify\(\): fs\.writeFileSync/.test(ra.out),`음성 A: 정적 검사가 허용 지점 밖 writeFileSync 를 잡음 exit=${ra.code}`);
  // B) 정적 검사를 피한 동적 호출 → 런타임 게이트가 잡고(3) 파일은 생기지 않음
  const b=path.join(neg,"tools","inject_runtime.js"); fs.writeFileSync(b,src.replace(marker,'  fs["write"+"FileSync"](path.join(ROOT,"STRAY.txt"),"x");\n'+marker));
  const rb=run(b,["verify","--read-only","--no-gh"],neg); check(rb.code===3&&/READ_ONLY 위반: fs\.writeFileSync\(.*STRAY\.txt\)/.test(rb.out)&&!fs.existsSync(path.join(neg,"STRAY.txt")),`음성 B: 런타임 게이트가 동적 writeFileSync 를 차단 exit=${rb.code} · STRAY.txt 생성 안 됨=${!fs.existsSync(path.join(neg,"STRAY.txt"))}`);
  // C) 정적 검사를 피한 동적 mkdtemp(프로필 접두어 아님) → 런타임 게이트가 접두어 불일치로 차단 (정적으로 보이는 mkdtemp 는 A 처럼 selfcheck 단계에서 먼저 잡힌다)
  const c=path.join(neg,"tools","inject_mkdtemp.js"); fs.writeFileSync(c,src.replace(marker,'  fs["mkdtemp"+"Sync"](path.join(os.tmpdir(),"readme-media-src-"));\n'+marker));
  const rc=run(c,["verify","--read-only","--no-gh"],neg); check(rc.code===3&&/프로필 접두어 아님/.test(rc.out),`음성 C: 프로필 접두어가 아닌 mkdtemp 차단 exit=${rc.code}`);
  const leaked=fs.readdirSync(os.tmpdir()).filter(n=>n.startsWith("readme-media-src-")); check(leaked.length===0,`음성 C: tmp 에 readme-media-src-* 생성 안 됨 (${leaked.length})`);
  // D) 같은 사본을 READ_ONLY 없이 돌리면 게이트가 없다 (게이트가 --read-only 범위임을 확인) — STRAY.txt 가 사본 루트(neg)에만 생긴다
  const rd=run(b,["verify","--no-gh","--out",path.join(neg,"out")],neg); check(fs.existsSync(path.join(neg,"STRAY.txt")),`대조 D: --read-only 없이는 게이트 없음 (사본 루트에 STRAY.txt 생성, exit=${rd.code} — README 없는 사본이라 이후 ENOENT 는 정상)`);
} finally { fs.rmSync(neg,{recursive:true,force:true}); console.log(`CLEANUP ${neg} removed=${!fs.existsSync(neg)}`); }
console.log(`\n=== READ_ONLY 하네스: ${failures?failures+"건 실패":"전부 통과"}`);
process.exit(failures?1:0);
