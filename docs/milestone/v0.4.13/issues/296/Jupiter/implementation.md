# #296 Jupiter 구현 기록 — 전투 뷰 기본 6스탯·실제 전투원 등급·내 칸 사용 가능 상태

2026-10-02 · Jupiter_1 (Claude `claude-opus-5-5` / high / `--dangerously-skip-permissions`, PID 20500 실측) · Ponytail full · 기준 `e48a8aa`
근거: [구현 전 최종 보고](../Mercury/pre-implementation-report.md) (부서 분석 초안보다 우선) · CJ 2026-10-02 구현 승인.

**현재 범위 (2026-10-02 CJ 정정 · Jupiter_2, task_8c2910b09388)**: 전투 뷰 `a`/`d`에 **실제 전투원 등급 `grade`** 를 양 좌석 공개로 추가했다(대리 출전 포함). 종전 기록의 "대리 출전 `grade` 비공개"는 이 정정이 좁게 대체한다. 상대 기술·동적 위력/범위 표시는 UI(Mars) 범위이며 서버는 위력 필드·헬퍼를 만들지 않았고 Core 도 수정하지 않았다. 실행값: 모델 `claude-opus-5-5` 확인 · effort/권한 모드는 세션 내부에서 실측할 수단이 없어 기동 영수증(Mercury) 기준 — 미확정.

## 변경 (확정)

| 파일 | 내용 |
|---|---|
| `server/authoritative/room.js` | `_serializeBattle`의 `a`/`d`에 기본 6스탯 추가, `_skillsFor`에 선택 인자 `side` 추가(전투 중 자기 전투원에만 `usable`). 낡은 "atk 철회·6스탯 금지" 주석을 새 경계로 치환. |
| `server/authoritative/test/test-combat-stats-boundary.js` | 전투 뷰 6스탯 금지 단언을 전투 한정 allowlist(`BASIC6`)로 치환, 3b 블록 신설. 보드 상대 뷰 금지(`NEVER_TO_OPPONENT`)는 그대로. |
| `server/authoritative/test/test-public-authority-delta.js` | `atk` 미노출 단언만 제거(`cd`·`skillAtk` 미노출 유지). |
| `server/authoritative/test/test-issue292-art.js` | 가방 대리 출전(일반 ⭐2·전설) 양 좌석·재연결에 6스탯 = 개체 실제 값 단언 추가. |
| `docs/milestone/v0.4.10/issues/217/Jupiter/protocol.md` | `server/README.md`가 가리키는 프로토콜 원본의 `battle` 행에 #296 개정 한 줄 추가(`server/PROTOCOL.md`는 존재하지 않는다). |

Core(`demo/js/*`)·BAL·`effAtk`·스탯 산식·demo 파일은 수정하지 않았다. 새 의존성 없음.

## 와이어 계약 (Mars 소비용)

- `battle.a` / `battle.d` — **양 좌석·양쪽 전투원**, 키 항상 존재: `atk, def, spd, dodge, crit, statusPct`.
  - 값은 실제 전투원 `f`(`battle.fa`/`fd` — 본체·cap·가방 대리 출전)의 값. `Number.isFinite`면 그 숫자(0 은 0), 아니면 `null` → 화면 `—`(`?` 아님 · 0 으로 지어내지 않음).
  - `dodge·crit·statusPct`는 비율(0.10 = 10%). 시너지(`syn*`)·일시 효과 가산 없음.
- 자기 전투원의 `skills[i]`: 기존 `{i,revealed,id,name,cd}` + `usable:boolean` = Core `slotUsable(f,i,side,S)` (쿨·전투당 1회·`afterBurrow` 등 사용 조건·수면·사신 봉인·번개 꼬리 허용 칸).
- 상대 전투원 `skills`: **회선은 종전 그대로** — 공개된 칸 + 접힌 미공개 존재 표식 `{revealed:false}` 하나. `usable` 키·칸 수 없음. 최신 UI 는 상대 스킬을 **전혀 그리지 않는다**(표시 규칙 · 새 비공개 규칙 아님 — 회선을 좁히지 않았다).
- 불변: 자기 쪽 `synAtk`·`reaperSeal`, 프레임 `ownSyn`. 자기 말 뷰(`you.pieces[].skills`)에는 `usable`을 붙이지 않는다(전투 밖).
- `battle.a` / `battle.d` 의 `grade` — **양 좌석·양쪽 전투원**, 키 항상 존재. 실제 전투원 `f`의 등급 정수(대리 출전이면 cap·가방 개체의 등급, 보드 말의 등급 아님). 정수가 아니면 `null`(왕·동료 — 하수인 등급을 지어내지 않는다 · 0 으로 추측하지 않는다).
- 계속 비공개: `uid`·`cap`·원시 `legend`·`shieldStartPct`·`shieldLayers`·`onceUsed`·`burrowRound`·전투원 단위 `cd`/`skillAtk`·상대 `syn*`. 보드 상대 뷰(`units[]`)에 6스탯 없음.

## 위력 표시와 권위 피해의 분리 (확정)

