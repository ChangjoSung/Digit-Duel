"use strict";
/* ===== 온라인 PVP — WebSocket 릴레이 + 시드 락스텝 동기화 =====
   원리: 매치 시 P1이 난수 시드를 공유 → 양쪽이 같은 시드로 같은 게임을 로컬 실행하고,
   플레이어 "입력(액션)"만 릴레이 서버로 중계·재생한다. 모든 게임 난수는 rand()(시드 RNG) 경유이고
   로직은 동기 완결이므로 두 클라이언트의 상태가 항상 일치한다 (서버는 내용 무해석 릴레이).
   숨은 정보는 시점(viewer=NET.me) 고정·비소유 모달 마스킹으로만 가린다 (프로토타입: 치팅 방지 없음). */
const NET={mode:false,me:null,ws:null,replaying:false,queue:[],modalSeq:0,syncModal:null,localOpen:false,modalOwner:null,started:false,
  preparing:false,queued:false,mySetup:null,pendingSeed:null,
  code:null, // 사전 배치: 배치 → 매칭 큐 → 매칭 시 배치 교환 · code: 접속 코드는 이 메모리에만 산다(#63 — 저장·주소·로그 금지)
  /* #217/#218 공개 방(초대 코드 없는 자유 참가) — server/authoritative/**(Jupiter_Server, protocol.md v2)가 구현·헤드리스
     검증까지 마친 실제 프로토콜을 그대로 따른다: credential 기반 소켓(l-/cp-/p-/r-) → 첫 인밴드 프레임(room_opened/
     room_joined/room_resumed/lobby_ready) → 이후 room_state/error. 코드 접속(위 code 경로)은 이 필드들과 무관하게
     그대로 동작한다(기존 릴레이 server/server.js, 건드리지 않음). */
  uiTab:"public", rooms:[], roomsLoading:false, roomId:null, seatToken:null, publicMode:false, // #217 CJ 승인: 공개 로비가 기본 진입(Earth/lobby-guide.md) — 코드 접속은 SUPERSEDED된 검토 옵션으로만 남는다
  myReady:false, peerReady:false, lobbyOnly:false, revision:0, waitingForPeer:false,
  /* #217 Jupiter/battle-fx-protocol.md v2 §7 — (epoch,roomId,seat) 단위 큐 커서. enqueuedSeq는 로컬 재생
     큐에 이미 넣은 최대 seq, playedSeq는 실제 재생이 끝난 최대 seq. 새 room/epoch가 되면 netFxResetCursor가
     둘 다 0으로 되돌린다 — 옛 seq와 절대 비교하지 않는다(§7-1). fxQueue는 재생 대기 중인 이벤트 배열. */
  fxEpoch:null, fxRoomId:null, fxSeat:null, fxEnqueuedSeq:0, fxPlayedSeq:0, fxQueue:[], fxPlaying:false, fxGen:0, fxScenes:{},
  /* #217 재접속(bounded resume) — Venus 구현 승인(implementation-approval.md "재접속 유예(60초)")에 따라
     소켓 단절(비의사)과 명시적 leave(의사)를 구분한다. explicitLeave는 netLeaveRoom()이 close() 직전에만 세운다.
     epoch/tokenGen은 room_opened/room_joined/room_resumed의 실제 필드(protocol.md v2 §2)를 그대로 담는다 —
     tokenGen은 재개(resume) 성공 때만 회전한다(seatToken.js resume()). resumeDeadline은 Date.now() 기준 ms epoch. */
  explicitLeave:false, epoch:null, tokenGen:0,
  resuming:false, resumeDeadline:0, resumeAttempts:0, resumeTimer:null, resumeLastAttempt:0};
function netActor(){ // 지금 게임이 입력을 기다리는 플레이어
  if(!S) return null;
  if(S.phase==="setup") return S.setupPlayer;
  /* #217 서버 권위 전투 행위자 — 원본 actorOfPhase()는 S.battle.phase·fa.shock 등 서버가 보내지 않는 내부 필드를
     쓴다(room.js toSeatView() 화이트리스트는 round/actor/a/d만 준다). 서버가 이미 계산해 보낸 actorOwner를
     그대로 쓰면 안전하다 — 로컬에서 재계산하지 않는다(Saturn 지침: 서버 스냅샷을 그대로 반영). */
  if(NET.publicMode&&S.battle) return S.battle.actorOwner;
  if(S.battle) return (actorOfPhase()==="A"?S.battle.attP:S.battle.defP).owner;
  if(S.fleePick) return S.fleePick.owner; // #114 도망 교환 선택은 도망친 말의 소유자 입력 (방어자일 수 있음)
  return S.current;
}
function netLocalModal(){NET.localOpen=true;}   // 다음 modal()을 로컬 전용으로 (동기화·seq 제외)
function netModalOwner(p){NET.modalOwner=p;}    // 다음 modal()의 소유자 명시 (기본: netActor())
function netSend(m){ try{ if(NET.ws&&NET.ws.readyState===1) NET.ws.send(JSON.stringify(m)); }catch(e){} }
function netAction(a){ // 모든 상태 변경 입력의 단일 경로 — 오프라인은 즉시 적용, 온라인은 검증·송신 후 적용
  if(S.fleePick&&!["cell","fleeSwap","fleeSkip","resign"].includes(a.t)) return;
  if(!NET.replaying&&["cell","fleeSwap","fleeSkip"].includes(a.t)&&S.fleePick) a=Object.assign({},a,{pick:S.fleePick.token});
  if(!NET.replaying){ FX.inputSeq++; // #106 3.2 입력 잠금: 연출 중 사람 입력(셀·턴바·전투 커맨드)은 무시 — 기권만 허용, AI·수신 재생·자동 종료(idle 뒤)는 해당 없음
    if(fxLocked()&&a.t!=="resign"&&!isAI(netActor())) return; }
  if(NET.mode&&!NET.replaying){
    if((a.t==="resign"?S.current:netActor())!==NET.me){ showToast(S.fleePick?"🌐 상대가 말을 교체 중입니다.":"🌐 상대 턴입니다."); return; }
    if(NET.publicMode){ netSendAction(a); return; } // #217 서버 권위 — 의도만 전송, 로컬 판정 없음(room_state 수신이 유일한 상태 갱신 경로)
    netSend({t:"a",a});
  }
  applyAction(a);
}
function applyAction(a){
  if(a.pick&&(!S.fleePick||a.pick!==S.fleePick.token)) return;
  if(S.fleePick&&(!["cell","fleeSwap","fleeSkip","resign"].includes(a.t)||(["cell","fleeSwap","fleeSkip"].includes(a.t)&&a.pick!==S.fleePick.token))) return;
  if(dispatchCoreAction(a)) return;
  switch(a.t){
    case "cell": onCellCore(a.r,a.c); break;
    case "setupDone": window.setupDoneCore(); break;
    case "search": {
      const sel=S.selected&&!S.selected.tray?S.selected:null;
      const ev=sel?S.events.find(e=>e.r===sel.r&&e.c===sel.c&&!e.consumed&&S.traces[S.current].has(e.r+"_"+e.c)):null;
      if(sel&&ev&&!S.mainUsed&&sel.owner===S.current&&canSearchPiece(sel)) doSearch(sel,ev);
      break; }
    case "endTurn": if(a.auto) met(S.current,"autoEnds"); endTurn(); break; // #106 T7: 자동 종료 표식은 프레임에 실려 양측 지표 동일
    case "fleeSwap": if(S.fleePick&&S.fleePick.cands.includes(a.id)) fleeResolve(a.id); break; // #114 도망 후 교환 (소유자 입력, rand 소비 0)
    case "fleeSkip": if(S.fleePick) fleeResolve(null); break; // #114 교환 생략 → 도망친 말 ↔ 상대 밀기
    case "resign": { const loser=S.current; gameOver(1-loser,"resign");
      const msg=`🏳️ ${pname(loser)} 기권 — ${pname(S.winner)} 승리!`;
      addLog(msg,"imp"); showToast(msg); render(); break; }
    case "act": if(window.__actCore) window.__actCore(a.k); break;
    case "item": if(window.__useItemCore) window.__useItemCore(a.i); break;
    case "ball": if(window.__throwBallCore) window.__throwBallCore(); break;
    case "flee": if(window.__fleeCore) window.__fleeCore(); break;
    case "pass": if(window.__passCore) window.__passCore(); break; // #146 수동 전투 행동 넘기기 (rand 소비 0 · 양측 같은 프레임)
    case "pkgOpen": if(window.__openPkgCore) window.__openPkgCore(a.kind); break; // #121 패키지 개봉 화면 (rand 0)
    /* 개봉·버프 확정과 탐색 보상 선택에는 **별도 semantic 액션을 두지 않는다.** 그 선택들은 buttons 를 가진 동기화 모달에서
       일어나므로 modal() 래퍼의 {t:"modal",seq,i} 중계가 이미 단일 경로다. 액션을 하나 더 만들면 이중 적용 통로가 된다. */
    case "modal": if(NET.syncModal&&NET.syncModal.seq===a.seq&&NET.syncModal.fns[a.i]) NET.syncModal.fns[a.i](); break;
  }
}
/* 수신 액션 큐 — 표시 계층(메시지 재생·타이머 모달)이 따라잡은 뒤에만 재생 (원격 지연·백그라운드 탭 방어) */
function netReady(a){ // #106 3.1-4: 잠금(배너·연출·메시지 재생) 중에는 큐에 보관만 하고 idle 에 적용 — 드롭·재정렬 없음, 워치독으로 잠금은 반드시 풀린다
  if(!NET.started||!S) return false;
  if(a.t==="modal") return !!NET.syncModal&&NET.syncModal.seq===a.seq&&!fxLocked();
  if(a.t==="act"||a.t==="item"||a.t==="ball"||a.t==="flee"||a.t==="pass"||a.t==="pkgOpen")
    return !!S.battle&&!fxLocked()&&S.battle.msgQ.length===0&&!!window.__actCore; // #121: 패키지 개봉 화면 열기도 전투 프레임과 같은 준비 조건
  return !fxLocked();
}
function netPump(){
  if(NET.replaying) return;
  while(NET.queue.length&&netReady(NET.queue[0])){
    const a=NET.queue.shift();
    NET.replaying=true;
    try{ applyAction(a); }catch(e){ try{console.error("net replay error",e,a);}catch(_){} }
    NET.replaying=false;
  }
}
(function(){ const t=setInterval(netPump,80); if(t&&typeof t.unref==="function") t.unref(); })(); // 브라우저는 숫자 반환(무영향) · Node 하네스에서는 이벤트 루프를 붙잡지 않음 (#41 회귀: smoke 종료 지연)
/* 동기화 대상 입력의 안정 진입점 — 원본(…Core)은 applyAction만 호출 */
function onCell(r,c){ const m=memoClickTarget(r,c); if(m){ memoModal(m); return; } netAction({t:"cell",r,c}); } // #94 로컬 메모 클릭은 송신·seq·RNG 없이 피커만 연다 (#106 잠금 중에는 memoClickTarget 이 null → netAction 가드가 막는다)
window.selTray=id=>netAction({t:"selTray",id});
window.toggleRoster=rid=>netAction({t:"roster",rid});
window.autoPlace=()=>netAction({t:"auto"});
window.clearPlace=()=>netAction({t:"clear"});
window.setupDone=()=>netAction({t:"setupDone"});
window.__act=k=>netAction({t:"act",k});
window.__useItem=i=>netAction({t:"item",i});
window.__throwBall=()=>netAction({t:"ball"});
window.__flee=()=>netAction({t:"flee"});
window.__pass=()=>netAction({t:"pass"}); // #146: 4슬롯 전부 불가일 때의 수동 [턴 종료] (자기 전투 행동 1회)
/* #121 계약 2.2·3·9: 패키지 개봉 화면 열기와 확정 선택도 다른 입력과 같은 단일 경로(netAction)를 탄다 —
   소유자만 보내고, 양측이 같은 순서로 같은 코어를 실행한다. 난수를 쓰지 않으므로 시드 스트림에 영향이 없다 */
/* 가방의 📦 버튼은 **전투 모달 안의 인라인 버튼**이다. 전투 모달은 buttons 가 비어 있어(syncModal=null) 자동 중계가 없으므로
   여기서만 semantic 액션을 쓴다 — 단일 송신·단일 적용. 개봉/버프/탐색 보상 **선택 화면의 버튼은 모달 중계를 타므로
   콜백에서 코어를 직접 부른다** (netAction 을 겹쳐 부르면 modal + semantic 두 프레임이 가서 원격이 두 번 적용한다). */
