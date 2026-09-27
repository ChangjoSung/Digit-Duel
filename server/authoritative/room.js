'use strict';
// 룸 상태 기계 — analysis.md §2.3(생명주기)·§2.4(자격)·§2.5(명령)·§2.6(화이트리스트)의 구현.
// 게임 규칙 자체(이동·전투·상성·스킬·아이템·폭탄·함정·밀어내기·탐색·텔레포트·도망·기권)는 재구현하지 않고
// demo/index.html의 실제 제품 스크립트(engine.js가 서버 소유 헤드리스 런타임 runtime.js로 구동)를 그대로 쓴다.
//
// v4 (Saturn REVISE msg_9a62b8728ecf) — 무엇이 바뀌었나:
//
// 1) **좌석별 락스텝 엔진 쌍.** v3는 엔진 하나로 두 좌석을 섬기면서 NET.me를 접근자로 속였다(installModalUnmaskShim).
//    그 결과 (a) 로그 문구가 행동자 시점으로 생성돼 공용 S.log에 행동자 자기 말의 정체(idLabel)가 실려 상대에게
//    나갔고(예: 회복 틱 "🌿 <이름·속성> HP +n"), (b) "나/상대" 인칭이 뒤섞였다. 원래 게임의 온라인 모델은 두
//    클라이언트가 **같은 시드·같은 입력**으로 각자 자기 시점(NET.me)의 엔진을 돌리는 락스텝이고, 규칙 상태는
//    시점과 무관하게 일치하도록 설계·검증돼 있다(demo/test/regression/smoke_online_sync.js 퍼즈). 그래서 서버는
//    좌석마다 NET.me를 고정한 엔진을 하나씩 두고(`engines[0]`·`engines[1]`) 모든 입력을 둘 다에 적용한다.
//    좌석 뷰는 그 좌석의 엔진에서 읽고(로그·전투 로그·모달 문구가 원본 그대로 그 좌석 시점),
//    판정은 `engines[0]`에서 한다. 매 입력 후 두 엔진의 규칙 상태 요약(lockstepDigest)을 비교해 다르면
//    fail-closed로 룸을 VOID 처리한다. NET.me 접근자 트릭은 폐기했다.
//
// 2) **명시적 합법성 판정(_authorize).** UI의 버튼 활성 조건·엔진 코어 가드에 기대지 않고, 서버가 phase·행위자·
//    소유권·자원을 직접 확인한 뒤에만 applyAction을 부른다. 우선순위는 원본 입력 모델과 같다:
//      대기 중인 동기화 모달 > 도망 교환 선택(fleePick) > 전투 > 보드 플레이.
//    - 모달: NET.syncModal.owner(방어자일 수 있다)만, 같은 seq·범위 안·disabled가 아닌 버튼 인덱스만. 모달이
//      떠 있는 동안 다른 모든 행동은 거부한다(v3는 netActor/current로 인가해 공격자가 방어자 선택을 대신했다).
//    - 전투: actorOfPhase() 쪽 소유자만, 전투 어휘(act·item·ball·flee·pass·pkgOpen)만. skipMain·tele·endTurn 등
//      보드 행동은 거부한다(v3는 방어자 차례의 skipMain이 공격자 mainUsed를 바꿨다).
//    - 보드: S.current만. skipMain/tele/search/heal/endTurn 각각 원본 UI·코어와 같은 조건.
//    거부된 입력은 엔진에 닿지 않으므로 상태·revision이 변하지 않는다. 판정을 통과했는데도 상태가 전혀 안 바뀐
//    입력(예: 이미 선택된 말 재클릭)은 성공이지만 revision을 올리지 않는다(noop).
//
// 3) 배치 검증은 준비 상태를 바꾸기 전에 서버가 한다(applyNetSetup의 "손상 → 무작위 대체"에 기대지 않는다).
// 4) 뷰의 자기 말 별칭(u-…)을 heal/fleeSwap 입력에서 실제 id로 되돌린다. 원시 엔진 id는 받지 않는다.
// 5) 종료 전이(_finalize)는 revision을 정확히 한 번 올리고, 시작 전 종료 뷰는 phase를 'canceled'|'void'|'closed'로 준다.
const crypto = require('crypto');
const { SeatCredential } = require('./seatToken');
const { createEngine, withEngine } = require('./engine');

const DISCONNECT_GRACE_MS = 60 * 1000;
const DEDUP_TTL_MS = 120 * 1000;

const STATES = Object.freeze({
  OPEN: 'OPEN', SETUP: 'SETUP', IN_PROGRESS: 'IN_PROGRESS', FINISHED: 'FINISHED',
  CANCELED: 'CANCELED', VOID: 'VOID', CLOSED: 'CLOSED',
});
const TERMINAL_NO_BOARD = new Set([STATES.CANCELED, STATES.VOID, STATES.CLOSED]);

// 클라이언트가 온라인 경로에서 실제로 보내는 액션 어휘 그대로다 (demo/index.html applyAction switch).
const ACTION_TYPES = new Set([
  'cell', 'selTray', 'roster', 'auto', 'clear', 'setupDone', 'skipMain', 'search', 'tele',
  'endTurn', 'heal', 'fleeSwap', 'fleeSkip', 'resign', 'act', 'item', 'ball', 'flee', 'pass',
  'pkgOpen', 'modal',
  'shopBuy', 'shopRefresh', 'shopGood', 'shopSell', 'shopSwap', 'shopTicket', 'leaderEl', 'shopDone', 'bagPick', 'buffUse',
]);
/* #237 경제 어휘 — 상점(S01·정기)과 B08. 규칙 판정은 Core ecoReduce 한 곳이 하고, 서버는 좌석·단계·진열 번호·마감만 먼저 본다.
   shopTimeout 은 서버 시계만 낸다(회선 어휘가 아니다). 거래 요청은 전역 baseRevision 대신 **자기 진열 번호**로 낡음을 가린다:
   동시 상점에서 상대 거래가 revision 을 올려도 내 진열은 그대로이기 때문이다(GDD-23 2.4). */
const ECO_VERBS = new Set(['shopBuy', 'shopRefresh', 'shopGood', 'shopSell', 'shopSwap', 'shopTicket', 'leaderEl', 'shopDone', 'bagPick']);
// 배치 화면 전용 코어(autoPlaceCore/clearPlaceCore/toggleRosterCore/setupDoneCore/selTrayCore)는 S.phase 가드가 없어
// 매치 중에 닿으면 보드를 붕괴시킨다. 이 서버는 배치를 `setup` 명령으로 받으므로 매치 중에는 전부 거부한다.
const SETUP_ONLY_ACTIONS = new Set(['auto', 'clear', 'roster', 'setupDone', 'selTray']);
const ACT_KINDS = new Set(['basic', 'skill', 'common']); // __actCore의 레거시 문자열 kind (왕·동료 본체 UI가 'basic'/'skill'을 보낸다)
const PKG_KINDS = new Set(['itemGift', 'battleBuff']);
/* #245 회선을 타는 전투 어휘 — demo/js/network.js BATTLE_CMDS 와 같은 목록이다. 확정(pkgPick)은 모달 중계를 타므로 여기 없다. */
const BATTLE_CMDS = new Set(['act', 'item', 'ball', 'flee', 'pass', 'pkgOpen', 'buffUse']); // #237 buffUse — 정기 상점에서 산 전투 버프
const BF_KEYS = ['side', 'seq', 'round', 'phase'];
const RECRUIT_SWAP_STAGES = new Set(['skill', 'target', 'slot']); // demo/index.html recruitModal 의 기술 교체 단계 (#234 닫힘)
const ROSTER_SIZE = 6; // applyNetSetup: data.roster.length===6

function now() { return Date.now(); }
// #237 상대 HP 100 눈금 — 최대 HP(=등급)를 지우고 비율만 남긴다. 올림이라 살아 있는 말(HP≥1)은 1 이상이다.
function pct100(v, max) { return Math.ceil(((Number(v) || 0) * 100) / (Number(max) || 1)); }
/* #237 상대가 주어인 전투 문구의 HP 계열 수치(피해·회복·방어막·흡수·유효·해일 X·버틴 HP·과부하 상한)를 100 눈금으로 바꾼다.
   라운드·횟수·퍼센트·쿨·차수·좌석(2R·1회·15%·⌛0·3차·P1)은 HP 와 무관한 규칙 상수라 그대로 둔다. max 가 없으면(주어 불명) '?'.
   바꾼 수치에는 '%'를 붙여 비율임을 표시한다 — HP_NUM 이 '%' 앞 수치를 건너뛰므로 다시 통과해도 두 번 바뀌지 않는다. */
const HP_NUM = /(^|[^⌛⭐P\d.])(\d+)(?![\d.]|\s*(?:%|R|회|차|턴|라운드|칸|개|명|마리|초|·\s*\d+\s*차))/g;
function scaleText(txt, max) { return String(txt).replace(HP_NUM, (all, pre, n) => pre + (max ? pct100(n, max) + '%' : '?')); }
// 전투 문구 한 줄의 주어(그 수치가 가리키는 전투원 쪽) — bmsg 가 함께 싣는 표시 fx 의 쪽 표기에서 읽는다.
function fxSubject(fx) {
  if (!fx) return null;
  return (fx.hp && fx.hp.side) || (fx.float && fx.float.side) || (fx.st && fx.st.side) || fx.ko || fx.shake || null;
}
function err(reason) { return { ok: false, reason }; }

/* 겨냥 프레임 — 클라이언트가 전투 어휘에 싣는 값과 같은 모양(demo/js/core.js battleActionFrame). 상태만 읽는다. */
function battleFrame(T) {
  const B = T.S && T.S.battle;
  return B ? { side: T.actorOfPhase(), seq: B.actSeq || 0, round: B.round, phase: B.phase } : null;
}
/* 회선에서 온 프레임은 **온전하고 정확해야** 한다 — 없음·부분·여분 키·배열·문자열 숫자는 나머지 값이 맞아도 거부다
   (demo/js/core.js bfShapeOk + battleCmdCtx 와 같은 판정). 네 값을 === 로만 보므로 재귀·형변환이 없다. */
function frameMatches(w, want) {
  return !!want && !!w && typeof w === 'object' && !Array.isArray(w)
    && Object.keys(w).length === BF_KEYS.length && BF_KEYS.every((k) => w[k] === want[k]);
}

// ===== 배치 검증용 카탈로그 — 엔진 하나를 프로세스당 한 번만 띄워 상수만 읽는다 =====
let CATALOG = null;
function catalog() {
  if (CATALOG) return CATALOG;
  const T = createEngine();
  withEngine(T, () => { T.newGame('pvp'); });
  const m = /const\s+COLS\s*=\s*(\d+)\s*,\s*ROWS\s*=\s*(\d+)/.exec(T.html);
  if (!m) throw new Error('demo/index.html에서 COLS/ROWS 상수를 찾지 못함 — 배치 검증 계약 변경 가능성');
  CATALOG = Object.freeze({
    rosterIds: new Set(T.ROSTER.map((r) => r.id)),
    zone0: new Set(T.zoneOf(0)),
    cols: Number(m[1]),
    rows: Number(m[2]),
    piecesPerSeat: T.S.pieces.filter((p) => p.owner === 0).length,
  });
  return CATALOG;
}

// ===== 락스텝 규칙 상태 요약 — 시점(NET.me)과 무관해야 하는 필드만 =====
// smoke_online_sync.js gameCanon/canon을 기준으로 전투원·패키지·텔레포트 횟수·도망 선택까지 넓혔다.
// 로그(S.log·B.blog)·연출·메모 같은 시점 의존 표시 상태는 넣지 않는다.
//
// #233 (GDD-23 3·4장) — 이 요약은 **서버 안에서만** 쓰이고 어떤 좌석 프레임에도 실리지 않는다(정보 경계 무관).
// 그래서 새 전투 계약이 만든 규칙 상태는 빠짐없이 넣는다. 특히 resolveHit 가 이제 한 타격에 rand() 를 최대 3회
// (① 회피 · ③ 분산 · ⑦ 치명) 소비하므로, 두 좌석 엔진의 난수 소비가 한 번이라도 어긋나면 이후 모든 판정이 갈린다 —
// 그 어긋남이 상태에 드러나는 지점(방어막 층 순서 · 균열/경화 잔여 · 예고 피해 대기열)을 전부 덮지 않으면
// fail-closed VOID 가 발동하지 못하고 두 좌석이 조용히 다른 경기를 보게 된다.
// #234 — demo/js/data.js V2_TIMED 와 같은 목록. 런타임 네임스페이스에 V2_TIMED 가 노출돼 있어도 **일부러 읽지 않는다**:
// 요약 키 순서는 두 좌석 엔진을 비교하는 경계 계약이라 엔진 값과 함께 조용히 따라 움직이면 안 된다(엔진이 바뀌면
// 양쪽 요약이 똑같이 바뀌어 드리프트가 가려진다). 여기 고정해 두면 test-issue241-boundary.js S1 이 서버 목록과
// 엔진 V2_TIMED 의 순서까지 같은지 대조해 불일치를 실패로 만든다.
// #241 (CJ 승인 2026-09-17 스킬 정리) — spdDownR→evadeDownR(V1 회피율 감소) · mirrorR(R3)·burrowR·fortressR(단순화) 삭제. 순서도 엔진과 같다.
const V2_TIMED_KEYS = Object.freeze(['absorbR', 'spdBuffR', 'evadeDownR', 'healCutR', 'vanguardTurn', 'retaliateBurnR',
  'reflectR', 'counterR', 'overloadR', 'nullHitR', 'sandStormR', 'ringR', 'enduredR', 'breedR', 'immuneShockR', 'mossR']);
