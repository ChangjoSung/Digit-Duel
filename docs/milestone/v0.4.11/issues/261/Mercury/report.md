# #261 Mercury 조정 원장

## 현재 — 2026-09-27 21:59 KST Saturn·CJ QA PASS, Git 승인·CI 대기

- CJ가 리뷰한 #261 권장안과 구현 순서를 승인했다. Venus가 기존 GDD13/23/24의 본문·표·Decision Log를 동기화했고 Mercury가 실제 원문과 Project·사람 Editor·실제 Edit Date를 확인했다. 상세 위치는 [Venus 보고](../Venus/report.md) 하나다.
- 선행 #260은 제품42파일 d456102·#259 문서 통합 bf8bc07·익명 화면 a444d57로 커밋/push했다. [PR270](https://github.com/ChangjoSung/Digit-Duel/pull/270)은 미병합 #259 브랜치 기준 분리 PR이며 [HEAD a444d57 브랜치 CI](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36311355490)6/6 PASS다. PR 직접 checks는 없고 milestone 통합 CI는 별도다. #260 트리는 깨끗하다.
- a444d57 기반 별도 issue-261-multiplayer-lobby에서 Jupiter 서버·Mars 화면 구현과 fresh Saturn 읽기 전용 QA를 완료했다. 방 이름/검색·공개 상태·실측 RTT·전체 목록/대기를 반영했다. [서버 보고](../Jupiter/report.md)·[화면 보고](../Mars/report.md), 통합 QA 원장은 아래 한 곳이다. #261은 미커밋이며 원본 root·#259/#260/#264 제품과 사용자 파일을 변경하지 않았다.
- **Saturn LOCAL PASS**: 실제 PG 계정/이름/공개값/RTT/OPEN→SETUP22단언, 격리 메모리 서버의 실제 정상 경기 전이/종료·참가 거부/RTT 수명13단언, 실제 Chrome320px8단언, 마지막 PG 참가 거부 경계1건 exit0. 최초 PG 검사 exit1 시간 초과 원인은 미확정 이력으로 남긴다. 같은 경계의 후속 별도 PG 검사는 성공했으며 초기 실패를 소급 PASS로 고치지 않는다. 제품 결함 재현0, QA 종료 시 source/config/policy281파일 SHA·HEAD 불변이며 이후 PD 인계 메타데이터 갱신 뒤 제품/도구/설정267파일도 최종 불변이다.
- Venus/Jupiter/Mars/Saturn 모두 현재 dispatch·GO·완료마다 승인 모델/권한과 실제 JSONL/footer·preamble/capability·turn_started를 대조했다. custom terminal 인수로 requested/effective=null을 그대로 기록한다. 네 Worker 모두 accepted completed/succeeded → release retained/external/processAction none → 정확한 terminal close ptyKilled=true → Delivery ACK, reclaimable0·#261 terminal0이다. Mercury PD 창구와 QA 서비스만 유지한다.
- CJ 테스트 주소는 **http://localhost:8083/** · PG55461/PID26768 · 서버PID6688이다. GET /·healthz·readyz200, 기존8081/8082 readyz200도 확인했다. dd_sid 쿠키는 포트별로 분리되지 않으므로 기존127.0.0.1 QA와 호스트를 나누어 localhost로 안내한다. 새 QA261 DB의 Saturn261 계정4개는 삭제/재설정 없이 보존했다. SMTP 설정은 읽기 전용 로드·발송0, 기존 DB/계정/백업은 보존했다.
- GitHub #261 완료 조건은 기존3개만 유지하고 검증된 앞2개만 체크한다. CJ가 이번 Comment에서 최종 플레이 QA PASS를 확인했다. 마지막 조건의 필수 CI는 대기다. Git 검토 결과27파일과 source267파일 불변을 확인했고 커밋·push·#260 기준 PR/필수 CI에 대한 별도 승인 질문을 제출했다. #261 커밋·PR, milestone 병합·Issue close·배포·Render 자원/요금 변경은 별도 승인 범위다. 최신 CJ의 다음 Work 지시로 #262 기획 정리를 착수했다. Venus PLAN만 같은 트리에서 진행하며 #261 제품과 QA 서버/DB를 보존한다. #262 정책 확정 뒤 구현하고 #238은 아직 착수하지 않는다.

## 승인·검증 기준

### Saturn 통합 독립 QA — Mercury 기록, 파일 수정0

