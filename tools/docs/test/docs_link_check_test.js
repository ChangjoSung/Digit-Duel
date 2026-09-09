/* #132 tools/docs/docs_link_check.js 회귀 — node tools/docs/test/docs_link_check_test.js [--verbose]
 *
 * 이 하네스가 증명해야 하는 것은 두 가지다.
 *   1) 검사기가 실제로 깨진 링크를 **잡는다** (음성 대조가 없으면 "문제 0건"은 아무 의미가 없다)
 *   2) 실패가 **종료 코드로 전파된다** — CI 는 stdout 을 읽지 않고 exit code 만 본다.
 *      예외로 죽는 경우와 응답이 없어 강제 종료되는 경우까지 0 이 아님을 확인한다.
 *
 * 픽스처 격리: 저장소에는 아무것도 쓰지 않는다. 모든 픽스처는 os.tmpdir() 아래
 *   `ddlc-fixture-*` 로 직접 만든 임시 디렉터리 안에만 만들고, 종료 시 **그 경로만** 지운다.
 *   (저장소를 일부러 깨뜨려 CI 를 빨갛게 만드는 방식은 쓰지 않는다.)
 *   검사기가 git ls-files 로 대상을 고르므로 픽스처도 임시 git 저장소로 만든다 —
 *   이 저장소(Digit-Duel)의 git 상태는 읽지도 쓰지도 않는다.
 *
 * 종료 코드: 0 = 전부 통과 · 1 = 실패
 */
"use strict";
const fs=require("fs"), os=require("os"), path=require("path");
const {spawnSync,execFileSync}=require("child_process");

const VERBOSE=process.argv.includes("--verbose");
const TOOL=path.resolve(__dirname,"..","docs_link_check.js");
const FIXTURE_PREFIX="ddlc-fixture-";
let failed=0;
function check(name,cond,detail){
  if(cond){ console.log("  ok   "+name); return true; }
  failed++; console.log("  FAIL "+name+(detail?"\n       "+String(detail).replace(/\n/g,"\n       "):""));
  return false;
}

/* ── 소유 임시 경로 만들기·지우기 ──
   지우기 전에 (1) os.tmpdir() 하위인지 (2) 이름이 우리 접두사인지 (3) 실재 디렉터리인지를
   모두 확인한다. 하나라도 어긋나면 지우지 않는다 — 상위 경로 재귀 삭제 사고를 원천 차단. */
const owned=[];
function mkFixture(){
  const dir=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),FIXTURE_PREFIX));
  owned.push(dir);
  return dir;
}
function removeOwned(dir){
  const tmp=fs.realpathSync(os.tmpdir());
  const abs=path.resolve(dir);
  const base=path.basename(abs);
  const insideTmp=abs.startsWith(tmp+path.sep)&&abs!==tmp;
  const ownedName=base.startsWith(FIXTURE_PREFIX)&&base.length>FIXTURE_PREFIX.length;
  let isDir=false; try{ isDir=fs.statSync(abs).isDirectory(); }catch(e){ return "없음"; }
  if(!(insideTmp&&ownedName&&isDir)) return `거부 (tmp내부=${insideTmp} 소유이름=${ownedName} 디렉터리=${isDir})`;
  fs.rmSync(abs,{recursive:true,force:true});
  return "삭제";
}

/* 파일을 쓰고 git 인덱스에 올린다 (커밋 불필요 — ls-files 는 인덱스를 본다) */
function seed(dir,files,{track=true}={}){
  for(const [rel,body] of Object.entries(files)){
    const abs=path.join(dir,rel);
    fs.mkdirSync(path.dirname(abs),{recursive:true});
    fs.writeFileSync(abs,body,"utf8");
  }
  if(track) execFileSync("git",["-C",dir,"add","-A","--","."],{stdio:"ignore"});
}
function initRepo(){
  const dir=mkFixture();
  execFileSync("git",["-C",dir,"init","-q"],{stdio:"ignore"});
  return dir;
}
function runTool(dir,extra){
  const r=spawnSync(process.execPath,[TOOL,"--root",dir,...(extra||[])],{encoding:"utf8",maxBuffer:1<<24});
  return {code:r.status,out:(r.stdout||"")+(r.stderr||"")};
}

