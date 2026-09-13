# Client FX 1차 구현 검토 — REVISE

2026-09-13 13:29 KST Mercury 코드 검토. Mars에 msg_fb1dc1057451로 수정 배정. 실제 시각 QA PASS가 아니다.

검토 당시 demo/index.html netFxResetCursorIfNeeded/Ingest/RenderOne/Pump 약5499~5580행:

1. battleId/scene 미소비, 현재 S.battle만 참조. 종료 후 마지막 hit/KO 소실 및 연속 전투 대상 오염 위험.
2. battleStart 단일 문구만 재생. 기존 3/2/1/시작 네 프레임 누락.
3. flash/sig/ko/st 미소비. hp/float만 있어도 무조건 shake하여 원본 신호와 불일치.
4. seq gap 및 seat 경계 미처리. 이전 timer generation 취소 없어 newroom/resume callback 오염.
5. playing 상태+빈 queue이면 수신 처리에서 현재 배너를 숨김.
6. 고정 duration이 기존 BAL.fx/motion reduction을 무시. 셀 class 제거가 없어 동일 셀 재발동 애니메이션 누락 가능.

기존 client 5 suites699 통과는 새 consumer 계약의 별도 검증 증거가 아니다. 위 동작을 검증하는 targeted tests와 실제 browser 화면 확인을 요청했다.