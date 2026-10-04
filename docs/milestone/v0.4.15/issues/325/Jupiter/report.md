# #326 서버 회선 계약 — Jupiter 보고

- 작성: 2026-10-04 Jupiter_Server (Claude `claude-opus-5-5` high · Ponytail full) · task_2464329e04dd / ctx_42e9d2066949
- required_role=Jupiter · mode=IMPLEMENT · area=SERVER · mutation=code · instance_index=null
- 기준: [Venus spec §1.4](../Venus/spec.md) · base `origin/milestone/v0.4.15` `f57c936`
- **판정: 구현 완료(implementation-complete).** 자체 QA PASS 가 아니다 — 독립 판정은 Saturn 몫이다.

## 1. 바꾼 것 [확정]

| 파일 | 내용 |
|---|---|
| `server/authoritative/room.js` | `_serializeBattle` `side()` 에 `effectiveStats` 와 나란히 `kingdomProc` 한 칸. 회선 어휘 `KINGDOM_PROC_KINDS`(5종) 상수 1개 |
| `server/authoritative/test/test-combat-stats-boundary.js` | #326 블록 추가(3b 안, #316 블록 뒤) |
| `server/authoritative/test/test-issue235-boundary.js` | G5(식 재구현 없음) · R4/R4b(실제 참전 경로 값 · 양 좌석 동일) |

- 값은 공용 Core 헬퍼 `kingdomProcView(f)`(Mars · `demo/js/data.js:640`) 하나가 낸다. 서버는 **식을 갖지 않고** 닫힌 값만 새 객체로 옮긴다: `state` 3종 · `kind` 5종 · `p` 유한 0~1 원값(반올림 없음). `active` 가 아니면 `kind`·`p` 는 언제나 `null`.
- 헬퍼가 없거나 출력이 계약 밖이면 칸 값은 `null`(화면 `—` · 대체 계산 없음). 헬퍼가 여분 칸을 돌려줘도 회선에는 셋만 나간다.
- `effectiveStats` 는 6칸 그대로, `statusPct` 가산치도 그대로다. `synEl` 원본(mag·rounds·hits) · `synStatusPct` · 칸 수는 계속 싣지 않는다.
- `engine.js` **무수정**: `runtime.js` 가 `data.js` 최상위 선언을 자동 노출하므로 노출 목록을 손댈 곳이 없다(테스트 G5 가 네임스페이스 존재를 고정).
- 양 좌석 · 양 전투원 동일(뷰어 분기 없음). 전투가 끝나 `battle` 이 사라지면 함께 사라진다.

## 2. 검사 (출력 · 종료 코드 같은 실행에서 수집)

| 명령 (`server/` 에서) | 횟수 | 결과 |
|---|---|---|
| `node --check` 3파일 | 1 | exit 0 |
| `node authoritative/test/test-issue235-boundary.js` | 1 | exit 0 · 41 passed, 0 failed |
| `node authoritative/test/test-combat-stats-boundary.js` | 2 | 1차 exit 1(881/30) → 2차 exit 0 · **941 passed, 0 failed** |

- 재실행 사유(1회): 1차 실패 30건은 전부 **내가 새로 쓴 금지 키 정규식** 하나였다. 프레임 전체에서 `"stage"` 를 금지했는데, #238 부터 있는 자기 좌석 몫 시너지 칩 `battle.ownSyn.stage`(소유자 전용 · 이번 변경과 무관)를 잡았다. 진단 1회(읽기 전용 `node -e`)로 경로를 확인한 뒤 검사 범위를 **두 전투원 칸(a·d)** 으로 바로잡고, 프레임 전체에는 `synEl`·`synStatusPct`·`sandStormR` 금지를 따로 남겼다. 제품 코드와 기대 수치는 바꾸지 않았다.
- 대표 표본(기대값은 계약 식에서 손으로 낸 값 · 왕국 단계는 제품 표 항목을 참조로 사용): 가산 0 → 40% / 지속형 10%p+5%p → 55% / 모래 폭풍 → 27.5% / 115% → 100% / 상한 뒤 절반 → 50%(57.5% 아님) / 5개 왕국 kind / 미달 → `inactive` / 마녀·사신 실제 참전 → `none` / 용 미달 → `inactive` · 달성 → `active`.
- 그 밖: 양 좌석 동일 · Core 헬퍼 값과 동일 · 칸 3개뿐 · `effectiveStats` 6칸 · 직렬화 전후 락스텝 요약 동일 · 계약 밖 헬퍼 출력 7종 → `null`.

## 3. 남은 한계 [미검증]

- 실행한 것은 위 두 파일뿐이다. 전체 `npm test` · fuzz · 나머지 서버 스위트는 지시대로 돌리지 않았다.
- Mars 통지: 같은 `data.js` 에 #328 성장 표 · 전설 기준값이 들어갔다. 서버 테스트에서 옛 전설 수치 리터럴을 정적 검색 1회 했고 찾지 못했지만, 다른 서버 스위트를 실행해 확인한 것은 아니다.
- 계약 밖 출력 검사는 헬퍼를 그 블록에서만 바꿔 끼운 것이다(서버 allowlist 분기 검사). 나머지 #326 검사는 모두 실제 헬퍼로 돌았다.
- spec §1.7 의 4(같은 시드 전투 결과 동일) · 5(전투 종료 뒤 잔류 없음) · 6(화면 폭)과 클라이언트 통과 규칙(`network.js`)은 Mars · Saturn 범위다.
- `kind` 5종은 회선 어휘로 서버에 고정했다. 제품이 여섯 번째 왕국 효과를 추가하면 그 값은 `null` 로 떨어진다(테스트 "회선 kind 5종 = 제품 왕국 효과 5종" 이 실패로 알려 준다).
- Git · GitHub · Notion 쓰기 없음. `demo/**` · `engine.js` · 루트 문서 무수정.
