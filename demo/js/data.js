"use strict";
/* ===== 상수 — [DATA] 전투 수치 v0.1 제안값 (승인 전 임시) ===== */
const COLS=7, ROWS=13;
const BAL={
  minion:{hp:100,atk:22,skill:35,cd:2},
  ally:{hp:100,atk:16}, king:{hp:100,atk:16},
  captured:{hp:100,atk:20,skill:30,cd:2},
  advMult:1.3, disMult:0.75,
  burnPct:0.05, burnRounds:2, weakenPct:0.2, weakenHits:2,
  shieldPct:0.15, healPct:0.10, absorbCapPct:0.30,
  maxRounds:6, maxTurns:60, simMaxTurns:500, dmgVar:0.2,
  /* #121 (v0.4.7 계약 2.1·2.3): 시작 자원 회복약·쿨링수·해독제 각 1 · 공용 볼 2 · 보유 상한 전부 해제.
     itemPerRound(1)만 남고 itemPerBattle(전투 2회)·lastItem(연속 동일 금지)은 제거됐다 — 상수는 "제한 없음"을 뜻하는
     Infinity 로 남겨 두 제한이 사라진 사실을 한 곳에서 읽게 한다. 상한 해제는 **보유** 상한만이고 생성량(보드 이벤트 6개)은 늘지 않는다 */
  itemPerBattle:Infinity, itemPerRound:1, invMax:Infinity, ballStart:2, itemStart:["potion","cool","cure"],
  burnStart:65, // 버닝 타임 진입 표시 턴 (GDD-13 4.11 개정)
  captureAtkFailPct:0.25,
  statusProb:0.7, // T5-A(D10): 스킬 상태이상 부여 확률 — 화상·약화 (지속형은 100%, 테스트는 1로 고정)
  shockProb:0.5, // #96 (v0.4.4 §4): 감전 부여 확률 — 일반 번개 효과기·레거시 비지속형 번개만. 잔류장·레거시 지속형은 100% 유지 (테스트는 statusProb와 함께 1로 고정)
  eventsPerForest:3, // #121 계약 1.1: 구역당 **정확히 3개** — itemGift·battleBuff·recruit 각 1개 (종전 #12 의 3~4개 무작위 추첨을 대체)
  ballMax:Infinity, nextBuffPct:0.15, /* #121 계약 2.1: 볼 보유 상한 해제. nextBuffPct 는 계약 1.3 으로 **탐색에서 더는 얻을 수 없다** —
     상수·계산 경로(f.atkBuff)는 남기고 생성만 끊었다 (지금 이 값을 켜는 경로는 없다) */
  enemyCapProb:0.7, // #12: 적 하수인 포획 성공률
  /* #146 (v0.4.7 CJ 최종 승인 2026-09-10) 도망 재계약 — 세 가지가 함께 바뀐다:
     (1) HP 조건 폐지: 자기 전투 행동 차례면 언제나 시도할 수 있다 (시도 횟수 상한도 신설하지 않는다).
     (2) 기본 성공률 30%. 🏃 도망의 수호자를 쓴 전투원은 **그 전투 동안 70%** 로 치환된다 (+70%p 가산도, 1회 성공 보장도 아니다).
     (3) 실패는 자기 전투 행동 1회를 소모하고 상대는 정상 차례를 그대로 갖는다.
         #122 REVISE(2026-09-10 CJ QA 2)로 여기에 페널티 하나가 더해졌다 — 실패하면 **상대의 무료 기본 공격 1회**를 맞는다
         (기술이 아니라 기본 공격 한정 · 상대의 정상 차례는 그 뒤에 그대로 온다 · 💪 힘의 수호자면 기존 분산 고정으로 최대 피해).
     성공 이후(전투 즉시 종료 · 후방 교환 · 밀기 · 전투 회계 유지)는 #114 계약 그대로다. */
  fleeProb:0.3, fleeProbGuard:0.7,
  teleMax:Infinity, // #14 → #114 (v0.4.5 CJ 원문 "기존 2회 → 무제한"): 경기당 횟수 제한 해제. 사용 위치(상대 진영 진입)·주 행동 1회 소모·강제 접촉·전투 횟수 사전 차단·취소는 그대로. teleUsed 는 지표(teleports)와 함께 계속 기록한다
  enemyCapHp:70, // #20: 전투 중 적 하수인 포획(finishByCapture) 예비 하수인 시작 HP (maxHP 100 유지) — 숲 공용 포획(tryCapture)은 100/100
  itemHealPct:0.20,
  /* #121 계약 3 — 전투 버프 패키지 3종. 플레이어별 한 전투 1개, 아이템 회계와 별도, 무료 보너스 행동 */
  buffTimeRounds:3,   // 🧭 시간의 수호자: 그 전투만 양측 최대 3라운드 (BAL.maxRounds 전역은 불변 — S.battle.maxRounds 로만 처리)
  reaperRound:4,      // 💀 사신의 낫 봉인 해제 라운드 (자기 행동 차례 · 내 HP 비율 strict 열세 조건과 AND) — #234 REVISE 2차 CJ 결정(2026-09-17) 6→4
  witchEffects:2,     // 🕯 마녀의 장난: 4효과 중 서로 다른 2개 (균등 6조합 · 공유 rand 1회)
  aiDelay:650, simDelay:60, aiEps:0.08,
  aiStrongBudgetMs:120, aiStrongTopK:14, aiStrongReplyCap:36, // #21 5단: 판단 시간 상한·2-ply 후보 상한·상대 응수 상한
  healPostPct:0.05, // #106 (T2, CJ 최종): 회복 자세 — 각 플레이어 턴 종료마다 최대 HP 5% (나·상대 한 쌍 = 10%), 상한 maxHp, 정수 반올림
  /* #106 연출 시간(ms) — 계약 3.4 고정 상수. 모든 연출 시간은 이 표 한 곳에서만 읽는다. 규칙·난수와 무관한 표시 계층 전용이며
     헤드리스·sim(fxLive() false)에서는 전부 0 으로 취급된다. autoEnd: 자동 턴 종료 발화(4.6) 스위치 — 헤드리스 하네스는 기존 회귀 호환을 위해 끄고 전용 테스트에서 켠다
     #125 (v0.4.7 CJ 결정 — 2026-09-09): 전시성 배너·연출 그룹 12키(turnBanner·contactBanner·explosion·trapFx·roundBanner·skillFx·damageFx·itemFx·
     captureFx·fleeFx·judgeBanner·pushBanner)를 2000 → 1200ms 로 내린다. 이것은 "2000 일괄 치환"이 아니다 — resultBanner(2500)·countStep(1000)·
     roundEndFx(1000)·msgStep(600)·autoEndGrace(1000)·watchdog(1000)·BAL.aiDelay(650)은 범위 밖이라 그대로 둔다.
     CSS 쪽 동반 값: ghostBoom·cellBoom·boomPop(explosion 1200)·trapBlink(trapFx 1200) 애니메이션 2s → 1.2s, 바 전환 .6s → .35s (barStep). */
  fx:{turnBanner:1200,contactBanner:1200,explosion:1200,trapFx:1200,countStep:1000,roundBanner:1200,skillFx:1200,damageFx:1200,itemFx:1200,
      captureFx:1200,fleeFx:1200,resultBanner:2500,judgeBanner:1200,pushBanner:1200,roundEndFx:1000,msgStep:600,autoEndGrace:1000,watchdog:1000,autoEnd:true,
      barStep:350} /* 5.5 HP·방어막 바 너비 전환 시간(= CSS .hpbar>div/.shbar>div transition .35s). 방어막이 먼저 줄고 HP 바는 barStep 뒤에 시작해 둘 다 damageFx 안에서 끝난다.
     #125: damageFx 가 2000→1200 으로 줄면 종전 600+600=1200 은 damageFx 와 같아 여유가 0 이다(단계가 그룹 경계에 붙는다). barStep 과 CSS 두 바 전환을
     함께 350ms 로 내려 합 700ms, damageFx 안 여유 500ms 를 확보한다. 방어막→HP 순서·표시값·입력 잠금 계약은 불변. 불변식: 2*barStep ≤ damageFx */
};
/* ===== #21 시드 가능한 RNG — 게임 로직의 모든 난수는 rand()를 경유. setSeed(n)로 결정적 재현, setSeed(null)로 Math.random 복귀 ===== */
let RNG=null; // null → Math.random (테스트 하네스의 Math.random 오버라이드와 호환)
function rand(){return RNG?RNG():Math.random();}
function mulberry32(a){return function(){a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296;};}
function setSeed(seed){RNG=(seed===null||seed===undefined)?null:mulberry32(Number(seed)>>>0); return RNG;}
window.setSeed=setSeed;
/* ===== #21 AI 난이도: grade5(5급 — 휴리스틱 기준선) / dan5(5단 — 탐색·추론 기반 강AI) ===== */
const AI_LEVEL_KO={grade5:"5급",dan5:"5단"};
/* #233 (GDD-23 4.1): 실제 플레이 가능 속성은 여전히 4종이다 — 땅(land)은 상성 순환표에는 들어가지만
   실제로 그 속성을 쓰는 로스터 종·기술은 #234(로스터 확장) 전까지 없다. ELEMS는 스킬·모집·AI 후보 생성 등
   "지금 실제로 고를 수 있는 속성" 루프가 쓰는 배열이라 4종 그대로 둔다. */
const ELEMS=["fire","water","grass","lightning"];
const ELEM_KO={fire:"불",water:"물",grass:"풀",lightning:"번개",land:"땅"};
/* #233 GDD-23 4.1: 5속성 순환 불→풀→땅→번개→물→불(유리 ×1.3/불리 ×0.75/중립 ×1.0).
   구 4각형 순환(그래스가 라이트닝을 직접 이김)은 폐기 — 그 유리는 이제 땅을 거쳐야 한다.
   land는 상성표에만 존재하고 실제 로스터 종은 #234 전까지 없다(BEATS.land만 참조된다, ELEMS에는 없음). */
const BEATS={fire:"grass",grass:"land",land:"lightning",lightning:"water",water:"fire"};
const TYPE_KO={minion:"하수인",bomb:"폭탄",ally:"동료",trap:"함정",king:"왕",captured:"포획"};
const WINTYPE_KO={king:"왕 제거",edge:"끝줄 승리",resign:"기권",draw:"무승부",wipe:"전멸"};
/* #36 추측 메모 선택지 — 저장은 key(안정 문자열)만, 표시는 emoji·ko. 순서 = 팝업 표시 순서 */
const MEMO_OPTS=[{key:"king",emoji:"👑",ko:"왕"},{key:"ally",emoji:"🤝",ko:"동료"},{key:"minion_fire",emoji:"🔥",ko:"불 하수인"},{key:"minion_grass",emoji:"🌿",ko:"풀 하수인"},
  {key:"minion_water",emoji:"💧",ko:"물 하수인"},{key:"minion_lightning",emoji:"⚡",ko:"전기 하수인"},{key:"bomb",emoji:"💣",ko:"폭탄"},{key:"trap",emoji:"🪤",ko:"함정"}];
const memoOpt=key=>MEMO_OPTS.find(o=>o.key===key)||null;
const SKILL_KO={fire:"화염탄",water:"물대포",grass:"넝쿨 흡수",lightning:"낙뢰"};
/* ===== 기술 4슬롯 체계 (GDD-16 v1.0 3장) — 속성 공격기 12종 + 공용 보조기 6종 + 시그니처 5종 ===== */
const SKILL_ATK_BASE=22; // 위력 스케일 기준: 최종 위력 = 기술 위력 × (종 atk / 22), 사사오입
const SKIND_KO={attack:"공격기",support:"보조기",sig:"시그니처",basic:"기본기"};
const SKILLS={
  // 속성 공격기 — tier: stable(안정)/effect(효과)/heavy(고위력) · el: 기술 속성 (#92 v0.4.4 §2.4 — 공격 상성·상태 종류·이펙트·전투 AI 판단은 기술 속성, 방어 상성은 본체 속성)
  fire_stable:{ko:"화염탄",kind:"attack",el:"fire",tier:"stable",cd:0,pow:26,desc:"안정 공격기"},
  fire_effect:{ko:"잔불 표식",kind:"attack",el:"fire",tier:"effect",cd:2,pow:22,status:true,desc:"70% 확률 화상 2R"},
  fire_heavy:{ko:"폭염 강타",kind:"attack",el:"fire",tier:"heavy",cd:3,pow:38,desc:"고위력 공격기"},
  water_stable:{ko:"물대포",kind:"attack",el:"water",tier:"stable",cd:0,pow:26,desc:"안정 공격기"},
  water_effect:{ko:"침식 수류",kind:"attack",el:"water",tier:"effect",cd:2,pow:22,status:true,desc:"70% 확률 약화 2회"},
  water_heavy:{ko:"쇄도 파도",kind:"attack",el:"water",tier:"heavy",cd:3,pow:32,bonusVsShield:6,desc:"대상 보호막 보유 시 +6"},
  grass_stable:{ko:"덩굴 채찍",kind:"attack",el:"grass",tier:"stable",cd:0,pow:26,desc:"안정 공격기"},
  grass_effect:{ko:"흡수 새싹",kind:"attack",el:"grass",tier:"effect",cd:2,pow:20,drainPct:0.4,desc:"실HP 피해의 40% 회복"},
  grass_heavy:{ko:"가시 폭발",kind:"attack",el:"grass",tier:"heavy",cd:3,pow:34,selfShieldPct:0.10,desc:"자기 최대 HP 10% 보호막"},
  lightning_stable:{ko:"전기탄",kind:"attack",el:"lightning",tier:"stable",cd:0,pow:26,desc:"안정 공격기"},
  lightning_effect:{ko:"감전 침",kind:"attack",el:"lightning",tier:"effect",cd:2,pow:22,status:true,desc:"50% 확률 감전(후공 1회)"},
  lightning_heavy:{ko:"연쇄 번개",kind:"attack",el:"lightning",tier:"heavy",cd:3,pow:34,bonusVsStatus:6,desc:"대상 상태이상 시 +6"},
  // 공용 보조기 6종
  sup_heal:{ko:"응급 치유",kind:"support",cd:3,healPct:0.20,desc:"자기 HP 20% 회복"},
  sup_guard:{ko:"수호 자세",kind:"support",cd:3,shieldPct:0.18,desc:"최대 HP 18% 보호막"},
  sup_focus:{ko:"집중",kind:"support",cd:3,focus:true,desc:"다음 공격기 위력 +20% (1회)"},
  sup_cool:{ko:"냉각",kind:"support",cd:4,coolAny:true,desc:"남은 쿨 최장 기술 1개 쿨 -1 (자기 제외)"},
  sup_cleanse:{ko:"정화",kind:"support",cd:3,cleanse:true,desc:"자기 상태이상 1개 제거"},
  sup_evade:{ko:"회피 자세",kind:"support",cd:3,dmgCut:0.25,desc:"다음 피격 25% 감소"},
  // 시그니처 5종 (아키타입별)
  sig_std:{ko:"전술 연계",kind:"sig",cd:3,pow:30,coolAttack:true,desc:"다른 속성 공격기 1개 쿨 -1"},
  sig_atk:{ko:"결정타",kind:"sig",cd:4,pow:40,selfVuln:0.15,desc:"사용 후 다음 피격 피해 +15%"},
  sig_def:{ko:"불굴 진형",kind:"sig",cd:4,shieldPct:0.22,dmgCut:0.15,desc:"22% 보호막 + 다음 피격 15% 감소"},
  sig_swift:{ko:"급속 순환",kind:"sig",cd:2,pow:22,coolAttackLongest:true,desc:"남은 쿨 최장 공격기 쿨 -1"},
  sig_sustain:{ko:"잔류장",kind:"sig",cd:3,pow:18,statusSelf:true,desc:"자기 속성 상태효과 부여 (100%)"},
  /* #121 계약 5 — 신규 공용 기술 3종. `cls` 는 **기술 전용 분류**다: 본체 속성도, 다섯 번째 상성도 아니다.
     상성표 4종(불·물·풀·번개)과 방어 상성(= 본체 속성 기준)은 그대로다. cls 기술은 atkElOf() 가 null 을 돌려주므로
     일반 BEATS 배율 블록을 아예 타지 않고(= 중립 1.0), 필요한 배율은 기술별 플래그로만 적용한다. */
  dragon_breath:{ko:"드래곤 숨결",kind:"attack",cls:"dragon",cd:3,pow:30,dragonMult:1.3,
    desc:"용 분류 · 속성이 있는 상대에게 항상 ×1.3 (무속성 왕·동료 본체에는 중립 1.0)"},
  witch_prank:{ko:"마녀의 장난",kind:"attack",cls:"dark",cd:3,pow:18,witch:true,
    desc:"어둠 분류 · 중립 1.0 · 화상·약화·감전·풀 회복 중 서로 다른 2효과를 100% 적용"},
  reaper_scythe:{ko:"사신의 낫",kind:"attack",cls:"blood",cd:0,reaper:true,
    desc:"핏빛 분류 · 4라운드 · 내 HP 비율이 상대보다 낮을 때만 — 보호막을 무시하고 즉사 · 사용한 다음 전투는 봉인"}
};
/* #121 계약 5: 기술 전용 분류 표기 (본체 속성·상성과 무관) */
const SKILL_CLS_KO={dragon:"용",dark:"어둠",blood:"핏빛"};
const SKILL_CLS_EMO={dragon:"🐉",dark:"🕯",blood:"💀"};
const NEW_SKILLS=["dragon_breath","witch_prank","reaper_scythe"]; // 계약 4.2 제안 목록 — 순서 고정, 제안 표시에 난수 0
/* #121 계약 5.3 사신의 낫 사용 자격 — **CD 와 분리된 봉인**이다. cds[] 를 줄이는 어떤 수단(쿨링수·냉각·전술 연계·급속 순환)도
   이 게이트를 풀지 못한다. cd:0 으로 등록해 쿨 감소 경로가 이 슬롯을 아예 집지 않게 하고, 게이트만 단일 조건으로 둔다.
   조건: (1) 전투가 그 라운드에 도달했다 (2) 시간의 수호자로 3라운드가 된 전투가 아니다 (3) 내 HP 비율 < 상대 HP 비율 (strict).
   매 사용 시점에 최신 상태로 다시 검사한다 — 반환값을 캐시하지 않는다. 반환: null(가능) 또는 불가 이유 문자열. */
function reaperWhy(side){
  const B=S.battle; if(!B) return "전투 중에만 사용할 수 있습니다";
  const f=side==="A"?B.fa:B.fd, opp=side==="A"?B.fd:B.fa;
  /* #234 REVISE 2차 CJ 결정(2026-09-17) 전투를 넘는 봉인 — 말(전투원 객체) 단위 f.reaperSeal: 2=이번 전투에서 사용(다음 참전 전투 봉인) ·
     1=지난 참전 전투에서 사용해 이번 전투 봉인 · 0=없음. startRounds 가 참전 시 1 씩 줄인다. 쿨링수·⌛ 감소와 무관하다 */
  if(f.reaperSeal===1) return "지난 전투에서 사용 — 이번 전투는 봉인 (다음 전투부터 사용 가능)";
  if(f.reaperSeal===2) return "이번 전투에서 이미 사용했습니다";
  const cap=battleMaxRounds();
  if(cap<BAL.reaperRound) return `이 전투는 ${cap}라운드까지입니다 — 봉인 해제 불가`; // 시간의 수호자 3R 전투
  if(B.round<BAL.reaperRound) return `${BAL.reaperRound}라운드부터 (현재 ${B.round}R) — 봉인`;
  const mine=f.hp/f.maxHp, theirs=opp.hp/opp.maxHp;
  if(!(mine<theirs)) return `내 HP 비율 ${pct(mine)} — 상대 ${pct(theirs)} 보다 낮아야 합니다`;
  return null;
}
/* 이 슬롯을 지금 실제로 쓸 수 있는가 — 쿨 + 기술 고유 게이트. 사람 UI·AI·기본 공격 폴백이 모두 이 한 함수를 본다 */
function slotUsable(f,i,side){
  if(!f.skills||f.cds[i]>0) return false;
  const B0=S.battle; // #241 R1 번개 꼬리 추가 공격 중 — 허용 슬롯(기본기 · 2차 · 3차)만 합법 (사람 UI · AI · 서버가 같은 함수를 본다)
  if(B0&&B0.bonus&&B0.bonus.stage==="active"&&(side===B0.bonus.side||(side===undefined&&f===(B0.bonus.side==="A"?B0.fa:B0.fd)))&&!B0.bonus.allowed.includes(i)) return false;
  const sk=SKILLS[f.skills[i]];
  if(sk&&sk.v2){ // #234: 수면 포자(기본기만) · 전투당 1회 · 사용 조건(번개 발도·지하 매복·태고의 각성)
    if(f.sleepNext&&sk.kind!=="basic"&&!sk.reaper) return false; // #234 REVISE 2차 CJ 결정: 사신의 낫은 행동 차단(수면 포자)도 무시
    if(!v2ReqOk(f,sk,side)) return false; }
  if(sk&&sk.reaper) return reaperWhy(side)===null;
  return true;
}
/* 계약 3.3: 이 전투의 최대 라운드 — 전투 인스턴스 값이 있으면 그것, 없으면 전역 BAL.maxRounds (전역 상수는 바꾸지 않는다) */
function battleMaxRounds(){ const B=S.battle; return (B&&B.maxRounds)||BAL.maxRounds; }
/* #146 계약: 이 전투원의 도망 성공률 — 🏃 도망의 수호자를 쓴 전투원만 70% 로 **치환**된다 (가산 아님).
   UI 표기·실제 판정·AI 가 모두 이 한 함수를 본다 (표시와 판정이 갈라지지 않는다). */
