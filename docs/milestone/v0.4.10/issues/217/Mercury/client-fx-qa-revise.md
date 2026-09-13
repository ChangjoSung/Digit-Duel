# Client FX 독립 QA — REVISE

2026-09-13 13:59 KST. Saturn task_0b68fe82d72f / ctx_673153680f65, worker_done msg_3c832ababa6f. 파일 쓰기0, Mercury 전사, worker release 완료.

검토 source SHA256:
- demo/index.html: 63E5383872E80CD14745FA4E629743BEACEC4F980CC0654EB03D9B2A111752FB
- demo/test/regression/smoke_fx_consumer.js: 3AF1081D77C275B448EDA840B17316F1B7B207F5CDA93CEA002E6A56EBD9C17B
- demo/test/shared/harness.js: 73C0E167141F138CCA795DB20591B864953995CE8951C740AA735732233E7900

smoke_fx_consumer34/0과 별개로 독립 dispatcher/real timer probe에서 세 결함 확인.

1. P1 visible stage lifetime: netApplyRoomState가 build+render 후 fxIngest. render wrapper는 battle=null이면 overlay 닫고 다음 battle이면 교체. 마지막KO는 overlayHidden=true,koClass=true로 숨겨진 stage에 적용. queued battle11 shake가 현재 battle12의 generic op token에 적용. scene의 side 매핑만으로 해결되지 않으며 battleId별 표시 stage를 보존/재구성해야 한다. 테스트E는 실제data.battle 없이 harness registry stub class만 검사해 false green.
2. P1/P2 표시시간: 모든msg에 BAL.fx.damageFx 사용. itemFx15ms/damageFx120ms에서 item효과가40ms에도 재생중이고150ms후종료. 원본 BAL.fx[event.key] 및 msgStep fallback 사용 필요.
3. reduced-motion: CSS387~395는 result/flee만 끄고 .cell.fx-boom/.fx-trap,.btok.shake,#bstage.sigblink,.dmgfloat는 누락. JS큐120ms로줄여도 CSS움직임0.5~1.2초 계속. 실제 CSS computed/style 브라우저 검증 필요.

통과한 범위: 3/2/1/시작4프레임, flash/sig/ko/st/hp/float 정확매핑 및 추론shake 없음, seq dedup/gap skip, room/seat generation fencing, resume last-result baseline, active banner 보존, 안전scene fields, client rule callback 미실행, play단계 sidePanel 재접속배너(스크립트body 오탐 제외).

실제 browser art/battle/modal/result/same-match reconnect 최종증빙은 미완료. server FX v3는 Mercury/fx-qa-v3.md 독립PASS 유지.

동일 visible-stage 원인: PD msg_fb1dc1057451에서 명시한 뒤 재수정에도 Saturn msg_769a9dcc3466으로 재확인. WORKER_MODELS 같은원인2회실패→Opus5high 기준 충족. Mars Sonnet에 안전checkpoint/미완료 worker_done failed 요청(msg_008c51632774). 실제 settlement 전 duplicate editor/강제종료 없음. 다음 Mars가 전체 작업물/현검증을 보존해 이어야 한다.