window.__openPkg=kind=>netAction({t:"pkgOpen",kind});
/* modal() 래퍼: 동기화 모달은 seq 부여 + 소유자만 조작(클릭 시 인덱스 중계), 비소유자는 내용 마스킹 */
const _modalCore=modal;
modal=function(html,buttons){
  const local=NET.localOpen; NET.localOpen=false;
  const owner=(NET.modalOwner!==null&&NET.modalOwner!==undefined)?NET.modalOwner:netActor();
  NET.modalOwner=null;
  const masked=NET.mode&&!local&&!!(buttons&&buttons.length)&&owner!==NET.me; // 동기화 모달의 비소유자
  if(masked) // #92: 비소유자 화면에는 원문(탐색 후보 기술 등 소유자 전용 정보)을 한 번도 쓰지 않고 대기 화면만 그린다 — 코어 modal()을 그대로 지나가므로 #94 메모 피커 토큰 무효·overlayOpen 소유권도 종전과 동일
    _modalCore(`<h2>🔒 상대 선택 대기 중…</h2><p style="margin:8px 0;color:var(--dim)">상대가 행동을 선택하고 있습니다. 완료되면 자동으로 진행됩니다.</p>`,[]);
  else _modalCore(html,buttons);
  if(!NET.mode||local) return;
  if(!buttons||!buttons.length){ NET.syncModal=null; return; } // 전투 모달 등 — 시맨틱 액션으로 동기화
  NET.modalSeq++;
  const seq=NET.modalSeq, fns=buttons.map(b=>b[1]);
  NET.syncModal={seq,owner,fns};

  if(owner===NET.me){
    const ob=$("obBtns");
    if(ob) Array.prototype.slice.call(ob.children).forEach((btn,i)=>{
      if(btn.disabled) return; // Saturn REVISE P2: 비활성 버튼은 중계 대상이 아니다 (누를 수도, 송신할 수도 없다)
      btn.onclick=()=>{ if(fxLocked()) return;
        if(NET.publicMode){ if(!NET.replaying) netSendAction({t:"modal",seq,i}); return; } // #217 서버 권위 — 로컬 실행 없음, room_state 수신을 기다린다
        if(!NET.replaying) netSend({t:"a",a:{t:"modal",seq,i}}); fns[i](); }; // #106: 잠금 중 소유자 클릭도 무시 (송신 0)
    });
  }
};
/* 사전 배치 → 매칭: 메뉴에서 배치 먼저(오프라인, 시드 무관) → 완료 시 큐 진입 → 매칭 시 양측 배치 교환 후
   공유 시드로 게임을 재생성하고 두 배치를 적용해 즉시 플레이 시작 */
window.netPrepare=function(){
  if(NET.ws||NET.mode){ showToast("이미 온라인 대전이 진행 중입니다."); return; }
  /* 메뉴 입력칸 값은 배치 화면으로 넘어가기 전에 저장한다 (주소만 — 코드는 저장하지 않는다).
     목적지 판정도 여기서 한 번 한다: 붙을 수 없는 주소를 들고 14개를 배치하게 두지 않는다. */
  const inp=$("netServer");
  const parsed=netParseAddr(inp&&inp.value&&inp.value.trim()?inp.value:netServerDefault());
  if(!parsed.ok){ showToast(NET_ADDR_HINT); return; }
  try{ localStorage.setItem("netServer",parsed.addr); }catch(e){} // 허용된 주소만 기억한다
  /* 코드는 여기서 메모리로 옮긴다. 메뉴를 떠나면 입력칸이 사라지므로, 형식이 어긋나면 배치를 시작하기 전에
     막는 편이 낫다 — 14개를 다 배치한 뒤 접속 단계에서 되돌리는 것보다 잃는 게 적다. */
  if(!netCaptureCode()){ showToast(NET_CODE_HINT); return; }
  NET.preparing=true; NET.queued=false; NET.mySetup=null;
  newGame("pvp"); // 배치용 로컬 게임 (매칭 후 공유 시드로 재생성되므로 시드 무관)
  addLog("🌐 온라인 대전 — 로스터 6종을 고르고 14개 말을 배치한 뒤 [배치 완료 → 매칭 시작]을 누르세요.","sys");
  render();
};
window.netCancelQueue=function(){
  NET.queued=false;
  if(NET.ws){ try{NET.ws.close();}catch(e){} NET.ws=null; }
  showToast("🌐 매칭을 취소했습니다. 배치는 유지됩니다.");
  render();
};
/* 사전 배치 적용 — 데이터는 항상 플레이어 0 진영(11~13행) 기준, p=1이면 행 미러링(r→14−r).
   손상 데이터는 무작위 대체(양측 동일 데이터·동일 시드 → 동일 결과, 락스텝 유지) */
function applyNetSetup(p,data){
  const mine=S.pieces.filter(x=>x.owner===p);
  const ok=data&&Array.isArray(data.roster)&&data.roster.length===6
    &&new Set(data.roster).size===6&&data.roster.every(id=>ROSTER.some(r=>r.id===id))
    &&Array.isArray(data.pos)&&data.pos.length===mine.length
    &&data.pos.every(q=>Array.isArray(q)&&zoneOf(0).includes(q[0])&&q[1]>=1&&q[1]<=COLS)
    &&new Set(data.pos.map(q=>q[0]+"_"+q[1])).size===data.pos.length;
  if(!ok){
    S.roster[p]=[]; fillRosterRandom(p);
    const cells=[]; for(const r of zoneOf(p)) for(let c=1;c<=COLS;c++) cells.push([r,c]);
    shuffle(cells);
    mine.forEach((x,i)=>{x.r=cells[i][0]; x.c=cells[i][1]; x.placed=true;});
    addLog(`🌐 ${pname(p)} 배치 데이터 손상 — 무작위 배치로 대체`,"sys");
    return;
  }
  S.roster[p]=data.roster.slice(); applyRoster(p);
  mine.forEach((x,i)=>{ x.r=(p===1)?(ROWS+1-data.pos[i][0]):data.pos[i][0]; x.c=data.pos[i][1]; x.placed=true; });
}
/* 접속·매칭·시작 — 내부망(LAN) 전용 구성 (#63 안전 접속)
   기본 주소: 서버가 서빙한 페이지(http/https)라면 그 host가 곧 릴레이 서버다. html 파일을 직접 연
   경우(file://)에는 알 수 있는 주소가 없으므로 "이 PC"(127.0.0.1:8080)만 가정한다 — 특정 개발 PC의
   내부망 IP를 코드에 박아두지 않는다(배포본에 남으면 남의 네트워크 주소를 그대로 광고하는 셈이고,
   그 주소는 받는 사람의 망에서는 대개 남의 기기이거나 존재하지도 않는다). */
const NET_LOCAL_DEFAULT="127.0.0.1:8080"; // file:// 로 열었을 때의 마지막 수단 기본값 — 입력칸에서 변경 가능(주소만 기억됨)
const NET_PORT_DEFAULT="8080";
/* 접속 코드 통로 = WebSocket 하위 프로토콜. 서버(server/security.js)와 같은 계약으로 토큰을 정확히
   2개, [공개 마커, 접속 코드] 순서로 제시한다. 마커는 비밀이 아니며 서버가 응답에 되돌려주는 유일한
   값이다(코드는 절대 선택·반향되지 않는다).
   이 통로를 쓰는 목적은 도청 방지가 아니다 — TLS 없는 ws:// 에서는 이 헤더도 평문이라 같은 망의
   관찰자에게 기밀이 아니다. 목적은 코드가 "오래 남는 곳"(주소창·방문 기록·Referer·프록시 액세스 로그,
   그리고 브라우저 저장소)에 복사되지 않게 하는 것이다. */
const NET_PROTOCOL_MARKER="digit-duel.v1";
const NET_CODE_MIN=8, NET_CODE_MAX=64;
const NET_CODE_TOKEN=/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/; // RFC 7230 token — 서버 validateAccessCode와 동일 집합(공백·비ASCII·쉼표·따옴표 불가)
const NET_CODE_HINT="🌐 접속 코드를 확인하세요 — 서버 콘솔의 [접속 코드] 값을 그대로 입력합니다 ("+NET_CODE_MIN+"~"+NET_CODE_MAX+"자 · 공백·쉼표·따옴표 불가).";
/* 거부 사유를 구분해서 알리지 않는다 — 입력값을 되풀이하지도 않는다(코드를 주소 칸에 잘못 넣었을 수 있다). */
const NET_ADDR_HINT="🌐 접속할 수 없는 주소입니다 — 이 데모는 localhost·127.0.0.1 이나 같은 내부망의 사설 IP 주소(예: 192.168.x.x:8080)로만 접속합니다. 도메인 이름·공인 주소는 지원하지 않습니다.";
/* #66 하위 프로토콜 협상 실패 안내 — 고정 문구 하나다. 선택된 값도, 접속 코드도, 마커도 담지 않는다.
   우리가 제시한 토큰은 [공개 마커, 접속 코드] 둘이므로, 마커가 아닌 값이 선택돼 돌아왔다면 그 값은
   접속 코드 자신일 수 있다 — 사유를 세분하거나 값을 되풀이하면 그 한 줄이 곧 코드 유출이다. */
const NET_PROTO_FAIL="🌐 접속을 끊었습니다 — 서버와 하위 프로토콜 협상이 맞지 않습니다. 서버 버전을 확인한 뒤 다시 시도하세요 (접속 코드를 다시 묻습니다).";
/* 판정만 한다. 어떤 실패 경로에서도 입력값 자체를 되돌리거나 남기지 않는다 (토스트·상태 배지·로그·예외 메시지 포함). */
function netCodeValid(c){
  return typeof c==="string"&&c.length>=NET_CODE_MIN&&c.length<=NET_CODE_MAX
    &&NET_CODE_TOKEN.test(c)&&c.toLowerCase()!==NET_PROTOCOL_MARKER;
}
/* 주소 파싱·허용 판정 — 접속 코드가 나갈 수 있는 목적지를 위협 모델(로컬·내부망)로 못 박는다.
   정규화만 하면 저장값·입력값이 가리키는 아무 호스트로나 소켓을 열게 되고, 그 순간 코드가
   하위 프로토콜 헤더에 실려 남의 서버로 간다("주소만 바꿔치기하면 코드가 따라간다"). 그래서
   ① 스킴만 벗기고 ② 경로·쿼리·프래그먼트·사용자정보가 붙은 입력은 조용히 잘라내지 않고 통째로
   거부하며(잘라내면 사용자가 붙여 넣은 것과 실제 접속지가 달라진다 — 후행 "/" 하나만 예외)
   ③ host[:port] 를 실제로 해석한 뒤 ④ localhost 와 루프백·사설·링크로컬 IP 리터럴만 허용한다.
   0.0.0.0·:: 을 포함한 공인·비특정 주소와 도메인 이름은 거부한다 —
   서버 자신도 Host 헤더에 같은 정책(isAllowedHost)을 걸고 있어 정상 서버가 그 밖에 있을 수 없다.
   반환: {ok:true, addr:"host:port"} 또는 {ok:false, reason} (사유는 내부 판정용 — 화면에 싣지 않는다) */
function netIpv4Class(h){ // null: IPv4 리터럴이 아님 · true: 허용 대역 · false: 공인 IPv4
  const m=/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if(!m) return null;
  const s=m.slice(1);
  if(s.some(x=>x.length>1&&x[0]==="0")) return false; // 0 으로 시작하는 옥텟(8진수로 읽히는 표기)은 받지 않는다
  const o=s.map(Number);
  if(o.some(n=>n>255)) return false;
  if(o[0]===127) return true;                          // 루프백 127.0.0.0/8
  if(o[0]===10) return true;                           // 10.0.0.0/8
  if(o[0]===172&&o[1]>=16&&o[1]<=31) return true;      // 172.16.0.0/12
  if(o[0]===192&&o[1]===168) return true;              // 192.168.0.0/16
  if(o[0]===169&&o[1]===254) return true;              // 링크로컬 169.254.0.0/16
  return false;
}
function netIpv6Allowed(h){ // 대괄호를 벗긴 소문자 리터럴 (존 인덱스 %eth0 는 받지 않는다)
  if(!/^[0-9a-f:]+$/.test(h)||h.indexOf(":")<0) return false;
  if((h.match(/::/g)||[]).length>1) return false;
  if(h==="::1"||/^0*:(?:0*:)*0*1$/.test(h)) return true; // 루프백 ::1 (완전 표기 포함)
  if(/^fe[89ab][0-9a-f]:/.test(h)) return true;          // 링크로컬 fe80::/10
  if(/^f[cd][0-9a-f]{2}:/.test(h)) return true;          // 유니크 로컬 fc00::/7
  return false;
}
function netParseAddr(raw){
  let a=String(raw===undefined||raw===null?"":raw).trim();
  if(a.indexOf("://")>=0) a=a.slice(a.indexOf("://")+3);
  a=a.trim();
  if(!a) return {ok:false,reason:"empty"};
  if(a.indexOf("?")>=0||a.indexOf("#")>=0) return {ok:false,reason:"query_or_hash"}; // 릴레이 주소에는 쿼리·프래그먼트가 없다
  const slash=a.indexOf("/");
  if(slash>=0){
    if(slash!==a.length-1) return {ok:false,reason:"path"}; // 경로가 붙은 입력은 잘라내지 않고 거부한다
    a=a.slice(0,-1);                                        // 후행 "/" 하나만 허용 (주소창에서 복사하면 흔히 붙는다)
  }
  if(!a) return {ok:false,reason:"empty"};
  if(a.indexOf("@")>=0) return {ok:false,reason:"userinfo"}; // user:pass@host — 진짜 목적지를 가리는 표기
  let host,portRaw=null;                                 // null = 포트를 적지 않음 · "" = 콜론만 찍음(형식 오류)
  if(a.charAt(0)==="["){                                 // 대괄호 IPv6 — [::1]:8080
    const e=a.indexOf("]");
    if(e<0) return {ok:false,reason:"bad_bracket"};
    host=a.slice(1,e);
    const rest=a.slice(e+1);
    if(rest){ if(rest.charAt(0)!==":") return {ok:false,reason:"bad_port"}; portRaw=rest.slice(1); }
  } else {
    const parts=a.split(":");
    if(parts.length===1) host=parts[0];
    else if(parts.length===2){ host=parts[0]; portRaw=parts[1]; }
    else host=a;                                         // 콜론이 여럿 = 대괄호 없는 IPv6 리터럴(포트 없음)
  }
  host=host.trim().toLowerCase();
  if(!host) return {ok:false,reason:"empty_host"};
  const port=portRaw===null?NET_PORT_DEFAULT:portRaw.trim(); // "host:" 처럼 빈 포트는 보정하지 않고 거부한다
  if(!/^\d{1,5}$/.test(port)||Number(port)<1||Number(port)>65535) return {ok:false,reason:"bad_port"};
  const v4=netIpv4Class(host);
  let ipv6=false;
  if(host==="localhost"){ /* 허용 */ }
  else if(v4!==null){ if(v4!==true) return {ok:false,reason:"public_ip"}; }
  else if(host.indexOf(":")>=0){ if(!netIpv6Allowed(host)) return {ok:false,reason:"public_ip"}; ipv6=true; }
  else return {ok:false,reason:"not_literal"};           // 도메인 이름 — 어디로든 해석될 수 있어 받지 않는다
  return {ok:true,addr:(ipv6?"["+host+"]":host)+":"+port};
}
function netServerDefault(){
  try{ const s=localStorage.getItem("netServer"); if(s) return s; }catch(e){}
  return location.protocol.indexOf("http")===0 ? location.host : NET_LOCAL_DEFAULT;
}
/* 접속 코드 캡처 — 입력칸 값을 이 탭의 메모리(NET.code)로만 옮기고 입력칸을 비운다.
   저장(localStorage·sessionStorage·쿠키·indexedDB)·주소·쿼리·프래그먼트·로그·토스트 어디에도 쓰지 않는다.
   trim은 붙여넣기로 딸려온 앞뒤 공백만 없앤다 — 서버가 만드는 코드에는 공백이 없고, 서버는 공백이 든
   값을 아예 거부하므로 여기서 흘려보내면 원인을 알 수 없는 401이 될 뿐이다. */
