# Issue #134 — 검사·도구 구조와 일정 정리

2026-09-09 · Mercury(PD). 기준 dev `c6dd0a8c0d435daea220df0e9c628def0a58c26b`, 작업 브랜치 `infra/134-test-tools-layout`.

## 승인 범위와 배치

CJ는 `demo/test`·`tools`를 앞선 docs 정리처럼 버전·Issue·용도별로 정리하도록 지시했다. 추가로 Roblox 포팅을 v0.4.6에 두고 기존 CJ 이슈·정리를 v0.4.7로 옮기며 마일스톤 설명과 README 개발자를 갱신하도록 지시했다.

[MOVES.csv](MOVES.csv)는 원본 40개(검사 JS33·도구6·연관 Python 테스트1)를 모두 대응한다. 16개 현행 스모크는 `demo/test/regression/`에 함께 두어 형제 파일 검색을 보존하고, 하네스는 `shared/`, 재사용 비교기는 `reports/`, Issue 전용 15개는 `milestone/<버전>/issues/<번호>/`로 옮긴다. 도구7개는 `tools/docs/`, `tools/media/`, `tools/art/`와 각 `test/`에 배치한다. 역할 세그먼트는 실행 파일에 중복 추가하지 않고 보고서의 작성 역할을 보존한다.

PD가 40개를 `git mv`한 직후 SHA256은 **40/40 동일**했다. `.gitattributes`의 기존 명시 경로도 함께 옮겼다. 이후 Mars가 경로 의존성을 수정하므로 최종 소스 blob은 이동 전과 달라질 수 있다. 게임·서버·승인 아트 내용은 이 변경의 대상이 아니다.

## 일정·문서 메타데이터

- Milestone12: **v0.4.6 — Roblox 포팅**, #118 담당 lee775. 공개 커밋 이름 이욱채를 README 게임 정보의 개발자에 추가했다. 포팅 작업자의 코드·브랜치·진행 범위는 해당 작업자 소유로 보존한다.
- Milestone13: **v0.4.7 — 기획 재정비·세로 UI·연출·외부망**, 게임119–131과 Infra132/134·완료PR133. 두 마일스톤의 목표·수용 기준·선행 관계·상태를 수정하고 Milestone11의 탐색 후속 버전도 맞췄다.
- #132는 완료 보고 후 다음 CJ Comment 무이의 계약으로 종결했다. 두 역할 보고서를 `docs/milestone/v0.4.6/issues/132/`에서 `v0.4.7/issues/132/`로 이동하되 당시 분석·측정·예외 본문은 유지했다. v0.4.6 인덱스는 Roblox 안내로 바꾸고 v0.4.7 인덱스에 기존 게임·Infra를 배치했다.
- Notion GDD13의 현재 안내·DL40, GDD17의 제목·Version·Summary·일정 참조, 저장소 README·docs 안내·CLAUDE·스냅샷을 갱신했다. System 외부 편집 Summary와 과거 Decision Log는 보존한다.
- v0.4.5 릴리스 노트의 탐색 후속 일정에는 당시 v0.4.6 예정이 현재 v0.4.7로 바뀌었다는 날짜 있는 정정을 추가했다. 저장소 노트와 GitHub Release 본문을 맞췄으며 태그·출시일·제품 내용은 유지했다. 기존 GitHub Issue/PR 본문134개·댓글145개에서 이번 이동 경로를 가리키는 가변 dev/main URL은 0건이었다.
- 정식 출시·게임 규칙은 v0.4.5다. 게임119–131은 번호별 구현 지시 대기이며 이번에 신규 게임 릴리스를 발행하지 않는다.
- 작업 중 CJ가 최신 dev 확인을 요청했다. #118 PR135가 dev `4e7adf7745089549c96372c622244cb9d4e18da1`에 병합된 것을 확인했다. .gitignore와 Roblox 코드·자산·문서가 추가됐고 기존40개 경로 변경과 직접 충돌하지 않는다. PR135를 v0.4.6에 연결하고 실제 병합·QA 대기 상태를 일정·인덱스에 반영한다. 최종 #134 검수는 이 dev 통합분을 포함하며, 새 Roblox 산출물은 원형을 유지한다. 기존 HTML CI와 PR 작성자의 Luau646단언 보고를 Roblox 독립 QA 완료로 바꾸지 않는다.

## 절차 예외와 정정

Mars 분석 Task `task_92ced247fc08` / Dispatch `ctx_9d8d20ee11c8`는 `mutation=none`·파일 쓰기 금지였다. Worker가 보고 전송을 위해 자신의 Claude 임시 `scratchpad/body.txt`를 Write 도구로 생성한 성공 기록을 PD가 확인했다. 앞선 Bash 작성 시도는 문법 오류로 실패했지만, 뒤의 Write는 실제 성공했다. 보고의 “파일 쓰기 0건” 및 `files_modified=[]`가 전체 무변경을 뜻한다는 주장은 수락하지 않는다.

Orca는 해당 worker_done을 자동 완료로 기록했으나 PD가 `role_scope_mismatch`로 준수 판정을 거부하고 Task를 failed로 정정했다. 임시 파일과 transcript는 삭제하지 않았다. 분석 내용은 새 `mutation=code` 구현 Task `task_4731bc69ff1f` / Dispatch `ctx_a30f7c49f2f3`의 검토 입력으로만 전달했다. 같은 좁은 작업의 즉시 후속으로 Mars 터미널을 재사용했다. 이 예외를 정상 준수로 소급 승인하지 않으며 제품·보호 경로 접근 위반으로 확대 해석하지도 않는다.

## 검증·완료 상태

경로 수정과 구현자 검증 진행 중이다. 최종 검증 수치·Saturn 독립 판정·실제 PR CI와 통합 결과는 완료 후 아래에 기록한다.

CJ는 이동 후 `docs/milestone/v0.4.6`의 잔여 폴더 삭제도 요청했다. 읽기 전용 확인에서 `issues/132/Mars`, `issues/132/Venus`, `issues/132`, `issues`의 빈 폴더4개와 Roblox 안내 README만 남았다. PD의 삭제 명령은 자동 승인 검토의 `blocked by policy`로 실행 전 거부됐고, 확인한 개별 경로의 비재귀 삭제도 거부됐다. Worker나 다른 삭제 도구로 우회하지 않는다. 현재 직접 삭제는 미완료이며 정상 Git 통합 후 작업 트리 상태를 다시 확인한다.
