# #262 HP 표기 보정 — Mars 보고 (2026-09-28)

분류: [피드백] CJ 최신 지시(2026-09-27) — 이전 "상대 전부 수치" 제안을 대체한다.
Worker: Mars (Claude Code `claude-opus-5-5` high · bypass · Ponytail full) · task_8e189f694aac / ctx_aaae6c799d12 · Git 쓰기 없음.

## 계약 (PD FULL GO로 합의)

| 구간 | 표기 | 담당 |
|---|---|---|
| 전투 노출 전 · 공개된 상대 말(보드) | 종전 `N%` 유지 | 변경 없음 |
| 미공개 상대 말 | 종전 `?`·추측 그대로 (새 정체·HP 없음) | 변경 없음 |
| 전투 중 전투원 패널 | 양쪽 모두 실제 `현재/최대` · 방어막·해일 표식·떠오르는 피해 수치에 `%` 없음 | Mars 표시 · Jupiter 서버 값 |
| 전투를 치른 말(보드) | 실제 현재 HP 숫자만 (`N/100`·`%` 없음) | Mars 표시 · Jupiter 서버 값 |
| 자기 말 | 형식 불변 | 변경 없음 |

기준 플래그는 말(개체) 단위 `hpSeen` 이다. `revealed` 는 함정(core.js:2033)·왕 끝줄(1867)처럼 전투 없는 정체 공개에도 켜지므로 쓰지 않는다.

## 변경 파일

| 파일 | 내용 |
|---|---|
| `demo/js/state.js:188` | `mkPiece` 기본 `hpSeen:false` (PD 범위 확장 승인) |
| `demo/js/core.js:1360` | `ECO_UNIT_KEYS` 에 `hpSeen` — 가방 교체 때 개체와 함께 이동, 교체되어 들어온 개체는 칸의 노출 이력을 물려받지 않는다 |
| `demo/js/core.js:1402` | `ecoMakeUnit` 기본 `hpSeen:false` |
| `demo/js/core.js:2296` | `startRounds` 에서 실제 전투원 `fa`·`fd` 에만 `hpSeen=true` (대리 출전이면 싸운 cap·가방 개체만, 왕·동료 본체는 아님) |
| `demo/js/ui.js:1556-1567` | `hpPctView(p)` — 공개 경제 방 · 상대 말 · `!p.hpSeen` 일 때만 `%`. 보드 칩·aria 라벨이 말 객체를 넘긴다 |
| `demo/js/ui.js:1327-1331` | 전투원 패널: `HP 현재/최대`, 해일 예고 title·상태 아이콘의 `%` 분기 제거 |
| `demo/js/network.js` | 떠오르는 피해 수치 `%` 제거·`netFxOppSide` 삭제 · `netStubPiece` 가 `hpSeen` 을 싣는다 |
| `demo/test/regression/smoke_fx_consumer.js` J절 | 기존 J1·J3 기대를 새 계약으로 교체, J5(노출 전 `N%`)·J6(노출 뒤 실제 숫자) 추가 — 새 테스트 파일 없음 |

HP 바 비율 계산·게임 규칙·타이머·이모트(위치·크기 #238 보류 포함)는 건드리지 않았다.

## 검증 (실측)

| 실행 | 결과 |
|---|---|
| `node demo/test/regression/smoke_fx_consumer.js` 수정 전 J절 그대로 | pass 55 / fail 1 (옛 J1 `%` 기대 — 의도된 계약 변경) |
| 같은 파일 J절 갱신 후 | pass 58 / fail 0 |
| `npm run typecheck` | 오류 0 (contracts.d.ts 변경 불필요 — `Piece` 가 mkPiece 리터럴에서 hpSeen 을 얻는다) |
| `smoke_issue236` (경제 교체·ECO_UNIT_KEYS) | pass 276 / fail 0 |
| `smoke_online_sync` | pass 23 / fail 0 |
| `smoke_issue262` (이모트 보존) | 55 passed / 0 failed |

한계: 전부 헤드리스 픽스처다. 실제 서버(room.js·engine.js)는 Jupiter 담당이라 이 보고 시점에 서버 값 실연결은 **미확인**이다. 320px 스크린샷은 찍지 않았다 — 문자 `%` 제거와 자기 말과 같은 `현재/최대` 형식 재사용뿐이고 배치·크기 변화가 없다. 서버 재시작·미리보기 재기동 없음.

## 서버 측 계약 (Jupiter 인계, 참고)

`_serializeKnownOpponent` 는 `economy && !p.hpSeen` 이면 종전 100 눈금, 아니면 실제 `hp/maxHp` + `hpSeen:true`. `_serializeBattle`·FX 문구/수치는 전투원 양쪽 실제값. 보드 회복 틱 로그는 `hpSeen` 일 때만 실제값. 등급·가방·서브타입·미사용 스킬 필드는 추가하지 않는다.

## 확정 / 추론 / 미확정

- 확정: 위 변경 파일과 실행 결과.
- 추론: 전투 중 실제 최대 HP 와 공개된 종 이름으로 상대 등급을 역산할 수 있다 — CJ 가 실제 `현재/최대` 를 명시했으므로 따르며, 등급 필드 자체는 보내지 않는다. 대리 출전 본체 제외·개체 추종은 PD 해석이다.
- 미확정: Jupiter 서버 반영 후 실제 두 좌석 연결 표시 · CJ 플레이 QA.
