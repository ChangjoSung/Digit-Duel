# Digit-Duel — 인수인계 스냅샷

> **2026-09-11 · #201 온라인 아트 HotFix:** 출시 main에서 분기한 `hotfix/201-online-art`에서 HTTP 요청 예산·파일별 일시 실패 복구와 README 플레이 사진을 수정했다. 클라이언트 회귀101·브라우저34·Saturn 제품/미디어 PASS. 패치는 v0.4.8이며, [납품·운영](../hotfix/201/Mercury/delivery.md)과 [Issue201](https://github.com/ChangjoSung/Digit-Duel/issues/201)이 최신 CI·출시·역병합 상태 원본이다. main→dev→활성 Roblox/Unity 트랙 동기화까지 수행하며, 아래 이전 회차의 판정을 이번 수정의 검수 결과로 사용하지 않는다. Unity의 #182·#183은 CJ QA PASS, #195 CI7 기술 납품은 Unity 트랙에 있으며 미출시 기능을 이 hotfix에 섞지 않는다.

> **현재 Unity 실행 상태 · 2026-09-11:** #182 Unity6000.6.0f1·Android 모듈11개·min26/target36 ARM64 IL2CPP 개발 기반과 #183 로컬 stdio MCP의 기술 검증을 완료했다. 새 Codex/Claude 실제 호출·임시 scene 변경/복구·다중 Editor 선택, Unity Edit19/Play21, MCP 회귀46개, Saturn 독립 최종 검수 PASS. 삼성 Android16 기기에 APK를 설치해 세로/safe area·터치·홈 복귀·Atlas를 확인했고, 캐시 없는 짧은 공백 경로 Git checkout에서 재검사·최종 래퍼 APK 빌드도 성공했다. [납품·실행 안내](../milestone/v0.6.0/issues/182/Mercury/delivery.md), [작업별 정산](../milestone/v0.6.0/issues/182/Mercury/orchestration-summary.md)을 따른다. 통합 PR·필수 CI6·CJ 수락 상태의 원본은 [Issue182](https://github.com/ChangjoSung/Digit-Duel/issues/182)·[Issue183](https://github.com/ChangjoSung/Digit-Duel/issues/183)다. 2026-09-11 CJ QA Test PASS에 따라 #182·#183을 CLOSED 처리했다. 실제 설정 제거/복원 시험의 미실시 이력은 그대로다. 후속 [#195 Unity 전용 CI](https://github.com/ChangjoSung/Digit-Duel/issues/195)·[PR197](https://github.com/ChangjoSung/Digit-Duel/pull/197)에서 F(구조·Core/Application 실제 C#·MCP)를 추가했고 실제 CI7 성공 후 Unity 트랙 필수 검사 7개를 적용했다. 다른 보호 브랜치는6개이며 실제 Editor/Edit/Play/APK CI는 아직 별도 인증·환경이 필요하다. [운영·보호 증거](../milestone/v0.6.0/issues/195/Mercury/operations.md)와 [독립 검수](../milestone/v0.6.0/issues/195/Mercury/saturn-review.md)를 따른다. #185 이후 게임/UI/서버 구현은 별도다. 초기 Hub DB 수동 변경은 보존 중이고 무결성 검사만 통과했다. bootstrap metadata failed/user_takeover retained와 최초 소스 QA release_unknown 예외도 남긴다. 아래 과거 기록은 당시 상태다.

