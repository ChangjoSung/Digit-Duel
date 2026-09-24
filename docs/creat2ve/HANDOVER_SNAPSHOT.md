# Digit-Duel — 인수인계 스냅샷

## 기준

- 기준 시각: 2026-09-24 KST. 실제 원격 HEAD와 GitHub 상태는 새 세션에서 재조회한다.
- 최신 제품·기획 완료 범위: Issue #253 CJ UI System Flow Lerp Concept 보완·공용 아트
- 최신 운영 결정: 다음 Earth 작업의 자산 유형별 Skill 선택은 [WORKER_MODELS.md](WORKER_MODELS.md#earth-이미지-skill-선택--2026-09-24-cj-지시)를 따른다.
- #253 통합 commit: `750253cbc838678a03db970c6e367f2bf1ffba30`
- 통합 PR: [#254](https://github.com/ChangjoSung/Digit-Duel/pull/254), `milestone/v0.4.11`에 squash MERGED
- 모델 설정 통합: [PR #251](https://github.com/ChangjoSung/Digit-Duel/pull/251), merge commit `5435b40ff48c2ca7444771a38f4e125f2c267716`
- 모델 문서 후속: [PR #252](https://github.com/ChangjoSung/Digit-Duel/pull/252), merge commit `5c833b5f7bd8fa4b4585405b8a44d94b2995b966`
- Issue [#253](https://github.com/ChangjoSung/Digit-Duel/issues/253): Venus 기획·Earth 공용 아트·Saturn QA·CJ 시각 승인·트랙 통합 후 CLOSED. #235와 #250도 CLOSED.
- 부모 Issue [#232](https://github.com/ChangjoSung/Digit-Duel/issues/232): OPEN. #236 → #237 → #238 순서이며 각 제품 이슈의 별도 CJ 착수 게이트를 지킨다.
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
- 2026-09-24 새 Mercury_PD 인수 영수증은 `gpt-6-sol` xhigh·No Fast·all access로 확인됐고 #250을 종결했다. 이 권한은 다른 Worker에 전파하지 않는다.

## #253 UI System Flow 인계와 다음 Earth Skill

- [GDD-24 00.1~00.10](https://app.notion.com/p/3dc1e7f1708581a48421fcec63d3cdf8)에 CJ 스케치의 T/L/S/M/B/X 화면 대응, 전이·예외·모션 제안·미결정 목록을 기록했다. [GDD-13 9장](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38)에 CJ의 방향 승인과 개별 수치 미승인을 구분했다.
- #253 [Venus 보고](../milestone/v0.4.11/issues/253/Venus/report.md)와 [Earth 보고](../milestone/v0.4.11/issues/253/Earth/report.md), [contact sheet](../milestone/v0.4.11/issues/253/Earth/contact-sheet.png)를 #238 입력으로 사용한다. 기존 화면에 없는 로그인·채팅·고정 75% 로딩 등을 구현 승인으로 오독하지 않는다.
- 새 Saturn 독립 QA PASS(HIGH 0 / MEDIUM 0 / LOW 0), PR #254 HEAD `934080cc5bafcf81aac24ca46ba684233f2067a5`의 CI 6/6 SUCCESS, squash commit `750253c` push [CI 6/6 SUCCESS](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35944373970). CJ는 공용 아트 시각 방향을 승인했다. GDD-24 00.10의 개별 규칙·모션 수치 승인과는 구분한다.
- 다음 Earth Task는 [WORKER_MODELS.md의 자산 유형별 Skill 표](WORKER_MODELS.md#earth-이미지-skill-선택--2026-09-24-cj-지시)를 dispatch에 적용한다. #253처럼 정확한 SVG/아이콘/UI 상태는 원본 직접 편집, 새 래스터 일러스트·배경 시안은 `imagegen` 선택 사용이다. GPT Image 2.5 실행 여부는 모델 영수증으로 확인할 수 있을 때만 기록한다. 신규 창작 `gpt-6-astra` medium·No Fast / 기존 수정 `gpt-6-luna` xhigh·No Fast 계약은 유지한다.
- 남은 UI 실행은 #238이다. #236은 상점·가방·포획 경제 상태, #237은 서버 권위·상대 단절 상태·타이머, #238은 CJ 화면 전체 T/L/S/M/B/X의 최종 구성·입력·접근성·아트 연결을 맡는다. #238은 #236·#237 완료와 CJ 별도 착수 지시 전 시작하지 않는다.

## #235 완료 결과

- 전투 참전 확정 시 왕국·아키타입·전설 집계를 한 번 계산해 battle snapshot으로 고정했다.
- 왕국은 필드 기여·동결·동속성 수혜, 아키타입은 하수인 6칸과 가방 전설의 중복 없는 집계·전 참전자 수혜를 구현했다.
- 단계·중첩·상한, 전설 직접 참전 패시브, 동료의 복수와 왕의 분노를 공용 Core 경계에 연결했다.
- #243의 Data/Core/UI/AI/Network/Server adapter 책임을 유지했다. 온라인에는 좌석 소유자의 허용된 `synAtk`만 전달하며 상대 집계와 비공개 정보를 노출하지 않는다.
- #233·#234·#241·#245 회귀는 중립 fixture로 보존했고 #235 client/server contract 검사를 추가했다.
- 원격 `feature/235-synergies` 브랜치는 squash merge 뒤 삭제했다.

## #235 검증 근거

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
- PR #252: MERGED, merge commit `5c833b5`
- PR #254: MERGED, merge commit `750253c`
- Issue #235: 모든 완료 조건 체크 후 CLOSED
- Issue #250: 새 Mercury_PD 시작 영수증과 인계 수락 후 CLOSED
- Issue #253: 모든 완료 조건 체크 후 CLOSED
- Issue #232: #235·#253 행 CLOSED, #236~#238은 OPEN·대기
- #235 구현 worktree는 완료 상태이며, 관련 구현·QA worker는 모두 release됐다.

## 다음 Mercury PD의 첫 동작

1. `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `ASSET-LICENSE.md`, `docs/creat2ve/README.md`, `AUTHORITY.md`, `WORKER_MODELS.md`, `worker-models.json`, `QA_MINIMUM_POLICY.md`, 이 파일, `github-infra.json`, 역할별 prompt, `Creat2veVibeCodingStructure.html`, Roblox 브랜치 정책, CI 정의를 전부 읽는다.
2. tracked 범위의 추가 governing/`AGENTS.md`를 검색한다.
3. PR #254와 Issue #253/#232/#236/#237/#238의 state/body/checks, 원격 `milestone/v0.4.11` HEAD, 원본 작업공간 HEAD/status를 읽기 전용으로 재확인한다.
4. 자기 시작 영수증의 requested/effective 모델·effort·service tier·권한을 확인한다. Earth를 dispatch할 때는 이 문서의 Skill 인계와 `WORKER_MODELS.md`의 실행 계약을 함께 적용한다.
5. `[결정]`으로 시작해 완료 상태와 운영 규칙 이해를 CJ에게 보고한다. 별도 CJ 착수 지시 없이 #236·#237·#238 제품 구현이나 Worker를 시작하지 않는다.
