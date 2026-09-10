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
- 🌍 **Earth (Art, Codex)**: Unity 리소스 — Phase 2(v0.5.0)부터
- ♂ **Mars (Client, Claude Code)**: 구현 Worker — 완료 시 Saturn QA 요청
- ♄ **Saturn (QA, Codex — 2026-09-02 신설)**: 교차 모델 독립 QA (Claude 구현 ↔ Codex 검증, 동종 편향 제거)
- ♃ **Jupiter (Server, Claude Code)**: 서버 스택 — Phase 2 대기 (QA는 Saturn으로 이관)

**복합 안건 10단계 워크플로우 (2026-09-02)**: 복합 피드백·신규 기획 = PD 분류 → 소관 부서 분석 → PD 취합 1차 보고 → CJ 승인(재작성은 해당 부서만) → 병렬 구현 → Saturn QA → PD 취합 보고 → CJ 플레이 QA → PD 정리. **단순 지시는 패스트트랙**(분석 보고 생략). 모든 부서는 Clear 전 자기 작업을 PD에게 보고하고, PD가 통합 이슈·Notion에 기록.
운영: **이벤트 구동**(요청·일정 발생 시 부서 Worker 기동) · 독립 안건은 fresh Worker가 기본이며 `worker_done` 후 결과를 archive하고 release · 동일한 좁은 범위의 즉시 후속 작업만 부서별 최대 1개·기한부 lease로 retain · 역할 연속성은 대화가 아니라 Issue·Notion·스냅샷으로 유지 · Mercury 창구는 상설 유지하되 마일스톤 종료, 반복 압축, 문서·Task 상태 불일치 등 객관적 신호에서 인수인계 스냅샷을 치환 갱신한 뒤 내부 세션을 교대 · 부서별 수동 백업 Prompt는 구조 문서 5장.

**Notion 문서 수명주기 (rev 5):** 새 문서·갱신 시 `Project=현재 프로젝트`, `Edit Date=실제 수정일`, `Editor=실제 Notion 사람 편집자`를 설정한다. Agent·Mercury 표기는 Summary/본문 운영 이력에만 남긴다. Archive는 홀딩이지 삭제가 아니다. 삭제는 ① 현재 프로젝트 소속 ② 대체·중복 사실 ③ Parent/Sub-Task/선행/후속/참조 연결 부재를 모두 확인한 때에만 하며, 다른 프로젝트·연결된 문서는 자동 삭제하지 않는다. 하나라도 불명확하면 Archive에 유지하고 CJ에게 질문한다.

## CJ Comment 운영 계약 v3 (2026-08-31 v1 → 2026-09-01 조직 구조 → 2026-09-02 Notion 수명주기)
CJ Comment가 유일한 작업 입력(launcher)이다. 프롬프트 복사는 불필요하며, Notion의 Plan Prompt·Orchestration Launcher는 새 환경/다른 도구용 백업이다.
1. **분류**: 매 보고 첫머리에 Comment를 [결정]/[피드백]/[질문]으로 분류해 표기한다.
2. **Issue·PR 단위 (2026-09-07 CJ 승인)**: 코드 변경과 납품 자산 변경을 이슈화한다. 문서·결정·분석만 있는 안건은 Notion Decision Log로 관리한다. 하나의 납품 목표는 Mercury가 **Issue 1개 + 통합 PR 1개**로 관리하며, 같은 목표의 병렬 Worker 작업은 체크리스트와 Orca Task로 나눈다. Worker별 Issue·PR을 만들지 않는다. 독립 출시·독립 롤백이 필요한 범위만 별도 Issue·PR로 분리할 수 있고, 부모 에픽이 있으면 sub-issue로 연결한다(깊이 1단계). 부모는 모든 sub 종결 + CJ QA 통과 시 닫는다. Worker는 결과를 PD에게 보고하고, GitHub·Notion 기록과 Git 쓰기는 Mercury가 취합·집행한다.
3. **Issue 종결**: CJ가 QA 통과를 명시하거나, 완료 보고 후 CJ의 다음 Comment가 이의를 제기하지 않으면 묵시적 승인으로 간주해 근거 코멘트와 함께 close한다. 마일스톤 종료 시 전수 정리.
4. **기획서 동기화**: 규칙 변경은 Decision Log + 해당 본문 섹션을 동시에 갱신하고, 보고에 "문서 반영 위치" 표를 포함한다.
5. **DIGEST**: 마일스톤 종료·대규모 규칙 개정 시 eli-adult로 읽기 좋은 정리본을 생성한다.
6. **Worker**: 독립 기능·대규모 변경은 Orca Worker 위임, 소규모 Delta는 직접. Worker는 git 쓰기 금지, Coordinator가 diff 리뷰·검증 후 커밋한다.
7. **문서 정리 원칙**: 문서 갱신은 누적이 아니라 치환한다. 결정 완료된 질문 표·중복 서술은 본문 반영 후 압축하고 Decision Log는 이력을 간결하게 유지하되, 페이지 자체의 Archive·삭제는 위 Notion 수명주기 계약을 따른다. Archive에 있다는 이유만으로 삭제하지 않는다.