function netCaptureCode(){
  const el=$("netCode");
  const code=(el&&typeof el.value==="string"?el.value:"").trim();
  if(!netCodeValid(code)){ NET.code=null; return false; } // 실패 시 입력칸은 그대로 둔다(오타 수정용) — 값은 읽기만 했다
  NET.code=code; if(el) el.value=""; // 성공하면 DOM에 남기지 않는다
  return true;
}
/* 메뉴를 떠난 뒤(배치 화면·코드 오류로 끊긴 뒤) 코드를 다시 넣는 유일한 경로.
   메뉴 입력칸은 배치 화면으로 넘어가면서 사라지므로, 이 모달이 없으면 새로고침(=배치 손실) 말고는 방법이 없다. */
window.netCodePrompt=function(){
  netLocalModal(); // 동기화 대상 아님 (아직 매칭 전이고, 이 모달은 내 화면 전용)
  const take=()=>{ const el=$("netCodeRetry"); const c=(el&&typeof el.value==="string"?el.value:"").trim();
    if(!netCodeValid(c)){ showToast(NET_CODE_HINT); return; } // 값은 되풀이하지 않는다
    if(el) el.value=""; NET.code=c; close(); netConnect(); };
  modal(`<h2>🌐 접속 코드 입력</h2>
    <p style="margin:8px 0;color:var(--dim)">서버 콘솔의 <b>[접속 코드]</b> 값을 그대로 입력하세요. 코드는 이 탭의 메모리에만 두고 저장하지 않으며, 서버가 다시 시작되면 새 코드가 발급됩니다.</p>
    <input id="netCodeRetry" type="password" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="64" placeholder="접속 코드"
      style="width:100%;background:var(--panel2);color:var(--txt);border:1px solid var(--line);border-radius:6px;padding:8px;font-size:14px">`,
    [["접속",take],["취소",()=>{ const el=$("netCodeRetry"); if(el) el.value=""; close(); }]]);
};
/* ===== #217/#218 공개 방(초대 코드 없는 목록·참가) — server/authoritative/**(Jupiter_Server, protocol.md v2) =====
   서버는 demo/index.html의 실제 엔진을 룸마다 헤드리스로 그대로 구동한다(engine.js — Mars의 하네스 재사용,
   room.js — 좌석 인가·화이트리스트만 재구현). 클라이언트는 의도만 보내고 좌석별 산탄 스냅샷(room_state.data)만
   받아 그린다 — 로컬 규칙 판정은 하지 않는다. 연결은 credential 기반(l-/cp-/p-/r-), 첫 인밴드 프레임은
   room_opened/room_joined/room_resumed/lobby_ready, 이후는 room_state/error(protocol.md v2 §1·§2·§5). */
/* #217 CJ 승인: 공개 방이 유일한 온라인 진입이다. 초대 코드·접속 코드(SUPERSEDED)는 화면에 노출하지 않는다 —
   종전 코드 접속 함수(netPrepare/netConnect)는 서버 엔진의 락스텝 재생·기존 회귀가 쓰므로 코드에만 남는다. */
window.netUiTab=function(){ NET.uiTab="public"; render(); };
function netRoomAgeLabel(sec){ sec=Math.max(0,sec|0); if(sec<10) return "방금 전"; if(sec<60) return sec+"초 전"; return Math.floor(sec/60)+"분 전"; }
/* 로비 카드 상태 문구(Earth/lobby-guide.md) — 토스트만으로 끝내지 않고 카드 안에 남긴다. 서버 내부 코드·주소는 싣지 않는다. */
const NET_LOBBY_MSG={
  loadFail:"공개 방을 불러오지 못했습니다.",
  gone:"이 방은 더 이상 참가할 수 없습니다.",
  dropBeforeReady:"연결이 끊겼습니다. 방 목록으로 돌아가 다시 참가해 주세요.",
  full:"지금은 방이 가득 찼습니다. 잠시 후 다시 시도해 주세요.",
  busy:"요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."
};
function netLobbyMsg(kind){ NET.lobbyMsg=kind?{kind,text:NET_LOBBY_MSG[kind]||kind}:null; }
function netRoomsHtml(){
  const pend=NET.lobbyPending; // "create" | "join:<roomId>" | null
  const busy=!!pend;
  const rows=(NET.rooms||[]).map(rm=>{
    const rid=String(rm.roomId), joining=pend==="join:"+rid;
    return `<div class="netRoomRow"><span class="netRoomInfo">${escAttr(rm.label||("방 #"+rid))} · ${escAttr(rm.seats||"1/2")} · ${netRoomAgeLabel(rm.ageSec)}</span>
      <button type="button" ${busy?"disabled":""} onclick="netJoinPublicRoom(${escAttr(JSON.stringify(rid))})">${joining?"방에 참가하는 중…":"참가"}</button></div>`;
  }).join("");
  const empty=NET.roomsLoading?"목록을 불러오는 중…":(NET.roomsLoaded?"열려 있는 방이 없습니다. 새 방을 만들어 보세요.":"[새로고침]을 누르면 열려 있는 방을 불러옵니다.");
  const msg=NET.lobbyMsg?`<div class="netLobbyMsg err" role="alert">${escAttr(NET.lobbyMsg.text)}
      <div class="row"><button type="button" onclick="netListRooms()">${NET.lobbyMsg.kind==="gone"?"다른 방 보기":"다시 시도"}</button></div></div>`:"";
  return `<div class="row netLobbyActions"><button type="button" class="primary big" ${busy?"disabled":""} onclick="netCreatePublicRoom()">${pend==="create"?"방을 만드는 중…":"새 방 만들기"}</button>
      <button type="button" ${busy?"disabled":""} onclick="netListRooms()">새로고침</button></div>
    ${msg}
    <div class="netRoomList" aria-busy="${NET.roomsLoading?"true":"false"}">${rows||`<small>${empty}</small>`}</div>`;
}
function netCredNonce(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function netReqId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2); }
/* 공개 방 서버 주소 — 페이지를 서빙한 서버가 곧 공개 방 서버다(server/authoritative 정적 호스팅). 사용자에게 주소를 묻지 않고
   저장하지도 않는다(종전 코드 접속용 저장 주소 netServer 를 따라가면 옛 릴레이로 붙는다). file:// 은 서버가 Origin 을 거부한다. */
const NET_PUBLIC_LOCAL_DEFAULT="127.0.0.1:8081";
function netPublicAddr(){ return location.protocol.indexOf("http")===0&&location.host?location.host:NET_PUBLIC_LOCAL_DEFAULT; }
/* credential 소켓 생성의 유일한 지점 — list/create/join/resume이 전부 이 함수를 거친다(각기 다른 credential
   문자열만 다르다, protocol.md v2 §1). 이 함수 밖에서 WebSocket 생성자를 새로 호출하지 않는다 — smoke_online.js
   C26이 그 생성자 호출 지점 개수를 정적으로 고정한다(코드 접속 1곳 + 이 함수 1곳, 그 밖의 우회 없음). */
function netOpenCredentialSocket(credential){
  const url=(location.protocol==="https:"?"wss://":"ws://")+netPublicAddr();
  try{ return {ok:true,ws:new WebSocket(url,[NET_PROTOCOL_MARKER,credential])}; }catch(e){ return {ok:false,err:e}; }
}
function netCloseCurrentSocket(){ if(NET.ws){ const w=NET.ws; NET.ws=null; try{w.close();}catch(e){} } NET.ws=null; NET.lobbyOnly=false; }
/* 소켓 공통 배선 — 로비 전용(l-)·방 생성/참가(cp-/p-) 모두 이 콜백들을 쓴다. 첫 인밴드 프레임은 서버가
   오픈 직후 알아서 보낸다(§2) — 클라이언트가 먼저 보낼 명령이 없다(list_rooms만 예외, lobby_ready 수신 뒤 보낸다). */
function netAttachPublicSocket(ws,opts){
  opts=opts||{};
  NET.ws=ws; NET.publicMode=true; NET.lobbyOnly=!!opts.lobbyOnly;
  const sock=ws; const pubLive=()=>NET.ws===sock; // #217/#218: netConnect()의 live() 가드와 별개 이름 — J14 음성 대조군의 문자열 치환 대상과 겹치지 않게 한다
  const st=$("netStatus"); if(st){ st.style.display=""; st.textContent="서버에 연결하는 중…"; }
  ws.onopen=()=>{ if(!pubLive()) return;
    if(sock.protocol!==NET_PROTOCOL_MARKER){ try{ sock.close(); }catch(e){} NET.ws=null; NET.publicMode=false; NET.lobbyOnly=false; NET.roomsLoading=false; NET.lobbyPending=null;
      netLobbyMsg("loadFail"); render(); const s=$("netStatus"); if(s){ s.style.display=""; s.textContent=NET_PROTO_FAIL; } showToast(NET_PROTO_FAIL); return; } // netConnect()의 protoAbort()와 같은 fail-closed 원칙
    const s=$("netStatus"); if(s) s.textContent="연결됨"; };
  ws.onerror=()=>{ if(!pubLive()) return; if(!NET.roomId){ NET.lobbyPending=null; NET.roomsLoading=false; netLobbyMsg("loadFail"); render(); } };
  ws.onclose=()=>{ if(!pubLive()) return; NET.ws=null; netHandlePublicSocketClosed(); };
  ws.onmessage=ev=>{ if(!pubLive()) return; let m; try{ m=JSON.parse(ev.data); }catch(e){ return; } netHandlePublicMessage(m); };
}
/* 공개 소켓이 (재접속 시도 소켓 포함) 닫혔을 때의 공통 처리 — netAttachPublicSocket()과 재개 성공 뒤 재배선된
   소켓이 함께 쓴다. 단절이 방 안(비의사)이면 유예 재접속, 아니면 로비 카드에 상태를 남긴다. */
function netHandlePublicSocketClosed(){
  NET.roomsLoading=false;
  if(NET.publicMode&&NET.roomId&&!NET.explicitLeave&&!NET.resuming){ netBeginResume(); return; } // #217 소켓 단절(비의사) — 유예 안에서 자동 재접속
  if(NET.lobbyPending){ NET.lobbyPending=null; netLobbyMsg("loadFail"); }
  const s=$("netStatus"); if(s) s.textContent="연결 종료"; render();
}
/* 명령 봉투(protocol.md v2 §3) — list_rooms만 seatToken/tokenGen 없이 보낸다(server/authoritative/protocol.js
   validateEnvelope가 그 하나만 예외로 둔다). */
function netSendCmd(t,extra){ netSend(Object.assign({v:1,requestId:netReqId(),seatToken:NET.seatToken,tokenGen:NET.tokenGen,t},extra||{})); }
function netSendAction(a){
  if(a&&a.t==="resign"){ netSendCmd("resign"); return; } // room.js handleCommand: 기권은 최상위 명령이지 action 봉투가 아니다
  NET.lastActionRev=NET.revision; NET.lastAction=a&&a.t; NET.lastActionAuto=!!(a&&(a.auto||(a.t==="skipMain"&&NET.autoSending)));
  netSendCmd("action",{baseRevision:NET.revision,action:a});
}
/* 준비 의사 — 사용자가 [배치 완료 → 준비 완료]를 누른 의사는 NET.readyWanted 로 들고 있고, 표시(내 준비 완료)는
   서버가 seats.ready 로 확정한 NET.myReady 만 쓴다. 서버는 두 좌석이 모두 앉은 SETUP 에서만 setup·ready 를 받으므로,
   아직 상대가 입장하지 않은 OPEN 이면 보내지 않고 기다렸다가 입장 알림(room_state SETUP) 을 받는 순간 보낸다. */
