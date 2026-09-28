# #238 경기 UI 시스템 — Mars 구현 보고

- 2026-09-28 · Mars(Claude Code) · required_role=Mars · mode=IMPLEMENT · area=CLIENT_TOOLING · mutation=code · instance_index=null
- 실행: PID 17252 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` · 세션 JSONL 모델 `claude-opus-5-5` · Ponytail full · 요청/실효(requested/effective) 영수증 값은 null 로 따로 보존
- 작업 트리: `issue-238-game-ui` (HEAD `e1bfdc2`) · 부모 #262 트리 무수정 · Git 쓰기 없음
- 기준: GDD-23 2.2·2.4·7.9·8.2, GDD-24 00.5~00.9·01~03, [Venus 화면 매트릭스](../../../planning/2026-09-28-issue-238-ui-system.md), Jupiter `data.final`·`battle.ownSyn`·`fx.cast` 회선 합의(PD 중계)

## 1. 기준선 (확정)

PD COPY_GO 뒤 부모 #262 의 13개 파일을 같은 경로로 바이트 복사하고 원본·사본 SHA-256 이 같음을 확인해 PD 에 보냈다(`msg_801bcd027706`). 부모 파일 SHA 는 작업 끝에도 기준과 같다(game.css `63db3b31…` · ui.js `b132af79…` · network.js `71a109eb…` · core.js `b9a8c934…` · harness.js `15bae72e…`). 아래 델타는 이 상속 기준선과 **따로** 센 #238 변경분이다.

## 2. 무엇을 바꿨나 (확정)

| 화면 | 변경 | 파일 |
|---|---|---|
| S01·S05 상점 시트 | 진열 6카드(SOLD OUT·판매함·승급 차액) · 상품 8종 카드(Earth `goods.svg` 24px 스프라이트, ECO.goods 순서) · 필드 6/가방 3 고정 슬롯 · 왕·동료 속성(aria-pressed) · 시너지 칩 · 예비 재화 문구 "빈 칸 × 🪙1"(옛 '필요한 새로 고침' 삭제) · S01 티켓은 보유 안내만(사용은 정기 상점) · **레드닷 표시 제거**(Core `fresh` 필드는 보존) | ui.js · game.css |
| S01 상품 | `ECO.startGoods` 4 → 8종(= 정기 상점). Core `shopGood` 게이트가 이 값을 읽고 서버 런타임이 같은 바이트를 실행 | data.js |
| S01·S02 나가기 | 시작 전 [방 나가기] = 확인 창(즉시 경기 취소 · 공식 전적 없음, Esc = 취소) 뒤 종전 `netLeaveRoom` | ui.js |
| S02 | S01 시간 초과로 서버가 자동 배치·준비한 좌석은 배치 화면·90초 대신 "자동 배치 완료" 대기 화면 | ui.js |
| S03 보드 HUD | 🛒 상점 아이콘 Dim + 다음 오픈까지 남은 턴(80턴 뒤 "더 열리지 않음") · 🎒 가방 버튼(내 가방 서랍) · 행동 줄 버튼 44px | ui.js · game.css |
| B04 전투 | 내 전투원 시너지 칩(소유자만): 온라인 `battle.ownSyn`, 오프라인 Core `synView` — 단계는 공급된 `stage` 만 읽음 · 기술 연출 `cast` 측 태그 | ui.js · network.js · core.js · data.js |
| 기술 연출 | 일반 30종 = 아키타입 6 모양 × 속성 5 색(`--castC`) · 전설 3종(용·마녀·사신) 전용 · 1회 0.6~1.1초 · 움직임 줄이기 = 같은 색 테두리(문구는 msgBox 기술 이름) | ui.js · game.css |
| S04 결과 | 양측 보드 9칸(사망 포함, 폭탄·함정 제외) + 가방 소절 + 시너지 칩. 온라인 = `data.final.sides`(FINISHED 에만, 그 밖·나가기 때 비움), 오프라인 = 같은 모양을 Core 로. 상대 HP 는 싸운 개체만 실제 값, 나머지 % · 등급 표기 없음 · 왕국 단계는 `syn.stage`, 아키타입은 칸 수만(경계 재계산 없음) | ui.js · network.js |
| X01·X03 | 맨 위 패널 + `#app`·`#overlay`·`#emoteLayer` inert(기권·서랍·이모티콘 포함 잠금), 제목으로 포커스 · X01 = 서버 유예 잔여만 · X03 = "재접속 중 · 시도 n회"(초 카운트다운·[포기] 제거) · 시작 전(OPEN·SETUP) 정지에서는 [방 나가기](경기 취소)가 복구 입력으로 패널에 남음(#263 G4 계약) | network.js · ui.js · game.css |
| 모달 | 열면 첫 버튼(없으면 제목)으로 포커스 · Tab 은 모달 안 + 이모티콘 버튼/팝오버만 순환 · Esc = [취소] 있는 창에서만 · 닫으면 연 버튼 → 보드 아이콘 → 행동 줄 순 복귀 | ui-overlays.js |
| 이모티콘 | 여는 버튼 48px·강조 테두리 · 말풍선은 상단 바 아래 전용 줄 15px(상대 왼쪽 + '상대' 칩, 나 오른쪽) · 모달 여백 확보. 5초·2.5초·숨기기 무변경 | ui.js(emotePlace 삭제) · game.css |

