"use strict";
/* ===== AI (공정 관측 휴리스틱 — Phase 1) ===== */
/* #106 6.3: AI 는 사람과 같은 연출을 기다린다 — 잠금 중이면 idle 콜백에 등록되고 idle 뒤 aiDelay 를 기산한다. 판단·정책·난수 순서는 불변 */
/* #122 REVISE: 관전 종료 확인창이 떠 있는 동안에는 예약된 AI 실행을 큐에 담아 두고, 취소하면 그대로 재개한다.
   pending 플래그는 세워 둔 채로 미루므로 중복 예약이 생기지 않고, 새 게임(S 교체)이면 큐 항목이 스스로 무효가 된다. */
function aiHold(fn){ UI.holdQ.push(fn); }
function aiHoldRelease(){ const q=UI.holdQ; UI.holdQ=[]; UI.hold=false; for(const f of q){ try{ f(); }catch(e){} } }
/* #245 Saturn REVISE(M2): 예약은 표시 계층의 사실(연출 잠금·관전 확인창·사고 지연)에 얹히지만, 그 자리가 **없는
   런타임**(data·state·core·ai 만 적재)에서는 미룰 것이 없다는 뜻이므로 그 자리에서 바로 실행한다.
   판단·정책·난수 순서는 어느 쪽에서도 같다 — 바뀌는 것은 "언제 부르는가"뿐이다. */
const aiIdle=fn=>{ if(typeof fxWhenIdle==="function") fxWhenIdle(fn); else fn(); };
const aiDelay=(fn,ms)=>{ if(typeof setTimeout==="function") setTimeout(fn,ms); else fn(); };
const aiHeldNow=()=>typeof UI!=="undefined"&&!!UI.hold;
/* ===== #245 Saturn REVISE(M2) AI 어댑터가 자기만 쓰는 기록 — 게임 상태(S)가 아니다 =====
   종전에는 예약 플래그·성격 프로파일·선봉·최근 이동 이력·사고 시간을 전부 S 에 직접 썼다. 그중 어느 것도
   규칙 판정·승패·회선 프레임에 들어가지 않고 Core 는 한 번도 읽지 않는다 — 판단하는 쪽의 메모일 뿐이다.
   게임 정체성(S 객체)으로 수명을 맞추므로 새 경기가 시작되면 종전 newGameState() 가 주던 초기값과 **같은 값**에서 다시 시작한다:
   pending=false · profile [null,null] · vanguard [null,null] · hist [[],[]]. 난수 소비 순서도 그대로다.
   관측 기억(aiSeenMoved)만은 규칙이 만들고 reducer 가 쓰므로 S 에 남는다. */
const AI={game:null,pending:false,battlePending:false,
  /** @type {any[]} */ profile:[null,null],
  /** @type {(number|null)[]} */ vanguard:[null,null],
  /** @type {{id:number,r:number,c:number}[][]} */ hist:[[],[]],
  lastThinkMs:0};
function aiMem(){
  if(AI.game!==S){ AI.game=S; AI.pending=false; AI.battlePending=false; AI.profile=[null,null]; AI.vanguard=[null,null]; AI.hist=[[],[]]; AI.lastThinkMs=0; }
  return AI;
}
function aiSchedule(){
  const M=aiMem();
  if(M.pending) return; M.pending=true;
  const G=S; aiIdle(()=>{ if(S!==G){ return; } aiDelay(()=>{ if(S!==G) return;
    if(aiHeldNow()){ aiHold(()=>{ if(S!==G) return; aiMem().pending=false; aiSchedule(); }); return; } // pending 유지 → 중복 예약 없음
    aiMem().pending=false; aiStep(); }, S.mode==="sim"?BAL.simDelay:BAL.aiDelay); });
}
function aiScheduleBattle(){
  const M=aiMem();
  if(M.battlePending) return; M.battlePending=true;
  const G=S; aiIdle(()=>{ if(S!==G){ return; } aiDelay(()=>{ if(S!==G) return;
    if(aiHeldNow()){ aiHold(()=>{ if(S!==G) return; aiMem().battlePending=false; aiScheduleBattle(); }); return; }
    aiMem().battlePending=false; aiBattleAction(); }, S.mode==="sim"?BAL.simDelay:BAL.aiDelay); });
}
/* ===== #245 Saturn REVISE(M2) AI 는 **고르고 보낼** 뿐이다 =====
   규칙 상태를 직접 바꾸지 않고, 공개 기록(addLog)·안내(showToast)도 쓰지 않는다 — 고른 행동을 Core 액션으로 보내면
   문구는 Core 가 같은 dispatch 안에서 낸다(origin:"ai"). 아래 네 래퍼가 ai.js 의 유일한 상태 접촉면이다. */
const aiMove=(p,r,c)=>dispatchCoreAction({t:"move",id:p.id,r,c,origin:"ai"});
const aiSearch=(p,ev)=>dispatchCoreAction({t:"search",id:p?p.id:null,r:ev?ev.r:null,c:ev?ev.c:null,ei:ev?S.events.indexOf(ev):-1,origin:"ai"});
const aiHeal=(p,toast)=>dispatchCoreAction({t:"heal",id:p?p.id:null,origin:"ai",toast:!!toast});
const aiTele=(a,b)=>{ const r=dispatchCoreAction({t:"teleSwap",a,b,origin:"ai"}); return !!r&&r.events[0]&&r.events[0].type==="teleSwapped"; };
const aiBattle=(att,def)=>dispatchCoreAction({t:"battleStart",attId:att.id,defId:def.id}); // 전투 개시도 액션 하나다
/* 전투 커맨드·탐색 보상도 같다. 종전에는 window.__act/__flee/__useItem/__recruitCore 를 지나 netAction →
   표시 계층이 **자기 렌더에 굳혀 둔 프레임**을 빌려 썼다 — 화면이 없으면 AI 가 전투에서 한 수도 두지 못했다.
   겨냥 문맥은 지금 상태에서 짓고(battleCmdFrame), 인가·합법성 판정은 종전과 같은 한 곳(battleCmdCtx)이 한다. */
const aiCmd=a=>dispatchCoreAction(Object.assign({frame:battleCmdFrame()},a));
const aiSkip=toast=>dispatchCoreAction(toast===false?{t:"skipMain",origin:"ai",toast:false}:{t:"skipMain",origin:"ai"});
function aiStep(){
  if(!S||S.phase!=="play"||!isAI(S.current)||S.battle||S.fleePick) return; // #114: 상대(사람)의 도망 교환 선택이 끝나야 재개 (fleeResolve → done 이 재스케줄)
  const me=S.current;
  if(!S.mainUsed){ if(aiLevelOf(me)==="dan5") aiMainStrong(me); else aiMain(me); emitCore({type:"render"}); aiSchedule(); return; } // #21 난이도 분기
  if(!(S.forcedTargets&&S.forcedTargets.length)) dispatchCoreAction({t:"drainForced",autoStart:false}); // #18 안전장치
  if(S.forcedTargets&&S.forcedTargets.length){ // T1: 강제 전투 최우선 이행 (aiEvalBattles보다 우선)
    const att=S.movedPiece, def=att?alivePieces().find(e=>forcedPickOk(e)):null; // #106: 폭탄 접촉 대상도 이행
    if(att&&def){ aiBattle(att,def); return; }
    dispatchCoreAction({t:"forcedClear"}); // 이행 불가 조합 방어 (크래시 방지) — 상태 변경은 Core 경계를 지난다
    if(S.forcedQueue.length){ aiSchedule(); return; } // 다음 대기 항목 처리
  }
  const pick=aiLevelOf(me)==="dan5"?aiEvalBattlesStrong(me):aiEvalBattles(me);
  if(pick){ aiBattle(pick.att,pick.def); if(!S.battle) return; return; } // 동기 해결은 afterBattle 훅이 재개
  dispatchCoreAction({t:"endTurn"});
}
/* T6 성격 프로파일: AI별 랜덤 가중치(0.6~1.4)·ε(0.05~0.15) — 게임당 고정, sim 양측 독립 생성 */
function aiProf(me){
  const P=aiMem().profile;
  if(!P[me]){
    if(aiLevelOf(me)==="dan5") P[me]={aggression:1,capture:1,kingRush:1,caution:1,eps:0}; // #21 5단: 고정 프로파일·ε 무작위 없음
    else {
      const r=()=>0.6+rand()*0.8;
      P[me]={aggression:r(),capture:r(),kingRush:r(),caution:r(),eps:0.05+rand()*0.10}; // 난수 소비 순서·횟수는 종전과 같다
    }
  }
  return P[me];
}
/* T6 전멸 회피: 전투 가능 말(하수인+동료) 2 이하면 신중 가중 강화 */
function aiCaution(me){
  const n=alivePieces().filter(x=>x.owner===me&&(x.type==="minion"||x.type==="ally")).length;
  return aiProf(me).caution*(n<=2?1.6:1);
}
/* 관측: AI는 visibleTo(me)·revealed·이동 이력(논리 추론)만 사용 */
function aiVisible(me){return alivePieces().filter(e=>e.owner!==me&&visibleTo(me,e));}
function aiThreatOf(me,e){ // 상대 말 위험도 추정 (공정: 비공개면 확률 기반)
  if(e.revealed){
    if(e.type==="bomb") return "bomb";
    if(e.type==="trap") return "trap";
    return "unit";
  }
  // 폭탄 이동 상시화(GDD-13 4.5): 이동 이력은 '함정 아님'만 증명 — 폭탄 후보는 남음
  // #21 누수 제거: 엔진 내부 movedPreBT가 아니라 관측자(me)가 실제로 목격한 이동 기억(aiSeenMoved)만 사용 — 숨은 숲 내부 이동은 미기록
  return aiSeenMoved(me,e) ? "unknownMoved" : "unknownStatic";
}
function aiSeenMoved(me,e){return S.aiSeenMoved&&S.aiSeenMoved[me]&&S.aiSeenMoved[me].has(e.id);}
/* 공개 정보(제거는 전부 공개 이벤트)·목격 이동 기반 폭탄·함정 확률 추정
   moved=true: 이동 목격 미공개 말 — 폭탄 후보만 / false: 이동 미목격 — 폭탄+함정 후보 */
