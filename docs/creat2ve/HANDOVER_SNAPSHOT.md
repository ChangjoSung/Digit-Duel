# Digit-Duel — 인수인계 스냅샷

## 기준

- 기준 시각: 2026-09-23 KST
- 최신 제품 완료 범위: Issue #235 왕국·아키타입·전설 시너지
- 최신 운영 변경: Issue #250 Creat2ve Vibe Coding Structure 모델 재설정
- 제품 통합 commit: `957228ddcccad4f769a373e27caaa791d30131a3`
- 통합 PR: [#248](https://github.com/ChangjoSung/Digit-Duel/pull/248), `milestone/v0.4.11`에 squash MERGED
- 모델 설정 통합: [PR #251](https://github.com/ChangjoSung/Digit-Duel/pull/251), merge commit `5435b40ff48c2ca7444771a38f4e125f2c267716`
- Issue [#235](https://github.com/ChangjoSung/Digit-Duel/issues/235): CJ 플레이 QA PASS 후 CLOSED
- 부모 Issue [#232](https://github.com/ChangjoSung/Digit-Duel/issues/232): OPEN. 다음 의존 대상은 #236이지만 별도 CJ 지시 없이 착수하지 않는다.
- 원본 작업공간 `C:\Users\pc_77\orca\Digit-Duel`에는 사용자 변경과 대량 미추적 파일이 있다. 읽기 외 작업, 수정, 스테이징, 정리, pull/switch/reset/clean을 하지 않는다.

## 권위와 역할 계약

충돌 우선순위는 CJ 최신 지시 > `CLAUDE.md` > 프로젝트별 authoritative 문서 > 이 스냅샷 > 범용 핸드북이다.

- Mercury: COORDINATE/GIT/GITHUB/DOC_METADATA만 담당한다. 제품·런타임·빌드·도구·테스트 코드를 직접 수정하지 않는다.
- Mars: CLIENT/HTML/UNITY/TOOLING IMPLEMENT. Git 금지.
- Jupiter: SERVER IMPLEMENT. Git 금지.
- Saturn: QA READ_ONLY, mutation=none. Git·편집 금지.
- Worker dispatch는 `required_role`, `mode`, `area`, `mutation`, `instance_index`의 정확히 5개 preflight 필드를 포함한다.
- 한 번에 한 editor, correction 뒤 fresh Saturn, delivery는 release-before-ack 순서를 지킨다.
- Git은 Mercury만 수행한다. exact file staging, diff check, commit/push 후 새 HEAD CI A/B/B2/C/D/E 6/6을 확인한다.
- Issue TODO는 완료 조건을 충족한 뒤에만 체크하고 누적 진행 댓글을 남기지 않는다.
- Mercury·Saturn은 Codex `gpt-6-sol` xhigh, service tier default(No Fast). Venus·Mars·Jupiter는 Claude `claude-opus-5-5` high. Earth는 신규 창작 `gpt-6-astra` medium·No Fast, 기존 자산 수정 `gpt-6-luna` xhigh·No Fast. Ponytail full을 유지한다.

## #250 모델 재설정 결과

- 프로젝트 기본값은 `.codex/config.toml`의 `gpt-6-sol` xhigh·`service_tier=default`와 `.claude/settings.json`의 `claude-opus-5-5` high다. 역할별 Worker는 항상 `worker-models.json`의 명시값으로 시작한다.
- Codex 역할의 No Fast는 `service_tier=default`로 고정하며, 계정 전역 설정과 다른 프로젝트는 변경하지 않았다.
- 공식 모델 계약과 설치 환경을 대조했다: OpenAI는 `gpt-6-sol`·`gpt-6-luna`의 xhigh와 `service_tier=default` 표준 처리를 지원하고, Claude Code의 `claude-opus-5-5`는 설치된 2.1.280에서 지원된다.
- PR #251 HEAD `3a990166553b37a14b8d48532bf84d8ea3a8fa61`의 GitHub Actions [run 35806710267](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35806710267)은 A/B/B2/C/D/E 6/6 SUCCESS다.
- 새 Mercury_PD만 `gpt-6-sol` xhigh·No Fast·all access로 인계한다. 이 권한은 다른 Worker에 전파하지 않는다.

## #235 완료 결과

- 전투 참전 확정 시 왕국·아키타입·전설 집계를 한 번 계산해 battle snapshot으로 고정했다.
- 왕국은 필드 기여·동결·동속성 수혜, 아키타입은 하수인 6칸과 가방 전설의 중복 없는 집계·전 참전자 수혜를 구현했다.
- 단계·중첩·상한, 전설 직접 참전 패시브, 동료의 복수와 왕의 분노를 공용 Core 경계에 연결했다.
- #243의 Data/Core/UI/AI/Network/Server adapter 책임을 유지했다. 온라인에는 좌석 소유자의 허용된 `synAtk`만 전달하며 상대 집계와 비공개 정보를 노출하지 않는다.
- #233·#234·#241·#245 회귀는 중립 fixture로 보존했고 #235 client/server contract 검사를 추가했다.
- 원격 `feature/235-synergies` 브랜치는 squash merge 뒤 삭제했다.

## 검증 근거

- PR HEAD: `ef9d8bcba33915673bba49bb3c561e67495798e5`
- fresh Saturn 최종 판정: PASS, HIGH 0 / MEDIUM 0 / LOW 0
- GitHub Actions [run 35679411036](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35679411036): A/B/B2/C/D/E 6/6 SUCCESS
- `smoke_issue235` 122/0, `smoke_issue233` 310/0, `smoke_issue234` 352/0, `smoke_issue241` 86/0, `smoke_issue245` 352/0
- typecheck PASS, `test:typecheck` 70/0
- 서버 전체 검사 PASS, `test-issue235-boundary` 37/0
- `git diff --check` PASS
- 삭제된 PR 브랜치 commit `9853a2c`를 참조하던 #245 기준판 검사는 도달 가능한 분리 전 부모 `0b7f683`으로 교정하고, 분리 전 단일 문서 가드를 추가했다.

## GitHub·Orca 상태

- PR #248: MERGED, merge commit `957228d`
- PR #251: MERGED, merge commit `5435b40`
- Issue #235: 모든 완료 조건 체크 후 CLOSED
- Issue #250: 모델 설정·CI 통합 완료. 새 Mercury_PD 시작 영수증과 인계 입력 수락 확인 후 종결한다.
- Issue #232: #235 행을 CLOSED로 갱신, #236~#238은 OPEN·대기
- #235 구현 worktree는 완료 상태이며, 관련 구현·QA worker는 모두 release됐다.
- #250 문서 후속 merge commit과 새 Mercury 작업공간·터미널 handle은 실제 인수인계 메시지에서 제시한다.

## 다음 Mercury PD의 첫 동작

1. `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `ASSET-LICENSE.md`, `docs/creat2ve/README.md`, `AUTHORITY.md`, `WORKER_MODELS.md`, `worker-models.json`, `QA_MINIMUM_POLICY.md`, 이 파일, `github-infra.json`, 역할별 prompt, `Creat2veVibeCodingStructure.html`, Roblox 브랜치 정책, CI 정의를 전부 읽는다.
2. tracked 범위의 추가 governing/`AGENTS.md`를 검색한다.
3. PR #248/#249/#251과 Issue #235/#232/#250의 state/body/checks/merge commit, 원격 `milestone/v0.4.11` HEAD, 원본 작업공간 HEAD/status를 읽기 전용으로 재확인한다.
4. 자기 시작 영수증의 requested/effective가 `gpt-6-sol` xhigh·`service_tier=default`·all access인지 확인하고, 일치하면 Issue #250의 마지막 완료 조건을 체크해 종결한다.
5. `[결정]`으로 시작해 완료 상태와 운영 규칙 이해를 CJ에게 보고하고 다음 지시를 기다린다.
6. 별도 CJ 지시 없이 #236 또는 다른 제품 Issue를 시작하거나 Worker·브랜치·PR을 만들지 않는다.
