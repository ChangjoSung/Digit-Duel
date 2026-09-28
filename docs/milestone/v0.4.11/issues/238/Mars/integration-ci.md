# #238 통합 PR273 — CI A·D 복구 (Mars)

- 일자: 2026-09-28 · 역할: Mars (CLIENT_TOOLING, IMPLEMENT, mutation=code) · task_bb0e3ae57ddb / ctx_6d1ae2695dc0
- 모델: claude-opus-5-5 high · Ponytail full · PD preflight GO 수신 후 착수
- 기준: issue-238-integration HEAD 4d6428b (clean)

## 1. 잡 A — smoke_tutorial G17 (run 36382170675 · job 108800018235, 138 pass / 1 fail)

**원인 (확정)**: G14~G22 가 쓰는 `css` 는 `/* ===== #26 튜토리얼 모달` 표지부터 `</style>` 까지 잘라 왔다.
하네스가 `demo/css/game.css` 전체를 `<style>` 로 인라인하므로, 튜토리얼 뒤에 붙은 #260 로비·#261 방·#238 경기 UI
구획(0열 `/* ===== …` 주석으로 시작)의 `position:absolute`(`.hudIco .num`·`.acctSheet`·`.loadBar` 등)와
`.synHelp{position:fixed}` 가 튜토리얼 CSS 로 오인됐다.