CJ용 사용 설명서: Notion "CJ 세션 사용 안내서" (https://app.notion.com/p/3cd1e7f17085810e9514e5773757bbe3)

## Git / GitHub 컨벤션 (MyFundManager 벤치마킹)
- 브랜치 (2026-09-10 CJ 승인 · Issue #169): `main`(릴리스 전용) / `dev`(통합) / `dev-vX.Y.Z`(마일스톤 트랙). **main·dev·트랙 브랜치 직접 커밋 금지.** 흐름은 `이슈 브랜치 →(squash) dev-vX.Y.Z →(merge commit) dev →(merge commit) main(+tag)` 이다. 이름이 `dev/vX.Y.Z`가 **아닌** 이유는 git 제약이다 — ref 는 파일 경로라 `refs/heads/dev`(파일)가 있으면 `refs/heads/dev/…`(디렉터리)를 만들 수 없다(`cannot lock ref … 'refs/heads/dev' exists`). 슬래시 표기를 쓰려면 `dev` 브랜치를 없애야 하므로 하이픈으로 고정한다. **트랙 브랜치**는 마일스톤마다 하나이고 **`dev`에서 분기**해 마일스톤 종료까지 유지한다(`main`에서 자르지 않는다 — 미출시 통합분을 잃는다). **이슈 브랜치**는 그 트랙 브랜치에서 `feature/<issue>-<slug>` · `fix/<issue>-<slug>` · `infra/<issue>-<slug>` · `doc/<issue>-<slug>` 로 분기하고, 트랙이 없는 저장소 전반 작업만 `dev`에서 직접 분기한다. **트랙 브랜치에도 PR 필수 + 필수 CI 6개를 적용한다** — 안 걸면 무검증 구간이 생긴다. **dev 변경을 트랙 브랜치로 주기적으로 내려받는다** — Roblox·Unity는 HTML 규칙을 미러링하므로 하지 않으면 규칙이 갈린다. **마일스톤 완료 시 `main` 직행은 금지다**: 통합 브랜치는 항상 배포된 모든 것을 포함해야 하고, 건너뛰면 `dev < main`이 되어 다음 개발이 배포본을 덮어쓰는 회귀가 난다. 유일한 예외는 **hotfix**로 `main`에서 분기·`main`에 병합한 뒤 **즉시 `dev`로 역병합**한다. 과거 `dev_html` 라인은 PR #22로 `dev`에 병합하고 2026-09-02 폐기했다.
- 병합: 이슈 브랜치 → 트랙 브랜치(트랙이 없으면 `dev`)는 원칙적으로 squash merge 후 Mercury가 해당 로컬·원격 브랜치를 명시적으로 삭제한다. **트랙 브랜치 → `dev`는 merge commit**을 쓴다 — squash 하면 마일스톤 안의 개별 이슈 이력이 뭉개진다. GitHub의 전역 `delete_branch_on_merge`는 릴리스 PR의 장수 `dev`까지 삭제하므로 사용하지 않는다. `main`·`dev`는 삭제 대상이 아니다. 여러 마일스톤을 보존하는 이관 PR과 `dev` → `main` 릴리스 PR만 merge commit을 사용한다. rebase merge는 사용하지 않는다.
- 릴리스: 마일스톤의 승인 범위가 완료됐을 때만 `dev` → `main` 릴리스 PR을 연다. 병합된 main SHA에 annotated tag `vX.Y.Z`와 동일 버전 GitHub Release를 생성한다. 과거 버전을 현재 `dev` 상태로 소급 릴리스하지 않는다.
- 이슈·PR·커밋 제목: `[scope] 제목 (#이슈번호)` — scope: `[infra]` `[demo]` `[client]` `[design]`
- 마일스톤: `vX.Y.Z — 제목` 릴리스 트레인 (v0.1.0 인프라 / v0.2.0 HTML 데모 / v0.3.0 A/B·지표 / v0.3.1 온보딩 / v0.4.0 온라인 PVP·HTML 안정화 / **v0.4.6 HTML 데모 완결** / **v0.5.0 Roblox 포팅** / **v0.6.0 Unity 포팅**). 2026-09-10 CJ 승인(Issue #169)으로 재배번했다 — 종전 `v0.4.7`(HTML)→`v0.4.6`, 종전 `v0.4.6`(Roblox)→`v0.5.0`, 종전 `v0.5.0`(Unity)→`v0.6.0`. **버전 키 폴더는 마일스톤 버전을 따라가는 주소**라 함께 옮겼고 경로 대조는 [MOVES.csv](docs/milestone/MOVES.csv)가 담당한다. 옮겨진 아카이브 **본문의 옛 버전 서술은 작성 당시의 판정이라 고치지 않는다**.
- 2026-09-10 현재 일정 (Issue #169 재배번 후): **v0.4.6(Milestone13)=HTML 데모 완결 — 탐색 개편·연출 템포·전투 정비·세로 UI·접촉 전투 규칙. 열린 이슈 0, 릴리스 대상.** **v0.5.0(Milestone12)=Roblox 포팅 #118**, **v0.6.0(Milestone4)=Unity 포팅(미착수)**. #119·#120·#123·#127은 CJ 판단으로 Unity 개발·플레이테스트 이후로 보류해 `not planned`로 닫았고 **삭제하지 않았다** — 승인된 기획 계약(#121·#146 gameplay-spec)이 그 번호를 인용하므로 필요해지면 CJ가 reopen 한다. #121·#125·#129(PR143) 및 #130·#131·#146([PR152](https://github.com/ChangjoSung/Digit-Duel/pull/152), dev `24ebf36`)은 CJ QA PASS로 종결했다. **#128은 매 페이지 로드 튜토리얼 노출로 정책 변경 구현 후 2026-09-10 CJ QA PASS·CLOSED**: 새 접속·새 탭·새로고침마다 표시하고, 같은 열린 페이지의 새게임·재대전·모드변경·온라인 재연결·탭/보존 페이지 복귀는 추가 표시하지 않는다. 건너뛰기·Esc·수동 재보기·기존10단계·다른 저장값을 보존한다. 같은 LAN 주소 재접속 생략은 기존 저장 정책으로 설명되며 초기 타 PC 공유 신고가 입증/해결됐다고 소급하지 않는다. GDD13 본문4.13·DL47·DL50 및 [Issue128](https://github.com/ChangjoSung/Digit-Duel/issues/128)·[PR157](https://github.com/ChangjoSung/Digit-Duel/pull/157)이 최신 승인·검증·통합 상태의 원본이다. 과거 #146 [PD 기록](docs/milestone/v0.4.6/issues/146/Mercury/report.md)의 관측 한계·후속 정리 절차 위반을 보존한다. #122는 2026-09-10 정적 러프 검토 후 CJ가 수풀만 수풀 표현·현행 보드 말 표시·첨부 이미지의 전투 구성을 요청하고 **#124 동료·왕 아트와 #126 강한 승패 효과도 함께 진행**하도록 지시했다. [후속 범위](docs/milestone/v0.4.6/issues/122/Mercury/cj-followup.md)에 따라 PR160으로 첫 납품을 통합했고, CJ QA REVISE 1차 [뒤로가기·어두운 배경 수정](docs/milestone/v0.4.6/issues/122/Mercury/revise-back-dark.md)(Mars Claude 구현·Saturn Codex 독립 READ_ONLY 검수)에 이어 2차 [접촉·전투 규칙 개편](docs/milestone/v0.4.6/issues/122/Mars/revise-cjqa-rules/report.md)까지 반영해 **2026-09-10 CJ QA PASS로 세 Issue를 종결**했다. 2차는 동료↔동료·동료↔왕·왕↔왕을 전투로 바꾸고(#114 상황 8·왕 불가침 폐지), 폭탄↔폭탄·폭탄↔함정을 그 자리에서 동반 제거하며(상황 6 폐지), 도망 실패에 상대의 기본 공격 1회 페널티를 되살리고(#146 계약 1.2 대체 · 힘의 수호자면 최대 피해), 출전 준비 탭 눌림 표시와 전투 '← 뒤로' 위치(행동창 아래)를 고쳤다. HTML과 Roblox 규칙을 같은 계약으로 맞췄다. **2차는 Codex 사용량 한도 초과로 Saturn 교차 모델 QA 없이 Mars가 백업 QA·Git·문서를 대행했고 CJ 플레이 QA가 최종 게이트였다** — 이 예외를 소급 정상화하지 않는다. 릴리스는 여전히 대기다. [통합 기록](docs/milestone/v0.4.6/issues/122/Mercury/report.md)에 실제 미디어·소스·검증과 Worker Git 쓰기/검색 범위 예외를 보존한다. 나머지는 번호별 요청 대기이며 Roblox 담당 lee775의 별도 작업·브랜치는 보존한다. 정식 출시는 v0.4.5이고 Unity v0.5.0은 별도 계획이다.
- 버전 통제: 계획 버전은 Milestone 하나로만 관리하고, 배포 버전은 main tag·GitHub Release로만 관리한다. 중복되는 `vX.Y.Z` 라벨은 만들지 않는다.
- 라벨: PR마다 작업 유형 1개(`feature`/`fix`/`infra`/`doc`)와 영역 1개(`html_demo`/`dev_client`/향후 `dev_server`/`design`)를 붙인다. `Release`는 `dev` → `main` 릴리스 PR에만 사용한다.
- PR 필수 항목: 연결 이슈(`Ref #N`; 기본 브랜치가 main이므로 dev PR에서 자동 종료 키워드 금지), Acceptance Criteria, 변경 파일, 검증 결과, Saturn 판정, UI 변경 시 스크린샷, rollback. `dev` 병합 후 이슈는 검증 근거를 남기고 수동 종료한다.
- 보호: 현재 공개 저장소이며 branch protection을 지원한다. main/dev에 PR 필수·force push/삭제 금지·대화 해결·필수 CI 6개(A·B·B2·C·D·E)를 적용한다. 2026-09-10 CJ 승인으로 `E. Roblox 클라이언트·규칙 (Luau)`를 추가했고 모두 GitHub Actions 앱15368·strict=true다. 관리자의 우회도 허용하지 않으며, 필요한 승인 리뷰 수는 0으로 두고 Saturn 검수·CJ 승인 계약은 별도로 유지한다. [Issue #132 연결 기록](docs/milestone/v0.4.6/issues/132/Mercury/required-checks.md)에 실제 성공 이력과 보호 설정 재조회 결과를 보관한다.
- 모든 작업 결과는 해당 GitHub Issue에 코멘트로 기록 (수정 파일·검증 결과·커밋 해시)

## HTML 데모 (demo/index.html)
- 게임 코드는 `demo/index.html`에 유지하고, CJ의 2026-09-07 게임 적용 지시에 따라 하수인 이미지는 `demo/assets/minions/` 상대경로로 로드한다. 오프라인은 해당 폴더를 함께 둔 채 브라우저로 열면 실행(서버 불필요); 온라인은 기존 서버의 HTTP 주소로 연다. 모드: PVE(AI 대전) / PVP(핫시트 2인) / AI vs AI 시뮬레이션(숨은 링크).
- AI는 **공정 관측** 원칙: visibleTo()·revealed·공개 사망 집계·이동 이력 논리 추론만 사용. 치팅(전체 정보 접근) 금지.
- 커밋 전 검증 필수: Node 헤드리스 스모크 테스트 — `<script>` 블록을 추출해 DOM 스텁으로 eval 후 규칙 회귀(이동·상성·폭탄·함정·밀어내기·판정) + AI vs AI 완주 확인. 테스트 예시는 GitHub Issue #2·#3 코멘트 참조.
- 수치 상수(BAL)는 [DATA] 문서의 초기값이며 일반 밸런싱 백로그는 유지한다. **2026-09-07 CJ의 v0.4.4 분석 후 구현 지시**로 탐색 기술 교체·공격형 위력 완화·일반 감전 확률 하향은 착수 범위다(Issue #92·#95·#96). Venus 권고를 PD가 채택한 구체 계약은 [v0.4.4 게임플레이 규격](docs/milestone/v0.4.4/specs/v0.4.4-gameplay-spec.md)과 GDD-13·14·15·16을 따른다. 동일 구현 승인을 재질문하지 않는다.

## Unity (v0.5.0 예정)
- 기본 구조는 MyFundManager 저장소 벤치마킹 (Table·Folder·Assembly·Addressable 등).
- audition_Idol 참조 구조 검토: 로컬 저장소 `C:\WORK\Client\audition_idol\Client_Idol`
- Unity 본개발은 Heavy 오케스트레이션 프롬프트([Content] Orca Orchestration Prompt) 사용 예정.

<!-- creat2ve:begin -->
## 조직 구조 — Creat2ve Vibe Coding Structure rev 6 (release 0.3.0, 2026-09-02)
태양계 명명 부서제. 범용 핸드북·용어·bootstrap 원본: creat2ve-structure 저장소 (사본: docs/creat2ve/Creat2veVibeCodingStructure.html). 프로젝트별 결정은 이 파일과 기준 문서가 우선한다.
- ☀ **CJ (CEO / SUN, 사람)**: 전체 방향성 제시 (CJ Comment) · PD 보고에 대한 최종 승인 여부 판별 · 실플레이 QA (최종 품질 게이트) — 상시. 세션: 장수 (사람)
- ☿ **Mercury (PD, Codex)**: Notion 관리 (일정·기획서·진행도) · Notion 문서 수명주기 관리 (Project·Edit Date·Editor 속성 설정, Archive/삭제 판정) · GitHub 관리 (Milestone·Issues·PR·Action) · 문서 관리 (인수인계 스냅샷) · 역할별 완료 보고서 취합 및 CJ 승인 질문 · Notion·GitHub·문서 최신화·정리 · CJ 요청을 역할 우선으로 라우팅 (영역·역할을 먼저 정하고 provider는 나중) — dispatch preflight 5필드 검사, 역할 위반 worker_done 거부(role_scope_mismatch) · 조정·Git·문서 메타데이터만 집행. 제품·런타임·빌드·도구·테스트 코드는 소규모여도 Mars/Jupiter로 라우팅 — Phase 1 — 2026-09-02 완전 이관 개시. 세션: 상설 창구 — 내부 실행 세션은 스냅샷 기반으로 교대
- ♀ **Venus (Plan, Claude Code)**: CJ 컨셉 방향성에 대한 기획서 초안 작성 · Notion 작성 후 PD 컨펌 요청 · PD OK → PD가 CJ용으로 정리 보고 → CJ OK → 일정 등록 · Reject → 피드백 반영 후 재진행 · 기획서에 Client/Server 구현 방향과 담당 역할(Client·툴링=Mars, Server=Jupiter)을 명시 · PLAN 전용 — 제품·런타임·빌드·도구·테스트 코드를 수정하지 않는다. 구현이 필요하면 Mars/Jupiter로 라우팅 요청 — Phase 1 (스팟 가동). 세션: 작업 단위 fresh 세션
- 🜨 **Earth (Art, Codex)**: 등록된 일정에 따라 구현 시작 · PD가 참조해야 할 기획서 공유 · Unity Resource·프리팹 구성 작업 · 제작 후 PD에 보고 — Phase 2 (Unity 포팅부터). 세션: 작업 단위 fresh 세션
- ♂ **Mars (Client, Claude Code)**: 등록된 일정에 따라 구현 시작 · PD가 참조해야 할 기획서 공유 · 기획서를 토대로 구현 · Unity 단계에서는 프로젝트 코드 구조 규약(Addressable·OOP·Assembly 등)에 따라 코딩 · Client·HTML·Unity·툴링 구현 전담 — 편집기·bootstrap·build·테스트 코드 포함. 병렬이면 Mars_1·Mars_2 · 개발 완료 후 Saturn에 QA 요청 → OK 시 PD에 완료 보고 — Phase 1. 세션: 작업 단위 fresh 세션
- ♃ **Jupiter (Server, Claude Code)**: 등록된 일정에 따라 구현 시작 · PD가 참조해야 할 기획서 공유 · 기획서를 토대로 구현 · 서버 스택(AWS·DB·gRPC 등) 굵직한 구조 관리 · SERVER 구현 전담 — 클라이언트·툴링은 Mars 영역. 병렬이면 Jupiter_1·Jupiter_2 · Server 테스트 진행 후 PD에 보고 — Phase 2 대기. 세션: 작업 단위 fresh 세션
- ♄ **Saturn (QA, Codex)**: 구현 완료물의 교차 모델 독립 QA (구현자 보고를 그대로 믿지 않음) · 기획서 AC(수용 기준)·헤드리스 테스트로 검증 · 판정 PASS / REVISE / BLOCKED와 근거를 PD에 보고 · READ_ONLY — 제품 코드도 테스트도 수정하지 않는다. 테스트가 틀렸어도 고치지 않고 REVISE로 돌려보낸다. 병렬이면 Saturn_1·Saturn_2 · Codex 장애 시 감사역(Claude)이 백업 QA — Phase 1 — 2026-09-02 신설. 세션: 작업 단위 fresh 세션

**배치 원칙**: Claude = 생성(기획·코드), Codex = 관리·검증(PD·QA·구성). 같은 모델이 만들고 검증하면 같은 실수를 같이 놓친다 — Saturn이 그 동종 편향을 제거한다. 단, 이것은 역할에 provider를 붙이는 규칙이지 provider로 역할을 고르는 규칙이 아니다: 배치는 언제나 영역·역할이 먼저이고 provider는 그 역할의 실행기일 뿐이다 (역할 계약, rev 6).

**역할 계약 (불변, 역할 우선 배치)**: 역할이 먼저, 모델은 나중. 작업의 영역(area)과 역할(role)을 먼저 정하고, provider(Claude Code·Codex)는 그 역할을 실행하는 실행기일 뿐이다. provider가 바쁘거나 비어 있다는 이유로 다른 역할이 그 일을 대신하지 않는다 — 같은 역할을 하나 더 띄우거나(Role_2) 기다린다.
- 역할: Venus=PLAN (Claude Code; mode PLAN; area PLAN; mutation none/docs; 금지: 제품·런타임·빌드·도구·테스트 코드 수정 (source/·tools/·tests/·dist/·앱 코드 일체), 구현 Worker 대행 — 구현이 필요하면 Mars/Jupiter로 라우팅 요청, git 쓰기) · Mars=CLIENT_TOOLING (Claude Code; mode IMPLEMENT; area CLIENT/HTML/UNITY/TOOLING; mutation none/docs/code; 금지: 서버 스택 구현 (Jupiter 영역), 기획 결정 대체 — 기획에 없으면 [기획 필요], 자기 구현물의 QA 판정 대체 (Saturn 영역), git 쓰기) · Jupiter=SERVER (Claude Code; mode IMPLEMENT; area SERVER; mutation none/docs/code; 금지: 클라이언트·HTML·Unity·툴링 구현 (Mars 영역), 기획 결정 대체, 자기 구현물의 QA 판정 대체, git 쓰기) · Saturn=READ_ONLY_QA (Codex; mode QA; area QA; mutation none; 금지: 제품 코드 수정, 테스트 수정·추가 (테스트가 틀렸어도 REVISE로 돌려보낸다), 어떤 파일이든 수정 — files_modified가 비어 있지 않은 worker_done은 거부, git 쓰기) · Mercury=COORDINATION_GIT_DOC_METADATA (Codex; mode COORDINATE; area COORDINATION/GIT/DOC_METADATA; mutation none/docs/metadata; 금지: 제품·런타임·빌드·도구·테스트 코드 구현 — 소규모여도 Mars/Jupiter로 라우팅, 기획 결정 대체, QA 판정 대체) · Earth=ART (Codex; mode IMPLEMENT; area ART; mutation none/docs/assets; 금지: 코드 구현 (Mars·Jupiter 영역), 기획 결정 대체, git 쓰기)
- provider 규칙: provider는 실행기다. 같은 provider(예: Claude Code)를 쓰는 다른 역할이 놀고 있어도 그 역할로 일을 넘기지 않는다(교차 역할 대체 금지). Venus와 Mars가 같은 Claude Code여도 Venus는 구현하지 않는다.
- 동일 역할 병렬화: 한 역할이 한 인스턴스만 돌면 기본 이름(Mars)을 써도 된다. 같은 역할을 둘 이상 병렬로 돌리면 모든 인스턴스가 안정된 접미사 Role_1, Role_2, …를 쓴다 (Mars_1/Mars_2, Jupiter_1/Jupiter_2, Saturn_1/Saturn_2). 접미사는 dispatch 동안 바뀌지 않는다. 슬롯이 모자라면 같은 역할을 하나 더 띄우거나(Role_n+1) 그 역할이 비기를 기다린다. 다른 역할로 재분류하지 않는다 — Mars_1이 바쁘면 Mars_2이지 Venus가 아니다. 인스턴스를 할당하기 전에 바쁜 집합 전체를 검사한다 — 할당 대상 역할뿐 아니라 다른 역할의 항목도 포함해서, 같은 이름 중복(Venus·Venus, Mars_1·Mars_1)이나 기본 이름과 Role_1 동시 존재(두 인스턴스가 index 1을 주장)가 하나라도 있으면 role_scope_mismatch로 멈추고 슬롯을 내주지 않는다.
- dispatch preflight (필수 5필드 required_role · mode · area · mutation · instance_index): 1) required_role이 역할 계약의 역할 중 하나다 2) mode가 그 역할의 허용 mode 안에 있다 (Venus=PLAN, Mars·Jupiter·Earth=IMPLEMENT, Saturn=QA, Mercury=COORDINATE) 3) area가 그 역할의 허용 area 안에 있다 — 역할 우선 라우팅 표와 일치 4) mutation이 그 역할의 허용 집합 안에 있다 (Venus: none·docs / Saturn: none / Mercury: none·docs·metadata / Mars·Jupiter: none·docs·code / Earth: none·docs·assets) 5) instance_index가 null(단일) 또는 1 이상의 정수이고, 인스턴스 이름이 Role 또는 Role_n 형식으로 일치한다 6) provider가 적혀 있으면 그 역할의 provider와 같다 — 다른 provider나 다른 역할의 빈 슬롯은 근거가 되지 않는다 불일치는 `role_scope_mismatch`로 거부하고 dispatch를 만들지 않는다.
- worker_done 완료 검사 (거부 = `role_scope_mismatch`): Venus: worker_done의 files_modified·산출물에 코드 아티팩트(source/·tools/·tests/·dist/·앱 코드·빌드·테스트 파일)가 하나라도 있다 / Saturn: worker_done의 files_modified가 비어 있지 않다 (제품·테스트를 포함한 어떤 파일 수정도 거부) / Mercury: files_modified에 제품·런타임·빌드·도구·테스트 코드가 있다 / 모든 역할: dispatch의 required_role·instance와 worker_done의 역할·인스턴스가 다르다 / 모든 역할: 산출물 경로가 작업 공간 상대 경로가 아니다 — ../·절대·드라이브·UNC·URL 스킴, 퍼센트 인코딩(%2e·%252e 등 중첩 포함), 점이나 공백으로 끝나는 세그먼트(tools.·'.. '), <>:|?*·따옴표를 포함한 세그먼트, 제어 문자(C0·DEL·C1 U+0080–U+009F, NEL U+0085 포함), 유니코드 줄 구분자·슬래시 혼동 문자(U+2028·U+2029·U+2044·U+2215·U+2216·U+29F8·U+29F9·U+27CB·U+27CD·U+FF0F·U+FF3C·U+FE68 — docs∕..∕tools/x.md 처럼 한 세그먼트로 통과한 뒤 소비자가 /로 되돌릴 수 있는 이름) — 또는 자산 파일 이름의 어느 안쪽 확장자에든 코드·실행 마커가 있다(x.exe.backup.png). 거부된 worker_done은 완료로 기록하지 않는다. 산출물은 폐기하거나 올바른 역할의 새 dispatch 입력으로만 넘기고, 위반 사실을 이슈와 Decision Log에 남긴다.

