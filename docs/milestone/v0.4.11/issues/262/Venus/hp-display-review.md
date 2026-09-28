# #262 CJ QA 후속 — 상대 HP 표기 검토 · 기획 동기화 (Venus · 2026-09-28)

dispatch: `task_bd632ec17adf` / `ctx_b09b02014827` · required_role=Venus · mode=PLAN · area=PLAN · mutation=docs · instance_index=null · provider=claude.
실행: `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` (PID 27120) · 세션 JSONL `a98a422a-…` model=claude-opus-5-5 · permissionMode=bypassPermissions · 화면 footer `⏵⏵ bypass permissions on`(model/effort는 footer에 표시되지 않음 — effort high는 argv 근거).
흐름: live-preamble ask → PD **READONLY GO** → 코드 추적 · 계약 제안 → PD **FULL GO**(개체 기준으로 보정) → Notion 3쪽 · 로컬 2파일.

## 1. CJ 입력 (PD 전달 요지 · 원문 미확보)

- **확정** — 이모티콘 보내기 · 받기 · 숨기기 PASS. 위치가 눈에 덜 띄고 크기가 작다 → #238 UI System Flow 전면 구현으로 미룸.
- **확정** — 정기 상점 · 가방 · 전투 · 결과 나머지 PASS. 보드 · 전투의 상대 HP 표기만 REVISE: 싸우기 전 % · 전투 중 두 전투원 실제 현재/최대 · 전투 뒤 그 개체 보드 실제 현재 HP. 모든 상대 말의 일괄 숫자 공개는 아님(PD 후속 메시지로 앞선 안 대체).

## 2. 코드 추적 결과 (사실 · e1bfdc2 + 작업 트리 미커밋분)

| 사실 | 위치 |
|---|---|
| `p.revealed`는 전투 HP 표식으로 쓸 수 없다 — 전투 출전 공개 외에 **함정 발동(정체만)** · 끝줄 도달에서도 선다 | `demo/js/core.js` 1000 · 2033 · 1113/1867 · 2295 |
| 대리 출전 전투원은 본체 · `piece.cap` · 가방 개체 중 하나다 | `core.js` `entryFighter` 2079 |
| 가방 ↔ 필드 교체는 `ECO_UNIT_KEYS`로 개체 칸을 옮기고, 공개 칸에 비공개 개체가 오면 교체 표식 | `core.js` 1359 · 1515 |
| #237 비율 표기 지점: 공개 상대 보드 말 · 전투원 HP/방어막/해일/기록 피해 · 전투 fx · 전투 문구 · 보드 회복 로그 · 화면 `%` 접미사 | `server/authoritative/room.js` `pct100`/`scaleText`/`_serializeKnownOpponent`/`_serializeBattle` · `engine.js` `installHealLogScale` · `demo/js/ui.js` `hpPctView` · `network.js` float |
| 등급 올리기 경로는 찾지 못함 — 개체의 최대 HP는 개체마다 고정(재구매는 새 개체) | `core.js` 검색 |

**검토 시점 작업 트리 확인(사실 · 미커밋 · Mars/Jupiter 소유)** — `hpSeen`이 이미 들어와 있다: `core.js` 1360(`ECO_UNIT_KEYS`) · 1402(새 개체 false) · 2296(`fa.hpSeen=fd.hpSeen=true`) · `state.js` 188 · `network.js` 584 · `ui.js` 1557–1558(`hpPctView(p)`) · `room.js` 70 · 1790(`!p.hpSeen`일 때만 비율) · 락스텝 요약 306/316/326/336. Venus는 이 코드를 수정하지 않았고 정합성 판정은 Saturn 몫이다.

## 3. 계약 (PD FULL GO 기준)

- **표식** `hpSeen`(개체 단위 불리언) — `startRounds`에서 **실제 전투원 개체**(fa · fd)에 세운다. 포획 · 가방 대리 출전이면 그 하수인에, 싸우지 않은 왕 · 동료 본체에는 세우지 않는다. `ECO_UNIT_KEYS`로 개체를 따라가고 새 개체는 false. 교체로 들어온 개체는 칸의 표식을 물려받지 않는다.
- **표시** — 공개 상대 보드 말: `hpSeen`이면 실제 현재 HP, 아니면 %(현행). 정체 모르는 말: 위치 · 생존(+교체 표식)만. 전투: 두 전투원 실제 현재/최대 · HP 계열 수치 실제 값 · 주어 불명 '?' 유지. 보드 회복 로그: `hpSeen`이면 실제 값.
- Venus 최초 제안(본체 전투만 표식)은 PD가 **개체 추적**으로 대체했다 — PD 구현 해석이며 CJ 원문이 아니다.

## 4. 문서 반영 위치

| 문서 | 위치 | 변경 |
|---|---|---|
| GDD-23 `3dc1e7f1708580329da6fe4986654f7b` | 7.9 | '상대 말의 HP 표기 — 세 단계' 글머리(①②③ · 알려지는 것 · 바뀌지 않는 것) 추가. '등급 비공개' = 직접 표기 금지로 좁힘 |
| | 8.1 ㉘ | 끝에 '2026-09-27 CJ QA — 기능 PASS · 위치/크기 #238 · [기획 필요]' |
| | 8.1 ㉙ (신설) | 상대 말 HP 표기 세 단계 · #237 비율 대체 · 표기만 변경 |
| | 9장 | '2026-09-27 #262 CJ QA' 행 — 확정 ①② · PD 구현 해석 · 알려진 한계 |
| GDD-24 `3dc1e7f1708581a48421fcec63d3cdf8` | 00.7 | '[CJ 확정 · 2026-09-27 · #262 CJ QA 후속] 상대 말 HP 표기' 글머리 |
| | 00.2 끝 '경기 중 이모티콘' | '아직 남은 것' 뒤 'CJ 플레이 QA (2026-09-27)' 단락 — PASS · #238 이관 · 새 수치 없음 · UI 흐름 전체 완료 아님 |
| | 00.10 | 9번 상태에 QA 결과 덧붙임 · 10번 행(상대 말 HP 표기) 신설 |
| | 첫머리 운영 이력 | 2026-09-28 Venus 한 줄 |
| GDD-13 `3cd1e7f17085817f8c35fa8548116f38` | 9장 | '2026-09-27 #262 CJ QA' 행 · 운영 이력 한 줄. 1~8장 불변 |

메타데이터 재확인(재조회): 세 쪽 모두 Project = `3ae1e7f1708580f7bb88c7ee4f511aa0` · Editor = 성창조(`8e0a8270-…`, Notion 연결의 실제 사람 계정) · Edit Date = **2026-09-28**. Notion 마지막 수정(UTC): GDD-23 2026-09-27T15:02:16.937Z · GDD-24 15:02:17.901Z · GDD-13 15:02:19.460Z (= KST 2026-09-28 00:02).

## 5. 확정 · 추론 · 미확정

- **확정** — 1장 두 항목(PD 전달 요지 기준).
- **PD 구현 해석** — 3장 개체 추적 · 대리 출전 기준.
- **추론** — 경기 종료 전체 공개 화면에서 싸운 적 없는 상대 말은 %로 남는다(현 작업 트리 `room.js` 1790이 그렇게 동작 · CJ 미언급).
- **미확정** — 이모티콘 새 위치 · 크기(#238). 세 쪽의 Summary 속성은 이번에 고치지 않았다(속성 안 `\~` 이스케이프 손상 위험) — 운영 이력은 각 9장 행 · 본문 운영 이력에 남김.
- 만들지 않음 — 코드 · 테스트 · 설정 · Git · GitHub · 댓글.
