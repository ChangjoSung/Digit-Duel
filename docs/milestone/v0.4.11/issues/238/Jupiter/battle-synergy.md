# #238 B04 — 온라인 내 시너지 칩 서버 스냅샷 (Jupiter)

- 2026-09-28 · Jupiter(Claude Opus 5.5 high · PID 36848 · bypass) · task_fa54baa881f4 / ctx_4eb1740918c4 · PD preflight GO 후 착수
- 범위: `server/authoritative/room.js`, `server/authoritative/test/test-issue237-economy.js`. Core·클라이언트·스키마·골든은 수정하지 않았다.

## 회선 (확정)
`room_state.data.battle.ownSyn` = Core `T.synView(보는 좌석, S)`의 JSON 복제 `{el, arch, dead, stage, bonus}`.
- 조건: `data.battle`이 있고, 엔진 `battle.syn[보는 좌석]` 참전 스냅샷이 있으며, 방이 FINISHED가 아닐 때. 그 밖에는 `null`, battle이 없으면 필드도 없다.
- 상대 좌석의 칸 수·단계·가방·재화·등급·스킬은 싣지 않는다. 좌석 두 개짜리 `B.syn` 배열도 싣지 않는다.
- 종료 결과는 기존 `final.sides[].syn`(FINISHED 전용·양측) 그대로이며, 기존 fx.cast A/D도 바꾸지 않았다.
- 소비는 Mars가 맡는다(네트워크 hydration과 칩 라벨).

## 검증 (확정)
기존 t237에 case `startedEco(35)`를 추가하고 한 번 실행했다: `issue237-economy: 144 passed, 0 failed`, exit 0.
확인한 항목:
- 전투 전에는 battle이 없다.
- 전투 중에는 좌석별로 자기 엔진 synView와 일치하고, syn 관련 키는 `ownSyn` 하나다.
- 전투 중 보드가 바뀌어도 스냅샷이 고정된다.
- 뷰를 수정해도 엔진 요약은 바뀌지 않는다.
- 기권으로 FINISHED가 된 뒤에는 ownSyn이 없고 final은 양측을 담는다.

## 한계
- 다른 스위트·브라우저·인증 매트릭스는 다시 돌리지 않았다(지시 범위).
- 온라인 칩이 실제로 표시되는지는 Mars 연결 후에 검증한다(미확정).