function fleeProbOf(f){ return (f&&f.fleeBoost)?BAL.fleeProbGuard:BAL.fleeProb; }
/* #146 계약: 4슬롯이 전부 불가할 때의 안내 문구 — 화면 두 곳(메시지 박스·싸우기 패널)이 같은 문자열을 쓴다 */
const NO_ATTACK_MSG="공격할 것이 없습니다. 턴 종료할까요?";
/* 종별 장착 템플릿 (GDD-16 4장) — 공격기는 자기 속성 풀, 슬롯2=보조기·슬롯3=시그니처 고정 */
const ARCH_TMPL={
  std:["stable","effect","sup_heal","sig_std"],
  atk:["stable","heavy","sup_focus","sig_atk"],
  def:["effect","heavy","sup_guard","sig_def"],
  swift:["stable","effect","sup_cool","sig_swift"],
  sustain:["effect","heavy","sup_cleanse","sig_sustain"]
};
function archSkills(arch,el){return ARCH_TMPL[arch].map(t=>(t==="stable"||t==="effect"||t==="heavy")?el+"_"+t:t);}
/* GDD-23 4.2 ⑪ "정수 반올림 1회" — 피해 파이프라인에 들어가는 값은 **미리 반올림하지 않는다**.
   종전에는 여기서 한 번, resolveHit ⑪ 에서 또 한 번 반올려 **이중 반올림**이었다(PD diff 지적).
   slotPow 는 이제 표시용이다 — 기술 라벨의 예상 피해 폭(dmgRange)과 AI 휴리스틱 추정처럼
   사람에게 정수로 보여 주거나 비교만 하는 곳이 쓴다. 실제 타격은 slotPowRaw 로 소수를 그대로 ②에 넣고
   ⑪ 에서 딱 한 번만 반올림한다. */
function slotPowRaw(f,sk){return sk.pow*f.atk/SKILL_ATK_BASE;}
function slotPow(f,sk){return Math.round(slotPowRaw(f,sk));} // 표시용 위력 스케일 (사사오입)
/* #92 기술 속성 판정 — 공격기(el 보유)는 기술 속성, 기본 공격·시그니처·보조기·레거시 경로는 본체 속성 그대로 */
const SKILL_TIER_KO={stable:"안정",effect:"효과",heavy:"고위력"};
/* #121 계약 5: cls 기술(용·어둠·핏빛)은 **속성 판정에서 빠진다** → null. 호출자의 `if(atkEl&&opp.element)` 상성 블록과
   상태 종류 매핑·속성 플래시가 모두 자동으로 중립이 된다. 드래곤의 ×1.3 은 속성이 아니라 기술 플래그로 따로 적용한다. */
function atkElOf(f,sk){ if(sk&&(sk.cls||sk.neutral)) return null; // #234: 전설 스킬은 중립(4.1)
   return (sk&&sk.kind==="attack"&&sk.el)?sk.el:f.element; }
function skillNameKo(sid,bodyEl){const sk=SKILLS[sid];
  if(sk.cls) return `${SKILL_CLS_EMO[sk.cls]||""}${sk.ko}`; // #121: 신규 3종은 기술 전용 분류 이모지 (속성 아님)
  return (sk.el&&bodyEl&&sk.el!==bodyEl)?`${ELEM_EMO[sk.el]}${sk.ko}`:sk.ko;} // 본체와 다른 속성의 공격기는 속성 이모지를 앞에 붙여 구분 (소유자 화면 전용)
/* #92 속성 교차 공격기 후보 — 본체와 다른 3속성 × {안정·효과·고위력} 9종 중 이미 장착한 기술 제외 (순서 고정).
   #121 계약 1.3·4 (v0.4.7): **탐색 보상이 더 이상 이 후보를 주지 않는다.** 탐색 recruit 은 신규 공용 3종 직접 선택으로 대체됐다.
   계약 1.3 [추론]이 Mars 판단으로 남긴 범위에서 이 순수 함수와 아래 슬롯 정책은 **남긴다** — 교차 속성 판정(atkElOf)·슬롯 승계 규칙의
   단위 계약이고, 이번 계약이 바꾸는 것은 "무엇을 주는가"이지 교차 속성 규칙 자체가 아니다 (그 규칙을 지우는 것은 요청 밖이다). */
function recruitCandidates(p){
  const have=new Set(p.skills||[]);
  const out=[];
  for(const el of ELEMS){ if(el===p.element) continue;
    for(const tier of ["stable","effect","heavy"]){ const id=el+"_"+tier; if(!have.has(id)) out.push(id); } }
  return out;
}
/* #92 AI 교체 정책 (v0.4.4 §2.7) — 공격기 2슬롯 한정. #121 계약 4.2 의 AI 는 4슬롯 전체를 쓰므로 아래 aiRecruitPlan 이 이 정책을 확장한다.
   ① 방어형·지속형은 효과기 슬롯을 교체 후보에서 제외 ② 남은 슬롯이 없으면 유지
   ③ 남은 슬롯 중 위력이 가장 낮은 슬롯(동률은 앞 슬롯)을 고르고 후보 위력 ≥ 그 슬롯 위력이면 교체, 아니면 유지. 난수 미소비(결정적) */
function aiRecruitSlot(p,alt){
  const a=archOf(p), keepEffect=(a==="def"||a==="sustain");
  let pick=-1;
  for(const i of [0,1]){ const sk=SKILLS[p.skills[i]]; if(!sk||sk.kind!=="attack") continue;
    if(keepEffect&&sk.tier==="effect") continue;
    if(pick<0||sk.pow<SKILLS[p.skills[pick]].pow) pick=i; }
  if(pick<0) return -1;
  return SKILLS[alt].pow>=SKILLS[p.skills[pick]].pow?pick:-1;
}
const ITEMS={potion:{ko:"회복약",desc:"HP 20% 회복"}, cool:{ko:"쿨링수",desc:"스킬 쿨타임 초기화"}, cure:{ko:"해독제",desc:"상태이상 해제"}};
/* #121 계약 2.2: 아이템 선물 패키지에서 받을 수 있는 4종 — 아이템 3종 + 공용 볼. 순서 고정(표시·AI·온라인 인덱스 중계 공용) */
const GIFT_PICKS=["potion","cool","cure","ball"];
const GIFT_KO={potion:"회복약",cool:"쿨링수",cure:"해독제",ball:"공용 몬스터볼"};
/* #121 계약 3.2~3.4: 전투 버프 패키지 3종. 순서 고정 — 선택 UI·AI·온라인이 같은 인덱스를 본다.
   r1Only: 시간의 수호자는 **사용자 자기 행동의 1라운드에만** 선택할 수 있다 (계약 3.3) */
const BUFFS={
  power:{ko:"💪 힘의 수호자",desc:"이 전투 동안 내 피해 분산을 최대치로 고정 (상성·약화·보호막 계산은 그대로)"},
  time:{ko:"🧭 시간의 수호자",desc:"이 전투만 양측 최대 3라운드 — 1라운드에만 사용 가능 · 사신의 낫은 발동 불가"},
  escape:{ko:"🏃 도망의 수호자",desc:"이 전투 동안 도망 성공률을 70%로 높입니다"}
};
const BUFF_KEYS=["power","time","escape"];
/* ===== #233 (GDD-23 3장) 8스탯 전투 엔진 계약 — 순수 데이터·헬퍼. 보호형(guard)·땅속성 종은 #234 전까지 로스터에 없다.
   여기 실린 표는 GDD-23 3.3·3.4·3.5·3.6 을 그대로 옮긴 것이며, 실제 라이브 로스터(ROSTER·king·ally)는
   아래에서 이 표를 읽어 8스탯을 주입한다(hp·atk 외 def·spd·dodge·crit·statusPct·shieldStartPct). */
const ARCH_KO={std:"표준",atk:"공격",def:"방어",swift:"속공",sustain:"지속",guard:"보호"};
/* 3.3 아키타입 기본 스탯(⭐1). dodge·crit·statusPct는 확률(0~1), shieldStartPct는 전투 시작 시 부여되는 최대 HP 비율 */
const ARCHETYPE_BASE={
  std:    {hp:100,atk:22,def:10,spd:10,dodge:0.05,crit:0.05,statusPct:0,   shieldStartPct:0},
  atk:    {hp:90, atk:25,def:5, spd:10,dodge:0,    crit:0.10,statusPct:0,   shieldStartPct:0},
  def:    {hp:120,atk:18,def:20,spd:6, dodge:0,    crit:0,   statusPct:0,   shieldStartPct:0},
  swift:  {hp:85, atk:24,def:5, spd:14,dodge:0.10, crit:0.05,statusPct:0,   shieldStartPct:0},
  sustain:{hp:95, atk:20,def:10,spd:8, dodge:0.05, crit:0,   statusPct:0.10,shieldStartPct:0},
  guard:  {hp:110,atk:19,def:10,spd:7, dodge:0,    crit:0,   statusPct:0,   shieldStartPct:0.10} // #234 전까지 실제 종 없음
};
/* 3.5 왕·동료 고정 스탯(등급 없음, grade=null) */
const KING_BASE={hp:100,atk:16,def:10,spd:8,dodge:0,crit:0,statusPct:0};
const ALLY_BASE={
  assassin:{hp:100,atk:18,def:5, spd:12,dodge:0.10,crit:0.10,statusPct:0}, // 동료1 — 암살자
  shield:  {hp:100,atk:14,def:20,spd:6, dodge:0,    crit:0,   statusPct:0}  // 동료2 — 방패병
};
/* 3.6 전설 하수인 고정 스탯(등급 없음, grade=5로 취급 — 등급 비교에서는 최고 등급으로 참여). #234 전까지 로스터에 없다. */
const LEGEND_BASE={
  dragon:{hp:175,atk:35,def:15,spd:11,dodge:0.05,crit:0.10,statusPct:0},
  witch: {hp:165,atk:32,def:12,spd:13,dodge:0.10,crit:0.05,statusPct:0.25},
  reaper:{hp:158,atk:40,def:8, spd:14,dodge:0.15,crit:0.20,statusPct:0}
};
/* 3.4 등급 성장 — ❤️ HP ×(1+0.15×(등급-1)), 💪 공격력 ×(1+0.10×(등급-1)), 정수 반올림. 등급 없음(null/undefined)·1급은 성장 없음. */
function gradeHp(base,grade){ return (!grade||grade<=1)?Math.round(base):Math.round(base*(1+0.15*(grade-1))); }
function gradeAtk(base,grade){ return (!grade||grade<=1)?Math.round(base):Math.round(base*(1+0.10*(grade-1))); }
/* def·spd·dodge·crit·statusPct는 등급으로 바뀌지 않는다(3.4) — 아키타입 표 값을 그대로 대상 전투원에 주입 */
function applyArchStats(f,arch,grade){
  const b=ARCHETYPE_BASE[arch]; if(!b) return;
  f.def=b.def; f.spd=b.spd; f.dodge=b.dodge; f.crit=b.crit; f.statusPct=b.statusPct; f.shieldStartPct=b.shieldStartPct;
  f.grade=(grade===undefined)?1:grade;
}
function applyFixedStats(f,base,grade){ // 왕·동료·전설처럼 등급이 없는(또는 5급 고정) 전투원
  f.def=base.def; f.spd=base.spd; f.dodge=base.dodge; f.crit=base.crit; f.statusPct=base.statusPct; f.shieldStartPct=0;
  f.grade=(grade===undefined)?null:grade;
}
/* 하수인 로스터 30종 — GDD-23 6.3 (속성 5 × 아키타입 6). 기존 20종의 id·아트 폴더는 그대로 두고, 이름이 6.3 표와 다른 두 종(M-W3·M-G5)만
   6.3 이름으로 바꿨다(속성·아키타입이 같아 아트 폴더 재사용). 보호형 4종·땅 6종은 뒤에 붙인다 — 전용 아트가 없어 이모지 폴백.
   hp·atk 는 3.3 아키타입 ⭐1 값. skill·cd 는 #92 이전 레거시 스칼라 필드로, 라이브 스킬(v2)이 쓰지 않는다(새 종은 0). */
const ROSTER=[
  {id:"M-F1",name:"새끼 화룡",element:"fire",arch:"std",hp:100,atk:22,skill:35,cd:2},
  {id:"M-F2",name:"화염 투사",element:"fire",arch:"atk",hp:90,atk:25,skill:40,cd:3},
  {id:"M-F3",name:"용암 거북",element:"fire",arch:"def",hp:120,atk:18,skill:30,cd:2},
  {id:"M-W1",name:"물방울 요정",element:"water",arch:"std",hp:100,atk:22,skill:35,cd:2},
  {id:"M-W2",name:"심해 사냥꾼",element:"water",arch:"atk",hp:90,atk:25,skill:40,cd:3},
  {id:"M-W3",name:"빙벽 정령",element:"water",arch:"def",hp:120,atk:18,skill:30,cd:2},
  {id:"M-G1",name:"새싹 파수꾼",element:"grass",arch:"std",hp:100,atk:22,skill:35,cd:2},
  {id:"M-G2",name:"가시 덩굴",element:"grass",arch:"atk",hp:90,atk:25,skill:40,cd:3},
  {id:"M-G3",name:"고목 수호자",element:"grass",arch:"def",hp:120,atk:18,skill:30,cd:2},
  {id:"M-L1",name:"스파크",element:"lightning",arch:"std",hp:100,atk:22,skill:35,cd:2},
  {id:"M-L2",name:"뇌격수",element:"lightning",arch:"atk",hp:90,atk:25,skill:40,cd:3},
  {id:"M-L3",name:"피뢰 골렘",element:"lightning",arch:"def",hp:120,atk:18,skill:30,cd:2},
  {id:"M-F4",name:"불티 정령",element:"fire",arch:"swift",hp:85,atk:24,skill:30,cd:1},
  {id:"M-W4",name:"안개 무희",element:"water",arch:"swift",hp:85,atk:24,skill:30,cd:1},
  {id:"M-G4",name:"포자 요정",element:"grass",arch:"swift",hp:85,atk:24,skill:30,cd:1},
  {id:"M-L4",name:"번개 여우",element:"lightning",arch:"swift",hp:85,atk:24,skill:30,cd:1},
  {id:"M-F5",name:"재의 주술사",element:"fire",arch:"sustain",hp:95,atk:20,skill:28,cd:2},
  {id:"M-W5",name:"파도 술사",element:"water",arch:"sustain",hp:95,atk:20,skill:28,cd:2},
  {id:"M-G5",name:"이끼 거인",element:"grass",arch:"sustain",hp:95,atk:20,skill:28,cd:2},
  {id:"M-L5",name:"전자기 술사",element:"lightning",arch:"sustain",hp:95,atk:20,skill:28,cd:2},
  {id:"M-F6",name:"화산 딱정벌레",element:"fire",arch:"guard",hp:110,atk:19,skill:0,cd:0},
  {id:"M-W6",name:"방패 게",element:"water",arch:"guard",hp:110,atk:19,skill:0,cd:0},
  {id:"M-L6",name:"축전 해파리",element:"lightning",arch:"guard",hp:110,atk:19,skill:0,cd:0},
  {id:"M-G6",name:"방패 버섯",element:"grass",arch:"guard",hp:110,atk:19,skill:0,cd:0},
  {id:"M-E1",name:"바위 두더지",element:"land",arch:"std",hp:100,atk:22,skill:0,cd:0},
  {id:"M-E2",name:"돌창 거인",element:"land",arch:"atk",hp:90,atk:25,skill:0,cd:0},
  {id:"M-E3",name:"철갑 코뿔소",element:"land",arch:"def",hp:120,atk:18,skill:0,cd:0},
  {id:"M-E4",name:"모래 여우",element:"land",arch:"swift",hp:85,atk:24,skill:0,cd:0},
  {id:"M-E5",name:"고대 골렘",element:"land",arch:"sustain",hp:95,atk:20,skill:0,cd:0},
  {id:"M-E6",name:"황토 아르마딜로",element:"land",arch:"guard",hp:110,atk:19,skill:0,cd:0}
];
/* ===== #234 (GDD-23 6장) 하수인 30종 · 전설 3종 · 왕 · 동료 스킬 — 데이터와 실행기 =====
   · 모든 공격은 스킬이다(6.1). 1차는 기본기 💪100% · ⌛0 · 조건·HP 소모 없음. 2차는 아키타입 골격 + 속성 효과.
   · 스킬은 SKILLS 레지스트리에 v2:true 로 함께 등록한다 — 전투 UI·쿨·공개 기록·AI 가 같은 슬롯 경로를 그대로 쓴다.
     종전 #92/#121 기술(fire_stable 등)은 레거시 회귀가 직접 부르는 계약이라 지우지 않았고, 라이브 로스터는 더 이상 쓰지 않는다.
   · pct = 스킬 위력 💪N%. pow 는 표시·AI 추정 호환용 파생값(pct×22/100 → slotPowRaw 가 공격력×N% 를 돌려준다).
   · 시너지(#235)·상점/전설 획득(#236)·서버(#237)·UI 개편(#238)은 이 블록 범위가 아니다. */

/* #234 구현 해석 11건 — 바꿀 때 이 한 곳만 고친다. 판정 원본: docs/milestone/v0.4.11/issues/234/Venus/interpretation.md
   분류: Q1 = CJ 결정(2026-09-17) · Q2·Q9·Q11 굴 파기 = 확정(GDD 문언) · 나머지 = [설계 보완 — CJ 승인 대기](Venus 권고). */
