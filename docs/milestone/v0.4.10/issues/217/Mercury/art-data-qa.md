# 아트 표시 데이터 독립 검수 — Mercury 전사

2026-09-13 12:38 KST, Saturn Task `task_026d45a3ea43` / Dispatch `ctx_e6437fa06ae4`, 최종 메시지 `msg_a677ac4b9966`. Sol high 요청/실효 일치, 파일 변경 0. 완료 후 transcript captured/released.

**서버 아트 표시 데이터와 정보 경계 PASS.** 실제 브라우저 시각 수용 및 새 FX 이벤트 구현은 이 판정에 포함하지 않는다.

- 자기/B(미공개)/C-2(공개)/A(비가시), 전투 중/전투 후, 본체/실제 적 포획 예비/숲 포획 대리 출전: 소스 및 인메모리 독립 검사 67/0.
- 상대 미공개 기술의 id/name/cd 부재, 기존 token 외형 표시와 동치 확인.
- 초기 C-2 상대 하수인 rosterId 누락을 재현해 수정 요청. 최종 C-2 하수인은 실제 rosterId, 왕/동료는 null, B/A는 필드 없음 확인.
- 최종 security-gaps 61/0 및 smoke_minion_art 208/0 통과.
- C-2 rosterId가 없다고 적힌 낡은 주석/설명도 수정 후 원본 코드·protocol·art-restore-fields의 현재 계약 일치 확인.

관련 구현: `server/authoritative/room.js`, `server/authoritative/test/test-security-gaps.js`, `../Jupiter/protocol.md`, `../Jupiter/art-restore-fields.md`. 아트 누락 감사: `../Earth/art-omission-audit.md`.

남은 수용: Mars의 실제 두 좌석 전투·모달·결과·성공 재접속·모바일 증빙, 기존 전투 FX를 복구하는 별도 서버 표시 이벤트/클라이언트 소비 구현과 독립 QA. 정적 스프라이트만으로 전체 전투 연출 복구를 완료로 간주하지 않는다.
