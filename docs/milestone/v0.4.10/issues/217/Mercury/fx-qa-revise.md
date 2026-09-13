# Server FX v2 독립 QA — REVISE

2026-09-13 13:27 KST. Saturn task_a5a4600451f9 / ctx_ec556d601a25, worker_done msg_9646c8f5201e. 파일 쓰기0, Mercury가 결과 전사. QA Worker 정상 release/출력 보관.

기존 battle-fx229 및 npm test 전체 통과와 별개로 독립 inline 실제 호출에서 아래 결함 재현.

| 등급 | 재현 | 실제 / 기대 |
|---|---|---|
| P1 | helpers.startedRoom(1874205). owner0 bomb와 owner1 minion 선택, 양 engine에서 victim 외 owner1을 alive=false로 fixture 준비 후 실제 initBattle(bomb,victim) | turnBanner1 contactBanner2 resultBanner3 explosion4. 실제 원인 explosion이 결과보다 먼저여야 함. withEngine의 늦은 cells drain이 원인 |
| P1 | startedRoom(1874206). 양 engine minion 전투 initBattle 후 실제 act k0 반복으로 정상 종료. 현재 lastSeq 저장 후 양 engine gameOver(0,king) | 후속 별도 resultBanner29에 이전 battleId1와 이전 M-F1/M-F1 scene이 붙음. 해당 결과가 그 전투에서 유래한 경우만 이전 context 부착 |
| P2 방어 강화 | startedRoom(1874204). 실제 전투와 act k0 후 view.fx의 hp event 선택, 반환 view의 target.fx.hp.val=987654 및 target.fx.injected=LEAK. resync 재조회 | 동일 seq7 payload 변조, sameRef=true. wire 원격 공격 재현 아님. nested fx 복사/화이트리스트 재구성하여 내부 이벤트 불변성 보장 |

정상 검증: 일반 hit→KO→result 순서, 실제 explosion/trap1회=event1개 exact cells, non-enumerable/유한 server queue, PVE/hotseat 큐 없음, 보관/재조회 안정성. client actual visual 검수는 범위 밖.

정확한 node -e 재현 명령은 Orca 보관 transcript ctx_ec556d601a25의 cursor p=12 이후에 있다. worker-read --dispatch ctx_ec556d601a25 --limit 50 --json으로 열람 가능. 이번 결과를 전체 제품 PASS로 사용하지 않는다.

후속: 원인 순서 보존, 결과 context 범위 제한, nested snapshot 복사, 세 재현 영구 회귀 및 독립 재검수.