const V2_INTERP={
  recruitSkillSwap:false,        // Q1 [CJ 결정 2026-09-17] 탐색 '기술 교체'(#121)는 v0.4.11 에서 없어질 시스템 — 비활성(코드는 분기로 보존), 하수인 포획만 유지
  brandByTurnOrder:true,         // Q2 [확정] 천둥 낙인 — '대상이 이번 라운드 후턴' = 사용자가 이번 라운드 선턴(4.4 행동 순서, 라운드 시작 시 확정)
  /* #241 [CJ 결정 R1 2026-09-17] 번개 꼬리 = 같은 턴 추가 공격 1회(플레이어·AI 선택) — 후보·피해 배율은 아래 두 값(Venus final-plan-review 1.2 L2·L6 기본값) */
  tailBonusSlots:[0,1,2],        // 기본기 · 2차 · 3차 (번개 꼬리 자신 제외)
  tailBonusDmg:0.6,              // 추가 공격은 피해만 60% (확률 효과는 원래대로)
  buffRemoveOrder:["shield","harden","absorb","evade","dmgUp","spdUp"],               // Q4 [설계 보완] 변덕 주문 제거 순서 — 스킬 고유 예약 효과(선턴·확정 치명·과부하·철벽·천년목·면역)는 대상 아님
  cleanseOrder:["burn","weaken","shock","crack","evadeDown","healCut","moss"],        // P2 [CJ 승인 Q1 2026-09-17 #241] 해제·옮기기 순서 — '속도 감소' 자리를 '회피율 감소'가 대신한다 · 영겁의 재 화상은 건너뜀
  cdUpFresh:true,                // Q3 [CJ 승인 2026-09-17 #241] ⌛ 증가(동결·자기장)가 ⌛0 스킬에 건 +1은 부여 라운드의 종료 감소에서 제외(5.6 Fresh 와 같은 방식)
  retaliateOncePerSkill:true,    // Q6 [설계 보완] 달궈진 껍질·열기 축적 — 상대 피해 스킬 적중(방어막에 막혀도)마다가 아니라 스킬 사용 1회당 1번. 페널티·반사·반격·지속·예고 발동은 제외
  endureAllDamage:true,          // Q7 [설계 보완 — Venus 대안] 천년목 — 일반·반사·지속·도망 실패 페널티에 적용 · 사신의 낫 즉사는 제외(REVISE 2차 CJ 결정 2026-09-17: 절대 판정) · 해일 예고는 켜진 동안 보류(#241 R2)
  capAppliesToDot:false,         // Q8 [설계 보완] 과부하 방벽·철벽 돌파 — 타격 1회 단위, 일반·반사·페널티 공격. 지속 피해·즉사 제외
  absorbFromGrantingHit:true,    // Q9 [확정] 흡수 — 확률(+💫) 당첨 시 그 공격부터 1R, HP 에 준 피해의 20% · 자기 대상이라 회피돼도 부여 유지
  onlySkillUseIsAction:true,     // P6 [CJ 승인 Q1 2026-09-17 #241] 환영 무도·수면 포자의 '다음 행동' = 다음 스킬 사용 1회(도망·아이템 제외). 번개 꼬리 추가 공격은 번개 꼬리 행동에 속한다
  evadeCap:0.40                  // #241 V1 [CJ 승인 Q2] 최종 회피율 = 기본 + 증가 − 감소를 0~40%로 자른다
};
/* GDD 4.4 · 2.2 동률 순서 🔥 → 💧 → ⚡ → 🗻 → 🌿 — 왕·동료 속성 기본값 판정에 쓴다 */
const V2_ELEM_ORDER=["fire","water","lightning","land","grass"];
/* 4.5 속성 효과 — 🔥 화상 · 💧 약화 · ⚡ 감전 · 🗻 균열은 대상, 🌿 흡수는 자신 */
const V2_ELEM_FX={fire:"burn",water:"weaken",lightning:"shock",land:"crack",grass:"absorb"};
/* 5.3 동료의 복수·왕의 분노 — 그 왕국의 현재 최고 달성 단계 값. #234 REVISE 3차 CJ 결정(2026-09-17 D4): 왕국을 (2) 단계까지
   달성하지 못했으면 (2) 값을 쓰지 않는다 — 효과 없이 위력만 남는다(종전 GDD 5.3 "(2)도 달성하지 못했다면 (2) 값" 대체).
   왕국 집계는 #235 전이라 항상 미달성 → null. 아래 표는 #235 가 "달성 단계 ≥ (2)"일 때 그 단계 값으로 쓸 데이터로 보존한다(연결점). */
const V2_KINGDOM_STAGE2={fire:{kind:"burn",mag:0.02,rounds:1},water:{kind:"weaken",mag:0.04,hits:1},lightning:{kind:"shock",rounds:1},
  land:{kind:"harden",mag:0.03,rounds:1},grass:{kind:"absorb",mag:0.10,rounds:1}};
function v2KingdomEffectOf(owner,el){ return null; } // #235 연결점: 달성 단계 ≥ (2)이면 그 단계 값(V2_KINGDOM_STAGE2 등), 미달성이면 null
/* 6.1 2차 아키타입 골격 — 감전만 예외(표준 50 · 지속 100 · 그 밖 30) */
const V2_SKELETON={
  std:{pct:140,p:0.70,shock:0.50,cd:2}, atk:{pct:170,p:0.50,shock:0.30,cd:3},
  def:{pct:120,p:0.40,shock:0.30,cd:2,harden:0.10}, swift:{pct:120,p:0.40,shock:0.30,cd:1},
  sustain:{pct:110,p:1.00,shock:1.00,cd:2}, guard:{pct:110,p:0.40,shock:0.30,cd:2,shield:0.12}
};
function v2Reg(id,o){ o.id=id; o.v2=true; if(o.pct){ o.pow=o.pct*SKILL_ATK_BASE/100; } if(!o.kind) o.kind=o.pct?"attack":"support";
  if(o.st) o.status=true; SKILLS[id]=o; return id; }
function v2Basic(id,ko){ return v2Reg(id,{ko,kind:"basic",pct:100,cd:0,desc:"기본기 · 💪🏻 100% / ⌛0"}); }
function v2Second(id,ko,arch,el){ const s=V2_SKELETON[arch], fx=V2_ELEM_FX[el], p=fx==="shock"?s.shock:s.p;
  const o={ko,pct:s.pct,cd:s.cd};
  if(fx==="absorb") o.selfAbsorb=p; else o.st={k:fx,p};
  if(s.harden) o.selfHarden={pct:s.harden,r:1};
  if(s.shield) o.selfShield=s.shield;
  const fxKo={burn:"화상",weaken:"약화",shock:"감전",crack:"균열",absorb:"자신에게 흡수"}[fx];
  o.desc=`💪🏻 ${s.pct}%${s.shield?` · 자기 방어막 최대 HP ${Math.round(s.shield*100)}%`:""} · ${fxKo} ${Math.round(p*100)}%${s.harden?` · 자기 경화 ${Math.round(s.harden*100)}%(1R)`:""} / ⌛${s.cd}`;
  return v2Reg(id,o); }
/* 6.3 일반 하수인 30종 — [종 id, 이름, 속성, 아키타입, 1차, 2차, 3차 {정의}, 4차 {정의}]. 3·4차 desc 는 GDD 6.3 문구 그대로. */
const V2_SPECIES_DEF=[
  ["M-F1","새끼 화룡","fire","std","불씨 할퀴기","불씨 브레스",
    {ko:"달군 비늘",cd:3,fx:"emberScale",desc:"자기 방어막 최대 HP 10% · 가하는 피해 +20%(1R) / ⌛3"},
    {ko:"성룡의 포효",cd:4,pct:100,fx:"dragonRoar",desc:"💪🏻 (100% + 현재 라운드 × 20%) · 화상 100% / ⌛4"}],
  ["M-F2","화염 투사","fire","atk","불꽃 주먹","화염 방사",
    {ko:"조준 사격",cd:2,pct:120,fx:"aimShot",desc:"💪🏻 120%, 대상이 화상이면 치명타 확정 / ⌛2"},
    {ko:"폭발 연소",cd:4,pct:120,fx:"burnBurst",desc:"대상 화상의 남은 피해 전부(남은 라운드 × 1회 피해) × 1.5를 즉시 주고 화상 해제, 화상이 없으면 💪🏻 120% / ⌛4"}],
  ["M-F3","용암 거북","fire","def","등껍질 박치기","용암 박치기",
    {ko:"달궈진 껍질",cd:3,fx:"heatShell",desc:"경화 20%(1R) · 그동안 자신을 공격한 상대에게 화상 100% / ⌛3"},
    {ko:"분화",cd:4,pct:80,fx:"eruption",desc:"💪🏻 80% + 이번 전투에서 방어력 · 경화로 줄인 피해 총량(최대 40)을 고정 피해로 추가 / ⌛4"}],
  ["M-F4","불티 정령","fire","swift","불티 튀기기","스치는 열기",
    {ko:"불꽃 표식",cd:2,pct:60,fx:"flameMark",desc:"💪🏻 60%, 대상이 화상이면 화상 피해 1회를 즉시 발생(지속은 줄지 않음) / ⌛2"},
    {ko:"꺼지지 않는 불티",cd:3,pct:130,fx:"undyingEmber",desc:"💪🏻 130% · 대상이 화상이면 지속 +1R(최대 3R) · 다음 라운드 선턴 효과 / ⌛3"}],
  ["M-F5","재의 주술사","fire","sustain","재 뿌리기","재의 저주",
    {ko:"잿불 심기",cd:2,fx:"emberPlant",desc:"대상이 화상이면 그 화상 수치를 8%로 갱신(큰 값) · 자기 최대 HP 5% 회복 / ⌛2"},
    {ko:"영겁의 재",cd:0,once:true,fx:"eternalAsh",desc:"대상에게 화상 100%(없으면 새로 부여) 후 지속 +2R, 이 화상은 해독제 · 스킬 어느 것으로도 해제되지 않음 / 전투당 1회"}],
  ["M-F6","화산 딱정벌레","fire","guard","딱지 들이받기","용암 껍질",
    {ko:"열기 축적",cd:3,fx:"heatStore",desc:"자기 방어막 최대 HP 15% · 대상에게 화상 70% / ⌛3"},
    {ko:"화산 폭발",cd:4,pct:100,fx:"volcano",desc:"자기 방어막을 전부 소모해 💪🏻 100% + 소모량 × 150% 고정 피해 · 화상 100% / ⌛4"}],
  ["M-W1","물방울 요정","water","std","물방울 톡","물방울 탄",
    {ko:"맑은 물",cd:3,fx:"clearWater",desc:"자기 상태이상 1개 해제 · 최대 HP 8% 회복 / ⌛3"},
    {ko:"거울 수면",cd:4,pct:80,fx:"mirrorSurface",desc:"💪🏻 80% · 자기 상태이상 1개를 해제해 대상에게 그대로 옮김(확률 판정 없이 · 수치와 남은 지속 유지) / ⌛4"}],
  ["M-W2","심해 사냥꾼","water","atk","작살 찌르기","심해 작살",
    {ko:"잠영",cd:3,fx:"dive",desc:"회피율 +20%(1R) · 다음 라운드 선턴 효과 / ⌛3"},
    {ko:"심연의 일격",cd:4,pct:150,fx:"abyssStrike",desc:"💪🏻 150%, 대상의 약화를 소모(해제)하면 💪🏻 250% / ⌛4"}],
  ["M-W3","빙벽 정령","water","def","서리 조각","빙결 강타",
    {ko:"동결",cd:3,pct:60,fx:"freeze",desc:"💪🏻 60% · 대상의 기본기 외 스킬 1개 ⌛ +1(자동 선정) / ⌛3"},
    {ko:"빙벽 반사",cd:4,fx:"iceReflect",desc:"2R 동안 받은 HP 피해의 30%를 공격자에게 되돌림 / ⌛4"}],
  ["M-W4","안개 무희","water","swift","물보라 발차기","물보라 스텝",
    {ko:"안개 걸음",cd:3,fx:"mistStep",desc:"회피율 +30%(1R) / ⌛3"},
    {ko:"환영 무도",cd:0,once:true,fx:"phantomDance",desc:"상대의 다음 행동 1회를 무효(피해 · 효과 0, 상대 ⌛는 정상 소모) / 전투당 1회"}],
  ["M-W5","파도 술사","water","sustain","물결 치기","파도의 저주",
    {ko:"밀물",cd:2,pct:60,fx:"floodTide",desc:"💪🏻 60% · 대상 약화 남은 횟수 +1(최대 4) / ⌛2"},
    {ko:"해일 예고",cd:0,once:true,fx:"tsunami",desc:"💪🏻 (120% + 대상 약화 남은 횟수 × 30%)의 예약 피해 X를 사용할 때 확정(회피 판정 포함)해 표식 — 대상의 HP + 방어막 ≤ X 가 되는 순간 사망(천년목 · 철벽 돌파 · 과부하 방벽이 켜진 동안은 보류) · 전투 끝까지 / 전투당 1회"}],
  ["M-W6","방패 게","water","guard","집게 찍기","거품 방패",
    {ko:"껍질 닫기",cd:3,fx:"shellClose",desc:"자기 방어막 최대 HP 18% / ⌛3"},
    {ko:"집게 반격",cd:4,fx:"clawCounter",desc:"2R 동안 자기 방어막이 막아낸 피해의 50%를 공격자에게 되돌림(반사) / ⌛4"}],
  ["M-L1","스파크","lightning","std","찌릿 박치기","스파크 샷",
    {ko:"충전",cd:3,pct:60,fx:"charge",desc:"💪🏻 60% · 감전 100% · 자기 가하는 피해 +10%(2R) / ⌛3"},
    {ko:"연쇄 번개",cd:4,pct:100,fx:"chainLightning",desc:"💪🏻 (100% + 이번 전투에서 감전을 건 횟수 × 30%, 최대 220%) / ⌛4"}],
  ["M-L2","뇌격수","lightning","atk","번개 주먹","뇌격 일섬",
    {ko:"번개 발도",cd:2,pct:160,req:"vanguardOnly",desc:"이번 라운드 선턴일 때만 사용, 💪🏻 160% / ⌛2"},
    {ko:"천둥 낙인",cd:4,pct:130,fx:"thunderBrand",desc:"대상이 이번 라운드 후턴이면 💪🏻 260%, 아니면 130% / ⌛4"}],
  ["M-L3","피뢰 골렘","lightning","def","피뢰 주먹","피뢰 강타",
    {ko:"접지",cd:3,fx:"grounding",desc:"자기 감전 해제 · 2R 동안 감전 면역 · 경화 15%(1R) / ⌛3"},
    {ko:"과부하 방벽",cd:0,once:true,fx:"overloadWall",desc:"2R 동안 한 번에 받는 피해가 최대 HP 15%를 넘지 않음 / 전투당 1회"}],
  ["M-L4","번개 여우","lightning","swift","번개 할퀴기","스파크 스침",
    {ko:"전광석화",cd:2,pct:70,fx:"flashStep",desc:"💪🏻 70% · 자기 다른 스킬 중 남은 ⌛가 가장 긴 1개 ⌛ −1 / ⌛2"},
    {ko:"번개 꼬리",cd:4,pct:100,fx:"lightningTail",desc:"💪🏻 100% 뒤 같은 턴에 추가 공격 1회 — 이번 턴만 2 · 3차 ⌛0, 스파크 스침 · 전광석화 · 기본기 중 선택, 피해 60%(도망 · 볼 · 아이템 · 패스 불가). 턴이 끝나면 2 · 3차 ⌛를 원래대로 되돌림 / ⌛4"}],
  ["M-L5","전자기 술사","lightning","sustain","자력 튕기기","전자기 저주",
    {ko:"자기장",cd:2,pct:50,fx:"magField",desc:"💪🏻 50% · 대상이 감전이면 대상의 기본기 외 스킬 1개 ⌛ +1(자동 선정) / ⌛2"},
    {ko:"영구 자기장",cd:0,once:true,fx:"permField",desc:"대상에게 감전 3R(확률 판정 없이) / 전투당 1회"}],
  ["M-L6","축전 해파리","lightning","guard","촉수 쏘기","전류막",
    {ko:"축전",cd:3,fx:"capacitor",desc:"자기 방어막 최대 HP 20% / ⌛3"},
    {ko:"방전",cd:4,pct:120,fx:"discharge",desc:"💪🏻 120% + 현재 자기 방어막의 50%를 고정 피해로 추가(방어막은 유지) · 감전 100% / ⌛4"}],
  ["M-E1","바위 두더지","land","std","흙 할퀴기","록 태클",
    {ko:"굴 파기",cd:3,fx:"burrow",desc:"이번 행동은 공격 없음 · 경화 40%(1R) / ⌛3"},
    {ko:"지하 매복",cd:4,pct:230,req:"afterBurrow",ignoreShield:true,desc:"굴 파기를 쓴 다음 라운드에만 사용, 💪🏻 230% · 방어막 무시 / ⌛4"}],
  ["M-E2","돌창 거인","land","atk","돌 주먹","돌창 투척",
    {ko:"창 박기",cd:2,pct:110,ignoreShield:true,desc:"💪🏻 110%, 방어막 무시 / ⌛2"},
    {ko:"대지 관통",cd:4,pct:180,ignoreDef:true,desc:"💪🏻 180%, 대상의 방어력 · 받는 피해 감소 효과(경화 · 방어형 시너지 등) 전부 무시 / ⌛4"}],
  ["M-E3","철갑 코뿔소","land","def","뿔 들이받기","철갑 돌진",
    {ko:"강철 가죽",cd:3,fx:"steelHide",desc:"경화 30%(1R) / ⌛3"},
    {ko:"철벽 돌파",cd:4,fx:"ironBreak",desc:"다음 라운드가 끝날 때까지 받는 피해 1회 무효 · 다음 피해 스킬 위력 +80%p / ⌛4"}],
  ["M-E4","모래 여우","land","swift","모래 할퀴기","모래 스침",
    {ko:"모래바람",cd:2,pct:60,fx:"sandWind",desc:"💪🏻 60% · 대상 회피율 −10%p(2R) · 자기 회피율 +10%(1R) / ⌛2"},
    {ko:"모래 폭풍",cd:4,fx:"sandStorm",desc:"2R 동안 대상의 상태이상 부여 확률 절반 · 대상 회피율 −20%p(2R) / ⌛4"}],
  ["M-E5","고대 골렘","land","sustain","돌덩이 내려치기","태고의 저주",
    {ko:"풍화",cd:2,fx:"weathering",desc:"대상 균열 지속 +1R(최대 3R) · 자기 경화 10%(1R) / ⌛2"},
    {ko:"태고의 각성",cd:0,once:true,req:"round4",fx:"ancientAwaken",desc:"4라운드부터 사용, 최대 HP 30% 회복 · 경화 20%(2R) / 전투당 1회"}],
  ["M-E6","황토 아르마딜로","land","guard","몸통 굴리기","황토 껍질",
    {ko:"웅크린 공",cd:3,fx:"curlBall",desc:"이번 행동은 공격 없음, 자기 방어막 최대 HP 25% / ⌛3"},
    {ko:"요새 전환",cd:4,fx:"fortress",desc:"현재 자기 방어막만큼 방어막 추가(최대 HP 20% 한도) · 자기 방어막 최대 HP 10% / ⌛4"}],
  ["M-G1","새싹 파수꾼","grass","std","새싹 치기","잎날 베기",
    {ko:"광합성",cd:3,fx:"photosynthesis",desc:"최대 HP 10% 회복, 이번 라운드 선턴이면 15% / ⌛3"},
    {ko:"성장 매듭",cd:4,pct:100,fx:"growthKnot",desc:"💪🏻 100% + 이번 전투 회복 총량의 50%(최대 40)를 고정 피해로 추가 / ⌛4"}],
  ["M-G2","가시 덩굴","grass","atk","가시 찌르기","가시 채찍",
    {ko:"뿌리 고정",cd:3,pct:100,fx:"rootBind",desc:"💪🏻 100% · 이 전투 동안 대상 도망 불가 · 2R 동안 대상 회복량 −50% / ⌛3"},
    {ko:"포식",cd:4,pct:160,fx:"devour",desc:"💪🏻 160%, 대상 HP 30% 이하면 💪🏻 260% · 이 공격으로 쓰러뜨리면 자기 최대 HP 20% 회복 / ⌛4"}],
  ["M-G3","고목 수호자","grass","def","가지 휘두르기","뿌리 강타",
    {ko:"나이테",cd:3,fx:"treeRing",desc:"2R 동안 라운드 종료 시 최대 HP 6% 회복 / ⌛3"},
    {ko:"천년목",cd:0,once:true,fx:"millennium",desc:"사용 후 2R 안에 HP를 0으로 만드는 첫 피해를 받으면 최대 HP 15%로 버팀(부활이 아니며 1회만 발동) / 전투당 1회"}],
  ["M-G4","포자 요정","grass","swift","포자 뿌리기","포자 스침",
    {ko:"수면 포자",cd:3,fx:"sleepSpore",desc:"대상의 다음 행동은 기본기만 가능 / ⌛3"},
    {ko:"번식 포자",cd:4,fx:"breedSpore",desc:"2R 동안 대상이 기본기가 아닌 스킬을 쓸 때마다 대상에게 최대 HP 5% 피해 · 같은 양 자기 회복 / ⌛4"}],
  ["M-G5","이끼 거인","grass","sustain","이끼 주먹","이끼 덮기",
    {ko:"이끼 흡혈",cd:3,pct:90,fx:"mossDrain",desc:"💪🏻 90% · 이 공격이 HP에 준 피해의 50% 회복 / ⌛3"},
    {ko:"이끼 잠식",cd:4,fx:"mossRot",desc:"3R 동안 라운드 종료 시 대상 최대 HP 4% 피해 · 같은 양 자기 회복(상태이상, 해독제로 해제) / ⌛4"}],
  ["M-G6","방패 버섯","grass","guard","갓 부딪기","버섯갓 방패",
    {ko:"포자 막",cd:3,fx:"sporeFilm",desc:"자기 방어막 최대 HP 15% · 자기 최대 HP 6% 회복 / ⌛3"},
    {ko:"균사 전환",cd:4,fx:"mycelium",desc:"현재 자기 방어막을 전부 HP 회복으로 전환(최대 HP 30% 한도) · 2R 동안 흡수 30% / ⌛4"}]
];
/* 종 id → 4스킬 id. 등급 N 은 앞에서 N개(3.4 · 6.1: ⭐1=1차, ⭐2=1~2차, ⭐3=1~3차, ⭐4=1~4차) */
const V2_SPECIES={};
for(const [sid,name,el,arch,s1,s2,s3,s4] of V2_SPECIES_DEF){
  V2_SPECIES[sid]=[v2Basic(sid+"-1",s1),v2Second(sid+"-2",s2,arch,el),v2Reg(sid+"-3",Object.assign({},s3)),v2Reg(sid+"-4",Object.assign({},s4))];
}
function speciesSkills(rosterId,grade){ const all=V2_SPECIES[rosterId]; if(!all) return null;
  const g=Math.max(1,Math.min(4,grade||1)); return all.slice(0,g); }
