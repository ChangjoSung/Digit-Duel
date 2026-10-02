# #294 Mercury — CJ QA REVISE 납품 보고

[피드백] 2026-10-02 CJ의 세 항목을 같은 #294 브랜치에서 수정했다. 제품 소스 `0931b8e5b45f96cbd17b415719ee0c6704fd5378`를 독립 Saturn이 **PASS**로 판정했다. #294 OPEN·PR306 Draft·CJ 재테스트 대기를 유지한다.

최종 보고서 커밋은 제품·테스트를 바꾸지 않는다. 해당 최종 SHA의 CI6·기존 Free QA 배포·health·제공 파일 대조와 정리 완료 사실은 [기존 Issue #294](https://github.com/ChangjoSung/Digit-Duel/issues/294)와 [PR306](https://github.com/ChangjoSung/Digit-Duel/pull/306)에 기록한다. 아래 이전 납품은 과거 증거이며 이번 수정의 통과로 대신하지 않는다.

## 수정과 원천

| CJ 요구 | 최종 동작 |
|---|---|
| R1 TopBar 50/50 | 공용 `topBarHtml`이 #293 준비 shop/place/done과 메인에 적용된다. 왼쪽 50% = 파란 내 계정 대표·닉네임 VS 빨간 상대 계정 대표·닉네임. 오른쪽 50% = 준비 시간·내 코인·설정 / 메인 짧은 차례·감정표현·설정. 대표가 없으면 중립 프로필에 같은 파랑/빨강 테두리다. |
| R1 준비 표식 | 01→02→03 위 P1/P2 글자를 파란/빨간 대표 얼굴로 바꿨다. 신원 버튼의 전체 이름·읽기 전용 표식 창은 유지한다. 긴 이름 말줄임·전체 조회는 Venus의 접근성 해석이며 CJ 직접 인용이 아니다. |
| R2 가방 | 하단 중복 이름·선물/버프/전투/예비/주 행동/코인 배지·선택 요약과 기본 선택 안내를 삭제했다. n/3·세 카드·아이템 8종·자식 설명·닫기/키보드와 조건부 텔레포트/도망/강제 전투·추측 메모 안내는 유지한다. |
| R3 하수인 정보 | 탭을 없애 이름·등급·X, 큰 초상 왼쪽/아이콘 기본 능력치 오른쪽, 스킬 아래로 구성했다. HP·공격·방어·속도·회피·치명타·상태 부여 확률과 스킬 위력/쿨/1회/남은 쿨을 기존 개체·구매 함수·SKILLS에서 읽는다. 엔진에 없는 명중 수치는 만들지 않는다. |
| 정보 공개 | 공개된 상대 말은 종전 허용 목록만 표시하고 능력치·개인 시너지·스킬·쿨타임 구역을 만들지 않는다(오프라인도 동일). 미공개 ? 말은 추측 메모만 유지한다. |

런타임 변경은 `demo/js/ui.js`·`demo/css/game.css` 두 파일이다. 회귀의 옛 UI 기대값 7개 파일을 치환했고 공개 정보·상태 불변 단언을 유지했다. 서버·Core·데이터·네트워크·index·하네스·규칙·의존성·아트는 이번 수정에서 바꾸지 않았다. Mercury는 제품·도구·테스트 코드를 작성하지 않았다.

## 독립 QA와 실패 이력

Saturn dispatch `ctx_851b37b6f6cc` / task `task_c92729b21521` / 완료 `msg_b08df09f036e`(2026-10-02T00:35:34Z): **PASS, files_modified=[]**. `d20f312..0931b8e5`를 검토하고 frozen HEAD·clean Git 상태·실행 설정을 다시 확인했다.

| 명령 | 독립 결과·횟수 |
|---|---|
| `npm.cmd run typecheck` | exit0 · 1회 |
| `smoke_issue293` / `smoke_issue238` / `smoke_memo` | 124/0 · 164/0 · 129/0, 각각 1회 |
| `smoke_turnflow` / `smoke_cycle5` | 203/0 · 70/0, 각각 1회 |
| `smoke_minion_art` / `smoke_cross_skill` / `smoke_issue263_client` | 208/0 · 86/0 · 186/0, 각각 1회 |

회귀 합계 **1,170/0**. 공용 호출자·능력치/스킬 원천·상대 허용 목록·NET 송신/선택/seq/시계 불변·X/Esc/Tab/바깥 클릭·부모/자식 포커스·단계/만료/새 경기 정리를 함께 검토했다. 서버·경제·실서버 통합은 변경이 없어 이전 증거를 재사용했으며 여기서 다시 실행했다고 주장하지 않는다. 최종 필수 CI는 별도로 확인한다.

Mars 자체 검증에서 typecheck 1차 exit2(배열 타입)→타입 주석 후 exit0, #293 123/1→표식 글자 집계 식 수정 후124/0, #238 163/1→접근성 이름 정규식 수정 후164/0 이력이 있다. 해당 세 명령만 각각 2회이며 나머지는 각1회다. 수정 뒤 Saturn의 첫 실행은 전부 통과했다. 실패·반복 횟수를 숨기거나 중복 합산하지 않는다.

## 화면 대조와 한계

[CJ REVISE 원문·원본 해시](../references/CJ_REVISE.md), [현재 계약](../Venus/implementation-contract.md), [Mars 변경·실측](../Mars/report.md), [40장 캡처·로그](../Mars/evidence/revise-20261002/capture-log.json)를 보존했다. 2·3번 CJ 이미지는 같은 SHA256이지만 입력 이력을 각각 유지한다.

Saturn은 CJ 원본1/2/4와 대표 렌더 **22장**을 직접 봤다. 320/390/1100px에서 TopBar 내부 폭312/382/424를 좌우156/156·191/191·212/212로 나눴으며 가로 넘침이 없다. 신원 버튼 높이44px, 설정/감정표현44×44, 대표36×36, 비조작 진행 얼굴24×24다. 초상104px·기본 수치·등급/종/전설/왕/동료·상대 정보 제한과 키보드 증거를 대조했다.

캡처는 실제 Chrome headless의 **합성 오프라인 PVE + NET 표시 주입**이며 실제 온라인 경기·모바일 플레이가 아니다. 모바일 DPR2, 1100px DPR1이다. 이번 ready-wait03 새 캡처는 없다. Saturn은 같은 `flowHeadHtml` 경로와 기존 #293 E12~E16의 시계/취소/정리 검사로 이번 변경 검증이 충분하다고 판단했다.

320px의 이름은 약2글자부터 말줄임되고 전체 이름은 신원 창/접근성 이름으로 조회한다. 내 선택의 설명 버튼은 행동 줄에44px를 더 쓴다. 능력치는 기본 개체 값이며 전투 버프를 더하지 않는다. 스킬의 원문 설명을 재사용해 일부 위력/쿨이 아이콘과 설명에 중복된다. 예비 하수인 HP는 기존 출전 선택 UI에 남아 있다.

## 문서 반영 위치

| 문서 | 반영 |
|---|---|
| Venus 구현 계약·decision-sync·report | 최신 R1/R2/R3 규격과 AC를 치환했다. |
| Notion GDD13 | CJ Decision Log와 운영 이력 갱신 |
| Notion GDD23 / GDD24 | 기존 #294 섹션과 운영 이력 갱신 |
| 기존 GitHub #294·PR306·milestone18 | CJ REVISE 현재 상태·납품·검증/배포 증거 갱신 |

Venus의 Notion 사전/사후 fetch 각3회와 쓰기6회 모두 성공했다. 새 페이지·상태·Editor/Project 속성 변경은 없으며 실제 last edit은 갱신된다. GDD24의 스킬 탭 문장은 과거 문구를 치환했다. 명중 신규 필드·스킬 원문 재작성은 별도 기획 대상으로 남으며 이번 UI 구현/QA를 막지 않는다.

## Worker 실행과 정리

각 dispatch는 required_role·mode·area·mutation·instance_index를 검사했다. Venus=PLAN/docs, Mars=IMPLEMENT/client/code·docs, Saturn=QA/client/none, 단일 인스턴스다. adopted launch requested/effective는 null이며 추정으로 채우지 않았다.

| 역할·dispatch | 현재 실제 세션·모델·권한 |
|---|---|
| Venus `ctx_f65750c1da75` | `7a693283-1c92-412a-bb63-2192a92960ea` · claude-opus-5-5/high/bypass · PID14104 |
| Mars `ctx_273570505c68` | `e93e76c4-4ac6-4c1e-84ae-e7e5d221ceec` · claude-opus-5-5/high/bypass · PID16156 |
| Saturn `ctx_851b37b6f6cc` | `01a0f9fd-b634-7241-a7ab-706eede4574f` · gpt-6.1-sol/xhigh/default/danger-full-access/never · PID25628 |

GO와 완료 시 현재 JSONL/PID·CLI/footer를 확인했다. Saturn 최종 turn_context `2026-10-02T00:33:52.868Z`는 같은 turn `01a0f9fe-9bb3-7d63-9227-dd50b100cefc`의 gpt-6.1-sol/xhigh/full-access/never를 확인한다. JSONL의 tier는 absent, 실행 CLI의 service_tier는 default다.

| 역할 | 입력 | 캐시 읽기 | 캐시 생성 | 출력 |
|---|---:|---:|---:|---:|
| Venus | 58 | 5,671,478 | 288,004 | 59,076 |
| Mars | 130 | 19,156,027 | 379,036 | 102,085 |
| Saturn | 3,853,162 | 3,580,672 | 0 | 10,964 |

Claude는 assistant message ID를 중복 제거한 provider 집계(Venus29개/Mars65개)다. Codex 입력은 캐시 포함·출력은 reasoning 포함(2,342)이다. Mercury 증분 비용·절감률은 계산하지 않는다.

세 Worker는 보고 수용 후 worker-release가 external_terminal/retained/processAction none을 반환했고, 별도로 **해당 소유 terminal만 close하여 ptyKilled:true**를 확인했다. orchestration의 retained 표시는 실제 PTY 생존을 뜻하지 않는다. Mars 캡처 Chrome 및 임시 프로필은 종료/삭제했다. 기존 필요한 node_modules와 사용자 브라우저/프로세스·main dirty·unity/·stash·handoff·PR304·원본 콘티·#293 완료 이력은 보존한다. #294 작업 트리/브랜치는 CJ 재테스트·PR용으로 유지한다.

## CJ 재테스트

1. **Q5-01 TopBar**: 두 좌석·긴 닉네임·대표 없음/있음, 준비 shop/place/done의 50/50·파랑/빨강 얼굴 표식, 메인의 차례/이모티콘/설정을 확인한다.
2. **Q5-02 시계**: 단절/재연결·선택/행동·준비180초/준비 취소의 기존 동작을 확인한다.
3. **Q5-03 시너지**: 왕관→활성 전설·기여·단계와 전투 중 제한의 기존 동작을 확인한다.
4. **Q5-04 가방·하수인**: 중복 하단 삭제, n/3·8아이템, 초상/아이콘 기본 능력치/스킬, 상대 정보 제한, X/Esc/Tab·부모/자식·만료/새 경기 정리를 확인한다.
5. **Q5-05 기존 행동**: 내 말 선택과 설명 진입, 텔레포트/도망/강제 전투/추측 메모, 상점·기권·환경 설정 진입의 기존 동작을 확인한다.

<details>
<summary>이전 납품·QA·CI 보정 보고 — CJ REVISE 전</summary>

# #294 Mercury delivery report

2026-10-02 · CJ 구현 승인에 따른 제품 변경과 Saturn 독립 QA 완료.

- 대상: S03 메인 보드, 우측 시너지, 가방/하수인 상세, #293 shop/place/done과 공통인 양측 계정 대표·이름 TopBar.
- 기준: `39241d2eda689bf8f70d085886afa230d43f7e4d`. 제품 최초 고정 `757f45bd77c2b2aae7612902946e6703463c891a`, QA 수정·최종 Saturn PASS 소스 `80a2955e8a5f28a4831b34d9c49ac779d0b0683e`.
- 이후 이 보고서만 고정하는 문서 커밋은 제품 소스를 바꾸지 않는다. 최종 PR/필수 CI 6개/Free QA 배포 SHA·health·제공 파일 대조·정리 결과는 [기존 Issue #294 본문](https://github.com/ChangjoSung/Digit-Duel/issues/294)에 기록한다. 이 보고서 작성 시 CI·배포는 아직 실행 전이다.
- #294 OPEN·PR Draft·CJ 플레이 QA 대기. milestone/main 병합, Release, 운영 Render, 새 유료 자원은 이번 납품 범위에 없다. #293의 CJ PASS·CLOSED/PR305 milestone 병합 이력은 보존한다.

## 원본·계약·구현

[CJ 코멘트](../references/CJ_COMMENT.md)와 [원본](../references/CJ_CONCEPT_CONTI_20261002.png)을 무변경 보존했다. 원본 SHA256 `f1d15251da5c0cfb69ddc75ed6164f4bdc5fc159b14397689815522db9a19261`.

Earth가 화면을 먼저 분석했고 Mercury가 기존 Issue 본문에 반영했다. [분석](../Earth/analysis.md), [UI 제안](../Earth/UI_CONTRACT.md), [편집 SVG](../Earth/main-flow.svg), [PNG 시안](../Earth/main-flow-preview.png)의 고정 소스는 `cd04f9e5958ab98c1a84b19a0b1b220dbf841dfb`이다. 기존 자산·네이티브 SVG를 재사용했다. 시안은 제품 QA 증거와 구분한다.

Venus의 [최종 구현 계약](../Venus/implementation-contract.md)과 [GDD 동기화](../Venus/decision-sync.md)는 `9f922dd1d958191eb01118fd7dcc7ed369b3b1ce`에 고정했다. Notion GDD13 Decision Log/운영 이력, GDD23 2.4·7.9, GDD24 00.7·말미 읽기 주석에 추가했다. 기존 내용 삭제 0건, 상태 속성·Editor/Project 정보 유지. 8회 호출 중 검증 실패 1회는 수정해 7회 성공했다.

[Mars 보고서](../Mars/report.md)와 [Jupiter 보고서](../Jupiter/report.md)의 제품을 검토했다. Mercury는 제품 코드·도구·테스트를 작성하지 않았다.

- TopBar는 검증된 `NET.players/reps`를 사용한다. 계정 대표와 경기 왕/동료를 분리하고 뷰어 기준 내/상대 테두리·미확인 중립 표시·긴 이름의 전체 조회를 제공한다. 메인과 #293 준비 shop/place/done이 같은 표시를 쓴다.
- 시간·턴·내 코인·전투 횟수와 기존 여섯 행동을 재배치했다. 상점의 기존 턴 계산을 읽어 `N턴 후 열림`을 표시한다. 7×13 보드·수풀·시야·입력 잠금·경제/전투 규칙은 유지한다.
- 공개 `boardClock{leftMs,running,deadline,serverNow}|null`은 기존 보드 pick/act 시계를 읽기만 한다. 양 좌석의 마감·정지는 같고 직렬화 시점에 따른 serverNow/leftMs 차이는 허용한다. key/owner·개인 상점/전투 시간은 공개하지 않는다. 기존 private clock 입력 검증·스케줄·만료/단절 재개·준비 180초는 그대로다. 구 서버에서는 기존 개인 clock/확인 중 표시를 쓰며 새 30초를 만들지 않는다.
- 우측은 왕국5 → 아키타입6 → 왕관 → 활성 개인 전설 순서다. 0/단계/실제 기여자·사망 상태와 현행 일반 가방 미기여·전설 예외를 따른다. 왕관은 사망 동료 0–2다. 전투 중에는 기존 확정 수치/단계만 표시하며 없는 기여 명단을 만들지 않는다.
- 가방은 실제 n/3, 세 카드·장식용 빈칸, 실제 아이템 8종 수량이다. 별도 구매/판매/사용 명령을 추가하지 않았다. 열릴 때 X로 초점 이동, Tab 가두기, X/Esc 닫기 후 가방 버튼 복귀와 자식 설명 우선 처리를 적용했다.
- 공통 설명은 맥락별 허용 정보를 표시한다. 공개 상대 말은 기존 공개 필드만 보이고 스킬/쿨다운/비공개 능력치는 제외한다. 미공개 말은 기존 추측 메모만 유지하며 오프라인에도 같은 제한을 적용한다. 설명 클릭과 이동/교체/판매를 분리하고 단계 변경·만료·새 경기·사망/시야 변화에 정리한다.

## QA 결과와 수정

Saturn은 읽기 전용으로 원본·계약·제품·실제 캡처를 대조했다. 최초 소스 `757f45b`에서 왕관/전설 순서와 가방 자체의 키보드 초점 두 항목을 REVISE로 판정했다. Mars fresh dispatch `ctx_aa6fb9923005`가 공통 `synExtraChips`와 `uiDrawer`/기존 Tab 처리만 고쳤다. 계산·공개 범위·배틀·서버/Core/index/CSS/harness는 수정하지 않았다.

최종 Saturn dispatch `ctx_68ec945ba66b`는 `80a2955`에서 **PASS**했다. 완료 메시지 `msg_068446237476`, 2026-10-01T19:02:30Z. 파일 수정 0건·HEAD/소스 무변경을 확인했다.

| 독립 검사 | 결과 |
|---|---|
| 최초 typecheck | npm.cmd 실행 exit0 |
| 최초 #293 / #238 / #263 client / memo | 122/0 · 155/0 · 186/0 · 129/0, 각 exit0 |
| 최초 서버 #263 timers / #237 economy | 164/0 · 181/0, 각 exit0 |
| 최초 fx_timing 단독 | 82/0, exit0 |
| 최종 수정 범위 typecheck | exit0 |
| 최종 #293 / #238 / memo | 124/0 · 159/0 · 129/0, 각 1회·exit0 |
| 최종 실제 Room.toSeatView → netApplyRoomState | 7/0, 1회·자연 종료 exit0 |

최초 기존 검사 합계 1,019/0, 최종 영향 범위 합계 419/0이다. 서로 중복되는 검사를 새 단언 합계로 합산하지 않는다. 최종 통합 검사는 양 좌석 진행/정지 공개 시계·private clock·로컬 시한/서버 요청 없음·서버 마감/revision 수명 보존을 실제 서버와 클라이언트 함수로 확인했다. 영향 없는 최초 검사와 시각 증거를 재사용했고 전체 행렬을 반복하지 않았다.

검사 실패 이력도 보존한다. Jupiter 새 타이머 단언의 잘못된 전제 1건과 기존 ws 경로 문제 1건은 해당 범위만 교정했다. Mars 최초 공통 harness 영향 검사 38개 중 fx_timing 배치 실패 후 단독 82/0, Saturn 단독도 PASS했다(배치 원인은 확정하지 않음). Mars 수정 #238은 새 테스트 스텁 오류 2건만 수정해 재실행했다. 수정 Mars typecheck의 추가 1회는 불필요한 반복으로 기록하고 완료 Worker를 종료했다. Saturn 최초 npm.ps1은 정책에 막혀 tsc가 실행되지 않았고 npm.cmd로 실행했다. 최초 통합 stdin 인코딩 실패는 단언 0개이며, 교정 호출은 interval 때문에 종료되지 않아 소유 Node만 종료했다(exit1, 정상 종료 PASS로 주장하지 않음). 최종 통합은 검증 수명 정리만 교정하여 7/0·exit0을 얻었다.

## 화면 증거

[CJ 원본](../references/CJ_CONCEPT_CONTI_20261002.png), Earth 시안, Mars 실제 Chrome 렌더를 직접 대조했다. 44px 조작 영역, 320/390px 가로 넘침 없음, 긴 이름/전체 조회, 팝업 스크롤·부모/자식 초점·밖 클릭 소비와 #293 준비 shop/place/done을 확인했다. 320×640의 보드 세로 스크롤은 최소 32px 셀을 유지하는 승인 계약이다.

- [최초 캡처 기록](../Mars/evidence/capture-log.json), [준비 배치/완료 후속 기록](../Mars/evidence/capture-followup-log.json): 38장은 `757f45b`의 역사적 렌더다.
- [최종 키보드/수정 기록](../Mars/evidence/qa-correction-log.json): 390×844·320×640·320×420 실제 키 입력/스크롤/게임 상태 무변경과 수정 후 우측 열 캡처를 기록했다.
- 최종 우측 순서: [320px](../Mars/evidence/320-main-rail-crown-first.png), [390px](../Mars/evidence/390-main-rail-crown-first.png), [PC](../Mars/evidence/1100-main-rail-crown-first.png). Saturn이 세 장 모두 직접 열어 원본/계약과 대조했다. 준비 화면은 활성 전설 상태를 만들 수 없으므로 공통 rail 함수와 기존 회귀로 순서를 확인했다.

캡처는 실제 Chrome의 합성 PVE/주입된 NET 상태 렌더다. 실제 온라인 경기·CJ 플레이 QA로 표시하지 않는다. Free QA의 CI/배포/health/소스 대조는 Issue 본문의 별도 납품 기록으로 확인한다.

## Worker 실행·자원

각 Worker의 현재 세션 JSONL·모델·PID/CLI 옵션과 완료 메시지를 확인한 뒤 수락했다. adopted launch requested/effective는 null 그대로 기록한다. external release 후 소유 PTY를 닫았다. Earth/Venus/Jupiter/Mars 및 Saturn 후속까지 모든 Worker가 종료됐고 소유 Chrome 프로필·검증 Node를 정리했다. 사용자 브라우저·기존 서비스와 재사용된 의존성은 보존했다.

| 역할 | 실제 모델/설정 | 세션 |
|---|---|---|
| Earth | gpt-6-astra / medium / default / full-access·never | 01a0f875-71d6-7132-8ebc-6867fd94d62b |
| Venus | claude-opus-5-5 / high / bypass | 94ccd7db-c0cc-4494-8637-6cb8965a0bd5 |
| Jupiter | claude-opus-5-5 / high / bypass | 1becf000-2497-40ac-8a1a-19c1cbfb1966 |
| Mars 초기/후속 | claude-opus-5-5 / high / bypass | a2668f34-7ad4-4ff6-bff0-a685ac9fa340 |
| Mars QA 수정 | claude-opus-5-5 / high / bypass | 17c82d11-b67c-47b6-b5b2-f453880667ca |
| Saturn 독립/제한 후속 | gpt-6.1-sol / xhigh / default / danger-full-access·never | 01a0f8b7-40a3-7ff0-9c1c-9e30777f39cd |

Saturn 마지막 현재 turn_context는 2026-10-01T18:56:17.320Z, turn `01a0f8d0-2c59-7281-8ce0-8aab90c9bcf6`이다. 처음 REVISE 뒤 같은 세션의 즉시 제한 후속만 사용했고 완료 후 PTY 종료를 확인했다. 읽기 전용 역할은 유지했다.

실제 provider 세션 누계(Claude는 중복 assistant message ID 제거, parseErrors 0):

| 역할 | 입력 | 캐시 읽기 | 캐시 생성 | 출력 |
|---|---:|---:|---:|---:|
| Earth | 2,586,418 | 2,438,400 | 0 | 27,202 |
| Venus | 62 | 6,642,050 | 305,017 | 55,369 |
| Jupiter | 32 | 2,196,688 | 142,035 | 16,591 |
| Mars 초기/후속 | 134 | 21,934,568 | 416,861 | 131,566 |
| Mars QA 수정 | 62 | 4,400,961 | 187,028 | 34,288 |
| Saturn 독립/후속 | 6,880,287 | 6,347,776 | 0 | 26,807 |

Codex 입력은 캐시 포함, 출력은 reasoning 포함이다(Earth 2,120, Saturn 9,408). Claude 입력/캐시 항목은 provider 별도 집계이며 reasoning은 별도 제공되지 않는다. Root의 Issue 시작 사용량 기준점이 없어 정확한 PD 증분·절감률·비용은 주장하지 않는다.

## CJ 재테스트 목록

1. **Q5-01 공통 TopBar**: 두 클라이언트로 대표·이름/긴 이름·내/상대 색을 메인과 #293 준비 shop/place/done에서 확인한다. 대표가 경기 왕/동료로 바뀌지 않는지 확인한다.
2. **Q5-02 서버 시간**: 내/상대 턴, 단절/재연결, 선택/행동 전환에서 같은 보드 마감·정지를 확인한다. 준비 180초/완료 취소도 확인한다.
3. **Q5-03 시너지**: 왕국5→아키타입6→왕관→활성 전설, 0/단계·사망 기여·일반 가방/전설 예외를 확인한다. 전투는 확정 수치/단계 표시를 확인한다.
4. **Q5-04 가방·설명**: 실제 n/3·아이템 수량, 하수인/기술 설명, 상대 비공개 제한, 열기/닫기/중첩/Tab/X/Esc, 단계 만료/새 경기 정리를 확인한다. 설명이 행동을 실행하지 않아야 한다.
5. **Q5-05 모바일·기존 플레이**: 320/390px·PC에서 보드/우측 열/여섯 행동/팝업 스크롤을 확인하고 이동·수풀·상점 남은 턴·감정표현/기권이 유지되는지 재테스트한다.

최종 납품 시 기존 Free `digit-duel-mipa-qa`만 사용한다. #294 검증 SHA의 CI 6/6·배포 SHA·/healthz 200·Git/제공 파일 일치 뒤 #293 원격 브랜치의 사용 종료를 확인해 정리한다. #294 checkout은 CJ QA용으로 유지한다. main 기존 변경 6개·unity/·stash2·미병합 handoff·Draft PR304를 원래 기준과 비교해 보존한다.

## CI 영향 검사 정정

최종 문서 SHA `5bbfe5f0a6227bccf0b28c781b70842508fc81c0`의 CI run [36912961602](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36912961602)는 5/6 PASS, B의 기존 실서버 경제 통합 E15e/E15j 두 항목이 실패했다. #263 시점의 대기 좌석 빈 시간/옛 정지 문구 기대값이 #294 공개 보드 시계 계약과 달랐다.

fresh Mars `ctx_a3e304b060e0` / `task_04b308adc161`가 기존 `smoke_public_eco_live.js`의 두 표시 기대값을 바꾸고 공개 descriptor·턴 전환·단절 정지·잔여 재개 단언 5개를 추가했다. 개인 clock owner 제한·로컬 시한 없음·경제/보안 검사는 유지했다. 최초 49개(47/2) → 54개, 자체 검사 54/0·자연 종료 exit0·16.8초다. 새로운 제품/의존성/CI 설정 변경은 없다. 워커 메시지의 “4개/50→54”는 실제 diff와 CI 로그에 따라 보고 메타데이터를 5개/49→54로 정정했다.

Mars 세션 `b3d4503e-30ba-4f04-8813-3b15b24a7679`의 현재 assistant model Opus5.5·PID22420 high/bypass·현재 footer를 확인했다. adopted requested/effective null. 기존 ws의 절대 require 경로를 기존 main 의존성으로 돌리는 저장소 밖 임시 -r 스크립트를 로컬 검사에서만 사용했다(CI에는 server/node_modules가 있어 필요 없음). 자체 검사 서버/Node 프로세스가 자연 종료됐다. 이 환경 조정은 제품 검사 기대값을 바꾸지 않으며 Saturn이 독립 확인한다.

제품 경로는 `80a2955`와 동일하다. 새 소스 SHA에서 Saturn은 이 테스트 변경만 읽기 전용 검토·단독 실서버 실행하며, 기존 419/0·미영향 1,019/0·이미지 검증을 반복하지 않는다. 최종 독립 판정과 새 SHA CI/배포 결과는 Issue/PR 본문의 납품 원장에 기록한다.

</details>
