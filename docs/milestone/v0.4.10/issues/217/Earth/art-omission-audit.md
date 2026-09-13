# #217 Earth — 기존 아트 연결 누락 독립 감사

2026-09-13 · 범위는 현재 `demo/index.html`, 승인 자산, #122/#124 및 HotFix #201 기록의 **소스 대조**다. 이 작업자는 브라우저/OS를 조작하거나 실제 화면을 보지 않았다. 아래의 실브라우저 근거는 Mars 보고서가 명시한 실서버 검증뿐이며, 서버 QA PASS는 이 아트 수용을 대신하지 않는다.

## 결론

권위 서버 경로는 보드의 정보 은닉을 지키려는 구조이나, 기존 아트 렌더 계약을 세 군데에서 우회한다. 우선순위는 (1) 공개 방 전투 스테이지·도트·FX 복원, (2) 내 보드 하수인 아트 식별 키 연결, (3) 공개 로비 카드 순서 복원이다. 새 래스터는 필요 없으며, `demo/assets/**`의 기존 승인본만 연결한다.

| 우선 | 누락 / 승인 근거 | 현재 경로와 영향 | 필요한 수정 (소유 경계) | 실브라우저 수용 체크 |
|---|---|---|---|---|
| P0 | **공개 방 전투가 기존 무대·도트·FX를 버린다.** #89/#124 계약은 `battle.png` 128px 및 king/companion `battle256.png`를 기존 `battleModal`의 `#bstage`/`.btok`에 표시한다. #201 Mars 증빙의 `201-03-battle-FIXTURE-offline.png`는 이를 명시적으로 *offline fixture*로만 확인했고, #122 전투 방향도 양측 전투원·HP·상태·명령의 고정 전투 구성을 전제로 한다. | 일반 경로는 `battleModal()`의 `token()`이 `artDirOfFighter()`와 `leaderBattleDir()`로 스프라이트를 렌더하고, 카운트·라운드·결과 FX를 둔다. 그러나 권위 경로 `netRenderBattleOverlay()`는 HP/상태 문자열과 버튼만 `_modalCore()`에 넣는다. `netBuildAuthoritativeBoard()`도 전투 시각용 fighter/piece를 만들지 않아 승인 battle 자산, 무대, HP바, 상태 배지, 기존 전투 FX가 모두 연결되지 않는다. | Mars: 서버가 준 화이트리스트 전투 스냅샷만 소비하는 전용 전투 표시를 기존 무대 스타일로 복원한다. 전투원 신원/아트는 전투라는 공개 문맥에 한해서만 쓴다. 현재 `battle.a/d`에는 type/element/안전한 art key가 없으므로 **PD 경유 Jupiter에** 전투 문맥 공개 필드(최소 `type`, `element`, own/전투-공개 상대의 `rosterId` 또는 검증된 `artKey`)를 요청해야 한다. 기술은 기존처럼 상대의 `revealed:false` 항목을 kind만 표시하고 이름·쿨·비공개 수치를 추가 요청/추론하지 않는다. | 실제 권위 서버의 두 좌석에서 하수인·왕·동료 각각 전투를 연다. 양쪽은 기존 승인 battle 이미지/무대/FX를 보되, 상대의 미공개 기술은 kind만 보여야 한다. #201의 offline fixture를 online 증빙으로 승격하지 말고, 전투 종료 후 오버레이/FX가 걷히는 것도 촬영한다. |
| P0 | **내 보드 하수인 아트 식별 키가 끊긴다.** #89은 `assets/minions/<element>_<arch>/icon.png`을 확정 말에 쓰고, #201은 두 좌석에서 왕·동료·6/6 하수인 아트 및 미공개 상대 `<img>` 0을 실브라우저로 확인했다. #124 leader 자산 4개는 `leaders-manifest.json`의 기존 승인본이다. | 일반 `renderBoard()` → `pcBodyHtml()` → `artDirOf()`는 `piece.rosterId`로만 하수인 폴더를 고른다. 권위 적응기 `netStubPiece()`가 `you.pieces`에도 `rosterId:null`을 강제한다. 서버 `Room._serializeOwn()`도 rosterId/artKey를 보내지 않는다. 따라서 내 공개/소유 하수인은 현재 텍스트 폴백이고, 왕·동료만 type 기반 `leaderArtDir()`로 그림이 될 수 있다. 이는 #201의 기존 온라인 보드 수용을 새 권위 흐름이 회귀시킨 것이다. | PD 경유 Jupiter: 소유 좌석의 `_serializeOwn()`에 기존 rosterId 또는 유효성 검증한 `artKey`를 추가한다(자기 말 전체는 이미 소유자에게 공개). Mars: 그 값을 `netStubPiece().rosterId`에 보존하고 기존 `artDirOf()` 경로를 재사용한다. 상대 `units`의 B(미공개)에는 필드를 절대 추가하지 않으며, C-2도 자산 폴더가 아키타입을 드러내므로 서버가 이미 공개한 범위를 넘는 artKey를 보내지 않는다. | 실서버 양 좌석에서 각자 6/6 하수인과 king/ally가 기존 icon으로 보이는지 확인한다. 상대 B 칸은 계속 `?`이고 DOM에 `<img>`, `src`, asset 경로가 없어야 한다. #201 429 복구 시나리오도 권위 경로에서 다시 확인해 일시 실패 뒤 아이콘이 회복되는지 검증한다. |
| P1 | **공개 로비 카드의 승인된 우선순위가 뒤집혔다.** #217 Earth `lobby-guide.md`는 기존 `.lobbyCard.net` 한 장을 유지하면서도 공개 대전을 PVE/핫시트보다 먼저 보이게 하라고 한다. 이는 새 일러스트가 아니라 기존 카드 레이아웃 복원 요구다. | `renderSide()`의 menu HTML은 PVE 카드 → 핫시트 카드 → `.lobbyCard.net` 순서다. 공개 방이 기본 탭(`NET.uiTab:"public"`)인 점과 달리, 실제 진입 카드가 아래로 밀린다. Mars 보고서는 기능/실서버 흐름을 검증했지만 이 시각 순서는 수용했다고 주장하지 않는다. | Mars: 기존 카드·문구·토큰을 유지한 채 `.lobbyCard.net` 블록만 PVE 앞에 옮긴다. 새 배경/배너/래스터를 만들지 않는다. 320px에서 카드 폭과 44px 이상 주요 버튼, 공개 목록/생성/새로고침의 순서도 Earth 가이드대로 확인한다. | 실제 브라우저에서 초기 로비를 320px 및 데스크톱 폭으로 확인: 공개 대전 카드가 첫 모드 카드, 공개 방 탭이 기본, 생성→새로고침→방 목록/참가 순서가 유지되어야 한다. LAN 코드 탭은 보조 경로로 남고 주소/초대 코드가 공개 방 카드에 노출되지 않아야 한다. |

