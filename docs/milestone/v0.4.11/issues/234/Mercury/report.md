# #234 하수인 30종·왕·동료·전설 스킬 — Mercury 운영 기록

2026-09-17 CJ 지시: "#122 2차 전례 형태로 #234의 구현을 시작하세요." [PR #240](https://github.com/ChangjoSung/Digit-Duel/pull/240)이 CJ 플레이 QA를 기다리고 있다. CJ QA 전에는 병합·Issue 종료·배포를 하지 않는다.

## 예외 — 소급 정상화 금지
- **PD 실행기**: Codex 한도 초과로 Mercury PD를 CJ 승인에 따라 Claude Opus 5로 실행했다(정규 Sol high).
- **QA**: #122 2차 전례대로, Saturn(Codex) 교차 모델 QA 대신 구현하지 않은 Claude Opus 5 high 인스턴스가 READ_ONLY 백업 QA를 맡았다. 같은 계열 모델이 구현하고 검수했으므로 **CJ 플레이 QA가 최종 게이트**다.

## 결정·해석
| 항목 | 상태 | 근거 |
|---|---|---|
| 수풀 탐색 기술 교체 비활성(코드 보존) | **CJ 결정 2026-09-17** | Q1 |
| 천둥 낙인·흡수·굴 파기 | 확정(GDD 정의와 일치) | Venus Q2·Q9·Q11 |
| Q3~Q8·Q10·모래바람 | Venus 권고 적용 · CJ 승인 대기 | [interpretation.md](../Venus/interpretation.md) |
| 사신의 낫은 절대 판정 즉사(천년목·철벽·방어막·환영 무도·수면 포자 무시) | **CJ 결정 2026-09-17** | Q7 대체 |
| 사신의 낫 4라운드부터 · 전투를 넘는 봉인(사용 → 다음 참전 전투 봉인 → 그다음 전투 해제) | **CJ 결정 2026-09-17** | [추론·PD] 그 사신의 참전 전투로 센다 |
| 환영 무도+번식 포자 동시 → 무효 우선 | **CJ 결정: 현행 유지** | — |
| 전투 성사 후 등급·스킬 칸 수 노출 | **CJ 결정: 시스템 기획 의도** | [기획 필요]에서 제외 |
| [기획 필요] 6건 | CJ 판단 대기 | Mars 보고서 10장 |

Notion GDD-23·Decision Log 반영은 CJ 확인 뒤 PD가 진행한다.

## 실행 이력
run `run_8d0a50871c21`. 모든 Worker는 Claude Opus 5 high이고, 시작 영수증의 requested/effective가 일치했다.

| 부서 | task / dispatch | 결과 |
|---|---|---|
| Mars 구현 | task_d7d4f1654da6 / ctx_ae36d0f2c18a | succeeded · smoke_issue234 290/0 · 잡 A 클라이언트 27개 fail 0 · released |
| Venus 해석 | task_3f2c931398bd / ctx_bcc2d3834ee9 | succeeded · 11건 판정 · released |
| Jupiter 서버 | task_44ac03fc8173 / ctx_b09ec88665c4 | succeeded · boundary 47 · npm test exit 0 · public_live 23/0 · released(release 뒤 중복 worker_done은 Orca가 거부) |
| Saturn 백업 QA 1차 | task_d0d4ad0d879f / ctx_7495f6bf1e63 | **REVISE** — 결함 2(마녀의 장난 효과 0, 사신의 낫 전처리 우회) · 델타 재검수용으로 retain |
| Mars REVISE 1차 | task_35351a53ca36 / ctx_c56295af025f | succeeded · 296/0 · issue233 309 · cross_skill 86 · attack_balance 54 · released |
| Saturn 델타 재검수 | task_3d5a1d3e8061 / ctx_1a4b71a06ce9(같은 터미널) | **PASS** · released |
| Mars REVISE 2차(CJ 결정) | task_fab014027cdb / ctx_f6366a27695b | succeeded · 312/0 · search_packages 300/0 · released |
| Jupiter reaperSeal | task_2552349d6e73 / ctx_294068d38e54 | succeeded · boundary 68/0 · npm test exit 0 · public_live 23/0 · released |
| Mars 온라인 수신 후속 | task_4068c69685cf / ctx_206cc611326c | succeeded · 315/0 · fx_consumer 52/0 · released |
| Saturn REVISE 2차(새 인스턴스) | task_14e7b2797b9f / ctx_d2ee255cd0e8 | **PASS** · released |

## 검사 예산 이탈 (기록 보존)
- Mars 1차: 신규 검사 6회(제품 결함 1건과 검사 오류 수정마다 재실행), 잡 A 실패분 재실행 2회, 디버깅 `node -e` 5회.
- Jupiter: 경계 검사·authority-rules 각 2회(1회차 검사 설계 오류 수정).
- Mars REVISE: 신규 검사 2회(테스트 입력 난수값 고정 수정).
모두 수정에 따른 재실행이며, 통과 후 반복이나 다중 시드 전수는 없었다.

## Git·CI
- 브랜치 `feature/234-roster-skills` ← `milestone/v0.4.11` `33490f9`. Orca가 자동으로 붙인 브랜치 이름 `ChangjoSung/feature-234-roster-skills`를 저장소 규칙에 맞게 바꿨다.
- `60319fa` 구현 → 필수 CI 6/6 PASS([run 35179305716](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35179305716)).
- `df10bcd` REVISE 수정 → 필수 CI 6/6 PASS([run 35179876695](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35179876695)).
- `da724da` 문서 → 필수 CI 6/6 PASS([run 35180065811](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35180065811)).
- `a067270` REVISE 2차 → 필수 CI 6/6 PASS([run 35188047882](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35188047882)).
- 이 문서 커밋의 CI는 PR Checks를 따른다.

## CJ 플레이 QA 확인 범위
라이브에서는 30종 ⭐1과 왕·동료 스킬만 나온다. ⭐2~4와 전설은 상점(#236) 전까지 검사에서만 확인됐다. 새 10종은 전용 아트 없이 이모지 토큰으로 표시된다.
