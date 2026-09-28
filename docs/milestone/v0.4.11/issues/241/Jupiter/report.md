# #241 Jupiter 구현 보고 — 서버 권위 요약·합법성·좌석 프레임 (스킬 정리)

- 작성: 2026-09-17 · Jupiter(Server, claude-opus-5) · task `task_cb0ac8a8cf02` · dispatch `ctx_f5ca8d274f52`
- Preflight: required_role=Jupiter · mode=IMPLEMENT · area=SERVER · mutation=code · instance_index=null
- 작업공간: `feature/241-skill-cleanup`(Mars 클라이언트 커밋 `b908966` 위). Git·GitHub·Notion 쓰기 없음. `demo/`·`roblox/`·`unity/`·`art/` 수정 없음.
- 입력: 최종 구현 기획서 1·2장(CJ 승인 2026-09-17 R1·R2·R3·R4·V1·Q1~Q4) · Mars 보고서 3장(E1~E9)·9장(S1~S10) · #234 Jupiter 명세 형식.
- **Jupiter는 자기 구현의 QA 판정을 선언하지 않는다** — 아래는 검사 결과뿐이다.

표기: **[확정]** 코드·검사로 확인 · **[추론]** 코드 근거 판단 · **[기획 필요]** 기획서에 답이 없음.

## 1. 변경 파일

| 파일 | 내용 |
|---|---|
| `server/authoritative/room.js` | `V2_TIMED_KEYS` 교체 · `lockstepDigest` 전투원/전투 요약 · `_authorize` 추가 공격 단계 거부 · `_serializeBattle` 새 공개 필드·`bonus` |
| `server/authoritative/test/test-issue241-boundary.js` | 신규 — 74 단언 |
| `server/authoritative/test/test-issue234-boundary.js` | 폐지된 규칙에 묶인 단언 2곳만 갱신(아래 5장) |
| `server/package.json` | `test:authoritative` 끝에 `test-issue241-boundary.js` 추가(필수 CI B `npm test` 에 포함) |

## 2. 락스텝 요약 변경 (S1~S4)

