/* #106 턴 흐름·연출 계약 (docs/v0.4.4-turn-flow-spec.md) 헤드리스 회귀 — node demo/test/regression/smoke_turnflow.js [demo/index.html]
   A. 회복 주 행동(T2): 지정·틱 경계·상한·중복 가드·만피 유지·복수 자세·해제 조건·대상 자격·상대 비노출·AI 공정 관측·rand 0
   B. 폭탄 직접 접촉(T3/4.4.2): 하수인·동료/왕·폭탄/함정 결과, 전투 1회·재선택 없음, BT 2칸·텔레포트·숲 충돌·기존 인접·능동 클릭·대칭
   C. 함정 공개(T4): 함정+걸린 말만 revealed
   D. HP 비율 판정(T6): 비율·동률 방어자·방어막 미포함·예비 70/100 트레이드오프·recA/recD 지표
   E. 자동 턴 종료(T7): 조건·보류(강제·queue·텔레포트·모달·선택 전투·AI 턴)·발화·주 행동 전 특례·온라인 행동자 전용
   F. 버닝 타임 배너(T9): 65턴 1회·턴 배너보다 먼저·새 게임 초기화·온라인 양측 같은 순서
   G. 연출 큐·잠금(3장, FX.force + 가짜 타이머): 순서·입력 차단·워치독·오래된 타이머 무효·수신 큐 보류
   H. 접촉 문구표·거울(4.3/4.7) · I. 온라인 락스텝(회복 액션·틱·자동 종료 송신 주체·rand 동일) · J. 전투 4카테고리 DOM
   파일을 쓰지 않는다 (Saturn --read-only 재실행 가능). */
"use strict";
const fs=require("fs"), path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]&&!process.argv[2].startsWith("--")?process.argv[2]:path.join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function block(name,fn){ try{ fn(); }catch(e){ fail++; fails.push(name+" — 예외 "+e.message); console.error("FAIL(예외): "+name+" — "+(e.stack||e.message)); } }
const J=JSON.stringify;
const T=H.load(htmlPath);
T.BAL.dmgVar=0; T.BAL.statusProb=1; T.BAL.shockProb=1;
const S=()=>T.S;
const king=(o)=>T.S.pieces.find(x=>x.owner===o&&x.type==="king");
const first=(o,type,i)=>T.S.pieces.filter(x=>x.owner===o&&x.type===type)[i||0];
/* 보드 초기화: 양 왕을 구석에, 나머지 전부 회수 (전멸 방지용 하수인 1기씩 뒤에 배치) */
function board(mode,lv){
  H.freshPlay(T,mode||"pvp",lv); H.clearBoard(T);
  H.place(T,king(0),13,1); H.place(T,king(1),1,7);
  H.place(T,first(0,"minion",5),13,7); H.place(T,first(1,"minion",5),1,1);
  T.FX.log.length=0; T.S.contactKind="move"; T.tutSkip(); T.TQ.length=0; T.FX.auto=null; T.els.overlay.classList.add("hidden"); // 실제 DOM 초기 상태(오버레이 숨김)
  for(const x of T.S.pieces) if(x.type==="minion"){ x.maxHp=100; x.hp=100; } // 종별 HP(85~120)를 100 으로 통일 — 5% 틱·비율 검증 단순화
  return T.S;
}
const randCount=fn=>{ const R=T.rand; let n=0; T.setSeed(1); const orig=global.Math.random; /* rand() 는 RNG 경유 — 소비 수는 시드 상태 차이로 잰다 */
  const before=T.rand(); T.setSeed(1); fn(); const after=T.rand(); T.setSeed(1); let k=0; while(k<50){ if(T.rand()===after){ break; } k++; } return k; };
/* rand 소비 수: 같은 시드에서 fn 뒤 다음 rand 값이 시드 시퀀스의 몇 번째인지 (0 = 소비 없음) */
function randUsed(fn){ T.setSeed(4242); const seq=[]; for(let i=0;i<60;i++) seq.push(T.rand()); T.setSeed(4242); fn(); const nx=T.rand(); const i=seq.indexOf(nx); T.setSeed(null); return i; }

/* ===== A. 회복 주 행동 ===== */
block("A 회복",()=>{
  board("pvp");
  const m=first(0,"minion"), e=first(1,"minion"), a=first(0,"ally"), b=first(0,"bomb"), t=first(0,"trap");
  H.place(T,m,10,4); H.place(T,e,3,4); H.place(T,a,12,4); H.place(T,b,12,2); H.place(T,t,13,3);
  m.hp=50; a.hp=80;
  ok(!T.canHeal(m)===false&&T.canHeal(m)&&T.canHeal(a),"A1 HP<최대 하수인·동료는 회복 지정 가능");
  ok(!T.canHeal(b)&&!T.canHeal(t),"A2 폭탄·함정은 회복 대상이 아니다");
  const full=first(0,"minion",1); H.place(T,full,11,1); ok(T.canHeal(full),"A3 #114 만피 말도 기다리기로 회복 지정 가능");
  ok(!T.canHeal(e),"A4 상대 말은 지정 불가 (자기 턴·자기 말만)");
  const used=randUsed(()=>{ T.applyAction({t:"heal",id:m.id}); });
  ok(m.healing===true&&S().mainUsed===true&&m.hp===50&&used===0,"A5 지정 → mainUsed·자세 시작·즉시 회복 없음·rand 소비 0 (hp "+m.hp+", rand "+used+")");
  ok(!T.canHeal(a),"A6 주 행동을 썼으므로 같은 턴 두 번째 지정 불가");
  ok(S().metrics.heals===1&&S().metrics.byPlayer[0].heals===1,"A7 지표 heals P1 귀속");
  const rt=randUsed(()=>T.endTurn());
  ok(m.hp===55&&S().metrics.healHp===5&&rt===0,"A8 지정한 플레이어의 턴 종료에 +round(100×5%)=5 (rand 0)");
  ok(S().current===1,"A8b 턴 교대");
  // 상대 턴: 상대도 회복 지정 → 양측 자세 말이 같은 경계에서 함께 틱
  e.hp=40; T.S.selected=e; T.applyAction({t:"heal",id:e.id});
  ok(e.healing&&S().mainUsed,"A9 상대(P2)도 회복 지정");
  T.endTurn();
  ok(m.hp===60&&e.hp===45,"A10 상대 턴 종료에 양 플레이어 자세 말 모두 +5 (m 60 · e 45) — 한 쌍 = 10%");
  // 같은 turn 이중 틱 가드: 같은 turnCount 에서 healTick 을 두 번 불러도 한 번만 · 그 turn 의 endTurn 도 다시 틱하지 않는다
  const hpBefore=m.hp; T.healTick(); T.healTick(); ok(m.hp===hpBefore+5,"A11 같은 turn 에 healTick 재호출 → 한 번만 (S.healTickTurn 가드)");
  T.S.mainUsed=true; T.endTurn(); ok(m.hp===hpBefore+5,"A11b 이미 틱한 turn 의 endTurn 은 다시 틱하지 않는다");
  // 만피: 자세 유지·회복량 0
  m.hp=98; const hh0=S().metrics.healHp; const e0=e.hp; T.S.mainUsed=true; T.endTurn(); ok(m.hp===100&&m.healing===true&&S().metrics.healHp===hh0+2+5,"A12 상한 maxHp (98→100, 회복량 2), 자세 유지");
  T.S.mainUsed=true; T.endTurn(); ok(m.hp===100&&m.healing===true&&S().metrics.healHp===hh0+2+5+5&&e.hp===e0+10,"A13 만피에서도 자세 유지, 추가 틱 회복량 0 (상대 말은 계속 +5)");
  T.S.mainUsed=true; T.endTurn();
  // 복수 자세: 다른 말도 다른 턴에 지정 가능
  ok(S().current===0,"A14 P1 턴");
  a.hp=80; T.S.selected=a; T.applyAction({t:"heal",id:a.id});
  ok(a.healing&&m.healing&&e.healing,"A15 여러 말이 동시에 자세 (각각 주 행동 1턴 소모)");
  m.hp=90; const e1=e.hp; T.endTurn(); ok(m.hp===95&&a.hp===85&&e.hp===e1+5,"A16 세 말 모두 같은 경계에서 틱 (m 95 · a 85 · e +5)");
  // 해제: 이동
  T.S.mainUsed=true; T.endTurn(); // P1 턴으로
  T.doMove(m,9,4); ok(m.healing===false&&S().mainUsed,"A17 이동 → 자세 해제");
  const hp17=m.hp; T.endTurn(); ok(m.hp===hp17,"A18 해제된 말은 그 턴 틱 없음 (해제가 틱보다 먼저)");
  // 해제: 탐색
  T.S.mainUsed=true; T.endTurn(); T.S.selected=null;
  a.healing=true; T.S.events=[{r:12,c:4,kind:"buff",consumed:false}]; T.S.traces[0].add("12_4");
  T.doSearch(a,T.S.events[0]); T.drain(); ok(a.healing===false,"A19 탐색 → 자세 해제");
  // 해제: 텔레포트 (자기 말이 상대 진영에 있어야 가능)
  T.S.mainUsed=false; const inv=first(0,"minion",2); H.place(T,inv,2,2); a.healing=true; m.healing=true;
  ok(T.teleportAvailable(0),"A20 전제: 텔레포트 가능");
  T.doTeleportSwap(a,m); ok(a.healing===false&&m.healing===false,"A21 텔레포트 교환 → 두 말 모두 해제");
  // 해제: 전투 참여 (공격·방어) — 방어자 자세도 해제
  T.S.mainUsed=false; T.S.battlesUsed=0; T.S.forcedTargets=[];
  const m2=first(0,"minion",3), e2=first(1,"minion",1); H.place(T,m2,7,6); H.place(T,e2,6,6); m2.healing=true; e2.healing=true;
  T.startRounds(m2,e2,m2,e2); T.drain();
  ok(m2.healing===false&&e2.healing===false,"A22 전투 개시 → 공격자·방어자 자세 해제"); // initBattle 경로는 B 절에서 폭탄·함정으로 확인
  T.S.battle=null; T.TQ.length=0; T.close();
  // 해제: 폭탄·함정 접촉(공격 측)·밀어내기·도망 교환
  const m3=first(0,"minion",4), eb=first(1,"bomb"); H.place(T,m3,8,1); H.place(T,eb,7,1); m3.healing=true; T.S.battlesUsed=0;
  T.initBattle(m3,eb); ok(m3.healing===false&&!m3.alive,"A23 폭탄 접촉 → 자세 해제(및 제거)");
  const a2=first(0,"ally",1), et=first(1,"trap"); H.place(T,a2,8,3); H.place(T,et,7,3); a2.healing=true; T.S.battlesUsed=0; T.S.forcedTargets=[];
  T.initBattle(a2,et); ok(a2.healing===false&&a2.immobile===2,"A24 함정 접촉 → 자세 해제");
  const k0=king(0), a3=first(1,"ally"); H.place(T,k0,8,5); H.place(T,a3,7,5); k0.healing=true; a3.healing=true; T.S.battlesUsed=0; T.S.mode="sim";
  T.doPush(k0,a3); T.S.mode="pvp"; ok(k0.healing===false&&a3.healing===false,"A25 밀어내기 → 양측 해제");
  const f1=first(0,"minion",5), f2=first(0,"minion",1); f1.healing=true; f2.healing=true; T.fleeSwap(f1,f2); ok(!f1.healing&&!f2.healing,"A26 도망 후 후방 교환 → 두 말 해제");
  // 함정 이동 금지 중 지정 가능
  T.S.mainUsed=false; T.S.forcedTargets=[]; T.S.battle=null; a2.hp=70; a2.immobile=2; T.S.current=0; T.S.selected=a2;
  ok(T.canHeal(a2),"A27 이동 불가(immobile) 중에도 회복 지정 가능");
  // 사망 시 자세 소멸 (틱 대상 아님)
  const d=first(0,"minion",1); d.healing=true; d.hp=50; d.alive=false; T.S.mainUsed=true; T.endTurn(); ok(d.hp===50,"A28 제거된 말은 틱하지 않는다");
  // 예비 하수인은 대상 아님 (보드 말만)
  T.S.reserve[0]={element:"fire",hp:70,maxHp:100,atk:20,skillAtk:30,cd:0,cdMax:2,skills:["fire_stable","fire_effect","sup_heal","sig_std"],cds:[0,0,0,0],revealedSkills:[]};
  T.S.mainUsed=true; T.S.current=0; T.endTurn(); T.S.mainUsed=true; T.endTurn(); ok(T.S.reserve[0].hp===70,"A29 예비 하수인 HP 는 틱 대상이 아니다");
});

