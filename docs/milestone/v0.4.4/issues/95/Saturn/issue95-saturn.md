# Issue #95 — Saturn_2 독립 QA PASS

2026-09-07 · Mercury가 inline 납품 `msg_1106ce642379`를 보존했다. Saturn_2 / QA / QA / mutation=none / instance_index=2 / Codex, `files_modified=[]`, reportPath 없음. Task `task_8c4786c4c8ea`, dispatch `ctx_20d345dcde3a`, 완료 후 release.

검수 HEAD `4bc2db1eb8341290ec091cd742c44e6680bc0d8a`, 통합 기준 dev `dcb668e8c8a373e1a903834e3152ae82f526cfcd`(#91 포함).

**PASS.** 제품 변경은 공격형4종 atk26→25 및 결정타 pow44→40의 정확히 5줄이다. 메모리에서 이 5개 값을 되돌린 전체 HTML이 기준 dev와 같음을 확인했다. 다른16종·22기술·BAL·AI·교대 구조는 그대로다.

## 직접 검증

| 명령/검사 | 결과 |
|---|---|
| `node demo/test/smoke_attack_balance.js` | 50 PASS |
| `node demo/test/smoke_cycle5.js` | 69 PASS |
| `node demo/test/smoke_memo.js` | 49 PASS |
| `node demo/test/smoke_tutorial.js` | 124 PASS |
| `node demo/test/smoke_testclient.js` | 41 PASS |
| `node demo/test/smoke_minion_art.js` | 199 PASS |
| `node demo/test/attack_balance_compare.js` | N150·seed5000 재현, stdout 결과표 일치, 15.9초 |
| `node demo/test/issue95_cdp.js --read-only` | file/http 8측정, 문제0, 캡처0; 결정타 실제45 피해·HP100→55 |
| 원래 수치를 복구한 HTML 메모리 사본으로 동일 신규 스모크 | 예상 실패27, 통과23, exit1 |
| 독립 Node stdin 4속성 실제 execSlot·전투 UI | 피해16/16·표기16/16 |
| 비교 JSON 원본 셀 집계 | 80/80 합계·분모·미러 기여 대조 |
| 신규 JS3파일 구문·Git diff/status·최종 해시 | 정상, 파일 변경0 |

직접 스모크 **532/532**이며 추가32개 실제 피해/UI 확인과 JSON80개 집계는 별도이다. 산술을 재계산하는 B단언 일부는 독립 execSlot·UI 검증으로 보완했다. 원본 `smoke_online.js`는 파일을 작성하므로 실행하지 않았고 온라인157은 Mars 증거이다.

## 통계 판정

같은 seed·대진에서 양측 공격형 모두 새 값으로 조정한다. 도망은 없애지 않고 미결로 별도 집계한다.

| 지표 | 이전 | V6 |
|---|---:|---:|
| 후공−선공 격차, 도망 제외 결판 | 14.9356pt | 10.0798pt |
| 후공−선공 격차, 전체 판 | 14.2333pt | 5.2000pt |
| 비미러 결판 격차 | 3.5144pt | 7.1096pt |
| 불 속성 결판 격차 | 17.3675pt | 18.2494pt |

전체 격차 개선 중 미러 대진 기여는5.1pt이다. 미러 도망 수는 선공/후공 각각 기존128/128, V6 121/121로 **대칭**이다. 비교 스크립트의 역할별 도망 비대칭 제목과 미러 격차0 불가능 주석은 과도한 해석이며, 정정한 PD/Mars 보고와 위 원본 수치를 기준으로 읽는다. 제품·테스트 수정을 요구하지는 않았다.

AC3는 지정한 AI 모형의 전체 집계 방향 확인이다. 비미러·불 대진의 결판 격차는 증가했고, 분산 상단106은 여전히 HP100 제거가 가능하다. 전체 균형 해결이나 사람 플레이 개선의 보장이 아니다.

## SHA-256

| 파일 | SHA-256 |
|---|---|
| `demo/index.html` | `bda17a75cac50718d4aee2286589ffc4f96553152a924332bd0ba1184daa419b` |
| `demo/test/harness.js` | `c04df34ccb04a36fbc34598b046d523292e85b9005ea4ddccabf0f750919e765` |
| `demo/test/smoke_attack_balance.js` | `4f132e56190ced5c6ae8c9abe69b10affe2f8136424555a1202ec2e9d10333fe` |
| `demo/test/attack_balance_compare.js` | `1153f155f19aa823cf233ad12e247a7f7789cb46253e3a14b29293c5da96292d` |
| `demo/test/issue95_cdp.js` | `76a74f77da991a6bcd14bc0b5103e20a14efd64ad0d7cf522059ae7a921acc57` |
| `docs/qa/issue95/attack_balance_compare.json` | `9780bba913cb758bb7955a8c6d67d97209fe99f0570c93aa9b6fe4facd598273` |

## 한계·자원

N1000·다른 시드 민감도는 재실행하지 않아 Mars 증거로 남는다. 사람 플레이·모바일/비Chrome·실제 온라인2연결·전체 아트82 CDP는 이번 검수 범위 밖이다. Chrome 확인은1280×800의 DOM·실행 상태이며 모든 시각/네트워크 오류를 탐지하는 검사가 아니다.

도구의 쓰기 차단·자체 프로필 정리를 읽고 실행했다. 해당 Chrome91772·서버67700은 종료됐고 정확한 자체 임시 프로필 제거를 확인했다. 파일·캡처·JSON 작성0, Git/GitHub/Notion 쓰기0. 남은 단계는 PD dev 통합 및 CJ 플레이 확인이다.