## 정보 등급 경계

- 보드 B(미공개 상대)는 현행 프로토콜처럼 위치·생존 등 최소 필드만이며 자산 URL/아트 키를 만들지 않는다. #201의 `foeCellsHaveImg:false` 수용을 권위 경로에서도 유지한다.
- 보드 C-2 공개 상대는 서버가 선언한 type/name/element/HP 범위를 넘지 않는다. `rosterId`/아키타입 기반 자산 경로는 별도 신원 노출이므로 자동 추가 금지다.
- 전투는 이미 양측 전투원과 일부 기술 공개를 다루는 별도 문맥이다. 필요한 전투 표시 필드는 PD가 공개 범위를 확정한 뒤에만 서버가 보내며, 클라이언트는 없는 값을 이름·자산 키로 역추론하지 않는다.

## 증빙 구분

- **직접 확인:** 현재 소스의 `renderBoard`/`battleModal`/`renderSide` 및 `netStubPiece`/`netRenderBattleOverlay`; 승인 자산 트리와 manifest; #122/#124/#201 문서·스크린샷 manifest.
- **직접 보지 않음:** 이번 감사에서의 Edge/실브라우저 화면, 네트워크 요청, 실제 권위 서버 전투. Mars가 보고한 실서버 전투 기능·정보 은닉은 참고 증빙이며, 시각 수용 증빙이 아니다.
