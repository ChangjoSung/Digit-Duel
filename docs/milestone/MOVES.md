# MOVES — 옛 경로 대조표 안내

문서를 읽다가 `docs/qa/issue106-mars.md`처럼 **지금은 없는 경로**를 만나면 [`MOVES.csv`](MOVES.csv)에서 현재 위치를 찾는다. 이 문서는 그 CSV를 어떻게 읽는지만 설명한다.

## 기준

이 원장에는 **두 번의 이동**이 쌓여 있다. `from` 으로 찾으면 언제나 **현재 경로**가 나온다.

### 1차 — 문서 보관 구조 정리 (#132)

| 항목 | 값 |
|---|---|
| 이동 기준 트리 | `39f022293008d352e4709762af07e42d63fb557e` (Issue #132 착수 시점의 `dev`) |
| 이동 실행 | 2026-09-09 · Issue [#132](https://github.com/ChangjoSung/Digit-Duel/issues/132) |
| 대상 | `git ls-files` 기준 `docs/` 추적 파일 342개 |
| 판정 | 이동 306 · 제자리 유지 36 |
| 삭제·병합 | 0건 |

### 2차 — 버전 재배번 (#169)

| 항목 | 값 |
|---|---|
| 이동 기준 트리 | `28c3445e568d576c6e3e8a5c0c28e0cec532bcb4` (Issue #169 착수 시점의 `dev`) |
| 이동 실행 | 2026-09-10 · Issue [#169](https://github.com/ChangjoSung/Digit-Duel/issues/169) · CJ 승인 |
| 대상 | 버전 키 폴더 5개 — `docs/milestone/v0.4.6→v0.5.0` · `docs/milestone/v0.4.7→v0.4.6` · `demo/test/milestone/v0.4.7→v0.4.6` · `tools/milestone/v0.4.7→v0.4.6` · `docs/releases/v0.4.7.md→v0.4.6.md` |
| 판정 | 이동 313 · 삭제·병합 0건 |

**왜 폴더 이름이 바뀌었나**: HTML 데모 완료분이 `v0.4.7` → `v0.4.6`, Roblox 포팅이 `v0.4.6` → `v0.5.0`, Unity 가 `v0.5.0` → `v0.6.0` 으로 재배번됐다. 폴더는 **마일스톤 버전을 따라가는 주소**라 함께 옮겼다.

**아카이브 본문은 고치지 않았다.** 옮겨진 기록 안에 `v0.4.7 계약`·`v0.4.7 규칙` 같은 서술이 남아 있는데, 그것은 **작성 당시의 판정**이다 ([보관소 규약](README.md)). 1차 이동 뒤에도 `docs/qa/…` 같은 옛 경로 언급이 본문에 그대로 남아 있는 것과 같은 이유다 — 이 원장이 그 매핑을 담당한다. 고친 것은 **깨지는 링크와 도구가 실제로 실행·소비하는 경로**뿐이다.

## 열

`from,to,action,reason,original_blob` 다섯 열이다.

| 열 | 뜻 |
|---|---|
| `from` | 기준 트리에서의 저장소 루트 상대 경로 |
| `to` | 현재 경로. `action=keep`이면 `from`과 같다 |
| `action` | `move` 306 · `keep` 36 |
| `reason` | 그 판정의 근거 |
| `original_blob` | 기준 트리에서의 blob SHA-1 |

`original_blob`은 이동이 **경로만 바꿨는지**를 기계로 확인하는 열이다. 같은 파일의 현재 blob SHA-1(`git rev-parse HEAD:<to>`)이 이 값과 같으면 내용이 한 바이트도 바뀌지 않았다.

단, `git mv` 이후 **본문을 고친 Markdown은 이 값과 달라진다**. 이 표가 다루는 `docs/` 342개 안에서 링크·안내가 갱신된 Markdown이 있고, 현재 안내(`docs/README.md`)와 인수인계 스냅샷처럼 계속 갱신되는 문서도 있으므로 **Markdown의 blob은 달라질 수 있다**고 보는 편이 맞다. 고정된 숫자로 세지 않는다.

**비-Markdown 250개(이동 233 · 유지 17)는 전부 `original_blob`과 일치한다** — 이미지·JSON·CSV·저장된 HTML은 한 파일도 편집하지 않았다. 이 부분이 Saturn 독립 확인의 대상이다.

참고: 링크 갱신은 `docs/` 밖의 루트 `README.md`·`demo/assets/minions/README.md` 등에도 있었지만, 그 파일들은 이 표의 범위(`docs/` 342개)에 들어 있지 않다.

## 사용법

```
# 옛 경로로 현재 위치 찾기
rg -F '"docs/qa/issue106-mars.md"' docs/milestone/MOVES.csv

# 현재 경로로 옛 경로 찾기
rg -F '"docs/milestone/v0.4.4/issues/106/Mars/issue106-mars.md"' docs/milestone/MOVES.csv
```

## 무엇을 고쳤고 무엇을 남겼나

**고친 것 — 클릭 가능한 링크와 이미지.** Markdown의 `[텍스트](경로)`·`![대체텍스트](경로)`와 문서에 직접 박힌 `<a href>`·`<img src>`다. 이동 후에도 열리도록 새 경로로 갱신했다.

**남긴 것 — 본문의 평문 경로 언급, 명령문에 적힌 경로, JSON·CSV·저장된 HTML 안의 경로 문자열.** 그 시점의 참조 원형을 그대로 두는 편이 출처를 되짚기에 편해서다. 경로와 그 파일의 SHA-256을 한 줄에 묶어 기록한 검수 입력표가 대표적인 예다. 그래서 원문을 남기고 이 대조표를 대신 둔다 — 과거 입력은 기준 트리와 `from`·`original_blob`으로 찾는다.

## 검사

`node tools/docs/docs_link_check.js --verbose`가 추적 중인 모든 `*.md`의 내부 상대 링크·이미지를 검사한다. CI의 `docs-integrity` 잡이 매 PR에서 같은 명령을 돌린다.

## 후속 이동 — Issue #134

2026-09-09 CJ의 추가 요청으로 `demo/test`·`tools`·연관 Python 테스트 40개를 정리했다. 코드의 옛 경로는 [#134 MOVES.csv](v0.4.6/issues/134/Mercury/MOVES.csv), 실행 방법은 [검사 인덱스](../../demo/test/README.md)와 [도구 인덱스](../../tools/README.md)에서 찾는다. 위 342행 CSV는 #132 당시의 문서 이동표로 보존하며 새 코드 목록을 섞지 않는다.

CJ의 일정 변경으로 `docs/milestone/v0.5.0/issues/132/Mars/report.md`와 `docs/milestone/v0.5.0/issues/132/Venus/analysis.md`는 같은 하위 경로의 `v0.4.7/`로 옮겼다. [v0.4.6](v0.4.6/README.md)은 Roblox 포팅, [v0.4.7](v0.4.6/README.md)은 기존 CJ 게임·Infra를 안내한다. 당시 버전명·실행 명령·입력 해시·QA 판정이 적힌 역사 본문은 그대로 보존한다.