function lockstepDigest(T) {
  const S = T.S;
  const B = S.battle;
  /* #245 의도적 digest 스키마 변경 — 종전 `modalSeq`/`sync`는 ui.js·network.js 가 서버에 실려 있을 때의
     **표시 계층 부산물**(NET.modalSeq 와 NET.syncModal.fns 개수)이었다. 그 두 파일이 권위 런타임에서 빠지면서
     같은 사실을 Core 결정 상태가 직접 들고 있다: 출전 보류 결정(S.entryPick) · 패키지 표(S.battle.pkgSel) ·
     탐색 보상 단계(S.recruit). 요약이 덮는 범위는 **넓어졌다** — 종전에는 버튼 개수만 봤지만 이제 어느 단계·
     어느 표인지까지 본다. 두 좌석 엔진이 다른 화면에 서 있으면 그 자리에서 갈린다(fail-closed VOID). */
  const EP = S.entryPick, PS = B && B.pkgSel;
  // #233 — 전투원이 지니는 8스탯(3.2·3.3·3.5). 등급 성장(3.4)과 포획·예비 승계로 값이 갈릴 수 있어 함께 본다.
  const stats = (f) => [f.def || 0, f.spd || 0, f.dodge || 0, f.crit || 0, f.statusPct || 0,
    f.grade === undefined ? null : f.grade];
  /* #234 (GDD-23 6장 스킬 64종) — 새 전투 상태. Mars 보고서 11.1 목록 전부. 뷰에는 싣지 않는다(서버 내부 전용).
     · 난수 소비를 바꾸는 것(최우선): sandStormR(부여 확률 절반) · onceUsed(전투당 1회 —
       합법 슬롯 집합이 바뀌어 선택 분기) · sleepNext · nullifyNext(행동 전체 무효). 한쪽 좌석에만 남으면 그 행동의 rand() 호출
       수가 어긋나 이후 모든 판정이 갈린다.
     · 지속 카운터는 X 와 XFresh(5.6 부여 라운드 제외 게이트)를 **둘 다** 본다 — #233 의 다른 게이트와 같은 이유.
     · 세기·소유자는 지속과 따로 본다(지속이 0 이 될 때 세기를 내리는 엔진 모양이 같다).
     · mitigated 는 소수 누계라 반올림하지 않고 원값 그대로 넣는다 — 두 엔진은 같은 연산 순서로 같은 double 을 만든다.
     엔진에 필드가 없으면(초기화 전 픽스처) 0/false/null 로 떨어진다 — 서버는 없는 필드를 만들지 않는다.
     목록 누락은 test-issue234-boundary.js 가 demo/index.html 의 V2_TIMED·V2_TIMED_MAG·resetV2 본문을 읽어 잡는다.
     #241 (CJ 승인 2026-09-17) — 엔진에서 삭제된 필드는 요약에서도 뺀다(counterRound·burnBonus·nextDmgUp·nextFlat·nextShockForce·
     sandWind·sporePending·permShockR·permShockBy). 남겨 두면 항상 0 이라 해롭지는 않지만, 목록이 엔진과 1:1 이어야 드리프트 검사가
     "요약에 있는데 엔진에 없는 키"를 설명 없이 끌고 다니지 않는다. 새로 넣는 것:
     · 해일 예고 표식(R2): tideMark(사용 순간 확정한 X) · tideBy(부여자 — 발동 시 유효 피해 기록 대상) · tideHeld(방어 효과로 보류 중).
       판정은 결정론이지만 X 가 한 좌석만 다르면 "HP+방어막 ≤ X" 성립 행동이 갈려 즉사 여부가 바로 갈린다.
     · cdUpFresh(Q3): 이번 라운드에 ⌛0 에서 +1 된 슬롯 집합. 라운드 종료 감소가 이 슬롯을 1 아래로 내리지 않으므로 한 좌석에만
       서 있으면 다음 라운드의 합법 슬롯 집합이 갈린다 — XFresh 게이트와 같은 이유로 본다. */
  const flags = (o) => (o && typeof o === 'object' ? Object.keys(o).filter((k) => o[k]).sort() : []);
  const num = (v) => (typeof v === 'number' ? v : (v ? 1 : 0));
  const timed = (f) => V2_TIMED_KEYS.map((k) => [num(f[k]), !!f[k + 'Fresh']]);
  const v2 = (f) => [
    timed(f),
    // 세기·소유자
    num(f.absorbPct), num(f.spdBuff), num(f.evadeDown), num(f.healCut), num(f.nullHitN), num(f.mossPct),
    f.mossBy === undefined ? null : f.mossBy, f.breedBy === undefined ? null : f.breedBy,
    num(f.burnMag), !!f.burnNoCure, num(f.weakenMag),
    // 다음 피해 스킬 1회성 (critForce 는 위에서 따로 본다)
    num(f.nextPowUp),
    // 난수·행동 분기
    !!f.sleepNext, !!f.nullifyNext, flags(f.onceUsed),
    // 전투 누계(위력에 들어감) · 지하 매복 조건
    num(f.shocksDealt), num(f.mitigated), num(f.healTotal), num(f.burrowRound), !!f.enduredUsed,
    !!f.fleeLock,
    // #241 R2 해일 예고 표식 · Q3 ⌛ 증가 Fresh 슬롯
    num(f.tideMark), f.tideBy === undefined ? null : f.tideBy, !!f.tideHeld, flags(f.cdUpFresh),
  ];
  const fighter = (f) => (f ? {
    hp: f.hp, maxHp: f.maxHp, shield: f.shield || 0, burn: f.burn || 0, weaken: f.weaken || 0, shock: f.shock || 0,
    cd: f.cd || 0, cds: f.cds || null, dmgCut: f.dmgCut || 0, focusCharge: !!f.focusCharge, vulnMark: !!f.vulnMark,
    powerBuff: !!f.powerBuff, fleeBoost: !!f.fleeBoost, revealedSkills: f.revealedSkills || null,
    // #233 4.5 — 균열·경화·회피 증가·가하는 피해 증가. 뷰에 싣는 범위와 무관하게 전부 본다.
    // **세기(값)와 남은 지속(R)은 따로 본다** — 엔진은 지속이 0이 될 때 비로소 세기를 0으로 내린다
    // (nextPhase: evadeBuffR-- → 0 이면 evadeBuff=0). 세기만 보면 "회피 +10% 가 1R 남음"과 "3R 남음"이
    // 같은 상태로 읽혀 다음 라운드부터 갈라지는 두 엔진을 잡지 못한다.
    crack: f.crack || 0, harden: f.harden || 0, hardenPct: f.hardenPct || 0,
    evadeBuff: f.evadeBuff || 0, evadeBuffR: f.evadeBuffR || 0,
    dmgUpBuff: f.dmgUpBuff || 0, dmgUpBuffR: f.dmgUpBuffR || 0,
    /* #233 (GDD-23 5.6 적용·지속) — "부여된 라운드는 세지 않는다"를 구현하는 1회용 게이트.
       엔진 nextPhase 는 `if(f.XFresh) f.XFresh=false; else if(f.X>0) f.X--;` 로 감쇠를 한 라운드 미룬다.
       잔여 라운드가 같아도 게이트가 서 있는 쪽과 아닌 쪽은 **다음 라운드 종료에서 값이 갈린다** — 게이트를
       빼면 그 한 라운드 차이를 요약이 못 본다. shockFresh 는 #233 이전부터 있었으나 요약에 없었고(좌석
       프레임에는 이미 실린다), #233 이 같은 모양의 게이트를 넷으로 늘려 구조적 구멍이 커져 함께 메운다. */
    shockFresh: !!f.shockFresh, crackFresh: !!f.crackFresh, hardenFresh: !!f.hardenFresh,
    evadeBuffRFresh: !!f.evadeBuffRFresh, dmgUpBuffRFresh: !!f.dmgUpBuffRFresh,
    /* 화상 게이트 (GDD-23 4.7 "부여된 라운드를 세지 않으므로 **다음 2개 라운드의 종료 시에 각 5**").
       화상은 위 넷과 **모양이 다르다** — 라운드 종료에 감소만 하는 것이 아니라 **피해도 준다**. 그래서 게이트는
       부여 라운드의 피해와 감소를 **둘 다** 건너뛰어야 R1 부여 → R2·R3 종료 피해가 나온다(감소에만 걸면 R1·R2·R3
       3회 피해가 된다). 게이트가 한쪽 좌석에만 서 있으면 **그 라운드에 HP 가 갈린다** — 다른 게이트들은 잔여
       라운드만 어긋나지만 이쪽은 곧바로 피해 유무가 달라지므로 요약에서 빠지면 손해가 더 크다.
       PD 결정으로 Mars 가 엔진에 구현 중이고(이 워크트리 시점 미반영), 이름은 다른 넷과 같은 모양을 제안해
       확정 요청했다(msg_90869a03d08d). 엔진에 아직 없으면 항상 false 로 떨어져 종전과 같은 감지력을 유지할
       뿐 깨지지 않는다 — 서버는 없는 필드를 만들지 않고, 붙는 순간 감지력만 올라간다. */
    burnFresh: !!f.burnFresh,
    /* #233 (GDD-23 3.2) 확정 효과 — 이 둘은 **난수 소비 자체를 바꾼다.** resolveHit 는 ① 회피와 ⑦ 치명에서
       각각 rand() 를 쓰는데, dodgeForce/critForce 가 서 있으면 그 판정을 건너뛰고 플래그를 소모한다
       (demo/index.html resolveHit: `if(opp.dodgeForce){evaded=true; opp.dodgeForce=false;}`).
       한쪽 좌석에만 플래그가 남아 있으면 그 타격에서 rand() 호출 수가 어긋나 **이후 모든 판정이 갈린다** —
       요약에서 가장 빠뜨리면 안 되는 두 필드다. */
    critForce: !!f.critForce, dodgeForce: !!f.dodgeForce,
    // #233 (GDD-23 4.4) 순서 효과 — decideFirstSide 가 fighterOrderCat 으로 읽어 선턴을 가른다.
    // #234 전까지 이를 켜는 기술은 없지만 엔진 계약이 이미 읽고 있으므로 요약도 함께 덮는다.
    // #234 — vanguardTurn 은 boolean → **남은 라운드 숫자**(V2_TIMED)로 바뀌었다. `!!` 로 접으면 1R 과 2R 이 같게 읽힌다.
    vanguardTurn: typeof f.vanguardTurn === 'number' ? f.vanguardTurn : (f.vanguardTurn ? 1 : 0),
    // #233 3.2 — 방어막 "층". 합계(f.shield)만 보면 층 경계가 다른 두 상태를 같다고 판정한다: 다음 타격이 깎는
    // 층 수(깨짐 판정)와 남는 잔량이 달라지므로 순서와 획득원을 그대로 넣는다.
    shieldLayers: (f.shieldLayers || []).map((l) => [l.amt, l.src]),
    /* #233 4.3 — 예고·지연 피해 대기열. 콜백(run)은 직렬화할 수 없다.
       남은 라운드만 보면 **같은 라운드에 예약된 서로 다른 예고 피해 둘을 구분하지 못한다** — 한쪽 좌석이
       '해일 예고'를, 다른 쪽이 다른 지연 피해를 2R 뒤로 걸어 두면 요약이 같게 나오고 발동 라운드에 가서야
       갈린다(그때는 이미 요약으로 잡을 수 없는 HP 차이다). 그래서 항목의 안정 식별자(tag)를 함께 읽는다.
       tag 는 **엔진이 붙여 주는 값**이고(Mars 소유 계약, msg_dd8111ac4d2c 로 제안·조회) 아직 없으면 null 로
       떨어져 종전과 같은 감지력을 유지한다 — 서버는 없는 필드를 만들지 않고, 붙는 순간 감지력만 올라간다. */
    // #241 R2 — 해일 예고가 시간 예약(atStart)에서 조건 표식(v2.tideMark)으로 바뀌어 atStart 는 엔진에서 폐지됐다(호출처 0).
    // 대기열 자체는 #233 계약(scheduleDelayed/tickDelayed)으로 남으므로 roundsLeft·tag 는 계속 본다.
    pendingFx: (f.pendingFx || []).map((e) => [e.roundsLeft, e.tag === undefined ? null : e.tag]),
    // 전투 판정용 유효 피해 흡수 누계(BAL.absorbCapPct). 규칙 자체는 현행이지만 #233의 층 소모가 이 값의 증가
    // 경로를 바꿨고, 원래도 요약에서 빠져 있어 누적 차이를 못 잡았다 — 여기서 함께 메운다.
    absorbed: f.absorbed || 0,
    // 화상 부여자(속성 반격·왕국 효과가 읽는다)·전투 버프 — #234 이전부터 규칙 상태였으나 요약에 없었다.
    burnBy: f.burnBy === undefined ? null : f.burnBy, atkBuff: !!f.atkBuff,
    /* #234 REVISE 2차 (CJ 결정 2026-09-17) 사신의 낫 전투를 넘는 봉인 — 전투원 객체 단위 0/1/2. slotUsable→reaperWhy 가
       읽어 합법 슬롯 집합을 가른다. resetV2 목록 밖이라 전투가 끝나도 남으므로 아래 말·예비 요약에도 따로 넣는다. */
    reaperSeal: num(f.reaperSeal),
    /* #235 시너지 가산칸 — 참전 확정 순간 한 번 굳고 전투 내내 고정이다. 기본 스탯(stats)은 그대로이므로
       가산칸이 한 좌석만 갈리면 stats 는 같은데 피해·회피·선턴·상태 확률이 전부 달라진다. 왕국 효과(synEl)는
       그 전투원이 스킬마다 굴리는 1판정의 종류·확률·수치라 rand 소비까지 바꾼다 — 같은 이유로 함께 본다. */
    syn: [num(f.synAtk), num(f.synDef), num(f.synSpd), num(f.synDodge), num(f.synCrit), num(f.synStatusPct),
      f.synEl == null ? null : (typeof f.synEl === 'object'
        ? Object.keys(f.synEl).sort().map((k) => [k, f.synEl[k]]) // 키를 정해 두지 않는다 — 효과 표가 칸을 늘리면 그 차이도 그대로 갈린다
        : f.synEl)],
    v2: v2(f),
    stats: stats(f),
  } : null);
  return JSON.stringify({
    phase: S.phase, current: S.current, turn: S.turnCount, mainUsed: S.mainUsed, battlesUsed: S.battlesUsed,
    sel: S.selected ? (S.selected.tray ? 'tray' : S.selected.id) : null,
    forced: (S.forcedTargets || []).slice(), forcedQueue: (S.forcedQueue || []).length,
    tele: S.teleport ? { stage: S.teleport.stage, piece: S.teleport.piece ? S.teleport.piece.id : null } : null,
    moved: S.movedPiece ? S.movedPiece.id : null,
    battle: B ? {
      att: B.attP.id, def: B.defP.id, round: B.round, phase: B.phase, actSeq: B.actSeq || 0, maxRounds: B.maxRounds || null,
      /* #233 (GDD-23 4.4) — 선턴은 이제 **라운드 시작 시 한 번 굳는 저장 상태**다(B.firstSide, startRounds·nextPhase).
         종전에는 순서가 round·phase·양쪽 shock 로 매 호출 재계산되는 파생값이라 요약에 따로 넣을 게 없었지만,
         지금은 굳은 시점의 spd·grade·순서 효과를 담은 상태라서 **두 좌석이 서로 다른 선턴을 굳혀도 다른 필드는
         전부 같을 수 있다.** 그러면 그 라운드부터 양쪽이 서로 다른 행위자에게 행동권을 주는데 요약이 같게 나온다. */
      firstSide: B.firstSide || null,
      /* #234 REVISE 4차 (CJ 결정 2026-09-17 "속도는 첫 라운드 선턴 판별만") — 2라운드부터 decideFirstSide 는 속도를 다시
         보지 않고 B.firstSideR1(1라운드 선턴 측)·round 홀짝·순서 효과로만 교대 순서를 정한다. 그래서 R1 기록이 좌석마다
         갈리면 R2 진입 전까지 firstSide 를 포함한 다른 필드가 전부 같을 수 있다 — 교대 기준 자체를 요약에 넣는다. */
      firstSideR1: B.firstSideR1 || null,
      fa: fighter(B.fa), fd: fighter(B.fd), itemRoundA: !!B.itemRoundA, itemRoundD: !!B.itemRoundD,
      ballThrowA: !!B.ballThrowA, ballThrowD: !!B.ballThrowD, buffA: B.buffA || null, buffD: B.buffD || null,
      // #234 4.3 반사·반격 "한 행동 1회" 게이트 — 마지막으로 발동한 actSeq. 한쪽만 서 있으면 같은 행동의 두 번째 반사가 갈린다.
      reflectSeq: B.reflectSeq === undefined ? null : B.reflectSeq,
      /* #241 R1 (CJ 설계) 번개 꼬리 추가 공격 단계 — 같은 행동자가 한 번 더 고르는 상태. 한 좌석만 서 있으면 그 좌석은 차례를 넘기지
         않고 다른 좌석은 넘겨 행위자 자체가 갈린다. allowed(합법 슬롯)·saved(턴 끝에 되돌릴 2·3차 ⌛ 사본)·tailSlot 모두 규칙 상태다.
         B.actSeq 는 추가 공격 시작에도 오르며 위 actSeq 가 이미 본다. */
      bonus: B.bonus ? [B.bonus.side, B.bonus.stage, (B.bonus.allowed || []).slice(),
        Object.keys(B.bonus.saved || {}).sort().map((k) => [k, B.bonus.saved[k]]), B.bonus.tailSlot === undefined ? null : B.bonus.tailSlot] : null,
      /* #245 패키지 개봉 인가 표 — 확정(pkgPick)은 모달 중계라 회선 프레임이 없고 이 표가 곧 그 확정의 겨냥 문맥이자
         재고를 움직일 권한이다. 발급 번호(id)까지 본다: 같은 종류를 같은 문맥에서 다시 열면 나머지 여섯 값이 전부 같아
         id 가 빠지면 서로 다른 두 표를 같은 상태로 읽는다. 요약에 없으면 fail-closed VOID 가 발동하지 못한다.
         발급 카운터(S.pkgSeq — #245 REVISE 4차로 전투가 아니라 **경기 단위**가 됐다)는 **넣지 않는다** — 표 없이
         카운터만 갈린 상태는 아직 아무 인가도 아니고, 그 차이는 다음 개봉이 발급하는 id 에서 곧바로 드러나 위
         pkgSel 이 잡는다. 분리 전 원본에 없는 필드인 것도 그대로라, 넣으면 smoke_issue245 의 버전 대조가 — 이제는
         전투가 끝나도 경기 내내 남는 값이라 더 넓게 — 동작은 같은데 값만 다르다고 어긋난다. */
      pkgSel: B.pkgSel ? [B.pkgSel.kind, B.pkgSel.owner, B.pkgSel.side, B.pkgSel.seq, B.pkgSel.round, B.pkgSel.phase,
        B.pkgSel.id === undefined ? null : B.pkgSel.id] : null,
      /* #235 참전 확정 순간의 시너지 스냅샷 원본(좌석별 속성·타입 칸 수와 사망 칸 수). 두 좌석 엔진이 다른 보드를
         들고 있으면 여기서 바로 갈린다 — fail-closed VOID 의 자리다. **요약은 서버 안에서만 비교하는 값이고
         좌석 뷰(toSeatView)로는 나가지 않는다**: 상대 칸 수는 상대의 로스터 속성·아키타입 구성을 그대로 역산해
         주므로 GDD-23 7.9 의 소유자 전용 경계에 속한다. */
      syn: B.syn ? [0, 1].map((q) => (B.syn[q]
        ? [Object.keys(B.syn[q].el).sort().map((k) => [k, B.syn[q].el[k]]),
          Object.keys(B.syn[q].arch).sort().map((k) => [k, B.syn[q].arch[k]]), B.syn[q].dead]
        : null)) : null,
    } : null,
    fleePick: S.fleePick ? { owner: S.fleePick.owner, cands: S.fleePick.cands.slice(), token: S.fleePick.token } : null,
    events: (S.events || []).map((e) => [e.r, e.c, e.kind, !!e.consumed]),
    /* #245 (Saturn REVISE) 탐색 보상 선택의 **진행 중** 규칙 상태. 좌석별 엔진이 같은 프레임을 같은 순서로 적용하면
       전부 같아야 하는 결정론적 값이고(후보 종은 탐색 시점의 rand 1회, 토큰은 말 id + 게임 내 recruit 순번), 뷰에는
       싣지 않는 서버 내부 비교 전용이라 비공개 내용을 어디로도 내보내지 않는다.
       빠져 있으면 한 좌석만 단계를 전진했거나 다른 후보 종·다른 수령 말·다른 토큰을 들고 있어도 요약이 같게 나온다 —
       그 좌석의 다음 선택만 합법이 되거나(단계·토큰) 포획 결과가 곧바로 갈린다(종·수령 말·비용).
       searchEndSeq 는 완료 토큰이라 한쪽만 올라가면 종료 연출·턴 종료 재평가가 한 번 더 또는 덜 발화한다. */
    recruit: S.recruit ? [S.recruit.owner, S.recruit.pieceId, S.recruit.species, S.recruit.stage,
      S.recruit.skill === undefined ? null : S.recruit.skill,
      S.recruit.targetId === undefined ? null : S.recruit.targetId,
      S.recruit.recvId === undefined ? null : S.recruit.recvId,
      S.recruit.token === undefined ? null : S.recruit.token] : null,
    searchEndSeq: S.searchEndSeq || 0,
    // #233 — 예비(포획) 하수인도 승계한 아키타입 8스탯을 지니고 그대로 대리 출전한다(3.3). element/hp만 보면
    // 스탯 주입이 갈린 상태를 놓친다.
    balls: S.balls.slice(), inv: S.inv.map((a) => a.slice()),
    // #234 REVISE 2차 — 예비 하수인도 대리 출전 전투원 객체라 사신의 낫 봉인(reaperSeal)을 지닌다.
    reserve: S.reserve.map((x) => (x ? [x.element, x.hp, ...stats(x), num(x.reaperSeal)] : null)),
    pkgs: S.pkgs.map((p) => Object.assign({}, p)), teleUsed: (S.teleUsed || []).slice(),
    traces: S.traces.map((t) => [...t].sort()), tempReveal: [...(S.tempReveal || [])].sort(), winner: S.winner,
    modalSeq: T.__modal ? T.__modal.seq : 0,
    entryPick: EP ? [EP.attId, EP.defId, EP.stage, EP.A, EP.D] : null,
    pkgSel: PS ? [PS.kind, PS.owner, PS.id, PS.round, PS.side, PS.seq, PS.phase] : null,
    // #233 — 본체 출전이면 말 자체가 전투원이라 8스탯(3.3·3.5)과 등급이 말에 남는다. 포획 하수인(cap)도 같은
    // 스탯을 승계해 대리 출전하므로(3.3) cap 튜플도 함께 넓힌다.
    pieces: S.pieces.map((p) => [p.id, p.owner, p.type, p.rosterId, p.element, p.hp, p.maxHp, p.r, p.c, p.placed, p.alive,
      !!p.revealed, p.immobile, !!p.healing, p.skills || null, p.cds || null,
      p.cap ? [p.cap.element, p.cap.hp, ...stats(p.cap), num(p.cap.reaperSeal)] : null, ...stats(p),
      // #234 6.2·6.4 — 동료 종류는 스킬 세트(AS/SH)를, 속성 선택 여부는 미선택 규칙 재적용을, legend 는 전설 스킬·아키타입을 가른다.
      // 공개 기록(revealedSkills)은 syncLeaderSkills 가 칸 교체 때 걸러 내는 말 단위 상태라 함께 본다.
      p.allyKind === undefined ? null : p.allyKind, !!p.leaderElChosen, p.legend === undefined ? null : p.legend,
      p.revealedSkills || null,
      // #234 REVISE 2차 — 본체 출전 말의 사신의 낫 봉인. 전투 밖(보드)에서도 유지되어 다음 참전 전투의 합법 슬롯을 가른다.
      num(p.reaperSeal),
      // #237 말 단위 경제 칸 — 원장·신규 표시·교체 표식(GDD-23 7.5·7.6)
      num(p.paid), !!p.fresh, !!p.swapMark]),
    eco: ecoDigest(S.eco, stats, num),
  });
}

/* #237 경제 상태 전체(GDD-23 2.4 "서버가 재화·원장·판매 기록·진열·가방·필드·시너지 상태를 권위적으로 보관") — 두 좌석 엔진이
   같아야 하는 값이다. 서버 안에서만 비교하고 어떤 좌석 프레임에도 싣지 않는다(좌석 뷰는 _ecoView 가 소유자 몫만 고른다). */
function ecoDigest(E, stats, num) {
  if (!E) return null;
  const unit = (u) => [u.uid, u.rosterId || null, u.legend || null, u.element || null, u.hp, u.maxHp, num(u.paid), !!u.fresh, !!u.revealed,
    u.skills || null, u.cds || null, u.revealedSkills || null, num(u.reaperSeal), ...stats(u)];
  const sh = E.shop, bp = E.bagPick;
  return {
    coins: E.coins, tickets: E.tickets, buffInv: E.buffInv, soldHp: E.soldHp, unitSeq: E.unitSeq,
    bag: E.bag.map((b) => b.map(unit)),
    shop: sh ? [sh.kind, sh.turn, sh.seq, sh.slots, sh.sold, sh.done, sh.active, sh.next] : null,
    bagPick: bp ? [bp.owner, bp.token, unit(bp.unit)] : null,
  };
}

