# Issue #134 — `demo/test`·`tools` 배치 정리 구현 보고 (Mars)

- 역할: Mars · CLIENT_TOOLING · mode=IMPLEMENT · area=TOOLING · mutation=code · provider=Claude Code · instance_index=null
- 브랜치: `infra/134-test-tools-layout` · 원 기준: `c6dd0a8c0d435daea220df0e9c628def0a58c26b`
- 배치(폴더 이동·`.gitattributes`·MOVES.csv)는 **Mercury가 집행**했고, 이 보고는 그 위에서 한 **코드 경로 정합 작업**만 다룬다. 이 판정은 구현자 자기 검증이며 **독립 QA PASS가 아니다 — QA 판정은 Saturn 소관이다.**

## 0. 선행 분석 Task 기록 정정

앞선 분석 Task(`task_92ced247fc08`, mutation=none)에서 **보고 본문을 만들려고 세션 스크래치패드에 `body.txt` 파일을 썼고**, 그럼에도 완료 보고의 `files_modified`를 비워 "파일 쓰기 0"으로 보고했다. 사실과 다른 보고였고 PD가 `role_scope_mismatch`로 거부한 것이 맞다. 저장소 안에는 쓰지 않았지만 그것이 "쓰기 0"을 정당화하지 않는다. 해당 증거 파일은 지우지 않았다. 이번 Task에서는 응답 본문을 파일로 만들지 않고 직접 전송한다.

## 1. 한 일

`c6dd0a8` 기준으로 이동만 된 40개 파일의 **루트·import·기본 경로·산출물 경로·자기 사용법 주석**을 새 위치에 맞췄다. 새 아키텍처를 만들지 않았다 — 호환 래퍼도, 사본도, 리팩터링도 없다.

| 대상 | 개수 | 바꾼 것 |
|---|---|---|
| `demo/test/regression/` | 16 | `require("./harness")` → `"../shared/harness"` · 기본 HTML 2단→3단 · `smoke_cross_skill` git cwd 3단 · `smoke_testclient` `server/test-client.html` 3단 · 헤더 사용법 |
| `demo/test/shared/harness.js` | 1 | 기본 HTML 2단→3단 · 사용법 주석 |
| `demo/test/reports/ai_compare.js` | 1 | harness import · 사용법·재현 명령 문자열 |
| `demo/test/milestone/…` | 15 | harness import 4단 · `ROOT` 6단 · 기본 HTML 5단 · `--out` 기본값은 `ROOT` 파생이라 자동 정합 · 헤더 사용법 |
| `tools/` | 7 | `ROOT`/`repo` 앵커 1단씩 · 도구 경로 join에 목적 폴더 추가 · 음성 대조 픽스처 깊이 · Python 앵커 · 사용법·실행 안내 |
| `.github/workflows/ci.yml` | 1 | 잡 A 16개 · 잡 C 4개 · 잡 D 4개(pip 설치·pip 캐시 키·art check·unittest discover) 경로 + Issue #132 보고 경로 v0.4.6→v0.4.7 |
| 신규 인덱스 | 2 | `demo/test/README.md` · `tools/README.md` |

전체 변경량 **163줄 추가 / 156줄 삭제**. 차이 7줄이 아래 §3의 `smoke_shock` H0 가드 하나뿐이고, 나머지 156줄은 전부 1:1 경로·주석 치환이다.

### 보존한 것 (확인)

- CLI 플래그·API·어서션·종료 코드: 손대지 않았다.
- 고정 기준 ref: `d614392`(smoke_cross_skill) · `dadc8bc`(shock_compare) · `6baa0b5`(smoke_orientation_audit 기본 소스) 그대로.
- CI 잡 이름 5개(`CI` / `A. 규칙 회귀·AI 완주 (헤드리스)` / `B. 서버 (프로토콜·보안·설정)` / `B2. Windows 실행기 회귀` / `C. 문서 링크·이미지 무결성` / `D. 납품 아트 자산 무결성`), 액션 SHA 핀, 러너 OS, Node 24 / Python 3.14.3 / Pillow 12.3.0, 권한·트리거·concurrency 정책: 무변경.
- `smoke_orientation_audit`의 `--path demo/index.html`, art의 `--all --check --no-preview`, media verify의 명시 v0.4.5 매니페스트: 그대로 유지.
- Python 두 파일은 원시 CRLF 유지(각 895·749 CRLF, lone LF 0)이며 `.gitattributes`의 `-text` 속성이 새 경로에 그대로 적용된다(`git check-attr` 확인).

## 2. 배치별 판정 근거

