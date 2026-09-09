# Issue #132 — 문서 보관 구조 (Venus)

- 역할: **Venus** (`required_role=Venus · mode=PLAN · area=PLAN · mutation=docs · instance_index=null · provider=Claude`)
- Task `task_1cdf3e0f2462`(1차 분석) → `task_165e874d05ad`(매핑 확정) → **`task_8dadcf36f46a`(참조 갱신·인덱스 신설, dispatch `ctx_b0aff53ebee2`)**
- 기준 트리: `dev 39f022293008d352e4709762af07e42d63fb557e` · 브랜치 `infra/132-docs-actions`
- 작성: 2026-09-09
- 표기: **[확정]** 명령·파일로 실측 / **[제안]** Venus 설계 판단 / **[PD 결정]** PD가 확정해 반영한 사항 / **[미확정]** 확인하지 못함
- 범위: 이 세션은 **Markdown 문서만** 편집했다. 파일 이동·삭제·코드·테스트·워크플로·Git·GitHub·Notion 쓰기는 하나도 하지 않았다. 사용자 소유 `art/`·`orca-hook-latency-report.md`·Downloads는 열지도 탐색하지도 않았다.

---

## 1. 무엇을 정리했나

`docs/` 아래 추적 파일 342개가 `docs/qa/`(248) · `docs/art/`(51) · `docs/` 루트(8) · 상시 폴더(35)에 섞여 있었다. `docs/qa/`에는 v0.4.3~v0.4.5 세 마일스톤의 구현 보고·QA 보고·캡처 증빙이 파일명 접두사(`issue106-…`)만으로 구분된 채 평평하게 쌓여 있었다. 어떤 Issue의 어떤 역할이 무엇을 주장했는지 알려면 파일명을 읽어야 했다.

**버전 → Issue → 작성 역할**로 재배치했다. **[PD 결정]** 이동 306 · 제자리 유지 36 · 삭제 0 · 병합 0. 전수 대조표는 [`docs/milestone/MOVES.csv`](../../../../MOVES.csv)(342행)이며 읽는 법은 [`MOVES.md`](../../../../MOVES.md)에 있다.

| | 이동 | 유지 | 합 |
|---|---|---|---|
| Markdown | 73 | 19 | 92 |
| 그 외 (PNG·JSON·CSV·HTML) | 233 | 17 | 250 |
| **합** | **306** | **36** | **342** |

이동 분포는 v0.4.3 125 · v0.4.4 144 · v0.4.5 37이다. **[확정]** 이동 후 `docs/qa`·`docs/art`의 **추적 네임스페이스는 비었다**(`git ls-files docs/qa` → 0행, `docs/art` → 0행). 물리 폴더의 존재 여부는 별개 문제다 — 5장을 본다.

### 1-1. Milestone 매핑 **[확정]**

`gh api repos/ChangjoSung/Digit-Duel/milestones?state=all` 실측이다. 1차 분석의 "v0.4.3 (M9)"는 오기였고 **v0.4.3은 Milestone 7, M9는 v0.4.2**다.

| 버전 | Milestone | Issue |
|---|---|---|
| v0.4.3 | **7** | #81 #83 #87 #89 |
| v0.4.4 | 10 | #91~#96 #104 #105 #106 |
| v0.4.5 | 11 | #114 |
| v0.4.6 | 12 | #118~#132 |

`#104`는 `#93`의 sub-issue다. 깊이 1단계 규칙에 따라 `issues/93/` 아래로 중첩하지 않고 `issues/104/`에 두었다.

---

## 2. 경로 규약 **[제안 → PD 채택]**

```
docs/milestone/
  README.md · MOVES.md · MOVES.csv
  <버전>/
    README.md                        버전 인덱스
    specs/                           그 버전의 승인 규격 (역할 하위폴더 없음)
    reports/<역할>/                  마일스톤 전체 범위의 취합·분석
    issues/<번호>/<역할>/            그 Issue의 작업물
    issues/<번호>/<역할>/artifacts/  그 보고서가 인용하는 캡처·JSON·HTML
    assets/                          여러 Issue에 걸친 공용 자산 묶음 (v0.4.3 아트)
```

세 가지 판단의 근거만 남긴다.

