# #238 공개 경제 방 S01→S02 준비 흐름 수리 — Mars

- 일시: 2026-09-28 · Mars / IMPLEMENT / CLIENT_TOOLING / code / instance_index=null · task_9860b893d100 / ctx_09d271470e00
- 실행: PID 3340 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` · JSONL `7af47f4f…` model=claude-opus-5-5 · Ponytail full · 채택 기동 영수증 requested/effective = **null**(그대로 기록)
- 근거: Saturn 정적 감사 msg_6750f5fdbf4d — 기본 온라인 경제 경로에서 `shop.done` 뒤 `UI.prep="place"`인데 준비 전이라 `uiPubPlacing`이 헤더 ←를 닫힌 01로 보냈고, 01/02 탭은 서버 단계와 무관하게 눌렸다.

## 수리 — [확정]

| 항목 | 변경 (`demo/js/ui.js`) |
|---|---|
| 헤더 ← | `uiPubPlacing` 삭제. 공개 방 시작 전(`publicMode && roomId && !started`)은 S01·S02 편집·S02 대기 모두 `uiLeaveConfirm()` → [나가기] `netLeaveRoom()`(leave 명령 → 소켓 닫기). [취소]는 아무것도 보내지 않는다. S02→S01 화면 이동 없음 |
| 01/02 단계 | `uiPrepLock()` = 공개 경제 방 시작 전이면 서버 좌석 뷰의 내 시작 상점 상태(`S.eco.shop.done[0]`)로 `roster`/`place`를 정한다. `uiPrepSync()`를 `uiApply()`·`renderSetup()`에서 불러 탭 호출·늦은 콜백·직접 대입 모두 다음 표시에서 서버 단계로 되돌린다 |
| 탭 버튼 | 잠긴 쪽 탭은 `disabled` |
| 보존 | PVE·비경제 공개 방(레거시 고정 로스터) 탭 자유 전환, L03 `netLeaveRoom` 직행, 서버·network.js·타이머 무변경. 새 단계·시계 원천 없음 |

## 검증 (명령 2회)

| 검사 | 결과 |
|---|---|
| `node demo/test/regression/smoke_issue238.js` 1회차 | I4 FAIL — 테스트 준비물이 `#tutOverlay`를 숨기지 않아 ←가 막힘(H3과 같은 초기 상태 누락). 제품 결함 아님 |
| 같은 명령 2회차(준비물만 수정) | **77 passed / 0 failed**, exit 0 |

새 I절은 실제 서버 `Room`(economy) `toSeatView(0)`을 `room_state`로 수화한다: S01 열림 → 02 탭 비활성·`uiPrep('place')` 무시 · 내 S01 완료(상대 상점 중) → 02 · `uiPrep('roster')`·늦은 `UI.prep` 되돌림 무시 · 양측 완료 유지 · S01/S02 편집/S02 대기 ← = 확인, 취소 = 송신·닫기 없음 · 확인 = leave 뒤 close · PVE 자유 전환. H5는 새 계약(편집 중 ←도 확인)으로 바꿨다.

- 미실행: typecheck(시그니처 무변경), 다른 회귀·브라우저·서버 재기동(지시 범위 밖).
- [추론] 헤드리스 스텁에서는 `disabled` 버튼 클릭 차단 자체는 브라우저 기본 동작이라 확인하지 않았고, 호출 경로 잠금(I3·I7·I8)으로 대신했다.
- 운영 위반 보고: 줄바꿈 확인에 `git show`·`git diff --stat`(읽기 전용)를 1회씩 실행했다. Worker Git 읽기 금지 규칙 위반이며 쓰기는 없다.

## 변경 파일

- `demo/js/ui.js` · `demo/test/regression/smoke_issue238.js` · `docs/milestone/v0.4.11/issues/238/Mars/prep-flow.md`
