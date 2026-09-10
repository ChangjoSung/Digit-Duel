/* #121 탐색 패키지·신규 공용 기술·숲 포획 + #129 탐색 완료 턴 종료 — 헤드리스 회귀
   사용: node demo/test/regression/smoke_search_packages.js [demo/index.html]

   계약 원본: docs/milestone/v0.4.7/issues/121/Venus/gameplay-spec.md (Venus 초안 → PD 채택 → CJ 승인, 2026-09-09)
   이 파일은 구현을 베끼지 않고 **계약 원문의 AC** 를 검사한다. 절 구성은 계약 절 번호를 따른다.

     A. 계약 1 — 이벤트 배치: 구역마다 3종 각 1개·전체 6개 · 위치만 무작위 · 난수 소비 결정적 · 옛 6종 보상 폐기
     B. 계약 2 — 공용 인벤토리: 시작 1/1/1·볼 2 · 보유 상한 없음 · 개봉 취소 무소모 · 개봉은 카운터 미소모
     C. 계약 3 — 전투 버프 3종: 한 전투 1개 · 힘(분산 상단·난수 소비 불변) · 시간(R1 한정·그 전투만 3R) · 도망(#146 재계약: 그 전투 성공률 70% 치환) · 전투 종료 정리
     D. 계약 4 — 기술 교체: 3종 직접 선택(난수 0) · 살아 있는 최초 6명 · 4슬롯 어디든 · 중복 금지 · 취소 시 슬롯 불변 · 쿨 승계·공개 기록 초기화
     E. 계약 5 — 신규 3종: 드래곤 ×1.3/무속성 1.0 · 마녀 2효과 100%(rand 1회·갱신·풀 회복 실피해 100%) · 사신 봉인·즉사·폴백
     F. 계약 6·10 — 숲 포획 + 온라인 2인스턴스 락스텝(단일 송신·비소유자 마스킹·양측 동일 상태)
     G. 계약 4.8·10 — 정보 경계: 상대 인스턴스 DOM·보드 로그·전투 로그에 선택·획득 종류·기술·대상이 새지 않는다
     H. 계약 7(#129) — 탐색 완료 후 정확히 한 번 종료 · 선택 전투가 남으면 종료 X · 추가 grace 없음 · 늦은 콜백 가드
     I. 계약 9·10 — AI 5급·5단이 새 규칙을 수용하고 불법 선택·무한 무료 행동 루프가 없다 · AI vs AI 완주

   옛 smoke_cross_skill.js 의 B(탐색 흐름)·C8~C9(AI 탐색 경로)·G(이벤트 분기)·H(온라인 락스텝)·I(정보 경계)·J(AI 완주)가
   검사했던 "보상 전달" 성질은 #121 계약 4 로 전달 방식이 바뀌어 **이 파일로 이전**됐다 (삭제가 아니다).

   저장소에 파일을 쓰지 않는다 (Saturn --read-only 재실행 가능). 종료 코드 1 = 판정 실패, 2 = 예외. */
"use strict";
const H=require("../shared/harness"), path=require("path");
const htmlPath=process.argv[2]&&!process.argv[2].startsWith("--")?process.argv[2]:path.join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
const J=x=>JSON.stringify(x);
/* 브라우저처럼: overlayBox.innerHTML 교체는 그 안의 옛 #obBtns 버튼을 없앤다.
   하네스 스텁은 id 캐시라 모달마다 버튼이 누적되고, 그러면 (a) 텍스트로 버튼을 찾을 때 옛 모달의 버튼이 잡히고
   (b) 동기화 모달 래퍼가 children 을 인덱스로 재배선해 새 버튼에 엉뚱한 콜백이 붙는다.
   이 계약은 4단계 모달을 연달아 쓰므로 smoke_online_sync.js 와 같은 방식으로 스텁을 실제 DOM 에 맞춘다. */
function load(){ const X=H.load(htmlPath);
  const box=X.byId("overlayBox"), ob=X.byId("obBtns");
  Object.defineProperty(box,"innerHTML",{configurable:true,get(){return this._html;},set(v){this._html=v; this.children.length=0; ob.children.length=0;}});
  return X; }
const T=load();

/* ── 공통 픽스처 ─────────────────────────────────────────────────────────── */
function giveSpecies(X,m,r){ m.rosterId=r.id; m.name=r.name; m.element=r.element; m.hp=r.hp; m.maxHp=r.hp; m.atk=r.atk; m.skillAtk=r.skill; m.cdMax=r.cd; m.skills=X.archSkills(r.arch,r.element); m.cds=[0,0,0,0]; m.revealedSkills=[]; }
const R=(X,id)=>X.ROSTER.find(r=>r.id===id);
/* 내 하수인(12,4)·상대 하수인(11,4)·왕 둘·동료 하나 — 볼 3·예비 없음 */
function setup(X,mode){
  H.freshPlay(X,mode||"pvp"); H.clearBoard(X);
  const me=X.S.pieces.find(x=>x.owner===0&&x.type==="minion"), em=X.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  const k0=X.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=X.S.pieces.find(x=>x.owner===1&&x.type==="king");
  const ally0=X.S.pieces.filter(x=>x.owner===0&&x.type==="ally")[0];
  H.place(X,k0,13,1); H.place(X,k1,1,7); H.place(X,me,12,4); H.place(X,em,11,4); H.place(X,ally0,13,3);
  X.S.balls=[3,3]; X.S.reserve=[null,null]; X.S.inv=[[],[]]; X.TQ.length=0;
  return {me,em,k0,k1,ally0};
}
/* 실제 사용자 경로: 말 아래 이벤트 + 흔적 → 선택 → search 액션(netAction) */
function searchAt(X,p,kind){
  X.byId("obBtns").children.length=0; // 하네스 스텁은 모달마다 버튼이 누적된다 — 새 모달 전에 비운다
  X.S.current=p.owner; X.S.mainUsed=false; X.S.battlesUsed=0;
  X.S.events=[{r:p.r,c:p.c,kind:kind||"recruit",consumed:false}]; X.S.traces[p.owner].add(p.r+"_"+p.c);
  X.S.selected=p; X.netAction({t:"search"});
}
const ob=X=>X.byId("overlayBox").innerHTML, hidden=X=>X.byId("overlay").classList.contains("hidden");
const btns=X=>(X.byId("obBtns").children||[]).map(b=>b.textContent);
const findBtn=(X,txt)=>(X.byId("obBtns").children||[]).slice().reverse().find(x=>x.textContent===txt);
const click=(X,txt)=>{ const b=findBtn(X,txt); if(!b) throw new Error("버튼 없음: "+txt+" / "+J(btns(X)));
  if(b.disabled||typeof b.onclick!=="function") throw new Error("비활성 버튼을 누를 수 없다: "+txt); b.onclick(); };
/* 실제 브라우저처럼 "눌릴 수 없음"을 본다 — disabled 이고 핸들러도 없다 (문구만 바뀐 것이 아니다) */
const isDisabled=(X,txt)=>{ const b=findBtn(X,txt); return !!b&&b.disabled===true&&typeof b.onclick!=="function"; };
const btnStartingWith=(X,pre)=>(X.byId("obBtns").children||[]).slice().reverse().find(x=>x.textContent.indexOf(pre)===0);
/* 행동자를 공격측(A)으로 맞춘다 — actorOfPhase() 는 라운드 홀짝과 감전으로 선공이 바뀌므로 phase 를 뒤집어 맞춘다.
   실제 적용 경로에 "지금 이 side 의 차례인가" 가드가 생겼으므로(Saturn REVISE P1) 테스트도 실제 차례를 맞춰야 한다. */
const actAsA=X=>{ const B=X.S.battle; if(!B) return false;
  if(X.actorOfPhase()!=="A") B.phase=B.phase===0?1:0;
  return X.actorOfPhase()==="A"; };
const has=(X,txt)=>(X.byId("obBtns").children||[]).some(b=>b.textContent===txt);
/* 시드 고정 후 fn 을 돌려 rand 소비 횟수를 역산 */
function randConsumed(X,seed,fn,max){ X.setSeed(seed); const seq=[]; for(let i=0;i<(max||14);i++) seq.push(X.rand()); X.setSeed(seed); fn(); const n=X.rand(); const k=seq.indexOf(n); return k; }
function openBattle(X,a,d){ X.S.battle=null; X.S.battlesUsed=0; a.hp=a.maxHp; d.hp=d.maxHp; a.cds=[0,0,0,0]; d.cds=[0,0,0,0]; a.cd=0; d.cd=0;
  a.shield=0; d.shield=0; a.burn=0; d.burn=0; a.shock=0; d.shock=0; a.weaken=0; d.weaken=0; a.powerBuff=false; d.powerBuff=false; a.fleeBoost=false; d.fleeBoost=false;
  X.TQ.length=0; X.startRounds(a,d,a,d); X.TQ.length=0; }
const fixed=X=>{ X.BAL.dmgVar=0; X.BAL.statusProb=1; X.BAL.shockProb=1; };
/* 상태 확률만 1로 고정하고 **피해 분산은 살려 둔다** — 힘의 수호자는 분산 단계를 보는 계약이라 dmgVar 를 0 으로 만들면 검사가 공허해진다 */
const fixedVar=X=>{ X.BAL.dmgVar=0.2; X.BAL.statusProb=1; X.BAL.shockProb=1; };
/* 전투 모달을 다시 그려 window.__* 클로저를 현재 전투로 맞추고 버튼 누적을 비운다 (헤드리스 스텁은 obBtns 가 누적된다) */
const freshModal=X=>{ X.byId("obBtns").children.length=0; X.battleModal(); };
/* 기술 교체 3단계를 실제 버튼으로 누른다 */
function swapSkill(X,target,skillIdx,slot){
  const ms=X.rosterMinions(target.owner), idx=ms.findIndex(x=>x.id===target.id);
  click(X,"📘 기술 교체");
  click(X,(skillIdx+1)+". "+X.SKILLS[X.NEW_SKILLS[skillIdx]].ko);
  click(X,(idx+1)+". "+(target.name||"하수인"));
  click(X,"슬롯 "+(slot+1)+" 교체 ("+X.SKILLS[target.skills[slot]].ko+")");
}

/* ===================================================================== */
/* ===== A. 계약 1 — 이벤트 배치 ========================================= */
{
  ok(J(T.EVENT_KINDS)===J(["itemGift","battleBuff","recruit"]),"A1 이벤트 종류 3종 (itemGift·battleBuff·recruit)");
  ok(T.EVENT_POOL===undefined||!T.EVENT_POOL.includes("potion"),"A1b 옛 6종 풀(potion·cool·cure·ball·buff)은 생성에서 폐기");
  let shapeOk=true, cellOk=true, posVaried=new Set(), counts={};
  for(let seed=1;seed<=120;seed++){
    T.setSeed(seed); T.newGame("pvp");
    const ev=T.S.events;
    if(ev.length!==6) shapeOk=false;
    for(const rows of [[4,5],[9,10]]){
      const zone=ev.filter(e=>rows.includes(e.r));
      if(zone.length!==3) shapeOk=false;
      const kinds=zone.map(e=>e.kind).sort();
      if(J(kinds)!==J(["battleBuff","itemGift","recruit"])) shapeOk=false;
    }
    for(const e of ev){ if(!((e.r>=4&&e.r<=5)||(e.r>=9&&e.r<=10))||e.c<1||e.c>7) cellOk=false; if(e.consumed) shapeOk=false; }
    if(new Set(ev.map(e=>e.r+"_"+e.c)).size!==6) shapeOk=false; // 칸 중복 없음
    posVaried.add(J(ev.map(e=>e.r+"_"+e.c)));
    for(const e of ev) counts[e.kind]=(counts[e.kind]||0)+1;
  }
  ok(shapeOk,"A2 120시드 전수: 구역(4·5행 / 9·10행)마다 3종 각 1개 · 보드 전체 6개 · 칸 중복 없음 · 미소모 상태");
  ok(cellOk,"A3 모든 이벤트는 숲 구역 안의 유효 칸");
  ok(J(counts)===J({itemGift:240,battleBuff:240,recruit:240}),"A4 종류별 개수는 고정 — 120경기 × 2개씩 정확히 동일 "+J(counts));
  ok(posVaried.size>100,"A5 칸 위치는 무작위 (120시드에서 서로 다른 배치 "+posVaried.size+"가지)");
  // 난수 소비 결정적: 배치 결과와 무관하게 같은 횟수 (구역마다 14칸 셔플 = 13회 × 2)
  const nAt=seed=>randConsumed(T,seed,()=>T.genEvents(),40);
  const ns=[1,2,3,4,5,6,7,8].map(nAt);
  ok(ns.every(n=>n===ns[0])&&ns[0]===26,"A6 배치 난수 소비는 결정적 — 항상 "+ns[0]+"회 (종류 추첨 rand 없음 · 온라인 공유 시드 재현 보존)");
  // 계약 1.3: 폐기된 보상은 어떤 경로로도 켜지지 않는다
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1")); P.me.cds=[2,2,2,2];
  searchAt(T,P.me,"itemGift");
  ok(!P.me.nextBattleBuff&&J(P.me.cds)===J([2,2,2,2]),"A7 계약 1.3: 탐색으로 일시버프(+15%)도 하수인 쿨 전체 초기화도 얻지 못한다");
  ok(T.S.pkgs[0].itemGift===1,"A8 대신 패키지 재고가 늘어난다");
  // 탐색 자격은 불변 (계약 1.2)
  const b=T.S.pieces.find(x=>x.owner===0&&x.type==="bomb"); H.place(T,b,10,2);
  ok(T.canSearchPiece(P.me)&&T.canSearchPiece(P.k0)&&T.canSearchPiece(P.ally0)&&!T.canSearchPiece(b),"A9 계약 1.2: 하수인·동료·왕만 탐색 실행 (폭탄·함정 불가)");
  T.setSeed(null);
}

