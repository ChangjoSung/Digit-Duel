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
  /* #245 Saturn REVISE(M2): AI 가 고른 행동은 origin 표식을 달고 들어온다 — "🤖 …" 기록·안내를 Core 가 내기 위한
     **데이터 한 칸**이고(함수 아님), 규칙 판정에는 쓰이지 않는다. toast 는 종전 호출처의 안내 유무를 그대로 옮긴 것이다. */
  | { t: "heal"; id: number | null; origin?: "ai"; toast?: boolean }
  | { t: "move"; id: number; r: number; c: number; origin?: "ai" }
  | { t: "teleSwap"; a: any; b: any; origin?: "ai" }
  | { t: "drainForced"; autoStart: boolean }
  | { t: "endTurn" }
  | { t: "gameOver"; winner: number | null; winType: string | null; endingBattle?: any }
  | { t: "resign" }
  | { t: "search"; id?: number | null; r?: any; c?: any; ei?: any; origin?: "ai" }
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
  | { t: "netSetup"; player: number; data: any }
  | { t: "hydrate"; seat: number; view: any }
  | { t: "beginPlay" }
  | { t: "startTurn" }
  | { t: "forcedClear" }
  | { t: "btBannerShown" }
  | { t: "searchEndLatch"; seq: number; turn?: number; cur?: number } // #245 M3: 늦은 재개를 거르는 대조값을 액션이 들고 온다
  /* #245 Saturn REVISE(M3): 예약·카운트다운은 전투원 객체가 아니라 **상태 안의 자리(side)** 를 싣는다 —
     액션이 상태를 우회해 남의 객체를 건네는 통로가 없다. side 가 null 이면 가리킬 자리가 없다는 뜻(무동작). */
  | { t: "delaySchedule"; side: BattleSide | null; delayRounds: number; run: any; tag?: any }
  | { t: "delayTick"; side: BattleSide | null }
  /* #245 Saturn REVISE(M3): 전투 개시와 출전 선택 — 어느 것도 함수·말 객체를 싣지 않는다 (id·자리·선택지뿐). */
  | { t: "battleStart"; attId: number; defId: number }
  | { t: "battleEntryBegin"; attId: number; defId: number }
  | { t: "battleEntryPick"; side?: "A" | "D"; what: "body" | "cap" | "bag"; uid?: number }
  | { t: "battleEntryGo" }
  | { t: "battleEntryAbort" }
  | { t: "fleeSwapResume"; pieceId: number | null; oppId: number | null }
  /* #236 경제 거래 — 로컬 모드 전용(회선에 싣지 않는다, 온라인 권위는 #237). 거래마다 액션 하나이고 player 가 주인이다.
     seq = 그 플레이어 진열 번호(새로 고침·구매마다 +1) — 지난 진열로 온 구매·새로 고침은 거부된다. uid = 가방 말 번호. */
  | { t: "shopBuy"; player: number; i: number; seq: number }
  | { t: "shopRefresh"; player: number; seq: number }
  | { t: "shopGood"; player: number; item: string }
  | { t: "shopSell"; player: number; uid: number }
  | { t: "shopSwap"; player: number; pieceId: number; uid: number }
  | { t: "shopTicket"; player: number; pieceId: number; el: string }
  | { t: "leaderEl"; player: number; pieceId: number; el: string }
  | { t: "shopDone"; player: number }
  | { t: "shopTimeout"; player: number }
  | { t: "bagPick"; player?: number; i: number; token: number }
  | { t: "buffUse"; key: string; frame?: any; wire?: BattleWire };

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
  | { type: "toast"; message: string; kind?: string }
  /* ── #245 Saturn REVISE(M1) Core 가 화면에 말을 거는 의미 이벤트 ──
     Core 에는 HTML 도 window 콜백도 없다. 아래는 전부 **값만** 싣는다 (함수 없음) — ui.js 가 그것을 화면으로 바꾼다. */
  | { type: "logAppended" }                                   // 공개 기록에 줄이 붙었다 (S.log 는 Core 가 쓴다)
  | { type: "battleRedraw" }                                  // 전투 행동 화면 다시 그리기
  | { type: "closeOverlay" }                                  // 열린 창 닫기
  | { type: "gameReset" }                                     // 새 게임 — 남은 연출·대기 콜백 무효
  | { type: "tutHint"; key: string }                          // 첫 1회 도움말 (게임 상태 무변경)
  | { type: "memoPick"; piece: BoardPiece }                   // 추측 메모 피커
  | { type: "contactSituation"; att: BoardPiece; def: BoardPiece }
  | { type: "contactBanner"; piece: BoardPiece; sub: string | null }
  | { type: "matchBanner"; banner: { title: string; sub?: string; cls: string } }
  | { type: "searchBanner"; owner: number | null; mine: boolean; fxKey: string; title: string; sub: string }
  | { type: "searchEndLatched" }                              // 완료 래치가 올라갔다 → 사람 클라이언트의 자동 턴 종료 재평가
  | { type: "turnReady"; player: number; handoff: boolean }   // 핫시트는 기기 넘김 뒤 배너
  | { type: "resignPrompt"; player: number; turn: number }    // 확인 창은 표시 계층 소유. 확정은 사람 입력 경로로 돌아온다
  /* 출전 선택(보류 결정)의 두 단계 — 답은 battleEntryPick·battleEntryGo 액션으로만 돌아온다 */
  | { type: "battleEntryPrompt"; side: "A" | "D"; owner: number; pieceId: number; pieceType: string;
      reserve: { element: string | null; hp: number; maxHp: number } | null;
      cap: { element: string | null; hp: number; maxHp: number } | null;
      bag?: { uid: number; name: string; element: string | null; grade: number; hp: number; maxHp: number }[] } // #236 가방 대리 후보 (소유자 전용)
  | { type: "battleEntryReveal"; desc: string }
  | { type: "battleEntryStep" }                               // 보류 결정을 상태에서 다시 읽어 한 걸음 (Core 전용)
  | { type: "battleEntryStart"; attId: number; defId: number; A: string | null; D: string | null; aU?: number; dU?: number }
  /* #236 경제 — 상점·B08. 금액·내용은 이벤트에 싣지 않는다(화면이 소유자 시점으로 상태를 읽는다) */
  | { type: "shopOpened" }
  | { type: "shopChanged"; player: number; toast: string }
  | { type: "shopRefused"; player: number; message: string }
  | { type: "shopHandoff"; player: number }
  | { type: "shopClosed"; kind: string; player: number; all: boolean; bt: boolean }
  | { type: "aiShopTurn"; player: number }
  | { type: "bagPickOpen"; owner: number }
  | { type: "bagPickDone"; owner: number; released: boolean }
  | { type: "aiBagPickTurn"; owner: number }
  | { type: "battleBegan"; attId: number; defId: number }     // 전투 개시 실행 (Core 전용)
  | { type: "fleeSwapPromptRun"; pieceId: number | null; oppId: number | null }
  /* 연출·AI 어댑터가 받는 이벤트 — 실리는 것은 전부 값이다 (함수 없음).
     규칙을 잇는 다음 액션은 이벤트가 아니라 UI_PORT.defer(action) 로 건너간다 (기본 구현은 거절하고 Core 가 즉시 실행). */
  | { type: "fx"; item: any }                                 // 연출 큐 항목 (배너·폭발·함정 — 표시 값만)
  | { type: "battleEndFx"; queue: any[]; banner: { title: string; sub?: string; cls: string } }
  | { type: "aiTurn"; player: number }                        // AI 다음 수 예약
  | { type: "aiSetupTurn"; player: number }                   // AI 배치 단계 자동 진행
  | { type: "aiRecruitTurn"; owner: number; pieceId: number } // AI 탐색 보상 선택 자동 진행
  | { type: "aiActed"; kind?: string }                        // (예비) AI 행동 고지 — 현재는 Core 가 직접 기록한다
  | { type: "setupRosterChanged"; complete: boolean }
  | { type: "setupNetworkReady"; setup: { roster: string[]; pos: number[][] }; publicMode: boolean }
  | { type: "setupHandoff"; player: number }
  | { type: "setupBegin" }
  | { type: "setupAiBegin" }
  | { type: "teleTrapped"; player: number; message: string }
  | { type: "teleRefused"; player: number; message: string }
  | { type: "teleSwapped"; player: number; pieces: BoardPiece[]; healBroken: boolean[]; traces: number; forced: { id: number; list: number[] } | null; kingReach?: boolean } // kingReach 갈래만 — 화면 갱신을 matchEnded·kingReached 에 넘긴다
  | { type: "healStarted"; piece: BoardPiece }
  | { type: "mainSkipped"; player: number; origin?: string; toast?: string | false } // AI 자동 생략은 toast:false 로 토스트를 끈다 (실측)
  | { type: "moved"; piece: BoardPiece; trace: boolean; healBroken: boolean; collision: boolean; forced: number[] | null; kingReach?: boolean } // kingReach 갈래만 — 화면 갱신을 matchEnded·kingReached 에 넘긴다
  | { type: "forcedExempt"; owner?: number; message: string; toast?: string } // 대상이 사라진 면제는 owner 를 싣지 않는다 (실측)
  | { type: "forcedPromoted"; piece: BoardPiece; list: number[]; autoStart: boolean }
  | { type: "searchRefused"; owner: number }
  | { type: "searched"; owner: number; piece: BoardPiece; healBroken: boolean }
  | { type: "searchDone"; owner: number; title: string; sub: string; fxKey?: string; tut?: string; seq: number }
  | { type: "recruitOpened"; owner: number; piece: BoardPiece }
  | { type: "recruitStage" }
  | { type: "recruitClosed" }
  | { type: "kingReached"; owner: number }
  | { type: "netSetupCorrupt"; player: number }
  | { type: "playBegan"; player: number; bt: boolean }
  | { type: "turnStarted"; bt: boolean }
  | { type: "turnEnded"; player: number; healed: any[]; simDraw?: boolean; bt?: boolean; shop?: boolean } // #236 shop: 정기 상점이 열려 다음 턴을 미뤘다 // sim 무승부 갈래만 simDraw, 정상 교대 갈래만 bt (실측: emit 지점 2곳)
  | { type: "matchEnded"; winner: number | null; winType: string | null; interrupted: boolean; banner: boolean; resignLoser?: number } // resignLoser 는 resign 갈래만 덧붙인다
  | { type: "pkgOpenModal"; kind: string; owner: number; round: number; id: number }
  | { type: "pkgPicked"; owner: number | null; toast?: string }
  | { type: "delayedFired"; side: BattleSide | null; fired: BattleDelayedFx[] }
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
/* replaceBoard: 그 액션이 보드를 통째로 갈아끼운다고 선언한 경우에만 실린다 (공개 방 권위 스냅샷 재수화).
   commitCoreState 가 말 객체 정체성 보존을 건너뛸지 여기서만 정해진다 — 임의의 액션이 켤 수 있는 스위치가 아니다. */