`demo/test`는 셋으로 갈린다 — **CI가 지금도 돌리는 게이트(regression 16)** · **어서션 없는 재사용 리포트 생성기(reports 1)** · **그 이슈에서 한 번 돌려 증빙을 남긴 감사 도구(milestone 15)** · 그리고 공용 로더(shared 1). 버전·Issue 출처는 각 파일의 최초 추가 커밋을 담은 최초 태그로 재확인했고(MOVES.csv의 `from` 경로 기준), 분석 Task의 표와 40행 전부 일치했다. 목록은 [`demo/test/README.md`](../../../../../../demo/test/README.md)와 [`tools/README.md`](../../../../../../tools/README.md)에 있다. 두 인덱스는 40개 파일 전부를 링크하고 출처·성격·파일 쓰기 능력을 함께 적는다.

## 3. `smoke_shock` H절 가드 (검사 강화)

H절은 `readdirSync(__dirname)`로 형제 `smoke_*.js`를 읽어 "`statusProb=1`을 고정하는 스위트는 `shockProb=1`도 고정한다"를 검사한다. 16개를 `regression/`에 **함께** 옮긴 덕에 스캔 대상은 이동 전과 같은 15개다. 다만 이 계약은 **대상이 사라져도 조용히 통과**한다 — 검사할 게 없으면 위반도 0이다.

그래서 파일 **개수를 세는 대신 이름을 지목하는** 가드 둘을 앞에 넣었다. 기존 H1·H2는 문구도 임계값도 그대로다.

- `H0` — `statusProb=1`을 고정하는 5종(`smoke_cycle5` · `smoke_minion_art` · `smoke_attack_balance` · `smoke_turnflow` · `smoke_turnflow_timers`)이 모두 스캔 대상에 있는가
- `H0b` — 지목한 그 파일들이 실제로 아직 `statusProb=1`을 고정하는가 (목록이 현실과 어긋나면 잡는다)

음성 대조: 소유 임시 디렉터리에 트리를 복사해 필수 픽스처 2개를 지우고 돌리면 `pass 66 / fail 1`, **종료 코드 1**. 복사본 원본 상태에서는 `pass 67 / fail 0`. 임시 디렉터리는 삭제했다.

## 4. 실행한 검증 (실측값)

| 검증 | 명령 | 결과 |
|---|---|---|
| CI 잡 A 전체 16종 | ci.yml 표기 그대로 | **16/16 통과 · 실패 0** — cycle5 69 · turnflow 199 · turnflow_timers 36 · memo 122 · own_side 66 · online 157 · online_sync 23 · testclient 41 · minion_art 199 · issue114 16그룹 · tutorial 124 · attack_balance 50 · shock 67 · cross_skill 116 · orientation(`--path`) 8916 · ai_completion 59 |
| 링크 검사기 회귀 | `node tools/docs/test/docs_link_check_test.js` | **34/34 ok · exit 0** |
| 문서 링크·이미지 | `node tools/docs/docs_link_check.js --verbose` | **문제 0건 · exit 0** — 새 인덱스 2개가 stage되기 전 문서 108개·내부 링크 346건, stage된 뒤 재실행에서 문서 110개·내부 링크 398건 |
| 미디어 자기 검사 | `node tools/media/readme_media_capture.js selfcheck` | **OK · exit 0** |
| 미디어 오프라인 검증(CI 인자) | `verify --read-only --no-gh --no-render --manifest <v0.4.5>` | **문제 0건 · artifact 쓰기 0 · exit 0** · WRITE-CHECK 감시 26개 불변 |
| 미디어 READ_ONLY 하네스 | `node tools/media/test/readme_media_readonly_test.js --quick --no-gh` | **17/17 통과 · exit 0** (정적 A·런타임 B·mkdtemp C 음성 대조 포함) |
| 아트 도구 회귀 | `python -m unittest discover -s tools/art/test -v` | **Ran 68 tests · OK · exit 0** |
| 납품 아트 대조 | `python tools/art/minion_art.py --all --check --no-preview` | **write=0 unchanged=29 mismatch=0 missing=0 warn=0 · exit 0** (로컬 Python 3.14.3 · Pillow 12.3.0 = CI 잡 D 핀과 동일) |
| 정적 앵커 전수 검사 | 자체 스크립트 | 40개 파일의 모든 `path.join/resolve(__dirname,…)` 대상이 실존하고, **모든 `ROOT`가 저장소 루트로·모든 기본 `index.html`이 `demo/index.html`로** 해석된다. 상대 `require` 전부 해석됨 |
| 신규 인덱스 링크 | 자체 스크립트 | 내부 링크 52건 전부 대소문자까지 정확히 해석 · 추적 코드 40개 중 **미링크 0** |

브라우저 증빙 15종은 **일부러 전부 돌리지 않았다**(§5). 대신 harness 기반 3종을 실제로 실행해 루트·import·기준 ref·HTML 해석을 끝까지 확인했다: `shock_compare`(기본 40sims, `git show dadc8bc:` 경유), `attack_balance_compare`(`--n 2 --no-symmetry`, **축소 표본 — 경로 해석 확인용이지 밸런스 재측정이 아니다**), `ai_compare`(2경기, 같은 취지).

