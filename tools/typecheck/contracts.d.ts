// #245 계약 선언 — 상태·액션·이벤트·프로토콜 네 경계 중 **손으로 적어야 하는** 것을 여기 둔다.
// GameState·Piece 는 여기 없다: demo/js/state.js 의 newGameState()·mkPiece() 리터럴에서 직접 끌어오므로
// 표를 두 벌 관리하지 않는다. 여기 있는 것들은 리터럴 한 곳에서 나오지 않는 **합집합**이라 손으로 적는다.

/** JS 객체 리터럴에서 끌어온 타입을 **봉인**한다.
    tsc 는 .js 파일의 리터럴 타입에 나중 대입으로 칸을 몰래 늘려준다(expando) — 그러면 `S.mainUsedd=true` 같은
    오타가 상태 계약을 통과한다. 매핑 타입을 한 번 거치면 그 성질이 끊겨 선언된 칸만 남는다. */
type Sealed<T> = { [K in keyof T]: T[K] };

/** 보드 숲 이벤트 칸 (state.js genEvents) */
interface BoardEvent { r: number; c: number; kind: string; consumed: boolean; [k: string]: any }

/** 전투의 두 자리. A = 접촉을 건 쪽(attP/fa), D = 받은 쪽(defP/fd). **차례(phase)는 숫자다** — 섞지 않는다. */
type BattleSide = "A" | "D";

/** 전투 겨냥 문맥 — netAction 의 a.bf · reducer 의 action.wire · core.js battleActionFrame() 이 같은 모양을 쓴다.
    값의 출처는 core.js battleActionFrame 하나다: side=actorOfPhase() (A|D) · seq=B.actSeq · round=B.round · phase=B.phase(숫자).
    core.js BF_KEYS 가 런타임에서 같은 네 이름을 보고, 여기서는 **타입까지** 본다 — side 와 phase 를 맞바꾸면 그 자리에서 걸린다. */
interface BattleWire { side: BattleSide; seq: number; round: number; phase: number }

// ── 액션 계약 ────────────────────────────────────────────────────────────────
// dispatchCoreAction·netAction·온라인 재생이 reduceCoreAction 에 넣는 어휘 전부.
// 필드를 빠뜨리거나 t 를 잘못 적으면 reducer 본문의 action.x 접근이 그 자리에서 걸린다.
type CoreAction =
  | { t: "cell"; r: any; c: any }
  | { t: "selTray"; id: number }
  | { t: "roster"; rid: string }
  | { t: "auto" }
  | { t: "clear" }
  | { t: "setupAuto"; player: number; roster: string[]; positions: { id: number; r: number; c: number }[] }
  | { t: "setupConfirm"; preparing: boolean; publicMode: boolean }
  | { t: "tele" }
  | { t: "skipMain"; origin?: string; toast?: string | false }
  | { t: "heal"; id: number | null }
  | { t: "move"; id: number; r: number; c: number }
  | { t: "teleSwap"; a: any; b: any }
  | { t: "drainForced"; autoStart: boolean }
  | { t: "endTurn" }
  | { t: "gameOver"; winner: number | null; winType: string | null; endingBattle?: any }
  | { t: "resign" }
  | { t: "search"; id?: number | null; r?: any; c?: any; ei?: any }
  /* #245 Saturn REVISE(HIGH 2): recruit 액션이 싣는 token 은 **문자열**이다 — reducer 가 발급하는 값이
     `말id + "#" + 발급번호`(core.js:363)이고 recruitState() 가 그 형식을 다시 검사한다. 상태의 숫자
     카운터(GameState.recruitToken)와는 다른 것이라 타입도 다르게 둔다. 섞으면 `action.token!==R.token` 이
     영영 참인 비교가 되어 모든 recruit 입력이 조용히 떨어진다. */
  | { t: "recruit"; step: string; i: number; token: string }
  | { t: "pkgOpen"; kind: string; frame?: any; wire?: BattleWire }
  | { t: "pkgPick"; what: string; i: number; id: number; frame?: any }
  | { t: "pkgCancel"; id: number; frame?: any }
  | { t: "item"; i: number; frame?: any; wire?: BattleWire }
  | { t: "ball"; frame?: any; wire?: BattleWire }
  | { t: "flee"; frame?: any; wire?: BattleWire }
  | { t: "pass"; frame?: any; wire?: BattleWire }
  | { t: "act"; k: string; frame?: any; wire?: BattleWire }
  | { t: "delaySchedule"; f: any; delayRounds: number; run: any; tag?: any }
  | { t: "delayTick"; f: any };

/** reduceCoreAction 이 실제로 받는 t 값. 서버 protocol.js ACTION_TYPES 와의 대조는 tools/typecheck/test 가 본다. */
type CoreActionType = CoreAction["t"];