/* ===== B. 계약 2 — 공용 인벤토리·개봉 ================================== */
{
  T.newGame("pvp");
  ok(J(T.S.inv[0])===J(["potion","cool","cure"])&&J(T.S.inv[1])===J(["potion","cool","cure"]),"B1 시작 아이템 회복약·쿨링수·해독제 각 1 (양측 고정)");
  ok(T.S.balls[0]===2&&T.S.balls[1]===2,"B2 시작 공용 볼 2");
  ok(T.BAL.invMax===Infinity&&T.BAL.ballMax===Infinity,"B3 보유 상한 해제 (가방·볼 모두 Infinity)");
  ok(T.BAL.itemPerRound===1,"B4 라운드 1회 제한만 남는다");
  ok(T.BAL.itemPerBattle===Infinity,"B4b 전투당 2회 제한 제거");
  // 시작 아이템 생성이 난수를 쓰지 않는다 (종전 shuffle 2회 → 0회)
  const n=randConsumed(T,4242,()=>T.newGame("pvp"),40);
  const n2=randConsumed(T,4243,()=>T.newGame("pvp"),40);
  ok(n===n2&&n===26,"B5 newGame 난수 소비는 이벤트 배치 26회뿐 — 시작 아이템 추첨 rand 0 (고정 목록)");
  // 상한이 실제로 막지 않는다
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1"));
  for(let i=0;i<9;i++){ searchAt(T,P.me,"itemGift"); searchAt(T,P.me,"battleBuff"); }
  ok(T.S.pkgs[0].itemGift===9&&T.S.pkgs[0].battleBuff===9,"B6 패키지 재고에 상한이 없다 (각 9개 누적)");
  // 개봉: 전투 중 가방 · 확정만 소모 · 취소 무소모 · 카운터 미소모
  giveSpecies(T,P.em,R(T,"M-W1"));
  T.S.pkgs[0]={itemGift:2,battleBuff:1}; T.S.inv[0]=[]; T.S.balls[0]=0;
  openBattle(T,P.me,P.em);
  const B=T.S.battle;
  ok(!!B&&B.phase===0,"B7 전제: 전투 모달·공격측 행동 차례");
  const items0=B.itemsA, round0=B.itemRoundA, used0=T.S.mainUsed;
  freshModal(T); T.__openPkgCore("itemGift");
  ok(/아이템 선물 패키지/.test(ob(T))&&has(T,"회복약")&&has(T,"쿨링수")&&has(T,"해독제")&&has(T,"공용 몬스터볼")&&has(T,"취소"),"B8 개봉 화면: 4종 + 취소");
  click(T,"취소");
  ok(T.S.pkgs[0].itemGift===2&&T.S.inv[0].length===0&&T.S.balls[0]===0,"B9 취소는 아무것도 소모하지 않는다 (패키지 2 유지·재고 변화 0)");
  freshModal(T); T.__openPkgCore("itemGift"); click(T,"회복약");
  ok(T.S.pkgs[0].itemGift===1&&J(T.S.inv[0])===J(["potion"]),"B10 확정 순간에만 패키지 −1 · 선택한 자원 +1");
  ok(B.itemsA===items0&&B.itemRoundA===round0&&T.S.mainUsed===used0,"B11 개봉은 행동·전투 행동·아이템 라운드 카운터를 하나도 소모하지 않는다");
  ok(T.S.battle===B&&T.actorOfPhase()==="A","B12 개봉 직후 같은 행동자의 메뉴로 돌아온다");
  freshModal(T); T.__openPkgCore("itemGift"); click(T,"공용 몬스터볼");
  ok(T.S.balls[0]===1&&T.S.pkgs[0].itemGift===0,"B13 공용 볼도 개봉으로 획득 (상한 없음)");
  // 개봉은 난수를 쓰지 않는다
  T.S.pkgs[0].itemGift=1;
  const k=randConsumed(T,77,()=>{ freshModal(T); T.__openPkgCore("itemGift"); click(T,"해독제"); },10);
  ok(k===0,"B14 개봉은 난수를 쓰지 않는다 (플레이어 선택)");
  /* 아이템 실제 사용 — 유일하게 남은 제한은 **플레이어별 라운드 1회**다 (계약 2.3).
     플래그를 손으로 되돌려 '다음 라운드'를 흉내 내지 않고, nextPhase 로 **라운드를 실제로 넘긴다**.
     그리고 같은 라운드 두 번째 호출이 **재고·상태를 건드리지 않고 거부**되는지 본다 (버튼 disabled 가 아니라 규칙 경로 집행). */
  {
    const X=load(); fixed(X); X.tutSkip();
    const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    X.S.inv[0]=["potion","potion","potion"]; X.S.inv[1]=[];
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle; Bx.fa.hp=40; freshModal(X);
    ok(X.actorOfPhase()==="A","B15 전제: 공격측 행동 차례 (라운드 1)");
    const hp0=Bx.fa.hp;
    X.__useItemCore(0);
    ok(Bx.itemRoundA===true&&X.S.inv[0].length===2&&Bx.fa.hp>hp0,"B15 아이템 1회 사용: 라운드 플래그 on · 재고 −1 · 효과 적용");
    // 같은 라운드 두 번째 — 거부되어야 한다 (재고·HP·기록 전부 불변)
    const snap=J([X.S.inv[0],Bx.fa.hp,Bx.itemsA,Bx.lastItemA,Bx.itemRoundA]);
    X.__useItemCore(0); X.__useItemCore(1); X.__useItemCore(0);
    ok(J([X.S.inv[0],Bx.fa.hp,Bx.itemsA,Bx.lastItemA,Bx.itemRoundA])===snap,"B15b 같은 라운드 추가 호출은 **거부** — 재고·HP·기록 전부 불변 (중복 클릭·수신 프레임·늦은 콜백 방어)");
    // 유효하지 않은 인덱스·다른 전투·상대 차례도 거부
    const snap2=J([X.S.inv[0],Bx.itemsA]);
    X.__useItemCore(99); X.__useItemCore(-1);
    ok(J([X.S.inv[0],Bx.itemsA])===snap2,"B15c 범위 밖 인덱스는 거부 (재고 불변)");
    // 라운드를 실제로 넘긴다: 두 side 가 행동 → nextPhase 2회로 라운드 종료
    Bx.phase=1; X.nextPhase(); X.drain(20000);          // phase 1 → 라운드 종료 처리 → 라운드 2
    ok(Bx.round===2&&Bx.itemRoundA===false,"B16 전제: nextPhase 로 라운드가 실제로 넘어가 라운드 플래그가 리셋됐다 (라운드 "+Bx.round+")");
    /* 공격측 차례로 맞춘 **뒤에** 모달을 다시 그린다 — __useItemCore 는 렌더 시점의 side 를 클로저로 들고 있어서
       순서를 바꾸면 "상대 차례" 가드에 걸려 거부된다 (가드가 살아 있다는 증거이기도 하다). */
    if(X.actorOfPhase()!=="A") Bx.phase=Bx.phase===0?1:0;
    ok(X.actorOfPhase()==="A","B16a 공격측 차례로 맞춤 (라운드 "+Bx.round+" · phase "+Bx.phase+")");
    freshModal(X);
    const hp1=Bx.fa.hp, inv1=X.S.inv[0].length;
    X.__useItemCore(0);
    ok(X.S.inv[0].length===inv1-1&&Bx.itemsA===2,"B16 **같은 종류**(회복약)를 다음 라운드에 다시 쓸 수 있다 — 연속 동일 금지 제거 (누적 "+Bx.itemsA+"회)");
    // 한 전투에서 3회째
    Bx.phase=1; X.nextPhase(); X.drain(20000);
    if(X.actorOfPhase()!=="A") Bx.phase=Bx.phase===0?1:0;
    freshModal(X);
    X.__useItemCore(0);
    ok(Bx.itemsA===3&&X.S.inv[0].length===0,"B17 한 전투에서 3회 사용 — 전투당 2회 제한 제거 (누적 "+Bx.itemsA+"회)");
    ok(X.BAL.itemPerRound===1,"B17b 라운드 1회 상수는 그대로 1");
    X.TQ.length=0; X.S.battle=null; X.close();
  }
  T.S.battle=null; T.close(); T.setSeed(null);
}

