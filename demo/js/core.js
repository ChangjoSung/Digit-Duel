"use strict";
/* #245 점진 Core 경계: reducer는 입력 상태를 바꾸지 않고 다음 상태와 표시 event만 돌려준다.
   레거시 예약 콜백이 S 객체 정체성을 검사하므로 commit은 같은 S에 얕게 반영한다. */
/* #245 Saturn REVISE: "실리지 않았다"와 "실렸는데 값이 못 쓴다"를 가르는 한 곳. 참/거짓으로 보면 null·0·""·undefined 가
   모두 "생략"으로 둔갑해 조작된·손상된 프레임이 기본값 해석을 얻는다 — 오직 자기 속성 유무만 본다. */
function ownProp(o,k){return !!o&&Object.prototype.hasOwnProperty.call(o,k);}
/* ===== #245 상태 selector — Core 소유 =====
   보드·가시성·합법성 판정은 규칙이다. 분리 전에는 표시 계층(ui.js)에 있어 Core 가 화면 파일에 의존했다.
   구현은 글자 단위로 그대로 옮겼고, 말미 state 인자 규약(기본 S)도 같다 — reducer 는 받은 보드만 읽는다.
   화면 배치(boardFlipped)만 ui.js 에 남는다. */
const isAI=p=>(S.mode==="pve"&&p===1)||S.mode==="sim";
/* #245 Saturn REVISE(M2): 공개 기록은 **권위 상태**(S.log)다 — 쓰는 자리는 Core 한 곳이고 표시 계층은 그린 결과만 받는다.
   종전 ui.js addLog 의 직접 S.log.push 는 없어졌다. */
function addLog(msg,cls){ S.log.push({msg,cls:cls||""}); emitCore({type:"logAppended"}); }
/* #245 Saturn REVISE(M1): Core 가 화면에 말을 거는 방식은 **의미 이벤트 하나**뿐이다 — HTML·콜백·DOM 은 ui.js 소유다.
   emitCore 는 reducer 가 돌려주는 이벤트 목록과 **같은 계약·같은 소비기**(runCoreEvents)를 쓰므로,
   규칙 실행은 언제나 여기서 끝나고 화면은 남은 것만 받는다 (포트가 무동작이어도 규칙 진행은 완결된다). */
function emitToast(message,kind){ emitCore({type:"toast",message,kind}); }
function emitContactBanner(piece,sub){ emitCore({type:"contactBanner",piece,sub}); }
/* ===== #245 Saturn REVISE(M1) 시점 판정 — Core 소유 =====
   무엇을 로그·문구에 싣는가는 숨은 정보 규칙이라 표시 계층이 아니라 규칙이 정한다. 온라인 좌석만 포트에서 온다
   (UI_PORT.seat(): 오프라인은 null). 종전 ui.js 구현과 값이 같다: 온라인=내 좌석 · PVE=사람(0) · 핫시트·sim=행동자 시점. */
function offlinePvp(){ return S.mode==="pvp"&&UI_PORT.seat()===null; } // 같은 기기의 두 사람 — 중립 문구를 쓰는 유일한 경우
function viewerIsOwner(p){ const seat=UI_PORT.seat(); if(seat!==null) return p===seat; if(S.mode==="pve") return p===0; return true; }
/* cur: 턴 교대가 이미 커밋된 뒤 **교대 전** 시점으로 판정할 때만 넘긴다 (회복 틱 로그) */
function humanViewer(cur){
  const seat=UI_PORT.seat(); if(seat!==null) return seat;                       // 온라인: 항상 내 시점 고정
  if(S.mode!=="pvp") return 0;
  if(S.phase==="setup") return S.setupPlayer;
  if(S.phase==="shop"&&S.eco&&S.eco.shop&&S.eco.shop.active!==null) return S.eco.shop.active; // #236 핫시트 순차 상점 — 지금 상점을 쓰는 사람 시점
  if(S.eco&&S.eco.bagPick) return S.eco.bagPick.owner;                                      // #236 B08 — 포획한 쪽 시점 (가림 뒤)
  if(S.fleePick) return S.fleePick.owner;                                       // 핫시트: 도망 교환 선택 중에는 도망친 말의 소유자 시점 (기기 공유 — 상대는 시선 회피)
  return cur===undefined?S.current:cur;
}
/* #114 도망 교환 선택의 입력 주인이 이 화면의 사람인가 — PVE: 사람(0) · 핫시트: 기기 공유(소유자 시점) · 온라인: 내 좌석 */
function fleePickMine(){ return !!S&&!!S.fleePick&&!isAI(S.fleePick.owner)&&viewerIsOwner(S.fleePick.owner); }
const alivePieces=(state)=>(state||S).pieces.filter(p=>p.alive&&p.placed); // #245: 인자를 주면 그 상태의 보드를 본다 (기본은 현재 S)
const at=(r,c,state)=>alivePieces(state).find(p=>p.r===r&&p.c===c); // #245: 인자를 주면 그 상태의 보드를 본다 (기본은 현재 S)
const inForest=p=>(p.r>=4&&p.r<=5)||(p.r>=9&&p.r<=10);
const zoneOf=p=> p===0 ? [11,12,13] : [1,2,3];
const adj=(a,b)=>Math.abs(a.r-b.r)+Math.abs(a.c-b.c)===1;
/* 버닝 타임 (GDD-13 4.11): 표시 턴 65부터 직선 2칸 이동 강화 (폭탄 포함·함정 제외) */
const isBurning=(state)=>(state||S).turnCount+1>=BAL.burnStart; // #245: 인자를 주면 그 상태의 턴 수를 본다 (기본은 현재 S)
/* 원정 구역 = 자기 기준 상대 측 숲+상대 진영 (BT 2칸 이동 불가 구역) */
const expedZone=(owner,r)=> owner===0 ? r<=5 : r>=9;
function adjEnemies(p,state){return alivePieces(state).filter(e=>e.owner!==p.owner&&adj(p,e));}
function visibleTo(viewer,e,state){
  state=state||S; // #245: reducer 가 받은 상태의 보드·일시 공개만 본다 (기본은 현재 S)
  if(e.owner===viewer) return true;
  if(!inForest(e)) return true;
  if(state.tempReveal.has(e.id)) return true;
  return alivePieces(state).some(m=>m.owner===viewer&&adj(m,e));
}
function idLabel(viewer,p){
  if(p.owner===viewer||p.revealed||viewer===2) return (p.type==="minion"&&p.name?p.name:TYPE_KO[p.type])+(p.element?"·"+ELEM_KO[p.element]:"");
  return "?";
}
/* #245 Saturn REVISE(M4) 좌표·말의 형태 검증 — **합법성 판정보다 먼저** 본다.
   종전에는 맨해튼 거리만 봤기 때문에 (12,4)→(11.5,4.5) 같은 소수 좌표는 거리 1 로 계산되어 통과했고,
   문자열 "11" 은 산술 비교를 지나 보드 밖 행 14 도 거리 1 이면 통과했다. 조작된·손상된 프레임이
   보드 밖·칸 사이로 말을 옮기는 경로였다. 판정은 이 공용 selector 한 곳에 둔다 — reducer(move)도,
   AI·UI·온라인 재생도 전부 여기를 지나므로 호출처마다 따로 막을 필요가 없다. */
function boardCellOk(r,c){ return Number.isInteger(r)&&Number.isInteger(c)&&r>=1&&r<=ROWS&&c>=1&&c<=COLS; }
function movablePiece(p,state){ return !!p&&p.alive===true&&p.placed===true&&boardCellOk(p.r,p.c)&&(state||S).pieces.indexOf(p)>=0; }
function canMoveTo(p,r,c,state){
  state=state||S; // #245: reducer 가 받은 상태로 같은 판정을 돌린다 (기본은 현재 S)
  if(!movablePiece(p,state)||!boardCellOk(r,c)) return false; // #245 M4: 죽은·미배치·보드 밖 말과 정수 아닌·보드 밖 목적 칸은 여기서 끝난다
  if(state.phase!=="play"||state.mainUsed||p.owner!==state.current) return false;
  if(p.type==="trap") return false; // 함정은 상시 고정 (GDD-13 4.5 개정 — 폭탄만 이동 상시화)
  if(p.immobile>0) return false;
  const d=Math.abs(p.r-r)+Math.abs(p.c-c);
  if(d!==1){
    // BT 이동 강화: 직선 2칸 (폭탄 포함·함정 제외, 출발·경유·도착이 원정 구역이면 불가)
    if(d!==2||(p.r!==r&&p.c!==c)||!isBurning(state)) return false;
    if(expedZone(p.owner,p.r)||expedZone(p.owner,(p.r+r)/2)||expedZone(p.owner,r)) return false;
    const m=at((p.r+r)/2,(p.c+c)/2,state);
    if(m&&visibleTo(p.owner,m,state)) return false; // 경유 칸의 보이는 말 차단 (숨은 적 충돌은 doMove가 해석)
  }
  const o=at(r,c,state);
  if(o&&o.owner===p.owner) return false;
  if(o&&visibleTo(p.owner,o,state)) return false;
  return true;
}
function canBattle(att,def,state){
  state=state||S; // #245: reducer 가 받은 상태로 같은 판정을 돌린다 (기본은 현재 S)
  if(state.phase!=="play"||att.owner!==state.current||state.battlesUsed>=2) return false;
  if(att.type==="bomb"||att.type==="trap") return false;
  /* #122 REVISE(2026-09-10 CJ QA 6): **왕 vs 왕 불가침을 폐지**한다 — CJ 실플레이에서 텔레포트로 두 왕이
     맞닿는 상황이 실제로 나왔고, 그때 아무 일도 일어나지 않는 것이 아니라 전투가 되어야 한다는 결정이다.
     남는 전투 불가 조합은 폭탄·함정이 공격측일 때뿐이다(위 두 줄). 패배 결과는 기존 규칙 그대로 — 왕 본체가 지면 그 즉시 경기 패배다. */
  if(state.forcedTargets&&state.forcedTargets.length&&(att!==state.movedPiece||!state.forcedTargets.includes(def.id))) return false; // T1: 강제 대상 외 전투 봉쇄
  if(state.battlesUsed===1){
    // #14: 텔레포트 스왑 둘째 말의 승계 강제 전투는 연쇄(첫 전투 승리) 조건 면제
    const forcedOk=state.forcedTargets&&state.forcedTargets.length&&att===state.movedPiece&&state.forcedTargets.includes(def.id);
    if(!forcedOk){
      if(!state.firstBattleWonByMover||!att.alive||att!==state.movedPiece) return false;
      if(!state.contactSet.includes(def.id)) return false;
    }
  }
  return true;
}
/** #245 액션 계약: 들어온 액션을 reducer 가 받는 모양으로 **한 번만** 해석한다.
    @param {GameState} state @param {ReducerAction} action @returns {ReducerAction} */
function resolveCoreAction(state,action){
  /* #245 턴바 [탐색]·온라인 재생 프레임은 좌표를 싣지 않는다 — 선택 말과 그 칸의 **발견된** 흔적을 여기서 한 번만 해석한다.
     판정은 searchLegalIndex 한 곳뿐이고(좌표를 실은 직접 호출도 같은 게이트를 지난다), 고른 흔적은 좌표가 아니라 **자리(ei)** 로
     실어 보낸다 — Saturn REVISE: 같은 칸을 가리키는 항목이 둘이면 좌표만으로는 어느 쪽을 소모할지 정해지지 않는다.
     자리는 상태에서만 계산하므로 양 피어·재생·스냅샷이 같은 항목을 고른다. 어긋나면 id:null 로 내려 보내 reducer 가 조용히 거부한다.
     Saturn REVISE 5차: "좌표 없는 프레임"은 id·r·c·ei 가 **모두** 생략됐을 때뿐이다. 하나라도 실려 있으면 — null·undefined·문자열·
     소수·반쪽 좌표 무엇이든 — 그대로 통과시켜 reducer 의 엄격 검증이 거부하게 둔다. id 만 보던 종전 조건은 {t:"search",ei:null} 같은
     프레임의 ei 를 버리고 ei=0 을 재구성해, 요청하지 않은 첫 흔적을 대신 소모했다. */
  if(action.t==="search"&&!["id","r","c","ei"].some(k=>ownProp(action,k))){
    const sel=state.selected&&!state.selected.tray?state.selected:null;
    const ei=searchLegalIndex(state,sel);                              // 자리를 건네지 않은 해석은 여기 한 번뿐이다
    return ei<0?{t:"search",id:null}:{t:"search",id:sel.id,r:sel.r,c:sel.c,ei};
  }
  /* #263: 시간 초과 자동 배치(좌석을 실어 보낸다) — 화면의 "자동 배치"(state.setupPlayer)와 같은 한 곳을 쓴다.
     로스터는 건드리지 않는다: 경제 경기의 말은 시작 상점에서 산 것이고, 재주입은 setupAuto 가 이미 막는다. */
  if(action.t==="autoPlace"){
    const p=action.player;
    return (p!==0&&p!==1)?action:{t:"setupAuto",player:p,roster:state.roster[p].slice(),positions:autoPlacePositions(state,p)};
  }
  if(action.t!=="auto") return action;
  const player=state.setupPlayer, roster=state.roster[player].slice();
  if(roster.length<6){
    const rest=shuffle(ROSTER.filter(item=>!roster.includes(item.id)).map(item=>item.id));
    while(roster.length<6) roster.push(rest.pop());
  }
  return {t:"setupAuto",player,roster,positions:autoPlacePositions(state,player)};
}
/* 아직 놓이지 않은 그 좌석의 말만 자기 진영의 빈 칸에 난수로 놓는다 — 반환 좌표는 항상 합법(자기 zone · 1..COLS · 중복 없음)이다.
   이미 놓인 말(자기·상대)은 그대로 두고 그 칸만 피한다. */
