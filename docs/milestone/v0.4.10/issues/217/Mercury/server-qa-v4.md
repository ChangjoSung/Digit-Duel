# 서버 v4 독립 재검수 — Mercury 전사

2026-09-13 11:46 KST. Saturn `task_8151ad8709e1` / `ctx_f300f2be75f9`, 완료 메시지 `msg_b3fd761573ae`. 실행 영수증 Sol high requested/effective 일치. 저장소 파일 쓰기 0. **서버 범위 PASS**, 브라우저·아트·외부 배포 PASS를 뜻하지 않는다. Worker는 transcript captured/released 완료.

- `server`에서 `npm.cmd test`: 기존 5종과 권위 9종 모두 통과. scheduler 32, isolation 18, room 57, security 40, authority 176, fuzz 16, WS 50, HTTP 24, launcher 47.
- 별도 인메모리 재현: 방어자 modal 소유권과 구 seq 거부, 전투 중 skipMain/tele 거부·상태불변, 잘못된 배치 5종 거부·ready/revision 불변, heal/fleeSwap 별칭 반영, 왕/동료 기본 공격 적용, cancel/forfeit revision +1 및 종결 phase 확인.
- 좌석별 별도 엔진·동일 digest, 미공개 필드/로그 은닉, 스케줄러 지연 순서·취소·예산초과 후 pending 0 확인.
- 12시드×2500 실게임: 12/12 자연 왕 격파 승리, 수락 12,257·거부 1,720·잡음 3,506, 불변식 실패 0.
- 전용 `127.0.0.1:18731` 최신 서버 프로세스: health/root HTTP 200, 정적 498468 bytes/CSP, 실제 WS 위조 leave 거부·방 유지, 정상 leave CANCELED. 검증 후 포트 비수신 확인.
- mutation M14 미포착은 `_consumedModalSeq` 제거를 잡는 독립 회귀의 감도 공백이다. 현재 구현에는 방어가 존재하며 실제 제품 콜백은 overlay 종료 또는 seq 교체를 수행한다. 인메모리 stable-overlay 콜백에서 필드 존재 시 재전송 거부, 제거 시 성공-noop를 확인했다. 후속 회귀 권고이며 현재 제품 결함 판정은 아니다.

남은 범위: Mars 브라우저 최종 검증, CJ 추가 지시의 기존 아트 적용 누락 감사·복구, 최종 통합 QA/CI/PR, 실제 WAN/TLS 배포 및 장기 다룸 메모리 상한 검증. 아트 복구 때문에 서버 계약이 바뀌면 해당 변경은 다시 독립 검수한다.