**튜토리얼 구획 경계 (실측)**: game.css 585행 `  /* ===== #26 …` 부터 698행까지가 2칸 들여쓴 튜토리얼 블록
(#42 격자·반응형 3단, #122 어두운 표면 보정 포함). 699행 `/* #263 단절 정지` 부터 0열 주석으로 다른 화면 구획이 시작된다.

**수정**: `demo/test/regression/smoke_tutorial.js` — 끝 경계를 `</style>` 대신 표지 뒤 첫 0열 주석(`\n/* `)으로 둔다
(없으면 종전대로 `</style>`). G17 조건(absolute 0 · fixed 정확히 2 = `#tutOverlay`·`#tutHint`)은 그대로이며 G17 삭제·skip 없음.
CRLF 체크아웃에서도 `\n/* ` 는 일치한다.

**결과**: `node demo/test/regression/smoke_tutorial.js` → `pass 139 / fail 0`. fixed 2곳이 잡혔으므로 튜토리얼 블록 전체가 범위 안이다.

## 2. 잡 D — leaders_export --check (job 108800018183, 일치 9 / roles-manifest.json 만 불일치)

**원인 (로컬 증거로 확정, CI 러너 바이트는 미직접관측)**: `.gitattributes` 는 `leaders-manifest.json` 에만 `text eol=lf` 를 건다.
#238 로 추가된 `roles-manifest.json` 은 속성이 없어 windows 러너(core.autocrlf)에서 CRLF 로 체크아웃되고,
익스포터가 굽는 LF JSON 과 **바이트** 비교에서 떨어진다. 로컬(작업 트리 LF)에서는 같은 파일이 일치한다.
`.gitattributes` 는 이번 소유 경로가 아니므로 도구 쪽에서 해결했다.

**수정**: `tools/art/leaders_export.py` — `text_lf()` 추가, `--check` 의 **매니페스트 비교에만** CRLF→LF 정규화 적용.
PNG 비교는 종전대로 정확 바이트. 쓰기 경로·매니페스트 내용·자산은 불변.

**테스트**: `tools/art/test/test_leaders_export.py` 에 `test_check_manifest_crlf_portable` 1건 추가 —
(a) 두 매니페스트를 CRLF 로 바꿔도 `--check` 0 이고 아무것도 쓰지 않음 (b) roles-manifest 의 JSON 값(size 64→65) 변경은 1
(c) PNG 에 `\r\n` 바이트 추가는 1 (PNG 는 정규화 대상 아님). 전부 임시 디렉터리.

**결과**: `python3.14 -m unittest tools/art/test/test_leaders_export.py` → `Ran 9 tests … OK` ·
`python3.14 tools/art/leaders_export.py --check` → `일치 10 / 불일치 0 (쓰기 0)`, exit 0. (Python 3.14.3 · Pillow 12.3.0)

## 3. demo/js/lobby.js 20행

빈 줄의 후행 공백 2칸만 제거 (공백 전용, 의미·UI 변경 0). 파일 전체 후행 공백 0건 확인.

## 4. 변경 파일

| 파일 | 내용 |
|---|---|
| demo/test/regression/smoke_tutorial.js | 튜토리얼 CSS 슬라이스 끝 경계만 교정 (+3/−1) |
| tools/art/leaders_export.py | `text_lf()` + 매니페스트 비교 1줄 |
| tools/art/test/test_leaders_export.py | CRLF 이식성 테스트 1건 |
| demo/js/lobby.js | 20행 후행 공백 제거 |
| docs/milestone/v0.4.11/issues/238/Mars/integration-ci.md | 본 보고서 (신규) |

game.css·UI·Core·네트워크·서버·SQL·자산·다른 보고서·`.gitattributes` 무수정. Git stage/commit/push 없음.

## 5. 아트 바이트

- `demo/assets` 182파일(png 141 · webp 34 · svg 4 · json 2 · md 1) 중 체크아웃 이후 수정된 파일 0 (`find -newer CLAUDE.md`).
  재생성·삭제·재기준화 없음. `--check` 가 8개 리더 PNG 를 정확 바이트로 대조해 일치.
- SHA-256 원장: 작업 세션 scratchpad `demo-assets.sha256` (182행) — PD 의 ZIP/번들과 대조 가능.

## 6. 잔여 위험·예외 (추론/미확정 구분)

- [추론] CI 러너의 실제 CRLF 바이트는 직접 받지 않았다. 원인은 속성 부재 + autocrlf + "9 일치·roles 만 불일치" 로 추정했고
  테스트가 그 시나리오를 재현·통과한다. 최종 확인은 PR273 잡 D 재실행.
- [권고·미집행] 근본적으로는 `.gitattributes` 에 `/demo/assets/leaders/roles-manifest.json text eol=lf` 를 추가하는 것이 일관적이다
  (Mars 소유 경로 밖 — PD 판단).
- [예외 공개] 진단 중 읽기 전용 Git 명령(`git config`·`ls-files --eol`·`check-attr`·`diff`·`show HEAD:`)을 사용했다.
  Worker Git 읽기 금지 기록과 충돌하므로 사실대로 보고한다 (쓰기 0).
- [실행 횟수] smoke_tutorial 은 출력 필터 실수로 2회, Python 스위트도 2회 실행됐다 (동일 결과). `--check` 1회.

---

# 2026-09-28 추가 — CI A back_nav.js 계약 앵커 복구 (Mars)

- 역할: Mars (CLIENT_TOOLING, IMPLEMENT, mutation=code) · task_a79152a38dc2 / ctx_9c23c558ac2e · claude-opus-5-5 high · Ponytail full · PD live preamble GO 수신 후 착수
- 기준: issue-238-integration HEAD f880b78 (clean) · 입력: PR273 run 36383095778 · job 108802739450 (A만 실패, B/B2/C/D/E PASS)

## 1. 실패와 원인 [확정]

`demo/test/milestone/v0.4.6/issues/122/back_nav.js` 120 pass / 2 fail — G1a-2, G2.

- 두 단언 모두 전투 모달 템플릿의 **`<details>`(전투 이력) 토글을 앵커**로 썼다. #238 CJ 지시(2026-09-28, Venus visual-alignment B04 ① · Mars visual-rebuild "제거한 이력 토글")로 `demo/js/ui.js` 전투 '전투 이력' `<details>`가 제거돼 앵커 문자열이 사라졌다.
- 실제 제품 계약은 그대로다: `demo/js/ui.js` battleModal 에서 `← 뒤로`(`#bmenuBack`)는 여전히 네 하위 패널(`sub("flee",…)`) 바로 아래이며 이제 본문 마지막 요소, 핸들러는 `window.__menu(null)` 시맨틱 호출, `modal(…, [])` buttons 빈 배열(온라인 인덱스 중계 미사용), `network.js` 의 `__menu` 래퍼·`bmenuBack` 예외도 불변. **제품 결함 없음** → 에스컬레이션 대상 아님.

## 2. 변경 (테스트 앵커만 · 단언 삭제·skip·완화 없음)

| 단언 | 옛 앵커 | 새 앵커 | 비호환 이유 |
|---|---|---|---|
| G1a-2 | `…← 뒤로</button>\s+<details>` | `…← 뒤로</button>`` ` `` (템플릿 끝) | #238이 `<details>`를 제거 — 위치 계약(패널 아래)은 "본문 마지막"으로 더 엄격히 고정 |
| G2 | `</details>`,\s*\n\s*\[\]\)` | `← 뒤로</button>`,[^\n]*\n\s*\[\]\)` | 같은 이유 — `[]` 가 전투 모달 본문 끝에 묶인 채 유지 (같은 줄 주석 허용) |

