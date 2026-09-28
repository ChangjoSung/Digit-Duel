# #260 Mercury 조정 원장

## 현재 — 2026-09-27 CJ 최종 QA PASS·커밋/PR 작성 승인

CJ가 #260 최종 QA PASS를 확인했다. GitHub 기존 완료 조건 첫3개를 체크하고, Saturn·CJ PASS와 필수 CI 대기를 마지막 조건에 함께 표시한다. CJ가 검토한 권장 순서로 구현 착수를 지시해 선행 #260 커밋·PR 작성과 필수 CI를 승인했다. #259 PR269가 미병합이므로 #260 PR은 issue-259-accounts를 기준으로 분리하고 최신 브랜치 HEAD의 필수 CI를 실행한다. milestone 병합·Issue close·배포는 승인되지 않았다.

최신 CJ 지시로 Digit-Duel의 기존4개 WorkTree에 남아 있던 완료 Worker13개를 정확한 terminal handle로 종료했다. 13/13 ptyKilled=true, 재조회 Worker0·Mercury PD1, main Run57 completed/3 failed·reclaimable0. 종료 직후35,179개 열거 파일 SHA와4개 HEAD/status 불변을 확인했다. 초기 git 열거의 Unity 초장경로 경고로 빠진 파일까지 검사했다고 주장하지 않는다. 근거는 외부 QA 폴더 worker-cleanup-20260927-before.json 및 worker-cleanup-20260927-receipts.json이다.

제품 파일·보고서·WorkTree·CJ QA 계정/DB·SMTP·백업은 보존했고8081/8082와PG55459/55460은 정상이다. CJ가 #261 검토용 권장안과 구현 순서를 승인했다. #260 PR/CI를 먼저 정리한 뒤 기획 동기화·서버/화면·독립 QA를 수행한다. 과거 실패/REVISE를 PASS로 소급하지 않는다.

### 18:32까지의 구현·검증 이력

CJ가 #259 최종 로컬 QA PASS와 다음 작업 진행을 지시했다. Venus·Jupiter·Mars가 파일 무수정 분석을 완료했고 CJ가 아래 세 묶음의 권장안을 확정했다. #260은 계정·최신 타이머 통합24945b7 기준의 별도 issue-260-account-lobby에서 구현 중이다. #259 PR269는68863dc 최종CI6/6 PASS·Saturn 통합 LOCAL PASS·검토 가능 상태이며 milestone 병합은 승인되지 않았다.

화면·단일 GET프로필·uppercase결과/durationMs·대표 저장·WS reps와 durable outbox의 초기 구현은 완료됐다. Jupiter 최초45memory/45PG·계정PG121·server npmtest exit0에도 in-memory 기록 유실 설계는 PD **REVISE**다. worker_done succeeded는 업무 정산이며 제품 PASS로 소급하지 않는다. 완료와 corrective input 경합으로 이전 capability revoked 뒤 추가 수리가 시작돼 즉시 쓰기를 중단시켰다. fresh Jupiter task_53a1be7f38ea/ctx_3f87b31151ef가 stray 파일을 바이트 동일 사본으로 보존한 뒤 정상 수리했다. 같은 디스크의 fsync 결과 저장·양좌석 원자기록·재시작 replay·상한시 신규 경기 제한을 구현했으며 Render 임시 디스크 교체까지 보장하지 않는다.

Saturn의 독립 QA는 실제 두 계정 HTTP/WS **22/0**, 별도 PG 중단·서버 재시작·중복 replay **15/0** 통과지만 제품 **REVISE**다. 네 가지 수정: Windows 기본 outbox의 실제 ACL, 로그인 탭40→44px, 무효 경기 종료 사유의 한국어 표시, 제품 화면 내부 GDD/구현 문구 제거. task_d20b9860b5b5/ctx_65736465adf3의 현재 Sol/xhigh/default·never/full access·현재 JSONL/PID/footer와 preamble/capability를 GO/완료 때 대조했다. HEAD24945b7·41개 변경 경로 해시 불변·수정파일0, 정산/해제/ACK 완료. Jupiter task_761e1fc5612c/ctx_bc4db297c6dc(새 PID33920·JSONL1ea79845)와 Mars task_e3819aaa286b/ctx_f2b3def6fcbf(즉시 후속 PID38964·JSONLc96b614a)를 새 preamble/capability·현재 Opus 응답·명시 high/bypass·footer 확인 후 GO했다. launch requested/effective는 없는 필드로 기록하며 실제 실행 관측과 구분한다. Jupiter의 preflight Git HEAD 읽기1회는 경계 위반으로 보존했고 추가 Git 사용을 중단시켰다.

