# v0.4.4 Issue #91~#96 기술 분석 — Mars 재검증본

- 역할: **Mars** (instance=Mars · instance_index=null · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- 작성: 2026-09-07 · 브랜치 `fix/91-reserve-minion-art` · 기준 `demo/index.html` @ dev `eff5c16` (+ PD 문서 커밋 `0551dee`)
- 입력: 이전 Mars 세션(ctx_ea162852b020)의 참고 분석은 절대경로 산출물이라 PD가 role_scope_mismatch로 반려했다. 이 문서는 그 내용을 **입력으로만** 읽어 저장소 상대 경로로 다시 납품한 것이다.
- 표기: **[직접 확인]** 이번 세션에서 코드·실행으로 다시 확인 / **[참고 분석]** 이전 세션 분석을 옮겼고 이번 세션에서 실행·계산으로 재확인하지는 않음 / **[기획 필요]** Venus·PD·CJ 결정 대기.
- 상위 계약: `docs/v0.4.4-gameplay-spec.md`(PD 채택)가 이 분석보다 우선한다. 아래 라인 번호는 #91 구현 후 파일 기준이다(#91 편집으로 `artOk` 이후 라인이 +14 이동).

---

## #91 공용/적 포획 하수인 대리 출전 아트 — 구현 완료 (별도 보고서 `docs/qa/issue91-mars.md`)

### 원인 [직접 확인]
| # | 위치 | 사실 |
|---|---|---|
| 1 | `tryCapture` | cap 객체에 종 정체 필드가 없었다 (속성 무작위 + `archSkills("std",el)`) |
| 2 | `finishByCapture` | `arch=archOf(loseP)` 를 계산만 하고 저장하지 않았고 원래 `rosterId` 도 저장하지 않았다 |
| 3 | `battleModal.token` | `const dir=pf===piece?artDirOf(piece):null;` — 대리 출전(`pf!==piece`)을 의도적으로 null 처리 |
| 4 | `artDirOf` | `p.type==="minion"&&p.rosterId` 요구 → cap 객체는 `type` 이 없어 어차피 null |
| 5 | `smoke_minion_art.js` G9 | 위 코드 문자열을 정규식으로 고정 → 행동 기반으로 치환했다 |

### 이전 분석 대비 정정 [직접 확인]
- 이전 분석은 cap 에 `rosterId` 를 직접 넣자고 했다. v0.4.4 규격 1장은 전투 규칙(`archOf`→`skillParamsOf`)이 `rosterId` 를 읽으므로 **표시 전용 필드**를 쓰라고 했고, 이번 구현은 `artRosterId` 를 채택했다.
- 실제 도달성: cap 은 항상 `skills`(4슬롯)를 가지므로 `__actCore` 에서 `execSlot` 경로만 탄다. `skillParamsOf`/`tryStatus`(`archOf` 소비자)는 `kind==="skill"&&!f.skills` 인 레거시 경로 전용이라 cap 에는 도달하지 않는다. 즉 `rosterId` 를 넣어도 오늘의 전투 수치는 바뀌지 않지만, 규격대로 분리하는 편이 규칙 위생상 옳다. K7 테스트가 `archOf(cap)===null` 과 로그 완전 일치를 고정한다.
- 원래 종을 모르는 적 포획(로스터 미배정 하수인)은 `artRosterId:null` 로 두고 임의 종으로 가장하지 않는다 (K2c).

---

## #94 상대 턴 메모 — 게이트 2곳이 차단

| 위치 (현재 라인) | 사실 | 확인 |
|---|---|---|
| `onCellCore` :1010 `if(S.phase!=="play"\|\|S.battle\|\|isAI(S.current)) return;` | PVE AI 턴 클릭 전부 차단 | [직접 확인] 앵커 존재 |
| `netAction` :2747 | 온라인 `netActor()!==NET.me` → 토스트 후 return (onCellCore 도달 전) | [참고 분석] |
| `onCell` :2800 `netAction({t:"cell",r,c})` | 모든 셀 클릭이 네트워크 송신 경로 — 메모는 뷰어 전용이므로 상대 턴 메모를 이 경로에 태우면 안 됨 | [직접 확인] 앵커 존재 |
| `memoModal` :2463 | `humanViewer()` 기준이라 턴 무관 동작 가능. `NET.replaying` 가드 존재 | [참고 분석] |
| `renderSide` | `if(!isAI(S.current))` → AI 턴에 메모 목록 숨김 | [참고 분석] |

최소 패치 [참고 분석]: `onCell` 에 로컬 전용 분기(내 턴 아님 · 보이는 미공개 적 클릭 → `memoModal`, 네트워크 미송신) · 메모 버튼 `close()` 를 피커가 열려 있을 때만 닫도록 가드(전투 모달 덮어쓰기 소프트락 방지) · `renderSide` 조건을 뷰어 기준으로. 핫시트는 범위 밖. 리스크 낮음.

---

## #93 온라인 2P 시점 — 렌더 순서만 뒤집는다

| 위치 | 사실 | 확인 |
|---|---|---|
| `renderBoard` :656 | `r=1..13, c=1..7` 고정 순서 DOM 생성 · 셀 `dataset.r/c` 와 `onclick` 클로저는 논리 좌표 | [직접 확인] 앵커 존재 · 순회 내용은 [참고 분석] |
| `applyNetSetup` :2858 | P2 배치는 `r→14−r`, 열 동일 미러링 → 배치 화면은 이미 "내 진영 하단" | [참고 분석] |
| `battleModal` `mySide` | `NET.me` 기준이라 전투 화면 문제 없음 | [직접 확인] (#91 작업 중 같은 코드 확인) |

권장 [참고 분석]: 행만 뒤집기(세로 미러) — 배치 미러링이 열 동일이므로 180° 회전은 좌우가 반전된다. `const flip=NET.mode&&NET.me===1` 로 DOM 순서만 바꾸고 CSS transform 은 쓰지 않는다(헤드리스 검증 가능). 좌표 텍스트 4곳(메모 목록·메모 제목·도망 교체·밀어내기 메시지)의 표기 기준은 **[기획 필요 — 경미]**. #94 뒤에 rebase.

---

## #95 공격형 연속 공격 — 순서는 규격, 폭발력은 수치

- `actorOfPhase` :1344 — 홀수 라운드 공격자 선공, 짝수 라운드 방어자 선공, 감전 반전 → 라운드 경계마다 직전 후공자가 2연속 행동(양측 공평). GDD-13 4.6 확정 규칙이므로 순서 변경은 CJ 사안. [직접 확인] 앵커 존재 · 순서 해석은 [참고 분석]
- 공격형 수치 [참고 분석 — 계산 재실행 안 함]: `slotPow=round(pow×atk/22)`, 공격(atk 26) 슬롯1 고위력 45(불) + 결정타(`sig_atk` :308 pow 44) 52 = 2연속 97, 집중 시 106, 상성 1.3 시 138 → 만HP 100 을 응수 없이 제거 가능.
- 후보 [참고 분석]: A) ROSTER 공격형 4종 `atk 26→24`(권장, 최소 diff) B) `sig_atk.pow 44→38` C) `selfVuln 0.15→0.25` D) 집중 1.2→1.15(하드코딩 4곳). AI 는 `slotPow` 동적이라 무변경. **[기획 필요]** 값 확정 — v0.4.4 규격이 채택한 값을 따른다.