/* 6.4 전설 3종 — ⭐5 고정 · 스킬 4개 전부 · 속성 없음(스킬도 중립) · 아키타입 있음 (용=표준형 · 마녀=지속형 · 사신=공격형) */
const LEGEND_ROSTER=[
  {id:"L-DRAGON",key:"dragon",name:"용",emo:"🐉",arch:"std",skills:[
    v2Reg("L-DRAGON-1",{ko:"용 발톱",kind:"basic",pct:100,cd:0,neutral:true,desc:"기본기 · 💪🏻 100% / ⌛0"}),
    v2Reg("L-DRAGON-2",{ko:"비늘 세우기",cd:3,neutral:true,fx:"scaleUp",desc:"자기 방어막 최대 HP 15% · 경화 15%(1R) / ⌛3"}),
    v2Reg("L-DRAGON-3",{ko:"날개 강타",cd:2,pct:140,neutral:true,fx:"wingStrike",desc:"💪🏻 140% · 대상 회피율 −15%p(2R) / ⌛2"}),
    v2Reg("L-DRAGON-4",{ko:"드래곤 숨결",cd:3,pct:140,neutral:true,dragonMult:1.3,desc:"💪🏻 140% · 속성이 있는 상대에게 항상 ×1.3, 무속성 상대(전설)에게 ×1.0 / ⌛3"})]},
  {id:"L-WITCH",key:"witch",name:"마녀",emo:"🕯",arch:"sustain",skills:[
    v2Reg("L-WITCH-1",{ko:"저주 손짓",kind:"basic",pct:100,cd:0,neutral:true,desc:"기본기 · 💪🏻 100% / ⌛0"}),
    v2Reg("L-WITCH-2",{ko:"독약 병",cd:2,pct:110,neutral:true,fx:"poisonBottle",desc:"💪🏻 110% · 화상 50% · 약화 50% / ⌛2"}),
    v2Reg("L-WITCH-3",{ko:"변덕 주문",cd:3,neutral:true,fx:"whimSpell",desc:"대상 버프 1개 제거 · 자기 상태이상 1개 해제 / ⌛3"}),
    v2Reg("L-WITCH-4",{ko:"마녀의 장난",cd:3,pct:80,neutral:true,witch:true,fx:"witchPrank",desc:"💪🏻 80% · 화상 · 약화 · 감전 · 풀 회복(이번 공격이 HP에 준 피해의 100% 즉시 회복) 중 서로 다른 2개를 확률 판정 없이 적용 / ⌛3"})]},
  {id:"L-REAPER",key:"reaper",name:"사신",emo:"💀",arch:"atk",skills:[
    v2Reg("L-REAPER-1",{ko:"낫 베기",kind:"basic",pct:100,cd:0,neutral:true,desc:"기본기 · 💪🏻 100% / ⌛0"}),
    v2Reg("L-REAPER-2",{ko:"영혼 수확",cd:2,pct:130,neutral:true,fx:"soulHarvest",desc:"💪🏻 130% · 이 공격이 HP에 준 피해의 30% 회복 / ⌛2"}),
    v2Reg("L-REAPER-3",{ko:"죽음의 그림자",cd:3,neutral:true,fx:"deathShadow",desc:"회피율 +25%(1R) · 다음 피해 스킬 치명타 확정 / ⌛3"}),
    /* 봉인형 — ⌛와 별개인 사용 조건(reaperWhy). 실행은 execSlot 의 기존 사신의 낫 분기(sk.reaper)를 그대로 탄다 */
    v2Reg("L-REAPER-4",{ko:"사신의 낫",kind:"attack",cd:0,neutral:true,reaper:true,desc:"4라운드부터, 자기 차례에, 내 HP 비율이 상대보다 낮을 때만 — 어떤 방어·행동 차단 효과도 무시하고 즉사(회피 판정 없음) / 사용한 다음 전투는 봉인"})]}
];
/* 6.2 왕 · 동료 스킬 */
const V2_LEADER_EL_KO={
  king:{fire:"파이어 볼",water:"물방울 던지기",lightning:"스파크 볼트",land:"락 스매시",grass:"리프 커터"},
  assassin:{fire:"화염 단검",water:"급류 베기",lightning:"전격 찌르기",land:"암석 관통",grass:"맹독 가시"},
  shield:{fire:"인화 방패",water:"조류 방패",lightning:"절연 방패",land:"대지 방패",grass:"가시 방패"}
};
v2Basic("K-1","왕의 일격"); v2Basic("AS-1","단검 찌르기"); v2Basic("SH-1","방패 치기");
for(const el of V2_ELEM_ORDER){
  const fx=V2_ELEM_FX[el], fxKo={burn:"화상",weaken:"약화",shock:"감전",crack:"균열",absorb:"자신에게 흡수"}[fx];
  const mk=(id,ko,pct,cd,p,extra)=>{ const o=Object.assign({ko,pct,cd},extra||{}); if(fx==="absorb") o.selfAbsorb=p; else o.st={k:fx,p};
    o.desc=`💪🏻 ${pct}%${o.selfShield?` · 자기 방어막 최대 HP ${Math.round(o.selfShield*100)}%`:""} / ⌛${cd} · ${fxKo} ${Math.round(p*100)}%`; return v2Reg(id,o); };
  mk("K-2-"+el,V2_LEADER_EL_KO.king[el],180,3,fx==="shock"?0.50:0.70);
  mk("AS-2-"+el,V2_LEADER_EL_KO.assassin[el],200,3,0.30);
  mk("SH-2-"+el,V2_LEADER_EL_KO.shield[el],120,2,fx==="shock"?0.30:0.40,{selfShield:0.15});
}
v2Reg("LD-REVENGE",{ko:"🪄 동료의 복수",pct:220,cd:2,fx:"revenge",desc:"💪🏻 220% / ⌛2 · 사용자 속성 왕국의 효과를 확률 판정 없이 100% 부여 (수치 · 지속은 그 왕국의 현재 최고 달성 단계 · 왕국 (2) 미달성이면 효과 없이 위력만)"});
v2Reg("LD-WRATH",{ko:"🪄 왕의 분노",pct:280,cd:2,fx:"wrath",desc:"💪🏻 280% / ⌛2 · 동료의 복수와 같은 효과 · 지속(🧭)을 +1라운드 연장 · 왕국 (2) 미달성이면 효과 없이 위력만"});
/* 3.5·6.2: 왕 최대 4칸 · 동료 최대 3칸. 동료 1명 사망 → 살아 있는 남은 동료와 왕이 3번째 칸(동료의 복수), 2명 사망 → 왕 4번째 칸(왕의 분노) */
function leaderSkillIds(p,state){
  if(!p||(p.type!=="king"&&p.type!=="ally")) return null;
  const el=p.element||"fire";
  const game=state||S, dead=game&&game.pieces?game.pieces.filter(x=>x.owner===p.owner&&x.type==="ally"&&!x.alive).length:0;
  if(p.type==="king"){ const ids=["K-1","K-2-"+el]; if(dead>=1) ids.push("LD-REVENGE"); if(dead>=2) ids.push("LD-WRATH"); return ids; }
  const kind=p.allyKind==="shield"?"SH":"AS";
  const ids=[kind+"-1",kind+"-2-"+el]; if(dead>=1&&p.alive!==false) ids.push("LD-REVENGE"); return ids;
}
/* 슬롯을 늘리기만 한다 — 기존 칸의 남은 ⌛·공개 기록은 그대로 두고, 속성이 바뀐 2차만 새 id 로 바꾼다 */
function syncLeaderSkills(p,state){
  const ids=leaderSkillIds(p,state); if(!ids) return;
  const old=p.skills||[], cds=p.cds||[];
  p.skills=ids; p.cds=ids.map((id,i)=>(old[i]===id||(i===1&&old[i]))?(cds[i]||0):0);
  if(!p.revealedSkills) p.revealedSkills=[];
  p.revealedSkills=p.revealedSkills.filter(i=>i<ids.length&&old[i]===ids[i]);
}
function syncOwnerLeaders(owner,state){ const game=state||S; if(!game||!game.pieces) return; for(const x of game.pieces) if(x.owner===owner&&(x.type==="king"||x.type==="ally")) syncLeaderSkills(x,game); }
/* 2.2 왕·동료 속성 미선택 규칙 — 필드 하수인에 가장 많은 속성, 동률이면 🔥 → 💧 → ⚡ → 🗻 → 🌿. 선택 UI 는 #236/#238 */
function leaderDefaultElement(owner,state){
  const game=state||S;
  const cnt={}; for(const el of V2_ELEM_ORDER) cnt[el]=0;
  for(const x of game.pieces) if(x.owner===owner&&x.type==="minion"&&x.element&&cnt[x.element]!==undefined) cnt[x.element]++;
  let best=V2_ELEM_ORDER[0]; for(const el of V2_ELEM_ORDER) if(cnt[el]>cnt[best]) best=el;
  return best;
}
function assignLeaderElements(owner,state){
  const game=state||S, el=leaderDefaultElement(owner,game);
  for(const x of game.pieces) if(x.owner===owner&&(x.type==="king"||x.type==="ally")&&!x.leaderElChosen){ x.element=el; }
  syncOwnerLeaders(owner,game);
}
/* 일반 하수인 · 전설 주입 (3.3 · 3.4 · 3.6) — applyRoster·포획·검사가 같은 한 함수를 쓴다 */
function applySpecies(m,rd,grade){
  const g=Math.max(1,Math.min(4,grade||1));
  m.rosterId=rd.id; m.name=rd.name; m.element=rd.element; m.legend=null;
  m.hp=gradeHp(rd.hp,g); m.maxHp=m.hp; m.atk=gradeAtk(rd.atk,g); m.skillAtk=rd.skill; m.cdMax=rd.cd;
  applyArchStats(m,rd.arch,g);
  m.skills=speciesSkills(rd.id,g); m.cds=m.skills.map(()=>0); m.revealedSkills=[];
  return m;
}
function applyLegend(m,key){
  const L=LEGEND_ROSTER.find(x=>x.key===key||x.id===key); if(!L) return null; const b=LEGEND_BASE[L.key];
  m.rosterId=null; m.legend=L.key; m.name=L.name; m.element=null;
  m.hp=b.hp; m.maxHp=b.hp; m.atk=b.atk;
  applyFixedStats(m,b,5); // 3.6 · 4.4 [설계 보완] 전설은 ⭐5 로 등급 비교에 참여
  m.skills=L.skills.slice(); m.cds=m.skills.map(()=>0); m.revealedSkills=[];
  return m;
}
function legendArchOf(f){ const L=f&&f.legend?LEGEND_ROSTER.find(x=>x.key===f.legend):null; return L?L.arch:null; }

/* ===== 전투 상태 — 전투가 끝나면 전부 해제 (5.6: 전투를 넘어 유지되는 것은 HP 뿐) ===== */
/* #241 스킬 정리(CJ 승인 2026-09-17): 속도 감소(spdDownR) → 회피율 감소(evadeDownR) · 거울 수면 되돌림(mirrorR) · 굴 파기 전용(burrowR) ·
   요새 전환 소모 분기(fortressR) · 집게 반격 라운드당 1회(counterRound) 제거. counterR 는 이름만 남기고 '방어막이 막은 피해 50% 반사'로 쓴다 */
const V2_TIMED=["absorbR","spdBuffR","evadeDownR","healCutR","vanguardTurn","retaliateBurnR","reflectR","counterR","overloadR",
  "nullHitR","sandStormR","ringR","enduredR","breedR","immuneShockR","mossR"];
const V2_TIMED_MAG={absorbR:["absorbPct"],spdBuffR:["spdBuff"],evadeDownR:["evadeDown"],healCutR:["healCut"],nullHitR:["nullHitN"],
  mossR:["mossPct","mossBy"],breedR:["breedBy"]};
function resetV2(f){
  for(const k of V2_TIMED){ f[k]=0; f[k+"Fresh"]=false; }
  f.absorbPct=0; f.spdBuff=0; f.evadeDown=0; f.healCut=0; f.nullHitN=0; f.mossPct=0; f.mossBy=null; f.breedBy=null;
  f.burnMag=0; f.burnNoCure=false; f.weakenMag=0;
  f.nextPowUp=0;
  f.fleeLock=false; f.sleepNext=false; f.nullifyNext=false;
  f.burrowRound=0; f.enduredUsed=false; f.shocksDealt=0; f.mitigated=0; f.healTotal=0; f.onceUsed={};
  f.tideMark=0; f.tideBy=null; f.tideHeld=false; // #241 R2 해일 예고 표식 — 전투 끝까지 · 전투가 끝나면 소멸(T16)
  f.cdUpFresh=[]; // #241 Q3 ⌛ 증가 Fresh — 이번 라운드에 ⌛0 에서 +1 된 슬롯
  if(f.skills) f.cds=f.skills.map(()=>0);
}
function effSpd(f){ return (f.spd||0)+(f.spdBuff||0); } // 4.4 1라운드 순서 판정용 유효 속도 (#241 V1: 속도 감소 폐지)
/* #241 V1 [CJ 승인 Q2] 최종 회피율 = 기본 + 회피 증가 − 회피율 감소 → 0~40% (한 식으로 자른다 · Venus 5.2.3) */
function effEvade(f){ return Math.max(0,Math.min(V2_INTERP.evadeCap,(f.dodge||0)+(f.evadeBuff||0)-(f.evadeDownR>0?(f.evadeDown||0):0))); }
function v2IsStatus(k){ return k==="burn"||k==="weaken"||k==="shock"||k==="crack"||k==="evadeDown"||k==="healCut"||k==="moss"; }
/* 회복 — 회복 감소 적용 후 한 번 반올림, 최대 HP 상한, 실제로 오른 양만 "회복 총량"에 더한다(4.6) */
function v2Heal(side,f,amount,label){
  let a=amount*(f.healCutR>0?(1-(f.healCut||0)):1); a=Math.round(a); if(a<0) a=0;
  const gain=Math.min(a,Math.max(0,f.maxHp-f.hp)); f.hp+=gain; f.healTotal=(f.healTotal||0)+gain;
  if(S.battle) bmsg(`💚 ${fighterName(side)}${label?` ${label}`:""} — HP ${gain} 회복!`,{float:{side,html:`<span class="pos">+${gain}</span>`},hp:{side,val:f.hp,max:f.maxHp}});
  return gain;
}
/* 천년목(4차) — HP 를 0 으로 만드는 첫 피해를 최대 HP 15% 로 버틴다. 반환: 실제로 깎을 HP */
function v2Endure(f,actual){
  if(!(f.enduredR>0)||f.enduredUsed||actual<f.hp) return actual;
  f.enduredUsed=true; const keep=Math.max(1,Math.min(f.hp,Math.round(f.maxHp*0.15)));
  if(S.battle) bmsg(`🌳 천년목 — 쓰러지지 않고 버텼다! (HP ${keep})`);
  return f.hp-keep;
}
/* 과부하 방벽 · 철벽 돌파 — 일반·예고·반사·반격 피해 1회에 적용(V2_INTERP.capAppliesToDot=false 면 지속 피해 제외) */
function v2IncomingCap(f,dmg){
  if(f.nullHitR>0&&f.nullHitN>0&&dmg>0){ f.nullHitN=0; if(S.battle) bmsg(`🛡 철벽 — 피해 1회 무효!`); return 0; }
  if(f.overloadR>0){ const cap=Math.round(f.maxHp*0.15); if(dmg>cap){ if(S.battle) bmsg(`⚡ 과부하 방벽 — 피해 ${dmg} → ${cap}`); return cap; } }
  return dmg;
}
/* 상태이상 · 버프 부여 — 확률 = 표기 + 💫(상한 100%) · 모래 폭풍이면 절반. force 는 판정·난수 없음(확정 효과 · 확률 100% 효과).
   접지(감전 면역)는 감전만 막는다. (#241: 거울 수면 되돌림 분기는 '옮기기' 교체로 삭제) */
function v2Apply(cSide,caster,tSide,target,kind,prob,o){
  o=o||{};
  if(!o.force){ let p=Math.min(1,(prob||0)+(caster.statusPct||0)); if(caster.sandStormR>0) p*=0.5;
    if(!(rand()<p)){ S.metrics.statusFailed++; bmsg("상태이상 부여 실패!"); return false; } }
  if(kind==="shock"&&target.immuneShockR>0){ bmsg(`⚡ ${fighterName(tSide)}는 감전 면역이다.`); return false; }
  S.metrics.statusApplied++;
  if(kind==="burn"){ const had=target.burn>0; if(!had){ target.burnNoCure=false; }
    applyTimedFx(target,"burn",o.rounds||BAL.burnRounds,"burnMag",o.mag||BAL.burnPct); target.burnBy=cSide;
    bmsg(`🔥 ${fighterName(tSide)}는 화상을 입었다!${had?" (갱신)":""} (${target.burn}R)`,{st:stFx(tSide,target)}); }
  else if(kind==="weaken"){ const had=target.weaken>0; target.weaken=Math.max(target.weaken||0,o.hits||BAL.weakenHits);
    target.weakenMag=Math.max(had?(target.weakenMag||0):0,o.mag||BAL.weakenPct);
    bmsg(`💧 ${fighterName(tSide)}는 약화되었다!${had?" (갱신)":""} (${target.weaken}회)`,{st:stFx(tSide,target)}); }
  else if(kind==="shock"){ applyTimedFx(target,"shock",o.rounds||1); if(target!==caster) caster.shocksDealt=(caster.shocksDealt||0)+1;
    bmsg(`⚡ ${fighterName(tSide)}는 감전 — 다음 ${target.shock}라운드 후턴!`,{st:stFx(tSide,target)}); }
  else if(kind==="crack"){ applyCrack(target,o.rounds||2); bmsg(`🗻 ${fighterName(tSide)}에게 균열! (${target.crack}R)`,{st:stFx(tSide,target)}); }
  else if(kind==="absorb"){ applyTimedFx(target,"absorbR",o.rounds||1,"absorbPct",o.mag||0.20); bmsg(`🌿 ${fighterName(tSide)} 흡수 ${pct(target.absorbPct)} (${target.absorbR}R)`,{st:stFx(tSide,target)}); }
  else if(kind==="harden"){ applyHarden(target,o.mag,o.rounds||1); bmsg(`🛡 ${fighterName(tSide)} 경화 ${pct(target.hardenPct)} (${target.harden}R)`,{st:stFx(tSide,target)}); }
  else if(kind==="evadeDown"){ applyTimedFx(target,"evadeDownR",o.rounds||2,"evadeDown",o.mag||0); bmsg(`💨 ${fighterName(tSide)} 회피율 −${Math.round(target.evadeDown*100)}%p (${target.evadeDownR}R)`,{st:stFx(tSide,target)}); }
  else if(kind==="healCut"){ applyTimedFx(target,"healCutR",o.rounds||2,"healCut",o.mag||0.5); bmsg(`🥀 ${fighterName(tSide)} 회복량 −${pct(target.healCut)} (${target.healCutR}R)`,{st:stFx(tSide,target)}); }
  else if(kind==="moss"){ const had=target.mossR>0; applyTimedFx(target,"mossR",o.rounds||3,"mossPct",o.mag||0.04); target.mossBy=cSide;
    bmsg(`🍄 ${fighterName(tSide)}에게 이끼 잠식!${had?" (갱신)":""} (${target.mossR}R)`,{st:stFx(tSide,target)}); }
  return true;
}
/* 자기 상태이상 1개 — 해제 순서표(P2)에서 처음 걸린 것. #241 단순화 8(영겁의 재): 이 화상은 어떤 해제로도 풀리지 않으므로 건너뛴다(N1).
   반환: 거울 수면이 그대로 옮길 수 있게 종류 · 수치 · 남은 지속을 읽어 둔 사본 (없으면 null) */