// ── 이벤트 계약 ──────────────────────────────────────────────────────────────
// reducer 가 돌려주고 applyUiEvents(ui.js) 가 소비하는 표시 이벤트 전부. 송신하지 않는다 — 화면용이다.
// type 을 잘못 적으면 emit 쪽이, 없는 칸을 읽으면 소비 쪽이 걸린다.
/* #245 Saturn REVISE(HIGH 3): **포괄 인덱스 시그니처(`[k:string]:any`)를 하나도 두지 않는다.**
   그게 있으면 emit 쪽의 `slot` → `slto` 도, 소비 쪽의 `event.slot` → `event.slto` 도 진단 없이 통과해
   이벤트 계약이 사실상 없는 것과 같아진다. 아래 칸은 core.js 의 실제 emit 지점과 ui.js applyUiEvents 의
   실제 소비 지점을 맞춰 적은 것이고, `?` 는 "그 emit 지점이 싣지 않는다"는 실측이다.
   any 는 계약 경계 밖의 **중첩 객체**(전투 메시지 큐·회복 틱 묶음)에만 쓴다 — 이벤트 자체는 닫혀 있다.
   종전 목록에 있던 `minion` 은 emit 지점도 소비 지점도 없어 삭제했다 (실측: demo/js 전체에서 0건). */
type CoreEvent =
  | { type: "render" }
  | { type: "toast"; message: string }
  | { type: "setupRosterChanged"; complete: boolean }
  | { type: "setupNetworkReady"; setup: { roster: string[]; pos: number[][] }; publicMode: boolean }
  | { type: "setupHandoff"; player: number }
  | { type: "setupBegin" }
  | { type: "setupAiBegin" }
  | { type: "teleTrapped"; player: number; message: string }
  | { type: "teleRefused"; player: number; message: string }
  | { type: "teleSwapped"; player: number; pieces: BoardPiece[]; healBroken: boolean[]; traces: number; forced: { id: number; list: number[] } | null }
  | { type: "healStarted"; piece: BoardPiece }
  | { type: "mainSkipped"; player: number; origin?: string; toast?: string | false } // AI 자동 생략은 toast:false 로 토스트를 끈다 (실측)
  | { type: "moved"; piece: BoardPiece; trace: boolean; healBroken: boolean; collision: boolean; forced: number[] | null }
  | { type: "forcedExempt"; owner?: number; message: string; toast?: string } // 대상이 사라진 면제는 owner 를 싣지 않는다 (실측)
  | { type: "forcedPromoted"; piece: BoardPiece; list: number[]; autoStart: boolean }
  | { type: "searchRefused"; owner: number }
  | { type: "searched"; owner: number; piece: BoardPiece; healBroken: boolean }
  | { type: "searchDone"; owner: number; title: string; sub: string; fxKey?: string; tut?: string; seq: number }
  | { type: "recruitOpened"; owner: number; piece: BoardPiece }
  | { type: "recruitStage" }
  | { type: "recruitClosed" }
  | { type: "turnEnded"; player: number; healed: any[]; simDraw?: boolean; bt?: boolean } // sim 무승부 갈래만 simDraw, 정상 교대 갈래만 bt (실측: emit 지점 2곳)
  | { type: "matchEnded"; winner: number | null; winType: string | null; interrupted: boolean; banner: boolean; resignLoser?: number } // resignLoser 는 resign 갈래만 덧붙인다
  | { type: "pkgOpenModal"; kind: string; owner: number; round: number; id: number }
  | { type: "pkgPicked"; owner: number | null; toast?: string }
  | { type: "delayedFired"; fired: BattleDelayedFx[] }
  | { type: "battleSlot"; side: BattleSide; slot: number }
  | { type: "battleNextPhase" }
  | { type: "battleBasicCounter"; side: BattleSide }
  | { type: "battleCaptured"; side: BattleSide }
  | { type: "battleFled"; owner: number; piece: BattlePiece; oppPiece: BattlePiece; queue: any[] } // 전투 무대의 말(BattleCmdCtx) 이 그대로 실린다
  | { type: "battleFleeLocked"; owner: number }
  | { type: "battleItemUsed" }
  | { type: "battleLegacySkill"; side: BattleSide };

/** 이벤트 한 종류만 꺼내 쓸 때 (emit 쪽이 표시용 칸을 덧붙이는 자리 등). */
type CoreEventOf<T extends CoreEvent["type"]> = Extract<CoreEvent, { type: T }>;

/** reducer 반환 계약 — 거부는 null 이다 (다음 상태도 이벤트도 없다는 뜻). */
type CoreResult = { state: GameState; events: CoreEvent[] } | null;

// ── 프로토콜 계약 ────────────────────────────────────────────────────────────
// 회선을 타는 프레임. 릴레이(P2P 코드 방)와 권위 서버(공개 방) 두 갈래가 같은 소켓 어휘를 쓴다.

