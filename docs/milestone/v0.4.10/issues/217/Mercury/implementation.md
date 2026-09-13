# #217 구현 — Mercury_PD

2026-09-13 CJ Comment **[결정] 구현 승인**. 직전 보고의 서버 권위 전환과 최소 공개 방 목록·생성·입장·준비 흐름을 구현한다. 이전 분석 문서의 구현 미승인 표시는 당시 이력이다. 유료 호스팅·도메인 구매나 외부 서비스 배포까지 승인된 것으로 해석하지 않는다.

## 납품 범위

- 서버가 현행 게임 규칙·난수·행동 권한을 판정하고 좌석별 허용 정보만 전송한다.
- 초대 코드 없이 공개 방을 생성하거나 목록에서 입장하고 준비 후 대전한다.
- 기존 오프라인 PVE·핫시트·시뮬레이션과 게임 규칙을 보존한다.
- 취소·이탈·재접속·결과·재대전 및 오류 흐름을 서버/클라이언트 계약에 맞춘다.
- #218의 로비 중 위 기능을 사용하는 데 필요한 흐름을 통합한다. 별도 아트 전면 개편은 포함하지 않는다.
- Notion 승인 및 본문·Decision Log 동기화, 독립 QA, 통합 PR을 납품한다.

## 실행

Run `run_a9e503daa1ce`. 현재 Unity 트랙과 미커밋 작업을 보존하기 위해 `origin/dev`의 `6a58f6f1cfcd5c178c7adcf6c42c072cdd10120c`에서 `milestone/v0.4.10`을 만들고, Orca의 분리 작업 공간에서 `feature/217-public-authority`를 사용한다. 트랙에 strict 필수 CI 6개·관리자 우회 금지·PR 필수 보호를 적용했다.

| 담당 | Task / Dispatch | 범위 |
|---|---|---|
| Jupiter_Server | `task_ccdb4d7bd1a8` / `ctx_4d8420442048` | server 및 서버 계약·검증 |
| Mars_Client | `task_8dede0154dd5` / `ctx_82b836b1e0aa` | demo 클라이언트·테스트·CI |
| Venus_Plan | `task_f95568fcf0d9` / `ctx_1272a2b339a2` | Notion·구현 수용 기준 |

세 Worker 모두 claude-sonnet-5 medium 요청/실효값과 실제 turn 시작을 확인했다. 모든 Task에 역할·mode·area·mutation·instance_index를 명시했다. 구현 Worker Git 쓰기 금지, Venus 코드 수정 금지, Saturn은 추후 파일 쓰기 없는 독립 검수로 배정한다.

## 결과

구현 진행 중. 최종 변경·검증·PR·남은 범위는 완료 시 이 절을 치환한다.

## 중간 검토·재작업 기록

