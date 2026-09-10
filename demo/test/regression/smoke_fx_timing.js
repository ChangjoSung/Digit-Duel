/* #125 연출 시간 단축 (2000ms → 1200ms) — 연출 시간표·CSS 동기와 실제 타이머 계약 게이트
   사용: node demo/test/regression/smoke_fx_timing.js [demo/index.html]

   원문 AC (v0.4.7 CJ 결정 · 2026-09-09):
     1. 전시성 배너·연출 그룹 12키(turnBanner·contactBanner·explosion·trapFx·roundBanner·skillFx·damageFx·itemFx·
        captureFx·fleeFx·judgeBanner·pushBanner)의 길이를 2초에서 1.2초로 줄인다.
     2. CSS 로 따로 도는 같은 연출(ghostBoom·cellBoom·boomPop = 폭발, trapBlink = 함정)도 같이 1.2초가 된다.
        즉 CSS 지속 시간은 그 연출을 여는 fx 키와 **같은 값**이어야 한다 — 둘 중 하나만 고치면 연출이 잘리거나 남는다.
     3. "2000 일괄 치환"이 아니다 — resultBanner(2500)·countStep(1000)·roundEndFx(1000)·msgStep(600)·
        autoEndGrace(1000)·watchdog(1000)·BAL.aiDelay(650)은 범위 밖이라 그대로다.
     4. damageFx 안의 방어막 → HP 2단 표시는 순서·표시값·입력 잠금을 그대로 유지한 채 damageFx 안에서 끝나야 한다.
        종전 600+600 은 새 damageFx(1200)와 같아 여유가 0 이므로 barStep 과 CSS 두 바 전환을 350ms 로 내려 합 700ms·여유 500ms 를 만든다.
     5. 연출 시간은 표시 계층 전용이다 — 길이를 바꿔도 규칙 결과·난수 소비는 같아야 한다.

   이 파일은 구현을 베끼지 않고 위 AC 를 검사한다. 특히 2·4·5 는 상수 비교가 아니라
   (CSS ↔ 표 관계) · (실제 타이머로 관측한 쓰기 시각) · (길이를 바꿔도 같은 규칙 결과) 로 본다.
   저장소에 파일을 쓰지 않는다 (Saturn --read-only 재실행 가능). 종료 코드 1 = 판정 실패, 2 = 예외. */
"use strict";
const RT=setTimeout; // 하네스가 전역을 갈아끼우기 전의 실제 타이머
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]&&!process.argv[2].startsWith("--")?process.argv[2]:path.join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
const sleep=ms=>new Promise(r=>RT(r,ms));
const now=()=>Date.now();

/* #125 범위: 1.2초로 내려가는 전시성 연출 그룹 12키 */
const SHORTENED={turnBanner:1200,contactBanner:1200,explosion:1200,trapFx:1200,roundBanner:1200,skillFx:1200,
  damageFx:1200,itemFx:1200,captureFx:1200,fleeFx:1200,judgeBanner:1200,pushBanner:1200};
/* #125 범위 밖: CJ 가 "유지"로 못 박은 값들 — 일괄 치환 사고를 막는 음성 대조 */
const KEPT={resultBanner:2500,countStep:1000,roundEndFx:1000,msgStep:600,autoEndGrace:1000,watchdog:1000};
const BARSTEP=350; // damageFx 안 2단 표시의 한 단계

const T=H.load(htmlPath);
const SRC=T.html;

/* ===== A. 연출 시간표 (BAL.fx) — 단일 원천 ===== */
for(const [k,v] of Object.entries(SHORTENED))
  ok(T.BAL.fx[k]===v,`A1 ${k} = ${v}ms (AC1 1.2초) — 실제 ${T.BAL.fx[k]}`);
for(const [k,v] of Object.entries(KEPT))
  ok(T.BAL.fx[k]===v,`A2 ${k} 유지 = ${v}ms (AC3 범위 밖) — 실제 ${T.BAL.fx[k]}`);
