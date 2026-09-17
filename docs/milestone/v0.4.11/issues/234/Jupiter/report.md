# #234 Jupiter 후속 — 서버 권위 요약·합법성·좌석 프레임 반영

작성: 2026-09-17 Jupiter(Server, Claude Opus 5). preflight: required_role=Jupiter · mode=IMPLEMENT · area=SERVER · mutation=code · instance_index=null.
입력: `C:/dd_cdp/issue-234-jupiter-spec.md` · Mars 보고서 11장(서버 영향 목록) · GDD-23 2.2·6.2·7.9·8.1③.
Git·GitHub·Notion 쓰기 없음. `demo/**` 수정 없음.

## 1. 판정 요약

| 명세 2장 조건 | 결과 | 근거 |
| --- | --- | --- |
| 1 요약에 새 전투 상태 반영 | **완료** [확정] | §3. 경계 검사가 엔진 원본의 V2_TIMED·V2_TIMED_MAG·resetV2 필드를 읽어 두 전투원 모두 한 좌석 분기 → 요약 분기를 확인 |
| 2 합법성 | **완료** [확정] | §4. fleeLock 도망 거부 · recruit 기술 교체 단계 거부 · 왕/동료 가변 칸 범위 검사 |
| 3 좌석 프레임 | **완료** [확정] + 잔여 1비트 [추론 — §5.3] | §5. 상대 미공개 칸 수·kind 제거, 미공개 왕·동료 element 비노출 확인, 새 필드 3종 비노출 |
| 4 서버 검사 갱신·경계 검사 | **완료** [확정] | §6. 기존 2개 파일 3개 절 갱신(규칙 변경 근거), 신규 `test-issue234-boundary.js` 47단언 |

## 2. 변경 파일

- `server/authoritative/room.js` — 요약·합법성·좌석 프레임
- `server/authoritative/test/test-issue234-boundary.js` — 신규 경계 검사
- `server/authoritative/test/test-authority-rules.js` — P0-2b 픽스처 명시, P1 왕 본체 절 갱신
- `server/authoritative/test/test-security-gaps.js` — 왕 vs 왕 절 갱신
- `server/package.json` — `test:authoritative` 끝에 신규 검사 1개 추가 (CI B `npm test` 에 자동 포함, ci.yml 수정 없음)
- `docs/milestone/v0.4.11/issues/234/Jupiter/report.md` — 이 파일

## 3. 락스텝 요약(`lockstepDigest`) 추가 필드 — 서버 내부 전용, 어떤 프레임에도 실리지 않음

| 위치 | 필드 | 분류 |
| --- | --- | --- |
| `fighter.v2[0]` | V2_TIMED 19개(`absorbR`·`spdBuffR`·`spdDownR`·`healCutR`·`vanguardTurn`·`retaliateBurnR`·`mirrorR`·`reflectR`·`counterR`·`overloadR`·`nullHitR`·`burrowR`·`sandStormR`·`ringR`·`enduredR`·`breedR`·`fortressR`·`immuneShockR`·`mossR`) 각각 `[값, XFresh]` | 지속 카운터 + 5.6 부여 라운드 게이트 |
| `fighter.v2` | `absorbPct`·`spdBuff`·`spdDown`·`healCut`·`nullHitN`·`mossPct`·`mossBy`·`breedBy`·`counterRound`·`burnMag`·`burnBonus`·`burnNoCure`·`weakenMag` | 세기·소유자 |
| `fighter.v2` | `nextDmgUp`·`nextPowUp`·`nextFlat`·`nextShockForce`·`sandWind` | 다음 피해 스킬 1회성 (`critForce` 는 기존) |
| `fighter.v2` | `sleepNext`·`nullifyNext`·`onceUsed`(참인 키 정렬) | 난수·행동 분기 |
| `fighter.v2` | `shocksDealt`·`mitigated`(소수 원값)·`healTotal`·`sporePending`·`burrowRound`·`enduredUsed`·`fleeLock`·`permShockR`·`permShockBy` | 전투 누계 |
| `fighter.vanguardTurn` | boolean 접기 → **숫자 그대로** | boolean→카운터 변경 반영 (1R≠2R) |
| `fighter.pendingFx` | 항목 `[roundsLeft, tag, atStart]` | 해일 예고 발동 시점 |
| `fighter` | `burnBy`·`atkBuff` | #234 이전부터 규칙 상태였으나 요약 누락 — 함께 메움 |
| `battle` | `reflectSeq`·`counterSeq` | 한 행동 1회 게이트 |
| `pieces` 튜플 | `allyKind`·`leaderElChosen`·`legend`·`revealedSkills` | 6.2 동료 스킬 세트 · 속성 선택 여부 · 전설 · 칸 교체 시 공개 기록 |

