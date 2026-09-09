# #106 Mars_1 후속 — 5.5 방어막 → HP 표시 단계 수리 보고

> 2026-09-08 Mars_1 (Claude Code) · Task `task_467e4060a49f` · Dispatch `ctx_90019558439b` · 대상: Saturn 1차 판정(issue106-saturn-first.md) 결함 2번 "보호막보다 HP 표시가 먼저 갱신됨". 결함 1·3(옛 세대 playMsgs, fxNext 같은 세대 재진입)은 이전 수정본(SHA `d01845cd…`)을 그대로 보존했다. Git·GitHub·Notion 쓰기 없음.

## 1. 무엇을 고쳤나 [확정]

계약 5.5 "흡수 시 방어막 바가 먼저 줄고 HP 는 그 다음"을 **동기 setter 순서가 아니라 실제 시간 단계**로 구현했다. 이전 수정본은 `applyFx` 안에서 방어막 style 쓰기를 HP 쓰기보다 앞에 두었을 뿐이라 두 CSS 전환(0.6초)이 같은 프레임에 같이 시작·같이 끝났다.

| 파일 | 위치 | 변경 |
|---|---|---|
| `demo/index.html` | `BAL.fx` | `barStep:600` 추가 — HP·방어막 바 너비 전환 시간. CSS `.hpbar>div`/`.shbar>div` `transition:width .6s` 와 같은 값. 다른 시간 상수와 같이 표 한 곳에서만 읽는다(계약 3.4) |
| `demo/index.html` | CSS `.hpbar>div` | 종전에는 위쪽 `.hpbar>div{transition:width .6s}`(#106 추가분)를 아래쪽 기존 `.hpbar>div{... transition:width .3s}` 가 덮어써 실제 HP 전환은 0.3초였다. 죽은 선언을 지우고 유효 선언을 .6s 로 고쳐 계약 5.5 "약 0.6초" 와 일치시켰다 |
| `demo/index.html` | `applyFx` | 한 `fx` 가 같은 side 의 `st.shield`(방어막) 와 `hp.val` 을 **모두 이전 표시값보다 낮게** 실으면: 방어막 바·상태 아이콘·`dispSh`·`dispHp` 는 즉시, **HP 바 너비·HP 숫자만** `fxMs("barStep")` 뒤 `setTimeout` 콜백에서 쓴다. 그 외(HP 만 감소·방어막만 감소·회복·다른 side)는 종전대로 즉시 |
| `demo/index.html` | `HPSTAGE` | side 별 일련번호(표시 계층 전용 모듈 변수, `S` 밖). 새 HP 갱신마다 증가시켜 대기 중인 지연 쓰기를 무효화한다(최신 값이 이긴다) |

지연 콜백 가드 (하나라도 어긋나면 DOM 을 건드리지 않고 종료):
1. `FX.gen` 이 예약 시점과 같다 — 새 게임(`fxReleaseAll`) 뒤 옛 타이머 무효 (불변식 1)
2. `S.battle` 이 예약 시점의 전투 객체와 같다 — 닫힌 전투 무효
3. `$("hpfill-"+side)` 가 예약 시점의 노드와 같다 — 모달이 다시 그려졌으면 재렌더가 `dispHp` 로 이미 최신을 그렸으므로 건너뜀
4. `HPSTAGE[side]` 가 예약 시점 일련번호와 같다 — 뒤따른 HP 갱신이 있으면 옛 값으로 되돌리지 않음

타임라인(기본값, 실제 브라우저): t=0 피해 그룹 표시 + 방어막 바 전환 시작(0.6s) → t=600ms HP 바 전환 시작 + HP 숫자 갱신 → t=1200ms HP 전환 완료 → t=2000ms 피해 그룹(`damageFx`) 종료. 추가 시간 없음.

## 2. 바꾸지 않은 것 [확정]

- 규칙 상태(`S`)·`rand()`·메시지 큐·입력 잠금·`fxLocked` 조건·그룹 시간·`playMsgs`/`fxNext` 세대·재진입 가드: 변경 없음.
- `dispHp`/`dispSh` 는 종전처럼 `applyFx` 시점에 즉시 갱신 — 재렌더는 항상 최신 값을 그린다(계약 5.5 "표시값은 dispHp 방식으로 재생과 동기화").
- 헤드리스·sim(`fxLive()` false): `fxMs("barStep")` 이 0 이라 종전처럼 동기 즉시 쓰기. 기존 회귀 결과 불변.
- `initBattle`·패널 렌더는 손대지 않았다. `resetBattleTemps` 가 전투 시작 시 방어막을 0 으로 두므로 방어막이 줄기 전에는 반드시 방어막 획득 메시지의 `applyFx` 가 `dispSh` 를 채운다 [추론 — 코드 판독 근거, 아래 한계 참조].

## 3. 테스트 [확정]

`demo/test/smoke_turnflow.js` — 구 J0(setter 순서, Saturn 이 증거 불인정)을 제거하고 **K 블록**(FX.force + 가짜 타이머 `T.TQ`) 신설:
- K0 시간 0 이면 즉시 동기(기존 회귀 불변) · K1 방어막 5% 즉시 / HP 바·숫자 이전 값 유지 / `dispHpD` 즉시 / 지연 쓰기 1건 대기 · K2 barStep 뒤 HP 60% 정확히 1회
- K3a~d 단계가 없는 경로(HP 만·방어막만·회복·다른 side)는 즉시 · K4 뒤따른 HP 갱신이 대기 쓰기를 이김 · K5 DOM 노드 교체 뒤 무효 · K6 전투 종료 뒤 무효
- K7 **옛 게임 타이머를 보존한 채 실제 새 게임·새 전투를 열고 실행** → 새 전투 HP 바·dispHp 불변, 이어서 새 전투의 새 메시지는 방어막 즉시·HP 대기·정확히 1회 · K8 `BAL.fx.barStep` 0 이면 즉시
- 주의: I 블록이 다중 로드로 전역 가짜 타이머를 바꾸므로 K 는 `T.activate()` 로 되돌린 뒤 시작한다.

`demo/test/smoke_turnflow_timers.js` — 실제 Node 타이머 **7·8절** 추가:
- 7 실제 전투 행동(`__act(0)`, 방어자 방어막 10): 방어막 바 쓰기 시각 < HP 바 쓰기 시각, 간격 ≥ barStep(30ms), damageFx(70ms)+워치독 안, HP 쓰기 1회, 최종 값 = 규칙 HP, 재생 뒤 `dispHpD/dispShD` = 규칙 값
- 8 옛 전투에서 지연 쓰기 대기 중 새 게임·새 전투(실제 `doMove` 접촉) 진입 후 barStep+40ms 대기 → 새 HP 바 불변

### 명령·결과

```
node demo/test/smoke_turnflow.js          → pass 198 / fail 0   (이전 182 + K 16)
node demo/test/smoke_turnflow_timers.js   → pass 36  / fail 0   (이전 28 + 7·8절 8)
node demo/test/smoke_cross_skill.js       → pass 116 / fail 0   (변경 경계 인접 — 전투 메시지 경로)
node demo/test/smoke_cycle5.js            → pass 69  / fail 0
node demo/test/smoke_minion_art.js        → pass 199 / fail 0   (applyFx 참조 스위트)
```
파일 쓰기 없는 스위트이며 Saturn 이 그대로 재실행할 수 있다. 전체 매트릭스·CDP 는 변경 경계(라이브 `applyFx`·CSS·`BAL.fx` 키 1개 추가)에 닿지 않아 재실행하지 않았다.

## 4. 동결 해시 (SHA256) [확정]

| 파일 | SHA256 |
|---|---|
| `demo/index.html` | `a4932cb80a1407fc728ace6ee918315880840c76010de7b21361a7f618e97280` |
| `demo/test/smoke_turnflow.js` | `9fd756b6470e35d1166234ac8b04b4d6767936fc923454ebdc40f4420c706999` |
| `demo/test/smoke_turnflow_timers.js` | `05cfce336b8ab98f88cd5db165004b0ce7275269fff3dec36868f5944d5d911f` |

이전 원본 `d01845cd8e1595b514bd14fe8e5b96a551cb233b35c220f0b1f2d07c110effe5` 에서 위 표의 `index.html` 변경 3곳만 다르다.

## 5. Mars_2·Saturn_2 연계 [확정]

- Mars_2 `issue106_browser_audit.js` B1s3(getBoundingClientRect 16ms 샘플: 방어막 먼저 → 그 시점 HP 옛 너비 → HP 감소 → damageFx+200ms 안 완료)·B1t(HP 전환 ≤ damageFx) 조건을 이 구현이 만족하도록 설계했다. 기대 관측: 방어막 전환 시작 0ms, HP 전환 시작 ≈600ms, HP 완료 ≈1200ms.
- 시각 증거(스크린샷·실제 너비 시퀀스)는 Mars_2 소관. 이 보고에는 포함하지 않는다.

## 6. 한계 [미확정 · 추론]

- 헤드리스 스텁은 CSS 전환을 재생하지 않으므로 "0.6초 애니메이션이 눈에 보인다"는 브라우저 증거(Mars_2)에 의존한다. 헤드리스가 증명하는 것은 **쓰기 시각의 단계 분리**와 **가드**뿐이다.
- 7절은 스텁 패널이 인라인 style 을 파싱하지 않아 `dispShD` 를 테스트가 직접 채운다. 제품 경로에서는 방어막 획득 메시지의 `applyFx` 가 채운다는 것은 코드 판독에 근거한 추론이며, 실제 브라우저 B1 케이스에서 Mars_2 가 확인하는 것이 맞다.
- 지연 창(600ms) 안에 전투 모달이 다시 그려지는 드문 경우 HP 는 단계 없이 최종 값으로 바로 보인다(`dispHp` 즉시 갱신 설계의 의도된 결과). 재생 중에는 `fxLocked()` 로 수신·재렌더가 보류되어 정상 경로에서는 발생하지 않는다 [추론].
- 코디네이터 상태 메시지 `msg_e9e6d1fe2aed` 는 제목("shell quote 실패 뒤 소규모 네이티브 편집 사용 · 소스 준비 공지")만 읽혔고 본문은 첫 check 에서 소비되어 재조회되지 않았다. 제목 지시대로 이후 편집은 Write/Python 치환으로 수행했고 준비 공지를 보냈다.
