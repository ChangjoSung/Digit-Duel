# #293 CI 보정 — issue122_rules A12 · A14 (Mars · 2026-10-01)

1. **판정(확정)**: CI run 36802651064(HEAD `2c8bebd`) A 헤드리스 2건 실패는 제품 회귀가 아니라 #293이 바꾼 화면의 **옛 표시·화면 순서 기대값**이다. 근거는 계약 3.2/3.3 · AC10(11개 목록 정정).
2. **원인**: 경제 판 `renderSetup`이 `01 시작 상점 n/6` 탭(`prepTabs`)을 진행 막대(`flowHeadHtml` — 01 상점 · 02 배치 · 03 완료)로 바꿨고, `uiPrepLock`이 오프라인 경제 판의 단계를 `shop.done`에서 파생한다. Core는 그대로다(`setupAuto`/`setupConfirm`은 #236부터 상점 완료 전 배치 거부).
3. **A12 전**: 패널에 `시작 상점` · `비공개 배치` · `배치 완료` 글자. **후**: `flowBar` + 3단계(상점·배치·완료) + 현재 단계 `aria-current` = 배치 + `비공개 배치`(접근성 제목) · `배치 완료` 유지 + `prepTabs`/`data-prep-step` 없음.
4. **A14 전**: `uiPrep("roster")` → `UI.prep==="roster"`. **후**: 끝난 S01은 다시 열리지 않음 — `UI.prep==="place"` · `shop.done[0]===true` · `data-prep="place"`.
5. **A14b(추가)**: 비경제 판(`S.eco=null`)은 종전대로 01 ↔ 02 자유 전환 — A14의 옛 의도 중 유효한 절반 보존.
6. **셈**: 기존 98 = 수정 2 + 무수정 96, +A14b 1 = 99. 수치 · 보안 · 경제 · 시계 단언 무수정.
7. **파일**: `demo/test/milestone/v0.4.6/issues/122/issue122_rules.js`, 이 문서. 제품 코드 · 다른 테스트 변경 없음.
8. **검사(1회)**: `node demo/test/milestone/v0.4.6/issues/122/issue122_rules.js` → pass 99 / fail 0 · exit 0 (같은 실행에서 수집).
9. **미검증**: 다른 스위트 · 브라우저 · #293 회귀 재실행 없음(범위 밖). Saturn 독립 대조와 필수 CI 6개 전체 재실행은 PD가 진행한다.
10. **실행값**: Claude `claude-opus-5-5` · high · `--dangerously-skip-permissions` · strict 빈 MCP · Ponytail full. Git 명령 · GitHub · 커넥터 사용 없음.
