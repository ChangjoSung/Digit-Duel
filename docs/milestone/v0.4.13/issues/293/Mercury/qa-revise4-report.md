# [피드백][결정] #293 CJ QA REVISE 추가 4건

현재 단계: **2026-10-02, 추가 네 항목 구현·독립 QA·필수 CI 6/6·Free QA 재배포 및 CJ 플레이 QA PASS·종결 승인**. CJ Comment 원문 `CJ QA Test : PASS`와 후속 `넵 #293은 종결 처리합니다.`를 접수했다. [최신 QA 사이트](https://digit-duel-mipa-qa.onrender.com/?qa=c8b2b7c)는 제품 SHA `c8b2b7c2186f08c8d37bc8be25effc4731e98f0f`를 실행한다. 후속 승인은 PR305 Draft 해제·`milestone/v0.4.13` squash 병합·병합 SHA CI 확인·#293 종결 범위이며, 최종 병합 SHA·CI·종결 결과는 [Issue293 본문](https://github.com/ChangjoSung/Digit-Duel/issues/293)과 [PR305 본문](https://github.com/ChangjoSung/Digit-Duel/pull/305)에 기록한다. [직전 7건 보고](qa-revise-report.md)는 이전 납품의 증거다.

입력은 [CJ 원문·원본 3장](../references/CJ_QA_REVISE4_20261002.md), 기준은 [Venus 계약](../Venus/implementation-contract.md) 9장·AC14~18이다. 선행 계약 커밋은 `17dd0bfa51e322ba76ff83be577e0f920949376a`. 기존 AC1~13은 명시적으로 바뀐 기대값 외에 유지한다.

| CJ 항목 | 확인된 원인·적용 범위 |
|---|---|
| 교체 창 취소 삭제 | X와 Esc도 하단 취소 버튼을 누르는 구조였다. 버튼을 삭제하고 닫기·포커스 복귀를 직접 연결했다. 시작·정기 상점 공통이며 다른 확인 창은 유지했다 |
| 수호자 3종 구매가 3원 | 상품 8종이 `ECO.goodPrice=1`을 공유했다. power/time/escape만 공통 가격 함수에서 3원으로 판정·차감·표시했다. 나머지 5종·효과·예비 코인 보호 유지 |
| 아이템 설명 팝업 | 지속 표시되는 `#goodDesc`를 삭제하고 기존 시너지 창의 틀에 아이콘·이름·가격·짧은 설명을 표시했다. 아이콘은 설명, 구매 버튼은 구매 역할 유지 |
| 단절 후 방 나가기 | 공용 `netLeave`가 `NET.pause`를 남겨 로비 소켓이 다시 열리면 연결 대기 화면·입력 잠금이 재생성됐다. 방을 떠나는 공용 정리 경로에서 상태·타이머를 끝냈다 |

수호자 구매가 변경으로 시작 10원·빈 필드 6칸에서는 최대 한 개의 수호자를 살 수 있다. 기존 예비 코인 규칙에서 따라 나오는 결과이며 별도 규칙을 추가하지 않는다. 서버는 같은 Core를 사용하므로 서버 제품 코드를 중복 수정하지 않는다.

## 최종 수정·독립 QA·배포 증거

Mars 후속 작업 `task_99a651708feb` / `ctx_62e2985b7790`은 설명창이 열린 상태의 상점 완료·준비 만료·새 경기·정기 상점 창 닫힘을 기존 검사 C'9로 재현했다. 수정 전 108/1(네 전환 모두 잔존), 공용 `uiApply`·`gameReset`·`modal/closeModal`에서 기존 `synHelpClose`를 재사용한 뒤 109/0이다. 같은 화면의 갱신에서는 설명창이 유지된다. 후속 `smoke_issue238` 147/0·typecheck exit 0도 각 1회다. [Mars 구현·실패/수정 기록](../Mars/qa-revise4-implementation.md) · [화면·키보드 증거](../Mars/qa-revise4-visual/README.md) · [Jupiter 서버 경제 기록](../Jupiter/qa-revise4-implementation.md).

Saturn `task_deeafeb679b1` / `ctx_ac3bf5387e47`, 완료 메시지 `msg_107d0fba0a74`(01:00:55 KST)는 **고정 제품 SHA의 읽기 전용 범위 PASS**, 파일 수정 0이다. 계약 AC14~18·17dd0bf 이후 diff·원본 이미지 3장과 기존 320/390px PNG 8장을 직접 대조했고 관련 없는 규칙 단언 약화는 없었다.

| Saturn 검사 — 각 1회 | 결과 |
|---|---|
| `node demo/test/regression/smoke_issue293.js` | 109 passed / 0 failed, exit 0 |
| `node demo/test/regression/smoke_issue263_client.js` | 174 passed / 0 failed, exit 0 |
| `server/`에서 `node authoritative/test/test-issue237-economy.js` | 179 passed / 0 failed, exit 0. `DATABASE_URL` 빈 값, 기존 main의 `server/node_modules`를 `NODE_PATH`로 사용 |

Saturn은 명시 인수 `gpt-6.1-sol/xhigh/default`, `danger-full-access/never`로 시작했다. 시작·완료의 실제 `turn_context`와 footer는 모델·effort·권한이 일치했다(session `01a0f828-d73f-7d10-81da-f01658129801`, turn `01a0f82c-0217-7c53-8d83-b62bfeda0c1f`). Saturn 안에서는 tier가 보이지 않았으므로 Mercury가 해당 세션의 읽기 전용 SQLite `codex_core::session::turn` feedback 태그(log 1104258·1104442)에서 실제 `service_tier=default`를 추가 확인했다. 설정 파일만으로 실행값을 추정하지 않았다.

| 배포·운영 검증 | 확인 결과 |
|---|---|
| 제품 commit/push | `c8b2b7c2186f08c8d37bc8be25effc4731e98f0f`, 기존 #293 브랜치·PR305 |
| 해당 제품 SHA 필수 CI | [run 36887852780](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36887852780), 필수 6/6 SUCCESS, 재시도 0 |
| QA Render | 기존 workspace `tea-daj3p25g1s2s739al7q0` / service `srv-dauvf1m0tbcc73ctepsg` (`digit-duel-mipa-qa`), Free·자동 배포 Off 유지 |
| deploy | `dep-dav87qek1f9s73d728v0`, **01:02:44 KST live**, commit가 위 제품 SHA와 일치 |
| 실제 HTTP | `/`·`/healthz`·`/readyz` 200, `ok`·`ok (no db)`, `Cache-Control: no-store` |
| 제공 파일 대조 | HTML이 참조하는 JS 10개·CSS 1개는 Git blob과 바이트 동일. `index.html`은 기존 `.gitattributes`의 `text eol=crlf`를 적용한 체크아웃 바이트와 동일 — 원시 LF blob과 동일하다고 주장하지 않음 |
| 변경 파일 SHA-256 | CSS `cf0dbc87f5d8970d77aac7e63f614c1cd12ff3931b07f4ec11e944f07fed4821`; UI `bfd6026a230aee85dfac441d3315d3a659b49e85a8679b6c597f1610268965bf` |
| 종료 | 두 Worker의 유효 worker_done을 접수·release 요청 후 external_terminal의 `processAction=none`을 확인하고 각 해당 terminal만 명시 종료(`ptyKilled=true`). #293 terminal 0, reclaimable 0. 이전 자체 HTTP 8293 리스너 없음 |

첫 HTTP 검사에서 HTML 원시 blob 대조만 실패했다(200, 실제 게임 HTML). 차이는 기존 CRLF 체크아웃 속성으로 확인했으며 위 12파일 대조를 해당 속성을 적용해 완료했다. 제품 변경·재배포는 하지 않았다. 이 보고서 후속 커밋은 문서만 포함하므로 실행 제품 SHA와 구분하며, 최신 HEAD CI는 [PR305 Checks](https://github.com/ChangjoSung/Digit-Duel/pull/305/checks)에서 확인한다.

**증거 범위:** 화면 PNG는 합성 상태이고 마지막 팝업 수명 정리 전 촬영이다. 정기 상점 팝업 PNG는 당시 남아 있던 설명창을 담은 이전 증거이며 수정 후 수명 PASS 화면으로 쓰지 않는다. 실제 두 사람 온라인·단절 중 inert 닫기·나간 뒤 새 방 생성/입장·실기기·넓은 PC·대비율 및 마지막 수정 후 화면은 자동·PNG 증거로 확인하지 않았다. CJ의 최종 플레이 판정은 PASS이며 개별 시나리오·기기별 결과는 별도로 제공되지 않았다. 제품 변경·재배포·QA 재실행 없이 판정만 반영했다. 새 기능·의존성·WorkTree·테스트 파일은 추가하지 않았다.

## CJ QA Test List

CJ가 최신 QA 납품에 `CJ QA Test : PASS`를 통보했다. 아래는 전달한 Q4-01~05 목록이며 개별 ID별 결과를 임의로 보충하지 않는다.

| ID | 조작 | 기대 결과 |
|---|---|---|
| Q4-01 | 가방 하수인의 교체 창을 열고 X로 닫기. PC에서는 Esc도 확인 | 하단 취소 버튼 없음. 교체·코인 변화 없이 닫히고 포커스 복귀. 정기 상점도 동일 |
| Q4-02 | 수호자 3종의 카드와 설명 가격 확인, 구매 전후 코인 비교 | 힘·시간·도망 모두 3원. 다른 5종은 1원. 예비 코인을 침범하거나 코인이 2원이면 수호자 구매 불가 |
| Q4-03 | 아이템 8종 아이콘을 누르고 설명 확인. X·바깥 누름·PC Esc로 닫기 | 시너지와 같은 팝업 틀, 큰 아이콘·이름·가격·짧은 설명. 맨 아래 지속 설명 삭제. 설명만 열면 구매·전송 없음. 뒤 상점은 유지 |
| Q4-04 | 시작 상점에서 한쪽 연결을 끊고, 남은 쪽의 방 나가기 선택 | 방 목록으로 이동. 연결 대기 화면·유예 초·입력 잠금이 남지 않음. 새 방 생성·입장 가능. 방에 머무는 동안 기존 유예·입력 잠금 유지 |
| Q4-05 | 휴대폰 세로와 PC에서 교체·아이템 팝업 확인. 설명을 연 채 준비 만료·상점 완료·새 경기 시작도 확인 | 텍스트·가격·X 겹침/잘림 없음. 이전 설명이 남지 않음. 공통 준비 180초 재발급 없음, 양쪽 준비 조기 시작·기존 판매/말 표시 유지 |

결과는 CJ Comment에 `PASS / REVISE + Q4-ID + 기대/실제 + 조작 순서`로 접수한다. 새 Issue 댓글은 만들지 않는다.

## 문서·연결·보존

Venus는 기존 회사 계정 로컬 Notion으로 GDD13/23/24를 실제 읽기→갱신→재조회했다. Mercury도 Codex fetch3건으로 최신 4건과 가격을 독립 확인했다. 수정 UTC는 GDD13 `15:17:51.270`, GDD23 `15:17:52.547`, GDD24 `15:17:53.647`(2026-10-01). Editor·Project·Status·기존 PR303 QA PASS 이력은 보존했다.

Render 첫 인증 갱신은 콜백 대기 시간 초과였고 실제 MCP도 인증을 요구했다. CJ 재호출 지시에 따라 `codex mcp login render` 재실행이 성공했고, 00:20 KST 실제 `get_service`·`list_workspaces`·`get_deploy`가 성공했다. 기존 워크스페이스 `tea-daj3p25g1s2s739al7q0`, Free QA 서비스 `srv-dauvf1m0tbcc73ctepsg`를 유지한다. 새 계정·연결·자원·플랜은 만들지 않았다. 인증 완료만으로 연결 복구를 판단하지 않았다.

현재 작업은 기존 WorkTree `003dc8a0-372c-4547-9290-31d34edd82be::C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-293-start-flow-concept`, 브랜치 `ChangjoSung/issue-293-start-flow-concept`이다. main의 모델 계약 6파일·unity/·stash2건·b44e302 handoff 브랜치와 PR304 Draft를 보존한다. QA 서비스가 이 브랜치를 배포 대상으로 사용하므로 브랜치와 기존 체크아웃은 QA 사이트 보존을 위해 유지한다. 후속 승인에 따른 PR305의 milestone 병합과 #293 종결 외에는 main/dev 병합·Release·운영 배포·결제·Render 설정 변경을 실행하지 않는다.