**복합 안건 10단계 워크플로우**: 1. CJ Comment를 안건별로 분류하고 영역·역할 기준으로 어느 역할이 1차 분석할지 판단 (provider 가용성은 판단 근거가 아니다) → 2. 기획 소관 안건 → Venus에 분석 요청 → 3. 아트 소관 안건 → Earth에 분석 요청 → 4. 개발 소관 안건 → Client·HTML·Unity·툴링은 Mars, Server는 Jupiter에 분석 요청 → 5. 부서 분석 보고를 취합해 CJ에 1차 보고 → 6. 검토 — OK 또는 재작성 (재작성은 해당 부서만 다시) → 7. 전체 OK 시 역할별 병렬 구현 시작 — Client·HTML·Unity·툴링은 Mars, Server는 Jupiter, 아트는 Earth. 같은 역할이 둘 이상이면 Mars_1·Mars_2처럼 접미사로 병렬화. Venus는 구현하지 않고 PD는 취합만 → 8. 코드 구현물은 Saturn(Codex)이 교차 QA — PASS/REVISE/BLOCKED → 9. 구현 보고서 취합 → CJ 보고 → 10. CJ 플레이 QA 최종 승인 → PD가 GitHub·Notion·문서 최신화·정리
**패스트트랙**: 복합 피드백·신규 기획 = 10단계 풀 사이클. 단순 지시(명확한 단일 변경) = 패스트트랙(1~6 생략: 구현 → QA → 보고).
모든 부서는 Clear(세션 종료) 전에 자기 작업을 Mercury에게 보고한다. Mercury가 통합 Issue·Notion에 기록하며 Worker가 별도 Issue·PR을 만들거나 GitHub·Notion에 직접 쓰지 않는다.

