# Digit-Duel — 인수인계 스냅샷

> 2026-09-09 · Mercury(PD, GPT-6 Astra/high). 최신 CJ 지시는 선행 Infra #132 문서 정리·HTML PR Actions 연동이다. 현재 게임 출시는 v0.4.5이며 v0.4.6 게임 Issue는 번호별 착수 지시를 기다린다. 실제 HEAD·PR·검사 상태는 Git/GitHub가 원본이다.

## 현재 승인 범위와 상태

- [Issue #132](https://github.com/ChangjoSung/Digit-Duel/issues/132): 기존 문서 자료 342개 중 306개를 버전·Issue·역할/용도별로 이동했다(Markdown 73개, 기타 233개). 36개는 상시 안내·운영 계약·공용 미디어로 유지한다. 고유 측정·REVISE·출처 증거를 보존하기 위해 순수 삭제·통합은 0건으로 판단했다. [전체 경로표](../milestone/MOVES.csv)가 원본 342개를 모두 대응한다.
- 이동 직후 306/306의 작업 트리 SHA256이 동일했다. 기존 57파일의 명시적 줄바꿈/whitespace 규칙도 새 경로로 옮겼다. 문서 링크·인덱스와 도구 경로·CI 구현, 최종 독립 검수와 실제 PR 실행을 진행 중이다. 검증 전 PASS로 간주하지 않는다.
- 브랜치 `infra/132-docs-actions`, 분기 기준 `origin/dev 39f022293008d352e4709762af07e42d63fb557e`. PD가 Git·문서 메타데이터, Venus(Claude)가 Markdown, Mars(Claude)가 Actions·도구·테스트를 담당한다. 제품 파일·서버 런타임·승인 아트의 내용을 바꾸지 않는다.
- [Milestone12 v0.4.6](https://github.com/ChangjoSung/Digit-Duel/milestone/12): 게임 #119–#131의 분석·등록 13건, 기존 #118, 선행 Infra #132를 관리한다. OPEN/CLOSED 수는 실시간 목록을 따른다. #118은 CJ 계정의 연결을 확인해 보존한 별도 Roblox 작업이다. `feature/118-roblox-port`는 이 PD 작업의 변경·정리 대상이 아니다.
- [GDD17 분석 원장](https://app.notion.com/p/3d61e7f170858126a889e682610ebad7): 기술 23개(정상 도달 22), 20종 80슬롯, 6개 탐색 이벤트의 말별 결과와 근거·미정 정책을 기록했다. #123 공용 아트는 #119 기획 후, #124 동료·왕 아트는 독립 목표다. #131에는 함정 하수인의 텔레포트 선택 차단과 지정 문구가 등록돼 있다. **이 후보들을 현재 규칙으로 적용하거나 게임 구현·아트 제작·외부망 개방·재릴리스를 시작하지 않는다.**

## 출시와 제품 근거

- 최신 정식 [v0.4.5 Release](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.5), [Milestone11](https://github.com/ChangjoSung/Digit-Duel/milestone/11) CLOSED. [Issue114](https://github.com/ChangjoSung/Digit-Duel/issues/114)·PR115 구현, PR116 출시 문서, PR117 릴리스 완료. **2026-09-08 CJ 플레이 QA PASS·배포 승인**, 제품·문서·미디어 Saturn 독립 PASS.
- v0.4.5 main/origin/main 및 annotated tag 대상 `39a3af12a9b4dd5e8f82776f0f0d21994034387c`. 이번 Infra는 dev 대상이며 새 게임 버전·태그·Release를 만들지 않는다.
- 현재 제품 `demo/index.html` Git blob **`61a3ce3e5927697ea80ec8ebd379ffb98ebfdb92`**, LF SHA256 `f742b6ba205fbcba2f3081134057dbccb81193fb55b24d5140df16be7a90fc33`. 원 검수 커밋 `5de47a9db4960ae7392e85ed3a811248743d090b`에서 README 튜토리얼 PNG10장과 manifest를 만들었고 독립 재캡처 10/10 바이트 일치를 확인했다. Windows 작업 트리 CRLF와 Git blob의 LF를 혼동하지 않는다.
- v0.4.5 납품: 무제한 텔레포트, 양측 밀기·공동 안전 재배치와 후보 부재 예외, 함정 강제 이동, 도망 소유자의 보드 선택/생략, 조건부 턴 종료·만피 회복 대기, 튜토리얼 10단계·README 갱신. [게임플레이 계약](../milestone/v0.4.5/specs/v0.4.5-gameplay-spec.md), [읽는 판](../milestone/v0.4.5/specs/v0.4.5-rules-digest.md), [PD 검수 보고](../milestone/v0.4.5/issues/114/Mercury/issue114-pd-report.md), [후속 미디어 보고](../milestone/v0.4.5/issues/114/Mars/issue114-mars-followup.md).
- v0.4.4: Milestone10 CLOSED, PR111, main/tag `aff981217e33c88e8685adebe10351b6d5c5100d`, 제품 blob `f580e4f9aa4b5ce3daceef940891a875586a1e34`. v0.4.3: Milestone7 CLOSED, PR97, main/tag `cc3f382496473233334f374896d46639b83d7974`. 과거 태그를 이동·재발행하지 않는다.

## 보존해야 할 검수 한계와 기록

- [v0.4.4 1차 취합](../milestone/v0.4.4/reports/Mercury/v044-pd-report.md), [후속 취합](../milestone/v0.4.4/reports/Mercury/v044-followup-pd-report.md)에 #91–#96·#104–#106의 구현·QA·초기 REVISE·정정 수치를 보존한다. [버전별 문서](../milestone/README.md)에서 개별 역할 보고를 찾는다. 과거 수치나 단계별 PASS를 현 제품에서 재실행한 결과로 바꾸지 않는다.
- #104 시점 감사의 기본 소스는 과거 고정 ref다. **현재 제품은 `node demo/test/smoke_orientation_audit.js --path demo/index.html`로 검사한다.** 원 CJ 경기 전체를 자동 재현했다는 뜻은 아니다.
- 실제 원격 LAN 두 기기·물리 모바일·비Chrome·모든 백그라운드 일정·사람 밸런스 통계는 기존 미측정 범위다. 일부 Chrome 검수는 연출 시간 단축과 명시적 fixture를 사용했다. 기존 좁은 화면의 전체 페이지 가로 넘침, 포획 예비 HP70/100의 비율 판정 불리함, 보드 AI의 본체 속성 근사와 감전 순서 부채를 보존한다.
- [Issue106 절차 위반](../milestone/v0.4.4/issues/106/Mercury/issue106-pd-incident.md): 과거 Worker의 테스트 Git 복원·프로필 접두사 기반 Chrome 종료. 파일은 HEAD와 같고 Saturn 영향은 관찰되지 않았지만 전체 종료 대상의 소유권은 입증되지 않았다. 같은 방식을 반복하지 않는다.
- #104의 과거 `README.txt`가 가리키는 로그 3개는 작업 트리에 있으나 `*.log` 무시 규칙으로 저장소에 포함되지 않았다. 이 작업에서 재생성·force add·삭제하지 않는다. **추적 문서의 옛 `docs/qa/` 경로를 비웠다는 말은 미추적 로그 폴더까지 제거했다는 뜻이 아니다.**
- #132 분석 중 Mars가 `du -sh --exclude=.git .`로 전체 폴더 용량을 집계하며 보호 경로 메타데이터도 조회한 1건을 확인했다. 관찰된 명령은 내용 읽기나 수정이 아닌 용량 집계였으며, PD가 즉시 추적 파일·명시적 허용 경로만 조회하도록 정정하고 CJ에게 보고했다.

## 역할·자원 소유권

- **Mercury = 조정·Git·문서 메타데이터.** 제품·런타임·빌드·도구·테스트는 소규모라도 Mars/Jupiter로 보낸다. 최신 CJ 지시로 **Venus/Mars/Jupiter는 Claude**, Earth/Saturn/Mercury는 Codex다. 과거 Claude quota 대체 이력 때문에 정상 Claude Worker를 계속 Codex로 배치하지 않는다.
- Saturn은 **READ_ONLY**, 파일·테스트·보고서·임시 파일을 쓰지 않고 inline으로 보고한다. 파일을 변이하는 원본 `smoke_online.js`나 임시 fixture를 만드는 도구 회귀는 Saturn의 직접 READ_ONLY 실행에서 제외하고 구현자/CI 결과와 독립 검토 범위를 구분한다.
- 필수 dispatch preflight: `required_role · mode · area · mutation · instance_index`. Worker Git/GitHub/Notion 쓰기 금지. 완료 뒤 결과 archive/release, 같은 좁은 범위의 즉시 후속만 기한부 재사용. Task와 정확한 Dispatch를 연결하고 메시지 전체를 처리한 뒤 acknowledge한다.
- 현재 유일한 Mercury terminal `term_d2dcbfa3-a932-4ce2-a844-38526dd4975b`, 현재 Infra Run `run_874bb77b02e3`. v0.4.6 등록 Run `run_a9eb05e6575e`의 완료·한도 중단 이력은 보존한다. 현재 Worker 상태는 Orca task/worker list가 원본이다.
- **사용자 소유 미추적 `art/`·`orca-hook-latency-report.md`는 읽기·수정·스테이징 금지.** Downloads 원본과 승인 아트100파일을 보존한다. 파일 탐색은 이 두 루트 경로를 포함하지 않는 명시적 범위 또는 Git 추적 목록을 사용한다.
- 기존 Mercury `term_abae9146-14a1-47e9-8e9a-0a6e3c4c041a`, 사용자 소유 `term_f715b1c1-8dc5-438c-b035-540ab8b4082e`, 과거 Saturn `ctx_7587a359d6a6` user_owned, `ctx_bbc10559f749` identity_unproven 및 다른 소유권 불명 자원은 종료·정리하지 않는다. 프로세스·프로필 정리는 해당 실행에서 생성과 소유권을 확인한 정확한 대상에만 한다.
- 이전 세션 압축15회, 2026-09-08 17:47:40 KST 92,019/258,400·단순 차감64.4% 여유는 **현재 세션의 사용량이 아니며 판단력 저하의 입증도 아니다**. [당시 자가 점검](../milestone/v0.4.4/reports/Mercury/mercury-self-audit-2026-09-08.md). 추가 PD 스폰이나 세션 교대 없이 현재 Mercury가 창구를 유지한다.

## Notion·GitHub와 다음 게이트

- [GDD13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) DL38 = v0.4.6 분석·등록, DL39 = 선행 Infra132. 현재 규칙 참조 경로는 새 문서 위치로 동기화하고, 과거 Decision Log의 GitHub 링크는 이동 전 SHA에 고정했다. GitHub 과거 Issue/PR 본문·코멘트 13곳의 링크34개도 고정·응답 일치 확인했다. 기존 Release8개는 버전 태그 링크라 그대로 유효하다.
- Notion System 원문 `3d51e7f1708580b0916ded4bd3d9d06e`의 외부 편집 Summary는 보존한다. Project=Digit Dual, Edit Date=실제 수정일, Editor=실제 사람 성창조(`8e0a8270-d0e3-407e-a7d2-b3f992f1e366`); Agent 이름은 운영 본문에만 기록한다.
- Infra의 다음 게이트: 문서·툴링 완료 → Saturn 독립 READ_ONLY 검수 → 통합 PR·실제 Actions 성공 → main/dev 필수 검사 보호 설정 확인 → dev squash 통합·전용 브랜치 정리·CJ 보고. main/dev 자체는 삭제하지 않는다. Issue 종결은 CJ PASS 또는 완료 보고 뒤 다음 Comment 무이의 계약을 따른다.
