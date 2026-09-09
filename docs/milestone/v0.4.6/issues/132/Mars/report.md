# Issue #132 — HTML 데모 GitHub Actions 도입 (Mars)

- 역할: **Mars** (`required_role=Mars · mode=IMPLEMENT · area=TOOLING · mutation=code · instance_index=null · provider=Claude`)
- Task: `task_4fb17d1c8071`(1차 분석) → **`task_f6ae75f09f6c`(2차 구현, dispatch `ctx_16166abbf5df`)**
- 브랜치 `infra/132-docs-actions` · 기준 `dev 39f022293008d352e4709762af07e42d63fb557e`
- 작성: 2026-09-09
- 표기: **[확정]** 명령·파일로 실측 / **[추론]** 근거 있는 판단 / **[미확정]** 확인하지 못함 / **[기획 필요]** 기획 결정 대상

> **범위 선언**: 제품 `demo/index.html` blob `61a3ce3e5927697ea80ec8ebd379ffb98ebfdb92` 은 **변경하지 않았다**(`git status --porcelain -- demo/index.html` → 0행). `server/` 런타임(`server.js`·`security.js`·`package.json`·`package-lock.json`) 0행 변경. `demo/assets/` 바이너리 0바이트 변경. Git·GitHub·Notion 쓰기 없음. `.gitattributes`·루트 `README.md`·`CLAUDE.md`·`docs/**`(이 보고서 제외)는 내 소관이 아니며 건드리지 않았다 — 작업 중 관측된 그 파일들의 변경은 **동시에 진행된 Venus/PD 세션의 것**이다.
>
> **보호 경로 접근 범위 — 정정 (2026-09-09, PD 지적 반영)**: 이 보고서는 1부(사전 분석)와 2·3부(구현)를 함께 담으므로 범위를 시기별로 나눠 적는다.
> - **1부(사전 분석) 예외 [확정]**: 저장소 규모를 재려고 `du -sh --exclude=.git .` 를 실행했고, 이 집계는 **보호 경로(`art/` 등)의 메타데이터를 포함**했다. 사용자·Issue #132·DL39·스냅샷에 이미 기록된 사실이며 여기에도 명시한다. 내용을 읽거나 변경한 관측은 없다.
> - **2·3부(구현 Task) [확정]**: 보호 경로에 대한 접근·탐색·전체 폴더 크기 검색을 하지 않았다. 1부의 예외를 구현 Task 의 준수 주장으로 확장하지 않는다.
> - 따라서 "`art/` 를 열지도 탐색하지도 않았다"는 **전체 범위 단정은 철회**하고, 위와 같이 시기·행위별로 구분한다.
>
> **Saturn 판정 없음**: 아래 결과는 전부 Mars 자체 실행이다. Saturn 독립 QA 는 아직 수행되지 않았고 PASS 를 주장하지 않는다.

---

# 1부 — 사전 분석 (task_4fb17d1c8071)

## 1-1. 출발점 [확정]

| 항목 | 관측 | 근거 |
|---|---|---|
| CI 인프라 | `.github/` 디렉터리 **부재**, 원격 워크플로 0개 | `ls .github` · `gh api repos/:owner/:repo/actions/workflows` → `total_count 0` |
| 저장소 공개 범위 | **PUBLIC** (CLAUDE.md 는 당시 private 전제) | `gh repo view --json visibility` |
| 보호 설정 | `main` 보호 없음, ruleset 0개 | `branches/main/protection` → 404 · `rulesets` → 0 |
| 히스토리 규모 | 커밋 84개 · `.git` 43MB | `git rev-list --count HEAD` |

→ 공개 저장소라 **GitHub-hosted 러너 사용료 0원**이고 branch protection 도 무료로 가능하다. 이 발견은 PD 가 채택해 `CLAUDE.md` "보호" 조항이 2026-09-09 갱신됐다(현재 49행).

## 1-2. 테스트 인벤토리 — 의존성 4계층 [확정]

`git ls-files` 기준 JS 34개 + Python 1개. **분류 기준은 실행에 무엇이 필요한가다.**

**계층 1 — 순수 헤드리스 (외부 의존 0)**: `demo/test/harness.js`(294줄)가 `demo/index.html` 의 `<script>` 를 DOM·location·WebSocket·Storage 스텁 위에서 `eval` 한다. 외부 패키지·브라우저·네트워크·git 모두 불필요.
`smoke_cycle5` · `smoke_turnflow` · `smoke_turnflow_timers` · `smoke_memo` · `smoke_own_side` · `smoke_online` · `smoke_online_sync` · `smoke_testclient` · `smoke_minion_art` · `smoke_issue114` · `smoke_tutorial`

**계층 2 — git 히스토리 필요 (기준판 대조)**

| 파일 | 고정 ref | 도달성 | 위치 |
|---|---|---|---|
| `smoke_cross_skill.js` | `d614392` (`BASE_REF` 로 override) | ancestor-of-HEAD ✅ | `:363` |
| `shock_compare.js` | `dadc8bc` (`--base`) | ✅ | `:13` |
| `smoke_orientation_audit.js` | `6baa0b5` (`--ref`/`--path`/`--stdin`) | ✅ | `:38` |

