# [결정] Mars 아트 파이프라인 구현 보고 — v0.4.3 말판 아이콘 · 전투 보정

- 날짜: 2026-09-07 (3차 — **최종 20종 전량 export**. 1차 구현 → 2차 지적 반영·Earth V2 재출력 → 3차 납품)
- required_role: **Mars** / instance: **Mars** / instance_index: **null**
- mode: IMPLEMENT / area: TOOLING / mutation: code / provider: Claude
- taskId: task_00cfcd2e486b / dispatchId: ctx_301477204e9c
  (2차: task_683c2330705f / ctx_a18fc4c214b4 · 1차: task_d43f654098ac / ctx_db0cc293c6fe)
- 근거 문서 (전문 확인): `CLAUDE.md`, `docs/minion-visual-spec-v0.4.3.md`, `art-pipeline.md`,
  `source-qa-saturn.md`, `pilot-qa-saturn.md`·`pilot-v1-qa-saturn.md`·`pilot-v2-qa-saturn.md`(파일럿 QA 3건),
  **`tooling-qa-saturn.md`(Saturn 도구 Technical PASS)**, Earth 보고 6건
  (native 2건 + **`earth-1-full-delivery-report.md`·`earth-2-full-delivery-report.md`** + 초기 2건)
- 상태: **아이콘 20/20 · 전투 보정 4종 8장 · `--all` exit 0 납품 게이트 통과.**
  도구·테스트는 Saturn이 Technical PASS 한 SHA 그대로이며 3차에서 코드를 한 줄도 바꾸지 않았다.
  **20종 ART 판정은 Saturn 소관이며 이 보고는 그것을 주장하지 않는다** (6장).

## 1. 이번 후속에서 해소한 지적 — 전부 코드로 처리

| # | 지적 | 처리 | 근거 |
|---|---|---|---|
| T1 | 실루엣 시트가 `4x`라고 쓰지만 실제로는 32→64 = **2배** | 실제 배율로 라벨 정정: 헤더 `Alpha silhouette 2x (32->64)`, 변수 `mask4`→`mask2x`, 문서 표기 `4×`→`2×`. 시트 재생성 | `tools/minion_art.py` `build_silhouette_sheet` · `art-pipeline.md` 6장 · 시트 SHA 갱신 |
| T2 | 외접상자 중점 15.5±1 를 **시각 중심 AC 통과처럼** 표기 | 상수·주석·오류문구·매니페스트·문서 전부 **대리 지표(proxy)** 로 표기. `ICON_CENTER_X`→`ICON_BBOX_MIDPOINT_X`, 오류문구에 "지각적 시각 중심 판정을 대체하지 않는다" 명시, 매니페스트 `bboxMidX=..(proxy)`. **AC 14.1.11 자체는 손대지 않았고 완화하지도 않았다** — 실제 판정은 Saturn 지각 QA 소관으로 문서에 못박음 | `minion_art.py:64-68, _validate_icon_geometry` · `art-pipeline.md` 3장·5장 |
| T3 | `--ids` 부분집합 실행이 **다른 이미 보정된 허용 종**을 원본 위반으로 오판할 수 있음 | 보존 검사를 "면제"에서 "검증"으로 바꿈. 파일마다 합법 값을 정의하고 실제 바이트를 대조한다 (아래 3.1). 허용 목록이라는 이유로 건너뛰지 않고, 패치+고정 기준으로 **다시 계산해** 대조한다 | `verify_repository_assets` · `expected_patched_battle` · 테스트 4건 |
| T4 | 뒤늦은 누락·불량 데이터가 자산·매니페스트·미리보기를 **부분 갱신**할 수 있음 | 실행을 **계획 → 검증 → 기록** 3단계로 분리. 산출물 바이트를 전부 메모리에 완성하고 보존까지 확인한 뒤에야 기록한다. 실패하면 한 개도 쓰지 않는다. `--ids`의 명시 요청 종 소스 누락은 이제 **실패**(전에는 건너뛰고 성공 주장) | `build_plan`/`run` · 원자성 테스트 3건 |

