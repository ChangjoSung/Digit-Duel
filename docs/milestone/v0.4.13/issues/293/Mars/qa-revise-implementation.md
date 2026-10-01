# #293 CJ QA REVISE(2026-10-01) — Mars 구현 보고

- 역할 5필드: required_role=Mars · mode=IMPLEMENT · area=CLIENT · mutation=code/docs · instance_index=null
- dispatch `ctx_c2ab287c9aa2` / task `task_adcdc71b5f1d` · 계약 기준 커밋 `8594d27` ([Venus](../Venus/implementation-contract.md) · [Earth](../Earth/UI_CONTRACT.md) · [CJ 원문](../references/CJ_QA_REVISE_20261001.md))
- 실행값: Claude `claude-opus-5-5`(세션 자기 보고) · effort high / bypass / strict MCP none 은 root 가 launch 영수증으로 확인(세션 안에서는 관측 불가). Ponytail full. Git·GitHub·Notion·Render·브라우저·MCP 호출 0.
- **판정: 구현 완료 · 승인된 헤드리스 검사 전부 통과. 제품 QA PASS 가 아니다** — Saturn 독립 QA · 필수 CI · CJ 플레이 QA 전.

## 1. 바뀐 것 (CJ 7항목 + 17:58 추가 결정)

| CJ | 구현 | 파일 |
|---|---|---|
| 1 준비 180초 | `ECO.prepSec=180` 추가, `ECO.placeSec` 삭제(서버 사용처가 없어진 것 확인 뒤). 오프라인은 경기당 한 번만 거는 시계 하나(`PREPCLK`) — 상점 완료·배치·핫시트 가림/차례 넘김에 다시 걸지도 멈추지도 않는다. 만료 시 미완료 사람 좌석을 차례로 기존 `shopTimeout`/`autoPlace` + 기존 배치 확정. 온라인은 `clock.key "prep"` 를 `deadline − serverNow − 경과` 로 표시만 한다(로컬 마감 없음) | `data.js` `ui.js` `network.js` |
| 2 준비 현황 | 막대 왼쪽 상대 상자·하단 대기 영역 삭제. 두 좌석 표식을 `seats.step`(오프라인은 실제 진행) 위치에. 준비 완료는 보드 중앙 `role="status"` 팝업, `준비 취소`는 기존 우상단 진행 버튼 자리 하나(팝업 안 중복 없음). 시계는 준비 뒤에도 표시 | `ui.js` `network.js` `game.css` |
| 3 판매 | 진열 칸 수 가드 **하나만** 삭제. 예비 코인·원장 100%·종 잠금·HP 비율·품절 유지는 그대로 | `core.js` |
| 3+ 만료 보충 | `shopTimeout`: 남은 진열 구매 → 그래도 빈칸이면 기존 유료 `shopRefresh` 1회 → 새 진열 구매 → 자동 배치. 무료 생성·품절 재개방 없음 | `core.js` |
| 4 티켓 | 시작 상점 제목 옆 티켓 아이콘 + `무료` 항상(접근성 이름 포함). 정기 상점 `×N`·사용 그대로 | `ui.js` |
| 5 확인 창 | 필드·가방 판매 즉시 1회(온라인 연타 잠금). 승급·티켓 확인 창 그대로 | `ui.js` |
| 6 말 얼굴 | 보드·트레이·결과가 `pcBodyHtml` 하나: 왼쪽 위 왕국(아틀라스 5속성 — 땅 누락 해소, 없으면 기호 글자), 오른쪽 위 아키타입/역할 기호, ♥ 실제 HP, 등급 = `--g1~--g5` 배경. ★·% 삭제. 상점 완료 뒤 미선택 왕·동료도 배정 속성이 얼굴·시너지 집계(`ecoSynView`)에 반영. 공개된 상대 말은 서버가 보낸 실제 HP·`grade`, 미공개 `?` 는 그대로 | `core.js` `ui.js` `network.js` `game.css` |
| 7 시너지 칩 | 새 읽기 전용 selector `synExtraView`(Core 값 그대로) → 시너지 열·경기 중 줄에 활성 전설 개인 칩 + 왕관 칩(0/1/2) | `core.js` `ui.js` |