→ **`fetch-depth: 0` 필수.** 얕은 클론이면 `git show d614392:demo/index.html` 이 실패해 K0 가 무조건 red.

**계층 3 — 실 Chrome(CDP) 필요**: `issue91/92/93/95/96/104/106/114_cdp.js`, `issue106_browser_audit.js`, `memo_cdp.js`, `minion_art_cdp.js`, `orientation_audit_cdp.js`, `tut_layout_cdp.js` — 13개. 공통 규격: Node 22+ · 종료코드 `0/1/2` · Chrome 탐색이 이미 크로스플랫폼(`issue91_cdp.js:20` 에 `/usr/bin/google-chrome` 포함).

**계층 4 — 게이트가 아닌 리포트 생성기** ⚠️: `ai_compare.js`(58줄), `attack_balance_compare.js`(127줄) — **`process.exit` 도 어서션도 없다**(`grep -o "process\.exit"` 결과 공백). 항상 exit 0 이므로 CI 에 넣으면 영구 green 인 공허한 잡이 된다. **제외 확정.**

## 1-3. 구식 기대를 고정한 테스트 [확정 — 라인 인용]

| # | 위치 | 고정된 기대 | 판정 |
|---|---|---|---|
| L1 | `smoke_orientation_audit.js:38` | **기본 소스가 작업 트리가 아니라 `git show 6baa0b5:demo/index.html`**. 주석: *"작업 트리의 demo/index.html 은 병렬 작업(#106) 중이라 기본으로 읽지 않는다"* | **CI 에 인자 없이 넣으면 PR 내용과 무관하게 영구 green.** → `--path demo/index.html` 강제 |
| L2 | `smoke_shock.js:46,189` | `BAL.shockProb===0.5` | v0.4.5 출시 계약 — **유지** |
| L3 | `smoke_attack_balance.js:34` | `dmgVar 0.2 · statusProb 0.7 · advMult 1.3 · disMult 0.75 · maxRounds 6` | 유지 |
| L4 | `smoke_tutorial.js:42-43` | `enemyCapProb .7 · fleeProb .5 · enemyCapHp 70 · captured.hp 100 · teleMax Infinity` + 튜토리얼 문구 정규식 | 유지 |
| L5 | `shock_compare.js` | `dadc8bc` 대비 before/after 비교인데 `exit(1)` 보유 | 리포트 도구 — **CI 제외** |

**[PD 결정 2026-09-09]** L2~L4 는 **출시된 v0.4.5 를 정확히 기술하므로 문제가 아니다.** 미래 Issues 119–131 이 이 값을 바꿀 예정이라는 사실만으로 지금 약화하지 않는다. 승인된 기획 변경이 오면 **같은 PR 에서 이 단언들을 갱신**한다. 이 보고서는 그 결정을 그대로 따랐다 — 어떤 기존 단언도 완화하지 않았다.

**반례(좋은 설계) [확정]**: `smoke_cycle5.js:8` 은 `BAL.dmgVar=0; statusProb=1; shockProb=1` 로 스스로 상수를 고정해 밸런스 변경에 영향받지 않는다. `smoke_cross_skill.js:370-380` 은 `typeof T.healTick==="function"` · `T.pushResolve` 로 기능을 탐지해 대조 강도를 조절한다.

## 1-4. 공식 출처 확인 [확정 — 2026-09-09 조회]

**액션 SHA** — `gh api repos/<repo>/releases/latest` 로 태그를 얻고 `gh api repos/<repo>/git/ref/tags/<tag>` 로 커밋 SHA 를 확인했다(전부 `type: commit`).

**이번 워크플로가 실제로 사용하는 액션은 아래 3개뿐이다** (`grep -oE 'uses: [^ ]+' .github/workflows/ci.yml` 로 확인):

