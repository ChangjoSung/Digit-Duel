# #217/#218 클라이언트 독립 QA

2026-09-13 15:52 KST. Saturn task_1cf787bfbdaa / ctx_5bd53909c0cb, msg_1176e80cde5c. 파일 변경 0, 제품 판정 REVISE 1건.

독립 실행: public_rooms143/0, fx_consumer50/0, 실제WS VM1게임13/0(teleSwap35·fleeSwap5·fleeSkip1, 위치교환40회 직후 양측current/turnCount/revision 일치 및 후속진행). out_pub3의 전투/HP/KO·owner/wait모달·숨은아트경계·재접속안내/잠금/복귀·모바일설명·결과 스크린샷 직접 확인. battleId 표시순서, 점진HP, FX키별스케줄, reduced-motion computedstyle, 숨은정보경계, PCtitle+touch/keyboard설명무행동도 확인.

실제 외부 Render HTTPS/WSS create/list/join/ready/action/resign 수렴 통과. 배포HTML SHA256와 로컬 일치. 일반 브라우저 화면 전환은 이 시점 미측정: Orca eval은 isolated world라 uiStart undefined만으로 제품실패를 단정할 수 없다. root가 headless Edge CDP61091을 띄워 후속 검수 대상으로 제공했다.

잔여 결함: demo/index.html의 NET.fxBattleSnaps 정리 키필터가 숫자 정규식 대신 /^d+$/라 6전투 후1~6이 모두 남는다. Mars에 정규식 수정 및4개초과 회귀를 요청했다. 기존게임 전체 재시험 대신 해당 경계만 확인한다.

후속 task_697e06381684 / ctx_87bffe8f5f34에서 수정 경계와 일반Edge 외부시작버튼을 확인할 예정이다. 원래23검사 browserrun7에서S1은swap0회로미도달이며 제품불일치검출이 아니다. 실제WS VM의 양성교환근거와 브라우저미도달을 구분한다. wall-clock연출시간 계측은 제한사항이며 스케줄검사와혼동하지않는다.