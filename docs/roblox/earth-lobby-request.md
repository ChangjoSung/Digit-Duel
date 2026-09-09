# [Earth 요청] Digit Dual Roblox — 3D 로비·테이블 아트 납품 요청

> **사용법**: `--- PROMPT ---` 이후 전체를 Codex(Earth 역할) 세션에 붙여넣는다.
> 작성: Mars (Claude Code) 2026-09-09 · Ref #118 · 브랜치 `feature/118-roblox-port` · 선행 요청서 `earth-art-request.md`(2D 자산) 와 별개

--- PROMPT ---

## dispatch preflight

| 필드 | 값 |
|---|---|
| required_role | **Earth** (Art, Codex) |
| mode | IMPLEMENT |
| area | ART |
| mutation | assets / docs (코드 수정 금지) |
| instance_index | null |

역할 계약(CLAUDE.md rev 6): Earth는 아트 자산·문서만 만든다. Luau·JS·Python 코드 작성·수정 금지, 기획 결정 대체 금지(불명확하면 `[기획 필요]`), git 쓰기 금지. `worker_done`으로 Mercury에 보고.

## 1. 배경

CJ 결정(2026-09-09): Roblox 버전은 **3D 로비**에서 시작한다. 플레이어 아바타가 로비를 걸어 다니고, **책상 위에 놓인 7×13 판(체스판처럼)** 앞 의자에 앉으면 배치를 하고, **같은 판에 둘이 앉으면 매칭**되어 대전한다.
Mars가 Roblox 기본 Part로 **플레이스홀더 로비**를 구현해 뒀다 (`roblox/src/server/Lobby.luau`): 바닥 140×140, 벽, 스폰, 테이블 4개(책상 9×0.6×7 · 판 4.2×0.2×7.8 · 의자 2개 마주봄 · 머리 위 상태 표지). **이 치수·배치를 기준으로** 실제 아트를 제작해 교체한다.

## 2. 반드시 읽을 참조

1. `docs/roblox/lobby-design.md` — 플로우·구조·Phase 2b 계획
2. `roblox/src/server/Lobby.luau` — 현재 지오메트리 치수·좌표·이름 (Desk/Board/SeatA/SeatB/Back/Legs/Floor/Wall/SpawnLocation)
3. `docs/minion-visual-spec-v0.4.3.md` 7장 — 시각 검수 원칙 (실루엣·IP 비연상)
4. `demo/index.html` `<style>` 팔레트 — 다크 톤 UI 색 (`--panel --line --fire --water --grass --lightning`)
5. `roblox/assets/minions/` — 이미 납품된 하수인 도트 (판 위 토큰은 이 도트를 빌보드로 쓸 예정 — 3D 모델링 불필요)
6. `ASSET-LICENSE.md`

## 3. Roblox 3D 자산 제약

| 항목 | 제약 | 지침 |
|---|---|---|
| 메시 | `.fbx` / `.obj`, 메시당 삼각형 ≤ 10,000 (Roblox 권장), 단일 메시 크기 ≤ 2048 studs | 책상·의자·판·장식 소품은 각각 별도 메시. 로우폴리 권장 (총 삼각형 로비 전체 < 60k) |
| 텍스처 | PNG/JPG ≤ 1024×1024, 알베도 위주. PBR(노멀·러프니스·메탈)은 선택 | 텍스처 아틀라스로 묶으면 좋음. 색은 Roblox `Color3` 틴트로 바꿀 수 있게 밝은 회색 기반도 가능 |
| 단위 | 1 stud ≈ 28cm (아바타 키 ≈ 5 studs) | 책상 높이 ≈ 3 studs(윗면 y=3), 의자 앉는 면 y≈1.25 — **앉았을 때 판이 보이는 높이 유지** |
| 판 | 7열(X)×13행(Z), 셀 0.6 stud → 4.2×7.8 studs, 두께 0.2 | 셀 경계가 또렷해야 함 (수동 배치 클릭 대상). 진영·숲·중앙 구분 색 (현행: 적진 `#5E2F3A`·아군 `#2F3A5E`·숲 `#23422F`·중앙 `#2B3140`) |
| 의자 | Seat 파트(2×0.5×2)가 앉는 면 | 메시는 이 Seat 를 감싸는 형태로. 등받이는 판 반대쪽(+Z 로컬) |
| 콜리전 | 걸어 다닐 수 있어야 함 | 책상·의자에 단순 박스 콜리전. 장식은 CanCollide off 권장 |
| 조명 | Roblox 기본 조명(Future/ShadowMap) | 자체 발광 텍스처 최소화 |
| 텍스트 | 이미지·메시에 글자 굽지 않음 | 표지판 문구는 코드(BillboardGui) |
| 업로드 | 메시·텍스처 업로드(rbxassetid)는 Mars가 Open Cloud로 처리 | 파일 + manifest 만 납품 |

