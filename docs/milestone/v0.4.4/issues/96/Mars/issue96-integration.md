# Issue #96 — origin/dev dadc8bc(#91+#95) 통합 후 검증 보완 (Mars_3)

- 역할: **Mars_3** (required_role=Mars · instance_index=3 · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- Task `task_c2a67f863ffb` · dispatch `ctx_1e7db194c922` · 브랜치 `fix/96-shock-probability` · HEAD `9405c32`(PD 병합 커밋: `be9cbca`(#96) + `dadc8bc`(#91·#95)) · 작성 2026-09-07
- 최초 납품 보고 `docs/qa/issue96-mars.md` 는 그대로 보존한다. 그 문서의 3.3 절 수치(기준 dcb668e · AI 전투당 감전 0.160→0.128)는 **#95 미반영 기반의 역사 자료**이며 이 문서의 새 비교와 혼동하지 않는다.
- 표기: [확정] 코드·측정 사실 / [추론] 해석 / [미확정] 이번에 재지 않은 것. Saturn 독립 QA 이전이므로 "검증 완료"를 주장하지 않는다.

## 1. 변경 (제품 변경 0 · 테스트 2파일 · 문서 1)

| 파일 | 변경 | 이유 |
|---|---|---|
| `demo/test/smoke_attack_balance.js` :68 | `T.BAL.statusProb=1;` 옆에 `T.BAL.shockProb=1;` 1줄 핀 | AC 7(`statusProb=1` 고정 스위트는 `shockProb=1` 동반). 핀 없이 실행하면 `smoke_shock` H1 이 `[smoke_attack_balance.js:68]` 을 잡아 64/65 FAIL — 아래 3절 증거 |
| `demo/test/shock_compare.js` :1·:3~4·:11 | 기본 baseline ref `dcb668e` → `dadc8bc` + 설명 주석 2줄. 알고리즘·판정·기대값 불변 | 기본 before 를 #95 반영 시점으로 옮겨 before/after 차이를 #96(`shockProb`) 단독으로 귀속 |
| `docs/qa/issue96-integration.md` (이 문서) | 신규 | 통합 후 비교 결과·귀속 기록 |

`demo/index.html` · harness · 다른 테스트 · 기획 · 아트 · `docs/qa/issue96/` PNG 4장·JSON 은 손대지 않았다. `git diff --stat dadc8bc HEAD -- demo/index.html` = +9/−8 (최초 보고 1절의 #96 5개 변경만) [확정].

## 2. 헤드리스 스모크 8종 (Node v24.16.0, 저장소 루트, 통합 HEAD)

```
node demo/test/smoke_cycle5.js        69/69
node demo/test/smoke_memo.js          49/49
node demo/test/smoke_online.js       157/157
node demo/test/smoke_minion_art.js   199/199
node demo/test/smoke_tutorial.js     124/124
node demo/test/smoke_testclient.js    41/41
node demo/test/smoke_attack_balance.js 50/50   (#95 신규)
node demo/test/smoke_shock.js         65/65   (#96 신규 · 감전 침 1000회 469/1000 = 46.9%)
```
합계 **754 / 754 PASS** (기존 639 + #95 50 + #96 65, PD 예상치와 일치) [확정].

## 3. 핀 필요성 증거 (H1)

`smoke_attack_balance.js` 의 핀만 잠시 되돌리고(`git stash push -- 해당 파일`) 실행 → 복원:
```
FAIL: H1 statusProb=1 고정 행마다 shockProb=1 동반 [smoke_attack_balance.js:68]
=== smoke_shock: pass 64 / fail 1 ===
```
핀 복원 후 65/65. 즉 통합 시점의 dev 에 있던 #95 테스트가 AC 7 계약을 아직 몰랐고, 핀 1줄이 그 간극을 메운다 [확정]. `smoke_attack_balance` 의 50단언은 핀 전후 모두 50/50 — 그 스위트는 감전 부여를 검사하지 않으므로 핀은 결정론 계약 준수용이지 결과를 바꾸지 않는다 [확정].

## 4. `node demo/test/shock_compare.js` 새 기본 dadc8bc — 11/11 PASS

before = `git show dadc8bc:demo/index.html`(메모리, #95 반영·#96 미반영) · after = 현행 HEAD(#95+#96). 양쪽 #95 동일 → 차이는 `shockProb` 뿐.

| 항목 | before (dadc8bc) | after (현행) | dcb668e 기준 최초 보고와 |
|---|---|---|---|
| 감전 침 1000회 부여, 시드 창 96000/10000/20000/30000/40000 | 676 / 679 / 723 / 691 / 697 | **469 / 481 / 510 / 496 / 501** · 5창 모두 after 성공 ⊂ before 성공 | 완전 동일 |
| 화상·약화 1000 시드 결과 벡터 | 676 / 676 | 676 / 676 (완전 일치) | 완전 동일 |
| 불 표준형 vs 물 지속형 완주 200판 로그·HP | 기준 | 200/200 일치 | 완전 동일 |
| 번개 vs 불 방어형 200판, after `shockProb=0.7` 고정 | 기준 | 200/200 로그·HP 일치 (구조 등가) | 완전 동일 |
| 같은 대진, after 기본 0.5 | 기준 | 114 동일 · 86 갈라짐 | 완전 동일 |
| 잔류장 번개 300회 | 100% | 100% · 이후 난수 상태 동일 | 완전 동일 |
| AI vs AI(5급·5급) 같은 시드 40판 총합 | 전투 430 · 감전 77 · 화상 111 · 약화 94 · 실패 96 | 전투 418 · **감전 58** · 화상 110 · 약화 91 · 실패 127 | **다름 (아래 귀속)** |
| 전투당 감전 / 판당 감전 | 0.179 / 1.93 | **0.139 / 1.45** | 다름 |

[확정] 1~4 항목(감전 침 부여율·화상/약화 벡터·보장 상태 100%·고정 확률 로그 등가)은 기준을 dcb668e 로 두었을 때와 수치가 **완전히 같다** — #95(공격형 위력 완화)는 상태이상 판정·RNG 소비 경로를 건드리지 않았다는 실측.

### 귀속 차이 (AI 40판)
| 비교 | before | after | 전투당 감전 |
|---|---|---|---|
| 최초 보고(기준 dcb668e, after 도 #95 미반영) | 전투 432 · 감전 69 | 전투 431 · 감전 55 | 0.160 → 0.128 |
| `--base dcb668e` 재실행(after 는 현행 #95+#96) | 전투 432 · 감전 69 | 전투 418 · 감전 58 | 0.160 → 0.139 |
| **새 기본 `dadc8bc`(양쪽 #95 반영)** | 전투 430 · 감전 77 | 전투 418 · 감전 58 | **0.179 → 0.139** |

- [확정] after 쪽 수치가 최초 보고(431/55/0.128)와 달라진 이유는 after 제품이 #95 를 포함하게 됐기 때문이다(전투 418 · 감전 58 · 0.139 는 `--base` 와 무관하게 동일).
- [확정] before 쪽 432→430·69→77 은 dcb668e→dadc8bc 사이의 #95 변경(공격형 위력 완화로 전투 길이·전개가 달라짐)에 의한 것이다.
- [추론] #95 적용 후 감전 빈도의 절대값이 양쪽 다 오른 것(0.160→0.179, 0.128→0.139)은 공격형 위력 완화로 전투가 길어져 판정 기회가 늘어난 결과로 보인다. #96 단독 효과는 새 기본에서 **0.179→0.139(−22%)**, 판당 1.93→1.45 — 최초 보고의 −20% 와 방향·크기가 같다. 시뮬 40판은 시드 분기 후 판이 갈라지는 총합 비교이지 판별 대응이 아니다.
- [미확정] 승률·체감 밸런스는 재지 않았다(CJ 플레이 QA 소관). Chrome 실측(`issue96_cdp.js`)은 제품 표기 변경이 없어 재실행하지 않았다 — `docs/qa/issue96/` 5파일 불변.

## 5. Saturn 재실행 경로
```
node demo/test/smoke_attack_balance.js && node demo/test/smoke_shock.js   # 50 · 65
node demo/test/shock_compare.js                  # 새 기본 dadc8bc · 11 · 파일 쓰기 0
node demo/test/shock_compare.js --base dcb668e   # 최초 보고 재현(역사 자료)
```

## 6. 납품 파일 · SHA256

| 파일 | SHA256 |
|---|---|
| `demo/index.html` (통합 HEAD, 이번 변경 없음) | `c14a5178e73635da7d25441637a8c0f1851d00324c293422d49af24c34dda5c3` |
| `demo/test/smoke_attack_balance.js` | `e7479403eba06e38796f6087b799d6ac86eec92f97d81430a3a7c2a83fcef5a8` |
| `demo/test/shock_compare.js` | `141fd5f52f03554f7682b58d84f859524fb4c7450f973958c0805172711da77d` |
| `demo/test/smoke_shock.js` (불변) | `16fdb5c5b65dcfd7baf7a0d9b8047073b3cb30af11cdf22e418254935f267c34` |
| `demo/test/harness.js` (불변) | `c6804d40baf1c5a2c0ff062c32e1efd22f02261f3ab638fea7199c7ccfb4a019` |

기준판 `dadc8bc:demo/index.html` SHA256: `2c2ee45927fe6717106cdb9f8fc5c4eae9969dfa08586e5ac2e191cbe2c29c74`.
제외: `.gitattributes`·`docs/creat2ve/HANDOVER_SNAPSHOT.md` 는 PD 동시 편집, `art/`·`orca-hook-latency-report.md`·Downloads 미접촉.

## PD 운영 기록

Mars가 핀 음성 대조에 Git stash 쓰기를 사용했다고 보고했다. 이는 Git 쓰기를 PD에 한정한 작업 계약 위반이다. 현재 stash 잔여 0과 납품 diff를 확인했으며, 해당 검증 방식은 후속 작업과 Saturn에 허용하지 않는다. 이후 음성 대조는 메모리 내 입력 변형으로 수행한다.