function netFlushSetupReady(){
  if(!NET.readyWanted||!NET.mySetup||!NET.roomId||NET.started||NET.roomState!=="SETUP") return;
  if(NET.readySent) return; // 준비 의사 한 번에 한 번만 보낸다(setup 응답이 다시 room_state를 부르므로 revision 비교로는 루프가 된다)
  NET.readySent=true;
  netSendCmd("setup",{roster:NET.mySetup.roster,pos:NET.mySetup.pos});
  netSendCmd("ready");
}
/* 서버 오류 코드 → 플레이어 문구. 코드 원문은 화면에 싣지 않는다(서버도 message 를 보내지 않는다). */
const NET_ERR_KO={E_NOT_ACTOR:"지금은 상대의 차례입니다.",E_ILLEGAL_ACTION:"지금은 할 수 없는 행동입니다.",E_STALE_REVISION:"화면이 최신 상태가 아니었습니다 — 최신 상태로 갱신했습니다.",
  E_MATCH_STARTED:"이미 대국이 시작되었습니다.",E_RATE_LIMITED:NET_LOBBY_MSG.busy,E_CAPACITY:NET_LOBBY_MSG.full,E_DRAINING:"서버가 곧 다시 시작됩니다. 잠시 후 다시 시도해 주세요.",
  E_INTERNAL:"서버 오류로 경기가 중단되었습니다.",E_BAD_ENVELOPE:"요청 형식이 올바르지 않습니다.",E_SUPERSEDED:"다른 창에서 이 좌석으로 다시 접속했습니다."};
function netHandlePublicMessage(m){
  if(!m||typeof m!=="object") return;
  if(m.type==="lobby_ready"){ NET.lobbyOnly=true; NET.roomsLoading=true; render(); netSend({v:1,t:"list_rooms"}); return; }
  if(m.type==="lobby_rooms"){ NET.rooms=Array.isArray(m.rooms)?m.rooms:[]; NET.roomsLoading=false; NET.roomsLoaded=true; if(NET.lobbyMsg&&NET.lobbyMsg.kind!=="gone") netLobbyMsg(null); render(); return; }
  if(m.type==="room_opened"||m.type==="room_joined"){
    NET.roomId=m.roomId; NET.me=(typeof m.seat==="number")?m.seat:0;
    NET.seatToken=m.seatToken||null; NET.tokenGen=(typeof m.tokenGen==="number")?m.tokenGen:0;
    NET.epoch=m.epoch!=null?m.epoch:NET.epoch; NET.revision=(typeof m.revision==="number")?m.revision:0;
    NET.roomState=m.type==="room_opened"?"OPEN":"SETUP"; // 생성 직후는 상대 입장 대기, 참가 성공은 두 좌석이 찬 배치 단계
    NET.preparing=true; NET.queued=false; NET.mySetup=null; NET.myReady=false; NET.peerReady=false; NET.lobbyOnly=false;
    NET.readyWanted=false; NET.readySent=false; NET.lobbyPending=null; netLobbyMsg(null);
    netClearResume(); NET.explicitLeave=false;
    newGame("pvp");
    addLog(`🌐 공개 방 #${NET.roomId} — 로스터 6종을 고르고 14개 말을 배치한 뒤 [배치 완료 → 준비 완료]를 누르세요.`,"sys");
    render(); return; }
  if(m.type==="room_resumed"){
    netClearResume();
    if(m.roomId!=null) NET.roomId=m.roomId; if(typeof m.seat==="number") NET.me=m.seat;
    if(m.seatToken) NET.seatToken=m.seatToken; if(typeof m.tokenGen==="number") NET.tokenGen=m.tokenGen;
    if(m.epoch!=null) NET.epoch=m.epoch;
    NET.lobbyOnly=false;
    /* 이 소켓은 credential(r-)으로 열렸고 room_opened/joined를 거치지 않았다 — 처음 겪는 재개(예: 새로고침
       직후 재접속)라면 로컬 배치 화면 골격이 아직 없을 수 있으므로 방어적으로 만들어 둔다. */
    if(!S||S.phase==="menu") newGame("pvp");
    /* netResumeAttempt()가 연 소켓은 재시도 전용 onclose(단순 NET.ws=null)를 달고 열렸다 — 재개가 성공했으니
       이후 이 소켓이 다시 끊기면(아직 leave 전이면) 표준 경로처럼 또 자동 재접속을 시도하도록 재배선한다.
       재배선하지 않으면 두 번째 단절은 아무 반응 없이 조용히 죽는다. */
    if(NET.ws){ const sock2=NET.ws; const pubLive2=()=>NET.ws===sock2;
      sock2.onclose=()=>{ if(!pubLive2()) return; NET.ws=null; netHandlePublicSocketClosed(); };
      sock2.onerror=()=>{};
      /* 재시도 소켓의 onmessage 는 "재접속 중"일 때만 받도록 열렸다 — 재개가 끝나면 그 조건이 거짓이 되어 이후 상대 푸시·명령 응답을
         전부 버린다(실서버 통합에서 재현: 재개한 좌석이 revision 에서 멈춰 양측 차례가 엇갈림). 표준 수신으로 바꿔 끼운다. */
      sock2.onmessage=ev=>{ if(!pubLive2()) return; let mm; try{ mm=JSON.parse(ev.data); }catch(e){ return; } netHandlePublicMessage(mm); }; }
    showToast("🌐 재접속했습니다.");
    NET.readySent=false; // 재개 뒤에는 서버 상태를 다시 보고 필요하면 준비 의사를 다시 보낸다
    if(m.data) netApplyRoomState(m.data,true); else render(); // #217 fx §7-4: room_resumed는 보수적 baseline(netFxIngest)
    netFlushSetupReady();
    return; }
  if(m.type==="room_state"){ netApplyRoomState(m.data); netFlushSetupReady(); return; }
  if(m.type==="error"){
    if(NET.resuming&&["E_ROOM_NOT_FOUND","E_ROOM_CLOSED","E_SEAT_TOKEN_INVALID","E_EPOCH","E_TOKEN_GEN_STALE","E_SUPERSEDED"].includes(m.code)){
      netResumeExpire(); return; } // #217 재개 불가능한 오류는 유예 만료를 기다리지 않고 즉시 포기
    if(!NET.roomId){ // 방 진입 전(목록·생성·참가) 실패 — 카드 안에 지속 상태로 남기고 목록을 최신으로
      NET.lobbyPending=null;
      netLobbyMsg(["E_ROOM_NOT_FOUND","E_ROOM_CLOSED","E_MATCH_STARTED","E_ROOM_FULL"].includes(m.code)?"gone":m.code==="E_CAPACITY"?"full":m.code==="E_RATE_LIMITED"?"busy":"loadFail");
      render();
      if(["E_ROOM_NOT_FOUND","E_ROOM_CLOSED","E_MATCH_STARTED","E_CAPACITY","E_DRAINING"].includes(m.code)) netListRooms();
      return; }
    if(m.data) netApplyRoomState(m.data); // E_STALE_REVISION은 staleView를 함께 준다(room.js) — revision을 최신화해 다음 시도가 통과하게 한다
    /* 자동 턴 종료(autoEndCheck)가 보낸 입력이 거부됐다면 같은 서버 상태에서 다시 예약하지 않는다(거부 루프 방지). */
    if(NET.lastActionAuto) NET.autoEndBlockRev=NET.revision;
    showToast("🌐 "+(NET_ERR_KO[m.code]||"요청을 처리하지 못했습니다."));
    return; }
}
/* ===== 서버 스냅샷 → 로컬 렌더 상태 (protocol.md v2 §7 화이트리스트) =====
   newGame("pvp")가 이미 만들어 둔 뼈대(metrics·log·memos·teleUsed·forcedTargets 등 서버가 보내지 않는 필드)는
   건드리지 않고 그 초기값 그대로 둔다 — 지표·로그 패널·교전 세부 버프 표시가 인증 대국에서 비거나 최소치인
   것은 알려진 한계다(§7이 그 필드들을 아직 주지 않는다, Mars/report.md 참조). 서버가 보낸 필드만 덮어써 렌더한다. */
/* 서버가 주는 기술 배열은 {i,revealed,id,name,cd}(자기 쪽)·{i,revealed:false,kind}(상대 미공개)의 객체
   배열이다 — 원본 엔진의 p.skills([기술id,...])·p.cds([쿨,...])·p.revealedSkills([공개된 인덱스,...])
   3분리 배열 계약과 다르다. skillNameKo(sid,el)나 SKILL_KIND 기반 마스킹 표시(SKIND_KO[SKILLS[sid].kind])는
   전부 "sid가 SKILLS 테이블의 진짜 키"라고 가정하므로, 미공개 항목에는 kind만 아는 **자리표시 키**를
   SKILLS 테이블에 즉석 등록해 원본 표시 코드가 그대로 동작하게 한다(진짜 정체는 여전히 새지 않는다 —
   서버가 이미 안 준 값이므로 여기서 만들어 낼 수도 없다). */
function netAdaptSkills(list){
  if(!Array.isArray(list)) return {skills:null,cds:[0,0,0,0],revealedSkills:null};
  const skills=list.map(s=>{
    if(s&&s.revealed) return s.id;
    const kind=(s&&s.kind)||"?";
    const fake="__hidden_"+kind;
    if(!SKILLS[fake]) SKILLS[fake]={kind,ko:"?",desc:"",cls:null,el:null,pow:0};
    return fake;
  });
  const cds=list.map(s=>(s&&s.cd)||0);
  const revealedSkills=list.map((s,i)=>s&&s.revealed?i:-1).filter(i=>i>=0);
  return {skills,cds,revealedSkills};
}
function netStubPiece(u){
  if(!u) return null;
  const adapted=netAdaptSkills(u.skills);
  /* #217 Earth 감사(art-omission-audit.md P0): 서버가 아직 rosterId/artKey를 보내지 않아 항상 null이라
     아트가 텍스트 폴백된다 — Jupiter가 _serializeOwn()(및 전투 공개 범위)에 필드를 추가하면 이 줄
     변경 없이 그대로 artDirOf()가 살아난다. u.rosterId가 없는 동안은 기존과 동일하게 null이다. */
  return {id:u.id, r:u.r, c:u.c, owner:u.owner, alive:u.alive!==false, placed:true,
    type:u.type!==undefined?u.type:null, element:u.element!==undefined?u.element:null,
    name:u.name!==undefined?u.name:null, hp:u.hp!==undefined?u.hp:1, maxHp:u.maxHp!==undefined?u.maxHp:1,
    atk:u.atk||0, skillAtk:u.skillAtk||0, rosterId:u.rosterId!==undefined?u.rosterId:null, cdMax:u.cdMax||0, cd:0,
    skills:adapted.skills, cds:adapted.cds, revealedSkills:adapted.revealedSkills,
    movedEver:!!u.movedEver, movedPreBT:false, immobile:u.immobile||0, cap:u.cap||null,
    nextBattleBuff:false, healing:!!u.healing,
    /* 등급 C-2(공개된 상대)는 서버가 revealed 필드 없이 정체(type·name·element)를 보낸다 — 정체가 왔다는 것 자체가 공개다.
       등급 B(미공개)는 type 필드 자체가 없다. 자기 말은 서버 revealed 값을 그대로 쓴다. */
    revealed:u.revealed!==undefined?!!u.revealed:(u.type!==undefined&&u.type!==null),
    burn:u.burn||0, burnBy:null, weaken:u.weaken||0, shield:u.shield||0, shieldLayers:[], absorbed:0,
    shock:u.shock||0, shockFresh:!!u.shockFresh, focusCharge:!!u.focusCharge, vulnMark:!!u.vulnMark,
    crack:u.crack||0, harden:u.harden||0, hardenPct:u.hardenPct||0, evadeBuff:u.evadeBuff||0, dmgUpBuff:u.dmgUpBuff||0,
    dmgCut:u.dmgCut||0, powerBuff:!!u.powerBuff, fleeBoost:!!u.fleeBoost,
    /* #234 REVISE 2차: 서버는 소유자 좌석(you.pieces·you.reserve)에만 reaperSeal 을 보낸다 — 상대 말은 키가 없어 0(추측으로 채우지 않는다) */
    reaperSeal:u.reaperSeal||0,
    ...netStubStats(u)};
}
/* #233: Jupiter의 room.js 패치가 you.pieces[](자기 말)에 def·spd·dodge·crit·statusPct·grade 를 함께 보낸다(6필드 한 묶음 —
   u.def 가 오면 나머지 5개도 왔다고 가정한다). 아직 이 필드가 없는 대상(공개된 상대 말·기준판 서버 등)은 공개된
   rosterId·type 만으로 클라이언트가 같은 8스탯 표를 다시 찾아 채운다. */
