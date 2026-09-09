# Issue #114 — Mercury 통합 보고

[결정] 2026-09-08 · v0.4.5 턴 행동·문서·튜토리얼. **제품·문서·미디어 독립 QA PASS, CJ 플레이 QA PASS 및 배포 승인.** [PR #115](https://github.com/ChangjoSung/Digit-Duel/pull/115)를 dev `f4ae0870ce7f7316f22d96ff4ec7184f8943b469`에 통합했다. 출시 버전은 [v0.4.5](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.5)이며 실제 main SHA와 태그는 Release·Issue114가 원본이다. Claude 한도 중단 시 Codex 인계 승인과 초기 REVISE 이력은 아래에 보존한다.

## 소유권과 승인

- 납품 목표는 [Issue #114](https://github.com/ChangjoSung/Digit-Duel/issues/114) 한 개, 통합 PR 한 개다. Mercury는 조정·Git·문서 메타데이터, Mars는 제품·도구·테스트, Venus는 문서, Saturn은 독립 READ_ONLY QA를 담당한다.
- Claude Mars와 Venus 후속에서 실제 “session limit · resets 7:40pm”을 확인했다. 18:38 KST 해당 두 터미널만 중단했고 후속 상태는 failed/process_exited, 사유는 Terminal closed by operator request였다. CLI의 dispatch_inactive 반환과 달리 실제 터미널 목록에서 종료를 확인했다. release는 identity_unproven retained로 반환했으며 메타데이터를 강제로 정리하지 않았다. Codex 후임이 같은 역할로 미커밋 변경을 이어받아 자동 재개와 중복 편집을 막았다. [Issue 기록](https://github.com/ChangjoSung/Digit-Duel/issues/114#issuecomment-5582901293).
- 사용자 소유 root art/·latency 보고서, Downloads, 기존 아트·과거 QA 근거는 보호한다. main/tag·기존 Release를 구현 대상으로 변경하지 않는다.

## 문서 독립 QA

Saturn_1 첫 판정은 **REVISE**, 보완 후 **PASS**다. 제품 검수와 분리한다. 두 보고 모두 `files_modified=[]`, 제품 테스트·파일·임시 보고서 작성·Git/Notion/GitHub 쓰기가 없었다.

| 발견된 현재 문구 | 보완·최종 확인 |
|---|---|
| GDD-13 왕 전투가 모든 상대에 출전 선택·공개를 요구 | 4.0·4.9에서 하수인 상대만 적용, 동료 접촉 밀기와 왕 불가침을 명시. 함정 발동 양측 공개도 정합화 |
| 생략을 수동 주 행동으로 안내, 폭탄끼리 무효 규칙 혼재 | 3·4.3에서 v0.4.4 출시 동작과 v0.4.5 자동 생략·양측 밀기를 명시적으로 구분 |
| GDD-14 D15·D18·D19가 과거 검수 대기 상태 | CJ PASS·v0.4.4 출시로 치환하고 과거 측정 근거 보존 |
| GDD-12 소개가 v0.3.1 기준 | 현재 GDD-13 v2.1·v0.4.4 출시/v0.4.5 승인 접촉표로 갱신 |
| 과거 밸런스 기획을 현재 v0.4.5에 배정 | GDD-13 위험·DIGEST2의 보류 기획은 버전 미지정, 이번 범위 밖으로 정리 |
| GDD-13이 아직 서버가 없다고 설명 | 기존 동일 저장소 LAN 릴레이와 향후 별도 서버 저장소 분리를 구분 |

- 첫 보고: `msg_ee13cfdf2e95`, task `task_a6f71517533a` / dispatch `ctx_674abc8d97d2`. 로컬 문서 8개·현재 Notion 4개를 읽었다. README 튜토리얼 이미지의 구버전 표기는 검수 커밋 캡처 예정 항목으로 별도 추적했다.
- 보완 보고: `msg_5fe5fdb5dfc8`, 완료 `msg_11adbe46f2fc`, task `task_953479ad2b49` / dispatch `ctx_441aec18d976`. GDD13 09:53:18Z·GDD12 09:53:19Z·GDD14 09:53:21Z·DIGEST2 09:53:22Z 본문을 재조회했다. 이전 메모리 내 원문과 대조해 GDD13 결정/보관 구역, GDD12 결정 이력, GDD14 측정 구역·D14까지, DIGEST2 1~9장 보존을 확인했다.
- PD는 최초 37개 부분 반영과 후속 13개 정정을 재조회로 확인했고 세 GDD의 Project·Editor·Edit Date·요약·Version을 갱신했다. System 원문의 외부 요약 편집은 보존했다. 상세 변경 앵커는 [Notion 동기화 이력](../Venus/issue114-notion-sync.md).
- 이 판정은 문서 텍스트 검수이며 제품 동작·모든 과거 개정·외부 GitHub 상태를 대신 입증하지 않는다.

## 제품 독립 QA — PASS

- 첫 Codex Mars 구현 보고: [issue114-mars.md](../Mars/issue114-mars.md), 완료 `msg_e3fc84bf2ea1`. 커밋 `e393fe67dffd5b934dda600b9310914857f7a202`, 제품 blob `94b6d41afefe2681b336d89bfe95831171362d65`.
- Saturn_2 독립 검수 중 `aiPushScore`의 새 가중치 -500/2를 발견했다(`msg_e87654d79b8d`). 승인 계약의 새 밸런스 가중치 금지에 따라 Mercury가 수정을 수락했고 Mars 후속 `task_098edd0768cb` / `ctx_9351b9848b46`으로 라우팅했다. 기존 평가 의미를 사용해 보완하고 독립 재검수하기 전에는 최종 PASS로 기록하지 않는다.
- Saturn은 튜토리얼 3단계 카드3·6단계 카드2·8단계 카드3의 SVG 글리프 잘림도 발견했다. 기존 DOM 배치 검사는 SVG 내부 경계를 검사하지 않아 놓쳤다. 좌표 보완과 변환된 글리프 경계 검사로 수정했다. 보강 검사에서 수정 전 커밋은 140회 측정 중 36회가 실패하고 수정본은 140회 모두 통과했다. 반복 측정된 세 위치의 결함이며 36개의 별도 결함이 아니다.
- 최종 커밋 **`5de47a9db4960ae7392e85ed3a811248743d090b`**, 제품 blob **`61a3ce3e5927697ea80ec8ebd379ffb98ebfdb92`**, LF SHA256 **`f742b6ba205fbcba2f3081134057dbccb81193fb55b24d5140df16be7a90fc33`**, 299181 bytes. AI는 기존 왕 가치와 중립 평가를 재사용하며 새 가중치를 제거했다. [Mars 후속 근거](../Mars/issue114-mars-followup.md).
- Saturn_2 보고 **`msg_07b3163164df`**, task `task_ce7e9f4d77c5` / dispatch `ctx_d1c90945267a`: **PASS, files_modified=[]**. 제품·테스트·보고서·임시 스크립트·Git/GitHub/Notion 쓰기 없이 검수했고 실행별 Chrome/서버와 정확한 임시 프로필만 정리했다.

| 최종 blob에서 직접 재실행 | 독립 결과 |
|---|---|
| smoke_issue114 | 16 그룹 PASS |
| smoke_cycle5 / smoke_tutorial / smoke_cross_skill | 69 / 124 / 116, 실패0 |
| smoke_orientation_audit --path demo/index.html | 8910/0, 해당 실행의 퍼즈 수치이며 반복 실행 합산 안 함 |
| issue114_cdp --read-only | 실제 두 클라이언트·릴레이·마우스 입력 9개 검사 PASS |
| tut_layout_cdp --read-only | 5개 뷰포트, 10단계와 이동 경로 140회, SVG·DOM 문제0 |
| 원 커밋 e393fe6 음성 대조 | 보강 글리프 검사가 36/140 측정에서 실패 종료, 회귀 탐지 확인 |

최초 blob `94b6d41a`에서 직접 통과한 나머지 회귀는 최종 AI/SVG 차이를 검토한 뒤 근거를 승계했다: turnflow199, timers36, memo122, minion_art199, online_sync23, own_side66, testclient41, attack_balance50, shock65, online157. online은 디스크 변이 원본을 직접 실행하지 않고 메모리 Map 어댑터로 변이 쓰기/읽기/삭제를 처리했다. 이 수치를 최종 blob 전체 재실행으로 표현하지 않으며 그룹·변이·반복·측정을 한 합계로 합산하지 않는다.

독립 추가 검증은 공동 재배치 보드 300개(안전 조합 존재·빈 칸·적 비인접·영역·결정론·난수0), 양측 출발 칸 후보 포함, 경계·숨은 숲 적·텔레포트6회·회복 대상의 배치/생존 조건 등 지향 사례7개와 회복50→55→60이다. 기본 집중 AI6/6, cycle8/8 완주 및 레벨별 숨은 정체450대체에서 결정 차이0을 확인했다. 추가 5단/5단 두 시드는237/217턴·텔레포트1/2회로 끝났고 origin/dev 대조137/224턴·2/1회와 모두 규칙 위반0이었다. 이는 소수 표본 완주 확인이며 밸런스 개선을 통계적으로 주장하지 않는다.

온라인 공격자/방어자×선택/생략 네 경우는 행동 소유자2프레임·비소유자0프레임·상대 수신2프레임, 큐 잔량0, 상태·난수 일치다. 잘못된 소유자 클릭·연출 중 클릭 차단, 재배치, 회복 후 소유자 자동 종료, 기권·오래된 콜백도 통과했다. 도망·재배치 로그는 뷰어 호칭만 정규화했고 비공개 회복 상세는 차이를 허용한 뒤 공개 사건을 따로 대조했다. 모든 로그의 원시 바이트 일치를 주장하지 않는다. 프레임은 클라이언트 송수신에서 관찰했으며 별도 서버 로그를 보관하지 않았다.

도망/밀기2000ms·자동종료 유예1000ms를 사용했고 나머지 관련 없는 연출은0ms, watchdog1000ms로 단축한 명시적 상태 픽스처다. 전 경기를 기본 시간으로 자연 플레이한 검수가 아니다. 튜토리얼 뷰포트는1280×720·1440×900·1920×1080·CSS640×360/DPR2·360×640/DPR2(좁은 데스크톱 모드)이며 물리 모바일 검수와 구분한다. 기존 게임 페이지722px 폭, 원격 LAN 두 기기·모바일·비Chrome·모든 백그라운드 일정·사람 밸런스는 검수 한계로 남는다.

## 검수 커밋 캡처·README

Mercury는 제품 독립 PASS 후 `CAPTURE_GO`를 전달했다(`msg_0f1f473ef41e`). Mars는 **5de47a9db4960ae7392e85ed3a811248743d090b**를 직접 서빙해 [튜토리얼10장](../../../../../media/tutorial-01.png)과 [capture-manifest](../Mars/artifacts/capture-manifest.json)를 생성했다. 10장 모두2224×1628이며 튜토리얼 내부 스크롤은0이다. README는 기존8개 구성을 유지하면서 단계별 캡션과 개발 버전·정확한 캡처 커밋을 갱신했다. v0.4.5 태그를 만들지 않았다.

Mars의 GitHub 정제 HTML·Chrome 렌더 검증은1100×900·390×844 모두 성공했고 튜토리얼 이미지10장 로드·가로 넘침0을 확인했다. [방어자 도망 선택](../Mars/artifacts/flee-defender-choice.png), [상대 대기](../Mars/artifacts/flee-attacker-waiting.png), [선택 전투 종료 버튼](../Mars/artifacts/conditional-end-option.png)도 실제 Chrome의 명시적 게임 상태에서 촬영했다. PD가 선택 화면·조건부 종료·튜토리얼6단계 이미지를 직접 확인했다. 상세 명령·해시·출력 목록은 [Mars 후속 보고](../Mars/issue114-mars-followup.md)를 따른다.

Saturn_2의 독립 미디어 검수는 **PASS**(`msg_a888acb71dc3`, `task_897a5db15aca` / `ctx_4bf2f32acd0c`, `files_modified=[]`)다. 허용 오차 옵션 없이10/10 재캡처 바이트가 일치했고 manifest의 ref/refSha/htmlBlob·크기·해시도 확인했다. README SHA256은 `18911a9a496ab190853f3a1635fd518c08b40f119695f11a65ce080c0451f13d`다. 1100×900·390×844 각각 로컬 이미지13장(튜토리얼10장 포함)이 로드됐고 페이지/표 가로 넘침0, 읽기 전용 감시파일26개 변경0이었다. 원본10장·두 갤러리·UI 증거3장을 직접 보았고 소유자 선택/비소유자 대기/조건부 종료를 확인했다. 좁은 화면44px 썸네일은 연결된 원본을 열어 읽는다.

Saturn은 README41(앵커1 포함)·미출시 노트6·PD 보고9·Mars 후속1의 상대 참조가 모두 유효함을 확인했다. PD도 관련 문서11개의 상대 링크82개를 별도 검사해 오류0을 확인했다. 외부 링크15개와 배지 가용성은 이 링크 검사 범위가 아니다. 완료 문구와 비공개 회복 로그의 범위 설명도 정정 후 재확인했다. Chrome152·Windows·Node24.16, GitHub 정제 HTML과 근사 CSS 검수이며 실제 GitHub 페이지 전체의 픽셀 동일성이나 물리 모바일 검수를 주장하지 않는다.

## 출시 문서 독립 검수

2026-09-08 Saturn **PASS** (`msg_a1ad21e209cb`, `task_b5e7ab121cd8` / `ctx_c044eb12d88b`, `files_modified=[]`). 출시 문서9개만 검토했고 README 8개 H2와 순서를 보존했다. 현재 README SHA256은 `1298e4ec822a9d825a56889e166d36c9e918294e9c336195a2232ccfb3f47a62`다. 기존 읽기 전용 `readme_media_capture.js verify`를 명시적 manifest와 함께 1100×900·390×844에서 실행해 각각 로컬 이미지13/13·튜토리얼10/10·캡션 일치·페이지/표 넘침0·산출물 쓰기0·감시파일26개 변경0을 확인했다. 문서11개의 상대 참조113개는 경로·대소문자·앵커 오류0이다.

PNG10장의 2224×1628 크기·해시는 manifest와 기준 커밋에 일치했다. 제품·서버·도구·PNG·manifest diff는 비었고, 추적파일493개의 크기/mtime/SHA256 비교도 변경0이었다. 검수/캡처 SHA `5de47a9db4960ae7392e85ed3a811248743d090b`, 제품 blob `61a3ce3e5927697ea80ec8ebd379ffb98ebfdb92`, LF SHA256 `f742b6ba205fbcba2f3081134057dbccb81193fb55b24d5140df16be7a90fc33`와 299181bytes를 재확인했다. 제품 불변·CJ PASS에 따라 제품 테스트는 다시 실행하지 않았다. GitHub 정제 HTML+근사 CSS 검수이며 외부 URL 가용성·물리 모바일·실제 GitHub 픽셀 동일성은 범위 밖이다. 검수 당시 출시/비교 링크는 발행 예정으로 구분했고 실제 발행 확인은 Mercury가 수행한다. Worker는 보고 후 archive/release했다. 이 항목은 Saturn inline 보고를 Mercury가 기록한 것이다.

## 통합·CJ QA·출시

[PR #115](https://github.com/ChangjoSung/Digit-Duel/pull/115)의 최종 feature `ecd6aa88b6e0d3a470fa2a00973271650faa2338`와 통합 dev `f4ae0870ce7f7316f22d96ff4ec7184f8943b469`는 전체 트리 `c1bdbabfac3b4839efe583d9754adbe9b768b408`가 같다. 2026-09-08 CJ가 “CJ Play QA Test : PASS”와 문서 갱신 후 배포를 명시했다. 이에 Issue114를 수락 종결하고 README·릴리스 노트·정리본을 출시 기준으로 갱신한다. dev→main은 merge commit으로 병합하고 그 main SHA에 annotated tag v0.4.5를 발행한다. 실제 발행 결과·릴리스 PR·Milestone11 종결은 [Issue114](https://github.com/ChangjoSung/Digit-Duel/issues/114)와 [Release](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.5)를 따른다. 과거 v0.4.4 태그 `aff981217e33c88e8685adebe10351b6d5c5100d`는 보존한다.
