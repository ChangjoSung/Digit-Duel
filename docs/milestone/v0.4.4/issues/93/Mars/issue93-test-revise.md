# Issue #93 — 테스트 품질 REVISE (Mars_2 · 항등 단언 C10·F3·E10 치환)

- 역할: **Mars_2** (required_role=Mars · instance_index=2 · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- Task `task_b5679c83aa4c` · dispatch `ctx_8308b185646b` · 브랜치 `fix/93-own-side-bottom` · 기준 HEAD `6e24151` (작업공간 폴더명 `fix-95-attack-archetype-balance` 재사용)
- 계기: Saturn 제품 PASS(`msg_1e81e1fa1dec`, 660 smoke + Chrome 18 + 독립 15 + mutant 5)와 함께 지적된 **항등 단언 3건** — `C10`·`F3` 의 `||true`, `E10` 의 `indexOf>=0`. PD 조건: 병합 전 의미 있는 단언으로 치환.
- 작성: 2026-09-07 · 제품·하네스·CDP·다른 파일 무수정 · Git/GitHub/Notion 쓰기 없음(stash 포함 0) · 위임 없음.
- **이 문서의 범위**: Mars_2 자기 검증 수치다. Saturn 최종 표적 QA 이전이므로 "검증 완료"를 주장하지 않는다.

---

## 1. 변경 파일 (2개뿐)

| 파일 | 변경 | 확정/추론 |
|---|---|---|
| `demo/test/smoke_own_side.js` | +37/−4 줄. C10 → C10a/C10b, F3 → F3a/F3b, E10 → E10a/E10b 치환. D11 은 칩만 세도록 1식 수정(§4). 헤더에 REVISE 이력 2줄. | [확정] `git diff --stat` |
| `docs/qa/issue93-test-revise.md` | 이 보고 (신규) | [확정] |

`git status --short` 의 다른 항목은 `?? docs/qa/issue93-saturn-initial.md`(PD가 Saturn inline 보고를 취합한 문서, 무접촉)뿐이다.

---

## 2. 치환 내용 — 옛 단언이 왜 항등이었고, 무엇으로 바꿨나

| ID | 옛 단언 (HEAD 6e24151) | 왜 무의미 | 새 단언 | 위치 |
|---|---|---|---|---|
| C10 | `S.log.every(l=>!/\(\d+,\d+\)/.test(l.msg)\|\|true)` | `\|\|true` 로 항상 참. 게다가 제품 로그에는 `(r,c)` 형식 문구 자체가 없어 정규식도 무대상. | **C10a** 반사 렌더 2회 전후 정본(`snap`=논리 S 직렬화 · 로그 전문 · 로그 길이 · 토스트)이 문자열로 완전 동일 + flip=1 + 행 반사 순열. **C10b** 양 클라이언트 로그 전문 동일 — 정규화는 기존 뷰어 상대 호칭 두 가지만(`pname` 온라인 분기 `나(Pn)/상대(Pn)`→`Pn`, netStart 식별 줄 `당신은 Pn입니다`→`P?`), 식별 줄은 각 1개, 원문은 서로 다름(정규화가 실제로 작동했다는 전제). | :126~137 |
| F3 | `cells(T2).slice(70).every(...)\|\|true` | `\|\|true`. 앞 조건도 "아래 3행 전부 P2 칩"이라 이동 후 상태에서는 거짓이 되는 잘못된 기대치였다. | **F3a** 종료 리빌(viewer=2)에서 살아있는 모든 말이 P2 화면의 반사 인덱스 칸에 `pc` 칩 정확히 1개 — 클래스 `p{owner}` · `hiddenId`/`memo-guess`/`own` 없음 · `innerHTML===pcBodyHtml(p)` · `aria-label===pcLabel(p)` · `!=="?"`. 전제로 종료 시점에 `revealed=false` 인 상대 말이 1개 이상(라벨에 개수 기록 — 실측 14) 있어야 리빌이 실제 검증이 된다. **F3b** 양 클라이언트의 논리 칸별 렌더 서명(클래스·강조·칩 HTML) 91칸 완전 동일 — 둘 다 전체 공개 시점이므로 차이는 DOM 순서(F1·F2)뿐. | :237~246 |
| E10 | own 칩 칸마다 `cells(T).indexOf(x)>=0` | `cells(T)` 에서 고른 원소의 `indexOf` 는 항상 ≥0 (항등). | **E10a** 같은 상태·같은 뷰어(P2)를 반사 렌더: 내 말 전부 화면 인덱스 70~90(아래 3행) · `dispIdx(true)` 일치 · `own` 칩, 상대 13개 전부 0~20(위 3행) · `own` 아님. **E10b** 비반사 렌더(핫시트 동일 뷰어): 띠가 정반대(내 말 0~20 · 상대 70~90) · 말마다 두 렌더의 인덱스가 다르고(`i!==j`) 열은 같다(`i%7===j%7`). 하네스 `board.children` 이 렌더마다 제자리 갱신되므로 인덱스는 렌더 직후 읽는다(주석 명시). | :215~226 |

옛 단언 3개는 어느 것도 새 단언의 근거로 세지 않았다.

---

## 3. 실행 명령 · 수치 (정확한 명령)

```
node demo/test/smoke_own_side.js
# === smoke_own_side: pass 66 / fail 0 ===   ← 20회 연속 동일 (for i in $(seq 1 20) … | sort | uniq -c → "20 pass 66 / fail 0")
git show dadc8bc:demo/index.html | node demo/test/smoke_own_side.js --stdin
# === smoke_own_side: pass 28 / fail 38 ===  (#93 이전 HTML 음성 대조, 파일 작성 0) — C10a·C10b·E10a·E10b·F3a·D11 모두 실패, F3b 는 통과(양 클라이언트 일치 단언이라 옛 HTML 에서도 성립 — 의도)
```

**개수 변화 63 → 66**: C10·F3·E10 각 1개를 (a)/(b) 2개로 나눴다(+3). 실패 시 어느 성질이 깨졌는지(렌더의 상태 오염 vs 로그 불일치 / 정체 vs 양측 일치 / 반사 띠 vs 비반사 띠·열 보존)를 이름으로 구분하기 위해서다. 다른 단언은 수·순서 불변.

제품 회귀 재실행은 하지 않았다 — `demo/index.html`·`harness.js`·CDP 스크립트가 바이트 단위로 HEAD 와 같다(§5). Saturn 의 660 smoke / Chrome 18 은 그대로 유효하다.

---

## 4. D11 — 범위 외이지만 같은 파일의 간헐 실패 1식 수정 (보고)

첫 기준 실행(변경 전 HEAD 파일)에서 `D11 이동한 말이 P2 화면의 반사 위치에 own 칩으로` 가 6회 중 1회 실패했다(62/63). 원인 [확정, 소스]: `doMove`(`demo/index.html:1070`)가 이벤트 칸으로 이동하면 `S.traces[owner].add` 하고, `renderBoard` 가 그 칸에 `🔍 trace` span 을 칩 앞에 붙인다. 옛 D11 은 `children.length===1`·`children[0]` 로 검사해 흔적 span 이 붙은 시드에서 거짓이 됐다. 수정: `pc` 클래스 칩만 걸러 정확히 1개·`own` 인지 검사(:173~174). 판정 의미는 그대로이고, 시드에 따라 거짓 실패하던 것만 없앴다. 제품 동작에는 손대지 않았다. PD 가 범위 외로 판단하면 이 2줄만 되돌리면 된다(다른 변경과 독립).

---

## 5. 메모리 내 표적 mutant (mutant HTML 파일 0)

방법: 스크래치패드 러너가 `demo/index.html` 을 읽어 지정 조각 1개(정확히 1회 일치 검증)를 치환해 stdout 으로 내보내고, `node demo/test/smoke_own_side.js --stdin` 이 메모리에서 읽는다. 저장소 안팎 어디에도 mutant HTML 을 쓰지 않았다(러너·구본 테스트 사본은 세션 스크래치패드에만 있고 납품물이 아니다). "OLD" 열은 HEAD `6e24151` 의 옛 `smoke_own_side.js`(스크래치패드 사본, 경로만 절대경로로 치환)를 같은 mutant 에 돌린 결과다.

| # | mutant (제품 조각 → 치환) | 겨냥 | 새 테스트 결과 | 옛 테스트 결과 |
|---|---|---|---|---|
| M1 | netStart 시작 로그 끝에 `${NET.me===1?" [화면 행 13→1]":""}` 추가 (반사 표기가 로그에 섞임) | C10b | **65/66 — C10b 만 실패** (C8 정규식은 여전히 통과 → C10b 고유 검출) | 63/63 통과 (미검출) |
| M2 | `renderBoard` 에서 `if(flip) S.log.push({msg:"(반사 렌더)"})` (렌더가 로그에 씀) | C10a | **64/66 — C10a·C10b 실패** | 63/63 통과 (미검출) |
| M3 | `(S.mode==="sim"\|\|S.phase==="over")?2` → `(S.mode==="sim")?2` (종료 전체 공개 제거) | F3a·F3b | **63/66 — F3a·F3b·F4 실패** | 63/63 통과 (미검출 — 옛 F4 는 `\|\|true` 아님에도 통과: 시드상 숲 밖 말만 있었음 [추론]) |
| M4 | `known = viewer===2\|\|…` → `known = p.owner===viewer\|\|p.revealed` (종료 화면 칩이 `?`·hiddenId) | F3a (정체) | **64/66 — F3a·F3b 실패, F4 통과** → F3a 가 F4 가 못 보는 정체를 본다 | 63/63 통과 (미검출) |
| M5 | `(p.owner===viewer?" own":"")` → `(p.owner===0?" own":"")` | E10a | **59/66 — E10a·E10b·C5·C7·D11·F3a·F3b 실패**; E4~E9·E11 은 통과(서명 비교·위치만이라 못 봄) → E 절 안에서는 E10 만 검출 | 60/63 — C5·C7·D11 만 실패, **옛 E10 통과** |
| M6 | `boardFlipped` 에 핫시트 P2 턴(`S.mode==="pvp"&&S.current===1`) 반사 추가 | E10b (비반사 띠) | **55/66 — E10b·C4·C6·D12·E4~E9·G1 실패** | 54/63 — D11·D12·E4~E9·G1 실패, **옛 E10 통과** |

정리: 옛 항등 단언은 6개 mutant 어느 것에도 반응하지 않았고(M1~M4 는 옛 스위트 전체가 63/63 통과), 새 단언은 겨냥한 mutant 마다 실패한다. M1·M4·M5 는 새 단언이 **기존 다른 단언이 못 보던** 결함을 잡는 사례다.

---

## 6. 최종 해시 · 제품 불변 근거

| 파일 | SHA256 | 상태 |
|---|---|---|
| `demo/test/smoke_own_side.js` | `a1d1533c3d75e5b5806f0a47dcee069f0496c9cd1cf2f6be8681ff6f19030f26` | 변경 (HEAD 판 `4d50ed48…2afe2` → 263줄) |
| `demo/index.html` | 작업 트리(CRLF, attr eol=crlf) `9b48bec6214b5998c724d5092c26ad49fb9f7045fc81d67bf66a4add1aaff904` · LF 정규화 `842add6ff7ff71da1b44c039fb1ce18641a76edf50e6cd0be31af1af54ec69ae` | HEAD `6e24151` 과 동일 — `git hash-object demo/index.html` = `git rev-parse HEAD:demo/index.html` = `35022dbe8ed96f69966954042e4e5432513b48d3`, `git diff --quiet` 변경 0. (`git show HEAD:demo/index.html \| sha256sum` 은 LF 값 842add… 과 일치; 작업 트리 값과의 차이는 체크아웃 CRLF 변환뿐) |
| `demo/test/harness.js` | `571f6b1cc60f4f098d9a3a7e172d96d1c4e35902f7a7832bbf01953add9715f8` | 무변경 |
| `demo/test/issue93_cdp.js` | `8e1c3cb9b5039b632471412ca70799b988a1e6292b770ccad2fd1d50b91226ed` | 무변경 (Mars 1차 보고와 동일 값) |
| `docs/qa/issue93-test-revise.md` | (PD 취합 시 계산) | 신규 |

`git diff --stat` = `demo/test/smoke_own_side.js | 41 +++++++++++++++++++++++++++++++++++++----` 1개 파일. `git stash list` 0건. 보호 경로(art/·orca-hook-latency-report.md·Downloads) 무접촉.

---

## 7. Saturn 최종 표적 QA 재실행 경로 (읽기 전용)

```
node demo/test/smoke_own_side.js                                              # 66/66, 파일 쓰기 0
git show dadc8bc:demo/index.html | node demo/test/smoke_own_side.js --stdin   # 28/66 종료 1 (음성 대조)
git hash-object demo/index.html; git rev-parse HEAD:demo/index.html           # 둘 다 35022dbe… = 제품 blob 동일 (작업 트리는 CRLF 체크아웃)
```
mutant 재현은 §5 의 치환 조각을 임의 방법으로 메모리에서 적용해 `--stdin` 으로 흘리면 된다(파일 작성 불필요). 기획 판단이 필요한 항목은 없다([기획 필요] 0).

## PD 인수 판단

D11의 흔적 span 제외는 동일 검사의 거짓 실패를 고치는 관련 테스트 수정으로 인수한다. C10b의 양측 로그 정규화는 제품 계약의 추가 요구가 아니며 C10a의 동일 클라이언트 상태·로그 불변 검증을 대체하지 않는다. 최종 Saturn은 이 구분과 새 단언의 검출력을 확인한다.