function netStubStats(u){
  if(u&&typeof u.def==="number") return {def:u.def,spd:u.spd||0,dodge:u.dodge||0,crit:u.crit||0,statusPct:u.statusPct||0,grade:u.grade!==undefined?u.grade:null};
  const rd=u&&u.rosterId!==undefined&&u.rosterId!==null?ROSTER.find(r=>r.id===u.rosterId):null;
  if(rd){ const b=ARCHETYPE_BASE[rd.arch]; return {def:b.def,spd:b.spd,dodge:b.dodge,crit:b.crit,statusPct:b.statusPct,grade:1}; }
  if(u&&u.type==="king") return {def:KING_BASE.def,spd:KING_BASE.spd,dodge:KING_BASE.dodge,crit:KING_BASE.crit,statusPct:KING_BASE.statusPct,grade:null};
  if(u&&u.type==="ally"){ const b=ALLY_BASE.assassin; return {def:b.def,spd:b.spd,dodge:b.dodge,crit:b.crit,statusPct:b.statusPct,grade:null}; }
  const std=ARCHETYPE_BASE.std; return {def:std.def,spd:std.spd,dodge:std.dodge,crit:std.crit,statusPct:std.statusPct,grade:1};
}
function netApplyRoomState(data,isResumeFrame){
  if(!data) return;
  NET.waitingForPeer=false; // 성공한 room_state가 왔다는 것 자체가 더 이상 "게스트 미입장" 상태가 아니라는 뜻이다
  if(typeof data.revision==="number") NET.revision=data.revision;
  if(typeof data.state==="string") NET.roomState=data.state;
  if(data.seats&&Array.isArray(data.seats.ready)){ NET.myReady=!!data.seats.ready[NET.me]; NET.peerReady=!!data.seats.ready[1-NET.me]; NET.readyPending=null; } // ready 표시는 서버가 확정한 값만 쓴다
  netFxResetCursorIfNeeded(); // (epoch,roomId,seat) 경계 — 스냅샷 캐시보다 먼저
  /* #217 서버 v4 확정 계약(room.js toSeatView) — 시작 전 룸이 종결되면(호스트 이탈 유예 만료 등)
     data.state가 CANCELED|VOID|CLOSED, data.phase는 그 소문자형으로 온다(room.js TERMINAL_NO_BOARD).
     이 분기가 netBuildAuthoritativeBoard보다 먼저 걸려 보드 없는 종결 뷰가 play로 오인되지 않게 한다. */
  if(["canceled","void","closed"].includes(data.phase)){
    const why=data.phase==="void"?"서버에서 경기가 무효 처리되었습니다":data.phase==="closed"?"방이 닫혔습니다":"방이 취소되었습니다";
    netAbandonResume("🌐 "+why+" — 방 목록으로 돌아갑니다.");
    return;
  }
  if(!data.phase||data.phase==="setup"){ netFxEnqueue(data.fx,!!isResumeFrame); render(); netFxPump(); return; } // 대국 시작 전 — ready 배지만 갱신, 보드는 아직 없다(§7)
  netBuildAuthoritativeBoard(data);
  /* 새 이벤트를 먼저 큐에 올리고(재생은 아직) 그린 뒤 재생한다 — 그래야 이번 행동의 타격이 재생되기 전에
     전투 무대가 최종 HP로 먼저 그려졌다가 되돌아가는 일이 없다(표시 HP는 재생 대기 중이면 유지된다).
     재생은 render() 뒤다 — render()가 #board 셀을 새로 만들기 때문에 그 전에 셀 연출 클래스를 붙이면 지워진다. */
  netFxEnqueue(data.fx,!!isResumeFrame);
  render();
  netFxPump();
}
function netBuildAuthoritativeBoard(data){
  NET.mode=true; NET.started=true; NET.preparing=false; // #217 온라인 마스킹·netActor·modal 동기화 배선을 켠다 — 레거시 hello/hello2 브리지는 공개 방 경로에서 쓰지 않는다
  S.mode="pvp"; S.phase=(data.phase==="over")?"over":"play";
  if(typeof data.current==="number") S.current=data.current;
  if(typeof data.turnCount==="number") S.turnCount=data.turnCount;
  S.mainUsed=!!data.mainUsed; S.battlesUsed=data.battlesUsed||0;
  const you=data.you||{};
  const units=Array.isArray(data.units)?data.units:[];
  S.pieces=(Array.isArray(you.pieces)?you.pieces:[]).map(netStubPiece).concat(units.map(netStubPiece));
  /* 서버가 보낸 상대 말은 전부 이 좌석에게 보이는 말이다(등급 A는 레코드 자체가 없다). 원본 visibleTo()가 모르는
     일시 공개(숲 충돌 tempReveal 등)도 서버 판정을 그대로 따르도록, 받은 상대 말 id를 일시 공개 집합으로 둔다. */
  S.tempReveal=new Set(units.map(u=>u.id));
  S.inv[NET.me]=Array.isArray(you.inv)?you.inv.slice():[];
  S.balls[NET.me]=typeof you.balls==="number"?you.balls:0;
  S.reserve[NET.me]=you.reserve?netStubPiece(you.reserve):null;
  if(you.pkgs) S.pkgs[NET.me]=Object.assign({itemGift:0,battleBuff:0},you.pkgs);
  if(typeof you.teleUsed==="number") S.teleUsed[NET.me]=you.teleUsed;
  const byId=id=>id==null?null:(S.pieces.find(p=>p.id===id)||null);
  S.selected=byId(you.selected);
  /* 행동 좌석 전용 턴 결정 상태(텔레포트 단계·강제 전투 대상·이동한 말·접촉 집합) — 서버가 data.turn으로 줄 때만 반영한다.
     없으면 원본 기본값(없음)으로 둔다. */
  const turn=data.turn&&typeof data.turn==="object"?data.turn:null;
  S.teleport=turn&&turn.teleport?{stage:turn.teleport.stage===2?2:1,piece:byId(turn.teleport.piece)}:null;
  S.forcedTargets=turn&&Array.isArray(turn.forcedTargets)?turn.forcedTargets.slice():[];
  S.forcedQueue=turn&&typeof turn.forcedQueue==="number"&&turn.forcedQueue>0?Array.from({length:turn.forcedQueue},()=>({pid:null})):[];
  S.movedPiece=turn?byId(turn.movedPiece):null;
  S.firstBattleWonByMover=!!(turn&&turn.firstBattleWonByMover);
  S.contactSet=turn&&Array.isArray(turn.contactSet)?turn.contactSet.slice():[];
  S.events=(Array.isArray(data.events)?data.events:[]).map(e=>({r:e.r,c:e.c,kind:e.kind,consumed:false}));
  S.traces[NET.me]=new Set((Array.isArray(data.events)?data.events:[]).map(e=>e.r+"_"+e.c));
  S.fleePick=data.fleePick?{owner:data.fleePick.owner,cands:Array.isArray(data.fleePick.cands)?data.fleePick.cands:[],token:0,pieceId:data.fleePick.pieceId!=null?data.fleePick.pieceId:null}:null;
  if(data.battle){
    const bid=typeof data.battle.battleId==="number"?data.battle.battleId:"live"; // public-view-delta §3 확정 계약: battle.battleId 가 fx battleId 와 같다 (없으면 무대 연결 없는 라이브 표시)
    S.battle=netSynthBattle(data.battle,you);
    NET.fxLiveBid=bid;
    NET.fxBattleSnaps[bid]={battle:data.battle,you:{pieces:you.pieces,reserve:you.reserve},rev:NET.revision};
    const keys=Object.keys(NET.fxBattleSnaps).filter(k=>/^\d+$/.test(k)).map(Number).sort((x,y)=>x-y);
    /* 최근 전투 4개만 보관 — 재생 중 무대·재생 대기 이벤트(이번 프레임의 새 이벤트 포함)가 가리키는 전투는 지우지 않고 그다음 오래된 것을 지운다 */
    const keep=new Set([NET.stageBid]);
    for(const e of NET.fxQueue) keep.add(e.battleId);
    if(data.fx&&Array.isArray(data.fx.events)) for(const e of data.fx.events) if(typeof e.seq==="number"&&e.seq>NET.fxEnqueuedSeq) keep.add(e.battleId);
    let extra=keys.length-4;
    for(const k of keys){ if(extra<=0) break; if(keep.has(k)) continue; delete NET.fxBattleSnaps[k]; extra--; }
    if(!NET.fxDisp[bid]) NET.fxDisp[bid]={A:{hp:S.battle.fa.hp,sh:S.battle.fa.shield||0},D:{hp:S.battle.fd.hp,sh:S.battle.fd.shield||0}};
  } else { S.battle=null; NET.fxLiveBid=null; }
  S._pendingModal=data.modal||null; // #217 v3 — 2차 선택 화면(탐색 보상·패키지 개봉 등), netSyncOverlays()가 그린다
  if(Array.isArray(data.log)) S.log=data.log.map(l=>({msg:l.msg,cls:l.cls})); // 이 좌석 시점 엔진의 보드 로그(protocol v4 §7)
  NET.finalReveal=data.state==="FINISHED"; // public-view-delta §5: FINISHED 뷰는 살아 있는 모든 상대 말을 위치·정체까지 보낸다(#11 종료 공개)
  if(data.result){
    S.winner=data.result.winner!=null?data.result.winner:null;
    S.metrics.winType=data.result.winType||(data.result.type==="FORFEIT"?"forfeit":data.result.type==="NO_CONTEST"?"nocontest":null);
    NET.result=data.result;
  } else NET.result=null;
}
/* ===== #217 공개 방 표시 계층 — 서버 fx 이벤트 재생(Jupiter/battle-fx-protocol.md v3 §6·§7) =====
   규칙 판정은 서버만 한다. 이 계층은 서버가 보낸 표시 이벤트를 원본 로컬 연출과 **같은 순서·같은 시간**으로 재생한다.
   · 무대 수명(visible stage) — 전투 오버레이는 "최신 스냅샷"이 아니라 **지금 재생 중인 이벤트의 battleId**가 소유한다.
     battle=null 스냅샷이 먼저 와도 그 전투의 남은 타격·KO·결과 배너를 다 재생할 때까지 그 전투 무대를 유지하고,
     다음 전투 스냅샷이 먼저 와도 옛 전투 이벤트가 끝나기 전에는 새 전투원으로 치환하지 않는다. 무대는 battleId별로
     보관한 마지막 전투 스냅샷(NET.fxBattleSnaps)으로 원본 battleModal()이 다시 그린다 — 원본 finishBattle의
     battleEndFx(남은 메시지 → 결과 배너 → close)와 같은 순서다.
   · 표시 HP(NET.fxDisp) — 원본 B.dispHpA/D·dispShA/D와 같다. 스냅샷은 행동 뒤 최종값이지만 화면은 메시지가 재생되는
     순서대로 줄어든다. 그 전투에 재생할 이벤트가 남지 않으면 최신 스냅샷 값으로 맞춘다.
   · 시간 — msg 그룹은 원본 playMsgs와 같다: key가 있는 메시지가 그룹을 열고(BAL.fx[key]), key 없는 뒤따르는 메시지는
     같은 그룹 줄로 즉시 합쳐지며, key 없이 시작한 그룹은 msgStep이다. 배너는 원본 fxPlay처럼 BAL.fx[key](0이면 표시 없음),
     battleStart는 원본 countStep 4프레임이다. 움직임 줄이기 설정은 원본처럼 **시간을 바꾸지 않고** CSS 움직임만 끈다.
   · 입력 잠금 — 재생 중에는 fxLocked()가 참이 되어 원본과 같이 사람 입력·전투 버튼·자동 턴 종료가 멈춘다. 워치독 포함. */
