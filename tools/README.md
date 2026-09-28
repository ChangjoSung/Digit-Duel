# 도구 인덱스 — `tools`

공용 도구는 **목적별로 한 폴더**를 쓰고, 그 도구의 회귀 테스트와 의존성은 같은 폴더 안에 둔다. 특정 이슈의 증빙 도구는 `milestone/<버전>/issues/<번호>/`에 보관한다. 현재 도구는 아래 표에서 찾을 수 있다.

| 폴더 | 목적 | CI 잡 |
|---|---|---|
| [`typecheck/`](typecheck) | 클라이언트 상태·액션·이벤트·프로토콜 경계 정적 계약 검사 | A. 규칙 회귀·AI 완주 (헤드리스) |
| [`docs/`](docs) | 추적 중인 `*.md`의 내부 링크·이미지 무결성 | C. 문서 링크·이미지 무결성 |
| [`media/`](media) | README 미디어 캡처와 오프라인 검증 | C. 문서 링크·이미지 무결성 |
| [`art/`](art) | 하수인·왕·동료 아트 파이프라인(결정적 익스포터·검증기) | D. 납품 아트 자산 무결성 |
| [`milestone/v0.4.6/issues/122/`](milestone/v0.4.6/issues/122) | 뒤로가기·어두운 배경 브라우저 증빙 | 로컬 Chrome 검수용 |

