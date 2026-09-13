# #217 사전 수용 경계 감사 — Mercury 취합

2026-09-13 Saturn_QA(Sol high) 메시지 `msg_721aa477eaa0`, Task `task_57497f618942` / Dispatch `ctx_3b9792f81f5c`를 Mercury가 기록했다. **소스 기반 사전 감사이며 제품 QA PASS나 테스트 실행 결과가 아니다.** Saturn은 파일을 수정하지 않았다.

| 우선순위 | 확인된 경계 | 필요한 독립 검증 |
|---|---|---|
| P0 | `netActor`, `actorOfPhase`는 current만으로 결정되지 않는다. 라운드/감전, 방어자 VIP 선택, fleePick 소유자를 구별한다. | 실제 행동자와 상대 좌석·다른 subphase·오래된 revision을 교차해, 정당한 선택은 성공하고 잘못된 요청은 상태 불변이어야 한다. 기권의 기존 current 규칙도 확인한다. |
| P0 | `renderBoard`의 숲 비가시 A, 가시 미식별 B, 공개 C와 전투 기술 공개가 독립이다. 가방·패키지·예비 말·흔적·메모·회복·VIP 선택도 좌석별이다. | 초기/푸시/재동기화/중복응답/오류/로그/모달을 모두 검사한다. 단순 JSON 문자열 검색만 하지 말고 좌석별 정확한 키 집합과 비공개 레코드 부재를 검증한다. 실제 종료 전 viewer=2 금지. |
| P0 | `applyAction`의 modal seq/index, `pkgOpen`, `battleModal`의 actSeq·round·phase가 오래된 콜백/중복 행동을 막는다. | 비공개 선택은 소유자에게만 도착하고, 오래된/중복 선택으로 턴·패키지가 두 번 소비되지 않아야 한다. 무료 패키지 선택은 전투 턴을 소비하지 않는다. 렌더·FX 큐가 행동 권한을 만들면 안 된다. |
| P1 | `newGame`, `setupDoneCore`, `applyNetSetup`: 카탈로그의 중복 없는 6종, 14개 말, 자기 진영 3행, 중복 칸 금지, 좌석1 미러링. | 잘못된 배치·통계·시드 주입은 상대/자기 ready를 변경하지 않고 거부한다. 정상 자기 배치 수정만 자기 ready를 해제한다. 재접속은 ready 유지, 양측 준비는 원자적으로 한 번만 시작한다. |
| P1 | `genEvents` 이후 `beginPlay` 선공 난수 순서를 포함해 전체 기존 난수 흐름이 규칙이다. | 동일 시드의 실제 엔진 상태·난수 소비를 사건/전투 경로까지 대조하고, 시드와 비공개 이벤트 좌표가 좌석 프레임에 없음을 확인한다. |
| P1 | `endTurn`은 전투/flee/teleport/강제 선택을 차단하고, 회복·소유자 immobilization을 정확히 한 번 처리한다. BT 표시 턴65 경계도 있다. | 중복 종료·단절·지연된 FX가 두 번 tick하거나 오래된 명령을 허용하지 않는지 확인한다. |
| P1 | 초기 `room._attach`가 구 소켓을 닫은 뒤 `server.js` close handler가 소켓 정체 검사 없이 `room.socketClosed(seat)`를 호출했다. | 기존 소켓이 열린 상태에서 재개한 뒤 구 close 이벤트를 발생시킨다. 새 좌석은 연결/ready를 유지하고 취소·몰수 타이머가 생기면 안 된다. |

위 항목은 현재 축소된 이동/기본 공격 커널과 미연결 UI를 완료로 인정하지 않는다는 전제다. 구현 후 실제 검증 결과를 별도로 기록해야 한다.

## PD 추가 확인 — 엔진 실행 환경

초기 `server/authoritative/engine.js`가 `demo/test/shared/harness.js`를 직접 require/load한다. 해당 하네스는 host global의 document/window/setTimeout/setInterval을 바꾸고, drain은 지연 시간을 무시해 콜백을 소진한다. 룸의 렉시컬 상태가 분리되어도 HTTP/WS·재접속 유예의 네이티브 타이머와 다른 룸 실행 환경을 보존한다는 근거가 되지 않는다. Jupiter에 `msg_88e54850a54d`로 per-room VM 등 격리된 실행 환경과 유한 스케줄러, 여러 룸 및 네이티브 타이머 지속 검증을 요구했다. 수정 전 제품 수용 불가이며 Saturn 최종 QA에서 독립 검증할 항목이다.