**세션 lease / 교대**: 부서 Worker는 매 작업 fresh 세션이 기본이다. 같은 좁은 범위의 즉시 후속 작업만 부서별 최대 1개, 기한부 lease로 retain한다. 장수 세션(PD)은 스냅샷을 갱신한 뒤 교대한다. 독립 안건은 fresh Worker 기동 → worker_done → 결과 archive → release.
- retain 조건(모두 만족): 직전 작업과 동일한 좁은 범위의 즉시 후속 작업일 것 / 역할 인스턴스(Role 또는 Role_n)별 동시에 최대 1개만 retain / 기한부 lease — 기한 도래 또는 범위 이탈 시 release / retain 여부와 기한을 dispatch 기록에 남길 것
- 교대 신호(하나라도): 마일스톤 종료 / 컨텍스트 압축(compaction)이 반복됨 / 문서·Task 상태와 세션 인식이 불일치 / 스스로 판단력 저하를 감지 (자발적 재기동 요청)
- 교대 절차: 1) 인수인계 스냅샷을 치환 갱신 (누적 금지) 2) 진행 중 이슈·dispatch 상태를 문서와 일치시킴 3) 세션 종료(Clear) → 새 세션이 CLAUDE.md + 스냅샷 + 기준 문서를 읽고 인계 4) 인계 후 첫 보고에서 스냅샷 기준일과 인계 사항을 명시
- Mercury 창구(역할·접점)는 상설 유지한다. 교대되는 것은 내부 실행 세션이지 역할이 아니다.

