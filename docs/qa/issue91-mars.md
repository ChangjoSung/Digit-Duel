# Issue #91 — 공용/적 포획 하수인 대리 출전 아트 연결 (Mars 구현 납품 보고)

- 역할: **Mars** (instance=Mars · instance_index=null · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- Task `task_8a6aaf784bad` · dispatch `ctx_8aacb5344e21` · 브랜치 `fix/91-reserve-minion-art` · 기준 dev `eff5c16` (+ PD 문서 커밋 `0551dee`, 제품 코드 무변경)
- 근거 문서: `CLAUDE.md`(HTML 데모 절, 2026-09-07 v0.4.4 착수 문구) · `docs/v0.4.4-gameplay-spec.md` 1장(#91 계약·AC 1~7) · `docs/minion-visual-spec-v0.4.3.md` rev8 6.3·7.10 · PD dispatch 계약
- 작성: 2026-09-07
- **이 문서가 주장하는 범위**: 기계로 잰 사실과 저장한 화면 증빙까지다. **Saturn 독립 QA와 CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다.** 아래 통과 수치는 Mars 자기 검증이고 Saturn 판정이 아니다.

---

## 1. 무엇을 바꿨나 (`demo/index.html` 4곳, +20/−6줄)

| # | 위치 | 변경 | 확정/추론 |
|---|---|---|---|
| 1 | `tryCapture` (숲 공용 포획) | cap 객체에 **표시 전용 외형 정체** `artRosterId` = 그 속성의 표준형 종 id(`M-F1`/`M-W1`/`M-G1`/`M-L1`)를 생성 시 기록. 속성 무작위·`archSkills("std",el)`·100/100·20/30/CD2 는 그대로. `rand` 추가 소비 없음 | [확정] K1 |
| 2 | `finishByCapture` (전투 중 적 포획) | `S.reserve[p]` 에 `artRosterId` = 대상의 원래 `rosterId`. 대상에 로스터 정체가 없으면 `null`(임의 종으로 가장하지 않음). HP 70/최대 100·공용 스탯·`archSkills(arch,el)` 템플릿은 그대로 | [확정] K2 |
| 3 | 신규 helper `artDirOfFighter(pf,piece)` (`artOk` 앞) | 본체(`pf===piece`)는 `artDirOf` 그대로. 대리 출전은 **`pf===piece.cap` 이고 `artRosterId` 가 ROSTER 20종에 있고 그 종의 속성이 cap 의 표시 속성과 같을 때만** `element_arch` 폴더. 그 밖은 null → 현행 이모지 토큰 | [확정] G9·K5 |
| 4 | `battleModal.token` | `pf===piece?artDirOf(piece):null` → `artDirOfFighter(pf,piece)`. alt·라벨·onerror(`artSpriteFail`)·id·클래스 계약은 그대로 | [확정] K3·K4 |

바꾸지 않은 것: 왕·동료 본체 토큰(👑·🤝) · 하수인 본체 토큰 · 정보 패널(`panel()` — 아키타입 배지는 대리 출전에 계속 미표시, 규격 6.3 "정보 패널은 건드리지 않는다") · `fighterName`("포획 하수인·불") · 예비/포획 배지·출전 선택·출전 공개 모달 문구 · 포획 판정·비용·각 1개 제한 · AI · 네트워크 프로토콜 · 아트 100파일(I3 SHA 28 일치·I4 구조 그대로).

### 필드명 결정 — dispatch 문구와 v0.4.4 규격의 조정
PD dispatch 는 "표준형 종 **rosterId/arch** 를 보존"이라 썼고, PD 가 채택한 `docs/v0.4.4-gameplay-spec.md` 1장은 "전투 규칙(`archOf`→`skillParamsOf`, `finishByCapture`)이 `rosterId` 를 읽으므로 포획 객체에 `rosterId` 를 직접 넣지 않고 **표시 전용 메타데이터**(필드명은 Mars 선택)로 보존한다"고 했다. 두 문장을 "종 정체를 보존하되 규칙이 읽는 필드는 쓰지 말라"로 읽고 **`artRosterId` 하나만** 저장했다. `arch` 는 `ROSTER.find(artRosterId).arch` 로 파생되므로 따로 저장하지 않았다(규격 AC 6 "포획 객체의 `rosterId`·스탯·기술·RNG 소비가 변경 전과 동일" — cap 의 `rosterId` 는 변경 전처럼 `undefined` 다. K1a·K2a 가 고정). 이 해석이 PD 의 의도와 다르면 이름만 바꾸면 되는 변경이다(3곳 + 테스트).

### 도달성 사실 [확정] — 규격의 우려는 오늘 코드에서는 실효하지 않지만 그대로 따랐다
cap 은 항상 `skills`(4슬롯)를 가지므로 `__actCore` 는 `execSlot` 경로만 탄다. `archOf` 소비자인 `skillParamsOf`·`tryStatus` 는 `kind==="skill"&&!f.skills` 인 레거시 경로(로스터 미배정 하수인) 전용이라 cap 에 도달하지 않는다. 그래도 규격대로 별도 필드를 썼고, K7 이 `archOf(cap)===null` 과 "정체 유무에 따른 전투 로그 완전 일치"를 고정한다.

---

## 2. 계약 대조

| 계약 (dispatch · 규격 AC) | 구현 | 근거 |
|---|---|---|
| 중립 cap = 랜덤 속성의 표준형 종 정체 보존 | `artRosterId` = `<el>_std` 종 id · 4속성 전부 | K1a (시드 16개로 4속성 도달) |
| 적 포획 reserve = 원래 종 보존 | `artRosterId` = `loseP.rosterId` · 20종 전부 → 20폴더 · `battle.png` 실존 | K2a·K2b |
| 공용 스탯 100/20/30/CD2 · 중립 HP100 · 적 70 · 기술 템플릿 · RNG 순서 · 포획 룰 보존 | 필드 추가만. `rand` 소비 = 판정 1 + shuffle 3 (변경 전과 같음) · 위험 포획 성공/실패·볼 소모 그대로 | K1a·K1b·K1c·K2a·K4g·K7b |
| `pf===piece` 제한을 고쳐 실제 대리 전투원의 유효 식별자에 맞는 기존 `battle.png` | `artDirOfFighter` · PVE 대리(A) · 핫시트 양측 대리(A·D) | K3c·K4d · CDP 1·2 장면 |
| 왕/동료 본체·하수인 본체 그대로 | 본체 선택 시 👑·🤝 · `<img>` 없음 · 보유 cap/예비의 종 폴더가 전투 화면에 없음 | G6·G7·K4i~K4l |
| path 화이트리스트 · 잘못된/누락 id 안전 폴백 | 미등록·빈 문자열·경로 조작·마크업·0·null·undefined·객체·속성 불일치 → 이모지 토큰, `minions/` 문자열 0 | K5b ×10 · K5c 복귀 |
| 원래 종을 모르는 cap 을 임의 새 종으로 가장하지 않음 | 로스터 미배정 하수인 포획 → `artRosterId:null` → 이모지 | K2c |
| 이미지 실패 안전 폴백 · 전투 진행 | `artSpriteFail` 이 대리 전투원의 속성 기호·라벨·속성색으로 같은 노드 대체 · 이후 `__act` 진행 | K6b~K6d · CDP 3 장면(요청 차단) |
| 정보 경계: 보드·비공개 reserve/cap 화면에 숨은 정체 노출 금지 · 전투 공개 시점만 | 보드·사이드·출전 선택·출전 공개 모달에 종 폴더 0 · 전투 스테이지(출전 공개 후)에만 · 상대 왕의 미공개 cap 과 양측 예비 종은 전투 중에도 없음 | K9a~K9f |
| 표시 종 아트로 스탯 바꾸지 않음 | M-L5(95/20/28) 정체가 붙어도 70/100·20·30·CD2 · 패널 HP 70/100 | K4g·K4h · CDP fd=70/100 |
| 온라인 양측 cap 정체 일치 · 공정 관측 | 두 독립 인스턴스(NET.me 0/1) 같은 시드 → 같은 정체 · 송신 0 · AI 평가값 정체 무관 · AI 함수 11개 소스에 `artRosterId`/아트 helper 참조 0 | K8a~K8c · K10a·K10b |
| 신규 아트 0 · 아트 100파일 무변경 | 자산 미접촉 · 매니페스트 SHA 28 일치 | I3·I4 |
| 콘솔 오류 없음 (규격 AC 4) | 3장면 × 3조합 = 9 측정 JS 예외·console.error 0. QA 서버 `favicon.ico` 404 로그 1건은 #91 무관 기존 현상이라 `ignoredConsole` 로 기록 | CDP 보고서 |
| 예비→cap 이전 후 정체 유지 (규격 AC 5) | `useRes` 로 옮겨진 같은 객체가 그대로 싸움 | K4c·K4d2 |
| G9 문자열 단언 → 행동 기반 | G9a~G9e 로 치환 | 3절 |

---

## 3. 검증 — 명령 · 개수 · 결과 (Mars 자기 검증)

### 3.1 헤드리스 회귀 (Node v24.16.0, 저장소 루트에서)
```
node demo/test/smoke_cycle5.js
node demo/test/smoke_memo.js
node demo/test/smoke_online.js
node demo/test/smoke_minion_art.js
node demo/test/smoke_tutorial.js
node demo/test/smoke_testclient.js
```
| 스위트 | 기준(571 체계) | 이번 | 변화 |
|---|---|---|---|
| cycle5 | 69/69 | **69/69** | 0 |
| memo | 49/49 | **49/49** | 0 |
| online | 157/157 | **157/157** | 0 |
| minion_art | 131/131 | **197/197** | +66 (G9 1건 → G9a~e 5건 · K 절 62건 신설) |
| tutorial | 124/124 | **124/124** | 0 |
| testclient | 41/41 | **41/41** | 0 |
| **합계** | **571** | **637 / 637 PASS** | +66 |

`ai_compare.js`(파일 출력 도구)는 실행하지 않았다 — 규칙·AI 무변경이라 기준선 갱신 대상이 아니다.

### 3.2 신설 단언 (`smoke_minion_art.js` K 절 + G9 치환)
| 절 | 내용 | 개수 |
|---|---|---|
| G9a~e | 왕·동료 본체는 정체가 붙어도 null · 하수인 본체 #89 그대로 · 대리 출전은 cap 정체만 · 본체 종과 무관 · 다른 말의 cap/떠도는 객체 null | 5 |
| K1 | 중립 포획 4속성 정체·공용 스탯·std 템플릿 · rand 소비 불변 · 위험 포획 판정·볼 소모 불변 | 3 |
| K2 | 적 포획 20종 정체·70/100·템플릿·즉시 제거 · 20폴더 실존 · 로스터 미배정 → null | 3 |
| K3 | PVE 왕 대리(fire_std) 토큰 src·alt·클래스·onerror · 상대 본체 그대로 · 전투 진행 | 8 |
| K4 | 핫시트 양측 대리(water_std vs lightning_sustain) · reserve 소모·객체 동일 · 수치 공용 규격 · 본체 선택 시 👑·🤝·종 미노출 | 13 |
| K5 | 오염 id 10종 → 이모지·경로 0·id 유지 · 복귀 · 오염 상태 전투 진행 | 14 |
| K6 | 대리 토큰 이미지 실패 → 같은 노드 즉시 대체 · 재렌더 유지 · 전투 진행 | 5 |
| K7 | 정체 유무 A/B 같은 시드 → 로그·HP 완전 일치 · `archOf(cap)===null` · 지속형 정체 예비의 화상 = `BAL.burnRounds`(2R, 3R 아님) | 3 |
| K8 | 두 인스턴스(NET.me 0/1) 정체 일치 · 송신 0 · 적 포획 양측 M-G2 | 3 |
| K9 | 정보 경계 6단계(보드·사이드·출전 선택·출전 공개·스테이지·전투 중 보드) | 7 |
| K10 | AI 평가값 정체 무관 · AI 소스 참조 0 | 2 |

### 3.3 음성 대조 — 새 단언이 실제로 회귀를 잡는가
```
node demo/test/smoke_minion_art.js <기준선 eff5c16 의 index.html 사본>      → 172 / 25 FAIL
node demo/test/smoke_minion_art.js <정체 기록·token 만 되돌린 변형 사본>     → 177 / 20 FAIL
```
두 사본은 세션 임시 폴더에만 만들었고 저장소에 남기지 않았다. 기준선 대조를 위해 `harness.js` 의 `artDirOfFighter` 노출과 테스트의 호출을 관대하게(없으면 `"missing"`) 만들어 크래시 대신 실패로 집계되게 했다.

### 3.4 실제 브라우저 실측 + 스크린샷 (`demo/test/issue91_cdp.js`, 신규)
```
node demo/test/issue91_cdp.js                 # file:// + HTTP(QA 서버 PORT=0) · 스크린샷 9장 · docs/qa/issue91/issue91_cdp_report.json
node demo/test/issue91_cdp.js --read-only     # Saturn 용 — 산출물 0, stdout 만 (디렉터리 목록 해시 전후 동일 확인)
```
| 장면 | 구성 | 측정 결과 (file·http desktop-1280 / http mobile-390) |
|---|---|---|
| 1-neutral-proxy | PVE · 내 왕이 중립 포획(불, `M-F1`) 대리 vs 상대 `가시 덩굴`(M-G2) 본체 | tok-A art `fire_std/battle.png` 128 로드 · alt "포획 하수인·불" · 대리 100/100·공 20 · tok-D `grass_atk` · cap `rosterId=undefined` |
| 2-both-proxy | 핫시트 · 1P 왕(중립 물 `M-W1`) vs 2P 동료(전투 중 적 포획 예비 = 1P 하수인 원래 종 `M-F1`) | tok-A `water_std` · tok-D `fire_std` 70/100·공 20 · 양측 `proxy=true` |
| 3-proxy-fallback | 1 과 같은 판 + `*/fire_std/battle.png` 요청 차단(캐시 끔) | tok-A emoji "🔥불" 88×88 · tok-D art 유지 · `__act` 후 HP 100→54 / 90→59 · 로그 1→6 · art 미복원 |
| 합계 | **9 측정 · 문제 0건 · 콘솔 오류 0** (`favicon.ico` 404 1건 ignored 기록) | `--read-only` 도 9 측정 · 0 문제 · 파일 쓰기 0 |

기존 도구 회귀: `node demo/test/minion_art_cdp.js --read-only` → **82 측정 · 문제 0건** (file·http). 배틀 측정은 하수인 본체 vs 본체라 #91 영향 없음이 확인된다.

### 3.5 스크린샷 (`docs/qa/issue91/`, 9장 + 보고서 JSON)
| 파일 | 내용 |
|---|---|
| `file_desktop-1280_1-neutral-proxy.png` · `http_desktop-1280_1-neutral-proxy.png` · `http_mobile-390_1-neutral-proxy.png` | 중립 포획 대리 출전 (불 표준형 도트 vs 상대 하수인) |
| `file_desktop-1280_2-both-proxy.png` · `http_desktop-1280_2-both-proxy.png` · `http_mobile-390_2-both-proxy.png` | 양측 대리 출전 (물 표준형 vs 적 포획 불 표준형 70/100) |
| `file_desktop-1280_3-proxy-fallback.png` · `http_desktop-1280_3-proxy-fallback.png` · `http_mobile-390_3-proxy-fallback.png` | 이미지 차단 시 대리 토큰 이모지 대체 · 피해 플로트 · 전투 진행 |
| `issue91_cdp_report.json` | 측정 원본 |
file 과 http 의 desktop 1·2 장면은 픽셀 동일(같은 SHA)이다 — 시드 고정 렌더가 스킴에 무관함을 뜻한다. 사람 검수(식별성·어색함)는 이 숫자로 대체하지 않는다.

---

## 4. SHA-256 (작업 트리 바이트 기준, 2026-09-07)
| 파일 | SHA-256 | 비고 |
|---|---|---|
| `demo/index.html` | `90224fe64b89e2b9919ad9266d022cee38ee4159d92cec82b93c17e867c4cf2c` | 수정 (CRLF, 속성 `eol=crlf` 와 일치) |
| `demo/test/smoke_minion_art.js` | `c660bc919c02aa6047f38c6a9ebe165ce7a2dbb575a79d4c1e2de1f6e59a72b4` | 수정 (작업 트리 CRLF = HEAD 사본과 동일. `.gitattributes` 는 `eol=lf` 라 커밋 시 git 이 LF 로 정규화한다는 경고가 뜬다 — 커밋 후 해시는 달라질 수 있음) |
| `demo/test/harness.js` | `c04df34ccb04a36fbc34598b046d523292e85b9005ea4ddccabf0f750919e765` | 수정 (노출 목록에 `artDirOfFighter`(관대)·`archSkills` 2토큰) |
| `demo/test/issue91_cdp.js` | `f80afa907dbb39ffcaec410466fd1dbd5b438b00d0584e042acb23a6e6c7cb4b` | 신규 (219줄, CRLF · `.gitattributes` 에 항목 없음 — `minion_art_cdp.js` 처럼 `eol=lf` 를 두려면 PD 판단) |
| `docs/qa/issue91/file_desktop-1280_1-neutral-proxy.png` | `674d20fafe5c57e597baf99246a8f08d7ee95700df87934d6cbdb4818f7dbe11` | |
| `docs/qa/issue91/file_desktop-1280_2-both-proxy.png` | `61be862cce650c9f543f8f07e9c1db3f88ac7980a9aba9f585d3fc6db132a0f2` | |
| `docs/qa/issue91/file_desktop-1280_3-proxy-fallback.png` | `4b485717b36a708b28b895f4bac3fc8648eed03ab1a2859198d2f95b99bcd0ab` | |
| `docs/qa/issue91/http_desktop-1280_1-neutral-proxy.png` | `674d20fafe5c57e597baf99246a8f08d7ee95700df87934d6cbdb4818f7dbe11` | file 과 동일 |
| `docs/qa/issue91/http_desktop-1280_2-both-proxy.png` | `61be862cce650c9f543f8f07e9c1db3f88ac7980a9aba9f585d3fc6db132a0f2` | file 과 동일 |
| `docs/qa/issue91/http_desktop-1280_3-proxy-fallback.png` | `b78df9405ec0d43a96d52f1548be28a1ada11e8e0a4a62b6cc426694abd42e59` | 피해 플로트 애니메이션 타이밍으로 file 과 다름 |
| `docs/qa/issue91/http_mobile-390_1-neutral-proxy.png` | `9abc9bf9455af1b099cde9e75b7e89c8e2b431b4eca10614c9bca774d4304bd9` | |
| `docs/qa/issue91/http_mobile-390_2-both-proxy.png` | `60441524ce50ec0ebaf094f90fa5d1e0149aa5516f3b3cacf5ecdaf795fb2167` | |
| `docs/qa/issue91/http_mobile-390_3-proxy-fallback.png` | `dfd747d87c9e2ff9bf94309f4770483b3ab436d2ee7f7ed8e8fbd9aad9cee324` | |
| `docs/qa/issue91/issue91_cdp_report.json` | `f9afad3aa82ef1bcacf701cd2bb9c29e134220a34068a87bba6480300c44f5f9` | |
| `docs/qa/v044-technical-analysis-mars.md` | worker_done 본문에 기재 | 신규 (6건 분석 재검증본) |

아트 100파일·`docs/art/minions-v0.4.3/delivery-manifest.csv` 는 미접촉(I3·I4 통과).

---

## 5. 한계 · 미확인 · [기획 필요]

- **미확인(도구 한계)**: 온라인 PVP 실접속 2클라이언트 대리 출전은 실행하지 않았다. 헤드리스에서 두 독립 인스턴스의 시드 결정론(K8)과 "cap 생성이 `rand` 만 소비·송신 0"으로 대신했다. 규격 1장 "추가 동기화 없음"과 일치하지만 실접속은 Saturn/CJ 확인 대상이다.
- **미확인**: PVE 에서 AI 가 스스로 숲 포획 후 대리 출전하는 실플레이 흐름은 시뮬로 재현하지 않았다. `aiCapture` 는 `tryCapture` 를 그대로 부르므로 같은 경로다(코드 사실).
- **사람 검수 필요**: 스크린샷 9장의 식별성·어색함(예: 표준형 도트가 "포획 하수인·불" 라벨과 함께 보이는 인상)은 기계 판정 밖이다.
- **[기획 필요] 라벨**: 대리 출전 토큰 alt·패널 이름은 "포획 하수인·불"을 유지했다(규격 1장 "라벨 유지"). 종 이름("새끼 화룡")을 병기할지는 결정 사항.
- **[기획 필요] 정보 패널 배지**: `panel()` 의 아키타입 배지는 대리 출전에 계속 미표시(규격 6.3 "정보 패널은 건드리지 않는다"). 적 포획 예비의 아키타입은 전투 공개 정보라 배지를 켤 수 있으나 이번 범위 밖으로 두었다.
- **[기획 필요] 아키타입 파라미터 승계**: 적 포획 예비는 기술 템플릿만 승계하고 `skillParamsOf`(지속형 화상 3R 등)는 공용 규격이다(현행 유지 · K7c 고정). GDD-13 4.8 "아키타입 승계"와의 해석 차이는 v0.4.4 규격 2장 8항(#92 에서 `skills` 실제 복사)에서 다뤄지며 #91 에는 넣지 않았다.
- **작업 트리 공존**: 작업 중 같은 워크트리에서 PD 가 `README.md`·`HANDOVER_SNAPSHOT.md`·`minion-visual-spec` rev8·`v0.4.4-gameplay-spec.md`·`CLAUDE.md` 를 편집·커밋(`0551dee`)했다. 내 산출물이 아니며 손대지 않았다. `art/`·`orca-hook-latency-report.md`·Downloads 미접촉.
- **줄 끝**: `smoke_minion_art.js` 는 `.gitattributes` `eol=lf` 인데 HEAD 사본이 CRLF 라 작업 트리도 CRLF 로 맞췄다. 커밋 시 LF 정규화 경고가 난다(PD Git 소관).

## 6. 문서 반영 위치 (Venus/PD 소관 · 제안)
| 문서 | 내용 |
|---|---|
| `docs/v0.4.4-gameplay-spec.md` 1장 | 표시 전용 필드명 **`artRosterId`** 확정 표기 · "arch 는 파생" 한 줄 |
| `docs/minion-visual-spec-v0.4.3.md` rev8 6.3·7.10 | 포획 하수인 행: "현행 이모지" → "cap 의 `artRosterId` 종 `battle.png` · 없으면 이모지" (PD 커밋 `0551dee` 에 이미 반영됐다면 필드명만 확인) |
| GDD-13 4.8 · 9장 | 외형 정체(중립=속성 표준형, 적=원래 종) 한 줄 · Decision Log |

## 7. 이번 세션이 쓴 파일 (전부 작업 공간 상대 경로)
- 수정: `demo/index.html` · `demo/test/smoke_minion_art.js` · `demo/test/harness.js`
- 신규: `demo/test/issue91_cdp.js` · `docs/qa/issue91/` (PNG 9 + `issue91_cdp_report.json`) · `docs/qa/issue91-mars.md`(이 문서) · `docs/qa/v044-technical-analysis-mars.md`
- Git 쓰기·GitHub·Notion 쓰기 없음. 임시 사본·패치 스크립트는 세션 스크래치 폴더에만 두었다.