/* A' 회복 표시·비노출 (H8) */
block("A' 회복 표시",()=>{
  board("pve");
  const m=first(0,"minion"), e=first(1,"minion"); H.place(T,m,10,4); H.place(T,e,4,4); m.hp=50; e.hp=50;
  m.healing=true; e.healing=true; T.S.tempReveal.add(e.id); // e 는 숲(4행)이지만 일시 공개로 칩이 그려짐 — 정체(revealed)는 비공개
  T.render();
  const cells=T.els.board.children;
  const chipAt=(r,c)=>{ const cell=cells.find(x=>String(x.dataset.r)===String(r)&&String(x.dataset.c)===String(c)); return cell&&cell.children.find(k=>/\bpc\b/.test(k.className)); };
  ok(/\bhealing\b/.test(chipAt(10,4).className),"A'1 소유자(뷰어 0) 화면: 자기 회복 말에 healing 효과");
  ok(chipAt(4,4)&&!/\bhealing\b/.test(chipAt(4,4).className),"A'2 미공개 상대 말의 회복 자세는 표시하지 않는다 (칩은 있으나 효과 없음)");
  e.revealed=true; T.render(); ok(/\bhealing\b/.test(chipAt(4,4).className),"A'3 공개(revealed)된 상대 말은 회복 효과 표시");
  // 로그: 미공개 상대(AI) 말의 지정은 중립 문구, 공개 말은 이름 포함
  e.revealed=false; e.healing=false; T.S.current=1; T.S.mainUsed=false; T.S.selected=null; const n0=T.S.log.length;
  T.doHeal(e); const l1=T.S.log.slice(n0).map(x=>x.msg).join("|");
  ok(/상대가 말 회복 행동을 했습니다/.test(l1)&&!/회복 자세 시작/.test(l1),"A'4 미공개 상대 말 회복 지정 로그는 대상·위치 비공개 중립 문구");
  e.healing=false; e.revealed=true; T.S.mainUsed=false; const n1=T.S.log.length; T.doHeal(e); const l2=T.S.log.slice(n1).map(x=>x.msg).join("|");
  ok(/회복 자세 시작/.test(l2),"A'5 공개 말의 회복 지정은 이름 포함 로그");
  // 사이드 패널 상태 표기
  T.S.current=0; T.S.selected=m; T.renderSide(); ok(/회복 자세/.test(T.els.sidePanel.innerHTML),"A'6 선택 말 상태에 '회복 자세' 표기");
  // 턴바 버튼 상태
  T.S.mainUsed=false; T.renderTurnBar(); let hb=T.els.turnBar.children.find(x=>/회복/.test(x.textContent));
  ok(hb&&hb.disabled===true,"A'7 이미 자세인 말 선택 시 회복 버튼 비활성 (재지정 없음)");
  m.healing=false; T.renderTurnBar(); hb=T.els.turnBar.children.find(x=>/회복/.test(x.textContent)); ok(hb&&hb.disabled===false,"A'8 HP<최대·자세 아님 → 회복 버튼 활성");
  m.hp=100; T.renderTurnBar(); hb=T.els.turnBar.children.find(x=>/회복/.test(x.textContent)); ok(hb&&hb.disabled===false,"A'9 #114 만피 → 회복 버튼 활성");
  // AI 공정 관측 (정적): AI 함수 본문에서 healing 을 읽는 곳은 자기 말 후보(aiHealPick·canHeal)뿐
  const src=T.html, ai=src.slice(src.indexOf("/* ===== AI (공정 관측"),src.indexOf("/* ===== 모달·핸드오프"));
  const refs=(ai.match(/\.healing/g)||[]).length;
  ok(refs===0&&/canHeal\(x\)/.test(ai),"A'10 AI 본문은 .healing 을 직접 읽지 않고 자기 말 canHeal 만 쓴다 (상대 미공개 회복 미참조 · 참조 수 "+refs+")");
  // AI 회복 정책: 인접 적 없고 HP<60% 자기 말 → 후보. 상대 말은 후보 아님
  board("pve"); const am=first(1,"minion"); H.place(T,am,3,4); am.hp=30; T.S.current=1; T.S.mainUsed=false;
  const pick=T.aiHealPick(1); ok(pick&&pick.p===am,"A'11 5급 회복 후보: HP 30% 자기 하수인");
  const em=first(0,"minion"); H.place(T,em,4,4); em.hp=10; ok(T.aiHealPick(1)===null,"A'12 가시 인접 적이 있으면 그 말은 후보에서 제외 (상대 HP 는 판단에 쓰지 않음)");
});

