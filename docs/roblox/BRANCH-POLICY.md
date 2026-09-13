# Roblox 작업자 안내 — 2026-09-11 바뀐 버전·브랜치 정책

> **한 장 요약**: Roblox 포팅의 **버전이 `v0.4.6` → `v0.5.0` 으로 바뀌었고**, 이제 작업은 `dev` 가 아니라 **`milestone/v0.5.0` 트랙 브랜치**로 병합합니다. 지금까지 올린 코드는 그대로 살아 있습니다 — **다시 작업할 것은 없습니다.**

이 문서는 [#118 Roblox 포팅](https://github.com/ChangjoSung/Digit-Duel/issues/118)을 담당하는 [이욱채(lee775)](https://github.com/lee775)님을 위한 안내입니다. 2026-09-11 CJ 승인([#169](https://github.com/ChangjoSung/Digit-Duel/issues/169))으로 저장소 전체의 버전 체계와 브랜치 흐름이 바뀌었습니다.

## 1. 무엇이 바뀌었나

### 버전 번호

| | 전 (계획 단계 이름) | 후 |
|---|---|---|
| **Roblox 포팅 (담당 범위)** | `v0.4.6` | **`v0.5.0`** ([Milestone 12](https://github.com/ChangjoSung/Digit-Duel/milestone/12)) |
| HTML 데모 완결분 | `v0.4.7` | `v0.4.6` (2026-09-11 출시) |
| Unity 포팅 | `v0.5.0` | `v0.6.0` |

> ### ⚠️ `v0.4.7` 이 두 번 나옵니다 — 헷갈리기 쉬운 지점
>
> | | 무엇인가 |
> |---|---|
> | **옛 `v0.4.7`** | HTML 데모의 **계획 단계 이름**. 지금은 `v0.4.6` 입니다. 위 표의 "전" 칸이 이것입니다. |
> | **태그 `v0.4.7`** | 2026-09-11 에 나온 **실제 릴리스**([노트](../releases/v0.4.7.md)). 출시 문서만 고친 hotfix 로 **게임 내용은 v0.4.6 과 같습니다.** 태그 `v0.4.7` 이 만들어진 것은 이번이 처음입니다. |
>
> 둘은 **다른 것**입니다. 이 저장소는 **계획 버전을 Milestone 으로, 배포 버전을 태그·GitHub Release 로** 따로 관리합니다. 옛 문서에서 `v0.4.7` 을 보시면 대부분 앞쪽(= 지금의 `v0.4.6`)을 가리킵니다.

**왜**: HTML 데모와 Roblox 포팅이 한 `dev` 브랜치에 섞여 릴리스를 분리할 수 없었습니다. Roblox 는 HTML 데모와 성격이 다른 마일스톤이라는 CJ 판단으로 번호를 분리했습니다. Milestone 번호(12)와 Issue 번호(#118)는 **바뀌지 않았습니다.**

### 브랜치 흐름

```
이슈 브랜치 ──squash──▶ milestone/v0.5.0 ──merge commit──▶ dev ──merge commit──▶ main (+tag)
```

- **작업 브랜치는 `milestone/v0.5.0` 에서 분기**합니다 (`dev` 아님).
- **PR 대상도 `milestone/v0.5.0`** 입니다 (`dev` 아님).
- `milestone/v0.5.0` → `dev` 통합은 **마일스톤이 끝났을 때** PD 가 진행합니다.
- 이름이 `dev/v0.5.0` 이 아닌 이유는 git 제약입니다 — `refs/heads/dev` 파일이 있으면 같은 이름의 디렉터리를 만들 수 없습니다.

### 폴더 경로

Roblox 관련 문서 보관 위치가 바뀌었습니다.

| 전 | 후 |
|---|---|
| `docs/milestone/v0.4.6/` | **`docs/milestone/v0.5.0/`** |

**소스 코드 경로(`roblox/`)는 그대로입니다.** 옛 경로가 나오면 [`docs/milestone/MOVES.csv`](../milestone/MOVES.csv)에서 현재 위치를 찾을 수 있습니다.

## 2. 지금 무엇을 해야 하나

**이미 병합된 작업은 그대로 두시면 됩니다.** `main`·`dev` 어디에도 손댈 것이 없습니다.

다음 작업부터 이렇게 하시면 됩니다.

```bash
git fetch origin
git switch -c fix/118-<작업내용> origin/milestone/v0.5.0   # dev 아님
# ... 작업 ...
git push -u origin fix/118-<작업내용>
gh pr create --base milestone/v0.5.0                      # dev 아님
```

**PR 은 `milestone/v0.5.0` 를 base 로 열어 주세요.** 실수로 `dev` 로 열어도 되돌릴 수 있으니 편하게 물어보셔도 됩니다.

## 3. 보호 규칙 — `milestone/v0.5.0` 도 `main` 과 같습니다

| 항목 | 설정 |
|---|---|
| 직접 push | **불가** (PR 필수) |
| 필수 CI | **6개 전부** (A 규칙 회귀 · B 서버 · B2 Windows 실행기 · C 문서 링크 · D 아트 자산 · **E Roblox Luau**) |
| strict | 켜짐 — base 최신 상태에서만 병합 |
| 관리자 우회 | **불가** |
| force push · 브랜치 삭제 | 금지 |
| 필요한 리뷰 승인 수 | 0 (검수 계약은 별도) |

트랙 브랜치에도 같은 게이트를 건 이유는 **무검증 구간을 만들지 않기 위해서**입니다. 잡 `E. Roblox 클라이언트·규칙 (Luau)` 는 `roblox/` 에서 Luau 컴파일 20파일 · `globalcheck`(선언 없는 식별자) · `rbxcheck`(Roblox API·지역 변수 예산) · `uicheck`(UI 겹침) · `tests/run.luau` 규칙 회귀를 돌립니다.

로컬에서 같은 검사를 먼저 돌려 보시려면:

```bash
cd roblox
luau tests/run.luau          # 규칙 회귀
node tools/globalcheck.js    # 선언 없는 식별자 (LUAU_ANALYZE 환경변수 필요)
node tools/rbxcheck.js
node tools/uicheck.js
```

## 4. 알아 두시면 좋은 것

- **`dev` 의 HTML 규칙 변경을 `milestone/v0.5.0` 로 주기적으로 내려받아야 합니다.** Roblox 엔진은 HTML 데모 규칙을 미러링하므로(예: [#145](https://github.com/ChangjoSung/Digit-Duel/issues/145)·[#154](https://github.com/ChangjoSung/Digit-Duel/issues/154)) 오래 두면 규칙이 갈립니다. 필요할 때 PD 에게 요청하시면 `dev` → `milestone/v0.5.0` 동기화 PR 을 만들어 드립니다.
- **2026-09-10 HTML 접촉·전투 규칙이 크게 바뀌었고 Roblox 미러도 이미 반영돼 있습니다** ([#122](https://github.com/ChangjoSung/Digit-Duel/issues/122)): 동료↔동료·동료↔왕·**왕↔왕이 모두 전투**(밀기·왕 불가침 폐지), 폭탄↔폭탄·폭탄↔함정은 **그 자리에서 둘 다 제거**, 도망 실패 시 **상대의 기본 공격 1회**. `roblox/src/shared/{Battle,Engine,Ai}.luau` 와 `roblox/tests/run.luau` 에 들어가 있습니다.
- **현재 출시본은 `v0.4.7`(hotfix · 게임 내용은 `v0.4.6` 과 동일)이고 여기에 `roblox/` 코드가 함께 `main` 에 올라가 있습니다.** 필수 검사 E 가 `roblox/` 에서 돌기 때문에 제외할 수 없습니다. 다만 **v0.4.6 릴리스 노트·태그의 기능 범위에는 포함되지 않습니다** — Roblox 는 `v0.5.0` 으로 따로 출시합니다. 코드가 `main` 에 있다고 해서 출시된 것이 아닙니다.

## 5. 긴급 수정(hotfix)이 나가면

출시본에 긴급 수정이 나가면 `main` → `dev` → **`milestone/v0.5.0`** 순서로 내려옵니다. 트랙까지 내려오는 것이 절차의 마지막 단계이므로, 담당자가 따로 하실 일은 없습니다 — 다만 **작업 시작 전에 `git fetch` 로 트랙을 최신으로 맞춰** 주세요.

실제로 [v0.4.7 문서 hotfix](../releases/v0.4.7.md)가 그렇게 내려왔습니다. 그 hotfix 가 위 4장의 `v0.4.7` 구분 안내를 담고 있습니다.

## 6. 원본 문서

| 무엇 | 어디 |
|---|---|
| 저장소 전체 규약·브랜치 계약 | [`CLAUDE.md`](../../CLAUDE.md) |
| 기여 방법 | [`CONTRIBUTING.md`](../../CONTRIBUTING.md) |
| v0.5.0 마일스톤 인덱스 | [`docs/milestone/v0.5.0/README.md`](../milestone/v0.5.0/README.md) |
| 포팅 계획 | [`docs/roblox/port-plan.md`](port-plan.md) |
| 경로 이동 대조표 | [`docs/milestone/MOVES.csv`](../milestone/MOVES.csv) |
| 이번 재편 경위 | [Issue #169](https://github.com/ChangjoSung/Digit-Duel/issues/169) |

궁금한 점은 [#118](https://github.com/ChangjoSung/Digit-Duel/issues/118) 에 코멘트로 남겨 주시면 됩니다.
