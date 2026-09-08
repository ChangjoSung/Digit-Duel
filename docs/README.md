# Digit-Duel 문서 안내

최신 정식 릴리스는 **v0.4.4**입니다. **v0.4.5는 [Issue #114](https://github.com/ChangjoSung/Digit-Duel/issues/114) 제품 구현·Saturn 독립 QA를 마치고 CJ 플레이 QA를 기다립니다.** 검수된 개발 제품과 정식 출시를 구분합니다.

## 지금 읽을 문서

| 목적 | 문서 |
|---|---|
| 게임 소개·실행 방법 | [프로젝트 README](../README.md) |
| 출시된 규칙 | [v0.4.4 규칙 정리본](v0.4.4-rules-digest.md) |
| 버전별 변경 내용 | [릴리스 노트 목록](releases/README.md) |
| 구현·QA 기준과 최신 CJ 결정 | [GDD-13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) |
| 현재 v0.4.5 안건 | [Milestone11](https://github.com/ChangjoSung/Digit-Duel/milestone/11), [Issue #114](https://github.com/ChangjoSung/Digit-Duel/issues/114), [CJ 턴 행동 원문](https://app.notion.com/p/3d51e7f1708580b0916ded4bd3d9d06e) |
| v0.4.5 승인 규칙 (구현·QA 계약) | [v0.4.5 게임플레이 계약](v0.4.5-gameplay-spec.md) |
| v0.4.5 규칙을 쉽게 읽기 (미출시 초안) | [규칙 정리본 3호 초안](v0.4.5-rules-digest.md) |
| v0.4.5 변경·검증 결과 | [릴리스 노트 (UNRELEASED)](releases/v0.4.5.md), [PD 통합 보고](qa/issue114-pd-report.md) |
| v0.4.5 분석·튜토리얼 수정안 | [부서 분석 취합·CJ 결정 경계](v0.4.5-analysis.md) |
| v0.4.5 Notion 동기화·독립 검수 이력 | [GDD-13·12·14·DIGEST 치환 근거](qa/issue114-notion-sync.md) |
| 역할·Git·작업 계약 | [CLAUDE.md](../CLAUDE.md), [권위 문서 등록표](creat2ve/AUTHORITY.md) |
| Mercury 인수·현재 상태 | [인수인계 스냅샷](creat2ve/HANDOVER_SNAPSHOT.md) |

## 상세 규격과 검수 이력

| 위치 | 용도 |
|---|---|
| [v0.4.4 게임플레이 규격](v0.4.4-gameplay-spec.md) | 탐색 기술 교체·온라인 시점·메모·수치 조정 계약 |
| [v0.4.4 턴 흐름 규격](v0.4.4-turn-flow-spec.md) | 회복·접촉·전투·연출 계약과 당시 권고·채택 이력 |
| [하수인 외형 규격](minion-visual-spec-v0.4.3.md) | 승인 아트의 설명창·전투·말판 적용 기준 |
| [v0.4.4 1차 통합 보고](qa/v044-pd-report.md) | #91~#96의 구현·QA 근거 |
| [v0.4.4 후속 통합 보고](qa/v044-followup-pd-report.md) | #104~#106의 최종 근거·측정 한계 |
| [Worker 절차 위반 기록](qa/issue106-pd-incident.md) | Git·프로세스 소유권 위반 및 확인 한계 |
| `qa/` | 각 시점의 구현자·독립 QA 보고와 원본 측정 자료 |
| `art/` | 승인 아트의 제작·검수·출처 기록 |
| `media/` | README 홍보 이미지와 튜토리얼 캡처. 현재 튜토리얼 PNG는 v0.4.3 이력 |
| `screenshots/` | 이전 README 화면 자료. 현재 규칙 안내에는 사용하지 않음 |
| [creat2ve 안내](creat2ve/README.md) | 범용 조직 핸드북 사본과 자동 경로 장애 시 수동 백업 |

## 정리 기준

현재 안내는 이 목록과 최신 규칙 정리본을 갱신합니다. 완료 보고·초기 REVISE·변이 검출·절차 위반·출처 자료는 과거 판정의 근거이므로 최신 규칙에 맞춰 덮어쓰지 않습니다. 파일명에 `initial`, `first`, `revise`가 있다는 이유만으로 불필요한 문서로 판단하지 않습니다.

문서 삭제·이동은 대체 문서와 저장소·GitHub·Notion 참조를 확인한 뒤 수행합니다. 이미지·JSON·로그가 보고서에 연결돼 있으면 함께 보존합니다. `creat2ve/`의 managed 파일은 프로젝트의 현재 규칙으로 오인하지 않으며, 구조 원본의 갱신 절차를 따릅니다.
