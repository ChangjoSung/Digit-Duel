# Issue #96 — 감전 부여 확률 하향 70% → 50% (Mars_3 구현 납품 보고)

- 역할: **Mars_3** (required_role=Mars · instance_index=3 · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- Task `task_c6ac489f2c48` · dispatch `ctx_46a1ae353069` · 브랜치 `fix/96-shock-probability` · 기준 dev `dcb668e` (#91 반영 · #95 미반영 — PD 지시로 이 기반 그대로 마무리, Git 조작 없음)
- 근거 문서: `CLAUDE.md`(HTML 데모 절, 2026-09-07 v0.4.4 착수 문구) · `docs/v0.4.4-gameplay-spec.md` 4장(#96 계약·AC 1~7·부채 a/b) · PD dispatch 계약
- 작성: 2026-09-07
- **이 문서가 주장하는 범위**: 기계로 잰 사실과 저장한 화면 증빙까지다. **Saturn 독립 QA와 CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다.** 아래 통과 수치는 Mars 자기 검증이고 Saturn 판정이 아니다.
- 표기: [확정] 코드·측정 사실 / [추론] 해석 / [미확정] 이번에 재지 않은 것

---

## 1. 무엇을 바꿨나 (`demo/index.html` 5줄 · +9/−8)

| # | 위치 | 변경 | 확정/추론 |
|---|---|---|---|
| 1 | `BAL` (:254) | `shockProb:0.5` 신설. `statusProb:0.7` 값 불변(주석에 "화상·약화" 명시) | [확정] A1·A2 |
| 2 | `SKILLS.lightning_effect.desc` (:298) | `"70% 확률 감전(후공 1회)"` → `"50% 확률 감전(후공 1회)"`. 위력·쿨·`status` 플래그 불변. 화상·약화 desc 70% 유지 | [확정] A3·A4·A7 |
| 3 | `execSlot.gate` (:1525) | `gate(force)` → `gate(force,prob)`: `prob` 생략 시 `statusProb`. **force(잔류장)는 단락 평가라 rand 미소비 — 변경 전과 동일** | [확정] D1·D5·비교 4 |
| 4 | `execSlot.applyStatus` 번개 분기 (:1532) | `gate(force)` → `gate(force,BAL.shockProb)`. 불·물 분기는 `gate(force)` 그대로 | [확정] C6·C7 |
| 5 | 레거시 `tryStatus` (:1474) + 번개 호출 (:1510) | `tryStatus(prob)`: 지속형 100% 단락 유지, 번개 호출만 `tryStatus(BAL.shockProb)`. 불·물 호출은 `tryStatus()` 그대로 | [확정] E1~E6 |

바꾸지 않은 것: 감전 지속(4슬롯 1R·레거시 지속형 2R) · `shockFresh` 소진 규칙 · `actorOfPhase` 순서 반전 · 해독제/정화/전투 종료 해제 · 잔류장 100% · AI 5급·5단의 상태 미부여 상대 +4 가산(확률 미반영) · 온라인 프로토콜 · 아트 100파일 · 서버 · 기획 문서.
**부채 (a)(b)** [계약대로 미수정]: 라운드 두 번째 행동자의 감전 순서 효과 없음 · 4슬롯 감전 1R vs 레거시 지속형 2R 차이 — E7·D6 가 현행을 고정만 한다.
**#92 대비** [추론]: `gate(force,prob)` 는 확률을 인자로 받으므로 #92 에서 판정 속성이 `atkEl` 로 바뀌어도 번개 분기의 `BAL.shockProb` 전달만 유지하면 된다. #92 제품 변경은 넣지 않았다.

### 테스트·도구 (제품 외)
| 파일 | 변경 |
|---|---|
| `demo/test/smoke_cycle5.js` :8 | `T.BAL.statusProb=1` 옆에 `T.BAL.shockProb=1` (AC 7 — 테스트 결정론) |
| `demo/test/smoke_minion_art.js` :550 | 동일 (K7 시드 대조 블록) |
| `demo/test/harness.js` :120 | `load(htmlPath,{html})` — 파일을 쓰지 않고 메모리 HTML 을 로드. before/after 대조·음성 대조용 1줄 확장 (기존 호출은 동작 동일) |
| `demo/test/smoke_shock.js` (신규, 65단언) | #96 회귀 A~J 절. 파일 쓰기 0 |
| `demo/test/shock_compare.js` (신규, 11단언) | `git show dcb668e:demo/index.html` 을 메모리로 읽어 같은 시드 before/after 대조. 파일 쓰기 0 |
| `demo/test/issue96_cdp.js` (신규) | 헤드리스 Chrome 실측 5측정·스크린샷 4장 (`--read-only` 시 산출물 0) |

---

## 2. 계약 대조 (규격 4장 AC · dispatch)

| 계약 | 구현·근거 | 판정 |
|---|---|---|
| AC1 `statusProb` 0.7 불변 · `shockProb` 0.5 | A1·A2 · 비교 0 · Chrome 0-consts | [확정] |
| AC2 화상·약화 부여율 대조 시뮬 불변 | 비교 2a: 1000 시드 결과 벡터 before==after(화상 676/1000 · 약화 676/1000 동일) · 2b: 불 표준형 vs 물 지속형 완주 200판 로그·HP 완전 일치 | [확정] |
| AC3 감전 침 1000회 부여율 45~55% | B1 469/1000 (46.9%) · 비교 1a 5개 시드 창 469/481/510/496/501 (모두 45~55%) | [확정] |
| AC4 잔류장 번개 100% 유지 | D1·D2(확률 키 0 이어도 100%) · 비교 4(300회 양쪽 100% · 이후 난수 상태 동일) | [확정] |
| AC5 레거시 비지속형 50% · 지속형 100% | E1 1000회 45~55% · E6 200회 100%·2R | [확정] |
| AC6 문구 50% | A3·A6(소스에 70% 감전 0) · I1 버튼 title · I3 로스터 팝업 · Chrome 1·2 장면 | [확정] |
| AC7 `statusProb=1` 고정 테스트는 `shockProb=1` 도 고정 | H1: `demo/test/smoke_*.js` 전부를 읽어 `statusProb=1` 행마다 `shockProb=1` 동반 검사(위반 0) · H2 2곳 | [확정] |
| 보장 경로 새 RNG 소비 금지 | D1·D5·E6 rand 소비 1회(분산만) · 비교 4 · 음성 J6 | [확정] |
| 소비 RNG·지속·해제·라운드 순서 불변 | B2·C4 rand 2회 · B6~B10(부여 라운드 미소진 → 다음 라운드 후공 → 종료 시 해제) · F1~F3(정화·해독제·전투 종료) · **비교 3a: `shockProb=0.7` 로 두면 옛 제품과 번개 전투 200판 로그·HP 완전 일치**(구조 등가 증명) | [확정] |
| AI +4 가산 유지 | G1~G3 (5급·5단 소스에 `sc+=4` 유지 · `shockProb`/`statusProb` 참조 0) · G4 시뮬 완주 | [확정] |
| 같은 시드 실제 제품 before/after 감전 빈도 | 비교 1c(같은 시드에서 after 성공 ⊂ before 성공) · 비교 5(AI vs AI 40판 총합) — 3.3절 | [확정] |
| 음성 대조 | J1~J6: 계약을 어기는 변형 6종을 메모리에서 로드해 검사기가 잡는지 확인 | [확정] |

---

## 3. 검증 — 명령 · 개수 · 결과 (Mars 자기 검증, Node v24.16.0, 저장소 루트)

### 3.1 헤드리스 회귀
```
node demo/test/smoke_cycle5.js
node demo/test/smoke_memo.js
node demo/test/smoke_online.js
node demo/test/smoke_minion_art.js
node demo/test/smoke_tutorial.js
node demo/test/smoke_testclient.js
node demo/test/smoke_shock.js
```
| 스위트 | 기준 dcb668e (변경 전 직접 실행) | 이번 | 변화 |
|---|---|---|---|
| cycle5 | 69/69 | **69/69** | 0 |
| memo | 49/49 | **49/49** | 0 |
| online | 157/157 | **157/157** | 0 |
| minion_art | 199/199 | **199/199** | 0 |
| tutorial | 124/124 | **124/124** | 0 |
| testclient | 41/41 | **41/41** | 0 |
| **shock (신규)** | — | **65/65** | +65 |
| **합계** | **639** | **704 / 704 PASS** | +65 |

dispatch 가 말한 "현행 571" 은 PR#90 시점 합계이고, 기준 dev dcb668e 에서 직접 실행한 합계는 639(#91 로 minion_art 131→199) 다. 639 전부 변화 없이 통과했다. `ai_compare.js`(파일 출력 도구)는 실행하지 않았다.

### 3.2 신규 회귀 `smoke_shock.js` (65)
| 절 | 내용 | 개수 |
|---|---|---|
| A | 상수·문구·관련 기술 desc 외 필드 불변 | 7 |
| B | 감전 침 1000회 46.9% · rand 2회 · 결정론 · 부여→다음 라운드 후공→해제 순서 | 11 |
| C | 화상 70.0%/약화 70.0%/감전 46.9%(같은 1000 시드) · 같은 난수·다른 문턱(감전 성공 ⊂ 화상 성공 149⊂210/300) · 키 격리(`statusProb`↔`shockProb` 교차 0/100%) · 실패 로그 | 11 |
| D | 잔류장 100%·rand 1회 · 확률 키 0 이어도 100% · 지속형 본체 감전 침은 50% · 불 잔류장 rand 1회 | 7 |
| E | 레거시 비지속형 1000회 45~55% · 키 격리 · 화상 70% 유지 · 지속형 100%·2R·rand 1회 | 8 |
| F | 정화·해독제·전투 종료 해제 | 5 |
| G | AI +4 가산·확률 미참조 · 시뮬 완주 | 5 |
| H | AC7 동반 고정 (smoke_*.js 전부 스캔) | 2 |
| I | 전투 버튼 title · 로스터 팝업 50% | 3 |
| J | 음성 대조 6종 (효과기가 shockProb 무시 → 67.5% / 잔류장이 난수 굴림 / 화상이 shockProb 읽음 → 47.6% / 레거시 무시 → 66.8% / 문구 70% 복귀 / 보장 경로 난수 추가 소비) | 6 |

### 3.3 같은 시드 실제 제품 before/after (`node demo/test/shock_compare.js` — 11/11 PASS)
before = `git show dcb668e:demo/index.html`(메모리) · after = 현행. 같은 시드·같은 두 말·같은 행동.

| 항목 | before (dcb668e) | after (현행) |
|---|---|---|
| 감전 침 1000회 부여, 시드 창 96000/10000/20000/30000/40000 | 676 / 679 / 723 / 691 / 697 (67.6~72.3%) | **469 / 481 / 510 / 496 / 501 (46.9~51.0%)** — 5창 모두 after 성공 ⊂ before 성공 |
| 화상·약화 1000 시드 결과 벡터 | 676 / 676 | 676 / 676 (완전 일치) |
| 불 표준형 vs 물 지속형 완주 200판 로그·HP | 기준 | 200/200 완전 일치 |
| 번개 표준형 vs 불 방어형 완주 200판, after 에 `shockProb=0.7` | 기준 | 200/200 완전 일치 (감전 발생 판 포함) — 구조·순서·지속·해제 등가 |
| 같은 대진, after 기본값 0.5 | 기준 | 114판 동일 · 86판 갈라짐 (판정 난수가 0.5~0.7 에 든 판만) |
| 잔류장 번개 300회 | 100% | 100% · 이후 난수 상태 동일 |
| AI vs AI(5급·5급) 같은 시드 40판 총합 | 전투 432 · 감전 69 · 화상 98 · 약화 95 · 실패 93 | 전투 431 · **감전 55** · 화상 102 · 약화 98 · 실패 121 |
| 전투당 감전 / 판당 감전 | 0.160 / 1.73 | **0.128 / 1.38** |

[추론] 시뮬 40판은 감전 판정이 갈라진 뒤 판 전체가 달라지므로 총합·방향성 비교이지 판별 대응이 아니다. Venus 의 전역 `statusProb` 0.7→0.5 모형(-23%)과는 변경 변수·대진이 달라 **복제가 아니다** — 이 표는 `shockProb` 단독 변경의 제품 실측이다. 화상·약화 총합이 소폭 오른 것은 갈라진 판의 전투 구성 차이이지 확률 변화가 아니다(2a·2b 가 확률 불변을 고정).

### 3.4 실제 Chrome 실측 (`node demo/test/issue96_cdp.js` — 5측정 · 문제 0 · 콘솔 오류 0 · file:// desktop-1280)
| 장면 | 측정 | 증빙 |
|---|---|---|
| 0-consts | 페이지 안 `BAL.shockProb` 0.5 · `statusProb` 0.7 · desc 50% · 소스에 70% 감전 0 | JSON |
| 1-roster-info | 로스터 정보 팝업(M-L1 스파크) 감전 침 설명 "50% 확률 감전(후공 1회)" 표시 · 70% 없음 | `docs/qa/issue96/file_desktop-1280_1-roster-info.png` |
| 2-battle-cmd | PVE 전투(M-L1 vs M-G1) 커맨드 버튼 `감전 침 18~26` title = "50% 확률 감전(후공 1회)" | `..._2-battle-cmd.png` |
| 3-shock-apply | 실제 버튼 `window.__act(1)` 클릭(시드 1) → 로그 "감전 — 다음 1라운드 후공!" · 상태 "⚡감전1R" · HP 100→83 · 재생 후 라운드 2 가 **플레이어 선공("나의 턴")** 으로 열림 | `..._3-shock-apply.png` |
| 4-shock-fail | 같은 경로(시드 5) → "상태이상 부여 실패!" · 감전 없음 · HP 100→82 | `..._4-shock-fail.png` |

수동 확인: 스크린샷 3 에서 상대 패널 "HP 83/100 · ⚡감전1R" 과 라운드 2/6 "▶ 나의 턴" 이 보인다(감전 순서 효과의 실제 화면). 3.4 는 표기·사용자 흐름 확인이지 확률 측정이 아니다(확률은 3.1~3.3).

### 3.5 Saturn 재실행 경로 (파일 쓰기 없음)
```
node demo/test/smoke_shock.js            # 파일 쓰기 0 (음성 대조도 메모리 변형)
node demo/test/shock_compare.js          # git show 로 기준판 읽기만 · 파일 쓰기 0 · [--base <ref>] [--sims N]
node demo/test/issue96_cdp.js --read-only  # 스크린샷·JSON 없음, stdout 측정 JSON · 임시 Chrome 프로필만 생성·정리
```
`--read-only` 실행 뒤 `docs/qa/issue96/` 5파일 SHA 가 변하지 않음을 확인했다. 주의: `issue96_cdp.js` 를 `--read-only` 없이 실행하면 `docs/qa/issue96/` 의 PNG 4장·JSON 을 덮어쓴다.

---

## 4. 한계 · 미확정
- [미확정] 온라인 2클라이언트 실접속은 재지 않았다. 프로토콜·메시지·RNG 소비 순서가 변하지 않았고(B2·C4·비교 4) lockstep 양측이 같은 `BAL` 을 읽으므로 추가 동기화가 없다는 것은 [추론]이다.
- [미확정] 모바일 뷰포트·HTTP 스킴·비Chrome 은 이번 실측 범위 밖(문구·상수 변경이라 file:// desktop 만).
- [확정] 시드 창 96000 의 46.9% 는 45~55% 안이지만 하단에 가깝다. 1000회 표준편차 ≈1.6pt 이며 다른 4창은 48.1~51.0% 다. 확률 상수는 0.5 그대로이고 창 선택은 회귀 고정용이다.
- [추론] 승률·체감 밸런스는 재지 않았다. 규격대로 빈도 감소(전투당 0.160→0.128)가 본 지표이며 체감은 CJ 플레이 QA 소관.
- 통합 메모: PD 보고에 따라 #95 가 dev `dadc8bc` 에 `smoke_attack_balance` 와 함께 통합됐다. 그 테스트가 `statusProb=1` 을 고정하면 통합 후 `smoke_shock.js` H1 이 자동으로 잡는다(AC7 → `shockProb=1` 동반 필요). 이 기반(dcb668e)에는 없으므로 손대지 않았다.
- 제외: `docs/creat2ve/HANDOVER_SNAPSHOT.md` 의 변경은 PD 의 동시 편집이며 납품 목록에서 뺀다. `art/`·`orca-hook-latency-report.md`·Downloads·서버·기획·아트 미접촉.

---

## 5. 납품 파일 · 최종 SHA256

| 파일 | SHA256 |
|---|---|
| `demo/index.html` | `4089967c5433fa736d881ec3541057ae819b1a0274107ea45971c6f0259f5955` |
| `demo/test/harness.js` | `c6804d40baf1c5a2c0ff062c32e1efd22f02261f3ab638fea7199c7ccfb4a019` |
| `demo/test/smoke_cycle5.js` | `d7545e971263f47f26dad8b9f040b1756e8203a473b3cf3aefbd511390db279a` |
| `demo/test/smoke_minion_art.js` | `389f99311413e89330e5997cb541286111908329e6b2cdfca8df03a4c62de7e6` |
| `demo/test/smoke_shock.js` | `16fdb5c5b65dcfd7baf7a0d9b8047073b3cb30af11cdf22e418254935f267c34` |
| `demo/test/shock_compare.js` | `d975107e219d15314085745299ff9a7a1d452663217075150167947525e719b7` |
| `demo/test/issue96_cdp.js` | `6a4a16438021c387b6f0203dbc242a9bdf5b66675077e80ba33833b029943527` |
| `docs/qa/issue96/file_desktop-1280_1-roster-info.png` | `d51bb33c26adf4266d8f6fbaf6445c3be8ae9903acee91a26d924b765546333e` |
| `docs/qa/issue96/file_desktop-1280_2-battle-cmd.png` | `242ab5ac0fd931c05f9284e73b3b86a4eaacfa45bb4e48f21460c89a00c46c68` |
| `docs/qa/issue96/file_desktop-1280_3-shock-apply.png` | `a3870ef72919d99e9ee1becde00e8e2c07071c8c6fb4254bcf8c6adcbb5fce04` |
| `docs/qa/issue96/file_desktop-1280_4-shock-fail.png` | `b797fbaccd97f1fc3c7a8a0d696b8e6db6913f9ca5402db86d9b90241c04a5f2` |
| `docs/qa/issue96/issue96_cdp_report.json` | `4580cbc00053fd3a9887f3ca5bc839063154cd88c38e9aa6a3a6ddedd92e77f6` |

변경 전 기준 `demo/index.html`(dcb668e) SHA256: `90224fe64b89e2b9919ad9266d022cee38ee4159d92cec82b93c17e867c4cf2c`.

## 6. 문서 반영 위치 (PD 집행)
| 항목 | 저장소 | Notion |
|---|---|---|
| 감전 50% · `shockProb` 신설 · 잔류장 100% 유지 | `docs/v0.4.4-gameplay-spec.md` 4장 (계약 그대로, 갱신 불필요) | GDD-14 5.3 감전 행·D10 각주·D17 / GDD-16 3장 감전 침 50% / GDD-13 4.6 상태이상 한 줄 |
| 부채 (a)(b) | 규격 4장 [부채] 그대로 | GDD-14 D17 부채 2건 [기획 필요] |
