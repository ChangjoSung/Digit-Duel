# Issue #128 — 튜토리얼 자동 표시를 "문서 로드당 1회"로 (Mars 개발 검증 보고)

- 역할: ♂ Mars (Client, Claude Code) · required_role=Mars / mode=IMPLEMENT / area=CLIENT·HTML·TOOLING / mutation=code / instance_index=null
- 작업 브랜치: `fix/128-tutorial-every-load` · 시작 커밋 `bdce124e73fe82534dd1757deef70976e12a7ef5`
- 근거: 2026-09-10 CJ 승인 "권고 방향으로 진행" — 브라우저별 영구 최초 1회 → **페이지 로드당 1회**
- 판정 범위: **개발 검증 결과만** 적는다. 자기 구현물의 QA 최종 PASS 판정은 Saturn 영역이라 여기서 내리지 않는다.
- Git 쓰기·배포·외부 발신 없음 (Worker 계약).

---

## 1. 무엇을 바꿨나 — 한 줄

튜토리얼 자동 표시의 근거를 **영구 저장(localStorage `tutorialSeen`)에서 메모리 플래그 `TUT.seenThisLoad` 하나로** 옮겼다.
제품은 이제 튜토리얼 관련 영구 저장을 **읽지도 쓰지도 않는다**. 과거 키는 무시하고, 지우지도 않는다.

| 상황 | 이전 | 지금 |
|---|---|---|
| URL 새로 열기 / 새 탭 / 새로고침 / 브라우저 재실행 후 새 문서 로드 / LAN 서버 재시작 후 새 접속 | 저장돼 있으면 생략 | **매번 1단계부터 자동 표시** |
| 같은 열린 페이지의 새 게임·재대전·모드 변경·WS 재연결·백그라운드 복귀·BFCache 복원 | 추가 표시 없음 | **추가 표시 없음 (변화 없음)** |
| 완료 / 건너뛰기 / Esc / `?`·메뉴 수동 재보기 | 유지 | **유지** |
| 포커스 복원·스크롤 최상단·배경 inert | 유지 | **유지** |
| 10단계 강제 완주 | 없음 | **없음 (1단계에서 건너뛰기 한 번으로 닫힘)** |
| 다른 저장값(`netServer` 등) | 무관 | **무관·불변 (읽지도 쓰지도 지우지도 않음)** |

---

## 2. 제품 변경 (`demo/index.html`) — 5곳

| 위치 | 변경 |
|---|---|
| 튜토리얼 구간 머리 주석 (`3759`~) | 새 정책과 그 이유, 과거 키 무시·비삭제를 명시 |
| `TUT_KEY` / `tutStore` **삭제** | 영구 저장 헬퍼 자체를 없앴다. 남겨 두면 아무도 읽지 않는 값을 계속 쓰는 죽은 저장이 된다 |
| `tutSeen()` | `TUT.seenThisLoad \|\| tutStore.get()` → **`TUT.seenThisLoad`** |
| `tutOpen()` | 여는 순간 `TUT.seenThisLoad=true` (자동·수동 공통) |
| `tutClose()` | `tutStore.set()` 제거. `TUT.seenThisLoad=true` 는 유지 |
| 부트 라인 (`4429`) | 주석만 — 이 줄은 새 문서 로드에서만 실행된다는 사실을 남김 |

### `seenThisLoad` 의 의미 일관성 (요청 항목)

한 문장으로 고정했다: **"이 문서 로드에서 튜토리얼을 이미 띄웠다."** 그 이상도 이하도 아니다.