function netFxResetCursorIfNeeded(){
  if(NET.fxEpoch!==NET.epoch||NET.fxRoomId!==NET.roomId||NET.fxSeat!==NET.me){
    NET.fxEpoch=NET.epoch; NET.fxRoomId=NET.roomId; NET.fxSeat=NET.me;
    NET.fxEnqueuedSeq=0; NET.fxPlayedSeq=0; NET.fxQueue=[]; NET.fxPlaying=false; NET.fxCur=null;
    NET.fxScenes={}; NET.fxBattleSnaps={}; NET.fxDisp={}; NET.fxLiveBid=null; NET.stageBid=null; NET.battleMenu=null;
    NET.fxGen=(NET.fxGen||0)+1; // 세대 증가 — 이전 세대의 예약된 setTimeout은 전부 자기 gen 검사에서 스스로 멈춘다
    fxSetLockClass(false);
  }
}
function netFxRememberScene(ev){
  if(ev&&ev.scene&&ev.battleId!=null){
    NET.fxScenes[ev.battleId]=ev.scene;
    const keys=Object.keys(NET.fxScenes);
    if(keys.length>4) delete NET.fxScenes[keys.sort((a,b)=>a-b)[0]]; // 최근 battleId 4개만 — 무한 누적 방지
  }
}
/* 전투 중에 생긴 이벤트(battleId 있음)는 그 전투 무대 위에서 재생된다. 전투와 무관한 이벤트는 보드 위 배너다. */
function netFxStageBound(ev){ return !!ev&&ev.battleId!=null; }
function netFxIsBanner(ev){ return !!ev&&ev.src!=="msg"; }
function netFxPendingFor(bid){
  if(bid==null) return false;
  if(NET.fxPlaying&&NET.fxCur&&NET.fxCur.battleId===bid) return true;
  return NET.fxQueue.some(e=>e.battleId===bid);
}
function netFxIngest(fx,isResumeFrame){ netFxEnqueue(fx,isResumeFrame); netFxPump(); }
function netFxEnqueue(fx,isResumeFrame){ // 큐에 올리기만 한다 — 재생은 netFxPump()
  if(!fx) return;
  netFxResetCursorIfNeeded();
  const events=Array.isArray(fx.events)?fx.events:[];
  if(isResumeFrame){
    /* §7-4 권장 baseline — 창에 쌓인 오래된 연출을 전부 재생하면 재접속 직후 혼란스럽다. 한 번에 커서를
       맞추고, 마지막 이벤트가 결전/승패 배너면 그것 하나만 "재접속하자마자 결과가 보인다"로 재생한다. */
    NET.fxQueue=[];
    events.forEach(netFxRememberScene);
    const last=events.length?events[events.length-1]:null;
    if(last&&typeof last.seq==="number"&&last.seq>NET.fxPlayedSeq&&(last.key==="resultBanner"||(last.src==="msg"&&last.fx&&last.fx.ko))) NET.fxQueue.push(last);
    if(typeof fx.lastSeq==="number"){ NET.fxEnqueuedSeq=Math.max(NET.fxEnqueuedSeq,fx.lastSeq); NET.fxPlayedSeq=Math.max(NET.fxPlayedSeq,fx.lastSeq); }
  } else {
    // §7-3 갭: 창 밖으로 밀린 이벤트는 합성하지 않고 지금 창에 있는 것부터 이어간다(진단 로그만).
    if(typeof fx.firstSeq==="number"&&fx.firstSeq>NET.fxEnqueuedSeq+1&&NET.fxEnqueuedSeq>0&&window.console) console.debug("[fx] gap: firstSeq",fx.firstSeq,"> enqueuedSeq+1",NET.fxEnqueuedSeq+1,"— 오래된 이벤트는 스킵");
    const newOnes=events.filter(e=>typeof e.seq==="number"&&e.seq>NET.fxEnqueuedSeq);
    newOnes.forEach(netFxRememberScene);
    if(newOnes.length){ NET.fxQueue=NET.fxQueue.concat(newOnes); NET.fxEnqueuedSeq=newOnes[newOnes.length-1].seq; }
    if(typeof fx.lastSeq==="number"&&fx.lastSeq>NET.fxEnqueuedSeq) NET.fxEnqueuedSeq=fx.lastSeq;
  }
}
/* 원본 fxShow와 같은 배너 표시 — kind/cls/title/sub, boom·trap은 원본 dim:false(nodim), 결과 배너 파편 레이어 */
function netFxShowBanner(ev,title){
  const el=$("fxBanner"); if(!el) return;
  const kind=ev.kind||"banner";
  el.className=kind+(ev.cls?" "+ev.cls:"")+((kind==="boom"||kind==="trap")?" nodim":"");
  const t=$("fxTitle"), s=$("fxSub"); if(t) t.textContent=title!==undefined?title:(ev.title||""); if(s) s.textContent=title!==undefined?"":(ev.sub||"");
  try{ fxFxLayer({kind}); }catch(e){}
  el.classList.remove("hidden");
  if(Array.isArray(ev.cells)&&(ev.key==="explosion"||ev.key==="trapFx")){
    const cls=ev.key==="explosion"?"fx-boom":"fx-trap";
    for(const rc of ev.cells){ const cell=document.querySelector(`#board .cell[data-r="${rc[0]}"][data-c="${rc[1]}"]`);
      if(cell){ cell.classList.remove(cls); void cell.offsetWidth; cell.classList.add(cls); } }
  }
}
function netFxHideBanner(){ const el=$("fxBanner"); if(el&&NET.publicMode) el.classList.add("hidden"); }
const NET_HPSTAGE={A:0,D:0};
/* 원본 applyFx와 같은 DOM 경로(id: bst-/shfill-/hpfill-/hptxt-/tok- + A|D). float만 서버가 {side,sign,amount}로 디코드해 보낸다. */
function netFxApplyMsgFx(bid,fx,gen){
  if(!fx) return;
  try{
    const d=NET.fxDisp[bid]||(NET.fxDisp[bid]={A:{},D:{}});
    let stage=0; // 원본 5.5: 같은 side의 방어막·HP가 함께 줄면 HP 표시를 barStep 늦춘다
    if(fx.st&&fx.st.max&&fx.hp&&fx.hp.side===fx.st.side){ const sd=d[fx.st.side]||{};
      if((sd.sh||0)>(fx.st.shield||0)&&sd.hp!==undefined&&sd.hp>fx.hp.val) stage=BAL.fx.barStep||0; }
    if(fx.st){ const s=$("bst-"+fx.st.side); if(s) s.textContent=fx.st.text||"";
      if(fx.st.max){ (d[fx.st.side]||(d[fx.st.side]={})).sh=fx.st.shield||0;
        const sb=$("shfill-"+fx.st.side); if(sb) sb.style.width=Math.max(0,Math.min(100,(fx.st.shield||0)/fx.st.max*100))+"%"; } }
    if(fx.hp&&typeof fx.hp.val==="number"){ const side=fx.hp.side; (d[side]||(d[side]={})).hp=fx.hp.val;
      const seq=++NET_HPSTAGE[side], bar=$("hpfill-"+side), t=$("hptxt-"+side);
      const write=()=>{ if(bar&&fx.hp.max) bar.style.width=Math.max(0,fx.hp.val/fx.hp.max*100)+"%"; if(t) t.textContent=fx.hp.val; };
      if(stage>0) setTimeout(()=>{ if(NET.fxGen!==gen||NET_HPSTAGE[side]!==seq||$("hpfill-"+side)!==bar) return; try{ write(); }catch(e){} },stage);
      else write(); }
    if(fx.shake){ const tk=$("tok-"+fx.shake); if(tk){ tk.classList.remove("shake"); void tk.offsetWidth; tk.classList.add("shake"); } }
    if(fx.flash){ const st=$("bstage"); if(st){ st.style.boxShadow=`inset 0 0 70px var(--${fx.flash})`;
      setTimeout(()=>{ if(NET.fxGen!==gen) return; try{ if($("bstage")===st) st.style.boxShadow=""; }catch(e){} },380); } }
    if(fx.sig){ const st=$("bstage"); if(st&&st.classList){ st.classList.remove("sigblink"); void st.offsetWidth; st.classList.add("sigblink");
      setTimeout(()=>{ if(NET.fxGen!==gen) return; try{ if($("bstage")===st) st.classList.remove("sigblink"); }catch(e){} },750); } }
    if(fx.float&&fx.float.side){ const tk=$("tok-"+fx.float.side);
      if(tk&&tk.appendChild){ const dv=document.createElement("div"); dv.className="dmgfloat";
        const span=document.createElement("span"); span.className=fx.float.sign==="neg"?"neg":"pos";
        span.textContent=(fx.float.sign==="neg"?"-":"+")+fx.float.amount; dv.appendChild(span); tk.appendChild(dv);
        setTimeout(()=>{ try{ if(dv.parentNode) dv.parentNode.removeChild(dv); }catch(e){} },1100); } }
    if(fx.ko){ const tk=$("tok-"+fx.ko); if(tk) tk.classList.add("ko"); }
  }catch(e){}
}
function netFxEsc(s){ return String(s==null?"":s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch])); }
const NET_FX_COUNT_FRAMES=["3","2","1","배틀 시작!"]; // 원본 battleModal 진입 카운트다운과 같은 4프레임
function netFxRenderOne(ev,gen,done){
  const wd=BAL.fx.watchdog||1000;
  const after=ms=>{ setTimeout(done,ms); setTimeout(done,ms+wd); }; // 원본 fxNext와 같은 하드 데드라인
  if(ev.src==="msg"){
    const bid=ev.battleId, lines=[ev.txt||""];
    netFxApplyMsgFx(bid,ev.fx,gen);
    while(NET.fxQueue.length&&NET.fxQueue[0].src==="msg"&&!NET.fxQueue[0].key&&NET.fxQueue[0].battleId===bid){ // 같은 그룹 후속 줄 즉시 병합
      const n=NET.fxQueue.shift(); lines.push(n.txt||""); netFxApplyMsgFx(bid,n.fx,gen);
      NET.fxPlayedSeq=Math.max(NET.fxPlayedSeq,n.seq||0); }
    try{ const mb=$("msgBox"); if(mb){ mb.innerHTML=lines.map(netFxEsc).join("<br>"); if(mb.classList){ if(ev.big) mb.classList.add("big"); else mb.classList.remove("big"); } } }catch(e){}
    const ms=ev.key?(BAL.fx[ev.key]||0):(BAL.fx.msgStep||0);
    after(ms>0?ms:600); return;
  }
  if(ev.key==="battleStart"){
    const stepMs=BAL.fx.countStep||0;
    if(stepMs<=0){ done(); return; }
    let i=0;
    const step=()=>{
      if(NET.fxGen!==gen) return;
      if(i>=NET_FX_COUNT_FRAMES.length){ done(); return; }
      netFxShowBanner({kind:"count"},NET_FX_COUNT_FRAMES[i]); i++;
      setTimeout(step,stepMs);
      if(i===NET_FX_COUNT_FRAMES.length) setTimeout(done,stepMs+wd); // 마지막 프레임의 하드 데드라인
    };
    step();
    return;
  }
  const ms=(ev.key&&BAL.fx[ev.key])||0;
  if(ms<=0){ done(); return; } // 원본 fxPlay: 시간이 0인 항목은 표시 없이 즉시 끝난다
  netFxShowBanner(ev); after(ms);
}
function netFxPump(){
  if(NET.fxPlaying) return; // 재생 중이면 손대지 않는다 — 큐가 비어 있어 보여도 "재생 중" 자체가 진실
  if(!NET.fxQueue.length){ netFxIdle(); return; }
  const gen=NET.fxGen, ev=NET.fxQueue.shift(), id=(NET.fxCurId||0)+1;
  NET.fxPlaying=true; NET.fxCur=ev; NET.fxCurId=id; fxSetLockClass(true);
  /* 무대 소유권: 전투 이벤트는 그 battleId 무대를 세운다(다른 전투였으면 그 전투 스냅샷으로 교체). 보드 이벤트는 무대를 놓는다. */
  if(netFxStageBound(ev)){ if(NET.stageBid!==ev.battleId){ NET.stageBid=ev.battleId; netSyncOverlays(true); } }
  else if(NET.stageBid!=null){ NET.stageBid=null; netSyncOverlays(true); }
  else netSyncOverlays(false); // 재생 시작으로 잠금 표시가 바뀐 무대(전투 버튼 비활성)를 반영
  let finished=false;
  netFxRenderOne(ev,gen,()=>{
    if(finished||NET.fxGen!==gen||NET.fxCurId!==id) return; // 워치독 중복·옛 세대 콜백 무효
    finished=true;
    NET.fxPlayedSeq=Math.max(NET.fxPlayedSeq,ev.seq||0);
    NET.fxPlaying=false; NET.fxCur=null;
    const nx=NET.fxQueue[0];
    if(netFxIsBanner(ev)&&!netFxIsBanner(nx)) netFxHideBanner(); // 다음 배너가 바로 이어지면 깜빡이지 않는다
    if(NET.stageBid!=null&&!(nx&&nx.battleId===NET.stageBid)){ // 이 전투 무대에 재생할 것이 더 없다 → 무대를 놓는다(원본: 결과 배너 onEnd → close)
      NET.stageBid=null; if(nx) netSyncOverlays(true); }
    netFxPump();
  });
}
/* 큐와 재생이 모두 끝난 순간 — 원본 fxIdle처럼 잠금 해제 → 오버레이(무대·선택창)를 최신 스냅샷으로 → 턴바 → 자동 턴 종료 평가 */
function netFxIdle(){
  netFxHideBanner(); fxSetLockClass(false);
  if(NET.stageBid!=null) NET.stageBid=null;
  try{ netSyncOverlays(false); }catch(e){}
  try{ if(S&&S.phase==="play") renderTurnBar(); }catch(e){}
  try{ autoEndCheck(); }catch(e){}
}
window.netListRooms=function(){
  if(NET.ws&&NET.lobbyOnly&&NET.ws.readyState===1){ NET.roomsLoading=true; render(); netSend({v:1,t:"list_rooms"}); return; }
  if(NET.roomId) return; // 방 안에서는 목록 소켓으로 갈아타지 않는다
  netCloseCurrentSocket();
  NET.roomsLoading=true; render();
  const opened=netOpenCredentialSocket("l-"+netCredNonce());
  if(!opened.ok){ NET.roomsLoading=false; netLobbyMsg("loadFail"); render(); return; }
  netAttachPublicSocket(opened.ws,{lobbyOnly:true});
};
window.netCreatePublicRoom=function(){
  if(NET.lobbyPending||NET.roomId) return; // 중복 탭 방지
  netCloseCurrentSocket();
  const opened=netOpenCredentialSocket("cp-"+netCredNonce());
  if(!opened.ok){ netLobbyMsg("loadFail"); render(); return; }
  NET.lobbyPending="create"; netLobbyMsg(null);
  netAttachPublicSocket(opened.ws,{lobbyOnly:false}); render();
};
window.netJoinPublicRoom=function(roomId){
  if(NET.lobbyPending||NET.roomId) return;
  netCloseCurrentSocket();
  const opened=netOpenCredentialSocket("p-"+String(roomId));
  if(!opened.ok){ netLobbyMsg("loadFail"); render(); return; }
  NET.lobbyPending="join:"+String(roomId); netLobbyMsg(null);
  netAttachPublicSocket(opened.ws,{lobbyOnly:false}); render();
};
/* 준비 완료/취소 — 표시는 서버 확정값(seats.ready)만. 취소하면 배치 화면으로 돌아가 자기 배치를 고칠 수 있다(서버는 내 ready만 해제). */
window.netRoomReady=function(flag){
  if(flag){ if(!NET.mySetup) return; NET.readyWanted=true; NET.readySent=false; netFlushSetupReady(); render(); return; }
  NET.readyWanted=false; NET.readySent=false;
  if(NET.roomState==="SETUP") netSendCmd("unready");
  render();
};
window.netLeaveRoom=function(){ NET.explicitLeave=true; netClearResume(); if(NET.roomId) netSendCmd("leave"); netLeave(); newGame("pvp"); S.phase="menu"; render(); netListRooms(); };
/* ===== #217 재접속(bounded resume) — Venus 구현 승인(implementation-approval.md "재접속 유예(60초)")에 따른 자동 재개.
   대상은 명시적 leave가 아닌 소켓 단절(비의사)뿐이다. 유예 60초 안에서 3초 간격으로 재시도하고, 회복 불가능한
   서버 오류나 유예 만료 시 방 목록으로 돌아간다. 재개는 credential(r-<epoch>.<seatToken>, protocol.md v2 §1)
   기반이라 커맨드 송신이 필요 없다 — 소켓이 열리자마자 서버가 room_resumed 또는 error를 스스로 보낸다. */
