"use strict";
/* ===== #265·#322·#324 (v0.4.16 · CJ 2026-10-30 승인) 싱글플레이 — 튜토리얼 Rev2 · P01 싱글 선택 · P02 무제한 AI 난이도 · S04p PVE 결과 =====
   의미·문구는 PLAN Singleplayer Draft §3R(튜토리얼 Rev2 · 단계·문구·트리거의 유일한 표 3R.3)·'v0.4.16 확정 계약'(Venus),
   시각 배치는 ART '2026-10-30 튜토리얼 재설계 시각 계약'(Earth), API 는 SERVER Operations(Jupiter)가 정본이다:
     signup 201 · login 200 · GET /api/auth/session 200 의 progress:{tutorialDone, aiClearedTier:0..3, tutorial:{basic,advanced}}
       — 카테고리 값은 pending|completed|skipped|exempt, tutorialDone = (advanced ≠ pending) = 해금
     POST /api/profile/tutorial {v:2,userId,category:"basic"|"advanced"|"all",end} → 200 {progress}
       basic: edge(완료)|skip · advanced: king|edge|wipe(완료)|skip · all: skip(대기 카테고리 전부 · 원자적)
       409 E_TUTORIAL_CONFLICT·E_BASIC_REQUIRED 는 progress 를 함께 준다 — 그 카테고리가 처리됨이면 ACK 로 본다(3R.1)
     POST /api/profile/ai-clear {v:1,userId,tier:1..3,end:"king"|"edge"|"wipe"} → 200 {progress}
   - 상태는 셋: 확인됨·해금 / 확인됨·미해금 / 확인 불가(오류·필드 누락·형식 이상 — 카테고리가 없으면 옛 서버로 보고 확인 불가). 확인 불가는 미해금으로도 해금으로도 취급하지 않는다.
   - 분기(§2): 새 로그인·가입 성공은 추가 [시작] 없이 로딩 → 미해금 질문 · 해금 로비. 유효 세션 페이지 재진입은 타이틀 먼저 → [시작].
     좌석 재접속(#237)과 401 로 멈춘 같은 계정 저장 확인이 먼저다.
   - 진행은 서버 응답의 progress 로만 바뀐다(낙관적 해금 없음). 저장은 카테고리 경계에서만: 기본 끝줄 승리 · 심화 실제 승·패 뒤 연습 마침 · 명시적 건너뛰기.
     새로고침·창 닫기·연결 끊김·기권·무승부는 저장하지 않는다(다음 진입 때 그 카테고리 처음부터).
   - 응답 유실(503·연결 실패·시간 초과)은 상태 조회 1회만 자동. 재시도는 사용자 버튼(조회 → 필요할 때만 저장). 요청 때의 계정·AUTH.gen 과 다른 응답은 버린다.
     401 은 같은 계정으로 다시 로그인했을 때만 조회 뒤 다시 보낸다 — 계정 사이로 옮기지 않는다.
   - 튜토리얼은 실제 엔진·규칙이다. 기본 = 고정 합법 보드(고정 seed · 상대는 '행동 없이 차례 종료'와 고정 기본 공격만) · 심화 = 정상 브론즈 경기(플레이어 선공만 튜토리얼 전용).
     시드·AI 대본·시계 정지·선공은 튜토리얼 경기 객체(SP.tut.game === S)에서만 켜지고, 경기가 바뀌면(gameReset) 시드는 원래 RNG 로 돌아간다.
   - 계정 없는 경로(file:// · DB 없는 서버 = AUTH off)는 튜토리얼을 강요하지 않고, 실버·골드 해금은 이번 로드 메모리만(SP.local).
   - 브라우저 AI 경기의 자기신고(② 등급) 진행 표시다 — 공식 전적·최근 20경기·재화·랭킹·보상과 무관하고 승리 증명이 아니다. */
const SP_API={tutorial:"/api/profile/tutorial",clear:"/api/profile/ai-clear"};
const SP_TIERS=["bronze","silver","gold"];                       // AI_TIER 키 — 서버 tier = 순서 + 1
const SP_FUTURE=["플래티넘","다이아","마스터","그랜드마스터","천상계"]; // 추후 공개 — 서버·엔진 모두 없다(골드 클리어가 열지 않는다)
const SP_TUT_LEVEL="bronze", SP_ENDS=["king","edge","wipe"], SP_CAT=["pending","completed","skipped","exempt"];
/* uid: progress 의 주인 · tut: 튜토리얼 문맥(아래 spTutNew) · run: 무제한 AI 경기({tier,game}) · ask: 첫 질문 · dlg: 모달 안내(skipq·bp·a11)
   save: 마지막 저장 {kind,body,uid,st:busy|ok|fail|auth,msg,unknown} · pending: 401 로 멈춘 저장 · note: 해금 알림 1회 · held/aiHeld: 직전 정지 여부
   local: 계정 없는 체험의 클리어(이번 로드) · gen: progress 를 받은 인증 세대 · rng: 튜토리얼이 시드를 걸기 전의 RNG */
const SP={uid:null,progress:/** @type {null|{tutorialDone:boolean,aiClearedTier:number,tutorial:{basic:string,advanced:string}}} */(null),tut:/** @type {any} */(null),run:/** @type {any} */(null),
  ask:false,dlg:/** @type {null|string} */(null),save:/** @type {any} */(null),pending:/** @type {any} */(null),note:"",held:false,aiHeld:false,restore:/** @type {any} */(null),local:0,gen:-1,
  rng:/** @type {any} */(null)};

function spParseProgress(p){
  if(!p||typeof p!=="object"||typeof p.tutorialDone!=="boolean"||!Number.isInteger(p.aiClearedTier)||p.aiClearedTier<0||p.aiClearedTier>3) return null;
  const t=p.tutorial; if(!t||typeof t!=="object"||!SP_CAT.includes(t.basic)||!SP_CAT.includes(t.advanced)) return null; // 카테고리 없음 = 옛 서버 → 확인 불가
  if(p.tutorialDone!==(t.advanced!=="pending")||t.advanced!=="pending"&&t.basic==="pending") return null; // 해금 파생·순서가 어긋난 응답은 형식 이상
  if(!p.tutorialDone&&p.aiClearedTier>0||t.basic==="exempt"&&t.advanced!=="exempt") return null; // 미해금 계정의 클리어 · 기본만 면제 = 있을 수 없는 조합(확인 불가). 완료/면제·건너뜀/면제는 옛 서버 롤백 뒤 007 이 실제로 내는 값(유효)
  return {tutorialDone:p.tutorialDone,aiClearedTier:p.aiClearedTier,tutorial:{basic:t.basic,advanced:t.advanced}};
}
/* 같은 계정은 단조로만 합친다 — 처리된 카테고리는 다시 대기가 되지 않고, 티어는 내려가지 않는다 */
function spMerge(o,p){
  const c=k=>p.tutorial[k]!=="pending"?p.tutorial[k]:o.tutorial[k], tutorial={basic:c("basic"),advanced:c("advanced")};
  return {tutorialDone:tutorial.advanced!=="pending",aiClearedTier:Math.max(o.aiClearedTier,p.aiClearedTier),tutorial};
}
/* acctSetUser 가 서버 신원 응답마다 부른다. 다른 계정이면 옛 계정의 진행·경기·저장을 모두 버린다 */
function spOnUser(b){
  const uid=String(b.userId);
  if(SP.uid!==uid){
    const kept=SP.pending&&SP.pending.game===S; // 401 로 남겨 둔 옛 계정의 경기 — 다른 계정에게 보이지 않게 버린다
    SP.uid=uid; SP.progress=null; SP.tut=null; SP.run=null; SP.save=null; SP.pending=null; SP.note=""; SP.ask=false; SP.dlg=null; spDlgClose(); spCoachOff(); spSync();
    if(kept){ uiResetScreen(); newGame("pvp",{phase:"menu"}); }
  } else if(SP.gen!==AUTH.gen) SP.progress=null; // 같은 계정의 새 인증 세대 — 옛 캐시를 버린다: 이번 응답에 progress 가 없으면 '확인 불가'(미해금으로 오인하지 않는다)
  SP.gen=AUTH.gen;
  const p=spParseProgress(b.progress), o=SP.progress;
  if(p) SP.progress=o?spMerge(o,p):p;
}
function spSignedIn(){ return AUTH.state==="in"&&!!AUTH.user&&SP.uid===AUTH.user.userId; }
function spNeedTut(){ return spSignedIn()&&!!SP.progress&&!SP.progress.tutorialDone; } // 서버가 미해금이라고 답했을 때만
function spCatNow(){ return SP.progress&&SP.progress.tutorial.basic==="pending"?"basic":"advanced"; }
/* 지금 화면의 경기가 튜토리얼 경기일 때만 문맥을 준다 — 다른 경기(무제한 AI·온라인·로비)에서는 튜토리얼 동작이 하나도 켜지지 않는다 */
function spT(){ const T=SP.tut; return T&&T.game===S&&S?T:null; }
/* AI 보류 = 질문·모달 안내·기본 회복 확인([다음] 전 상대 차례). 시계 정지 = AI 보류 + 말풍선이 떠 있는 동안(기본은 내내 · 심화는 단계 말풍선 동안, §3R.0) */
function spHeld(){ const T=spT(); return SP.ask||!!SP.dlg||!!(T&&T.hold); }
function spClockHeld(){ const T=spT(); return spHeld()||!!(T&&T.step); }
/* 정지 ↔ 재개 전이 — 준비·정기 상점·B08 마감(clkHold), 행동·전투·대상 선택 시계(turnClockWants 가 spClockHeld 를 본다), AI 예약(aiHeldNow 가 spHeld 를 본다) */
function spSync(){
  const c=spClockHeld(); if(c!==SP.held){ SP.held=c; clkHold(c); try{ turnClockSync(); }catch(e){} }
  const a=spHeld(); if(SP.aiHeld&&!a) aiHoldRelease(); SP.aiHeld=a;
}
function spAnnounce(t){ showToast(t); const el=$("spLive"); if(el) el.textContent=t; }
function spTierKo(i){ return AI_LEVEL_KO[SP_TIERS[i]]; }
/* 튜토리얼 고정 장면의 시드 — 경기가 바뀌는 순간(ui.js gameReset) 원래 RNG 로 되돌린다(튜토리얼 밖에 시드를 남기지 않는다) */
function spSeed(n){ if(!SP.rng) SP.rng={prev:RNG}; setSeed(n); }
function spRngRestore(){ if(SP.rng){ RNG=SP.rng.prev; SP.rng=null; } }

/* ===== 진입 분기 ===== */
/* 로그인·가입·세션 복원 뒤(account.js). fresh = 이 탭에서 새로 로그인·가입에 성공했다.
   ① 401 로 멈췄던 같은 계정의 저장이 먼저다(§3.7): 남겨 둔 원 화면(질문·진행도·결과)으로 되돌리고 상태 조회만 한다 — 아직이면 [다시 시도](사용자)로만 다시 보낸다.
   ② 새 로그인·가입은 추가 [시작] 없이 로딩으로 — 미해금이면 질문, 해금·확인 불가면 로비(uiStart 가 가른다). 좌석 재접속이 시작됐거나 이미 입장했으면 하지 않는다.
   ③ 유효 세션으로 페이지를 다시 연 경우(fresh 아님)는 종전대로 타이틀 먼저 → [시작] 에서 가른다. */
function spRoute(fresh){
  if(AUTH.state!=="in") return;
  const v=SP.pending;
  if(v&&v.uid===AUTH.user.userId){ spRestore(v); return; }
  if(fresh) spEnter();
}
/* 남은 저장 문맥(v)을 원 화면으로 되돌리고 상태 조회만 한다. 좌석 재접속이 진행 중이면 화면에서만 걷고 문맥은 SP.pending 에 그대로 둔다 —
   좌석이 끝나 로비로 오는 순간(spGate) 같은 경기 객체를 단일 커밋 지점(commitNewGame)으로 다시 세우고 이어 간다. 상태가 확정되기 전에는 새 튜토리얼을 시작하지 않는다 */