**Notion 문서 수명주기**: Notion 문서는 만들고 고치는 순간 세 속성(Project·Edit Date·Editor)이 사실과 일치해야 하고, 치우는 일은 Archive(홀딩)와 삭제 두 단계로 나눈다. 삭제는 세 가지 확인을 모두 통과한 문서에만 한다.
- 만들거나 고칠 때 속성: Project=현재 프로젝트 · Edit Date=실제 수정일 · Editor=실제 Notion 사람 편집자 (person 속성에 가짜 Agent 금지)
- Agent·Mercury 표기: Agent나 Mercury가 작업했다는 사실이 필요하면 Summary 또는 본문의 운영 이력(날짜 · 부서 · 무엇을 바꿨나)으로 남긴다. 예: "2026-09-02 Mercury(Codex) — 진행도 표 치환". person 속성은 사람만 가리킨다.
- 상태: Active: 현재 프로젝트가 참조하는 살아 있는 문서. / Archive (홀딩): 지금은 안 쓰지만 되돌릴 수 있게 보관하는 상태. 삭제가 아니다. / 삭제: 되돌릴 수 없는 제거. Archive 문서 중 정말 불필요한 것만 대상이다.
- 삭제 전 확인 (모두 통과): 1) 현재 프로젝트 소속 — Project 속성이 지금 작업 중인 프로젝트다. 2) 대체 또는 중복 사실 — 같은 내용을 담은 최신 문서가 있거나(대체), 동일 문서가 둘 이상이다(중복). 대체 문서 링크를 적을 수 있다. 3) 연결 부재 — Parent·Sub-Task·선행·후속·참조(백링크) 연결이 하나도 없다.
- 자동 삭제 금지: 다른 프로젝트의 문서 (Project 속성이 현재 프로젝트가 아님) / 연결된 문서 (Parent·Sub-Task·선행·후속·참조 중 하나라도 있음) / 대체 문서를 지목할 수 없는 문서 / Archive에 있다는 사실만으로는 삭제 사유가 되지 않는다
- 세 확인 중 하나라도 실패하면 삭제하지 않고 Archive(홀딩)에 둔 채 보고한다. 판단이 갈리는 문서는 Agent가 결정하지 않고 CJ에 [질문]으로 올린다.

