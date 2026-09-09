# Issue #134 — `demo/test`·`tools` 배치 정리 구현 보고 (Mars)

- 역할: Mars · CLIENT_TOOLING · mode=IMPLEMENT · area=TOOLING · mutation=code · provider=Claude Code · instance_index=null
- 브랜치: `infra/134-test-tools-layout` · 이동 전 기준 `c6dd0a8` · 이동·문서 커밋 `5b151f7` · 통합 HEAD `7b3b0be`(origin/dev `4e7adf7` = Roblox PR #135 병합 포함)
- 배치(폴더 이동·`.gitattributes`·MOVES.csv·문서 갱신·Git 집행)는 **Mercury 소관**이다. 이 보고는 그 위에서 한 **코드 경로 정합 작업**과 그 검증만 다룬다.
- 이 판정은 구현자 자기 검증이며 **독립 QA PASS가 아니다 — QA 판정은 Saturn 소관이다.**
- Roblox(#118·PR #135)의 코드·자산·문서·`.gitignore`는 **읽기만 했고 이번 변경에 포함되지 않는다.**

## 0. 선행 분석 Task 기록 정정

앞선 분석 Task(`task_92ced247fc08`, mutation=none)에서 보고 본문을 만들려고 세션 스크래치패드에 `body.txt`를 **실제로 썼고**, 그럼에도 완료 보고의 `files_modified`를 비워 "파일 쓰기 0"으로 보고했다. 사실과 다른 보고였고 `role_scope_mismatch` 거부가 옳다. 저장소 밖이라는 점은 면책이 아니다. 해당 증거 파일은 지우지도 고치지도 않았다.

## 1. 한 일

이동만 된 40개 파일의 **루트·import·기본 HTML·산출물 경로와 자기 사용법 주석**을 새 위치에 맞추고, `.github/workflows/ci.yml`의 경로를 따라 고쳤다. 새 아키텍처를 만들지 않았다 — 호환 래퍼도, 사본도, 리팩터링도 없다.

| 대상 | 개수 | 바꾼 것 |
|---|---|---|
| `demo/test/regression/` | 16 | `require("./harness")` → `"../shared/harness"` · 기본 HTML 2단→3단 · `smoke_cross_skill` git cwd 3단 · `smoke_testclient`의 `server/test-client.html` 3단 · 헤더 사용법 |
| `demo/test/shared/harness.js` | 1 | 기본 HTML 2단→3단 · 사용법 주석 |
| `demo/test/reports/ai_compare.js` | 1 | harness import · 사용법·재현 명령 문자열 |
| `demo/test/milestone/…` | 15 | harness import 4단 · `ROOT` 6단 · 기본 HTML 5단 · `--out` 기본값은 `ROOT` 파생이라 자동 정합 · 헤더 사용법 |
| `tools/` | 7 | `ROOT`/`repo` 앵커 1단씩 · 도구 경로 join에 목적 폴더 추가 · 음성 대조 픽스처 깊이 · Python 앵커 · 사용법·실행 안내 |
| `.github/workflows/ci.yml` | 1 | 잡 A 16개 · 잡 C 4개 · 잡 D 4개(pip 설치·pip 캐시 키·art check·unittest discover) 경로 + Issue #132 보고 경로 v0.4.6→v0.4.7 |
| 신규 인덱스 | 2 | `demo/test/README.md` · `tools/README.md` |

### 변경량 — 무엇을 센 수치인가

**코드 경로 편집 범위만**의 수치다. MOVES.csv 40행 + `ci.yml` = **41개 파일**에 대해 `c6dd0a8:<옛 경로>`와 `HEAD:<새 경로>`를 파일별로 대조하면 **+165 / −158 · 순증 7줄**이다. 그 순증 7줄은 전부 `smoke_shock.js`의 H0/H0b 블록이고(그 파일만 +10/−3), 나머지 40개는 파일별 순증 0 — 즉 전부 1:1 경로·주석 치환이다.

이 수치에는 **신규 인덱스 2개와 이 보고서가 들어 있지 않다.** 그리고 `git diff -M c6dd0a8 HEAD -- demo/test tools .github/workflows/ci.yml`로 재면 +906/−150이 나오는데, 이는 대량 이동에서 rename 탐지가 일부 파일을 짝짓지 못해 통째 추가로 세는 측정 방식 차이다. 위 파일별 blob 대조가 실제 편집량이다.

### 보존 확인

- CLI 플래그·API·어서션·종료 코드: 손대지 않았다.
- 고정 기준 ref: `d614392`(smoke_cross_skill) · `dadc8bc`(shock_compare) · `6baa0b5`(smoke_orientation_audit 기본 소스) 그대로.
- CI 잡 이름(`CI` / `A. 규칙 회귀·AI 완주 (헤드리스)` / `B. 서버 (프로토콜·보안·설정)` / `B2. Windows 실행기 회귀` / `C. 문서 링크·이미지 무결성` / `D. 납품 아트 자산 무결성`), 액션 SHA 핀, 러너 OS, Node 24 / Python 3.14.3 / Pillow 12.3.0, 권한·트리거·concurrency: 무변경.
- `smoke_orientation_audit`의 `--path demo/index.html`, art의 `--all --check --no-preview`, media verify의 명시 v0.4.5 매니페스트: 그대로 유지.
- Python 두 파일은 원시 CRLF 유지(각 895·749 CRLF, lone LF 0)이며 `.gitattributes`의 `-text` 속성이 새 경로에 그대로 적용된다(`git check-attr` 확인).

## 2. `smoke_shock` H절 — 기존 어서션 유지 + H0/H0b 추가

H절은 `readdirSync(__dirname)`로 형제 `smoke_*.js`를 읽어 "`statusProb=1`을 고정하는 스위트는 `shockProb=1`도 고정한다"를 검사한다. 16개를 `regression/`에 **함께** 옮긴 덕에 스캔 대상은 이동 전과 같은 15개다.

| 어서션 | 상태 | 내용 |
|---|---|---|
| `H1` | **기존 그대로** — 문구·판정식 무변경 | `statusProb=1` 고정 행마다 `shockProb=1` 동반 |
| `H2` | **기존 그대로** — 문구·임계값(`n>=2`) 무변경 | `shockProb=1` 고정이 2곳 이상 존재 |
| `H0` | **이번에 추가** | `statusProb=1`을 고정하는 5종(`smoke_cycle5`·`smoke_minion_art`·`smoke_attack_balance`·`smoke_turnflow`·`smoke_turnflow_timers`)이 스캔 대상에 있는가 |
| `H0b` | **이번에 추가** | 그 5종이 실제로 아직 `statusProb=1`을 고정하는가(목록이 현실과 어긋나면 잡는다) |

기존 검사를 약화하거나 대체하지 않는다. H0/H0b는 **파일 개수를 세지 않고 이름을 지목한다** — 대상이 사라지면 H1은 검사할 게 없어 조용히 통과하는데, 그 구멍만 막는다. 음성 대조: 소유 임시 폴더에 트리를 복사해 필수 픽스처 2개를 지우면 `pass 66 / fail 1`, 종료 코드 1. 원본 복사 상태는 `pass 67 / fail 0`.

## 3. `shock_compare` 3a 실패 — 이동 전 원본으로 직접 재현 (확정)

앞선 보고에서 "기존 실패로 보이나 이동 전 재현은 하지 않았다 — 추론"이라고 적었다. 이번에 재현해 **확정**으로 바꾼다.

### 방법

`c6dd0a8`의 원본 `demo/test/shock_compare.js`와 `demo/test/harness.js` blob을 **메모리에서 컴파일**해, 그때와 같은 `__dirname`(`<repo>/demo/test`)·같은 `ROOT`(`<repo>`)·같은 기본 인자(`--base dadc8bc`, `--sims 40`)로 돌렸다. `require("./harness")`만 그 두 파일에 한해 해석기를 우회시켰다. **디스크에 사본을 만들지 않았고 Git 쓰기도 없다.** 입력 HTML은 양쪽 모두 동일한 현재 작업 트리 `demo/index.html`이다.

실행한 blob:

| 실행 | shock_compare | harness |
|---|---|---|
| BEFORE (`c6dd0a8` 원본) | `c254f28c07e1a6583a67210bb1abbf18bdd3c74e` | `a76354e290311a2c7c2fc922d217f097369492ff` |
| AFTER (`HEAD` 이동 후) | `446a8d4bdbd3363f795306d6418c33b7fd429022` | `936b8fc09ee4b75c7ca85502e55776f771c75135` |

### 결과

**stdout 14줄과 stderr가 양쪽 바이트 동일하고, 종료 코드도 양쪽 1로 같다.**

```
=== shock_compare: pass 10 / fail 1 === (before git dadc8bc · after 현행)
실패: 3a shockProb=0.7 → 번개 표준형 vs 불 방어형 완주 200판 로그·HP 완전 일치 (1/200, 감전 발생 판 196)
```

| 항목 | BEFORE (c6dd0a8 원본) | AFTER (이동 후 HEAD) |
|---|---|---|
| 결과 | `pass 10 / fail 1` | `pass 10 / fail 1` |
| 실패 어서션 | `3a` (1/200, 감전 발생 판 196) | `3a` (1/200, 감전 발생 판 196) |
| 종료 코드 | **1** | **1** |
| stdout·stderr | — | **BEFORE와 바이트 동일** |

### 판정

**기존 실패다. 경로 회귀가 아니다.** 서로 다른 blob(위 표)을 같은 입력·같은 고정 ref·같은 루트로 돌려 출력이 바이트 단위로 같으므로, 이번 경로 편집은 이 결과에 아무 영향을 주지 않았다.

원인은 제품 드리프트로 보인다 — `3a`는 현행 빌드의 `shockProb`을 0.7로 되돌려 `dadc8bc` 빌드와 200판 로그·HP가 **완전히 같기를** 요구하는데, `dadc8bc` 이후 #96 외에도 v0.4.4 후반·v0.4.5(#114) 변경이 전투 로그를 바꿨다. 같은 실행의 `3b`(기본값에서는 일부 판만 갈라진다)는 통과한다. **이 원인 귀속은 추론이고, 확정된 것은 "이동 전후가 동일하다"는 사실까지다.** 이 도구는 CI 게이트가 아니라 과거 시점 비교 리포트라 이번 범위에서 고치지 않았다 — 어떻게 처리할지는 CJ·PD 판단이다.

### 여기서 드러난 앞 보고의 오류 — `exit 0`이 아니라 `exit 1`

앞 보고에 "`shock_compare`는 게이트가 아니라 exit 0"이라고 적었는데 **틀렸다**. 소스 마지막 줄이 `if(fail){ console.log(...); process.exit(1); }`이고, 실제 종료 코드는 **1**이다. 앞 측정에서 `node … | tail -2; echo rc=$?`로 파이프 뒤의 `$?`를 읽어 `tail`의 종료 코드를 본 것이 원인이다. 정정한다: **`shock_compare`에는 어서션이 있고, 실패하면 종료 코드 1로 끝난다.** 다만 CI 어느 잡에서도 호출되지 않으므로 파이프라인을 붉게 만들지는 않는다.

## 4. 실행한 검증 (실측값)

| 검증 | 명령 | 결과 |
|---|---|---|
| CI 잡 A 전체 16종 | `ci.yml` 표기 그대로 | **16/16 통과 · 실패 0** — cycle5 69 · turnflow 199 · turnflow_timers 36 · memo 122 · own_side 66 · online 157 · online_sync 23 · testclient 41 · minion_art 199 · issue114 16그룹 · tutorial 124 · attack_balance 50 · shock 67 · cross_skill 116 · orientation(`--path`) 8916 · ai_completion 59 |
| 링크 검사기 회귀 | `node tools/docs/test/docs_link_check_test.js` | **34/34 ok · exit 0** |
| **문서 링크·이미지 (통합 HEAD 최종)** | `node tools/docs/docs_link_check.js --verbose` | **문제 0건 · exit 0** — 이번 정정 직후 검수 시점 기준 문서 119개 · 내부 링크 431건(정정 전 428건). Roblox PR #135 문서와 추적된 이 보고서가 모두 포함된 상태이며, PD 보고서가 병행 갱신되므로 링크 수치는 검수 시점에 따라 달라진다 |
| 미디어 자기 검사 | `node tools/media/readme_media_capture.js selfcheck` | **OK · exit 0** |
| 미디어 오프라인 검증(CI 인자) | `verify --read-only --no-gh --no-render --manifest <v0.4.5>` | **문제 0건 · 검증 산출물 0 · exit 0** · WRITE-CHECK 감시 26개 불변 |
| 미디어 READ_ONLY 하네스 | `readme_media_readonly_test.js --quick --no-gh` | **17/17 통과 · exit 0** (정적 A·런타임 B·mkdtemp C·게이트 범위 D 음성 대조 포함) |
| 아트 도구 회귀 | `python -m unittest discover -s tools/art/test -v` | **Ran 68 tests · OK · exit 0** |
| 납품 아트 대조 | `python tools/art/minion_art.py --all --check --no-preview` | **write=0 unchanged=29 mismatch=0 missing=0 warn=0 · exit 0** (로컬 Python 3.14.3 · Pillow 12.3.0 = CI 잡 D 핀과 동일) |
| **정적 앵커 전수 (통합 HEAD 최종)** | 자체 스크립트 | `demo/test`·`tools`의 JS 37개에서 `ROOT` 앵커 18곳이 **모두 저장소 루트로**, 기본 `index.html` 20곳이 **모두 `demo/index.html`로** 해석되고, 상대 `require` 19건 전부 해석됨 |
| **`ci.yml` 경로 실존 (통합 HEAD 최종)** | 자체 스크립트 | 워크플로가 부르는 모든 `demo/test`·`tools` 경로와 `-s tools/art/test` 실존 · 누락 0 |
| 신규 인덱스 링크 | 자체 스크립트 | 내부 링크 전부 대소문자까지 정확히 해석 · 추적 코드 40개 중 미링크 0 |

이번 후속 Task에서는 **이미 통과한 전수 테스트를 다시 돌리지 않았다.** 위 표의 굵은 3행과 §3 재현만 통합 HEAD에서 새로 수행했고, 나머지 행은 직전 구현 Task(`5b151f7` 시점)의 실측값이다.

## 5. 실행 부수효과 (전체)

"검증 중 새 파일 없음"이라는 앞 보고의 표현은 **정확하지 않아 철회한다.** `git status`에 안 잡힌다는 뜻이었을 뿐이다. 실제 부수효과는 다음과 같다.

- **`__pycache__`** — `python -m unittest discover -s tools/art/test`를 돌리면 `tools/art/__pycache__/`와 `tools/art/test/__pycache__/`가 **둘 다 생긴다**(임포트되는 `minion_art`와 테스트 모듈 각각). `.gitignore:109`의 `__pycache__/`에 걸려 추적되지 않을 뿐 파일 시스템에는 남는다. 이동 전에는 `tests/__pycache__`에 생겼다.
- **헤드리스 Chrome 임시 프로필** — `os.tmpdir()`의 실행 전용 프로필. 종료 시 자기가 만든 경로만 정리한다.
- **검증 전용 릴레이 서버** — 온라인 계열이 `PORT=0`·루프백으로 자식 프로세스를 띄우고 종료 시 정리한다.
- **`smoke_online.js`의 tmp 변이 사본** — J절 음성 대조가 `os.tmpdir()/digitduel_stale_mutant_<pid>.html`을 만들고 그 자리에서 지운다.
- **`readme_media_readonly_test.js`의 tmp 사본** — `os.tmpdir()/rmc-negtest-*`, 종료 시 삭제.
- **§3 재현** — 메모리 컴파일이라 파일을 만들지 않았다. 러너 스크립트만 저장소 밖 임시 경로에 두었다.

승인 자산·옛 QA 산출물·`demo/index.html`·서버 코드·Roblox 산출물은 **읽기만** 했다. Git·GitHub·Notion 쓰기 없음.

## 6. 한계·미검증 (Saturn 확인 요청)

1. **CDP 증빙 13종은 실행하지 않았다.** 기본 `--out`이 이미 승인된 보관소 경로라 무인자 실행이 옛 증빙을 덮어쓴다. 정적으로 `ROOT`·harness·기본 HTML·`--out` 파생이 옳음을 확인했을 뿐, 실제 Chrome 기동은 확인하지 않았다. 비교기 2종(`attack_balance_compare`·`shock_compare`)은 실제로 돌렸다.
2. **`shock_compare` 3a는 기존 실패로 확정**(§3)이나, 그 **원인을 제품 드리프트로 보는 것은 추론**이다. 어느 커밋에서 처음 깨졌는지는 이번 범위에서 추적하지 않았다.
3. `.gitattributes`·이동·병합·문서 갱신은 Mercury 집행분이라 내 검증 범위 밖이다. 확인한 것은 이동 뒤 **속성이 새 경로에 유효하고 Python 두 파일의 CRLF가 유지된다**는 점까지다.
4. 이 보고의 CI 잡 A·도구 회귀 수치는 `5b151f7` 시점 로컬 실측이다. 통합 HEAD(`7b3b0be`)에서 로컬 재실행은 하지 않았고, Roblox 병합이 `demo/test`·`tools`를 건드리지 않는다는 점만 확인했다. **PD 보고에 따르면 PR #136(head `7b3b0be`)의 실제 CI 5개 잡이 모두 SUCCESS이고 Saturn 독립 코드 검토의 필수 수정은 0건이다** — 이는 내 실측이 아니라 PD·Saturn 전달 사실이다.
5. `docs/milestone/v0.4.6`의 빈 디렉터리는 PD 도구가 정책상 삭제를 거부했고, **어떤 방식으로도 대신 삭제하지 않았다.**

## 7. 사실 정정 이력

인덱스·보고서에서 사실과 다른 서술이 나왔고, 지적을 받아 소스를 확인한 뒤 고쳤다. 무엇이 틀렸는지 남긴다.

| 초안 서술 | 확인한 사실 | 근거 |
|---|---|---|
| 회귀 16개 모두 파일 쓰기 없음 | `smoke_online.js:655` J절이 `os.tmpdir()`에 변이 사본을 만들고 지운다. 나머지 15개는 쓰지 않는다 | 소스 |
| harness를 나머지 32개가 전부 쓴다 | 실제 requirer는 **18개**(회귀 15 · `ai_compare` · `attack_balance_compare` · `shock_compare`). CDP 13종과 `smoke_testclient`는 쓰지 않는다 | `require` 전수 |
| `--read-only` = 쓰기 0 | **검증 산출물 0건**이라는 뜻이다. Chrome이 렌더하는 경로에서는 `verify`도 `capture`도 `os.tmpdir()`에 임시 프로필을 만든다(`cmdVerify` → `launchChrome()`). `--no-render`를 주면 그 경로를 타지 않는다 | 소스 |
| 검증 중 새 파일 없음 | `__pycache__`가 `tools/art/`와 `tools/art/test/`에 생긴다(§5) | 파일 시스템 |
| `shock_compare`는 exit 0 | **exit 1**이다. 파이프 뒤 `$?`를 읽은 측정 오류(§3) | 소스 + 실측 |
| 과거 증빙 15개(뭉뚱그림) | **13 CDP 브라우저 도구 + 2 비교 리포트 생성기**로 나뉜다 | 소스 |
| v0.4.7 표기 | v0.4.7은 **아직 출시 전 계획 마일스톤**이라 "최초 출시 태그"가 아니다. 출시된 최신 태그는 v0.4.5 | 태그 |
| 163/156 변경량 | **+165/−158 · 순증 7**이며 **코드 41개 파일의 경로 편집 범위만** 센 값이다(§1) | 파일별 blob 대조 |

`docs_link_check --json <경로>`가 지정 파일에 JSON을 저장한다는 서술은 소스에서 재확인해 그대로 뒀다.

## 8. PD 갱신분 확인

`CONTRIBUTING.md`(재현 명령 5줄) · `server/README.md:167` · `docs/creat2ve/HANDOVER_SNAPSHOT.md`(#104 항목) · `docs/milestone/MOVES.md`(#134 후속 이동 절)이 40개 매핑 기준으로 갱신된 것을 실제 파일에서 확인했다. 내가 추가로 요청할 경로 수정은 없다.

옛 마일스톤 본문의 평문 명령(`node demo/test/issue95_cdp.js` 등)은 **그때의 사실 진술이라 고치지 않는 것이 맞다.** 현재 위치를 찾을 통로는 [#134 MOVES.csv](../Mercury/MOVES.csv)와 [`demo/test/README.md`](../../../../../../demo/test/README.md) · [`tools/README.md`](../../../../../../tools/README.md)로 열려 있다.
