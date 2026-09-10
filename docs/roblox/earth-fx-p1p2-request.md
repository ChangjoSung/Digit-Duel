# [Earth 요청] Digit Dual Roblox — 전투 연출(FX) P1/P2 아트 납품 요청

> **납품 업데이트(2026-09-10)**: P1 FX10 + P2 FX3 + 메모2, 총15PNG 전량 제작. [Earth 납품 보고·프레임 검토·해시](../art/roblox-v0.5.0/earth-fx-report.md) · [Mars 적용 계약](../../roblox/assets/fx/README.md). 시트는768×96/8프레임이며, 코드상 기존 전투원 그림은76×76이므로 실제 표시 크기는 별도 확인한다. 업로드·코드 연결·Studio 검수는 Mars 후속이다.

> **사용법**: `--- PROMPT ---` 이후 전체를 Codex(Earth 역할) 세션에 붙여넣는다.
> 작성: Mars (Claude Code) 2026-09-10 · Ref #118 (v0.4.6 Roblox 포팅) · 선행 요청서 `earth-art-request.md`(P0 2D) · `earth-lobby-request.md`(3D 로비) · `earth-ai-window-request.md`(AI 창) · `earth-banner-request.md`(배너) 와 별개
> **선행 납품 현황**: P0 129 PNG · 로비 13 · 가림 1 · AI 창 8 · 배너 1 = **총 152 자산 적용 완료**. 이 요청서는 그때 P1/P2 로 미뤄 둔 **연출용 자산**이다.

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

## 1. 배경 — 지금 Roblox 판에 없는 것

HTML 데모에는 `#106` 연출 계약이 있어서 전투 중 **폭발·피격·상태이상·버프·판정**이 CSS 애니메이션으로 보인다. Roblox 판은 규칙·정보 은닉·AI·UI 를 전부 옮겼지만 **연출 계층은 비어 있다** — 상태가 즉시 반영되고, 중요한 순간은 `docs/roblox/earth-banner-request.md` 로 납품된 **중앙 배너(1.2초)** 로만 알린다.

CJ 지시(2026-09-10)로 연출을 붙이려 한다. Roblox 는 CSS 가 없으므로 **스프라이트 시트(연속 프레임 PNG)** 로 만든다. Mars 가 `ImageLabel` 의 `ImageRectOffset` 을 프레임마다 옮겨 재생한다.

**절대 바꾸지 않는 것**: 게임 규칙·수치 · 승인된 하수인 도트 · 기존 152 자산의 파일명·키·SliceCenter.

## 2. 반드시 읽을 참조

1. `roblox/assets/ui/README.md` — 기존 UI 자산 적용 계약 (픽셀 톤·알파 0/255·tint 규칙)
2. `roblox/assets/manifest.csv` — 납품 형식 (행을 **추가**한다, 기존 행 수정 금지)
3. `roblox/src/client/init.client.luau` — 전투 창 `battleFrame`(440×566) · 전투원 카드 · 스프라이트 96px 위치 (검색어: `BF_W, BF_H`)
4. `docs/milestone/v0.4.3/specs/minion-visual-spec-v0.4.3.md` 7장 — 시각 검수 원칙 (IP 비연상)
5. `docs/roblox/art-apply-report.md` — 기존 자산이 어디에 붙어 있는지
6. `ASSET-LICENSE.md`

## 3. 납품 목록

### 3-1. P1 — 전투 연출 스프라이트 시트 (우선)

가로로 이어 붙인 시트 1장 = 애니메이션 1종. **프레임 크기 96×96 · 8프레임 · 시트 768×96** 로 통일한다 (Mars 가 `ImageRectSize (96,96)` · `ImageRectOffset (96*n, 0)` 로 재생).