/** 릴레이 방: 시드·배치 교환과 액션 중계 */
type NetRelayFrame =
  | { t: "hello"; seed: number; setup: any }
  | { t: "hello2"; setup: any }
  | { t: "a"; a: NetWireAction };

/* #245 Saturn REVISE(HIGH 4): 권위 서버 봉투는 **닫힌 판별 유니온**이다.
   종전에는 명령 이름만 유니온이고 나머지 칸이 전부 선택적이라 `{v:1,t:"action"}` 처럼 action·baseRevision·
   credential 을 하나도 싣지 않은 봉투가 통과했다 — 서버 validateEnvelope 는 그것을 E_BAD_ENVELOPE 로 떨어뜨린다.
   아래 모양은 server/authoritative/protocol.js validateEnvelope 의 실제 판정을 그대로 옮긴 것이다:
   list_rooms 만 credential 없이 나가고, action 은 action 을, setup 은 roster·pos 를 반드시 싣는다. */
/** 명령 봉투의 credential 부분 — list_rooms 를 뺀 모든 명령이 반드시 싣는다 (validateEnvelope). */
type NetCmdCred = { v: 1; requestId: string; seatToken: string; tokenGen: number };
type NetCommandFrame =
  | { v: 1; t: "list_rooms" }                                                   // 유일하게 credential 없이 나가는 명령
  | (NetCmdCred & { t: "ready" | "unready" | "resign" | "leave" | "resync" })
  | (NetCmdCred & { t: "action"; baseRevision: number; action: NetWireAction })
  | (NetCmdCred & { t: "setup"; roster: string[]; pos: number[][] });

/** 권위 서버가 받는 명령 이름 전부 (COMMAND_TYPES 와 같은 집합). */
type NetCommandType = NetCommandFrame["t"];

/** 회선에만 있는 어휘 — reducer 는 이 t 를 모르고 그대로 지나간다(applyAction 이 푼다). */
type NetOnlyAction =
  | { t: "setupDone" }
  | { t: "fleeSwap"; id: number }
  | { t: "fleeSkip" }
  | { t: "modal"; seq: number; i: number };

/** 회선을 타는 액션 = Core 어휘 + 회선 전용 어휘 + 회선이 덧붙이는 칸
    (bf = 전투 겨냥 문맥 · auto = 자동 턴 종료 표식 · pick = 도망 교환 토큰). */
type NetWireAction = (CoreAction | NetOnlyAction) & { bf?: BattleWire; auto?: boolean; pick?: string | number };

/** reducer·dispatch 가 실제로 받는 것. 오프라인은 CoreAction, 온라인 재생은 회선 액션이 같은 문으로 들어온다. */
type ReducerAction = NetWireAction;

type NetClientFrame = NetRelayFrame | NetCommandFrame;

// ── 상태 계약 보조 ───────────────────────────────────────────────────────────
// GameState·Piece 는 demo/js/state.js 의 리터럴에서 끌어온다. 아래는 그 리터럴 하나로 표현되지 않는
// **실제 사용 모양**이라 여기 적는다 — 전부 #245 정적 검사가 찾아낸 실측 차이다.

/** mkPiece() 가 만들지만 netStubPiece() 가 회선 레코드로 되살릴 때는 싣지 않는 칸 (#245 보고 항목). */
type WireOmitted = "burnFresh" | "crackFresh" | "hardenFresh" | "evadeBuffR" | "dmgUpBuffR" | "allyKind" | "leaderElChosen";

/** 보드 위의 말. 권위 방에서 되살아난 말은 위 칸이 비어 있고, reaperSeal 은 mkPiece 가 만들지 않고 전투 중에 붙는다. */
type BoardPiece = Omit<Piece, WireOmitted> & Partial<Pick<Piece, WireOmitted>> & { reaperSeal?: number };

/** 포획 예비 슬롯 — 보드 정체(id·owner·r·c·placed) 없이 전투 수치만 든 말 기록. */
type ReservePiece = Partial<Piece> & { [k: string]: any };

/** 선택 상태. 보드 말이거나, 배치 트레이의 {tray,id} 다 — 읽는 쪽이 .tray 로 갈라 쓴다. */
type UiSelection = Partial<BoardPiece> & { tray?: boolean; id: number };

// ── 전투·탐색 보상 상태 계약 (#245 Saturn REVISE MEDIUM) ─────────────────────
/* 종전에는 S.battle·S.recruit 이 any 였다 — `S.battle.없는칸` 이 그대로 통과했다.
   둘 다 **닫아** 둔다(포괄 인덱스 시그니처 없음). 런타임 객체 모양은 한 글자도 바꾸지 않았다:
   아래 표는 실제 구축 지점과 실제 접근 지점을 옮겨 적은 것이다. */

