# #294 Mercury delivery ledger

2026-10-02 · [결정] CJ 승인 “승인합니다. 구현 시작하세요.”에 따라 구현 진행 중.

- 대상: S03 메인 Flow, 우측 내 시너지, 가방/하수인 상세, #293 shop/place/done 공통 계정 대표·이름 TopBar.
- 작업 공간: `ChangjoSung/issue-294-main-flow`, 최신 `origin/milestone/v0.4.13` 기준 `39241d2eda689bf8f70d085886afa230d43f7e4d`. 하나의 Issue WorkTree에서 역할별 파일 분리.
- CJ 입력: [원문](../references/CJ_COMMENT.md), [콘티 원본](../references/CJ_CONCEPT_CONTI_20261002.png). 원본 SHA256 `f1d15251da5c0cfb69ddc75ed6164f4bdc5fc159b14397689815522db9a19261`.
- Earth 첫 분석·편집 시안 검토 및 Issue 본문 반영: [분석](../Earth/analysis.md), [계약 제안](../Earth/UI_CONTRACT.md), [시안](../Earth/main-flow-preview.png). 소스 고정 `cd04f9e5958ab98c1a84b19a0b1b220dbf841dfb`. 정적 시안은 제품 QA PASS가 아니다.
- Earth 실제 모델: 세션 `01a0f875-71d6-7132-8ebc-6867fd94d62b`의 현재 JSONL turn_context Astra/medium/full-access/never, PID11560 default tier. adopted launch requested/effective null. worker_done 수락 후 release(external terminal) 및 PTY 종료 확인.
- Venus [구현 계약](../Venus/implementation-contract.md)과 [GDD 동기화](../Venus/decision-sync.md), Jupiter 서버 및 Mars 클라이언트 납품 검토 완료. Saturn은 제품 소스 고정 SHA에서 fresh read-only 검증한다. 코드/도구/테스트 구현은 Mercury가 대행하지 않는다.
- 필수 CI 6개, Saturn, 실제 320/390px·PC 화면 검수, Free QA 배포: 아직 미완료.
- 기존 Free QA `digit-duel-mipa-qa`는 현재 #293 브랜치 / `c8b2b7c`를 서비스한다. 대시보드 확인: Free, Auto-Deploy Off, build `npm ci --prefix server`, start `npm start --prefix server`, health `/healthz`. #294 CI 검증 SHA를 배포한 뒤 소스 일치·health를 확인한다.
- CJ #294 플레이 QA·Issue 종결·milestone 병합은 대기한다. main/dev 직접 변경, Release, 운영 Render, 새 자원·결제는 포함하지 않는다.
- #293은 CJ PASS·종결 승인으로 CLOSED, PR305는 milestone에 `39241d2` squash 및 해당 SHA CI 6/6 PASS. 완료 WorkTree/로컬 브랜치는 삭제했다. 원격 #293은 현 QA 연결 때문에 유지하며 #294 배포 후 사용 여부를 재확인한다.
- main 기존 tracked 변경6·unity/·stash2·미병합 handoff·Draft PR304는 보존한다. 최종 비교 및 자체 검증 리스너/Worker 정리는 납품 시 기록한다.
- Venus 완료 증거: 세션 94ccd7db-c0cc-4494-8637-6cb8965a0bd5의 2026-10-01T17:49:04.395Z assistant model claude-opus-5-5; PID30416 high/bypass. worker_done 수락 뒤 release 및 PTY 종료 확인.
- Jupiter 검토 완료: room.js 15줄의 읽기 전용 boardClock 추가; 기존 입력 시계/clock scheduling 불변. 타이머164/0(exit0), 경제181/0(exit0). 새 전제 단언 수정1회, ws 환경 실패1회는 [Jupiter 보고](../Jupiter/report.md)에 기록. stable 비교기 호출은 상점 구간뿐(boardClock 없음/null)이어서 불필요한 정규화는 생략했다. 세션1becf000-2497-40ac-8a1a-19c1cbfb1966의 현재 assistant model Opus5.5와 PID24196 high/bypass 확인 후 release 및 PTY 종료.
- Mars 검토 완료: [납품 보고](../Mars/report.md), [실측](../Mars/evidence/capture-log.json), [후속 실측](../Mars/evidence/capture-followup-log.json). #293 122/0, #238 155/0, #263 client 186/0, memo 최종129/0, typecheck exit0. 공용 harness 변경 때문에 전체 회귀1회: 37/38 PASS, fx_timing 배치 실패 뒤 단독82/0. Saturn이 원인을 독립 검토한다. 화면38장은 실제 Chrome 렌더의 합성 상태이며 실경기 캡처가 아니다.
- Mars 후속 범위: 기존 튜토리얼 폭탄·함정 문장 재사용, 잔여 합성 토스트 만료 후 배치 캡처3장 교체, 완료/준비취소 캡처2장 추가. product toast는 무수정. memo D3 기대값, 필요한 harness 리스너, 메인 appBar 접기, 턴 변경 시 설명 닫기, 320px 세로 스크롤은 확정 계약 안의 조정으로 수락. 실제 boardClock 클라이언트 통합·실경기는 별도 검증 범위로 남긴다.
- Mars 세션 a2668f34-7ad4-4ff6-bff0-a685ac9fa340의 완료 assistant 2026-10-01T18:24:09.728Z model Opus5.5 및 PID11144 high/bypass 확인. 원 dispatch ctx_87838bfe38dc와 15분 이내 후속 ctx_f214a2003ab5 수락, external release 뒤 PTY 종료. Earth/Venus/Jupiter/Mars adopted launch requested/effective는 null 그대로 기록한다.