/* aiDelay 는 하네스가 0 으로 덮으므로 제품 소스에서 본다 */
ok(/\baiDelay:650\b/.test(SRC),"A2' BAL.aiDelay 650 유지 (AC3 범위 밖 · 소스 기준)");
ok(T.BAL.fx.barStep===BARSTEP,`A3 barStep = ${BARSTEP}ms (AC4) — 실제 ${T.BAL.fx.barStep}`);
ok(T.BAL.fx.autoEnd===true||T.BAL.fx.autoEnd===false,"A3' autoEnd 는 스위치(boolean) — 시간 값이 아니다");

/* A4 AC4 예산 부등식: 방어막 단계 + HP 단계가 damageFx 안에서 끝나고 여유가 남는다 */
const slack=T.BAL.fx.damageFx-2*T.BAL.fx.barStep;
ok(2*T.BAL.fx.barStep<=T.BAL.fx.damageFx,`A4 2*barStep(${2*T.BAL.fx.barStep}) ≤ damageFx(${T.BAL.fx.damageFx})`);
ok(slack>=400,`A4' damageFx 안 여유 ${slack}ms ≥ 400ms (여유 0 금지 — 단계가 그룹 경계에 붙지 않는다)`);

/* A5 연출 시간표에 2000 이 남아 있지 않다 (치환 누락 탐지) */
const fxTable=(SRC.match(/\n\s*fx:\{[\s\S]*?barStep:\d+\}/)||[""])[0];
ok(fxTable.length>0,"A5 연출 시간표 블록을 소스에서 찾았다");
ok(!/:2000\b/.test(fxTable),"A5' 연출 시간표에 2000ms 잔존 없음");

/* A6 fxPlay·bmsg 가 넘기는 그룹 키는 모두 표에 있고 0 이 아니다.
   playMsgs 는 표에 없는 키를 600ms 로 조용히 떨어뜨리므로(ms>0?ms:600) 오타가 테스트 없이는 드러나지 않는다. */
const memoKeys=new Set(T.MEMO_OPTS.map(o=>o.key));
const usedKeys=[...new Set((SRC.match(/\{key:"[a-zA-Z_]+"/g)||[]).map(s=>s.slice(6,-1)))].filter(k=>!memoKeys.has(k));
ok(usedKeys.length>=12,`A6 소스에서 찾은 연출 그룹 키 ${usedKeys.length}종 (${usedKeys.join(",")})`);
const badKeys=usedKeys.filter(k=>!(typeof T.BAL.fx[k]==="number"&&T.BAL.fx[k]>0));
ok(badKeys.length===0,"A6' 모든 그룹 키가 표에 있고 0 이 아니다 — 표 밖 키 "+JSON.stringify(badKeys));
/* A6'' 12키 전부가 실제로 쓰이는지 (표만 고치고 경로가 죽어 있는 상태 방지) */
const unusedShort=Object.keys(SHORTENED).filter(k=>!new RegExp('(key:"'+k+'")|(fxMs\\("'+k+'")').test(SRC));
ok(unusedShort.length===0,"A6'' 단축 12키가 모두 연출 경로에서 쓰인다 — 미사용 "+JSON.stringify(unusedShort));

/* ===== B. CSS ↔ 표 동기 (AC2) — 상수 비교가 아니라 "표와 같은 값" 관계를 검사한다 ===== */
const cssDur=(re,label)=>{ const m=SRC.match(re); ok(!!m,`B0 CSS 규칙 발견: ${label}`); return m?parseFloat(m[1])*1000:null; };
const dExp=T.BAL.fx.explosion, dTrap=T.BAL.fx.trapFx;
const ghost=cssDur(/animation:ghostBoom ([\d.]+)s/,"ghostBoom(.pc.fx-ghost)");
const cellB=cssDur(/animation:cellBoom ([\d.]+)s/,"cellBoom(.cell.fx-boom)");
const boomP=cssDur(/animation:boomPop ([\d.]+)s/,"boomPop(.cell.fx-boom::after)");
const trapB=cssDur(/animation:trapBlink ([\d.]+)s/,"trapBlink(.cell.fx-trap)");
ok(ghost===dExp,`B1 ghostBoom ${ghost}ms = explosion ${dExp}ms (폭발 표시 유지와 같은 길이)`);
ok(cellB===dExp,`B1' cellBoom ${cellB}ms = explosion ${dExp}ms`);
ok(boomP===dExp,`B1'' boomPop ${boomP}ms = explosion ${dExp}ms`);
ok(trapB===dTrap,`B2 trapBlink ${trapB}ms = trapFx ${dTrap}ms`);
ok(ghost===1200&&trapB===1200,`B2' 네 CSS 연출이 1.2초 (AC2) — ghostBoom ${ghost} · trapBlink ${trapB}`);

/* B3 두 바 전환 = barStep (표 한 곳) */
const barDur=sel=>{ const m=SRC.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"[^}]*transition:width ([\\d.]+)s")); return m?parseFloat(m[1])*1000:null; };
const hpDur=barDur(".hpbar>div{"), shDur=barDur(".shbar>div{");
ok(hpDur===T.BAL.fx.barStep,`B3 .hpbar>div transition ${hpDur}ms = barStep ${T.BAL.fx.barStep}ms`);
ok(shDur===T.BAL.fx.barStep,`B3' .shbar>div transition ${shDur}ms = barStep ${T.BAL.fx.barStep}ms`);
ok(hpDur===shDur,"B3'' 두 바가 같은 전환 시간 (한 단계 = 한 값)");
ok(hpDur!==null&&2*hpDur<=dExp+T.BAL.fx.damageFx-dExp,`B3''' CSS 2단(${2*hpDur}ms) ≤ damageFx(${T.BAL.fx.damageFx}ms)`);