| 액션 | 태그 | full commit SHA |
|---|---|---|
| `actions/checkout` | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/setup-python` | v7.0.0 | `5fda3b95a4ea91299a34e894583c3862153e4b97` |

> **미사용**: `actions/upload-artifact` v7.0.1 (`043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`) 는 분석 단계에서 **조회만 했고 `ci.yml` 에 넣지 않았다**(`grep -c upload-artifact .github/workflows/ci.yml` → 0). 후속 브라우저 스모크 잡(2-7)을 만들 때 쓰일 후보일 뿐이며, 현재 사용 액션으로 세면 안 된다.

**Node LTS** — `nodejs/Release` 의 `schedule.json` 원문:

| 버전 | 상태(2026-09-09) | EOL |
|---|---|---|
| 20 | **이미 EOL** | 2026-04-30 |
| 22 (Jod) | Maintenance LTS | 2027-04-30 |
| **24 (Krypton)** | **Active LTS** | 2028-04-30 |
| 26 | LTS 진입 2026-10-28 (아직 아님) | — |

→ **Node 24 채택.** Node 20 은 EOL 이라 사용하지 않는다.

**러너 라벨** — `actions/runner-images` README 로 `ubuntu-24.04`·`windows-2025` 가 유효 라벨임을 확인. `ubuntu-24.04` 이미지에 Google Chrome 152 · Node 22.23.2 · Python 3.12.3 · gh 2.98 사전 설치.

**보안 지침** — `docs.github.com/en/actions/reference/security/secure-use`: SHA 고정이 *"the only way to use an action as an immutable release"* · `pull_request_target` 은 privileged 이며 *"must not explicitly check out untrusted code, including from pull request forks"* · GITHUB_TOKEN 기본 권한을 contents read 로 낮출 것.

## 1-5. 브라우저 스모크를 1차 범위에서 제외한 근거 [추론]

기술적으로는 가능하다(Chrome 사전 설치 + 탐색 경로에 Linux 포함). 그러나 ① CDP 테스트는 `--lang=ko-KR` 로 띄우고(`issue91_cdp.js:93`) `tut_layout_cdp.js` 는 *"잘림/겹침/넘침"* 이라는 **텍스트 기하**를 판정한다 — 러너의 한글 폰트 구성이 다르면 거짓 red 가 난다. ② `readme_media_capture.js:22` 가 *"같은 기기·같은 Chrome 이면 동일해야 한다"* 고 명시하듯 바이트 해시 대조는 기기 종속이다. ③ 스크린샷 픽스처가 계속 쌓여 저장소가 부푼다. → **`workflow_dispatch` 수동 잡으로 후속 검토.** 이번 워크플로에는 넣지 않았다.

---

# 2부 — 구현 결과 (task_f6ae75f09f6c)

## 2-1. 변경·추가 파일

### 신규 (5)
| 파일 | 목적 |
|---|---|
| `.github/workflows/ci.yml` | 잡 A·B·B2·C·D |
| `demo/test/smoke_ai_completion.js` | **AI vs AI 완주 게이트** (신규 요구) |
| `tools/docs_link_check.js` | **문서 링크·이미지 무결성 검사기** (신규 요구) |
| `tools/test/docs_link_check_test.js` | 위 검사기의 회귀 — 음성 대조 + 종료 코드 전파 |
| `tools/requirements-art.txt` | Python 의존성 고정 (`Pillow==12.3.0`) |

### 수정 — 문서 이동 대응 (M-1 · M-3, Venus 분석 5장 "[Mars 소관]")
| 파일 | 변경 |
|---|---|
| `tools/minion_art.py` | 상수 4개 → `REL_ART_BASE` 1개 + 파생 4개, docstring 경로 4행 |
| `tests/test_minion_art.py` | 기대 키 문자열 5건 (461·462·510·517·525) |
| `demo/test/smoke_minion_art.js` | 매니페스트 경로 1건 (`:275`) |
| CDP 도구 12개 + `tools/readme_media_capture.js` + `tools/test/readme_media_readonly_test.js` | 기본 `--out`·`--manifest`·WATCH 경로 22행 |

**M-1 안전성 검증 [확정]**: `tools/minion_art.py` 의 `git_blob(BATTLE_BASELINE_COMMIT, …)` 호출 3곳(`:382 :615 :637 :720`)이 **전부 `REL_ASSETS`(`demo/assets/minions`)만 사용**함을 `grep -n "REL_PIXEL_SOURCES\|REL_BATTLE_PATCHES\|REL_REVIEW\|REL_MANIFEST\|REL_ASSETS"` 로 확인했다. 이동한 네 상수는 작업 트리 읽기·쓰기에만 쓰인다. 따라서 **"새 경로를 옛 커밋에 조회해 실패하는" 함정은 없다** — 가정하지 않고 확인했다.

**이동 전 대기 계약 준수**: 착수 시점에는 경로를 바꾸지 않았다. 작업 중 Venus/PD 세션이 **같은 작업 트리에서** 이동을 집행(306건 staged rename, `docs/milestone/MOVES.csv` 의 사유 문자열 `"Issue132 승인"`)한 것을 관측한 뒤에야 M-1·M-3 을 적용했다. `docs/media`·`docs/screenshots` 는 손대지 않았다.

## 2-2. 워크플로 설계

| 항목 | 값 | 근거 |
|---|---|---|
| 트리거 | `pull_request` [main, dev] · `push` [main, dev] · `workflow_dispatch` | PD 지시 |
| 권한 | 최상위 `permissions: contents: read` 하나 | least-privilege |
| secret | **0개** — 모든 잡이 secret 없이 성립 | `--no-gh` 로 gh 렌더 미사용 |
| `pull_request_target`·`workflow_run` | **미사용** | 신뢰할 수 없는 코드 × secret 통로 차단 |
| 체크아웃 | 전 잡 `persist-credentials: false`, A·C·D 는 `fetch-depth: 0` | 토큰 잔존 방지 / 기준판·baseline 커밋 조회 |
| 동시성 | `group: workflow-ref`, `cancel-in-progress: PR 일 때만` | 대체된 PR 실행만 취소, main·dev push 이력은 보존 |
| 타임아웃 | A 20 · B 10 · B2 10 · C 10 · D 15 분 | 기본 360분 방치 방지 |
| 액션 고정 | 전부 full SHA + `# vX.Y.Z` 주석 | 위 1-4 표 |

