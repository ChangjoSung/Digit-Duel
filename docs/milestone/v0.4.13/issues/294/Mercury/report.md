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