추가로 T4를 검토하다 발견한 인접 결함 하나를 함께 막았다: 부분집합 실행이 집계 산출물(대조 시트 3장·매니페스트)을
그 부분집합으로 좁혀 **이미 납품된 종의 기록을 조용히 지우는** 문제다. 이제 실패로 처리하고 아무것도 쓰지 않는다
(`_manifest_shrink_problems`, `art-pipeline.md` 5.3).

**Saturn이 겪은 CLI Unicode 테스트 일시 실패는 1차에서 이미 해결됐고 이번에도 통과 상태를 유지한다.** 다만 그 테스트가
Earth 데이터 진행 상황(산출물이 소스보다 오래됨)에 따라 exit 1이 날 수 있어 판정을 데이터 독립 불변식으로 좁혔다 —
UTF-8 디코딩 성공 · `모드=검사`/`[minion_art]`/`루트=` 출력 · 자산 mtime 무변경 · 인자 오류(exit 2) 아님.

## 2. Earth V2 재출력 (요청 즉시 처리)

PD 상태 메시지 2건을 작업 중 수신해 각각 즉시 반영했다 — `Earth V1 완료: 파일럿 재출력 우선`,
`V2 sourcefixed: 즉시 pilot4 재출력 요청`. V1 출력 직후 Saturn이 V1을 재REVISE 했고, V2 소스가 도착해 다시 내보냈다.

```
python tools/minion_art.py --ids fire_sustain,water_swift,grass_atk,lightning_atk
  -> write=5 unchanged=15 mismatch=0 missing=0 preserve=0 warn=0 / exit 0
```

바뀐 것은 `lightning_atk` 아이콘과 그에 따라 다시 만들어진 집계 3장 + 매니페스트뿐이다.
**나머지 3종 아이콘과 전투 8장은 UNCHANGED이므로 Saturn의 기존 PASS가 그대로 유효하고, `lightning_atk` 아이콘만 재검하면 된다.**

| 파일 | SHA256 |
|---|---|
| `docs/art/minions-v0.4.3/pixel-sources/lightning_atk.json` (Earth V2 소스) | `6c8869f1613559f6e4db4ea302daac91353e48f3051319bb35ccf3cf1b73f6cf` |
| `demo/assets/minions/lightning_atk/icon.png` | `63d4b701c7648e12711f496ca52d47847244e3488848636e97198f7b23b23dde` |
| `docs/art/minions-v0.4.3/review/icons-contact-sheet.png` | `d9b3a1f107b051d16a121f0832ceea6645569ce680c9db642356af3d6f7388ac` |
| `docs/art/minions-v0.4.3/review/icons-board-backgrounds.png` | `05a35a8ad857522e903de5fedf4c2fd6572063a5bcbc3e27785c57c34f7ae334` |
| `docs/art/minions-v0.4.3/review/icons-silhouette.png` | `b985e258c7684d38bc4cd933942ae70681419b3ef602cbd76d8d46e832b8b557` |
| `docs/art/minions-v0.4.3/delivery-manifest.csv` | `3fb72acbe9a3e72aad802ff18781412fa31e955fc01b61226b795c300ac8c494` |
| `docs/art/minions-v0.4.3/review/battle-repair-fire_sustain.png` | `61b0523a415721eb652887cb0ef74922c4b37ce8d25bbcc0ef8ef3edb59ff7b2` |
| `docs/art/minions-v0.4.3/review/battle-repair-water_swift.png` | `623a326f586750e01e0bea895bc8f46e63a4bdfb73e83ecfb27a00934e038851` |
| `docs/art/minions-v0.4.3/review/battle-repair-grass_atk.png` | `2900e4ae4b8ffbad3c6e7cb3bd0ed8b4fbac6cdfb3576b5331f1741d552aa684` |
| `docs/art/minions-v0.4.3/review/battle-repair-lightning_atk.png` | `c8d94b580892ce3db2035448b2669747e35ac7947156cf4a9f07176882c28c87` |
| `tools/minion_art.py` | `3f9ecf1ed9b649f982ff6626e18a6be519e51b5fa04dbe25c5a7f93e2bf6ec8c` |
| `tests/test_minion_art.py` | `d0e0564df29ebcf689002f6d093ad85543ebf7afa5e364019d5ed5d16b43cb92` |
| `docs/art/minions-v0.4.3/art-pipeline.md` | `d45c16aec0ef5ec8a05568f066b57c94631e09fd6644e486e686c7111d39156d` |