/* ===== B. 폭탄 직접 접촉 ===== */
block("B 폭탄 접촉",()=>{
  // B1 폭탄 → 하수인: 둘 다 제거, 전투 1회, 강제 이행, 지표
  board("pvp"); let b=first(0,"bomb"), e=first(1,"minion"); H.place(T,b,8,4); H.place(T,e,6,4);
  ok(T.canMoveTo(b,7,4)&&T.contactEligible(b,e),"B1a 폭탄 이동 가능·접촉 적격");
  T.doMove(b,7,4);
  ok(!b.alive&&!e.alive&&S().battlesUsed===1&&S().metrics.bombContacts===1&&S().metrics.byPlayer[0].bombContacts===1&&S().metrics.forcedBattles===1&&S().metrics.bombHitsMinion===1&&S().metrics.byPlayer[0].bombHitsMinion===1&&S().forcedTargets.length===0,
    "B1 폭탄→하수인: 폭탄·하수인 모두 제거 · battlesUsed 1 · bombContacts/forcedBattles/bombHitsMinion(폭탄 소유자) 1");
  ok(/폭탄 접촉 발동/.test(T.S.log.map(l=>l.msg).join("|")),"B1b 로그 '폭탄 접촉 발동'");
  ok(T.FX.log.some(x=>/접촉/.test(x.title))&&T.FX.log.some(x=>x.sub==="폭탄이 터져 상대 하수인과 함께 제거됩니다.")&&T.FX.log.some(x=>x.key==="explosion"),"B1c 접촉 배너 → 상황 4 문구 → 폭발 항목이 기록됨 (헤드리스 0ms)");
  // B2 폭탄 → 동료/왕: 폭탄만 제거, 상대 생존·비공개
  board("pvp"); b=first(0,"bomb"); const ea=first(1,"ally"); H.place(T,b,8,4); H.place(T,ea,6,4); T.doMove(b,7,4);
  ok(!b.alive&&ea.alive&&!ea.revealed&&S().battlesUsed===1&&S().metrics.bombClearedByVip===1&&S().metrics.byPlayer[0].bombClearedByVip===1,"B2 폭탄→동료: 폭탄만 제거·동료 생존·정체 비공개·bombClearedByVip(폭탄 소유자)");
  board("pvp"); b=first(0,"bomb"); const ek=king(1); H.place(T,b,3,6); H.place(T,ek,1,7); T.doMove(b,2,6); H.place(T,ek,1,6); // 왕 옆으로
  board("pvp"); b=first(0,"bomb"); H.place(T,b,3,7); T.doMove(b,2,7);
  ok(!b.alive&&king(1).alive&&!king(1).revealed&&S().battlesUsed===1,"B2b 폭탄→왕: 폭탄만 제거·왕 생존·비공개");
  // B3 폭탄 → 폭탄/함정: 아무 일 없음, 전투 1회 소모, 재선택 없음
  board("pvp"); b=first(0,"bomb"); const eb=first(1,"bomb"); H.place(T,b,8,4); H.place(T,eb,6,4); T.doMove(b,7,4);
  ok(b.alive&&eb.alive&&!b.revealed&&!eb.revealed&&S().battlesUsed===1&&S().forcedTargets.length===0&&S().metrics.bombContacts===1,"B3 폭탄→폭탄: 양쪽 유지·비공개·전투 1회 소모·강제 대상 해소");
  ok(T.FX.log.some(x=>x.sub==="아무 일도 일어나지 않습니다. 말을 한칸씩 밀어냅니다."),"B3b #114 상황 6 밀기 문구");
  board("pvp"); b=first(0,"bomb"); const et=first(1,"trap"); H.place(T,b,8,4); H.place(T,et,6,4); T.doMove(b,7,4);
  ok(b.alive&&et.alive&&!et.revealed&&S().battlesUsed===1,"B3c 폭탄→함정: 아무 일 없음 (함정 수동 유지·비공개)");
  // B4 복수 대상: 소유자가 하나 선택 → 상황 6(함정) 고르면 아무 일 없고 다른 대상(하수인) 재선택 불가
  board("pvp"); b=first(0,"bomb"); const e4=first(1,"minion"), t4=first(1,"trap"); H.place(T,b,8,4); H.place(T,e4,6,4); H.place(T,t4,7,5); T.doMove(b,7,4);
  ok(S().forcedTargets.length===2&&b.alive&&e4.alive&&!S().battle,"B4a 새로 인접한 대상 2개 → 선택 대기 (즉시 발동 없음)");
  ok(T.forcedPickOk(e4)&&T.forcedPickOk(t4)&&!T.canBattle(b,e4),"B4b 강제 선택은 forcedPickOk 로 가능하지만 canBattle(폭탄 능동)은 여전히 불가");
  T.onCellCore?null:null; T.applyAction({t:"cell",r:7,c:5}); // 함정 클릭
  ok(S().forcedTargets.length===0&&b.alive&&t4.alive&&e4.alive&&S().battlesUsed===1,"B4c 함정 선택 → 아무 일 없음 · 강제 대상 해소 · 전투 1회 소모");
  T.S.selected=b; T.applyAction({t:"cell",r:6,c:4});
  ok(e4.alive&&b.alive&&S().battlesUsed===1,"B4d 같은 턴에 하수인을 다시 골라도 발동하지 않는다 (재선택 없음)");
  // B5 턴 시작부터 인접했던 상대와는 발동하지 않음 (다른 말 이동)
  board("pvp"); b=first(0,"bomb"); const e5=first(1,"minion"); H.place(T,b,7,4); H.place(T,e5,6,4); const m5=first(0,"minion"); H.place(T,m5,10,1); T.doMove(m5,9,1);
  ok(b.alive&&e5.alive&&S().battlesUsed===0,"B5 기존 인접 폭탄은 발동하지 않는다");
  // B6 능동 클릭으로 폭탄 공격 불가
  T.S.mainUsed=false; T.S.selected=b; T.applyAction({t:"cell",r:6,c:4});
  ok(b.alive&&e5.alive&&S().battlesUsed===0&&!S().battle,"B6 폭탄 선택 후 인접 적 클릭 → 전투 없음 (능동 불가)");
  // B7 BT 2칸 이동으로 새로 인접
  board("pvp"); T.S.turnCount=64; b=first(0,"bomb"); const e7=first(1,"minion"); H.place(T,b,10,4); H.place(T,e7,7,4);
  ok(T.isBurning()&&T.canMoveTo(b,8,4),"B7a BT 2칸 이동 가능");
  T.doMove(b,8,4); ok(!b.alive&&!e7.alive&&S().metrics.bombContacts===1,"B7 BT 2칸 이동 도착으로 새로 인접 → 발동");
  // B8 숲 충돌 정지 후 새로 인접 (경유 칸에 숨은 적)
  board("pvp"); T.S.turnCount=64; b=first(0,"bomb"); const hid=first(1,"minion"); H.place(T,b,11,3); H.place(T,hid,9,3); // 9행 숲, 비인접이라 숨음
  ok(!T.visibleTo(0,hid)&&T.canMoveTo(b,9,3),"B8a 숨은 적 칸으로 2칸 이동 시도 가능");
  T.doMove(b,9,3);
  ok(b.r===10&&!b.alive&&!hid.alive&&S().metrics.bombContacts===1,"B8 숲 충돌 정지(10,3) → 폭탄이 숨은 하수인과 새로 인접 → 발동 (둘 다 제거)");
  // B9 텔레포트로 도착한 폭탄도 queue 항목 · 사전 차단 계산 포함
  board("pvp"); b=first(0,"bomb"); const inv=first(0,"minion"); const e9=first(1,"minion"), e9b=first(1,"minion",1); H.place(T,inv,2,3); H.place(T,b,12,3); H.place(T,e9,3,3); H.place(T,e9b,11,3);
  ok(T.teleportAvailable(0),"B9a 전제: 텔레포트 가능");
  ok(T.forcedEligible(b,e9)&&T.newAdjAt(b,2,3,new Set()).includes(e9.id),"B9b 폭탄도 강제 적격·newAdjAt 에 포함");
  T.S.battlesUsed=1; ok(/2회 >/.test(T.teleportSwapBlock(inv,b)||"")||/새 강제 전투 2회/.test(T.teleportSwapBlock(inv,b)||""),"B9c 남은 전투 1회 < 필요 2회(하수인 접촉 + 폭탄 접촉) → 사전 차단 ("+T.teleportSwapBlock(inv,b)+")");
  T.S.battlesUsed=0; T.doTeleportSwap(inv,b); T.drain();
  ok(S().metrics.teleports===1&&(S().battle||S().forcedTargets.length||S().forcedQueue.length||S().metrics.bombContacts===1),"B9d 스왑 실행 — 첫 강제 전투 승격");
  // 첫 항목이 하수인(inv↔e9b 인접) 전투면 종료 후 둘째 폭탄 접촉이 queue 에서 승격되어야 한다
  /* #146: 4슬롯 전투원에게 폴백 기본 공격은 더 이상 없다. 전투를 굴리려면 **합법 슬롯**을 골라야 하고,
     합법 슬롯이 하나도 없으면 수동 [턴 종료](__pass)로 자기 전투 행동을 넘긴다 — 사람 UI 와 같은 경로다. */
  const drive=()=>{ const B=S().battle, sd=T.actorOfPhase(), f=sd==="A"?B.fa:B.fd;
    if(!f.skills){ global.__act("basic"); return; }
    for(let i=0;i<4;i++) if(T.slotUsable(f,i,sd)){ global.__act(i); return; }
    global.__pass(); };
  let guard=0; while(S().battle&&guard++<60){ drive(); T.drain(); }
  T.drainForcedQueue(false); if(S().forcedTargets.length&&S().movedPiece&&S().movedPiece.type==="bomb"){ const tgt=T.S.pieces.find(x=>x.id===S().forcedTargets[0]); T.applyAction({t:"cell",r:tgt.r,c:tgt.c}); }
  ok(S().metrics.bombContacts===1&&!b.alive&&!e9.alive,"B9 텔레포트 도착 폭탄의 접촉이 queue 경로로 발동 (bombContacts 1 · 폭탄·하수인 제거)");
  // B10 대칭: 상대 폭탄 → 내 말 (P2 턴)
  board("pvp"); T.S.current=1; const ob=first(1,"bomb"), mm=first(0,"minion"); H.place(T,ob,6,4); H.place(T,mm,8,4); T.doMove(ob,7,4);
  ok(!ob.alive&&!mm.alive&&S().metrics.byPlayer[1].bombContacts===1&&S().metrics.byPlayer[1].bombHitsMinion===1,"B10 상대 폭탄 → 내 말: 대칭 (P2 귀속)");
  // B11 수동 폭탄(내 하수인이 상대 폭탄을 대상 선택)은 종전과 동일
  board("pvp"); const mb=first(0,"minion"), pb=first(1,"bomb"); H.place(T,mb,8,4); H.place(T,pb,7,4); T.S.selected=mb;
  ok(T.visibleTo(0,pb)&&!pb.revealed&&T.canBattle(mb,pb),"B11a 전제: 상대 폭탄이 인접·가시(7행 비숲)·미공개, 내 하수인이 능동 공격 가능"); T.applyAction({t:"cell",r:7,c:4});
  ok(!mb.alive&&!pb.alive&&S().metrics.bombHitsMinion===1&&S().metrics.byPlayer[1].bombHitsMinion===1&&S().metrics.bombContacts===0,"B11 수동 폭탄 발동은 현행 그대로 (bombContacts 미증가·폭탄 소유자 지표)");
  // B12 AI 이행: AI 폭탄의 강제 대상은 aiStep 이 forcedPickOk 로 처리
  board("pve"); T.S.current=1; T.S.mainUsed=true; const aib=first(1,"bomb"), hm=first(0,"minion"); H.place(T,aib,7,4); H.place(T,hm,8,4);
  T.S.movedPiece=aib; T.S.forcedTargets=[hm.id]; T.aiStep();
  ok(!aib.alive&&!hm.alive&&S().metrics.byPlayer[1].bombContacts===1,"B12 AI 턴: 폭탄 강제 대상 이행 (forcedPickOk)");
});

/* ===== C. 함정 공개 ===== */
block("C 함정",()=>{
  board("pvp"); const m=first(0,"minion"), t=first(1,"trap"), other=first(1,"minion",1), ob=first(1,"bomb"); H.place(T,m,8,4); H.place(T,t,7,4); H.place(T,other,7,6); H.place(T,ob,6,4);
  const rev=T.S.pieces.filter(x=>x.revealed).length;
  T.S.selected=m; T.S.tempReveal.add(t.id); T.applyAction({t:"cell",r:7,c:4});
  ok(!t.alive&&t.revealed&&m.revealed&&m.immobile===2&&S().battlesUsed===1&&S().metrics.trapTriggers===1&&S().metrics.byPlayer[1].trapTriggers===1,"C1 함정 발동: 함정·걸린 말 revealed · immobile 2 · 전투 1회 · trapTriggers(함정 소유자)");
  ok(T.S.pieces.filter(x=>x.revealed).length===rev+2&&!other.revealed&&!ob.revealed,"C2 공개 대상은 그 둘뿐 (다른 말 revealed 불변)");
  ok(T.S.log.some(l=>/함정 발동.*정체 공개/.test(l.msg))&&!T.S.log.some(l=>/정체 비공개 유지/.test(l.msg)&&/함정/.test(l.msg)),"C3 로그 '정체 공개' · 구 문구 '정체 비공개 유지' 없음");
  ok(T.FX.log.some(x=>x.sub==="함정에 걸려 내 하수인의 이동이 2턴간 제한됩니다.")&&T.FX.log.some(x=>x.key==="trapFx"),"C4 상황 3 문구 + 함정 연출 항목");
  ok(T.contactText(m,t,false)==="상대 하수인이 내 함정에 걸렸습니다! (정체 공개 · 2턴 이동 불가)","C5 거울 문구");
  // 종료 리빌 정합: 함정은 제거되어 있고 걸린 말은 공개 상태로 남는다
  T.S.phase="over"; T.render(); T.S.phase="play";
  ok(m.revealed&&!t.alive,"C6 종료 리빌 정합 (공개 상태 유지·함정 제거)");
  // 폭탄 생존 VIP 는 여전히 비공개 (공개 대상 비확대)
  board("pvp"); const a=first(0,"ally"), b=first(1,"bomb"); H.place(T,a,8,4); H.place(T,b,7,4); T.S.selected=a; T.S.tempReveal.add(b.id); T.applyAction({t:"cell",r:7,c:4});
  ok(!b.alive&&a.alive&&!a.revealed,"C7 폭탄 발동으로 생존한 동료는 비공개 유지 (확대 금지)");
});

