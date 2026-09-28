# #262 CJ QA — 상대 HP 표기 정정 (Jupiter · 서버)

- 작성: 2026-09-28 Jupiter (Claude Code `claude-opus-5-5` · effort high · `--dangerously-skip-permissions` · PID 32756 · 세션 JSONL `9b527671-85aa-4e34-991a-eea9230cbc97`)
- dispatch: task `task_6a79290d11ab` / ctx `ctx_ed32bbff5abe` · required_role=Jupiter · IMPLEMENT · SERVER · code
- 작업 공간: `issue-262-multiplayer-emotes` 워크트리 (HEAD e1bfdc2). 기존 이모트 미커밋 변경은 건드리지 않았고 Git 명령은 쓰지 않았다.

## 1. 입력 (확정)

| 출처 | 내용 |
|---|---|
| CJ QA (PD 전달) | 이모트 기능 PASS. 위치·크기는 #238로 보류. 메인 보드·전투의 상대 HP가 % 표기이고 자기 쪽은 실제 값이라 **REVISE** |
| 최신 CJ (PD msg_6c4c55bffc7c) | 전투 **전**: 이미 보이던 HP는 기존 % 유지 · 안개 속 정체/HP 신규 공개 금지. 전투 **중**: 양 전투원 실제 잔여/최대 HP. 전투 **후**: 그 노출된 말은 보드에서 실제 현재 HP 유지. 모든 공개 상대에 일괄 적용하지 않음 |
| PD FULL GO (구현 해석, CJ 원문 아님) | 개체 단위 `hpSeen` 불리언. Core `startRounds`가 **실제 전투원** fa/fd에 true를 세운다(대리 출전의 왕·동료 본체는 제외). `ECO_UNIT_KEYS`에 넣어 교체·가방 왕복 때 개체와 함께 이동. 대체된 개체는 칸의 표식을 물려받지 않음. 정체만 공개하는 경우(함정·끝줄·종료 리빌)는 해당 없음 |

## 2. 변경 (확정)

Core(`demo/js/core.js`)의 `hpSeen` 설정은 Mars 소유라 이 보고 범위가 아니다. 서버는 그 표식을 읽기만 한다.

| 파일 | 변경 |
|---|---|
| `server/authoritative/room.js` | `_serializeKnownOpponent`: 경제 경기에서 `p.hpSeen`이면 실제 `hp`/`maxHp`에 `hpSeen:true`를 싣고, 아니면 기존 100 눈금 유지. `_serializeUnknownOpponent`는 무변경. `_serializeBattle`: 양쪽 `hp`·`maxHp`·`shield`·`tideMark`·`rec` 실제 값(`scaled` 분기 삭제). `_serializeFxMsgFx`/`_serializeFxEvent`: float·hp·st·문구 실제 값. **주어 불명 문구의 `'?'` 가림은 유지**(`scaleText`→`maskText`). 쓰지 않게 된 `opp`/`seatIndex` 인자 제거. `lockstepDigest`: 말·cap·예비·가방 개체 튜플에 `!!hpSeen` 추가 |
| `server/authoritative/engine.js` | `healLogsScaled`: `p.hpSeen`이면 회복 로그 `HP +N`을 실제 값으로 둔다. 읽는 곳이 없어진 비열거 `evt.sides` 정의 삭제 |
| `server/authoritative/test/test-issue237-economy.js` | 보드: hpSeen 말은 실제 HP와 `hpSeen:true`, 전투 전 `hpSeen` 키 없음, 미공개 말은 hpSeen이어도 hp/maxHp/name/type/element/rosterId/hpSeen 없음. 전투: 두 좌석 모두 양쪽 패널·fx·해일 X·문구·float·rec가 실제 값, 주어 불명 줄만 `'?'`, `fa/fd.hpSeen` 세워짐, 전투 뒤 싸운 말은 실제 값, 안 싸운 공개 말은 100 눈금, 비공개 키 없음. 회복 로그: hpSeen 상대 말은 실제 값(% 없음) |
| `server/authoritative/test/test-runtime-contract.js` | PD GOLDEN_GO 범위만: GOLDEN `state` 해시 3개와 #262 재기준선 주석 2줄 |