아이콘 4종 실측 (익스포터와 별개로 PNG를 다시 디코딩해 측정):

| 종 | 크기·모드 | 알파 | 색 | 불투명 px | 외접상자 | 중점(대리) | 접지선 |
|---|---|---|---:|---:|---|---:|---:|
| fire_sustain | 32×32 RGBA | {0,255} | 12 | 306 | (2,2,27,29) | 14.5 | 29 |
| water_swift | 32×32 RGBA | {0,255} | 10 | 348 | (2,2,28,29) | 15.0 | 29 |
| grass_atk | 32×32 RGBA | {0,255} | 11 | 391 | (3,2,28,29) | 15.5 | 29 |
| **lightning_atk (V2)** | 32×32 RGBA | {0,255} | 10 | **392** | **(3,2,29,29)** | **16.0** | 29 |

**중점 열은 기하 대리 지표다. 시각 중심 AC 14.1.11 통과를 뜻하지 않는다** (T2).

## 3. 검증 — 확정

### 3.1 보존: 면제가 아니라 검증 (T3)

파일마다 합법 값을 정해 놓고 실제 바이트를 대조한다.

| 파일 | 합법적인 값 |
|---|---|
| `portrait.png`·`portrait.webp` 40장 | 기준 커밋 바이트 **하나뿐** |
| 전투 파일 — 보정 데이터 없음 | 기준 커밋 바이트 **하나뿐** |
| 전투 파일 — 보정 데이터 있음 | 기준 커밋 원본 **또는** 그 패치를 고정 기준(`202edf3c…`)에 적용한 결과, 둘 중 하나 |

부분집합 실행에서 이번 대상이 아닌 이미 보정된 허용 종이 위반으로 잡히지 않고, 동시에 무검증 통과도 되지 않는다.
파이프라인 밖에서 손댄 파일은 어느 값과도 맞지 않아 잡힌다. 보정 데이터를 읽을 수 없으면 "검증 불가"를 위반으로 보고한다.

실측: 파일럿 전체 실행과 `--check` 모두 `preserve=0`. `--ids fire_sustain` 단독 실행에서도 다른 3종의 보정 결과가
위반으로 잡히지 않음(`preserve` 항목에는 납품 축소 경고만 뜬다).

### 3.2 원자성: 실패하면 한 개도 쓰지 않는다 (T4)

```
1) 계획   요청한 입력 전부 읽기·검증 → 산출물 바이트 메모리 완성
2) 검증   저장소 자산 보존 + 납품 축소 확인 (이번 실행이 덮어쓸 경로 제외)
3) 기록   그제서야 기록. 바이트 동일하면 다시 쓰지 않음
4) 재확인 기록 후 제외 없이 전수 보존 확인
```

실측 CLI 동작:

| 상황 | 결과 |
|---|---|
| `--all` (소스 16종 미도착) | `missing=16`, `NOTE 검증 실패 — 이번 실행은 파일을 하나도 쓰지 않았습니다`, exit 1 |
| `--ids fire_std` (소스 없음) | `missing=1`, 기록 없음, exit 1 — **전에는 건너뛰고 exit 0으로 성공을 주장했다** |
| `--ids fire_sustain` (매니페스트에 3종 더 등록됨) | `preserve=1` 납품 축소 거부, 기록 없음, exit 1 |
| 파일럿 4종 정상 | `write=5 unchanged=15 mismatch=0 missing=0 preserve=0 warn=0`, exit 0 |
| 파일럿 4종 `--check` | `write=0 unchanged=20 mismatch=0 missing=0 preserve=0 warn=0`, exit 0, **어떤 파일도 쓰지 않음** |

### 3.3 테스트 — 68/68 통과

```
python -m unittest discover -s tests
Ran 68 tests in 12.1s ... OK
```

1차의 53개에서 15개 늘었다. 새로 들어온 것:

- **원자성 3건**: 뒤쪽 종 데이터가 규격 위반일 때 앞쪽 종 아이콘·매니페스트·미리보기가 하나도 쓰이지 않음 /
  `--all`의 16종 누락이 준비된 4종을 부분 기록하지 않음 / 보존 위반이 모든 기록을 막음.
  세 건 모두 저장소 **mtime + 바이트 지문 전수 대조**로 "정말 아무것도 안 바뀌었는지"를 확인한다.
