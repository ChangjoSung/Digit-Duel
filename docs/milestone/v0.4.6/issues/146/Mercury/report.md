# #146·#131·#128·#130 Mercury 통합 기록

- 작성: 2026-09-10 Mercury(PD, Codex/GPT-6 Astra/high).
- 상태: 제품 코어·회귀·브라우저·튜토리얼·최종 README 렌더 개발 검증 기록. [통합 PR152](https://github.com/ChangjoSung/Digit-Duel/pull/152)의 최종 필수 CI·dev 병합 상태가 원본이며 CJ Play QA는 대기다. 후속 자원 정리 절차 위반은 정상 완료로 수락하지 않는다.
- 대상: Milestone13 v0.4.7. 정식 출시는 v0.4.5이며 이번 작업은 릴리스가 아니다.
- 출발: `feature/146-battle-actions`, dev `33bbc19e9c1ec5314903c3d6f77ecc7c5f6a9051`, HTML blob `4535791bbefd86ad829cdd436d4957f8a530846b`.
- 제품 촬영 기준: `aa6998ae8d2ca8b5fc8136c5fa19bc6aca5c12ea`, HTML blob `2a9b54c769a58fc5c0db9e913ce4421bec6758e3`. Windows 작업 파일 SHA256 `b1c33ae8ff87e64cb71481714d73966f09e3af5f3b8506d82893dccb77f305de`. 이 커밋은 제품만 고정했으며 테스트·문서·미디어의 최종 납품 커밋과 구분한다.
- 원본: [승인 계약](../Venus/gameplay-spec.md), [Issue146](https://github.com/ChangjoSung/Digit-Duel/issues/146), [GDD13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) DL45, [GDD18](https://app.notion.com/p/3d61e7f17085809ea410fe6a1431f06c).

## 확정 범위

| Issue | 반영 계약 |
|---|---|
| #146 | HP 제한 없는 도망 기본30%·실패 추가 반격 삭제/자기 전투 행동1회. 도망의 수호자 해당 배틀70%. 4슬롯 모두 불가 시 기본 공격 없이 수동 대기, 왕·동료 본체 기본 공격 유지. |
| #131 | 함정 상태 양단 선택·실행 차단, CJ 지정 첫 말→교체할 말 안내. 함정 유닛 자체나 도망 후 교환 금지로 확대하지 않음. |
| #130 | 남은 보호막+기존 부여량 합산. 기존 수치·흡수·화상 우회·초기화 유지, 신규 상한·기간 없음. |
| #128 | 브라우저 프로필·origin별 튜토리얼 완료 독립성 검증. 신고 증상 미재현으로 제품 저장 로직은 유지, 근거·회귀 추가. |

#121·#125·#129는 PR143 통합 후 2026-09-10 CJ QA PASS로 종결했다. 이전50% 도망 버프 권고는 최신 CJ70%로 대체했다. 기존 납품 QA·문서·미디어와 이번 후속 변경을 구분한다.

## #128 관측과 한계

Mars는 변경 전·후 실제 Chrome의 독립 user-data-dir 두 개와 같은 HTTP origin에서 공유 증상이 재현되지 않았다고 보고했다. 최종 보존 도구·JSON에서 확인되는 순서는 A·B 탭을 먼저 연 뒤 A 완료 후 B 화면을 관측하는 것이다. B의 첫 navigation 자체가 A 완료 후였다는 의미로 확대하지 않는다. 이후 A 재방문 생략, B 미완료 재방문 표시, B 완료 후 재방문 생략과 localhost/127.0.0.1 origin 분리가 관측됐다. 초기 보고의 세부 실행 순서를 최종 증빙으로 소급 입증하지 않는다.

이 조건에서는 CJ가 보고한 다른 PC의 최초 튜토리얼 누락을 재현하지 못했다. 기존 localStorage와 TUT.seenThisLoad는 게임·NET 상태와 분리돼 있다. 서버 공유나 CJ의 프로필 사용 방식으로 원인을 단정하지 않는다. PD가 발생 주소·브라우저·현재 재현 여부를 질문했다. 이는 물리 두 PC 검사나 신고된 증상 해결 PASS가 아니다. [Issue 관측 기록](https://github.com/ChangjoSung/Digit-Duel/issues/128#issuecomment-5612436651).

## 역할·검토 이력

- Run `run_c784a12efc36`. Venus(Claude) 규격 단일 파일 작성 후 archive/release. Mars(Claude) 제품·테스트·CI·실브라우저 증빙. Saturn(Codex) 전파일 쓰기0 독립 QA. Mercury는 조정·Git·문서 메타데이터.
- PD 중간 diff 검토에서 no-attack 안내/버튼의 비소유자 노출·공유 로그 사유, 동일 actor 연속 라운드의 오래된 콜백, 직접 execSlot(-1)·사신 폴백 기본 공격을 전달했다. noAtkShow 마스킹은 보완됐고 Saturn 실행 검증도 통과했다. [독립 1차 검토](../Saturn/initial-review.md)는 나머지 중복/잠금 pass·직접 기본 공격/사신 폴백·pass 공유 로그·텔레포트 공유 로그·보드 실물 대상 검증의 **5개 묶음을 REVISE**로 판정했다. 구현자 수정과 최종 독립 재검수가 필요하다.
- Orca 1.4.198→1.4.199 갱신 중 약 1분간 런타임 조회가 실패했다. 앱이 복구된 뒤 기존 두 Claude Task/Dispatch·소유권·파일 작성이 유지됨을 확인했으며 추가 실행·강제 종료·대체 Worker 없이 계속했다.
- Saturn 재검수의 첫 Dispatch `ctx_7addaecaf1ff`는 Codex CLI 업데이트 안내에서 `agent_prompt_blocked`로 실패해 Task를 실행하지 않았다. 업데이트를 보류하고 실패한 실행이 만든 터미널만 release한 뒤, 같은 Task `task_9ee7f6a02819`를 `ctx_32da7ffbb53b`로 재시도해 실제 검수 시작을 확인했다. 도구 설치·Claude 교체·새 PD 교대는 하지 않았다.
- 재검수에서 초기 7개 재현과 독립 코어42개는 통과했으나, 텔레포트 접촉 전투 예산 거부 분기에 공유 로그·비소유자 토스트가 남은 것을 추가로 확인했다. 자연스러운 온라인 `cell` 재생에서도 재현돼 Mars에 수정 요청했다. 회귀의 `fleePushes>=0` 조건, 합법 슬롯 때문에 토큰 없이도 거부되는 옛 pass 검사, NET/RNG 비교 없는 동기화 검사도 보강하도록 전달했다. 이 시점의 19종 회귀·브라우저77/0은 최종 PASS가 아니다.
- PD가 실제 `i146-noattack-root.png`를 읽고, 행동 없음 안내와 수동 종료가 같은 화면에 나타나도록 전투 루트 메뉴에도 기존 pass 경로의 턴 종료 버튼을 보여 주도록 정리했다. 4슬롯 전부 불가·소유자 전용 조건과 아이템·도망 등 기존 메뉴를 유지한다. 이는 새 전투 규칙을 추가한 것이 아니라 승인된 수동 대기를 바로 실행할 수 있게 하는 배치다.
- [Saturn 코어 최종 검수](../Saturn/core-review.md)는 제품·헤드리스 범위 PASS다. 최종 신규 회귀207/0, 선택8종 최신 실행값 합1062/0, 독립 인메모리63/0을 확인했다. 첫 7종은 앞선 제품 해시, 최종 신규 회귀와 후속16개는 최종 제품 해시에서 확인했으며 전체19종 반복 결과라고 확대하지 않는다. `smoke_issue146.js` 최종 SHA256은 `5ebc18318f9d784cfef9fcfa3bba754a52fabbc55562bee77886d2a383470778`이다. Task 완료 후 원문을 보존하고 재검수 Worker를 release했다.
- Claude 한도 중단은 관측되지 않았다. 실제 중단 때만 같은 역할 Codex로 이어가는 CJ 승인은 유지한다.
- Roblox PR144·147–150을 포함한 최신 dev에서 출발했다. 담당 lee775의 제품·브랜치·자산에 대한 변경이나 Roblox QA 판정은 하지 않는다.
- 구현 중 `origin/dev`가 Roblox PR151의 `697212e515f4621dd10d765ddefd53bf471b7e55`로 전진했다. 변경이 `docs/roblox/`·`roblox/`에 국한되고 이번 작업과 겹치지 않음을 확인해 작업 브랜치를 `git merge --ff-only origin/dev`로 전진시켰다. HTML·테스트·문서의 작성 중 변경을 유지했으며 Roblox 파일은 원본 그대로 포함됐다.
- 사용자 소유 root art/·orca-hook-latency-report.md는 내용 읽기·수정·스테이징 대상이 아니다. Downloads·승인 아트·기존 QA·System 외부 Summary·소유권 불명 자원을 보존한다.

## 후속 Worker 자원 정리 절차 위반

README 렌더 후속 Task `task_c5532cf6d758`/Dispatch `ctx_7799bd4b330b`에서 Mars가 임시 폴더 접두사별 개수만 집계한 뒤 `%TEMP%/i146cdp-main-*`, `i146cdp-profA-*`, `i146cdp-profB-*`를 `rm -rf`로 일괄 삭제했다. 각8개·합24개였고, Worker 보고상 실행 후 잔존0이었다. 삭제 전 개별 절대경로·생성 주체·생성 시각을 기록하거나 대조하지 않았으며 해당 접두사의 Chrome 프로세스가 없다는 확인만으로 소유권을 대신했다. 직전 Task의 CDP 잔여물이라는 해석은 접두사에 근거한 **추정**이고, 같은 접두사를 다른 주체가 만들었을 가능성을 배제하지 못한다.

PD는 발견 즉시 추가 수동 탐색·정리를 중지시켰고 기존 출력에 근거한 정정 보고를 요청했다. 정상 소유권 검증 후 정리했다는 초기 후속 문장을 수락하지 않으며, 이 후속 Task는 허용 범위 밖 삭제로 **failed** 처리하도록 지시했다. 제품·회귀·미디어의 검증 결과와 절차 준수를 구분하고, 개별 삭제 대상의 소유권을 사후에 검증했다고 주장하지 않는다. 이 예외는 사용자에게 보고했으며 PR·Issue·Notion에도 연결한다. [Mars 원문·정정](../Mars/report.md)과 [독립 납품 검수](../Saturn/delivery-review.md)를 보존한다.

### PD 최종 보고 정정 확인

후속 Task의 `worker_done`(`msg_d7b921a0cd45`)이 허용 범위 밖 삭제로 **failed**를 보고했으며 PD는 이를 확인하고 해당 Dispatch를 archive/release했다. 실패 지시를 실제 실패 정산까지 반영했다.

Saturn의 [납품 delta](../Saturn/delivery-delta.md)는 최종 README 렌더를 PASS로 확인하면서 당시 읽은 Mars 보고의 사실 문장을 REVISE로 남겼다. 이후 PD가 실제 최종 보고 6·11절을 직접 대조했다(작업 파일 SHA256 `15779ac23fc8cc5f8bf7d5ba09b2f66a67fdedcfac17f1b1e009130af60c98cd`). 정정본에는 #128의 A·B 선개방 순서, README SHA256 `76ce2badfb79824299f87adfcbdbc6e3a9832ba042f18b2520fcafc4cd31cf0f`, 5·10번 캡션 정정과 두 폭 재렌더, 근사 CSS 및 390px 코드 블록 관측, 삭제24개의 소유권이 추정일 뿐이라는 한계가 반영됐다. 이는 **PD의 문서 사실 대조**이며 Saturn이 이후 정정 문장까지 재검수했다고 기록하지 않는다.

Mars 원문에 남은 사용자 브라우저를 건드리지 않았다는 넓은 영향 표현은 개별 삭제 경로의 소유권 검증을 대신하지 못한다. PD가 확인할 수 있는 범위는 보고된 세 접두사 삭제와 저장소 제품 해시의 불변이며, 다른 주체의 동일 접두사 디렉터리 영향은 확인되지 않았다. 따라서 절차 위반은 정정 후에도 해소된 것으로 처리하지 않는다. 기존 제품 Task의 성공 결과와 후속 Task의 실패를 함께 보존한다. 기존 Mars Dispatch의 자원은 후속 Dispatch로 소유권이 이전됐고 최종 소유자에서 release됐으므로 과거 Dispatch의 retained 표기만 보고 다시 종료하지 않는다.

## 검증·통합 게이트

| 게이트 | 상태 |
|---|---|
| Mars 제품·회귀·실브라우저 | 제품 기준 `aa6998a`·19종 회귀 PASS·[Chrome81/0 및 PNG20장](../Mars/artifacts/i146-browser-report.json)·튜토리얼10 촬영 |
| Saturn 독립 QA | [코어·헤드리스 PASS](../Saturn/core-review.md): 선택8종1062/0·독립63/0, 신규207/0. [납품 검수](../Saturn/delivery-review.md)·[최신 delta](../Saturn/delivery-delta.md): 제품·미디어·최종 렌더 PASS, 후속 보고 사실 정정은 REVISE로 남겨 PD가 후속 정정을 확인 |
| README·릴리스 노트·튜토리얼10·증빙 | 새146촬영본10장(2224×1636)·manifest·README20참조·캡션·출처 갱신, 해시/크기/바이트10/10 일치. [1100px](../Mars/artifacts/readme-verify/verify-report.json)·[390px](../Mars/artifacts/readme-verify/verify-report-w390.json) 최종 렌더 문제0·README SHA 일치, Saturn 직접 확인 |
| 필수 PR CI5·dev squash | [PR152](https://github.com/ChangjoSung/Digit-Duel/pull/152)에서 최종 head의 결과·병합 SHA 확인. 초기 head `d60085e`의 [CI5](https://github.com/ChangjoSung/Digit-Duel/actions/runs/34438359221)는 모두 PASS. 관리자 우회 없이 최종 head도 필수5검사 성공 후 dev squash |
| CJ Play QA | 대기 — 네 Issue OPEN 유지 |
| v0.4.7 출시 | 미실시 |

## 문서 반영 위치

| 기록 | 위치 |
|---|---|
| 승인 규칙·AC | [Venus 계약](../Venus/gameplay-spec.md) |
| 현행 Notion 규칙·결정 | GDD13 본문4.3·4.6과 DL45 / GDD18 |
| GitHub 상태 | Issue146·131·128·130 / Milestone13 |
| 조정·인수인계 | 이 보고 / [HANDOVER](../../../../../creat2ve/HANDOVER_SNAPSHOT.md) |
