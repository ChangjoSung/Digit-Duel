# #263 Mercury PD 진행 보고 — 2026-09-25

> 최신 판정은 바로 아래 **2026-09-26 CJ QA PASS·통합 준비** 절이다. 뒤의 `현재 판정`·`남은 결정과 제한` 등 날짜가 오래된 절은 당시 검증 이력이며 현행 판정으로 읽지 않는다.

## 2026-09-26 CJ QA PASS·통합 준비

- CJ가 이번 브라우저 플레이 QA를 **PASS**로 직접 확인했다. #259·#264 완료는 #263 병합 선행 조건이 아니다. 이전 PD 답변은 이 관계를 혼동하게 전달했다.
- #263의 현행 30초/60초 로컬 구현·Saturn 독립 QA GO(수동 정산)는 유지한다. CJ의 조건부 병합 지시에 따라 전용 브랜치에서 통합 PR을 준비하고 필수 CI를 확인한다. 이 절 작성 시점에 PR은 아직 없으며, CI와 병합 완료를 선행 판정하지 않는다.
- GitHub Issue 본문은 CJ가 볼 규칙·완료 조건만 남기고 상세 기획·테스트·운영 이력은 이 보고서와 Venus/Jupiter/Mars 보고서에 보관했다. 신규 Issue 진행 댓글은 남기지 않는다.

## 현재 판정

- 전용 작업 트리 `C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-263-shop-timers` (`ChangjoSung/issue-263-shop-timers`, 기준 `fafc619`)에 구현과 Saturn 독립 QA를 마쳤다. 마지막 권한 준수 `read-only` QA는 **GO · 수동 기록**이다(아래 운영 예외 참조). 변경은 모두 **미커밋**이다. PR·이슈 종료·배포·Render 자원 생성/결제는 하지 않았다. CJ 플레이 QA와 PR 필수 CI는 아직 수행 전이다.
- 최신 CJ Q1=A(서버 난수 한 번을 왕·동료가 공유), Q2=A(B02 후보 선택도 행동 30초 안, 만료 시 서버 자동 선택, 전용 20초 없음)를 기준으로 GDD-23/24와 GitHub #263·#232의 충돌을 먼저 정리했다. Q3·Q4는 #263 비차단이다. [Venus 기획 감사](../Venus/planning-audit.md)를 이 작업 트리에 원본 그대로 복사해 해시 일치를 확인했다.
- [Jupiter 구현·검사](../Jupiter/report.md)는 고정 6칸/SOLD OUT, S01 만료 자동 구매·배치, 배치 90초, 행동 30초, 단절 정지의 서버/Core 계약을 맡았다. [Mars 구현·검사](../Mars/report.md)는 온라인 시계 표시·입력 잠금과 로컬 PVE/핫시트 타이머를 맡았다. Mercury는 제품·테스트 코드를 작성하지 않았다.

## 검증과 QA 이력

| 경계 | 결과 |
|---|---|
| Jupiter 서버 `npm test` | 18 스위트, 실패 0. `issue263-timers` 59/0, `issue237-economy` 114/0. |
| Mars 클라이언트 `smoke_issue263_client.js` | 최종 108/0. 단절 중 상점·B08·기권·준비 입력 차단, 재연결 복구와 재수화 뒤 자동 콜백 순서 포함. |
| Mars 회귀·계약·경제 실서버 | 데모 회귀 30개 실패 0, 타입 계약 70/0, `smoke_public_eco_live.js` 32/0. |
| 무경제 공개 방 | `smoke_public_live.js 2` 23/0, exit 0. 최종 Mars 네트워크 수정 뒤 Mercury가 1회 실행했다. 단독 실행이 경제 모드 기본값을 물려받던 테스트는 Jupiter가 자식 서버에 `DD_ECONOMY=0`을 명시해 고쳤다. |
| 변경 형식 | `git diff --check` 오류 0. Git의 LF→CRLF 경고는 있었고 파일을 정규화하지 않았다. |
| Saturn 독립 QA | 첫 감사에서 정지 중 상점·B08·기권 송신을 발견해 REVISE, 두 번째에서 준비 취소 송신·해제 직후 콜백 순서를 발견해 NO-GO. 두 수리 뒤 정지 경계 감사는 **GO**(108/0, SETUP 상태 변경·게임 송신 0건). 권한 준수 `read-only` 재감사 `ctx_d6603b122ff5`도 **GO**(108/0, 파일 변경 0)로 수동 기록했다. |

