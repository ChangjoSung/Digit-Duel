# 서버 폴더 정리·LAN HTTPS 단일 실행기 — Mercury, 2026-09-28

## 현재 판정

**CJ 최종 QA·수정본 로컬 QA·독립 검토 PASS.** CJ가 2026-09-28 병합을 승인했다. 통합 기준 `264010da5d47e40c75c2458772c166b5ed3276da`에서 `infra/276-lan-launcher` PR을 정리하고 현재 HEAD의 필수 CI 6개 확인 후 `milestone/v0.4.11`에 squash 병합한다. GitHub [#276](https://github.com/ChangjoSung/Digit-Duel/issues/276)의 기존 완료 조건 한곳을 갱신한다.

CJ가 확인한 차단 원인은 LAN HTTP 안내와 현행 원격 인증 HTTPS 규칙의 충돌이었다. 최초 QA는 루프백 API와 익명 세션401만 확인해 실제 LAN 로그인 성공을 검증하지 못했다. 그 PASS는 초기 정리 범위의 이력으로 보존한다. 현재는 원격 인증 보호 규칙을 유지하고 native HTTPS·전용 서버 인증서를 적용해 실제 안내 주소의 로그인과 인증된 WSS를 검증했다.

## 실행·종료

[server/LAN모드실행.bat](../../../../../../server/LAN모드실행.bat)을 더블클릭한 뒤 실행기가 표시한 **HTTPS** 주소로 접속한다.

- 실제 파일: `C:/Users/pc_77/orca/workspaces/Digit-Duel/release-review-v0.4.11/server/LAN모드실행.bat`
- 같은 PC: `https://localhost:8085/`
- 현재 내부망: `https://192.168.3.30:8085/`
- **Ctrl+C**로 게임 서버를 종료한다. 기존 PostgreSQL은 `127.0.0.1:55462`에 유지되어 재실행 때 재사용된다.
- DB까지 종료할 때는 이 작업 트리 루트에서 `node tools/qa/issue260_local.js stop --issue262`를 실행한다.

기존 비공개 QA DB·SMTP 설정을 재사용하며 준비된 설정이 없으면 중단한다. QA 종료 후 게임8085는 닫았고, 시작 전부터 실행 중이던 PG29932와 다른 앱8084/PID4956은 보존했다.

## 변경

| 대상 | 처리 |
| --- | --- |
| 폴더·실행기 | 기존 BAT4개를 단일 BAT로 교체. 루트 회귀5개를 `server/test/`로 이동 |
| 구 릴레이·미사용 검사 | 사용하는 릴레이만 테스트 fixture로 보존. 미사용 test-client·중복 검사·현행 SQL을 다루지 않는 수동 DROP TABLE smoke 정리 |
| 참조 | package·CI·README·CONTRIBUTING·CDP13개 경로 정정. Render의 기존 `npm start --prefix server` 진입점 유지 |
| 서버 HTTPS | 절대 경로 PEM 인증서·키 쌍으로 동일 포트·핸들러·WebSocket을 HTTPS/WSS(TLS1.2+)로 운영. 잘못된 TLS 설정은 오류 코드로 기동 중단 |
| 단일 BAT | 기존 helper가 전용 CA:false 서버 leaf·localhost/루프백/현재 사설 IPv4 SAN을 준비하고 CurrentUser Root에 그 leaf만 등록. 90일 발급·만료14일 전 재발급, 일치하는 기존 인증서·키 재사용 |
| 주소 안내 | native TLS 서버 로그의 가상·링크 로컬 주소 열거를 제거. 실행기가 인증서에 담긴 접속 주소를 안내 |
| 재발 방지 | [QA 원칙](../../../../../creat2ve/QA_MINIMUM_POLICY.md)에 실제 광고 주소의 로그인·쿠키·인증 WSS 대표 흐름을 완료 근거로 추가 |

인증서·키는 Git 밖의 `C:/Users/pc_77/orca/qa/Digit-Duel/issue-262-local/secrets/tls`에 있다. 현재 사용자 신뢰 항목은 서버 leaf `4E10A2D305BA6FBAB2C03E4F5174EC99C02A5DC1` 하나다. 다른 접속 기기에는 공개 인증서 `server.crt`의 신뢰 등록이 필요하다. 서버·폴더 역할과 환경 설정은 [server README](../../../../../../server/README.md)를 따른다.

## 검증 근거

| 검증 | 결과·범위 |
| --- | --- |
| TLS 도입 후 전체 서버 gate | Jupiter `npm test --prefix server` 1회, 30/30 suite PASS·exit0. launcher49/0·TLS12/0·HTTP-static24/0·accounts125/0 포함 |
| 주소 로그 정정 | 구문 검사 exit0. 첫 PowerShell 검사는 OpenSSL PATH 부재로 fixture에서 종료; Git Bash 재시도 TLS13/0·exit0. 인증·핸들러·바인딩·upgrade·loadTls·helper는 수정 범위 밖 |
| 실제 LAN HTTPS 브라우저 | 격리 프로필에서 가입→로그아웃→로그인 성공. Secure·HttpOnly·SameSite=Strict 쿠키, 인증된 WSS `lobby_rooms`·onlineCount1 확인 |
| BAT 생명주기 | 실제 시작2/2. pinned TLS1.3 healthz·readyz·root200, 익명 session401. Ctrl+C 종료·두 번째 시작에서 동일 인증서/키/신뢰 항목·PG PID 재사용 |
| 데이터 보존 | 최종 로그아웃 후 새로 만든 QA 계정1개와 그 세션만 정확히 정리. 기존 계정16·세션16·전적10·복구 요청0의 전체 행 digest가 baseline과 동일. 설정·SMTP·outbox 해시 동일 |
| 독립 검토 | Saturn 두 차례의 범위별 PASS. 최종 검토는 최신 logger와 child assertion만 대조하고 통과한 기능·브라우저·검사를 재사용. 제품/검사/문서 파일 수정0, HEAD/status·두 코드 해시 동일 |
| 문서·정리 | 최종 문서341개/내부 링크1445개/문제0·exit0. 새 보고서의 로컬 링크4개도 별도 확인. 최종 git diff --check exit0 |

정리 전 서버 ZIP60파일의 SHA256 전건 대조는 불일치0이다. ZIP SHA256: `E147149900B0A9FA683DDBAE457022558DAD3A621D605AC17E08E7EC696F3181`. 기존 SQL5개와 package-lock을 보존했다. 원본 checkout의 HEAD33490f9와 dirty/untracked 상태를 유지한다.

## 한계·인수 상태

- 다른 물리 LAN 기기·방화벽 통과와 GUI 창 X 종료는 미검증이다. Ctrl+C 종료는 검증했다.
- 이 정리 QA는 실제 메일 발송·비밀번호 재설정을 반복하지 않았다. 로컬 SMTP 설정을 보존했으며 운영 Render 설정은 [#232 보고](../../232/Mercury/integration-review.md)의 별도 준비 상태를 따른다.
- CJ가 #276의 stage·commit·push·PR·milestone 병합을 승인했다. 병합 결과는 PD 인수인계에 기록한다. main Release·Render 배포·자원 생성·결제·요금제 변경은 이번 승인 범위 밖이며 CJ의 유료 전환 통지와 별도 지시를 기다린다. Issue는 기존 완료 조건만 관리하고 수동 close하지 않는다.

## 운영·증거

Run `run_016f80765b2b`의 실제 완료 영수증, 모델 확인, 정리 증거와 초기 보고 원문은 `C:/Users/pc_77/orca/archives/Digit-Duel/server-cleanup-2026-09-28`에 보관한다. 실제 브라우저 증거는 `issue-262-local/logs/qa276-lan-https-login.png`와 `qa276-lan-https-authenticated.png`이다.

Mars/Jupiter는 Opus5.5/high/No Fast/bypass, Saturn은 Sol6/xhigh/default/full/never를 현재 argv·화면·JSONL·preamble/capability와 대조했다. adopted requested/effective=null과 JSONL의 미기록 필드를 그대로 보존한다. accepted worker_done 뒤 외부 터미널의 retained/external_terminal을 별도 실제 terminal close로 정리했다.

브라우저 입력 도구의 TUI draft 혼입은 사용 전 QA 비밀번호를 교체하고 정확한 페이지 DOM 입력으로 복구했다. 마지막 검토의 최초 start_unknown은 대기 중인 paste를 확인해 Enter1회로 제출한 뒤 native task_started(10:28:13.922Z)·preamble·capability를 재확인했다. 앞선 실패 영수증을 정상 시작으로 소급하지 않는다. 초기 Mars capability 부재 중단 이력도 보관한다.

실제 HTTPS QA의 완료 전 checkpoint: 입력11,317,276(캐시11,149,312 포함)·출력36,991(추론16,815 포함). 마지막 좁은 검토의 Phase A 첫 checkpoint→10:34:44Z 차이: 입력1,463,391(캐시1,420,544 포함)·출력7,715(추론2,626 포함). PD 및 일부 구현 단계의 독립 사용량 차분은 미측정이며 절감률·청구 수치를 산정하지 않는다.