## 4. 납품 목록

### P0 — 테이블 세트 (플레이스홀더 교체 필수)

| 자산 | 수량 | 비고 |
|---|---|---|
| 책상 (윗면 9×7, 높이 3) | 1 메시 | 판이 놓일 자리 평평. 다리 포함 |
| 의자 (앉는 면 y 1.25, 등받이) | 1 메시 | A/B 는 틴트만 다름 (파랑/빨강) — 흰색·회색 텍스처 |
| 판 (4.2×7.8×0.2, 7×13 셀) | 1 메시 + 텍스처 | 셀 텍스처 1024×… 비율 7:13. 셀 좌표를 manifest에 기재 |
| 테이블 상태 표지 프레임 | 9-slice PNG | "테이블 N · 빈 자리 2" 텍스트는 코드 |
| 바닥 타일 텍스처 | 1 (타일링) | 140×140 바닥 |
| 벽·기둥 | 1~2 메시 | 12 studs 높이 |

### P1 — 로비 분위기

| 자산 | 비고 |
|---|---|
| 스폰 지점 장식 (원형 매트·표지) | 스폰 10×10 |
| 조명 소품 (램프·창문) | 다크 톤 실내 (HTML 팔레트 계승) |
| 벽 장식: 4속성 문양·게임 로고 배너 | 로고는 **[기획 필요]** (경험 이름 확정 후) |
| 판 위 토큰 받침 (빌보드 하수인 도트를 세울 원형 코인) | 하수인 도트는 기존 자산 재사용 |

### P2 — Phase 2b 대비

| 자산 | 비고 |
|---|---|
| 관전석·안내판 | 관전 정책 [기획 필요] 확정 후 |
| 경험 아이콘 512 · 썸네일 1920×1080 (로비 장면) | 스토어용 |

## 5. 파일 구조·매니페스트

```text
roblox/assets/lobby/
├─ manifest.csv        # path, kind(mesh|texture|ui), w, h, tris, slice, tint, source, notes
├─ meshes/{desk,chair,board,wall,pillar,...}.fbx
├─ textures/{board_grid,floor_tile,desk_albedo,chair_albedo,...}.png
├─ ui/{table_sign}.png (9-slice)
└─ preview/ (렌더 스크린샷 — 앉은 시점에서 판이 보이는지)
```

## 6. 제작 원칙·금지

1. **앉은 시점 검수**: 의자에 앉은 카메라(높이 ≈ y 4.5, 판 중심을 향함)에서 판 13행 전체가 보여야 한다 — preview 스크린샷 첨부
2. **실루엣·색**: 다크 톤 실내, 판과 토큰이 가장 밝게 읽히도록 대비 설계. 기존 유명 IP(체스 앱·보드게임 카페 브랜드 등) 연상 금지
3. **코드 수정 금지**: 치수 변경이 필요하면 보고서에 "요청"으로 적는다 (Lobby.luau 는 Mars가 고친다)
4. **라이선스**: 외부 소재 사용 시 출처·라이선스 manifest 기재. 불명확하면 사용 금지

## 7. 수용 기준 (AC)

- [ ] P0 메시 6종 + 텍스처 + manifest, 메시당 ≤10k 삼각형, 텍스처 ≤1024
- [ ] 판 셀 좌표(7×13)가 manifest 에 있고 텍스처 격자와 일치
- [ ] 앉은 시점 preview 에서 판 전체 가시
- [ ] 책상/의자 치수가 `Lobby.luau` 기준과 ±10% 이내 (아바타 앉기 높이 유지)
- [ ] 글자 구운 이미지 0 · 코드 파일 수정 0

## 8. [기획 필요] — Earth가 결정하지 않고 보고

- 로비 테마 (보드게임 카페 / 판타지 길드홀 / 미니멀 스튜디오 중 무엇인지)
- 경험 이름·로고 확정
- 테이블 수(현재 4)·로비 크기 확대 여부
- 관전 허용 여부와 관전석 필요성

## 9. 보고 형식

```yaml
worker_done:
  role: Earth
  instance_index: null
  dispatch_ref: "#118 Roblox 로비 P0"
  files_modified: [ "roblox/assets/lobby/**", "docs/art/roblox-v0.5.0/earth-lobby-report.md" ]
  summary: |  납품 수량·치수 검수·앉은 시점 preview 경로
  requests_to_mars: |  Lobby.luau 치수 변경 요청(있으면)·업로드 시 주의
  planning_needed: [ ... 8장 ... ]
  qa_request: Saturn 검수 요청
```

--- END PROMPT ---