function aiStaticRisk(me,moved){
  const opp=1-me;
  const bombsLeft=S.pieces.filter(p=>p.owner===opp&&p.type==="bomb"&&p.alive).length; // 제거는 공개 이벤트 → 잔여 수 공개 정보
  const trapsLeft=S.pieces.filter(p=>p.owner===opp&&p.type==="trap"&&p.alive).length;
  const pool=S.pieces.filter(p=>p.owner===opp&&p.alive&&p.placed&&!p.revealed&&(moved?aiSeenMoved(me,p):!aiSeenMoved(me,p))).length;
  return ((moved?0:trapsLeft*0.5)+bombsLeft)/Math.max(1,pool);
}
function aiMain(me){
  const prof=aiProf(me), caut=aiCaution(me);
  // ε-무작위 — T6 프로파일 기반 0.05~0.15
  if(rand()<prof.eps){ if(aiRandomMove(me)) return; }
  // 1. 흔적 위 말이 있으면 탐색 (#20: 하수인·동료·왕만 — 폭탄·함정은 탐색 실행 불가)
  for(const p of alivePieces().filter(p=>p.owner===me&&canSearchPiece(p))){
    const ev=S.events.find(e=>e.r===p.r&&e.c===p.c&&!e.consumed&&S.traces[me].has(e.r+"_"+e.c));
    if(ev){ aiSearch(p,ev); return; }   // 기록은 Core 가 낸다 (origin:"ai")
  }
  // 2. 왕 안전: 인접 적 있으면 회피 이동
  const king=alivePieces().find(p=>p.owner===me&&p.type==="king");
  if(king&&adjEnemies(king).length&&king.immobile===0){
    const opts=aiMoveOptions(king).filter(([r,c])=>!at(r,c))
      .sort((a,b)=>aiCellDanger(me,a)-aiCellDanger(me,b));
    if(opts.length&&aiCellDanger(me,[king.r,king.c])>aiCellDanger(me,opts[0])){
      aiMove(king,opts[0][0],opts[0][1]); return;
    }
  }
  // 2.5 폭탄 이동 활용(간단 휴리스틱): BT 중 왕 비인접 폭탄을 왕 인접 빈 칸으로 호위 재배치
  if(isBurning()&&king){
    const holes=[[king.r+1,king.c],[king.r-1,king.c],[king.r,king.c+1],[king.r,king.c-1]]
      .filter(([r,c])=>r>=1&&r<=ROWS&&c>=1&&c<=COLS&&!at(r,c));
    const vipAdj=(r,c)=>aiVisible(me).some(e=>e.revealed&&(e.type==="ally"||e.type==="king")&&Math.abs(e.r-r)+Math.abs(e.c-c)===1); // #106: 폭탄이 공개 동료·왕과 새로 인접하면 폭탄만 잃는다 — 회피
    for(const b of alivePieces().filter(x=>x.owner===me&&x.type==="bomb"&&x.immobile===0&&!adj(x,king)))
      for(const [r,c] of holes)
        if(canMoveTo(b,r,c)&&!vipAdj(r,c)){ aiMove(b,r,c); return; }
  }
  // 3. 강한 전투 기회가 있으면 주 행동 생략(위치 보존)
  const pick=aiEvalBattles(me,true);
  if(pick&&pick.score>=18){ aiSkip(); return; }
  // 4. 목적 이동: 동료·왕(볼 보유·포획 미보유) → 숲 / 하수인 → 전진 (공개된 적 왕은 추격)
  // 선봉 집중: 하수인 1기를 지정해 지속 전진 (이동권 분산으로 전선이 형성되지 않는 문제 방지)
  const VG=aiMem().vanguard;                 // #245 M2: 선봉 지정은 판단하는 쪽의 메모다 (규칙·회선·승패와 무관)
  let vg=VG[me];
  if(!vg||!S.pieces.find(p=>p.id===vg&&p.alive&&p.immobile===0)){
    const vcands=alivePieces().filter(p=>p.owner===me&&p.type==="minion"&&p.immobile===0);
    vcands.sort((a,b)=>((me===1?b.r-a.r:a.r-b.r)*10+Math.abs(a.c-4)-Math.abs(b.c-4)));
    vg=VG[me]=vcands.length?vcands[0].id:null;
  }
  const hunt=aiVisible(me).find(e=>e.type==="king"&&e.revealed);
  const cands=[];
  for(const p of alivePieces().filter(p=>p.owner===me&&p.immobile===0&&p.type!=="bomb"&&p.type!=="trap")){
    for(const [r,c] of aiMoveOptions(p)){
      let sc=0;
      const fwd = me===1 ? (r-p.r) : (p.r-r); // 전진 방향
      if(p.type==="minion"){
        sc += fwd*6*prof.aggression + (4-Math.abs(c-4));
        if(p.id===vg) sc+=12; // 선봉 우선 이동권
        if(hunt){const dNow=Math.abs(p.r-hunt.r)+Math.abs(p.c-hunt.c), dNew=Math.abs(r-hunt.r)+Math.abs(c-hunt.c); sc+=(dNow-dNew)*12;}
      }
      if(p.type==="ally"&&(p.cap||S.balls[me]===0)){
        sc += fwd*5; // 포획 완료·볼 소진 동료는 후열 소탕(폭탄 제거) 전환
        if(hunt){const dNow=Math.abs(p.r-hunt.r)+Math.abs(p.c-hunt.c), dNew=Math.abs(r-hunt.r)+Math.abs(c-hunt.c); sc+=(dNow-dNew)*10;}
      } else if(p.type==="ally"||(p.type==="king"&&!adjEnemies(p).length)){
        const targetRows = me===1?[4,5]:[9,10];
        const dNow=Math.min(...targetRows.map(tr=>Math.abs(p.r-tr)));
        const dNew=Math.min(...targetRows.map(tr=>Math.abs(r-tr)));
        sc += (dNow-dNew)*8*prof.capture;
        if(p.type==="king") sc-=4; // 왕은 소극적으로
        if((r>=4&&r<=5)||(r>=9&&r<=10)) sc+=3*prof.capture; // 숲 내부 배회(흔적 발견)
      }
      if(p.type==="king"){ // 끝줄 도달 승리 (GDD-13 4.1 개정) — 안전 회피(위 2단계)가 항상 우선
        const goal=me===0?1:ROWS;
        if(r===goal) sc+=100*prof.kingRush; // 도달 = 즉시 승리
        sc+=(Math.abs(p.r-goal)-Math.abs(r-goal))*1.5*prof.kingRush; // 상대 진영 접근 소폭 가점
      }
      const fsc=aiForcedScore(me,p,r,c); // T6 강제 전투 예측: 불리한 신규 인접 회피·유리하면 적극
      if(fsc!==null) sc+=fsc*0.8;
      sc -= aiCellDanger(me,[r,c])*3*caut;
      sc += rand()*2;
      cands.push({p,r,c,sc});
    }
  }
  cands.sort((a,b)=>b.sc-a.sc);
  const tp=aiTeleportPick(me); // #14 텔레포트 스왑: 점수 기반으로 일반 이동과 경쟁 (남용 방지)
  const hl=aiHealPick(me); // #106 6.3 권고: 가시 인접 적 없고 HP<60% 인 자기 말 — 다른 후보 점수가 낮을 때만 (난수 미소비)
  if(hl&&hl.sc>(cands.length?cands[0].sc:0)&&(!tp||hl.sc>tp.sc)&&aiHeal(hl.p,true)){ return; } // 5급 회복은 종전대로 토스트까지 (Core 가 낸다)
  if(tp&&tp.sc>(cands.length?cands[0].sc:0)&&aiTele(tp.a,tp.b)){ return; } // #18: 차단 시 일반 이동으로 대체
  if(cands.length){ const t=cands[0]; aiMove(t.p,t.r,t.c); return; }
  aiSkip();
}
/* #106 5급 회복 후보: 가시 인접 적이 없고 HP<60% 인 자기 하수인·동료·왕 중 손실 비율이 가장 큰 말 (공정 관측 — 자기 말 정보만, 난수 미소비) */
function aiHealPick(me){
  const caut=aiCaution(me), vis=aiVisible(me);
  let best=null;
  for(const p of alivePieces().filter(x=>x.owner===me&&canHeal(x)&&x.hp<x.maxHp*0.6&&!vis.some(e=>adj(e,x)))){
    const sc=(1-p.hp/p.maxHp)*30*caut+(p.type==="king"?10:0);
    if(!best||sc>best.sc) best={p,sc};
  }
  return best;
}
/* T6 강제 전투 예측: (r,c) 이동 시 새로 인접하게 될 보이는 적 중 최선 전투 기대 점수 (없으면 null) */
function aiForcedScore(me,p,r,c){
  let best=null;
  for(const e of aiVisible(me)){
    if(Math.abs(e.r-r)+Math.abs(e.c-c)!==1) continue;
    if(adj(p,e)) continue; // 기존 인접은 강제 대상 아님
    // #122 REVISE(2026-09-10 CJ QA 6): 왕 vs 왕도 강제 전투가 걸리므로 예측에서 빼지 않는다
    const s=aiBattlePairScore(me,p,e);
    if(best===null||s>best) best=s;
  }
  return best;
}
/* #14 텔레포트 스왑 판단: 침투 말↔왕(왕 러시 — 도착 칸 안전할 때)·위기 왕↔후방 스왑, 2회 제한 준수 */
function aiTeleportPick(me){
  if(S.mainUsed||!teleportAvailable(me)||S.teleUsed[me]>=BAL.teleMax) return null;
  const prof=aiProf(me), caut=aiCaution(me);
  const king=alivePieces().find(x=>x.owner===me&&x.type==="king"&&x.immobile===0);
  if(!king) return null;
  let best=null;
  // 1) 왕 러시: 적진 침투 말과 스왑 — 도착 칸 인접 위협 0일 때만 (kingRush 가중)
  const goal=me===0?1:ROWS;
  for(const p of alivePieces().filter(x=>x.owner===me&&x.id!==king.id&&x.immobile===0&&zoneOf(1-me).includes(x.r))){
    if(aiCellDanger(me,[p.r,p.c])>0||teleportSwapBlock(king,p)) continue; // #18: 슬롯 초과 스왑 후보 제외
    const sc=(20+(3-Math.abs(p.r-goal))*8)*prof.kingRush;
    if(!best||sc>best.sc) best={a:king,b:p,sc};
  }
  // 2) 위기 왕 구출: 인접 적 존재 시 자기 진영의 안전한 후방 말과 스왑
  if(adjEnemies(king).length){
    const rears=alivePieces().filter(x=>x.owner===me&&x.id!==king.id&&x.immobile===0
      &&zoneOf(me).includes(x.r)&&aiCellDanger(me,[x.r,x.c])===0&&!teleportSwapBlock(king,x)); // #18
    if(rears.length){const sc=24*caut; if(!best||sc>best.sc) best={a:king,b:rears[0],sc};}
  }
  return best;
}
function aiMoveOptions(p,state){
  const st=state||S; // #245 M2: 5단 탐색은 사본 보드를 넘긴다 (기본은 현재 S — 5급 경로는 종전 그대로)
  const out=[];
  for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]])
    for(const k of (isBurning(st)?[1,2]:[1])){ // BT 중 직선 2칸 후보 포함
      const r=p.r+dr*k,c=p.c+dc*k;
      if(r<1||r>ROWS||c<1||c>COLS) continue;
      if(canMoveTo(p,r,c,st)) out.push([r,c]);
    }
  return out;
}
/** @param {number} me @param {number[]} cell */
function aiCellDanger(me,cell){ const [r,c]=cell; // 그 칸에 인접한 (보이는) 적 유닛 수
  return aiVisible(me).filter(e=>Math.abs(e.r-r)+Math.abs(e.c-c)===1&&aiThreatOf(me,e)!=="trap").length;
}
function aiRandomMove(me){
  const ps=shuffle(alivePieces().filter(p=>p.owner===me&&p.immobile===0&&p.type!=="bomb"&&p.type!=="trap"));
  for(const p of ps){ const o=aiMoveOptions(p); if(o.length){const [r,c]=o[Math.floor(rand()*o.length)]; aiMove(p,r,c); return true;} }
  return false;
}
function aiEvalBattles(me,peek){
  let best=null;
  for(const att of alivePieces().filter(p=>p.owner===me)){
    for(const def of adjEnemies(att)){
      if(!visibleTo(me,def)) continue;
      if(!canBattle(att,def)) continue;
      const sc=aiBattlePairScore(me,att,def);
      if(!best||sc>best.score) best={att,def,score:sc};
    }
  }
  if(!best||best.score<6) return null;
  return peek?best:best;
}
/* T6: 전투 쌍 기대 점수 — aiEvalBattles·강제 전투 예측(aiForcedScore) 공용, 프로파일 가중 포함 */
function aiBattlePairScore(me,att,def){
  const prof=aiProf(me);
  const th=aiThreatOf(me,def);
  const pressure=(S.turnCount/BAL.maxTurns)*14; // 후반 공세 압력 (무승부 방지)
  let sc=0;
  if(th==="bomb"){ sc = (att.type==="ally") ? 30 : (att.type==="king"? -100 : -100); }
  else if(th==="trap"){ sc = att.type==="minion" ? -15 : -30; }
  else if(th==="unknownStatic"||th==="unknownMoved"){ // 비공개: 이동/미이동 풀별 폭탄·함정 확률 추정 후 계산된 위험 감수
    // 폭탄 트레이드는 하수인 1 ↔ 폭탄 1 교환(왕 호위 해체)이라 EV가 크게 나쁘지 않음
    const risk=aiStaticRisk(me,th==="unknownMoved");
    sc = att.type==="ally" ? 18+pressure
       : att.type==="king" ? -100
       : 8 - 18*risk + pressure;
  } else { // 유닛 (공개) — #122 REVISE(CJ QA 1·6): 동료/왕끼리도 이제 전투다. 종전 aiVipPair→aiPushScore 우회는 제거했다
    if(def.type==="king") sc=45;
    else if(def.type==="ally") sc=25;
    else { sc=10;
      if(att.element&&def.element){
        if(BEATS[att.element]===def.element) sc+=20;
        else if(BEATS[def.element]===att.element) sc-=20;
      }
      sc += (att.hp-def.hp)/5;
    }
    if(att.type==="king") sc-=25; // 왕은 웬만하면 싸우지 않음
    if(att.type==="ally"&&!att.cap) sc-=15;
  }
  sc += att.hp/20;
  sc = sc>0 ? sc*prof.aggression : sc*aiCaution(me); // T6: 공세 점수×aggression·위험 페널티×caution(전멸 위기 강화)
  // 수비: 자기 최후방 행 인접(1칸 전 도달 위협) 적은 우선 제거 — 끝줄 승리 저지 (프로파일 무관)
  if(th!=="bomb"&&th!=="trap"&&Math.abs(def.r-(me===0?ROWS:1))<=1) sc+=40;
  return sc;
}
/* #114 AI 밀기 평가 — #122 REVISE(CJ QA 1·6)로 동료/왕끼리가 전투가 되면서 **전투 평가 경로에서는 더 이상 쓰지 않는다**.
   함수는 남겨 둔다: 밀기 자체는 폭탄 접촉 이후 경로가 사라진 지금도 도망 성공 후 교환·밀기(pushResolve)로 살아 있고,
   기존 회귀 검사가 이 두 함수를 직접 부른다. 새 호출을 추가하지 말 것. */