### 18:32 Saturn 검증

**최종 로컬 PASS**: fresh Saturn task_beb465399848/ctx_cca41a09e5fb가 네 가지 수리를 독립 재검증했다. 실제 Windows 새 폴더/파일·재열기/원자 교체·tmp/bad 사용자 SID 전용 권한, 넓은 기존 dir/file/tmp/bad의 거부 및 데이터/ACL 불변을 확인했다. 독립 Chrome의 실제 CSS viewport320/390/432 × 로그인/가입/복구9화면에서 모든 계정 버튼·탭·입력칸44px 이상, 가로 넘침0. 실제 서버 사유와 한국어 표시·내부 문구 제거·자산 권리 문서 보존도 확인했다. 기존 live22/0·복구15/0·Mars74/0를 재사용하고 전체 CI를 반복하지 않았다. 첫 ACL probe의 기대값/harness 오류와 Chrome Node 모듈 모드 오류는 수정 뒤 성공한 검사와 구분한다. POSIX 런타임·원격CI·CJ QA는 미실행이다. HEAD/status·41개 변경 경로 SHA 불변, 저장소 수정0. 현재 Sol/xhigh/default·never/full access·PID40372/footer/JSONL을 완료 때 재대조하고 정산/해제/ACK 완료, Run의 reclaimable Worker0. 독립 Chrome 프로세스는 정지했고 Temp 프로필은 보존했다.

**CJ 주소 http://127.0.0.1:8082/**, Node42336·PG31704/55460·readyz200. #2598081/PG55459와 데이터·SMTP는 그대로다. #260 preview는 별도 신규 DB이며 PD/Worker 가입·메일 발송·삭제0. 실제 UI용 PD테스트 계정은 종료된 Saturn scratch18082에만 생성했다. CJ는 Orca·Chrome 서로 다른 계정으로 가입해 타이틀→시작→로비, 대표 변경/새로고침 유지, 잠긴 메뉴 안내, 공식 보드 경기 시작 뒤 기권의 양측 승패/상대/사유/턴/시간 기록과 진행 경기 새로고침 복귀를 확인한다. 기존 #259 계정은8082에 자동 이관하지 않았다. #260 커밋·PR·마일스톤 병합·배포는 승인되지 않았다.

표적 수리 완료: Mars는 계정 탭·버튼·입력칸을44px로 고치고 서버 실제 무효 사유3개를 한국어로 표시하며 내부 문서 drawer/구현 라벨을 제거했다. 첫 회귀는 과거 잘못된 no_contest fixture1개 실패, 서버 계약으로 수리 뒤 **74/0**. Jupiter는 새 Windows 기록 폴더에 사용자 SID 전용 ACL을 설정하고 기존 dir/file/tmp/bad는 읽기 검증만 해 넓은 권한이면 기동 거부한다. POSIX는 현재 UID/0700·0600 검증이다. 실제 Windows 제한·권한/데이터 불변·재열기 검사는 **62/0** 1회, POSIX 실행·PG 재실행 없음. accidental server.js require는 즉시 종료·잔여 프로세스/기본 data 생성0으로 보존한다. 두 업무의 현재 Opus/high/bypass·footer/JSONL 재대조, 정확한 파일 범위 정산/해제/ACK 완료. CJ preview는 helper로 owned Node33464만 정지 후 데이터/PG31704/SMTP 보존 재기동해 readyz200. 변경된 서버 ACL이 실제 private QA 경로를 허용했다. #259 서비스와 계정은 보존한다. fresh Saturn task_beb465399848/ctx_cca41a09e5fb, PID40372·JSONL01a0e229, Sol/xhigh/default·never/full access·footer/preamble/capability 대조 후 네 가지 변경 위험만 재검증한다. 제품/문서 파일은 QA 동안 동결한다.

