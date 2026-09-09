# #105 README 미디어 — 튜토리얼 10단계 스크린샷 출처·검증 보고 (Mars_2)

작성: 2026-09-08 · 역할: Mars_2 (Client/TOOLING, IMPLEMENT) · 대상 Issue: #105 README 미디어·렌더 툴링 (Mars_1 의 #104 제품 코드와 독립)
개정: 2026-09-08 (2차) — Saturn_2 REVISE(msg_eedceca26c80, `docs/qa/issue105-saturn-media-first.md`) 반영. 0절에 이력을 남기고 본문은 현재 상태로 치환했다.
분류: **[확정]** = 도구 출력·git 객체로 검증된 사실 · **[추론]** = 근거 있는 판단 · **[미확정]** = 확인 불가 / [기획 필요]

## 0. 수정 이력 — Saturn_2 REVISE → Mars_2 수정 (이력 보존)

### 0.1 초기 REVISE (Saturn_2, 2026-09-08, 도구 sha256 `bb6d002bcd6f2c6c…`, 이 보고서 1차 sha256 `a429098546bed633…`)

| # | Saturn_2 지적 (1차 도구 기준 행) | 사실 여부 |
| --- | --- | --- |
| 1 | `captureTutorial` L117-118 이 `capture --read-only` 에서도 `%TEMP%\readme-media-src-*\index.html` 사본을 무조건 쓴다 | [확정] 맞음. 1차 보고서 2절도 이 사본을 "증빙용"으로 적어 READ_ONLY 0-쓰기 주장과 모순됐다 |
| 2 | `ghRenderMarkdown` L229 가 `verify --read-only` 에서도 `%TEMP%\readme-media-md-<pid>.json` 요청 본문 파일을 쓴다 | [확정] 맞음 |
| 3 | L254 `doRender=…&&!READ_ONLY` 로 READ_ONLY 에서 헤드리스 Chrome 렌더를 통째로 생략해 이미지 로드·갤러리·좁은 뷰포트를 허용 명령으로 재검증할 수 없다 | [확정] 맞음 |
| 추가 (PD msg_74d0b9c9cc86) | L279 gh 렌더 실패를 WARN 만 남기고 exit 0 · L170 재캡처 sha256 DIFF 를 크기만 같으면 exit 0 | [확정] 맞음 |

### 0.2 수정 (Mars_2, 2026-09-08, 도구 sha256 `79b2e7548986f9e494216d6fb584bc26e4fa8adac4ab1c6f2d0353c903ab9dc8`, 477줄)

