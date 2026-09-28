# #238 Mercury 조정 원장

## 현재 — 2026-09-28 #232 통합 승인·#238 분리 PR 준비

- CJ가 마일스톤 통합과 불필요한 트리·브랜치 정리를 승인했다. #259·#260·#261·#262를 현재 PR 필수 CI 6/6 확인 뒤 milestone/v0.4.11에 순서대로 병합했다. 아래 과거 Git 승인 대기는 당시 이력이다.
- 최신 부모에서 만든 `issue-238-integration`에 기존 납품의 변경·추가 245경로만 바이트 동일 복사했다. 원본 트리에 없던 #262 부서 보고서·기획·QA 17경로는 부모에서 유지했다. 승인 아트 177개는 원본 SHA256으로 대조한다. 제품·테스트 추가 수정은 없다.
- CJ·Saturn PASS 근거는 아래 원장과 부서 보고서에 보존한다. 기록 아이콘 같은 높이 수정은 CJ 추가 플레이 QA 면제 및 자동 PASS 지시를 따른다. 현재 PR 필수 CI 확인 후 통합한다.
- 인계 링크가 참조하는 root의 승인된 운영·기획·Notion 보관 문서를 함께 포함해 누락된 내부 링크를 복구했다. 부서 문서의 링크로 오인되는 표현과 EOF만 정리했다. 원본 제품 `lobby.js:20`의 빈 줄 공백 1곳은 바이트 보존했다(기능 영향 없음·Git whitespace 경고). 아트/소스 재작성이나 검사 기준 완화는 없다.
- Render 구조 점검·최종 통합 근거의 원장은 `docs/milestone/v0.4.11/issues/232/Mercury/integration-review.md`로 정리한다. main Release·배포·Render 자원/요금 변경은 별도 CJ 지시 대상이며 Issue 댓글·새 TODO·종결은 하지 않는다.

## 이전 — 2026-09-28 기록 높이 수정·Saturn/CJ PASS / 다음 #232 통합 준비

- 최신 CJ의 기록 아이콘 높이만 수정했다. 기록은 왼쪽에서 오른쪽 이벤트 아이콘과 같은 높이이며 아이콘·최근20경기 팝업·다른 CJ PASS 영역은 유지했다. 별도 CJ 플레이 QA 면제 지시에 따라 위치 검증 뒤 CJ PASS 처리했다.
- Mars task_c1c335967917/ctx_07adbdbe68ed: game.css top:10vh 삭제·lobby.js 낡은 주석 정정. immediate followup task_5f9f9d336373/ctx_951017887690: 기존 smoke K4b 폐기된 위치 조건만 제거·승패 글자 CSS 제외 조건 유지, UI 검사1회 exit0·147/0. 자체 sec11 보고와 이전 실측 증거를 보존했다.
- 독립 Saturn task_21e8dbe017d4/ctx_6ff0862e8ea5 PASS. 320×640 = top287/287·center309/309, 432×950 = top473/473·center495/495, 둘 다 차이0·기록48×44. 실제 CDP터치, 최근20팝업, 닫기/Escape의 기록 초점 복귀, 다른L01구역 좌표 동일·가로넘침0. PD가320/432 실물 스크린샷·보고·1625경로 freeze를 직접 대조했다. 외부 증거: issue238-record-height-mars 및 issue238-record-height-saturn, pd-freeze-proof.json.
- QA 전후1625/1625 SHA·정확HEAD/status 동일, Saturn 저장소수정0. 승인177아트·실제부모262원본22파일 보존. 처음 부모비교22오탐은 uppercase manifest vs lowercase digest 하네스 오류였고 정규화 뒤 실제변경0; 실패기록을 소급하지 않았다. 이전351/0·터치12점/REVISE 원장은 보존, 이번 전체검사 반복 없음.
- Venus task_968c06466d59/ctx_6bee83a7428f가 planning·GDD13/23/24 같은높이 규칙을 동기화, PD 원문/실제사람 속성/최신날짜 재조회. PD는 Notion의 낡은 구현대기만 운영메타데이터로 정리하고 최신CJ의5초 목록·인원 집계 문구를 정확히 유지했다. 기획 의미/게임수치 변경 없음.
- 모든 새턴/GO직전/완료에 actual native argv·currentJSONL·TUI footer·turn_started+preamble+capability 확인. Mars/Venus Opus5.5/high/bypass, Saturn Sol/xhigh/default/full/never. 채택 requested/effective allnull 유지, Codex raw tier필드ABSENT와 native default 구별. 정상정산·release·정확close·ACK 완료.
- QA http://127.0.0.1:8085/ · Node45248/PG38816·55462/SMTP/계정 보존, 정적파일 수정이라 서버 재시작 없음. 게임외8084 유지. GitHub 기존4완료조건 중3체크·마지막은 Saturn/CJ PASS·CI/통합대기, OPEN·댓글0.
- 다음 #232 통합 준비는 실제 PR·HEAD·CI·변경 경로 조사와 [실행 검토안](C:/Users/pc_77/orca/Digit-Duel/docs/milestone/v0.4.11/issues/232/Mercury/integration-review.md) 작성까지 착수했다. PR269/270/271 MERGEABLE/CLEAN,269 PR6/6·270/271 현재HEAD 브랜치6/6. #262와#238를 분리한 뒤 순서통합한다. 부모262의보고/기획/QA17개를 삭제하지 않는다. Git 쓰기/병합·종결·배포·Render 자원/결제는 해당 별도 승인 전이다.

## 이전 로컬 검증 — 2026-09-28 10:56 KST CJ 8항목 수정 · 독립 로컬 QA PASS