추가 파일: `demo/assets/ui/goods.svg`(Earth 원본 `docs/…/238/Earth/goods.svg` 바이트 복사, SHA-256 `1f265d891433c58e…` 양쪽 동일) · `demo/test/regression/smoke_issue238.js`(신규) · CI job A 에 그 한 줄 · 이 보고서와 PNG.

## 3. 판단과 한계

- **[확정 · PD msg_ace309801459]** 핫시트 `handoff()`·`#overlay.handoff` 는 제품 진입점이 없는(#260) 오프라인 `pvp` 하네스 경로에만 남겼다. 제품 로비에 핫시트 진입점이 없음을 smoke_issue238 H2 가, 온라인·PVE 가 X02 를 쓰지 않음을 기존 경로(`handoff` 는 `NET.mode` 면 즉시 진행)가 보장한다.
- **[확정]** 서버 파일은 Jupiter 소유라 수정하지 않았다. `fx.cast` 화이트리스트·`data.final`·`battle.ownSyn` 은 Jupiter 가 구현했고 클라이언트는 소비만 한다.
- **[추론]** 스크린샷의 🪙 가 네모로 보이는 것은 헤드리스 Chrome 에 그 글꼴이 없어서다(종전부터 쓰던 문자, 제품 변경 아님).
- **[미확정]** 온라인 두 클라이언트 실연결에서 `final`·`ownSyn`·`cast` 표시는 계정이 필요해 이번에 확인하지 않았다(새 계정 생성 금지). 소비 경로는 smoke_issue238 E·F9·F10 이 픽스처로 검증한다.
- **[설계 보완 · Venus 제안값]** 모션 길이·이모티콘 크기는 CJ 시각 확인 전 값이다.
- 절차 기록: 작업 초반 줄바꿈 확인 중 읽기 전용 `git show HEAD:demo/js/ui.js | head -c 0` 을 한 번 실행했다(출력 없음). Worker Git 읽기 금지 메모에 어긋나 기록한다. 그 뒤 Git 명령은 쓰지 않았다.

## 4. 검증 (각 1회, 실패는 해당 파일만 재실행)

| 검사 | 결과 |
|---|---|
| `npm run typecheck` (npm ci 잠금 설치, 새 의존성 없음) | exit 0 |
| smoke_issue238 (신규) | 52 passed / 0 failed |
| smoke_issue262 | 55 / 0 |
| smoke_issue263_client | exit 0 (G4 는 확인 창 경유를 허용하도록 문구·정규식 1줄 수정) |
| smoke_online | 159 / 0 |
| smoke_fx_consumer | 58 / 0 |
| smoke_fx_timing | 82 / 0 |
| smoke_ai_completion | 59 / 0 |
| 승인 밖 4건(바뀐 호출 경로 때문) | smoke_issue236 276/0(상점 마크업 경로 · 뒤바뀐 규칙을 가리던 AC06 이름만 정정) · smoke_public_rooms exit 0(X03 규칙 변경으로 K5b 1줄 수정) · smoke_turnflow 203/0(모든 창이 거치는 `modal()` 포커스 추가) · issue122_rules 93/0(상단 바·오버레이 CSS) |

승인 8 + 추가 4 = 12건이다. 추가 4건은 위 괄호의 바뀐 호출자 때문에 돌렸고 PD 지적 뒤 더 늘리지 않았다.

**브라우저(대표)** — 8085 미리보기(PG 55462, 기존 헬퍼 `--issue262`, 서버 PID 38552)에서 엔진으로 오프라인 PVE 를 띄워 찍었다(계정·API 호출 없음, 페이지 안 `AUTH.state="off"` 픽스처). 432·320px 모든 장면 가로 넘침 0, 보이는 버튼 44px 미만 0, X01 동안 `#app`·`#emoteLayer` inert·포커스 `xTitle`, 움직임 줄이기에서 연출 animation `none` (`shots-report.json`).

| 장면 | 파일 |
|---|---|
| S01 432 · 상품 320 | [s01-432](s01-432.png) · [s01-goods-320](s01-goods-320.png) |
| S03 보드 HUD 432 | [s03-board-432](s03-board-432.png) |
| B04 전투 432 · 320 | [b04-battle-432](b04-battle-432.png) · [b04-battle-320](b04-battle-320.png) |
| S04 결과 432 · 320 | [s04-seats-432](s04-seats-432.png) · [s04-result-320](s04-result-320.png) |
| 이모티콘 줄 · X01(움직임 줄이기) 390 | [emote-390](emote-390.png) · [x01-390](x01-390.png) |

## 5. 남은 것

- Saturn 독립 QA · 필수 CI · CJ 플레이 QA (계정 두 개로 온라인 S04·B04 칩·연출 실확인 포함).
- S01 티켓 **사용** 시점은 [기획 필요] 그대로 — 구매만 열었다.
- 8085 미리보기는 켜 둔 상태다(끄기: `node tools/qa/issue260_local.js stop --issue262`).
