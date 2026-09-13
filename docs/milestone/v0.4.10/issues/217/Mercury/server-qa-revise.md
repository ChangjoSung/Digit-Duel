# #217 독립 서버 QA — REVISE

2026-09-13 Mercury 기록. Saturn Task task_915de96cd7cd / Dispatch ctx_09177cc4d469의 실제 inline 재현 결과. 아직 최종 QA 보고 정산 전이며, npm test 통과와 별개로 수용 불가다.

- P0: 방어자 소유 모달도 _handleAction이 netActor/current로 인가한다. current=1, modal.owner=0에서 방어자는 E_NOT_ACTOR, 공격자는 같은 seq/index로 방어자 선택을 대신 실행했다(msg_0f6c561d6275).
- P0: WS t:leave 분기가 자격 검증 전 실행된다(server.js289-300). 위조 seatToken으로 OPEN 방 취소 재현(msg_eb240f4c5b27).
- 배치 _handleSetup이 중복/알 수 없는 roster, 잘못된 말 수를 수락하고 applyNetSetup이 무작위로 대체해 경기 시작. 잘못된 배치는 거부하고 ready 불변이어야 한다(msg_911a0f68ef4c).
- 왕/동료 UI가 내는 act.k basic/skill을 _sanitizeAction이 거부한다(room.js332, demo3077). 왕 전투 basic E_BAD_ENVELOPE 재현.
- toSeatView의 자기 말 alias가 heal/fleeSwap 입력에서 원본 ID로 번역되지 않는다. heal 수락 및 revision 증가하지만 healing/mainUsed 불변 재현.
- 전투/모달 중 skipMain·tele 가드 누락. minion 전투의 방어자 차례에서 skipMain 수락 후 공격자 mainUsed=true, 전투는 활성 상태 그대로(room305-311, demo5026).
- 유예 종료 _finalize가 revision을 올리지 않고, 시작 전 CANCELED 뷰 phase는 setup으로 남는다(room209-222,360-365).
- VM 격리는 개선됐으나 clearTimeout 없음, setTimeout ID=0, drain 지연 무시, 최대5백만 callback 후 잔여 큐 조용히 보존. 정상 PVP callback의 상태 변조는 미입증이며 bounded/cancellable 보장은 검증되지 않았다.
- authoritative HTTP는 health 외404, npm start/bat는 이전8080 relay 실행. 현재 client 기본 location.host/8080 경로와 통합되지 않았다. 서버 정적 호스팅은 Jupiter, 실행기·클라이언트 기본 접속은 Mars 소관으로 맞춰야 한다.

Saturn 파일 쓰기 없음. 최종 보고 및 재검수는 후속 기록으로 반영한다.

최종 판정: msg_f6e09924d526의 REVISE, 상세 재현 msg_9a62b8728ecf. 검수 Task 자체는 성공적으로 종료했으나 제품은 REVISE다. Saturn archive/release 완료. 새 Jupiter task_86c6d1b5d2e8 / ctx_bf9e2d04bdc5(Opus5 high)가 수정 책임을 받았다. 최소 fixture는 createEngine의 ROSTER 앞6종 ID와 zoneOf(0) 첫14칸으로 Room 양좌석 setup/ready. minion→king(cap) initBattle 후 modal.seq/index 동일 요청을 방어자/공격자로 비교, minion 대전 current act.k=0 뒤 defender skipMain을 비교한다.