- 방 목록 뒤로는 좌상단, 방 생성 창은 320/432에서 폭288/400·한 줄 제목·닫기44px. 로비 전체 승패→최근20경기 팝업, 참가자 준비→방장 시작→서버5초, 대기방 기존6이모티콘을 적용했다.
- 왕·동료는 그림/속성 아이콘/선택 테두리, 공격·방어 동료 신규 원본2와 런타임4를 연결했다. 배틀 시너지는 우상단 아이콘이며 실제 단계별 효과·사망 동료 왕 효과를 누르기/터치/Enter/Space로 읽는다. 팝업은 남색·파랑·금색, 결과 아래 최종 공개 말판과 상단/하단 모두 같은 방 복귀를 구현했다.
- 첫 독립 Saturn task_8780b9ed4ae3/ctx_9852b397f047은4REVISE를 발견했다. fresh Mars task_12d68c4d501d/ctx_302897b0f929가 왕 효과 안내/결과44px/감전 후공/방 생성 폭을 수리했다. 첫131검사는 신규 테스트의 미노출 함수 호출로 exit1→그 오류만 제거→131/0 exit0, 실패는 Mars 원장에 보존했다. 수정 범위는 ui.js/game.css/기존238검사/Mars보고서4개, PD 원장 외 변경0이다.
- 최종 fresh Saturn task_c18bb0123615/ctx_063657aa6e19는 **4건 모두 PASS**, 독립238검사131/0 exit0(1회), 실제 shopShow/render/lobbyCreateOpen 함수의 격리320/432 렌더·왕 안내1/2사망·터치/키보드/초점복귀·필수모달 콜백 보존을 확인했다. 기존 서버59/0·publicrooms191/0·typecheck exit0은 서버/네트워크/데이터 무변경 근거로 유지하며 재실행하지 않았다. 외부 원본 issue238-revise3-saturn/report.md·actual-browser.json·freeze-summary.json과 PD after proof에 근거가 있다.
- QA 전후 **1625/1625 경로·SHA·HEAD/status 일치**, 승인177아트177/177·부모 #262 원본22/22를 PD도 직접 재계산했다. 검수 픽스처의 경제 상태/남은 결과·FX 상태/오래된 CDP 포트 오류와 좁은 재시도는 외부 보고서에 보존했다. 계정 입장/사망/final 데이터를 주입한 실제 렌더이며 **실서버 두 계정 경기·PG 전적2경기·CJ 플레이를 대신하지 않는다**. 320 말판 칸42.1px·13행 스크롤의 기존 기하 한계는 유지한다.
- QA **http://127.0.0.1:8085/**, 서버21664·PG38816/55462, readyz200 ok(db). UI/CSS/network/lobby HTTP응답SHA=현재 디스크. 계정/DB/SMTP·마이그레이션/launcher 보존. 게임 외8084/PID4956 보존, 불필요8081/2/3·임시8771/9371·격리Chrome0.
- 모델/effort/NoFast/full access를 GO·완료 실제argv/현재JSONL/footer로 대조했다. adopted requested/effective allnull은 그대로다. **PD 메타데이터 정정: Codex turn_context 최상위 tier는 미제공이며 과거 null 표현은 정규화 관측값이었다. 명시 default는 실제argv 근거**다. 외부 감사에 PD 서명 정정과 raw필드존재=false를 보존했다. 운영 완료 사용량은 외부 settled-usage에 기록하며 reason은 output에 포함한다.
- 초기 fresh Mars task_a712a8506a9d/ctx_1fbd7d40e8ef는 시작미관측·무작업 stopped/정확close이며 정상 완료로 소급하지 않는다. 준비된 새 TUI의 실제수신/모델/권한을 확인한 뒤 위 fresh Mars로 수행했다. 완료 Worker 전원 release→정확close ptyKilled=true→deliveryACK, 실행/회수대기0·활성child터미널0(과거 retained19는 실행 상태가 아니다). Mercury 제품 코드 비작성.
- GitHub #238 기존조건1/2/3 체크·최종4 미체크, OPEN·댓글0. **CJ 수정본 QA·필수CI·PR/마일스톤 통합 대기**다. #238 stage/commit/push/PR/병합/종결/배포/Render/결제는 승인 전이다. QA 뒤 PD 운영 문서만 갱신한다.

| 문서 반영 위치 | 내용 |
|---|---|
| 현행 Notion 게임 규칙·UI 흐름 및 활성238 planning | 최신8항목·준비/5초·같은 방 복귀·아트/시너지 기준 |
| GitHub #238 기존 완료 조건 | 로컬 근거만 체크, CJ 재검수·CI/통합 미체크, 댓글 추가0 |
| Mercury 원장·양쪽 인수인계·milestone/planning README | 최신 PASS 범위·검수 주소·보존·남은 단계 |

## 이전 — 독립 QA REVISE · 4개 보완 진행 (2026-09-28)