function spRestore(v){
  if(NET.roomId!=null||!!NET.ws&&!NET.lobbyOnly){ SP.ask=false; SP.dlg=null; spDlgClose(); spCoachOff(); spSync(); if(S===v.game){ uiResetScreen(); newGame("pvp",{phase:"menu"}); } return; }
  SP.pending=null;
  if(v.game&&v.game.phase!=="menu"){ netLeave(); if(S!==v.game) commitNewGame(v.game); UI.entered=true; if(v.tut){ SP.tut=v.tut; SP.tut.idle=null; if(!SP.tut.anim) SP.tut.f.anim=false; } SP.ask=!!v.ask; SP.dlg=v.dlg||null; render(); } // 같은 계정 재로그인 — 연출 대기는 새로(옛 대기는 경기 교체로 버려졌을 수 있다) // 되살린 로컬 경기도 spStart 와 같은 경계 — 좌석 뒤 로비 진입이 연 방 목록 소켓을 닫는다
  spSync(); spRecheck(v,false);
}
/* 로비로 보내려는 순간([시작]·toLobby·로비 진입) — 남은 저장 문맥이 먼저, 그다음 미해금 튜토리얼. 좌석 재접속 중이면 아무것도 하지 않는다 */
function spGate(){
  if(AUTH.state!=="in"||NET.roomId!=null) return false;
  const v=SP.pending; if(v&&v.uid===AUTH.user.userId){ uiResetScreen(); spRestore(v); return true; }
  if(spNeedTut()){ uiResetScreen(); spTutEnter(); return true; }
  return false;
}
function spEnter(){ if(AUTH.state==="in"&&!UI.entered&&!NET.ws&&NET.roomId==null) uiStart(); }
/* 로컬 PVE 시작 전에 로비 방 목록 소켓을 닫는다 — 열린 채면 NET.publicMode 가 켜져 있어 PVE 행동이 공개 방 회선으로 간다(toLobby 와 같은 netLeave · 좌석 기록은 건드리지 않는다) */
function spStart(level){ netLeave(); startMode("pve",{aiLevel:level}); }
/* 튜토리얼 문맥 — cat: basic|advanced · game: 지금 튜토리얼 경기 · step: 말풍선 단계(null = 안내 없는 자유 경기) · f: 단계 안 진행 표시
   hold: 상대 차례 보류 · seen: 심화 자유 경기에서 실제로 본 것(상점·버닝 — 턴 수로 판단하지 않는다) · match: 심화 실제 경기 결과(연습 장면 동안 보존)
   practice: 지금 연습 장면(shop|burn) · todo: 남은 연습 · res: 이 카테고리 저장 결과 · anim: 진행도 이동 끝 · abort: 끝나지 않은 경기 */
function spTutNew(cat){ return {cat,game:/** @type {any} */(null),step:/** @type {null|string} */(null),f:/** @type {any} */({}),ids:/** @type {any} */({}),hold:false,
  seen:{shop:false,burn:false},match:/** @type {any} */(null),practice:/** @type {null|string} */(null),todo:/** @type {string[]} */([]),res:"",anim:false,abort:false,attempt:0,t0:0,focus:""}; }
/* 튜토리얼 입장 — 진입마다 질문 1회. 그 카테고리의 경기를 먼저 세우고(질문 동안 시계·AI 정지) 그 위에 질문을 띄운다 */
function spTutEnter(){
  const cat=spCatNow();
  SP.ask=true; SP.save=null; SP.dlg=null; SP.run=null; SP.tut=null;
  if(cat==="basic") spBasicStart(); else spAdvStart();
  if(!spT()){ SP.ask=false; SP.tut=null; spSync(); return; } // 입장 게이트(계정 확인 중 등)에 막혔다
  spSync(); spAskRender();
}
const _spUiStart=window.uiStart;
window.uiStart=function(){ if(!acctGateMsg()&&spGate()) return; _spUiStart(); }; // 타이틀 [시작] — 남은 저장 문맥 · 미해금 계정은 로비 대신
const _spToLobby=window.toLobby;
window.toLobby=function(){ if(spGate()) return; _spToLobby(); }; // 결과·준비의 로비 복귀도 같다(미해금이면 다시 질문부터)
const _spRematch=window.rematch;
window.rematch=function(){ if(SP.run&&SP.run.game===S){ const t=SP.run.tier; uiResetScreen(); spPlay(t-1); return; } _spRematch(); };
/* 로비에 들어오는 순간(lobbyLoad) — 다른 경로(좌석 종료·재접속 포기 등)로 들어와도 남은 저장 문맥 → 미해금 튜토리얼 순서로 · 해금 알림은 로딩이 끝난 뒤 한 번 */
function spLobbyEnter(){
  if(NET.roomId==null&&(SP.pending||spNeedTut())){ setTimeout(()=>{ if(uiScreenName()==="lobby") spGate(); },0); return; }
  spNote();
}
function spNote(){ if(SP.note&&uiScreenName()==="lobby"&&lobbyReady()){ const t=SP.note; SP.note=""; spAnnounce(t); } } // lobbyRerender 도 부른다
const SP_UNLOCK_NOTE="🔓 무제한 AI 대전이 열렸어요. 브론즈부터 도전해 보세요.";

/* ===== 3R.3 제품 문구 (유일한 원본은 PLAN §3R.3 — 여기는 그 사본이다) ===== */
const SP_Q={basic:["튜토리얼로 배워 볼까요?","기본 규칙을 익히고 AI와 첫 경기를 해요. 공식 전적에는 들어가지 않아요."],
  advanced:["심화 튜토리얼을 이어서 할까요?","상점과 배치를 배우고 AI와 첫 경기를 해요. 공식 전적에는 들어가지 않아요."]};
const SP_SKIP={basic:["기본 튜토리얼을 건너뛸까요?","건너뛰면 심화 튜토리얼로 넘어가요."],advanced:["심화 튜토리얼을 건너뛸까요?","싱글플레이는 열리지만 남은 학습은 건너뜀으로 남아요."]};
const SP_SAY={
  B1:"여기가 전장이에요. 빛나는 3줄이 내 말을 놓는 내 진영이에요.",
  B2:"왕을 잃으면 져요. 왕과 동료는 자기 스킬로 싸우고, 폭탄에 닿아도 폭탄만 없애고 살아남아요.",
  B3:"상대 말은 정체를 모르는 ?로 보여요. 숲에 숨은 말은 바로 옆에 가야 보여요.",
  B4:"상대 왕을 잡거나, 내 왕이 상대 끝줄에 서거나, 상대 하수인과 동료를 모두 없애면 이겨요.",
  B5:"흔적 위에 선 말로 탐색하면 선물을 받아요. 탐색도 이번 차례의 행동이에요.",
  B6:"말은 위·아래·옆으로 한 칸 움직여요. 상대 옆에 새로 붙으면 꼭 싸워요.",
  B7:"불→풀→땅→번개→물→불, 화살표 왼쪽이 유리해요. 스탯과 시너지는 이 창에서 확인해요.",
  B8:"회복을 고르면 차례가 끝날 때마다 최대 HP의 5%가 차요. 다른 행동을 하거나 싸우면 회복이 풀려요.",
  B9:"상대 진영에 들어간 내 말이 있으면 텔레포트로 두 말의 자리를 바꿔요. 왕을 상대 끝줄로 보내면 이겨요.",
  BPdone:"기본을 마쳤어요! 이제 실제 경기를 준비해 봐요.", BPskip:"기본을 건너뛰었어요. 심화에서 실제 경기를 준비해 봐요.",
  A1:"카드를 누르면 스탯과 스킬을 볼 수 있어요. 마음에 드는 하수인을 사서 필드를 채워요.",
  A2:"같은 속성(왕국)이나 같은 타입(아키타입)을 모으면 시너지가 켜져요. 동료가 쓰러지면 켜지는 왕·동료 시너지와 전설 패시브도 있어요.",
  A3:"왕과 동료의 속성은 시작 상점에서 무료로 골라요. 속성을 바꾸면 스킬도 그 속성 스킬로 바뀌어요.",
  A4:"아이템은 가방에 담아 두었다가 필요할 때 써요. 회복약·몬스터 볼·시너지 교체 티켓 등이 있어요.",
  A5:"남은 코인으로 자유롭게 사 보세요. 필드를 다 채우면 [다음 단계]를 눌러요.",
  A6:"말을 누르고 내 진영 칸을 눌러 놓아요. 놓은 말을 다시 누르면 회수되고, [무작위 배치]로 한 번에 놓을 수도 있어요.",
  A7:"실전이에요, 내가 먼저 시작해요! 배운 세 가지 승리 중 하나를 노려 보세요.",
  A8:"정기 상점이에요. 20·40·60·80턴에 열리고, 늦을수록 높은 등급 하수인이 나와요.",
  A9:"버닝 타임! 이제 말이 곧게 2칸까지 가요. 상대 숲·상대 진영에서 출발하거나 지나거나 들어가면 1칸이에요.",
  A10win:"이겼어요! 아직 못 본 내용만 짧게 연습해요.", A10loss:"아쉬워요! 아직 못 본 내용만 짧게 연습해요.",
  A10b:"이 말을 곧게 2칸 움직여 보세요. 상대 숲·상대 진영에서 출발하거나 지나거나 들어가면 1칸이에요.",
  A11done:"심화까지 마쳤어요! 이제 무제한 AI 대전에서 실력을 겨뤄 보세요.", A11skip:"남은 학습을 건너뛰었어요. 무제한 AI 대전이 열렸어요."};
const SP_TAGS={minion:"싸우는 말",king:"잃으면 패배",ally:"왕을 돕는 싸움꾼",bomb:"닿은 하수인과 함께 사라짐",trap:"밟은 말은 2차례 못 움직임"}; // B2 이름표 5개
const SP_SHOP_TIERS=[[20,"⭐1~2",2],[40,"⭐2~3",3],[60,"⭐3~4",4],[80,"⭐4~5",5]];                    // A8 도해 — ECO.shopTurns·ECO.bonus 와 회귀가 대조한다
function spCycleText(){ return elemCycle().reverse().map(k=>ELEM_KO[k]).join("→"); }                  // B7 순환 = BEATS(회귀가 대조한다)