줄 수(수작업 집계, Git 미사용): room.js 순감 약 10줄, engine.js 순감 2줄, 237 테스트 약 +45줄, runtime-contract 3줄 교체와 주석 +2줄. room.js·engine.js는 Git Bash `sed -i`/Python 재작성으로 LF가 됐던 것을 CRLF로 되돌렸다(main 체크아웃과 같은 CRLF, 줄 수 1944/559 전부 CRLF).

## 3. 공개 경계 (확정 — 코드와 테스트로 확인)

| 시점 · 대상 | HP | 그 밖 |
|---|---|---|
| 미공개 상대 말 (hpSeen 여부 무관) | 없음 | id·r·c·owner·alive·immobile·(swapMark)만 |
| 공개됐지만 싸운 적 없는 상대 말 | 100 눈금 (기존 #237) | 정체·rosterId·healing·swapMark. `hpSeen` 키 없음 |
| 전투에 나선 상대 개체 (hpSeen) | 실제 현재/최대 + `hpSeen:true` | 등급·스탯·스킬·쿨·cap·원장·봉인·시너지 없음(테스트 정규식) |
| 전투 패널 · fx · 전투 로그 | 양쪽 실제 값 (대리 출전 전투원 포함) | 스킬 은닉(`_skillsFor`)·`reaperSeal`/`synAtk` 소유자 한정은 그대로 |
| 주어 불명 전투 문구 | `'?'` 가림 유지 | — |
| 보드 회복 로그 | hpSeen 상대만 실제 값, 나머지 상대는 % | — |

추론: 노출된 최대 HP로 등급을 역산할 수 있다. 이는 최신 CJ 규칙("전투 중/후 실제 최대 HP")의 직접 결과이며 PD 지시문에 명시돼 있다. 등급 필드 자체는 계속 싣지 않는다.

## 4. 테스트 (확정 — 각 1회, 실패만 교정 후 재실행)

`server/` 에서 `node authoritative/test/<name>.js`:

| 스위트 | 1차 | 결과 · 원인 | 재실행 |
|---|---|---|---|
| test-issue237-economy | 118/1 exit1 | **내 새 테스트의 가정 오류**(제품 버그 아님). 전투 뒤 싸운 상대 말이 계속 보인다고 가정했지만 안개로 `units`에서 빠질 수 있다(정상 등급 A 동작). 직렬화기를 직접 보고 레코드는 보일 때만 비교하도록 고쳤다 | 119/0 exit0 |
| test-battle-fx | 474/0 exit0 | — | — |
| test-combat-stats-boundary | 547/0 exit0 | — | — |
| test-issue241-boundary | 74/0 exit0 | — | — |
| test-issue262-emotes | 64/0 exit0 | — | — |
| test-runtime-contract | 71/3 exit1 | **상태 구조만 변경**(제품 버그 아님). seed 11·44·55의 `최종 상태 스냅샷`만 실패했고 turns·phase·winner·log·fx·metrics·경로·스케줄러·쌍둥이 결정성은 PASS. 증명: 스크래치 사본에서 replacer로 `hpSeen` 키만 빼니 74/0(기존 골든 3개 일치). seed 11(전투 0)도 바뀐 것은 `ecoMakeUnit` 기본값 `hpSeen:false` 때문. PD GOLDEN_GO 후 `DD_GOLDEN=1` 1회로 값을 뜨고 state 3개만 교체 | 74/0 exit0 |

돌리지 않은 것: 전체 22 스위트·PG·계정·SMTP·브라우저·수동 매트릭스(지시에 따라 범위 밖). CI 통과는 주장하지 않는다.

## 5. 한계 · 미확정

- 교체/가방 왕복 때 표식이 개체와 함께 이동하는지(`ECO_UNIT_KEYS`), 대리 출전 때 본체가 제외되는지는 Core(Mars) 동작이다. 서버 테스트는 표식을 직접 세워 직렬화 경계를 검증했고, Core 경로 자체의 검증은 Mars·Saturn 몫이다.
- 클라이언트 표시(Mars)는 이 보고 범위 밖이다. 서버 계약: 경제 경기의 상대 보드 레코드에 `hpSeen:true`가 있으면 hp/maxHp가 실제 값이고, 없으면 기존 100 눈금이다.
- 서비스 재시작·배포·Git 쓰기는 하지 않았다(PD가 262 Node 재시작과 fresh Saturn QA를 진행).