/* ===== D. HP 비율 판정 ===== */
block("D 판정",()=>{
  const setup=()=>{ board("pvp"); const m1=first(0,"minion"), m2=first(1,"minion"); H.place(T,m1,7,4); H.place(T,m2,6,4); T.S.selected=null; T.startRounds(m1,m2,m1,m2); T.drain(); return [m1,m2]; };
  let [a,d]=setup(); a.hp=65; d.hp=40; T.S.battle.recA=5; T.S.battle.recD=90; T.judge(); T.drain();
  ok(a.alive&&!d.alive&&S().metrics.judged===1&&S().metrics.attackerWins===1,"D1 판정: A 65% > D 40% → 공격자 승 (누적 유효 피해 recD 90 > recA 5 여도 무관)");
  ok(T.S.log.some(l=>/판정 65% vs 40%/.test(l.msg)),"D1b 로그에 비율 표기");
  [a,d]=setup(); a.hp=50; d.hp=50; T.judge(); T.drain();
  ok(!a.alive&&d.alive&&S().metrics.ties===1&&S().metrics.defenderWins===1,"D2 동률 → 방어자 승");
  [a,d]=setup(); a.hp=50; d.hp=50; a.shield=40; T.judge(); T.drain();
  ok(!a.alive&&d.alive&&S().metrics.ties===1,"D3 방어막은 HP 가 아니므로 판정에 미포함 (보호막 40 이어도 동률)");
  [a,d]=setup(); a.maxHp=120; a.hp=60; d.maxHp=100; d.hp=55; T.judge(); T.drain();
  ok(!a.alive&&d.alive,"D4 비율 비교 (A 60/120=50% < D 55/100=55% → 방어자 승, 절대값 60>55 여도)");
  // D5 예비 하수인 70/100 트레이드오프: 대리 출전 cap(70/100) vs 100/100 본체 — 피해 없이 6R 끝나면 처음부터 30% 불리
  board("pvp"); const al=first(0,"ally"), m2=first(1,"minion"); H.place(T,al,7,4); H.place(T,m2,6,4);
  al.cap={element:"fire",hp:70,maxHp:100,atk:20,skillAtk:30,cd:0,cdMax:2,skills:["fire_stable","fire_effect","sup_heal","sig_std"],cds:[0,0,0,0],revealedSkills:[]};
  T.startRounds(al,m2,al.cap,m2); T.drain(); T.judge(); T.drain();
  ok(!al.alive&&m2.alive&&S().metrics.defenderWins===1,"D5 예비 하수인(70/100) 대리 출전은 무피해 판정에서 70% < 100% 로 패배 — 알려진 트레이드오프(보정 없음)");
  // D6 recA/recD 지표는 계속 기록 (execSlot 경로)
  [a,d]=setup(); T.execSlot("A",0); T.drain(); ok(S().battle&&S().battle.recA>0,"D6 recA 지표 기록 유지 (판정에는 미사용)");
  // D7 6라운드 자연 종료 → judge 경유 배너 메시지 (blog)
  T.S.battle.round=6; T.S.battle.phase=1; T.execSlot("D",0); T.drain(); // #146: 4슬롯 전투원의 순수 기본 공격(-1)은 철회 — 합법 슬롯으로 12번째 행동을 낸다
  ok(!S().battle&&S().metrics.judged===1&&T.S.log.some(l=>/판정|동률/.test(l.msg)),"D7 12번째 행동 뒤 판정 경로 (judged 1)");
  T.TQ.length=0; T.close();
});

/* ===== E. 자동 턴 종료 ===== */
block("E 자동 종료",()=>{
  T.BAL.fx.autoEnd=true;
  const prep=()=>{ board("pvp"); T.TQ.length=0; T.FX.auto=null; };
  prep(); const m=first(0,"minion"); H.place(T,m,10,4);
  T.S.mainUsed=true; T.render();
  ok(T.autoEndReady()==="end"&&T.FX.auto&&T.TQ.length>=1,"E1 주 행동 완료·선택 전투 없음 → 자동 종료 예약");
  const t0=S().turnCount; T.drain(); ok(S().turnCount===t0+1&&S().current===1&&S().metrics.autoEnds===1&&S().metrics.byPlayer[0].autoEnds===1,"E2 예약 발화 → endTurn (autoEnds 지표)");
  // 보류: 선택 전투 가능
  prep(); const m2=first(0,"minion"), e2=first(1,"minion"); H.place(T,m2,7,4); H.place(T,e2,6,4); T.S.mainUsed=true; T.render();
  ok(T.autoEndReady()===null&&!T.FX.auto,"E3 canBattle 가능한 가시 인접 적이 있으면 자동 종료 없음 (버튼으로만)");
  // 보류: 강제 대상
  prep(); const m3=first(0,"minion"), e3=first(1,"minion"); H.place(T,m3,8,4); H.place(T,e3,6,4); T.S.mode="pve"; T.S.current=1; T.S.mode="pvp"; T.S.current=0;
  T.S.mainUsed=true; T.S.movedPiece=m3; T.S.forcedTargets=[e3.id]; T.render(); ok(T.autoEndReady()===null,"E4 강제 대상 남음 → 보류");
  T.S.forcedTargets=[]; T.S.forcedQueue=[{pid:m3.id,targets:[e3.id]}]; T.render(); ok(T.autoEndReady()===null,"E5 forcedQueue 남음 → 보류"); T.S.forcedQueue=[];
  T.S.teleport={stage:1,piece:null}; T.render(); ok(T.autoEndReady()===null,"E6 텔레포트 선택 중 → 보류"); T.S.teleport=null;
  T.modal("<h2>x</h2>",[["확인",T.close]]); T.render(); ok(T.autoEndReady()===null,"E7 모달 열림 → 보류"); T.close();
  T.S.battle={}; ok(T.autoEndReady()===null,"E8 전투 중 → 보류"); T.S.battle=null;
  // AI 턴은 절대 발화하지 않음
  prep(); T.S.mode="pve"; T.S.current=1; T.S.mainUsed=true; T.TQ.length=0; T.FX.auto=null; T.render(); ok(T.autoEndReady()===null&&!T.FX.auto,"E9 AI 턴 → 자동 종료 예약 없음"); T.S.mode="pvp"; T.S.current=0;
  // 입력이 있으면 재평가 (예약 후 상태 변화)
  prep(); const m4=first(0,"minion"); H.place(T,m4,10,4); T.S.mainUsed=true; T.render(); ok(!!T.FX.auto,"E10a 예약");
  T.FX.inputSeq++; const e4=first(1,"minion"); H.place(T,e4,9,4); // 그 사이 상황 변화(가시 인접 적 등장) + 입력
  const t4=S().turnCount; T.drain(); ok(S().turnCount===t4,"E10 발화 시점 재평가 — 선택 전투가 생겼으면 종료하지 않는다");
  // 주 행동 전 특례: 가능한 주 행동이 없으면 생략 자동 적용 후 종료
  prep(); for(const x of T.alivePieces()) if(x.owner===0){ x.immobile=2; x.healing=true; } T.S.mainUsed=false; T.render(); // #114 만피도 회복 가능하므로 이미 자세인 말로 모든 주 행동 없음 구성
  ok(T.autoEndReady()==="skip"&&!T.anyMainActionLeft(),"E11 이동·탐색·텔레포트·회복 전부 불가 → 생략 특례 예약");
  const t5=S().turnCount; T.drain(); ok(S().mainUsed===true||S().turnCount===t5+1,"E12 생략 자동 적용 → 재평가 → 종료 (turn "+t5+"→"+S().turnCount+")");
  ok(S().turnCount===t5+1,"E12b 생략 뒤 자동 종료까지 이어짐");
  // 회복 대상이 있으면 주 행동이 남은 것 (특례 아님)
  prep(); for(const x of T.alivePieces()) if(x.owner===0) x.immobile=2; king(0).hp=50; T.S.mainUsed=false; T.render();
  ok(T.autoEndReady()===null&&T.anyMainActionLeft(),"E13 회복 지정 가능한 말이 있으면 주 행동 잔여 → 자동 없음");
  // 잠금 중에는 예약하지 않는다
  prep(); const m6=first(0,"minion"); H.place(T,m6,10,4); T.S.mainUsed=true; T.FX.force=true; T.fxPlay({key:"turnBanner",title:"x"}); T.render();
  ok(T.fxLocked()&&T.autoEndReady()===null,"E14 연출 잠금 중 → 보류"); T.fxReleaseAll(); T.FX.force=false; T.TQ.length=0;
  // 헤드리스 기본(하네스)은 꺼져 있고, 스위치로 켰을 때만 동작
  T.BAL.fx.autoEnd=false; prep(); const m7=first(0,"minion"); H.place(T,m7,10,4); T.S.mainUsed=true; T.render(); ok(T.autoEndReady()===null&&!T.FX.auto,"E15 BAL.fx.autoEnd=false 면 예약 없음 (기존 회귀 호환)");
  T.BAL.fx.autoEnd=true;
});

/* ===== F. 버닝 타임 배너 ===== */
block("F BT 배너",()=>{
  board("pvp"); T.S.mode="pve"; // 배너는 sim 이 아니면 기록된다 (헤드리스 0ms)
  T.S.turnCount=63; T.S.mainUsed=true; T.FX.log.length=0; T.endTurn(); // → turnCount 64 = 표시 턴 65
  const keys=T.FX.log.map(x=>x.title);
  ok(S().metrics.btReached&&S().metrics.btEnterTurn===65,"F1 65턴 진입 지표 (기존)");
  ok(keys[0]==="버닝타임입니다! 2칸씩 이동 가능합니다"&&/턴!/.test(keys[1]||""),"F2 배너 순서: 버닝 타임 → 턴 배너 ("+keys.join(" → ")+")");
  T.FX.log.length=0; T.S.mainUsed=true; T.endTurn();
  ok(!T.FX.log.some(x=>/버닝타임/.test(x.title))&&T.FX.log.some(x=>/턴!/.test(x.title)),"F3 66턴 이후 재표시 없음 (턴 배너만)");
  { const mv=first(0,"minion",2); H.place(T,mv,11,4); T.S.current=0; T.S.mainUsed=false; // BT 규칙 불변(배너는 표시 전용): 직선 2칸 가능·꺾기 불가·원정 구역(적 숲) 진입은 1칸
    ok(T.isBurning()&&T.canMoveTo(mv,9,4)&&!T.canMoveTo(mv,10,5),"F4a BT 2칸 직선 이동 가능·꺾기(대각 2칸) 불가");
    const inv=first(0,"minion",3); H.place(T,inv,6,4); ok(!T.canMoveTo(inv,4,4)&&T.canMoveTo(inv,5,4),"F4b 원정 구역(적 숲) 진입은 1칸만 — 2칸 불가"); }
  const trap=first(0,"trap"); H.place(T,trap,12,3); ok(!T.canMoveTo(trap,11,3),"F4b 함정 고정 불변");
  // 새 게임 → 예약 초기화
  T.S.btBannerDue=true; H.freshPlay(T,"pve"); ok(T.S.btBannerDue===false&&T.FX.log.length===0,"F5 새 게임에서 배너 예약·로그 초기화");
  // sim 은 배너 없음
  T.S.mode="sim"; T.S.turnCount=63; T.S.mainUsed=true; T.S.phase="play"; T.FX.log.length=0; T.endTurn(); ok(T.FX.log.length===0,"F6 sim 모드 배너 없음");
});

