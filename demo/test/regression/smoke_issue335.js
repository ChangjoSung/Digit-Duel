/* #335 Argon UI 통합 · 33종 4번 대표기 시트(일반 30 + 전설 3) · X01 문구 — 헤드리스 회귀
   실행: node demo/test/regression/smoke_issue335.js [demo/index.html]
   파일을 쓰지 않는다. B절만 기준판(v0.4.15 1f79d4e)을 `git show` 로 메모리에 읽는다(CI fetch-depth 0 필요 — smoke_cross_skill 과 같은 조건).
     A  Core fx.skill — 와이어 값 = 실제 기술 ID(닫힌 33개) · 사용 1회의 첫 성공 표적 행 1개 · 표적 = fx.shake || hp.side || st.side
        포함: 일반 명중 · 방어막만 깎은 명중 · 철벽으로 피해 0 · 성공 처형 · 자기 8종 성공(회복 0 포함) · 상대 비피해 7종 성공
        제외: 시전 줄 · 회피 · 환영 무도 무효 · 반사 · 거부된 사신 · 다른 슬롯 · 옛 ID · 부여 실패 · 면역 · 해일 빗나감 · 사용 전 피해 · KO · 추가 공격
     B  규칙·난수 불변 — 33종 4번 기술을 같은 시드·같은 장면으로 기준판과 돌려 로그·HP·다음 난수가 같고 차이는 fx.skill 키뿐
     C  오프라인 표시(applyFx) — 표적 토큰 안 시트 1장 · 640ms 뒤 스스로 제거 · 잘못된 값/표적 무시 · 미로드·움직임 줄이기 = 시트 없음(흔들림·숫자 유지) · 같은 토큰 앞 시트 대체
     D  온라인 표시(netFxApplyMsgFx) — 같은 닫힌 값·표적 · 재접속 요약 재생에는 시트를 붙이지 않는다
     E  자산·CSS — 고정 3장 프리로드 + 공개 전투 도트 기준 선택 로드(≤2) · 33장 정량 감사(tools/client/fx_sheet_audit) · steps(8)·no-repeat·640ms · 움직임 줄이기 숨김
     G  표시 훅 — 전투 명령 4버튼·가방의 글자 이모지는 그대로(textContent·접근성 이름) 두고 같은 뜻의 아이콘 칸만 얹는다
     F  X01 문구 — 경기 전(OPEN·SETUP) 준비 마감은 계속 흐른다 · 경기 중 보드·전투·상점·B08 시계 정지 · X03 는 버튼·카운트다운 없음 */