> 2026-09-10 · Mercury(PD, GPT-6 Astra/high). #122·#124·#126은 PR160 통합 후 REVISE 1차(좌상단 뒤로가기·어두운 배경)와 2차(접촉·전투 규칙 4건·준비 탭·전투 뒤로가기)를 보완해 **CJ QA PASS/CLOSED**. #128·#130·#131·#146도 CJ QA PASS/CLOSED.
>
> **2026-09-10 버전 재배번 ([#169](https://github.com/ChangjoSung/Digit-Duel/issues/169) · CJ 승인)**: HTML 완결분 `v0.4.7`→**`v0.4.6`**(Milestone13 · 열린 이슈 0 · 릴리스 대상), Roblox `v0.4.6`→**`v0.5.0`**(Milestone12 · #118 진행 중), Unity `v0.5.0`→**`v0.6.0`**(Milestone4 · 미착수). 버전 키 폴더 5개를 함께 옮겼고 대조는 [MOVES.csv](../milestone/MOVES.csv) 2차 이동 절에 있다. 잔여 기획 #119·#120·#123·#127은 Unity 이후로 보류해 `not planned`로 닫았다(삭제 아님).
> **hotfix (2026-09-11 CJ 승인 · #175 첫 적용)**: 마일스톤 밖 + 출시본 즉시 반영 건은 `hotfix/<이슈>` 를 **`main`에서** 잘라 `main` 병합·패치 태그 후 **`dev` 역병합 → 트랙 동기화**까지 해야 끝난다. `dev` 에서 자르면 미출시 작업이 통째로 배포된다. 라벨 `hotfix`·마일스톤 없음·필수 CI 6개 우회 금지. 실제 적용: v0.4.7 문서 hotfix — PR #176(main) → #177(dev 역병합) → #178(트랙).
> **브랜치 계약도 바뀌었다**: `이슈 →(squash) milestone/vX.Y.Z →(merge) dev →(merge) main`. `dev/vX.Y.Z`는 `refs/heads/dev` 파일이 같은 이름의 디렉터리를 막아 만들 수 없어 2026-09-11 CJ 지정으로 `milestone/` 접두어를 쓴다. 현재 트랙 브랜치는 `milestone/v0.5.0`(Roblox #118)이며 보호·필수 CI 6개를 걸어 뒀다. **Roblox 담당자는 별도 개발자**라 [브랜치·버전 정책 안내](../roblox/BRANCH-POLICY.md)를 따로 두고 Issue #118 에도 공지했다. 트랙 브랜치는 dev에서 분기하고 보호·CI 6개를 함께 적용하며, 마일스톤 완료 시 main 직행은 금지다(hotfix만 예외, 즉시 dev 역병합). **정식 출시는 v0.4.6**(2026-09-11 · 태그 v0.4.6)이다. `roblox/` 소스는 main 에 함께 있지만 출시 기능이 아니며 Roblox 는 v0.5.0 으로 따로 출시한다.

## 마지막 회차 — #122 · #124 · #126 (CJ QA PASS · CLOSED)

- **REVISE 2차 (최종)**: [접촉·전투 규칙 개편](../milestone/v0.4.6/issues/122/Mars/revise-cjqa-rules/report.md) — 동료↔동료·동료↔왕·왕↔왕 전투화, 폭탄↔폭탄/함정 동반 제거, 도망 실패 시 상대 기본 공격 1회, 준비 탭 `aria-pressed` 동기화, 전투 '← 뒤로' 행동창 아래. 브랜치 `fix/122-contact-battle-rules`. **Codex 정지로 Saturn 교차 QA 미수행** — Mars 가 백업 QA·Git·문서를 대행했고 CJ 플레이 QA 가 최종 게이트였다. HTML 회귀 19종·CI A/C/E 로컬 재현·Roblox 1922 PASS·변이체 음성 대조 6건·헤드리스 Chrome 실측 6건(콘솔 오류 0).
- Roblox 미러(Battle·Engine·Ai·client)와 `roblox/tests/run.luau` 도 같은 계약으로 맞췄다 — 두 클라이언트 규칙이 갈리지 않게 한다.

## REVISE 1차 — #122 · #124 · #126

- [수정 범위·검수 원장](../milestone/v0.4.6/issues/122/Mercury/revise-back-dark.md): dev `2055d5a9344f1476e87c3fb9dd19104a643bfe50` → `fix/122-back-dark-theme`, Run `run_593b37fa6871`. Mars Claude `task_7753c02bba5e` / `ctx_eb4e86fbc67d`가 HTML·툴링을 구현하고 Saturn Codex `task_43c6bf801879` / `ctx_a8c2e0895fd4`가 독립 READ_ONLY 검수했다. Mercury는 조정·Git·문서다. 확정 제품 `21637d1` / HTML blob `2a2c26da1728935ec024253ef9fad44945e3eabf`와 실제 Chrome13장 제품 검수 PASS다. 최종 미디어·CI·통합·자원 정산은 위 원장을 따른다. 아래 과거 PASS를 새 수정에 재사용하지 않는다.
- GDD13 DL56·GDD21·GitHub #122/#124/#126을 CJ QA REVISE로 기록했다. 좌상단 뒤로가기와 어두운 바탕만 후속 승인 범위이며 다른 Issue·Roblox·릴리스는 착수하지 않는다.

## 이전 납품 — PR160

- [CJ 후속 범위](../milestone/v0.4.6/issues/122/Mercury/cj-followup.md)에 따른 세로 화면·왕/동료 아트·승패 효과를 구현하고 Saturn 독립 제품·미디어 검수 PASS를 받았다. [통합 기록](../milestone/v0.4.6/issues/122/Mercury/report.md)이 당시 소스·검증·절차 예외의 원본이다. 당시 세 Issue OPEN·CJ 아트/플레이 QA 대기였으며 이후 REVISE는 위 보완 절을 따른다. 정식 v0.4.5·v0.4.7 미출시다.
- 통합은 [PR160](https://github.com/ChangjoSung/Digit-Duel/pull/160)의 최종 필수 CI6·dev squash로 관리한다. 제품 checkpoint `b3e077b654167a31736898224b50d212ce349ac4`, HTML blob `6bd3bed5bcbeda415b7d43591371ab77e5d31045`; 미디어 checkpoint `eeb2d11e03819ae87603584f234c55a79ff1f0b0`. 최종 PR head·CI·dev SHA는 PR160 및 Issue122의 통합 코멘트를 따른다.
- Roblox PR161–166을 origin/dev `a22b8c8`까지 보존한 뒤 PR160을 통합했다. 마지막 incoming7파일은 Roblox 영역이며 해당 범위의 origin/dev 차이0을 확인했다. 별도 담당자의 구현·Studio QA를 이번 Mercury 납품으로 주장하지 않는다.
- 은폐·인접·일시 공개·정체·메모 규칙은 유지한다. 비인접 은폐 위치는 DOM 미표시, 수풀에서 보이는 양측 말은 카드50%·본체70%, HP·소속·선택은 선명하게 표시한다. 전투는 적 우상단·아군 좌하단과 고정 HP 머리/스크롤 상태 목록·하단 네 명령이다. 같은 문서 로비/재대전은 #128 튜토리얼을 반복하지 않는다.
- 결과 배너2500ms를 유지하고 안쪽 효과만 승리1060·패배1080·포획930·경기무승부800ms로 구분한다. 도망은 fleeFx1200ms 뒤 교환 선택, 적 포획은 captureFx1200ms 메시지 뒤 기존 resultBanner2500ms다. 게임 수치·난수·프로토콜 변경은 없다.
- Mars 회귀19종·신규93/0·Chrome159/0·아트76검사, Saturn 최종93/0·종료큐14/0·포획관측자12/0 및 앞선8종1152/0·AI13경기를 구분해 기록했다. 게임43장·튜토리얼10장·README1100/390 렌더를 보관했고 실제 튜토리얼10해시·README20렌더해시를 독립 확인했다. 실기 모바일/2PC 전체플레이는 미검증이다.
- Run `run_031dae03dc6e`: Earth 아트와 수풀 보정, Venus 분석→문서, Mars, Saturn 모두 납품 후 archive/release했다. Venus 분석의 옛 retained 표기는 후속 문서 Task로 이전한 자원이며 별도 활성 Worker가 아니다. 회수 대기0, 새 작업 배정 없이 CJ QA를 기다린다.
- **절차 예외:** Mars가17:10에 저장소에서 `git add -N`·`git reset -q --`를 지정6경로에 실행해 Task failed로 정산했다. 관측된 파일 유실은 없으나 모든 과거 영향 부재의 입증은 아니다. FIFO 미ack로 후속 지시 수신이 지연된 경과와 중간 검증/최종 검증 구분도 통합 기록에 남겼다.
- **검색 경계 예외:** Saturn과 Mercury의 PowerShell rg 호출에서 지정 파일 밖 결과가 나타났다. 보호 루트 내용은 출력에 없었으나 탐색 부재는 입증하지 못한다. 보호 경로를 사후 조사하지 않았고 정확 LiteralPath로 전환했다. Saturn은 파일 수정0·제품 PASS와 별개로 Task failed이며 Mercury 자신의 예외도 기록했다.
- Earth의 최초 `.chrome-render/`, #124 `render-profile-ctx-b66017b5187b`, TEMP `earth-122-ctx-9425bcbe8546-render`는 정확 경로 삭제가 자동 승인 검토에서 blocked by policy로 거부돼 보존·납품 제외했다. 우회하지 않았다. Mars는 자기 생성 임시 자원 잔존0을 보고했고 Saturn은 파일·프로필을 생성하지 않았다. 사용자 소유 루트·Downloads·Roblox 담당 자원은 정리 대상이 아니다.

## #128 완료 이력

- #128 후속 승인: URL 새접속·새탭·새로고침·브라우저 재실행 후 새문서·LAN 서버 재시작 후 새접속마다 1단계 표시. 같은 열린 페이지의 새게임·재대전·모드변경·연결복구·탭/보존 페이지 복귀에는 자동 반복하지 않는다. 완료·건너뛰기·Esc·수동 다시보기·기존10단계·접근성·다른 저장값 보존. 계정/서버/브라우저 저장 전체 삭제는 범위가 아니다. GDD13 본문4.13·DL47, [현재 PD 기록](../milestone/v0.4.6/issues/128/Mercury/report.md) 참조.
- 이번 출발: `fix/128-tutorial-every-load`, 원격 dev `bdce124e73fe82534dd1757deef70976e12a7ef5`(Roblox PR153 포함), 이전 HTML blob `2a9b54c769a58fc5c0db9e913ce4421bec6758e3`. Run `run_3b8c920c6131`, Mars/Venus=Claude·Saturn=Codex READ_ONLY·Mercury=조정/Git/문서. 실제 Task/Dispatch·완료 자원 상태는 Orca가 원본이다.
- 검수 제품: 커밋 `17cdae8c5cabe77c791bc61349cbebb0ecd659cd`, HTML blob `8027cd72d8445c9a7077d0e43b1c5559645ee165`. 원격 Roblox PR154/155(dev `817f79d`)를 먼저 ff했고 incoming은 Roblox 영역뿐이었다. 회귀19종·Chrome26/0·Saturn 독립61/0 및 선택3종465/0, README1100/390 렌더 문제0을 확인했다. 기존10단계는 내용이 같아 #146 촬영본을 보존한다. [이번 검증·한계·정산](../milestone/v0.4.6/issues/128/Mercury/report.md)에 제품/문서 해시와 후속 렌더 누락 정정을 기록한다.
- 추가 Notion 이관: 같은 페이지 ID/URL로 [README 작성 규격 GDD19](https://app.notion.com/p/3d51e7f1708580f18f2dc4a643721059)·[턴 행동 GDD20](https://app.notion.com/p/3d51e7f1708580b0916ded4bd3d9d06e)을 Game Design Docs 승인 목록에 이동하고 #121 형식으로 정리했다. 원문·이미지4/5개·기존 Summary를 보존했으며 GDD13 DL48에 기록했다.

## 직전 PR152 완료와 보존 이력

- [#146](https://github.com/ChangjoSung/Digit-Duel/issues/146): HP 제한 없는 도망 기본30%·자기 전투 행동1회. (실패 시 추가 반격 삭제는 같은 날 [#122 CJ QA REVISE 2차](../milestone/v0.4.6/issues/122/Mars/revise-cjqa-rules/report.md)로 대체 — 지금은 상대의 기본 공격 1회를 맞는다.) 도망의 수호자는 해당 배틀70%. 4슬롯 전부 불가 시 기본 공격 없이 수동 대기, 왕/동료 본체 기본 공격 유지. [최신 승인 계약](../milestone/v0.4.6/issues/146/Venus/gameplay-spec.md), GDD13 DL45·GDD18 기준.
- [#131](https://github.com/ChangjoSung/Digit-Duel/issues/131): 함정에 걸린 양쪽 대상의 선택·실행 차단과 첫 말→교체할 말 두 단계 안내.
- [#130](https://github.com/ChangjoSung/Digit-Duel/issues/130): 남은 보호막+이번 기술의 기존 부여량 합산. 신규 수치·상한·기간 없이 기존 흡수·화상 우회·초기화 유지.
- [#128](https://github.com/ChangjoSung/Digit-Duel/issues/128): 독립 Chrome 프로필/동일 HTTP origin에서 신고 증상 미재현. 최종 증빙은 A·B 탭을 먼저 열고 A 완료 후 B를 관측하며 이후 각 프로필의 미완료 재방문/완료 생략이 독립이다. 첫 navigation 순서를 확대하지 않는다. 저장 로직 무변경·회귀/증빙만 추가했고 CJ 재현 주소·브라우저를 질문했다. 물리 2PC나 신고 증상 해결 PASS가 아니다.
- 통합 원본은 [PR152](https://github.com/ChangjoSung/Digit-Duel/pull/152)(대상 dev)다. 작업 브랜치 `feature/146-battle-actions`는 출발 dev `33bbc19`에서 Roblox PR151의 `697212e`를 ff-only로 포함했다. 제품·촬영 기준 `aa6998ae8d2ca8b5fc8136c5fa19bc6aca5c12ea`, HTML blob `2a9b54c769a58fc5c0db9e913ce4421bec6758e3`, Windows SHA256 `b1c33ae8ff87e64cb71481714d73966f09e3af5f3b8506d82893dccb77f305de`. 신규 회귀207/0·19종 회귀·Chrome81/0·튜토리얼10장·최종 README1100/390 렌더를 검증했다. 문서 후속 커밋은 제품을 바꾸지 않는다.
- PR152 Run `run_c784a12efc36`: 최종 head `8023ce2302b4cd32a8622b254089107dc7fb725c`의 필수 CI5 PASS 후 dev `24ebf3644bc990d474ee8b1ae70cd43ebee79b9c`에 squash했고 전체 트리가 같았다. 전용 feature는 삭제했다. Venus/Mars=Claude, Saturn=Codex READ_ONLY, Mercury=조정/Git/문서. [코어 PASS](../milestone/v0.4.6/issues/146/Saturn/core-review.md)와 [미디어/렌더 PASS·보고 정정 REVISE 원문](../milestone/v0.4.6/issues/146/Saturn/delivery-delta.md)을 구분한다. 완료 Worker는 최종 소유자에서 archive/release했고, 같은 Mars 터미널 후속 Task의 아래 절차 위반은 failed로 보존한다. #130·#131·#146은 이후 CJ 명시적 QA PASS로 종결했다.
- **후속 정리 절차 위반**: Mars `task_c5532cf6d758`/`ctx_7799bd4b330b`가 `%TEMP%/i146cdp-main-*`, `profA-*`, `profB-*` 각8·합24개를 wildcard `rm -rf`로 삭제했다. 개별 절대경로·생성주체/시각 사전 대조가 없었고 같은 접두사 타 주체 자원 가능성을 배제하지 못한다. PD는 추가 수동 정리를 중지했고 후속 Task의 failed 보고를 확인한 뒤 archive/release했다. 제품/미디어 PASS를 절차 준수 PASS로 확대하지 않는다. 보고 문장 정정은 PD가 직접 대조했다. [경위·확인 한계](../milestone/v0.4.6/issues/146/Mercury/report.md).
- #121·#125·#129는 [PR143](https://github.com/ChangjoSung/Digit-Duel/pull/143) dev `2b47a23` 통합·CI5·Saturn PASS 후 2026-09-10 CJ QA PASS로 CLOSED다. 당시 제품/촬영 checkpoint `157026ba617166644ada0686b897d3ae2a166486`, [Saturn 보고](../milestone/v0.4.6/issues/121/Saturn/report.md)·[PD 보고](../milestone/v0.4.6/issues/121/Mercury/report.md)와 검수 한계는 보존한다. 당시 Worker는 전부 archive/release했다.
- [Milestone12 v0.4.6](https://github.com/ChangjoSung/Digit-Duel/milestone/12)은 [이욱채(lee775)](https://github.com/lee775)의 Roblox #118 전용이다. 해당 제품 수정·QA 판정·자원 정리를 이 PD가 대신하지 않는다.
- [Milestone13 v0.4.7](https://github.com/ChangjoSung/Digit-Duel/milestone/13)의 Infra #132/#134는 완료·CLOSED다. #134 [PR136](https://github.com/ChangjoSung/Digit-Duel/pull/136) dev `a073c0c`·CI5·Saturn·CJ QA PASS와 [절차 예외](../milestone/v0.4.6/issues/134/Mercury/report.md)를 보존한다.
- 실제 Claude 한도 중단 때만 같은 역할 Codex로 이어가는 CJ 승인은 유효하다. 이번 작업에서는 한도 중단이 관찰되지 않았다.


## 완료 이력 — 선행 Infra #132

- **2026-09-10 CJ 추가 승인 완료:** `E. Roblox 클라이언트·규칙 (Luau)`를 dev·main에 여섯 번째 필수 검사로 연결했다. PR163/dev2c04b7f 성공 이력 확인, 두 보호 API 재조회에서 앱15368의6개·strict=true·나머지 보호 설정 동일을 확인했다. [현행 연결 기록](../milestone/v0.4.6/issues/132/Mercury/required-checks.md)·[Issue132](https://github.com/ChangjoSung/Digit-Duel/issues/132#issuecomment-5614971093)·GDD13 DL54를 따른다. 아래5개 기록은 최초 도입 당시 증거이며 현재 필수 목록은6개다.

- [Issue #132](https://github.com/ChangjoSung/Digit-Duel/issues/132): 기존 문서 자료 342개 중 306개를 버전·Issue·역할/용도별로 이동했다(Markdown 73개, 기타 233개). 36개는 상시 안내·운영 계약·공용 미디어로 유지한다. 고유 측정·REVISE·출처 증거를 보존하기 위해 순수 삭제·통합은 0건으로 판단했다. [전체 경로표](../milestone/MOVES.csv)가 원본 342개를 모두 대응한다.
- 이동 직후 306/306의 작업 트리 SHA256이 동일했다. 기존 57파일의 명시적 줄바꿈/whitespace 규칙도 새 경로로 옮겼다. Saturn 독립 READ_ONLY 검수에서 비 Markdown 250개(이동233+유지17)의 원본 blob, 이동 Markdown73개의 링크 외 본문, 제품·서버·승인 아트 보존을 확인했다. 문서 검사106개·내부 참조332건 문제0, 링크 검사기 회귀34건과 AI 완주13경기·59단언을 검증했다.
- 개발 브랜치 `infra/132-docs-actions`, 분기 기준 `origin/dev 39f022293008d352e4709762af07e42d63fb557e`. PD는 Git·문서 메타데이터, Venus(Claude)는 Markdown, Mars(Claude)는 Actions·도구·테스트를 담당했다. 통합 PR은 #133 하나이며 제품·서버 런타임·승인 아트의 내용은 동일하다.
- 실제 [PR CI 실행](https://github.com/ChangjoSung/Digit-Duel/actions/runs/34310450164)(검수 head `c06ee3909d4ad5cbbefb5fc118e4ad5bf36de900`)에서 규칙·AI, Linux 서버, Windows 실행기, 문서, 납품 아트의 **5개 잡 모두 PASS**. D는 Windows2025/Python3.14.3/Pillow12.3.0에서 write0·unchanged29·mismatch0 및 도구68검사 PASS, C는 현재 v0.4.5 매니페스트로 검증했다. 이후 주석·운영 상태 정정 커밋의 최종 실행은 PR의 검사 목록을 따른다. Saturn은 후속 변경과 실제 CI·보호 설정까지 독립 확인했다.
- main/dev 보호 설정을 적용·readback했다: PR 필수, GitHub Actions 앱15368의 5개 검사 필수, 최신 base 요구, 관리자도 적용, 대화 해결 필수, force push·삭제 금지, 승인 리뷰 수0. 승인 리뷰 수0은 Saturn/CJ 운영 계약을 없애지 않는다. 워크플로는 dev 통합 후 차기 릴리스 PR로 main에 전달하며 수동 실행은 기본 브랜치 main에 파일이 도달한 뒤 가능하다. 이번 실증은 dev PR CI이며 main PR·수동 실행을 실증했다고 주장하지 않는다.
- 당시 Milestone12(v0.4.6)에 게임119–131·기존118·Infra132가 함께 등록돼 있었다. CJ의 후속 결정에 따라 현재 소속은 위 v0.4.6/v0.4.7로 분리됐다. `feature/118-roblox-port`는 이 PD 작업의 변경·정리 대상이 아니다.
- [GDD17 분석 원장](https://app.notion.com/p/3d61e7f170858126a889e682610ebad7): 기술 23개(정상 도달 22), 20종 80슬롯, 6개 탐색 이벤트의 말별 결과와 근거·미정 정책을 기록했다. #123 공용 아트는 #119 기획 후, #124 동료·왕 아트는 독립 목표다. #131에는 함정 하수인의 텔레포트 선택 차단과 지정 문구가 등록돼 있다. **위 후보 중 최신 CJ가 지정한 #121/#125/#129 및 #146/#131/#128/#130만 승인 범위다. 나머지 미지정 기획·아트·외부망·출시는 착수하지 않는다.**

## 출시와 제품 근거

- 최신 정식 [v0.4.5 Release](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.5), [Milestone11](https://github.com/ChangjoSung/Digit-Duel/milestone/11) CLOSED. [Issue114](https://github.com/ChangjoSung/Digit-Duel/issues/114)·PR115 구현, PR116 출시 문서, PR117 릴리스 완료. **2026-09-08 CJ 플레이 QA PASS·배포 승인**, 제품·문서·미디어 Saturn 독립 PASS.
- v0.4.5 main/origin/main 및 annotated tag 대상 `39a3af12a9b4dd5e8f82776f0f0d21994034387c`. 이번 작업은 dev 대상이며 새 태그·Release를 만들지 않는다.
- **v0.4.5 출시 제품** `demo/index.html` Git blob `61a3ce3e5927697ea80ec8ebd379ffb98ebfdb92`, LF SHA256 `f742b6ba205fbcba2f3081134057dbccb81193fb55b24d5140df16be7a90fc33`. 원 검수 커밋 `5de47a9db4960ae7392e85ed3a811248743d090b`에서 과거 README 튜토리얼 PNG10장과 manifest를 만들었고 당시 독립 재캡처 10/10 바이트 일치를 확인했다. 현재 개발판의 코드·검사 결과로 재사용하지 않는다. Windows 작업 트리 CRLF와 Git blob의 LF를 혼동하지 않는다.
- v0.4.5 납품: 무제한 텔레포트, 양측 밀기·공동 안전 재배치와 후보 부재 예외, 함정 강제 이동, 도망 소유자의 보드 선택/생략, 조건부 턴 종료·만피 회복 대기, 튜토리얼 10단계·README 갱신. [게임플레이 계약](../milestone/v0.4.5/specs/v0.4.5-gameplay-spec.md), [읽는 판](../milestone/v0.4.5/specs/v0.4.5-rules-digest.md), [PD 검수 보고](../milestone/v0.4.5/issues/114/Mercury/issue114-pd-report.md), [후속 미디어 보고](../milestone/v0.4.5/issues/114/Mars/issue114-mars-followup.md).
- v0.4.4: Milestone10 CLOSED, PR111, main/tag `aff981217e33c88e8685adebe10351b6d5c5100d`, 제품 blob `f580e4f9aa4b5ce3daceef940891a875586a1e34`. v0.4.3: Milestone7 CLOSED, PR97, main/tag `cc3f382496473233334f374896d46639b83d7974`. 과거 태그를 이동·재발행하지 않는다.

## 보존해야 할 검수 한계와 기록

- [v0.4.4 1차 취합](../milestone/v0.4.4/reports/Mercury/v044-pd-report.md), [후속 취합](../milestone/v0.4.4/reports/Mercury/v044-followup-pd-report.md)에 #91–#96·#104–#106의 구현·QA·초기 REVISE·정정 수치를 보존한다. [버전별 문서](../milestone/README.md)에서 개별 역할 보고를 찾는다. 과거 수치나 단계별 PASS를 현 제품에서 재실행한 결과로 바꾸지 않는다.
- #104 시점 감사의 기본 소스는 과거 고정 ref다. **현재 제품은 `node demo/test/regression/smoke_orientation_audit.js --path demo/index.html`로 검사한다.** 원 CJ 경기 전체를 자동 재현했다는 뜻은 아니다.
- 실제 원격 LAN 두 기기·물리 모바일·비Chrome·모든 백그라운드 일정·사람 밸런스 통계는 기존 미측정 범위다. 일부 Chrome 검수는 연출 시간 단축과 명시적 fixture를 사용했다. 기존 좁은 화면의 전체 페이지 가로 넘침, 포획 예비 HP70/100의 비율 판정 불리함, 보드 AI의 본체 속성 근사와 감전 순서 부채를 보존한다.
- [Issue106 절차 위반](../milestone/v0.4.4/issues/106/Mercury/issue106-pd-incident.md): 과거 Worker의 테스트 Git 복원·프로필 접두사 기반 Chrome 종료. 파일은 HEAD와 같고 Saturn 영향은 관찰되지 않았지만 전체 종료 대상의 소유권은 입증되지 않았다. 같은 방식을 반복하지 않는다.
- #104의 과거 `README.txt`가 가리키는 로그 3개는 작업 트리에 있으나 `*.log` 무시 규칙으로 저장소에 포함되지 않았다. 이 작업에서 재생성·force add·삭제하지 않는다. **추적 문서의 옛 `docs/qa/` 경로를 비웠다는 말은 미추적 로그 폴더까지 제거했다는 뜻이 아니다.**
- #132 분석 중 Mars가 `du -sh --exclude=.git .`로 전체 폴더 용량을 집계하며 보호 경로 메타데이터도 조회한 1건을 확인했다. 관찰된 명령은 내용 읽기나 수정이 아닌 용량 집계였으며, PD가 즉시 추적 파일·명시적 허용 경로만 조회하도록 정정하고 CJ에게 보고했다.
- #132 최초 [CI 실행](https://github.com/ChangjoSung/Digit-Duel/actions/runs/34309177070)은 D에서 PNG14장+매니페스트1건 불일치로 실패했다. 승인 파일·비교 기준을 보존하고 납품 환경으로 맞춘 뒤 성공했다. 압축 구현 차이는 강한 추론이며 Linux 생성 PNG의 픽셀을 직접 비교한 것은 아니다. README 미디어 도구의 SHA 불일치는 기존 WARN 정책이며, 문서 검사기도 외부 URL·제목 앵커·모든 CommonMark 구문을 검증하지 않는다. 상세 관측·정정·한계는 [Mars 보고](../milestone/v0.4.6/issues/132/Mars/report.md)에 보존한다.
- #134 분석 Worker는 `mutation=none`에서 임시 보고 파일을 실제 작성했다. “파일 쓰기0” 보고를 `role_scope_mismatch`로 수락 거부하고 Task를 failed로 정정했다. 증거를 보존한 채 새 구현 Task의 입력으로만 이어갔다. [정정 기록](../milestone/v0.4.6/issues/134/Mercury/report.md)과 Issue134에 남기며 정상 준수로 소급하지 않는다.

## 역할·자원 소유권

- **Mercury = 조정·Git·문서 메타데이터.** 제품·런타임·빌드·도구·테스트는 소규모라도 Mars/Jupiter로 보낸다. 최신 CJ 지시로 **Venus/Mars/Jupiter는 Claude**, Earth/Saturn/Mercury는 Codex다. 과거 Claude quota 대체 이력 때문에 정상 Claude Worker를 계속 Codex로 배치하지 않는다.
- Saturn은 **READ_ONLY**, 파일·테스트·보고서·임시 파일을 쓰지 않고 inline으로 보고한다. 파일을 변이하는 원본 `smoke_online.js`나 임시 fixture를 만드는 도구 회귀는 Saturn의 직접 READ_ONLY 실행에서 제외하고 구현자/CI 결과와 독립 검토 범위를 구분한다.
- 필수 dispatch preflight: `required_role · mode · area · mutation · instance_index`. Worker Git/GitHub/Notion 쓰기 금지. 완료 뒤 결과 archive/release, 같은 좁은 범위의 즉시 후속만 기한부 재사용. Task와 정확한 Dispatch를 연결하고 메시지 전체를 처리한 뒤 acknowledge한다.
- Worker의 메시지 조회는 자신의 `check --terminal <worker-terminal> --json`을 사용한다. coordinator용 `--run`을 붙여 받은 `consumer_fenced`를 메시지 없음으로 해석하지 않는다. PD가 잘못 전달했던 문법은 이 방식으로 정정했다.
- 현재 유일한 Mercury terminal `term_d2dcbfa3-a932-4ce2-a844-38526dd4975b`, 현재 #122·#124·#126 보완 Run `run_593b37fa6871`, 첫 납품 완료 Run `run_031dae03dc6e`. 완료 #146 등 네 Issue Run `run_c784a12efc36`, 완료 #121·#125·#129 Run `run_a30f84eaadf5`, 완료 분석 Run `run_0542beb5fd69`. 완료 Infra #134 Run `run_748eb7b6a85d`, #132 Run `run_874bb77b02e3`, 최초 등록 Run `run_a9eb05e6575e`의 이력은 보존한다. 현재 Worker 상태는 Orca task/worker list가 원본이다.
- **사용자 소유 미추적 `art/`·`orca-hook-latency-report.md`는 읽기·수정·스테이징 금지.** Downloads 원본과 승인 아트100파일을 보존한다. 파일 탐색은 이 두 루트 경로를 포함하지 않는 명시적 범위 또는 Git 추적 목록을 사용한다.
- 기존 Mercury `term_abae9146-14a1-47e9-8e9a-0a6e3c4c041a`, 사용자 소유 `term_f715b1c1-8dc5-438c-b035-540ab8b4082e`, 과거 Saturn `ctx_7587a359d6a6` user_owned, `ctx_bbc10559f749` identity_unproven 및 다른 소유권 불명 자원은 종료·정리하지 않는다. 프로세스·프로필 정리는 해당 실행에서 생성과 소유권을 확인한 정확한 대상에만 한다.
- 이전 세션 압축15회, 2026-09-08 17:47:40 KST 92,019/258,400·단순 차감64.4% 여유는 **현재 세션의 사용량이 아니며 판단력 저하의 입증도 아니다**. [당시 자가 점검](../milestone/v0.4.4/reports/Mercury/mercury-self-audit-2026-09-08.md). 추가 PD 스폰이나 세션 교대 없이 현재 Mercury가 창구를 유지한다.

## Notion·GitHub와 다음 게이트

- [GDD13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) DL38 = 최초 v0.4.6 분석·등록 이력, DL39 = 선행 Infra132, DL40 = v0.4.6 Roblox/v0.4.7 재배치·후속 Infra134. 현재 규칙 참조 경로는 새 문서 위치로 동기화하고, 과거 Decision Log의 GitHub 링크는 이동 전 SHA에 고정했다. GitHub 과거 Issue/PR 본문·코멘트 13곳의 링크34개도 고정·응답 일치 확인했다. 기존 Release8개는 버전 태그 링크라 그대로 유효하다.
- Notion System 원문 `3d51e7f1708580b0916ded4bd3d9d06e`의 외부 편집 Summary는 보존한다. Project=Digit Dual, Edit Date=실제 수정일, Editor=실제 사람 성창조(`8e0a8270-d0e3-407e-a7d2-b3f992f1e366`); Agent 이름은 운영 본문에만 기록한다.
- GDD13 DL42와 [GDD18](https://app.notion.com/p/3d61e7f17085809ea410fe6a1431f06c)에 #121·#125·#129 최종 승인 계약을 동기화했다. 현재 코드를 검수한 Saturn PASS와 통합 PR 최종 head의 필수 검사 성공이 dev squash의 전제다. 전용 작업 브랜치만 정리하고 main/dev는 보존한다. 세 Issue는 2026-09-10 CJ QA PASS로 CLOSED다. 후속 #130·#131·#146(PR152)과 #128(PR157)도 2026-09-10 CJ QA PASS로 CLOSED다. #128 최종 수락은 GDD13 DL50·[CJ 승인 기록](https://github.com/ChangjoSung/Digit-Duel/issues/128#issuecomment-5613962951)을 따른다. 기존 승인 규칙 구현은 완료됐고 #122·#124·#126은 첫 납품 후 CJ QA REVISE를 받아 좌상단 뒤로가기·어두운 배경을 보완했다. 현재 검수·통합은 최상단 REVISE 보완 기록이 원본이다. 현재 구현 소스·최종 미디어·절차 예외는 위 통합 기록과 GDD21을 따른다. 나머지 이슈는 번호별 CJ Comment 대기다. 과거 PASS를 새 변경의 근거로 재사용하지 않는다.