**잡 B2(Windows) 를 둔 이유 [확정]**: `server/test-launcher.js:23-26` 이 `process.platform !== 'win32'` 이면 `SKIP` 후 `exit(0)` 한다. 즉 Linux 잡에서는 **한 건도 검증하지 않는다**. 배치 실행기의 인자 무시·모드 고정·주입 방지·종료 코드 전파 계약(71개 검사)을 실제로 확인하려면 Windows 러너가 필요하다. PD 가 제시한 "Linux 에서 충분히 정적이면 생략" 조건에 해당하지 않는다 — 정적이 아니라 **전무**하다.

## 2-3. AI vs AI 완주 게이트 (`smoke_ai_completion.js`)

`ai_compare.js` 는 어서션도 `process.exit` 도 없어 게이트가 될 수 없으므로 신규 작성했다. **하네스(`H.runSim`·`H.invariants`)를 재사용**하고 규칙 로직을 다시 구현하지 않았다.

검사 축 — **밸런스 수치(기대 승자·턴 수)는 일절 고정하지 않는다**:
- **A 완주**: 고정 시드·스텝 예산(`cap=300000`) 안에서 `phase==="over"`, 그리고 `steps<cap`(예산에 닿아 잘린 게 아님)
- **B 불변식**: 진행 중 주기 검사(`check:25`) + 종료 시점 위반 0 (겹침·보드 밖·HP 범위·`battlesUsed`·텔레포트·지표 이중집계)
- **C 종료 적법**: `winner ∈ {0,1,null}` · `winType ∈ {king,wipe,edge,draw}` (`demo/index.html` 의 `gameOver` 호출 지점 전수) · `winner===null ⟺ winType==="draw"`
- **D 지표 정합**: 모든 `PLAYER_METRIC_KEYS` 에서 `byPlayer[0]+byPlayer[1] === total`
- **E 결정론**: 같은 시드 2회가 승자·턴·유형·지표 스냅샷까지 완전 일치 — **5급×5급 한정**
- **F 비공허**: 스위트 전체에서 전투·탐색 발생 + 모든 판이 턴 진행 (0수 즉시 종료로 A~D 가 공허 통과하는 것 방지)

**E 를 5급으로 한정한 근거 [확정, 제품 소스]**: 5단 주 판단 `aiMainStrong` 이 `demo/index.html:2773` 에서 `deadline=Date.now()+BAL.aiStrongBudgetMs` 를 잡고 `:2847`·`:2767`(`aiWorstReply`)에서 **실제 시각으로 탐색을 잘라낸다**. 5단이 끼면 결과가 기기 속도에 의존한다. 5급(`aiMain`)에는 그 마감이 없다. 따라서 5단 조합에는 A~D 만 요구한다 — 검사를 약화한 게 아니라 **제품의 시간 예산 설계에 맞춰 시간 비의존 성질만 단언**한 것이다.

**음성 대조 [확정 — 게이트가 실제로 잡는지 증명]**: 메모리 변형본(파일 쓰기 0)으로 확인:

| 변형 | 결과 |
|---|---|
| `met()` 의 byPlayer 증가 제거 (지표 이중집계 깨기) | **B 실패**(`t6 지표 이중집계 불일치 searches 0+0!=1`) · **D 실패** |
| `winType` 을 규격 밖 `"bogus"` 로 오염 | **C 실패** |
| `checkWipe` 무력화 | A·B·C·D 통과 — **정상**(왕·edge·draw 등 다른 승리 조건이 남아 완주는 유지된다. 이 변형은 A 의 음성 대조로 부적합함을 확인) |

실행 실적: 13판(5급×5급 4시드 ×2회 + 5단 조합 5판), 네 가지 `winType`(king·wipe·edge·draw) 모두 실제로 발생, 2.3초.

## 2-4. 문서 링크 검사기 (`tools/docs_link_check.js`)

**검사**: 추적 중인 `*.md` 의 Markdown 인라인 링크·이미지, 참조 정의(`[id]: 경로`), 문서에 박힌 HTML `<a href>`·`<img src>`(루트 README 가 실제로 쓰는 형태).
**판정**: 대상 없음 / **대소문자 불일치** / 저장소 밖 참조(traversal).

- **대소문자**: Windows·macOS 는 대소문자를 구분하지 않아 `fs.existsSync` 로는 Linux·github.com 에서 깨질 링크를 못 잡는다. 그래서 경로를 세그먼트로 쪼개 `readdirSync` 목록과 **정확히** 대조한다.
- **오탐 방지**: 외부 URL·스킴·프로토콜 상대·순수 앵커는 제외. **코드 펜스와 인라인 코드를 같은 길이의 공백으로 마스킹**해(행 번호 보존) `` `git show d614392:demo/index.html` `` 같은 **역사적 명령문**이 링크로 오인되지 않게 했다.
- **검사하지 않는 것(의도적)**: JSON·CSV 안의 경로 문자열(`capture-manifest.json`·`delivery-manifest.csv`)은 **납품 시점 출처 기록**이라 바이트를 보존해야 하며, 현재 트리에 없다는 것이 링크 실패가 아니다. 독립 `.html`(과거 렌더 산출물·외부 사본)도 대상이 아니다.
- **보호 대상 미traversal [확정]**: 대상 열거를 `git ls-files` 로만 하므로 추적되지 않은 `art/`·`orca-hook-latency-report.md` 는 **애초에 스캔 대상이 아니다**. 회귀 테스트로도 확인(아래).

