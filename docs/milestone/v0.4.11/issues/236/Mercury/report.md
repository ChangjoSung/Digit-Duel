# #236 Mercury 전달 기록 — 로컬 경제 후보

- 2026-09-24 · 작업 브랜치 `ChangjoSung/issue-236-economy-v0411` · 기준 `milestone/v0.4.11` `6d1b788` · [PR #256](https://github.com/ChangjoSung/Digit-Duel/pull/256).
- 역할: Venus 규칙·수용 기준, Mars 로컬/PVE/핫시트 구현, Jupiter 온라인 경계, Saturn 독립 읽기 전용 QA. 온라인 권위 경제는 #237, 최종 화면·연출은 #238.
- CJ D1 확정: 핫시트 P1/P2의 시작·정기 상점은 각 90초, 각자 상점이 실제로 보이는 순간부터 시작한다. 가림 대기 시간은 제외하며 순차 합계 최대 180초다. Venus가 GDD-23·24·13을 갱신했고 Mars가 타이머를 구현했다.
- 실제 브라우저 증거: [PVE 시작 상점](start-shop.png), [P1→P2 불투명 교대 가림](../Mars/browser-setup-handoff.png). Mars의 D1 재검증은 P1 시작 상점 만료 뒤 P2 가림 13.5초 동안 시계가 멈추고, 가림 확인 뒤 P2 상점에 6초 시험 시계가 표시·만료되는 흐름이다.
- 상점은 좌석별 마감을 유지한다. 다시 그리기와 확인 창은 시간을 재시작하지 않고, 만료 때 확정 거래를 보존하며 미확정 확인 창만 취소한다. 게임 재시작 때 옛 상점·B08 시계를 정리한다. PVE AI는 사람 시작 상점이 열릴 때 즉시 구매를 마치며, 온라인 기존 경제와 시뮬레이션 경계는 유지한다.
- `smoke_issue236` 244/0, `smoke_fx_timing` 82/0, 타입 검사와 변경 파일 `git diff --check` 통과. Mars는 CI Node 검사 32종과 서버 검사를 통과시켰다. Windows CRLF 체크아웃의 기존 `test:typecheck` 변이 기준점 1건(68/1)은 변경 전 HEAD에서도 재현됐다.
- D1 수정 뒤 새 Saturn 독립 QA: **PASS · HIGH 0 · MEDIUM 0 · LOW 1**. LOW는 Venus 보고서의 옛 Issue 상태 문구였고 Mercury가 현행 90초 상태로 바로잡았다. Saturn 브라우저 재검증은 Orca 런타임을 사용할 수 없어 미확인이고, Mars의 실제 브라우저 증거와 헤드리스 회귀를 별도로 기록한다.
- 남은 게이트: 수정된 최신 HEAD의 필수 CI A/B/B2/C/D/E 6/6, CJ 전체 플레이 QA(AC43), `milestone/v0.4.11` squash 병합. 완료 전 #236은 OPEN, PR #256은 초안으로 둔다.
- 원본 `C:/Users/pc_77/orca/Digit-Duel`의 사용자 변경 25건은 읽기 외 작업 없이 보존했다.
