# [피드백][결정] #293 CJ QA REVISE — 수정·독립 검증·QA 배포 보고

- 확인 시각: **2026-10-01 20:19 KST(11:19 UTC)**. **7건 수정 구현·Saturn 독립 읽기 전용 검증·배포 소스 CI 6/6 PASS·QA 재배포 완료. CJ 플레이 QA는 REVISE 후 재테스트 대기다.** [QA 사이트](https://digit-duel-mipa-qa.onrender.com/?qa=0a132ec)의 실행 소스는 `0a132ecdc8783007bc91b99fde596ec68ff89666`이다. 자동 배포 Off이므로 후속 운영 문서 커밋은 실행 제품을 변경하지 않는다. #293 OPEN·PR305 Draft 유지.
- 입력: [CJ 최신 7건 원문과 원본 이미지 6장](../references/CJ_QA_REVISE_20261001.md). CJ 추가 응답으로, 180초 만료 시 판매로 진열이 부족하면 **예비 코인으로 새로고침 1회 후 무작위 구매·배치**한다.
- 분석: Venus·Mars·Jupiter가 `469b279e1866b4fb8019a93b6aa5cb17086e37cb`를 독립 정적 읽기로 확인했다. 세 역할 모두 테스트 실행 0·파일 수정 0. 실제 응답 모델 `claude-opus-5-5`, native argv `--effort high --dangerously-skip-permissions` 확인.

| CJ 항목 | 확인된 원인 | 최종 적용 |
|---|---|---|
| 1 공통 180초 | 서버 좌석별 단계 변경 시 새 90초, 로컬도 단계별 시계 | 방의 공통 서버 마감 1회. 단계 전환·준비/취소·재접속·단절 유예로 재발급 없음. 양쪽 준비 시 조기 시작. 만료 시 유효 진열 구매 후 부족하면 예비 코인 유료 새로고침 1회·무작위 구매·배치. 로컬 경제 모드도 공통 180초 |
| 2 준비 현황 | 상대 왼쪽 상자·보드 아래 문구, 단계 공개 부족 | 진행 막대 P1/P2 단계 표식, 이전 상자/아래 문구 삭제. 보드 중앙 불투명 팝업, 기존 우상단 준비 취소로 서버 ready 해제·재배치 |
| 3 즉시 판매 | Core의 필드 빈칸/구매 가능 진열 수 비교 가드 | 해당 가드만 삭제. 구매 직후 품절 상태에서도 판매 가능. 100% 환급·판매 종 잠금·HP·예비 재화 보호 유지 |
| 4 무료 속성 변경 | 티켓 수 양수일 때만 표시 | 시작 상점 왕·동료 제목에 티켓 아이콘+무료 상시 표시. 실제 소모 없음, 정기 상점 규칙 유지 |
| 5 판매 확인 삭제 | 필드·가방 판매 confirm | 두 판매 확인만 삭제. 코인/카드 즉시 반영, 다른 확인 유지 |
| 6 말 표시 | 기본 왕국·별칭 누락, 상대 HP % 변환, 정보 부족 | 왕국 좌상단·하수인 아키타입/왕·동료 실제 역할 우상단·초상 중앙·하트 실제 HP 하단. 트레이/보드/결과 등급 배경색·별 삭제. 미선택 왕·동료 왕국과 시너지 수치 일치. 공개된 양쪽 실제 HP·회복/결과 표시, 숨긴 상대 ? 보존 |
| 7 개인 시너지 | 왕국·아키타입 11개만 표시 | 소유한 활성 전설 실제 효과와 왕·동료 해금 0/1/2를 레일·경기 칩에 표시. 없는 효과·미소유·비활성 전설 미표시 |

왕·동료는 실제 아키타입 데이터가 없어 역할을 표시하고 가상의 속성을 만들지 않았다. 현재 Core에는 가방 전용 전설 개인 효과가 없으며 기존 가방 아키타입 +1 기여는 유지한다. 포획 최대 HP 30% 문구/판정과 HP 비율 심판 계산·동률 규칙은 유지하고 실제 HP의 % 표현만 제거했다. `DD_ECONOMY=0` 고전 롤백은 이번 범위 밖이다.

## 검증·배포 증거와 한계

- [Saturn 독립 검증](qa-revise-saturn.md): 고정 소스 `0a132ec`, 13AC·코드·자동 검사·대표 화면 범위 PASS. 승인 검사 총5회 모두 exit0, 파일 수정0. 실제 두 브라우저/CJ 플레이 QA PASS를 뜻하지 않는다.
- 배포 소스 [CI 36852910772](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36852910772): A·B·B2·C·D·E 6/6 SUCCESS. 첫 B는 기존 #217 라이브 테스트 T3 텔레포트 커버리지0으로 실패(22/1, 게임 오류0·완주2건). 직전 72ed 소스 CI6/6이고 최종 변경은 CSS/시각 문서뿐이므로 실패 job만 한 번 재시도했다. 단언을 완화하지 않았고 커버리지 변동 원인은 해결됐다고 주장하지 않는다.
- 최초 9322 소스 CI E3/E10/E12는 옛 개인90초·단절 중 정지 기대였다. Mars가 공통 마감 기준으로 해당 기대를 정정하고 E3b/E12b를 추가했다. 기존 단절 유예·차단 조건을 보존했고 후속 CI가 통과했다.
- 작성자 검사·실패·정정·실행 수는 [Mars 시각 기록](../Mars/qa-revise-visual/README.md)·[Mars 구현](../Mars/report.md)·[Jupiter 구현](../Jupiter/qa-revise-implementation.md)에 기록했다. 최종 #293 99/0, 서버 경제173/0, 준비 타이머147/0, 구문/typecheck 통과. 겹치는 검사를 독립 검증 수로 합산하지 않는다.
- 후속 문서 커밋 c98650b의 CI는 제품 검사5개 통과·문서C 실패였다. Mercury가 Jupiter 보고 파일명을 두 곳에서 잘못 참조한 원인으로, 실제 `qa-revise-implementation.md` 링크로 정정했다. 검사기/제품 코드/단언 변경 없이 후속 문서 HEAD의 필수CI를 확인한다.
- Render deploy `dep-dav4168jo6nc73fdma9g`: 20:14:33 KST 요청 → **20:15:29 KST live**, get_deploy로 정확한 소스 `0a132ecdc8783007bc91b99fde596ec68ff89666` 확인.
- 20:19:17 KST 실제 `/`·`/healthz`·`/readyz` 모두200, `ok`·`ok (no db)`, Cache-Control no-store. 제공 data/core/ui/network/game.css 5개 모두 배포 Git blob과 바이트 동일. CSS SHA-256 `e926ca1d91885541cd14246451cb218cd54d6964b1d01ec116c2741472e93ecf`.
- Orca QA 페이지 `917e6a93-3c03-4f3f-9e2b-220323d3151f`를 열고 실제 홈·스크립트 로드·AUTH off를 읽었다. 홈 준비 상태 확인이며 두 브라우저 경기 증거로 확대하지 않는다.

화면은 로컬 합성 상태이며 준비 팝업 NET 값도 모의 상태다. 최신 [중앙 팝업320px](../Mars/qa-revise-visual/s8-anchor-ready-320-mobile.png)·[390px](../Mars/qa-revise-visual/s8-anchor-ready-390-classic.png)은 보드 중심 오차0·우상단 취소86×44, [배치 카드390px](../Mars/qa-revise-visual/s9-placed-opacity-390.png)·[320px](../Mars/qa-revise-visual/s9-placed-opacity-320.png)은 disabled 조상/fallback/HP 불투명도1·보드와 트레이 등급 배경 일치를 확인했다. 로컬 캡처 CSS 원시 해시는 CRLF 기준, 배포는 Git LF 기준이다. s1~s7은 이전 단계 증거이며 최신 팝업/불투명도는 s8/s9를 따른다.

**남은 관측 한계:** 실제 양쪽 브라우저 공통 마감/조기 시작/판매/만료, 넓은 PC 화면, 결과·개인 전설 화면, 로컬180초 실제 진행, 320px 보드 끝 접근은 CJ 플레이 QA로 확인한다. fallback 이름/왕국 glyph에 배치 체크가 겹치는 비차단 시각 사항도 R-10에서 확인한다.

## 작업 기준과 보존

현재 WorkTree는 `003dc8a0-372c-4547-9290-31d34edd82be::C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-293-start-flow-concept`, 브랜치 `ChangjoSung/issue-293-start-flow-concept`다. 새 WorkTree는 만들지 않았다. 새 fetch 후 origin/milestone/v0.4.13=`4f638a12dbab5e85b5b3b8d1d50ab17d029ea5b3`, main=origin/main=`9b306bbfda103263cb2feea90fd9c89527eb9290`를 확인했다.

main의 미커밋 모델 계약 6파일·unity/·stash 2건·b44e302 handoff 브랜치를 보존했다. #293 OPEN·PR #305 Draft 유지, #294/#295 전체 개편/#296은 이번 수정과 별도다. main Release·운영 Render·유료 자원 변경은 하지 않았다. 최신 Release v0.4.12.

Render MCP는 기존 OAuth 재인증 후 실제 읽기·배포 호출 성공. 현재 QA `srv-dauvf1m0tbcc73ctepsg`는 Free/Singapore/Node24·이슈 브랜치·자동 배포 Off로 최신 `0a132ec`를 실행한다. 운영 `srv-daj498mq1p3s73a31s3g` 재조회는 main/0.5c-512mb/updatedAt `2026-09-29T09:52:02.172686Z` 보존을 확인했다. 옛 QA `srv-datq2ou0tbcc73eril0g` 삭제/404 이력은 유지하며 이번에는 현재 Free QA만 재배포했다.

운영 증거: `C:/Users/pc_77/orca/archives/Digit-Duel/issue293-qa-revise-20261001/`에 각 역할 실행·모델·실제 응답·정적 분석과 보존 검증을 기록한다. 실행 토큰/비용은 확인 가능한 원시 계측만 사용한다.


## CJ QA Test List

위 QA 주소를 새로 열어 사용한다. 기존 QA 탭은 닫고 다시 접속한다. PC 일반+시크릿 또는 PC+휴대폰처럼 저장 공간이 독립된 두 세션에서 `시작 → 멀티 → 방장 방 만들기 → 상대 참가/준비 → 방장 시작`으로 같은 방에 들어간다. QA는 DB 없는 게스트 환경이며 계정·영구 전적 검증은 포함하지 않는다.

| ID | 조작 | 기대 결과 |
|---|---|---|
| R-01 | 양쪽 시작 상점 진입, 한쪽만 배치로 전환 | 양쪽 공통 180초가 한 번만 시작. 단계 전환으로 시간이 늘어나지 않고 같은 마감으로 감소 |
| R-02 | 한쪽 준비 완료 → 준비 취소 → 재배치, 필요하면 재접속 | 시계 재발급 없음. 양쪽 단계 표식이 진행 막대에 표시, 중앙 준비 대기 팝업과 우상단 취소가 실제 상태와 일치 |
| R-03 | 양쪽이 180초 전에 배치 완료 | 양쪽 준비 확인 후 즉시 경기 시작 |
| R-04 | 시작 상점에서 6개 구매 후 바로 판매, 필드 빈칸과 품절 진열을 남겨 180초 만료 | 새로고침 전에도 판매 가능. 만료 시 필요한 경우 예비 코인으로 새로고침 1회·구매·배치 후 게임 시작, 방이 닫히거나 새 90초를 받지 않음 |
| R-05 | 필드·가방 하수인 판매 | 확인 창 없이 요청 한 번, 코인 증가 및 필드/가방 반영. 가방 교체·판매는 한 줄, 교체는 기존 동작 유지 |
| R-06 | 시작 상점 왕·동료 속성 제목 확인, 선택하지 않고 배치로 이동 | 티켓 아이콘·무료 표시, 실제 티켓 소모 없음. 미선택 왕·동료도 배정 왕국 아이콘·HP 표시. 정기 상점은 기존 티켓 수량·사용 규칙 유지 |
| R-07 | 하수인·왕·동료를 트레이에서 보드에 배치, 땅/풀 등 속성 확인 | 왕국 왼쪽 위·아키타입/실제 왕·동료 역할 오른쪽 위·HP 아래. 하수인 등급 배경색, 트레이/보드/결과 말 얼굴 별 삭제 |
| R-08 | 공개된 상대 말과 내 말의 보드·결과·회복 로그 확인 | 실제 HP 숫자, HP % 없음. 정체 미공개 ? 말은 계속 비공개, 피해/기술 설명의 정상 확률 수치는 유지 |
| R-09 | 시너지 열·경기 중 시너지 줄 확인, 전설 보유·활성 상태와 동료 사망 상태 비교 | 소유·활성 전설만 개인 칩 표시. 현재 가방 전용 개인 효과는 없으므로 없는 효과를 표시하지 않음. 왕·동료 칩은 동료 사망 0/1/2에 맞게 표시 |
| R-10 | 휴대폰 세로(390px·320px)와 PC에서 상점·배치·완료 확인 | 상단 시간/코인·진행 버튼/표식 읽힘, 팝업이 상단 바를 가리지 않음. 겹침·잘림·잘못된 상태 표시 없음, 보드 마지막 행에 배치 가능 |

결과는 CJ Comment에 `PASS / REVISE + R-ID + 조작 순서 + 기대/실제 + 스크린샷`으로 접수한다. #293 Issue 댓글을 새로 만들지 않는다.

## 문서 반영 위치

| 기준 | 반영 위치·실제 확인 |
|---|---|
| CJ 7건·추가 응답·원본6장 | [최신 원문](../references/CJ_QA_REVISE_20261001.md), 원본 바이트 보존 |
| 선행 계약·13AC·분석 | [Venus 계약](../Venus/implementation-contract.md)·[분석](../Venus/analysis.md), 구현 전 계약 `8594d27c2e48f14ff4ccbe31a872b44bf0d37868` |
| 기존 시각 계약 | [Earth UI_CONTRACT](../Earth/UI_CONTRACT.md): grade 배경·실제 역할·44px·header 취소·보드 중심 |
| 구현·대표 화면 | [Mars](../Mars/report.md)·[시각 기록](../Mars/qa-revise-visual/README.md)·[Jupiter](../Jupiter/qa-revise-implementation.md) |
| GDD-13 | [Decision Log](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38): 최신 CJ 결정·운영 기준, edited18:06:13 KST |
| GDD-23 | [System Flow](https://app.notion.com/p/3dc1e7f1708580329da6fe4986654f7b): 2.3/2.4·7.6·7.9·최신7항목, edited18:05:51 KST |
| GDD-24 | [UI/UX](https://app.notion.com/p/3dc1e7f1708581a48421fcec63d3cdf8): 00.7·S02·Y01·타이머/말 표시, edited18:06:11 KST |
| 운영·독립 QA·실측 | 본 보고·[Saturn 결과](qa-revise-saturn.md)·[배포 요약](qa-deployment.md)·[실제 사용량](qa-revise-usage.md) |

Venus가 기존 로컬 회사 Notion으로 Decision Log와 본문을 함께 갱신했고 Mercury가18:08 KST Codex 실제 fetch3건으로 독립 재조회했다. 사람 Editor·Project·Status와 기존 #295 QA PASS 이력은 보존했다.

## 인수·모델·MCP 필수 게이트

main의 CLAUDE.md·AUTHORITY.md·HANDOVER_SNAPSHOT.md 상단2026-09-30 체크포인트/필수 절차·WORKER_MODELS.md·worker-models.json·QA_MINIMUM_POLICY.md, 최신 CJ 원문·GDD13/23/24·GitHub #292~#297·PR302~305·Release를 독립 읽었다. [OpenAI 공식 GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol)·[2026-09-29 변경 이력](https://developers.openai.com/api/docs/changelog)을 확인했다. 역사적 문장보다 CJ 최신 지시를 우선한다.

| 역할 | 실제 모델/effort/tier·권한 | 실행 증거 |
|---|---|---|
| Mercury | gpt-6.1-sol/xhigh/default(No Fast), danger-full-access/never | 현재 turn_context·native argv·SQLite tier 이벤트·실제 실행 |
| Venus/Mars/Jupiter | claude-opus-5-5/high/bypass permissions | 명시 argv·현재 실제 응답 모델·완료 footer, Venus eli-adult / Mars·Jupiter Ponytail full |
| Earth 기존 자산 | gpt-6-luna/xhigh/default, full-access/never | 새2세션 시작/완료 컨텍스트·tier, 신규 창작 Astra 작업 없음 |
| Saturn | gpt-6.1-sol/xhigh/default, full-access/never + 역할상 읽기 전용 | Go/완료 actual proof, filesModified=[], Ponytail full |

CJ 모델은 변경하지 않았다. Orca adopted native terminal receipt requested/effective null은 실제 argv·현재 응답/컨텍스트·tier로 보완했으며 설정 파일만으로 실행 모델을 추정하지 않았다. Mercury도 Ponytail full 적용.

| 필수 MCP | 목록·인증·실제 호출 |
|---|---|
| Codex Notion | 44도구, 기존 인증으로 GDD13/23/24 실제 fetch3건 성공,18:08 KST 독립 재조회 |
| Codex Render | 23도구, 기존 OAuth 재인증17:49 KST 뒤 workspace/서비스 읽기 성공. 최신 QA get_deploy live·get_service 및 운영 get_service 실제 성공 |
| Claude 로컬 Notion | 기존 notion-only 구성 https://mcp.notion.com/mcp·회사 계정, Venus 실제 읽기·갱신·재조회 성공, 새 연결/계정 없음 |

필수 연결 게이트 모두 PASS. TUI 경고1건은 `Failed to create shell snapshot for powershell: Shell snapshot not supported yet for PowerShell`이며 MCP 실패가 아니다. Claude Google Drive/Calendar/Gmail/Docs 검사·호출·연결·해제 없음. Slack 미연결 유지, Unity MCP는 v0.6.0 추적 유지.

## 최신 보존·GitHub·종료 상태

Mercury main WorkTree는 `003dc8a0-372c-4547-9290-31d34edd82be::C:/Users/pc_77/orca/Digit-Duel`이다. 20:17 KST 새 fetch 후 main=origin/main=`9b306bbfda103263cb2feea90fd9c89527eb9290`, milestone=`4f638a12dbab5e85b5b3b8d1d50ab17d029ea5b3` 확인. main 미커밋6파일은 시작 대비 SHA-256 동일·unity/ 존재, stash `9ebd041242f61e10906ae388e8037c03c33ad386`·`cc644636b67788727963b2158001bc66cb40fe86`, handoff `ChangjoSung/mercury-pd-v0413-handoff-0929`→`b44e3021eb4118f5d59cca0e2742a7c5c4ba1a84` 보존. PR304 Git 내용은 같지만 로컬 CRLF/원격 LF로 원시 바이트 동일 주장은 하지 않는다.

| GitHub 현재 상태(20:17 KST) | 결과 |
|---|---|
| #292/PR302 | CLOSED/MERGED c25252e521668fb64dfe3bed920684cb661bcc72 |
| #293/PR305 | OPEN/OPEN Draft, milestone/v0.4.13, CJ 재테스트 대기 |
| #294·#295·#296 | OPEN, 전체 메인/턴 상점/배틀 개편 별도 착수 대기 |
| #297 | CLOSED NOT_PLANNED→#296 이관, 수정 완료 판정 아님 |
| PR303 | MERGED 4f638a12dbab5e85b5b3b8d1d50ab17d029ea5b3, 기존 #295 로비 QA PASS/CI 이력 유지, 새 턴 상점 범위 #295 재개방 |
| PR304 | OPEN Draft ffcd73168fd20d5fc6dbd08c893391308cd65066, 정규 v0.4.13 최종 Release/운영 갱신 때 병합 계획 유지 |
| Release | 최신 v0.4.12, hotfix 태그 부활 없음 |

이번 native Worker 전원 worker_done→archive→release→종료. 실제 terminal 목록(20:32 KST) Digit-Duel은 Mercury main 하나, 자체 로컬 HTTP 서버도 종료했다. 다른 프로젝트/사용자 Claude·Unity는 보존하고 CJ QA 탭은 열어뒀다. 신규 Issue/PR/댓글·main/milestone 직접 커밋/병합·force push·Release·운영 배포·유료 자원·결제 없음.

Orca adopted external terminal의 release 요청은 관리 자원을 삭제하지 않아 worker-list에 15개 settled/retained 역사 행이 남는다. 이 표시는 살아 있는 Worker 수가 아니다. 실제 task15개 completed와 terminal 부재/해당 PID 종료를 구분해 확인했다.

원시 증거는 위 운영 archive의 모델/dispatch/완료·Notion 재조회·Render 배포·HTTP Git blob·CI 실패/재시도·main 보존·사용량 기록이다. 후속 문서 HEAD의 CI는 [PR305 Checks](https://github.com/ChangjoSung/Digit-Duel/pull/305/checks) 최신 HEAD로 확인한다. 후속 문서 커밋의 제품 파일은 배포 소스와 동일하다.