- **보존 4건**: 부분집합이 다른 보정 종을 오판하지 않음 / 허용 종이라도 패치와 무관한 내용이면 잡힘 /
  패치 없는 허용 종의 원본 상태가 합법 / 기록된 전투 파일이 재계산 값과 일치.
- **라벨 5건**: 실루엣 시트가 실제 2× / 대조·배경 시트는 실제 4× / 옛 상수명 `ICON_CENTER_X` 부재 /
  오류문구가 대리 지표임을 말함 / 매니페스트가 `(proxy)` 표기.
- **입력 누락 2건**: 명시 요청 종의 소스 누락이 실패 / 허용 종은 패치도 요구.
- **납품 축소 1건**: 부분집합이 매니페스트를 줄이지 못함.

드라이버 테스트는 임시 폴더에 저장소를 **복제(clone)** 해 그 복제본 안에서만 쓰고 지운다.
따라서 실제 고정 기준 커밋과 실제 원본 자산을 상대로 보존·원자성을 검사하면서도 **저장소에는 아무것도 쓰지 않는다.**
데이터 검증 테스트는 임시 디렉터리를 쓴다. 저장소에 픽스처 파일은 하나도 남기지 않는다.

### 3.4 제품 회귀 (제품 코드 미변경)

`demo/index.html`을 변경하지 않았으나 근거로 기존 스모크를 실행했다: `smoke_memo` 49/0, `smoke_cycle5` 69/0 통과.

## 4. 도구가 여전히 하는 검사

경로 안전(로스터 20종 실재 + `^[a-z]+_[a-z]+$`, `../`·`/`·대문자·확장자·후행 공백 거부) · 스키마(행 수·행 길이·캔버스
크기·팔레트 기호 길이·JSON) · 색(미지 기호·중간 알파·비 `.` 기호의 투명색·`.` 재정의·16색 초과) · 기하(2px 여백·접지선
y=29·중점 대리 지표·불투명 0개) · 패치(허용 목록 밖 id·baseline 불일치·좌표 범위·비정수·중복·빈 패치·경계 잘림) ·
보존 · 납품 축소.

스키마는 나쁜 아트를 숨기려고 완화하지 않았다. 데이터가 규격을 못 맞추면 도구가 아니라 데이터를 고친다.

## 5. 최종 20종 전량 export — 3차 (2026-09-07, 이번 작업)

Earth_1·Earth_2의 잔여 16종 원고가 모두 도착해 `--all` 납품 게이트를 실행했다.
**도구·테스트·규격 문서는 한 줄도 바꾸지 않았다.** 실제 export 버그가 나오지 않았으므로 코드 변경 사유가 없었다.

### 5.1 실행한 명령과 실제 결과 [확정]

```text
1) python -B tools/minion_art.py --all
   write=20 unchanged=16 mismatch=0 missing=0 preserve=0 warn=0   exit 0
2) python -B tools/minion_art.py --all            (멱등성 재실행)
   write=0  unchanged=36 mismatch=0 missing=0 preserve=0 warn=0   exit 0
3) python -B tools/minion_art.py --all --check    (덮어쓰기 없는 검증)
   write=0  unchanged=36 mismatch=0 missing=0 preserve=0 warn=0   exit 0
```

1회차의 `write=20`은 신규 아이콘 16 + 집계 시트 3 + 매니페스트 1이다.
파일럿 4종의 아이콘·전투 8장·수리 시트 4장은 모두 `UNCHANGED`로, **Saturn V2 ART PASS가 그대로 유효하다.**
2·3회차의 `write=0 / unchanged=36`은 재실행이 바이트를 흔들지 않음(멱등)과 기록된 산출물이 소스에서
다시 계산한 값과 정확히 같음을 각각 증명한다.

### 5.2 납품 수량 [확정]

