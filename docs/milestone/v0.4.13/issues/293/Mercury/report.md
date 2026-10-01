# [결정][피드백] #293 시작 상점 → 배치 → 완료 — Mercury 운영 보고

2026-10-01 · Mercury_PD · CJ 최신 Comment: 전체 흐름 PASS, 카드 정보·단계 색·한 줄 배치를 문서에 반영한 뒤 구현.

**현재 상태:** 문서 선행 게시 `ce96f25b8da7899f0f3253cb52b0517ccf7ef6bb`와 Notion 동기화 뒤 Mars/Earth 구현·보완 완료. Venus의 검사 문구 보정과 Saturn 독립 QA도 완료했다. 최종 제품 blob은 QA 대상 `0e3afc032f0d3f54e138e585a45e575058fd3129`로 고정했다. 필수 CI는 PR #305 최신 HEAD Checks가 기준이며 CJ 플레이 QA는 대기다. 이전 시안·인수 보고는 Git 이력의 `2febd197` 및 `ce96f25`에서 보존한다.

## 객관적 분석과 적용

- **카드 구조:** 시안의 빈 카드 대신 기존 실제 아트와 이름, 등급(테두리 + ★), 왕국·아키타입, HP를 구매·필드·가방·교체·배치 트레이·기여에 공통 적용했다. 등급은 가격과 독립이며 시작 상점의 동일 1등급 테두리는 정상이다. 왕·동료 등 비하수인에는 없는 등급·아키타입·HP를 만들지 않았다.
- **색상 의미:** 등급 1~5와 시너지 미달/달성 순위 0~4를 분리했다. 왕국 2/4/6/9, 아키타입의 현행 유형별 경계를 그대로 읽는다. 같은 4칸이어도 달성 단계가 다르다. Earth 토큰은 TFT의 단계 구분 원리를 참조한 프로젝트 제안이며, TFT 정확한 팔레트 복제 주장이 아니다. 선택·사망과 접근성 이름은 색 외의 표시를 유지한다.
- **한 줄과 조작:** TopBar, 진행 막대+버튼, 가방 교체+판매를 한 줄로 구성했다. 필드 판매는 기존 S01 조건을 유지하고 교체는 살아 있는 필드 6카드 선택으로 바꿨다. 빈칸·사망 칸 비활성, 요청 1회, Esc·취소 포커스 복귀를 자체 검증했다. 320px에서는 가방 열 수를 줄여 한 줄 액션과 44px 터치 영역을 함께 유지한다.
- **흐름과 공개 범위:** PVE 경제 판도 실제 상점 완료에 따라 배치로 넘어가는 UI 순서를 적용했다. Core의 90초·자동 구매/배치·거래·HP·서버 권위는 변경하지 않았다. 온라인 상대는 준비 완료일 때만 ③이며 그 전은 중립 표시다. 상대 ①/② 공개는 별도 CJ 결정과 Jupiter 계약이 필요한 R1로 남긴다.

## 문서 반영 위치

| 기준 | 현재 반영 |
|---|---|
| 최신 CJ 원문·원본 2장 | [CJ_COMMENT](../references/CJ_COMMENT.md) · [흐름](../references/cj-start-flow.png) · [교체](../references/cj-replacement-modal.png) |
| 구현 계약 | [Venus 구현 계약](../Venus/implementation-contract.md) · [분석 11장](../Venus/analysis.md) · [동기화](../Venus/decision-sync.md) |
| 시각 토큰·보완 시안 | [Earth UI_CONTRACT](../Earth/UI_CONTRACT.md) · [Earth 보고](../Earth/report.md) |
| 실제 구현·검사·화면 | [Mars 보고](../Mars/report.md) · [390px 실측](../Mars/geometry.json) · [320px/보드 스크롤 실측](../Mars/geometry-320.json) |
| Notion GDD | 13 `3cd1e7f17085817f8c35fa8548116f38`, 23 `3dc1e7f1708580329da6fe4986654f7b`, 24 `3dc1e7f1708581a48421fcec63d3cdf8`: 최신 승인·카드/색/한 줄 조건 반영, 기존 #295 QA PASS 이력 보존. [실제 갱신·재조회 증거](../Venus/decision-sync.md) |

