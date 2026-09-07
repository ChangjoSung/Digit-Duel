# Digit-Duel — 인수인계 스냅샷

> 기준일: 2026-09-07 · Mercury(PD, GPT-6 Astra/high) · 현재 상태로 치환.

## 현재 상태

- Mercury는 조정·Git·문서 메타데이터만. 제품·테스트·도구는 Mars/Jupiter, QA는 Saturn READ_ONLY, 기획은 Venus, 아트는 Earth.
- 최신 릴리스 **v0.4.3**, main/tag **cc3f382496473233334f374896d46639b83d7974**. Release PR#97 MERGED, annotated tag·GitHub Release 게시. CJ 아트 QA 통과에 따라 Milestone#7 CLOSED(open0), Issue#89 CLOSED.
- v0.4.4 여섯 항목은 구현·독립 QA를 마쳤다. **Milestone#10과 Issue#91~#96은 CJ 플레이 확인 전 OPEN**, v0.4.4는 미출시. 구현 승인을 재질문하지 않는다.
- dev 통합 PR은 #98·99·101·100·102·103. 최종 #92 제품 검수 커밋 **1322c1de50c2701efa2c39b46c2e8359e2fd73a2**. 이후 문서만 갱신한다. squash 후 dev SHA·PR 병합 상태·현재 브랜치는 실제 Git/GitHub를 원본으로 확인한다.
- 보호: 사용자 미추적 **art/**·**orca-hook-latency-report.md** 접근·수정·스테이징 금지. Downloads 원본과 기존 승인 아트100파일 보존.

## v0.4.4 결과

| Issue | 구현 | PR / QA |
|---|---|---|
| #91 | 자산 부재가 아닌 연결 누락. 중립 속성 표준형·적 원종의 외형 정체를 표시 전용 artRosterId로 승계 | #98 · Saturn PASS |
| #92 | 타 속성 후보1·공격 슬롯0/1 교체/유지·쿨 승계. 공격 기술속성/방어 본체속성, 포획 시 실제 skills 복사 | #103 · Saturn_3 규칙 및 Saturn_1 브라우저 PASS |
| #93 | 온라인 P2 행 표시 반사, 열·논리 좌표 불변, 자기 진영 하단 | #102 · Saturn PASS |
| #94 | 상대/AI 턴 로컬 메모, 오래된 피커 콜백 무효, 게임 행동 권한·동기화 유지 | #100 · Saturn PASS |
| #95 | 공격형4종 atk26→25·결정타44→40 | #99 · Saturn PASS |
| #96 | 일반 감전70→50%, 화상/약화70%·확정 감전100% 유지 | #101 · Saturn PASS |

- 최종 결합 Mars **1009/1009**(10스위트), Saturn 직접 **852/852**(파일을 쓰는 원본 online157 제외), 실제 Chrome **56**(기술교체20+시점18+메모18) 및 독립 경합 **22** PASS. 추가 규칙 검증8그룹(공격조합192·후보집합576·AI교체정책34560·포획20종·공정AI60시드쌍 등)과 변형7개 탐지. 별도/반복 수치를 고유 스위트 수에 더하지 않는다. GitHub CI 없음.
- #92 통합 최초 모달 결함: 비소유자 대기 화면이 공통 modal 코어를 건너뛰어 메모4검사 실패. _modalCore(잠금HTML,[])로 소유권·토큰 처리 복구, 새 단언2개 및 실제2클라이언트 오래된 저장/삭제/닫기 경합 검증으로 해소. 최초·통합·최종 보고를 모두 보존.
- #92 제품 SHA256 **0fe0bf450c5c29bd3d2a65034cdd832b16927fc898774f5b7d3c2ebecbcb7fbb**. 원본 보고의 이전 해시는 이력이며 현재 검수는 issue92-integration.md·issue92-saturn.md·issue92-saturn-browser.md 기준.
- #95 전체 판 후공−선공 격차14.2→5.2%p, 도망 제외 결판14.9→10.1%p. 그러나 비미러 결판3.5→7.1%p·불17.4→18.2%p 증가. 모든 대진/사람 균형 해결로 해석하지 않는다.
- #96 공격형 조정이 양쪽에 포함된 dadc8bc 기준 비교: 감전1000회×5구간46.9~51.0%, 화상/약화 결과벡터와 확정감전 이후RNG 동일. AI40판 전투당0.179→0.139. 이전 기준0.160→0.128과 혼동 금지.
- 미측정: 실제 원격LAN·모바일·비Chrome·wss·사람 밸런스. 보드 AI의 본체속성 전투 추정은 유지하며 자기 습득기술까지 반영하는 확대는 별도 기획. 감전 순서의 위치 의존성과 4슬롯1R/레거시 지속형2R 부채도 현행 유지.
- 기존 비권위 lockstep은 상대 데이터를 클라이언트 메모리에 보유한다. 이번 개인정보 경계는 새 DOM/이미지/접근성/로그/URL 노출 방지다. 실제브라우저 검증의 위치·시드·HP fixture와 자연 경기/사람 체감을 구분한다.

## 작업자와 Git 운영

- Run **run_0e980a99ab14**. 현재 PD 소유 활성 Worker 없음. #92 Mars 통합 ctx_6c7d2211748c, Saturn 규칙 ctx_fb76b810ffd0(메시지 msg_dbb798ff7e0d), 브라우저 ctx_cc06343550b6(msg_691ff7eabcf9) 모두 완료·archive·release.
- #92 중복 브라우저 범위 task_791aab9dd1c0/ctx_bbc10559f749는 산출물0에서 취소. worker-stop 반환 dispatch_inactive 후 worker-show가 exactWorker exited/operator_close를 확인했다. release는 identity_unproven retained: 살아 있는 작업자 아니며 강제 정리하지 않는다.
- 이전 v0.4.3 Saturn **ctx_7587a359d6a6**은 user_takeover/user_owned retained이므로 재사용·강제 종료 금지. legacy ctx_69e49a5d18ee는 살아 있는 리소스 없음.
- 완료 child 경로: fix-94-opponent-turn-memo detached cdfd349, fix-95-attack-archetype-balance detached 3f006bb. 활성 Worker 없음.
- 목표별 Issue1개+PR1개, 분할은 Orca Task. Worker Git/GitHub/Notion 쓰기 금지(stash 포함). Saturn은 어떤 파일도 작성하지 않고 inline files_modified=[]; PD가 보고 취합.
- main/dev 직접 커밋 금지. dev PR squash 후 트리 동일 확인·feature 로컬/원격 명시 삭제. v0.4.4 main 병합·태그·마일스톤 종료는 CJ 플레이/출시 지시 후.
- Worker 완료 즉시 release 또는 정확한 기존 agent_terminal_handle을 확인해 같은 유한 범위 즉시 후속 Task로 이관. 이미 종료/사용자 소유 프로세스는 강제 종료하지 않는다.

## 문서와 다음 접수

- 상세 취합: **docs/qa/v044-pd-report.md**. 구현 계약: **docs/v0.4.4-gameplay-spec.md**, 외형 rev8 **docs/minion-visual-spec-v0.4.3.md**. 검증 이력/PNG/JSON은 docs/qa/issue91~96 문서 및 폴더.
- Notion: GDD-13 3·4.6·4.7·4.8·6·9장·Decision Log28/29; GDD-14 5·8장/D15~17; GDD-15 공격형4종; GDD-16 슬롯·기술속성·결정타·감전·포획승계. Project=Digit Dual, Edit Date=2026-09-07, Editor=실제 사람 성창조.
- 다음 절차: CLAUDE 전체 → 이 스냅샷 → 실제 git status/origin/dev/main → Milestone#10·열린 Issue/PR → 활성 Run/Task/Dispatch. 최신 CJ 플레이 Comment를 받아 해당 부서로 라우팅한다. v0.4.3 재출시·과거 미승인 게이트 복원 금지.