| # | kind | id | 파일 (roblox/assets/…) | 쓰이는 순간 |
|---|---|---|---|---|
| 1 | `fx96` | `hit` | `fx/hit_96x8.png` | 피해를 입었을 때 (전투원 카드 위) |
| 2 | `fx96` | `explosion` | `fx/explosion_96x8.png` | 폭탄 발동 |
| 3 | `fx96` | `trap` | `fx/trap_96x8.png` | 함정 발동 |
| 4 | `fx96` | `shield` | `fx/shield_96x8.png` | 보호막 부여 (합산이라 여러 번 뜬다) |
| 5 | `fx96` | `heal` | `fx/heal_96x8.png` | 회복 (기술·아이템·마녀 흡수) |
| 6 | `fx96` | `burn` | `fx/burn_96x8.png` | 화상 부여·지속 피해 |
| 7 | `fx96` | `weaken` | `fx/weaken_96x8.png` | 약화 부여 |
| 8 | `fx96` | `shock` | `fx/shock_96x8.png` | 감전 부여 |
| 9 | `fx96` | `capture` | `fx/capture_96x8.png` | 몬스터볼 포획 성공 |
| 10 | `fx96` | `flee` | `fx/flee_96x8.png` | 도망 성공 |

- 배경 투명(알파 0/255), RGBA8, 픽셀 아트 톤 — 기존 UI 자산과 같은 색 어휘.
- **프레임 1은 거의 비어 있고 마지막 프레임은 완전히 사라지는** 형태로 (재생이 끝나면 자연스럽게 없어지도록).
- 속성색을 코드가 곱하지 않는다(`tint=no`) — 필요한 색은 그림에 넣는다. 단 `hit`·`shield`·`heal` 은 흰색 기반으로 그려 주면 Mars 가 상황색을 곱할 수 있다 → 그 3개만 `tint=yes` 로 manifest 에 표기.

### 3-2. P2 — 신규 기술 3종 전용 연출 (선택)

`#121` 로 추가된 공용 기술 3종은 지금 전용 그림이 없다. 있으면 좋지만 P1 이 먼저다.

| # | kind | id | 파일 | 쓰이는 순간 |
|---|---|---|---|---|
| 11 | `fx96` | `dragon` | `fx/dragon_96x8.png` | 🐉 드래곤 숨결 |
| 12 | `fx96` | `witch` | `fx/witch_96x8.png` | 🕯 마녀의 장난 |
| 13 | `fx96` | `reaper` | `fx/reaper_96x8.png` | 💀 사신의 낫 (즉사) |

### 3-3. P2 — 판 위 표시 (선택)

| # | kind | id | 파일 | 크기 | 쓰이는 순간 |
|---|---|---|---|---|---|
| 14 | `board` | `hl_memo` | `board/hl_memo.png` | 128×128 9-slice (SliceCenter 32,32,96,96) | 📝 추측 메모를 남길 수 있는 칸 강조 (지금은 `hl_flee` 재사용 중) |
| 15 | `token64` | `memo` | `tokens/memo_64.png` | 64×64 | 메모가 달린 말 배지 (지금은 이모지 텍스트) |

## 4. 납품 형식

1. 파일을 위 경로에 두고 `roblox/assets/manifest.csv` 에 **행 추가** (기존 헤더·행 보존, `status=delivered`, `w`·`h` 는 시트 전체 크기, `notes` 에 `frames=8;frame=96x96`).
2. `docs/art/roblox-v0.5.0/earth-fx-report.md` 에 프레임별 검수 이미지(8프레임 나열)·라이선스 출처를 기록한다.
3. 업로드·`AssetIds.luau` 갱신·코드 연결은 **Mars 가 한다**.
4. `worker_done` 보고에 파일·해시·프레임 수·미납품 항목을 적는다.

## 5. Mars 가 할 일 (참고 — Earth 는 하지 않는다)

- `Art.fx(key)` 접근자 추가 · 전투 창에 스프라이트 재생기(프레임 타이머) 구현
- 서버 `bmsg` 이벤트에 연출 키를 실어 보내거나, 클라이언트가 메시지 문구로 판정 (배너와 같은 방식)
- 규칙·난수에 영향이 없어야 하고, 연출 때문에 입력이 막히지 않아야 한다

## 6. [기획 필요] — Earth 가 결정하지 않는다

- 연출 재생 시간(프레임당 ms)과 입력 잠금 여부 — HTML 은 1.2초 + 잠금이지만 Roblox 는 서버 권위라 **잠금 없이 표시만** 할 계획이다. CJ 확인 전까지 프레임 수(8)만 맞춘다.
- 피격 화면 흔들림·화면 전체 플래시 같은 강한 연출 도입 여부.