- `V2_TIMED` 는 harness 가 노출하지 않아 `room.js` 에 사본(`V2_TIMED_KEYS`)을 뒀다. 드리프트는 경계 검사 1절이 `demo/index.html` 원문을 파싱해 잡는다(엔진이 필드를 늘리면 서버 검사가 실패).
- 없는 필드는 0/false/null 로 떨어진다(서버가 필드를 만들지 않음).

## 4. 합법성 변경 (`_authorize` · `_legalAct`)

| 항목 | 종전 | 변경 | 근거 |
| --- | --- | --- | --- |
| 도망 | 항상 수락(코어가 fleeLock 이면 조용히 무시 → noop) | `f.fleeLock` 이면 `E_ILLEGAL_ACTION` | Mars 11.2 · 가시 덩굴 3차 뿌리 고정 |
| recruit 기술 교체 | 루트 화면 버튼은 disabled 로 이미 거부 | 추가로 `V2_INTERP.recruitSkillSwap===false` 인데 `S.recruit.stage` 가 `skill`·`target`·`slot` 이면 그 모달 응답 전체 거부 (심층 방어) | CJ 결정 2026-09-17 · GDD 8.1③ |
| 슬롯 범위 | 숫자 슬롯만 `k < skills.length`. `'basic'`·`'skill'`·`'common'` 은 `slotUsable` 만 → **2칸 왕의 `'common'`(슬롯2)을 합법으로 읽음** (`slotUsable` 은 없는 칸을 막지 않는다) | 모든 경로에서 칸 범위 먼저 확인 | 6.2 왕·동료 2칸+🪄, 칸 수 1~4 가변. 서버 결함 수정 [확정 — 검사 P1 절] |
| 왕·동료 본체 | "기술 슬롯 없음 → 기본 공격 항상 가능" 주석/분기 | 라이브에서는 칸이 채워지므로 칸 경로를 탄다. `skills` 없는 전투원(레거시 픽스처 전용)은 코어 폴백과 같게 유지 — 거부하면 합법 행동이 0개가 되어 잠길 수 있어 보수적으로 둠 [추론] | Mars 11.2 |

## 5. 좌석 프레임 노출 변경

### 5.1 추가·제거 필드