/* ===== 실제 타이머 구간 — 제품 값 그대로 관측한다 ===== */
global.setTimeout=RT; // 제품이 부르는 setTimeout 을 실제 타이머로 (이 파일은 T.drain 을 쓰지 않는다)
T.BAL.dmgVar=0; T.BAL.statusProb=1; T.BAL.shockProb=1; T.BAL.aiDelay=30;
T.FX.force=true; T.byId("msgBox").nodeType=1; T.tutSkip(); T.byId("overlay").classList.add("hidden");
const king=o=>T.S.pieces.find(x=>x.owner===o&&x.type==="king");
const first=(o,t,i)=>T.S.pieces.filter(x=>x.owner===o&&x.type===t)[i||0];
function board(mode,lv){ H.freshPlay(T,mode||"pvp",lv); H.clearBoard(T);
  H.place(T,king(0),13,1); H.place(T,king(1),1,7); H.place(T,first(0,"minion",5),13,7); H.place(T,first(1,"minion",5),1,1);
  for(const x of T.S.pieces) if(x.type==="minion"){ x.maxHp=100; x.hp=100; }
  T.FX.force=true; T.FX.log.length=0; T.byId("overlay").classList.add("hidden"); return T.S; }
async function untilUnlocked(cap){ const t0=now(); while(T.fxLocked()&&now()-t0<cap) await sleep(5); return now()-t0; }
/* msgBox 갱신 기록 (그룹 전환 시각) */
const mbLog=[]; { const mb=T.byId("msgBox"); let v=""; Object.defineProperty(mb,"innerHTML",{configurable:true,
  get(){return v;}, set(x){ v=x; mbLog.push({t:now(),txt:String(x)}); }}); }
/* 바 너비 쓰기 기록 — applyFx 가 style.width 에 쓰는 시각을 그대로 잡는다 */
function trackWidth(el,name,sink){ el.style=new Proxy({},{set(t,k,v){ if(k==="width") sink.push({name,v,t:now()}); t[k]=v; return true; }}); }

