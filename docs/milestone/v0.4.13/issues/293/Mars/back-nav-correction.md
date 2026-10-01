# #293 CI 보정 — back_nav B3 입력 전제 (Mars · 2026-10-01)

1. **판정(확정)**: CI run 36805060923(HEAD `0201e3e`) A 단계 `back_nav.js` B7(결과 → 로비) 1건 실패는 제품 회귀가 아니라 B3 **픽스처 입력 전제**가 #293 이후 맞지 않게 된 것이다. 실제 로비 복귀 동작과 모달 가드는 정상이다.
2. **원인(코드 대조)**: B3의 `T.startMode("pve")`는 경제 판(`S.eco` · 열린 S01)을 만든다. 계약 3.2대로 `uiPrepLock`(`ui.js` 215)이 `UI.prep`을 `roster`로 되돌리므로 `uiBack`은 배치 → 로스터 갈래(276) 대신 준비 취소 확인창(282)을 연다.
3. **전**: B3~B6은 우연히 통과하고 확인창이 열린 채 남는다. `H.freshPlay`(`newGame`)는 창을 닫지 않아 B7의 `uiBack`이 `uiOverlayOpen` 가드(263)에서 멈춘다 → 121 pass / 1 fail.
4. **후**: B3가 뜻하던 비경제 로스터 선택의 자유 전환(계약 3.2 "종전 그대로")을 실제로 지나고 확인창이 열리지 않는다. B7은 원래 경로(`toLobby`)로 통과한다.
5. **변경(입력만)**: `back_nav.js` B 블록의 `T.startMode("pve",…)` 바로 뒤 · `fillRosterRandom` 앞에 `T.S.eco=null;` 한 줄 + 주석. `issue122_rules` A14b · `smoke_issue238` I15와 같은 관용구다.
6. **무수정**: 122개 단언의 조건 · 문구 전부(B7 포함), 모달 가드, 보안 · 타이머 · 저장소 · 회귀 가드. B7 앞 `close()` 추가 없음. 제품 코드 · 다른 테스트 변경 없음.
7. **검사(1회)**: `node demo/test/milestone/v0.4.6/issues/122/back_nav.js` → pass 122 / fail 0 · exit 0 (같은 실행에서 수집). 진단 프로브는 돌리지 않았다(정적 대조로 충분).
8. **남은 A 단계(정적 읽기만)**: `smoke_fx_timing` · `attack_balance` · `shock` · `cross_skill` · `orientation_audit` · `ai_completion`은 `startMode("sim")`만 쓰고 준비 화면 픽스처가 없다 — 같은 유형의 노출은 찾지 못했다. 실행으로 확인한 것은 아니다.
9. **미검증**: 다른 스위트 · 브라우저 · #293 / `issue122_rules` 재실행 없음(범위 밖). Saturn 독립 대조와 필수 CI 6개 재실행은 PD가 진행한다.
10. **실행값**: Claude `claude-opus-5-5` · high · `--dangerously-skip-permissions` · strict 빈 MCP · Ponytail full. Git 명령 · GitHub · Notion 사용 없음.
