# Digit Dual (Digit-Duel)

숫자 장기 × 속성 배틀 결합 1vs1 턴제 전략 보드게임. 최종 타깃 Android/Unity, 기획 검증용 HTML 데모 선행(2트랙).

## 기준 문서 (Notion — 구현·QA의 진실 원본)
- Game Overview (GDD-13, 기준 문서): https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38
- 전투 수치 v0.1 (보류 백로그 D1~D8): https://app.notion.com/p/3cd1e7f170858116bbdbd60e98cc6924
- 검증 지표·상호작용표 (GDD-12): https://app.notion.com/p/3ca1e7f170858183beddfb1e8ecbbfe7
- Light Orca Orchestration (작업 계약·프로젝트 레지스트리): https://app.notion.com/p/3cd1e7f170858008900bcf9398665096

규칙: 기획에 없는 내용은 임의 구현하지 않고 [기획 필요]로 보고한다. CJ 결정은 GDD-13 Decision Log에 날짜와 함께 기록한다. 모든 보고는 확정/추론/미확정을 구분한다.

## 조직 구조 — Creat2ve Vibe Coding Structure release 0.2.0 / rev 5 (2026-09-02)
태양계 명명 부서제. 정의 원본: Notion "Creat2ve Vibe Coding Structure" (https://app.notion.com/p/3ce1e7f17085818c82c5dd886149ad5b). 범용 핸드북·승인형 bootstrap 원본: [creat2ve-structure](https://github.com/ChangjoSung/creat2ve-structure).
- ☀️ **CJ (CEO/SUN)**: 방향성 제시(CJ Comment)·최종 승인
- ☿ **Mercury (PD, Codex)**: 상설 CJ 접수창구이자 Notion·GitHub·문서·완료 보고·전달 허브. 역할은 상설 유지하되 내부 실행 세션은 스냅샷 기반으로 교대
- ♀ **Venus (Plan, Claude Code — 2026-09-02 변경)**: 기획서 작성 루프 (초안→PD 컨펌→CJ 승인→일정 등록) — 스팟 가동
- 🌍 **Earth (Art, Codex)**: Unity 리소스 — Phase 2(v0.4.0)부터
- ♂ **Mars (Client, Claude Code)**: 구현 Worker — 완료 시 Saturn QA 요청
- ♄ **Saturn (QA, Codex — 2026-09-02 신설)**: 교차 모델 독립 QA (Claude 구현 ↔ Codex 검증, 동종 편향 제거)
- ♃ **Jupiter (Server, Claude Code)**: 서버 스택 — Phase 2 대기 (QA는 Saturn으로 이관)

**복합 안건 10단계 워크플로우 (2026-09-02)**: 복합 피드백·신규 기획 = PD 분류 → 소관 부서 분석 → PD 취합 1차 보고 → CJ 승인(재작성은 해당 부서만) → 병렬 구현 → Saturn QA → PD 취합 보고 → CJ 플레이 QA → PD 정리. **단순 지시는 패스트트랙**(분석 보고 생략). 모든 부서는 Clear 전 자기 작업을 이슈·Notion에 기록.
운영: **이벤트 구동**(요청·일정 발생 시 부서 Worker 기동) · 독립 안건은 fresh Worker가 기본이며 `worker_done` 후 결과를 archive하고 release · 동일한 좁은 범위의 즉시 후속 작업만 부서별 최대 1개·기한부 lease로 retain · 역할 연속성은 대화가 아니라 Issue·Notion·스냅샷으로 유지 · Mercury 창구는 상설 유지하되 마일스톤 종료, 반복 압축, 문서·Task 상태 불일치 등 객관적 신호에서 인수인계 스냅샷을 치환 갱신한 뒤 내부 세션을 교대 · 부서별 수동 백업 Prompt는 구조 문서 5장.

**Notion 문서 수명주기 (rev 5):** 새 문서·갱신 시 `Project=현재 프로젝트`, `Edit Date=실제 수정일`, `Editor=실제 Notion 사람 편집자`를 설정한다. Agent·Mercury 표기는 Summary/본문 운영 이력에만 남긴다. Archive는 홀딩이지 삭제가 아니다. 삭제는 ① 현재 프로젝트 소속 ② 대체·중복 사실 ③ Parent/Sub-Task/선행/후속/참조 연결 부재를 모두 확인한 때에만 하며, 다른 프로젝트·연결된 문서는 자동 삭제하지 않는다. 하나라도 불명확하면 Archive에 유지하고 CJ에게 질문한다.

## CJ Comment 운영 계약 v3 (2026-08-31 v1 → 2026-09-01 조직 구조 → 2026-09-02 Notion 수명주기)
CJ Comment가 유일한 작업 입력(launcher)이다. 프롬프트 복사는 불필요하며, Notion의 Plan Prompt·Orchestration Launcher는 새 환경/다른 도구용 백업이다.
1. **분류**: 매 보고 첫머리에 Comment를 [결정]/[피드백]/[질문]으로 분류해 표기한다.
2. **Issue 생성**: 코드 변경이 필요한 작업만 이슈화한다. 문서·결정·분석은 Notion Decision Log만. 한 피드백의 여러 항목은 이슈 1개 + 체크리스트로 묶는다. **Sub-issues(2026-09-01 채택)**: 피드백 사이클·기능 묶음은 부모(에픽) 이슈로 만들고, 파생 작업(후속 delta·설계 승인 후 구현 분리)은 sub-issue로 부모에 연결한다(깊이 1단계만, `gh api repos/{r}/issues/{n}/sub_issues` POST에 sub_issue_id=이슈의 numeric id). 부모는 모든 sub 종결 + CJ QA 통과 시 닫는다 — 꼬리 무는 이슈 체인 방지.
3. **Issue 종결**: CJ가 QA 통과를 명시하거나, 완료 보고 후 CJ의 다음 Comment가 이의를 제기하지 않으면 묵시적 승인으로 간주해 근거 코멘트와 함께 close한다. 마일스톤 종료 시 전수 정리.
4. **기획서 동기화**: 규칙 변경은 Decision Log + 해당 본문 섹션을 동시에 갱신하고, 보고에 "문서 반영 위치" 표를 포함한다.
5. **DIGEST**: 마일스톤 종료·대규모 규칙 개정 시 eli-adult로 읽기 좋은 정리본을 생성한다.
6. **Worker**: 독립 기능·대규모 변경은 Orca Worker 위임, 소규모 Delta는 직접. Worker는 git 쓰기 금지, Coordinator가 diff 리뷰·검증 후 커밋한다.
7. **문서 정리 원칙**: 문서 갱신은 누적이 아니라 치환한다. 결정 완료된 질문 표·중복 서술은 본문 반영 후 압축하고 Decision Log는 이력을 간결하게 유지하되, 페이지 자체의 Archive·삭제는 위 Notion 수명주기 계약을 따른다. Archive에 있다는 이유만으로 삭제하지 않는다.

CJ용 사용 설명서: Notion "CJ 세션 사용 안내서" (https://app.notion.com/p/3cd1e7f17085810e9514e5773757bbe3)

## Git / GitHub 컨벤션 (MyFundManager 벤치마킹)
- 브랜치: `main`(릴리스 전용) / `dev`(통합 개발). **main·dev 직접 커밋 금지.** 모든 작업은 최신 `origin/dev`에서 `feature/<issue>-<slug>` · `fix/<issue>-<slug>` · `infra/<issue>-<slug>` · `doc/<issue>-<slug>` 중 하나로 분기한다. 과거 `dev_html` 라인은 PR #22로 `dev`에 병합하고 2026-09-02 폐기했다.
- 병합: 이슈 브랜치 → `dev`는 원칙적으로 squash merge 후 로컬·원격 브랜치를 삭제한다. 여러 마일스톤을 보존하는 이관 PR과 `dev` → `main` 릴리스 PR만 merge commit을 사용한다. rebase merge는 사용하지 않는다.
- 릴리스: 마일스톤의 승인 범위가 완료됐을 때만 `dev` → `main` 릴리스 PR을 연다. 병합된 main SHA에 annotated tag `vX.Y.Z`와 동일 버전 GitHub Release를 생성한다. 과거 버전을 현재 `dev` 상태로 소급 릴리스하지 않는다.
- 이슈·PR·커밋 제목: `[scope] 제목 (#이슈번호)` — scope: `[infra]` `[demo]` `[client]` `[design]`
- 마일스톤: `vX.Y.Z — 제목` 릴리스 트레인 (v0.1.0 인프라 / v0.2.0 HTML 데모 / v0.3.0 A/B·지표 / v0.4.0 Unity 포팅)
- 버전 통제: 계획 버전은 Milestone 하나로만 관리하고, 배포 버전은 main tag·GitHub Release로만 관리한다. 중복되는 `vX.Y.Z` 라벨은 만들지 않는다.
- 라벨: PR마다 작업 유형 1개(`feature`/`fix`/`infra`/`doc`)와 영역 1개(`html_demo`/`dev_client`/향후 `dev_server`/`design`)를 붙인다. `Release`는 `dev` → `main` 릴리스 PR에만 사용한다.
- PR 필수 항목: 연결 이슈(`Ref #N`; 기본 브랜치가 main이므로 dev PR에서 자동 종료 키워드 금지), Acceptance Criteria, 변경 파일, 검증 결과, Saturn 판정, UI 변경 시 스크린샷, rollback. `dev` 병합 후 이슈는 검증 근거를 남기고 수동 종료한다.
- 보호: private 저장소 플랜에서 branch protection/ruleset을 강제할 수 없는 동안 위 계약과 CI를 필수 통제로 사용한다. 지원 가능한 플랜으로 변경되면 main/dev에 PR 필수·force push/삭제 금지·대화 해결·필수 checks를 설정한다.
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
