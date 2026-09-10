# #121 · #125 · #129 통합 기록

2026-09-09 · Mercury / COORDINATION_GIT_DOC_METADATA. [통합 PR143](https://github.com/ChangjoSung/Digit-Duel/pull/143), 기준 Issue #121, 관련 #125·#129, Milestone13(v0.4.7).

CJ의 권고안 승인과 기술 3종 직접 선택 확정에 따라 구현했다. 마녀의 풀 효과는 이번 공격의 실제 HP 피해만큼 즉시 자기 회복하며 보호막 흡수분·과잉 피해를 제외한다. 전체 승인 규칙은 [Venus 계약](../Venus/gameplay-spec.md), 구현과 롤백은 [Mars 보고](../Mars/report.md)에 있다.

## 검증과 통합 기준

- 최종 제품·촬영 ref `157026ba617166644ada0686b897d3ae2a166486`, HTML Git blob `4535791bbefd86ad829cdd436d4957f8a530846b`.
- Mars(Claude): 현행 회귀 18종 PASS. 탐색·기술 289, 연출 82, 온라인 157, 튜토리얼 124, AI 13경기·59단언 등.
- [실제 Chrome 검사](../Mars/artifacts/v047-browser-report.json): 57 PASS / 0 FAIL. 배너 1230ms, 보호막→HP 표시 간격 359ms, 탐색 완료 1222ms·종료 1회.
- [튜토리얼 10장 manifest](../Mars/artifacts/capture-manifest.json): 동일 제품에서 촬영·README 연결. 2224×1628, 세로 넘침 없음. PD·Saturn이 PNG 10개의 SHA256·크기를 별도로 대조했다.
- [Saturn 독립 QA](../Saturn/report.md): PASS. 초기 제품 결함 6건을 독립 재현·수정 확인하고 검사 사각지대 3곳의 보완도 확인했다. 검수 HEAD `c6b016277f3a8985c844c26f6b2bdb6ca2c24c89`; 이후 변경은 QA 보고 취합·스크린샷 수량 정정·상태·링크 메타데이터다.
- 필수 CI 5개와 dev squash의 최종 결과는 PR143에 기록한다. 통과 전 보호 우회·병합은 하지 않는다. dev 통합 후에도 CJ 플레이 QA가 남아 세 Issue는 OPEN으로 유지한다.
- 최초 base `57c7cc3`, 후속 Roblox PR141/142의 `origin/dev 68cd825` 통합. Roblox 작성 코드에 별도 수정하지 않았으며 소유 자원을 정리하지 않는다.

## 검증 범위와 운영 기록

- 브라우저 정보 가림 검사는 같은 탭의 소유자/비소유자 DOM 대조다. 실제 두 기기·외부망 종단간 검증, 물리 모바일, 비Chrome 검증과 사람 밸런스 통계는 포함하지 않는다.
- README 미디어 CI는 `--no-gh --no-render` 오프라인 부분 검사다. 새 PNG 해시 대조는 별도로 수행했으며 CI의 기존 WARN 정책을 엄격한 해시 게이트라고 표현하지 않는다.
- 선택적 추가 변이 31종·축소 14종 검사는 중단했으며 완료·PASS로 계산하지 않는다. 기존 역사 비교 fixture도 현행 18종 검수와 구분한다.
- Venus(Claude) 문서, Mars(Claude) 제품·테스트·CI·촬영, Saturn(Codex) READ_ONLY QA, Mercury 조정·Git·문서 메타데이터. Venus의 촬영 대기 미완료 메타데이터는 PD가 완성하고 원래 보고와 후속 완료 기록을 모두 보존했다.
- Run `run_a30f84eaadf5`의 작업을 취합했고 해당 Worker는 모두 archive/release했다. Claude 한도 중단은 관찰되지 않아 Codex 구현 대체를 실행하지 않았다.
- 보호 경로 내용·사용자 아트·Downloads 원본을 읽거나 수정·스테이징하지 않았다. CJ가 요청한 일반 Git 상태 출력의 경로 이름 노출은 원문 QA 보고에 보존한다.

정식 출시는 v0.4.5, Roblox #118은 별도 v0.4.6이다. 이번 승인 범위 외 v0.4.7 이슈 착수와 신규 Release는 진행하지 않았다. 다음 게이트는 이번 세 Issue에 대한 CJ 플레이 QA다.