- Venus는 최신 8항목을 현행 계획/Notion GDD13·23·24 본문과 결정 기록에 반영했고 PD가 재조회했다. Earth 공격/방어 동료 원본2와 Mars의4런타임 그림을 연결, 승인177아트 SHA177/177 유지.
- Mars 화면/동작127/0(결과 상단 뒤로도 같은 방 복귀 포함), issue12298/0·아트101/0·typecheck exit0. Jupiter 대기/준비/서버5초/같은 방 재경기 및 누락·다른 경기 번호를 중복 조회 전 거부하는59/0, publicrooms191/0·live23/0·eco47/0. 작성 부서 검증이며 Saturn/CJ 결과를 대신하지 않는다.
- 기존 서버20592만 교체→21664, QA http://127.0.0.1:8085/ readyz200 ok(db), PG38816/55462·계정/DB/SMTP·마이그레이션/launcher 보존. 헤더 뒤로 수정은 서버 재시작 뒤 동적 제공되는 클라이언트 변경이다.
- PD가 결과 헤더 뒤로의 toLobby 경로를 발견해 fresh Mars task_cd14e7e71407/ctx_1dccb38f64e6로 수정. 누락round 보완 지시는 durable enqueue와 실제 수신이 달랐으므로 같은 Jupiter의 새 task_e1f0cf285594/ctx_5268c89575f9 직접 spec으로 반영했다. 세부 실패/범위/반복 실행은 해당 부서 원장에 보존한다. Mars 출력 재확인용 PASS unittest8 반복은 QA_MINIMUM 위반으로 기록하고 재사용 없이 종료했다.
- 모델/effort/권한/preamble/capability/turn_started를 실제 현재 턴·GO·완료에서 대조. requested/effective null은 null, Codex context tier null은 argv default와 구분. 구현 Worker 전원 정상 정산/닫힘, Saturn은 fresh Sol/xhigh/default full/never로 무수정 독립 QA.
- GitHub 기존조건4개 유지·댓글0·OPEN. #238 Git 쓰기/병합/종결/배포/Render/결제 미승인. CJ 수정본 QA·필수CI/통합 대기.

- fresh Saturn task_8780b9ed4ae3/ctx_9852b397f047은 독립59/127/191 PASS·typecheck exit0이나 시너지 사망 동료 안내/결과칩44px/감전 후공 설명/432 방 만들기 폭 4항목을 REVISE했다. 외부 issue238-revise2-saturn/report.md가 원본이며 저장소 무수정1625/1625·HEAD/status·아트177/177·부모22/22를 PD도 같은 방식으로 재계산했다. PD 첫 JSON 읽기는 UTF8 BOM으로 실패, status all 옵션은 폴더 묶음이 달라 false였으며 BOM 제거·원래 status 명령으로 정상 대조했다. 검사 반복이 아니다. Saturn 정상 정산→release→정확close ptyKilled=true→ACK. 실제 Sol/xhigh/default/full/never·footer와 완료 JSONL 사용량 input12133972/cached11936000/output40055(reason16561 포함)를 외부 settled-usage에 보존했다.
- Mars 새 기동 task_a712a8506a9d/ctx_1fbd7d40e8ef는 turn_start_unobserved였다. 실제 TUI는 초기 화면이고 새 JSONL/첫 작업 응답이 없어 작업 GO 없이 worker-stop으로 capability fence·정확close ptyKilled=true 했다. 프롬프트가 초기화 중 제출됐다는 관측이며 수신/제품 작업으로 소급하지 않는다. 역할 고정 모델·high·bypass를 명시한 준비된 새 TUI에 fresh dispatch로 4항목만 수리한다.

## 이전 — 2026-09-28 07:26 KST 독립 로컬 시각 QA PASS · CJ 재확인 대기

- CJ 스케치·참조 로비를 기준으로 로그인·가입·로비·방 찾기/대기·게임 시작 말판·상점·결과를 다시 구성했다. 배틀(B04) 구성 보존, 불필요 이력·지표 토글 제거, 공식 20경기 전적 데이터 보존. Earth UI 아이콘48·배경과 누락 하수인13종을 연결했고 기존 승인 아트105개 SHA는 그대로다.
- 첫 fresh Saturn task_27b3995c15c0/ctx_f93840665082는 4원본·전 화면을 대조해 320 말판 과축소·결과 중복으로 **REVISE**했다. Mars task_fc280ea2f006/ctx_56a2a527a218가 두 화면을 수리했다: 320 말판195.5→304.2px(화면95.1%)·칸27→42.1px, 세로 스크롤로 끝줄 접근, 실제 클릭 좌표·선택·스크롤 유지 확인; 결과 승자→VS→패자→로비 버튼1개. 재대전 엔진·공식 기록·서버 final 값은 보존. 배틀 전후 재구성 픽스처 320/432 픽셀 배치는 동일(진본 전후 자료는 아님).
- Mars 검사: 238 86/0·publicrooms186/0·typecheck exit0. 옛 issue122 A8/E4는 삭제된 UI 단언으로 첫91/2였고 같은 TUI 좁은 task_70eaf03d28e6/ctx_2cee926d025d가 **테스트 두 단언만** 고쳐93/0, 첫 실패를 보존했다. 최종 fresh Saturn task_ac362fb58397/ctx_5fcb6c514d38는 참조 화면·코드·지오메트리와 238 86/0·publicrooms186/0·issue122 93/0을 독립 확인해 **로컬 시각·회귀 QA PASS**다. Saturn이 저장소 파일을 수정하지 않았고 PD 재계산으로 QA 전후1587파일 경로/SHA·HEAD/status 완전 일치, 기존105아트·부모22파일 SHA도 일치했다.
- Worker 전원은 현행 역할 모델/effort/full/never(해당 Codex NoFast)·fresh turn_started/preamble/capability·실제argv/footer를 GO/완료에 대조했다. adopted launch requested/effective ALL NULL과 Codex context tier=null은 원문대로 보존했다. 모든 task 정상 worker_done·external/retained release→정확 terminal close ptyKilled=true→delivery ACK, 현재 실행 Worker0. Mercury 제품 코드 비작성.
- GitHub #238 기존조건1/2/3은 로컬 근거로 체크, 최종조건4는 **CJ 재확인·필수CI·PR·마일스톤 통합 대기**로 미체크; 댓글0/OPEN. #238 stage/commit/push/PR·병합·종결·배포·Render 자원/결제 미승인. QA 서버 http://127.0.0.1:8085/ (PID20592)/PG55462(PID38816) readyz200 ok(db), 제품 파일 서버응답SHA 일치. 게임 외8084 보존, 계정·DB·SMTP 변경 없음. 320 칸42.1px는 44px 미만의 기하 한계이며 13행은 스크롤로 본다. Saturn의 별도 실제 로그인·두 브라우저 플레이 재연은 하지 않았고 CJ 플레이 QA가 남아 있다.