| 항목 | 실측 | 기대 |
|---|---:|---:|
| `demo/assets/minions` 자산 파일 (png+webp) | **100** | 100 |
| ├ portrait.png / portrait.webp / battle.png / battle-grid.png | 20 / 20 / 20 / 20 | 원본 80 |
| └ icon.png (이번 파이프라인 생성) | **20** | 20 |
| 기준 커밋과 **바이트 동일**한 원본 | **72** | 72 |
| 승인된 전투 보정으로 바뀐 파일 | **8** (4종 × grid+battle) | 8 |
| `delivery-manifest.csv` 데이터 행 | **28** (icon 20 · battle-grid 4 · battle 4) | 28 |
| 파이프라인 생성 산출물 총계 | **36** (아이콘 20 · 전투 8 · 리뷰 시트 7 · 매니페스트 1) | 36 |

72장 보존은 기준 커밋 `202edf3c23e65453bd7db8dd9fed5fdf0587fd0d`의 blob과 작업 트리 바이트를 전수 대조해 확인했다
(도구 자체 보존 검사 `preserve=0`과 독립된 별도 확인). 바뀐 8장은 승인된 4종의 전투 보정 대상 그것뿐이고,
실행 전후 자산 지문 전수 대조에서 **새로 생긴 것은 신규 아이콘 16장뿐, 그 밖에 바뀐 파일은 하나도 없다.**

### 5.3 아이콘 20종 실측 [확정] — 익스포터와 별개로 PNG를 다시 디코딩해 측정

전 20장이 **32×32 · RGBA · 알파 {0,255}** 이며 로더 경고 0건이다. 아래 값은 그 디코딩 결과다.

| 종 | 색 | 불투명 px | 외접상자(양끝 포함) | 중점(대리) | 접지선 | 바이트 | SHA-256 |
|---|---:|---:|---|---:|---:|---:|---|
| `fire_atk` | 10 | 400 | (3,2,27,29) | 15.0 | 29 | 849 | `7d6d6527153921246a0d69ff30570e86c020603affa4cccc65e58c7ca5bf08e9` |
| `fire_def` | 11 | 451 | (3,4,27,29) | 15.0 | 29 | 751 | `bd780d3cd3d0909447771be86b310215e4a674eb5b21bc04f1cbe0f8d6c7ac56` |
| `fire_std` | 11 | 411 | (4,2,27,29) | 15.5 | 29 | 872 | `1780a298d11b8d09aad4ffaa2ca9db28ff6eebaa82456761d911c630b5921feb` |
| `fire_sustain` | 12 | 306 | (2,2,27,29) | 14.5 | 29 | 935 | `20f1822f532e4d44f651d41c6981b537e96061cfee7ced0c7c55e5c7220199bd` |
| `fire_swift` | 10 | 279 | (6,2,25,29) | 15.5 | 29 | 739 | `c3bfd2ea7ce56a52c9125717cbe501fc38119cabd0cb6d63b4f8cad033f8d91c` |
| `grass_atk` | 11 | 391 | (3,2,28,29) | 15.5 | 29 | 974 | `1a51f5bd39e1f25cc0fdcd90a9316a43c3f892f4610ecc9f79833015bfaa091e` |
| `grass_def` | 11 | 529 | (3,2,29,29) | 16.0 | 29 | 1000 | `674bf6ef3f1facb7e0ab232a2c4000e8cfe93cb06f470171da067687344b0646` |
| `grass_std` | 11 | 401 | (5,2,27,29) | 16.0 | 29 | 872 | `69f8747354cdbbf3b4834313336cf147ff37accb7b02850735a8b00619e5c3e3` |
| `grass_sustain` | 10 | 358 | (4,2,29,29) | 16.5 | 29 | 694 | `10c902466d2c7788e5f8eb8b731571a23b15b9b620336184f968735fd9a470eb` |
| `grass_swift` | 10 | 382 | (3,2,27,29) | 15.0 | 29 | 830 | `2a577f825bf17ade1b6a63db2a805f35cae3f61b12ec72a1294b48d4839c0820` |
| `lightning_atk` | 10 | 392 | (3,2,29,29) | 16.0 | 29 | 911 | `63d4b701c7648e12711f496ca52d47847244e3488848636e97198f7b23b23dde` |
| `lightning_def` | 10 | 461 | (3,2,28,29) | 15.5 | 29 | 928 | `05751cadde005fb4537e4299fa2be3c74feadc1e089199ff5725295b5204f315` |
| `lightning_std` | 10 | 369 | (5,2,26,29) | 15.5 | 29 | 834 | `f6f2447340dcbe2ded2f5e99b6862a172ab0cdb31b3e9b396a37303d99ff63e8` |
| `lightning_sustain` | 10 | 361 | (4,2,26,29) | 15.0 | 29 | 789 | `c844f69522aeda26c15b5c08ebfcf868c293558f2092ea3dfd26ca9253b8d0f0` |
| `lightning_swift` | 10 | 396 | (3,2,29,29) | 16.0 | 29 | 814 | `054e3d53817c9c2f6fcce61cd223bbc4ed3dda75b7d82c4cac4c6137fc57ae7a` |
| `water_atk` | 11 | 415 | (3,2,27,29) | 15.0 | 29 | 792 | `3fe7b7693704f826fbd84523d6cdad7f40acc715e718e122e10140526befc5b7` |
| `water_def` | 11 | 411 | (3,2,27,29) | 15.0 | 29 | 782 | `cd682b263a7165cefb1ac0bfc4fdcb85604d62fb6715abde26665a06f2157de8` |
| `water_std` | 11 | 345 | (6,2,25,29) | 15.5 | 29 | 723 | `7e95ab2cbd796ad1b7648ec221f1504dbf1408bed07e59a03a92319064555020` |
| `water_sustain` | 10 | 417 | (5,2,28,29) | 16.5 | 29 | 808 | `99ee754eb25e64df43f92b1be5f6889e4a9847de0afa7ced2db1c33a3671f236` |
| `water_swift` | 10 | 348 | (2,2,28,29) | 15.0 | 29 | 760 | `c2436b71fc00ba37d367de3e861c71f77e25bc4a6b8e3510be7507a7af8477e8` |

