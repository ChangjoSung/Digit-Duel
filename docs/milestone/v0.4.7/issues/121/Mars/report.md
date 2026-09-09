# Issue #121 · #125 · #129 — 통합 구현 보고 (Mars)

- 역할: Mars · CLIENT_TOOLING · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code · instance_index=null
- 브랜치: `feature/121-exploration-packages` · 착수 기준 `57c7cc3`
- **최종 제품 ref `157026ba617166644ada0686b897d3ae2a166486` · `demo/index.html` blob `4535791bbefd86ad829cdd436d4957f8a530846b`** — 이 보고서의 모든 수치·캡처는 이 바이트에서 나왔다.
- 중간 checkpoint 이력: `668ea573`(blob `f0acbe11`) → `17531ef7`(blob `529ffa2e`) → **`157026ba`(blob `4535791b`, 최종)**. 앞의 둘은 최종 증빙으로 쓰지 않는다.
- 계약 원본: [v0.4.7 게임플레이 계약](../Venus/gameplay-spec.md) (Venus 초안 → PD 채택 → CJ 승인 2026-09-09) · [v0.4.7 인덱스](../../../README.md)
- 이 판정은 **구현자 자기 검증이다.** Saturn 독립 QA 가 제품 REVISE **6건** + 내 검사 사각지대 **3건** + 제품 문구 **1건**을 냈고 그 전부를 수정했으나, **최종본(`4535791b`)에 대한 독립 QA PASS 는 아직 없다.** 최종 품질 게이트는 CJ 플레이 QA다.
- Git 쓰기(커밋·푸시·PR·Issue 코멘트)는 하지 않았다 — Mercury 소관. 저장소 루트의 `art/`·`orca-hook-latency-report.md`·`roblox/`·승인 아트 원본은 읽지도 열지도 않았다.
- 이 작업 트리에 내가 만들지 않은 변경이 함께 있다: `README.md` · `CLAUDE.md` · `docs/milestone/v0.4.7/README.md` · `docs/releases/README.md` · `docs/releases/v0.4.7.md` · `issues/121/Venus/gameplay-spec.md` — **Venus·PD 소관이고 읽기만 했다.**

---

## 0. 구현 계약 체크리스트

