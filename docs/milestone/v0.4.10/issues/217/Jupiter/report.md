# #217 — 서버 권위 인증 서버 구현 보고 v4: Jupiter_Server

- 작성: Jupiter_Server (Claude Opus 5, high), 2026-09-13, dispatch `ctx_bf9e2d04bdc5`. 앞선 medium(`ctx_4d8420442048`)·high(`ctx_6142e99f4271`) 패스가 같은 인가·단계 검증 원인으로 반려돼 WORKER_MODELS 규정(같은 원인 2회 실패 → Opus 5 high)으로 승격됐다. 역할 preflight: required_role=Jupiter · mode=IMPLEMENT · area=SERVER · mutation=code · instance_index=null.
- 범위: `server/**`(인증 서버·릴레이 README·실행기·package.json)와 이 폴더. `demo/**`는 읽기만 했다(Mars 소관). Git·Notion·배포 없음.
- 입력: Saturn 최종 소스 스냅샷 REVISE `msg_9a62b8728ecf`, [Mercury/server-qa-revise.md](../Mercury/server-qa-revise.md), [Mercury/acceptance-audit.md](../Mercury/acceptance-audit.md), PD `msg_80ed1eb751fd`(호스트 참가 알림), Mars `msg_31cb978ea815`(실통합 차단 보고)·회신 2건.
- 표기: [확정]=코드·테스트 실행으로 확인 · [추론]=확정에서 도출 · [기획 필요]=CJ 결정 필요.
- 이 문서는 v3 보고를 치환한다. 최종 프로토콜은 [protocol.md](protocol.md).

## 0. 결론

Saturn이 재현한 결함 9건과 PD가 추가로 전달한 실통합 차단 1건을 모두 고쳤고, 각 결함에 되돌리면 실패하는 회귀 테스트를 붙였다. 고치는 과정에서 v3 구조 자체의 **비공개 정보 누출**(단일 엔진 공용 로그에 행동자 자기 말 정체가 실려 상대에게 전송)을 추가로 발견해 엔진을 좌석별 락스텝 쌍으로 바꿔 해소했다. `cd server && npm test` 전체 통과 [확정]. 알려진 핵심 게임플레이 갭은 없다 — 남은 한계는 §5.

## 1. 결함별 수정 [확정]