검증 중 저장소에 새로 생긴 파일은 없다(`git status` 확인). 승인 자산·옛 QA 산출물·`demo/index.html`·서버 코드는 읽기만 했다.

## 5. 한계·미검증 (Saturn 확인 요청)

1. **브라우저 CDP 증빙 13종은 실행하지 않았다.** 기본 `--out`이 이미 승인된 보관소 경로라 무인자 실행은 옛 증빙을 덮어쓴다. 이들은 정적 검토(§4 마지막 행)로 `ROOT`·harness·기본 HTML·`--out` 파생이 옳음을 확인했을 뿐, 실제 Chrome 기동은 확인하지 않았다.
2. **`shock_compare` 기본 표본에서 `3a`가 실패한다**(`pass 10 / fail 1`, 도구는 게이트가 아니라 exit 0). `3a`는 현행 빌드의 `shockProb`을 0.7로 되돌려 `dadc8bc` 빌드와 200판 로그가 **완전히 같기를** 요구한다. `dadc8bc` 이후 #96·v0.4.5(#114) 등으로 제품이 더 바뀌었으니 지금은 성립하지 않는 과거 전제로 보인다. 이번 변경과 무관하다는 근거: 이 파일의 diff는 3줄(import 1·`ROOT` 1·기본 HTML 1)과 헤더 1줄뿐이고, 비교 입력(`dadc8bc` blob·작업 트리 `demo/index.html`)은 이동 전과 바이트가 같다. **다만 이동 전 상태에서 같은 실패가 났는지는 직접 재현하지 않았다** — 확정이 아니라 추론이다.
3. 문서 링크 검사는 `git ls-files` 기준이다. 새 인덱스 2개는 PD가 stage한 뒤 재실행에서 실제로 포함됐고(110개 문서·398건·문제 0건), **이 보고서 자체는 아직 추적 전이라 스캔되지 않았다** — 내부 링크 2건은 별도 스크립트로 해석 확인만 했다. PD가 stage한 뒤 최종 스캔이 필요하다.
4. `.gitattributes`·이동 자체는 Mercury 집행분이라 이 보고의 검증 범위가 아니다. 확인한 것은 이동 뒤 **속성이 새 경로에 유효하고 Python 두 파일의 CRLF가 유지된다**는 점까지다.

## 6. PD 갱신분 확인 · 옛 평문 명령

PD가 현행 명령·링크를 이미 갱신했고, 실제 파일에서 확인했다 — `CONTRIBUTING.md`(재현 명령 5줄), `server/README.md:167`, `docs/creat2ve/HANDOVER_SNAPSHOT.md`(#104 항목), `docs/milestone/MOVES.md`(#134 후속 이동 절). 내가 추가로 요청할 경로 수정은 없다.

옛 마일스톤 본문의 평문 명령(`node demo/test/issue95_cdp.js` 등 36개 문서 168곳)은 **그때의 사실 진술이라 고치지 않는 것이 맞다.** 독자가 현재 위치를 찾을 통로는 `#134 MOVES.csv`와 위 두 인덱스로 열려 있다.

## 7. PD 지적 반영 (인덱스 사실관계 정정)

초안 인덱스에 사실과 다른 서술이 셋 있었고, PD 지적을 받아 실제 소스를 확인한 뒤 고쳤다.

| 초안 | 확인한 사실 | 고친 곳 |
|---|---|---|
| 회귀 16개 모두 파일 쓰기 없음 | `smoke_online.js:655` J절 음성 대조가 `os.tmpdir()/digitduel_stale_mutant_<pid>.html`에 변이 사본을 만들고 그 자리에서 지운다. 나머지 15개는 쓰지 않는다 | `demo/test/README.md` 회귀 절·해당 행 |
| harness를 나머지 32개가 전부 쓴다 | 실제 requirer는 **18개**(회귀 15 · `ai_compare` · `attack_balance_compare` · `shock_compare`). CDP 13종과 `smoke_testclient`는 쓰지 않는다 | `demo/test/README.md` 공용 절 |
| `--read-only` = 쓰기 0 | `--read-only`는 **검증 산출물 0건**이지 프로세스 쓰기 0이 아니다. CDP 도구와 `readme_media_capture capture`는 그 모드에서도 `os.tmpdir()`에 Chrome 임시 프로필을 만들고 자기 것만 정리하며, 온라인 계열은 검증용 릴레이 서버를 띄운다 | 두 인덱스의 파일 쓰기 열·설명 |

그 밖에: v0.4.7은 아직 출시 전 계획 마일스톤이라 두 인덱스에서 `v0.4.7(미출시)`로 구분했고, `tools/art/test/test_minion_art.py` 실행이 `tools/art/test/__pycache__`(`.gitignore` 대상)를 만드는 사실을 적었다. `docs_link_check --json <경로>`가 지정 파일에 JSON을 저장한다는 서술은 소스(`--json` 처리 경로)에서 재확인했고 그대로 뒀다.
