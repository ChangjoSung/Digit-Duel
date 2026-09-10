# #122 · #124 · #126 — 구현·검수 통합 기록

2026-09-10 · Mercury(PD, GPT-6 Astra/high). [CJ 후속 승인 범위](cj-followup.md) · [통합 PR160](https://github.com/ChangjoSung/Digit-Duel/pull/160). **구현·Saturn 독립 제품 검수 PASS. CJ 아트·플레이 QA와 정식 출시는 대기다.**

## 구현 범위

- 첫 화면 → 로비 → 로스터·비공개 배치 → 전략 보드 ↔ 속성 전투 → 경기 결과 → 같은 문서의 로비·재대전.
- 실제 숲 칸만 수풀 표현. 기존 은폐 판정은 보존하고, 보이는 양측 수풀 말은 카드 바탕50%·본체70%, HP·소유자·선택은 선명하게 표시한다. 인접해 위치만 드러난 상대의 물음표·추측 메모는 유지하며 비인접 은폐 위치는 DOM에도 표시하지 않는다.
- 적 우상단·아군 좌하단, HP·보호막·상태 판과 하단 네 전투 명령. 기록은 보드 메뉴의 서랍에서 연다.
- 왕·동료는 별도 신규 픽셀 스타일 원본을64/256px로 단순 축소했다. 원본1254px·알파를 보존하며 기존 승인 하수인100파일을 교체하지 않는다.
- 강한 승리·패배 효과는 기존 결과 배너2500ms 안에서 재생한다. 최종 경기 종료는 결과를 한 번만 표시한다. 도망은 기존 fleeFx1200ms 후 교환 선택으로 이어지며 별도 결과 배너가 붙지 않는다. 적 포획은 기존 captureFx1200ms 메시지 후 resultBanner2500ms 결과 단계가 한 번 재생된다. 각 단계의 상수를 보존하며 전체 경로가1200ms뿐이었다고 소급하지 않는다.
- 기존 게임 수치·난수·정체·온라인 프로토콜, #128 새 문서 자동 튜토리얼 및 같은 문서 중복 방지 계약을 보존한다.

## 코드·검증 체크포인트

| 항목 | 근거·현재 상태 |
|---|---|
| 시작 제품 | HTML blob `8027cd72d8445c9a7077d0e43b1c5559645ee165` (#128 CJ QA PASS 당시) |
| 병행 Roblox 보존 | origin/dev `1791651a79f5d730589e5f2e42c9ccc89bac1624`까지 merge `dc08c7b278a7d9c9ef398a29ee170a0f826ff029`에 포함. PR161–164 및 관련11파일의 origin/dev 일치를 확인하며 별도 담당자의 Roblox 제품 QA를 대신하지 않음 |
| 첫 제품 체크포인트 | `5e7a668c674c6641f15f1e4494a98150fa0185c3`, HTML blob `6cae19a6820b5cc8073dd175648a0de500ebe6b4`. CI6 PASS. 후속 REVISE 전의 중간 기록 |
| 최종 제품 체크포인트 | `b3e077b654167a31736898224b50d212ce349ac4`, HTML blob `6bd3bed5bcbeda415b7d43591371ab77e5d31045`, Windows CRLF SHA256 `cd0c61c7363eaa62ff12030c0078be12ce9f64a6e6ee71ce7bdd7e3c49115e81`. 17:52 제품 소스 고정. 이후 미디어·도구·문서 검수 진행 |
| Mars 구현 검증 | [구현 보고](../Mars/report.md) · [브라우저 결과](../Mars/artifacts/ui_cdp_report.json). 최종 회귀19종·신규93/0·Chrome159/0·아트 도구76검사 OK |
| Saturn 독립 검수 | 18:03 KST PRODUCT PASS (`msg_cdb1446e21bc`). 절차 Task는 failed |
| 튜토리얼10 | [촬영 기록·해시](../Mars/media/capture-manifest.json). b3e077b/6bd 기준10장 재촬영·실제 SHA256/bytes/2224×1636 대조10/10 |
| CJ QA / 통합 / 출시 | 세 Issue OPEN·CJ QA 대기. 최종 CI6·dev 통합 상태는 PR160이 원본. 정식 v0.4.5 유지 |

## Saturn 독립 READ_ONLY 관측

Task `task_ada19fe633b9`, Dispatch `ctx_dc9282de5b09`. Saturn은 파일·임시 파일·보고서를 쓰지 않았고 브라우저·서버·프로필 자원을 만들지 않았다. 아래는 PD가 받은 inline 결과를 보관한 것이며 Saturn의 파일 작성물이 아니다.

- 2026-09-10 17:22 KST 중간 관측: 선택8종1152/0, 독립 코어44/0, live-queue14/0, stale-socket7/0, AI13경기, leader exporter5/5, 승인 하수인100/100 blob 일치. 제품 본체 결함은 아래 포획 시각 분기 외 발견되지 않았다.
- 핵심 독립 관측: 91칸·숲28/일반63, 인접/비인접/일시 공개·양측 관측, 경기 종료5사유와 중복/해제, 새게임 이후 stale timer, 온라인 초기화/낡은 socket, 로컬 기록·난수 보존. 실제 왕 제거 endpoint에서 사망 메시지 뒤 경기 배너1회, 전투 동률 방어자 승, 비최종 포획1배너·전멸 포획1경기 배너·입력 해제를 확인했다.
- REVISE: 비최종 포획이 최종 승리 CSS를 공유함. CDP 도구의 효과 시간 하드코딩으로1104/1188ms를 잘못 보고함. 신규 CI 테스트의 저장값 assertion이 인수 없이 constant none을 비교함. 결과 배너 assertion이0개도 통과시킴. 네 항목을 Mars에 수정 배정했으며 수정 후 실제 computed timing·endpoint 검증이 필요하다.
- 원본 아트 정정: 왕 원본의 왼쪽 아래 모서리 alpha는1이며, 모든 원본 모서리가0이라는 초기 설명은 정확하지 않다. 원본 SHA256은 Earth 보고와 일치하고 파생4개 모서리는0이다. 원본은 수정하지 않는다.
- b3e077b 보완 내용: 포획 양측은 cap/capnot 수렴 효과, 새 도망 바람도 reduced-motion 억제, HP 판 고정 머리+스크롤 목록 분리, 실제 저장소·배너 정확히1회 assertion으로 수정했다. 현재 computed 강한 효과 최대 종료 시각은 승리1060ms·패배1080ms·포획930ms·경기 무승부800ms다. 제품 수정 후 Mars 회귀19종·신규93/0·Chrome153/0은 중간 검증이며, PD가 최종 도구 리뷰에서 C29e의 항진 조건과 저동작 승리 파일에 도망 화면을 담은 촬영 순서 오류를 찾아 실제 scrollTop/HP 고정·샷 순서 검증으로 보완 배정했다. 최종 브라우저 수치와 미디어는 그 보완 이후 결과를 따른다.

- **최종 제품 PASS:** Saturn은 b3e077b/6bd의 신규93/0·종료 큐14/0·포획/관측자12/0을 독립 확인했고 제품 보완 요구를 모두 해소했다. 튜토리얼10장의 실제 SHA256·bytes·2224×1636, README 렌더20장의 실제 해시도 대조했다. README 원본 SHA256 `f0c9f688461bda20bf8827cfed6be457bc9cfda4cc53ef0fe28341af91fac068`은 두 폭 보고서와 같고 각 fail0이다. GitHub sanitize HTML은37705B·SHA256 `7113a748deb29452ceedcd73380be748d0409ee62bc5723dd0e25189127f26bc`, 이미지20·앵커73·details1·script0이다.
- **최종 미디어 보관:** `eeb2d11e03819ae87603584f234c55a79ff1f0b0`에 게임43PNG·튜토리얼10PNG·README 렌더20PNG와 각 JSON/HTML을 기록했다. [PC 렌더](../Mars/render-1100/verify-report.json) · [모바일 렌더](../Mars/render-390/verify-report-w390.json). 제품은 b3e077b와 같다.
- **PD 최종 수치 정정:** 마지막 CDP JSON은 `2026-09-10T08:57:06.492Z`·159/0·HTML6bd다. 360/390은 마지막 칸685≤독749, 데스크톱은 배율0.93·칸48.36px·아이콘29.76px·마지막 칸723≤독787이다. Saturn 최종 inline의08:54:20.592Z·데스크톱761≤825는 직전 촬영 수치이며 최신 JSON으로 치환한다. 양쪽 상태7종·보호막48 스트레스에서 판 겹침0, 목록 scrollTop39로 마지막 기술 줄까지 접근하고 이름·HP 머리는 움직이지 않는다. AI 진행 중 보드의 측정 순간과 PNG 순간은 다르므로 픽셀 대응이나 안정된 사람 입력 시점을 입증했다고 확대하지 않는다.
- **도구 한계:** README verify의 별도 tutorial 절은 과거 `docs/media`를 검사한다. 새10PNG는 그 PASS를 재사용하지 않고 PD·Saturn의 실제 파일/manifest 대조10/10으로 검증했다. 390 갤러리44px 썸네일은 원본 링크이고 코드 블록 내부 가로 스크롤은 보고에 남아 있다. GitHub CSS 근사 렌더이며 실사이트와 픽셀 동일하다는 뜻은 아니다.
- Saturn 최종 정산 `msg_d5c921b1f076`는 제품 PASS·파일 수정0·절차 failed다. Mars `msg_ea544ddd2f98`도 구현 납품·절차 failed로 정산했다. 두 transcript를 archive하고 release했으며 회수 대기0이다.

## 역할별 정산과 절차 예외

Run `run_031dae03dc6e`. Earth=아트, Venus=기획·문서, Mars(Claude)=제품·도구·검증 산출물, Saturn(Codex)=독립 READ_ONLY, Mercury=조정·Git·문서 메타데이터다. 실제 Task/Dispatch의 최신 상태는 Orca가 원본이다.

| 역할·Task | Dispatch | 결과 |
|---|---|---|
| Earth 아트 `task_361876d47908` | `ctx_b66017b5187b` | 납품·archive/release |
| Earth 수풀 보정 `task_1326143e959e` | `ctx_9425bcbe8546` | 납품·archive/release |
| Venus 분석 `task_bc6d0fb057e4` | `ctx_bee061a6418e` | 분석 납품·동일 자원을 후속 Task로 이전 |
| Venus 문서 `task_edb2dd272361` | `ctx_8ea5fe79675a` | 납품·archive/release |
| Mars `task_c76b0350fe8a` | `ctx_55ae89f24c7e` | 구현 납품 · Git 쓰기 위반 Task failed · archive/release |
| Saturn `task_ada19fe633b9` | `ctx_dc9282de5b09` | 제품 PASS · 검색 경계 미입증으로 Task failed · archive/release |

Mars는 초기 FIFO 메시지 배치를 처리한 뒤 acknowledge하지 않아 후속 CJ·PD 지시를 제때 읽지 못했다. 16:49:52 KST PD가 전체 배치 읽기→처리→정확 deliveryId ack→다음 배치 절차와 요청을 재전달했다. 후속 검증 중에도 새 지시를 확인하기 전에 재촬영·전체 검증을 반복해17:42의93/0·137/0·blob29b9682 보고가 마지막 피포획자·저동작·HP 고정 지시를 충족하지 못했다. PD는 새 checkpoint 지정을 보류했고17:43:33 `msg_87229a3e89ba`에서 모든 배치를 읽고 남은 네 항목을 수신했다는 회신을 받았다. 초기73/0·92/0 및 중간137/0을 최신 요청 전체 완료 근거로 재사용하지 않는다.

**저장소 Git 쓰기 위반**: Mars는 17:10:23 KST `git add -N`, 17:10:32 `git reset -q --`를 실행했다. 두 명령의 대상은 `docs/milestone/v0.4.7/issues/122/Mars`, `docs/milestone/v0.4.7/issues/126/Mars`, `demo/test/milestone/v0.4.7/issues/122`, `demo/assets/leaders`, `tools/art/leaders_export.py`, `tools/art/test/test_leaders_export.py` 6개였다. 새 문서를 추적 파일 기반 링크 검사에 포함하려던 의도였으나 Worker Git 쓰기 금지 위반이다. PD는 실제 transcript·명령·시각을 대조했고, 이후 비어 있는 인덱스와 자신의15파일 커밋 직후 차이0을 확인했다. 관측된 파일 유실은 없으나 과거 모든 영향이 없었다는 입증은 아니다. 최초 Git 무수정 보고를 정정하고 Task 실패와 제품 QA를 구분한다. `reset --hard`나 작업 파일 내용 초기화는 관측되지 않았으며 추가 Git 복구를 Worker에게 시키지 않았다. 승인된 도구 테스트용 격리 Git fixture와는 별개다.

## 자료·자원 보존 및 검증 한계

Saturn이 보관한 정확한 제출 명령(재실행하지 않음):

```text
git hash-object demo/index.html; rg -n 'bslot|fxBanner.*flee|cap-other|cap-lose|cap.*lose|title:"??|storageSnapshot|banners.length' demo/index.html demo/test/milestone/v0.4.7/issues/122/issue122_rules.js; orca orchestration check --terminal term_2a22c8e3-7bf4-4f28-ac59-b409127b27c8 --json
```

18:00:27 KST heartbeat 한 번은 capability 복사 오타로 `The Dispatch capability is invalid.`가 반환됐다. worker_done이 아니었고, 주입 원문의 정확한 권한으로 후속 heartbeat가 성공했다. 재구성·우회 없이 정산했다.

Mars는 자기 생성 Chrome PID·프로필·릴레이·스크래치패드 fixture 잔존0을 최종 보고했다. 이 보고는 다른 Worker나 사용자 소유 자원의 정리를 증명하지 않는다.

**추가 검색 경계 예외(2026-09-10):** Saturn은 PowerShell에서 내장 큰따옴표가 있는 rg 패턴을 전달하다 명시한2파일 밖의 저장소 자료까지 검색 결과에 나타난 사실을 보고했다(`msg_c360c15f0ae5`, 17:40:57 KST). Mercury도 `rg -n 'stIcons\(|class="fighter|bslot|stText' demo/index.html` 호출 결과가 단일 지정 파일 외 여러 demo 파일을 포함했음을 확인했다. 두 경우 모두 의도한 파일 제한이 네이티브 인수 전달에서 유지되지 않았으며, 출력에 보호 루트의 내용은 나타나지 않았지만 해당 경로를 전혀 탐색하지 않았다는 입증은 할 수 없다. 이 경계 미입증을 정상 준수로 소급하지 않는다. 사후 입증을 위해 보호 경로를 다시 탐색하지 않으며 이후 정확한 LiteralPath 읽기나 내장 따옴표 없는 패턴·명시 파일을 사용한다. Saturn의 파일 무수정과 제품 QA 판정은 별도이며 Task는 절차 예외로 failed 정산했다. Mercury 자신의 검색 예외도 같은 기록에 남기고 Worker에게 전가하지 않는다.

- 사용자 소유 루트 `art/`·`orca-hook-latency-report.md`, Downloads 원본·승인 아트·Roblox 담당 자원을 읽거나 정리하지 않는다.
- Earth의 정확한 렌더 프로필 삭제가 자동 승인 검토에서 `blocked by policy`로 거부됐다. `docs/milestone/v0.4.7/issues/124/Earth/render-profile-ctx-b66017b5187b`, TEMP의 `earth-122-ctx-9425bcbe8546-render` 및 최초 러프 `.chrome-render/`를 보존하고 납품에서 제외했다. 거부를 우회하지 않았다. 자체 Chrome 종료 근거는 해당 Earth 보고를 따른다.
- PD의 임시 Orca 브라우저는 snapshot 연결 오류로 검증 근거가 없으며 자기 생성 page만 대조해 닫았다. 다른 자원은 종료하지 않았다.
- Chrome viewport·fixture 검증을 물리 휴대폰·실제 두 PC의 전체 플레이 QA로 확대하지 않는다. Roblox CI 성공은 이 작업의 Roblox 실플레이 QA가 아니다. CJ 아트·플레이 QA와 정식 배포 승인은 별도다.

## 별도 CJ 요청 — Roblox 필수 CI E

`E. Roblox 클라이언트·규칙 (Luau)`를 dev·main의 필수 검사에 추가했다. 기존5개와 strict=true·GitHub Actions app15368 및 나머지 보호 설정을 보존한 채 총6개를 재조회 확인했다. [#132 적용 기록](../../132/Mercury/required-checks.md) · [GitHub 기록](https://github.com/ChangjoSung/Digit-Duel/issues/132#issuecomment-5614971093) · GDD13 DL54. 의도적인 실패 PR의 병합 차단 실험까지 수행했다는 뜻은 아니다.