/* ===== 모달 안내 (#spGuide) — 질문 Q · ⚙ 건너뛰기 확인 · 진행도 BP · 결과 A11. 열린 동안 #app·#overlay 는 inert(tutSetInert) ===== */
function spDlgShow(html,focusSel){
  const el=$("spGuide"); if(!el||SP.pending||!spSignedIn()) return; // 401 로 멈춘 문맥·로그아웃 중에는 어떤 안내 창도 열지 않는다(같은 계정 복원 뒤 다시 그린다)
  if(!el.innerHTML){ const a=document.activeElement; SP.restore=a&&a!==document.body?a:null; } // 비어 있음 = 닫혀 있었다(다시 그리기는 복귀 자리를 바꾸지 않는다)
  el.innerHTML=html; el.classList.remove("hidden"); tutSetInert(true); spCoachOff(); // 모든 모달 안내 — 뒤에 남은 말풍선·스포트라이트를 바로 걷는다(닫히면 render 가 지금 단계로 다시 그린다)
  try{ const b=el.querySelector(focusSel||"button.primary"); if(b&&!b.disabled) b.focus({preventScroll:true}); }catch(e){}
}
function spDlgClose(){
  const el=$("spGuide"); if(!el||!el.innerHTML) return;
  el.classList.add("hidden"); el.innerHTML=""; if(!TUT.open) tutSetInert(false);
  const r=SP.restore; SP.restore=null;
  try{ if(r&&r.isConnected!==false&&!r.disabled&&r.focus) r.focus({preventScroll:true}); else modalFocus(); }catch(e){}
}
/* 저장 줄(§3.6) — 저장 중·저장됨·저장하지 못했어요·저장 여부 불명. 실패는 role=alert, 그 밖은 role=status */
function spSaveLine(v,okText){
  if(!v) return "";
  if(v.st==="busy"||v.st==="auth") return `<p class="lobbyNotice spSave" role="status">저장 중…</p>`;
  if(v.st==="ok") return `<p class="lobbyNotice spSave" role="status">✓ ${okText||"저장됨"}</p>`;
  return `<p class="acctMsg err spSave" role="alert">${escAttr(v.msg)}</p>`;
}
function spBusy(){ return !!SP.save&&SP.save.st==="busy"; }
function spAskRender(){
  const v=SP.save, dis=spBusy()?" disabled":"", q=SP_Q[spCatNow()];
  spDlgShow(`<div class="histCard spCard"><h2 id="spDlgT">${q[0]}</h2><p id="spDlgD">${q[1]}</p>
    ${spSaveLine(v)}<div class="row"><button type="button" class="primary" onclick="spAskGo()"${dis}>진행</button><button type="button" onclick="spAskSkip()"${dis}>건너뛰기</button></div></div>`);
}
function spAskGo(){
  if(!SP.ask||spBusy()) return; SP.ask=false; SP.save=null; spDlgClose();
  const T=spT(); if(T) spStep(T,T.cat==="basic"?"B1":"A1");
  spSync(); render();
}
function spAskSkip(){ if(!SP.ask||spBusy()) return; if(SP.save&&SP.save.st==="fail") spRetry(); else spSave({category:"all",end:"skip"}); } // 대기 카테고리 전부 건너뜀 (1요청 · 원자적)
/* ⚙ 튜토리얼 건너뛰기 — 확인 창. [건너뛰기] → 그 카테고리 건너뜀 저장 · [계속하기]·Esc → 그대로 계속(기본 초점) */
function spSkipAsk(){ const T=spT(); if(!T||SP.ask||SP.dlg) return; try{ const g=document.querySelector(".flowGear[open]"); if(g) g.removeAttribute("open"); }catch(e){} SP.dlg="skipq"; spSync(); spDlgRender(); }
function spSkipGo(){
  const T=spT(); if(!T||SP.dlg!=="skipq"||spBusy()) return;
  if(SP.save&&SP.save.st==="fail"){ spRetry(); return; }
  if(T.cat==="basic"){ T.step=null; T.res="skipped"; SP.dlg="bp"; }                  // 기본 건너뜀 → 진행도(BP)에서 저장 확인을 기다린다
  spSave({category:T.cat,end:"skip"});
}
function spSkipNo(){ if(SP.dlg!=="skipq"||spBusy()) return; SP.dlg=null; SP.save=null; spDlgClose(); spSync(); render(); }
/* 진행도(BP)·결과(A11) — 기본 → 심화 칸, 마녀 이동, 저장 줄. [다음 단계로]·[로비로]는 저장 ACK 와 이동 연출이 모두 끝난 뒤 활성(움직임 줄이기 = 즉시 이동) */
const SP_WITCH="legend_witch";
function spWitchSrc(){ return pilotPick(SP_WITCH,"portrait.webp")?pilotUrl(SP_WITCH,"portrait.webp"):artUrl(SP_WITCH,"portrait.png"); }
function spWitchImg(cls){ return `<img class="${cls}" src="${spWitchSrc()}" alt="" aria-hidden="true" onerror="if(!this.dataset.fb){this.dataset.fb='1';this.src='${artUrl(SP_WITCH,"portrait.png")}';}else{this.remove();}">`; }
const SP_CAT_KO={completed:["완료","✓"],skipped:["건너뜀","↷"],exempt:["면제","—"],pending:["다음","…"]};
function spCatChip(k,label){ const c=SP_CAT_KO[k]||SP_CAT_KO.pending; return `<span class="spCat st-${k}"><b>${label}</b><small><span aria-hidden="true">${c[1]} </span>${c[0]}</small></span>`; }
function spMotion(){ try{ if(!fxLive()) return false; return !(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches); }catch(e){ return false; } }
function spProgHtml(T,adv){
  const t=SP.progress?SP.progress.tutorial:{basic:"pending",advanced:"pending"}, ok=SP.save&&SP.save.st==="ok";
  const b=adv||ok?t.basic:(T.res||"pending"), a=ok?t.advanced:"pending"; // ACK 뒤에는 두 칸 모두 서버 정본 값 · 확인 전에는 지금 고른 결과(완료 표시는 ACK 뒤)
  return `<div class="spProg${T.anim||adv?" go":""}" role="img" aria-label="튜토리얼 진행 — 기본 ${SP_CAT_KO[b][0]} · 심화 ${SP_CAT_KO[a][0]}">${spCatChip(b,"기본")}<i class="spArrow" aria-hidden="true">→</i>${spCatChip(a,"심화")}${spWitchImg("spMk")}</div>`;
}
function spDlgRender(){
  const T=SP.tut, v=SP.save, busy=spBusy(), ok=!!v&&v.st==="ok", fail=!!v&&v.st==="fail", retry=fail?`<button type="button" onclick="spRetry()">다시 시도</button>`:"";
  if(!T||!SP.dlg){ spDlgClose(); return; }
  if(SP.dlg==="skipq"){ const q=SP_SKIP[T.cat];
    spDlgShow(`<div class="histCard spCard"><h2 id="spDlgT">${q[0]}</h2><p id="spDlgD">${q[1]}</p>${spSaveLine(v)}
      <div class="row">${fail?retry:`<button type="button" class="danger" onclick="spSkipGo()"${busy?" disabled":""}>건너뛰기</button>`}<button type="button" class="primary" onclick="spSkipNo()"${busy?" disabled":""}>계속하기</button></div></div>`);
    return; }
  if(SP.dlg==="bp"){ const done=T.res==="completed", go=ok&&T.anim, adv=ok&&SP.progress&&SP.progress.tutorial.advanced!=="pending";
    if(fxLocked()&&!$("spGuide").innerHTML){ spIdleTick(T); return; } // 기존 승리 연출이 끝난 뒤에 연다
    spDlgShow(`<div class="histCard spCard spPanel"><p class="spKicker">튜토리얼 진행</p><h2 id="spDlgT">기본 ${SP_CAT_KO[T.res]?SP_CAT_KO[T.res][0]:"건너뜀"}</h2>${spProgHtml(T,false)}
      <p id="spDlgD">${done?SP_SAY.BPdone:SP_SAY.BPskip}</p>${spSaveLine(v)}<div class="row">${retry}<button type="button" class="primary" id="spGo" onclick="spBpNext()"${go?"":" disabled"}>${adv?"로비로":"다음 단계로"}</button></div></div>`,"#spGo");
    spAnimStart(T); return; }
  if(SP.dlg==="a11"){ const done=T.res==="completed";
    spDlgShow(`<div class="histCard spCard spPanel"><p class="spKicker">튜토리얼 결과</p><h2 id="spDlgT">심화 ${SP_CAT_KO[T.res]?SP_CAT_KO[T.res][0]:"건너뜀"}</h2>${spProgHtml(T,true)}
      <p id="spDlgD">${done?SP_SAY.A11done:SP_SAY.A11skip}</p>${spSaveLine(v)}<p class="spNote"><small>공식 전적·최근 기록·보상에는 들어가지 않아요.</small></p>
      <div class="row">${retry}<button type="button" class="primary" id="spGo" onclick="spA11Go()"${ok?"":" disabled"}>로비로</button></div></div>`,"#spGo");
  }
}
/* 마녀 이동 — 한 번만 건다. 움직임 줄이기·헤드리스는 즉시 끝(정적 표시) · 그 밖은 CSS 전이 시간 뒤 끝 표시 */
function spAnimStart(T){
  if(T.anim||T.f.anim) return;
  const tok=spCtx(); T.f.anim=tok||true; const live=()=>spCtxOk(T,tok)&&SP.dlg==="bp"; // 같은 문맥·같은 로그인·진행도 창일 때만(401·로그아웃·계정 전환 뒤 늦은 타이머는 아무것도 하지 않는다)
  const fin=()=>{ if(!live()){ if(T.f.anim===tok) T.f.anim=false; return; } T.anim=true; spDlgRender(); }; // 무효가 된 자기 시작 표시만 지운다 — 같은 계정 복원이 다시 시작할 수 있게
  if(!spMotion()){ fin(); return; }
  setTimeout(()=>{ if(!live()) return; try{ const m=document.querySelector("#spGuide .spProg"); if(m) m.classList.add("go"); }catch(e){} },30);
  setTimeout(fin,950);
}
function spBpNext(){
  const T=SP.tut; if(!T||SP.dlg!=="bp"||!SP.save||SP.save.st!=="ok"||!T.anim) return; // ACK·이동 둘 다 끝나야 — 연타·늦은 응답에 두 번 가지 않는다
  if(SP.progress&&SP.progress.tutorial.advanced!=="pending"){ SP.dlg=null; SP.save=null; SP.tut=null; spDlgClose(); if(SP.progress.tutorialDone) SP.note=SP_UNLOCK_NOTE; spSync(); toLobby(); return; } // 심화가 이미 정해졌다(다른 창) — 다시 하지 않고 로비
  SP.dlg=null; SP.save=null; spDlgClose(); spAdvStart(); const N=spT(); if(N) spStep(N,"A1"); spSync(); render(); // 질문 없이 심화 A1
}
function spA11Go(){ if(SP.dlg!=="a11"||!SP.save||SP.save.st!=="ok") return; SP.dlg=null; SP.save=null; SP.tut=null; spDlgClose(); spSync(); toLobby(); }

