# Issue #244 — Ponytail·Saturn 모델·#234/#241 재QA 정리

## 결정

- Saturn_QA 기본값을 이번 재QA에서 실제 사용한 Codex `gpt-5.6-sol` · effort high · `service_tier=default`(No Fast)로 변경한다.
- Mercury·Mars·Jupiter·Saturn은 Ponytail full 필수, Venus는 eli-adult 우선 + 기술 기획 시 lite 조건부, Earth 순수 아트는 미적용한다.
- 다음 Mercury_PD 인수인계 세션만 CJ 지시에 따라 full access로 시작하며 다른 Worker로 권한을 확대하지 않는다.

## #234·#241 재QA

Saturn은 원격 `milestone/v0.4.11`의 `0b7f683`에서 Sol high·No Fast·Ponytail full로 READ_ONLY 검수했다. Mars와 Jupiter가 검수에서 확인된 동작 불변 dead code만 정리했고 Saturn이 최종 PASS했다. HIGH/MEDIUM 제품 결함은 발견하지 않았다.

| 범위 | 결과 |
|---|---:|
| 클라이언트 #234 | 351/0, exit 0 |
| 클라이언트 #241 | 83/0, exit 0 |
| 서버 #234 | 81/0, exit 0 |
| 서버 #241 | 74/0, exit 0 |
| `git diff --check` | PASS |

정리 범위는 `aimShot` 미사용 지역값, `v2RoundDecay` 미사용 인수, 중복 `cds` 초기화 두 곳, 서버 digest의 미사용 `counterSeq`, 그 폐기 필드를 위한 인위 불일치 테스트다. #233의 delayed-effect 계약과 #235 예약 상수는 보존했다.

## 구조 판단과 후속

약 7,157줄의 `demo/index.html` 단일 진입점은 현재 무의존 `file://` 데모에는 유효하지만 데이터·규칙·UI·AI·네트워크의 결합으로 유지보수 한계에 가깝다. Unity식 class hierarchy를 그대로 이식하지 않고, 선언적 effect/data table과 좁은 특수 hook, 결정론적 경계 테스트를 우선 검토한다. 실제 설계·구현은 하위 Issue #245에서 CJ의 별도 착수 지시를 기다린다.

미검증 범위는 브라우저 시각, 실시간 2-client 네트워크, 전체 suite, 확률 매트릭스, Roblox parity다. 이번 변경은 해당 영역을 수정하지 않아 최소 QA 계약에 따라 반복하지 않았다.