**회귀 (`tools/test/docs_link_check_test.js`, 20개 검사)** — 픽스처는 전부 `os.tmpdir()` 아래 `ddlc-fixture-*` 임시 git 저장소에만 만든다. **저장소를 일부러 깨뜨려 PR 을 red 로 만드는 방식은 쓰지 않았다.**

| 축 | 검사 |
|---|---|
| 정상 | 오탐 없이 exit 0, 링크를 실제로 셈 |
| 음성 대조 | 대상 없음 → exit 1 · 대소문자 불일치 → exit 1 + 실제 이름 보고 · 저장소 밖 참조 → exit 1 · HTML `href`/`src` 깨짐 2건 집계 |
| 오탐 방지 | 외부 URL·앵커·mailto·프로토콜 상대·`문서.md#앵커`·인라인 코드·코드 펜스 → exit 0 |
| 보호 | 추적되지 않은 `.md` 는 문서 수에 포함되지 않음 |
| **종료 코드 전파** | git 저장소 아님 → exit 2 · **크래시 헬퍼 → 0 아님** · **무응답 헬퍼 → 타임아웃 강제 종료가 성공으로 집계되지 않음**(`killed===true`) |

**정리 안전장치 [확정]**: 삭제 전에 ① `os.tmpdir()` 하위인지 ② 이름이 `ddlc-fixture-` 접두사인지 ③ 실재 디렉터리인지를 **모두** 확인하고, 하나라도 어긋나면 지우지 않고 실패로 집계한다. 실행 시 소유 픽스처 10개가 전부 `CLEANUP 삭제` 로 회수됐다.

## 2-5. 실제 실행 결과 [확정 — 로컬 Windows, Node 24.16.0 / Python 3.14.3 / Pillow 12.3.0]

**suite(명령) 수와 assertion 수는 다른 값이다.** 아래는 명령 단위 exit code 와, 각 명령이 스스로 출력한 어서션 수다.

### 잡 A — 규칙 회귀·AI 완주 (16 suite, 전부 exit 0, 합계 26.5초)

| 명령 | exit | 시간 | 어서션 |
|---|---|---|---|
| `node demo/test/smoke_cycle5.js` | 0 | 6.5s | pass 69 / fail 0 |
| `node demo/test/smoke_turnflow.js` | 0 | 0.1s | pass 199 / fail 0 |
| `node demo/test/smoke_turnflow_timers.js` | 0 | 3.3s | pass 36 / fail 0 |
| `node demo/test/smoke_memo.js` | 0 | 0.2s | pass 122 / fail 0 |
| `node demo/test/smoke_own_side.js` | 0 | 0.1s | pass 66 / fail 0 |
| `node demo/test/smoke_online.js` | 0 | 0.4s | pass 157 / fail 0 |
| `node demo/test/smoke_online_sync.js` | 0 | 3.5s | pass 23 / fail 0 |
| `node demo/test/smoke_testclient.js` | 0 | 0.0s | pass 41 / fail 0 |
| `node demo/test/smoke_minion_art.js` | 0 | 0.2s | pass 199 / fail 0 |
| `node demo/test/smoke_issue114.js` | 0 | 1.1s | **16 groups**(어서션 아님, `assert/strict` 그룹) |
| `node demo/test/smoke_tutorial.js` | 0 | 0.3s | pass 124 / fail 0 |
| `node demo/test/smoke_attack_balance.js` | 0 | 0.6s | pass 50 / fail 0 |
| `node demo/test/smoke_shock.js` | 0 | 0.5s | pass 65 / fail 0 |
| `node demo/test/smoke_cross_skill.js` | 0 | 2.5s | pass 116 / fail 0 |
| `node demo/test/smoke_orientation_audit.js --path demo/index.html` | 0 | 4.9s | pass **8908~8920** / fail 0 (아래 한계 참조) |
| `node demo/test/smoke_ai_completion.js` | 0 | 2.3s | pass 59 / fail 0 |

어서션 합계(방향 감사 제외) **1,326** + 방향 감사 약 8,910 + `smoke_issue114` 16 그룹.

### 잡 B / B2 — 서버 (4 suite, 전부 exit 0)

| 명령 | exit | 시간 | 결과 |
|---|---|---|---|
| `npm ci` (server/) | **미실행** | — | 워크플로에는 넣었으나 **로컬에서 실행하지 않았다**(`server/node_modules` 가 이미 있어 clean install 을 재현하지 않음). 아래 "실행한 명령" 집계에 포함되지 않는다 |
| `npm test` (server/) | 0 | — | 4개 스크립트 모두 통과 |
| `node test.js` | 0 | 0.1s | `ALL TESTS PASSED` |
| `node test-security.js` | 0 | 0.1s | `ALL SECURITY TESTS PASSED` |
| `node test-config.js` | 0 | 0.6s | `ALL CONFIG TESTS PASSED` |
| `node test-launcher.js` (Windows 네이티브) | 0 | 3.5s | **71개 검사** 통과 |

