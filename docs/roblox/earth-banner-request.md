# [Earth 요청] Digit Dual Roblox — 중앙 배너 아트 납품 요청 (선택 · 소규모)

> **사용법**: `--- PROMPT ---` 이후 전체를 Codex(Earth 역할) 세션에 붙여넣는다.
> 작성: Mars (Claude Code) 2026-09-10 · Ref #118 (v0.4.6 Roblox 포팅) · 선행 요청서 `earth-ai-window-request.md` 와 별개
> **긴급도 낮음**: 코드는 이미 동작한다. 납품 전에는 기존 `ui/panel_modal` 로 폴백하며, 키가 생기면 코드 수정 없이 자동 교체된다.

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

## 1. 배경

CJ 지시(2026-09-10): "중간 탐색 발견·적 발견 이런거 중앙에 띄워줘. 웹버전 참고."
HTML 데모의 `fxPlay({kind:"banner"})` 와 같은 순간에 **화면 중앙에 1.2초짜리 배너**를 띄우도록 Roblox 클라이언트에 구현했다 (`src/client/init.client.luau` 의 `bannerFrame` · 판정은 `src/shared/Banner.luau`).

지금은 배너 배경으로 기존 `ui/panel_modal`(128×128 9-slice)을 늘려 쓰고 있어서, 세로로 납작한 배너 비율(540×112)에서는 모서리 장식이 늘어져 보인다. **가로로 긴 배너 전용 프레임 1장**만 있으면 된다.

배너가 뜨는 순간 (엔진 로그 그대로 — 문구는 코드가 만든다):
접촉/강제 전투 · 폭탄 발동 · 함정 발동 · 밀어내기·재배치 · 텔레포트 · 탐색 발견(🌿) · 패키지 획득(📦🎁) · 기술 습득(📘) · 포획 결과(🔴) · 버닝 타임 · 전투 개시/판정/종료 · 도망 · 턴 전환 · 경기 결과

## 2. 납품 목록 (1건)

| # | kind | id | 파일 | 크기 | 9-slice | 용도 · 코드 키 |
|---|---|---|---|---|---|---|
| 1 | `ui` | `banner` | `roblox/assets/ui/banner.png` | 256×128 (또는 256×256) | **필수** — `SliceCenter` 값을 보고서에 명시 | 중앙 배너 배경 `Art.ui("banner")` |

**표시 규격 (코드 기준 — 바꾸지 말 것)**
- 실제 표시 크기 **540×112** (작은 화면에서는 `UIScale` 로 비례 축소).
- `ScaleType = Slice`, `SliceScale = 1`, `ImageColor3 = 흰색`, `ResampleMode = Pixelated`.
- 프레임 자체 배경은 코드가 불투명(`#13161e`)으로 깔아 둔다 — **가장자리 장식·테두리**만 그려도 되고, 중앙까지 채워도 된다. 둘 다 안전하다.
- 내부 글자 배치: 제목 30px(위 y=18, 높이 44) · 설명 14px(y=64, 높이 34), 좌우 여백 12px. **이 영역은 비워 둘 것** (장식이 글자를 가리지 않게).

**디자인 방향**
- 기존 UI 자산(`panel_side`·`panel_window`)과 같은 다크 픽셀 톤. 가로로 긴 리본/현판 느낌.
- 좌우 끝에 장식(꼭짓점·리벳 등)을 두고 중앙은 평평하게 — 9-slice 로 늘어나도 자연스럽게.
- 제목 색은 코드가 상황별로 바꾼다 (기본 흰색 / 획득 초록 `#6fe0a0` / 경고 노랑 `#ffd16a` / 손실 빨강 `#ff7a8a`). **배경은 이 네 색과 모두 대비가 되는 어두운 톤**으로.
- 알파 0/255 (중간 알파 없음), RGBA8.

## 3. [선택] 있으면 좋은 것 — 없어도 무방

| # | kind | id | 파일 | 크기 | 용도 |
|---|---|---|---|---|---|
| 2 | `ui` | `banner_good` | `ui/banner_good.png` | 위와 동일 | 획득·승리용 초록 계열 변형 |
| 3 | `ui` | `banner_bad` | `ui/banner_bad.png` | 위와 동일 | 손실·패배용 붉은 계열 변형 |

> 변형을 납품하면 Mars 가 상황별로 갈아 끼운다. **1번만 납품해도 완결**이다.

## 4. 납품 형식

1. 파일을 `roblox/assets/ui/` 에 두고 `roblox/assets/manifest.csv` 에 **행 추가** (기존 헤더·행 보존, `status=delivered`, `slice_l/t/r/b` 열에 SliceCenter 기입).
2. `docs/art/roblox-v0.5.0/earth-banner-report.md` 에 검수 이미지(540×112 로 늘린 상태 + 글자 얹은 목업)·SliceCenter·라이선스 출처를 기록한다.
3. 업로드·`AssetIds.luau` 갱신·코드 연결은 **Mars 가 한다**.
4. `worker_done` 보고에 파일·해시·SliceCenter 를 적는다.

## 5. [기획 필요] — Earth 가 결정하지 않는다

- 배너에 게임 로고/워드마크를 넣을지 — CJ 결정 전까지 넣지 않는다 (글자는 전부 런타임 텍스트).