- Jupiter 최초 protocol.md가 이동·기본 공격만 갖는 별도 게임으로 범위를 축소해 PD가 거부했다. 기존 전체 규칙을 보존하는 서버 엔진을 요구했고, 기존 applyAction 경로를 이용하는 headless adapter 또는 공유 규칙 추출을 안내했다. 초안의 단위 테스트 성공은 요구사항 전체 완료를 뜻하지 않는다.
- Mars 최초 보고 `msg_64876cf8c013`는 공개 로비 단위 테스트 40개와 기존 회귀 통과를 주장했으나 실제 서버 대전 연결·스냅샷 렌더·재접속·브라우저 증빙은 미완료였다. 부분 산출물로 보존하고 최종 구현 완료로 수락하지 않았다. 임시 seed/setup 교환 브리지는 PD 지적 후 제거했다고 보고했다. 해당 dispatch는 archive/release했고 서버 계약 후 연결 작업이 필요하다.
- Venus 최초 승인 반영 `msg_7bed3cebe9dc`는 DL69를 만들었으나 PD 실제 조회에서 잘못된 URL과 호스팅 결정을 구현 전 조건으로 표현한 문구가 남았다. `task_2a79e590a086` / `ctx_8a297689775c`로 한정 정정을 배정했다. 분리 작업 공간을 누락한 첫 재사용 호출은 preflight `terminal_worktree_mismatch`로 거절됐다. task-list로 새 Task가 생성되지 않았음을 확인하고 정확한 worktree를 명시해 시작했다.
- Earth 기존 시각 체계 가이드: `task_b42b8735deaf` / `ctx_01155d1f69b9`, Terra medium. 파일은 Earth/lobby-guide.md 한 개로 제한하며 제품 코드·신규 아트 제작은 맡기지 않았다.
- Venus 한정 정정 완료 `msg_9a67e7463fdb`: 잘못된 URL을 로컬 경로 표기로 바꾸고 호스팅 선택을 실제 외부 배포 전 조건으로 고쳤다. Earth 완료 `msg_87b1e51c57e6`. 두 최종 dispatch는 transcript 캡처 후 release했다.
- Mars 전체 연결 후속: `task_5493ab34cdf0` / `ctx_8118387cc58b`, Sonnet 5 high. 첫 시도의 핵심 요구 미달을 근거로 같은 부서 effort를 상향했다. 서버 전체 규칙 어댑터와 직접 계약을 맞추도록 배정했다.
- Saturn 사전 경계 감사: `task_57497f618942` / `ctx_3b9792f81f5c`, Sol high. 숨은 정보·행동 인가·동기화 핵심 경계에 대한 모델 계약을 적용했다. 현재 초안을 제품 PASS로 판정하는 작업이 아니라, 기존 엔진의 잘 드러나지 않는 검증 조건을 독립적으로 추출하는 READ_ONLY 작업이다. 파일 쓰기는 허용하지 않는다.
- Jupiter 최초 완료 `msg_2cf1210df25e`는 전체 엔진 재사용 및 새 테스트 48+27개 통과를 보고했으나 전역 복원 누락, 모달/로그 전달 누락이 남았다. 최종 납품 완료로 인정하지 않고 부분 산출물로 수락·archive/release했다. 후속 `task_da3d917e2b90` / `ctx_6142e99f4271`를 Sonnet 5 high 요청/실효 일치로 시작했다. 격리된 룸 엔진·네이티브 타이머·완전한 좌석 뷰·구 소켓 종료 경합을 서버 담당이 보완하고 Mars와 직접 계약을 맞춘다.
- Jupiter 후속 완료 `msg_8d02cc49313b`: VM 룸 격리·모달/로그/전투 필드·배치 명령 차단·구 소켓 close 경합 수정과 139개 검사 통과를 보고했다. transcript archive/release 후 `task_915de96cd7cd` / `ctx_09177cc4d469`에 Saturn Sol high 독립 서버 QA를 배정했다. 클라이언트 구현은 진행 중이며 이 서버 검수는 최종 두 브라우저 QA를 대체하지 않는다.
- 메시지 전달 지연 원인: Mars의 FIFO delivery 미확인(ACK 누락) 반복을 발견해 메시지함을 비우는 절차를 안내했다. 한정 운영 알림을 기존 터미널에 전달했고 수락 영수증만 확인했다(새 작업·소유권 이관 아님). Jupiter의 peer용 escalation이 run inbox로 도착한 건은 PD가 현재 Mars dispatch로 전달했다. enqueue를 읽음으로 간주하지 않는다.
- Saturn 서버 QA 최종 `msg_f6e09924d526` / 재현 상세 `msg_9a62b8728ecf`: REVISE, 파일 쓰기0. 139개 기존 검사 통과와 별개로 모달 소유권 탈취·전투 중 상대 주행동 소비·잘못된 배치 수락·정상 alias/basic 액션 실패·인증 전 leave·수명주기 revision 누락을 재현했다. 상세는 server-qa-revise.md. archive/release 완료.
- 동일 행동 권위/phase 검증 원인이 medium 및 high 두 차례에서 해결되지 않아 WORKER_MODELS 상향 규칙에 따라 Jupiter `task_86c6d1b5d2e8` / `ctx_bf9e2d04bdc5`, claude-opus-5 high 요청/실효 일치로 재작업을 배정했다. 실제 서버 권위·기본 실행 경로 및 회귀 검사를 수정하고 Mars와 연결한다. 출시·최종 QA 완료를 주장하지 않는다.
- Jupiter 회귀 검출력 검사 중 02:23~02:27 UTC에 작업 공간 서버 파일을 임시 변형했다. PD가 동시 브라우저 검증 간섭을 지적해 중단·별도 복사본 검사로 전환했고, msg_df89eb6e3bf0의 복원 보고를 MD5로 직접 대조했다(room ebbf5862344af67319fbf9e86502296e, server b57d0a8c217498138e7609f65849eae7, engine 9e206ae846c1847889f95235e68cae97). 세 파일 일치. Mars에 소유한 테스트 서버 재시작 및 해당 시간대 결과 재검증을 요청했다. 임시 변형 상태의 검증은 최종 근거로 사용하지 않는다.
