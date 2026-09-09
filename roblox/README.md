# Digit Dual — Roblox 포팅 (Phase 1)

HTML 데모(`demo/index.html` v0.4.5)의 Roblox 포팅. CJ 결정(2026-09-09)으로 플랫폼 방향을 Roblox로 전환했다 (Ref #118).

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
│  │  └─ Views.luau          # 뷰어별 정보 은닉 직렬화
│  ├─ server/init.server.luau  # 매치메이킹 + 서버 권위 세션
│  └─ client/init.client.luau  # 최소 UI 스캐폴드 (Phase 2 에서 아트·연출 교체)
└─ tests/run.luau            # 헤드리스 테스트 (luau CLI — Roblox 불필요)
```

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
| `capTry` / `capSkip` | `{mode="safe"\|"risky"\|"attack"}` | captureModal |
| `recruitSwap` / `recruitKeep` | `{slot=1\|2}` | recruitModal (#92) |
| `act` | `{k=1..4\|"basic"}` | 전투 4슬롯 (JS 0~3 → **1~4**) |
| `item` / `ball` / `flee` | `{i=인벤 인덱스}` | 전투 보너스 행동 |
| `fleeSwap` / `fleeSkip` | `{id}` | #114 도망 교환 |

## 실행

### 플레이 흐름 (Phase 2b — 3D 로비 · 테이블 매칭 · 판 위 대국, CJ 2026-09-09)
로비 스폰 → 테이블 의자 앞에서 **[E] 앉기** (카메라가 판을 향함) → 하단 패널 **[배치 완료]** (지금은 무작위 배치) → 맞은편에 상대가 앉아 배치를 마치면 그 둘만 대전 → **판 위의 말을 직접 클릭**해 선택·이동·전투 (오른쪽 패널: 탐색·텔레포트·회복·턴 종료, 전투는 중앙 패널) → 종료 후 [닫기] → 앉은 채 재대전. 대전 중 자리 이탈 = 기권.
- 판 위 말은 **각 클라이언트가 서버 필터 뷰로 로컬 생성**한다 — 공개 말 = 도트 빌보드, 미공개 말 = 공통 덮개 메시(팀 틴트). 상대 클라이언트에는 아무 인스턴스도 복제되지 않는다.
- 판 파트가 없거나 HUD [2D 보드] 를 켜면 2D 보드 GUI 로 폴백.
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
RNG 골든(JS 대조) · 배치·P2 행 반사 · 이동 규칙 · 접촉 6상황 유닛(폭탄·함정·밀기) · 왕 끝줄 승리 · 전투 완주 · 20시드 무작위 완주(룰 데드락·지표 정합·HP 불변식).

## Phase 1 제외 (후속 이슈)

- PVE AI (grade5/dan5) — 엔진에 관측 데이터(aiSeenMoved)는 유지해 둠
- 수동 배치 UI·로스터 선택 UI (현재 무작위 배치)
- 아트 적용 (Earth 자산 — docs/roblox/earth-art-request.md)
- 연출(FX)·튜토리얼·추측 메모
- 재접속 처리·매치메이킹 고도화

세부 대응표·의도적 차이는 [docs/roblox/port-plan.md](../docs/roblox/port-plan.md) 참조.