(async()=>{
  /* ===== C. 관측되는 1.2초 — 상수를 읽지 않고 잠금이 실제로 풀리는 시각으로 확인한다 (AC1) ===== */
  board("pvp"); const mC=first(0,"minion"); H.place(T,mC,10,4);
  const tC=now(); T.turnBannerFx();
  ok(T.fxLocked(),"C1 턴 배너 시작 — 입력 잠금");
  await sleep(700);
  ok(T.fxLocked()&&T.S.selected===null,`C1' t≈${now()-tC}ms (700) — 아직 잠금 · 클릭 무효`);
  T.onCell(10,4); ok(T.S.selected===null,"C1'' 잠금 중 셀 클릭 무시");
  await sleep(400); const atThousand=T.fxLocked(); // t≈1100ms
  const held=await untilUnlocked(T.BAL.fx.turnBanner+T.BAL.fx.watchdog+600)+1100;
  const total=now()-tC;
  ok(atThousand,`C2 t≈1100ms 에는 아직 잠금 (1.2초 선언 하한)`);
  ok(total>=T.BAL.fx.turnBanner-40,`C2' 잠금 유지 ${total}ms ≥ 선언 ${T.BAL.fx.turnBanner}ms`);
  ok(total<=T.BAL.fx.turnBanner+T.BAL.fx.watchdog+400,`C2'' 잠금 해제 ${total}ms ≤ 데드라인 ${T.BAL.fx.turnBanner+T.BAL.fx.watchdog}ms+여유 — 종전 2000ms 보다 짧다`);
  ok(total<1900,`C2''' 종전 2초 회귀 음성 대조: ${total}ms < 1900ms`);
  T.onCell(10,4); ok(T.S.selected===mC,"C3 해제 후 클릭 정상 (잠금이 영구화되지 않는다)");
  T.fxReleaseAll();

  /* C4 폭발·함정 그룹도 1.2초로 관측된다 (CSS 와 같은 길이여야 하는 두 연출) */
  for(const key of ["explosion","trapFx"]){
    const t=now(); T.fxPlay({key,kind:"boom",dim:false,title:key});
    const h=await untilUnlocked(T.BAL.fx[key]+T.BAL.fx.watchdog+600);
    ok(h>=T.BAL.fx[key]-40&&h<=T.BAL.fx[key]+T.BAL.fx.watchdog+400,`C4 ${key} 잠금 ${h}ms ≈ 선언 ${T.BAL.fx[key]}ms (CSS ${key==="explosion"?"ghostBoom/cellBoom/boomPop":"trapBlink"} 와 같은 길이)`);
    ok(h<1900,`C4' ${key} 종전 2초 회귀 음성 대조 ${h}ms`);
  }

  /* ===== D. AC4 damageFx 안 방어막 → HP 2단 — 제품 damageFx(1200)·barStep(350) 그대로 =====
     전투 진입 램프(접촉·카운트다운·라운드 배너)만 짧게 줄인다: 측정 대상은 피해 그룹 한 건이고
     램프는 #125 의 다른 키들로 이미 C 절에서 확인했다. damageFx·barStep·msgStep 은 제품 값 유지. */
  const RAMP={contactBanner:60,countStep:40,roundBanner:60,skillFx:60};
  const savedRamp={}; for(const k of Object.keys(RAMP)){ savedRamp[k]=T.BAL.fx[k]; T.BAL.fx[k]=RAMP[k]; }
  board("pvp"); const aD=first(0,"minion"), dD=first(1,"minion"); H.place(T,aD,8,4); H.place(T,dD,6,4);
  T.doMove(aD,7,4);
  let n=0; while(T.fxLocked()&&n++<400) await sleep(10);
  const B=T.S.battle;
  ok(!!B&&!T.fxLocked()&&B.phase===0,"D0 전투 메뉴 활성 (공격자 A 행동 차례)");
  B.fd.shield=10; B.dispShD=10; // 방어자 방어막 10 — 한 피해가 방어막과 HP 를 함께 줄이는 조건
  const shEl=T.byId("shfill-D"), hpEl=T.byId("hpfill-D"), txtEl=T.byId("hptxt-D");
  const W=[]; trackWidth(shEl,"shield",W); trackWidth(hpEl,"hp",W);
  const hpBefore=B.fd.hp; mbLog.length=0;
  const tD=now(); global.__act(0);
  ok(B.fd.shield===0&&B.fd.hp<hpBefore,"D1 규칙은 즉시 완결 — 방어막 0 · HP 감소 (연출 단축이 규칙을 늦추지 않는다)");
  ok(T.fxLocked(),"D1' 피해 연출 재생 중 입력 잠금 (AC4 입력 잠금 보존)");
  /* 잠금 중 같은 행동을 다시 눌러도 두 번 적용되지 않는다 — 1.2초로 줄어든 창에서 특히 중요하다 */
  const hpMid=B.fd.hp, blogMid=B.blog.length;
  global.__act(0); global.__act(1);
  ok(B.fd.hp===hpMid&&B.blog.length===blogMid,"D1'' 잠금 중 중복 선택 무효 — HP·로그 불변 (이중 행동 없음)");
  n=0; while(T.fxLocked()&&n++<600) await sleep(10);
  const tEnd=now();
  const shW=W.filter(x=>x.name==="shield"), hpW=W.filter(x=>x.name==="hp");
  const gap=(hpW[0]&&shW[0])?hpW[0].t-shW[0].t:null;
  ok(shW.length>=1&&hpW.length===1,`D2 방어막 쓰기 ${shW.length}회 · HP 쓰기 ${hpW.length}회 (HP 는 정확히 1회)`);
  ok(shW[0]&&hpW[0]&&shW[0].t<hpW[0].t,"D3 순서 보존: 방어막 바가 HP 바보다 먼저 (흡수가 먼저 보인다)");
  ok(gap!==null&&gap>=T.BAL.fx.barStep-25,`D4 HP 바는 barStep(${T.BAL.fx.barStep}ms) 이상 늦다 — 실측 ${gap}ms`);
  ok(gap!==null&&gap<=T.BAL.fx.damageFx-T.BAL.fx.barStep+120,`D5 2단 합이 damageFx(${T.BAL.fx.damageFx}ms) 안에서 끝나고 CSS 전환 ${T.BAL.fx.barStep}ms 만큼 여유가 남는다 — 실측 ${gap}ms`);
  const dmgAt=mbLog.filter(x=>/피해!/.test(x.txt)).map(x=>x.t)[0];
  ok(dmgAt!==undefined&&hpW[0]&&hpW[0].t>=dmgAt,"D6 HP 쓰기는 피해 메시지 표시 이후 (그룹 안에서 일어난다)");
  ok(dmgAt!==undefined&&hpW[0]&&tEnd-hpW[0].t>=T.BAL.fx.barStep-60,`D7 HP 전환(${T.BAL.fx.barStep}ms)이 끝나기 전에 잠금이 풀리지 않는다 — HP 쓰기 뒤 ${tEnd-hpW[0].t}ms 남았다 (AC4 여유)`);
  ok(shW[shW.length-1].v==="0%","D8 최종 표시: 방어막 바 0%");
  ok(hpW[0]&&hpW[0].v===Math.max(0,B.fd.hp/B.fd.maxHp*100)+"%",`D8' 최종 표시: HP 바 ${hpW[0]&&hpW[0].v} = 규칙 HP ${B.fd.hp}/${B.fd.maxHp}`);
  ok(txtEl.textContent===B.fd.hp,`D8'' HP 숫자 ${txtEl.textContent} = 규칙 HP ${B.fd.hp}`);
  ok(B.dispHpD===B.fd.hp&&B.dispShD===0,"D9 표시 기준값(dispHpD·dispShD)이 규칙 값과 일치 — 재렌더도 최신 값을 그린다");

  /* ===== E. 경계 — 늦은 콜백·새 게임·무효화를 제품 barStep(350ms) 에서 ===== */
  /* E1 뒤따른 HP 갱신이 대기 중인 지연 쓰기를 이긴다 (일련번호 토큰) */
  const B2=T.S.battle;
  if(B2){ B2.dispShD=40; B2.dispHpD=100; B2.fd.maxHp=100;
    const W2=[]; trackWidth(T.byId("hpfill-D"),"hp",W2);
    T.applyFx({hp:{side:"D",val:60,max:100},st:{side:"D",text:"🛡5",shield:5,max:100}}); // 방어막+HP 동시 → HP 는 barStep 대기
    ok(W2.length===0,"E1 방어막+HP 동시 감소 → HP 쓰기는 즉시 일어나지 않는다 (barStep 대기)");
    T.applyFx({hp:{side:"D",val:40,max:100}}); // HP 만 — 즉시 쓰기 + 옛 대기 무효화
    ok(W2.length===1&&W2[0].v==="40%","E1' HP 단독 갱신은 즉시 쓰기 (40%)");
    await sleep(T.BAL.fx.barStep+120);
    ok(W2.filter(x=>x.v==="60%").length===0&&W2.length===1,`E1'' barStep(${T.BAL.fx.barStep}ms) 뒤 옛 지연 쓰기(60%)는 무효 — 최신 값 40% 유지`);
  } else ok(false,"E1 전투 객체 없음 (전제 실패)");

  /* E2 새 게임이면 옛 전투의 지연 쓰기가 새 바를 건드리지 않는다 */
  const Bold=T.S.battle;
  if(Bold){ Bold.dispShD=30; Bold.dispHpD=100;
    T.applyFx({hp:{side:"D",val:70,max:100},st:{side:"D",text:"🛡5",shield:5,max:100}}); }
  T.fxReleaseAll(); T.S.battle=null; T.close();
  board("pvp"); const aE=first(0,"minion"), dE=first(1,"minion"); H.place(T,aE,8,4); H.place(T,dE,6,4);
  T.doMove(aE,7,4); const Bnew=T.S.battle;
  const hpNew=T.byId("hpfill-D"); hpNew.style={width:"SENTINEL"};
  await sleep(T.BAL.fx.barStep+150);
  ok(!!Bnew&&Bnew!==Bold&&hpNew.style.width==="SENTINEL",`E2 새 게임·새 전투에서 옛 지연 쓰기 무효 (HP 바 SENTINEL 유지)`);
  n=0; while(T.fxLocked()&&n++<600) await sleep(10); T.fxReleaseAll(); T.S.battle=null; T.close();
  for(const k of Object.keys(savedRamp)) T.BAL.fx[k]=savedRamp[k];

  /* E3 헤드리스·sim(fxLive() false) → 시간 0, 동기 즉시 쓰기 (단축은 표시 계층 전용) */
  T.FX.force=false;
  ok(T.fxMs("damageFx")===0&&T.fxMs("barStep")===0&&T.fxMs("explosion")===0,"E3 fxLive() false → 모든 연출 시간 0 (단축 전과 같은 계약)");
  T.FX.force=true;
  ok(T.fxMs("damageFx")===T.BAL.fx.damageFx,"E3' fxLive() true → 표 값 그대로");

  /* ===== F. 온라인: 행동자·peer — 1.2초로 줄어든 잠금 창에서도 수신 프레임은 보류 후 적용 ===== */
  board("pvp"); T.NET.started=true; T.NET.mode=false; T.NET.queue.length=0;
  const tF=now(); T.fxPlay({key:"contactBanner",title:"lock"});
  T.NET.queue.push({t:"skipMain"}); T.netPump();
  ok(T.NET.queue.length===1&&!T.S.mainUsed,"F1 잠금 중 수신 프레임 보류 (드롭·조기 적용 없음)");
  await sleep(700); T.netPump();
  ok(T.NET.queue.length===1&&!T.S.mainUsed,`F1' t≈${now()-tF}ms 에도 아직 보류 (1.2초 창)`);
  await untilUnlocked(T.BAL.fx.contactBanner+T.BAL.fx.watchdog+600); T.netPump();
  const tApplied=now()-tF;
  ok(T.NET.queue.length===0&&T.S.mainUsed,"F2 해제 후 프레임 적용 — 상태 일치");
  ok(tApplied<=T.BAL.fx.contactBanner+T.BAL.fx.watchdog+500,`F2' 보류 해소까지 ${tApplied}ms — 종전 2초 대기보다 짧다`);
  T.NET.started=false; T.fxReleaseAll();

  /* ===== G. AC5 연출 길이는 표시 계층 전용 — 길이를 바꿔도 규칙 결과·난수 소비가 같다 =====
     제품 값(1200/350)으로 같은 시드 전투를 한 번 더 돌리는 것은 CI 에서 너무 느리다.
     대신 같은 시드·같은 행동을 **서로 다른 연출 길이 두 벌**로 실제 타이머 위에서 돌려
     규칙 결과(HP·로그·난수 상태)가 동일한지 본다 — 바뀌면 시간이 규칙에 새는 것이다. */
  async function runOnce(fxScale){
    const keys=Object.keys(SHORTENED); const saved={};
    for(const k of keys){ saved[k]=T.BAL.fx[k]; T.BAL.fx[k]=fxScale; }
    const sBar=T.BAL.fx.barStep, sCount=T.BAL.fx.countStep, sMsg=T.BAL.fx.msgStep;
    T.BAL.fx.barStep=Math.round(fxScale*0.3); T.BAL.fx.countStep=Math.round(fxScale*0.5); T.BAL.fx.msgStep=Math.round(fxScale*0.5);
    T.setSeed(20260909);
    board("pvp"); const a=first(0,"minion"), d=first(1,"minion"); H.place(T,a,8,4); H.place(T,d,6,4);
    T.doMove(a,7,4); let i=0; while(T.fxLocked()&&i++<600) await sleep(5);
    if(T.S.battle&&T.S.battle.phase===0){ global.__act(0); i=0; while(T.fxLocked()&&i++<600) await sleep(5); }
    const B=T.S.battle;
    const out={hpAtt:B?B.fa.hp:null,hpDef:B?B.fd.hp:null,blog:B?B.blog.join("|"):null,
      round:B?B.round:null,roll:[T.rand(),T.rand(),T.rand()].join(",")};
    T.fxReleaseAll(); T.S.battle=null; T.close();
    for(const k of keys) T.BAL.fx[k]=saved[k];
    T.BAL.fx.barStep=sBar; T.BAL.fx.countStep=sCount; T.BAL.fx.msgStep=sMsg;
    return out;
  }
  const gFast=await runOnce(40), gSlow=await runOnce(90);
  ok(gFast.hpAtt!==null&&gFast.hpDef!==null,"G0 두 실행이 모두 전투를 진행했다 (전제)");
  ok(gFast.hpAtt===gSlow.hpAtt&&gFast.hpDef===gSlow.hpDef,`G1 연출 길이가 달라도 HP 결과 동일 (공격측 ${gFast.hpAtt}/${gSlow.hpAtt} · 방어측 ${gFast.hpDef}/${gSlow.hpDef})`);
  ok(gFast.blog===gSlow.blog,"G1' 전투 로그 동일 — 연출 길이가 규칙 분기를 바꾸지 않는다");
  ok(gFast.roll===gSlow.roll,"G1'' 같은 시드에서 난수 소비 동일 — 연출이 rand() 를 먹지 않는다");
  ok(gFast.round===gSlow.round,"G1''' 라운드 진행 동일");
  T.setSeed(null);

  console.log(`\n=== smoke_fx_timing (#125): pass ${pass} / fail ${fail} ===`);
  if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(2); });