"use strict";
const fs=require("fs"), path=require("path"), zlib=require("zlib"), {execFileSync}=require("child_process");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
const DEMO=path.dirname(htmlPath), ROOT=path.resolve(__dirname,"..","..","..");
const BASE_REF="1f79d4e0042018dd576a82025d0dc9ccbed0a9f1"; // v0.4.15 — fx.skill 도입 직전 출시본
let pass=0,fail=0;
function ok(cond,name){ if(cond) pass++; else { fail++; console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(JSON.stringify(got)===JSON.stringify(want),name+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }

/* 장면: 내 하수인(A) 대 상대 하수인(D) 단독 전투 — 회피율 0 이라 명중은 확정, 난수는 원래대로 소비된다 */
function arena(T,leg,o){
  o=o||{}; const S=T.S;
  T.startMode("pve",{aiLevel:"grade5"}); T.dispatchCoreAction({t:"shopTimeout",player:0}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"}); T.TQ.length=0;
  const me=S.pieces.find(x=>x.owner===0&&x.type==="minion"), op=S.pieces.find(x=>x.owner===1&&x.type==="minion");
  if(/^M-/.test(leg)) T.applySpecies(me,T.ROSTER.find(r=>r.id===leg),4); else T.applyLegend(me,leg);
  if(o.opLegend) T.applyLegend(op,o.opLegend); else T.applySpecies(op,T.ROSTER.find(r=>r.id==="M-G3"),1);
  T.startRounds(me,op,me,op);
  const B=T.S.battle; B.fd.dodge=0; B.fd.synDodge=0; B.fd.evadeBuff=0; B.fd.evadeDown=0; B.fa.dodge=0; // effEvade 0 — 시너지 회피까지
  const seen=[]; const push=B.msgQ.push; B.msgQ.push=function(...m){ seen.push(...m); return push.apply(this,m); };
  return {B,seen,fa:B.fa,fd:B.fd};
}
const slotOf=(f,id)=>f.skills.indexOf(id);
const tagged=seen=>seen.filter(m=>m.fx&&m.fx.skill!==undefined);
function load(seed){ const T=H.load(htmlPath); if(T.TUT&&T.TUT.open) T.tutClose(); T.setSeed(seed); return T; }

/* ===== A. Core fx.skill ===== */
const SKILL3=["L-DRAGON-4","L-WITCH-4","L-REAPER-4"];
/* 기대값은 정규식이 아니라 실제 데이터에서 — data.js 의 일반 30종 + 전설 3종 4번 기술 */
const ID33=(()=>{ const T=H.load(htmlPath); return T.ROSTER.filter(r=>/^M-/.test(r.id)).map(r=>r.id+"-4").concat(SKILL3).filter(id=>T.SKILLS[id]); })();
const SELF8=["M-W3-4","M-W6-4","M-L3-4","M-E3-4","M-E5-4","M-E6-4","M-G3-4","M-G6-4"], OPP7=["M-F5-4","M-W4-4","M-W5-4","M-L5-4","M-E4-4","M-G4-4","M-G5-4"];
const SIG_RE=/^(?:M-[FWGLE][1-6]|L-(?:DRAGON|WITCH|REAPER))-4$/;
/* 4번 기술 1회 — 회피 0 · 사용 조건(굴 파기 다음 라운드 · 4라운드 · 사신 봉인 해제) 충족 */
function sigPrep(a,id){ if(id==="M-E1-4") a.fa.burrowRound=a.B.round-1; if(id==="M-E5-4"||id==="L-REAPER-4") a.B.round=4; if(id==="L-REAPER-4"){ a.fa.hp=1; a.B.phase=0; } }
function useSig(seed,id,prep){
  const T=load(seed), sid=id.slice(0,-2), a=arena(T,/^L-/.test(sid)?sid.slice(2).toLowerCase():sid);
  sigPrep(a,id); if(prep) prep(a,T);
  T.execSlot("A",slotOf(a.fa,id)); return Object.assign(a,{T,t:tagged(a.seen)});
}
{ /* A1~A3 드래곤 숨결 일반 명중 */
  const T=load(3351), {seen,fa}=arena(T,"dragon");
  T.execSlot("A",slotOf(fa,"L-DRAGON-4"));
  const t=tagged(seen), cast=seen.find(m=>m.key==="skillFx");
  ok(t.length===1&&t[0].fx.skill==="L-DRAGON-4"&&t[0].fx.shake==="D"&&t[0].key==="damageFx"&&/피해!/.test(t[0].txt),"A1 드래곤 숨결 명중 행 1개에만 L-DRAGON-4 · 표적 D · damageFx");
  ok(!!cast&&!("skill" in (cast.fx||{})),"A2 시전 선언 줄(skillFx)에는 붙이지 않는다");
  ok(seen.every(m=>!m.fx||m.fx.skill===undefined||SIG_RE.test(m.fx.skill)),"A3 값은 실제 4번 기술 ID 문자열뿐");
}
{ /* A4 회피 — 확정 회피(dodgeForce)는 난수를 쓰지 않는다 */
  const T=load(3352), {seen,fa,fd}=arena(T,"dragon"); fd.dodgeForce=true;
  T.execSlot("A",slotOf(fa,"L-DRAGON-4"));
  ok(seen.some(m=>/회피했다/.test(m.txt))&&tagged(seen).length===0,"A4 빗나간 전용기에는 붙이지 않는다");
}
{ /* A5 방어막만 깎은 명중 — HP 피해 0 이어도 적중이다 */
  const T=load(3353), {seen,fa,fd}=arena(T,"dragon"); T.shieldAdd(fd,5000,"test"); const hp0=fd.hp;
  T.execSlot("A",slotOf(fa,"L-DRAGON-4"));
  const t=tagged(seen);
  ok(fd.hp===hp0&&t.length===1&&t[0].fx.skill==="L-DRAGON-4"&&/흡수/.test(t[0].txt),"A5 방어막 흡수만 한 명중도 시트 행 1개 (HP 그대로)");
}
{ /* A6 철벽(피해 1회 무효) — 0 피해 명중 */
  const T=load(3354), {seen,fa,fd}=arena(T,"witch"); fd.nullHitR=1; fd.nullHitN=1;
  T.execSlot("A",slotOf(fa,"L-WITCH-4"));
  const t=tagged(seen);
  ok(t.length===1&&t[0].fx.skill==="L-WITCH-4"&&t[0].fx.shake==="D"&&/^0 피해!/.test(t[0].txt),"A6 철벽으로 0 피해가 된 마녀의 장난 명중도 시트 행 1개");
}
{ /* A7 마녀의 장난 일반 명중 — 뒤따르는 효과·회복 줄에는 없다 */
  const T=load(3355), {seen,fa}=arena(T,"witch");
  T.execSlot("A",slotOf(fa,"L-WITCH-4"));
  const t=tagged(seen);
  ok(t.length===1&&t[0].fx.skill==="L-WITCH-4"&&seen.indexOf(t[0])===seen.findIndex(m=>m.fx&&m.fx.shake==="D"),"A7 마녀의 장난 = 첫 피해 행 1개만");
}
{ /* A8 환영 무도 — 행동 무효 */
  const T=load(3356), {seen,fa}=arena(T,"witch"); fa.nullifyNext=true;
  T.execSlot("A",slotOf(fa,"L-WITCH-4"));
  ok(seen.some(m=>/환영 무도/.test(m.txt))&&tagged(seen).length===0,"A8 무효가 된 사용에는 붙이지 않는다");
}
{ /* A9 반사 — 반사 피해 줄(표적 A)에는 붙이지 않는다 */
  const T=load(3357), {seen,fa,fd}=arena(T,"dragon"); fd.reflectR=2;
  T.execSlot("A",slotOf(fa,"L-DRAGON-4"));
  const t=tagged(seen), refl=seen.filter(m=>/반사/.test(m.txt)&&m.fx&&m.fx.shake==="A");
  ok(refl.length===1&&t.length===1&&t[0].fx.shake==="D","A9 반사 줄은 표적이 시전자라도 시트 없음 · 명중 행 1개 유지");
}
{ /* A10 같은 전설의 다른 공격 기술(날개 강타) · 기본기 */
  const T=load(3358), {seen,fa}=arena(T,"dragon");
  T.execSlot("A",slotOf(fa,"L-DRAGON-3")); fa.cds=fa.cds.map(()=>0); T.execSlot("A",slotOf(fa,"L-DRAGON-1"));
  ok(seen.filter(m=>m.fx&&m.fx.shake==="D").length>=1&&tagged(seen).length===0,"A10 4번이 아닌 기술 명중에는 붙이지 않는다");
}
{ /* A11 옛 기술 ID(dragon_breath·witch_prank) — 같은 피해 경로라도 붙이지 않는다 */
  const T=load(3359), {seen,fa}=arena(T,"dragon");
  for(const id of ["dragon_breath","witch_prank"]){ fa.skills[3]=id; fa.cds[3]=0; T.execSlot("A",3); }
  ok(seen.filter(m=>m.fx&&m.fx.shake==="D").length>=1&&tagged(seen).length===0,"A11 옛 ID 명중에는 붙이지 않는다");
}
{ /* A12~A13 사신의 낫 — 거부(1R 봉인)는 무동작 · 성공 처형 행 1개 */
  const T=load(3360), {B,seen,fa,fd}=arena(T,"reaper"), slot=slotOf(fa,"L-REAPER-4");
  B.phase=0; const actor=T.actorOfPhase(); const side=actor||"A";
  const f=side==="A"?fa:fd; if(side!=="A"){ T.applyLegend(f,"reaper"); }
  const hp0=[fa.hp,fd.hp];
  T.execSlot(side,slotOf(f,"L-REAPER-4"));
  ok(tagged(seen).length===0&&fa.hp===hp0[0]&&fd.hp===hp0[1],"A12 봉인된 사신의 낫(거부)은 시트·피해 없음");
  B.round=4; f.hp=1; f.cds=f.cds.map(()=>0);
  ok(!T.reaperWhy(side)&&T.actorOfPhase()===side,"A13 전제: 4R · 내 HP 비율이 낮음 · 내 차례");
  T.execSlot(side,slotOf(f,"L-REAPER-4"));
  const t=tagged(seen), oSide=side==="A"?"D":"A";
  ok(t.length===1&&t[0].fx.skill==="L-REAPER-4"&&t[0].fx.shake===oSide&&/즉사/.test(t[0].txt),"A14 성공한 처형 행 1개에만 L-REAPER-4 · 표적 = 처형 대상");
  ok(!seen.some(m=>m.fx&&m.fx.ko&&m.fx.skill!==undefined),"A15 쓰러짐(KO) 줄에는 붙이지 않는다");
  void slot;
}

/* ===== A2. 33종 4번 대표기 — 실제 데이터 · 실제 실행 경로 (execSlot → execV2 / 사신 분기) ===== */
{
  const T=H.load(htmlPath);
  eq(ID33.length,33,"A20 실제 데이터의 4번 대표기 = 일반 30 + 전설 3");
  ok(ID33.every(id=>SIG_RE.test(id))&&Object.keys(T.SKILLS).filter(id=>SIG_RE.test(id)).sort().join()===ID33.slice().sort().join(),"A21 닫힌 정규식이 고르는 기술 ID 집합 = 실제 33개와 정확히 같다 (누락·초과 0)");
  const self=ID33.filter(id=>!T.SKILLS[id].pct&&!T.SKILLS[id].reaper&&!T.V2_AI_HINT.debuff.includes(T.SKILLS[id].fx)), opp=ID33.filter(id=>!T.SKILLS[id].pct&&!T.SKILLS[id].reaper&&T.V2_AI_HINT.debuff.includes(T.SKILLS[id].fx));
  eq(self.slice().sort(),SELF8.slice().sort(),"A22 자기 대상 비피해 = 정확히 8종 (기존 V2_AI_HINT 분류 · 데이터 대조)");
  eq(opp.slice().sort(),OPP7.slice().sort(),"A23 상대 대상 비피해 = 정확히 7종");
  eq(ID33.filter(id=>T.SKILLS[id].pct||T.SKILLS[id].reaper).length,18,"A24 피해형 18종 (일반 15 + 전설 3)");
}
for(const id of ID33){ // 성공 사용 1회 = 표시 행 정확히 1개 · 표적 측 = 선언 · 자기 효과에 가짜 흔들림 없음
  const a=useSig(3400+ID33.indexOf(id),id), dmg=!SELF8.includes(id)&&!OPP7.includes(id), want=SELF8.includes(id)?"A":"D", r=a.t[0];
  const side=r&&(r.fx.shake||(r.fx.hp&&r.fx.hp.side)||(r.fx.st&&r.fx.st.side));
  ok(a.t.length===1&&r.fx.skill===id&&side===want&&!r.fx.ko&&(dmg?r.fx.shake==="D"&&r.key==="damageFx":!r.fx.shake),`A25 ${id} 성공 행 1개 · 표적 ${want}${dmg?" · 진짜 적중 행(shake·damageFx)":" · 흔들림 없음"} [${a.t.map(m=>m.txt).join(" | ")}]`);
  ok(!a.seen.some(m=>m.key==="skillFx"&&m.fx&&m.fx.skill),`A26 ${id} 시전 줄에는 없다`);
}
{ /* A27 자기 회복 — 만피(회복 0)여도 실제로 낸 회복 행에 붙는다 (공개한 계약) */
  for(const id of ["M-E5-4","M-G6-4"]){ const a=useSig(3440,id,x=>{ x.fa.hp=x.fa.maxHp; x.fa.shield=0; x.fa.shieldLayers=[]; });
    ok(a.t.length===1&&a.t[0].fx.hp&&a.t[0].fx.hp.side==="A"&&/HP 0 회복/.test(a.t[0].txt),`A27 ${id} 만피 · 회복 0 행 1개 (자기 측)`); }
}
{ /* A28~A33 실패·면역·빗나감·무효 — 표시 0, 토큰은 그 사용과 함께 사라진다 */
  const none=(nm,id,prep,why)=>{ const a=useSig(3450,id,prep); ok(a.t.length===0&&(!why||a.seen.some(m=>why.test(m.txt))),`${nm} [${a.seen.map(m=>m.txt).join(" | ")}]`); return a; };
  none("A28 영구 자기장 — 감전 면역이면 0","M-L5-4",x=>{ x.fd.immuneShockR=2; },/감전 면역/);
  none("A29 해일 예고 — 빗나가면 0","M-W5-4",x=>{ x.fd.dodgeForce=true; },/빗나갔다/);
  none("A30 성룡의 포효(일반 피해기) — 회피면 0","M-F1-4",x=>{ x.fd.dodgeForce=true; },/회피했다/);
  none("A31 환영 무도로 무효가 된 자기 대상 사용 0","M-W3-4",x=>{ x.fa.nullifyNext=true; },/환영 무도/);
  /* 부여 실패 — 모래 폭풍(시전자)이면 확률 절반: 실패하는 시드를 실제로 찾아 그 판을 본다 */
  let failed=null; for(let s=1;s<80&&!failed;s++){ const a=useSig(s,"M-F5-4",x=>{ x.fa.sandStormR=2; }); if(a.seen.some(m=>/부여 실패/.test(m.txt))) failed=a; }
  ok(!!failed&&failed.t.length===0,"A32 영겁의 재 — 상태 부여 실패 판에는 0");
  if(failed){ failed.T.v2Apply("A",failed.fa,"D",failed.fd,"burn",1,{force:true}); ok(tagged(failed.seen).length===0,"A33 실패한 사용 뒤의 다른 상태 행에 토큰이 새지 않는다 (finally 해제)"); }
}
{ /* A34 사용 전 번식 포자 피해(시전자 측 shake)는 무장 전이다 — 자기 대상 성공 행 1개만 */
  const a=useSig(3460,"M-W3-4",x=>{ x.fa.breedR=2; x.fa.breedBy="D"; });
  ok(a.seen.some(m=>/번식 포자/.test(m.txt)&&m.fx&&m.fx.shake==="A")&&a.t.length===1&&/빙벽 반사/.test(a.t[0].txt),"A34 사용 전 피해 행 제외 · 성공 행 1개");
}
{ /* A35 반사 — 일반 피해기의 반사 피해 줄(표적 A)에는 없다 · A36 KO 줄 제외 */
  const a=useSig(3461,"M-L2-4",x=>{ x.fd.reflectR=2; });
  ok(a.seen.some(m=>/반사/.test(m.txt)&&m.fx&&m.fx.shake==="A")&&a.t.length===1&&a.t[0].fx.shake==="D","A35 반사 줄 제외 · 명중 행 1개");
  const k=useSig(3462,"M-G2-4",x=>{ x.fd.hp=1; });
  ok(k.seen.some(m=>m.fx&&m.fx.ko)&&k.t.length===1&&!k.t[0].fx.ko,"A36 쓰러뜨린 사용도 명중 행 1개 · KO 줄 제외");
}
{ /* A37 번개 꼬리 추가 공격(1~3번 슬롯)은 새 사용이고 4번 대표기가 아니다 */
  const a=useSig(3463,"M-L4-4"); const B=a.B;
  ok(a.t.length===1&&B.bonus&&B.bonus.side==="A","A37 전제: 번개 꼬리 명중 1개 · 추가 공격 대기");
  if(B.bonus){ B.bonus.stage="active"; const s=B.bonus.allowed[0]; a.T.execSlot("A",s); ok(tagged(a.seen).length===1,"A37 추가 공격 행에는 붙지 않는다"); }
}

/* ===== B. 기준판 대조 — 규칙·난수 불변 (33종 4번 기술 전부 + 난수 회피 · 반사) ===== */
function baseDir(){ // 기준판 소스는 git show 로 한 번만 읽어 임시 폴더에 두고, 이 절이 끝나면 지운다
  const dir=fs.mkdtempSync(path.join(require("os").tmpdir(),"dd335base-"));
  const show=p=>execFileSync("git",["show",`${BASE_REF}:demo/${p}`],{cwd:ROOT,encoding:"utf8",maxBuffer:64<<20});
  const html=show("index.html"); fs.writeFileSync(path.join(dir,"index.html"),html);
  for(const m of html.matchAll(/\b(?:src|href)="((?:js|css)\/[^"]+)"/g)){ fs.mkdirSync(path.join(dir,path.dirname(m[1])),{recursive:true}); fs.writeFileSync(path.join(dir,m[1]),show(m[1])); }
  return dir;
}
{
  const run=(T,id,prep)=>{ if(T.TUT&&T.TUT.open) T.tutClose(); T.setSeed(4242); const sid=id.slice(0,-2), a=arena(T,/^L-/.test(sid)?sid.slice(2).toLowerCase():sid);
    sigPrep(a,id); if(prep) prep(a);
    T.execSlot("A",slotOf(a.fa,id));
    return {blog:a.B.blog.slice(),hp:[a.fa.hp,a.fd.hp,a.fa.shield,a.fd.shield],next:T.rand(),fx:a.seen.map(m=>{ const f=Object.assign({},m.fx||{}); delete f.skill; return [m.txt,m.key,JSON.stringify(f)]; }),tags:tagged(a.seen).length}; };
  let dir=null; try{ dir=baseDir(); }catch(e){ ok(false,"B0 기준판 로드 실패 — git show "+BASE_REF+" ("+e.message.split("\n")[0]+")"); }
  try{
    if(dir) for(const [id,prep,nm] of ID33.map(id=>[id,null,id]).concat([["L-DRAGON-4",a=>{a.fd.dodge=0.4;},"드래곤 난수 회피 판정"],["L-WITCH-4",a=>{a.fd.reflectR=2;},"마녀 + 반사"],["M-F1-4",a=>{a.fd.dodge=0.4;},"성룡의 포효 난수 회피 판정"]])){
      const base=run(H.load(path.join(dir,"index.html")),id,prep), cur=run(H.load(htmlPath),id,prep);
      eq(cur.blog,base.blog,`B1 ${nm}: 전투 로그 동일`);
      eq([cur.hp,cur.next],[base.hp,base.next],`B2 ${nm}: HP·방어막·다음 난수 동일 (난수 소비 불변)`);
      eq(cur.fx,base.fx,`B3 ${nm}: fx.skill 을 뺀 연출 페이로드 동일`);
      ok(base.tags===0,`B4 ${nm}: 기준판에는 fx.skill 이 없다`);
    }
  } finally { if(dir) fs.rmSync(dir,{recursive:true,force:true}); }
}

/* ===== C. 오프라인 표시 ===== */
function battleDom(seed){
  const T=load(seed); arena(T,"dragon"); T.battleModal();
  const tok={A:T.byId("tok-A"),D:T.byId("tok-D")}; tok.A.children.length=0; tok.D.children.length=0;
  const own=global.setTimeout, timers=[]; global.setTimeout=(fn,ms)=>{ timers.push({fn,ms}); return own(fn,ms); };
  const restore=()=>{ global.setTimeout=own; };
  return {T,tok,timers,restore,K:T.skillSheet};
}
const sheets=el=>el.children.filter(c=>c.classList&&c.classList.contains("skfx"));
{
  const {T,tok,timers,restore,K}=battleDom(3361);
  try{
    ok(!!K&&K.SKILL_SHEET_MS===640,"C0 시트 재생 640ms (8 × 80ms)");
    K.SKILL_SHEET_OK.clear();
    T.applyFx({shake:"D",skill:"L-DRAGON-4",float:{side:"D",html:"-9"}});
    ok(sheets(tok.D).length===0&&tok.D.classList.contains("shake")&&tok.D.children.some(c=>c.className==="dmgfloat"),"C1 시트 미로드(실패) — 시트 없음, 흔들림·피해 숫자는 그대로");
    for(const k of ["dragon","witch","reaper"]) K.SKILL_SHEET_OK.add(k);
    tok.D.children.length=0; timers.length=0;
    T.applyFx({shake:"D",skill:"L-DRAGON-4",float:{side:"D",html:"-9"}});
    const s=sheets(tok.D);
    ok(s.length===1&&s[0].classList.contains("skfx-dragon")&&s[0].getAttribute&&s[0].getAttribute("aria-hidden")==="true"&&sheets(tok.A).length===0,"C2 표적(fx.shake=D) 토큰 안에 시트 1장 · 장식(aria-hidden)");
    const ci=tok.D.children.indexOf(s[0]), fi=tok.D.children.findIndex(c=>c.className==="dmgfloat");
    ok(ci>=0&&fi>ci,"C3 피해 숫자가 시트 뒤(위)에 붙는다 — 숫자를 가리지 않는다");
    const rm=timers.filter(t=>t.ms===640);
    ok(rm.length===1,"C4 제거 예약 1건 = 640ms (damageFx 1200ms 그룹 안 · 추가 대기·잠금 없음)");
    rm[0].fn(); ok(sheets(tok.D).length===0,"C5 640ms 뒤 스스로 사라진다 (F8 투명 끝 · 남는 그림 없음)");
    T.applyFx({shake:"A",skill:"L-REAPER-4"}); T.applyFx({shake:"A",skill:"L-WITCH-4"});
    ok(sheets(tok.A).length===1&&sheets(tok.A)[0].classList.contains("skfx-witch"),"C6 같은 토큰의 앞 시트는 새 시트가 대신한다 (겹쳐 쌓이지 않음)");
    tok.A.children.length=0; tok.D.children.length=0;
    for(const bad of ["L-DRAGON-3","L-DRAGON-5","dragon_breath","witch_prank","reaper","__proto__","toString","constructor","l-dragon-4"," L-DRAGON-4",1,true,{},["L-DRAGON-4"],null,
      "fire_std","SK-F1","M-F1-3","M-F1","M-T1-4","m-f1-4","M-F1-4 ","M-F7-4"]) T.applyFx({shake:"D",skill:bad}); // #335 와이어는 실제 ID 만 — slug·공급사 SK-*·다른 슬롯은 무시
    for(const sh of ["X","a",undefined,null,1]) T.applyFx({shake:sh,skill:"L-DRAGON-4"});
    ok(sheets(tok.A).length+sheets(tok.D).length===0,"C7 닫힌 33값·A|D 표적이 아니면 아무것도 그리지 않는다 (프로토타입 키·대소문자·공백·형 포함)");
    const mm=global.matchMedia; global.matchMedia=q=>({matches:/prefers-reduced-motion: reduce/.test(q)});
    T.applyFx({shake:"D",skill:"L-DRAGON-4"});
    ok(sheets(tok.D).length===0&&tok.D.classList.contains("shake"),"C8 움직임 줄이기 — 시트 없음 (기존 흔들림 클래스 경로는 그대로)");
    global.matchMedia=mm;
    /* C14~C17 비피해 대표기 — 흔들림 없는 행의 표적은 hp.side → st.side (자기 = 시전자 토큰 · 디버프 = 상대 토큰) */
    for(const k of ["water_def","land_sustain","grass_swift"]) K.SKILL_SHEET_OK.add(k);
    tok.A.children.length=0; tok.D.children.length=0; tok.A.classList.remove("shake"); // C6 의 흔들림 클래스를 걷고 본다
    T.applyFx({st:{side:"A",text:"🧊"},skill:"M-W3-4"});
    ok(sheets(tok.A).length===1&&sheets(tok.A)[0].classList.contains("skfx-water_def")&&sheets(tok.D).length===0&&!tok.A.classList.contains("shake"),"C14 자기 대상(st.side=A) = 시전자 토큰 · 가짜 흔들림 없음");
    tok.A.children.length=0;
    T.applyFx({float:{side:"A",html:"+0"},hp:{side:"A",val:10,max:50},skill:"M-E5-4"});
    ok(sheets(tok.A).length===1&&sheets(tok.A)[0].classList.contains("skfx-land_sustain"),"C15 회복 행(hp.side=A)의 대표기 = 시전자 토큰");
    T.applyFx({st:{side:"D",text:"🍄"},skill:"M-G4-4"});
    ok(sheets(tok.D).length===1&&sheets(tok.D)[0].classList.contains("skfx-grass_swift"),"C16 상대 디버프(st.side=D) = 상대 토큰");
    T.applyFx({st:{side:"D",text:"x"},skill:"M-F1-4"});
    ok(sheets(tok.D).length===1&&sheets(tok.D)[0].classList.contains("skfx-grass_swift"),"C17 아직 로드되지 않은 일반 시트(fire_std)는 그리지 않는다 (앞 시트도 그대로)");
    /* C13 세대 취소 — 같은 전투 DOM 이 남아 있어도 새 게임(fxReleaseAll)은 재생 중인 시트를 걷는다 */
    T.document.body.appendChild(tok.D); tok.D.children.length=0;
    T.applyFx({shake:"D",skill:"L-DRAGON-4"}); const live=sheets(tok.D).length;
    T.fxReleaseAll();
    ok(live===1&&sheets(tok.D).length===0,"C13 세대 취소(fxReleaseAll) 시 남은 시트 즉시 제거");
  } finally { restore(); }
}
{ /* C9 playMsgs 경로 — 명중 행이 damageFx 그룹 시작(t0)에 시트를 세우고, 그룹 시간은 그대로 1200ms */
  const {T,tok,timers,restore,K}=battleDom(3362);
  try{
    for(const k of ["dragon","witch","reaper"]) K.SKILL_SHEET_OK.add(k);
    T.FX.force=true; T.byId("msgBox").nodeType=1; // 실제 시간표(fxLive)·실제 DOM 재생 경로(liveBattleDom) — 하네스 스텁에서도 BAL.fx 시간을 쓴다
    T.playMsgs([{txt:"🐉 드래곤 숨결!",fx:{cast:"A"},key:"skillFx"},{txt:"40 피해!",fx:{shake:"D",skill:"L-DRAGON-4",hp:{side:"D",val:10,max:50}},key:"damageFx"}]);
    ok(sheets(tok.D).length===0,"C9 시전 줄(skillFx)에서는 아직 시트 없음");
    const step=timers.filter(t=>t.ms===T.BAL.fx.skillFx).pop(); // 마지막 예약 = 다음 그룹 진행 (앞의 같은 시간 예약은 castFx 정리) ok(!!step,"C10 시전 그룹은 skillFx("+T.BAL.fx.skillFx+"ms) 그대로");
    timers.length=0; step.fn();
    ok(sheets(tok.D).length===1&&timers.some(t=>t.ms===T.BAL.fx.damageFx)&&timers.some(t=>t.ms===640),"C11 피해 그룹 시작과 함께 시트 · 그룹은 damageFx("+T.BAL.fx.damageFx+"ms) · 시트 640ms < 그룹");
    ok(T.BAL.fx.damageFx>=640,"C12 시트는 피해 그룹 안에서 끝난다");
  } finally { restore(); }
}

/* ===== D. 온라인 표시 ===== */
{
  const T=H.load(htmlPath,{href:"file:///C:/Digit-Duel/demo/index.html",storage:H.mkStorage({tutorialSeen:"1"})}); if(T.TUT.open) T.tutClose();
  const K=T.skillSheet; for(const k of ["dragon","witch","reaper"]) K.SKILL_SHEET_OK.add(k);
  arena(T,"dragon"); T.battleModal();
  const tA=T.byId("tok-A"), tD=T.byId("tok-D"); tA.children.length=0; tD.children.length=0; T.NET.fxDisp=T.NET.fxDisp||{}; // 공개 방 좌석 진입이 만드는 표시 캐시
  T.skillSheet.netFxApplyMsgFx(1,{shake:"A",skill:"L-REAPER-4"},T.NET.fxGen);
  ok(sheets(tA).length===1&&sheets(tA)[0].classList.contains("skfx-reaper")&&sheets(tD).length===0,"D1 온라인 msg 도 같은 닫힌 값·fx.shake 표적으로 시트를 세운다");
  tA.children.length=0;
  for(const bad of ["L-DRAGON-1","__proto__",7]) T.skillSheet.netFxApplyMsgFx(1,{shake:"A",skill:bad},T.NET.fxGen);
  T.skillSheet.netFxApplyMsgFx(1,{skill:"L-DRAGON-4"},T.NET.fxGen);
  ok(sheets(tA).length+sheets(tD).length===0,"D2 온라인도 잘못된 값·표적 없음은 무시");
  K.SKILL_SHEET_OK.add("lightning_sustain"); T.skillSheet.netFxApplyMsgFx(1,{st:{side:"D",text:"⚡",shield:0,max:50},skill:"M-L5-4"},T.NET.fxGen);
  ok(sheets(tD).length===1&&sheets(tD)[0].classList.contains("skfx-lightning_sustain")&&sheets(tA).length===0,"D2b 온라인 비피해 행도 같은 표적 함수(st.side=D)"); tD.children.length=0;
  T.skillSheet.netFxApplyMsgFx(1,{st:{side:"D",text:"x"},skill:"lightning_sustain"},T.NET.fxGen);
  ok(sheets(tD).length===0,"D2c 온라인도 slug 값은 무시 (와이어 = 실제 기술 ID)");
  /* D3 재접속 요약 재생 — 마지막 KO 행 하나만 다시 틀고, 거기에 실린 fx.skill 은 지운다 */
  T.NET.fxQueue=[]; T.NET.fxPlayedSeq=0; T.NET.fxEnqueuedSeq=0;
  const last={seq:9,src:"msg",battleId:1,txt:"쓰러졌다",key:"damageFx",fx:{ko:"D",shake:"D",skill:"L-REAPER-4"}};
  T.skillSheet.netFxEnqueue({firstSeq:8,lastSeq:9,events:[{seq:8,src:"msg",battleId:1,txt:"x",key:"damageFx",fx:{shake:"D",skill:"L-DRAGON-4"}},last]},true);
  ok(T.NET.fxQueue.length===1&&T.NET.fxQueue[0].fx.ko==="D"&&!T.NET.fxQueue[0].fx.skill&&last.fx.skill==="L-REAPER-4","D3 재접속 요약 재생 행에는 시트를 붙이지 않는다 (수신 원본은 건드리지 않음)");
  /* D4·D5 세대 취소 — 재접속 요약·좌석/경기 재설정은 재생 중이던 시트를 걷는다 (전투 DOM 이 남아 있어도) */
  T.document.body.appendChild(tA); tA.children.length=0;
  T.skillSheet.netFxApplyMsgFx(1,{shake:"A",skill:"L-WITCH-4"},T.NET.fxGen); const a1=sheets(tA).length;
  T.skillSheet.netFxEnqueue({firstSeq:20,lastSeq:20,events:[]},true);
  ok(a1===1&&sheets(tA).length===0,"D4 재접속 요약 프레임이 오면 남은 시트 제거");
  T.skillSheet.netFxApplyMsgFx(1,{shake:"A",skill:"L-WITCH-4"},T.NET.fxGen); const g0=T.NET.fxGen, a2=sheets(tA).length;
  T.NET.round=(T.NET.round||0)+1; T.skillSheet.netFxEnqueue({firstSeq:1,lastSeq:1,events:[]},false);
  ok(a2===1&&T.NET.fxGen===g0+1&&sheets(tA).length===0,"D5 공개 방 연출 세대가 바뀌면(경기 재설정) 남은 시트 제거");
}

/* ===== E. 자산·CSS ===== */
function png(file){ // 8비트 RGBA·비인터레이스 PNG 만 읽는다 (아니면 null) — 외부 의존성 없음
  const b=fs.readFileSync(file); if(b.readUInt32BE(0)!==0x89504e47) return null;
  let o=8, w=0, h=0, depth=0, ct=0, il=0; const idat=[];
  while(o<b.length){ const n=b.readUInt32BE(o), t=b.toString("ascii",o+4,o+8), d=b.subarray(o+8,o+8+n);
    if(t==="IHDR"){ w=d.readUInt32BE(0); h=d.readUInt32BE(4); depth=d[8]; ct=d[9]; il=d[12]; } else if(t==="IDAT") idat.push(d); else if(t==="IEND") break; o+=12+n; }
  if(depth!==8||ct!==6||il!==0) return {w,h,rgba:false};
  const raw=zlib.inflateSync(Buffer.concat(idat)), bpp=4, stride=w*bpp, px=Buffer.alloc(h*stride);
  for(let y=0;y<h;y++){ const f=raw[y*(stride+1)], line=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)), out=px.subarray(y*stride,(y+1)*stride), up=y?px.subarray((y-1)*stride,y*stride):null;
    for(let x=0;x<stride;x++){ const a=x>=bpp?out[x-bpp]:0, u=up?up[x]:0, c=(up&&x>=bpp)?up[x-bpp]:0, p=a+u-c, pa=Math.abs(p-a), pb=Math.abs(p-u), pc=Math.abs(p-c);
      out[x]=(line[x]+(f===1?a:f===2?u:f===3?((a+u)>>1):f===4?(pa<=pb&&pa<=pc?a:pb<=pc?u:c):0))&255; } }
  return {w,h,rgba:true,alpha:(x,y)=>px[(y*w+x)*4+3]};
}
{
  const ACCEPTED={dragon:"775bc0080c5a22eca90420c56ec775359940b1ac54f62eb51ae1339292bbc50f",witch:"46d59bcbc74926d7db946438bd7095547a9bde719d9b1d55785fedf10de97310",reaper:"0584d3ad44dda7b22145429101222391cfa6c324b518797e207ac30932e678fa"};
  const T=H.load(htmlPath), made=[]; const ce=T.document.createElement; T.document.createElement=t=>{ const e=ce.call(T.document,t); made.push(e); return e; };
  T.skillSheet.SKILL_SHEET_REQ.clear(); T.skillSheet.skillSheetPreload(); T.document.createElement=ce; // load 때 한 번 나간 프리로드를 다시 센다
  eq(made.map(e=>e.src).sort(),["assets/fx/dragon_96x8.png","assets/fx/reaper_96x8.png","assets/fx/witch_96x8.png"],"E1 고정 3장 프리로드 (정체와 무관한 같은 요청 집합)");
  eq(Object.keys(T.skillSheet.SKILL_SHEET).sort(),ID33.slice().sort(),"E2 시트 표 키 = 실제 33개 4번 기술 ID");
  const want=Object.fromEntries(ID33.map(id=>{ const r=T.ROSTER.find(x=>x.id===id.slice(0,-2)); return [id,r?r.element+"_"+r.arch:id.slice(2,-2).toLowerCase()]; }));
  eq(Object.entries(T.skillSheet.SKILL_SHEET).sort(),Object.entries(want).sort(),"E2b ID → slug = 그 종의 <속성>_<아키타입> (전설 = dragon·witch·reaper)");
  ok(ID33.filter(id=>/^M-/.test(id)).every(id=>T.ART_DIRS.includes(want[id])),"E2c 일반 30종 slug 는 모두 닫힌 전투 도트 폴더 목록(ART_DIRS) 안 — 공개 도트와 같은 이름");
  { const audit=require(path.join(ROOT,"tools","client","fx_sheet_audit.js")).audit(path.join(DEMO,"assets","fx"));
    ok(audit.expected===33&&!audit.extra.length&&!audit.failed.length,"E2d 33장 정량 감사 (768×96 RGBA · ≤80KB · F8 알파 0 · F7 알파 질량 ≤5% · 안전 여백 4px · F4 정점 · F1~F4 그림) "+JSON.stringify(audit.failed)); }
  for(const k of Object.keys(ACCEPTED)){
    const f=path.join(DEMO,"assets","fx",k+"_96x8.png"), p=png(f);
    eq(require("crypto").createHash("sha256").update(fs.readFileSync(f)).digest("hex"),ACCEPTED[k],`E3 ${k} 시트 = 승인된 v3 런타임 원본 바이트`);
    ok(p&&p.rgba&&p.w===768&&p.h===96,`E4 ${k} 768×96 8비트 RGBA`);
    if(!(p&&p.rgba)) continue;
    const opaque=fr=>{ let n=0; for(let y=0;y<96;y++) for(let x=fr*96;x<fr*96+96;x++) if(p.alpha(x,y)>0) n++; return n; };
    const counts=[0,1,2,3,4,5,6,7].map(opaque);
    ok(counts.slice(0,7).every(n=>n>0)&&counts[7]===0,`E5 ${k} F1~F7 그림 있음 · F8 완전 투명 [${counts.join(",")}]`);
  }
  const css=fs.readFileSync(path.join(DEMO,"css","fx.css"),"utf8"), html=fs.readFileSync(htmlPath,"utf8");
  ok(/\.btok \.skfx\{[^}]*background-repeat:no-repeat[^}]*background-size:768px 96px[^}]*animation:skfxPlay \.64s steps\(8\) 1 forwards/.test(css)&&/@keyframes skfxPlay\{to\{background-position:-768px 0;\}\}/.test(css),
    "E6 steps(8) · 640ms 1회 · 끝 -768px 는 반복 없음이라 투명 (9번째 프레임 = 첫 장 재노출 없음)");
  ok(/prefers-reduced-motion: reduce\)\{ \.btok \.skfx\{display:none;\}/.test(css)&&!/!important|@layer/.test(css),"E7 움직임 줄이기 숨김 · !important/@layer 없음");
  ok(/<link rel="stylesheet" href="css\/fx\.css">/.test(html)&&!/data-ui-skin[^>]*>[\s\S]*fx\.css[\s\S]*data-ui-skin/.test(css),"E8 시트 CSS 는 스킨과 따로 로드된다 (스킨 속성을 지워도 연출 유지)");
  ok(!/_192x8|preview\.gif/.test(fs.readdirSync(path.join(DEMO,"assets","fx")).join("|")),"E9 마스터 192×8·미리보기 GIF 는 런타임 폴더에 없다");
  const argon=fs.readFileSync(path.join(DEMO,"css","argon.css"),"utf8"), normal=ID33.filter(id=>/^M-/.test(id)).map(id=>want[id]);
  ok(normal.every(k=>css.includes(`.skfx-${k}{background-image:url("../assets/fx/${k}_96x8.png");}`))&&!/skfx/.test(argon.replace(/\/\*[\s\S]*?\*\//g,"")),"E10 일반 30장 규칙도 기능 연출 fx.css 에만 있다 (스킨 CSS 의 .skfx 규칙 0 — 스킨 OFF 에서도 재생)");
}
{ /* E11~E14 선택 로드 — 전투 무대가 그린 공개 전투 도트 2종만 · 재렌더 중복 없음 · 숨은 말 없음 · 로드 전 미표시 */
  const T=load(3370), made=[]; const ce=T.document.createElement; T.document.createElement=t=>{ const e=ce.call(T.document,t); made.push(e); return e; }; // 고정 3장은 load 때 이미 나갔다
  const a=arena(T,"M-F1"); T.battleModal(); T.battleModal(); T.document.createElement=ce;
  const fx=made.map(e=>e.src).filter(s=>/assets\/fx\//.test(s||""));
  eq(fx.slice().sort(),["assets/fx/fire_std_96x8.png","assets/fx/grass_def_96x8.png"],"E11 전투원 2종(M-F1 · M-G3 공개 도트) 시트만 1번씩 (재렌더 중복 없음)");
  const others=T.S.pieces.filter(x=>x.alive&&x.type==="minion"&&x!==a.fa&&x!==a.fd&&x.rosterId).map(x=>x.element+"_"+(T.ROSTER.find(r=>r.id===x.rosterId)||{}).arch);
  ok(fx.every(s=>/fire_std|grass_def/.test(s))&&others.length>0,"E12 전투에 없는 말("+others.length+")의 시트는 요청하지 않는다");
  ok(!T.skillSheet.SKILL_SHEET_OK.has("fire_std"),"E13 로드 전에는 재생 대상이 아니다 (onload 뒤에만)");
  const im=made.find(e=>/fire_std/.test(e.src||"")); if(im&&im.onload) im.onload();
  ok(T.skillSheet.SKILL_SHEET_OK.has("fire_std")&&!T.skillSheet.SKILL_SHEET_OK.has("grass_def"),"E14 로드가 끝난 시트만 재생 가능 (실패·미완료 = 폴백)");
}

/* ===== G. 표시 훅 — 글자 이모지 → Argon 아이콘 칸 (글자·접근성 이름 불변) ===== */
{
  const T=load(3380); arena(T,"dragon"); T.battleModal(); const K=T.skillSheet, ob=T.byId("overlayBox").innerHTML;
  eq(K.emoGi("⚔️","battle"),'<i class="gi emo emi" style="--i:1">⚔️</i>',"G1 훅 = 원래 글자 + 같은 뜻의 칸 번호 (aria-hidden 없음 → 버튼 접근성 이름 그대로)");
  for(const [ch,i,lb] of [["⚔️",1,"싸우기"],["🎒",2,"가방"],["🔴",41,"포획"],["🏃",45,"도망가기"]])
    ok(ob.includes(`<i class="gi emo emi" style="--i:${i}">${ch}</i> ${lb}</button>`),`G2 전투 명령 [${ch} ${lb}] 글자 그대로 + 칸 ${i}`);
  const ui=fs.readFileSync(path.join(DEMO,"js","ui.js"),"utf8"), game=fs.readFileSync(path.join(DEMO,"css","game.css"),"utf8"), argon=fs.readFileSync(path.join(DEMO,"css","argon.css"),"utf8"), vars=fs.readFileSync(path.join(DEMO,"css","variables.css"),"utf8");
  ok(/\.gi\.emo\{background:none;/.test(game)&&/html\[data-ui-skin="argon"\] \.gi\.emo\.emi:not\(:where\(#tutOverlay \*\)\) \{[^}]*overflow: hidden;[^}]*text-indent: 3em;[^}]*calc\(var\(--i\) \* -1em\) 0 \/ 48em 1em/.test(argon),"G3 스킨 OFF = 원래 이모지(game.css) · Argon = 글자를 칸 밖으로 잘라 숨김 + 같은 칸(var(--i)) · 1em(맥락 글자 크기) · 튜토리얼 제외");
  ok(/const HEART_HTML=`<i class="gi emo" aria-hidden="true">❤️<\/i>`/.test(ui)&&!/\.gi\.emo:not/.test(argon),"G4 훅이 없는 .gi.emo(❤️ 등)는 Argon 에서도 원래 이모지 (가방 칸으로 덮지 않는다)");
  const bare=s=>s.replace(/\/\*[\s\S]*?\*\//g,"");
  ok(!/!important|@layer|@import|https?:\/\//.test(bare(argon))&&!/!important|@layer|@import|https?:\/\//.test(bare(vars)),"G5 스킨 CSS 에 !important · @layer · @import · 외부 URL 0");
}

/* ===== F. X01·X03 문구 ===== */
{
  const T=H.load(htmlPath), N=T.NET; N.publicMode=true; N.mode=true; N.me=0;
  const bar=st=>{ N.roomState=st; N.pause=[{seat:1,graceLeftMs:40000,at:Date.now()}]; N.resuming=false; T.ui238.netResumeBarSync(); return T.byId("netResumeBar").innerHTML; };
  for(const st of ["OPEN","SETUP"]){ const h=bar(st);
    ok(/준비 마감 시간은 멈추지 않고 계속 흐릅니다/.test(h)&&/방 나가기/.test(h)&&!/시간이 멈췄습니다/.test(h)&&/재연결 유예 40초/.test(h),`F1 ${st}: 준비 마감은 계속 흐른다 · [방 나가기] 유지 · '시간이 멈췄다' 없음`); }
  const g=bar("IN_PROGRESS");
  ok(/보드·전투·상점·가방 정리\(B08\) 시간이 멈췄습니다/.test(g)&&/기권을 포함한 양측 입력이 잠기고/.test(g)&&!/방 나가기/.test(g),"F2 경기 중: 보드·전투·상점·B08 시계 정지 문구 · 나가기 없음");
  N.pause=null; N.resuming=true; N.resumeAttempts=1; T.ui238.netResumeBarSync(); const x3=T.byId("netResumeBar").innerHTML;
  ok(/재접속 중/.test(x3)&&!/<button/.test(x3)&&!/포기|나가기|ResumeToken|resumeToken|\d+초/.test(x3),"F3 X03: 버튼(포기·나가기)·초 카운트다운·토큰 노출 없음");
  ok(!/시간이 멈췄/.test(T.skillSheet.NET_PAUSE_MSG)&&!/시간/.test((fs.readFileSync(path.join(DEMO,"js","ui.js"),"utf8").match(/function pauseLockOpen\(subject\)\{ return [^;]*;/)||["시간"])[0]),"F4 공용 정지 토스트·준비/상점 잠금 문구는 '시간이 멈췄다'고 단정하지 않는다");
  N.resuming=false; T.ui238.netResumeBarSync();
}

console.log(`=== smoke_issue335: pass ${pass} / fail ${fail} ===`);
process.exit(fail?1:0);
