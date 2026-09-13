# #217 / #218 최종 배포·QA 보고

2026-09-13 16:10 KST. [결정] 요청한 digit-duel 포함 주소로 외부 배포 완료.

- 플레이: https://digit-duel-mipa.onrender.com
- PR: https://github.com/ChangjoSung/Digit-Duel/pull/219 (base milestone/v0.4.10).
- 최종 제품 커밋620e99e, 필수 CI6 SUCCESS. 외부 HTML SHA256 8f5fc2b4338e144841a7fccc258228bf5a2406d9237cbe8796bdf54c6ca873c4가 검수 소스와 동일. /healthz ok.
- GitHub 연동 Render Free/Singapore, HTML·WSS 동일 출처, After CI Checks Pass 자동 배포.

| QA | 결과 |
|---|---|
| 외부 HTTPS/WSS | 방 생성/목록/참가/준비/행동/기권 상태 수렴 PASS |
| 일반 Edge 실제 클릭 | 튜토리얼→대전 시작→공개 로비, 예외·콘솔 오류0 |
| 모바일 기술 설명 | 실제 432px 브라우저 ⓘ 열기/닫기, 44px, aria, 상태 불변 PASS |
| 도망·텔레포트 동기화 | 표적 브라우저16/0: fleeSwap8/fleeSkip5/teleSwap1, 비교14·진행14·불일치0 |
| 독립 WS 위치교환 | 13/0, tele35/flee5 등 교환40회 일치·진행 |
| 실제 2클라이언트·재접속 | run_pub6 20/0, 전투 중 단절/안내/잠금/복귀/자연 종료 |
| 아트·정보경계·서버·WAN | 독립 QA PASS, 실제 전투 아트/HP/KO/모달 화면 확인 |
| 마지막 snapshot 정리 수정 | 독립 FX52/0, 4개 초과 정리와 진행 중 전투 보호 PASS |

Saturn 최종 msg_4432ac425656 / task_697e06381684 / ctx_87bffe8f5f34, 파일 변경0. 구현·검수 Worker 모두 정산/release, 활성·회수 대기0. QA용 root headless Edge 종료.

지연 원인은 표시 계층 누락 재작업, 실제 화면과 헤드리스 결과의 차이, 재접속 push 대기, 조정 메시지 처리 지연, 무작위 대전에서 교환 조건 미도달이었다. 중간 커밋으로 CI·배포를 병행하고 표적 시험과 변경 경계 재검수로 전체 대전 반복을 줄였다.

CJ 제공 사용량12% 대비 목표20%는 8%p 여유였으나 계정 사용량을 조회할 수 없어 최종 사용률·목표 준수를 보증하지 않는다. 구현 Worker는 종료했다.

남은 작업은 CJ 실제 휴대폰 플레이 QA와 승인 후 병합·릴리스 정리다. 현재 feature 후보 배포이며 main 배포·이슈 종료는 아직 하지 않았다. Render source가 feature/217-public-authority이므로 브랜치 삭제 전에 배포 기준 브랜치를 전환해야 한다. 무료 휴면 후 첫 접속 지연과 재시작 시 인메모리 방 소실이 있다.

문서 반영 위치: [배포](deployment.md), [최종 독립 QA](client-qa-final.md), [WAN QA](wan-deploy-qa.md), [서버 QA](server-qa-v4.md), [구현·스크린샷](../Mars/report.md).