/** 전투 무대 위의 말. 로컬 엔진은 보드 말 그대로이고, 권위 방 복원(network.js netSynthBattle)은
    표시에 필요한 정체성 칸만 담은 부분 기록이다 — 그래서 Partial 이다. 없는 칸 이름은 여전히 걸린다. */
type BattlePiece = Partial<BoardPiece>;

/** 지연·예고 효과 한 건 (core.js delaySchedule 이 넣고 delayTick 이 꺼낸다). */
type BattleDelayedFx = { roundsLeft: number; tag: any; run: () => any };

/** #121 개봉이 발급한 표 — 확정·취소가 **자기가 받은 그 번호**를 제시해야 한다. */
type BattlePkgSel = { kind: string; owner: number; side: BattleSide; seq: number; round: number; phase: number; id: number };

/** #241 R1 번개 꼬리 추가 공격 단계. 권위 방 복원은 tailSlot 을 싣지 않는다(서버가 보내지 않는다). */
type BattleBonus = { side: BattleSide; stage: "pending" | "active"; allowed: number[]; saved: any; tailSlot?: number };

/** 전투 인스턴스. 구축 지점이 **둘**이라 한 리터럴에서 끌어올 수 없다:
      · core.js startRounds()        — 로컬 규칙 엔진 (아래 필수 칸 전부)
      · network.js netSynthBattle()  — 권위 방 스냅샷 복원 (같은 필수 칸 + 표시 전용 칸)
    그 위에 전투가 진행되며 붙는 칸(firstSide·menu·pkgSel·chainLock…)이 더 있다. `?` 는 "그 구축 지점이
    싣지 않는다"는 실측이고, 포괄 인덱스 시그니처는 두지 않는다 — 없는 칸 이름은 읽든 쓰든 걸려야 한다.
    전투원(fa/fd)의 내부 수치 구조는 이 네 경계 밖이라 열어 둔다 (data.js 전투 엔진 소유 — 별도 이슈). */
interface BattleState {
  // 두 구축 지점이 모두 싣는 칸
  attP: BattlePiece; defP: BattlePiece;
  fa: any; fd: any;
  round: number; phase: number; actSeq: number;
  maxRounds: number | null;
  recA: number; recD: number;
  itemsA: number; itemsD: number;
  itemRoundA: boolean; itemRoundD: boolean;
  lastItemA: string | null; lastItemD: string | null;
  ballThrowA: boolean; ballThrowD: boolean;
  buffA: string | null; buffD: string | null;
  blog: any[]; msgQ: any[];
  // 전투 개시 직후·진행 중에 붙는 칸 (로컬 엔진)
  firstSide?: BattleSide;      // 1라운드 선턴 — startRounds 가 개시 직후 굳힌다
  firstSideR1?: BattleSide;    // 2라운드부터의 교대 기준 (#234)
  dispHpA?: number; dispHpD?: number; dispShA?: number; dispShD?: number; // 표시용 HP·방어막 바 값
  menu?: string | null;        // 4카테고리 하위 메뉴 (로컬 표시 상태 — 송신 없음)
  pkgSel?: BattlePkgSel | null;
  bonus?: BattleBonus | null;
  chainLock?: boolean;         // resolveTyped 재진입 차단
  reflectSeq?: number;         // 반사·반격을 행동 토큰당 1회로 묶는다
  intro?: boolean;             // 진입 카운트다운 1회 재생
  bannerKey?: string;          // 라운드·단계 배너 1회 재생 키
  // 권위 방 복원만 싣는 표시 칸
  actorOwner?: number;         // 서버가 계산해 보낸 행위자 좌석
  mySide?: BattleSide;         // 내 좌석이 A 인지 D 인지
}

/** core.js battleCmdCtx() 가 돌려주는 전투 커맨드 문맥 — 결집 대조를 통과한 뒤의 "지금 누가 무엇에" 한 묶음.
    거부는 null 이다. side/oSide 가 문자열로 넘어가면 이벤트·전투 계약의 A|D 대조가 사라진다. */
type BattleCmdCtx = { B: BattleState; side: BattleSide; oSide: BattleSide; f: any; opp: any; piece: BattlePiece; oppPiece: BattlePiece; ownerP: number };

/** #121 탐색 보상 선택 상태. 구축 지점은 core.js search reducer **한 곳**이고 token 은 거기서만 발급된다.
    token 은 문자열(`말id#발급번호`)이다 — 숫자 카운터 GameState.recruitToken 과 다른 것이다. */
interface RecruitState {
  owner: number;
  pieceId: number;
  species: string;
  stage: string;
  skill: string | null;
  targetId: number | null;
  recvId: number | null;
  token: string;
}