변경 파일: `demo/test/milestone/v0.4.6/issues/122/back_nav.js` (+5/−3, 설명 주석 2줄 포함), 본 보고서 섹션. 제품·UI·레이아웃·시맨틱·다른 테스트·자산·서버 무수정. Git 쓰기 없음(읽기 전용 `git diff/show` 만 사용 — PD 허용).

## 3. 검증 (각 1회)

- `node demo/test/milestone/v0.4.6/issues/122/back_nav.js` → **122 / 0**.
- 음성 대조 — scratchpad 외부 사본(`index.html`+`js`+`css`)의 `ui.js` 만 메모리 변형해 같은 테스트에 경로 인자로 실행, 저장소 파일 무변경:

| 변형 | 결과 |
|---|---|
| 핸들러를 `window.__pick(0)` 인덱스 호출로 | exit 1 · G1a-2 FAIL |
| `← 뒤로`를 도망 패널 **위**로 이동 | exit 1 · G1a-2·G2 FAIL |
| `<details>전투 이력</details>` 재도입 | exit 1 · G1a-2·G2 FAIL |
| buttons `[]` → `[["뒤로",…]]` 인덱스 버튼 | exit 1 · G2 FAIL |

  (이동 변형 첫 시도는 원본 버튼을 남긴 채 복제만 해 exit 0 이었다 — 변형 오류이므로 원본을 제거한 진짜 이동으로 1회 재실행.)

## 4. back_nav 이후 A 단계 정적 점검 [확정/추론]

run 36383095778 은 back_nav 에서 멈춰 이후 6단계(smoke_fx_timing · attack_balance · shock · cross_skill · orientation_audit · ai_completion)가 CI에서 실행되지 않았다. 지시에 따라 재실행 없이 정적 점검만 했다.

- [확정] 제거된 UI(전투 이력 `details`·기록/지표 서랍 `id="log"`/`metrics` DOM·최근 기록·상세·핫시트·빨간 점·전투 제목 메뉴)를 가리키는 단언 없음 (grep).
- [확정] 소스 변형 앵커 17개(shock 6 · cross_skill 11) 전부 현재 `index.html`+`demo/js`+`demo/css` 에 존재.
- [확정] #238 `core.js` 변경은 `bmsg` fx 에 `cast:side` 추가뿐 — fx_timing 은 msgBox 타이밍만 보고 fx 모양(`null` 여부)을 단언하지 않는다.
- [추론] 따라서 같은 종류의 낡은 계약 위험은 발견되지 않았다. 실제 통과 여부는 PD 의 다음 CI A 실행이 최종 확인이다.