/* ===== 안내 말풍선 (#spCoach · 비모달) + 스포트라이트 (#spSpot) — 대상과 ⚙ 는 늘 누를 수 있고, 대상 밖 게임 입력만 그 단계 동안 막는다 ===== */
/* 단계 사양 — n: 진행 숫자 · say: 문구 · next: 말풍선 버튼 · tg: 지금 눌러야 할 대상 하나 · spot: 강조만 하는 영역 · free: 막지 않음 · extra: 함께 열어 둘 대상 */
function spEl(sel){ try{ return document.querySelector(sel); }catch(e){ return null; } }
function spCell(r,c){ const b=$("board"); try{ return b?b.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`):null; }catch(e){ return null; } }
function spBarBtn(txt){ const tb=$("turnBar"); return tb?[...tb.children].find(b=>b.textContent===txt)||null:null; }
function spPc(id){ return S.pieces.find(x=>x.id===id)||null; }
function spSelId(){ return S.selected&&!S.selected.tray?S.selected.id:null; }
const spTg={cell:(p,lb)=>p?{el:()=>spCell(p.r,p.c),cell:[p.r,p.c],lb}:null, sel:(s,extra)=>({el:()=>spEl(s),sel:s,extra}), btn:t=>({el:()=>spBarBtn(t)})};
function spSpec(T){
  const I=T.ids, n=T.cat==="basic"?9:11, prog=T.practice?"연습 장면":`${T.cat==="basic"?"기본":"심화"} ${T.f.n||1}/${n}`;
  const s=T.step, sp=/** @type {any} */({prog,say:SP_SAY[s]||"",next:null,tg:null});
  if(T.cat==="basic"){
    const K=spPc(I.K), M=spPc(I.M), Tp=spPc(I.T), sel=spSelId(), my=S.current===0&&S.phase==="play"&&!S.battle;
    if(s==="B1"){ sp.next="다음"; sp.zone=[[11,13,""]]; }
    else if(s==="B2"){ sp.tags=true; if(T.f.info) sp.next="다음"; else sp.tg=sel===I.K?spTg.sel(".infoBtn"):spTg.cell(K,"내 왕"); }
    else if(s==="B3"){ sp.next="다음"; sp.ring=spTg.cell(spPc(I.F)); }
    else if(s==="B4"){ sp.next="다음"; sp.pics="win"; }
    else if(s==="B5"){ if(!T.f.done&&my) sp.tg=sel===I.M?spTg.btn("탐색"):spTg.cell(M,"흔적 위의 내 말"); }
    else if(s==="B6"){ if(my) sp.tg=sel===I.M?spTg.cell({r:T.ids.dest[0],c:T.ids.dest[1]},"표시된 칸"):spTg.cell(M,"싸울 내 말"); }
    else if(s==="B7"){ const B=S.battle; sp.say=SP_SAY.B7; if(B) sp.tg=B.menu==="fight"?spTg.sel(`button[onclick="window.__act(0)"]`):spTg.sel(`button[onclick="window.__menu('fight')"]`); sp.info=true; }
    else if(s==="B8"){ if(T.f.gain!=null){ sp.next="다음"; sp.gain=T.f.gain; sp.ring=spTg.cell(M); } else if(my&&!T.f.healed) sp.tg=sel===I.M?spTg.btn("🌿 회복"):spTg.cell(M,"다친 내 말"); }
    else if(s==="B9"){ if(my) sp.tg=!S.teleport?spTg.btn("🌀 텔레포트"):S.teleport.stage===1?spTg.cell(Tp,"상대 끝줄의 내 말"):spTg.cell(K,"내 왕"); }
    return sp;
  }
  if(s==="A1"){ const i=T.f.slot; sp.tg=T.f.a1info?spTg.sel(`[onclick="window.__shop('buy',${i})"]`):spTg.sel(`[onclick="unitHelpSlot(${i},this)"]`); }
  else if(s==="A2"){ sp.next="다음"; sp.ring=spTg.sel(".synRail"); }
  else if(s==="A3"){ sp.tg={el:()=>[...document.querySelectorAll(".leadRow button")].find(b=>!/** @type {any} */(b).disabled)||null,sel:".leadRow button",extra:".leadRow"}; } // 초점은 누를 수 있는 속성 버튼에(묶음 div 는 초점을 받지 못한다)
  else if(s==="A4"){ if(T.f.item) sp.next="다음"; else sp.tg=spTg.sel(".goodsGrid .goodIco"); }
  else if(s==="A5"){ sp.free=true; sp.ring=spTg.sel(".flowAct .go"); }
  else if(s==="A6"){ const P=T.f.pid!=null?spPc(T.f.pid):null;
    if(T.f.pid==null){ sp.tg=S.selected&&S.selected.tray?{el:()=>null,zone:true}:{el:()=>[...document.querySelectorAll(".tray .trayItem")].find(b=>!/** @type {any} */(b).disabled)||null,extra:".tray"}; sp.zone=[[11,13,""]]; }
    else if(!T.f.back) sp.tg=spTg.cell(P,"놓은 말");
    else sp.tg=spTg.sel(`button[onclick="autoPlace()"]`); }
  else if(s==="A7"){ if(S.phase==="play") sp.next="확인"; else sp.tg=spTg.sel(".flowBar .go"); }
  else if(s==="A8"){ sp.next="확인"; sp.pics="shop"; }
  else if(s==="A9"){ sp.next="확인"; sp.ring=spTg.cell(spPc(T.f.burnId)); sp.zone=spBurnZone(); }
  else if(s==="A10"){ sp.say=T.match&&T.match.winner===0?SP_SAY.A10win:SP_SAY.A10loss; sp.next="다음"; sp.leave=true; }
  else if(s==="A10s"){ sp.say=SP_SAY.A8; sp.pics="shop"; sp.leave=true; if(T.f.card) sp.next="다음"; else sp.tg=spTg.sel(`[onclick="unitHelpSlot(0,this)"]`); }
  else if(s==="A10b"){ const P=spPc(T.f.burnId); sp.leave=true; sp.zone=spBurnZone(); sp.tg=spSelId()===T.f.burnId?spTg.cell({r:T.f.dest[0],c:T.f.dest[1]},"2칸 앞 칸"):spTg.cell(P,"움직일 내 말"); }
  return sp;
}
/* 버닝 구역 — 내 쪽에서 상대 숲·상대 진영(원정 구역 1~5행)은 1칸, 나머지는 곧게 2칸(core.js expedZone 과 같은 경계) */
function spBurnZone(){ return [[1,5,"1칸"],[6,13,"2칸"]]; }
function spBurnPiece(){ // 지금 곧게 2칸 갈 수 있는 내 말 하나(없으면 null — 말풍선만)
  for(const p of alivePieces()) if(p.owner===0) for(const [dr,dc] of [[-2,0],[2,0],[0,-2],[0,2]]) if(canMoveTo(p,p.r+dr,p.c+dc)) return p;
  return null;
}
/* 단계 전이 — 진행 숫자는 표 순서 그대로(기본 B1~B9 · 심화 A1~A11) */
const SP_N={B1:1,B2:2,B3:3,B4:4,B5:5,B6:6,B7:7,B8:8,B9:9,A1:1,A2:2,A3:3,A4:4,A5:5,A6:6,A7:7,A8:8,A9:9,A10:10,A10s:10,A10b:10};
function spStep(T,s){ T.step=s; T.f={n:SP_N[s]||T.f.n,slot:T.f.slot,burnId:T.f.burnId,dest:T.f.dest}; T.focus="";
  if(s==="A1"&&S.eco&&S.eco.shop){ T.f.slot=Math.max(0,ecoBuyable(S,0)); T.f.key=(S.eco.shop.slots[0][T.f.slot]||{}).key||null; } }
function spNext(){
  const T=spT(); if(!T||!T.step||SP.ask||SP.dlg) return; const s=T.step;
  if(s==="B1") spStep(T,"B2"); else if(s==="B2"&&T.f.info) spStep(T,"B3"); else if(s==="B3") spStep(T,"B4"); else if(s==="B4") spStep(T,"B5");
  else if(s==="B8"&&T.f.gain!=null){ T.hold=false; spStep(T,"B9"); }
  else if(s==="A2") spStep(T,"A3"); else if(s==="A4"&&T.f.item) spStep(T,"A5");
  else if(s==="A7"&&S.phase==="play"){ T.step=null; }
  else if(s==="A8"){ T.seen.shop=true; T.step=null; } else if(s==="A9"){ T.seen.burn=true; T.step=null; }
  else if(s==="A10") spPracticeNext(T); else if(s==="A10s"&&T.f.card) spPracticeNext(T);
  else return;
  spSync(); render();
}
/* 대상 판정 — 지금 눌러야 할 요소(+함께 열어 둘 요소). 안내가 없거나 자유 단계면 null(막지 않음) */
function spGateSet(){
  const T=spT(); if(!T||!T.step||SP.ask||SP.dlg) return null;
  const sp=spSpec(T); if(sp.free) return null;
  const out=[]; if(sp.tg){ const e=sp.tg.el(); if(e) out.push(e); if(sp.tg.extra) out.push(...document.querySelectorAll(sp.tg.extra)); if(sp.tg.zone) out.push(...spZoneCells()); }
  return {T,sp,out};
}
const SP_FREE="#spCoach,#spGuide,#synHelp,.flowGear,#btnBack,#toasts,.cycBtn,.statBtn,.bsynTog,.bsynStrip"; // 늘 열어 두는 것 — 안내·⚙·읽기 전용 설명
function spGateEv(e){
  const g=spGateSet(); if(!g) return;
  const t=/** @type {any} */(e.target); if(!t||!t.closest) return;
  if(e.type==="keydown"&&!(e.key==="Enter"||e.key===" ")) return;
  if(t.closest(SP_FREE)) return;
  if(g.out.some(x=>x&&x.contains(t))){ spHit(g.T); return; }
  e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation();
}
/* 보는 단계(설명 창·아이템 칸·진열 카드)는 그 대상을 누른 것으로 끝난다 — 행동 단계는 상태(spWatch)로 끝난다 */
function spHit(T){ const s=T.step;
  if(s==="B2"&&spSelId()===T.ids.K) T.f.info=true; // 왕을 고른 뒤의 대상 = [말 정보] — 설명 창 열기·닫기는 다시 그리지 않으므로 누른 순간 표시한다
  else if(s==="A1"&&!T.f.a1info) T.f.a1info=true; else if(s==="A4") T.f.item=true; else if(s==="A10s") T.f.card=true;
  const tok=spCtx(); setTimeout(()=>{ if(spCtxOk(T,tok)&&T.step&&!SP.ask&&!SP.dlg) spDraw(T); },0); } // 늦은 그리기 — 같은 문맥·같은 로그인일 때만(경기 종료·진행도·401·계정 전환 뒤에는 아무것도 하지 않는다)
if(typeof document!=="undefined"&&document.addEventListener){ document.addEventListener("click",spGateEv,true); document.addEventListener("keydown",spGateEv,true); }
/* 상태로 끝나는 단계 — render 마다(spTick) 본다 */
function spWatch(T){
  const I=T.ids, s=T.step;
  if(T.cat==="basic"){
    const M=spPc(I.M), E=spPc(I.E);
    if(s==="B2"&&!T.f.info&&SYNHELP.el&&String(SYNHELP.pid)===String(I.K)) T.f.info=true;
    if(s==="B5"){ if(!T.f.done&&S.events[I.ev]&&S.events[I.ev].consumed) T.f.done=true;
      if(T.f.done&&S.phase==="play"&&S.current===0&&S.turnCount>=T.t0+2) spStep(T,"B6"); }
    if(s==="B6"&&S.battle) spStep(T,"B7");
    if(s==="B7"&&!S.battle&&S.phase==="play"){
      if(E&&E.alive||!M||!M.alive){ if(fxLocked()){ spIdleTick(T); return; } T.attempt++; spBasicBuild(T,"B6"); spStep(T,"B6"); return; } // 지거나 E 가 남으면 연출 뒤 B6 시작 상태부터 다시(저장 없음 · 소프트락 없음)
      if(S.current===0&&S.turnCount>=T.t0+4){ spStep(T,"B8"); } } // 성공 전이는 연출을 기다리지 않는다(연출이 끝날 때 다시 그리기가 없다)
    if(s==="B8"&&M){ if(!T.f.healed&&M.healing&&S.current===0){ T.f.healed=true; T.f.hp0=M.hp; T.hold=true; } // 회복 지정 → 내 차례 종료의 회복을 보일 때까지 상대 차례 보류
      if(T.f.healed&&T.f.gain==null&&S.current===1&&M.hp>T.f.hp0) T.f.gain=M.hp-T.f.hp0; }
    if(s==="B9"&&!T.f.at9&&S.current===0&&S.turnCount>=T.t0+6) T.f.at9=true;
    return;
  }
  if(T.practice){
    if(s==="A10b"){ const P=spPc(T.f.burnId); if(P&&P.r===T.f.dest[0]&&P.c===T.f.dest[1]) spPracticeNext(T); }
    return;
  }
  if(s==="A1"&&T.f.key&&ecoUnitOf(S,0,T.f.key)) spStep(T,"A2");
  else if(s==="A3"&&S.pieces.some(x=>x.owner===0&&(x.type==="king"||x.type==="ally")&&x.leaderElChosen)) spStep(T,"A4");
  else if(s==="A5"&&S.eco&&(!S.eco.shop||S.eco.shop.done[0])) spStep(T,"A6");
  else if(s==="A6"){ const mine=S.pieces.filter(x=>x.owner===0);
    if(T.f.pid==null){ const p=mine.find(x=>x.placed); if(p) T.f.pid=p.id; }
    else if(!T.f.back){ const p=spPc(T.f.pid); if(p&&!p.placed) T.f.back=true; }
    else if(mine.every(x=>x.placed)) spStep(T,"A7"); }
  if(!T.step&&!T.match&&!SP.dlg){ // 심화 자유 경기 — 실제로 일어났을 때만 한 번(턴 수로 판단하지 않는다)
    if(!T.seen.shop&&S.phase==="shop"&&S.eco&&S.eco.shop&&S.eco.shop.kind!=="start"&&shopViewer()===0) spStep(T,"A8");
    else if(!T.seen.burn&&S.phase==="play"&&S.current===0&&isBurning()&&!S.battle&&!S.fleePick){ if(fxLocked()) spIdleTick(T); else { const p=spBurnPiece(); spStep(T,"A9"); T.f.burnId=p?p.id:null; } }
  }
}
let SP_TICKING=false;
/* 연출이 끝나면 한 번 다시 판정 — 기존 fxWhenIdle(폴링 없음) · 튜토리얼 문맥마다 대기 1개 · 문맥이 바뀌었으면(다른 경기·계정·종료) 아무것도 하지 않는다 */
function spCtx(){ return spSignedIn()?{gen:AUTH.gen,uid:AUTH.user.userId}:null; }          // 등록 때의 인증 세대·계정
function spCtxOk(T,tok){ return !!tok&&SP.tut===T&&spT()===T&&!SP.pending&&spSignedIn()&&AUTH.gen===tok.gen&&AUTH.user.userId===tok.uid; }
function spIdleTick(T){
  if(T.idle||!spSignedIn()) return;
  const tok=spCtx(); T.idle=tok;
  fxWhenIdle(()=>{ if(T.idle===tok) T.idle=null;                                              // 자기 대기 표시만 지운다(뒤에 새로 건 대기는 그대로)
    if(spCtxOk(T,tok)) spTick(); }); }
/* render() 끝에서 — 단계 판정 → 말풍선·스포트라이트. 튜토리얼 경기가 아니면 안내를 걷기만 한다 */
function spTick(){
  if(SP_TICKING) return; SP_TICKING=true;
  try{
    if(SP.ask&&S.phase==="menu"){ SP.ask=false; spDlgClose(); }                           // 튜토리얼 경기가 걷혔다(세션 종료·계정 전환 → 타이틀)
    if(SP.pending||spT()&&!spSignedIn()){ spCoachOff(); return; }                          // 401 로 멈춘 문맥·로그아웃 중 — 말풍선·진행도·전이를 열지 않는다(같은 계정 재로그인 spRestore 가 다시 잇는다)
    const T=spT();
    if(T&&!SP.ask&&!SP.dlg) spWatch(T);                                                      // 자유 경기(단계 없음)에서도 실제 상점·버닝을 본다
    if(T&&SP.dlg==="bp"&&!$("spGuide").innerHTML){ if(fxLocked()) spIdleTick(T); else spDlgRender(); } // 기존 승리 연출이 끝난 뒤 진행도
    if(T&&SP.dlg==="a11"&&!$("spGuide").innerHTML) spDlgRender();
    spSync();
    if(T&&T.step==="A10"&&!SP.ask&&!SP.dlg&&fxLocked()){ spIdleTick(T); spCoachOff(); }    // 경기 결과 연출 뒤에 연습 안내
    else if(T&&T.step&&!SP.ask&&!SP.dlg) spDraw(T); else spCoachOff();
  } finally{ SP_TICKING=false; }
}
const SP_DRAWN={coach:"",spot:""};
function spCoachOff(){
  const c=$("spCoach"), s=$("spSpot"); SP_DRAWN.coach=SP_DRAWN.spot="";
  if(c&&c.innerHTML){ c.innerHTML=""; c.classList.add("hidden"); } if(s&&s.innerHTML){ s.innerHTML=""; s.classList.add("hidden"); }
  const T=SP.tut; if(T) T.focus="";
}
/* 짧은 도해 — 기존 보드 기호·Argon 아이콘으로 만든 DOM(새 래스터 없음) */
function spPicsHtml(k){
  if(k==="win"){
    const mini=(cells,cap)=>`<figure class="spPic"><div class="spMini" aria-hidden="true">${cells.map(r=>`<span class="${r[0]}">${r[1]}</span>`).join("")}</div><figcaption>${cap}</figcaption></figure>`;
    const E=["",""], row=a=>a.map(x=>x?x:E);
    return `<div class="spPics" role="list" aria-label="이기는 방법 세 가지">`
      +mini(row([["zA","",],["zA","👑✕"],["zA",""],["",""],["","⚔️"],["",""],["zB",""],["zB",""],["zB",""]]),"상대 왕 잡기")
      +mini(row([["zA","👑"],["zA",""],["zA",""],["","↑"],["",""],["",""],["zB",""],["zB",""],["zB",""]]),"내 왕이 상대 끝줄")
      +mini(row([["zA","?✕"],["zA",""],["zA","?✕"],["",""],["",""],["",""],["zB",""],["zB",""],["zB",""]]),"상대 하수인+동료 전멸 <small>(폭탄·함정·왕은 세지 않음)</small>")+`</div>`;
  }
  if(k==="shop") return `<ol class="spTiers2" aria-label="정기 상점 등급 비교">${SP_SHOP_TIERS.map(([t,g,b])=>`<li><b>${t}턴</b><span>${g}</span><small>보너스 🪙${b}</small></li>`).join("")}</ol>`;
  return "";
}
function spCoachHtml(T,sp){
  const btn=sp.next?`<button type="button" class="primary" id="spNext" onclick="spNext()">${sp.next}</button>`:"";
  const leave=sp.leave?`<button type="button" class="ghost" onclick="spPracticeSkip()">남은 연습 건너뛰기</button>`:"";
  const roles=sp.tags&&!T.f.legend?`<ul class="srOnly">${Object.keys(SP_TAGS).map(k=>`<li>${TYPE_KO[k]} — ${SP_TAGS[k]}</li>`).join("")}</ul>`:""; // 떠 있는 이름표(읽지 않는 층)의 같은 문구 — 화면에는 한 번만
  const legend=sp.tags&&T.f.legend?`<ol class="spLegend" aria-label="내 말 역할">${Object.keys(SP_TAGS).map((k,i)=>`<li><b class="spMk" aria-hidden="true">${i+1}</b>${TYPE_KO[k]} — ${SP_TAGS[k]}</li>`).join("")}</ol>`:"";
  const gain=sp.gain!=null?`<p class="spGain" role="status">${gi("heal")} HP +${sp.gain}</p>`:"";
  return `<div class="spCoachIn">${spWitchImg("spWitch")}<div class="spBubble histCard"><p class="spProgTx">${sp.prog}</p><p class="spSay" id="spSay">${sp.say}</p>${gain}${roles}${legend}${sp.pics?spPicsHtml(sp.pics):""}${btn||leave?`<div class="row">${leave}${btn}</div>`:""}</div></div>`;
}
/* 그리기 — 말풍선은 내용이 바뀔 때만 다시 쓴다(읽기 반복 방지). 대상 칸은 키보드로도 누를 수 있게 하고, 단계가 바뀔 때만 초점을 옮긴다 */
function spDraw(T){
  if(spT()!==T||!T.step||SP.pending||SP.ask||SP.dlg||!spSignedIn()) return; // 모든 호출(창 resize·scroll 포함)의 단일 관문 — 지금 경기의 지금 문맥·같은 로그인·창/질문/401 보류 없음일 때만(말풍선·초점·읽기 공지)
  const c=$("spCoach"), s=$("spSpot"); if(!c||!s) return;
  const sp=spSpec(T), html=coinize(spCoachHtml(T,sp));
  if(SP_DRAWN.coach!==html){ SP_DRAWN.coach=html; c.innerHTML=html; c.classList.remove("hidden"); } // 브라우저가 정규화한 innerHTML 이 아니라 마지막으로 쓴 원문과 비교 — 같은 내용이면 DOM(초점 · 읽기)을 건드리지 않는다
  const el=sp.tg&&sp.tg.el?sp.tg.el():null;
  if(el&&sp.tg.cell){ el.setAttribute("tabindex","0"); el.setAttribute("role","button"); if(sp.tg.lb) el.setAttribute("aria-label",sp.tg.lb);
    spKeyCell(el); }
  if(sp.tg&&sp.tg.zone) for(const z of spZoneCells()) spKeyCell(z); // A6 말을 고른 뒤 — 놓을 수 있는 내 진영 빈칸 전부를 키보드로도(Tab · Enter/Space)
  const key=T.step+"|"+(sp.tg?(sp.tg.cell||"")+String(!!el)+(sp.tg.zone?"z":""):"")+"|"+(sp.next||"");
  if(T.focus!==key){ const say=T.focus.split("|")[0]!==T.step; T.focus=key; try{ const f=el||(sp.tg&&sp.tg.zone?spZoneCells()[0]:null)||(sp.next?$("spNext"):null); if(f&&f.focus) f.focus({preventScroll:false}); }catch(e){}
    if(say){ const lv=$("spLive"); if(lv) lv.textContent=sp.prog+" — "+sp.say; } } // 단계가 바뀔 때만 상태 공지(고정 aria-live 영역)
  spSpot(T,sp,el);
}
/* 대상 칸을 버튼처럼 — 초점·이름·Enter/Space(실제 click 을 내 입력 문을 지나게 보낸다) */
function spKeyCell(el){ el.setAttribute("tabindex","0"); el.setAttribute("role","button");
  if(!el.getAttribute("aria-label")) el.setAttribute("aria-label",`${el.dataset.r}행 ${el.dataset.c}열${el.querySelector&&el.querySelector(".pc")?"":" 빈칸"}`);
  el.onkeydown=ev=>{ if(ev.key==="Enter"||ev.key===" "){ ev.preventDefault(); if(typeof el.click==="function") el.click(); else if(el.onclick) el.onclick(); } }; }
function spZoneCells(){ return zoneOf(0).flatMap(r=>[1,2,3,4,5,6,7].filter(c=>!at(r,c)).map(c=>spCell(r,c))).filter(Boolean); } // 내 진영의 빈칸만(상대 정보 없음)
function spRect(el){ try{ const r=el&&el.getBoundingClientRect?el.getBoundingClientRect():null; return r&&r.width>0?r:null; }catch(e){ return null; } }
function spBox(r,cls,txt,pad){ pad=pad||0; return `<i class="${cls}" style="left:${Math.round(r.left-pad)}px;top:${Math.round(r.top-pad)}px;width:${Math.round(r.width+pad*2)}px;height:${Math.round(r.height+pad*2)}px">${txt?`<b>${txt}</b>`:""}</i>`; }
function spRows(a,b){ const r1=spRect(spCell(a,1)), r2=spRect(spCell(b,COLS)); return r1&&r2?{left:r1.left,top:r1.top,width:r2.right-r1.left,height:r2.bottom-r1.top}:null; }
/* 스포트라이트 층 — 대상 고리 · 강조 영역(구역 띠) · B2 이름표. 모두 pointer-events:none, 규칙상 안 보이는 말은 가리키지 않는다(대상은 늘 보이는 칸·버튼) */
function spSpot(T,sp,el){
  const s=$("spSpot"); let h="";
  for(const z of sp.zone||[]){ const r=spRows(z[0],z[1]); if(r) h+=spBox(r,"spZone",z[2],2); }
  const ring=el||(sp.ring&&sp.ring.el?sp.ring.el():null), rr=spRect(ring); if(rr) h+=spBox(rr,el?"spRing tg":"spRing",el&&sp.tg.lb?"":"",4);
  if(sp.tags) spTagPieces(T).forEach((p,i)=>{ const r=spRect(spCell(p.r,p.c)); if(!r) return;
    h+=T.f.legend?`<i class="spMark" data-cr="${Math.round(r.right)}" data-cb="${Math.round(r.bottom)}" style="left:${Math.round(r.left+3)}px;top:${Math.round(r.top+3)}px"><b>${i+1}</b></i>` // 칸 안 번호 — 말풍선 범례와 짝
      :`<i class="spTag" data-cx="${Math.round(r.left+r.width/2)}" data-up="${Math.round(r.top-2)}" data-dn="${Math.round(r.bottom+2)}" style="left:${Math.round(r.left+r.width/2)}px;top:${Math.round(r.bottom+2)}px"><b>${SP_TAGS[p.type]}</b></i>`; });
  if(SP_DRAWN.spot!==h){ SP_DRAWN.spot=h; s.innerHTML=h;
    if(sp.tags&&!T.f.legend&&!spTagFit(s,rr)){ T.f.legend=true; SP_DRAWN.coach=SP_DRAWN.spot=""; spDraw(T); return; } } // 떠 있는 이름표가 겹침 없이 다 들어가지 못하면 번호 + 말풍선 범례(같은 문구)
  if(h) s.classList.remove("hidden"); else s.classList.add("hidden");
  spPlace(rr);
}
/* B2 이름표 5개(하수인 · 왕 · 동료 · 폭탄 · 함정 순서 = SP_TAGS) — 모두 내 진영(11~13행)의 실제 내 말. 왕은 대상 그 말 · 하수인은 진영 안의 하수인(같은 역할 문구) — 좁은 화면 위 말풍선 아래로 다 보이게 */
function spTagPieces(T){ const mine=alivePieces().filter(p=>p.owner===0&&zoneOf(0).includes(p.r));
  return Object.keys(SP_TAGS).map(k=>mine.find(p=>p.type===k&&(k!=="king"||p.id===T.ids.K))).filter(Boolean); }
/* 이름표 자리 — 말 아래 · 위 × 가운데 · 왼쪽 · 오른쪽 6곳 중 서로 · 대상 고리 · 머리줄과 겹치지 않고 화면 안인 첫 자리. 하나라도 못 놓으면 false(범례로) */
function spTagFit(s,rr){
  const ov=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top, W=window.innerWidth||400, hud=spHudBottom();
  const placed=[...(rr?[{left:rr.left-6,right:rr.right+6,top:rr.top-6,bottom:rr.bottom+6}]:[]),{left:0,right:W,top:0,bottom:hud}]; // 고리는 칸보다 4px 바깥 + 테두리 — 그린 고리 크기로
  for(const t of /** @type {any[]} */([...s.querySelectorAll(".spTag")])){ const r0=spRect(t); if(!r0) continue;
    const w=r0.width, h=r0.height, cx=+t.dataset.cx, up=+t.dataset.up-h, dn=+t.dataset.dn;
    const c=[[dn,cx],[up,cx],[dn,cx-w/2],[dn,cx+w/2],[up,cx-w/2],[up,cx+w/2]].map(([y,x])=>({left:x-w/2,right:x+w/2,top:y,bottom:y+h,x,y}))
      .find(b=>b.left>=0&&b.right<=W&&b.top>=0&&!placed.some(o=>ov(o,b)));
    if(!c) return false;
    t.style.left=Math.round(c.x)+"px"; t.style.top=Math.round(c.y)+"px"; placed.push(c); }
  return true;
}
/* 위 띠 말풍선이 가리면 안 되는 머리줄(신원·⚙·차례·턴) — 화면 위쪽에 보이는 것 중 가장 아래 끝 */
function spHudBottom(){ let b=0; try{ for(const el of document.querySelectorAll("#boardInfo .topBar,#boardInfo .hudStats,.flowHead,.shopTop,.battleTop")){ const r=spRect(el); if(r&&r.top<240) b=Math.max(b,r.bottom); } }catch(e){} return Math.round(b); }
/* 말풍선 자리 — PC 는 왼쪽(대상이 왼쪽이면 오른쪽), 좁은 화면은 위(대상이 아래 절반이면 위 · 위 절반이면 아래). 대상을 덮으면 반대편 */
function spPlace(rr){
  const c=$("spCoach"); if(!c||!c.classList) return;
  let wide=false, H=800, W=400; try{ W=window.innerWidth||400; H=window.innerHeight||800; wide=W>=900; }catch(e){}
  const fight=!!(S&&S.battle); if(fight) c.classList.add("inBattle"); else c.classList.remove("inBattle"); // 전투 창 안에서는 작은 말풍선
  const slots=fight?[...document.querySelectorAll("#overlay .bslot")].map(spRect).filter(Boolean):[];
  const upper=slots.length?slots.reduce((a,b)=>a.top<=b.top?a:b):null;
  /* 좁은 전투: 아래 → 두 전투원 칸 사이 그림 띠(mid) → 위. 넓은 화면: 왼쪽/오른쪽 */
  const opts=wide?["left","right"]:fight?["bottom","mid","top"]:["top","bottom"];
  const order=wide?(!rr||rr.left+rr.width/2>=W*0.4?[0,1]:[1,0]):fight?[0,1,2]:(!rr||rr.top+rr.height/2>=H/2?[0,1]:[1,0]);
  const hud=wide?0:spHudBottom(), ov=(a,b)=>!!a&&!!b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const keep=[rr].concat(slots,[...document.querySelectorAll("#spSpot .spZone b,#spSpot .spTag")].map(spRect)).filter(Boolean); // 대상 + 전투원 HP·능력치 칸 + 구역 띠 글자(1칸·2칸) · 이름표는 가리지 않는다
  const pad=8; // #spCoach 안쪽 여백 — 판정은 보이는 말풍선+마녀(.spCoachIn) 크기로
  const put=i=>{ for(const o of ["left","right","top","bottom","mid"]) c.classList.remove("at-"+o); const o=opts[i]; c.classList.add("at-"+o);
    c.style.top=o==="top"&&hud?hud+"px":o==="mid"&&upper?Math.round(upper.bottom+2-pad)+"px":""; // ⚙·신원·차례 줄은 늘 보이고 눌린다 · mid = 위 전투원 칸 바로 아래
    return spRect(fight&&c.querySelector(".spCoachIn")||c); }; // 전투에서는 보이는 말풍선+마녀 크기로 판정(그 밖은 종전 바깥 상자 그대로)
  const done=cr=>{ spMarkFit(cr); };
  for(const i of order){ if(opts[i]==="mid"&&!upper) continue; const cr=put(i); if(!cr||!keep.some(k=>ov(cr,k))) return done(cr); }
  for(const i of order){ if(opts[i]==="mid"&&!upper) continue; const cr=put(i); if(!cr||!ov(cr,rr)) return done(cr); } // 어디든 무언가를 가리면 적어도 대상은 가리지 않는 쪽(지원 크기 320·390·PC 에서는 위 줄에서 끝난다)
  done(put(order[0]));
}
/* 범례 번호가 말풍선 밑에 들면 같은 칸의 오른쪽 아래 모서리로 옮긴다(칸 안 · 다른 번호와 겹치지 않음) */
function spMarkFit(cr){ if(!cr) return; try{ for(const m of /** @type {any[]} */([...document.querySelectorAll("#spSpot .spMark")])){ const r=spRect(m.firstElementChild||m);
  if(r&&cr.left<r.right&&cr.right>r.left&&cr.top<r.bottom&&cr.bottom>r.top){ m.style.left=(Number(m.dataset.cr)-r.width-3)+"px"; m.style.top=(Number(m.dataset.cb)-r.height-3)+"px"; } } }catch(e){} }
if(typeof window!=="undefined"&&window.addEventListener){ window.addEventListener("resize",()=>{ const T=spT(); if(T&&T.step) spDraw(T); }); window.addEventListener("scroll",()=>{ const T=spT(); if(T&&T.step) spDraw(T); },true); }

/* ===== 기본 B1~B9 — 고정 합법 보드 (실제 엔진 · 실제 규칙) =====
   13행×7열 전체, 내 진영 11~13행. 경기 중간의 합법 배치(각 진영 하수인 6·폭탄 3·동료 2·함정 2·왕 1 = 14말, 겹침·보드 밖 없음).
   턴 수 12(표시 13)에서 시작해 B9 까지 내 차례 4번 + 상대 차례 3번 = 표시 19 — 정기 상점(20)·버닝(65)에 닿지 않는다(이 판은 비경제라 상점 자체도 없다).
   조기 종료 없음: 상대 하수인+동료는 B7 뒤에도 7, 왕끼리·왕과 상대 말은 붙지 않고, 내 왕은 B9 전 끝줄 밖. 상대 차례 = 행동 없이 차례 종료(대본).
   B3: 내 함정(11,5) 옆 숲 (10,5)의 상대 말은 ?로 보이고(존재만), 숲 (9,7)의 상대 말은 내 말 옆이 아니라 보이지 않는다 — 함정은 공격하지 못해 선택 전투가 생기지 않는다.
   B5 흔적 (9,2) 아이템 선물 · B6 (9,2)→(8,2) 로 (7,2) 상대 하수인 E 와 새로 붙어 강제 전투 · B7 물 M-W1 ⭐1 대 불 M-F4 ⭐1(상성 유리 1.3배 · 기존 데이터 그대로 · 보정 없음)
   B9 상대 끝줄 (1,7)의 내 말 ↔ 내 왕(12,4) 텔레포트 — (1,6)·(2,7)이 비어 새 강제 전투 0, 사전 차단 없음 → 엔진의 끝줄 승리.
   (고정 위치는 규칙상 합법인 배치다. 표시 턴 수 안에 그 자리까지 걸어올 수 있는가(이동 이력 재현)는 이 장면이 주장하지 않는다 — §3R.4 판정은 Venus) */
const SP_BASIC={seed:20261030,turn:12,dest:[8,2],
  roster:[["M-W1","M-G1","M-F3","M-L1","M-E1","M-G5"],["M-F4","M-L2","M-E3","M-G2","M-W6","M-L5"]],
  at:[{minion:[[9,2],[1,7],[11,1],[12,6],[13,3],[11,7]],bomb:[[11,3],[13,6],[12,1]],ally:[[12,2],[13,5]],trap:[[11,5],[13,1]],king:[[12,4]]},
      {minion:[[7,2],[10,5],[9,7],[1,1],[3,2],[3,5]],bomb:[[2,2],[3,4],[2,6]],ally:[[1,3],[1,5]],trap:[[2,4],[3,7]],king:[[1,4]]}],
  events:/** @type {[number,number,string][]} */([[4,2,"itemGift"],[5,6,"battleBuff"],[4,4,"recruit"],[9,2,"itemGift"],[10,3,"battleBuff"],[9,5,"recruit"]])};
function spBasicStart(){
  if(acctGateMsg()) return;
  const T=spTutNew("basic"); SP.tut=T; spBasicBuild(T,"B1");
}
/* stage B6 = 같은 판에서 B5 탐색과 상대 차례가 지난 상태(흔적 소모 · 선물 1 · 턴 +2) — B7 실패 때 그 시작점부터 다시 */
function spBasicBuild(T,stage){
  const D=SP_BASIC;
  uiResetScreen(); netLeave(); UI.entered=true; UI.drawer=null;
  newGame("pve",{aiLevel:["grade5",SP_TUT_LEVEL],phase:"play"});
  spSeed(D.seed+T.attempt);                                                     // 고정 seed — 이 경기 안에서만(경기가 바뀌면 되돌린다)
  for(const p of [0,1]){ S.roster[p]=D.roster[p].slice(); applyRoster(p);
    const left={minion:0,bomb:0,ally:0,trap:0,king:0};
    for(const x of S.pieces.filter(y=>y.owner===p)){ const at=D.at[p][x.type][left[x.type]++]; x.r=at[0]; x.c=at[1]; x.placed=true; x.movedEver=!zoneOf(p).includes(x.r); } }
  S.events=D.events.map(e=>({r:e[0],c:e[1],kind:e[2],consumed:false}));
  const mine=S.pieces.filter(x=>x.owner===0&&x.type==="minion"), foe=S.pieces.filter(x=>x.owner===1&&x.type==="minion");
  T.ids={M:mine[0].id,T:mine[1].id,K:S.pieces.find(x=>x.owner===0&&x.type==="king").id,E:foe[0].id,F:foe[1].id,ev:3,dest:D.dest};
  S.traces[0].add("9_2");
  S.turnCount=D.turn; T.t0=D.turn;                                             // 내 차례(새 상태의 current 0) · 표시 턴 13
  if(stage==="B6"){ S.events[3].consumed=true; S.pkgs[0].itemGift=1; S.turnCount=D.turn+2; } // T.t0 는 그대로 — 남은 단계의 차례 계산 기준
  addLog("튜토리얼 — 기본 연습 보드","sys");
  T.game=S; render();
}
/* 상대 대본 — ai.js aiStep·aiBattleAction 의 첫 판정. true = 튜토리얼이 대신 처리(그 밖의 경기는 false → 종전 AI 그대로)
   기본: 행동 없이 차례 종료 · 전투는 규칙상 합법인 고정 명령(1번 칸 기본기, 못 쓰면 넘기기) / 연습 장면: 상대는 두지 않는다 / 심화 실제 경기: 종전 브론즈 AI */
function spAiScript(battle){
  const T=spT(); if(!T||T.cat!=="basic"&&!T.practice) return false;
  if(T.practice) return true;
  if(!battle){ if(S.phase==="play"&&S.current===1&&!S.battle&&!S.fleePick) dispatchCoreAction({t:"endTurn"}); return true; }
  const r=aiCmd({t:"act",k:0}); if(!r||!r.events||!r.events.length) aiCmd({t:"pass"});
  return true;
}

/* ===== 심화 A1~A11 — 정상 브론즈 경기(정상 규칙·경제) · 플레이어 선공만 튜토리얼 전용 ===== */
function spAdvStart(){
  const T=spTutNew("advanced"); SP.tut=T;
  spStart(SP_TUT_LEVEL);
  if(!S||S.mode!=="pve"||S.phase!=="setup"){ SP.tut=null; return; }
  T.game=S;
}
/* 선공 — 튜토리얼 심화 경기(와 연습 장면)의 배치 확정(ui.js setupDoneCore)만 0(플레이어)을 싣는다. 그 밖은 null = 종전 무작위 선공 */
function spFirstPlayer(){ const T=spT(); return T&&T.cat==="advanced"?0:null; }
/* 연습 장면 — 실제 승·패 뒤 못 본 것만(상점 → 버닝). 각 장면은 별도 고정 합법 상태이고 끝난 자유 경기를 저장·복원하지 않는다(경기 객체만 보관했다가 결과 화면으로 되돌린다) */
const SP_PRACTICE_SEED=20261031;
function spPracticeNext(T){
  if(T.step==="A10"&&!T.practice) T.todo=["shop","burn"].filter(k=>!T.seen[k]);
  const k=T.todo.shift();
  if(!k){ spPracticeEnd(T,"completed"); return; }
  spPracticeBuild(T,k);
}
function spPracticeBuild(T,k){
  T.step=null; uiResetScreen(); netLeave(); UI.entered=true; UI.drawer=null;
  newGame("pve",{aiLevel:["grade5",SP_TUT_LEVEL],eco:true});
  spSeed(SP_PRACTICE_SEED); genEvents(); ecoOpenShop(S,"start",0);            // 고정 진열·코인(시드)
  T.practice=k; T.game=S;
  aiAutoPlace(0); window.setupDoneCore();                                      // 내 시작 상점·배치는 기존 자동 경로, 상대 배치·개시는 setupConfirm → setupAiBegin(플레이어 선공)
  S.current=1;                                                                 // 고정 장면: 상대 차례가 끝나는 자리에서 시작
  if(k==="shop"){ S.turnCount=19; spStep(T,"A10s"); dispatchCoreAction({t:"endTurn"}); }  // 상대 차례 끝 → 20턴 정기 상점(실제 개장 경로 · 보너스 포함)
  else { const m=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.alive&&x.placed&&x.immobile===0);
    m.r=8; m.c=4; m.movedEver=true; S.turnCount=63; T.f.burnId=m.id; T.f.dest=[6,4];
    spStep(T,"A10b"); T.f.burnId=m.id; T.f.dest=[6,4]; dispatchCoreAction({t:"endTurn"}); } // 상대 차례 끝 → 65턴 내 차례(버닝 시작 · 실제 턴 시작 경로)
  render();
}
function spPracticeSkip(){ const T=spT(); if(!T||!T.match||SP.dlg) return; spPracticeEnd(T,"skipped"); } // [남은 연습 건너뛰기] — 심화 = 건너뜀(해금은 된다 · 모든 학습 완료가 아니다)
function spPracticeEnd(T,res){
  T.practice=null; T.todo=[]; T.step=null; T.res=res;
  if(S!==T.match.game){ uiResetScreen(); commitNewGame(T.match.game); }        // 실제 경기 결과 화면으로 — 원래 승·패·사유 그대로
  T.game=S; UI.entered=true; SP.dlg="a11";
  spSave(res==="completed"?{category:"advanced",end:T.match.winType}:{category:"advanced",end:"skip"});
  render();
}

/* ===== 경기 종료 → 저장 (ui.js matchEnded) ===== */
function spMatchEnded(ev){
  const T=spT(), R=SP.run, run=!!R&&R.game===S; if(!T&&!run) return;
  const end=SP_ENDS.includes(ev.winType)?ev.winType:null;                      // 기권·무승부는 저장하지 않는다
  if(T){
    if(T.practice) return;                                                      // 연습 장면은 끝나지 않는다(계정·결과에 0건)
    T.step=null; T.hold=false;
    if(T.cat==="basic"){ if(end==="edge"&&ev.winner===0){ T.res="completed"; SP.dlg="bp"; spSave({category:"basic",end:"edge"}); } else T.abort=true; spSync(); return; }
    if(!end){ T.abort=true; spSync(); return; }
    T.match={game:S,winner:ev.winner,winType:end};
    if(T.seen.shop&&T.seen.burn){ spPracticeEnd(T,"completed"); return; }      // 이미 다 봤다 → 연습 없이 완료
    spStep(T,"A10"); spSync(); return;
  }
  if(!end||ev.winner!==0) return;
  if(AUTH.state==="off"){ if(R.tier>SP.local){ SP.local=R.tier; spUnlockNote(R.tier); } return; } // 계정 없는 체험 — 이번 로드 메모리만
  if(!SP.progress||R.tier>SP.progress.aiClearedTier) spSaveClear({tier:R.tier,end}); // 새 티어 승리만 — 재도전 승리는 바뀔 것이 없다(§6 생략 허용)
}
function spSave(x){ if(!spSignedIn()) return; spSend({kind:"tutorial",body:Object.assign({v:2,userId:AUTH.user.userId},x),uid:AUTH.user.userId,st:"busy",msg:"",unknown:false}); }
function spSaveClear(x){ if(!spSignedIn()) return; spSend({kind:"clear",body:Object.assign({v:1,userId:AUTH.user.userId},x),uid:AUTH.user.userId,st:"busy",msg:"",unknown:false}); }
function spSatisfied(v){
  const p=SP.progress; if(!p) return false;
  if(v.kind==="clear") return p.aiClearedTier>=v.body.tier;
  const c=v.body.category; return c==="all"?p.tutorial.advanced!=="pending"&&p.tutorial.basic!=="pending":p.tutorial[c]!=="pending";
}
const SP_FAIL="저장하지 못했어요.", SP_UNKNOWN="저장 여부를 확인하지 못했어요.", SP_RESOLVED=["E_TUTORIAL_CONFLICT","E_BASIC_REQUIRED"];
function spSend(v){
  SP.save=v; SP.pending=null; v.st="busy"; v.msg=""; v.unknown=false;
  spPaint();
  const ag=AUTH.gen;
  lobbyFetch(SP_API[v.kind],{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(v.body)}).then(r=>{
    if(SP.save!==v||ag!==AUTH.gen) return; // 다른 저장·다른 신원으로 바뀐 뒤의 늦은 응답
    const p=r.status===200||r.status===409&&SP_RESOLVED.includes(r.body.error)?spParseProgress(r.body.progress):null; // 409 + 현재 상태 = 먼저 저장된 값 — 처리됨이면 그것이 ACK(재시도 반복 없음)
    if(p){ spOnUser({userId:v.uid,progress:p}); if(spSatisfied(v)) spOk(v); else spFail(v,SP_FAIL,false); return; }
    if(r.status===401){ spAuthLost(v); return; }
    if(r.body.error==="E_ACCOUNT_MISMATCH"){ spFail(v,SP_FAIL,false); acctResumeProbe(); return; } // 다른 계정 세션 — 대조가 로그인 화면으로 보낸다
    if(r.body.error==="E_TIER_LOCKED"){ spFail(v,SP_FAIL,false); spRecheck(null,false); return; } // 진행이 어긋났다 — 표시만 서버 값으로
    if(r.status>=400&&r.status<500) { spFail(v,SP_FAIL,false); return; }                     // 명시적 거절(E_CLIENT_OUTDATED·형식 등)
    spRecheck(v,false); // 503·연결 실패·시간 초과·모르는 응답 — 저장됐는지 모른다 → 조회 1회만 자동
  });
}
/* 커밋 여부 조회 — 같은 계정의 서버 progress 로만 판단한다. v=null 이면 진행 표시만 새로 받는다. send: 아직이면 이어서 저장(사용자 [다시 시도]만).
   GET 도 로비와 같은 유한 마감(lobbyFetch 8초) — 응답이 오지 않으면 '저장 여부를 확인하지 못했어요' + [다시 시도]로 닫는다 */
const SP_SESSION="/api/auth/session";
function spRecheck(v,send){
  if(v){ SP.save=v; SP.pending=null; v.st="busy"; spPaint(); }
  const ag=AUTH.gen;
  lobbyFetch(SP_SESSION).then(r=>{
    if(ag!==AUTH.gen||v&&SP.save!==v) return;
    if(acctIsUser(r)&&r.body.userId===SP.uid){
      acctSetUser(r.body);
      if(!v){ spPaint(); return; }
      if(spSatisfied(v)) spOk(v); else if(!spParseProgress(r.body.progress)) spFail(v,SP_UNKNOWN,true); else if(send) spSend(v); else spFail(v,SP_FAIL,false);
      return; }
    if(r.status===401&&r.body.error==="E_NO_SESSION"){ if(v) spAuthLost(v); else acctEndSession(ACCT_SESSION_ENDED); return; }
    if(acctIsUser(r)){ acctEndSession(ACCT_TAB_SWITCHED); return; } // 다른 계정 — 이 저장을 옮기지 않는다
    if(v) spFail(v,SP_UNKNOWN,true); else spPaint();
  });
}
/* 401 — 끝난 장면(질문·진행도·결과)을 지우지 않고 로그인 화면으로. 같은 계정이 다시 로그인하면 spRestore 가 그 화면으로 되돌리고 · 다른 계정이면 spOnUser 가 버린다 */
function spAuthLost(v){ v.st="auth"; v.game=S; v.ask=SP.ask; v.dlg=SP.dlg; v.tut=SP.tut; SP.pending=v; if(SP.ask||SP.dlg) spDlgClose(); spCoachOff(); acctEndSession(ACCT_SESSION_ENDED,false,true); }
function spFail(v,msg,unknown){ v.st="fail"; v.msg=msg; v.unknown=unknown; spPaint(); if(!SP.ask&&!SP.dlg&&uiScreenName()!=="result") showToast("⚠️ "+msg); } // 화면 밖(재접속 우선으로 되돌리지 못한 경우)이면 토스트로
/* [다시 시도] — 저장 여부 불명이면 조회 → 필요할 때만 저장, 아니면 같은 요청을 다시(멱등) */
function spRetry(){ const v=SP.save; if(!v||v.st!=="fail"||!spSignedIn()||v.uid!==AUTH.user.userId) return; if(v.unknown) spRecheck(v,true); else spSend(v); }
function spOk(v){
  v.st="ok";
  if(v.kind==="tutorial"){
    if(SP.progress&&SP.progress.tutorialDone&&v.body.category!=="basic") SP.note=SP_UNLOCK_NOTE; // 이번 저장으로 해금 — 다음 로비에서 1회
    if(NET.roomId!=null){ SP.ask=false; SP.dlg=null; spDlgClose(); spSync(); return; }        // 좌석 재접속 중 — 로비로 끌고 가지 않는다(재접속 우선)
    if(SP.ask){ SP.ask=false; spDlgClose(); spSync(); SP.tut=null; toLobby(); return; }       // 첫 질문 [건너뛰기] — 저장 확인 뒤 바로 로비(+ 해금 알림)
    if(SP.dlg==="skipq"){ SP.dlg=null; spDlgClose(); spSync(); SP.tut=null; toLobby(); return; } // 심화 ⚙ 건너뛰기 — 저장 확인 뒤 로비
    const T=SP.tut, c=v.body.category; if(T&&(c==="basic"||c==="advanced")&&SP.progress) T.res=SP.progress.tutorial[c]; // 표시·다음 행동은 서버가 돌려준 정본 값(다른 창에서 먼저 정해졌을 수 있다 — 409 ACK)
    if(SP.dlg==="bp"||SP.dlg==="a11"){ spPaint(); return; }                                   // [다음 단계로]·[로비로] 활성은 그 패널이 맡는다
    toLobby(); return;                                                                        // 재로그인 뒤 다시 보낸 저장 — 패널이 이미 없다
  }
  spUnlockNote(v.body.tier);
  spPaint();
  try{ const b=$("spGo"); if(b&&b.focus) b.focus({preventScroll:true}); }catch(e){} // ACK 뒤 [다시 도전] 활성·초점(§3.6)
}
function spUnlockNote(tier){ spAnnounce(tier<3?`🔓 ${spTierKo(tier)}가 열렸어요.`:`🏅 ${spTierKo(2)} 클리어!`); } // 다음 티어 해금 1회 · 골드는 상위를 열지 않는다
function spPaint(){ if(SP.ask) spAskRender(); else if(SP.dlg) spDlgRender(); else if(uiScreenName()==="result"||uiScreenName()==="lobby") render(); }
/* ⚙ — 튜토리얼 경기에서는 기존 나가기(기권 확인) 자리에 "튜토리얼 건너뛰기"(연습 장면은 "남은 연습 건너뛰기"). 그 밖의 경기는 종전 그대로 */
function spGearLeave(leave){
  const T=spT(); if(!T||T.abort||SP.dlg) return leave;
  return T.match?`<button type="button" class="danger" onclick="spPracticeSkip()">남은 연습 건너뛰기</button>`:`<button type="button" class="danger" onclick="spSkipAsk()">튜토리얼 건너뛰기</button>`;
}

/* ===== 결과(S04p · 튜토리얼이 끝나지 않은 경기) — ui.js renderSide 가 부른다. 튜토리얼·무제한 AI 경기가 아니면 null ===== */
function spResultHtml(){
  const T=spT(), R=SP.run, run=!!R&&R.game===S; if(!T&&!run) return null;
  const w=S.winner, wt=S.metrics.winType, end=SP_ENDS.includes(wt), v=SP.save&&SP.save.uid===SP.uid?SP.save:null, ok=!!v&&v.st==="ok";
  const why=`<p class="resultWhy">${w===0?"승리":w===1?"패배":"무승부"}${wt&&WINTYPE_KO[wt]?` · ${WINTYPE_KO[wt]}`:""}</p>`;
  const retry=v&&v.st==="fail"?`<button type="button" onclick="spRetry()">다시 시도</button>`:"", dis=v&&!ok?" disabled":"";
  const note=`<p class="spNote"><small>공식 전적·최근 기록·보상에는 들어가지 않아요.</small></p>`;
  if(T){
    if(T.abort||!end) return {head:why+`<p class="lobbyNotice" role="status">학습이 끝나지 않았어요.</p>`+note,btns:`<button type="button" class="primary big" id="spGo" onclick="toLobby()">다시 시작</button>`};
    return {head:why+note,btns:""}; // 진행도·연습·결과 패널이 다음을 맡는다
  }
  const nm=spTierKo(R.tier-1), off=AUTH.state==="off";
  const line=!(end&&w===0)?`<p class="lobbyNotice" role="status">승리하지 않아 ${nm} 클리어가 아니에요.</p>`
    :off?`<p class="lobbyNotice" role="status">${nm} 클리어 — 이 접속에서만 유지 · 저장 안 됨</p>`
    :v?spSaveLine(v,`${nm} 클리어 저장됨`):`<p class="lobbyNotice" role="status">${nm}은(는) 이미 클리어한 단계예요.</p>`;
  return {head:why+line+note,btns:`${retry}<button type="button" class="primary big" id="spGo"${dis} onclick="rematch()">다시 도전</button><button type="button" class="big"${dis} onclick="spToTiers()">난이도로</button>`}; // 저장 중에는 떠나지 않는다(새 경기가 늦은 응답을 버리지 않게)
}

/* ===== 로비 안의 싱글 화면 — LOBBY.view: single(P01 카드 2장) · tiers(P02 무제한 AI 난이도 8칸) ===== */
/* [싱글플레이] — 확인 불가면 상태를 다시 조회해 미해금 → 튜토리얼 · 해금 → P01 · 또 실패 → 안내(§2.6). 튜토리얼 강제도 해금도 하지 않는다 */
function spOpen(){
  if(AUTH.state==="off"||spSignedIn()&&SP.progress){ if(spNeedTut()) spTutEnter(); else spView("single"); return; }
  if(AUTH.state!=="in"){ spToast("🔒 "+(acctGateMsg()||"로그인한 뒤 입장할 수 있습니다.")); return; }
  const ag=AUTH.gen;
  lobbyFetch(SP_SESSION).then(r=>{
    if(ag!==AUTH.gen||uiScreenName()!=="lobby") return;
    if(acctIsUser(r)&&r.body.userId===SP.uid){ acctSetUser(r.body); if(SP.progress){ if(spNeedTut()) spTutEnter(); else spView("single"); return; } }
    else if(r.status===401&&r.body.error==="E_NO_SESSION"){ acctEndSession(ACCT_SESSION_ENDED); return; }
    else if(acctIsUser(r)){ acctEndSession(ACCT_TAB_SWITCHED); return; }
    spToast("진행 정보를 불러오지 못했어요. 다시 시도해 주세요.");
  });
}
function spToast(t){ lobbyLocked("",t); } // 기존 로비 토스트(잠금 안내와 같은 자리·시간)
function spView(v){
  if(v==="home"){ lobbyHome(); return; }
  LOBBY.view=v; LOBBY.notice=""; LOBBY.toast=null; LOBBY.hist=false; LOBBY.create=false; lobbyPollStop();
  render(); lobbyFocus();
}
function spToTiers(){ SP.run=null; LOBBY.next="tiers"; toLobby(); }
function spBackSpec(sc){
  if(sc==="lobby"&&LOBBY.view==="single") return {label:"← 로비",title:"싱글 선택을 닫고 로비로 돌아갑니다"};
  if(sc==="lobby"&&LOBBY.view==="tiers") return {label:"← 싱글",title:"싱글 선택(무제한 AI · 왕국 대전)으로 돌아갑니다"};
  if(sc==="result"&&SP.run&&SP.run.game===S) return {label:"← 난이도",title:"무제한 AI 난이도 선택으로 돌아갑니다"};
  const T=spT();
  if(T&&!T.abort&&(sc==="board"||sc==="prep"||sc==="result")) return {label:"←",title:T.match?"남은 연습을 건너뜁니다":"튜토리얼 건너뛰기 (먼저 확인을 묻습니다)"};
  if(sc==="result"&&T&&spNeedTut()) return {label:"← 다시 시작",title:"튜토리얼을 처음부터 다시 시작합니다 (건너뛰기를 고를 수 있습니다)"};
  return null;
}
function spBack(sc){
  if(!spBackSpec(sc)) return false;
  if(sc==="lobby"){ spView(LOBBY.view==="tiers"?"single":"home"); return true; }
  const T=spT();
  if(T&&!T.abort&&sc!=="lobby"){ if(SP.dlg) return true; if(T.match) spPracticeSkip(); else spSkipAsk(); return true; } // 튜토리얼 중 ← = ⚙ 건너뛰기와 같은 길(기권이 아니다)
  if(fxLocked()){ showToast("연출이 끝난 뒤에 눌러 주세요."); return true; }
  if(SP.save&&SP.save.st!=="ok"){ showToast("저장을 확인한 뒤에 이동할 수 있어요. [다시 시도]를 눌러 주세요."); return true; } // ACK 전 결과를 떠나면 저장 문맥이 사라진다
  if(SP.run&&SP.run.game===S) spToTiers(); else toLobby();
  return true;
}
/* 티어 i(0..2) 상태 — 서버 진행으로만(계정 없는 체험은 이번 로드 메모리) */
function spTierState(i){
  const p=AUTH.state==="off"?{tutorialDone:true,aiClearedTier:SP.local}:spSignedIn()?SP.progress:null; if(!p) return "unknown";
  if(p.aiClearedTier>i) return "cleared";
  return (i===0?p.tutorialDone:p.aiClearedTier>=i)?"open":"locked";
}
function spLockWhy(i){ return i===0?"학습 경기를 마치면 열려요":`${spTierKo(i-1)}에서 이기면 열려요`; }
function spPlay(i){
  const st=spTierState(i);
  if(st==="unknown"){ spToast("진행 정보를 불러오지 못했어요. 다시 시도해 주세요."); return; }
  if(st==="locked"){ spToast(spLockWhy(i)); return; }
  SP.run={tier:i+1,game:null}; SP.tut=null; SP.save=null;
  spStart(SP_TIERS[i]);
  if(S&&S.mode==="pve") SP.run.game=S;
}
function spLobbyHtml(){
  const head=(back,title)=>`<div class="roomsHead"><button type="button" class="icoBtn" aria-label="${back[1]}" onclick="spView('${back[0]}')">${gi("back")}</button>
    <h2 id="spTitle" tabindex="-1">${title}</h2></div>${lobbyToastHost()}`;
  if(LOBBY.view==="single") return `<section class="roomsScreen spScreen" aria-labelledby="spTitle">${head(["home","로비로 돌아가기"],"싱글플레이")}
    <div class="spCards">
      <button type="button" class="primary spCard" onclick="spView('tiers')">${gi("battle")}<b>무제한 AI 대전</b><small>입장 무료 · 횟수 제한 없음</small></button>
      <button type="button" class="locked spCard" aria-disabled="true" data-lock="kingdom" aria-label="도전! 왕국 대전, 잠김, v0.4.17 예정" onclick="spToast('🔒 도전! 왕국 대전은 v0.4.17에 열려요.')">${gi("crown")}<b>도전! 왕국 대전</b><small>잠김 · v0.4.17 예정</small><i class="lk" aria-hidden="true">${gi("lock")}</i></button>
    </div></section>`;
  const TXT={open:"도전 가능",cleared:"클리어",unknown:"확인 불가"};
  const cells=SP_TIERS.map((k,i)=>{ const st=spTierState(i), nm=spTierKo(i), go=st==="open"||st==="cleared", t=st==="locked"?`잠김 · ${spLockWhy(i)}`:TXT[st];
    return `<li><button type="button" class="spTier t-${k} st-${st}${go?" primary":" locked"}"${go?"":` aria-disabled="true"`} aria-label="${nm}, ${t.replace(" · ",", ")}" onclick="spPlay(${i})"><b>${nm}</b><small>${t}</small>${st==="locked"?`<i class="lk" aria-hidden="true">${gi("lock")}</i>`:""}</button></li>`; })
    .concat(SP_FUTURE.map(n=>`<li><button type="button" class="spTier st-future" aria-disabled="true" aria-label="${n}, 추후 공개" onclick="spToast('추후 공개 예정이에요')"><b>${n}</b><small>추후 공개</small></button></li>`)).join(""); // 추후 공개 = 잠금 아이콘 없는 흐린 칸 + 글자(잠김과 다르다)
  return `<section class="roomsScreen spScreen" aria-labelledby="spTitle">${head(["single","싱글 선택으로 돌아가기"],"무제한 AI 대전")}
    ${AUTH.state==="off"?`<p class="lobbyNotice spNote" role="note">이 접속에서만 유지 · 저장 안 됨</p>`:""}
    <ol class="spTiers" aria-label="난이도 — 브론즈부터 천상계까지">${cells}</ol>
    <p class="spNote"><small>입장 무료 · 횟수 제한 없음 · 공식 전적·보상 없음${AUTH.state==="off"?"":" · 이긴 단계는 계정에 저장되어 다른 기기에서도 이어져요"}</small></p></section>`;
}
/* 질문·모달 안내 창의 키보드 — Tab 은 창 안에서만, Esc 는 ⚙ 확인 창에서만 [계속하기](질문·진행도·결과는 Esc 로 사라지지 않는다) */
if(typeof document!=="undefined"&&document.addEventListener) document.addEventListener("keydown",e=>{
  const el=$("spGuide"); if(!el||!el.innerHTML) return;
  if(e.key==="Escape"){ e.preventDefault(); e.stopImmediatePropagation(); if(SP.dlg==="skipq") spSkipNo(); return; }
  if(e.key!=="Tab") return;
  e.stopImmediatePropagation(); // 아래 게임 모달의 Tab 순환이 inert 창으로 포커스를 끌지 않게
  const f=[...el.querySelectorAll("button:not([disabled])")]; if(!f.length) return;
  const i=f.indexOf(/** @type {any} */(document.activeElement)), to=e.shiftKey?(i<=0?f.length-1:i-1):(i<0||i>=f.length-1?0:i+1);
  e.preventDefault(); f[to].focus();
},true);