| # | 수정 내용 | 근거 (현재 도구) |
| --- | --- | --- |
| 1 | 태그 HTML 디스크 사본 제거. `serveGitRef` 가 `git show <ref>:demo/*` 바이트를 메모리 캐시에서 그대로 서빙한다 (원래도 서버는 git 에서 읽었으므로 사본은 불필요했다) | `captureTutorial` — `RESOURCE tag-html … served=memory (no disk copy)` 행 |
| 2 | `gh api markdown --input -` 로 요청 본문을 stdin(`execFileSync` `input` 옵션)으로 전달. 임시 JSON 없음. `GH_NO_UPDATE_NOTIFIER=1` 로 gh 갱신 확인 상태 파일 쓰기도 막음 | `ghRenderMarkdown` |
| 3 | READ_ONLY 에서도 실제 헤드리스 Chrome 렌더 수행. GitHub sanitize HTML + 근사 CSS 페이지를 같은 127.0.0.1:0 서버가 `/__readme-render__.html` 로 메모리에서 서빙(디스크 사본 없음 — 쓰기 모드도 동일). 이미지 로드·링크·앵커·표별 내부 가로 스크롤·페이지 가로 넘침·섹션 클립·갤러리 펼침을 계산하고 캡처는 메모리에서 크기·sha256 만 stdout 에 남긴다 | `renderReadme`, `SHOT(memory) …` 행 |
| 3b | `verify --viewport WxH` 지원 (기본 1100x900). 1100 이 아니면 쓰기 모드 산출물 이름에 `-w<W>` 접미 | `cmdVerify` |
| 4 | gh 렌더 실패 = FAIL + 종료 코드 2 (`--no-gh` 를 명시하지 않은 verify 는 완전 검증을 주장하므로). `--no-gh`/`--no-render` 명시 시 요약 행에 "부분 검증" 표기 | `ENV_FAIL` |
| 5 | `capture --read-only` 재캡처 바이트 불일치 = 기본 FAIL(1). `--allow-hash-diff` 를 명시한 때만 CONDITIONAL(0) 로 낮추되 요약에 불일치 장수·"사람 검수 필요; 전체 PASS 아님" 을 명시 | `cmdCapture` 판정 행 |
| 6 | READ_ONLY 3중 보증 신설: ① 정적 자기 검사(`selfcheck`) — 소스의 모든 fs 변경 호출이 허용 지점(`writeArtifact`·`ensureDir`·`launchChrome`·`killChrome`) 안에만 있고 git/gh 자식 프로세스가 읽기 동사(show·rev-parse·config --get·api markdown)만 쓰는지 ② 런타임 게이트 — fs 변경 API 29종을 가로채 소유 Chrome 프로필(`%TEMP%\readme-media-profile-*`) 밖 쓰기는 예외(코드 3) ③ 실행 전후 관측 — README·docs/media·docs/qa/issue105-media·도구 파일의 크기·mtime·sha256 과 tmp `readme-media-*` 목록 비교(`WRITE-CHECK`) | 머리 주석 "READ_ONLY 보증", `installReadOnlyGate`, `selfcheck`, `snapshotFiles` |
| 7 | 프로필 정리는 절대 경로가 소유 목록·접두어와 정확히 일치할 때만 `rmSync` (다른 프로필·서버 8080 무관) | `killChrome` — `CLEANUP … owned=true removed=true` |
| 8 | 외부 관측 하네스 `tools/test/readme_media_readonly_test.js` 신설 (PD msg_cddd7a85f74b 로 Mars 소유 산출물 허용). 도구 내부 WRITE-CHECK 를 믿지 않고 독립 스냅샷으로 전후 비교 + 변조 사본 음성 대조(정적 검사·런타임 게이트·프로필 접두어·비 READ_ONLY 대조) | 4절 |

[확정] 수정하지 않은 것: `docs/media/tutorial-01..10.png`(10장 sha256 1차와 동일, 2절 표) · `docs/media/digit-duel-hero.png`(sha256 `3215151a1cf978b9…` 동일) · `docs/qa/issue105-media/capture-manifest.json`(sha256 `58ac5a270d59c260…` 동일 — 재생성은 PNG 재생성을 동반하므로 하지 않음. 그 안의 `env.url` 문구 "git show v0.4.3:demo/*" 는 1차 실행 기록으로 유효) · README.md · 제품 코드 · `demo/test/*`.

## 1. 결론 (요약)