function v2PeekStatus(f){
  for(const k of V2_INTERP.cleanseOrder){
    if(k==="burn"&&f.burn>0&&!f.burnNoCure) return {k,rounds:f.burn,mag:f.burnMag||BAL.burnPct};
    if(k==="weaken"&&f.weaken>0) return {k,hits:f.weaken,mag:f.weakenMag||BAL.weakenPct};
    if(k==="shock"&&f.shock>0) return {k,rounds:f.shock};
    if(k==="crack"&&f.crack>0) return {k,rounds:f.crack};
    if(k==="evadeDown"&&f.evadeDownR>0) return {k,rounds:f.evadeDownR,mag:f.evadeDown||0};
    if(k==="healCut"&&f.healCutR>0) return {k,rounds:f.healCutR,mag:f.healCut||0};
    if(k==="moss"&&f.mossR>0) return {k,rounds:f.mossR,mag:f.mossPct||0.04};
  }
  return null;
}
function v2ClearStatus(f,k){
  if(k==="burn"){ f.burn=0; f.burnFresh=false; f.burnBy=null; f.burnMag=0; f.burnNoCure=false; }
  else if(k==="weaken"){ f.weaken=0; f.weakenMag=0; }
  else if(k==="shock"){ f.shock=0; f.shockFresh=false; }
  else if(k==="crack"){ f.crack=0; f.crackFresh=false; }
  else if(k==="evadeDown"){ f.evadeDownR=0; f.evadeDownRFresh=false; f.evadeDown=0; }
  else if(k==="healCut"){ f.healCutR=0; f.healCutRFresh=false; f.healCut=0; }
  else if(k==="moss"){ f.mossR=0; f.mossRFresh=false; f.mossPct=0; f.mossBy=null; }
}
/* 자기 상태이상 1개 해제 (맑은 물 · 변덕 주문) — V2_INTERP.cleanseOrder */
function v2CleanseOne(side,f){
  const st=v2PeekStatus(f);
  if(!st){ bmsg(`✨ 해제할 상태이상이 없다.`); return null; }
  v2ClearStatus(f,st.k);
  bmsg(`✨ ${fighterName(side)}의 상태이상 1개가 해제되었다.`,{st:stFx(side,f)}); return st.k;
}
/* 대상 버프 1개 제거 (변덕 주문) — 방어막은 모든 층을 한꺼번에 지우며 '방어막 1개'(3.2, 깨짐 아님) */
function v2RemoveBuff(side,f){
  for(const k of V2_INTERP.buffRemoveOrder){
    if(k==="shield"&&((f.shieldLayers&&f.shieldLayers.length)||f.shield>0)){ shieldClearAll(f); }
    else if(k==="harden"&&f.harden>0){ f.harden=0; f.hardenFresh=false; f.hardenPct=0; }
    else if(k==="absorb"&&f.absorbR>0){ f.absorbR=0; f.absorbRFresh=false; f.absorbPct=0; }
    else if(k==="evade"&&f.evadeBuffR>0){ f.evadeBuffR=0; f.evadeBuffRFresh=false; f.evadeBuff=0; }
    else if(k==="dmgUp"&&f.dmgUpBuffR>0){ f.dmgUpBuffR=0; f.dmgUpBuffRFresh=false; f.dmgUpBuff=0; }
    else if(k==="spdUp"&&f.spdBuffR>0){ f.spdBuffR=0; f.spdBuffRFresh=false; f.spdBuff=0; }
    else continue;
    bmsg(`🕯 ${fighterName(side)}의 버프 1개가 사라졌다.`,{st:stFx(side,f)}); return k;
  }
  bmsg(`🕯 제거할 버프가 없다.`); return null;
}
/* ⌛ 증가 효과(동결 · 자기장) — 기본기를 뺀 스킬 중 남은 ⌛가 가장 짧은 것, 같으면 슬롯 순서(4.6). 기본기는 대상이 아니다(6.1).
   #234 REVISE 3차 CJ 결정(2026-09-17 P13): 사신의 낫은 어떤 스킬로도 막을 수 없다 — ⌛ 증가 대상에서도 제외한다 */
function v2CdUpTarget(f){
  let pick=-1;
  if(!f.skills) return -1;
  for(let i=0;i<f.skills.length;i++){ const sk=SKILLS[f.skills[i]]; if(!sk||sk.kind==="basic"||sk.reaper) continue;
    if(pick<0||f.cds[i]<f.cds[pick]) pick=i; }
  return pick;
}
/* 지속 피해(4.3) — 계산값을 ⑩ 반올림만 하고 방어막을 무시해 HP 로 직행. 회피·방어력·균열·치명·시너지 없음 */
function v2Dot(side,f,raw,label,bySide){
  let d=Math.round(raw); if(raw>0&&d<1) d=1;
  if(V2_INTERP.capAppliesToDot) d=v2IncomingCap(f,d);
  let actual=Math.min(d,f.hp); actual=v2Endure(f,actual); f.hp-=actual;
  if(bySide) addRec(bySide,actual);
  bmsg(`${label} ${fighterName(side)}에게 ${actual} 피해!`,{shake:side,float:{side,html:`<span class="neg">-${actual}</span>`},hp:{side,val:f.hp,max:f.maxHp},st:stFx(side,f)});
  return actual;
}
/* 적중 뒤 반응 — 반사(4.3, 한 행동 1회 · 연쇄 금지) · 달궈진 껍질(Q6).
   #241 단순화: 열기 축적 반격 화상 삭제(사용 시 화상 부여로) · 집게 반격은 '방어막이 막아낸 피해의 50% 반사'로 반사 한 종류에 통합.
   축전·포자 막의 '층별 막아낸 피해' 적립(v2ShieldSrcGain)도 삭제 — shieldConsume 의 bySrc 반환은 #233 엔진 계약으로 그대로 둔다 */
function v2AfterHit(side,f,opp,oSide,res,ctx){
  const B=S.battle; if(!B||res.evaded) return;
  const once=!ctx||!ctx.retaliated; // Q6: 스킬 사용 1회당 1번 (여러 타격 포함 · 번개 꼬리 추가 공격은 새 사용 — L16)
  if(once&&opp.retaliateBurnR>0&&ctx) ctx.retaliated=true;
  if(once&&opp.retaliateBurnR>0) v2Apply(oSide,opp,side,f,"burn",1);
  if(!S.battle) return;
  if(opp.reflectR>0&&res.actual>0&&B.reflectSeq!==B.actSeq){ B.reflectSeq=B.actSeq; resolveReflect(oSide,opp,f,side,res.actual,0.30); }
  if(opp.counterR>0&&res.absorbed>0&&B.reflectSeq!==B.actSeq){ B.reflectSeq=B.actSeq; resolveReflect(oSide,opp,f,side,res.absorbed,0.50); }
}
/* 사용 조건 (slotUsable 이 본다) */
function v2ReqOk(f,sk,side){
  const B=S.battle;
  if(sk.once&&f.onceUsed&&f.onceUsed[sk.id]) return false;
  if(sk.req==="vanguardOnly") return !!B&&B.firstSide===side;
  if(sk.req==="afterBurrow") return !!B&&f.burrowRound>0&&B.round===f.burrowRound+1;
  if(sk.req==="round4") return !!B&&B.round>=4;
  return true;
}
/* ===== 스킬 실행기 — execSlot 이 v2 스킬을 여기로 넘긴다 ===== */
function execV2(side,slot,sk){
  const B=S.battle, f=side==="A"?B.fa:B.fd, opp=side==="A"?B.fd:B.fa, oSide=side==="A"?"D":"A";
  f.cds[slot]=sk.cd||0;
  if(f.revealedSkills&&!f.revealedSkills.includes(slot)) f.revealedSkills.push(slot);
  if(sk.once){ f.onceUsed=f.onceUsed||{}; f.onceUsed[sk.id]=true; }
  const supFlash=!sk.pct?"buff":null;
  bmsg(`${fighterName(side)}의 ${sk.ko}!`,supFlash?{flash:supFlash}:null,{key:"skillFx"});
  const dmgSkill=!!sk.pct;
  if(v2PreUse(side,f,sk)) return;
  /* #241 R1 번개 꼬리 추가 공격 — 이 사용이 추가 공격이면 피해만 60%(L6 · 확률 효과는 원래대로) */
  const bonus=!!(B.bonus&&B.bonus.stage==="active"&&B.bonus.side===side);
  const ctx={side,f,opp,oSide,sk,slot,hits:[],retaliated:false,dmgScale:bonus?V2_INTERP.tailBonusDmg:1};
  ctx.hit=(pct,o)=>v2Hit(ctx,pct,o||{});
  ctx.st=(kind,p,o)=>v2Apply(side,f,oSide,opp,kind,p,o||{});
  const run=V2_FX[sk.fx]||v2Default;
  run(ctx);
  if(!S.battle) return;
  /* 흡수(4.5) — 이번 스킬의 적중이 HP 에 준 피해 기준, 당첨된 그 공격부터(Q9) */
  if(f.absorbR>0){ const got=ctx.hits.reduce((s,r)=>s+(r.evaded?0:r.actual),0); if(got>0) v2Heal(side,f,got*(f.absorbPct||0),"흡수"); }
  finishV2(side);
}
/* 스킬 사용 전처리(Q10) — 수면 포자 소모 · 환영 무도 무효 · 번식 포자 피해. execV2 가 부른다.
   사신의 낫은 부르지 않는다(REVISE 2차 CJ 결정 2026-09-17: 행동 차단 무시 · 즉사가 반드시 성립해 전투가 끝나므로 남은 상태는 전투 종료 초기화로 정리). 반환 true = 이 행동은 여기서 끝났다 */
function v2PreUse(side,f,sk){
  const B=S.battle;
  if(f.sleepNext) f.sleepNext=false; // 수면 포자 — 다음 스킬 사용 1회에 소모(Q10)
  if(f.nullifyNext){ f.nullifyNext=false; bmsg(`🌫 환영 무도 — ${fighterName(side)}의 행동이 무효가 되었다!`,{st:stFx(side,f)}); finishV2(side); return true; }
  if(sk.kind!=="basic"&&f.breedR>0){ // 번식 포자 — 지속 피해(최대 HP 5%) · 같은 양 시전자 회복
    const d=v2Dot(side,f,f.maxHp*0.05,"🍄 번식 포자 —",f.breedBy);
    const bySide=f.breedBy, by=bySide==="A"?B.fa:B.fd; if(by&&d>0) v2Heal(bySide,by,d,"번식 포자");
    if(checkDeath()) return true; }
  return false;
}
/* 스킬 사용 1회 마무리 — 사망 → 해일 예고 검사 → (번개 꼬리) 추가 공격 단계 → 차례 전환 */
function finishV2(side){ if(!S.battle) return; if(checkDeath()) return; if(v2TideCheck()) return;
  const B=S.battle;
  /* #241 R1 [CJ 설계] 번개 꼬리: 턴이 넘어가지 않고 같은 전투원이 한 번 더 고른다(방식 A). nextPhase 를 부르지 않고 actSeq 만 올려
     이전 렌더의 콜백을 무효로 만든 뒤 같은 행동자의 메뉴를 다시 그린다 — 추가 공격은 두 번째 행동(L15)이다 */
  if(B.bonus&&B.bonus.side===side&&B.bonus.stage==="pending"){ B.bonus.stage="active"; B.actSeq=(B.actSeq||0)+1; B.pkgSel=null; B.menu=null; battleModal(); return; } // #245 Saturn REVISE 3차: 여기도 행동 토큰이 올라가는 지점이다 — nextPhase 와 같이 열려 있던 개봉 표를 회수한다
  nextPhase(); }