/* ===== G. 연출 큐·잠금 (FX.force + 가짜 타이머 — 순서·차단·워치독·토큰) ===== */
block("G 연출 큐",()=>{
  board("pvp"); T.FX.force=true; T.TQ.length=0; T.fxReleaseAll();
  const m=first(0,"minion"); H.place(T,m,10,4);
  T.turnBannerFx();
  ok(T.fxLocked()&&T.FX.cur&&T.FX.cur.title==="나의 턴!"&&T.TQ.length===2,"G1 턴 배너 재생 중 잠금 (타이머 2개 = 본 타이머 + 워치독)");
  ok(T.els.fxBanner._cls.has("hidden")===false&&T.els.fxTitle.textContent==="나의 턴!"&&T.document.body._cls.has("fx-lock"),"G2 배너 DOM·body.fx-lock");
  T.applyAction({t:"cell",r:10,c:4}); // applyAction 은 가드 없음(수신 재생 경로) — 사람 입력은 onCell/netAction 경유
  T.S.selected=null; T.onCell(10,4); ok(T.S.selected===null,"G3 잠금 중 onCell(사람 클릭) 무시");
  T.netAction({t:"skipMain"}); ok(S().mainUsed===false,"G4 잠금 중 netAction(턴바) 무시");
  T.netAction({t:"resign"}); ok(S().phase==="over","G5 잠금 중에도 기권은 허용");
  /* #126 (v0.4.7): 기권도 **경기 종료 연출을 한 번** 낸다. gameOver 가 남아 있던 표시 큐를 먼저 걷으므로
     결과 배너 하나만 현재 항목으로 남는다 (전투 결과 + 경기 결과 직렬 중복 금지 계약의 다른 쪽 끝).
     이 절이 고정하는 것은 턴 배너의 타이머·잠금·워치독 계약이므로, 새 계약을 확인한 뒤 같은 전제를 다시 세워 이어 간다. */
  ok(T.FX.cur&&T.FX.cur.key==="resultBanner"&&T.FX.q.length===0,"G5b 기권 → 경기 종료 연출 1회만 남는다 (#126)");
  T.S.phase="play"; T.S.winner=null; T.fxReleaseAll(); T.TQ.length=0; T.turnBannerFx();
  T.TQ.shift()(); // 본 타이머
  ok(!T.fxLocked()&&T.els.fxBanner._cls.has("hidden")&&!T.document.body._cls.has("fx-lock"),"G6 시간 경과 → 잠금 해제·배너 숨김·클래스 제거");
  T.TQ.shift()(); ok(!T.fxLocked()&&T.FX.cur===null,"G7 워치독 타이머는 이미 끝난 항목을 건드리지 않는다");
  T.onCell(10,4); ok(T.S.selected===m,"G8 잠금 해제 후 클릭 정상");
  // 워치독: 본 타이머가 오지 않아도(건너뜀) 워치독이 푼다
  T.TQ.length=0; T.fxPlay({key:"turnBanner",title:"w"}); const main=T.TQ.shift(); const wd=T.TQ.shift(); wd(); ok(!T.fxLocked(),"G9 워치독만으로 해제"); main(); ok(!T.fxLocked()&&T.FX.cur===null,"G10 뒤늦은 본 타이머는 무효");
  // onEnd 예외가 큐를 막지 못한다
  T.TQ.length=0; T.fxPlay({key:"turnBanner",title:"a",onEnd:()=>{ throw new Error("boom"); }}); T.fxPlay({key:"turnBanner",title:"b"});
  T.TQ.shift()(); ok(T.FX.cur&&T.FX.cur.title==="b","G11 onEnd 예외 뒤에도 다음 항목으로 진행"); T.TQ.length=0; T.fxReleaseAll();
  // 오래된 타이머: 배너 중 새 게임 → 옛 타이머가 새 게임 DOM·S 를 건드리지 않음
  T.fxPlay({key:"turnBanner",title:"old"}); const oldT=T.TQ.splice(0);
  H.freshPlay(T,"pvp"); T.FX.force=true; ok(!T.fxLocked(),"G12 새 게임(newGame→fxReleaseAll)에서 즉시 해제");
  T.fxPlay({key:"turnBanner",title:"new"}); for(const fn of oldT) fn();
  ok(T.FX.cur&&T.FX.cur.title==="new","G13 이전 게임의 타이머는 새 게임 항목을 끝내지 못한다 (세대 토큰)"); T.TQ.length=0; T.fxReleaseAll();
  // 순서: 접촉 배너 → 상황 문구 → (전투) 카운트다운 4 → 개시 메시지 → 라운드 배너
  board("pvp"); T.FX.force=true; T.TQ.length=0; T.els.msgBox.nodeType=1; // 메시지 재생 경로도 켠다
  const a=first(0,"minion"), d=first(1,"minion"); H.place(T,a,8,4); H.place(T,d,6,4); T.doMove(a,7,4);
  const titles=()=>T.FX.log.map(x=>x.kind+":"+(x.title||x.sub||x.key));
  ok(S().battle&&T.FX.log[0].title==="⚠️ 상대 말 접촉!"&&T.FX.log[1].sub==="배틀을 시작합니다."&&T.FX.log.slice(2,6).map(x=>x.title).join(",")==="3,2,1,배틀 시작!","G14 순서: 접촉 배너 → 상황 문구 → 3·2·1·배틀 시작! ("+titles().slice(0,6).join(" | ")+")");
  ok(T.fxLocked()&&T.netReady({t:"act",k:0})===false,"G15 카운트다운 중 잠금 · 수신 전투 프레임 보류(netReady false)");
  // 큐 끝까지 진행: 카운트다운 4 → 개시 메시지 재생 → 라운드 배너 → 메뉴 활성
  let n=0; while(T.fxLocked()&&n++<40){ const fn=T.TQ.shift(); if(!fn) break; fn(); }
  const afterKeys=T.FX.log.map(x=>x.key);
  ok(!T.fxLocked()&&afterKeys.includes("roundBanner")&&afterKeys.lastIndexOf("roundBanner")>afterKeys.lastIndexOf("countStep"),"G16 카운트다운 → 메시지 → 라운드 배너 순으로 재생 후 idle");
  const bh=T.els.overlayBox.innerHTML; ok(/id="bmenu"/.test(bh)&&/__menu\('fight'\)/.test(bh)&&!/<button disabled[^>]*__menu\('fight'\)/.test(bh),"G17 idle 후 카테고리 메뉴 활성");
  // 행동 → 기술 그룹(skillFx) → 피해 그룹(damageFx) 순서·재생 중 잠금
  const q0=T.FX.log.length; global.__act(0);
  ok(T.MSGPLAYING&&T.fxLocked(),"G18 행동 직후 메시지 재생 중 잠금");
  const groups=[]; let mbTxt=T.els.msgBox.innerHTML; groups.push(mbTxt);
  n=0; while(T.fxLocked()&&n++<40){ const fn=T.TQ.shift(); if(!fn) break; fn(); if(T.els.msgBox.innerHTML!==mbTxt){ mbTxt=T.els.msgBox.innerHTML; groups.push(mbTxt); } }
  ok(/의 .+!/.test(groups[0])&&groups.some(g=>/피해!/.test(g))&&groups.findIndex(g=>/피해!/.test(g))>0,"G19 그룹1 기술 문구 → 그룹2 피해 문구 순서 ("+groups.length+" 그룹)");
  ok(!T.fxLocked()&&T.FX.log.slice(q0).some(x=>x.key==="roundBanner"),"G20 피해 그룹 뒤 다음 행동자 라운드 배너");
  // 대기 콜백 보존 (PD 리뷰 msg_41fdc516c9ba): 두 대기자 중 첫째가 새 연출(잠금)을 시작해도 둘째는 버려지지 않고 다음 idle 에 순서대로 실행
  T.fxReleaseAll(); T.TQ.length=0; T.FX.force=true; const ran=[];
  T.fxPlay({key:"turnBanner",title:"L1"});
  T.fxWhenIdle(()=>{ ran.push("a"); T.fxPlay({key:"turnBanner",title:"L2"}); }); T.fxWhenIdle(()=>ran.push("b")); T.fxWhenIdle(()=>ran.push("c"));
  T.TQ.shift()(); // L1 본 타이머 → idle → a 실행(L2 시작) → b·c 는 보존
  ok(ran.join("")==="a"&&T.FX.idle.length===2&&T.FX.cur&&T.FX.cur.title==="L2","G21 첫 대기자가 새 잠금을 만들면 남은 대기자 2개는 큐에 보존 ("+ran.join("")+", 잔여 "+T.FX.idle.length+")");
  for(const fn of T.TQ.splice(0)) fn(); // L1 워치독(무효) → L2 본 타이머 → idle → b, c → L2 워치독(무효)
  ok(ran.join("")==="abc"&&T.FX.idle.length===0&&!T.fxLocked(),"G22 다음 idle 에 보존된 대기자(b, c)가 순서대로 실행 — 유실 0 ("+ran.join("")+")");
  // 보존된 대기자가 또 새 잠금을 만들어도 그 뒤 대기자는 다시 보존된다 (연쇄)
  ran.length=0; T.fxPlay({key:"turnBanner",title:"M1"});
  T.fxWhenIdle(()=>{ ran.push("x"); T.fxPlay({key:"turnBanner",title:"M2"}); }); T.fxWhenIdle(()=>{ ran.push("y"); T.fxPlay({key:"turnBanner",title:"M3"}); }); T.fxWhenIdle(()=>ran.push("z"));
  T.TQ.shift()(); ok(ran.join("")==="x"&&T.FX.idle.length===2,"G23a M1 종료 → x (M2 시작) · y·z 보존");
  for(const fn of T.TQ.splice(0)) fn(); ok(ran.join("")==="xy"&&T.FX.idle.length===1&&T.FX.cur&&T.FX.cur.title==="M3","G23b M2 종료 → y (M3 시작) · z 보존");
  for(const fn of T.TQ.splice(0)) fn(); ok(ran.join("")==="xyz"&&T.FX.idle.length===0&&!T.fxLocked(),"G23c M3 종료 → z — 연쇄에서도 유실 0");
  // REVISE msg_d847280b3dba: 옛 게임의 playMsgs step 타이머가 새 게임의 재생(MSGQ·MSGPLAYING·MSGAFTER)을 지우지 않는다
  { board("pve"); T.FX.force=true; T.els.msgBox.nodeType=1; const a=first(0,"minion"), d=first(1,"minion"); H.place(T,a,7,4); H.place(T,d,6,4); T.startRounds(a,d,a,d);
    T.TQ.length=0; T.S.battle.msgQ.length=0; T.S.battle.msgQ.push({txt:"OLD-1",key:"skillFx"},{txt:"OLD-2",key:"damageFx"}); T.playMsgs(T.S.battle.msgQ.splice(0),()=>{}); // 옛 게임 재생 시작
    const oldStep=T.TQ.splice(0);
    ok(T.MSGPLAYING&&oldStep.length===1,"G26a 옛 게임 메시지 재생 중 (step 타이머 보관)");
    board("pve"); T.FX.force=true; T.els.msgBox.nodeType=1; // 새 게임 (fxReleaseAll → 큐·플래그 초기화)
    const a2=first(0,"minion"), d2=first(1,"minion"); H.place(T,a2,7,4); H.place(T,d2,6,4); T.startRounds(a2,d2,a2,d2); T.TQ.length=0; T.S.battle.msgQ.length=0; // 개시 메시지 제거 — 검증 대상은 NEW-1/NEW-2 만
    let after=0; T.S.battle.msgQ.push({txt:"NEW-1",key:"skillFx"},{txt:"NEW-2",key:"damageFx"}); T.playMsgs(T.S.battle.msgQ.splice(0),()=>{ after++; });
    ok(T.MSGPLAYING&&T.MSGQ.length===1&&T.MSGQ[0].txt==="NEW-2","G26b 새 게임 재생 시작 (NEW-2 대기)");
    for(const fn of oldStep) fn(); // 옛 step 타이머가 뒤늦게 돌아온다
    ok(T.MSGPLAYING===true&&T.MSGQ.length===1&&T.MSGQ[0].txt==="NEW-2"&&after===0,"G26 옛 세대 step 은 새 게임의 MSGQ·MSGPLAYING·MSGAFTER 를 건드리지 않는다");
    for(const fn of T.TQ.splice(0)) fn(); for(const fn of T.TQ.splice(0)) fn(); ok(after===1&&!T.MSGPLAYING,"G26c 새 게임 재생은 제 순서로 끝난다 (after 1회)");
    T.fxReleaseAll(); T.S.battle=null; T.close(); }
  // Saturn msg_db013b1c24df: 도망 성공 + 대기 중 forcedQueue — 결과 배너 onEnd(→ fleeSwapPrompt → drainForcedQueue → 추가 접촉 배너)가 같은 세대의 새 현재 항목을 시작해도 옛 done 이 그 항목을 버리지 않는다
  { board("pve"); T.FX.force=true; T.els.msgBox.nodeType=1; T.TQ.length=0;
    const a=first(0,"minion"), d=first(1,"minion"), b2=first(0,"minion",1), e2=first(1,"minion",1), rear=first(0,"minion",2);
    H.place(T,a,7,4); H.place(T,d,6,4); H.place(T,b2,7,6); H.place(T,e2,6,6); H.place(T,rear,10,4);
    a.hp=20; T.startRounds(a,d,a,d); T.setSeed(null); const rr=global.Math.random; global.Math.random=()=>0.01; // HP<50% 를 전투 개시 전에 두어야 메뉴의 canFlee 가 참이다 · 도망 성공 고정
    T.S.forcedQueue=[{pid:b2.id,targets:[e2.id]}]; // 스왑 둘째 말의 강제 전투가 대기 중
    /* #146 코어 잠금(Saturn REVISE P1): 도망·패스는 연출·메시지 재생 중에는 코어에서도 거부된다.
       실제 플레이에서 사람이 버튼을 누를 수 있는 시점 = 개시 연출과 대기 메시지가 끝난 뒤이므로, 그 상태를 만든다. */
    T.S.battle.intro=true; T.S.battle.msgQ.length=0; T.S.battle.bannerKey=T.S.battle.round+"-"+T.S.battle.phase;
    T.fxReleaseAll(); T.FX.force=true; T.TQ.length=0; // 카운트다운 항목 제거 — 검증 대상은 결과 배너 → 추가 접촉 배너 연쇄
    T.battleModal(); T.TQ.length=0;                   // 이 렌더가 낸 클로저로 도망을 낸다 (행동 토큰 일치)
    global.__flee(); global.Math.random=rr; // 도망 성공 → 메시지 재생(fleeFx) → 결과 배너
    let n=0; while(T.MSGPLAYING&&n++<10){ const fn=T.TQ.shift(); if(!fn) break; fn(); }
    ok(!T.S.battle&&T.FX.cur&&T.FX.cur.key==="resultBanner","G27a 도망 성공 → 결과 배너 재생 중");
    const doneTimer=T.TQ.shift(); T.TQ.length=0; doneTimer(); // 결과 배너 본 타이머 → onEnd: close → fleeSwapPrompt → drainForcedQueue → 추가 접촉 배너 fxPlay
    ok(T.S.fleePick&&T.S.forcedQueue.length===1&&T.FX.cur.key==="fleeFx"&&T.fxLocked(),"G27e #114 도망 선택 배너가 이전 결과 타이머 뒤에도 유지되고 queue 승격 보류");
    for(const fn of T.TQ.splice(0)) fn();
    T.netAction({t:"fleeSkip"}); // 사람 보드 선택 완료 뒤 밀기 → 추가 접촉 배너
    let pn=0; while(T.FX.cur&&T.FX.cur.key!=="contactBanner"&&T.TQ.length&&pn++<20) T.TQ.shift()();
    ok(T.S.forcedTargets.length===1&&T.S.forcedTargets[0]===e2.id,"G27b onEnd 연쇄로 forcedQueue 승격");
    ok(T.FX.cur&&T.FX.cur.key==="contactBanner"&&/추가 접촉/.test(T.FX.cur.title)&&T.FX.cur.ms===T.BAL.fx.contactBanner&&T.fxLocked()&&!T.els.fxBanner._cls.has("hidden"),"G27 옛 done 이 새 현재 항목(추가 접촉 배너)을 버리지 않는다 — 선언 시간 그대로 잠금·표시 유지 (cur="+(T.FX.cur&&T.FX.cur.title)+")");
    ok(T.FX.q.length===0&&T.FX.log.filter(x=>x.key==="contactBanner").length===1&&T.FX.log.filter(x=>x.key==="resultBanner").length===1,"G27c 추가 접촉 배너 항목은 1개뿐이고 큐에 중복·유실 없음 (옛 done 의 fxNext 중복 호출 없음)");
    for(const fn of T.TQ.splice(0)) fn(); ok(!T.fxLocked()&&T.FX.cur===null,"G27d 새 항목이 제 시간에 끝나면 idle");
    T.fxReleaseAll(); T.FX.force=false; delete T.els.msgBox.nodeType; T.S.battle=null; T.close(); }
  // 세대 경계 (PD 리뷰 msg_3e9ac3ba0ea9): idle 콜백이 새 게임을 열면 옛 세대의 남은 콜백은 실행도 재적재도 되지 않는다
  T.fxReleaseAll(); T.TQ.length=0; T.FX.force=true; ran.length=0;
  T.fxPlay({key:"turnBanner",title:"N1"});
  T.fxWhenIdle(()=>{ ran.push("p"); H.freshPlay(T,"pvp"); T.FX.force=true; T.fxPlay({key:"turnBanner",title:"NEW"}); }); // 새 게임 + 새 게임의 첫 연출
  T.fxWhenIdle(()=>ran.push("q")); T.fxWhenIdle(()=>ran.push("r"));
  const genOld=T.FX.gen; T.TQ.shift()();
  ok(ran.join("")==="p"&&T.FX.gen===genOld+1&&T.FX.idle.length===0&&T.FX.cur&&T.FX.cur.title==="NEW","G24 idle 콜백이 새 게임을 열면 옛 콜백(q·r)은 실행되지 않고 새 게임 큐에도 재적재되지 않는다 ("+ran.join("")+", idle 잔여 "+T.FX.idle.length+")");
  for(const fn of T.TQ.splice(0)) fn(); ok(ran.join("")==="p"&&!T.fxLocked(),"G24b 새 게임 연출 종료 뒤에도 옛 콜백 미실행");
  // onEnd 가 새 게임을 열면 옛 항목의 hold 정리·다음 항목 진행이 새 게임 큐를 건드리지 않는다
  T.fxReleaseAll(); T.TQ.length=0; T.FX.force=true; ran.length=0;
  const ghost=first(0,"minion"); H.place(T,ghost,10,4);
  T.fxPlay({key:"explosion",title:"",hold:[{piece:ghost,r:10,c:4}],onEnd:()=>{ ran.push("e"); H.freshPlay(T,"pvp"); T.FX.force=true; T.fxPlay({key:"turnBanner",title:"NEW2"}); T.fxPlay({key:"turnBanner",title:"NEW3"}); }});
  T.fxPlay({key:"turnBanner",title:"OLD2"});
  ok(T.FX.hold.length===1,"G25a 옛 항목 hold 활성");
  T.TQ.shift()(); // 옛 폭발 항목 종료 → onEnd 가 새 게임을 연다
  ok(ran.join("")==="e"&&T.FX.cur&&T.FX.cur.title==="NEW2"&&T.FX.q.length===1&&T.FX.q[0].title==="NEW3"&&T.FX.hold.length===0,"G25 onEnd 의 새 게임 뒤 옛 done 은 fxNext 를 부르지 않는다 — 새 게임 큐(NEW2 진행·NEW3 대기)가 그대로 (cur="+(T.FX.cur&&T.FX.cur.title)+", q="+T.FX.q.length+")");
  ok(!T.FX.log.some(x=>x.title==="OLD2"&&x.shown),"G25b 옛 게임의 다음 항목(OLD2)은 표시되지 않는다");
  T.fxReleaseAll(); T.FX.force=false; delete T.els.msgBox.nodeType; T.TQ.length=0; T.S.battle=null; T.close();
});

