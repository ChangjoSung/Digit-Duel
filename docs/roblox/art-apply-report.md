# [보고] Earth 아트 적용 — Mars (Ref #118, 인계서 `claude-art-apply-handoff.md` 회신)

작성: Mars (Claude Code) 2026-09-09 · 브랜치 `feature/118-roblox-art-apply` · Roblox 게시 대상 place 105609162200402

인계서 §9 요구대로 **적용 완료 / 자산 업로드만 완료 / 아직 미적용 / 미납품 자산 / 별도 보안 문제**를 구분한다. 확정/추론/미확정 표기.

## 1. 자산 업로드 (Open Cloud, 계정 11639564357)

83개 전부 성공 — `roblox/assets/asset-ids.json` · `roblox/src/shared/AssetIds.luau` (생성 파일).

| 묶음 | 수량 | Roblox 자산 타입 | 키 |
|---|---:|---|---|
| 하수인 icon64/battle256/portrait512 | 60 | **Image** (기존 Decal 60개를 Image 로 재업로드 — ImageLabel·TextureID 어디서든 확실히 렌더) | `icon_/battle_/portrait_<종>` |
| 토큰 king/ally/bomb/trap 64·128 + unknown 64 | 9 | Image | `token64_/token128_<토큰>` |
| 로비 알베도 6 + 표지 1 | 7 | Image | `lobby_<asset_id>` |
| 로비 메시 FBX 6 | 6 | **Model** (InsertService 로 로드) | `lobbymesh_<이름>` |
| 공통 가림 메시 unknown.fbx | 1 | Model | `mesh_unknown` |

업로더(`roblox/tools/upload_assets.js`)는 인계서 §4 대로 세 manifest 를 각각의 규칙으로 읽고 obj/mtl 은 올리지 않는다. sha256·타입이 같으면 건너뛴다.

## 2. 적용 상태

### 적용 완료 (코드 연결 + 빌드 포함)
| 항목 | 위치 | 비고 |
|---|---|---|
| 하수인 icon64 — 2D 보드 칩·**3D 판 빌보드** | `init.client.luau` `pieceImage`·`sync3D` | 무틴트, Pixelated |
| 하수인 battle256 — 전투 패널 | `renderBattle`·`fighterImage` | 대리 출전은 `artRosterId` |
| 왕·동료·폭탄·덫 token64 — 2D 칩·3D 빌보드 (팀 틴트 `#5b8cff`/`#ff5b6e`) | 같은 곳 | `ImageColor3` 틴트 |
| 왕·동료 본체 token128 — 전투 패널 (팀 틴트) | `fighterImage` | |
| unknown_64 — 2D 칩 미공개 말 (팀 틴트) | `pieceImage` | |
| **공통 가림 메시** — 3D 판 미공개 말 (`MeshPart.Color` 팀 틴트, 0.44×0.42×0.44, 바닥+0.21) | 서버 `Lobby.build` 가 `ReplicatedStorage.DDTemplates.Unknown` 템플릿 생성 → 클라 `mkUnknown` 복제 | 템플릿 없으면 unknown_64 빌보드 → 단색 블록 순 폴백 |
| 로비 메시 6종 + 알베도 (책상·의자·판·바닥·벽·기둥) | `Lobby.luau` `applyLobbyMeshes`/`applyTableMeshes` | 기능 파트(충돌·Seat·클릭 대상 Board)는 유지하고 시각만 교체. 의자 A/B 틴트 `#7185BD`/`#BD7180` |
| 표지 table_sign 9-slice (SliceCenter 16,16,240,48) | `Lobby.buildSign` | 문구는 런타임 |
| **판 위 대국** (Phase 2b 핵심) | 클라 `sync3D`·`setBoardCamera`·`raycastCell` | 앉으면 카메라가 판을 향함. 말은 각 클라이언트가 서버 필터 뷰로 **로컬 생성** — 상대에게 복제되는 인스턴스 없음. 판·말 클릭 → 셀 → 기존 `onCell` |
| 2D 보드 폴백 | HUD [2D 보드] 토글, 판 파트 없으면 자동 | |

### 자산 업로드만 완료 (코드 미연결)
- `portrait512` 20장 — 로스터 선택/설명창 UI 가 아직 없다 (수동 배치·로스터 UI 는 후속). ID 는 `AssetIds.luau` 에 있음.