/* 번개 꼬리 추가 공격 끝(= 번개 여우의 턴 끝, L8) — 2·3차 ⌛를 사본으로 되돌린다(추가 공격에 쓴 스킬 ⌛ · 쿨타임 디버프 포함 L7·L10·L11) */
function v2BonusEnd(B){
  const bn=B.bonus; B.bonus=null; if(!bn||bn.stage!=="active") return;
  const f=bn.side==="A"?B.fa:B.fd;
  for(const k of Object.keys(bn.saved)) f.cds[+k]=bn.saved[k];
  bmsg(`⚡ 추가 공격 끝 — 2 · 3차 ⌛ 복원`,{st:stFx(bn.side,f)});
}
function v2Hit(ctx,pct,o){
  const {side,f,opp,oSide,sk}=ctx, B=S.battle;
  /* '다음 피해 스킬' 1회성 효과는 스킬 적중 경로에서만 소모한다.
     #234 REVISE 3차 CJ 결정(2026-09-17 P14): 회피돼도 모두 소모한다 — resolveHit 전에 꺼내 쓰므로 회피 여부와 무관하다(확정 치명 포함).
     #241: 달군 비늘(가하는 피해 버프 1R)·축전(방어막)·모래바람(회피율 감소)·충전(즉시 감전) 단순화로 남은 1회성은 철벽 돌파 위력 + 확정 치명뿐 */
  let p=pct; if(f.nextPowUp){ p+=f.nextPowUp*100; f.nextPowUp=0; }
  const scale=(o.scale||1)*(ctx.dmgScale||1); // #241 번개 꼬리 추가 공격 60% — 위력과 고정 피해 모두(피해만)
  const flat=(o.flat||0);
  /* 확정 치명 — 죽음의 그림자(f.critForce, 1회성 · 위와 같이 회피돼도 소모) 와 조준 사격(o.critForce, I1: 이 타격 한정 · 플래그를 켜지 않아 다음으로 넘어가지 않음) */
  let critNow=!!o.critForce; if(f.critForce){ critNow=true; f.critForce=false; }
  const res=resolveHit(side,f,opp,oSide,f.atk*p/100*scale,flat*scale,sk.neutral?null:f.element,sk.dragonMult||null,0,
    {ignoreShield:!!(o.ignoreShield||sk.ignoreShield),ignoreDef:!!(o.ignoreDef||sk.ignoreDef),critForce:critNow});
  ctx.hits.push(res);
  if(S.battle===B) v2AfterHit(side,f,opp,oSide,res,ctx);
  return res;
}
/* 기본 동작 — 피해(있으면) → 대상 효과(회피면 없음) → 자기 효과(회피와 무관) */
function v2Default(ctx,o){
  o=o||{}; const {sk,f,side}=ctx; let res=null;
  if(sk.pct){ res=ctx.hit(o.pct||sk.pct,o); if(!S.battle) return res;
    if(!res.evaded&&sk.st&&S.battle) ctx.st(sk.st.k,sk.st.p*(o.effScale||1)); }
  v2Self(ctx,o);
  return res;
}
function v2Self(ctx,o){
  const {sk,f,side}=ctx; if(!S.battle) return;
  if(sk.selfShield){ shieldAdd(f,Math.round(f.maxHp*sk.selfShield),sk.id); bmsg(`🫧 방어막 ${f.shield}!`,{st:stFx(side,f)}); }
  if(sk.selfHarden) v2Apply(side,f,side,f,"harden",1,{force:true,mag:sk.selfHarden.pct,rounds:sk.selfHarden.r});
  if(sk.selfAbsorb) v2Apply(side,f,side,f,"absorb",sk.selfAbsorb*((o&&o.effScale)||1),{rounds:1,mag:0.20});
}
const V2_FX={
  /* 🔥 불 */
  /* #241 단순화 9: 다음 피해 스킬 +20%(1회성 필드) → 가하는 피해 +20%(1R) 버프 */
  emberScale(c){ shieldAdd(c.f,Math.round(c.f.maxHp*0.10),c.sk.id); applyDmgUpBuff(c.f,0.20,1); bmsg(`🫧 방어막 ${c.f.shield} · 가하는 피해 +20% (1R)`,{st:stFx(c.side,c.f)}); },
  dragonRoar(c){ const r=c.hit(100+S.battle.round*20,{}); if(S.battle&&!r.evaded) c.st("burn",1); },
  aimShot(c){ c.hit(120,{critForce:c.opp.burn>0}); },
  burnBurst(c){ const o=c.opp;
    if(o.burn>0){ const tick=o.maxHp*(o.burnMag||BAL.burnPct), left=o.burn;
      o.burn=0; o.burnFresh=false; o.burnMag=0; o.burnNoCure=false; const by=o.burnBy; o.burnBy=null;
      // 4.3 지속 피해 계열 — 회피·방어력·방어막 없이 ⑩ 반올림 한 번 (남은 라운드 × 1회 피해 × 1.5)
      c.hits.push({evaded:false,actual:v2Dot(c.oSide,o,tick*left*1.5,"💥 폭발 연소 —",c.side)}); }
    else c.hit(120,{}); },
  heatShell(c){ v2Apply(c.side,c.f,c.side,c.f,"harden",1,{force:true,mag:0.20,rounds:1}); applyTimedFx(c.f,"retaliateBurnR",1); },
  eruption(c){ c.hit(80,{flat:Math.min(40,c.f.mitigated||0)}); },
  flameMark(c){ const r=c.hit(60,{}); if(S.battle&&!r.evaded&&c.opp.burn>0){ const o=c.opp;
      v2Dot(c.oSide,o,o.maxHp*(o.burnMag||BAL.burnPct),"🔥 불꽃 표식 —",c.side); } },
  undyingEmber(c){ const r=c.hit(130,{}); if(S.battle&&!r.evaded&&c.opp.burn>0){ c.opp.burn=Math.min(3,c.opp.burn+1); bmsg(`🔥 화상 지속 +1R (${c.opp.burn}R)`,{st:stFx(c.oSide,c.opp)}); }
    if(S.battle){ applyTimedFx(c.f,"vanguardTurn",1); bmsg(`🏃 ${fighterName(c.side)} — 다음 라운드 선턴`,{st:stFx(c.side,c.f)}); } },
  /* #241 단순화 10: 화상 피해율 +3%p 보너스(전용 필드 burnBonus) → 그 화상 수치를 8%로 갱신(큰 값, 5.6) */
  emberPlant(c){ if(c.opp.burn>0){ c.opp.burnMag=Math.max(c.opp.burnMag||BAL.burnPct,0.08); bmsg(`🔥 화상 수치 ${Math.round(c.opp.burnMag*100)}%`,{st:stFx(c.oSide,c.opp)}); }
    v2Heal(c.side,c.f,c.f.maxHp*0.05,"잿불 심기"); },
  eternalAsh(c){ if(c.st("burn",1)){ c.opp.burn+=2; c.opp.burnNoCure=true; bmsg(`🔥 영겁의 재 — 화상 지속 +2R (${c.opp.burn}R) · 어떤 해제로도 풀리지 않음`,{st:stFx(c.oSide,c.opp)}); } },
  /* #241 단순화 7: '방어막이 남은 동안 공격자에게 화상'(층 출처 추적) → 사용 시 대상에게 화상 70% (공격이 아니므로 회피 판정 없음) */
  heatStore(c){ shieldAdd(c.f,Math.round(c.f.maxHp*0.15),c.sk.id); bmsg(`🫧 열기 축적 방어막 ${c.f.shield}`,{st:stFx(c.side,c.f)}); if(S.battle) c.st("burn",0.70); },
  volcano(c){ const used=c.f.shield||0; c.f.shieldLayers=[]; c.f.shield=0; // 소모는 깨짐이 아니다(3.2)
    bmsg(`🌋 방어막 ${used} 소모!`,{st:stFx(c.side,c.f)});
    const r=c.hit(100,{flat:used*1.5}); if(S.battle&&!r.evaded) c.st("burn",1); },
  /* 💧 물 */
  clearWater(c){ v2CleanseOne(c.side,c.f); v2Heal(c.side,c.f,c.f.maxHp*0.08,"맑은 물"); },
  /* #241 R3 [CJ 결정] 거울 수면 — 자기 상태이상 1개를 해제해 대상에게 그대로 옮긴다(Venus 3.1 기본값 5개):
     순서 = 자기 해제 → 💪🏻 80% → 적중 시 확정 부여 · 회피면 해제만 · 수치와 남은 지속 숫자 그대로(대상에게는 새 부여 — 5.6 Fresh) ·
     부여자 = 거울 사용자 · 영겁의 재 화상은 건너뜀(N1) · 대상이 면역이면 해제만(v2Apply 가 거부) */
  mirrorSurface(c){ const st=v2PeekStatus(c.f);
    if(st){ v2ClearStatus(c.f,st.k); bmsg(`🪞 거울 수면 — ${fighterName(c.side)}의 상태이상을 걷어냈다`,{st:stFx(c.side,c.f)}); }
    const r=c.hit(80,{}); if(!S.battle||!st||r.evaded) return;
    v2Apply(c.side,c.f,c.oSide,c.opp,st.k,1,{force:true,rounds:st.rounds,hits:st.hits,mag:st.mag}); },
  dive(c){ applyEvadeBuff(c.f,0.20,1); applyTimedFx(c.f,"vanguardTurn",1); bmsg(`💨 회피 +20% · 다음 라운드 선턴`,{st:stFx(c.side,c.f)}); },
  abyssStrike(c){ const had=c.opp.weaken>0; const r=c.hit(had?250:150,{});
    if(S.battle&&had&&!r.evaded){ c.opp.weaken=0; c.opp.weakenMag=0; bmsg(`💧 약화 소모!`,{st:stFx(c.oSide,c.opp)}); } },
  freeze(c){ const r=c.hit(60,{}); if(S.battle&&!r.evaded) v2CdUp(c.oSide,c.opp); },
  iceReflect(c){ applyTimedFx(c.f,"reflectR",2); bmsg(`🧊 빙벽 반사 (2R)`,{st:stFx(c.side,c.f)}); },
  mistStep(c){ applyEvadeBuff(c.f,0.30,1); bmsg(`💨 회피 +30% (1R)`,{st:stFx(c.side,c.f)}); },
  phantomDance(c){ c.opp.nullifyNext=true; bmsg(`🌫 ${fighterName(c.oSide)}의 다음 행동이 무효가 된다!`,{st:stFx(c.oSide,c.opp)}); },
  floodTide(c){ const r=c.hit(60,{}); if(S.battle&&!r.evaded&&c.opp.weaken>0){ c.opp.weaken=Math.min(4,c.opp.weaken+1); bmsg(`💧 약화 +1회 (${c.opp.weaken}회)`,{st:stFx(c.oSide,c.opp)}); } },
  /* #241 R2 [CJ 설계] 해일 예고 — 시간 예약(pendingFx·atStart)이 아니라 조건 표식이다. 사용 순간 ①~⑩(회피 · 분산 · 상성 · 가하는 피해 ·
     약화 · 치명 · 방어력 · 균열 · 반올림)을 한 번만 계산해 X 를 확정한다(T1~T7 · 난수는 이때만 — T13). 약화 횟수도 사용 순간 값(T2).
     사용자 약화는 공격으로 1회 소모 · 방어막 소모 없음(Venus 2.2 추가). 회피하면 표식 없음 · 전투당 1회는 소모(T4).
     판정은 v2TideCheck(사용 직후 · 매 행동 뒤 · 라운드 종료 처리 뒤 = 방어 효과 만료 직후) */
  tsunami(c){ const o=c.opp;
    const pre=resolveHit(c.side,c.f,o,c.oSide,c.f.atk*(120+(o.weaken||0)*30)/100,0,c.f.element,null,0,{preview:true,critForce:false});
    if(!S.battle) return;
    if(pre.evaded){ bmsg(`🌊 해일 예고가 빗나갔다 — 표식 없음`); return; }
    o.tideMark=pre.dmg; o.tideBy=c.side; o.tideHeld=false;
    bmsg(`🌊 해일 예고 — ${fighterName(c.oSide)}에게 표식 ${pre.dmg} (HP + 방어막 ≤ ${pre.dmg} 이면 발동)`,{st:stFx(c.oSide,o)}); },
  shellClose(c){ shieldAdd(c.f,Math.round(c.f.maxHp*0.18),c.sk.id); bmsg(`🫧 방어막 ${c.f.shield}`,{st:stFx(c.side,c.f)}); },
  /* #241 단순화 6: 💪🏻 50% 반격(라운드당 1회) → 2R 동안 방어막이 막아낸 피해의 50% 반사 (v2AfterHit · 반사 한 행동 1회) */
  clawCounter(c){ applyTimedFx(c.f,"counterR",2); bmsg(`🦀 집게 반격 (2R) — 방어막이 막은 피해 50% 반사`,{st:stFx(c.side,c.f)}); },
  /* ⚡ 번개 */
  /* #241 단순화 2(CJ 승인 수정안): 💪🏻 60% · 감전 100%(적중 시 · 방전과 같은 확률 100% 경로) · 자기 가하는 피해 +10%(2R, 자기 효과라 회피와 무관) */
  charge(c){ const r=c.hit(60,{}); if(!S.battle) return; if(!r.evaded) c.st("shock",1); if(!S.battle) return;
    applyDmgUpBuff(c.f,0.10,2); bmsg(`⚡ 충전 — 가하는 피해 +10% (2R)`,{st:stFx(c.side,c.f)}); },
  chainLightning(c){ c.hit(Math.min(220,100+(c.f.shocksDealt||0)*30),{}); },
  thunderBrand(c){ const late=V2_INTERP.brandByTurnOrder?S.battle.firstSide===c.side:c.opp.shock>0; c.hit(late?260:130,{}); },
  grounding(c){ if(c.f.shock>0){ c.f.shock=0; c.f.shockFresh=false; } applyTimedFx(c.f,"immuneShockR",2);
    v2Apply(c.side,c.f,c.side,c.f,"harden",1,{force:true,mag:0.15,rounds:1}); bmsg(`⚡ 접지 — 감전 해제 · 2R 감전 면역`,{st:stFx(c.side,c.f)}); },
  overloadWall(c){ applyTimedFx(c.f,"overloadR",2); bmsg(`⚡ 과부하 방벽 (2R)`,{st:stFx(c.side,c.f)}); },
  flashStep(c){ c.hit(70,{}); if(!S.battle) return; let pick=-1;
    for(let i=0;i<c.f.skills.length;i++) if(i!==c.slot&&c.f.cds[i]>0&&(pick<0||c.f.cds[i]>c.f.cds[pick])) pick=i;
    if(pick>=0){ c.f.cds[pick]--; bmsg(`🔄 ${SKILLS[c.f.skills[pick]].ko} ⌛ −1 (남은 ⌛${c.f.cds[pick]})`); } },
  /* #241 R1 [CJ 설계] 번개 꼬리 — 💪🏻 100% 타격 뒤 같은 턴 추가 공격 1회(방식 A). 재귀 연계 실행(c2)을 대체한다.
     · 첫 타격이 회피 · 무효 · 방어막에 막혀도 추가 공격(L1) · 2·3차 ⌛ 사본 저장 → 0 · 후보 = 기본기 · 2차 · 3차(L2·L3)
     · 선택은 플레이어 · AI(L4) · 포기 · 도망 · 볼 · 아이템 · 패스 불가(L5·L17) · 피해만 60%(L6)
     · 추가 공격이 끝나면(= 이 턴 끝, L8) v2BonusEnd 가 2·3차 ⌛를 사본으로 되돌린다(추가 공격에 쓴 ⌛ · 쿨타임 디버프 포함 L7·L10·L11)
     · 환영 무도로 번개 꼬리가 무효면 v2PreUse 에서 끝나 여기에 오지 않는다(L12 · P21) */
  lightningTail(c){ c.hit(100,{}); if(!S.battle) return; const B=S.battle;
    const saved={}; for(const i of [1,2]) if(i!==c.slot&&i<c.f.skills.length){ saved[i]=c.f.cds[i]||0; c.f.cds[i]=0; }
    const allowed=V2_INTERP.tailBonusSlots.filter(i=>i!==c.slot&&i<c.f.skills.length);
    B.bonus={side:c.side,tailSlot:c.slot,saved,allowed,stage:"pending"};
    bmsg(`⚡ 번개 꼬리 — 추가 공격! (2 · 3차 ⌛0 · 피해 60%)`,{st:stFx(c.side,c.f)},{key:"skillFx"}); },
  magField(c){ const r=c.hit(50,{}); if(S.battle&&!r.evaded&&c.opp.shock>0) v2CdUp(c.oSide,c.opp); },
  /* #241 단순화 1: 라운드 시작마다 재부여(permShockR · 라운드 시작 훅) → 사용 시 감전 3R 확정 부여(5.6 부여 라운드 제외 · 접지 면역이면 거부) */
  permField(c){ v2Apply(c.side,c.f,c.oSide,c.opp,"shock",1,{force:true,rounds:3}); },
  /* #241 단순화 3: 막아낸 피해만큼 다음 피해 스킬 고정 피해(nextFlat · 층 출처) → 방어막 20% */
  capacitor(c){ shieldAdd(c.f,Math.round(c.f.maxHp*0.20),c.sk.id); bmsg(`🫧 축전 방어막 ${c.f.shield}`,{st:stFx(c.side,c.f)}); },
  discharge(c){ const r=c.hit(120,{flat:(c.f.shield||0)*0.5}); if(S.battle&&!r.evaded) c.st("shock",1); },
  /* 🗻 땅 */
  /* #241 단순화 4: 전용 −40%(burrowR · ⑧ 전용 분기) → 경화 40%(1R). burrowRound 는 지하 매복 사용 조건으로 남는다 */
  burrow(c){ c.f.burrowRound=S.battle.round; bmsg(`🕳 굴 파기`); v2Apply(c.side,c.f,c.side,c.f,"harden",1,{force:true,mag:0.40,rounds:1}); },
  steelHide(c){ v2Apply(c.side,c.f,c.side,c.f,"harden",1,{force:true,mag:0.30,rounds:1}); },
  ironBreak(c){ applyTimedFx(c.f,"nullHitR",1,"nullHitN",1); c.f.nextPowUp=0.80; bmsg(`🦏 철벽 돌파 — 피해 1회 무효 · 다음 피해 스킬 +80%p`,{st:stFx(c.side,c.f)}); },
  /* #241 R4 [CJ 결정] 모래바람 — 💪🏻 60% · 적중 시 대상 회피율 −10%p(2R, 확정) · 자기 회피 +10%(1R, 회피와 무관). 종전 sandWind 1회성 필드 · ⑥ outMult 삭제 */
  sandWind(c){ const r=c.hit(60,{}); if(!S.battle) return;
    if(!r.evaded) v2Apply(c.side,c.f,c.oSide,c.opp,"evadeDown",1,{force:true,mag:0.10,rounds:2});
    applyEvadeBuff(c.f,0.10,1); bmsg(`💨 ${fighterName(c.side)} 회피 +10% (1R)`,{st:stFx(c.side,c.f)}); },
  /* #241 V1 [CJ 승인 Q2]: 속도 −5 → 회피율 −20%p(2R) 사용 시 확정 부여 · 확률 절반 효과는 그대로 */
  sandStorm(c){ applyTimedFx(c.opp,"sandStormR",2); bmsg(`🌪 모래 폭풍 — 상태이상 부여 확률 절반 (2R)`,{st:stFx(c.oSide,c.opp)}); v2Apply(c.side,c.f,c.oSide,c.opp,"evadeDown",1,{force:true,mag:0.20,rounds:2}); },
  weathering(c){ if(c.opp.crack>0){ c.opp.crack=Math.min(3,c.opp.crack+1); bmsg(`🗻 균열 지속 +1R (${c.opp.crack}R)`,{st:stFx(c.oSide,c.opp)}); }
    v2Apply(c.side,c.f,c.side,c.f,"harden",1,{force:true,mag:0.10,rounds:1}); },
  ancientAwaken(c){ v2Heal(c.side,c.f,c.f.maxHp*0.30,"태고의 각성"); v2Apply(c.side,c.f,c.side,c.f,"harden",1,{force:true,mag:0.20,rounds:2}); },
  curlBall(c){ shieldAdd(c.f,Math.round(c.f.maxHp*0.25),c.sk.id); bmsg(`🫧 방어막 ${c.f.shield}`,{st:stFx(c.side,c.f)}); },
  /* #241 단순화 11: 2R 절반 소모(fortressR · shieldConsume 분기) → 현재 방어막만큼 추가(최대 HP 20% 한도) 뒤 방어막 10% */
  fortress(c){ const dup=Math.min(c.f.shield||0,Math.round(c.f.maxHp*0.20)); if(dup>0) shieldAdd(c.f,dup,c.sk.id);
    shieldAdd(c.f,Math.round(c.f.maxHp*0.10),c.sk.id); bmsg(`🏰 요새 전환 · 방어막 ${c.f.shield}`,{st:stFx(c.side,c.f)}); },
  /* 🌿 풀 */
  photosynthesis(c){ v2Heal(c.side,c.f,c.f.maxHp*(S.battle.firstSide===c.side?0.15:0.10),"광합성"); },
  growthKnot(c){ c.hit(100,{flat:Math.min(40,(c.f.healTotal||0)*0.5)}); },
  rootBind(c){ const r=c.hit(100,{}); if(S.battle&&!r.evaded){ c.opp.fleeLock=true; v2Apply(c.side,c.f,c.oSide,c.opp,"healCut",1,{force:true,mag:0.5,rounds:2});
      bmsg(`🌿 뿌리 고정 — 이 전투 동안 도망 불가`,{st:stFx(c.oSide,c.opp)}); } },
  devour(c){ const low=c.opp.hp<=c.opp.maxHp*0.30; const r=c.hit(low?260:160,{});
    if(!r.evaded&&c.opp.hp<=0&&S.battle){ const gain=Math.round(c.f.maxHp*0.20); v2Heal(c.side,c.f,gain,"포식"); } },
  treeRing(c){ applyTimedFx(c.f,"ringR",2); bmsg(`🌳 나이테 (2R)`,{st:stFx(c.side,c.f)}); },
  millennium(c){ applyTimedFx(c.f,"enduredR",2); c.f.enduredUsed=false; bmsg(`🌳 천년목 (2R)`,{st:stFx(c.side,c.f)}); },
  sleepSpore(c){ c.opp.sleepNext=true; bmsg(`💤 ${fighterName(c.oSide)}의 다음 행동은 기본기만 가능`,{st:stFx(c.oSide,c.opp)}); },
  breedSpore(c){ applyTimedFx(c.opp,"breedR",2); c.opp.breedBy=c.side; bmsg(`🍄 번식 포자 (2R)`,{st:stFx(c.oSide,c.opp)}); },
  mossDrain(c){ const r=c.hit(90,{}); if(S.battle&&!r.evaded&&r.actual>0) v2Heal(c.side,c.f,r.actual*0.5,"이끼 흡혈"); },
  mossRot(c){ v2Apply(c.side,c.f,c.oSide,c.opp,"moss",1,{force:true,mag:0.04,rounds:3}); },
  /* #241 단순화 12: 막아낸 피해 50% 라운드 종료 회복(sporePending · 층 출처) → 방어막 15% · 즉시 최대 HP 6% 회복 */
  sporeFilm(c){ shieldAdd(c.f,Math.round(c.f.maxHp*0.15),c.sk.id); bmsg(`🫧 포자 막 방어막 ${c.f.shield}`,{st:stFx(c.side,c.f)}); v2Heal(c.side,c.f,c.f.maxHp*0.06,"포자 막"); },
  mycelium(c){ const conv=Math.min(c.f.shield||0,Math.round(c.f.maxHp*0.30)); c.f.shieldLayers=[]; c.f.shield=0; // 전환은 깨짐이 아니다(3.2)
    v2Heal(c.side,c.f,conv,"균사 전환"); v2Apply(c.side,c.f,c.side,c.f,"absorb",1,{force:true,mag:0.30,rounds:2}); },
  /* 전설 */
  scaleUp(c){ shieldAdd(c.f,Math.round(c.f.maxHp*0.15),c.sk.id); v2Apply(c.side,c.f,c.side,c.f,"harden",1,{force:true,mag:0.15,rounds:1}); },
  /* #241 V1 [CJ 승인 Q2]: 속도 −4 → 적중 시 회피율 −15%p(2R) 확정 */
  wingStrike(c){ const r=c.hit(140,{}); if(S.battle&&!r.evaded) v2Apply(c.side,c.f,c.oSide,c.opp,"evadeDown",1,{force:true,mag:0.15,rounds:2}); },
  /* #241 단순화 13: 걸려 있지 않은 것 1개 선택 로직 → 화상 50% · 약화 50% 각각 판정(💫 가산) */
  poisonBottle(c){ const r=c.hit(110,{}); if(!S.battle||r.evaded) return; c.st("burn",0.50); if(S.battle) c.st("weaken",0.50); },
  whimSpell(c){ v2RemoveBuff(c.oSide,c.opp); v2CleanseOne(c.side,c.f); },
  soulHarvest(c){ const r=c.hit(130,{}); if(S.battle&&!r.evaded&&r.actual>0) v2Heal(c.side,c.f,r.actual*0.30,"영혼 수확"); },
  /* 마녀의 장난(6.4) — 💪🏻 80% 뒤 화상·약화·감전·풀 회복 중 서로 다른 2개를 확률 판정 없이 적용. 회피면 대상 효과 없음(v2Default 와 같음).
     조합 선택은 #121 계약 5.2 의 균등 6조합(공유 rand 1회)을 그대로 쓴다. 상태는 v2Apply force(거울 수면·감전 면역 적용), 회복은 v2Heal(회복 감소 적용) */
  witchPrank(c){ const r=c.hit(80,{}); if(!S.battle||r.evaded) return;
    const combo=WITCH_COMBOS[Math.floor(rand()*WITCH_COMBOS.length)];
    for(const idx of combo){ if(!S.battle) return; const eff=WITCH_EFFECTS[idx];
      if(eff==="grassHeal"){ if(r.actual>0) v2Heal(c.side,c.f,r.actual,"마녀의 장난"); else bmsg(`🌿 마녀의 장난 — 빨아들일 생명이 없었다. (회복 0)`); }
      else c.st(eff,1,{force:true}); } },
  deathShadow(c){ applyEvadeBuff(c.f,0.25,1); c.f.critForce=true; bmsg(`💀 회피 +25% · 다음 피해 스킬 치명타 확정`,{st:stFx(c.side,c.f)}); },
  /* 왕 · 동료 시너지 스킬 (5.3) */
  revenge(c){ v2Revenge(c,0); },
  wrath(c){ v2Revenge(c,1); }
};
function v2Revenge(c,extend){
  const r=c.hit(c.sk.pct,{}); if(!S.battle) return;
  const e=v2KingdomEffectOf(c.f.owner!==undefined?c.f.owner:null,c.f.element); if(!e) return;
  if(e.kind==="harden"||e.kind==="absorb"){ v2Apply(c.side,c.f,c.side,c.f,e.kind,1,{force:true,mag:e.mag,rounds:e.rounds+extend}); return; }
  if(r.evaded) return;
  if(e.kind==="weaken") c.st("weaken",1,{force:true,mag:e.mag,hits:e.hits+extend});
  else c.st(e.kind,1,{force:true,mag:e.mag,rounds:e.rounds+extend});
}
function v2CdUp(tSide,t){ const i=v2CdUpTarget(t); if(i<0){ bmsg(`❄ 늘릴 ⌛가 없다.`); return; }
  /* #241 Q3 [CJ 승인 2026-09-17] ⌛0 에 건 +1 은 부여 라운드의 종료 감소에서 제외한다(5.6 Fresh 와 같은 방식) — 시전자가 후턴이어도 효과가 남는다 */
  if(V2_INTERP.cdUpFresh&&!(t.cds[i]>0)){ t.cdUpFresh=t.cdUpFresh||[]; t.cdUpFresh[i]=true; }
  t.cds[i]=(t.cds[i]||0)+1; bmsg(`❄ ${fighterName(tSide)}의 스킬 1개 ⌛ +1`,{st:stFx(tSide,t)}); }