function aiVipPair(att,def){ const vip=x=>x.type==="ally"||x.type==="king"; return vip(att)&&def.revealed&&vip(def); }
function aiPushScore(att,def){
  if(def.type==="king"){ const nr=def.r+Math.sign(def.r-att.r); if(nr===(def.owner===0?1:ROWS)) return -aiUnitValue(def,att.owner); }
  return 0;
}
/* #121 계약 2.2·3·9: AI 전투 중 패키지 사용 — 무료 보너스 행동이라 **행동을 소모하지 않는다**.
   그래서 무한 루프를 막는 것이 중요하다: 개봉·버프는 각각 "재고가 있고 아직 안 썼을 때" 한 번만 전진하고,
   코어가 재고를 줄이므로 같은 조건이 다시 성립하지 않는다. 난수를 쓰지 않는다(결정적 선택).
   반환 true = 이번 호출에서 패키지 행동을 했다 → 호출자는 즉시 return (모달 재렌더가 AI 를 재스케줄한다). */
function aiPkgAction(side){
  const B=S.battle; if(!B) return false;
  const ownerP=side==="A"?B.attP.owner:B.defP.owner, f=side==="A"?B.fa:B.fd, opp=side==="A"?B.fd:B.fa;
  const pk=S.pkgs[ownerP]; if(!pk) return false;
  /* 1) 전투 버프 — 한 전투 1개. 시간은 R1 에만 고를 수 있으니 가장 먼저 판단한다 */
  if(pk.battleBuff>0&&!(side==="A"?B.buffA:B.buffD)){
    const myPc=side==="A"?B.attP:B.defP, vipBody=(myPc.type==="ally"||myPc.type==="king")&&f===myPc;
    const losing=f.hp/f.maxHp<opp.hp/opp.maxHp;
    let key="power";                                       // 기본: 피해 상단 고정
    if(B.round===1&&losing&&vipBody) key="time";            // 본체 VIP 가 밀리면 3라운드로 끊어 판정 승부로
    else if(vipBody&&f.hp<f.maxHp*0.5) key="escape";        // 본체 VIP 가 위험하면 도망 조건 해제
    if(key==="time"&&B.round!==1) key="power";              // 계약 3.3 R1 한정 — 불법 선택을 만들지 않는다
    aiCmd({t:"pkgOpen",kind:"battleBuff"});
    aiCmd({t:"pkgPick",what:"buff",i:BUFF_KEYS.indexOf(key),id:B.pkgSel&&B.pkgSel.id}); // 방금 개봉이 발급한 표 번호 — 사람 모달 버튼과 같은 인가를 지난다
    return true;
  }
  /* 2) 아이템 선물 개봉 — 지금 쓸모 있는 자원을 고른다. 라운드 1회 제한에 막혀도 개봉 자체는 이득이다 */
  if(pk.itemGift>0){
    const usable=f.skills?f.skills.filter((sid,i)=>slotUsable(f,i,side)):[];
    let want="potion";
    if(f.burn||f.weaken||f.shock) want="cure";
    else if(f.skills&&!usable.length) want="cool";
    else if(f.hp>f.maxHp*0.7&&opp.hp<opp.maxHp*0.4&&!S.reserve[ownerP]) want="ball"; // 포획 기회가 가까우면 볼
    aiCmd({t:"pkgOpen",kind:"itemGift"});
    aiCmd({t:"pkgPick",what:"gift",i:GIFT_PICKS.indexOf(want),id:B.pkgSel&&B.pkgSel.id});
    return true;
  }
  return false;
}
function aiBattleAction(){
  const B=S.battle; if(!B) return;
  const side=actorOfPhase(), f=side==="A"?B.fa:B.fd, opp=side==="A"?B.fd:B.fa;
  const ownerP=side==="A"?B.attP.owner:B.defP.owner;
  if(!isAI(ownerP)) return;
  if(aiLevelOf(ownerP)==="dan5"){ aiBattleActionStrong(side); return; } // #21 5단 전투 행동 (기대치 기반)
  const prof=aiProf(ownerP), caut=aiCaution(ownerP); // T6 전투 성향 프로파일
  const inBonus=!!(B.bonus&&B.bonus.stage==="active"&&B.bonus.side===side); // #241 R1 번개 꼬리 추가 공격 — 스킬 선택만 합법(L17)
  if(!inBonus){
  if(aiPkgAction(side)) return; // #121 계약 2.2·3: 무료 패키지 개봉·버프를 먼저 (행동 미소모 — 코어가 재고를 줄여 루프가 생기지 않는다)
  // 보너스 아이템 — 사용 임계 프로파일화 (신중할수록 일찍 회복)
  // #121 계약 2.3: 전투당 2회(itemPerBattle)·연속 동일 금지(lastItem) 제한 제거 — 라운드 1회(itemRound)만 남는다
  const itemRound=side==="A"?B.itemRoundA:B.itemRoundD;
  if(!itemRound){
    const inv=S.inv[ownerP];
    let use=-1;
    if(f.hp<f.maxHp*(0.25+0.15*caut)&&inv.includes("potion")) use=inv.indexOf("potion");
    else if((f.burn||f.weaken)&&inv.includes("cure")) use=inv.indexOf("cure");
    if(use>=0){ aiCmd({t:"item",i:use}); return; } // 모달 재렌더 → 재스케줄
  }
  // #12 적 하수인 포획: 게이트 충족 시 확률적 투척 (capture 프로파일 가중)
  const oppPc=side==="A"?B.defP:B.attP, thrown=side==="A"?B.ballThrowA:B.ballThrowD;
  if(oppPc.type==="minion"&&opp.hp<opp.maxHp*0.3&&S.balls[ownerP]>0&&!S.reserve[ownerP]&&!thrown
     &&rand()<0.4+0.4*prof.capture){ aiCmd({t:"ball"}); return; }
  // #13 도망: 동료·왕 본체 또는 열세 전투원 (caution 가중)
  const myPc=side==="A"?B.attP:B.defP;
  /* #146: 규칙상 도망은 HP 조건이 없다. 아래 임계는 **AI 의 판단 휴리스틱**이지 규칙 게이트가 아니다
     (도망의 수호자를 쓴 전투원은 성공률이 70% 라 열세가 아니어도 후보로 본다). */
  if((f.hp<f.maxHp*0.5||f.fleeBoost)&&!f.fleeLock){ // #234 뿌리 고정이면 도망 후보에서 뺀다 (불법 선택 금지)
    const vipBody=(myPc.type==="ally"||myPc.type==="king")&&f===myPc;
    const losing=f.hp/f.maxHp<opp.hp/opp.maxHp-0.15;
    if((vipBody||losing)&&rand()<(vipBody?0.5:0.25)*caut){ aiCmd({t:"flee"}); return; }
  }
  } // !inBonus
  // 행동 선택 — 4슬롯 점수화 (킬 가능>시그니처>효과기>안정기, 저HP 시 회복/방어) + T6 프로파일 가중·확률 혼합
  // 공정 관측: 자기 기술·상대의 공개 전투 정보(HP·보호막·상태·속성)만 사용, 상대 미공개 기술 미참조
  if(!f.skills){
    if(f.skillAtk&&f.cd===0&&rand()<0.5){ aiCmd({t:"act",k:"skill"}); return; } // 구형 경로 잔여
    aiCmd({t:"act",k:"basic"}); return;
  }
  // #121 계약 5.3: 쿨만이 아니라 **봉인·조건 미충족**도 불법이다. AI 는 slotUsable 로 합법 슬롯만 본다 (불법 선택 금지)
  const usable=f.skills.map((sid,i)=>({i,sk:SKILLS[sid]})).filter(x=>slotUsable(f,x.i,side));
  if(!usable.length){ aiCmd({t:"pass"}); return; } // #146: 합법 슬롯이 없으면 기본 공격이 아니라 전투 행동을 넘긴다 (사람 UI 와 같은 규칙)
  const multOf=el=>{ // #92 기대 피해 상성은 기술 속성(공격기) 기준 — 기본 공격·시그니처는 본체 속성
    const adv=el&&opp.element&&BEATS[el]===opp.element, disadv=el&&opp.element&&BEATS[opp.element]===el;
    return (adv?BAL.advMult:disadv?BAL.disMult:1)*(f.weaken>0?(1-BAL.weakenPct):1); };
  const lowHp=f.hp<f.maxHp*(0.3+0.15*caut);
  const scored=usable.map(({i,sk})=>{
    let sc=0;
    const atkEl=atkElOf(f,sk), statusKey={fire:"burn",water:"weaken",lightning:"shock",land:"crack"}[atkEl]; // 상태 키도 기술 속성 (#92) · #234 땅=균열
    if(sk.pow){ // 피해 기술
      const adj=aiV2DmgAdj(side,f,sk); // #241 추가 공격 60% · 천둥 낙인 선턴 · 번개 꼬리 · 예정 선턴(감전·선턴 효과) · 거울 수면
      const est=slotPow(f,sk)*multOf(atkEl)*(f.focusCharge&&sk.kind==="attack"?1.2:1)*adj[0];
      sc=6+est/4+adj[1];
      if(est*(1-BAL.dmgVar)>=opp.hp+opp.shield) sc=100; // 킬 가능 최우선
      else if(sk.kind==="sig") sc+=5;
      if(sk.status&&statusKey&&!opp[statusKey]) sc+=4;
      if(sk.bonusVsShield&&opp.shield>0) sc+=3;
      if(sk.bonusVsStatus&&(opp.burn||opp.weaken||opp.shock||opp.crack)) sc+=3; // #233 (4.5) 균열 포함 — 라이브 규칙과 같은 조건
      if(sk.selfVuln&&lowHp) sc-=6; // 저HP에 결정타 반동 위험
      sc*=prof.aggression;
    } else if(sk.v2){ sc=aiV2SupportScore(f,sk,lowHp,side,opp); if(lowHp&&sk.fx!=="tsunami") sc*=caut; // #234 비피해 스킬 — 자기 스킬 힌트 + (#241 해일 예고) 공개 수치
    } else { // 보조기·불굴 진형
      if(sk.healPct) sc=lowHp?20+10*caut:2;
      else if(sk.shieldPct) sc=lowHp?14:5; // #130: 합산이므로 이미 막이 있어도 새 부여량이 그대로 더해진다 — 중복 감점(×0.3) 폐기
      else if(sk.dmgCut) sc=lowHp?10:3;
      else if(sk.focus) sc=(!f.focusCharge&&!lowHp)?7:1;
      else if(sk.coolAny) sc=f.cds.some((c,j)=>j!==i&&c>=2)?6:0.5;
      else if(sk.cleanse) sc=(f.burn||f.weaken||f.shock)?9:0.5;
      if(lowHp) sc*=caut;
    }
    return {i,sc:sc+rand()*3}; // T6 확률 혼합 유지 (결정적 패턴 해소)
  });
  scored.sort((a,b)=>b.sc-a.sc);
  const pick=(scored.length>1&&rand()<0.10)?scored[1]:scored[0]; // ε 차선 혼합
  aiCmd({t:"act",k:pick.i});
}
/* #121 계약 6·9: AI 포획 방법 선택 — 볼 보유량과 신중함(T6)만 본다. 수령 말·후보 종은 호출자가 정한다 */
function aiCapMode(own,p){
  const b=S.balls[own], caut=aiCaution(own); // T6: 신중할수록 공격 포획(실패 피해) 회피
  if(b>=2) return "safe";
  if(b===1&&p.hp>p.maxHp*Math.min(0.9,0.5*caut)) return "attack";
  return null; // 포기
}
/* #121 계약 4.2·9: AI 기술 교체 계획 — 4슬롯 어디든, 합법 선택만. 공정 관측 문제는 없다(전부 자기 말 정보).
   · 대상: 내 최초 하수인 6명 중 **살아 있고 그 기술이 없는** 말. HP 비율이 높은(오래 살) 말을 선호한다.
   · 기술: 드래곤(안정적 고위력) > 마녀(상태 2종 확정) > 사신(조건부 즉사 — 전투 후반 역전용이라 가치를 낮게 본다).
   · 슬롯: 보조기·시그니처는 남기고 위력이 가장 낮은 공격기부터 바꾼다. 공격기가 둘 다 더 강하면 보조기 중 쿨이 가장 긴 슬롯.
   난수를 쓰지 않는다(결정적) — 탐색 시점 rand 1회(후보 종) 외에 AI 경로가 시드를 더 소비하지 않게 한다. */
