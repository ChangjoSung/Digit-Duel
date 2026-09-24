# 부서별 Worker 실행 설정

2026-09-23 CJ 승인 · Issue #250. 이 문서와 worker-models.json은 Mercury가 신규 Orca Worker를 시작할 때 사용하는 실행 계약이다. Orca가 JSON을 자동으로 읽는 기능은 없으므로 Mercury는 해당 항목의 agent/model/effort와 Codex의 `service_tier=default`(No Fast)를 실행 인수로 반드시 전달한다.

| 부서 / 작업 | agent | model | effort |
|---|---|---|---|
| Mercury_PD | codex | gpt-6-sol | xhigh |
| Venus_Plan | claude | claude-opus-5-5 | high |
| Earth_Art 신규 창작 | codex | gpt-6-astra | medium |
| Earth_Art 기존 자산 수정 | codex | gpt-6-luna | xhigh |
| Mars_Client | claude | claude-opus-5-5 | high |
| Jupiter_Server | claude | claude-opus-5-5 | high |
| Saturn_QA | codex | gpt-6-sol | xhigh |

## Ponytail 적용 계약 — 2026-09-18 CJ 승인

- Codex와 Claude의 설치 버전은 `4.10.0`, 기본 강도는 `full`이다. Mercury·Mars·Jupiter·Saturn의 모든 신규 Task 명세에 Ponytail 필수를 적고 실제 작업 범위를 이해한 뒤 가장 작은 정상 해법을 선택한다.
- Venus는 `eli-adult`를 항상 우선한다. 기술 기획에서 구현 범위·의존성·Acceptance Criteria의 YAGNI 검토가 실제로 필요할 때만 Ponytail `lite`를 병행한다.
- Earth의 순수 리소스·도트·UI 시각 제작에는 적용하지 않는다. 코드·도구 변경은 Mars로 라우팅하고 그 Mars Task에서 Ponytail을 적용한다.
- Ponytail은 역할 경계, 명시 요구, 입력 검증, 오류 처리, 데이터 보존, 보안, 접근성, 필수 QA를 생략하는 근거가 아니다.
- 프로젝트 절감률은 동일 조건의 대표 작업 5~10건에서 입력·캐시 입력·출력·추론·완료 시간·재작업을 측정하기 전 단정하지 않는다.

## Earth 이미지 Skill 선택 — 2026-09-24 CJ 지시

다음 Earth Task부터 Mercury는 **납품 형식과 기존 원본**을 먼저 확인해 dispatch에 사용할 Skill 경로를 적는다. Earth의 대화 모델(`gpt-6-astra` 신규 창작 / `gpt-6-luna` 기존 자산 수정)과 이미지 생성 엔진은 별개다. 이미지 도구를 호출했다는 이유로 특정 GPT Image 버전을 사용했다고 기록하지 않는다.

| 납품 대상 | Earth 작업 방식 |
|---|---|
| 기존 SVG·아이콘·로고·버튼 상태·9-slice 패널·정확한 픽셀 그리드 | 기존 편집 가능한 원본을 직접 수정·재사용한다. `imagegen`은 사용하지 않는다. #253 공용 UI가 이 경우다. |
| 새 배경화·캐릭터 일러스트·질감·분위기 시안 등 래스터가 최종 형식인 자산 | 설치된 `imagegen` Skill의 기본 내장 도구를 선택적으로 사용한다. 참조 이미지와 보존 조건을 명시하고 실제 게임 크기에서 가독성·팔레트·투명 가장자리·스타일 일치를 검사한다. |
| 이미지의 특정 부분만 바꾸는 수정 | 기존 파일을 보존하는 편집으로 요청한다. 단순 SVG/PNG 수정을 생성 이미지로 우회하지 않는다. |