/* 라운드 종료 처리 — 화상 다음 · 지속 감소 전에 nextPhase 가 부른다. 반환 true = 전투 종료 */
function v2RoundEnd(f,side){
  const B=S.battle;
  if(f.mossRFresh){ /* 부여 라운드는 세지 않는다 (5.6) */ }
  else if(f.mossR>0){ const d=v2Dot(side,f,f.maxHp*(f.mossPct||0.04),"🍄 이끼 잠식 —",f.mossBy);
    const by=f.mossBy==="A"?B.fa:f.mossBy==="D"?B.fd:null; if(by&&d>0) v2Heal(f.mossBy,by,d,"이끼 잠식");
    if(checkDeath()) return true; }
  if(!f.ringRFresh&&f.ringR>0) v2Heal(side,f,f.maxHp*0.06,"나이테");
  return false; // #241 단순화 12: 포자 막 라운드 종료 회복(sporePending) 삭제 — 사용 시 즉시 회복
}
function v2RoundDecay(f){
  for(const k of V2_TIMED){
    if(f[k+"Fresh"]){ f[k+"Fresh"]=false; continue; }
    if(f[k]>0){ f[k]--; if(!f[k]){ for(const m of (V2_TIMED_MAG[k]||[])) f[m]=(m==="mossBy"||m==="breedBy")?null:0; } }
  }
}
/* #241: 라운드 시작 처리(v2RoundStart — 영구 자기장 재부여 · 해일 예고 atStart 발동)는 두 사용처가 모두 교체 · 단순화되어 삭제했다 */
/* #241 R2 [CJ 설계] 해일 예고 판정 — 사용 직후(finishV2) · 매 행동 뒤 · 라운드 종료 처리 뒤(nextPhase)에 부른다.
   라운드 종료 처리의 지속 감소가 곧 천년목 · 철벽 돌파 · 과부하 방벽의 만료 시점이므로 '방어 효과 만료 직후'도 그 호출이 덮는다.
   · 조건: HP + 방어막 ≤ X (T8) · 판정은 결정론(난수 0 — T13)
   · 보류: 천년목(아직 버티기를 쓰지 않은 채 켜짐) · 철벽 돌파(무효 1회가 남은 채 켜짐) · 과부하 방벽(켜짐) 중 하나라도 있으면 표식 유지 · 효과 소모 없음
   · 발동: 방어막째 사망(instaKill — 사신의 낫과 같은 즉사 경로) · 반사/반격 없음 · 실제 줄어든 HP+방어막을 유효 피해로 기록(T20)
   반환 true = 전투 종료 */
function v2TideBlocked(f){ return (f.enduredR>0&&!f.enduredUsed)||(f.nullHitR>0&&f.nullHitN>0)||f.overloadR>0; }
function v2TideCheck(){
  const B=S.battle; if(!B) return false;
  let fired=false;
  for(const [f,side] of [[B.fa,"A"],[B.fd,"D"]]){
    if(!(f.tideMark>0)||f.hp<=0) continue;
    if(f.hp+(f.shield||0)>f.tideMark){ f.tideHeld=false; continue; }
    if(v2TideBlocked(f)){ if(!f.tideHeld){ f.tideHeld=true; bmsg(`🌊 해일 예고 — ${fighterName(side)}의 방어 효과가 켜져 있어 보류`,{st:stFx(side,f)}); } continue; }
    const lethal=f.hp+(f.shield||0), by=f.tideBy; f.tideMark=0; f.tideHeld=false;
    bmsg(`🌊 해일 예고 발동!`,{sig:true},{key:"skillFx"});
    instaKill(f); if(by==="A"||by==="D") addRec(by,lethal);
    bmsg(`🌊 ${fighterName(side)}는 해일에 휩쓸렸다 — 사망!`,{shake:side,float:{side,html:`<span class="neg">해일</span>`},hp:{side,val:0,max:f.maxHp},st:stFx(side,f)},{key:"damageFx"});
    fired=true;
  }
  return fired?checkDeath():false;
}
/* AI 판단 힌트 (자기 스킬 정보만 — 공정 관측과 무관) */
const V2_AI_HINT={
  def:["emberScale","heatShell","heatStore","iceReflect","mistStep","dive","shellClose","clawCounter","grounding","overloadWall","capacitor",
       "burrow","steelHide","ironBreak","curlBall","fortress","millennium","sporeFilm","scaleUp","deathShadow"],
  heal:["clearWater","photosynthesis","treeRing","mycelium","ancientAwaken","emberPlant"],
  debuff:["eternalAsh","phantomDance","tsunami","permField","sandStorm","weathering","sleepSpore","breedSpore","mossRot","whimSpell"]
};
for(const k of Object.keys(V2_AI_HINT)) for(const fx of V2_AI_HINT[k]) for(const id of Object.keys(SKILLS)) if(SKILLS[id].v2&&SKILLS[id].fx===fx&&!SKILLS[id].pct) SKILLS[id].ai=k;
/* #241 Venus 5.4 — 교대 방식에서 AI 가 쓰는 '예정 선턴' 입력. 공개된 전투 순서 상태(B.firstSideR1 · B.round)만 본다 — 상대 비공개 정보 없음.
   반환: 그 라운드의 예정 선턴 측(순서 효과를 반영하기 전) · 모르면 null */
function aiScheduledLead(B,round){
  if(!B||(B.firstSideR1!=="A"&&B.firstSideR1!=="D")) return null;
  return round%2===1?B.firstSideR1:(B.firstSideR1==="A"?"D":"A");
}
/* 피해 스킬 추정 보정 — [배율, 가산점]. 자기 스킬 · 공개 전투 상태만 본다 */
function aiV2DmgAdj(side,f,sk){
  const B=S.battle; let mult=1, bonus=0; if(!B||!sk||!sk.v2) return [mult,bonus];
  const oSide=side==="A"?"D":"A", nextLead=aiScheduledLead(B,B.round+1);
  if(B.bonus&&B.bonus.stage==="active"&&B.bonus.side===side) mult*=V2_INTERP.tailBonusDmg; // 번개 꼬리 추가 공격 60%
  if(sk.fx==="thunderBrand") mult*=(B.firstSide===side)?2:1;       // 이번 라운드 선턴이면 260%
  if(sk.fx==="lightningTail") mult*=1.6;                          // 첫 타격 + 추가 공격 60% (Venus 1.4)
  const shocks=(sk.st&&sk.st.k==="shock")||sk.fx==="discharge"||sk.fx==="charge";
  if(shocks&&nextLead) bonus+=nextLead===oSide?3:-2;              // 감전은 대상이 예정 선턴인 다음 라운드를 뒤집을 때만 순서 가치가 있다
  if(sk.fx==="undyingEmber"&&nextLead) bonus+=nextLead===oSide?2:0; // 선턴 효과는 다음 라운드 예정 후턴일 때 뒤집는다
  if(sk.fx==="mirrorSurface"&&v2PeekStatus(f)) bonus+=4;          // 옮길 자기 상태이상이 있을 때
  return [mult,bonus];
}
function aiV2SupportScore(f,sk,lowHp,side,opp){
  const k=sk.ai||"buff", B=S.battle;
  if(sk.fx==="tsunami"&&opp){ // #241 R2 — 사용 시점: 공개 수치(HP · 방어막 · 약화 · 방어력 · 경화 · 속성)로 X 를 어림해 곧 발동할 때 쓴다
    const adv=f.element&&opp.element&&BEATS[f.element]===opp.element, dis=f.element&&opp.element&&BEATS[opp.element]===f.element;
    const x=(f.atk||0)*(1.2+0.3*(opp.weaken||0))*(adv?BAL.advMult:dis?BAL.disMult:1)*(f.weaken>0?(1-BAL.weakenPct):1)*(1-Math.min(0.5,(opp.def||0)/100+(opp.hardenPct||0)));
    const pool=(opp.hp||0)+(opp.shield||0);
    return pool<=x*0.95?95:pool<=x*1.5?9:1; }
  if(k==="heal") return f.hp<f.maxHp*0.6?(lowHp?20:9):1;
  if(k==="def"){ let s=lowHp?14:5; if(sk.fx==="dive"&&B&&side){ const nl=aiScheduledLead(B,B.round+1); if(nl&&nl!==side) s+=2; } return s; }
  if(k==="debuff") return 7;
  return 6;
}


/* ===== #89 하수인 아트 연결 — 표시 계층 전용. 규칙·수치·AI 공정 관측은 하나도 바뀌지 않는다 =====
   자산: demo/assets/minions/<속성>_<아키타입>/{icon.png 32 · battle.png 128 · portrait.webp 512}.
   상대경로이므로 file:// 오프라인(index.html 과 assets/ 를 함께 둔 폴더)과 기존 HTTP 서빙 양쪽에서 같은 경로로 읽힌다.
   정보 은닉(규격 7.10.3): 정체를 모르는 말에는 <img>·src·개별 요청·alt/title/aria/data/클래스 어디에도 실제 종 값을 만들지 않는다. */
const ART_BASE="assets/minions/";
/* ===== #124 (v0.4.7) 왕·동료 아트 연결 훅 — 표시 계층 전용 =====
   자산: demo/assets/leaders/<king|companion>/{icon64.png · battle256.png}. 로스터 20종에서 파생되는 ART_DIRS 허용 목록에
   끼워 넣지 않고 **별도 조회 경로**를 쓴다 (Venus 6장 F14). 아직 납품 전일 수 있으므로 **실제로 불러와진 뒤에만** 그림으로 바꾸고,
   그 전과 로드 실패 뒤에는 현행 이모지(👑·🤝)로 그대로 되돌아간다 — 새 폴백 규칙을 만들지 않는다.
   정보 은닉: 하수인과 같은 자리에서만 부른다 — 확정(known)된 말과 실제 출전 중인 본체 전투원뿐이다.
   미공개 말에는 <img>·src·alt·클래스 어디에도 정체 값이 만들어지지 않는다.
   폴더 이름에 소유자·진영 정보가 없고 프리로드가 정체와 무관한 고정 집합이라 요청 목록이 상관관계를 만들지 않는다. */
const LEADER_BASE="assets/leaders/";
const LEADER_OF={king:"king",ally:"companion"};
const LEADER_DIRS=["king","companion"], LEADER_DIR_SET=new Set(LEADER_DIRS);
const LEADER_FILES={icon:"icon64.png",battle:"battle256.png"};
function leaderDirOf(p){ return (p&&LEADER_OF[p.type])?LEADER_OF[p.type]:null; }
/* 실제 로드가 확인된 뒤에만 참 — 자산이 없거나 실패하면 null 이라 현행 이모지 경로로 간다.
   #201: ART.loaded 는 "언젠가 받은 적이 있다"는 과거 기록이다. 그 뒤 그 파일이 영구 결손으로 판정되면(artGone)
   여기서도 손을 떼야 한다 — 그러지 않으면 없는 파일을 화면이 열릴 때마다 다시 요청한다 (하수인 쪽 artBattleOk 와 같은 이유). */
function leaderArtDir(p){ const d=leaderDirOf(p);
  return (d&&!ART.failed.has(d)&&!artGone(d,LEADER_FILES.icon)&&ART.loaded.has(d+"/"+LEADER_FILES.icon))?d:null; }
function leaderBattleDir(pf,piece){ // 본체 출전일 때만 — 포획 하수인 대리 출전은 그 하수인 아트를 그대로 쓴다 (#91)
  if(!pf||!piece||pf!==piece) return null;
  const d=leaderDirOf(piece);
  return (d&&!ART.failed.has(d)&&!artGone(d,LEADER_FILES.battle)&&ART.loaded.has(d+"/"+LEADER_FILES.battle))?d:null;
}
const ART_DIRS=ROSTER.filter(r=>ELEMS.includes(r.element)&&ARCH_TMPL[r.arch]).map(r=>r.element+"_"+r.arch); // 기존 20종 폴더 허용 목록 — #234 의 보호형·땅 10종은 폴더가 없어 목록 밖(이모지 폴백, 새 경로 생성 금지)
const ART_DIR_SET=new Set(ART_DIRS);
/* #201 (v0.4.8) retry·gone·settled 는 일시적 로드 실패 복구 전용 칸이다 — 규칙·수치·정보 경계와 무관한 표시 계층 상태다.
   예산은 **파일 단위**다 ("종/파일" 키). 전투 도트 하나가 영영 없다고 해서 멀쩡한 보드 아이콘까지 막히면 안 되기 때문이다.
     retry:   "종/파일" → {n:연속 실패 횟수, total:누적 조회 횟수, timer:예약, busy:조회 중, dl:마감 타이머}
     gone:    "종/파일" — 예산을 다 쓴 파일. 다시는 조회하지 않는다 (영구 결손)
     settled: 종 — 그 종의 모든 파일이 loaded 이거나 gone 이라 더 할 일이 없는 상태 */
const ART={failed:new Set(),loaded:new Set(),preloaded:false,rerender:null,retry:new Map(),gone:new Set(),settled:new Set()};
function artUrl(dir,file){return (LEADER_DIR_SET.has(dir)?LEADER_BASE:ART_BASE)+dir+"/"+file;} // #124: 왕·동료는 별도 폴더
/* 말 → 종 폴더. rosterId 가 없거나(미배정 하수인) 허용 목록 밖이면 null → 안전 폴백. 포획·예비 하수인(cap)은 type 이 없어 여기서는 항상 null — 전투 토큰은 artDirOfFighter (#91) */
function artDirOf(p){
  if(!p||p.type!=="minion"||!p.rosterId) return null;
  const rd=ROSTER.find(r=>r.id===p.rosterId); if(!rd) return null;
  const dir=rd.element+"_"+rd.arch;
  return ART_DIR_SET.has(dir)?dir:null;
}
/* #91 전투 토큰용: 지금 실제로 싸우는 전투원(pf)의 종 폴더.
   본체(pf===piece)는 artDirOf 그대로. 대리 출전(포획·예비 하수인)은 pf 가 정확히 그 말의 cap 객체일 때만, cap 의 표시 전용 외형 정체 artRosterId 가
   허용 목록(ROSTER 20종)에 있고 그 종의 속성이 cap 의 표시 속성과 같을 때만 폴더를 돌려준다. 그 밖(왕·동료 본체·id 없음·오염·불일치)은 null → 현행 이모지 토큰.
   artRosterId 는 rosterId 와 다른 이름이라 전투 규칙(archOf→skillParamsOf)이 읽지 않는다 (v0.4.4 규격 1장).
   #121 계약 6 (v0.4.7): **숲 포획만** rosterId 를 함께 기록해 그 종의 실제 기술 동작을 보존한다. 전투 중 적 포획(예비)은
   범위 밖이라 종전처럼 artRosterId 만 갖고 수치·기술·RNG 는 공용 규격(BAL.captured)을 쓴다 — 두 경로를 구분해 읽을 것. */
function artDirOfFighter(pf,piece){
  if(!pf||!piece) return null;
  if(pf===piece) return artDirOf(piece);
  if(pf!==piece.cap||!pf.artRosterId) return null;
  const rd=ROSTER.find(r=>r.id===pf.artRosterId); if(!rd||rd.element!==pf.element) return null;
  const dir=rd.element+"_"+rd.arch;
  return ART_DIR_SET.has(dir)?dir:null;
}
function artOk(dir){return !!dir&&!ART.failed.has(dir);}
/* 한 번만 예약되는 재그리기 — artFail·artLeaderReady·#201 복구 성공이 이 한 자리를 함께 쓴다.
   전투 모달을 다시 부르지 않으므로 메시지 재생·FX·전투 타이밍에 재진입하지 않는다 */
function artRerender(){
  if(ART.rerender) return;
  ART.rerender=setTimeout(()=>{ART.rerender=null; try{if(S&&S.phase!=="menu") render();}catch(e){}},0);
}
/* ===== #201 (v0.4.8) 일시적 로드 실패 복구 — 표시 계층 전용 =====
   배경: 온라인(HTTP)에서는 자산이 멀쩡히 있어도 서버 요청 한도·순간 혼잡으로 개별 이미지가 한 번 실패할 수 있다.
   종전에는 그 한 번이 ART.failed 에 영구히 남아 그 종만 끝까지 이모지·텍스트로 남았고(왕·동료는 ART.loaded 확인이
   프리로드 1회뿐이라 더 심했다), 페이지를 새로 열기 전에는 되돌아올 길이 없었다.
   계약:
     - 유한: 파일마다 연속 실패 ART_RETRY.max 회, 누적 ART_RETRY.hardMax 회가 상한이다. 정말 없는 파일은
       gone 으로 굳어 다시는 조회하지도, 다시 그리지도 않는다 — 무한 재시도·재그리기·요청 폭주가 생기지 않는다.
     - 능동 마감: 조회마다 스스로 시한(deadlineMs)을 건다. onload·onerror 어느 쪽도 오지 않는 요청에 갇히지 않고,
       끝낼 때 마감 타이머를 끄고 핸들러를 떼어 뒤늦은 이벤트가 상태를 다시 건드리지 못하게 한다.
     - 중복 제거: 파일당 예약 1개·조회 1개. 같은 종의 <img> 가 여러 칸에서 동시에 실패해도 조회는 한 벌뿐이다.
     - 파일 단위 책임: 전투 도트가 영영 없다고 해서 멀쩡한 보드 아이콘까지 막히지 않는다. 반대로 없는 전투 파일은
       artBattleOk 가 걸러 다음 전투창에서 다시 요청되지 않는다.
     - 요청 경계 불변: 조회 대상은 프리로드가 쓰는 바로 그 파일이다 — 새 URL 도, 새 종류의 요청도 만들지 않는다.
       촉발 지점도 종전과 같다: 정체와 무관한 고정 프리로드 집합, 그리고 **이미 공개된 말이 이미 내보내던 <img>** 뿐이다.
       미공개 말에는 여전히 <img>·src·alt·클래스 어디에도 정체 값이 생기지 않는다.
     - 표시 전용: 규칙·수치·RNG·온라인 프로토콜·전투 연출 타이밍을 하나도 건드리지 않는다. */
/* max: 한 파일이 연속으로 몇 번 떨어지면 포기하는가 (성공하면 0 으로 돌아간다 — 그 파일이 있다는 증거이므로)
   hardMax: 그 파일에 페이지 수명 동안 허용하는 조회 총량. 성공/실패를 오가는 병적인 경우에도 요청이 늘어나지 않게 막는 절대 상한
   delays: 점점 긴 간격 — 혼잡이 가라앉을 시간을 주고 스스로 혼잡을 만들지 않는다
   deadlineMs: **능동 마감**. 응답이 오지도 끊기지도 않는 요청(onload·onerror 어느 쪽도 오지 않는 경우)에 갇히지 않도록
               조회마다 스스로 시한을 걸고 끝낸다. 이것이 없으면 진행 중 표시가 영원히 남아 다음 예약이 서지 않는다. */
const ART_RETRY={max:3,hardMax:8,delays:[400,1200,3600],deadlineMs:5000};
/* 그 종이 프리로드에서 쓰는 고정 파일 쌍. 첫 번째가 아이콘(보드 얼굴), 두 번째가 전투 도트다 */
function artFilesOf(dir){ return LEADER_DIR_SET.has(dir)?[LEADER_FILES.icon,LEADER_FILES.battle]:["icon.png","battle.png"]; }
function artIconFile(dir){ return artFilesOf(dir)[0]; }
function artBattleFile(dir){ return artFilesOf(dir)[1]; }
/* 그 파일이 영영 없다고 판정됐는가 — 이 판정을 그린 자리에서 바로 읽어, 없는 파일을 다시 <img> 로 내보내지 않는다 */
function artGone(dir,f){ return !!dir&&ART.gone.has(dir+"/"+f); }
/* 전투 도트를 그려도 되는가: 그 종이 폴백이 아니고, 전투 파일이 영구 결손으로 판정되지 않았을 때만.
   이 확인이 없으면 "아이콘은 살아 있고 전투 파일만 없는" 종에서 전투창을 열 때마다 없는 파일을 다시 요청하고,
   그 실패가 다시 종 전체를 폴백으로 내리는 왕복이 생긴다 (#201 Saturn 지적). */
function artBattleOk(dir){ return artOk(dir)&&!artGone(dir,artBattleFile(dir)); }
/* 그 종에 더 할 일이 남았는가 — 모든 파일이 loaded 이거나 gone 이면 굳는다 */
function artMarkSettled(dir){
  const done=artFilesOf(dir).every(f=>ART.loaded.has(dir+"/"+f)||ART.gone.has(dir+"/"+f));
  if(done) ART.settled.add(dir); else ART.settled.delete(dir);
}
/* force = 방금 실제로 실패한 파일. 그 파일은 이미 로드된 적이 있어도 다시 확인한다.
   나머지 파일은 "아직 확인되지 않은 것"만 부른다 — 멀쩡한 파일을 덤으로 다시 요청하지 않는다.
   예외 하나: 그 종이 폴백으로 내려가 있으면(ART.failed) 아이콘은 다시 확인한다. 보드 얼굴을 되돌릴 유일한 근거이기 때문이다. */