## 작업·검증 게이트

- WorkTree: `003dc8a0-372c-4547-9290-31d34edd82be::C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-293-start-flow-concept` · branch `ChangjoSung/issue-293-start-flow-concept` · 최신 시작 기준 `origin/milestone/v0.4.13` = `4f638a12dbab5e85b5b3b8d1d50ab17d029ea5b3`.
- Issue #293 OPEN · 통합 PR #305 하나(Draft, base `milestone/v0.4.13`). 신규 Issue 댓글·별도 PR·공유 트랙 직접 커밋·병합·배포 없음.
- 실행 확인: Mercury `gpt-6.1-sol/xhigh/default`, Earth 기존 자산 정정 `gpt-6-luna/xhigh/default`, Venus·Mars `claude-opus-5-5/high`. Codex `danger-full-access/never`, Claude 실제 `--dangerously-skip-permissions`. Orca 사용자 terminal을 명시 실행해 receipt model=null인 부분은 실제 argv·현재 턴/응답·tier 로그로 확인했다.
- Mars 검사: 신규 #293 59/0, #238 147/0, #285 38/0, #263_client 164/0, #236 287/0, #286 13/0, public_rooms 191/0, online 159/0, JS 구문/typecheck exit0. 최종 CSS 뒤 #293만 재검사했다. 기존 경제·시계·보안 불변식은 보존하며 최초 UI 위치/순서 기대값 9건 수정은 숨기지 않고 [Mars 보고](../Mars/report.md)에 기록했다. 목록 밖 직접 영향 회귀 4건은 1회씩 수행됐고, 이후 검사 확대는 사전 PD 승인으로 제한했다.
- 시각 근거: 실제 390px·320px·데스크톱 화면 15장. 완료 대기 2장은 모의 공개 방 상태를 같은 렌더러로 그린 것으로 실서버 E2E 증거가 아니다. 보드 7×13의 마지막 행은 기존 내부 스크롤 끝에서 보이고 선택 가능하다. 실서버 브라우저 E2E·CJ 플레이 QA는 미실행이다.
- [Saturn 독립 QA PASS 기록](../Saturn/report.md): 13AC 코드·실제 이미지 대조, 신규 #293 검사 59/0 exit0 1회, 파일 무수정. 문서 표현 1건을 PD가 정정했다. 최신 CI 6개는 [PR #305 Checks](https://github.com/ChangjoSung/Digit-Duel/pull/305/checks)의 최종 HEAD로 확인한다. CJ 플레이 QA·출시 승인은 대기다. 최초 CI의 구식 #122 표시/순서 단언 2건은 Venus AC10을 11건 목록으로 먼저 정정한 뒤 Mars가 고쳤다. 기존 96건을 보존하고 비경제 자유 전환 A14b를 추가해 99/0 exit0이다. [정정 근거](../Mars/ci-correction.md). 추가 읽기 전용 Saturn QA는 `5e605cd40c0ad6c997ac25a876ab42dba57cc156`에서 별도 PASS했다(2026-10-01 11:14 KST, msg_26cf6c7ca7e5). 제품 코드는 앞선 QA 이후 바뀌지 않았다.

## 보존과 남은 결정

main/origin/main 보존 기준은 `9b306bbfda103263cb2feea90fd9c89527eb9290`. main의 미커밋 계약 6파일·untracked unity/·stash `9ebd041242f61e10906ae388e8037c03c33ad386` 및 `cc644636b67788727963b2158001bc66cb40fe86`·handoff `b44e3021eb4118f5d59cca0e2742a7c5c4ba1a84`는 새 fetch와 SHA-256 대조로 보존을 확인했다. PR #304는 최종 v0.4.13 Release/운영 갱신 때의 병합 계획 그대로다. 최신 Release v0.4.12, main Release·운영/베타 Render 갱신은 실행하지 않았다. #294·#295 전체 개편·#296 전투는 이번 착수 범위가 아니다.

