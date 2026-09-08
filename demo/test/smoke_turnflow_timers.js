/* #106 턴 흐름·연출 — 실제 타이머 검증 (Node 실 setTimeout · FX.force 로 연출 시간을 켠 헤드리스)
   사용: node demo/test/smoke_turnflow_timers.js [demo/index.html]
   하네스의 가짜 타이머 대신 Node 의 실제 setTimeout 을 제품에 되돌려 주고 BAL.fx 를 짧게(수십 ms) 낮춰,
   (1) 잠금이 선언 시간 이상·데드라인(ms+watchdog) 이하로 실제로 유지·해제되는지 (2) onEnd 예외·새 게임(오래된 타이머)에도 데드라인 안에 풀리는지
   (3) 접촉 → 상황 문구 → 3·2·1·배틀 시작! → 라운드 배너 → 기술 그룹 → 피해 그룹 → 다음 라운드 배너 의 실제 시간 순서
   (4) 자동 턴 종료가 grace 뒤에 발화하고 그 전에는 발화하지 않는지 (5) PVE AI 가 연출 idle 뒤 aiDelay 를 기산하는지 (6) 수신 큐가 잠금 중 보류·해제 후 적용되는지
   파일을 쓰지 않는다 (Saturn --read-only 재실행 가능). 종료 코드 1 = 판정 실패. */
