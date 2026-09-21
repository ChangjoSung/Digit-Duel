"use strict";
/* ===== 상태 ===== */
/** @type {GameState} */
let S=null;
function pname(p){
  if(NET.mode) return (p===NET.me?"나":"상대")+"(P"+(p+1)+")";
  if(S.mode==="pve") return p===0?"플레이어":"AI("+(AI_LEVEL_KO[S.aiLevel[1]]||"5급")+")";
  if(S.mode==="sim") return (p===0?"AI-1":"AI-2")+"("+(AI_LEVEL_KO[S.aiLevel[p]]||"5급")+")";
  return p===0?"P1(하단·청)":"P2(상단·적)";
}
/* #20 플레이어별 핵심 행동 지표 키 — 합산(S.metrics[key])과 byPlayer[p][key]를 met()로 동시 증가시켜 이중 집계 정합 유지 */
const PLAYER_METRIC_KEYS=["battles","forcedBattles","teleports","searches","minionSearches","captures","captureFails",
  "enemyCapTries","enemyCaptures","enemyCapFails","fleeTries","fleeOks","bombMoves","trapTriggers","kingForestTurns",
  "battleRefusals","pushes","bombHitsMinion","bombClearedByVip","minionInvades",
  "heals","healHp","bombContacts","autoEnds", // #106: 회복 지정 횟수·누적 회복량·폭탄 직접 접촉 발동·자동 턴 종료
  "relocations","fleePushes"]; // #114 (v0.4.5): 밀기 후 재배치 발생 수(접촉 행동자 기준)·도망 후 교환/생략 밀기 수(도망 측 기준)
const PLAYER_METRIC_KO={battles:"전투",forcedBattles:"강제 전투",teleports:"텔레포트",searches:"탐색",minionSearches:"하수인 탐색",
  captures:"중립 포획 성공",captureFails:"중립 포획 실패",enemyCapTries:"적 포획 시도",enemyCaptures:"적 포획 성공",enemyCapFails:"적 포획 실패",
  fleeTries:"도망 시도",fleeOks:"도망 성공",bombMoves:"폭탄 이동",trapTriggers:"함정 발동(자기 함정)",kingForestTurns:"왕 숲 체류(턴)",
  battleRefusals:"전투 회피",pushes:"밀어내기",bombHitsMinion:"자기 폭탄에 적 하수인 소모",bombClearedByVip:"자기 폭탄 VIP 제거",minionInvades:"적진 진입",
  heals:"회복 지정",healHp:"회복량",bombContacts:"폭탄 접촉 발동",autoEnds:"자동 턴 종료",relocations:"재배치",fleePushes:"도망 후 밀기"};
function met(p,key,n,st){ // 합산 + 플레이어별 동시 증가 (p: 행동 주체 플레이어 · st: #245 reducer 가 받은 상태, 기본 S)
  n=n===undefined?1:n;
  const M=(st||S).metrics;
  if(M[key]===undefined) M[key]=0;
  M[key]+=n;
  if(p===0||p===1) M.byPlayer[p][key]=(M.byPlayer[p][key]||0)+n;
}
/** @returns {Record<string,number>} */
function newPlayerMetrics(){
  /** @type {Record<string,number>} */
  const o={};
  for(const k of PLAYER_METRIC_KEYS) o[k]=0;
  return o;
}
/* #245 상태 계약: 새 경기 상태를 **만드는 한 곳**. GameState 타입을 이 리터럴에서 그대로 끌어오므로(아래 @typedef)
   따로 관리하는 타입 표가 없고, 여기서 칸을 더하거나 빼면 계약이 같이 움직인다.
   널·빈 배열처럼 리터럴만으로는 좁게 추론되는 칸에만 `@type` 을 적는다 — 그 주석이 곧 그 칸의 계약이다. */
