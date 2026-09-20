# Digit-Duel — 인수인계 스냅샷

## 기준

- 기준 시각: 2026-09-20 KST
- 현재 CJ 지시: 다음 Mercury_PD에게 인계하고, 새 PD가 프로젝트 규칙 이해 여부와 Issue #245 잔여 작업을 CJ에게 보고한다.
- 현재 최우선 작업: [Issue #245](https://github.com/ChangjoSung/Digit-Duel/issues/245) 단일 HTML 책임 분리 및 장기 유지보수 구조 전환
- 통합 PR: [PR #247](https://github.com/ChangjoSung/Digit-Duel/pull/247), base `milestone/v0.4.11`, branch `infra/245-html-structure`
- 제품·테스트 checkpoint: `6259edb7b2eb8aff329a14b9f3a7d75547b70b60`
- 작업공간: `C:\Users\pc_77\orca\workspaces\Digit-Duel\infra-245-html-structure`
- 원본 작업공간 `C:\Users\pc_77\orca\Digit-Duel`에는 사용자 변경과 대량 미추적 파일이 있다. 읽기·수정·스테이징·정리하지 않는다.

## 권위와 역할 계약

충돌 우선순위는 CJ 최신 Comment > `CLAUDE.md` > GDD > Notion 구조 정의 > 이 스냅샷 > 범용 핸드북이다.

- Mercury: 조정·Git·GitHub·문서 메타데이터만 담당한다. 제품·런타임·빌드·도구·테스트 코드는 소규모라도 직접 수정하지 않는다.
- Venus: PLAN 전용. 제품·도구·테스트 코드 수정 금지.
- Mars: Client·HTML·Unity·툴링·테스트 구현.
- Jupiter: Server·DB·서버 테스트 구현.
- Saturn: READ_ONLY 독립 QA. 어떤 파일도 수정하지 않는다.
- Earth: 아트 자산 전담. 코드 수정 금지.
- 모든 Worker는 git/GitHub/Notion 쓰기 금지이며, Mercury가 diff 검토 후 Git과 메타데이터를 집행한다.
- dispatch 전 `required_role`, `mode`, `area`, `mutation`, `instance_index`를 확인한다. 위반은 `role_scope_mismatch`로 거부한다.
- Mercury·Mars·Jupiter·Saturn은 Ponytail `full` 필수다.
- 신규 실행값: Mercury/Saturn = Codex `gpt-5.6-sol` high, No Fast; Venus/Mars/Jupiter = Claude `claude-opus-5` high.
- QA는 변경 위험에 필요한 최소 자동·헤드리스 검사를 우선하고, 이유 없는 전체 반복이나 네트워크 수동 매트릭스를 금지한다. 필수 CI 6개는 유지한다.

## #245 완료된 범위

- `demo/index.html`의 CSS 1개와 책임별 JavaScript 8개를 정적 파일로 분리하고 문서 순서 로딩을 고정했다.
- 헤드리스 하네스가 현재 외부 파일과 과거 단일 HTML 기준판을 모두 읽도록 호환했다.
- 정적 JS/CSS MIME·요청 코퍼스 54건·예산 57건을 서버 계약에 반영했다.
- setup의 `selTray`·`roster`·`cell`·`auto`·`clear`·`setupDone`, board의 `tele`·`skipMain`을 첫 순수 reducer/action-event 경계로 옮겼다.
- AI 생략을 기존 `netAction` 경로로 통일했다.
- setup cell의 zone 행 membership, 정수 열 범위, 존재하는 target ID 검증과 hotseat/PVE/public·matchmaking 회귀를 보강했다.
- `smoke_issue245`가 seed 24501·24502의 scheduler 단계별 state trace와 최종 snapshot·digest·승패를 구조 변경 전 `9853a2c` 기준선과 대조한다.
- 실제 Chrome `file://`·HTTP 동적 보드, 공개 방 실제 서버 2-client 2게임, #234·#241 영향 회귀를 확인했다.
- 제품 checkpoint `6259edb`의 GitHub CI A/B/B2/C/D/E는 6/6 PASS다.
- fresh Saturn은 현재 PR tranche에 HIGH/MEDIUM 제품 회귀 없음으로 PASS했다. 이는 #245 전체 종결 QA가 아니다.

## 절차 정정 이력

직전 Mercury가 역할을 잘못 해석해 제품·테스트 코드를 직접 수정했다. CJ가 Creat2ve 구조 위반을 지적한 즉시 직접 구현을 중단했다.

정정 후 Run `run_ae5c490cbb0a`에서:

1. Saturn READ_ONLY 1차 검사: REVISE — setup cell 입력 검증과 setup 완료 경로 증거 부족.
2. Mars_Client 수정: 해당 검증과 표적 회귀만 보강, git 쓰기 없음.
3. fresh Saturn 재검사: PASS — `smoke_issue245` 25/25, public rooms 직접 영향 143/143.
4. 별도 fresh Saturn의 현재 PR 전체 tranche 검사: PASS, HIGH/MEDIUM 없음.
5. 모든 Worker 5개는 release 완료, 활성·reclaimable Worker 0.

근거:

- [역할 복구 보고](https://github.com/ChangjoSung/Digit-Duel/issues/245#issuecomment-5749929647)
- [최종 Worker 검사 기록](https://github.com/ChangjoSung/Digit-Duel/issues/245#issuecomment-5749969782)

앞으로 제품·테스트 변경은 Mars/Jupiter 구현 → fresh Saturn READ_ONLY QA → Mercury diff 검토·Git 순서만 허용한다.

## #245 남은 작업 — 우선순위

1. **Data·Core·UI 경계 완성**
   - 잔여 전역 데이터와 규칙 상태 변경을 책임 경계로 옮긴다.
   - 반복 스킬을 선언적 effect/data table로 정리하고 특수 동작만 좁은 hook으로 남긴다.
   - `scheduleDelayed`·`tickDelayed`·`pendingFx`의 #233 계약을 보존하며 결정론적 event/scheduler 경계로 옮긴다.
   - 담당: Mars. 규칙 변경은 금지하며 기획에 없는 판단은 `[기획 필요]`.
2. **나머지 단일 action/Core 경계와 reducer 전환**
   - 순서: 남은 board action → search/recruit → battle → delayed effect.
   - UI·AI·Network의 직접 상태 변경을 제거한다.
   - 각 좁은 tranche마다 기존 seed/action trace 동등성을 먼저 통과한다.
   - 담당: Mars.
3. **브라우저·서버 공통 Core 통합**
   - 서버가 DOM 전체와 브라우저 하네스 없이 동일 결정론적 Core를 직접 사용하게 한다.
   - 서버 규칙 사본과 파싱 기반 경계 검사를 공용 계약으로 치환한다.
   - Client·공용 tooling/Core는 Mars, server adapter·server 검증은 Jupiter로 분리한다. 역할을 섞지 않는다.
4. **정적 타입 계약과 잔여 결합 정리**
   - state/action/event/protocol을 TypeScript 또는 `checkJs`로 CI에서 검사한다.
   - `file://`, 서버 공용 Core, 단일 원본, CI 재현성을 모두 만족하는 최소 방식을 택한다. 근거 없는 라이브러리·번들러는 추가하지 않는다.
   - 사용하지 않는 전역·임시 adapter·이전 하네스 결합을 제거한다.
5. **migration·rollback·최종 책임 경계 문서**
   - 단계별 되돌림 단위와 최종 모듈 책임을 현재 상태로 치환 기록한다.
   - Mercury가 구현 보고를 취합하고 기술 내용은 Mars/Jupiter 결과와 일치시킨다.
6. **#245 전체 종결 QA와 통합**
   - fresh Saturn이 전체 AC를 READ_ONLY로 검증한다.
   - 필수 CI 6개, `file://`·HTTP, 결정론적 trace, #234·#241, 서버, 공개 방 2-client의 필요한 최종 증거를 확인한다.
   - CJ 승인 전 PR 병합·Issue 종료 금지.
   - PR #247을 이 납품 목표의 단일 통합 PR로 유지한다. 별도 구현 Issue·PR을 임의로 만들지 않는다.

## 현재 미완료 Acceptance Criteria

- CSS·Data·Core·UI·AI·Network·Bootstrap 최종 책임 분리
- 모든 게임 상태 변경의 단일 action/Core 경계
- 반복 스킬 선언적 table과 특수 hook
- 브라우저·서버 동일 DOM-free Core
- state/action/event/protocol 정적 타입 CI
- #245 전체 fresh Saturn HIGH/MEDIUM 없음 판정
- migration·rollback 및 최종 책임 문서
- 부모 브랜치 통합과 부모 범위 PR의 `milestone/v0.4.11` 병합 후 Issue 종료

## 새 Mercury_PD의 첫 동작

1. `CLAUDE.md`, `CONTRIBUTING.md`, `docs/creat2ve/{AUTHORITY,WORKER_MODELS,QA_MINIMUM_POLICY,HANDOVER_SNAPSHOT}.md`, `worker-models.json`, 역할별 prompt, 브랜치 정책과 CI 정의를 읽는다.
2. CJ에게 첫 보고를 `[결정]`으로 시작하고 규칙 이해 여부, Mercury 금지 범위, Worker 라우팅·QA·Git 흐름, #245 완료/미완료를 자기 말로 보고한다.
3. GitHub Issue #245와 PR #247의 최신 원격 상태, 현재 branch/HEAD/clean 여부를 다시 확인한다.
4. 추가 구현 전 올바른 Mars/Jupiter Task를 작은 tranche로 정의하고 preflight 5필드와 모델·effort·Ponytail을 명시한다.
5. 현재 PR은 병합·종료하지 않는다. 다른 v0.4.11 제품 Issue도 #245 종결 전 착수하지 않는다.