type CoreResult = { state: GameState; events: CoreEvent[]; replaceBoard?: boolean } | null;

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
type BoardPiece = Omit<Piece, WireOmitted> & Partial<Pick<Piece, WireOmitted>> & { reaperSeal?: number;
  /* #236 로컬 경제에서만 붙는 칸 — 원장(이 개체에 낸 코인) · 신규 표시 · "상점에서 교체됨" 표식 */
  paid?: number; fresh?: boolean; swapMark?: boolean };

/** 포획 예비 슬롯 — 보드 정체(id·owner·r·c·placed) 없이 전투 수치만 든 말 기록. */
type ReservePiece = Partial<Piece> & { [k: string]: any };

/** #236 상점 한 번의 오픈 (core.js ecoOpenShop 한 곳이 만든다). 진열·판매 잠금·완료는 플레이어별이다.
    active: 핫시트 순차 상점에서 지금 쓰는 사람(동시 오픈은 null) · next: 상점이 닫히면 턴을 받을 사람 */
interface EcoShop {
  kind: "start" | "regular"; turn: number;
  seq: number[]; slots: ({ key: string; grade: number } | null)[][]; sold: string[][]; done: boolean[];
  active: number | null; next: number | null;
}

/** #236 로컬 경제 상태 (state.js newEcoState 한 곳이 만든다). 온라인 경기에는 S.eco 자체가 없다.
    전부 소유자 전용 정보다(GDD-23 7.9) — 화면·로그·AI 는 자기 좌석 칸만 읽는다. */
