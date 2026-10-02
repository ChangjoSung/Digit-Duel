# #296 "배틀" Flow UI/UX — Mars 구현 기록

- 2026-10-02 · Mars_1(구현) → Mars_2(같은 터미널 후속 통합) · `claude-opus-5-5` / high / `--dangerously-skip-permissions`(자기 프로세스 PID 26212 인수로 확인) · Ponytail full
- 기준 HEAD `e48a8aa` · WorkTree `issue-296-battle-flow` · Git 명령 0회(읽기 포함) · GitHub/Notion 쓰기 0 · 새 의존성 0
- 기준 문서: [구현 전 최종 보고](../Mercury/pre-implementation-report.md) + **2026-10-02 CJ 정정**(구현 중 도착 — 아래). 정정이 보고서와 다르면 정정이 우선한다.
- CJ 콘티 원본 `references/CJ_CONCEPT_CONTI_20261002.png` 를 직접 열어 대조했다(SVG 제안만 본 것이 아니다).

## CJ 정정(2026-10-02) — 최종 적용 범위

| 정정 | 구현 |
|---|---|
| 내 전투 = #294 스킬 설명 **+ 미해금 잠긴 소개 줄** | 내 스킬 줄마다 `SKILLS[].desc` 원문이 줄 안에 보인다. 내 종이 더 높은 등급에서 여는 스킬은 `unitSkillRows`(#294) 그대로 `🔒 이름 — ★n 필요` + 설명, 읽기 전용(명령 없음). |
| **상대 스킬은 어디에도 없음**("?" 자리표시도 없음) | 상대 차례의 싸우기 영역 = 안내 한 줄뿐. 정보 패널의 스킬 이름 줄도 삭제(양쪽 모두). 서버가 공개 기술을 실어도 그리지 않는다. 전투 메시지(공개 로그)는 그대로다. |
| 상대 = 실제 등급 · 이름 · HP · 방어막 · 기본 6스탯 · 디버프 | 양쪽 패널이 같은 틀. 등급 ★ 는 실린 정수(전설 = 5)만 — 왕/동료처럼 등급이 없으면 ★ 를 만들지 않는다. |
| **계산한 위력/범위 UI 전부 삭제** | `dmgRange` 호출 3곳(기술 칸 · 기본 공격 · 구형 스칼라 스킬) 삭제. `0~0` 이 나올 자리 자체가 없다. 고정 설명(`💪🏻 80%` 등)은 유지. |

종전 PD 해석(상대 공개 기술 표시 · '위력' 범위 · `?` 표기)과 내 1차 구현은 이 정정으로 대체했다.

## `0~0` 원인과 조치

- **재현 조건(정적 확정 + 헤드리스 회귀 P1·P10·P11)**: 온라인 전투 뷰에 공격력이 없을 때 — 전설 본체(`L-*` 는 `ROSTER` 에 없음), 가방 대리 출전, (0 은 아니지만) 2~4등급 본체가 1등급 표 값.
- **근본 원인**: 서버가 `atk` 를 생략 → `netSynthFighter` 의 불완전한 복원 → `effAtk` 의 `||0` → `dmgRange(0)`.
- **영향**: 표시 전용. 공개 방 판정은 서버 Core 가 실제 전투원으로 낸다(클라이언트는 의도만 전송). Core/서버 판정 코드는 건드리지 않았다.
- **조치**: ① `netSynthFighter` 의 1등급 표 · `BAL` · cap/reserve 복원을 **삭제**하고 서버가 실은 유한한 값만 옮긴다 ② 범위 표기 자체를 삭제 ③ 스탯 칸은 누락/`null`/`NaN` = `—`(정보 없음), 진짜 0 = `0`.
- CJ 제보 장면의 모드 · 전투원은 기록에 없어 "그 화면이 이 경로였다"는 **추론**으로 남는다.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `demo/js/network.js` | `netSynthFighter`: 서버 `atk·def·spd·dodge·crit·statusPct`(유한 값) · `grade`(정수) · `skills[i].usable` 소비. 복원 분기 삭제. fx 의 현재 방어막 숫자(`shtxt-`) 갱신 |
| `demo/js/ui.js` | `battleModal` 재배치(아래) · `battleStatHtml` · `battleSlotOk`(온라인: 서버 `usable` 만 — 누락이면 잠금(fail-closed) / 오프라인만 기존 Core `slotUsable`) · `battleSynChips(…,row)` + `legendChipHtml` 공용화 · ⓘ 토글(`uiSkillInfo*`) 삭제 |
| `demo/css/game.css` | #296 블록(상단 줄 · 발판 색 · 6스탯 칸 · 스킬 줄 · 가방 줄) · 무대 높이 288→312 · `.skillInfo*` 삭제 · 이모티콘 자리 선택자 |
| `demo/test/regression/` `smoke_public_rooms` `smoke_attack_balance` `smoke_cross_skill` `smoke_fx_consumer` `smoke_issue238` | 아래 "회귀" |
| `demo/test/browser/run_public_e2e.js` | 전투 구간의 ⓘ 클릭 프로브 → 줄 안 설명 표시 확인으로 치환. 1회 실행했으나 그 앞 타이틀 단계에서 멈춰 이 구간은 실행되지 않았다(아래 검증) |

