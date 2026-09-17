# #241 Mars 구현 보고 — 스킬 정리 (교체 4종 · 단순화 12 · 회피율 감소 · Q3)

- 작성: 2026-09-17 · Mars(Client, claude-opus-5) · task `task_9561fd03fef6` · dispatch `ctx_a8e9c8501157`
- Preflight: required_role=Mars · mode=IMPLEMENT · area=CLIENT/HTML · mutation=code · instance_index=null
- 작업공간: `feature/241-skill-cleanup` (#240 브랜치 `1e29f44`에서 분기). Git·GitHub·Notion 쓰기 없음. `server/`·`roblox/`·`unity/`·`art/` 수정 없음.
- 구현 입력 우선순위: 최종 구현 기획서(1·2장) > Venus `final-plan-review.md` > `skill-cut-review.md` 2.3 > Mars_2 `cleanup-feasibility.md` > GDD 사본. 승인되지 않은 제안 수치는 쓰지 않았다.
- **Mars는 자기 구현의 QA 판정을 선언하지 않는다** — 아래는 검사 결과뿐이다. 판정은 Saturn/백업 QA · CJ 플레이 QA.

표기: **[확정]** 코드·검사로 확인 · **[추론]** 코드 근거 판단(실행 확인 없음) · **[기획 필요]** 기획서에 답이 없음.

## 1. 변경 파일

| 파일 | 내용 |
|---|---|
| `demo/index.html` | 엔진 · 스킬 데이터 · 전투 UI · AI · 공개 방 표시 수신(+286 / −182) |
| `demo/test/regression/smoke_issue241.js` | 신규 — 83 단언 |
| `demo/test/regression/smoke_issue234.js` | 규칙이 바뀐 단언만 재작성(근거 주석 `#241 CJ 승인…`) |
| `demo/test/shared/harness.js` | 새 함수 5개 노출(부재 시 undefined — 기준판 로드 호환) |
| `.github/workflows/ci.yml` | 잡 A 스위트에 `smoke_issue241.js` **추가만** + 설명 주석 |

## 2. 범위별 구현 대조표 (명세 2장)

| # | 항목 | 구현 위치(`demo/index.html`) | 검사 |
|---|---|---|---|
| 1 | **번개 꼬리** R1 — 방식 A(추가 행동 단계). 💪100% 뒤 `B.bonus`(stage pending→active) · 2·3차 ⌛ 사본 저장 후 0 · 후보 기본기·2차·3차(`V2_INTERP.tailBonusSlots`) · 피해만 60%(`tailBonusDmg`, `ctx.dmgScale` → `v2Hit`) · 턴 끝(`nextPhase` 진입) `v2BonusEnd`가 2·3차 ⌛ 복원 · 도망/볼/아이템/패키지/패스 코어 거부 · 메뉴 비활성·안내 문구 · 늦은 콜백 actSeq 거부 · 재귀 연계(`c2`) 삭제 | `lightningTail` · `finishV2` · `v2BonusEnd` · `execV2` · `slotUsable` · `battleModal` 코어 | 241 L1~L15 · 234 ML4b/c · A19 |
| 2 | **해일 예고** R2 — 사용 시 `resolveHit(...,{preview:true})`로 ①~⑩ 1회 계산해 X 확정(회피면 표식 없음·전투당 1회 소모 · 사용자 약화 1회 소모) → `opp.tideMark`. `v2TideCheck`: 사용 직후(`finishV2`) · 매 행동 뒤(`nextPhase` 진입) · 라운드 종료 처리 뒤(지속 감소 = 방어 효과 만료 직후). HP+방어막 ≤ X 면 `instaKill` + 유효 피해 기록, 천년목/철벽/과부하 켜짐이면 보류(`tideHeld`, 효과 소모 없음). UI: 상태 아이콘 `🌊해일≤X(보류)` 양쪽 패널 · 대상 HP 바 `.tideline` X 선. `atStart` 분기 · `v2RoundStart` 삭제(`scheduleDelayed`/`tickDelayed`는 #233 계약으로 유지, 호출처 0) | `tsunami` · `v2TideCheck` · `v2TideBlocked` · `resolveHit` preview · `stIcons` · `panel` · CSS | 241 T1~T19 · 234 MW5c~f |
| 3 | **거울 수면** R3 — `v2PeekStatus`로 해제 순서 첫 상태이상(영겁의 재 화상 건너뜀) 읽기 → 자기 해제 → 💪80% → 적중 시 `v2Apply(force)`로 수치·남은 지속 그대로(대상에겐 새 부여 Fresh) · 부여자=거울 사용자 · 면역이면 해제만. `mirrorR`·되돌림 분기 삭제 | `mirrorSurface` · `v2PeekStatus` · `v2ClearStatus` | 241 M1~M8 · 234 MW1b/c |
| 4 | **모래바람** R4 — 💪60% · 적중 시 `evadeDown` 0.10(2R) 확정 · 자기 회피 +10%(1R). `sandWind` 필드·`outMult`·`sandWindStage` 삭제 | `sandWind` · 데이터 | 234 ME4a/b · 241 V8 |
| 5 | **회피율 감소** V1 — `spdDown/spdDownR` → `evadeDown/evadeDownR`. `effEvade` = clamp(기본+증가−감소, 0, 0.40) 한 식 · `resolveHit` ① 난수 소비 불변 · 날개 강타 −15%p(적중 시) · 모래 폭풍 −20%p(사용 시, 확률 절반 유지) · 상태이상(`v2IsStatus`) · 맑은 물/변덕 주문/해독제 해제 · 거울 수면 이동 · 큰 값·긴 지속(`applyTimedFx`) · 아이콘 `💨회피−N%p·NR` · 로그. `effSpd`에서 감소 제거 | `effEvade` · `v2Apply` · `v2PeekStatus` · 해독제 · `stIcons` | 241 V1~V16 · 234 ME4c · ML-D3 |
| 6 | **단순화 12** — 영구 자기장 감전 3R 확정(라운드 시작 훅 삭제) · 충전 💪60%·감전 100%·가하는 피해 +10%(2R)(`nextShockForce`·속도 +3 삭제) · 축전 방어막 20%(`nextFlat`·층 출처 삭제) · 굴 파기 경화 40%(1R)(`burrowR`·⑧ 분기 삭제, `burrowRound`는 지하 매복 조건으로 유지) · 집게 반격 방어막이 막은 피해 50% 반사(`counterRound`·`counterSeq` 삭제, `counterR` 키 이름 유지) · 열기 축적 방어막 15%·사용 시 화상 70%(반격 화상·층 출처 삭제) · 영겁의 재 어떤 해제로도 불가 · 달군 비늘 방어막 10%·가하는 피해 +20%(1R)(`nextDmgUp` 삭제) · 잿불 심기 화상 수치 8% 갱신(`burnBonus` 전면 삭제) · 요새 전환 현재 방어막만큼(최대 HP 20%) + 10%(`fortressR`·절반 소모 분기 삭제) · 포자 막 방어막 15%·회복 6%(`sporePending`·라운드 종료 회복 삭제) · 독약 병 화상 50%·약화 50%. `v2ShieldSrcGain` 삭제. **수면 포자 현행 유지** | `V2_FX` 각 항목 · `V2_TIMED` · `resetV2` · `shieldConsume` · `v2AfterHit` · `v2RoundEnd` | 241 S1~S9 · 234 MF1·MF5·MF6·MW6b·ML1·ML5·ML6·ME1·ME6·MG6·P14e·C6 |
| 7 | **기본값 7** — P2 `cleanseOrder` 이름 교체 · P6 주석 문장 교체(추가 공격은 번개 꼬리 행동에 속함 — 무효면 추가 공격 없음) · P8·P11·P17·P21·N1 현행 유지 확인(코드 무변경, N1은 거울 수면에서 구현) | `V2_INTERP` | 241 V15 · L10 · M4/M5 |
| 8 | **Q3** — 사실 확인 뒤 적용: `V2_INTERP.cdUpFresh`. ⌛0 에서 +1 된 슬롯은 부여 라운드 종료 감소에서 1 아래로 내리지 않음(`cdUpFresh[i]`, 라운드 종료·쿨링수에서 초기화) | `v2CdUp` · `nextPhase` · 쿨링수 | 241 Q1~Q4 |
| 9 | 천둥 낙인 수치 불변 | — | 234 ML2c/d |
| 10 | **AI** — `aiScheduledLead`(공개 `B.firstSideR1`·라운드 패리티) · `aiV2DmgAdj`(추가 공격 ×0.6 · 천둥 낙인 선턴 ×2 · 번개 꼬리 ×1.6 · 감전 스킬은 다음 라운드 예정 선턴이 상대면 +3/자신이면 −2 · 꺼지지 않는 불티 +2 · 거울 수면 옮길 상태 +4) · 잠영 def 점수 +2 · 해일 예고는 공개 수치(HP·방어막·약화·방어력·경화·속성)로 X 어림해 곧 발동이면 95 · 두 난이도 모두 추가 공격 중 아이템/패키지/포획/도망 건너뜀 | `aiBattleAction` · `aiBattleActionStrong` · `aiV2SupportScore` | 241 A1~A11 · L15 · 234 D1~D4 |

## 3. 번개 꼬리 · 해일 예고 예외 목록

기본값으로 풀리지 않았거나 해석을 고른 지점. **CJ 문장과 충돌하는 예외는 없었다** — 그래서 구현 중 `ask`는 보내지 않았다.

| # | 대상 | 지점 | 처리 | 분류 |
|---|---|---|---|---|
| E1 | 번개 꼬리 | "입력 시간 초과 → 기본기 60% 자동 확정"(Venus 1.2 추가 행) — **클라이언트·서버 어디에도 전투 행동 입력 시간 초과가 없다**(`demo/index.html`·`server/authoritative/room.js` 검색 0건) | 구현할 연결점 없음. 추가 공격 중 [턴 종료] 합법성은 기본기가 항상 ⌛0 이라 자동으로 거부된다. 시간 제한이 생기면 추가 공격 중에는 슬롯 0 으로 확정해야 한다 | [확정] 사실 · 후속 |
| E2 | 번개 꼬리 | 첫 타격이 상대를 쓰러뜨리면 | 추가 공격 없이 전투 종료(`finishV2` checkDeath 우선) | [추론] L21 연장 |
| E3 | 번개 꼬리 | 후보 칸이 없는 전투원(검사용 2칸 구성 등) | `allowed`/`saved`는 실제 칸만 — 번개 꼬리가 2칸째면 기본기만 후보 | [추론] 구현 선택 |
| E4 | 번개 꼬리 | 추가 공격의 고정 피해(flat) | "피해만 60%"에 포함해 ×0.6 (번개 여우 스킬엔 고정 피해 없음 — 결과 영향 0) | [추론] |
| E5 | 해일 예고 | "천년목이 켜져 있다"의 범위 — 버티기를 이미 쓴(`enduredUsed`) 뒤에도 `enduredR`가 남은 경우 | **보류하지 않음**(막을 수단이 소진됨). 철벽 돌파도 무효 1회가 남은(`nullHitN>0`) 동안만 보류 | [기획 필요 후보] Venus ③④ 해석 연장 |
| E6 | 해일 예고 | 치명타 ⑦ | 파도 술사(지속형) 치명 0% 라 사용 순간 난수는 소비하되 결과 영향 0 · 사용자의 확정 치명 1회성은 쓰지 않음(`critForce:false`) | [추론] |
| E7 | 해일 예고 | 사용 순간 대상 1회성 상태(철벽 무효 · 경감 `dmgCut` · 피격 표식 `vulnMark`) | 소모하지 않음 — X 계산은 ⑩에서 멈추고 ⑪(철벽/과부하/방어막) 이후를 타지 않는다 | [추론] "피해 아님" |
| E8 | 해일 예고 | 보류 로그 | 보류로 바뀌는 순간 1줄만(`tideHeld`) — 매 행동 반복 로그 없음 | 표시 |
| E9 | 해일 예고 | 온라인 상대 화면 표식 | 로컬(PVE·핫시트)은 동작. 공개 방은 서버가 `tideMark`를 보내야 보인다(수신 코드는 준비) | 서버 후속 |

## 4. Q3 사실 확인 결과

- **[확정 — 검사]** `smoke_issue241` Q1: `V2_INTERP.cdUpFresh=false`로 두고 D 선턴(속도 14) · A 동결 후턴(속도 6), D 2차 ⌛0 → 동결 +1 → R1 종료 직후 ⌛0 · R2 에 사용 가능. **"후턴 시전자의 ⌛0 +1 은 효과 0" 이 사실이다.**
- 사실이므로 CJ 승인대로 적용했다(Q2: +1 이 R2 사용을 막고 R2 종료에 0). ⌛>0 에 건 +1 은 평소 감소(Q3) · 자기장도 같은 규칙(Q4).
- 부수 결과 [추론]: 시전자가 **선턴**이면 대상의 그 라운드 남은 행동과 다음 라운드 행동을 모두 막는다 — 5.6 1R 효과가 상대 행동 2번을 받는 것과 같은 구조.

## 5. 기대값 변경 근거표 (`smoke_issue234.js`)

| 단언 | 종전 기대 | 새 기대 | 근거 |
|---|---|---|---|
| A 표(GDD_SK) 충전·모래바람 | 💪 없음 | 💪60% | Q1 충전 수정 · R4 |
| A19 | 번개 꼬리 1회로 차례 진행 | 추가 공격(기본기)까지 끝나야 진행 | R1 |
| C6 · P14e · O5/O6 | 삭제 필드(nextDmgUp·nextFlat·sandWind·nextShockForce·spdDown) 사용 | 남은 1회성(확정 치명·위력+) · 속도 증가만 | 단순화 2·3·9 · R4 · V1 |
| MF1a~c | 다음 피해 스킬 +20% 1회 소모 | 가하는 피해 +20%(1R) 버프 · 피해 수치 38 불변 | 단순화 9 |
| MF5a~c | +3%p · 최대 +6%p | 화상 수치 8% · 큰 값 유지 | 단순화 10 |
| MF6a/b | 방어막이 남은 동안 공격자 화상 70% | 사용 시 대상 화상 70% · 반격 화상 없음 | 단순화 7 |
| MW1b/c | 1R 되돌림 | 자기 화상 2R 을 대상에게 옮김 · 💪80% | R3 |
| MW5c~f | 2R 뒤 라운드 시작 36 피해 · 전투 끝나면 취소 | 표식 X=36 · 조건 충족 행동 뒤 사망 · 미충족이면 피해 0 | R2 |
| MW6b | 💪50% 반격 10 | 방어막이 막은 20 × 50% 반사 10 | 단순화 6 |
| ML1a/b | 다음 스킬 감전 확정 · 속도 +3 | 💪60%(12) · 감전 · 가하는 피해 +10%(2R) | Q1 충전 수정 |
| ML4b/c | 자동 연계 · 후보 없으면 첫 타격만 | 추가 공격 단계 · 스파크 스침 60% · ⌛ 복원 | R1 |
| ML5a~d | 라운드 시작마다 재부여 2R | 감전 3R 확정 · R4 종료 해제 | 단순화 1 |
| ML6a/b | 막은 15 → 다음 스킬 +15 | 방어막 20 · 추가 없음 | 단순화 3 |
| ME4a~c | 다음 스킬 −30% · 속도 −5 | 💪60% · 회피율 −10%p/−20%p | R4 · V1 |
| ME6b~e | 내구 2배 | 현재 방어막만큼 추가(20% 한도) + 10% | 단순화 11 |
| MG6a | 막은 피해 50% 라운드 종료 회복 | 즉시 6% 회복 | 단순화 12 |
| ML-D3 | 속도 −4 | 회피율 −15%p(2R) | V1 · Q2 |

기대값을 구현에 맞춰 낮춘 곳은 없다. 수치가 그대로 남은 단언(MF1b 38 · ME1b 12 · MW6b 10)은 규칙이 바뀌어도 같은 값이 나오는 경우다.

## 6. 검사 횟수 (명세 4장 예산)

| 명령 | 실행 | 결과 |
|---|---|---|
| `node demo/test/regression/smoke_issue241.js` | **1회** | 83 pass / 0 fail |
| `node demo/test/regression/smoke_issue234.js` | **2회** — 1회차 3 fail(MF1c · ML5b · ML5c: 내가 새로 쓴 단언의 라운드 진행 착오 — 제품 결함 아님), 단언 2곳 수정 후 그 파일만 1회 재실행 | 351 pass / 0 fail |
| CI 잡 A 나머지 클라이언트 스위트 26개 | 각 **1회** | 26개 모두 fail 0 (7장) |

서버 검사·브라우저·다중 시드·반복 실행 없음. `smoke_issue241` A11 AI 전투는 시드 1개(241).

## 7. CI 잡 A 실행 결과

| 스위트 | 종료 코드 | 결과 |
|---|---|---|
| smoke_cycle5 · turnflow · turnflow_timers · memo · own_side | 0 | 70 · 203 · 36 · 122 · 66 pass / 0 fail |
| smoke_online · online_sync · testclient · minion_art · issue114 | 0 | 159 · 23 · 41 · 208 pass · 18 groups |
| smoke_tutorial · search_packages · issue146 · public_rooms · fx_consumer | 0 | 136 · 300 · 215 · 143 · 52 pass |
| smoke_issue233 · online_art · trap_icon · fx_timing | 0 | 309 · 101 · 42 · 82 pass |
| smoke_attack_balance · shock · cross_skill · ai_completion | 0 | 54 · 67 · 86 · 59 pass (ai_completion sim 13판) |
| issue122_rules · back_nav · orientation_audit | 0 | 93 · 122 · 8914 pass |
| smoke_issue234 · smoke_issue241 (6장) | 0 | 351 · 83 pass |

**잡 A 클라이언트 스위트 28개 전부 종료 코드 0 · fail 0.** 실패가 없어 재실행하지 않았다.

## 8. 미검증 한계

- 브라우저 실화면 미확인 — X 선 위치·추가 공격 안내·메뉴 비활성은 헤드리스 HTML 문자열로만 확인했다(T3 · L6).
- 공개 방(서버 권위) 경로는 서버가 새 필드를 보내기 전까지 동작하지 않는다 — 수신 코드(`netSynthFighter`·`netSynthBattle`)만 준비했고 검사하지 않았다.
- AI 밸런스(해일 사용률 · 추가 공격 선택 분포 · 천둥 낙인 260% 고착)는 측정하지 않았다(시뮬레이션 금지 범위). 추가 공격 선택은 점수상 대부분 스파크 스침으로 쏠릴 것이다 [추론 · Venus 1.3].
- Roblox 규칙 미러는 이번 범위 밖(수정 금지) — HTML 과 규칙이 갈린 상태다.
- GDD-23 본문 갱신은 Venus/PD 소관(④) — 스킬 `desc` 문구는 이 보고의 승인값 문장으로 먼저 바꿨다.

## 9. 서버 영향 목록 (Jupiter 후속 — `server/authoritative/room.js`)

| # | 항목 | 위치 | 필요 작업 |
|---|---|---|---|
| S1 | 지속 키 교체 | `V2_TIMED_KEYS`(90~91) | `spdDownR`→`evadeDownR` · **삭제** `mirrorR` · `burrowR` · `fortressR` (클라 `V2_TIMED`와 순서 일치: absorbR, spdBuffR, evadeDownR, healCutR, vanguardTurn, retaliateBurnR, reflectR, counterR, overloadR, nullHitR, sandStormR, ringR, enduredR, breedR, immuneShockR, mossR) |
| S2 | v2 요약 값 교체 | `lockstepDigest` v2(f)(110~125) | `spdDown`→`evadeDown` · **삭제** `counterRound` · `burnBonus` · `nextDmgUp` · `nextFlat` · `nextShockForce` · `sandWind` · `sporePending` · `permShockR` · `permShockBy` · **추가** `tideMark`(숫자) · `tideBy` · `tideHeld` · `cdUpFresh`(슬롯 배열). 101행 주석의 "난수 소비를 바꾸는 것"에서 `nextShockForce` 제거 |
| S3 | 예약 효과 요약 | 172 `pendingFx` 의 `!!e.atStart` | `atStart` 폐지 — 호출처 0 이라 항상 빈 배열(삭제 가능) |
| S4 | 번개 꼬리 추가 공격 상태 | 락스텝 요약(전투 단위) | **추가** `B.bonus` = {side, stage, allowed, saved, tailSlot}. `B.actSeq` 는 추가 공격 시작에도 1 오른다 |
| S5 | 추가 공격 합법성 | `_legalAct`(718) | `T.slotUsable`이 허용 슬롯만 통과시키므로 **변경 불필요** [확정 코드]. `pass`도 `slotUsable` 기반이라 자동 거부 |
| S6 | 추가 공격 중 금지 | 전투 switch(630~) `item` · `ball` · `flee` | `B.bonus&&B.bonus.stage==="active"` 이면 `E_ILLEGAL_ACTION` 추가(클라 코어는 조용히 무시 → 서버가 먼저 거부해야 noop 프레임이 안 생긴다). 패키지 개봉(`pkg`류)도 같다 |
| S7 | 좌석 프레임 | `toSeatView` battle | `bonus:{side, allowed}`(양 좌석 공개 — 행동 중 상대 대기 표시) · 전투원 a/d 에 `tideMark` · `tideHeld` · `evadeDown` · `evadeDownR` (적용된 효과라 양쪽 공개 — Venus 2.5 · 5.2) |
| S8 | 정보 경계 | `toSeatView` | `B.bonus.saved`(⌛ 사본)는 소유자 ⌛ 정보라 상대 좌석에 보내지 않는다 · `cdUpFresh`도 비공개 |
| S9 | 입력 시간 초과 | 없음 | 전투 행동 시간 제한을 만들면 추가 공격 중에는 슬롯 0(기본기 60%)으로 확정 (E1) |
| S10 | 서버 테스트 사본 | `test-issue234-boundary.js` · `test-combat-stats-boundary.js`(`spdDown` 62~71·290) · `test-authority-rules.js`(193) | 키 드리프트 검사가 S1·S2 교체 전까지 실패할 수 있다 [추론 — 미실행] |