| 프레임 | 필드 | 변경 | 근거 |
| --- | --- | --- | --- |
| `battle.a/d.skills` (상대 전투원) | 미공개 칸별 `{i, revealed:false, kind}` | **제거** → 미공개 칸이 남아 있으면 `{revealed:false}` **하나** | 7.9 등급(= 칸 수)·쓰지 않은 스킬 비공개. 클라이언트 `netAdaptSkills` 는 위치로 읽고 `i` 를 쓰지 않으며, 패널·커맨드가 이미 "? 미공개" 하나로 접으므로 화면 동일 |
| `battle.a/d.skills` (상대 공개 칸) | `{i, revealed:true, id, name, cd}` | 유지 | 공개된 스킬은 공개 범위(#121 3.1·9) |
| 모든 프레임 | `allyKind`·`leaderElChosen`·`legend` | **추가 안 함** | 소비하는 표시가 없음. 등급: 셋 다 소유자 전용 규칙 상태로 분류. 동료 종류는 자기 뷰에 이미 실제 def/spd(#233)·스킬 id 로 전달돼 표시에 충분 |
| 자기 프레임 `you.pieces[].skills` | 왕·동료도 스킬 배열 | 코드 변경 없음(엔진이 채움) | 등급 A |

### 5.2 미공개 상대 왕·동료 element [확정 — 검사 2b]
- 등급 B(`_serializeUnknownOpponent`)는 `id·r·c·owner·alive·immobile` 만 보낸다 — element 없음. 두 좌석 모두 검사로 고정.
- element 가 나가는 곳은 공개 후 경로뿐이다: 등급 C-2(`revealed===true` — 참전·함정·끝줄 도달), 전투 뷰·fx scene(전투 개시 = 양쪽 공개). GDD 2.2 "전투에 참전해 공개될 때 상대도 알게 됩니다"와 일치.
- 로그 문구는 엔진 `idLabel` 이 미공개 말을 "?" 로 가린다(정적 확인, 이번 변경 없음).

### 5.3 남는 한계 [추론]
- **미공개 칸이 남았는가 1비트**는 자리표시 유무로 나간다. Mars 클라이언트 화면이 같은 조건에서 "? 미공개" 를 보이거나 숨기므로 화면과 같은 양이다. 모든 칸이 공개되면 상대는 칸 수(= 등급)를 알게 된다 — 7.9 엄격 해석이면 자리표시를 항상 붙이고 클라이언트도 항상 "? 미공개" 를 보여야 한다. **[기획 필요]** 로 올린다(서버는 한 줄 변경으로 전환 가능).
- 공개된 스킬 이름은 종의 ⭐ 순서를 따르므로 공개 자체가 등급 하한을 알려 준다(규칙상 공개 범위).

## 6. 서버 검사

### 6.1 기존 검사 갱신 — 기대값을 낮추지 않았다

| 파일 · 절 | 종전 단언 | 갱신 | 근거 |
| --- | --- | --- | --- |
| `test-authority-rules` P0-2b | 하수인 4칸 암묵 전제로 `cds=[2,0,0,0]` 후 `pass` 거부 | 픽스처에 레거시 4칸 키트(`archSkills('std')`)를 명시. 단언 불변 | 3.4 ⭐1 = 1칸 — 1칸을 쿨로 막으면 합법 칸이 없어 pass 가 정당하게 수락됨(1회차 실행에서 4건 실패로 발견) |
| `test-authority-rules` P1 왕 본체 | 왕 `skills` 없음 · 숫자 슬롯0·`'common'` 거부 · `'basic'`=순수 기본 공격 | 왕 2칸 고정 · 슬롯2·3·`'common'`·`pass` 거부 · `'basic'`=슬롯0 수락 | 6.2. **슬롯2 거부는 이번 서버 수정이 없으면 실패하는 단언** |
| `test-security-gaps` 왕 vs 왕 | `battle.a.skills === null` | 자기 뷰 `[K-1, K-2-속성]` 전부 공개 · 상대 뷰 `[{revealed:false}]` | 6.2 · 7.9 |

### 6.2 신규 `test-issue234-boundary.js` (47단언)
1. **요약 분기 감지**: 엔진 원문에서 읽은 필드 전부 × `fa`·`fd` 한 좌석 변경 → 요약 분기·복원 후 일치. `vanguardTurn` 1R/2R · `mitigated` 0.25/0.5 · `pendingFx.atStart` · `B.reflectSeq`·`counterSeq` · 말 `allyKind`·`leaderElChosen`·`legend`. 실제 명령 경로에서 한 좌석 분기 → `E_INTERNAL`·VOID.
2. **미공개 칸 수 비노출**: 상대 ⭐1 과 ⭐4(미공개) 프레임이 바이트 단위로 같음 · 슬롯2만 공개 시 공개 1 + 자리표시 1 · 전부 공개 시 자리표시 없음 · 스킬 배열에 `kind` 없음 · 소유자 뷰 4칸.
2b. **element·새 필드**: 왕·동료 6기 속성 보유 전제 · 두 좌석 프레임에 `allyKind`·`leaderElChosen`·`legend` 없음 · 미공개 상대 왕·동료 레코드는 위치·생존만 · 공개 상대 왕은 element 공개.
3a. **fleeLock 도망 거부**·불변, 대조: 해제 시 수락.
3b. **recruit 기술 교체 거부**: 루트 버튼 비활성 응답 거부 · `skill`·`target`·`slot` 단계의 활성 버튼 전부 거부·불변 · 대조: 포기 수락.

### 6.3 실행 횟수 (정확히)

| 명령 | 횟수 | 결과 |
| --- | --- | --- |
| `npm ci --prefix server` | 1 | exit 0 (node_modules 없음 확인 후) |
| `node authoritative/test/test-issue234-boundary.js` | 2 | 1회차 46/1 — VOID 절 검사 설계 오류(`nextShockForce` 는 피해 스킬 사용 시 양쪽 모두 false 로 돌아가 정당하게 수렴). 행동으로 소모되지 않는 `leaderElChosen` 으로 교체. 2회차 **47/0** |
| `node authoritative/test/test-authority-rules.js` | 2 | 1회차 173/4 — P0-2b 4칸 전제(§6.1). 픽스처 명시 후 2회차 **177/0** |
| `node authoritative/test/test-security-gaps.js` | 1 | **62/0** |
| `npm test` (server, CI B 와 같은 명령) | 1 | **exit 0** — test/security/config/launcher/static 전부 PASSED, authoritative 13개 전부 fail 0 (scheduler 32 · engine-isolation 18 · room 57 · security-gaps 62 · authority-rules 177 · battle-fx 451 · public-authority-delta 37 · match-fuzz 16 · authoritative 50 · http-static 24 · launcher-authoritative 47 · combat-stats-boundary 547 · issue234-boundary 47) |
| `node demo/test/integration/smoke_public_live.js 2` (루트) | 1 | **exit 0 · pass 23 / fail 0** (2게임 완주, errors=0, flee 7회 포함) |

그 밖: 편집 직후 `node -e "require('./server/authoritative/room.js')"` 로드 확인 1회(검사 아님). 반복·다중 시드·데모 클라이언트 스위트 실행 없음.

## 7. 미검증 한계

1. **요약 분기 검사는 정적 변형**(한 좌석 필드 직접 변경)이다. 실제 64종 스킬이 두 좌석에서 갈리는 자연 발생 경로는 재현하지 않았다 — 퍼즈(`test-match-fuzz`)·실서버 통합은 ⭐1 라이브 경기만 밟는다.
2. ⭐2~4·전설은 라이브 경기에서 나오지 않아(#236 전) 프레임 검사는 픽스처로만 확인했다.
3. `mitigated` 소수 누계는 두 엔진이 같은 연산 순서라 같은 double 을 낸다는 전제다(같은 코드·같은 입력) [추론].
4. 브라우저 수동 확인 없음(QA 최소 정책). 공개 방 화면에서 상대 스킬 "? 미공개" 표시는 실서버 통합의 누출·예외 0 과 코드 대조로만 확인.

## 8. Mars 후속 필요

- **필수 없음.** 서버 변경은 클라이언트 수정 없이 동작한다(실서버 통합 23/0).
- [선택 · 기획 필요 시] §5.3 을 엄격 해석으로 정하면 클라이언트 패널·커맨드도 "? 미공개" 를 **항상** 보이도록 바꿔야 서버 자리표시 상시 부착과 표시가 맞는다.
- [참고] `netStubStats` 의 동료 암살자 가정은 자기 말에는 서버가 실제 def/spd 를 보내 영향 없다(#233). 상대 동료 스탯은 계속 보내지 않는다.

## 9. [기획 필요]

| 항목 | 현재 처리 | 출처 |
| --- | --- | --- |
| 상대 스킬 칸이 **전부 공개**됐을 때 "미공개 남음" 표식을 없앨지(= 칸 수가 드러남) 항상 둘지 | 없앤다 — Mars 화면 표시와 동일 | GDD 7.9 · §5.3 |

---

## REVISE 2차 (2026-09-17 · CJ 결정 — 사신의 낫)

근거: CJ 결정 2026-09-17 — 절대 판정 즉사 · 4라운드부터 · 전투를 넘는 봉인. 클라이언트 구현은 Mars REVISE 2차(말 단위 `reaperSeal` 0/1/2, `resetV2` 밖). preflight: Jupiter · IMPLEMENT · SERVER · code · null. Jupiter는 QA 판정을 선언하지 않는다.

### 변경 파일
- `server/authoritative/room.js`
- `server/authoritative/test/test-issue234-boundary.js`
- 이 보고서(이 절)

### 1. 락스텝 요약 (`lockstepDigest`)
| 위치 | 추가 | 이유 |
|---|---|---|
| 전투원 `fighter(f)` | `reaperSeal: num(f.reaperSeal)` | `slotUsable→reaperWhy`가 읽어 합법 슬롯 집합이 갈린다. 1과 2도 구분(숫자 그대로) |
| 말 `pieces[]` 튜플 끝 | `num(p.reaperSeal)` | 전투 종료 초기화 밖이라 보드에서도 남는다 — 전투 요약만으로는 다음 참전 전투 전까지 분기를 못 본다 |
| 포획 `p.cap` 튜플 | `num(p.cap.reaperSeal)` | 대리 출전이면 전투원 객체가 cap이라 봉인이 cap에 기록된다(Mars 추론·PD) |
| 예비 `reserve[]` 튜플 | `num(x.reaperSeal)` | 예비도 대리 출전 전투원 객체 |

### 2. 좌석 프레임 노출
| 경로 | 변경 | 등급 |
|---|---|---|
| `_serializeOwn` (you.pieces · you.reserve) | `reaperSeal` 추가 (`cap`은 원래 원객체 그대로라 cap 봉인도 소유자에게만 간다) | 소유자 전용(등급 A) — 재연결 뒤 봉인 사유 복원 |
| `_serializeBattle` side | 자기 전투원(`owner===seatIndex`)에만 `reaperSeal` 키 추가 · 상대 쪽은 키 자체 없음 | 소유자 전용 |
| `_serializeKnownOpponent` · `_serializeUnknownOpponent` · 상대 전투원 | **추가 없음** — 공개된 사신이라도 봉인 상태는 보내지 않는다 | "지난 전투에서 사신의 낫을 썼다"는 미공개 기술 정보 |

### 3. 합법성 — 확인 결과 (코드 변경 없음)
- 전투 `act`는 `_legalAct`가 모든 칸 경로(숫자·basic·skill·common)에서 `T.slotUsable(f,i,side)`를 쓰고, 그 함수가 `sk.reaper`면 `reaperWhy(side)===null`을 반환한다. 서버에 별도 판정 경로 없음 → `BAL.reaperRound` 4, 봉인 1/2, 수면 포자 예외(`!sk.reaper`)가 엔진 원본 그대로 반영된다.
- `pass`(전 칸 잠김)도 같은 `slotUsable`을 쓴다.
- 라운드 6 전제 서버 검사: 정적 검색(`reaper`·`reaperRound`)으로 `server/**` 검사 파일에 없음 — 갱신 대상 없음.

### 4. 신규 검사 (`test-issue234-boundary.js` 절 4 · 4c)
| 검사 | 내용 |
|---|---|
| 4a 요약 분기 | fa/fd 전투원 · 전투 밖 말(=1, =2, 1 vs 2) · cap · reserve 한 좌석 분기 → 요약 분기, 되돌리면 수렴 |
| 4b 프레임 | 양 좌석: 상대 units(전부 공개 상태)·상대 전투원 뷰에 `reaperSeal` 문자열 없음 · 자기 말 값이 엔진 값과 일치 · 자기 전투원 뷰 1/2 · you.reserve 포함 |
| 4c 합법성 (실제 `act`) | 전제 `BAL.reaperRound===4` · 3R 거부·불변 · 봉인 1 거부 · 봉인 2 거부 · 4R 수락→상대 즉사 · 수면 포자 상태 수락→즉사 · 대조: 수면 포자 상태 다른 v2 비기본 스킬 거부(픽스처에 칸이 없으면 생략 기록) |

### 5. 검사 실행 (횟수 정확히)
| 명령 | 실행 | 결과 |
|---|---|---|
| `node server/authoritative/test/test-issue234-boundary.js` | 2회 | 1회차 67/1 — 검사 작성 오류: 본체 출전 수비 전투원은 말 객체 자체라 `fd.reaperSeal=2`가 그 말을 2로 바꿨는데 "자기 말 전부 1"을 단언. 엔진 말 값과 대조하도록 수정 → 2회차 **68/0, exit 0** |
| `npm test --prefix server` | 1회 | **exit 0** (issue234-boundary 68/0 · combat-stats-boundary 547/0 · authority-rules 177/0 등 전부 fail 0) |
| `node demo/test/integration/smoke_public_live.js 2` | 1회 | **pass 23 / fail 0, exit 0** |

### 6. 미검증 한계 · Mars 후속 필요
1. **[Mars 후속 필요] 클라이언트가 `reaperSeal`을 읽지 않는다.** `demo/index.html` `netStubPiece`는 서버 뷰의 필드를 화이트리스트로 복사하는데 `reaperSeal`이 없다. 그래서 공개 방(재연결 포함)에서 서버는 봉인을 정확히 판정·거부하지만, 클라이언트 스텁의 `reaperWhy` 사유 tip·버튼 비활성은 봉인을 모른다(버튼이 눌리고 서버가 `E_ILLEGAL_ACTION`으로 거부할 수 있음). 필요 조치: `netStubPiece`(및 전투 뷰 대입 경로)에서 `reaperSeal:u.reaperSeal||0` 복사. 서버는 이미 보낸다.
2. 공개 방 실서버 스모크는 AI 경기 흐름이라 사신의 낫 사용·봉인 전투를 실제로 밟았는지는 확인하지 않았다. 봉인 경계는 4c의 결정론 검사가 맡는다.
3. [추론·PD] '전투' 단위·대리 출전 cap 기록은 Mars 보고서 추론을 그대로 따랐다(서버는 엔진 상태를 요약·전송만 한다).