### 잡 C — 문서 무결성 (5 suite, 전부 exit 0)

| 명령 | exit | 결과 |
|---|---|---|
| `node tools/test/docs_link_check_test.js` | 0 | **34개 검사** 통과(REVISE 후), 픽스처 전량 회수 |
| `node tools/docs_link_check.js --verbose` | 0 | 문서 **106개** · 내부 링크 **332건** 검사 · 외부/앵커/코드 117건 제외 · **문제 0건** (신규 문서 stage 후 전수) |
| `node tools/readme_media_capture.js selfcheck` | 0 | `=== selfcheck: OK` |
| `node tools/readme_media_capture.js verify --read-only --no-gh --no-render` | 0 | 문제 0건 · artifact 쓰기 0 · WRITE-CHECK OK(감시 26파일 불변) |
| `node tools/test/readme_media_readonly_test.js --quick --no-gh` | 0 | **17개 PASS**, 음성 대조 A·B·C 포함 |

### 잡 D — 납품 자산 무결성 (2 suite, 전부 exit 0)

| 명령 | exit | 결과 |
|---|---|---|
| `python tools/minion_art.py --all --check --no-preview` | 0 | **write=0** unchanged=29 mismatch=0 missing=0 warn=0 |
| `python -m unittest discover -s tests -v` | 0 | **68 tests**, OK, 13.8s |

**승인 자산 재생성 없음 [확정]**: `--check` 는 덮어쓰지 않고 일치만 본다. 출력 `write=0` 과 `git status --porcelain -- demo/assets` 로 바이너리 0바이트 변경을 확인했다.

## 2-6. 한계·미확정 — 주장하지 않는 것

1. **[미확정] Linux 실행 결과.** 위 실적은 전부 **Windows 로컬**이다. ubuntu-24.04 러너에서의 결과는 실제 CI 실행 전까지 알 수 없다. 특히 **Pillow 의 Linux 렌더·폰트 바이트 동일성은 주장하지 않는다** — 그래서 잡 D 에서 `--no-preview` 로 **글자를 그리는 미리보기 시트를 아예 제외**했다. 아이콘·전투 PNG 는 픽셀 데이터에서 굽고 글꼴을 쓰지 않아 결정적이라는 것이 근거다(`tools/minion_art.py` 의 `ImageDraw.text` 호출은 전부 미리보기 시트 경로에만 있다: `:444 :448 :467 :492 :522` 등).
2. **[확정] `smoke_orientation_audit.js` 의 어서션 수는 실행마다 다르다.** 같은 `--path`, 제품 blob 불변인데도 9회 관측에서 `pass 8908~8920`, `steps 3685~3693`, `skipped 426~594` 로 변동했다. **`fail` 은 9회 모두 0.** 원인은 **[미확정]** — 감사 파일 자체에는 `Date.now`·`Math.random` 이 없고 LCG 시드는 고정이므로, 변동은 제품 쪽 시간 의존 경로에서 오는 것으로 **[추론]** 한다. **이것은 내가 만든 것이 아니라 기존 테스트의 성질이며, 고치지 않았다**(기존 테스트 수정은 내 판단으로 할 일이 아니다). CI 게이트는 exit code 라 현재는 통과하지만, **이 감사는 매 실행 같은 범위를 덮지 않는다**는 점과 잠재적 flake 가능성을 Saturn 검토 항목으로 올린다.
3. **[미확정] `npm ci` 네트워크 동작.** 로컬에는 `server/node_modules` 가 이미 있어 CI 의 clean install 을 재현하지 않았다.
4. **브라우저 스모크(계층 3) 미포함** — 1-5 근거. `tut_layout_cdp.js` 등의 텍스트 기하 판정이 러너 폰트에 의존한다.
5. **`ai_compare.js`·`attack_balance_compare.js`·`shock_compare.js` 제외** — 앞의 둘은 어서션·`process.exit` 부재(항상 0), `shock_compare.js` 는 v0.4.4 기준 대비 밸런스 비교라 의도적 변경을 실패로 집계한다.
6. **Saturn 판정 없음.** 위 전부 Mars 자체 실행이다.

## 2-7. 후속 — 내 범위 밖으로 남긴 것

| ID | 내용 | 소관 |
|---|---|---|
| M-2 | `.gitattributes` eol/whitespace 규칙 갱신 | **PD 완료 (2026-09-09)** — `docs/milestone` 규칙 **57개**, 옛 `docs/qa`·`docs/art` 규칙 **0개**로 치환됨(`grep -c 'docs/milestone' .gitattributes` → 57, `grep -cE 'docs/qa|docs/art'` → 0). 남은 항목이 아니다 |
| M-4 | `demo/test/shock_compare.js:4` 주석의 옛 경로 1건 — 기능 영향 없음, MOVES 대조표로 해소 | 후속 |
| — | branch protection 실제 적용 + 필수 검사 이름 연결 (`CLAUDE.md` 49행이 "Issue #132에서 실제 CI 성공 후" 로 예고) | **Mercury/PD** — CI 최초 성공 후 |
| — | 브라우저 스모크의 `workflow_dispatch` 전용 잡 | 후속 검토 |
| — | 잡 A 소요가 커지면 무거운 스위트 분리 | 실측 후 |
| — | 루트 `.gitignore` 에 `node_modules/` 부재(현재는 `server/.gitignore` 에만) — 루트 설치가 생기면 오염 | 후속 |