- task_8dda0832a63b / ctx_a12b05eb086a · 정식 판정 msg_4206e81b1177 · accepted worker_done msg_bba83b52c44e. Saturn은 보고 파일도 쓰지 않았으며 files_modified가 없다. 상세 수신 원문은 외부 QA 보존 파일 issue261-saturn-accepted.json이다.
- PID31324 명시 argv: gpt-6-sol / xhigh / service_tier=default / danger-full-access / approval never. 현재 실제 JSONL rollout-2026-09-27T19-45-55-01a0e278-b211-7d81-865c-ee1709bc9105의 turn_context model/effort/approval/sandbox 및 현재 GPT-6-Sol xhigh footer, live preamble/capability와 시작 영수증 turn_started를 preflight·GO·완료에 대조했다. JSONL에는 effective service_tier 필드가 없어 실제 값으로 꾸미지 않는다. 명시 default 인수·No Fast 화면 관측을 구분한다.
- 정적 독립 대조: 원문 허용 문자→공백 정리/길이, rn 없는 옛 호출만 기본 이름, 중복 이름/고유 번호, 공개 목록 필드 제한, OPEN만 참가, 로비 nonce RTT, 안전한 텍스트·상태 안내·44px/back를 확인했다.
- 실행1: inline 정규식이 PowerShell Unicode 전달 중 잘못되어 syntax exit1, 제품 실행 전 실패였다. 별도 String.raw 호출 실패도 명령 작성 실패로 보존하며 실행 PASS로 세지 않는다.
- 실행2: 수정된 QA261 PG script exit1. 인증된 독립 계정2개로 실서버 이름/정리/잘못된 이름/중복 ID/검색/실제 nickname·rep 공개값/비공개·취소 제외/RTT/OPEN→SETUP22단언 PASS 후 third-viewer 참가 거부 안내 대기에서 시간 초과했다. 이 실행의 경기 시작·진행 단언은 미실행이며 당시 viewer frame은 수집하지 않아 최초 원인은 미확정이다.
- 실행3: PD 승인된 격리 memory-store 현재 서버 script에서 정상 상점/배치→IN_PROGRESS→기권 FINISHED/목록 제외, stale upgrade101→E_ROOM_NOT_FOUND→close1008→gone/SETUP 목록 갱신, 5초/숨김 polling·3초 무응답/늦은 답 폐기/leave/socket stop13단언 PASS. 이어 CDP 준비 도우미가 미해결 Promise를 참으로 취급해 Chrome 이동 전 실패, 전체 명령은 exit1이었다. 뒤의 Chrome 단언은 미실행이다.
- 실행4: 위 CDP 오류만 수정한 별도 Chrome 검사 exit0/8단언. 현재 실제 HTTP 서버·320px L02/L03·scrollWidth320·최소 터치 및 back44px·문구/개인정보 안내·실측1ms·대기/보드 숨김·leave→L02/back→로비를 확인했다.
- 실행5: 최초 PG 실패 경계를 해소하기 위해 PD가 추가2계정/1건만 승인했다. 최종 좁은 PG script exit0: 정상 host/guest join SETUP room4, third B viewer AUTH=in/gate=null/roomId=null, upgrade101→E_ROOM_NOT_FOUND→close1008, gone 안내와 SETUP 목록 갱신. 정상 authenticated host leave 후 테스트 소켓을 닫았다. 초기 실패 원인을 소급 확정하지 않는다.
- QA261에 남은 테스트 아이디: saturn261aa7ef / saturn261ba7ef / saturn261ce267 / saturn261de267. 생성 비밀번호·세션값을 보고하거나 파일에 저장하지 않았다. 기존 CJ DB/계정은 접촉하지 않고 migration/drop/reset/메일 발송0, 자신이 연 임시 서버/연결은 종료했다. 기존 통과 suite 전수 반복은 하지 않았다.
- 검사 후281파일 SHA변경0·HEAD a444d57 불변, worker_done files_modified 없음. 필수 remote CI·CJ QA는 검사하지 않았으며 LOCAL PASS만 주장한다. 실제 사용량(완료 gate 시점 누계): input6,206,748/cached input6,019,584/output39,838/reasoning output16,723, total6,246,586. PD 사용량은 이 수치에 포함하지 않으며 비교 작업 표본 전 절감률을 주장하지 않는다.



### 서버 납품 (제품 전체 PASS 아님)