버전 열은 출시된 파일의 최초 태그, Issue 열은 도입 작업을 가리킨다. 현재 출시된 최신 태그는 v0.4.5다. **v0.4.7은 아직 출시 전 계획 마일스톤이라 '최초 출시 태그'가 아니며**, 해당 Issue에서 추가됐지만 아직 출시 태그에 포함되지 않은 파일임을 뜻한다. 옛 경로 대조는 [#134 MOVES.csv](../docs/milestone/v0.4.6/issues/134/Mercury/MOVES.csv)에서 본다.

## 정적 계약 검사 (`typecheck/`)

게임 코드는 그대로 **classic script** 다. 번들러도, 프레임워크도, 빌드 산출물도 없고 `demo/index.html` 을 `file://` 로 열면
똑같이 돈다. 이 폴더는 그 코드를 **고치지 않고 읽기만 해서** 네 경계의 어휘가 서로 맞는지 보는 `tsc --noEmit` 설정이다.
유일한 도구 의존성은 루트 [`package.json`](../package.json) 의 `typescript` 하나(정확한 버전 고정)다.

```
npm ci                 # typescript 1개
npm run typecheck      # 양성 — 실제 코드에 계약 위반 0
npm run test:typecheck # 음성 — 일부러 틀린 코드가 실제로 걸리는지 + 설정 무력화 감지
```

| 파일 | 버전 | Issue | 하는 일 | 파일 쓰기 |
|---|---|---|---|---|
| [`tsconfig.json`](typecheck/tsconfig.json) | v0.4.11(미출시) | #245 | `demo/js/*.js` 를 `allowJs`·`checkJs` 로 읽는 양성 검사. `noEmit` 이라 산출물이 없다 | 0건 |
| [`contracts.d.ts`](typecheck/contracts.d.ts) | v0.4.11(미출시) | #245 | 액션·이벤트·프로토콜 계약과 중첩 상태(`BattleState`·`RecruitState`) 선언. **`GameState`·`Piece` 는 여기 없다** — `demo/js/state.js` 의 `newGameState()`·`mkPiece()` 리터럴에서 직접 끌어오므로 표를 두 벌 관리하지 않는다 | 0건 |
| [`env.d.ts`](typecheck/env.d.ts) | v0.4.11(미출시) | #245 | classic script 가 `window.x=…` 로 붙여 맨이름으로 부르는 전역 선언. 포괄 인덱스 시그니처를 쓰지 않는다 — 그러면 오타난 전역까지 통과해 검사가 사라진다 | 0건 |
| [`test/typecheck_test.js`](typecheck/test/typecheck_test.js) | v0.4.11(미출시) | #245 | 검사 자체의 회귀. 네 계약마다 음성 대조군이 실제로 걸리는지, 설정·억제 주석으로 무력화되지 않았는지, 서버 `ACTION_TYPES` 가 전부 클라이언트 계약에 있는지를 본다 | 0건 (서버 파일은 읽기만) |
| [`test/negative/*.js`](typecheck/test/negative) | v0.4.11(미출시) | #245 | 일부러 계약을 어긴 대조군. 양성 검사(`tsconfig.json`)는 이 폴더를 읽지 않는다 — `test/tsconfig.negative.json` 에서만 읽는다 | — |

검사가 **통과한다는 사실만으로는** 계약이 살아 있다는 증거가 못 된다: 전부 `any` 로 만들거나 `checkJs` 를 끄면 똑같이 통과한다.
그래서 CI 는 양성과 음성을 **둘 다** 돌린다.

## 문서 무결성 (`docs/`)

| 파일 | 버전 | Issue | 하는 일 | 파일 쓰기 |
|---|---|---|---|---|
| [`docs_link_check.js`](docs/docs_link_check.js) | v0.4.7(미출시) | #132 | `git ls-files` 기준 `*.md`의 저장소 내부 상대 링크·이미지를 대소문자까지 정확히 검사한다. 외부 URL·앵커·코드 펜스는 대상이 아니다 | `--json <경로>`를 줄 때만 |
| [`docs/test/docs_link_check_test.js`](docs/test/docs_link_check_test.js) | v0.4.7(미출시) | #132 | 위 검사기의 회귀. 음성 대조(깨진 링크·대소문자·저장소 밖 참조)와 종료 코드 전파까지 본다. 픽스처는 전부 `os.tmpdir()`의 소유 임시 git 저장소 | 소유 임시 디렉터리만 |

## README 미디어 (`media/`)

| 파일 | 버전 | Issue | 하는 일 | 파일 쓰기 |
|---|---|---|---|---|
| [`readme_media_capture.js`](media/readme_media_capture.js) | v0.4.4 | #105 | `capture`는 출시 태그의 화면을 헤드리스 Chrome으로 찍고, `verify`는 README의 로컬 이미지·링크·앵커를 검사하며, `selfcheck`는 자기 소스의 fs 변경 호출을 정적 검사한다. 제품 코드는 읽기만 한다 | `capture`·`verify`는 `--out`/`--manifest` 경로에 · `--read-only`면 **검증 산출물 0건**(다만 Chrome이 실제로 렌더하는 경로 — `capture`와 `--no-render` 없는 `verify` 둘 다 — 에서는 그 모드에서도 `os.tmpdir()`에 헤드리스 Chrome 임시 프로필이 생기고 종료 시 자기 것만 지운다) · `selfcheck`는 0건 |
| [`media/test/readme_media_readonly_test.js`](media/test/readme_media_readonly_test.js) | v0.4.4 | #105 | 위 도구의 READ_ONLY 보증을 **도구 바깥에서** 관측한다. 저장소·tmp 스냅샷을 전후 비교하고, 변조 사본으로 정적 검사(A)·런타임 게이트(B)·mkdtemp 접두어(C)가 실제로 위반을 잡는지 음성 대조한다 | `os.tmpdir()/rmc-negtest-*`만, 종료 시 삭제 |

음성 대조 사본은 원본과 **같은 깊이**(`<tmp>/tools/media/`)에 놓는다. 도구가 저장소 루트를 `__dirname` 기준으로 잡으므로, 깊이가 다르면 게이트가 엉뚱한 루트를 감시해 검사가 의미를 잃는다.

## 이슈 전용 브라우저 증빙 (`milestone/`)

이슈 전용 브라우저 도구 [`back_dark_shots.js`](milestone/v0.4.6/issues/122/back_dark_shots.js)는 실제 클릭·계산색 대비·360/390/데스크톱 화면을 확인한다. 기본 산출물은 `docs/milestone/v0.4.6/issues/122/Mars/revise-back-dark/media/`이며 `--out`으로 바꿀 수 있다. `--read-only`도 Chrome 임시 프로필을 만들기 때문에 Saturn의 파일 수정 금지 검수에서는 실행하지 않는다. 기존 도구와 승패·아트 전체 증빙은 보존한다.

## 아트 파이프라인 (`art/`)

| 파일 | 버전 | Issue | 하는 일 | 파일 쓰기 |
|---|---|---|---|---|
| [`minion_art.py`](art/minion_art.py) | v0.4.3 | #87 | Earth가 작성한 픽셀 소스·전투 패치를 읽어 납품 PNG와 매니페스트를 만들고 검증한다. CI는 산출물을 만들지 않는 `--all --check --no-preview`만 돌린다 | `--check`에서는 0건 · 생성 모드에서만 `demo/assets/minions/` |
| [`leaders_export.py`](art/leaders_export.py) | v0.4.7(미출시) | #124 | Earth 왕·동료 원본의 알파를 보존하며 64px·256px PNG와 매니페스트를 만든다. `--check`는 원본에서 계산한 바이트와 납품본을 대조한다 | `--check`·`--list`에서는 0건 · 생성 모드에서만 `demo/assets/leaders/` |
| [`test_leaders_export.py`](art/test/test_leaders_export.py) | v0.4.7(미출시) | #124 | 단순 축소·알파·결정성과 정상/누락/변조 납품의 검사 결과·쓰기 방지·원본 보존을 확인한다 | 소유 임시 픽스처 · Python import 시 `__pycache__` 생성 가능 |
| [`art/test/test_minion_art.py`](art/test/test_minion_art.py) | v0.4.3 | #87 | 위 도구의 회귀. `python -m unittest discover -s tools/art/test -v`로 돈다. 잘못된 입력 검사는 전부 임시 디렉터리에서 하고, 실제 저장소는 읽기 전용(`--check`·git blob)으로만 만진다 | 소유 임시 디렉터리 · 실행 중 `tools/art/__pycache__`와 `tools/art/test/__pycache__` 둘 다 생성(`.gitignore` 대상이라 추적되지 않을 뿐 파일 시스템에는 남는다) |
| [`art/requirements-art.txt`](art/requirements-art.txt) | v0.4.7(미출시) | #132 | 위 두 파일의 실행 의존성. 픽셀에서 PNG를 굽는 도구라 인코더가 바뀌면 바이트 비교가 흔들려 정확한 버전으로 고정한다 | — |

`minion_art.py`와 `test_minion_art.py`는 v0.4.3 아트 QA 보고가 기록한 바이트를 지키려고 [`.gitattributes`](../.gitattributes)에서 `-text`로 묶여 있다(원시 CRLF). 경로를 옮길 때는 그 항목을 같은 커밋에서 함께 옮겨야 한다.