**권위 문서 우선순위**: 충돌 시 우선순위: CJ의 최신 Comment > 저장소 CLAUDE.md > 기획 문서 허브(GDD) > Notion 구조 정의 페이지 > 인수인계 스냅샷 > 이 핸드북. 하위 문서가 상위와 다르면 하위를 고친다. 등록표: docs/creat2ve/AUTHORITY.md

## CJ Comment 운영 계약
CJ Comment가 유일한 작업 입력(launcher)이다. 프롬프트 복사는 불필요하며, docs/creat2ve/prompts/ 의 부서별 Prompt는 자동 경로 장애 시 수동 백업이다.
1. **입력**: CJ Comment가 유일한 런처. 매 보고 첫머리에 [결정]/[피드백]/[질문] 분류 표기.
2. **이슈·PR (2026-09-07 CJ 승인)**: 코드·납품 자산 변경은 납품 목표 1개 = Issue 1개 + 통합 PR 1개. 병렬 Worker는 체크리스트·Orca Task로 분할하고 GitHub·Notion 기록·Git 쓰기는 Mercury가 취합한다. 독립 출시·롤백 범위만 별도 Issue·PR 및 필요 시 sub-issue(깊이 1단계)로 분리한다. 종결은 CJ QA 통과 또는 완료 보고 후 다음 Comment 무이의.
3. **기획서 동기화**: 규칙 변경 = Decision Log + 본문 섹션 동시 갱신. 보고에 "문서 반영 위치" 표 필수.
4. **문서 정리**: 누적이 아니라 치환. 대규모 개정 후에는 eli-adult 정리본(DIGEST).
5. **Notion 문서**: 새 문서·갱신 시 Project=현재 프로젝트, Edit Date=실제 수정일, Editor=실제 Notion 사람 편집자. Agent·Mercury 표기는 Summary/본문의 운영 이력에만. Archive는 홀딩이고 삭제가 아니다 — 삭제는 현재 프로젝트 소속·대체/중복·연결 부재 3가지를 확인한 뒤에만, 다른 프로젝트·연결된 문서는 자동 삭제 금지.
6. **Worker**: 이벤트 구동 — 요청 시 기동, worker_done 보고, 검증 후 release. Worker는 git 쓰기 금지.
7. **역할 계약**: 역할이 먼저, provider는 실행기. Venus=PLAN 전용(제품·런타임·빌드·도구·테스트 코드 수정 금지) · Mars=Client·HTML·Unity·툴링 구현 · Jupiter=Server 구현 · Saturn=읽기 전용 QA(제품·테스트 수정 금지) · Mercury=조정·Git·문서 메타데이터만. 같은 provider의 다른 역할이 비어 있어도 교차 역할 대체 금지.
8. **동일 역할 병렬화**: 한 역할 하나면 기본 이름(Mars), 둘 이상이면 모두 안정된 접미사(Mars_1·Mars_2, Jupiter_1·Jupiter_2, Saturn_1·Saturn_2). 슬롯이 모자라면 같은 역할을 추가하거나 기다린다 — 다른 역할로 재분류하지 않는다.
9. **dispatch preflight**: 모든 dispatch는 required_role · mode · area · mutation · instance_index 5필드를 갖추고 역할 계약과 대조한다. 하나라도 어긋나면 role_scope_mismatch로 거부. worker_done도 같은 코드로 거부: Venus의 코드 아티팩트, Saturn의 파일 수정(제품·테스트 포함), 역할·인스턴스 불일치.
10. **확정/추론 구분**: Agent 추론이 결정으로 둔갑하지 않게 모든 문서·보고에서 구분. 기획에 없으면 [기획 필요].
<!-- creat2ve:end -->
