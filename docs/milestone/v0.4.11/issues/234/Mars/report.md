# #234 하수인 30종 · 전설 · 왕 · 동료 스킬 — Mars 구현 보고

2026-09-17 · Mars(Client, `claude-opus-5`) · dispatch `ctx_ae36d0f2c18a` · 명세 `C:/dd_cdp/issue-234-mars-spec.md` · 기획 GDD-23 사본 `C:/dd_cdp/issue-234-gdd.md`
Preflight: required_role=Mars · mode=IMPLEMENT · area=CLIENT/HTML · mutation=code · instance_index=null

**Mars는 자기 구현의 QA 판정을 내리지 않는다.** 아래는 실행한 검사와 결과뿐이다. #122 2차 전례대로 Claude 백업 QA와 CJ 플레이 QA가 판정한다.
Git·GitHub·Notion 쓰기 없음. `server/`·`roblox/`·`unity/`·`art/`·`orca-hook-latency-report.md` 수정 없음.

---

## 1. 한눈에 보기

| 항목 | 결과 |
| --- | --- |
| 신규 집중 검사 `demo/test/regression/smoke_issue234.js` | **290 pass / 0 fail** (최종 실행) |
| CI 잡 A 클라이언트 스위트 27개 | 전부 green (첫 실행에서 18개 통과 · 8개 실패 → 회귀 갱신 뒤 해당 스위트만 재실행) |
| 제품 결함 자체 발견·수정 | 2건 (§6) |
| 기존 회귀 갱신 | 8개 파일, 모두 GDD-23 또는 CJ 결정 근거 (§7) |
| 해석 11건 | Venus 판정 반영 — Q1 CJ 결정 · Q2·Q9·Q11(굴 파기) 확정 · 나머지 [설계 보완 — CJ 승인 대기] (§4) |

---

## 2. AC 대조표 (Issue #234 · 명세 2장)

검사는 모두 실제 엔진 경로(`execSlot → execV2 → resolveHit` · `nextPhase` · `finishBattle` · `__fleeCore` · `aiBattleAction`)로 몰아서 본다.
GDD 6.3 · 6.4 · 6.2 표는 **검사 파일 안에 따로 옮겨 적고** 제품 데이터와 대조한다(제품 데이터에서 기대값을 만들지 않는다).

| AC | 내용 | 검사 ID | 결과 |
| --- | --- | --- | --- |
| 1 | 일반 30종 = 5속성 × 6아키타입, 6.3 이름 그대로 | A1 · A1b · A2(30칸) · A3(3.3 ❤️💪) | pass |
| 1 | 일반 120 스킬 이름 (30종 × 4) | A4 · A6 | pass |
| 1 | 1차 기본기 30 · 2차 골격 30(감전 예외 50/100/30 · 방어형 경화 10% · 보호형 방어막 12%) | A5 · A7 | pass |
| 1 | 3·4차 60개의 💪% · ⌛ · 전투당 1회 | A8 · A9 | pass |
| 1 | 전설 12 스킬(이름·위력·⌛·봉인형·중립) · 전설 스탯 21값(3.6) | A10 · A11 · A12 · A13 | pass |
| 1 | 왕 · 암살자 · 방패병 스킬 18개 + 🪄 2개(6.2 · 5.3) | A14 · A15 | pass |
| 1 | **132 + 왕·동료 17 스킬 전부가 실제 전투 동작에 연결** | A19(149개 전부 execSlot 실행·효과 흔적) + M절 스킬별 동작 단언 120개 | pass |
| 2 | ⭐N = 1~N차 · 등급 상한 4 · ⭐4 스탯 | B1 · B2 · B3 | pass |
| 2 | 전설 ⭐5 고정 · 4스킬 · 아키타입(용=표준 · 마녀=지속 · 사신=공격) | B4 · B5 · B6 | pass |
| 2 | 경기 시작 ⭐1(기본기 1개) · 왕 2칸 · 동료 2칸(암살자·방패병) | B7 · B8 · B9 · B9b | pass |
| 2 | 왕·동료 속성 미선택 규칙(최다 속성 · 동률 🔥→💧→⚡→🗻→🌿) | B10 · B11a~d | pass |
| 2 | 동료 사망 → 왕·동료 3칸(🪄 동료의 복수) · 2명 사망 → 왕 4칸(🪄 왕의 분노) — 실제 `finishBattle` | B12a~e | pass |
| 2 | 속성별 2차 스킬 교체 | B13 | pass |
| 2 | AI 로스터 30종 · 5속성 | B14a · B14b | pass |
| 3 | 기본기 36개 전부 💪100% · ⌛0 · 조건·HP 소모·효과 없음 · 왕·동료도 기본기 스킬 사용 | C1 · C2 · C3 · C3b | pass |
| 3 | ⌛ 증가(동결·자기장)는 기본기를 대상으로 삼지 않음 · 최소 ⌛ · 슬롯 순서 | C4a~e | pass |
| 3 | 수면 포자 — 기본기만 합법 · 스킬 사용 1회에 소모 | C5a · C5b | pass |
| 3 | **도망 실패 페널티 = 스킬 밖 예외** — 공격력 100% · ⌛ 불변 · 1회성 스킬 효과(확정 치명·피해+·위력+·고정 피해·모래바람·감전 확정) 미소모 · 흡수·상태이상·반사 없음 · 공개 기록 없음 (실제 `__fleeCore`) | C6a~g | pass |
| 4 | AI 공정 관측 — 상대의 비공개 스킬·등급·⌛만 다른 두 상태에서 5급·5단 AI 선택이 동일 | D1 · D2 (두 난이도) | pass |
| 4 | AI 합법 선택 — ⭐4 뇌격수 vs 전설 사신 AI 전투 완주, ⌛·전투당 1회·번개 발도 조건·사신의 낫 봉인 위반 0 | D3a · D3b | pass |
| 4 | AI 코드가 상대 `grade·skills·cds·onceUsed` 를 읽지 않음(정적 보조) | D4 × 5함수 | pass |
| 과도기 | 기술 교체 비활성(CJ 결정) · 포획 유지 · 포획 말 ⭐1 · 30종 후보 | E1~E5 | pass |

---

## 3. 구현 요약 (`demo/index.html`)