- GPT Image 2.5는 래스터 시안 후보일 뿐, 모든 Earth 작업의 의무 도구가 아니다. Flare는 빠른 시안, Sunburst는 정밀 수정이 실제로 필요한 때 검토한다. 현재 설치된 `imagegen` Skill의 CLI 기본값은 `gpt-image-2`이고 내장 도구는 모델 ID를 노출하지 않는다. **2.5가 필요한 작업은 사용 가능한 모델 지정 경로와 실제 실행 영수증을 먼저 확인**하고, 확인되지 않으면 2.5 사용으로 보고하지 않는다. CLI/API 경로는 CJ가 명시적으로 선택했을 때만 사용하며 키를 채팅으로 받지 않는다. [공식 모델 선택](https://developers.openai.com/api/docs/guides/image-prompting), [요금](https://developers.openai.com/api/docs/pricing).
- 첫 래스터 과제는 소수 시안으로 적합성을 확인한다. 자산별 원본·내보내기·프롬프트/모델 영수증(확인 가능할 때)·출처·라이선스·실제 크기 검수 결과를 인계한다. 화면 문구, 서버 상태, 입력 잠금, 접근성 의미와 비공개 정보 가림은 생성 이미지에 굽지 않고 GDD와 Mars/Jupiter 실행 계약으로 처리한다.
- Mercury는 다음 Earth dispatch에 위 표의 대상 유형과 `imagegen` 사용 여부, 재사용할 원본, 검수 크기, 라이선스 기록을 명시한다. 새 아트가 필요 없으면 새 이미지를 만들지 않는다.

## 실행 및 검증

1. CLAUDE.md의 역할 계약과 required_role/mode/area/mutation/instance_index를 먼저 검증한다. 부서의 표시 이름은 Mercury_PD 등이며 기존 역할 식별자 Mercury/Venus/Earth/Mars/Jupiter/Saturn은 유지한다.
2. JSON의 해당 작업 유형을 선택하고 새 Worker에 `--agent`, `--model`, `--effort`를 명시한다. 예: `orca orchestration worker-start --spec "자기완결적 작업 명세; Ponytail full 필수" --worktree current --agent claude --model claude-opus-5-5 --effort high --json`.
3. 시작 영수증의 launch.requested와 launch.effective를 대조하고 실제 응답 성공도 별도로 확인한다. 설정 저장, 실행값 전달, 제공자의 응답 성공을 구분한다. 모델 접근 오류는 자동으로 다른 모델에 넘기지 않고 보고한다.
4. 기존 터미널 재사용에는 모델/effort 인수를 조합하지 않는다. 모델 변경이 필요하면 정리된 인계문으로 같은 역할의 새 Worker를 시작한다. 현재 PD 대화의 모델은 계정 설정 파일 저장만으로 바뀌지 않는다.
5. 완료 후 worker_done을 검증하고 `orca orchestration worker-release --dispatch <id>`를 실행한다. release가 출력 보관과 자원 정리를 수행하며 별도 archive 명령을 사용하지 않는다. 불필요한 Worker나 모델별 단순 인사 테스트를 반복 기동하지 않는다.

## 상향 및 토큰 운영

- Mercury와 Saturn은 Codex `gpt-6-sol` xhigh(No Fast), Venus·Mars·Jupiter는 Claude `claude-opus-5-5` high를 사용한다. 이번 고정 배치를 임의 자동 대체하지 않는다.
- Earth는 신규 창작 `gpt-6-astra` medium(No Fast), 기존 자산 수정 `gpt-6-luna` xhigh(No Fast)를 사용한다. 래스터 생성 엔진은 대화 모델과 별개이며 픽셀 그리드·팔레트·투명도·게임 크기 가독성을 검증한다. 도구 코드는 Mars 소관이다.
- 확정 문장 정리만 Haiku 4.5 사용 가능하며 effort는 지정하지 않는다. Max/Ultra/Ultracode·유료 가속은 기본값이 아니다.
- Worker 입력은 목적·범위·파일·보존 조건·완료 기준·현재 오류만 전달한다. 보고는 판정·파일·검사·미해결·증거 링크로 제한한다. 과거 전체 대화는 복제하지 않는다.
- 이벤트 대기를 사용하고 변경 없는 상태/전체 검사를 반복 조회·실행하지 않는다. 필수 CI는 유지한다.
- 대표 작업 5~10건의 총 사용량·완료 시간·재작업·QA 누락으로 조정한다. 측정 전 절감률을 단정하지 않는다.

## 역할과 관리

Venus는 Notion 기획서를 eli_adult 방식으로 작성·관리한다. 목적·흐름·규칙·예외·완료 조건을 쉬운 성인 언어로 설명한다. Earth는 도트·리소스·UI 시각/전환 설계, Mars는 HTML/Java/Unity C# 및 UI 동작 코드, Jupiter는 서버·DB·Table 스키마/검증을 담당한다. Table 의미/수치는 Venus/CJ, 클라이언트 로더는 Mars 소관이다. CSV 언급은 기존 TSV 일괄 변환 승인이 아니다. Mercury는 GitHub/Orca/운영 보고를 관리하고 기획 본문을 대행하지 않는다. Saturn은 파일 쓰기 없는 독립 QA다.

프로젝트 운영 결정만 적용한다. 범용 creat2ve-structure 원본을 자동 변경하지 않는다. #253의 CJ UI System Flow 기획·공용 아트는 완료됐지만 #238의 제품 구현과 새 외부 서버는 각 CJ 착수 지시 전 시작하지 않는다.

## 적용 범위 — Digit-Duel 전용

CJ의 2026-09-13 추가 지시에 따라 계정 전역 기본값은 유지한다. 최초 작업 중 전역값을 변경했으나 즉시 Codex Astra medium/priority, Claude opus[1m]/effort 미지정으로 복원했다. 백업은 각 설정 파일 옆 `.before-211-20260913`에 보존한다. 인증·MCP·권한과 다른 설정은 변경 대상이 아니다. 독립 비교에서 Codex TUI가 생성한 `tui.model_availability_nux.gpt-6-astra=1` 안내 확인 메타데이터만 추가됐음을 확인했다. 이 UI 메타데이터는 모델/effort 기본값이 아니므로 유지하며, 그 외 설정은 백업과 의미상 동일하다.

Digit-Duel의 신규 Worker에만 위 모델·effort를 CLI 인수로 적용한다. 다른 프로젝트나 연결 계정의 기본 모델은 변경하지 않는다. #250 모델 재설정 후 다음 Mercury_PD 인수인계 세션은 CJ의 명시적 지시에 따라 `gpt-6-sol` xhigh·No Fast와 `danger-full-access`·approval `never`로 시작한다. 이 일회성 인수인계 권한은 다른 Worker에 전파하지 않는다. Orca UI나 managed/host 정책이 실행값보다 우선할 수 있으므로 시작 영수증을 확인한다.
근거: [OpenAI 설정](https://learn.chatgpt.com/docs/config-file/config-reference), [Claude 모델 설정](https://code.claude.com/docs/en/model-config), 설치된 Orca 1.4.200의 worker-start 도움말.