| # | Saturn 재현 (v3) | v4 수정 | 회귀 테스트 |
|---|---|---|---|
| P0-1 | 방어자 소유 모달을 netActor/current로 인가 — 방어자 E_NOT_ACTOR, 공격자가 같은 seq/index로 방어자 선택 대행 | `_authorize` 1단계: `NET.syncModal.owner`(소유 좌석 엔진 DOM에서 실제로 떠 있는지 확인)만, seq·범위·**disabled** 검사, 처리된 seq 재전송 거부, 모달 대기 중 다른 모든 행동 거부 | authority-rules P0-1(왕 cap 픽스처: 방어자 선택 수락·공격자 대행 거부·"전투 시작"은 공격자 소유)·P0-1b·P0-1c(disabled "시간의 수호자") |
| P0-2 | 방어자 전투 차례 skipMain이 공격자 mainUsed 변경, 전투/모달 중 tele 수락 | 단계별 명시 판정: 전투 중엔 actorOfPhase 소유자·전투 어휘만, 보드 행동 전부 거부. 보드 행동도 원본 UI·코어 조건(주 행동·텔레포트·강제 대상) 서버 판정 | authority-rules P0-2(방어자 skipMain/tele/endTurn/search/cell 거부·mainUsed·전투 불변)·P0-2b(쿨 슬롯·없는 아이템·볼·패스·빈 패키지)·보드 조건, authoritative §14(실소켓) |
| P1 배치 | 중복/미지 로스터·말 수 불일치 수락 → applyNetSetup 무작위 대체로 시작 | `_validateSetup`이 ready/상태 변경 **전에** 6종·중복·카탈로그·14개·정수·행 11~13·열 1~7·중복 좌표 검증. 시작 후 반영 결과를 제출값과 대조(`_assertSetupApplied`) | authority-rules 배치 13케이스(각 불변·상대 ready 유지)·거부 좌석 ready 불가·좌석1 미러링 정확 반영·"손상" 로그 없음 |
| P1 act k | 왕/동료 UI의 `act 'basic'`를 E_BAD_ENVELOPE | `'basic'|'skill'|'common'` 허용 + `_legalAct`로 합법성 판정, 기타 문자열·실수는 E_BAD_ENVELOPE | authority-rules 왕 본체 basic 수락·k 0/common/pass/skill(스킬 없음) 거부 |
| P1 별칭 | heal에 뷰 u-별칭 → 수락·revision 증가, healing/mainUsed 불변 | `_pidByAlias` 역매핑, heal/fleeSwap은 **자기 말 별칭만**(원시 id·상대 별칭·모르는 별칭 거부), `you.selected`와 동일 별칭 | authority-rules 별칭 heal(두 엔진 healing·mainUsed)·fleeSwap(BAL.fleeProb=1 픽스처) |
| P1 leave | WS `t:leave`가 토큰 검사 전 실행, 위조 토큰으로 OPEN 룸 취소 | leave를 일반 명령 경로로 — 토큰(current+tokenGen) 인증 → 중복 제거 → 처리. 응답 room_state + 상대 푸시 | authoritative §13(위조·불량·낡은 gen·토큰 없음 → 룸 OPEN 유지, 정당한 leave → CANCELED 양쪽, 폐기 토큰 재전송 거부) |
| P1 생명주기 | `_finalize` revision 미증가, 시작 전 CANCELED 뷰 phase=setup | `_finalize` 단일 지점에서 정확히 +1(명령 경로는 이미 올린 경우 bump:false), 재종료 무시, FINISHED 덮어쓰기 금지, 뷰 `state` 필드 + phase `canceled|void|closed`, 모든 룸 공통 notifier가 갱신 뷰를 푸시, 로비 정리는 `room.close()`로 CLOSED 푸시 후 소켓 종료 | authority-rules 생명주기 6블록, room F1/F6 |
| 스케줄러 | clearTimeout 없음, setTimeout=0, drain 지연 무시, 5백만에서 조용히 중단 | `createScheduler`: 양의 고유 id·실제 취소·(due,등록순) 가상 시계·콜백/가상시간 예산 초과와 콜백 예외 시 큐 비움+EngineFault → 룸 VOID(E_INTERNAL), interval은 비발화 기록 | scheduler 32(단위·실엔진 토스트 2300ms 타이머·네이티브 타이머 발화·여러 룸·오류 룸만 VOID) |
| 실행 통합 | authoritative HTTP health 외 404, npm start=구 릴레이 8080 | 인증 서버가 `demo/` 정적 서빙(릴레이와 같은 security.js 검사), `npm start`/`start:lan`=인증 서버, 릴레이는 `start:relay[:lan]`, 신규 `공개서버시작.bat`·`공개LAN서버시작.bat`(기존 실행기 불변), README 갱신 | http-static 24, launcher-authoritative 47, 기존 test-launcher·test-static-load 통과 |
| PD 추가 | 게스트 참가 시 호스트가 SETUP 전이를 모름 | 참가 성공 직후 seat 0에 room_state 푸시(참가는 revision +1), 실패 참가는 알림 없음 | authoritative §1(초대)·§9(공개)·거짓 알림 없음 |
| 추가 발견 | (v3 구조) 단일 엔진 공용 로그에 행동자 시점 idLabel — 미공개 자기 말 이름·속성이 상대 뷰 log로 전송, "나/상대" 뒤섞임 | 좌석별 NET.me 고정 엔진 쌍 + 매 입력 락스텝 digest 비교(fail-closed). NET.me 접근자 트릭 폐기. 하네스 스텁 obBtns 버튼 누적도 브라우저 의미로 복원 | authority-rules(상대 로그에 미공개 회복 말 이름 없음), security-gaps(좌석별 인칭·비소유 엔진 마스킹·모달 버튼 누적 없음), match-fuzz 비공개 불변식 |

## 2. 검증 [확정]

`cd server && npm test` (Windows, Node 24) — 전부 통과:

| 스위트 | 결과 |
|---|---|
| test.js · test-security.js · test-config.js · test-launcher.js · test-static-load.js (기존 릴레이) | 통과 |
| authoritative/test/test-scheduler.js | 32/32 |
| test-engine-isolation.js | 18/18 |
| test-room.js | 57/57 |
| test-security-gaps.js | 40/40 |
| test-authority-rules.js | 176/176 |
| test-match-fuzz.js (6시드×최대 1500단계, 시드 고정) | 16/16 |
| test-authoritative.js (실제 WebSocket) | 50/50 |
| test-http-static.js | 24/24 |
| test-launcher-authoritative.js | 47/47 |

- **퍼즈**: 룸 API만으로 실제 매치 진행 — 이동·텔레포트·회복·탐색·전투(기술·아이템·볼·도망·패키지)·동기화 모달·도망 교환·강제 전투·왕 격파 완주. 불변식: 락스텝 일치, 비행위자 잡음 입력 수락 0·상태 불변, 상태 변경 성공은 revision 정확히 +1, noop/거부 0, 좌석 뷰(자기 `you` 제외)에 상대 미공개 말 이름 없음. 확대 실행 30시드×2500단계: 30/30 FINISHED, 수락 33,944·잡음 9,600, 위반 0 (`node authoritative/test/test-match-fuzz.js --seeds 30 --steps 2500`).
- **뮤테이션(수정을 되돌리면 테스트가 실패하는가)**: 작업 공간이 아닌 스크래치 격리 사본에서만 실행했다 — §4 참조. 결과는 §3.

## 3. 뮤테이션 검증 결과

스크래치 격리 사본(`server/authoritative`·`security.js`·`node_modules` + `demo/index.html`·`harness.js` 복사본)에서 수정 하나를 되돌리고 해당 스위트를 실행 → 원복. 실행 전후 작업 공간 `server/authoritative/*.js` md5 불변 확인 [확정].

| 뮤테이션(되돌린 수정) | 스위트 | 결과 |
|---|---|---|
| M1 모달 인가를 netActor로 | authority-rules | 잡힘(9 FAIL — 공격자 대행 수락) |
| M2 전투 중 보드 행동 허용 | authority-rules | 잡힘(9 FAIL — 방어자 skipMain 수락) |
| M3 배치 검증 제거 | authority-rules | 잡힘(27 FAIL) |
| M4 heal 별칭 미해석 | authority-rules | 잡힘(4 FAIL) |
| M5 leave를 인증 전에 처리 | authoritative | 잡힘(7 FAIL — 위조 토큰으로 CANCELED) |
| M6 `_finalize` revision 미증가 | authority-rules | 잡힘(9 FAIL) |
| M7 모든 좌석 뷰를 엔진0에서(v3식 공용 로그) | authority-rules / match-fuzz | 둘 다 잡힘(상대 로그에 "새끼 화룡·불 회복 자세" 등 미공개 말 이름) |
| M8 호스트 참가 알림 제거 | authoritative | 잡힘(알림 대기 타임아웃) |
| M9 스케줄러 FIFO(지연 무시) | scheduler | 잡힘 |
| M10 disabled 버튼 허용 | authority-rules | 잡힘(2 FAIL) |
| M11 문자열 act k 거부 | authority-rules | 잡힘(5 FAIL) |
| M12 예산 초과 시 조용히 반환 | scheduler | 잡힘(3 FAIL) |
| M13 컨텍스트 clearTimeout 제거 | scheduler | 잡힘(2 FAIL) |
| M14 처리된 모달 seq 소비 기록(`_consumedModalSeq`) 제거 | authority-rules | **안 잡힘** — 원본 흐름에서는 응답 콜백이 오버레이를 닫거나 새 모달로 버튼을 교체해 오버레이·버튼 정체 검사가 이미 재전송을 막는다. 이 기록은 "오버레이를 그대로 두는 콜백" 대비 이중 방어이며 독립 회귀가 없다 [확정] |
| M16 종료 뷰 phase를 setup으로 | authority-rules | 잡힘(5 FAIL) |

## 4. 운영상 사고 기록 (자진 보고)