- [확정] `docs/media/tutorial-01.png` ~ `tutorial-10.png` 10장은 **출시 태그 v0.4.3(main `cc3f382`)의 실제 `demo/index.html`** 을 헤드리스 Chrome(CDP)에서 렌더해 캡처한 것이다. 작업 중인 dev 의 미출시 튜토리얼 텍스트가 아니라 태그 blob(`dd4bc55`)에서 메모리로 서빙했다. 합성 HTML·이미지 생성 도구는 쓰지 않았다.
- [확정] 10장 모두 **동일 크기 2224×1096** (CSS 1112×548 클립 × DPR 2). 1단계는 첫 방문 자동 표시 화면이고 2~10단계는 실제 `다음 ▶` 버튼 클릭으로 이동한 상태다. 단계 카운터 `N / 10 단계` 와 제목이 `TUT_STEPS` 와 일치함을 도구가 확인했다.
- [확정] 2차 도구로 `capture --read-only` 를 다시 돌려 10장 모두 저장본과 **바이트 동일(sha256 10/10)** — 판정 PASS. 저장소 파일 쓰기 0, tmp 잔존 0 (하네스가 독립 관측).
- [확정] README 의 로컬 상대 이미지 13개 · 링크 19개 · 앵커 1개 전부 해석된다. GitHub 가 실제로 sanitize 한 HTML(`gh api markdown --input -`, 18,513 bytes, sha256 `7c21991c86c6de41…`) 기준 이미지 20개 중 탈락 0, `<script>` 0, `<details>` 갤러리는 펼친 상태에서 10/10 로드된다 — 1100×900 과 390×844 모두 READ_ONLY 로 실제 렌더해 확인.
- [확정] README 갤러리의 캡션·alt 10개가 캡처된 단계 제목과 모두 일치한다.
- [확정] 홍보 일러스트 `docs/media/digit-duel-hero.png` (Earth 납품)는 읽기만 했고 바이트를 바꾸지 않았다. 말판·전투 사진 2장은 새로 찍지 않고 v0.4.3 태그에 이미 들어 있는 QA 캡처를 그대로 재사용했다 (3절).
- README.md 는 수정하지 않았다 (현재 sha256 `85d993cd4e1790d4…` — PD 의 "전투를 치른 말은" 문구 수정 반영본. Saturn_1 편집 검수 시점의 `9e001eeea4849b9f…` 와 다른 것은 그 수정 때문이다).

## 2. 출처 (provenance)

| 항목 | 값 |
| --- | --- |
| 캡처 대상 ref | `v0.4.3` (annotated tag) → commit `cc3f382496473233334f374896d46639b83d7974` (main, "Merge pull request #97") |
| `demo/index.html` blob | `dd4bc556e1788755e0c23e793927bf3504acd66c` (228,842 bytes) |
| HTML 서빙 방식 | 127.0.0.1:0 임시 서버가 `/demo/*` 요청을 `git show v0.4.3:demo/<path>` 바이트로 **메모리에서** 응답 (2차부터 디스크 사본 없음). `demo/assets/minions/…` 상대경로가 출시 상태 그대로 동작. 종료 시 서버 close. 작업 트리 `demo/index.html`·stash 는 건드리지 않음 |
| 브라우저 | Google Chrome **152.0.7977.82** `--headless=new`, `--remote-debugging-port=0` (자동 할당), 이 실행 전용 프로필 `%TEMP%\readme-media-profile-*` (종료 시 그 경로만 삭제). UA `HeadlessChrome/152.0.0.0` |
| 실행 환경 | Node v24.16.0 · Windows 10 Pro 10.0.19045 · gh 2.94.0 · 외부 npm 패키지 없음 |
| 뷰포트 / DPR | CSS 1280×900, deviceScaleFactor 2 (→ `#tutBox` 최대폭 1080px 3~4열 레이아웃, `@media (min-width:600px)` 적용) |
| 튜토리얼 열기 | 새 프로필 = `localStorage.tutorialSeen` 없음 → 게임이 첫 방문 자동 표시(`tutOpen({auto:true})`). 도구가 강제로 여는 코드는 없다 |
| 단계 이동 | `#tutNav button.primary` (`다음 ▶`) 를 실제 `click()` → 2~10단계. `tutGo()` 직접 호출은 쓰지 않음 |
| 클립 | 10단계 `#tutBox` 실측 사각형의 합집합 + 여백 16px = CSS (84,176) 1112×548 → 모든 단계 동일 클립 → 2224×1096 px |
| 최초 캡처 시각 | 2026-09-08T05:51:11Z (KST 14:51) — 1차 도구. 2차 도구의 `capture --read-only` 재캡처(KST 15:0x) 가 바이트 동일 |
| 매니페스트 | `docs/qa/issue105-media/capture-manifest.json` (단계 제목·카드 수·박스 크기·sha256·환경) — 1차 그대로 |

### 캡처 결과 (10장)

