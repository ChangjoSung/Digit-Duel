# [Earth 요청] Digit Dual Roblox — 배너 상황별 변형 2종 납품 요청 (소규모)

> **사용법**: `--- PROMPT ---` 이후 전체를 Codex(Earth 역할) 세션에 붙여넣는다.
> 작성: Mars (Claude Code) 2026-09-10 · Ref #118 · 선행 요청서 `earth-banner-request.md` 의 **선택 항목 후속**
> **선행 납품**: 공통 배너 `ui_banner`(256×128, SliceCenter 16,16,112,112) 적용 완료 — [보고서](../art/roblox-v0.5.0/earth-banner-report.md) · [적용 기록](art-apply-report.md) 3d

--- PROMPT ---

## dispatch preflight

| 필드 | 값 |
|---|---|
| required_role | **Earth** (Art, Codex) |
| mode | IMPLEMENT |
| area | ART |
| mutation | assets / docs (코드 수정 금지) |
| instance_index | null |

역할 계약(CLAUDE.md rev 6): Earth는 아트 자산·문서만 만든다. 코드 작성·수정 금지, 기획 결정 대체 금지(불명확하면 `[기획 필요]`), git 쓰기 금지. `worker_done`으로 Mercury에 보고.

## 1. 배경 — 왜 다시 요청하는가

`earth-banner-request.md` 에서 선택 항목이던 `banner_good`·`banner_bad` 를 Earth 가 **"공통 배경 + 런타임 제목색 4단계로 충분"** 이라고 판단해 미제작했고, Mars 도 그 판단에 동의해 그대로 적용했다.

이후 CJ 지시(2026-09-10)로 **두 변형을 제작 범위에 넣는다.** 현재 배너가 뜨는 순간이 늘어나(획득·손실·경고·진행) 배경까지 상황을 알려 주면 한눈에 구분되기 때문이다.

**이전 판단이 틀렸다는 뜻이 아니다** — 요구가 늘어난 것이다. 공통 배너는 그대로 두고 변형만 추가한다.

## 2. 납품 목록 (2건)

| # | kind | id | 파일 | 크기 | 9-slice | 쓰이는 순간 |
|---|---|---|---|---|---|---|
| 1 | `ui` | `banner_good` | `roblox/assets/ui/banner_good.png` | **256×128** | **(16,16,112,112)** — 공통 배너와 동일 | 획득·성공·승리 (📦 패키지 · 🎁 개봉 · 📘 기술 습득 · 🔴 포획 성공 · 🌿 탐색 발견 · 🏁 승리 · 🟢 나의 턴) |
| 2 | `ui` | `banner_bad` | `roblox/assets/ui/banner_bad.png` | **256×128** | **(16,16,112,112)** | 손실·실패·위험 (💥 폭탄 · 🪤 함정 · 🏳️ 기권 · 🔌 연결 끊김 · 패배) |

**규격은 공통 배너와 완전히 동일하게 맞춘다** — 코드가 배경만 바꿔 끼우기 때문에 크기·SliceCenter·표시 크기(540×112)·`SliceScale 1`·`ImageColor3 흰색`·`ResampleMode Pixelated`·`tint=no` 가 전부 같아야 한다.

**디자인 방향**
- 공통 배너(`banner.png`)의 형태·리벳·테두리 구조를 **그대로 유지**하고 **색조만** 바꾼다. 실루엣이 달라지면 배너가 바뀔 때 튄다.
- `banner_good`: 초록 계열 테두리·포인트. 중앙 바탕은 공통과 같은 어두운 톤(`#13161e` 계열)을 유지하되 아주 옅은 초록 기미까지는 허용.
- `banner_bad`: 붉은 계열 테두리·포인트. 중앙 바탕 동일.
- **글자 영역(제목 x12..528 y18..62 · 설명 y64..98)은 공통 배너와 똑같이 비워 둔다** — 코드가 그 위에 제목 30px·설명 14px 를 그린다.
- 런타임 제목색 4종(`#e8ecf5` 기본 · `#6fe0a0` 획득 · `#ffd16a` 경고 · `#ff7a8a` 손실)과 **모두 대비**가 나와야 한다. 변형 배경 위에서 네 색의 대비를 계산해 보고서에 적는다.

## 3. 납품 형식

1. 파일을 `roblox/assets/ui/` 에 두고 `roblox/assets/manifest.csv` 에 **행 2개 추가** (기존 헤더·행 보존, `status=delivered`, `slice_l/t/r/b` 기입, `tint=no`).
2. `docs/art/roblox-v0.5.0/earth-banner-variants-report.md` 에 540×112 로 늘린 검수 이미지 3장(공통·good·bad 나란히)과 4색 대비표를 기록한다.
3. 업로드·`AssetIds.luau` 갱신·코드 연결은 **Mars 가 한다** (`Art.ui("banner_good")`·`Art.ui("banner_bad")` 조회 후 상황별 교체).
4. `worker_done` 보고에 파일·해시·SliceCenter 를 적는다.

## 4. [기획 필요] — Earth 가 결정하지 않는다

- 어떤 순간을 good/bad 로 분류할지의 **최종 목록** — 위 표는 Mars 의 현행 `tone` 분류(`src/shared/Banner.luau`)를 그대로 옮긴 것이고, 바뀌면 Mars 가 코드에서 조정한다. Earth 는 배경 2장만 만든다.
- 배너 로고·워드마크 — 승인 전까지 넣지 않는다 (공통 배너와 동일).