서버 · Core 엔진(`core.js`·`data.js`·`state.js`·`server/`) 수정 0.

## 화면 — 콘티 대응

| 콘티 | 구현(기존 부품) |
|---|---|
| 상단 `나 vs 상대 · 배틀중 · 💬 ⚙` | `topBarHtml`(#294) + "배틀 중" + 감정표현 자리 + `gearHtml`(온라인 = 기존 기권 버튼, 오프라인 = 자리만). 사운드 기능 신설 없음 |
| 첫째 줄: 차례 + 왕국 · 개인 시너지 | `battleSynChips(…,"k")` — **참전 확정 때 고정된 스냅샷** `B.syn`(온라인 `ownSyn`)과 상수표만 읽는다. Core `applySynergy` 와 같은 갈래: 전설은 왕국 칩 없음(용만 달성한 최고 왕국을 개인 효과로) · 개인 칩 = **지금 싸우는 전설**(필드 본체든 보드에 없는 가방 대리든) · 효과 0 이면 칩 없음. 지금 보드(`synExtraView`)는 읽지 않는다. 스냅샷이 없으면 칩 없음 |
| 둘째 줄: 라운드 + 내 60초 + 아키타입 | 아키타입 합은 참전자 전원(왕 · 동료 본체 포함 — Core 와 같다). 시계 칸은 화면 주인의 차례에만. 상대/AI 차례는 `⏳ 상대 응답 대기`뿐(상대 시계 없음). 핫시트는 기기를 든 행동자 기준 |
| 무대: 상대 정보 좌상 · 상대 그림 우상 · 내 그림 좌하 · 내 정보 우하 | 기존 `.bslot`/`token()` 그대로(실제 `battle.png` · 실패 시 기존 대체). 발판 = 전투원 속성색(전설 `--g5`, 없으면 종전 색) |
| 패널: 등급/이름/주인 · HP+방어막 한 줄 · 스탯 두 줄 | `★ 이름 (주인)` / `HP n/m · 🛡 현재 방어막` / 3×2(공격 · 방어 · 속도 / 회피 · 치명 · 상태 부여) / 상태 아이콘 |
| 전투 상황 메시지 | `#msgBox` 불변 |
| 스킬 · 가방 · 포획 · 도망 · 뒤로 | 스킬 = 한 줄 한 스킬 + 설명. 가방/패키지 = 이름 + 설명이 버튼 안에. 포획 · 도망 확률/규칙 · 뒤로(전송 0) 불변. 새 미니게임 · 사운드 · 아트 없음 |

**그림 아래 라벨**: 종전 속성/종류 라벨(기존 자산 라벨 계약 · `smoke_minion_art` K3d~K5b)을 그대로 둔다. 최신 지시의 등급 · 이름은 그림 바로 옆 패널 머리에 있어 충족된다 — 미해결 항목이 아니다. 등급 ★ 는 실제 현재 등급이 있을 때만(왕 · 동료는 없음).

## 정보 경계 (온라인 · PVE · 핫시트 공통)

- 상대에게 보이는 것: 이름 · 등급(실린 경우) · HP · 현재 방어막 · 기본 6스탯 · 적용된 상태 · 적용된 버프(기존).
- 보이지 않는 것: 상대 스킬(이름 · 수 · 쿨 · 사용 가능 여부) · 상대 시너지 칩 · 상대 가방/패키지/볼 · 상대 행동 시계. 내 `synAtk` 는 더 이상 어떤 표기에도 쓰이지 않는다.
- 6스탯은 시너지 · 일시 효과를 **뺀** 기본값이다. 오프라인도 같은 여섯 칸만 그린다.

## 서버 계약 (Jupiter 납품 — 현재 `room.js` 에서 직접 확인)

- `server/authoritative/room.js:2141·2151` `num(v)=Number.isFinite(v)?v:null` → `atk·def·spd·dodge·crit·statusPct` 를 `battle.a/d` **양쪽**에(0 은 0, 누락 · 비유한만 `null`).
- `room.js:2155` `grade: Number.isInteger(f.grade)?f.grade:null` — 지금 싸우는 개체(대리 포함)의 실제 등급, 양쪽.
- `room.js:2125~2132` `_skillsFor(T,p,mine,side)` — **진행 중 전투의 자기 전투원 칸에만** `usable: !!T.slotUsable(p,i,side,T.S)`. 상대 칸에는 키가 없다. `onceUsed`·`burrowRound` 원본은 싣지 않는다.

클라이언트 소비: `netSynthFighter` 가 위 값만 옮긴다(`null` → `—` / ★ 없음). **공개 방에서 `usable` 이 없는 칸은 잠근다**(`battleSlotOk` — `NET.publicMode` 면 Core 규칙으로 추정하지 않는다: 합성 전투원에는 1회 사용 · 잠복 기록이 없다). 오프라인만 기존 Core `slotUsable`.
(1차 보고의 "아직 `room.js` 에 없다"는 내가 본 시점의 상태였고 지금은 사실이 아니다 — 위 줄로 치환한다.)

## 검증 (현재 소스 기준)

**헤드리스 회귀(종료 코드 같은 실행에서 수집 · Node 24)** — 1차 작업의 마지막 실행에서 22개 exit 0: `attack_balance 54` `cross_skill 86` `fx_consumer 133` `issue146 218` `issue233 310` `issue234 354` `issue235 122` `issue238` `issue241 86` `issue245 352` `issue263_client 186` `minion_art 208` `public_rooms` `search_packages 302` `shock 67` `turnflow 203` `tutorial 139` `issue293 140` `issue236 299` `issue295 65` `online 159` `online_art 105`.
**후속(시너지 selector · 온라인 usable 잠금) 뒤에는 영향받는 두 파일만** 다시 돌렸다: `smoke_issue238` **186 / 0**(exit 0 · 1회) · `smoke_public_rooms` 1회째 exit 1(P1 · P9 — 픽스처에 서버가 언제나 싣는 `usable` 이 없었다) → 픽스처 보정 + P17 추가 뒤 **207 / 0**(exit 0). 나머지 20개는 이 변경이 닿지 않아 재실행하지 않았다(직전 결과 재사용).
재실행 이력(1차): 19개 1회 → 실패 5개만 → CJ 정정 뒤 19개 1회 → 실패 3개만 → 패널 스킬 줄 삭제 뒤 21개 1회 → `cross_skill` 1개. 모두 코드 변경 또는 실패가 사유다.

단언: `smoke_public_rooms` P1~P17 · L5h · L15 · L17 / `issue238` F9~F11c · K31 / `attack_balance` D1~D5 / `cross_skill` E1~E3 / `fx_consumer` J1·J2·K4 —
누락(`—`) vs 진짜 0 · 전설 본체 · 2등급(서버 값/등급) · 가방 대리 · 비피해 기술 · 잠긴 줄 수와 설명 · 상대 스킬 부재(공개 기술을 실어도) · 상대 등급/6스탯/방어막/상태 · 서버 `usable`(일부 · 전부 잠김 = [턴 종료]) · **공개 방 usable 누락 = 전부 잠김(P17)** · 내 차례에만 시계 · 범위 문자열 부재 · **가방 대리 마녀/사신 개인 칩 = 고정 스냅샷 값, 전설에 왕국 칩 없음, 일반 전투원에 개인 칩 없음, 왕 · 동료 본체의 아키타입 칩(F11~F11c)**. #95 수치 계약은 화면이 아니라 Core 파생값으로 계속 고정.

**타입 검사** — `npm ci`(루트 · 기존 lockfile, `package.json`/lock 무변경) 뒤 `npm run typecheck` 1회: **exit 0**.

**온라인(실서버) — 각 1회**
- `demo/test/integration/smoke_public_live.js 2`(CI B 잡 · 실제 `server.js` + 클라이언트 2개 · 실제 ws): **23 / 0 · exit 0** — 2경기, 전투 프레임 327, 전투 행동 164, 클라이언트 예외 0. 새 전투 뷰(6스탯 · 등급 · usable)를 받아 `battleModal` 이 예외 없이 그려진다는 증거다. 이 스모크는 칸 선택을 UI 가 아니라 자기 `slotUsable` 로 하므로 **서버 `usable` 이 버튼 잠금으로 이어지는 것은 P14·P15·P17(헤드리스)만** 증명한다.
- `demo/test/integration/smoke_public_eco_live.js`(CI): **54 / 0 · exit 0**(경제 판 실서버 · 전투는 다루지 않는다).
- `demo/test/browser/run_public_e2e.js --minutes 10`(실브라우저 Edge 2개): **exit 1 — 전투에 도달하지 못했다.** `host title → lobby` 15초 타임아웃: 스크립트가 타이틀에서 `대전 시작` 버튼을 찾는데 현재 타이틀 버튼은 `시작 →` 이다(이후 로그인 · 로스터/배치 단계도 #259·#293~#295 이전 흐름). #296 변경과 무관한 **기존 스크립트 노후**이며 이번 범위에서 흐름 전체를 다시 쓰지 않았다. 실브라우저 온라인 증빙이 필요하면 이 스크립트의 진입 흐름(타이틀 · 계정 · 시작 상점 · 배치)을 현행 화면에 맞게 갱신하는 별도 작업이 필요하다. 내가 고친 전투 구간(ⓘ → 줄 안 설명 확인)은 그래서 **실행된 적이 없다**.

**실제 렌더(헤드리스 Chrome · CDP · `file://` · 오프라인 PVE)** — 320×720 / 390×844 / 1280×900, 수정 전(패치를 거꾸로 적용한 사본) · 후 각 3장면(루트 · 싸우기 · 가방) + 390 상대 차례. 실측: 가로 넘침 0 · 패널끼리/패널↔그림 겹침 없음(무대 312px) · 보이는 버튼 최소 44px · 스킬 4줄(잠긴 줄 3 · 설명 4) · 실제 `battle.png` 128px 로드 · 상대 차례에 `__act` · 시계 없음. 이 18+1장은 후속 변경(전설 칩 selector · 온라인 잠금)이 닿지 않는 장면이라 다시 찍지 않았다.
후속 대표 1장면(390): **왕의 대리로 나온 가방 마녀**(보드에 없는 개체) — 칩 `마녀 개인 시너지 — 상태 부여 확률 +15%`(스냅샷 속성 3종 × 5%) + 아키타입 2개 · 왕국 칩 없음 · 머리 `★★★★★ 대리 마녀` · 6스탯 32/12/13 · 10%/5%/25% · `legend_witch/battle.png` · 스킬 4줄 설명 4 · 잠긴 줄 0 · 범위 문자열 없음 · 넘침 0. (엔진 `synStatusPct` 0.25 = 아키타입 합 0.10 + 개인 0.15.)

**산출물(저장소 밖 · 터미널 해제 뒤에도 남는다)** `C:/Users/pc_77/orca/artifacts/Digit-Duel/issue-296/implementation-visual/`
- `{before,after}_{320,390,pc}_{1_root,2_fight,3_bag}.png` · `after_390_4_foe_turn.png` · `report.json` — scratchpad 원본과 SHA-256 일치 확인(19 PNG + JSON, 불일치 0).
- `after_390_5_bag_legend_root.png` · `after_390_6_bag_legend_fight.png` · `report_bag_legend.json`
- `smoke_public_live.log` · `smoke_public_eco_live.log` · `e2e/run.log`(exit 1) · `e2e/*_zz_fatal_*.png`(타이틀에서 멈춘 화면) · `e2e/result.json`

**한계**
- 실브라우저 온라인 전투 화면은 본 적이 없다(위 e2e). 감정표현 버튼이 전투 상단 자리에 놓이는 것도 온라인 전용이라 렌더 미확인.
- 320px: 6스탯 칸 `scrollWidth` 가 칸보다 1~2px 크게 측정된다(캡처상 글자는 읽힌다).
- 2등급 · 필드 전설 본체 · 용 개인 칩의 실제 렌더 캡처는 없다(헤드리스 단언으로만).
- 마녀 · 사신 개인 효과 식은 Core 와 같은 한 줄 사본이다(엔진 무수정 범위 · `ponytail:` 주석). Core 값이 바뀌면 상수표(`V2_LEGEND_SYN`)는 따라가지만 식 구조 변경은 따라가지 않는다.
- 정식 QA 판정은 Saturn 소관이다. 전체 CI · 밸런스 시뮬레이션은 돌리지 않았다.

## 기획 반영 필요(Venus/Mercury)

GDD-23 7.9 · GDD-24 00.7: 전투 한정 상대 기본 6스탯 · 등급 공개, 상대 스킬 비표시, 위력 범위 삭제, v0.4.10 ⓘ 설명 버튼 → 줄 안 설명으로 대체.
