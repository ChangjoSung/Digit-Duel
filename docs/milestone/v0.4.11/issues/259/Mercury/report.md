# #259 Mercury 조정·독립 QA 원장

## 현재 — 2026-09-27 16:53 KST CJ 최종 QA PASS / #260 분석 착수

- **CJ 최종 검수**: CJ가 “CJ QA Test PASS·최종 QA Test PASS·다음 Work 진행”을 직접 전달했다. 이번 로컬 계정 흐름의 CJ 재검수는 PASS다. 종합 판정 외에 받은편지함 시각·수신 로그·코드 값은 관측하지 않았다. HTTPS/Render·최신 타이머 통합·PR/필수 CI는 별도 남아 있으며 제품 미커밋·Issue OPEN을 유지한다. 다음 #260은 기획/서버/화면 분석부터 착수했다.
- **최신 확정 계약**: 비밀번호 찾기는 아이디만 입력한다. 서버가 먼저 계정 존재를 확인하고 없는 아이디는 `404 E_ID_NOT_FOUND`·“존재하지 않는 아이디입니다”로 알리며 첫 화면에 머문다. 있는 계정의 DB 등록 이메일로 6자리 코드를 보내고, 발송 성공 뒤에만 코드 입력으로 진행한다. 등록 이메일 없음은 `409 E_EMAIL_REQUIRED`, 발송 불가·실패는 `503 E_MAIL_UNAVAILABLE`로 진행을 막는다. request `{userId}` → verify `{userId,code}` → complete `{resetToken,newPassword}`. 가입 이메일 필수·중복 허용, 계정별 코드/허가, 직전 비밀번호 거부·세션 무효화는 유지한다. 이전 ID+이메일 입력·없는 계정의 같은202 응답 정책은 폐기됐다.
- **구현·수리**: Jupiter `task_3f469c4349ff`/`ctx_f9743718c9f1` 서버 및 Mars `task_75aa483849a3`/`ctx_4f4c8441d6f7` 화면 구현 완료. 최초 Sol QA `task_2ae62c5a0bfa`/`ctx_4ea2edb6c1df`는 메모리110/클라이언트203 검사 통과에도 MEDIUM 2건으로 **REVISE**였다(35 SHA·status·HEAD 불변). 실제 합성 발송에서 재발송 실패503 뒤 이전 코드401/화면 잔류, 실제 임시 HTTP에서 A 재설정이 B의 유효 쿠키를 지워 B 브라우저401(서버의 B 세션은200)을 재현했다. Mars `task_514046ecc0ce`/`ctx_fcfbd4595eb4`가 재발송503 때 코드·허가를 버리고 아이디를 채운 첫 화면으로 복귀하도록 수리했다(429는 코드 화면 유지·늦은503 폐기,208/0). Jupiter `task_e55f14a4176f`/`ctx_092a40e06500`는 성공 전 현재 쿠키 계정을 확인해 다른 계정의 유효 쿠키를 보존하고 대상 계정 세션 폐기·자기 쿠키 제거·자동 로그인 없음·실패 시 쿠키 보존을 유지했다(111/0). SQL·마이그레이션·의존성 추가 변경 없음.
- **최종 독립 QA**: fresh Saturn `task_b041302c3264`/`ctx_eb8d56f6f739`, Sol/xhigh/default·full access/never, PID35756·현재 JSONL `01a0e1c1-639d-74e3-8486-0857f4b3475f`·실제 Sol footer와 turn_started/preamble/capability 대조. 메모리 HTTP **111/0**, 클라이언트 **208/0** 각1회·실제 B 쿠키/자기 쿠키/무쿠키·아이디404 우선·503/429/늦은 응답 검증, 35 SHA/status/HEAD 불변·파일 수정0으로 **LOCAL PASS**(16:35). 격리 PG120/0·서버PG17/0 및 typecheck0은 영향을 받지 않은 선행 증거를 재사용했다. 최초 REVISE를 PASS로 소급하지 않는다. 별도 API로 이미 발급받은 서버 허가는 나중 요청 실패에도 기존 만료/자격 세대 규칙으로 살아 있는 관측을 보존한다(현재 UI는 자기 로컬 허가를 버리며, 이 별도 API 순서는 화면 수용 범위 밖이다). GO 점검의 추가 ReadAllText 호출이 순간 파일 잠금으로 실패한 이력은 유지하며, 단일 Get-Content 스냅샷 재조회로 같은 현재 턴 Sol/xhigh와 task/dispatch/capability를 확인했다.
- **모델·정산**: Opus Worker는 Jupiter PID37148/JSONL356905f0, Mars PID34568/JSONLe7df84bc, Venus PID5340/JSONL557c3aa1의 현재 Opus5.5/high/bypass·정상 입력창/footer와 각 dispatch를 GO/완료 때 대조했다. 초기 Saturn PID38832/JSONL01a0e1b5의 Sol/xhigh/default를 별도로 대조했다. adopted launch requested/effective는 전부 null이며 명시 인수와 실제 화면/현재 턴 관측으로 구분한다. 모든 worker_done succeeded는 완료한 구현/문서/QA 업무의 정산이고 최초 QA 판정은 REVISE다. 각 정산 뒤 external retained/processAction none release와 Delivery ACK 완료(프로세스 종료 주장 없음).
- **현재 서비스**: 기존 `stop.ps1 -ServerOnly`→`launch-hidden.ps1` 실행으로 옛 Node42508 종료, 새 Node**20592**/PG**34176**(55459)·**http://127.0.0.1:8081/** 유지. WMI bootstrap41872 종료 후 `/`·healthz·readyz200, 무쿠키 session401, served account.js33519B·SHA prefix`4519F50DD47B881D`=checkout을 확인했다. 의도적으로 유효하지 않은 `userId:"!"` 요청만 실제 서버에 보내 계정 조회·메일 없이404 `E_ID_NOT_FOUND`·정확한 알림을 확인했고, 유효한 없는 ID의 DB 확인은 합성/격리 검사 증거다. HTTP 확인 명령의 exit1은 마지막의 이미 종료된 bootstrap PID 조회 때문이며 HTTP/해시 판정은 위 결과 그대로다. 다음 상태 명령 exit0에서 node/pgAlive=true·bootstrapAlive=false 확인. SMTP 개인 설정 로드 유지, 실메일/가입/로그인/DB 삭제/비밀번호 변경0. 15:52 이후 CJ 가입 데이터의 현재 개수는 재조회하지 않았고 보존했다. 이번 로컬 흐름의 CJ 최종 QA PASS를 접수했다. HTTPS/Render·최신 milestone 통합·PR/CI는 남아 있다.
- **문서·GitHub**: Venus `task_c5b843a6ead7`/`ctx_7892102c1395`가 eli-adult 적용 후 기존 GDD13/23/24 본문·표·요약·결정 이력을 치환했다. Mercury가 세 원문을 직접 fetch해 아이디만 입력·없는 ID 알림·DB 등록 이메일·폐기된 ID+이메일 정책 표시와 Project`3ae1e7f1708580f7bb88c7ee4f511aa0`/사람 Editor`8e0a8270-d0e3-407e-a7d2-b3f992f1e366`/EditDate2026-09-27을 확인했다. GitHub #259는 기존4완료조건만 업데이트·OPEN/댓글0이며 새 TODO·댓글·보고서 파일은 없다. 모델별 합산 사용량/PD 시작 대비 증분은 이번에 측정하지 않았고 절감률을 주장하지 않는다.

