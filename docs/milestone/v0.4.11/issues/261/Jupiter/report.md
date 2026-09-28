# #261 Jupiter 서버 보고 — 방 이름·공개 목록 상태·실측 핑

2026-09-27 · Jupiter (Claude Code `claude-opus-5-5` high, bypass) · task_38bd7e55e64d / ctx_43a74f605690 · 기준 a444d57
게이트: PREFLIGHT → GO_ANALYSIS(읽기) → CONTRACT_GATE(PD 수정 수용) → Venus GDD 동기화 확인 뒤 GO_IMPLEMENT.

## 확정 계약 (Mars 소비)

| 항목 | 계약 |
|---|---|
| 이름 전달 | 생성 소켓(`cp-`/`c-`)만 같은 WS 주소에 `?rn=<encodeURIComponent(이름)>`. credential·경로는 그대로(토큰은 64자 ASCII 라 한글을 못 싣는다) |
| 이름 검증 | 원문 전체 `/^[가-힣A-Za-z0-9 _-]*$/` (U+0020 만 공백, 원문 64자 이하) → trim·연속 공백 1칸 → 2~20자. 탭·줄바꿈·제어·NBSP·태그·이모지·자모·NFD 는 지우지 않고 거부(NFC 정규화 안 함) |
| 이름 오류 | `rn` 이 1개가 아니거나 틀리면 세션 확인 뒤 `{v:1,type:'error',code:'E_BAD_ROOM_NAME'}` + close 1008, 방 미생성. **`rn` 없음만** `방 <roomId>`(옛 클라이언트 호환) |
| 첫 프레임 | `room_opened`/`room_joined`/`room_resumed` 에 `roomName:string` (새로고침·재접속도 서버 값). `room_state` 는 불변 |
| 목록 행 | `{roomId:int, roomName, state:'OPEN'\|'SETUP'\|'IN_PROGRESS', seats:'1/2'\|'2/2', ageSec:int, label:'방 #id', players:[닉\|null×2], reps:[id\|null×2]}` — 공개 방 세 상태만, OPEN 먼저·최신(큰 번호) 먼저. 비공개·FINISHED·CANCELED·VOID·CLOSED 없음 |
| 참가 | `p-<id>` 는 공개 OPEN 만(기존 코드 그대로). 낡은 목록의 SETUP/IN_PROGRESS/사라진 방 → `E_ROOM_NOT_FOUND` + close. 같은 계정·경합·단일 로그인 검사 불변 |
| RTT | 로비 전용 `l-` 소켓: `{v:1,t:'rtt',n}` (n 정수 0~2147483647) → 즉시 `{v:1,type:'rtt',n}`. 틀린 n 무응답. 좌석 소켓의 rtt 는 무시(seq 불변). 30초 ping/pong·인증·타이머·유예 불변, 새 rate limiter 없음 |
| 검색 | 서버 필드 없음 — 클라이언트가 `roomName` 으로 거른다 |

## 변경 파일

- `server/authoritative/protocol.js` — `normalizeRoomName`, `rtt` 명령·n 검사, `E_BAD_ROOM_NAME`
- `server/authoritative/server.js` — 업그레이드 URL 의 `rn` 수집, 생성 검증, 첫 프레임 `roomName`, 로비 rtt 응답·좌석 rtt 무시
- `server/authoritative/lobby.js` — 생성 이름·기본 이름, 목록 정렬
- `server/authoritative/room.js` — `lobbyRow` 공개 필드, `isListable` 세 상태
- `server/authoritative/test/test-issue261-lobby.js` (신규), `server/authoritative/test/test-authoritative.js` (SETUP 제거 → 준비 중 표시 단언 1줄)
- `server/package.json` (`test:lobby` + `test:authoritative` 체인), `server/README.md` (#261 절·테스트 목록)

DB 스키마·계정 동작·ws-ticket·security.js·demo/tools/CI 무수정.

## 검증 (각 1회, NODE_PATH = #260 트리 `server/node_modules` 읽기 전용, `DD_TEST_DATABASE_URL` 없음 — CJ DB 미접촉)

| 명령 | 결과 |
|---|---|
| `node authoritative/test/test-issue261-lobby.js` | exit 0 · 53 passed — 이름 경계 단위, 독립 클라이언트 10여 개로 이름/무이름/틀린 이름 생성, 목록 필드 화이트리스트·비공개 제외·순서, 동시 참가 경합 1승 1패, 준비 중 방 참가 거부, 재접속 roomName, 로비 rtt 왕복·틀린 n 무응답, 좌석 rtt 무시·seq 불변, 대전 중 표시·종료 4상태 제외 |
| `node authoritative/test/test-authoritative.js` | exit 0 · 50 passed |
| `node authoritative/test/test-issue260-profile.js` | exit 0 · 62 passed (메모리 대역) |
| `node authoritative/test/test-issue259-accounts.js` | exit 0 · 111 passed (메모리 대역) |

## 한계·후속

- **Mars 필수 연동**: `COMMAND_TYPES` 에 `rtt` 가 추가돼 `tools/typecheck/test/typecheck_test.js` 의 cmdOrphan 검사가 `tools/typecheck/contracts.d.ts` 에 `{v:1;t:"rtt";n:number}` 이 들어올 때까지 실패한다(PD에 msg_6c7febc67071 로 통지). 이 검사와 전체 `npm test`·demo 스모크·2클라이언트 브라우저 스모크는 돌리지 않았다.
- 목록 행 `players`/`reps` 는 계정 없는 서버에서 null 이다 — 이 테스트는 무계정으로 돌려 필드 구조만 봤고, 닉네임·대표 값 채움은 #260 의 `bindSeat` 경로 그대로다.
- IN_PROGRESS·종료 상태 목록은 상태를 직접 옮겨 필터만 확인했다(경기 진행 경로는 기존 테스트 담당).
- 방 이름은 업그레이드 URL 쿼리에 실리므로 프록시 접근 로그에 남을 수 있다 — 공개 정보이며, 화면의 '개인정보를 방 이름에 입력하지 마세요' 안내가 전제다. 욕설 사전·개인정보 자동 판별은 범위 밖.
- [추론] 로비 소켓의 rtt·list_rooms 는 소켓당 빈도 제한이 없다(기존과 같은 노출, 8KB 페이로드·IP당 연결 상한 유지). 남용이 관측되면 소켓당 토큰 버킷을 붙인다.
