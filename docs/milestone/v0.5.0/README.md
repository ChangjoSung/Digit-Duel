# v0.5.0 — Roblox 포팅

[Milestone 12](https://github.com/ChangjoSung/Digit-Duel/milestone/12) · **진행 중 · 미출시**

> **⚠️ 담당 작업자(별도 개발자)는 [Roblox 작업자 안내](../../roblox/BRANCH-POLICY.md)를 먼저 읽는다.**
>
> **버전 재배번**: 이 마일스톤은 2026-09-10까지 `v0.4.6`이었고 [#169](https://github.com/ChangjoSung/Digit-Duel/issues/169) CJ 승인으로 **`v0.5.0`**이 됐다 — Roblox는 HTML 데모와 성격이 다른 마일스톤이라는 CJ 판단이다.
> **트랙 브랜치는 `milestone/v0.5.0`** 이며 `main`·`dev` 와 같은 보호(PR 필수 · 필수 CI 6개 · strict · 관리자 우회 불가)를 적용했다. 이슈 브랜치는 이 트랙에서 분기하고 PR base 도 이 트랙이다.
> 아래 본문에 남은 `v0.4.6` 서술은 작성 당시의 판정이며 고치지 않는다.
>
> **주의 — `v0.4.7` 이 두 가지를 가리킨다.** 옛 `v0.4.7` 은 HTML 데모의 **계획 단계 이름**으로 지금의 `v0.4.6` 이고, 태그 `v0.4.7` 은 2026-09-11 출시 문서 hotfix([노트](../../releases/v0.4.7.md) · 게임 내용은 v0.4.6 과 동일)다. 계획 버전은 Milestone, 배포 버전은 태그로 따로 관리한다.

2026-09-09 CJ 결정으로 이 마일스톤은 [#118 Roblox 포팅](https://github.com/ChangjoSung/Digit-Duel/issues/118)을 담당한다. [이욱채(lee775)](https://github.com/lee775)의 [PR #135](https://github.com/ChangjoSung/Digit-Duel/pull/135)가 dev `4e7adf7745089549c96372c622244cb9d4e18da1`에 병합됐다(2026-09-09 15:00:20 KST). 현재 정식 게임은 [v0.4.5](../v0.4.5/README.md)다.

## 목표와 완료 기준

HTML v0.4.5 규칙을 Luau 룰 엔진으로 옮기고, 서버의 행동 검증·플레이어별 비공개 정보 필터링과 클라이언트 보드 입력을 연결한다. Studio 2인 환경에서 배치 → 매칭 → 대전 → 종료 흐름을 검증한다. 최신 범위·수용 기준·아트 요청 및 후속 제외 항목은 담당자가 관리하는 #118 본문과 PR을 따른다.

PR135는 Phase 1·2a(룰 엔진·서버 권위·3D 로비·아트 연결)를 포함한다. 작성자 보고는 Luau646단언·컴파일·게시 version8이며, **Roblox 코드의 Saturn 교차 QA와 Studio/실서버2인 CJ 플레이 QA는 미완료**로 명시돼 있다. 기존 HTML CI5검사 성공을 Roblox 코드 검수 완료로 해석하지 않는다. Issue118은 OPEN이다.

현재 포팅 안내는 [Roblox README](../../../roblox/README.md), [포팅 플랜](../../roblox/port-plan.md), [로비 설계](../../roblox/lobby-design.md), [Earth 납품 보고](../../art/roblox-v0.5.0/earth-report.md)를 따른다. `roblox-v0.5.0`은 해당 작업자가 사용한 원래 보관 경로이며 현재 출시 일정은 v0.4.6이다. 이번 검사·도구 정리는 이 신규 포팅 산출물의 내용을 바꾸지 않는다.

## 후속 일정과 문서

기존 CJ 게임 #119–#131 및 Infra #132/#134·완료 PR #133은 [v0.4.7](../v0.4.6/README.md)로 이동했다. #132 보고서는 원래 작성 당시의 판단·실행 이력을 보존한 채 v0.4.7의 Issue 폴더에서 찾는다. 이 일정 정리에서 Roblox 작업자의 코드·브랜치·문서를 이동하거나 완료 상태를 변경하지 않는다.

Unity v0.5.0은 기존 별도 계획으로 유지한다. Roblox 완료나 이 문서 갱신이 Unity 착수 승인을 뜻하지 않는다.
