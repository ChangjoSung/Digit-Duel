# #293 QA REVISE — 실제 사용량 기록

2026-10-01 Mercury_PD. 이번7건 QA 입력 이후의 원시 계측이다. Mercury는 해당 입력 직전 누적 token_count를 차감하고 Worker는 새 세션 시작0과 완료 스냅샷을 대조했다. 최종 답변·아래 측정 종료 이후 토큰은 포함하지 않는다.

## Codex

입력에는 캐시 읽기 부분집합, 출력에는 reasoning 부분집합이 포함된다. 열을 모두 더해 총량으로 계산하지 않는다. cache-write 계측은 모두0.

| 역할 | 입력 | 캐시 읽기 | 출력 | reasoning | 입력+출력 |
|---|---:|---:|---:|---:|---:|
| Mercury QA 작업 구간 | 27,951,390 | 27,020,160 | 202,433 | 100,347 | 28,153,823 |
| Earth 기존 계약 | 1,849,119 | 1,727,744 | 32,796 | 27,040 | 1,881,915 |
| Earth 시각 정정 | 777,456 | 715,776 | 9,073 | 6,879 | 786,529 |
| Saturn 독립 QA | 15,064,820 | 14,629,504 | 45,041 | 23,674 | 15,109,861 |

Mercury 기준 QA 입력 시각17:34:07 KST, 직전 누적 입력57,626,365/출력364,630. 마지막 가시 token_count `2026-10-01T11:37:30.216Z`(20:37:30 KST), 누적 입력85,577,755/출력567,063까지 차감했다. Mercury/Saturn은 Sol6.1 xhigh/default, Earth는 Luna xhigh/default, 실제 권한full-access/never.

## Claude

9개 새 native 세션의 assistant message.id로 중복 제거하고 누적 필드 최대값을 합쳤다. 스트리밍 반복을 단순 합산한 앞선 Venus 집계는 사용하지 않는다. Claude cache 입력은 별도 필드이며 Codex 스키마와 다르다.

| 역할 | 비캐시 입력 | 캐시 생성 입력 | 캐시 읽기 입력 | 출력 | reasoning |
|---|---:|---:|---:|---:|---|
| Venus | 80 | 466,338 | 7,656,940 | 74,625 | 별도 미노출 |
| Mars | 426 | 939,176 | 59,820,381 | 283,296 | 별도 미노출 |
| Jupiter | 130 | 537,850 | 11,159,892 | 103,097 | 별도 미노출 |

모두 실제 claude-opus-5-5/high/native bypass. 동일 세션 후속 lease를 새 세션처럼 중복 계산하지 않았다. Mars 구현·팝업/불투명도 후속, Jupiter 서버/결과, Venus 분석/계약/Notion을 포함한다.

구독 잔여량·실제 청구액·환산 금액은 제공되지 않았다. 캐시 토큰을 비용 절감액이나 구독 소진율로 환산하지 않는다. 원시 기준/세션별 집계는 운영 archive의 root-usage-window-baseline-discovery.json·usage-ledger-Claude-complete.json·각 completion-model-usage.json과 usage-ledger-final-recording-point.json에 보존한다.