Mars 후속 완료: E_RESULTS_BACKLOG의 한국어 다시 시도 안내와 로비/프로필 보존, smoke_issue260 **68/0** 1회. helper의 QA 폴더 전체 Windows 사용자 전용 ACL·시작 때 확인·정확한 PID/명령줄 소유 검증을 보완했다. 첫 기동은 Windows postgres 자식이 pg_ctl의 출력 PIPE를 상속해 spawnSync EOF를 기다린 **실패 이력**이다. PD가 실제PGready/포트/멈춘bootstrap을 확인해 조사·표적 재시도를 지시했고 Mars가 pg_ctl stdio ignore로 수리했다. 정확한 owned bootstrap38776만 종료·PG31704/data 보존 후 재시도1회 성공. **http://127.0.0.1:8082/** Node33464·PG31704/55460·healthz/readyz/page200·무쿠키 session401·001~005 적용·SMTP 비밀 설정 읽기 전용 로드. 새 계정/로그인/메일/DB 삭제0, #259 Node36888/PG34176 유지. 현재 #260 CJ QA DB는 별도 신규 DB다. 임시 프로세스 PID 비교의 선행 inline quoting 실패는 종료 없이 지나갔고 바이트 비교로 정확한 명령줄을 확인한 뒤 종료했다. Saturn 독립 QA와 CJ QA·#260 PR/원격CI는 아직 대기다.

Jupiter 수리 완료: 파일 append+fsync 뒤 결과 전송, DB 양좌석 원자 INSERT와 UNIQUE 제약, DB 성공 뒤 tmp+fsync+rename 제거, 재시작 검증 replay·잘못된 줄 .bad 보존·제약 거부 보류 유지. fixed200 상한·파일 쓰기 실패 때 신규 create/join 차단(E_RESULTS_BACKLOG), resume 허용. 메모리58/PG58·계정 메모리111 각1회 통과, scratchPG55474 종료,005 불변. 원래 Dispatch 정산 뒤 작성됐던 코드 한 파일은 fresh Worker가 검토하고 바이트 동일 보존본을 기존 Jupiter 산출물 폴더에 남긴 뒤 live 코드를 수리했다. 현재 Opus 모델/effort/PID/footer·JSONL을 완료 때 재대조, release는 retained/no_owned_resource·processAction none, Delivery ACK 완료. Windows ACL·새 저장 대기 안내·QA기동은 Mars 후속 task_f5a62fc536de/ctx_a858a34d8a36에서 수행한다. samePID38964의 현재 새task/dispatch/preamble/capability·Opus 응답·high/bypass·정상footer 재확인 뒤 GO/GO_START. Saturn task_d20b9860b5b5/ctx_65736465adf3는 fresh Sol/xhigh/default·full access/never로 준비됐으며 최종 파일 동결 전 HOLD다. 현재 GET /api/profile 하나·POST대표·WS reps 계약으로 일치했고 불필요한 /profile/matches는 제거했다.

### CJ 확정

- 공식 전적은 서버 확정 멀티 승·패만 집계한다. 기권·접속 종료 몰수는 승·패에 포함한다. 무효는 목록에만 남기고 집계하지 않으며 경기 시작 전 취소·PVE는 기록하지 않는다.
- 경기 당시 상대 닉네임·종료 사유·턴 수·보드 시작부터 결과 확정까지 실제 경과 시간을 저장한다. 상점·재접속 대기를 포함한다. 전체 기록을 보존하고 최근 20경기를 표시한다. 같은 경기는 한 번만 기록한다.
- 대표 하수인은 일반 30종, 기본 새끼 화룡(M-F1). 로비에서 제한 없이 변경하고 방 입장 당시 선택을 해당 방에 고정한다. 이후 변경은 다음 방부터 적용한다. 그림이 없는 10종은 기존 이모지로 표시한다. 전투 효과와 미래 소유권에 연결하지 않는다.
- 유지된 로그인 세션도 타이틀 → 시작 → 실제 로딩 → 로비를 거친다. 진행 중 경기 새로고침은 기존 경기로 복귀한다. 비로그인은 기존 로그인 게이트를 따른다.
- 기존 확정: 재화0·잠긴 메뉴/싱글2카드, 도움말·페이지 로드 튜토리얼·핫시트 제품 경로 제거, 엔진·공용 경제·회귀 보존. 가짜 진행률을 쓰지 않고 방 목록 오류는 로비 전체를 막지 않는다.

### 구현 경계와 정정

