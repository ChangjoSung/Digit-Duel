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

### Studio 테스트 (2인 로컬)
1. `build.bat` 실행 → `build/DigitDual.rbxl` 생성 (rojo.exe 는 `build/` 에 두며 git 에 올리지 않는다 — 없으면 bat 이 다운로드 링크를 안내)
2. Roblox Studio 로 `build/DigitDual.rbxl` 열기 → Test 탭 → **Clients and Servers: 2 Players** → Start
3. 열린 클라이언트 창 2개에서 각각 [🌐 빠른 매칭] → 자동 매칭 → 대전

코드를 고친 뒤에는 `build.bat` 을 다시 돌려 rbxl 을 갱신한다. 라이브 동기화가 필요하면 `build\rojo.exe serve` + Studio Rojo 플러그인.

### 아트 적용 (Earth 납품 → Roblox 업로드)
Roblox 는 이미지를 Roblox 서버에 올려 `rbxassetid` 를 받아야 쓸 수 있다. `roblox/assets/manifest.csv` 의 PNG 를 한 번에 올리고 ID 표를 생성한다:

1. API 키 발급: https://create.roblox.com/dashboard/credentials → **Create API Key** → Access Permissions 에 **Assets API** 추가 (Read + Write) → Save → 키 복사
2. `roblox\tools\upload.bat` 실행 → API 키와 User ID(roblox.com/users/**숫자**/profile) 입력 → 60장 업로드 (약 2~3분)
3. 생성된 `roblox/assets/asset-ids.json` 과 `roblox/src/shared/AssetIds.luau` 를 커밋 → `build.bat` → Studio 에서 **Publish to Roblox As…** 로 기존 경험에 덮어쓰기

재실행하면 파일이 바뀐 것만 다시 올린다. `AssetIds.luau` 가 비어 있으면 클라이언트는 텍스트 표시로 폴백한다 (HTML #89 폴백과 같은 계약).
업로드 직후 Roblox 이미지 검수(수 분)가 끝날 때까지 빈 이미지로 보일 수 있다.

### Roblox 게시 (실제 다인 플레이)
Studio 에서 File → Publish to Roblox. 별도 서버 없이 Roblox 가 서버 인스턴스를 호스팅하며, 같은 인스턴스에 들어온 플레이어를 `init.server.luau` 가 1:1 로 매칭한다.

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