"use strict";
const RT=setTimeout, RCI=clearInterval; // 하네스가 전역을 갈아끼우기 전의 실제 타이머
const path=require("path");
const H=require("./harness");
const htmlPath=process.argv[2]&&!process.argv[2].startsWith("--")?process.argv[2]:path.join(__dirname,"..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
const sleep=ms=>new Promise(r=>RT(r,ms));
const T=H.load(htmlPath);
global.setTimeout=RT; // 제품이 부르는 setTimeout 을 실제 타이머로 (T.drain 은 이 파일에서 쓰지 않는다)
T.BAL.dmgVar=0; T.BAL.statusProb=1; T.BAL.shockProb=1; T.BAL.aiDelay=30;
const MS=70, WD=60; // 연출 60~70ms · 워치독 60ms
for(const k of Object.keys(T.BAL.fx)) if(typeof T.BAL.fx[k]==="number") T.BAL.fx[k]=MS;
T.BAL.fx.watchdog=WD; T.BAL.fx.autoEndGrace=90; T.BAL.fx.msgStep=40; T.BAL.fx.autoEnd=false;
T.FX.force=true; T.byId("msgBox").nodeType=1; T.tutSkip(); T.byId("overlay").classList.add("hidden");
const king=o=>T.S.pieces.find(x=>x.owner===o&&x.type==="king"); const first=(o,t,i)=>T.S.pieces.filter(x=>x.owner===o&&x.type===t)[i||0];
function board(mode,lv){ H.freshPlay(T,mode||"pvp",lv); H.clearBoard(T); H.place(T,king(0),13,1); H.place(T,king(1),1,7); H.place(T,first(0,"minion",5),13,7); H.place(T,first(1,"minion",5),1,1);
  for(const x of T.S.pieces) if(x.type==="minion"){ x.maxHp=100; x.hp=100; } T.FX.force=true; T.FX.log.length=0; T.byId("overlay").classList.add("hidden"); return T.S; }
const now=()=>Date.now();
async function untilUnlocked(cap){ const t0=now(); while(T.fxLocked()&&now()-t0<cap) await sleep(5); return now()-t0; }
/* msgBox 갱신 기록 (그룹 전환 시각) */
const mbLog=[]; { const mb=T.byId("msgBox"); let v=""; Object.defineProperty(mb,"innerHTML",{configurable:true,get(){return v;},set(x){ v=x; mbLog.push({t:now(),txt:String(x)}); }}); }

(async()=>{
  /* 1. 턴 배너 잠금 실제 시간 */
  board("pvp"); const m=first(0,"minion"); H.place(T,m,10,4);
  const t0=now(); T.turnBannerFx();
  ok(T.fxLocked()&&T.FX.cur.title==="나의 턴!","1a 배너 시작·잠금");
  await sleep(15); T.onCell(10,4); ok(T.S.selected===null,"1b 잠금 중 셀 클릭 무시 (t≈15ms)");
  T.netAction({t:"skipMain"}); ok(!T.S.mainUsed,"1c 잠금 중 턴바 액션 무시");
  await untilUnlocked(MS+WD+500); const held=now()-t0;
  ok(held>=MS-5&&held<=MS+WD+60,"1d 잠금 유지 시간 "+held+"ms — 선언 "+MS+"ms 이상 · 데드라인 "+(MS+WD)+"ms 이하(+여유)");
  T.onCell(10,4); ok(T.S.selected===m,"1e 해제 후 클릭 정상");
  /* 2. onEnd 예외 · 오래된 타이머 */
  T.fxPlay({key:"turnBanner",title:"boom",onEnd:()=>{ throw new Error("boom"); }}); T.fxPlay({key:"turnBanner",title:"next"});
  const t2=now(); await sleep(MS+20); ok(T.FX.cur&&T.FX.cur.title==="next","2a onEnd 예외 뒤 다음 항목 진행 (데드라인 안)");
  const h2=await untilUnlocked(MS+WD+500); ok(!T.fxLocked(),"2b 큐 종료 후 해제 ("+(now()-t2)+"ms)");
  T.fxPlay({key:"turnBanner",title:"old"}); ok(T.fxLocked(),"2c 옛 게임 배너 시작");
  board("pvp"); // newGame → fxReleaseAll
  ok(!T.fxLocked()&&T.byId("fxBanner")._cls.has("hidden"),"2d 새 게임 즉시 해제·배너 숨김");
  T.fxPlay({key:"turnBanner",title:"new"}); await sleep(MS/2); // 옛 타이머(MS 뒤)가 이 사이에 돌아온다
  ok(T.FX.cur&&T.FX.cur.title==="new","2e 옛 게임 타이머가 새 게임 항목을 끝내지 않는다 (세대 토큰)");
  await untilUnlocked(MS+WD+500); ok(!T.fxLocked(),"2f 새 항목은 제 시간에 해제");
  /* 3. 접촉 → 전투 전체 타임라인 */
  board("pvp"); const a=first(0,"minion"), d=first(1,"minion"); H.place(T,a,8,4); H.place(T,d,6,4); mbLog.length=0;
  const t3=now(); T.doMove(a,7,4);
  ok(!!T.S.battle&&T.fxLocked(),"3a 이동 → 접촉 → 전투 진입 (규칙 즉시) · 잠금");
  let n=0; while(T.fxLocked()&&n++<200) await sleep(10);
  const L=T.FX.log.map(x=>({k:x.key,t:x.shown-t3,title:x.title,sub:x.sub}));
  const seq=L.map((x,i)=>i===1?x.sub:(x.title||x.sub));
  ok(seq[0]==="⚠️ 상대 말 접촉!"&&seq[1]==="배틀을 시작합니다."&&seq.slice(2,6).join(",")==="3,2,1,배틀 시작!"&&/턴!/.test(seq[6]||""),"3b 순서: 접촉 → 상황 문구 → 3·2·1·배틀 시작! → 라운드 배너 ("+seq.join(" | ")+")");
  const gaps=[]; for(let i=1;i<7;i++) gaps.push(L[i].t-L[i-1].t);
  ok(gaps.every(g=>g>=MS-8),"3c 각 구간이 선언 시간 이상 유지 ("+gaps.join("/")+"ms)");
  const tRound=L[6].t;
  ok(now()-t3>=tRound+MS-8,"3d 라운드 배너 뒤 메뉴 활성까지 대기 (총 "+(now()-t3)+"ms)");
  const bh=T.byId("overlayBox").innerHTML; ok(!T.fxLocked()&&/__menu\('fight'\)/.test(bh)&&!/<button disabled[^>]*__menu\('fight'\)/.test(bh),"3e 메뉴 활성");
  mbLog.length=0; const t4=now(); global.__act(0);
  ok(T.MSGPLAYING&&T.fxLocked(),"3f 행동 → 메시지 재생 잠금");
  n=0; while(T.fxLocked()&&n++<300) await sleep(10);
  const grp=mbLog.filter(x=>x.txt&&!/행동을 선택하세요/.test(x.txt)).map(x=>({t:x.t-t4,txt:x.txt.slice(0,30)}));
  const iSkill=grp.findIndex(x=>/의 .+!/.test(x.txt)), iDmg=grp.findIndex(x=>/피해!/.test(x.txt));
  ok(iSkill===0&&iDmg>iSkill&&grp[iDmg].t-grp[iSkill].t>=MS-8,"3g 기술 그룹 → 피해 그룹 (간격 "+(iDmg>=0?grp[iDmg].t-grp[iSkill].t:"?")+"ms ≥ "+MS+") "+JSON.stringify(grp.slice(0,4)));
  const rb=T.FX.log.filter(x=>x.key==="roundBanner"); ok(rb.length===2&&rb[1].shown>=t4+2*MS-8,"3h 피해 그룹 뒤 다음 행동자 라운드 배너 (2번째, +"+(rb[1].shown-t4)+"ms)");
  T.NET.started=true; ok(T.netReady({t:"act",k:0})===true&&!T.fxLocked(),"3i idle 후 수신 전투 프레임 적용 가능"); T.NET.started=false;
  T.fxReleaseAll(); T.S.battle=null; T.close();
  /* 4. 자동 턴 종료 grace */
  T.BAL.fx.autoEnd=true; board("pvp"); const m4=first(0,"minion"); H.place(T,m4,10,4); T.S.mainUsed=true;
  const t5=now(); T.render(); ok(!!T.FX.auto,"4a 예약");
  await sleep(40); ok(T.S.turnCount===0,"4b grace(90ms) 전에는 발화하지 않음 (t≈40ms)");
  await sleep(90); ok(T.S.turnCount===1&&T.S.metrics.autoEnds===1,"4c grace 뒤 발화 (t≈"+(now()-t5)+"ms)");
  await untilUnlocked(MS+WD+500); // 다음 턴 배너
  T.BAL.fx.autoEnd=false;
  /* 5. PVE AI 는 연출 idle 뒤 aiDelay */
  board("pve"); T.S.current=1; T.S.mainUsed=false; const am=first(1,"minion"); H.place(T,am,3,4);
  const t6=now(); T.turnBannerFx(); T.aiSchedule();
  ok(T.FX.cur&&T.FX.cur.title==="상대 턴!","5a AI 턴 '상대 턴!' 배너");
  await sleep(MS-20); ok(!T.S.mainUsed,"5b 배너 중 AI 미행동 (t≈"+(now()-t6)+"ms)");
  let k=0; while(!T.S.mainUsed&&k++<60) await sleep(10);
  const tAct=now()-t6; ok(T.S.mainUsed&&tAct>=MS+T.BAL.aiDelay-15,"5c AI 는 idle(+"+MS+"ms) 뒤 aiDelay("+T.BAL.aiDelay+"ms) 기산 → 행동 t≈"+tAct+"ms");
  await sleep(200); // AI 턴 마무리 대기
  /* 6. 수신 큐 보류 (온라인 모드 흉내: NET.started 만 켜고 큐에 프레임) */
  board("pvp"); T.NET.started=true; T.NET.mode=false; T.NET.queue.length=0;
  T.fxPlay({key:"turnBanner",title:"lock"}); T.NET.queue.push({t:"skipMain"}); T.netPump();
  ok(T.NET.queue.length===1&&!T.S.mainUsed,"6a 잠금 중 수신 프레임 보류 (드롭 없음)");
  await untilUnlocked(MS+WD+500); T.netPump();
  ok(T.NET.queue.length===0&&T.S.mainUsed,"6b 해제 후 프레임 적용");
  T.NET.started=false;
  /* 7. 5.5 방어막 → HP 표시 단계 (실제 타이머): 실제 전투 행동에서 방어막 바 쓰기 시각 < HP 바 쓰기 시각, 간격 ≥ barStep, HP 쓰기는 피해 그룹(damageFx) 안에서 1회 */
  T.BAL.fx.barStep=30; // damageFx(70ms) 안에서 끝나도록 (실제 값 600 < damageFx 2000 과 같은 비율 조건)
  board("pvp"); const a7=first(0,"minion"), d7=first(1,"minion"); H.place(T,a7,8,4); H.place(T,d7,6,4);
  T.doMove(a7,7,4); n=0; while(T.fxLocked()&&n++<200) await sleep(10); // 접촉 → 카운트다운 → 라운드 배너 → 메뉴
  const B7=T.S.battle; ok(!!B7&&!T.fxLocked()&&B7.phase===0,"7a 전투 메뉴 활성 (공격자 A 행동)");
  B7.fd.shield=10; B7.dispShD=10; // 방어자에게 방어막 10 (표시 기준값도 함께 — 실제 경로에서는 방어막 획득 메시지의 applyFx 가 채운다)
  const sh7=T.byId("shfill-D"), hp7=T.byId("hpfill-D"); const w7=[]; const trk=(el,name)=>{ el.style=new Proxy({},{set(t,k,v){ if(k==="width") w7.push({name,v,t:now()}); t[k]=v; return true; }}); };
  trk(sh7,"shield"); trk(hp7,"hp"); const hpBefore=B7.fd.hp;
  const t7=now(); global.__act(0);
  ok(B7.fd.shield===0&&B7.fd.hp<hpBefore,"7b 규칙 즉시: 방어막 0·HP 감소 (표시는 그룹 재생과 동기 — 피해 그룹 시점에 dispHp 갱신)");
  n=0; while(T.fxLocked()&&n++<300) await sleep(10);
  ok(B7.dispHpD===B7.fd.hp&&B7.dispShD===0,"7b' 재생 뒤 dispHpD·dispShD 가 규칙 값과 일치");
  const shW=w7.filter(x=>x.name==="shield"), hpW=w7.filter(x=>x.name==="hp");
  const dmgAt=mbLog.filter(x=>/피해!/.test(x.txt)).map(x=>x.t-t7)[0];
  ok(shW.length>=1&&hpW.length===1&&shW[0].t<hpW[0].t,"7c 방어막 바 쓰기가 HP 바 쓰기보다 먼저 (shield "+(shW[0]?shW[0].t-t7:"?")+"ms → hp "+(hpW[0]?hpW[0].t-t7:"?")+"ms) · HP 쓰기 1회");
  ok(hpW.length===1&&shW.length>=1&&hpW[0].t-shW[0].t>=T.BAL.fx.barStep-8&&hpW[0].t-shW[0].t<=MS+WD,"7d HP 바는 barStep("+T.BAL.fx.barStep+"ms) 이상 늦게, damageFx("+MS+"ms)+여유 안에 시작 (간격 "+(hpW[0]&&shW[0]?hpW[0].t-shW[0].t:"?")+"ms)");
  ok(hpW.length===1&&hpW[0].v===Math.max(0,B7.fd.hp/B7.fd.maxHp*100)+"%"&&shW[shW.length-1].v==="0%"&&dmgAt!==undefined&&hpW[0].t-t7>=dmgAt,"7e 최종 표시: 방어막 0% · HP "+(hpW[0]?hpW[0].v:"?")+" (규칙 HP 와 일치) · HP 쓰기는 피해 메시지 표시 이후");
  /* 8. 옛 게임의 지연 HP 쓰기가 새 게임에서 돌아와도 새 전투의 HP 바를 건드리지 않는다 (실제 타이머) */
  n=0; while(T.fxLocked()&&n++<300) await sleep(10);
  const B8=T.S.battle; if(B8){ B8.dispShD=30; B8.dispHpD=100; T.applyFx({hp:{side:"D",val:60,max:100},st:{side:"D",text:"🛡5",shield:5,max:100}}); }
  ok(!!B8&&hp7.style.width!=="60%","8a 옛 전투에서 방어막+HP 감소 → HP 쓰기 barStep 대기 중");
  T.fxReleaseAll(); T.S.battle=null; T.close(); board("pvp"); // 새 게임 (세대 증가)
  const a8=first(0,"minion"), d8=first(1,"minion"); H.place(T,a8,8,4); H.place(T,d8,6,4); T.doMove(a8,7,4); const B9=T.S.battle;
  hp7.style={width:"NEW"}; await sleep(T.BAL.fx.barStep+40);
  ok(B9&&B9!==B8&&hp7.style.width==="NEW","8b 새 게임·새 전투에서 옛 지연 쓰기 무효 (HP 바 NEW 유지)");
  n=0; while(T.fxLocked()&&n++<300) await sleep(10); T.fxReleaseAll(); T.S.battle=null; T.close();
  console.log(`\n=== smoke_turnflow_timers (#106): pass ${pass} / fail ${fail} ===`);
  if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(2); });
