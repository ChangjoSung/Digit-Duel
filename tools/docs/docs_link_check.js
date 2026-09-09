/* #132 문서 링크·이미지 무결성 검사 — node tools/docs/docs_link_check.js [--verbose] [--json <path>] [--root <dir>]
 *
 * 목적: 저장소 안 Markdown 문서가 가리키는 **저장소 내부 상대 경로**가 실제로 존재하고, 대소문자까지
 *       정확히 일치하며, 저장소 밖으로 새지 않는지 본다. 문서 구조를 옮길 때 깨진 링크를 즉시 잡는 게이트다.
 *
 * 검사 대상 (git 이 추적하는 *.md 만):
 *   - Markdown 인라인 링크·이미지   [텍스트](경로)  ![대체텍스트](경로)   ( <경로> · "제목" 표기 포함 )
 *   - Markdown 참조 정의            [id]: 경로
 *   - 문서에 직접 박힌 HTML          <a href="경로">  <img src="경로">      ( README 가 실제로 쓰는 형태 )
 *
 * 통과시키는 것 (오탐 방지 — 링크가 아니거나 이 도구의 소관이 아닌 것):
 *   - 외부 URL·스킴: http(s):// · ws(s):// · mailto: · tel: · data: · 프로토콜 상대(//host)
 *   - 순수 앵커(#섹션) — 헤딩 슬러그 검증은 이 도구의 범위가 아니다 (경로#앵커 는 경로만 본다)
 *   - 코드 펜스(``` / ~~~)와 인라인 코드(`...`) 안의 모든 텍스트
 *     → `git show d614392:demo/index.html` 같은 **역사적 명령문**이 링크로 오인되지 않는다
 *   - 템플릿 자리표시자({{...}} · <경로> 류 한글 안내) 및 빈 타깃
 *
 * 검사하지 않는 것 (의도적):
 *   - JSON·CSV 안의 경로 문자열: capture-manifest.json · delivery-manifest.csv 등은 **납품 시점 출처 기록**이며
 *     바이트를 보존해야 하는 역사 자료다. 현재 트리에 그 경로가 없다는 것은 링크 실패가 아니다.
 *   - 추적되지 않은 파일(art/ 등 작업 중 산출물): git ls-files 로만 열거하므로 애초에 스캔 대상이 아니다.
 *   - 독립 .html 파일: docs/milestone/**\/artifacts/readme-gh-render*.html 은 과거 렌더 산출물, creat2ve/*.html 은 외부 사본이라
 *     현재 링크 계약의 대상이 아니다. (문서에 *박혀 있는* HTML 태그는 위와 같이 검사한다.)
 *
 * 저장소 경계 (심볼릭 링크·Windows 정션):
 *   경로 문자열의 `../` 뿐 아니라 **실제 경로(realpath)** 로도 경계를 본다. 세그먼트를 한 칸씩 내려가며
 *   lstat 로 링크 여부를 먼저 확인하고, 링크면 **따라가기 전에** 실제 경로가 저장소 안인지 판정한다.
 *   밖이면 즉시 거부하고 그 대상을 읽지 않는다. 추적 중인 문서 자체가 저장소 밖을 가리키는 링크여도 같다.
 *   Windows 의 디렉터리 정션도 Node 가 심볼릭 링크로 보고하므로 같은 경로로 처리된다.
 *
 * 읽지 못한 추적 문서는 통과가 아니다:
 *   git 이 추적한다고 한 파일이 작업 트리에 없거나 읽히지 않으면 **문제로 기록하고 실패**한다.
 *   조용히 건너뛰면 "검사할 것이 없어서" 통과한 것을 "문제가 없어서" 통과한 것으로 오인하게 된다.
 *
 * 종료 코드: 0 = 문제 없음 · 1 = 깨진 링크·읽지 못한 추적 문서·저장소 밖 링크 · 2 = 실행 환경 오류(git 없음·저장소 아님·루트 해석 실패)
 * 이 도구는 어떤 파일도 쓰지 않는다 (--json 을 명시했을 때 그 한 경로만 쓴다).
 */