function aiRecruitPlan(own){
  const order=["dragon_breath","witch_prank","reaper_scythe"];
  for(const sid of order){
    const cands=rosterMinions(own).filter(m=>m.alive&&m.placed&&m.skills&&!m.skills.includes(sid));
    if(!cands.length) continue;
    cands.sort((a,b)=>(b.hp/b.maxHp)-(a.hp/a.maxHp)||a.id-b.id);
    const m=cands[0], pow=SKILLS[sid].pow||0;
    let slot=-1, worst=Infinity;
    for(let i=0;i<4;i++){ const sk=SKILLS[m.skills[i]]; if(!sk||sk.kind!=="attack") continue;
      if((sk.pow||0)<worst){ worst=sk.pow||0; slot=i; } }
    if(slot<0||(pow>0&&pow<worst)){ // 공격기를 바꿀 이유가 없으면 보조기 계열 중 쿨이 가장 긴 슬롯
      let alt=-1, longest=-1;
      for(let i=0;i<4;i++){ const sk=SKILLS[m.skills[i]]; if(!sk||sk.kind==="attack") continue;
        if(sk.cd>longest){ longest=sk.cd; alt=i; } }
      if(alt>=0) slot=alt;
    }
    if(slot>=0) return {skill:sid,targetId:m.id,slot};
  }
  return null;
}
/* #121 계약 4·6·9: AI 탐색 보상 해결 — 사람과 **같은 Core 액션**(recruit)을 타서 규칙·검사·순서가 한 곳에만 있다.
   무한 무료 행동 루프가 생기지 않도록 각 단계를 한 번씩만 전진시키고, 불법 선택은 코어가 이미 거부한다. */