---

## #96 감전 확률 — 상수가 3개 상태이상 공용

| 경로 | 위치 | 확률 | 확인 |
|---|---|---|---|
| 4슬롯 효과기 `lightning_effect` :297 | `execSlot.gate` :1524 → `applyStatus(false)` | `BAL.statusProb` :253 = 0.7 (화상·약화와 공용) | [직접 확인] 앵커 존재 |
| `sig_sustain`(번개) | `applyStatus(true)` | 100% · shock=1 하드코딩 | [참고 분석] |
| 레거시 `__actCore('skill')` | `tryStatus` | sustain 100% / 그 외 0.7, 지속 라운드가 4슬롯 경로와 불일치 | [직접 확인] (#91 도달성 분석에서 같은 코드 확인 — 로스터 미배정 하수인 전용) |

최소 패치 [참고 분석]: `BAL.shockProb` 신설 → `gate(force,prob)` 로 번개 분기만 별도 확률 · 레거시 `tryStatus` 도 동일 분기 · `desc` 문자열 동적화. 별도 BAL 키를 쓰는 이유는 `smoke_cycle5.js` 가 `BAL.statusProb=1` 로 결정화하기 때문. 감전의 순서 효과는 "라운드 선공자가 부여했을 때만 실효" — Venus 가 실효 조건을 명시하면 좋다. **[기획 필요]** 값. #92 와 같은 블록이므로 #96 먼저.

---

## #92 탐색 → 다른 속성 기술 획득·교체 — 설계 의존, 마지막

- 현재 [참고 분석 + 앵커 직접 확인]: `doSearch` :1193 의 recruit 분기가 "[임시 대체]" 보조기 슬롯2 교체 · `SKILLS` 에 속성 필드 없음(id 접두사만) · `execSlot` 상성·상태가 `f.element`(본체) 기준이라 교차 속성 미지원이 근본 · AI 2곳도 본체 속성 기준.
- v0.4.4 규격 2장이 계약을 채택했다(슬롯0/1 교체 후보 모달 · 기술 속성 판정 · 포획 승계는 실제 `skills` 복사 — **#91 PR 에는 넣지 않고 #92 PR 에서**). 이 분석의 "Venus 에 넘길 질문" 목록은 규격으로 대체됐으므로 여기서는 반복하지 않는다.
- 골격 [참고 분석]: `skillEl(id)` helper(데이터 무변경) → `execSlot` 의 공격 속성=기술·방어 속성=본체 분리 → recruit 후보 모달 → AI `mult`/`statusKey` 슬롯별 계산 → `rand()` 호출 수 변화로 시드 고정 sim 기준선 갱신 필요(버그 아님). 리스크 높음.

---

## PR 순서 · 격리 [참고 분석, 라인은 현재 기준으로 갱신]

| 순서 | 편집 영역 | 겹침 |
|---|---|---|
| #91 (완료) | `artOk` 앞 helper · `tryCapture` · `battleModal.token` · `finishByCapture` · minion_art 테스트 | 독립 |
| #94 | `renderSide` · `memoModal` :2463 · `onCell` :2800 · memo 테스트 | #91 과 무겹침 |
| #93 | `renderBoard` :656 · 좌표 텍스트 4곳 · `netStart` 문구 · online 테스트 | `memoModal` 인접 → #94 뒤 rebase |
| #95 | ROSTER 4줄 또는 `sig_atk` :308 | 독립 |
| #96 | `BAL` :253 · `lightning_effect` :297 · `tryStatus` · `gate` :1524 · cycle5 테스트 | 독립 |
| #92 | `SKILLS` · `archSkills` · `doSearch` :1193 · `execSlot` · AI 2곳 | #96·#95 와 같은 블록 → 마지막 |

단일 HTML 이므로 이슈당 브랜치를 최신 dev 에서 **순차 분기**(직전 squash 병합 후 다음 분기)하면 동시 편집이 없다.

## 문서 반영 위치 (Venus/PD 소관 — Mars 는 제안만)
| 이슈 | 문서 | 내용 |
|---|---|---|
| #91 | `docs/minion-visual-spec-v0.4.3.md` rev8 6.3·7.10 (PD 커밋 `0551dee` 에 반영됨) · GDD-13 4.8/9장 | 포획 하수인 외형 정체(중립=속성 표준형, 적=원래 종)·`artRosterId` 표시 전용 |
| #93 | GDD-13 6장 UI · 4.1 | 온라인 뷰어 상대 시점 · 좌표 표기 결정 |
| #94 | GDD-13 6장 메모 | 상대 턴 편집 허용 · 전투 중 제외 |
| #95 | GDD-15 스탯 예산 · GDD-16 3장 · DATA | 공격형 수치 전후 표 |
| #96 | DATA D10/D15 · GDD-14 5.3 | 감전 별도 확률 · 실효 조건 |