/* ===== H. 접촉 문구표·거울 ===== */
block("H 문구",()=>{
  board("pvp"); const mi=first(0,"minion"), al=first(0,"ally"), kg=king(0), bo=first(0,"bomb");
  const em=first(1,"minion"), ea=first(1,"ally"), ek=king(1), eb=first(1,"bomb"), et=first(1,"trap");
  const C=(a,d,mine)=>T.contactText(a,d,mine);
  ok(C(mi,em,true)==="배틀을 시작합니다."&&C(mi,ea,true)==="배틀을 시작합니다."&&C(mi,ek,true)==="배틀을 시작합니다.","H1 상황 1 하수인→하수인/동료/왕");
  ok(C(mi,eb,true)==="폭탄이 터져 내 하수인이 제거됩니다."&&C(mi,et,true)==="함정에 걸려 내 하수인의 이동이 2턴간 제한됩니다.","H2·3 상황 2·3");
  ok(C(bo,em,true)==="폭탄이 터져 상대 하수인과 함께 제거됩니다."&&C(bo,ea,true)==="상대 말이 내 폭탄을 제거하였습니다."&&C(bo,ek,true)==="상대 말이 내 폭탄을 제거하였습니다."&&C(bo,eb,true)==="아무 일도 일어나지 않습니다. 말을 한칸씩 밀어냅니다."&&C(bo,et,true)==="아무 일도 일어나지 않습니다. 말을 한칸씩 밀어냅니다.","H4~6 상황 4·5·6");
  ok(C(al,em,true)==="배틀을 시작합니다. (출전을 선택하세요)"&&C(kg,eb,true)==="상대 폭탄이 터졌지만 내 말은 생존했습니다."&&C(al,et,true)==="함정에 걸려 내 말의 이동이 2턴간 제한됩니다.","H7 CJ 표 밖 조합 (동료·왕)");
  ok(C(mi,em,false)==="상대가 내 하수인에게 배틀을 걸었습니다."&&C(mi,ea,false)==="상대가 내 동료에게 배틀을 걸었습니다."&&C(mi,ek,false)==="상대가 내 왕에게 배틀을 걸었습니다.","H8 거울 1");
  ok(C(mi,eb,false)==="내 폭탄이 터져 상대 하수인이 제거됩니다."&&C(mi,et,false)==="상대 하수인이 내 함정에 걸렸습니다! (정체 공개 · 2턴 이동 불가)","H9 거울 2·3");
  ok(C(bo,em,false)==="상대 폭탄이 터져 내 하수인이 제거됩니다."&&C(bo,ea,false)==="내 말이 상대 폭탄을 제거하였습니다."&&C(bo,eb,false)==="아무 일도 일어나지 않습니다. 말을 한칸씩 밀어냅니다."&&C(kg,eb,false)==="상대 말이 내 폭탄을 제거하였습니다.","H10 거울 4·5·6·동료→폭탄");
  // 뷰어 판정: PVE 뷰어 0, 온라인 NET.me, 핫시트 항상 행동자
  T.S.mode="pve"; ok(T.viewerIsOwner(0)&&!T.viewerIsOwner(1)&&T.fxTurnLabel(1,false)==="상대 턴!"&&T.fxTurnLabel(0,true)==="나의 턴!","H11 PVE 뷰어 0 기준");
  T.S.mode="pvp"; ok(T.viewerIsOwner(1)&&T.fxTurnLabel(1,false)==="나의 턴!"&&T.fxTurnLabel(1,true)==="P2 턴!","H12 핫시트: 보드는 항상 '나의 턴!', 전투 라운드는 'P1/P2 턴!'");
  const wp={owner:1}; T.S.mode="pve"; ok(T.resultBannerOf(wp).title==="전투에서 패배,,,"&&T.resultBannerOf({owner:0}).title==="전투에서 승리!","H13 결과 배너 뷰어 기준");
  T.S.mode="pvp"; ok(/승리!/.test(T.resultBannerOf(wp).title)&&/P2/.test(T.resultBannerOf(wp).title),"H14 핫시트 결과 배너 중립 'P2 승리!'");
  // 거울 배너는 비공개 정보(탐색 보상·미공개 정체)를 담지 않는다 — 문구표 전수에 하수인 종명·속성·보상 단어 없음
  const all=[mi,al,kg,bo].flatMap(a=>[em,ea,ek,eb,et].flatMap(d=>[C(a,d,true),C(a,d,false)])).join("|");
  ok(!/회복약|몬스터볼|버프|·불|·물|·풀|·번개|불 하수인|물 하수인|풀 하수인|번개 하수인/.test(all),"H15 문구표 전수에 속성·보상 등 비공개 정보 없음");
});