| 파일 | 카운터 | 제목(렌더 텍스트) | 카드 | `#tutBox` CSS | PNG | bytes | sha256 앞 16 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `docs/media/tutorial-01.png` | 1 / 10 단계 | 🏆 이기는 법 세 가지 | 3 | 1080×414 | 2224×1096 | 127,603 | `108e819f986ccb0d…` |
| `docs/media/tutorial-02.png` | 2 / 10 단계 | 🎭 말 5가지와 숨은 정체 | 3 | 1080×471 | 2224×1096 | 132,227 | `6e22f119ce14b9e3…` |
| `docs/media/tutorial-03.png` | 3 / 10 단계 | 🌲 움직이기와 숲에 숨기 | 3 | 1080×431 | 2224×1096 | 140,301 | `2355f0d9527a2ed5…` |
| `docs/media/tutorial-04.png` | 4 / 10 단계 | 🔍 흔적과 탐색 | 4 | 1080×437 | 2224×1096 | 140,872 | `36abb371a3bc5809…` |
| `docs/media/tutorial-05.png` | 5 / 10 단계 | ⚔️ 옆에 붙으면 꼭 싸워요 | 3 | 1080×437 | 2224×1096 | 148,125 | `19b1ee47ad2f3ca6…` |
| `docs/media/tutorial-06.png` | 6 / 10 단계 | 💣 폭탄과 함정 | 3 | 1080×437 | 2224×1096 | 130,696 | `859020bec4c7536a…` |
| `docs/media/tutorial-07.png` | 7 / 10 단계 | 🔴 잡아오기와 도망치기 | 4 | 1080×437 | 2224×1096 | 149,579 | `4dbb655196c10557…` |
| `docs/media/tutorial-08.png` | 8 / 10 단계 | 🌀 텔레포트(순간이동) | 3 | 1080×466 | 2224×1096 | 145,712 | `09e087e9bf44fc41…` |
| `docs/media/tutorial-09.png` | 9 / 10 단계 | 🔥 버닝 타임(불타는 시간) | 3 | 1080×516 | 2224×1096 | 109,488 | `deb18b303ad031d9…` |
| `docs/media/tutorial-10.png` | 10 / 10 단계 | 🏁 빠른 복습 — 첫 차례 체크리스트 | 3 | 1080×413 | 2224×1096 | 122,340 | `24a19d5953261cdd…` |

전체 sha256 은 `verify-report.json` 의 `tutorial.files[]` 와 `capture-manifest.json` 의 `frames[]` 에 있다. 합계 1,346,943 bytes (10장).

[확정] 재현성: 2차 도구 `capture --read-only` 로 같은 절차를 다시 돌리면 10장 모두 **바이트 동일**(sha256 일치, 판정 PASS) — 같은 기기·같은 Chrome 152 기준. 다른 기기·버전에서는 폰트 래스터 차이로 바이트가 달라질 수 있다. 그 경우 도구는 기본 FAIL 로 끝나며, 원인이 환경 차이임을 확인한 사람만 `--allow-hash-diff` 로 크기·제목 일치 기준 CONDITIONAL 판정을 받을 수 있다 (전체 PASS 로 표기되지 않는다).

## 3. 재사용한 기존 이미지 (새 캡처 없음)