---

# 3부 — PD REVISE 반영 (task_4a78b22de1ec, 2026-09-09)

병합 전 REVISE 5건을 모두 반영했다. **제품 `demo/index.html` blob `61a3ce3` 불변**, Git·GitHub·Notion 쓰기 없음, `git restore`/`checkout` 미사용.

## R-1. 읽지 못한 추적 문서를 성공으로 처리하던 결함 [수정]

`tools/docs_link_check.js` 의 `readFileSync` 를 감싼 `catch(e){ continue; }` 는 **추적 중인 문서가 없거나 읽히지 않을 때 조용히 건너뛰어 통과**시켰다. "검사할 것이 없어서" 통과한 것을 "문제가 없어서" 통과한 것으로 오인하게 만드는, 게이트로서 치명적인 결함이다.

- 이제 `unreadable` 문제로 **기록하고 exit 1**. 존재 확인(`lstat`)과 읽기 실패를 각각 사유와 함께 보고한다.
- 회귀 추가: 인덱스에는 있고 작업 트리에서 지운 `docs/ghost.md` 픽스처 → exit 1 · 사유·파일명 보고 · **문서 수에는 그대로 잡힘**(누락을 숨기지 않는다).

## R-2. 저장소 경계를 realpath 로 판정 [수정]

경로 문자열의 `../` 만 보던 것을 **실제 경로**까지 보도록 바꿨다.

- 루트를 `fs.realpathSync` 로 한 번 해석해 기준점(`ROOT_REAL`)으로 삼는다(해석 실패 시 exit 2).
- 세그먼트를 한 칸씩 내려가며 `lstat` 로 링크 여부를 먼저 보고, **링크를 따라가기 전에** 실제 경로가 저장소 안인지 판정한다. 밖이면 즉시 거부하고 **그 대상을 읽지 않는다**.
- 추적 문서 자체도 읽기 전에 `realWithinRoot` 로 확인한다. 파일이 링크인 경우뿐 아니라 **상위 디렉터리가 정션인 경우**까지 덮는다.
- 링크 해석 실패는 "안전"으로 보지 않는다(`realWithinRoot` 는 예외 시 `false`).

**source 부모 정션 [Saturn 지적 반영]**: `docs/sub/a.md` 에서 `a.md` 자체는 일반 파일이고 **부모 `docs/sub` 만 외부 정션**인 경우, 최종 성분만 `lstat` 하면 저장소 밖 파일을 그대로 읽는다. 현재 코드는 `readFileSync` 전에 **전체 경로를 realpath 로** 확인해 이 경로를 덮는다. 전용 픽스처(7b)를 추가했고, **음성 대조로 검출력을 증명**했다:

| 검사기 | exit | 외부 파일 안의 깨진 링크가 출력에 나타나는가 |
|---|---|---|
| 현행 (전체 realpath) | 1 | **아니오** — 외부 파일을 읽지 않았다 |
| 변형 (최종 성분 lstat 만) | 1 | **예** — 외부 파일을 읽었다 |

두 경우 모두 exit 1 이라 **종료 코드만으로는 구분되지 않는다.** 그래서 외부 파일 안에 일부러 깨진 링크(`does-not-exist-outside.md`)를 심어 두고 **그것이 보고되지 않는 것**을 미열람 근거로 삼는다 — 읽었다면 반드시 보고되기 때문이다. (본문 문자열이 출력에 없다는 사실만으로는 미열람 증명이 되지 않으므로, 그 표현은 쓰지 않는다.)

**플랫폼 픽스처 — OS 차이 반영 [PD 지적 반영]**: 링크를 먼저 만들고 `git add` 하면 **Linux 는 링크 자체만 추적하고 그 아래 자식은 추적하지 않는다**(Windows 정션은 자식까지 추적한다). 그대로 두면 7b 의 "추적되는 자식" 단언이 Linux 에서만 깨진다. 그래서 source 픽스처는 링크를 나중에 끼운다 — ① 진짜 디렉터리와 자식 MD 를 만들어 stage → ② 그 디렉터리만 제거 → ③ 외부 링크로 교체. 인덱스는 그대로이므로 **두 OS 에서 같은 상태**가 된다. 픽스처 전제 자체("자식 MD 가 추적된다")도 `git ls-files` 로 단언한다. target(7a)과 source(7b)는 **분리해 둘 다 유지**했고, Linux 를 이유로 단언을 지우거나 건너뛰지 않았다. 링크 생성이 막힌 환경에서만 사유(`errno`·platform)를 출력하고 SKIP 한다.

추가된 검사: **7a target** 저장소 밖 링크 대상 → exit 1 · 거부 · 추적 문서 수 OS 무관 · **7b source** 부모가 외부 링크인 추적 문서 → exit 1 · 파일명 보고 · 미열람 근거 · **7c 대조** 저장소 안 링크는 exit 0(과잉 거부 방지).