try{
  /* ===== 1. 정상 문서 — 통과해야 한다 (오탐 없음) ===== */
  {
    const d=initRepo();
    seed(d,{
      "README.md":"# t\n\n[문서](docs/guide.md)\n![그림](docs/img/a.png)\n"
        +'<a href="docs/guide.md"><img src="docs/img/a.png" alt="x"></a>\n',
      "docs/guide.md":"# g\n\n[루트로](../README.md)\n",
      "docs/img/a.png":"png",
    });
    const r=runTool(d);
    check("정상 문서: exit 0",r.code===0,`code=${r.code}\n${r.out}`);
    check("정상 문서: 내부 링크를 실제로 셌다",/내부 링크 [1-9]\d*건/.test(r.out),r.out);
  }

  /* ===== 2. 음성 대조 — 깨진 링크를 잡는가 ===== */
  {
    const d=initRepo();
    seed(d,{"README.md":"[없는 문서](docs/gone.md)\n","docs/keep.md":"# k\n"});
    const r=runTool(d);
    check("대상 없음: exit 1",r.code===1,`code=${r.code}\n${r.out}`);
    check("대상 없음: 사유 표기",/대상 없음/.test(r.out)&&/docs\/gone\.md/.test(r.out),r.out);
  }
  {
    const d=initRepo();
    seed(d,{"README.md":'<img src="docs/Img/a.png">\n',"docs/img/a.png":"png"});
    const r=runTool(d);
    check("대소문자 불일치: exit 1",r.code===1,`code=${r.code}\n${r.out}`);
    check("대소문자 불일치: 실제 이름을 알려준다",/대소문자 불일치/.test(r.out)&&/'img'/.test(r.out),r.out);
  }
  {
    const d=initRepo();
    seed(d,{"docs/deep/note.md":"[밖으로](../../../etc/passwd)\n"});
    const r=runTool(d);
    check("저장소 밖 참조: exit 1",r.code===1,`code=${r.code}\n${r.out}`);
    check("저장소 밖 참조: 사유 표기",/저장소 밖 참조/.test(r.out),r.out);
  }
  {
    // HTML 이미지가 깨진 경우도 잡아야 한다 — README 가 실제로 쓰는 형태
    const d=initRepo();
    seed(d,{"README.md":'<a href="docs/qa/x/shot.png"><img src="docs/qa/x/shot.png"></a>\n'});
    const r=runTool(d);
    check("HTML href/src 깨짐: exit 1",r.code===1,`code=${r.code}\n${r.out}`);
    check("HTML href/src 깨짐: 2건 모두 집계",/문제 2건/.test(r.out),r.out);
  }

  /* ===== 3. 오탐 방지 — 링크가 아닌 것을 링크로 보지 않는가 ===== */
  {
    const d=initRepo();
    seed(d,{"README.md":[
      "[외부](https://example.com/a.png)",
      "[앵커](#섹션)",
      "[메일](mailto:a@b.c)",
      "[프로토콜상대](//cdn.example.com/x.js)",
      "[문서앵커](docs/guide.md#절)",
      "",
      "역사적 명령문: `git show d614392:demo/index.html` 과 `[지운문서](docs/deleted.md)`",
      "",
      "```bash",
      "cat docs/also-deleted.md",
      "[펜스 안 링크](docs/never.md)",
      "```",
      "",
    ].join("\n"),"docs/guide.md":"# g\n"});
    const r=runTool(d);
    check("외부·앵커·코드: exit 0 (오탐 없음)",r.code===0,`code=${r.code}\n${r.out}`);
    check("외부·앵커·코드: 제외 건수를 셌다",/외부\/앵커\/코드 [1-9]\d*건 제외/.test(r.out),r.out);
    check("문서#앵커는 경로만 검사해 통과",/문제 0건/.test(r.out),r.out);
  }

  /* ===== 4. 추적되지 않은 파일은 스캔하지 않는다 (보호 대상 미traversal) ===== */
  {
    const d=initRepo();
    seed(d,{"README.md":"# ok\n"});
    seed(d,{"untracked-note.md":"[깨진 링크](docs/nope.md)\n"},{track:false});
    const r=runTool(d);
    check("추적되지 않은 .md 는 스캔 대상 아님: exit 0",r.code===0,`code=${r.code}\n${r.out}`);
    check("추적되지 않은 .md 는 문서 수에 안 들어감",/문서 1개/.test(r.out),r.out);
  }

  /* ===== 5. 실패의 종료 코드 전파 — CI 는 exit code 만 본다 ===== */
  {
    // 5a. 환경 오류: git 저장소가 아닌 경로 → 2
    const d=mkFixture();
    const r=runTool(d);
    check("git 저장소 아님: exit 2 (환경 오류)",r.code===2,`code=${r.code}\n${r.out}`);
  }
  {
    // 5b. 예외로 죽는 헬퍼 → 0 이 아니다
    const d=mkFixture();
    const crash=path.join(d,"crash.js");
    fs.writeFileSync(crash,'throw new Error("의도적 크래시");\n',"utf8");
    const r=spawnSync(process.execPath,[crash],{encoding:"utf8"});
    check("크래시 헬퍼: 종료 코드 0 아님",r.status!==0&&r.status!=null,`status=${r.status}`);
  }
  {
    // 5c. 응답 없는 헬퍼 → 강제 종료되고 성공(0)으로 보이지 않는다
    const d=mkFixture();
    const hang=path.join(d,"hang.js");
    fs.writeFileSync(hang,"setInterval(()=>{},1000);\n","utf8");
    const r=spawnSync(process.execPath,[hang],{encoding:"utf8",timeout:1500,killSignal:"SIGKILL"});
    const treatedAsFailure=r.status!==0; // null(신호 종료) 또는 0 이 아닌 코드
    check("무응답 헬퍼: 타임아웃 강제 종료가 성공으로 집계되지 않음",
      treatedAsFailure,`status=${r.status} signal=${r.signal} killed=${r.killed}`);
    check("무응답 헬퍼: 실제로 타임아웃으로 죽었다",r.killed===true||r.signal!=null,
      `status=${r.status} signal=${r.signal} killed=${r.killed}`);
  }

  /* ===== 6. 추적 중인데 읽을 수 없는 문서 — 조용히 건너뛰면 안 된다 =====
     git 이 추적한다고 한 파일이 작업 트리에 없으면, 검사기가 그것을 "검사할 것이 없다"로 넘겨
     통과시켜서는 안 된다. 문제로 기록하고 0 이 아닌 코드로 끝나야 한다. */
  {
    const d=initRepo();
    seed(d,{"README.md":"# ok\n","docs/ghost.md":"# 사라질 문서\n"});
    fs.rmSync(path.join(d,"docs","ghost.md"));      // 인덱스에는 남고 작업 트리에서만 사라진다
    const r=runTool(d);
    check("추적 문서 부재: exit 1 (조용한 통과 금지)",r.code===1,`code=${r.code}\n${r.out}`);
    check("추적 문서 부재: 사유·파일명 보고",
      /추적 문서를 읽지 못함/.test(r.out)&&/docs\/ghost\.md/.test(r.out),r.out);
    check("추적 문서 부재: 문서 수에는 그대로 잡힌다",/문서 2개/.test(r.out),r.out);
  }

  /* ===== 7. 심볼릭 링크·Windows 정션으로 저장소 밖을 읽지 않는다 =====
     디렉터리 링크는 Windows 에서 정션(fs.symlinkSync(..., "junction")), 그 밖에서는 dir 심볼릭 링크로
     만든다 — 양쪽 모두 관리자 권한 없이 생성된다. 만들지 못하는 환경이면 사유를 남기고 건너뛴다.

     OS 차이 주의: 링크를 먼저 만들고 `git add` 하면 Linux 는 **링크 자체만** 추적하고 그 아래 자식은
     추적하지 않는다 (Windows 정션은 자식까지 추적한다). 그래서 source 픽스처는 링크를 나중에 끼운다 —
     ① 진짜 디렉터리와 자식 MD 를 만들어 stage 하고 ② 그 디렉터리만 지운 뒤 ③ 외부 링크로 교체한다.
     인덱스는 그대로이므로 **두 OS 에서 같은 "추적되는 자식" 상태**가 된다. */
  const LINK_TYPE=process.platform==="win32"?"junction":"dir";
  function mkLink(target,linkPath){
    try{ fs.symlinkSync(target,linkPath,LINK_TYPE); return null; }
    catch(e){ return e.code||String(e.message); }
  }
  /* 링크 너머 문서를 실제로 읽었는지 가리는 표식: 외부 파일 안에 **깨진 링크**를 심어 둔다.
     검사기가 그 파일을 읽었다면 그 깨진 링크가 반드시 보고된다. 보고되지 않는다는 것은
     "본문 문자열이 출력에 없다"보다 강한 미열람 근거다 (본문 부재만으로는 증명이 되지 않는다). */
  const EXTERNAL_MARK="does-not-exist-outside.md";
  const EXTERNAL_BODY="# 저장소 밖 내용\n\n[밖의 깨진 링크]("+EXTERNAL_MARK+")\n";

  /* ── 7a. target: 링크를 통해 저장소 밖을 가리키는 **링크 대상** ──
     링크 생성 뒤 다시 stage 하지 않는다 → 두 OS 모두 추적 문서는 README.md 하나뿐. */
  {
    const d=initRepo();
    const outside=mkFixture();
    fs.mkdirSync(path.join(outside,"payload"),{recursive:true});
    fs.writeFileSync(path.join(outside,"payload","secret.md"),EXTERNAL_BODY,"utf8");
    seed(d,{"README.md":"[밖으로](linked/secret.md)\n"});          // 링크 만들기 전에 stage
    const err=mkLink(path.join(outside,"payload"),path.join(d,"linked"));
    if(err){
      console.log("  SKIP 7a target 저장소 밖 링크 — "+LINK_TYPE+" 링크 생성 실패 ("+err+", platform="+process.platform+")");
    }else{
      const r=runTool(d);
      check("7a target: exit 1",r.code===1,`code=${r.code}\n${r.out}`);
      check("7a target: 저장소 밖 링크로 거부",/저장소 밖 링크/.test(r.out),r.out);
      check("7a target: 추적 문서는 README 하나 (OS 무관)",/문서 1개/.test(r.out),r.out);
    }
  }

  /* ── 7b. source: **부모가 외부 링크**인 추적 문서 (자식 자체는 일반 파일) ──
     최종 성분만 lstat 하면 그냥 통과해 버리는 경로다. 읽기 전에 전체 realpath 로 경계를 봐야 잡힌다. */
  {
    const d=initRepo();
    const outside=mkFixture();
    fs.mkdirSync(path.join(outside,"sub"),{recursive:true});
    fs.writeFileSync(path.join(outside,"sub","a.md"),EXTERNAL_BODY,"utf8");
    // ① 진짜 디렉터리 + 자식 MD 를 stage (두 OS 모두 docs/sub/a.md 가 추적된다)
    seed(d,{"README.md":"# ok\n","docs/sub/a.md":"# 안쪽 원본\n"});
    // ② 진짜 디렉터리만 제거하고 ③ 외부 링크로 교체 — 인덱스는 그대로
    fs.rmSync(path.join(d,"docs","sub"),{recursive:true,force:true});
    const err=mkLink(path.join(outside,"sub"),path.join(d,"docs","sub"));
    if(err){
      console.log("  SKIP 7b source 부모 링크 — "+LINK_TYPE+" 링크 생성 실패 ("+err+", platform="+process.platform+")");
    }else{
      const tracked=execFileSync("git",["-C",d,"ls-files"],{encoding:"utf8"});
      check("7b source: 두 OS 모두 자식 MD 가 추적된다 (픽스처 전제)",
        /docs\/sub\/a\.md/.test(tracked),tracked);
      const r=runTool(d);
      check("7b source: exit 1 (부모가 외부 링크인 추적 문서)",r.code===1,`code=${r.code}\n${r.out}`);
      check("7b source: 저장소 밖으로 거부하고 파일명을 보고",
        /저장소 밖 링크/.test(r.out)&&/docs\/sub\/a\.md/.test(r.out),r.out);
      check("7b source: 링크 너머 문서를 읽지 않았다 (안의 깨진 링크가 보고되지 않음)",
        !r.out.includes(EXTERNAL_MARK),r.out);
    }
  }

  /* ── 7c. 대조: 저장소 **안**을 가리키는 링크는 통과해야 한다 (과잉 거부 방지) ── */
  {
    const d=initRepo();
    fs.mkdirSync(path.join(d,"docs","real"),{recursive:true});
    fs.writeFileSync(path.join(d,"docs","real","note.md"),"# 안쪽\n","utf8");
    const err=mkLink(path.join(d,"docs","real"),path.join(d,"docs","alias"));
    if(err){
      console.log("  SKIP 7c 저장소 안 링크 대조 — "+LINK_TYPE+" 링크 생성 실패 ("+err+")");
    }else{
      seed(d,{"README.md":"[안쪽](docs/alias/note.md)\n"});
      const r=runTool(d);
      check("7c 대조: 저장소 안 링크는 exit 0 (과잉 거부 없음)",r.code===0,`code=${r.code}\n${r.out}`);
    }
  }

  /* ===== 8. 검사기는 허용된 JSON 출력 말고는 아무것도 쓰지 않는다 ===== */
  {
    const d=initRepo();
    seed(d,{"README.md":"[문서](docs/guide.md)\n","docs/guide.md":"# g\n"});
    const snap=()=>{ const m={}; (function walk(p){ for(const n of fs.readdirSync(p)){ if(n===".git") continue;
      const f=path.join(p,n), s=fs.lstatSync(f);
      if(s.isDirectory()) walk(f); else m[path.relative(d,f)]=`${s.size}|${s.mtimeMs}`; } })(d); return m; };
    const before=snap(); const r=runTool(d); const after=snap();
    const diffs=Object.keys({...before,...after}).filter(k=>before[k]!==after[k]);
    check("검사기 실행: exit 0",r.code===0,`code=${r.code}\n${r.out}`);
    check("검사기 실행: 저장소에 아무것도 쓰지 않음",diffs.length===0,`변화: ${diffs.join(", ")}`);
    // --json 을 준 경우에만 그 한 경로가 생긴다
    const jsonPath=path.join(d,"out.json");
    const r2=spawnSync(process.execPath,[TOOL,"--root",d,"--json",jsonPath],{encoding:"utf8"});
    const after2=snap();
    const newFiles=Object.keys(after2).filter(k=>!(k in after));
    check("--json: 지정한 한 경로만 생성",r2.status===0&&newFiles.length===1&&newFiles[0]==="out.json",
      `code=${r2.status} 새 파일=${newFiles.join(", ")}`);
  }

  /* ===== 9. 실제 저장소에 대해 현재 상태가 깨끗한지 (읽기 전용) ===== */
  {
    const repo=path.resolve(__dirname,"..","..","..");
    const r=spawnSync(process.execPath,[TOOL,"--root",repo],{encoding:"utf8",maxBuffer:1<<24});
    check("현재 저장소: 깨진 내부 링크 0건",r.status===0,`code=${r.status}\n${r.out}`);
    if(VERBOSE) console.log("       "+(r.stdout||"").trim().split("\n").pop());
  }
}finally{
  /* 소유한 경로만, 검증 후 삭제 */
  for(const d of owned){
    const res=removeOwned(d);
    if(VERBOSE||res.startsWith("거부")) console.log(`  CLEANUP ${res}: ${d}`);
    if(res.startsWith("거부")) failed++;
  }
}

if(failed){ console.log(`\n실패 ${failed}건`); process.exit(1); }
console.log("\n모든 docs_link_check 회귀 통과");
