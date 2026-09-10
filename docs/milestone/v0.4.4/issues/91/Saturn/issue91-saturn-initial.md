# Issue #91 — Saturn_1 독립 QA: REVISE

2026-09-07 · Mercury가 Saturn의 inline 납품 `msg_41022d7d1fa4`를 보존한 기록. Task `task_27b74fba75b6`, dispatch `ctx_5413a5d02763`. Saturn은 READ_ONLY, `files_modified=[]`, 산출물 작성 0이며 완료 후 release했다.

검수 커밋: `3360d56e4260d5c4c2518432cad740f22769aa14`.

## 판정 근거

**REVISE — P2, 테스트의 송신 검사 무효.** `demo/test/smoke_minion_art.js` K8b(당시 571·573·576행)는 `wsLog.length`를 비교한다. 이것은 WebSocket 생성 수이며 전송 메시지 수가 아니다. 테스트는 연결된 소켓도 준비하지 않았다. 제품 자체의 불필요한 송신은 발견하지 않았다.

Saturn은 파일 작성 없이 `fs.readFileSync`의 HTML 읽기만 메모리 사본으로 대체하고 `tryCapture` 첫 줄에 `netSend({type:"qa-unwanted-send"})`를 삽입했다. **같은 스모크 검사기에서 197 PASS / 0 FAIL**이었다. 같은 변형을 연결된 기록형 소켓(`NET.ws=new T.WebSocketCtor`, `readyState=1`)으로 실행하면 `wsLog.length` 증가 0, `ws.sent.length` 증가 1로 기존 K8b는 잘못 통과한다.

Mars 수정 요구: 연결된 소켓을 준비하고 실제 `sent` 배열의 증분을 검사할 것. 기존 연결로 불필요한 `netSend`를 실행한 변형이 **동일 검사기에서 실패**하는 음성 대조를 추가할 것. 제품 변경은 요구하지 않았다.

## 직접 실행 결과

| 명령 | 결과 |
|---|---|
| `node demo/test/smoke_cycle5.js` | 69 PASS |
| `node demo/test/smoke_memo.js` | 49 PASS |
| `node demo/test/smoke_minion_art.js` | 197 PASS, 단 K8b의 증거 효력은 위 사유로 제외 |
| `node demo/test/smoke_tutorial.js` | 124 PASS |
| `node demo/test/smoke_testclient.js` | 41 PASS |
| `node demo/test/issue91_cdp.js --read-only` | 9측정, 문제 0 |
| `node demo/test/minion_art_cdp.js --read-only` | 82측정, 문제 0 |

합계 스모크 480 PASS / 0 FAIL, 브라우저 91측정 문제 0. 테스트 서버 favicon 404 제외 1건은 명시적으로 기록했다. `smoke_online.js`는 mutant HTML을 작성하므로 Saturn이 실행하지 않았으며, Mars의 온라인 157 PASS와 구분한다.

추가 음성 대조: 기준 `eff5c16` HTML 메모리 사본은 172 PASS / 25 FAIL. 새 소켓 생성과 송신을 함께 넣은 변형은 196 PASS / 1 FAIL(K8b), **기존 연결로 송신만 넣은 변형은 197 PASS / 0 FAIL**. Mars의 별도 외형 연결 변형 20 FAIL은 재실행하지 않았다.

## 제품·브라우저 확인

- 제품 diff는 외형 정보 생성 2곳, 검증 helper, 전투 토큰 연결이다. 실제 `piece.cap`만 허용하며 잘못된 ID·속성 불일치·정체 없음의 폴백을 확인했다.
- 중립 표준형과 적 포획 원래 종의 대리 토큰이 128px로 로드되고 HP100/100·70/100을 보존했다. 왕·동료 본체와 기존 하수인 본체, reserve→cap 객체 이전은 유지된다.
- 이미지 차단 시 같은 토큰이 88px 이모지로 복귀한다. 이후 HP 변화·로그 증가·흔들림을 관측했다. 메모리 KO 검사에서 같은 tok-A, art=false, ko=true, shake=true, HP0, battle=null, phase=over, P2 승리까지 확인했다.
- 비공개 cap/reserve 정보와 공개 시점, `rosterId`·`archOf`·레거시 상태 확률/기간·템플릿·RNG·공용 스탯을 대조했다.
- `git ls-tree` 기준 blob과 현재 바이트를 대조해 **기존 이미지 100파일 모두 동일**임을 확인했다. I3 자체의 해시 검사는 파생물 28개만 대상으로 하므로 이를 100개 검사로 표현하지 않는다.

## SHA-256 — 검수 당시 작업 트리 바이트

| 파일 | SHA-256 |
|---|---|
| `demo/index.html` | `90224fe64b89e2b9919ad9266d022cee38ee4159d92cec82b93c17e867c4cf2c` |
| `demo/test/smoke_minion_art.js` | `c660bc919c02aa6047f38c6a9ebe165ce7a2dbb575a79d4c1e2de1f6e59a72b4` |
| `demo/test/harness.js` | `c04df34ccb04a36fbc34598b046d523292e85b9005ea4ddccabf0f750919e765` |
| `demo/test/issue91_cdp.js` | `f80afa907dbb39ffcaec410466fd1dbd5b438b00d0584e042acb23a6e6c7cb4b` |

## 한계·자원·후속

실제 온라인 2연결, 사람의 미술 품질 판정, AI가 자발적으로 포획·대리 출전하는 전체 플레이는 미검증이다. 고정 ROSTER·공유 RNG·기존 공유 rosterId를 이용한 메타데이터 생성이며 프로토콜은 불변이다. K8a/c는 로컬 결정론 근거이고, 결함이 있는 K8b로 실제 송신 불변을 주장하지 않는다. #92는 실제 skills 배열 복사만 승인한 것으로, 아키타입 파라미터 승계까지 확장하지 않는다.

읽기 전용 CDP의 산출물 차단·자체 임시 프로필 정리 경로를 먼저 확인했다. 해당 실행 Chrome/서버 프로세스 및 정확한 자체 임시 프로필은 종료·정리했으며 캡처·보고 파일 0개다. PD의 동시 스냅샷 수정은 Saturn 변경이 아니다.

PD 조치: Mars_3 `task_a4a9a1e7c5ce / ctx_4de59dcc0904`에 K8b와 같은 검사기 음성 대조만 수정하도록 배치. 수정 후 Saturn 독립 재검수 전 PR#98 Draft 유지.
