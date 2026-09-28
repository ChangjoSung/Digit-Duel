# #233 독립 QA — PD 기록

Saturn은 읽기 전용으로 검토하며 이 파일은 Mercury가 수신 결과를 기록한다.

## 최종 판정: PASS

2026-09-16 · `ctx_d4c8497de7b7` · gpt-5.6-terra high · 수신 `msg_73f58ec0f838`.

CJ가 Sol 용량 제한 확인 후 Terra로 QA 진행을 지시했다. 같은 QA task에서 이어받았으며 모델 requested/effective 일치와 실제 검토 응답을 확인했다. 최종 Worker는 archive captured/released했다.

- GDD-23 3·4장 및 5.6을 실제 엔진·서버 직렬화·락스텝 요약·공개 방 actor/phase 복원·pendingFx tag 계약과 대조했다.
- `node demo/test/regression/smoke_issue233.js`: **309 pass, 0 fail**, 1회.
- `node server/authoritative/test/test-combat-stats-boundary.js`: **547 passed, 0 failed**, 1회.
- 중간 반올림·실제 상태 재부여 수정과 `lightning_heavy`의 균열 대상 +6 누락 수정(실제 전투 및 AI 경로)을 확인했다. 추가 실제 결함은 발견하지 못했다.
- 파일 수정·보고서 생성·Git 쓰기·수동 브라우저/네트워크 QA·전체 회귀는 수행하지 않았다. 필수 CI는 PR에서 별도 확인한다.

예고 피해의 저장·취소·tag 계약은 검증했으나 실제 예고 기술 로스터는 #234 범위다. 아래는 수정 전 중간 검토 이력이다.

2026-09-16 · `ctx_11f0d6e840da` · gpt-5.6-sol medium.

## 중간 판정: REVISE

GDD-23 3·4장과 실제 실행 경로를 대조했다. 테스트 실행·브라우저 조작·파일 수정은 하지 않았다. 구현 중인 상태에서 발견한 항목이며 최종 판정이 아니다.

- 행동 순서가 여전히 라운드 홀짝에 의존해 속도·등급·접촉 개시자 비교를 적용하지 않는다.
- `gate`/`tryStatus`에 상태이상 확률 보너스를 가산하지 않는다.
- `pendingFx`와 왕·동료의 scalar `cd`가 전투 종료/시작 초기화에서 누락된다.
- 서버가 전달한 `crack`/`harden`/`hardenPct`를 온라인 `netSynthFighter`가 소비하지 않는다.
- 확정 치명 효과의 엔진 계약이 없다. 신규 기술 로스터 자체는 #234 범위로 구분한다.

Mars에 수정 요청했다. 방어막 제거 경로와 반사·반격의 비재귀 구조는 현 정적 범위에서 확인했다. 안정본 후 위 결함과 신규 전투 경계 검사를 중심으로 검증한다.