class Room {
  // seed: 테스트 재현용 엔진 시드 주입(단위 테스트 전용). lobby.createRoom은 절대 넘기지 않는다 — 운영 룸은 매치 시작 시
  // crypto 난수로 비밀 시드를 뽑는다. 어떤 네트워크 입력도 이 값에 닿지 않는다.
  // economy: #237 경제 경기(시작 상점 → 배치 → 정기 상점·B08). 로비가 넘기며, 끄면 종전 무료 로스터 경기다.
  // shopMs·bagPickMs: 테스트 재현용 시계 주입(graceMs 와 같은 관례). 기본은 Core 상수(ECO.shopSec·bagPickSec).
  constructor(roomId, { isPublic, epoch, graceMs, seed, economy, shopMs, bagPickMs, placeMs, actMs, battleMs }) {
    this.roomId = roomId;
    this.isPublic = !!isPublic;
    this.epoch = epoch;
    this.graceMs = graceMs != null ? graceMs : DISCONNECT_GRACE_MS;
    this._testSeed = Number.isInteger(seed) ? seed : null;
    this.economy = !!economy;
    this._clockMs = { shop: shopMs, bagPick: bagPickMs, place: placeMs, act: actMs, battle: battleMs }; // #263 배치 90초·행동 30초·전투 행동 60초 주입
    this._clock = [null, null]; // #237 좌석에 묶인 게임 시계 {key, left, deadline, handle, expired, owner} — 상점·배치·B08. 단절 중에는 left 만 들고 멈춘다
    /* #263 답할 좌석이 단계마다 바뀌는 두 시계는 방이 하나씩만 들고 owner 로 가리킨다 — 자리를 옮겨도 같은 시계라
       남은 시간이 보존된다(B02 출전 후보 선택은 방어자에게 넘어간다 · 전투 행동은 그 라운드의 행동자다). */
    this._act = null;    // 보드 행동 30초 (주 행동 · 출전 후보 선택(B02) · 도망 교환) — 한 턴에 하나
    this._pick = null;   // 강제 전투 대상 선택 30초 (T3, 적격 대상 2개 이상) — 도는 동안 _act 는 남은 시간을 지킨 채 멈춘다
    this._bclock = null; // 전투 행동 60초 (싸우기·가방·포획·도망)
    this.onUpdate = null;       // #237 시계 만료처럼 명령 없이 일어난 전이를 양 좌석에 알린다(server.js 가 푸시)
    this.state = STATES.OPEN;
    this.createdAt = now();
    this.inviteCode = null; // 비공개 룸만
    this.revision = 0;
    this.result = null; // {type:'WIN'|'FORFEIT'|'NO_CONTEST', winner, ...}
    this.dedup = new Map(); // `${seat}:${requestId}` -> {resp, ts}
    this.seats = [this._newSeat(), this._newSeat()];
    this.engines = null; // [좌석0 시점 엔진, 좌석1 시점 엔진] — 매치 시작 시점에만 생성
    this._aliasByPid = new Map(); // 실제 PID(생성 순서를 노출) → 불투명 별칭
    this._pidByAlias = new Map();
    this._consumedModalSeq = null;
    this.lastFault = null; // 엔진 장애 진단(서버 로그용 — 어떤 프레임에도 싣지 않는다)
    this.onFinalize = null;
    // #217 전투 표시 이벤트(fx) — 좌석별 최근 창(engine.js T.__fx 스냅샷). 엔진 자체가 아니라 Room에 둔다:
    // 경기 종료(_finalize)는 TERMINAL_NO_BOARD 전이에서 this.engines를 즉시 null로 비우므로(메모리 해제),
    // "종료 직후 battle=null에도 결과/마지막 타격 표시" 요구를 만족하려면 engines가 살아있는 마지막 순간
    // (_apply/_handleResign이 finalize를 부르기 直前)에 미리 떠 둬야 한다.
    this._fxCache = [{ firstSeq: null, lastSeq: 0, events: [] }, { firstSeq: null, lastSeq: 0, events: [] }];
  }

  // 판정용 정본 엔진 (테스트·기존 호출부 호환)
  get engine() { return this.engines ? this.engines[0] : null; }

  _newSeat() {
    return {
      credential: null, ws: null, connected: false,
      ready: false, placed: false, rawSetup: null, seq: 0,
      disconnectExpiry: null, disconnectTimer: null,
      shopTimedOut: false, // #263 S01 을 시간 초과로 끝낸 좌석 — 그 자리에서 자동 배치·준비까지 끝나므로 배치 90초를 받지 않는다
    };
  }

  // ===== 좌석 부여 =====

  openHostSeat(ws) {
    const seat = this.seats[0];
    seat.credential = new SeatCredential();
    this._attach(0, ws);
    return seat.credential.issue();
  }

  joinGuestSeat(ws) {
    if (this.state !== STATES.OPEN) return err('E_ROOM_NOT_FOUND');
    const seat = this.seats[1];
    seat.credential = new SeatCredential();
    this._attach(1, ws);
    this.state = STATES.SETUP;
    this.revision += 1; // OPEN → SETUP 전이 — 호스트가 받는 알림 room_state의 revision이 새로 선다
    const issued = seat.credential.issue();
    if (this.economy) {
      const opened = this._openEconomy();
      if (!opened.ok) return opened;
    }
    return { ok: true, issued };
  }

  resumeSeat(seatIndex, token, ws) {
    const seat = this.seats[seatIndex];
    if (!seat.credential) return err('E_SEAT_TOKEN_INVALID');
    if (TERMINAL_NO_BOARD.has(this.state)) return err('E_ROOM_CLOSED');
    if (seat.credential.classify(token) === 'invalid') return err('E_SEAT_TOKEN_INVALID');
    // 유예는 콜백이 아니라 기록된 만료 시각에 끝난다 — 콜백이 늦었어도 지난 만료를 먼저 확정하고,
    // 내 유예가 이미 지났으면 재개를 거부한다(토큰은 회전하지 않는다). 만료 콜백이 먼저 와 FINISHED 가 됐어도
    // 기록된 만료 시각으로 같은 판정을 한다 — 콜백 순서와 무관하게 만료 좌석은 결과 화면으로도 돌아오지 못한다.
    const t = now();
    this._settleLapsedGrace(t);
    const lapsed = !seat.connected && seat.disconnectExpiry != null && seat.disconnectExpiry <= t;
    if (lapsed || TERMINAL_NO_BOARD.has(this.state)) return err('E_ROOM_CLOSED');
    const issued = seat.credential.resume(token);
    if (!issued) return err('E_SEAT_TOKEN_INVALID');
    this._clearDisconnectTimer(seatIndex);
    this._attach(seatIndex, ws);
    seat.disconnectExpiry = null;
    this._syncClock(); // 양측 연결이 갖춰졌으면 저장해 둔 잔여 시간부터 이어서 흐른다 (GDD-23 2.4)
    return { ok: true, issued };
  }

  _attach(seatIndex, ws) {
    const seat = this.seats[seatIndex];
    if (seat.ws && seat.ws !== ws && seat.ws.readyState === 1 /* OPEN */) {
      try { seat.ws.send(JSON.stringify({ v: 1, type: 'error', code: 'E_SUPERSEDED', seq: ++seat.seq })); } catch (e) { /* 소켓 이미 닫힘 */ }
      try { seat.ws.close(4001, 'superseded'); } catch (e) { /* noop */ }
    }
    seat.ws = ws;
    seat.connected = true;
  }

  // ===== 이탈 =====