function aiRecruitResolve(own,p){
  /* #245 Saturn REVISE: 토큰은 모든 step 에 필수다 — 지금 열린 recruit 의 것을 한 번 읽어 단계마다 그대로 싣는다.
     그 사이 recruit 이 갈리면(새 탐색·새 게임·턴 교대) 남은 단계는 코어가 거부한다. */
  const tk=S.recruit&&S.recruit.token, rc=(step,i)=>dispatchCoreAction({t:"recruit",step,i,token:tk});
  const recv=capReceivers(own), mode=recv.length?aiCapMode(own,p):null;
  const plan=V2_INTERP.recruitSkillSwap?aiRecruitPlan(own):null; // #234: 기술 교체가 닫힌 동안 AI 도 계획하지 않는다
  const prof=aiProf(own);
  /* 포획과 기술 교체가 모두 가능하면 capture 성향으로 고른다. 포획은 예비 전력이고 기술 교체는 지속 강화라 둘 다 가치가 있다 */
  const wantCap=!!mode&&(!plan||rand()<0.35+0.35*prof.capture);
  if(wantCap){
    rc("cap",0);
    const idx=recv.reduce((best,x,i)=>(x.type==="ally"&&recv[best].type!=="ally")?i:best,0); // 왕보다 동료에게 먼저 (왕 위험 분산)
    rc("recv",idx);
    rc("mode",CAP_MODES.indexOf(mode));
    return;
  }
  if(plan){
    rc("skills",0);
    rc("skill",NEW_SKILLS.indexOf(plan.skill));
    const ms=rosterMinions(own);
    rc("target",ms.findIndex(m=>m.id===plan.targetId));
    rc("slot",plan.slot);
    return;
  }
  rc("giveup",0); // 둘 다 불가 — 이벤트는 이미 소모됐고 턴 종료 판정으로 넘어간다
}
/* ===== #21 5단 — 탐색·추론 기반 강AI (공정 관측: 결정 시점에 고정한 가시 적 집합 V·revealed·공개 제거 집계·목격 이동 기억만 사용) =====
   구조: 후보 행동(이동·텔레포트 스왑·탐색·생략) → 1-ply 위치 평가(+강제 전투 기대치·공격 기회) → 상위 K 후보에 대해
   2-ply: 보이는 적의 최선 응수(공격·이동)로 내 평가가 얼마나 나빠지는지 감점 → 최종 = 0.4·1-ply + 0.6·최악 응수 후 평가.
   판단 시간 상한(BAL.aiStrongBudgetMs) 초과 시 남은 후보는 1-ply 순위로 처리. 반복 완화: 최근 이력 칸 복귀 감점. */
function aiLevelOf(p){return (S.aiLevel&&S.aiLevel[p])||"grade5";}
function aiUnitValue(x,me){ // 말 가치 (자기 말 또는 공개된 적 말) — 적의 포획 하수인 보유(cap)는 비공개 정보라 자기 말만 반영
  if(x.type==="king") return 200;
  if(x.type==="ally") return 40+(x.cap&&x.owner===me?25:0);
  if(x.type==="minion") return 26+(x.hp/x.maxHp)*24;
  if(x.type==="bomb") return 18;
  if(x.type==="trap") return 10;
  return 20;
}
function aiWinProb(att,def,me){ // 공개 스탯 기반 승률 추정 — 포획 하수인(cap) 출전은 자기 말(owner===me)만 가정, 적의 cap은 비공개
  const fa=(att.owner===me&&att.cap)?att.cap:att, fd=(def.owner===me&&def.cap)?def.cap:def;
  let p=0.5;
  if(fa.element&&fd.element){ if(BEATS[fa.element]===fd.element) p+=0.18; else if(BEATS[fd.element]===fa.element) p-=0.18; }
  p+=((fa.hp/fa.maxHp)-(fd.hp/fd.maxHp))*0.3;
  p+=((fa.atk||0)-(fd.atk||0))/60;
  /* #234: 왕·동료도 스킬을 가진다 — 종전 "본체 출전은 기술 없음" 보정은 대상이 없어 제거. 상대 스킬 배열은 읽지 않는다 */
  if(att.nextBattleBuff) p+=0.05;
  return Math.max(0.08,Math.min(0.92,p));
}
/* 전투 기대치 (me 관점, 양수=유리): 미공개 적은 목격 이동 여부별 폭탄·함정 확률 혼합 */
function aiBattleEV(me,att,def){
  if(att.type==="trap") return null;
  if(att.type==="bomb"){ // #106 4.4.2: 폭탄이 새로 인접하면 발동 — 하수인 추정 대상은 교환 이득, 동료·왕은 폭탄 손실, 폭탄·함정은 0. 공정 관측(revealed·목격 이동 기억만)
    const th=aiThreatOf(me,def);
    if(th==="bomb"||th==="trap") return 0;
    if(th==="unit") return def.type==="minion"?aiUnitValue(def,me)-18:-18;
    return (1-Math.min(1,aiStaticRisk(me,th==="unknownMoved")))*2; // 미공개: 하수인·동료·왕 혼합 기대치 — 소폭 양수
  }
  // #122 REVISE(2026-09-10 CJ QA 6): 왕 vs 왕도 보통 전투로 평가한다 (왕 가치 200 이 양쪽에 걸리므로 승산이 확실할 때만 고른다)
  const th=aiThreatOf(me,def), va=aiUnitValue(att,me);
  const bombEV=att.type==="minion"?-va+16:22, trapEV=-10;
  if(th==="bomb") return bombEV;
  if(th==="trap") return trapEV;
  const edgeGuard=Math.abs(def.r-(me===0?ROWS:1))<=1?45:0; // 끝줄 저지: 내 최후방 1칸 이내 적은 우선 제거 (왕 끝줄 승리 차단)
  const pressure=Math.min(1,S.turnCount/BAL.maxTurns)*8; // 후반 공세 압력 (무승부 방지)
  if(th==="unit"){
    // #122 REVISE(CJ QA 1·6): 동료/왕끼리도 보통 전투로 평가한다 (종전 밀기 우회 제거) — 왕 본체 패배 페널티는 아래 -400 항이 그대로 잡는다
    const p=aiWinProb(att,def,me);
    let ev=p*(aiUnitValue(def,me)+(def.type==="king"?400:0))-(1-p)*va;
    if(att.type==="king"&&!att.cap) ev-=(1-p)*400; // 왕 본체 패배 = 경기 패배
    else ev+=4; // 선제 보너스: 인접 적은 어차피 다음 턴 나를 칠 수 있음 — 공격측 선공 이득
    return ev+edgeGuard+pressure;
  }
  const r=Math.min(1,aiStaticRisk(me,th==="unknownMoved")), trapShare=th==="unknownMoved"?0:0.35;
  const p=aiWinProb(att,{element:null,hp:100,maxHp:100,atk:22,type:"minion"},me);
  let unitEV=p*28-(1-p)*va;
  if(att.type==="king"&&!att.cap) unitEV-=(1-p)*400;
  return r*(bombEV*(1-trapShare)+trapEV*trapShare)+(1-r)*unitEV+edgeGuard*(att.type==="king"?0:1)+pressure;
}
/* 위치 평가 — V: 결정 시점 고정 가시 적 목록 (가상 이동 중 새로 인접해도 숨은 말은 절대 참조하지 않음).
   #245 Saturn REVISE(M2): 말미 state 인자는 다른 판정 헬퍼와 같은 규약이다 (기본 S). 5단 탐색은 **사본 보드**를 넘겨
   실제 말의 r/c 를 잠시 고쳤다 되돌리는 일을 없앤다 — 평가 중 어떤 관찰자도 거짓 위치를 보지 않는다. 계산식은 그대로다. */