## 이전 체크포인트 — 1차 화면 구현과 7개 보완

### 이전 — 2026-09-28 05:18 KST CJ 시각 QA REVISE / 참조 기반 UI·누락 아트 재구현

현재 판정은 바로 아래 CJ 시각 REVISE다. 뒤의 이전 로컬 PASS는 기능 검증 이력이다. 현행 디자인 재구현 Worker는 진행 중이며, 이전 기능 구현 Worker만 정산했다.

### CJ 시각 REVISE — 현행 판정

- 06:29 KST 보완 진행: Mars 원작업 task_ad4dfd6666e6/ctx_9ec7a4272e08는 msg_843479d9bcda로 성공 정산됐다. 23886/0·minion208/0·234354/0·online-art101/0·26074/0, typecheck 초기4오류(exit2) 뒤 exit0,17개 오프라인 캡처·기존105아트 SHA 일치를 보고했다. 이는 기능·부분 구현 증거이며 전체 시각 PASS가 아니다. PD 실제 캡처/소스에서 320 필드3열, 시너지 설명 hover 전용, 작은 로비 원화, 결과 아래 말판 노출, 가입 입력 순서, 대기방32px 확대, 코인 글리프 결손을 확인했다.
- 해당 보완을 stable Dispatch 주소로 발송한 성공 영수증은 있으나 원작업 JSONL에 실제 본문 수신이 없었다. 미수신 원인은 미확정이다. PD의 다른 터미널을 명시한 operator peek는 count0, 명시run probe는 consumer_fenced였으며 이를 Worker 자체의 소유권 상실로 판정하지 않는다. 실제 Worker liveness·원작업 정산·cap·모델은 유효하다. 같은 TUI의 최대1회 즉시 후속 task_d6976a4bf80b/ctx_65aaf1b70c60에 7개 수리를 직접 본문으로 넣었고 새turn_started/preamble/cap·현재Opus5.5/high/bypass·JSONL·footer를 대조해 msg_f293db415863로 GO했다. GO후 PD_MAILPROBE 실제수신(count1/currentDispatch/notfenced)을 msg_65545d2d168d로 확인했다. 현재 lease는 GO06:27부터15분이며 같은 좁은 화면 범위만 허용한다. 수정 완료와 fresh Saturn 검증이 남아 있다.

- 현행 진행: Venus task_1fbf0b61bd6f/ctx_db24a25ee3e0가 원본4이미지 직접 대조·visual-alignment.md·planning·GDD13/23/24 정정을 완료했다. PD가 세 GDD를 다시 조회했고 release→정확 terminal close(ptyKilled=true)→ACK했다. 로비 하단4탭·현행 회복을 포함한 말판6행동·공식전적 아이콘 뒤 기존 목록은 Venus/PD 구현 해석이며 CJ 새 규칙으로 소급하지 않는다.
- Earth_1 task_3ab8a2db8a42/ctx_8ae39bc6520e는 실제 로비 배경·UI24아이콘·보충24아이콘·로비/상점/말판 시안과 정확 crop 계약을 완료하고 release→정확close(ptyKilled=true)→ACK했다. 현재 채택본은 lobby-pedestal-bg-v1.png, ui-icons-24-alpha-v1.png, ui-goods-lobby-24-alpha-v2.png, lobby-shop-board-proof-v2.png다. 시안 수치·캐릭터 이름은 예시이며 구현 권위가 아니다. 미리보기 배경을 불투명으로 오인해 재생성한 이력은 보존하고 실제 RGBA alpha=0 측정과 구분한다. Earth_2 task_49a162c8582f/ctx_e74d5884711a는 누락13 원화와 Mars 실제128/32 contact sheet 검토를 완료하고 release→정확close(ptyKilled=true)→ACK했다. 기존 일반20+왕/동료105파일 SHA-256을 외부 issue238-approved-art-before.json에 동결했다.
- fresh Mars task_ad4dfd6666e6/ctx_9ec7a4272e08/term_21caa00b-fe7e-4564-919e-1823bff1985f/PID14612/JSONL68aeacac는 허용 클라이언트 화면·13신규아트 디렉터리만 구현한다. 현재 Opus5.5/high/bypass argv·latest assistant model·preamble/capability·rendered footer·새 turn_started를 직접 대조한 뒤 msg_e815e8a5873d로 GO했다. adopted requested/effective ALL NULL을 보존한다. 배틀 CSS 구성 보존, 모든 이력/지표 토글 제거, 실제432/주요320 화면과 동일 fixture 배틀 전후 증거, 실제13아트 통합이 완료 조건이다. 계정/DB/API/게임규칙/Git 쓰기 변경은 범위 밖이다. 실제 화면 구현과 fresh Saturn 참조 비교가 남아 있다.

