# Digit Dual — Roblox 포팅 (Phase 3: 3D 로비 · 보드게임 창 · AI 봇)

HTML 데모(`demo/index.html` — 규칙 기준 **v0.4.7 전량** — #121·#125·#129 + #146·#131·#130 반영)의 Roblox 포팅. CJ 결정(2026-09-09)으로 플랫폼 방향을 Roblox로 전환했다 (Ref #118).

## 구조

```text
roblox/
├─ default.project.json      # Rojo 프로젝트 (Studio 동기화)
├─ src/
│  ├─ shared/                # ReplicatedStorage.Shared — 순수 Luau (Roblox API 미사용)
│  │  ├─ Config.luau         # 규칙 상수 (BAL — 표시 상수 제외)
│  │  ├─ Rng.luau            # mulberry32 (JS와 비트 동일 수열)
│  │  ├─ Data.luau           # SKILLS·ROSTER·아키타입 템플릿·아이템
│  │  ├─ Engine.luau         # 코어 룰 엔진 (보드·턴·이동·접촉·탐색·포획·밀기·도망)
│  │  ├─ Battle.luau         # 전투 시스템 (Engine 에 부착)
│  │  ├─ Ai.luau             # PVE AI (5급 휴리스틱 · 5단 탐색) — 봇 배치·턴·전투·보류 선택 정책
│  │  ├─ Banner.luau         # 엔진 로그 → 중앙 배너·전투 연출 판정 (표시 계층 · 테스트 [12]·[14])
│  │  └─ Views.luau          # 뷰어별 정보 은닉 직렬화
│  ├─ server/
│  │  ├─ init.server.luau    # 매치메이킹 + 서버 권위 세션 + 재접속 유예
│  │  └─ Stats.luau          # 전적 저장 (DataStore · 실패 시 메모리)
│  └─ client/                # StarterPlayerScripts.Client (LocalScript + 자식 ModuleScript)
│     ├─ init.client.luau    # 본체 — 로비 HUD·보드게임 창·판·전투·서버 메시지 처리
│     ├─ Ui.luau             # UI 만들기 헬퍼 + 화면 맞춤(UIScale) + 연출 재생기
│     ├─ BannerUi.luau       # 화면 중앙 배너
│     ├─ LogUi.luau          # 📜 게임 기록 (사이드 14줄 + 전체 300줄 창)
│     ├─ MemoUi.luau         # 📝 추측 메모 (내 화면 전용)
│     └─ RosterDetail.luau   # 로스터 종 상세 팝업
└─ tests/run.luau            # 헤드리스 테스트 (luau CLI — Roblox 불필요)
```

**클라이언트를 왜 나눴나**: Luau 는 **함수 하나가 지역 변수를 200개까지만** 쓸 수 있는데 `init.client.luau` 는 전부 최상위 스코프라 그 예산을 통째로 공유한다. 2026-09-10 전투 연출을 붙이다 한도에 걸려(`Out of local registers`) 빌드가 멈췄고 — 게다가 오류가 **새로 추가한 줄이 아니라 뒤쪽의 아무 함수**를 가리켜 원인을 엉뚱한 데서 찾게 된다 — 자족적인 표시 계층부터 자식 ModuleScript 로 뺐다. 본체 209 → **168개**. `tools/rbxcheck.js` 가 170 을 넘으면 경고하고 190 을 넘으면 실패시켜 다시 벽에 닿기 전에 알린다.

## 아키텍처: 서버 권위 (HTML 락스텝과 다른 점)

HTML 온라인 모드는 비권위 릴레이 + 시드 락스텝(양 클라이언트가 같은 시드로 같은 게임을 재생)이었다.
Roblox는 서버가 Luau를 직접 실행하므로 **서버 권위**로 전환했다:

- 엔진(규칙·난수)은 서버에서만 돈다. 클라이언트는 액션 `{t=...}`만 보낸다.
- 서버가 액션을 검증(자기 턴·자기 말·규칙 충족)하고 적용한 뒤, **뷰어별로 필터링된 상태**를 내려보낸다.
- 숨은 정보(미공개 정체·숲 은신 위치·상대 인벤토리·미공개 기술)는 클라이언트에 아예 전송되지 않는다 — 메모리 치팅 원천 차단.
- HTML의 모달 선택(출전 선택·포획·기술 교체)은 `S.pending` 상태 + 명시적 액션으로 재구성했다.

### 액션 프로토콜 (클라 → 서버)

| 액션 | 페이로드 | HTML 대응 |
|---|---|---|
| `queue` | `{setup={roster,pos}}` | 사전 배치 → 매칭 (#50) |
| `move` | `{id,r,c}` | cell 클릭 이동 |
| `battle` | `{attId,defId}` | cell 클릭 전투 지정 |
| `search` | `{id}` | 탐색 |
| `tele` | `{aId,bId}` | 텔레포트 스왑 (2클릭 → 1액션) |
| `heal` | `{id}` | #106 회복 주 행동 |
| `skipMain` / `endTurn` / `resign` | | 동일 |
| `vipPick` | `{use="body"\|"cap"}` | vipChoice 모달 |
| `recruitSwap` / `capTry` / `recruitKeep` | `{skill,targetId,slot=1..4}` / `{mode,recvId}` | #121 탐색 보상 선택 (기술 교체 · 숲 포획 · 포기) |
| `gift` / `buff` | `{pick=potion\|cool\|cure\|ball}` / `{kind=power\|time\|escape}` | #121 패키지 개봉·전투 버프 (무료 보너스 행동) |
| `act` | `{k=1..4\|"basic"}` | 전투 4슬롯 (JS 0~3 → **1~4**) |
| `item` / `ball` / `flee` | `{i=인벤 인덱스}` | 전투 보너스 행동 (#146: 도망 HP 조건 없음·기본 30%·수호자 70%) |
| `pass` | | #146 4슬롯 전부 불가 시 수동 행동 넘기기 (기본 공격 대체) |
| `fleeSwap` / `fleeSkip` | `{id}` | #114 도망 교환 |

## 실행

### 플레이 흐름 (Phase 3 — 보드게임 창 · AI 봇, CJ `roblox/구조.txt` 2026-09-10)
**2인 대전**: 로비 스폰 → 테이블 의자 앞에서 **[E] 앉기** → 맞은편에 상대가 앉으면 판 앞 **[F] 게임 시작**(Enter · HUD 버튼도 가능) → 화면 중앙에 **보드게임 창**이 뜬다 (캐릭터는 숨고 창이 닫힐 때까지 일어나기 불가). 창 **왼쪽 = 2D 판(7×13)**, **오른쪽 = 로스터 20종 중 6종 선택 → 배치 트레이** (손에 든 말을 판의 강조된 내 진영 3행 칸에 클릭, 회수·남은 말 무작위·전체 회수·⚡ 전부 무작위). 14개를 다 놓으면 **[배치 완료 ✔]** 활성 → 둘 다 완료하면 자동 대전. 대전도 같은 창(왼쪽 판 클릭 이동·공격, 오른쪽 탐색·텔레포트·회복·턴 종료), 전투·출전 선택·포획·기술 교체는 별도 창. 창은 **오른쪽 맨 아래 [🚪 나가기]** 로만 닫히며(대전 중이면 기권) 그때 다시 걸어 다닐 수 있다 — 탐색·텔레포트 같은 게임 행동 버튼과 떨어뜨려 뒀다.
**1인 대전(AI)**: 혼자 앉은 뒤 **[B] 5급 봇 / [N] 5단 봇**(HUD 버튼도 가능) → 맞은편에 로봇이 앉고 로스터·배치를 자동으로 마친다 → 나만 [배치 완료 ✔] 를 누르면 시작. 창 오른쪽 위 토글로 배치 완료 전까지 난이도를 바꿀 수 있다. 봇은 서버에서 `Ai.luau`(HTML 5급 휴리스틱·5단 탐색 AI 그대로, 공정 관측)로 0.65초 간격으로 한 행동씩 진행하며 "🤖 AI 행동 중…" 이 표시된다.
- **전투 연출**: 피해·보호막·회복·화상·약화·감전·드래곤/마녀/사신·포획·도망은 전투 창에서, 폭탄·함정·포획·도망은 배너 안에서 **스프라이트 연출**(8프레임 ≈ 0.44초)이 한 번 재생된다. 표시 전용이라 **입력을 막지 않는다** — 판정은 `src/shared/Banner.luau`(테스트 [14]), 자산은 `roblox/assets/fx/`. 적용 기록은 `art-apply-report.md` 3e·3f.
- 접촉·폭탄·함정·탐색 발견·획득·전투 개시/종료·턴 전환·경기 결과는 화면 **중앙 배너**(1.2초)로도 알린다 — HTML 데모의 배너 연출과 같은 순간이며, 판정은 `src/shared/Banner.luau`(테스트 [12]). 배너 전용 아트 적용 완료 (`art-apply-report.md` 3d).
- 판 위 말 정보는 서버 필터 뷰만 내려온다 — 미공개 말은 정체 없이 표시. 봇도 같은 `Engine:apply` 검증을 지나므로 사람보다 더 할 수 있는 일이 없다.
- UI 아트(P0 129 PNG): 패널·버튼 4상태·배지·HP/방어막 바·상태/아이템/행동/기술 종류/속성/흔적 아이콘 전량 연결 — 계약은 `roblox/assets/ui/README.md`, 적용 위치는 `docs/roblox/art-apply-report.md` 3b. 보드게임 창 프레임·봇 메시·난이도 배지·AI 행동 중 아이콘까지 적용 완료 (`art-apply-report.md` 3c).
- **기록 보기**: 창 오른쪽 패널에는 최근 14줄만 나온다. **[📜 기록]** 버튼을 누르면 이번 대전의 **전체 기록(최근 300줄)** 이 번호와 함께 스크롤 창으로 열리고, 새 줄이 들어올 때마다 같이 갱신된다 — 내 화면 전용이라 서버로 아무것도 보내지 않는다. 게임 밖 로그(오류·서버 `print`/`warn`)는 **F9 개발자 콘솔**(Studio 는 Output 창)에서 본다.
- 설계: [docs/roblox/lobby-design.md](../docs/roblox/lobby-design.md) · 아트 적용 보고: [docs/roblox/art-apply-report.md](../docs/roblox/art-apply-report.md) · 아트 요청: [earth-art-request.md](../docs/roblox/earth-art-request.md) / [earth-lobby-request.md](../docs/roblox/earth-lobby-request.md)

### Studio 테스트 (2인 로컬)
1. `build.bat` 실행 → `build/DigitDual.rbxl` 생성 (rojo.exe 는 `build/` 에 두며 git 에 올리지 않는다 — 없으면 bat 이 다운로드 링크를 안내)
2. Roblox Studio 로 `build/DigitDual.rbxl` 열기 → Test 탭 → **Clients and Servers: 2 Players** → Start
3. 클라이언트 창 2개에서 각각 같은 테이블의 의자에 [E] 앉기 → [배치 완료] → 대전. 화면 하단 진단 푸터에 client/server 버전·모듈·UI 로드 상태가 표시된다
4. 다른 PC 의 친구와 하려면 게시 후 접속 (아래) — 공개 전이면 Studio 팀 테스트(Team Create + 협업 편집 권한 → Test → Team Test)

코드를 고친 뒤에는 `build.bat` 을 다시 돌려 rbxl 을 갱신한다. 라이브 동기화가 필요하면 `build\rojo.exe serve` + Studio Rojo 플러그인.

### 아트 적용 (Earth 납품 → Roblox 업로드)
Roblox 는 자산을 Roblox 서버에 올려 `rbxassetid` 를 받아야 쓸 수 있다. `roblox/tools/upload_assets.js` 가 세 manifest 를 읽어 한 번에 올리고 ID 표를 생성한다:
- `roblox/assets/manifest.csv` (PNG: 하수인·토큰) → **Image** · `roblox/assets/lobby/manifest.csv` (텍스처·UI → Image, FBX → **Model**) · `roblox/assets/tokens/model-manifest.csv` (unknown.fbx → Model)

1. API 키: https://create.roblox.com/dashboard/credentials → **Create API Key** → **Assets API** Read + Write
2. `roblox\tools\upload.bat` → API 키·User ID 입력 → 변경된 자산만 업로드 (sha256·타입 비교)
3. `roblox/assets/asset-ids.json` · `roblox/src/shared/AssetIds.luau` 커밋 → `publish.bat`

메시(Model)는 서버가 `InsertService:LoadAsset` 으로 불러와 로비 시각을 교체한다 (`Lobby.luau`, 실패 시 Part 폴백 · 임포트 축 보정 `MESH_YAW`). `AssetIds.luau` 가 비어 있으면 텍스트·Part 폴백 (HTML #89 계약).

### Roblox 게시 (실제 다인 플레이)
Studio 에서 File → Publish to Roblox. 별도 서버 없이 Roblox 가 서버 인스턴스를 호스팅하며, 같은 인스턴스에 들어온 플레이어를 `init.server.luau` 가 1:1 로 매칭한다.
첫 게시 뒤에는 Game Settings(또는 Creator Hub → Access) 에서 Playability 를 Friends/Public 으로 바꿔야 남이 들어올 수 있다.

**재게시 자동화**: `roblox\tools\publish.bat` — rbxl 을 빌드해 기존 경험에 바로 올린다 (Studio 불필요). API 키만 입력하면 된다.
- 대상 경험은 `roblox/roblox.config.json` (universeId · placeId — 비밀 아님) 에서 읽는다. 다른 경험에 올리려면 `ROBLOX_PLACE_ID` 환경변수(숫자 또는 링크)로 덮어쓴다.
- API 키에는 **Universe Places(Place Publishing) → Write** 권한과 대상 경험이 추가돼 있어야 한다. 401 이면 키 만료(Regenerate), 403 이면 권한·경험 범위 누락.
- 경험이 PRIVATE 이면 본인만 접속 가능 — Creator Hub → 경험 → **Access** 에서 공개 범위를 바꾼다.

### 헤드리스 테스트 (커밋 전 필수)
```
luau tests/run.luau
```
[luau CLI](https://github.com/luau-lang/luau/releases) (luau-windows.zip) 만 있으면 된다. 검증 범위:
RNG 골든(JS 대조) · 배치·P2 행 반사 · 이동 규칙 · 접촉 6상황 유닛(폭탄·함정·밀기) · 왕 끝줄 승리 · 전투 완주 · 20시드 무작위 완주(룰 데드락·지표 정합·HP 불변식) · **AI [10]**: 자동 배치 유효성 · 5급/5단 AI 대 AI 24판 완주 · 5급 결정성 · #92 교체 정책 · **v0.4.7 [11]** · **중앙 배너 [12]** · **v0.4.7 후속 [13]**(#146·#131·#130) · **전투 연출 판정 [14]**(부여/해제·성공/실패 구분).

### UI 레이아웃 정적 검사 (build.bat 이 자동 실행)
```
node tools/uicheck.js
```
`mk(...)` 로 배치한 창·패널의 사각형을 계산해 **자식이 부모 밖으로 나가는지·형제끼리 겹치는지**를 잡는다.
동시에 보이지 않는 쌍(배치 패널 ↔ 대전 패널 등)은 스크립트 안 `EXCLUSIVE`, 의도적으로 겹쳐 그리는 2D 셀은 `STACK_PARENTS` 로 제외한다.
화면 크기가 작으면 `autoFit`(UIScale)이 창을 줄이므로, 검사는 기준 화면 1280×720 에서 한다.
인수 없이 실행하면 `src/client/` 의 `.luau` **전부**를 각각 검사한다 — 새 모듈을 추가해도 목록을 따로 고칠 필요가 없다.

### Roblox API 정적 검사 (build.bat 이 자동 실행)
```
node tools/rbxcheck.js
```
`mk("Class", {…})`·`part({…})` 의 속성 이름, `Enum.X.Y`, 인스턴스 직접 대입을 luau-lsp 의 `globalTypes.d.luau`(첫 실행 시 `build/` 에 내려받음) 와 대조한다.
헤드리스 테스트로는 잡히지 않는 "Studio 에서만 터지는" 오타(예: 존재하지 않는 `Enum.ResampleMode` → 클라이언트 스크립트가 초기화 중 죽어 UI 전체가 안 뜸)를 커밋 전에 걸러낸다.
**최상위 지역 변수 예산**도 함께 본다 — 170 초과면 경고, 190 초과면 실패. Luau 한도(200)에 닿으면 오류가 엉뚱한 함수를 가리켜 원인을 찾기 어렵다.

## Phase 1 제외 (후속 이슈)

- ~~PVE AI (grade5/dan5)~~ → **완료 (Phase 3)**: `src/shared/Ai.luau` — 혼자 앉아 `[B]`(5급)·`[N]`(5단) 또는 HUD 버튼으로 봇 대전. 봇은 로스터·배치 자동, 서버가 봇 차례마다 0.65s 간격으로 한 행동씩 진행
- ~~수동 배치 UI·로스터 선택 UI~~ → 완료 (보드게임 창: 왼쪽 2D 판 · 오른쪽 로스터/배치 패널 · [나가기] 로만 닫힘)
- 아트: 2D·로비·AI 봇·보드게임 창·중앙 배너 자산 전량 적용 (총 152 ID — `docs/roblox/art-apply-report.md` 3c)
- ~~추측 메모~~ → **완료 (Phase 4)**: [📝 추측 메모] 토글 후 미공개 상대 말 클릭 — 내 화면에만 보이고 서버로 보내지 않는다
- ~~재접속 처리~~ → **완료 (Phase 4)**: 대전 중 끊기면 90초 유예 후 기권, 같은 계정으로 돌아오면 자리·세션 복구
- ~~전적 저장~~ → **완료 (Phase 4)**: `Stats.luau` (DataStore, 실패 시 메모리) · HUD·종료 화면에 승/패/무·승률
- 연출(FX)·튜토리얼
- 관전·랭크·매치메이킹 고도화

세부 대응표·의도적 차이는 [docs/roblox/port-plan.md](../docs/roblox/port-plan.md) 참조.