| 영역 | 위치 | 내용 |
| --- | --- | --- |
| 해석 상수 | `V2_INTERP` (1005행) | Venus 판정 11건을 한 곳에 모음 (§4) |
| 데이터 | `V2_SPECIES_DEF` (1046) · `LEGEND_ROSTER` (1146) · 왕·동료 등록(1170~) | 6.3 표 30종 · 6.4 전설 3종 · 6.2 왕·동료. 2차는 `V2_SKELETON` 에서 생성. 스킬은 `SKILLS` 레지스트리에 `v2:true` 로 함께 등록 |
| 로스터 | `ROSTER` | 30종. 기존 20종 id·아트 폴더 유지, M-W3 → 빙벽 정령 · M-G5 → 이끼 거인(속성·아키타입 동일 → 폴더 재사용), 보호형 4 · 땅 6 추가 |
| 주입 | `applySpecies` (1212) · `applyLegend` (1220) · `applyRoster` | ⭐N = 앞 N개 스킬. 경기 시작은 ⭐1 |
| 왕·동료 | `leaderSkillIds` (1182) · `syncLeaderSkills` · `assignLeaderElements` (1206) | 2칸 + 🪄 칸. `startRounds`(참전 확정 스냅샷) · `finishBattle`(동료 사망) 에서 동기화 |
| 실행기 | `execV2` (1367) · `v2Hit` (1394) · `V2_FX` (1425) | 스킬별 고유 동작 핸들러 64개. `execSlot` 이 v2 스킬을 넘긴다(사신의 낫 봉인 분기는 기존 그대로) |
| 상태 · 버프 | `v2Apply` (1268) · `resetV2` (1235) · `v2RoundEnd` (1544) · `v2RoundStart` (1561) | 흡수 · 속도 증감 · 회복 감소 · 이끼 잠식 · 선턴 효과 등. 5.6 부여 라운드 제외(Fresh) 규칙 그대로 |
| 피해 파이프라인 | `resolveHit` (4253) · `resolveTypedInner` · `shieldConsume` (4226) | #233 엔진에 옵션만 추가: 방어막 무시 · ⑧ 무시 · 모래바람 ⑥ · 굴 파기 ⑧ 합산 · 철벽/과부하(⑩ 뒤) · 천년목 · 층별 막은 양(축전·포자 막) · 요새 전환(소모 절반). 새 필드가 0이면 #233 결과와 같다(smoke_issue233 309/0) |
| #233 "계약만" 항목 호출처 | — | 확정 치명(조준 사격·죽음의 그림자) · 반사(빙벽 반사) · 반격(집게 반격) · 예고(해일 예고, tag `M-W5-4:tsunami`) · 즉사(사신의 낫) · 선턴 효과 `vanguardTurn`(꺼지지 않는 불티·잠영) — 모두 실제 스킬로 연결 |
| AI | `aiBattleAction` · `aiBattleActionStrong` · `aiV2SupportScore` · `aiPickRoster` (5511) | 자기 스킬 힌트만 사용. `slotUsable` 로 합법 슬롯만. 5단 상대 추정의 `opp.skills?1.18:1` 을 상수로 바꿔 상대 스킬 배열(칸 수 = 등급)을 읽지 않게 함 |
| 비공개 표시 | 전투 패널 · 커맨드 | 상대 화면은 공개된 스킬만 이름으로, 나머지는 칸 수 없이 "? 미공개" 하나로 (7.9 등급 비공개) |
| UI (최소) | 로스터 카드·정보 팝업 · 땅 색 토큰 | 30종 · ⭐별 스킬 4칸 표시. 왕·동료 본체 토큰은 속성이 생겨도 현행 👑/🤝 유지(표시 개편은 #238) |

---

## 4. 해석 11건 — 판정 분류 (Venus `docs/milestone/v0.4.11/issues/234/Venus/interpretation.md`)

| Q | 주제 | 판정 분류 | 구현 |
| --- | --- | --- | --- |
| 1 | 탐색 '기술 교체' | **CJ 결정 2026-09-17** | 비활성(`recruitSkillSwap:false`) — 선택지 닫힘, 코어 거부, AI 계획 안 함. 코드는 분기로 보존. 하수인 포획·포기는 유지 |
| 2 | 천둥 낙인 '대상 후턴' | **확정** | 사용자가 그 라운드 선턴이면 💪260% (라운드 시작 시 확정된 순서) |
| 3 | 번개 꼬리 후보 여럿 | [설계 보완 — CJ 승인 대기] | ⌛0 + 사용 조건 충족 피해 스킬, 슬롯 순서. 위력·효과 확률 60% |
| 4 | 변덕 주문 제거 · 상태이상 해제 순서 | [설계 보완 — CJ 승인 대기] | 방어막(전 층)→경화→흡수→회피↑→피해↑→속도↑ / 화상→약화→감전→균열→속도↓→회복↓→이끼 잠식. 스킬 고유 예약 효과는 대상 아님 |
| 5 | 영구 자기장 재부여 시점 | [설계 보완 — CJ 승인 대기] | 사용 다음 2개 라운드의 시작, 선턴 확정 전. 5.6 1R 감전 그대로(최대 3라운드 연속 후턴 가능 → 8.4 관찰) |
| 6 | 달궈진 껍질 · 열기 축적 | [설계 보완 — CJ 승인 대기] | 상대 피해 스킬 적중(방어막에 막혀도) · **스킬 사용 1회당 1번** · 페널티·반사·반격·지속·예고 발동 제외 · 열기 축적은 타격 직전 층 존재 기준 · 💫 가산 |
| 7 | 천년목 적용 범위 | [설계 보완 — CJ 승인 대기] (**Venus 대안, Mars 제안과 다름**) · 사신의 낫 제외는 **CJ 결정 2026-09-17** | 일반·예고·반사·반격·지속·도망 실패 페널티에 적용. **사신의 낫 즉사는 제외**(절대 판정 — REVISE 2차) |
| 8 | 과부하 방벽 · 철벽 돌파 | [설계 보완 — CJ 승인 대기] | 타격 1회 단위 · 일반·예고·반사·반격·페널티. 지속·즉사 제외. 과부하 상한은 ⑩ 뒤 ⑪ 전 · 철벽은 회피된 타격에 소모 안 됨 |
| 9 | 스킬 흡수 버프 | **확정** | 확률(+💫) 당첨 시 그 공격부터 1R, HP 피해 20% · 자기 대상이라 회피돼도 부여 |
| 10 | 환영 무도 · 수면 포자 '다음 행동' | [설계 보완 — CJ 승인 대기] | 상대의 다음 **스킬 사용** 1회에만(도망·아이템·패키지·볼 제외). 무효된 스킬도 ⌛ 소모· 사신의 낫은 두 효과를 무시(**CJ 결정 2026-09-17**, REVISE 2차) |
| 11 | 모래바람 · 굴 파기 | 모래바람 [설계 보완 — CJ 승인 대기] / 굴 파기 **확정** | 모래바람 ⑥ 별도 곱 ×0.7(그 스킬 사용의 모든 타격) · 굴 파기 ⑧ 합산(상한 50%) |

---

## 5. 과도기 경계 처리 (명세 3장)

| 경계 | 분류 | 처리 |
| --- | --- | --- |
| 시너지 집계 · 왕국/아키타입 효과 · 전설 고유 패시브 | [확정·범위 밖] #235 | 미구현. 연결점: `v2KingdomEffectOf(owner,el)`(1027) — 동료의 복수·왕의 분노가 지금은 항상 (2) 값을 쓴다 |
| 상점 · 가방 · 전직 · 전설 획득 | [확정·범위 밖] #236 | 미구현. ⭐2~4 · 전설은 데이터·엔진·AI 가 지원하고 검사에서 직접 구성 |
| 경기 시작 로스터 | [추론·과도기] | 현행 선택 흐름 유지, 후보 30종, 전부 ⭐1 |
| 왕·동료 속성 | [확정·GDD 2.2 기본값] | 미선택 규칙으로 자동. 선택 UI 없음(#236/#238). `leaderElChosen` 플래그만 준비 |
| 수풀 포획 | [추론·과도기] | 유지, 후보 30종, 포획 말 ⭐1(1차 기본기). 적 포획(예비)은 대상의 현재 스킬 승계 그대로 |
| 탐색 기술 교체 | CJ 결정 | 비활성 (Q1) |
| 아트 | [확정] | 새 경로 없음. 허용 목록은 기존 20폴더(`ART_DIRS` 는 레거시 20종에서만 생성) — 보호형·땅 10종은 이모지 폴백 |

---

## 6. 자체 발견 · 수정한 제품 결함

1. **수풀 포획 모달 크래시** — 포획 방법 화면이 레거시 `archSkills(rd.arch,…)` 로 스킬 이름을 그려, 보호형 종이 후보면 `ARCH_TMPL.guard` 가 없어 예외. `speciesSkills(rd.id,1)` 로 교체 (smoke_issue234 E4 가 첫 실행에서 잡음).
2. **왕 본체 전투 토큰이 속성 이모지로 바뀜** — 왕·동료가 속성을 갖게 되면서 토큰이 👑 대신 🔥 등으로 그려짐(smoke_minion_art G6). 표시 개편은 #238 범위라 본체 토큰은 현행 👑/🤝 · 중립색 · 종류 라벨로 유지하고 속성은 패널 배지로만 보이게 함(두 렌더 경로 모두).

---

## 7. 기존 회귀 갱신 — 근거

기대값을 구현에 맞춰 낮춘 곳은 없다. 규칙이 바뀐 곳만 근거와 함께 바꿨다.

| 파일 | 바뀐 단언 | 근거 |
| --- | --- | --- |
| `smoke_issue233.js` | B16 로스터 20 → 30 · B17 보호형 없음 → 5종 | GDD-23 6.3 (#233 시점의 "아직 없음" 기록) |
| `smoke_attack_balance.js` | A1·A3·A6 범위를 기존 20종 id 로 명시 · A7 30종 · A9 레거시 26종(v2 제외) · B6 레거시 템플릿 + 라이브 ⭐1 · C절 픽스처에 레거시 템플릿 명시 주입 · E절 팝업을 6.1 골격 💪170%/⌛3 · 6.3 이름으로 | #95 수치 계약(기존 20종·레거시 기술)은 그대로 검사. 라이브 로스터 스킬은 GDD 6장으로 대체 |
| `smoke_shock.js` | G1·G2 AI 상태 키 매핑에 `land:"crack"` · I3 팝업 → 스파크 샷 감전 50% | GDD 4.1·4.5 균열 · 6.1 감전 예외 |
| `smoke_issue146.js` | C4 레거시 본체 경로를 밟기 위해 전투 개시 **뒤에** 스킬 배열을 비움 | 6.2 왕·동료는 개시 시 스킬 칸 동기화. 검사 대상(방어막 합산) 불변 |
| `smoke_memo.js` | 무작위로 아트 없는 새 종이 뽑히면 아트 있는 종으로 교체 | 명세 3장 새 10종 전용 아트 없음 (B2 는 아이콘 계약) |
| `smoke_minion_art.js` | 무대 두 종을 #234 이전 이 시드가 만든 M-G2 · M-G3 로 명시 복원 · A4 30종 중 20종 대응 · K1a/K1d 30종 · 포획 말 ⭐1 · K2 는 아트 보유 20종 | 명세 3장 · 새 10종 아트 없음 · 포획 ⭐1 |
| `smoke_search_packages.js` | 로드마다 보존된 기술 교체 분기를 켬 · E1b 왕 ×1.0 → ×1.3 · F1e 포획 스킬 ⭐1 | **CJ 결정 2026-09-17**(기본값 비활성은 smoke_issue234 E1~E3 가 고정) · GDD 6.4 "왕·동료 본체는 이번 개편에서 속성을 가지므로 ×1.3 대상" · 명세 3장 |
| `smoke_cross_skill.js` | 로드마다 기술 교체 분기를 켬 · A1 레거시 공격기(v2 제외) · E2/E3 상대 화면 "? 미공개" · E5 팝업 종 스킬 · F7 포획 ⭐1 · L1/L5/L6 변형 앵커 문자열만 갱신(변형 내용 동일) | CJ 결정 · GDD 7.9 등급 비공개 · 6.3 · 명세 3장 |
| `shared/harness.js` | #234 심볼 노출 추가(typeof 가드) | — |
| `.github/workflows/ci.yml` | 잡 A 목록에 `smoke_issue234.js` 1줄 + 설명 주석 **추가만** | 명세 4장 |

---

## 8. 실행한 검사 · 횟수 (정확히)

**신규 `smoke_issue234.js` — 6회**
| 회 | 결과 | 원인 · 조치 |
| --- | --- | --- |
| 1 | 17 fail + 예외 | 제품 결함 1(§6-1 포획 모달) · 나머지는 검사 작성 실수(라운드 경계 순서) |
| 2 | 6 fail | 검사 설계 오류: D1/D2 에서 상대 등급이 4.4 선턴을 바꿔 상대가 먼저 행동(엔진은 정상) · 전투 종료 초기화 뒤 필드 읽기 |
| 3 | 2 fail | AI 서명에 무작위 무대 말 이름이 섞임 |
| 4 | **290 / 0** | — |
| 5 | 1 fail | §6-2 토큰 표시 변경 뒤 재확인 실행에서, 이름에 '의'가 든 종(재의 주술사)일 때 이름 제거 정규식이 틀리는 **검사 자체의 흔들림** 발견 |
| 6 | **290 / 0** | 정확한 이름 제거로 수정 |

**CI 잡 A 클라이언트 스위트** (서버 검사 미실행 — 명세 5장)
| 회차 | 대상 | 결과 |
| --- | --- | --- |
| 1차 | 26개 전부(234 제외) 1회씩 | 18 pass · 8 fail (memo · minion_art · search_packages · issue146 · issue233 · attack_balance · shock · cross_skill) |
| 2차 | 실패 8개만 | 5 pass · 3 fail (minion_art · search_packages · cross_skill) |
| 3차 | 실패 3개만 | 3 pass |
| 추가 | `smoke_online_art` 1회 | pass 101/0 — §6-2 가 이 스위트가 보는 토큰 대체 경로(`artSpriteFail`)를 바꿔서 재확인 |

최종 수치: cycle5 70 · turnflow 203 · turnflow_timers 36 · memo 122 · own_side 66 · online 159 · online_sync 23 · testclient 41 · minion_art 208 · issue114 18그룹 · tutorial 136 · search_packages 300 · issue146 215 · public_rooms 143 · fx_consumer 52 · issue233 309 · **issue234 290** · online_art 101 · trap_icon 42 · issue122_rules 93 · back_nav 122 · fx_timing 82 · attack_balance 54 · shock 67 · cross_skill 86 · orientation_audit 8916 · ai_completion 59(sim 13판) — 모두 fail 0.

그 밖에 디버깅용 짧은 `node -e` 확인 5회(로드 확인 1 · D1 원인 1 · 천년목 즉사 원인 1 · 기준판 무대 종 비교 1 · E3 패널 문자열 1). 반복·다중 시드 전수·장시간 시뮬레이션은 하지 않았다.

---

## 9. 미검증 한계

1. **1차 결과의 첫 18개 스위트는 §6-2 토큰 표시 수정 전 실행이다.** 토큰 경로를 직접 보는 minion_art(3차) · online_art(추가)만 다시 돌렸다. 나머지는 PR 필수 CI 가 최종 1회를 맡는다.
2. **음성 대조(변형판 주입)는 하지 않았다.** smoke_issue234 는 GDD 표를 독립 사본으로 대조하지만, 각 동작 검사가 변형을 잡는지는 확인하지 않았다(검사 예산).
3. **Q6 '스킬 사용 1회당 1번'** 은 여러 타격 스킬(번개 꼬리 이어 쓰기) 경로를 코드로만 맞췄고 전용 검사는 없다.
4. **전설 · ⭐2~4 는 라이브 경기에서 나오지 않는다**(#236 전). 검사에서 직접 구성해서만 밟았다. 브라우저 확인·CJ 플레이 QA 대상 화면은 ⭐1 30종 · 왕/동료 스킬뿐이다.
5. **온라인(서버 권위) 경로 미검증** — 서버 코드는 Jupiter 소관이라 실행하지 않았다. §11 서버 영향 목록을 반영하기 전에는 공개 방에서 새 스킬 상태가 락스텝 요약에 빠져 VOID 감지력이 낮고, 상대 좌석 프레임이 스킬 칸 수(=등급)를 노출한다.
6. **AI 판단 품질** — 새 비피해 스킬은 간단한 힌트 점수(`aiV2SupportScore`)만 쓴다. 조건부 위력(성룡의 포효·심연의 일격 등)은 기본 💪% 로만 추정한다. 합법성은 D3 가 보지만 밸런스 체감은 8.4 AI vs AI 지표로 봐야 한다.
7. 브라우저 수동 확인 · 시각 확인 없음(QA 최소 정책). 메모 추측 선택지에 '땅 하수인'이 없다(UI 개편 #238 범위).

---

## 10. [기획 필요]

| 항목 | 현재 처리 | 출처 |
| --- | --- | --- |
| 모래바람 '가하는 피해 −30%'가 상태이상(해독제·맑은 물 해제 대상)인가 | 해제 대상에서 뺌 | Venus Q4 · Q11 |
| 균사 전환 '2R 동안 흡수 30%'의 30%가 확률인가 회복 비율인가 | 회복 비율 30%로 확정 부여(판정 없음) | Venus Q9 범위 밖 |
| ~~천년목 버팀 HP 가 현재 HP 보다 높을 때~~ **결정됨** | 현재 HP 유지 — `min(현재 HP, 최대 HP 15%)` (코드 불변) | CJ 결정 2026-09-17 (P9 · REVISE 3차) |
| ~~동료의 복수 · 왕의 분노 '현재 최고 달성 단계'~~ **결정됨** | 왕국 (2) 미달성이면 효과 없이 위력만 — #235 전에는 항상 미달성(`v2KingdomEffectOf` → null) | CJ 결정 2026-09-17 (D4 · REVISE 3차) |
| 요새 전환 '절반만 소모'의 홀수 반올림 | 소모량 올림 정수 | Mars 추론 |
| 폭발 연소 · 불꽃 표식의 '화상 피해 1회' 수치 | 최대 HP × (화상 %+잿불 심기 %p), 지속 피해 규칙 | Mars 추론(4.3) |

---

## 11. 서버 영향 목록 (Jupiter 후속용 — Mars 는 서버를 수정하지 않았다)

서버는 `demo/index.html` 엔진을 그대로 구동하므로 규칙은 자동으로 따라간다. 아래는 **요약 · 합법성 · 좌석 프레임**에 반영이 필요한 항목이다.

### 11.1 `server/authoritative/room.js` `lockstepDigest()` → `fighter(f)` — 추가해야 할 전투원 필드
두 좌석이 갈려도 지금 요약이 같게 나오는 상태들이다.
- **난수 소비를 바꾸는 것(최우선)**: `nextShockForce`(충전 — 감전 판정 rand 생략) · `sandStormR`(부여 확률 절반) · `onceUsed`(전투당 1회 — 합법성 · 선택 분기) · `sleepNext` · `nullifyNext`(환영 무도 — 행동 전체 무효)
- **지속 카운터 + 부여 라운드 게이트**(`X` 와 `XFresh` 둘 다): `absorbR` · `spdBuffR` · `spdDownR` · `healCutR` · `vanguardTurn`(**boolean → 숫자 카운터로 바뀜**, `vanguardTurnFresh` 신설) · `retaliateBurnR` · `mirrorR` · `reflectR` · `counterR` · `overloadR` · `nullHitR` · `burrowR` · `sandStormR` · `ringR` · `enduredR` · `breedR` · `fortressR` · `immuneShockR` · `mossR`
- **세기 · 소유자**: `absorbPct` · `spdBuff` · `spdDown` · `healCut` · `nullHitN` · `mossPct` · `mossBy` · `breedBy` · `counterRound` · `burnMag` · `burnBonus` · `burnNoCure` · `weakenMag`
- **다음 피해 스킬 1회성**: `nextDmgUp` · `nextPowUp` · `nextFlat` · `critForce`(기존) · `sandWind`
- **전투 누계(위력에 들어감)**: `shocksDealt`(연쇄 번개) · `mitigated`(분화 — **소수**) · `healTotal`(성장 매듭) · `sporePending` · `burrowRound` · `enduredUsed` · `fleeLock` · `permShockR` · `permShockBy`
- `pendingFx` 항목에 `atStart`(해일 예고 — 0 이 되어도 다음 라운드 시작까지 남음). tag 는 `"M-W5-4:tsunami"` 로 채워졌다
- 전투 객체: `B.reflectSeq` · `B.counterSeq`(한 행동 1회 게이트)

### 11.2 합법성 (`room.js` 590~660행 부근)
- 스킬 슬롯 검사는 `T.slotUsable` 을 부르므로 새 조건(전투당 1회 · 번개 발도 선턴 · 지하 매복 · 태고의 각성 4R · 수면 포자)이 자동 반영된다. 슬롯 수가 이제 1~4 로 가변(`k < f.skills.length` 는 이미 맞음).
- 왕·동료 본체도 `f.skills` 를 가진다 → 658~659행 주석/분기(`f.skills ? … : true`)의 "기본 공격 항상 가능" 갈래는 더 이상 타지 않는다. 레거시 `'skill'` 은 이제 슬롯 1(본체 속성 스킬)이다.
- 도망: 뿌리 고정(`f.fleeLock`)이면 코어가 거부한다 — 서버 합법성에도 같은 조건을 넣어야 무의미한 프레임이 줄어든다.
- 탐색 recruit: `step` 이 `skills`·`skill`·`target`·`slot` 이면 코어가 거부한다(CJ 결정 Q1) — 서버도 거부하도록.

### 11.3 좌석 프레임 · 정보 경계
- `_skillsFor(T,p,mine)` (985행): 상대 항목을 칸마다 `{i,revealed:false,kind}` 로 보내 **칸 수 = 등급(7.9 비공개)** 과 종류가 드러난다. 클라이언트 표시는 "? 미공개" 하나로 접었지만 프레임 데이터는 그대로다 → 공개된 칸만 보내고 미공개는 개수 없이 표시하는 형태 권장.
- 왕·동료 `element` 가 이제 null 이 아니다(2.2 · 소유자 화면 전용, 참전 공개 시 상대도 앎). 미공개 상대 왕·동료의 `element` 가 등급 B 에서 나가지 않는지 확인 필요.
- 새 말 필드: `allyKind`(암살자/방패병 — 스킬 세트) · `leaderElChosen` · `legend`. 클라이언트 `netStubStats` 는 동료를 모두 암살자로 가정한다(표시 전용).
- `rosterIds` 허용 집합은 `T.ROSTER` 에서 만들어 30종이 자동 반영된다.

### 11.4 서버 검사 (`server/authoritative/test/`)
- 로스터 20종 · 왕/동료 무속성 · 스킬 4칸 고정 · 레거시 기술 id 를 전제로 한 단언이 있으면 갱신이 필요하다(Mars 는 실행하지 않았다).

---

## 12. 변경 파일

- `demo/index.html` (+743 / −86)
- `demo/test/regression/smoke_issue234.js` (신규)
- `demo/test/shared/harness.js`
- `demo/test/regression/smoke_attack_balance.js` · `smoke_cross_skill.js` · `smoke_issue146.js` · `smoke_issue233.js` · `smoke_memo.js` · `smoke_minion_art.js` · `smoke_search_packages.js` · `smoke_shock.js`
- `.github/workflows/ci.yml` (잡 A 1줄 + 주석)
- `docs/milestone/v0.4.11/issues/234/Mars/report.md` (이 파일)

---

## REVISE 1차 (2026-09-17 · Saturn 백업 QA 결함 2건)

근거: `docs/milestone/v0.4.11/issues/234/Saturn/report.md`. 대상 커밋 60319fa 위 작업 트리 변경(커밋은 Mercury). Mars는 QA 판정을 선언하지 않는다.

### 수정
| 결함 | 원인 | 수정 (`demo/index.html`) |
|---|---|---|
| 1. 마녀의 장난 효과 0 | `L-WITCH-4`가 v2 등록(fx 없음 → `v2Default`)이라 레거시 전용 `witchApply`에 도달하지 않음 | `V2_FX.witchPrank` 추가 · `L-WITCH-4`에 `fx:"witchPrank"`. 💪80% 적중 뒤 화상·약화·감전은 `v2Apply(force)`(확률 판정·난수 없음, 거울 수면·감전 면역 적용), 풀 회복은 이번 적중 HP 피해 100%를 `v2Heal`(회복 감소 적용). 회피면 대상 효과·회복 없음(v2Default와 같음) |
| 2. 사신의 낫이 환영 무도·번식 포자 우회 | `execSlot`의 reaper 분기가 `execV2`보다 앞이라 전처리(1376~1377)를 건너뜀 | 전처리를 `v2PreUse(side,f,sk)`로 추출해 `execV2`와 reaper 분기가 함께 호출. reaper는 게이트(⌛·차례·봉인) 통과·공개 뒤, 즉사 판정 전에 호출 → 환영 무도면 무효·차례 종료, 번식 포자면 최대 HP 5% 피해(사망 시 종료) 뒤 즉사 판정. 수면 포자 플래그도 같이 소모 |

- [추론] 두 효과의 조합 선택은 GDD 6.4에 방식이 없어 기존 승인 계약 #121 5.2의 균등 6조합(`WITCH_COMBOS`, 공유 rand 1회)을 재사용했다. 적용 자체에는 확률 판정이 없다.
- [확정·기존 동작 유지] 환영 무도와 번식 포자가 동시에 걸리면 `execV2`와 같은 순서(무효가 먼저 → 번식 포자 피해 없음)다. QA 재현 문장 "즉사하지 않고 번식 포자 피해 발생"은 두 조건을 따로 검사(RV2a·RV2b)하고, 동시 조건은 즉사하지 않음만 확인(RV2c)했다. 동시 조건에서도 번식 포자 피해가 나야 한다면 execV2 전체 순서 변경이라 [기획 필요].
- 난수 소비 변화: 마녀의 장난이 이제 적중 시 조합 rand 1회를 더 쓴다(종전 v2Default는 0). 서버 락스텝·경계 검사는 PR CI B·Jupiter 확인 대상.

### 같은 우회 패턴 정적 점검 (실행 없음)
- v2 등록 스킬 정의에서 레거시 실행기 전용 키(`drainPct`·`statusSelf`·`selfShieldPct`·`selfVuln`·`coolAttack*`·`bonusVs*`·`healPct`·`shieldPct`·`dmgCut`·`focus`·`coolAny`·`cleanse`·`witch`·`reaper`)를 검색: `witch`(결함 1, 수정)·`reaper`(결함 2, 수정)만 존재. `dragonMult`는 `v2Hit`이 처리.
- v2 정의가 쓰는 `fx:` 이름 전부가 `V2_FX`에 정의돼 있음(누락 0).
- `execSlot`에서 `execV2` 앞에 끼어든 특수 분기는 reaper 하나뿐. 추가 결함 없음.

### 검사 (각 명령 1회 원칙)
| 명령 | 실행 | 결과 |
|---|---|---|
| `node demo/test/regression/smoke_issue234.js` | 2회 | 1회차 294 pass / 2 fail — RV1a·RV1b가 `fixRand(0)/(0.99)`로 분산 roll까지 고정해 피해가 16이 아니었음(테스트 입력 오류, 기대값 불변). roll 0.55/0.45(피해 16 유지, 조합 3/2)로 입력만 고쳐 그 파일만 재실행 → **296 pass / 0 fail, exit 0** |
| `smoke_issue233.js` | 1회 | 309 / 0, exit 0 |
| `smoke_cross_skill.js` | 1회 | 86 / 0, exit 0 |
| `smoke_attack_balance.js` | 1회 | 54 / 0, exit 0 |

신규 검사: RV1a [약화·감전] · RV1b [화상·풀 회복 16] · RV1c 회피 시 효과 없음 · RV2a 사신의 낫 환영 무도 무효 · RV2b 사신의 낫 번식 포자 피해 후 즉사 · RV2c QA 재현 조건에서 즉사 안 함. 서버 검사·브라우저 확인은 실행하지 않았다.

### 변경 파일
- `demo/index.html` (+22 / −7)
- `demo/test/regression/smoke_issue234.js` (RV1·RV2 6건 추가)
- `docs/milestone/v0.4.11/issues/234/Mars/report.md` (이 절)

## REVISE 2차 (2026-09-17 · CJ 결정 — 사신의 낫)

근거: CJ 결정 2026-09-17(명세 `C:/dd_cdp/issue-234-mars-revise2-spec.md`). 대상 HEAD da724da 위 작업 트리 변경(커밋은 Mercury). Mars는 QA 판정을 선언하지 않는다.

### 수정 (`demo/index.html`)
| 결정 | 구현 |
|---|---|
| 1. 절대 판정 즉사 | `execSlot` reaper 분기에서 REVISE 1차의 `v2PreUse` 호출과 Q7 `v2Endure` 호출을 제거 → 방어막·철벽 돌파·과부하 방벽·천년목·환영 무도·수면 포자를 모두 무시하고 `instaKill`. `slotUsable`의 수면 포자 차단에서 `sk.reaper` 제외(UI·AI 모두 이 함수를 쓴다). `V2_INTERP.endureAllDamage` 주석·`v2PreUse` 주석을 결정에 맞게 갱신 |
| 2. 봉인 해제 6R → 4R | `BAL.reaperRound:4`. HP 비율 strict 비교·시간의 수호자 3R 전투 불가는 현행 유지. 사신의 낫 설명 문구(`L-REAPER-4`·레거시 `reaper_scythe`) 갱신 |
| 3. 전투를 넘는 봉인 | 말(전투원 객체) 단위 `f.reaperSeal`: 사용 즉시 2 → `startRounds`가 참전 전투원마다 1 감소(2→1 이번 전투 봉인, 1→0 해제). `resetV2`/`resetAfter`/`resetBattleTemps`는 건드리지 않아 전투 종료 초기화로 지워지지 않는다. `reaperWhy`가 1이면 "지난 전투에서 사용 — 이번 전투는 봉인" 사유 반환(소유자 화면 tip·토스트만, 공용 로그 없음). 쿨(`cds`)과 무관해 쿨링수로 풀리지 않음 |

- [추론·PD] '전투' = 그 전투원이 `startRounds`로 참전한 라운드 전투. 대리 출전이면 전투원 객체가 `piece.cap`이라 그 객체에 기록된다(본체와 별개). 밀어내기(`doPush`)·폭탄·함정 접촉은 라운드 전투가 아니라 봉인 카운트에 들어가지 않는다.
- [추론·PD] 즉사가 반드시 성립해 전투가 끝나므로 번식 포자 피해는 적용되지 않고, 남은 nullifyNext·sleepNext·breedR은 `resetAfter`로 정리된다.

### 기대값 변경 (CJ 결정 근거)
| 파일 | 단언 | 종전 → 변경 |
|---|---|---|
| smoke_issue234.js | MG3e | 천년목이 즉사를 버팀 → 버티지 못함(결정 1) · 6R → 4R |
| smoke_issue234.js | RV2a·RV2b·RV2c | 환영 무도 무효/번식 포자 피해/동시 조건 비즉사 → 모두 즉사·포자 피해 없음(결정 1) · 6R → 4R |
| smoke_search_packages.js | E3·E3d·E3e | 5R 봉인/6R 해제 → 3R 봉인/4R 해제(결정 2). 조건·거부·비공개 단언은 불변 |

라운드 6 전제 정적 점검: `smoke_cross_skill.js`·`smoke_attack_balance.js`(분류·cd 0만), `smoke_issue146.js`(1R 봉인 픽스처)는 영향 없음 · `smoke_search_packages.js` J1 계열(6R, 3R 봉인)은 4R 기준에서도 같은 판정이라 불변 · `smoke_issue233.js`에는 사신의 낫 단언 없음.

### 신규 검사 (smoke_issue234.js)
① RV2f(방어막 500·철벽 돌파·과부하·천년목 전부 무시) · MG3e(천년목) / ② RV2g(일반 치명 피해 90→15 버팀) / ③ RV2a·RV2c(환영 무도) · RV2d·RV2e(수면 포자 상태 합법·즉사) / ④ RV2h(3R 봉인)·RV2i(4R 가능) / ⑤ RV2j(전투 1 사용·기록) · RV2k·RV2k2(전투 2 봉인·소유자 화면 사유) · RV2l(봉인 호출 무효·로그 무노출) · RV2n(봉인 전투 판정 종료 후 유지) · RV2o·RV2p(전투 3 사용·재봉인) / ⑥ RV2q·RV2r(미사용 전투 뒤 봉인 없음) / ⑦ RV2m(쿨링수 실제 사용 후에도 봉인)

### 검사
| 명령 | 실행 | 결과 |
|---|---|---|
| `node demo/test/regression/smoke_issue234.js` | 2회 | 1회차 311 / 1 fail — RV2f가 전투 종료 초기화(`resetV2`)로 0이 되는 `nullHitN===1`을 단언한 테스트 입력 오류(제품 동작 무관). 그 조건만 빼고 재실행 → **312 pass / 0 fail, exit 0** |
| `node demo/test/regression/smoke_search_packages.js` | 1회 | **300 pass / 0 fail, exit 0** |

참고: 레거시 `reaper_scythe` 설명 문구(6라운드→4라운드·봉인 안내) 수정은 위 두 실행 뒤에 했다. 표시 문자열만이고 이 문구를 단언하는 테스트는 정적 검색상 없다(재실행하지 않음).

미실행(예산 밖): smoke_issue233·smoke_issue146·smoke_cross_skill·smoke_attack_balance 등 수정하지 않은 회귀, 서버 검사(`server/`), 브라우저. PR CI 잡 A·B가 확인 대상이다.

### 서버 영향 목록 (Jupiter 후속 — Mars는 서버를 수정하지 않았다)
| 항목 | 위치 | 필요 조치 |
|---|---|---|
| 말 단위 봉인 필드 `reaperSeal`(0/1/2) | 전투원 객체(본체 말 `S.pieces[i]` 또는 대리 출전 `piece.cap`/`S.reserve[p]`) · 쓰기: `execSlot` reaper 분기(=2) · `startRounds`(참전 시 −1) | `server/authoritative/room.js` `lockstepDigest`의 전투원 요약(`v2`/`fighter`)과 **말(piece)·예비(reserve) 요약**에 추가 — 전투 밖에서도 유지되므로 전투 요약만으로는 부족. 한 좌석에만 남으면 다음 전투의 합법 슬롯 집합이 갈린다 |
| 합법성 | `slotUsable`·`reaperWhy` (봉인 1/2 · 4R · 수면 포자 무시) | 서버가 입력 합법성을 따로 판정하면 `reaperRound` 4·수면 포자 예외·전투 간 봉인을 같은 규칙으로 반영(엔진 eval을 쓰면 자동) |
| 좌석 프레임·재연결 | 말 상태 스냅샷 | `reaperSeal`을 소유자 좌석 상태에 포함해야 재연결 뒤 봉인 표시가 유지된다. 상대 좌석에는 불필요(사유는 소유자 전용 · 미공개 기술 비노출 원칙) — [추론] 공개 여부는 Jupiter·PD 확인 |
| 난수 | reaper 분기 | 변화 없음(즉사 경로 rand 0). REVISE 1차의 `v2PreUse` 경로 제거로 번식 포자 피해·환영 무도 소모가 reaper 사용에서 사라짐 |
| 경계 검사 | `test-issue234-boundary.js`의 V2_TIMED·resetV2 대조 | `resetV2`·`V2_TIMED`는 바꾸지 않았다(`reaperSeal`은 의도적으로 초기화 목록 밖) |

### 온라인 수신 경로 후속 (Jupiter 보고서 REVISE 2차 6-1)
- `netStubPiece`: `reaperSeal:u.reaperSeal||0` (you.pieces·you.reserve) · `netSynthFighter`: `reaperSeal:sd.reaperSeal||0` (자기 전투원). `cap`은 기존대로 서버 객체 그대로라 cap 봉인도 소유자에게 전달된다. 상대 말·상대 전투원은 서버가 키를 보내지 않아 0 — 추측으로 채우지 않는다.
- 신규 검사 NR1~NR3(`smoke_issue234.js` N절, 실제 `netApplyRoomState` 경로): 소유자 프레임 1 → 말·예비·자기 전투원 복사·봉인 사유·슬롯 비활성 / 상대 0 / 키 없음 → 0·사용 가능.
- 검사: `smoke_issue234.js` 1회 **315 pass / 0 fail** · `smoke_fx_consumer.js` 1회 **52 pass / 0 fail**. 서버·브라우저 미실행.

### 변경 파일
- `demo/index.html`
- `demo/test/regression/smoke_issue234.js`
- `demo/test/regression/smoke_search_packages.js`
- `docs/milestone/v0.4.11/issues/234/Mars/report.md` (4장 Q7·Q10 행, 이 절)

---

## REVISE 3차 (2026-09-17 · CJ 결정 — D4 · P13 · P14 · I1, 문서만 P9 · P12)

근거: CJ 결정 2026-09-17(명세 `C:/dd_cdp/issue-234-mars-revise3-spec.md`). 대상 HEAD 09d3d3c 위 작업 트리 변경(커밋은 Mercury). Mars_1 구현 · Mars는 QA 판정을 선언하지 않는다. 스킬 교체·단순화와 구조 변경(A안)은 하지 않았다.

### 수정 (`demo/index.html`)
| 결정 | 구현 [확정 — 코드] |
|---|---|
| D4 왕국 미달성이면 (2) 값 미사용 | `v2KingdomEffectOf`(1032) 가 `null` 반환 → `v2Revenge` 의 기존 `if(!e) return;` 으로 동료의 복수 💪220% · 왕의 분노 💪280% **피해만**(🔥화상 · 💧약화 · ⚡감전 · 🗻자기 경화 · 🌿자기 흡수 · 지속 +1R 모두 없음). `V2_KINGDOM_STAGE2` 표는 #235 가 "달성 단계 ≥ (2)"일 때 쓸 데이터로 보존. 1027~1029 주석 · `LD-REVENGE`/`LD-WRATH` desc(1184·1185) 갱신 |
| P13 사신의 낫은 어떤 스킬로도 막을 수 없음 | `v2CdUpTarget`(1329) 후보에서 `sk.reaper` 제외 → 동결 · 자기장은 다음 후보(기본기 제외 · 남은 ⌛ 최단 · 슬롯 순)를 고르고, 기본기 · 사신의 낫뿐이면 "늘릴 ⌛가 없다". `slotUsable` · AI · 서버 합법성은 같은 함수를 쓴다 |
| P14 '다음 피해 스킬' 1회성 효과는 회피돼도 소모 | `v2Hit`(1407) 에서 `f.critForce` 를 `resolveHit` **전에** 꺼내 소모(`critNow`, 1418) → 죽음의 그림자 확정 치명도 위력+ · 고정 피해 · 피해+ 와 같이 회피돼도 소모. `resolveHit` 에 `hopts.critForce`(이 타격의 확정 치명 여부) 추가 — 있으면 `f.critForce` 를 보지 않고, 확정이면 rand 0회(종전과 같은 소비). v2 밖 경로(레거시 `execSlot`)도 회피 분기에서 확정 치명 소모(4293, 도망 실패 페널티는 종전대로 미소모) |
| I1 조준 사격 확정 치명은 그 타격 한정 | `aimShot` 의 `o.critForce` 를 `f.critForce` 로 켜지 않고 `hopts.critForce` 로만 넘긴다 → 회피돼도 · 적중해도 플래그가 남지 않아 다음 피해 스킬(기본기 포함)로 넘어가지 않는다. 죽음의 그림자 플래그가 서 있으면 조준 사격이 그 '다음 피해 스킬'로서 1회 소모(섞이지 않음) |
| P9 천년목 · P12 사신의 낫 봉인 | 코드 불변(현행 = 결정). 10장 [기획 필요] 표 P9 행 · D4 행을 **결정됨**으로 갱신. P12(참전 전투 기준 봉인)는 REVISE 2차 구현 그대로 |

1회성 효과 전수 대조 [확정 — 코드]: 철벽 돌파 `nextPowUp` · 축전 `nextFlat` · 달군 비늘 `nextDmgUp` 은 `v2Hit` 에서 `resolveHit` 전에 소모, 모래바람 `sandWind` · 충전 `nextShockForce` 는 `execV2` 사용 시점에 소모 → 이미 회피와 무관하게 소모. 달랐던 것은 확정 치명 하나뿐이었고 이번에 맞췄다.

P13 다른 차단 경로 정적 점검 [확정 — 코드]: ⌛ 조작은 `v2CdUp`(동결 · 자기장, 증가)만 사신의 낫을 막는다. 전광석화(자기 ⌛ 최장 −1) · 레거시 전술 연계 · 쿨링수는 ⌛를 줄이기만 한다. 수면 포자 · 환영 무도는 REVISE 2차에서 이미 제외. [확정·범위 밖] 🧭 시간의 수호자(3R 전투 → 봉인 해제 불가)는 스킬이 아니라 수호자 버프라 이번 결정("어떤 스킬로도") 밖으로 보고 유지 — 스킬 외 효과까지 포함하는지는 [기획 필요].

부수 변화 [추론 — 기존 계약과 일치]: 해일 예고 발동(raw)은 이제 시전자의 확정 치명을 소모하지 않는다(`v2Hit` 주석 "예고 피해 발동(raw)은 소모하지 않는다"와 일치 — 종전에는 `resolveHit` 가 raw 에서도 소모). 이 경로는 신규 검사 없음(정적 확인만).

### 기대값 변경 (CJ 결정 근거)
| 파일 | 단언 | 종전 → 변경 |
|---|---|---|
| smoke_issue234.js | MK1~MK5 | 왕국 (2) 값 효과(화상 2%/1R · 지속 +1R · 약화 −4% 2회 · 경화 3% · 흡수 10%) → **효과 없음 · 피해만**(44 · 56) — D4. 주석에 결정 근거 기록 |

### 신규 검사 (smoke_issue234.js)
- D4: MK1b(⚡ 감전 없음 · 피해만) — MK1~MK5 와 합쳐 5속성 전부
- P13: P13a(동결 — 사신의 낫 ⌛0 앞 슬롯 제외 · 다음 후보 +1) · P13b(동결 뒤 4R · HP 열세면 사용 가능) · P13c(기본기 · 사신의 낫뿐이면 ⌛ 불변) · P13d(자기장 동일). 기존 C4a~C4e(일반 대상 선정)는 불변 통과
- P14: P14a·P14b(죽음의 그림자 확정 치명 회피 시 소모 · 다음 기본기 20) · P14c·P14d(철벽 돌파 +80%p 회피 시 소모) · P14e(달군 비늘 · 축전 · 모래바람 · 충전 회피 시 모두 소모)
- I1: I1a·I1b(회피된 조준 사격 뒤 플래그 없음 · 기본기 20) · I1c·I1d(적중 36 · 다음 기본기 20) · I1e(죽음의 그림자 플래그는 조준 사격에서 1회 소모)

### 검사
| 명령 | 실행 | 결과 |
|---|---|---|
| `node demo/test/regression/smoke_issue234.js` | 1회 | **330 pass / 0 fail** (재실행 없음) |

미실행(예산 밖): 수정하지 않은 기존 회귀(특히 `resolveHit` 을 직접 부르는 `smoke_issue233.js` K절 — 정적 대조상 K 는 회피 0% · `hopts.critForce` 미지정 경로라 종전과 같음 [추론]), 서버 검사(`server/`), 브라우저. PR CI 잡 A · B 가 확인 대상이다.

### 서버 영향 목록 (Jupiter 후속 — Mars는 서버를 수정하지 않았다)
| 항목 | 위치 | 영향 · 필요 조치 |
|---|---|---|
| `critForce` 의미 변화 | `demo/index.html` `v2Hit` · `resolveHit` ↔ `server/authoritative/room.js` `lockstepDigest` `fighter(f).critForce` | 필드 이름 · 자리는 그대로. **조준 사격은 더 이상 `f.critForce` 를 켜지 않고**, 죽음의 그림자 플래그는 **회피돼도 소모**, 해일 발동(raw)은 소모하지 않는다. 서버는 엔진(`engine.js`)으로 `index.html` 을 직접 구동하므로 코드 수정 불필요 [추론]. 요약 필드 추가 없음 |
| 난수 소비 | `resolveHit` ⑦ | 확정 치명 = rand 0회, 아니면 1회 — 종전과 같은 규칙. 다만 조준 사격 회피 뒤 다음 타격 · 죽음의 그림자 회피 뒤 다음 타격 · 해일 발동에서 **치명 rand 1회가 다시 소비**된다(종전은 잔존 플래그로 0회). 두 좌석이 같은 코드면 결정성 유지. 서버 기준판(골든) 대조가 이 시나리오를 담고 있다면 갱신 필요 [추론] |
| ⌛ 증가 대상 | `v2CdUpTarget` | 사신의 낫 제외 → 요약 `cds` 결과가 달라질 수 있음(같은 엔진이면 자동 일치). 서버 합법성이 이 함수를 쓰면 자동 반영 |
| 왕국 효과 | `v2KingdomEffectOf` | 동료의 복수 · 왕의 분노가 상태 필드(`burn` · `burnMag` · `weaken` · `weakenMag` · `shock` · `harden` · `hardenPct` · `absorbR` · `absorbPct`)를 더 이상 바꾸지 않음. 서버 요약 필드 추가 · 변경 없음. #235 에서 단계 집계를 넣을 때 서버 요약에 왕국 달성 단계 필드가 필요한지 재검토 |
| 경계 검사 | `test-issue234-boundary.js` 의 `V2_TIMED` · `resetV2` 대조 · `test-combat-stats-boundary.js` 의 `critForce` 키 | `V2_TIMED` · `resetV2` · 초기화 목록 불변 → 영향 없음 [추론 — 정적] |

### 변경 파일
- `demo/index.html`
- `demo/test/regression/smoke_issue234.js`
- `docs/milestone/v0.4.11/issues/234/Mars/report.md` (10장 P9 · D4 행, 이 절)

## REVISE 4차 (2026-09-17 · CJ 결정 — 속도는 1라운드 선턴 판별만)

근거: CJ 결정 2026-09-17 "속도는 첫 라운드 선턴 판별만 진행하고, 나머지는 전부 기존 전투 방식대로 진행해야 돼"(명세 `C:/dd_cdp/issue-234-mars-revise4-spec.md`). 기존 방식 원본: v0.4.10 `actorOfPhase`(`C:/dd_cdp/index-v0410.html` 3025). 대상 HEAD 88ddbff 위 작업 트리 변경(커밋은 Mercury). Mars는 QA 판정을 선언하지 않는다. 스킬 교체·회피율 전환은 하지 않았다.

### 수정 (`demo/index.html`)
| 규칙 | 구현 [확정 — 코드] |
|---|---|
| 1라운드 = GDD 4.4(순서 효과 > 속도 > 낮은 등급 > 접촉) | `decideFirstSide`(3749) 기존 1)~5) 그대로. `startRounds`(3727)가 결과를 `B.firstSideR1` 에 기록 |
| 2라운드부터 교대 | `decideFirstSide` 3753: `B.round>1` 이고 `firstSideR1` 이 있으면 홀수 라운드 = R1 선턴 측, 짝수 = 반대 측. 속도·등급·접촉 단계에 도달하지 않는다 |
| 순서 효과는 그 라운드만 뒤집음 | 교대 분기 **앞의** 분류 비교(선턴 0 · 기본 1 · 후턴 2, 둘 다면 후턴)가 갈리면 낮은 분류가 먼저. 같으면(양측 감전 포함) 기준 교대. 감전만 있을 때 v0.4.10 코드와 결과 동일 [확정 — 대조], 선턴 효과는 그 대칭 [추론·PD] |
| 라운드 시작 시 확정 | 호출 지점 불변: `startRounds`(3726) · `nextPhase` 라운드 진입(4671, `v2RoundStart` 뒤) |
| 선턴을 읽는 스킬 | 번개 발도(`vanguardOnly`) · 천둥 낙인 · 광합성은 `B.firstSide` 를 읽으므로 코드 불변으로 새 순서를 쓴다 |
| 공개 방 복원 | `netSynthBattle`(6869)은 서버 `actor`·`phase` 로 `firstSide` 를 복원 — 규칙과 무관하게 정확. `firstSideR1` 은 복원하지 않는다(표시 경로는 `nextPhase` 를 돌리지 않음) [추론 — 정적] |
| 표시 문구·AI 순서 예측 | "속도가 빠른 쪽이 먼저" 류 문구, AI의 선턴 예측 코드 없음 [확정 — grep] → 변경 없음 |

`effSpd` 주석에 "1라운드 판정에만 영향" 추가. 전투 중 속도 증감(모래바람·모래 폭풍·날개 강타·충전)은 2라운드 이후 순서에 영향이 없어졌다(결정의 결과 — 회피율 전환은 별도 Issue).

### 기대값 변경 (CJ 결정 근거)
| 파일 | 단언 | 종전 → 변경 |
|---|---|---|
| smoke_issue234.js | MG3b · MG5c (507 · 520) | 기대값 불변. R2 행동 순서 픽스처만 `act("A") → act("D")` 에서 `act("D") → act("A")` 로(R2 는 R1 반대 측 D 가 먼저). 종전 순서로는 A 가 R2 후순으로 행동해 라운드가 넘어가 3건 실패(MG3b · MG5c · MG5d) |

`smoke_issue233` G18~G27 은 새 규칙과 충돌하지 않아 수정하지 않았다: G5~G17 은 `round` 없는 순수 입력(=1라운드 판정), G23 은 R2 기준 D + A 감전 → D 로 결과 동일, G26·G27 은 R1 [확정 — 실행 통과]. MF4c(선턴 효과) · ML5b(영구 자기장 감전) 도 R2 기준 D 를 뒤집는 형태라 그대로 통과.

### 신규 검사 (smoke_issue234.js `REVISE 4차` 절, 696~)
- O1~O1d: 순수 판정 — R1 속도 · R2 속도 무관 반대 측 · R3 R1 측 · R2 등급·접촉 무시
- O2~O4: 실제 전투 R1 빠른 D → R2 A(빠른 D 도 후순) → R3 D
- O5·O6: R2·R3 속도 증가·감소(`spdBuff`·`spdDown`)가 순서를 바꾸지 않음
- O7~O7c: 기준 선순(D) 감전 → R2 만 A, R3 기준 A, R4 기준 D 복귀
- O8: 양측 감전 → 기준 교대
- O9·O9b: 꺼지지 않는 불티 선턴 효과 → R2 기준 후순 A 를 앞당김
- O10·O10b: 번개 발도 — R1 선턴 사용 가능, R2 교대 후순이면 불가(속도가 빨라도)
- O11·O11b: 시간의 수호자 3R(`maxRounds=3`) — D·A·D, 3R 뒤 판정 종료

### 검사
| 명령 | 실행 | 결과 |
|---|---|---|
| `node demo/test/regression/smoke_issue234.js` | 2회 (1회차 실패 수정 후 1회) | 1회차 346 / 3 fail(MG3b · MG5c · MG5d — 위 픽스처 순서) → 수정 후 **349 pass / 0 fail** |
| `node demo/test/regression/smoke_issue233.js` | 1회 | **309 / 0** |
| `node demo/test/regression/smoke_issue146.js` | 1회 | 214 / **1 fail — B11b** "본체 기본 공격은 정상 동작한다" (아래) |
| `node demo/test/regression/smoke_shock.js` | 1회 | **67 / 0** |
| `node demo/test/regression/smoke_turnflow.js` | 1회 | **203 / 0** |
| `node demo/test/regression/smoke_online_sync.js` | 1회 | **23 / 0** |

선정 이유(선턴 순서 의존, 최대 5개): smoke_issue233 = G절 4.4 선턴 계약 원본 · smoke_issue146 = F절 라운드 경계 연속 행동(`flipOrderNextRound`) · smoke_shock = B7~B9 다라운드 감전 순서(v0.4.10 공식 사본) · smoke_turnflow = `actorOfPhase` 로 다라운드 전투 구동 · smoke_online_sync = 189행 `round%2` 행위자 공식으로 온라인 전투 구동. 나머지(smoke_cycle5 · smoke_fx_timing · smoke_search_packages · smoke_cross_skill · smoke_orientation_audit 등)는 미실행 — PR CI 잡 A 확인 대상.

**B11b 실패 [추론 — 정적, 재실행하지 않음]**: B11 은 `H.freshPlay` 무작위 배정 상대(`em`)에 시드 없이 **1라운드** 동료 본체 기본 공격 1회 후 `fd.hp<hp0` 를 본다. 이번 변경은 `B.round>1` 분기만 바꾸고, pvp 모드라 공격 뒤 AI 행동이 없으며, 라운드 종료 처리(회복·상태 감소)는 새 선턴 계산 **전에** 끝난다 → 이 단언의 HP 값에 닿는 경로가 없다. 상대 아키타입 회피율(시드 없음)로 빗나간 확률성 실패로 판단한다. 예산상 재실행·HEAD 대조는 하지 않았으므로 **미확정**이다. PR CI 잡 A 결과 또는 PD 승인 시 1회 대조로 확인 필요.

### 서버 영향 목록 (Jupiter 후속 — Mars는 서버를 수정하지 않았다)
| 항목 | 위치 | 영향 · 필요 조치 |
|---|---|---|
| 새 전투 상태 `B.firstSideR1` | `demo/index.html` `startRounds` ↔ `server/authoritative/room.js` `lockstepDigest` `battle.firstSide`(196) | R2 이후 선턴이 `firstSideR1`·`round`·순서 효과로 정해지는 **저장 상태**가 됐다. 요약에 `firstSide` 는 있지만 `firstSideR1` 이 없으면 두 좌석의 R1 기록이 갈려도 그 라운드 요약이 같을 수 있다(R1 요약의 `firstSide` 로 간접 검출은 됨) → `battle.firstSideR1: B.firstSideR1 \|\| null` 추가 권고 [추론] |
| 좌석 프레임 | `room.js` `toSeatView` · `test-combat-stats-boundary.js` 306 금지 키 목록 | `firstSideR1` 은 프레임에 싣지 않는다(`firstSide` 와 같은 요약 전용). 금지 키 목록에 `"firstSideR1"` 추가 권고 |
| 행위자 · 합법성 | `room.js` 629 · 1131 `T.actorOfPhase()` · `engine.js` 427 | 서버는 엔진으로 `index.html` 을 직접 구동 → 코드 수정 불필요 [추론]. 행위자 결과가 R2 부터 달라지므로 R2+ 행위자를 전제로 한 서버 테스트(`test-authority-rules.js` · `test-issue234-boundary.js` 의 다라운드 픽스처, 골든 대조) 기대값 점검 필요 |
| 공개 방 선턴 복원 (Jupiter 7장) | `netSynthBattle` 6869 | `actor`+`phase` 로 `firstSide` 복원 — 규칙 무관하게 유지. 서버 필드 추가 불필요 |
| 초기화 목록 | `resetBattleTemps` · `resetV2` · `V2_TIMED` | 불변(`firstSideR1` 은 전투 객체 필드, 전투마다 `startRounds` 에서 새로 기록) → 경계 검사 영향 없음 [추론 — 정적] |

### 변경 파일
- `demo/index.html`
- `demo/test/regression/smoke_issue234.js`
- `docs/milestone/v0.4.11/issues/234/Mars/report.md` (이 절)
