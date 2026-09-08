# Digit-Duel — 인수인계 스냅샷

> 기준일: 2026-09-08 · Mercury(PD, GPT-6 Astra/high) · 현재 상태로 치환.

## 현재 상태

- Mercury=조정·Git·문서 메타데이터. 제품·테스트·도구=Mars/Jupiter, 기획=Venus, 아트=Earth, QA=Saturn READ_ONLY.
- 최신 릴리스 **v0.4.3**, main/tag **cc3f382496473233334f374896d46639b83d7974**, Release PR#97 MERGED. Milestone#7 CLOSED, Issue#89 CLOSED. 재출시하지 않는다.
- dev/origin/dev **ad5f2a8b066cd8ad6ec5fb7b02928db634e0dd68**. 현재 **fix/104-online-piece-sync**에서 #104 우선 수정 중. 실제 Git 상태로 재확인한다.
- **Milestone#10 v0.4.4 OPEN·미출시**. CJ 2026-09-08 QA로 #91·92·94·95·96 PASS CLOSED. **#93 REVISE OPEN**, 실제 GitHub child **#104** 최우선. 추가 **#105 README/Releases**, **#106 턴 행동 개편** OPEN.
- 새 **Milestone#11 v0.4.5** OPEN은 공용 하수인/아트 확장·속성 기술/전체 위력/감전 추가 하향 검토의 후속 계획만. v0.4.5 구현 미착수.
- 보호: 사용자 미추적 **art/**·**orca-hook-latency-report.md** 접근·수정·스테이징 금지. Downloads 원본·기존 승인 아트100파일 보존.
- 사용자 승인한 v0.4.4 구현은 계속한다. v0.4.4 main 병합·태그·마일스톤 종료는 후속 CJ 플레이/출시 지시가 필요하다.

## CJ 최신 결정 및 진행

- #104: 같은 서버·버전에서 BT 2칸 이동으로 자기 숲의 숨은 상대 말에 충돌하면, 상대 클라이언트가 뷰어 가시성으로 메모 분기를 타 이동을 적용하지 않는 결함을 재현·수정했다. **visibleTo(S.current,p)**로 행위자 시야 통일. Mars1032·Chrome22, Saturn 신규23+기존852·Chrome22 PASS 및 구 조건 음성대조 D3/D4 실패. 보고 docs/qa/issue104-mars.md·issue104-saturn.md. CJ 경기가 실제65턴 이후였는지는 미확정, 별도 이전턴 원인까지 해결했다고 단정하지 않는다. PR 통합 준비 중.
- #105 원문: https://app.notion.com/p/3d51e7f1708580f18f2dc4a643721059
  README는 게임 소개/기능/플레이 사진/새로운 기능/게임 정보/플레이 방법/저장소 구조/라이선스의8개 범주. Earth 소개 그림→실제보드/전투→튜토리얼10장. GitHub README는 JS/CSS 슬라이드를 지원하지 않아 작은 이미지+원본 링크/접기 대안. 최신 정식 릴리스 패치노트만 남기고 기존 GitHub Release6개 본문도 간결한 실제 버전별 변경으로 치환. **원문의 v0.4.3 아래 v0.4.4 변경 예시는 오기이므로 소급하지 않는다**. 기존 tag/대상/날짜/첨부자산 보존.
- #106 원문: https://app.notion.com/p/3d51e7f1708580b0916ded4bd3d9d06e
  턴/접촉/전투 연출2~3초 및 입력 잠금, 지속회복, 전투4메뉴(싸우기/가방/포획/도망), HP/보호막바, 3→2→1, 6라운드 잔여HP비율 판정, 행동 소진 시 자동종료. #104 dev 통합 후 제품 착수.
- **회복 CJ 최종 정정**: 지정=주행동 소모·이번 턴부터·재지정 없이 지속. **나/상대 각각의 개별 플레이어 턴마다 최대HP5%, 한 쌍10%**. 이동/탐색/전투 시 해제. 이전10%/개별턴·자기턴만 해석 폐기. Venus에 msg_0459af45b543 및 msg_4b6a72065f56 전달. 권고global endTurn에서 모든 활성회복말 한번씩, 별도즉시틱 없음·중복방지. 대상/반올림 등 구현계약은 Venus 문서에서 구분.
- PD 채택 권고: 잔여HP/maxHP 판정·동률 기존 방어자승, 연출2초, 선택 전투/생략/텔레포트 존치, 온라인 행동자만 자동종료 송신, 미해결 선택/연출 중 자동종료 금지.
- CJ 추가 확정(2026-09-08): **함정과 걸린 말 모두 공개**, **폭탄 직접 접촉도 발동**. 폭탄→하수인은 양측 제거, 폭탄→동료/왕은 폭탄만 제거, 폭탄→폭탄/함정은 아무 일 없음. Venus msg_7edf82a7f967 전달, 이전 질문은 해소.
- CJ 추가 확정: **65턴 진입 때 “버닝타임입니다! 2칸씩 이동 가능합니다” 배너를 일반 턴 배너 전에 2~3초** 표시. PD는2초 채택, 기존 이동 예외 유지. Venus msg_33a2d3486067 전달·Issue106/Notion 원문/DL30 반영.

## 활성 작업자 / 산출물

Run **run_195c28ae423a**, root terminal **term_abae9146-14a1-47e9-8e9a-0a6e3c4c041a**. 실제 Task 상태를 재확인한다.

| 역할 | Task / Dispatch | 소유 범위 |
|---|---|---|
| Mars_2 Claude | task_283fb19b35ec / ctx_136c0240bf04 | #105 도구 READ_ONLY REVISE 수정: tools/readme_media_capture.js·QA 보고/렌더 |

- #104 Mars_1 및 Saturn_1(ctx_5ab897faea7c)은 납품·QA PASS 후 archive/release. #106 Venus_1 계약 납품·release, 최신 CJ와 PD 채택 사항은 docs/v0.4.4-turn-flow-spec.md에 반영. #104 dev 통합 후 Mars 제품 구현.
- #105 Saturn ART/editorial PASS, 미디어 정적검사 PASS. 독립 전체 렌더는 도구의 임시 HTML/JSON 쓰기 및 READ_ONLY 렌더 비활성화 때문에 REVISE. Saturn_2 ctx_d2a032f189b4 archive/release; docs/qa/issue105-saturn-media-first.md. 도구 수정 후 fresh Saturn 재검수 필요.

- Earth_1 task_e6a756265fdc/ctx_153d36a0a934 완료, msg_0092c4cd89d3 인수·archive·release(exact terminal closed).
  새 소개 그림 docs/media/digit-duel-hero.png **1672×941**, SHA256 **3215151a1cf978b90c8bd654b752c205fbd8a79b7a15188449ed4c4f49f33832**. 출처 docs/art/readme-hero-v0.4.4.md. 독립 Saturn 아트 PASS, #104 PR에 섞지 않는다.
- Venus_2 README8범주·docs/releases/v0.3.0~v0.4.3.md 6개 납품 후 release. Saturn editorial PASS 후 **Release6개 본문 게시 완료**. PD와 Saturn이 날짜/대상/자산 보존·본문 일치를 각각 API로 확인했다.
- #105 튜토리얼10장은 실제 v0.4.3 tag에서 캡처 완료(2224×1096, 자동 진입·다음 버튼). 저장된 README 렌더는 GitHub 정제 HTML+근사 CSS이며 실제 GitHub 전체 스타일 동일성을 주장하지 않는다. 수정 도구의 좁은 화면 검수는 남아 있다.
- Worker 완료 즉시 archive/release. 같은 좁은 범위 즉시 후속만 worker-show의 exact agent_terminal_handle로 새 Task에 이전. 다른 역할로 대체 금지.
- 사용자 소유 terminal **term_f715b1c1-8dc5-438c-b035-540ab8b4082e**는 작업자 아님, 재사용/종료 금지. 과거 Saturn ctx_7587a359d6a6 user_owned retained도 강제 종료 금지.
- Saturn 어떤 파일도 수정하지 않음, files_modified=[] inline report를 PD가 문서 취합. 원본 smoke_online.js는 파일을 쓰므로 read-only 대안 사용.
- 목표별 Issue1+PR1, Worker별 Issue/PR 금지. main/dev 직접 커밋·git add . 금지. 명시 경로만 stage. 제품104·문서105/106 산출물이 공존하므로 분리 커밋.

## 이전 구현 이력과 검수 한계

- v0.4.4 원래6건 PR#98/99/101/100/102/103 dev 병합. #91 자산 연결 누락 artRosterId, #92 타속성 공격기 교체/쿨 승계/공격속성·본체속성 분리/포획기술 복사, #94 상대턴 로컬메모 토큰 격리, #95 atk26→25 결정타44→40, #96 일반감전70→50%를 CJ PASS.
- #93 표시행 반사는 PR#102였으나 **CJ 실제 온라인 REVISE로 재개**. 제한된 기존 Chrome 위치fixture와 자연 경기 차이 확인 필요.
- 기존 Mars1009/1009, Saturn852/852(online157 제외), Chrome56+경합22는 당시 측정 이력. 현재 #104/106 변경 후 검수로 대체해야 한다.
- 기존 제품 SHA256 **0fe0bf450c5c29bd3d2a65034cdd832b16927fc898774f5b7d3c2ebecbcb7fbb**. 상세 docs/qa/v044-pd-report.md·issue91~96 보고 보존.
- #95 모든대진 개선 아님(비미러/불 후공격차 증가); #96 감전 순서·1R/레거시2R 부채 및 실제원격LAN/모바일/비Chrome/wss/사람통계 미측정. 후속 전체 밸런스 분석은 v0.4.5 기획.
- 이전 Run run_0e980a99ab14 소유 활성 없음. 중복browser ctx_bbc10559f749 종료·identity_unproven 메타데이터 retained, 강제정리 금지.

## 문서·다음 절차

- GDD-13 DecisionLog30 및 GDD12·13·14·16 관련 실제규칙본문을 최신 회복5%·양측함정공개·능동폭탄접촉·HP판정·65턴배너로 동기화 완료. 회복은 여러 말 지속/만피에서도 자세유지, 각 global endTurn에 한 번씩. Project=DigitDual, EditDate=2026-09-08, Editor=실제 사람 성창조.
- GDD13 3cd1e7f17085817f8c35fa8548116f38 / GDD14 3cd1e7f170858116bbdbd60e98cc6924 / GDD15 3cd1e7f1708581e089c4c98511095634 / GDD16 3ce1e7f1708581f48640c974ec2dd540.
- 기존 Releases 전체 원본백업 **.git/releases-before-renewal.json**. 기존6개 본문만 PD 게시 완료, 태그·발행일·대상·첨부자산 보존.
- 인수: CLAUDE 전체→이문서→Git/GitHub→실제Orca 활성Task/메시지. #104 먼저 수정·Saturn QA·단일PR dev→#105/#106 완수→CJ 보고. 최신지시 유지, 동일구현승인 재질문 금지.