**운영 예외.** 첫 Saturn의 `read-only` 샌드박스가 Orca 런타임 메타데이터를 읽지 못해 `worker_done`이 실패했다. 그 뒤 Mercury가 후속 Saturn 터미널 두 개를 `-s danger-full-access`로 시작한 것은 [인수인계의 Worker 권한 확대 금지](../../../../../creat2ve/HANDOVER_SNAPSHOT.md)에 어긋났다. 두 Worker는 실제로 파일을 수정하지 않았지만 권한 설정 자체는 잘못됐다. 이를 숨기거나 정상 권한으로 소급하지 않는다. 최종 `-s read-only` 재감사는 `worker_done`을 보낼 수 없어 dispatch를 abandoned 처리하고 Task를 **수동 완료**했다. 향후 같은 제약에서 Worker 권한을 넓히지 않는다. [GitHub #263 정정 기록](https://github.com/ChangjoSung/Digit-Duel/issues/263#issuecomment-5827787963)에도 남겼다.

## 남은 결정과 제한

- **[CJ 규칙 결정 필요]** 강제 전투 대상이 남은 채 행동 30초가 만료되면 Core가 필수 전투 전 `endTurn`을 거부한다. 지금은 턴이 자동으로 넘어가지 않는다. 강제 전투 면제나 자동 전투는 새 게임 규칙이므로 임의로 넣지 않았다. CJ에게 처리 방향을 질문했다.
- 로스터·트레이 div와 보드 칸은 정지 중 잠긴 모습으로 보이지 않을 수 있다. Saturn은 눌러도 게임 상태 변경과 게임 명령 송신은 0건임을 확인했으며 UI 전용 탭·상세 보기는 바뀔 수 있다고 기록했다. 실화면·낭독 품질과 플레이 감각은 CJ 플레이 QA 범위다.
- 전투 명령 자체에는 이번 계약의 별도 시한이 없다. #264 Render 자원과 계정·후속 UI 이슈는 이 작업에 포함되지 않는다.

## 통합 대기

전용 브랜치의 미커밋 변경을 그대로 보존했다. CJ 지시 전 stage·commit·PR·이슈 종료·배포를 하지 않는다. 후속 PR에는 `Ref #263`, `Parent #232`, Saturn 판정, 변경 파일·검사 결과·rollback과 UI 화면 증거를 넣고 필수 CI 및 CJ 플레이 QA를 거친다.

## 2026-09-25 후속 CJ 30초/60초 재착수

- 이 절이 위의 종전 QA·상태보다 최신이다. CJ는 이동·탐색·텔레포트 무행동 30초 만료 시 턴 종료, 이동 뒤 강제 전투 대상 1개 즉시 개시·2개 이상 새 30초 선택/서버 난수 자동 선택, 전투 행동(싸우기·가방·포획·도망가기) 60초 만료 시 현재 전투원 행동만 생략하고 전투 지속을 지시했다. 기존 Q1=A·Q2=A는 유지한다.
- [Venus 후속 보고](../Venus/timer-rule-sync.md)와 Notion GDD-13/23/24를 재조회했다. Mercury가 GDD-23 §2.4의 보드 시계 종료 시점, GDD-24 00.2 개요와 00.10-1, GDD-13 7장 v0.4.11 예고 문장을 추가 교정했다. 이후 CJ가 Q5를 확정했다. B02는 단일 강제 대상이면 보드 시계 잔여, 복수 대상이면 대상 선택 시계 잔여를 사용하며 별도 타이머는 없다. 회복과 선택 전투 선택도 보드 30초에 포함한다. GDD-13/23/24와 GitHub #263·#232를 이에 맞춰 다시 동기화했다.
- GitHub [#263](https://github.com/ChangjoSung/Digit-Duel/issues/263)과 상위 [#232](https://github.com/ChangjoSung/Digit-Duel/issues/232) 본문을 새 계약으로 치환하고 재조회 일치를 확인했다. 두 이슈는 OPEN이다.
- 앞 절의 Saturn read-only QA GO는 **종전 Q1/Q2 기준 이력**이다. 이번 30초/60초 규칙의 QA로 소급하지 않는다. Jupiter Core/서버 → Mars UI → Saturn 독립 QA를 새 작업으로 진행 중이다. 변경은 미커밋이며 stage/commit/PR/issue close/배포/Render 자원 생성·결제는 하지 않았다.
- Jupiter의 새 서버/Core 결과는 [Jupiter 보고](../Jupiter/report.md)에서 확인했다. 복수 강제 대상 선택 시계가 이어지는 B02까지 유지되고, 그동안 보드 시계가 멈췄다가 전투 뒤 잔여 시간으로 재개된다. 신규 타이머 검사는 `114 passed, 0 failed`였고 Mercury가 별도로 1회 재실행해 같은 결과를 확인했다. `git diff --check` 오류는 0이었다. Jupiter `worker_done`의 회복·선택 전투 Q5 미결 표기는 CJ 답변 전 문구이므로 보고서 최신 7-6절을 현행 확정으로 바로잡았다. Jupiter Task를 완료 정산하고 Mars UI Task를 시작했다.

## 2026-09-25 후속 구현 체크포인트 — Saturn 독립 QA 전

- Mars는 로컬 보드·복수 강제 대상·전투 시계를 분리하고 B02 출전 선택을 현재 시계 잔여 시간에 연결했다. 온라인 화면은 서버 시계와 행동 주체를 표시하도록 수정했다. 후속 클라이언트 회귀는 `164 passed, 0 failed`, 실서버 2클라이언트 경제 통합은 `46 passed, 0 failed`였다. 데모 회귀 전체 실패 0건, `npm run typecheck` 오류 0건, `npm run test:typecheck` 70/0을 확인했다. 마지막 타입 주석은 실행 코드가 아니며 `ui.js`의 기존 CRLF가 유지됐다.
- Mars의 첫 dispatch `ctx_4fa48fa4ae43`와 이어받은 `ctx_b4cc7b59bf78`는 작업물과 검증 증거를 남겼지만 `worker_done`을 보내지 못했다. 두 번째 실행은 불필요한 재검사 제안을 취소한 뒤 Orca의 `agent_prompt_blocked`로 후속 입력이 막혔다. `worker-stop`은 외부 터미널에 대해 `stop_unknown`을 반환했고, dispatch를 `abandoned`로 정산한 뒤 해당 탭을 닫았다. **정상 Worker 완료로 소급하지 않는다.** Mars Task의 수동 완료 여부는 PD가 변경과 검사 증거를 확인해 별도로 기록한다.
- `demo/js/core.js`의 복수 강제 대상 배너 옆에 남은 `시간 제한 없음` 주석은 현행 T3과 어긋나므로 Jupiter의 좁은 후속 작업으로 교정 중이다. 제품 동작은 이미 30초 서버 시계로 구현돼 있다. 이 교정과 Saturn의 새 규칙 독립 QA를 마치기 전에는 이번 규칙을 QA GO로 표기하지 않는다.

## 2026-09-25 Saturn 신규 규칙 독립 QA — REVISE

- Jupiter가 `demo/js/core.js`의 낡은 주석 한 줄을 T3 30초·서버 자동 선택 문구로 교정했다(`ctx_0cea62c31894`, `worker_done` 정상 수신). 실행 코드는 바꾸지 않았다.
- Saturn `ctx_186aa639ea0b`은 읽기 전용 권한에서 **REVISE**를 판정했다. `server/authoritative/room.js`의 비경제 행동 인가가 `gov.expired`만 확인하므로 `deadline < now()`인데 타이머 콜백은 아직 오지 않은 창에서 늦은 보드 명령을 수락한다. Saturn이 활성 보드 시계의 deadline만 과거로 옮기고 `expired:false`를 둔 결정론적 재현에서 `skipMain`이 `ok:true`로 수락되어 `mainUsed:true`·revision 증가가 발생했다. 같은 인가 경계가 복수 대상 선택과 전투 행동 60초에도 적용된다. **서버 시각 마감 대조와 회귀 테스트가 필요하며 QA GO가 아니다.** Mercury 정적 검토에서는 배치 90초의 `_handleSetup`·`_handleReady`에도 같은 시각 경계가 빠져 보이므로 Jupiter가 함께 확인해야 한다(아직 별도 재현 전).
- 결함 외 표적 검사: 서버 타이머 114/0, 클라이언트 164/0, 경제 실서버 2클라이언트 46/0, 무경제 23/0. 적용 가능한 회귀·타입 계약·문서 검사·`git diff --check`는 통과했다. 읽기 전용 샌드박스에서 임시 변형 파일 생성 검사는 `%TEMP%` EPERM, 일부 Windows 실행기·Python·Luau/Rojo 검사는 환경 제약으로 미실행이다. 브라우저 수동 QA도 미실행이다.
- Saturn의 `worker_done` 1회 시도는 읽기 전용 샌드박스가 `orca-runtime.json` 접근을 막아 실패했다. 이 판정은 터미널 응답을 PD가 직접 확인해 수동 기록하며 정상 `worker_done`으로 소급하지 않는다. CJ 확정 Q5는 단일 강제 대상 B02=보드 시계 잔여, 복수 대상 B02=대상 선택 시계 잔여, 회복·선택 전투=보드 30초다.

## 2026-09-25 후속 30초/60초 최종 QA — GO, 통합 대기

- Jupiter가 공통 `_late` 판정으로 `expired`뿐 아니라 서버 현재 시각이 deadline 이상인지 확인하게 했다. 보드·복수 대상 선택·전투 행동의 늦은 입력과 배치 90초의 `setup`·`ready`·`unready`를 `E_DEADLINE`으로 거부한다. 정지된 시계는 deadline이 없으므로 잔여 시간을 보존한다. 서버 자신의 자동 배치는 외부 명령 경로를 지나지 않는다. 새 결정론적 검사 19건을 더한 서버 타이머 회귀는 **133/0**이다.
- 수정 중 Jupiter `ctx_b7432547b4b6`의 선택적 음성 대조가 `room.js` 판정 한 줄을 옛 코드로 바꾸고 CRLF를 LF로 정규화한 채 중단됐다. 이 dispatch는 `abandoned`, Task는 실패로 기록했다. 이어받은 Jupiter `ctx_cc4b00e588a8`가 해당 실행의 백업과 내용을 대조하고 판정 한 줄을 복구했다. 최종 파일은 백업과 내용 동일(CR 무시), **CRLF 1,908줄 유지**, `room.js` diff 289/41(전체 줄바꿈 diff 없음), `git diff --check` 0, 타이머 **133/0**이다. 복구 worker_done을 정상 수신했고, 중단된 실행을 정상 완료로 소급하지 않았다.
- Saturn의 **읽기 전용 재감사 GO**(`ctx_35e79fddb5d3`, 수동 기록): 타이머 133/0과 별도 메모리 재현 PASS. 마감 직후·콜백 전 보드 입력과 배치 세 명령이 거부되고 상태·revision이 유지되며, 만료 콜백 한 번·서버 자동 배치·정지 후 재개가 유지됐다. 단일 강제 대상 B02·회복·선택 전투는 보드 잔여 30초, 복수 대상 B02는 대상 선택 잔여 30초인 Q5도 코드 대조했다. 파일 수정은 없다. 읽기 전용 샌드박스의 `orca-runtime.json` 접근 제한으로 worker_done 1회 시도는 실패해 dispatch를 `abandoned`, Task를 수동 GO 완료했다.
- 이전 Saturn 전체 감사의 결함 외 검사 결과는 서버 114/0, 클라이언트 164/0, 경제 실서버 2클라이언트 46/0, 무경제 23/0이었다. 수정 후 서버 타이머는 133/0이다. 타입 검사·타입 계약 70/0, 적용 가능한 회귀와 `git diff --check`도 통과했다. **미검증**: 읽기 전용 샌드박스에서 임시 파일 생성이 필요한 일부 CI 게이트, 라이브 소켓 이벤트 루프 스트레스, 브라우저 플레이·시각/접근성, CJ 플레이 QA, PR 필수 CI. `unready` 마감 거부는 Saturn 별도 재현에서 통과했지만 새 영구 회귀의 독립 항목은 아니다.
- 이 작업 트리의 변경은 전부 **미커밋**이다. 원본 체크아웃의 dirty·untracked 파일도 보존했다. 별도 CJ 지시 전 stage·commit·PR·issue close·배포·Render 자원 생성/결제는 하지 않는다. #264 등 후속 이슈 구현은 이 판정에 포함하지 않는다.
- Venus가 [구현 상태 문장 동기화](../Venus/implementation-status-sync.md)를 마쳤다(`ctx_3750e1cbc224`, 정상 `worker_done`). Notion GDD-13/23/24의 낡은 현재 상태 문구만 #263 미커밋 작업 트리·Saturn 첫 REVISE와 후속 수동 GO·남은 CJ 플레이 QA/CI/통합에 맞췄다. Mercury도 세 문서를 재조회했고 v0.4.10 공개 규칙과 #264·#238·#259~#262 미착수 표기는 유지됐다. [GitHub #263 진행 기록](https://github.com/ChangjoSung/Digit-Duel/issues/263#issuecomment-5831131346)을 남겼으며 #263은 OPEN이다.
