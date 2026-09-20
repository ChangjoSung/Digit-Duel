"use strict";
/* #245 점진 Core 경계: reducer는 입력 상태를 바꾸지 않고 다음 상태와 표시 event만 돌려준다.
   레거시 예약 콜백이 S 객체 정체성을 검사하므로 commit은 같은 S에 얕게 반영한다. */
function resolveCoreAction(state,action){
  if(action.t!=="auto") return action;
  const player=state.setupPlayer, roster=state.roster[player].slice();
  if(roster.length<6){
    const rest=shuffle(ROSTER.filter(item=>!roster.includes(item.id)).map(item=>item.id));
    while(roster.length<6) roster.push(rest.pop());
  }
  const rows=player===0?[11,12,13]:[1,2,3], cells=[];
  for(const row of rows) for(let column=1;column<=COLS;column++) cells.push([row,column]);
  shuffle(cells);
  const occupied=new Set(state.pieces.filter(piece=>piece.alive&&piece.placed).map(piece=>piece.r+"_"+piece.c)), positions=[];
  for(const piece of state.pieces.filter(piece=>piece.owner===player&&!piece.placed)){
    const cell=cells.find(([row,column])=>!occupied.has(row+"_"+column));
    positions.push({id:piece.id,r:cell[0],c:cell[1]}); occupied.add(cell[0]+"_"+cell[1]);
  }
  return {t:"setupAuto",player,roster,positions};
}
function reduceCoreAction(state,action){
  switch(action.t){
    case "cell": {
      /* #245: 플레이 중 셀 클릭 중 **텔레포트 대상 선택(단계 전이)과 자기 말 선택**을 Core 가 소유한다.
         스왑 실행·이동·전투·도망 교환은 null 로 떨어뜨려 onCellCore 가 종전대로 처리한다. */
      if(state.phase==="play"){
        if(state.battle||state.fleePick) return null;
        if((state.mode==="pve"&&state.current===1)||state.mode==="sim") return null; // isAI(S.current) 가드 — 상태 기준
        const picked=state.pieces.find(piece=>piece.alive&&piece.placed&&piece.r===action.r&&piece.c===action.c);
        const mine=!!picked&&picked.owner===state.current;
        if(state.teleport){
          /* #131: 함정에 걸린 말(immobile>0)은 양끝 어느 쪽으로도 고를 수 없다. 사유를 알리고 **현재 단계를 그대로 유지**한다.
             안내 문구는 소유자 화면에만 — 상대에게는 어떤 말을 눌렀는지도, 함정 여부도 새지 않는다 (표시 계층에서 게이팅). */
          if(mine&&picked.immobile>0) return {state,events:[{type:"teleTrapped",player:state.current,message:`🌀 ${TELE_TRAP_MSG}`}]};
          if(state.teleport.stage===1)
            return mine?{state:Object.assign({},state,{teleport:{stage:2,piece:picked}}),events:[{type:"render"}]}:{state,events:[]};
          if(picked&&state.teleport.piece&&picked.id===state.teleport.piece.id) // 첫 말 재클릭 — 선택 취소
            return {state:Object.assign({},state,{teleport:{stage:1,piece:null}}),events:[{type:"render"}]};
          return null; // 둘째 말 선택 = 스왑 실행 (onCellCore)
        }
        /* #245: 자기 말 선택. onCellCore 의 T1 강제 전투 대상 클릭과는 겹치지 않는다 — 강제 대상은 항상 상대 말이라
           여기서 가로채는 내 말 클릭과 서로 배타적이다. */
        if(mine) return {state:Object.assign({},state,{selected:picked}),events:[{type:"render"}]};
        return null; // 상대 말·빈 칸(전투 지정·메모·이동) = onCellCore
      }
      if(state.phase!=="setup") return null;
      const occupant=state.pieces.find(piece=>piece.alive&&piece.placed&&piece.r===action.r&&piece.c===action.c);
      /* #245: 좌표·대상 계약은 pre-split 과 같다 — 행은 zoneOf().includes 의 strict 일치(문자열 "11"·소수 11.5 불통과),
         열은 1..COLS 정수, 말은 실재하는 id. 이 액션은 netAction 으로 원격에서도 들어오므로 검증 전 값은 상태에 넣지 않는다. */
      const target=state.selected&&state.selected.tray?state.pieces.find(piece=>piece.id===state.selected.id):null;
      if(target&&zoneOf(state.setupPlayer).includes(action.r)&&Number.isInteger(action.c)&&action.c>=1&&action.c<=COLS&&!occupant){
        const pieces=state.pieces.map(piece=>piece===target?Object.assign({},piece,{r:action.r,c:action.c,placed:true}):piece);
        return {state:Object.assign({},state,{pieces,selected:null}),events:[{type:"render"}]};
      }
      if(occupant&&occupant.owner===state.setupPlayer){
        const pieces=state.pieces.map(piece=>piece.id===occupant.id?Object.assign({},piece,{placed:false}):piece);
        return {state:Object.assign({},state,{pieces,selected:null}),events:[{type:"render"}]};
      }
      return {state,events:[]};
    }
    case "selTray": return {state:Object.assign({},state,{selected:{tray:true,id:action.id}}),events:[{type:"render"}]};
    case "roster": {
      const player=state.setupPlayer, selected=state.roster[player], index=selected.indexOf(action.rid);
      if(index<0&&selected.length>=6) return {state,events:[{type:"toast",message:"이미 6종을 모두 선택했습니다. 다른 종을 해제 후 선택하세요."}]};
      const next=Object.assign({},state,{roster:state.roster.map(x=>x.slice()),pieces:state.pieces.map(x=>Object.assign({},x)),selected:null});
      if(index>=0) next.roster[player].splice(index,1); else next.roster[player].push(action.rid);
      for(const piece of next.pieces) if(piece.owner===player&&piece.type==="minion") piece.placed=false;
      applyRoster(player,next);
      return {state:next,events:[{type:"setupRosterChanged",complete:next.roster[player].length===6}]};
    }
    case "clear": {
      const player=state.setupPlayer, pieces=state.pieces.map(piece=>piece.owner===player?Object.assign({},piece,{placed:false}):piece);
      return {state:Object.assign({},state,{pieces,selected:null}),events:[{type:"render"}]};
    }
    case "setupAuto": {
      const next=Object.assign({},state,{roster:state.roster.map(x=>x.slice()),pieces:state.pieces.map(x=>Object.assign({},x)),selected:null});
      next.roster[action.player]=action.roster.slice(); applyRoster(action.player,next);
      for(const position of action.positions){ const piece=next.pieces.find(x=>x.id===position.id); piece.r=position.r; piece.c=position.c; piece.placed=true; }
      return {state:next,events:[{type:"render"}]};
    }
    case "setupConfirm": {
      const player=state.setupPlayer;
      if(state.roster[player].length!==6||state.pieces.some(piece=>piece.owner===player&&!piece.placed))
        return {state,events:[{type:"toast",message:"로스터 6종 선택과 14개 배치를 모두 완료하세요."}]};
      const next=Object.assign({},state,{selected:null});
      if(action.preparing){
        const setup={roster:state.roster[0].slice(),pos:state.pieces.filter(piece=>piece.owner===0).map(piece=>[piece.r,piece.c])};
        return {state:next,events:[{type:"setupNetworkReady",setup,publicMode:action.publicMode}]};
      }
      if(state.mode==="pvp"&&player===0){ next.setupPlayer=1; return {state:next,events:[{type:"setupHandoff",player:1}]}; }
      return {state:next,events:[{type:state.mode==="pvp"?"setupBegin":"setupAiBegin"}]};
    }
    case "tele": return {state:Object.assign({},state,{teleport:state.teleport?null:{stage:1,piece:null},selected:null}),events:[{type:"render"}]};
    case "skipMain": return {state:Object.assign({},state,{mainUsed:true}),events:[{type:"mainSkipped",player:state.current,origin:action.origin,toast:action.toast}]};
    /* #245 회복 주 행동: 검증·자세·지표를 Core 가 소유하고 표시는 healStarted 이벤트로만 내보낸다.
       reducer 계약대로 입력 상태는 건드리지 않는다 — 대상 말·pieces·metrics·byPlayer 두 칸만 복제하고 나머지 참조는 그대로 둔다. */
    case "heal": {
      const target=state.pieces.find(x=>x.id===action.id);
      if(!healActionOk(state,target)) return null;
      const piece=Object.assign({},target,{healing:true});
      const metrics=Object.assign({},state.metrics,{byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
      const next=Object.assign({},state,{pieces:state.pieces.map(x=>x===target?piece:x),metrics,mainUsed:true,selected:null});
      met(piece.owner,"heals",1,next);
      return {state:next,events:[{type:"healStarted",piece}]};
    }
    /* #245 이동: **합법 이동 전부** — 1칸·BT 직선 2칸·숨은 말 충돌 정지 — 과 그 이동이 만든 **신규 접촉(강제 전투 대상 확정)**까지 Core 가 소유한다.
       검증은 기존 canMoveTo 하나뿐이고(중복 판정 없음), 대상 목록도 applyForced 와 같은 한 줄(contactEligible)이다.
       BT 2칸의 단계 해석은 레거시와 같다 — 경유 칸에 숨은 말이 있으면 그 칸 진입 시도로 바꾸고(정지 = 출발 칸), 비어 있으면
       통과한다(정지 = 경유 칸). 도착 칸에 숨은 말이 있으면 그 정지 위치에서 멈추고 양측을 일시 공개한다(숲 충돌).
       왕 끝줄 도달·전투 슬롯이 걸린 턴은 null 로 떨어뜨려 doMoveLegacy 가 종전대로 처리하고,
       충돌 문구·전투 개시(initBattle)·배너·로그는 moved 이벤트의 표시 단계(collisionLog·forcedContactStart)에 그대로 남는다.
       reducer 계약대로 입력 상태는 건드리지 않는다 — 움직이는 말과 실제로 바뀌는
       metrics·traces·aiSeenMoved 칸만 복제하고 나머지 참조는 그대로 둔다.
       판정 헬퍼(canMoveTo·at·isBurning·adjEnemies·contactEligible·visibleTo)는 **인자로 받은 state 의 보드만** 읽는다 — teleSwap 과 같은
       선택적 말미 state 인자 규약이고, 기본값 S 라 reducer 밖 호출자(UI·AI·온라인 재생)는 종전 그대로다. 전역 S 를 읽으면 같은 입력에
       다른 결과가 나온다(온라인 재생·AI 탐색처럼 S 와 reducer 상태가 갈리는 호출). 판정을 다시 쓰지 않는다(중복 검증 없음). */
    case "move": {
      const target=state.pieces.find(x=>x.id===action.id);
      if(!target||state.battle||state.teleport||state.fleePick) return null;
      if(state.battlesUsed||(state.forcedTargets&&state.forcedTargets.length)) return null; // 전투 슬롯이 이미 걸린 턴의 canBattle 승계 판정은 레거시 그대로
      if(target.type==="king") return null; // 왕 끝줄 도달 즉시 승리 경로(checkKingReach)는 레거시
      if(!canMoveTo(target,action.r,action.c,state)) return null; // 합법성 판정은 레거시와 같은 한 곳(canMoveTo)뿐이다
      let dr=action.r, dc=action.c, stopR=target.r, stopC=target.c; // 충돌 시 정지 위치 — 기본값은 출발 칸
      if(Math.abs(target.r-dr)+Math.abs(target.c-dc)===2){ // BT 2칸: 1칸째부터 단계 해석 → 충돌 규칙 자연 적용
        const mr=(target.r+dr)/2, mc=(target.c+dc)/2;
        if(at(mr,mc,state)){ dr=mr; dc=mc; } else { stopR=mr; stopC=mc; } // 경유 칸의 숨은 말 → 그 칸 진입 시도(정지=출발 칸) · 통과하면 경유 칸이 정지 위치
      }
      const hidden=at(dr,dc,state); // 도착 칸의 숨은 말 = 숲 충돌 (보이는 말·같은 편은 canMoveTo 가 이미 막았다)
      const moved=Object.assign({},target,{r:hidden?stopR:dr,c:hidden?stopC:dc,movedEver:true,healing:false}); // #106: 이동은 회복 자세 해제 (숲 충돌 정지 포함)
      if(!isBurning(state)) moved.movedPreBT=true; // 엔진 내부 이동 이력 (#21 누수 제거 — AI 는 aiSeenMoved 만 본다)
      const beforeAdj=new Set(adjEnemies(target,state).map(e=>e.id)), after=adjEnemies(moved,state); // T1: 이동 전/후 인접 집합
      const forced=after.filter(e=>!beforeAdj.has(e.id)&&contactEligible(moved,e,state)).map(e=>e.id); // 신규 인접 = 강제 전투·폭탄 접촉 (applyForced 와 같은 판정)
      const next=Object.assign({},state,{pieces:state.pieces.map(x=>x===target?moved:x),mainUsed:true,contactKind:hidden?"collision":"move",
        movedPiece:moved,contactSet:after.map(e=>e.id),forcedTargets:forced.length?forced:state.forcedTargets,
        selected:forced.length>1?moved:(state.selected===target?moved:state.selected)}); // 대상 2개 이상이면 레거시와 같이 이동한 말을 선택 상태로 둔다
      if(hidden) next.tempReveal=new Set(state.tempReveal).add(hidden.id).add(moved.id); // 숲 충돌: 양측 일시 공개 (입력 집합은 그대로 두고 복제)
      const metric=target.type==="bomb"?"bombMoves":(target.type==="minion"&&zoneOf(1-target.owner).includes(moved.r)&&!zoneOf(1-target.owner).includes(target.r)?"minionInvades":null);
      if(metric){ // #20 폭탄 이동 카운터 · 하수인 적진 진입 지표
        next.metrics=Object.assign({},state.metrics,{byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
        met(target.owner,metric,1,next);
      }
      const obs=1-target.owner;
      if(!isBurning(state)&&(hidden||visibleTo(obs,target,state)||visibleTo(obs,moved,state))){ // observeMove 와 같은 판정 — 이동 전후 어느 쪽이든 보이면 목격 (충돌은 일시 공개라 항상 목격)
        next.aiSeenMoved=state.aiSeenMoved.slice(); next.aiSeenMoved[obs]=new Set(state.aiSeenMoved[obs]).add(target.id);
      }
      const ev=hidden?null:state.events.find(e=>e.r===dr&&e.c===dc&&!e.consumed); // 충돌로 멈춘 칸은 흔적을 발견하지 않는다 (레거시 그대로)
      if(ev){ next.traces=state.traces.slice(); next.traces[target.owner]=new Set(state.traces[target.owner]).add(ev.r+"_"+ev.c); }
      return {state:next,events:[{type:"moved",piece:moved,healBroken:!!target.healing,trace:!!ev,collision:!!hidden,forced:forced.length?forced:null}]};
    }
    /* #245 텔레포트 스왑: 실행 직전 재검사·사전 차단·위치 교환과 그 교환이 소모하는 자원(주 행동·횟수·지표),
       도착 칸 흔적, 두 말의 회복 자세 해제, 그리고 교환 직후의 **강제 전투 큐 적재와 첫 항목 승격**까지 Core 가 소유한다.
       표시(거부 사유 토스트·로그·배너·render)와 전투 개시(initBattle)는 teleRefused·teleSwapped 이벤트가 종전 헬퍼
       (forcedContactStart)로 그대로 넘긴다 — 문구·순서가 갈라지지 않게.
       왕이 섞인 교환은 끝줄 도달 즉시 승리(checkKingReach) 경로라 null 로 떨어뜨려 doTeleportSwapLegacy 가 종전대로 처리한다 (move 와 같은 경계).
       거부·차단은 **아무것도 소모하지 않는다** — 단계 되돌림(과 차단의 selected 해제)만 상태에 남고 좌표·자원·큐·난수는 그대로다.
       말은 **id 가 아니라 객체 정체성**으로 받는다 (Saturn REVISE P2): state.pieces 안의 그 말 자체여야 통과하므로
       복제 객체·같은 id 두 개·원격 프레임이 되살린 객체는 여기서 거부된다.
       판정 헬퍼(teleportAvailable·adjEnemies·newAdjAt·forcedEligible)는 **인자로 받은 state 의 보드만** 읽는다 — 전역 S 를 읽으면
       같은 입력에 다른 결과가 나온다(온라인 재생·AI 탐색처럼 S 와 reducer 상태가 갈리는 호출). 양끝 모두 내 말이라
       스왑 전 보드로 계산한 신규 인접 집합은 스왑 후와 같다(움직인 두 말은 서로의 적이 아니다). */
    case "teleSwap": {
      const a=action.a, b=action.b;
      if((a&&a.type==="king")||(b&&b.type==="king")) return null; // 왕 끝줄 도달 즉시 승리 경로(checkKingReach)는 레거시
      const bad=teleportSwapValid(a,b,state);
      if(bad){ // 첫 말이 무효가 됐으면 1단계로 되돌리고(단계 일치), 둘째 말만 무효면 1단계 선택은 유지한다
        const reset=state.teleport&&(!a||a.owner!==state.current||!a.alive||!a.placed||a.immobile>0);
        return {state:reset?Object.assign({},state,{teleport:{stage:1,piece:null}}):state,
          events:[{type:"teleRefused",player:state.current,message:`🌀 ${bad}`}]};
      }
      const block=teleportSwapBlock(a,b,state);
      if(block) return {state:Object.assign({},state,{selected:null,teleport:state.teleport?{stage:1,piece:null}:state.teleport}),
        events:[{type:"teleRefused",player:state.current,message:`🌀 텔레포트 스왑 차단 — ${block}`}]};
      const beforeA=new Set(adjEnemies(a,state).map(e=>e.id)), beforeB=new Set(adjEnemies(b,state).map(e=>e.id));
      const pa=Object.assign({},a,{r:b.r,c:b.c,healing:false}), pb=Object.assign({},b,{r:a.r,c:a.c,healing:false}); // movedEver/movedPreBT 미설정 — 걷는 이동이 아님 (폭탄 재배치 위장 유지) · #106: 교환은 두 말의 회복 자세 해제
      const metrics=Object.assign({},state.metrics,{byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
      const teleUsed=state.teleUsed.slice(); teleUsed[state.current]++;
      const next=Object.assign({},state,{pieces:state.pieces.map(x=>x===a?pa:(x===b?pb:x)),metrics,teleUsed,
        mainUsed:true,teleport:null,selected:null,contactKind:"tele"});
      met(state.current,"teleports",1,next);
      let traces=0;
      for(const p of [pa,pb]){ // 도착 칸 이벤트 흔적 (입력 집합은 그대로 두고 복제)
        const ev=state.events.find(e=>e.r===p.r&&e.c===p.c&&!e.consumed);
        if(!ev) continue;
        if(next.traces===state.traces) next.traces=state.traces.slice();
        next.traces[p.owner]=new Set(next.traces[p.owner]).add(ev.r+"_"+ev.c); traces++;
      }
      // #18: 두 말의 강제 전투를 독립 queue에 적재 — 첫 전투의 결과(승·패·도주)와 무관하게 게임이 끝나지 않으면 둘째 실행
      const queue=[];
      for(const [p,list] of [[pa,newAdjAt(a,b.r,b.c,beforeA,state)],[pb,newAdjAt(b,a.r,a.c,beforeB,state)]]) if(list.length) queue.push({pid:p.id,targets:list});
      next.forcedQueue=queue;
      let forced=null;
      if(queue.length){ /* drainForcedQueue(true) 와 같은 승격. 스왑 직후에는 면제 분기(말 소멸·전투 횟수 소진·대상 소멸·도망 교환)가
           teleportSwapValid·teleportSwapBlock 으로 이미 배제돼 있어 첫 항목이 반드시 승격된다 — 남은 항목은 종전대로 전투 종료 지점의 drainForcedQueue 가 꺼낸다. */
        const n=queue.shift(), p=n.pid===pa.id?pa:pb;
        next.movedPiece=p; next.contactSet=adjEnemies(p,next).map(e=>e.id); next.forcedTargets=n.targets; // 접촉 집합은 교환이 끝난 보드(next) 기준 — 레거시와 같다
        if(n.targets.length>1) next.selected=p; // 대상 2개 이상이면 레거시(applyForced)와 같이 승격된 말을 선택 상태로 둔다
        forced={id:p.id,list:n.targets};
      }
      return {state:next,events:[{type:"teleSwapped",player:state.current,pieces:[pa,pb],
        healBroken:[!!a.healing,!!b.healing],traces,forced}]};
    }
    /* #245 강제 전투 큐 소비: 큐에서 항목 하나를 꺼내 movedPiece·contactSet·forcedTargets·selected(·contactKind)로 승격하는
       상태 전이를 Core 가 소유한다. 면제 사유 로그·토스트, "추가 접촉" 배너, render, 전투 개시(forcedContactStart→initBattle)는
       forcedExempt·forcedPromoted 이벤트가 종전 표시 계층으로 그대로 넘긴다 — 문구·순서가 갈라지지 않게.
       면제로 버린 항목도 큐에서는 빠진다 — 승격이 없어도(이벤트만 나가도) 큐는 줄어든 상태로 돌아간다 (레거시 shift 와 같다).
       도망 교환 선택 중(fleePick)에는 아무것도 꺼내지 않고 없던 큐의 정규화도 하지 않는다 (레거시 조기 반환 그대로).
       판정 헬퍼(alivePieces·adjEnemies·forcedEligible)는 **인자로 받은 state 의 보드만** 읽는다 — 전역 S 를 읽으면 같은 입력에
       다른 결과가 나온다(온라인 재생·AI 탐색처럼 S 와 reducer 상태가 갈리는 호출). */
    case "drainForced": {
      if(state.fleePick) return {state,events:[]};
      const queue=state.forcedQueue?state.forcedQueue.slice():[], events=[];
      let promoted=null;
      while(queue.length&&!promoted&&state.phase==="play"&&!state.battle&&!(state.forcedTargets&&state.forcedTargets.length)){
        const n=queue.shift(), p=alivePieces(state).find(x=>x.id===n.pid);
        if(!p){ events.push({type:"forcedExempt",message:"⚔️ 강제 전투 면제 — 해당 말이 제거되었습니다."}); continue; }
        if(state.battlesUsed>=2){ events.push({type:"forcedExempt",owner:p.owner,message:"⚔️ 강제 전투 면제 — 이번 턴 전투 횟수(2회)를 모두 사용했습니다.",toast:"⚔️ 강제 전투 면제 — 전투 횟수 소진"}); continue; }
        const list=adjEnemies(p,state).filter(e=>n.targets.includes(e.id)&&forcedEligible(p,e)).map(e=>e.id); // 승격 시 인접·적격 재검사 (밀려나거나 죽은 대상은 여기서 빠진다)
        if(!list.length){ events.push({type:"forcedExempt",message:"⚔️ 강제 전투 면제 — 신규 인접 대상이 사라졌습니다."}); continue; }
        promoted={piece:p,list};
      }
      const next=Object.assign({},state,{forcedQueue:queue});
      if(promoted){
        next.movedPiece=promoted.piece; next.contactSet=adjEnemies(promoted.piece,state).map(e=>e.id); next.forcedTargets=promoted.list;
        if(action.autoStart){ if(promoted.list.length>1) next.selected=promoted.piece; } // 즉시 개시: applyForced 와 같이 대상 2개 이상일 때만 선택 상태로 둔다
        else { next.selected=promoted.piece; next.contactKind="again"; } // 대상 표시만: 클릭 개시라 항상 선택 · "추가 접촉" 배너 종류
        events.push({type:"forcedPromoted",piece:promoted.piece,list:promoted.list,autoStart:!!action.autoStart});
      }
      return {state:next,events};
    }
    /* #245 턴 종료: 강제 전투 잔여 확인 → immobile 감소 → 지표(왕 숲 체류·전투 회피) → 회복 틱 → turnCount++ → 교대
       (current 플립 + 턴 시작 초기화·메모 정리·BT 진입 플래그)까지의 **상태 전이**를 Core 가 소유한다 (#106 4.2.2 순서 그대로).
       표시(강제 전투 미이행 토스트·회복 로그·턴 배너·BT 고지·핫시트 넘김·렌더·AI 스케줄)와 sim 무승부 종료(gameOver — 전투 회계
       정리를 포함한 **경기 종료** 경로라 이번 범위 밖)는 turnEnded 이벤트가 종전 표시 계층으로 그대로 넘긴다.
       auto 표식(#106 T7)은 **가드보다 앞**에서 집계한다 — 레거시 applyAction 이 `if(a.auto) met(...); endTurn();` 순서라
       가드에 막힌 프레임도 양 클라이언트가 같은 autoEnds 를 기록했다.
       대기 중인 강제 전투는 같은 reducer 의 drainForced 를 그대로 호출해 꺼낸다 — 판정·면제 문구가 갈라지지 않게.
       판정 헬퍼(alivePieces·inForest·adjEnemies·visibleTo·canBattle·isBurning)는 **인자로 받은 state 의 보드만** 읽는다.
       말은 immobile 감소와 회복 틱이 **같은 복제본 하나**를 공유하고(clone), 복제되지 않은 말·metrics 밖 참조는 그대로 둔다. */
    case "endTurn": {
      const metrics=Object.assign({},state.metrics,{byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
      let next=Object.assign({},state,{metrics});
      if(action.auto) met(state.current,"autoEnds",1,next); // #106 T7: 자동 종료 표식은 액션 프레임에 실려 양 클라이언트가 같은 지표를 기록
      if(state.phase!=="play"||state.battle||state.fleePick||state.teleport) return {state:next,events:[]};
      let events=[];
      if(!(next.forcedTargets&&next.forcedTargets.length)){ // #18: 대기 중인 강제 전투가 있으면 먼저 꺼냄
        const drained=reduceCoreAction(next,{t:"drainForced",autoStart:false});
        next=drained.state; events=drained.events.slice();
      }
      if(next.forcedTargets&&next.forcedTargets.length){ // T1: 강제 전투 미이행 시 턴 종료 불가
        if(!((next.mode==="pve"&&next.current===1)||next.mode==="sim")) // isAI(S.current) 가드 — 상태 기준
          return {state:next,events:events.concat([{type:"toast",message:"⚔️ 강제 전투 대상과 전투해야 턴을 마칠 수 있습니다."}])};
        next=Object.assign({},next,{forcedTargets:[],forcedQueue:[]}); // AI 안전장치 (이행 불가 상태 해소)
      }
      const clones=new Map(), clone=x=>{ let c=clones.get(x); if(!c){ c=Object.assign({},x); clones.set(x,c); } return c; };
      const me=next.current, board=alivePieces(next);
      for(const x of board) if(x.owner===me&&x.immobile>0) clone(x).immobile--;
      // #20 정확도: 왕 숲 체류는 자기 턴 종료 시 자기 왕만 1회 집계 (양측 턴마다 이중 집계하던 오류 수정)
      for(const k of board) if(k.owner===me&&k.type==="king"&&inForest(k)) met(me,"kingForestTurns",1,next);
      // #20 오탐 제거: 실제 canBattle 가능(보이는 대상·전투 규칙 충족)한 인접 대상이 있었는데 전투하지 않은 경우만 회피로 집계
      if(next.battlesUsed===0 && board.some(x=>x.owner===me&&adjEnemies(x,next).some(e=>visibleTo(me,e,next)&&canBattle(x,e,next)))) met(me,"battleRefusals",1,next);
      const healed=healTickGains(next,clone)||[];
      next=Object.assign({},next,{pieces:clones.size?next.pieces.map(x=>clones.get(x)||x):next.pieces,
        healTickTurn:next.turnCount,turnCount:next.turnCount+1});
      if(next.mode==="sim"&&next.turnCount>=BAL.simMaxTurns) // sim 무승부: turnCount 까지가 Core, gameOver·문구·렌더는 표시 계층
        return {state:next,events:events.concat([{type:"turnEnded",player:me,healed,simDraw:true}])};
      const started=startTurnState(Object.assign({},next,{current:1-me}));
      return {state:started.state,events:events.concat([{type:"turnEnded",player:me,healed,bt:started.bt}])};
    }
    /* #245 경기 종료: phase·winner·지표(endTurn·winType·winner) · 전투 한가운데 끝났을 때의 전투원 정리(resetAfter) ·
       battle=null · recruit=null 까지의 **상태 전이**를 Core 가 소유한다. 특히 쓰지 않은 패키지 재고(pkgs)는 건드리지
       않는다 — 그것은 새 게임에서만 초기화된다 (Saturn REVISE P2).
       화면 정리(전투 모달 닫기·낡은 마크업 비우기·fxReleaseAll)와 #126 경기 결과 배너는 matchEnded 이벤트 하나로
       종전 표시 계층에 그대로 넘긴다 — 문구·순서가 갈라지지 않게. 전투 종료 시퀀스가 배너를 직접 고르는 구간은
       전역 ENDING_BATTLE 이 아니라 action.endingBattle 로 **경계에서 명시해 받는다** — reducer 는 S·DOM·NET 을 읽지 않는다. */
    case "gameOver": {
      const metrics=Object.assign({},state.metrics,{endTurn:state.turnCount,winType:action.winType,winner:action.winner});
      const B=state.battle, clones=new Map();
      /* #121 계약 3.1: 살아 있는 전투 한가운데 경기가 끝나면(기권·상대 이탈 등) 전투원 버프·상태이상을 그 자리에서 걷는다.
         전투원은 말 자신(본체 출전)이거나 말에 매달린 포획 하수인(대리 출전 — piece.cap)이라 둘 다 복제본에만 쓴다.
         레거시가 try/catch 로 감싸 정리 실패에도 종료 전이를 계속했으므로 여기도 같은 회복력을 지킨다. */
      if(B) try{
        for(const [piece,f] of [[B.attP,B.fa],[B.defP,B.fd]]){
          if(!piece||!f) continue;
          let c=clones.get(piece); if(!c){ c=Object.assign({},piece); clones.set(piece,c); }
          if(f===piece) resetAfter(c);
          else if(piece.cap===f) resetAfter(c.cap=Object.assign({},f));
        }
      }catch(e){}
      const next=Object.assign({},state,{phase:"over",winner:action.winner,metrics,battle:null,recruit:null});
      if(clones.size) next.pieces=state.pieces.map(x=>clones.get(x)||x);
      return {state:next,events:[{type:"matchEnded",winner:action.winner,winType:action.winType,
        interrupted:!!B,banner:!action.endingBattle}]};
    }
    /* #245 기권: 경기 종료의 한 갈래다 — 같은 종료 전이를 그대로 쓴다 (레거시 별도 경로를 두지 않는다).
       권한 검사(자기 턴·AI 아님·연출 잠금 예외)는 netAction · confirmResign 이 그대로 맡고, 패자는 그 프레임의 current 다.
       문구·로그·렌더는 호출처 소유이므로 resignLoser 로 표시 계층에 넘긴다. */
    case "resign": {
      const result=reduceCoreAction(state,{t:"gameOver",winner:1-state.current,winType:"resign"});
      result.events[0].resignLoser=state.current;
      return result;
    }
    default: return null;
  }
}
/* 반환: Core 가 맡지 않은 액션이면 false, 맡았으면 커밋된 결과({state,events}) — 호출처는 종전처럼 truthy 검사만 하면 되고,
   결과의 세부 판정(예: 스왑이 실제로 일어났는지)이 필요한 래퍼만 events 를 읽는다. */
function dispatchCoreAction(action){
  const result=reduceCoreAction(S,resolveCoreAction(S,action));
  if(!result) return false;
  commitCoreState(result.state,result.events);
  applyUiEvents(result.events);
  return result;
}
/* #245 commit: reducer 가 순수하므로 바뀐 말은 복제본으로 돌아온다. 레거시 경로·AI·예약 콜백·테스트가 말 객체 참조를
   그대로 들고 있으므로, 복제본의 값을 같은 id 의 원본 말에 얹고 참조를 원본으로 되돌린다 — S 객체 정체성을 유지하는 것과 같은 이유다. */
function commitCoreState(next,events){
  const live=new Set(S.pieces); // 이미 S.pieces 안의 그 객체면 그대로 통과 — id 가 중복돼도 원본을 잃거나 겹치지 않는다 (거부 결과는 S.pieces 를 그대로 되돌린다)
  const canon=new Map(S.pieces.map(piece=>[piece.id,piece]));
  /* 포획 하수인(piece.cap)은 id 가 없어 canon 으로 되돌릴 수 없다 — 복제본 cap 을 그대로 얹으면 cap 참조를 들고 있던
     호출처(전투 전투원 fa/fd·AI·예약 콜백)가 낡은 객체를 계속 본다. 원본 cap 객체 정체성은 유지하고 값만 얹는다.
     cap 이 null 로 바뀌거나(해제) 없던 자리에 새로 붙는 경우(포획)는 그대로 통과 — 그때는 낡은 참조가 끊기는 게 맞다. */
  const keep=x=>{ if(!x||x.tray||live.has(x)) return x; const origin=canon.get(x.id); if(!origin) return x;
    const cap=origin.cap; Object.assign(origin,x);
    if(cap&&x.cap&&x.cap!==cap) origin.cap=Object.assign(cap,x.cap);
    return origin; };
  next.pieces=next.pieces.map(keep);
  next.selected=keep(next.selected);
  next.movedPiece=keep(next.movedPiece);
  for(const event of events||[]){ // healStarted·moved·teleSwapped 등 말을 실은 이벤트도 같은 정규화를 받는다 — UI 핸들러가 떨어진 복제본을 보지 않게 여기서 한 번만
    if(event.piece) event.piece=keep(event.piece);
    if(event.pieces) event.pieces=event.pieces.map(keep);
  }
  Object.assign(S,next);
}
/* ===== 턴 진행 ===== */
/* #245 턴 시작 **상태**(행동 초기화·메모 정리·BT 진입 플래그)만 계산한다 — 입력 상태는 건드리지 않는다.
   문구·배너·렌더는 startTurnMessages 가 맡아 레거시 startTurn() 과 turnEnded 이벤트가 같은 한 곳을 쓴다. */
function startTurnState(state){
  const next=Object.assign({},state,{mainUsed:false,battlesUsed:0,movedPiece:null,contactSet:[],firstBattleWonByMover:false,
    forcedTargets:[],teleport:null,forcedQueue:[],selected:null,tempReveal:new Set(),
    memos:state.memos.map(m=>{ const kept={}; // #11: 제거된 말의 메모 정리 (입력 메모는 그대로 두고 복제)
      for(const id in m) if(state.pieces.some(x=>x.id===Number(id)&&x.alive&&x.placed)) kept[id]=m[id];
      return kept; })});
  const bt=isBurning(next)&&!next.metrics.btReached; // BT 진입 1회 고지
  if(bt){
    next.metrics=Object.assign({},state.metrics,{btReached:true,btEnterTurn:next.turnCount+1,byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
    next.btBannerDue=true; // #106 T9: "버닝타임입니다!" 배너를 턴 배너보다 먼저 1회 (turnBannerFx 가 소비 — 표시 전용·송신 없음)
  }
  return {state:next,bt};
}
function startTurnMessages(bt){ // #245 턴 시작 표시 전용 — commit 된 S 기준
  const tmsg=`— ${pname(S.current)} 턴 ${S.turnCount+1} —`;
  addLog(tmsg,"sys"); showToast(tmsg,"sys");
  if(!bt) return;
  const msg="🔥 버닝 타임! 직선 2칸 이동 강화 개시 (폭탄 포함·함정 제외)";
  addLog(msg,"imp"); showToast(msg);
  if(S.mode!=="sim") tutHint("burning"); // #26 버닝 타임 첫 진입 1회 도움말 (게임 상태 무변경)
}
function startTurn(){ const r=startTurnState(S); Object.assign(S,r.state); startTurnMessages(r.bt); } // beginPlay 전용 래퍼 (턴 교대는 Core 의 endTurn)
/* ===== #106 T2 회복 주 행동 (CJ 최종 2026-09-08) =====
   지정 = 주 행동 소모, 자세는 재지정 없이 지속. 틱은 전역 플레이어 턴 종료(endTurn) 한 곳에서 양 플레이어의 자세 말 전부에 +round(maxHp×5%),
   상한 maxHp, 같은 turn 이중 틱 방지(S.healTickTurn). 지정 시점 즉시 회복 없음. 그 말의 이동·탐색·텔레포트·전투(공격·방어·폭탄·함정·밀어내기)·도망 교환은 자세를 해제한다.
   만피 도달은 자세를 풀지 않는다(회복량 0). 대상은 보드의 하수인·동료·왕(예비·폭탄·함정 제외), 지정 가능 조건은 현재 HP < 최대 HP. rand() 소비 없음 */
function healTargetOk(p){ return !!p&&p.alive&&p.placed&&(p.type==="minion"||p.type==="ally"||p.type==="king"); }
function healActionOk(state,p){ // #245: canHeal 와 reducer 가 같은 판정을 쓴다 (상태만 갈아끼움)
  if(state.phase!=="play"||state.mainUsed||!p||p.owner!==state.current||!healTargetOk(p)) return false;
  if(state.battle||state.teleport||state.fleePick||(state.forcedTargets&&state.forcedTargets.length)) return false; // #245: battle 가드 추가 — 전투 중에는 주 행동 입력을 받지 않는다
  return !p.healing; // #114 (CJ 선택 A 동반 제안): 만피 말도 회복 자세 지정 가능 — "움직이지 않고 기다리기" 수단. 만피 틱은 회복량 0 (자세 유지)
}
function canHeal(p){ return healActionOk(S,p); }
function healVisibleTo(viewer,p){ return viewer===2||p.owner===viewer||p.revealed; } // H8: 미공개 상대 말의 회복은 표시·로그에 싣지 않는다
function doHeal(p){ return dispatchCoreAction({t:"heal",id:p?p.id:null}); } // #245: 회복의 단일 Core 진입점 (AI·테스트 호환 래퍼)
function healBreakLog(p){ const v=humanViewer(); if(S.mode==="sim"||healVisibleTo(v,p)) addLog(`🌿 ${idLabel(v,p)} 회복 자세 해제`); } // #245: 해제 표시만 따로 — Core 가 자세를 이미 내린 이동(moved 이벤트)에서 같은 문구를 쓴다
function healBreak(p){ if(p&&p.healing){ p.healing=false; healBreakLog(p); } }
/* #245 회복 틱 **상태**: 같은 turn 이중 틱 가드 → 자세 말의 회복량·지표. 말 복제는 호출처가 준 clone 으로 하고
   (턴 종료의 immobile 감소와 같은 복제본을 공유한다), 지표는 인자로 받은 상태의 metrics 에 쓴다 — 호출처가 이미 복제해 둔 칸이다.
   로그는 healed 목록으로 healLogs 가 만든다 — 레거시 healTick() 과 turnEnded 이벤트가 같은 한 곳을 쓴다. */
function healTickGains(state,clone){
  if(state.healTickTurn===state.turnCount) return null;
  const healed=[];
  for(const p of alivePieces(state)){ if(!p.healing||!healTargetOk(p)) continue;
    const gain=Math.min(Math.round(p.maxHp*BAL.healPostPct),p.maxHp-p.hp);
    if(gain>0){ clone(p).hp+=gain; met(p.owner,"healHp",gain,state); }
    healed.push({id:p.id,gain});
  }
  return healed;
}
function healLogs(healed,viewer){ // #245 회복 틱 표시 전용 — H8: 미공개 상대 말은 로그에 싣지 않는다 (commit 된 S 기준)
  for(const h of healed){ const p=S.pieces.find(x=>x.id===h.id); if(!p) continue;
    if(S.mode==="sim"||healVisibleTo(viewer,p)) addLog(h.gain>0?`🌿 ${idLabel(viewer,p)} HP +${h.gain} (회복 자세)`:`🌿 ${idLabel(viewer,p)} 최대 HP — 회복 자세 유지`);
  }
}
function healTick(){ // endTurn 에서 turn++ 직전 1회 — 양 플레이어의 자세 말 전부 (레거시·테스트 직접 호출용)
  const healed=healTickGains(S,p=>p); if(!healed) return;
  S.healTickTurn=S.turnCount;
  healLogs(healed,humanViewer());
}
function endTurn(){ return dispatchCoreAction({t:"endTurn"}); } // #245: 턴 종료의 단일 Core 진입점 (UI·AI·온라인 재생 공통)
/* ===== #106 T7 자동 턴 종료 (4.6) — 행동자 클라이언트만 발화하는 '입력 액션'. 조건: 플레이 중·전투 없음·모달/오버레이 없음·텔레포트 선택 아님·
   강제 대상/queue 없음·주 행동 완료·canBattle 가능한 가시 인접 적 없음·연출 idle. 주 행동 전 특례: 가능한 주 행동이 하나도 없으면 생략을 자동 적용 후 재평가.
   BAL.fx.autoEndGrace 뒤 발화하며 그 사이 입력(FX.inputSeq)이 있으면 재평가. 수신 측(온라인 비행동자)·AI 턴은 절대 발화하지 않는다 */
function humanActorNow(){
  if(!S||S.phase!=="play"||S.battle||S.fleePick||isAI(S.current)) return false; // #114: 도망 교환 선택 중(소유자가 상대일 수 있음)에는 행동자도 자동 종료하지 않는다
  if(NET.mode&&(S.current!==NET.me||NET.replaying)) return false;
  return true;
}
function optionalBattleLeft(){ return alivePieces().some(x=>x.owner===S.current&&adjEnemies(x).some(e=>visibleTo(S.current,e)&&canBattle(x,e))); }
function anyMainActionLeft(){
  if(S.mainUsed) return false;
  const me=S.current;
  for(const p of alivePieces().filter(x=>x.owner===me)){
    if(canHeal(p)) return true;
    const ev=S.events.find(e=>e.r===p.r&&e.c===p.c&&!e.consumed&&S.traces[me].has(e.r+"_"+e.c));
    if(ev&&canSearchPiece(p)) return true;
    if(p.type!=="trap"&&p.immobile===0) for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) for(const k of (isBurning()?[1,2]:[1])){
      const r=p.r+dr*k, c=p.c+dc*k; if(r<1||r>ROWS||c<1||c>COLS) continue; if(canMoveTo(p,r,c)) return true; }
  }
  if(teleportAvailable(me)&&S.teleUsed[me]<BAL.teleMax&&alivePieces().filter(x=>x.owner===me&&x.immobile===0).length>=2) return true;
  return false;
}
function autoEndReady(){
  if(!BAL.fx.autoEnd||!humanActorNow()||fxLocked()) return null;
  if(TUT.open||S.teleport||(S.forcedTargets&&S.forcedTargets.length)||(S.forcedQueue&&S.forcedQueue.length)) return null;
  if(NET.publicMode&&NET.autoEndBlockRev!=null&&NET.autoEndBlockRev===NET.revision) return null; // #217 서버가 같은 상태에서 자동 입력을 거부했다 — 상태가 바뀔 때까지 다시 보내지 않는다
  try{ if(!$("overlay").classList.contains("hidden")) return null; }catch(e){ return null; }
  if(!S.mainUsed) return anyMainActionLeft()?null:"skip";
  return optionalBattleLeft()?null:"end";
}
function autoEndCheck(){
  const what=autoEndReady(); if(!what){ FX.auto=null; return; }
  if(FX.auto&&FX.auto.turn===S.turnCount&&FX.auto.gen===FX.gen&&FX.auto.what===what) return; // 이미 예약됨
  const tk={gen:FX.gen,turn:S.turnCount,what,input:FX.inputSeq,game:S}; FX.auto=tk;
  setTimeout(()=>{
    if(FX.auto!==tk||FX.gen!==tk.gen||S!==tk.game||S.turnCount!==tk.turn) return; // 오래된 예약
    FX.auto=null;
    if(FX.inputSeq!==tk.input){ autoEndCheck(); return; } // 그 사이 입력이 있었으면 재평가
    if(autoEndReady()!==what) { autoEndCheck(); return; }
    if(what==="skip"){ showToast("가능한 주 행동이 없습니다 — 주 행동을 생략합니다."); NET.autoSending=true; try{ netAction({t:"skipMain"}); } finally{ NET.autoSending=false; } return; }
    showToast("할 수 있는 행동이 없어 턴을 종료합니다.");
    netAction({t:"endTurn",auto:true}); // auto 표식은 액션 프레임에 실려 양 클라이언트가 같은 지표(autoEnds)를 기록한다
  }, fxLive()?(BAL.fx.autoEndGrace||0):0);
}
function confirmResign(){
  if(S.phase!=="play"||isAI(S.current)) return;
  if(NET.mode&&S.current!==NET.me) return; // 온라인: 자기 턴에만 기권
  const game=S, turn=S.turnCount;
  netLocalModal(); // 확인 모달은 로컬 전용 — 확정만 동기화
  modal(`<h2>🏳️ 기권</h2><p>정말 기권하시겠습니까?</p>`,
    [["기권 확정",()=>{if(S!==game||S.turnCount!==turn) return; close(); netAction({t:"resign"});}],
     ["취소",close]]);
}
function onCellCore(r,c){ // 원본 셀 클릭 로직 — 온라인은 onCell 래퍼가 동기화 후 호출
  if(S.phase!=="play"||S.battle) return;
  if(S.fleePick){ // #114 도망 교환: 소유자(S.current 와 다를 수 있음)의 후방 후보 클릭 → 교환 → 밀기. 그 외 클릭은 무시 (온라인은 netAction 이 소유자 외 입력을 이미 거부)
    const q=at(r,c); if(q&&S.fleePick.cands.includes(q.id)&&!isAI(S.fleePick.owner)) fleeResolve(q.id);
    return;
  }
  if(isAI(S.current)) return;
  const p=at(r,c);
  if(S.teleport){ // #14 스왑형: 자기 말 2개 선택 → 위치 교환
    /* #245: 단계 전이(1단계 선택·재클릭 취소)와 #131 함정 거부는 Core reducer(cell)가 소유한다 — 여기로 내려오는 것은
       둘째 말 선택뿐이다. 스왑 실행은 doTeleportSwap 이 실행 직전 재검사(차례·함정·횟수·전투 슬롯)를 다시 한다. */
    if(S.teleport.stage!==1&&p&&p.owner===S.current&&!(S.teleport.piece&&p.id===S.teleport.piece.id)) doTeleportSwap(S.teleport.piece,p);
    return;
  }
  if(p&&forcedPickOk(p)){ initBattle(S.movedPiece,p); return; } // T1: 강제 대상 직접 클릭 (#106: 이동한 말이 폭탄이어도 대상 선택 가능)
  /* #245: 자기 말 선택은 Core reducer(cell)가 소유한다 — 여기로는 강제 전투 대상이거나 남의 말·빈 칸인 클릭만 내려온다. */
  const s=S.selected&&!S.selected.tray?S.selected:null;
  /* #104: 상대 말 분기는 행위자(S.current) 시점의 가시성으로 결정한다 — 뷰어(humanViewer) 시점이 아니다.
     온라인에서 같은 {t:"cell"} 을 상대 클라이언트가 재생할 때 뷰어는 그 말의 주인이라 항상 "보이는" 말이 되어, 행위자에게는 숨은 말(중앙을 넘어
     내 쪽 숲에 비인접 은신)이 있는 칸으로의 BT 2칸 이동이 행위자 쪽에서는 충돌 처리(경유 칸 정지·일시 공개·강제 전투)되고 상대 쪽에서는 메모 분기로
     빠져 적용되지 않아 양측 S 가 영구 분기했다. 행위자 클라이언트·핫시트·PVE 는 humanViewer()===S.current 라 동작이 같다. */
  if(p&&p.owner!==S.current&&visibleTo(S.current,p)){
    if(s&&adj(s,p)&&canBattle(s,p)){ initBattle(s,p); return; } // 전투 대상 지정 경로
    memoModal(p); return; // #11: 그 외 상대 말 클릭 — 추측 메모
  }
  if(!s) return;
  if(canMoveTo(s,r,c)) doMove(s,r,c);
}
/* #21 공개 관측 기억: 상대(관측자)가 볼 수 있는 상태에서 일어난 BT 이전 이동만 기록 — 숨은 숲 내부 이동은 사람에게 보이지 않으므로 AI도 알 수 없다 */
function observeMove(p,visBefore){
  if(isBurning()) return; // '함정 아님' 추론은 BT 이전 이동만 유효 (기존 movedPreBT 의미 유지)
  const obs=1-p.owner;
  if(visBefore||visibleTo(obs,p)) S.aiSeenMoved[obs].add(p.id);
}
/* #106 4.4.2 접촉 적격 (applyForced 후보 산출): 이동·텔레포트·숲 충돌로 새로 인접한 상대. 폭탄은 직접 접촉 시 발동(하수인·동료·왕·폭탄·함정 모두 대상),
   함정은 여전히 수동. 왕 vs 왕 불가침은 #122 REVISE(CJ QA 6)로 폐지됐다. 그 밖은 canBattle 규칙(전투 횟수 등) 그대로. 능동 클릭 경로(canBattle)는 폭탄 공격 불가를 유지한다 */
function contactEligible(att,def,state){
  state=state||S; // #245: reducer 가 받은 상태로 같은 판정을 돌린다 (기본은 현재 S)
  if(att.type==="trap") return false;
  if(att.type==="bomb") return state.phase==="play"&&att.owner===state.current&&state.battlesUsed<2;
  return canBattle(att,def,state);
}
function forcedPickOk(def){ // 강제 대상 클릭·AI 이행: 이동한 말이 폭탄이면 canBattle 대신 접촉 적격으로 판정
  if(!(S.forcedTargets&&S.forcedTargets.length&&S.movedPiece&&S.forcedTargets.includes(def.id))) return false;
  return S.movedPiece.type==="bomb"?contactEligible(S.movedPiece,def):canBattle(S.movedPiece,def);
}
const TRACE_FOUND_MSG="탐색 가능한 흔적을 발견했습니다. (다음 턴에 탐색 가능)"; // #245: 레거시와 moved 이벤트가 같은 문구를 쓴다
function collisionLog(p){ // #245 숲 충돌 표시 한 곳 — 레거시와 moved 이벤트가 같은 문구를 쓴다
  const cmsg=`${pname(p.owner)} 이동 중 숨은 말과 충돌! 위치가 일시 공개되었습니다.`;
  addLog(cmsg,"imp"); showToast(cmsg);
}
function doMove(p,r,c){ if(p&&dispatchCoreAction({t:"move",id:p.id,r,c})) return; doMoveLegacy(p,r,c); } // #245: 이동의 단일 Core 진입점 (UI·AI·온라인 재생 공통) — Core 가 맡지 않는 분기만 레거시로
function doMoveLegacy(p,r,c){
  S.mainUsed=true; p.movedEver=true; healBreak(p); // #106: 이동은 회복 자세 해제 (숲 충돌 정지 포함)
  S.contactKind="move";
  if(!isBurning()) p.movedPreBT=true; // 실제 이동 이력(엔진 내부 사실) — AI 추론은 공개 관측 기억(aiSeenMoved)만 사용 (#21 누수 제거)
  if(p.type==="bomb") met(p.owner,"bombMoves"); // #20 폭탄 이동 카운터
  const visBefore=visibleTo(1-p.owner,p); // #21 이동 전 관측 가능 여부
  const pr=p.r, beforeAdj=new Set(adjEnemies(p).map(e=>e.id)); // T1: 이동 전 인접 집합
  if(Math.abs(p.r-r)+Math.abs(p.c-c)===2){ // BT 2칸: 1칸째부터 단계 해석 → 충돌 규칙 자연 적용
    const mr=(p.r+r)/2, mc=(p.c+c)/2;
    if(at(mr,mc)){ r=mr; c=mc; } // 경유 칸의 숨은 말 → 그 칸 진입 시도로 전환
    else { p.r=mr; p.c=mc; }
  }
  const hidden=at(r,c);
  if(hidden){ // 숲 충돌: 직전 칸 정지 + 양측 일시 공개
    S.tempReveal.add(hidden.id); S.tempReveal.add(p.id);
    observeMove(p,visBefore); // 충돌 공개 → 이동 목격
    S.movedPiece=p; S.contactSet=adjEnemies(p).map(e=>e.id); S.contactKind="collision";
    collisionLog(p);
    if(p.type==="minion"&&zoneOf(1-p.owner).includes(p.r)&&!zoneOf(1-p.owner).includes(pr)) met(p.owner,"minionInvades");
    if(applyForced(p,beforeAdj)) return;
    render(); return;
  }
  p.r=r; p.c=c;
  observeMove(p,visBefore); // #21 이동 후 보이면 목격
  S.movedPiece=p; S.contactSet=adjEnemies(p).map(e=>e.id);
  if(p.type==="minion"&&zoneOf(1-p.owner).includes(r)&&!zoneOf(1-p.owner).includes(pr)) met(p.owner,"minionInvades"); // 지표: 하수인 적진 진입
  if(checkKingReach()) return;
  const ev=S.events.find(e=>e.r===r&&e.c===c&&!e.consumed);
  if(ev){S.traces[p.owner].add(ev.r+"_"+ev.c);
    if(!isAI(p.owner)){addLog(TRACE_FOUND_MSG,"imp"); showToast(TRACE_FOUND_MSG);}}
  if(applyForced(p,beforeAdj)) return;
  render();
}
/* T1 강제 전투: 이동·텔레포트로 새로 인접한 적과는 반드시 전투 (canBattle 불가 조합 제외 — 폭탄·함정이 공격측일 때. 왕vs왕은 #122 REVISE CJ QA 6 으로 전투 대상이 됐다) */
/* #245 강제 접촉의 표시·개시 한 곳: 상태(forcedTargets·selected·contactSet)는 부르기 전에 이미 확정돼 있다.
   레거시 applyForced 와 Core 의 moved 이벤트가 같은 문구·배너·render·initBattle 순서를 쓴다 (표시 진실이 갈라지지 않게). */
function forcedContactStart(p,list){
  const def=list.length===1?alivePieces().find(e=>e.id===list[0]):null;
  if(list.length===1){
    const fmsg=p.type==="bomb"?"💣 신규 인접 — 폭탄 접촉 발동!":"⚔️ 신규 인접 — 강제 전투!";
    addLog(fmsg,"imp"); showToast(fmsg);
    contactBannerFx(p,null); // #106 4.3.1: 접촉 배너 (상황 문구는 initBattle 이 이어 붙인다)
  }else{
    const fmsg=`⚔️ 강제 전투 — 신규 인접 대상 ${list.length}개 중 하나를 선택하세요.`;
    addLog(fmsg,"imp"); if(!isAI(p.owner)) showToast(fmsg);
    contactBannerFx(p,viewerIsOwner(p.owner)?"여러 말과 접촉하였습니다. 어떤 말을 선택하시겠습니까?":"상대가 접촉한 말 중 하나를 고르고 있습니다"); // 상황 1 — 배너 뒤 잠금 해제, 클릭 선택(시간 제한 없음)
  }
  render();
  if(!isAI(p.owner)&&def) initBattle(p,def); // 사람: 확인 없이 즉시 개시 (왕·동료는 기존 모달 흐름) · AI: aiStep이 최우선 개시
}
function applyForced(p,beforeAdj,list){
  S.forcedTargets=[];
  if(!list) list=adjEnemies(p).filter(e=>!beforeAdj.has(e.id)&&contactEligible(p,e)).map(e=>e.id); // #106: 폭탄 직접 접촉 포함
  if(!list.length) return false;
  S.forcedTargets=list;
  if(list.length>1) S.selected=p;
  forcedContactStart(p,list);
  return true;
}
/* #131 계약 문구 — 화면 안내·거부 안내가 한 곳에서 나온다 (표시와 규칙이 갈라지지 않게) */
const TELE_PICK1_MSG="먼저 텔레포트를 할 말을 선택해주세요! (함정에 걸린 말은 제외)";
const TELE_PICK2_MSG="교체할 말을 선택해주세요";
const TELE_TRAP_MSG="함정에 걸린 하수인은 텔레포트를 사용할 수 없습니다";
/* #14 텔레포트 스왑형: 자기 말이 상대 진영에 있는 동안, 주 행동으로 자기 말 2개의 위치를 교환 (왕·폭탄·함정 포함).
   경기당 플레이어별 BAL.teleMax(2)회 · 교환된 두 말 모두 신규 인접 검사→강제 전투 · movedPreBT 미기록 유지 */
function teleportAvailable(p,state){
  state=state||S; // #245: reducer 가 받은 상태로 같은 판정을 돌린다 (기본은 현재 S)
  return state.phase==="play"&&alivePieces(state).some(x=>x.owner===p&&zoneOf(1-p).includes(x.r));
}
/* #18 강제 전투 적격 (연쇄 규칙 무관 — 텔레포트 강제 전투는 첫 전투 승리 조건 면제): 함정은 공격 불가. 왕 vs 왕 불가침은 #122 REVISE(CJ QA 6)로 폐지 */
function forcedEligible(att,def){
  if(att.type==="trap") return false; // #106: 폭탄은 텔레포트 도착·숲 충돌로 새로 인접해도 발동한다 (스왑 사전 차단 계산에도 포함)
  // #122 REVISE(2026-09-10 CJ QA 6): 왕 vs 왕도 강제 전투 대상이다 (불가침 폐지) — CJ가 지목한 텔레포트 인접이 바로 이 경로다
  return true;
}
/* #18 스왑 후 새로 인접할 적격 적 목록: p가 (r,c)로 이동했을 때, 기존 인접(before)이 아닌 적 */
function newAdjAt(p,r,c,before,state){
  return alivePieces(state).filter(e=>e.owner!==p.owner&&adj({r,c},e)&&!before.has(e.id)&&forcedEligible(p,e)).map(e=>e.id);
}
/* #18 스왑 사전 검사: 새 강제 전투 수가 남은 전투 슬롯(턴당 2회)을 초과하면 실행 전에 차단 (조용한 누락 금지) */
function teleportSwapBlock(a,b,state){
  state=state||S; // #245: reducer 가 받은 상태로 같은 판정을 돌린다 (기본은 현재 S)
  const beforeA=new Set(adjEnemies(a,state).map(e=>e.id)), beforeB=new Set(adjEnemies(b,state).map(e=>e.id));
  const need=(newAdjAt(a,b.r,b.c,beforeA,state).length?1:0)+(newAdjAt(b,a.r,a.c,beforeB,state).length?1:0);
  const remain=Math.max(0,2-state.battlesUsed);
  if(need>remain) return `새 강제 전투 ${need}회 > 남은 전투 ${remain}회 (턴당 최대 2회)`;
  return null;
}
/* #131: **실행 직전** 재검사. 화면의 하이라이트·비활성은 표시 계층이라 오래된 클로저·중복 클릭·수신 프레임·
   선택 이후에 바뀐 상태(함정을 밟아 immobile 이 붙은 경우 등)를 막지 못한다. 아래 조건을 모두 만족할 때만 교환한다:
     차례·단계 (플레이 중 · 전투/도망 교환 중이 아님 · 주 행동 미사용 · 텔레포트 가용 · 횟수 여유)
     양끝 각각 (owner=현재 플레이어 · alive · placed · immobile===0) · 두 말이 서로 다름
   반환: null(가능) 또는 거부 사유 문자열. 이 함수는 어떤 상태도 바꾸지 않고 난수도 쓰지 않는다. */
function teleportSwapValid(a,b,state){
  state=state||S; // #245: reducer 가 받은 상태로 같은 판정을 돌린다 (기본은 현재 S)
  if(state.phase!=="play"||state.battle||state.fleePick||(state.forcedTargets&&state.forcedTargets.length)) return "지금은 텔레포트를 쓸 수 없습니다";
  if(state.mainUsed) return "이번 턴의 주 행동을 이미 사용했습니다";
  if(!teleportAvailable(state.current,state)) return "상대 진영에 내 말이 있어야 합니다";
  if(state.teleUsed[state.current]>=BAL.teleMax) return "텔레포트 횟수를 모두 사용했습니다";
  for(const x of [a,b]){
    if(!x) return "선택한 말이 유효하지 않습니다";
    /* Saturn REVISE P2: **지금 보드에 있는 그 말 자체**여야 한다. id 만 보면 복제 객체({...a,id:…})나
       같은 id 를 가진 두 객체가 통과해 두 말이 한 칸에 겹치고 주 행동만 소모되는 경로가 열린다.
       살아 있는 말 목록에서 그 id 가 정확히 하나이고 그 객체가 인자와 동일 참조일 때만 통과시킨다. */
    const same=state.pieces.filter(y=>y&&y.id===x.id);
    if(same.length!==1||same[0]!==x) return "선택한 말이 유효하지 않습니다";
    if(x.owner!==state.current||!x.alive||!x.placed) return "선택한 말이 유효하지 않습니다";
    if(x.immobile>0) return TELE_TRAP_MSG;
  }
  if(a===b||a.id===b.id) return "서로 다른 두 말을 골라야 합니다";
  return null;
}
/* #245 텔레포트 스왑의 단일 Core 진입점 (UI 둘째 말 선택·AI·온라인 셀 재생 공통) — 왕이 섞인 교환만 레거시(끝줄 도달 즉시 승리)로 떨어진다.
   반환 계약은 종전과 같다: 실제로 교환됐으면 true, 재검사 거부·사전 차단이면 false. */
function doTeleportSwap(a,b){
  const result=dispatchCoreAction({t:"teleSwap",a,b});
  if(result) return result.events[0].type==="teleSwapped";
  return doTeleportSwapLegacy(a,b);
}
function doTeleportSwapLegacy(a,b){
  /* #131: 거부는 **아무것도 소모하지 않는다** — 자원(주 행동·텔레포트 횟수)·좌표·HP·회복 자세·공개 상태·강제 전투 큐·난수가 모두 그대로다.
     첫 말이 무효가 됐으면 1단계로 되돌리고(단계 일치), 둘째 말만 무효면 1단계 선택은 유지한다. */
  const bad=teleportSwapValid(a,b);
  if(bad){
    /* 비공개(Saturn REVISE P1): 거부 사유를 **공용 보드 로그(addLog)에 쓰지 않는다.** S.log 는 양측이 공유하는
       상태라 온라인 재생에서 상대 화면에도 그대로 렌더된다 — "함정에 걸렸다"는 내 말의 미공개 상태다.
       사유는 소유자 화면의 토스트로만 알린다 (표시 계층 · 규칙 상태·난수 불변). */
    if(viewerIsOwner(S.current)) showToast(`🌀 ${bad}`);
    if(S.teleport&&(!a||a.owner!==S.current||!a.alive||!a.placed||a.immobile>0)) S.teleport={stage:1,piece:null};
    render(); return false;
  }
  const block=teleportSwapBlock(a,b);
  if(block){ // #18: 실행 전 차단 + 이유 안내 (텔레포트 횟수·주 행동 미소모)
    /* 비공개(Venus 계약 6절 · Saturn REVISE): 차단 사유도 **소유자 화면에만** 알린다.
       종전에는 공용 보드 로그(addLog)에 남기고 `!isAI(S.current)` 로만 토스트를 걸어, 온라인 상대 클라이언트가
       같은 셀 프레임을 재생할 때 상대 화면의 로그·토스트에 내 말의 접촉 상황이 그대로 떴다.
       규칙 상태는 이 분기에서 아무것도 바뀌지 않으므로(자원·좌표·큐·난수 불변) 공개 기록도 남길 것이 없다. */
    if(viewerIsOwner(S.current)) showToast(`🌀 텔레포트 스왑 차단 — ${block}`);
    if(S.teleport) S.teleport={stage:1,piece:null};
    S.selected=null; render(); return false;
  }
  const beforeA=new Set(adjEnemies(a).map(e=>e.id)), beforeB=new Set(adjEnemies(b).map(e=>e.id));
  S.mainUsed=true; met(S.current,"teleports"); S.teleUsed[S.current]++; S.teleport=null; S.selected=null;
  healBreak(a); healBreak(b); S.contactKind="tele"; // #106: 텔레포트 교환은 두 말의 회복 자세 해제
  const ar=a.r, ac=a.c; a.r=b.r; a.c=b.c; b.r=ar; b.c=ac; // movedEver/movedPreBT 미설정 — 걷는 이동이 아님 (폭탄 재배치 위장 유지)
  if(S.mode==="pve"&&a.owner===0){addLog(`🌀 텔레포트 스왑: ${idLabel(0,a)} ↔ ${idLabel(0,b)}`,"imp"); showToast("🌀 텔레포트 완료");}
  else {addLog("상대가 텔레포트를 사용했습니다","imp"); showToast("상대가 텔레포트를 사용했습니다");} // 대상·위치 비공개 (중립 문구)
  for(const p of [a,b]){ // 도착 칸 이벤트 흔적
    const ev=S.events.find(e=>e.r===p.r&&e.c===p.c&&!e.consumed);
    if(ev){S.traces[p.owner].add(ev.r+"_"+ev.c);
      if(!isAI(p.owner)){addLog(TRACE_FOUND_MSG,"imp");}} // #245: 문구는 이동·스왑이 같은 상수를 쓴다 (토스트는 스왑에 없다 — 레거시 그대로)
  }
  if(checkKingReach()) return true; // 왕 포함 스왑 — 끝줄 도달 즉시 승리
  // #18: 두 말의 강제 전투를 독립 queue에 적재 — 첫 전투의 결과(승·패·도주)와 무관하게 게임이 끝나지 않으면 둘째 실행
  S.forcedQueue=[];
  for(const [p,before] of [[a,beforeA],[b,beforeB]]){
    const list=adjEnemies(p).filter(e=>!before.has(e.id)&&forcedEligible(p,e)).map(e=>e.id);
    if(list.length) S.forcedQueue.push({pid:p.id,targets:list});
  }
  if(!drainForcedQueue(true)) render();
  return true;
}
/* #18 강제 전투 queue 소비: 대기 항목 하나를 꺼내 forcedTargets로 승격. 전투 종료 지점(승·패·포획·도주·폭탄·함정·밀어내기)마다 호출.
   autoStart: 사람·단일 대상이면 즉시 개시(스왑 직후) / false면 대상 표시만(전투 연출 종료 직후 — 클릭으로 개시).
   대상·말 소멸이나 전투 횟수 소진으로 이행 불가하면 반드시 로그로 면제 사유를 남긴다 (조용한 누락 금지 — forcedExempt 이벤트).
   #245: 큐 소비·면제 판정·승격은 Core reducer(drainForced)가 소유하고, 여기는 AI·턴 종료·도망·전투 종료 호출처가 쓰는
   종전 반환 계약(실제로 승격했으면 true)만 지킨다. */
function drainForcedQueue(autoStart){
  const result=dispatchCoreAction({t:"drainForced",autoStart:!!autoStart});
  return !!result&&result.events.some(event=>event.type==="forcedPromoted");
}
/* #20 경기 종료 공통: 승자(null=무승부)·승리 유형·종료 턴을 지표에 저장 — #245: 상태 전이는 Core reducer(gameOver),
   화면 정리·결과 연출은 matchEnded 이벤트가 맡는다. 전투 종료 시퀀스(finishBattle·finishByCapture)가 배너를 직접
   고르는 구간인지는 여기서 읽어 액션에 실어 넘긴다 — reducer 가 전역 ENDING_BATTLE 을 읽지 않게. */
function gameOver(winner,type){ dispatchCoreAction({t:"gameOver",winner,winType:type,endingBattle:ENDING_BATTLE}); }
/* T4 전멸 패배: 하수인 6+동료 2 전원 사망 → 즉시 패배. 말 제거가 발생하는 모든 지점 후 호출 */
function checkWipe(){
  if(S.phase!=="play") return false;
  for(const p of [0,1]){
    if(!S.pieces.some(x=>x.owner===p&&x.alive&&x.placed&&(x.type==="minion"||x.type==="ally"))){
      gameOver(1-p,"wipe");
      const msg=`💀 ${pname(p)} 전투 가능 말 전멸 — ${pname(1-p)} 승리!`;
      addLog(msg,"imp"); showToast(msg); render(); return true;
    }
  }
  return false;
}

/* 왕 끝줄 도달 즉시 승리 (GDD-13 4.1 개정) — 왕 위치가 바뀌는 모든 지점 직후 호출 */
function checkKingReach(){
  if(S.phase!=="play") return false;
  const k=alivePieces().find(p=>p.type==="king"&&((p.owner===0&&p.r===1)||(p.owner===1&&p.r===ROWS)));
  if(!k) return false;
  k.revealed=true;
  gameOver(k.owner,"edge");
  const msg=`👑 왕이 적진 최후방에 도달 — ${pname(k.owner)} 승리!`;
  addLog(msg,"imp"); showToast(msg); render();
  return true;
}

/* ===== 탐색·이벤트·포획 ===== */
/* #20 탐색 실행 가능 말 — GDD 역할대로 하수인·동료·왕만. 폭탄·함정은 흔적 발견·칸 점유는 가능하나 탐색 실행 불가 (cap·버프 사장 방지) */
function canSearchPiece(p){return !!p&&(p.type==="minion"||p.type==="ally"||p.type==="king");}
function doSearch(p,ev){
  if(!canSearchPiece(p)){ if(!isAI(p.owner)) showToast("폭탄·함정은 탐색할 수 없습니다."); return false; }
  if(!ev||ev.consumed||ev.r!==p.r||ev.c!==p.c) return false;
  S.mainUsed=true; ev.consumed=true; met(p.owner,"searches"); healBreak(p); // #106: 탐색은 회복 자세 해제
  const ai=isAI(p.owner), own=p.owner;
  /* GDD-13 4.7 그대로: 공용 로그에는 **종류·보유량을 남기지 않는다**. 어떤 패키지가 나왔는지는 소유자 전용 모달·토스트로만 알린다
     (#121 계약 4.8·9 비공개 — 상대는 "숲 이벤트 발생"만 본다) */
  const smsg=ai?`상대가 숲 이벤트를 발생시켰습니다.`:`${pname(own)} 숲 이벤트 발생`;
  addLog(smsg, ai?"":"imp"); showToast(smsg);
  if(p.type==="minion") met(own,"minionSearches"); // #12·#20: 하수인 탐색 (구 '하수인 이벤트')
  /* #121 계약 1.1 이후 이벤트는 3종뿐이다. itemGift·battleBuff 는 **그 자리에서 재고 +1** 로 끝나고(필수 선택 없음),
     개봉(내용 선택)은 전투 중 가방에서 한다(계약 2.2·3.1). recruit 만 탐색 자리에서 필수 선택이 이어진다. */
  if(ev.kind==="itemGift"||ev.kind==="battleBuff"){
    S.pkgs[own][ev.kind]++; // 보유 상한 없음 (계약 2.1)
    /* #129 계약 8: itemGift·battleBuff 는 **필수 선택이 없다** → 확인 클릭을 한 번 더 요구하지 않는다.
       결과 연출 1.2초를 보여 주고 그 끝점에서 종료 조건을 재평가한다. 내용 선택(개봉)은 전투 중 가방에서 따로 한다. */
    const ko=EVENT_KO[ev.kind];
    if(!ai&&S.mode!=="sim"&&viewerIsOwner(own)) tutHint("pkg"); // #26·#121: 패키지를 처음 받을 때 1회 (소유자 화면만)
    searchFinalize(own,`📦 ${ko} 획득!`,`보유 ${S.pkgs[own][ev.kind]}개`);
    return true;
  }
  /* 알 수 없는 종류(옛 저장 상태·테스트 픽스처의 폐기된 kind)는 **아무 보상 없이** 칸만 소모하고 종료 경로로 보낸다.
     else 로 흘려보내면 폐기된 종류가 포획·교체 화면을 열어 계약 1.1 의 "3종뿐"을 깨뜨린다. */
  if(ev.kind!=="recruit"){ searchFinalize(own,"🌿 아무것도 없었다",""); return true; }
  /* #121 계약 4·6 recruit — 기술 교체 / 하수인 포획 / 포기.
     계약 6 "후보 고정": 포획 후보 종은 **탐색 중 한 번** ROSTER 20종 균등으로 뽑고, 모달을 다시 그리거나 포획 방법을 바꿔도
     재추첨하지 않는다. 그래서 여기서 rand 를 **딱 1회** 쓴다 (계약 4.2 "제안 표시 자체는 난수를 쓰지 않는다" — 제안 3종은 고정 목록). */
  S.recruit={owner:own,pieceId:p.id,species:ROSTER[Math.floor(rand()*ROSTER.length)].id,
    stage:"root",skill:null,targetId:null,recvId:null,token:(S.recruitToken=(S.recruitToken||0)+1)};
  if(ai){ aiRecruitResolve(own,p); return true; }
  if(S.mode!=="sim"&&viewerIsOwner(own)) tutHint("recruit"); // #26·#121: 기술 교체·포획 화면이 처음 열릴 때 1회
  recruitModal(); render(); return true;
}
/* #121 계약 4.2: 교체 대상은 **최초 로스터로 배치된 보드 위 하수인 6명**이다. 개인 포획(cap)·예비(reserve)는 이 화면의 대상이 아니다.
   죽은 말도 목록에 보이되 비활성이므로 살아 있는지는 걸러내지 않고 그대로 돌려준다 (순서 = 생성 순서로 안정적). */
function rosterMinions(own){ return S.pieces.filter(x=>x.owner===own&&x.type==="minion"); }
/* #121 계약 6: 포획 수령 말 — 살아 있고 배치된 동료·왕 중 포획 슬롯(cap)이 빈 말. 탐색한 말이 하수인이어도 된다 */
function capReceivers(own){ return alivePieces().filter(x=>x.owner===own&&(x.type==="ally"||x.type==="king")&&!x.cap); }
/* 현재 recruit 상태가 아직 유효한가 — 늦은 콜백·새 게임·턴 교대·말 사망 방어 */
function recruitState(){
  const R=S&&S.recruit; if(!R) return null;
  const p=S.pieces.find(x=>x.id===R.pieceId);
  if(!p||!p.alive||!p.placed||R.owner!==S.current) return null;
  return {R,p,rd:ROSTER.find(r=>r.id===R.species)};
}
/* #121 계약 4·6 탐색 보상 선택 화면 — 단계별로 다시 그린다. 온라인은 modal() 래퍼가 소유자만 조작하게 하고
   버튼 인덱스를 중계하며, 비소유자에게는 원문을 **한 번도 쓰지 않고** 대기 화면만 그린다(계약 4.8 비공개).
   확정 전에는 어떤 슬롯도 건드리지 않는다 (계약 4.2-7). */
function recruitModal(){
  const st=recruitState(); if(!st){ close(); return; }
  const {R,p,rd}=st, own=R.owner;
  /* 동기화 모달의 버튼은 modal() 래퍼가 {t:"modal",seq,i} 로 이미 중계한다 — 콜백에서 netAction 을 겹쳐 부르면
     로컬이 두 프레임을 보내고 원격이 같은 선택을 두 번 적용한다. 그래서 **코어를 직접** 부른다 (PD 검토 3). */
  const btn=(label,step,i)=>[label,()=>window.__recruitCore(step,i)];
  const skCard=(sid,head,extra)=>{ const sk=SKILLS[sid];
    return `<div class="fighter"><b>${head} ${skillNameKo(sid,null)}</b><small>${sk.cls?`<span class="badge">${SKILL_CLS_KO[sk.cls]} 분류</span> `:sk.el?`<span class="badge el-${sk.el}">${ELEM_KO[sk.el]}</span> `:""}${SKILL_TIER_KO[sk.tier]||SKIND_KO[sk.kind]} · 위력 ${sk.pow?sk.pow:"-"} · 쿨 ${sk.reaper?"봉인":sk.cd}<br>${sk.desc}${extra||""}</small></div>`; };
  if(R.stage==="root"){
    const recv=capReceivers(own);
    modal(`<h2>🌿 숲에서 무언가를 찾았다</h2><p>기술을 배우거나, 공용 하수인을 포획할 수 있습니다.<br><small>포기해도 이 칸은 다시 쓸 수 없습니다.</small></p>
      <div class="fighter"><b>📘 기술 교체</b><small>신규 공용 기술 3종 중 하나를 직접 골라, 내 최초 하수인 6명 중 살아 있는 말의 4슬롯 어디든 바꿉니다.</small></div>
      <div class="fighter"><b>🔴 하수인 포획</b><small>${recv.length?`동료·왕 중 포획 슬롯이 빈 말 ${recv.length}기가 받을 수 있습니다 (보유 볼 ${S.balls[own]})`:"<b>포획 슬롯이 빈 동료·왕이 없습니다 — 포획 불가</b>"}</small></div>`,
      (V2_INTERP.recruitSkillSwap?[btn("📘 기술 교체","skills",0)]:[["📘 기술 교체 (v0.4.11 과도기 — 닫힘)",null,true]]).concat(recv.length?[btn("🔴 하수인 포획","cap",0)]:[]).concat([btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="skill"){
    /* 계약 4.2-1·5: 3종을 모두 보여 주고 직접 고른다. 난수 없음. 이미 그 기술을 가진 말만 다음 단계에서 비활성이 되므로
       여기서는 "내 6명 중 아직 그 기술이 없는 말이 한 명도 없으면" 그 제안을 비활성으로 표시한다 */
    const openFor=sid=>rosterMinions(own).some(m=>m.alive&&m.placed&&m.skills&&!m.skills.includes(sid));
    modal(`<h2>📘 배울 기술 선택</h2><p>하나를 고르세요.<br><small>같은 말에 같은 기술을 두 번 장착할 수 없습니다.</small></p>
      ${NEW_SKILLS.map((sid,i)=>skCard(sid,`${i+1}.`,openFor(sid)?"":" <b>· 내 모든 하수인이 이미 보유</b>")).join("")}`,
      NEW_SKILLS.map((sid,i)=>openFor(sid)?btn(`${i+1}. ${SKILLS[sid].ko}`,"skill",i):[`${i+1}. ${SKILLS[sid].ko} (보유)`,null,true])
        .concat([btn("← 뒤로","back",0),btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="target"){
    /* 계약 4.2-2·4: 대상 말을 고르기 전 4슬롯은 ? 로 가린다. 죽은 말은 보이되 비활성 */
    const ms=rosterMinions(own);
    const row=(m,i)=>{ const dead=!m.alive||!m.placed, has=m.skills&&m.skills.includes(R.skill);
      return `<div class="fighter"><b>${i+1}. ${m.name||TYPE_KO.minion}${m.element?` <span class="badge el-${m.element}">${ELEM_KO[m.element]}</span>`:""}</b>
        <small>${dead?"<b>제거됨 — 선택 불가</b>":`HP ${m.hp}/${m.maxHp} · 공 ${m.atk} · 기술 ? ? ? ?`}${has?" · <b>이미 이 기술 보유</b>":""}</small></div>`; };
    modal(`<h2>📘 ${SKILLS[R.skill].ko} — 대상 말</h2><p>이 기술을 배울 말을 고르세요. 고르면 그 말의 4슬롯이 보입니다.</p>
      ${ms.map(row).join("")}`,
      ms.map((m,i)=>{ const sel=m.alive&&m.placed&&m.skills&&!m.skills.includes(R.skill);
        const why=(!m.alive||!m.placed)?"제거됨":"이미 보유";
        return sel?btn(`${i+1}. ${m.name||"하수인"}`,"target",i)
                 :[`${i+1}. ${m.name||"하수인"} (${why})`,null,true]; })
        .concat([btn("← 뒤로","back",0),btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="slot"){
    const m=S.pieces.find(x=>x.id===R.targetId);
    if(!m||!m.alive||!m.skills){ R.stage="target"; recruitModal(); return; }
    modal(`<h2>📘 ${SKILLS[R.skill].ko} → ${m.name||"하수인"}</h2><p>바꿀 슬롯을 고르세요.<br><small>새 기술은 그 자리의 남은 쿨타임을 이어받습니다.</small></p>
      ${skCard(R.skill,"새 기술:")}
      <p style="margin:6px 0 2px"><small>${m.name||"하수인"}의 현재 4슬롯</small></p>
      ${m.skills.map((sid,i)=>skCard(sid,`슬롯 ${i+1}:`,m.cds[i]?` · 남은 쿨 ${m.cds[i]}`:"")).join("")}`,
      m.skills.map((sid,i)=>btn(`슬롯 ${i+1} 교체 (${SKILLS[sid].ko})`,"slot",i))
        .concat([btn("← 뒤로","back",0),btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="capRecv"){
    const recv=capReceivers(own);
    if(!recv.length){ R.stage="root"; recruitModal(); return; }
    modal(`<h2>🔴 포획 하수인을 받을 말</h2><p>받을 말을 고르세요.<br><small>공격 포획이 실패하면 피해는 탐색한 ${idLabel(own,p)}가 받습니다.</small></p>
      ${recv.map((x,i)=>`<div class="fighter"><b>${i+1}. ${TYPE_KO[x.type]}</b><small>HP ${x.hp}/${x.maxHp} · 포획 슬롯 비어 있음</small></div>`).join("")}`,
      recv.map((x,i)=>btn(`${i+1}. ${TYPE_KO[x.type]}`,"recv",i)).concat([btn("← 뒤로","back",0),btn("포기","giveup",0)]));
    return;
  }
  if(R.stage==="capMode"){
    /* 계약 6: 뽑힌 종의 스탯·4기술·아트 정체를 그대로 적용한다. 후보는 위에서 고정했으므로 방법을 바꿔도 같은 종이다 */
    const b=S.balls[own], recv=S.pieces.find(x=>x.id===R.recvId);
    const opt=(name,cost,rate,risk)=>`<div class="fighter"><b>${name}</b><small>볼 ${cost} · 성공 ${rate}${risk?" · "+risk:""}</small></div>`;
    modal(`<h2>🔴 포획 시도 (몬스터볼 ${b})</h2>
      <div class="fighter"><b>발견: ${rd?rd.name:"공용 하수인"}${rd?` <span class="badge el-${rd.element}">${ELEM_KO[rd.element]}</span>`:""}</b>
        <small>${rd?`HP ${rd.hp} · 공 ${rd.atk} · ⭐1 스킬 ${speciesSkills(rd.id,1).map(s=>SKILLS[s].ko).join("·")} — 이 종의 ⭐1 수치·스킬로 합류합니다`:""}<br>받을 말: ${recv?TYPE_KO[recv.type]:"-"}</small></div>
      <small>공격 포획 실패 시 <b>탐색 말</b>이 최대 HP 25% 피해!</small>
      ${opt("안전 포획",2,"100%","")}${opt("위험 포획",1,"50%","실패 시 소멸")}${opt("공격 포획",1,"70%","실패 시 소멸 + 탐색 말 HP 25% 피해")}`,
      [["안전 포획 (볼 2)",b>=2?()=>window.__recruitCore("mode",0):null,b<2],
       ["위험 포획 (볼 1)",b>=1?()=>window.__recruitCore("mode",1):null,b<1],
       ["공격 포획 (볼 1)",b>=1?()=>window.__recruitCore("mode",2):null,b<1],
       btn("← 뒤로","back",0),btn("포기","giveup",0)]);
    return;
  }
  close();
}
const CAP_MODES=["safe","risky","attack"]; // 순서 고정 — UI·AI·온라인 인덱스 중계 공용
/* 탐색 보상 선택의 단일 적용기 — 온라인은 netAction("recruit") 으로 양측이 같은 순서로 이 함수를 탄다.
   난수는 쓰지 않는다(후보 종은 탐색 시점에 고정, 제안 3종은 고정 목록) — 단 포획 판정(tryCapture)만 rand 1회를 쓴다. */
window.__recruitCore=(step,i)=>{
  const st=recruitState(); if(!st){ close(); return; }
  const {R,p,rd}=st, own=R.owner;
  // #129 계약 8: 포기도 "선택이 끝난" 상태다 — 결과 연출 1.2초 뒤 같은 종료 경로를 탄다 (이벤트 소모는 되돌리지 않는다)
  if(step==="giveup"){ searchFinalize(own,"🌿 아무것도 얻지 않았다","이벤트 칸은 소모되었습니다"); return; }
  if(step==="back"){
    R.stage=(R.stage==="slot")?"target":(R.stage==="target")?"skill":(R.stage==="capMode")?"capRecv":"root";
    if(R.stage==="target") R.targetId=null; if(R.stage==="skill") R.skill=null; if(R.stage==="capRecv") R.recvId=null;
    recruitModal(); return;
  }
  /* #234 (V2_INTERP.recruitSkillSwap · PD msg): 새 스킬 체계(⭐1 = 기본기 1칸, 전설 스킬은 전설 전용)와 충돌해 과도기에는 기술 교체를 닫는다.
     코드는 지우지 않고 비활성 분기로 둔다 — 포획·포기는 그대로다. */
  if(!V2_INTERP.recruitSkillSwap&&(step==="skills"||step==="skill"||step==="target"||step==="slot")) return;
  if(step==="skills"){ R.stage="skill"; recruitModal(); return; }
  if(step==="cap"){ if(!capReceivers(own).length) return; R.stage="capRecv"; recruitModal(); return; }
  if(step==="skill"){ const sid=NEW_SKILLS[i]; if(!sid) return; R.skill=sid; R.stage="target"; recruitModal(); return; }
  if(step==="target"){
    const ms=rosterMinions(own), m=ms[i];
    if(!m||!m.alive||!m.placed||!m.skills||!R.skill||m.skills.includes(R.skill)) return; // 불법 선택 차단 (늦은 콜백·수신 프레임 포함)
    R.targetId=m.id; R.stage="slot"; recruitModal(); return;
  }
  if(step==="slot"){
    const m=S.pieces.find(x=>x.id===R.targetId);
    if(!m||!m.alive||!m.skills||i<0||i>3||!R.skill||m.skills.includes(R.skill)) return;
    /* 계약 4.2-7 확정: 남은 쿨(cds[i])은 **그대로 승계**하고(초기화 금지), 그 슬롯의 공개 기록만 지운다 → 다시 비공개 */
    m.skills[i]=R.skill;
    if(m.revealedSkills) m.revealedSkills=m.revealedSkills.filter(x=>x!==i);
    const ko=SKILLS[R.skill].ko;
    searchFinalize(own,`📘 ${ko} 습득!`,`${m.name||"하수인"} 슬롯 ${i+1} (남은 쿨 ${m.cds[i]} 승계)`);
    return;
  }
  if(step==="recv"){
    const recv=capReceivers(own)[i]; if(!recv) return;
    R.recvId=recv.id; R.stage="capMode"; recruitModal(); return;
  }
  if(step==="mode"){
    const mode=CAP_MODES[i]; if(!mode) return;
    const recv=S.pieces.find(x=>x.id===R.recvId);
    if(!recv||!recv.alive||recv.cap) return;                       // 수령 자격 재검사
    if(S.balls[own]<(mode==="safe"?2:1)) return;                   // 비용 재검사
    const r=tryCapture(p,mode,recv,rd);
    if(r.ok) searchFinalize(own,`🔴 포획 성공!`,`${rd?rd.name:"공용 하수인"} — ${TYPE_KO[recv.type]}의 대리 출전 가능`,"captureFx");
    else searchFinalize(own,`🔴 포획 실패`,r.dmg?`공용 하수인 소멸 · 탐색 말 HP ${r.dmg} 피해 (HP ${p.hp})`:"공용 하수인이 사라졌다","captureFx");
    return;
  }
};
/* #129 계약 7 — 탐색 완료 전용 종료 경로.
   1) 탐색 시점에 mainUsed·consumed 는 이미 세웠지만 **필수 선택이 끝날 때까지** 턴을 종료하지 않는다 (위 분기들이 모달을 띄운 채 기다린다).
   2) 선택이 끝나면 결과·획득 연출을 1.2초(계약 8의 itemFx·captureFx) 보여 주고 **그 끝점에서** 종료 조건을 다시 평가한다.
      fxWhenIdle 은 fxIdle 의 대기 콜백 단계에서 실행되고 그 단계는 전역 autoEndCheck() **앞**이므로, 전역 autoEndGrace(1000ms)가
      걸리기 전에 이 경로가 먼저 판정한다 → "추가 1000ms 유예 없이" (계약 7-3).
   3) 선택 전투가 남아 있으면 autoEndReady() 가 null 이라 종료하지 않고 기존 전투 선택·"싸우지 않고 종료"가 그대로 유지된다 (계약 7-4).
   금지 사항 준수: 전역 close() 에 endTurn 을 붙이지 않았고, 전역 BAL.fx.autoEndGrace 는 다른 경로를 위해 그대로 남겨 둔다. */
/* #121 계약 4.8·10 비공개 + #129 계약 8 — 탐색 완료 공통 출구.
   owner 전용 내용(획득 종류·습득 기술·대상 말·포획 종·수령 말)은 **소유자 화면에만** 그린다. 상대 화면에는 같은 길이의
   중립 배너를 띄운다 — 연출 시간·규칙 상태·난수는 양측 동일하고 달라지는 것은 표시 문구뿐이다(표시 계층 전용).
   온라인 비소유자는 물론 PVE 의 AI 탐색에서도 사람 화면에 종류가 새지 않는다 (viewerIsOwner 가 둘을 함께 처리한다). */
function searchFinalize(owner,title,sub,fxKey){
  const tk={gen:FX.gen,game:S,turn:S.turnCount,cur:S.current,seq:(S.searchEndSeq=(S.searchEndSeq||0)+1)};
  S.recruit=null; close();
  const done=()=>{ if(FX.gen!==tk.gen||S!==tk.game||S.turnCount!==tk.turn||S.current!==tk.cur) return; // 새 게임·턴 교대·행동자 교대 → 무효
    if(S.searchEndSeq!==tk.seq) return;           // 더 최신 탐색 완료가 있다 — 이 콜백은 버린다 (정확히 한 번)
    S.searchEndSeq=tk.seq+0.5;                    // 같은 완료로 두 번 발화하지 않는다
    searchEndCheck(); };
  const mine=owner===null||owner===undefined||viewerIsOwner(owner);
  if(title) fxPlay({key:fxKey||"itemFx",kind:"banner",
    title:mine?title:"🌿 숲 이벤트",                       // 비소유자: 종류·대상·기술을 말하지 않는 중립 문구
    sub:mine?(sub||""):"상대가 숲에서 무언가를 마쳤습니다."}); // 계약 9: 탐색 결과·획득 연출도 1.2초 (양측 같은 길이)
  if(mine&&title) showToast(title+(sub?` · ${sub}`:""));   // 상세는 소유자 전용 토스트로만
  fxWhenIdle(done);
  render();
  return true;
}
function searchEndCheck(){
  if(!BAL.fx.autoEnd) return;                 // 자동 턴 종료 스위치가 꺼진 환경(기존 헤드리스 회귀)은 종전 동작 유지
  if(autoEndReady()!=="end") return;           // 잠금·모달·강제 전투·텔레포트·남은 선택 전투 → 종료하지 않는다
  FX.auto=null;                                // 전역 grace 예약을 흡수 (이중 종료 방지)
  showToast("탐색을 마쳤습니다 — 턴을 종료합니다.");
  netAction({t:"endTurn",auto:true});          // auto 표식으로 양 클라이언트가 같은 지표(autoEnds)를 기록
}
/* #121 계약 6 숲 포획 — 종전(#20)은 속성만 무작위이고 수치는 공용 100/20/30·표준형 템플릿이었다. 이제 **ROSTER 20종 균등**으로
   뽑힌 종의 HP·최대 HP·ATK·기술 수치·CD·4기술·아트 정체를 **그대로** 적용한다 → HP 85~120 · ATK 18~25 의 종별 편차가 생긴다.
   · `rd` 는 doSearch 에서 **이미 고정**된 후보 종이다 (모달 재렌더·방법 변경으로 재추첨하지 않는다 — 계약 6 "후보 고정").
   · `recv` 는 포획 슬롯이 빈 동료·왕이고, `p` 는 탐색을 실행한 말이다. **공격 포획 실패 반동은 p** 가 받는다 (수령 말이 아니다).
   · 기술 배열은 복사본으로 만든다 (archSkills 가 새 배열을 돌려주므로 원본 공유가 없다). cds 는 0, 공개 기록은 빈 배열.
   · 난수는 성공 판정 roll 1회뿐이다 (종 추첨은 탐색 시점에 이미 소비).
   · 전투 중 적 포획(finishByCapture → 예비)의 HP 70/최대 100·장착 기술 승계 규격은 **이번 요청 밖이라 그대로** 둔다. */
function tryCapture(p,mode,recv,rd){
  const own=p.owner, target=recv||p;
  const cost=mode==="safe"?2:1; S.balls[own]-=cost;
  const roll=rand();
  const ok= mode==="safe" || (mode==="risky"&&roll<0.5) || (mode==="attack"&&roll<0.7);
  if(ok){
    const sp=rd||ROSTER[0];
    const capSk=speciesSkills(sp.id,1); // #234: 포획 말은 ⭐1 — 그 종의 1차 기본기
    target.cap={element:sp.element,hp:sp.hp,maxHp:sp.hp,atk:sp.atk,skillAtk:sp.skill,cd:0,cdMax:sp.cd,
      skills:capSk,cds:capSk.map(()=>0),revealedSkills:[],
      /* #233 (GDD-23 3.3): 대리 출전 포획 하수인도 그 종의 아키타입 8스탯을 그대로 받는다(⭐1 고정 — 등급 성장은 #234/#236 전까지 없음) */
      def:ARCHETYPE_BASE[sp.arch].def, spd:ARCHETYPE_BASE[sp.arch].spd, dodge:ARCHETYPE_BASE[sp.arch].dodge,
      crit:ARCHETYPE_BASE[sp.arch].crit, statusPct:ARCHETYPE_BASE[sp.arch].statusPct, shieldStartPct:ARCHETYPE_BASE[sp.arch].shieldStartPct, grade:1,
      /* #121 계약 6 "그 종 그대로" — **rosterId 까지 유지한다** (PD 정정 msg_e29871f3b018).
         기술 ID 만 같고 실제 동작이 표준형으로 바뀌면 "그대로"가 아니다. rosterId 가 있으면 archOf(f) 가 그 종의 아키타입을
         돌려주므로, 엔진이 아키타입을 읽는 모든 지점(skillParamsOf 파생 지속시간·계수, 레거시 상태 부여의 지속형 100%,
         finishByCapture 의 arch 승계, AI 슬롯 정책)이 **그 종의 실제 값**을 본다.
         artRosterId 는 아트 정체(표시)용으로 그대로 둔다 — 두 필드의 역할을 합치지 않는다.
         전투 중 적 포획(finishByCapture → 예비)은 계약 6 "범위 밖"이므로 종전대로 rosterId 를 붙이지 않고 공용 규격 70/100 을 쓴다. */
      rosterId:sp.id,artRosterId:sp.id};
    met(own,"captures");
    return {ok:true,el:sp.element,rd:sp,recv:target};
  }
  met(own,"captureFails");
  let dmg=0;
  if(mode==="attack"){dmg=Math.round(p.maxHp*BAL.captureAtkFailPct); p.hp=Math.max(1,p.hp-dmg);} // 반동은 탐색 말 p (최소 1 남김)
  return {ok:false,dmg};
}

/* ===== 전투 ===== */
/* #106 폭발 연출 (4.4.1): 규칙은 이미 적용됐고(alive=false) 표시만 유지(hold) — 제거된 말은 폭발이 끝날 때 사라진다. 헤드리스는 즉시 */
function explosionFx(pieces){
  const hold=pieces.map(p=>({piece:p,r:p.r,c:p.c}));
  /* #217 Jupiter ctx_2fc74c995309(msg_fb108078aa15) — 서버가 board diff로 explosion/trap 칸을 추측하지 않도록,
     실제 연출이 여는 칸 좌표만(숫자쌍, piece/hold 원본 객체 아님) 큐에 적재한다. 서버가 non-enumerable 큐를
     설치했을 때만 배열이 있으므로(S.__ddFxCells), 로컬 PVE/핫시트에서는 이 줄이 아무 것도 하지 않는다 —
     새 큐를 만들지 않고, 있으면 push만 한다. 규칙·RNG·로컬 FX 동작은 그대로다. */
  if(Array.isArray(S.__ddFxCells)) S.__ddFxCells.push({key:"explosion",cells:hold.map(h=>[h.r,h.c])});
  fxPlay({key:"explosion",kind:"boom",dim:false,cells:hold.map(h=>[h.r,h.c]),cellCls:"fx-boom",hold});
}
function trapFxPlay(trap,victim){
  if(Array.isArray(S.__ddFxCells)) S.__ddFxCells.push({key:"trapFx",cells:[[trap.r,trap.c],[victim.r,victim.c]]});
  fxPlay({key:"trapFx",kind:"trap",dim:false,cells:[[trap.r,trap.c],[victim.r,victim.c]],cellCls:"fx-trap",hold:[{piece:trap,r:trap.r,c:trap.c}]});
}
function initBattle(att,def){
  const forced=S.forcedTargets&&S.forcedTargets.length&&S.forcedTargets.includes(def.id);
  if(forced){S.forcedTargets=[]; met(att.owner,"forcedBattles");} // T1: 강제 이행
  situationFx(att,def); // #106 4.3.1 상황 2: 6상황 문구 (강제·선택 전투 공통) → 해결
  healBreak(att); healBreak(def); // #106: 전투 참여(공격·방어·폭탄·함정)는 회복 자세 해제 — 틱보다 먼저
  if(att.type==="bomb"){ bombAttack(att,def); return; } // #106 4.4.2 폭탄 직접 접촉 발동
  if(def.type==="bomb"){
    S.battlesUsed++; met(att.owner,"battles");
    def.alive=false;
    if(att.type==="minion"){att.alive=false; met(def.owner,"bombHitsMinion"); // #20: 폭탄 소유자 기준
      addLog(`💥 폭탄 발동! 공격한 말과 폭탄이 모두 제거되었습니다.`,"imp");
      showToast(`💥 폭탄 발동! 공격한 말과 폭탄이 모두 제거되었습니다.`);
      explosionFx([def,att]);}
    else {met(def.owner,"bombClearedByVip");
      addLog(`💥 폭탄 발동! 폭탄만 제거되고 공격한 말은 생존했습니다. (정체 비공개 유지)`,"imp");
      showToast(`💥 폭탄 발동! 폭탄만 제거되고 공격한 말은 생존했습니다. (정체 비공개 유지)`);
      explosionFx([def]);}
    if(checkWipe()) return; // T4: 폭탄 동귀 후 전멸 판정
    afterBattle(att,false); return;
  }
  if(def.type==="trap"){
    S.battlesUsed++; met(att.owner,"battles"); met(def.owner,"trapTriggers"); // #20: 함정 발동은 함정 소유자 기준
    def.alive=false; att.immobile=2;
    def.revealed=true; att.revealed=true; // #106 T4 (CJ 최종): 함정과 걸린 말 모두 정체 공개 — 그 밖의 말은 공개 대상 비확대
    const tmsg=`🪤 함정 발동! ${idLabel(2,att)} 정체 공개 · 2턴 이동 불가 (함정 제거)`;
    addLog(tmsg,"imp"); showToast(tmsg);
    trapFxPlay(def,att);
    afterBattle(att,false); render(); return;
  }
  const needA=(att.type==="ally"||att.type==="king"), needD=(def.type==="ally"||def.type==="king");
  if(needA||needD){ vipChoice(att,def); return; }
  startRounds(att,def,att,def);
}
/* #106 4.4.2 폭탄 직접 접촉 발동 (CJ 최종 — GDD-13 4.5 "폭탄 이동은 강제 전투 미유발" 대체):
   상황 4 하수인 → 폭탄·하수인 모두 제거 / 상황 5 동료·왕 → 폭탄만 제거(상대 생존·비공개 유지) / 상황 6 폭탄·함정 → 아무 일 없음(양쪽 유지·비공개).
   전투 1회 계산(battlesUsed·battles·forcedBattles 는 initBattle 에서)·bombContacts. 발동 기회는 1회 소모 — 같은 턴 재선택 없음. revealed 는 세우지 않는다 */
function bombAttack(bomb,def){
  S.battlesUsed++; met(bomb.owner,"battles"); met(bomb.owner,"bombContacts");
  if(def.type==="minion"){
    bomb.alive=false; def.alive=false; met(bomb.owner,"bombHitsMinion");
    const m=`💥 폭탄 접촉 발동! 폭탄과 상대 하수인이 함께 제거되었습니다.`; addLog(m,"imp"); showToast(m);
    explosionFx([bomb,def]);
    if(checkWipe()) return;
  } else if(def.type==="ally"||def.type==="king"){
    bomb.alive=false; met(bomb.owner,"bombClearedByVip");
    const m=`💥 폭탄 접촉 발동! 상대 말이 폭탄을 제거했습니다 — 상대 말 생존 (정체 비공개 유지)`; addLog(m,"imp"); showToast(m);
    explosionFx([bomb]);
    if(checkWipe()) return;
  } else { /* #122 REVISE(2026-09-10 CJ QA 5): #114 상황 6(밀기·양쪽 유지)을 **폐지**한다 — 폭탄 ↔ 폭탄/함정은
       그 자리에서 폭탄 접촉이 발동해 **둘 다 제거**된다 (하수인 갈래와 같은 처리). 이동할 수 있는 것은 폭탄뿐이라
       이 갈래에 오는 조합은 "움직인 폭탄 → 상대 폭탄" 과 "움직인 폭탄 → 상대 함정" 둘뿐이다.
       함정 발동(2턴 이동 불가·trapTriggers)은 일으키지 않는다 — 함정이 걸린 것이 아니라 폭탄이 터진 것이다. */
    bomb.alive=false; def.alive=false;
    const m=`💥 폭탄 접촉 발동! 폭탄과 상대 ${TYPE_KO[def.type]}이(가) 함께 제거되었습니다.`; addLog(m,"imp"); showToast(m);
    explosionFx([bomb,def]);
    if(checkWipe()) return;
  }
  afterBattle(bomb,false); render();
}
/* #122 REVISE(2026-09-10 CJ QA 1) — 동료↔동료 · 동료↔왕은 **밀기가 아니라 전투**다.
   폐지된 것: #114 상황 8 의 조기 밀기(vip↔vip 즉시 doPush)와 그 뒤 "양측 본체 선택 = 밀기"(Q2-b C안) 두 갈래.
   #122 REVISE(CJ QA 6)로 왕 ↔ 왕 불가침도 폐지돼 이제 동료·왕의 모든 조합이 이 함수를 탄다.
   보존된 것: 대리 출전(포획 하수인) 선택 체인 ·
   패배 결과(동료 = 동료+포획 하수인 동시 제거 / 왕 = 경기 패배) · 밀기 자체(pushResolve)는 폭탄↔폭탄·도망 후 교환에서 계속 쓴다. */
function vipChoice(att,def){
  const choices={};
  const ask=(side,piece,next)=>{
    const res=(!piece.cap&&S.reserve[piece.owner])?S.reserve[piece.owner]:null; // #12: cap 없고 예비(포획 하수인) 있으면 대리 출전 가능
    if(!(piece.type==="ally"||piece.type==="king")||(!piece.cap&&!res)){choices[side]="body"; next(); return;}
    const useRes=()=>{piece.cap=S.reserve[piece.owner]; S.reserve[piece.owner]=null;}; // 사용 시 reserve 소모 → 해당 전투원의 cap
    if(isAI(piece.owner)){if(res)useRes(); choices[side]="cap"; next(); return;} // AI: 보유 시 항상 대리 (진짜 비공개 선택)
    netModalOwner(piece.owner); // 온라인: 이 비공개 선택의 주인은 해당 말 소유자 (방어자 포함)
    modal(`<h2>🔒 ${pname(piece.owner)}만 확인${S.mode==="pvp"&&!NET.mode?" (상대는 시선 회피)":""}</h2>
      <p>${TYPE_KO[piece.type]} 출전 선택 — 어느 쪽이 패배해도 ${piece.type==="king"?"경기 패배":"동료·포획 하수인 동시 제거"}입니다.</p>`,
      [["본체 출전",()=>{choices[side]="body";close();next();}],
       res?[`예비 하수인(${ELEM_KO[res.element]}) HP ${res.hp}/${res.maxHp} 대리 출전`,()=>{useRes();choices[side]="cap";close();next();}]
          :[`포획 하수인(${ELEM_KO[piece.cap.element]}) HP ${piece.cap.hp}/${piece.cap.maxHp} 출전`,()=>{choices[side]="cap";close();next();}]]);
  };
  ask("A",att,()=>ask("D",def,()=>{
    att.revealed=true; def.revealed=true;
    const fa=choices.A==="cap"?att.cap:att, fd=choices.D==="cap"?def.cap:def;
    const aIsBody=(att.type==="ally"||att.type==="king")&&choices.A!=="cap";
    const dIsBody=(def.type==="ally"||def.type==="king")&&choices.D!=="cap";
    // #122 REVISE(2026-09-10 CJ QA 1): 종전 Q2-b C안 "양측 본체 = 밀기"는 폐지됐다 — 본체끼리도 그대로 전투한다
    const desc=`공격: ${fa===att?TYPE_KO[att.type]:"포획 하수인("+ELEM_KO[fa.element]+")"} vs 방어: ${fd===def?TYPE_KO[def.type]:"포획 하수인("+ELEM_KO[fd.element]+")"}`;
    if(S.mode==="sim"){ addLog("출전 공개 — "+desc,"ai"); startRounds(att,def,fa,fd); return; }
    modal(`<h2>출전 공개</h2><p>${desc}</p>`,[["전투 시작",()=>{close();startRounds(att,def,fa,fd);}]]);
  }));
}
/* ===== #114 (v0.4.5) 양측 밀기·재배치 — CJ 원문 "아무 일도 일어나지 않습니다. 말을 한칸씩 밀어냅니다" 개정 (docs/v0.4.5-analysis.md 3장 계약 1~4) =====
   pushResolve(att,def): 접촉 축(att→def)의 반대 방향으로 두 말을 각각 한 칸 민다 — 목적 칸이 보드 밖이거나 점유(숨은 말 포함)면 그 말은 제자리, 다른 말은 가능하면 이동
   (둘 다 밀리면 사이에 빈 칸 2개 = 맨해튼 거리 3). → 왕이 실제로 밀려 상대 끝줄에 닿으면 승리를 먼저 확정하고 후속 재배치를 중단한다.
   → 밀기 뒤 두 말이 여전히 붙어 있거나 어느 쪽이든 다른 적(숨은 말 포함)과 붙어 있으면 재배치(relocatePair). 안전한 조합이 없으면 밀기 결과를 유지하고
   그 접촉을 한 번 처리한 것으로 끝낸다(승인된 예외 — 추가 제거·승패를 만들지 않는다).
   밀기·재배치는 강제 이동이다: movedEver/movedPreBT/observeMove/흔적/강제 전투(forcedQueue)를 만들지 않는다 — 함정도 밀리고 재배치되지만 스스로 이동은 계속 불가.
   숨은 적 좌표·후보·제외 사유는 UI/로그에 싣지 않는다 (결과 위치에서의 간접 추론 가능성은 계약이 인정한 잔여). 난수 미소비 */
const PUSH_MSG="접촉 축을 따라 두 말을 각각 한 칸 밀어냅니다. (막힌 말은 제자리)";
const RELOC_MSG="각자의 말이 밀어낼 수 없는 상황입니다. 두 말을 재배치합니다.";
function pushPair(att,def){
  const dr=Math.sign(def.r-att.r), dc=Math.sign(def.c-att.c);
  const dT=[def.r+dr,def.c+dc], aT=[att.r-dr,att.c-dc]; // 목적 칸은 서로 다르고 두 말의 출발 칸과도 다르다 — 이동 순서에 결과가 의존하지 않는다
  const tryMove=(p,r,c)=>{ if(r<1||r>ROWS||c<1||c>COLS||at(r,c)) return false; p.r=r; p.c=c; return true; };
  const movedD=tryMove(def,dT[0],dT[1]), movedA=tryMove(att,aT[0],aT[1]);
  return {movedA,movedD};
}
function relocZone(o,r){ // 재배치 영역 우선순위: 0 자기 진영 → 1 자기 숲 → 2 중앙 광장 (그 밖 -1)
  if(zoneOf(o).includes(r)) return 0;
  if(o===0?(r>=9&&r<=10):(r>=4&&r<=5)) return 1;
  if(r>=6&&r<=8) return 2;
  return -1;
}
function relocCandidates(p,others){ // p 의 후보 칸 (두 말의 출발 칸은 비운 상태) — 빈 칸·다른 적(숨은 말 포함) 비인접. 고정 정렬: 영역 → 원위치 거리 → 자기 진영 방향 행 → 열
  const occ=new Set(others.map(x=>x.r+"_"+x.c)), en=others.filter(e=>e.owner!==p.owner), out=[];
  for(let r=1;r<=ROWS;r++) for(let c=1;c<=COLS;c++){
    const z=relocZone(p.owner,r); if(z<0||occ.has(r+"_"+c)) continue;
    if(en.some(e=>Math.abs(e.r-r)+Math.abs(e.c-c)===1)) continue;
    out.push({r,c,z,d:Math.abs(p.r-r)+Math.abs(p.c-c),back:p.owner===0?ROWS-r:r-1});
  }
  out.sort((a,b)=>a.z-b.z||a.d-b.d||a.back-b.back||a.c-b.c);
  return out;
}
function relocatePair(att,def){ // 두 목적지 조합 검토 — 단순 선착순으로 둘째 말의 자리를 막지 않는다. 조합 순위: 영역 합 → 거리 합 → att 후보 순위 → def 후보 순위
  const others=alivePieces().filter(x=>x!==att&&x!==def);
  const LA=relocCandidates(att,others), LD=relocCandidates(def,others);
  let best=null;
  for(let i=0;i<LA.length;i++) for(let j=0;j<LD.length;j++){
    const a=LA[i], d=LD[j];
    if(a.r===d.r&&a.c===d.c) continue;
    if(Math.abs(a.r-d.r)+Math.abs(a.c-d.c)===1) continue; // 두 말끼리도 붙지 않아야 한다
    const key=[a.z+d.z,a.d+d.d,i,j];
    if(!best||key[0]<best.key[0]||(key[0]===best.key[0]&&(key[1]<best.key[1]||(key[1]===best.key[1]&&(key[2]<best.key[2]||(key[2]===best.key[2]&&key[3]<best.key[3])))))) best={a,d,key};
  }
  if(!best) return false;
  att.r=best.a.r; att.c=best.a.c; def.r=best.d.r; def.c=best.d.c;
  return true;
}
function pushResolve(att,def,opts){ // 밀기 → 왕 끝줄 승리 → 재배치. 반환: true=처리됨. 전투 횟수는 부르는 쪽(doPush/bombAttack/도망)이 계산한다
  opts=opts||{};
  const who=opts.who!==undefined?opts.who:att.owner;
  healBreak(att); healBreak(def); // #106: 밀어내기도 전투 참여 — 회복 자세 해제
  if(!adj(att,def)) return false;
  met(who,"pushes");
  pushPair(att,def);
  addLog(`🤜 밀어내기! ${PUSH_MSG}`,"imp"); showToast(`🤜 밀어내기! ${PUSH_MSG}`);
  fxPlay({key:"pushBanner",kind:"banner",title:"밀어내기!",sub:PUSH_MSG}); // #106 5.6 배너 "밀어내기!" + 결과 문구 (#125: pushBanner 1.2초)
  if(checkKingReach()) return true; // 왕이 실제 밀려 상대 끝줄 도달 — 승리 먼저 확정, 재배치 중단
  const stuck=adj(att,def)||adjEnemies(att).length>0||adjEnemies(def).length>0; // 숨은 말 포함 (규칙 엔진 내부 판정)
  if(stuck){
    if(relocatePair(att,def)){ met(who,"relocations");
      addLog(`🔄 말 재배치! ${RELOC_MSG}`,"imp"); showToast(`🔄 말 재배치! ${RELOC_MSG}`);
      fxPlay({key:"pushBanner",kind:"banner",title:"🔄 말 재배치!",sub:RELOC_MSG}); }
    else addLog("🔄 재배치할 안전한 자리가 없어 밀기 결과를 유지합니다. (이 접촉은 처리 완료)","imp"); // 승인된 예외 — 추가 제거·승패 없음
  }
  return true;
}
function doPush(att,def){ // 동료/왕 ↔ 동료/왕 접촉 (전투 1회 계산)
  S.battlesUsed++; met(att.owner,"battles");
  pushResolve(att,def);
  if(S.phase!=="play") return;
  afterBattle(att,false); render();
}
function startRounds(attP,defP,fa,fd){
  S.battlesUsed++; met(attP.owner,"battles");
  attP.revealed=true; defP.revealed=true;
  healBreak(attP); healBreak(defP); // #106: 전투 참여 해제 (initBattle 경유가 아닌 직접 호출도 동일)
  /* #234 (GDD-23 6.2 · 5.3 · 5.6 스냅샷): 참전 확정 순간 왕·동료 스킬 칸(동료 사망 수에 따른 🪄 칸)을 맞춘다.
     속성이 아직 없으면(로스터 전 직접 호출) 2.2 미선택 규칙으로 정한다. */
  for(const pc of [attP,defP]) if(pc.type==="king"||pc.type==="ally"){ if(!pc.element) assignLeaderElements(pc.owner); else syncOwnerLeaders(pc.owner); }
  S.battle={attP,defP,fa,fd,round:1,phase:0,
    recA:0,recD:0, itemsA:0,itemsD:0, itemRoundA:false,itemRoundD:false, lastItemA:null,lastItemD:null,
    ballThrowA:false, ballThrowD:false, // #12: 볼 투척 라운드당 1회
    blog:[], msgQ:[], actSeq:0, dispHpA:fa.hp, dispHpD:fd.hp, // actSeq: **모든 전투 행동 전환**(nextPhase)마다 1 증가하는 공유 게임 상태 (#146 Saturn REVISE P1 — 아래 actionFresh)
    /* #121 계약 3.1: 버프 회계는 **플레이어별 한 전투 1개**다. 어느 버프를 썼는지(표시·검증용)와 썼는지 여부를 side 별로 둔다.
       계약 3.3: maxRounds 는 **전투 인스턴스 값**이다 — 전역 BAL.maxRounds 는 건드리지 않는다 (null = 전역값 사용) */
    buffA:null, buffD:null, maxRounds:null};
  resetBattleTemps(fa); resetBattleTemps(fd);
  /* #234 REVISE 2차 CJ 결정(2026-09-17): 사신의 낫 전투를 넘는 봉인 — 이 전투원(말)이 참전할 때만 1 줄인다(필드·대리 출전 동일).
     전투 종료 초기화(resetAfter/resetBattleTemps) 대상이 아닌 말 단위 상태다 */
  for(const f of [fa,fd]) if(f.reaperSeal>0) f.reaperSeal--;
  for(const [piece,f,sd] of [[attP,fa,"A"],[defP,fd,"D"]]) // #12 일시버프: 다음 전투 개시 시 소진·전투 내내 유지
    if(piece.nextBattleBuff){piece.nextBattleBuff=false; f.atkBuff=true;
      bmsg(`✨ ${fighterName(sd)} 일시 버프 — 이번 전투 공격 +${pct(BAL.nextBuffPct)}!`);}
  S.battle.firstSide=decideFirstSide(S.battle); // #233 (GDD-23 4.4): 1라운드의 선턴을 전투 개시 시 한 번만 고정한다
  S.battle.firstSideR1=S.battle.firstSide; // #234 REVISE 4차 CJ 결정(2026-09-17): 2라운드부터의 교대 기준 = R1 선턴 측
  bmsg(`⚔️ ${fighterName("A")} vs ${fighterName("D")} — 전투 개시!`);
  battleModal();
}
/* #233 (GDD-23 4.6): "전투 사이에는 HP만 유지하며 상태이상·버프·방어막·쿨타임을 초기화한다. 새 전투의 모든 스킬
   쿨타임은 0이다." — 종전 #92/#121/#146 시절의 "쿨은 전투 간 유지" 계약을 **이 Issue의 명시적 승인 범위 안에서 대체**한다
   (오늘 CJ가 그 변경을 직접 지시했다). f.skills가 있는 전투원만 cds 배열을 갖는다. */
function resetBattleTemps(f){resetV2(f); f.burn=0;f.burnFresh=false;f.burnBy=null;f.weaken=0;f.shield=0;f.shieldLayers=[];f.absorbed=0;f.shock=0;f.shockFresh=false;f.focusCharge=false;f.vulnMark=false;f.dmgCut=0;f.atkBuff=false;
  f.crack=0;f.crackFresh=false;f.harden=0;f.hardenFresh=false;f.hardenPct=0;f.evadeBuff=0;f.evadeBuffR=0;f.evadeBuffRFresh=false;f.dmgUpBuff=0;f.dmgUpBuffR=0;f.dmgUpBuffRFresh=false;f.critForce=false;f.dodgeForce=false;
  f.pendingFx=[]; // #233 (GDD-23 4.6): 예고·지연 효과는 발동 전에 전투가 끝나면 취소된다 — 새 전투로 넘어오지 않는다
  f.cd=0; // #233 (GDD-23 4.6): 레거시 스칼라 쿨(f.cd)도 새 전투는 0에서 시작한다
  if(f.shieldStartPct){ shieldAdd(f,Math.round(f.maxHp*f.shieldStartPct),"guardStart"); } // 3.3 보호형 기본값: 전투 시작 시 최대 HP 10% 방어막
  f.powerBuff=false;f.fleeBoost=false;}
/* #233 (GDD-23 4.4) 선턴·후턴 — 라운드 시작 시 확정.
   1) 순서 효과: 감전(f.shock)=후턴, f.vanguardTurn=선턴(#234 전까지 실제 소스 없음 — 엔진 계약만 존재). 둘 다 있으면 후턴 우선(rearward 체크가 먼저).
   2) 순서 효과가 갈리면 그것으로 끝. 같으면(둘 다 기본, 또는 둘 다 같은 order 효과) 3) 속도 → 4) [설계 보완] 양쪽 모두 ⭐ 등급을 가졌을 때만 낮은 등급 → 5) 접촉 개시자.
   이 엔진에서 접촉 개시자는 startRounds(attP,defP,fa,fd) 호출 계약상 **항상 side A**다(다른 규칙 파일이 접촉을 건 쪽을 attP 로 넘긴다).
   #234 REVISE 4차 CJ 결정(2026-09-17) "속도는 첫 라운드 선턴 판별만 진행하고, 나머지는 전부 기존 전투 방식대로":
   위 1)~5)는 **1라운드에만** 쓴다(결과 = B.firstSideR1). 2라운드부터는 v0.4.10 actorOfPhase 처럼 교대한다 —
   홀수 라운드는 R1 선턴 측, 짝수 라운드는 반대 측이 기준이고, 속도·등급·접촉은 다시 보지 않는다.
   그 라운드의 순서 효과 분류가 갈리면 낮은 분류가 먼저(감전은 기존처럼 뒤집고, 선턴 효과는 그 대칭), 같으면 기준 교대. */
function fighterOrderCat(f){ return f.shock?2:(f.vanguardTurn?0:1); } // 0=선턴 1=기본 2=후턴
function decideFirstSide(B){
  const fa=B.fa, fd=B.fd;
  const ca=fighterOrderCat(fa), cd=fighterOrderCat(fd);
  if(ca!==cd) return ca<cd?"A":"D";
  if(B.round>1&&(B.firstSideR1==="A"||B.firstSideR1==="D")) // 2라운드부터: 기준 교대 (#234 REVISE 4차)
    return B.round%2===1 ? B.firstSideR1 : (B.firstSideR1==="A"?"D":"A");
  const sa=effSpd(fa), sd=effSpd(fd); // #234: 속도 증가(충전)·속도 감소(날개 강타·모래 폭풍) 반영 — REVISE 4차: 1라운드 판정에만 영향
  if(sa!==sd) return sa>sd?"A":"D";
  if(fa.grade!=null&&fd.grade!=null&&fa.grade!==fd.grade) return fa.grade<fd.grade?"A":"D"; // 낮은 등급 우선 (등급 없는 왕·동료가 끼면 여기를 건너뛰어 이미 위에서 A로 떨어진다)
  return "A";
}
function actorOfPhase(){
  const B=S.battle;
  // #233 (GDD-23 4.4): "라운드 시작 시 확정" — B.firstSide는 startRounds·nextPhase의 라운드 진입 시점에 한 번만 굳는다.
  // 스냅샷 기반 표시 경로(netSynthBattle 등)가 firstSide 없이 넘어오면 방어적으로 그 자리에서 계산한다(라이브 판정에는 쓰이지 않는다).
  const firstSide=B.firstSide||decideFirstSide(B);
  return B.phase===0 ? firstSide : (firstSide==="A"?"D":"A");
}
function stFx(side,f){ return {side,text:stIcons(f),shield:f.shield||0,max:f.maxHp}; } // #106 5.5: 상태 아이콘 + 방어막 바 값을 함께 실어 재생과 동기화
function battleModal(){
  const B=S.battle; if(!B) return;
  const side=actorOfPhase(), f=side==="A"?B.fa:B.fd, opp=side==="A"?B.fd:B.fa;
  const ownerP=side==="A"?B.attP.owner:B.defP.owner;
  const aiActor=isAI(ownerP);
  const viewer=S.mode==="sim"?2:(S.mode==="pve"?0:NET.mode?NET.me:ownerP); // 기술 공개 기준 시점 (핫시트는 행동자·온라인은 내 화면 고정)
  const busy=B.msgQ.length>0||fxLocked(); // 메시지 재생·연출 대기 중 커맨드 비활성 (#106: 배너·카운트다운 잠금 포함)
  /* #146 Saturn REVISE P1 — 이 렌더가 낸 버튼이 전투 행동을 **정확히 한 번만** 소비하게 하는 가드.
     `S.battle===B` 와 `actorOfPhase()===side` 만으로는 부족하다: 라운드 경계에서 같은 전투원이 연속으로
     행동할 차례가 오면(R1 후공 D → R2 선공 D) 옛 모달 클로저 하나가 두 번째 행동까지 그대로 소비한다.
     그래서 **공유 게임 상태**로 행동 전환을 센다: actSeq 는 `nextPhase()`(= 전투 행동 하나가 끝나고 다음 차례로
     넘어가는 유일한 지점)마다 1 늘고, 도망·패스 코어가 자기 행동을 확정하는 순간에도 늘린다.
     여기에 그 시점의 (round, phase) 스냅샷을 함께 가둬, **일반 공격·포획 실패 같은 다른 행동으로 차례가 넘어간
     뒤에 남아 있던 옛 도망·패스 콜백도** 거부한다. 렌더 횟수가 아니라 게임 상태를 세므로 온라인 양측이
     서로 다른 횟수로 다시 그려도 판정이 갈리지 않는다.
     연출·메시지 재생 중에도 거부한다 — 두 번 클릭·늦은 콜백이 재생 중인 행동 위에 겹치지 않게 한다.
     아이템·패키지 개봉 같은 **행동 내 무료 선택**은 차례를 넘기지 않으므로 이 값이 그대로여서 정상 동작한다.
     (온라인 수신 재생은 netReady 가 이미 잠금 해제·빈 msgQ 를 기다리므로 이 가드에 걸리지 않는다.) */
  const actSeq=B.actSeq||0, actRound=B.round, actPhase=B.phase;
  const inBonus=!!(B.bonus&&B.bonus.stage==="active"&&B.bonus.side===side); // #241 R1 번개 꼬리 추가 공격 단계 — 스킬 선택만 (도망 · 볼 · 아이템 · 패키지 · 패스 불가 L17)
  const actionFresh=()=>S.battle===B&&(B.actSeq||0)===actSeq&&B.round===actRound&&B.phase===actPhase
    &&actorOfPhase()===side&&!B.msgQ.length&&!fxLocked();
  const mySide=S.mode==="pve"?(B.attP.owner===0?"A":"D"):NET.mode?(B.attP.owner===NET.me?"A":"D"):"A", topSide=mySide==="A"?"D":"A";
  const panel=sid=>{ // 전투원 정보 패널: 이름·아키타입/속성 배지·HP바·방어막 바(#106 5.5)·상태. "가한 유효 피해" 게이지는 HP 비율 판정(H1)과 달라 제거 — recA/recD 는 지표로만 기록
    const pf=sid==="A"?B.fa:B.fd, piece=sid==="A"?B.attP:B.defP;
    const rd=pf===piece&&piece.rosterId?ROSTER.find(x=>x.id===piece.rosterId):null;
    const dhp=B["dispHp"+sid]!==undefined?B["dispHp"+sid]:pf.hp; // 표시 HP (메시지 재생과 동기화)
    const dsh=B["dispSh"+sid]!==undefined?B["dispSh"+sid]:(pf.shield||0);
    /* #122: 이름·배지·HP/방어막 바·HP 수치는 **고정 머리(.fhead)** 다. 보호막과 상태 이상이 한꺼번에 걸려 길어지는
       상태 목록과 기술 4슬롯만 **.fscroll** 안에서 세로로 스크롤한다 — 좁은 폭에서도 이름·HP 가 밀려나지 않고
       7상태를 전부 읽을 수 있으며 판이 자라 전투원 도트를 덮지도 않는다 (Saturn·PD 실측 지적).
       마크업 조각·id(hpfill-·shfill-·hptxt-·bst-)와 문구는 종전 그대로라 연출(applyFx)·비공개 마스킹 경로는 불변이다. */
    return `<div class="fighter"><div class="fhead">
      <b>${fighterName(sid)}</b> <small>(${pname(piece.owner)})</small>
      ${rd?`<span class="badge">${ARCH_KO[rd.arch]}</span>`:""}${pf.element?`<span class="badge el-${pf.element}">${ELEM_KO[pf.element]}</span>`:""}
      <div class="hpbar"><div id="hpfill-${sid}" style="width:${Math.max(0,dhp/pf.maxHp*100)}%"></div>${pf.tideMark>0?`<i class="tideline" title="해일 예고 ${pf.tideMark}" style="left:${Math.min(100,pf.tideMark/pf.maxHp*100)}%"></i>`:""}</div>
      <div class="shbar" title="방어막"><div id="shfill-${sid}" style="width:${Math.max(0,Math.min(100,dsh/pf.maxHp*100))}%"></div></div>
      <div class="status">HP <span id="hptxt-${sid}">${dhp}</span>/${pf.maxHp}</div>
      </div><div class="fscroll">
      <div class="status"><span id="bst-${sid}">${stIcons(pf)}</span></div>
      ${pf.skills?`<div class="status">${(()=>{
        /* #234 (GDD-23 7.9): 등급·미사용 스킬은 비공개 — 보유 칸 수가 곧 등급이므로 상대 화면에는 공개된 스킬만 이름으로 쓰고
           나머지는 개수 없이 "?" 하나로 묶는다. 소유자·관전(sim)은 전부 본다. */
        const all=viewer===2||piece.owner===viewer;
        const parts=pf.skills.map((sid2,i)=>(all||(pf.revealedSkills&&pf.revealedSkills.includes(i)))?`${skillNameKo(sid2,pf.element)}${pf.cds[i]?`(쿨${pf.cds[i]})`:""}`:null);
        const shown=parts.filter(x=>x!==null); if(!all&&shown.length<parts.length) shown.push("? 미공개");
        return shown.join(" · ");
      })()}</div>`:""}
    </div></div>`;
  };
  const token=sid=>{ // 스테이지 토큰: 하수인 본체·대리 출전 포획 하수인은 128 전투 도트, 자산 규격이 없는 왕·동료 본체는 현행 속성색 원형 + 이모지 유지 (규격 6.3 · #91)
    const pf=sid==="A"?B.fa:B.fd, piece=sid==="A"?B.attP:B.defP;
    /* #121 계약 3.1·9: **적용된 효과는 상대에게도 공개**된다 (재고·선택만 비공개) — 그래서 버프 표시는 양측 화면에 그린다.
       시간의 수호자는 전투 전체에 걸리므로 그 버프를 쓴 side 의 토큰에 붙인다. */
    const bkey=sid==="A"?B.buffA:B.buffD;
    const bcls=bkey?" buff-"+bkey:"";
    const lb=pf===piece&&(piece.type==="king"||piece.type==="ally"); // #234: 왕·동료 본체 토큰은 현행 이모지·라벨 유지(속성은 패널 배지) — 표시 개편은 #238
    const pos=sid===mySide?"tok-me":"tok-op", label=pf.element&&!lb?ELEM_KO[pf.element]:TYPE_KO[piece.type];
    // #89/#91 지금 실제로 싸우는 전투원 기준: 본체면 그 말의 종, 대리 출전(포획·예비 하수인)이면 cap 에 기록된 종. 왕·동료 본체 그림은 없으므로 null → 이모지
    const dir=artDirOfFighter(pf,piece);
    if(artBattleOk(dir))   // #201: 전투 파일이 영구 결손으로 판정되면 다시 내보내지 않는다 (요청 왕복·보드 아이콘 억제 방지)
      return `<div class="btok art ${pos}${bcls}" id="tok-${sid}"><img class="bsprite" src="${artUrl(dir,"battle.png")}" alt="${fighterName(sid)}" width="128" height="128" onerror="artSpriteFail('${dir}',this)"><small>${label}</small></div>`;
    /* #124: 왕·동료 **본체** 출전이면 새 아트를 그 정체 역할로 그린다. 대리 출전(포획 하수인)은 위 분기라 여기 오지 않는다.
       자산이 없거나 실패하면 아래 현행 이모지 토큰으로 그대로 되돌아간다 (artSpriteFail 이 같은 자리를 바꿔 끼운다) */
    const ld=leaderBattleDir(pf,piece);
    if(ld)
      return `<div class="btok art ${pos}${bcls}" id="tok-${sid}"><img class="bsprite leader" src="${artUrl(ld,LEADER_FILES.battle)}" alt="${fighterName(sid)}" width="128" height="128" onerror="artSpriteFail('${ld}',this)"><small>${label}</small></div>`;
    const col=pf.element&&!lb?`var(--${pf.element})`:"#5a6377";
    const emo=lb?(piece.type==="king"?"👑":"🤝"):pf.element?ELEM_EMO[pf.element]:(piece.type==="king"?"👑":piece.type==="ally"?"🤝":"❔");
    return `<div class="btok ${pos}${bcls}" id="tok-${sid}" style="background:${col}">${emo}<small>${label}</small></div>`;
  };
  // #121 계약 2.3: itemRound(라운드 1회)만 실제 게이트다. itemsX·lastItemX 는 기록으로만 남아 더 이상 버튼을 막지 않는다
  const itemRound=side==="A"?B.itemRoundA:B.itemRoundD;
  const dis=aiActor||busy||(NET.mode&&ownerP!==NET.me); // 온라인: 상대 행동 차례엔 조작 불가
  /* Saturn REVISE P1(비공개): 마스킹 기준은 **소유자 관측**이다 — 온라인·PVE·핫시트를 함께 처리한다 */
  const mineView=viewerIsOwner(ownerP);
  /* #146: 지금 이 전투원이 **합법으로 쓸 수 있는 공격 수단이 하나도 없는가**. 왕·동료 본체(skills 없음)는 기본 공격이 있으므로 항상 false.
     비공개: "공격할 것이 없습니다"는 **상대의 미공개 기술 4칸이 전부 막혀 있다**는 사실을 그대로 알려 주는 정보다.
     그래서 안내도 [턴 종료] 버튼도 **소유자 화면에만** 그린다 (비소유자에게는 종전처럼 마스킹된 4슬롯 버튼만 보인다). */
  const noAtk=!!f.skills&&!f.skills.some((sid2,i)=>slotUsable(f,i,side));
  const noAtkShow=noAtk&&mineView;
  let cmdBtns; const skillTips=[]; // skillTips: ⓘ 설명 버튼이 여는 [{label,tip}] (정체를 아는 기술만)
  if(f.skills){ // 4슬롯 커맨드 — 기본 공격 버튼 없음. 전부 불가하면 공격 대신 수동 [턴 종료] (#146)
    const maskCmd=viewer!==2&&ownerP!==viewer;
    cmdBtns=f.skills.map((sid2,i)=>{
      const sk2=SKILLS[sid2], onCd=f.cds[i]>0;
      const known=!maskCmd||(f.revealedSkills&&f.revealedSkills.includes(i));
      if(!known) return ""; // #234 (7.9): 상대 화면에는 미공개 칸을 칸 수만큼 그리지 않는다(아래에서 "?" 하나로 묶는다)
      /* #121 계약 5.3: 사신의 낫은 쿨이 아니라 **봉인**으로 막힌다. 표시도 "봉인"이고 사유를 그대로 보여 준다
         (쿨링수·냉각·전술 연계·급속 순환으로는 풀리지 않는다 — 게이트가 cds[] 와 분리되어 있다) */
      const seal=sk2.reaper?reaperWhy(side):null;
      const cond=!onCd&&!seal&&!slotUsable(f,i,side); // #234: 전투당 1회 사용 · 사용 조건 미충족 · 수면 포자(기본기만)
      const locked=onCd||!!seal||cond;
      const label=known?`${skillNameKo(sid2,f.element)}${sk2.pow?" "+dmgRange(slotPow(f,sk2)):""}${onCd?` (쿨${f.cds[i]})`:seal?" (봉인)":cond?" (불가)":""}`:`? ${SKIND_KO[sk2.kind]}`;
      const cross=known&&sk2.el&&f.element&&sk2.el!==f.element; // #92 본체와 다른 속성의 공격기 — 판정 속성을 설명에 덧붙여 비교 가능하게
      const tip=known?sk2.desc+(cross?` · ${ELEM_KO[sk2.el]} 속성으로 판정`:"")+(sk2.cls?` · ${SKILL_CLS_KO[sk2.cls]} 분류(상성표 밖)`:"")+(seal?` · ${seal}`:""):"";
      skillTips[i]=known&&tip?{label,tip}:null;
      /* v0.4.10 CJ 모바일 QA: hover 가 없는 터치 기기에서도 기술 설명을 볼 수 있게 기술 버튼 옆에 ⓘ 설명 버튼을 둔다.
         설명 버튼은 표시 전용이다 — 송신·규칙 상태·전투 행동·턴 소비가 없고, 내 차례가 아니거나 기술이 쿨·봉인이어도 열린다.
         정체를 모르는 기술(비공개 "? 종류")에는 설명 버튼을 만들지 않는다(tip 이 비어 있다). PC hover(title)는 그대로다. */
      return `<span class="skillCmd"><button ${dis||locked?"disabled":""} title="${escAttr(tip)}" onclick="window.__act(${i})">${label}</button>${skillTips[i]?`<button type="button" class="skillInfoBtn" aria-label="${escAttr(label)} 설명 보기" aria-controls="skillInfoBox" aria-expanded="false" onclick="window.__skillInfo(${i})">ⓘ</button>`:""}</span>`;
    }).join("");
    if(maskCmd&&f.skills.some((x,i)=>!(f.revealedSkills&&f.revealedSkills.includes(i)))) cmdBtns+=`<span class="skillCmd"><button disabled>? 미공개</button></span>`;
    /* #146 계약 (v0.4.7 CJ 2026-09-10) — #121 계약 5.3 의 "폴백 기본 공격"을 **철회**한다.
       4슬롯이 전부 쿨·봉인·조건 미충족으로 불가하면 **어떤 공격도 제공하지 않는다**. 안내와 명시적 수동 [턴 종료]만 둔다.
       · 보조기·시그니처가 하나라도 합법이면 예외 없이 그 슬롯을 쓴다 (여기 오지 않는다).
       · 왕·동료 본체(f.skills 없음)는 아래 else 분기라 기본 공격을 그대로 유지한다.
       · [턴 종료]는 **자기 전투 행동 1회**(nextPhase)를 넘기는 것이지 보드 턴이 아니다 — 주 행동·턴당 전투 횟수는 그대로다.
       · 버튼을 누르기 전에는 아무것도 자동으로 진행하지 않는다. 가방·패키지·포획·도망 메뉴는 그대로 쓸 수 있고,
         쿨링수로 쿨이 풀리면 다음 렌더에서 이 판정이 다시 계산돼 공격 슬롯이 되살아난다. */
    if(noAtkShow) cmdBtns+=`<button class="primary" ${dis?"disabled":""} title="이번 전투 행동을 넘깁니다 (주 행동·턴당 전투 횟수·약화 횟수는 소모하지 않습니다)" onclick="window.__pass()">턴 종료</button>`;
  } else { // 왕·동료 본체·구형 경로: 기본 공격 유지
    const canSkill=f.skillAtk&&f.cd===0;
    cmdBtns=`<button ${dis?"disabled":""} onclick="window.__act('basic')">기본 공격 ${dmgRange(f.atk)}</button>`
      +(f.skillAtk?`<button ${dis||!canSkill?"disabled":""} onclick="window.__act('skill')">${f.element?SKILL_KO[f.element]:"스킬"} ${dmgRange(f.skillAtk)}${f.cd?` (쿨${f.cd})`:""}</button>`:"");
  }
  // #12 볼 투척: 대상이 적 하수인·HP<30%·볼 보유·예비 슬롯 빈 상태·라운드당 1회 / #13 도망: 자기 HP<50%
  const oppPiece=side==="A"?B.defP:B.attP, thrown=side==="A"?B.ballThrowA:B.ballThrowD;
  const canThrow=oppPiece.type==="minion"&&opp.hp<opp.maxHp*0.3&&S.balls[ownerP]>0&&!S.reserve[ownerP]&&!thrown;
  /* #146 계약: 도망에는 **HP 조건도 시도 횟수 상한도 없다**. 성공률만 전투원별로 다르다 (기본 30% · 도망의 수호자 70%) */
  const fleeP=fleeProbOf(f);
  const throwWhy=oppPiece.type!=="minion"?"상대가 하수인이 아닙니다":opp.hp>=opp.maxHp*0.3?`상대 HP ${pct(opp.hp/opp.maxHp)} — 30% 미만이어야 합니다`:S.balls[ownerP]<=0?"몬스터볼이 없습니다":S.reserve[ownerP]?"예비 슬롯이 차 있습니다":thrown?"이번 라운드에 이미 던졌습니다":"";
  const fleeNote=f.fleeBoost?" · 🏃 도망의 수호자 — 이 전투 도망 성공률 70%":"";
  const ballBtn=`<button ${dis||!canThrow?"disabled":""} title="적 하수인 HP 30% 미만·볼 1개 소모·성공 시 포획 종료 (라운드당 1회)" onclick="window.__throwBall()">🔴 던지기 (성공 ${pct(BAL.enemyCapProb)})</button>`;
  const fleeBtn=`<button class="danger" ${dis||f.fleeLock?"disabled":""} title="HP 조건 없이 언제나 시도 · 실패하면 상대의 기본 공격 1회를 맞고 내 전투 행동 1회를 소모합니다" onclick="window.__flee()">🏃 도망 (성공 ${pct(fleeP)})</button>`;
  /* #121 계약 2.3: 아이템 사용 제한은 **플레이어별 라운드 1회**만 남는다 — 전투당 2회(itemPerBattle)와 연속 동일 금지(lastItem)는 제거됐다.
     두 값은 BAL 에서 Infinity / 미참조가 되었고, 여기서도 더 이상 버튼을 막지 않는다. */
  /* Saturn REVISE P1(비공개): 마스킹 기준을 **소유자 관측**으로 바꾼다. 종전 `NET.mode&&ownerP!==NET.me` 는 온라인만 가려서
     PVE 의 AI 행동 차례에 AI 의 가방·패키지 재고가 사람 화면에 그대로 보였다. viewerIsOwner() 는 온라인·PVE·핫시트를 함께 처리한다.
     (mineView 는 위 #146 비공개 판정과 같은 값을 쓰도록 전투원 판정 앞에서 한 번만 계산한다.) */
  let itemBtns=!mineView?`<small>상대 아이템 비공개</small>`:S.inv[ownerP].map((k,i)=>
    `<button ${dis||itemRound?"disabled":""} title="${ITEMS[k].desc}" onclick="window.__useItem(${i})">${ITEMS[k].ko}</button>`).join("");
  /* #121 계약 2.2·3.1 패키지: 재고·개봉 선택은 **소유자에게만** 보인다. 개봉·버프 선택은 무료 보너스 행동이라
     주 행동·전투 행동·아이템 라운드 카운터를 하나도 소모하지 않는다 (확정 순간에만 재고가 움직인다). */
  const pk=S.pkgs[ownerP], buffUsed=(side==="A"?B.buffA:B.buffD);
  /* 계약 9: 한 전투 안의 UI 표시 — 양측에 적용된 버프를 상태줄로 보여 준다 (적용된 효과는 공개 정보) */
  const buffLine=(B.buffA||B.buffD)?`<div class="status">✨ ${[B.buffA?`${fighterName("A")} ${BUFFS[B.buffA].ko}`:"",B.buffD?`${fighterName("D")} ${BUFFS[B.buffD].ko}`:""].filter(Boolean).join(" · ")}</div>`:"";
  let pkgBtns=!mineView?`<small>상대 패키지 비공개</small>`:
    [`<button ${dis||pk.itemGift<=0?"disabled":""} title="아이템 선물 패키지를 열어 회복약·쿨링수·해독제·공용 볼 중 1개를 받습니다 (행동 미소모)" onclick="window.__openPkg('itemGift')">🎁 아이템 선물 ${pk.itemGift}</button>`,
     `<button ${dis||pk.battleBuff<=0||!!buffUsed?"disabled":""} title="${buffUsed?"이번 전투에 이미 버프를 적용했습니다 (전투당 1개)":"전투 버프 패키지를 열어 힘·시간·도망 중 1개를 적용합니다 (행동 미소모)"}" onclick="window.__openPkg('battleBuff')">✨ 전투 버프 ${pk.battleBuff}</button>`].join("");
  const turnLabel=fxTurnLabel(ownerP,true); // T3: 현재 행동자 대형 표시 (#106: 핫시트 "P1 턴!", PVE·온라인 "나의 턴!/상대 턴!")
  if(noAtkShow&&!aiActor&&S.mode!=="sim") tutHint("noatk"); // #26·#146 4슬롯 전부 불가가 처음 나올 때 1회 (표시 계층 전용 — 게임 상태·난수·저장소 무변경)
  const menu=B.menu||null; // #106 5.3 4카테고리 하위 메뉴 — 로컬 표시 상태(송신 없음). 모든 하위 패널을 그려 두고 활성 패널만 보인다
  /* #122 REVISE(2026-09-10 CJ QA 4): 하위 메뉴의 '← 뒤로'를 **하위 메뉴 패널 바로 아래**로 내린다 (직전 REVISE의 제목 옆 좌상단을 대체).
     핸들러는 종전 그대로 window.__menu(null) 시맨틱 호출이며(모달 buttons 인덱스 중계 아님) 전투에서 강제로 빠져나가는 버튼은 만들지 않는다 */
  const sub=(key,inner)=>`<div class="bsub${menu===key?"":" hidden"}" id="bsub-${key}">${inner}</div>`;
  modal(`<div class="bhead"><h2 style="font-size:22px">▶ ${turnLabel}${aiActor?" 🤖":""}</h2></div>
    <div style="font-size:12px;color:var(--dim);margin:2px 0 6px">⚔️ 라운드 ${B.round}/${battleMaxRounds()}${B.maxRounds?" 🧭":""}</div>
    <div id="bstage" class="scene"><div class="bslot slot-op">${panel(topSide)}</div>${token(topSide)}<div class="bslot slot-me">${panel(mySide)}</div>${token(mySide)}</div>
    ${buffLine}
    <div id="msgBox">${busy?"":inBonus?`⚡ ${fighterName(side)} 추가 공격 — ${mineView?"기본기 · 2차 · 3차 중 선택 (피해 60%)":"선택을 기다리는 중"}`:(noAtkShow?NO_ATTACK_MSG:`${fighterName(side)}의 행동을 선택하세요.`)}</div>
    <div class="bmenu${menu?" hidden":""}" id="bmenu"><b style="grid-column:1/-1;font-size:12px;color:var(--dim)">${pname(ownerP)}:</b>
      <button ${dis?"disabled":""} onclick="window.__menu('fight')">⚔️ 싸우기</button><button ${dis||inBonus?"disabled":""} onclick="window.__menu('bag')">🎒 가방</button>
      <button ${dis||inBonus?"disabled":""} onclick="window.__menu('ball')">🔴 포획</button><button ${dis||inBonus?"disabled":""} onclick="window.__menu('flee')">🏃 도망가기</button>
      ${noAtkShow?`<button class="primary" style="grid-column:1/-1" ${dis?"disabled":""} title="이번 전투 행동을 넘깁니다 (주 행동·턴당 전투 횟수·약화 횟수는 소모하지 않습니다)" onclick="window.__pass()">턴 종료</button>`:""}</div>
    ${sub("fight",`<small>⚔️ 싸우기 — 기술 4슬롯</small>${noAtkShow?`<div class="status">${NO_ATTACK_MSG}</div>`:""}<div class="row">${cmdBtns}</div><div id="skillInfoBox" class="skillInfoBox hidden" role="note" aria-live="polite"></div>`)}
    ${sub("bag",`<small>🎒 가방 — 아이템은 보너스 행동 (라운드당 1회, 전투 횟수·연속 동일 제한 없음) · 사용 후 같은 행동자의 메뉴로 복귀${itemRound?" · <b>이번 라운드에 이미 사용</b>":""}</small>
      <div class="row">${itemBtns||"<small>아이템 없음</small>"}</div>
      <small>📦 패키지 — 개봉·버프 적용은 행동·아이템 카운터를 소모하지 않습니다${buffUsed?` · 적용된 버프: <b>${BUFFS[buffUsed].ko}</b>`:""}</small>
      <div class="row">${pkgBtns}</div>`)}
    ${sub("ball",`<small>🔴 포획 — 상대 하수인 HP 30% 미만 · 볼 ${mineView?`${S.balls[ownerP]}개`:"비공개"} · 성공 ${pct(BAL.enemyCapProb)}${mineView&&throwWhy?` · <b>${throwWhy}</b>`:""}</small><div class="row">${ballBtn}</div>`)}
    ${sub("flee",`<small>🏃 도망가기 — HP 조건 없음 · 성공 ${pct(fleeP)} · 실패하면 상대의 <b>기본 공격 1회</b>를 맞고 내 전투 행동 1회를 소모${fleeNote}</small><div class="row">${fleeBtn}</div>`)}
    <button id="bmenuBack" class="bmenuBack${menu?"":" hidden"}" type="button" onclick="window.__menu(null)">← 뒤로</button>
    <details><summary style="font-size:11px;color:var(--dim)">전투 이력</summary><div id="battleLog">${B.blog.slice(-30).join("<br>")}</div></details>`,
    []); // #122·Venus I-4: 전투는 인덱스 중계가 아니라 시맨틱 액션이므로 buttons 는 계속 빈 배열이다
  try{ const ob=$("overlayBox"); if(ob&&ob.classList) ob.classList.add("battleBox"); }catch(e){} // #122 세로 전투 화면 레이아웃
  window.__skillInfo=i=>{ // 기술 설명 토글 — 표시 전용(송신 0 · 규칙 상태 무변경 · 전투 행동/턴 소비 없음). 같은 ⓘ 를 다시 누르거나 [닫기]로 닫는다
    const box=$("skillInfoBox"), t=skillTips[i]; if(!box||!t) return;
    const open=!box.classList.contains("hidden")&&box.getAttribute&&box.getAttribute("data-idx")===String(i);
    try{ const ob=$("overlayBox"); if(ob&&ob.querySelectorAll) Array.prototype.forEach.call(ob.querySelectorAll(".skillInfoBtn"),b=>b.setAttribute("aria-expanded","false")); }catch(e){}
    if(open){ box.classList.add("hidden"); box.innerHTML=""; if(box.setAttribute) box.setAttribute("data-idx",""); return; }
    box.innerHTML=`<b>${escAttr(t.label)}</b><div>${escAttr(t.tip)}</div><button type="button" class="skillInfoClose" onclick="window.__skillInfo(${i})">닫기</button>`;
    if(box.setAttribute) box.setAttribute("data-idx",String(i)); box.classList.remove("hidden");
    try{ const ob=$("overlayBox"); const btn=ob&&ob.querySelectorAll?ob.querySelectorAll(".skillInfoBtn"):[]; Array.prototype.forEach.call(btn,b=>{ if(b.getAttribute("onclick")===`window.__skillInfo(${i})`) b.setAttribute("aria-expanded","true"); }); }catch(e){}
  };
  window.__menu=key=>{ // 하위 메뉴 전환 — 로컬 전용(송신 0), 규칙 상태 무변경, 재렌더 없이 패널 표시만 바꾼다
    if(S.battle!==B) return; B.menu=key||null;
    try{ const bb=$("bmenuBack"); if(bb&&bb.classList){ if(B.menu) bb.classList.remove("hidden"); else bb.classList.add("hidden"); } }catch(e){} // 행동창 아래 '← 뒤로'는 하위 메뉴가 열렸을 때만
    try{ const root=$("bmenu"); if(root){ if(B.menu) root.classList.add("hidden"); else root.classList.remove("hidden"); }
      for(const k of ["fight","bag","ball","flee"]){ const el=$("bsub-"+k); if(el){ if(k===B.menu) el.classList.remove("hidden"); else el.classList.add("hidden"); } } }catch(e){}
  };
  /* #121 계약 2.2·3 — 패키지 개봉 선택 화면. modal() 래퍼가 온라인 동기화를 맡으므로(소유자만 조작·버튼 인덱스 중계,
     비소유자에게는 "상대 선택 대기 중" 마스킹) 여기서 별도 송신을 하지 않는다. 재고·선택 내용은 소유자에게만 보인다.
     개봉 자체는 난수를 쓰지 않는다 — 플레이어 선택이다 (계약 2.2 [추론]).
     취소는 아무것도 소모하지 않는다: 재고는 **확정 분기에서만** 움직인다. */
  window.__openPkgCore=kind=>{
    if(S.battle!==B||S.battle.phase===undefined) return; if(S.battle===B&&B.bonus&&B.bonus.stage==="active") return; // #241 R1 추가 공격 중 불가(L17)
    if(actorOfPhase()!==side) return;                       // 내 전투 행동 차례에만
    const pk=S.pkgs[ownerP]; if(!pk||pk[kind]<=0) return;
    if(kind==="battleBuff"&&(side==="A"?B.buffA:B.buffD)) return; // 계약 3.1: 플레이어별 한 전투 1개
    B.menu=null;
    if(kind==="itemGift"){
      const row=k=>`<div class="fighter"><b>${GIFT_KO[k]}</b><small>${k==="ball"?`보유 ${S.balls[ownerP]} → ${S.balls[ownerP]+1}`:ITEMS[k].desc}</small></div>`;
      modal(`<h2>🎁 아이템 선물 패키지</h2><p>하나를 골라 지금 받습니다. 취소하면 패키지는 그대로 남습니다.</p>
        ${GIFT_PICKS.map(row).join("")}`,
        GIFT_PICKS.map((k,i)=>[GIFT_KO[k],()=>window.__pkgPickCore("gift",i)]).concat([["취소",()=>{close(); battleModal();}]]));
      return;
    }
    const r1=B.round===1; // 계약 3.3: 시간의 수호자는 사용자 자기 행동의 1라운드에만
    const row=key=>`<div class="fighter"><b>${BUFFS[key].ko}</b><small>${BUFFS[key].desc}${key==="time"&&!r1?" · <b>1라운드에만 선택 가능</b>":""}</small></div>`;
    modal(`<h2>✨ 전투 버프 패키지</h2><p>하나를 골라 이번 전투에만 적용합니다. 전투당 1개이며 취소하면 패키지는 그대로 남습니다.</p>
      ${BUFF_KEYS.map(row).join("")}`,
      BUFF_KEYS.map((key,i)=>{ const no=key==="time"&&!r1; // 계약 3.3: 시간은 1라운드에만 — 문구가 아니라 실제 disabled
        return [BUFFS[key].ko+(no?" (1R 전용)":""),no?null:()=>window.__pkgPickCore("buff",i),no]; })
        .concat([["취소",()=>{close(); battleModal();}]]));
  };
  /* 확정 — 여기서만 재고가 줄고 효과가 적용된다. 온라인은 modal 래퍼가 이 콜백을 인덱스로 중계하므로 양측이 같은 분기를 탄다 */
  window.__pkgPickCore=(what,i)=>{
    if(S.battle!==B) return; if(S.battle===B&&B.bonus&&B.bonus.stage==="active") return; // #241 R1 추가 공격 중 불가(L17)
    if(actorOfPhase()!==side) return;
    const pk=S.pkgs[ownerP];
    if(what==="gift"){
      if(pk.itemGift<=0) return;
      const k=GIFT_PICKS[i]; if(!k) return;
      pk.itemGift--;                                   // 확정 순간에만 −1
      if(k==="ball") S.balls[ownerP]++;                 // 계약 2.1: 보유 상한 없음
      else S.inv[ownerP].push(k);
      close(); B.menu=null;
      /* 계약 3.1·10 비공개: **아직 쓰지 않은** 획득 종류는 상대에게 공개하지 않는다. B.blog 는 양측이 공유하는 상태라
         텍스트를 시점별로 바꿀 수 없으므로 **로그에는 중립 문구만** 쓰고, 종류는 소유자 전용 토스트로만 알린다.
         (버프 적용과 아이템 실제 사용은 "적용된 효과"라 종전처럼 공개한다.) */
      bmsg(`🎁 ${pname(ownerP)}가 선물 상자를 열었다.`,null,{key:"itemFx"}); // 계약 9: 획득 연출도 1.2초(itemFx)
      if(viewerIsOwner(ownerP)) showToast(`🎁 ${GIFT_KO[k]} 획득`);
      battleModal(); render(); return;
    }
    if(pk.battleBuff<=0) return;
    const key=BUFF_KEYS[i]; if(!key) return;
    if(side==="A"?B.buffA:B.buffD) return;              // 한 전투 1개
    if(key==="time"&&B.round!==1) return;               // 계약 3.3 R1 한정 (늦은 콜백 방어)
    pk.battleBuff--;
    /* 버프 회계의 **단일 원천은 전투 인스턴스**다 (B.buffA/B.buffD). S 에 같은 값을 또 두지 않는다 —
       중복 필드는 승패·도망·적 포획·판정 등 여러 종료 경로 중 하나만 빠져도 드리프트가 되고, 계약 3.1 의
       "전투가 끝나면 즉시 정리"를 깨뜨린다. 전투 객체가 사라지면 회계도 함께 사라진다. */
    if(side==="A") B.buffA=key; else B.buffD=key;
    if(key==="power") f.powerBuff=true;
    else if(key==="escape") f.fleeBoost=true;
    else B.maxRounds=BAL.buffTimeRounds;               // 전투 인스턴스 값만 바꾼다 (BAL.maxRounds 전역 불변)
    close(); B.menu=null;
    bmsg(`${BUFFS[key].ko} — ${fighterName(side)}에게 적용!`,{flash:key==="power"?"buff":"guard",st:stFx(side,f)},{key:"itemFx"});
    if(key==="time") bmsg(`🧭 이 전투는 ${BAL.buffTimeRounds}라운드까지 — 사신의 낫은 발동할 수 없다.`);
    battleModal(); render();
  };
  window.__useItemCore=i=>{
    /* #121 계약 2.3 — 유일하게 남은 제한(플레이어별 라운드 1회)을 **규칙 경로에서** 집행한다.
       버튼 disabled 는 표시 계층이라 중복 클릭·수신 프레임·늦은 콜백을 막지 못한다. 아래 네 검사가 모두 통과해야 재고가 움직인다:
       같은 전투인가 · 지금 이 side 의 행동 차례인가 · 그 칸에 실제 아이템이 있는가 · 이번 라운드에 아직 안 썼는가.
       (전투당 2회·연속 동일 금지는 계약으로 제거됐으므로 여기서 막지 않는다.) */
    if(S.battle!==B) return; if(S.battle===B&&B.bonus&&B.bonus.stage==="active") return; // #241 R1 추가 공격 중 불가(L17)
    if(actorOfPhase()!==side) return;
    if(side==="A"?B.itemRoundA:B.itemRoundD) return;     // 라운드 1회
    const k=S.inv[ownerP][i];
    if(k===undefined||!ITEMS[k]) return;                  // 유효하지 않은 인덱스
    S.inv[ownerP].splice(i,1);
    // #121 계약 2.3: itemsX·lastItemX 는 **기록**으로만 남는다 (전투당 2회·연속 동일 금지 제한은 제거). itemRoundX 만 실제 게이트다
    if(side==="A"){B.itemsA++;B.itemRoundA=true;B.lastItemA=k;} else {B.itemsD++;B.itemRoundD=true;B.lastItemD=k;}
    if(k==="potion"){const h=Math.round(f.maxHp*BAL.itemHealPct); f.hp=Math.min(f.maxHp,f.hp+h);
      bmsg(`🧪 회복약! ${fighterName(side)}의 HP ${h} 회복.`,{float:{side,html:`<span class="pos">+${h}</span>`},hp:{side,val:f.hp,max:f.maxHp}},{key:"itemFx"});}
    if(k==="cool"){f.cd=0; if(f.skills)f.cds=f.skills.map(()=>0); f.cdUpFresh=[]; bmsg("🧪 쿨링수 — 스킬 쿨타임 초기화!",null,{key:"itemFx"});} // 4슬롯 전체 초기화 (아이템 설명 문언 준용 — [기획 필요] 후보)
    if(k==="cure"){ if(!f.burnNoCure){f.burn=0;f.burnFresh=false;f.burnMag=0;} f.weaken=0;f.weakenMag=0;f.shock=0;f.shockFresh=false;f.crack=0;f.crackFresh=false;
      /* #234 (4.5): 회복 감소·이끼 잠식도 상태이상 — 영겁의 재 화상(burnNoCure)은 해제되지 않는다. #241 V1: 속도 감소 → 회피율 감소 */
      f.evadeDownR=0;f.evadeDownRFresh=false;f.evadeDown=0;f.healCutR=0;f.healCutRFresh=false;f.healCut=0;f.mossR=0;f.mossRFresh=false;f.mossPct=0;f.mossBy=null; bmsg("🧪 해독제 — 상태이상 해제!",{st:stFx(side,f)},{key:"itemFx"});} // #233 (GDD-23 4.5): 균열도 상태이상 — 경화·흡수·방어막 같은 버프는 그대로 둔다
    B.menu=null; // 사용 연출 뒤 같은 행동자의 메뉴(루트)로 복귀 — 행동 미소모 (GDD 4.6 보너스 행동)
    battleModal();
  };
  window.__throwBallCore=()=>{ // #12 적 하수인 포획: 볼 소모(성공·실패 공통) — 성공 시 포획 종료, 실패 시 행동 소모
    if(S.battle!==B||!canThrow) return; if(S.battle===B&&B.bonus&&B.bonus.stage==="active") return; // #241 R1 추가 공격 중 불가(L17)
    S.balls[ownerP]--;
    if(side==="A")B.ballThrowA=true; else B.ballThrowD=true;
    met(ownerP,"enemyCapTries"); // #20 적 포획 시도
    B.menu=null;
    bmsg(`🔴 ${pname(ownerP)}의 몬스터볼 투척!`,null,{key:"captureFx"});
    if(rand()<BAL.enemyCapProb){ finishByCapture(side); return; }
    met(ownerP,"enemyCapFails"); // #20 적 포획 실패
    bmsg(`🔴 포획 실패! 볼이 튕겨나왔다. (남은 볼 ${S.balls[ownerP]})`,null,{key:"captureFx"});
    nextPhase();
  };
  /* #13 → #146 도망: 성공 시 전투 즉시 종료(판정·제거 없음·battlesUsed 유지), **실패 시 자기 전투 행동 1회만 소모**한다.
     실패 반격(fleeCounter)은 #146 계약으로 삭제됐다 — 상대는 자기 정상 차례를 그대로 받는다(nextPhase 가 차례를 넘긴다).
     Saturn P1 계열 가드와 같은 이유로 (a) 같은 전투인지 (b) 지금이 이 side 의 행동 차례인지를 실행 직전에 다시 본다:
     도망은 이제 HP 게이트가 없어 disabled 표시만으로는 중복 클릭·늦은 콜백·수신 프레임을 막지 못한다. */
  window.__fleeCore=()=>{
    if(!actionFresh()) return;   // 같은 전투·내 차례·아직 이 렌더의 행동을 쓰지 않았고·연출 재생 중이 아닐 때만
    if(S.battle===B&&B.bonus&&B.bonus.stage==="active") return; // #241 R1 추가 공격 중 불가(L17)
    if(f.fleeLock){ try{ if(viewerIsOwner(ownerP)) showToast("🌿 뿌리 고정 — 이 전투에서는 도망칠 수 없습니다"); }catch(e){} return; } // #234 가시 덩굴 3차
    B.actSeq++;                  // 여기서부터 이 클로저는 무효 — 두 번째 호출은 위 가드에서 걸린다
    met(ownerP,"fleeTries");
    B.menu=null;
    bmsg(`🏃 ${fighterName(side)}의 도망 시도!`,null,{key:"fleeFx"});
    if(rand()<fleeProbOf(f)){
      met(ownerP,"fleeOks");
      const piece=side==="A"?B.attP:B.defP, oppPiece=side==="A"?B.defP:B.attP; // #114 전투 상대(former opponent)는 전투 객체가 사라진 뒤에도 교환·밀기 대상으로 보존
      bmsg(`🏃 도망 성공! 전투가 종료되었다.`);
      addLog(`🏃 ${pname(ownerP)} 도망 성공 — 전투 종료 (판정·제거 없음)`,"imp"); showToast("🏃 도망 성공 — 전투 종료");
      resetAfter(B.fa); resetAfter(B.fd);
      const q=B.msgQ.splice(0);
      S.battle=null;
      battleEndFx(q,{title:"도망 성공 — 전투 종료",cls:""},()=>{ if(!S.battle){ close(); fleeSwapPrompt(piece,oppPiece); } });
      return;
    }
    /* #122 REVISE(2026-09-10 CJ QA 2) — 도망 실패 페널티: **상대의 무료 기본 공격 1회**를 맞는다.
       #146 계약 1.2 가 지웠던 실패 반격을 "기본 공격 한정"으로 되살린 것이며, 그 밖은 #146 그대로다:
         · 도망을 시도한 쪽은 자기 전투 행동 1회를 소모한다 (주 행동·턴당 전투 횟수는 건드리지 않는다).
         · 반격이 끝나면 execSlot 이 nextPhase() 로 차례를 넘겨 **상대의 정상 차례**가 그대로 온다 (반격은 그 차례를 대신하지 않는다).
         · 반격은 기술이 아니라 기본 공격이므로 쿨·기술 공개·기술 부가효과가 없다. 상대가 4슬롯 전투원이어도
           allowBasic 예외로 본체 공격력(f.atk)만큼 때린다.
       💪 힘의 수호자: 별도 처리가 없다 — 반격자에게 powerBuff 가 걸려 있으면 기존 피해 분산 고정(×1.2)이 그대로 적용돼
       자동으로 "기본 공격 중 최대 데미지"가 된다 (CJ 지시 그대로, 난수 소비 횟수도 불변이라 온라인 락스텝·AI 시뮬 재현성 유지). */
    bmsg(`🏃 도망 실패! 빈틈을 보이고 말았다.`);
    const oSide=side==="A"?"D":"A";
    bmsg(`⚔️ ${fighterName(oSide)}의 반격 — 기본 공격!`);
    execSlot(oSide,-1,{allowBasic:true});   // 여기서 checkDeath → finishBattle 또는 nextPhase 까지 끝난다
  };
  /* #146 계약: 4슬롯이 전부 불가할 때의 **수동** 전투 행동 넘기기. 자동 진행이 아니라 사람이 [턴 종료]를 눌러야 실행된다.
     차단 대상(전부 조용히 무시 — 상대에게는 아무 안내도 새지 않는다):
       · 다른 전투 / 지난 렌더의 오래된 클로저 (S.battle!==B)
       · 지금이 내 전투 행동 차례가 아님 (actorOfPhase)
       · 사실은 쓸 수 있는 공격이 있음 — 쿨링수·냉각으로 슬롯이 살아난 뒤의 늦은 클릭, 또는 UI 밖에서 온 불법 호출
       · 왕·동료 본체(f.skills 없음) — 기본 공격이 있으므로 넘기기 대상이 아니다
     소모하는 것은 **자기 전투 행동 1회**(nextPhase)뿐이다: 보드 주 행동·턴당 전투 횟수·약화 잔여 횟수·난수는 건드리지 않는다. */
  window.__passCore=()=>{
    if(!actionFresh()) return;   // 중복 클릭·라운드 경계 연속 행동·연출 재생 중 호출을 모두 막는다
    if(S.battle===B&&B.bonus&&B.bonus.stage==="active") return; // #241 R1 추가 공격 중 불가(L17)
    if(!f.skills) return;
    if(f.skills.some((sid2,i)=>slotUsable(f,i,side))) return;
    B.actSeq++;
    B.menu=null;
    /* 비공개: B.blog 는 양측이 공유하는 상태다. **왜** 넘겼는지(= 내 기술 4칸이 전부 막혔다)는
       상대의 미공개 정보이므로 공개 로그에는 중립적인 결과만 남긴다 (#121 5.3 봉인 사유 비공개와 같은 원칙).
       사유 안내는 소유자 화면의 모달·도움말에만 있다. */
    bmsg(`⏭ ${fighterName(side)}는 이번 행동을 넘겼다.`);
    nextPhase();
  };
  window.__actCore=kind=>{
    /* Saturn REVISE P1: 전투 커맨드의 실제 적용 지점이다. 이 클로저는 렌더 시점의 B·side·f 를 들고 있으므로
       (a) 그 전투가 아직 진행 중이고 (b) 지금이 그 side 의 행동 차례일 때만 실행한다.
       중복 클릭·늦은 콜백·수신 프레임이 다른 전투/다른 차례에 행동을 밀어 넣는 경로를 막는다. */
    if(S.battle!==B) return;
    if(actorOfPhase()!==side) return;
    if(B.bonus&&B.bonus.stage==="active"&&(B.actSeq||0)!==actSeq) return; // #241 R1: 번개 꼬리 이전 렌더의 늦은 콜백이 추가 공격을 대신 쓰지 않게
    // 슬롯 인덱스(0~3) + 레거시 매핑: 'basic'→슬롯0(쿨이면 순수 기본 공격 폴백), 'skill'→슬롯1, 'common'→슬롯2
    B.menu=null;
    let slot=null;
    if(typeof kind==="number"){ if(f.skills&&f.skills[kind]!==undefined) slot=kind; }
    /* Saturn P1: 'basic' 은 **쿨이 아니라 합법성**을 본다. 종전 `f.cds[0]===0` 은 슬롯0 이 봉인된 사신이어도 그 슬롯으로
       들어가, 계약 5.3 "기본 공격 폴백을 사신으로 강제 매핑하지 않는다" 를 깼다. 합법이 아니면 순수 기본 공격(-1)이다.
       #146: 4슬롯 전투원에게 순수 기본 공격(-1)은 더 이상 존재하지 않는다. UI 는 그 버튼을 그리지 않으므로 여기로 들어오는
       'basic' 은 오래된 클로저·수신 프레임·UI 밖 호출뿐이다 — 조용히 거부한다 (왕·동료 본체는 f.skills 가 없어 해당 없음). */
    else if(kind==="basic"){
      if(f.skills&&!slotUsable(f,0,side)) return;
      slot=f.skills?0:-1;
    }
    else if(kind==="skill"&&f.skills) slot=1;
    else if(kind==="common"&&f.skills) slot=2;
    if(slot!==null){ execSlot(side,slot); return; }
    if(kind!=="skill"||!f.skillAtk){ execSlot(side,-1); return; } // 왕·동료 본체: 기본 공격
    // ===== 구형 속성 스킬 경로 (로스터 미적용 하수인 전용 — 레거시 테스트 호환) =====
    const oSide=side==="A"?"D":"A", sp=skillParamsOf(f);
    const tryStatus=prob=>{ // T5-A(D10): 상태이상 부여 확률 — 지속형 100%, 그 외 statusProb (#96: 감전은 shockProb)
      // #233 (GDD-23 3.2 💫): 스탯 상태이상 부여 확률을 %p로 가산, 상한 100%
      const p=Math.min(1,(prob===undefined?BAL.statusProb:prob)+(f.statusPct||0));
      if(archOf(f)==="sustain"||rand()<p){S.metrics.statusApplied++; return true;}
      S.metrics.statusFailed++; bmsg("상태이상 부여 실패!"); return false;
    };
    bmsg(`${fighterName(side)}의 ${f.element?SKILL_KO[f.element]:"스킬"}!`,null,{key:"skillFx"});
    f.cd=f.cdMax||BAL.minion.cd;
    // #233 (GDD-23 4.2): 풀 속성 레거시 스킬은 자체 위력 배율(grassDmgMult)을 ②의 기본 피해에 접어 넣는다
    const base=f.skillAtk*(f.element==="grass"?sp.grassDmgMult:1);
    const res=resolveHit(side,f,opp,oSide,base,0,f.element,null);
    if(f.element==="grass"){ // 자기 대상 효과 — 회피 여부와 무관하게 유지(4.2 ① 주석)
      if(sp.shieldPct) shieldAdd(f,Math.round(f.maxHp*sp.shieldPct),"grassLegacy");
      const gh=Math.round(f.maxHp*sp.healPct);
      f.hp=Math.min(f.maxHp,f.hp+gh);
      bmsg(sp.shieldPct?`🌿 보호막·회복 획득!`:`🌿 회복 획득!`,{float:{side,html:`<span class="pos">+${gh}</span>`},hp:{side,val:f.hp,max:f.maxHp},st:stFx(side,f)});
    }
    if(!res.evaded){ // 대상 지정 효과 — 회피하면 걸리지 않는다
      /* GDD-23 5.6 중첩·재부여 — 위 execSlot 경로와 같은 규칙을 구형 경로에도 같이 적용한다
         (한쪽만 고치면 다른 쪽이 조용히 옛 규칙으로 남는다). */
      if(f.element==="fire"&&tryStatus()){const had=opp.burn>0; applyTimedFx(opp,"burn",sp.burnRounds); opp.burnBy=side;
        bmsg(`🔥 ${fighterName(oSide)}는 화상을 입었다!${had?" (갱신)":""} (${opp.burn}R)`,{st:stFx(oSide,opp)});}
      if(f.element==="water"&&tryStatus()){const had=opp.weaken>0; opp.weaken=Math.max(opp.weaken||0,sp.weakenHits);
        bmsg(`💧 ${fighterName(oSide)}는 약화되었다!${had?" (갱신)":""} (${opp.weaken}회)`,{st:stFx(oSide,opp)});}
      if(f.element==="lightning"&&tryStatus(BAL.shockProb)){applyTimedFx(opp,"shock",sp.shockRounds);
        bmsg(`⚡ ${fighterName(oSide)}는 감전 — 다음 ${opp.shock}라운드 후공!`,{st:stFx(oSide,opp)});}
    }
    if(checkDeath()) return;
    nextPhase();
  };
  /* #106 5.1·5.2 표시 순서: (1) 진입 카운트다운 3·2·1·배틀 시작! (1회) → (2) 남은 메시지 재생 → (3) 행동(phase) 배너 "나의 턴!/상대 턴!" (행동마다 1회) → (4) 메뉴 활성 / AI 스케줄.
     각 단계는 끝나면 battleModal 을 다시 그려 다음 단계로 간다 — 플래그(intro·bannerKey)로 같은 단계를 두 번 재생하지 않는다. 헤드리스·sim 은 (1)(3) 이 0ms 라 종전 흐름과 같다 */
  if(!B.intro){ B.intro=true;
    if(fxLive()){ for(const t of ["3","2","1","배틀 시작!"]) fxPlay({key:"countStep",kind:"count",title:t}); fxWhenIdle(()=>{ if(S.battle===B) battleModal(); }); return; } }
  if(B.msgQ.length){ playMsgs(B.msgQ.splice(0),()=>{ if(S.battle===B) battleModal(); }); return; }
  const bkey=B.round+"-"+B.phase;
  if(B.bannerKey!==bkey){ B.bannerKey=bkey;
    if(fxLive()){ fxPlay({key:"roundBanner",kind:"banner",cls:viewerIsOwner(ownerP)&&!(S.mode==="pvp"&&!NET.mode)?"mine":"",title:turnLabel,sub:`Round ${B.round} / ${BAL.maxRounds}`}); fxWhenIdle(()=>{ if(S.battle===B) battleModal(); }); return; } }
  if(aiActor) aiScheduleBattle();
}
/* #106 5.6 전투 종료 연출 공통: 남은 메시지 재생 → 결과 배너(뷰어 기준 문구) → 닫기 콜백. 헤드리스는 즉시 */
function battleEndFx(q,banner,after){
  const run=()=>fxPlay({key:"resultBanner",kind:"result",cls:banner.cls||"",title:banner.title,sub:banner.sub||"",onEnd:after});
  if(liveBattleDom()) playMsgs(q,run); else { MSGQ.length=0; run(); }
}
/* ===== #126 (v0.4.7) 경기 종료 표현 — 경기당 정확히 1회 =====
   왕 제거·전멸처럼 **전투가 곧 경기 종료**인 경우에는 전투 결과 배너 대신 이 경기 결과 배너 하나로 분기하고,
   전투를 거치지 않는 종료(왕 도달·기권·상대 이탈·sim 턴 상한)는 gameOver 안에서 이 배너 하나만 재생한다.
   전투 결과 + 경기 결과를 직렬로 두 번 재생하지 않는다. 결과 상수(resultBanner 2500ms)는 그대로다.
   전투 판정의 동률은 종전대로 **방어자 승**이며 전투 무승부 화면을 만들지 않는다 — 무승부 문구는 경기 무승부에만 쓴다. */
let ENDING_BATTLE=false; // finishBattle·finishByCapture 가 종료 배너를 직접 고르는 구간 (gameOver 의 자동 재생을 잠시 막는다)
function matchBannerOf(){
  const w=S.winner, typeKo=S.metrics.winType?WINTYPE_KO[S.metrics.winType]:"";
  if(w===null) return {title:"무승부",sub:"경기 무승부 — 시뮬레이션 턴 상한 도달",cls:"match draw"};
  const sub=(typeKo?`승리 유형: ${typeKo} · `:"")+`총 ${S.turnCount}턴`;
  if(S.mode==="sim"||(S.mode==="pvp"&&!NET.mode)) return {title:`${pname(w)} 승리!`,sub,cls:"match neutral"}; // 핫시트는 중립 문구 (같은 기기의 두 사람)
  return viewerIsOwner(w)?{title:"경기 승리!",sub,cls:"match win"}:{title:"경기 패배...",sub,cls:"match lose"};
}
function matchEndBanner(){ // 경기당 1회 — 이미 낸 뒤면 null (경기 기준 플래그, newGame 이 새로 만든다)
  if(!S||S.matchFxDone) return null;
  S.matchFxDone=true;
  return matchBannerOf();
}
function matchEndFx(){
  const b=matchEndBanner(); if(!b) return;
  /* 경기가 끝났으므로 남아 있던 표시 큐(턴 배너·접촉 배너·대기 콜백)는 더 이상 의미가 없다 — 걷어내고 결과 하나만 남긴다.
     연출이 자기를 넣고 자기를 지우는 순서가 생기지 않도록 **넣기 전에** 정리한다 (Venus 3.2 · L5). */
  try{ fxReleaseAll(); }catch(e){}
  fxPlay({key:"resultBanner",kind:"result",cls:b.cls,title:b.title,sub:b.sub});
}
function resultBannerOf(winP){ // 사망·판정 결과 문구: 핫시트 중립 "P1 승리!", PVE·온라인 뷰어 기준 "전투에서 승리!/패배,,,"
  /* #126: 문구·뷰어 규약은 종전 그대로이고 cls 만 연출 갈래를 고른다 — 중립(핫시트)은 금빛, 뷰어 승리는 금빛, 패배는 어두운 균열.
     전투 판정 동률은 방어자 승이라 여기 오는 결과는 언제나 승/패 둘 중 하나다 (전투 무승부 갈래를 만들지 않는다). */
  if(S.mode==="pvp"&&!NET.mode) return {title:`${pname(winP.owner)} 승리!`,cls:"neutral"};
  return viewerIsOwner(winP.owner)?{title:"전투에서 승리!",cls:"win"}:{title:"전투에서 패배,,,",cls:"lose"};
}
/* ===== 4슬롯 실행 엔진 (GDD-16) — slot -1은 폴백 기본 공격, 로직은 동기 완결 ===== */
/* #121 계약 5.2 🕯 마녀의 장난 — 화상·약화·감전·풀 회복 4효과 중 **서로 다른 2개**를 100% 적용한다.
   · 조합: 4C2 = 6가지를 **균등 추첨, 공유 rand 1회**. 조합 표는 순서 고정이라 같은 시드에서 양측·AI 시뮬이 같은 조합을 얻는다.
   · 확률 게이트 없음: statusProb(70%)·shockProb(50%) 를 통과시키지 않고 **난수도 추가로 쓰지 않는다**
     (기존 시그니처 '잔류장'의 force 경로와 같은 방식 — rand 미소비).
   · 재부여는 **누적이 아니라 지속 기간 갱신**이다. 일반 효과기의 "이미 걸려 있으면 부여하지 않음"은 그대로 유지되고,
     이 예외는 마녀 전용이다.
   · 풀 회복은 **이번 공격이 상대 HP 에 실제로 입힌 피해(actual)의 100%** 를 즉시 자기 회복한다. 보호막에 흡수된 몫과
     오버킬은 actual 에 들어 있지 않으므로 자동으로 제외되고, 전부 흡수되면 actual 0 → 회복 0 이다. 자기 maxHp 가 상한.
     2라운드 지속 흡수 버프가 **아니다** (2026-09-09 CJ 결정).
   지표는 기존 statusApplied 를 쓴다 (부여 실패가 없으므로 statusFailed 는 늘지 않는다). */
const WITCH_EFFECTS=["burn","weaken","shock","grassHeal"];   // 순서 고정
const WITCH_COMBOS=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];    // 4C2 — 균등 6조합
function witchApply(side,oSide,f,opp,actual){
  const combo=WITCH_COMBOS[Math.floor(rand()*WITCH_COMBOS.length)]; // 공유 rand 1회
  for(const idx of combo){
    const eff=WITCH_EFFECTS[idx];
    /* GDD-23 5.6 — 같은 종류는 더하지 않고 수치는 큰 값·남은 지속은 긴 값으로 갱신한다.
       마녀 콤보도 같은 공용 헬퍼를 써 부여 라운드 제외 가드까지 똑같이 따른다. */
    if(eff==="burn"){ applyTimedFx(opp,"burn",BAL.burnRounds); opp.burnBy=side; S.metrics.statusApplied++;
      bmsg(`🔥 ${fighterName(oSide)}는 화상을 입었다! (${opp.burn}R)`,{st:stFx(oSide,opp)}); }
    else if(eff==="weaken"){ opp.weaken=Math.max(opp.weaken||0,BAL.weakenHits); S.metrics.statusApplied++; // 약화만 횟수제
      bmsg(`💧 ${fighterName(oSide)}는 약화되었다! (${opp.weaken}회)`,{st:stFx(oSide,opp)}); }
    else if(eff==="shock"){ applyTimedFx(opp,"shock",1); S.metrics.statusApplied++;
      bmsg(`⚡ ${fighterName(oSide)}는 감전 — 다음 ${opp.shock}라운드 후공!`,{st:stFx(oSide,opp)}); }
    else { const gh=Math.min(actual,f.maxHp-f.hp); // 풀: 실HP 피해 100% 즉시 회복 (maxHp 상한)
      if(gh>0){ f.hp+=gh;
        bmsg(`🌿 어둠의 덩굴이 생명을 빨아들인다 — HP ${gh} 회복!`,{float:{side,html:`<span class="pos">+${gh}</span>`},hp:{side,val:f.hp,max:f.maxHp}}); }
      else bmsg(`🌿 어둠의 덩굴 — 빨아들일 생명이 없었다. (회복 0)`); }
  }
}
/* ===== #233 (GDD-23 4.5·5.6) 상태이상·버프의 중첩·재부여·지속 계약 =====
   5.6: "같은 종류의 효과는 한 대상에 1개만 존재한다. 이미 걸린 효과에 다시 당첨되면 수치는 둘 중 **큰 값**,
   남은 지속도 둘 중 **긴 값**으로 갱신하고 더하지 않는다. **방어막만 예외**로 층으로 쌌아 합산한다(shieldAdd)."
   또 "N 라운드" 지속은 **부여된 라운드를 세지 않고** 다음 라운드부터 센다(4.7 화상 예시와 현행 감전 방식).
   그래서 부여·재부여마다 fresh 가드를 세워 그 라운드 종료의 1 소모를 건너뛴다.
   재부여 비교는 **이번 라운드 종료에 어차피 빠질 1을 먼저 반영한 잔여**로 한다 — 그래야
   "지금 새로 거는 NR"과 "이미 걸린 것을 NR로 갱신"이 같은 라운드에 끝난다. */
function applyTimedFx(f,key,rounds,magKey,mag){
  const freshKey=key+"Fresh";
  const cur=f[key]||0;
  const pending=cur>0?Math.max(0,cur-(f[freshKey]?0:1)):0; // 이번 라운드 종료 소모를 반영한 잔여 지속
  f[key]=Math.max(pending,rounds||0);
  if(magKey) f[magKey]=Math.max(cur>0?(f[magKey]||0):0,mag||0); // 수치는 둘 중 큰 값 (꺼진 효과의 잔류 수치는 상속하지 않는다)
  f[freshKey]=true;
  return f[key];
}
/* 4.5 사전의 개별 효과 진입점 — #234 로스터 전까지 실제 호출자는 없고 엔진 계약만 완결한다. */
function applyCrack(f,rounds){ return applyTimedFx(f,"crack",rounds===undefined?2:rounds); }          // 균열(땅): 받는 피해 +10%, 2R
function applyHarden(f,pct,rounds){ return applyTimedFx(f,"harden",rounds,"hardenPct",pct); }         // 경화: 받는 피해 −X%, 표기된 지속
function applyEvadeBuff(f,pct,rounds){ return applyTimedFx(f,"evadeBuffR",rounds,"evadeBuff",pct); }  // 회피 증가
function applyDmgUpBuff(f,pct,rounds){ return applyTimedFx(f,"dmgUpBuffR",rounds,"dmgUpBuff",pct); }  // 가하는 피해 증가
/* ===== #233 (GDD-23 3.2·4.2·4.3) 방어막 층·피해 계산 파이프라인 — 엔진 계약 본체 =====
   방어막은 "얻을 때마다 획득원이 붙은 층"으로 쌓이고, 피해는 **가장 나중에 얻은 층부터** 깎인다(LIFO).
   f.shield 는 종전과 같은 표시용 합계 필드로 계속 유지한다(패널·stFx·연출이 그대로 읽는다). */
function shieldAdd(f,amount,src){
  if(!amount) return;
  f.shieldLayers=f.shieldLayers||[];
  f.shieldLayers.push({amt:amount,src:src||"?"});
  f.shield=(f.shield||0)+amount;
}
function shieldConsume(f,dmg){ // 반환 {absorbed,breaks} — breaks: 이 타격으로 남은 양이 0이 된 층 수(3.2 "깨짐")
  f.shieldLayers=f.shieldLayers||[];
  /* 하위 호환 — f.shield 를 (테스트·레거시 경로가) shieldAdd 를 거치지 않고 직접 바꿨다면, 층 합계와 어긋난 차액을
     "가장 나중에 얻은 층"으로 흡수해 둔다. shieldAdd 를 거친 정상 경로는 항상 층 합계 == f.shield 라 여기서 아무 일도 없다. */
  const layerSum=f.shieldLayers.reduce((s,l)=>s+l.amt,0);
  if((f.shield||0)>layerSum) f.shieldLayers.push({amt:(f.shield-layerSum),src:"legacy"});
  let remain=Math.max(0,dmg), absorbed=0, breaks=0, used=0; const bySrc={};
  /* #241 단순화 11: 요새 전환의 '절반만 소모' 분기 삭제 — 막은 만큼 층에서 소모한다 */
  while(remain>0&&f.shieldLayers.length){
    const top=f.shieldLayers[f.shieldLayers.length-1];
    const take=Math.min(top.amt,remain);
    const cost=take;
    top.amt-=cost; remain-=take; absorbed+=take; used+=cost;
    bySrc[top.src]=(bySrc[top.src]||0)+take; // 층별 '막아낸 피해'(3.2) — 축전·포자 막이 읽는다
    if(top.amt<=0){ f.shieldLayers.pop(); breaks++; }
  }
  f.shield=Math.max(0,(f.shield||0)-used);
  return {absorbed,breaks,bySrc};
}
function shieldClearAll(f){ // 버프 제거류 — 모든 층을 한꺼번에 지우며 "방어막 1개"로 센다(3.2). 깨짐이 아니다.
  const had=(f.shieldLayers&&f.shieldLayers.length>0)||f.shield>0;
  f.shieldLayers=[]; f.shield=0; return had;
}
/* GDD-23 4.2 일반 피해 계산 ①~⑪ — base=②의 곱셈부(공격력×위력%), flatBonus=②의 스킬 고정 피해,
   atkEl=판정 속성(null=중립), dragonMult가 있으면 ④를 상성표 대신 이 고유 배율로 대체한다(드래곤 숨결, 5.1).
   상대가 회피하면(①) 피해·대상 지정 효과가 전부 사라지고 자기 대상 효과만 남는다 — 호출부가 evaded로 분기한다. */
function resolveHit(side,f,opp,oSide,base,flatBonus,atkEl,dragonMult,extraDmgUp,hopts){
  /* #234 hopts: penalty(도망 실패 페널티 — 확정 치명 미소모) · critForce(v2Hit 이 소모까지 끝낸 이 타격의 확정 치명 여부 — 있으면 f.critForce 를 보지 않는다) · ignoreShield(방어막 무시) · ignoreDef(⑧ 전부 무시 — 대지 관통)
     #241: outMult(모래바람 ⑥) 삭제 · preview(해일 예고 — ①~⑩까지만 계산해 X 를 돌려주고 ⑪ 철벽/과부하 · 방어막 · HP · 기록 · 대상 상태 소모는 하지 않는다. 사용자 약화는 공격으로 1회 소모) */
  hopts=hopts||{};
  /* 약화(4.5) = "가하는 피해 -20%, 대상의 공격 2회" — 소모형 카운터라 회피 여부와 무관하게 이번 공격 행동으로 1회 줄어든다.
     그래서 회피 조기 반환보다 먼저 처리한다(자기 상태 소모는 "대상 지정 효과"가 아니라 회피의 면제 대상이 아니다). */
  const weakened=f.weaken>0;
  const weakenPctNow=f.weakenMag||BAL.weakenPct; // #234: 약화 수치(기술 −20% · 동료의 복수 등 왕국 값) — 큰 값으로 합쳐진 현재 값
  if(weakened){ f.weaken--; if(!f.weaken) f.weakenMag=0; if(!f.weaken) bmsg(`💧 ${fighterName(side)}의 약화가 풀렸다.`,{st:stFx(side,f)}); }
  /* ① 회피 판정, 상한 40% (3.2). "확정 회피" 효과(opp.dodgeForce)는 확률 판정을 건너뛰고 상한보다 우선하며 rand 를 쓰지 않는다
     (3.2 "확정 효과는 확률 판정을 건너뛰므로 상한보다 우선합니다" — #234 전까지 이 플래그를 켜는 스킬은 없다). */
  let evaded;
  if(opp.dodgeForce){ evaded=true; opp.dodgeForce=false; }
  else evaded=rand()<effEvade(opp); // #241 V1: 기본 + 증가 − 회피율 감소, 0~40% (난수 소비 횟수 불변)
  if(evaded){
    bmsg(`💨 ${fighterName(oSide)}는 회피했다!`,{st:stFx(oSide,opp)});
    if(hopts.critForce===undefined&&f.critForce&&!hopts.penalty) f.critForce=false; // #234 REVISE 3차 P14: v2Hit 밖 경로도 회피 시 확정 치명 소모
    return {evaded:true,dmg:0,crit:false,absorbed:0,actual:0,counted:0};
  }
  let dmg=(base||0)+(flatBonus||0); // ② 기본 피해 = 공격력×위력% + 고정 피해
  const roll=rand(); // ③ 피해 분산 0.8~1.2 (힘의 수호자면 1.2 고정)
  dmg=dmg*(f.powerBuff?(1+BAL.dmgVar):(1-BAL.dmgVar+roll*2*BAL.dmgVar));
  if(dragonMult!==undefined&&dragonMult!==null){ if(opp.element) dmg=dmg*dragonMult; } // ④ 속성 상성(드래곤 고유 배율로 대체)
  else if(atkEl&&opp.element){
    if(BEATS[atkEl]===opp.element) dmg=dmg*BAL.advMult;
    else if(BEATS[opp.element]===atkEl) dmg=dmg*BAL.disMult;
  }
  const dmgUp=Math.min(0.5,(f.atkBuff?BAL.nextBuffPct:0)+(f.dmgUpBuff||0)+(extraDmgUp||0)); // ⑤ 가하는 피해 증가, 상한 +50%
  dmg=dmg*(1+dmgUp);
  if(weakened) dmg=dmg*(1-weakenPctNow); // ⑥ 약화 감소율 (카운터는 함수 시작에서 이미 소모)
  /* ⑦ 치명타 판정, 상한 50% (3.2). "치명타 확정" 효과(f.critForce)는 확률 판정을 건너뛰고 상한보다 우선하며 rand 를 쓰지 않고,
     다음 피해 스킬 1회에 소모된다(3.2 — #234 전까지 이 플래그를 켜는 스킬은 없다). */
  let crit;
  if(hopts.critForce!==undefined) crit=hopts.critForce?true:rand()<Math.min(0.5,f.crit||0); // v2Hit 경로 — 확정이면 rand 0회(종전과 같은 소비)
  else if(f.critForce&&!hopts.penalty){ crit=true; f.critForce=false; }
  else crit=rand()<Math.min(0.5,f.crit||0);
  if(crit) dmg=dmg*1.5;
  if(!hopts.ignoreDef){
  const dmgDown=Math.min(0.5,((opp.def||0)/100)+(opp.hardenPct||0)+(opp.dmgCut||0)); // ⑧ 받는 피해 감소 = 방어력+경화+"다음 피격 감소"류, 상한 50% (#241: 굴 파기는 경화 40%로 단순화 — 전용 분기 삭제)
  if(!hopts.preview) opp.mitigated=(opp.mitigated||0)+dmg*Math.min(dmgDown,((opp.def||0)/100)+(opp.hardenPct||0)); // #234 분화: 방어력·경화로 줄인 피해 총량
  dmg=dmg*(1-dmgDown);
  }
  if(!hopts.preview){
  if(opp.dmgCut>0) bmsg(`${fighterName(oSide)}는 자세를 낮춰 피해를 흘렸다!`,{st:stFx(oSide,opp)});
  opp.dmgCut=0; }
  const dmgTakeUp=Math.min(0.5,(opp.crack?0.10:0)+(opp.vulnMark?0.15:0)); // ⑨ 받는 피해 증가 = 균열 등, 상한 +50%
  dmg=dmg*(1+dmgTakeUp);
  if(!hopts.preview){
  if(opp.vulnMark) bmsg(`⚠️ 결정타의 반동 — 피격 +15%!`);
  opp.vulnMark=false; }
  const raw=dmg; dmg=Math.round(dmg); if(raw>0&&dmg<1) dmg=1; if(dmg<0) dmg=0; // ⑩ 정수 반올림 1회, 0보다 크면 최소 1
  if(hopts.preview) return {evaded:false,dmg,crit,preview:true}; // #241 R2 해일 예고 X — 여기서 멈춘다(피해를 주지 않는다)
  dmg=v2IncomingCap(opp,dmg); // #234 철벽 돌파(1회 무효) · 과부하 방벽(1회 상한 최대 HP 15%)
  const {absorbed,breaks,bySrc}=hopts.ignoreShield?{absorbed:0,breaks:0,bySrc:{}}:shieldConsume(opp,dmg); // ⑪ 방어막 우선 소모 후 HP (방어막 무시 스킬은 층을 깎지 않는다)
  const hpDmg=dmg-absorbed;
  let actual=Math.min(hpDmg,opp.hp); actual=v2Endure(opp,actual); opp.hp-=actual;
  const capLeft=Math.max(0,Math.round(opp.maxHp*BAL.absorbCapPct)-opp.absorbed); // 전투 판정용 유효 피해 흡수 상한 — 현행 그대로 (변경 대상 아님)
  const freeAbsorb=Math.min(absorbed,capLeft); opp.absorbed+=freeAbsorb;
  const counted=actual+(absorbed-freeAbsorb);
  addRec(side,counted);
  bmsg(`${dmg} 피해!${crit?" (치명타)":""}${absorbed?` (흡수 ${absorbed})`:""} · 유효 ${counted}`,
    {shake:oSide,flash:atkEl||null,float:{side:oSide,html:`<span class="neg">-${dmg}</span>${absorbed?`<span class="abs"> (흡수 ${absorbed})</span>`:""}`},
     hp:{side:oSide,val:opp.hp,max:opp.maxHp},st:stFx(oSide,opp)},{key:"damageFx"});
  return {evaded:false,dmg,crit,absorbed,breaks,actual,counted,bySrc}; // breaks(3.2 "깨짐"): 이 타격으로 남은 양이 0이 된 방어막 층 수
}
/* GDD-23 4.3 반사·반격 — 일반 파이프라인의 부분집합만 탄다(회피·분산·상성 판정 없음: 반사는 상성도 없다, 반격은 ④만 탄다).
   #234 전까지 이 둘을 실제로 발동하는 기술·왕국 시너지가 없어 라이브 호출부는 아직 없지만, 엔진 계약은 여기서 완결하고
   전용 회귀가 이 실제 함수를 직접 호출해 검증한다(4.6 연쇄 금지: 반사·반격 피해 자체는 다시 반사·반격을 만들지 않는다 — 호출부가 재귀하지 않으면 자동 성립). */
/* #233 (GDD-23 4.6) 연쇄 금지 — "추가 사용·반사·반격은 한 행동에 1회까지이고, 그 피해가 다시 반사·반격을 일으키지 않는다."
   호출자 주의가 아니라 엔진이 직접 막는다: resolveTyped 실행 중에는 S.battle.chainLock 이 서고, 그 안에서 resolveTyped 가
   다시 불리면(반사가 반사를 부르는 등) 아무것도 하지 않고 조용히 무효 반환한다 — HP·난수 변화 0. */
function resolveTyped(side,f,opp,oSide,dmgRaw,useElement,label,emoji){
  const B=S.battle;
  if(B&&B.chainLock) return {dmg:0,absorbed:0,breaks:0,actual:0,counted:0,blocked:true};
  if(B) B.chainLock=true;
  try{ return resolveTypedInner(side,f,opp,oSide,dmgRaw,useElement,label,emoji); }
  finally{ if(B) B.chainLock=false; }
}
function resolveTypedInner(side,f,opp,oSide,dmgRaw,useElement,label,emoji){
  let dmg=dmgRaw;
  if(useElement&&f.element&&opp.element){ if(BEATS[f.element]===opp.element) dmg=dmg*BAL.advMult; else if(BEATS[opp.element]===f.element) dmg=dmg*BAL.disMult; }
  const dmgDown=Math.min(0.5,((opp.def||0)/100)+(opp.hardenPct||0)+(opp.dmgCut||0)); opp.dmgCut=0;
  opp.mitigated=(opp.mitigated||0)+dmg*Math.min(dmgDown,((opp.def||0)/100)+(opp.hardenPct||0));
  dmg=dmg*(1-dmgDown);
  const dmgTakeUp=Math.min(0.5,(opp.crack?0.10:0)+(opp.vulnMark?0.15:0)); opp.vulnMark=false;
  dmg=dmg*(1+dmgTakeUp);
  const raw=dmg; dmg=Math.round(dmg); if(raw>0&&dmg<1) dmg=1; if(dmg<0) dmg=0;
  dmg=v2IncomingCap(opp,dmg);
  const {absorbed,breaks}=shieldConsume(opp,dmg);
  let actual=Math.min(dmg-absorbed,opp.hp); actual=v2Endure(opp,actual); opp.hp-=actual;
  const capLeft=Math.max(0,Math.round(opp.maxHp*BAL.absorbCapPct)-opp.absorbed);
  const freeAbsorb=Math.min(absorbed,capLeft); opp.absorbed+=freeAbsorb;
  const counted=actual+(absorbed-freeAbsorb);
  addRec(side,counted);
  bmsg(`${emoji} ${fighterName(side)}의 ${label} — ${fighterName(oSide)}에게 ${dmg} 피해!${absorbed?` (흡수 ${absorbed})`:""}`,
    {shake:oSide,hp:{side:oSide,val:opp.hp,max:opp.maxHp},st:stFx(oSide,opp)},{key:"damageFx"});
  return {dmg,absorbed,breaks,actual,counted};
}
function resolveReflect(side,f,opp,oSide,incomingDmg,pct){ return resolveTyped(side,f,opp,oSide,incomingDmg*pct,false,"반사","🪞"); } // 상성 판정 없음
function resolveCounter(side,f,opp,oSide,pct){ return resolveTyped(side,f,opp,oSide,(f.atk||0)*pct,true,"반격","🦀"); } // ④ 상성만 탄다
function instaKill(opp){ opp.shieldLayers=[]; opp.shield=0; opp.hp=0; } // 4.3 즉사 — 단계 없음, 방어막 무시
/* GDD-23 4.3 예고 피해(해일 예고 등) — 발동 시점에 일반 피해 ①~⑪을 그대로 태운다. 발동 전에 전투가 끝나면 취소된다
   (tickDelayed가 라운드 종료마다 불리고, S.battle이 이미 없으면 run()을 부르지 않는다 → 자동 취소, 4.6). */
/* tag 는 서버 락스텝 요약이 같은 라운드에 예약된 서로 다른 예고 피해를 구분하기 위한 **안정된 문자열**이다
   (기술 id 등). 콜백은 직렬화할 수 없어 서버는 [roundsLeft, tag||null] 로만 요약한다 — tag 가 없으면
   두 좌석 엔진이 갈려도 VOID 가 뜨지 않는다. #234 전까지 예고 피해 기술이 없어 호출처는 0건이고
   여기서는 계약만 완결한다 — 앞으로 예고 기술을 붙이는 호출처는 반드시 tag 를 넘겨야 한다. */
function scheduleDelayed(f,delayRounds,run,tag){ f.pendingFx=f.pendingFx||[]; f.pendingFx.push({roundsLeft:delayRounds,tag:tag!==undefined?tag:null,run}); }
function tickDelayed(f){
  if(!f.pendingFx||!f.pendingFx.length) return;
  const keep=[];
  for(const ev of f.pendingFx){ ev.roundsLeft--;
    if(ev.roundsLeft<=0){ if(S.battle) ev.run(); }
    else keep.push(ev); } // #241: 해일 예고가 조건 표식(v2TideCheck)으로 바뀌어 atStart 분기를 삭제 — #233 예약 계약만 남는다(현재 호출처 0)
  f.pendingFx=keep;
}
function execSlot(side,slot,opts){
  const B=S.battle; if(!B) return;
  const f=side==="A"?B.fa:B.fd, opp=side==="A"?B.fd:B.fa, oSide=side==="A"?"D":"A";
  /* #146 계약 2.4 (Saturn REVISE P1) — **순수 기본 공격(-1)은 4슬롯 전투원에게 존재하지 않는다.**
     UI 는 그 버튼을 그리지 않지만 execSlot 은 여러 경로의 합류점이다: 레거시 'basic' 별칭, 사신의 낫 거부 폴백,
     늦은 콜백·수신 프레임, 테스트·콘솔의 직접 호출. 그 전부를 여기 한 곳에서 막는다.
     거부는 아무것도 바꾸지 않는다 — HP·상태·차례·난수 소비 0. 전투가 멈추지 않게 화면만 다시 그려
     지금 합법인 메뉴(합법 슬롯이 있으면 그 슬롯, 없으면 안내 + 수동 [턴 종료])로 되돌린다.
     왕·동료 본체와 구형 경로(f.skills 없음)의 기본 공격은 이 검사에 걸리지 않는다.
     #122 REVISE(2026-09-10 CJ QA 2) 예외 하나: **도망 실패 페널티 반격**만 opts.allowBasic 으로 이 가드를 통과한다.
     CJ 결정 = "이 경로에만 예외로 부활" — 평시 전투 UI 에는 4슬롯 전투원용 기본 공격 버튼을 만들지 않으므로
     #146 계약 2.4 의 취지(슬롯이 전부 불가하면 기본 공격이 아니라 수동 [턴 종료])는 그대로 남는다.
     이 예외는 사람이 고를 수 없는 자동 경로이고, 도망을 **시도한 쪽이 아니라 상대**가 때리는 한 번뿐이다. */
  if(slot<0&&f.skills&&!(opts&&opts.allowBasic)){ battleModal(); return; }
  const sk=(slot>=0&&f.skills)?SKILLS[f.skills[slot]]:null;
  const atkEl=atkElOf(f,sk); // #92 판정 속성: 공격기는 기술 속성, 기본 공격·시그니처(잔류장 포함)는 본체 속성 · #121 cls 기술은 null(중립)
  /* #121 계약 5.3 💀 사신의 낫 — 피해 파이프라인을 타지 않는 별도 분기다. **게이트를 여기서 최신 상태로 한 번 더 검사한다**:
     UI·AI·수신 프레임·늦은 콜백 어느 경로로 불법 슬롯이 들어와도 즉사가 새지 않는다.
     #146 계약 2.4: 불가할 때의 **기본 공격 폴백은 철회**됐다 — 4슬롯 전투원이면 아래 execSlot(-1) 가드가 잡아
     피해·행동·난수 없이 화면만 다시 그린다 (다른 슬롯이 합법이어도 기본 공격으로 대신하지 않는다).
     효과: 보호막을 무시하고 즉사. 별도 반동·VIP 면역 예외는 없고, 승패 연쇄(대리 패배 시 동료 동시 제거 · 왕 대리면 경기 패배)는
     기존 checkDeath → finishBattle 경로를 그대로 쓴다. 난수 소비 0. */
  if(sk&&sk.reaper){
    /* Saturn REVISE P1: 봉인 해제(reaperWhy)만으로는 부족하다 — **실제 쿨**과 **지금 이 side 의 행동 차례**까지 만족해야 한다.
       쿨 감소 수단으로 봉인이 풀리지 않는다는 계약(5.3)과 방향이 반대가 아니다: 봉인은 CD 와 별개의 **추가** 조건이고,
       CD 는 여느 기술과 똑같이 그대로 적용된다. actorOfPhase() 검사는 늦은 콜백·수신 프레임·옛 모달 클로저가
       상대 차례에 즉사를 내는 경로를 막는다. */
    /* Saturn P1(비공개): 거부 사유를 **공용 전투 로그(B.blog)에 쓰지 않는다.** blog 는 양측이 공유하는 상태라
       거기에 이름을 쓰면 **쓰지도 않은 미공개 기술**이 상대에게 공개된다. 사유는 소유자 화면의 토스트로만 알린다
       (표시 계층 · 규칙 상태·난수 불변). 거부된 호출은 순수 기본 공격으로 폴백해 전투가 멈추지 않는다. */
    const ownerOf=side==="A"?B.attP.owner:B.defP.owner;
    const tellOwner=msg=>{ try{ if(viewerIsOwner(ownerOf)) showToast(msg); }catch(e){} };
    if(f.cds[slot]>0){ tellOwner(`💀 사신의 낫은 쿨타임입니다 (남은 쿨 ${f.cds[slot]})`);
      execSlot(side,-1); return; }   // #146: 4슬롯 전투원이므로 위 -1 가드가 잡아 **아무 피해도 나가지 않고** 메뉴로 돌아간다
    if(actorOfPhase()!==side) return;                       // 남의 차례에는 아무것도 하지 않는다
    const why=reaperWhy(side);
    if(why){ tellOwner(`💀 사신의 낫은 아직 봉인되어 있습니다 — ${why}`);
      execSlot(side,-1); return; }   // 같은 이유로 무동작 — 다른 슬롯이 합법이어도 기본 공격으로 대신하지 않는다
    if(f.revealedSkills&&!f.revealedSkills.includes(slot)) f.revealedSkills.push(slot); // 사용 시 공개
    bmsg(`💀 ${fighterName(side)}의 사신의 낫!`,{sig:true},{key:"skillFx"});
    /* #234 REVISE 2차 CJ 결정(2026-09-17): 절대 판정 즉사 — 천년목·철벽 돌파·과부하 방벽·방어막(결과 경감)과
       환영 무도·수면 포자(행동 차단)를 모두 무시한다. v2PreUse·v2Endure·v2IncomingCap 을 부르지 않는다.
       사용 즉시 이 말에 전투를 넘는 봉인을 건다(다음 참전 전투 봉인) */
    f.reaperSeal=2;
    const lethal=opp.hp; instaKill(opp); addRec(side,lethal); // #233 (GDD-23 4.3): 즉사 — 단계 없음, 방어막 무시
    bmsg(`💀 ${fighterName(oSide)}는 보호막째 베였다 — 즉사!`,
      {shake:oSide,float:{side:oSide,html:`<span class="neg">즉사</span>`},hp:{side:oSide,val:0,max:opp.maxHp},st:stFx(oSide,opp)},{key:"damageFx"});
    if(checkDeath()) return;
    nextPhase(); return;
  }
  if(sk&&sk.v2){ execV2(side,slot,sk); return; } // #234 (GDD-23 6장): 하수인 30종·전설·왕·동료 스킬 실행기
  if(sk){ f.cds[slot]=sk.cd;
    if(f.revealedSkills&&!f.revealedSkills.includes(slot)) f.revealedSkills.push(slot); } // 기술 공개: 사용 시 이름 공개
  const gate=(force,prob)=>{ // 상태 부여 — 기존 D10 경로 재사용 (효과기: 화상·약화 statusProb 70% · 감전 shockProb 50% (#96) · 잔류장 100% — force는 rand 미소비)
    // #233 (GDD-23 3.2 💫): 스탯 상태이상 부여 확률을 %p로 가산, 상한 100% (force 경로는 확률 판정 자체가 없으므로 영향 없음)
    const p=Math.min(1,(prob===undefined?BAL.statusProb:prob)+(f.statusPct||0));
    if(force||rand()<p){S.metrics.statusApplied++; return true;}
    S.metrics.statusFailed++; bmsg("상태이상 부여 실패!"); return false;
  };
  const applyStatus=force=>{ // 상태 종류는 판정 속성(atkEl) 기준 — 불 본체가 배운 감전 침은 감전이지 화상이 아니다 (#92)
    /* GDD-23 5.6 중첩·재부여: 같은 종류는 1개만 존재하되, 이미 걸려 있어도 **재부여 자체를 막지 않고**
       수치는 큰 값·남은 지속은 긴 값으로 갱신한다(더하지 않는다). 종전의 !opp.burn 같은 가드는 남은 1R 화상을
       2R 로 갱신하는 경로를 통째로 막아 그 규칙을 깨고 있었다(PD 코드 검토 지적). 확률 판정은 그대로 한다. */
    if(atkEl==="fire"&&gate(force)){const had=opp.burn>0; applyTimedFx(opp,"burn",BAL.burnRounds); opp.burnBy=side;
      bmsg(`🔥 ${fighterName(oSide)}는 화상을 입었다!${had?" (갱신)":""} (${opp.burn}R)`,{st:stFx(oSide,opp)});}
    else if(atkEl==="water"&&gate(force)){const had=opp.weaken>0; opp.weaken=Math.max(opp.weaken||0,BAL.weakenHits); // 약화만 횟수제(5.6) — 라운드 가드 없이 큰 횟수로 갱신
      bmsg(`💧 ${fighterName(oSide)}는 약화되었다!${had?" (갱신)":""} (${opp.weaken}회)`,{st:stFx(oSide,opp)});}
    else if(atkEl==="lightning"&&gate(force,BAL.shockProb)){applyTimedFx(opp,"shock",1); bmsg(`⚡ ${fighterName(oSide)}는 감전 — 다음 ${opp.shock}라운드 후공!`,{st:stFx(oSide,opp)});}
  };
  const coolReduce=(filter,label)=>{ // 쿨 감소류: 조건 내 남은 쿨 최장 기술 1개 쿨 -1
    let pick=-1;
    for(let i=0;i<f.skills.length;i++) if(f.cds[i]>0&&filter(i)&&(pick<0||f.cds[i]>f.cds[pick])) pick=i;
    if(pick<0){ if(label) bmsg(`${label} — 단축할 쿨이 없다.`); return; }
    f.cds[pick]--; bmsg(`🔄 ${SKILLS[f.skills[pick]].ko} 쿨 -1 (남은 쿨 ${f.cds[pick]})`);
  };
  const supFlash=sk&&!sk.pow?(sk.healPct?"heal":(sk.shieldPct||sk.dmgCut)?"guard":"buff"):null; // S3-A 보조 3계열
  bmsg(`${fighterName(side)}의 ${sk?sk.ko:"기본 공격"}!`,(sk&&sk.kind==="sig")?{sig:true,flash:supFlash}:(supFlash?{flash:supFlash}:null),{key:"skillFx"}); // #106 5.4 그룹1 기술 연출
  if(sk&&!sk.pow){ // 비피해 기술: 보조기·불굴 진형 — 첫 효과 메시지가 그룹2(효과 연출 damageFx)를 열고 나머지는 같은 그룹에 덧붙는다
    let effKey="damageFx"; const eb=(t,fx)=>{ bmsg(t,fx,effKey?{key:effKey}:null); effKey=null; };
    if(sk.healPct){const h=Math.round(f.maxHp*sk.healPct); f.hp=Math.min(f.maxHp,f.hp+h);
      eb(`💚 HP ${h} 회복!`,{float:{side,html:`<span class="pos">+${h}</span>`},hp:{side,val:f.hp,max:f.maxHp}});}
    /* #130 (v0.4.7 CJ 2026-09-10): 보호막은 **남은 보호막 + 이번 기술의 기존 부여량**으로 합산한다 (종전 최대값 갱신 폐기).
       같은 기술이든 다른 기술이든, 공격 부가든 레거시 경로든 같은 규칙이다. 새 수치·상한·지속 시간은 추가하지 않는다.
       예: 최대 HP 100 에서 18 → 22 를 이어 쓰면 40. 10 을 소모한 뒤 22 를 더 받으면 30+22=52.
       누적이 최대 HP 를 넘어도 수치는 손실 없이 그대로 남는다 (막대 폭만 100% 에서 멈춘다). */
    if(sk.shieldPct){shieldAdd(f,Math.round(f.maxHp*sk.shieldPct),"supportSkill");
      eb(`🛡 보호막 ${f.shield}!`,{st:stFx(side,f)});}
    if(sk.dmgCut){f.dmgCut=Math.max(f.dmgCut,sk.dmgCut);
      eb(`🌀 다음 피격 ${pct(sk.dmgCut)} 감소!`,{st:stFx(side,f)});}
    if(sk.focus){f.focusCharge=true; eb(`🎯 집중 — 다음 공격기 위력 +20%!`,{st:stFx(side,f)});}
    if(sk.coolAny) coolReduce(i=>i!==slot,"냉각"); // 냉각 결과 줄은 기술 그룹에 덧붙는다 (메시지 수 불변)
    if(sk.cleanse){
      if(f.burn){f.burn=0;f.burnFresh=false;f.burnBy=null;eb(`✨ 화상이 정화되었다!`,{st:stFx(side,f)});}
      else if(f.weaken){f.weaken=0;eb(`✨ 약화가 정화되었다!`,{st:stFx(side,f)});}
      else if(f.shock){f.shock=0;f.shockFresh=false;eb(`✨ 감전이 정화되었다!`,{st:stFx(side,f)});}
      else if(f.crack){f.crack=0;f.crackFresh=false;eb(`✨ 균열이 정화되었다!`,{st:stFx(side,f)});} // #233 (GDD-23 4.5): 균열도 상태이상 분류 — 경화·방어막 같은 버프는 정화 대상이 아니다
      else eb(`정화 — 제거할 상태이상이 없다.`);
    }
  } else { // 피해 기술: 공격기·시그니처·기본 공격 — #233 (GDD-23 4.2) 공용 파이프라인(resolveHit)을 탄다
    let extraDmgUp=0;
    if(f.focusCharge&&sk&&sk.kind==="attack"){extraDmgUp=0.2; f.focusCharge=false;
      bmsg(`🎯 집중 발동 — 위력 +20%!`,{st:stFx(side,f)});}
    const base=sk?slotPowRaw(f,sk):f.atk; // ⑪ 단일 반올림 — 여기서 반올림하지 않고 resolveHit 에 소수를 그대로 넘긴다
    /* #121 계약 5.1 드래곤 숨결: 상성표가 아니라 기술 고유 배율(④를 대체) — 속성이 있는 상대에게만 적용, 무속성 중립 1.0.
       cls 기술이라 atkEl 은 null 이므로 resolveHit 안에서 일반 상성 블록은 타지 않는다(난수 소비 0). */
    if(sk&&sk.dragonMult&&opp.element) bmsg(`🐉 용의 숨결이 속성을 태운다 — ×${sk.dragonMult}!`);
    let flatBonus=0;
    if(sk&&sk.bonusVsShield&&opp.shield>0){flatBonus+=sk.bonusVsShield; bmsg(`🌊 보호막 대상 추가 위력 +${sk.bonusVsShield}!`);}
    /* #233 (GDD-23 4.5): 균열도 **상태이상** 분류다 — 경화·흡수·방어막같은 버프는 여기 해당 없다. */
    if(sk&&sk.bonusVsStatus&&(opp.burn||opp.weaken||opp.shock||opp.crack)){flatBonus+=sk.bonusVsStatus; bmsg(`⚡ 상태이상 대상 추가 위력 +${sk.bonusVsStatus}!`);}
    /* #234 (GDD-23 6.1): 도망 실패 페널티 기본 공격만 **스킬 밖 예외** — 상대 공격력 100%·피해 계산 순서는 따르되
       스킬 효과(확정 치명 등 1회성 효과 소모 포함)·⌛·시너지 판정이 없다. v2 실행기를 타지 않으므로 반사·반격·흡수도 없다. */
    const res=resolveHit(side,f,opp,oSide,base,flatBonus,atkEl,(sk&&sk.dragonMult)?sk.dragonMult:null,extraDmgUp,{penalty:slot<0&&!!(opts&&opts.allowBasic)});
    const actual=res.actual;
    if(sk&&!res.evaded){
      if(sk.drainPct&&actual>0){const gh=Math.round(actual*sk.drainPct); f.hp=Math.min(f.maxHp,f.hp+gh);
        bmsg(`🌿 흡수 — HP ${gh} 회복!`,{float:{side,html:`<span class="pos">+${gh}</span>`},hp:{side,val:f.hp,max:f.maxHp}});}
      if(sk.witch) witchApply(side,oSide,f,opp,actual); // #121 계약 5.2 — 피해 확정 뒤(실HP 피해 actual 기준) 2효과를 100% 적용
      if(sk.status) applyStatus(false);
      if(sk.statusSelf&&f.element!=="grass") applyStatus(true); // 잔류장: 자기 속성 상태효과 100% — 풀은 아래 자기 대상 분기에서 처리
    }
    if(sk){ // 자기 대상 효과 — 회피 여부와 무관하게 유지(4.2 ① 주석)
      if(sk.selfShieldPct){shieldAdd(f,Math.round(f.maxHp*sk.selfShieldPct),"selfSkill"); // #130: 공격 부가 보호막도 합산
        bmsg(`🌿 보호막 ${f.shield}!`,{st:stFx(side,f)});}
      if(sk.statusSelf&&f.element==="grass"){ // 잔류장: 대응 상태이상 부재로 흡수 회복(실피해 40%) 임시 대체 [기획 필요]
        const gh=Math.round(actual*0.4); if(gh>0){f.hp=Math.min(f.maxHp,f.hp+gh);
          bmsg(`🌿 잔류 흡수 — HP ${gh} 회복!`,{float:{side,html:`<span class="pos">+${gh}</span>`},hp:{side,val:f.hp,max:f.maxHp}});}}
      if(sk.selfVuln){f.vulnMark=true; bmsg(`⚠️ ${fighterName(side)}의 자세가 무너졌다 — 다음 피격 +15%!`,{st:stFx(side,f)});}
      if(sk.coolAttack) coolReduce(i=>i!==slot&&SKILLS[f.skills[i]].kind==="attack",null); // 전술 연계
      if(sk.coolAttackLongest) coolReduce(i=>SKILLS[f.skills[i]].kind==="attack",null);   // 급속 순환
    }
  }
  if(checkDeath()) return;
  nextPhase();
}
function sideName(s){return s==="A"?"공격측":"방어측";}
function dmgRange(v){if(typeof v!=="number"||!isFinite(v)) return "?"; return BAL.dmgVar?Math.round(v*(1-BAL.dmgVar))+"~"+Math.round(v*(1+BAL.dmgVar)):v;} // T7: 분산 반영 표기
/* T5-B 아키타입별 스킬 파라미터: 지속형 강화(화상3R·약화3회·풀15%/15%·감전2R), 풀 속공 변형(회복 8%·보호막 없음) */
function archOf(f){const rd=f.rosterId?ROSTER.find(r=>r.id===f.rosterId):null; return rd?rd.arch:legendArchOf(f);}
function skillParamsOf(f){
  const a=archOf(f);
  return {
    burnRounds:a==="sustain"?3:BAL.burnRounds,
    weakenHits:a==="sustain"?3:BAL.weakenHits,
    shockRounds:a==="sustain"?2:1,
    shieldPct:(f.element==="grass"&&a==="swift")?0:BAL.shieldPct,
    healPct:a==="sustain"?0.15:(f.element==="grass"&&a==="swift")?0.08:BAL.healPct,
    grassDmgMult:(f.element==="grass"&&a==="swift")?1:0.6
  };
}
const ELEM_EMO={fire:"🔥",water:"💧",grass:"🌿",lightning:"⚡",land:"🗻"};
function fighterName(sid){
  const B=S.battle, pf=sid==="A"?B.fa:B.fd, piece=sid==="A"?B.attP:B.defP;
  return pf===piece?(piece.type==="minion"&&piece.name?piece.name:TYPE_KO[piece.type]):"포획 하수인·"+ELEM_KO[pf.element];
}
function stIcons(f){
  return [f.shield?`🛡${f.shield}`:"",f.burn?`🔥화상${f.burn}R`:"",f.weaken?`💧약화${f.weaken}회`:"",f.shock?`⚡감전${f.shock}R`:"",
    f.crack?`🗻균열${f.crack}R`:"",f.harden?`🛡경화${pct(f.hardenPct)}·${f.harden}R`:"",
    f.evadeDownR>0?`💨회피−${Math.round((f.evadeDown||0)*100)}%p·${f.evadeDownR}R`:"",f.tideMark>0?`🌊해일≤${f.tideMark}${f.tideHeld?"(보류)":""}`:"", // #241 V1 회피율 감소 · R2 해일 예고 표식(양쪽 화면)
    f.dmgCut?`🌀감쇠${pct(f.dmgCut)}`:"",f.focusCharge?"🎯집중":"",f.vulnMark?"⚠️피격+15%":""].filter(Boolean).join(" ")||"-";
}
/* 전투 메시지 시퀀스 — 로직은 동기 완결, 표시 계층만 타이머 재생 (헤드리스: 큐만 적재 후 즉시 소진) */
/* #106 5.4: opts.key 가 있는 메시지는 새 표시 그룹을 연다(그룹 시간 = BAL.fx[key] — skillFx·damageFx·itemFx·captureFx·fleeFx·judgeBanner·roundEndFx).
   key 없는 메시지는 직전 그룹에 줄로 덧붙는다(쿨 감소·상태 부여·약화 해제 등). 재생 시작 시점에 그룹이 없으면 msgStep(0.6초) 단독 그룹. opts.big: 큰 글씨 */
function bmsg(txt,fx,opts){const B=S.battle; if(!B) return; B.blog.push(txt); B.msgQ.push({txt,fx:fx||null,key:opts&&opts.key||null,big:!!(opts&&opts.big)});}
let MSGQ=[], MSGPLAYING=false, MSGAFTER=null;
function liveBattleDom(){ // 실제 DOM에 msgBox가 있을 때만 재생 (sim·헤드리스 스텁 제외)
  try{const mb=$("msgBox"); return S.mode!=="sim"&&!!mb&&mb.nodeType===1;}catch(e){return false;}
}
function playMsgs(q,after){ // 그룹 단위 순차 재생 (계약 5.4) — 재생 불가 환경은 즉시 완료. 재생 중은 fxLocked() (입력 잠금·수신 보류)
  MSGQ.push(...q); MSGAFTER=after||null;
  if(MSGPLAYING) return;
  if(!liveBattleDom()){ MSGQ.length=0; const fn=MSGAFTER; MSGAFTER=null; if(fn)fn(); return; }
  MSGPLAYING=true; fxSetLockClass(true);
  const gen=FX.gen;
  (function step(){
    if(FX.gen!==gen) return; // 새 게임 — 옛 세대의 step 은 아무것도 만지지 않는다: MSGQ·MSGPLAYING·MSGAFTER 는 fxReleaseAll 이 이미 비웠고 그 뒤 새 게임의 재생이 소유한다 (REVISE msg_d847280b3dba)
    const m=MSGQ.shift();
    if(!m){ MSGPLAYING=false; if(!FX.cur&&!FX.q.length) fxSetLockClass(false); const fn=MSGAFTER; MSGAFTER=null; if(fn)fn(); fxIdle(); return; }
    const lines=[m.txt]; applyFx(m.fx);
    while(MSGQ.length&&!MSGQ[0].key){ const n=MSGQ.shift(); lines.push(n.txt); applyFx(n.fx); } // 같은 그룹의 후속 줄 즉시 병합
    try{ const mb=$("msgBox"); if(mb){ mb.innerHTML=lines.join("<br>"); if(mb.classList){ if(m.big) mb.classList.add("big"); else mb.classList.remove("big"); } } }catch(e){}
    const ms=m.key?fxMs(m.key):(fxLive()?BAL.fx.msgStep:0);
    setTimeout(step,ms>0?ms:600);
  })();
}
/* #106 5.5 HP 바 지연 표시 토큰 (side 별 일련번호) — 표시 계층 전용, 규칙 상태(S)·난수와 무관.
   한 피해 이벤트가 방어막과 HP 를 모두 줄이면 방어막 바만 즉시 줄이고(CSS 전환 .35s) HP 바·숫자는 BAL.fx.barStep 뒤에 쓴다 → 화면에서 방어막 흡수가 먼저 보이고 HP 가 그 다음 줄어든다.
   두 전환(0.35s + 0.35s = 700ms)은 damageFx(#125 1200ms) 안에서 여유 500ms 를 남기고 끝난다. 표시값 dispHp 는 종전처럼 즉시 갱신하므로 재렌더는 항상 최신 값을 그린다.
   지연 콜백은 게임 세대(FX.gen)·같은 전투 객체·같은 HP 바 DOM 노드·같은 side 일련번호가 모두 일치할 때만 쓴다 — 옛 게임·닫힌 전투·다시 그려진 모달·뒤따른 HP 갱신을 덮어쓰지 않는다.
   헤드리스·sim(fxLive() false)은 barStep 0 → 종전처럼 동기 즉시 쓰기 (REVISE msg_d847280b3dba 2번: setter 순서가 아니라 실제 시간 단계로 분리) */
const HPSTAGE={A:0,D:0};
function applyFx(fx){ // CSS 이펙트(흔들림·속성 플래시·피해 팝·HP바·방어막 바·상태 아이콘) — 실패는 조용히 무시
  if(!fx) return;
  try{
    const B=S?S.battle:null;
    let stage=0; // 5.5: 같은 side 의 방어막·HP 가 이번 이벤트로 함께 줄 때만 HP 표시를 barStep 만큼 늦춘다 (회복·방어막만 감소·HP 만 감소는 즉시)
    if(fx.st&&fx.st.max&&fx.hp&&fx.hp.side===fx.st.side&&B){
      const side=fx.st.side, prevSh=B["dispSh"+side]!==undefined?B["dispSh"+side]:0, prevHp=B["dispHp"+side];
      if(prevSh>(fx.st.shield||0)&&prevHp!==undefined&&prevHp>fx.hp.val) stage=fxMs("barStep"); }
    if(fx.st){ const s=$("bst-"+fx.st.side); if(s) s.textContent=fx.st.text;
      if(fx.st.max){ if(B) B["dispSh"+fx.st.side]=fx.st.shield||0; // #106 5.5 방어막 바 — 항상 즉시 (흡수가 먼저 줄고 HP 는 barStep 뒤)
        const sb=$("shfill-"+fx.st.side); if(sb) sb.style.width=Math.max(0,Math.min(100,(fx.st.shield||0)/fx.st.max*100))+"%"; } }
    if(fx.hp){ const side=fx.hp.side; if(B) B["dispHp"+side]=fx.hp.val;
      const seq=++HPSTAGE[side], bar=$("hpfill-"+side), t=$("hptxt-"+side); // 새 HP 갱신은 같은 side 의 대기 중인 지연 쓰기를 무효화한다 (최신 값이 이긴다)
      const write=()=>{ if(bar) bar.style.width=Math.max(0,fx.hp.val/fx.hp.max*100)+"%"; if(t) t.textContent=fx.hp.val; };
      if(stage>0){ const gen=FX.gen;
        setTimeout(()=>{ if(FX.gen!==gen||!S||S.battle!==B||HPSTAGE[side]!==seq) return; // 옛 게임·끝난 전투·뒤따른 갱신 → 무효
          if($("hpfill-"+side)!==bar) return; // 모달이 다시 그려져 노드가 바뀌었다 — 재렌더가 dispHp 로 이미 최신 값을 그렸다
          try{ write(); }catch(e){} },stage); }
      else write(); }
    if(fx.shake){ const t=$("tok-"+fx.shake); if(t){t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake");} }
    if(fx.flash){ const st=$("bstage"); if(st){st.style.boxShadow=`inset 0 0 70px var(--${fx.flash})`;
      setTimeout(()=>{try{st.style.boxShadow="";}catch(e){}},380);} }
    if(fx.sig){ const st=$("bstage"); if(st&&st.classList){st.classList.remove("sigblink"); void st.offsetWidth; st.classList.add("sigblink");
      setTimeout(()=>{try{st.classList.remove("sigblink");}catch(e){}},750);} } // 시그니처 전용 강조 (테두리 점멸)
    if(fx.float){ const t=$("tok-"+fx.float.side); if(t&&t.appendChild){const d=document.createElement("div");
      d.className="dmgfloat"; d.innerHTML=fx.float.html; t.appendChild(d);
      setTimeout(()=>{if(d.parentNode)d.parentNode.removeChild(d);},1100);} }
    if(fx.ko){ const t=$("tok-"+fx.ko); if(t) t.classList.add("ko"); }
  }catch(e){}
}
function addRec(side,amount){
  const B=S.battle;
  if(side==="A") B.recA=Math.min(B.fd.maxHp,B.recA+amount);
  else B.recD=Math.min(B.fa.maxHp,B.recD+amount);
}
function nextPhase(){
  const B=S.battle;
  /* #146 Saturn REVISE P1: 전투 행동 하나가 끝나고 차례가 넘어가는 **유일한 지점**이다.
     여기서 공유 토큰을 올려 두면 그 이전 렌더가 낸 도망·패스 콜백은 어떤 행동(일반 공격·포획 실패 포함)을
     거쳤든 전부 무효가 된다. 표시 계층이 아니라 게임 상태이므로 온라인 양측이 같은 값을 갖는다. */
  B.actSeq=(B.actSeq||0)+1;
  if(B.bonus) v2BonusEnd(B); // #241 R1 번개 꼬리 추가 공격이 끝났다(= 번개 여우의 턴 끝) — 2·3차 ⌛ 복원 (L8)
  if(v2TideCheck()) return;  // #241 R2 매 행동 뒤 해일 예고 판정
  if(B.phase===0){B.phase=1; battleModal(); return;}
  for(const [f,side] of [[B.fa,"A"],[B.fd,"D"]]){
    /* #233 (GDD-23 4.7·5.6, 2026-09-16 PD 결정): 화상은 **부여된 라운드를 세지 않는다** —
       "화상은 부여된 라운드를 세지 않으므로 다음 2개 라운드의 종료 시에 각 5"(4.7).
       감전·균열·경화의 fresh 가드와 달리 화상은 라운드 종료에 **피해도** 준다. 그래서 가드가
       부여 라운드의 **피해와 감소를 둘 다** 건너뛰어야 R2·R3 종료 2회가 된다 — 감소에만 걸면
       R1·R2·R3 3회가 되어 총량이 늘어난다. 재부여 시에도 감전처럼 가드를 다시 세운다. */
    if(f.burnFresh){ f.burnFresh=false; }
    else if(f.burn>0){let d=Math.min(f.hp,Math.round(f.maxHp*(f.burnMag||BAL.burnPct))); d=v2Endure(f,d); f.hp-=d; f.burn--; if(!f.burn){f.burnMag=0;f.burnNoCure=false;} // #234: 화상 수치(왕국 값·#241 잿불 심기 8% 갱신) · 천년목
      addRec(f.burnBy,d);
      bmsg(`🔥 ${fighterName(side)}는 화상 피해 ${d}!`,{shake:side,float:{side,html:`<span class="neg">-${d}</span>`},hp:{side,val:f.hp,max:f.maxHp},st:stFx(side,f)},{key:"roundEndFx"}); // #106 5.4 라운드 종료 처리 그룹(1초)
      if(!f.burn) bmsg(`🔥 ${fighterName(side)}의 화상이 해제되었다.`,{st:stFx(side,f)});
      if(checkDeath()) return;}
    if(v2RoundEnd(f,side)) return; // #234 이끼 잠식·나이테·포자 막 (라운드 종료 효과)
    /* 슬롯별 개별 쿨 감소 (라운드 종료 시). #241 Q3 [CJ 승인]: 이번 라운드에 ⌛0 에서 ⌛ 증가로 +1 된 슬롯은 그 +1 을 이번 감소에서 제외(1 아래로 내리지 않음) */
    if(f.cd>0)f.cd--; if(f.skills)for(let i=0;i<f.skills.length;i++)if(f.cds[i]>0){ f.cds[i]=(f.cdUpFresh&&f.cdUpFresh[i])?Math.max(1,f.cds[i]-1):f.cds[i]-1; }
    f.cdUpFresh=[];
    if(f.shockFresh) f.shockFresh=false; // 감전은 부여 라운드가 아닌 다음 라운드부터 소진
    else if(f.shock>0){f.shock--; if(!f.shock) bmsg(`⚡ ${fighterName(side)}의 감전이 풀렸다.`,{st:stFx(side,f)});}
    /* #233 (GDD-23 4.5): 균열(받는 피해 +10%, 2R)·경화(자신이 받는 피해 −X%, 표기된 지속) 라운드 종료 감소.
       #234 전까지 이 둘을 실제로 거는 기술이 없어 값은 항상 0이지만, 엔진 계약(4.5)은 여기서 완결한다. */
    /* GDD-23 5.6 적용·지속: "N 라운드" 지속은 **부여된 라운드를 세지 않고** 다음 라운드부터 N라운드가
       끝날 때 해제된다(현행 감전과 같은 방식). 그래서 감전의 shockFresh 와 같은 가드를 둔다 —
       이것이 없으면 부여한 라운드 종료에 바로 1이 줄어 2R 효과가 실질 1.5R 로 짧아진다. */
    if(f.crackFresh) f.crackFresh=false;
    else if(f.crack>0){f.crack--; if(!f.crack) bmsg(`🗻 ${fighterName(side)}의 균열이 풀렸다.`,{st:stFx(side,f)});}
    if(f.hardenFresh) f.hardenFresh=false;
    else if(f.harden>0){f.harden--; if(!f.harden){f.hardenPct=0; bmsg(`${fighterName(side)}의 경화가 풀렸다.`,{st:stFx(side,f)});}}
    /* 4.5 회피 증가·가하는 피해 증가도 "표기된 값 · 지속"이라 같은 라운드 종료 감쇠를 탄다. */
    if(f.evadeBuffRFresh) f.evadeBuffRFresh=false;
    else if(f.evadeBuffR>0){f.evadeBuffR--; if(!f.evadeBuffR){f.evadeBuff=0; bmsg(`💨 ${fighterName(side)}의 회피 증가가 풀렸다.`,{st:stFx(side,f)});}}
    if(f.dmgUpBuffRFresh) f.dmgUpBuffRFresh=false;
    else if(f.dmgUpBuffR>0){f.dmgUpBuffR--; if(!f.dmgUpBuffR){f.dmgUpBuff=0; bmsg(`💪 ${fighterName(side)}의 가하는 피해 증가가 풀렸다.`,{st:stFx(side,f)});}}
    v2RoundDecay(f); // #234 스킬 지속 효과 — 부여 라운드는 세지 않는다(5.6)
    tickDelayed(f); // #233 (GDD-23 4.3) 예고·지연 피해 — 라운드 종료마다 카운트, 발동 시 전투가 살아 있을 때만 실행
    if(S.battle!==B) return; // tickDelayed가 발동시킨 피해로 전투가 끝났으면 여기서 멈춘다(checkDeath는 run() 안에서 이미 처리)
  }
  if(v2TideCheck()) return; // #241 R2 라운드 종료 처리 뒤(= 천년목 · 철벽 · 과부하 만료 직후) 해일 예고 판정
  B.itemRoundA=false; B.itemRoundD=false;
  B.ballThrowA=false; B.ballThrowD=false; // #12: 볼 투척 라운드당 1회 리셋
  B.round++;
  if(B.round>battleMaxRounds()){judge(); return;} // #121 계약 3.3: 시간의 수호자가 걸린 전투는 3라운드 (전역 BAL.maxRounds 불변)
  B.phase=0; B.firstSide=decideFirstSide(B); battleModal(); // #241: 라운드 시작 훅(영구 자기장 재부여·해일 atStart) 삭제 // #233 (GDD-23 4.4): "라운드 시작 시 확정" — 이 라운드의 선턴을 여기서 한 번만 고정한다
}
function checkDeath(){
  const B=S.battle;
  if(B.fd.hp<=0){finishBattle("A","즉사"); return true;}
  if(B.fa.hp<=0){finishBattle("D","즉사"); return true;}
  return false;
}
/* #106 T6 (H1, CJ 최종): 최종 라운드 종료 판정은 남은 HP 비율(현재 HP ÷ 최대 HP)이 높은 쪽 승, 동률은 방어자 승. 방어막은 HP 가 아니므로 미포함.
   #121 계약 3.3: 시간의 수호자로 3라운드가 된 전투도 **같은 판정**을 쓴다 (라운드 수만 다르고 규칙은 동일).
   누적 유효 피해(recA/recD)는 판정에 쓰지 않고 지표로만 계속 기록한다 (GDD-13 4.6 "누적 유효 피해" 대체) */
function judge(){
  const B=S.battle; S.metrics.judged++;
  const ra=B.fa.hp/B.fa.maxHp, rd=B.fd.hp/B.fd.maxHp;
  bmsg("⚖️ 남은 HP 비율로 판별합니다!",null,{key:"judgeBanner",big:true});
  bmsg(`${fighterName("A")} ${pct(ra)} vs ${fighterName("D")} ${pct(rd)}`);
  if(ra>rd) finishBattle("A",`판정 ${pct(ra)} vs ${pct(rd)}`);
  else if(rd>ra) finishBattle("D",`판정 ${pct(rd)} vs ${pct(ra)}`);
  else {S.metrics.ties++; finishBattle("D",`동률 ${pct(ra)} — 방어자 승`);}
}
function finishBattle(winSide,how){
  const B=S.battle;
  const winP=winSide==="A"?B.attP:B.defP, loseP=winSide==="A"?B.defP:B.attP;
  const loseF=winSide==="A"?B.fd:B.fa, loseSide=winSide==="A"?"D":"A";
  if(winSide==="A")S.metrics.attackerWins++; else S.metrics.defenderWins++;
  bmsg(`${fighterName(loseSide)}는(은) 쓰러졌다!`,{ko:loseSide,shake:loseSide,hp:{side:loseSide,val:Math.max(0,loseF.hp),max:loseF.maxHp}},{key:"damageFx"}); // #106: KO 연출 그룹
  bmsg(`${how} — ${pname(winP.owner)} 승!`);
  let msg;
  if(loseF===loseP){ loseP.alive=false; msg=`${TYPE_KO[loseP.type]} 패배(${how}) — 제거`; }
  else { loseP.cap=null; loseP.alive=false;
    msg=`포획 하수인 패배(${how}) — ${TYPE_KO[loseP.type]} 동시 ${loseP.type==="king"?"패배":"제거"}`; }
  if(loseP.type==="ally"){ syncOwnerLeaders(loseP.owner); } // #234 (5.3): 동료 사망 → 살아 있는 왕·동료에 🪄 칸 추가
  addLog(`⚔️ 전투 종료: ${pname(winP.owner)} 승 — ${msg}`,"imp");
  showToast(`⚔️ 전투 종료: ${pname(winP.owner)} 승 — ${msg}`);
  resetAfter(B.fa); resetAfter(B.fd);
  const attacker=B.attP;
  const q=B.msgQ.splice(0);
  S.battle=null;
  /* #126: 이 전투가 곧 경기 종료인지 **먼저** 확정하고 배너를 하나만 고른다 (전투 결과 + 경기 결과 직렬 중복 금지).
     ENDING_BATTLE 동안에는 gameOver 가 스스로 연출을 내지 않으므로, 아래에서 고른 배너 하나만 남은 메시지 뒤에 붙는다. */
  let ended=false;
  ENDING_BATTLE=true;
  try{
    if(loseP.type==="king"){ gameOver(winP.owner,"king");
      const gmsg=`🏁 경기 종료 — ${pname(winP.owner)} 승리!`; addLog(gmsg,"imp"); showToast(gmsg); ended=true; }
    else if(checkWipe()) ended=true; // T4: 전투 제거(대리 동시 제거 포함) 후 전멸 판정
  } finally{ ENDING_BATTLE=false; }
  // #106 5.6 연출: 남은 메시지 재생 → 결과 배너(전투 = 뷰어 기준 "전투에서 승리!/패배,,," · 경기 종료 = 경기 결과) → 닫힘 — 헤드리스·sim은 즉시 닫힘
  battleEndFx(q,(ended?matchEndBanner():null)||resultBannerOf(winP),()=>{ if(!S.battle) close(); });
  if(ended){ render(); return; }
  afterBattle(attacker, winSide==="A"&&attacker.alive);
  render();
}
/* 전투 종료 공통 정리 — finishBattle(승패·판정) · __fleeCore(도망 성공) · finishByCapture(적 포획) 세 경로가 모두 이 함수를 부른다.
   #121 계약 3.1: 버프 플래그(powerBuff·fleeBoost)도 여기서 지운다. 본체 출전이면 f === 말 객체라 지우지 않으면 다음 전투로 새어 나간다.
   전투 인스턴스 회계(B.buffA/B.buffD·B.maxRounds)는 S.battle 이 null 이 되면서 함께 사라지고, 쓰지 않은 패키지 재고(S.pkgs)는 보존된다. */
function resetAfter(f){resetV2(f); f.burn=0;f.burnFresh=false;f.burnBy=null;f.weaken=0;f.shield=0;f.shieldLayers=[];f.absorbed=0;f.shock=0;f.shockFresh=false;f.focusCharge=false;f.vulnMark=false;f.dmgCut=0;f.atkBuff=false;
  f.crack=0;f.crackFresh=false;f.harden=0;f.hardenFresh=false;f.hardenPct=0;f.evadeBuff=0;f.evadeBuffR=0;f.evadeBuffRFresh=false;f.dmgUpBuff=0;f.dmgUpBuffR=0;f.dmgUpBuffRFresh=false;f.critForce=false;f.dodgeForce=false;f.pendingFx=[];
  f.cd=0; // #233 (GDD-23 4.6): 전투 사이 HP만 유지 — 쿨타임(레거시 스칼라 포함)·예고 효과는 다음 전투 전에 초기화
  f.powerBuff=false;f.fleeBoost=false;}
/* #12 포획 종료: 적 하수인 즉시 제거 + S.reserve 저장 — 누적 판정 없이 전투 즉시 종료 (포획으로 승리) */
function finishByCapture(side){
  const B=S.battle;
  const winP=side==="A"?B.attP:B.defP, loseP=side==="A"?B.defP:B.attP, loseSide=side==="A"?"D":"A";
  const p=winP.owner, cb=BAL.captured;
  const el=loseP.element||shuffle(ELEMS.slice())[0], arch=archOf(loseP)||"std";
  const rd=loseP.rosterId?ROSTER.find(r=>r.id===loseP.rosterId):null; // #91 원래 종 외형 정체 보존(표시 전용 artRosterId) — 로스터 정체가 없던 하수인은 null (임의 종으로 가장하지 않는다)
  S.reserve[p]={element:el,hp:BAL.enemyCapHp,maxHp:cb.hp,atk:cb.atk,skillAtk:cb.skill,cd:0,cdMax:cb.cd, // #20: 전투 중 적 포획만 HP 70/maxHP 100
    skills:loseP.skills?loseP.skills.slice():(speciesSkills(loseP.rosterId,1)||archSkills(ARCH_TMPL[arch]?arch:"std",el)),cds:null,revealedSkills:[],artRosterId:rd?rd.id:null, // #92 (GDD-13 4.8): 대상의 현재 장착 기술 4슬롯을 복사 승계(탐색 교체 기술 포함, 참조 비공유) · 기술 배열이 없는 레거시 대상만 아키타입 템플릿 폴백 · 쿨 0·공개 기록 []·수치는 공용 규격
    /* #233 (GDD-23 3.3): 예비 하수인도 승계한 아키타입의 def·spd·dodge·crit·statusPct 를 받는다(공용 HP·ATK 규격은 그대로) */
    def:ARCHETYPE_BASE[arch].def, spd:ARCHETYPE_BASE[arch].spd, dodge:ARCHETYPE_BASE[arch].dodge,
    crit:ARCHETYPE_BASE[arch].crit, statusPct:ARCHETYPE_BASE[arch].statusPct, shieldStartPct:0, grade:1};
  S.reserve[p].cds=S.reserve[p].skills.map(()=>0); // #234: 슬롯 수는 승계한 스킬 수(등급)만큼
  met(p,"enemyCaptures");
  loseP.alive=false;
  bmsg(`🔴 몬스터볼 적중! ${fighterName(loseSide)}를(을) 포획했다!`,{ko:loseSide},{key:"captureFx"}); // #106 5.4 성공 연출
  addLog(`🔴 포획 종료: ${pname(p)}가 적 하수인을 포획 — 전투 즉시 종료 (예비 하수인 HP ${BAL.enemyCapHp}/${cb.hp})`,"imp");
  showToast(`🔴 포획 종료 — 적 하수인 포획! (예비 HP ${BAL.enemyCapHp}/${cb.hp})`);
  resetAfter(B.fa); resetAfter(B.fd);
  const attacker=B.attP;
  const q=B.msgQ.splice(0);
  S.battle=null;
  /* #126: 포획도 같은 규칙이다 — 이 제거로 경기가 끝나면(전멸) 포획 배너 대신 경기 결과 배너 하나만 낸다 */
  let ended=false;
  ENDING_BATTLE=true;
  try{ ended=checkWipe(); } finally{ ENDING_BATTLE=false; } // 제거이므로 전멸 판정 기여
  battleEndFx(q,(ended?matchEndBanner():null)
    /* #126: 포획은 **양측 모두 포획 갈래**다. 문구와 승자·소유자 의미는 그대로 두고, 비포획자 시점만 가라앉힌 색(capnot)을 쓴다 —
       종전처럼 lose 를 주면 포획당한 쪽에 경기 패배급 균열·낙하가 걸린다 (Saturn REVISE). */
    ||{title:"포획 성공! 전투 종료",cls:(viewerIsOwner(p)||(S.mode==="pvp"&&!NET.mode)?"cap":"cap capnot")},()=>{ if(!S.battle) close(); }); // #106 5.6
  if(ended){ render(); return; }
  afterBattle(attacker, side==="A"&&attacker.alive);
  render();
}
/* #146 (v0.4.7 CJ 2026-09-10) 이 지웠던 도망 실패 반격은 #122 REVISE(2026-09-10 CJ QA 2)로 **기본 공격 한정으로 되살아났다**.
   실패 = 상대의 무료 기본 공격 1회 + 자기 전투 행동 1회 소모, 그 뒤 상대의 정상 차례. 전용 함수를 새로 두지 않고
   __fleeCore 가 execSlot(oSide,-1,{allowBasic:true}) 를 직접 부른다 — 피해·상성·보호막·사망 판정은 기존 파이프라인 그대로다. */
/* #13 → #114 도망 성공 후: 보드에서 후방 자기 말을 골라 위치 교환(생략 가능) → 밀기 (docs/v0.4.5-analysis.md 3장 계약 5·6).
   입력 주인은 도망친 말의 소유자(방어자일 수 있어 S.current 와 다름) — 온라인은 netActor() 가 소유자를 돌려주므로 소유자 클라이언트만 cell/fleeSkip 을 송신하고 상대는 대기.
   교환하면 전선으로 들어온 말 ↔ 전투 상대를, 생략하거나 후방 후보가 없으면 도망친 말 ↔ 상대를 민다. 교환·밀기·재배치는 강제 전투·탐색 흔적을 만들지 않는다.
   대기 중인 텔레포트 forcedQueue 는 위치가 확정된 뒤(밀기·재배치 후) 승격한다 — 승격 시 인접을 다시 검사하므로 밀려난 대상은 자연히 면제된다. rand 소비 0 */
function fleeSwapPrompt(piece,opp){
  if(S.phase!=="play"||!piece.alive){fleeDone(); return;}
  const own=piece.owner;
  const dutyId=(S.forcedTargets&&S.forcedTargets.length&&S.movedPiece)?S.movedPiece.id:null; // 강제 전투 대기 말은 교환 대상에서 제외
  const duty=new Set([dutyId,...S.forcedQueue.map(x=>x.pid)]);
  const rear=alivePieces().filter(x=>x.owner===own&&x.id!==piece.id&&!duty.has(x.id)&&(own===0?x.r>piece.r:x.r<piece.r)); // 후방 = 자기 진영 방향으로 행이 더 뒤
  S.selected=null;
  S.fleePick={owner:own,pieceId:piece.id,oppId:(opp&&opp.alive&&opp.placed)?opp.id:null,cands:rear.map(x=>x.id),token:S.turnCount+":"+S.battlesUsed+":"+piece.id};
  if(!rear.length){ fleeResolve(null); return; }
  if(isAI(own)){ // AI: 폭탄>함정>하수인 순 우선 교환 (전선에 위장 말 배치) — 난수 미소비
    const pri={bomb:0,trap:1,minion:2,ally:3,king:4};
    const t=rear.slice().sort((x,y)=>(pri[x.type]-pri[y.type])||(own===0?y.r-x.r:x.r-y.r))[0];
    fleeResolve(t.id); return;
  }
  const mine=fleePickMine();
  const m=mine?"🏃 도망 성공 — 후방의 자기 말(파란 칸)을 클릭해 교환하거나 [교환 생략]":"🛗 도망 성공! 상대가 말을 교체 중입니다. 교체 후 말을 한칸씩 밀어냅니다.";
  addLog("🏃 도망 성공 — 후방 말 교환 선택 중","imp"); showToast(m);
  fxPlay({key:"fleeFx",kind:"banner",cls:"flee",title:"🛗 도망 성공!",sub:mine?"후방의 자기 말을 골라 자리를 바꾸거나 생략하세요. 교체 후 말을 한칸씩 밀어냅니다.":"상대가 말을 교체 중입니다. 교체 후 말을 한칸씩 밀어냅니다."});
  render();
}
function fleeDone(){ if(S.phase==="play"&&!S.battle) drainForcedQueue(false); render(); if(S.phase==="play"&&!S.battle&&isAI(S.current)) aiSchedule(); } // #18: 스왑 둘째 말의 강제 전투는 밀기·재배치 뒤 승격
function fleeResolve(swapId){ // swapId: 후방 후보 id 또는 null(생략) — 온라인 양측이 같은 액션 프레임으로 같은 결과
  const fp=S.fleePick; if(!fp) return false;
  S.fleePick=null;
  const piece=S.pieces.find(x=>x.id===fp.pieceId), opp=fp.oppId!==null?S.pieces.find(x=>x.id===fp.oppId):null;
  let front=piece;
  const t=(swapId!==null&&swapId!==undefined)?S.pieces.find(x=>x.id===swapId):null;
  if(t&&fp.cands.includes(t.id)&&t.alive&&t.placed&&piece.alive&&piece.placed){ fleeSwap(piece,t); front=t; }
  else addLog(fp.cands.length?"🏃 도망 — 교환 생략":"🏃 도망 — 교환할 후방 말이 없습니다","imp");
  if(S.phase==="play"&&opp&&opp.alive&&opp.placed&&front.alive&&front.placed&&adj(front,opp)){ met(fp.owner,"fleePushes"); pushResolve(front,opp,{who:fp.owner}); }
  fleeDone();
  return true;
}
function fleeSwap(a,b){
  const ar=a.r, ac=a.c; a.r=b.r; a.c=b.c; b.r=ar; b.c=ac; // movedPreBT 미기록·강제 전투 미적용·흔적 미기록
  healBreak(a); healBreak(b); // #106: 도망 후 교환도 자세 해제
  addLog(`🏃 도망 — 후방 말과 위치를 교환했습니다.`,"imp");
  checkKingReach();
}
function afterBattle(attacker,attackerWonAlive){
  if(S.battlesUsed===1) S.firstBattleWonByMover = (attacker===S.movedPiece && attackerWonAlive);
  drainForcedQueue(false); // #18: 스왑 둘째 말 강제 전투 — 독립 queue에서 승격 (승·패·포획 종료 공통)
  render();
  if(S.phase==="play"&&!S.battle&&isAI(S.current)) aiSchedule();
}