## Mars QA 수정 납품

fresh dispatch `ctx_aa6fb9923005`를 수락했다. 수정은 `ui.js`의 기존 `synExtraChips` 순서와 `uiDrawer`/공통 Tab 핸들러만이다. index/CSS/harness/Core/server 무수정. [후속 실브라우저 로그](../Mars/evidence/qa-correction-log.json)와 새 `*-main-rail-crown-first.png` 3장을 확인했다. 기존 38장은 `757f45b` 시점의 이력이며 시너지 순서의 최신 증거와 구분한다.

- #293 124/0(1회), #238 최종159/0. #238 새 단언의 스텁 오류2건 수정 때문에 해당 검사만 총3회 수행했고 제품은 그 사이 불변이다.
- typecheck exit0지만 제품 통과 뒤 테스트 수정 후 추가 실행해 총2회였다. 추가1회는 불필요한 반복으로 기록한다. 완료된 Worker를 즉시 종료했고 후속 재사용하지 않는다.
- 가방은 열 때 X, Tab/Shift+Tab 내부 순환, 자식 설명 창 우선, X/Esc 후 가방 버튼 복귀. 390×844/320×640/짧은320×420의 실제 키 입력·상태 무변경·긴 팝업 스크롤을 기록했다. 서버 요청이나 규칙 변경은 없다.
- 세션 `17c82d11-b67c-47b6-b5b2-f453880667ca`, 완료 assistant `2026-10-01T18:49:26.615Z` model Opus5.5, PID36552 high/bypass 확인 후 external release 및 PTY 종료. 수정 소스 고정 후 Saturn은 영향받는 범위만 재검사한다.

## Saturn 1차 독립 QA — REVISE

검증 소스 `757f45bd77c2b2aae7612902946e6703463c891a`, 기준 `39241d2eda689bf8f70d085886afa230d43f7e4d`. dispatch `ctx_f8960118c3d4`, 상세 메시지 `msg_01e8973ca624`, 완료 `msg_3fb81a6a08aa`. Worker 파일 수정 없음, 소스/HEAD 무변경 확인.

- 시너지 열은 계약의 왕국5 → 아키타입6 → 왕관 → 활성 전설 순서여야 하는데 전설이 왕관 앞에 있음. `synExtraChips`의 순서와 실제 PC 캡처를 대조한 지적을 수락했다.
- 가방은 dialog인데 열 때 초점 이동·Tab 가두기·X 닫기 후 복귀가 없음. 설명 창의 Tab 동작과 별개로 가방 자체에 적용하도록 수락했다. 중첩 설명 창의 우선순위는 유지한다.
- 두 건은 Mars fresh dispatch `ctx_aa6fb9923005`로 라우팅. Saturn 현재 소스 검사 종료 뒤에만 GO를 줬다. 전체 검사/네트워크 수동 매트릭스 재실행 없이 영향받는 검사만 수행한다.

| 검사(소스당 실제 실행1회) | 결과 |
|---|---|
| typecheck (`npm.cmd run typecheck`) | exit0 |
| #293 / #238 / #263 client / memo | 122/0 · 155/0 · 186/0 · 129/0, 각 exit0 |
| #263 server timers / #237 economy | 164/0 · 181/0, 각 exit0 |
| fx_timing(다른 실행 종료 후 단독) | 82/0, exit0 |

총 1,019/0 단언. 첫 `npm.ps1` 호출은 Windows 정책으로 tsc 실행 전 중단했고 `npm.cmd`만 실제 검사했다. 정책/설치 무변경, ws는 main의 기존 server/node_modules를 NODE_PATH로 읽기만 했다.

실제 경제 Room.toSeatView → 기존 클라이언트 netApplyRoomState 양 좌석의 흐름/정지 시계·개인 clock·전송0·서버 마감/revision 보존을 메모리에서 7/7 단언했다. 첫 stdin 인코딩 오류는 단언0개였고 승인된 ASCII/Unicode escape 호출로 교정했다. 교정 호출은 클라이언트 interval 때문에 종료되지 않아 자체 Node PID21872만 정리했으며 **exit1이므로 정상 종료 integration PASS로 기록하지 않는다**. 후속 QA에서 검사 수명주기만 교정해 1회 재검사한다.

시각: CJ 원본·Earth 시안·Mars 대표18장을 직접 열어 대조. 44px 컨트롤·320/390 가로 넘침 없음·320 세로 스크롤·배치 잔여 토스트0·완료/취소를 확인했다. 합성 상태/실경기 구분은 유지하며 추가 CJ 플레이 QA와 배포 PASS는 주장하지 않는다.

실행 증거: fresh 세션 `01a0f8b7-40a3-7ff0-9c1c-9e30777f39cd`, 현재 JSONL turn `01a0f8b8-a927-7de2-9ab8-0cafe2c3b82f` / model `gpt-6.1-sol` / xhigh / danger-full-access / never. CLI PID36128의 default tier와 현재 footer/preamble/모델 전환 없음 확인. adopted launch requested/effective null. 완료 후 external release, 바로 이어질 제한 후속 QA를 위해 터미널만 최대15분 유지한다.