Jupiter completed/succeeded·filesModified 서버8개+Jupiter/report.md를 확인했다. 현재 Opus5.5/high/bypass·JSONL/PID/footer 재대조 후 release retained/external/processAction none → terminal close ptyKilled=true → Delivery ACK로 종료했다. 이름/목록/nonce RTT는 합의 규약 그대로다. focused live53·authority50·profile memory62·accounts memory111 각1회 exit0. 기존 #260 node_modules는 읽기 전용 재사용했고 CJ DB를 접촉하지 않았다. live 무계정 검사라 players/reps는 null이고 IN_PROGRESS/종료 필터는 상태 직접 변경 검사다. 실제 계정값·경기 전이는 독립 QA에서 확인해야 한다. 공용 typecheck의 rtt seatless union 연동을 Mars에게 전달했다. 전체 CI·브라우저·Saturn·CJ QA는 아직 아니다. 상세 구현/한계는 Jupiter/report.md 하나에 있다.

### 19:19 구현 규약 대조 — 기획 원문 확인 전 코드 HOLD

Jupiter task_38bd7e55e64d/ctx_43a74f605690(PID34740·JSONLf48da012), Mars task_87d0b78aa000/ctx_e0c9ddbb9f90(PID15560·JSONLecead951)는 현재 Opus5.5 응답·명시 high/bypass·실제 bypass footer·turn_started·preamble/capability를 대조하고 읽기 전용 분석했다. 채택된 기존 terminal의 requested/effective는 null이다. Jupiter의 초기 모델 header는 bounded cursor에서 보존되지 않아 별도 확인했다는 최초 GO 문구를 즉시 정정했으며, 실제 모델 근거는 현재 JSONL·명시 인수·현재 footer다.

- 인증 credential64 ASCII 한계를 확장하지 않고 create 요청의 기존 WS URL에 rn을 percent-encode해 전달한다. 기존 pathname/query를 보존하고 서버가 원본 허용 문자를 먼저 검사한 뒤 공백 정리와2~20자를 검증한다. 단독/분해 자모를 NFC로 새로 허용하지 않는다.
- rn이 없는 종전 클라이언트만 서버의 '방 <roomId>' 기본 이름을 사용한다. 명시된 빈/잘못된 이름은 E_BAD_ROOM_NAME으로 거부한다. 이는 하위 호환 기술 결정이며 새 UI의 빈 이름 허용 정책이 아니다.
- 첫 open/join/resume frame의 roomName, 목록의 roomId/roomName/state/seats 문자열/ageSec/종전label/players/reps, lobby 전용 rtt n 정수(0~2147483647) echo를 양쪽에 동일하게 전달했다. seated rtt는 seq/게임 상태를 바꾸지 않고 무시한다. 기존 heartbeat/auth 제한을 보존한다.
- Mars는 client/UI/공용 typecheck 선언·demo회귀/QAhelper만, Jupiter는 server/서버검사만 편집한다. 기존 QAhelper를 최소 parameter화해261은8083/55461·별도 QA루트로 분리하고260 기본 동작을 유지한다. 기획 원문 확인 뒤 명시 GO_IMPLEMENT를 보내며 현재까지 제품 코드 수정/런타임 검사0이다.

기존 GitHub 완료 조건3개를 유지한다. 진행은 해당 조건의 체크로만 관리하고 새 댓글·현황 TODO를 만들지 않는다. 공개 목록에서 계정ID/이메일/토큰/초대 코드/IP/가방/배치/전투 내부 정보를 노출하지 않으며, 서버가 참가 경합·이미 시작/닫힌 방 거부를 최종 검증한다. 기존 단일 로그인·대표 하수인 방 입장 고정·전적·상점/준비/재접속/게임 타이머를 보존한다.

각 Worker는 full access·무확인 진행·승인 모델을 명시 기동하고 현재 dispatch/GO/완료마다 모델·권한·preamble/capability·시작 증거를 대조한다. Mercury는 제품 코드를 쓰지 않고 Saturn은 파일을 수정하지 않는다. 검사 기본1회, 실패/수정/새 위험에 필요한 범위만 재검사한다.

### 2026-09-27 22:12 KST Git 정리 승인

CJ는 별도 질문에 커밋·push·PR 작성 승인을 명시 답변했다. 검토한27파일만 stage하며 #262 PLAN 문서는 제외한다. #260 브랜치를 기준으로 분리 PR을 만들고 최신 HEAD 필수 CI를 확인한다. #261 통과 제품과 QA261 DB·계정·SMTP는 보존한다. milestone 병합·Issue close·배포 승인은 포함하지 않는다. #262의6종/5초/2.5초·경기 전반 양쪽 차례·브라우저 상대 숨김 유지도 별도로 CJ 확정됐으며 별도 작업 트리에서 이어간다.