interface EcoState {
  coins: number[];
  bag: ReservePiece[][];                    // 가방 3칸 — 구매·포획·전설 공용
  tickets: number[];
  buffInv: { power: number; time: number; escape: number }[];
  soldHp: Record<string, number>[];         // 종별 마지막 판매 당시 HP 비율
  shop: EcoShop | null;
  bagPick: { owner: number; unit: ReservePiece; token: number } | null; // B08
  unitSeq: number;                          // 가방 말 uid 발급 번호
}

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

/** #235 한 좌석의 시너지 집계 한 벌 — 필드 9칸의 속성별 칸 수 · 타입별 칸 수(가방 전설 포함) · 사망한 하수인·동료 칸 수.
    Core 의 synCount() 하나가 만들고, 단계·수치는 전부 여기서 파생된다(별도 저장 없음). */
type SynSnapshot = { el: Record<string, number>; arch: Record<string, number>; dead: number };
/** 좌석 0·1 의 스냅샷 한 쌍 — startRounds 가 참전 확정 순간에 굳힌다. */
type SynSnapshots = { [seat: number]: SynSnapshot };

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
  syn?: SynSnapshots | null;  // #235 참전 확정 순간 고정된 시너지 집계 (권위 방 복원은 싣지 않는다 — 서버가 보내지 않는다)
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