function artScheduleRecovery(dir,force){
  if(!dir) return;
  if(!ART_DIR_SET.has(dir)&&!LEADER_DIR_SET.has(dir)) return;   // 허용 목록 밖 값으로는 경로를 만들지 않는다
  for(const f of artFilesOf(dir)){
    if(f!==force&&ART.loaded.has(dir+"/"+f)&&!(f===artIconFile(dir)&&ART.failed.has(dir))) continue;
    artScheduleFile(dir,f);
  }
}
function artScheduleFile(dir,f){
  const k=dir+"/"+f;
  if(ART.gone.has(k)) return;                                   // 영구 결손 — 다시 조회하지 않는다
  let st=ART.retry.get(k); if(!st){st={n:0,total:0,timer:null,busy:false,dl:null}; ART.retry.set(k,st);}
  if(st.timer||st.busy) return;                                 // 예약됐거나 조회 중 — 파일당 한 벌 (능동 마감이 busy 를 반드시 푼다)
  if(st.n>=ART_RETRY.max||st.total>=ART_RETRY.hardMax){ ART.gone.add(k); artMarkSettled(dir); return; }
  const wait=ART_RETRY.delays[Math.min(st.n,ART_RETRY.delays.length-1)];
  st.n++; st.total++;
  st.timer=setTimeout(()=>{ st.timer=null; artProbeFile(dir,f,st); },wait);
}
/* 판정은 전부 **이번 조회의 결과**로만 한다 — 지난 프리로드가 남긴 ART.loaded 를 "지금 성공"으로 오해하면
   실패한 자산을 복구했다고 착각하거나(ART.failed 오삭제), 반대로 폴백을 못 걷어내고 굳는다.
   끝날 때는 반드시 마감 타이머를 끄고 핸들러를 떼어, 뒤늦게 도착한 이벤트가 상태를 다시 건드리지 못하게 한다. */
function artProbeFile(dir,f,st){
  const k=dir+"/"+f;
  let im=null, fin=false;
  const finish=loaded=>{
    if(fin) return; fin=true;
    st.busy=false;
    if(st.dl){ try{clearTimeout(st.dl);}catch(e){} st.dl=null; }
    if(im) try{ im.onload=null; im.onerror=null; }catch(e){}    // 늦게 오는 이벤트를 안전하게 끊는다
    if(loaded){
      const isNew=!ART.loaded.has(k);
      ART.loaded.add(k); st.n=0;                                 // 있다는 것이 확인됐으니 연속 실패 기록을 지운다
      const wasFailed=ART.failed.has(dir);
      if(f===artIconFile(dir)&&wasFailed) ART.failed.delete(dir); // 아이콘이 살아났다 → 그 종을 다시 그림으로 돌린다
      if(isNew||(f===artIconFile(dir)&&wasFailed)) artRerender(); // 얻은 게 있을 때만 다시 그린다 (재그리기 고리 없음)
      artMarkSettled(dir);
      return;
    }
    if(st.n>=ART_RETRY.max||st.total>=ART_RETRY.hardMax){ ART.gone.add(k); artMarkSettled(dir); return; } // 유한 종료
    artScheduleFile(dir,f);
  };
  st.busy=true;
  st.dl=setTimeout(()=>{ st.dl=null; finish(false); },ART_RETRY.deadlineMs); // 능동 마감 — 아무 이벤트도 오지 않아도 끝난다
  try{
    im=document.createElement("img");
    im.onload=()=>finish(true);
    im.onerror=()=>finish(false);
    im.src=artUrl(dir,f);
  }catch(e){ finish(false); }
}
/* 로드 실패: 그 종만 텍스트·기호 폴백으로 되돌리고 한 번만 다시 그린다. onerror 를 즉시 끊어 재요청 고리를 만들지 않는다.
   #201: 화면은 종전과 똑같이 즉시 안전 폴백으로 가고, 그와 **별도로** 유한 복구 조회를 예약한다 */
window.artFail=function(dir,el){
  if(el) try{el.onerror=null;}catch(e){}
  if(!dir) return;
  const first=!ART.failed.has(dir);
  ART.failed.add(dir);
  /* 이미 실패로 기록된 종이어도 복구 예약은 매번 시도한다 — 겹침은 예약·진행 중 검사가 걸러낸다.
     여기서 일찍 빠져나가면 "조회가 끝난 뒤 다시 실패한" 종이 다시 예약될 기회를 영영 잃는다.
     실패한 것은 보드 아이콘이므로 그 파일을 지목해 확인한다. */
  artScheduleRecovery(dir,artIconFile(dir));
  if(first) artRerender();   // 재그리기는 종전대로 상태가 바뀔 때 한 번만
};
/* 전투 도트 실패: 지금 보고 있는 전투에서도 즉시 현행 이모지 토큰으로 바꿔 끼운다 — 전투원 자리가 비어 보이지 않는다.
   battleModal() 을 다시 부르지 않으므로 메시지 재생·FX 에 재진입하지 않고, 토큰의 id·위치 클래스는 그대로라 shake·ko·dmgfloat 경로가 유지된다 */
window.artSpriteFail=function(dir,el){
  if(el) try{el.onerror=null;}catch(e){}
  /* #201: 지금 이 전투의 토큰은 아래에서 즉시 이모지로 바뀌고(연출 타이밍 불변), 복구는 다음 렌더부터 반영된다.
     전투 파일만 영영 없는 종이면 아이콘 조회가 성공해 보드 얼굴은 곧 아트로 돌아오고, 전투 파일은 gone 으로 굳어
     다음 전투창이 그 파일을 다시 요청하지 않는다 — 실패→종 폴백→재요청의 왕복이 생기지 않는다. */
  if(dir){ ART.failed.add(dir); artScheduleRecovery(dir,artBattleFile(dir)); }
  const tok=el&&el.parentNode;
  try{
    const B=S&&S.battle;
    if(tok&&tok.classList&&B&&(tok.id==="tok-A"||tok.id==="tok-D")){
      const sid=tok.id==="tok-A"?"A":"D", pf=sid==="A"?B.fa:B.fd, piece=sid==="A"?B.attP:B.defP;
      tok.classList.remove("art");
      const lb=pf===piece&&(piece.type==="king"||piece.type==="ally"); // #234: 왕·동료 본체는 속성을 가져도 현행 이모지 토큰 유지(표시 개편은 #238) — 속성은 패널 배지로 보인다
      tok.style.background=pf.element&&!lb?`var(--${pf.element})`:"#5a6377";
      const emo=lb?(piece.type==="king"?"👑":"🤝"):pf.element?ELEM_EMO[pf.element]:(piece.type==="king"?"👑":piece.type==="ally"?"🤝":"❔");
      tok.innerHTML=`${emo}<small>${pf.element&&!lb?ELEM_KO[pf.element]:TYPE_KO[piece.type]}</small>`;
      return;
    }
  }catch(e){}
  try{el.style.display="none";}catch(e){}
};
/* 설명창 일러스트: webp(배포본) → png(원본) → 숨김. 각 단계에서 onerror 를 끊으므로 고리가 생기지 않는다 */
window.artPortraitFail=function(el,dir){
  if(!el) return;
  try{el.onerror=null;}catch(e){}
  const stage=(el._artStage||1)+1; el._artStage=stage;
  if(stage===2&&ART_DIR_SET.has(dir)){ el.onerror=function(){artPortraitFail(el,dir);}; el.src=artUrl(dir,"portrait.png"); return; }
  // 둘 다 실패: 자리를 유지한 채 대체 표시로 바꾼다 — 이미지를 지워 모달 레이아웃이 튀지 않게 한다
  try{
    const box=el.parentNode;
    if(box&&box.classList&&box.classList.contains("rosterArt")){ box.classList.add("fb"); box.innerHTML=`<span>이미지를 불러오지 못했습니다</span>`; return; }
  }catch(e){}
  try{el.style.display="none";}catch(e){}
};
/* 프리로드는 페이지 로드 시 20종 일괄이다 — 개별 말이 개별 파일을 요청하지 않으므로 요청 목록이 정체와 상관관계를 만들지 않는다.
   설명창 원본(portrait 20종 약 3.1MB)은 여기서 받지 않고 설명창을 열 때만 받는다 */
function artPreload(){
  if(ART.preloaded) return; ART.preloaded=true;
  for(const dir of ART_DIRS) for(const f of ["icon.png","battle.png"]){
    try{
      const im=document.createElement("img");
      im.onload=()=>{ART.loaded.add(dir+"/"+f);};
      im.onerror=()=>{if(f==="icon.png") ART.failed.add(dir); artScheduleRecovery(dir,f);}; // #201 유한 복구 — 떨어진 그 파일만
      im.src=artUrl(dir,f);
    }catch(e){}
  }
  /* #124: 왕·동료 2종도 같은 시점에 같은 고정 집합으로 요청한다 (정체와 무관 — 요청 목록이 상관관계를 만들지 않는다).
     아직 납품 전이면 여기서 실패해 ART.failed 에 들어가고 화면은 현행 이모지 그대로다. */
  for(const dir of LEADER_DIRS) for(const f of [LEADER_FILES.icon,LEADER_FILES.battle]){
    try{
      const im=document.createElement("img");
      im.onload=()=>{ART.loaded.add(dir+"/"+f); artLeaderReady();};
      /* #201: 왕·동료는 ART.loaded 확인 경로가 프리로드뿐이라, 여기서 한 번 놓치면 종전에는 영원히 이모지였다 */
      im.onerror=()=>{if(f===LEADER_FILES.icon) ART.failed.add(dir); artScheduleRecovery(dir,f);};
      im.src=artUrl(dir,f);
    }catch(e){}
  }
}
function artLeaderReady(){ artRerender(); } // 자산이 늦게 도착했을 때 한 번만 다시 그린다 (artFail 과 같은 1회 예약 자리를 공유한다)
/* 기호 어휘는 MEMO_OPTS 8종 하나뿐이다 — 확정 표시와 추측 메모가 같은 이모지를 쓴다 (규격 7.10.1 · 신규 래스터 0장) */
function memoEmoji(key){const o=memoOpt(key); return o?o.emoji:"";}
function memoShort(key){ // 기호를 그릴 수 없을 때 쓰는 같은 뜻의 짧은 현행 라벨 (왕·동료·폭탄·함정·불·물·풀·번개)
  return key&&key.indexOf("minion_")===0?(ELEM_KO[key.slice(7)]||""):((memoOpt(key)||{}).ko||"");
}
/* 플랫폼 글리프 지원 확인 — 일부 환경에는 최신 이모지 글리프가 어떤 설치 폰트에도 없어 빈 네모(두부)로 그려진다.
   실측(Windows 10 19045 · Chrome): 🪤(U+1FAA4)는 sans-serif · "Segoe UI Emoji" · Apple/Noto 를 모두 얹은 스택에서 폭이 두부와 같다 —
   즉 CSS 폰트 스택으로는 해결되지 않는 폰트 커버리지 문제다. 기호 계약은 그대로 두고, 그릴 수 없는 기호만 현행 텍스트 라벨로 되돌린다.
   측정이 불가능한 환경(canvas 없음)에서는 "지원함"으로 본다 — 기본 계약은 이모지다. */
const GLYPH={cache:{},font:'16px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif',NOTDEF:"\u{10FFFD}"};
function glyphOk(ch){
  if(!ch) return false;
  if(ch in GLYPH.cache) return GLYPH.cache[ch];
  let ok=true;
  try{
    const cv=document.createElement("canvas"), c=cv.getContext&&cv.getContext("2d");
    if(c&&c.measureText&&c.getImageData){
      cv.width=28; cv.height=28; // 캔버스 크기를 먼저 정하고(상태 초기화) 폰트를 건다
      c.font=GLYPH.font;
      const w=c.measureText(ch).width, tw=c.measureText(GLYPH.NOTDEF).width;
      /* 폭이 같다는 사실만으로 "글리프 없음"이라고 단정하지 않는다 — 정상 글리프도 같은 advance 를 가질 수 있다.
         폭 일치는 값싼 1차 거름이고, 확증은 실제로 그려 본 픽셀이 "그리지 못한 그림"과 완전히 같은지로 한다. */
      if(w>0&&tw>0&&Math.abs(w-tw)<0.01){
        const px=s=>{ c.clearRect(0,0,cv.width,cv.height); c.fillStyle="#fff"; c.textBaseline="top"; c.font=GLYPH.font;
                      c.fillText(s,2,2); return c.getImageData(0,0,cv.width,cv.height).data; };
        const a=px(ch), b=px(GLYPH.NOTDEF);
        let same=a.length===b.length;
        for(let i=0;same&&i<a.length;i++) if(a[i]!==b[i]) same=false;
        ok=!same;
      }
    }
  }catch(e){ ok=true; } // 측정 불가 환경에서는 기본 계약(이모지)을 유지한다
  GLYPH.cache[ch]=ok; return ok;
}
/* #201 후속(2026-09-11 CJ 지시): 전용 기호 도형 — 폰트가 아니라 벡터로 그린다.
   🪤(U+1FAA4)는 설치 폰트에 글리프가 없는 환경이 있어 종전에는 "함정" 글자로 되돌아갔다(위 glyphOk).
   그 글자 폴백 대신 같은 뜻의 도형을 문서 안에 직접 그려 **어떤 폰트에도 의존하지 않는다**.
   원본 자산은 Earth 납품 demo/assets/symbols/trap.svg 이고 아래 geometry 는 그 파일의 도형을 그대로 옮긴 사본이다
   (인라인이라 HTTP 요청·캐시·실패 경로가 새로 생기지 않는다 — 미공개 말의 요청 목록과 상관관계를 만들지 않는다).
   demo/test/hotfix/201/trap_icon_cdp.js 가 두 곳이 같은 도형인지 매 실행 대조한다. */
const SYM_SVG={
  trap:'<path d="M7 13h18v9H7z" fill="#87633e" stroke="#171e2b" stroke-width="1.5" stroke-linejoin="round"/>'
      +'<path d="M3 14C3 7 8 3 16 3s13 4 13 11h-4l-1-4-3 3-2-5-3 4-3-4-2 5-3-3-1 4Z" fill="#d7e1e5" stroke="#171e2b" stroke-width="1.5" stroke-linejoin="round"/>'
      +'<path d="M3 19c0 7 5 10 13 10s13-3 13-10h-4l-1 4-3-3-2 5-3-4-3 4-2-5-3 3-1-4Z" fill="#a9bec8" stroke="#171e2b" stroke-width="1.5" stroke-linejoin="round"/>'
      +'<path d="M7 8c4-4 14-4 18 0M8 26c5 2 11 2 16 0" fill="none" stroke="#f3f5eb" stroke-width="1.25" stroke-linecap="round"/>'
      +'<path d="M16 16h12" fill="none" stroke="#171e2b" stroke-width="3" stroke-linecap="round"/>'
      +'<circle cx="15" cy="16.5" r="4" fill="#c99b58" stroke="#171e2b" stroke-width="1.5"/>'
      +'<path d="M13 15h3" fill="none" stroke="#f0cf8b" stroke-width="1.5" stroke-linecap="round"/>'
      +'<path d="M22 14v5m3-5v5m3-5v5" fill="none" stroke="#d7e1e5" stroke-width="1.5" stroke-linecap="round"/>'
      +'<circle cx="4" cy="16.5" r="2" fill="#a9bec8" stroke="#171e2b" stroke-width="1.5"/>'};
/* 기호 도형 1개. 크기는 담는 자리(.sym·.guess·.ico)의 CSS 가 정한다 — 보드 32px, 정보 행·메모 격자는 그 자리 크기 그대로 */
function symSvgHtml(key){
  const g=SYM_SVG[key]; if(!g) return "";
  /* data-sym 은 **이미 정해진 그 기호가 무엇인가**만 적는다 — 이 함수는 정체가 공개됐거나(known) 뷰어가 스스로 적은 추측일 때만 불린다.
     미공개 상대 말은 애초에 호출 경로에 들어오지 않으므로 이 속성이 새 정보를 새게 하지 않는다 (테스트·QA 의 식별자). */
  return `<svg class="symv" data-sym="${key}" viewBox="0 0 32 32" focusable="false" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
}
/* 기호 1개를 그린다 — 전용 도형이 있으면 도형(폰트 무관), 없으면 그릴 수 있는 이모지, 그것도 없으면 같은 뜻의 짧은 텍스트.
   확정·추측이 같은 규칙을 쓴다: 정체를 밝히는 것은 호출 여부이지 이 함수가 아니다 (미공개 말은 애초에 호출되지 않는다). */
function glyphSpan(key,cls){
  const o=memoOpt(key); if(!o) return "";
  if(SYM_SVG[key]) return `<span class="${cls} sv" aria-hidden="true">${symSvgHtml(key)}</span>`;
  return glyphOk(o.emoji)?`<span class="${cls}" aria-hidden="true">${o.emoji}</span>`
                         :`<span class="${cls} ng">${memoShort(key)}</span>`;
}
function pieceEmoji(p){ // 기호 문자 자체 (테스트·라벨용)
  if(!p) return "";
  if(p.type==="minion") return p.element?memoEmoji("minion_"+p.element):"";
  return memoEmoji(p.type); // king·ally·bomb·trap 는 MEMO_OPTS 키와 이름이 같다
}
function pieceMemoKey(p){ return !p?null:(p.type==="minion"?(p.element?"minion_"+p.element:null):(memoOpt(p.type)?p.type:null)); }
/* 확정(known) 말의 얼굴 — 하수인은 종 아이콘, 그 외는 같은 메모 기호. 자산이 없거나 실패하면 현행 텍스트로 복귀한다 (규격 14.6.4) */
function pcFaceHtml(p){
  const dir=artDirOf(p);
  if(artOk(dir)) return `<img class="icon" src="${artUrl(dir,"icon.png")}" alt="" aria-hidden="true" width="32" height="32" onerror="artFail('${dir}',this)">`;
  /* #124: 왕·동료도 보드에서 그 정체 역할로 보인다 (Venus 6장 AC-A5 정정). 자산이 로드된 뒤에만 그림이고 그 전에는 아래 이모지 그대로다.
     이 파생본은 1254px 원본을 단순 축소한 **픽셀 스타일 아트**이고 하수인처럼 32px 도트로 그린 원본이 아니다.
     그래서 32px 표시에는 최근접 확대(pixelated) 대신 브라우저 보간을 쓴다 (.pc .icon.leader) — 하수인 렌더 계약은 그대로다 */
  const ld=leaderArtDir(p);
  if(ld) return `<img class="icon leader" src="${artUrl(ld,LEADER_FILES.icon)}" alt="" aria-hidden="true" width="32" height="32" onerror="artFail('${ld}',this)">`;
  const key=p.type!=="minion"?pieceMemoKey(p):null;
  if(key) return `<span class="face">${glyphSpan(key,"sym")}</span>`;
  return `<span class="face"><span class="nm">${p.type==="minion"&&p.name?p.name:(TYPE_KO[p.type]||"?")}</span></span>`;
}
/* 정보 행 — 원소 기호(하수인만) + 현재 HP(하수인·동료·왕만). 폭탄·함정은 전체 공개에서도 HP 를 표시하지 않는다 (규격 7.8·7.9) */
function pcInfoHtml(p){
  const key=p.type==="minion"?pieceMemoKey(p):null;
  const hp=(p.type==="minion"||p.type==="ally"||p.type==="king")?String(p.hp):"";
  if(!key&&!hp) return "";
  return `<span class="info">${key?glyphSpan(key,"sym"):""}${hp?`<span class="hp">${hp}</span>`:""}</span>`;
}
/* 말판과 배치 트레이가 같은 함수를 쓴다 — 한쪽만 아이콘으로 바뀌는 불일치가 생기지 않는다 (규격 7.10.4) */
function pcBodyHtml(p){return pcFaceHtml(p)+pcInfoHtml(p);}
function pcLabel(p){ // 확정 말의 접근성 문구 — 이미 공개된 값만 쓴다
  return (p.type==="minion"&&p.name?p.name:TYPE_KO[p.type])+(p.type==="minion"&&p.element?" · "+ELEM_KO[p.element]:"")
    +((p.type==="minion"||p.type==="ally"||p.type==="king")?" · HP "+p.hp:"");
}
