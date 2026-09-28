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