function aiEvalPos(me,V,state){
  const st=state||S;
  const my=alivePieces(st).filter(x=>x.owner===me);
  const king=my.find(x=>x.type==="king");
  const units=V.filter(e=>!(e.revealed&&(e.type==="bomb"||e.type==="trap")));
  const dist=(a,b)=>Math.abs(a.r-b.r)+Math.abs(a.c-b.c);
  let v=0;
  for(const x of my) v+=aiUnitValue(x,me);
  for(const e of st.pieces.filter(e=>e.owner!==me&&e.alive&&e.placed)) v-=e.revealed?aiUnitValue(e,me):28; // 잔여 수는 공개 정보(제거 공개), 정체는 공개 시만
  const goal=me===0?1:ROWS, last=me===0?ROWS:1;
  if(king){
    const danger=units.filter(e=>dist(e,king)===1).length, near=units.filter(e=>dist(e,king)===2).length;
    v-=danger*48+near*10;
    v+=my.filter(b=>b.type==="bomb"&&dist(b,king)===1).length*6;
    if(inForest(king)) v+=3;
    const dg=Math.abs(king.r-goal);
    if(dg===0) v+=1000;
    else v+=(12-dg)*(danger===0&&near===0?4:1);
    if(zoneOf(1-me).includes(king.r)&&danger) v-=40;
  }
  const eking=V.find(e=>e.type==="king"&&e.revealed);
  for(const e of units){ // 끝줄 저지: 내 최후방 접근 적은 큰 감점, 내 말이 붙어 있으면 완화
    const d=Math.abs(e.r-last);
    if(d<=2){ v-=(3-d)*18; if(d<=1){ v-=30; if(my.some(x=>x.type!=="bomb"&&x.type!=="trap"&&dist(x,e)===1)) v+=28; } }
  }
  for(const x of my){
    if(x.type==="minion"){ v+=(me===1?x.r:ROWS+1-x.r)*1.2+(4-Math.abs(x.c-4))*0.5; if(eking) v+=(10-Math.min(10,dist(x,eking)))*3; }
    if(x.type==="ally"){ if(eking) v+=(10-Math.min(10,dist(x,eking)))*2; }
    if(canSearchPiece(x)){
      const ev=st.events.find(e=>e.r===x.r&&e.c===x.c&&!e.consumed&&st.traces[me].has(e.r+"_"+e.c));
      if(ev) v+=10;
      if((x.type==="ally"||x.type==="king")&&st.balls[me]>0&&!x.cap&&!st.reserve[me]){
        const df=Math.min(...(me===1?[4,5]:[9,10]).map(tr=>Math.abs(x.r-tr)));
        v+=(5-Math.min(5,df))*(x.type==="king"?0.8:2);
      }
    }
    if(x.type==="bomb"){ if(units.some(e=>e.type!=="king"&&dist(e,x)===1)) v+=5; if(x.revealed) v-=6; }
    if(x.type!=="bomb"&&x.type!=="trap"&&x.type!=="king") // 접촉 압력(불리한 인접은 감점) — 상세 응수는 2-ply가 처리
      for(const e of units) if(dist(x,e)===1){ const p=aiWinProb(x,e.revealed?e:{element:null,hp:100,maxHp:100,atk:22,type:"minion"},me); v+=(p-0.5)*10; }
  }
  v+=st.balls[me]*3+(st.reserve[me]?15:0)+st.inv[me].length*2;
  return v;
}
/* 2-ply: 보이는 적의 최선 응수(내 말 공격 또는 1칸 이동) 후 내 평가의 최악값 */
function aiWorstReply(me,V,deadline,state){
  const st=state||S; // #245 M2: V 도 이 보드의 말이다 — 아래 이동 응수는 **사본 말**의 r/c 만 잠시 바꾼다
  const my=alivePieces(st).filter(x=>x.owner===me), occ=(r,c)=>my.some(x=>x.r===r&&x.c===c)||V.some(e=>e.r===r&&e.c===c);
  const base=aiEvalPos(me,V,st);
  let worst=base, n=0;
  for(const e of V){
    if(e.revealed&&(e.type==="bomb"||e.type==="trap")) continue;
    if(e.immobile>0) continue;
    for(const x of my){ // 공격 응수: 내 말 x를 e가 공격 (내 관점 EV 부호 반전은 x가 방어자)
      if(Math.abs(e.r-x.r)+Math.abs(e.c-x.c)!==1) continue;
      if(x.type==="bomb"||x.type==="trap") continue; // 적이 내 폭탄·함정을 치면 나에게 이득 → 최선 응수 아님
      // #122 REVISE(CJ QA 1·6): 공개 동료/왕이 내 동료/왕(왕↔왕 포함)을 치면 이제 실제 전투다 — 손실 응수 계산에서 빼지 않는다
      const p=1-aiWinProb(e.revealed?e:{element:null,hp:100,maxHp:100,atk:22,type:"minion"},x,me);
      const harm=(1-p)*(aiUnitValue(x,me)+(x.type==="king"?400:0))-p*(e.revealed?aiUnitValue(e,me):28);
      worst=Math.min(worst,base-harm); n++;
    }
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){ // 이동 응수
      const r=e.r+dr,c=e.c+dc; if(r<1||r>ROWS||c<1||c>COLS||occ(r,c)) continue;
      const or=e.r,oc=e.c; e.r=r;e.c=c;
      worst=Math.min(worst,aiEvalPos(me,V,st)); n++;
      e.r=or;e.c=oc;
      if(n>=BAL.aiStrongReplyCap||Date.now()>deadline) return worst;
    }
  }
  return worst;
}
/* #245 Saturn REVISE(M2): 5단 탐색이 쓰는 **사본 보드**. 상태는 얕게, 말만 복제한다 —
   판정에 쓰는 것은 말의 r/c 뿐이고 events·traces·balls·reserve·inv 는 탐색 중 바뀌지 않으므로 원본을 공유한다
   (그래서 고른 흔적 ev 가 실제 S.events 의 그 객체다 — 실행 시 되찾을 필요가 없다).
   이 사본 위에서만 가상 이동을 하므로 실제 말의 좌표는 평가 내내 한 번도 움직이지 않는다. */