필수 MCP: Codex Notion 44도구·Render 23도구. GDD-13 실제 fetch 재확인(2026-10-01, last edit00:04:14.765Z), GDD-23/24 기존 갱신 후 실제 재조회 증거는 Venus 동기화 문서. Render 인증 요구를 기존 `codex mcp login render` 재인증으로 복구했고, 10:38 KST 실제 `list_workspaces`가 기존 `tea-daj3p25g1s2s739al7q0`를 반환했다. Claude Notion은 기존 로컬 연결만 사용했고 다른 계정·연결·Google/Slack/Unity MCP는 추가·검사·호출하지 않았다.

## 인수 기준·현재 운영 상태

CJ 최신 Comment가 역사적 지시보다 우선한다. 현행 main `CLAUDE.md`·`AUTHORITY.md`·2026-09-30 `HANDOVER_SNAPSHOT.md` 상단·`WORKER_MODELS.md`·`worker-models.json`·`QA_MINIMUM_POLICY.md`, GDD-13/23/24와 GitHub 현재 상태를 읽었다. [공식 GPT-6.1 Sol 문서](https://developers.openai.com/api/docs/models/gpt-6.1-sol)의 모델 ID/xhigh와 [변경 이력](https://developers.openai.com/api/docs/changelog)의 2026-09-29 출시를 확인했으며 CJ 모델은 임의 변경하지 않았다. Mercury 실제 현재 turn_context/샘플 tier/실행 권한과 각 Worker의 시작·완료 증거는 운영 archive에 보관했다.

| 현재 GitHub 상태 | 확인 결과 |
|---|---|
| #292 / PR #302 | CLOSED / MERGED `c25252e521668fb64dfe3bed920684cb661bcc72` |
| #293 / PR #305 | OPEN / Draft, 이번 구현·Saturn QA 완료, 최종 HEAD CI는 PR Checks 기준, CJ 플레이 QA 대기 |
| #294 · #295 · #296 | OPEN, 메인/턴 상점/배틀 전체 개편은 별도 착수 대기. #295는 이전 로비 QA 건을 종료한 뒤 최신 CJ 재편으로 턴 상점 범위에 재개방했다 |
| #297 | CLOSED `not_planned`, 오류 해결 판정이 아니라 #296 이관 |
| PR #303 | 기존 #295 로비 CJ 최종 QA PASS → MERGED `4f638a12dbab5e85b5b3b8d1d50ab17d029ea5b3`, CI 6/6 PASS 이력 보존 |
| PR #304 | OPEN Draft `ffcd73168fd20d5fc6dbd08c893391308cd65066`, 최신 Checks 6/6 PASS, 정규 v0.4.13 최종 Release/운영 갱신 때 병합 계획 유지 |
| 최신 Release | v0.4.12. hotfix 부활·main Release·운영/베타 Render 배포 없음 |

필수 MCP의 연결 목록·인증·실제 읽기 게이트는 모두 PASS했다(Codex Notion 44도구, Render 23도구, Claude 기존 로컬 Notion만). Render OAuth의 일시적 인증 요구는 기존 연결 재인증 후 실제 현재 도구 호출로 복구했다. TUI 경고 1건은 `Failed to create shell snapshot for powershell: Shell snapshot not supported yet for PowerShell`이며 필수 MCP 실패가 아니다. 운영 Render와 QA 자원은 읽기만 했으며 다음 베타 전 연결 브랜치/정확한 SHA 조정 검토가 필요하다. main 6파일 원본 바이트는 해시로 보존했고 PR #304 Git 내용은 같지만 로컬 CRLF/원격 LF 때문에 원시 바이트 동일이라고 주장하지 않는다.