/* ===== C. 계약 3 — 전투 버프 3종 ====================================== */
{
  ok(J(T.BUFF_KEYS)===J(["power","time","escape"]),"C1 버프 3종 (힘·시간·도망)");
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1")); giveSpecies(T,P.em,R(T,"M-G1")); fixed(T);
  // C2 한 전투 1개 — 패키지 2개를 들고도 두 번 못 쓴다
  T.S.pkgs[0]={itemGift:0,battleBuff:2};
  openBattle(T,P.me,P.em); let B=T.S.battle; freshModal(T);
  T.__openPkgCore("battleBuff"); click(T,"💪 힘의 수호자");
  ok(B.buffA==="power"&&T.S.pkgs[0].battleBuff===1&&P.me.powerBuff===true,"C2 버프 적용: 전투 객체에 기록·패키지 −1·전투원 플래그");
  const before=J([B.buffA,T.S.pkgs[0].battleBuff]);
  freshModal(T); T.__openPkgCore("battleBuff");
  ok(hidden(T)||!/전투 버프 패키지/.test(ob(T)),"C3 같은 전투에서 두 번째 개봉 화면이 열리지 않는다");
  ok(J([B.buffA,T.S.pkgs[0].battleBuff])===before&&T.S.pkgs[0].battleBuff===1,"C3b 두 번째 버프는 적용되지 않고 패키지는 보관된다 (전투당 1개)");
  ok(B.itemRoundA===false&&T.S.mainUsed===false,"C4 버프 사용은 행동·아이템 카운터를 소모하지 않는다 (아이템 회계와 별도)");
  /* C5 힘: **분산 단계만** 상단 고정 · 난수 소비 횟수는 버프와 무관.
     분산(dmgVar)을 0 으로 만들면 이 계약이 공허해지므로 여기서는 dmgVar 를 살려 둔다. */
  fixedVar(T);
  const Q5=setup(T); giveSpecies(T,Q5.me,R(T,"M-F1")); giveSpecies(T,Q5.em,R(T,"M-G1"));
  const basePow=T.slotPow(Q5.me,T.SKILLS.fire_stable);
  const dmgOf=buff=>{ openBattle(T,Q5.me,Q5.em); Q5.me.powerBuff=!!buff; T.setSeed(31); T.execSlot("A",0); T.TQ.length=0; return Q5.em.maxHp-Q5.em.hp; };
  const plain=dmgOf(false), powered=dmgOf(true);
  ok(powered>=plain,"C5 힘의 수호자: 피해가 분산 상단으로 고정 (기본 "+plain+" → 버프 "+powered+")");
  ok(powered===Math.round(Math.round(basePow*(1+T.BAL.dmgVar))*T.BAL.advMult),
     "C5b 분산 단계만 ×"+(1+T.BAL.dmgVar)+" 로 고정되고 상성(불→풀 ×"+T.BAL.advMult+")은 그대로 통과 — 위력 "+basePow+" → "+powered);
  // rand 소비: 전투 개시·배치가 아니라 **execSlot 한 번**만 격리해 센다
  const consumeOf=buff=>{ openBattle(T,Q5.me,Q5.em); Q5.me.powerBuff=!!buff;
    T.setSeed(31); const seq=[]; for(let i=0;i<12;i++) seq.push(T.rand());
    openBattle(T,Q5.me,Q5.em); Q5.me.powerBuff=!!buff;
    T.setSeed(31); T.execSlot("A",0); T.TQ.length=0; return seq.indexOf(T.rand()); };
  const c1=consumeOf(false), c2=consumeOf(true);
  ok(c1===c2&&c1>0,"C5c 힘 버프 유무로 rand 소비 횟수가 달라지지 않는다 ("+c1+"회 동일) — 난수를 뽑아 버리므로 공유 시드·AI 시뮬 스트림이 어긋나지 않는다");
  // C5d 상태 부여 확률은 100% 가 되지 않는다
  T.BAL.statusProb=0; openBattle(T,Q5.me,Q5.em); Q5.me.powerBuff=true; T.setSeed(5); T.execSlot("A",1); T.TQ.length=0;
  ok(!Q5.em.burn,"C5d 힘은 상태 부여 확률을 올리지 않는다 (statusProb 0 에서 화상 없음)"); fixed(T);
  // C6 시간: R1 한정 · 그 전투만 3R · 전역 상수 불변 · 사신 불가
  const gMax=T.BAL.maxRounds;
  const Q6=setup(T); giveSpecies(T,Q6.me,R(T,"M-F1")); giveSpecies(T,Q6.em,R(T,"M-G1"));
  T.S.pkgs[0]={itemGift:0,battleBuff:3};
  openBattle(T,Q6.me,Q6.em); B=T.S.battle;
  ok(T.battleMaxRounds()===gMax,"C6 기본 최대 라운드는 전역값 "+gMax);
  /* 라운드 2 의 선공은 방어측이다(actorOfPhase) — 공격측이 행동하는 차례는 phase 1 이다.
     "사용자 자기 행동의 1라운드에만"을 검사하려면 행동자를 공격측으로 맞춰야 한다. */
  B.round=2; B.phase=1; freshModal(T);
  ok(T.actorOfPhase()==="A","C6a 전제: 라운드 2 에서 공격측 행동 차례");
  T.__openPkgCore("battleBuff");
  const beforeT=B.maxRounds;
  ok(isDisabled(T,"🧭 시간의 수호자 (1R 전용)"),"C6b 2라운드에서 시간의 수호자 버튼은 **실제 disabled** (문구만이 아니다 — Saturn REVISE P2)");
  /* 코어 거부도 함께: UI 를 우회해 직접 호출해도 적용되지 않는다 */
  T.__pkgPickCore("buff",T.BUFF_KEYS.indexOf("time"));
  ok(B.maxRounds===beforeT&&B.maxRounds===null,"C6b' 코어를 직접 불러도 2라운드에서는 적용되지 않는다 (계약 3.3 R1 한정)");
  T.close(); B.round=1; B.phase=0; freshModal(T); T.__openPkgCore("battleBuff"); click(T,"🧭 시간의 수호자");
  ok(B.maxRounds===3&&T.battleMaxRounds()===3&&T.BAL.maxRounds===gMax,"C6c R1 적용: 이 전투만 3라운드 · 전역 BAL.maxRounds("+gMax+") 불변");
  ok(/라운드 1\/3/.test(ob(T)),"C6d 전투 화면에 3라운드 표시");
  ok(T.reaperWhy("A")!==null&&/3라운드까지/.test(T.reaperWhy("A")),"C6e 3라운드 전투에서는 사신의 낫이 영구 봉인 ("+T.reaperWhy("A")+")");
  // 3R 종료 → 현행 HP 비율 판정
  B.round=3; B.phase=1; B.fa.hp=60; B.fd.hp=40; const judged0=T.S.metrics.judged;
  T.nextPhase(); T.drain(2000);
  ok(T.S.metrics.judged===judged0+1,"C6f 3라운드 종료 시 현행 HP 비율 판정이 돈다 (라운드 수만 다르고 규칙 동일)");
  T.S.battle=null; T.close();
  /* C7 도망의 수호자 — #146 (v0.4.7 CJ 2026-09-10) 으로 계약이 바뀌었다.
     종전(#121 3.4): "HP 50% 게이트만 해제, 성공률 50% 불변".
     현행(#146): HP 게이트 자체가 폐지됐고, 이 버프는 **그 전투 동안 성공률을 70% 로 치환**한다 (가산도, 성공 보장도 아니다). */
  const Q7=setup(T); giveSpecies(T,Q7.me,R(T,"M-F1")); giveSpecies(T,Q7.em,R(T,"M-G1"));
  openBattle(T,Q7.me,Q7.em); B=T.S.battle; B.fa.hp=B.fa.maxHp;
  T.battleModal();
  ok(!/50% 미만이어야 합니다/.test(ob(T))&&/HP 조건 없음/.test(ob(T)),"C7 만피여도 도망 가능 — HP 조건 안내 자체가 없다 (#146)");
  ok(/성공 30%/.test(ob(T))&&T.BAL.fleeProb===0.3&&T.fleeProbOf(B.fa)===0.3,"C7a 기본 성공률 30% (표기·판정 동일 원천)");
  B.fa.fleeBoost=true; T.battleModal();
  ok(/도망의 수호자/.test(ob(T))&&/성공 70%/.test(ob(T)),"C7b 도망의 수호자 적용 시 이 전투 성공률 70% 표기");
  ok(T.BAL.fleeProbGuard===0.7&&T.fleeProbOf(B.fa)===0.7&&T.fleeProbOf(B.fd)===0.3,"C7c 70% 는 치환이다 — 버프를 쓴 전투원만 바뀌고 상대는 30% 그대로 (가산 +70%p 아님)");
  const tries0=T.S.metrics.fleeTries;
  T.setSeed(2); T.__fleeCore(); T.drain(3000);
  ok(T.S.metrics.fleeTries===tries0+1,"C7d 만피에서도 도망 시도가 실제로 실행된다 (게이트 폐지)");
  /* C7e 70% 는 **1회 성공 보장이 아니다** — 난수가 0.7 이상이면 실패한다. 경계값을 직접 확인한다 */
  {
    const X=load(); fixed(X); X.tutSkip();
    const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    let ok70=0,fail70=0;
    for(let seed=1;seed<=200&&(ok70<1||fail70<1);seed++){
      const Y=load(); fixed(Y); Y.tutSkip();
      const Qy=setup(Y); giveSpecies(Y,Qy.me,R(Y,"M-F1")); giveSpecies(Y,Qy.em,R(Y,"M-G1"));
      openBattle(Y,Qy.me,Qy.em); const By=Y.S.battle; By.fa.fleeBoost=true; freshModal(Y);
      Y.setSeed(seed); Y.__fleeCore(); Y.drain(20000);
      if(Y.S.metrics.fleeOks>0) ok70++; else fail70++;
      Y.TQ.length=0;
    }
    ok(ok70>0&&fail70>0,"C7e 70% 는 확률이다 — 같은 버프에서 성공("+ok70+")과 실패("+fail70+")가 모두 나온다 (1회 성공 보장 아님)");
  }
  /* C8 전투 종료 정리 — **실제 종료 경로**로 검사한다 (helper 직접 호출로 AC 를 대체하지 않는다).
     계약 3.1: 효과는 현재 전투원·그 전투에만 적용되고 전투가 끝나면 즉시 정리된다. 쓰지 않은 패키지는 보관된다.
     버프 회계의 단일 원천은 전투 인스턴스(B.buffA/B.buffD)이므로 S 에 중복 필드를 두지 않는다 — 그 사실도 함께 고정한다. */
  ok(T.S.buffs===undefined,"C8 버프 회계 중복 필드(S.buffs)는 두지 않는다 — 단일 원천은 전투 인스턴스 (종료 경로마다 정리 누락이 생길 여지 제거)");
  const endPaths=[
    ["승패(즉사)",(X,Q,Bx)=>{ Bx.fd.hp=1; X.setSeed(4); X.execSlot("A",0); X.drain(20000); }],
    ["판정(최종 라운드 종료)",(X,Q,Bx)=>{ Bx.round=X.battleMaxRounds(); Bx.phase=1; Bx.fa.hp=80; Bx.fd.hp=30; X.nextPhase(); X.drain(20000); }],
    ["도망 성공",(X,Q,Bx)=>{ let n=0; while(X.S.battle&&n<200){ X.setSeed(100+n); X.__fleeCore(); X.drain(20000); n++; if(X.S.battle) { Bx.phase=0; } } }],
    /* 적 포획: canThrow 는 battleModal 렌더 시점에 고정되는 클로저 상수다 — HP·볼·예비를 바꾼 뒤 **모달을 다시 그려야** 게이트가 다시 계산된다 */
    ["적 포획 종료",(X,Q,Bx)=>{ let n=0;
      while(X.S.battle&&n<200){
        X.S.balls[0]=3; X.S.reserve[0]=null; Bx.fd.hp=Math.floor(Bx.fd.maxHp*0.2); Bx.ballThrowA=false; Bx.phase=0; Bx.round=1;
        freshModal(X); X.setSeed(200+n); X.__throwBallCore(); X.drain(20000); n++; } }],
  ];
  for(const [label,run] of endPaths){
    const X=load(); fixed(X); X.tutSkip();
    const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    X.S.pkgs[0]={itemGift:2,battleBuff:2};
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle; freshModal(X);
    // 힘 + (R1 이므로) 시간까지는 한 전투 1개 제한으로 하나만 — 힘을 쓰고 도망 경로만 도망 버프를 쓴다
    const key=label==="도망 성공"?"escape":"power";
    X.__openPkgCore("battleBuff"); click(X,X.BUFFS[key].ko);
    ok((Bx.buffA===key)&&(key==="power"?Q.me.powerBuff===true:Q.me.fleeBoost===true),"C8-"+label+" 전제: 버프 적용됨 ("+key+")");
    ok(X.S.pkgs[0].battleBuff===1,"C8-"+label+" 전제: 쓰지 않은 패키지 1개 보관");
    run(X,Q,Bx);
    ok(X.S.battle===null,"C8-"+label+": 전투가 실제로 끝났다");
    ok(Q.me.powerBuff===false&&Q.me.fleeBoost===false,"C8-"+label+": 전투원 버프 플래그가 모두 정리됐다 (본체 출전이라 말에 남아 있으면 다음 전투로 샌다)");
    ok(Q.em.powerBuff===false&&Q.em.fleeBoost===false,"C8-"+label+": 상대 전투원도 정리됐다");
    ok(X.S.pkgs[0].battleBuff===1&&X.S.pkgs[0].itemGift===2,"C8-"+label+": **쓰지 않은 패키지 재고는 보존**된다 (버프 1·선물 2)");
    // 같은 말이 다음 전투에 들어가면 버프 없는 상태로 시작한다
    if(Q.me.alive&&Q.em.alive){
      openBattle(X,Q.me,Q.em); const B2=X.S.battle;
      ok(B2.buffA===null&&B2.buffD===null&&B2.maxRounds===null,"C8-"+label+": 새 전투의 버프 회계·라운드 상한이 초기 상태");
      ok(B2.fa.powerBuff===false&&B2.fa.fleeBoost===false,"C8-"+label+": 새 전투 개시 시점에도 플래그 0 (resetBattleTemps)");
    }
    X.TQ.length=0; X.S.battle=null; X.close();
  }
  // C8' 시간의 수호자가 걸린 전투가 끝나면 다음 전투는 전역 라운드 상한으로 돌아온다
  {
    const X=load(); fixed(X); X.tutSkip();
    const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    X.S.pkgs[0]={itemGift:0,battleBuff:1};
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle; freshModal(X);
    X.__openPkgCore("battleBuff"); click(X,X.BUFFS.time.ko);
    ok(Bx.maxRounds===3&&X.battleMaxRounds()===3,"C8' 전제: 시간의 수호자로 이 전투 3라운드");
    Bx.round=3; Bx.phase=1; Bx.fa.hp=80; Bx.fd.hp=30; X.nextPhase(); X.drain(20000);
    ok(X.S.battle===null,"C8'b 3라운드 종료로 전투가 끝났다");
    if(Q.me.alive&&Q.em.alive){ openBattle(X,Q.me,Q.em);
      ok(X.battleMaxRounds()===X.BAL.maxRounds,"C8'c 다음 전투는 전역 라운드 상한("+X.BAL.maxRounds+")으로 복귀 — 전역 상수는 처음부터 바뀌지 않았다"); }
    X.TQ.length=0; X.S.battle=null; X.close();
  }
  // C8'' 게임 재시작: 패키지·버프 관련 상태가 모두 초기화된다
  {
    const X=load();
    X.newGame("pvp"); X.S.pkgs[0]={itemGift:5,battleBuff:5};
    const minion=X.S.pieces.find(x=>x.owner===0&&x.type==="minion"); minion.powerBuff=true; minion.fleeBoost=true;
    X.newGame("pvp");
    ok(J(X.S.pkgs)===J([{itemGift:0,battleBuff:0},{itemGift:0,battleBuff:0}]),"C8'' 게임 재시작: 패키지 재고 초기화");
    ok(X.S.pieces.every(x=>x.powerBuff===false&&x.fleeBoost===false),"C8''b 게임 재시작: 모든 말의 버프 플래그 초기화 (새 말 객체)");
    ok(X.S.recruit===undefined||X.S.recruit===null,"C8''c 게임 재시작: 탐색 선택 상태 없음");
  }
  /* ===== C9 계약 9 — 버프 3종의 표시: 현재 전투원 주변 CSS 효과 + 한 전투 안 UI ===== */
  {
    const X=load(); fixed(X); X.tutSkip();
    const src=X.html;
    // CSS: 세 효과가 전투 토큰(.btok)에만 붙고, 힘·바람·시간이 각각 정의돼 있다
    for(const [key,ko] of [["power","힘"],["escape","바람(도망)"],["time","시간"]])
      ok(new RegExp("\\.btok\\.buff-"+key+"\\{").test(src),"C9 CSS .btok.buff-"+key+" 정의 ("+ko+" 효과)");
    ok(/@keyframes buffPower\{/.test(src)&&/@keyframes buffWind\{/.test(src)&&/@keyframes buffTime\{/.test(src),"C9b 세 효과 모두 CSS 애니메이션으로 움직인다 (힘·바람·시간)");
    // 범위 밖 음성 대조: 3D·새 이미지 자산을 쓰지 않는다
    ok(!/perspective|rotate3d|translateZ|matrix3d/.test(src),"C9c 3D 변환을 쓰지 않는다 (계약 9 범위 밖)");
    ok(!/buff[-_]?(power|time|escape)[^"']*\.(png|webp|svg|gif)/i.test(src),"C9d 버프용 신규 이미지 자산이 없다 (CSS 효과만 — 계약 9 범위 밖)");
    // 실제 렌더: 적용한 side 의 토큰에만 클래스가 붙고, 상대 화면에도 보인다(적용된 효과는 공개)
    const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); giveSpecies(X,Q.em,R(X,"M-G1"));
    X.S.pkgs[0]={itemGift:0,battleBuff:1};
    openBattle(X,Q.me,Q.em); const Bx=X.S.battle; freshModal(X);
    const before=ob(X);
    ok(!/buff-power/.test(before),"C9e 버프 전에는 토큰에 버프 클래스가 없다");
    X.__openPkgCore("battleBuff"); click(X,X.BUFFS.power.ko);
    const after=ob(X);
    ok(/id="tok-A"[^>]*class=|class="btok[^"]*buff-power[^"]*"[^>]*id="tok-A"/.test(after)||/buff-power/.test(after),"C9f 버프 적용 후 전투 토큰에 buff-power 가 붙는다");
    ok((after.match(/buff-power/g)||[]).length===1,"C9g 버프를 쓴 쪽 토큰에만 붙는다 (1곳)");
    ok(/✨/.test(after)&&after.includes(X.BUFFS.power.ko),"C9h 한 전투 안 UI: 적용된 버프가 상태줄에 표시된다");
    // 상대 화면(온라인 비소유자 시점)에도 적용된 효과는 보인다 — 재고·선택만 비공개
    X.NET.mode=true; X.NET.me=1; X.NET.started=true; freshModal(X);
    const opp=ob(X);
    ok(/buff-power/.test(opp)&&opp.includes(X.BUFFS.power.ko),"C9i 상대 화면에도 **적용된 효과**는 공개된다 (계약 3.1)");
    ok(/상대 패키지 비공개/.test(opp)&&!/🎁 아이템 선물 \d/.test(opp),"C9j 상대 화면에 내 패키지 재고는 비공개");
    X.NET.mode=false; X.NET.me=null; X.NET.started=false;
    // 전투가 끝나면 표시도 사라진다 (전투 객체와 함께)
    Bx.fd.hp=1; X.setSeed(4); X.execSlot("A",0); X.drain(20000);
    /* 전투가 끝나면 전투 모달 자체가 닫히므로 버프 표시도 화면에서 사라진다.
       (overlayBox 의 문자열은 닫힌 뒤에도 마지막 내용을 들고 있으므로, "다시 그려도 버프가 살아나지 않는다"로 본다.) */
    const gone=X.S.battle===null&&hidden(X);
    X.battleModal(); // 전투가 없으면 아무것도 그리지 않는다
    ok(gone&&hidden(X)&&Q.me.powerBuff===false,"C9k 전투가 끝나면 모달이 닫히고 버프 표시·플래그가 남지 않는다 (전투 인스턴스와 함께 사라진다)");
    X.TQ.length=0; X.close();
  }
  T.S.battle=null; T.close(); T.setSeed(null);
}

/* ===== D. 계약 4 — 기술 교체 ========================================== */
{
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1"));
  // D1 3종 직접 선택 · 제안 표시 난수 0
  const kRand=randConsumed(T,1234,()=>{ searchAt(T,P.me); click(T,"📘 기술 교체"); },14);
  ok(kRand===1,"D1 탐색 rand 소비는 포획 후보 종 1회뿐 — 기술 제안 표시는 난수 0 (계약 4.2-1)");
  ok(has(T,"1. 드래곤 숨결")&&has(T,"2. 마녀의 장난")&&has(T,"3. 사신의 낫"),"D1b 신규 3종을 모두 제시 "+J(btns(T)));
  T.close();
  // D2 대상 말: 살아 있는 최초 6명만 · 죽은 말은 보이되 비활성
  const ms=T.rosterMinions(0);
  ok(ms.length===6,"D2 대상 후보는 최초 로스터 하수인 6명");
  for(const m of ms) giveSpecies(T,m,R(T,"M-F1"));
  for(const m of ms) { m.alive=true; m.placed=true; m.r=12; m.c=1+ms.indexOf(m); }
  ms[2].alive=false; ms[2].placed=false;
  searchAt(T,P.me); click(T,"📘 기술 교체"); click(T,"1. 드래곤 숨결");
  const tb=btns(T);
  const deadBtn=btnStartingWith(T,"3. ");
  ok(/제거됨 — 선택 불가/.test(ob(T))&&!!deadBtn&&deadBtn.disabled===true&&typeof deadBtn.onclick!=="function",
     "D2b 죽은 말은 목록에 보이되 **실제 disabled** (핸들러 없음) — "+(deadBtn?deadBtn.textContent:"버튼 없음"));
  /* 코어 거부도 함께: UI 를 우회해 직접 호출해도 대상이 되지 않는다 (Saturn REVISE P2) */
  const stageBefore=T.S.recruit.stage;
  T.__recruitCore("target",2);
  ok(T.S.recruit&&T.S.recruit.stage===stageBefore&&T.S.recruit.targetId===null,"D2b' 코어를 직접 불러도 죽은 말은 대상이 되지 않는다");
  ok(/기술 \? \? \? \?/.test(ob(T)),"D2c 대상을 고르기 전 4슬롯은 ? 로 가린다 (계약 4.2-4)");
  // D3 4슬롯 어디든 · 고른 뒤 기술이 보인다
  const target=ms[0]; target.cds=[2,1,3,0]; target.revealedSkills=[0,1,2,3];
  click(T,"1. "+(target.name||"하수인"));
  const sb=btns(T);
  ok(sb.filter(x=>/^슬롯 \d 교체/.test(x)).length===4,"D3 4슬롯 모두 교체 대상 (공격기 2·보조기·시그니처) "+J(sb.filter(x=>/슬롯/.test(x))));
  ok(/응급 치유/.test(ob(T))&&/전술 연계/.test(ob(T)),"D3b 고른 뒤 그 말의 현재 기술이 보인다");
  // D4 보조기 슬롯(2) 교체 — 쿨 승계·공개 기록 초기화·나머지 슬롯 불변
  const snapSk=target.skills.slice(), snapCd=target.cds.slice();
  click(T,"슬롯 3 교체 ("+T.SKILLS[target.skills[2]].ko+")");
  ok(target.skills[2]==="dragon_breath","D4 보조기 슬롯도 교체된다 (4슬롯 어디든)");
  ok(target.cds[2]===snapCd[2]&&J(target.cds)===J(snapCd),"D4b 교체 슬롯의 남은 쿨 승계 (cds["+snapCd[2]+"] 유지·초기화 없음)");
  ok(J(target.revealedSkills)===J([0,1,3]),"D4c 그 슬롯만 공개 기록에서 제거 → 다시 비공개");
  ok(target.skills[0]===snapSk[0]&&target.skills[1]===snapSk[1]&&target.skills[3]===snapSk[3],"D4d 나머지 슬롯 불변");
  // D5 중복 금지
  searchAt(T,P.me); click(T,"📘 기술 교체"); click(T,"1. 드래곤 숨결");
  const dupName="1. "+(target.name||"하수인")+" (이미 보유)";
  const dupBtn=findBtn(T,dupName);
  ok(!!dupBtn&&dupBtn.disabled===true&&typeof dupBtn.onclick!=="function"&&/이미 이 기술 보유/.test(ob(T)),
     "D5 이미 그 기술을 가진 말은 **실제 disabled** (계약 4.2-5) — "+(dupBtn?dupBtn.textContent:J(btns(T))));
  const sBefore=T.S.recruit.stage, skBefore=J(target.skills);
  T.__recruitCore("target",T.rosterMinions(0).findIndex(m=>m.id===target.id));
  ok(T.S.recruit.stage===sBefore&&J(target.skills)===skBefore,"D5' 코어를 직접 불러도 중복 장착으로 넘어가지 않는다");
  T.close();
  // D6 취소·포기: 슬롯 불변 · 이벤트는 소모
  const snap2=J([target.skills,target.cds,target.revealedSkills]);
  searchAt(T,P.me); click(T,"📘 기술 교체"); click(T,"2. 마녀의 장난"); click(T,"2. "+(ms[1].name||"하수인")); click(T,"포기");
  ok(J([target.skills,target.cds,target.revealedSkills])===snap2&&!ms[1].skills.includes("witch_prank"),"D6 포기: 어떤 슬롯도 바뀌지 않는다");
  ok(T.S.events[0].consumed&&T.S.mainUsed,"D6b 포기해도 이벤트 칸·주 행동은 소모 (계약 4.2-6)");
  ok(hidden(T),"D6c 포기 후 화면이 닫힌다");
  // D7 뒤로 가기: 단계만 되돌리고 상태는 그대로
  searchAt(T,P.me); click(T,"📘 기술 교체"); click(T,"2. 마녀의 장난"); click(T,"← 뒤로");
  ok(has(T,"1. 드래곤 숨결")&&has(T,"3. 사신의 낫"),"D7 뒤로: 기술 선택 단계로 복귀");
  click(T,"← 뒤로");
  ok(has(T,"📘 기술 교체"),"D7b 한 번 더 뒤로: 첫 화면");
  click(T,"포기");
  // D8 보드 로그는 generic
  ok(T.S.log.some(l=>/숲 이벤트 발생/.test(l.msg))&&!T.S.log.some(l=>/드래곤|마녀|사신|슬롯|교체/.test(l.msg)),"D8 공용 보드 로그는 generic '숲 이벤트 발생'만 (계약 4.8)");
  T.setSeed(null);
}

/* ===== E. 계약 5 — 신규 공용 기술 3종 ================================== */
{
  // E1 드래곤: 속성 상대 ×1.3 · 무속성 중립 1.0
  const mk=(oppId,oppType)=>{ const P=setup(T); fixed(T); T.BAL.dmgVar=0;
    giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[0]="dragon_breath";
    let d=P.em; if(oppType){ d=P.k1; d.hp=100; d.maxHp=100; } else giveSpecies(T,P.em,R(T,oppId));
    openBattle(T,P.me,d); T.setSeed(9); T.execSlot("A",0); T.TQ.length=0; return {dmg:(d.maxHp)-d.hp,P}; };
  const pow=T.slotPow({atk:22},T.SKILLS.dragon_breath);
  const vsGrass=mk("M-G1").dmg, vsWater=mk("M-W1").dmg, vsKing=mk(null,"king").dmg;
  ok(vsGrass===Math.round(pow*1.3)&&vsWater===Math.round(pow*1.3),"E1 드래곤 숨결: 속성 있는 상대에게 **항상** ×1.3 — 풀 "+vsGrass+" · 물 "+vsWater+" (불→풀 우위·물 열위와 무관하게 동일)");
  ok(vsKing===pow,"E1b 무속성 왕 본체에는 중립 1.0 — "+vsKing);
  ok(T.SKILLS.dragon_breath.el===undefined&&T.atkElOf({element:"fire"},T.SKILLS.dragon_breath)===null,"E1c 드래곤은 속성 판정에서 빠진다 (상성표 4종 불변)");
  // E2 마녀: 서로 다른 2효과 100% · rand 1회 · 풀 회복 실피해 100%
  ok(J(T.WITCH_COMBOS)===J([[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]])&&T.WITCH_EFFECTS.length===4,"E2 마녀 조합표: 4효과 중 2개 = 6조합 균등");
  const witch=seed=>{ const P=setup(T); fixed(T); T.BAL.dmgVar=0; T.BAL.statusProb=0; T.BAL.shockProb=0; // 확률 게이트를 0 으로 막아도 100% 적용되어야 한다
    giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[0]="witch_prank"; giveSpecies(T,P.em,R(T,"M-G1"));
    openBattle(T,P.me,P.em); P.me.hp=50; const hp0=P.me.hp, ehp0=P.em.hp;
    T.setSeed(seed); T.execSlot("A",0); T.TQ.length=0;
    return {burn:P.em.burn,weaken:P.em.weaken,shock:P.em.shock,heal:P.me.hp-hp0,dealt:ehp0-P.em.hp,P}; };
  const seen=new Set(); let always2=true, healOk=true;
  for(let s=1;s<=120;s++){ const r=witch(s);
    const on=[r.burn>0,r.weaken>0,r.shock>0,r.heal>0].filter(Boolean).length;
    if(on!==2) always2=false;
    seen.add([r.burn>0?1:0,r.weaken>0?1:0,r.shock>0?1:0,r.heal>0?1:0].join(""));
    if(r.heal>0&&r.heal!==r.dealt) healOk=false; }
  ok(always2,"E2b 120시드 전수: 항상 **정확히 2효과**가 적용된다 (확률 게이트 0 에서도 100%)");
  ok(seen.size===6,"E2c 6조합이 모두 관측된다 (균등) — "+seen.size+"가지");
  ok(healOk,"E2d 풀 회복량 = 이번 공격의 실HP 피해 100%");
  /* E2e rand 소비: 전투 개시·배치는 제외하고 **execSlot 한 번**만 격리해서 센다.
     기대: 피해 분산 1회 + 조합 추첨 1회 = 2회. 효과 적용에 확률 게이트 rand 가 없다는 뜻이다 (statusProb·shockProb 통과 X). */
  {
    const P=setup(T); fixedVar(T); giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[0]="witch_prank"; giveSpecies(T,P.em,R(T,"M-G1"));
    openBattle(T,P.me,P.em);
    T.setSeed(55); const seq=[]; for(let i=0;i<12;i++) seq.push(T.rand());
    openBattle(T,P.me,P.em);
    T.setSeed(55); T.execSlot("A",0); T.TQ.length=0;
    const kW=seq.indexOf(T.rand());
    ok(kW===2,"E2e 마녀 1회 사용의 rand 소비는 피해 분산 1 + 조합 추첨 1 = 2회 (효과 적용에 확률 게이트 rand 없음) — 관측 "+kW);
    // 음성 대조: 분산이 없으면 조합 추첨 1회만 남는다
    T.BAL.dmgVar=0; openBattle(T,P.me,P.em);
    T.setSeed(55); const seq2=[]; for(let i=0;i<12;i++) seq2.push(T.rand());
    openBattle(T,P.me,P.em); T.setSeed(55); T.execSlot("A",0); T.TQ.length=0;
    ok(seq2.indexOf(T.rand())===1,"E2e' 분산을 끄면 조합 추첨 1회만 남는다 (측정이 공허하지 않다)");
    fixed(T);
  }
  /* 풀 회복의 경계 두 가지 — **grass 효과가 실제로 뽑힌 시드에서만** 판정한다.
     조합은 `WITCH_COMBOS[floor(rand()*6)]` 이고 분산 rand 가 먼저 1회 소비되므로, 시드에서 두 번째 난수로 조합을 미리 계산해
     grass(WITCH_EFFECTS 인덱스 3)가 든 시드만 쓴다. 그러지 않으면 "회복 0" 단언이 grass 가 안 뽑힌 시드에서도 통과한다. */
  {
    const P=setup(T); fixed(T); T.BAL.dmgVar=0.2; giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[0]="witch_prank"; giveSpecies(T,P.em,R(T,"M-G1"));
    const gIdx=T.WITCH_EFFECTS.indexOf("grassHeal");
    ok(gIdx>=0,"E2f0 전제: grassHeal 이 효과 목록에 있다 (index "+gIdx+")");
    /* 시드별로 조합을 미리 계산한다 — 제품과 같은 순서(분산 1회 → 조합 1회)로 난수를 읽는다 */
    const comboOf=seed=>{ T.setSeed(seed); T.rand(); return T.WITCH_COMBOS[Math.floor(T.rand()*T.WITCH_COMBOS.length)]; };
    let grassSeed=-1, plainSeed=-1;
    for(let s=1;s<=400&&(grassSeed<0||plainSeed<0);s++){ const c=comboOf(s);
      if(c.includes(gIdx)){ if(grassSeed<0) grassSeed=s; } else if(plainSeed<0) plainSeed=s; }
    ok(grassSeed>0&&plainSeed>0,"E2f1 grass 포함 시드("+grassSeed+")와 미포함 시드("+plainSeed+")를 모두 확정했다");
    // (a) 보호막이 전부 흡수 → 실HP 피해 0 → grass 가 뽑혔어도 회복 0
    openBattle(T,P.me,P.em); P.me.hp=50; T.S.battle.fd.shield=999;
    T.setSeed(grassSeed); T.execSlot("A",0); T.TQ.length=0;
    const B1=T.S.battle;
    ok(B1&&B1.fd.hp===B1.fd.maxHp,"E2f2 전제: 피해가 보호막에 전부 흡수돼 실HP 피해 0");
    ok(B1&&B1.fa.hp===50,"E2f **grass 조합이 확정된 시드**에서도 실HP 피해 0 이면 회복 0 (보호막 흡수 제외)");
    // (b) 보호막 없음 → grass 가 뽑히면 실HP 피해만큼 정확히 회복
    openBattle(T,P.me,P.em); P.me.hp=40; T.S.battle.fd.shield=0;
    const ehp0=T.S.battle.fd.hp;
    T.setSeed(grassSeed); T.execSlot("A",0); T.TQ.length=0;
    const B2=T.S.battle, dealt=ehp0-(B2?B2.fd.hp:ehp0);
    ok(B2&&dealt>0,"E2f3 전제: 실HP 피해 "+dealt+" 발생");
    ok(B2&&B2.fa.hp===40+dealt,"E2f4 풀 회복 = 실HP 피해 100% 정확히 ("+40+"+"+dealt+" = "+(B2?B2.fa.hp:"?")+")");
    // (c) 오버킬 제외 — 상대 HP 보다 큰 피해여도 회복은 실제로 깎인 만큼만
    openBattle(T,P.me,P.em); P.me.hp=30; T.S.battle.fd.shield=0; T.S.battle.fd.hp=3;
    T.setSeed(grassSeed); T.execSlot("A",0); T.TQ.length=0;
    const B3=T.S.battle;
    ok((B3?B3.fa.hp:(P.me.hp))<=30+3,"E2f5 오버킬 제외 — 회복은 실제 HP 감소분(최대 3)까지 (관측 "+(B3?B3.fa.hp:P.me.hp)+")");
    // (d) grass 미포함 시드에서는 회복이 없다 (음성 대조 — 검사가 조합을 실제로 보는지)
    openBattle(T,P.me,P.em); P.me.hp=45; T.S.battle.fd.shield=0;
    T.setSeed(plainSeed); T.execSlot("A",0); T.TQ.length=0;
    const B4=T.S.battle;
    ok(B4&&B4.fa.hp===45,"E2f6 [음성] grass 미포함 조합에서는 회복이 0 — 회복 검사가 조합에 실제로 반응한다");
    fixed(T);
  }
  /* 재부여는 **누적이 아니라 지속 기간 갱신**이다 (마녀 전용 예외). 일반 효과기의 "이미 걸려 있으면 부여하지 않음"은 그대로다.
     시드마다 전투를 다시 열어 앞 시드의 라운드 진행·전투 종료가 섞이지 않게 한다. */
  {
    const P=setup(T); fixed(T); giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[0]="witch_prank"; giveSpecies(T,P.em,R(T,"M-G1"));
    let refreshed=false, tried=0, everBurn=0;
    for(let s=1;s<=200&&!refreshed;s++){
      openBattle(T,P.me,P.em); T.S.battle.fd.burn=1; tried++;
      T.setSeed(s); T.execSlot("A",0); T.TQ.length=0;
      const B2=T.S.battle; if(!B2) continue;
      if(B2.fd.burn>1) everBurn++;
      if(B2.fd.burn===T.BAL.burnRounds) refreshed=true;
    }
    ok(refreshed,"E2g 마녀 재부여는 지속 기간 갱신 — 이미 화상 1R 인 상대에게 "+T.BAL.burnRounds+"R 로 덮어쓴다 ("+tried+"시드 시도)");
    ok(everBurn>0,"E2g' 갱신이 실제로 관측된다 (1R 초과로 올라간 횟수 "+everBurn+")");
    // 일반 효과기(잔불 표식): 이미 화상이면 부여하지 않는다 — 마녀 예외가 일반 규칙으로 번지지 않았다
    giveSpecies(T,P.me,R(T,"M-F1")); T.BAL.statusProb=1; T.BAL.shockProb=1; // #96 계약: 두 확률은 같은 줄에서 함께 고정한다 (감전 결정론)
    openBattle(T,P.me,P.em); T.S.battle.fd.burn=1;
    const applied0=T.S.metrics.statusApplied; T.setSeed(3); T.execSlot("A",1); T.TQ.length=0;
    ok(T.S.battle&&T.S.battle.fd.burn===1&&T.S.metrics.statusApplied===applied0,"E2h 일반 효과기의 '이미 걸려 있으면 부여 안 함'은 그대로 (마녀 전용 예외)");
  }
  // E3 사신: 봉인 게이트
  {
    const P=setup(T); fixed(T); giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[3]="reaper_scythe"; giveSpecies(T,P.em,R(T,"M-G1"));
    openBattle(T,P.me,P.em); const B=T.S.battle;
    B.round=5; B.fa.hp=10; B.fd.hp=100;
    ok(T.reaperWhy("A")!==null&&/라운드부터/.test(T.reaperWhy("A")),"E3 5라운드에서는 봉인 ("+T.reaperWhy("A")+")");
    B.round=6; B.fa.hp=100; B.fd.hp=100;
    ok(T.reaperWhy("A")!==null&&/낮아야/.test(T.reaperWhy("A")),"E3b HP 비율 동률이면 사용 불가 (strict)");
    B.fa.hp=100; B.fd.hp=50;
    ok(T.reaperWhy("A")!==null,"E3c HP 비율 우세면 사용 불가");
    B.fa.hp=30; B.fd.hp=100;
    ok(T.reaperWhy("A")===null&&T.slotUsable(B.fa,3,"A")===true,"E3d 6라운드 + 내 비율 열세에서만 사용 가능");
    /* 쿨 감소 수단으로 봉인이 풀리지 않는다 — **실제로 쿨링수를 쓴다** (종전 검사는 함수를 참조만 하고 호출하지 않았다).
       쿨링수는 4슬롯 cds 를 전부 0 으로 만든다. 그래도 5라운드에서는 봉인이 그대로여야 한다. */
    B.round=5; B.fa.hp=30; B.fd.hp=100; B.fa.cds=[2,2,2,2]; B.itemRoundA=false;
    T.S.inv[0]=["cool"];
    if(T.actorOfPhase()!=="A") B.phase=B.phase===0?1:0;
    T.byId("obBtns").children.length=0; T.battleModal();        // 클로저를 현재 side 로 맞춘다
    ok(T.actorOfPhase()==="A","E3e0 전제: 공격측 차례 · 쿨 2 · 가방에 쿨링수");
    T.__useItemCore(0);                                         // 실제 사용
    ok(J(B.fa.cds)===J([0,0,0,0]),"E3e1 쿨링수가 실제로 적용돼 4슬롯 쿨이 0 이 됐다 (관측 "+J(B.fa.cds)+")");
    ok(T.SKILLS.reaper_scythe.cd===0&&T.reaperWhy("A")!==null&&T.slotUsable(B.fa,3,"A")===false,"E3e 쿨링수로 쿨을 0 으로 만든 뒤에도 5라운드에서는 **여전히 봉인** — 게이트가 CD 와 분리 (조기 해제 불가)");
    /* 코어 거부까지: 실제 적용 경로로 불러도 즉사가 나가지 않는다 */
    const aliveE=P.em.alive, hpE=B.fd.hp;
    T.execSlot("A",3); T.drain(20000);
    const blogE=B.blog.join("|");
    ok(P.em.alive===aliveE&&!/즉사/.test(blogE),"E3e2 봉인 중 실제 호출도 즉사하지 않는다 (기본 공격 폴백)");
    ok(!/사신의 낫/.test(blogE),"E3e2' 봉인 거부가 공용 로그에 기술 이름을 남기지 않는다");
    /* 즉사: 보호막 무시 · VIP 면역 예외 없음 — E3e 에서 전투를 다시 열었으므로 **현재 전투 객체를 다시 잡는다** */
    openBattle(T,P.me,P.em);
    const B6=T.S.battle;
    B6.round=6; B6.fa.hp=30; B6.fd.hp=80; B6.fd.shield=500; B6.fa.cds=[0,0,0,0];
    const over0=T.S.phase;
    ok(actAsA(T),"E3f0 전제: 공격측 행동 차례 (라운드 6 · phase "+B6.phase+")");
    ok(T.reaperWhy("A")===null&&T.slotUsable(B6.fa,3,"A")===true,"E3f0' 전제: 합법 (봉인 해제 · 쿨 0)");
    T.execSlot("A",3); T.drain(5000);
    ok(P.em.alive===false,"E3f 보호막 500 을 무시하고 상대 즉사 (대상 제거)");
    ok(over0==="play","E3g 전제: 실행 전 플레이 상태");
  }
  /* E3h #146 (v0.4.7 CJ 2026-09-10): #121 계약 5.3 의 "전 슬롯 불가 → 기본 공격 폴백"은 **철회**됐다.
     4슬롯이 전부 쿨·봉인·조건 미충족이면 어떤 공격도 제공하지 않고 안내 + 수동 [턴 종료]만 나온다. */
  {
    const P=setup(T); fixed(T); giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills=["fire_stable","fire_effect","sup_heal","reaper_scythe"]; giveSpecies(T,P.em,R(T,"M-G1"));
    openBattle(T,P.me,P.em); const B=T.S.battle; B.round=2; B.fa.cds=[1,1,1,0]; B.fa.hp=100; B.fd.hp=100;
    ok(actAsA(T),"E3h0 전제: 공격측 행동 차례");
    T.battleModal();
    ok(!/__act\('basic'\)/.test(ob(T))&&!/기본 공격 \d+~\d+/.test(ob(T)),"E3h 3슬롯 쿨 + 사신 봉인 → 기본 공격 버튼이 없다 (#146 폴백 철회)");
    ok(ob(T).indexOf(T.NO_ATTACK_MSG)>=0&&ob(T).indexOf("__pass()")>=0,"E3h2 안내 문구 + 수동 [턴 종료] 버튼만 나온다");
    ok(/🎒 가방/.test(ob(T))&&/🔴 포획/.test(ob(T))&&/🏃 도망가기/.test(ob(T)),"E3h3 가방·포획·도망 메뉴는 그대로 쓸 수 있다");
    ok(!T.slotUsable(B.fa,3,"A"),"E3i 사신 슬롯은 쿨 0 이어도 합법이 아니다");
    /* 불법 슬롯을 강제로 보내도 즉사가 새지 않고, **합법 슬롯이 하나도 없으므로 기본 공격으로도 떨어지지 않는다**.
       규칙 상태는 그대로이고 화면만 다시 그려져 [턴 종료] 선택지가 남는다 (버튼을 누르기 전에는 강제 진행 없음). */
    const hp0=B.fd.hp, ph0=B.phase, rd0=B.round;
    T.execSlot("A",3); T.drain(5000);
    ok(B.fd&&B.fd.hp===hp0&&P.em.alive===true,"E3j 불법 사신 호출: 즉사도 기본 공격도 없다 (상대 HP 무변화)");
    ok(T.S.battle===B&&B.phase===ph0&&B.round===rd0,"E3j2 전투 행동도 소모되지 않는다 (phase·round 무변화)");
    /* 수동 [턴 종료] 를 누르면 그때 자기 전투 행동 1회만 넘어간다 */
    const bu0=T.S.battlesUsed, main0=T.S.mainUsed, wk0=B.fa.weaken;
    T.__passCore(); T.drain(5000);
    ok(B.phase!==ph0||B.round!==rd0,"E3j3 [턴 종료]를 누르면 자기 전투 행동 1회가 넘어간다 (nextPhase)");
    ok(T.S.battlesUsed===bu0&&T.S.mainUsed===main0&&B.fa.weaken===wk0,"E3j4 보드 주 행동·턴당 전투 횟수·약화 잔여 횟수는 소모되지 않는다");
  }
  T.S.battle=null; T.close(); fixed(T); T.setSeed(null);
}

/* ===== F. 계약 6·10 — 숲 포획 + 온라인 2인스턴스 락스텝 ================= */
function mkNet(me){ const X=load(); const P=setup(X,"pvp"); giveSpecies(X,P.me,R(X,"M-F1")); giveSpecies(X,P.em,R(X,"M-W1"));
  for(const m of X.rosterMinions(0)) { giveSpecies(X,m,R(X,"M-F1")); m.alive=true; m.placed=true; }
  X.NET.mode=true; X.NET.me=me; X.NET.started=true;
  const ws=new X.WebSocketCtor("ws://127.0.0.1:8080/",[X.NET_PROTOCOL_MARKER,"qa-121-code"]); ws.readyState=1; X.NET.ws=ws; return {T:X,P,ws}; }
const lastFrame=X=>JSON.parse(X.ws.sent[X.ws.sent.length-1]);
const recv=(X,a)=>{ X.T.NET.queue.push(a); X.T.netPump(); };
const netState=X=>J({sk:X.T.rosterMinions(0).map(m=>m.skills),cds:X.T.rosterMinions(0).map(m=>m.cds),
  rev:X.T.rosterMinions(0).map(m=>m.revealedSkills),pkg:X.T.S.pkgs,balls:X.T.S.balls,inv:X.T.S.inv,
  cap:X.T.S.pieces.filter(p=>p.cap).map(p=>[p.id,p.cap.rosterId]),seq:X.T.NET.modalSeq,
  sync:X.T.NET.syncModal?X.T.NET.syncModal.seq:null,ev:X.T.S.events[0]&&X.T.S.events[0].consumed,main:X.T.S.mainUsed,hidden:hidden(X.T)});
{
  // F1 숲 포획 기본 계약
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1")); T.S.balls[0]=5;
  P.ally0.cap=null; P.k0.cap=null;
  ok(T.capReceivers(0).length>=1&&T.capReceivers(0).every(x=>(x.type==="ally"||x.type==="king")&&!x.cap),"F1 수령 후보 = 살아 있는 동료·왕 중 cap 빈 말");
  searchAt(T,P.me); click(T,"🔴 하수인 포획");
  ok(/받을 말/.test(ob(T)),"F1b 수령 말 선택 단계");
  const recv0=T.capReceivers(0)[0];
  click(T,"1. "+T.TYPE_KO[recv0.type]);
  const sp=T.ROSTER.find(r=>r.id===T.S.recruit.species);
  ok(/발견: /.test(ob(T))&&ob(T).includes(sp.name),"F1c 포획 방법 단계에 후보 종이 표시된다 ("+sp.name+")");
  ok(has(T,"안전 포획 (볼 2)")&&has(T,"위험 포획 (볼 1)")&&has(T,"공격 포획 (볼 1)"),"F1d 세 방법 제시");
  const b0=T.S.balls[0];
  click(T,"안전 포획 (볼 2)");
  ok(recv0.cap&&recv0.cap.rosterId===sp.id&&recv0.cap.hp===sp.hp&&recv0.cap.atk===sp.atk&&J(recv0.cap.skills)===J(T.archSkills(sp.arch,sp.element)),"F1e 수령 말이 그 종 그대로 받는다 (HP "+sp.hp+"·ATK "+sp.atk+"·4기술)");
  ok(T.S.balls[0]===b0-2,"F1f 안전 포획 비용 볼 2");
  ok(T.archOf(recv0.cap)===sp.arch,"F1g archOf(cap)=그 종의 아키타입 — 기술 실제 동작 보존 (계약 6 '그 종 그대로')");
  // F2 공격 포획 실패 반동은 탐색 말 (수령 말이 아니다)
  {
    const Q=setup(T); giveSpecies(T,Q.me,R(T,"M-F1")); Q.me.hp=Q.me.maxHp; Q.ally0.cap=null; Q.k0.cap=null; T.S.balls[0]=5;
    let got=null;
    for(let s=1;s<=200&&!got;s++){
      Q.me.hp=Q.me.maxHp; Q.ally0.cap=null; T.S.balls[0]=5;
      T.setSeed(s); searchAt(T,Q.me); click(T,"🔴 하수인 포획");
      const rc=T.capReceivers(0); const idx=rc.findIndex(x=>x.id===Q.ally0.id);
      if(idx<0){ T.close(); continue; }
      click(T,(idx+1)+". "+T.TYPE_KO[Q.ally0.type]);
      const hpBefore=Q.me.hp, recvHp=Q.ally0.hp;
      click(T,"공격 포획 (볼 1)");
      if(!Q.ally0.cap) got={dmg:hpBefore-Q.me.hp,recvSame:Q.ally0.hp===recvHp};
    }
    ok(got&&got.dmg===Math.round(Q.me.maxHp*T.BAL.captureAtkFailPct),"F2 공격 포획 실패 반동 = 탐색 말 최대 HP 25% ("+(got&&got.dmg)+")");
    ok(got&&got.recvSame,"F2b 수령 말은 피해를 받지 않는다");
  }
  // F3 온라인 2인스턴스 — 단일 송신·단일 적용·양측 동일
  const A=mkNet(0), Bn=mkNet(1);
  for(const X of [A,Bn]){ X.T.setSeed(2026); for(const m of X.T.rosterMinions(0)) m.cds=[2,1,3,0]; X.P.me.revealedSkills=[0,1]; }
  const s0=A.ws.sent.length;
  searchAt(A.T,A.P.me);
  ok(A.ws.sent.length===s0+1&&J(lastFrame(A))===J({t:"a",a:{t:"search"}}),"F3 탐색은 기존 search 락스텝 액션 1프레임만 송신 (신규 메시지 없음)");
  Bn.T.S.current=0; Bn.T.S.mainUsed=false; Bn.T.S.events=[{r:Bn.P.me.r,c:Bn.P.me.c,kind:"recruit",consumed:false}]; Bn.T.S.traces[0].add(Bn.P.me.r+"_"+Bn.P.me.c); Bn.T.S.selected=Bn.P.me;
  const b1=Bn.ws.sent.length; recv(Bn,lastFrame(A).a);
  ok(A.T.NET.syncModal&&A.T.NET.syncModal.seq===1&&A.T.NET.syncModal.owner===0&&/기술 교체/.test(ob(A.T)),"F3b 1P(소유자): 선택 화면·seq 1");
  ok(Bn.T.NET.syncModal&&Bn.T.NET.syncModal.seq===1&&/상대 선택 대기/.test(ob(Bn.T))&&!/기술 교체/.test(ob(Bn.T))&&Bn.ws.sent.length===b1,"F3c 2P(비소유자): 같은 seq·대기 화면·원문 없음·송신 0");
  ok(Bn.T.MEMO_UI.overlayOpen===true&&Bn.T.MEMO_UI.token===null&&(Bn.T.byId("obBtns").children||[]).length===0,"F3d 2P 잠금 화면도 코어 modal() 을 지나간다 (#94 소유권 유지·버튼 0)");
  // 단계마다: 1프레임씩만 송신되고 양측이 같은 상태가 된다
  const step=(txt,expSeq,expI)=>{ const n0=A.ws.sent.length; click(A.T,txt);
    const sent=A.ws.sent.length-n0, fr=lastFrame(A); recv(Bn,fr.a); return {sent,fr,expSeq,expI}; };
  let r=step("📘 기술 교체",1,0);
  ok(r.sent===1&&J(r.fr.a)===J({t:"modal",seq:1,i:0}),"F4 선택은 modal 동기화 프레임 **1개만** 송신 — semantic 액션 중복 송신 없음 (단일 전송)");
  ok(netState(A)===netState(Bn),"F4b 1단계 뒤 양측 상태 동일");
  r=step("1. 드래곤 숨결",2,0);
  ok(r.sent===1&&r.fr.a.t==="modal"&&netState(A)===netState(Bn),"F5 기술 선택: 1프레임·양측 동일 (seq "+r.fr.a.seq+")");
  const tgt=A.T.rosterMinions(0)[0];
  r=step("1. "+(tgt.name||"하수인"),3,0);
  ok(r.sent===1&&netState(A)===netState(Bn),"F6 대상 선택: 1프레임·양측 동일");
  r=step("슬롯 3 교체 ("+A.T.SKILLS[tgt.skills[2]].ko+")",4,2);
  ok(r.sent===1,"F7 슬롯 확정: 1프레임");
  ok(netState(A)===netState(Bn),"F7b 확정 뒤 양측 skills·cds·공개 기록·패키지·볼·가방이 모두 동일");
  ok(A.T.rosterMinions(0)[0].skills[2]==="dragon_breath"&&Bn.T.rosterMinions(0)[0].skills[2]==="dragon_breath","F7c 양측 모두 슬롯3 이 교체됐다 (이중 적용으로 엉키지 않음)");
  ok(J(A.T.rosterMinions(0)[0].cds)===J([2,1,3,0]),"F7d 쿨 승계 (양측)");
  ok(A.T.rand()===Bn.T.rand(),"F8 양측 공유 난수 상태 동일");
  // F9 음성 대조: 2P 가 프레임을 재생하지 않으면 검사기가 불일치를 잡는다
  const A2=mkNet(0), B2=mkNet(1); for(const X of [A2,B2]) X.T.setSeed(2027);
  searchAt(A2.T,A2.P.me); B2.T.S.current=0; B2.T.S.mainUsed=false; B2.T.S.events=[{r:B2.P.me.r,c:B2.P.me.c,kind:"recruit",consumed:false}]; B2.T.S.traces[0].add(B2.P.me.r+"_"+B2.P.me.c); B2.T.S.selected=B2.P.me;
  recv(B2,lastFrame(A2).a);
  click(A2.T,"📘 기술 교체"); click(A2.T,"1. 드래곤 숨결");
  ok(netState(A2)!==netState(B2),"F9 [음성] 선택 프레임을 재생하지 않은 2P 는 상태가 달라 검사기가 잡는다");
  for(const fr of A2.ws.sent.slice(1).map(x=>JSON.parse(x).a)) recv(B2,fr);
  ok(netState(A2)===netState(B2),"F9b 프레임을 모두 재생하면 다시 일치");
  // F10 전투 중 패키지 개봉도 같은 단일 경로
  {
    const A3=mkNet(0), B3=mkNet(1);
    for(const X of [A3,B3]){ X.T.S.pkgs[0]={itemGift:1,battleBuff:1}; X.T.S.inv[0]=[]; openBattle(X.T,X.P.me,X.P.em); }
    const n0=A3.ws.sent.length;
    A3.T.byId("obBtns").children.length=0; B3.T.byId("obBtns").children.length=0;
    A3.T.__openPkg("itemGift");
    ok(A3.ws.sent.length===n0+1&&J(lastFrame(A3).a)===J({t:"pkgOpen",kind:"itemGift"}),"F10 전투 중 개봉 화면 열기는 pkgOpen semantic 액션 1프레임 (전투 모달은 buttons 가 없어 중계가 없다)");
    recv(B3,lastFrame(A3).a);
    ok(/아이템 선물 패키지/.test(ob(A3.T))&&/상대 선택 대기/.test(ob(B3.T)),"F10b 1P 는 개봉 화면, 2P 는 대기 화면");
    const n1=A3.ws.sent.length; click(A3.T,"회복약");
    ok(A3.ws.sent.length===n1+1&&lastFrame(A3).a.t==="modal","F10c 개봉 확정은 modal 프레임 1개만 (pkgPick semantic 중복 없음)");
    recv(B3,lastFrame(A3).a);
    ok(J(A3.T.S.inv[0])===J(["potion"])&&J(B3.T.S.inv[0])===J(["potion"])&&A3.T.S.pkgs[0].itemGift===0&&B3.T.S.pkgs[0].itemGift===0,"F10d 양측 재고가 한 번만 움직인다 (이중 적용 없음)");
    A3.T.TQ.length=0; B3.T.TQ.length=0;
  }
  // ===== G. 정보 경계 — 2P 인스턴스 DOM·로그 =====
  {
    const A4=mkNet(0), B4=mkNet(1);
    for(const X of [A4,B4]) X.T.setSeed(31);
    searchAt(A4.T,A4.P.me);
    B4.T.S.current=0; B4.T.S.mainUsed=false; B4.T.S.events=[{r:B4.P.me.r,c:B4.P.me.c,kind:"recruit",consumed:false}]; B4.T.S.traces[0].add(B4.P.me.r+"_"+B4.P.me.c); B4.T.S.selected=B4.P.me;
    recv(B4,lastFrame(A4).a);
    const spcs=A4.T.ROSTER.find(x=>x.id===A4.T.S.recruit.species);
    for(const fr of [["📘 기술 교체"],["2. 마녀의 장난"],["1. "+(A4.T.rosterMinions(0)[0].name||"하수인")],["슬롯 1 교체 ("+A4.T.SKILLS[A4.T.rosterMinions(0)[0].skills[0]].ko+")"]]){
      click(A4.T,fr[0]); recv(B4,lastFrame(A4).a); }
    B4.T.S.battle=null; B4.T.S.current=1; B4.T.S.selected=null; B4.T.render();
    const leaks=[];
    for(const [id,el] of Object.entries(B4.T.els)){
      const txt=(el._html||"")+"|"+(el.textContent||"")+"|"+Object.values(el._attrs||{}).join("|");
      if(/마녀의 장난|드래곤 숨결|사신의 낫|슬롯 1 교체|기술 교체/.test(txt)) leaks.push(id);
      if(spcs&&txt.includes(spcs.name)&&id!=="rosterBox") leaks.push(id+"(species)");
    }
    ok(leaks.length===0,"G1 2P DOM(모든 요소 innerHTML·text·속성)에 1P 의 선택·기술·후보 종 표시 없음"+(leaks.length?" — "+leaks.join(","):""));
    ok(!B4.T.S.log.some(l=>/마녀|드래곤|사신|슬롯|교체|포획 성공/.test(l.msg)),"G2 2P 보드 로그에도 선택 정보 없음 (generic 만)");
    ok(B4.T.rosterMinions(0)[0].skills[0]==="witch_prank","G2b 규칙 상태는 양측 동일 (표시만 가려진다)");
    // 전투 패키지 개봉: 전투 로그(blog)에 종류가 남지 않는다
    for(const X of [A4,B4]){ X.T.S.pkgs[0]={itemGift:1,battleBuff:0}; X.T.S.inv[0]=[]; openBattle(X.T,X.P.me,X.P.em); X.T.byId("obBtns").children.length=0; }
    A4.T.__openPkg("itemGift"); recv(B4,lastFrame(A4).a); click(A4.T,"해독제"); recv(B4,lastFrame(A4).a);
    const blogA=A4.T.S.battle?A4.T.S.battle.blog.join("|"):"", blogB=B4.T.S.battle?B4.T.S.battle.blog.join("|"):"";
    /* 전투 로그 문장은 **시점별 거울 표기**를 쓴다 — pname() 이 온라인에서 "나(P1)/상대(P1)" 로 갈린다(#106 4.7, 기존 계약).
       그래서 "문자열이 글자까지 같다"가 아니라 **거울 표기를 정규화하면 같다** 를 본다: 줄 수·구조·내용이 같고
       달라지는 것은 누가 보는가에 따른 호칭뿐이다. */
    const norm=t=>t.replace(/나\(P\d\)/g,"«행동자»").replace(/상대\(P\d\)/g,"«행동자»");
    if(norm(blogA)!==norm(blogB)){ console.error("G3 diag A:",blogA); console.error("G3 diag B:",blogB); }
    ok(norm(blogA)===norm(blogB)&&blogA.split("|").length===blogB.split("|").length,"G3 전투 로그는 거울 표기를 빼면 양측 동일 (공유 상태 · "+blogA.split("|").length+"줄)");
    ok(!/해독제|회복약|쿨링수|몬스터볼/.test(blogA)&&/선물 상자를 열었다/.test(blogA),"G3b 개봉한 **종류**는 전투 로그에 남지 않는다 — 중립 문구만 (계약 3.1·10: 실제 사용 효과만 공개)");
    ok(J(A4.T.S.inv[0])===J(["cure"]),"G3c 실제 획득은 소유자 재고에 정확히 반영");
    A4.T.TQ.length=0; B4.T.TQ.length=0;
  }
  A.T.TQ.length=0; Bn.T.TQ.length=0; A2.T.TQ.length=0; B2.T.TQ.length=0;
  T.setSeed(null);
}

/* ===== H. 계약 7 (#129) — 탐색 완료 후 턴 종료 ========================= */
{
  const X=load();
  X.BAL.fx.autoEnd=true; // 하네스 기본은 off — 이 절은 자동 종료를 명시적으로 켜서 검증한다
  X.tutSkip(); // 튜토리얼이 열려 있으면 autoEndReady() 가 null 이다 (기존 계약) — 이 절의 전제를 맞춘다
  const P=setup(X); giveSpecies(X,P.me,R(X,"M-F1"));
  /* setup 은 상대 하수인을 내 말 옆(11,4)에 둔다 → **선택 전투가 남아** autoEndReady() 가 null 이다.
     H1~H4 는 "선택 전투가 없을 때 정확히 한 번 종료"를 보는 절이므로 상대를 멀리 떼어 놓는다.
     선택 전투가 남는 경우는 H5 가 따로 검사한다. */
  H.place(X,P.em,3,1);
  ok(!X.optionalBattleLeft(),"H0 전제: 선택 전투가 남아 있지 않다");
  X.byId("overlay").classList.add("hidden");
  const turn0=()=>X.S.turnCount;
  /* H1 단순 획득: **추가 확인 클릭을 요구하지 않는다.**
     종료까지 한 번에 이어지면 다음 턴의 핫시트 인계 모달이 열려 overlay 가 다시 보이므로, 이 단언만 autoEnd 를 잠시 끄고
     "획득 자체가 모달을 띄우지 않는다"를 본다. 종료는 바로 아래 H1b·H1c 가 autoEnd 를 켠 상태로 검사한다. */
  X.BAL.fx.autoEnd=false;
  searchAt(X,P.me,"itemGift");
  ok(hidden(X)&&X.S.pkgs[0].itemGift>=1,"H1 단순 획득은 확인 클릭을 요구하지 않는다 (모달 없이 재고 +1)");
  X.drain(20000);
  ok(X.S.turnCount===0,"H1' autoEnd 가 꺼진 환경에서는 종전처럼 자동 종료하지 않는다 (기존 회귀 호환)");
  X.BAL.fx.autoEnd=true;
  X.S.current=0; const t0=turn0(); const ends0=X.S.metrics.autoEnds;
  searchAt(X,P.me,"itemGift");
  X.drain(20000);
  ok(X.S.turnCount===t0+1,"H1b 결과 연출 끝점에서 턴이 종료된다 (턴 "+t0+" → "+X.S.turnCount+")");
  ok(X.S.metrics.autoEnds===ends0+1,"H1c 자동 종료 지표가 정확히 1 증가 (이중 종료 없음)");
  // H2 포기 경로도 같다
  X.S.current=0; const t1=turn0(); const e1=X.S.metrics.autoEnds;
  searchAt(X,P.me,"recruit"); click(X,"포기"); X.drain(20000);
  ok(X.S.turnCount===t1+1&&X.S.metrics.autoEnds===e1+1,"H2 포기도 결과 연출 뒤 정확히 한 번 종료");
  // H3 기술 교체 확정 경로
  X.S.current=0; const t2=turn0(), e2=X.S.metrics.autoEnds;
  for(const m of X.rosterMinions(0)){ giveSpecies(X,m,R(X,"M-F1")); m.alive=true; m.placed=true; }
  searchAt(X,P.me,"recruit"); swapSkill(X,X.rosterMinions(0)[0],0,0); X.drain(20000);
  ok(X.S.turnCount===t2+1&&X.S.metrics.autoEnds===e2+1,"H3 기술 교체 확정 뒤 정확히 한 번 종료");
  // H4 필수 선택 중에는 종료하지 않는다
  X.S.current=0; const t3=turn0();
  searchAt(X,P.me,"recruit"); X.drain(20000);
  ok(X.S.turnCount===t3&&!hidden(X),"H4 선택 화면이 열려 있는 동안에는 턴이 종료되지 않는다 (필수 선택 대기)");
  click(X,"포기"); X.drain(20000);
  ok(X.S.turnCount===t3+1,"H4b 선택을 마치면 종료된다");
  // H5 남은 선택 전투가 있으면 종료하지 않는다
  {
    const Y=load(); Y.BAL.fx.autoEnd=true; Y.tutSkip();
    const Q=setup(Y); giveSpecies(Y,Q.me,R(Y,"M-F1")); giveSpecies(Y,Q.em,R(Y,"M-W1"));
    Y.byId("overlay").classList.add("hidden");
    H.place(Y,Q.me,10,4); H.place(Y,Q.em,9,4); // 인접 → 선택 전투 가능
    Y.S.events=[{r:10,c:4,kind:"itemGift",consumed:false}]; Y.S.traces[0].add("10_4");
    Y.S.current=0; Y.S.mainUsed=false; Y.S.battlesUsed=0; Y.S.selected=Q.me;
    const t=Y.S.turnCount;
    ok(Y.optionalBattleLeft(),"H5 전제: 선택 전투가 남아 있다");
    Y.netAction({t:"search"}); Y.drain(20000);
    ok(Y.S.turnCount===t,"H5b 선택 전투가 남으면 탐색 완료 뒤에도 종료하지 않는다 (계약 7-4)");
    ok(Y.S.mainUsed===true&&Y.S.events[0].consumed,"H5c 주 행동·이벤트는 소모된 상태 유지");
    Y.TQ.length=0;
  }
  // H6 늦은 콜백 가드: 새 게임·턴 교대 뒤 옛 완료 콜백이 종료를 일으키지 않는다
  {
    const Z=load(); Z.BAL.fx.autoEnd=true; Z.tutSkip();
    const Q=setup(Z); giveSpecies(Z,Q.me,R(Z,"M-F1")); Z.byId("overlay").classList.add("hidden");
    Z.S.events=[{r:Q.me.r,c:Q.me.c,kind:"itemGift",consumed:false}]; Z.S.traces[0].add(Q.me.r+"_"+Q.me.c);
    Z.S.current=0; Z.S.mainUsed=false; Z.S.selected=Q.me;
    Z.FX.force=true; // 연출 시간을 켜서 완료 콜백을 대기 상태로 만든다
    Z.netAction({t:"search"});
    const pending=Z.TQ.splice(0);
    ok(pending.length>0,"H6 전제: 결과 연출 타이머가 대기 중");
    setupNewGame(Z);
    Z.TQ.push(...pending); Z.drain(20000);
    ok(Z.S.turnCount===0&&Z.S.metrics.autoEnds===0,"H6b 새 게임 뒤 옛 탐색 완료 콜백은 턴을 종료하지 않는다 (세대·게임 토큰)");
    Z.TQ.length=0;
  }
  // H7 전역 autoEndGrace 는 그대로 남는다 (다른 경로용)
  ok(T.BAL.fx.autoEndGrace===1000,"H7 전역 autoEndGrace 1000ms 보존 (계약 7 금지 사항)");
  X.TQ.length=0;
}
function setupNewGame(X){ X.newGame("pvp"); X.aiAutoPlace(0); X.aiAutoPlace(1); X.S.phase="play"; X.S.current=0; }

/* ===== I. 계약 9·10 — AI 수용·완주 ==================================== */
{
  // I1 AI 탐색: 두 난이도 모두 합법 선택만, 같은 시드 같은 결과
  for(const lv of ["grade5","dan5"]){
    const X=load();
    let det=true, resolved=0, illegal=0;
    for(let s=1;s<=40;s++){
      const run=()=>{ const P=setup(X,"sim",[lv,lv]);
        H.freshPlay(X,"sim",[lv,lv]); H.clearBoard(X);
        const me=X.S.pieces.find(x=>x.owner===0&&x.type==="minion");
        const k0=X.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=X.S.pieces.find(x=>x.owner===1&&x.type==="king");
        const al=X.S.pieces.filter(x=>x.owner===0&&x.type==="ally")[0];
        for(const m of X.S.pieces.filter(x=>x.owner===0&&x.type==="minion")) { giveSpecies(X,m,R(X,"M-F1")); m.alive=true; m.placed=true; m.r=12; m.c=1+X.S.pieces.filter(y=>y.owner===0&&y.type==="minion").indexOf(m); }
        H.place(X,k0,13,1); H.place(X,k1,1,7); H.place(X,al,13,3); H.place(X,me,9,3);
        X.S.balls=[3,3]; X.S.reserve=[null,null];
        X.S.events=[{r:9,c:3,kind:"recruit",consumed:false}]; X.S.traces[0].add("9_3");
        X.S.current=0; X.S.mainUsed=false; X.S.selected=me;
        X.setSeed(s); X.doSearch(me,X.S.events[0]); X.drain(20000);
        return {sk:X.S.pieces.filter(x=>x.owner===0&&x.type==="minion").map(m=>m.skills.join(",")),
                cap:X.S.pieces.filter(p=>p.cap).map(p=>p.cap.rosterId),balls:X.S.balls[0],rec:!!X.S.recruit}; };
      const a=run(), b=run();
      if(J(a)!==J(b)) det=false;
      if(a.rec) illegal++;                                  // 선택 상태가 남아 있으면 미해결
      if(a.sk.some(x=>/dragon_breath|witch_prank|reaper_scythe/.test(x))||a.cap.length) resolved++;
      // 불법: 같은 말에 같은 기술 두 번
      for(const s2 of a.sk){ const arr=s2.split(","); if(new Set(arr).size!==arr.length) illegal++; }
    }
    ok(det,"I1 AI("+lv+") 탐색 40시드: 같은 시드 같은 결과 (결정론)");
    ok(illegal===0,"I1b AI("+lv+") 불법 선택 0 (중복 장착·미해결 선택 상태 없음)");
    ok(resolved>0,"I1c AI("+lv+") 가 실제로 기술 교체 또는 포획을 수행한다 ("+resolved+"/40)");
    X.TQ.length=0;
  }
  /* I2 AI 전투 중 패키지 — 무한 무료 행동 루프가 없고, AI 차례마다 실제로 진행된다.
     **양측이 AI 인 sim** 으로 돌린다: PVE 는 방어측이 사람이라 그 차례에 aiBattleAction() 이 (규칙대로) 아무것도 하지 않으며,
     그것을 "정지"로 읽으면 검사가 거짓 실패한다. 사람 차례 무동작은 I2d 에서 따로 단언한다. */
  {
    const X=load(); fixed(X);
    const P=setup(X,"sim"); giveSpecies(X,P.me,R(X,"M-F1")); giveSpecies(X,P.em,R(X,"M-W1"));
    X.S.pkgs[0]={itemGift:3,battleBuff:3}; X.S.pkgs[1]={itemGift:3,battleBuff:3};
    X.S.current=1; openBattle(X,P.em,P.me);
    /* 종전 검사는 "상태가 안 바뀌면 break" 하고 steps<cap 만 보아 **AI 가 정지해도 PASS** 했다.
       이제 정지(진행 없음)를 명시적으로 stalled 로 기록하고, 전투가 실제로 **종결**됐거나 최소한 라운드가 진행됐는지 단언한다. */
    let steps=0, stalled=-1; const cap=400;
    const snap=()=>J([X.S.pkgs,X.S.battle&&X.S.battle.round,X.S.battle&&X.S.battle.phase,
      X.S.battle&&X.S.battle.fa.hp,X.S.battle&&X.S.battle.fd.hp,X.S.inv.map(v=>v.length),
      X.S.battle&&X.S.battle.buffA,X.S.battle&&X.S.battle.buffD,X.S.battle&&X.S.battle.itemRoundA,X.S.battle&&X.S.battle.itemRoundD]);
    const round0=X.S.battle.round;
    while(X.S.battle&&steps<cap){
      const before=snap();
      X.aiBattleAction(); X.drain(20000); steps++;
      if(X.S.battle&&snap()===before){ stalled=steps; break; }   // AI 차례인데 아무것도 진행되지 않았다 = 정지
    }
    ok(stalled<0,"I2 AI 전투 행동이 **정지하지 않는다** — 양측 AI(sim)에서 매 호출이 상태를 진행시킨다 ("+steps+"스텝"+(stalled>0?" · "+stalled+"번째에서 정지":"")+")");
    ok(steps<cap,"I2a 무한 무료 행동 루프가 없다 (스텝 예산 "+cap+" 안 · 실제 "+steps+")");
    const ended=X.S.battle===null, advanced=!!X.S.battle&&X.S.battle.round>round0;
    ok(ended||advanced,"I2b 전투가 **실제로 종결**되거나 라운드가 진행됐다 (종결="+ended+" · 라운드 "+round0+"→"+(X.S.battle?X.S.battle.round:"-")+")");
    const used=(3-X.S.pkgs[0].battleBuff)+(3-X.S.pkgs[1].battleBuff)+(3-X.S.pkgs[0].itemGift)+(3-X.S.pkgs[1].itemGift);
    ok(used>0,"I2c AI 가 실제로 패키지를 쓴다 (소모 합계 "+used+"개)");
    /* I2d PVE: 사람 차례에는 AI 가 움직이지 않는다 (위 정지 판정이 이 규칙을 오해하지 않게 명시적으로 고정) */
    {
      const Y=load(); fixed(Y);
      const Q=setup(Y,"pve"); giveSpecies(Y,Q.me,R(Y,"M-F1")); giveSpecies(Y,Q.em,R(Y,"M-W1"));
      Y.S.current=0; openBattle(Y,Q.me,Q.em);                  // 공격자 = 사람(0)
      ok(Y.actorOfPhase()==="A"&&Y.S.battle.attP.owner===0,"I2d 전제: PVE 에서 사람(0) 차례");
      const before=J([Y.S.battle.round,Y.S.battle.phase,Y.S.battle.fa.hp,Y.S.battle.fd.hp]);
      Y.aiBattleAction(); Y.drain(20000);
      ok(Y.S.battle&&J([Y.S.battle.round,Y.S.battle.phase,Y.S.battle.fa.hp,Y.S.battle.fd.hp])===before,
         "I2d 사람 차례에 AI 전투 행동은 아무것도 하지 않는다 (규칙 — 정지가 아니다)");
      Y.TQ.length=0;
    }
    X.TQ.length=0;
  }
  // I3 AI vs AI 완주 — recruit 만 있는 판 포함
  {
    const X=load();
    let done=0, viol=0, learned=0, detail=[];
    for(const [lv,seed] of [[["grade5","grade5"],12101],[["grade5","dan5"],12102],[["dan5","dan5"],12103]]){
      X.setSeed(seed); X.TQ.length=0; X.startMode("sim",{aiLevel:lv});
      for(const e of X.S.events) e.kind="recruit"; // 6칸 전부 recruit — 새 선택 경로를 최대한 태운다
      let n=0; while(X.TQ.length&&n<3000000){ X.TQ.shift()(); n++;
        if(n%50===0){ const v=H.invariants(X); if(v.length){ viol++; detail.push(v.join(",")); break; } } }
      if(X.S.phase==="over") done++;
      detail.push(lv.join("/")+"#"+seed+":"+X.S.phase+"/"+X.S.turnCount+"턴");
      for(const p of X.S.pieces) if(p.skills&&p.skills.some(k=>X.NEW_SKILLS.includes(k))) learned++;
    }
    ok(done===3&&viol===0,"I3 recruit 만 있는 판 3경기(5급·5단) 완주·불변식 위반 0 ("+detail.join(" · ")+")");
    ok(learned>0,"I3b 완주한 경기에서 AI 하수인이 실제로 신규 기술을 배웠다 ("+learned+"기)");
    X.TQ.length=0; X.setSeed(null);
  }
  // I4 패키지가 있는 일반 판도 완주한다
  {
    const X=load();
    const r=H.runSim(X,["grade5","dan5"],9911,{check:100,cap:3000000});
    ok(r.phase==="over"&&r.viol.length===0,"I4 기본 배치(3종 혼합) AI vs AI 완주·불변식 0 (턴 "+r.turns+"·스텝 "+r.steps+")");
    X.TQ.length=0;
  }
}

/* ===== J. Saturn 독립 QA REVISE 4건 — 승인 AC 누락 수정의 회귀 (msg_0e91b5b70bcf) ===== */
{
  /* J1 (P1) 사신의 낫: 봉인 해제만으로는 안 되고 **실제 쿨**과 **자기 차례**까지 만족해야 한다.
     Saturn 재현: cds=[2,2,2,2] 인데 즉사했고, 상대 차례에 호출해도 즉사했다. */
  const X=load(); fixed(X); X.tutSkip();
  const Q=setup(X); giveSpecies(X,Q.me,R(X,"M-F1")); Q.me.skills[3]="reaper_scythe"; giveSpecies(X,Q.em,R(X,"M-G1"));
  openBattle(X,Q.me,Q.em); const B=X.S.battle;
  B.round=6; B.fa.hp=10; B.fd.hp=100; B.fd.shield=999; B.fa.cds=[2,2,2,2];
  ok(actAsA(X),"J1 전제: 라운드 6 · 공격측 차례 · HP 비율 열세 (봉인 조건은 충족)");
  ok(X.reaperWhy("A")===null,"J1a 봉인 게이트 자체는 열려 있다 (라운드·HP 비율 충족)");
  ok(X.slotUsable(B.fa,3,"A")===false,"J1b 그러나 쿨 2 라서 지금 쓸 수 있는 슬롯이 아니다");
  const alive0=Q.em.alive;
  X.netAction({t:"act",k:3}); X.drain(20000);
  const blog=B.blog.join("|");
  ok(Q.em.alive===alive0,"J1c **쿨 중에는 즉사하지 않는다** (실제 적용 경로 CD 가드 — Saturn P1)");
  ok(!/즉사/.test(blog),"J1c' 전투 로그에 즉사가 없다");
  ok(!/사신의 낫/.test(blog),"J1d 거부 사유가 **공용 전투 로그에 기술 이름을 남기지 않는다** (Saturn 추가 P1 — 쓰지 않은 미공개 기술 비노출)");
  /* #146: 폴백 기본 공격이 철회됐다. cds=[2,2,2,2] 라 합법 슬롯이 하나도 없으므로 불법 사신 호출은 **아무 행동도 만들지 않는다** */
  ok(!/기본 공격/.test(blog),"J1d2 합법 슬롯이 하나도 없으면 기본 공격으로도 떨어지지 않는다 (#146 폴백 철회)");
  ok(X.S.battle===B&&Q.em.alive===alive0&&B.fd.hp===100,"J1d3 규칙 상태가 그대로다 (상대 HP·생존 무변화)");
  ok(!B.fa.revealedSkills.includes(3),"J1d'' 쓰지 않은 사신 슬롯은 공개 기록에도 들어가지 않는다");
  /* 라운드 6 은 마지막 라운드라 양측 행동 뒤 판정으로 끝난다 — 멈추지 않고 적법하게 종결됐음을 본다 */
  ok(X.S.phase==="play"||X.S.phase==="over","J1d'' 전투가 적법하게 진행·종결됐다 (프리즈 없음 · phase "+X.S.phase+")");
  // 상대 차례에 호출 → 아무것도 일어나지 않는다
  {
    const Y=load(); fixed(Y); Y.tutSkip();
    const Q2=setup(Y); giveSpecies(Y,Q2.me,R(Y,"M-F1")); Q2.me.skills[3]="reaper_scythe"; giveSpecies(Y,Q2.em,R(Y,"M-G1"));
    openBattle(Y,Q2.me,Q2.em); const B2=Y.S.battle;
    B2.round=6; B2.fa.hp=10; B2.fd.hp=100; B2.fd.shield=999; B2.fa.cds=[0,0,0,0];
    actAsA(Y); Y.battleModal();                       // A 차례로 모달을 그려 __actCore 클로저를 A 로 만든다
    B2.phase=B2.phase===0?1:0;                        // 그 뒤 차례가 상대에게 넘어간 상황
    ok(Y.actorOfPhase()==="D","J1e 전제: 지금은 방어측 차례 (A 의 옛 모달 클로저가 남아 있다)");
    const snap=J([B2.fd.hp,B2.fd.shield,Q2.em.alive,B2.round,B2.phase]);
    Y.__actCore(3); Y.drain(20000);
    ok(J([B2.fd.hp,B2.fd.shield,Q2.em.alive,B2.round,B2.phase])===snap,"J1f **상대 차례에 옛 클로저로 호출해도 아무 일도 없다** (actor 가드 — Saturn P1)");
    ok(Y.S.battle===B2,"J1g 전투도 그대로 (다른 전투로 새지 않는다)");
    Y.TQ.length=0;
  }
  // 합법 조건(R6·쿨 0·자기 차례)에서는 그대로 즉사한다 — 가드가 기능을 죽이지 않았다
  {
    const Z=load(); fixed(Z); Z.tutSkip();
    const Q3=setup(Z); giveSpecies(Z,Q3.me,R(Z,"M-F1")); Q3.me.skills[3]="reaper_scythe"; giveSpecies(Z,Q3.em,R(Z,"M-G1"));
    openBattle(Z,Q3.me,Q3.em); const B3=Z.S.battle;
    B3.round=6; B3.fa.hp=10; B3.fd.hp=100; B3.fd.shield=999; B3.fa.cds=[0,0,0,0];
    actAsA(Z); Z.battleModal();
    ok(Z.slotUsable(B3.fa,3,"A")===true,"J1h 전제: 합법 (라운드 6 · 쿨 0 · 자기 차례 · HP 열세)");
    Z.__actCore(3); Z.drain(20000);
    ok(Q3.em.alive===false,"J1i 합법 조건에서는 보호막을 무시하고 즉사한다 — 가드가 기능을 죽이지 않았다");
    Z.TQ.length=0;
  }
  // 쿨 감소 수단으로 봉인이 풀리지 않는다 (계약 5.3) — CD 가드 추가와 양립한다
  {
    const W=load(); fixed(W); W.tutSkip();
    const Q4=setup(W); giveSpecies(W,Q4.me,R(W,"M-F1")); Q4.me.skills[3]="reaper_scythe"; giveSpecies(W,Q4.em,R(W,"M-G1"));
    openBattle(W,Q4.me,Q4.em); const B4=W.S.battle;
    B4.round=3; B4.fa.hp=10; B4.fd.hp=100; B4.fa.cds=[0,0,0,0]; actAsA(W);
    ok(W.reaperWhy("A")!==null&&W.slotUsable(B4.fa,3,"A")===false,"J1j 쿨이 0 이어도 3라운드에서는 봉인 — 쿨링수·냉각으로 조기 해제되지 않는다 (계약 5.3 보존)");
    W.TQ.length=0;
  }
  X.TQ.length=0;

  /* J2 (P1 비공개) 상대 자원 노출: 온라인 비소유자 화면과 **PVE 의 AI 차례** 화면 모두에서
     재고·볼 수·패키지 수가 보이지 않아야 한다. 종전 마스킹은 NET.mode 전용이라 PVE 가 뚫려 있었다. */
  {
    // (a) 온라인 비소유자
    const A=load(); fixed(A); A.tutSkip();
    const Qa=setup(A); giveSpecies(A,Qa.me,R(A,"M-F1")); giveSpecies(A,Qa.em,R(A,"M-W1"));
    A.S.balls[0]=47; A.S.pkgs[0]={itemGift:7,battleBuff:8}; A.S.inv[0]=["potion","cool","cure"];
    openBattle(A,Qa.me,Qa.em); actAsA(A);
    A.NET.mode=true; A.NET.me=1; A.NET.started=true;     // 나는 2P — 지금 행동자는 1P
    A.S.battle.menu="ball"; A.battleModal();
    const hb=ob(A);
    ok(!/47/.test(hb),"J2a 온라인 비소유자 화면에 상대 볼 보유 수(47)가 없다 (Saturn P1)");
    ok(!/🎁 아이템 선물 7/.test(hb)&&!/✨ 전투 버프 8/.test(hb),"J2b 비소유자 화면에 상대 패키지 재고(7·8)가 없다");
    ok(/상대 아이템 비공개/.test(hb)&&/상대 패키지 비공개/.test(hb),"J2c 대신 비공개 안내만 보인다");
    ok(!/회복약|쿨링수|해독제/.test(hb.replace(/title="[^"]*"/g,"")),"J2d 상대 아이템 종류도 보이지 않는다");
    A.NET.mode=false; A.NET.me=null; A.NET.started=false; A.TQ.length=0;
    // (b) PVE 의 AI 차례 — 사람 뷰어(0)는 AI(1) 의 자원을 볼 수 없다
    const Bv=load(); fixed(Bv); Bv.tutSkip();
    const Qb=setup(Bv,"pve"); giveSpecies(Bv,Qb.me,R(Bv,"M-F1")); giveSpecies(Bv,Qb.em,R(Bv,"M-W1"));
    Bv.S.balls[1]=47; Bv.S.pkgs[1]={itemGift:7,battleBuff:8}; Bv.S.inv[1]=["potion","cool","cure"];
    Bv.S.battle=null; Bv.S.battlesUsed=0; Bv.S.current=1;
    Bv.startRounds(Qb.em,Qb.me,Qb.em,Qb.me); Bv.TQ.length=0;   // 공격자 = AI
    Bv.S.battle.menu="ball"; Bv.battleModal();
    const pb=ob(Bv);
    ok(Bv.actorOfPhase()==="A"&&Bv.S.battle.attP.owner===1,"J2e 전제: PVE 에서 AI(1) 가 행동자");
    ok(!/47/.test(pb),"J2f PVE 에서도 AI 의 볼 보유 수가 사람 화면에 보이지 않는다 (Saturn P1 — 종전 NET.mode 전용 마스킹의 구멍)");
    ok(!/🎁 아이템 선물 7/.test(pb)&&!/✨ 전투 버프 8/.test(pb),"J2g PVE 에서도 AI 패키지 재고가 보이지 않는다");
    ok(/상대 아이템 비공개/.test(pb)&&/상대 패키지 비공개/.test(pb),"J2h PVE AI 차례에도 비공개 안내");
    // (c) 내 차례에는 내 재고가 그대로 보인다 (마스킹이 과하지 않다)
    Bv.S.battle=null; Bv.S.current=0; Bv.S.battlesUsed=0;
    Bv.S.balls[0]=5; Bv.S.pkgs[0]={itemGift:2,battleBuff:3}; Bv.S.inv[0]=["potion"];
    Bv.startRounds(Qb.me,Qb.em,Qb.me,Qb.em); Bv.TQ.length=0; actAsA(Bv);
    Bv.S.battle.menu="ball"; Bv.battleModal();
    const mb=ob(Bv);
    ok(/볼 5개/.test(mb)&&/🎁 아이템 선물 2/.test(mb)&&/✨ 전투 버프 3/.test(mb),"J2i 내 차례에는 내 볼·패키지 재고가 그대로 보인다 (과도 마스킹 아님)");
    Bv.TQ.length=0;
  }

  /* J3 (P2) 기권·경기 종료 경로에서도 전투 회계·버프가 정리되고 **미사용 패키지는 보존**된다 */
  for(const [label,end] of [
    ["기권",(X2)=>{ X2.netAction({t:"resign"}); }],
    ["왕 제거(경기 종료)",(X2)=>{ X2.gameOver(0,"king"); }],
  ]){
    const X2=load(); fixed(X2); X2.tutSkip();
    const Q5=setup(X2); giveSpecies(X2,Q5.me,R(X2,"M-F1")); giveSpecies(X2,Q5.em,R(X2,"M-G1"));
    X2.S.pkgs[0]={itemGift:2,battleBuff:2};
    openBattle(X2,Q5.me,Q5.em); const B5=X2.S.battle; actAsA(X2); freshModal(X2);
    X2.__openPkgCore("battleBuff"); click(X2,X2.BUFFS.power.ko);
    ok(B5.buffA==="power"&&Q5.me.powerBuff===true,"J3-"+label+" 전제: 버프 적용 · 패키지 1개 남음");
    Q5.me.fleeBoost=true; // 두 플래그 모두 남아 있는 상태를 만든다
    X2.S.current=0;
    end(X2); X2.drain(20000);
    ok(X2.S.phase==="over","J3-"+label+": 경기가 종료됐다");
    ok(X2.S.battle===null,"J3-"+label+": **전투 객체가 남지 않는다** (Saturn P2)");
    ok(Q5.me.powerBuff===false&&Q5.me.fleeBoost===false,"J3-"+label+": 전투원 버프 플래그가 정리됐다");
    ok(Q5.em.powerBuff===false&&Q5.em.fleeBoost===false,"J3-"+label+": 상대 전투원도 정리됐다");
    ok(X2.S.pkgs[0].battleBuff===1&&X2.S.pkgs[0].itemGift===2,"J3-"+label+": **미사용 패키지 재고는 보존**된다 (새 게임에서만 초기화)");
    ok(X2.S.recruit===null,"J3-"+label+": 탐색 선택 대기 상태도 남지 않는다");
    /* Saturn 추가 P2: 상태만이 아니라 **화면**도 정리돼야 한다 — 전투창이 남으면 buff CSS 가 무한히 돌고 낡은 입력 면이 남는다 */
    ok(hidden(X2),"J3-"+label+": 전투 모달이 **화면에서 닫힌다** (overlay hidden — Saturn 추가 P2)");
    ok(!/buff-power|buff-escape|buff-time/.test(ob(X2)),"J3-"+label+": 버프 CSS 클래스가 화면에 남지 않는다");
    ok(!X2.fxLocked(),"J3-"+label+": 연출 잠금도 남지 않는다 (입력이 영구 차단되지 않는다)");
    X2.TQ.length=0;
  }
  /* J3b 온라인 **수신** 기권 (applyAction 경로) — Saturn 재현 그대로 */
  {
    const X6=load(); fixed(X6); X6.tutSkip();
    const Q8=setup(X6); giveSpecies(X6,Q8.me,R(X6,"M-F1")); giveSpecies(X6,Q8.em,R(X6,"M-G1"));
    X6.S.pkgs[0]={itemGift:2,battleBuff:2};
    openBattle(X6,Q8.me,Q8.em); const B8=X6.S.battle; actAsA(X6); freshModal(X6);
    X6.__openPkgCore("battleBuff"); click(X6,X6.BUFFS.power.ko);
    ok(B8.buffA==="power"&&Q8.me.powerBuff===true,"J3b 전제: 버프 적용 · 전투 모달 열림");
    ok(/buff-power/.test(ob(X6)),"J3b' 전제: 전투 토큰에 buff-power 가 그려져 있다");
    ok(!hidden(X6),"J3b'' 전제: overlay 가 열려 있다");
    /* 온라인 수신 경로: 상대(1P)가 기권한 프레임을 재생한다 */
    X6.NET.mode=true; X6.NET.started=true; X6.NET.me=1;
    X6.S.current=1;                                   // 기권한 쪽 = 상대
    X6.applyAction({t:"resign"}); X6.drain(20000);
    ok(X6.S.phase==="over","J3b1 수신 기권으로 경기가 종료됐다");
    ok(X6.S.battle===null,"J3b2 전투 객체 정리");
    ok(Q8.me.powerBuff===false&&Q8.em.powerBuff===false,"J3b3 버프 플래그 정리");
    ok(hidden(X6),"J3b4 **전투창이 화면에서 닫힌다** (Saturn 재현: 종전에는 overlay.hidden=false 로 남았다)");
    ok(!/buff-power/.test(ob(X6)),"J3b5 **buff-power CSS 가 화면에 남지 않는다** (무한 애니메이션 제거)");
    ok(!X6.fxLocked(),"J3b6 연출 잠금 해제");
    ok(X6.S.pkgs[0].battleBuff===1&&X6.S.pkgs[0].itemGift===2,"J3b7 미사용 패키지 재고는 보존된다");
    X6.NET.mode=false; X6.NET.me=null; X6.NET.started=false; X6.TQ.length=0;
  }
  /* J3c 정상 승패 종료는 결과 연출 계약을 그대로 유지한다 (위 닫기가 그 경로를 앞당기지 않는다) */
  {
    const X7=load(); fixed(X7); X7.tutSkip();
    const Q9=setup(X7); giveSpecies(X7,Q9.me,R(X7,"M-F1")); giveSpecies(X7,Q9.em,R(X7,"M-G1"));
    openBattle(X7,Q9.me,Q9.em); const B9=X7.S.battle; actAsA(X7);
    B9.fd.hp=1; X7.setSeed(4); X7.execSlot("A",0); X7.drain(20000);
    ok(X7.S.battle===null,"J3c 정상 승패로 전투가 끝났다");
    ok(X7.S.phase==="play"||X7.S.phase==="over","J3c' 경기 상태는 규칙대로 (play 또는 over)");
    ok(!/buff-power/.test(ob(X7)),"J3c'' 정상 종료 경로에도 버프 CSS 가 남지 않는다");
    X7.TQ.length=0;
  }
  /* J4 (Saturn 추가 P1) 정상 기본 공격이 미공개 사신을 노출하지 않는다.
     재현: 슬롯0 = 사신(쿨 0이지만 봉인) · 나머지 3슬롯 쿨 → 네 슬롯 모두 불가라 **기본 공격 버튼이 정상 표시**된다.
     그 버튼으로 basic 을 눌렀을 때 (a) 사신 슬롯으로 매핑되지 않고 (b) 공용 로그·공개 기록에 사신 이름이 남지 않아야 한다. */
  {
    const X4=load(); fixed(X4); X4.tutSkip();
    const Q6=setup(X4); giveSpecies(X4,Q6.me,R(X4,"M-F1")); giveSpecies(X4,Q6.em,R(X4,"M-G1"));
    openBattle(X4,Q6.me,Q6.em); const B6=X4.S.battle;
    B6.fa.skills=["reaper_scythe","dragon_breath","witch_prank","sup_heal"];
    B6.fa.cds=[0,2,2,2]; B6.fa.revealedSkills=[];
    B6.round=1; B6.phase=0; B6.fa.hp=100; B6.fd.hp=100;
    ok(actAsA(X4),"J4 전제: 라운드 1 · 공격측 차례");
    ok([0,1,2,3].every(i=>X4.slotUsable(B6.fa,i,"A")===false),"J4a 전제: 네 슬롯 모두 지금 쓸 수 없다 (슬롯0 사신은 쿨 0이지만 봉인)");
    X4.byId("obBtns").children.length=0; X4.battleModal();
    /* #146: 네 슬롯 모두 불가 → 기본 공격 버튼은 없고 안내 + 수동 [턴 종료]만 나온다 */
    ok(!/__act\('basic'\)/.test(ob(X4))&&!/기본 공격 \d+~\d+/.test(ob(X4)),"J4b 기본 공격 버튼이 없다 (#146 폴백 철회)");
    ok(ob(X4).indexOf(X4.NO_ATTACK_MSG)>=0&&ob(X4).indexOf("__pass()")>=0,"J4b2 안내 문구 + 수동 [턴 종료] 버튼");
    const hp0=B6.fd.hp, logLen=X4.S.log.length, ph6=B6.phase, rd6=B6.round;
    X4.netAction({t:"act",k:"basic"}); X4.drain(20000);
    const blog4=B6.blog.join("|");
    ok(!/사신의 낫/.test(blog4),"J4c **공용 전투 로그에 사신의 낫이 나오지 않는다** (Saturn 추가 P1 — 쓰지 않은 미공개 기술)");
    ok(!X4.S.log.slice(logLen).some(l=>/사신/.test(l.msg)),"J4c2 보드 로그에도 없다");
    ok(!B6.fa.revealedSkills.includes(0),"J4d 사신 슬롯이 공개 기록에 들어가지 않는다 (사용하지 않았다)");
    ok(B6.fd.hp===hp0&&X4.S.battle===B6&&B6.phase===ph6&&B6.round===rd6,"J4e UI 밖에서 온 불법 basic 은 조용히 거부된다 — 피해·전투 행동 모두 0 (#146)");
    ok(Q6.em.alive===true,"J4f 즉사가 새지 않았다");
    /* 수동 [턴 종료]만이 이 상황에서 전투 행동을 넘기는 유일한 경로다 */
    X4.netAction({t:"pass"}); X4.drain(20000);
    ok(B6.phase!==ph6||B6.round!==rd6||X4.S.battle===null,"J4e2 수동 [턴 종료]로만 자기 전투 행동 1회가 넘어간다");
    /* 음성 대조: 슬롯0 이 합법 기술이면 basic 이 그 슬롯으로 매핑되는 기존 동작은 그대로 (레거시 호환) */
    const X5=load(); fixed(X5); X5.tutSkip();
    const Q7=setup(X5); giveSpecies(X5,Q7.me,R(X5,"M-F1")); giveSpecies(X5,Q7.em,R(X5,"M-G1"));
    openBattle(X5,Q7.me,Q7.em); const B7=X5.S.battle; B7.fa.cds=[0,2,2,2]; B7.fa.revealedSkills=[];
    actAsA(X5); X5.netAction({t:"act",k:"basic"}); X5.drain(20000);
    ok(B7.fa.revealedSkills.includes(0),"J4g [대조] 슬롯0 이 합법 기술이면 basic 은 종전처럼 그 슬롯을 쓴다 (레거시 매핑 보존)");
    X4.TQ.length=0; X5.TQ.length=0;
  }

  // 새 게임에서만 패키지가 초기화된다
  {
    const X3=load(); X3.newGame("pvp"); X3.S.pkgs[0]={itemGift:9,battleBuff:9};
    X3.gameOver(0,"resign");
    ok(X3.S.pkgs[0].itemGift===9,"J3' 경기 종료는 패키지를 지우지 않는다");
    X3.newGame("pvp");
    ok(X3.S.pkgs[0].itemGift===0,"J3'' 새 게임에서만 패키지가 초기화된다");
  }
}

console.log(`\n=== smoke_search_packages (#121·#129): pass ${pass} / fail ${fail} ===`);
if(fail){ console.error("실패: "+fails.join(" | ")); process.exit(1); }
process.exit(0);
