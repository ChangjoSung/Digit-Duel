# 부서별 Worker 실행 설정

2026-09-13 CJ 승인 · Issue #211 · v0.4.10 계획 범위. 이 문서와 worker-models.json은 Mercury가 신규 Orca Worker를 시작할 때 사용하는 실행 계약이다. Orca가 JSON을 자동으로 읽는 기능은 없으므로 Mercury는 해당 항목의 agent/model/effort를 worker-start 인수로 반드시 전달한다.

| 부서 / 작업 | agent | model | effort |
|---|---|---|---|
| Mercury_PD | codex | gpt-5.6-terra | low |
| Venus_Plan | claude | claude-sonnet-5 | medium |
| Earth_Art 신규 창작 | codex | gpt-6-astra | medium |
| Earth_Art 기존 자산 수정 | codex | gpt-5.6-terra | medium |
| Mars_Client | claude | claude-sonnet-5 | medium |
| Jupiter_Server | claude | claude-sonnet-5 | medium |
| Saturn_QA | codex | gpt-5.6-sol | medium |

## 실행 및 검증

1. CLAUDE.md의 역할 계약과 required_role/mode/area/mutation/instance_index를 먼저 검증한다. 부서의 표시 이름은 Mercury_PD 등이며 기존 역할 식별자 Mercury/Venus/Earth/Mars/Jupiter/Saturn은 유지한다.
2. JSON의 해당 작업 유형을 선택하고 새 Worker에 `--agent`, `--model`, `--effort`를 명시한다. 예: `orca orchestration worker-start --spec "자기완결적 작업 명세" --worktree current --agent claude --model claude-sonnet-5 --effort medium --json`.
3. 시작 영수증의 launch.requested와 launch.effective를 대조하고 실제 응답 성공도 별도로 확인한다. 설정 저장, 실행값 전달, 제공자의 응답 성공을 구분한다. 모델 접근 오류는 자동으로 다른 모델에 넘기지 않고 보고한다.
4. 기존 터미널 재사용에는 모델/effort 인수를 조합하지 않는다. 모델 변경이 필요하면 정리된 인계문으로 같은 역할의 새 Worker를 시작한다. 현재 PD 대화의 모델은 계정 설정 파일 저장만으로 바뀌지 않는다.
5. 완료 후 worker_done을 검증하고 `orca orchestration worker-release --dispatch <id>`를 실행한다. release가 출력 보관과 자원 정리를 수행하며 별도 archive 명령을 사용하지 않는다. 불필요한 Worker나 모델별 단순 인사 테스트를 반복 기동하지 않는다.

## 상향 및 토큰 운영

- Mercury: 복합 판단 Terra medium/Sol medium, 난해한 트랙 충돌 Astra medium.
- Venus/Mars/Jupiter: Sonnet high, 같은 원인의 2회 실패 후 근거를 정리해 Opus 5 high. 역할은 유지한다.
- Earth: 신규 창작 Astra medium, 복잡한 스타일 충돌만 Astra high. 승인된 규격의 수정/파생은 Terra medium, 파일명/명세 정리는 Luna low. 래스터 생성 엔진은 대화 모델과 별개이며 픽셀 그리드·팔레트·투명도·게임 크기 가독성을 검증한다. 도구 코드는 Mars 소관이다.
- Saturn: 보안·비공개 정보·동기화 핵심 경계 Sol high, 상충 증거 Astra medium. 최저가 요약 모델로 독립 QA를 대체하지 않는다.
- 확정 문장 정리만 Haiku 4.5 사용 가능하며 effort는 지정하지 않는다. Max/Ultra/Ultracode·유료 가속은 기본값이 아니다.
- Worker 입력은 목적·범위·파일·보존 조건·완료 기준·현재 오류만 전달한다. 보고는 판정·파일·검사·미해결·증거 링크로 제한한다. 과거 전체 대화는 복제하지 않는다.
- 이벤트 대기를 사용하고 변경 없는 상태/전체 검사를 반복 조회·실행하지 않는다. 필수 CI는 유지한다.
- 대표 작업 5~10건의 총 사용량·완료 시간·재작업·QA 누락으로 조정한다. 측정 전 절감률을 단정하지 않는다.

## 역할과 관리

Venus는 Notion 기획서를 eli_adult 방식으로 작성·관리한다. 목적·흐름·규칙·예외·완료 조건을 쉬운 성인 언어로 설명한다. Earth는 도트·리소스·UI 시각/전환 설계, Mars는 HTML/Java/Unity C# 및 UI 동작 코드, Jupiter는 서버·DB·Table 스키마/검증을 담당한다. Table 의미/수치는 Venus/CJ, 클라이언트 로더는 Mars 소관이다. CSV 언급은 기존 TSV 일괄 변환 승인이 아니다. Mercury는 GitHub/Orca/운영 보고를 관리하고 기획 본문을 대행하지 않는다. Saturn은 파일 쓰기 없는 독립 QA다.

프로젝트 운영 결정만 적용한다. 범용 creat2ve-structure 원본을 자동 변경하지 않는다. 외부 서버와 Lobby/System Flow는 CJ 개별 요청 전 착수하지 않는다.

## 적용 범위 — Digit-Duel 전용

CJ의 2026-09-13 추가 지시에 따라 계정 전역 기본값은 유지한다. 최초 작업 중 전역값을 변경했으나 즉시 Codex Astra medium/priority, Claude opus[1m]/effort 미지정으로 복원했다. 백업은 각 설정 파일 옆 `.before-211-20260913`에 보존한다. 인증·MCP·권한과 다른 설정은 변경 대상이 아니다. 독립 비교에서 Codex TUI가 생성한 `tui.model_availability_nux.gpt-6-astra=1` 안내 확인 메타데이터만 추가됐음을 확인했다. 이 UI 메타데이터는 모델/effort 기본값이 아니므로 유지하며, 그 외 설정은 백업과 의미상 동일하다.

Digit-Duel의 신규 Worker에만 위 모델·effort를 CLI 인수로 적용한다. 다른 프로젝트나 연결 계정의 기본 모델은 변경하지 않는다. 현재 PD 대화는 기존 실행값을 유지하고, 다음 Digit-Duel PD 세션은 프로젝트 Codex 설정 또는 명시적 Terra low 실행 인수로 시작한다. Orca UI에서 명시적으로 선택한 모델은 프로젝트 기본값보다 우선할 수 있으므로 시작 영수증을 확인한다.
근거: [OpenAI 설정](https://learn.chatgpt.com/docs/config-file/config-reference), [Claude 모델 설정](https://code.claude.com/docs/en/model-config), 설치된 Orca 1.4.200의 worker-start 도움말.