function newGameState(mode,opts){
  return {
    mode, phase:"setup", setupPlayer:0, current:0, turnCount:0,
    /** @type {string[]} */
    aiLevel:opts.aiLevel||["grade5","grade5"], // #21 플레이어별 AI 난이도 (PVE는 [1]만 의미)
    /** @type {Set<number>[]} */
    aiSeenMoved:[new Set(),new Set()], // #21 공개 관측 기억: [관측자][적 말 id] — 관측자에게 보이는 상태에서 BT 이전 이동이 목격된 적 말 (숨은 숲 내부 이동은 미기록)
    /** @type {{id:number,r:number,c:number}[][]} */
    aiHist:[[],[]], // #21 5단 반복 패턴 완화용 최근 이동 이력 [{id,r,c}]
    /** @type {BoardPiece[]} */
    pieces:[],
    /** @type {BoardEvent[]} */
    events:[],
    /** @type {string[][]} */
    inv:[[],[]],
    balls:[BAL.ballStart,BAL.ballStart],
    pkgs:[{itemGift:0,battleBuff:0},{itemGift:0,battleBuff:0}], // #121 계약 2·3: 플레이어 공용 패키지 재고 (보유 상한 없음) — 개봉 전까지 내용이 정해지지 않은 미개봉 상자
    /** @type {(ReservePiece|null)[]} */ // #12 포획 예비 슬롯 — 보드 정체(id·좌표·placed) 없이 전투 수치만 든 말 기록
    reserve:[null,null],
    teleUsed:[0,0], // #14 스왑 횟수
    /** @type {{pid:number|null,targets?:any}[]} */ // #18 강제 전투 독립 queue [{pid,targets}] — 권위 방 재수화는 개수만 아는 자리표(pid:null·targets 없음)를 넣는다
    forcedQueue:[],
    /** @type {string[][]} */
    roster:[[],[]],
    /** @type {Set<string>[]} */
    traces:[new Set(), new Set()],
    /** @type {Record<string,string>[]} */
    memos:[{},{}], // #11·#36 추측 메모: [뷰어(PVE:0/PVP:플레이어)][pieceId]=MEMO_OPTS 키 — 상대·AI·로그 비노출, 인메모리만

    /** @type {UiSelection|null} */
    selected:null,
    mainUsed:false, battlesUsed:0,
    /** @type {BoardPiece|null} */
    movedPiece:null,
    /** @type {BoardPiece[]} */
    contactSet:[],
    firstBattleWonByMover:false,
    /** @type {BoardPiece[]} */
    forcedTargets:[],
    /** @type {{stage:number,piece:BoardPiece|null}|null} */
    teleport:null,
    /** @type {Set<number>} */
    tempReveal:new Set(),
    /** @type {BattleState|null} */ // #245 Saturn REVISE(MEDIUM): 전투 인스턴스도 닫힌 계약이다 — 없는 칸(S.battle.없는칸)은 읽든 쓰든 걸린다. 전투원(fa/fd) 내부 수치만 경계 밖이다
    battle:null,
    /** @type {number|null} */
    winner:null,
    aiPending:false, aiBattlePending:false,
    /** @type {(number|null)[]} */ // 말이 아니라 **말 id** 를 든다 (ai.js aiVanguard[me]=vcands[0].id)
    aiVanguard:[null,null],
    /** @type {any[]} */
    aiProfile:[null,null],
    healTickTurn:-1, btBannerDue:false, contactKind:"move", // #106: 회복 틱 중복 가드(같은 turn 1회) · 버닝 타임 배너 1회 예약 · 접촉 배너 부제 종류
    matchFxDone:false, // #126: 경기 종료 연출 1회 보장 (경기 기준 — 새 경기마다 자연히 초기화된다)
    /** @type {{owner:number,pieceId:number|null,oppId?:number|null,cands:number[],token:string|number}|null} */
    fleePick:null, // #114 도망 후 교환 선택 상태 {owner,pieceId,oppId,cands:[id]} — 소유자(S.current 와 다를 수 있음)만 보드 클릭·생략 입력, 상대는 대기
    metrics:{battles:0,judged:0,ties:0,pushes:0,searches:0,captures:0,captureFails:0,heals:0,healHp:0,bombContacts:0,autoEnds:0,relocations:0,fleePushes:0,
             bombHitsMinion:0,bombClearedByVip:0,kingForestTurns:0,battleRefusals:0,
             attackerWins:0,defenderWins:0,kingStandoff:0,endTurn:0,
             /** @type {string|null} */
             winType:null,
             btReached:false,btEnterTurn:0,
             forcedBattles:0,teleports:0,statusApplied:0,statusFailed:0,minionInvades:0,
             enemyCaptures:0,fleeTries:0,fleeOks:0,minionSearches:0, // #20: minionEventUses → minionSearches (하수인 탐색)
             enemyCapTries:0,enemyCapFails:0,bombMoves:0,trapTriggers:0, // #20 누락 카운터
             /** @type {number|null} */
             firstPlayer:null,
             /** @type {number|null} */
             winner:null, // #20 선공·승자
             /** @type {Record<string,number>[]} */
             byPlayer:[newPlayerMetrics(),newPlayerMetrics()]}, // #20 플레이어별 핵심 행동 (합산과 met()로 동시 집계)
    /** @type {{msg:string,cls:string}[]} */
    log:[]
  };
}
/* #245: newGameState() 가 만들지 않고 **경기 중에 붙는** 상태 칸. 정적 검사가 실측으로 찾아낸 drift 라 이름으로 적어 둔다.
   런타임은 그대로 두고(초기값을 주면 새 경기 객체 모양이 바뀐다) 계약에만 올린다 — 여기 없는 칸을 새로 붙이면 그 자리에서 잡힌다.
   추가 여부는 기획·서버 계약이 걸린 판단이라 [기획 필요]로 남긴다. */