- 최신 CJ: 구현 방향성은 PASS지만 Notion CJ 스케치·참조 게임 로비와 실제 UI가 다르며, 아이콘 중심·최소 텍스트·누락 하수인 아트까지 디자인 리소스를 보강하여 구현한다. 이전 최종 판정은 기능 검증 이력이며 현재 시각/납품 PASS가 아니다.
- PD는 Notion 원본 로비 참조 PNG, 시스템/로비 스케치16340.jpg, 전투 스케치16341.jpg, 시작 상점 스케치를 직접 열었다. 현재 상점은 설명문·소형 다열 카드가 중심이고 스케치의 세로 진열·필드/가방·아이콘형 시너지/상품 구조와 다르다. 기존 계약의 Earth=goods8아이콘만·나머지 #253+CSS 제한이 필요한 아트 범위를 누락했다. 기능 회귀와 일부 화면 크기 검사로 참조 디자인 일치까지 PASS로 취급한 것은 PD 검토 오류다.
- 일반30 중 기존20만 이미지 리소스가 있으며 보호형4·땅6의 10종과 전설3종은 누락 아트 점검·제작 범위다. 기존20종·왕/동료 아트와 사용자 미커밋 파일은 보존한다. 최신 CJ로 타이틀·계정·로비·방의 시각 배치도 #238에 포함하며 기능·게임 수치·서버/DB/SMTP 계약은 바꾸지 않는다.
- 현행 Run run_67407ff72916은 Venus의 원본 대조·구현 행렬 정정, Earth_1의 시각/공용 리소스, Earth_2의 누락 하수인 신규 아트, Mars의 화면 구현, Saturn의 참조 비교+필수 회귀 순서로 진행한다. 모든 Worker는 기존 고정 모델·NoFast/full/never 계약을 적용한다. GitHub는 기존 완료 조건1/2를 미체크로 되돌리고 기능 보존 조건3은 유지, 최종 조건은 CJ REVISE로 정정했다. 댓글 추가0, Git 쓰기·병합·종결·배포·Render 미승인이다.
- 최신 추가 CJ: 로그인·회원가입·메인 로비·멀티 방 찾기·대기 로비·게임 시작 메인·상점이 모두 불일치이며 유일하게 배틀 화면만 맞는다. 따라서 배틀 배치·네 행동 구성은 보존하고, 전투/공개 기록·경기 지표 등 결과창과 다른 화면의 불필요한 이력 토글은 제거한다. 서버 공식 전적 데이터 삭제로 확대하지 않는다. msg_a8ec03825a73/msg_0e55358a9b9e로 Venus/Earth_1에 바로 전달했다.

### 최종 판정

- 전체 경기 UI 구현과 첫 감사의 네 가지 수리는 별도 독립 QA에서 PASS다. 추가 온라인 준비 이동 수리도 fresh Saturn task_1417ef22cd6c/ctx_309ea9209723에서 기존238 77/0(1회)와 독립 인메모리38단언 PASS로 확인했다(msg_c727a1282a70, msg_537c4bf58b8e). 두 좌석의 실제 Room 좌석 뷰 수화·서버 단계 고정·지연 호출·확인/취소·leave 후 close·자동 배치·PVE를 검증했다. 자동 배치된 손님 좌석에 추가 배치 시계가 생기지 않는다.
- Saturn 파일 수정0·작성 보고서0, PD도 전체1452파일 SHA/경로 집합·HEAD·status 전후 동일을 독립 확인했다. 최초 inline probe는 PowerShell의 한국어 문자열 변형으로 파싱 전에 실패했고 ASCII-only 입력 재시도에서 통과했다. 브라우저 기본 disabled 클릭 차단은 추론이며 실제 핸들러 호출 차단은 검증했다. 현재 두 계정 브라우저 플레이와 필수CI/PR/통합은 미검증이다. 대표320/432px PNG는 앞선 수리 전 화면 자료이며 최신 온라인 E2E 증거로 쓰지 않는다.
- 현재 Sol/xhigh/full/never/default argv PID28804·JSONL01a0e3d7 최신context tier=null·rendered footer·새 turn_started/preamble/capability를 GO와 완료 때 직접 대조했다. 처음 status의 area=QA/mutation=none은 Task의 QUALITY/readonly로 정정·selfACK한 뒤 실행했다. requested/effective allnull은 보존한다. 정확한 worker_done 정산 후 release external/retained/processActionnone→해당 terminal close ptyKilled=true→Delivery ACK를 확인했다. Run의 reclaimable Worker=0이며 이미 닫힌 외부 TUI 행의 retained 표시는 실행 중 증거로 바꾸지 않는다.
- 신규 변경은 모두 미커밋이다. #262 parent 원본22파일은 무변경, 계정·DB·SMTP 보존이다. 현재 QA용8085/PID20592와 PG55462/PID38816만 실행하고 /readyz 200·ok(db)를 확인했다. 이전8081/2/3·PG55459/60/61은 종료했고 게임 외 plasticd8084/PID4956은 유지한다. CJ는 Orca·Chrome의 서로 다른 계정으로 확인한다.
- 추가 세션 사용량: Mars7af47f4f(assistant ID33) uncached66/cacheCreate134774/cacheRead4373081/output22534; Saturn01a0e3bf(수리QA+정적후속 한 세션) input5610842/cached5442048/output24111/reasoning11238; Saturn01a0e3d7 input3679042/cached3543424/output20861/reasoning7955. 외부 settled-usage JSON에 원시 필드를 저장했고 Codex reason은 output의 부분값으로 중복 합산하지 않는다. 전체 PD 사용량과 절감률은 미측정이다.

| 문서 반영 위치 | 내용 |
|---|---|
| 현행 Notion GDD13/23/24와 활성238 planning | CJ 방 나가기=즉시 경기 전 취소·공식 전적 미기록, 승인된 화면 이동 유지 |
| GitHub #238 기존 완료 조건 | 로컬 검증 조건만 체크, CJ·CI·PR·통합 조건 미체크, 댓글 추가 없음 |
| Mercury 원장·인수인계·milestone/planning README | 현재 독립 로컬 PASS와 검수 주소·보존·남은 단계로 치환 |

### 온라인 배치 이동 대조 — 02:05

