# Digit-Duel 문서 안내

최신 정식 릴리스는 **[v0.4.5](releases/v0.4.5.md)**입니다. 2026-09-08 [Issue #114](https://github.com/ChangjoSung/Digit-Duel/issues/114)의 제품·문서·미디어 독립 QA와 CJ 플레이 QA를 통과했습니다.

## 지금 읽을 문서

| 목적 | 문서 |
|---|---|
| 게임 소개·실행 방법 | [프로젝트 README](../README.md) |
| 출시된 규칙을 쉽게 읽기 | [v0.4.5 규칙 정리본](milestone/v0.4.5/specs/v0.4.5-rules-digest.md) |
| 출시된 규칙의 세부·예외 | [v0.4.5 게임플레이 계약](milestone/v0.4.5/specs/v0.4.5-gameplay-spec.md) |
| 개발 중인 탐색·기술·연출 규칙 | [v0.4.7 승인 계약](milestone/v0.4.7/issues/121/Venus/gameplay-spec.md) · [변경 안내](releases/v0.4.7.md) — #121·#125·#129, CJ 플레이 QA 대기 |
| 버전별 변경 내용 | [릴리스 노트 목록](releases/README.md) |
| 구현·QA 기준과 최신 CJ 결정 | [GDD-13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) |
| 역할·Git·작업 계약 | [CLAUDE.md](../CLAUDE.md), [권위 문서 등록표](creat2ve/AUTHORITY.md) |
| 기여·PR·CI 사용법 | [CONTRIBUTING.md](../CONTRIBUTING.md) |
| Mercury 인수·현재 상태 | [인수인계 스냅샷](creat2ve/HANDOVER_SNAPSHOT.md) |

## 버전별 기록

과거 구현·QA 기록은 **버전 → Issue → 작성 역할** 순서로 [`milestone/`](milestone/README.md)에 보관합니다. 각 문서는 작성 당시의 판정이며 이후 버전에서 바뀐 규칙을 반영하지 않습니다.

| 버전 | 범위 | 인덱스 |
|---|---|---|
| v0.4.6 | Roblox 포팅 — #118 (진행 중) | [v0.4.6](milestone/v0.4.6/README.md) |
| v0.4.7 | #121·#125·#129 구현·검수, 나머지 게임 이슈 착수 대기 · Infra #132/#134 완료 | [v0.4.7](milestone/v0.4.7/README.md) |
| v0.4.5 | 턴 행동 정리·문서·튜토리얼 갱신 — #114 | [v0.4.5](milestone/v0.4.5/README.md) |
| v0.4.4 | 전투 변수·온라인 시점·턴 흐름 — #91~#96 #104~#106 | [v0.4.4](milestone/v0.4.4/README.md) |
| v0.4.3 | 하수인 아트·말판 아이콘 — #81 #83 #87 #89 | [v0.4.3](milestone/v0.4.3/README.md) |

v0.4.2 이하의 변경 내용은 [릴리스 노트 목록](releases/README.md)에 있습니다.

## 그 밖의 폴더

| 위치 | 용도 |
|---|---|
| [`milestone/`](milestone/README.md) | 버전별 규격·구현·독립 QA 보고와 원본 측정 자료 |
| `media/` | README 홍보 이미지와 과거 v0.4.5 튜토리얼 캡처. 새 버전의 검증 캡처는 해당 Issue의 `Mars/artifacts/`에 보관 |
| `screenshots/` | 이전 README 화면 자료. 현재 규칙 안내에는 사용하지 않음 |
| [`creat2ve/`](creat2ve/README.md) | 범용 조직 핸드북 사본과 자동 경로 장애 시 수동 백업 |
| `releases/` | 버전별 패치 노트 |

## 정리 기준

현재 안내는 이 목록과 최신 규칙 정리본을 갱신합니다. 완료 보고·초기 REVISE·변이 검출·절차 위반·출처 자료는 과거 판정의 근거이므로 최신 규칙에 맞춰 덮어쓰지 않습니다. 파일명에 `initial`, `first`, `revise`가 있다는 이유만으로 불필요한 문서로 판단하지 않습니다.

문서 삭제·이동은 대체 문서와 저장소·GitHub·Notion 참조를 확인한 뒤 수행합니다. 이미지·JSON·로그가 보고서에 연결돼 있으면 함께 보존합니다. 2026-09-09 문서 재배치의 옛 경로 → 현재 경로 대조는 [MOVES.md](milestone/MOVES.md)에 있으며, 본문이 인용하는 옛 경로는 그 시점 기록이라 고치지 않았습니다. `creat2ve/`의 managed 파일은 프로젝트의 현재 규칙으로 오인하지 않으며, 구조 원본의 갱신 절차를 따릅니다.
