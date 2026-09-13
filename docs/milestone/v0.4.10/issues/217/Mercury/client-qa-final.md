# #217/#218 클라이언트 독립 QA — 최종 PASS

2026-09-13 16:10 KST. Saturn task_697e06381684 / ctx_87bffe8f5f34 / msg_4432ac425656. 읽기 전용, 파일 수정0.

최종 index SHA256 8f5fc2b4338e144841a7fccc258228bf5a2406d9237cbe8796bdf54c6ca873c4. 독립 FX52/0: E5/E5b에서 전투6개 중3~6 유지, 진행 중 오래된 전투 보호 및 다음 오래된 비보호 기록 제거. 초기 숫자 키 정규식 오류는 Mars 수정 후 재검수 PASS.

CDP Edge153 실제 포인터 클릭으로 튜토리얼→대전 시작→공개 대전 표시. 방 생성·새로고침 활성, 예외0·콘솔오류0. Orca eval isolated world의 uiStart undefined는 제품 결함으로 재현되지 않았다. QA 당시 배포는 이전 버전, 이후 root가 최종 배포의 위 SHA256 일치를 확인했다.

앞선 독립 msg_1176e80cde5c: public_rooms143/0, fx_consumer50/0, 실제WS VM13/0(teleSwap35/fleeSwap5/fleeSkip1, 교환40회 양측 current/turnCount/revision 일치·후속 진행). 전투 아트/HP/KO/모달/숨은정보/재접속/모바일 설명 화면 확인. 실제 외부 HTTPS/WSS create/list/join/ready/action/resign 수렴 PASS.

구현자 실제 브라우저 run_pub6 20/0. run_pub7 모바일 ⓘ432px/44px/aria/상태불변 PASS, 교환 조건0회 미도달1건은 표적 run_swap2 16/0(fleeSwap8/fleeSkip5/teleSwap1, 비교14·진행14·불일치0)으로 보완. [구현·증빙](../Mars/report.md).

한계: CJ 실제 휴대폰 QA 미실시, 브라우저 teleSwap 표본1회, 연출 wall-clock 계측 제한, 튜토리얼 닫기 aria-hidden 잔류 포커스 비차단 경고1개. 동시에 보호 중인 전투가4개 초과면 snapshot도 일시4개를 넘을 수 있다. 마지막 변경 경계만 재검수하고 기존 전체 대전 근거를 보존했다.
