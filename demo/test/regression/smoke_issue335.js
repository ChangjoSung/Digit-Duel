/* #335 Argon UI 통합 · 전설 3종 4번 기술 명중 시트 · X01 문구 — 헤드리스 회귀
   실행: node demo/test/regression/smoke_issue335.js [demo/index.html]
   파일을 쓰지 않는다. B절만 기준판(v0.4.15 1f79d4e)을 `git show` 로 메모리에 읽는다(CI fetch-depth 0 필요 — smoke_cross_skill 과 같은 조건).
     A  Core fx.skill — 닫힌 3값 · 실제 4번 기술 명중/처형 행에만 · 표적 = 같은 행 fx.shake
        포함: 일반 명중 · 방어막만 깎은 명중 · 철벽으로 피해 0 · 성공 처형 / 제외: 시전 줄 · 회피 · 환영 무도 무효 · 반사 · 거부된 사신 · 다른 슬롯 · 옛 ID
     B  규칙·난수 불변 — 같은 시드·같은 장면을 기준판과 돌려 로그·HP·다음 난수가 같고 차이는 fx.skill 키뿐
     C  오프라인 표시(applyFx) — 표적 토큰 안 시트 1장 · 640ms 뒤 스스로 제거 · 잘못된 값/표적 무시 · 미로드·움직임 줄이기 = 시트 없음(흔들림·숫자 유지) · 같은 토큰 앞 시트 대체
     D  온라인 표시(netFxApplyMsgFx) — 같은 닫힌 값·표적 · 재접속 요약 재생에는 시트를 붙이지 않는다
     E  자산·CSS — 고정 3장 프리로드 · 768×96 RGBA · F8 완전 투명(F1~F7 은 그림 있음) · steps(8)·no-repeat·640ms · 움직임 줄이기 숨김
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
  T.applyLegend(me,leg);
  if(o.opLegend) T.applyLegend(op,o.opLegend); else T.applySpecies(op,T.ROSTER.find(r=>r.id==="M-G3"),1);
  T.startRounds(me,op,me,op);
  const B=T.S.battle; B.fd.dodge=0; B.fd.evadeDown=0; B.fa.dodge=0;
  const seen=[]; const push=B.msgQ.push; B.msgQ.push=function(...m){ seen.push(...m); return push.apply(this,m); };
  return {B,seen,fa:B.fa,fd:B.fd};
}
const slotOf=(f,id)=>f.skills.indexOf(id);
const tagged=seen=>seen.filter(m=>m.fx&&m.fx.skill!==undefined);
function load(seed){ const T=H.load(htmlPath); if(T.TUT&&T.TUT.open) T.tutClose(); T.setSeed(seed); return T; }

/* ===== A. Core fx.skill ===== */
const SKILL3=["L-DRAGON-4","L-WITCH-4","L-REAPER-4"];
{ /* A1~A3 드래곤 숨결 일반 명중 */
  const T=load(3351), {seen,fa}=arena(T,"dragon");
  T.execSlot("A",slotOf(fa,"L-DRAGON-4"));
  const t=tagged(seen), cast=seen.find(m=>m.key==="skillFx");
  ok(t.length===1&&t[0].fx.skill==="L-DRAGON-4"&&t[0].fx.shake==="D"&&t[0].key==="damageFx"&&/피해!/.test(t[0].txt),"A1 드래곤 숨결 명중 행 1개에만 L-DRAGON-4 · 표적 D · damageFx");
  ok(!!cast&&!("skill" in (cast.fx||{})),"A2 시전 선언 줄(skillFx)에는 붙이지 않는다");
  ok(seen.every(m=>!m.fx||m.fx.skill===undefined||SKILL3.includes(m.fx.skill)),"A3 값은 닫힌 3종 문자열뿐");
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

/* ===== B. 기준판 대조 — 규칙·난수 불변 ===== */
function baseLoad(){
  const dir=fs.mkdtempSync(path.join(require("os").tmpdir(),"dd335base-"));
  try{
    const show=p=>execFileSync("git",["show",`${BASE_REF}:demo/${p}`],{cwd:ROOT,encoding:"utf8",maxBuffer:64<<20});
    const html=show("index.html"); fs.writeFileSync(path.join(dir,"index.html"),html);
    for(const m of html.matchAll(/\b(?:src|href)="((?:js|css)\/[^"]+)"/g)){ fs.mkdirSync(path.join(dir,path.dirname(m[1])),{recursive:true}); fs.writeFileSync(path.join(dir,m[1]),show(m[1])); }
    return H.load(path.join(dir,"index.html"));
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
}
{
  const run=(T,leg,prep)=>{ if(T.TUT&&T.TUT.open) T.tutClose(); T.setSeed(4242); const a=arena(T,leg); if(prep) prep(a);
    T.execSlot("A",slotOf(a.fa,leg==="dragon"?"L-DRAGON-4":"L-WITCH-4"));
    return {blog:a.B.blog.slice(),hp:[a.fa.hp,a.fd.hp,a.fd.shield],next:T.rand(),fx:a.seen.map(m=>{ const f=Object.assign({},m.fx||{}); delete f.skill; return [m.txt,m.key,JSON.stringify(f)]; }),tags:tagged(a.seen).length}; };
  for(const [leg,prep,nm] of [["dragon",null,"드래곤 명중"],["witch",null,"마녀 명중"],["dragon",a=>{a.fd.dodge=0.4;},"드래곤 난수 회피 판정"],["witch",a=>{a.fd.reflectR=2;},"마녀 + 반사"]]){
    let base=null; try{ base=run(baseLoad(),leg,prep); }catch(e){ ok(false,"B0 기준판 로드 실패 — git show "+BASE_REF+" ("+e.message.split("\n")[0]+")"); continue; }
    const cur=run(H.load(htmlPath),leg,prep);
    eq(cur.blog,base.blog,`B1 ${nm}: 전투 로그 동일`);
    eq([cur.hp,cur.next],[base.hp,base.next],`B2 ${nm}: HP·방어막·다음 난수 동일 (난수 소비 불변)`);
    eq(cur.fx,base.fx,`B3 ${nm}: fx.skill 을 뺀 연출 페이로드 동일`);
    ok(base.tags===0,`B4 ${nm}: 기준판에는 fx.skill 이 없다`);
  }
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
    for(const bad of ["L-DRAGON-3","L-DRAGON-5","dragon_breath","witch_prank","reaper","__proto__","toString","constructor","l-dragon-4"," L-DRAGON-4",1,true,{},["L-DRAGON-4"],null]) T.applyFx({shake:"D",skill:bad});
    for(const sh of ["X","a",undefined,null,1]) T.applyFx({shake:sh,skill:"L-DRAGON-4"});
    ok(sheets(tok.A).length+sheets(tok.D).length===0,"C7 닫힌 3값·A|D 표적이 아니면 아무것도 그리지 않는다 (프로토타입 키·대소문자·공백·형 포함)");
    const mm=global.matchMedia; global.matchMedia=q=>({matches:/prefers-reduced-motion: reduce/.test(q)});
    T.applyFx({shake:"D",skill:"L-DRAGON-4"});
    ok(sheets(tok.D).length===0&&tok.D.classList.contains("shake"),"C8 움직임 줄이기 — 시트 없음 (기존 흔들림 클래스 경로는 그대로)");
    global.matchMedia=mm;
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
  T.skillSheet.skillSheetPreload(); T.document.createElement=ce;
  eq(made.map(e=>e.src).sort(),["assets/fx/dragon_96x8.png","assets/fx/reaper_96x8.png","assets/fx/witch_96x8.png"],"E1 고정 3장 프리로드 (정체와 무관한 같은 요청 집합)");
  eq(Object.keys(T.skillSheet.SKILL_SHEET).sort(),SKILL3.slice().sort(),"E2 시트 표 = 닫힌 3값");
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