"use strict";
const fs=require("fs"), path=require("path"), {execFileSync}=require("child_process");

const args=process.argv.slice(2);
const has=f=>args.includes(f);
const opt=(f,d)=>{ const i=args.indexOf(f); return i>=0&&args[i+1]?args[i+1]:d; };
const VERBOSE=has("--verbose");
const ROOT=path.resolve(opt("--root",path.join(__dirname,"..","..")));
const JSON_OUT=has("--json")?path.resolve(opt("--json",null)):null;

/* ── 추적 중인 Markdown 열거 (추적되지 않은 보호 대상은 여기서 자연히 빠진다) ── */
let files;
try{
  files=execFileSync("git",["-C",ROOT,"ls-files","-z","--","*.md"],{maxBuffer:1<<26})
    .toString("utf8").split("\0").filter(Boolean);
}catch(e){
  console.error("환경 오류: git ls-files 실패 —",String(e.message).split("\n")[0]);
  process.exit(2);
}

/* ── 저장소 경계의 기준점 ── 링크가 저장소 안에 있는지는 **실제 경로**(realpath)로 판정해야 한다.
   ROOT 자체가 심볼릭 링크/정션 아래 있을 수 있으므로(예: macOS 의 /var → /private/var, 임시 디렉터리)
   기준점도 한 번 해석해 둔다. 해석에 실패하면 판정 근거가 없으므로 환경 오류로 끝낸다. */
let ROOT_REAL;
try{ ROOT_REAL=fs.realpathSync(ROOT); }
catch(e){
  console.error("환경 오류: 저장소 루트의 실제 경로를 해석하지 못했습니다 —",String(e.message).split("\n")[0]);
  process.exit(2);
}
const sep=path.sep;
const withinRoot=abs=>abs===ROOT_REAL||abs.startsWith(ROOT_REAL+sep);
/* 존재하는 경로의 실제 위치가 저장소 안인가. 해석 자체가 실패하면 "안전하다"고 보지 않는다(false). */
function realWithinRoot(abs){
  try{ return withinRoot(fs.realpathSync(abs)); }catch(e){ return false; }
}

/* ── 실제 디스크 대소문자 확인 ── Windows·macOS 기본 파일시스템은 대소문자를 구분하지 않아
   fs.existsSync 로는 Linux(GitHub Actions·github.com 렌더)에서 깨질 링크를 못 잡는다.
   그래서 경로를 세그먼트로 쪼개 각 단계의 디렉터리 목록과 **정확히** 대조한다.
   readdir 자체는 넘겨받은 경로를 그대로 열거할 뿐 링크 여부를 가리지 않는다 — 안전한 것은 열거 순서다:
   각 세그먼트의 경계를 먼저 검증하고, **경계를 통과한 부모만** 다음 단계에서 열거한다. */
const dirCache=new Map();
function listDir(abs){
  if(dirCache.has(abs)) return dirCache.get(abs);
  let names=null;
  try{ names=new Set(fs.readdirSync(abs)); }catch(e){ names=null; }
  dirCache.set(abs,names);
  return names;
}
/* 반환: {ok:true} · {ok:false,reason:"missing"|"case"|"outside",actual?:string,detail?:string}
   경계 판정은 **링크를 따라가기 전에** 세그먼트 단위로 한다: 각 단계에서 lstat 로 링크 여부를 먼저 보고
   (Windows 의 디렉터리 정션도 Node 는 심볼릭 링크로 보고한다) 링크면 그 자리에서 실제 경로가
   저장소 안인지 확인한다. 밖이면 더 내려가지 않고 즉시 거부한다 — 저장소 밖 내용을 읽지 않기 위해서다. */