function autoPlacePositions(state,player){
  const cells=[];
  for(const row of zoneOf(player)) for(let column=1;column<=COLS;column++) cells.push([row,column]);
  shuffle(cells);
  const occupied=new Set(state.pieces.filter(piece=>piece.alive&&piece.placed).map(piece=>piece.r+"_"+piece.c)), positions=[];
  for(const piece of state.pieces.filter(piece=>piece.owner===player&&!piece.placed)){
    const cell=cells.find(([row,column])=>!occupied.has(row+"_"+column));
    if(!cell) break;                                                   // 진영 칸보다 말이 많을 수 없다 — 방어적 중단
    positions.push({id:piece.id,r:cell[0],c:cell[1]}); occupied.add(cell[0]+"_"+cell[1]);
  }
  return positions;
}
/** #245 액션·이벤트·상태 계약이 만나는 한 곳. 거부는 null 이다 (다음 상태도 이벤트도 없다).
    @param {GameState} state @param {ReducerAction} action @returns {CoreResult} */
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
      if(state.eco) return null;                                   // #236: 로컬 경제는 무료 선택이 없다 — 시작 상점에서 산다 (8.1 ⑪)
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
      if(state.eco&&!(state.eco.shop&&state.eco.shop.done[action.player])) return null; // #236: 시작 상점을 마친 뒤에만 배치
      const next=Object.assign({},state,{roster:state.roster.map(x=>x.slice()),pieces:state.pieces.map(x=>Object.assign({},x)),selected:null});
      if(!state.eco){ next.roster[action.player]=action.roster.slice(); applyRoster(action.player,next); } // #236: 산 말은 그대로 (재주입 금지)
      for(const position of action.positions){ const piece=next.pieces.find(x=>x.id===position.id); piece.r=position.r; piece.c=position.c; piece.placed=true; }
      return {state:next,events:[{type:"render"}]};
    }
    case "setupConfirm": {
      const player=state.setupPlayer;
      if(state.eco&&!state.eco.shop.done[player]) return {state,events:[{type:"toast",message:"시작 상점을 먼저 완료하세요."}]};
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
       왕 끝줄 도달(즉시 승리)과 전투 슬롯이 이미 걸린 턴의 승계 판정도 여기서 끝난다 — 레거시 이동 경로는 남아 있지 않다.
       충돌 문구·전투 개시(initBattle)·배너·로그는 moved 이벤트의 표시 단계(collisionLog·forcedContactStart)에 그대로 남는다.
       reducer 계약대로 입력 상태는 건드리지 않는다 — 움직이는 말과 실제로 바뀌는
       metrics·traces·aiSeenMoved 칸만 복제하고 나머지 참조는 그대로 둔다.
       판정 헬퍼(canMoveTo·at·isBurning·adjEnemies·contactEligible·visibleTo)는 **인자로 받은 state 의 보드만** 읽는다 — teleSwap 과 같은
       선택적 말미 state 인자 규약이고, 기본값 S 라 reducer 밖 호출자(UI·AI·온라인 재생)는 종전 그대로다. 전역 S 를 읽으면 같은 입력에
       다른 결과가 나온다(온라인 재생·AI 탐색처럼 S 와 reducer 상태가 갈리는 호출). 판정을 다시 쓰지 않는다(중복 검증 없음). */
    case "move": {
      const target=state.pieces.find(x=>x.id===action.id);
      if(!target||state.battle||state.teleport||state.fleePick) return null; // 전투·텔레포트 단계·도망 교환 중에는 이동 입력을 받지 않는다 (호출처도 같은 자리에서 이미 막는다)
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
      /* 신규 인접 = 강제 전투·폭탄 접촉. 판정 보드는 **이동이 끝난 뒤의 보드**다 — 레거시 applyForced 가 S.movedPiece·
         S.contactSet 을 먼저 세우고 S.forcedTargets 를 비운 다음 contactEligible 을 불렀기 때문이다. 전투 슬롯이 이미
         하나 걸린 턴(battlesUsed===1)의 승계 판정(canBattle 의 movedPiece·contactSet 분기)과, 앞선 강제 전투 표식이
         남아 있는 상태의 재계산이 모두 이 보드 위에서 레거시와 같은 값을 낸다. */
      const afterIds=after.map(e=>e.id);
      const board=Object.assign({},state,{pieces:state.pieces.map(x=>x===target?moved:x),mainUsed:true,
        contactKind:hidden?"collision":"move",movedPiece:moved,contactSet:afterIds,forcedTargets:[]});
      const forced=after.filter(e=>!beforeAdj.has(e.id)&&contactEligible(moved,e,board)).map(e=>e.id);
      const next=Object.assign({},board,{forcedTargets:forced,
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
      /* 왕 끝줄 도달 즉시 승리 (GDD-13 4.1) — 분리 전 이동 경로가 흔적 조회 **앞**에서 checkKingReach 로 보던 자리다.
         숲 충돌로 멈춘 이동은 레거시도 이 지점에 오지 않으므로 검사하지 않는다. */
      const reach=hidden?null:kingAtEdge(next);
      if(reach) return kingReachResult(next,reach,{type:"moved",piece:moved,healBroken:!!target.healing,trace:false,collision:false,forced:null,kingReach:true});
      const ev=hidden?null:state.events.find(e=>e.r===dr&&e.c===dc&&!e.consumed); // 충돌로 멈춘 칸은 흔적을 발견하지 않는다 (레거시 그대로)
      if(ev){ next.traces=state.traces.slice(); next.traces[target.owner]=new Set(state.traces[target.owner]).add(ev.r+"_"+ev.c); }
      return {state:next,events:[{type:"moved",piece:moved,healBroken:!!target.healing,trace:!!ev,collision:!!hidden,forced:forced.length?forced:null}]};
    }
    /* #245 텔레포트 스왑: 실행 직전 재검사·사전 차단·위치 교환과 그 교환이 소모하는 자원(주 행동·횟수·지표),
       도착 칸 흔적, 두 말의 회복 자세 해제, 그리고 교환 직후의 **강제 전투 큐 적재와 첫 항목 승격**까지 Core 가 소유한다.
       표시(거부 사유 토스트·로그·배너·render)와 전투 개시(initBattle)는 teleRefused·teleSwapped 이벤트가 종전 헬퍼
       (forcedContactStart)로 그대로 넘긴다 — 문구·순서가 갈라지지 않게.
       왕이 섞인 교환의 끝줄 도달 즉시 승리도 여기서 끝난다 (move 와 같은 경계) — 레거시 스왑 경로는 남아 있지 않다.
       거부·차단은 **아무것도 소모하지 않는다** — 단계 되돌림(과 차단의 selected 해제)만 상태에 남고 좌표·자원·큐·난수는 그대로다.
       말은 **id 가 아니라 객체 정체성**으로 받는다 (Saturn REVISE P2): state.pieces 안의 그 말 자체여야 통과하므로
       복제 객체·같은 id 두 개·원격 프레임이 되살린 객체는 여기서 거부된다.
       판정 헬퍼(teleportAvailable·adjEnemies·newAdjAt·forcedEligible)는 **인자로 받은 state 의 보드만** 읽는다 — 전역 S 를 읽으면
       같은 입력에 다른 결과가 나온다(온라인 재생·AI 탐색처럼 S 와 reducer 상태가 갈리는 호출). 양끝 모두 내 말이라
       스왑 전 보드로 계산한 신규 인접 집합은 스왑 후와 같다(움직인 두 말은 서로의 적이 아니다). */
    case "teleSwap": {
      const a=action.a, b=action.b;
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
      /* 왕이 섞인 교환의 끝줄 도달 즉시 승리 — 분리 전 스왑 경로가 흔적 기록 **뒤**, 강제 전투 큐 적재 **앞**에서
         checkKingReach 로 보던 자리다. 큐는 그 경로에서 종전처럼 손대지 않는다. */
      const reach=kingAtEdge(next);
      if(reach) return kingReachResult(next,reach,{type:"teleSwapped",player:state.current,pieces:[pa,pb],
        healBroken:[!!a.healing,!!b.healing],traces,forced:null,kingReach:true});
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
      const queue=state.forcedQueue?state.forcedQueue.slice():[];
      /** @type {CoreEvent[]} */ const events=[];
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
    /* #263 T3 (2026-09-25 CJ) 강제 전투 대상 자동 선택 — 대상 선택 30초가 만료됐을 때 서버 시계가 넣는 액션이다.
       ① 후보를 **그 시점에 다시 검증**한다(밀려나거나 죽은 대상·적격이 바뀐 대상은 빠진다 — "선택 중 대상이
          사라지거나 적격성이 바뀌면 현재 적격 후보만 사용한다"). 판정은 forcedPickOk 와 같은 한 곳(contactEligible)이다.
       ② 남은 합법 후보 중 **균등**하게 하나를 뽑는다. 난수는 **선택 1회당 rand() 1회**이고(후보마다 다시 뽑지 않는다)
          후보가 하나뿐이면 아예 쓰지 않는다 — 같은 상태·같은 시드면 같은 대상이 나온다(V3 재현).
       ③ 합법 후보가 하나도 남지 않으면 강제 전투 표식을 지워 턴을 마칠 수 있게 한다(면제 사유는 로그로 남긴다).
       개시는 사람 클릭과 같은 경로(forcedContactStart→initBattle)가 맡는다 — 여기서 하는 일은 대상을 좁히는 것뿐이다. */
    case "forcedAuto": {
      const p=state.movedPiece, list=(state.forcedTargets||[]).slice();
      if(!p||!list.length) return {state,events:[]};
      const cands=adjEnemies(p,state).filter(e=>list.includes(e.id)&&contactEligible(p,e,state)).map(e=>e.id);
      if(!cands.length) return {state:Object.assign({},state,{forcedTargets:[]}),
        events:[{type:"forcedExempt",message:"⚔️ 강제 전투 면제 — 적격 대상이 남지 않았습니다."}]};
      const pick=cands.length===1?cands[0]:cands[Math.floor(rand()*cands.length)];
      return {state:Object.assign({},state,{forcedTargets:[pick]}),events:[{type:"forcedAutoPick",id:pick,count:cands.length}]};
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
        /* #263 T1 (2026-09-25 CJ): **시한 만료로 서버가 넘기는 턴**은 이 거부에 걸리지 않는다. 걸리면 그 좌석이
           차례를 쥔 채 경기가 멈춘다(종전 한계 1 — endTurn 이 거부되어 턴이 넘어가지 않던 자리다). 정상 흐름에서는
           여기까지 오지 않는다: 만료 처리는 forcedAuto 로 대상을 먼저 결정하고, 적격 후보가 하나도 없을 때만
           비워진 표식으로 이 자리에 닿는다. timeout 표식은 서버 시계만 붙인다(회선 어휘에는 없다 — _authorize 가
           {t:'endTurn'}·{t:'endTurn',auto:true} 로만 정규화한다). */
        if(!action.timeout&&!((next.mode==="pve"&&next.current===1)||next.mode==="sim")) // isAI(S.current) 가드 — 상태 기준
          return {state:next,events:events.concat([{type:"toast",message:"⚔️ 강제 전투 대상과 전투해야 턴을 마칠 수 있습니다."}])};
        next=Object.assign({},next,{forcedTargets:[],forcedQueue:[]}); // AI 안전장치 · 시한 만료 (이행 불가 상태 해소)
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
      /* #236 (2.1): 20·40·60·80번째 턴의 모든 처리가 끝난 이 자리 — 다음 턴 시작 전에 정기 상점. 경기가 끝났으면 endTurn 에 오지 않는다 */
      if(next.eco&&ECO.shopTurns.includes(next.turnCount))
        return {state:ecoShopOpenState(next,me),events:events.concat([{type:"turnEnded",player:me,healed,shop:true}])};
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
          else resetAfter(f); // #236 가방 대리 출전 — 끝난 경기의 가방 말 전투 상태만 걷는다
        }
      }catch(e){}
      /* entryPick(보류 중인 출전 선택)도 battle·recruit 과 같이 거둔다 — 종료 전이에서 남겨 두면 그 뒤에 도착한
         답(battleEntryGo)이 끝난 경기 위에 전투를 다시 연다 (기권·왕 도달 등 전투 밖 종료에서 실제로 열린 통로). */
      const next=Object.assign({},state,{phase:"over",winner:action.winner,metrics,battle:null,recruit:null,entryPick:null});
      if(clones.size) next.pieces=state.pieces.map(x=>clones.get(x)||x);
      return {state:next,events:[{type:"matchEnded",winner:action.winner,winType:action.winType,
        interrupted:!!B,banner:!action.endingBattle}]};
    }
    /* #245 기권: 경기 종료의 한 갈래다 — 같은 종료 전이를 그대로 쓴다 (레거시 별도 경로를 두지 않는다).
       권한 검사(자기 턴·AI 아님·연출 잠금 예외)는 netAction · confirmResign 이 그대로 맡고, 패자는 그 프레임의 current 다.
       문구·로그·렌더는 호출처 소유이므로 resignLoser 로 표시 계층에 넘긴다. */
    case "resign": {
      const result=reduceCoreAction(state,{t:"gameOver",winner:1-state.current,winType:"resign"});
      /** @type {CoreEventOf<"matchEnded">} */(result.events[0]).resignLoser=state.current; // matchEnded 의 표시용 칸 — #245 HIGH 3: 계약 안에서 받으므로 이름을 잘못 적으면 여기서 걸린다
      return result;
    }
    /* #245 탐색: 실행 가능 판정 → 주 행동·이벤트 칸 소모·지표·회복 자세 해제 → 보상 확정(패키지 재고 +1 또는 recruit 개시)
       까지의 **상태 전이**를 Core 가 소유한다. 표시(거부 토스트·공용 로그·튜토리얼·결과 연출·모달·AI 해결 호출)는
       searchRefused·searched·searchDone·recruitOpened 이벤트가 종전 표시 계층으로 그대로 넘긴다 — 문구·순서가 갈라지지 않게.
       난수는 recruit 후보 종 추첨 **1회**뿐이고 그 자리도 레거시와 같다 (계약 6 "후보 고정").
       공용 로그에는 종류·보유량을 싣지 않는다 (GDD-13 4.7 · #121 계약 4.8) — 상세는 소유자 전용 이벤트 필드로만 나간다.
       reducer 계약대로 입력 상태는 건드리지 않는다 — 탐색 말·events·metrics·pkgs 칸만 복제하고 나머지 참조는 그대로 둔다. */
    case "search": {
      const p=state.pieces.find(x=>x.id===action.id);
      if(!p||action.r!==p.r||action.c!==p.c) return {state,events:[]};                       // 흔적은 말이 선 칸의 것이어야 한다
      /* Saturn REVISE: ei 를 **실었는가**로 갈린다. 없으면(좌표 없는 caller) 여기서 한 번 결정적으로 고르고, 실었으면
         그 값이 null·undefined·문자열·소수·음수·범위 밖이어도 봐주지 않고 그대로 거부로 떨어진다. */
      const ei=ownProp(action,"ei")?searchLegalIndex(state,p,action.ei):searchLegalIndex(state,p); // 단계·차례·주 행동·생사·배치·발견 여부와 **요청한 자리**의 미소모 흔적까지 같은 게이트
      if(ei<0) return {state,events:[]};
      /* Saturn REVISE: 종류 거부는 공용 게이트 **뒤**다 — 그러지 않으면 단계·차례·주 행동이 틀린 시도까지 폭탄 사유 토스트를 띄워
         "지금 폭탄이 그 칸을 탐색할 수 있었다"는 정보가 샌다. 다른 모든 조건을 통과한 시도에만 사유를 알린다. */
      if(!canSearchPiece(p)) return {state,events:[{type:"searchRefused",owner:p.owner}]};   // #20 폭탄·함정은 탐색 실행 불가
      const ev=state.events[ei];
      const own=p.owner, piece=Object.assign({},p,{healing:false}); // #106: 탐색은 회복 자세 해제
      const metrics=Object.assign({},state.metrics,{byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
      const next=Object.assign({},state,{pieces:state.pieces.map(x=>x===p?piece:x),metrics,mainUsed:true,
        events:state.events.map((e,idx)=>idx===ei?Object.assign({},e,{consumed:true}):e)});  // 요청한 그 자리만 소모한다 (좌표가 겹쳐도)
      met(own,"searches",1,next);
      if(p.type==="minion") met(own,"minionSearches",1,next); // #12·#20 하수인 탐색 (구 '하수인 이벤트')
      /** @type {CoreEvent} */
      const searched={type:"searched",owner:own,piece,healBroken:!!p.healing};
      /* #121 계약 1.1 이후 이벤트는 3종뿐이다. itemGift·battleBuff 는 **그 자리에서 재고 +1** 로 끝나고(필수 선택 없음),
         개봉(내용 선택)은 전투 중 가방에서 한다(계약 2.2·3.1). recruit 만 탐색 자리에서 필수 선택이 이어진다. */
      /* #236 (GDD-23 7.2): 코인 수풀 — 그 구역에서 찾힌 n번째 = 🪙n (누가 찾든 구역 공통). 금액은 소유자 전용 문구로만 */
      if(ev.kind==="coin"){
        const top=ev.r<=5, n=next.events.filter(e=>e.kind==="coin"&&e.consumed&&(e.r<=5)===top).length;
        next.eco=Object.assign({},state.eco,{coins:state.eco.coins.slice()}); next.eco.coins[own]+=n;
        return searchDoneResult(next,[searched],own,`🪙 +${n}`,`이 수풀 ${n}번째 발견 · 보유 🪙${next.eco.coins[own]}`,null);
      }
      if(ev.kind==="itemGift"||ev.kind==="battleBuff"){
        next.pkgs=state.pkgs.map((x,i)=>i===own?Object.assign({},x):x);
        next.pkgs[own][ev.kind]++; // 보유 상한 없음 (계약 2.1)
        return searchDoneResult(next,[searched],own,`📦 ${EVENT_KO[ev.kind]} 획득!`,`보유 ${next.pkgs[own][ev.kind]}개`,null,"pkg");
      }
      /* 알 수 없는 종류(옛 저장 상태·테스트 픽스처의 폐기된 kind)는 **아무 보상 없이** 칸만 소모하고 종료 경로로 보낸다 */
      if(ev.kind!=="recruit") return searchDoneResult(next,[searched],own,"🌿 아무것도 없었다","");
      /* 계약 6 "후보 고정": 포획 후보 종은 탐색 중 한 번 ROSTER 20종 균등으로 뽑고, 모달 재렌더·방법 변경으로 재추첨하지 않는다 */
      /* Saturn REVISE: 토큰은 **게임을 가로질러** 이 recruit 하나만 가리켜야 한다. 게임마다 다시 1부터인 숫자였을 때는
         앞 게임의 첫 recruit 버튼을 들고 있던 콜백이 새 게임의 첫 recruit 을 그대로 전진시켰다. 말 id(PID)는 게임이 바뀌어도
         다시 쓰이지 않으므로 "탐색한 말 # 이 게임의 몇 번째 recruit" 이면 충분하고, 값이 전부 상태에서 나오므로
         양 피어·재생·스냅샷이 같은 토큰을 얻는다 (프로세스 전역 난수·카운터를 쓰지 않는다). */
      next.recruitToken=(state.recruitToken||0)+1;
      next.recruit={owner:own,pieceId:p.id,species:ROSTER[Math.floor(rand()*ROSTER.length)].id,
        stage:"root",skill:null,targetId:null,recvId:null,token:p.id+"#"+next.recruitToken};
      return {state:next,events:[searched,{type:"recruitOpened",owner:own,piece}]};
    }
    /* #245 탐색 보상 선택(#121 계약 4·6): 단계 전이·선택 값·기술 교체 확정·포획 판정·포기까지의 **상태 전이**를 Core 가 소유한다.
       화면(단계별 모달 재렌더·닫기·결과 연출)은 recruitStage·recruitClosed·searchDone 이벤트가 표시 계층으로 넘긴다.
       늦은 콜백·새 게임·턴 교대·말 사망 방어는 종전과 같은 한 곳(recruitState)이고 상태만 갈아끼운다.
       난수는 포획 판정(tryCapture) 1회뿐이다 — 후보 종은 탐색 시점에 고정, 제안 3종은 고정 목록.
       reducer 계약대로 입력 상태는 건드리지 않는다 — recruit·바뀌는 말·balls·metrics 칸만 복제한다. */
    case "recruit": {
      const st=recruitState(state); if(!st) return {state,events:[{type:"recruitClosed"}]};
      const {R,p,rd}=st, own=R.owner, step=action.step, i=action.i;
      /** @type {(patch:any)=>CoreResult} */
      const stage=patch=>({state:Object.assign({},state,{recruit:Object.assign({},R,patch)}),events:[{type:"recruitStage"}]});
      /* Saturn REVISE: 토큰은 **모든** step 에 필수다 (back·giveup 포함). 실리지 않은 호출을 봐주면 늦은 콜백·AI·되돌림이
         그 구멍으로 현재 recruit 을 전진시킨다 — 호출처는 자기가 본 recruit 의 토큰을 실어야 한다. 토큰은 탐색한 말 id 를
         담고 있어 게임이 바뀌면 값이 달라지므로 앞 게임의 버튼이 새 게임의 첫 recruit 을 건드리지 못한다. */
      if(action.token!==R.token) return {state,events:[]};
      /* 단계 전이도 합법성 판정이다 — 각 step 은 **자기 단계에서만** 통한다. 없으면 호출처가 root → recv → capMode
         처럼 화면에 없는 단계를 건너뛰어 수령 말·비용 검사를 통과시킬 수 있다. 늦은 버튼 콜백(같은 step 두 번)도 여기서 걸린다. */
      if(RECRUIT_STEP_STAGE[step]&&RECRUIT_STEP_STAGE[step]!==R.stage) return {state,events:[]};
      // 인덱스는 **그 step 의** 버튼 자리다 — 정수·음수 아님(findIndex 의 -1 · 소수 · 문자열 거부)에 더해 선택이 아닌 명령은 sentinel 0 만 받는다
      if(!Number.isInteger(i)||i<0||(!RECRUIT_CHOICE_STEPS.has(step)&&i!==0)) return {state,events:[]};
      // #129 계약 8: 포기도 "선택이 끝난" 상태다 — 같은 종료 경로를 탄다 (이벤트 소모는 되돌리지 않는다)
      if(step==="giveup") return searchDoneResult(state,[],own,"🌿 아무것도 얻지 않았다","이벤트 칸은 소모되었습니다");
      if(step==="back"){
        const to=RECRUIT_BACK[R.stage]; if(!to) return {state,events:[]}; // root 에는 뒤로가 없다 — 단계 밖 되돌림은 거부
        const patch={stage:to};
        if(to==="target") patch.targetId=null; if(to==="skill") patch.skill=null; if(to==="capRecv") patch.recvId=null;
        return stage(patch);
      }
      /* #234 (V2_INTERP.recruitSkillSwap · PD msg): 새 스킬 체계(⭐1 = 기본기 1칸, 전설 스킬은 전설 전용)와 충돌해 과도기에는
         기술 교체를 닫는다. 코드는 지우지 않고 비활성 분기로 둔다 — 포획·포기는 그대로다. */
      if(!V2_INTERP.recruitSkillSwap&&(step==="skills"||step==="skill"||step==="target"||step==="slot")) return {state,events:[]};
      if(step==="skills") return stage({stage:"skill"});
      if(step==="cap") return capReceivers(own,state).length?stage({stage:"capRecv"}):{state,events:[]};
      if(step==="skill"){ const sid=NEW_SKILLS[i]; return sid?stage({skill:sid,stage:"target"}):{state,events:[]}; }
      if(step==="target"){
        const m=rosterMinions(own,state)[i];
        if(!m||!m.alive||!m.placed||!m.skills||!NEW_SKILLS.includes(R.skill)||m.skills.includes(R.skill)) return {state,events:[]}; // 불법 선택 차단 (늦은 콜백·수신 프레임 포함)
        return stage({targetId:m.id,stage:"slot"});
      }
      if(step==="recv"){ const recv=capReceivers(own,state)[i]; return recv?stage({recvId:recv.id,stage:"capMode"}):{state,events:[]}; }
      if(step==="slot"){
        /* Saturn REVISE: 대상은 **내** 로스터 하수인이어야 한다 — 보드 전체에서 id 로 찾으면 조작된 targetId 가 상대 말·예비 말을 가리킬 수 있다.
           고른 기술도 제안 3종 안이어야 한다 (조작된 skill 로 아무 기술이나 장착하지 못하게). */
        const m=rosterMinions(own,state).find(x=>x.id===R.targetId);
        // Saturn REVISE: 슬롯 범위는 그 말의 **실제 기술 칸 수**로 본다 (상수 4 로 두면 칸 수가 다른 손상·승계 기록을 그대로 통과시킨다)
        if(!m||!m.alive||!m.placed||!Array.isArray(m.skills)||i>=m.skills.length||!NEW_SKILLS.includes(R.skill)||m.skills.includes(R.skill)) return {state,events:[]};
        /* 계약 4.2-7 확정: 남은 쿨(cds[i])은 **그대로 승계**하고(초기화 금지), 그 슬롯의 공개 기록만 지운다 → 다시 비공개 */
        const nm=Object.assign({},m,{skills:m.skills.slice()});
        nm.skills[i]=R.skill;
        if(nm.revealedSkills) nm.revealedSkills=nm.revealedSkills.filter(x=>x!==i);
        return searchDoneResult(Object.assign({},state,{pieces:state.pieces.map(x=>x===m?nm:x)}),[],own,
          `📘 ${SKILLS[R.skill].ko} 습득!`,`${m.name||"하수인"} 슬롯 ${i+1} (남은 쿨 ${m.cds[i]} 승계)`);
      }
      if(step==="mode"){
        const mode=CAP_MODES[i]; if(!mode) return {state,events:[]};
        const recv=capReceivers(own,state).find(x=>x.id===R.recvId);
        if(!recv) return {state,events:[]};                                        // 수령 자격 재검사 — 살아 있고 배치된 **내** 동료·왕 중 포획 슬롯이 빈 말
        if(state.balls[own]<(mode==="safe"?2:1)) return {state,events:[]};          // 비용 재검사
        /* 판정은 레거시와 같은 한 곳(tryCapture)이다 — 복제해 둔 next 와 그 안의 복제 말만 주면 rand 소비 순서·횟수가 그대로다 */
        const cp=Object.assign({},p), crecv=recv===p?cp:Object.assign({},recv);
        const metrics=Object.assign({},state.metrics,{byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
        const next=Object.assign({},state,{balls:state.balls.slice(),metrics,
          pieces:state.pieces.map(x=>x===p?cp:(x===recv?crecv:x))});
        const r=tryCapture(cp,mode,crecv,rd,next);
        return r.ok
          ? searchDoneResult(next,[],own,"🔴 포획 성공!",`${rd.name} — ${TYPE_KO[crecv.type]}의 대리 출전 가능`,"captureFx")
          : searchDoneResult(next,[],own,"🔴 포획 실패",r.dmg?`공용 하수인 소멸 · 탐색 말 HP ${r.dmg} 피해 (HP ${cp.hp})`:"공용 하수인이 사라졌다","captureFx");
      }
      return {state,events:[]};
    }
    /* #245 전투 커맨드(#121·#146·#241): 가방·패키지·포획·도망·넘기기·기술 선택의 **합법성과 자원 회계**를 Core 가 소유한다.
       종전에는 같은 판정이 battleModal() 렌더 클로저 안에 있었고(렌더 시점의 B·side·f·행동 토큰을 들고 다녔다)
       네트워크 재생·AI 가 그 전역 클로저를 다시 불렀다 — 규칙이 표시 계층의 렌더 주기에 매여 있었다.
       여기로 옮기면 판정이 **상태만** 읽으므로 '옛 클로저'라는 것 자체가 없고(#146 Saturn REVISE P1 의 actSeq
       스냅샷 가드가 방어하던 경로가 구조적으로 사라진다), 사람·AI·수신 프레임·테스트가 같은 게이트를 지난다.
       판정은 종전과 같은 한 곳을 쓴다 — 투척 가능(canThrow)·슬롯 합법(slotUsable)·도망 성공률(fleeProbOf)을
       다시 쓰지 않는다. 난수는 포획 판정과 도망 판정 각 1회뿐이고 그 자리도 레거시와 같다.
       이 tranche 에서 전투 인스턴스(state.battle)와 전투원 객체는 **복제하지 않고 값만 고쳐 쓴다** — B 의 정체성을
       예약 콜백(pendingFx)·msgQ·`S.battle===B` 검사·진행 중 연출이 붙잡고 있어 복제하면 엔진이 끊긴다
       (파일 머리의 "S 객체 정체성" 과 같은 이유다). 복제 전환은 지연 효과·스케줄러 tranche 의 몫이다.
       플레이어 소유 재고(balls·inv·pkgs·metrics)는 reducer 계약대로 복제한다.
       실행 엔진(execSlot·nextPhase·finishByCapture·battleEndFx·모달)은 커밋 뒤 이벤트로 넘긴다 — moved →
       forcedContactStart 와 같은 경계다. */
    case "pkgOpen": { // #121 계약 2.2·3 개봉 화면 열기 — 재고는 확정(pkgPick)에서만 움직인다. 난수 0
      if(!action.frame) return null;                 // 프레임이 없는 호출(수신 어휘·직접 호출)은 전투 화면 진입점이 자기 프레임을 붙여 다시 부른다
      const ctx=battleCmdCtx(state,action); if(!ctx) return {state,events:[]};
      const {B,side,ownerP}=ctx;
      if(B.bonus&&B.bonus.stage==="active") return {state,events:[]};                        // #241 R1 추가 공격 중 불가(L17)
      if(action.kind!=="itemGift"&&action.kind!=="battleBuff") return {state,events:[]};     // 알 수 없는 종류는 조용히 거부
      const pk=state.pkgs[ownerP]; if(!pk||!(pk[action.kind]>0)) return {state,events:[]};
      if(action.kind==="battleBuff"&&(side==="A"?B.buffA:B.buffD)) return {state,events:[]}; // 계약 3.1: 플레이어별 한 전투 1개
      B.menu=null;
      /* Saturn REVISE: 확정(pkgPick)은 **살아 있는 개봉 화면**에서만 나올 수 있다. 개봉이 발급한 이 표가 유일한 증거다 —
         종류·소유자와 **겨냥 문맥 4필드(side·seq·round·phase)** 를 함께 담아 두고 확정이 정확히 한 번 소모한다.
         확정은 모달 중계를 타서 회선 프레임이 없으므로(버튼 인덱스만 간다) 이 표가 곧 확정의 wire 다 — 개봉이
         자기 문맥 대조를 통과한 뒤에만 발급되기 때문이다. 없는 표(개봉 없이 온 확정)·다른 종류·다른 소유자·
         행동이 넘어간 뒤의 늦은 표·취소된 표·이미 쓴 표(재생)는 전부 거부된다. 난수·규칙 상태는 건드리지 않는다.
         Saturn REVISE 3차: 같은 종류를 같은 문맥에서 다시 열면 종전 표와 **글자 그대로 같은 값**이 나왔다 — 두 표가
         구별되지 않으니 앞 개봉의 남은 모달 콜백이 뒤 개봉의 표로 재고를 움직였다. 개봉마다 단조 증가하는 발급
         번호(id)를 붙여 표를 유일하게 만들고, 확정·취소는 **자기가 받은 그 번호**를 제시해야 한다.
         번호는 상태에서만 올라가므로(난수 0) 양 피어·재생·좌석 엔진이 같은 값을 얻는다 — 락스텝 그대로다.
         Saturn REVISE 4차: 발급 카운터가 전투 인스턴스 안에 있어 **전투마다 0 으로 돌아갔다** — 한 경기의 두 번째
         전투가 첫 전투와 같은 번호(1,2,…)를 다시 발급하니 앞 전투에 남은 모달 콜백이 새 전투의 표를 회수하거나
         재고를 움직일 수 있었다. 카운터를 **경기 단위(S.pkgSeq)** 로 올려 번호가 경기 안에서 유일해진다.
         소유자 재고와 같은 S 값이므로 reducer 계약대로 복제해 돌려준다. */
      const id=(state.pkgSeq||0)+1;
      B.pkgSel={kind:action.kind,owner:ownerP,side,seq:B.actSeq||0,round:B.round,phase:B.phase,id};
      return {state:Object.assign({},state,{pkgSeq:id}),events:[{type:"pkgOpenModal",kind:action.kind,owner:ownerP,round:B.round,id}]};
    }
    /* #121 확정 — 여기서만 재고가 줄고 효과가 적용된다. 온라인은 modal 래퍼가 이 호출을 인덱스로 중계하므로 양측이 같은 분기를 탄다.
       중계는 버튼 인덱스만 나르므로 확정에는 회선 프레임이 없다 — 겨냥 문맥은 개봉이 발급한 표(B.pkgSel)가 대신 싣는다. */
    case "pkgPick": {
      if(!action.frame) return null;                 // 프레임이 없는 호출(수신 어휘·직접 호출)은 전투 화면 진입점이 자기 프레임을 붙여 다시 부른다
      const sel=state.battle&&state.battle.pkgSel;   // 개봉이 발급한 표가 곧 이 확정의 wire — 없으면 확정 자체가 없다
      const ctx=sel?battleCmdCtx(state,{frame:action.frame,wire:{side:sel.side,seq:sel.seq,round:sel.round,phase:sel.phase}}):null;
      if(!ctx) return {state,events:[]};
      const {B,side,f,ownerP}=ctx;
      if(B.bonus&&B.bonus.stage==="active") return {state,events:[]};                        // #241 R1 추가 공격 중 불가(L17)
      const i=action.i; if(!Number.isInteger(i)||i<0) return {state,events:[]};              // 버튼 자리는 정수여야 한다 (늦은 콜백·조작 프레임)
      const want=action.what==="gift"?"itemGift":(action.what==="buff"?"battleBuff":null);
      if(!want||sel.kind!==want||sel.owner!==ownerP) return {state,events:[]};               // 종류·소유자까지 그 표가 발급된 그대로여야 한다
      if(action.id!==sel.id) return {state,events:[]};                                       // **그 개봉이 발급한 바로 그 번호** — 교체된 앞 표의 남은 콜백은 여기서 떨어진다
      const pkgs=state.pkgs.map((x,idx)=>idx===ownerP?Object.assign({},x):x), pk=pkgs[ownerP];
      const next=Object.assign({},state,{pkgs});
      if(action.what==="gift"){
        if(!(pk.itemGift>0)) return {state,events:[]};
        const k=GIFT_PICKS[i]; if(!k) return {state,events:[]};
        pk.itemGift--; B.pkgSel=null;                    // 확정 순간에만 −1 · 표도 같은 자리에서 정확히 한 번 소모한다
        if(k==="ball"){ next.balls=state.balls.slice(); next.balls[ownerP]++; } // 계약 2.1: 보유 상한 없음
        else next.inv=state.inv.map((x,idx)=>idx===ownerP?x.concat([k]):x);
        B.menu=null;
        /* 계약 3.1·10 비공개: **아직 쓰지 않은** 획득 종류는 상대에게 공개하지 않는다. B.blog 는 양측이 공유하는 상태라
           텍스트를 시점별로 바꿀 수 없으므로 **로그에는 중립 문구만** 쓰고, 종류는 소유자 전용 토스트로만 알린다. */
        bmsg(`🎁 ${pname(ownerP)}가 선물 상자를 열었다.`,null,{key:"itemFx"},B); // 계약 9: 획득 연출도 1.2초(itemFx)
        return {state:next,events:[{type:"pkgPicked",owner:ownerP,toast:`🎁 ${GIFT_KO[k]} 획득`}]};
      }
      if(action.what!=="buff"||!(pk.battleBuff>0)) return {state,events:[]};
      const key=BUFF_KEYS[i]; if(!key) return {state,events:[]};
      if(side==="A"?B.buffA:B.buffD) return {state,events:[]};                               // 한 전투 1개
      if(key==="time"&&B.round!==1) return {state,events:[]};                                // 계약 3.3 R1 한정 (늦은 콜백 방어)
      pk.battleBuff--; B.pkgSel=null;
      /* 버프 회계의 **단일 원천은 전투 인스턴스**다 (B.buffA/B.buffD). S 에 같은 값을 또 두지 않는다 —
         중복 필드는 여러 종료 경로 중 하나만 빠져도 드리프트가 되고, 계약 3.1 의 "전투가 끝나면 즉시 정리"를 깨뜨린다. */
      battleBuffApply(B,side,f,key);
      return {state:next,events:[{type:"pkgPicked",owner:ownerP}]};
    }
    /* #121 개봉 취소 — 아무것도 소모하지 않지만 **표는 회수한다**. 종전에는 취소가 표시 계층에서 화면만 닫아
       (closeModal(); battleModal()) 발급된 표가 그대로 살아 있었다: 그 뒤에 늦게·다시 도착한 확정이 그 표로 재고를
       움직일 수 있었다. 취소도 다른 전투 어휘와 같은 Core 경계를 지나고, 모달 중계를 타므로 양측이 같이 회수한다.
       난수 0 · 규칙 상태 무변경 — 표 하나만 비운다. */
    case "pkgCancel": {
      if(!action.frame) return null;
      const B=state.battle;
      /* 자기 번호의 표만 회수한다. Saturn REVISE 4차: 번호가 어긋난 취소는 **이벤트도 내지 않는다** — 종전에는
         화면만 닫는다며 pkgPicked 를 그대로 냈고, 그 이벤트가 지금 살아 있는 **교체·새 전투의 개봉 화면**을 닫았다.
         늦은 취소(중복 클릭·재생·앞 개봉이나 앞 전투의 남은 콜백)는 표도 화면도 건드리지 않는 완전한 no-op 이다. */
      if(!B||!B.pkgSel||B.pkgSel.id!==action.id) return {state,events:[]};
      B.pkgSel=null;
      return {state,events:[{type:"pkgPicked",owner:null}]};
    }
    /* #121 계약 2.3 — 유일하게 남은 제한(플레이어별 라운드 1회)을 **규칙 경로에서** 집행한다.
       버튼 disabled 는 표시 계층이라 중복 클릭·수신 프레임·늦은 콜백을 막지 못한다. 아래 검사가 모두 통과해야 재고가 움직인다:
       전투가 살아 있는가 · 지금 이 side 의 행동 차례인가 · 그 칸에 실제 아이템이 있는가 · 이번 라운드에 아직 안 썼는가.
       (전투당 2회·연속 동일 금지는 계약으로 제거됐으므로 여기서 막지 않는다.) */
    case "item": {
      if(!action.frame) return null;                 // 프레임이 없는 호출(수신 어휘·직접 호출)은 전투 화면 진입점이 자기 프레임을 붙여 다시 부른다
      const ctx=battleCmdCtx(state,action); if(!ctx) return {state,events:[]};
      const {B,side,f,ownerP}=ctx;
      if(B.bonus&&B.bonus.stage==="active") return {state,events:[]};                        // #241 R1 추가 공격 중 불가(L17)
      if(side==="A"?B.itemRoundA:B.itemRoundD) return {state,events:[]};                     // 라운드 1회
      const i=action.i; if(!Number.isInteger(i)||i<0) return {state,events:[]};
      const k=state.inv[ownerP][i];
      if(k===undefined||!ITEMS[k]) return {state,events:[]};                                 // 유효하지 않은 인덱스
      const inv=state.inv.map((x,idx)=>idx===ownerP?x.slice():x); inv[ownerP].splice(i,1);
      const next=Object.assign({},state,{inv});
      // #121 계약 2.3: itemsX·lastItemX 는 **기록**으로만 남는다. itemRoundX 만 실제 게이트다
      if(side==="A"){B.itemsA++;B.itemRoundA=true;B.lastItemA=k;} else {B.itemsD++;B.itemRoundD=true;B.lastItemD=k;}
      if(k==="potion"){const h=Math.round(f.maxHp*BAL.itemHealPct); f.hp=Math.min(f.maxHp,f.hp+h);
        bmsg(`🧪 회복약! ${fighterName(side)}의 HP ${h} 회복.`,{float:{side,html:`<span class="pos">+${h}</span>`},hp:{side,val:f.hp,max:f.maxHp}},{key:"itemFx"},B);}
      if(k==="cool"){f.cd=0; if(f.skills)f.cds=f.skills.map(()=>0); f.cdUpFresh=[]; bmsg("🧪 쿨링수 — 스킬 쿨타임 초기화!",null,{key:"itemFx"},B);} // 4슬롯 전체 초기화 (아이템 설명 문언 준용 — [기획 필요] 후보)
      if(k==="cure"){ if(!f.burnNoCure){f.burn=0;f.burnFresh=false;f.burnMag=0;} f.weaken=0;f.weakenMag=0;f.shock=0;f.shockFresh=false;f.crack=0;f.crackFresh=false;
        /* #234 (4.5): 회복 감소·이끼 잠식도 상태이상 — 영겁의 재 화상(burnNoCure)은 해제되지 않는다. #241 V1: 속도 감소 → 회피율 감소 */
        f.evadeDownR=0;f.evadeDownRFresh=false;f.evadeDown=0;f.healCutR=0;f.healCutRFresh=false;f.healCut=0;f.mossR=0;f.mossRFresh=false;f.mossPct=0;f.mossBy=null;
        bmsg("🧪 해독제 — 상태이상 해제!",{st:stFx(side,f)},{key:"itemFx"},B);} // #233 (GDD-23 4.5): 균열도 상태이상 — 경화·흡수·방어막 같은 버프는 그대로 둔다
      B.menu=null; // 사용 연출 뒤 같은 행동자의 메뉴(루트)로 복귀 — 행동 미소모 (GDD 4.6 보너스 행동)
      return {state:next,events:[{type:"battleItemUsed"}]};
    }
    /* #12 적 하수인 포획: 볼 소모(성공·실패 공통) — 성공 시 포획 종료, 실패 시 행동 소모.
       투척 가능 판정(상대 종·HP 30%·볼 보유·예비 슬롯·라운드 1회)은 종전 battleModal 의 canThrow 를 **그대로 옮겨 온 것**이다 —
       렌더가 계산한 값을 규칙이 받아 쓰던 구조를 끊는다 (서버 _authorize 와 같은 판정). */
    case "ball": {
      if(!action.frame) return null;                 // 프레임이 없는 호출(수신 어휘·직접 호출)은 전투 화면 진입점이 자기 프레임을 붙여 다시 부른다
      const ctx=battleCmdCtx(state,action); if(!ctx) return {state,events:[]};
      const {B,side,ownerP}=ctx;
      if(B.bonus&&B.bonus.stage==="active") return {state,events:[]};                        // #241 R1 추가 공격 중 불가(L17)
      if(ballWhy(state,side)) return {state,events:[]};                                      // #236: 투척 가능 판정은 한 곳 (전설·보유 종 제외 포함)
      const balls=state.balls.slice(); balls[ownerP]--;
      const metrics=Object.assign({},state.metrics,{byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
      const next=Object.assign({},state,{balls,metrics});
      if(side==="A")B.ballThrowA=true; else B.ballThrowD=true;
      met(ownerP,"enemyCapTries",1,next); // #20 적 포획 시도
      B.menu=null;
      bmsg(`🔴 ${pname(ownerP)}의 몬스터볼 투척!`,null,{key:"captureFx"},B);
      if(rand()<BAL.enemyCapProb) return {state:next,events:[{type:"battleCaptured",side}]};
      met(ownerP,"enemyCapFails",1,next); // #20 적 포획 실패
      bmsg(`🔴 포획 실패! 볼이 튕겨나왔다. (남은 볼 ${balls[ownerP]})`,null,{key:"captureFx"},B);
      return {state:next,events:[{type:"battleNextPhase"}]};
    }
    /* #13 → #146 도망: 성공 시 전투 즉시 종료(판정·제거 없음·battlesUsed 유지), **실패 시 자기 전투 행동 1회만 소모**한다.
       #122 REVISE(2026-09-10 CJ QA 2) — 도망 실패 페널티: **상대의 무료 기본 공격 1회**를 맞는다. 반격이 끝나면 execSlot 이
       nextPhase() 로 차례를 넘겨 상대의 정상 차례가 그대로 온다. 반격은 기술이 아니라 기본 공격이므로 쿨·기술 공개·부가효과가 없다
       (💪 힘의 수호자는 반격자에게 걸려 있으면 기존 피해 분산 고정이 그대로 적용된다 — 별도 처리 없음).
       합법성은 프레임 신선도(행동자·행동 토큰·라운드·단계)로만 본다 — 재생 중 여부(msgQ)는 여기서 보지 않는다.
       연출 잠금은 입력 경계 netAction·수신 경계 netReady·UI 의 busy·AI 의 fxWhenIdle 이 그대로 맡는다. */
    case "flee": {
      if(!action.frame) return null;                 // 프레임이 없는 호출(수신 어휘·직접 호출)은 전투 화면 진입점이 자기 프레임을 붙여 다시 부른다
      const ctx=battleCmdCtx(state,action,true); if(!ctx) return {state,events:[]};
      const {B,side,oSide,f,ownerP,piece,oppPiece}=ctx;
      if(B.bonus&&B.bonus.stage==="active") return {state,events:[]};                        // #241 R1 추가 공격 중 불가(L17)
      if(f.fleeLock) return {state,events:[{type:"battleFleeLocked",owner:ownerP}]};         // #234 가시 덩굴 3차
      const metrics=Object.assign({},state.metrics,{byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
      const next=Object.assign({},state,{metrics});
      B.actSeq++;
      met(ownerP,"fleeTries",1,next);
      B.menu=null;
      bmsg(`🏃 ${fighterName(side)}의 도망 시도!`,null,{key:"fleeFx"},B);
      if(rand()<fleeProbOf(f)){
        met(ownerP,"fleeOks",1,next);
        bmsg(`🏃 도망 성공! 전투가 종료되었다.`,null,null,B);
        resetAfter(B.fa); resetAfter(B.fd);
        const queue=B.msgQ.splice(0); // 남은 메시지는 종료 연출(battleEndFx)이 재생한다
        // #114 전투 상대(former opponent)는 전투 객체가 사라진 뒤에도 교환·밀기 대상으로 보존
        return {state:Object.assign({},next,{battle:null}),events:[{type:"battleFled",owner:ownerP,piece,oppPiece,queue}]};
      }
      bmsg(`🏃 도망 실패! 빈틈을 보이고 말았다.`,null,null,B);
      bmsg(`⚔️ ${fighterName(oSide)}의 반격 — 기본 공격!`,null,null,B);
      return {state:next,events:[{type:"battleBasicCounter",side:oSide}]};
    }
    /* #146 계약: 4슬롯이 전부 불가할 때의 **수동** 전투 행동 넘기기. 자동 진행이 아니라 사람이 [턴 종료]를 눌러야 실행된다.
       차단 대상(전부 조용히 무시 — 상대에게는 아무 안내도 새지 않는다): 전투 밖 · 내 차례 아님 · 사실은 쓸 수 있는 공격이 있음 ·
       왕·동료 본체(f.skills 없음 — 기본 공격이 있으므로 넘기기 대상이 아니다).
       소모하는 것은 **자기 전투 행동 1회**(nextPhase)뿐이다: 보드 주 행동·턴당 전투 횟수·약화 잔여 횟수·난수는 건드리지 않는다.
       #263 T4 (2026-09-25 CJ): **전투 행동 60초 만료**도 같은 자리를 쓴다 — `action.timeout` 이 붙으면 쓸 수 있는 기술이
       남아 있어도(그리고 R1 추가 공격 중에도) 그 전투원의 행동 1회만 건너뛰고 전투는 다음 행동·다음 라운드로 이어진다.
       "일반 수동 pass 의 기술 불가 조건을 시간 초과에도 강요하지 않는다"(#263 본문)가 그 근거다. 전투 취소·즉시 패배·
       경기 종료는 없고, 라운드 상한(6)이 그대로라 연달아 만료되면 기존 남은 HP 비율 판정으로 승패가 난다.
       timeout 표식은 **서버 시계만** 붙인다: 회선으로 온 pass 는 room.js _authorize 가 {t:'pass',bf} 로 다시 지어 넘기므로
       클라이언트가 이 갈래를 요청할 길이 없다. */
    case "pass": {
      if(!action.frame) return null;                 // 프레임이 없는 호출(수신 어휘·직접 호출)은 전투 화면 진입점이 자기 프레임을 붙여 다시 부른다
      const ctx=battleCmdCtx(state,action,true); if(!ctx) return {state,events:[]};
      const {B,side,f}=ctx, timeout=!!action.timeout;
      if(!timeout&&B.bonus&&B.bonus.stage==="active") return {state,events:[]};               // #241 R1 추가 공격 중 불가(L17)
      if(!timeout&&(!f.skills||f.skills.some((sid,i)=>slotUsable(f,i,side)))) return {state,events:[]};
      B.actSeq++;
      B.menu=null;
      /* 비공개: B.blog 는 양측이 공유하는 상태다. **왜** 넘겼는지(= 내 기술 4칸이 전부 막혔다)는 상대의 미공개 정보이므로
         공개 로그에는 중립적인 결과만 남긴다 (#121 5.3 봉인 사유 비공개와 같은 원칙). 시간 초과는 그 자체가 양측에
         공개된 사실이므로 사람의 선택과 구분되게 적는다(#263 AC 11). */
      bmsg(timeout?`⏳ ${fighterName(side)}는 시간이 초과되어 이번 행동을 건너뛴다.`:`⏭ ${fighterName(side)}는 이번 행동을 넘겼다.`,null,null,B);
      return {state,events:[{type:"battleNextPhase"}]};
    }
    /* 전투 커맨드의 실제 적용 지점 — 슬롯 인덱스(0~3) + 레거시 매핑: 'basic'→슬롯0(합법이 아니면 거부), 'skill'→슬롯1, 'common'→슬롯2.
       Saturn P1: 'basic' 은 **쿨이 아니라 합법성**을 본다 (계약 5.3 "기본 공격 폴백을 사신으로 강제 매핑하지 않는다").
       #146: 4슬롯 전투원에게 순수 기본 공격(-1)은 존재하지 않는다 — UI 는 그 버튼을 그리지 않으므로 여기로 들어오는 'basic' 은
       수신 프레임·UI 밖 호출뿐이고 조용히 거부한다 (왕·동료 본체는 f.skills 가 없어 해당 없음). */
    case "act": {
      if(!action.frame) return null;                 // 프레임이 없는 호출(수신 어휘·직접 호출)은 전투 화면 진입점이 자기 프레임을 붙여 다시 부른다
      const ctx=battleCmdCtx(state,action); if(!ctx) return {state,events:[]};
      const {B,side,f}=ctx, kind=action.k;
      if(B.bonus&&B.bonus.stage==="active"&&(B.actSeq||0)!==action.frame.seq) return {state,events:[]}; // #241 R1: 번개 꼬리 이전 렌더의 늦은 콜백이 추가 공격을 대신 쓰지 않게
      /* Saturn REVISE: 슬롯을 내보내기 전에 **쓸 수 있는 칸인지**를 본다. execSlot 은 사신의 낫만 다시 검사하므로
         쿨·봉인·조건 미충족 슬롯이 여기를 지나면 그대로 발동한다. 합법성의 단일 원천은 slotUsable 하나다 —
         사람 UI(버튼 disabled)·AI(합법 슬롯만 후보)·수신 프레임·테스트가 같은 게이트를 지난다.
         칸 번호는 실제 기술 칸을 가리키는 정수여야 한다(문자열·소수·음수·범위 밖 거부). 알 수 없는 종류도 조용히 거부한다 —
         거부는 아무것도 바꾸지 않는다(B.menu 도 그대로, 난수 0). */
      /* Saturn MEDIUM(#245): 레거시 별칭도 **실제 기술 칸**을 가리켜야 한다 — slotUsable 은 없는 칸(skills[i]===undefined)을
         막지 않아 1칸 전투원의 'skill'(슬롯1)·'common'(슬롯2)이 합법으로 읽혔고, execSlot 이 그 자리를 기본 공격으로 대신 내보냈다.
         칸 범위 검사를 한 곳(slotLegal)으로 모아 숫자 슬롯·레거시 별칭이 같이 지난다 — 권위 서버의 경계(room.js _legalAct 의 slotOk)와
         같은 판정이다. 없는 별칭은 정확한 무동작이다: 상태·참조·이벤트·난수·actSeq 를 하나도 건드리지 않는다. */
      const slotLegal=i=>!!f.skills&&i<f.skills.length&&slotUsable(f,i,side);
      let slot=null;
      if(typeof kind==="number"){
        if(!Number.isInteger(kind)||kind<0||!slotLegal(kind)) return {state,events:[]};
        slot=kind;
      }
      else if(kind==="basic"){ if(f.skills&&!slotLegal(0)) return {state,events:[]}; slot=f.skills?0:-1; }
      else if(kind==="skill"&&f.skills){ if(!slotLegal(1)) return {state,events:[]}; slot=1; }
      else if(kind==="common"){ if(!slotLegal(2)) return {state,events:[]}; slot=2; }          // 슬롯2 가 없는 전투원(왕·동료 본체 포함)은 서버와 같이 거부 — 기본 공격으로 대신하지 않는다
      else if(kind!=="skill"||!f.skillAtk||f.cd) return {state,events:[]};                                        // 'basic'·'skill'·'common' 과 슬롯 번호 외에는 전투 커맨드가 아니다
      /* Saturn MEDIUM(#245): f.skills 가 없는 구형 'skill' 의 가용성(속성 스킬 없음·쿨)도 **B.menu 를 건드리기 전에** 본다 —
         거부는 서버(_legalAct)·UI(canSkill)와 같은 판정이고, 늦은·잘못된 입력은 메뉴를 포함해 아무것도 바꾸지 않는 정확한 무동작이다. */
      B.menu=null;
      if(slot!==null) return {state,events:[{type:"battleSlot",side,slot}]};
      return {state,events:[{type:"battleLegacySkill",side}]};                                  // 구형 속성 스킬 경로
    }
    /* #236 경제 거래 — 상점(S01·정기)·B08 가방 초과. 전부 ecoReduce 한 곳이 검증하고 복제본에만 쓴다 */
    case "shopBuy": case "shopRefresh": case "shopGood": case "shopSell": case "shopSwap": case "shopTicket": case "leaderEl":
    case "shopDone": case "shopTimeout": case "bagPick":
      return ecoReduce(state,action);
    /* #236 정기 상점에서 산 전투 버프 사용 (7.3) — 한 전투 1개 · 시간은 1라운드만. 패키지 확정(pkgPick)과 같은 효과·같은 회계 */
    case "buffUse": {
      if(!action.frame) return null;
      const ctx=battleCmdCtx(state,action); if(!ctx) return {state,events:[]};
      const {B,side,f,ownerP}=ctx, key=action.key;
      if(!state.eco||(B.bonus&&B.bonus.stage==="active")||!BUFF_KEYS.includes(key)||!(state.eco.buffInv[ownerP][key]>0)) return {state,events:[]};
      if(side==="A"?B.buffA:B.buffD) return {state,events:[]};
      if(key==="time"&&B.round!==1) return {state,events:[]};
      const buffInv=state.eco.buffInv.map((x,i)=>i===ownerP?Object.assign({},x):x); buffInv[ownerP][key]--;
      battleBuffApply(B,side,f,key);
      return {state:Object.assign({},state,{eco:Object.assign({},state.eco,{buffInv})}),events:[{type:"pkgPicked",owner:ownerP}]};
    }
    /* #245 예고·지연 효과 스케줄러(#233 GDD-23 4.3·4.6) — 예약 등록과 라운드 카운트가 Core 안의 한 곳이 된다.
       종전에는 같은 함수가 큰(f.pendingFx) 상태를 고치면서 **전역 S.battle 을 읽고 임의 콜백까지 그 자리에서 불렀다** —
       상태 전이와 효과 실행이 섞여 있어 발동 순간의 재진입(예약 또 예약·발동으로 인한 전투 종료)이 상태를 되짚어 쓰는 경로가 있었다.
       다른 전투 어휘와 같이 **상태는 reducer, 실행은 이벤트**로 가른다: reducer 는 카운트만 내리고 발동할 항목을
       delayedFired 로 넘긴다. 발동 시 전투가 살아 있을 때만 실행하는 4.6 취소 규칙은 그 핸들러가 항목마다 그대로 검사한다.
       전투원(f)은 전투 커맨드 tranche 와 같은 이유로 복제하지 않고 값만 고쳐 쓴다(예약 항목·msgQ 가 정체성을 붙잡고 있다).
       대상은 teleSwap 처럼 참조로 실려 온다 — 서버 요약은 [roundsLeft, tag] 만 읽고(#233 계약) 이 어휘는 회선을 타지 않는다. */
    /* #245 공개 방 재수화: 서버가 이미 판정한 좌석 뷰를 클라이언트 상태로 앉히는 **유일한** 자리.
       로컬 액션을 다시 판정하지 않으므로 규칙 분기는 없지만, 그렇다고 네트워크 계층이 S 를 직접 써도 되는 것은 아니다 —
       어떤 칸이 뷰로 덮이는지(그리고 어떤 칸은 덮이지 않는지)를 여기서 한 번만 정하고, 같은 commit 경계를 지난다.
       말은 서버 스텁으로 **통째로 갈아끼운다**(replaceBoard) — 이전 스냅샷의 잔여 칸이 섞이면 서버 판정과 화면이 갈린다. */
    case "hydrate": {
      const v=action.view, seat=action.seat;
      /* #237 경기 전 서버 권위 경제(시작 상점) — 로컬 배치 뼈대(P0 시점) 위에 서버가 판정한 자기 말·경제·로스터만 앉힌다.
         배치 좌표는 로컬 입력이라 network.js 가 뼈대 값을 그대로 실어 온다(정체성 보존 커밋 — replaceBoard 아님). */
      if(v.setupEco){
        const roster=state.roster.map(x=>x.slice()); roster[0]=v.roster.slice();
        return {state:Object.assign({},state,{pieces:v.pieces,roster,eco:v.eco}),events:[]};
      }
      const byId=id=>id==null?null:(v.pieces.find(p=>p.id===id)||null);
      const turn=v.turn;
      const next=Object.assign({},state,{
        mode:"pvp", phase:v.phase,
        current:v.current!==null?v.current:state.current,
        turnCount:v.turnCount!==null?v.turnCount:state.turnCount,
        mainUsed:v.mainUsed, battlesUsed:v.battlesUsed,
        pieces:v.pieces, tempReveal:new Set(v.tempReveal),
        inv:state.inv.slice(), balls:state.balls.slice(), reserve:state.reserve.slice(),
        pkgs:state.pkgs.slice(), teleUsed:state.teleUsed.slice(), traces:state.traces.slice(),
        selected:byId(v.selected),
        teleport:turn&&turn.teleport?{stage:turn.teleport.stage===2?2:1,piece:byId(turn.teleport.piece)}:null,
        forcedTargets:turn&&Array.isArray(turn.forcedTargets)?turn.forcedTargets.slice():[],
        forcedQueue:turn&&typeof turn.forcedQueue==="number"&&turn.forcedQueue>0?Array.from({length:turn.forcedQueue},()=>({pid:null})):[],
        movedPiece:turn?byId(turn.movedPiece):null,
        firstBattleWonByMover:!!(turn&&turn.firstBattleWonByMover),
        contactSet:turn&&Array.isArray(turn.contactSet)?turn.contactSet.slice():[],
        events:v.events, fleePick:v.fleePick, battle:v.battle, _pendingModal:v.modal,
        eco:v.eco===undefined?state.eco:v.eco}); // #237 자기 좌석 경제(재화·가방·진열·B08) — 상대 자리는 network.js 가 빈 기본값으로 둔다
      next.inv[seat]=v.inv; next.balls[seat]=v.balls; next.reserve[seat]=v.reserve;
      if(v.pkgs) next.pkgs[seat]=v.pkgs;
      if(v.teleUsed!==null) next.teleUsed[seat]=v.teleUsed;
      next.traces[seat]=new Set(v.events.map(e=>e.r+"_"+e.c));
      if(v.log) next.log=v.log;
      if(v.result){ next.winner=v.result.winner; next.metrics=Object.assign({},state.metrics,{winType:v.result.winType,byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))}); }
      return {state:next,events:[],replaceBoard:true};
    }
    /* #245 기존 락스텝(hello/hello2)의 상대 사전 배치 적용 — 종전에는 network.js 가 검증한 뒤 말을 직접 옮겼다.
       회선에서 온 값이므로 **신뢰 경계**다: 로스터 6종(중복 없음·실재 종)·좌표 개수·행(자기 진영 3행)·
       **열이 1..COLS 의 정수**·칸 중복 없음을 모두 통과해야 한다. 열 정수 검사가 없으면 `[11, 3.5]` 같은
       소수 좌표가 그대로 보드에 앉아 두 좌석의 at()/adj() 판정이 갈린다(락스텝 파괴).
       손상 데이터는 종전과 같이 결정적 무작위 배치로 대체한다 — 양측이 같은 데이터·같은 시드를 보므로 결과도 같다.
       데이터는 항상 플레이어 0 진영(11~13행) 기준이고 p=1 이면 행만 미러링(r→14−r), 열은 그대로다. */
    case "netSetup": {
      const p=action.player, data=action.data;
      const next=Object.assign({},state,{roster:state.roster.map(x=>x.slice()),pieces:state.pieces.map(x=>Object.assign({},x))});
      const mine=next.pieces.filter(x=>x.owner===p);
      const ok=data&&Array.isArray(data.roster)&&data.roster.length===6
        &&new Set(data.roster).size===6&&data.roster.every(id=>ROSTER.some(r=>r.id===id))
        &&Array.isArray(data.pos)&&data.pos.length===mine.length
        &&data.pos.every(q=>Array.isArray(q)&&Number.isInteger(q[0])&&zoneOf(0).includes(q[0])&&Number.isInteger(q[1])&&q[1]>=1&&q[1]<=COLS)
        &&new Set(data.pos.map(q=>q[0]+"_"+q[1])).size===data.pos.length;
      if(!ok){
        next.roster[p]=[];
        const rest=shuffle(ROSTER.map(r=>r.id));                       // fillRosterRandom 과 같은 소비 (빈 로스터 → 30종 셔플 후 뒤에서 6개)
        while(next.roster[p].length<6) next.roster[p].push(rest.pop());
        applyRoster(p,next);
        const cells=[]; for(const r of zoneOf(p)) for(let c=1;c<=COLS;c++) cells.push([r,c]);
        shuffle(cells);
        mine.forEach((x,i)=>{x.r=cells[i][0]; x.c=cells[i][1]; x.placed=true;});
        next.selected=null;
        return {state:next,events:[{type:"netSetupCorrupt",player:p}]};
      }
      next.roster[p]=data.roster.slice(); applyRoster(p,next);
      mine.forEach((x,i)=>{ x.r=(p===1)?(ROWS+1-data.pos[i][0]):data.pos[i][0]; x.c=data.pos[i][1]; x.placed=true; });
      next.selected=null;                                              // setupAuto 와 같은 자리 정리 (배치 적용은 선택을 남기지 않는다)
      return {state:next,events:[]};
    }
    /* #245 경기 개시: 배치가 끝난 판을 플레이 단계로 올리고 **무작위 선공**(rand 1회)을 뽑아 지표에 남긴 뒤
       첫 턴 초기화(startTurnState)까지 한 번에 끝낸다. 종전에는 ui.js beginPlay() 가 S.phase·S.current·
       metrics.firstPlayer 를 직접 쓰고 startTurn() 이 다시 Object.assign 으로 얹었다 — 같은 경기 시작이
       커밋 경계를 두 번 우회했다. 표시(선공 로그·턴 배너·BT 고지·핫시트 넘김·렌더·AI 스케줄)는 playBegan 이벤트다. */
    case "beginPlay": {
      const current=Math.floor(rand()*2);                       // 무작위 선공 (Q6 확정) — 난수 소비 1회, 종전과 같은 자리
      const metrics=Object.assign({},state.metrics,{firstPlayer:current,byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
      const started=startTurnState(Object.assign({},state,{phase:"play",current,metrics},state.eco?{eco:Object.assign({},state.eco,{shop:null})}:{})); // #236: 시작 상점은 배치와 함께 끝난다
      return {state:started.state,events:[{type:"playBegan",player:current,bt:started.bt}]};
    }
    /* #245 턴 시작 초기화만 따로 — 종전 startTurn() 래퍼가 startTurnState 의 결과를 Object.assign 으로 S 에 직접 얹던 자리다.
       같은 상태 계산(startTurnState)을 쓰고 표시는 turnStarted 이벤트로만 나간다. */
    case "startTurn": { const r=startTurnState(state); return {state:r.state,events:[{type:"turnStarted",bt:r.bt}]}; }
    /* #245 버닝타임 배너 예약 소비 — 표시 전용 래치이지만 규칙 상태의 칸이라 같은 commit 경계를 지난다
       (표시 계층이 S 를 직접 쓰지 않는다). 예약은 startTurnState 가 세우고 여기서만 내린다. */
    case "btBannerShown":
      return state.btBannerDue?{state:Object.assign({},state,{btBannerDue:false}),events:[]}:{state,events:[]};
    /* #245 강제 전투 대상 비우기 — AI 가 이행할 수 없는 조합(대상이 사라진 뒤 남은 표식)에서 쓰는 방어 경로.
       종전에는 ai.js 가 S.forcedTargets 를 직접 비웠다. 판정은 부르는 쪽이 이미 했고 여기는 그 한 칸만 지운다. */
    case "forcedClear":
      return (state.forcedTargets&&state.forcedTargets.length)?{state:Object.assign({},state,{forcedTargets:[]}),events:[]}:{state,events:[]};
    /* #245 Saturn REVISE(M3) 전투 개시 — 강제 전투 표식 회수와 그 지표는 **reducer 안에서** 순수하게 끝난다.
       나머지 개시 실행(상황 문구·회복 자세 해제·폭탄/함정 갈래·출전 선택·라운드 시작)은 battleBegan 효과가 맡는다. */
    case "battleStart": {
      if(!Number.isInteger(action.attId)||!Number.isInteger(action.defId)||action.attId===action.defId) return null; // #245 M4: 조작된·손상된 프레임의 형태 검사
      const att=state.pieces.find(x=>x.id===action.attId), def=state.pieces.find(x=>x.id===action.defId);
      if(!att||!def||att===def) return null;
      /* #245 Saturn REVISE(M4) 신뢰 경계: 개시 대상은 **이 보드에 실제로 서 있는 서로 다른 편의 인접한 두 말**이어야 하고,
         플레이 중이면서 다른 전투가 열려 있지 않아야 한다. 종전 initBattle 은 넘어온 말을 그대로 믿고 곧장
         alive·immobile·battlesUsed 를 고쳤다 — 규칙 게이트를 지나지 않은 호출(늦은 콜백·재생 프레임·조작된 입력)이
         제거된 말, 이 보드에 없는 복제 말, 보드 반대편에 있는 말로도 전투를 열 수 있었다.
         접촉은 전투의 전제이므로 여기서 본다. */
      if(!movablePiece(att,state)||!movablePiece(def,state)) return null;
      if(att.owner===def.owner||!adj(att,def)) return null;
      /* #245 Saturn REVISE: 보류 중인 출전 선택(entryPick)도 **이미 열린 전투**다 — 그 자리에 다른 전투를 겹쳐 열면
         늦게 돌아온 옛 출전 답(battleEntryGo)이 살아 있는 전투를 갈아치운다. 도망 교환과 같은 이유로 여기서 막는다. */
      if(state.phase!=="play"||state.battle||state.fleePick||state.entryPick) return null; // 도망 교환·보류 출전 선택이 열려 있는 동안에는 새 전투를 열지 않는다
      const forced=!!(state.forcedTargets&&state.forcedTargets.length&&att===state.movedPiece&&state.forcedTargets.includes(def.id)); // T1: 강제 이행
      /* #245 Saturn REVISE 신뢰 경계 2차: 세부 합법성도 **여기서** 본다 — 종전에는 부르는 쪽(클릭 경로·AI)의
         canBattle·forcedPickOk 에 맡겨 두어, 그 게이트를 지나지 않은 호출(늦은 콜백·재생 프레임·조작된 입력)이
         남의 차례·세 번째 전투·강제 표식 밖 대상으로 전투를 열 수 있었다. 판정은 같은 두 함수를 **이 상태로**
         돌려 쓰므로 규칙이 두 벌이 되지 않고, 강제 접촉의 폭탄 갈래(forcedPickOk 와 같은 분기)도 그대로 남는다. */
      if(!(forced&&att.type==="bomb"?contactEligible(att,def,state):canBattle(att,def,state))) return null;
      if(!forced) return {state,events:[{type:"battleBegan",attId:att.id,defId:def.id}]};
      const metrics=Object.assign({},state.metrics,{byPlayer:state.metrics.byPlayer.map(x=>Object.assign({},x))});
      const next=Object.assign({},state,{forcedTargets:[],metrics});
      met(att.owner,"forcedBattles",1,next);
      return {state:next,events:[{type:"battleBegan",attId:att.id,defId:def.id}]};
    }
    /* ===== #245 Saturn REVISE(M1·M3) 출전 선택 — 상태로 남는 보류 결정 =====
       종전에는 modal 버튼이 든 **콜백 사슬**이 전투 개시를 이어받아, 화면이 없으면 규칙이 멈추고 Core 가
       표시 계층의 콜백에 의존했다. 이제 단계가 state.entryPick 에 남고 답은 직렬화 가능한 액션으로 들어온다:
       battleEntryBegin → (A 선택) → (D 선택) → reveal → battleEntryGo → battleEntryStart 이벤트가 전투를 연다.
       예비(포획 하수인) 소모도 여기서 순수하게 일어난다 — 복제본에 얹고 reserve 를 비운다. */
    case "battleEntryBegin": {
      if(state.entryPick||state.battle) return null;                          // 이미 열린 보류 결정·진행 중 전투에는 겹쳐 열지 않는다
      const att=state.pieces.find(x=>x.id===action.attId), def=state.pieces.find(x=>x.id===action.defId);
      if(!att||!def) return null;
      return {state:Object.assign({},state,{entryPick:{attId:att.id,defId:def.id,stage:"A",A:null,D:null}}),
              events:[{type:"battleEntryStep"}]};
    }
    case "battleEntryPick": {
      const EP=state.entryPick;
      if(!EP||(EP.stage!=="A"&&EP.stage!=="D")) return null;                  // 늦은·중복 응답은 조용히 거부된다 (단계가 이미 지나갔다)
      if(action.side!==undefined&&action.side!==EP.stage) return null;        // 다른 단계를 겨냥한 응답도 받지 않는다
      if(action.what!=="body"&&action.what!=="cap"&&action.what!=="bag") return null;
      const piece=state.pieces.find(x=>x.id===(EP.stage==="A"?EP.attId:EP.defId));
      if(!piece) return null;
      const ep=Object.assign({},EP); ep[EP.stage]=action.what; ep.stage=(EP.stage==="A")?"D":"reveal";
      const next=Object.assign({},state,{entryPick:ep});
      if(action.what==="bag"){ // #236 (7.5): 왕·동료의 가방 대리 출전 — 가방 말(일반·전설·포획) 1마리
        if(!state.eco||(piece.type!=="king"&&piece.type!=="ally")||!state.eco.bag[piece.owner].some(u=>u.uid===action.uid)) return null;
        ep[EP.stage==="A"?"aU":"dU"]=action.uid;
        return {state:next,events:[{type:"battleEntryStep"}]};
      }
      const res=(!piece.cap&&state.reserve[piece.owner])?state.reserve[piece.owner]:null;
      if(action.what==="cap"&&res){                                           // 예비를 꺼내 쓰는 유일한 자리 — 꺼낸 뒤 예비 칸은 빈다
        const worn=Object.assign({},piece,{cap:res});
        next.pieces=state.pieces.map(x=>x===piece?worn:x);
        next.reserve=state.reserve.slice(); next.reserve[piece.owner]=null;
      }
      else if(action.what==="cap"&&!piece.cap) return null;                   // 낼 수 있는 대리가 없다 — 그 선택은 성립하지 않는다
      return {state:next,events:[{type:"battleEntryStep"}]};
    }
    case "battleEntryGo": {
      const EP=state.entryPick;
      /* 늦은·중복 답(stage 가 이미 지나갔다)뿐 아니라 **끝난 경기**와 **그 사이 열린 전투**도 여기서 거부한다 —
         그러지 않으면 옛 보류 결정이 살아 있는 전투를 갈아치우거나 종료된 경기에서 전투를 다시 연다. */
      if(!EP||EP.stage!=="reveal"||state.battle||state.phase!=="play") return null;
      const att=state.pieces.find(x=>x.id===EP.attId), def=state.pieces.find(x=>x.id===EP.defId);
      if(!att||!def) return {state:Object.assign({},state,{entryPick:null}),events:[]};
      const a2=Object.assign({},att,{revealed:true}), d2=Object.assign({},def,{revealed:true}); // 출전 공개
      const next=Object.assign({},state,{entryPick:null,pieces:state.pieces.map(x=>x===att?a2:(x===def?d2:x))});
      return {state:next,events:[{type:"battleEntryStart",attId:EP.attId,defId:EP.defId,A:EP.A,D:EP.D,aU:EP.aU,dU:EP.dU}]};
    }
    case "battleEntryAbort":
      return state.entryPick?{state:Object.assign({},state,{entryPick:null}),events:[]}:{state,events:[]};
    /* #245 탐색 완료 래치 — 완료 토큰을 반 칸 올려 같은 토큰의 늦은 콜백을 걸러낸다 (분리 전 원본과 같은 값).
       규칙 판정·난수에는 쓰이지 않는 표시 순번이지만 규칙 상태의 칸이므로 같은 commit 경계를 지난다. */
    case "searchEndLatch": {
      /* #245 Saturn REVISE(M3): 늦은 재개를 거르는 대조는 **액션이 들고 온 값**으로 여기서 한다 (종전에는 표시 계층의
         클로저가 들고 있었다). 새 게임은 searchEndSeq 가 없어지므로 첫 조건이 그대로 잡는다. */
      if(state.searchEndSeq!==action.seq) return {state,events:[]};
      if(action.turn!==undefined&&action.turn!==state.turnCount) return {state,events:[]};
      if(action.cur!==undefined&&action.cur!==state.current) return {state,events:[]};
      return {state:Object.assign({},state,{searchEndSeq:action.seq+0.5}),events:[{type:"searchEndLatched"}]};
    }
    /* #245 Saturn REVISE(M3) 도망 성공 종료 연출이 끝난 자리 — 후방 말 교환 화면은 규칙 상태(S.fleePick)를 열므로 Core 가 연다 */
    case "fleeSwapResume":
      return {state,events:[{type:"fleeSwapPromptRun",pieceId:action.pieceId,oppId:action.oppId}]};
    /* #245 Saturn REVISE(M3): 예약·카운트다운 액션은 **전투원 객체를 싣지 않는다** — 의미 있는 자리(side)만 싣고,
       reducer 가 그 자리의 살아 있는 전투원을 상태에서 찾아 대기열을 고친다. 종전에는 action.f 로 건네진 남의 객체를
       reducer 가 그 자리에서 줄였다(독립 probe 가 roundsLeft 2 → 1 을 실측했다) — 액션이 상태를 우회해 들어오는 통로였다.
       전투원은 복제하지 않는다: #233 의 run 훅·execSlot·resolveHit 이 이 객체 정체성을 붙잡고 있기 때문이다(계약 그대로).
       실행 훅은 여기서 돌지 않는다 — 대기열이 커밋된 **뒤** delayedFired 효과에서만 돈다. */
    case "delaySchedule": {
      const f=delayFighterOf(state,action.side); if(!f) return {state,events:[]};
      f.pendingFx=f.pendingFx||[];
      f.pendingFx.push({roundsLeft:action.delayRounds,tag:action.tag!==undefined?action.tag:null,run:action.run});
      return {state,events:[]};
    }
    case "delayTick": {
      const f=delayFighterOf(state,action.side);
      if(!f||!f.pendingFx||!f.pendingFx.length) return {state,events:[]};
      const keep=[],fired=[];
      for(const ev of f.pendingFx){ ev.roundsLeft--; if(ev.roundsLeft<=0) fired.push(ev); else keep.push(ev); }
      /* 남은 목록은 **발동 전에** 확정한다. 종전은 콜백을 먼저 돌리고 끝난 뒤에 그 목록을 대입해,
         발동한 효과가 전투를 끝내 resetAfter 가 이미 비운 대기열을 다시 살려 놓았다(4.6 "전투가 끝나면 취소" 위반). */
      f.pendingFx=keep;
      return {state,events:fired.length?[{type:"delayedFired",side:action.side,fired}]:[]};
    }
    default: return null;
  }
}
/* #121 계약 3 · #236 전투 버프 적용 — 버프 회계의 단일 원천은 전투 인스턴스(B.buffA/B.buffD)다 */
function battleBuffApply(B,side,f,key){
  if(side==="A") B.buffA=key; else B.buffD=key;
  if(key==="power") f.powerBuff=true;
  else if(key==="escape") f.fleeBoost=true;
  else B.maxRounds=BAL.buffTimeRounds;               // 전투 인스턴스 값만 바꾼다 (BAL.maxRounds 전역 불변)
  B.menu=null;
  bmsg(`${BUFFS[key].ko} — ${fighterName(side)}에게 적용!`,{flash:key==="power"?"buff":"guard",st:stFx(side,f)},{key:"itemFx"},B);
  if(key==="time") bmsg(`🧭 이 전투는 ${BAL.buffTimeRounds}라운드까지 — 사신의 낫은 발동할 수 없다.`,null,null,B);
}
/* #129 계약 7 탐색 완료 **상태** — recruit 해제와 완료 토큰 발급까지다. 결과 연출·토스트·턴 종료 재평가는
   searchDone 이벤트가 표시 계층(searchFinalizeFx)으로 넘긴다. 쓰지 않은 재고·이벤트 소모는 되돌리지 않는다. */
function searchDoneResult(state,before,owner,title,sub,fxKey,tut){
  const next=Object.assign({},state,{recruit:null,searchEndSeq:(state.searchEndSeq||0)+1});
  return {state:next,events:before.concat([{type:"searchDone",owner,title,sub,fxKey,tut,seq:next.searchEndSeq}])};
}
/* 반환: Core 가 맡지 않은 액션이면 false, 맡았으면 커밋된 결과({state,events}) — 호출처는 종전처럼 truthy 검사만 하면 되고,
   결과의 세부 판정(예: 스왑이 실제로 일어났는지)이 필요한 래퍼만 events 를 읽는다. */
/** @param {ReducerAction} action */
function dispatchCoreAction(action){
  const result=reduceCoreAction(S,resolveCoreAction(S,action));
  if(!result) return false;
  commitCoreState(result.state,result.events,result.replaceBoard);
  runCoreEvents(result.events);
  aiActedNote(action,result);
  return result;
}
/* #245 Saturn REVISE(M2): AI 가 고른 행동의 "🤖 …" 기록·안내는 **Core 가** 낸다 — 어댑터는 로그도 토스트도 쓰지 않는다.
   액션이 든 origin 표식만 보고, 그 행동이 실제로 받아들여진 뒤 **맨 마지막에** 한 번 낸다 (종전 ai.js 의 순서 그대로:
   doMove/doSearch/doHeal/doTeleportSwap 이 돌아온 다음 줄이었다). 토스트 유무도 종전 호출처와 같다 —
   이동은 언제나, 회복은 5급 경로만(action.toast), 탐색·텔레포트는 기록만. */
const AI_ACT_MSG={move:"🤖 AI 이동",search:"🤖 AI 탐색 행동",heal:"🤖 AI 회복 행동",teleSwap:"🤖 AI 주 행동"};
function aiActedNote(action,result){
  if(!action||action.origin!=="ai") return;
  const msg=AI_ACT_MSG[action.t]; if(!msg) return;
  if(action.t==="teleSwap"&&!(result.events[0]&&result.events[0].type==="teleSwapped")) return; // 차단된 스왑은 알리지 않는다 (종전 doTeleportSwap 반환 계약)
  addLog(msg,"ai");
  if(action.t==="move"||(action.t==="heal"&&action.toast)) emitToast(msg);
}
/** #245 Saturn REVISE(M3): 이벤트 소비의 **소유자는 Core** 다. 종전에는 표시 계층(applyUiEvents)이 목록을 돌며
    규칙 실행 이벤트를 applyCoreEffects 로 넘겼기 때문에, 화면이 없으면 규칙 실행 자체가 일어나지 않았다.
    이제 dispatch 안에서 Core 가 같은 목록을 같은 순서로 지나며 규칙을 먼저 실행하고, 규칙이 아닌 이벤트만
    포트로 흘려보낸다 — 한 줄기 순서(규칙·표시가 섞인 그대로)는 그대로이고 화면 의존만 사라진다.
    @param {CoreEvent[]} events */
function runCoreEvents(events){
  for(const event of events||[]){
    if(applyCoreEffects(event)) continue; // 규칙 실행 이벤트는 Core 가 소유한다 (순서는 한 줄기 그대로)
    UI_PORT.event(event);
  }
}
/** #245 Core 가 reducer 밖(전투 실행 엔진·레거시 경로)에서 내는 이벤트 한 건 — reducer 가 돌려주는 목록과
    **같은 계약·같은 소비기**를 쓴다. 동기 호출이라 종전 직접 호출과 순서가 같다.
    @param {CoreEvent} event */
function emitCore(event){ runCoreEvents([event]); }
/** #245 Saturn REVISE(M2): 규칙을 잇는 다음 액션은 **Core 가 소유한다**. 표시 계층이 연출 뒤로 미루겠다고 하면
    (defer→true) 그쪽이 같은 액션을 되돌려 보내고, 미루지 않으면(기본값 — 화면 없는 런타임) 여기서 그 자리에서
    실행한다. 종전에는 이 두 자리가 whenIdle·battleEndFx.resume 이벤트로만 나가서, ui.js 가 없으면 도망 교환과
    탐색 완료 래치가 통째로 멈췄다. 경계를 건너는 값은 직렬화 가능한 Core 액션 하나뿐이다.
    @param {ReducerAction} action */
function resumeCoreAction(action){ if(!UI_PORT.defer(action)) dispatchCoreAction(action); }
/* #245 왕 끝줄 도달 판정의 단일 원본 — 레거시 checkKingReach() 와 reducer(move·teleSwap)가 같은 한 줄을 본다.
   "살아 있는 어느 왕이든 상대 끝줄에 서 있는가" 라는 종전 의미를 그대로 유지한다 (움직인 말만 보지 않는다). */
function kingAtEdge(state){
  const st=state||S;
  if(st.phase!=="play") return null;
  return alivePieces(st).find(p=>p.type==="king"&&((p.owner===0&&p.r===1)||(p.owner===1&&p.r===ROWS)))||null;
}
/* #245 끝줄 도달 승리를 reducer 안에서 끝낸다 — 왕을 공개하고 같은 reducer 의 gameOver 로 종료 전이를 이어 붙인다.
   표시 순서는 레거시와 같다: 이동/교환 이벤트(화면 갱신은 미룬다) → 경기 종료 연출(matchEnded) → 승리 문구·렌더(kingReached). */
function kingReachResult(next,reach,event){
  const king=Object.assign({},reach,{revealed:true});
  const board=Object.assign({},next,{pieces:next.pieces.map(x=>x===reach?king:x)});
  if(next.movedPiece===reach) board.movedPiece=king;
  if(next.selected===reach) board.selected=king;
  if(event.piece===reach) event.piece=king;                       // commit 의 정체성 복원이 revealed 를 되돌리지 않게 공개된 복제본을 싣는다
  if(event.pieces) event.pieces=event.pieces.map(x=>x===reach?king:x);
  const over=reduceCoreAction(board,{t:"gameOver",winner:king.owner,winType:"edge",endingBattle:ENDING_BATTLE});
  return {state:over.state,events:[event].concat(over.events,[{type:"kingReached",owner:king.owner}])};
}
/** #245 규칙 실행 이벤트의 **단일 소유자**. reducer 가 순수하게 낼 수 없는 전이(전투 슬롯 해결·다음 단계·포획 종료·
   예약 효과 발동)는 상태가 아니라 이벤트로 나오지만, 그것을 실제로 실행하는 일은 여전히 규칙이다 — 표시 계층이
   이벤트 이름을 규칙 호출로 번역하지 않는다. applyUiEvents 가 같은 목록을 같은 순서로 지나며 이 함수에 먼저 묻는다.
   반환: 이 이벤트를 규칙으로 소비했으면 true (표시 계층은 건너뛴다).
   @param {CoreEvent} event @returns {boolean} */
function applyCoreEffects(event){
  if(!event) return false;
  switch(event.type){
    case "battleSlot": execSlot(event.side,event.slot); return true;
    case "battleLegacySkill": legacySkillAct(event.side); return true;
    case "battleBasicCounter": execSlot(event.side,-1,{allowBasic:true}); return true;   // #122 도망 실패 페널티 — 상대의 무료 기본 공격 1회
    case "battleCaptured": finishByCapture(event.side); return true;
    case "battleNextPhase": nextPhase(); return true;
    /* #245 Saturn REVISE(M1·M3) 출전 선택 진행 — 보류 결정을 상태에서 다시 읽어 한 걸음 나아간다.
       화면이 이 이벤트를 보지 않아도 규칙은 여기서 끝난다. */
    case "battleEntryStep": entryStep(); return true;
    case "battleBegan": {                                                            // 전투 개시 실행 — 커밋된 보드 위에서
      const att=S.pieces.find(x=>x.id===event.attId), def=S.pieces.find(x=>x.id===event.defId);
      if(att&&def) initBattleRun(att,def);
      return true;
    }
    /* #245 Saturn REVISE(M2·M3) 규칙을 이어받던 표시 이벤트들 — 종전에는 ui.js 의 소비기가 이 호출들을 들고 있어서
       화면이 없으면 전투 개시·경기 개시·탐색 완료·도망 교환이 통째로 멈췄다. 규칙은 여기서 끝나고 화면은 남은 것만 받는다.
       순서는 한 줄기 그대로다: 이 함수가 먼저 규칙을 실행하고, 이어 같은 이벤트가 표시 계층으로 흘러간다. */
    case "fleeSwapPromptRun": {
      if(S.battle) return true;                                    // 그 사이 새 전투가 열렸다 — 옛 도망의 교환 화면은 열지 않는다 (종전 가드와 같은 조건)
      const piece=S.pieces.find(x=>x.id===event.pieceId), opp=event.oppId!=null?S.pieces.find(x=>x.id===event.oppId):null;
      emitCore({type:"closeOverlay"});
      if(piece) fleeSwapPrompt(piece,opp||null);
      return true;
    }
    case "battleFled": {
      addLog(`🏃 ${pname(event.owner)} 도망 성공 — 전투 종료 (판정·제거 없음)`,"imp"); emitToast("🏃 도망 성공 — 전투 종료");
      emitCore({type:"battleEndFx",queue:event.queue,banner:{title:"도망 성공 — 전투 종료",cls:""}});
      resumeCoreAction({t:"fleeSwapResume",pieceId:event.piece?event.piece.id:null,oppId:event.oppPiece?event.oppPiece.id:null});
      return true;
    }
    case "setupBegin": beginPlay(); return true;                                    // 배치 완료 → 경기 개시 (Core 액션)
    case "setupAiBegin": emitCore({type:"aiSetupTurn",player:1}); addLog("AI 배치 완료.","ai"); beginPlay(); return true;
    case "moved": {                                                                 // 이동 — 상태는 reducer 가 끝냈고 여기는 문구·배너·전투 개시
      if(event.healBroken) healBreakLog(event.piece);
      if(event.collision) collisionLog(event.piece);                                // 숲 충돌 문구는 종전 순서(자세 해제 다음, 강제 전투 앞)
      if(event.trace&&!isAI(event.piece.owner)){ addLog(TRACE_FOUND_MSG,"imp"); emitToast(TRACE_FOUND_MSG); }
      if(event.forced) forcedContactStart(event.piece,event.forced);
      else if(!event.kingReach) emitCore({type:"render"});                           // 끝줄 도달 승리는 matchEnded·kingReached 가 화면을 맡는다
      return true;
    }
    case "teleSwapped": {
      const pa=event.pieces[0], pb=event.pieces[1];
      if(event.healBroken[0]) healBreakLog(pa);
      if(event.healBroken[1]) healBreakLog(pb);
      if(S.mode==="pve"&&pa.owner===0){ addLog(`🌀 텔레포트 스왑: ${idLabel(0,pa)} ↔ ${idLabel(0,pb)}`,"imp"); emitToast("🌀 텔레포트 완료"); }
      else { addLog("상대가 텔레포트를 사용했습니다","imp"); emitToast("상대가 텔레포트를 사용했습니다"); } // 대상·위치 비공개 (중립 문구)
      if(!isAI(event.player)) for(let i=0;i<event.traces;i++) addLog(TRACE_FOUND_MSG,"imp"); // 도착 칸 흔적 발견 (스왑에는 토스트 없음 — 종전 그대로)
      if(event.forced) forcedContactStart(event.pieces.find(p=>p.id===event.forced.id),event.forced.list);
      else if(!event.kingReach) emitCore({type:"render"});
      return true;
    }
    case "forcedPromoted": {
      if(event.autoStart){ forcedContactStart(event.piece,event.list); return true; } // 스왑 직후 즉시 개시 — 이동·스왑과 같은 헬퍼
      const fmsg=event.list.length===1?"⚔️ 텔레포트 스왑 — 남은 말도 강제 전투! (빨간 표시 대상을 클릭)":`⚔️ 텔레포트 스왑 — 남은 말도 강제 전투! 대상 ${event.list.length}개 중 하나를 선택하세요.`;
      addLog(fmsg,"imp"); if(!isAI(event.piece.owner)) emitToast(fmsg);
      emitContactBanner(event.piece,viewerIsOwner(event.piece.owner)?"남은 말의 접촉 대상(빨간 표시)을 클릭하세요":"상대가 남은 접촉 대상을 고르고 있습니다"); // #106 4.5 "추가 접촉" 배너 (render 는 호출처가 한다)
      return true;
    }
    /* #263 T3 — 대상 선택 30초가 만료돼 서버가 대신 고른 강제 전투. 개시는 사람이 고른 경우와 **같은 헬퍼**
       (forcedContactStart→initBattle)를 쓰고, 기록만 사람의 선택과 구분되게 한 줄 남긴다. 어느 말을 뽑았는지는
       적지 않는다 — 그 자리는 이미 양측에 보이는 접촉 배너가 말하고, 비공개 정보를 새로 늘리지 않는다. */
    case "forcedAutoPick": {
      const p=S.movedPiece, def=alivePieces().find(e=>e.id===event.id);
      if(!p||!def) return true;
      addLog(`⏳ ${pname(p.owner)} 강제 전투 대상 선택 시간 초과 — 서버가 적격 대상 ${event.count}개 중 하나를 결정했습니다.`,"imp");
      forcedContactStart(p,[def.id]);
      return true;
    }
    case "recruitOpened": {                                                          // #121 계약 4·6 — recruit 상태는 reducer 가 열었다
      if(isAI(event.owner)){ emitCore({type:"aiRecruitTurn",owner:event.owner,pieceId:event.piece.id}); return true; }
      if(S.mode!=="sim"&&viewerIsOwner(event.owner)) emitCore({type:"tutHint",key:"recruit"}); // #26·#121 첫 1회 도움말
      return false;                                                                  // 화면(선택 창)은 표시 계층이 그린다
    }
    case "searchDone": {                                                             // #129 계약 7·8 — 완료 토큰·자동 종료 재평가는 규칙 상태다
      if(event.tut&&!isAI(event.owner)&&S.mode!=="sim"&&viewerIsOwner(event.owner)) emitCore({type:"tutHint",key:event.tut});
      const mine=event.owner===null||event.owner===undefined||viewerIsOwner(event.owner);
      emitCore({type:"searchBanner",owner:event.owner,mine,fxKey:event.fxKey||"itemFx",
        title:mine?event.title:"🌿 숲 이벤트",                                        // 비소유자: 종류·대상·기술을 말하지 않는 중립 문구
        sub:mine?(event.sub||""):"상대가 숲에서 무언가를 마쳤습니다."});              // 계약 9: 결과·획득 연출도 1.2초 (양측 같은 길이)
      if(mine&&event.title) emitToast(event.title+(event.sub?` · ${event.sub}`:""));  // 상세는 소유자 전용 토스트로만
      resumeCoreAction({t:"searchEndLatch",seq:event.seq,turn:S.turnCount,cur:S.current}); // 연출이 있으면 그 뒤에서, 없으면 여기서 곧장
      emitCore({type:"render"});
      return true;
    }
    case "turnEnded": {                                                              // 지표·회복 틱·turnCount·교대는 reducer 가 끝냈다
      healLogs(event.healed,humanViewer(event.player));                               // 회복 틱 로그는 **교대 전** 뷰어 시점
      if(event.simDraw){                                                              // sim 무승부 — 경기 종료 경로(전투 회계 정리 포함)
        gameOver(null,"draw");
        const dmsg=`${BAL.simMaxTurns}턴 도달 — 무승부`; addLog(dmsg,"imp"); emitToast(dmsg); emitCore({type:"render"}); return true;
      }
      if(event.shop){ // #236 정기 상점 — 보드 일시 정지. 공개 기록에는 금액·내용 없이 사실만 (7.9)
        addLog(`🛒 ${S.eco.shop.turn}턴 — 정기 상점이 열렸습니다 (양측 보너스 지급)`,"sys");
        UI_PORT.event({type:"shopOpened"});
        for(const p of [0,1]) if(isAI(p)&&S.phase==="shop") emitCore({type:"aiShopTurn",player:p}); // AI 는 즉시 처리 (공정 관측 — 자기 진열·재화만)
        return true;
      }
      startTurnMessages(event.bt);
      afterTurnStart();
      return true;
    }
    /* #236 상점 닫힘 — 정기 상점이 양측 모두 닫혔으면 미뤄 둔 다음 턴을 연다 (화면 정리가 턴 시작 표시보다 먼저) */
    case "shopClosed": {
      addLog(`🛒 ${pname(event.player)}가 상점을 이용했습니다.`,"sys"); // 중립 문구 — 무엇을 샀는지는 싣지 않는다 (7.9)
      UI_PORT.event(event);
      if(event.all){ emitCore({type:"turnStarted",bt:event.bt}); afterTurnStart(); } // 턴 시작 문구는 turnStarted 한 곳
      return true;
    }
    case "bagPickOpen": if(isAI(event.owner)){ emitCore({type:"aiBagPickTurn",owner:event.owner}); return true; } return false;
    case "bagPickDone": { // B08 해결 — 전투 뒤 멈춰 둔 진행을 잇는다 (afterBattle 의 남은 몫)
      UI_PORT.event(event);
      drainForcedQueue(false); emitCore({type:"render"});
      if(S.phase==="play"&&!S.battle&&isAI(S.current)) emitCore({type:"aiTurn",player:S.current});
      return true;
    }
    case "playBegan": {
      addLog(`무작위 선공: ${pname(event.player)}`,"sys");
      startTurnMessages(event.bt);
      afterTurnStart();
      return true;
    }
    case "kingReached": {
      const msg=`👑 왕이 적진 최후방에 도달 — ${pname(event.owner)} 승리!`;
      addLog(msg,"imp"); emitToast(msg); emitCore({type:"render"});
      return true;
    }
    case "matchEnded": {
      if(event.resignLoser!=null){
        const msg=`🏳️ ${pname(event.resignLoser)} 기권 — ${pname(event.winner)} 승리!`;
        addLog(msg,"imp"); emitToast(msg); emitCore({type:"render"});
      }
      /* Saturn M2: 남은 화면 정리(열린 전투 창·연출 큐)는 표시 계층이 하되 **결과 배너보다 먼저** 받아야 한다.
         전투 한가운데 끝난 경기(기권 등)에서 배너를 먼저 내면 그 정리의 fxReleaseAll 이 방금 재생을 시작한
         resultBanner 를 지우고, 1회 보장 플래그(matchFxDone)는 이미 소비돼 다시 나오지 않는다. */
      UI_PORT.event(event);
      if(event.banner){ const b=matchEndBanner(); if(b) emitCore({type:"matchBanner",banner:b}); } // 1회 보장 플래그는 규칙 상태다
      return true;                                                               // 표시 계층에는 위에서 이미 같은 이벤트를 한 번 넘겼다
    }
    case "healStarted": {                                                            // #106 T2 — H8: 미공개 상대 말은 중립 문구로만
      const piece=event.piece, viewer=humanViewer();
      if(S.mode==="sim"||healVisibleTo(viewer,piece)){
        const message=`🌿 ${idLabel(viewer,piece)} 회복 자세 시작 (턴마다 최대 HP ${pct(BAL.healPostPct)})`;
        addLog(message,"imp"); if(!isAI(piece.owner)) emitToast(message);
      }
      else addLog("상대가 말 회복 행동을 했습니다.","imp");                            // 미공개 말: 대상·위치 비공개
      emitCore({type:"render"});
      return true;
    }
    case "searched": {                                                                // GDD-13 4.7 · #121 계약 4.8·9: 공용 로그에 종류·보유량을 남기지 않는다
      if(event.healBroken) healBreakLog(event.piece);
      const ai=isAI(event.owner), smsg=ai?"상대가 숲 이벤트를 발생시켰습니다.":`${pname(event.owner)} 숲 이벤트 발생`;
      addLog(smsg,ai?"":"imp"); emitToast(smsg);
      return true;
    }
    case "searchRefused": if(!isAI(event.owner)) emitToast("폭탄·함정은 탐색할 수 없습니다."); return true; // #20
    case "forcedExempt":                                                              // #18 면제 사유는 조용히 누락하지 않는다
      addLog(event.message,"imp"); if(event.toast&&!isAI(event.owner)) emitToast(event.toast); return true;
    case "netSetupCorrupt": addLog(`🌐 ${pname(event.player)} 배치 데이터 손상 — 무작위 배치로 대체`,"sys"); return true;
    case "turnStarted": startTurnMessages(event.bt); return true;
    case "mainSkipped": {
      const ai=event.origin==="ai", msg=ai?"🤖 AI 주 행동 생략":`${pname(event.player)} 주 행동 생략`;
      addLog(msg,ai?"ai":"");
      if(ai&&event.toast!==false) emitToast(msg);
      emitCore({type:"render"});
      return true;
    }
    case "teleRefused":                                                               // #131 사유는 소유자 화면의 토스트로만 (공용 로그 금지)
      if(viewerIsOwner(event.player)) emitToast(event.message);
      emitCore({type:"render"}); return true;
    case "teleTrapped":                                                               // #131 함정 거부 — 공용 로그·렌더 없음
      if(viewerIsOwner(event.player)){ emitToast(event.message); if(S.mode!=="sim") emitCore({type:"tutHint",key:"teletrap"}); }
      return true;
    case "battleFleeLocked":                                                          // #234 가시 덩굴 3차 — 사유는 소유자 화면에만
      if(viewerIsOwner(event.owner)) emitToast("🌿 뿌리 고정 — 이 전투에서는 도망칠 수 없습니다"); return true;
    case "pkgPicked":                                                                 // 획득 종류는 소유자 화면에만
      emitCore({type:"closeOverlay"});
      if(event.toast&&viewerIsOwner(event.owner)) emitToast(event.toast);
      emitCore({type:"battleRedraw"}); emitCore({type:"render"}); return true;
    case "battleItemUsed": emitCore({type:"battleRedraw"}); return true;               // 행동 미소모 — 같은 행동자의 메뉴로 복귀
    case "battleEntryStart": {
      const att=S.pieces.find(x=>x.id===event.attId), def=S.pieces.find(x=>x.id===event.defId);
      if(att&&def) startRounds(att,def,entryFighter(att,event.A,event.aU),entryFighter(def,event.D,event.dU));
      return true;
    }
    /* #233 (GDD-23 4.3·4.6) 예고·지연 효과 발동 — 대기열은 reducer 가 이미 고쳤고 그 상태가 커밋된 **뒤**라
       여기서는 실행만 한다. 항목마다 다시 본다: 앞 효과가 전투를 끝냈으면 뒤는 발동하지 않는다(4.6 취소).
       checkDeath 는 run() 안에서 이미 처리된다. */
    case "delayedFired": for(const ev of event.fired) if(S.battle) ev.run(); return true;
    default: return false;
  }
}
/* #245 commit: reducer 가 순수하므로 바뀐 말은 복제본으로 돌아온다. 레거시 경로·AI·예약 콜백·테스트가 말 객체 참조를
   그대로 들고 있으므로, 복제본의 값을 같은 id 의 원본 말에 얹고 참조를 원본으로 되돌린다 — S 객체 정체성을 유지하는 것과 같은 이유다. */
/* replaceBoard: 이 액션이 보드를 **통째로 갈아끼운다**고 선언한 경우(공개 방 권위 스냅샷 재수화)에는 아래 정체성
   보존을 건너뛴다 — 옛 말 객체에 새 레코드를 얹으면 스텁이 싣지 않는 칸이 이전 스냅샷 값으로 살아남는다. */
/** @param {GameState} next @param {CoreEvent[]} events @param {boolean=} replaceBoard */
function commitCoreState(next,events,replaceBoard){
  const live=new Set(S.pieces); // 이미 S.pieces 안의 그 객체면 그대로 통과 — id 가 중복돼도 원본을 잃거나 겹치지 않는다 (거부 결과는 S.pieces 를 그대로 되돌린다)
  const canon=new Map(S.pieces.map(piece=>[piece.id,piece]));
  /* 포획 하수인(piece.cap)은 id 가 없어 canon 으로 되돌릴 수 없다 — 복제본 cap 을 그대로 얹으면 cap 참조를 들고 있던
     호출처(전투 전투원 fa/fd·AI·예약 콜백)가 낡은 객체를 계속 본다. 원본 cap 객체 정체성은 유지하고 값만 얹는다.
     cap 이 null 로 바뀌거나(해제) 없던 자리에 새로 붙는 경우(포획)는 그대로 통과 — 그때는 낡은 참조가 끊기는 게 맞다. */
  const keep=x=>{ if(replaceBoard||!x||x.tray||live.has(x)) return x; const origin=canon.get(x.id); if(!origin) return x;
    const cap=origin.cap; Object.assign(origin,x);
    if(cap&&x.cap&&x.cap!==cap) origin.cap=Object.assign(cap,x.cap);
    return origin; };
  /* Saturn REVISE: map 은 **언제나** 새 배열을 만든다. 거부된 no-op(reducer 가 받은 state 를 그대로 돌려준 결과)이나
     말을 건드리지 않은 액션에서도 그 배열이 아래 '바뀐 칸만' 대입을 통과해 S.pieces 의 정체성을 갈아 치우고,
     S.pieces 참조를 들고 있던 호출처·관찰자가 끊긴다. 실제로 바뀐 항목이 하나도 없으면 원본 배열을 그대로 쓴다. */
  const keepAll=arr=>{ const out=arr.map(keep); return out.some((x,i)=>x!==arr[i])?out:arr; };
  const norm={pieces:keepAll(next.pieces),selected:keep(next.selected),movedPiece:keep(next.movedPiece)};
  /* 보드 이벤트 칸도 말과 같은 이유로 원본 객체 정체성을 지킨다 — 레거시 경로·AI·테스트가 ev 참조를 들고 탐색을 부른다.
     Saturn REVISE: 대조는 **자리(index)** 로 한다. reducer 는 events 를 1:1 map 으로만 만들므로 자리가 곧 원본이고,
     좌표로 찾으면 같은 칸을 공유하는 항목 둘이 모두 첫 원본 하나에 얹혀 나머지 원본과 순서를 잃는다
     (칸 좌표 유일성은 genEvents 의 성질일 뿐 불변식이 강제하지 않는다 — 저장 상태·테스트 픽스처는 겹칠 수 있다).
     자리가 어긋났거나(길이 변화·재정렬) 좌표가 다르면 그대로 새 객체를 쓴다. */
  if(!replaceBoard&&next.events!==S.events) norm.events=next.events.map((e,idx)=>{ const origin=S.events[idx];
    return origin&&origin!==e&&origin.r===e.r&&origin.c===e.c?Object.assign(origin,e):e; });
  for(const event of /** @type {any[]} */(events||[])){ // healStarted·moved·teleSwapped 등 말을 실은 이벤트도 같은 정규화를 받는다 — UI 핸들러가 떨어진 복제본을 보지 않게 여기서 한 번만
    if(event.piece) event.piece=keep(event.piece);
    if(event.pieces) event.pieces=event.pieces.map(keep);
  }
  /* #245: **실제로 바뀐 칸만** 옮긴다. 같은 값을 다시 대입해도 보통은 무해하지만, 관찰자가 붙은 칸(공개 방
     서버 엔진이 `S.battle` 에 건 접근자 — 대입을 곧 '새 전투 시작'으로 읽고 battleId 와 표시 이벤트를 발급한다)에는
     무해하지 않다: 전투 커맨드처럼 전투 도중 커밋되는 액션마다 전투가 새로 열린 것처럼 보인다.
     커밋은 상태 전이를 반영하는 일이지 바뀌지 않은 값을 다시 쓰는 일이 아니다. */
  for(const key of Object.keys(next)){ const v=norm.hasOwnProperty(key)?norm[key]:next[key]; if(v!==S[key]) S[key]=v; }
}
/* ===== #236 경제 (GDD-23 2.1~2.4 · 7장) — 상점·성장·가방·원장·포획 =====
   로컬 모드(S.eco)만 탄다. 거래 하나 = Core 액션 하나이고, 검증을 모두 통과한 뒤 복제본에만 쓰므로
   전부 적용되거나(커밋) 전부 거부된다(입력 상태 그대로 + shopRefused). 중복·늦은 요청은 진열 번호(seq)·uid 로 걸러진다. */
const ECO_UNIT_KEYS=["rosterId","name","element","legend","hp","maxHp","atk","skillAtk","cdMax","def","spd","dodge","crit","statusPct",
  "shieldStartPct","grade","skills","cds","revealedSkills","revealed","paid","fresh","reaperSeal"]; // 필드 칸 ↔ 가방이 주고받는 "그 개체" (보드 자리·id 는 칸에 남는다)
function ecoKey(u){ if(!u) return null; if(u.legend){ const L=LEGEND_ROSTER.find(x=>x.key===u.legend); return L?L.id:null; } return u.rosterId||null; }
function ecoPrice(g){ return g>=5?ECO.legendPrice:g; }
/** 필드(살아 있는 하수인 칸) + 가방에서 그 종의 개체 — 동종 1마리 제한은 이 둘만 센다 (사망 칸 제외, 7.4) */
function ecoUnitOf(state,p,key){
  return state.pieces.find(x=>x.owner===p&&x.type==="minion"&&x.alive&&ecoKey(x)===key)||state.eco.bag[p].find(u=>ecoKey(u)===key)||null;
}
function ecoOwnsKey(state,p,key){ return !!ecoUnitOf(state,p,key); }
function ecoEmptyField(state,p){ return state.pieces.filter(x=>x.owner===p&&x.type==="minion"&&!ecoKey(x)); } // S01 의 아직 산 적 없는 필드 칸
function ecoAiSeat(state,p){ return (state.mode==="pve"&&p===1)||state.mode==="sim"; }
/* 진열 한 칸 (7.4) — S01: 미보유 ⭐1 · 정기: 회차 등급(낮은 60%/높은 40%), 없으면 다른 등급, 둘 다 없으면 빈칸 */
function ecoDraw(state,p,taken){
  const shop=state.eco.shop, sold=shop.sold[p];
  const ok=(k,g)=>{ if(taken.has(k)||sold.includes(k)) return false;
    const u=ecoUnitOf(state,p,k);
    if(shop.kind==="start") return !u;
    return !u||(!u.legend&&u.grade<4&&u.grade<=g); };                 // 보유 종은 내 등급 이상·최대 등급 아님만
  const pool=g=>(g===5?LEGEND_ROSTER.map(L=>L.id):ROSTER.map(r=>r.id)).filter(k=>ok(k,g));
  const [lo,hi]=shop.kind==="start"?[1,1]:ECO.tiers[shop.turn];
  const first=rand()<ECO.lowPct?lo:hi;
  for(const g of first===lo?[lo,hi]:[hi,lo]){ const c=pool(g); if(c.length) return {key:c[Math.floor(rand()*c.length)],grade:g}; }
  return null;
}
function ecoFill(state,p){ const taken=new Set(); state.eco.shop.slots[p]=[];
  for(let i=0;i<ECO.slots;i++){ const s=ecoDraw(state,p,taken); if(s) taken.add(s.key); state.eco.shop.slots[p].push(s); } }
/** 상점 열기 — 받은 상태(이미 복제된 것)에 쓴다. kind: "start"(S01) | "regular"(20·40·60·80턴) */
function ecoOpenShop(state,kind,turn){
  state.eco.shop={kind,turn,seq:[0,0],slots:[[],[]],sold:[[],[]],done:[false,false],active:null,next:null};
  for(const p of [0,1]) ecoFill(state,p);
}
/* 한 거래가 바꿀 수 있는 칸 전부를 복제한 다음 상태 — 검증이 끝난 뒤 여기에만 쓴다 */
function ecoNext(state){
  const E=state.eco, sh=E.shop;
  return Object.assign({},state,{inv:state.inv.map(x=>x.slice()),balls:state.balls.slice(),roster:state.roster.map(x=>x.slice()),pieces:state.pieces.slice(),
    eco:{coins:E.coins.slice(),bag:E.bag.map(b=>b.slice()),tickets:E.tickets.slice(),
      buffInv:E.buffInv.map(x=>Object.assign({},x)),soldHp:E.soldHp.map(x=>Object.assign({},x)),bagPick:E.bagPick,unitSeq:E.unitSeq,
      shop:sh?{kind:sh.kind,turn:sh.turn,seq:sh.seq.slice(),slots:sh.slots.map(x=>x.slice()),sold:sh.sold.map(x=>x.slice()),
        done:sh.done.slice(),active:sh.active,next:sh.next}:null}});
}
function ecoEditPiece(next,x){ const c=Object.assign({},x); next.pieces[next.pieces.indexOf(x)]=c; return c; }
function ecoSyncRoster(next,p){ next.roster[p]=next.pieces.filter(x=>x.owner===p&&x.type==="minion"&&ecoKey(x)).map(ecoKey); } // 배치·재수화 호환 — 필드 순서 그대로
function ecoMakeUnit(next,key,grade){
  const u=/** @type {any} */({uid:++next.eco.unitSeq,paid:0,fresh:false,revealed:false,reaperSeal:0,cap:null});
  const L=LEGEND_ROSTER.find(x=>x.id===key);
  if(L) applyLegend(u,L.key); else applySpecies(u,ROSTER.find(r=>r.id===key),grade);
  return u;
}
/** 거래 자격 — null 이면 통과, 아니면 거부 사유 */
function ecoGate(state,p){
  const sh=state.eco&&state.eco.shop;                                     // 온라인(종전 경제) 상태에는 경제 칸이 없다
  if(!sh||(p!==0&&p!==1)) return "상점이 열려 있지 않습니다";
  if(sh.done[p]) return "이미 완료한 상점입니다";
  if(sh.kind==="start") return state.phase==="setup"&&(p===state.setupPlayer||ecoAiSeat(state,p))?null:"상점이 열려 있지 않습니다";
  return state.phase==="shop"&&(sh.active===null||sh.active===p)?null:"상점 차례가 아닙니다";
}
/* S01 예비 재화 (2.2 · #263 2026-09-25 CJ): 진열이 6칸이고 필드도 6칸이라 **정상 흐름에서는 새로 고침 없이** 여섯을 채운다.
   남은 필수 비용 = 빈 필드 k + ⌈max(0, k − 살 수 있는 칸 v) ÷ ECO.slots⌉ × 새로 고침. 칸을 채우지 않는 지출은 지출 뒤 🪙 ≥ 이 값일 때만.
   시작 시 k=v=6 이라 필수는 곧 빈 칸 수(6)이고, 산 칸은 품절로 남아 k 와 v 가 함께 줄므로 여유가 그대로다.
   새로 고침 항은 가상의 후보 고갈(v < k)에서만 살아나는 안전장치다 — 일반 하수인 30종·6칸에서는 발생하지 않는다(Venus 검증). */
function ecoBuyable(state,p){ const sh=state.eco.shop; return sh.slots[p].findIndex(s=>ecoSlotOpen(sh,p,s)); } // 살 수 있는 첫 칸 (-1 = 없음)
/* #263: 진열 6칸은 상점이 닫힐 때까지 그대로 있다 — 살 수 있는 칸은 "칸이 있고 · 품절(내가 산 칸)이 아니고 · 판매 잠금 종이 아닌" 칸뿐이다 */
function ecoSlotOpen(sh,p,s){ return !!s&&!s.soldOut&&!sh.sold[p].includes(s.key); }
function ecoReserveNeed(state,p,v){ const sh=state.eco.shop, k=ecoEmptyField(state,p).length;
  if(v===undefined) v=sh.slots[p].filter(s=>ecoSlotOpen(sh,p,s)).length;                          // 기본 = 지금 진열에서 살 수 있는 칸 수
  return k+Math.ceil(Math.max(0,k-v)/ECO.slots)*ECO.refresh; }
function ecoReserveOk(state,p,cost,v){ return state.eco.shop.kind!=="start"||state.eco.coins[p]-cost>=ecoReserveNeed(state,p,v); }
/** @returns {CoreResult} */
function ecoRefuse(state,p,message){ return {state,events:[{type:"shopRefused",player:p,message}]}; }
/** @returns {CoreResult} */
function ecoChanged(next,p,toast){ return {state:next,events:[{type:"shopChanged",player:p,toast:toast||""}]}; }
/** 판매·B08 방출 공통 — 원장 100% 환급 + 판매 당시 HP 비율 기록 (7.6 · 7.7) */
function ecoSellUnit(next,p,u){
  next.eco.coins[p]+=u.paid||0;
  next.eco.soldHp[p][ecoKey(u)]=u.hp/u.maxHp;
}
/** @param {GameState} state @param {any} action 경제 어휘(shop*·leaderEl·bagPick) — contracts.d.ts CoreAction @returns {CoreResult} */
function ecoReduce(state,action){
  const p=action.player;
  if(action.t==="bagPick"){
    const bp=state.eco&&state.eco.bagPick;
    if(!bp||state.phase!=="bagPick"||action.token!==bp.token) return {state,events:[]};
    const bag=state.eco.bag[bp.owner], i=action.i;
    if(!Number.isInteger(i)||i<0||i>bag.length) return {state,events:[]};
    const next=ecoNext(state), out=i===bag.length?bp.unit:bag[i];
    if(i<bag.length) next.eco.bag[bp.owner][i]=bp.unit;                    // 포획한 말이 내보낸 말의 자리를 쓴다
    ecoSellUnit(next,bp.owner,out);
    next.eco.bagPick=null; next.phase="play";
    return {state:next,events:[{type:"bagPickDone",owner:bp.owner,released:out===bp.unit}]};
  }
  const bad=ecoGate(state,p); if(bad) return ecoRefuse(state,p,bad);
  const sh=state.eco.shop, start=sh.kind==="start";
  switch(action.t){
    case "shopBuy": {
      const slot=sh.slots[p][action.i];
      if(action.seq!==sh.seq[p]||!slot) return ecoRefuse(state,p,"진열이 바뀌었습니다 — 다시 골라 주세요");
      if(slot.soldOut) return ecoRefuse(state,p,"품절 — 새로 고침 전까지는 살 수 없습니다");                 // #263
      if(sh.sold[p].includes(slot.key)) return ecoRefuse(state,p,"판매함 — 이번 상점에서는 살 수 없습니다");
      const own=ecoUnitOf(state,p,slot.key);
      const grade=own?(slot.grade>own.grade?slot.grade:own.grade+1):slot.grade;
      const cost=own?(slot.grade>own.grade?ecoPrice(slot.grade)-ecoPrice(own.grade):ecoPrice(slot.grade)):ecoPrice(slot.grade);
      if(own&&(start||own.legend||grade>4)) return ecoRefuse(state,p,"더 올릴 수 없습니다");
      if(state.eco.coins[p]<cost) return ecoRefuse(state,p,"🪙 코인이 부족합니다");
      const next=ecoNext(state), empty=start?ecoEmptyField(state,p):[];
      if(!own&&!empty.length&&state.eco.bag[p].length>=ECO.bagMax) return ecoRefuse(state,p,"가방이 가득 찼습니다");
      next.eco.coins[p]-=cost;
      let msg;
      if(own){ // 차액 승급 · 동급 합성 — 그 자리 그대로, 새 최대 HP 까지 회복, 슬롯 개방 (7.1)
        const inBag=next.eco.bag[p].indexOf(own), u=inBag>=0?Object.assign({},own):ecoEditPiece(next,own);
        const seen=own.revealedSkills?own.revealedSkills.slice():[];
        applySpecies(u,ROSTER.find(r=>r.id===slot.key),grade);
        u.revealedSkills=seen; u.paid=(own.paid||0)+cost;
        if(inBag>=0) next.eco.bag[p][inBag]=u;
        msg=`⭐${own.grade} → ⭐${grade} 승급 (🪙${cost})`;
      } else if(empty.length){ // S01: 필드 6칸 먼저 (2.2)
        const f=ecoEditPiece(next,empty[0]);
        applySpecies(f,ROSTER.find(r=>r.id===slot.key),1); f.paid=cost; f.fresh=true;
        ecoSyncRoster(next,p); msg=`${f.name} → 필드`;
      } else {
        const u=ecoMakeUnit(next,slot.key,slot.grade); u.paid=cost; u.fresh=true;
        const r=state.eco.soldHp[p][slot.key]; if(r!==undefined) u.hp=Math.max(1,Math.round(u.maxHp*r)); // 판매 기록 HP 비율 (7.6)
        next.eco.bag[p].push(u); msg=`${u.name} → 가방`;
      }
      next.eco.shop.slots[p][action.i]=Object.assign({},slot,{soldOut:true}); // #263: 산 칸은 **비지 않고** 품절로 남는다 — 즉시 보충 없음, 수동 새로 고침까지 구매 불가
      next.eco.shop.seq[p]++;
      return ecoChanged(next,p,msg);
    }
    case "shopRefresh": {
      if(action.seq!==sh.seq[p]) return ecoRefuse(state,p,"진열이 바뀌었습니다 — 다시 골라 주세요");
      if(state.eco.coins[p]<ECO.refresh) return ecoRefuse(state,p,"🪙 코인이 부족합니다");
      if(!ecoReserveOk(state,p,ECO.refresh,ECO.slots)) return ecoRefuse(state,p,"필드 6칸을 채울 코인을 남겨야 합니다");
      const next=ecoNext(state); next.eco.coins[p]-=ECO.refresh; ecoFill(next,p); next.eco.shop.seq[p]++;
      return ecoChanged(next,p,"🔄 새로 고침");
    }
    case "shopGood": {
      const k=action.item;
      if(!(start?ECO.startGoods:ECO.goods).includes(k)) return ecoRefuse(state,p,"이 상점에서는 팔지 않습니다");
      if(state.eco.coins[p]<ECO.goodPrice) return ecoRefuse(state,p,"🪙 코인이 부족합니다");
      if(!ecoReserveOk(state,p,ECO.goodPrice)) return ecoRefuse(state,p,"필드 6칸을 채울 코인을 남겨야 합니다");
      const next=ecoNext(state); next.eco.coins[p]-=ECO.goodPrice;
      if(k==="ball") next.balls[p]++; else if(k==="ticket") next.eco.tickets[p]++;
      else if(BUFF_KEYS.includes(k)) next.eco.buffInv[p][k]++; else next.inv[p].push(k);
      return ecoChanged(next,p,`${GOOD_KO[k]} 구매`);
    }
    case "shopSell": {
      const i=state.eco.bag[p].findIndex(u=>u.uid===action.uid);
      if(i<0) return ecoRefuse(state,p,"가방에 없는 말입니다");
      const next=ecoNext(state), u=next.eco.bag[p].splice(i,1)[0];
      ecoSellUnit(next,p,u); next.eco.shop.sold[p].push(ecoKey(u));      // 판매한 종은 이번 오픈 동안 진열·구매 잠금
      return ecoChanged(next,p,`${u.name} 판매 (+🪙${u.paid||0})`);
    }
    case "shopSwap": {
      const fp0=state.pieces.find(x=>x.id===action.pieceId), bi=state.eco.bag[p].findIndex(u=>u.uid===action.uid);
      if(!fp0||fp0.owner!==p||fp0.type!=="minion"||!fp0.alive||!ecoKey(fp0)||bi<0) return ecoRefuse(state,p,"교체할 수 없는 칸입니다"); // 사망 칸·왕·동료·빈칸 제외
      const next=ecoNext(state), u=state.eco.bag[p][bi], fp=ecoEditPiece(next,fp0), out=/** @type {any} */({uid:++next.eco.unitSeq,cap:null});
      for(const k of ECO_UNIT_KEYS){ out[k]=fp0[k]; fp[k]=u[k]; }     // HP 는 그대로 옮겨 간다 (가방 동결 · 교체로 회복 없음)
      fp.swapMark=!fp.revealed&&(fp0.revealed||fp0.swapMark);          // 공개 칸에 비공개 말 → "상점에서 교체됨" 표식
      fp.healing=false;
      next.eco.bag[p][bi]=out;
      if(start) ecoSyncRoster(next,p);
      return ecoChanged(next,p,`${u.name} ↔ ${out.name} 교체`);
    }
    case "shopTicket": case "leaderEl": {
      const ticket=action.t==="shopTicket", lp0=state.pieces.find(x=>x.id===action.pieceId), el=action.el;
      if(ticket===start) return ecoRefuse(state,p,ticket?"티켓은 정기 상점에서만 씁니다":"속성은 시작 상점에서만 고릅니다");
      if(!lp0||lp0.owner!==p||(lp0.type!=="king"&&lp0.type!=="ally")||!lp0.alive||!V2_ELEM_ORDER.includes(el)) return ecoRefuse(state,p,"대상이 아닙니다");
      if(ticket&&(state.eco.tickets[p]<=0||el===lp0.element)) return ecoRefuse(state,p,state.eco.tickets[p]<=0?"티켓이 없습니다":"현재와 다른 속성을 고르세요");
      const next=ecoNext(state), lp=ecoEditPiece(next,lp0);
      lp.element=el; lp.leaderElChosen=true; syncLeaderSkills(lp,next);  // 스킬도 새 속성으로 · HP 유지 · 다음 전투 스냅샷부터 시너지 (7.8)
      if(ticket) next.eco.tickets[p]--;
      return ecoChanged(next,p,`${TYPE_KO[lp.type]} 속성 → ${ELEM_KO[el]}`);
    }
    case "shopDone": case "shopTimeout": {
      let next=ecoNext(state);
      if(start){
        if(action.t==="shopTimeout"){
          /* #263 (2026-09-25 CJ): **그 순간 노출된** 적격 칸을 ①부터 자동 구매한다. 자동 새로 고침은 폐지다(비용 0·횟수 0) —
             진열이 6칸이고 필드도 6칸이라 이미 산 만큼 품절이 되어도 남은 노출 칸 수 = 빈 필드 칸 수다.
             예비 재화(ecoReserveOk)가 빈 칸 수만큼의 코인을 강제하므로 하수인 외 지출 뒤에도 자동 구매 비용은 보장된다. */
          for(let n=0;n<ECO.slots&&ecoEmptyField(next,p).length;n++){
            const i=ecoBuyable(next,p); if(i<0) break;
            const r=ecoReduce(next,{t:"shopBuy",player:p,i,seq:next.eco.shop.seq[p]});
            if(r.events[0].type!=="shopChanged") break; next=r.state;
          }
        }
        if(ecoEmptyField(next,p).length) return ecoRefuse(state,p,"필드 6칸을 모두 채워야 완료할 수 있습니다");
        next.pieces=next.pieces.map(x=>x.owner===p&&(x.type==="king"||x.type==="ally"||x.fresh)?Object.assign({},x,{fresh:false}):x);
        assignLeaderElements(p,next);                                      // 고르지 않은 왕·동료만 필드 최다 왕국 (2.2 · #263 동률은 난수 1회)
      }
      next.eco.shop.done[p]=true;
      /* #263: 시간 초과로 끝난 좌석은 그 자리에서 배치까지 끝내고 곧바로 준비한다 — 배치 90초를 다시 걸지 않는다.
         직접 완료(shopDone)한 좌석은 여기서 놓지 않는다: 그 좌석만 별도의 배치 90초를 받는다.
         done[p] 를 세운 **뒤에** 놓는다 — setupAuto 는 시작 상점을 마친 좌석만 받는다. */
      if(start&&action.t==="shopTimeout"){
        const auto=reduceCoreAction(next,resolveCoreAction(next,{t:"autoPlace",player:p}));
        if(auto) next=auto.state;
      }
      /** @type {CoreEvent[]} */ const events=[{type:"shopClosed",kind:sh.kind,player:p,all:false,bt:false}];
      if(start) return {state:next,events};
      const other=1-p;
      if(!next.eco.shop.done[other]){                                          // 동시 오픈은 상대 완료까지 대기 · 핫시트 순차는 가림 뒤 다음 사람
        if(next.eco.shop.active!==null){ next.eco.shop.active=other; events.push({type:"shopHandoff",player:other}); }
        return {state:next,events};
      }
      next.pieces=next.pieces.map(x=>x.fresh?Object.assign({},x,{fresh:false}):x);
      next.eco.bag=next.eco.bag.map(b=>b.map(u=>u.fresh?Object.assign({},u,{fresh:false}):u));
      next.eco.shop=null;
      const started=startTurnState(Object.assign(next,{phase:"play",current:sh.next}));
      return {state:started.state,events:[{type:"shopClosed",kind:"regular",player:p,all:true,bt:started.bt}]};
    }
  }
  return null;
}
/* 20·40·60·80번째 턴이 끝난 자리 (2.1) — 양측 보너스 뒤 정기 상점. 핫시트는 순차(20턴 P2 먼저, 이후 교대), 그 밖은 동시 */
function ecoShopOpenState(state,me){
  const next=ecoNext(state), turn=state.turnCount;
  for(const p of [0,1]) next.eco.coins[p]+=ECO.bonus[turn];
  ecoOpenShop(next,"regular",turn);
  next.eco.shop.next=1-me;
  if(state.mode==="pvp") next.eco.shop.active=ECO.shopTurns.indexOf(turn)%2===0?1:0;
  next.phase="shop";
  return next;
}
/* 전투 포획 가능 판정 (7.7) — reducer·전투 화면·AI 가 같은 한 곳을 본다. null = 던질 수 있다 */
function ballWhy(state,side){
  const B=state.battle; if(!B) return "전투 중이 아닙니다";
  const own=(side==="A"?B.attP:B.defP).owner, oppPiece=side==="A"?B.defP:B.attP, opp=side==="A"?B.fd:B.fa;
  if(oppPiece.type!=="minion") return "상대가 하수인이 아닙니다";
  if(state.eco&&opp.legend) return "전설은 포획할 수 없습니다";
  if(state.eco&&ecoOwnsKey(state,own,ecoKey(opp))) return "이미 가진 종입니다";
  if(!(opp.hp<opp.maxHp*0.3)) return `상대 HP ${pct(opp.hp/opp.maxHp)} — 30% 미만이어야 합니다`;
  if(state.balls[own]<=0) return "몬스터볼이 없습니다";
  if(!state.eco&&state.reserve[own]) return "예비 슬롯이 차 있습니다";
  if(side==="A"?B.ballThrowA:B.ballThrowD) return "이번 라운드에 이미 던졌습니다";
  return null;
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
  addLog(tmsg,"sys"); emitToast(tmsg,"sys");
  if(!bt) return;
  const msg="🔥 버닝 타임! 직선 2칸 이동 강화 개시 (폭탄 포함·함정 제외)";
  addLog(msg,"imp"); emitToast(msg);
  if(S.mode!=="sim") emitCore({type:"tutHint",key:"burning"}); // #26 버닝 타임 첫 진입 1회 도움말 (게임 상태 무변경)
}
function startTurn(){ dispatchCoreAction({t:"startTurn"}); } // #245: 턴 시작 초기화의 단일 Core 진입점 (턴 교대는 endTurn 안에서 같은 startTurnState 를 쓴다)
function beginPlay(){ dispatchCoreAction({t:"beginPlay"}); } // #245: 경기 개시의 단일 Core 진입점 (로컬·PVE·sim·온라인 공통)
/* #106 턴 시작 공통 후처리 — 화면(기기 넘김 확인·턴 배너·렌더)은 turnReady 이벤트가 맡고,
   AI 예약은 규칙 진행이라 Core 가 직접 한다. 핫시트(offlinePvp)는 기기를 넘긴 뒤에 배너가 서고 AI 가 없다. */
function afterTurnStart(){
  const handoff=offlinePvp();
  emitCore({type:"turnReady",player:S.current,handoff});
  if(!handoff&&isAI(S.current)) emitCore({type:"aiTurn",player:S.current});
}
function pct(n){return Math.round(n*100)+"%";} // #245: 문구 조립에 쓰는 순수 포맷터 — Core 가 로그를 쓰므로 Core 소유다
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
  const seat=UI_PORT.seat();
  if(seat!==null&&(S.current!==seat||UI_PORT.replaying())) return false;
  return true;
}
function optionalBattleLeft(){ return alivePieces().some(x=>x.owner===S.current&&adjEnemies(x).some(e=>visibleTo(S.current,e)&&canBattle(x,e))); }
function anyMainActionLeft(){
  if(S.mainUsed) return false;
  const me=S.current;
  for(const p of alivePieces().filter(x=>x.owner===me)){
    if(canHeal(p)) return true;
    if(canSearchPiece(p)&&searchLegalIndex(S,p)>=0) return true; // 탐색 가능 여부는 실행 게이트와 같은 한 곳에서 본다
    if(p.type!=="trap"&&p.immobile===0) for(const [dr,dc] of [[1,0],[-1,0],[0,1],[0,-1]]) for(const k of (isBurning()?[1,2]:[1])){
      const r=p.r+dr*k, c=p.c+dc*k; if(r<1||r>ROWS||c<1||c>COLS) continue; if(canMoveTo(p,r,c)) return true; }
  }
  if(teleportAvailable(me)&&S.teleUsed[me]<BAL.teleMax&&alivePieces().filter(x=>x.owner===me&&x.immobile===0).length>=2) return true;
  return false;
}
function confirmResign(){
  if(S.phase!=="play"||isAI(S.current)) return;
  const seat=UI_PORT.seat();
  if(seat!==null&&S.current!==seat) return; // 온라인: 자기 턴에만 기권
  /* #245 Saturn REVISE(M1): Core 는 "무엇을 묻는가"만 내보낸다 — 확인 창의 HTML·버튼·취소는 ui.js 소유다.
     실린 값은 전부 숫자·문자열이다(함수 없음). turn 은 늦은 확인이 **다음 턴**을 기권시키지 않게 하는 대조값이고,
     확정은 종전처럼 사람 입력 경로({t:"resign"})로 되돌아온다. 화면이 없는 런타임에서는 아무 일도 일어나지 않는다 —
     사람 없이 기권이 일어나서는 안 되므로 Core 는 기본값을 보내지 않고 그대로 돌아간다. */
  emitCore({type:"resignPrompt",player:S.current,turn:S.turnCount});
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
    emitCore({type:"memoPick",piece:p}); return; // #11: 그 외 상대 말 클릭 — 추측 메모
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
  addLog(cmsg,"imp"); emitToast(cmsg);
}
function doMove(p,r,c){ if(p) dispatchCoreAction({t:"move",id:p.id,r,c}); } // #245: 이동의 단일 Core 진입점 (UI·AI·온라인 재생 공통) — 레거시 분기 없음
/* T1 강제 전투: 이동·텔레포트로 새로 인접한 적과는 반드시 전투 (canBattle 불가 조합 제외 — 폭탄·함정이 공격측일 때. 왕vs왕은 #122 REVISE CJ QA 6 으로 전투 대상이 됐다) */
/* #245 강제 접촉의 표시·개시 한 곳: 상태(forcedTargets·selected·contactSet)는 부르기 전에 이미 확정돼 있다.
   레거시 applyForced 와 Core 의 moved 이벤트가 같은 문구·배너·render·initBattle 순서를 쓴다 (표시 진실이 갈라지지 않게). */
function forcedContactStart(p,list){
  const def=list.length===1?alivePieces().find(e=>e.id===list[0]):null;
  if(list.length===1){
    const fmsg=p.type==="bomb"?"💣 신규 인접 — 폭탄 접촉 발동!":"⚔️ 신규 인접 — 강제 전투!";
    addLog(fmsg,"imp"); emitToast(fmsg);
    emitContactBanner(p,null); // #106 4.3.1: 접촉 배너 (상황 문구는 initBattle 이 이어 붙인다)
  }else{
    const fmsg=`⚔️ 강제 전투 — 신규 인접 대상 ${list.length}개 중 하나를 선택하세요.`;
    addLog(fmsg,"imp"); if(!isAI(p.owner)) emitToast(fmsg);
    emitContactBanner(p,viewerIsOwner(p.owner)?"여러 말과 접촉하였습니다. 어떤 말을 선택하시겠습니까?":"상대가 접촉한 말 중 하나를 고르고 있습니다"); // 상황 1 — 배너 뒤 잠금 해제, 클릭 선택. #263 T3: 이 시점에 대상 선택 30초가 새로 서고, 만료되면 서버가 적격 후보 중 균등 난수로 하나를 골라(forcedAuto) 전투를 연다
  }
  emitCore({type:"render"});
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
/* #245 텔레포트 스왑의 단일 Core 진입점 (UI 둘째 말 선택·AI·온라인 셀 재생 공통) — 레거시 분기 없음.
   반환 계약은 종전과 같다: 실제로 교환됐으면 true, 재검사 거부·사전 차단이면 false. */
function doTeleportSwap(a,b){
  const result=dispatchCoreAction({t:"teleSwap",a,b});
  return !!result&&result.events[0].type==="teleSwapped";
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
      addLog(msg,"imp"); emitToast(msg); emitCore({type:"render"}); return true;
    }
  }
  return false;
}

/* 왕 끝줄 도달 즉시 승리 (GDD-13 4.1 개정) — 왕 위치가 바뀌는 모든 지점 직후 호출 */
function checkKingReach(){
  const k=kingAtEdge(S);
  if(!k) return false;
  k.revealed=true;
  gameOver(k.owner,"edge");
  const msg=`👑 왕이 적진 최후방에 도달 — ${pname(k.owner)} 승리!`;
  addLog(msg,"imp"); emitToast(msg); emitCore({type:"render"});
  return true;
}

/* ===== 탐색·이벤트·포획 ===== */
/* #20 탐색 실행 가능 말 — GDD 역할대로 하수인·동료·왕만. 폭탄·함정은 흔적 발견·칸 점유는 가능하나 탐색 실행 불가 (cap·버프 사장 방지) */
function canSearchPiece(p){return !!p&&(p.type==="minion"||p.type==="ally"||p.type==="king");}
/* #245 탐색 합법성의 **단일 판정** — 좌표 없는 턴바·재생 프레임이든 좌표를 실은 직접 호출(doSearch·AI)이든 같은 게이트를 지난다.
   종전 두 곳(applyAction("search") 게이트 + doSearch 검사)의 합집합이다: 플레이 단계 · 자기 턴 · 주 행동 미사용 ·
   살아 있고 배치된 자기 말 · 그 말이 선 칸의 **발견된** 미소모 흔적. 통과하면 그 흔적의 **자리**를, 아니면 -1.
   Saturn REVISE ①: 종류(폭탄·함정) 검사는 여기 없다 — 호출처가 이 게이트를 먼저 통과한 시도에만 사유를 알리게 하려는 것이다.
   Saturn REVISE ②: 돌려주는 값이 객체가 아니라 자리다 — 같은 칸을 가리키는 항목이 둘이면 어느 쪽을 요청했는지가 답의 일부다.
     ei 를 실어 오면 **그 자리만** 검사하고(요청한 항목이 불법이면 -1), 없으면 상태 순서대로 첫 합법 자리를 고른다(결정적).
   상태만 읽고 아무것도 바꾸지 않는다 (난수·이벤트 없음) — resolve·reducer 양쪽이 커밋 전에 같은 답을 얻는다. */
function searchLegalIndex(state,p,ei){
  if(!p||p.tray||state.phase!=="play"||state.mainUsed||!p.alive||!p.placed||p.owner!==state.current) return -1;
  const seen=state.traces&&state.traces[state.current];
  if(!seen) return -1;
  const legal=e=>!!e&&e.r===p.r&&e.c===p.c&&!e.consumed&&seen.has(e.r+"_"+e.c);
  /* Saturn REVISE: **자리를 건네지 않은** 호출만 첫 합법 자리로 해석한다 — 판단 기준은 인수를 실었는지(arguments.length)이고
     값의 참/거짓이 아니다. 명시적으로 실은 값이면 null·undefined 도 "그 자리를 요청했다"이므로 정수·범위·합법성 검사를
     그대로 받고 어긋나면 -1 이다. 종전 `ei===undefined||ei===null` 은 조작된·손상된 프레임의 null 을 좌표 없는 프레임으로
     둔갑시켜 첫 항목을 대신 소모했다. */
  if(arguments.length<3) return state.events.findIndex(legal);
  return Number.isInteger(ei)&&ei>=0&&legal(state.events[ei])?ei:-1;
}
/* #245 탐색의 단일 Core 진입점 (UI·AI·온라인 재생 공통). 반환은 종전 계약 그대로 — 실행했으면 true, 거부면 false.
   Saturn REVISE: 호출처가 **어느 흔적을** 요청했는지까지 싣는다 (좌표가 겹치는 항목이 있어도 요청한 그 항목만 소모되게). */
function doSearch(p,ev){
  const result=dispatchCoreAction({t:"search",id:p?p.id:null,r:ev?ev.r:null,c:ev?ev.c:null,ei:ev?S.events.indexOf(ev):-1});
  return !!result&&result.events.some(e=>e.type==="searched");
}
/* #121 계약 4.2: 교체 대상은 **최초 로스터로 배치된 보드 위 하수인 6명**이다. 개인 포획(cap)·예비(reserve)는 이 화면의 대상이 아니다.
   죽은 말도 목록에 보이되 비활성이므로 살아 있는지는 걸러내지 않고 그대로 돌려준다 (순서 = 생성 순서로 안정적). */
function rosterMinions(own,state){ return (state||S).pieces.filter(x=>x.owner===own&&x.type==="minion"); }
/* #121 계약 6: 포획 수령 말 — 살아 있고 배치된 동료·왕 중 포획 슬롯(cap)이 빈 말. 탐색한 말이 하수인이어도 된다 */
function capReceivers(own,state){ return alivePieces(state).filter(x=>x.owner===own&&(x.type==="ally"||x.type==="king")&&!x.cap); }
/* 현재 recruit 상태가 아직 유효한가 — 늦은 콜백·새 게임·턴 교대·말 사망 방어 */
/** @param {GameState} [state] @returns {{R:RecruitState,p:BoardPiece,rd:any}|null} */
function recruitState(state){
  const T=state||S, R=T&&T.recruit; if(!R) return null;
  if((R.owner!==0&&R.owner!==1)||R.owner!==T.current) return null;   // 소유자는 두 플레이어 중 하나이고 지금 차례여야 한다
  if(!RECRUIT_STAGES.has(R.stage)) return null;                      // #245 Saturn REVISE: 화면에 없는 단계의 기록은 되돌림·포기 대상도 아니다
  const p=T.pieces.find(x=>x.id===R.pieceId);
  if(!p||!p.alive||!p.placed||p.owner!==R.owner) return null;        // 탐색을 연 말이 살아서 보드에 있고 그 소유자의 말이어야 한다
  /* #245 Saturn REVISE: 탐색을 **실행할 수 없는** 말(폭탄·함정)의 기록은 처음부터 성립하지 않는다 — 탐색 게이트가 그런 말을
     통과시키지 않으므로 여기 있다면 손상·조작된 기록이고, 그 말로 보상(기술 교체·포획 수령·반동 피해)을 확정할 수 없다. */
  if(!canSearchPiece(p)) return null;
  /* #245 Saturn REVISE(LOW): 토큰은 기록 **자신**도 발급 형식이어야 한다 — 비거나 손상된 토큰은 같은 값을 실은 호출과
     !== 비교를 통과해(undefined!==undefined 가 거짓) 그 기록으로 보상을 확정한다. 발급형은 "탐색한 말 id#발급번호"뿐이다. */
  const tk=R.token, h=typeof tk==="string"?tk.indexOf("#"):-1;
  if(h<0||tk.slice(0,h)!==String(R.pieceId)||!/^[1-9][0-9]*$/.test(tk.slice(h+1))) return null;
  const rd=ROSTER.find(r=>r.id===R.species);
  return rd?{R,p,rd}:null;                                           // 후보 종을 모르면 보상을 확정할 수 없다 (공용 하수인 대체 없음)
}
/* #121 계약 4·6 탐색 보상 선택 화면 — 단계별로 다시 그린다. 온라인은 modal() 래퍼가 소유자만 조작하게 하고
   버튼 인덱스를 중계하며, 비소유자에게는 원문을 **한 번도 쓰지 않고** 대기 화면만 그린다(계약 4.8 비공개).
   확정 전에는 어떤 슬롯도 건드리지 않는다 (계약 4.2-7). */
/* #245 Saturn REVISE: 탐색 보상 선택의 단계 계약 — step 은 이 단계에서만 합법이다 (back·giveup 은 어느 단계에서나 가능).
   root ─cap→ capRecv ─recv→ capMode ─mode→ 완료 / root ─skills→ skill ─skill→ target ─target→ slot ─slot→ 완료 */
const RECRUIT_STEP_STAGE={skills:"root",cap:"root",skill:"skill",target:"target",slot:"slot",recv:"capRecv",mode:"capMode"};
const RECRUIT_BACK={skill:"root",target:"skill",slot:"target",capRecv:"root",capMode:"capRecv"}; // 뒤로 갈 단계 (root 에는 뒤로가 없다)
const RECRUIT_STAGES=new Set(["root"].concat(Object.keys(RECRUIT_BACK))); // #245 recruitModal 이 그리는 단계 전부 (root + 뒤로가 있는 단계들) — RECRUIT_BACK 과 한 원본
/* #245 Saturn REVISE: **선택** step 만 0 이 아닌 자리를 받는다. 나머지(루트 두 갈래·뒤로·포기, 그리고 알 수 없는 step)의
   버튼은 UI 에 하나뿐이라 실제 sentinel 인 0 만 합법이다 — 아무 정수나 받아 주면 조작된 프레임·늦은 콜백이 같은 명령을
   다른 자리처럼 실어 이 검사를 그냥 지나간다. 선택 step 의 범위·멤버 정체성은 아래 각 분기가 목록으로 정확히 본다. */
const RECRUIT_CHOICE_STEPS=new Set(["skill","target","slot","recv","mode"]);
const CAP_MODES=["safe","risky","attack"]; // 순서 고정 — UI·AI·온라인 인덱스 중계 공용
/* 탐색 보상 선택의 단일 적용기 — 온라인은 netAction("recruit") 으로 양측이 같은 순서로 이 함수를 탄다.
   난수는 쓰지 않는다(후보 종은 탐색 시점에 고정, 제안 3종은 고정 목록) — 단 포획 판정(tryCapture)만 rand 1회를 쓴다. */
/* #129 계약 7 — 탐색 완료 전용 종료 경로.
   1) 탐색 시점에 mainUsed·consumed 는 이미 세웠지만 **필수 선택이 끝날 때까지** 턴을 종료하지 않는다 (위 분기들이 모달을 띄운 채 기다린다).
   2) 선택이 끝나면 결과·획득 연출을 1.2초(계약 8의 itemFx·captureFx) 보여 주고 **그 끝점에서** 종료 조건을 다시 평가한다.
      fxWhenIdle 은 fxIdle 의 대기 콜백 단계에서 실행되고 그 단계는 전역 autoEndCheck() **앞**이므로, 전역 autoEndGrace(1000ms)가
      걸리기 전에 이 경로가 먼저 판정한다 → "추가 1000ms 유예 없이" (계약 7-3).
   3) 선택 전투가 남아 있으면 autoEndReady() 가 null 이라 종료하지 않고 기존 전투 선택·"싸우지 않고 종료"가 그대로 유지된다 (계약 7-4).
   금지 사항 준수: 전역 closeModal() 에 endTurn 을 붙이지 않았고, 전역 BAL.fx.autoEndGrace 는 다른 경로를 위해 그대로 남겨 둔다. */
/* #121 계약 4.8·10 비공개 + #129 계약 8 — 탐색 완료 공통 출구.
   owner 전용 내용(획득 종류·습득 기술·대상 말·포획 종·수령 말)은 **소유자 화면에만** 그린다. 상대 화면에는 같은 길이의
   중립 배너를 띄운다 — 연출 시간·규칙 상태·난수는 양측 동일하고 달라지는 것은 표시 문구뿐이다(표시 계층 전용).
   온라인 비소유자는 물론 PVE 의 AI 탐색에서도 사람 화면에 종류가 새지 않는다 (viewerIsOwner 가 둘을 함께 처리한다). */
/* 같은 완료 토큰으로 두 번 발화하지 않기 위한 래치. 완료 토큰을 반 칸(+0.5) 올려 "이 토큰은 이미 소비됐다"로 표시한다 —
   분리 전 원본과 같은 값·같은 경로다(#245 기준선 동등성). 다음 탐색은 그 위에서 +1 을 올리므로 완료마다 1.5 씩 오른다.
   새 게임은 newGame 이 S 를 새 객체로 갈아끼워 다시 1 부터 시작하므로 앞 게임의 래치와 겹치지 않는다
   (프로세스 전역 숫자였을 때 묻혔던 회귀는 그 전역 때문이지 이 칸 때문이 아니다).
   규칙 상태이므로 쓰기는 Core 액션 하나(searchEndLatch)를 지난다 — 표시 계층이 S 를 직접 쓰지 않는다. */
/* #121 계약 6 숲 포획 — 종전(#20)은 속성만 무작위이고 수치는 공용 100/20/30·표준형 템플릿이었다. 이제 **ROSTER 20종 균등**으로
   뽑힌 종의 HP·최대 HP·ATK·기술 수치·CD·4기술·아트 정체를 **그대로** 적용한다 → HP 85~120 · ATK 18~25 의 종별 편차가 생긴다.
   · `rd` 는 doSearch 에서 **이미 고정**된 후보 종이다 (모달 재렌더·방법 변경으로 재추첨하지 않는다 — 계약 6 "후보 고정").
   · `recv` 는 포획 슬롯이 빈 동료·왕이고, `p` 는 탐색을 실행한 말이다. **공격 포획 실패 반동은 p** 가 받는다 (수령 말이 아니다).
   · 기술 배열은 복사본으로 만든다 (archSkills 가 새 배열을 돌려주므로 원본 공유가 없다). cds 는 0, 공개 기록은 빈 배열.
   · 난수는 성공 판정 roll 1회뿐이다 (종 추첨은 탐색 시점에 이미 소비).
   · 전투 중 적 포획(finishByCapture → 예비)의 HP 70/최대 100·장착 기술 승계 규격은 **이번 요청 밖이라 그대로** 둔다. */
function tryCapture(p,mode,recv,rd,state){
  const st=state||S, own=p.owner, target=recv||p;
  const cost=mode==="safe"?2:1; st.balls[own]-=cost;
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
    met(own,"captures",1,st);
    return {ok:true,el:sp.element,rd:sp,recv:target};
  }
  met(own,"captureFails",1,st);
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
  emitCore({type:"fx",item:{key:"explosion",kind:"boom",dim:false,cells:hold.map(h=>[h.r,h.c]),cellCls:"fx-boom",hold}});
}
function trapFxPlay(trap,victim){
  if(Array.isArray(S.__ddFxCells)) S.__ddFxCells.push({key:"trapFx",cells:[[trap.r,trap.c],[victim.r,victim.c]]});
  emitCore({type:"fx",item:{key:"trapFx",kind:"trap",dim:false,cells:[[trap.r,trap.c],[victim.r,victim.c]],cellCls:"fx-trap",hold:[{piece:trap,r:trap.r,c:trap.c}]}});
}
/* #245 Saturn REVISE(M3): 전투 개시의 **단일 Core 진입점**. 종전에는 AI·onCell·이동/스왑 이벤트가 이 함수를 직접 불러
   forcedTargets·battlesUsed·alive·immobile·revealed 를 **어떤 dispatch 도 열리지 않은 채** 바꿨다 (Saturn 의 함정 재현).
   이제 battleStart 액션이 reducer 를 지나 강제 전투 표식·지표를 순수하게 정리하고, 남은 개시 실행은 그 dispatch 안의
   battleBegan 효과에서 일어난다 — 화면이 없어도 같은 순서로 끝난다. */
function initBattle(att,def){ return att&&def?dispatchCoreAction({t:"battleStart",attId:att.id,defId:def.id}):false; }
function initBattleRun(att,def){
  emitCore({type:"contactSituation",att,def}); // #106 4.3.1 상황 2: 6상황 문구 (강제·선택 전투 공통) → 해결
  healBreak(att); healBreak(def); // #106: 전투 참여(공격·방어·폭탄·함정)는 회복 자세 해제 — 틱보다 먼저
  if(att.type==="bomb"){ bombAttack(att,def); return; } // #106 4.4.2 폭탄 직접 접촉 발동
  if(def.type==="bomb"){
    S.battlesUsed++; met(att.owner,"battles");
    def.alive=false;
    if(att.type==="minion"){att.alive=false; met(def.owner,"bombHitsMinion"); // #20: 폭탄 소유자 기준
      addLog(`💥 폭탄 발동! 공격한 말과 폭탄이 모두 제거되었습니다.`,"imp");
      emitToast(`💥 폭탄 발동! 공격한 말과 폭탄이 모두 제거되었습니다.`);
      explosionFx([def,att]);}
    else {met(def.owner,"bombClearedByVip");
      addLog(`💥 폭탄 발동! 폭탄만 제거되고 공격한 말은 생존했습니다. (정체 비공개 유지)`,"imp");
      emitToast(`💥 폭탄 발동! 폭탄만 제거되고 공격한 말은 생존했습니다. (정체 비공개 유지)`);
      explosionFx([def]);}
    if(checkWipe()) return; // T4: 폭탄 동귀 후 전멸 판정
    afterBattle(att,false); return;
  }
  if(def.type==="trap"){
    S.battlesUsed++; met(att.owner,"battles"); met(def.owner,"trapTriggers"); // #20: 함정 발동은 함정 소유자 기준
    def.alive=false; att.immobile=2;
    def.revealed=true; att.revealed=true; // #106 T4 (CJ 최종): 함정과 걸린 말 모두 정체 공개 — 그 밖의 말은 공개 대상 비확대
    const tmsg=`🪤 함정 발동! ${idLabel(2,att)} 정체 공개 · 2턴 이동 불가 (함정 제거)`;
    addLog(tmsg,"imp"); emitToast(tmsg);
    trapFxPlay(def,att);
    afterBattle(att,false); emitCore({type:"render"}); return;
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
    const m=`💥 폭탄 접촉 발동! 폭탄과 상대 하수인이 함께 제거되었습니다.`; addLog(m,"imp"); emitToast(m);
    explosionFx([bomb,def]);
    if(checkWipe()) return;
  } else if(def.type==="ally"||def.type==="king"){
    bomb.alive=false; met(bomb.owner,"bombClearedByVip");
    const m=`💥 폭탄 접촉 발동! 상대 말이 폭탄을 제거했습니다 — 상대 말 생존 (정체 비공개 유지)`; addLog(m,"imp"); emitToast(m);
    explosionFx([bomb]);
    if(checkWipe()) return;
  } else { /* #122 REVISE(2026-09-10 CJ QA 5): #114 상황 6(밀기·양쪽 유지)을 **폐지**한다 — 폭탄 ↔ 폭탄/함정은
       그 자리에서 폭탄 접촉이 발동해 **둘 다 제거**된다 (하수인 갈래와 같은 처리). 이동할 수 있는 것은 폭탄뿐이라
       이 갈래에 오는 조합은 "움직인 폭탄 → 상대 폭탄" 과 "움직인 폭탄 → 상대 함정" 둘뿐이다.
       함정 발동(2턴 이동 불가·trapTriggers)은 일으키지 않는다 — 함정이 걸린 것이 아니라 폭탄이 터진 것이다. */
    bomb.alive=false; def.alive=false;
    const m=`💥 폭탄 접촉 발동! 폭탄과 상대 ${TYPE_KO[def.type]}이(가) 함께 제거되었습니다.`; addLog(m,"imp"); emitToast(m);
    explosionFx([bomb,def]);
    if(checkWipe()) return;
  }
  afterBattle(bomb,false); emitCore({type:"render"});
}
/* #122 REVISE(2026-09-10 CJ QA 1) — 동료↔동료 · 동료↔왕은 **밀기가 아니라 전투**다.
   폐지된 것: #114 상황 8 의 조기 밀기(vip↔vip 즉시 doPush)와 그 뒤 "양측 본체 선택 = 밀기"(Q2-b C안) 두 갈래.
   #122 REVISE(CJ QA 6)로 왕 ↔ 왕 불가침도 폐지돼 이제 동료·왕의 모든 조합이 이 함수를 탄다.
   보존된 것: 대리 출전(포획 하수인) 선택 체인 ·
   패배 결과(동료 = 동료+포획 하수인 동시 제거 / 왕 = 경기 패배) · 밀기 자체(pushResolve)는 폭탄↔폭탄·도망 후 교환에서 계속 쓴다. */
/* #245 Saturn REVISE(M1·M3): 출전 선택은 **상태로 남는 보류 결정**(S.entryPick)이고, 답은 직렬화 가능한 Core 액션
   (battleEntryPick·battleEntryGo)이다. Core 와 어댑터 사이를 오가는 값에 함수가 없다 — 이어지는 진행은 콜백이 아니라
   상태를 다시 읽는 entryStep() 이 맡으므로, 화면이 없어도 온라인 재생이어도 같은 순서가 나온다.
   보류 결정을 아무도 받지 않으면(화면 없는 런타임) Core 가 그 단계의 기본 액션을 직접 보내 진행을 끝낸다. */
/* 출전 선택 결과 → 실제 전투원 (본체 · 포획 슬롯 · #236 가방 말) */
function entryFighter(piece,what,uid){
  if(what==="cap") return piece.cap;
  if(what==="bag") return S.eco.bag[piece.owner].find(u=>u.uid===uid)||piece;
  return piece;
}
function vipChoice(att,def){ dispatchCoreAction({t:"battleEntryBegin",attId:att.id,defId:def.id}); }
/* 보류 결정의 현재 단계를 상태에서 다시 읽어 한 걸음 진행한다. 자동으로 정해지는 단계(대리 출전 대상이 아니거나 AI)는
   그 자리에서 기본 액션을 보내고, 사람이 골라야 하는 단계만 프롬프트 이벤트를 낸다. 이벤트의 handled 는 **불리언 한 칸**이다
   — 화면이 그 창을 실제로 열었는지만 말하고, 무엇을 고를지는 언제나 액션으로 되돌아온다. */
function entryStep(){
  const EP=S.entryPick; if(!EP) return;
  const att=S.pieces.find(x=>x.id===EP.attId), def=S.pieces.find(x=>x.id===EP.defId);
  if(!att||!def){ dispatchCoreAction({t:"battleEntryAbort"}); return; } // 말이 사라진 보류 결정은 조용히 거둔다
  if(EP.stage==="reveal"){
    const fa=entryFighter(att,EP.A,EP.aU), fd=entryFighter(def,EP.D,EP.dU);
    const who=(f,p)=>f===p?TYPE_KO[p.type]:f.name?"대리 "+f.name:"포획 하수인("+ELEM_KO[f.element]+")";
    // #122 REVISE(2026-09-10 CJ QA 1): 종전 Q2-b C안 "양측 본체 = 밀기"는 폐지됐다 — 본체끼리도 그대로 전투한다
    const desc=`공격: ${who(fa,att)} vs 방어: ${who(fd,def)}`;
    if(S.mode==="sim"){ addLog("출전 공개 — "+desc,"ai"); dispatchCoreAction({t:"battleEntryGo"}); return; }
    emitCore({type:"battleEntryReveal",desc});   // 보류 결정은 state.entryPick 에 그대로 남는다 — 답(battleEntryGo)은 나중에 액션으로 들어온다
    return;
  }
  const side=EP.stage, piece=side==="A"?att:def;
  if(S.eco){ // #236 (7.5): 후보 = 본체 또는 가방 말 1마리. 가방이 비면 본체 자동 출전
    const bag=S.eco.bag[piece.owner];
    if(!(piece.type==="ally"||piece.type==="king")||!bag.length){ dispatchCoreAction({t:"battleEntryPick",side,what:"body"}); return; }
    if(isAI(piece.owner)){ const u=bag.reduce((a,b)=>b.hp>a.hp?b:a); // AI: HP 가 본체보다 많은 가방 말만 대리로 (자기 정보만 — 공정 관측)
      dispatchCoreAction(u.hp>piece.hp?{t:"battleEntryPick",side,what:"bag",uid:u.uid}:{t:"battleEntryPick",side,what:"body"}); return; }
    emitCore({type:"battleEntryPrompt",side,owner:piece.owner,pieceId:piece.id,pieceType:piece.type,reserve:null,cap:null,
      bag:bag.map(u=>({uid:u.uid,name:u.name,element:u.element,grade:u.grade,hp:u.hp,maxHp:u.maxHp}))});
    return;
  }
  const res=(!piece.cap&&S.reserve[piece.owner])?S.reserve[piece.owner]:null; // #12: cap 없고 예비(포획 하수인) 있으면 대리 출전 가능
  if(!(piece.type==="ally"||piece.type==="king")||(!piece.cap&&!res)){ dispatchCoreAction({t:"battleEntryPick",side,what:"body"}); return; }
  if(isAI(piece.owner)){ dispatchCoreAction({t:"battleEntryPick",side,what:"cap"}); return; } // AI: 보유 시 항상 대리 (진짜 비공개 선택)
  const stat=x=>x?{element:x.element,hp:x.hp,maxHp:x.maxHp}:null; // 회선·화면에 그대로 실을 수 있는 값만 싣는다
  /* 사람이 골라야 하는 단계다. Core 는 여기서 **멈춘다** — 보류 결정은 state.entryPick 에 남고,
     답은 나중에 직렬화 가능한 액션(battleEntryPick)으로 들어온다. 동기 응답 약속도, Core 쪽 기본값도 없다. */
  emitCore({type:"battleEntryPrompt",side,owner:piece.owner,pieceId:piece.id,pieceType:piece.type,
            reserve:stat(res),cap:stat(piece.cap)});
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
  addLog(`🤜 밀어내기! ${PUSH_MSG}`,"imp"); emitToast(`🤜 밀어내기! ${PUSH_MSG}`);
  emitCore({type:"fx",item:{key:"pushBanner",kind:"banner",title:"밀어내기!",sub:PUSH_MSG}}); // #106 5.6 배너 "밀어내기!" + 결과 문구 (#125: pushBanner 1.2초)
  if(checkKingReach()) return true; // 왕이 실제 밀려 상대 끝줄 도달 — 승리 먼저 확정, 재배치 중단
  const stuck=adj(att,def)||adjEnemies(att).length>0||adjEnemies(def).length>0; // 숨은 말 포함 (규칙 엔진 내부 판정)
  if(stuck){
    if(relocatePair(att,def)){ met(who,"relocations");
      addLog(`🔄 말 재배치! ${RELOC_MSG}`,"imp"); emitToast(`🔄 말 재배치! ${RELOC_MSG}`);
      emitCore({type:"fx",item:{key:"pushBanner",kind:"banner",title:"🔄 말 재배치!",sub:RELOC_MSG}}); }
    else addLog("🔄 재배치할 안전한 자리가 없어 밀기 결과를 유지합니다. (이 접촉은 처리 완료)","imp"); // 승인된 예외 — 추가 제거·승패 없음
  }
  return true;
}
function doPush(att,def){ // 동료/왕 ↔ 동료/왕 접촉 (전투 1회 계산)
  S.battlesUsed++; met(att.owner,"battles");
  pushResolve(att,def);
  if(S.phase!=="play") return;
  afterBattle(att,false); emitCore({type:"render"});
}
/* ===== #235 시너지 — 왕국(속성) · 아키타입 · 전설 직접 참전 패시브. Core 소유 · 순수 함수 =====
   집계는 **전투 참전이 확정된 순간(startRounds)에 한 번** 일어나고 그 전투가 끝날 때까지 고정된다(S.battle.syn).
   전투 중에 칸이 죽거나 포획돼도 이번 전투의 수치는 움직이지 않고, 다음 전투가 바뀜 칸을 반영한다.

   필드 9칸 = 그 소유자의 하수인 6 + 왕 1 + 동료 2 중 **실제로 보드에 나간 칸**(placed)이다.
   죽은 칸도 placed 를 그대로 들고 있으므로 그 자리에서 그대로 세진다 — 이것이 "사망 · 포획 칸 동결"이다.
   가방(예비 하수인 · 포획 슬롯)은 왕국 집계에서 빠지고, 아키타입은 가방의 **전설**만 더 센다.
   전설과 무속성 칸은 왕국에 0 이다(속성이 없다). */
const SYN_FIELD_TYPES=["minion","king","ally"]; // 필드 9칸을 이루는 세 종류
/* 가방에서 대기 중인 전설 — 예비 하수인 1자리와 왕·동료의 포획 슬롯. 대리로 나가 진 전설은
   기존 전투 종료 처리가 그 자리를 비우므로 자연히 집계에서 빠진다. */
function synBagLegends(owner,state){
  const g=state||S, out=[];
  const res=g.reserve&&g.reserve[owner];
  if(res&&res.legend) out.push(res);
  for(const p of g.pieces) if(p.owner===owner&&p.cap&&p.cap.legend) out.push(p.cap);
  if(g.eco) for(const u of g.eco.bag[owner]) if(u.legend) out.push(u); // #236 가방 3칸의 전설 (8.1 ⑰)
  return out;
}
/* 스냅샷 원본 — {el:속성별 칸 수, arch:타입별 칸 수, dead:사망한 하수인·동료 칸 수}. 단계·수치는 전부 여기서 파생된다. */
function synCount(owner,state){
  const g=state||S, el={}, arch={};
  for(const k of V2_ELEM_ORDER) el[k]=0;
  for(const k of Object.keys(V2_ARCH_SYN)) arch[k]=0;
  let dead=0;
  for(const p of g.pieces){
    if(p.owner!==owner||p.placed!==true||SYN_FIELD_TYPES.indexOf(p.type)<0) continue;
    if(!p.legend&&p.element&&el[p.element]!==undefined) el[p.element]++;
    if(p.type==="minion"){ const a=archOf(p); if(a&&arch[a]!==undefined) arch[a]++; }
    if(p.alive===false&&p.type!=="king") dead++;
  }
  for(const lg of synBagLegends(owner,g)){ const a=legendArchOf(lg); if(a&&arch[a]!==undefined) arch[a]++; }
  return {el,arch,dead};
}
/* 달성 단계 색인 — -1 은 (2) 미달이다. 가장 높은 달성 단계 하나만 쓴다. */
function synKingdomStage(snap,el){
  let i=-1; const n=(snap&&snap.el&&snap.el[el])||0;
  V2_KINGDOM_STEPS.forEach((need,k)=>{ if(n>=need) i=k; });
  return i;
}
function synKingdomEffect(snap,el){ const i=(snap&&el&&V2_KINGDOM_STAGES[el])?synKingdomStage(snap,el):-1; return i<0?null:V2_KINGDOM_STAGES[el][i]; }
/* 활성화된 모든 타입 효과의 합 — 누가 받는지와 무관하게 그 원정의 집계가 정한다(참전자 전원 같은 값). */
function synArchBonus(snap){
  const out={atk:0,def:0,spd:0,dodge:0,crit:0,statusPct:0,shieldPct:0};
  for(const a of Object.keys(V2_ARCH_SYN)){
    const tbl=V2_ARCH_SYN[a], n=(snap&&snap.arch&&snap.arch[a])||0;
    if(n<V2_ARCH_STEPS[0]) continue; // 2 미만은 효과 없음
    const b=tbl[Math.min(tbl.length-1,n-V2_ARCH_STEPS[0])]; // 배열 끝 = 그 타입의 상한 단계
    for(const k of Object.keys(b)) out[k]+=b[k];
  }
  return out;
}
function synElemKinds(snap){ return V2_ELEM_ORDER.filter(el=>((snap&&snap.el&&snap.el[el])||0)>0).length; } // 필드 9칸의 서로 다른 속성 수 (마녀의 집회)
/* 용의 군주 — 달성한 왕국 중 최고 단계 1속성. 동률은 칸 수, 그래도 같으면 V2_ELEM_ORDER(불→물→번개→땅→풀). 모두 (2) 미달이면 null. */
function synDragonEl(snap){
  let best=null,bs=-1,bc=-1;
  for(const el of V2_ELEM_ORDER){
    const st=synKingdomStage(snap,el); if(st<0) continue;
    const c=snap.el[el];
    if(st>bs||(st===bs&&c>bc)){ best=el; bs=st; bc=c; }
  }
  return best;
}
/* 참전 확정 순간 1회 — 스냅샷을 고정하고 두 전투원에 전투 범위 가산칸을 넣는다.
   가산칸은 resetV2(전투 시작·종료)가 지우므로 기본 스탓은 영원히 그대로다.
   보호형 시너지 방어막은 기본 10% 층(guardStart) 다음에 **수혜자 모두 1회** 더해진다. */
function applySynergy(B){
  if(!B) return null;
  const snap={0:synCount(0,S),1:synCount(1,S)};
  B.syn=snap;
  for(const [piece,f] of [[B.attP,B.fa],[B.defP,B.fd]]){
    const own=piece.owner, s=snap[own], bon=synArchBonus(s);
    f.synAtk=bon.atk; f.synDef=bon.def; f.synSpd=bon.spd; f.synDodge=bon.dodge; f.synCrit=bon.crit; f.synStatusPct=bon.statusPct;
    /* 전설 직접 참전 패시브 — 가방 대기 전설은 여기 오지 않으므로 자연히 제외된다 */
    if(f.legend==="witch") f.synStatusPct+=Math.min(V2_LEGEND_SYN.witch.max,synElemKinds(s)*V2_LEGEND_SYN.witch.statusPct);
    if(f.legend==="reaper") f.synAtk+=Math.min(V2_LEGEND_SYN.reaper.max,s.dead*V2_LEGEND_SYN.reaper.atk);
    const el=f.legend?(f.legend==="dragon"?synDragonEl(s):null):(f.element||null); // 무속성 전설은 왕국 수혜자가 아니다 — 용만 예외
    f.synEl=el?synKingdomEffect(s,el):null;
    if(bon.shieldPct) shieldAdd(f,Math.round(f.maxHp*bon.shieldPct),"synGuard");
  }
  return snap;
}
/* #235 숫자 경계 — **소유자 전용** selector. AI · UI 는 이 한 함수로만 자기 시너지 현황을 읽는다.
   상대 칸 수 · 타입 집계는 어느 경로로도 나가지 않는다 — 서버 좌석 뷰(room.js)와 낙스텝 요약은 서버 안에만 있다.
   전투 중이면 고정된 스냅샷을, 아니면 지금 보드를 본다(다음 전투에 적용될 값). */
function synView(owner,state){
  const g=state||S; if(owner!==0&&owner!==1) return null;
  const B=g&&g.battle, snap=(B&&B.syn&&B.syn[owner])||synCount(owner,g);
  const stage={}; for(const el of V2_ELEM_ORDER) stage[el]=synKingdomStage(snap,el);
  return {el:Object.assign({},snap.el),arch:Object.assign({},snap.arch),dead:snap.dead,stage,bonus:synArchBonus(snap)};
}
/* #236 5차 E16 상점 시너지 현황 — 소유자 전용(상점 화면만 읽는다 · AI 입력 아님). 산식은 위 synCount 그대로.
   정기 상점: synView(지금 보드) + 죽은 동료 수(왕·동료 시너지 5.3 — synView.dead 는 죽은 하수인까지 센 사신용 값).
   S01: 배치 전(placed:false)이라 synView 는 0 — 필드에 산 하수인 + 속성을 고른 왕·동료만 놓였다고 보고 센다(미리보기).
   고르지 않은 왕·동료는 pending 으로 돌려준다 — 완료 때 필드 최다 속성으로 자동 배정된다(2.2). */
function ecoSynView(state,p){
  const leaders=state.pieces.filter(x=>x.owner===p&&(x.type==="king"||x.type==="ally"));
  if(state.eco.shop.kind!=="start") return Object.assign(synView(p,state),{deadAllies:leaders.filter(x=>x.type==="ally"&&!x.alive).length,pending:[]});
  const pieces=state.pieces.filter(x=>x.owner===p&&(x.type==="minion"?!!ecoKey(x):x.leaderElChosen)).map(x=>Object.assign({},x,{placed:true}));
  return Object.assign(synView(p,Object.assign({},state,{pieces})),{deadAllies:0,pending:leaders.filter(x=>!x.leaderElChosen)});
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
    /* #235 참전 확정 순간의 시너지 스냅샷 — 아래 applySynergy 가 바로 채운다. 전투가 끝날 때까지 그대로다(전투 중 사망·포획은 다음 전투부터 반영). */
    syn:null,
    buffA:null, buffD:null, maxRounds:null};
  resetBattleTemps(fa); resetBattleTemps(fd);
  applySynergy(S.battle); // #235: 기본 스탓 초기화 바로 다음 · 선턴 판정(effSpd)보다 먼저 — 시너지 속도가 1라운드 순서에 들어간다
  /* #234 REVISE 2차 CJ 결정(2026-09-17): 사신의 낫 전투를 넘는 봉인 — 이 전투원(말)이 참전할 때만 1 줄인다(필드·대리 출전 동일).
     전투 종료 초기화(resetAfter/resetBattleTemps) 대상이 아닌 말 단위 상태다 */
  for(const f of [fa,fd]) if(f.reaperSeal>0) f.reaperSeal--;
  for(const [piece,f,sd] of [[attP,fa,"A"],[defP,fd,"D"]]) // #12 일시버프: 다음 전투 개시 시 소진·전투 내내 유지
    if(piece.nextBattleBuff){piece.nextBattleBuff=false; f.atkBuff=true;
      bmsg(`✨ ${fighterName(sd)} 일시 버프 — 이번 전투 공격 +${pct(BAL.nextBuffPct)}!`);}
  S.battle.firstSide=decideFirstSide(S.battle); // #233 (GDD-23 4.4): 1라운드의 선턴을 전투 개시 시 한 번만 고정한다
  S.battle.firstSideR1=S.battle.firstSide; // #234 REVISE 4차 CJ 결정(2026-09-17): 2라운드부터의 교대 기준 = R1 선턴 측
  bmsg(`⚔️ ${fighterName("A")} vs ${fighterName("D")} — 전투 개시!`);
  emitCore({type:"battleRedraw"});
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
/** @param {GameState} [state] @returns {BattleSide} */
function actorOfPhase(state){ // #245: 다른 판정 헬퍼와 같은 선택적 말미 state 인자 규약 (기본 S) — reducer 는 자기가 받은 보드만 읽는다
  const B=(state||S).battle;
  // #233 (GDD-23 4.4): "라운드 시작 시 확정" — B.firstSide는 startRounds·nextPhase의 라운드 진입 시점에 한 번만 굳는다.
  // 스냅샷 기반 표시 경로(netSynthBattle 등)가 firstSide 없이 넘어오면 방어적으로 그 자리에서 계산한다(라이브 판정에는 쓰이지 않는다).
  const firstSide=B.firstSide||decideFirstSide(B);
  return B.phase===0 ? firstSide : (firstSide==="A"?"D":"A");
}
function stFx(side,f){ return {side,text:stIcons(f),shield:f.shield||0,max:f.maxHp}; } // #106 5.5: 상태 아이콘 + 방어막 바 값을 함께 실어 재생과 동기화
/* #245 전투 커맨드 문맥 — 전투원·차례·소유자를 **상태에서** 뽑고, 그 액션이 실어 온 **프레임**과 대조한다.
   프레임은 recruit 의 token 과 같은 역할이다: 전투 화면이 자기 렌더의 전투 인스턴스·행동자·행동 토큰을 담아 액션에 싣고
   여기서 지금 상태와 맞춰 본다 — 옛 렌더의 커맨드가 남의 차례나 다음 행동을 대신 쓰는 길을 끊는다 (#146 Saturn REVISE P1).
   **렌더 프레임(fr) 자체는 회선에 실리지 않는다** — 전투 인스턴스 객체를 직렬화할 수 없기 때문이다. 받는 쪽 전투 화면의
   진입점이 자기 렌더의 프레임을 붙여 다시 부른다(모달 중계와 같은 방식). 회선에 실리는 것은 보낸 쪽이 겨냥한 값 네 개
   (action.wire = netAction 의 bf)이고, 서버 권위 방에서는 room.js 가 그 값을 자기 battleFrame 과 대조한 뒤 좌석 엔진까지
   그대로 날라 준다(room.js _authorize · frameMatches). 봉투는 action.t 만 화이트리스트로 보므로 프로토콜은 그대로다.
   대조는 **모든** 전투 어휘에 걸린다: 행동자·행동 토큰(actSeq)은 언제나 보고, 라운드·단계는 회선 문맥(wire)이 실려 오면 언제나
   본다 — 무료 보너스 행동(가방·패키지·포획)도 예외가 아니다(행동자만 보던 종전 계약에서 올라왔다).
   strict: 행동을 소모하는 커맨드(도망·넘기기)만 — 렌더 프레임에도 라운드·단계를 걸어 그 렌더의 행동을 **정확히 한 번**만 쓰게 한다.
   #245 Saturn REVISE(MEDIUM): 여기서 **메시지 큐(B.msgQ)를 보지 않는다** — 그건 표시 계층이 소유한 재생 큐이지 규칙 상태가 아니다.
   Core 가 그걸 읽으면 화면 없는 런타임(헤드리스·서버 좌석 엔진·AI)이 연출 큐를 손으로 비워야 합법 행동을 이어갈 수 있게 되어,
   규칙이 표시 계층에 묶인다. 연출 중 입력 차단은 그대로 **경계**가 맡는다: 사람 UI 는 battleModal 의 busy(msgQ·fxLocked)로 커맨드를
   비활성화하고, 입력 단일 경로 netAction 과 __passCore/__fleeCore 진입점은 fxLocked() 에서 막고, 수신 경계 netReady 는 빈 msgQ 를
   기다리며, AI 는 fxWhenIdle 뒤에 둔다. 같은 행동을 두 번 쓰는 길은 행동 토큰(actSeq)+라운드·단계 대조가 이미 막는다. */
const BF_KEYS=["side","seq","round","phase"];
function bfShapeOk(w){ return !!w&&typeof w==="object"&&!Array.isArray(w)
  &&Object.keys(w).length===BF_KEYS.length&&BF_KEYS.every(k=>ownProp(w,k)); }
/** @returns {BattleCmdCtx|null} */
function battleCmdCtx(state,action,strict){
  const fr=action&&action.frame, B=state.battle;
  if(!fr||!B||B.phase===undefined||fr.B!==B) return null;
  const side=actorOfPhase(state); if(fr.side!==side) return null;
  /* Saturn REVISE 2차: 겨냥 문맥 대조가 **모든** 전투 어휘에 걸린다 — 종전에는 wire 가 있을 때만 봤고(선택적),
     행동 토큰·라운드·단계는 strict(도망·넘기기)에서만 봤다. 그래서 wire 없이 온 비-strict 어휘(기술·가방·포획·개봉)는
     "지금 차례인 누군가"에 그대로 묶였다.
     문맥의 출처는 둘뿐이고 **어느 쪽도 지금 상태에서 다시 짓지 않는다**:
       · action.wire — 보낸 쪽이 실어 온 겨냥 문맥(netAction 의 bf). 회선을 타고 온 어휘는 이 값뿐이고,
         수신 경계가 bf 없는 전투 프레임을 아예 큐에 넣지 않으므로 아래 폴백으로 새지 않는다.
       · fr — 그 전투 화면 **렌더 시점에 굳은** 프레임(recruit 의 token 과 같은 역할). 같은 프로세스 안의 호출자
         (사람 UI 버튼·AI·모달 중계 콜백·공개 방 좌석 엔진)에게는 이것이 곧 자기가 겨냥한 문맥이다.
     어긋난 문맥은 규칙 상태·참조·난수를 하나도 건드리지 않고 떨어진다. */
  /* Saturn REVISE 3차: 회선에서 온 문맥은 **온전하고 정확해야** 한다 — 없음·부분·배열·여분 키는 값이 맞아도 거부다
     (서버 room.js frameMatches 와 같은 판정). 여분 키를 통과시키면 조작 프레임이 네 값만 맞춰 놓고 소비자마다
     다르게 읽히는 필드를 함께 실어 보낸다. 렌더 프레임(fr)은 이 코어가 만든 것이라 대상이 아니다. */
  if(action.wire&&!bfShapeOk(action.wire)) return null;
  const w=action.wire||fr;
  if(w.side!==side||w.seq!==(B.actSeq||0)) return null;                            // 행동자 + 행동 토큰 — 이제 **모든** 전투 어휘가 지난다
  /* 라운드·단계는 actSeq 와 같은 지점(nextPhase·추가 공격 개시)에서만 움직이므로 라이브에서는 위 토큰이 이미 덮는다.
     회선 문맥에는 네 값이 다 실려 오므로 전부 대조하고(조작·재생 프레임의 자체 모순까지 잡는다), 행동을 소모하는
     커맨드(strict)에는 종전 계약 그대로 렌더 프레임에도 건다. */
  if((action.wire||strict)&&(w.round!==B.round||w.phase!==B.phase)) return null;
  const piece=side==="A"?B.attP:B.defP;
  return {B,side,oSide:side==="A"?"D":"A",f:side==="A"?B.fa:B.fd,opp:side==="A"?B.fd:B.fa,
    piece,oppPiece:side==="A"?B.defP:B.attP,ownerP:piece.owner};
}
/* #245 Saturn REVISE — 회선·재생을 타는 전투 액션이 싣는 **보낸 시점의 정체성**. 입력의 단일 경로(netAction)가 붙이고
   battleCmdCtx 가 대조한다. 전투 인스턴스 객체는 직렬화할 수 없으므로 행동자·행동 토큰·라운드·단계 값만 쓴다.
   공개 방(서버 권위)에도 **같이 싣는다**: 클라이언트는 로컬 판정 없이 의도만 보내지만, room.js 가 그 bf 를 자기
   battleFrame 과 대조해(frameMatches) 어긋나면 E_ILLEGAL_ACTION 으로 떨어뜨리고, 수락한 액션에는 bf 를 그대로
   보존해 두 좌석 엔진에 넘긴다 — 그래서 좌석 엔진도 같은 대조를 받는다. 봉투·화이트리스트는 action.t 만 보므로 그대로다. */
/** @returns {BattleWire|null} */
function battleActionFrame(state){ const st=state||S, B=st.battle;
  return B?{side:actorOfPhase(st),seq:B.actSeq||0,round:B.round,phase:B.phase}:null; }
/* #245 Saturn REVISE(M2): 같은 겨냥 문맥을 **지금 상태에서** 짓는다 — 화면 렌더가 굳혀 둔 프레임을 빌릴 수 없는
   호출자(AI·화면 없는 런타임)가 쓴다. 값은 battleActionFrame 과 같고 전투 인스턴스(B)만 더한다. */
function battleCmdFrame(state){ const st=state||S, w=battleActionFrame(st); return w?Object.assign({B:st.battle},w):null; }
/* #121 계약 2.2·3 패키지 개봉 선택 화면 — **표시 전용**이다. modal() 래퍼가 온라인 동기화를 맡으므로(소유자만 조작·
   버튼 인덱스 중계, 비소유자에게는 "상대 선택 대기 중" 마스킹) 여기서 별도 송신을 하지 않는다. 재고·선택 내용은
   소유자에게만 보인다. 개봉 자체는 난수를 쓰지 않는다 — 플레이어 선택이다 (계약 2.2 [추론]).
   취소는 아무것도 소모하지 않는다: 재고는 **확정 분기(pkgPick reducer)에서만** 움직인다. */
/* ===== 구형 속성 스킬 경로 (로스터 미적용 하수인 전용 — 레거시 테스트 호환) =====
   #245: 종전 __actCore 렌더 클로저 안에 있던 그대로다. Core 의 act 액션이 이 경로를 고르면 battleLegacySkill
   이벤트로 넘어와 커밋된 상태 위에서 실행된다 (execSlot 경로와 같은 경계). */
function legacySkillAct(side){
  const B=S.battle; if(!B) return;
  const f=side==="A"?B.fa:B.fd, opp=side==="A"?B.fd:B.fa, oSide=side==="A"?"D":"A", sp=skillParamsOf(f);
  const sus=archOf(f)==="sustain"; // T5-A(D10): 지속형은 **기본 확률 100%** 이지 판정 면제가 아니다
  const tryStatus=prob=>{ // 상태이상 부여 확률 — 그 외는 statusProb (#96: 감전은 shockProb)
    // #233 (GDD-23 3.2 💫): 스탯 상태이상 부여 확률을 %p로 가산, 상한 100%
    // #235: 지속형 시너지·마녀의 집회(synStatusPct)도 v2Apply 와 같은 자리에서 가산한다
    let p=Math.min(1,(sus?1:(prob===undefined?BAL.statusProb:prob))+(f.statusPct||0)+(f.synStatusPct||0));
    if(f.sandStormR>0) p*=0.5; // #235: 모래 폭풍 절반도 v2Apply 와 같은 순서 — 가산·상한 뒤에 곱한다
    // 지속형이 100% 그대로면 종전처럼 난수를 쓰지 않는다. 모래 폭풍이 절반으로 깎았을 때만 판정 1회를 소비한다.
    if((sus&&p>=1)||rand()<p){S.metrics.statusApplied++; return true;}
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
  v2SkillSettle(side,f,oSide,opp); if(!S.battle) return; // #235: 구형 속성 스킬도 같은 경계
  if(checkDeath()) return;
  nextPhase();
}
/* #245 도망 성공 종료 연출 — 전투 해체(자세 정리·battle=null)는 Core 의 flee 액션이 이미 끝냈고 여기는 남은
   메시지 재생·결과 배너·후방 말 교환 화면뿐이다 (#114). */
/* #106 5.6 전투 종료 연출 공통: 남은 메시지 재생 → 결과 배너(뷰어 기준 문구) → 닫기 콜백. 헤드리스는 즉시 */
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
  if(S.mode==="sim"||offlinePvp()) return {title:`${pname(w)} 승리!`,sub,cls:"match neutral"}; // 핫시트는 중립 문구 (같은 기기의 두 사람)
  return viewerIsOwner(w)?{title:"경기 승리!",sub,cls:"match win"}:{title:"경기 패배...",sub,cls:"match lose"};
}
function matchEndBanner(){ // 경기당 1회 — 이미 낸 뒤면 null (경기 기준 플래그, newGame 이 새로 만든다)
  if(!S||S.matchFxDone) return null;
  S.matchFxDone=true;
  return matchBannerOf();
}
function resultBannerOf(winP){ // 사망·판정 결과 문구: 핫시트 중립 "P1 승리!", PVE·온라인 뷰어 기준 "전투에서 승리!/패배,,,"
  /* #126: 문구·뷰어 규약은 종전 그대로이고 cls 만 연출 갈래를 고른다 — 중립(핫시트)은 금빛, 뷰어 승리는 금빛, 패배는 어두운 균열.
     전투 판정 동률은 방어자 승이라 여기 오는 결과는 언제나 승/패 둘 중 하나다 (전투 무승부 갈래를 만들지 않는다). */
  if(offlinePvp()) return {title:`${pname(winP.owner)} 승리!`,cls:"neutral"};
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
  const critP=Math.min(0.5,(f.crit||0)+(f.synCrit||0)); // #235 공격형 시너지 가산 — 종전 상한 50% 그대로
  if(hopts.critForce!==undefined) crit=hopts.critForce?true:rand()<critP; // v2Hit 경로 — 확정이면 rand 0회(종전과 같은 소비)
  else if(f.critForce&&!hopts.penalty){ crit=true; f.critForce=false; }
  else crit=rand()<critP;
  if(crit) dmg=dmg*1.5;
  if(!hopts.ignoreDef){
  const defPct=((opp.def||0)+(opp.synDef||0))/100; // #235 표준·방어형 시너지의 방어력 가산칸 — 기본 스탓(opp.def)은 그대로 둔다
  const dmgDown=Math.min(0.5,defPct+(opp.hardenPct||0)+(opp.dmgCut||0)); // ⑧ 받는 피해 감소 = 방어력+경화+"다음 피격 감소"류, 상한 50% (#241: 굴 파기는 경화 40%로 단순화 — 전용 분기 삭제)
  if(!hopts.preview) opp.mitigated=(opp.mitigated||0)+dmg*Math.min(dmgDown,defPct+(opp.hardenPct||0)); // #234 분화: 방어력·경화로 줄인 피해 총량
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
  /* #235 왕국 1판정 · 흡수 정산의 **유일한 입력**이다 — 피해 스킬이 적중했다는 사실과 그 실 HP 피해를 여기 한 곳에서 누적한다.
     회피는 위에서 이미 조기 반환했고, 해일 예고(preview)도 ⑩ 에서 반환하므로 오지 않는다.
     도망 실패 페널티 평타(hopts.penalty)는 스킬 밖 예외라 제외한다(#234 6.1). 비우는 곳은 v2SkillSettle 하나다. */
  if(!hopts.penalty) f.synHit=(f.synHit||0)+actual;
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
  const defPct=((opp.def||0)+(opp.synDef||0))/100; // #235 시너지 방어력은 반사·반격 경로에도 같이 적용된다
  const dmgDown=Math.min(0.5,defPct+(opp.hardenPct||0)+(opp.dmgCut||0)); opp.dmgCut=0;
  opp.mitigated=(opp.mitigated||0)+dmg*Math.min(dmgDown,defPct+(opp.hardenPct||0));
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
function resolveCounter(side,f,opp,oSide,pct){ return resolveTyped(side,f,opp,oSide,effAtk(f)*pct,true,"반격","🦀"); } // ④ 상성만 탄다
function instaKill(opp){ opp.shieldLayers=[]; opp.shield=0; opp.hp=0; } // 4.3 즉사 — 단계 없음, 방어막 무시
/* GDD-23 4.3 예고 피해(해일 예고 등) — 발동 시점에 일반 피해 ①~⑪을 그대로 태운다. 발동 전에 전투가 끝나면 취소된다
   (tickDelayed가 라운드 종료마다 불리고, S.battle이 이미 없으면 run()을 부르지 않는다 → 자동 취소, 4.6). */
/* tag 는 서버 락스텝 요약이 같은 라운드에 예약된 서로 다른 예고 피해를 구분하기 위한 **안정된 문자열**이다
   (기술 id 등). 콜백은 직렬화할 수 없어 서버는 [roundsLeft, tag||null] 로만 요약한다 — tag 가 없으면
   두 좌석 엔진이 갈려도 VOID 가 뜨지 않는다. #234 전까지 예고 피해 기술이 없어 호출처는 0건이고
   여기서는 계약만 완결한다 — 앞으로 예고 기술을 붙이는 호출처는 반드시 tag 를 넘겨야 한다. */
/* #245: 둘 다 Core 액션 하나로 들어간다 — #233 계약(인자·보관 형식)은 그대로고, pendingFx 를 고치는 자리는 reducer 한 곳뿐이다.
   #241: 해일 예고가 조건 표식(v2TideCheck)으로 바뀌어 atStart 분기는 삭제됐고 #233 예약 계약만 남는다(현재 예약 호출처 0).
   #245 Saturn REVISE(M3): 래퍼의 인자는 종전 그대로 **전투원 객체**지만, 액션에 실리는 것은 그 전투원이 아니라
   상태 안에서의 자리(side)다 — 액션이 상태를 우회해 남의 객체를 들고 들어오는 통로가 없다. 상태에 없는 전투원은
   가리킬 자리가 없으므로 조용한 무동작이다(대기열을 만들지 않는다). */
function delayFighterOf(state,side){ const B=state&&state.battle; return B?(side==="A"?B.fa:(side==="D"?B.fd:null)):null; }
function battleSideOf(f,state){ const B=(state||S)&&(state||S).battle; return (B&&f)?(f===B.fa?"A":(f===B.fd?"D":null)):null; }
function scheduleDelayed(f,delayRounds,run,tag){ return dispatchCoreAction({t:"delaySchedule",side:battleSideOf(f),delayRounds,run,tag}); }
function tickDelayed(f){ return dispatchCoreAction({t:"delayTick",side:battleSideOf(f)}); }
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
  if(slot<0&&f.skills&&!(opts&&opts.allowBasic)){ emitCore({type:"battleRedraw"}); return; }
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
    const tellOwner=msg=>{ try{ if(viewerIsOwner(ownerOf)) emitToast(msg); }catch(e){} };
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
    // #235: 지속형 시너지·마녀의 집회(synStatusPct)도 v2Apply 와 같은 자리에서 가산한다
    let p=Math.min(1,(prob===undefined?BAL.statusProb:prob)+(f.statusPct||0)+(f.synStatusPct||0));
    if(f.sandStormR>0) p*=0.5; // #235: 모래 폭풍 절반도 v2Apply 와 같은 순서 — 가산·상한 뒤에 곱한다
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
    const base=sk?slotPowRaw(f,sk):effAtk(f); // ⑪ 단일 반올림 — 여기서 반올림하지 않고 resolveHit 에 소수를 그대로 넘긴다
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
  /* #235: 레거시 피해 스킬(드래곤 숨결 등)도 v2 와 같은 경계를 탄다 — 비피해 기술·도망 실패 평타는 누적이 없어 무동작이다 */
  v2SkillSettle(side,f,oSide,opp); if(!S.battle) return;
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
function fighterName(sid,board){ // #245 M2: board 를 주면 그 전투를 읽는다 — 지난 전투 스냅샷 렌더가 전역 S.battle 을 갈아끼우지 않게
  const B=board||S.battle, pf=sid==="A"?B.fa:B.fd, piece=sid==="A"?B.attP:B.defP;
  return pf===piece?(piece.type==="minion"&&piece.name?piece.name:TYPE_KO[piece.type]):pf.name?"대리 "+pf.name:"포획 하수인·"+ELEM_KO[pf.element]; // #236 가방 대리는 종 이름
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
function bmsg(txt,fx,opts,to){const B=to||S.battle; if(!B) return; B.blog.push(txt); B.msgQ.push({txt,fx:fx||null,key:opts&&opts.key||null,big:!!(opts&&opts.big)});}
function addRec(side,amount){
  const B=S.battle;
  if(side==="A") B.recA=Math.min(B.fd.maxHp,B.recA+amount);
  else B.recD=Math.min(B.fa.maxHp,B.recD+amount);
}
/* 스킬 사용 1회 마무리 — 사망 → 해일 예고 검사 → (번개 꼬리) 추가 공격 단계 → 차례 전환.
   #245 Saturn REVISE(M1): 전투 상태(B.bonus·actSeq·pkgSel·menu)를 바꾸고 전투 화면을 다시 부르는 **규칙 전이**라
   Data(data.js)가 아니라 Core 가 소유한다. 문구·순서·토큰 계약은 옮기기 전과 같다. */
function finishV2(side){ if(!S.battle) return; if(checkDeath()) return; if(v2TideCheck()) return;
  const B=S.battle;
  /* #241 R1 [CJ 설계] 번개 꼬리: 턴이 넘어가지 않고 같은 전투원이 한 번 더 고른다(방식 A). nextPhase 를 부르지 않고 actSeq 만 올려
     이전 렌더의 콜백을 무효로 만든 뒤 같은 행동자의 메뉴를 다시 그린다 — 추가 공격은 두 번째 행동(L15)이다 */
  if(B.bonus&&B.bonus.side===side&&B.bonus.stage==="pending"){ B.bonus.stage="active"; B.actSeq=(B.actSeq||0)+1; B.pkgSel=null; B.menu=null; emitCore({type:"battleRedraw"}); return; } // #245 Saturn REVISE 3차: 여기도 행동 토큰이 올라가는 지점이다 — nextPhase 와 같이 열려 있던 개봉 표를 회수한다
  nextPhase(); }
function nextPhase(){
  const B=S.battle;
  /* #146 Saturn REVISE P1: 전투 행동 하나가 끝나고 차례가 넘어가는 **유일한 지점**이다.
     여기서 공유 토큰을 올려 두면 그 이전 렌더가 낸 도망·패스 콜백은 어떤 행동(일반 공격·포획 실패 포함)을
     거쳤든 전부 무효가 된다. 표시 계층이 아니라 게임 상태이므로 온라인 양측이 같은 값을 갖는다. */
  B.actSeq=(B.actSeq||0)+1;
  B.pkgSel=null; // #121: 행동·라운드가 넘어가면 열려 있던 개봉 표도 함께 만료된다 (표 자체를 회수 — 토큰 대조에만 기대지 않는다)
  if(B.bonus) v2BonusEnd(B); // #241 R1 번개 꼬리 추가 공격이 끝났다(= 번개 여우의 턴 끝) — 2·3차 ⌛ 복원 (L8)
  if(v2TideCheck()) return;  // #241 R2 매 행동 뒤 해일 예고 판정
  if(B.phase===0){B.phase=1; emitCore({type:"battleRedraw"}); return;}
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
  B.phase=0; B.firstSide=decideFirstSide(B); emitCore({type:"battleRedraw"}); // #241: 라운드 시작 훅(영구 자기장 재부여·해일 atStart) 삭제 // #233 (GDD-23 4.4): "라운드 시작 시 확정" — 이 라운드의 선턴을 여기서 한 번만 고정한다
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
    if(S.eco) S.eco.bag=S.eco.bag.map((b,i)=>i===loseP.owner?b.filter(u=>u!==loseF):b); // #236 대리 패배 — 가방 말 제거 (7.5)
    msg=`${S.eco?"대리 하수인":"포획 하수인"} 패배(${how}) — ${TYPE_KO[loseP.type]} 동시 ${loseP.type==="king"?"패배":"제거"}`; }
  if(loseP.type==="ally"){ syncOwnerLeaders(loseP.owner); } // #234 (5.3): 동료 사망 → 살아 있는 왕·동료에 🪄 칸 추가
  addLog(`⚔️ 전투 종료: ${pname(winP.owner)} 승 — ${msg}`,"imp");
  emitToast(`⚔️ 전투 종료: ${pname(winP.owner)} 승 — ${msg}`);
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
      const gmsg=`🏁 경기 종료 — ${pname(winP.owner)} 승리!`; addLog(gmsg,"imp"); emitToast(gmsg); ended=true; }
    else if(checkWipe()) ended=true; // T4: 전투 제거(대리 동시 제거 포함) 후 전멸 판정
  } finally{ ENDING_BATTLE=false; }
  if(S.eco&&!ended) ecoBattleCoins(winP.owner,loseP.owner); // #236 (7.2): 승 🪙3 · 패 🪙1 — 경기 종료면 결과에 영향 없으므로 생략
  // #106 5.6 연출: 남은 메시지 재생 → 결과 배너(전투 = 뷰어 기준 "전투에서 승리!/패배,,," · 경기 종료 = 경기 결과) → 닫힘 — 헤드리스·sim은 즉시 닫힘
  emitCore({type:"battleEndFx",queue:q,banner:(ended?matchEndBanner():null)||resultBannerOf(winP)});
  if(ended){ emitCore({type:"render"}); return; }
  afterBattle(attacker, winSide==="A"&&attacker.alive);
  emitCore({type:"render"});
}
/* 전투 종료 공통 정리 — finishBattle(승패·판정) · __fleeCore(도망 성공) · finishByCapture(적 포획) 세 경로가 모두 이 함수를 부른다.
   #121 계약 3.1: 버프 플래그(powerBuff·fleeBoost)도 여기서 지운다. 본체 출전이면 f === 말 객체라 지우지 않으면 다음 전투로 새어 나간다.
   전투 인스턴스 회계(B.buffA/B.buffD·B.maxRounds)는 S.battle 이 null 이 되면서 함께 사라지고, 쓰지 않은 패키지 재고(S.pkgs)는 보존된다. */
function resetAfter(f){resetV2(f); f.burn=0;f.burnFresh=false;f.burnBy=null;f.weaken=0;f.shield=0;f.shieldLayers=[];f.absorbed=0;f.shock=0;f.shockFresh=false;f.focusCharge=false;f.vulnMark=false;f.dmgCut=0;f.atkBuff=false;
  f.crack=0;f.crackFresh=false;f.harden=0;f.hardenFresh=false;f.hardenPct=0;f.evadeBuff=0;f.evadeBuffR=0;f.evadeBuffRFresh=false;f.dmgUpBuff=0;f.dmgUpBuffR=0;f.dmgUpBuffRFresh=false;f.critForce=false;f.dodgeForce=false;f.pendingFx=[];
  f.cd=0; // #233 (GDD-23 4.6): 전투 사이 HP만 유지 — 쿨타임(레거시 스칼라 포함)·예고 효과는 다음 전투 전에 초기화
  f.powerBuff=false;f.fleeBoost=false;}
/* #12 포획 종료: 적 하수인 즉시 제거 + S.reserve 저장 — 누적 판정 없이 전투 즉시 종료 (포획으로 승리) */
function ecoBattleCoins(w,l){ const c=S.eco.coins.slice(); c[w]+=ECO.win; c[l]+=ECO.lose; S.eco.coins=c; }
/* #236 (7.7): 전투 포획 — 상대의 등급·스킬 승계 · 최대 HP 70% · 상태·⌛ 초기화 · 원장 🪙0 · 가방 칸 (가득 차면 B08) */
function ecoCaptureFinish(side){
  const B=S.battle;
  const winP=side==="A"?B.attP:B.defP, loseP=side==="A"?B.defP:B.attP, loseSide=side==="A"?"D":"A", p=winP.owner;
  const u=ecoMakeUnit(S,ecoKey(loseP),/** @type {any} */(loseP).grade);
  u.skills=loseP.skills.slice(); u.cds=u.skills.map(()=>0); u.hp=Math.round(u.maxHp*ECO.capHpPct);
  met(p,"enemyCaptures");
  loseP.alive=false;                                                     // 포획당한 칸 = 사망 칸처럼 동결 (전멸 판정 포함)
  bmsg(`🔴 몬스터볼 적중! ${fighterName(loseSide)}를(을) 포획했다!`,{ko:loseSide},{key:"captureFx"});
  addLog(`🔴 포획 종료: ${pname(p)}가 적 하수인을 포획 — 전투 즉시 종료`,"imp");
  emitToast("🔴 포획 종료 — 적 하수인 포획!");
  resetAfter(B.fa); resetAfter(B.fd);
  const attacker=B.attP, q=B.msgQ.splice(0);
  S.battle=null;
  let ended=false;
  ENDING_BATTLE=true;
  try{ ended=checkWipe(); } finally{ ENDING_BATTLE=false; }
  emitCore({type:"battleEndFx",queue:q,banner:(ended?matchEndBanner():null)||{title:"포획 성공! 전투 종료",cls:(viewerIsOwner(p)||offlinePvp()?"cap":"cap capnot")}});
  if(ended){ emitCore({type:"render"}); return; }                       // 경기 종료 우선 — B08 없음
  ecoBattleCoins(p,loseP.owner);
  const full=S.eco.bag[p].length>=ECO.bagMax;
  if(!full) S.eco.bag=S.eco.bag.map((b,i)=>i===p?b.concat([u]):b);
  else { S.eco.bagPick={owner:p,unit:u,token:u.uid}; S.phase="bagPick"; }   // B08 — 보드가 잠기고 소유자 선택을 기다린다
  afterBattle(attacker, side==="A"&&attacker.alive);
  if(full) emitCore({type:"bagPickOpen",owner:p});
  emitCore({type:"render"});
}
function finishByCapture(side){
  if(S.eco){ ecoCaptureFinish(side); return; }
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
  emitToast(`🔴 포획 종료 — 적 하수인 포획! (예비 HP ${BAL.enemyCapHp}/${cb.hp})`);
  resetAfter(B.fa); resetAfter(B.fd);
  const attacker=B.attP;
  const q=B.msgQ.splice(0);
  S.battle=null;
  /* #126: 포획도 같은 규칙이다 — 이 제거로 경기가 끝나면(전멸) 포획 배너 대신 경기 결과 배너 하나만 낸다 */
  let ended=false;
  ENDING_BATTLE=true;
  try{ ended=checkWipe(); } finally{ ENDING_BATTLE=false; } // 제거이므로 전멸 판정 기여
  emitCore({type:"battleEndFx",queue:q,banner:(ended?matchEndBanner():null)
    /* #126: 포획은 **양측 모두 포획 갈래**다. 문구와 승자·소유자 의미는 그대로 두고, 비포획자 시점만 가라앉힌 색(capnot)을 쓴다 —
       종전처럼 lose 를 주면 포획당한 쪽에 경기 패배급 균열·낙하가 걸린다 (Saturn REVISE). */
    ||{title:"포획 성공! 전투 종료",cls:(viewerIsOwner(p)||offlinePvp()?"cap":"cap capnot")}}); // #106 5.6
  if(ended){ emitCore({type:"render"}); return; }
  afterBattle(attacker, side==="A"&&attacker.alive);
  emitCore({type:"render"});
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
  addLog("🏃 도망 성공 — 후방 말 교환 선택 중","imp"); emitToast(m);
  emitCore({type:"fx",item:{key:"fleeFx",kind:"banner",cls:"flee",title:"🛗 도망 성공!",sub:mine?"후방의 자기 말을 골라 자리를 바꾸거나 생략하세요. 교체 후 말을 한칸씩 밀어냅니다.":"상대가 말을 교체 중입니다. 교체 후 말을 한칸씩 밀어냅니다."}});
  emitCore({type:"render"});
}
function fleeDone(){ if(S.phase==="play"&&!S.battle) drainForcedQueue(false); emitCore({type:"render"}); if(S.phase==="play"&&!S.battle&&isAI(S.current)) emitCore({type:"aiTurn",player:S.current}); } // #18: 스왑 둘째 말의 강제 전투는 밀기·재배치 뒤 승격
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
  emitCore({type:"render"});
  if(S.phase==="play"&&!S.battle&&isAI(S.current)) emitCore({type:"aiTurn",player:S.current});
}