const NET_RESUME_GRACE_MS=60000, NET_RESUME_RETRY_MS=3000;
function netClearResume(){
  if(NET.resumeTimer){ try{clearInterval(NET.resumeTimer);}catch(e){} }
  NET.resuming=false; NET.resumeDeadline=0; NET.resumeAttempts=0; NET.resumeTimer=null; NET.resumeLastAttempt=0;
}
function netBeginResume(){
  if(!NET.roomId||!NET.seatToken||!NET.epoch){ netLeave(); newGame("pvp"); S.phase="menu"; render(); return; } // 재개할 좌석 정보가 없으면 조용히 방 목록으로
  NET.resuming=true; NET.resumeDeadline=Date.now()+NET_RESUME_GRACE_MS; NET.resumeAttempts=0; NET.resumeLastAttempt=0;
  render();
  netResumeAttempt();
  /* 매초 tick — 헤드리스 하네스는 setInterval을 무동작 스텁으로 바꾼다(#41과 동일 이유, harness.js 참조)이므로
     실제 진행은 언제나 netResumeTick() 자체를 직접 호출해서 검증한다(smoke_public_rooms.js). 이 함수는 순수
     "지금이 몇 시인지"만 보고 하므로 실제 setInterval이든 테스트의 수동 호출이든 동일하게 동작한다. */
  NET.resumeTimer=setInterval(netResumeTick,1000);
  if(NET.resumeTimer&&typeof NET.resumeTimer.unref==="function") NET.resumeTimer.unref(); // Node 하네스에서 이벤트 루프를 붙잡지 않음
}
function netResumeTick(){
  if(!NET.resuming){ if(NET.resumeTimer) try{clearInterval(NET.resumeTimer);}catch(e){} return; }
  if(Date.now()>=NET.resumeDeadline){ netResumeExpire(); return; }
  if(!NET.ws&&Date.now()-NET.resumeLastAttempt>=NET_RESUME_RETRY_MS) netResumeAttempt();
  render(); // 카운트다운 갱신
}
function netResumeAttempt(){
  if(NET.ws||!NET.resuming) return;
  NET.resumeAttempts++; NET.resumeLastAttempt=Date.now();
  const opened=netOpenCredentialSocket("r-"+NET.epoch+"."+NET.seatToken,false); // 재시도 주소는 저장하지 않는다 — 이미 접속에 성공했던 주소다
  if(!opened.ok) return; // 유예 타이머의 다음 tick이 다시 시도한다
  const ws=opened.ws;
  NET.ws=ws; const sock=ws; const pubLive=()=>NET.ws===sock&&NET.resuming;
  ws.onopen=()=>{}; // r- credential은 소켓이 열리자마자 서버가 room_resumed/error를 스스로 보낸다 — 클라이언트가 먼저 보낼 프레임이 없다
  ws.onerror=()=>{}; // 유예 타이머가 재시도 — 실패마다 토스트를 띄우지 않는다
  ws.onclose=()=>{ if(NET.ws===sock) NET.ws=null; }; // 유예 안이면 다음 tick이 재시도, 유예 밖이면 이미 정리됨
  ws.onmessage=ev=>{ if(!pubLive()) return; let m; try{ m=JSON.parse(ev.data); }catch(e){ return; } netHandlePublicMessage(m); };
}
function netAbandonResume(msg){
  netClearResume();
  showToast(msg);
  netLeave(); newGame("pvp"); S.phase="menu"; render();
}
function netResumeExpire(){ netAbandonResume("🌐 연결이 끊겼습니다. 방 목록으로 돌아가 다시 참가해 주세요."); netListRooms(); }
window.netCancelResume=function(){ netAbandonResume("🌐 재접속을 취소했습니다."); netListRooms(); };
/* ===== #217 전투 화면 — 원본 battleModal()을 그대로 재사용한다 =====
   서버 스냅샷(protocol v4.2 §7 battle 화이트리스트)으로 원본 battleModal()이 읽는 모양의 표시용 전투 객체를 짓는다.
   4카테고리 메뉴·기술 4슬롯(쿨·봉인 사유·위력 범위)·가방·패키지·포획 조건·도망 확률·수동 턴 종료·버프 줄·아트 토큰·
   전투 이력이 원본과 같은 코드로 그려진다. 버튼은 원본 window.__act/__useItem/__throwBall/__flee/__pass/__openPkg →
   netAction → 공개 방에서는 의도만 전송(netSendAction)한다. 규칙 코어(__actCore 등)는 공개 방에서 호출되지 않는다.
   정보 경계: 상대 전투원의 미공개 기술은 서버가 kind만 주므로 자리표시 키로만 그린다(netAdaptSkills). 상대 가방·패키지·
   볼은 원본 mineView 마스킹 그대로 "비공개"다. 상대 전투원의 공격력은 공개된 종(ROSTER)·왕/동료 상수(BAL)로만 유도하고,
   유도할 수 없는 대리 출전(포획 하수인) 수치는 만들지 않는다(표기 "?"). */
function netSynthFighter(sd,you){
  sd=sd||{};
  const mine=sd.owner===NET.me, body=sd.bodyFight!==false;
  const rd=body&&sd.type==="minion"&&sd.rosterId?ROSTER.find(r=>r.id===sd.rosterId):null;
  const ad=netAdaptSkills(sd.skills);
  const own=you&&Array.isArray(you.pieces)?you.pieces:[];
  let atk=typeof sd.atk==="number"?sd.atk:undefined, skillAtk=typeof sd.skillAtk==="number"?sd.skillAtk:undefined;
  if(atk===undefined){
    if(body&&rd){ atk=rd.atk; skillAtk=rd.skill; }                                   // 공개된 종의 고정 수치
    else if(body&&(sd.type==="king"||sd.type==="ally")){ const b=BAL[sd.type]||{}; atk=b.atk||0; skillAtk=b.skill||0; }
    else if(!body&&mine){ // 내 대리 출전 — 내 말의 cap(자기 좌석 정보)에서 읽는다
      const hit=own.find(p=>p&&p.type===sd.type&&p.cap&&p.cap.element===sd.element&&(p.cap.artRosterId||null)===(sd.artRosterId||null))
        ||(you&&you.reserve&&you.reserve.element===sd.element?{cap:you.reserve}:null);
      if(hit&&hit.cap){ atk=hit.cap.atk; skillAtk=hit.cap.skillAtk; } }
  }
  const piece={id:null,owner:sd.owner,type:sd.type||null,rosterId:rd?rd.id:null,name:rd?rd.name:null,element:body?(sd.element||null):null,cap:null};
  const f=body?piece:{};
  Object.assign(f,{element:sd.element||null,hp:sd.hp,maxHp:sd.maxHp,shield:sd.shield||0,burn:sd.burn||0,weaken:sd.weaken||0,
    shock:sd.shock||0,shockFresh:!!sd.shockFresh,dmgCut:sd.dmgCut||0,focusCharge:!!sd.focusCharge,vulnMark:!!sd.vulnMark,
    crack:sd.crack||0,harden:sd.harden||0,hardenPct:sd.hardenPct||0, // #233: Jupiter room.js 가 battle.a/d 에 함께 보낸다(stIcons 표시용)
    evadeDown:sd.evadeDown||0,evadeDownR:sd.evadeDownR||0,tideMark:sd.tideMark||0,tideHeld:!!sd.tideHeld, // #241 표시용 — 서버가 보내면 쓰고 없으면 0 (Jupiter 후속)
    skills:ad.skills,cds:ad.cds,revealedSkills:ad.revealedSkills,atk:atk,skillAtk:skillAtk||0,cd:typeof sd.cd==="number"?sd.cd:0,
    powerBuff:sd.buff==="power",fleeBoost:sd.buff==="escape",artRosterId:body?null:(sd.artRosterId||null),
    reaperSeal:sd.reaperSeal||0}); // #234 REVISE 2차: 자기 전투원에만 온다 — 상대 쪽은 키가 없어 0
  if(!body) piece.cap=f;
  return {piece,f};
}
function netSynthBattle(bd,you){
  if(!bd) return null;
  const A=netSynthFighter(bd.a,you), D=netSynthFighter(bd.d,you);
  const a=bd.a||{}, d=bd.d||{};
  const B={attP:A.piece,defP:D.piece,fa:A.f,fd:D.f,round:bd.round||1,phase:bd.phase||0,actSeq:bd.actSeq||0,
    maxRounds:bd.maxRounds!=null?bd.maxRounds:null,recA:a.rec||0,recD:d.rec||0,itemsA:a.items||0,itemsD:d.items||0,
    itemRoundA:!!a.itemRound,itemRoundD:!!d.itemRound,lastItemA:a.lastItem!=null?a.lastItem:null,lastItemD:d.lastItem!=null?d.lastItem:null,
    ballThrowA:!!a.ballThrow,ballThrowD:!!d.ballThrow,buffA:a.buff||null,buffD:d.buff||null,
    blog:Array.isArray(bd.log)?bd.log.slice():[],msgQ:[],menu:null,
    bonus:bd.bonus&&(bd.bonus.side==="A"||bd.bonus.side==="D")?{side:bd.bonus.side,stage:"active",allowed:Array.isArray(bd.bonus.allowed)?bd.bonus.allowed.slice():[0,1,2],saved:{}}:null}; // #241 R1 번개 꼬리 추가 공격 단계 — 서버 좌석 프레임 필드(Jupiter 후속)
  /* #233 (GDD-23 4.4·7.9): 공개 방 전투 화면은 선턴을 **다시 계산하지 않고 서버가 보낸 actor 에서 복원**한다.
     decideFirstSide 는 spd·grade·vanguardTurn 을 읽는데 그 셋은 상대 전투 뷰에 없고(7.9 등급은 소유자 전용),
     앞으로도 보낼 수 없다. 그대로 두면 spd 0·0·grade null 로 떨어져 항상 "A" 가 되어 battleModal 이
     틀린 패널·행동 메뉴를 그린다(Jupiter Q2). actor 와 phase 만으로 선턴이 완전히 유도되므로
     서버 필드를 늘리지 않고 여기서 되돌린다: phase 0 의 행위자가 곳 선턴이다. */
  if(bd.actor==="A"||bd.actor==="D") B.firstSide=(B.phase===0)?bd.actor:(bd.actor==="A"?"D":"A");
  B.intro=true; B.bannerKey=B.round+"-"+B.phase; // 진입 카운트다운·행동 배너는 서버 fx가 재생한다 — 원본의 로컬 재생 분기를 타지 않는다
  B.actorOwner=bd.actor==="A"?a.owner:bd.actor==="D"?d.owner:(actorOfPhaseOf(B)==="A"?a.owner:d.owner); // 서버가 계산한 행위자
  B.mySide=a.owner===NET.me?"A":"D";
  return B;
}
function actorOfPhaseOf(B){ const s=S.battle; S.battle=B; try{ return actorOfPhase(); } finally{ S.battle=s; } }
/* 무대 렌더 — bid가 진행 중 전투면 S.battle(라이브)로, 지난 전투면 그 전투의 마지막 스냅샷으로 그린다. 그릴 스냅샷이 없으면 false. */
function netRenderBattleStage(bid){
  const live=!!S.battle&&bid===NET.fxLiveBid;
  let B;
  if(live) B=S.battle;
  else { const snap=NET.fxBattleSnaps[bid]; if(!snap) return false; B=netSynthBattle(snap.battle,snap.you); }
  if(!netFxPendingFor(bid)) NET.fxDisp[bid]={A:{hp:B.fa.hp,sh:B.fa.shield||0},D:{hp:B.fd.hp,sh:B.fd.shield||0}}; // 재생할 이벤트가 없으면 최신 값
  const dd=NET.fxDisp[bid];
  if(dd){ if(dd.A&&dd.A.hp!==undefined){ B.dispHpA=dd.A.hp; B.dispShA=dd.A.sh||0; } if(dd.D&&dd.D.hp!==undefined){ B.dispHpD=dd.D.hp; B.dispShD=dd.D.sh||0; } }
  const m=NET.battleMenu;
  B.menu=(live&&m&&m.bid===bid&&m.actSeq===B.actSeq&&m.round===B.round&&m.phase===B.phase)?m.menu:null; // 같은 행동 차례 안에서만 하위 메뉴 유지
  const saved=S.battle; S.battle=B;
  try{ battleModal(); } finally{ if(!live) S.battle=saved; }
  const core=window.__menu;
  window.__menu=key=>{ if(live) NET.battleMenu={bid,actSeq:B.actSeq,round:B.round,phase:B.phase,menu:key||null}; if(core) core(key); };
  if(!live){ try{ const ob=$("overlayBox"); if(ob&&ob.querySelectorAll) Array.prototype.forEach.call(ob.querySelectorAll("button"),b=>{ if(b.id!=="bmenuBack") b.disabled=true; }); }catch(e){} }
  return true;
}
/* #217 v3 — data.modal(탐색 보상·패키지 개봉·포획 후 기술 교체·VIP 선택·출전 공개 등 2차 선택 화면). 소유 좌석에는
   서버가 그 좌석 엔진이 실제로 그린 html·버튼 문구를 주므로 그대로 그리고 클릭만 {t:"modal",seq,i}로 돌려보낸다.
   비소유 좌석은 seq/owner/count만 받으므로 원본 비소유자 마스킹과 같은 대기 화면만 보여준다. */