| 위치 | 제거 | 추가·교체 | 근거 |
|---|---|---|---|
| `V2_TIMED_KEYS`(지속 X · XFresh) | `mirrorR` · `burrowR` · `fortressR` | `spdDownR`→`evadeDownR`, 순서 엔진 `V2_TIMED` 와 동일(16개) | V1 · R3 · 단순화 |
| 전투원 `v2` 세기·1회성·누계 | `counterRound` · `burnBonus` · `nextDmgUp` · `nextFlat` · `nextShockForce` · `sandWind` · `sporePending` · `permShockR` · `permShockBy` | `spdDown`→`evadeDown` | 단순화 1·2·3·6·9·10·12 · R4 · V1 |
| 전투원 `v2` | — | `tideMark`(X) · `tideBy` · `tideHeld` | R2 — X 가 한 좌석만 다르면 즉사 행동이 갈린다 |
| 전투원 `v2` | — | `cdUpFresh`(참인 슬롯 집합) | Q3 — 다음 라운드 합법 슬롯 집합이 갈린다 |
| 전투원 `pendingFx` | `atStart` | `[roundsLeft, tag]` 유지(#233 대기열 계약) | R2 — 호출처 0 |
| 전투 객체 | — | `bonus` = `[side, stage, allowed, saved(정렬 쌍), tailSlot]` | R1 — 한 좌석만 추가 공격 단계면 행위자 자체가 갈린다. `B.actSeq` 는 기존 필드로 이미 본다 |

요약은 여전히 서버 내부 전용이다(어떤 프레임에도 싣지 않음). [확정] 검사 1·2절: 새 필드 각각 한 좌석 분기 → 요약 분기 · 되돌리면 수렴, 폐지 키(`spdDown`/`spdDownR`)만 바꾸면 요약 불변, 요약 코드(주석 제외)에 삭제 필드 이름 0건, 서버 사본 = 엔진 `V2_TIMED` 순서 포함.

## 3. 합법성 변경 (S5·S6)

| 입력 | 추가 공격 단계(`B.bonus.stage==="active"`) 중 | 근거 |
|---|---|---|
| `act`(숫자 칸 · `basic`/`skill`/`common`) | 기존 `_legalAct` → `T.slotUsable` 이 `allowed`(기본기·2·3차 중 실제 칸) 밖을 거부 — **코드 변경 없음** | S5 [확정 코드·검사] |
| `item` · `ball` · `flee` · `pass` · `pkgOpen` | **신규 거부** `E_ILLEGAL_ACTION` (전투 switch 앞 한 줄) | L5·L17 · 클라 코어 조건과 같은 모양(side 무관) |
| `endTurn` · `skipMain` · 보드 입력 | 기존 전투 중 default 거부 그대로 | — |

클라이언트 코어는 이 입력들을 조용히 무시하므로(상태 불변) 서버가 먼저 거부해 noop 프레임을 막는다. [확정] 검사 3절: 평소엔 합법인 조건(아이템 보유·라운드 미사용·패키지 1·fleeLock 없음)을 `_authorize` 대조로 확인한 뒤 7개 어휘 거부·상태 불변, ⌛0 으로 만든 번개 꼬리 자신의 칸 거부, 기본기 추가 공격 수락 → 단계 종료 · 2·3차 ⌛ 사본 복원 · 차례 진행 · 두 좌석 요약 일치.

## 4. 좌석 프레임 정보 경계 (S7·S8 · GDD-23 7.9)

| 필드 | 위치 | 좌석 | 판단 |
|---|---|---|---|
| `evadeDown` · `evadeDownR` | `battle.a/d` | **양쪽 추가** | 적용된 상태이상 — `stIcons` 💨가 두 패널 모두 그린다(burn/shock/crack 과 같은 등급, #121 "적용된 효과는 공개") |
| `tideMark` · `tideHeld` | `battle.a/d` | **양쪽 추가** | 기획 기본값 "사용 시 X 확정·UI 표시(양쪽)" · `🌊해일≤X(보류)` 아이콘·HP 바 X 선. 기술 이름은 사용 순간 이미 공개 |
| `bonus.side` | `battle.bonus` | **양쪽 추가** | 행동 중인 쪽 — actor 로 이미 드러나는 정보, 상대 화면 대기 표시 |
| `bonus.allowed` | `battle.bonus` | **소유자만 추가** | `i < skills.length` 로 걸러져 칸 수(= 등급, 7.9 소유자 전용)를 드러낸다 |
| `bonus.saved`(⌛ 사본) · `bonus.tailSlot` · `bonus.stage` | — | **비노출** | ⌛ 복원은 서버 엔진이 한다 · 클라(`netSynthBattle`)는 `saved:{}`·`stage:"active"` 로 합성 |
| `cdUpFresh` | — | **비노출** | ⌛ 값 자체가 미공개 칸 은닉 대상 · 표시 경로 없음 |
| `tideBy` | — | **비노출** | 표식 대상의 반대편으로 항상 유도 · 표시가 읽지 않음 |
| `spdDown` 계열 | — | 원래 없음 | 프레임에 키 0 확인 |

제거한 프레임 필드: 없음(종전 프레임에 삭제 필드가 실린 적 없다). `bonus` 는 단계가 `active` 일 때만 객체, 아니면 `null`. [확정] 검사 3·4절: 실제 해일 예고 사용 → 두 좌석 엔진 X 일치 · 두 좌석 프레임 같은 X · 보류 양쪽 공개, 실제 추가 공격 단계에서 소유자 `{side, allowed}` · 상대 `{side}` · 두 프레임에 `saved:`/`tailSlot:`/`cdUpFresh:`/`tideBy:`/`stage:` 키 0.

## 5. 기존 검사 갱신 근거 (`test-issue234-boundary.js`)

| 단언 | 종전 | 새 | 근거 |
|---|---|---|---|
| 1절 필드 목록 하한 | `V2_TIMED ≥ 19` | `≥ 16` (resetV2 ≥ 25 · MAG ≥ 8 그대로) | 엔진 목록 자체가 CJ 승인으로 줄었다. 하한은 목록을 읽었는지만 보는 전제이고, 필드 **전수** 분기 감지는 그대로 돈다 |
| 1절 `pendingFx.atStart` 차이 | atStart 분기 | 같은 tag 의 `roundsLeft` 분기 | R2 로 atStart 폐지. #233 대기열 계약 감지력은 유지 |

감지 범위를 줄인 단언은 없다 — 해일·Q3·추가 공격·회피율 감소는 신규 파일이 더 강하게 본다.

## 6. 검사 실행 (예산 준수)

| 명령 | 실행 | 결과 |
|---|---|---|
| `npm ci --prefix server` (node_modules 없음) | 1회 | 종료 0 |
| `node authoritative/test/test-issue241-boundary.js` | 1회 | 74 pass / 0 fail |
| `node authoritative/test/test-issue234-boundary.js` | 1회 | 82 pass / 0 fail |
| `npm test --prefix server` (필수 CI B 와 같은 `npm test`) | 1회 | 종료 0 · 서버 스위트 전부 fail 0(combat-stats 547 · battle-fx 451 · authority-rules 177 · 234 82 · 241 74 …) |
| `node demo/test/integration/smoke_public_live.js 2` | 1회 | 종료 0 · pass 23 / fail 0 · 2판 errors 0 |

실패가 없어 재실행하지 않았다.

## 7. 미검증 한계

- 공개 방 실서버 통합 2판은 AI 무작위 진행이라 번개 꼬리·해일 예고가 실제로 나왔는지 보장하지 않는다 — 두 경로의 서버 명령 흐름은 신규 경계 검사(헤드리스 Room)로만 확인했다. 브라우저 화면(X 선·대기 표시) 미확인.
- E1/S9 전투 행동 입력 시간 초과: 서버에도 없다(room.js 의 타이머는 재접속 유예뿐) [확정]. 만들 때 추가 공격 중에는 슬롯 0 으로 확정해야 한다 — 이번 범위 밖.
- E5(천년목 버티기 소진 뒤 보류하지 않음)는 엔진 해석이며 서버는 결과 상태(`tideHeld`)만 요약·전송한다 [기획 필요 후보 — Venus/CJ].
- Roblox 규칙 미러 미반영(범위 밖).

## 8. Mars 후속 필요

- 없음. 클라이언트 수신 코드(`netSynthFighter` 의 `evadeDown`·`evadeDownR`·`tideMark`·`tideHeld`, `netSynthBattle` 의 `bonus.side`·`bonus.allowed` 기본값)가 이 프레임과 이름·모양이 맞는다 [확정 코드 대조]. 상대 좌석은 `allowed` 가 없어 기본값 `[0,1,2]` 로 합성되지만 상대 행동 메뉴는 그리지 않으므로 표시 영향 없음 [추론].

## battle-fx T17 간헐 실패

- 작성: 2026-09-17 · Jupiter(Server, claude-opus-5) · task `task_1125aaf49349` · dispatch `ctx_41ff1d5970bd` · preflight Jupiter/IMPLEMENT/SERVER/code/null
- 증상 [확정 CI 로그]: PR #240 커밋 `1e29f44` CI B에서 `FAIL: T17 전제: hp 표시가 실린 msg 이벤트 존재` 직후 `TypeError: Cannot read properties of undefined (reading 'fx')`. 같은 제품 코드의 `eead75c`에서는 통과.
- 원인 [확정 코드 · 발생 경로는 추론]: T17은 `startedRoom(1874204)`에서 첫 기본 공격 1회 뒤 `hp`가 실린 msg를 찾는다. 엔진 공격 판정 ①(`demo/index.html` `evaded=rand()<effEvade(opp)`)은 미시드 `rand()`이고, 회피 시 `💨 회피했다!` msg(`st`만, `hp` 없음)만 내고 반환한다. 이번 1회 공격이 회피되면 전제가 없어지고 `hpEvt.fx` 접근이 TypeError로 죽는다. PR239에서 T1에 고친 것과 같은 패턴이다.
- 수정 (`server/authoritative/test/test-battle-fx.js` T17 준비 조건만): initBattle 뒤 두 전투원 `dodge`·`evadeBuff`를 0으로 고정 → `effEvade`=0 → `rand()<0`은 항상 거짓이라 첫 공격이 명중해 `damageFx`에 `hp`가 실린다. 공격 수락 전제 단언(`r17.ok`)을 추가했다. 피해량·치명타는 `rand()`에 그대로 맡긴다. 기존 전제·기대 단언은 지우거나 조건부로 건너뛰지 않았다. 제품 코드(`room.js`·`demo/**`) 수정 없음.
- 같은 파일 정적 점검 [추론]: T3·T4·T5·T8은 공격 1회 뒤 이벤트 존재·turnBanner·roundBanner만 보므로 회피해도 성립한다. T2·T10·T16은 `driveBattleToEnd`(상한 60)로 끝까지 가므로 명중 1회에 의존하지 않는다. T6은 전투 최대 12회로 lastSeq>40을 만든다. T9는 이미 시드를 고정했다. T13~T15는 합성 큐·폭탄·함정 경로라 회피 판정이 없다. 따라서 명중 1회를 전제로 하는 곳은 T1(고정 완료)과 T17(이번 수정)뿐이라 추가 수정은 하지 않았다.
- 검사: `node server/authoritative/test/test-battle-fx.js` 1회(수정 후) → `battle-fx: 452 passed, 0 failed`, exit 0. 반복 실행으로 간헐성을 확인하지는 않았다. 수정 전 실행은 하지 않았다(CI 로그로 증상 확정).