전 20종이 접지선 y=29(AC 14.1.11)와 2px 여백(AC 14.1.3)을 충족하고, 외접상자 중점 대리 지표가 15.5±1.0 안에 있다.
색 수는 10~12색으로 권장 8~12 범위에 가깝고 하드 상한 16색을 넘는 종이 없다.
**중점 열은 기하 대리 지표이고 시각 중심 AC 14.1.11 통과를 뜻하지 않는다** (T2 · `art-pipeline.md` 3장).
20종 실측값은 Earth_1·Earth_2 보고의 원고 수치(불투명 셀 수·bbox)와 일치했다 — 원고가 그대로 픽셀이 됐다는 뜻이다.

### 5.4 전투 4종 — 64 그리드와 정확한 2배 [확정]

`battle-grid.png`는 64×64 RGBA, `battle.png`는 128×128 RGBA다.

| 종 | battle-grid.png | battle.png | 최근접 2배 검사 |
|---|---|---|---|
| `fire_sustain` | 2963B / `3b3af4bfe76bc774447043e29c1b5434…` | 3386B / `55676a3fc3c71cc4913d34a118833674…` | 전픽셀 일치 |
| `water_swift` | 3129B / `abcba704371d0cc7b9060c0f57f15f5c…` | 3731B / `2ba2ba89ef30889cd27643011f1f7501…` | 전픽셀 일치 |
| `grass_atk` | 3127B / `6868e7693b8575ffc50e71347bf9474c…` | 3694B / `e664c3fd7e75cd59ff1b8411c61d29c4…` | 전픽셀 일치 |
| `lightning_atk` | 2488B / `4d46db21c58a7b0292037805cd7af76f…` | 4101B / `a60551cfd8f2a0db6fdab3b9983c2bde…` | 전픽셀 일치 |

`battle.png`의 전 16,384 픽셀을 `battle-grid.png`의 대응 픽셀과 1:1 비교해 **정확한 최근접 2배**임을 확인했다 (AC 14.1.5).

### 5.5 리뷰 시트·매니페스트 [확정]