| 계약 | 항목 | 상태 | 근거 |
|---|---|---|---|
| 1.1 | 숲 2구역에 itemGift·battleBuff·recruit **각 1개**, 전체 6개 · 위치만 무작위 · 난수 소비 결정적 | ✅ | A2~A6 (120시드 전수 · 소비 26회 고정) |
| 1.2 | 하수인·동료·왕만 탐색 | ✅ (불변) | A9 |
| 1.3 | 옛 6종 보상 생성 폐기 — CD 전체 초기화·+15% 버프는 대체 없이 사라짐 | ✅ | A7 (음성) · cycle5 D4 |
| 2.1 | 시작 1/1/1 · 볼 2 · 보유 상한 전부 해제 | ✅ | B1~B6 |
| 2.2 | 개봉 4종 중 1 · 확정 때만 소모 · 취소 무소모 · 카운터 미소모 | ✅ | B7~B14 |
| 2.3 | 아이템 **라운드 1회만** · 전투 2회·연속 동일 제거 | ✅ | B15~B17b (실제 거부·실제 라운드 진행) |
| 3.1 | 버프 플레이어별 **한 전투 1개** · 아이템과 별도 · 무료 · 전투 종료 즉시 정리 | ✅ | C2~C4 · C8(4경로) · J3 |
| 3.2 | 힘 = 분산 단계만 상단 고정 · 상성·상태 확률 불변 · rand 소비 불변 | ✅ | C5~C5d |
| 3.3 | 시간 = R1 한정 · 그 전투만 3R · 전역 상수 불변 · 사신 불가 | ✅ | C6~C6f · C8' |
| 3.4 | 도망 = HP 게이트만 해제 | ✅ | C7~C7d |
| 4 | 신규 3종 **직접 선택** · 최초 6명 중 생존 · **4슬롯 어디든** · 중복 금지 · 취소 시 슬롯 불변 · 쿨 승계·공개 초기화 · 로그 generic | ✅ | D1~D8 · 브라우저 4a~4k |
| 5.1 | 드래곤 30/CD3 · 속성 상대 항상 ×1.3 · 무속성 1.0 | ✅ | E1~E1c |
| 5.2 | 마녀 18/CD3 · 서로 다른 2효과 100% · rand 1회 · 갱신 · 풀 = 실HP 피해 100% | ✅ | E2~E2h (grass 시드 확정) |
| 5.3 | 사신 6R·HP 비율 strict·봉인 CD 분리·보호막 무시 즉사·폴백 | ✅ | E3~E3j · J1 · J4 |
| 6 | 숲 포획 ROSTER 20종 **그 종 그대로** · 후보 고정 · 반동은 탐색 말 | ✅ | F1~F2b · minion_art K1a~K1d·K7c |
| 7 (#129) | 탐색 완료 1.2초 끝점 재평가 · **추가 1000ms 없이 정확히 한 번** · 선택 전투 남으면 X | ✅ | H1~H7 · 브라우저 5a~5f |
| 8 (#125) | 12키 1200ms · CSS 동반 · barStep 350/.35s | ✅ | fx_timing 82건 · 브라우저 1a~3e |
| 9 | 온라인 단일 송신·양측 동일 · 비공개 · AI 두 난이도 수용 · 초기화 누락 없음 | ✅ | F3~F10d · G1~G3c · I1~I4 · J2 |
| 9(표시) | 버프 3종 = 전투원 주변 CSS 효과 + 한 전투 UI · 3D·신규 아트 없음 | ✅ | C9a~C9k · 브라우저 6a~6f |
| 10 | 기존 회귀는 승인된 옛 단언만 갱신 · 과거 고정 검사 유지 · 튜토리얼 10단계·도움말 갱신 | ✅ | 3부 · 5부 |
| 11 | #128·#130·#131·Roblox·새 릴리스 제외 | ✅ | 손대지 않았다 |

**미확정 0건.** 계약에 없는 것을 임의로 만들지 않았고, 판단이 필요한 지점은 6부에 적었다.

---

## 1. 변경 파일

| 파일 | 성격 | 내용 |
|---|---|---|
| `demo/index.html` | 제품 | #125 연출 시간표·CSS · #121 이벤트 3종·공용 인벤토리·패키지 개봉·버프 3종·신규 기술 3종·숲 포획·기술 교체 UI · #129 종료 경로 · 버프 CSS 표시 · 튜토리얼 10단계·상황 도움말 2종 · Saturn REVISE 6건 |
| `demo/test/regression/smoke_fx_timing.js` | **신규** 검사 | #125 계약 게이트 82단언 |
| `demo/test/regression/smoke_search_packages.js` | **신규** 검사 | #121·#129 계약 게이트 **289단언** (A~J · Saturn 재현 J절 포함) |
| `demo/test/milestone/v0.4.7/issues/121/v047_cdp.js` | **신규** 증빙 도구 | 실제 브라우저(CDP) 규칙·시간·화면·비공개 DOM 증빙 **57단언** · `--ref <sha>` 대조 |
| `demo/test/regression/smoke_cross_skill.js` | 기존 검사 | #92 **엔진 계약만** 남기고 보상 전달 절을 신규 suite 로 이전 |
| `demo/test/regression/smoke_cycle5.js` | 기존 검사 | D절 이벤트 종류·보상 단언을 계약 1.1·1.3 으로 갱신 |
| `demo/test/regression/smoke_attack_balance.js` | 기존 검사 | A9 기술 23→26종 · 신규 3종 승인 수치 고정(A9b·A9c) |
| `demo/test/regression/smoke_minion_art.js` | 기존 검사 | K1·K7c 숲 포획을 계약 6 으로 갱신 (두 포획 경로 분리) |
| `demo/test/regression/smoke_turnflow.js` | 기존 검사 | K절 `barStep=600` 죽은 숫자 제거 (단언 무변경) + 전제 1건 |
| `demo/test/regression/smoke_turnflow_timers.js` | 기존 검사 | 7절 주석의 죽은 수치 갱신 (단언 무변경) |
| `demo/test/shared/harness.js` | 검사 하네스 | 신규 심볼 노출 (부재 허용 패턴 — 기준판 로드 호환) |
| `.github/workflows/ci.yml` | CI | 잡 A 에 신규 2스위트 등록 · 잡 C 의 `--manifest` 를 v0.4.5(#114) → **v0.4.7(#121) 촬영본**으로 교체 |
| `demo/test/README.md` | 문서 | 검사 인덱스 3행 추가(회귀 2 · CDP 1)·개수·cross_skill 설명 갱신 |
| `docs/milestone/v0.4.7/issues/121/Mars/artifacts/` | 증빙 | 튜토리얼 10장 + 표준 `capture-manifest.json` + 브라우저 보고 JSON + 스크린샷 7장 |
| `docs/milestone/v0.4.7/issues/121/Mars/report.md` | 문서 | 이 보고서 |

손대지 않은 것: `server/` · `roblox/` · `tools/` · `.gitattributes`(신규 파일은 기존 미지정 파일 `smoke_cycle5.js` 와 같은 동작) · README·release·milestone·Venus 규격.

---

## 2. 구현 요약 (계약 대비)

### 2.1 #125 연출 템포

12키 2000→1200, `barStep` 600→350, CSS `ghostBoom`·`cellBoom`·`boomPop`·`trapBlink` 2s→1.2s, 두 바 전환 .6s→.35s.
**일괄 치환이 아니다** — `resultBanner` 2500 · `countStep`/`roundEndFx`/`watchdog`/`autoEndGrace` 1000 · `msgStep` 600 · `aiDelay` 650 은 그대로다.
`damageFx` 가 1200 이 되면 종전 2단(600+600)은 여유가 0 이므로 350+350=700 으로 내려 **여유 500ms** 를 확보했다 (불변식 `2×barStep ≤ damageFx`).

### 2.2 #121 탐색·패키지·기술·포획

- **이벤트**: `EVENT_KINDS` 3종을 구역마다 1개씩 배정. 난수는 구역당 셔플 1회뿐(총 26회 고정)이라 **배치 결과와 무관하게 소비 횟수가 결정적**이다.
- **인벤토리**: 시작 `["potion","cool","cure"]`·볼 2, `invMax`/`ballMax`=`Infinity`. 시작 아이템 추첨 rand 가 사라져 `newGame` 난수 소비가 26회로 고정됐다.
- **개봉**: 전투 가방에서 4종 중 선택. **확정 분기에서만** 재고가 움직이고 취소는 무소모. 행동·아이템 카운터 미소모.
- **버프 3종**: 회계의 단일 원천은 전투 인스턴스 `B.buffA/B.buffD` 다. 힘은 **분산 난수를 뽑아 버려** 버프 유무로 rand 소비가 달라지지 않는다(공유 시드 안전). 시간은 `B.maxRounds`만 바꾸고 전역 `BAL.maxRounds` 는 불변.
- **기술 교체**: 3종 고정 목록 직접 선택(난수 0) → 최초 6명 중 생존 말 → 4슬롯. 확정 전 슬롯 불변, 확정 시 쿨 승계·해당 슬롯 공개 기록만 제거.
- **숲 포획**: `doSearch` 에서 ROSTER 20종 균등으로 **후보를 한 번** 뽑아(rand 1회) 고정. 수령 말은 cap 빈 동료·왕, 공격 실패 반동은 **탐색 말**. `rosterId`+`artRosterId` 를 함께 기록해 `archOf` 파생 동작까지 그 종과 같다(PD 정정 반영). 전투 중 적 포획(70/100)은 범위 밖이라 불변.

### 2.3 #129 탐색 완료 종료

`searchFinalize()` → 결과 연출(1.2초) → `fxWhenIdle` → `searchEndCheck()`.
`fxIdle` 은 **대기 콜백을 전역 `autoEndCheck()` 보다 먼저** 실행하므로 전역 `autoEndGrace`(1000ms)가 걸리기 전에 이 경로가 판정한다 → 추가 유예 없이 정확히 한 번. 세대·게임·턴·행동자·완료 일련번호 5중 가드로 늦은 콜백을 버린다. 전역 `close()` 에 `endTurn` 을 붙이지 않았고 전역 grace 는 보존했다.

---

## 3. 기존 회귀 단언 변경 — 승인 근거

승인된 기획 변경으로 **실제로 무효가 된** 단언만 갱신했다. 기대값을 낮춘 곳은 없다.

| 파일·단언 | 왜 무효인가 | 어떻게 갱신했나 |
|---|---|---|
| `smoke_cycle5` D2·D4 | 계약 1.1 로 `buff`·`ball` 종류가 폐기, 1.3 으로 `nextBattleBuff` 획득 불가 | 현행 종류로 바꾸고 **"폐기된 보상이 켜지지 않는다"음성 조건을 추가**해 더 강하게 만들었다 |
| `smoke_attack_balance` A9 | 계약 5 로 기술 23→26종 | 기존 23종 쿨 전수 비교를 **그대로 유지**하고 총 개수 + 신규 3종 승인 수치(A9b)·속성 부재(A9c)를 추가 고정 |
| `smoke_minion_art` K1a·K1b·K7c | 계약 6 으로 숲 포획이 공용 템플릿 → 그 종 그대로 | 20종 전수·종별 편차(HP 85~120·ATK 18~25)·배열 복사·후보 고정·rand 1회·탐색 시 20종 균등(K1d)으로 **확대**. K7c 는 **두 포획 경로의 분리**(숲=종 보존 / 전투 중=공용 규격)로 재작성 |
| `smoke_cross_skill` B·C8~C9·G·H·I·J | 계약 1.3·4 로 탐색 보상이 교차 속성 공격기를 주지 않는다 | 삭제가 아니라 **이전**: 엔진 계약(A·C1~C7·D·E·F·K·L)은 남기고 보상 전달 검사는 `smoke_search_packages.js` 에서 신규 규칙으로 다시 만들었다. 남은 B절은 "200시드에서 확정 전 슬롯 변경 0"의 음성 대조로 바꿨다 |
| `smoke_turnflow` K절 / `smoke_turnflow_timers` 7절 | 단언이 아니라 **죽은 숫자**(600/2000) | 제품 표 값을 쓰도록 바꿨다. 단언 내용은 그대로 |

**과거 버전 고정 검사는 손대지 않았다** — `smoke_shock`(shockProb) · `smoke_cross_skill` 기준판 `d614392` 대조 · `smoke_orientation_audit` 고정 ref · `milestone/` 13종 CDP 도구 · `issue114_cdp.js` 의 `BAL.fx.fleeFx=2000` 같은 그때의 값 설정.

---

## 4. 검증 — 명령·종료 코드·결과

### 4.1 헤드리스 회귀 (CI 잡 A 실제 명령)

| 명령 | exit | 결과 |
|---|---|---|
| `node demo/test/regression/smoke_cycle5.js` | 0 | pass 69 / fail 0 |
| `node demo/test/regression/smoke_turnflow.js` | 0 | pass 200 / fail 0 |
| `node demo/test/regression/smoke_turnflow_timers.js` | 0 | pass 36 / fail 0 |
| `node demo/test/regression/smoke_memo.js` | 0 | pass 122 / fail 0 |
| `node demo/test/regression/smoke_own_side.js` | 0 | pass 66 / fail 0 |
| `node demo/test/regression/smoke_online.js` | 0 | pass 157 / fail 0 |
| `node demo/test/regression/smoke_online_sync.js` | 0 | pass 23 / fail 0 |
| `node demo/test/regression/smoke_testclient.js` | 0 | pass 41 / fail 0 |
| `node demo/test/regression/smoke_minion_art.js` | 0 | pass 205 / fail 0 |
| `node demo/test/regression/smoke_issue114.js` | 0 | 16 groups passed |
| `node demo/test/regression/smoke_tutorial.js` | 0 | pass 124 / fail 0 |
| **`node demo/test/regression/smoke_search_packages.js`** | **0** | **pass 289 / fail 0 (신규)** |
| **`node demo/test/regression/smoke_fx_timing.js`** | **0** | **pass 82 / fail 0 (신규)** |
| `node demo/test/regression/smoke_attack_balance.js` | 0 | pass 52 / fail 0 |
| `node demo/test/regression/smoke_shock.js` | 0 | pass 67 / fail 0 |
| `node demo/test/regression/smoke_cross_skill.js` | 0 | pass 86 / fail 0 |
| `node demo/test/regression/smoke_ai_completion.js` | 0 | pass 59 / fail 0 |
| `node demo/test/regression/smoke_orientation_audit.js --path demo/index.html` | 0 | pass 8912 / fail 0 |
| `node tools/docs/test/docs_link_check_test.js` | 0 | 전체 통과 |
| `node tools/docs/docs_link_check.js` | 0 | 문서 128개 · 링크 656건 · 문제 0건 |

잡 A 로컬 소요 **39초**. **기존 failure 0건 · 신규 failure 0건.**

### 4.2 실제 브라우저 증빙 (최종 ref)

```
node demo/test/milestone/v0.4.7/issues/121/v047_cdp.js --ref 157026ba617166644ada0686b897d3ae2a166486 --tutorial-check
```

exit 0 · **pass 57 / fail 0**. 저장 결과: `docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-browser-report.json`
(`blobSha1` = `refBlobSha1` = `4535791b…` · `servedFrom` = 작업 트리(== ref 와 같은 바이트) · `at` 2026-09-09T11:46:25Z).
아래 시간은 **저장된 그 JSON 의 실측값**이다. 실제 타이머 측정이므로 실행마다 수 ms 흔들린다 — 계약은 특정 상수가 아니라
**선언 시간 이상 · 데드라인 이하**라는 구간이고, 검사는 그 구간으로 판정한다 (재실행하면 JSON 수치는 갱신된다).
체감이 아니라 `performance.now()` 와 `getComputedStyle` 로 측정했다. `--read-only` 면 산출물 0건으로 같은 검사를 다시 돌릴 수 있다.

| 항목 | 실측 |
|---|---|
| 턴 배너 잠금 유지 | **1230ms** (t≈600·1100ms 에는 잠금 유지 · 선언 1200 이상 · 2초 회귀 음성 대조 < 1900ms) |
| CSS 계산값 | `ghostBoom`/`cellBoom`/`boomPop` **1.2s** = `explosion` · `trapBlink` **1.2s** = `trapFx` · `.hpbar>div`/`.shbar>div` `width` **0.35s** = `barStep` |
| 보호막 → HP 2단 | 방어막 **1217ms** → HP **1576ms**, 간격 **359ms** (`barStep` 350 이상 · `damageFx` 1200 안) · 잠금 해제 **3646ms** 로 HP 전환 뒤 2070ms 여유 |
| #129 탐색 완료 → 종료 | **1222ms** · 확인 모달 없음 · 턴 +1 · `autoEnds` +1 · **추가 1000ms 유예 없음**(1222 < 1200+1000) |
| 기술 교체 3단계 | 실제 마우스 클릭으로 완주 — 슬롯3 교체 · 쿨 3 승계 · 나머지 슬롯 불변 |
| 버프 표시 | `buff-power` 클래스 · `animation-name: buffPower` · `::before "💪"` · ✨ 상태줄 · 전투 종료 시 사라짐 |
| **비공개 DOM** | 온라인 비소유자·PVE AI 차례 모두 볼 47·선물 7·버프 8·아이템 이름이 **DOM 에 없고** '비공개' 안내만(6.5a~6.5d). 소유자·내 차례에는 그대로 보임(6.5e·6.5f 음성 대조) |
| 튜토리얼 | 10단계 · 카드 수 = 문단 수 · 4단계 선물 3종·7단계 포획·도망 렌더 · 카드 `res` 최장 62자 · 📦·📘 도움말 실제 표시 |

스크린샷 **8장**: `v047-search-root/skill/target/slot/done.png`(5) · `v047-battle-damage-stage.png` · `v047-buff-power.png` · `v047-privacy-owner-control.png`.

`v047-privacy-owner-control.png` 는 **소유자(내 차례) 대조 화면**이다 — "나의 턴 / 볼 47" 이 보이는 것이 정상이며 **비소유자 화면이 아니다.**
비소유자·PVE AI 차례의 비공개는 같은 실행의 DOM 스캔 값(JSON 의 `비공개 DOM 스캔` · 6.5a~6.5d)이 근거다.

**비공개 DOM 검사의 한계(명시)**: 같은 탭에서 `NET.me`·행동자만 바꿔 **그 시점의 DOM** 을 읽는 검사다.
두 기기·실제 릴레이를 통한 **온라인 종단간 검증이 아니다.** 2인스턴스 락스텝(F절)도 Node 안의 두 VM 이며 실제 네트워크가 아니다.

### 4.2b 튜토리얼 10장 캡처 (기존 미디어 도구)

```
node tools/media/readme_media_capture.js capture --ref 157026ba617166644ada0686b897d3ae2a166486 \
  --out docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial \
  --manifest docs/milestone/v0.4.7/issues/121/Mars/artifacts/capture-manifest.json
```

문제 0건 · 10장 모두 2224×1628(동일 clip x84 y43 w1112 h814 · dpr 2) · 모든 단계 `vscroll=false`(카드가 잘리거나 넘치지 않는다).
매니페스트는 **기존 형식 그대로**(`tool`·`command`·`env`·`frames`)이고 `env.ref`=`env.refSha`=`157026ba…` · `env.htmlBlob`=`4535791b…` · Chrome 152.0.7977.83 · Node v24.16.0.
내가 처음 만든 신규 형식 매니페스트는 CI `verify`(`env.ref`/`frames` 요구)와 호환되지 않아 **폐기하고 이 도구로 다시 촬영했다.**

| # | 파일 | 단계 제목 | 카드 |
|---|---|---|---|
| 1 | `tutorial-01.png` | 🏆 이기는 법 세 가지 | 3 |
| 2 | `tutorial-02.png` | 🎭 말 5가지와 숨은 정체 | 3 |
| 3 | `tutorial-03.png` | 🌲 움직이기와 숲에 숨기 | 3 |
| 4 | `tutorial-04.png` | 🔍 흔적과 탐색 | 4 |
| 5 | `tutorial-05.png` | ⚔️ 옆에 붙으면 꼭 싸워요 | 5 |
| 6 | `tutorial-06.png` | 💣 폭탄과 함정 | 3 |
| 7 | `tutorial-07.png` | 🔴 잡아오기와 도망치기 | 4 |
| 8 | `tutorial-08.png` | 🌀 텔레포트(순간이동) | 3 |
| 9 | `tutorial-09.png` | 🔥 버닝 타임(불타는 시간) | 3 |
| 10 | `tutorial-10.png` | 🏁 빠른 복습 — 첫 차례 체크리스트 | 3 |

CI 잡 C 의 `--manifest` 를 이 매니페스트로 바꾼 뒤 로컬 실측: `verify --read-only --no-gh --no-render` **WARN 0건 · exit 0**.
옛 v0.4.5(#114) 매니페스트로는 10장 전부 WARN 이 났는데, 원인은 **frame 경로·캡션이 현행 README 링크와 매칭되지 않는 것**이고
**새 PNG 의 SHA 를 엄격히 대조하는 게이트가 아니다** — `verify` 의 크기·해시 대조는 `docs/media` 고정 경로를 읽는다.
새 10장의 해시는 촬영 매니페스트와 **별도 수동 검증으로 10/10 일치**를 확인했다. SHA 불일치 WARN 정책·검사 한계는 그대로 두었다.
이 단계도 `--no-gh --no-render` 이므로 **오프라인 부분 검증**이다. README 링크·소스 SHA 메타데이터는 Mercury 소관이다.

### 4.3 #125 음성 대조 (보존)

| 변이체 | 결과 | 잡은 단언 |
|---|---|---|
| 변경 전 소스 (2000/600) | exit 1 · 18 FAIL | A1×12 · A3 · A5' · B2' · C2''' · C4'×2 |
| 표만 1200, CSS `2s`·`.6s` | exit 1 · 7 FAIL | B1·B1'·B1''·B2·B2'·B3·B3'' |
| `barStep` 만 600 (여유 0) | exit 1 · 2 FAIL | A3 · A4'(여유 0ms) |

### 4.4 미검증 — 정직한 한계

| 범위 | 왜 |
|---|---|
| **#121·#129 변이(mutant) sweep** | 31종 변이체를 준비해 돌리던 중 한 변이에서 AI 스텝 예산(3,000,000)과 맞물려 8분 이상 걸렸고, **PD 지시로 중단했다. 미완료다.** 14종 축소판(`mutants_lite`)은 **실행을 시작한 뒤 PD 지시로 다시 중단했다 — 완료 근거가 없다.** `#125` 음성 대조 3건만 실측으로 남아 있다. 신규 suite 의 공허함은 그 대신 **Saturn 재현 6건을 J절(J1~J4g)로 회귀화**한 것으로 일부 대체됐다 — 실제로 결함을 잡은 재현이므로 합성 변이보다 증거가 강한 축이다 |
| CI 잡 B·B2·D (서버·Windows 실행기·자산 무결성) | `server/`·`tools/art/`·납품 PNG 를 건드리지 않았다. 잡 C(문서)는 로컬 실행했다 |
| 실제 온라인 종단간(두 기기·실제 릴레이) | 2인스턴스 락스텝은 **Node 안의 두 VM**(F절)이고, 브라우저 비공개 DOM 검사는 같은 탭에서 시점만 바꾼 것이다. 실제 2기기 플레이는 CJ 플레이 QA 범위다 |
| **GitHub 실제 Markdown 렌더·브라우저 README 검증** | **미실행이다.** 로컬도 CI 잡 C 도 `--no-gh --no-render` 오프라인 부분 검증이다(잡 C 의 run 인자 그대로). `gh api markdown` 을 통한 실제 sanitize·렌더 확인과 브라우저 README 레이아웃 검증은 이번 작업 범위에서 수행되지 않았다 |
| 독립 QA PASS | 구현자는 자기 구현물의 QA 를 대체하지 않는다 (Saturn 소관) |

---

## 5. Saturn 독립 QA 대응 (제품 6건 · 내 검사 3건 · 문구 1건 — 전부 수정)

| # | Saturn 지적 | 무엇이 틀렸나 | 수정 | 회귀 |
|---|---|---|---|---|
| P1 | 사신이 **실제 CD·자기 차례**를 검사하지 않아 쿨 2에서도, 상대 차례에도 즉사 | `reaperWhy()` 는 라운드·HP 비율·3R 전투만 본다. 봉인은 CD 와 별개의 **추가** 조건인데 CD 자체를 안 봤다 | 사신 분기에 `f.cds[slot]>0` 거부 + `actorOfPhase()!==side` 거부. `__actCore` 에도 동일 전투·행동자 가드 | J1a~J1j (합법 R6 즉사 유지·쿨 감소로 봉인 안 풀림 포함) |
| P1 | **정상 기본 공격**이 미공개 사신 이름을 공용 로그에 노출 | (a) `basic` 매핑이 `cds[0]` 만 보고 봉인 사신 슬롯으로 들어갔다 (b) 거부 사유를 공유 상태 `B.blog` 에 썼다 | (a) `slotUsable(f,0,side)` 기준으로 매핑 (b) 사유를 blog 에서 빼고 **소유자 전용 토스트**로 | J4c~J4g (레거시 매핑 보존 대조 포함) |
| P1 | 상대 자원 노출 — 온라인 비소유자에 볼 47개, **PVE AI 차례**에 AI 가방·패키지 | 마스킹 조건이 `NET.mode` 전용이라 PVE 가 뚫려 있었다 | 기준을 `viewerIsOwner(ownerP)` 로 교체(온라인·PVE·핫시트 공통) + 볼 수·포획 사유도 마스킹 | J2a~J2i (과도 마스킹 아님 대조 포함) |
| P2 | 기권·경기 종료에서 전투 객체·버프 플래그 잔존 | `gameOver` 가 `S.battle` 을 정리하지 않았다 | `gameOver` 에서 양측 `resetAfter` + `S.battle=null` + `S.recruit=null`. **미사용 패키지는 보존** | J3(기권·왕 제거) · J3'·J3'' |
| P2 | recruit 불가 대상 버튼이 문구만 "(불가)"이고 `disabled=false` | `modal()` 이 disabled 를 지원하지 않았다 | 버튼 튜플 3번째 칸으로 `disabled` 지원 + 온라인 중계에서 제외. 사망·중복·1R 전용·볼 부족에 적용 | D2b·D2b'·D5·D5'·C6b·C6b' (DOM + 코어 거부 양쪽) |
| P2 | **온라인 상대 기권 수신 뒤 전투창·`buff-power` CSS 가 화면에 남는다** | `gameOver` 가 상태(`S.battle`·버프 플래그)는 지우면서 **열린 모달을 닫지 않았다** — 전투창이 남아 CSS 애니메이션이 무한히 돌고 죽은 입력 면이 남았다 | 살아 있던 전투를 걷어낸 경우에만 `close()` + 낡은 전투창 마크업 비우기 + `fxReleaseAll()`. **정상 승패·판정·도망·적 포획은 이 지점 전에 이미 `S.battle` 을 비우고 `battleEndFx` 가 결과 연출 뒤 닫으므로 결과 표시 계약은 건드리지 않는다** | J3(2경로)·**J3b(수신 기권 재현)**·J3c(정상 승패 대조) — overlay hidden · buff CSS 부재 · 잠금 해제 · 패키지 보존 |

추가로 Saturn이 지적한 **내 검사의 사각지대 3곳**도 고쳤다.

| 지적 | 무엇이 허위 PASS 였나 | 수정 |
|---|---|---|
| E2f | grass 조합이 안 뽑힌 시드에서도 "회복 0"이 통과 | 시드별 조합을 미리 계산해 **grass 포함/미포함 시드를 확정**하고, 흡수·정확 회복·오버킬 제외·미포함 음성을 분리 단언 |
| E3e | `T.__useItemCore` 를 **참조만** 하고 호출하지 않았다 | 실제 쿨링수를 사용해 `cds` 가 0 이 된 것을 확인한 뒤 봉인 유지 + 코어 거부까지 |
| I2 | AI 정지 시 `break` 후 `steps<cap` 만 보아 정지해도 PASS | 양측 AI(`sim`)로 돌려 정지를 실패로 잡고 종결·라운드 진행을 단언. **PVE 사람 차례 무동작은 규칙이므로 I2d 로 따로 고정**(그것을 정지로 읽은 것은 검사 설계 오류였다) |

---

## 6. 판단이 필요했던 지점

| # | 내용 | 한 것 |
|---|---|---|
| 1 | 신규 게이트 배치 — 지시서는 `milestone/` 을 지목했으나 [검사 인덱스](../../../../../../demo/test/README.md)는 `regression/`=살아 있는 CI 게이트, `milestone/`=과거 증빙으로 규정 | PD 채택대로 `regression/` 에 두고 CI 등록. `milestone/v0.4.7/issues/121/` 에는 CDP 증빙 도구만 |
| 2 | `smoke_cross_skill` 의 #92 보상 경로 | **이전**(엔진 계약 유지 + 보상 전달은 신규 suite). `recruitCandidates`·`aiRecruitSlot` 은 교차 속성 판정·슬롯 정책의 단위 계약으로 남겼다 — 그 규칙을 지우는 것은 이번 계약 범위 밖이다. 도달 불가 UI(`recruitModal`·`captureModal`)와 죽은 `cap` 액션은 제거했다 |
| 3 | 숲 포획 `rosterId` | 처음엔 계약 열거 항목에 없어 빼려 했으나 PD 정정(msg_e29871f3b018)대로 **유지**해 `archOf` 파생 동작까지 그 종과 같게 했다 |
| 4 | 튜토리얼 분량 | 구조 계약(카드 수 = 문단 수 3~4 · 문단 78자 · 요/! 종결)을 지키려 카드 `res` 에 장문을 넣었는데 PD가 "글자 수 검사 우회"라 지적 — 맞다. `res` 를 핵심 한 줄(최장 62자)로 줄이고 세부는 📦·📘 상황 도움말로 옮겼다 |
| 5 | `autoEndGrace` | 계약 8절 유지 목록에 없지만 지시서·계약 7절 금지 항목이 명시하므로 1000 유지 |
| 6 | `.btok transition:opacity .6s`(KO 페이드) | 계약 8절이 지목하지 않았고 1200ms 안에서 끝나므로 **바꾸지 않았다** |
| 7 | `.gitattributes` | 신규 3파일은 기존 미지정 파일(`smoke_cycle5.js`)과 같은 동작이므로 **추가하지 않았다** (불필요한 repo 설정 변경 회피) |

---

## 7. 실제 브라우저 QA 시나리오 (CJ 플레이 QA용)

`demo/index.html` 을 브라우저로 연다(오프라인은 `demo/assets/minions/` 를 함께 둔 채 파일을 직접 열면 실행).

| # | 경로 | 기대 |
|---|---|---|
| B1 | PVE 시작 → 턴 배너 | 1.2초에 사라지고 그 전 클릭은 먹지 않는다 (종전 2초보다 눈에 띄게 짧다) |
| B2 | 접촉 → 3·2·1 | 접촉·상황은 1.2초씩, **카운트다운은 1초씩 그대로** |
| B3 | 보호막 있는 상대 공격 | 방어막 바가 먼저 줄고 → HP 바가 이어서 줄며 **둘 다 그룹이 끝나기 전에 멈춘다** |
| B4 | 전투 종료 결과 화면 | **2.5초 유지** (짧아지면 회귀) |
| B5 | 폭탄 접촉 / 함정 | 칸 연출·잔상이 배너와 **같이** 1.2초에 끝난다 |
| B6 | 숲 탐색 → 📦 획득 | 확인 클릭 없이 1.2초 뒤 **턴이 바로 끝난다** (옆에 싸울 상대가 있으면 안 끝난다) |
| B7 | 숲 탐색 → 📘 | 기술 3종 → 대상 말(죽은 말은 **눌리지 않는다**) → 4슬롯 중 선택 → 쿨 유지 |
| B8 | 전투 중 🎒 가방 | 🎁 개봉 4종 선택·취소 시 그대로 · ✨ 버프 3종 중 하나(R2 이후 🧭 는 **눌리지 않는다**) |
| B9 | 버프 적용 후 | 전투원 토큰 주변에 💪/🏃/🧭 효과 + ✨ 상태줄. 전투가 끝나면 사라진다 |
| B10 | 아이템 2회 연속 | 같은 라운드 두 번째는 **막히고**, 다음 라운드에는 같은 종류도 쓸 수 있다 |
| B11 | 6라운드 열세에서 💀 | 6R·내 HP 비율 열세일 때만 눌리고, 쿨링수로는 풀리지 않는다 |
| B12 | 온라인 2기기 | 상대 화면에 내 재고·선택·기술·볼 수가 보이지 않고, **적용된 버프만** 보인다 |
| B13 | 기권 | 버프가 걸린 전투 중 기권해도 상태가 남지 않는다 |

---

## 8. 롤백

| 범위 | 방법 |
|---|---|
| #125만 | `BAL.fx` 12키 2000 · `barStep` 600 · CSS 4개 `2s` · 두 바 `.6s`. 값만 복원하면 종전 동작과 동일 |
| #121·#129만 | `demo/index.html` 을 `57c7cc3` 로 되돌리고 #125 값만 재적용. 신규 2스위트와 CI 스텝·인덱스 2행 제거 |
| 전체 | `demo/index.html`·`demo/test/*`·`.github/workflows/ci.yml` 을 `57c7cc3` 로 되돌린다 |

현재 정식 출시본은 **v0.4.5** 이며 이번 변경으로 재릴리스하지 않는다.