- 02:23~02:27Z경 첫 뮤테이션 실행을 **작업 공간 소스에 직접** 적용(각 뮤테이션 후 원복하는 방식)했다. Mars가 같은 작업 공간에서 실서버 검증 중이라 PD가 중단을 지시했다(`msg` 2026-09-13 02:25Z). 실행을 중지했을 때 `server/authoritative/server.js`가 뮤테이션 상태로 남아 있었고, 실행 전 백업으로 즉시 복원해 세 파일(room/server/engine) md5가 실행 전과 **바이트 동일**함을 확인했다. 그 창 동안 기동된 서버 프로세스는 변형 소스를 읽었을 수 있어 Mars·PD에 재기동을 요청했다(`msg_df89eb6e3bf0`·`msg_fee44a31b62c`). 이후 뮤테이션은 스크래치 격리 사본에서만 돌렸고, 실행 전후 작업 공간 해시 불변을 대조했다.

## 5. 남은 한계

- [확정] WAN 실배포·TLS 없음(`DD_AUTH_PUBLIC_HOST` 준비 경로만). 호스팅·배포는 범위 밖.
- [확정] 두 실제 브라우저 E2E는 Mars 어댑터 반영 대기 — 서버 쪽은 실제 WebSocket으로 검증.
- [확정] Mars 조치 필요(클라이언트, 서버 우회 아님): ① `netApplyRoomState`가 `phase==='setup'`만 대국 전으로 본다(demo/index.html 약 5445행) — `canceled|void|closed` 분기 필요. ② 로그·전투 로그가 좌석 시점으로 바뀌어 "관점 신뢰 불가" 전제 제거 가능. ③ noop 성공은 revision이 그대로다. ④ 코드 접속 오류 토스트의 "서버(npm start)" 문구는 이제 `npm run start:relay`가 맞다(demo/index.html 약 5660행).
- [추론] 메모리: 진행 중 룸당 엔진 2개(측정 heap 약 3MB/엔진). 기본 룸 상한 200이면 최악 약 1~2GB — 상한은 운영 결정 [기획 필요].
- [확정] 처리 비용: 입력당 약 1.2ms(두 엔진 + 상태 지문).
- [확정] 헤드리스 엔진은 `fxLive()=false`라 연출 지연이 0으로 동기 처리된다(원본 헤드리스·시뮬과 동일). 서버 스케줄러가 실제로 흘리는 지연은 토스트 제거 같은 표시 타이머다.
- [확정] `_consumedModalSeq` 이중 방어는 독립 회귀가 없다(§3 M14).
- [확정] `Room` 생성자의 `seed` 옵션은 단위 테스트 재현 전용이며 `lobby.createRoom`은 넘기지 않는다.

## 6. 문서 반영 위치

| 변경 | 위치 |
|---|---|
| 프로토콜 v4 확정(인가 순서·배치 검증·별칭·leave 인증·참가 알림·phase/state·스케줄러·정적 호스팅) | [protocol.md](protocol.md) |
| 엔진 쌍·명시 판정·생명주기 | `server/authoritative/room.js` |
| 서버 스케줄러·하네스 DOM 버튼 누적 복원 | `server/authoritative/engine.js` |
| 정적 호스팅·leave 인증·참가 알림·공통 notifier | `server/authoritative/server.js` |
| 로비 정리 CLOSED 푸시 | `server/authoritative/lobby.js` |
| 실행 스크립트·실행기·안내 | `server/package.json`, `server/공개서버시작.bat`, `server/공개LAN서버시작.bat`, `server/README.md` |
| 테스트 | `server/authoritative/test/` (helpers + 9 스위트) |
| 이 보고서 | 이 파일(치환) |

## 7. 변경 파일

`server/authoritative/{engine,room,server,lobby}.js`, `server/authoritative/test/{helpers,test-scheduler,test-engine-isolation,test-room,test-security-gaps,test-authority-rules,test-match-fuzz,test-authoritative,test-http-static,test-launcher-authoritative}.js`, `server/package.json`, `server/README.md`, `server/공개서버시작.bat`, `server/공개LAN서버시작.bat`, `docs/milestone/v0.4.10/issues/217/Jupiter/{protocol,report}.md`. `server/authoritative/{protocol,seatToken}.js`·`server/server.js`·`server/security.js`·`demo/**` 미변경.