| 경로 (`docs/art/minions-v0.4.3/` 기준) | 크기 | 바이트 | SHA-256 |
|---|---|---:|---|
| `review/icons-contact-sheet.png` | 880×694 RGBA | 60003B | `980875b81e4267bee048f59e17b9db9955d81419d56ecf1788e30e813b37e14d` |
| `review/icons-board-backgrounds.png` | 700×2840 RGBA | 112604B | `1f7fdc3c852f1be9b83e399390739f547cf240029f8e330f75ce37a788a79ebe` |
| `review/icons-silhouette.png` | 750×742 RGBA | 22107B | `cb58f622ed66728ecadb0c12120b62b134db661e3106d8b638da0db04a953005` |
| `review/battle-repair-fire_sustain.png` | 700×200 RGBA | 26235B | `61b0523a415721eb652887cb0ef74922c4b37ce8d25bbcc0ef8ef3edb59ff7b2` |
| `review/battle-repair-water_swift.png` | 700×200 RGBA | 27932B | `623a326f586750e01e0bea895bc8f46e63a4bdfb73e83ecfb27a00934e038851` |
| `review/battle-repair-grass_atk.png` | 700×200 RGBA | 31972B | `2900e4ae4b8ffbad3c6e7cb3bd0ed8b4fbac6cdfb3576b5331f1741d552aa684` |
| `review/battle-repair-lightning_atk.png` | 700×200 RGBA | 27068B | `c8d94b580892ce3db2035448b2669747e35ac7947156cf4a9f07176882c28c87` |
| `delivery-manifest.csv` |  | 4912B | `e978075b30645461103cfacf0ae8e8bb75b4c9ee860743a659a74e2c182a3fbf` |

매니페스트 28행 전부에 대해 기록된 `bytes`·`sha256`을 실제 파일에서 다시 계산해 대조했고 불일치 0건,
경로 오름차순 정렬도 확인했다. 매니페스트는 자산(아이콘·전투)만 담고 리뷰 시트는 담지 않는다 — 기존 계약 그대로다.

### 5.6 도구·테스트 무변경 [확정]

| 파일 | SHA-256 | `tooling-qa-saturn.md` 기준값 |
|---|---|---|
| `tools/minion_art.py` | `3f9ecf1ed9b649f982ff6626e18a6be519e51b5fa04dbe25c5a7f93e2bf6ec8c` | 동일 |
| `tests/test_minion_art.py` | `d0e0564df29ebcf689002f6d093ad85543ebf7afa5e364019d5ed5d16b43cb92` | 동일 |

Saturn Technical PASS의 시작·종료 해시와 정확히 같다. 3차에서 실제 export 버그가 발생하지 않았으므로
코드·테스트를 수정할 사유가 없었고, 따라서 **Saturn이 통과시킨 바로 그 도구가 이 산출물을 만들었다.**
기존 68개 테스트는 2차에서 68/68 통과했고 코드가 그대로이므로 재실행하지 않았다 — 이 판단은 3차에서 검증한
사실이 아니라 **코드 무변경에 근거한 승계**임을 밝힌다.

Earth 소유 데이터(`pixel-sources/` 20개 · `battle-patches/` 4개)는 읽기만 했고 실행 전후 해시가 동일하다.
Earth 두 보고서에 적힌 20개 원고 SHA-256과 작업 트리 파일 해시가 전부 일치함을 export 전에 확인했다.

## 6. 한계 — 3차에서 검증하지 않은 것 (통과로 반올림하지 않음)

- **20종 ART 판정(AC 14.1.6·7·8·10·11)은 하지 않았다.** 32px 사람 식별성, 세 배경 대비, 20종 실루엣 구별,
  지각적 시각 중심, portrait·battle·icon 삼자 동일 캐릭터 인식은 전부 Saturn 독립 QA와 CJ 소관이다.
  이 보고의 모든 수치는 **기계적 규격 충족**이며 어떤 항목도 Saturn ART PASS로 대신 선언하지 않는다.
- **신규 16종은 Saturn 재검 전이다.** 파일럿 4종만 `pilot-v2-qa-saturn.md`의 V2 ART PASS를 승계한다.
- **68개 테스트를 3차에서 재실행하지 않았다** (5.6). 도구·테스트 SHA 무변경에 근거한 승계다.
- 제품 표시·`demo/index.html` 자산 연결·HP 표시·DPR·브라우저 확대율(AC 14.2.8)·게임플레이/AI 회귀는
  범위 밖이며 수행하지 않았다.
- 권리 체인·상용 캐릭터 유사성 포괄 검증(AC 14.1.8)은 범위 밖이다.
- PNG 바이트 동일성은 같은 Pillow 12.3.0 · Python 3.14.3 · zlib 환경 기준이다. 환경이 바뀌면 `--check`가
  `MISMATCH`를 낼 수 있고, 그때는 재생성 후 매니페스트를 갱신한다.