- Jupiter는 서버의 결과 기록·프로필·대표 하수인 저장/조회와 공개 방 좌석 표시를 맡는다. Mars는 화면·로딩·잠금·선택 UI·클라이언트 프로토콜 소비를 맡는다. 기존 #253 공용 자산을 우선 사용하며 새로운 아트 필요가 입증되면 Earth로 배정한다.
- 결과 저장은 room의 _finalize 단일 종료 전이와 DB 고유 제약으로 보장한다. 기존 onFinalize는 WIN 경로의 notify:false 때문에 호출되지 않으므로 Venus 초안의 “onFinalize에 저장” 제안은 채택하지 않는다.
- 기존 players 배열의 닉네임 형식은 유지하고 대표 하수인 ID는 별도 공개 필드로 전달한다. 가방·배치·스킬·경제 비공개 상태를 포함하지 않는다.
- 서버/DB 오류 때문에 기록을 조용히 유실하는 설계를 승인하지 않았다. 저장 신뢰성과 오류 처리는 Jupiter가 범위 안에서 설계·검증한다. 서버 재시작 뒤 진행 경기 복원은 기존 비범위다.
- #259와 #260 코드를 같은 dirty 트리에 섞는 Venus 초안 제안은 채택하지 않는다. CJ가 #259 커밋·PR 작성을 별도 승인했고 b865133으로 35개 파일을 보존했다. 최신 원격 milestone은 bd4c90c이며83434f0과 전체 트리 b82890cf가 동일하다. 실제 bd4c90c을24945b7로 feature에 통합했고 PR의 milestone 병합·배포는 승인되지 않았다.
- #261 방 이름·검색·핑 및 #238 경기 UI는 이번 구현에 섞지 않는다. 자동 튜토리얼/도움말 제품 경로 제거에 필요한 기존 검사만 계약에 맞춰 바꾸며 공용 게임 규칙의 기대값을 낮추지 않는다.

### 검증과 근거

읽기 전용 분석: Venus task_dc5e159bedf3/ctx_2d7c948b8b4a, Jupiter task_63b1cd2dc5ff/ctx_5b85902f08a4, Mars task_589cce69383c/ctx_673154384fba. 모두 Opus5.5/high/bypass 명시 실행·현재 JSONL 모델·정상 입력창/footer·turn_started·preamble/capability를 GO/완료 때 확인했다. adopted requested/effective는 null이며 실제 관측과 구분했다. 파일 수정·런타임 검사0, succeeded는 분석 완료이며 제품 QA PASS가 아니다. worker_done 뒤 external retained/processAction none release→Delivery ACK 완료했다.

GitHub는 기존 완료 조건4개 한 목록을 유지하고 확정 규칙만 치환했다. 신규 댓글0. Venus task_f3591612d997/ctx_abe713cdc2a6가 eli-adult로 Notion 원본을 동기화를 완료했고 Mercury가 GDD13/23/24 세 원문을 직접 조회해 확정 세칙·Project·사람 Editor·실제 EditDate를 확인했다. 상세 Worker 메시지·런치 증거는 Orca run_ea381b9521ea에 있다.

Saturn은 두 scratch 서버/PG(18082/55475,18083/55476)만 정확한 소유 확인 후 종료했고 CJ용8081/8082는 보존했다. saturn260r-oPAMKm 폴더의 범위 확인 후 재귀 삭제는 자동 승인 검토가 'blocked by policy'로 거절했다. 재시도하지 않았고 그 데이터와 삭제 미시도한 주 scratch saturn260-dVEv3J 데이터를 보존했다. 초기 inline 구문/닉네임 길이/WS actor 검사 harness 실패는 최종22/15 검사와 구분한다. PD 브라우저는 별도 disposable 계정에서 가입→타이틀→실제 로딩→로비, offline 오류/재시도, 대표30종 선택·M-F2 저장을 확인했다. 타이틀 CSS 실제320/390/432 폭의 overflow0을 확인했으나 Orca 모바일 캡처는 DOM과 다른 그림을 출력해 시각 PASS 증거로 채택하지 않는다. 깨진 iframe/캡처와 잘못된 /api/auth/register 404 요청(가입0)은 재현 이력으로 보존한다.

현재 CJ QA는 PASS이며 후속은 별도 Git 승인 뒤 커밋·PR·필수 원격CI다. #260 stage·commit·PR은 승인되지 않았다. 전체 CJ 착수 Digit-Duel Worker full access·무확인 실행, 고정 모델 배치·역할 경계·Git/Render 게이트 유지. 다른 프로젝트와 계정 전역 설정은 바꾸지 않았다. 아래 앞선 검증 문단의 미기동/HOLD/진행 중은 각 단계의 이력이며 현재 상태는 최상단 최종 PASS와 주소를 따른다.
