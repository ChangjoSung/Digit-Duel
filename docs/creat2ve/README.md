# CHANGJO GAMES · Digit-Duel 운영 안내

[개발자 문서](../README.md) · [운영 보고 열기](CHANGJO_GAMES_ORG_RNR.html) · [GitHub 업무](https://github.com/ChangjoSung/Digit-Duel/issues)

## 읽는 순서

1. 작업자는 [AGENTS.md](../../AGENTS.md)에서 정확한 workspace·Vault·역할·보존 조건을 확인합니다.
2. 회사 Vault의 `Org Chart and R&R.md`에서 문서별 소유자와 효력을 확인합니다.
3. `Projects/Digit Duel.md`의 current → work → team/runtime → authority → qa-policy → handoff와 decisions를 읽습니다.
4. 배정된 부서 정본과 해당 GitHub Issue의 현재 AC를 읽고 작업합니다. 과거 착수문은 자동 재개하지 않습니다.

## 회사 Vault 문서 트리

```text
CHANGJO GAMES/
├─ Org Chart and R&R.md             Mercury · 회사 역할·정본 목록
└─ Projects/
   ├─ Digit Duel.md                 Mercury · 현황·업무·권한·인계
   └─ Digit Duel/
      ├─ PLAN/                      Venus
      │  ├─ Rules.md                규칙
      │  ├─ UI UX.md                화면·입력 계약
      │  ├─ Singleplayer Draft.md   싱글 확정 계약·후속 제안
      │  └─ Decision Log.md         제품 결정·변경 이력
      ├─ ART/
      │  └─ Art Specification.md    Earth · 시각 계약·자산 인수
      ├─ CLIENT_TOOLING/
      │  └─ Client and Tools.md     Mars · 클라이언트·도구
      ├─ SERVER/
      │  └─ Server Operations.md    Jupiter · 서버·DB·운영·복구
      └─ QA/
         └─ QA.md                   Mercury 기록 · Saturn 판정
```

Vault 등록 이름은 **CHANGJO GAMES**, 실제 루트는 `E:/Toolkit/Mirror/CJ Library/CHANGJO GAMES`, 문서 논리 ID는 `613e72a275ee9be3`입니다. 앱 등록 ID와 논리 ID를 혼동하지 않습니다. Windows CLI는 [AGENTS.md](../../AGENTS.md)의 절대 `Obsidian.com` 경로·짧은 순차 호출·저장 후 재읽기 계약을 따릅니다.

## 회사 작업 흐름

| 단계 | 책임 | 결과가 기록되는 곳 |
| --- | --- | --- |
| 방향·제품 판정 | CJ | PM 운영 원본의 결정 이력 |
| 접수·범위·의존·Git/PR 조정 | Mercury PM | 프로젝트 운영 원본·GitHub |
| 기획·시각 계약 | Venus · Earth | PLAN · ART |
| 구현·관련 검사 | Mars · Jupiter | 코드·실행 영수증·CLIENT_TOOLING · SERVER |
| 파일 무수정 독립 검수 | Saturn | 메시지 → Mercury의 QA 기록 |
| 제품 확인·출시 | CJ · Mercury | GitHub AC·PR·tag/Release·실제 배포 |

Worker는 승인된 Role·workspace·변경 범위와 검증 조건을 받아 시작합니다. 모델·effort 설정, 실제 응답 성공, API 처리 tier는 구분합니다. 완료 보고와 실제 전용 터미널 정리를 확인하며 사용자 세션은 보존합니다.

## 편집·게시 경계

회사·프로젝트·각 부서의 현행 문서 정본은 **회사 Obsidian Vault**다. [AGENTS.md](../../AGENTS.md)에서 정확한 Vault·필독 순서를 확인하고 `Org Chart and R&R.md`의 정본 목록과 `Projects/Digit Duel.md`를 읽는다.

- [운영 HTML](CHANGJO_GAMES_ORG_RNR.html): 두 원본에서 생성한 열람·인쇄용 보고서.
- [worker-models.json](worker-models.json): 모델/effort의 기계 설정. 업무·AC·공식 종결은 GitHub, 코드·검사·배포는 각 시스템을 유지한다.
- [prompts/](prompts/): 기존 Role 기동의 짧은 진입점. 부서 내용은 지정 Obsidian 문서에서만 편집한다.
- [범용 핸드북](Creat2veVibeCodingStructure.html)·`github-infra.json`: 범용 구조 보관본이며 Digit Duel 최신 CJ 결정이 우선한다.

HTML 본문은 직접 편집하지 않는다. `tools/docs/org_rnr_source.py preview|apply`의 기본 scope는 회사 조직 `ai-organization`, `--scope project-operations`는 프로젝트 나머지 12개 영역이다. CLI preview에서 원본·대상·구조·해시를 검토하고 `apply --target-sha256 <preview 값> --source-sha256 <검토한 원본 값>`으로 반영한다. `--fixture`는 오프라인 미리보기 전용이다. 연결·소유자·효력·해시 불일치는 쓰기 전 중단한다. 기존 Python `beautifulsoup4`·`markdown-it-py`가 필요하며 회귀는 `python -B tools/docs/test/org_rnr_source_test.py`다.

역사·코드·게임 자산·백업은 원래 위치에 보존한다. 저장소의 필요한 안내 문서는 정본 링크·기준 시각·source ID/해시를 표시한 열람 출력으로 게시한다. 다른 프로젝트에 규칙을 전파하지 않는다.
