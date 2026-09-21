# Issue #245 구조 전환: migration·rollback·최종 책임 경계

- 기준 이슈: [#245](https://github.com/ChangjoSung/Digit-Duel/issues/245)
- 통합 PR: [#247](https://github.com/ChangjoSung/Digit-Duel/pull/247)
- 전환 전 기준: `9853a2c`
- 문서화한 구현 기준: `55dec997f85e750240f3ef2b191f1a3a35bd5db9`
- 적용 대상: v0.4.11 HTML 클라이언트와 공개 방 서버 권위 엔진

이 문서는 구조 전환이 끝난 현재의 책임 경계와 단계별 되돌리기 단위를 기록한다. 게임 규칙·밸런스·표시 결과를 새로 정의하지 않는다. 규칙의 권위는 Issue #245가 인용하는 승인 문서에 있고, 이 문서는 그 규칙을 어느 모듈이 실행하는지와 장애 시 어느 커밋부터 되돌릴지를 설명한다.

## 보존 계약

구조 전환 전후에 다음 계약은 바뀌지 않는다.

- `demo/index.html` 하나가 `file://`와 HTTP 배포의 진입점이다.
- 같은 seed/action trace는 같은 snapshot·digest·승패 결과를 낸다.
- 공개 방은 서버 권위, 기존 코드 접속은 seed lockstep이며 재접속·숨은 정보 경계를 유지한다.
- #233의 `scheduleDelayed`·`tickDelayed`·`pendingFx`와 #235 예약 소비자 `V2_KINGDOM_STAGE2`를 보존한다.
- #234·#241 승인 동작과 표적 회귀를 보존한다.
- 번들러·프레임워크·상태관리 라이브러리와 생성된 게임 산출물을 추가하지 않는다.

## 최종 로드 구조

`demo/index.html`이 다음 순서를 단일 원본으로 소유한다.

1. `demo/css/game.css`
2. `demo/js/data.js`
3. `demo/js/state.js`
4. `demo/js/ui.js`
5. `demo/js/core.js`
6. `demo/js/ai.js`
7. `demo/js/ui-overlays.js`
8. `demo/js/network.js`
9. `demo/js/bootstrap.js`

classic script의 순서 의존성을 유지하므로 파일을 임의로 재정렬하면 안 된다. 브라우저, 헤드리스 회귀 하네스, 서버 권위 런타임은 모두 이 HTML의 순서를 읽는다. 별도의 스크립트 목록을 손으로 복제하지 않는다.

## 최종 책임 경계

| 영역 | 소유 파일 | 맡는 책임 | 넘지 않는 경계 |
| --- | --- | --- | --- |
| 진입점 | `demo/index.html` | 접근 가능한 HTML 구조, CSS·JS 로드 순서 | 규칙·데이터·스타일 본문을 다시 인라인화하지 않음 |
| CSS | `demo/css/game.css` | 화면 외형과 반응형 배치 | 게임 상태와 규칙 판정 없음 |
| Data | `demo/js/data.js` | 밸런스 상수, 로스터·스킬·효과 정의, 반복 효과 table, 좁은 특수 hook, 기존 art 이미지·preload·canvas 보조 | WebSocket·action dispatch 없음. art 보조의 DOM 의존은 아직 남아 있음 |
| State | `demo/js/state.js` | 상태 생성자, 말 생성자, 상태 모양과 지표 기본값 | 입력 처리·네트워크 송수신·DOM 렌더링 없음 |
| Core | `demo/js/core.js` | action 해석·합법성·결정론적 상태 전이·표시 event·전투·scheduler | WebSocket 송수신 없음. 기존 DOM·timer helper와 `doMoveLegacy` fallback은 아직 같은 파일에 남아 있음 |
| UI | `demo/js/ui.js` | 상태 렌더링, 입력을 action으로 변환, Core event 소비, 연출 포트, 로컬/PVE 게임 초기화 | 일반 gameplay 규칙을 별도로 재계산하지 않음. 초기 phase·선공·metrics와 일부 legacy 이동 bridge는 직접 적용 |
| AI | `demo/js/ai.js` | 상태와 Core selector를 바탕으로 기존 action 선택, AI profile·forced-target 관리, AI setup roster·배치 | 네트워크 프로토콜·별도 권위 규칙 사본 없음 |
| UI overlays | `demo/js/ui-overlays.js` | 모달·튜토리얼·핸드오프·표시 전용 메모 | 권위 상태 전이와 회선 프레임 소유 없음 |
| Network | `demo/js/network.js` | WebSocket, protocol frame, action 전달·재생, 기존 peer setup 검증·적용, 공개방 서버 snapshot 재수화 | Core gameplay 규칙 사본과 독자적 승패 판정 없음 |
| Bootstrap | `demo/js/bootstrap.js` | 초기 게임 상태·아트 프리로드·첫 렌더·튜토리얼 시작 | 추가 규칙·데이터 정의 없음 |
| 서버 runtime adapter | `server/authoritative/runtime.js` | HTML에서 모든 제품 스크립트 순서를 읽고 격리 VM, 타이머 포트, 최소 `document` 호환 sink 제공 | 제품 규칙 사본과 전체 테스트용 브라우저 DOM 하네스 없음 |
| 서버 engine adapter | `server/authoritative/engine.js` | 같은 제품 Core를 서버 스케줄러와 함께 실행하고 오류를 fail-closed로 변환 | 클라이언트와 다른 규칙 엔진 없음 |
| 서버 room/protocol | `server/authoritative/room.js` 및 서버 protocol 계층 | 좌석 권한, frame 검증, 공개 view 직렬화, revision·resume·숨은 정보 | UI 표시 event를 권위 규칙으로 재해석하지 않음 |
| 정적 계약 | `tools/typecheck/` | state/action/event/protocol의 `checkJs` 검사와 음성 대조 | 게임 코드 변환·emit·번들 생성 없음 |

`ui.js`와 `ui-overlays.js`가 관리하는 일시 표시 상태와 개인 메모는 권위 게임 상태가 아니다. 이번 migration에서 이관한 setup·board·turn·search/recruit·battle·delayed·skill action은 Core 경계를 사용한다. 기존 lockstep의 peer setup 검증·적용, 공개방 서버 snapshot 재수화, 로컬/PVE 초기화와 아래 잔여 호환 경로까지 모두 이관됐다고 해석하지 않는다.

## 이관된 Core action 흐름

```text
입력 / AI / 수신 frame
          │
          ▼
     Core action ──────► reduceCoreAction(state, action)
                              │
                    { next state, events }
                         │             │
                         ▼             ▼
                   권위 상태 commit   UI event 소비
                         │
                         ├────────► Network는 action/frame만 전달
                         └────────► 서버 adapter도 같은 제품 Core 실행
```

- UI·AI·Network는 위 migration 범위의 gameplay 입력에 대한 action을 만들거나 전달한다.
- Core는 같은 입력을 한 번 해석하고 다음 상태와 표시 event를 만든다.
- 브라우저는 event를 DOM/연출로 소비한다. 현재 `core.js`에도 기존 전투 연출의 DOM·timer helper가 남아 있으므로 Core 파일 자체가 표시 코드로부터 물리적으로 순수한 상태는 아니다.
- 서버 runtime은 전체 테스트 DOM 하네스 대신 최소 `document`/표시 sink와 결정론적 scheduler를 제공한 뒤 HTML에 적힌 모든 제품 스크립트를 실행한다. 따라서 제품 스크립트 공유는 완료됐지만 `core.js`의 DOM 코드 제거까지 완료됐다는 뜻은 아니다.
- 서버의 좌석·credential·revision·공개 view 검증은 서버 adapter 책임이며 클라이언트 Core를 복제하지 않는다.

### 현재 남아 있는 직접 상태 적용 경계

다음 경로는 위 gameplay action 흐름의 예외이며, 새 권위 규칙을 구현하는 우회로로 확장하지 않는다.

- `data.js`는 art 이미지 생성·preload와 canvas 기반 보조를 위해 DOM API를 사용한다. 이는 데이터 정의와 함께 남은 표시 자원 호환 코드이며 gameplay 판정은 아니다.
- `ai.js`는 AI profile 초기화와 `forcedTargets` 정리뿐 아니라 AI setup roster 선택·말 배치를 상태에 직접 반영한다. `ui.js`의 로컬/PVE 시작 경로도 초기 phase·선공·metrics를 직접 설정한다. 이 초기화 경로는 이관된 gameplay action 흐름과 별도로 남아 있다.
- 기존 lockstep에서 `network.js`는 서버가 중계한 peer setup을 검증해 적용하고, 손상된 배치는 결정론적 무작위 배치로 대체한다. 이는 서버가 setup을 판정한 경로가 아니다.
- 공개방에서는 `network.js`가 서버가 이미 판정한 snapshot의 roster·말 위치·권위 상태를 클라이언트에 직접 재수화한다. 로컬 action을 다시 판정하는 경로가 아니므로 reducer를 재호출하지 않는다.
- `core.js`의 이동 dispatch는 battle-slot·forced-target 경우와 king 이동을 순수 reducer 대상에서 제외하고 `doMoveLegacy`로 fallback한다. 이 경로는 위치를 포함한 gameplay 상태를 직접 바꾸는 잔여 legacy 전이 경로다.
- `core.js`의 기존 DOM·timer helper는 브라우저 표시 호환 경계다. 서버 runtime의 최소 호환 sink가 이를 수용하지만, 장기적인 물리 분리 여부는 이 문서에서 완료로 판정하지 않는다.

## 반복 스킬과 특수 hook

반복 가능한 v2 스킬 효과는 `data.js`의 선언형 레지스트리와 공용 실행 경로가 소유한다. 조건 분기, 1회성 플래그, 상대 효과처럼 표만으로 기존 순서를 보존할 수 없는 동작만 `V2_FX`의 좁은 hook으로 남는다. 새 반복 효과는 먼저 table로 표현하고, 특수 hook을 추가할 때는 왜 공용 실행 경로로 표현할 수 없는지 같은 위치에 적는다.

## Migration 기록

아래 순서는 실제 커밋 순서다. 각 단계는 앞 단계의 동작 동등성 검사를 통과한 뒤 진행됐다.

| 단계 | 커밋 | 전환 내용 | 대표 증거 |
| --- | --- | --- | --- |
| 기준 검사 안정화 | `0c7f2ce` | 기본 공격 회귀의 회피 난수 고정 | 기존 회귀의 결정성 |
| 물리 분리 | `a7d12aa` | CSS 1개와 책임별 JS 8개로 분리, HTML 로드 순서 고정 | `file://`·HTTP·하네스 로드 |
| action/event 기준선 | `4f25555`, `3ce6d9d` | Core action/event 경계와 seed/action trace 기준선 | snapshot·digest·승패 동등성 |
| Setup | `83370c4`, `6a591fa`, `809c616`, `6259edb` | roster·auto·cell·setupDone을 Core action/event로 이동 | setup 표적 회귀 |
| Board action | `253691d`, `f6b9f15`, `a65cd90`, `6596548`, `11f0d45`, `f6a3f00`, `a0b008c`, `f88e778` | 선택·텔레포트·회복·이동·접촉·큐와 순수 reducer 전환 | board/forced-contact trace |
| 턴·종료 | `46aab82`, `c34ec59`, `ac7fb9f` | 강제 전투 drain, 턴 전이, 경기 종료를 reducer로 이동 | turnflow·game-over 회귀 |
| Search/Recruit | `2a52ae2` | 탐색·모집 상태 전이와 ticket 검증을 Core로 이동 | search package 회귀 |
| Battle | `251fc35` | act/item/ball/flee/pass/package 경로를 Core로 이동 | battle frame·slot·ticket 회귀 |
| Delayed scheduler | `9cda912` | delayed effect를 결정론적 Core scheduler 경계로 이동 | #233와 scheduler trace |
| 선언형 skill | `58b113a` | 반복 스킬을 effect table과 좁은 hook으로 정리 | skill/cross-skill 회귀 |
| 공용 서버 Core | `2b9a454` | 테스트 하네스 의존을 제거하고 서버가 제품 스크립트를 직접 실행 | runtime contract·server authoritative·public live |
| 정적 계약 | `55dec99` | state/action/event/protocol `checkJs`와 CI 음성 대조 | `typecheck`·`test:typecheck` |

`30f7e6b`는 중간 PD 인수인계 스냅샷만 갱신한 문서 커밋이다. 제품 rollback 단위와 독립적으로 되돌릴 수 있다.

## Rollback 원칙

1. rollback도 Mercury만 Git으로 수행한다. Worker는 `git revert`, stage, commit, push를 하지 않는다.
2. 공유 브랜치에서 `reset --hard`, 강제 push, 과거 커밋 재작성은 사용하지 않는다.
3. 가장 최근 단계부터 역순으로 `git revert`한다. 앞 단계 하나를 되돌리려면 그것에 의존하는 뒤 단계도 먼저 되돌린다.
4. 기능 수정과 rollback을 한 커밋에 섞지 않는다. revert가 실패하면 충돌 파일과 원인을 보고하고 임의로 규칙을 다시 쓰지 않는다.
5. rollback 뒤에도 PR #247은 단일 통합 PR로 유지하며 CJ 승인 전 merge/close하지 않는다.
6. 각 rollback은 관련 표적 검사, fresh Saturn, 새 HEAD의 필수 CI A/B/B2/C/D/E를 다시 통과해야 완료다.

### 단계별 되돌리기 단위

| 장애가 시작된 단계 | 먼저 되돌릴 범위 | 단계 복구 뒤 최소 확인 |
| --- | --- | --- |
| 정적 계약 | `55dec99` | 기존 제품 회귀와 CI A; 타입 도구가 제거됐다면 typecheck 명령은 적용 대상 아님 |
| 공용 서버 Core | `2b9a454` | server 전체, runtime contract, 공개 방 2-client |
| 선언형 skill | `58b113a` | skill·cross-skill·Issue #245 smoke |
| Delayed scheduler | `9cda912` | #233·scheduler·동일 trace |
| Battle | `251fc35` | battle 표적, server authoritative, public live |
| Search/Recruit | `2a52ae2` | search package·ticket·동일 trace |
| 턴·종료 | `ac7fb9f` → `c34ec59` → `46aab82` | turnflow·game-over·forced queue |
| Board action | `f88e778`부터 `253691d`까지 역순 | board·teleport·heal·collision·동일 trace |
| Setup | `6259edb` → `809c616` → `6a591fa` → `83370c4` | setup·온라인 배치·동일 trace |
| action/event 기준선 | `3ce6d9d` → `4f25555` | 구조 전환 전 전체 회귀와 기준 snapshot |
| 물리 분리 | 이후 제품 단계를 모두 먼저 revert한 뒤 `a7d12aa` | 단일 HTML 기준 `file://`·HTTP·server static load |

한 단계만 다시 적용할 때도 원래 순서를 따른다. 예를 들어 Battle을 되돌린 상태에서 Delayed scheduler나 공용 서버 Core만 선택적으로 다시 적용하지 않는다.

## 검증과 복구 판정

현재 구현 기준의 최소 검증 명령은 다음과 같다.

```text
npm run typecheck
npm run test:typecheck
node demo/test/regression/smoke_issue245.js
npm test --prefix server
node demo/test/integration/smoke_public_live.js 2
node tools/docs/test/docs_link_check_test.js
node tools/docs/docs_link_check.js
```

여기에 실제 `file://`와 HTTP 진입점 확인, PR 새 HEAD의 CI A/B/B2/C/D/E 6/6을 더한다. rollback으로 검사 도구 자체가 제거된 경우에는 그 시점에 존재하는 직전 단계의 검증 계약을 사용하며, 존재하지 않는 명령을 임시 도구로 재현하지 않는다.

다음 중 하나라도 발생하면 다음 migration이나 재적용으로 진행하지 않는다.

- 같은 seed/action trace의 snapshot·digest·승패가 기준과 다름
- 브라우저와 서버에서 action 합법성 또는 frame 해석이 다름
- 공개 방 seat view·revision·resume·숨은 정보 경계가 달라짐
- `file://` 또는 HTTP에서 로드 순서·MIME·정적 요청이 깨짐
- fresh Saturn이 HIGH 또는 MEDIUM 제품 회귀를 보고함
- 필수 CI 6개 중 하나라도 실패하거나 새 HEAD가 아닌 결과만 존재함

## 의도적으로 남긴 호환 계층과 후속 범위

- 서버 runtime의 표시 sink는 실물 DOM이나 선택자 엔진이 아니다. 제품 표시 코드가 헤드리스로 지나가기 위한 최소 포트이며 권위 규칙을 복제하지 않는다.
- classic script 전역과 일부 legacy callback은 `file://` 호환을 위해 남는다. 번들러 도입 없이 제거할 실측 근거가 생기기 전에는 구조만을 위해 바꾸지 않는다.
- 전투원 내부의 세부 수치 구조, 서버 frame의 일부 직렬화 선택, `fleePick.token` 경로 등 타입 검사에서 확인된 후속 판단 항목은 이번 구조 문서가 규칙을 새로 결정하지 않는다. 세부 목록은 [Mars 정적 계약 보고](../Mars/typecheck-report.md)의 7~9절을 따른다.
- 이 문서는 #245 전체 종결 QA를 대신하지 않는다. 전체 AC의 fresh Saturn 판정과 CJ 승인은 별도 최종 단계다.

## 완료 판정

이 문서로 다음을 단일 위치에서 추적할 수 있다.

- 전환 전 기준과 현재 구현 기준
- 단계별 실제 커밋과 역순 rollback 단위
- CSS·Data·State·Core·UI·AI·Network·Bootstrap·server adapter·typecheck의 최종 책임
- 브라우저와 서버가 공유하는 로드 순서와 Core 경계
- rollback 뒤 재검증·중단 조건

문서 내용과 제품이 어긋나면 제품을 문서에 맞추어 임의 수정하지 않는다. 실제 구현·승인 규칙·Issue 본문을 대조해 불일치를 보고하고, CJ가 정한 다음 tranche에서 한쪽을 명시적으로 교정한다.