/* ===== I. 온라인 락스텝 (2클라이언트, 헤드리스) ===== */
block("I 온라인",()=>{
  const FILE_HREF="file:///C:/Digit-Duel/demo/index.html", CODE="5F65J3YKGD";
  function load(){ const X=H.load(htmlPath,{href:FILE_HREF,storage:H.mkStorage({tutorialSeen:"1"})});
    const box=X.byId("overlayBox"), ob=X.byId("obBtns");
    Object.defineProperty(box,"innerHTML",{configurable:true,get(){return this._html;},set(v){this._html=v; this.children.length=0; ob.children.length=0;}});
    X.BAL.dmgVar=0; X.BAL.fx.autoEnd=true; X.tutSkip(); X.byId("overlay").classList.add("hidden"); return X; }
  const act=(X,fn)=>{ X.activate(); const r=fn(); X.drain(); return r; };
  function prepare(X){ X.byId("netCode").value=CODE; act(X,()=>global.netPrepare()); act(X,()=>global.autoPlace()); act(X,()=>global.setupDone()); }
  const T1=load(), T2=load(); prepare(T1); prepare(T2);
  const ws=[T1.wsLog[T1.wsLog.length-1],T2.wsLog[T2.wsLog.length-1]]; ws.forEach(w=>{ w.readyState=1; });
  const R={T:[T1,T2],ws,sent:[0,0]};
  const deliver=(i,m)=>act(R.T[i],()=>ws[i].onmessage({data:JSON.stringify(m)}));
  function relay(){ for(let k=0;k<50;k++){ let moved=0; for(const i of [0,1]){ const w=R.ws[i]; while(R.sent[i]<w.sent.length){ const m=JSON.parse(w.sent[R.sent[i]++]); act(R.T[1-i],()=>R.ws[1-i].onmessage({data:JSON.stringify(m)})); moved++; } } if(!moved) break; } for(const X of R.T) act(X,()=>X.netPump()); }
  deliver(0,{type:"matched",room:1,you:"p1"}); deliver(1,{type:"matched",room:1,you:"p2"}); relay();
  ok(T1.NET.started&&T2.NET.started&&T1.S.phase==="play"&&T2.S.phase==="play","I1 매칭·시작");
  const canon=X=>J({cur:X.S.current,turn:X.S.turnCount,main:X.S.mainUsed,pieces:X.S.pieces.map(p=>[p.id,p.r,p.c,p.alive,p.hp,p.healing,p.revealed,p.immobile]),m:X.metricsSnapshot().total});
  const actor=()=>T1.S.current===0?T1:T2, other=()=>actor()===T1?T2:T1;
  // 회복 액션: 행동자가 자기 말을 지정 → 상대 클라이언트가 같은 상태
  let A=actor(); const me=A.NET.me; const mine=A.S.pieces.filter(p=>p.owner===me&&p.type==="minion"); mine[0].hp=50; other().S.pieces.find(p=>p.id===mine[0].id).hp=50;
  const sentBefore=[ws[0].sent.length,ws[1].sent.length]; const ai=A===T1?0:1; // 자동 종료 프레임은 heal 직후 렌더에서 예약·발화된다 (헤드리스 grace 0)
  act(A,()=>A.netAction({t:"heal",id:mine[0].id})); relay();
  ok(canon(T1)===canon(T2)&&T1.S.pieces.find(p=>p.id===mine[0].id).healing&&T2.S.pieces.find(p=>p.id===mine[0].id).healing,"I2 heal 액션 릴레이 → 양측 S 동일 (자세 true)");
  // 비행동자 클라이언트의 heal 시도는 차단 (송신 0)
  const O=other(); const os=O.wsLog[O.wsLog.length-1].sent.length; act(O,()=>O.netAction({t:"heal",id:O.S.pieces.find(p=>p.owner===O.NET.me).id})); ok(O.wsLog[O.wsLog.length-1].sent.length===os,"I3 상대 턴 heal 은 송신되지 않음");
  // 자동 턴 종료: 행동자만 endTurn 프레임을 보낸다 (autoEnd on, 헤드리스 grace 0 → TQ) — heal 뒤 주 행동 완료·선택 전투 없음이므로 이미 발화되었다
  act(A,()=>A.render()); relay();
  const endFrames=i=>ws[i].sent.slice(sentBefore[i]).filter(s=>/"endTurn"/.test(s)).length;
  ok(endFrames(ai)===1&&endFrames(1-ai)===0&&T1.S.turnCount===T2.S.turnCount&&T1.S.current===T2.S.current,"I4 자동 턴 종료: 행동자 클라이언트만 endTurn 송신 (행동자 "+endFrames(ai)+" · 상대 "+endFrames(1-ai)+"), 양측 턴 일치");
  const g=Math.round(mine[0].maxHp*T1.BAL.healPostPct); // 종별 maxHp(85~120) 기준 5%
  ok(T1.S.pieces.find(p=>p.id===mine[0].id).hp===50+g&&T2.S.pieces.find(p=>p.id===mine[0].id).hp===50+g&&T1.S.metrics.autoEnds===1&&T2.S.metrics.autoEnds===1,"I5 턴 종료 틱 +"+g+" 양측 동일 · autoEnds 양측 동일");
  // 상대 턴에서도 자동 종료가 상대(행동자) 쪽에서만 발화 → 두 번째 틱
  const B2=actor(); ok(B2!==A&&B2.autoEndReady()===null,"I5b 상대 턴 시작 직후(주 행동 미사용)는 자동 종료 없음");
  act(B2,()=>B2.netAction({t:"skipMain"})); relay(); // 주 행동 생략 → 선택 전투 없음 → 행동자(B2)만 자동 종료
  ok(T1.S.pieces.find(p=>p.id===mine[0].id).hp===50+2*g&&canon(T1)===canon(T2),"I6 상대 턴 종료에도 +"+g+" (한 쌍 10%) · 양측 동일");
  // rand 소비 동일 (다음 rand 값 일치)
  ok(T1.rand()===T2.rand(),"I7 양측 RNG 상태 동일 (회복·자동 종료는 rand 미소비)");
  // 폭탄 접촉·함정 공개도 락스텝: 행동자가 폭탄을 상대 옆으로 이동
  A=actor(); const meA=A.NET.me; const bomb=A.S.pieces.find(p=>p.owner===meA&&p.type==="bomb"), tgt=A.S.pieces.find(p=>p.owner!==meA&&p.type==="minion");
  for(const X of [T1,T2]){ const b=X.S.pieces.find(p=>p.id===bomb.id), t=X.S.pieces.find(p=>p.id===tgt.id); b.r=7; b.c=4; t.r=5; t.c=4; for(const q of X.S.pieces) if(q.alive&&q.placed&&q.id!==b.id&&q.id!==t.id&&((q.r===6&&q.c===4)||(q.r===7&&q.c===4)||(q.r===5&&q.c===4))) q.placed=false; }
  act(A,()=>A.netAction({t:"cell",r:7,c:4})); act(A,()=>A.netAction({t:"cell",r:6,c:4})); relay();
  ok(!T1.S.pieces.find(p=>p.id===bomb.id).alive&&!T2.S.pieces.find(p=>p.id===tgt.id).alive&&canon(T1)===canon(T2),"I8 폭탄 직접 접촉이 cell 액션의 동기 후속으로 양측 동일 적용 (새 프레임 없음)");
  ok(T1.rand()===T2.rand(),"I9 RNG 여전히 동일");
  for(const X of [T1,T2]) X.TQ.length=0;
});