/** @typedef {Sealed<ReturnType<typeof newGameState>> & {
      recruit?:RecruitState|null, // 탐색 보상 선택 상태 (core.js recruit reducer) — #245 MEDIUM: 닫힌 계약
      recruitToken?:number,  // 그 선택창의 결정적 토큰 **발급 번호**(숫자). recruit.token 은 이 숫자를 담은 문자열이다 — 둘은 다른 것이다
      aiLastThinkMs?:number, // 강AI 사고 시간 (표시 전용)
      pkgSeq?:number,        // 패키지 개봉 표 번호
      searchEndSeq?:number,  // 탐색 종료 재평가 순번
      __ddFxCells?:any,      // 연출 칸 임시 보관
      _pendingModal?:any     // 재접속 중 보류된 동기화 모달
    }} GameState */
/** @typedef {Sealed<ReturnType<typeof mkPiece>>} Piece */
function newGame(mode,opts){
  opts=opts||{};
  fxReleaseAll(); // #106: 새 게임 — 이전 게임의 연출 잠금·타이머·대기 콜백 전부 무효 (불변식 2)
  S=newGameState(mode,opts);
  for(const p of [0,1]){
    for(let i=0;i<6;i++) S.pieces.push(mkPiece(p,"minion")); // 속성·스탯은 로스터 선택 시 주입

    for(let i=0;i<3;i++) S.pieces.push(mkPiece(p,"bomb"));
    for(let i=0;i<2;i++) S.pieces.push(mkPiece(p,"ally",null,i)); // i=0 암살자·1 방패병 (3.5)
    for(let i=0;i<2;i++) S.pieces.push(mkPiece(p,"trap"));
    S.pieces.push(mkPiece(p,"king"));
    /* #121 계약 2.1: 시작 아이템은 회복약·쿨링수·해독제 각 1 (고정). 종전 D11 은 무작위 2개였고 shuffle 로 rand 를
       소비했다 — 고정 목록이 되어 **이 지점의 난수 소비가 0** 이 된다 (공유 시드 재현은 양측 동일하므로 안전) */
    for(const k of BAL.itemStart) S.inv[p].push(k);
  }
  genEvents();
}
let PID=1;
function mkPiece(owner,type,element,allyIdx){
  const b = BAL[type]||{};
  const f={id:PID++, owner, type, element:element||null,
    hp:b.hp||1, maxHp:b.hp||1, atk:b.atk||0, skillAtk:b.skill||0,
    rosterId:null, name:null, cdMax:b.cd||0,
    cd:0, skills:null, cds:[0,0,0,0], revealedSkills:null,
    r:0,c:0, placed:false, revealed:false, alive:true, movedEver:false, movedPreBT:false,
    immobile:0, cap:null, nextBattleBuff:false, healing:false, // #106 healing: 회복 자세(지속형) — 소유자·공개 말만 표시, AI 는 미공개 상대 말의 값을 읽지 않는다
    burn:0,burnFresh:false, burnBy:null, weaken:0, shield:0, shieldLayers:[], absorbed:0, shock:0, shockFresh:false,
    crack:0,crackFresh:false, harden:0,hardenFresh:false,hardenPct:0, evadeBuff:0,evadeBuffR:0, dmgUpBuff:0,dmgUpBuffR:0, // #233 (GDD-23 4.5): 균열·경화·회피 증가·가하는 피해 증가 지속 버프/상태
    focusCharge:false, vulnMark:false, dmgCut:0,
    /* #121 계약 3: 전투 버프 패키지 효과는 **그 전투에만** 산다. 본체 출전이면 f === piece 라 이 필드가 말에 남으므로
       전투 개시(resetBattleTemps)와 전투 종료(resetAfter) 양쪽에서 반드시 지운다 — 계약 3.1 "전투가 끝나면 즉시 정리" */
    powerBuff:false, fleeBoost:false,
    allyKind:type==="ally"?(allyIdx===1?"shield":"assassin"):null, leaderElChosen:false, legend:null}; // #234 6.2: 동료 종류(스킬 세트) · 속성 선택 여부(선택 UI 는 #236/#238)
  /* #233 (GDD-23 3.3·3.5) 8스탯 주입 — minion 은 로스터 선택 전 기본값으로 표준형(std) 블록을 쓰고
     applyRoster()가 실제 종의 아키타입으로 다시 주입한다. 왕·동료는 등급 없음(grade:null, 3.5). */
  if(type==="minion") applyArchStats(f,"std",1);
  else if(type==="king") applyFixedStats(f,KING_BASE,null);
  else if(type==="ally") applyFixedStats(f,allyIdx===1?ALLY_BASE.shield:ALLY_BASE.assassin,null);
  else { f.def=0; f.spd=0; f.dodge=0; f.crit=0; f.statusPct=0; f.shieldStartPct=0; f.grade=null; } // bomb·trap: 전투원이 아니므로 미사용
  return f;
}
/* 선택된 로스터 6종의 스탯을 플레이어 p의 하수인 6기에 주입 (선택 변경 시 재주입) */
function applyRoster(p,state){
  const game=state||S, ms=game.pieces.filter(x=>x.owner===p&&x.type==="minion");
  ms.forEach((m,i)=>{
    const rd=game.roster[p][i]?ROSTER.find(r=>r.id===game.roster[p][i]):null;
    if(rd){ applySpecies(m,rd,1); } // #234 (GDD-23 2.2 · 3.4 · 6.1): 경기 시작 하수인은 ⭐1 — 1차 기본기 1개. ⭐2~4 는 상점(#236) 전까지 검사·AI 경로에서만 구성
    else {m.rosterId=null; m.name=null; m.element=null;
      m.hp=BAL.minion.hp; m.maxHp=BAL.minion.hp; m.atk=BAL.minion.atk; m.skillAtk=BAL.minion.skill; m.cdMax=BAL.minion.cd;
      applyArchStats(m,"std",1);
      m.skills=null; m.cds=[0,0,0,0]; m.revealedSkills=null;}
  });
  assignLeaderElements(p,game); // #234 (GDD-23 2.2): 왕·동료 속성 미선택 규칙 — 필드 하수인 최다 속성(동률 🔥→💧→⚡→🗻→🌿), 스킬 칸 동기화
}
/* #121 계약 1.1 (v0.4.7) 숲 이벤트 개편 — 종전 #12 의 "구역당 3~4개 · 6종 칸마다 독립 추첨"을 대체한다.
   각 구역(4·5행 / 9·10행)에 itemGift·battleBuff·recruit 를 **각 정확히 1개**, 보드 전체 6개. 종류별 개수는 고정이고 칸 위치만 무작위다.
   종전 6종(potion·cool·cure·ball·buff·recruit)의 **생성은 폐기**됐다 — 계약 1.3 에 따라 하수인 탐색의 기술 쿨 전체 초기화와
   다음 전투 공격 +15% 일시 버프는 대체 보상 없이 사라진다(계산 경로는 남지만 이 경로로 켜지지 않는다).
   난수 소비: **구역마다 shuffle 1회뿐**이다 (14칸 셔플 = rand 13회 × 구역 2개). 종류 추첨 rand 가 없어져 온라인 공유 시드
   재현에서 소비 횟수가 배치 결과와 무관하게 결정적이다 — 계약 1.1 [추론]이 요구한 "소비 횟수 결정적"을 만족한다. */
const EVENT_KINDS=["itemGift","battleBuff","recruit"]; // 순서 고정 — 셔플된 앞 3칸에 이 순서로 1:1 배정 (추가 난수 0)
const EVENT_KO={itemGift:"아이템 선물 패키지",battleBuff:"전투 버프 패키지",recruit:"기술 교체 / 하수인 포획"};
function genEvents(){
  S.events=[];
  for(const rows of [[4,5],[9,10]]){
    const cells=[];
    for(const r of rows) for(let c=1;c<=COLS;c++) cells.push([r,c]);
    shuffle(cells);
    EVENT_KINDS.forEach((kind,i)=>{ S.events.push({r:cells[i][0], c:cells[i][1], kind, consumed:false}); });
  }
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
