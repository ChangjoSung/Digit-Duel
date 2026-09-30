# v0.4.13 UI/UX 재편 · Mercury 운영 보고

확인 시각: 2026-10-01 04:41 KST (게시 전 게이트 확인)

CJ 최신 [원문](../references/CJ_COMMENT.md)과 원본 두 장을 기준으로 GitHub 메타데이터를 재편했다. 제품 구현·Saturn QA·CJ 플레이 QA·릴리스·배포는 이번 작업 범위에 포함하지 않았다. 시안은 구조 검토용이며 기획 확정이나 동작 검증을 의미하지 않는다.

| Issue | 현재 목표 | 처리 |
|---|---|---|
| [#293](https://github.com/ChangjoSung/Digit-Duel/issues/293) | 시작 상점 → 배치 → 완료, 카드 방식 교체 | Earth 전체 흐름·교체 모달 시안과 CJ 원본을 본문에 게시. 상세 검토 대기 |
| [#294](https://github.com/ChangjoSung/Digit-Duel/issues/294) | 메인 화면 Right Side 시너지, Top Bar, Bottom Bar 가방 팝업, 하수인 설명 | 옛 #293의 사망 시너지·기여 목록 요구 승계. S03 게임 보드라는 해석은 추론 표시 |
| [#295](https://github.com/ChangjoSung/Digit-Duel/issues/295) | 턴 상점, 시작 상점과 비슷한 UI/UX | CJ 지정 번호로 OPEN 재개. 옛 방·핑·단절 개선/PR303/CJ QA PASS 본문 전체를 역사 섹션에 보존 |
| [#296](https://github.com/ChangjoSung/Digit-Duel/issues/296) | 배틀 전체 UI/UX, 기술 가독성, 피해0~0 | 옛 #297 요구 통합. 전설 마녀 상향 기획 폐지/밸런싱 다음 마일스톤 명시 |
| [#297](https://github.com/ChangjoSung/Digit-Duel/issues/297) | #296 이관 기록 | CLOSED/not_planned. 중복 추적 행정 종결이며 버그 해결·QA PASS 아님 |

[Milestone18](https://github.com/ChangjoSung/Digit-Duel/milestone/18)은 전체 UI/UX 개선으로 갱신했다. 옛 본문은 GitHub 본문 접기 섹션과 저장소 밖 `C:/Users/pc_77/orca/archives/Digit-Duel/uiux-replan-20261001/issue-*-before.json`에 보존했다. 새 Issue 댓글은 작성하지 않았다. 신규 제품 수용 조건은 전부 미완료다.

## 분석 판정과 실사용 위험

- [Earth 구조 대조표](../Earth/report.md), [Venus 기획 분석](../Venus/analysis.md), [Notion 결정 기록](../Venus/decision-sync.md)을 취합했다. 구조 시안은 CJ 비교 대상으로 충분하지만 실사용 화면 규격·행동 계약 승인과는 별개다.
- 최초 시안에서 양쪽 플레이어의 단계 표식 누락, 배치 화면 잔여 코인4를 상단 시너지4로 오독, 최대 데미지를 최대HP로 오독한 점을 발견해 기존 자산 수정 모델의 Earth에 정정을 맡겼다. 정정본 SVG/PNG 두 장과 보고서를 원본에 다시 대조했다. 양측 단계 표식·단일 코인·8개 아이템 명칭 정정을 확인했다.
- 390px에서 우측 시너지 rail36px, 판매버튼26px, 보드 셀41×25는 실제 터치·가독성 기준으로 확정할 수 없다. 7×13 보드를 압축한 구조 도형이므로 제품에 그대로 적용하면 위험하다. 실제 보드 종횡비·터치 영역·팝업으로 필요한 정보를 읽을 수 있는지 상세 시안에서 확인한다.
- 시작 상점/턴 상점은 구매·필드/가방·교체 표현을 공유할 수 있으나 종료 동작은 다르다. S01은 배치로 진행, S05는 진행 중 보드로 복귀. 새 레이아웃 엔진이나 상품/피해 계산 재작성은 필요 근거가 없다. 구현 방식은 Mars/Jupiter 소관이다.
- #295 번호가 GDD 세 문서에 옛 방·핑 개선 의미로 109회 등장했다. 새 절은 `#295(턴 상점,2026-10-01)`와 `#295(방 핑,PR303,2026-09-30 완료)`를 구분한다. 역사 참조를 일괄 치환하지 않았다.
- #296 `0~0`은 아직 재현·원인 조사·수정하지 않았다. 표시 오류인지 실제 피해 판정 영향인지, 비피해 기술·정상0피해인지 구분한 뒤 수정해야 한다. 이번 보고는 원인을 확정하지 않는다.
- 권장 순서는 #293 공통 구조 → #294 시너지/보드 → #295 턴 상점. #296은 독립이므로 별도 착수 승인 후 병행 가능하고 재현 확인을 우선한다.

## 현행 동작을 읽어 확인한 사항 — 새 기획 결정 아님

기준은 아래 exact base SHA의 코드/기존 테스트 파일이다. 이번에는 테스트를 실행하지 않았다.

- `demo/js/core.js`1546~1571 및 기존 `server/authoritative/test/test-issue263-timers.js`160~174: 상점 수동 완료 좌석은 자기 배치90초를 즉시 받는다. 상대가 S01이면 경기 개시만 기다린다. timeout은 자동 구매·자동 배치·준비 후 배치90초를 다시 주지 않는다. GDD-23 2.2와 2.3/2.4 문장 충돌은 문서 정합성 확인 항목이며 현재 동작을 바꾸는 승인으로 해석하지 않는다.
- `demo/js/core.js`1524~1544: 현행 shopSwap은 내 살아 있는 필드 하수인과 가방 사이 1:1 교체이며 사망칸·빈칸·왕·동료는 거부한다. 시작 상점도 이 경로를 사용한다. 시너지 교체 티켓은 정기 상점에서만 사용하도록 거부 조건이 있다. 모달로 바꾸는 데 빈칸 이동 등 새 규칙을 추가할 필요는 없다. Venus D1/D6은 기획 명시성 확인으로 구분하며, 현행 동작 보존이면 새 선택을 강요하지 않는다.
- #294=S03 추론, 완료 후 취소/수정의 표현, 기여 카드의 포획/왕·동료/가방 전설 라벨, S03 가방은 보기만 가능한지, SETUP의 '기권' 문구가 기록 없는 경기 취소로 읽히는지는 상세 검토 항목이다. 기존 행동 허용 범위를 임의 확대하지 않는다.

## 읽은 기준

최신 CJ Comment 및 원본 두 장, main의 CLAUDE.md, docs/creat2ve/AUTHORITY.md, HANDOVER_SNAPSHOT.md 상단 2026-09-30 현행 체크포인트와 필수 인수 절차, WORKER_MODELS.md, worker-models.json, QA_MINIMUM_POLICY.md를 독립 읽었다. Notion GDD-13/23/24, GitHub #292~#297, PR #302~#304, 최신 Release를 실제 현재 조회했다. 역사적 대기 지시보다 이번 CJ의 분석·Earth 구조 시안 요청을 우선했다. 제품 착수 승인은 확대 해석하지 않았다.

## 작업 공간·역할 실행 증거

- Mercury 원본: `C:/Users/pc_77/orca/Digit-Duel`, main → origin/main. git fetch origin main 후 양쪽 SHA `9b306bbfda103263cb2feea90fd9c89527eb9290` 일치.
- 시안 exact WorkTree ID: `003dc8a0-372c-4547-9290-31d34edd82be::C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-293-start-flow-concept`. branch `ChangjoSung/issue-293-start-flow-concept`, base `origin/milestone/v0.4.13` SHA `4f638a12dbab5e85b5b3b8d1d50ab17d029ea5b3`. CJ 최신 시안 요청을 처리하기 위한 자산/문서 공간이며 main의 미커밋 계약을 복사하거나 고치지 않았다.
- Run `run_f01b48036be6`. Mercury current thread `01a0f086-8afa-74b1-a4d9-6612e3f93aaf` 실제 gpt-6.1-sol/xhigh, feedback_tags service_tier=default, approval Never/sandbox DangerFullAccess. [공식 모델](https://developers.openai.com/api/docs/models/gpt-6.1-sol)의 xhigh 지원과 [변경 이력](https://developers.openai.com/api/docs/changelog)의 2026-09-29 출시를 재조회했다.
- Earth 신규: gpt-6-astra/medium/default, PID22588 argv와 실제 turn_context/feedback_tags 검증, task_bfe44ebd9ae7/ctx_79cad5ebcc91.
- Earth 기존 자산 수정: gpt-6-luna/xhigh/default, PID28560 argv·thread01a0f3a5-365e-7d13-84fc-95571046390c/feedback_tags 검증, task_285aa721468f/ctx_a99d3ce8e656.
- Venus: claude-opus-5-5/high, PID25580 argv·TUI Opus5.5 high·실제 응답 JSONL model 검증, task_92158dcdcf0e/ctx_551cacb7e5a9, 후속 task_e13007bb9898/ctx_3f27e4cf7560. 기존 로컬 Notion 설정만 strict-mcp-config로 사용했다.
- Codex Earth argv는 `-s danger-full-access -a never -c service_tier=default` 명시, Claude는 `--dangerously-skip-permissions` 명시. Orca reused terminal의 launch requested/effective=null은 모델 확인 증거로 대체하지 않고 그대로 보존했다. Mercury Ponytail full, Venus eli-adult, Earth 순수아트 예외 유지. Mars/Jupiter/Saturn은 이번 작업에 기동하지 않았다.

## MCP 실제 호출과 Render 복구

- Codex Notion 목록 활성, GDD-13/23/24 fetch 성공. 최종 GDD24 재조회 title·새2026-10-01절·기존PR303 확인. Claude Notion 목록은 기존 로컬 단일 서버만 사용, GDD3개 실제 fetch/결정 metadata 쓰기/재조회 성공. 자세한 페이지별 증거는 Venus/decision-sync.md.
- Render 목록23개 노출과 실제 인증은 다르다. 이번 실제 list_workspaces가 'MCP authentication required'를 반환해 기존 계정의 공식 OAuth를 `codex mcp login render`로 재인증했다. CLI 성공 뒤 **현재 Mercury 도구** list_workspaces/list_services가 성공했다. workspace `tea-daj3p25g1s2s739al7q0` My Workspace; 운영 digit-duel `srv-daj498mq1p3s73a31s3g`, QA digit-duel-cjqa-292-20260929 `srv-datq2ou0tbcc73eril0g` 실제조회. [Render 공식 연결 문서](https://render.com/docs/mcp-server) 기준.
- 현재 실제 조회에서 두 서비스 연결 branch는 main이다. QA 서비스 autoDeploy=off, 운영 autoDeploy=checksPass. QA의 다음 배포 전 사용할 이슈 branch와 exactSHA/설정을 다시 확인해야 한다. 운영 서비스 설정·배포·결제·자원은 변경하지 않았다.
- TUI warning1의 실제 로그 원인: `Failed to create shell snapshot for powershell: Shell snapshot not supported yet for PowerShell`. 필수 MCP 실패를 뜻하지 않는다. `feature.fast_mode=true`는 기능 가용 태그이며 실제 요청 service_tier=default와 구분한다.
- Google Drive/Calendar/Gmail/Docs는 목록·호출·신규연동·해제 모두 제외했다. Slack 미연결 유지, Unity MCP 작업은 v0.6.0 범위 유지. 다른 회사계정이나 새 Notion연결을 만들지 않았다.

## 보존·출시 상태

- main 미커밋 6파일의 SHA256은 작업 전 baseline과 모두 동일. PR304 HEAD `ffcd73168fd20d5fc6dbd08c893391308cd65066`의 Git blob은6/6동일하다. 다만 로컬 CRLF/원격LF 차이가 있으므로 '원시바이트동일'은 정확하지 않다. 원본을 변환하지 않고 보존했다.
- 미추적 unity/, stash `9ebd041242f61e10906ae388e8037c03c33ad386` 및 `cc644636b67788727963b2158001bc66cb40fe86`, handoff `b44e3021eb4118f5d59cca0e2742a7c5c4ba1a84` 보존.
- #292/PR302는 완료 이력 유지. 옛 #295/PR303 merge `4f638a12dbab5e85b5b3b8d1d50ab17d029ea5b3` 및 CI6/6PASS/최종CJQA는 새 턴 상점과 구분해 보존.
- PR304 Draft/main/HEAD ffcd7316 유지, CI6/6SUCCESS 새조회. CJ 결정대로 v0.4.13 최종Release/운영Render갱신 때 병합 대상이며 지금병합하지않음. 최신Releasev0.4.12. hotfix태그 복원 없음. main/dev/milestone직접커밋·forcepush없음.
- 이번 자산·보고서는 #293 단일 Draft PR로 검토한다. Issue 본문 이미지 링크는 게시 커밋 SHA 고정 URL을 사용한다. 제품 코드 변경은0이며 제품QA PASS를 부여하지 않는다.

## 최종 자산 검수·작업자 정리

- Earth 수정 task_285aa721468f/ctx_a99d3ce8e656의 정확한 pane에서 2026-09-30T19:21:52Z succeeded worker_done을 받았다. 소유 5파일만 변경한 납품을 수락했다. 초기 신규 모델은 Astra, 이번 로컬 시안 5파일 정정은 Luna로 실행했으며 Earth/report의 초기 dispatch 설명과 구분한다.
- 마지막 PNG 두 장을 직접 시각 확인했다. 양측 단계 표식, clock120/coin10·4 예시와 별도 ⚡4, 아이템 제목 정정을 확인했다. 다음 단계/배치완료 CTA를 원본의 우측 세로 영역에서 본문 상단 가로 버튼으로 옮긴 것은 390px 구성 제안이며 원본 위치와 동일하다고 주장하지 않는다.
- 원본 두 장은 첨부 파일과 바이트 동일함을 검사했다. 최종 SVG 2개 XML 파싱 성공, script/foreignObject/외부 리소스 참조 없음, PNG 크기 1314×2010 및 900×1030 확인. 이 검사는 정적 산출물 확인이며 Saturn 독립 QA나 제품 QA PASS가 아니다.
- 각 완료 Worker에 native worker-release를 호출했다. 사용자 지정 terminal은 external_terminal/retained/processAction=none을 반환하므로 종료를 추정하지 않고, 이번 작업용 정확한 terminal만 close --tab 후 실제 PID22588·25580·28560 부재를 확인했다. 사용하지 않은 이번 새 WorkTree 초기 shell도 닫았다. worker-list reclaimable 목록은0이며 retained4는 역사적 외부 리소스 분류다. Mercury 원본 terminal은 유지한다.
- 게시 파일은 docs/milestone/v0.4.13/issues/293 아래 원본·시안·역할별 보고 11개뿐이다. 제품 코드·새 helper·test·dependency는 없다. Git diff 검사와 원본 보존 검사를 수행했다.
- 2026-10-01 04:39:21 KST 재 fetch 후 main/origin/main SHA를 다시 확인하고, main 미커밋6파일 hash6/6·unity/·stash2개·handoff ref 불변을 검증했다.
- 2026-10-01 04:41 KST Codex Notion GDD3개 최종 fetch 모두 성공, 새 결정 절과 기존 PR303 QA 이력 확인. Render list_workspaces도 재성공. 현재 필수 MCP 호출 실패는 없다.
- 저장소 필수 CI는 이 자산 PR 게시 뒤 확인하고 PR 본문과 최종 운영 보고에 실제 결과를 기록한다. Draft/시안 검토 단계에서 main·milestone 병합이나 제품 착수를 진행하지 않는다.