### 15:52 운영 체크포인트 — 이력(새 흐름 배포 전)

- 최신 CJ 판정: **로그인·새 로그인 시 기존 접속 자동 종료·브라우저 재시작 후 서로 다른 계정 유지·전투/재접속 PASS**, **가입·이메일 재설정 REVISE**. 가입 이메일 중복 허용이 새로 확정됐다. 09:03 Saturn LOCAL PASS는 그 직전 코드의 판정이며 이번 변경까지 통과한 것으로 계산하지 않는다. 제품 미커밋, 실제 이메일 수신·HTTPS·Render·CI·최신 milestone 통합은 남아 있다.
- 작업 트리: `issue-259-accounts`, HEAD `fafc619dcc413bae484a4e0bf53355e845ee8a67`. 원격 milestone은 #263 PR #268 병합 뒤 `83434f0`이며 이 dirty 트리에는 아직 통합하지 않았다.
- 현재 서비스: **http://127.0.0.1:8081/**, 테스트 계정 삭제 후 Node PID42508(15:51:09)·기존 PG PID34176(55459) 유지, WMI 숨김 기동이다. 부트스트랩40748 종료 뒤 페이지·healthz·readyz200·미로그인세션401·리슨을 확인했다. SMTP 반영만 한15:38의 Node680과14:22 Node24520은 이력이다. 기존 도구를 `powershell -NoProfile -ExecutionPolicy Bypass -File`로 실행했으며 시스템 전역 실행 정책은 바꾸지 않았다. PC 로그오프·재부팅 뒤는 수동 재기동하며 이 주소는 #259 로컬 QA다. 최신#263 타이머/HTTPS/Render 통합 주소가 아니다.
- 이메일 수신 QA: CJ가 앱 비밀번호 발급 후15:36:18 설정을 저장했다. Mercury는 `secrets/smtp.json` 형식·필드 존재·본인 계정 전용ACL만 확인하고 값은 출력하지 않았으며 기존 서버만 재시작해 반영했다. Gmail SMTPS465 연결/인증은 **PASS**, 실제 메일 발송·받은편지함·화면 코드 입력은 **미검증**이다. 새 요청의 같은 출처/빈 입력은400 E_BAD_INPUT(계정 조회/발송 전 종료)이며 이전 미설정503은 이력이다. 단일 [운영 보고](../Jupiter/local-qa-service.md)에 실행 명령과 근거를 관리한다. CJ는 가입한 ID+등록 이메일로 재설정 요청→받은편지함/스팸함의6자리 코드 입력→직전 비밀번호 거부→다른 비밀번호 완료를 검수한다. 비밀번호·앱 비밀번호·코드는 채팅/보고서에 받지 않는다.
- SMTP 점검 정산: fresh Jupiter `task_85282b9e6fc2`/`ctx_5981bbe55add`, PID27848 명시 Opus5.5/high/bypass·현재 JSONL `3cefefcb-f81a-49fe-965b-e98af80769cd`/정상 composer/footer·turn_started/preamble/capability를 GO/완료 때 확인(adopted requested/effective null). 기존 제품 `smtpMailer()`가 만드는 transport를 포착해 installed Nodemailer10.0.10의 `verify()` **1회 PASS(DNS/TLS/접속/AUTH)**, sendMail0·DB조회0·계정변경0·제품/도구/테스트수정0. smtpOptions는 비공개이므로 export를 새로 만들지 않고 제품 흐름을 그대로 사용했다. stdout ignoreTLS=true는 값이 아닌`ignoreTLS===false` 단언의 라벨 오류였다. 네트워크 없는 재포착으로 실제 secure=true/requireTLS=false/ignoreTLS=false·제품9옵션 동일을 확인했고 인증 검사를 반복하지 않았다. Origin 없는 선행2요청403은 실패 이력이며 올바른Origin/빈 입력400을 구분한다. worker_done15:43:11 succeeded→현재 모델/PID/footer 재대조→외부 retained/processAction none→Delivery ACK, 시간 자리표시15:4x는 Mercury가15:43으로 치환했다.
- **최신 CJ 승인에 따른 테스트 데이터 삭제**: 계정4개를 모두 삭제해 깨끗한 가입부터 QA하라는 명시 지시로 이전 계정 보존 제한을 이 범위에서만 변경했다. Jupiter `task_4d7d789c47f1`/`ctx_ddb81aa7d8a3`가 Node만 정지→001~004 체크섬/FK2개 cascade·사용자trigger0 확인→세 표 잠금/정확히 accounts4 확인→한 트랜잭션에서 accounts4·연결sessions2·password_resets0 삭제→COMMIT 전 모두0→재기동 후 모두0을 재조회했다. db_meta3·schema_migrations4 행의 다이제스트 불변·schema verify PASS, PG/SMTP/파일/기존백업/제품 유지. 가입/로그인/실메일/재설정코드 발급0이며 최신 실제 수신은 CJ가 새 가입 후 검수한다. worker_done15:51:59 succeeded, 현재 PID37364·Opus5.5/high/bypass·JSONL/정상 footer를 완료 때 다시 확인했고 release/ACK 완료다.
- 삭제 작업 시작 조사: 최초 `ctx_0b73078285bf`는 turn_start_unobserved, 정상 빈 TUI·transcript_missing·작업ID 없는 JSONL을 확인한 뒤 abandoned로 fence했다(프로세스/DB 변경0). 같은 fresh TUI의 retry `ctx_ddb81aa7d8a3`도 기동 영수증은30초 안 turn_start_unobserved였으나, **작업 전** 현재 JSONL `8a810821-7de0-41a8-af26-c0da592f0898`에 retry task/dispatch/preamble/capability와12개 실제 Opus 응답·high/bypass, PID37364명시 인수·정상 working TUI·실제 precheck ask를 뒤늦게 독립 확인한 뒤 GO했다. 최초 실패/영수증을 정상 관측으로 소급하지 않는다.
- GDD 운영 상태 문구 정리: Venus `task_6d92616b8d42`/`ctx_360e1c872073`가 GDD-13/23의 당시 미설정 문구를 기록 시점 이력으로, GDD-24 A01의 현재 미설정 단정은 설정 필요/미설정503/가입 비대기라는 안정 계약과 GitHub#259 기존 완료 조건 안내로 치환했다. Summary·Editor 실제 사람·Project·EditDate2026-09-27을 포함해 Mercury가3원문을 재조회했다. 새 규칙/진행댓글/운영일지/로컬보고서/자격증명 추가0. GO시 현재 PID11296·명시 Opus5.5/high/bypass·JSONL/정상footer·turn_started/preamble/capability를 확인했고 완료 뒤 TUI는exited여서 당시 footer 재조회는 불가했다. 최종JSONL모델 증거와 실제 문서 대조를 구분하며 외부 release/ACK 완료다.
- 이번 제품 수리 정산: Jupiter `task_32a952df2238`/`ctx_ad1ad80c47e5`는 메모리108/0·격리 PG RED105/13→GREEN118/0·실서버PG smoke17/0·npm test exit0, Mars `task_6978dc9b8520`/`ctx_7ad7b97efc21`는 클라이언트202/0·typecheck0로 완료했다. 001/002/003 불변,004는 이메일 고유 인덱스만 제거한다. Venus `task_f76c52a56116`/`ctx_398f1f91d2e9`는 GDD-13/23/24 현행/이력을 치환했고 실제 사람 Editor·Project·2026-09-27 날짜를 원문 대조했다. 각 완료 때 현재 JSONL/Opus5.5/high·정상 화면/bypass·PID27284/42896/44532를 확인했고 adopted requested/effective는 null이다. 외부 터미널 release는 retained/external/processAction none이며 실제 종료를 뜻하지 않는다.
- Saturn `task_0c005a643465`/`ctx_09597f89fecc` 최종 worker_done succeeded **14:20:38 KST LOCAL PASS**, 파일 수정0. 명시 Sol/xhigh/default/full access/never PID25180·현재 JSONL/정상 footer/turn_started/preamble/capability를 GO와 완료 때 확인했다. 독립 제품 검사108/0·202/0·typecheck0, 제품12경로 SHA/HEAD/status 불변. Jupiter `task_edd4a177ee8b`/`ctx_46b87f15e92b`와 후속 `task_89f402545ed9`/`ctx_7e886adb01a4`의 환경 정리·설정 오류 비밀 출력 보완을 각각 닫았으며 제품 재검사는 반복하지 않았다. 이전09:03 PASS를 새 변경에 소급하지 않는다.
- 실제 운영: 후속 현재 Opus5.5/high/bypass/정상 입력창·turn_started/preamble/capability를 새로 확인하고, 최종 helper freeze→Saturn PASS→14:21 운영 GO 순서로 실행했다. 새 `backup/pgdata-cold-pre-004-20260927-142128`은 사용자 전용 ACL·1300/1300파일·66,821,647B·전건 SHA 차이0·manifest `29A2970EEC680BA6`이며 이전 백업도 보존했다. 적용 전 실측 accounts4/sessions2/db_meta3/password_resets0,001~003 체크섬일치. 004 한 번 적용 후 모든 표의 모든 열 다이제스트/행 수 동일·001~004 체크섬일치·이메일 인덱스제거. 옛 PID 파일은 직접 삭제하지 않고 PG 자동 복구를 기다렸다. 서버의 account.js33002B·SHA `4ad01949490ff3e4`는 checkout과 일치한다. worker_done14:23:30 뒤 현재 모델/PID/footer 재대조·외부 release·Delivery ACK 완료, 활성 Task0/owned 자원0이다. 제품/테스트/마이그레이션 추가수정·CJ계정 생성/로그인/암호 변경·실메일발송 없음.
- GitHub #259는 기존4개 완료 조건의 상태만 치환했고 OPEN·댓글0이다. 로컬PASS와 남은 실제수신/CJ가입·재설정/HTTPS/최신타이머/PR·CI를 구분했으며 추가TODO·진행댓글을 만들지 않았다.
- PD 분석: 이메일 중복 허용은 ID를 고유 키로 유지하면 가능하다. 현재 이메일 단독 조회는 중복 허용과 충돌하므로 **ID+등록 이메일 요청/확인, 계정별 코드·허가**로 함께 바꾼다. 이는 CJ가 명시한 UI 결정이 아닌 필요한 구현 방식이다. ID는 계정 식별값이며 메일함 접근권이 재설정 권한이다. 같은 메일함을 공유하는 사람은 각 ID의 비밀번호를 재설정할 수 있다는 한계가 있다. 존재 여부를 드러내지 않는 응답·계정에 결합된 만료/1회 토큰은 [OWASP 공식 기준](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)을 참고했다. 다른 게임 모두가 동일 정책이라는 일반화는 하지 않는다.
- 이전 제공자 미정 안내는 이력이다. CJ가 로컬 QA용 Gmail 앱 비밀번호를 마련하고 가림 입력을 마쳐 설정·연결/인증까지 확인했다. 실제 수신과 배포 발송 경로는 남아 있다. [Render Free](https://render.com/docs/free)는 SMTP 주요 포트25/465/587 외부 송신을 차단하므로 로컬 SMTP PASS를 Render 전달 가능으로 계산하지 않는다. 임의 서비스 가입·Render 자원 생성·결제는 없다.
- Claude는 CJ 결정대로 같은 Opus 5.5/high·full access에서 23:00 이후 실제 재개했다. Mercury가 조정을 이어받아 중복 coordinator를 만들던 23:10 1회 자동화는 비활성화했다.
- 이메일 중복 허용 전 단계 구현 근거(이력): [Jupiter](../Jupiter/report.md) 11.5 메모리100/0·격리PG109/0, [Mars](../Mars/report.md) 4.0a 클라이언트189/0·주기 대조 보완 전 통합18/0. A/B 대전·60초 재개·새 로그인에 의한 기존 접속 종료·공유 프로필 전환 경합의 당시 증거이며 최신108/118/202 판정과 구분한다.
- Venus 새 정책/GDD 진행 문구 정리 `ctx_b2d51c5b03de`·`ctx_832339f9a8e0`·`ctx_382c8b22a8d3` 완료. GDD-13/23/24 원문에서 2026-09-27 정책·완료 조건 안내·기존 사람 Editor 보존을 재확인했다. Saturn `ctx_845a6cf48f36` REVISE 후 수리 재검수 `task_8a685314f188` / `ctx_35b90eb5993b`는 09:03:40 KST LOCAL PASS다. 현재 JSONL·footer·PID41100의 Sol/xhigh/default/full access/never를 GO 직전·완료 시 대조했다(adopted requested/effective null).

## 첫 정책 전환 피드백·수리 이력 — 2026-09-27

- CJ 판정: 입력 검증·로그인 유지·가입/옛 복구 코드 PASS. 대전/로그아웃·재접속 REVISE. 비밀번호 재설정은 동작했으나 직전 비밀번호 재사용 거부와 복구 방식 변경이 필요하다.
- CJ가 테스트 환경을 **Orca 탭 두 개**로 확인했다. 같은 프로필의 탭은 로그인 쿠키와 저장소를 공유한다. 수정 전 실제 코드의 통제 재현에서 두 번째 로그인은 쿠키를 바꾸고 공용 좌석 키를 삭제·교체하지만 첫 탭의 AUTH/WS는 남았다. 첫 탭 재접속은 다른 계정 쿠키 때문에 거절되고, 새로고침하면 두 번째 계정의 좌석을 이어받았다. 이는 캐시·같은 PC 자체 문제라는 추정과 구분한다. CJ의 당시 탭은 닫혀 프로필 동일 여부를 직접 확인하지 못했다. 서로 다른 프로필의 A/B 대전·60초 재접속은 수정 전에도 정상이고 수정 후 실클라이언트 통합에서도 통과했다.
- 새 CJ 정책: 최신 로그인 하나만 유효(기존 접속 종료·자동 로그아웃), 30일 절대 만료 유지. 가입 이메일 필수, 등록 이메일 6자리 코드 확인 뒤 새 비밀번호 입력, 직전 비밀번호와 같으면 **직전 비밀번호와 같습니다**로 거부. 가입 복구 코드·재발급·365일 정책은 철회됐다.
- 이메일 발송 설정이 없다고 CJ가 확인했다. SMTP 연결과 주입형 테스트는 구현하되 실제 받은편지함 QA는 설정 전 완료로 표시하지 않는다. OTP 10분·재전송 60초·실패 5회와 재설정 후 일반 로그인은 PD 기술 기본값이며 CJ의 게임 규칙 결정으로 소급하지 않는다.
- Jupiter `task_6d0a1d96270f` / `ctx_59a87090fdcb`: 서버·추가형 003·단일 로그인·이메일 API. Mars `task_239b6e46a79c` / `ctx_d8b103c24c2c`: 공유 프로필 계정 전환·좌석·화면·이메일 단계 및 격리 두 계정 대전/재접속. Venus `task_f349f2dd9d5f` / `ctx_b2d51c5b03de`: GDD 본문·Decision Log 치환. 모두 현재 Opus 5.5/high·full access·현재 preamble/capability·turn_started 확인 후 GO, adopted requested/effective는 null이다.
- 최초 fresh Jupiter `ctx_55dbd5977d4a`는 시작 영수증 `turn_start_unobserved`, 정상 입력창은 비어 있었고 provider transcript가 없었다. 제품 작업 전 조사 후 그 정확한 감독 터미널을 stopped/closed로 정리했다. release는 실제 released(archive unavailable)다. 준비 완료를 확인한 별도 fresh 터미널에서 같은 Task의 retry dispatch를 시작해 `turn_started`를 관측했다. 최초 시도를 정상 수행으로 소급하지 않는다.
- 기존 CJ DB·계정은 보존한다. 수정 중 QA 게임 서버만 중지하고 로컬 백업 후, 이미 적용된 002는 수정하지 않고 003으로 확장한다. Saturn 독립 QA 뒤 재기동한다. GitHub #259는 기존 4개 완료 조건을 새 범위에 맞춰 치환했으며 신규 댓글·별도 TODO는 없다.
- 08:17 KST 운영 확인 시 8081 서버와 55459 PG는 이미 미기동이었다. `pgdata-cold-pre-003-20260927-081718` 콜드 백업은 원본과 1,298파일·67,255,326바이트가 일치한다. 003은 CJ DB에 아직 적용하지 않았다. 07:01 주소 제공 기록을 현재 가동 증거로 재사용하지 않는다. 재기동 후 별도 확인한다.
- CJ 동시 두 계정 QA용 별도 Orca 프로필 `Digit-Duel QA A`(69778830-a32f-4f3a-998f-773f25d10cd6)·`Digit-Duel QA B`(f72886c5-8206-4388-b138-ef32460cb17f)를 생성했다. 서로 다른 persist partition이며 전역 기본 프로필은 바꾸지 않았다. 서버 재기동 후 해당 프로필의 QA 탭을 제공한다.

### 새 정책 독립 QA 1 — 08:51 KST LOCAL REVISE

- Saturn `task_f937aa936e79` / `ctx_845a6cf48f36`의 정상 worker_done succeeded. 서버 97/0·클라이언트 176/0·typecheck·diff-check 각 exit0. HEAD와 제품 254파일 manifest SHA-256 `b108618bb246d1975b39c00099a2c05e05bc8b10c30569b91a4f63023a1489ba`는 전후 동일하고 파일 쓰기는 없다. 완료 직전 현재 Sol/xhigh turn_context·footer·PID41100 default/fullaccess/never 인수 대조, tier는 JSONL null이고 실제 명시 프로세스 인수로 증명했다.
- MEDIUM 1: 003이 기존 세션 전부에 login_gen=0을 줘 다음 로그인 전까지 다중 세션이 유효하다. 002의 실제 다중 세션 허용과 accounts.js의 세대 비교를 독립 대조했다. 기존 행·자격은 유지하고 최신 유효 세션 하나만 인정하도록 Jupiter `task_02c9762a81eb` / `ctx_75492d244be9`에 수리 배정.
- MEDIUM 2: Nodemailer가 SMTP URL query를 options 위에 병합해 requireTLS=true를 덮어쓴다. 읽기 전용 실제 라이브러리 probe에서 requireTLS=false·ignoreTLS=true를 관측했다. URL을 명시 안전 옵션으로 변환하고 query 설정은 거부하는 최소 수리를 같은 Jupiter Task에 배정.
- 추가 정적 확인: 게임 WS 없는 로그인 화면/메뉴/PVE는 다음 세션 요청 전까지 시각적 로그아웃이 지연된다. CJ의 자동 로그아웃을 충족하도록 Mars `task_20fdde8522de` / `ctx_ad9d49031dea`에 foreground 최대5초·focus/visibility 확인을 배정했다. 이는 PD 기술 기본값이며 게임 타이머를 추가하지 않는다. 이미 인증된 열린 게임 WS는 서버 종료 통지를 사용하고 중복 polling하지 않는다.
- 수리 뒤 관련 범위만 Saturn 재검수한다. CJ DB에 003 적용과 공유 QA 서버 재기동은 그 뒤다. 실제 받은편지함·HTTPS·최종 milestone 통합은 PASS가 아니다. Saturn release는 retained/external_terminal/processAction=none이다.
- 보완 완료: Jupiter `ctx_75492d244be9`의 새 가드 RED 메모리99/1·PG106/3 → GREEN100/0·109/0, 002 SHA-256 불변·계정/세션 행 보존. Mars `ctx_ad9d49031dea`의 새 유휴 대조 회귀는 옛 사본184/5 → 보완189/0·typecheck0이다. 첫 보완 검사187/2는 로그아웃 뒤 설계된 추가 프로필 대조 1회를 기대값에 세지 않은 테스트 오류로 진단해 수정했다. Saturn `task_8a685314f188` / `ctx_35b90eb5993b`가 관련 수리만 재검수 중이다. Venus `ctx_382c8b22a8d3`는 추가 현행 구현 대기 문구를 메일 미설정·GitHub 기존 완료 조건 안내로 치환했고 원문 재확인했다.
- PD 명세 필드 표기 오류: 일부 명세에서 area를 Design/Client/Server, mutation을 write로 쓰고 운영 준비 명세에 mode=OPERATE·mutation=ops를 썼다. 실제 수행 범위는 Venus 기획 문서·Mars 클라이언트·Jupiter 서버·Saturn 무수정 QA로 유지했지만 필드 검증을 정상 통과했다고 소급하지 않는다. 진행 중 운영 `ctx_5c5b353e32c6`는 GO 전에 `mode=IMPLEMENT; area=SERVER; mutation=code; instance_index=null`로 정정 메시지를 보내 명확히 했다. 기존 CLAUDE의 enum 표를 그대로 쓰며 새 운영 mode를 만들지 않는다. 제품 수정·검증의 모델 증거 및 실제 역할 범위는 별도로 보존한다.

### 새 정책 독립 QA 2 — 09:03:40 KST LOCAL PASS

- Saturn `task_8a685314f188` / `ctx_35b90eb5993b`, worker_done succeeded·파일 수정 0. 서버100/0·클라이언트189/0·typecheck·diff-check 각1회 exit0. 새 SQL·fixture·실제 Nodemailer 최종 옵션·유휴 대조 W1~W11의 의미를 독립 대조했다. PG109/0·실클라이언트 A/B18/0은 앞 단계 구현 증거를 재사용했고 재실행하지 않았다.
- QA 전후 HEAD fafc619와 제품254파일 manifest SHA-256 `0ac7b55272014ceed246509f596faf84eaf6f21b9c17ab578c319ea270b4c82e` 동일. 002 SHA-256 `ad46699758242b054a7b687e27557eb9c732319d468c44f2ebaa519f8e45775e` 불변. 현재 Sol/xhigh turn_context·footer·PID41100 default/fullaccess/never 대조, tier JSONL null·프로세스 명시 인수 증거. release는 retained/external_terminal/processAction=none이다.
- 이 판정은 로컬 코드 범위다. 실제 받은편지함·HTTPS·CI·최신 milestone 통합·CJ 새 정책 재검수를 PASS로 표시하지 않는다. 정산 수신 뒤 Jupiter `task_75581302c33c` / `ctx_5c5b353e32c6`에 실제 CJ DB 보존·003 적용·독립 Orca 서비스 PTY 재기동 GO를 보냈다. PG와 Node 모두 해당 독립 셸에서 시작하며 기존 중단 원인은 미확정이다.

### CJ 서비스 재개 — 09:08 이후 확인

- Jupiter `task_75581302c33c` / `ctx_5c5b353e32c6` worker_done succeeded. GO 전 canonical Jupiter/IMPLEMENT/SERVER/code/null 정정 확인. 기존 정지 pgdata와 콜드 백업의 파일별 SHA-256 1,298/1,298·차이0 확인 뒤 PostgreSQL 자체 복구로 기동했다. 이전 잠금 PID 파일을 수동 삭제하지 않았다.
- 003을 한 번 적용했고 계정2행·세션1행·db_meta3행의 원래 모든 열 다이제스트가 전후 동일했다. 001/002/003 체크섬 검증·최신 유효 세션≤1 확인. 기존 CJ 비밀번호를 쓰거나 계정을 재설정·삭제하지 않았다. 제품255경로/HEAD는 운영 전후 동일했고 변경물은 저장소 밖 시작 스크립트·일회성 운영 도구와 Jupiter 운영 문서뿐이다. 단일 [운영 보고](../Jupiter/local-qa-service.md)가 시작/중지 안내의 원본이다.
- 독립 Orca `DD-259-QA-SERVICE` 터미널 `term_766067c3-100a-4a1d-95c4-2e9a955fd280`에서 PG와 Node를 모두 시작했다. 작업 Worker와 별개이며 서비스 셸을 유지한다. Worker release는 retained/external/processAction=none, 실제 종료로 기록하지 않는다. 정산·release 뒤 Mercury가 루프백8081/55459 리슨, 페이지/healthz/readyz200·미로그인세션401, 서빙 account.js와 현재 소스 바이트 해시 일치를 독립 확인했다.
- **현재 주소: http://127.0.0.1:8081/** (이 PC 전용 #259 QA). `issue-259-accounts`의 탭0은 **Digit-Duel QA A** / page `d5fbc7be-c4d6-489e-8be2-2d537e7cf982`, 탭1은 **Digit-Duel QA B** / page `603ec1f4-b1c8-44f6-96fc-ed49b515218c`이다. CLI 프로필 메타데이터에서 서로 다른 profileId를 확인했고 탭 loadError는 null이다. 현재 새 탭의 시각/입력 QA는 CJ 대상이며 브라우저 플레이 PASS로 소급하지 않는다.
- CJ 재검수: A/B에 서로 다른 계정으로 로그인해 **새 방** 대전·양쪽 60초 내 새로고침 재접속을 확인한다. 같은 계정을 A/B에 로그인하면 먼저 접속은 자동 종료되며 게임 WS 없는 열린 화면은 최대 약5초 또는 화면 복귀 때 로그아웃한다. 같은 프로필의 일반 탭2개는 두 계정 동시 대전용으로 쓰지 않는다. 서버 재기동 전의 방/좌석 재개는 이번 QA 대상이 아니다.
- 이메일 발송 설정이 없어 재설정 요청503 E_MAIL_UNAVAILABLE은 정상 제한이다. 실제6자리 메일 수신과 화면의 코드입력→직전비밀번호 거부→새비밀번호 완료 CJ QA는 발송 설정 후 진행한다. 코드의 자동/주입 검사를 실제받은편지함 PASS로 계산하지 않는다. HTTPS/Render·최신#263 타이머/마일스톤 통합·CI·CJ새정책 판정은 대기다.
- GitHub #259 기존4완료조건 안에 로컬 PASS와 남은 게이트만 짧게 표시했다. 체크리스트1개·신규Issue댓글0, stage/commit/PR/close/배포/Render 자원·결제0. 최종 reclaimable Worker0이며 QA 서비스 터미널은 CJ 테스트를 위해 유지한다.

## CJ 로컬 QA 주소 — 2026-09-27 07:01 KST 제공 이력

- **http://127.0.0.1:8081/**, 이 PC 전용 #259 계정 기능 QA. 현재 `fafc619` + 미커밋 #259를 그대로 서빙하며 최신 #263 타이머·최종 HTTPS/Render 통합 판정에는 사용하지 않는다.
- Jupiter `task_d0cd810fb75c` / `ctx_4cb8a50ca037`가 전용 PostgreSQL 18.4를 `C:/Users/pc_77/orca/qa/Digit-Duel/issue-259-local/pgdata`에 만들고 로컬 001/002를 적용했다. 서버·DB는 숨김 사용자 프로세스로 실행 중이며 세부 시작/중지·비밀 값 없는 재시작 안내는 [운영 보고](../Jupiter/local-qa-service.md) 하나로 관리한다. 계정 데이터는 재시작 뒤 보존되며 PC 재부팅·로그오프 시 서비스는 멈춘다.
- Mercury 독립 HTTP 확인: 페이지·account.js 200, healthz 200 `ok`, readyz 200 `ok (db)`, 미로그인 세션 401 `E_NO_SESSION`. Jupiter는 실제 DB 가입·세션·로그아웃·재로그인 프로브를 통과하고 일회용 프로브 계정만 제거했다. CJ 계정은 직접 가입한다.
- Orca QA 탭 `d74cfd8b-553f-4945-97fc-72ee436dd484`는 생성됐지만 snapshot은 `runtime_unavailable`로 실패했다. 브라우저 플레이 PASS는 주장하지 않는다.
- 현재 turn JSONL의 Opus 5.5/high를 GO 직전과 완료 시각에 직접 대조했고 full access·정상 입력창·turn_started·현재 preamble/capability를 확인했다. adopted requested/effective는 null이다. `worker_done` succeeded 1회, ACK 완료. release 응답은 `retained/external_terminal/processAction=none`이며 실제 종료로 기록하지 않는다. QA 서비스는 계속 실행한다.
- HEAD와 제품/테스트/CI 24경로 SHA-256은 준비 전후 동일하다. 완료 payload의 Windows `filesModified` 일부는 Git Bash 경로 변환으로 잘못 표기됐다. 실제 확인한 스크래치 파일은 `C:/Users/pc_77/orca/qa/Digit-Duel/issue-259-local/{start.ps1,stop.ps1,secrets/local.json}`이며 제품 파일 변경은 없다. 비밀 값은 원장에 기록하지 않는다. 신규 GitHub 댓글·stage·commit·PR·배포·Render 자원 변경 없음.

## 독립 QA 1 — REVISE, 정상 완료 보고

- Saturn Task `task_0914f0c93ef4` / Dispatch `ctx_bc57846fd734`, 23:24 KST `worker_done`, audit outcome=succeeded · 제품 판정=REVISE. 보고 파일·수정 파일 없음.
- 실행 명령: `codex --model gpt-6-sol -c model_reasoning_effort=xhigh -c service_tier=default -s danger-full-access -a never`. TUI `GPT-6-Sol xhigh`, `/status` Full Access 직접 확인. adopted launch requested/effective는 null이며 관측값으로 꾸미지 않는다.
- 최초 시작 영수증은 `outcome_unknown/turn_start_unobserved`였다. 재시작하지 않고 실제 화면·정확한 provider transcript·현재 Task/Dispatch capability·preflight status를 조사한 뒤 Mercury GO를 보냈다. 정상 완료를 받았다고 초기 관측 누락을 소급 정상화하지 않는다.
- Mercury가 QA 전후 HEAD·dirty/untracked 29개 파일의 SHA-256·Git status가 동일함을 확인했다. 이 원장 파일은 그 확인 **뒤 Mercury가 작성**했다.

| 위험 | 근거 | 소관 |
|---|---|---|
| HIGH: 복구 성공 뒤 기존 비밀번호 로그인으로 유효 세션 발급 | `accounts.js` 189–202·144–151. addSession을 지연하고 복구 200 뒤 풀었을 때 기존 로그인 200·resolve 유효를 인라인 메모리로 재현 | Jupiter |
| HIGH: 로그아웃 뒤 늦은 세션 응답이 인증 상태·소켓을 복원 | `account.js` 86–94·243–263. anon/소켓 0 → 늦은 응답 뒤 in/소켓 1, 제품 하네스로 재현 | Mars |
| HIGH: 로그아웃/폐기 조회와 새 WS 등록의 경합 | `server.js` 273–276·292–296. 폐기 fan-out 이전 세션 조회가 뒤늦게 socket으로 등록될 수 있다는 **정적 발견**; Jupiter에 정확한 경합 재현·수리 배정 | Jupiter |
| MEDIUM: 일반 HTTPS non-JSON 404가 계정 없는 경로로 열림 | `account.js` 64, 기존 smoke A4도 PVE 허용을 확인. HTTP(S) 404를 미확인 상태로 차단하도록 배정 | Mars |

Saturn 실행: 서버 계정 108/0·클라이언트 114/0·root `npm.cmd run typecheck`·`git diff --check` 모두 exit 0. 신규 두 구현 보고서의 상대 링크 3개 확인. 실행 전 실패는 PowerShell npm.ps1 실행 정책, server cwd의 없는 typecheck script, 인라인 node 인수 quoting이며 각각 exit 1; 올바른 명령/위치/표준 입력으로 실행해 위 결과를 얻었다. 실패 실행을 PASS로 계산하지 않는다.

## 수리 완료

| 역할 | Task / Dispatch | 결과 |
|---|---|---|
| Jupiter | `task_d35c07119147` / `ctx_8ad5f386a952` | 23:36 완료. 로그인·코드 재발급의 credential generation 조건, pending WS 조회 수명의 폐기 기록. 수정 전 5FAIL → A/B만 2FAIL → 최종 메모리119/0·PG120/0 |
| Mars | `task_1571f0c18610` / `ctx_e39bf446f5aa` | 23:30 완료. 늦은 인증 응답의 신원 세대 대조·모든 HTTP(S)404 차단. 수정 전 6FAIL → 122/0 |
| Mars | `task_76591d6d4703` / `ctx_6b5e092c1820` | 23:45 완료. 지연 응답 뒤 현재 입장 게이트 재확인·좌석 재접속 내부 게이트. 픽스처 공유 변이/비동기 drain도 보정. 수정 전 K7 1FAIL → 125/0 |

Jupiter는 read-only 분석에서 기존 비밀번호로 복구 코드 재발급을 지연시킨 뒤 정상 복구를 완료해도 새 코드가 살아 재복구가 가능함을 추가 재현했다. 이는 Saturn 최초 네 항목의 별도 추가 근거이며 최초 QA에 소급 합치지 않는다. credential generation 기반 세션/재발급 원자성 보완과 pending WS 폐기 처리의 개발 선택을 승인했다. 5분 기록 삭제가 오래된 pending lookup을 놓치지 않도록 조건을 요구했다. 002는 실서비스에 배포되지 않았지만 로컬 scratch PG에는 이미 적용됐으므로 테스트용 재생성과 실제 사용자 DB를 구분한다.

## 후속 QA와 실행 모델 정정

| 단계 | 실제 실행 모델·정산 | 판정·증거 |
|---|---|---|
| QA 2 `task_f46dad0585d9` / `ctx_9ba0306aac92` | **Luna/medium**. 23:40 worker_done succeeded, 정상 메시지 정산 | 진단 REVISE: 기존 네 결함과 서버 재발급 형제 수리를 대조하고 메모리119/0·클라이언트122/0 확인. 같은 계정의 늦은 세션 응답이 복구 코드 확인 전 소켓을 열어 MEDIUM 추가 발견. 30파일 해시/status/HEAD 동일. 승인 모델의 정식 QA에서 제외 |
| QA 3 `task_88dc9abbb872` / `ctx_86942e191833` | **Luna/medium**. 23:51 worker_done succeeded | 진단 PASS: 클라이언트125/0·typecheck/diff exit0, 별도 지연 응답 사례 확인. 30파일 해시/status/HEAD 동일. 정식 Sol PASS로 소급하지 않음 |
| preflight만 `task_f2df96e20ab5` / `ctx_cb9eeacee16f` | Sol/xhigh requested/effective·현재 턴 일치. 23:58 worker_done **failed** | No Fast 적용의 직접 증거를 확정하지 못해 PD가 명시 tier 실행으로 교체. 제품 열람·테스트·파일 변경 0. 실제 Fast 실행을 확인했다는 뜻은 아님. owned terminal release는 실제 `released/closed_agent_terminal`, transcript captured |
| 최종 정식 QA `task_2b837cc4bcc5` / `ctx_57e27a16fe77` | **Sol/xhigh/default**, 2026-09-27 00:05:38 worker_done succeeded | **LOCAL PASS**. 아래 제한된 최종 검사와 현재 턴 증거로 승인. 30파일 해시/status/HEAD 동일 |

**모델 사고 [확정]**: 세션 `01a0de0e-255d-7681-9744-f8d091b4dc79`의 첫 `turn_context`(23:16)는 Sol/xhigh, 23:27:50 `thread_settings_applied` 및 23:27/23:42 후속 `turn_context`는 Luna/medium이다. 기존 TUI 기록에서 23:24 완료 뒤 “Approaching rate limits / Switch to gpt-6-luna” 팝업이 열려 있었고 후속 dispatch 입력 직후 Luna footer가 나타난다. **[추론]** dispatch의 키 입력이 팝업 선택에 쓰였다. PD는 입력창 상태를 확인하지 않았고 이전 preflight를 현재 관측처럼 재사용했다. 초기 명시 CLI와 첫 `/status`만으로 후속 턴을 Sol이라고 보고한 것은 잘못이다.

새 정식 QA는 `codex --model gpt-6-sol -c model_reasoning_effort=xhigh -c service_tier=default -s danger-full-access -a never`로 시작했다. Mercury와 Saturn이 현재 세션 `01a0de39-8865-7cf0-9298-05635c65212f`의 `turn_context`·살아 있는 footer·PID44376 명시 인수를 GO 직전과 완료 시 대조했다. `worker-start`의 `turnStart=observed`·prompt `turn_started`·현재 preamble/capability를 확인했다. adopted requested/effective는 null이다. 완료 후 같은 한도 팝업이 다시 떠 `Keep current model`(2)을 선택했고 Sol xhigh footer를 재확인했다. 전역 설정·알림 숨김·Fast 토글은 하지 않았다.

| 최종 Saturn 검사 — 각 1회 | 결과 |
|---|---|
| server cwd `node authoritative/test/test-issue259-accounts.js` | 119 passed / 0 failed, exit0 |
| root `node demo/test/regression/smoke_issue259.js` | 125 PASS / 0 FAIL, exit0 |
| root `npm.cmd run typecheck` | exit0 |
| `git diff --check` | exit0, 기존 LF→CRLF 안내뿐 |
| 제품 하네스의 별도 인라인 재현, 파일 쓰기 없음 | 같은 계정 코드 재발급 중 늦은 GET/session 200 뒤에도 코드 게이트 유지·소켓0. 코드 저장 확인 후 새로 입장한 경우 cp 소켓1. exit0 |

서버 세대 비교·조건부 로그인/재발급 SQL, pending WS 폐기, 클라이언트 세대·404 차단·현재 게이트·좌석 재접속 게이트와 K6~K8을 독립 대조했다. 로컬 PG·광범위 서버·라이브 소켓·브라우저 검사를 반복하지 않았다. 서버 경로 13개 해시는 수리 후 QA2 시점부터 동일했다. Mercury의 마지막 30파일 무변경 확인 **뒤** 운영 문서/JSON을 보정했으며 제품 파일은 변경하지 않았다.

## 기록·권한

- GitHub [#259](https://github.com/ChangjoSung/Digit-Duel/issues/259)의 기존 로컬 계정 검증 조건을 완료로 체크했고 중복 하위 진행 체크를 제거했다(4조건 중1완료, OPEN). 실제 HTTPS·2클라이언트 최종 통합·PR/CI/CJ 조건은 미완료다. #264 중복 하위 체크도 제거했고 #263은 완료 조건의 운영 세부 문구만 줄였다. #232/#259/#263/#264 모두 별도 현황 TODO·GDD 절 번호·중복 하위 체크가 없음을 재조회했다. 신규 Issue댓글0, #263의 기존3댓글은 보존했다. #263은 현행 CLOSED이며 닫힘 이벤트는 2026-09-26 01:14 KST·ChangjoSung·commit_id 없음이다. 이번 조정에서 Issue close 명령은 실행하지 않았다.
- Mercury 제품 코드 변경 0. #259 stage·commit·PR·Issue close·배포·Render 자원 생성·결제 0. dirty/untracked 사용자 파일은 보존한다.
- 초기 구현 완료 Worker의 release 요청은 Orca가 `retained/external_terminal/processAction=none`으로 응답했다. 실제 종료·released로 주장하지 않는다. 같은 좁은 수리·재검사 범위의 proven terminal만 재사용했다.
- 재발 방지 절차를 root와 활성 #259/#264의 CLAUDE·WORKER_MODELS·QA_MINIMUM_POLICY·worker-models.json에 반영했다. 세 작업공간의7개 역할/작업 유형 모델·effort·tier가 동일하며 JSON 파싱과 diff 검사가 모두 exit0임을 확인했다. 입력 전 모델 전환 팝업, 현재 턴·GO·완료 관측을 필수로 하며 이전 preflight를 재사용하지 않는다. 이것은 운영 절차 보강이며 자동 차단 코드를 구현했다는 뜻이 아니다. 운영 문서 보정 뒤에도 제품/테스트/CI 경로24개 해시가 QA 시작과 동일했다. 현재 Run의 활성 dispatch0·요구 nextAction0, #259 Orca 상태는 in-review다.
