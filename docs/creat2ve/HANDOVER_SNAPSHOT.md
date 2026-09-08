# Digit-Duel — 인수인계 스냅샷

> 2026-09-08 · Mercury(PD, GPT-6 Astra/high). CJ의 수치 기반 재점검 및 조건부 교대 지시에 따라 인계를 확정했다. 실제 main/dev HEAD와 Release 상태는 Git/GitHub에서 확인한다.

## 현재 상태

- 최신 릴리스 **v0.4.4**. CJ의 **“[CJ QA Test] PASS — Release 진행.”** 승인으로 출시 완료. 최신 지시는 **수치 기반 자가 점검 후 교대가 적절하면 인수인계, 아니면 v0.4.5 Comment 대기**다. 실측 후 교대로 판정했다.
- [v0.4.4 Release](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.4), [Milestone10](https://github.com/ChangjoSung/Digit-Duel/milestone/10). 릴리스 PR은 dev→main merge commit, 버전 태그는 그 main 커밋을 가리킨다. main/dev 장수 브랜치를 삭제하지 않는다.
- 릴리스 PR **#111**, main/origin/main 및 annotated tag **aff981217e33c88e8685adebe10351b6d5c5100d**. 출시 당시 dev는 **ceca7ed7009debfcec17a6efb65dd59e1d11ed5a**이며 main/dev 트리는 같았다. 이번 인계 문서 PR은 dev에만 추가되므로 이후 HEAD와 문서 트리는 다를 수 있다. 제품·서버·아트가 릴리스와 같은지 확인하며 태그를 이동하거나 다시 출시하지 않는다.
- #91·92·94·95·96은 이전 CJ PASS로 종료했고, 이번 최종 PASS로 #104→부모#93·#105·#106도 종료했다. v0.4.4 범위에 미승인 구현은 없다.
- 검수 제품은 PR109 squash **a6fdaad752a8ffedadd2781dfb5d95018273575f**. 이후 릴리스 준비는 README·패치노트·DIGEST·상태 문서만 갱신했다. 제품·서버·아트 변경은 없다.
- 제품 Git blob **f580e4f9aa4b5ce3daceef940891a875586a1e34**, 검수 당시 LF 파일 SHA256 **a4932cb80a1407fc728ace6ee918315880840c76010de7b21361a7f618e97280**. Windows checkout의 줄바꿈 차이는 Git blob으로 구분한다.
- 이전 v0.4.3은 main/tag **cc3f382496473233334f374896d46639b83d7974**, PR97·Milestone7 완료 이력으로 보존한다. 과거 태그를 다시 만들지 않는다.
- 다음 **Milestone11 v0.4.5 OPEN**: 공용 하수인·아트 확장, 속성 기술·전체 위력·감전 추가 조정 검토의 계획만. 신규 구현은 CJ Comment 대기.
- **사용자 소유 미추적 art/·orca-hook-latency-report.md는 접근·수정·스테이징 금지.** 승인 아트100파일과 Downloads 원본도 보존한다.

## 역할·작업자

- Mercury = 조정·Git·문서 메타데이터. 제품·도구·테스트는 Mars(Client/Claude) 또는 Jupiter(Server/Claude), 기획은 Venus(Claude), 아트는 Earth(Codex), 독립 QA는 Saturn(Codex READ_ONLY)으로 라우팅한다.
- PD 소유 활성 작업자0, 완료 작업자는 archive/release했다. 새 작업은 실제 Orca 상태를 확인한 뒤 fresh 역할 Worker로 배정한다. 같은 납품 목표는 Issue1개·통합PR1개, 병렬 분할은 Task로 관리한다.
- 이전 Run **run_195c28ae423a**, PD terminal **term_abae9146-14a1-47e9-8e9a-0a6e3c4c041a**. 마지막 Mars_2 ctx_7e1fba3a5a28, Saturn_2 ctx_db164ebf2352 모두 exact terminal release 완료.
- 사용자 소유 terminal **term_f715b1c1-8dc5-438c-b035-540ab8b4082e** 및 과거 Saturn ctx_7587a359d6a6 user_owned retained는 재사용/종료 금지. ctx_bbc10559f749의 identity_unproven 메타데이터도 강제 정리하지 않는다.
- Saturn은 어떤 파일도 수정하지 않는다. filesModified=[]의 inline 보고를 PD가 보존한다. 원본 smoke_online.js는 디스크 변이를 쓰므로 READ_ONLY 실행에 사용하지 않는다.

## 릴리스 범위와 근거

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

- [GDD13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) DL30 규칙·DL31 출시·DL32 자가 점검 및 수치 기반 교대 결정을 기록했다. GDD12/14/16 본문에 최신 규칙을 반영했다.
- [DIGEST2호](https://app.notion.com/p/3cd1e7f17085813992ccd85ce72b1d0f), docs/v0.4.4-rules-digest.md를 출시 상태로 갱신했다. 새 규칙을 추가하지 않는다.
- Notion #105 원문3d51e7f1708580f18f2dc4a643721059, #106 원문3d51e7f1708580b0916ded4bd3d9d06e는 최종 승인 완료 처리했다. #106 Summary는 외부 편집으로 변경되는 것을 관찰했으므로 과거 문자열로 덮어쓰지 않는다.
- Notion 메타데이터: Project=DigitDual, EditDate=실제날짜, Editor=실제 사람 성창조(user8e0a8270-d0e3-407e-a7d2-b3f992f1e366). Agent는 운영 본문에만 쓴다.
- 수치 점검: 같은 Codex 세션의 compacted 기록 **15회**. 2026-09-08 17:47:40 KST 마지막 token_count는 **92,019 / 258,400**(35.6%, 단순 차감 여유64.4%). 즉시 용량 부족이나 판단력 저하를 입증한 것은 아니다. 마일스톤 종료·반복 압축·Orca 상태 갱신 누락1건(정정 완료)을 근거로 교대한다. 상세: docs/qa/mercury-self-audit-2026-09-08.md.
- 다음 세션은 **resume/fork 없는 fresh GPT-6 Astra/high**로 같은 체크아웃에서 소유권을 인수한다. CLAUDE 전체→이 문서→GDD13 DL31/32→Git/GitHub 실제 Release·Milestone·HEAD→Orca 상태를 확인하고 **“GPT-6 Astra Mercury 인수 완료”**와 핵심 상태를 CJ에게 보고한 뒤 v0.4.5 Comment를 기다린다. 이전 Mercury는 인계 프롬프트 전달 후 작업·감시를 종료한다. 구 터미널 자동 강제 종료는 하지 않는다.
