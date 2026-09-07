# Issue #89 — 하수인 아트 게임 적용 (Mars 구현 납품 보고)

- 역할: **Mars** (instance=Mars · instance_index=null · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- 브랜치: `feature/89-minion-art-integration` · 기준: `258d4ea` (PR #88 병합본)
- 근거 문서: `CLAUDE.md`(HTML 데모 절) · `docs/creat2ve/HANDOVER_SNAPSHOT.md` · `docs/minion-visual-spec-v0.4.3.md` **rev7** (3장 · 5.3 · 6.3 · 7.10 · 14.2~14.6)
- 작성: 2026-09-07 · **개정 2026-09-07 (Saturn 1차 REVISE 3건 후속 수정 반영 — 8절)**
- **이 문서가 주장하는 범위**: 기계로 잰 사실과 저장한 화면 증빙까지다. **Saturn 독립 QA와 CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다.**

---

## 1. 무엇을 구현했는가

표시 계층만 바꿨다. 규칙·수치·AI 공정 관측·가시성 판정(`visibleTo`·`revealed`·`tempReveal`)은 **한 줄도 건드리지 않았다.**

| # | 적용 지점 | 코드 위치 | 내용 |
|---|---|---|---|
| 1 | 말판 | `renderBoard()` chip | 확정(known) 하수인 = 종 고유 `icon.png` 32×32 · 그 외 = 같은 MEMO_OPTS 이모지 · 아래 정보 행(원소 기호 + 현재 HP) |
| 2 | 배치 트레이 | `renderSetup()` | **말판과 같은 함수**(`pcBodyHtml`)를 호출 — 한쪽만 아이콘이 되는 불일치가 구조적으로 불가능 |
| 3 | 하수인 설명창 | `rosterInfo()` | `rd.id` → `portrait.webp` 512 원본을 **192px 표시** (낮은 화면 128px) |
| 4 | 전투 스테이지 | `battleModal()` 의 `token()` | 하수인 = `battle.png` 128×128 · 스테이지 200px |
| 5 | 자산 로딩 | 신규 아트 헬퍼 블록 | `assets/minions/<속성>_<아키타입>/` **상대경로** · 페이지 로드 시 20종 일괄 프리로드 |

메모 피커(`memoModal`)와 사이드 메모 목록(`renderSide`)은 **이미 같은 MEMO_OPTS 이모지**를 쓰고 있어 코드 변경이 필요 없었다 — 규격 7.10.4의 "네 곳 같은 기준"은 이로써 충족된다.

### 하지 않은 것 (규격 rev7 [범위 밖])

메모 선택지 20종 확장 · 아트 재제작·원고·도구 수정 · 로스터 카드 아이콘 · 왕/동료/포획의 전투 전용 이미지 신설 · 기능·밸런싱·AI 규칙 변경 · 전역 반응형 UX 개편 · 서버 코드 수정(**불필요했다** — 아래 3절).

---

## 2. 계약별 구현 사실

### 2.1 양측 말 공통 체계

`known` 판정은 **기존 그대로**(`p.owner===viewer || p.revealed || viewer===2`). 그 판정을 통과한 말만 확정 표기를 받는다.

| 대상 | 얼굴 | 정보 행 | 표식 |
|---|---|---|---|
| 내 하수인 · 공개된 상대 하수인 | 종 `icon.png` 32×32 `image-rendering:pixelated` | 원소 이모지 + 현재 HP | 실선 · 불투명 |
| 내 / 공개된 상대의 왕·동료 | 👑 / 🤝 (MEMO_OPTS 그대로) | HP | 실선 · 불투명 |
| 내 / 공개된 상대의 폭탄·함정 | 💣 / 🪤 (MEMO_OPTS 그대로) | **없음** | 실선 · 불투명 |
| 미공개 상대 · 메모 없음 | 현행 `?` 텍스트 그대로 | 없음 | 실선 · 불투명 |
| 미공개 상대 · 뷰어 메모 | 뷰어가 고른 8종 이모지 1개 | 없음 | **점선 · 0.5** (현행 유지) |
| 보이지 않는 말 | **렌더 자체 없음** | — | — |

기호는 `memoOpt()` 한 곳에서만 나온다(`glyphSpan(key)`). 확정과 추측이 **같은 테이블**을 쓰므로 어휘가 갈라질 수 없고, 신규 래스터는 0장이다.

### 2.2 기하

`.pc` 48×48 `border-radius:12px` `border:2px` `box-sizing:border-box` → 내부 44 = 아이콘 32 + 간격 1 + 정보 행 11. **겹침 없음**(실브라우저 실측 0건).
칸 `.cell` 52px·말판 376×700 **불변**. `.pc.own` 은 `box-shadow:inset` 으로 바꿨다 — 기존 바깥 그림자는 48+2+2=52 로 칸 내부 50px 을 넘는다.
`immob` 테두리 · 선택/이동/공격 하이라이트 · 트레이 선택 표시는 **손대지 않았다**.

### 2.3 정보 은닉 (규격 7.10.3 — 완화 불가 항목)

- `known===false` 면 `<img>` 를 **문자열 조립 단계에서 만들지 않는다.** 숨겨 두지 않는다.
- 미공개 말의 `src`·`title`·`aria-label`·`data-*`·클래스명 어디에도 종·속성·HP 를 넣지 않는다. 미공개·메모 없는 말은 `title`/`aria-label` 자체가 `null` 이다.
- 프리로드는 **페이지 로드 시 20종 일괄**이다. 말 하나가 파일 하나를 요청하는 경로가 없으므로 요청 목록이 정체와 상관관계를 만들지 않는다. 아이콘 20장 16,657B + 전투 20장 52,413B = **69,070B**. 설명창 원본(20종 3.15MB)은 프리로드하지 않고 설명창을 열 때만 받는다.
- 확정 말에는 `aria-label` 로 이미 공개된 값(이름·속성·HP)만 넣었다 — 텍스트가 이미지로 바뀌면서 스크린리더가 잃을 정보를 메운다.

> **범위 밖의 사실을 그대로 적는다**: `applyNetSetup()` 이 상대 로스터를 로컬에 적용하므로 클라이언트 메모리(`S.pieces`)에는 미공개 상대의 `rosterId` 가 이미 들어 있다. 이는 lockstep 결정론 재생을 위한 **현행 구조의 성질**이고 이번 변경이 만든 것이 아니다. 이번 구현의 요구는 "렌더 계층이 그것을 새로 노출하지 않을 것"이며 그 범위에서 충족했다.

### 2.4 안전 폴백 4종 (무한 고리·레이아웃 튐·정보 누출 없음)

| 상황 | 동작 |
|---|---|
| `rosterId` 없음(미배정 하수인·포획/예비 하수인) · 허용 목록 밖·오염된 ID | 경로를 **만들지 않고** 현행 텍스트 표시 |
| `icon.png` 로드 실패 | `onerror` 를 즉시 끊고 그 종만 실패 기록 → 1회 재렌더 → 같은 32×32 박스에 현행 텍스트. 정보 행은 유지 |
| `battle.png` 로드 실패 | **그 자리에서** 현행 속성색 원형 이모지 토큰으로 교체. `battleModal()` 재호출이 없어 메시지 재생·FX 에 재진입하지 않고 토큰 `id` 가 유지되므로 shake·ko·dmgfloat 경로가 그대로 산다 |
| `portrait.webp` 실패 | `portrait.png` **1회** 재시도 → 그것도 실패하면 같은 자리·같은 크기의 대체 표시(모달 레이아웃 불변). **Saturn 1차 QA 발견·수정(8.1)**: 초기판은 `@media (max-height:700px)` 128px 규칙이 `.rosterArt.fb`(192) **앞에** 있어 같은 특이성의 뒤 규칙이 이겨 짧은 화면에서 대체상자가 192로 커지고 버튼이 64px 밀렸다. 규칙 순서를 바꿔 고쳤고 실브라우저 roster-fb 18측정으로 128/192·버튼 top·모달 스크롤 보존을 확인했다 |

허용 목록은 `ART_DIRS = ROSTER.map(element_arch)` 20개다. 경로는 이 집합 밖의 값으로 **절대 만들어지지 않는다**(`../` 류 오염 ID 8종 검사 통과).

### 2.5 전투 — 지금 싸우는 전투원 기준

`const dir = pf===piece ? artDirOf(piece) : null` — **본체가 직접 싸울 때만** 그 말의 종 이미지를 쓴다. 대리 출전(포획·예비 하수인)은 `pf!==piece` 이므로 본체 그림을 쓰지 않는다.
왕·동료·포획 하수인은 `rosterId` 가 없어 **자동으로 현행 이모지 원형 토큰**이 유지된다(규격 6.3). 전투원 정보 패널·기술 공개(`revealedSkills`)·HP 바·상태·턴 선택·타이밍은 건드리지 않았다.

### 2.6 PD 실브라우저 지적 3건 반영

**(a) 🪤 함정이 빈 네모(두부)로 보임 — 실측으로 원인 확정**

헤드리스 Chrome 에서 MEMO_OPTS 8종의 글리프 폭을 폰트 스택별로 쟀다.

| 폰트 스택 | 결과 |
|---|---|
| `sans-serif` | 🪤 폭 11.0 = 두부 폭 11.0 |
| `"Segoe UI Emoji"` | 🪤 폭 7.1 = 두부 폭 7.1 |
| `"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji","Segoe UI Symbol",sans-serif` | 🪤 폭 7.1 = 두부 폭 7.1 |

나머지 7종은 모두 정상 폭이다. 즉 **이 환경(Windows 10 19045)에는 U+1FAA4 글리프가 어떤 설치 폰트에도 없다 — 폰트 스택 지정으로는 해결되지 않는다.** (`document.fonts.check` 는 8종 모두 true 를 돌려주므로 판정 근거로 쓸 수 없다.)

→ PD 지시대로 **텍스트 안전 폴백**을 넣었다. 기호 계약은 그대로 두고, 런타임에 실제 렌더 픽셀 확증으로 그릴 수 없다고 확인된 기호만 같은 뜻의 짧은 현행 라벨(함정·왕·동료·폭탄·불·물·풀·번개)로 되돌린다. 이미지 `onerror` 폴백과 같은 성격의 **표시 능력 폴백**이며 새 기호를 만들지 않는다. 측정이 불가능한 환경에서는 "지원함"으로 보아 기본 계약(이모지)을 유지한다.
확정 표시와 추측 메모에 **같은 규칙**을 적용했다 — 확정은 "함정" 텍스트인데 추측은 두부가 되는 불일치를 만들지 않기 위해서다.

**판정 정확성 (PD 지적 반영)**: "폭이 두부와 같다"만으로 미지원이라고 단정하면 우연히 같은 advance 를 갖는 정상 글리프까지 텍스트로 바뀐다. 그래서 폭 일치는 값싼 1차 거름으로만 쓰고, **같은 캔버스에 실제로 그려 본 픽셀이 미지원 글리프의 그림과 완전히 같은지**로 확증한다(`getImageData` 전 픽셀 비교, 결과 캐시). 실브라우저 오탐 가드로 `A·가·1·※·①·♛·☂·→·●·한` 10자를 매 측정마다 검사했고 **오탐 0건**, 미지원으로 판정된 것은 8종 중 🪤 하나뿐이다(64측정 전부 동일).

**한계(그대로 보고)**: 메모 피커(`memo-opt .ico`)와 사이드 메모 목록은 손대지 않았다. 두 곳은 기호 **옆에 한글 라벨이 이미 붙어 있어** 식별이 사라지지 않기 때문이다. 그 두 곳의 🪤 는 이 PC 에서 여전히 두부로 보인다 — 이는 이번 변경 이전부터 있던 상태이며, 확대 적용 여부는 CJ·Venus 판단 사항으로 남긴다.

**(b) 전투 도트 실패 시 전투원 자리가 비어 보임** → 2.4 의 즉시 교체로 수정. 스텁 테스트 J9~J13 으로 고정.

**(c) portrait 두 단계 모두 실패 시 자리 붕괴** → 같은 자리·같은 크기 대체 표시로 수정. F7~F9 로 고정.

---

## 3. 서버 — 수정 불필요 (Jupiter 라우팅 요청 없음)

읽기 전용으로 확인한 결과 **서버 코드 변경이 전혀 필요 없었다**.

| 확인 항목 | 사실 |
|---|---|
| 정적 루트 | `server/server.js:79-83` 가 `demo/` 를 자동 탐색 — `assets/minions/...` 가 그대로 서빙된다 |
| MIME | `server/security.js:186-197` 에 `.png` · `.webp` 이미 등록 |
| CSP | `img-src 'self' data:` — 동일 출처 상대경로 이미지 통과 |
| 경로 검사 | `resolveStaticPath` 의 세그먼트·깊이(4 ≤ 16)·문자 규칙에 걸리지 않음 |

실제 HTTP 로딩을 32회 측정해 전부 성공했다(4절). HTTP 검증은 기본 실행에서 필수이며 서버가 안 뜨면 실패(exit 1)로 보고된다.

---

## 4. 검증

### 4.1 기존 Node 회귀 (전부 통과 · 후속 수정 후 각 스위트 2회 실행, 결과 동일 · node 종료 코드 0 확인)

| 스위트 | 결과 | 비고 |
|---|---|---|
| `smoke_cycle5` | **69 / 69 PASS** | 이동·상성·폭탄·함정·밀어내기·왕 불가침·판정 + **AI vs AI 완주**. 시드 기능·비치팅 보존. **단언 0개 수정** |
| `smoke_tutorial` | **124 / 124 PASS** | 무수정 |
| `smoke_online` | **157 / 157 PASS** | 무수정 |
| `smoke_testclient` | **41 / 41 PASS** | 무수정 |
| `smoke_memo` | **49 / 49 PASS** | 단언 **2개 갱신**(아래) |
| `server && npm test` | **전부 통과** | 서버 무변경 확인 |

**`smoke_memo` 갱신 2건 — 약화가 아니라 강화**

- **B2**: "공개된 하수인 chip 에 이름 문자열이 있다" → "그 말의 **종 아이콘 src** 가 있고, 추측 이모지·`memo-guess`·`title`·추측 aria 가 없다". 판정 대상(실제 공개 시 실제 렌더 우선)은 그대로다.
- **C2**: "보드에 💣 문자가 없다" → 확정 표시가 같은 이모지 어휘를 쓰게 되어(P2 자기 폭탄 = 💣) 그 문자열은 더 이상 격리의 근거가 아니다. 대신 **추측이 새는 경로 전부** — `memo-guess` 클래스 · `class="guess"` 요소 · 추측 문구가 든 `title`/`aria-label` — 를 검사한다. 검사 범위를 **넓혔다**.

`harness.js` 변경은 **아트 심볼 노출 4줄 추가**뿐이다. 기존 단언·스텁 동작은 하나도 바뀌지 않았다.

### 4.2 신규 헤드리스 불변식 — `demo/test/smoke_minion_art.js` (**128 / 128 PASS**, 종료 코드 0 · 초기판 113 → Saturn 1차 QA 후속 수정으로 F10·H8a~h·J13a~h 추가, 무효 단언 2개 제거)

| 구간 | 개수 | 다루는 불변식 |
|---|---:|---|
| A | 11 | 20종 허용 목록 · 자산 실존 · 상대경로 · `rosterId` 없음/오염(8종)/미등록 → 경로 미생성 · 프리로드 일괄 |
| B | 17 | 양측 말 공통 아이콘 · 왕/동료/폭탄/함정 = 같은 메모 이모지 · 기호 출처 동일성 · 48/32/11/52 기하 · own inset |
| C | 20 | known/unknown/invisible · 미공개 말 DOM·경로·이름·HP 비노출 · **메모 8종 각각** · 비가시 말 미렌더 |
| D | 13 | HP 대상(하수인·동료·왕만) · 폭탄/함정 없음(시뮬 전체 공개 포함) · 0/1/2/3 자릿수 그대로 |
| E | 5 | 배치 트레이가 말판과 같은 규격 · 구 3단 텍스트 잔재 없음 |
| F | 11 | 로스터 설명창 portrait 연결 · 192/128 · 버튼 노출 · **2단계 폴백 실동작** · **F10 128px @media 규칙이 `.rosterArt.fb` 뒤에 오는지(소스 순서)** — 실계산값 판정은 CDP roster-fb(4.3) |
| G | 9 | 전투 토큰 하수인 128 · 왕 본체 이모지 유지 · **대리 출전 오용 차단** · 토큰 id 계약 |
| H | 16 | 로드 실패 폴백 · onerror 고리 없음 · 같은 32px 박스 · **실패 후 실제 이동(12,4→12,3 합법 빈칸)** — 좌표·주 행동 소모·이동 말 기록·강제 전투 없음·같은 턴 재이동 거부·재렌더 위치까지 확인. 이전 목적지 11,4 가 상대 칸이라 불법이었음을 H8a 로 고정 |
| I | 4 | **납품 아트 28파일 SHA-256 전부 일치 · 100파일 구조 그대로** |
| J | 22 | 글리프 폴백(있음/없음 양쪽) · **판정이 폭 비교가 아니라 렌더 픽셀 확증인지** · 확정·추측 일관 · 전투 도트 즉시 대체 · **J13a~h: 대체 내용 = 지금 싸우는 전투원의 기호·라벨·속성색, 숨김 경로 미사용(strict), 위치 클래스 보존, 전투 토큰이 아닌 노드는 대체하지 않음(분기 오판 검출), 실 문서 토큰 동일 객체, 실패 후 `__act("basic")` 실제 진행(HP·단계·로그)과 같은 id 노드에 FX(shake/ko/dmgfloat) 부착** |

구간 합계 11+17+20+13+5+11+9+16+4+22 = **128** (실행 시 단언 이름 첫 글자로 집계한 실측 개수).

> 초기 작성판의 C3/C7/C8 은 "그 문자열이 화면 어디에도 없다"로 판정해 **내 말과 상대 미공개 말이 우연히 같은 종일 때 오탐**했다(1/2 확률로 흔들림). 불변식을 "보드에 나타난 종 ⊆ 이미 공개된 말의 종" + "미공개 말 각각의 DOM 에 어떤 종 폴더명도 없다"로 고치고 시드를 고정했다. 검사는 더 촘촘해졌다.

### 4.3 실제 브라우저 실측 — `demo/test/minion_art_cdp.js` (**82 측정 · 문제 0건** · 종료 코드 0)

헤드리스 Chrome + CDP. **file:// 8 뷰포트 × 4 화면 + HTTP 8 뷰포트 × 4 화면 = 64** + **설명창 대체 표시 회귀 roster-fb: file/HTTP × 3 뷰포트 × 3 경우 = 18** (8.1).
**HTTP 검증은 기본 실행에서 필수다** — 서버가 뜨지 않으면 "생략"이 아니라 명시 실패로 기록하고 종료 코드 1 을 낸다(실패 경로 실증: 종료 코드 1 · `ERROR 필수 HTTP 검증 불가`). file 단독 실행은 `--no-http` 를 명시할 때만 정상 종료한다.
**확대율은 브라우저 UI 확대 조작이 아니라 CSS 뷰포트 축소 + DPR 배수 에뮬레이션이다.**

| 뷰포트 | CSS | DPR | 확대 | 아이콘 장치 픽셀 |
|---|---|---|---|---|
| desktop-1280 | 1280×800 | 1 | 100% | 32 |
| desktop-1280-dpr2 | 1280×800 | 2 | 100% | 64 |
| desktop-1280-dpr1.5 | 1280×800 | **1.5** | 100% | 48 |
| desktop-1280-zoom125 | 1024×640 | 1.25 | 125% | 40 |
| desktop-1280-zoom200 | 640×400 | 2 | 200% | 64 |
| desktop-1920 | 1920×1080 | 1 | 100% | 32 |
| mobile-390 | 390×844 | 2 | 100% | 64 |
| mobile-360 | 360×740 | 2 | 100% | 64 |

모든 조합에서 확인된 사실:

- **자산 로딩**: `file://` · `http://127.0.0.1` 양쪽 모두 아이콘 로드 실패 **0건**. `naturalWidth/Height = 32×32`, 표시 = 32×32, `image-rendering: pixelated`.
- **전투**: `battle.png` 원본 128 · 표시 128 · 스테이지 200px · **두 토큰 겹침 0건** (가장 좁은 281px 스테이지 포함).
- **설명창**: portrait 원본 512×512 · 표시 192(낮은 화면 128) · 모달 폭 초과 없음 · 버튼 2개 항상 노출.
- **설명창 대체 표시(roster-fb, Network.setBlockedURLs 실제 요청 차단)**: 1280×800 DPR1(192) · 1024×640 DPR1.25(128) · 360×640 DPR1(128) 각각 정상 / webp 차단→png 성공(natural 512) / webp·png 차단→`.fb` 대체상자(img 0) 세 경우 모두 **표시 크기 = 기대값, 버튼 top·일러스트 top·모달 scrollHeight/clientHeight 가 정상 경우와 동일**. 수치는 8.1 표.
- **기하**: `.pc` 48×48 아님 0건, 칸 밖 이탈 0건, 정보 행이 아이콘을 덮음 0건.
- **말판 그리드**: 칸 91개 · 칸 52px · **그리드 실측 영역 376×700 을 전 조합에서 확인**. (`#board` 컨테이너 폭은 블록 요소라 왼쪽 패널 폭을 따라가며 칸 크기와 무관하다 — 앞선 실행 로그의 `boardW=466` 은 컨테이너 값이었다. 그래서 둘을 분리해 기록하고 **판정은 그리드 실측값으로만** 한다.)
- **은닉**: 미공개 말에 `<img>` **0건**, 미공개 말 DOM 의 종 폴더명 노출 **0건**.
- **글리프**: `noGlyph=[🪤(함정)]` — 이 PC 에서 그릴 수 없는 기호는 정확히 1종. `ngShown=2` — 함정 두 말이 두부 대신 "함정" 텍스트로 표시됨. 정상 문자 10자 오탐 **0건**.

**뷰포트 회귀 — 시드 고정 변경 전/후 1:1 비교 (전 뷰포트 완전 동일)**

| 뷰포트 | 변경 전 `pageScrollW/viewport` | 변경 후 | 칸 | 말판 |
|---|---|---|---|---|
| desktop-1280 | 1280 / 1280 | **1280 / 1280** | 52 | 376×700 |
| desktop-1280-dpr2 | 1280 / 1280 | **1280 / 1280** | 52 | 376×700 |
| desktop-1280-zoom125 | 1024 / 1024 | **1024 / 1024** | 52 | 376×700 |
| desktop-1280-zoom200 | 722 / 640 | **722 / 640** | 52 | 376×700 |
| desktop-1920 | 1920 / 1920 | **1920 / 1920** | 52 | 376×700 |
| mobile-390 | 722 / 390 | **722 / 390** | 52 | 376×700 |
| mobile-360 | 722 / 360 | **722 / 360** | 52 | 376×700 |

→ 360·390px 의 가로 스크롤은 **변경 전에도 똑같이 있던 baseline**이고 이번 작업이 넓히지도 좁히지도 않았다(규격 14.5 "변경 전 대비 동일"). 전역 반응형 개편은 하지 않았다.

### 4.4 화면 증빙 — `docs/qa/minion-art-integration/` (PNG **70장** + 측정 JSON, 8.9MB)

`<scheme>_<viewport>_<1-tray|2-roster|3-board|4-battle>.png` (file/http × **7 뷰포트**(DPR 1·1.5·2 및 125%·200% 포함) × 4 화면 = 56장, 이번 실행에서 전부 정상 갱신)
+ 실패 경로 증빙 `<scheme>_<viewport>_<5-roster-webpfail|6-roster-allfail>.png` (file/http × desktop-1280 · desktop-1280-zoom125 · **mobile-360-short**(360×640 DPR1, 신규) = 12장) + `<scheme>_mobile-360-short_2-roster.png` 2장 = **신규 14장**.
`desktop-1280`·`desktop-1280-zoom125` 의 `_2-roster.png` 는 본 루프와 roster-fb 정상 경우가 같은 이름으로 두 번 저장한다(뒤 저장본이 남음 · 같은 화면). 그래서 **캡처 호출은 74회, 저장된 고유 PNG 파일은 70장**이다. JSON 의 `shots` 는 고유 경로 70개(디스크 인벤토리와 1:1 일치 확인), `captures.count`=74 와 `captures.overwrites`(덮어쓴 경로 4개)는 따로 기록한다(8.6).
측정 원본: `minion_art_cdp_report.json` — `html` 필드는 저장소 상대경로(`demo/index.html`)로 기록한다(이식성 · 8.3).

**Saturn 독립 재검증용**: `node demo/test/minion_art_cdp.js --read-only` 는 **검증 산출물 0** — 스크린샷·보고서 JSON·스크립트 출력 파일을 만들지 않고 요약과 측정 JSON 을 stdout 으로만 낸다. Saturn 의 `files_modified=[]` 계약을 그대로 지키면서 같은 82 측정을 재실행할 수 있다.
**단, 헤드리스 Chrome 자체의 임시 프로필(`os.tmpdir()/artcdp-*`)은 실행 부수 리소스로 생성된다** — "파일을 하나도 만들지 않는다"는 표현은 부정확했다(Saturn 1차 QA P3, 8.3). 스크립트는 이 실행이 `mkdtemp` 로 만든 정확한 경로 하나와 Chrome/QA 서버 PID 를 `RESOURCE …` 행으로 stdout 에 남기고, 종료 시 `CLEANUP … guard=true removed=true` 로 정리 결과를 남긴다. 와일드카드 정리는 하지 않는다.

### 4.5 검증하지 않은 것 (그대로 남긴다)

- **선명도·대비·20종 사람 식별성** — 숫자로 대체하지 않는다. 스크린샷의 사람 검수(Saturn·CJ) 소관이다. 특히 규격 AC 10 의 "말 컨테이너 배경·테두리·own 강조·반투명 표식이 겹친 상태의 실제 대비"는 여기서 판정하지 않았다.
- **Chrome 이외 브라우저**(Firefox·Safari·Edge) — 이 환경에 없어 측정하지 못했다. 글리프 커버리지는 OS·브라우저·폰트 설치 상태마다 다르므로 🪤 폴백 발동 여부도 환경마다 달라진다(그것이 런타임 판정으로 만든 이유다).
- **실기기 모바일** — 데스크톱 모드 뷰포트 에뮬레이션이며 실제 단말이 아니다. (`mobile:true` 에뮬레이션은 `#app` 고정폭 때문에 레이아웃 뷰포트가 722 로 넓어져 CSS 검증이 되지 않는다 — `tut_layout_cdp.js` 의 기존 관측과 동일.)
- **권리 체인·상용 캐릭터 유사성**(AC 8) — 이번 범위 밖이며 어떤 승인으로도 해소되지 않는다.
- **Saturn READ_ONLY QA · CJ 플레이 QA** — 미판정.

---

## 5. 변경 파일과 해시

| 파일 | 상태 | SHA-256 |
|---|---|---|
| `demo/index.html` | 수정 (Saturn 1차 QA 후속: CSS 규칙 순서 1건 · 8.1) | `1c172a638307046258c2e794ab22a28b6587029d04f17337269252cfd69a11e3` (1차 QA 기준 `9a102ee0…`) |
| `demo/test/smoke_minion_art.js` | **신규** (후속: F10·H8a~h·J13a~h) | `ddebec86dbc58cebac81f8c49d08f53330914725ee0fcf3de26ac8bab6fc77e7` (1차 QA 기준 `049c45d6…`) |
| `demo/test/minion_art_cdp.js` | **신규** (후속: roster-fb 18측정 · RESOURCE/CLEANUP · 문구 · 상대경로 JSON · **shots 고유 경로/captures 분리**) | `d2f044b891deaf5e40c73f9805493438c0d356a9bc21eeefbe11350118bca75a` (1차 QA 기준 `e5d3aa9c…` · 후속 1차 `2a0d1380…` · 8.6 기준 `889e508d…` — 8.7 공백 전용 변경) |
| `demo/test/harness.js` | 수정 (+4, 심볼 노출만) | `2381e0ec51fd56af3e63ccd40e3ca4a9a39731105af14a4e4394f3f30d813e0b` |
| `demo/test/smoke_memo.js` | 수정 (단언 2건 갱신) | `c14f63437e8edeeb4f58689fa011db03bcf036365556396ac7650bd7ae6ed00a` |
| `docs/qa/minion-art-integration-mars.md` | **신규** (이 문서) | — |
| `docs/qa/minion-art-integration/` | **신규** PNG 70장 + JSON 1 (8.9MB) | JSON `ccb168e46dc7e7be0a48633497e681d06754080986cd9725fa90c068a18531d2` (인벤토리 정정 전 `8bfc543d…`) |

### 건드리지 않은 것 (확인 완료)

- **아트 100파일 · `pixel-sources/` · `battle-patches/` · `tools/minion_art.py` · `tests/` — 변경 0건.** `git status` 로 확인했고, `delivery-manifest.csv` 28행 SHA-256 전수 대조가 테스트 I3 으로 매 실행 검증된다.
- `server/` 코드 무변경. `server/node_modules/` 만 `npm ci` 로 설치했다(gitignore 대상).
- 사용자 소유 `art/` · `orca-hook-latency-report.md` — 열지도 스테이징하지도 않았다.
- `CLAUDE.md` · `README.md` · `docs/creat2ve/HANDOVER_SNAPSHOT.md`(PD 소유) · `docs/minion-visual-spec-v0.4.3.md`(Venus 소유) — 편집하지 않았다. 작업 중 이 파일들과 `demo/assets/minions/README.md` · `docs/art/minions-v0.4.3/README.md` 가 다른 Worker 에 의해 바뀌어 있었고 **그대로 두었다**.
- Git 쓰기(add/commit/push) · Issue · PR · Notion — 전부 PD 소관이므로 하지 않았다.

### QA 프로세스 정리

검증용 HTTP 서버는 `PORT=0` 임의 포트 · 루프백 바인드로 **이 스크립트가 spawn 한 자식 프로세스만** 사용하고 종료 시 그 핸들로만 정리했다. 사용자가 켜 둔 서버(8080)와 사용자 브라우저는 건드리지 않았다.
헤드리스 Chrome 임시 프로필은 **이번 실행이 `mkdtemp` 로 만든 정확한 경로 하나**만 동기 삭제하도록 스크립트를 고쳤다(지연 타이머는 `process.exit` 뒤에 돌지 않아 찌꺼기가 남았었다). 작업 중 한 차례 `Temp/artcdp-*` 와일드카드 삭제를 쓴 적이 있으나 PD 지적 이후 중단했고, 이후에는 광범위 prefix glob 삭제를 쓰지 않았다.
최종 확인: QA node 서버 잔여 **0** · QA headless chrome 잔여 **0** · 임시 프로필 디렉터리 잔여 **0**.

---

## 6. 재현 명령

```bash
# 헤드리스 규칙·표시 회귀
node demo/test/smoke_cycle5.js        # 69/69 — 규칙 + AI vs AI 완주
node demo/test/smoke_memo.js          # 49/49
node demo/test/smoke_tutorial.js      # 124/124
node demo/test/smoke_online.js        # 157/157
node demo/test/smoke_testclient.js    # 41/41
node demo/test/smoke_minion_art.js    # 128/128 — #89 신규 불변식

# 실제 브라우저 실측 + 스크린샷 (file:// 와 루프백 HTTP) — 64 기본 측정 + roster-fb 18 측정
node demo/test/minion_art_cdp.js                # 82 측정 · PNG 파일 70장 (캡처 74회) (HTTP 필수 — 서버 실패 시 exit 1)
node demo/test/minion_art_cdp.js --read-only    # Saturn 재검증용: 검증 산출물 0 (스크린샷·보고서 없음), stdout 만 — Chrome 임시 프로필은 부수 생성·정리(RESOURCE/CLEANUP 행)
node demo/test/minion_art_cdp.js --no-http      # file:// 단독 (명시 opt-out)
```

종료 코드는 파이프 마지막 명령이 아니라 `node` 자체의 종료 코드로 확인한다 (bash: `node … > log 2>&1; echo $?`).

---

## 7. Saturn·CJ 에게 남기는 판단 항목

1. **원형 → 라운드 사각**(규격 7.3 A안)은 기하 요구에서 나온 **엔지니어링 선택**이지 CJ 의 미적 지시가 아니다. 원형 유지를 원하면 B안(원형 48 · 원소 기호 병기 포기)으로 되돌린다.
2. **32px 아이콘의 실제 식별성·배경 대비** — 저장한 스크린샷으로 판정 요망. 기계 수치는 이를 대체하지 않는다.
3. **🪤 텍스트 폴백의 수용 여부**와, 메모 피커·사이드 목록까지 확대할지 여부.
4. **Chrome 이외 브라우저·실기기 모바일** 확인은 미수행.

---

## 8. Saturn 1차 REVISE 3건 후속 수정 (2026-09-07 · task_9760cc23c7c1 / ctx_6b157bd965ae)

QA 원문: `docs/qa/minion-art-integration-saturn-initial.md` (Mercury 보존, 이 수정에서 편집하지 않았다). 아래는 **수정 전 재현 → 수정 → 수정 후 결과**를 명령·수치·해시로 적는다. 최종 PASS 판정은 Saturn 소관이다.

### 8.1 P2 제품 결함 — 짧은 화면에서 portrait 이중 실패 시 대체상자 128 → 192 확대

**원인 (확정)**: `demo/index.html` CSS 에서 `@media (max-height:700px){ .rosterArt img,.rosterArt.fb{width:128px;height:128px} }` 가 `.rosterArt.fb{width:192px;height:192px;…}` **앞**에 있었다. 두 선택자는 특이성이 같아(0,2,0) 소스 순서로 승자가 정해지고, 뒤의 192 규칙이 항상 이겼다. `img` 쪽은 `.rosterArt img`(0,1,1) < `@media` 안 `.rosterArt img`(같은 0,1,1이지만 뒤) 라서 정상이었고, **대체상자 `.fb` 만** 잘못됐다.

**수정**: `@media` 블록을 `.rosterArt.fb` 규칙 **뒤로** 옮겼다(값·선택자 무변경, 주석 추가). `demo/index.html` 의 다른 부분은 건드리지 않았다.

**수정 전 재현 (실브라우저)** — 수정 전 순서로 되돌린 사본(스크래치 경로, 저장소 밖)을 `--html` 로 지정해 같은 스크립트로 쟀다. 명령: `node demo/test/minion_art_cdp.js --html <사본> --no-http --read-only` → **node 종료 코드 1, 41 측정 · 문제 2건**:

| 뷰포트 | 경우 | 표시 | 버튼 top | 모달 scroll/client | 판정 |
|---|---|---:|---:|---|---|
| 1280×800 DPR1 | normal / webpfail / allfail | 192 / 192 / 192 | 405 / 405 / 405 | 465/465 | 정상 (desktop 은 결함 없음) |
| **1024×640 DPR1.25** | normal / webpfail | 128 / 128 | 341 / 341 | 401/401 | 정상 |
| **1024×640 DPR1.25** | **allfail** | **192** | **405** | **465/465** | **결함 재현** — 128 기대, 버튼 64px 밀림 |
| **360×640 DPR1** | normal / webpfail | 128 / 128 | 375 / 375 | 435/435 | 정상 |
| **360×640 DPR1** | **allfail** | **192** | **439** | **499/499** | **결함 재현** |

**수정 후 (실브라우저)** — `node demo/test/minion_art_cdp.js` (기본 실행: file + HTTP, 스크린샷·JSON 저장) → **node 종료 코드 0, 82 측정 · 문제 0건 · PNG 파일 70장(캡처 74회, `_2-roster` 4개 덮어쓰기 — 8.6)**. `--read-only` 별도 실행도 **82 측정 · 문제 0건 · 종료 코드 0**. roster-fb 18 측정값(file/http 동일):

| 뷰포트 | 기대 | normal | webpfail (png 재시도) | allfail (`.fb`) | 버튼 top (3경우) | 모달 scroll/client (3경우) |
|---|---:|---|---|---|---|---|
| 1280×800 DPR1 | 192 | 192 · webp 512 로드 | 192 · png 512 로드 | 192 · img 0 · "이미지를 불러오지 못했습니다" | 405 / 405 / 405 | 465/465 ×3 |
| 1024×640 DPR1.25 | 128 | 128 · webp 512 | 128 · png 512 | 128 · img 0 | 341 / 341 / 341 | 401/401 ×3 |
| 360×640 DPR1 | 128 | 128 · webp 512 | 128 · png 512 | 128 · img 0 | 375 / 375 / 375 | 435/435 ×3 |

일러스트 top 은 전 경우 55 로 동일. 차단은 `Network.setBlockedURLs`(`*/portrait.webp`, `*/portrait.png`) + `Network.setCacheDisabled(true)` 로 **실제 요청**을 막았고 file://·HTTP 양쪽에서 동작했다. 증빙 PNG: `<scheme>_{desktop-1280,desktop-1280-zoom125,mobile-360-short}_{5-roster-webpfail,6-roster-allfail}.png` 12장 + `<scheme>_mobile-360-short_2-roster.png` 2장. 기존 64 측정도 같은 실행에서 문제 0 으로 재확인했다.

**헤드리스 보완**: F10 은 소스 순서만 검사한다(문자열 검사만으로 CSS 128 을 검증했다고 말하지 않는다). 수정 전 순서 사본으로 `node demo/test/smoke_minion_art.js <사본>` 실행 시 **F10 만 실패(127/128, 종료 코드 1)** 하는 것을 확인했다.

### 8.2 P2 테스트 결함 — H8 `…!==false||true` · J13 `…||true` 무효 단언

두 단언은 **삭제하지 않고 실제 실패를 잡는 검사로 교체**했다. 교체 전 `node demo/test/smoke_minion_art.js` 는 113/113, 교체 후 **128/128 (종료 코드 0)**. 교체 과정에서 실제로 실패했다가 고친 것: J13e 는 스텁 요소에 `id` 가 없어 제품이 숨김 경로로 갔고(스텁에 `id="tok-A"` 를 붙여 실제 DOM 과 같게 함), J13g 는 제품이 `msgBox.nodeType===1` 인 실제 DOM 에서만 메시지·FX 를 재생해 스텁에서 FX 가 붙지 않았다(스텁 `msgBox.nodeType=1` 로 그 경로를 켬). 두 경우 모두 **제품 코드가 아니라 테스트 환경**을 고친 것이다.

| 단언 | 내용 | 실패하는 경우 |
|---|---|---|
| H8a | 이전 목적지 11,4 는 보이는 상대 말이 있는 칸 → `canMoveTo` false | 규칙이 바뀌어 상대 칸 이동이 허용되면 |
| H8b·c | 12,3 은 빈칸이고 합법 이동 | 전제 붕괴 |
| H8d | `doMove(me,12,3)` 후 실제 좌표 12,3 · `at(12,3)===me` · 12,4 비어 있음 | 이동이 no-op 이거나 다른 칸으로 가면 |
| H8e | `S.mainUsed===true` · `S.movedPiece===me` · `movedEver` | 주 행동이 소모되지 않으면 |
| H8f | `phase==="play"` · 전투 없음 · 강제 전투 목록 비어 있음 | 이동 후 엉뚱한 전투·상태 전이 |
| H8g | 같은 턴 두 번째 이동 거부 | 주 행동 소모가 규칙에 반영되지 않으면 |
| H8h | 재렌더 후 12,3 에 폴백 텍스트 말(정보 행 포함), 12,4 는 비어 있음 | 렌더가 이동을 반영하지 않으면 |
| J13a | 대체 내용이 정확히 `B.fa` 의 속성 이모지 + `<small>속성명</small>`, 배경 `var(--속성)` | 다른 말·빈 내용·다른 배경 |
| J13b | `img.style.display!=="none"` (strict) | 대체 대신 숨김 경로로 갔으면 |
| J13c | `btok`·`tok-me` 유지, `art` 만 제거 | 위치 클래스가 사라지면 |
| J13d | 전투 토큰이 아닌 노드(`tok-X`) 는 대체하지 않고 숨김만 | 분기 오판으로 아무 노드나 고쳐 쓰면 |
| J13e | 실 문서 토큰 `tok-A` 도 같은 객체 그대로 대체 (`byId("tok-A")===live`) | 노드를 교체하면 |
| J13f | 실패 후 `__act("basic")` → HP·단계·로그 중 하나 이상 변화 | 실패가 전투 진행을 막으면 |
| J13g | 같은 id 노드에 shake/ko/dmgfloat 중 하나 이상 부착 | FX 가 다른 노드에 가거나 사라지면 |
| J13h | 진행 후에도 id 유지·`art` 미복원 | 실패 종을 다시 요청하면 |

### 8.3 P3 문구 결함 — `--read-only` 의 "파일 생성 0"

`demo/test/minion_art_cdp.js` 헤더·상수 주석·READ_ONLY 로그·요약 행과 이 보고서 4.4·6절의 표현을 **"검증 산출물 0(스크린샷·보고서 JSON·스크립트 출력 파일 없음)"** 으로 고치고, **Chrome 임시 프로필은 실행 부수 리소스로 생성·정리**된다고 명시했다. 스크립트는 이제 정확한 생성 경로·PID 만 추적한다:

```
RESOURCE chrome pid=<pid> profile=<os.tmpdir()>/artcdp-XXXXXX
RESOURCE qa-server pid=<pid> addr=127.0.0.1:<임의 포트>
CLEANUP chrome pid=<pid> killed=true profile=<같은 경로> guard=true removed=true qa-server pid=<pid> killed=true
```

`guard` 는 삭제 직전 `path.resolve` 한 절대경로가 `os.tmpdir()` 바로 아래의 `artcdp-` 접두 디렉터리인지 검사한 결과이며, 통과할 때만 그 경로 하나를 재귀 삭제한다. 이번 세 실행(수정 전 재현 `artcdp-jjgSKG`, 수정 후 기본 `artcdp-bZlT3P`, 수정 후 read-only `artcdp-9fNRdx`) 모두 `removed=true` 이고 실행 후 `Temp` 에 `artcdp-*` 잔여 0, headless chrome 잔여 0 을 확인했다. 사용자 서버(8080)·브라우저는 건드리지 않았다.

JSON 보고서의 `html` 필드는 작업 공간 절대경로(`C:\\Users\\…\\demo\\index.html`) 대신 **저장소 상대경로 `demo/index.html`** 로 기록한다.

### 8.4 이번 수정에서 손대지 않은 것

- 제품 코드 변경은 **CSS 규칙 순서 1건**뿐이다. 규칙·수치·AI·가시성·정보 은닉·서버 코드 무변경. `demo/test/harness.js`(`2381e0ec…`)·`smoke_memo.js`(`c14f6343…`) 는 1차 QA 기준 해시 그대로다.
- 아트 100파일·픽셀 원고·도구 무변경(I3 SHA-256 28행 대조 통과). `art/`·`orca-hook-latency-report.md`·PD 소유 문서(`CLAUDE.md`·`README.md`·스냅샷·규격)·Saturn QA 원문은 열람만 했다.
- Git·GitHub·Notion 쓰기 없음.
- 헤드리스 회귀 재실행: `smoke_cycle5` 69/69 · `smoke_memo` 49/49 · `smoke_tutorial` 124/124 · `smoke_testclient` 41/41 · `smoke_online` 157/157 · `smoke_minion_art` 128/128 — 각 2회, node 종료 코드 전부 0. 서버 `npm test` 는 서버 무변경이라 재실행하지 않았다.

### 8.5 한계

- 실브라우저 판정은 Windows Chrome headless CDP 하나다. 실제 브라우저 UI 확대 조작·실기기 모바일·다른 엔진은 여전히 미측정이다.
- roster-fb 는 `rosterInfo("M-F1")` 한 종으로 잰다. 대체상자 CSS 는 종과 무관하지만 20종 전부를 돌리지는 않았다.
- QA 최종 PASS/REVISE 는 Saturn 이 판정한다. 이 절은 구현자 증빙이다.

### 8.6 인벤토리 정정 (2026-09-07 · task_d2089e89ce7a / ctx_17c9449a3717)

Mercury 지적: JSON `shots` 배열 길이 74 ≠ 실제 고유 PNG 70 (`_2-roster` 4개 중복). 원인은 roster-fb 정상 경우가 `desktop-1280`·`desktop-1280-zoom125` 의 `_2-roster.png` 를 본 루프와 같은 이름으로 다시 저장하면서 `shots` 에 경로를 중복 push 한 것이다.

- `demo/test/minion_art_cdp.js`: `shots` 는 **고유 경로만**(파일 인벤토리), 캡처 호출 수와 덮어쓴 경로는 `captures:{count,overwrites}` 로 분리 기록. 요약 행도 "스크린샷 파일 N장 (캡처 M회 · 같은 이름 덮어쓰기 K회)" 로 바꿨다. 제품 코드·측정 로직 무변경.
- 출력 1회 재생성: `node demo/test/minion_art_cdp.js` → 종료 코드 0 · **82 측정 · 문제 0건 · 스크린샷 파일 70장 (캡처 74회 · 덮어쓰기 4회)**. JSON `shots` 70 = 고유 70 = 디스크 PNG 70 (정렬 비교 1:1 일치), `captures.count` 74, `captures.overwrites` = `file_desktop-1280_2-roster` · `file_desktop-1280-zoom125_2-roster` · `http_desktop-1280_2-roster` · `http_desktop-1280-zoom125_2-roster`. 디렉터리 총 71파일(PNG 70 + JSON 1).
- 해시: `demo/test/minion_art_cdp.js` `889e508df6e2f2299cb0f021bede6a41cf4dcd07a8bdd28b0c4eac4eb4cbbb0b` (8.7 공백 전용 변경으로 현재 `d2f044b8…`) · JSON `ccb168e46dc7e7be0a48633497e681d06754080986cd9725fa90c068a18531d2` · `demo/index.html` `1c172a63…` 불변 · `smoke_minion_art.js` `ddebec86…` 불변.
- 부수 리소스: Chrome `artcdp-keRxEy` guard=true removed=true, QA 서버 종료, `Temp/artcdp-*` 잔여 0. `art/`·`orca-hook-latency-report.md`·Downloads 무접촉. Git/GitHub/Notion 쓰기 없음.

### 8.7 공백 전용 정정 (2026-09-07 · task_ef7852501434 / ctx_48b327b89061)

`git diff --cached --check` 가 지적한 `demo/test/minion_art_cdp.js` 292행(`fs.writeFileSync` 행) 끝의 후행 공백 1개만 제거했다. **공백 전용 delta** — 로직·측정·출력 형식 변경 없음, CDP 재실행·스크린샷·JSON 재생성 없음(측정 원본과 PNG 70장·JSON SHA 는 8.6 그대로).

- 검증: `node --check demo/test/minion_art_cdp.js` 통과 · `git diff --check` 후행 공백 0건 · 변경 diff 는 292행 1줄(공백 삭제)뿐.
- 해시: `demo/test/minion_art_cdp.js` 8.6 `889e508df6e2f2299cb0f021bede6a41cf4dcd07a8bdd28b0c4eac4eb4cbbb0b` → **`d2f044b891deaf5e40c73f9805493438c0d356a9bc21eeefbe11350118bca75a`**. `demo/index.html`·`smoke_minion_art.js`·아트 파일 불변.
- 이 보고서 자체는 SHA 표기 갱신(5.x 표 · 8.6 해시 행)과 EOF 잉여 빈 줄 제거만 했다. `art/`·`orca-hook-latency-report.md`·Downloads 무접촉. Git/GitHub/Notion 쓰기 없음. QA 판정은 Saturn 소관이다.