| README 위치 | 파일 | 출처 |
| --- | --- | --- |
| 게임 플레이 사진 · 플레이 화면 | `docs/qa/minion-art-integration/file_desktop-1280_3-board.png` (1280×800) | [확정] 커밋 `eff5c16` (#89, 2026-09-07) 에서 `demo/test/minion_art_cdp.js` 가 캡처. 그 커밋의 `demo/index.html` blob = v0.4.3 blob `dd4bc55` (동일). 작업 트리 파일의 git blob `032bac9` = `v0.4.3:` 동일 파일 blob → 태그에 그대로 포함된 출시 시점 캡처 |
| 게임 플레이 사진 · 전투 화면 | `docs/qa/minion-art-integration/file_desktop-1280_4-battle.png` (1280×800) | [확정] 위와 같음, blob `65be55e` = `v0.4.3:` 동일 |
| 상단 홍보 일러스트 | `docs/media/digit-duel-hero.png` (1672×941, 2,674,585 bytes) | [확정] Earth 납품(아트). sha256 `3215151a1cf978b90c8bd654b752c205fbd8a79b7a15188449ed4c4f49f33832` — 1차·Saturn_1·Saturn_2·2차 모두 동일. Mars_2 는 읽기만 함 |

[추론·공개 사항] 말판·전투 2장은 `minion_art_cdp.js` 의 `SETUP_PLAY`/`START_BATTLE` 이 만든 **연출 상태**다 (시드 4242 PVE 5급, 상대 하수인 1종 강제 공개, 인접 배치 후 `initBattle`). 코드는 출시 태그와 동일한 실제 렌더지만, 사람이 자연스럽게 플레이한 장면은 아니다. README 캡션("내 말과 공개된 상대 말은 아이콘으로…")과는 모순되지 않는다.

## 4. 사용 명령 (재현)

```
# 10단계 캡처 (docs/media/tutorial-01..10.png + capture-manifest.json 갱신) — 2차 세션에서는 실행하지 않음 (PNG 재생성 금지)
node tools/readme_media_capture.js capture --ref v0.4.3
# README 검증 + GitHub sanitize 렌더 + Chrome 캡처 → docs/qa/issue105-media/ (section-00..08.png · gallery-open.png · readme-gh-render.html · verify-report.json)
node tools/readme_media_capture.js verify
# 도구 소스 정적 자기 검사 (fs 변경 호출 위치 · 자식 프로세스 동사)
node tools/readme_media_capture.js selfcheck
```

옵션: `--viewport 1280x900 --dpr 2 --margin 16 --out docs/media --manifest <json>` (capture) · `--readme README.md --out docs/qa/issue105-media --viewport 1100x900 --no-gh --no-render --full` (verify) · `--chrome <chrome.exe>` 공통.

### Saturn 독립 QA — 파일을 쓰지 않는 검증 (READ_ONLY)

```
node tools/readme_media_capture.js verify  --read-only                      # 로컬 검사 + gh sanitize + 헤드리스 Chrome 실제 렌더(1100x900), stdout 만
node tools/readme_media_capture.js verify  --read-only --viewport 390x844   # 좁은 뷰포트 레이아웃 (표 내부 스크롤 vs 페이지 넘침 구분 보고)
node tools/readme_media_capture.js verify  --read-only --no-gh              # 네트워크 없이 로컬 검사만 (요약에 '부분 검증' 표기)
node tools/readme_media_capture.js capture --read-only                      # 태그에서 10단계 재캡처 → 저장본과 크기·sha256 비교 (바이트 불일치 = FAIL)
node tools/test/readme_media_readonly_test.js [--quick] [--no-gh]           # 외부 관측 하네스 (아래)
```

- [확정] 위 `--read-only` 실행은 저장소 파일을 하나도 만들거나 바꾸지 않는다. 유일한 부수 쓰기는 헤드리스 Chrome 이 쓰는 이 실행 전용 프로필 `%TEMP%\readme-media-profile-*` 하나이며 종료 시 그 정확한 경로만 삭제된다 (`RESOURCE`/`CLEANUP … owned=true removed=true` 행). 도구 자체가 실행 시작 시 `selfcheck` 를 돌리고 fs 게이트를 켠 뒤, 종료 시 `WRITE-CHECK` 행으로 감시 파일 26개 불변·tmp 잔존 0 을 보고한다. 위반 시 종료 코드 3.
- [확정] **하네스가 쓰는 파일**: `tools/test/readme_media_readonly_test.js` 는 저장소에는 쓰지 않지만, 음성 대조(변조 사본 3종 + STRAY.txt) 를 위해 `%TEMP%\rmc-negtest-*` 디렉터리 하나를 만들고 종료 시 삭제한다. 즉 Saturn 이 **도구만** 실행하면 Chrome 프로필 외 쓰기 0, **하네스** 를 실행하면 하네스 소유 tmp 경로 1개가 추가로 생성·삭제된다. 하네스 판정 항목: selfcheck 0 · 세 READ_ONLY 명령 각각 exit 0 + 독립 스냅샷(29개 파일: README·docs/media·docs/qa/issue105-media·tools/·demo/index.html) 불변 + tmp 잔존 0 + 자기 보고 + 프로필 정리 + 렌더 수행/갤러리 10/10 + 재캡처 바이트 동일 10/10 · 음성 A(정적 검사가 허용 지점 밖 `writeFileSync` 를 exit 3 으로 잡음) · 음성 B(정적 검사를 피한 `fs["write"+"FileSync"]` 를 런타임 게이트가 exit 3 으로 차단, STRAY.txt 미생성) · 음성 C(프로필 접두어가 아닌 동적 `mkdtemp` 차단, tmp 미생성) · 대조 D(`--read-only` 없이는 게이트가 없어 사본 루트에만 STRAY.txt 생성 — 게이트가 READ_ONLY 범위임을 확인).
- 종료 코드: 0 = 문제 없음 · 1 = 검증 실패 · 2 = 환경 오류(Chrome/git/gh 없음, gh 렌더 실패) · 3 = READ_ONLY 위반.
- 참고: `gh api markdown` 은 GitHub 의 렌더 전용 엔드포인트(POST /markdown)로 저장소 상태를 바꾸지 않는다. GitHub 쓰기(이슈·PR·커밋)는 이 도구에 없다 (selfcheck 가 git 쓰기 동사 0건을 확인).

## 5. README 검증 결과 (2차 도구, 2026-09-08 KST 15:1x)

| 검사 | 결과 |
| --- | --- |
| 로컬 상대 참조 (마크다운·HTML `src`/`href`) | 47개 참조 중 로컬 33개 **모두 OK** (파일 존재 + 대소문자 정확 일치). 외부 URL 14개는 오프라인 검사 대상 아님 |
| 앵커 `#게임-플레이-사진` | OK — H2 "게임 플레이 사진" 슬러그 일치 (마크다운 헤딩 9개 기준 및 렌더 헤딩 대조) |
| 튜토리얼 10장 크기 | OK — 전부 2224×1096 |
| 갤러리 캡션·alt ↔ 캡처 제목 | 10/10 OK (매니페스트 sha256 = 저장본 sha256 10/10) |
| GitHub sanitize 렌더 (`gh api markdown --input -`, context `ChangjoSung/Digit-Duel`) | 18,513 bytes (1차 보고서의 "13,620" 은 오기 — 저장된 `readme-gh-render.html` 은 1차부터 18,513 bytes) · `<img>` 20 · `<a>` 30 · `<details>` 1 · README 이미지 탈락 0 · `<script>` 0. `<p align>`·`<table>`·`<td width>`·`<details>/<summary>`·`<sub>`·`<code>` 모두 보존 |
| Chrome 렌더 **1100×900** (콘텐츠 폭 1012px) | 로컬 이미지 13/13 로드 · 로컬 링크 19/19 · 앵커 1/1 · 페이지 1100×4200, 가로 넘침 없음 · 표 3개 모두 내부 스크롤 없음 (플레이 사진 1×2 · 갤러리 2×5 · 게임 정보 10×2, 폭 948) |
| Chrome 렌더 **390×844** (READ_ONLY, padding 16px) | 로컬 이미지 13/13 · 링크 19/19 · 앵커 1/1 · 페이지 390×5528, **가로 넘침 없음**(scrollWidth 390) · 표 3개 폭 358, 내부 가로 스크롤 0 (표가 줄어들어 스크롤도 깨짐도 없음) · 갤러리 10/10 로드, 2행×5열, 썸네일 표시 폭 **44px** |
| 갤러리(펼침, 1100) | 10/10 로드, 썸네일 표시 폭 162px, 2행×5열 |
| 섹션 캡처 (쓰기 모드) | `section-00.png` 머리(H1·홍보 일러스트·배지) + `section-01..08.png` = 게임 소개 · 게임 기능 · 게임 플레이 사진 · 새로운 기능 · 게임 정보 · 플레이 방법 · 저장소 구조 · 라이선스 (H2 8개) · `gallery-open.png`. 2차 도구(메모리 페이지 서빙)의 캡처 10장은 1차 도구(디스크 사본 `file://`)의 저장본과 **sha256 전부 동일** — 렌더 경로 변경이 결과를 바꾸지 않았음 |

READ_ONLY 렌더 캡처는 저장하지 않고 stdout 에 크기·바이트·sha256 만 남긴다. 1100 에서 나온 메모리 캡처 sha256 앞 12자리 = 저장본과 동일 (`section-00` `d71c87aeea5c` … `gallery-open` `07e1657de913`).

## 6. 산출물 (모두 저장소 상대 경로)

| 경로 | 내용 | 2차 상태 |
| --- | --- | --- |
| `tools/readme_media_capture.js` | 캡처·검증 도구 (Node 22+ · Chrome · git · gh) | **수정** — sha256 `79b2e7548986f9e494216d6fb584bc26e4fa8adac4ab1c6f2d0353c903ab9dc8` (477줄) |
| `tools/test/readme_media_readonly_test.js` | READ_ONLY 외부 관측 하네스 | **신규** — sha256 `cd1663a0c34b4cf17b3b858a3b92c69da12f731f99bb866f24cc2c19738f5df3` (62줄) |
| `docs/qa/issue105-media.md` | 이 보고서 | **수정** (0절 이력 추가, 본문 치환) |
| `docs/qa/issue105-media/verify-report.json` | README 검증 보고 JSON (toolSha256·readmeSha256·viewport·표·넘침 요소·갤러리 필드 추가) | **갱신** — sha256 `de4f7fa49a4c2e02…` |
| `docs/qa/issue105-media/readme-gh-render.html` | GitHub 가 돌려준 sanitize HTML 원문 (증빙) | 재생성, 바이트 동일 `7c21991c86c6de41…` |
| `docs/qa/issue105-media/section-00.png` … `section-08.png` · `gallery-open.png` | README 렌더 섹션 캡처 9장 + 갤러리 펼침 | 재생성, 10장 모두 바이트 동일 |
| `docs/qa/issue105-media/capture-manifest.json` | 캡처 매니페스트 | 불변 `58ac5a270d59c260…` |
| `docs/media/tutorial-01.png` … `tutorial-10.png` | 튜토리얼 10단계 | 불변 (2절 sha256) |

건드리지 않은 것: `README.md` · `docs/releases/*.md` · `docs/qa/issue105-*.md`(PD·Saturn 문서) · `docs/media/digit-duel-hero.png` (Earth) · `demo/index.html` · `demo/test/*` (Saturn_1 QA 중 #104 동결) · `art/` · `orca-hook-latency-report.md` · `ASSET-LICENSE.md` · `docs/screenshots/` · git 상태 일체(stash 포함) · GitHub·Notion.

## 7. 한계·주의 (limitations)

- [확정] 갤러리 썸네일은 5열이라 GitHub 에서 약 162px(1100 뷰포트)·44px(390 뷰포트) 폭으로 표시된다. 그 크기에서 카드 본문 글자는 읽히지 않고, 클릭해서 원본(2224×1096)을 열어야 읽힌다. README 도 "이미지를 클릭하면 원본 크기로" 라고 안내한다. 2×5 콤팩트 미리보기는 PD 가 수용한 구성이며 이 보고는 레이아웃 재설계를 제안하지 않는다. 열 수 변경은 PD·Venus 판단 [기획 필요].
- [확정] 390px 에서 표 3개는 콘텐츠 폭(358px)에 맞게 줄어들어 내부 가로 스크롤도 페이지 넘침도 없다. 다른 README 에서 넘침이 생기면 도구는 "표 내부 가로 스크롤(INFO, 정상 동작)" 과 "페이지 가로 넘침(FAIL, 넘친 요소 목록)" 을 구분해 보고한다.
- [확정] 동일 클립을 쓰므로 박스가 낮은 단계(1·3·10단계 등)는 위아래 여백에 뒤 게임 메뉴 화면(`#000d` 오버레이 아래)이 흐리게 보인다. 실제 첫 실행 화면 그대로이며 합성하지 않았다.
- [확정] 텍스트·이모지 래스터는 캡처 기기의 Windows 폰트(Segoe UI Emoji 등)로 결정된다. README 독자는 PNG 를 보므로 결과는 고정이다.
- [추론] `gh api markdown` 은 github.com 이 표시 시점에 붙이는 헤딩 id(`user-content-…`)·GitHub 실제 CSS 를 포함하지 않는다. 도구는 GitHub 마크다운 CSS 를 **근사**한 스타일(콘텐츠 폭 1012px, 표 display:block+overflow:auto, `td[width]` 표는 display:table 100%, 768px 미만 padding 16px, word-wrap)로 렌더하므로 렌더 결과는 **sanitize 결과·레이아웃·이미지·링크 해석 검증용**이지 github.com 과 픽셀 동일하지 않다. 앵커는 헤딩 텍스트 슬러그 대조로 판정했다.
- [확정] README 의 배지(shields.io → camo) 7개는 캡처 시 네트워크가 있어 로드됐다. 오프라인에서는 미로드가 정상이며 검사 실패로 치지 않는다.
- [확정] 도구는 GitHub 에 쓰지 않는다. 문서에 "인터랙티브 JS README" 주장은 없고 README 는 정적 HTML·마크다운만 쓴다.
- [확정] READ_ONLY 게이트는 이 Node 프로세스의 `fs` API 만 가로챈다. 자식 프로세스(git·gh·Chrome)의 쓰기는 게이트가 아니라 ① 읽기 전용 동사 제한(selfcheck) ② `GH_NO_UPDATE_NOTIFIER=1` ③ Chrome `--user-data-dir` 을 소유 프로필로 고정 ④ 전후 스냅샷·tmp 목록 관측으로 다룬다. 저장소 밖 임의 경로에 대한 자식 프로세스 쓰기를 완전히 증명하지는 않는다.
- [미확정] `docs/media/digit-duel-hero.png` 가 Earth 납품 원본과 바이트 동일한지는 git 미추적 상태라 이 세션에서 증명할 수 없다 — sha256 만 기록했고 1차·2차·Saturn 두 검수 모두 같은 값이다.

## 8. PD 전달 사항

- README 에 깨진 HTML·깨진 링크는 없었다. 수정 요청 없음.
- Saturn 재검증 권고 명령: 4절 READ_ONLY 다섯 줄. 하네스는 `%TEMP%\rmc-negtest-*` 하나를 만들고 지운다(4절 명시). Saturn 금지 경로(쓰기 모드 verify/capture) 는 실행하지 않아도 `--read-only` 가 같은 렌더·재캡처를 메모리에서 수행한다.
- 스테이징 시 6절 "수정·신규·갱신" 4개(`tools/readme_media_capture.js` · `tools/test/readme_media_readonly_test.js` · `docs/qa/issue105-media.md` · `docs/qa/issue105-media/verify-report.json`) 와 1차 산출물(PNG·매니페스트·gh-render.html·section/gallery PNG) 을 담으면 된다. 재생성된 렌더 PNG·HTML 은 바이트 동일이라 diff 가 없다.
- 라이선스: `docs/media/` 튜토리얼 PNG 는 README 라이선스 절의 "렌더링된 게임 화면(`docs/media/`의 이미지)" 범위에 이미 포함된다. `ASSET-LICENSE.md` 갱신은 PD 소관.
- 이후 릴리스에서 튜토리얼 문구가 바뀌면 `capture --ref vX.Y.Z` 로 재생성하고 `verify` 로 캡션 일치를 다시 확인하면 된다.