- fresh Saturn task_24d11104a62c/ctx_7fad71b5fefb는 네 가지 수리만 독립 PASS(신규238 59/0, runtime80/0, battle-fx1813/0 각1회 exit0)로 확인했다. 추가 인메모리 검증의 초기 NET.fxDisp 누락·PowerShell 한국어 입력·남은 모달 노드 개수 가정 오류는 수정 후 확인했으며 msg_69ffec41160a에 보존했다. 전체 이슈·CJ·CI PASS가 아니다.
- PD가 승인된 S02 뒤로/Esc 없음과 배치 편집 예외의 충돌을 뒤늦게 대조했다. 동일 Saturn TUI의 최대1회 정적 후속 task_d37b3e38cab4/ctx_f70b072f92c2가 실제 기본 온라인 경제 방의 shop.done→UI.prep=place·ready=false 경로를 증명했다(msg_6750f5fdbf4d). 헤더와01탭이 닫힌 시작 상점으로 돌아간다. 테스트 H5의 수동 상태만으로는 드러나지 않았던 결함이다. PD의 앞선 예외 수용은 GDD 승인으로 소급하지 않는다.
- 두 Saturn 턴 모두 소스·검사 파일 수정0이며 PD가 전체1451파일 SHA·경로집합·HEAD·status 전후 동일을 독립 확인했다. 현재 PID676 argv·Sol/xhigh footer·최신 turn_context full/never/tier=null과 명시 default, 새 preamble/turn_started를 대조했다. 정적 감사 성공 정산은 검토 완료이며 제품 판정은 REVISE다. release external/retained/processActionnone 뒤 정확 terminal close ptyKilled=true와 Delivery ACK를 확인했다.
- fresh Mars task_9860b893d100/ctx_09d271470e00/term_c7c33d03-616f-4a7c-bd22-1e9cdc0c9006/PID3340/JSONL7af47f4f가 ui.js·기존238검사·prep-flow.md 3파일만 수리한다. 실제 서버 상태로 경제 준비 탭을 제한하고 모든 경기 전 명시 출구를 확인→leave로 통일한다. PVE·타이머·서버·계정·DB 변경은 없다. Opus5.5/high/bypass argv·현재JSONL·새 turn_started/preamble/capability·rendered bypass footer를 GO 직전 확인했다. adopted requested/effective는 모두null이며 provider reasoning도null이다.
- PD 정산 측정의 JSONL 읽기에서 UTF8 생략으로 디코딩 오류가 발생했다. 실제 파일 손상으로 분류하지 않으며 명시UTF8로 제한 재확인한다. 잘못된 이전 #262 세션의 PD 사용량 귀속은 UNVERIFIED로 정정했고 #238 PD 측정에서 제외한다.
- 02:09 추가 수리 완료(msg_498bee8492e7): uiPubPlacing를 제거하고 공개 방 경기 전 헤더를 확인→leave로 통일했다. uiPrepLock/uiPrepSync가 서버 좌석 뷰의 shop.done[0]을 따라 표시·탭을 제한하며 PVE와 비경제 레거시는 보존한다. 기존238 검사에 실제 Room 좌석 뷰 수화 검증을 추가했다. 1차 테스트의 tutOverlay 초기 상태 누락1실패를 수정한 뒤 2차77/0 exit0, 시그니처 무변경으로 typecheck·다른 스위트 미실행. Worker가 금지된 읽기 전용 git show/diff --stat 각1회를 실행한 이력을 보존하며 쓰기0이다. 현재 argv·JSONL·bypass footer를 완료 대조하고 release→exact terminal close ptyKilled=true→ACK했다. fresh Saturn은 이 추가 변경만 검증한다.