function resolveExact(relFromRoot){
  const segs=relFromRoot.split("/").filter(s=>s.length&&s!==".");
  let cur=ROOT_REAL;
  for(const seg of segs){
    const names=listDir(cur);
    if(!names) return {ok:false,reason:"missing"};
    if(!names.has(seg)){
      // 이름은 있는데 대소문자만 다른 경우를 구분해 보고한다
      const hit=[...names].find(n=>n.toLowerCase()===seg.toLowerCase());
      return hit?{ok:false,reason:"case",actual:hit}:{ok:false,reason:"missing"};
    }
    const next=path.join(cur,seg);
    let st=null;
    try{ st=fs.lstatSync(next); }catch(e){ return {ok:false,reason:"missing"}; }
    if(st.isSymbolicLink()){
      if(!realWithinRoot(next))
        return {ok:false,reason:"outside",detail:"링크가 저장소 밖을 가리킨다 (심볼릭 링크·정션)"};
      cur=fs.realpathSync(next);          // 경계를 확인한 뒤에만 따라간다
      continue;
    }
    cur=next;
  }
  // 중간 경로가 정션이었던 경우까지 덮도록 최종 위치도 확인한다
  if(!realWithinRoot(cur)) return {ok:false,reason:"outside",detail:"해석된 실제 경로가 저장소 밖이다"};
  return {ok:true};
}

/* ── 코드 펜스·인라인 코드 제거 (역사적 명령문 오탐 방지) ──
   줄 구조와 길이를 보존해야 문제 위치의 행 번호가 맞으므로, 지우지 않고 같은 길이의 공백으로 덮는다. */
