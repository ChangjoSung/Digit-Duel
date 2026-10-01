# #294 Venus 납품 — 2026-10-02
[결정] CJ "승인합니다. 구현 시작하세요." 반영. 판정: 구현 계약 완료 · 제품 구현/QA PASS 아님.
파일: [implementation-contract.md](implementation-contract.md) · [decision-sync.md](decision-sync.md) · 본 보고. 코드 · 테스트 · Git · GitHub · Render 변경 0.
확정: 공용 신원 머리줄(#293 상점/배치/완료 + #294 메인 · 기존 `NET.players`/`reps` · 서버 변경 없음 · 중립 대체 · 보는 사람 기준 테두리 · 12자 말줄임).
확정: 공개 보드 시계 `boardClock{leftMs,running,deadline,serverNow}` — 기존 `_pick`/`_act`를 읽기만, 양쪽 같은 값, `key`/`owner`/전투·상점·B08 시계 비공개, 기존 `clock` 불변.
확정: 내 시너지 세로 열(숫자 = 기여 목록 · 사망 기여 유지 · 전투 중 목록 없음) · 가방 창(3칸 · `+` 장식 · 명령 없음) · 설명 창 맥락별 allowlist(공개 상대 말은 스킬 탭 없음 · `?` 없음).
추론(구현 때 확인): 안내 창 바깥 탭이 뒤 화면에 떨어지는지 · 전투 중 보드 열 비조작. 미확정 규칙 없음. Earth 시안과 모순 없음(2곳 좁힘 — 계약 10장).
담당: Jupiter = `room.js` 필드 1개 + 타이머 테스트 / Mars = UI · 네트워크 · CSS · 타입 · 회귀 테스트(Core 변경 없음 예상). AC 16개 · 기존 회귀 명령 각 1회 · 320/390/PC 캡처 1회.
문서 반영 위치: GDD-13 9장 새 행 / GDD-23 2.4 · 7.9 · 끝 절 / GDD-24 00.7 · 끝 절 — 세 페이지 모두 삽입만, 삭제 0, 속성은 자동 `마지막 수정`뿐.
runtime: PID 30416 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` · PRECHECK_READY → GO 수령 · eli-adult 적용 · Ponytail lite(YAGNI)만 병행.
