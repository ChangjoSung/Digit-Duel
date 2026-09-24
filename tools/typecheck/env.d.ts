// #245 실행 환경 선언 — demo/js 가 실제로 쓰는 전역만 적는다.
// classic script 라 `window.x = …` 로 붙인 이름을 다른 파일이 맨이름으로 부른다. 전역 `var` 하나면
// 맨이름과 `window.x` 둘 다 풀린다 (window 는 `Window & typeof globalThis` 라 전역 var 를 포함한다).
// 포괄 인덱스 시그니처(`interface Window { [k: string]: any }`)를 쓰지 않는다 — 그러면 오타난 `window.__actCoer`
// 까지 통과해 이 검사가 하려는 일(경계 어휘 대조)이 사라진다. 이름을 하나씩 적는 것이 곧 검사다.

/** onclick="…" 문자열에서만 불리는 UI 핸들러 — 인자 계약은 HTML 쪽이라 여기서 좁히지 않는다. */
type UiHandler = (...args: any[]) => any;

// ── 전투 어휘 Core 다리: netApply 가 회선 프레임(a.bf)을 그대로 넘긴다. 이 시그니처가 곧 수신 경계 계약이다.
declare var __actCore: ((kind: string, wire?: BattleWire) => any) | undefined;
declare var __useItemCore: ((i: number, wire?: BattleWire) => any) | undefined;
declare var __throwBallCore: ((wire?: BattleWire) => any) | undefined;
declare var __fleeCore: ((wire?: BattleWire) => any) | undefined;
declare var __passCore: ((wire?: BattleWire) => any) | undefined;
declare var __openPkgCore: ((kind: string, wire?: BattleWire) => any) | undefined;
declare var __pkgPickCore: ((what: string, i: number, id: number) => any) | undefined;
declare var __pkgCancelCore: ((id: number) => any) | undefined;
// #245 Saturn REVISE(HIGH 2): 탐색 보상 토큰은 **문자열**이다 (core.js 가 `말id#발급번호` 로 발급) — 숫자 상태 카운터와 섞지 않는다.
declare var __recruitCore: ((step: string, i: number, token: string) => any) | undefined;

// ── 나머지 전역 (모드 선택·로비·오버레이·아트 폴백 등 표시 계층)
declare var __act: UiHandler;
declare var __flee: UiHandler;
declare var __menu: UiHandler;
declare var __openPkg: UiHandler;
declare var __pass: UiHandler;
declare var __skillInfo: UiHandler;
declare var __throwBall: UiHandler;
declare var __useItem: UiHandler;
declare var __shop: UiHandler;    // #236 상점 화면 버튼
declare var __buffUse: UiHandler; // #236 산 전투 버프
// setSeed·tutOpen·tutHintClose·metricsSnapshot 은 함수 선언이 이미 전역이라 여기서 다시 적지 않는다.
declare var artFail: UiHandler;
declare var artPortraitFail: UiHandler;
declare var artSpriteFail: UiHandler;
declare var autoPlace: UiHandler;
declare var autoPlaceCore: UiHandler;
declare var clearPlace: UiHandler;
declare var clearPlaceCore: UiHandler;
declare var netCancelQueue: UiHandler;
declare var netCancelResume: UiHandler;
declare var netCodePrompt: UiHandler;
declare var netConnect: UiHandler;
declare var netCreatePublicRoom: UiHandler;
declare var netJoinPublicRoom: UiHandler;
declare var netLeaveRoom: UiHandler;
declare var netListRooms: UiHandler;
declare var netPrepare: UiHandler;
declare var netRoomReady: UiHandler;
declare var netUiTab: UiHandler;
declare var rematch: UiHandler;
declare var rosterInfo: UiHandler;
declare var selTray: UiHandler;
declare var selTrayCore: UiHandler;
declare var setupDone: UiHandler;
declare var setupDoneCore: UiHandler;
declare var startMode: UiHandler;
declare var toLobby: UiHandler;
declare var toggleRoster: UiHandler;
declare var toggleRosterCore: UiHandler;
declare var uiBack: UiHandler;
declare var uiDrawer: UiHandler;
declare var uiPrep: UiHandler;
declare var uiStart: UiHandler;