function aiCloneBoard(){ return Object.assign({},S,{pieces:S.pieces.map(p=>Object.assign({},p))}); }
function aiMainStrong(me){
  const t0=Date.now(), deadline=t0+BAL.aiStrongBudgetMs;
  const sim=aiCloneBoard();                                   // 평가 전용 사본 — 실제 보드는 건드리지 않는다
  const byId=new Map(sim.pieces.map(p=>[p.id,p]));
  const V=aiVisible(me).map(e=>byId.get(e.id)||e);            // 결정 시점 고정 가시 집합 (사본 말로)
  const my=alivePieces(sim).filter(x=>x.owner===me);
  const real=id=>S.pieces.find(p=>p.id===id);                 // 실행할 때만 실제 말로 되돌린다
  const hist=aiMem().hist[me];
  /** @type {any[]} */ const cands=[]; // 후보는 종류마다 필드가 다르고 2-ply 점수(s2)가 나중에 붙는다
  const virt=(fn)=>{ // 가상 적용 → 평가 → 복원 (전부 사본 말 위에서)
    const snap=my.map(x=>[x,x.r,x.c]); fn();
    const s=aiEvalPos(me,V,sim);
    for(const [x,r,c] of snap){x.r=r;x.c=c;}
    return s;
  };
  const forcedGain=(p,before)=>{ // 이동 후 새로 인접한 보이는 적과의 강제 전투 기대치 (내가 대상 선택 → 최대) — 없으면 0
    let best=null;
    for(const e of V){ if(Math.abs(e.r-p.r)+Math.abs(e.c-p.c)!==1||before.has(e.id)) continue;
      const ev=aiBattleEV(me,p,e); if(ev===null) continue; if(best===null||ev>best) best=ev; }
    return best===null?0:best;
  };
  const attackOpp=()=>{ // 이동 후 가능한 최선 공격 기회(양수만, 0.8 가중) — 폭탄은 능동 공격 불가라 제외 (#106)
    let best=0;
    for(const x of my) for(const e of V){ if(x.type==="bomb"||Math.abs(e.r-x.r)+Math.abs(e.c-x.c)!==1) continue;
      const ev=aiBattleEV(me,x,e); if(ev!==null&&ev>best) best=ev; }
    return best*0.8;
  };
  const adjIds=p=>new Set(V.filter(e=>Math.abs(e.r-p.r)+Math.abs(e.c-p.c)===1).map(e=>e.id));
  const hiddenLeft=sim.pieces.filter(e=>e.owner!==me&&e.alive&&e.placed).length-V.length; // 아직 보이지 않는 적 말 수 (공개 정보: 총 잔여 − 가시)
  const unseenForestAdj=(r,c,mover)=>{ // (r,c)에 인접한 숲 칸 중 내 다른 말이 인접하지 않아 관측되지 않는 칸 수
    let n=0;
    for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]){ const fr=r+dr,fc=c+dc;
      if(fr<1||fr>ROWS||fc<1||fc>COLS||!inForest({r:fr,c:fc})) continue;
      if(my.some(x=>x!==mover&&Math.abs(x.r-fr)+Math.abs(x.c-fc)<=1)) continue;
      n++; }
    return n;
  };
  // 후보 1: 탐색
  for(const p of my.filter(canSearchPiece)){
    const ev=sim.events.find(e=>e.r===p.r&&e.c===p.c&&!e.consumed&&sim.traces[me].has(e.r+"_"+e.c));
    if(ev) cands.push({kind:"search",p,ev,s1:aiEvalPos(me,V,sim)+14+attackOpp(),desc:"탐색"});
  }
  // 후보 1b (#106 6.3 권고): 회복 — 가시 인접 적이 없고 HP<60% 인 자기 말. 타이브레이크 난수를 쓰지 않아 기존 rand 소비 순서를 바꾸지 않는다
  for(const p of my.filter(x=>canHeal(x)&&x.hp<x.maxHp*0.6&&!V.some(e=>Math.abs(e.r-x.r)+Math.abs(e.c-x.c)===1)))
    cands.push({kind:"heal",p,s1:aiEvalPos(me,V,sim)+(1-p.hp/p.maxHp)*24+(p.type==="king"?8:0)+attackOpp(),desc:"회복",noTie:true});
  // 후보 2: 이동 (폭탄 포함·함정 제외 — canMoveTo가 규칙 처리)
  for(const p of my.filter(x=>x.immobile===0&&x.type!=="trap")){
    for(const [r,c] of aiMoveOptions(p,sim)){
      const before=adjIds(p);
      let s1=virt(()=>{p.r=r;p.c=c;});
      { const or=p.r,oc=p.c; p.r=r;p.c=c; s1+=forcedGain(p,before)+attackOpp(); p.r=or;p.c=oc; } // 강제 전투 기대치·공격 기회
      if(hist.some(h=>h.id===p.id&&h.r===r&&h.c===c)) s1-=6; // 반복 완화
      if(p.type==="king"&&r===(me===0?1:ROWS)) s1+=1000;
      if(p.type==="king"&&hiddenLeft>0) s1-=unseenForestAdj(r,c,p)*22; // 왕: 도착 칸에 인접한 관측 불가 숲 칸마다 감점 (숨은 적 강제 전투 위험)
      cands.push({kind:"move",p,r,c,s1,desc:"이동"});
    }
  }
  // 후보 3: 텔레포트 스왑 — 왕↔침투 말(러시)·왕↔후방(구출)·폭탄↔전방 하수인(미끼) 상한 12
  if(teleportAvailable(me)&&S.teleUsed[me]<BAL.teleMax){
    const king=my.find(x=>x.type==="king"&&x.immobile===0);
    const pairs=[];
    if(king) for(const x of my.filter(x=>x.id!==king.id&&x.immobile===0)) pairs.push([king,x]);
    for(const b of my.filter(x=>x.type==="bomb"&&x.immobile===0)) for(const m of my.filter(x=>x.type==="minion"&&x.immobile===0&&zoneOf(1-me).includes(x.r))) pairs.push([b,m]);
    for(const [a,b] of pairs.slice(0,12)){
      const ba=adjIds(a), bb=adjIds(b);
      const s1=virt(()=>{const ar=a.r,ac=a.c; a.r=b.r;a.c=b.c; b.r=ar;b.c=ac;})
        +(()=>{const ar=a.r,ac=a.c; a.r=b.r;a.c=b.c; b.r=ar;b.c=ac; const g=forcedGain(a,ba)+forcedGain(b,bb)+attackOpp(); b.r=a.r;b.c=a.c; a.r=ar;a.c=ac; return g;})()
        -8; // 기존 주 행동 소모 비용
      cands.push({kind:"tele",a,b,s1,desc:"텔레포트"});
    }
  }
  // 후보 4: 생략 (위치 보존)
  cands.push({kind:"skip",s1:aiEvalPos(me,V,sim)+attackOpp()-2,desc:"생략"});
  for(const c of cands) if(!c.noTie) c.s1+=rand()*0.5; // 동점 타이브레이크 (시드 재현 가능) — 회복 후보는 제외(난수 소비 불변)
  cands.sort((a,b)=>b.s1-a.s1);
  // 2-ply: 상위 K 후보에 대해 최악 응수 반영
  const top=cands.slice(0,BAL.aiStrongTopK);
  for(const c of top){
    if(Date.now()>deadline){ c.s2=c.s1; continue; }
    const snap=my.map(x=>[x,x.r,x.c]);
    if(c.kind==="move"){c.p.r=c.r;c.p.c=c.c;}
    else if(c.kind==="tele"){const ar=c.a.r,ac=c.a.c; c.a.r=c.b.r;c.a.c=c.b.c; c.b.r=ar;c.b.c=ac;}
    const worst=aiWorstReply(me,V,deadline,sim);
    for(const [x,r,c2] of snap){x.r=r;x.c=c2;}
    c.s2=0.4*c.s1+0.6*(worst+(c.s1-aiEvalPos(me,V,sim))); // 최악 응수 후 평가에 내 행동의 즉시 이득(강제 전투·공격 기회)을 유지
  }
  top.sort((a,b)=>b.s2-a.s2);
  aiMem().lastThinkMs=Date.now()-t0; // #245 M2: 사고 시간은 표시 전용 어댑터 기록 (게임 상태가 아니다)
  /* 실행은 **실제 보드의 말**로 한다 — 위 평가는 전부 사본 위에서 끝났다 (텔레포트 차단 시 다음 후보) */
  for(const c of top){
    if(c.kind==="search"){ aiSearch(real(c.p.id),c.ev); return; }
    if(c.kind==="heal"){ if(aiHeal(real(c.p.id),false)){ return; } continue; } // 5단 회복은 종전대로 기록만 (토스트 없음)
    if(c.kind==="move"){ hist.push({id:c.p.id,r:c.p.r,c:c.p.c}); if(hist.length>6) hist.shift();
      aiMove(real(c.p.id),c.r,c.c); return; }
    if(c.kind==="tele"){ if(aiTele(real(c.a.id),real(c.b.id))){ return; } continue; }
    aiSkip(); return;
  }
  aiSkip(false);
}
/* 5단 전투 개시 선택: 기대치 기반 (canBattle·가시 대상만) */
function aiEvalBattlesStrong(me){
  let best=null;
  for(const att of alivePieces().filter(p=>p.owner===me))
    for(const def of adjEnemies(att)){
      if(!visibleTo(me,def)||!canBattle(att,def)) continue;
      const ev=aiBattleEV(me,att,def); if(ev===null) continue;
      if(!best||ev>best.score) best={att,def,score:ev};
    }
  return best&&best.score>2?best:null;
}
/* 5단 전투 중 행동: 킬 가능·피해 경쟁(누가 먼저 쓰러지는가) 기반으로 아이템·볼 투척·도망·기술을 결정 — 상대 미공개 기술은 참조하지 않고 공개 스탯(atk)·속성만 사용 */
function aiBattleActionStrong(side){
  const B=S.battle; if(!B) return;
  const f=side==="A"?B.fa:B.fd, opp=side==="A"?B.fd:B.fa;
  const ownerP=side==="A"?B.attP.owner:B.defP.owner, myPc=side==="A"?B.attP:B.defP, oppPc=side==="A"?B.defP:B.attP;
  const multOf=el=>{ // #92 내 기대 피해 상성은 기술 속성(공격기) 기준 — 기본 공격·시그니처는 본체 속성
    const adv=el&&opp.element&&BEATS[el]===opp.element, disadv=el&&opp.element&&BEATS[opp.element]===el;
    return (adv?BAL.advMult:disadv?BAL.disMult:1)*(f.weaken>0?(1-BAL.weakenPct):1)*(f.atkBuff?1+BAL.nextBuffPct:1); };
  // 상대 기대 피해: 상대 미공개 기술은 참조하지 않으므로(공정 관측) 상대 본체 속성 vs 내 본체 속성(방어 상성)으로 추정 — 현행 유지
  const oAdv=opp.element&&f.element&&BEATS[opp.element]===f.element, oDis=opp.element&&f.element&&BEATS[f.element]===opp.element;
  const oppEst=(opp.atk||16)*1.18*(oAdv?BAL.advMult:oDis?BAL.disMult:1)*(opp.weaken>0?(1-BAL.weakenPct):1)*(f.dmgCut?1-f.dmgCut:1);
  const usable=f.skills?f.skills.map((sid,i)=>({i,sk:SKILLS[sid]})).filter(x=>slotUsable(f,x.i,side)):[]; // #121 계약 5.3: 봉인 포함 합법 슬롯만
  const dmgOf=sk=>(sk?slotPow(f,sk):f.atk)*multOf(atkElOf(f,sk))*(f.focusCharge&&sk&&sk.kind==="attack"?1.2:1)*(sk?aiV2DmgAdj(side,f,sk)[0]:1); // #241 추가 공격 60% 등
  const inBonus=!!(B.bonus&&B.bonus.stage==="active"&&B.bonus.side===side); // #241 R1 번개 꼬리 추가 공격 — 스킬 선택만 합법(L17)
  let bestDmg=f.atk*multOf(f.element), bestSlot=-1;
  for(const {i,sk} of usable) if(sk.pow&&dmgOf(sk)>bestDmg){bestDmg=dmgOf(sk); bestSlot=i;}
  const killNow=bestDmg*(1-BAL.dmgVar)>=opp.hp+opp.shield;
  const toKillMe=Math.ceil(Math.max(1,f.hp)/Math.max(1,oppEst)), toKillOpp=Math.ceil((opp.hp+opp.shield)/Math.max(1,bestDmg));
  const losing=toKillMe<toKillOpp;
  if(!inBonus){
  if(aiPkgAction(side)) return; // #121 계약 2.2·3: 무료 패키지 개봉·버프 우선 (행동 미소모)
  // 아이템: 사망 위기면 회복약(다음 피격 생존), 상태이상이면 해독제 — #121 계약 2.3: 라운드 1회만 남는다
  const itemRound=side==="A"?B.itemRoundA:B.itemRoundD;
  if(!itemRound){
    const inv=S.inv[ownerP]; let use=-1;
    if(!killNow&&f.hp<=oppEst*1.25&&inv.includes("potion")) use=inv.indexOf("potion");
    else if((f.burn||f.weaken||f.shock)&&inv.includes("cure")&&toKillOpp>1) use=inv.indexOf("cure");
    else if(!usable.length&&f.skills&&inv.includes("cool")) use=inv.indexOf("cool");
    if(use>=0){ aiCmd({t:"item",i:use}); return; }
  }
  // 볼 투척: 게이트 충족 시 포획(제거+예비 확보)이 킬보다 가치 큼 — 확정 킬이고 내 HP가 위험할 때만 킬 우선
  const thrown=side==="A"?B.ballThrowA:B.ballThrowD;
  if(oppPc.type==="minion"&&opp.hp<opp.maxHp*0.3&&S.balls[ownerP]>0&&!S.reserve[ownerP]&&!thrown&&(!killNow||f.hp>f.maxHp*0.6)){ aiCmd({t:"ball"}); return; }
  // 도망: 본체 VIP가 죽을 위기이거나 열세 전투 (확정 킬 가능하면 안 함)
  if((f.hp<f.maxHp*0.5||f.fleeBoost)&&!killNow&&!f.fleeLock){ // #146: 규칙 게이트가 아니라 5단 AI 의 휴리스틱 임계 (도망의 수호자는 성공률 70%)
    const vipBody=(myPc.type==="ally"||myPc.type==="king")&&f===myPc;
    if((vipBody&&(losing||toKillMe<=1))||(losing&&toKillMe<=2)){ aiCmd({t:"flee"}); return; }
  }
  } // !inBonus
  if(!f.skills){ if(f.skillAtk&&f.cd===0){aiCmd({t:"act",k:"skill"});return;} aiCmd({t:"act",k:"basic"}); return; }
  if(!usable.length){ aiCmd({t:"pass"}); return; } // #146: 5단도 같은 규칙 — 폴백 기본 공격은 없다
  const lowHp=f.hp<=oppEst*1.5;
  const scored=usable.map(({i,sk})=>{
    let sc=0;
    const statusKey={fire:"burn",water:"weaken",lightning:"shock",land:"crack"}[atkElOf(f,sk)]; // 상태 키는 기술 속성 (#92)
    if(sk.pow){
      const est=dmgOf(sk);
      sc=est/3;
      if(est*(1-BAL.dmgVar)>=opp.hp+opp.shield) sc=100;
      else if(est>=opp.hp+opp.shield) sc=60; // 분산 상단으로 킬 가능
      if(sk.kind==="sig") sc+=3;
      sc+=aiV2DmgAdj(side,f,sk)[1]; // #241 예정 선턴(감전·선턴 효과) · 거울 수면
      if(sk.status&&statusKey&&!opp[statusKey]) sc+=4;
      if(sk.drainPct&&lowHp) sc+=4;
      if(sk.selfShieldPct&&lowHp) sc+=3;
      if(sk.bonusVsShield&&opp.shield>0) sc+=2;
      if(sk.bonusVsStatus&&(opp.burn||opp.weaken||opp.shock||opp.crack)) sc+=2; // #233 (4.5) 균열 포함 — 라이브 규칙과 같은 조건
      if(sk.selfVuln&&lowHp) sc-=8;
    } else if(sk.v2){ sc=aiV2SupportScore(f,sk,lowHp,side,opp);
    } else {
      if(sk.healPct) sc=(lowHp&&toKillOpp>1)?25:1;
      else if(sk.shieldPct) sc=(lowHp&&toKillOpp>1)?16:4; // #130: 합산 — 중복 감점(×0.3) 폐기
      else if(sk.dmgCut) sc=lowHp&&toKillOpp>1?12:2;
      else if(sk.focus) sc=(!f.focusCharge&&toKillOpp>=2&&!lowHp)?8:0.5;
      else if(sk.coolAny) sc=f.cds.some((c,j)=>j!==i&&c>=2)?5:0.3;
      else if(sk.cleanse) sc=(f.burn||f.weaken||f.shock)?9:0.3;
    }
    return {i,sc:sc+rand()*0.3};
  });
  scored.sort((a,b)=>b.sc-a.sc);
  aiCmd({t:"act",k:scored[0].i});
}
/* AI 로스터 선택: 5속성 각 1종 + 나머지 1종 무작위 (중복 없음, 아키타입 혼합 선호) — #234 30종 후보 · 모두 ⭐1.
   #245: 상태를 쓰지 않고 **고른 6종을 돌려주기만** 한다 — 적용(roster 대입·applyRoster)은 Core 의 setupAuto 가 한다.
   난수 소비 순서·횟수는 분리 전과 같다 (아키타입 셔플 → 속성 셔플 → 나머지 셔플 → 최종 셔플). */