1. **`specs/`에는 역할 폴더를 두지 않는다.** 게임플레이 계약은 Venus 초안 → PD 채택 → CJ 승인을 거친 프로젝트 소유 문서지 한 역할의 산출물이 아니다. 반면 `reports/`·`issues/`는 "누가 무엇을 주장했는가"가 증거의 일부라 역할로 나눈다.
2. **아트 데이터 묶음은 마일스톤 레벨(`v0.4.3/assets/minions/`)에 둔다.** `source-manifest.csv`는 `#81`, `delivery-manifest.csv`는 `#87` 산출물이다. 한 Issue 아래 넣으면 다른 Issue의 산출물을 그 Issue 것으로 표시하게 된다. 부수 효과로 하위 구조가 보존돼 `assets/minions/README.md`의 자산 링크 9개가 수정 없이 살아남았고, `tools/minion_art.py`의 경로 상수 4개가 같은 새 base 하나를 공유하게 됐다.
3. **인스턴스 접미사(Mars_1·Saturn_2)는 폴더로 만들지 않는다.** 한 Issue에 여러 인스턴스가 섞이고(#104는 Mars_1·Mars_3), 인스턴스별 폴더를 만들면 폴더마다 파일 1개씩 흩어진다. 인스턴스는 이미 각 문서 첫머리에 적혀 있다.

**[PD 결정]** `git mv`는 경로만 바꾸고 basename은 전부 보존했다. `initial`·`first`·`revise`가 붙은 이름은 문서 간 인용이 이름으로 걸려 있어(6장) 그 자체가 참조 대상이다.

---

## 3. 참조 무결성 — 무엇을 고치고 무엇을 남겼나

**[PD 결정]** 명령문·평문 경로와 JSON/CSV의 출처 기록은 MOVES 대조표와 함께 그대로 둔다. 단 깨진 클릭 링크는 면제되지 않는다.

| 구분 | 처리 |
|---|---|
| Markdown 클릭 링크·이미지 `](경로)`, 문서에 박힌 `<a href>`·`<img src>` | **새 경로로 갱신** |
| 본문의 평문 경로 언급, 명령문에 적힌 경로 | 원문 보존 |
| JSON·CSV·저장된 HTML 안의 경로 문자열 | **편집 금지** — 도구 출력 바이트 자체가 증거 |
| 과거 QA 판정·수치·측정값·Task ID | 편집 금지 |

평문을 남기는 이유는 그 시점의 참조 원형을 그대로 두는 편이 출처를 되짚기에 편해서다. **경로와 그 파일의 SHA-256을 한 줄에 묶어 기록한 검수 입력표**가 대표적이다 — 예: `issue105-saturn-media.md`는 선행 문서 `issue105-saturn-media-first.md`를 SHA-256과 함께 자기 검수 입력으로 등재해 두었다. 그 줄을 원문대로 두면 "당시 그 경로의 그 바이트"라는 진술이 그대로 읽힌다.

파일 내용은 경로와 별개이므로, 경로를 갈아 끼운다고 해서 기록된 해시의 대상이 사라지는 것은 아니다. 이번 링크 수정으로 일부 Markdown의 blob은 달라졌지만, 과거 입력은 기준 트리 `39f022293008d352e4709762af07e42d63fb557e`와 `MOVES.csv`의 `from`·`original_blob`으로 언제든 찾을 수 있다.

대신 옛 경로를 만난 독자를 위해 [`MOVES.md`](../../../../MOVES.md)와 각 버전 인덱스 말미에 한 줄 안내를 두었다.

### 3-1. 실제 수정량 **[확정]**

`node tools/docs_link_check.js` 기준. 착수 시점 135건 → 완료 0건.

| 소관 | 파일 | 링크 문제 | 편집한 링크 자리 |
|---|---|---|---|
| Venus | 15 | 131 | 119 |
| PD (`CLAUDE.md` 1 · `docs/creat2ve/HANDOVER_SNAPSHOT.md` 3) | 2 | 4 | — |

131과 119의 차이는 한 줄이 같은 대상을 `<a href>`와 `<img src>`로 두 번 가리키는 경우다(루트 `README.md`의 플레이 화면 2장 등). 검사기는 두 번 세고, 편집은 한 자리에서 함께 처리했다.

### 3-2. 깨진 링크가 몰려 있던 곳

| 파일 | 건수 | 성격 |
|---|---|---|
| `docs/milestone/v0.4.3/issues/87/Earth/earth-1-report.md` | 30 | 20종 대조표의 `<img src>` — 폴더 깊이가 3단계에서 6단계로 바뀌어 전부 깨졌다 |
| `docs/milestone/v0.4.3/assets/minions/README.md` | 18 | 데이터는 `assets/`, 보고서는 `issues/87/`로 갈라졌다 |
| `docs/milestone/v0.4.4/reports/Mercury/v044-followup-pd-report.md` | 14 | 취합 보고가 `issues/104|105|106`과 `specs/`를 가리킨다 |
| `docs/README.md` | 12 | 안내 표 전체 |
| `docs/milestone/v0.4.5/issues/114/Mercury/issue114-pd-report.md` | 9 | `Mercury/` → `Venus/`·`Mars/`·`Mars/artifacts/`·`docs/media/` |
| 루트 `README.md` | 7 | 공개 README의 플레이·전투 화면 2장과 규격 링크 |
| 그 외 9파일 | 41 | |

`docs/milestone/v0.4.3/issues/87/Earth/earth-1-report.md`처럼 **본문 표에 박힌 `<img src>`**가 가장 많았다. Markdown 링크만 보고 넘어가면 놓치는 유형이라 검사기가 HTML 속성까지 보는 것이 중요했다.

---

## 4. 삭제·병합 0건 **[확정]**

PD 지시대로 "고유 해시 존재"만으로 판단하지 않고, 가장 짧고 중복 가능성이 높은 6개 QA 연쇄(#87 파일럿 · #93 · #94 · #104 방향 감사 · #105 미디어 · #106)를 전문 독해로 재검토했다.

**결론: 삭제 0 · 병합 0.** 근거는 이 문서들이 서술이 아니라 **측정 원장**이고, 선행 문서에만 있는 고유한 입력값·측정값이 후속 문서에 흡수되지 않았기 때문이다.

| 연쇄 | 선행 문서에만 있는 것 |
|---|---|
| #93 Saturn initial | 음성 대조 5종의 개별 수치(61/2 · 57/6 · 57/6 · 41/22 · 61/2), 브라우저 실측 y좌표(729/81/621/189), C10·F3 항등 단언의 한계 서술 |
| #94 Saturn initial | 실제 2클라이언트 전투 경합 22와 VIP/PVE 23의 재현 절차·좌표 fixture, 음성 대조 119/3 |
| #105 Saturn media-first | `readme_media_capture.js` 5개 지점의 REVISE 지적과 입력 SHA 18개 |
| #104 방향 감사 first | rev2 false-green 결함 자체(`step()`이 `agree()` 반환을 버림)와 CDP 19/0 실측 |
| #106 Saturn first | 통과 범위 수치(신규 규칙 171 · 짧은 타이머 28 · 헤드리스 8922), 실제 브라우저 타이밍(일반 턴 2038ms · PVE AI 2688ms · BT FAST 600ms), Task 계보 |
| #87 파일럿 | 세 자산 리비전의 각기 다른 icon/source SHA와 결함 지점(`minion_art.py:63-64,274-278` 등) |

이 문서들을 **직접 남겨 두는 편이 낫다**는 실무적 판단이다. 다음 두 가지는 근거가 아니다.

- **"지우면 영원히 검증 불가"는 근거가 아니다.** Git에 과거 커밋과 blob SHA가 남아 있으므로 삭제해도 이력에서 되짚을 수 있다. 근거는 되짚기의 가능 여부가 아니라, 이 자료들이 **현재 문서가 인용하는 원장**이라 저장소 트리에서 바로 열리는 편이 실제로 유용하다는 점이다.
- **"PD가 취합하면 Saturn 판정을 위조하는 것"도 근거가 아니다.** 출처를 명시한 PD 취합은 정당한 작업이며 실제로 `reports/Mercury/`가 그 역할을 한다. 위 수치들은 이미 기존 보고에 기록돼 있으므로, **출처 문서와 당시 측정 범위를 함께 밝히면 재측정 없이도 취합할 수 있다.**

이번에 0삭제·0통합을 택한 것은 취합이 불가능해서가 아니라, **원본 측정과 REVISE 연쇄를 그 순서 그대로 바로 열어 읽는 편의**와 **원형 보존**을 이 시점의 우선순위로 두었기 때문이다. 취합본이 필요해지면 위 표의 출처를 근거로 별도 작업에서 만들면 된다.

**[제안 → 이번 범위에서 채택]** 파일 수를 줄이지 않고 탐색성을 얻는 방법으로 **버전 단위 인덱스**를 골랐다. Issue마다 README를 만들면 폴더당 파일이 하나씩 더 늘어 원래 문제가 재발한다. 대신 버전 인덱스 하나가 그 버전의 Issue·역할·읽는 순서를 표로 보여준다.

---

## 5. 남은 한계와 다른 역할 소관

| ID | 내용 | 소관 |
|---|---|---|
| L-1 | `issues/104/Mars/orientation-artifacts/README.txt`가 증거로 지목하는 `headless_verbose.log`·`mutants.log`·`cdp_read_only.log` 3개는 **저장소에 없다**. `.gitignore`의 전역 `*.log`에 걸려 한 번도 커밋되지 않았다. **이번 이동이 만든 문제가 아니라 이전부터 있던 한계**이며, 이 세션은 재생성·복구·내용 열람을 하지 않았다 | Mars/PD 별건 |
| L-2 | `docs/qa/`에는 위 무시된 로그가 로컬 작업 트리에 남아 있을 수 있다. 추적 네임스페이스는 비었지만(`git ls-files docs/qa` → 0행) **"물리 폴더가 사라졌다"고 말할 수는 없다.** 이 세션은 그 디렉터리를 삭제·강제 추가·미추적 스캔하지 않았다 | 보고만 |
| L-3 | `.github/workflows/ci.yml`, `tools/docs_link_check.js`와 그 테스트, `tools/minion_art.py`·`tests/`의 경로 상수, 각 도구의 `--out` 기본값 | **Mars** — [보고서](../Mars/report.md) |
| L-4 | `.gitattributes`의 경로 규칙, `CLAUDE.md`·`docs/creat2ve/HANDOVER_SNAPSHOT.md`의 링크, Git·GitHub·Notion 기록 | **PD** |
| L-5 | `#123`·`#124`가 만들 새 아트 데이터를 `v0.4.3/assets/`에 추가할지 `v0.4.6/assets/`를 새로 열지. **아트 범위 확정 후 정하면 되는 유예 항목이며 이번 승인을 막는 조건이 아니다** | 후속 |

`tools/docs_link_check.js`는 `git ls-files`로 열거하므로 **PD가 새 인덱스를 stage하기 전에는 그 파일들이 검사 대상에 들어오지 않는다.** 이 세션은 검사기를 읽기 전용으로만 실행했고 회피 예외를 추가하거나 검증 코드를 고치지 않았다.

---

## 6. 이 세션이 한 일 (완료 보고)

### 6-1. 새로 만든 문서 6개

| 파일 | 내용 |
|---|---|
| `docs/milestone/README.md` | 버전·Issue·역할 길잡이, 폴더 규약, 옛 경로 안내 |
| `docs/milestone/MOVES.md` | `MOVES.csv` 읽는 법 · 기준 SHA `39f022293008d352e4709762af07e42d63fb557e` · 고친 것/남긴 것 |
| `docs/milestone/v0.4.3/README.md` | #87 Earth·Mars·Saturn, #89, 공용 자산, 문서 없는 #81·#83 |
| `docs/milestone/v0.4.4/README.md` | specs 3 · reports 4 · Issue 9개의 역할별 문서와 읽는 순서 |
| `docs/milestone/v0.4.5/README.md` | 현재 출시본 규격 · #114 역할별 문서 |
| `docs/milestone/v0.4.6/README.md` | 진행 중인 #132, 별도 소유 #118, 등록된 나머지 범위 |

Issue별 README는 만들지 않았다(4장).

### 6-2. 고친 문서

| 파일 | 무엇을 |
|---|---|
| `README.md` | 깨진 링크 7 · 저장소 구조 트리 · CI 안내 · 자산 제외 범위 경로 |
| `CONTRIBUTING.md` | CI 잡 5개(`rules-headless` `server` `server-launcher-windows` `docs-integrity` `assets-integrity`)와 로컬 재현 명령, 승인된 규칙 변경 시 단언 갱신 원칙, 회피 예외 금지, **branch protection은 "적용 예정"으로 기술** |
| `ASSET-LICENSE.md` | 제외 자산의 이동한 경로 — `docs/milestone/v0.4.3/assets/minions/`와 `issues/87/Earth/`의 생성 레퍼런스 2장 포함. 권리 범위와 이미지 유형 한정은 그대로 |
| `docs/README.md` | 현재 안내로 압축하고 버전별 기록은 마일스톤 인덱스로 위임 |
| `demo/assets/minions/README.md` | 링크 경로 4 |
| 이동한 문서 11개 | 깨진 클릭 링크·이미지만 |
| `docs/releases/v0.4.5.md` (제자리 유지) | 이동한 대상을 가리키던 링크 5 |
| 이 보고서 `analysis.md` | 본문 갱신 |

이동한 11개: `v0.4.3/assets/minions/README.md`(18) · `v0.4.3/issues/87/Earth/earth-1-report.md`(20) · `v0.4.3/specs/minion-visual-spec-v0.4.3.md`(6) · `v0.4.4/issues/106/Saturn/issue106-saturn-first.md`(1) · `v0.4.4/reports/Mercury/v044-followup-pd-report.md`(14) · `v0.4.5/issues/114/Mars/issue114-mars-followup.md`(1) · `v0.4.5/issues/114/Mercury/issue114-pd-report.md`(9) · `v0.4.5/issues/114/Venus/issue114-notion-sync.md`(3) · `v0.4.5/reports/Mercury/v0.4.5-analysis.md`(8) · `v0.4.5/specs/v0.4.5-gameplay-spec.md`(8) · `v0.4.5/specs/v0.4.5-rules-digest.md`(5).

`docs/releases/v0.4.5.md`는 제자리 유지 문서이며, 이동한 대상을 가리키던 링크만 고쳤다.

3-1의 "Venus 15파일"과 이 표의 관계 — 15는 **검사기가 착수 시점에 깨진 링크를 발견한 파일 수**다: 상시 문서 3(`README.md` · `demo/assets/minions/README.md` · `docs/README.md`) + 이동 11 + 제자리 1(`docs/releases/v0.4.5.md`). `CONTRIBUTING.md`와 `ASSET-LICENSE.md`는 깨진 링크가 없었고 다른 이유로 고쳐서 15에 들어 있지 않다. 이 보고서와 신규 인덱스 6개는 착수 시점에 없었거나 검사 대상이 아니었다.

과거 QA 판정·수치·Task ID·평문 경로·JSON/CSV/HTML 바이트는 한 곳도 고치지 않았다.

### 6-3. 검증 **[확정]**

```
node tools/docs_link_check.js
=== docs_link_check: 문서 106개 · 내부 링크 332건 검사 · 외부/앵커/코드 117건 제외 · 문제 0건 ===
```

읽기 전용 실행이다. 검사기와 CI 설정은 고치지 않았다.

### 6-4. PD에게 남기는 확인 사항

1. **stage 확인.** 작업 도중 PD가 `docs/milestone/MOVES.csv`와 새 인덱스를 stage해 검사기가 106개 문서를 열거하게 됐다. 이 보고서 자체의 최종 편집 이후 한 번 더 검사를 돌리면 최종 확인이 된다.
2. **`docs/milestone/v0.4.6/README.md`의 `../../../CONTRIBUTING.md`·`../../../CLAUDE.md`는 "한 단계 부족"하지 않다.** `docs/milestone/v0.4.6/` → `docs/milestone/` → `docs/` → 저장소 루트로 3단계가 맞고, 대소문자까지 확인하는 검사기가 0건으로 통과한다. 4단계로 바꾸면 저장소 밖을 가리키게 되므로 지적을 반영하지 않았다.
3. `#118`은 PD 지적대로 "착수 전"에서 **별도 소유(`feature/118-roblox-port`) 진행 중**으로 고쳤다.
4. `CONTRIBUTING.md`의 branch protection 문단은 실제 CI green 이후 PD가 적용 결과 문장으로 치환하면 된다.
5. `docs/milestone/v0.4.6/README.md`에 Mars 보고서(`issues/132/Mars/report.md`) 링크를 파일 생성 확인 후 추가했다.
