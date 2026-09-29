# Digit-Duel — Mercury_PD 인수인계

## 2026-09-29 23:36 KST 현행 인계 확인 · v0.4.13 최종 출시 때 main 병합 예정

- OpenAI [모델 목록](https://developers.openai.com/api/docs/models)과 [변경 이력](https://developers.openai.com/api/docs/changelog)을 먼저 재확인했다. 최신 일반 GPT 계열은 GPT-6, 9월 25일 Sol/Luna 이미지 수정이 최신 항목이다. 현 Mercury 프로세스는 `gpt-6-sol`·`xhigh`·`service_tier=default`·`danger-full-access`·approval `never`로 실제 실행 중이며, Worker 계약과 일치한다.
- `git fetch origin main` 뒤 원본 PD WorkTree는 `main` → `origin/main`, HEAD와 원격 모두 `9b306bbfda103263cb2feea90fd9c89527eb9290`이다. 원본에는 미추적 `unity/`만 있으며 보존한다. stash `9ebd041242f61e10906ae388e8037c03c33ad386`와 `cc644636b67788727963b2158001bc66cb40fe86`도 보존한다.
- CJ 최신 Comment, `CLAUDE.md`, `AUTHORITY.md`, `WORKER_MODELS.md`, `worker-models.json`, `QA_MINIMUM_POLICY.md`, Notion GDD-13·23·24, GitHub #295·PR #303·Release를 재조회했다. 이 문서의 아래 18:41 체크포인트는 과거 기록이며, 이후 CJ의 #292 및 #295 착수 지시가 우선한다. #293·#294·#296·#297은 별도 착수 전 접수 상태다.
- Codex MCP의 Notion GDD fetch와 Render workspace 조회가 실제 성공했다. Claude MCP의 로컬 Notion은 연결됨을 확인하고 GDD-23 fetch를 실제 호출했다. Claude Google Drive·Calendar·Gmail 및 Slack은 인증되지 않았고 연결하지 않는다. 회사 계정의 Claude·Notion 로컬 연동 정책을 유지한다. Unity MCP는 v0.6.0 개발 때 추적하며 이번 v0.4.13에서는 호출하거나 새 연동하지 않는다. 현재 Codex·Claude 설정에 남은 Unity 항목은 이전 설정이며 이번 인계의 필수 호출 대상이 아니다.
- #295 활성 WorkTree는 `origin/milestone/v0.4.13`의 `c25252e521668fb64dfe3bed920684cb661bcc72`에서 생성됐고, ID는 `003dc8a0-372c-4547-9290-31d34edd82be::C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-295-lobby-disconnect`다. HEAD `f762ae8a4b77966ffe1b08361543c7c92197ac04`, [PR #303](https://github.com/ChangjoSung/Digit-Duel/pull/303) 필수 CI 6/6 PASS, beta Render는 이 SHA로 Live다. CJ 2계정 Play QA는 대기 중이며, PASS 전 병합·Release·Production 갱신을 하지 않는다.
- CJ의 2026-09-29 지시: 인수인계의 Google 금지·Notion 로컬 회사 계정 유지·Unity v0.6.0 연기 결정은 기록하되, 이 문서 브랜치의 main 병합은 v0.4.13 최종 Release와 Render Web 갱신 때 함께 진행한다. 기존 아래 항목 중 이 결정과 충돌하는 연결·Issue 상태는 과거 이력으로 취급한다.

## 현재 체크포인트 — 2026-09-29 18:41 KST PD 교대 준비

- **모델 첫 확인:** [OpenAI 모델 목록](https://developers.openai.com/api/docs/models)과 [변경 이력](https://developers.openai.com/api/docs/changelog)을 재조회했다. 최신 일반 GPT 계열은 GPT-6이며, 9월 25일 Sol/Luna 수정 이후 더 새 계열 출시를 확인하지 못했다. 현 PD 화면은 `GPT-6-Sol xhigh`, 프로젝트 설정은 `gpt-6-sol`·`xhigh`·`service_tier=default`다. 수신 PD는 새 터미널의 실제 모델·effort·tier를 다시 확인한다.
- **PD 기준:** 인계 준비 시 `main` → `origin/main`, `HEAD`와 원격 SHA 모두 `56f1fa9ab4bb3ace8154dbce7d5305835511248a`였다. 이 체크포인트를 반영한 PR의 최종 병합 SHA는 수신 PD가 `git fetch origin main` 뒤 재기록한다. detached HEAD나 별도 WorkTree를 PD 위치로 쓰지 않는다.
- **읽은 기준:** CJ 최신 Comment, `CLAUDE.md`, `AUTHORITY.md`, 이 스냅샷, `WORKER_MODELS.md`, `worker-models.json`, `QA_MINIMUM_POLICY.md`, Notion GDD-13·23·24와 Creat2ve 구조 원본, GitHub 현행 Issue·PR·Release를 대조했다. 열린 PR은 없었다. `v0.4.12`가 최신 Release이고, v0.4.13의 #292~#297은 접수·범위 추적만 하는 Open 이슈다. **CJ 별도 착수 지시 전 분석·기획 확정·구현·QA·배포를 시작하지 않는다.** 아래 오래된 #276 등 체크포인트는 당시 이력이다.
- **권한·MCP:** 현 PD는 `danger-full-access`·approval `never`; 수신 PD도 이 값으로 명시 기동하고 실제 실행을 확인한다. Codex MCP 목록의 Notion·Render는 활성이고 Notion GDD fetch·Render workspace 조회가 성공했다. `node_repl`·Unity는 로컬 stdio로 활성이다. Claude MCP 건강 검사에서 Docs·Google Drive/Calendar/Gmail·Notion·Unity는 연결됨을 확인했다. **Slack은 CJ 지시로 연결하지 않는 제외 대상**이다. Claude·Notion은 기존 회사 계정·로컬 PC 정책을 유지한다.
- **작업·보존:** PD 원본 WorkTree 외에는 문서 PR용 임시 WorkTree만 있으며 병합 후 정리한다. 활성 Worker WorkTree·열린 PR은 없다. 원본의 `unity/` 미추적 파일(관측 최소 29,623개, 대부분 `Library` 캐시)은 Unity MCP 사용 중이라 보존한다. 기존 stash `9ebd041242f61e10906ae388e8037c03c33ad386`, `cc644636b67788727963b2158001bc66cb40fe86`도 보존한다. `release-review-v0.4.11`의 빈 잔여 폴더 삭제는 자동 승인 검토에서 차단돼 남아 있다.
- **수신 조건:** 원격 병합 후 수신 PD가 최신 SHA·필수 파일·실제 권한·필수 MCP 호출을 재확인하고 CJ에게 결과를 보고해야 인수인계가 완료된다. 이 준비 기록만으로 완료 처리하지 않는다.

## 필수 인수 절차 — 2026-09-29 CJ Comment

매번 아래 순서를 새로 확인한다. 이전 세션의 확인 결과를 재사용하지 않는다.

1. **GPT 업데이트부터 확인:** OpenAI 공식 모델 목록·변경 이력과 현재 계정에서 사용 가능한 GPT를 대조하고, [Worker 모델 계약](WORKER_MODELS.md)의 Mercury 모델 및 실제 실행 모델/effort/tier를 확인한다. 더 최신인 사용 가능 모델이 있으면 인계 전 PD가 버전 전환을 지시하고 실제 적용을 확인한 다음 진행한다. 사용 가능 여부나 적용을 확인할 수 없으면 인수를 완료 처리하지 않는다.
2. **PD 위치 확인:** `git fetch origin main` 후 PD 작업 공간의 브랜치 `main`, upstream `origin/main`, `HEAD`와 `origin/main`의 동일 SHA를 확인한다. detached HEAD·다른 브랜치·뒤처진 main에서는 인계하지 않는다. 미커밋·미추적 파일을 먼저 식별·보존하고 안전하게 동기화한다.
3. **필수 자료 읽기:** CJ 최신 Comment, 이 저장소 `CLAUDE.md`, [권위 문서](AUTHORITY.md), 이 스냅샷의 현재 체크포인트, [Worker 모델·WorkTree 계약](WORKER_MODELS.md), [모델 실행값](worker-models.json), [QA 최소 원칙](QA_MINIMUM_POLICY.md), 현재 작업의 Notion GDD·GitHub Issue·PR을 읽고 상충하거나 낡은 이력을 구분한다.
4. **권한 확인:** 현재 PD의 실제 실행 권한이 `danger-full-access`·approval `never`인지 확인한다. 새 Worker는 역할별 승인 설정을 명시하고 시작 영수증과 실제 실행을 확인한다. 관리형 정책보다 높은 권한을 가정하지 않는다.
5. **MCP 목록·연결 확인:** Codex와 Claude의 MCP 목록을 조회하고 업무상 필수인 연결은 인증 상태뿐 아니라 최소 1개 실제 호출로 확인한다. 끊긴 필수 MCP는 기존 정책 범위에서 연동부터 복구한다. Claude와 Notion은 회사 계정의 기존 로컬 PC 연동을 유지한다. **Slack은 CJ 지시로 연결하지 않으며 필수 검사 대상이 아니다.** 연결 변경으로 작업물을 외부에 공유하지 않는다.
6. **CJ 인수 완료 보고:** 1~5가 모두 통과한 뒤에만 확인 시각, `main`/`origin/main` SHA, GPT 버전·실행값, 읽은 자료, 권한, 필수 MCP별 결과, 활성 Worker WorkTree의 원격 기준/SHA/ID, 보존한 로컬 변경, 남은 위험을 기록해 CJ에게 보낸다. 실패한 항목은 미완료와 원인을 명시한다.

**2026-09-29 18:03 KST 과거 위치 확인:** `main` → `origin/main`, 양쪽 SHA `d6925d49636f5ebcd68033e87ba01f0f471d4d6a`. 이전 문서 변경은 stash `cc644636b67788727963b2158001bc66cb40fe86`에 보존했다. `unity/` 미추적 파일은 남아 있었고 이 스냅샷 수정은 당시 미커밋이었다. 아래의 다른 브랜치 인계 지시는 당시 이력이다.

## 이전 체크포인트 — 2026-09-28 #276 CJ QA PASS·병합 승인

- 현행 원장은 [#276 Mercury 보고](../milestone/v0.4.11/issues/276/Mercury/report.md)다. 최초 HTTP 안내와 루프백 전용 QA의 누락을 수정해 실제 LAN HTTPS 가입·로그인·보안 쿠키·인증 WSS, BAT2/2·인증서/키/신뢰·PG 재사용을 검증했다. 마지막 가상 주소 로그 수정도 독립 검토 PASS다. 기존 GitHub 완료 조건 한곳만 갱신하며 댓글·중복 TODO·Issue close를 만들지 않는다.
- 실제 파일은 C:/Users/pc_77/orca/workspaces/Digit-Duel/release-review-v0.4.11/server/LAN모드실행.bat, 현재 접속 주소는 https://192.168.3.30:8085/. CJ가 stage·commit·push·PR·milestone/v0.4.11 병합을 승인했다. 기준 HEAD264010d에서 infra/276-lan-launcher PR을 작성해 필수 CI6개를 확인한다. 원본 HEAD33490f9·dirty/untracked는 보존하며 pull/reset하지 않는다. main Release·Render 배포는 승인되지 않았다.
- 서버 정리는 BAT4→1, 루트 회귀5→server/test, 사용하는 구 릴레이→fixture, 미사용 test-client·중복/수동 DROP smoke 제거와 참조 정정이다. TLS는 기존 보호 규칙과 Render 기본 경로를 유지하며 전용 CA:false leaf만 CurrentUser Root에 등록한다. 현재 thumb4E10A2D305BA6FBAB2C03E4F5174EC99C02A5DC1은 CJ 재실행용으로 유지했다.
- TLS 도입 후 전체 npm test30/30·exit0, launcher49/0·HTTP24/0·accounts125/0. 주소 로그 정정 TLS13/0·exit0(PS OpenSSL PATH fixture 실패 후 Git Bash 재시도). Saturn 실제 브라우저 및 최종 좁은 검토 PASS, 검사 재실행 없이 변경 범위를 확인했다. 기존 계정16·세션16·전적10·복구0 행 digest 동일, QA용 계정1개만 삭제, 비밀/outbox 해시 동일. 다른 물리 기기/방화벽·창 X·이번 정리의 실메일 발송은 미검증이다.
- 게임8085는 종료했고 시작 전 baseline PG29932/127.0.0.1:55462와 다른 앱PID4956/8084를 보존했다. Run run_016f80765b2b의 완료 Worker들은 영수증 보관 뒤 정확한 native terminal close로 실제 종료했다. external_terminal retained metadata를 실행 종료로 오인하지 않는다. 병합 뒤 review 트리는 최신 통합본 검토와 승인된 Mercury_PD 인수인계에 재사용한다.
- 현재 모델은 Mars/Jupiter Opus5.5/high/No Fast/bypass, Saturn Sol6/xhigh/default/full/never다. 현재 argv·화면·JSONL·preamble/capability·native turn을 검증했다. requested/effective=null·미기록 tier는 보존했다. 마지막 start_unknown은 held paste Enter1회 후 실제 turn_started와 cap를 재확인해 복구했으며 앞선 실패를 정상 시작으로 소급하지 않는다. 원본 보고·ZIP60파일/SHA·모델/정리 영수증은 C:/Users/pc_77/orca/archives/Digit-Duel/server-cleanup-2026-09-28에 있다.
- #232 통합·기존 작업 트리 정리는 완료다. 현재 Render DB·SMTP 미준비 NO-GO이며 CJ가 직접 유료 전환한 뒤 PD에게 별도로 알려 배포를 지시할 때까지 기다린다. 이번 인수인계는 gpt-6-sol/xhigh/default·danger-full-access·approval never로 승인됐다. 근거는 [#232 원장](../milestone/v0.4.11/issues/232/Mercury/integration-review.md)을 따른다. 아래 이전 날짜 항목은 과거 기록이다.

## 이전 체크포인트 — 2026-09-28 07:26 KST #238 로컬 시각·회귀 QA PASS

- CJ 시각 REVISE 후 일곱 화면/결과를 스케치에 맞게 재구성하고 UI48아이콘·배경·누락13종 아트를 연결했다. 배틀 구성·기존105아트·부모22파일 보존, 이력 토글 제거·공식 전적 보존. 첫 Saturn REVISE(320 말판 과축소·결과 중복)→Mars 좁은 수리→fresh Saturn task_ac362fb58397/ctx_5fcb6c514d38 로컬 PASS(238 86/0·publicrooms186/0·issue122 93/0), QA 전후1587파일 SHA/HEAD/status 불변. 모든 Worker 정산·정확 terminal close/ACK, 실행0. 현행 원장은 활성 issue-238-game-ui의 docs/milestone/v0.4.11/issues/238/Mercury/report.md. CJ 실제 브라우저 재확인·필수CI·PR/통합 대기, #238 Git 쓰기/병합/종결/배포 미승인. QA8085/PG55462·게임외8084 유지, 계정/DB/SMTP 보존.

## 이전 체크포인트 — 2026-09-28 05:44 KST #238 CJ 시각 QA REVISE / 디자인 리소스와 화면 재구현

- **#259**: CJ 최종 로컬 QA PASS와 커밋·PR 작성 승인에 따라 b865133 제품 커밋, 실제 원격 milestone bd4c90c 통합24945b7, 권한·QA·화면 기록68863dc를 feature에 push했다. [PR #269](https://github.com/ChangjoSung/Digit-Duel/pull/269)는 검토 가능 상태이며 최종 HEAD68863dc 필수 CI6/6 PASS(run36306785458). fresh Saturn 통합 LOCAL PASS(live46/runtime74), 파일 수정0. 단일 inline probe exit1은 정상 null 기대값 오류이며 그 뒤 privacy 단언 미실행을 원장에 보존했다. HTTPS/Render 검증은 남아 있고 마일스톤 병합·Issue close·배포는 승인되지 않았다. 계정 흐름 CJ PASS는 통합 전 검수로 구분한다. 원장은 활성 #259 Mercury/report.md 하나다.
- **#260**: CJ·Saturn 로컬 QA PASS 후 d456102 제품42파일·bf8bc07 계정 문서 통합·a444d57 익명 화면을 커밋/push했다. [PR270](https://github.com/ChangjoSung/Digit-Duel/pull/270)은 #259 브랜치 기준 분리 PR이며 [최종 HEAD a444d57 CI](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36311355490)6/6 PASS. 하위→부모 PR 직접 checks는 없으며 부모→milestone 통합 CI는 별도다. 작업 트리는 깨끗하고 milestone 병합·Issue close·배포는 승인되지 않았다. 기존 검증/REVISE 원장은 활성 #260 Mercury/report.md다.
- **Worker·보존·다음 작업**: #259 PR269·#260 PR270·#261 PR271·각 브랜치CI6/6, #262 미커밋 Saturn/CJ 최종PASS와22파일 원본을 보존한다. #238 기능QA는 이전 이력이며 현재 CJ 시각REVISE다. CJ 스케치와 참조 로비를 직접 열어 기존 goods8아이콘만 계약이 부족함을 확인했다. 로그인·회원가입·메인로비·멀티 방 찾기·대기로비·게임시작 메인·상점은 재구성, 유일하게 맞는 배틀 배치는 보존하고 모든 불필요한 이력/지표 토글을 제거한다(공식전적DB 보존). 새 Run run_67407ff72916: Venus task_1fbf0b61bd6f/ctx_db24a25ee3e0는 원본4이미지 대조·planning/GDD13/23/24 정정 완료 후 release·정확close·ACK했다. Earth_1 task_3ab8a2db8a42/ctx_8ae39bc6520e/PID38120/JSONL01a0e485 Astra/medium가 UI배경/아이콘/참조 기반 시각 구성, Earth_2 task_49a162c8582f/ctx_e74d5884711a/PID30436/JSONL01a0e488 Astra/medium가 누락 일반10(보호4+땅6)/전설3종 새아트를 맡는다. 실제 full/never/default argv·현재 JSONL/footer·새 turn_started/preamble/cap 확인 후 GO, adopted requested/effective allnull 및 Codex tier=null 원문 보존. Earth nativeimagegen 확인. Earth_1 실제48아이콘·배경·수정시안·정확crop계약과 Earth_2 13종원화+Mars128/32크기 검토가 완료됐다. 두 Earth는 release·정확close(ptyKilled=true)·ACK했고, nativeimagegen22회 원시 사용량을 외부QA에 보존했다. fresh Mars task_ad4dfd6666e6/ctx_9ec7a4272e08/PID14612/JSONL68aeacac는 현재Opus5.5/high/bypass와 새턴/preamble/capability를 직접 확인한 뒤GO했고 시각계약/실물아트로 UI·런타임매핑을 구현 중이다. 기존105아트 SHA 동결을 유지하며 Saturn은 구현 동결 후 실제 참조이미지 대조와 필요한 회귀만 검증한다. 최신QA_MINIMUM_POLICY에 기능PASS와 시각PASS 분리 추가. #238 기존조건1/2 미체크·3기능보존 유지·최종CJREVISE, 댓글0/OPEN. 불필요 게임서버8081/2/3 종료·DB/계정/SMTP 보존, 검수8085/PG55462만 게임용 유지·게임외8084 유지. #262/#238 Git 쓰기/병합/종결/배포/Render 생성결제 미승인. 활성 #238 Mercury/report.md가 단일원장이다.
- 2026-09-26 CJ 정정에 따라 [#232](https://github.com/ChangjoSung/Digit-Duel/issues/232)·[#259](https://github.com/ChangjoSung/Digit-Duel/issues/259)·[#263](https://github.com/ChangjoSung/Digit-Duel/issues/263)·[#264](https://github.com/ChangjoSung/Digit-Duel/issues/264)의 본문을 목표·확정 규칙 요약·기존 완료 조건·필요한 연계만 남기도록 줄였다. GDD 절 번호·Worker 정산·긴 검사 이력을 제거했고 각 Issue에 완료 조건 체크리스트는 하나뿐이다. 신규 GitHub Issue 댓글은 0건이다. CJ가 #263 브라우저 플레이 QA **PASS**를 직접 확인했고 #259·#264는 병합 선행 조건이 아니다. [PR #268](https://github.com/ChangjoSung/Digit-Duel/pull/268)의 필수 CI 6/6 통과 후 `milestone/v0.4.11`에 squash 병합(`83434f0`)했다. #263 전용 트리는 깨끗하고 병합 트리와 내용 동일함을 확인한 뒤 Orca에서 제거했다. #263의 현행 GitHub 상태는 CLOSED다(닫힘 이벤트 2026-09-26 01:14 KST, actor ChangjoSung, commit_id 없음). 이번 조정에서 Issue close 명령은 실행하지 않았고 배포·Render 자원 변경은 없다. Claude의 23:00 KST TUI 자동 재개를 실제 확인했다. Mercury가 재개 조정을 이어받아 23:10 KST 추가 coordinator 자동화 `ceea6f26-6e36-40fb-a3a3-92816362506d`는 중복 방지를 위해 비활성화했다. 기존 Run을 재사용하며 현재 dispatch는 아래 현행 QA 상태 항목을 따른다.
- CJ 지시에 따라 #263, 오래된 #264, 최신 #264의 변경과 이력을 [작업 트리 정리 원장](../milestone/v0.4.11/reports/Mercury/worktree-consolidation-2026-09-25.md)에 모았다. 정리 당시 #263과 `issue-264-render-db-current`는 각각 미커밋 활성 이슈 트리였고, #263은 위 PR 병합 뒤 제거했다. 오래된 `issue-264-render-db`는 파일 1,469개의 SHA-256 manifest가 든 ZIP을 전건 검증하고, 빠졌던 Mercury 운영 기록을 최신 트리에 바이트 동일 복사한 뒤 Orca에서 제거했다. 과거 잘못된 모델 실행은 정식 QA로 소급하지 않는다.
- 원본 checkout의 dirty·untracked 사용자 파일은 그대로다. 대상 폴더의 #217/236/237 잔여 경로는 Git/Orca 작업 트리가 아니었다. #217은 전체 압축·해시 검증 뒤 과거 미리보기 프로세스의 잠금을 해제해 보관 경로로 이동했고, 파일 0개였던 #236/237 잔여 폴더도 과거 점유 프로세스를 종료한 뒤 삭제했다. `.orca-worktree-trash`는 Orca 내부 빈 폴더라 유지한다.
- CJ가 정리 후 다음 구현을 지시했다. 권장 순서상 #259를 `fafc619` 기반 신규 `issue-259-accounts` 트리와 Orca Run `run_ea381b9521ea`에서 착수했다. CJ 결정은 가입 시 1회 발급 복구 코드·발급 후 365일 만료, 로그인 ID와 공개 닉네임 분리·가입 시 닉네임 지정·중복 금지·2~12자 완성형 한글/영문/숫자/밑줄(영문 대소문자 무시 중복, 단독 한글 자음·모음 불가), 계정 세션 30일 절대 만료·기기별 독립이다. GitHub #259 본문에 기록했다. Jupiter 서버와 Mars HTML의 로컬 구현·보안 보정은 완료했고 Venus의 GDD-13/23/24 최종 닉네임 동기화를 원문 재조회로 확인했다. 현행 판정과 제한은 아래 QA 상태를 따른다. 세 Worker 모두 `claude-opus-5-5/high`·full access·무확인 실행을 footer/turn_started로 확인했고, 유일한 Claude 계정의 주간 한도 100%로 중단됐던 작업은 CJ 결정대로 같은 모델에서 23:00 KST 이후 자동 재개됐다. 초기 구현의 남은 항목과 현재 정산은 아래 현행 QA 상태 항목을 따른다. #264의 실제 Render/DB는 미검증이다. 아래의 “#259~#262 별도 착수” 문구는 이전 이력이다. stage·commit·PR·issue close·배포·Render 자원 생성/결제 금지는 계속 적용한다.
- 중단 시점 #259 변경 파일 27개를 `C:/Users/pc_77/orca/archives/Digit-Duel/issue-259-pause-2026-09-26.zip`에 원본 경로·크기·SHA-256 manifest와 함께 담고 전건 재검증했다(ZIP SHA-256 `3e8f47853155446f7572c003676e60cdf2b1fa29b4fe9dbaea5a5d7edeb1b5c8`). 먼저 시도한 `.tar.gz`는 빈 경로 오류로 검증되지 않았고, 그 정확한 임시 파일 삭제도 자동 승인 검토의 `blocked by policy`로 거절돼 남아 있다. **유효 보존본은 ZIP만**이다.
- **2026-09-27 00:05 KST 현행 QA 상태**: 승인 모델의 #259 로컬 보안 QA **PASS**. Jupiter 수리 메모리119/0·로컬PG120/0·PG프로세스13/0, Mars 최종125/0. 첫 Saturn Sol QA `ctx_bc57846fd734`의 HIGH3/MEDIUM1 REVISE와 초기 turn_start_unobserved 조사는 이력대로 보존한다. 같은 TUI의 후속 `ctx_9ba0306aac92`·`ctx_86942e191833`는 실제 Luna/medium으로 실행돼 진단 근거만 보존하고 정식 QA에서 제외했다. 확정: 첫 완료 뒤 모델 전환 팝업이 열려 있었고 후속 입력 직후 Luna가 됐다. 추론: dispatch 키 입력이 팝업 선택에 쓰였다. PD의 입력창 상태 누락·과거 preflight 재사용을 정정했다. `ctx_cb9eeacee16f`는 tier 직접 증거를 확정하지 못한 preflight-only failed, 제품 변경/검사0·owned terminal released다. 최종 fresh `task_2b837cc4bcc5`/`ctx_57e27a16fe77`는 명시 Sol/xhigh/default·Full Access/never, 현재 turn_context/footer·turn_started·preamble/capability를 GO/완료 때 대조했다. 서버119/0·클라이언트125/0·typecheck/diff exit0 및 별도 지연 응답/복구 코드 게이트 재현 PASS, QA 전후30파일 해시/status/HEAD 동일. 완료 후 팝업에서 Keep current model을 선택해 Sol footer를 확인했다. 단일 원장은 활성 issue-259-accounts의 `docs/milestone/v0.4.11/issues/259/Mercury/report.md`다. root와 활성 #259/#264의 CLAUDE·모델 표/JSON·QA 원칙에 현재 턴·입력창·완료 검증을 반영했다(운영 절차, 자동 차단 코드 아님). 외부 terminal release는 retained/external이며 실제 종료가 아니다. GitHub #259 기존 로컬 계정 조건을 체크하고 #259/#264 중복 하위 체크를 제거, #263 완료 조건의 운영 세부사항도 줄였다. 새 Issue댓글0. 실제 브라우저HTTPS·RenderDB·CJQA·CI·최신83434f0/#264 통합은 미검증이다. #259 Git 쓰기/배포/Render 변경 금지와 dirty/untracked 보존을 유지한다.

## 이전 인계 — 2026-09-25 PD 교대 지시 (당시 기록)

- **같은 체크아웃을 인계한다.** `C:/Users/pc_77/orca/Digit-Duel`의 `milestone/v0.4.11`에서 새 Mercury_PD 터미널만 열고 WorkTree를 생성하지 않는다. 2026-09-25 CJ 최신 정정에 따라 새 PD는 `gpt-6-sol`·xhigh·No Fast와 `danger-full-access`·approval `never`로 시작한다. 이 권한은 새 PD에 한정하며 Worker·다른 프로젝트·host 정책으로 확대하지 않는다.
- 새 PD는 첫 보고 전에 CJ 최신 Comment → `CLAUDE.md` → [Creat2ve Work Rule](https://app.notion.com/p/3ce1e7f17085818c82c5dd886149ad5b) → `docs/creat2ve/AUTHORITY.md`·`WORKER_MODELS.md`·`QA_MINIMUM_POLICY.md` → 이 스냅샷의 **현재 체크포인트** → 현재 Notion GDD·GitHub Issue 순으로 대조한다. 아래 날짜가 오래된 섹션은 이력이며 현재 상태나 권한보다 우선하지 않는다.
- GitHub 본문 작성 방식은 아래 **Issue·PR 작성 포맷**을 따른다. 기존 완료 조건의 체크만으로 진행을 관리하고 신규 GitHub Issue 댓글은 남기지 않는다. 상세 검증·정산은 로컬 부서 보고서에 보관하며 공식 sub-issue 관계를 유지한다. 보호 트랙 직접 커밋·Worker Git 쓰기는 금지한다.
- 교대 뒤 CJ가 #263에 이어 #264 로컬 구현을 착수시켰다. #259~#262·#238 구현, Render 자원 생성·결제, 배포, 이슈 종결은 별도 착수 지시와 기존 게이트를 따른다. 별도 지시 전 stage·commit·PR을 하지 않는다. 미커밋·미추적 사용자 파일은 그대로 보존한다.

## 최상위 정정 — 2026-09-25 CJ 모델 재점검·재발 방지

- **현행 모델은 [#250 CJ 승인](https://github.com/ChangjoSung/Digit-Duel/issues/250)과 [PR #251 병합](https://github.com/ChangjoSung/Digit-Duel/pull/251)**이다. Mercury·Saturn=`gpt-6-sol/xhigh/default`(No Fast), Venus·Mars·Jupiter=`claude-opus-5-5/high`, Earth 신규=`gpt-6-astra/medium/default`, 기존 수정=`gpt-6-luna/xhigh/default`. 2026-09-25 최초 인계문의 “Saturn gpt-5.6-sol/high 유지”와 이 스냅샷 아래의 9월 17~18일 모델 이력은 **현행 실행 지시가 아니다**. CJ가 2026-09-25 직접 재점검을 요청해 #250으로 복귀시켰다.
- 재발 원인은 원본 checkout의 로컬 `milestone/v0.4.11` HEAD `33490f9`가 #250 병합 커밋 `5435b40`보다 오래됐는데, 그 위의 미커밋 운영 파일을 최신인 것처럼 취급한 점이다. 첫 #264 트리도 `33490f9`에서 생성돼 2026-09-13 모델 표를 포함했다. 모델 계약을 root·작업 트리·명시 기동값·TUI footer까지 대조하지 않았다. [모델 드리프트 차단 게이트](WORKER_MODELS.md)를 모든 새 worktree/Worker에 적용한다. 원본 dirty·untracked는 보존하고, 옛 Worker 결과를 올바른 모델 실행으로 소급하지 않는다.
- #264 첫 Jupiter는 `claude-opus-5/high`, 첫 Saturn은 `gpt-5.6-sol/high`로 실행돼 #250과 다르다. 첫 Saturn은 파일 무수정 REVISE로 공개 IPv6를 내부 호스트로 오분류해 TLS를 끄는 결함과 복원 예시의 오류 중단/비밀 인수 문제를 찾았다. 이는 유효한 결함 증거이나 **#250 모델의 정식 Saturn QA로 계산하지 않는다**. 첫 트리 파일은 검증된 ZIP과 최신 트리의 Mercury 운영 기록 사본으로 보존하고 트리 자체는 제거했다. `origin/milestone/v0.4.11`의 `fafc619`에서 새 `issue-264-render-db-current` 트리를 만들고, 올바른 모델의 Jupiter 수리·Saturn 재QA를 수행했다. 결과와 잔여는 다음 항목에 적었다.
- 새 트리의 Jupiter `task_0aad1d9b4497`/`ctx_7c30588516d0`는 `claude-opus-5-5/high`·full access로 최신 base에 이식했다. 올바른 `gpt-6-sol/xhigh/default` Saturn들이 코드·복원 런북의 REVISE를 내고 Jupiter가 순차 수리했다. 최종 fresh Saturn `task_9ceb08f9aff5`/`ctx_84fdb5a9f39c`는 **로컬 런북 GO**를 보고했다. 새 트리 `docs/milestone/v0.4.11/issues/264/Mercury/model-contract-audit.md`에 각 결함과 제한을 기록했다. 새 Worker의 TUI 모델·권한·preamble·capability·`turn_started`를 관측했고, 기존 TUI 재사용으로 Orca launch requested/effective는 `null`이므로 관측값으로 꾸미지 않는다. **#264 전체 완료 아님**: 실 DB·Render·독립 스크래치 복원·배포 검증, CJ 자원 승인이 남았다.

## 이전 체크포인트 — 2026-09-25 #264 Render DB 로컬 준비 GO·실 DB 대기

- CJ가 다음 권장 이슈 #264 구현과 이번 작업의 모든 Worker full access·무확인 실행을 지시했다. 이는 실행 권한 예외이며 Mercury의 제품 코드 비작성, Saturn의 파일 무수정 QA, Worker Git 쓰기 금지, Render 리소스·결제 별도 승인 게이트를 바꾸지 않는다. `CLAUDE.md`·`WORKER_MODELS.md`·`worker-models.json`에 이번 범위를 기록했다.
- #264 첫 트리 `C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-264-render-db` (`33490f9`)에서 Run `run_a9e99997333d`의 Jupiter `task_ed012e422daa`/`ctx_c1d31a5b346a`가 선택적 Postgres 연결·마이그레이션·fail-closed 게이트를 구현하고 `worker_done` 성공으로 정산됐다. Mercury는 그 스냅샷의 DB 회귀 33건, `npm.cmd test`, 공개 방 2클라이언트 smoke 23/0, `git diff --check`를 확인했다. Saturn `task_f1065749b581`/`ctx_5fbffac2707e`는 파일 무수정 REVISE였으며 모델 설정 오류와 발견 결함은 위 최상위 정정에 기록했다. 이 트리는 수정·검증 이력으로 보존하며 최신 기준 납품으로 쓰지 않는다. 실 Postgres·Render 왕복은 아직 없다.
- Orca 브라우저의 Render Dashboard는 로그인 화면이라 실제 plan·DB 존재·region·배포 브랜치를 확인하지 못했다. 로컬 `psql`·`pg_dump`·Docker도 현재 PATH에서 찾지 못했다. GDD-23 §2.4와 GitHub #264는 **실제 Render 자원 생성·결제·요금제 변경에 별도 CJ 승인**을 요구한다. 이에 따라 Worker 범위는 코드·로컬 검증 준비로 한정하고 외부 리소스는 변경하지 않았다. [Render Free 공식 제한](https://render.com/docs/free)은 1GB·30일 만료·14일 유예·관리형 백업 없음이며 무료 Web은 15분 유휴 시 잠든다.
- [GitHub #264](https://github.com/ChangjoSung/Digit-Duel/issues/264)의 `현재 상태`를 로컬 준비 GO와 실 DB·Render·CI·CJ QA 대기로 치환했고 OPEN을 확인했다. 이슈의 완료 조건과 Render 자원 생성 승인 게이트는 유지했다.

## 이전 체크포인트 — 2026-09-25 #263 후속 30초/60초 구현·Saturn QA GO, 통합 대기

- CJ 최신 규칙은 보드 행동 무응답 30초 턴 넘김, 이동 뒤 강제 대상 1개 즉시 전투·2개 이상 새 30초 선택/서버 균등 난수, 전투 행동 60초 만료 시 현재 전투원 행동만 생략이다. CJ Q5: 단일 강제 대상 B02는 보드 시계 잔여, 복수 대상 B02는 대상 선택 시계 잔여를 쓰고 회복·선택 전투도 보드 30초에 포함한다. Q1=A·Q2=A는 유지하며 Q3·Q4는 #263 비차단이다. Notion GDD-13/23/24와 GitHub #263/#232 본문에 반영했다.
- 전용 작업 트리 `C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-263-shop-timers` (`ChangjoSung/issue-263-shop-timers`, `fafc619`)의 Jupiter Core·서버와 Mars UI 구현은 미커밋 상태다. 최종 Jupiter 타이머 회귀 133/0, Mars 클라이언트 164/0, 경제·무경제 실서버 2클라이언트 46/0·23/0, 타입 검사·타입 계약 70/0, 적용 가능한 회귀 및 `git diff --check` 통과. [Mercury 최신 원장](../milestone/v0.4.11/issues/263/Mercury/report.md)에 변경·검사·한계와 dispatch 정산을 구분했다. Mercury는 제품 코드를 직접 쓰지 않았다.
- Saturn 첫 신규 QA는 마감 시각 이후·타이머 콜백 전 늦은 입력 수락을 찾아 **REVISE**했다. Jupiter가 서버 시각의 공통 `_late` 판정으로 보드·복수 대상·전투·배치 입력을 고쳤다. Saturn 좁은 재감사는 **GO**(133/0 + 별도 메모리 경계 재현 PASS, 파일 변경 0)다. 두 Saturn 모두 읽기 전용 샌드박스에서 `orca-runtime.json` 접근이 막혀 worker_done이 실패했으므로 dispatch를 abandoned, Task를 수동 완료했다. 첫 REVISE를 사후 GO로 소급하지 않는다. Jupiter 임시 변이 시험이 중단돼 `room.js` 한 줄과 줄바꿈이 바뀌었으나 후속 Jupiter가 작업 전 백업과 대조해 복구했다(CRLF 1,908줄·복구 후 133/0); 중단된 dispatch는 실패/abandoned로 남겼다.
- 남은 것은 CJ 플레이 QA·브라우저 시각/접근성 확인·PR 필수 CI와 통합 판단이다. 라이브 소켓 이벤트 루프 스트레스, 읽기 전용 환경에서 임시 변형 파일을 만드는 일부 CI 게이트는 미검증이다. **별도 CJ 지시 전 stage·commit·PR·issue close·배포·Render 자원 생성/결제 금지**, 원본 체크아웃의 dirty·untracked 보존. #264 이후 후속 이슈는 미착수다.
- Venus가 Notion GDD-13/23/24의 낡은 현재 구현 상태 문구만 치환하고 세 페이지를 재조회했다([변경 원장](../milestone/v0.4.11/issues/263/Venus/implementation-status-sync.md)). #263은 전용 작업 트리의 미커밋·미통합 구현이고 Saturn 첫 REVISE→수리 뒤 읽기 전용 GO(수동 기록), CJ 플레이 QA·PR 필수 CI·통합은 대기다. v0.4.11 출시나 #264·#238·#259~#262 착수로 표기하지 않았다. [GitHub #263 진행 기록](https://github.com/ChangjoSung/Digit-Duel/issues/263#issuecomment-5831131346)을 남겼으며 이슈는 OPEN이다.

## 이전 체크포인트 — 2026-09-25 #263 Q1/Q2 구현·Saturn QA GO

- Mercury footer `GPT-6-Sol xhigh`·`service_tier=default`(No Fast)를 확인했다. 원본 체크아웃 `C:/Users/pc_77/orca/Digit-Duel`의 `milestone/v0.4.11`과 기존 dirty·untracked 파일은 보존했다. 제품 코드는 Mercury가 직접 쓰지 않았다.
- #263은 기존 Orca 작업 트리 `C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-263-shop-timers`, 브랜치 `ChangjoSung/issue-263-shop-timers`, 기준 `fafc619`에서 Jupiter(Core·서버)·Mars(클라이언트)가 구현했다. Venus 기획 감사를 원본에서 작업 트리로 해시 일치 복사했다. 작업 트리의 `docs/milestone/v0.4.11/issues/263/Mercury/report.md`가 구현·검사·제한의 현재 원장이다. [GitHub #263 진행 기록](https://github.com/ChangjoSung/Digit-Duel/issues/263#issuecomment-5827686437)을 남겼다. Git stage·commit·PR·이슈 종료·배포·Render 자원 생성/결제는 하지 않았다.
- Notion GDD-23/24와 GitHub #263·#232를 CJ Q1=A(서버 난수 1회, 왕·동료 공유), Q2=A(행동 30초에 B02 선택 포함, 만료 시 서버 선택, 전용 20초 없음)로 정리했다. Q3·Q4는 #263 비차단이다. #238·#264는 변경하지 않았다.
- Orca run `run_00f56f4b0096`: 첫 Saturn QA의 `worker_done`은 Codex read-only sandbox가 Orca 런타임 메타데이터에 접근하지 못해 실패했으므로 REVISE 판정을 수동 기록했고 dispatch를 abandoned 처리했다. Mercury가 후속 Saturn 터미널 둘을 `-s danger-full-access`로 시작한 것은 **PD 전용 full access를 Worker로 확대하지 말라는 이 문서의 권한 계약 위반**이다. 파일 쓰기는 없었지만 권한 설정 오류를 소급 정상화하지 않는다. 그 두 formal QA는 단절 중 송신 우회 두 건을 찾아 Mars가 수리했고 `ctx_715c507f6f9a`는 GO로 정산했다. 이후 권한 준수 `-s read-only` Saturn `ctx_d6603b122ff5`가 현재 변경을 108/0·파일 변경 0으로 **GO 재확인**했으나 Orca 런타임 접근 오류로 `worker_done`은 불가능해 dispatch를 abandoned, Task를 수동 완료했다. [GitHub #263 정정 기록](https://github.com/ChangjoSung/Digit-Duel/issues/263#issuecomment-5827787963)에도 구분했다. 마지막 클라이언트 표적 검사 108/0, 경제 실서버 32/0, 무경제 실서버 23/0, 서버 18스위트 0 fail, 타입 계약 70/0, `git diff --check` 오류 0. 마지막 무경제 실서버는 Mercury가 Mars의 최종 네트워크 수정 뒤 1회 실행했다. 같은 문제를 Worker 권한 확대로 우회하지 않는다.
- **남은 규칙 결정**: 강제 전투가 남은 행동 30초 만료에서는 Core가 필수 전투 전 턴 종료를 거부하므로 자동 턴 넘김이 되지 않는다. Jupiter가 `[기획 필요]`로 기록했고 CJ에게 처리 방향을 질문했다. 로스터·트레이 등의 일부 정지 중 시각 잠금은 미흡하지만 Saturn은 게임 상태 변경·송신 0건을 확인했다. CJ 플레이 QA와 PR 필수 CI는 아직 수행 전이다.

## 이전 체크포인트 — 2026-09-25 v0.4.11 문서·규칙 동기화

- **Mercury PD 모델 정정 (당시 기록)**: 계정 전역 Codex 설정은 이미 `gpt-6-sol`·xhigh였지만, Digit-Duel 프로젝트 `.codex/config.toml`과 이전 인수 실행문이 `gpt-5.6-sol`·high를 덮어써 당시 터미널이 구 모델로 시작했다. 프로젝트 설정과 `WORKER_MODELS.md`·`worker-models.json`에서 Mercury만 `gpt-6-sol`·xhigh·`service_tier=default`(No Fast)로 정정했다. 당시 Saturn과 다른 역할을 변경하지 않은 것이 이번 드리프트의 일부였으며 **위 최상위 #250 정정이 현재 실행값**이다. 실행 중인 터미널의 모델은 설정 파일 저장만으로 바뀌지 않는다.
- 부모 [#232](https://github.com/ChangjoSung/Digit-Duel/issues/232)의 공식 하위 14개는 7개 완료·7개 OPEN이다. 열린 #263·#264·#259·#260·#261·#262·#238은 개별 CJ 착수 지시를 따른다. [v0.4.11 현재 안내](../milestone/v0.4.11/README.md)가 범위·권장 순서의 로컬 입구다.
- 2026-09-25 CJ 정정으로 Venus의 `eli-adult`는 새 Notion 페이지뿐 아니라 **기존 기획서 수정과 Venus가 작성하는 모든 기획서·보고서·글**에 적용한다. [Creat2ve 구조 원문](https://app.notion.com/p/3ce1e7f17085818c82c5dd886149ad5b)의 공용 규칙 9·Decision Log와 `CLAUDE.md`·`WORKER_MODELS.md`·Venus 백업 Prompt에 반영했다. 범용 `creat2ve-structure` 저장소의 새 릴리스를 발행한 것은 아니다.
- Venus의 [GDD 가독성·Render 정정 보고](../milestone/v0.4.11/planning/Venus/readability-render-sync.md)를 기준으로 GDD-13/23/24를 재조회했다. S01 시간 초과 자동 배치 뒤 배치 90초 중복 없음, 출전 후보 선택 시간 Q2 미결정, Render 무료 QA 가능·자원 생성/결제 미승인·GDD-13 후속 행 출처가 CJ Comment임을 확인했다. GitHub #232·#238·#263·#264의 해당 문구를 치환 동기화했으며 제품 코드·Render 리소스는 건드리지 않았다.
- Orca Venus 검증 Task `run_955d90293b4c` / `task_44e8c5598f3e` / `ctx_f7f45d7dc13a`: 시작 메시지에 dispatch capability가 주입되지 않아 정상 `worker_done`은 불가능했다. Venus는 후속 메시지로 GDD-13/23/24를 대조해 GDD-23 Render 출처와 GDD-24 두 타이머 행을 정정하고 [보고서](../milestone/v0.4.11/planning/Venus/readability-render-sync.md)에 19행 대조표를 남겼다. Mercury가 Notion·로컬 파일을 재조회해 **내용을 수동 검증**, Task는 수동 완료로 기록했다. Dispatch는 `failed/stopped`, 터미널은 released다. 이를 정상 Worker 정산으로 소급하지 않는다. Venus가 범위 밖 개인 메모 2개 파일을 건드린 사실을 확인해 두 파일 모두 이번 Task 전 문구로 복원했다. 읽기 전용 `git status` 1회는 이 Task의 No Git 브리프를 벗어났으나 Git 쓰기·제품 변경은 없었다.

아래 2026-09-18 상태와 SHA·터미널 기록은 당시 체크포인트이며 현재 GitHub/배포 상태로 소급해 읽지 않는다.

## 이전 상태 — 2026-09-18 #244 완료·PR #246 부모 통합 · #245 구현 대기

- **PD 모델 (2026-09-17 CJ 인수인계 지시)**: Mercury_PD = Codex `gpt-5.6-sol` · effort high · service_tier=default(No Fast). 실행: `codex --model gpt-5.6-sol -c model_reasoning_effort="high" -c service_tier="default"`(프로젝트 `.codex/config.toml` 기본값과 같다). 같은 날 Codex 한도로 Claude Opus 5 high PD(coordinator `term_fff054bc-dcf0-425f-9dd9-e502aeee20a5`)가 임시 운영했고, CJ "작업 종료" 뒤 이 스냅샷으로 인계했다. 새 Mercury_PD 터미널: `term_b575a10f-1b1f-4080-bf27-50024826e4ea`(원본 작업공간, gpt-5.6-sol high 기동 확인, 시작 시 Codex 주간 한도 5% 미만 경고). Saturn(Codex) 교차 QA는 Codex 한도가 풀리면 정규 배치로 돌아간다. 한도 중에는 #122 2차 전례(Claude 백업 QA + CJ 플레이 QA 게이트)를 따른다.
- **Ponytail (2026-09-18 CJ 결정)**: Codex·Claude에 `ponytail@ponytail` v4.10.0 설치·enabled 확인. Mercury·Mars·Jupiter·Saturn은 `full` 필수, Venus는 eli-adult 우선 + 기술 기획 YAGNI 검토에만 `lite` 조건부, Earth 순수 아트는 미적용이며 코드·도구는 Mars로 라우팅한다. Claude 설치 Worker `ctx_b71047257ce5`는 Opus 5 high requested/effective 일치, 저장소 무수정으로 성공 보고 후 archive captured·released(`run_13f882819733`).
- **Ponytail 측정 한계**: 플러그인 벤치마크는 Claude에서 절감, 일부 OpenAI 추론 모델에서 비용 증가를 보고해 현재 Opus 5·Sol·Astra·Terra의 프로젝트 절감률은 미확정이다. 대표 작업 5~10건을 측정한다. 제공된 설치 명령은 user scope이고 Claude always-on 지침 약 983 tokens/세션 및 하위 에이전트 재주입 가능성이 있어, 다른 프로젝트 영향 차단은 CJ 추가 결정 전 변경하지 않았다.
- **#234·#241 재QA (2026-09-18 CJ 지시)**: Saturn은 `gpt-5.6-sol` high · service_tier=default(No Fast) · Ponytail full로 초기 QA와 정리 후 재QA 모두 PASS했다. 이 구성은 **#250 이전 당시의 기본값**이며 현행 배치는 위 최상위 `gpt-6-sol/xhigh/default`다. 원격 트랙 `0b7f683` 격리 worktree에서 최종 표적 검사는 클라이언트 #234 351/0, #241 83/0, 서버 #234 81/0, #241 74/0이며 각각 1회·exit 0, `git diff --check` 통과다.
- **재QA 정리 결과**: Mars가 `demo/index.html`의 미사용 `aimShot` 지역값·미사용 `v2RoundDecay` 인수/호출·중복 `cds` 초기화 2곳을 정리했고, Jupiter가 서버 digest의 죽은 `counterSeq`와 그 인공 경계 테스트를 정리했다. 제품 결함 HIGH/MEDIUM 없음. [PR #246](https://github.com/ChangjoSung/Digit-Duel/pull/246)은 `infra/243-creat2ve-maintenance`에 squash 병합됐고 부모 브랜치 HEAD는 `9853a2c611c83c4b5c59aec86bcbab953b162668`이다. [#244](https://github.com/ChangjoSung/Digit-Duel/issues/244)는 CLOSED, 원격 하위 브랜치는 삭제했다. 정보성 잔여는 전투 입력 timeout 부재, 현행 E5 보류 해석, 현재 로드아웃으로 도달 불가한 동시 해일 양측 사망 순서다. `scheduleDelayed` 계열은 #233 계약, `V2_KINGDOM_STAGE2`는 #235 소비 예정이라 삭제하지 않았다. Orca run `run_d965aa085500`; 최종 Saturn `ctx_1402ac63b63a` released. 첫 Saturn 성공 터미널 `ctx_aa36a85e95ff`는 user_takeover 판정으로 retained이며 임의 종료하지 않았다.
- **GitHub 구조**: 부모 [#243](https://github.com/ChangjoSung/Digit-Duel/issues/243)과 브랜치 `infra/243-creat2ve-maintenance`, 완료 하위 [#244](https://github.com/ChangjoSung/Digit-Duel/issues/244), 구조 전환 하위 [#245](https://github.com/ChangjoSung/Digit-Duel/issues/245)로 관리한다. #245 설계는 CJ가 Pick했으며, 약 7,157줄 단일 HTML을 단계적으로 분리하되 이 Issue 안에서 장기 유지보수 구조 전환 전체를 완료한다. 구현은 아직 시작하지 않았고 CJ 착수 지시 전 진행하지 않는다.
- **다음 PD 권한**: 새 터미널 `term_968bc576-c89e-4d36-a1ab-540a4320ea79`을 CJ 지시에 따라 Codex Sol high·No Fast + `danger-full-access` + approval `never`로 시작했다. 다른 Worker나 프로젝트의 권한 기본값은 변경하지 않았다.
- **인수 첫 작업**
  1. 이 스냅샷과 CLAUDE.md를 읽는다.
  2. `git fetch` 뒤 원격 `milestone/v0.4.11`=`0b7f683`, `infra/243-creat2ve-maintenance`=`9853a2c`, PR #246 MERGED, #244 CLOSED, #245 OPEN을 확인한다.
  3. 인계 보고에 스냅샷 기준일(2026-09-18), PR #246 부모 통합과 미착수 #245를 명시한다.
  4. #245 구현과 나머지 v0.4.11 Issue는 CJ 지시 뒤에만 시작한다.
- **이번 세션 운영 문서(미커밋)**: `.claude/settings.json`·`.codex/config.toml`·`CLAUDE.md`·`docs/creat2ve/{AUTHORITY,HANDOVER_SNAPSHOT,QA_MINIMUM_POLICY,WORKER_MODELS}.md`·`worker-models.json` 등은 기존대로 원본 작업공간의 미커밋 운영 설정이다. stage·commit하지 않았다.
- **트랙** `milestone/v0.4.11` = `0b7f683`
  - [#240](https://github.com/ChangjoSung/Digit-Duel/pull/240) `90b2ace` — #234 CLOSED
  - [#242](https://github.com/ChangjoSung/Digit-Duel/pull/242) `0b7f683` — #241 CLOSED
  - 둘 다 CJ QA PASS, 필수 CI 6/6. 이슈 브랜치는 원격·로컬 삭제했고, 작업 폴더 `workspaces/Digit-Duel/feature-234-roster-skills`·`feature-241-skill-cleanup`은 detached로 보존한다.
- **이 원본 체크아웃**(`milestone/v0.4.11` 로컬)은 `33490f9`에 머물러 있다. 미커밋 운영 파일 때문에 pull하지 않았다.
- **확정 규칙(2026-09-17 CJ)**
  - 수풀 기술 교체 비활성
  - 사신의 낫 절대 판정 즉사 · 4R · 전투를 넘는 봉인(참전 전투)
  - 왕국 (2) 미달성이면 효과 없음 · 1회성 효과는 회피돼도 소모 · 천년목 현재 HP · 조준 사격 치명 그 타격 한정
  - 전투 순서: 1R 속도 → 2R부터 교대 · 순서 효과가 다르면 그 라운드만 뒤집음
  - 교체 4종 · 단순화 12 · 속도 감소 → 회피율 감소 · Q3 ⌛+1 부여 라운드 제외 · E5 묵시적 승인
- **GDD-23**: Notion 본문 갱신, 9장 Decision Log 신설. GDD-13은 v0.4.11 출시 때 갱신한다.
- **run** `run_8d0a50871c21`: Worker 전부 released. Orca 런타임 재시작 뒤 남은 `check --wait` 대기가 `waiter_exists`를 내면 `--peek` 반복 조회로 우회한다.
- **미결 확인**: 해일 예고 E5 — 천년목 버티기·철벽 무효를 이미 쓴 뒤에는 효과가 켜져 있어도 보류하지 않는다. CJ가 "6라운드 끝까지 들고 간다"고 확인했고, 표식은 전투 끝(최대 6R)까지 유지된다(`index.html:1254·4760→4764`). 보류 범위 변경 여부는 CJ 답변 대기.
- **다음 후보(CJ 지시 대기)**
  - #245 구조 전환을 단계별로 완료하고 #243 부모 브랜치에 통합
  - #243 완료·트랙 통합 뒤 #235→#236→#237→#238 순서로 진행
  - 후속 관찰: E1 전투 입력 시간 초과 · 천둥 낙인 · GDD-24 UI 흐름표 대조 · `planning/README.md` 상태 갱신
- 상세: 트랙의 `docs/milestone/v0.4.11/issues/234/`·`241/`

## Issue·PR 작성 포맷 — 2026-09-18 CJ 결정

앞으로 현재 본문의 기준 예시는 부모 [#243](https://github.com/ChangjoSung/Digit-Duel/issues/243), 완료 하위 [#244](https://github.com/ChangjoSung/Digit-Duel/issues/244), 복합·미착수 하위 [#245](https://github.com/ChangjoSung/Digit-Duel/issues/245), 통합 [PR #246](https://github.com/ChangjoSung/Digit-Duel/pull/246)이다. #232와 공식 sub-issue #233~#238·#241도 이 포맷으로 정리했다.

- **공통**: Issue 본문은 CJ가 읽을 목표·확정 규칙 요약·기존 완료 조건·필요한 의존성만 담는 현재 단일 기준이다. GDD 장·절 번호, 내부 코드 경로, Worker 정산과 긴 검사 로그는 GDD 또는 로컬 역할별 보고서에 둔다. 새 GitHub Issue 진행 댓글은 **작성하지 않는다**. 기존 댓글은 과거 이력으로만 둔다. 진행 체크박스는 **기존 완료 조건 한곳**에만 두며 `현황 TODO`나 별도 `현재 상태` 체크리스트를 추가하지 않는다. 복합 조건은 그 안에서 분리하거나 하위 항목으로 기록하고, 남은 조건이 있으면 상위 항목을 미완료로 둔다. 제목·본문·체크리스트·API 재조회 결과는 UTF-8로 검증해 깨진 한글, `�`, 문자 그대로의 줄바꿈 escape를 남기지 않는다.
- **부모 Issue**: `목표` → `이번 범위`(공식 sub-issue 연결) → `부모 이슈 완료 조건`만 간결하게 둔다. GitHub가 보여 주는 하위 이슈 상태 표를 본문에 다시 만들지 않는다.
- **하위 Issue**: `상위 이슈·마일스톤` → `목표` → `CJ 확정 규칙 요약` → `완료 조건` → 필요한 `연계`만 둔다. 검증 여부는 기존 완료 조건 안에서 표시하고 상세 근거는 로컬 역할별 보고서에 둔다. 완료된 단순 변경은 불필요한 빈 절을 생략한다.
- **완료 Issue**: PR 번호와 base, merge SHA·일자, QA/CI 명령별 정확한 결과·exit code, 브랜치 정리 여부, rollback 기준을 본문에 남긴다. 미착수 Issue는 완료 표현 대신 start gate와 선행 의존성을 명시한다.
- **PR**: 첫 줄에 `Ref #하위`, `Parent #부모`를 적고 `Acceptance Criteria`, `변경 파일`, `검증`(기준 SHA·명령·결과·exit), `Saturn 판정`(검사 범위와 생략 범위 포함), `Rollback`을 둔다. 올바른 base/head와 필수 CI 상태를 확인한다. 하위→부모 PR에 GitHub check가 없다면 이를 명시하고 부모→milestone 통합 PR에서 전체 CI를 수행한다.
- **통합 규칙**: 하위 PR은 부모 Issue 브랜치에 통합하고, 모든 하위를 마친 뒤 부모 PR을 `milestone/v0.4.11`에 통합한다. Issue 브랜치→milestone은 squash, track→dev→main은 merge commit 원칙을 유지하며 보호 트랙에 직접 커밋하지 않는다. 한 산출물은 한 Issue와 한 통합 PR로 추적한다.

## PD 인수인계 — 2026-09-17 CJ 모델 재설정

(이력 — 아래 Sol high PD 서술은 2026-09-17 CJ 후속 지시로 Claude Opus 5 high로 대체됐다.) CJ가 부서별 모델 재설정 후 PD 인수인계를 지시했다. Mercury=Sol high, Venus=Opus 5 high(후속 확정, eli-adult 스킬 필수), Earth 신규=Astra medium/기존=Terra high, Mars/Jupiter=Opus 5 high, Saturn=Astra low(CJ light 매핑). Codex 전 부서 service_tier=default(No Fast). 프로젝트 .codex/config.toml, .claude/settings.json, worker-models.json 및 WORKER_MODELS/CLAUDE/AUTHORITY/QA_MINIMUM_POLICY에 반영했다. 계정 전역·범용 Creat2ve 원본은 변경하지 않았다. 이번 변경은 미커밋 운영 설정이며 Git stage/commit은 하지 않았다. 모델별 Worker 시험·제품 구현·QA·배포는 하지 않았다. 권한 전체 허용은 후속 CJ Comment로 재확인 대기 전환했으며 permission bypass 설정은 적용하지 않았다.

같은 작업공간 C:/Users/pc_77/orca/Digit-Duel, branch milestone/v0.4.11 (33490f9). 새 Mercury_PD: term_1d70b090-f7ff-41bf-9bdb-968fa50db7d9. 명시적 실행: `codex --model gpt-5.6-sol -c model_reasoning_effort="high" -c service_tier="default"`. 권한 정책은 CJ 재확인 전 현재 경계를 유지한다. 인계자 term_0d8fcdb6-90f9-49b1-bde5-fb7c492f21a4는 운영 종료 상태다. 또 다른 PD 생성·인계 자체 task-create/dispatch/check--wait는 하지 않는다. 다른 터미널·앱도 종료하지 않는다. 런타임 소유권은 새 업무 필요 시만 조회한다.

2026-09-16 브랜치 전환 백업 C:/dd_cdp/pd-handoff-20260916-branch-backup 및 C:/dd_cdp/track-sync-untracked-backup 보존. 기존 미커밋 운영 파일의 이번 모델 설정 이외 내용 보존. 원본 art/ 및 orca-hook-latency-report.md 접근/수정/stage/삭제 금지. 재귀삭제 차단 우회 금지. 아래 과거 Astra low PD 기록은 당시 이력이며 현재 계약은 WORKER_MODELS.md를 따른다.

## 현재 상태 — 2026-09-16 #233 완료 · 다음 CJ 지시 대기

CJ가 토큰 소모량 절감·PR 병합·Issue 종료를 승인했다. [PR #239](https://github.com/ChangjoSung/Digit-Duel/pull/239)는 milestone/v0.4.11에 squash 병합(33490f990a2cc65c56c5e4a331e0d9c9261452bd), [#233](https://github.com/ChangjoSung/Digit-Duel/issues/233)은 completed로 CLOSED다. 최신 PR head ab36425의 [필수 CI 6/6 PASS](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35071610955), Saturn Terra QA 클라이언트 309/0·서버 경계 547/0. #234~#238·dev/main 통합·배포는 별도 지시 대기다.

feature/233-combat-engine 원격·로컬 브랜치를 삭제했다. 작업 폴더 C:/Users/pc_77/orca/workspaces/Digit-Duel/feature-233-combat-engine은 병합 커밋에서 detached HEAD로 보존하며 삭제하지 않았다. 로컬·원격 milestone/v0.4.11은 33490f9다. 원본 milestone/v0.6.0·사용자 미커밋 운영 문서·C:/dd_cdp/track-sync-untracked-backup을 보존한다. 원본 art/ 및 orca-hook-latency-report.md 접근 금지, 재귀 삭제 우회 금지.

[QA·토큰 절감 실행 계약](QA_MINIMUM_POLICY.md)을 원본과 병합 트랙에 반영했다. 검사 기본 1회·출력/종료 코드 동시 수집·반복 위반 Worker 재사용 금지·단일 이벤트 대기·필요 필드만 읽기·10줄 보고·실측 사용량 분리 기록. 역할·필수 CI는 유지하고 PD 기본은 Astra low다. 이는 운영 절차이며 자동 차단기를 구현한 것은 아니다.

마지막 CI 간헐 실패(타격 이벤트 테스트의 무작위 회피)는 새 Jupiter Sonnet 5 medium ctx_bf72606d131f가 테스트 준비 조건만 수정해 1회 454/0으로 해결했다. msg_32a5c4d67964 완료 접수, archive captured·released. run run_a707c20dc15d, coordinator term_a5fd21c2-b3f5-4678-ac58-02e61c76ccb7, 마지막 runtime a1cc4a6e-5066-4b36-9fa2-d1d490771a76. 기존 Mars/Jupiter의 external_terminal retained·첫 Jupiter identity_unproven 자원은 강제 종료하지 않았다. 새 작업 때만 runtime/소유권을 조회한다. 이전 반복 검사 위반은 부서·Mercury 보고서에 보존했다.

아래는 이전 일정·인수 이력이다.

## 이전 체크포인트 — 2026-09-16 v0.4.11 일정 등록

CJ의 후속 지시로 [Milestone #15](https://github.com/ChangjoSung/Digit-Duel/milestone/15), 상위 [#232](https://github.com/ChangjoSung/Digit-Duel/issues/232)와 하위 #233~#238을 등록하고 GDD-23·24의 Milestone/Issue 링크를 연결했다. **구현·Issue 해결·QA·시뮬레이션·배포는 별도 CJ 착수 지시 대기**다. [등록 보고](../milestone/v0.4.11/reports/Mercury/registration.md)와 [Issue 인덱스](../milestone/v0.4.11/README.md)를 따른다.

원격 dev `654a6e2c1c36fe825d3242c0fe464df494ef4cdb`에서 원격/로컬 추적 트랙 `milestone/v0.4.11`을 만들었다. PR 필수·CI 6개·strict·관리자 포함·강제 push/삭제 금지를 적용했다. 현재 원본 체크아웃 `milestone/v0.6.0`과 미커밋 파일은 유지했다. 제품 커밋·PR·태그·Issue 작업 브랜치는 만들지 않았다.

Venus Claude Sonnet 5 medium이 Issue 분해만 검토했고 Mercury가 최신 기획과 대조해 운영 등록했다. `run_cb65efe78359` / `task_37f5c084264e` / `ctx_893d64252521` / `term_41e5bc12-c688-4d3c-8681-bde057c119c3`: worker_done 수신·검토·archive captured·released, reclaimable 0 확인. 현재 PD coordinator는 `term_a5fd21c2-b3f5-4678-ac58-02e61c76ccb7`, runtime은 당시 `5e758aff-724d-44ba-87c4-161fb66b4f01`이다. 새 업무가 생길 때만 현재 소유권을 다시 확인한다. 아래 미생성·Open 대기 서술은 이 지시 전 이력이다.

## Notion 문서 정리 — 2026-09-16 후속

CJ 지시로 GDD 14개를 현행 규칙·온라인 대전·v0.4.11 기획·UI/UX 4개로 정리했다. 중복 GDD 10개와 구 DIGEST 2개는 Notion 휴지통으로 이동했다. 원문·처리 목록은 [보관 기록](notion-archive/2026-09-16/README.md)에 있다. GDD-13·22는 현행 안내로 재작성했고, v0.4.11 승인 내용은 보존했다. 기획 목록 8개 보기의 표시 순서는 문서명 / 문서 유형 / Milestone / Issue / Owner / 마지막 수정이다. 실제 GitHub 일정은 짧은 링크로, v0.4.11은 기획·미생성으로 표시했다. 공용 템플릿·Creat2ve 이력은 보존했다. 새 Milestone·Issue·Worker·구현·배포·게임 QA는 시작하지 않았다.

## 이전 체크포인트 — 2026-09-16 v0.4.11 기획 정리

CJ 추가 Comment를 GDD-23에 반영하고 9장을 삭제해 1~8장으로 통합했다. GDD-24 흐름표와 GDD-13 DL71도 동기화했다. Claude 한도 우려에 따른 CJ 지시로 Opus5 Worker를 중단·release하고 PD가 마무리했다. 새 Worker는 필요 없다. Milestone·Issue Open과 구현·시뮬레이션은 CJ의 별도 지시 대기다.

CJ 문서 보관 결정에 따라 `docs/creat2ve/planning-v0411/`의 11개 파일을 [v0.4.11/planning](../milestone/v0.4.11/planning/README.md)으로 내용 변경 없이 이동했다. 앞으로도 Notion을 기획 원본으로 쓰고, Open 전 로컬 기록은 `docs/milestone/vX.Y.Z/planning/`에 보관한다. 폴더 생성은 Milestone Open을 뜻하지 않는다. 아래 Git·배포·보존 정보는 이전 확인 시점의 기록이다.

## 이전 인계 — 2026-09-14 Mercury PD 세션 인계

2026-09-14 CJ가 PD 인수인계를 지시했다. 기존 작업은 완료 상태이며 새 PD는 인수 확인 후 다음 CJ 지시를 기다린다. 오늘은 로컬 상태만 재확인했으며 아래 원격·배포 검증은 2026-09-13 기록이다. 사용자 미커밋 파일은 그대로 보존한다. 이전 coordinator handle은 runtime 변경 가능성이 있으므로 필요할 때 Orca 목록으로 재조회한다. 새 작업·재배포·추가 QA를 자동 착수하지 않는다.

CJ가 v0.4.10 배포완료·마일스톤직접종료를알렸고, 종료트랙삭제와 README PR228 최신main을진행트랙에반영요청. #217/#218 CLOSED도확인. 종료된 milestone/v0.4.10 원격·로컬삭제완료, 해당보호만삭제했고 다른보호불변.

## 최종 Git 상태

main d0bc196325102edbd8e8fb5787822a326083c389 — CJ README PR228.
dev 654a6e2c1c36fe825d3242c0fe464df494ef4cdb — main역동기화PR229, CI6PASS.
milestone/v0.5.0 dda7b3c137676abc0ab6a36b042c36a6bdd21403 — PR230, CI6PASS.
milestone/v0.6.0 2077380705e34155951a05558d470b95b42b699a — PR231, CI7PASS(F포함).
네브랜치로컬=원격. 원본현재branchmilestone/v0.6.0 HEAD2077380. 트랙기존커밋과main모두ancestor, Roblox/Unity제품폴더보존, README는CJmain원문동일. 충돌은CI브랜치필터2줄만main milestone/v*표기선택. 검증PR트리와병합트리동일.
infra/217-sync-main-roblox 및 infra/217-sync-main-unity 로컬·원격삭제, Orca/Git임시worktree제거. 이전작업브랜치4개도삭제완료. gitbranch현재main/dev/v0.5.0/v0.6.0만, gitworktree는원본1개만.
PR없는rebase는현재공유트랙PR필수/force금지/enforceadmins=true에서불가. 고유커밋18개/11개SHA재작성과강제push가필요한방식이며우회하지않았다. 이력증가원인은현재다단계merge와strict역동기화. 이슈squash·릴리스단위동기화로빈도절감권장, 정책변경은하지않음.

## 로컬 보존

원본미커밋6파일(.codex/config.toml, CLAUDE.md, docs/creat2ve/AUTHORITY.md, HANDOVER_SNAPSHOT.md, WORKER_MODELS.md, worker-models.json)은ff전후바이트동일보존검증. 단 이HANDOVER는그검증후현재기록으로치환했다. 다른파일stage/commit없음.
ff를막던미추적문서8개는 C:/dd_cdp/track-sync-untracked-backup 에백업이동후ff, 원래내용을작업공간에복원해SHA동일확인. manifest C:/dd_cdp/track-sync-untracked.json. Jupiter/public-rooms-analysis.md와Mercury/report.md는들어온tracked버전과내용이달라로컬수정으로유지됨. 원본사용자문서를새내용으로덮어써잃지않았다. 백업삭제불필요.
원본 art/ 및 orca-hook-latency-report.md 접근/수정/stage/삭제금지.
기존 C:/Users/pc_77/orca/workspaces/Digit-Duel/feature-217-public-authority 잔여폴더는지난turn자동승인정책이재귀삭제차단하여보존중. Orca/Git등록과브랜치는없다. 우회삭제금지.

## 출시 근거

웹 게임 https://digit-duel-mipa.onrender.com
v0.4.10 annotated태그17da25cf0767049e58a9ad2fb37ee6867f03d9c0/Release게시유지,태그이동금지. 이후main변경README뿐.
지난직접검증Render source main/After CI Checks Pass, mainb511a93 dep-daj8i9cs728c73b43tpg AutoDeploy41sLive. CJmain d0bc196의RenderLive는이번요청범위에서재검증하지않았음. 서비스srv-daj498mq1p3s73a31s3g FreeSingaporeNode24, build npm ci --prefix server/start npm start --prefix server/healthz.
지난health200, 게임HTML개행정규화main일치LFsha256 d7c1d92c20942eb27bf428e1870f651ea80b280570dad35192d95a7efa7b90ee. 제품파일이번변경없음.
Saturn실제Edge전투/게임승패4상태·reducedmotion약3분PASS msg_d45c86e74f12. 테스트봇174f83c 실제2게임23/0 및SaturndeltaPASS msg_643a49e6aa8b, 기존14단언유지. QA재반복·새Worker불필요.

## 외부 기록 / 역할

브랜치최종보고 https://github.com/ChangjoSung/Digit-Duel/issues/217#issuecomment-5653106574 . #217본문CJ마일스톤종료/#217218CLOSED/후속동기화명시. 마일스톤14closed.
GDD13 3cd1e7f17085817f8c35fa8548116f38 / GDD22 3d91e7f170858110bf64f7416bba2d01 Summary에CJ종료/main최신/PR229230231/트랙정리반영. 기획본문Venus소관보존. Project3ae1e7f1708580f7bb88c7ee4f511aa0/Editor8e0a8270-d0e3-407e-a7d2-b3f992f1e366/date2026-09-13유지.
Mercury Git/운영metadata만, 코드주석도Mars. 모든기존Workerreleased. Run run_a9e503daa1ce coord term_94043a14-bc80-4d29-b354-fe9af073aa23 generation2. 사용자앱/Orca재시작금지. 토큰계정%조회불가,20%내달성단정금지.