## 7. 준수 사항 (3차)

도구·테스트·`art-pipeline.md`·규격 문서 미변경. Earth 소유 원고(`pixel-sources/`·`battle-patches/`)와
Earth·Saturn 보고서 미수정 — 아트를 직접 저작하지 않았다. 보정 대상 4종 밖의 16종 전투 파일과 portrait 40장
미변경(72장 바이트 대조로 증명). 제품 코드(`demo/index.html`·서버·게임플레이) 미변경.
git 쓰기·GitHub·Notion 쓰기 없음 — `git status`·`cat-file`(기준 커밋 blob) 읽기만 사용했다. 하위 위임 없음.
사용자 소유 `art/`·`orca-hook-latency-report.md`·Downloads 원본 미접근·미변경.

**동시 작업 관찰 (Mars 작성분 아님):** 이번 작업 중 `demo/assets/minions/README.md`가 13:40:31에 바뀐 것을 확인했다.
도구는 이 파일을 쓰지 않으며(1회차 `WRITE` 목록 20건에 없음) Mars도 편집하지 않았으므로 아래 files_modified에 포함하지 않는다.
작성 주체는 이 보고에서 단정하지 않고 Mercury 취합 대상으로 남긴다.

## 8. files_modified (Mars, 3차 — 정확히 21개)

이번 실행이 실제로 바꾼 파일은 아래 21개뿐이다 (신규 아이콘 16 · 집계 시트 3 · 매니페스트 1 · 이 보고서 1).
파일럿 4종의 아이콘·전투 8장·수리 시트 4장은 `UNCHANGED`이므로 목록에 없다.

```
demo/assets/minions/fire_std/icon.png
demo/assets/minions/fire_atk/icon.png
demo/assets/minions/fire_def/icon.png
demo/assets/minions/fire_swift/icon.png
demo/assets/minions/water_std/icon.png
demo/assets/minions/water_atk/icon.png
demo/assets/minions/water_def/icon.png
demo/assets/minions/water_sustain/icon.png
demo/assets/minions/grass_std/icon.png
demo/assets/minions/grass_def/icon.png
demo/assets/minions/grass_swift/icon.png
demo/assets/minions/grass_sustain/icon.png
demo/assets/minions/lightning_std/icon.png
demo/assets/minions/lightning_def/icon.png
demo/assets/minions/lightning_swift/icon.png
demo/assets/minions/lightning_sustain/icon.png
docs/art/minions-v0.4.3/review/icons-contact-sheet.png
docs/art/minions-v0.4.3/review/icons-board-backgrounds.png
docs/art/minions-v0.4.3/review/icons-silhouette.png
docs/art/minions-v0.4.3/delivery-manifest.csv
docs/art/minions-v0.4.3/mars-pipeline-report.md
```

1·2차에서 만들고 3차에서 바이트가 바뀌지 않은 산출물: 파일럿 4종의 `icon.png`·`battle-grid.png`·`battle.png`,
`review/battle-repair-*.png` 4장, `tools/minion_art.py`, `tests/test_minion_art.py`, `art-pipeline.md`, `.gitignore`.

## 9. 다음 단계

1. **Saturn이 20종 ART 독립 QA**를 수행한다. 재현 명령: `python tools/minion_art.py --all --check` → exit 0 · `write=0 unchanged=36` 기대.
   근거 시트: `review/icons-contact-sheet.png`(1×/4×) · `review/icons-board-backgrounds.png`(세 배경 1×/4×) ·
   `review/icons-silhouette.png`(알파 실루엣 2×) · `review/battle-repair-<id>.png` 4장.
2. REVISE가 나오면 **데이터를 고친다** — 해당 종 id와 지적을 Earth에 돌려보내고, 도구·AC는 완화하지 않는다.
3. CJ 최종 디자인 승인.
4. 제품 코드 연결(`demo/index.html` 자산 로딩)은 별도 CJ OK 이후 착수한다. 현재 미승인·미착수다.
5. Issue #87 통합 PR·GitHub·Notion 기록은 Mercury 소관이다.