  // 명시적 나가기 — server.js는 좌석 토큰 인증·중복 제거를 통과한 뒤에만 handleCommand('leave')로 부른다.
  explicitLeave(seatIndex) {
    if (this.state === STATES.OPEN || this.state === STATES.SETUP) {
      this._finalize(STATES.CANCELED, null, { notify: false }); // 응답·상대 푸시는 명령 경로(server.js)가 한다
      return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
    }
    if (this.state === STATES.IN_PROGRESS) return err('E_ILLEGAL_ACTION');
    if (this.state === STATES.FINISHED) {
      // 결과는 이미 확정 — 상태 변화 없음. 소켓 종료는 응답을 보낸 뒤 server.js가 한다.
      return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex), noop: true };
    }
    return err('E_ROOM_CLOSED');
  }

  socketClosed(seatIndex) {
    const seat = this.seats[seatIndex];
    if (!seat.credential) return;
    seat.connected = false;
    seat.ws = null;
    if (this._graceLive()) {
      this._clearDisconnectTimer(seatIndex);
      seat.disconnectExpiry = now() + this.graceMs;
      this._armGrace(seatIndex);
      this._syncClock(); // 시계도 멈춘다 — 흐르는 것은 재연결 대기뿐 (GDD-23 2.4)
    }
  }

  _graceLive() {
    return this.state === STATES.OPEN || this.state === STATES.SETUP || this.state === STATES.IN_PROGRESS;
  }

  // 기록된 만료 시각까지 남은 시간만큼 건다 — 조기 발화 뒤 재무장도 같은 경로.
  _armGrace(seatIndex) {
    const seat = this.seats[seatIndex];
    seat.disconnectTimer = setTimeout(() => this._onGraceExpire(seatIndex), Math.max(0, seat.disconnectExpiry - now()));
    if (seat.disconnectTimer.unref) seat.disconnectTimer.unref();
  }

  _clearDisconnectTimer(seatIndex) {
    const seat = this.seats[seatIndex];
    if (seat.disconnectTimer) { clearTimeout(seat.disconnectTimer); seat.disconnectTimer = null; }
  }

  // setTimeout 은 Date.now() 기준 ~1ms 일찍 깨어날 수 있다 — 만료 전이면 남은 시간만큼 다시 걸고 대기를 유지한다.
  _rearmIfEarly(seatIndex) {
    const seat = this.seats[seatIndex];
    if (seat.disconnectExpiry == null || now() >= seat.disconnectExpiry) return false;
    this._armGrace(seatIndex);
    return true;
  }

  _onGraceExpire(seatIndex) {
    if (this.state === STATES.IN_PROGRESS) this._onGraceExpireInProgress(seatIndex);
    else this._onGraceExpirePreStart(seatIndex);
  }

  // 시각 t 에 만료 시각이 지난 단절 좌석을 먼저 끝난 순서로 확정한다(콜백 지연과 무관).
  _settleLapsedGrace(t) {
    if (!this._graceLive()) return;
    const due = [0, 1].filter((i) => !this.seats[i].connected && this.seats[i].disconnectExpiry != null && this.seats[i].disconnectExpiry <= t);
    due.sort((a, b) => this.seats[a].disconnectExpiry - this.seats[b].disconnectExpiry);
    if (due.length) this._onGraceExpire(due[0]); // 같은 만료·먼저 만료 판정은 만료 처리기가 한다
  }

  _onGraceExpirePreStart(seatIndex) {
    const seat = this.seats[seatIndex];
    seat.disconnectTimer = null;
    if (seat.connected) return;
    if (this.state !== STATES.OPEN && this.state !== STATES.SETUP) return;
    if (this._rearmIfEarly(seatIndex)) return;
    this._finalize(STATES.CANCELED, null);
  }

  _onGraceExpireInProgress(seatIndex) {
    const seat = this.seats[seatIndex];
    seat.disconnectTimer = null;
    if (this.state !== STATES.IN_PROGRESS) return;
    if (seat.connected) return;
    if (this._rearmIfEarly(seatIndex)) return;
    const other = 1 - seatIndex;
    const otherSeat = this.seats[other];
    // 여기까지 오면 내 만료 시각이 지났다. 상대 비교도 now()가 아니라 기록된 만료 시각끼리 한다 —
    // 상대 콜백이 아직 안 왔어도 같은 만료는 승자 없음, 먼저 만료된 쪽이 몰수 (#237 CI 경합).
    if (!otherSeat.connected && otherSeat.disconnectExpiry != null && otherSeat.disconnectExpiry <= seat.disconnectExpiry) {
      if (seat.disconnectExpiry === otherSeat.disconnectExpiry) {
        this._finalize(STATES.FINISHED, { type: 'NO_CONTEST', winner: null });
      } else {
        this._finalize(STATES.FINISHED, { type: 'FORFEIT', winner: seatIndex }); // 상대가 먼저 만료
      }
      return;
    }
    this._finalize(STATES.FINISHED, { type: 'FORFEIT', winner: other });
  }

  // 종료 전이의 단일 지점. revision은 여기서 **정확히 한 번** 오른다 — 단, 같은 동기 구간에서 이미 revision을
  // 올린 명령 경로(마지막 행동·기권)는 opts.bump=false로 부른다(전이 하나 = revision 하나).
  // opts.notify=false: 응답과 상대 푸시를 명령 경로(server.js)가 하므로 onFinalize 푸시를 생략한다.
  _finalize(state, result, opts) {
    opts = opts || {};
    if (TERMINAL_NO_BOARD.has(this.state)) return false; // 이미 닫힌 룸은 다시 전이하지 않는다
    if (this.state === STATES.FINISHED && state !== STATES.CLOSED) return false; // 확정된 결과는 덮어쓰지 않는다
    this.state = state;
    if (result) this.result = result;
    if (opts.bump !== false) this.revision += 1;
    this._clearClock(); // 끝난 경기의 시계는 다시 흐르지 않는다 — 몰수 확정 뒤 상점 만료가 거래를 만들지 않는다 (2.4)
    for (let i = 0; i < 2; i++) {
      this._clearDisconnectTimer(i);
      const seat = this.seats[i];
      if (TERMINAL_NO_BOARD.has(state) && seat.credential) seat.credential.revokeAll();
    }
    if (TERMINAL_NO_BOARD.has(state) && this.engines) {
      for (const T of this.engines) { try { T.scheduler.clear(); } catch (e) { /* noop */ } }
      this.engines = null; // 보드 없는 종료 — 엔진 메모리 해제
    }
    if (opts.notify !== false && this.onFinalize) this.onFinalize(state, this.result);
    return true;
  }

  voidForRestart() { this._finalize(STATES.VOID, { type: 'NO_CONTEST', winner: null, reason: 'RESTART' }); }

  // 로비 정리(sweep)가 부른다 — 닫힘을 알린 뒤 소켓을 닫는다.
  close() {
    const changed = this._finalize(STATES.CLOSED, null);
    for (const seat of this.seats) {
      try { if (seat.ws) seat.ws.close(1000, 'room closed'); } catch (e) { /* noop */ }
    }
    return changed;
  }

  // 엔진 장애 — fail-closed. 어떤 좌석에도 원인 문자열을 싣지 않는다(서버 진단용 lastFault에만 남긴다).
  _engineFault(e) {
    this.lastFault = { at: now(), message: String((e && e.message) || e), kind: (e && e.kind) || null };
    this._finalize(STATES.VOID, { type: 'NO_CONTEST', winner: null, reason: 'E_INTERNAL' });
    return err('E_INTERNAL');
  }

  // ===== 명령 처리 =====

  handleCommand(seatIndex, msg) {
    // #237 GDD-23 2.4 — 단절이 확정된 동안 모든 행동을 멈춘다. 흐르는 것은 재연결 대기뿐이고 나가기·재동기화·항복만 받는다.
    /* #263 (2026-09-25 CJ): 단절이 확정된 동안에는 **양측 모든 게임 입력**을 막는다 — 기권도 포함이다
       (#237 의 "항복은 단절 중에도 받는다"를 최신 지시가 대체한다). 흐르는 것은 재접속 유예뿐이고
       복구(resync)와 경기 전 나가기(leave = 취소)만 남는다. 유예 만료 몰수·경기 전 취소·동시 만료 NO_CONTEST 는 그대로다. */
    if ((msg.t === 'setup' || msg.t === 'ready' || msg.t === 'unready' || msg.t === 'resign') && this._paused()) return err('E_PAUSED');
    /* #263 배치 90초가 지난 뒤의 늦은 배치·준비도 받지 않는다 — 보드 입력과 같은 시한 대조다(_late).
       기권은 시한이 걸린 입력이 아니라 여기 없다(단절 정지만 막는다 · 2026-09-25 CJ). 서버 자신의 만료 처리는
       _autoPlace 가 _handleSetup/_handleReady 를 직접 부르므로 이 문을 지나지 않는다 — 자기 배치를 막지 않는다. */
    if (msg.t === 'setup' || msg.t === 'ready' || msg.t === 'unready') {
      const pc = this._clock[seatIndex];
      if (pc && pc.key === 'place' && this._late(pc)) return err('E_DEADLINE');
    }
    if (msg.t === 'setup') return this._handleSetup(seatIndex, msg);
    if (msg.t === 'ready') return this._handleReady(seatIndex, true);
    if (msg.t === 'unready') return this._handleReady(seatIndex, false);
    if (msg.t === 'action') return this._handleAction(seatIndex, msg);
    if (msg.t === 'resign') return this._handleResign(seatIndex);
    if (msg.t === 'leave') return this.explicitLeave(seatIndex);
    if (msg.t === 'resync') return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex), noop: true };
    return err('E_BAD_ENVELOPE');
  }

  _dedupKey(seatIndex, requestId) { return seatIndex + ':' + requestId; }
  checkDedup(seatIndex, requestId) { const hit = this.dedup.get(this._dedupKey(seatIndex, requestId)); return hit ? hit.resp : null; }
  storeDedup(seatIndex, requestId, resp) { this.dedup.set(this._dedupKey(seatIndex, requestId), { resp, ts: now() }); }
  sweepDedup() { const cutoff = now() - DEDUP_TTL_MS; for (const [k, v] of this.dedup) if (v.ts < cutoff) this.dedup.delete(k); }

  // ===== 배치 (setup) — {roster:[6종], pos:[[r,c]×14]} (좌석0 기준 좌표, 좌석1은 엔진이 미러링) =====

  // applyNetSetup()이 "손상"으로 보고 무작위 배치로 대체할 모든 조건을 서버가 먼저 거부한다.
  // 거부는 좌석의 rawSetup·placed·ready를 전혀 바꾸지 않는다.
  _validateSetup(msg) {
    const roster = msg.roster, pos = msg.pos;
    if (!Array.isArray(roster) || !Array.isArray(pos)) return err('E_BAD_ENVELOPE');
    if (!roster.every((x) => typeof x === 'string' && x.length <= 64)) return err('E_BAD_ENVELOPE');
    if (!pos.every((q) => Array.isArray(q) && q.length === 2 && Number.isInteger(q[0]) && Number.isInteger(q[1]))) return err('E_BAD_ENVELOPE');
    const cat = catalog();
    if (roster.length !== ROSTER_SIZE) return err('E_ILLEGAL_ACTION');
    if (new Set(roster).size !== roster.length) return err('E_ILLEGAL_ACTION');
    if (!roster.every((id) => cat.rosterIds.has(id))) return err('E_ILLEGAL_ACTION');
    if (pos.length !== cat.piecesPerSeat) return err('E_ILLEGAL_ACTION');
    if (!pos.every((q) => cat.zone0.has(q[0]) && q[1] >= 1 && q[1] <= cat.cols)) return err('E_ILLEGAL_ACTION');
    if (new Set(pos.map((q) => q[0] + '_' + q[1])).size !== pos.length) return err('E_ILLEGAL_ACTION');
    return { ok: true };
  }

  _handleSetup(seatIndex, msg) {
    if (this.state === STATES.IN_PROGRESS || this.state === STATES.FINISHED) return err('E_MATCH_STARTED');
    if (this.state !== STATES.SETUP) return err('E_ILLEGAL_ACTION');
    const v = this._validateSetup(msg);
    if (!v.ok) return v;
    if (this.economy) {
      /* #237 경제 경기의 배치는 시작 상점을 마친 뒤다(GDD-23 2.2). 로스터는 고르는 값이 아니라 **산 필드 순서 그대로**여야
         한다 — 배치 좌표 i 가 엔진 말 i 에 대응하므로, 다르면 클라이언트가 다른 말을 놓았다고 보고 거부한다. */
      const S0 = this.engines && this.engines[0].S;
      if (!S0 || !S0.eco || !S0.eco.shop || !S0.eco.shop.done[seatIndex]) return err('E_ILLEGAL_ACTION');
      if (S0.roster[seatIndex].join('|') !== msg.roster.join('|')) return err('E_ILLEGAL_ACTION');
    }
    const seat = this.seats[seatIndex];
    seat.rawSetup = { roster: msg.roster.slice(), pos: msg.pos.map((q) => [q[0], q[1]]) };
    seat.placed = true;
    seat.ready = false; // 자기 배치를 바꾼 좌석의 ready만 해제 (analysis.md §2.3)
    this.revision += 1;
    this._syncClock(); // #263 배치 90초는 "아직 배치를 확정하지 않은 좌석"의 시계다 — placed/ready 가 바뀌면 다시 센다
    return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
  }

  _handleReady(seatIndex, wantReady) {
    if (this.state === STATES.IN_PROGRESS || this.state === STATES.FINISHED) return err('E_MATCH_STARTED');
    if (this.state !== STATES.SETUP) return err('E_ILLEGAL_ACTION');
    const seat = this.seats[seatIndex];
    if (wantReady && !seat.placed) return err('E_ILLEGAL_ACTION');
    if (seat.ready === wantReady) return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex), noop: true };
    seat.ready = wantReady;
    this.revision += 1;
    this._syncClock(); // #263 — 준비를 세우거나 내리면 그 좌석의 배치 90초도 서거나 사라진다
    if (this.seats[0].ready && this.seats[1].ready) {
      const started = this._startMatch();
      if (!started.ok) return started;
    }
    return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
  }

  // 원자적 시작 — 동기 구간 안에서 두 좌석 엔진 기동 → 배치 반영 확인 → 락스텝 일치 확인 → 전이.
  // 기존 온라인 경로의 netStart(seed,[setup0,setup1])를 좌석 시점 엔진마다 그대로 부른다.
  _seed() { return this._testSeed != null ? this._testSeed : (crypto.randomBytes(4).readUInt32BE(0) & 0x7fffffff); } // 서버 비밀 시드 — 어떤 프레임에도 나가지 않는다

  /* #237 경제 경기 — 두 좌석이 모이면 곧바로 좌석 시점 엔진 쌍을 띄우고 시작 상점(S01)을 양측에 동시에 연다(GDD-23 2.3 온라인).
     S01 은 배치 전이라 룸은 SETUP(경기 전)이다 — 이 동안의 단절 만료는 경기 취소다(2.4). 시드는 종전 netStart 와 같은 비밀 시드. */
  _openEconomy() {
    let engines;
    try {
      const seed = this._seed();
      engines = [createEngine(), createEngine()];
      engines.forEach((T, seat) => withEngine(T, () => {
        T.host.seat = seat;
        T.setSeed(seed);
        T.newGame('pvp', { eco: true });
        T.addLog('PVP — 경기 시작 상점에서 하수인 6명을 산 뒤 비공개 배치합니다.', 'sys');
      }));
      if (lockstepDigest(engines[0]) !== lockstepDigest(engines[1])) throw new Error('lockstep divergence at shop open');
    } catch (e) {
      if (engines) for (const T of engines) { try { T.scheduler.clear(); } catch (x) { /* noop */ } }
      return this._engineFault(e);
    }
    this.engines = engines;
    this._syncClock();
    return { ok: true };
  }

  _startMatch() {
    const seed = this._seed();
    const setups = [this.seats[0].rawSetup, this.seats[1].rawSetup];
    let engines;
    try {
      if (this.economy) {
        engines = this.engines; // #237 시작 상점부터 살아 있던 엔진 — 산 말 위에 배치만 얹고 개시한다(로스터 재주입 없음, Core setupAuto)
        engines.forEach((T) => {
          withEngine(T, () => {
            for (let p = 0; p < 2; p++) {
              const positions = T.S.pieces.filter((x) => x.owner === p).map((x, i) => ({
                id: x.id, r: p === 1 ? (catalog().rows + 1 - setups[p].pos[i][0]) : setups[p].pos[i][0], c: setups[p].pos[i][1],
              }));
              T.dispatchCoreAction({ t: 'setupAuto', player: p, roster: [], positions });
            }
            T.addLog(`🌐 온라인 매치 시작 — 당신은 P${T.host.seat + 1}입니다 (자기 진영이 화면 아래). 양측 사전 배치가 적용되었습니다.`, 'sys');
            T.dispatchCoreAction({ t: 'beginPlay' });
          });
          this._assertSetupApplied(T, setups);
        });
      } else {
        engines = [createEngine(), createEngine()];
        engines.forEach((T, seat) => {
          withEngine(T, () => { T.host.seat = seat; T.netStart(seed, setups); }); // #245 좌석 시점은 호스트 포트가 준다(종전 NET.me)
          this._assertSetupApplied(T, setups);
        });
      }
      const d0 = lockstepDigest(engines[0]), d1 = lockstepDigest(engines[1]);
      if (d0 !== d1) throw new Error('lockstep divergence at match start');
    } catch (e) {
      if (engines) for (const T of engines) { try { T.scheduler.clear(); } catch (x) { /* noop */ } }
      return this._engineFault(e);
    }
    this.engines = engines;
    this._consumedModalSeq = null;
    this.state = STATES.IN_PROGRESS;
    this._syncClock();
    // revision: 이 시작은 ready 명령과 같은 동기 구간 — _handleReady가 이미 한 번 올렸다.
    return { ok: true };
  }

  // 검증을 통과한 배치가 무작위 대체 없이 그대로 반영됐는지 확인한다(서버 검증과 엔진 검증의 계약 드리프트 감지).
  _assertSetupApplied(T, setups) {
    const S = T.S;
    for (let p = 0; p < 2; p++) {
      const mine = S.pieces.filter((x) => x.owner === p);
      if (S.roster[p].join('|') !== setups[p].roster.join('|')) throw new Error('setup roster not applied for seat ' + p);
      mine.forEach((x, i) => {
        const r = p === 1 ? (catalog().rows + 1 - setups[p].pos[i][0]) : setups[p].pos[i][0];
        if (x.r !== r || x.c !== setups[p].pos[i][1] || !x.placed) throw new Error('setup position not applied for seat ' + p);
      });
    }
  }

  // ===== 게임 중 행동 =====

  _handleAction(seatIndex, msg) {
    const a = msg.action;
    const eco = !!a && typeof a === 'object' && ECO_VERBS.has(a.t);
    // #237 시작 상점(S01)은 배치 전(SETUP)에 열린다 — 경제 어휘만 SETUP 에서 받는다.
    const live = this.state === STATES.IN_PROGRESS || (eco && this.economy && this.state === STATES.SETUP);
    if (!live || !this.engines) return err('E_ROOM_CLOSED');
    if (!eco && msg.baseRevision !== this.revision) return { ok: false, reason: 'E_STALE_REVISION', staleView: this.toSeatView(seatIndex) };
    if (!a || typeof a !== 'object' || !ACTION_TYPES.has(a.t)) return err('E_BAD_ENVELOPE');
    if (SETUP_ONLY_ACTIONS.has(a.t)) return err('E_ILLEGAL_ACTION');
    if (!this._sanitizeAction(a)) return err('E_BAD_ENVELOPE');
    if (this._paused()) return err('E_PAUSED'); // #263: 기권 포함 모든 게임 입력이 단절 중에는 멈춘다
    if (a.t === 'resign') return this._handleResign(seatIndex);
    const auth = eco ? this._authorizeEco(seatIndex, a) : this._authorize(seatIndex, a);
    if (!auth.ok) return auth;
    return this._apply(seatIndex, auth.action, eco);
  }

  /* #237 경제 거래 인가(GDD-23 2.4) — 좌석·단계·진열 번호·서버 시각 마감만 본다. 거래 자체의 합법성(코인·예비 재화·가방·
     동종·판매 잠금 …)은 Core ecoReduce 가 판정하고, 거부된 거래는 상태를 하나도 바꾸지 않으므로 _apply 가 거부로 돌려준다.
     player·token 은 클라이언트 값을 믿지 않고 서버가 좌석에서 채운다. */
  _authorizeEco(seatIndex, a) {
    const T = this.engines[0], S = T.S, E = S.eco;
    if (!E) return err('E_ILLEGAL_ACTION');
    const c = this._clock[seatIndex];
    const late = this._late(c);
    if (a.t === 'bagPick') {
      const bp = E.bagPick;
      if (S.phase !== 'bagPick' || !bp) return err('E_ILLEGAL_ACTION');
      if (bp.owner !== seatIndex) return err('E_NOT_ACTOR');
      if (a.token !== bp.token) return err('E_SHOP_STALE'); // 지난 B08 의 늦은 응답
      if (late) return err('E_DEADLINE');
      if (a.i < 0 || a.i > E.bag[seatIndex].length) return err('E_ILLEGAL_ACTION');
      return { ok: true, action: { t: 'bagPick', token: bp.token, i: a.i } };
    }
    const sh = E.shop;
    if (!sh || !(S.phase === 'shop' || (sh.kind === 'start' && S.phase === 'setup'))) return err('E_ILLEGAL_ACTION');
    if (a.shop !== sh.turn || a.seq !== sh.seq[seatIndex]) return err('E_SHOP_STALE'); // 지난 진열(다른 오픈·새로 고침·구매 전)
    if (sh.done[seatIndex]) return err('E_ILLEGAL_ACTION');                             // 완료·만료된 상점은 다시 열리지 않는다
    if (late) return err('E_DEADLINE');
    const out = { t: a.t, player: seatIndex, seq: sh.seq[seatIndex] };
    if (a.t === 'shopBuy') out.i = a.i;
    if (a.t === 'shopGood') out.item = a.item;
    if (a.t === 'shopSell' || a.t === 'shopSwap') out.uid = a.uid;
    if (a.t === 'shopSwap' || a.t === 'shopTicket' || a.t === 'leaderEl') {
      const p = this._resolveOwnAlias(seatIndex, a.id);
      if (!p) return err('E_ILLEGAL_ACTION');
      out.pieceId = p.id;
    }
    if (a.t === 'shopTicket' || a.t === 'leaderEl') out.el = a.el;
    return { ok: true, action: out };
  }

  // 필드 형태만 좁힌다 — 게임적 합법성은 _authorize가 판정한다.
  _sanitizeAction(a) {
    const smallInt = (v) => Number.isInteger(v) && v >= -100000 && v <= 100000;
    const smallStr = (v) => typeof v === 'string' && v.length <= 64;
    switch (a.t) {
      case 'cell': return smallInt(a.r) && smallInt(a.c);
      case 'skipMain': case 'search': case 'tele': case 'flee': case 'ball': case 'pass': case 'resign': case 'fleeSkip': return true;
      case 'endTurn': return a.auto === undefined || typeof a.auto === 'boolean';
      case 'heal': case 'fleeSwap': return smallStr(a.id);
      case 'act': return smallInt(a.k) || ACT_KINDS.has(a.k);
      case 'item': return smallInt(a.i);
      case 'pkgOpen': return smallStr(a.kind);
      case 'modal': return smallInt(a.seq) && smallInt(a.i);
      // #237 경제 어휘 — shop(오픈 턴: 0=S01 · 20/40/60/80) + seq(그 좌석 진열 번호)로 겨냥한 진열을 싣는다
      case 'shopBuy': return smallInt(a.shop) && smallInt(a.seq) && smallInt(a.i);
      case 'shopRefresh': case 'shopDone': return smallInt(a.shop) && smallInt(a.seq);
      case 'shopGood': return smallInt(a.shop) && smallInt(a.seq) && smallStr(a.item);
      case 'shopSell': return smallInt(a.shop) && smallInt(a.seq) && smallInt(a.uid);
      case 'shopSwap': return smallInt(a.shop) && smallInt(a.seq) && smallInt(a.uid) && smallStr(a.id);
      case 'shopTicket': case 'leaderEl': return smallInt(a.shop) && smallInt(a.seq) && smallStr(a.id) && smallStr(a.el);
      case 'bagPick': return smallInt(a.token) && smallInt(a.i);
      case 'buffUse': return smallStr(a.key);
      default: return false;
    }
  }

  // 지금 입력을 기다리는 동기화 모달(버튼이 있는 2차 선택 화면). 이미 그 seq를 처리했으면 대기 중이 아니다.
  // #245 — 종전에는 소유자 좌석 엔진의 **DOM**(overlay/obBtns/overlayBox)을 긁어 이 값을 만들었다. 권위 런타임이
  // 규칙 3종만 싣게 되면서 그 DOM 이 사라졌고, 같은 값을 engine.js 의 호환 직렬화(uicompat.pendingModal)가 Core
  // 결정 상태(S.entryPick · S.battle.pkgSel · S.recruit)에서 만든다. 회선 모양·좌석 경계는 그대로다:
  // 두 좌석 엔진이 같은 화면을 같은 seq 로 들고 있을 때만 대기 중으로 보고, 문구·버튼은 소유자에게만 나간다.
  _pendingModal() {
    if (!this.engines) return null;
    const M0 = this.engines[0].__modal;
    if (!M0 || !M0.view) return null;
    if (this._consumedModalSeq === M0.seq) return null;
    const owner = M0.view.owner;
    if (owner !== 0 && owner !== 1) return null;
    const Mo = this.engines[owner].__modal;
    // 좌석 엔진이 갈리면(같은 입력에 다른 화면) 대기 중으로 보지 않는다 — 종전 sm.seq/길이 대조와 같은 자리.
    if (!Mo || !Mo.view || Mo.seq !== M0.seq || Mo.view.buttons.length !== M0.view.buttons.length) return null;
    const btns = Mo.view.buttons;
    return {
      seq: Mo.seq, owner, count: btns.length,
      disabled: btns.map((b) => !!b.disabled),
      html: Mo.view.html,
      buttons: btns.map((b) => ({ text: b.text, disabled: !!b.disabled })),
    };
  }

  _resolveOwnAlias(seatIndex, alias) {
    if (typeof alias !== 'string') return null;
    const pid = this._pidByAlias.get(alias);
    if (pid === undefined) return null;
    const p = this.engines[0].S.pieces.find((x) => x.id === pid);
    return p && p.owner === seatIndex ? p : null;
  }

  // 명시적 합법성 판정 — 반환 {ok:true, action:<엔진에 넘길 정규화된 액션>} 또는 거부.
  _authorize(seatIndex, a) {
    const T = this.engines[0];
    const S = T.S;
    if (S.phase !== 'play') return err('E_ILLEGAL_ACTION');
    /* #263 시한이 지난 입력은 받지 않는다 — 그 만료는 서버가 이미 처리했거나 곧 처리한다(되살리기·중복 실행 금지).
       전투 어휘는 전투 행동 60초, 그 밖의 보드 입력은 행동 30초가 그 시한이다. 판정은 경제 인가와 같은
       **서버 시각 대조**다(_late) — expired 표식만 보면 마감과 만료 콜백 사이의 창으로 늦은 입력이 그대로 들어온다. */
    const gov = S.battle ? this._bclock : (this._pick || this._act);
    if (gov && gov.owner === seatIndex && this._late(gov)) return err('E_DEADLINE');

    // 1) 대기 중인 동기화 모달 — 소유자(NET.syncModal.owner)만, 모달 응답만
    const pm = this._pendingModal();
    if (pm) {
      if (seatIndex !== pm.owner) return err('E_NOT_ACTOR');
      if (a.t !== 'modal') return err('E_ILLEGAL_ACTION');
      if (a.seq !== pm.seq || a.i < 0 || a.i >= pm.count || pm.disabled[a.i]) return err('E_ILLEGAL_ACTION');
      /* #234 (CJ 결정 2026-09-17 · GDD-23 8.1③) 탐색 recruit 의 '기술 교체'는 닫혔다(V2_INTERP.recruitSkillSwap=false).
         루트 화면의 그 버튼은 disabled 로 그려져 위에서 이미 거부된다. 여기서는 기술 교체 단계(skill·target·slot)가 어떤
         경로로든 열려 있으면 그 화면의 응답 전체를 거부한다 — 코어(__recruitCore)는 그 step 을 조용히 무시하므로 수락하면
         상태 불변 noop 이 되고, 규칙상 존재하지 않는 선택지를 서버가 판정 통과시키는 셈이 된다. */
      const R = S.recruit;
      if (R && T.V2_INTERP && T.V2_INTERP.recruitSkillSwap === false && RECRUIT_SWAP_STAGES.has(R.stage)) return err('E_ILLEGAL_ACTION');
      return { ok: true, action: { t: 'modal', seq: a.seq, i: a.i } };
    }
    if (a.t === 'modal') return err(seatIndex === T.netActor() ? 'E_ILLEGAL_ACTION' : 'E_NOT_ACTOR');

    // 2) 도망 후 교환 선택 — 도망친 말의 소유자만
    if (S.fleePick) {
      const fp = S.fleePick;
      if (seatIndex !== fp.owner) return err('E_NOT_ACTOR');
      if (a.t === 'fleeSkip') return { ok: true, action: { t: 'fleeSkip', pick: fp.token } };
      if (a.t === 'fleeSwap') {
        const p = this._resolveOwnAlias(seatIndex, a.id);
        if (!p || !fp.cands.includes(p.id)) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'fleeSwap', id: p.id, pick: fp.token } };
      }
      if (a.t === 'cell') {
        const q = this._inBoard(a.r, a.c) ? T.at(a.r, a.c) : null;
        if (!q || !fp.cands.includes(q.id)) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'cell', r: a.r, c: a.c, pick: fp.token } };
      }
      return err('E_ILLEGAL_ACTION');
    }

    // 3) 전투 — 이번 전투 행동 차례(actorOfPhase)의 소유자만, 전투 어휘만
    if (S.battle) {
      const B = S.battle;
      const side = T.actorOfPhase();
      const ownerP = side === 'A' ? B.attP.owner : B.defP.owner;
      if (seatIndex !== ownerP) return err('E_NOT_ACTOR');
      /* #245 겨냥 프레임(bf) — 클라이언트 netAction 이 **보낸 시점의** 행동자·전투 진행 지점을 싣는다. 좌석·차례 판정 바로 뒤,
         어휘별 합법성과 Core 보다 **먼저** 통째로 대조한다: 없음·부분·여분 키·배열·낡음/재생·앞선 seq·다른 행동자/라운드/단계는
         전부 여기서 떨어져 규칙 상태·난수·revision 을 하나도 건드리지 않는다. 통과한 값은 아래에서 좌석 엔진까지 그대로 실려
         가고(엔진 battleCmdCtx 가 같은 대조를 다시 한다) 서버가 최소 필드로 다시 짓는 경계에서 버려지지 않는다. */
      if (BATTLE_CMDS.has(a.t) && !frameMatches(a.bf, battleFrame(T))) return err('E_ILLEGAL_ACTION');
      const f = side === 'A' ? B.fa : B.fd;
      /* #241 R1 (CJ 설계) 번개 꼬리 추가 공격 단계 — 스킬 선택만 합법이다(L5·L17: 포기·도망·볼·아이템·패키지·패스 불가).
         합법 슬롯(allowed = 기본기·2차·3차 중 실제 칸)은 _legalAct 가 쓰는 T.slotUsable 이 이미 거른다. 나머지 어휘는 클라이언트
         코어(__itemCore·__ballCore·__fleeCore·__passCore·패키지)가 조용히 무시하므로(상태 불변 noop) 서버가 먼저 거부한다.
         조건은 코어와 같은 모양(stage==="active", side 무관)이다 — 추가 공격 단계의 행위자는 항상 그 side 다. */
      const inBonus = !!(B.bonus && B.bonus.stage === 'active');
      if (inBonus && a.t !== 'act') return err('E_ILLEGAL_ACTION');
      switch (a.t) {
        case 'act':
          return this._legalAct(T, f, side, a.k) ? { ok: true, action: { t: 'act', k: a.k, bf: a.bf } } : err('E_ILLEGAL_ACTION');
        case 'item': {
          const k = (S.inv[ownerP] || [])[a.i];
          if (a.i < 0 || k === undefined || !T.ITEMS || !T.ITEMS[k]) return err('E_ILLEGAL_ACTION');
          if (side === 'A' ? B.itemRoundA : B.itemRoundD) return err('E_ILLEGAL_ACTION'); // 라운드 1회
          return { ok: true, action: { t: 'item', i: a.i, bf: a.bf } };
        }
        case 'ball':
          // #237 포획 가능 판정은 Core ballWhy 한 곳(reducer·전투 화면·AI 공용)이다 — 종전 조건(하수인·HP 30% 미만·볼·예비 칸·라운드 1회)에
          // 경제 경기의 전설·보유 종 제외(GDD-23 7.7)가 더해진다. 서버 사본을 두지 않는다.
          return T.ballWhy(S, side) === null ? { ok: true, action: { t: 'ball', bf: a.bf } } : err('E_ILLEGAL_ACTION');
        case 'buffUse': // #237 정기 상점에서 산 전투 버프(GDD-23 7.3) — 재고·전투당 1개는 여기서, 나머지(시간의 수호자 1라운드 등)는 Core 가 본다
          if (!S.eco || !(S.eco.buffInv[ownerP][a.key] > 0) || (side === 'A' ? B.buffA : B.buffD)) return err('E_ILLEGAL_ACTION');
          return { ok: true, action: { t: 'buffUse', key: a.key, bf: a.bf } };
        case 'flee':
          // #234 가시 덩굴 3차 '뿌리 고정' — 이 전투에서는 도망칠 수 없다(__fleeCore 가 조용히 무시하고 UI 버튼도 비활성).
          // 서버가 먼저 거부해 판정 통과·상태 불변 noop 프레임이 생기지 않게 한다.
          if (f.fleeLock) return err('E_ILLEGAL_ACTION');
          return { ok: true, action: { t: 'flee', bf: a.bf } };
        case 'pass': {
          const allLocked = !!f.skills && !f.skills.some((_, i) => T.slotUsable(f, i, side));
          return allLocked ? { ok: true, action: { t: 'pass', bf: a.bf } } : err('E_ILLEGAL_ACTION');
        }
        case 'pkgOpen': {
          if (!PKG_KINDS.has(a.kind)) return err('E_ILLEGAL_ACTION');
          const pk = S.pkgs[ownerP];
          if (!pk || !(pk[a.kind] > 0)) return err('E_ILLEGAL_ACTION');
          if (a.kind === 'battleBuff' && (side === 'A' ? B.buffA : B.buffD)) return err('E_ILLEGAL_ACTION');
          return { ok: true, action: { t: 'pkgOpen', kind: a.kind, bf: a.bf } };
        }
        default:
          return err('E_ILLEGAL_ACTION'); // skipMain·tele·endTurn·heal·search·cell·fleeSwap … 전투 중 보드 입력 금지
      }
    }

    // 4) 보드 플레이 — S.current만
    if (seatIndex !== S.current) return err('E_NOT_ACTOR');
    const forcedPending = (S.forcedTargets && S.forcedTargets.length > 0) || (S.forcedQueue && S.forcedQueue.length > 0);
    switch (a.t) {
      case 'cell':
        return this._inBoard(a.r, a.c) ? { ok: true, action: { t: 'cell', r: a.r, c: a.c } } : err('E_ILLEGAL_ACTION');
      case 'skipMain':
        if (S.mainUsed || S.teleport || forcedPending) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'skipMain' } };
      case 'tele': {
        if (S.teleport) return { ok: true, action: { t: 'tele' } }; // 텔레포트 선택 취소
        const teleDis = S.mainUsed || !T.teleportAvailable(S.current) || S.teleUsed[S.current] >= T.BAL.teleMax;
        return teleDis ? err('E_ILLEGAL_ACTION') : { ok: true, action: { t: 'tele' } };
      }
      case 'search': {
        const sel = S.selected && !S.selected.tray ? S.selected : null;
        const ev = sel ? S.events.find((e) => e.r === sel.r && e.c === sel.c && !e.consumed && S.traces[S.current].has(e.r + '_' + e.c)) : null;
        if (!(sel && ev && !S.mainUsed && !S.teleport && sel.owner === S.current && T.canSearchPiece(sel))) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'search' } };
      }
      case 'heal': {
        const p = this._resolveOwnAlias(seatIndex, a.id);
        if (!p || !T.canHeal(p)) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: { t: 'heal', id: p.id } };
      }
      case 'endTurn':
        // 원본 UI: 주 행동을 마친 뒤(생략 포함)에만 종료가 있다 — 자동 종료도 skipMain을 먼저 보낸다(autoEndCheck).
        if (!S.mainUsed || S.teleport || forcedPending) return err('E_ILLEGAL_ACTION');
        return { ok: true, action: a.auto === true ? { t: 'endTurn', auto: true } : { t: 'endTurn' } };
      default:
        return err('E_ILLEGAL_ACTION'); // act·item·ball·flee·pass·pkgOpen·fleeSwap·fleeSkip — 이 phase의 입력이 아니다
    }
  }

  _inBoard(r, c) {
    const cat = catalog();
    return Number.isInteger(r) && Number.isInteger(c) && r >= 1 && r <= cat.rows && c >= 1 && c <= cat.cols;
  }

  // 전투 기술 입력의 합법성 — __actCore의 kind 해석(숫자 슬롯 / 'basic'·'skill'·'common')과 UI 버튼 활성 조건을 함께 본다.
  /* #234 (GDD-23 3.5·6.2) — 왕·동료 본체도 스킬 칸을 가진다(왕 2칸 + 🪄, 동료 2칸 + 🪄; 전투 개시 syncLeaderSkills).
     칸 수는 전투원마다 1~4 로 가변이므로 **모든 경로에서 칸 범위를 먼저 본다**: T.slotUsable 은 없는 칸(skills[i]===undefined)을
     막지 않아 2칸 왕의 'common'(슬롯2)을 합법으로 읽었다 — 수락하면 코어가 빈 슬롯을 실행한다.
     f.skills 가 없는 전투원(레거시 픽스처 전용 — 라이브 경기의 왕·동료는 개시 시 칸이 채워진다)은 코어 폴백과 같게 둔다. */
  _legalAct(T, f, side, k) {
    const slotOk = (i) => !!f.skills && i < f.skills.length && T.slotUsable(f, i, side);
    if (typeof k === 'number') return Number.isInteger(k) && k >= 0 && slotOk(k);
    if (k === 'basic') return f.skills ? slotOk(0) : true;
    if (k === 'skill') return f.skills ? slotOk(1) : (!!f.skillAtk && !f.cd);
    if (k === 'common') return slotOk(2);
    return false;
  }

  _stateFingerprint() {
    return this.engines.map((T) => JSON.stringify(T.S) + '#' + lockstepDigest(T)).join('|');
  }

  // 판정을 통과한 입력을 두 좌석 엔진에 같은 순서로 적용한다(락스텝). replaying=true는 원본 수신측 재생과 같은
  // 모드 — 행동자 화면 전용 로컬 팝업(메모 피커)을 열지 않는다. (#245: 종전 NET.replaying 자리, 호스트 포트로 이동)
  _apply(seatIndex, action, eco) {
    /* ponytail: #237 온라인 상점 보정 두 줄 — Core 는 지금 "pvp = 핫시트"로만 상점을 연다(ecoGate S01 은 setupPlayer 한 명,
       ecoShopOpenState 는 순차 active). 온라인은 양측 동시다(GDD-23 2.3). Core 가 UI_PORT.seat()!==null 로 온라인을 가리게 되면
       (Mars 인계) 두 보정은 아무 일도 하지 않는다. 두 엔진에 같은 값을 쓰므로 락스텝은 그대로다. */
    const startShop = (T) => T.S.phase === 'setup' && T.S.eco && T.S.eco.shop && T.S.eco.shop.kind === 'start';
    const prevSetup = this.engines.map((T) => T.S.setupPlayer); // 거부·noop 이면 되돌린다 — 거부 거래는 상태 0변경
    if (action.player === 0 || action.player === 1) {
      for (const T of this.engines) if (startShop(T)) T.S.setupPlayer = action.player;
    }
    const before = this._stateFingerprint();
    try {
      for (const T of this.engines) {
        withEngine(T, () => {
          T.host.replaying = true;
          try { T.applyAction(action); } finally { T.host.replaying = false; }
          const sh = T.S.eco && T.S.eco.shop;
          if (sh && sh.active !== null) sh.active = null;
        });
      }
      if (action.t === 'modal') this._consumedModalSeq = action.seq;
      const d0 = lockstepDigest(this.engines[0]), d1 = lockstepDigest(this.engines[1]);
      if (d0 !== d1) throw new Error('lockstep divergence after ' + action.t);
    } catch (e) {
      return this._engineFault(e);
    }
    // #217 — engines가 살아있는 동안 좌석별 fx 창을 떠 둔다. noop이든(변경 없으면 events도 새로 안 늘어난다)
    // 이 행동이 바로 경기 종료로 이어지든(_finalize가 곧 this.engines=null로 비운다) 이 시점 스냅샷이 항상
    // 마지막으로 유효한 것이 되므로, 아래 분기와 무관하게 먼저 찍는다.
    for (let i = 0; i < 2; i++) this._fxCache[i] = this._snapshotFx(this.engines[i]);
    if (this._stateFingerprint() === before) {
      this.engines.forEach((T, i) => { T.S.setupPlayer = prevSetup[i]; });
      // #237 합법 거래는 반드시 상태를 바꾼다(코인·진열 번호·가방·속성). 바뀌지 않았으면 Core 가 거부한 거래다 — 전부 거부.
      if (eco) return err('E_ILLEGAL_ACTION');
      return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex), noop: true };
    }
    this.revision += 1;
    const S = this.engines[0].S;
    if (S.phase === 'over') {
      this._finalize(STATES.FINISHED, { type: 'WIN', winner: S.winner, winType: S.metrics.winType }, { bump: false, notify: false });
    }
    this._syncClock();
    return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
  }

  // ===== #237 게임 시계 · 단절 정지 (GDD-23 2.3·2.4) =====

  // 단절이 확정된 좌석이 하나라도 있으면 경기가 멈춘다 — 엔진이 살아 있는 경기(시작 상점·배치·경기 중)만 해당한다.
  _paused() {
    return !!this.engines && (this.state === STATES.SETUP || this.state === STATES.IN_PROGRESS)
      && this.seats.some((s) => s.credential && !s.connected);
  }

  _ms(kind, sec) { return this._clockMs[kind] != null ? this._clockMs[kind] : sec * 1000; }

  /* #263 그 시계의 시한이 지났는가 — **서버 시각**으로 본다. expired 표식은 만료 콜백이 실제로 돈 뒤에야 서므로
     그것만 보면 마감과 setTimeout 발화 사이(이벤트 루프가 밀리면 넓어진다)로 들어온 입력이 그대로 통과한다.
     멈춘 시계는 deadline 이 null 이라 여기서 걸리지 않는다 — 정지 중 남은 시간은 줄지 않는다(단절·전투·B08).
     입력을 거부해도 상태·revision 은 바뀌지 않고 걸려 있는 만료 콜백은 예정대로 한 번 돈다. */
  _late(c) { return !!c && (c.expired || (c.deadline != null && now() >= c.deadline)); }

  /* **좌석에 묶인** 시한 입력 — 키는 그 입력 하나를 가리키고, 키가 바뀌면 전체 시간으로 새로 선다.
     #237 상점(S01·정기, 완료 전)·B08(소유자) · #263 배치 90초. 좌석마다 하나뿐이라 순서가 곧 우선순위다.
     답할 좌석이 단계마다 바뀌는 행동 30초·전투 행동 60초는 _wantAct·_wantBattle 이 따로 들고 있다. */
  _wantSeatClock(seatIndex) {
    const T = this.engines && this.engines[0], S = T && T.S, E = S && S.eco;
    if (!E || (this.state !== STATES.SETUP && this.state !== STATES.IN_PROGRESS)) return null;
    const sh = E.shop, seat = this.seats[seatIndex];
    if (sh && !sh.done[seatIndex] && (S.phase === 'shop' || (sh.kind === 'start' && S.phase === 'setup'))) {
      return { key: 'shop:' + sh.turn, ms: this._ms('shop', T.ECO.shopSec) };
    }
    /* #263 배치 90초 — S01 을 **90초 안에 직접** 끝냈는데 아직 배치를 확정하지 않은 좌석만 받는다.
       시간 초과로 끝난 좌석(shopTimedOut)은 그 자리에서 자동 배치·준비까지 끝났으므로 다시 걸지 않는다.
       끝 조건이 placed 가 아니라 **placed && ready** 인 이유: 이 시한의 만료 동작이 "자동 배치하고 **준비 상태로 전이**"라
       준비까지가 이 시한의 끝이다. placed 만 보면 setup 만 보내고 ready 를 영영 안 보내는 좌석에서 시계가 사라져
       경기가 시작되지 않는 교착이 남는다(그 교착을 없애려고 있는 시한이다). 배치를 다시 보내면 _handleSetup 이
       ready 를 내리므로 시계도 그 시점의 남은 시간으로 다시 선다. */
    if (this.state === STATES.SETUP && sh && sh.done[seatIndex] && !seat.shopTimedOut && !(seat.placed && seat.ready)) {
      return { key: 'place', ms: this._ms('place', T.ECO.placeSec) };
    }
    if (E.bagPick && E.bagPick.owner === seatIndex && S.phase === 'bagPick') {
      return { key: 'bag:' + E.bagPick.token, ms: this._ms('bagPick', T.ECO.bagPickSec) };
    }
    return null;
  }

  /* #263 보드 행동 30초 — 한 턴에 **하나**이고, 그 시각 실제로 답해야 하는 좌석이 들고 있다(#263 본문
     "공격자·방어자 중 실제 선택자가 응답한다"). 보드 차례는 S.current 이지만, B02 출전 후보 선택은 방어자 단계
     (entryPick stage D)로 넘어가고 도망 뒤 교환 선택은 도망친 말의 소유자다 — owner 만 옮겨 가고 **같은 시계**라
     남은 시간이 그대로 이어진다("후보마다 30초를 다시 주지 않는다" · Q2=A).
     키는 턴이 바뀔 때만 바뀐다 — 주 행동을 마친 뒤 남은 시간은 그 턴이 끝날 때까지 그 값이다.
     정지: 강제 전투 대상 선택창(그 30초는 아래 _wantPick 이 따로 센다) · 전투가 열려 있는 동안(전투 행동 60초가
     따로 흐른다) · B08 가방 초과 20초 동안(별개의 시계다) · 단절 중. 멈춘 동안의 남은 시간은 그대로 보존되고
     그 자리들이 끝나면 **그 값부터** 이어 흐른다. */
  _wantAct() {
    const T = this.engines && this.engines[0], S = T && T.S;
    if (!S || this.state !== STATES.IN_PROGRESS || (S.phase !== 'play' && S.phase !== 'bagPick')) return null;
    const pm = S.battle ? null : this._pendingModal(); // 전투 안의 표(패키지 개봉)는 전투 행동 60초가 맡는다
    const owner = pm ? pm.owner : (S.fleePick ? S.fleePick.owner : S.current);
    return { key: 'act:' + S.turnCount + ':' + S.current,
      ms: this._ms('act', T.ECO.actSec), owner, paused: this._pausedFor('act:') };
  }

  /* #263 T3 강제 전투 대상 선택 30초 — **적격 대상이 둘 이상**일 때 선다. CJ 가 "이동 완료 직후 새 30초"로 정한
     그 시계이고 길이는 행동 30초와 같다(새 타이머 종류가 아니라 30초를 한 번 더 도는 것). 이것이 도는 동안 보드
     행동 30초는 멈춰 남은 시간을 지킨다 — 고르느라 쓴 시간이 보드 시간을 깎지 않는다.
     **대상을 고른 뒤 이어지는 출전 선택(B02)도 이 시계로 이어 센다.** 보드 시계로 돌아가면 고르는 데 쓴 시간이
     사라져 B02 가 사실상 새 30초를 받는다 — PD 가 지목한 자리다(보드 12초 · 새 30초 · 27초 쓰고 선택 → B02 는 남은 3초,
     전투가 끝나면 보드는 12초부터). 키가 그대로라 같은 시계가 그대로 이어지고, 답할 좌석만 단계를 따라간다(방어자 단계).
     키에 이동한 말과 그 턴의 전투 횟수를 실어, 같은 화면을 다시 그려도(재연결·메뉴) 남은 시간이 이어지고
     텔레포트 큐의 **다음 항목**이 승격되면 새 30초가 된다. 만료는 행동 30초와 같은 처리기로 간다(_actTimeout → forcedAuto). */
  _wantPick() {
    const T = this.engines && this.engines[0], S = T && T.S;
    if (!S || this.state !== STATES.IN_PROGRESS || S.phase !== 'play' || S.battle || !S.movedPiece) return null;
    const open = !!(S.forcedTargets && S.forcedTargets.length > 1);   // 고르는 중
    const carry = !!S.entryPick && !!this._pick;                      // 고른 뒤 이어지는 출전 선택 — 같은 시계로 이어 센다
    if (!open && !carry) return null;
    const pm = carry ? this._pendingModal() : null;
    return { key: ['pick', S.turnCount, S.battlesUsed, S.movedPiece.id].join(':'),
      ms: this._ms('act', T.ECO.actSec), owner: pm ? pm.owner : S.current, paused: this._paused() };
  }

  /* #263 T4 전투 행동 60초 (2026-09-25 CJ) — 싸우기·가방·포획·도망을 고르는 시간. **전투 행동 하나마다** 새로 선다:
     키에 행동 토큰(actSeq)·라운드·단계를 실어 차례가 넘어가면 새 60초가 되고, 같은 행동을 다시 그려도(메뉴 열기·
     개봉 표·재연결) 키가 같아 남은 시간이 그대로 이어진다. 한 턴의 두 번째 전투는 battlesUsed 가 달라 같은 actSeq 여도
     다른 키다. 단절 중에만 멈춘다 — 재연결 유예 60초·B08 20초와는 끝까지 별개의 시계다(한쪽 만료가 다른 쪽을 부르지 않는다). */
  _wantBattle() {
    const T = this.engines && this.engines[0], S = T && T.S;
    if (!S || this.state !== STATES.IN_PROGRESS || !S.battle || S.phase !== 'play') return null;
    const B = S.battle, side = T.actorOfPhase();
    return { key: ['battle', S.turnCount, S.battlesUsed, B.actSeq || 0, B.round, B.phase].join(':'),
      ms: this._ms('battle', T.ECO.battleSec), owner: (side === 'A' ? B.attP : B.defP).owner, paused: this._paused() };
  }

  /* 그 시계가 지금 멈춰 있는가. 단절은 **모든** 시계를 멈추고(2.4), 행동 30초는 전투가 열려 있는 동안(Q2=A "후보를 고른 뒤
     전투 판정·연출 중 정지")과 B08 가방 초과 동안 추가로 멈춘다. 멈춘 시계는 남은 시간(left)만 들고 있다가 그 값부터 이어 흐른다. */
  _pausedFor(key) {
    if (this._paused()) return true;
    if (!this.engines || !String(key).startsWith('act:')) return false;
    const S = this.engines[0].S;
    // 대상 선택 30초가 도는 동안(그 뒤로 이어지는 출전 선택 포함) 보드 시계는 남은 시간을 지킨 채 멈춘다.
    return !!S.battle || S.phase === 'bagPick' || !!this._wantPick();
  }

  // 그 키가 사는 자리 — 행동 30초·전투 행동 60초는 방이 하나씩만 들고(owner 로 좌석을 가리킨다) 나머지는 좌석별이다.
  _clockByKey(seatIndex, key) {
    if (String(key).startsWith('act:')) return this._act;
    if (String(key).startsWith('pick:')) return this._pick;
    if (String(key).startsWith('battle:')) return this._bclock;
    return this._clock[seatIndex];
  }

  /* 상태가 바뀔 때마다 부른다: 새 시한 입력이면 전체 시간으로 세우고, 같은 입력이면 남은 시간을 그대로 둔다.
     단절 중에는 남은 시간(left)만 들고 멈추고, 양측이 다시 모이면 그 값부터 흐른다. 새 단절은 새 60초(유예 쪽)이고
     게임 시계는 그대로 이어진다 — 둘은 따로다. */
  _syncClock() {
    for (let i = 0; i < 2; i++) {
      const w = this._wantSeatClock(i);
      this._clock[i] = this._tick(this._clock[i], w && { key: w.key, ms: w.ms, owner: i, paused: this._paused() });
    }
    this._act = this._tick(this._act, this._wantAct());
    this._pick = this._tick(this._pick, this._wantPick());
    this._bclock = this._tick(this._bclock, this._wantBattle());
    this._settleExpiredAct();
  }

  /* 시계 하나의 세우기·정지·재개 — 새 키면 전체 시간으로 세우고, 같은 키면 남은 시간을 그대로 둔다.
     답할 좌석(owner)이 바뀌어도 키가 같으면 같은 시계다(남은 시간·만료 상태 보존) — 그래서 만료 콜백은
     들고 있던 좌석이 아니라 **그 시점의 owner** 로 처리한다(_onClock). */
  _tick(c, want) {
    if (c && (!want || c.key !== want.key)) { if (c.handle) clearTimeout(c.handle); c = null; }
    if (!c && want) c = { key: want.key, left: want.ms, deadline: null, handle: null, expired: false, owner: want.owner };
    if (!c) return null;
    c.owner = want.owner;
    if (!c.expired) {
      if (want.paused && c.deadline != null) {
        c.left = Math.max(0, c.deadline - now()); c.deadline = null;
        clearTimeout(c.handle); c.handle = null;
      } else if (!want.paused && c.deadline == null) {
        const key = c.key, seat = c.owner;
        c.deadline = now() + c.left;
        c.handle = setTimeout(() => this._onClock(seat, key), c.left);
        if (c.handle.unref) c.handle.unref();
      }
    }
    return c;
  }

  /* #263 만료된 행동 30초의 뒤처리 — 만료 처리가 전투를 열면(단일 대상 강제 전투·서버 대행 출전 후보) 시계는
     expired 인 채 멈춘다. 전투·B08 이 끝나 다시 흐를 수 있게 된 순간, 이미 지나간 그 행동 시간으로는 더 둘 수
     없으므로 턴을 넘긴다. 만료는 한 번만 처리한다(expired 표식 + _settling). */
  _settleExpiredAct() {
    if (this._settling || !this.engines) return;
    const c = this._act, S = this.engines[0].S;
    if (!c || !c.expired || this._pausedFor(c.key) || S.phase !== 'play') return;
    this._actTimeout();
  }

  _clearClock() {
    for (const c of this._clock.concat([this._act, this._pick, this._bclock])) if (c && c.handle) clearTimeout(c.handle);
    this._clock = [null, null];
    this._act = null;
    this._pick = null;
    this._bclock = null;
  }

  /* 시한 만료 — 서버 시각 기준. 확정된 거래는 이미 엔진에 있고(수락 순간 확정), 여기서는 Core 의 만료 액션 하나만 넣는다:
     상점 = shopTimeout (S01 은 **노출된 적격 칸만** 자동 구매 — #263 으로 자동 새로 고침은 폐지다 — 뒤이어 속성 자동 배정·자동 배치),
     B08 = 포획한 말 방출(기존 가방 불변, 7.7). 배치·행동은 아래 전용 처리기로 간다.
     합법 만료가 거부되면 Core 계약이 깨진 것이다 — 조용히 멈추지 않고 룸을 닫는다(fail-closed). */
  _onClock(seatIndex, key) {
    const c = this._clockByKey(seatIndex, key);
    if (!c || c.key !== key || c.expired || this._pausedFor(key) || !this.engines) return;
    const seat = c.owner != null ? c.owner : seatIndex; // 답할 좌석은 그 사이 옮겨 갔을 수 있다(B02 방어자·전투 행동자)
    c.expired = true; c.handle = null; c.deadline = null;
    if (key === 'place') { this._autoPlace(seat); if (this.onUpdate) this.onUpdate(); return; }              // #263 배치 90초
    if (key.startsWith('act:') || key.startsWith('pick:')) { this._actTimeout(key.startsWith('pick:')); if (this.onUpdate) this.onUpdate(); return; } // #263 행동 30초·대상 선택 30초
    if (key.startsWith('battle:')) { this._battleTimeout(seat); if (this.onUpdate) this.onUpdate(); return; } // #263 T4 전투 행동 60초
    const E = this.engines[0].S.eco;
    const action = key.startsWith('bag:')
      ? { t: 'bagPick', token: E.bagPick.token, i: E.bag[seat].length }
      : { t: 'shopTimeout', player: seat };
    const res = this._apply(seat, action, true);
    if (!res.ok && this.engines) this._engineFault(new Error('clock expiry refused: ' + key));
    /* #263: S01 시간 초과 좌석은 Core 가 자동 구매에 이어 자동 배치까지 끝냈다 — 그 배치를 좌석 배치로 확정하고
       곧바로 준비한다. 배치 90초는 다시 걸지 않는다(shopTimedOut). */
    if (res.ok && this.state === STATES.SETUP && this.engines) {
      this.seats[seat].shopTimedOut = true;
      this._autoPlace(seat);
    }
    if (this.onUpdate) this.onUpdate();
  }

  /* #263 행동 30초 만료 — 서버가 미완료 행동을 **1회** 대신 처리한다. 만료된 시계는 expired 로 남아 같은 만료가
     두 번 실행되지 않고(_settling 이 재진입도 막는다), 늦게 도착한 같은 행동은 revision·seq·모달 seq 와
     _authorize 의 시한 대조에서 이미 떨어진다(중복 진행 없음). 아래 순서로 **막혀 있는 자리를 먼저 풀고** 턴을 넘긴다:
     ① 고르던 텔레포트 단계는 취소한다(아무것도 소모하지 않는 되돌림) — 남겨 두면 Core endTurn 이 조용히 무동작이다.
     ② 도망 뒤 교환 선택은 '교환하지 않음'으로 닫는다. 그 선택은 자원을 쓰지 않는 쪽이고, 남겨 두면 같은 교착이다 [추론].
     ③ 답을 기다리는 화면은 서버가 대신 고른다 — 출전 후보(B02)는 첫 자리(본체 출전 → 전투 시작)이고,
        '취소·포기' 자리가 있는 화면(패키지·탐색)은 그 자리를 골라 생략한다. 전용 20초 타이머는 만들지 않는다.
     ④ 강제 전투가 남아 있으면 **턴을 넘기지 않는다** — T3 으로 적격 대상을 다시 세어 균등 권위 난수로 고르고
        전투를 연다(적격 후보가 없을 때만 표식이 비워져 ⑤로 간다). 큐에 남은 항목(텔레포트 두 이동)은 승격해
        차례대로 같은 처리를 받는다.
     ⑤ 전투가 열렸으면 거기서 멈춘다 — 전투 행동 60초가 이어받고, 전투가 끝나면 _settleExpiredAct 가 이 자리로
        돌아와 턴을 넘긴다.
     ⑥ 그 밖에는 턴을 넘긴다(T1). 강제 전투 표식을 이유로 한 Core 의 종료 거부는 timeout 표식이 지난다. */
  _actTimeout(fromPick) {
    if (this._settling || !this.engines) return;
    this._settling = true;
    const turn0 = this.engines[0].S.turnCount, cur0 = this.engines[0].S.current;
    try {
      for (let n = 0; n < 8 && this.engines; n++) {
        const S = this.engines[0].S;
        if (S.phase !== 'play') return;      // 상점·B08 로 넘어갔다 — 그쪽 시계가 따로 있다
        if (S.battle) return;                // ⑤ 전투 행동 60초가 이어받는다
        const step = this._expiredActStep(S);
        if (!step) break;                    // 더 풀 자리가 없다 → ⑥
        const r = this._apply(step.seat, step.action, false);
        if (!r.ok || r.noop) break;          // 아무것도 바뀌지 않았다 — 같은 자리를 다시 두드리지 않고 턴을 넘긴다
      }
      const S = this.engines && this.engines[0].S;
      if (!S || S.battle || S.phase !== 'play') return;
      /* 턴을 넘기는 것은 **보드 행동 30초**가 끝났을 때다. 대상 선택 30초(T3) 만료는 그 선택만 대신할 뿐,
         남아 있는 보드 시간을 빼앗지 않는다 — 적격 대상이 하나도 없어 표식만 접힌 경우도 마찬가지다. */
      if (fromPick && !(this._act && this._act.expired)) return;
      if (S.turnCount !== turn0 || S.current !== cur0) return; // 그 사이 턴이 넘어갔다 — 한 만료로 두 턴을 넘기지 않는다
      this._apply(cur0, { t: 'endTurn', auto: true, timeout: true }, false); // ⑥
    } finally { this._settling = false; }
  }

  // 만료 시점에 **막혀 있는 자리 하나**와 그것을 푸는 액션. 없으면 null(= 턴을 넘길 차례다). 위 ①~④ 순서 그대로다.
  _expiredActStep(S) {
    if (S.teleport) return { seat: S.current, action: { t: 'tele' } };
    if (S.fleePick) return { seat: S.fleePick.owner, action: { t: 'fleeSkip', pick: S.fleePick.token } };
    const pm = this._pendingModal();
    if (pm) {
      const i = this._autoModalIndex(this.engines[pm.owner].__modal.view);
      return i < 0 ? null : { seat: pm.owner, action: { t: 'modal', seq: pm.seq, i } };
    }
    if (S.forcedTargets && S.forcedTargets.length) return { seat: S.current, action: { t: 'forcedAuto' } };
    if (S.forcedQueue && S.forcedQueue.length) return { seat: S.current, action: { t: 'drainForced', autoStart: true } };
    return null;
  }

  /* #263 T4 전투 행동 60초 만료 — **지금 차례인 전투원의 행동 1회만** 건너뛰고 전투는 다음 행동·다음 라운드로
     이어진다. 전투 취소·즉시 패배·경기 종료는 없고 보드 턴도 그대로다(보드 시계는 그동안 멈춰 있다).
     쓸 수 있는 기술이 남아 있어도 건너뛴다 — 사람의 '넘기기'는 4칸이 전부 막혔을 때만 합법이므로, 회선에 오르지
     않는 timeout 표식으로 Core 에 이 갈래임을 알린다(_authorize 가 정규화하는 클라이언트 입력에는 붙지 않는다).
     합법 만료가 아무것도 바꾸지 못하면 Core 계약이 깨진 것이다 — 조용히 멈추지 않고 룸을 닫는다(fail-closed). */
  _battleTimeout(seatIndex) {
    if (this._settling || !this.engines) return;
    this._settling = true;
    try {
      const T = this.engines[0];
      if (!T.S.battle) return;
      const res = this._apply(seatIndex, { t: 'pass', timeout: true, bf: battleFrame(T) }, false);
      if ((!res.ok || res.noop) && this.engines) this._engineFault(new Error('battle clock expiry refused'));
    } finally { this._settling = false; }
  }

  // 서버가 대신 누를 자리 — '취소·포기'가 있으면 그것(생략), 없으면 첫 활성 자리(출전 후보 = 본체 출전).
  _autoModalIndex(view) {
    const isSkip = (b) => !b.disabled && b.act && (b.act.t === 'pkgCancel' || (b.act.t === 'recruit' && b.act.step === 'giveup'));
    const skip = view.buttons.findIndex(isSkip);
    return skip >= 0 ? skip : view.buttons.findIndex((b) => !b.disabled);
  }

  /* #263 배치 자동 완성 — 아직 놓이지 않은 말을 Core 가 자기 진영 빈 칸에 놓고(합법 위치 보장), 그 결과를
     좌석 배치로 확정한 뒤 준비까지 세운다. 좌표는 좌석0 기준으로 되돌려 _handleSetup 의 검증(내 진영 행·열 범위·중복
     없음·로스터 일치)을 그대로 지난다 — 서버가 만든 배치도 클라이언트 배치와 같은 문을 통과한다. 상대에게는 나가지 않는다. */
  _autoPlace(seatIndex) {
    if (this.state !== STATES.SETUP || !this.engines) return err('E_ILLEGAL_ACTION');
    const S0 = this.engines[0].S;
    if (!S0.eco || !S0.eco.shop || !S0.eco.shop.done[seatIndex]) return err('E_ILLEGAL_ACTION');
    /* 이미 자기 배치를 보낸 좌석은 **그 배치를 그대로 둔다** — 준비만 세운다. 엔진 말은 개시(_startMatch) 때 비로소
       놓이므로 여기서 "엔진에 안 놓였다"를 근거로 다시 놓으면 사람이 고른 자리를 무작위로 덮어쓴다. */
    if (this.seats[seatIndex].placed && this.seats[seatIndex].rawSetup) return this._handleReady(seatIndex, true);
    if (S0.pieces.some((x) => x.owner === seatIndex && !x.placed)) {
      const r = this._apply(seatIndex, { t: 'autoPlace', player: seatIndex }, false);
      if (!r.ok) return r;
    }
    if (!this.engines) return err('E_ROOM_CLOSED');
    const S = this.engines[0].S, rows = catalog().rows;
    const mine = S.pieces.filter((x) => x.owner === seatIndex);
    if (mine.some((x) => !x.placed)) return this._engineFault(new Error('auto placement incomplete for seat ' + seatIndex));
    const pos = mine.map((x) => [seatIndex === 1 ? rows + 1 - x.r : x.r, x.c]);
    const set = this._handleSetup(seatIndex, { roster: S.roster[seatIndex].slice(), pos });
    if (!set.ok) return this._engineFault(new Error('auto placement rejected: ' + set.reason));
    return this._handleReady(seatIndex, true);
  }

  /* 기권 — #237 GDD-23 2.4 "의도적 항복은 현행대로 즉시 종료". 경기 중이면 **어느 좌석이든** 언제든(상대 차례·정기 상점·B08)
     즉시 그 좌석의 패배다 — 종전 "자기 차례·보드 phase 만"은 상점·B08 에서 항복 수단을 없앴다.
     #263 (2026-09-25 CJ): **단절 정지 중에는 예외로 받지 않는다** — 호출부(handleCommand·_handleAction)가 E_PAUSED 로 먼저 막는다.
     경기 전(시작 상점·배치)은 승패가 없는 경기 취소다(2.4 "경기가 시작되기 전 … 경기 취소") — 나가기와 같은 전이.
     수락된 거래는 이미 엔진에 있고(유지) 여기서 종료가 확정되면 _finalize 가 시계를 걷어 뒤이은 거래·만료를 막는다.
     종전 무료 로스터 경기(DD_ECONOMY=0)는 원본 온라인 규칙(자기 차례에만 · confirmResign) 그대로다. */
  _handleResign(seatIndex) {
    if (this.economy && (this.state === STATES.OPEN || this.state === STATES.SETUP)) return this.explicitLeave(seatIndex);
    if (this.state !== STATES.IN_PROGRESS || !this.engines) return err('E_ROOM_CLOSED');
    if (!this.economy) {
      const S = this.engines[0].S;
      if (S.phase !== 'play') return err('E_ILLEGAL_ACTION');
      if (S.current !== seatIndex) return err('E_NOT_ACTOR');
    }
    try {
      for (const T of this.engines) withEngine(T, () => {
        // 자기 차례의 보드 phase 는 종전 Core resign 경로 그대로(패자 = S.current). 그 밖은 같은 종료 전이를 패자 좌석으로 직접 부른다.
        if (T.S.phase === 'play' && T.S.current === seatIndex) { T.applyAction({ t: 'resign' }); return; }
        T.dispatchCoreAction({ t: 'gameOver', winner: 1 - seatIndex, winType: 'resign' });
        T.addLog(`🏳️ ${T.pname(seatIndex)} 기권 — ${T.pname(1 - seatIndex)} 승리!`, 'imp'); // Core matchEnded(resignLoser) 와 같은 문구
      });
      if (this.engines[0].S.phase !== 'over') throw new Error('resign did not end the match');
      if (lockstepDigest(this.engines[0]) !== lockstepDigest(this.engines[1])) throw new Error('lockstep divergence after resign');
    } catch (e) {
      return this._engineFault(e);
    }
    for (let i = 0; i < 2; i++) this._fxCache[i] = this._snapshotFx(this.engines[i]); // #217 — finalize 전에 마지막 창 확보
    this.revision += 1;
    const S2 = this.engines[0].S;
    this._finalize(STATES.FINISHED, { type: 'WIN', winner: S2.winner, winType: S2.metrics.winType }, { bump: false, notify: false });
    return { ok: true, type: 'room_state', data: this.toSeatView(seatIndex) };
  }

  // ===== 좌석 뷰 (analysis.md §2.6·§2.6.1·§2.6.2 화이트리스트) =====

  _alias(pid) {
    let a = this._aliasByPid.get(pid);
    if (a) return a;
    do { a = 'u-' + crypto.randomBytes(4).toString('base64url'); } while (this._pidByAlias.has(a));
    this._aliasByPid.set(pid, a);
    this._pidByAlias.set(a, pid);
    return a;
  }

  toSeatView(seatIndex) {
    const seat = this.seats[seatIndex];
    const ready = [this.seats[0].ready, this.seats[1].ready];
    if (this.state === STATES.OPEN || this.state === STATES.SETUP) {
      const base = {
        seat: seatIndex, state: this.state, phase: 'setup', revision: this.revision, current: null,
        seats: { ready }, units: [], you: { placed: seat.placed }, result: null, fx: this._fxCache[seatIndex],
        economy: this.economy, // #237 경제 방 여부 — OPEN 호스트가 상대 입장 전 무료 로스터 화면을 잠깐 그리지 않게 한다
      };
      if (!this.engines) return base;
      /* #237 경제 경기의 경기 전 — 시작 상점(phase 'shop') → 배치(phase 'setup'). 자기 말(산 필드 칸·왕·동료 속성)과 자기 경제만
         싣는다. 상대는 아무것도 없다: 상대의 구매·진열·재화·완료 여부는 이 뷰 어디에도 나가지 않는다(7.9). */
      const T = this.engines[seatIndex], S = T.S, sh = S.eco && S.eco.shop;
      return Object.assign(base, {
        phase: sh && !sh.done[seatIndex] ? 'shop' : 'setup',
        you: Object.assign({ placed: seat.placed, pieces: S.pieces.filter((p) => p.owner === seatIndex).map((p) => this._serializeOwn(T, p)) },
          this._ecoView(T, seatIndex)),
        shop: this._shopView(T, seatIndex),
        clock: this._clockView(seatIndex),
        pause: this._pauseView(),
        log: (S.log || []).slice(-40).map((l) => ({ msg: l.msg, cls: l.cls })),
      });
    }
    if (TERMINAL_NO_BOARD.has(this.state) || !this.engines) {
      // #217 — 이 분기는 finalize 직후(this.engines가 이미 null) 도달하지만, _apply/_handleResign이 그 直前에
      // 찍어 둔 _fxCache는 살아있다 — "종료 직후 battle=null에도 결과·마지막 타격 표시" 요구는 이 필드로 만족한다.
      return {
        seat: seatIndex, state: this.state, phase: this.state.toLowerCase(), revision: this.revision, current: null,
        seats: { ready }, units: [], you: { placed: seat.placed }, result: this.result, fx: this._fxCache[seatIndex],
      };
    }
    // 이 좌석 시점의 엔진 — 로그·전투 로그·모달 문구가 원본 그대로 이 좌석 관점이다.
    const T = this.engines[seatIndex];
    const S = T.S;
    const units = [];
    const youPieces = [];
    // #217 Mars 델타(msg_db7a8fa06aee) — 원본 index.html:1705 `viewer = ... (S.mode==="sim"||S.phase==="over")?2:...`
    // (#11 종료 리빌): 경기가 실제로 끝나(FINISHED) phase="over"가 되면 두 화면 모두 viewer===2로 렌더해
    // visibleTo/revealed 마스킹 없이 살아있는 모든 말의 위치·정체를 보여준다. FINISHED만 해당하고, 다른 종료
    // 상태(CANCELED/VOID/CLOSED)는 TERMINAL_NO_BOARD 분기가 애초에 board 자체를 비워 보내므로 이 리빌이
    // 새지 않는다.
    const revealAll = this.state === STATES.FINISHED;
    for (const p of S.pieces) {
      if (!p.alive || !p.placed) continue;
      if (p.owner === seatIndex) { youPieces.push(this._serializeOwn(T, p)); continue; }
      if (!revealAll && !T.visibleTo(seatIndex, p)) continue; // 등급 A — 레코드 자체를 뺀다(종료 리빌 제외)
      units.push(revealAll || p.revealed === true ? this._serializeKnownOpponent(p) : this._serializeUnknownOpponent(p));
    }
    const you = {
      pieces: youPieces,
      inv: (S.inv[seatIndex] || []).slice(),
      balls: S.balls[seatIndex],
      reserve: S.reserve[seatIndex] ? this._serializeOwn(T, S.reserve[seatIndex]) : null,
      pkgs: Object.assign({}, S.pkgs[seatIndex]),
      selected: S.selected && S.selected.owner === seatIndex && !S.selected.tray ? this._alias(S.selected.id) : null,
      placed: seat.placed,
      // #217 Mars ctx_75a85d4c58fb 델타 — 텔레포트 버튼 disable 계산(teleMax 도달)에 필요한 자기 사용 횟수뿐이라
      // 자기 정보다(상대 teleUsed는 내려주지 않는다).
      teleUsed: Number.isInteger(S.teleUsed && S.teleUsed[seatIndex]) ? S.teleUsed[seatIndex] : 0,
    };
    Object.assign(you, this._ecoView(T, seatIndex));
    const battle = S.battle ? this._serializeBattle(T, S.battle, seatIndex) : null;
    const fleePick = S.fleePick ? {
      owner: S.fleePick.owner,
      // #217 Mars 델타 — 도망친 말 자체의 강조 표시(hl-sel)에 필요. cands와 같은 소유자 전용 게이트.
      pieceId: S.fleePick.owner === seatIndex ? this._aliasByRealId(S, S.fleePick.pieceId) : undefined,
      cands: S.fleePick.owner === seatIndex ? S.fleePick.cands.map((id) => this._aliasByRealId(S, id)) : undefined,
    } : null;
    // #217 Mars 델타 — 강제 전투/텔레포트 단계의 autoEndReady 오판(false skip/endTurn reject 루프)과 하이라이트
    // 복원에 필요한 최소 필드. 원본 UI도 이 값들을 **S.current 좌석의 화면에만** 그린다(위 index.html 1737-1741·
    // 1900-1906 조건 `!isAI(S.current)&&(!NET.mode||S.current===NET.me)` — 상대는 강제 전투 여부조차 보지 않는다).
    // 그래서 서버도 같은 게이트(S.current===seatIndex)로만 채운다. 별칭은 이 좌석 뷰에서 이미 visibleTo인
    // 말에만 발급한다(contactSet/forcedTargets는 항상 이 좌석 소유 말과 인접한 적이라 원래도 visibleTo이지만,
    // 방어적으로 다시 검사해 "이 좌석 뷰에 이미 있는 것"만 새는 걸 강제한다).
    const visibleTurnAlias = (pid) => {
      if (pid == null) return null;
      const p = S.pieces.find((x) => x.id === pid);
      if (!p || !p.alive || !p.placed) return null;
      if (p.owner !== seatIndex && !T.visibleTo(seatIndex, p)) return null;
      return this._alias(p.id);
    };
    const turn = S.current === seatIndex ? {
      teleport: S.teleport ? { stage: S.teleport.stage, piece: S.teleport.piece ? visibleTurnAlias(S.teleport.piece.id) : null } : null,
      forcedTargets: (S.forcedTargets || []).map(visibleTurnAlias).filter((a) => a !== null),
      forcedQueue: (S.forcedQueue || []).length,
      movedPiece: S.movedPiece ? visibleTurnAlias(S.movedPiece.id) : null,
      firstBattleWonByMover: !!S.firstBattleWonByMover,
      contactSet: (S.contactSet || []).map(visibleTurnAlias).filter((a) => a !== null),
    } : null;
    const events = (S.events || []).filter((e) => S.traces[seatIndex] && S.traces[seatIndex].has(e.r + '_' + e.c) && !e.consumed)
      .map((e) => ({ r: e.r, c: e.c, kind: e.kind }));
    return {
      seat: seatIndex,
      state: this.state,
      phase: this.state === STATES.FINISHED ? 'over'
        : (S.phase === 'shop' || S.phase === 'bagPick' ? S.phase : (S.fleePick ? 'flee' : (S.battle ? 'battle' : 'play'))),
      revision: this.revision,
      turnCount: S.turnCount,
      current: S.current,
      mainUsed: S.mainUsed,
      battlesUsed: S.battlesUsed,
      seats: { ready },
      units,
      you,
      turn,
      battle,
      fleePick,
      modal: this._serializeModal(seatIndex),
      log: (S.log || []).slice(-40).map((l) => ({ msg: l.msg, cls: l.cls })),
      events,
      // #237 경제 — 자기 진열·B08·시계만. 상대 B08 은 "누가 고르는 중"만(원본 모달 대기 표시와 같은 양).
      ...(S.eco ? {
        shop: this._shopView(T, seatIndex),
        bagPick: S.eco.bagPick ? (S.eco.bagPick.owner === seatIndex
          ? { owner: seatIndex, token: S.eco.bagPick.token, unit: this._serializeUnit(T, S.eco.bagPick.unit) }
          : { owner: S.eco.bagPick.owner }) : null,
        clock: this._clockView(seatIndex),
      } : {}),
      ...(this._pauseView() ? { pause: this._pauseView() } : {}), // 단절 중에만 — 없으면 경기가 흐르고 있다
      result: this.result,
      // #217 — engines가 살아있는 동안은 T.__fx를 직접(라이브) 읽는다. _apply/_handleResign가 명령 처리
      // 경로로만 _fxCache를 갱신하므로, 그 경로를 거치지 않고 엔진을 직접 조작하는 호출(예: 테스트 픽스처)
      // 뒤에 바로 조회해도 최신 이벤트를 놓치지 않는다 — _fxCache는 engines가 사라지는 종료 분기 전용 백업.
      fx: this._snapshotFx(T),
    };
  }

  /* #237 자기 경제(GDD-23 7.9 소유자 전용: 재화·가방 내용·개수·등급·쓰지 않은 스킬·원장·판매 기록) — you 에 얹는다.
     상대 좌석 값은 읽지도 않는다: 인덱스를 seatIndex 로만 고른다. */
  _ecoView(T, seatIndex) {
    const E = T.S.eco;
    if (!E) return {};
    return {
      eco: {
        coins: E.coins[seatIndex], tickets: E.tickets[seatIndex], buffInv: Object.assign({}, E.buffInv[seatIndex]),
        soldHp: Object.assign({}, E.soldHp[seatIndex]),
        bag: E.bag[seatIndex].map((u) => this._serializeUnit(T, u)),
      },
    };
  }

  /* 자기 진열 — shop(오픈 턴)·seq(진열 번호)가 거래 요청이 겨냥할 값이다. 진열은 S01·정기 모두 **언제나 6칸**이고,
     산 칸은 비지 않고 soldOut 으로 남는다(#263 — 즉시 보충 없음, 수동 새로 고침까지 구매 불가). sold 는
     "지금 살 수 없다"는 한 칸이라 품절도 포함한다(종전 판매 잠금 + 품절) — 화면 문구는 soldOut 이 가른다.
     시너지 현황(E16)은 Core ecoSynView 그대로(S01 미리보기 · 정기 실제 집계) — 소유자 전용이다. */
  _shopView(T, seatIndex) {
    const S = T.S, sh = S.eco && S.eco.shop;
    if (!sh) return null;
    const syn = T.ecoSynView(S, seatIndex);
    return {
      kind: sh.kind, shop: sh.turn, seq: sh.seq[seatIndex], done: sh.done[seatIndex],
      slots: sh.slots[seatIndex].map((x) => (x ? { key: x.key, grade: x.grade, soldOut: !!x.soldOut, sold: !!x.soldOut || sh.sold[seatIndex].includes(x.key) } : null)),
      sold: sh.sold[seatIndex].slice(),
      syn: {
        el: Object.assign({}, syn.el), arch: Object.assign({}, syn.arch), stage: JSON.parse(JSON.stringify(syn.stage)),
        bonus: JSON.parse(JSON.stringify(syn.bonus == null ? null : syn.bonus)), deadAllies: syn.deadAllies,
        pending: syn.pending.map((p) => this._alias(p.id)),
      },
    };
  }

  /* 자기 시한 입력의 남은 시간(ms). 단절 중에는 멈춘 값 그대로다.
     #263 한 좌석이 여러 시계에 걸릴 수 있으므로(전투 행동 60초 + 멈춰 있는 행동 30초, B08 20초 + 멈춰 있는 행동 30초)
     **지금 흐르고 있는 것**을 보여 준다 — 멈춘 시계뿐이면 그중 첫 번째다. key 는 종전처럼 앞 토막만 나가고
     (shop·place·bag·act·battle) 진행 지점·좌석은 싣지 않는다. */
  _clockView(seatIndex) {
    const mine = [this._bclock, this._pick, this._act, this._clock[seatIndex]].filter((x) => x && x.owner === seatIndex);
    const c = mine.find((x) => x.deadline != null) || mine[0];
    if (!c) return null;
    const left = c.expired ? 0 : (c.deadline != null ? Math.max(0, c.deadline - now()) : c.left);
    return { key: c.key.split(':')[0], leftMs: left, running: c.deadline != null };
  }

  // "상대 연결 대기" — 끊긴 좌석과 그 재연결 유예 잔여. 게임 시계는 이 동안 멈춰 있다(2.4).
  _pauseView() {
    if (!this._paused()) return null;
    const out = [];
    this.seats.forEach((s, i) => {
      if (s.credential && !s.connected) out.push({ seat: i, graceLeftMs: s.disconnectExpiry != null ? Math.max(0, s.disconnectExpiry - now()) : null });
    });
    return out;
  }

  // 가방 말·B08 포획 말 — 자기 좌석 전용. 원장(paid)·등급·스킬 전부. 보드 자리가 없으므로 id 대신 uid 로 가리킨다.
  _serializeUnit(T, u) {
    return {
      uid: u.uid, rosterId: T.ecoKey(u), name: u.name, element: u.element, // 전설도 진열 key 와 같은 종 키(ecoKey) — 원시 legend 칸은 #234 경계상 싣지 않는다
      grade: u.grade === undefined ? null : u.grade, hp: u.hp, maxHp: u.maxHp, atk: u.atk, skillAtk: u.skillAtk,
      def: u.def, spd: u.spd, dodge: u.dodge, crit: u.crit, statusPct: u.statusPct,
      skills: this._skillsFor(T, u, true), paid: u.paid || 0, fresh: !!u.fresh, revealed: !!u.revealed, reaperSeal: u.reaperSeal || 0,
    };
  }

  // #217 — 전투 표시 이벤트 창. engine.js가 이미 캡처·정규화해 T.__fx에 쌓아 둔 것을 다시 화이트리스트
  // 재구성한다(room.js의 기존 _serialize* 관례 — 캡처 버퍼를 통째로 넘기지 않는다). engines가 살아있는 동안만
  // 부를 수 있다 — toSeatView 본 분기가 매번 라이브로 부르고, _apply/_handleResign도 finalize 直前에 한 번 더
  // 불러 Room._fxCache에 저장해 둔다(engines가 null이 된 뒤 toSeatView의 종료 분기가 그 캐시를 대신 쓴다).
  _snapshotFx(T) {
    const store = T.__fx;
    if (!store || !store.items.length) return { firstSeq: null, lastSeq: store ? store.nextSeq - 1 : 0, events: [] };
    /* #237 주어가 없는 문구(천년목 "HP N"·과부하 "피해 N → 상한")는 같은 전투의 다음 주어 있는 문구(곧바로 이어지는 그 전투원의 피해 줄)를 따른다 */
    const subj = [];
    let next = null;
    for (let i = store.items.length - 1; i >= 0; i--) {
      const e = store.items[i];
      if (e.src !== 'msg') continue;
      const s = fxSubject(e.fx);
      if (s) next = { s, bid: e.battleId };
      subj[i] = s || (next && next.bid === e.battleId ? next.s : null);
    }
    return {
      firstSeq: store.items[0].seq,
      lastSeq: store.nextSeq - 1,
      events: store.items.map((e, i) => this._serializeFxEvent(e, T.host && T.host.seat, subj[i])),
    };
  }

  // #217 PD REVISE 2번 — battleId(연속 전투에서 옛 FX를 새 전투원에 적용 금지)·scene(battle=null 이후에도
  // 마지막 타격을 그릴 무대 식별) 재구성. scene은 engine.js가 이미 만들어 왔어도 여기서 다시 알려진 원시
  // 필드만 골라 재구성한다 — 캡처 경로를 신뢰하지 않는 이중 화이트리스트(room.js 기존 _serialize* 관례).
  _serializeFxScene(scene) {
    if (!scene || typeof scene !== 'object') return null;
    const side = (s) => (s && typeof s === 'object') ? {
      owner: s.owner === 0 || s.owner === 1 ? s.owner : null,
      type: typeof s.type === 'string' ? s.type : null,
      element: typeof s.element === 'string' ? s.element : null,
      bodyFight: !!s.bodyFight,
      rosterId: typeof s.rosterId === 'string' ? s.rosterId : null,
      artRosterId: typeof s.artRosterId === 'string' ? s.artRosterId : null,
    } : null;
    const a = side(scene.a), d = side(scene.d);
    return (a || d) ? { a, d } : null;
  }

  _serializeFxCells(cells) {
    if (!Array.isArray(cells)) return undefined;
    const out = cells.filter((c) => Array.isArray(c) && c.length === 2 && Number.isInteger(c[0]) && Number.isInteger(c[1])).map((c) => [c[0], c[1]]).slice(0, 16);
    return out.length ? out : undefined;
  }

  // Saturn REVISE(fx-qa-revise.md P2, startedRoom(1874204)) — engine.js가 이미 normalizeMsgFx로 화이트리스트
  // 재구성한 값이라도, 여기서 그 객체(및 float/hp/st 서브 객체)를 **참조 그대로** 돌려주면 호출자가 반환된
  // view를 변조했을 때 T.__fx.items에 영구히 저장된 바로 그 객체가 함께 오염된다(같은 seq를 다시 읽어도
  // sameRef===true로 변조가 그대로 보임 — resync/재조회 스토어까지 물든다). scene(_serializeFxScene)·
  // cells(_serializeFxCells)처럼 매 호출마다 원시 필드만 골라 **새 객체**를 짓는다 — 내부 저장소와 반환값이
  // 항상 독립된 참조를 갖도록(이중 화이트리스트, room.js 기존 _serialize* 관례와 동일).
  /* #237 opp(side) — 그 쪽이 이 좌석의 상대 전투원이고 경제 경기면 그 전투원의 최대 HP, 아니면 null. 상대 쪽 HP·방어막·
     떠오르는 수치는 100 눈금으로 바꿔 싣는다(_serializeKnownOpponent 와 같은 계약 — 최대 HP 로 등급이 역산되지 않게). */
  _serializeFxMsgFx(fx, opp) {
    if (!fx || typeof fx !== 'object') return null;
    opp = opp || (() => null);
    const out = {};
    if (fx.shake === 'A' || fx.shake === 'D') out.shake = fx.shake;
    if (fx.sig === true) out.sig = true;
    if (typeof fx.flash === 'string') out.flash = fx.flash;
    if (fx.ko === 'A' || fx.ko === 'D') out.ko = fx.ko;
    if (fx.float && (fx.float.side === 'A' || fx.float.side === 'D') && (fx.float.sign === 'pos' || fx.float.sign === 'neg')) {
      const m = opp(fx.float.side), amount = Number(fx.float.amount) || 0;
      out.float = { side: fx.float.side, sign: fx.float.sign, amount: m ? pct100(amount, m) : amount };
    }
    if (fx.hp && (fx.hp.side === 'A' || fx.hp.side === 'D')) {
      out.hp = opp(fx.hp.side) ? { side: fx.hp.side, val: pct100(fx.hp.val, fx.hp.max), max: 100 }
        : { side: fx.hp.side, val: Number(fx.hp.val) || 0, max: Number(fx.hp.max) || 0 };
    }
    if (fx.st && (fx.st.side === 'A' || fx.st.side === 'D')) {
      const o = !!opp(fx.st.side), text = typeof fx.st.text === 'string' ? fx.st.text : '';
      out.st = { side: fx.st.side, text: o ? scaleText(text, fx.st.max) : text, // 상태 아이콘의 🛡방어막·🌊해일≤X
        shield: o ? pct100(fx.st.shield, fx.st.max) : Number(fx.st.shield) || 0, max: o ? 100 : Number(fx.st.max) || 0 };
    }
    return Object.keys(out).length ? out : null;
  }

  _serializeFxEvent(e, seatIndex, subject) {
    if (e.src === 'msg') {
      const opp = (side) => (this.economy && e.sides && e.sides[side] && e.sides[side][0] !== seatIndex ? e.sides[side][1] : null);
      // #237 문구: 주어가 자기 전투원이면 실제 값, 상대면 100 눈금, 주어 불명이면 HP 계열 수치를 '?' 로 가린다
      const own = subject && e.sides && e.sides[subject] && e.sides[subject][0] === seatIndex;
      const txt = !this.economy || own ? e.txt : scaleText(e.txt, subject ? opp(subject) : null);
      return {
        seq: e.seq, src: 'msg', battleId: Number.isInteger(e.battleId) ? e.battleId : null,
        round: e.round, actSeq: e.actSeq, key: e.key, big: e.big, txt, fx: this._serializeFxMsgFx(e.fx, opp),
      };
    }
    const out = {
      seq: e.seq, src: 'stage', battleId: Number.isInteger(e.battleId) ? e.battleId : null,
      turn: e.turn, key: e.key, kind: e.kind, title: e.title, sub: e.sub,
    };
    if (typeof e.cls === 'string' && e.cls) out.cls = e.cls;
    const cells = this._serializeFxCells(e.cells);
    if (cells) out.cells = cells;
    if (e.key === 'resultBanner' || e.key === 'battleStart') out.scene = this._serializeFxScene(e.scene);
    return out;
  }

  // 동기화 모달 — owner/seq/count는 양쪽에(누가 선택 중인지는 원본도 "상대 선택 대기 중"으로 보여 준다),
  // 실제 문구·버튼은 소유 좌석에만(그 좌석 엔진의 DOM에서 읽는다 — 원본 modal 래퍼가 비소유 엔진에서는 마스킹한다).
  _serializeModal(seatIndex) {
    const pm = this._pendingModal();
    if (!pm) return null;
    const view = { seq: pm.seq, owner: pm.owner, count: pm.count };
    if (pm.owner !== seatIndex) return view;
    view.html = pm.html;
    view.buttons = pm.buttons;
    return view;
  }

  _aliasByRealId(S, realId) {
    const p = S.pieces.find((x) => x.id === realId);
    return p ? this._alias(p.id) : null;
  }

  _serializeOwn(T, p) {
    return {
      id: this._alias(p.id), r: p.r, c: p.c, owner: p.owner, type: p.type, element: p.element,
      name: p.name, hp: p.hp, maxHp: p.maxHp, atk: p.atk, skillAtk: p.skillAtk,
      // #217 Earth art-omission-audit P0(2) — 자기 하수인 보드 아이콘(artDirOf)이 쓰는 유일한 키. 자기 말은 이미
      // type/element/skills까지 전부 공개되므로(§2.6.1) rosterId 추가는 새 노출이 아니다 — 종전 whitelist의 누락이었다.
      rosterId: T.ecoKey(p), // #237 전설 칸은 rosterId 가 없다 — 진열·가방과 같은 종 키(ecoKey, 일반은 rosterId 그대로)
      skills: this._skillsFor(T, p, true), cdMax: p.cdMax, immobile: p.immobile, cap: p.cap,
      healing: p.healing, alive: p.alive, placed: p.placed, movedEver: p.movedEver, revealed: p.revealed,
      burn: p.burn, weaken: p.weaken, shield: p.shield, shock: p.shock, dmgCut: p.dmgCut,
      focusCharge: p.focusCharge, vulnMark: p.vulnMark, powerBuff: p.powerBuff, fleeBoost: p.fleeBoost,
      /* #233 (GDD-23 3.2·3.3·3.5·4.5) — 자기 말의 8스탯과 새 지속 상태. 등급 A(자기 좌석)는 이미 type·element·
         skills·cds·cap·atk·skillAtk 까지 전부 받으므로(§2.6.1) 정보 경계는 그대로다.
         여섯 개(def·spd·dodge·crit·statusPct·grade)는 **한 묶음**이다 — 클라이언트 netStubStats(demo/index.html)가
         `typeof u.def==="number"` 하나로 분기해 나머지를 함께 읽기 때문에, def만 보내면 grade가 null로 덮여
         자기 ⭐1 하수인의 등급이 사라진다.
         이 묶음이 고치는 실제 버그: 엔진은 동료의 암살자/방패병 구분을 mkPiece 의 allyIdx 로만 쓰고 말에는 남기지
         않는다(demo/index.html mkPiece). 그래서 클라이언트 폴백은 자기 동료 둘을 모두 암살자(def5·spd12)로 본다 —
         서버가 실제 값을 보내면 방패병이 제 블록(def20·spd6)을 되찾는다. 동료 subtype 키를 새로 만들지 않고
         **주입된 값 자체**를 보내므로 엔진 계약(Mars 소유)을 건드리지 않는다.
         shieldStartPct 는 보내지 않는다 — netStubStats 가 읽지 않고 그리는 곳도 없다(전투 시작 방어막은 서버가
         계산해 shield 합계로 내려간다). shieldLayers 도 보내지 않는다(아래 _serializeBattle 주석과 같은 이유). */
      def: p.def, spd: p.spd, dodge: p.dodge, crit: p.crit, statusPct: p.statusPct,
      grade: p.grade === undefined ? null : p.grade,
      crack: p.crack, harden: p.harden, hardenPct: p.hardenPct, evadeBuff: p.evadeBuff, dmgUpBuff: p.dmgUpBuff,
      /* #234 REVISE 2차 (CJ 결정 2026-09-17) 사신의 낫 전투를 넘는 봉인 0/1/2 — 소유자 전용(등급 A). 재연결 뒤에도 봉인 사유
         (reaperWhy)를 되살리는 데 필요하다. 상대 뷰(_serializeKnownOpponent·_serializeUnknownOpponent)와 상대 전투원
         뷰에는 싣지 않는다: 봉인은 "그 말이 지난 전투에서 사신의 낫을 썼다/가졌다"를 알려 주는 미공개 기술 정보다. */
      reaperSeal: p.reaperSeal || 0,
      // #237 소유자 전용 경제 칸 — 원장·신규 표시·교체 표식 (속성 미선택은 상점 뷰 syn.pending 이 알린다 — #234 경계상 leaderElChosen 은 싣지 않는다)
      paid: p.paid || 0, fresh: !!p.fresh, swapMark: !!p.swapMark,
    };
  }

  /* 등급 C-2 (공개된 상대): 정체·HP까지만. skills/cds/cap/전투 버프는 없다(§2.6.1).
     #233 — 8스탯·등급·새 지속 상태를 **여기에는 넣지 않는다**(의도적 보류):
     ① 보드 뷰에는 이 값들을 그리는 경로가 자체가 없다 — 상태 아이콘(stIcons)은 전투 화면 전용이다.
     ② 공개된 상대 하수인·왕은 이미 보내는 rosterId/type 으로 ROSTER→ARCHETYPE_BASE·KING_BASE 를 찾아
        클라이언트가 **같은 값을 스스로 유도**한다(netStubStats). 보내도 정보량이 늘지 않는다.
     ③ 유일하게 유도 불가인 것은 상대 동료의 암살자/방패병 구분이다. 엔진이 말에 subtype 을 남기지 않으므로
        서버가 그 스탯을 보내면 **새 노출**이 되는데, 이를 소비하는 표시가 없다 — GDD-23 7.9(등급·미사용
        스킬·집계 비공개)의 최소 공개 원칙대로 경계를 유지한다.
     ④ 등급(grade)은 7.9·8.1⑦이 소유자 전용으로 못박은 값이라 공개 상대 뷰에 실을 수 없다.
     상대 동료 스탯이 정말 필요해지면 두 전투원이 서로 공개된 **전투 뷰**에서 다시 합의해 내보낸다. */
  /* #237 (GDD-23 7.9·8.1⑦) 경제 경기에서는 최대 HP 가 등급마다 달라 "종(name) + maxHp" 로 상대 등급이 역산된다.
     그래서 상대 말 HP 는 **100 눈금 비율**로만 싣는다: maxHp=100 고정, hp=ceil(hp/maxHp×100)(살아 있으면 1 이상).
     클라이언트는 필드 모양을 바꾸지 않고 그대로 HP 바를 그린다 — 숫자가 "N/100" 으로 보일 뿐이다(Mars 표기 인계). */
  _serializeKnownOpponent(p) {
    const hp = this.economy ? { hp: pct100(p.hp, p.maxHp), maxHp: 100 } : { hp: p.hp, maxHp: p.maxHp };
    return {
      id: this._alias(p.id), r: p.r, c: p.c, owner: p.owner, alive: p.alive, immobile: p.immobile,
      type: p.type, name: p.name, element: p.element, hp: hp.hp, maxHp: hp.maxHp, healing: p.healing,
      // #217 Saturn ctx_e6437fa06ae4 REVISE — 공개 상대 보드 하수인 아이콘(artDirOf)이 쓰는 유일한 키.
      // name이 이미 ROSTER 20종을 1:1로 특정하므로(art-restore-fields.md §"새 노출 아님") 형태만 추가하는
      // 표시 whitelist 복구다 — 정보량 증가 없음. 하수인이 아니면(왕/동료) 항상 null.
      rosterId: p.type === 'minion' ? (p.rosterId || null) : null,
      ...(p.swapMark ? { swapMark: true } : {}), // #237 "상점에서 교체됨" — 7.9 가 상대에게 허용한 유일한 상점 표식
    };
  }

  // 등급 B (미공개 상대): 위치·생존만. #237 "상점에서 교체됨" 표식은 공개 표식이라 여기에도 실린다(7.9).
  _serializeUnknownOpponent(p) {
    return { id: this._alias(p.id), r: p.r, c: p.c, owner: p.owner, alive: p.alive, immobile: p.immobile, ...(p.swapMark ? { swapMark: true } : {}) };
  }

  // 자기 전투원의 기술은 전부, 상대 전투원의 기술은 revealedSkills에 있는 인덱스만 이름·쿨을 싣는다 (§2.6.2).
  /* #234 (GDD-23 7.9 "등급 · 쓰지 않은 스킬은 소유자 화면에만") — 스킬 칸 수가 곧 등급(⭐N = N칸)이 됐다.
     종전처럼 상대 칸마다 {i,revealed:false,kind} 를 보내면 배열 길이로 등급이, kind 로 미사용 스킬 종류가 드러난다.
     그래서 상대에게는 **공개된 칸만** 원래 인덱스 i 와 함께 보내고, 미공개 칸이 하나라도 남아 있으면 개수·종류 없는
     자리표시 {revealed:false} **하나**만 덧붙인다. 클라이언트 표시(battleModal 패널·커맨드)가 이미 미공개 칸을 개수 없이
     "? 미공개" 하나로 접으므로 화면은 같다(netAdaptSkills 는 위치로 읽고 i 를 쓰지 않는다).
     남는 한계: "미공개 칸이 남았는가" 1비트는 그 화면 표시와 같은 양으로 나간다(보고서 11.3). 공개된 스킬 이름은 종의 ⭐ 순서를
     따르므로 공개 자체가 등급 하한을 알려 주는 것은 규칙상 공개 범위다. */
  _skillsFor(T, p, mine) {
    if (!p.skills) return null;
    const out = [];
    let hidden = false;
    p.skills.forEach((sid, i) => {
      if (mine || (p.revealedSkills && p.revealedSkills.includes(i))) {
        out.push({ i, revealed: true, id: sid, name: T.skillNameKo ? T.skillNameKo(sid, p.element) : sid, cd: p.cds ? p.cds[i] : 0 });
      } else hidden = true;
    });
    if (hidden) out.push({ revealed: false });
    return out;
  }

  // 전투 문맥 공개 (§2.6.2) — 그 전투 동안 양쪽이 이미 보는 hp/shield/상태·이 전투에서 쓴 아이템/볼/버프 기록.
  _serializeBattle(T, battle, seatIndex) {
    const side = (owner, f, piece, sfx) => {
      const bodyFight = f === piece; // 본체 출전(f===piece) vs 포획·예비 하수인 대리 출전(#91 artDirOfFighter와 같은 구분)
      const scaled = this.economy && owner !== seatIndex; // #237 상대 전투원 HP·방어막은 100 눈금(등급 역산 차단 — _serializeKnownOpponent 와 같은 계약)
      return {
        owner, hp: scaled ? pct100(f.hp, f.maxHp) : f.hp, maxHp: scaled ? 100 : f.maxHp,
        shield: scaled ? pct100(f.shield || 0, f.maxHp) : (f.shield || 0), burn: f.burn || 0, weaken: f.weaken || 0,
        shock: f.shock || 0, shockFresh: !!f.shockFresh, dmgCut: f.dmgCut || 0, focusCharge: !!f.focusCharge,
        /* #233 (GDD-23 4.5) 균열·경화 — 이미 내려보내는 burn/weaken/shock/dmgCut/vulnMark 와 **같은 등급**이다.
           원본 stIcons(f)(demo/index.html)가 두 전투원 패널 모두에 뷰어 분기 없이 이 셋을 그리고, #121 계약
           3.1·9 가 "적용된 효과는 상대에게도 공개(재고·선택만 비공개)"로 이미 확정한 범위다. 그래서 전투 문맥
           공개(§2.6.2)에 그대로 들어간다 — 전투가 끝나 battle 객체가 사라지면 이 필드도 함께 사라진다.
           hardenPct 는 stIcons 가 감소율을 숫자로 찍으므로(🛡경화 N%·NR) 잔여 라운드만으로는 복원되지 않는다. */
        crack: f.crack || 0, harden: f.harden || 0, hardenPct: f.hardenPct || 0,
        /* 전투 뷰에 **넣지 않는 것** (#233 최소 공개):
           · evadeBuff·dmgUpBuff — stIcons 목록에 없고 어떤 뷰도 읽지 않는다. 공개 방 클라이언트는 피해를
             계산하지 않으므로(서버 권위) 표시에 필요 없다.
           · shieldLayers — 화면은 층 합계 하나(f.shield·shbar)만 그린다(3.2 "층 합계를 방어막 바 1개로 표시").
             층 배열은 획득원 태그(guardStart·selfSkill·grassLegacy·기술 이름)를 달고 다녀 상대의 아키타입과
             아직 쓰지 않은 기술을 역산하게 해 준다 — 표시에 불필요하면서 §2.6.2 의 기술 은닉을 우회하는 값이라
             내보내지 않는다. 락스텝 요약(lockstepDigest)에는 서버 안에서만 들어간다.
           · def/spd/dodge/crit/statusPct/grade — 전투 화면에 렌더 경로가 없다. 기술 위력 표기(dmgRange·slotPow)는
             atk 만 쓰고, atk/skillAtk 자체도 #217 에서 "유도 가능·표시 불필요"로 철회한 선례를 그대로 따른다.
             grade 는 GDD-23 7.9·8.1⑦이 소유자 전용으로 못박았다.
           · absorbed·pendingFx — 서버 판정용 내부 상태이고 표시 대상이 아니다. */
        // 기존 버그: 대리 출전이면 실제 싸우는 건 f(cap)인데 piece(왕/동료 본체, skills:null)를 읽어 항상 null이 됐다.
        vulnMark: !!f.vulnMark, skills: this._skillsFor(T, f, owner === seatIndex),
        // #217 Mars ctx_75a85d4c58fb 델타 — cd/atk/skillAtk는 제안 후 Mars가 철회했다(msg_db7a8fa06aee):
        // 왕/동료 본체는 BAL.ally/king에 skill이 없어 skillAtk=0·스킬 버튼 자체가 없으므로 cd가 항상 무의미하고,
        // atk/skillAtk도 자기 pieces/cap 또는 공개 ROSTER/BAL로 대부분 유도 가능해 필수 노출이 아니다(포획 대리
        // 출전의 상대 cap 수치만 유도 불가하지만 원본 UI도 그 경우 "?"만 보여줄 뿐이다) — 불필요한 공개 확장은
        // 하지 않는다.
        // rec = 이 쪽이 상대에게 기록한 피해(상대 최대 HP 로 상한) — 내 기록은 상대 최대 HP 를 드러내므로 100 눈금(#237)
        rec: this.economy && owner === seatIndex ? pct100(battle['rec' + sfx] || 0, (sfx === 'A' ? battle.fd : battle.fa).maxHp) : (battle['rec' + sfx] || 0),
        items: battle['items' + sfx] || 0, itemRound: !!battle['itemRound' + sfx],
        lastItem: battle['lastItem' + sfx] != null ? battle['lastItem' + sfx] : null,
        ballThrow: !!battle['ballThrow' + sfx], buff: battle['buff' + sfx] || null,
        /* #217 Earth art-omission-audit P0(1) — 전투 무대 스프라이트(원본 token()/artDirOfFighter/leaderBattleDir) 복원에
           필요한 최소 식별자. 전투는 지금 이 좌석과 상대가 서로 인접해야만 시작되므로(§4.4 cell 판정) 두 전투원은
           이미 상호 visibleTo이고 startRounds()가 즉시 양쪽 piece.revealed=true를 세운다 — 그래서 상대 쪽에 보내는
           type/element/(본체 minion의) rosterId — **v4.2(Saturn ctx_e6437fa06ae4 REVISE)부터는 `_serializeKnownOpponent`
           (등급 C-2)도 같은 조건(`type==='minion'`)으로 rosterId 를 보내므로 형태까지 동치다**(art-restore-fields.md
           §v4.2). v4.2 이전에도 정보량 자체는 이미 동치였다 — `name`이 로스터 20종을 1:1로 특정하므로(같은 이름을
           쓰는 두 종이 없다), 상대는 units 배열의 name 만으로도 이 rosterId 가 가리키는 동일한 종을 알 수 있었다.
           즉 이 필드가 늘려주는 것은 처음부터 "표시용 키 형태"뿐이었고 판별 가능한 정보량은 v4.2 전후로 변화가 없다.
           진짜 새로 늘어나는 값은 대리 출전(포획/예비)의 artRosterId뿐이다 — 보드 뷰의 cap은 상대에게 절대 안 보내므로
           (§2.6.1) 이 필드만은 형태·정보량 모두 새 노출이다. 다만 정책 신설이 아니라 기존 승인(#91) 동작의 복원이다:
           원본 `token()`/`artDirOfFighter()`(demo/index.html)는 `viewer`/`NET.me`로 분기하지 않고 `pf`(battle.fa/fd)
           기준으로 스프라이트를 그리고, #91 승인 스모크(`smoke_minion_art.js` K9e)가 "전투 스테이지(출전 공개 후)에서만
           대리 전투원의 종이 나타난다"를 명시적으로 고정했다. 권위화 이전 온라인 모델은 두 클라이언트가 각자 전체 로컬
           상태로 같은 락스텝을 돌렸으므로(§0, `hello`/`hello2`) 이 마스킹 없는 렌더가 곧 "양쪽 다 봄"이었다 — 다만 실제
           2브라우저 온라인 접속으로 이 경로를 검증한 기록은 #91 당시에도 없었다(Saturn `issue91-saturn.md`: "실제 온라인
           2연결의 end-to-end 포획/대리 출전 … 은 미검증"). 그래서 이 한 필드는 "코드·승인 계약상 명확히 기존 동작"이되
           "실제 교차 브라우저로 그 순간을 본 적은 없다"는 caveat과 함께 문서화한다(art-restore-fields.md 참조).
           전투가 끝나 battle 객체가 사라지면 이 필드도 함께 사라진다 — board 뷰로 새지 않는다.
           기술 종류(kind)/이름/쿨의 은닉 범위는 그대로다(위 skills 라인). */
        type: piece.type, element: f.element || null, bodyFight,
        rosterId: bodyFight && piece.type === 'minion' ? (piece.rosterId || null) : null,
        artRosterId: bodyFight ? null : (f.artRosterId || null),
        // #234 REVISE 2차 — 사신의 낫 봉인은 자기 전투원에만(키 자체를 상대 쪽에 만들지 않는다 · _serializeOwn 주석).
        ...(owner === seatIndex ? { reaperSeal: f.reaperSeal || 0 } : {}),
        /* #235 공격형·표준 시너지 가산칸 — **자기 전투원에만** 싣는다(reaperSeal 과 같은 owner-only 경계: 상대 쪽에는 키 자체를 만들지 않는다).
           소비자는 ui.js 의 위력 표기 하나다 — slotPow/effAtk(f) 가 atk*(1+synAtk) 로 기술·기본 공격 칸의 dmgRange 를 그린다.
           서버가 안 보내면 netSynthFighter 가 0 으로 합성해 **소유자 화면마저** 실제 피해보다 낮은 위력을 표기한다(실제 판정은 서버 Core 가 낸다).
           나머지 가산칸(synDef·synSpd·synDodge·synCrit·synStatusPct)과 왕국 효과(synEl)는 싣지 않는다 — 표시 경로가 없고
           서버가 판정하므로 필요 없다. 상대 쪽에 실리면 가산분에서 그 좌석의 필드 아키타입·속성 구성이 역산된다(GDD-23 7.9). */
        ...(owner === seatIndex ? { synAtk: f.synAtk || 0 } : {}),
        /* #241 V1·R2 (CJ 승인 2026-09-17) — 적용된 효과라 두 전투원 패널 모두에 그려진다(stIcons 💨회피−N%p·NR · 🌊해일≤X(보류) ·
           HP 바 X 선). burn/shock/crack 과 같은 등급(#121 계약 "적용된 효과는 상대에게도 공개")이므로 뷰어 분기 없이 싣는다.
           해일 X 는 시전자의 공격 계산 결과지만 기획 기본값이 "사용 시 UI 표시(양쪽)"다 — 기술 이름은 이미 사용 순간 공개된다.
           tideBy 는 싣지 않는다: 표식 대상의 반대편으로 항상 유도되고 표시가 읽지 않는다. cdUpFresh(Q3)도 싣지 않는다 —
           ⌛ 값 자체가 미공개 칸 은닉(_skillsFor) 대상이고 표시 경로가 없다. */
        evadeDown: f.evadeDown || 0, evadeDownR: f.evadeDownR || 0,
        // #237 해일 X 는 HP 선(HP 바 위 X 위치)이라 상대 쪽은 hp·shield 와 같은 100 눈금 — 원값이면 비율 HP 와 어긋나고 최대 HP 가 역산된다
        tideMark: scaled ? pct100(f.tideMark || 0, f.maxHp) : (f.tideMark || 0), tideHeld: !!f.tideHeld,
      };
    };
    /* #241 R1 번개 꼬리 추가 공격 단계 — 양 좌석에 side 만 공개(행동 중인 쪽 · 상대 화면의 대기 표시). allowed 는 소유자 좌석에만:
       allowed = 기본기·2차·3차 중 i < skills.length 로 걸러져 **칸 수(= 등급, GDD-23 7.9 소유자 전용)** 를 드러낸다.
       saved(2·3차 ⌛ 사본)·tailSlot 은 어느 좌석에도 싣지 않는다 — ⌛ 복원은 서버 엔진이 하고 클라이언트는 표시에 쓰지 않는다. */
    const bn = battle.bonus && battle.bonus.stage === 'active' && (battle.bonus.side === 'A' || battle.bonus.side === 'D') ? battle.bonus : null;
    const bnOwner = bn ? (bn.side === 'A' ? battle.attP.owner : battle.defP.owner) : null;
    const bonus = bn ? (bnOwner === seatIndex ? { side: bn.side, allowed: (bn.allowed || []).slice() } : { side: bn.side }) : null;
    return {
      round: battle.round,
      phase: battle.phase,
      actor: T.actorOfPhase ? T.actorOfPhase() : null,
      actSeq: battle.actSeq || 0,
      maxRounds: battle.maxRounds != null ? battle.maxRounds : null,
      // #217 Mars 델타 — fx.events의 battleId(§7.2)와 같은 값을 battle 스냅샷에도 직접 실어, 연속 전투 중
      // "지금 이 battle 객체가 어느 fx 창 battleId와 대응하는지"를 클라이언트가 fx 이벤트 join 없이 바로 안다.
      // engine.js hookBattleAccessor가 S.battle 대입 순간 발급하는 같은 카운터(T.__fx.lastBattleId)를 읽을
      // 뿐 새 값을 만들지 않는다 — battle이 열려 있는 한 항상 정수다.
      battleId: T.__fx && Number.isInteger(T.__fx.lastBattleId) ? T.__fx.lastBattleId : null,
      a: side(battle.attP.owner, battle.fa, battle.attP, 'A'),
      d: side(battle.defP.owner, battle.fd, battle.defP, 'D'),
      bonus,
      // 이 좌석 시점 엔진의 전투 로그. #237 경제 경기는 같은 문구를 주어 표기와 함께 담은 fx 창(문구 정리 완료)에서 이 전투 몫만 싣는다
      log: this.economy
        ? this._snapshotFx(T).events.filter((e) => e.src === 'msg' && e.battleId === (T.__fx && T.__fx.lastBattleId)).map((e) => e.txt).slice(-40)
        : (battle.blog || []).slice(-40),
    };
  }

  lobbyRow() {
    return { roomId: this.roomId, label: '방 #' + this.roomId, ageSec: Math.floor((now() - this.createdAt) / 1000), seats: '1/2' };
  }

  isListable() { return this.isPublic && this.state === STATES.OPEN; }
}

module.exports = { Room, STATES, DISCONNECT_GRACE_MS, ACTION_TYPES, BATTLE_CMDS, ECO_VERBS, battleFrame, lockstepDigest, catalog };
