# #238 통합 CI — 정적 요청 예산 (PR273 B 실패)

- 2026-09-28 · Jupiter(Claude Code `claude-opus-5-5` high) · task_acb0059ec684 · 범위 = SERVER · Git 쓰기 없음
- 작업 트리 `issue-264-render-compat`(`issue-238-integration` 병합 중). PD 가 `server/security.js` 와 이 문서만 `issue-238-integration` 으로 바이트 복사한다.

## 원인 [확정]
`server/test-static-load.js` 의 예산 계약은 실제 자산에서 프리로드 코퍼스를 만든다. #238 자산 증가로 코퍼스가 **82건**이 됐다:
index 1 + `demo/index.html` 의 CSS/JS 11 + 하수인 종 폴더 33 × {icon, battle} 66 + 리더 2 × {icon64, battle256} 4.
선언값 `STATIC_BUDGET.pageLoadRequests` 57(= 옛 54 + 여유 3)이 이를 담지 못해 B 가 실패했다.

## 수정 [확정]
- `server/security.js` `STATIC_BUDGET.pageLoadRequests` 57 → **82**(실제 최소 작업량). 근거를 주석으로 남겼다.
- 파생 한도 식은 그대로다: 버스트 = 82 × `concurrentPageLoads` 6 = 492, 초당 = 82 × 2 = 164(`server.js` LIMITS 가 같은 상수에서 계산).
- 테스트·게이트·Host/Origin/인증 코드는 건드리지 않았다. 이 버킷은 인증 경계가 아니다 — 업그레이드는 별도 버킷과 `AttemptLimiter` 가 막는다(`server.js` 기존 설명).
- [추론] `server/server.js:66,72` 주석의 "54 건"은 이제 낡은 설명이다. 이번 소유 범위 밖이라 고치지 않았다.

## 검증 — `node server/test-static-load.js` 1회, ALL STATIC LOAD TESTS PASSED
- 예산 계약: 코퍼스 82 ≤ 예산 82 × 6.
- negative: 같은 IP 동시 2명 164건/300ms — 수정 전 예산(60·30/s) 거부 96건, 수정 후 0건.
- 냉시작 1개 82건 실패 0 · 같은 IP 냉시작 2개 동시 164건 실패 0 · 연속 3회 246건 실패 0.
- 남발 1968건(0.29초) → 200 539 · 429 1429: 거부가 살아 있고 허용량은 상한(버스트 + 초당 × 경과) 이내.
- 다른 테스트가 57 을 고정 참조하지 않음을 검색으로 확인했다(`server/test*.js`, `ci.yml`). 전체 스위트·CI 는 재실행하지 않았다.
