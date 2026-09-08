# Digit-Duel — 인수인계 스냅샷

> 2026-09-08 · Mercury(PD, GPT-6 Astra/high) 인수 완료. v0.4.5 제품·문서·미디어 독립 QA 및 CJ 플레이 QA PASS, 배포 승인 반영. 실제 dev/main HEAD·PR 병합·Release 상태는 Git/GitHub가 원본이다.

## 현재 상태

- 현재 출시 버전 **[v0.4.5](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.5)**. [Issue #114](https://github.com/ChangjoSung/Digit-Duel/issues/114)·[통합 PR #115](https://github.com/ChangjoSung/Digit-Duel/pull/115)의 무제한 텔레포트, 양측 밀기·공동 안전 재배치·부재 예외, 함정 강제 이동, 도망 소유자 보드 선택/생략, 조건부 종료·만피 회복 대기, 튜토리얼10단계·README 캡처를 납품했다. **제품·문서·미디어 Saturn 독립 PASS, 2026-09-08 CJ 플레이 QA PASS 및 배포 승인**. 출시용 README·노트·규칙 정리본·Milestone 정리를 집행한다. 실제 발행 결과와 릴리스 PR/main SHA는 Release·Issue114가 원본이다.
- [v0.4.4 Release](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.4), [Milestone10](https://github.com/ChangjoSung/Digit-Duel/milestone/10). 릴리스 PR은 dev→main merge commit, 버전 태그는 그 main 커밋을 가리킨다. main/dev 장수 브랜치를 삭제하지 않는다.
- 이전 v0.4.4 릴리스 PR **#111**, 당시 main/origin/main 및 annotated tag **aff981217e33c88e8685adebe10351b6d5c5100d**. 출시 당시 dev는 **ceca7ed7009debfcec17a6efb65dd59e1d11ed5a**이며 main/dev 트리는 같았다. 이후 v0.4.5 개발로 현재 HEAD·제품과는 다르다. 과거 태그를 이동하거나 다시 출시하지 않는다.
- #91·92·94·95·96은 이전 CJ PASS로 종료했고, 이번 최종 PASS로 #104→부모#93·#105·#106도 종료했다. v0.4.4 범위에 미승인 구현은 없다.
- v0.4.4 검수 제품은 PR109 squash **a6fdaad752a8ffedadd2781dfb5d95018273575f**다. 당시 이후 릴리스 준비는 문서만 변경했다. v0.4.5 현재 검수 제품은 **5de47a9db4960ae7392e85ed3a811248743d090b**, blob **61a3ce3e5927697ea80ec8ebd379ffb98ebfdb92**, LF SHA256 **f742b6ba205fbcba2f3081134057dbccb81193fb55b24d5140df16be7a90fc33**이다. 이 정확한 SHA에서 README PNG10장과 manifest를 생성했고 독립 재캡처10/10 바이트 일치를 확인했다. PR115 squash dev `f4ae0870ce7f7316f22d96ff4ec7184f8943b469`에서 제품 blob·전체 트리 일치를 확인했다. 이후 출시 준비는 문서 메타데이터만 바꾼다.
- v0.4.4 출시 제품 Git blob **f580e4f9aa4b5ce3daceef940891a875586a1e34**, 당시 LF SHA256 **a4932cb80a1407fc728ace6ee918315880840c76010de7b21361a7f618e97280**는 이전 출시 근거다. v0.4.5 제품과 혼동하지 않는다. Windows 줄바꿈 차이는 Git blob으로 구분한다.
- 이전 v0.4.3은 main/tag **cc3f382496473233334f374896d46639b83d7974**, PR97·Milestone7 완료 이력으로 보존한다. 과거 태그를 다시 만들지 않는다.
- **[Milestone11 v0.4.5](https://github.com/ChangjoSung/Digit-Duel/milestone/11)**: CJ PASS로 범위 완료, 릴리스 발행 후 종결. 턴 행동 정리·문서·튜토리얼 갱신. 이전 공용 하수인·아트·밸런스는 보류 기획이며 이번 구현 승인에 포함하지 않는다. 수풀 탐색 전면 점검은 CJ 원문상 v0.4.6 예정이다. 마일스톤11개를 실제 출시·계획에 맞춰 정리했고 상태·연결 항목은 보존했다.
- **사용자 소유 미추적 art/·orca-hook-latency-report.md는 접근·수정·스테이징 금지.** 승인 아트100파일과 Downloads 원본도 보존한다.

## 역할·작업자

- Mercury = 조정·Git·문서 메타데이터. 제품·도구·테스트는 Mars(Client/Claude) 또는 Jupiter(Server/Claude), 기획은 Venus(Claude), 아트는 Earth(Codex), 독립 QA는 Saturn(Codex READ_ONLY)으로 라우팅한다.
- **CJ 실행기 예외 승인(2026-09-08):** Claude 주간 사용량94%로 중단 가능성을 알렸고, 실제 한도 오류·진행 불가가 확인되면 Codex에 인계해 계속 구현하도록 지시했다. 같은 역할·파일 소유권·검수 절차는 유지하고 실행기만 Codex로 바꾼다. 기존 작업자의 중단과 변경 파일을 확인한 후 후임을 시작해 중복 편집을 막는다. 이 전환을 재승인 요청하지 않는다.
- Issue114 작업자는 완료 보고 후 archive/release했다: Codex Mars 구현 ctx_e7c4f5e3f0b1 → 보완·캡처 ctx_9351b9848b46, Codex Venus ctx_077ea36bfc54, Saturn_1 문서 ctx_674abc8d97d2 → 보완 ctx_441aec18d976, Saturn_2 제품 ctx_d1c90945267a → 미디어 ctx_4bf2f32acd0c. 초기 AI 평가값·SVG 잘림·Notion 현재 문구 REVISE를 보완해 모두 PASS다. Claude quota로 멈춘 Mars ctx_571ae06b55e2·Venus ctx_ec8ec326d97d는 exact stop 후 failed/process_exited를 확인했다. 종료 경합의 dispatch_inactive 및 identity_unproven retained 메타데이터는 강제 정리하지 않았다. 자동 재개와 중복 작업은 없다. [PD 보고](../qa/issue114-pd-report.md)에 역할·판정·절차·한계를 보존했다.
- 현재 Mercury terminal **term_d2dcbfa3-a932-4ce2-a844-38526dd4975b**, Run **run_3719d466e1d2**. v0.4.5 분석 Venus ctx_a5fa47f469e3·Mars ctx_3d36f46320b7 및 문서QA Saturn ctx_60d56ed6a48e 모두 수정0·inline 보고 후 archive/release 완료. 상세 근거는 분석 취합6장.
- 이전 Run **run_195c28ae423a**, PD terminal **term_abae9146-14a1-47e9-8e9a-0a6e3c4c041a**. 마지막 Mars_2 ctx_7e1fba3a5a28, Saturn_2 ctx_db164ebf2352 모두 exact terminal release 완료.
- 사용자 소유 terminal **term_f715b1c1-8dc5-438c-b035-540ab8b4082e** 및 과거 Saturn ctx_7587a359d6a6 user_owned retained는 재사용/종료 금지. ctx_bbc10559f749의 identity_unproven 메타데이터도 강제 정리하지 않는다.
- Saturn은 어떤 파일도 수정하지 않는다. filesModified=[]의 inline 보고를 PD가 보존한다. 원본 smoke_online.js는 디스크 변이를 쓰므로 READ_ONLY 실행에 사용하지 않는다.

## 이전 v0.4.4 릴리스 범위와 근거

### #91~#96 및 #104

- 탐색 공용 하수인 대리 출전 아트 연결, 다른 속성 공격기 획득·교체, 양측 자기 진영 하단 표시, 상대 턴 메모, 공격형 atk26→25·결정타44→40, 일반 감전70→50%.
- #104 확정 결함: 숨은 말 충돌 이동을 수신측이 로컬 뷰어 시야로 판단해 메모 분기로 버림. visibleTo(S.current,p)로 행동자 시야를 통일했다. PR107 dev6baa0b5, Saturn 신규23·기존852·실제Chrome22 PASS.
- CJ의 추가 지시에 따라 65턴 전후·중앙선·모든7열을 감사했다. 현재2P는 행만14-r로 반사하고 열은 유지한다. 중간에 방향이 바뀌는 경로는 발견하지 못했다.
- 고정104 수정본 시점 감사: 독립8,916/0·Chrome20/0·80클릭 전송좌표 불일치0·118회 보드 픽셀/hit-test. 14경기의 전체 횡단은 헤드리스, 실제 Chrome은 전65 양측2/12행과 후65 상대숲5/9행까지다.
- 초기 감사 도구의 실패 집계 오류는 REVISE 후 수정했다. 독자 소유자 변이28건이 exit1로 검출됐다. 원CJ 경기 전체를 자동으로 재현한 것은 아니며, 이후 CJ 플레이 QA PASS는 별도의 최종 승인이다.
- 근거: docs/qa/issue104-mars.md, issue104-saturn.md, issue104-orientation-saturn-first.md, issue104-orientation-saturn-final.md.
- 현재 제품 감사는 **smoke_orientation_audit.js --path demo/index.html**로 선택한다. 도구 기본 고정104 결과를 최신 제품 결과로 혼동하지 않는다.

### #105 README / Releases

- PR108 dev40415c2. 소개 그림·실제 보드/전투·v0.4.3 튜토리얼10장·8개 소개 범주로 README를 개편했다.
- 이전 Release6개 본문은 게시 완료했고 태그·날짜·대상·첨부자산을 보존했다. 원본 백업 .git/releases-before-renewal.json.
- Saturn은1100/390px·이미지 원본20클릭·튜토리얼10/10 재캡처 일치를 검증했다. GitHub 정제 HTML+근사CSS 검수이지 전체 GitHub 화면 동일성 주장은 아니다.
- 이번 릴리스에서는 README 최신 버전/패치노트와 기존 최종 전투 캡처 링크만 갱신했다. 튜토리얼 이미지는 v0.4.3 이력임을 명시했다.
- 근거: docs/qa/issue105-pd-report.md, issue105-saturn-final.md, docs/releases/v0.4.4.md.

### #106 턴 흐름

- 회복 지정은 주 행동을 소모한다. 지정한 턴 종료부터 나/상대 각각의 턴마다 최대HP5%, 두 턴 합계10%. 별도 즉시 틱은 없고 여러 말에 지속, 만피에서도 자세 유지. 해당 말의 이동/탐색/텔레포트/전투/밀어내기/도망스왑 등은 틱 전에 해제한다. 예비·폭탄·함정은 제외, 미공개 상대 회복 정보는 숨긴다.
- 함정과 걸린 말 모두 공개·이동제한2. 폭탄 직접 신규접촉도 발동: 하수인은 양측 제거, VIP는 폭탄만, 폭탄/함정에는 무효. 기존 인접·무효대상 재선택으로 반복 발동하지 않는다.
- 65턴 진입 정확한 “버닝타임입니다! 2칸씩 이동 가능합니다” 안내2초 후 일반 턴 안내2초. 경기당1회·양측·입력 잠금.
- 전투4메뉴, 카운트 각1초, 기술2초→피해2초, 아이템2초, 결과2.5초. 보호막 감소 후600ms부터 HP 감소, 두 변화는 기존 피해2초 안에서 끝난다.
- 6라운드 잔여HP/maxHP 판정, 동률 방어자 승, 보호막 제외. 행동 소진 시 자동 종료하며 선택 전투·강제 대상·모달·텔레포트·연출이 남으면 종료하지 않는다. 온라인 행동자만 전송한다.
- 첫 후보 a20의 구세대 메시지 큐 삭제·HP 우선 표시·도망 후 추가 접촉 배너 소실3건은 Saturn REVISE 후 수정했다. 최종 a493 독립 **규칙198/0·타이머36/0·기술교체116/0·cycle5 69/0·아트199/0·현재시점8910/0·Chrome 주50/0·기본시간보완65/0**.
- 최종 보완 실측: 양측 BT2012/2013ms→턴2015ms, 보호막 뒤615ms에 HP 감소, 12행동 후100% 동률은 방어자 승. 자연 배치 후 명시적 조건 픽스처5개를 사용했다. 주Chrome BT는FAST600ms로 구분한다.
- AI24완주/위반0은a20 이력, 공정관측900대체 차이0은최종 재검증. 기존11스위트1032는 명시된 버전 혼합 근거이며 원저자1199는 산술 오류다. 중복·변이를 합산하지 않는다.
- 근거: docs/qa/issue106-saturn-final.md (inline msg_cc5c45f99561 전체), issue106-mars.md, issue106-shield-mars.md, issue106-browser-mars.md, v044-followup-pd-report.md.

## 한계와 운영 이력

- CJ QA PASS는 수락했으나 자동 검수의 원격 LAN 두 기기·모바일·비Chrome·정지 브라우저 모든 일정·사람 밸런스 통계 미측정 범위는 유지한다.
- 390px 전투 메뉴와 전체 페이지는 별개다. 기존 전체 가로 넘침778~929px·턴 버튼2개 화면 밖은 범위 밖 WARN. 연출 대기 시간, 전투포획 예비HP70/100의 비율 판정 불리함, 감전 순서 부채도 유지한다.
- 최초 Mars_1의 기존 테스트4개 Git 복원·프로필 접두사 Chrome 종료 절차 위반을 **docs/qa/issue106-pd-incident.md**에 공개했다. 4파일 HEAD동일, Saturn 실행 영향은 관찰되지 않았지만 전체 종료 대상 소유권은 입증되지 않았다. 불명확한 i104cdp-kTgdqC는 삭제하지 않았다. 반복 금지, 본인 실행의 정확한 PID/프로필만 정리한다.

## 문서·다음 세션

- [GDD13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) DL31 출시·DL32 교대·DL33 분석/정리·DL34 구현 승인·DL35 본문 동기화를 기록했다. GDD13/12/14 현재 규칙과 과거 출시 이력을 구분하고 문서 독립 검수에서 발견한 상태·적용 범위 문구를 정정했다. v0.4.5 구현·검수·통합 후속 기록은 PR115·Issue114와 최신 Decision Log를 따른다.
- [DIGEST2호](https://app.notion.com/p/3cd1e7f17085813992ccd85ce72b1d0f)는 v0.4.4 출시 설명으로 보존한다. [v0.4.5 규칙 정리본](../v0.4.5-rules-digest.md)을 DIGEST3호로 승격하고 GDD13의 현재 참조를 치환한다. [릴리스 노트](../releases/v0.4.5.md), [검수 보고](../qa/issue114-pd-report.md)는 v0.4.5 출시 기준이며 캡처 출처와 초기 QA 한계는 유지한다.
- Notion #105 원문3d51e7f1708580f18f2dc4a643721059의 v0.4.4 작업은 완료됐다. #106 원문3d51e7f1708580b0916ded4bd3d9d06e는 외부 편집으로 Status=수정 대응, Summary=“v0.4.4 1차 완료 / v0.4.5 추가 구현 예정”이 됐으며 보존했다.
- Notion 메타데이터: Project=DigitDual, EditDate=실제날짜, Editor=실제 사람 성창조(user8e0a8270-d0e3-407e-a7d2-b3f992f1e366). Agent는 운영 본문에만 쓴다.
- 이전 세션 수치 이력: 압축15회, 2026-09-08 17:47:40 KST 마지막 요청92,019/258,400(여유64.4%). 현재 Mercury의 사용량이 아니며 판단력 저하를 입증한 수치도 아니다. 교대는 완료됐다. 상세: docs/qa/mercury-self-audit-2026-09-08.md.
- CJ 플레이 QA·배포 승인은 완료됐다. README·릴리스 노트·Milestone 갱신과 v0.4.5 발행 결과를 보고한 뒤 **다음 CJ Comment 대기**. 같은 승인을 다시 묻지 않는다. 새 Comment 없이 재릴리스·추가 기획·구현·상시 Worker 감시를 시작하지 않는다. 현재 Mercury가 상설 창구를 유지하며 추가 PD 스폰이나 세션 교대를 하지 않는다.