- CJ가 #262 HP 수정 최종 QA PASS·불필요 서버 종료·다음 Work 구현 시작을 지시했다. 다음은 #238 경기 UI System 전면 교체다. #262 제품·사용자 dirty/untracked를 보존하고 별도 child `issue-238-game-ui`/`ChangjoSung/issue-238-game-ui`를 e1bfdc2에서 만들었다. #250 기준5435b40 포함 gate exit0, 프로젝트 Sol/xhigh/default·Opus5.5/high 모델 표/설정을 직접 확인했다. Git 쓰기·마일스톤 병합·Issue close·배포·Render는 별도 승인 전이다.
- 완료된 QA 웹8081/PID36888·8082/42336·8083/6688·8085/8136 및 PG55459/34176·55460/31704·55461/26768·55462/26244를 기존 관리 도구로 정지했다. 계정·DB 데이터·SMTP 설정은 보존했다. 8084/PID4956은 게임이 아닌 plasticd.exe이므로 유지했다. 최종 listen 조회는8084만 확인했다. #259 stop.ps1 첫 직접 호출은 로컬 실행 정책으로 거부됐고, 해당1회 PowerShell 프로세스만 Bypass로 실행해 정상 정지했다. 전역 정책 변경0이다.
- #262의 미커밋 client/tooling13파일·server9파일을 역할별로 상속했다. PD가 22/22 원본·자식 SHA-256 일치를 직접 확인했고 외부 `issue238-inherited262-source-before.json`에 전체 해시를 보존했다. 원본 무변경, 상속 기준과 #238 추가 변경은 구별한다.
- run_1f7e5c44e0c1: Venus task_f6bff916e1ab/ctx_2e24a309c630/PID13952/JSONL2d2a7feb, Mars task_d5956f51e88a/ctx_93849e074807/PID17252/788021c2, Jupiter task_6f915f5b2394/ctx_0d4f34c19bc1/PID40648/74fd4849. 모두 명시Opus5.5/high/bypass argv·현재JSONL·초기high header·실제bypass footer·turn_started/preamble 수신을 시작과 GO에 대조했다. adopted requested/effective는 모두null이다. Venus가 별도 관측값을 requested/effective처럼 쓰려던 preflight 문구를 PD가 정정했다. Venus PLAN GO, Mars/Jupiter COPY GO 후 분석·FULL GO 대기이며 Saturn은 구현 동결 후 fresh Sol/xhigh/default 읽기 전용으로 진행한다.
- Venus는 eli-adult 필수·기술 범위 Ponytail lite, Mars/Jupiter는 Ponytail full. Earth는 공용 #253 아트를 먼저 재사용하고 새로운 자산이 필요한 정확한 범위만 별도 ART 역할로 맡긴다. 이모티콘 위치·크기 개선, 공개 전 상대%/전투양쪽현재·최대/전투후현재HP, 타이머90/30/60, 비공개 정보·입력 잠금·PVE 규칙을 보존한다.
- CJ 최신 답변 “방 나가기 규칙은 권장 방향으로 진행합니다.”에 따라 시작 상점의 명시적 나가기는 즉시 경기 취소·공식 전적 미기록으로 확정했다. 몰수패·이탈 횟수 기록은 추가하지 않는다. 브라우저 종료의 기존 단절 경로와 구별한다. Venus에 GDD 본문·Decision Log·로컬 행렬의 미결 문구 치환을 전달했다. 모션 수치는 Venus 제안이며 계정·로비·방 목록 개편은 범위 밖이다.
- Mars/Jupiter FULLGO 직전에 PID·Opus5.5/high/full access 명시 인수·현재 JSONL 응답·rendered bypass footer를 재확인했다. 시작 상점 상품 8종은 Mars의 `data.js` 변경을 기존 Core·서버가 공유하며, 티켓 사용은 정기 상점 전용 그대로다. Mars 검사는 직접 영향 8개, Jupiter 4개를 각각 1회로 제한했다. 가상 고갈의 기존 예비 재화 안전장치는 보존한다.
- S04의 “전체 하수인”은 필드9(사망 포함)+가방3 이하로 구현한다는 PD·Venus 해석을 채택했다(CJ가 가방을 직접 명시한 것은 아님). `data.final.sides`는 FINISHED에서만 `{seat,pieces,bag,syn}`을 보내고 상대 등급·미사용 스킬은 계속 비공개, HP는 개체 hpSeen 규칙을 따른다. source `Core.synView`를 복제하며 UI 재계산은 없다. Jupiter 최초 작업은 139/133/64/74 PASS, 237/262 첫 모듈 부재·237 새 테스트 블록 위치 오류 뒤 관련 검사만 재시도한 이력을 보고서에 보존했다. 골든 변경0이다.
- Venus 원작업은 2문서/GDD13·23·24 동기화로 succeeded였다. 마지막 PD 해석 수락이 완료 직전에 전달되어 미결 표기가 남아, 같은 역할의 즉시 후속 task_349d5979313c/ctx_b4475f4cf904로 이 2문서와 GDD의 현재 문구만 정정한다. 읽기 전용 git status 1회 실행 실수(쓰기0)는 별도 기록했다. PD가 세 Notion 원문을 직접 재조회해 S01 취소 결정과 최종 QA를 확인했다.
- 전투원 A/D의 cast 전달은 원 서버 작업 종료와 겹쳐 즉시 후속 task_39fd3f39baf0/ctx_70ffab0e94f3로 진행했다. PD가 실제로 없는 테스트 파일명을 지시한 오류를 Jupiter가 찾아 기존 `test-battle-fx.js`로 정정했다. 서버의 두 번째 화이트리스트도 필요한 것을 확인해 engine.js·room.js·기존FX 테스트·Jupiter 보고 4파일로 승인 범위를 좁혀 갱신했다. 유효 A/D·잘못된 값 제거를 두 필터에서 검증, 1회 501/0·exit0이다. 두 역할의 후속은 각 새 turn_started/모델·실제 footer/새 preamble을 대조했고 succeeded 후 release·정확 terminal close(ptyKilled=true)로 정산했다.
- Earth task_4d4205d9c17f/ctx_0b179a326764는 Astra/medium/default/full/never 명시 PID13036과 current turn_context·rendered footer를 대조한 뒤 상품8종 SVG192×24·리뷰SVG/PNG·보고 4자산만 제작했다. 실제 계정107dfa1d의 현재 기록을 찾았고 turn_context tier와 adopted requested/effective는 null로 보존했다(default 인수 증거와 구별). PD가24px/4배 프리뷰를 직접 확인했으며 이후 release·정확 close(ptyKilled=true)로 종료했다. Mars에 byte copy/CSS 연결을 맡겼다. 새 미디어의 기존 저작권 제외 원칙을 child ASSET-LICENSE.md의 #238 Earth 경로에 명시했다. 추가 상품 배지·프레임·스킬 비트맵은 제작하지 않았다.
- PD는 resultSeatsHtml의 단계 계산 중복을 정적으로 확인해 source Core 집계·단계만 표시하도록 Mars에 수리를 전달했다. 실제 UI 통합 뒤 fresh Saturn 읽기 전용 검증 전까지 전체 QA PASS를 주장하지 않는다.
- Mars가 온라인 B04의 내 시너지 칩을 서버 정보 부재로 생략하려던 미완료 범위를 PD가 확인했다. 현행 구현 행렬에 포함된 기능이므로 defer하지 않고 fresh Jupiter task_fa54baa881f4/ctx_4eb1740918c4에 소유자 전투 스냅샷 하나만 전달하는 수리를 맡겼다. 클라이언트/서버 소유권을 유지하고 상대 집계는 보내지 않으며, 기존237 테스트에서 참조 분리·소유자 범위·전투 밖 부재를 1회 검증한다. Mars는 단일8085 preview GO를 이미 받았으나 다시 질문해 기존 승인 메시지 확인을 전달했다.
- 직접 fetch한 GDD-23/24를 외부 `issue238-gdd23-current.md`/`issue238-gdd24-current.md`로 전달했다. 첫 대용량 shell here-string 내보내기는 Windows command 길이로 생성 실패해 apply_patch로 메타데이터 파일만 작성했다. GitHub #238은 목표·확정 범위·기존 완료 조건4개·연계만 치환했고 새 댓글0이다. #262 기존 완료 조건의 QA 현황만 CJ 최종PASS로 갱신했으며 CI·PR 조건은 미체크다.