- **세우는 곳**: `tutOpen()` — 자동이든 수동이든 *뜬 순간*. 부트 라인이 `if(!tutSeen()) tutOpen({auto:true})` 하나뿐이라 지금도 로드당 1회지만, 플래그를 "닫힘"이 아니라 "뜸"에 걸어 두면 나중에 자동 표시 호출 지점이 늘어도 불변식이 그대로 산다.
- **다시 못박는 곳**: `tutClose()` — 완료·건너뛰기·Esc 어느 경로로 닫혀도 true. (`tutOpen` 이 이미 세웠으므로 값이 바뀌지는 않는다. 닫힘 경로에서도 계약이 같다는 것을 코드로 남긴 것이다.)
- **지우는 곳**: 없다. **문서가 새로 로드되면 `const TUT={…seenThisLoad:false…}` 초기화로 자연히 false 로 돌아간다.** 이것이 "로드당 1회"의 유일한 구현 근거다.
- **환경 의존 제거**: 저장소를 읽지 않으므로 localStorage 미지원·SecurityError(시크릿·정책 차단)·QuotaExceeded 가 표시 여부를 바꾸지 못한다. 예외를 삼킬 코드도 필요 없어졌다.
- **왜 sessionStorage 가 아닌가**: sessionStorage 는 같은 탭의 새로고침에서 살아남는다. "새로고침마다 표시" 요구와 정면으로 어긋나므로 대체하지 않았고, 회귀에서 **금지로 고정**했다(아래 F7).
- **왜 과거 키를 지우지 않는가**: `localStorage` 전체 삭제·사용자 저장값 초기화 금지 계약. 무시하는 것으로 충분하고, 지우는 것은 사용자 데이터에 대한 불필요한 쓰기다. `netServer` 등 다른 값도 동일.

### 건드리지 않은 것

게임 상태 `S`, `NET`, RNG(`setSeed`/`rand`), `netServer` 저장 경로(`4161`·`4294`·`4329`), 10단계 본문·장면·CSS·마크업, 상황 도움말(`TUT_HINTS`), 포커스·스크롤·inert 처리.
`#130`·`#131`·`#146` 규칙은 한 줄도 손대지 않았다(CJ QA PASS CLOSED). 계정·LAN 서버·보관 QA 절차도 변경 없음.

---

## 3. 수정 파일 · 최종 해시

| 파일 | sha256 | git blob (sha1) | 성격 |
|---|---|---|---|
| `demo/index.html` | `d253453f121fa151390dcb82ef098f440cf7556d13c4fdec40f5134aaad6686a` | `8027cd72d8445c9a7077d0e43b1c5559645ee165` | 제품 |
| `demo/test/shared/harness.js` | `2523c21e370f4f680414875e2bbb70287d260be6d22328969feef3bf739e4537` | `c8f56886588c0ee73541a40b273fd8f700b8ad0e` | 로더 (최소치) |
| `demo/test/regression/smoke_tutorial.js` | `38f89c90bcf8458e1e3252c64d384ed8e707c375f3434695865a1027cd088c26` | `161305a07393ab3dbbe217ed10347be45c99bcde` | 회귀 |
| `demo/test/regression/smoke_issue146.js` | `a5bfc1a3ab5d1764716285a7314bd0a82d7038132b4a119210ce6f96986576d7` | `049c5caef09145bcae1749c62324bec4196726ed` | 회귀 (E절) |
| `demo/test/regression/smoke_memo.js` | `adc05de0c85b22acedca0dc9c49467e2e9ccfca0d02e960754bdee9d609beb65` | `0af16496e0f40b960b2e90f669a8609d038e85b2` | 회귀 (깨진 1건 최소 수정) |
| `demo/test/regression/smoke_online.js` | `b22ed363731362defa6eb6b097542bf3266a5fdb6714f2630327d6b87219cdea` | `f8421543dc967c7e5d807a8fa8cd51361b286cc4` | 회귀 (깨진 2건 최소 수정) |
| `demo/test/milestone/v0.4.7/issues/128/issue128_cdp.js` | `a612ed33c1d8527d6a52ba3283f5b402d0da31956365c9e3a6cbdaa4b5859a84` | `c0d4320d5677c37ad32a85530252607d416db2b5` | 신규 브라우저 증빙 도구 |
| `demo/test/README.md` | `4ac1a999902b3a11410fd211d43acf474e052cedd83be4c71b5409cc7c996545` | `2f8389db4138070c1bc64daafd6899988390d96f` | 검사 인덱스 |
| `.github/workflows/ci.yml` | `9bd8774002ab5c4cb6285c14712c4db0c8c6d5b7f42f5153bfba09f15dac5bda` | `ddfd8fc5ce20b06f61f180f0bff585ea6ddd55dc` | **설명 주석만** (PD 추가 승인) |