/* ===== J. 전투 4카테고리 DOM ===== */
block("J 전투 메뉴",()=>{
  board("pve"); const m=first(0,"minion"), e=first(1,"minion"); H.place(T,m,7,4); H.place(T,e,6,4); T.S.selected=null;
  T.startRounds(m,e,m,e); T.drain();
  const h=()=>T.els.overlayBox.innerHTML;
  ok(/id="bmenu"/.test(h())&&/⚔️ 싸우기/.test(h())&&/🎒 가방/.test(h())&&/🔴 포획/.test(h())&&/🏃 도망가기/.test(h()),"J1 루트 4카테고리");
  ok(/id="bsub-fight" /.test(h())||/id="bsub-fight"/.test(h()),"J2 하위 패널이 모두 그려져 있다 (활성 패널만 보임)");
  ok(/class="bsub hidden" id="bsub-fight"/.test(h())&&/class="bsub hidden" id="bsub-bag"/.test(h()),"J3 초기에는 하위 패널 숨김");
  ok(/__act\(0\)/.test(h())&&/__throwBall\(\)/.test(h())&&/__flee\(\)/.test(h()),"J4 기존 규칙 버튼(__act·__throwBall·__flee)이 그대로 존재 (온라인 송신 경로 불변)");
  ok(/<button disabled[^>]*__throwBall/.test(h())&&/상대 HP 100% — 30% 미만/.test(h()),"J5 포획 조건 미충족 사유 표시·비활성");
  /* #146 (v0.4.7 CJ 2026-09-10): 도망의 HP 게이트가 폐지됐다 — 만피여도 버튼이 활성이고 조건 미충족 사유 문구 자체가 없다.
     대신 표기 성공률이 기본 30% 이고, 실패해도 상대의 추가 반격이 없다는 설명이 붙는다. */
  ok(/<button class="danger" [^>]*__flee/.test(h())&&!/<button class="danger" disabled[^>]*__flee/.test(h()),"J6 도망 버튼은 HP 조건 없이 항상 활성 (#146)");
  ok(!/50% 미만이어야 합니다/.test(h())&&/HP 조건 없음/.test(h())&&/성공 30%/.test(h()),"J6b 도망 안내: HP 조건 문구 삭제·성공률 30% 표기 (#146)");
  ok(!/상대 즉시 공격 1회/.test(h())&&/추가 반격은 없고/.test(h()),"J6c 도망 실패 반격 삭제가 안내에 반영 (#146)");
  ok(/id="shfill-A"/.test(h())&&/id="shfill-D"/.test(h())&&!/가한 유효 피해/.test(h()),"J7 방어막 바 신설 · '가한 유효 피해' 게이지 제거");
  // (구 J0 setter 순서 검증은 시간 단계 증거가 아니므로 제거 — 5.5 방어막 → HP 표시 단계는 아래 K 블록이 가짜 타이머로 검증한다. REVISE msg_d847280b3dba 2번)
  const sent0=T.wsLog.length; global.__menu("fight"); ok(T.S.battle.menu==="fight"&&T.wsLog.length===sent0,"J8 하위 메뉴 전환은 로컬(송신 0·규칙 무변경)");
  // 상대(AI) 행동자 화면: 거울 사본 — 메뉴 비활성
  T.S.battle.phase=1; T.battleModal(); T.drain();
  ok(/▶ 상대 턴! 🤖/.test(h())&&/<button disabled[^>]*__menu\('fight'\)/.test(h()),"J9 상대(AI) 행동 차례: '상대 턴' + 카테고리 비활성 (거울 사본)");
  T.S.battle=null; T.TQ.length=0; T.close();
});

/* ===== K. 5.5 HP·방어막 바 표시 단계 (FX.force + 가짜 타이머) =====
   한 피해 이벤트가 방어막과 HP 를 함께 줄이면: 방어막 바는 applyFx 시점에 즉시, HP 바·숫자는 BAL.fx.barStep 타이머 뒤에 쓴다.
   지연 쓰기는 게임 세대·전투 객체·HP 바 DOM 노드·side 일련번호가 모두 같을 때만 실행된다. 헤드리스(FX.force 없음)는 종전처럼 즉시 */
block("K HP·방어막 단계",()=>{
  T.activate(); // I 블록의 다중 로드 뒤 가짜 타이머(setTimeout → T.TQ)를 이 로드로 되돌린다
  board("pve"); const m=first(0,"minion"), e=first(1,"minion"); H.place(T,m,7,4); H.place(T,e,6,4); T.S.selected=null;
  T.startRounds(m,e,m,e); T.drain();
  const B=T.S.battle, sh=T.byId("shfill-D"), hpb=T.byId("hpfill-D"), ht=T.byId("hptxt-D");
  const writes=[]; const track=el=>{ el.style=new Proxy({},{set(t,k,v){ if(k==="width") writes.push([el===sh?"shield":"hp",v]); t[k]=v; return true; }}); };
  const reset=()=>{ track(sh); track(hpb); hpb.style.width="100%"; sh.style.width="30%"; writes.length=0; ht.textContent="100"; B.dispShD=30; B.dispHpD=100; T.TQ.length=0; };
  const hit=()=>T.applyFx({hp:{side:"D",val:60,max:100},st:{side:"D",text:"🛡5",shield:5,max:100}}); // 방어막 30→5 · HP 100→60 동시 감소
  // K0 헤드리스(시간 0): 종전처럼 동기 즉시 — 기존 회귀 불변
  T.FX.force=false; reset(); hit();
  ok(sh.style.width==="5%"&&hpb.style.width==="60%"&&ht.textContent===60&&T.TQ.length===0&&writes.map(w=>w[0]).join(",")==="shield,hp","K0 FX 시간 0: 방어막·HP 즉시 동기 쓰기 · 타이머 없음");
  /* #125: 종전에는 여기서 barStep 을 600 으로 고정했다. 가짜 타이머에서는 값이 아니라 '0 이 아니다'만 의미가 있으므로
     제품 표의 값을 그대로 쓴다 — 표가 바뀌어도 이 절의 단언(순서·지연·무효화)은 그대로 성립하고 죽은 숫자가 남지 않는다. */
  T.FX.force=true; const BARSTEP_PROD=T.BAL.fx.barStep;
  ok(BARSTEP_PROD>0,"K0' 제품 barStep 이 0 보다 크다 — 아래 지연 단계 단언의 전제 (현재 "+BARSTEP_PROD+"ms)");
  // K1 단계 1: 방어막 바만 즉시, HP 바·숫자는 이전 표시 유지, dispHp 는 즉시, 지연 쓰기 1건 대기
  reset(); hit();
  ok(sh.style.width==="5%"&&hpb.style.width==="100%"&&ht.textContent==="100"&&B.dispShD===5&&B.dispHpD===60&&T.TQ.length===1&&writes.length===1,"K1 방어막+HP 동시 감소: 방어막 바 5% 즉시 · HP 바 100%·숫자 100 유지 · dispHpD 60 즉시 · barStep 지연 쓰기 1건 대기");
  // K2 단계 2: barStep 타이머 뒤 HP 바·숫자 — 정확히 한 번
  T.drain();
  ok(hpb.style.width==="60%"&&ht.textContent===60&&writes.filter(w=>w[0]==="hp").length===1&&T.TQ.length===0,"K2 barStep 뒤 HP 바 60%·숫자 60 — HP 쓰기 정확히 1회");
  // K3 단계가 없는 경우는 즉시: HP 만 감소 · 방어막만 감소(HP 동일) · 회복(HP 증가) · 다른 side 의 방어막
  reset(); T.applyFx({hp:{side:"D",val:70,max:100}}); ok(hpb.style.width==="70%"&&T.TQ.length===0,"K3a HP 만 감소 → 즉시");
  reset(); T.applyFx({hp:{side:"D",val:100,max:100},st:{side:"D",text:"🛡5",shield:5,max:100}}); ok(sh.style.width==="5%"&&hpb.style.width==="100%"&&T.TQ.length===0,"K3b 방어막만 감소(HP 동일) → 즉시 · 타이머 없음");
  reset(); B.dispHpD=50; hpb.style.width="50%"; T.applyFx({hp:{side:"D",val:80,max:100},st:{side:"D",text:"🛡5",shield:5,max:100}}); ok(hpb.style.width==="80%"&&T.TQ.length===0,"K3c 회복(HP 증가) → 즉시");
  reset(); T.applyFx({hp:{side:"D",val:60,max:100},st:{side:"A",text:"🛡5",shield:5,max:100}}); ok(hpb.style.width==="60%"&&T.TQ.length===0,"K3d 다른 side 의 방어막 갱신과 함께 온 HP 감소 → 즉시");
  // K4 뒤따른 같은 side HP 갱신이 대기 중인 지연 쓰기를 이긴다 (최신 값 유지 · 옛 값으로 되돌리지 않음)
  reset(); hit(); T.applyFx({hp:{side:"D",val:40,max:100}}); ok(hpb.style.width==="40%","K4a 대기 중 새 HP 갱신은 즉시 40%");
  T.drain(); ok(hpb.style.width==="40%"&&writes.filter(w=>w[0]==="hp").length===1,"K4b barStep 뒤 옛 지연 쓰기(60%)는 무효 — 40% 유지");
  // K5 모달 재렌더로 HP 바 노드가 바뀌면 옛 노드 기준 지연 쓰기는 새 노드를 건드리지 않는다 (재렌더가 dispHp 로 이미 최신을 그림)
  reset(); hit(); const fresh=T.document.createElement("div"); fresh.style={width:"NEW"}; T.els["hpfill-D"]=fresh; T.drain();
  ok(fresh.style.width==="NEW"&&hpb.style.width==="100%","K5 DOM 노드 교체 뒤 옛 지연 쓰기 무효 (새 노드 NEW 유지)"); T.els["hpfill-D"]=hpb;
  // K6 전투가 끝난(S.battle 교체) 뒤 도는 옛 타이머는 쓰지 않는다
  reset(); hit(); T.S.battle=null; T.drain(); ok(hpb.style.width==="100%","K6 전투 종료(S.battle null) 뒤 옛 지연 쓰기 무효"); T.S.battle=B;
  // K7 옛 게임의 지연 타이머를 보존한 채 새 게임·새 전투를 열고 실행 — 새 전투의 HP 바·dispHp 를 건드리지 않는다. 이어서 새 전투의 정상 경로는 정확히 1회 쓴다
  reset(); hit(); const pending=T.TQ.splice(0); ok(pending.length===1,"K7a 옛 게임 지연 타이머 보존");
  T.FX.force=false; board("pve"); const m2=first(0,"minion"), e2=first(1,"minion"); H.place(T,m2,7,4); H.place(T,e2,6,4); T.S.selected=null; T.startRounds(m2,e2,m2,e2); T.drain();
  const B2=T.S.battle; ok(B2!==B&&T.FX.gen>0,"K7b 새 게임(세대 증가)·새 전투");
  track(hpb); hpb.style.width="NEW"; writes.length=0; B2.dispHpD=100; T.TQ.push(...pending); T.drain();
  ok(hpb.style.width==="NEW"&&B2.dispHpD===100&&writes.length===0,"K7c 옛 타이머 실행 → 새 전투의 HP 바·dispHp 불변 (세대 토큰)");
  T.FX.force=true; B2.dispShD=20; sh.style.width="20%"; hpb.style.width="100%"; ht.textContent="100"; writes.length=0; T.TQ.length=0;
  T.applyFx({hp:{side:"D",val:75,max:100},st:{side:"D",text:"-",shield:0,max:100}});
  ok(sh.style.width==="0%"&&hpb.style.width==="100%"&&T.TQ.length===1,"K7d 새 전투의 새 메시지: 방어막 즉시 · HP 대기");
  T.drain(); ok(hpb.style.width==="75%"&&ht.textContent===75&&writes.filter(w=>w[0]==="hp").length===1,"K7e 새 전투 정상 경로: HP 바 75% 정확히 1회");
  // K8 barStep 은 BAL.fx 한 곳 — 0 이면 즉시 (계약 3.4: 모든 시간은 표 한 곳에서만)
  T.BAL.fx.barStep=0; B2.dispShD=20; sh.style.width="20%"; hpb.style.width="100%"; T.TQ.length=0; T.applyFx({hp:{side:"D",val:50,max:100},st:{side:"D",text:"-",shield:0,max:100}});
  ok(hpb.style.width==="50%"&&T.TQ.length===0,"K8 BAL.fx.barStep 0 → 즉시 쓰기"); T.BAL.fx.barStep=BARSTEP_PROD;
  T.FX.force=false; sh.style={}; hpb.style={}; T.S.battle=null; T.TQ.length=0; T.close();
});

console.log(`\n=== smoke_turnflow (#106): pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