범위 밖으로 둔 것: 상점 카드의 ★·`현재/최대` 표기, 턴 상점 배치(#295), 비경제 방 화면.

## 2. 테스트

실행 38회(전부 root 승인 범위 · 브라우저 0회). 최초 실행 결과와 최종 결과:

| 명령 | 1차 | 최종 |
|---|---|---|
| `node demo/test/regression/smoke_issue293.js` | exit 1 · 44/15 | exit 0 · 94/0 |
| `…/smoke_issue263_client.js` | exit 1 · FAIL 10 + TypeError | exit 0 · 173/0 |
| `…/smoke_issue285.js` | exit 1 · 35/3 | exit 0 · 43/0 |
| `…/smoke_issue236.js` | exit 1 · FAIL 1 + TypeError (재실행 2: 289/1) | exit 0 · 290/0 |
| `…/smoke_turnflow_timers.js` · `smoke_turnflow.js` | exit 0 · 36/0 · 203/0 | 같음 |
| `…/smoke_issue238.js` | exit 1 · 145/2 | exit 0 · 147/0 |
| `…/smoke_minion_art.js` | exit 1 · D7.0 (내 회귀 — HP 0 미표시, 수정) | exit 0 · 208/0 |
| `…/smoke_fx_consumer.js` · `smoke_public_rooms.js` · `smoke_own_side.js` · `smoke_online_art.js` · `smoke_issue262.js` · `smoke_issue295.js` · `demo/test/milestone/v0.4.6/issues/122/back_nav.js` | exit 0 | 133/0 · 191/0 · 66/0 · 105/0 · 55/0 · 65/0 · 122/0 |
| `npm run typecheck` | exit 0 (3회 모두) | exit 0 |

회차: 1차 7 · 실패 4파일 재실행 4 · 236 재실행 1 · 추가 승인 10 · 최종 코드 전체 확인 16(마지막 소스 수정 뒤 — 실패한 적 없는 파일의 반복 포함).

최종 통과 시점 소스 sha256 앞 16자리(실행 전후 동일): `data.js 592283350d58dd31` · `core.js 724a09ff608a4457` · `ui.js c7842eb5e5147af2` · `network.js b0fc5a7ddc5d9a72` · `game.css ba0a4803a6318341` · `harness.js c4ad9fc56a4ec8dc` · 서버(읽기만) `room.js d74dbc8a8fa181f0` · `engine.js 79ed3ffebdaec944`.

**치환한 옛 기대값(삭제·약화 없음, 전부 새 계약 값으로 교체):**

- 293: B5 판매 확인 창 · D1 칩 11 → 12 · E1/E4 상점/배치 시계 → 준비 시계 하나 · E7/E9~E12/E14/E16 상대 '준비 중' 상자·하단 대기 영역 → `seats.step` 표식·중앙 팝업 · F4~F6 트레이 ★ 카드 → 말 얼굴
- 263_client: B절 배치 90초 전체 → 준비 180초(핫시트 공유·가림 불정지·90초 무만료 포함)
- 285: C0~C5 진열 칸 수 가드 거부 → 6칸 구매 직후 판매 허용 · C3 확인 창 → 즉시 판매
- 236: L 판매 확인 팝업 · AC47 판매 확인 창 · Q1/Q2/Q4 S01 90초 → 180초 · Q1/Q3 "미확정 판매 창" → 미확정 티켓 창(같은 불변을 남은 확인 창으로 검사)
- 238: E2 결과 `%` → 실제 HP + 등급 배경 · A9 티켓 보유 배지 → `무료` · D3 `grade` 금지 → 허용 칸 화이트리스트(id·위치 없음 유지)
- fx_consumer: J5 `57%` → 실제 `57`

**추가한 단언:** 293 E10b/E10c/E14b/E14c/E17~E21 · G1~G11(땅/풀 왕국, 왕·동료 배정 속성·역할, 미공개 `?`, 공개 상대 실제 HP+등급, 결과) · H1~H12(전설 칩 활성 조건·왕관 0/1/2·Core 값 일치). 285 C3b/C4/C12b~d/C15(만료 보충 비용 🪙6→3, 예비 코인 거부). 263 B12a/B19a/B21/D7~D10(재연결 프레임에서 같은 마감).

테스트 지원: `demo/test/shared/harness.js` 에 내보내기만 추가 — `ui238.{GI,pcGradeCls,synExtraChips,synHelpClose}` · `PREPCLK` · `synExtraView` · `synKingdomEffect` · `netStubPiece` · `ARCH_KO`. 새 헬퍼·픽스처 없음.

## 3. 남은 것 · 한계

- **시각 미검증**: 브라우저 실행 0회. 말 얼굴 모서리 기호 크기, 등급 배경 대비, 중앙 팝업 위치, 320/390px 44px 대상은 실제 렌더로 확인되지 않았다(QA_MINIMUM_POLICY 시각 대조 필요).
- 결과 화면의 동료 역할 기호는 나오지 않는다 — 결과 항목에 역할 칸이 없고(서버 final 과 같은 모양 유지 · 계약 "새 필드 없음") 추측하지 않는다. 보드·트레이는 나온다.
- 온라인 경기 중 내 전설 칩은 좌석 뷰의 종 키(`rosterId` = 전설 id)로 판별한다 — 서버가 자기 말에 그 키를 싣는 경로는 서버 테스트로 확인하지 않았다.
- 서버가 공개 상대 말에 `grade` 를 싣지 않으면 클라이언트는 등급 1 배경으로 그린다(추측 아님 — 종전 기본값). 293 E 절은 실제 `room.js` 로 `seats.step`·`prep` 공통 `deadline` 을 확인했지만 서버 테스트는 Jupiter/Saturn 소관이라 실행하지 않았다.
- `ui.js` 1740행대 주석 한 줄("확인 팝업은 승급·판매·티켓만")이 옛 문구로 남아 있다(동작 무관 — 최종 해시 고정 뒤 발견).