`harness.js` 최소치: 내보내기 줄에서 `TUT_KEY`·`tutStore` 를 **부재 허용 형태**(`typeof x!=="undefined"?x:undefined`)로 바꿨다. 현행 제품에는 없고, 고정 ref 기준판(#92 `d614392`·#93 `6baa0b5`)에는 아직 있어서 양쪽 로드가 모두 살아야 한다. 파일의 기존 관례와 같은 패턴이다.

`ci.yml` 은 잡 구성·검사명·검사 명령·보호 조건을 바꾸지 않았고, 잡 A 의 `smoke_issue146` **설명 주석 5줄만** 현행 E절 정책·음성 대조 결과에 맞췄다 (PD 추가 승인 범위).

**내가 만들지 않은 작업 트리 변경**: `README.md`·`CLAUDE.md`·`docs/**` 는 이 Task 중 Venus·Mercury 가 동시에 수정한 파일이며 손대지 않았다. 루트 `art/`·`orca-hook-latency-report.md` 는 미추적 상태 그대로 두었고 내용을 읽거나 열거하지 않았다.

---

## 4. 헤드리스 회귀 — 실행 명령과 결과

### 4.1 현행 제품 (19종 전부)

`node demo/test/regression/<파일>.js demo/index.html` (`smoke_orientation_audit` 만 `--path demo/index.html`)

| 파일 | 결과 | 파일 | 결과 |
|---|---|---|---|
| `smoke_tutorial` | **135 / 0** | `smoke_search_packages` | 299 / 0 |
| `smoke_issue146` | **208 / 0** | `smoke_minion_art` | 205 / 0 |
| `smoke_memo` | 122 / 0 | `smoke_orientation_audit` | 8912 / 0 |
| `smoke_online` | 157 / 0 | `smoke_cross_skill` | 86 / 0 |
| `smoke_online_sync` | 23 / 0 | `smoke_attack_balance` | 54 / 0 |
| `smoke_cycle5` | 69 / 0 | `smoke_shock` | 67 / 0 |
| `smoke_turnflow` | 202 / 0 | `smoke_fx_timing` | 82 / 0 |
| `smoke_turnflow_timers` | 36 / 0 | `smoke_ai_completion` | 59 / 0 (13판 완주) |
| `smoke_issue114` | 16 groups passed | `smoke_own_side` | 66 / 0 |
| `smoke_testclient` | 41 / 0 (`server/test-client.html` 인자 — `demo/index.html` 을 주면 환경 오류) | | |

19종 전부 통과. **로드 시점 동작을 바꾼 변경이라 1회는 전수 실행이 필요했고**, 그 뒤로는 관련 회귀만 반복했다(전체 필수 검사는 최종 CI가 다시 돌린다).

### 4.2 음성 대조 (negative control) — 기준판 `bdce124`

기준판 HTML을 세션 스크래치패드에 꺼내 **같은 테스트 파일**로 돌렸다.
`git show bdce124:demo/index.html > <scratch>/baseline_bdce124_index.html`

| 테스트 | 기준판 결과 | 떨어진 항목 |
|---|---|---|
| `smoke_tutorial` | **123 / 12 실패** | B8·B11·**B13**(같은 저장소 재로드 자동 표시)·B17·**B18**(과거 `tutorialSeen=1` 무시)·B19(다른 저장값 보존)·C3·**C5**(연속 로드 `[true,false,false]`)·D7·E11·F7·F7b |
| `smoke_issue146` | **201 / 7 실패** | E1a·**E1b**(과거 키 무시)·**E2**(반복 로드 `[false,false,false]`)·E2a·E3·E5·E7a |

즉 새 판만 통과하고 기준판은 떨어진다 — 요구된 "의미 있는 회귀"가 성립한다.
`E2b`(같은 로드에서 모드 변경·새 게임 무재표시)는 **일부러 양쪽 통과**하도록 두었다. 정책 변경 전후가 같아야 하는 불변식이므로, 새 정책이 "로드마다"를 "조작마다"로 번지지 않았다는 것을 그 통과가 증명한다.

### 4.3 새로 추가한 검사 (요구 항목 대응표)

| 요구 | 검사 |
|---|---|
| 없는 값 | `smoke_tutorial` A1(웹 스토리지 미지원)·B1(빈 저장소) |
| 과거 값 | B18·B19 · `smoke_issue146` E1b·E1c |
| 차단·예외 | C1(접근 자체가 SecurityError)·C4(setItem QuotaExceeded)·`smoke_issue146` E6·E6c |
| 새 로드와 동일 로드 구분 | B13·C5 (앞 로드를 닫고 다시 로드 → 매번 표시) ↔ `smoke_issue146` E2b (같은 로드 조작 → 무재표시) |
| skip / finish / Esc / 수동 재보기 | B10~B12·D7·`smoke_issue146` E7b(1단계 건너뛰기 한 번으로 닫힘)·E7c |
| 새 게임 / 모드 / 재대전 / 연결 경로 | E2b(`startMode` 반복)·`smoke_online` 157/0·`smoke_online_sync` 23/0 |
| 상태·다른 저장값 보존 | B19(`netServer` 불변·쓰기 0회)·E1d·E3(저장 흔적 0)·F7b(sessionStorage·쿠키·indexedDB 무기록) |
| sessionStorage 대체 금지 | **F7** — 튜토리얼 구간에 저장·전송 API 가 0줄임을 정적으로 고정 |

### 4.4 내 변경이 깨뜨린 기존 검사 3건 — 최소 수정 (PD 승인 범위)

로드마다 튜토리얼이 자동으로 뜨게 되면서, **"저장 키로 튜토리얼을 억제한다"는 전제를 쓰던** 검사 3건이 깨졌다.
둘 다 정책이 아니라 다른 것을 보는 검사라, 전제만 새 정책에 맞추고 **판정 대상은 그대로** 두었다. 두 수정 모두 **기준판·현행 양쪽에서 통과**한다(정책 중립).

| 검사 | 왜 깨졌나 | 수정 | 기준판 | 현행 |
|---|---|---|---|---|
| `smoke_online` G11·G13 | 두 로드의 **포커스 격리**를 보는 절. 이제 로드마다 튜토리얼이 떠 '다음' 버튼으로 포커스가 가서 "포커스는 자기 body" 전제가 깨졌다 | 양쪽을 `tutSkip()` 으로 닫고 각자의 `blur()` 로 body 포커스를 되돌린 뒤 같은 검사 | 157/0 | 157/0 |
| `smoke_memo` B4 | `ovHidden()` 이 "els.overlay 미접근 = 모달 열린 적 없음" 이라는 heuristic 이었는데, 튜토리얼의 배경 inert 처리가 `#app`·`#overlay`·`#tutHint` 를 먼저 만들어 둔다 | 제품이 스스로 들고 있는 오버레이 소유 상태 `MEMO_UI.overlayOpen` 을 본다 (`modal()` 이 true, `close()` 가 false 로 두는 유일한 값) | 122/0 | 122/0 |

기존부터 실패하던 검사는 없었고, 무관한 검사·구조로 확장하지 않았다. `smoke_memo` 머리 주석의 "tutorialSeen 으로 자동 표시를 억제한다" 설명도 사실과 맞게 고쳤다(PD 추가 승인).

---

## 5. 실제 Chrome 증빙 — `issue128_cdp.js`

`node demo/test/milestone/v0.4.7/issues/128/issue128_cdp.js` → **pass 26 / fail 0**
(재현: `--read-only` 로 산출물 0건 실행 가능. 최초 `--read-only` 실행도 26/0 으로 같은 결과였다.)

- 소스: 작업 트리 `demo/index.html` (blob `8027cd72…`, sha256 `d253453f…`) — 이 실행 소유의 로컬 HTTP `127.0.0.1:62868` 로 서빙
- Chrome: `C:/Program Files/Google/Chrome/Application/chrome.exe` · `--headless=new` · 별도 새 프로필 2개 · 숨김 실행
- 산출물: `docs/milestone/v0.4.7/issues/128/Mars/artifacts/` (스크린샷 8장 + `i128-browser-report.json`)

### 5.1 실제 관측 순서 (도구가 기록한 그대로)

| # | 조작 | 관측 |
|---|---|---|
| 0 | 프로필 A 에 `tutorialSeen="1"`·`netServer="192.168.0.77:8787"` 심음 | 키 2개 |
| 1 | 그 프로필로 **새 접속** | `open=true, step=0, auto=true`, `stored="1"`, `TUT_KEY`·`tutStore` **부재**, `#app[inert]` |
| 2 | **실제 마우스로 [건너뛰기]** | `open=false`, 오버레이 hidden, `seenThisLoad=true`, 저장값 2개 그대로 |
| 3 | **실제 `Page.reload`** | `open=true, step=0, auto=true` — 다시 뜸 |
| 4 | **같은 프로필 새 탭** | `open=true, step=0, auto=true` — 다시 뜸 |
| 5 | 그 탭에서 `startMode` pvp→pve→pvp | 3회 모두 `tutOpen=false` — 추가 표시 없음 |
| 6 | **실제 마우스로 헤더 `?`** | `open=true, step=0, auto=false` — 수동 재보기 |
| 7 | **[다음]×2 → [이전]** | `step 0→2→1` |
| 8 | **Esc 키 이벤트** | `open=false`, 저장값 불변 |
| 9 | **독립 프로필 B** (다른 `user-data-dir`) 최초 접속 | 저장소 `[]`, `open=true, auto=true` |
| 10 | B 건너뛰기 후 reload | 다시 뜸, B 저장소 끝까지 `[]` |
| 11 | 검증 서버 종료 → **같은 포트 62868 재바인드** → 새 접속 | `open=true, step=0, auto=true` |
| 12 | 전 과정 후 프로필 A 저장소 | `["netServer","tutorialSeen"]` — 2개 그대로, 새 키 없음, 삭제 없음 |
| 13 | 10단계 렌더 텍스트 | 10단계·카드 수 = 문단 수, `#146` 도망 30% 본문 그대로 |

부수 증거: 스크린샷 `01`(과거 키 있는 새 접속)·`03`(새로고침)·`04`(새 탭)·`08`(서버 재시작 후)의 **sha256 이 모두 `7e7b16e1…` 로 동일**하다 — 네 경로가 픽셀 단위로 같은 1단계 화면을 낸다.

### 5.2 무엇을 어떻게 측정했나 (측정 방식 구분 — Saturn 요청)

| 브라우저가 직접 측정한 것 | 페이지 안 `Runtime.evaluate` 로 본 것 | 이 도구가 측정하지 **않은** 것 |
|---|---|---|
| 실제 `Page.reload` · 새 탭 생성 · 같은 포트 HTTP 재시작 후 새 문서 로드 | `startMode()` 호출로 만든 새 게임·모드 변경 (실제 메뉴 클릭이 아니라 함수 호출) | **동일 프로필 실제 브라우저 재실행** |
| `Input.dispatchMouseEvent` 로 [건너뛰기]·헤더 `?`·[다음]·[이전] 실제 클릭 | `TUT`·`localStorage` 상태 읽기 | **실제 WS 재연결 · 탭 복귀(visibilitychange) · BFCache 복원** |
| `Input.dispatchKeyEvent` 로 Esc | 10단계 텍스트 다이제스트 | **storage getter 자체가 denied 인 환경** (헤드리스 회귀 C1 이 담당) |
| 독립 `user-data-dir` 2개의 저장소 분리 | | **물리 2PC · LAN 실행기 재시작** |

측정하지 않은 항목의 근거는 다음과 같이 **구분해서** 남긴다.

- **BFCache 복원·백그라운드 복귀·WS 재연결·브라우저 재실행**: 코드 근거다. 자동 표시 지점은 스크립트 말미의 `if(!tutSeen()) tutOpen({auto:true})` **한 줄뿐**이고(전수 grep 확인), 이 줄은 문서가 새로 파싱될 때만 실행된다. BFCache 복원·탭 복귀·WS 재연결은 같은 문서를 재사용하므로 스크립트가 다시 돌지 않는다 → 추가 표시 없음. 브라우저를 껐다 켜고 URL 을 다시 열면 새 문서 로드 → 표시. **직접 관측이 아니라 코드 구조에 근거한 추론**이며, 같은 문서 무재표시의 관측 근거는 위 5번(모드 변경·새 게임) 한 건이다.
- **물리 2PC·LAN 실행기 재시작**: 이번 범위에서 확대하지 않았다(지시). 다만 새 정책에서는 제품이 저장값을 **읽지 않으므로** "두 PC 가 seen 을 공유하는가"라는 질문 자체가 구조적으로 사라진다 — 1번(과거 키가 있어도 표시)과 12번(저장값 불변)이 그 근거다.
- **초기 #128 두 PC 공유 신고**: 옛 정책 아래에서 **재현되지 않았고**, 그 미재현 이력은 그대로 보존한다. 이번 변경은 그 신고가 입증됐다고 소급하는 것이 아니라, 같은 LAN 주소 재접속에서 생략되던 동작을 **노출 정책 자체의 개정**으로 없앤 것이다.

### 5.3 자원 소유권과 정리 (정확 경로·PID)

| 자원 | 정확한 값 | 정리 |
|---|---|---|
| Chrome 프로세스 | PID `62304`(프로필 A) · `107860`(프로필 B) | 종료 후 `process.kill(pid,0)` → 둘 다 `ESRCH` **확인** |
| 임시 프로필 | `C:\Users\pc_77\AppData\Local\Temp\i128cdp-A-hkBSL8` · `C:\Users\pc_77\AppData\Local\Temp\i128cdp-B-11wZUC` | `fs.rm` 후 `existsSync` → 둘 다 `false` **확인** (`cleanup.leftover: []`) |
| 검증 HTTP 서버 | `127.0.0.1:62868` (재시작 포함 2회 bind) | `server.close()` |
| 최초 `--read-only` 실행분 | PID `86332`·`111264` · `…\i128cdp-A-CCjXGf` · `…\i128cdp-B-0DD2NA` | 프로세스는 자동 종료, 디렉터리는 **위 정확 경로 2개만** 명시해 `fs.rm` → `false` 확인 |
| 스크래치패드 | `C:\Users\pc_77\AppData\Local\Temp\claude\C--Users-pc-77-orca-Digit-Duel\ae3590db-752e-4956-a1d8-45bd1f5cc71e\scratchpad\baseline_bdce124_index.html` | 세션 전용 · 음성 대조 입력 |
| `issue146_cdp.js` 재현 실행분 (7절 1항, `--read-only --no-shots`) | **미확인** — 그 실행도 자기 소유 Chrome PID·`mkdtemp` 프로필·검증 서버를 만들고 스스로 `RESOURCE`/`CLEANUP` 행으로 보고하지만, 내가 출력을 `grep` 으로 판정 행만 걸러 받아 **그 행을 잃었다** | 정확 경로·PID 를 갖고 있지 않으므로 개별 대조는 **미확인**으로 남긴다. 찾겠다고 `os.tmpdir()` 접두사를 열거하거나 임의 정리를 하지 않는다 (도구 자신의 `cleanup()` 이 자기 소유분만 정리한다). 재확인이 필요하면 출력을 거르지 않고 다시 돌리는 것이 옳은 방법이다 |

**glob·접두사 검색·`taskkill` 일괄·다른 셸 삭제 전달을 쓰지 않았다.** 삭제 대상은 이 실행이 `mkdtemp` 로 만들어 반환받은 절대경로 목록뿐이다.
최초 실행에서 Windows 파일 잠금 때문에 프로필 디렉터리가 남는 것을 관측해, 도구의 `cleanup()` 을 **프로세스 종료를 기다린 뒤 재시도 삭제**하고 그래도 남으면 `LEFTOVER` 로 보고하도록 고쳤다. 기존 브라우저·서버에는 attach 하지도, 종료하지도 않았다.

---

## 6. 튜토리얼 10단계 — 재촬영 불필요

단계 본문·카드·장면이 **바뀌지 않았다**. 기준판 `bdce124` 와 현행에서 `TUT_STEPS` 전체(아이콘·제목·문단·카드 `t`/`vis`/`res`/`tone`)를 직렬화해 대조:

```
baseline steps 10  sha256 28be7438ac82ab630d6a77bba04cd900795d1f12f53e72cde95a86fb7df21d3c
current  steps 10  sha256 28be7438ac82ab630d6a77bba04cd900795d1f12f53e72cde95a86fb7df21d3c
IDENTICAL: true
```

실제 브라우저 렌더 텍스트 다이제스트도 함께 남겼다(`315370351ff6cc…`, `i128-browser-report.json`).
따라서 **기존 #146 캡처 10장을 그대로 보존**하고 새로 촬영하지 않았다. 기존 #146 브라우저 도구·보고서도 덮어쓰지 않았다.

---

## 7. 후속으로 넘기는 사항 (내가 고치지 않은 것)

1. **`issue146_cdp.js` 6절이 옛 정책을 고정하고 있다.** 지시대로 덮어쓰지 않았다. 현행 제품에 대해 `--read-only --no-shots` 로 재현한 결과 **pass 78 / fail 3** — 실패는 저장 지속성 3건(`6c` A 완료 기록 · `6f` A 재방문 생략 · `6h` B 재방문 생략)뿐이고, `#146`·`#131`·`#130` 규칙 절과 10단계 본문 절은 전부 통과한다. 이 도구는 `milestone/`(과거 시점 감사 도구)이라 CI 게이트가 아니다. 새 정책 증빙은 `issue128_cdp.js` 가 대체한다. **PD 판단: 보존 확정**(2026-09-10) — 현행 지속 회귀가 아니라 `milestone/` 도구이고, 현행 정책 증빙은 새 `issue128_cdp.js` 가 담당한다. 추가 제품 수정·신규 이슈 불필요.
2. **다른 회귀 파일에 남은 `mkStorage({tutorialSeen:"1"})` 시드** (`smoke_online`·`smoke_online_sync`·`smoke_own_side`·`smoke_orientation_audit`·`smoke_turnflow`). 이제 아무것도 억제하지 않는 무해한 잔재다. 해당 파일들은 별도로 `tutSkip()` 을 호출하고 있어 동작에 영향이 없어 **이번 범위에서 건드리지 않았다**. 정리한다면 테스트 위생 작업으로 따로 잡는 편이 낫다.
3. **README(루트) 1100/390 렌더 검증 — 완료.** 아래 8절로 옮겼다.
4. **[기획 필요] 없음.** 이번 범위에서 기획에 없는 판단을 임의로 넣은 곳은 없다. `TUT_KEY`·`tutStore` 삭제와 과거 키 무시는 "과거키 무시·불필요한 쓰기 제거를 최소 범위로 판단하라"는 지시 안에서의 구현 판단이며, 그 근거는 2절에 적었다.

---

---

## 8. README 최종 렌더 검증 (1100 / 390) — 완료

전달받은 최종 README freeze 로 실행했다. **제품/테스트/도구 코드는 이미 `17cdae8` · PR157 로 올라갔고 이번에는 코드 수정·회귀 재실행·과거 도구 실행을 하지 않았다.**

- 명령: `node tools/media/readme_media_capture.js verify --readme README.md --out docs/milestone/v0.4.7/issues/128/Mars/artifacts/readme-final --viewport 1100x900` (및 `--viewport 390x844`)
- 검증 대상 `README.md` sha256 **`94e09470dd10b0b722daf44fe0a2a0b58eb8e218e17fe0060b1cea6f2dbad446`** — 전달받은 freeze 해시와 일치하고, 두 JSON 의 `readmeSha256` 필드에도 같은 값이 기록됐다 (23,315 bytes)
- 도구 sha256 `6ddba081fbd7d15f808d53ebab62548e286fe3292fcdb333b751fb3648bf5132`

| 뷰포트 | 결과 | 종료 코드 | 보고서 |
|---|---|---|---|
| 1100x900 | **문제 0건** (`fail: 0`) | 0 | `readme-final/verify-report.json` |
| 390x844 | **문제 0건** (`fail: 0`) | 0 | `readme-final/verify-report-w390.json` |

관측: 로컬 이미지·링크·`#`앵커 전부 OK · GitHub sanitize 렌더(`gh api markdown`, 32,877 bytes, 이미지 20·앵커 63·`<details>` 1·drop 0·script 없음) · `<details>` 갤러리 펼침에서 **이미지 10/10 로드**(2행 × 5열, 썸네일 표시 폭 1100 에서 162px · 390 에서 44px) · 표 3개 모두 **내부 가로 스크롤 0개** · **페이지 가로 넘침 0**(1100 ≤ 1100 · 390 ≤ 390) · 섹션 캡처 각 9장.

산출물 24개는 `docs/milestone/v0.4.7/issues/128/Mars/artifacts/readme-final/` 에만 저장했다 — `verify-report.json` · `verify-report-w390.json` · `section-00..08.png` · `section-00..08-w390.png` · `gallery-open.png` · `gallery-open-w390.png` · `readme-gh-render.html` · `readme-gh-render-w390.html`.

**화면 한계**: 렌더 CSS 는 GitHub 마크다운 CSS 의 **근사**(콘텐츠 폭 1012px · 표 `display:block` · 768px 미만 padding 16px)다. 레이아웃·이미지·링크 해석 검증용이며 github.com 과 픽셀 동일을 주장하지 않는다. 외부 배지 이미지 7개는 오프라인 미로드가 정상으로 집계된다. `gh api markdown` 은 읽기 전용 렌더 요청이라 저장소 상태를 바꾸지 않는다.

**쓰지 않은 것**: README·제품·기존 이미지·`#146` 보고서·Git·Notion·GitHub. 튜토리얼 10장 재촬영 없음 — README 가 참조하는 `#146` 캡처와 `docs/media/tutorial-01..10.png` 는 크기·해시 **읽기 검사만** 했다. 보호 대상 루트 `art/`·`orca-hook-latency-report.md` 는 내용·메타데이터 모두 건드리지 않았다.

**자원 정리 (정확 경로·PID)**: 이 실행이 spawn 한 Chrome PID `75024`(1100) · `7048`(390) — 종료 후 `process.kill(pid,0)` 이 둘 다 `ESRCH`. 프로필 `os.tmpdir()/readme-media-profile-DQUhDm` · `os.tmpdir()/readme-media-profile-sYBrHL` — `path.join` 으로 만든 정확 경로에 `existsSync=false` **확인** (접두사 열거·wildcard 삭제 없음, 삭제는 도구 자신의 소유 경로 정리에 한정). 렌더 HTTP 서버는 메모리 페이지라 디스크 사본이 없고 닫혔다. **남은 경로 없음.**

### 원 보고 상태 정정

7절 3항은 2026-09-10 최초 보고 시점에 "freeze 전달을 기다리는 중"으로 적었으나, **그 시점에 freeze 는 이미 전달돼 있었다**(`msg_c73764417fd0` 14:40:40 · `msg_1cf3149ddf86` 14:43:34). 그 Task 는 전달된 메시지를 읽지 못한 채 렌더 미완료 상태로 settle 했고, 이는 내 inbox 처리 누락이다. 이 절이 실제 결과이며, 위 오류 사실은 조정 기록 보존을 위해 그대로 남긴다 — 신규 승인 대기로 되돌리지 않는다.

## 9. 판정

- **개발 검증 결과: 요구 범위 전부 구현·검증 완료.** 헤드리스 19종 통과 · 의미 있는 음성 대조 성립(기준판 12+7건 실패) · 실 Chrome 26/26 직접 관측 · 자원 정리 확인.
- **QA 최종 판정은 하지 않는다** — Saturn(Codex)의 교차 독립 검증 대상이다.
- 미측정 항목(BFCache·실제 브라우저 재실행·실제 WS 재연결·탭 복귀·물리 2PC·LAN 실행기 재시작)은 5.2 에 **코드 근거인지 미측정인지 구분해** 명시했다.
- **README 최종 렌더(1100/390) 검증 완료** — 두 뷰포트 모두 문제 0건, 대상 README 해시가 전달받은 freeze 와 일치(8절). 이로써 이 Task 의 완료 조건에 남은 항목은 없다.