function netRenderModalOverlay(m){
  if(m.owner===NET.me&&m.html!==undefined){
    const buttons=(m.buttons||[]).map((b,i)=>[b.text,()=>{ if(!b.disabled) netSendAction({t:"modal",seq:m.seq,i}); },!!b.disabled]);
    _modalCore(m.html,buttons);
  } else {
    _modalCore(`<h2>🔒 상대 선택 대기 중…</h2><p style="margin:8px 0;color:var(--dim)">상대가 행동을 선택하고 있습니다. 완료되면 자동으로 진행됩니다.</p>`,[]);
  }
}
/* 오버레이 결정 — 재생 중인 전투 무대 > 대기 중인 선택창 > 진행 중 전투 > 없음.
   같은 내용이면 다시 그리지 않는다(재생 중인 흔들림·피해 숫자 DOM을 새 스냅샷이 지우지 않게). */
function netOverlayWanted(){
  if(NET.stageBid!=null) return {kind:"battle",bid:NET.stageBid};
  if(S&&S._pendingModal) return {kind:"modal"};
  if(S&&S.battle) return {kind:"battle",bid:NET.fxLiveBid};
  return {kind:"none"};
}
function netSyncOverlays(force){
  if(!NET.publicMode||!S) return;
  const w=netOverlayWanted();
  let hidden=true; try{ hidden=$("overlay").classList.contains("hidden"); }catch(e){}
  let sig;
  if(w.kind==="battle"){
    const busy=fxLocked(), snap=NET.fxBattleSnaps[w.bid];
    sig="b|"+w.bid+"|"+(busy?"busy":("idle|"+(snap?snap.rev:"-")));
  } else if(w.kind==="modal"){ const m=S._pendingModal; sig="m|"+m.seq+"|"+m.owner+"|"+m.count+"|"+(m.html||"")+"|"+JSON.stringify(m.buttons||[]); }
  else sig="none";
  if(!force&&sig===NET.overlaySig&&(w.kind==="none"||!hidden)) return;
  NET.overlaySig=sig;
  if(w.kind==="battle"){
    if(netRenderBattleStage(w.bid)) NET._overlayOpen=true;
    else { NET.overlaySig="none"; if(NET._overlayOpen){ close(); NET._overlayOpen=false; } }
  } else if(w.kind==="modal"){ netRenderModalOverlay(S._pendingModal); NET._overlayOpen=true; }
  else if(NET._overlayOpen){ close(); NET._overlayOpen=false; }
}
const _renderCoreForBattle=render;
render=function(){ _renderCoreForBattle(); if(NET.publicMode) netSyncOverlays(); netResumeBarSync(); };
/* #217 재접속 중 표시 — 사이드 패널은 보드·전투 화면에서 서랍/오버레이 뒤에 있어 보이지 않는다(실브라우저 E2E 발견).
   어느 화면에서 끊겨도 보이도록 오버레이·배너 위에 고정 상태 줄을 둔다. 재접속 중 입력은 잠긴다(netFxBusyNow). */
function netResumeBarSync(){
  let el=document.getElementById("netResumeBar");
  const on=NET.publicMode&&NET.resuming;
  if(!on){ if(el&&el.classList) el.classList.add("hidden"); return; }
  if(!el){ el=document.createElement("div"); el.id="netResumeBar"; if(document.body&&document.body.appendChild) document.body.appendChild(el); }
  if(el.setAttribute){ el.setAttribute("role","status"); el.setAttribute("aria-live","polite"); }
  const remain=Math.max(0,Math.ceil((NET.resumeDeadline-Date.now())/1000));
  el.innerHTML=`<b>🌐 재접속 중…</b><span>연결이 끊겼습니다. 자동으로 다시 연결합니다 (남은 시간 ${remain}초 · 시도 ${NET.resumeAttempts}회)</span><button type="button" class="danger" onclick="netCancelResume()">포기하고 방 목록으로</button>`;
  if(el.classList) el.classList.remove("hidden");
}
window.netConnect=function(){
  if(NET.ws){ showToast("이미 서버에 연결 중입니다."); return; }
  const inp=$("netServer");
  /* 목적지 판정이 소켓 생성보다 먼저다. 여기서 막으면 코드는 이 탭 밖으로 한 바이트도 나가지 않는다.
     허용 밖 주소로는 폴백하지 않는다 — 조용히 기본값으로 붙으면 사용자는 어디에 붙었는지 모른다. */
  const parsed=netParseAddr(inp&&inp.value&&inp.value.trim()?inp.value:netServerDefault());
  if(!parsed.ok){ showToast(NET_ADDR_HINT); return; }
  const addr=parsed.addr;
  try{ localStorage.setItem("netServer",addr); }catch(e){} // 허용된 주소만 기억한다 — 코드는 어떤 저장소에도 쓰지 않는다
  if(!NET.code&&!netCaptureCode()){ netCodePrompt(); return; } // 메뉴에서 이미 캡처했으면 그대로 쓴다
  const url=(location.protocol==="https:"?"wss://":"ws://")+addr;
  let ws;
  // 코드는 URL이 아니라 하위 프로토콜 토큰으로만 나간다. 예외 메시지는 싣지 않는다 — 브라우저가
  // 잘못된 토큰을 알릴 때 그 안에 코드가 그대로 들어 있을 수 있다.
  try{ ws=new WebSocket(url,[NET_PROTOCOL_MARKER,NET.code]); }catch(e){ showToast("서버 연결 실패: "+url); return; }
  NET.ws=ws;
  const st=$("netStatus"); if(st){ st.style.display=""; st.textContent="🌐 서버 접속 중…"; }
  /* 이 소켓의 콜백은 이 소켓(sock)만 본다 — 재접속으로 NET.ws가 바뀌어도 관측이 섞이지 않는다. */
  const sock=ws;
  let protoFail=false;
  /* #67 버려진 소켓(stale socket) 차단. 취소·재접속으로 NET.ws가 다른 소켓을 가리키면 이 소켓은 이미 버려진 것이고,
     그 뒤늦은 콜백은 새 연결의 것이 아니다. 브라우저는 close() 뒤에도 이미 큐에 들어간 open·message·error·close를 마저
     전달하므로, 이 확인이 없으면 옛 소켓이 새 소켓을 지우거나(NET.ws=null), 전역 NET.ws를 타고 새 소켓으로 회신하거나
     (netSend), 새 연결의 상태 배지·토스트·큐·코드·매치 상태를 덮어쓴다. 버려진 소켓은 자기만 닫고 조용히 물러난다.
     예외는 아래 protoAbort() 하나 — 그것만이 (NET.ws===sock 확인 뒤) 자기 소켓을 의도적으로 지운다. */
  const live=()=>NET.ws===sock;                            // 이 소켓이 아직 "지금의 연결"인가
  const dropStale=()=>{ try{ sock.close(); }catch(e){} };  // 버려진 소켓은 닫기만 한다 (상태·화면 불변)
  /* #66 협상 실패 = 실패로 닫는다(fail closed). 값을 되풀이하지 않고 즉시 끊고, 이 접속을 매칭 전
     실패 경계로 취급해 들고 있던 코드를 버린다(코드는 어떤 저장소에도 쓰지 않으므로 지우면 그만이다).
     화면 갱신을 먼저 하고 안내를 나중에 얹는다 — render()가 상태 배지를 다시 그리면서 고정 안내를
     "서버 접속 중…"으로 되돌리는 순서 역전을 막는다. */
  const protoAbort=()=>{
    protoFail=true;
    try{ sock.close(); }catch(e){}
    if(NET.ws===sock) NET.ws=null;
    NET.queued=false; NET.code=null;
    render();
    const s=$("netStatus"); if(s){ s.style.display=""; s.textContent=NET_PROTO_FAIL; }
    showToast(NET_PROTO_FAIL);
  };
  /* 협상 결과는 공개 마커와의 정확 비교에만 쓰고 화면·로그에 싣지 않는다. 서버 계약
     (server/security.js selectProtocol)상 되돌아오는 값은 공개 마커 하나뿐이므로, 그 밖의 값
     — 비밀 코드·빈 값·임의 문자열 — 은 서버가 계약을 어겼거나 중간에 누가 끼어든 것이다. */
  ws.onopen=()=>{
    if(!live()){ dropStale(); return; } // 버려진 소켓의 뒤늦은 open — 협상 판정도, 상태 갱신도 하지 않는다
    if(sock.protocol!==NET_PROTOCOL_MARKER){ protoAbort(); return; }
    const s=$("netStatus"); if(s) s.textContent="🌐 매칭 요청…"; };
  // 서버는 실패 사유를 알려주지 않는다(코드 존재·길이·오답을 흘리지 않으려는 설계). 그래서 안내는
  // 원인 후보를 나열하는 쪽이다 — 코드 값 자체는 어느 문구에도 넣지 않는다.
  ws.onerror=()=>{ if(protoFail||!live()) return; // 협상 실패 뒤·버려진 소켓의 콜백은 지금의 안내를 덮지 않는다
    showToast("🌐 서버 연결 오류 — 서버(npm start)가 켜져 있는지, 접속 코드가 맞는지 확인하세요."
    +(location.protocol==="file:"?" (file:// 로 연 페이지는 서버가 Origin을 거부합니다 — http://127.0.0.1:8080 처럼 서버가 서빙하는 주소로 여세요.)":"")); };
  ws.onclose=()=>{ if(protoFail) return; // 정리는 protoAbort()가 이미 끝냈다
    if(!live()) return; // 버려진 소켓의 종료는 새 연결을 지우지 않는다 (NET.ws는 이미 새 소켓의 것)
    NET.ws=null;
    if(NET.mode&&S&&S.phase!=="over") showToast("🌐 서버 연결이 끊겼습니다.");
    else if(NET.queued&&!NET.started){ NET.queued=false;
      // 매칭 전에 끊겼다 = 코드 거부(401)일 수 있고, 서버가 다시 켜졌다면 코드 자체가 새로 발급됐다.
      // 들고 있던 코드를 버려서 다음 시도가 재입력 모달을 띄우게 한다.
      NET.code=null;
      showToast("🌐 연결 종료 — [배치 완료 → 매칭 시작]으로 다시 시도하세요 (접속 코드를 다시 묻습니다)."); render(); }
    else { const s=$("netStatus"); if(s) s.textContent="연결 종료"; } };
  ws.onmessage=ev=>{
    if(protoFail) return; // 계약을 벗어난 협상 뒤에 오는 프레임은 읽지도, 매치를 시작하지도 않는다
    if(!live()){ dropStale(); return; } // 버려진 소켓의 프레임은 읽지도, 새 소켓으로 회신하지도 않는다
    let m; try{ m=JSON.parse(ev.data); }catch(e){ return; }
    if(m.type==="waiting"){ const s=$("netStatus"); if(s) s.textContent="🌐 상대 대기 중… (상대도 온라인 PVP를 누르면 시작)"; return; }
    if(m.type==="matched"){
      NET.me=m.you==="p1"?0:1;
      if(NET.me===0){ // P1: 시드 + 내 배치 전송 → 상대 배치(hello2) 수신 후 시작
        NET.pendingSeed=Math.floor(Math.random()*0x7fffffff);
        netSend({t:"hello",seed:NET.pendingSeed,setup:NET.mySetup});
        const s=$("netStatus"); if(s) s.textContent="🌐 매칭 완료 — 상대 배치 수신 대기…";
      } else { const s=$("netStatus"); if(s) s.textContent="🌐 매칭 완료 — 시작 대기…"; }
      return; }
    if(m.type==="opponent_left"){
      if(NET.mode&&S&&S.phase!=="over"&&S.phase!=="menu"){
        gameOver(NET.me,"resign");
        const msg="🌐 상대 연결 끊김 — 몰수승!"; addLog(msg,"imp"); showToast(msg); render();
      } else { showToast("🌐 상대가 나갔습니다 — 매칭을 다시 시작해 주세요."); try{ws.close();}catch(e){} }
      return; }
    if(m.t==="hello"){ // P2: 시드+상대 배치 수신 → 내 배치 회신 후 시작
      if(!NET.started){ netSend({t:"hello2",setup:NET.mySetup}); netStart(m.seed,[m.setup,NET.mySetup]); }
      return; }
    if(m.t==="hello2"){ if(!NET.started) netStart(NET.pendingSeed,[NET.mySetup,m.setup]); return; }
    if(m.t==="a"){ NET.queue.push(m.a); netPump(); return; }
  };
};
function netStart(seed,setups){
  NET.mode=true; NET.started=true; NET.preparing=false; NET.queued=false;
  NET.queue=[]; NET.modalSeq=0; NET.syncModal=null;
  setSeed(seed); // 동일 시드 → 이벤트 배치·전투 난수까지 양쪽 완전 일치
  startMode("pvp"); // 공유 시드로 게임 재생성
  applyNetSetup(0,setups[0]); // 양측 사전 배치 적용 (setups: [P1, P2] — 양쪽 동일 순서)
  applyNetSetup(1,setups[1]);
  S.selected=null;
  addLog(`🌐 온라인 매치 시작 — 당신은 P${NET.me+1}입니다 (자기 진영이 화면 아래). 양측 사전 배치가 적용되었습니다.`,"sys"); // #93 양측 모두 자기 진영 하단
  showToast(`🌐 매칭 완료! 당신은 P${NET.me+1} — 자기 진영이 화면 아래입니다`);
  beginPlay(); // 무작위 선공(시드) → 바로 플레이 시작
}
