# Digit-Duel — 인수인계 스냅샷

> 2026-09-08 · Mercury(PD, GPT-6 Astra/high). 현재 상태로 치환. Git/GitHub의 실제 HEAD·병합 상태가 최종 원본이다.

## 현재 상태

- Mercury는 조정·Git·문서 메타데이터 담당. 제품·도구·테스트=Mars/Jupiter, 기획=Venus, 아트=Earth, QA=Saturn READ_ONLY.
- 최신 정식 릴리스 **v0.4.3**, main/tag **cc3f382496473233334f374896d46639b83d7974**, Release PR97 MERGED, Milestone7 CLOSED. 재출시하지 않는다.
- **v0.4.4 Milestone10 OPEN·미출시**. CJ PASS로 #91·92·94·95·96 CLOSED. **#93·104·105·106 OPEN**, CJ 플레이/최종 확인 대기.
- #104 PR107은 dev **6baa0b5f618b147029fdf5078a78b564753b0133**에, #105 PR108은 dev **40415c2bec5fc360c59a8cfd7cb2cf1eaf2c018e**에 통합했다. 전용 브랜치 로컬·원격 삭제 완료.
- #106 제품·규격·QA 및 #104 추가 시점 감사는 **feature/106-turn-flow**, 기반40415c2에서 최종 Saturn PASS. PD 단일 PR로 dev 통합한다. 정확한 현재 커밋과 PR은 Git/GitHub에서 확인한다.
- 보호: 사용자 미추적 **art/**·**orca-hook-latency-report.md** 접근·수정·스테이징 금지. 승인 아트100파일·Downloads 원본 보존.
- 사용자 승인된 v0.4.4 구현·dev 통합은 다시 묻지 않는다. v0.4.4 main 병합·태그·Release·마일스톤 종료는 후속 CJ 플레이/출시 지시 전 진행하지 않는다.
- Milestone11 v0.4.5는 공용 하수인/아트 확장·속성 기술/전체 위력/감전 추가 하향 검토의 계획만. 구현 미착수.

## #93 / #104 — 동기화 수정과 전 경로 감사

CJ는 같은 서버·같은 버전에서 위치 불일치를 보고했다. 65턴 이전 발생은 미확인이지만, 2P 하단 표시와 중앙선 통과 전체를 살피도록 지시했다.

- 확정 결함: BT2칸 이동으로 자기 숲의 숨은 상대 말에 충돌할 때 수신측이 로컬 뷰어 시야로 판단해 메모 분기로 이동을 버림. **visibleTo(S.current,p)**로 행동자 시야 통일. 행 반사 도입 전에도 존재했던 결함이며 CJ 원경기 전체의 유일 원인이라고 단정하지 않는다.
- PR107 Saturn PASS: 신규23·기존852·실제Chrome22. 구 조건 복원 시 충돌 검사가 실패한다. docs/qa/issue104-mars.md·issue104-saturn.md.
- 추가 시점 감사 rev3: 고정6baa 제품의 7열×65턴 전후14경기, 양측 전체 횡단. Saturn **8,916/0·실제Chrome20/0·80클릭 전송좌표 불일치0·118회 전체 보드 픽셀/hit-test**. Chrome의 전65경로는2/12행, 후65는상대숲5/9행, 후65전체끝행은 헤드리스가 검증했다.
- 초기 감사도구는 비교실패28을 기록하고도exit0인 결함으로 REVISE됐다. rev3 실패 집계·빈 검사 방지·전투 완료 확인을 고쳤고, Saturn의 독자 소유자 변이28건도exit1로 검출했다. 첫/최종 보고를 모두 보존한다.
- 현재2P는 **행만14-r, 열유지**. 중앙선·65턴에 따른 방향 전환 경로는 발견하지 못했다. 전체 S가 아닌 명시된 공통 상태 projection 비교이며 모든 UI표식을 검사한 것은 아니다.
- docs/qa/issue104-orientation-audit.md·issue104-orientation-saturn-first.md·issue104-orientation-saturn-final.md.
- GitHub104 코멘트5581004621·93 코멘트5581005123, GDD13 본문/DL30 반영. **CJ 원경기 재현·최종 플레이 QA는 별개로 OPEN**.
- 감사도구 기본값은 고정104제품이다. 현재106검사는 반드시 smoke_orientation_audit.js --path demo/index.html. orientation_audit_cdp.js의 고정104결과를106결과로 표기하지 않는다.

## #105 — README / Releases 완료

- PR108 dev 통합, Saturn 최종 PASS. README8범주·소개그림·실제보드/전투·실제v0.4.3튜토리얼10장. README는 최신 공식v0.4.3만 소개한다.
- 기존 GitHub Release6개 본문 게시 완료. 태그·대상·발행일·첨부자산 보존을 PD와Saturn이 각각API확인. 원본백업 .git/releases-before-renewal.json.
- README SHA256 **2d4e5f9dac0b6f6293aff9bbe3393a3e2d5201e727574bc692a849a4865dcd53**. 저장된 초기HTML/JSON은Stars링크수정전이력이며 최종검증해시는 최종보고에 분리했다.
- 독립1100/390px·이미지원본20클릭·튜토리얼10/10재캡처일치. GitHub정제HTML+근사CSS 검수이지 실제GitHub전체픽셀동일성 주장이 아니다.
- docs/qa/issue105-pd-report.md·issue105-saturn-final.md. 원문Notion 3d51e7f1708580f18f2dc4a643721059 StatusQA.
- Earth 소개그림 docs/media/digit-duel-hero.png1672×941, 출처 docs/art/readme-hero-v0.4.4.md. 모든105작업자 archive/release.

## #106 — 승인 계약·최종 검수

원문: https://app.notion.com/p/3d51e7f1708580b0916ded4bd3d9d06e
계약: docs/v0.4.4-turn-flow-spec.md. 읽는 정리본: docs/v0.4.4-rules-digest.md / 기존 Notion DIGEST2호(3cd1e7f17085813992ccd85ce72b1d0f).

- **회복 CJ 최종**: 지정=주행동 소모. 지정한 턴 종료부터 나/상대 각각의 개별턴마다 최대HP5%, 두턴합계10%. 재지정 없이 여러말 지속·만피에서도 자세유지. global endTurn마다 활성회복말 한번씩, 별도즉시틱 없음. 하수인/동료/왕 대상, 예비/폭탄/함정 제외. 그 말의 이동/탐색/텔레포트/전투/밀어내기/도망스왑 등은 틱 전에 해제. 미공개 상대 상태 누출 금지.
- 함정과 걸린 말 모두 공개·이동제한2. 폭탄의 직접 신규접촉도 발동: 하수인양측제거/VIP폭탄만/폭탄·함정무효. 이전부터 인접한 상대 재발동·무효대상 재선택 금지.
- **65턴 진입 “버닝타임입니다! 2칸씩 이동 가능합니다” 2초 → 일반턴배너2초**, 경기당한번·양측·입력잠금.
- 전투4메뉴·3/2/1/시작각1초·행동자배너2초·기술2초→피해2초·아이템2초·결과2.5초. 보호막0~600ms→HP600~1200ms로 기존피해2초 안 표시.
- 6라운드 잔여HP/maxHP판정·동률방어자승·보호막제외. 전투포획예비70/100 vs숲공용100/100의 불리함은 알려진특성으로 유지.
- 행동소진시1초후자동종료, 선택전투/강제대상/텔레포트/모달/연출이 남으면 금지. 온라인행동자만송신. 규칙/RNG와 연출세대·큐 분리.
- 최종 제품 SHA256 **a4932cb80a1407fc728ace6ee918315880840c76010de7b21361a7f618e97280**, Git blob **f580e4f9aa4b5ce3daceef940891a875586a1e34**.
- 최초a20후보 REVISE3건: 옛playMsgs콜백이새큐삭제, HP먼저표시, 도망결과onEnd추가접촉배너소실. d018콜백수정 후 실제바단계표시 a493으로 보완. 항상참 테스트2개도 실제조건으로 교체했다.
- **Saturn 최종PASS**: 규칙198/0·실시간축소타이머36/0·기술교체116/0·cycle5 69/0·아트199/0·현재106시점8,910/0·실제Chrome주50/0·기본시간보완65/0. AI24완주/위반0은a20시뮬이력, 공정관측900대체차이0은a493재검증. 전체기존11스위트1032는공개된버전혼합근거이며 원저자1199는산술오류다. 중복·변이를합산하지않는다.
- 주Chrome의BT는FAST600ms, 보완Chrome은기본시간. 최종보완 양측BT2012/2013ms→턴2015ms, 실제바HP가615ms후시작, 12실제행동후HP100%동률방어자승. 자연배치뒤조건픽스처5개명칭을 사용했으므로 전부자연플레이로 주장하지않는다.
- 보완도구SHA **756a2236f1bf5ab5f59025fccf041695bdbb15bea5816efd4fd1f294394651c0**. 작성자64/0+WARN2·18PNG누락0, 독립65/0은PVE선공추가P1b차이. 이전캡처응답정지는요청제한/탭전면화로보완했다.
- docs/qa/issue106-mars.md·issue106-shield-mars.md·issue106-browser-mars.md·issue106-saturn-first.md·issue106-saturn-final.md. 통합설명 docs/qa/v044-followup-pd-report.md.

## 작업자·운영 이력

Run **run_195c28ae423a**, PD terminal **term_abae9146-14a1-47e9-8e9a-0a6e3c4c041a**.
**PD 소유 활성작업자0, 전원 archive/release 완료.** 실제Orca상태로재확인한다.

- Mars_3감사 task_0978bc2dbbec/ctx_6d747f9e4aa4 → Saturn_1 task_a1d3786ef988/ctx_c7f3b91f9235 PASS.
- Mars_1최초106 task_6ae7dc111180/ctx_1f2761c63d3d, 콜백수정 task_409978b5ce51/ctx_a87b85dea1bd, 표시수정 task_467e4060a49f/ctx_90019558439b 완료.
- Mars_2보완 task_bc20276715f0/ctx_7e1fba3a5a28 완료(msg_fd717ae5e7b2), exactterminalrelease.
- Saturn_2최종 task_ac25f36f826b/ctx_db164ebf2352 PASS(msg_6514860c3967), 전체inline msg_cc5c45f99561을PD가문서화, filesModified=[], exactterminalrelease.
- **절차위반 공개**: 최초Mars_1의 기존테스트4개git복원·프로필접두사Chrome종료. 4파일HEAD동일 확인, Saturn실행영향관찰없음이나 전체종료대상소유권미입증. 불명확한 i104cdp-kTgdqC는미삭제. PD후속배정경합도기록. docs/qa/issue106-pd-incident.md, GitHub106코멘트5581097491. 반복금지·실행별정확한PID/프로필만정리.
- 사용자 소유 terminal **term_f715b1c1-8dc5-438c-b035-540ab8b4082e**, 과거Saturnctx_7587a359d6a6 user_owned retained는재사용/종료금지. 이전중복browserctx_bbc10559f749 identity_unproven메타데이터강제정리금지.
- Saturn은파일을일절쓰지않는다. inline보고만PD취합. 원본smoke_online.js는디스크변이를쓰므로직접실행금지, 독립QA가메모리동등경로157을검증했다.

## 한계·후속·문서 위치

- 원CJ동기화경기전체미재현. 실제다른LAN기기·모바일·비Chrome·정지브라우저벽시계·사람밸런스미측정.
- 390px전투메뉴검수와전체페이지는별개. 기존가로넘침778~929px/턴버튼2개화면밖은범위밖WARN. 연출대기시간증가, 포획예비HP70판정불리, 기존감전순서부채는유지한다.
- GDD13 **3cd1e7f17085817f8c35fa8548116f38** DL30·4.3~4.6·4.11·6장 및 GDD12/14/16본문에회복5%·함정양측공개·능동폭탄·HP판정·BT배너반영. Project=DigitDual, EditDate=2026-09-08, Editor=실제사람성창조, Agent는운영본문에만.
- GDD14 3cd1e7f170858116bbdbd60e98cc6924 / GDD15 3cd1e7f1708581e089c4c98511095634 / GDD16 3ce1e7f1708581f48640c974ec2dd540.
- 목표별Issue1+통합PR1. main/dev직접커밋·git add . 금지, 명시경로만stage. dev는squash, 전용feature로컬/원격명시삭제. 장수dev/main은보존.
- 다음세션: CLAUDE전체→이문서→git status/GitHub실제PR상태→Orca미수신메시지. #106최종통합여부확인후 CJ재검수Comment를기다린다. 새개발/릴리스게이트를임의추가하거나기존구현승인을재질문하지않는다.