function aiPickRoster(p){
  if(S.roster[p].length===6) return S.roster[p].slice();
  const picked=[];
  const archs=shuffle(["std","atk","def","swift","sustain","guard"]);
  shuffle(V2_ELEM_ORDER.slice()).forEach((el,i)=>{
    const pool=ROSTER.filter(r=>r.element===el);
    picked.push((pool.find(r=>r.arch===archs[i%archs.length])||pool[0]).id);
  });
  const rest=shuffle(ROSTER.filter(r=>!picked.includes(r.id)).map(r=>r.id));
  picked.push(rest[0]);
  shuffle(picked);
  return picked;
}
/* AI 휴리스틱 배치 — #245: 말을 직접 옮기지 않고 좌표 목록만 만들어 Core 의 setupAuto 액션으로 넘긴다.
   판정에 쓰는 보드는 **지금 놓인 말 + 이번에 놓기로 한 자리**다 (종전에는 말을 바로 옮겨 at() 가 그 사실을 보았다) —
   같은 순서·같은 난수·같은 결과이며, 배치가 실제로 상태가 되는 자리는 reducer 한 곳뿐이다. */
function aiAutoPlace(p){
  const roster=aiPickRoster(p);
  const rows=zoneOf(p);
  const back = p===1?rows[0]:rows[2];     // 후열
  const mid  = rows[1];
  const front= p===1?rows[2]:rows[0];     // 전열
  const taken=new Set(alivePieces().map(x=>x.r+"_"+x.c)), spot=new Map(), positions=[];
  const free=(r,c)=>r>=1&&r<=ROWS&&c>=1&&c<=COLS&&rows.includes(r)&&!taken.has(r+"_"+c);
  const put=(x,r,c)=>{positions.push({id:x.id,r,c}); taken.add(r+"_"+c); spot.set(x.id,{r,c});};
  const mine=t=>S.pieces.filter(x=>x.owner===p&&x.type===t&&!x.placed);
  // 왕: 후열(80%) 또는 중열(20% 블러핑), 무작위 열
  const king=mine("king")[0];
  {const kr=rand()<0.8?back:mid; const cols=shuffle([1,2,3,4,5,6,7]);
   put(king,kr,cols.find(c=>free(kr,c)));}
  const kp=spot.get(king.id); // 방금 정한 왕의 자리 (종전에는 king.r/king.c 가 이미 그 값이었다)
  // 폭탄: 1~2개 왕 인접 호위, 나머지 무작위
  const bombs=mine("bomb"); let guard=0;
  for(const b of bombs){
    if(guard<2){
      const spots=shuffle([[kp.r+1,kp.c],[kp.r-1,kp.c],[kp.r,kp.c+1],[kp.r,kp.c-1]]).filter(([r,c])=>free(r,c));
      if(spots.length){put(b,spots[0][0],spots[0][1]);guard++;continue;}
    }
    aiPutRandom(b,rows,free,put);
  }
  // 함정: 전열 중앙(3~5열) 침투로
  for(const t of mine("trap")){
    const spots=shuffle([[front,3],[front,4],[front,5],[mid,3],[mid,4],[mid,5]]).filter(([r,c])=>free(r,c));
    if(spots.length) put(t,spots[0][0],spots[0][1]); else aiPutRandom(t,rows,free,put);
  }
  // 동료: 측면(1·2·6·7열) 숲 접근
  for(const a of mine("ally")){
    const spots=shuffle([[front,1],[front,2],[front,6],[front,7],[mid,1],[mid,7]]).filter(([r,c])=>free(r,c));
    if(spots.length) put(a,spots[0][0],spots[0][1]); else aiPutRandom(a,rows,free,put);
  }
  // 하수인: 전열 우선, 속성 분산 유지
  for(const m of mine("minion")){
    const spots=[];
    for(const c of shuffle([1,2,3,4,5,6,7])){ if(free(front,c)) spots.push([front,c]); }
    for(const c of shuffle([1,2,3,4,5,6,7])){ if(free(mid,c)) spots.push([mid,c]); }
    if(spots.length) put(m,spots[0][0],spots[0][1]); else aiPutRandom(m,rows,free,put);
  }
  dispatchCoreAction({t:"setupAuto",player:p,roster,positions}); // #245: 로스터·좌표가 상태가 되는 자리는 Core 한 곳뿐이다
}
function aiPutRandom(x,rows,free,put){
  const cells=[]; for(const r of rows) for(let c=1;c<=COLS;c++) if(free(r,c)) cells.push([r,c]);
  shuffle(cells); put(x,cells[0][0],cells[0][1]);
}
