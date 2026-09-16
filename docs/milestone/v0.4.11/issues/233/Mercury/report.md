# #233 전투 엔진 — Mercury 운영 기록

2026-09-16 CJ 구현 지시. 엔진 구현과 Saturn 독립 QA PASS 후 [PR #239](https://github.com/ChangjoSung/Digit-Duel/pull/239)를 생성했다(최초 커밋 9336afd). 최초 CI에서 기존 회귀의 회피·행동 순서 가정이 실패해 담당 부서가 보완한다. 최종 필수 CI 결과는 PR Checks를 따른다. CJ QA 전 병합·배포·Issue 종료는 진행하지 않는다.

## 범위·검증

- [Issue #233](https://github.com/ChangjoSung/Digit-Duel/issues/233), [GDD-23](https://app.notion.com/p/3dc1e7f1708580329da6fe4986654f7b) 3·4장과 5.6 공통 규칙.
- 기존 20종·기존 기술에 새 공통 엔진을 연결한다. 신규 30종/기술·시너지·경제는 #234~#238 범위다. 예고 피해는 공통 계약까지이며 실제 기술은 #234에서 추가한다.
- 구현 위치 C:/Users/pc_77/orca/workspaces/Digit-Duel/feature-233-combat-engine, feature/233-combat-engine. PR base milestone/v0.4.11 = 654a6e2c1c36fe825d3242c0fe464df494ef4cdb.
- 원본 milestone/v0.6.0·사용자 미커밋 파일·보호 경로·백업을 보존한다. Mercury는 운영 문서·Git·조정만 담당했다.
- Saturn Terra high READ_ONLY PASS: 클라이언트 집중 309/0, 서버 경계 547/0, 각 1회. 실제 단일 반올림·재부여·화상 R1 제외·공개 방 순서 복원·균열 상태 보너스를 확인했다.
- [최소 QA 정책](../../../../../creat2ve/QA_MINIMUM_POLICY.md)을 원본/구현 작업공간 CLAUDE.md·HANDOVER_SNAPSHOT.md에 연결했다. 수동 브라우저/네트워크 매트릭스는 실행하지 않았다. 필수 CI 6개는 PR에서 확인한다.
- 운영 이탈: Mars가 마지막 회귀 안정화 후 전체 회귀 3회 반복을 시작한 것을 07:13 UTC에 발견해 해당 터미널 interrupt로 중단했다. 이를 필수 QA였다고 기록하지 않는다.

## 실행·장애 이력

run run_a707c20dc15d, runtime 09f28a8f-e180-41c4-86e9-b80db7d516ea, coordinator term_a5fd21c2-b3f5-4678-ac58-02e61c76ccb7.

- Mars 초기 Sonnet 5 medium ctx_da3e0bf67ff1: 핵심 AC 누락·완료 주장 불일치·집중 검사 미작성 근거로 CJ의 교체 허용에 따라 failed/released. 변경물 보존.
- 같은 task_1e0e6643a392의 Opus 5 high 실행 인수로 ctx_53f16c9efb3a / term_da79a924-df92-47c5-a92e-ef38eeb5004c 시작. TUI 준비 후 turn_start observed, 모델 런타임 응답 claude-opus-5 확인. effort는 실행 인수이며 별도 런타임 노출은 없다.
- Jupiter task_874da829cbc2 초기 세 시도는 입력 유실·capability 누락으로 실패했다. 첫 ctx_5630a946e1be는 identity_unproven retained로 강제 종료하지 않았다. ctx_f035ad5611fa와 ctx_234ed27c5b76는 stopped/released, 유효 변경물은 보존했다. 인증 토큰 추측·내부 저장소 조회·재시도 제한 우회는 하지 않았다.
- CJ의 “Jupiter 복구 1회 허용”에 따라 같은 task의 ctx_db4d48884dc5를 TUI 준비 후 복구했다. 정상 heartbeat와 worker_done succeeded(msg_52473f0f108b)를 받았다. 같은 terminal term_44a4b791-e57d-4db3-afe6-4410f659497e를 최종 계약 통합 후속 task_d09a620c62e7 / ctx_4aeeae1e04d2에 재사용했다.
- Jupiter 후속도 succeeded(msg_782e1662bb6c), 경계 547/0. release는 external_terminal retained/processAction none으로 강제 종료하지 않았다. 성공 후 같은 범위의 통합이며 실패 복구 재시도가 아니다.
- Saturn 초기 정적 ctx_11f0d6e840da는 REVISE 후 archive captured/released. 최종 Sol high ctx_2bdec95d000a는 capacity 오류로 중단됐다. CJ의 Sol 대기 지시는 뒤의 “5.6 terra 로 QA 진행”으로 대체됐다.
- 같은 QA task_6f904a39ad59를 Terra high ctx_d4c8497de7b7 / term_271f6e15-a13a-4736-8c7e-5920e192b87c로 이어받았다. requested/effective 일치·turn_start observed·실제 응답 확인. PASS msg_73f58ec0f838 후 archive captured/released. Sol은 stopped/released(archive unavailable), 수신 지적 보존. 프로젝트/계정 기본 모델은 변경하지 않았다.

- PR CI 후속: Mars task_6dbcb77b8c4c / ctx_2d8c814c4ffe, Jupiter task_a17fbc018df9 / ctx_d44e5b5a957e. 같은 부서 터미널에 새 작업을 배정했다. 두 시작 영수증은 turn_start_unobserved였으나 실제 새 작업 응답·검사 수행을 확인했다. 재시도나 중복 Worker는 만들지 않았다.
- 후속 완료: Mars msg_1155d678f850(회귀 203/0·82/0·36/0), Jupiter msg_1533de283b51(서버 전체 PASS). 제품 변경 없이 테스트 준비 조건만 수정했고 두 release는 external_terminal retained로 존중했다. Jupiter가 종료 코드 확인만을 위해 서버 전체 검사를 2회 실행한 것은 중복 검사로 기록하고 추가 실행을 금지했다.

- CI 두 번째 실행의 추가 실패: Mars task_98222cb5a9bb / ctx_f0661d5f2be7은 레거시 기술 테스트의 선턴을 고정해 86/0(msg_ea1c5321df2a). Jupiter task_6df1d82033f3 / ctx_0b4b0e0b229c는 이벤트 40개 보관 한도에 걸리던 연속 전투 테스트의 시드를 고정해 최종 454/0(msg_973b37c95175). 제품 코드는 유지했다. 두 작업 모두 succeeded, release는 external_terminal retained다.
- Jupiter가 변경 테스트 1회 지시를 어기고 6회 실행한 사실을 07:34 UTC에 interrupt로 중단시켰다. 부서 보고서의 실제 실행 횟수를 보존하며 이를 필수 QA로 간주하지 않는다.

- CI 세 번째 실행은 서버·Windows·문서·자산·Roblox 5개 PASS, 클라이언트 cycle5 E6의 도망 귀속 가정 실패였다. Mars task_2c63a5078f18 / ctx_b41dc9afdff8이 속도·등급 동률 준비 조건을 추가해 70/0을 보고했다(msg_e2145d62e024). CI A 24개 파일의 행동자 의존 호출 정적 점검도 완료했다. release는 external_terminal retained다.
- 이 후속에서도 Mars가 정적 점검 지시를 넘어 7파일×3개 난수값 21회와 추가 배치 검사를 착수해 PD가 즉시 interrupt로 중단했다. 보고서에 위반을 남겼으며 전체 반복을 승인된 QA로 취급하지 않는다. 최종 필요한 검사는 PR 필수 CI다.

- 2026-09-16 CJ가 병합·#233 종료·소모량 절감을 승인했다. QA_MINIMUM_POLICY에 검사 횟수·보고 길이·PD 조회 제한을 추가했다. 문서 변경 후 CI의 battle-fx 타격 신호 간헐 실패는 새 Jupiter Sonnet 5 medium(ctx_bf72606d131f)이 테스트의 회피만 고정해 해결했다. 관련 검사 정확히 1회 454/0, msg_32a5c4d67964 접수·archive captured·released. 제품 코드는 변경하지 않았다. 최종 병합 상태는 PR #239를 따른다.

상세: [Mars](../Mars/report.md) · [Jupiter](../Jupiter/report.md) · [Saturn](../Saturn/report.md).