**읽기 전용 보증**: 검사기가 허용된 `--json` 말고는 아무것도 쓰지 않음을 픽스처 전후 스냅샷(크기·mtime)으로 확인하고, `--json` 을 준 경우 **정확히 그 한 경로만** 생기는 것도 확인했다.

## R-3. `tests/test_minion_art.py` 의 전체 EOL 변환 [수정]

- **원인 [확정]**: `.gitattributes:4` 가 `/tests/test_minion_art.py -text` 로 변환을 끄고 있고 커밋된 blob 은 **CRLF**(35,543바이트)인데, 내가 쓴 `sed -i` 가 전체를 LF(34,859바이트)로 바꿔 749/749 diff 가 났다.
- **수정**: `git show HEAD:tests/test_minion_art.py` 로 **blob 바이트를 읽어**(읽기 전용) 의도한 5건만 바이트 치환하고 개행 변환 없이 기록했다. `git restore`·`checkout` 을 쓰지 않았다.
- **결과 [확정]**: `git diff --numstat` → **5 5**. CRLF 749줄 유지, LF-only 0줄. 바뀐 줄은 461·462·510·517·525 의 기대 경로 5건뿐이다.
- **다른 파일 점검**: 내가 만진 나머지 16개 파일의 numstat 은 전부 1~2행(`tools/minion_art.py` 만 14/8 = 의도한 base 상수 도입 + docstring). 전체 변환은 이 한 파일뿐이었다.

## R-4. `readme_media_capture.js` 헤더의 옛 매니페스트 경로 [수정]

헤더 10행이 아직 `<out>/../qa/issue105-media/capture-manifest.json` 을 안내했다. 실제 기본값(`:263`)은 `docs/milestone/v0.4.4/issues/105/Mars/artifacts/capture-manifest.json` 이고 **`--out` 을 따라가지 않는 저장소 루트 기준 고정 경로**다. 헤더를 실제 동작에 맞췄다(그 점도 명시). 도구 안에 남은 옛 `qa` 경로 0건.

## R-5. 보고서 정정

- **`upload-artifact` 오인 방지**: 1-4 의 SHA 표를 "실제 사용 3개"와 "미사용 1개"로 분리했다. `ci.yml` 에는 `upload-artifact` 가 없다(`grep -c` → 0).
- **`.gitattributes`**: 2-7 의 M-2 를 "PD 소관 잔여"에서 **"PD 완료(2026-09-09)"** 로 정정했다 — `docs/milestone` 규칙 57개, 옛 `docs/qa`·`docs/art` 규칙 0개.

## R-6. 재검증 결과 [확정 — 바뀐 범위만]

기존 통과 범위는 승계하고, REVISE 로 바뀐 검사기·픽스처·EOL 영향 Python·헤더 영향 도구만 다시 돌렸다.

| 명령 | exit | 결과 |
|---|---|---|
| `node tools/test/docs_link_check_test.js` | 0 | **34개 검사** 통과 (기존 20 + 신규 14), 임시 픽스처 잔존 0 |
| `node tools/docs_link_check.js` | 0 | 문서 106개 · 내부 링크 332건 · **문제 0건** |
| `python -m unittest discover -s tests` | 0 | **68 tests** OK |
| `python tools/minion_art.py --all --check --no-preview` | 0 | write=0 unchanged=29 mismatch=0 |
| `node tools/readme_media_capture.js selfcheck` | 0 | 정적 자기 검사 통과 |
| `node tools/readme_media_capture.js verify --read-only --no-gh --no-render` | 0 | 문제 0건 · artifact 쓰기 0 |
| `node tools/test/readme_media_readonly_test.js --quick --no-gh` | 0 | 17개 PASS |
| `git diff --numstat -- tests/test_minion_art.py` | — | **5 5** (749/749 → 5/5) |

## R-7. 남은 한계 (2-6 에 더해)

1. **[미확정] Linux 에서의 링크 픽스처 실행.** 위 링크 검사(7a·7b·7c)는 **win32 정션으로 실제 실행**됐다. 픽스처를 두 OS 에서 같은 상태가 되도록 다시 설계했지만(링크를 나중에 끼우는 순서), POSIX `dir` 심볼릭 링크 경로는 **이 환경에서 실행되지 않았다** — Linux CI 최초 실행 때 확인이 필요하다. 7b 는 픽스처 전제("자식 MD 가 추적된다")를 스스로 단언하므로, 전제가 깨지면 조용히 통과하지 않고 실패한다.
2. **[미확정] 하드 링크·bind mount 는 다루지 않는다.** `realpath` 로 구분되지 않으므로 이 검사기의 경계 판정 밖이다.
3. **[승계] `smoke_orientation_audit.js` 어서션 수 변동**(8908~8920, `fail` 은 항상 0) — 2-6 참조. 이번 REVISE 범위가 아니라 손대지 않았다.
4. **[승계] Linux 실제 CI 미실행 · 브라우저 스모크 미포함 · `npm ci` clean install 미재현.**
5. **Saturn 판정 없음** — 위 전부 Mars 자체 실행이다.
