# Digit-Duel — 인수인계 스냅샷

> 2026-09-10 · Mercury(PD, GPT-6 Astra/high). #146·#131·#128·#130의 개발 검증·문서·미디어를 [통합 PR152](https://github.com/ChangjoSung/Digit-Duel/pull/152)에서 관리한다. 최종 필수 CI와 dev 병합 상태는 PR이 원본이며 새 CJ Play QA 전까지 네 Issue는 OPEN이다. #128 신고는 미재현·원인 미확인, 후속 임시자료 정리 절차 위반은 아래에 보존한다. 정식 출시는 v0.4.5, Roblox #118은 v0.4.6, 이번 작업은 v0.4.7이다.

## 현재 승인 범위와 상태

- [#146](https://github.com/ChangjoSung/Digit-Duel/issues/146): HP 제한 없는 도망 기본30%·실패 추가 반격 삭제/자기 전투 행동1회. 도망의 수호자는 해당 배틀70%. 4슬롯 전부 불가 시 기본 공격 없이 수동 대기, 왕/동료 본체 기본 공격 유지. [최신 승인 계약](../milestone/v0.4.7/issues/146/Venus/gameplay-spec.md), GDD13 DL45·GDD18 기준.
- [#131](https://github.com/ChangjoSung/Digit-Duel/issues/131): 함정에 걸린 양쪽 대상의 선택·실행 차단과 첫 말→교체할 말 두 단계 안내.
- [#130](https://github.com/ChangjoSung/Digit-Duel/issues/130): 남은 보호막+이번 기술의 기존 부여량 합산. 신규 수치·상한·기간 없이 기존 흡수·화상 우회·초기화 유지.
- [#128](https://github.com/ChangjoSung/Digit-Duel/issues/128): 독립 Chrome 프로필/동일 HTTP origin에서 신고 증상 미재현. 최종 증빙은 A·B 탭을 먼저 열고 A 완료 후 B를 관측하며 이후 각 프로필의 미완료 재방문/완료 생략이 독립이다. 첫 navigation 순서를 확대하지 않는다. 저장 로직 무변경·회귀/증빙만 추가했고 CJ 재현 주소·브라우저를 질문했다. 물리 2PC나 신고 증상 해결 PASS가 아니다.
- 통합 원본은 [PR152](https://github.com/ChangjoSung/Digit-Duel/pull/152)(대상 dev)다. 작업 브랜치 `feature/146-battle-actions`는 출발 dev `33bbc19`에서 Roblox PR151의 `697212e`를 ff-only로 포함했다. 제품·촬영 기준 `aa6998ae8d2ca8b5fc8136c5fa19bc6aca5c12ea`, HTML blob `2a9b54c769a58fc5c0db9e913ce4421bec6758e3`, Windows SHA256 `b1c33ae8ff87e64cb71481714d73966f09e3af5f3b8506d82893dccb77f305de`. 신규 회귀207/0·19종 회귀·Chrome81/0·튜토리얼10장·최종 README1100/390 렌더를 검증했다. 문서 후속 커밋은 제품을 바꾸지 않는다.
- 이번 Run `run_c784a12efc36`: Venus(Claude) 규격·사용자 문서, Mars(Claude) 제품·테스트·촬영, Saturn(Codex) 전파일 쓰기0 독립 검수, Mercury 조정·Git·문서 메타데이터. [코어 PASS](../milestone/v0.4.7/issues/146/Saturn/core-review.md)와 [미디어/렌더 PASS·보고 정정 REVISE 원문](../milestone/v0.4.7/issues/146/Saturn/delivery-delta.md)을 구분한다. 완료 Worker는 보고 보존 후 release하고, 같은 Mars 터미널의 즉시 README 렌더 후속 Task에서 발생한 아래 절차 예외는 정상 완료로 수락하지 않는다. 실제 Task/Dispatch 상태는 Orca가 원본이다.
- **후속 정리 절차 위반**: Mars `task_c5532cf6d758`/`ctx_7799bd4b330b`가 `%TEMP%/i146cdp-main-*`, `profA-*`, `profB-*` 각8·합24개를 wildcard `rm -rf`로 삭제했다. 개별 절대경로·생성주체/시각 사전 대조가 없었고 같은 접두사 타 주체 자원 가능성을 배제하지 못한다. PD는 추가 수동 정리를 중지했고 후속 Task의 failed 보고를 확인한 뒤 archive/release했다. 제품/미디어 PASS를 절차 준수 PASS로 확대하지 않는다. 보고 문장 정정은 PD가 직접 대조했다. [경위·확인 한계](../milestone/v0.4.7/issues/146/Mercury/report.md).
- #121·#125·#129는 [PR143](https://github.com/ChangjoSung/Digit-Duel/pull/143) dev `2b47a23` 통합·CI5·Saturn PASS 후 2026-09-10 CJ QA PASS로 CLOSED다. 당시 제품/촬영 checkpoint `157026ba617166644ada0686b897d3ae2a166486`, [Saturn 보고](../milestone/v0.4.7/issues/121/Saturn/report.md)·[PD 보고](../milestone/v0.4.7/issues/121/Mercury/report.md)와 검수 한계는 보존한다. 당시 Worker는 전부 archive/release했다.
- [Milestone12 v0.4.6](https://github.com/ChangjoSung/Digit-Duel/milestone/12)은 [이욱채(lee775)](https://github.com/lee775)의 Roblox #118 전용이다. 해당 제품 수정·QA 판정·자원 정리를 이 PD가 대신하지 않는다.
- [Milestone13 v0.4.7](https://github.com/ChangjoSung/Digit-Duel/milestone/13)의 Infra #132/#134는 완료·CLOSED다. #134 [PR136](https://github.com/ChangjoSung/Digit-Duel/pull/136) dev `a073c0c`·CI5·Saturn·CJ QA PASS와 [절차 예외](../milestone/v0.4.7/issues/134/Mercury/report.md)를 보존한다.
- 실제 Claude 한도 중단 때만 같은 역할 Codex로 이어가는 CJ 승인은 유효하다. 이번 작업에서는 한도 중단이 관찰되지 않았다.


## 완료 이력 — 선행 Infra #132


- [Issue #132](https://github.com/ChangjoSung/Digit-Duel/issues/132): 기존 문서 자료 342개 중 306개를 버전·Issue·역할/용도별로 이동했다(Markdown 73개, 기타 233개). 36개는 상시 안내·운영 계약·공용 미디어로 유지한다. 고유 측정·REVISE·출처 증거를 보존하기 위해 순수 삭제·통합은 0건으로 판단했다. [전체 경로표](../milestone/MOVES.csv)가 원본 342개를 모두 대응한다.
- 이동 직후 306/306의 작업 트리 SHA256이 동일했다. 기존 57파일의 명시적 줄바꿈/whitespace 규칙도 새 경로로 옮겼다. Saturn 독립 READ_ONLY 검수에서 비 Markdown 250개(이동233+유지17)의 원본 blob, 이동 Markdown73개의 링크 외 본문, 제품·서버·승인 아트 보존을 확인했다. 문서 검사106개·내부 참조332건 문제0, 링크 검사기 회귀34건과 AI 완주13경기·59단언을 검증했다.
- 개발 브랜치 `infra/132-docs-actions`, 분기 기준 `origin/dev 39f022293008d352e4709762af07e42d63fb557e`. PD는 Git·문서 메타데이터, Venus(Claude)는 Markdown, Mars(Claude)는 Actions·도구·테스트를 담당했다. 통합 PR은 #133 하나이며 제품·서버 런타임·승인 아트의 내용은 동일하다.
- 실제 [PR CI 실행](https://github.com/ChangjoSung/Digit-Duel/actions/runs/34310450164)(검수 head `c06ee3909d4ad5cbbefb5fc118e4ad5bf36de900`)에서 규칙·AI, Linux 서버, Windows 실행기, 문서, 납품 아트의 **5개 잡 모두 PASS**. D는 Windows2025/Python3.14.3/Pillow12.3.0에서 write0·unchanged29·mismatch0 및 도구68검사 PASS, C는 현재 v0.4.5 매니페스트로 검증했다. 이후 주석·운영 상태 정정 커밋의 최종 실행은 PR의 검사 목록을 따른다. Saturn은 후속 변경과 실제 CI·보호 설정까지 독립 확인했다.
- main/dev 보호 설정을 적용·readback했다: PR 필수, GitHub Actions 앱15368의 5개 검사 필수, 최신 base 요구, 관리자도 적용, 대화 해결 필수, force push·삭제 금지, 승인 리뷰 수0. 승인 리뷰 수0은 Saturn/CJ 운영 계약을 없애지 않는다. 워크플로는 dev 통합 후 차기 릴리스 PR로 main에 전달하며 수동 실행은 기본 브랜치 main에 파일이 도달한 뒤 가능하다. 이번 실증은 dev PR CI이며 main PR·수동 실행을 실증했다고 주장하지 않는다.
- 당시 Milestone12(v0.4.6)에 게임119–131·기존118·Infra132가 함께 등록돼 있었다. CJ의 후속 결정에 따라 현재 소속은 위 v0.4.6/v0.4.7로 분리됐다. `feature/118-roblox-port`는 이 PD 작업의 변경·정리 대상이 아니다.
- [GDD17 분석 원장](https://app.notion.com/p/3d61e7f170858126a889e682610ebad7): 기술 23개(정상 도달 22), 20종 80슬롯, 6개 탐색 이벤트의 말별 결과와 근거·미정 정책을 기록했다. #123 공용 아트는 #119 기획 후, #124 동료·왕 아트는 독립 목표다. #131에는 함정 하수인의 텔레포트 선택 차단과 지정 문구가 등록돼 있다. **위 후보 중 최신 CJ가 지정한 #121/#125/#129 및 #146/#131/#128/#130만 승인 범위다. 나머지 미지정 기획·아트·외부망·출시는 착수하지 않는다.**

## 출시와 제품 근거

- 최신 정식 [v0.4.5 Release](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.5), [Milestone11](https://github.com/ChangjoSung/Digit-Duel/milestone/11) CLOSED. [Issue114](https://github.com/ChangjoSung/Digit-Duel/issues/114)·PR115 구현, PR116 출시 문서, PR117 릴리스 완료. **2026-09-08 CJ 플레이 QA PASS·배포 승인**, 제품·문서·미디어 Saturn 독립 PASS.
- v0.4.5 main/origin/main 및 annotated tag 대상 `39a3af12a9b4dd5e8f82776f0f0d21994034387c`. 이번 작업은 dev 대상이며 새 태그·Release를 만들지 않는다.
- **v0.4.5 출시 제품** `demo/index.html` Git blob `61a3ce3e5927697ea80ec8ebd379ffb98ebfdb92`, LF SHA256 `f742b6ba205fbcba2f3081134057dbccb81193fb55b24d5140df16be7a90fc33`. 원 검수 커밋 `5de47a9db4960ae7392e85ed3a811248743d090b`에서 과거 README 튜토리얼 PNG10장과 manifest를 만들었고 당시 독립 재캡처 10/10 바이트 일치를 확인했다. 현재 개발판의 코드·검사 결과로 재사용하지 않는다. Windows 작업 트리 CRLF와 Git blob의 LF를 혼동하지 않는다.
- v0.4.5 납품: 무제한 텔레포트, 양측 밀기·공동 안전 재배치와 후보 부재 예외, 함정 강제 이동, 도망 소유자의 보드 선택/생략, 조건부 턴 종료·만피 회복 대기, 튜토리얼 10단계·README 갱신. [게임플레이 계약](../milestone/v0.4.5/specs/v0.4.5-gameplay-spec.md), [읽는 판](../milestone/v0.4.5/specs/v0.4.5-rules-digest.md), [PD 검수 보고](../milestone/v0.4.5/issues/114/Mercury/issue114-pd-report.md), [후속 미디어 보고](../milestone/v0.4.5/issues/114/Mars/issue114-mars-followup.md).
- v0.4.4: Milestone10 CLOSED, PR111, main/tag `aff981217e33c88e8685adebe10351b6d5c5100d`, 제품 blob `f580e4f9aa4b5ce3daceef940891a875586a1e34`. v0.4.3: Milestone7 CLOSED, PR97, main/tag `cc3f382496473233334f374896d46639b83d7974`. 과거 태그를 이동·재발행하지 않는다.

## 보존해야 할 검수 한계와 기록

- [v0.4.4 1차 취합](../milestone/v0.4.4/reports/Mercury/v044-pd-report.md), [후속 취합](../milestone/v0.4.4/reports/Mercury/v044-followup-pd-report.md)에 #91–#96·#104–#106의 구현·QA·초기 REVISE·정정 수치를 보존한다. [버전별 문서](../milestone/README.md)에서 개별 역할 보고를 찾는다. 과거 수치나 단계별 PASS를 현 제품에서 재실행한 결과로 바꾸지 않는다.
- #104 시점 감사의 기본 소스는 과거 고정 ref다. **현재 제품은 `node demo/test/regression/smoke_orientation_audit.js --path demo/index.html`로 검사한다.** 원 CJ 경기 전체를 자동 재현했다는 뜻은 아니다.
- 실제 원격 LAN 두 기기·물리 모바일·비Chrome·모든 백그라운드 일정·사람 밸런스 통계는 기존 미측정 범위다. 일부 Chrome 검수는 연출 시간 단축과 명시적 fixture를 사용했다. 기존 좁은 화면의 전체 페이지 가로 넘침, 포획 예비 HP70/100의 비율 판정 불리함, 보드 AI의 본체 속성 근사와 감전 순서 부채를 보존한다.
- [Issue106 절차 위반](../milestone/v0.4.4/issues/106/Mercury/issue106-pd-incident.md): 과거 Worker의 테스트 Git 복원·프로필 접두사 기반 Chrome 종료. 파일은 HEAD와 같고 Saturn 영향은 관찰되지 않았지만 전체 종료 대상의 소유권은 입증되지 않았다. 같은 방식을 반복하지 않는다.
- #104의 과거 `README.txt`가 가리키는 로그 3개는 작업 트리에 있으나 `*.log` 무시 규칙으로 저장소에 포함되지 않았다. 이 작업에서 재생성·force add·삭제하지 않는다. **추적 문서의 옛 `docs/qa/` 경로를 비웠다는 말은 미추적 로그 폴더까지 제거했다는 뜻이 아니다.**
- #132 분석 중 Mars가 `du -sh --exclude=.git .`로 전체 폴더 용량을 집계하며 보호 경로 메타데이터도 조회한 1건을 확인했다. 관찰된 명령은 내용 읽기나 수정이 아닌 용량 집계였으며, PD가 즉시 추적 파일·명시적 허용 경로만 조회하도록 정정하고 CJ에게 보고했다.
- #132 최초 [CI 실행](https://github.com/ChangjoSung/Digit-Duel/actions/runs/34309177070)은 D에서 PNG14장+매니페스트1건 불일치로 실패했다. 승인 파일·비교 기준을 보존하고 납품 환경으로 맞춘 뒤 성공했다. 압축 구현 차이는 강한 추론이며 Linux 생성 PNG의 픽셀을 직접 비교한 것은 아니다. README 미디어 도구의 SHA 불일치는 기존 WARN 정책이며, 문서 검사기도 외부 URL·제목 앵커·모든 CommonMark 구문을 검증하지 않는다. 상세 관측·정정·한계는 [Mars 보고](../milestone/v0.4.7/issues/132/Mars/report.md)에 보존한다.
- #134 분석 Worker는 `mutation=none`에서 임시 보고 파일을 실제 작성했다. “파일 쓰기0” 보고를 `role_scope_mismatch`로 수락 거부하고 Task를 failed로 정정했다. 증거를 보존한 채 새 구현 Task의 입력으로만 이어갔다. [정정 기록](../milestone/v0.4.7/issues/134/Mercury/report.md)과 Issue134에 남기며 정상 준수로 소급하지 않는다.

## 역할·자원 소유권

- **Mercury = 조정·Git·문서 메타데이터.** 제품·런타임·빌드·도구·테스트는 소규모라도 Mars/Jupiter로 보낸다. 최신 CJ 지시로 **Venus/Mars/Jupiter는 Claude**, Earth/Saturn/Mercury는 Codex다. 과거 Claude quota 대체 이력 때문에 정상 Claude Worker를 계속 Codex로 배치하지 않는다.
- Saturn은 **READ_ONLY**, 파일·테스트·보고서·임시 파일을 쓰지 않고 inline으로 보고한다. 파일을 변이하는 원본 `smoke_online.js`나 임시 fixture를 만드는 도구 회귀는 Saturn의 직접 READ_ONLY 실행에서 제외하고 구현자/CI 결과와 독립 검토 범위를 구분한다.
- 필수 dispatch preflight: `required_role · mode · area · mutation · instance_index`. Worker Git/GitHub/Notion 쓰기 금지. 완료 뒤 결과 archive/release, 같은 좁은 범위의 즉시 후속만 기한부 재사용. Task와 정확한 Dispatch를 연결하고 메시지 전체를 처리한 뒤 acknowledge한다.
- Worker의 메시지 조회는 자신의 `check --terminal <worker-terminal> --json`을 사용한다. coordinator용 `--run`을 붙여 받은 `consumer_fenced`를 메시지 없음으로 해석하지 않는다. PD가 잘못 전달했던 문법은 이 방식으로 정정했다.
- 현재 유일한 Mercury terminal `term_d2dcbfa3-a932-4ce2-a844-38526dd4975b`, 현재 네 Issue Run `run_c784a12efc36`, 완료 #121·#125·#129 Run `run_a30f84eaadf5`, 완료 분석 Run `run_0542beb5fd69`. 완료 Infra #134 Run `run_748eb7b6a85d`, #132 Run `run_874bb77b02e3`, 최초 등록 Run `run_a9eb05e6575e`의 이력은 보존한다. 현재 Worker 상태는 Orca task/worker list가 원본이다.
- **사용자 소유 미추적 `art/`·`orca-hook-latency-report.md`는 읽기·수정·스테이징 금지.** Downloads 원본과 승인 아트100파일을 보존한다. 파일 탐색은 이 두 루트 경로를 포함하지 않는 명시적 범위 또는 Git 추적 목록을 사용한다.
- 기존 Mercury `term_abae9146-14a1-47e9-8e9a-0a6e3c4c041a`, 사용자 소유 `term_f715b1c1-8dc5-438c-b035-540ab8b4082e`, 과거 Saturn `ctx_7587a359d6a6` user_owned, `ctx_bbc10559f749` identity_unproven 및 다른 소유권 불명 자원은 종료·정리하지 않는다. 프로세스·프로필 정리는 해당 실행에서 생성과 소유권을 확인한 정확한 대상에만 한다.
- 이전 세션 압축15회, 2026-09-08 17:47:40 KST 92,019/258,400·단순 차감64.4% 여유는 **현재 세션의 사용량이 아니며 판단력 저하의 입증도 아니다**. [당시 자가 점검](../milestone/v0.4.4/reports/Mercury/mercury-self-audit-2026-09-08.md). 추가 PD 스폰이나 세션 교대 없이 현재 Mercury가 창구를 유지한다.

## Notion·GitHub와 다음 게이트

- [GDD13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) DL38 = 최초 v0.4.6 분석·등록 이력, DL39 = 선행 Infra132, DL40 = v0.4.6 Roblox/v0.4.7 재배치·후속 Infra134. 현재 규칙 참조 경로는 새 문서 위치로 동기화하고, 과거 Decision Log의 GitHub 링크는 이동 전 SHA에 고정했다. GitHub 과거 Issue/PR 본문·코멘트 13곳의 링크34개도 고정·응답 일치 확인했다. 기존 Release8개는 버전 태그 링크라 그대로 유효하다.
- Notion System 원문 `3d51e7f1708580b0916ded4bd3d9d06e`의 외부 편집 Summary는 보존한다. Project=Digit Dual, Edit Date=실제 수정일, Editor=실제 사람 성창조(`8e0a8270-d0e3-407e-a7d2-b3f992f1e366`); Agent 이름은 운영 본문에만 기록한다.
- GDD13 DL42와 [GDD18](https://app.notion.com/p/3d61e7f17085809ea410fe6a1431f06c)에 #121·#125·#129 최종 승인 계약을 동기화했다. 현재 코드를 검수한 Saturn PASS와 통합 PR 최종 head의 필수 검사 성공이 dev squash의 전제다. 전용 작업 브랜치만 정리하고 main/dev는 보존한다. 세 Issue는 2026-09-10 CJ QA PASS로 CLOSED다. 후속 네 Issue는 DL45 승인 계약과 PR152의 개발 검증·통합 기록을 따르며 새 CJ QA 전까지 OPEN이다. 과거 PASS를 새 변경의 근거로 재사용하지 않는다.
