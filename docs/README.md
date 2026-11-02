# Digit-Duel 개발자 문서

[게임 소개·플레이](../README.md) · [기여·PR·CI](../CONTRIBUTING.md) · [회사 운영·Orchestration](creat2ve/README.md) · [릴리스](releases/README.md) · [GitHub 업무](https://github.com/ChangjoSung/Digit-Duel/issues)

## 필요한 문서 찾기

| 하려는 일 | 먼저 읽을 곳 | 편집 책임·정본 |
| --- | --- | --- |
| 프로젝트 인수·업무 확인 | [AGENTS.md](../AGENTS.md) → [회사 운영 안내](creat2ve/README.md) | Mercury PM · 회사 Obsidian의 프로젝트 운영 노트 |
| 게임 규칙·싱글 플레이 기획 | [회사 문서 트리](creat2ve/README.md#회사-vault-문서-트리) | Venus · PLAN 지정 노트 |
| 아트·UI 시각 계약 | [회사 문서 트리](creat2ve/README.md#회사-vault-문서-트리) | Earth · ART 지정 노트 |
| 웹 화면·클라이언트·개발 도구 | [도구 실행](../tools/README.md) · [게임 검사](../demo/test/README.md) | Mars · CLIENT_TOOLING 지정 노트와 실제 코드 |
| 서버·DB·배포·복구 | [서버 실행](../server/README.md) | Jupiter · SERVER 지정 노트와 실제 서버·배포 시스템 |
| 독립 QA·완료 판정 | [QA 운영 원칙](creat2ve/CHANGJO_GAMES_ORG_RNR.html#qa-policy) | Saturn 메시지 → Mercury가 QA 정본 기록 |
| 버전 범위·완료 조건 | [마일스톤 안내](milestone/README.md) | GitHub Issue·Milestone |
| 과거 구현·실패·승인 근거 | [기록 보관소](milestone/README.md#과거-기록) · [Notion 보관본](creat2ve/notion-archive/2026-09-16/README.md) | 당시 기록을 보존하며 현재 지시와 구분 |

## 저장소 파일 트리

```text
Digit-Duel/
├─ README.md                 플레이어: 게임·화면·실행
├─ AGENTS.md / CLAUDE.md     작업자: 정본·역할 진입
├─ CONTRIBUTING.md           개발자: PR·필수 CI·기여 조건
├─ demo/                     웹 클라이언트·게임 자산
│  └─ test/                  클라이언트 회귀·검사
├─ server/                   계정·로비·경기 판정·DB
├─ tools/                    검사·아트·문서·PM 진입 도구
├─ docs/
│  ├─ README.md              이 개발자 길잡이
│  ├─ creat2ve/              회사 운영 진입·생성 열람 HTML
│  ├─ releases/              출시 버전별 공식 노트
│  ├─ screenshots/           README 게임 화면
│  └─ milestone/             버전 → Issue → 소관의 과거 근거
└─ roblox/                   별도 포팅 트랙·원본 보존
```

로컬 `unity/`와 외부 artifact·백업은 별도 소유 자료입니다. 탐색 편의를 위한 이 트리는 실제 디렉터리를 이동하거나 다른 트랙의 작업을 시작하라는 지시가 아닙니다.

## 정본과 열람 문서

회사 Vault의 **`Org Chart and R&R.md`**가 소유자 목록, **`Projects/Digit Duel.md`**가 프로젝트 운영 진입점입니다. 지정 부서 노트에서 전문 내용을 편집합니다. [운영 HTML](creat2ve/CHANGJO_GAMES_ORG_RNR.html)은 두 원본에서 생성한 열람 출력입니다.

[worker-models.json](creat2ve/worker-models.json)은 모델·effort의 기계 원본입니다. Issue·AC·공식 종결은 GitHub, 구현은 Git, 검사는 실행 결과·CI, 실제 배포는 Render를 확인합니다. 검색 결과·과거 보고·이 길잡이를 현재 상태의 별도 원장으로 사용하지 않습니다.

문서 경로·역사 근거는 보존합니다. 이동된 옛 주소는 [경로 대조표](milestone/MOVES.md)에서 찾습니다.
