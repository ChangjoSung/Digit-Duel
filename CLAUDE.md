# Digit Dual (Digit-Duel)

숫자 장기 × 속성 배틀 결합 1vs1 턴제 전략 보드게임. 최종 타깃 Android/Unity, 기획 검증용 HTML 데모 선행(2트랙).

## 기준 문서 (Notion — 구현·QA의 진실 원본)
- Game Overview (GDD-13, 기준 문서): https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38
- 전투 수치 v0.1 (보류 백로그 D1~D8): https://app.notion.com/p/3cd1e7f170858116bbdbd60e98cc6924
- 검증 지표·상호작용표 (GDD-12): https://app.notion.com/p/3ca1e7f170858183beddfb1e8ecbbfe7
- Light Orca Orchestration (작업 계약·프로젝트 레지스트리): https://app.notion.com/p/3cd1e7f170858008900bcf9398665096

규칙: 기획에 없는 내용은 임의 구현하지 않고 [기획 필요]로 보고한다. CJ 결정은 GDD-13 Decision Log에 날짜와 함께 기록한다. 모든 보고는 확정/추론/미확정을 구분한다.

## CJ Comment 운영 계약 v1 (2026-08-31 승인)
CJ Comment가 유일한 작업 입력(launcher)이다. 프롬프트 복사는 불필요하며, Notion의 Plan Prompt·Orchestration Launcher는 새 환경/다른 도구용 백업이다.
1. **분류**: 매 보고 첫머리에 Comment를 [결정]/[피드백]/[질문]으로 분류해 표기한다.
2. **Issue 생성**: 코드 변경이 필요한 작업만 이슈화한다. 문서·결정·분석은 Notion Decision Log만. 한 피드백의 여러 항목은 이슈 1개 + 체크리스트로 묶는다.
3. **Issue 종결**: CJ가 QA 통과를 명시하거나, 완료 보고 후 CJ의 다음 Comment가 이의를 제기하지 않으면 묵시적 승인으로 간주해 근거 코멘트와 함께 close한다. 마일스톤 종료 시 전수 정리.
4. **기획서 동기화**: 규칙 변경은 Decision Log + 해당 본문 섹션을 동시에 갱신하고, 보고에 "문서 반영 위치" 표를 포함한다.
5. **DIGEST**: 마일스톤 종료·대규모 규칙 개정 시 eli-adult로 읽기 좋은 정리본을 생성한다.
6. **Worker**: 독립 기능·대규모 변경은 Orca Worker 위임, 소규모 Delta는 직접. Worker는 git 쓰기 금지, Coordinator가 diff 리뷰·검증 후 커밋한다.

## Git / GitHub 컨벤션 (MyFundManager 벤치마킹)
- 브랜치: `main`(릴리스) / `dev`(통합) / `dev_html`(HTML 데모 전용 라인). **main 직접 커밋 금지.** 데모 작업은 dev_html에서 진행 후 마일스톤 단위로 dev에 통합.
- 이슈·PR·커밋 제목: `[scope] 제목 (#이슈번호)` — scope: `[infra]` `[demo]` `[client]` `[design]`
- 마일스톤: `vX.Y.Z — 제목` 릴리스 트레인 (v0.1.0 인프라 / v0.2.0 HTML 데모 / v0.3.0 A/B·지표 / v0.4.0 Unity 포팅)
- 라벨 14종 운영 (backlog·check·dependencies·dev_client·doc·feature·fix·github_actions·infra·question·Release·skill-update·html_demo·design)
- 모든 작업 결과는 해당 GitHub Issue에 코멘트로 기록 (수정 파일·검증 결과·커밋 해시)

## HTML 데모 (demo/index.html)
- 단일 파일, 브라우저로 열면 실행 (서버 불필요). 모드: PVE(AI 대전) / PVP(핫시트 2인) / AI vs AI 시뮬레이션(숨은 링크).
- AI는 **공정 관측** 원칙: visibleTo()·revealed·공개 사망 집계·이동 이력 논리 추론만 사용. 치팅(전체 정보 접근) 금지.
- 커밋 전 검증 필수: Node 헤드리스 스모크 테스트 — `<script>` 블록을 추출해 DOM 스텁으로 eval 후 규칙 회귀(이동·상성·폭탄·함정·밀어내기·왕 불가침·판정) + AI vs AI 완주 확인. 테스트 예시는 GitHub Issue #2·#3 코멘트 참조.
- 수치 상수(BAL)는 [DATA] 문서 제안값(승인 전 임시). 수치·밸런싱 조정은 CJ 지시로 보류 백로그.

## Unity (v0.4.0 예정)
- 기본 구조는 MyFundManager 저장소 벤치마킹 (Table·Folder·Assembly·Addressable 등).
- audition_Idol 참조 구조 검토: 로컬 저장소 `C:\WORK\Client\audition_idol\Client_Idol`
- Unity 본개발은 Heavy 오케스트레이션 프롬프트([Content] Orca Orchestration Prompt) 사용 예정.