- 6스탯·`usable`은 **서버 → 클라이언트 단방향 표시 값**이다. 클라이언트는 행동 의도(`act k` 등)만 보내고 서버는 `_legalAct`의 `T.slotUsable`과 Core `resolveHit`로 실제 전투원 객체에서 직접 판정한다. 직렬화 값이 판정으로 되돌아오는 경로는 없다.
- 전투 화면의 동적 위력·범위 표시는 CJ 정정으로 **삭제됐다**([구현 계약](../Venus/implementation-contract.md) 결정 6). 서버는 예측 피해·위력 필드를 계산해 보내지 않는다. (이력: 정정 전 화면은 `dmgRange(slotPow(...))`로 방어·상성·치명·방어막 흡수 전의 위력을 그렸다 — 현행 아님.)
- `usable`은 서버가 합법성 검사에 쓰는 것과 **같은 함수의 결과**이므로 버튼 상태와 서버 수락/거부가 일치한다. 규칙 사본은 서버에도 클라이언트에도 추가하지 않았다.
- 동료 본체 공격력은 엔진 실제 값 **16**을 그대로 보낸다(`mkPiece`; `ALLY_BASE` 표 18/14는 복원하지 않음 — 표·엔진 불일치는 [기획 필요] 별도 확인).

## 공개 범위 영향 (확정 — P1)

상대가 **지금 싸우는 전투원 한 개체**의 기본 6스탯과 등급을 전투 동안 본다. 방어·속도로 역할을, 대리 출전 개체의 성장 정도(등급 하한)를 추론할 수 있다 — CJ "상대도 공개" 지시의 전투 한정 해석이며 "공개 정보 동일"이 아니다. 전투가 끝나면 `battle`과 함께 사라진다.

## 검증 (각 1회 · 같은 실행의 출력과 종료 코드)

`cd server && node authoritative/test/<name>.js`

| 테스트 | 결과 | exit |
|---|---|---|
| test-combat-stats-boundary (수정) | 684 passed, 0 failed | 0 |
| test-public-authority-delta (수정) | 40 passed, 0 failed | 0 |
| test-issue292-art (수정) | 56 passed, 0 failed | 0 |
| test-security-gaps (회귀) | 104 passed, 0 failed | 0 |
| test-issue234-boundary (회귀) | 81 passed, 0 failed | 0 |
| test-issue235-boundary (회귀 · 무수정 — 상대 `syn*` 은닉 유지) | 37 passed, 0 failed | 0 |
| test-issue241-boundary (회귀) | 74 passed, 0 failed | 0 |
| test-battle-fx (회귀) | 1801 passed, 0 failed | 0 |
| test-runtime-contract (회귀) | 80 passed, 0 failed | 0 |
| test-issue237-economy | **미실행** — 이 WorkTree에 `ws` 모듈 미설치(`Cannot find module 'ws'`), 단언 0개 실행 | 1 |

신설 단언(3b·292): 일반 ⭐2 본체(1등급 표보다 큰 실제 값)·전설 본체(`L-DRAGON`, atk≠0)·동료 본체(16)·가방 대리 ⭐2/전설 — 양 좌석, ⭐2·전설·가방은 재연결 뒤 재확인. 숫자 0 → 0, 누락/NaN/Infinity → `null`(키 유지). `afterBurrow`(쿨 0·조건 미충족 false → 다음 라운드 true), `once`(사용 뒤 쿨 0·false). 상대 쪽 `usable`·uid·내부 상태·`syn*` 부재. 상대 전투원 **등급은 이제 공개**다(아래 정정분 단언 — 실제 값 일치).

### 2026-10-02 CJ 정정분 재실행 (수정한 3개만 각 1회 — 위 표의 해당 3행은 이력, 나머지 6행은 무변경이라 재실행하지 않음)

| 테스트 | 결과 | exit |
|---|---|---|
| test-combat-stats-boundary (수정 — 전투 `grade` 금지 → 실제 값 단언: ⭐1·⭐2 본체·동료 null·양 좌석·재연결) | 714 passed, 0 failed | 0 |
| test-issue292-art (수정 — 가방 대리 출전 `grade` = 출전 개체 등급, 본체 동료는 등급 없음) | 64 passed, 0 failed | 0 |
| test-battle-fx (수정 — T18 `battle.a` 의 grade 금지만 해제, FX scene 의 grade 금지 유지) | 1842 passed, 0 failed | 0 |

보드 경계 단언(미공개 말 등급 없음·공개 말만 등급)은 수정하지 않았고 위 boundary 실행에서 그대로 통과했다. FX `scene` 에는 등급을 싣지 않는다(engine.js 무수정).

## 남은 일 · 미확정

- 위 `ws` 미설치 실패는 당시 WorkTree 의 **이력**이다. 의존성이 설치된 환경에서의 실행은 **CI 대기(미실행)** 이며 통과를 주장하지 않는다. `ws` 의존 스위트(237 경제 등)와 필수 CI 6개는 의존성이 설치된 환경에서 Mercury/CI가 1회 확인해야 한다.
- 2026-10-02 최종 문서 정정(Jupiter_1 · task_8b0f000ccd2f): `room.js` **주석 2곳**과 이 문서 문구만 고쳤다(`null` → `—`, 상대 스킬 회선/화면 구분). 실행 식 무변경이라 테스트를 다시 돌리지 않았고 위 결과를 그대로 쓴다. 이 변경이 그 스위트를 깨뜨린다는 근거는 없다(추론: 237의 스탯 금지 정규식은 보드 `units`만 본다).
- Mars의 `netSynthFighter`/`battleModal` 소비, Saturn 독립 QA, CJ 플레이 QA는 이 기록 범위 밖이다.
- Git·GitHub·Notion 쓰기 없음.