function maskCode(src){
  const lines=src.split("\n");
  let fence=null;
  for(let i=0;i<lines.length;i++){
    const m=lines[i].match(/^\s*(```+|~~~+)/);
    if(fence){ const close=m&&lines[i].trim().startsWith(fence); lines[i]=" ".repeat(lines[i].length); if(close) fence=null; continue; }
    if(m){ fence=m[1][0].repeat(3); lines[i]=" ".repeat(lines[i].length); continue; }
    // 인라인 코드 — 백틱 런 단위로 짝을 맞춘다
    lines[i]=lines[i].replace(/(`+)([^`]*?)\1/g,(full)=>" ".repeat(full.length));
  }
  return lines.join("\n");
}

/* ── 링크 타깃 추출 ── */
const SCHEME=/^[a-zA-Z][a-zA-Z0-9+.-]*:/;      // http: mailto: data: ws: …
function isExternal(t){
  return t.startsWith("#")||t.startsWith("//")||SCHEME.test(t);
}
function extract(text){
  const out=[]; // {target, index}
  const push=(t,i)=>{ if(t!=null) out.push({target:t.trim(),index:i}); };
  let m;
  // ![alt](target "title")  /  [text](target "title")  /  (<target>)
  const inline=/!?\[(?:[^\]\\]|\\.)*\]\(\s*(<[^>]*>|[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  while((m=inline.exec(text))) push(m[1].replace(/^<|>$/g,""),m.index);
  // [id]: target  (참조 정의)
  const ref=/^[ \t]{0,3}\[(?:[^\]\\]|\\.)+\]:[ \t]*(<[^>]*>|\S+)/gm;
  while((m=ref.exec(text))) push(m[1].replace(/^<|>$/g,""),m.index);
  // 문서에 직접 박힌 HTML — href / src
  const html=/<(?:a|img|source|video|iframe)\b[^>]*?\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  while((m=html.exec(text))) push(m[1]!==undefined?m[1]:(m[2]!==undefined?m[2]:m[3]),m.index);
  return out;
}
const lineOf=(text,index)=>text.slice(0,index).split("\n").length;

/* ── 검사 ── */
const problems=[]; // {file,line,target,reason,detail}
let checked=0, skipped=0;

for(const rel of files){
  const abs=path.join(ROOT_REAL,rel);

  /* git 이 추적한다고 한 파일은 반드시 읽혀야 한다. 없거나 읽히지 않으면 그것이 곧 문제다 —
     조용히 건너뛰면 "검사할 것이 없어서" 통과한 것을 "문제가 없어서" 통과한 것으로 오인하게 된다. */
  let st=null;
  try{ st=fs.lstatSync(abs); }catch(e){
    problems.push({file:rel,line:0,target:rel,reason:"unreadable",
      detail:`추적 중인 문서가 작업 트리에 없다 (${e.code||e.message})`});
    continue;
  }
  /* 추적 파일의 **실제 위치**가 저장소 밖이면 내용을 읽지 않는다 (읽기 전에 경계 판정).
     파일 자체가 링크인 경우뿐 아니라 상위 디렉터리가 정션인 경우까지 realpath 로 함께 덮는다. */
  if(!realWithinRoot(abs)){
    problems.push({file:rel,line:0,target:rel,reason:"outside",
      detail:`추적 중인 문서의 실제 경로가 저장소 밖이다 (${st.isSymbolicLink()?"링크":"정션 등 상위 경로"}) — 내용을 읽지 않았다`});
    continue;
  }
  let raw;
  try{ raw=fs.readFileSync(abs,"utf8"); }catch(e){
    problems.push({file:rel,line:0,target:rel,reason:"unreadable",
      detail:`추적 중인 문서를 읽지 못했다 (${e.code||e.message})`});
    continue;
  }
  const text=maskCode(raw);
  const dir=path.posix.dirname(rel.replace(/\\/g,"/"));

  for(const {target,index} of extract(text)){
    if(!target||isExternal(target)){ skipped++; continue; }
    if(/^\{\{|\}\}$/.test(target)){ skipped++; continue; }        // 템플릿 자리표시자
    // 앵커·쿼리 분리 — 경로 부분만 본다
    let p=target.split("#")[0].split("?")[0];
    if(!p){ skipped++; continue; }                                 // 순수 앵커
    try{ p=decodeURIComponent(p); }catch(e){ /* 잘못된 인코딩은 원문 그대로 본다 */ }
    if(/[<>"|*?]/.test(p)){ skipped++; continue; }                 // 경로일 수 없는 문자 = 안내문 자리표시자

    // 저장소 루트 기준 상대 경로로 정규화
    const joined=p.startsWith("/")?p.slice(1):path.posix.join(dir==="."?"":dir,p);
    const normalized=path.posix.normalize(joined);
    checked++;

    if(normalized.startsWith("../")||normalized===".."){
      problems.push({file:rel,line:lineOf(text,index),target,reason:"traversal",
        detail:"저장소 밖을 가리킨다 → "+normalized});
      continue;
    }
    const r=resolveExact(normalized);
    if(!r.ok){
      const detail=r.reason==="case"
        ? `대소문자 불일치 — 실제 이름은 '${r.actual}' (Linux·github.com 에서 깨진다)`
        : r.reason==="outside"
          ? `${r.detail} → ${normalized}`
          : `대상 없음 → ${normalized}`;
      problems.push({file:rel,line:lineOf(text,index),target,reason:r.reason,detail});
    }
  }
}

/* ── 보고 ── */
const REASON_KO={missing:"대상 없음",case:"대소문자 불일치",traversal:"저장소 밖 참조",
  outside:"저장소 밖 링크",unreadable:"추적 문서를 읽지 못함"};
if(VERBOSE||problems.length){
  const byFile=new Map();
  for(const p of problems){ if(!byFile.has(p.file)) byFile.set(p.file,[]); byFile.get(p.file).push(p); }
  for(const [f,list] of byFile){
    console.log(`\n${f}`);
    for(const p of list) console.log(`  :${p.line}  [${REASON_KO[p.reason]}]  ${p.target}\n      ${p.detail}`);
  }
}
console.log(`\n=== docs_link_check: 문서 ${files.length}개 · 내부 링크 ${checked}건 검사 · 외부/앵커/코드 ${skipped}건 제외 · 문제 ${problems.length}건 ===`);
if(JSON_OUT){
  fs.writeFileSync(JSON_OUT,JSON.stringify({root:ROOT,files:files.length,checked,skipped,problems},null,1),"utf8");
  console.log(`JSON 저장: ${path.relative(ROOT,JSON_OUT).replace(/\\/g,"/")}`);
}
process.exit(problems.length?1:0);
