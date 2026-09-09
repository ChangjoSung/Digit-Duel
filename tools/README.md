# 도구 인덱스 — `tools`

도구는 **목적별로 한 폴더**를 쓰고, 그 도구의 회귀 테스트와 의존성은 같은 폴더 안에 둔다. 7개 파일 전부가 아래 표에 있다.

| 폴더 | 목적 | CI 잡 |
|---|---|---|
| [`docs/`](docs) | 추적 중인 `*.md`의 내부 링크·이미지 무결성 | C. 문서 링크·이미지 무결성 |
| [`media/`](media) | README 미디어 캡처와 오프라인 검증 | C. 문서 링크·이미지 무결성 |
| [`art/`](art) | 하수인 아트 파이프라인(결정적 익스포터·검증기) | D. 납품 아트 자산 무결성 |

버전·Issue 열은 그 파일이 처음 들어온 커밋이 담긴 최초 태그다. 현재 출시된 최신 태그는 v0.4.5다. **v0.4.7은 아직 출시 전 계획 마일스톤이라 '최초 출시 태그'가 아니고**, 그 표기는 #132에서 들어왔고 아직 어떤 태그에도 담기지 않았다는 뜻이다. 옛 경로 대조는 [#134 MOVES.csv](../docs/milestone/v0.4.7/issues/134/Mercury/MOVES.csv)에서 본다.

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

## 아트 파이프라인 (`art/`)

| 파일 | 버전 | Issue | 하는 일 | 파일 쓰기 |
|---|---|---|---|---|
| [`minion_art.py`](art/minion_art.py) | v0.4.3 | #87 | Earth가 작성한 픽셀 소스·전투 패치를 읽어 납품 PNG와 매니페스트를 만들고 검증한다. CI는 산출물을 만들지 않는 `--all --check --no-preview`만 돌린다 | `--check`에서는 0건 · 생성 모드에서만 `demo/assets/minions/` |
| [`art/test/test_minion_art.py`](art/test/test_minion_art.py) | v0.4.3 | #87 | 위 도구의 회귀. `python -m unittest discover -s tools/art/test -v`로 돈다. 잘못된 입력 검사는 전부 임시 디렉터리에서 하고, 실제 저장소는 읽기 전용(`--check`·git blob)으로만 만진다 | 소유 임시 디렉터리 · 실행 중 `tools/art/__pycache__`와 `tools/art/test/__pycache__` 둘 다 생성(`.gitignore` 대상이라 추적되지 않을 뿐 파일 시스템에는 남는다) |
| [`art/requirements-art.txt`](art/requirements-art.txt) | v0.4.7(미출시) | #132 | 위 두 파일의 실행 의존성. 픽셀에서 PNG를 굽는 도구라 인코더가 바뀌면 바이트 비교가 흔들려 정확한 버전으로 고정한다 | — |

`minion_art.py`와 `test_minion_art.py`는 v0.4.3 아트 QA 보고가 기록한 바이트를 지키려고 [`.gitattributes`](../.gitattributes)에서 `-text`로 묶여 있다(원시 CRLF). 경로를 옮길 때는 그 항목을 같은 커밋에서 함께 옮겨야 한다.