### 아직 미적용
- 판 위 **이동 가능/공격 가능 칸 하이라이트** — 클라이언트에 규칙 평가가 없어 선택·강제 대상·도망 후보·흔적만 표시 (서버가 잘못된 수를 거부하며 사유를 로그로 돌려줌)
- 추측 메모(점선·불투명도 0.5) — 메모 기능 자체가 미구현 (HTML #36 포팅 대기). 인계서 §5 대로 이번 교체에 묶지 않음

### 미납품 자산 (Earth)
속성 아이콘 4 · 흔적 마커 1 · P0-C 보드 타일/하이라이트 10 · P0-D UI 프레임/상태·아이템·행동·기술 아이콘 45 = **60 PNG**, P1 연출·배너, P2 스토어. 현재 폴백: 텍스트·이모지(흔적 🔍)·단색 프레임·Neon 하이라이트 파트.

## 3. 별도 보안 항목 — 순번 ID 누출 (인계서 §6) → **수정·검증**

- 재현: `Engine.new` 가 종류별 고정 순서로 1부터 ID 부여 → 왕 = 14/28 등 ID 만으로 정체 추정 가능. `Views` 가 미공개 말에도 그 ID 를 전송.
- 수정 ①: `Engine.new` 에서 생성 직후 **ID 값을 시드 RNG 로 셔플** (생성 순서·규칙 로직 불변, ID 는 불투명 핸들). 
- 수정 ②: `Views.forViewer` 의 `board` 배열을 **위치(r,c) 순으로 정렬** — 배열 순서가 생성 순서(=종류 순서)를 따르던 2차 누출 제거.
- 검증: `tests/run.luau` [8] — 10시드에서 종류별 고정 구간 없음, ID 유일·범위, 뷰 정렬, 미공개 말에 type/hp/rosterId/name 비전송. 서버 검증 경로(`pieceById`)는 ID 값에 의존하지 않아 회귀 없음.
- 잔여(추론): 3D 로컬 인스턴스의 `r/c` Attribute 는 이미 보이는 위치 정보만 담는다. 이름은 전부 `Piece/Base/Hl` 로 동일. 관전자 정책은 여전히 [기획 필요] — 현재 관전자(앉지 않은 플레이어)에게는 말을 아예 그리지 않는다.

## 4. 검증

- `luau tests/run.luau`: 규칙 회귀 + [7] Art + [8] 정보 은닉 — 결과는 PR 본문에 기록
- 전 Luau `luau-compile` 통과 · rbxl 트리 확인
- **Studio/실서버 미검증** (이 환경에 Studio 없음): 메시 임포트 축(`MESH_YAW` 보정표로 대응), 앉은 시점 카메라 프레이밍, raycast 클릭, 덮개 템플릿 로드. 인계서 §8 대로 이전 아트 QA PASS 를 코드 QA 로 재사용하지 않는다 → **Saturn 독립 QA + CJ 실플레이 확인 요청**.

## 5. worker_done

```yaml
worker_done:
  role: Mars
  instance_index: null
  dispatch_ref: "#118 Earth 아트 적용 (claude-art-apply-handoff.md)"
  status: completed_pending_qa
  files_modified:
    - "roblox/tools/upload_assets.js"
    - "roblox/assets/asset-ids.json"
    - "roblox/src/shared/AssetIds.luau"
    - "roblox/src/shared/Art.luau"
    - "roblox/src/shared/Engine.luau"
    - "roblox/src/shared/Views.luau"
    - "roblox/src/server/Lobby.luau"
    - "roblox/src/server/init.server.luau"
    - "roblox/src/client/init.client.luau"
    - "roblox/tests/run.luau"
    - "roblox/README.md"
    - "docs/roblox/lobby-design.md"
    - "docs/roblox/art-apply-report.md"
  summary: |
    83 자산 업로드(Image 76 · Model 7). 하수인·토큰·덮개·로비 메시·표지 연결, 판 위 대국(로컬 렌더·카메라·클릭) 구현,
    순번 ID 누출 수정(셔플+정렬)과 테스트. portrait 는 업로드만. 미납품 60PNG 는 폴백 유지. Studio 실검증은 미실시.
  qa_request: |
    Saturn: (1) 두 클라이언트에서 공개/미공개/숲 은닉 말 표시와 로컬 인스턴스 비복제 확인 (2) ID 셔플 회귀 — 서버 액션 검증·pending·도망 교환
    (3) 로비 메시 축·의자 착석 높이·판 진영 방향(row13=A·파랑) (4) 앉은 시점 카메라 91칸 가독성·클릭 정확도 (5) 폴백(메시/이미지 실패)
    CJ: 실플레이 — 로비 → 착석 → 배치 → 대전 → 종료 → 재대전
```