## 독립 QA — 2026-09-28 01:29 KST REVISE / 최소 수리 진행
- Saturn task_04016659a7e6 / ctx_23c64121fb25 / term_96a24b42-f689-4e89-9274-49ec8a13fafe, PID7728, 실제계정107dfa1d의 rollout01a0e3a5. 현재 turn_context Sol/xhigh/full/never와 tier=null, 명시 argv default·현재 Sol footer·새 turn_started/preamble/capability를 GO와 완료 때 직접 대조했다. requested/effective null은 그대로다. 성공 정산은 감사 완료이며 제품 판정은 REVISE다.
- 1회 검사: 신규238 52/0, 경제144/0, battle-fx504/0 (각 exit0), runtime-contract72/2 (exit1). 320/432px 대표 PNG를 검토했다. 파일 수정0, 보고서 미작성. source manifest1449파일·전체 경로 집합·status·HEAD(e1bfdc2)가 전후 동일함을 Saturn과 PD가 독립 확인했다.
- 필수 수리① runtime-contract seeds44/55의 FX 고정 해시가 승인된 cast 태그를 반영하지 못한다. 상태·로그·지표·경로·쌍둥이 엔진 검사는 통과했다. 새 cast만 제거한 복제 이벤트가 기존 해시와 같은지 증명하고 고정값·기존 검증을 유지한다. 단순 기대값 낮추기는 하지 않는다.
- 필수 수리② netFxApplyMsgFx가 cast를 소비하지 않아 온라인 30+3종 연출이 누락된다. 전설의 이미 공개된 종 식별도 battle/FX scene에서 클라이언트까지 연결해야 한다. 기존 rosterId/artRosterId와 Core의 공개 종 키만 쓰고 원시 legend·등급·미사용 스킬은 추가하지 않는다.
- 필수 수리③ X03의 로컬60초 자동 포기는 서버 권위 만료 계약과 다르다. 서버 응답까지 기존 간격으로 재시도하며 접속 복원/권위 오류에만 화면을 전이한다.
- 필수 수리④ S01 상단 로비 버튼은 일반 toLobby→socketclose로 넘어가 명시 leave 명령을 보내지 않았다. 상점·배치의 모든 명시 출구를 확인→기존 netLeaveRoom으로 통일해 즉시 취소한다. PVE·경기 중 기권과 잠금은 보존한다.
- 감사 에스컬레이션 msg_4dfc204a20da / msg_ec5416370431 / msg_4abba2bb73ff, 완료 msg_b1da490ab0cc. release retained/external/processActionnone 뒤 정확한 terminal close ptyKilled=true와 Delivery ACK를 확인했다.
- fresh Jupiter task_43f25e3aca79/ctx_cfba85929bef/PID7732/JSONL8b12f919와 Mars task_74f420535aab/ctx_6dc0c5658ca9가 분리된 server/client 소유권으로 수리한다. Jupiter는 runtime·FX 계약과 공개 종 식별, Mars는 온라인 소비·X03·상단 나가기를 맡는다. 새 검사 도구/상품·HP·계정 규칙 변경이나 전체 스위트 반복은 허용하지 않는다.
- 감사 경과: 초기 freeze는 Git의 한글 경로 인용으로 실패해 core.quotepath=false 1회 읽기 인수로 재시도했고 원본 수정0이다. Saturn의 첫 파일 집합 확인도 Unicode 디코딩 예외였으며 명시 UTF8로 확인했다. PD의 출력 마스킹 누락으로 종료된 Dispatch의 capability가 도구 출력에 포함된 실수를 기록한다(이미 종료·철회된 값, 문서에 값 미기재).
- 현재 8085/PID38552·PG55462/PID38816만 게임 검수용으로 열려 있고 / 및 /readyz 200·ok(db)를 확인했다. 이전8081/2/3·PG55459/60/61은 종료, DB·계정·SMTP 보존, 게임 외 plasticd8084 유지. 온라인 두 계정 CJ 플레이·필수 CI/PR·통합은 미검증이다.

- 01:42 수리 완료: Jupiter runtime80/0·battle-fx1962/0, cast만 제거하면 종전 FX 해시가 같은 것을 수정 전·전설 연결 후 좁은 진단에서 확인했다(초기 CRLF 추출 오류·새 privacy 단언12실패 후 관련 재시도 이력은 runtime-fx-contract.md). Mars 신규23859/0·온라인FX소비133/0·공개방186/0·타입검사exit0(공용 castFx 시그니처 변경 근거)으로 온라인 발동·전설 본체/대리·가짜시계61/121초·명시leave명령후close를 확인했다. 수정은 server5파일/client6파일 분담이며 기존범위 밖 변경0이다. 두 fresh 역할의 현재 Opus5.5/high/bypass argv·JSONL·footer를 완료 때 대조하고 release→정확 terminal close ptyKilled=true→Delivery ACK로 정산했다. 현재8085/PID20592·PG55462/PID38816만 게임 QA에 사용한다. 각 수리 보고서를 근거로 fresh Saturn 읽기 전용 좁은 재검증을 진행하며 아직 전체 로컬 PASS는 아니다.
