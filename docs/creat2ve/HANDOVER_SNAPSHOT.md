# Digit-Duel — 인수인계 스냅샷

> 기준일: 2026-09-07 · Mercury (PD) · 현재 상태로 치환.

## 현재 상태

- Mercury: GPT-6 Astra/high. 조정·Git·문서 메타데이터 전담. 코드·도구·테스트는 Mars/Jupiter, QA는 Saturn READ_ONLY, 기획은 Venus, 아트는 Earth.
- 최신 릴리스 **v0.4.3**, main **cc3f382496473233334f374896d46639b83d7974**. Release PR#97 merge commit, annotated tag 및 GitHub Release 게시. Milestone#7 CLOSED(open 0), Issue#89 CLOSED: CJ 아트 적용 QA 통과.
- 통합 origin/dev **dadc8bc105b858b4ed9f93c07cd0e1fe7897bead**(PR#98·99, #91·95 수정). main v0.4.3 제품 기준은 eff5c16이며 dev에 두 수정이 추가됐다. main에 먼저 있던 README 제목 변경은 보존했다. 최신 SHA는 실제 Git/PR을 대조한다.
- 현재 Milestone#10 **v0.4.4 — 전투 변수·온라인 시점·메모 개선** OPEN.
- CJ 최신 지시: 아래 여섯 항목 이슈 등록·객관적 분석 후 구현. 기존 승인 대기 문구를 되살리거나 동일 승인을 재질문하지 않는다. v0.4.4 출시와 최종 플레이 QA는 아직 남는다.
- 보호: 사용자 소유 미추적 **art/**·**orca-hook-latency-report.md** 수정·스테이징 금지. Downloads 원본 읽기 전용.

## v0.4.4 진행

| Issue | 목표 | 상태 |
|---|---|---|
| #91 | 탐색 공용 하수인 대리 출전 아트 누락 원인·수정 | Saturn 최종 PASS·PR#98 dev dcb668e 통합, CJ 플레이 확인 대기 |
| #92 | 탐색에서 다른 속성 기술 획득·교체 | 타 속성 후보1·공격 슬롯0/1 선택·쿨 승계 계약 채택, 구현 대기 |
| #93 | 양측 모두 자기 진영을 아래에 표시 | 배치/대전 단계 구분·행 표시 반사·공통 좌표 보존, Mars_2 구현 중 |
| #94 | 상대 턴에도 상대 말 추측 메모 허용 | 로컬 메모 분리·오래된 콜백 보호, PR#100 draft·Saturn_1 독립 QA 중 |
| #95 | 공격형 연속 공격 위력 완화 | V6 atk25·결정타40, Saturn PASS·PR#99 dev dadc8bc 통합, CJ 플레이 대기 |
| #96 | 감전 확률 하향 | 일반70→50%·확정 시그니처100% 유지, PR#101·Saturn_3 독립 PASS, dev 통합 준비 |

- Run **run_0e980a99ab14**. #91 Mars task_8a6aaf784bad / ctx_8aacb5344e21 완료·release. Mars 보고 637/637, 신규 CDP9·기존82 문제0이며 최초 납품 수치이며 아래 최종 QA로 대체됐다. Venus 계약·REVISE·#92 포획 승계 검토/반영은 완료하고 모두 release했다.
- 현재 활성: Saturn_1 #94 **task_507de4d8172f / ctx_c689ad916ce0**, Mars_2 #93 **task_c0e8c2226a2d / ctx_cb260ff4ed07**, Saturn_3 #96 **task_2a003a79f9fc / ctx_57b2140202f3**. #94 통합 Mars 및 #96 통합 Mars는 완료·release. #91·#95 구현/QA Worker도 완료·release. 상태는 실제 orchestration check/worker-show를 우선한다.
- Saturn 최초 직접480 PASS·브라우저91측정 문제0, 기존이미지100동일. K8b의 송신 검사 결함은 Mars_3가 고쳤고 최종 Saturn 직접199 PASS 및 불필요한 송신 변형3개 탐지로 해소했다. 최초480과 최신199는 중복 합산하지 않는다. `docs/qa/issue91-saturn-initial.md`·`issue91-mars-revise.md`·`issue91-saturn.md`에 근거 보존. 실제 온라인2연결은 미검증.
- Mars 초기 분석 msg_9225fd125c3f는 절대 reportPath 계약 위반으로 거절·task failed·release. 재확인한 상대경로 보고는 `docs/qa/v044-technical-analysis-mars.md`에 납품했다. #91 표시 전용 필드는 `artRosterId`로 확정했으며 규칙이 읽는 `rosterId`를 새로 넣지 않는다.
- 현재 root 브랜치 **fix/96-shock-probability**, origin/dev dcb668e에서 분기했다. 최신 dadc8bc를 통합하고 0a45d56에서 독립 QA 중이다. #92는 #96 완료 후 착수한다. PR#98·99의 로컬·원격 feature 브랜치 삭제 완료, 각각 squash 최종 트리 동일 확인. 독립 목표별 Issue1개+통합PR1개, Worker별 중복 Issue/PR 금지.
- 병렬 작업 공간: Mars_1 `C:/Users/pc_77/orca/workspaces/Digit-Duel/fix-94-opponent-turn-memo` → `fix/94-opponent-turn-memo`(eff5c16 분기), Mars_2 `C:/Users/pc_77/orca/workspaces/Digit-Duel/fix-95-attack-archetype-balance` → **fix/93-own-side-bottom**(폴더 재사용, 최신 dadc8bc 분기). 납품 후 PD가 최신 dev를 통합하고 Saturn 검수·목표별 PR로 관리한다. 접미사는 dispatch 동안 유지한다.
- #95 독립 검증: 스모크532·Chrome8·추가 실제피해/UI32·통계80셀. 전체 판 후공−선공 격차14.2→5.2pt, 도망 제외 결판14.9→10.1pt지만 비미러 결판3.5→7.1pt·불17.4→18.2pt는 증가했다. `docs/qa/issue95-saturn.md`·Mars 보고·GDD-13 DL29·GDD-14 8장에 분모와 한계를 보존한다. 사람 균형 해결이나 모든 대진 개선으로 해석하지 않는다.
- #92 포획 승계 추가 계약: 실제 장착 skills 배열 복사(습득 기술 포함), 레거시만 템플릿 폴백, HP70/공용스탯/쿨0/공개기록[] 유지. 중립 포획은 std 그대로. #91에는 이 규칙 변경을 넣지 않는다. 임시 보조기 교체 시절부터 있던 잠재 불일치를 정합화한다.
- 구현자 납품 후 Saturn 독립 QA, PD diff·증빙 검토·dev squash, 정확한 feature 브랜치 삭제, CJ 플레이 확인 순서.
- GitHub·Notion·Git 쓰기는 Mercury만. main/dev 직접 커밋 금지. Worker 완료 시 즉시 archive·release하거나 같은 좁은 범위 즉시 후속 Task에 기한부 lease로 이관.

## v0.4.3 확정 근거와 회귀 경계

- 아트100파일: 20종×portrait PNG/WebP512·battle-grid64·battle128·icon32. PR#88, CJ 디자인/게임 적용 확인 완료. 기존 아트 재제작은 현재 필요 없음.
- 게임 적용 PR#90: 회귀 합계 **571/571**(69규칙+49메모+124튜토리얼+157온라인+41클라이언트+131아트), Saturn 2차 직접249/249, Chrome82측정0문제. PNG70파일(캡처74회, 중복덮어쓰기4).
- 근거: docs/qa/minion-art-integration-mars.md, minion-art-integration-saturn-initial.md, minion-art-integration-saturn-final.md. 초기 REVISE·실제 이미지 실패·무효 단언 보완 이력을 보존한다.
- 내 말·상대 공개 말 공통 아이콘+현재HP. 미공개 상대는 ?/뷰어 전용 8종 메모, 비가시 숲 말은 DOM 없음. 실제 숨은 종·HP·속성을 DOM/URL/접근성 정보에 노출하지 않는다.
- 온라인 lockstep은 상대 rosterId를 기존부터 클라이언트 메모리에 보관한다. 새 렌더·이미지 요청·접근성의 추가 노출 방지가 검수 범위이며 서버 권위형 구조 개편은 아님.
- 공용/포획 예비 하수인은 기존 아트 연결이 누락된 후속 수정 대상(#91). 전투 수치와 포획 HP 계약을 아트 매핑 때문에 바꾸지 않는다.
- 기존 모바일 가로 스크롤 유지. 실제 기기·비Chrome·브라우저 UI 확대 조작·사람 블라인드 식별은 미검증.
- 기존 코드 해시·라인엔딩은 .gitattributes와 QA 문서 참조. smoke_online은 mutant HTML 파일을 써서 Saturn 원본 실행 금지. Saturn은 파일/테스트/보고서/스크린샷 작성 금지, files_modified=[]. PD가 inline 보고를 보존하고 Mars가 필요 증빙·도구를 작성한다.
- 임시 Chrome 실행 리소스는 자신의 정확한 생성 경로·PID만 허용된 범위에서 정리. wildcard 삭제 금지.

## 운영 이력·교대 확인

- 이전 Run run_d8e8db3f76a9의 PD 소유 Worker는 모두 release. 1차 Saturn ctx_7587a359d6a6만 runtime user_takeover/user_owned retained이므로 재사용·강제 종료 금지.
- 오래된 legacy dispatch ctx_69e49a5d18ee에는 실제 살아 있는 로컬 터미널/리소스가 없다. 과거 기록을 현재 바쁜 역할로 오인하거나 복구하지 않는다.
- Notion GDD-13 §3·4.6·4.7·4.8·6·9·Decision Log28/29, GDD-14 §5·D15~17, GDD-15 공격형, GDD-16 슬롯·결정타·감전·기술 교체·포획 승계를 계약에 맞게 갱신했다. 문서 Version/요약도 갱신. Project=Digit Dual, Edit Date=2026-09-07, Editor=실제 사람 성창조 확인. 저장소 계약은 `docs/v0.4.4-gameplay-spec.md`, 외형 규격 rev8.
- 시작 절차: CLAUDE 전체 → 이 스냅샷 → 실제 Git status/origin/dev/main → Milestone#10·열린 Issue/PR → 활성 Run/Task/Dispatch. 완료한 v0.4.3을 다시 릴리스하거나 미승인 상태로 되돌리지 않는다.
