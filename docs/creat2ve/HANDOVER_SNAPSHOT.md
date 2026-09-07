# Digit-Duel — 인수인계 스냅샷

> 기준일: 2026-09-07 · 작성: Mercury (PD) · **누적 금지 — 치환 갱신.** 새 세션은 `CLAUDE.md` 다음으로 이 문서를 읽고 시작한다.

## 프로젝트 현재 상태

- **현재 마일스톤**: GitHub Milestone #7 `v0.4.3 — HTML 데모 후속 업데이트` 진행 중
- **최근 릴리스**: `v0.4.2` — Public·Apache-2.0·원클릭 LAN
- **QA**: v0.4.2 릴리스까지 완료. 이후 제품 코드 변경 없음. v0.4.3 하수인 외형 규격은 구현 전 분석 문서 단계이므로 실행 QA 미착수
- **GitHub**: Issue #81 하수인 외형 이미지 규격 문서화 완료, Issue #83 Mercury 세션 교대 스냅샷 완료. 두 건 모두 v0.4.3 마일스톤 소속
- **Git**: `dev`와 `origin/dev`를 통합 기준으로 사용. 사용자 소유 미추적 항목 `art/`, `orca-hook-latency-report.md`는 수정·커밋하지 않는다
- **기획 문서**: `docs/minion-visual-spec-v0.4.3.md`가 현재 하수인 외형 이미지 규격 분석 원본
- **조직 문서**: `CLAUDE.md`의 Creat2ve Vibe Coding Structure rev 6 / release 0.3.0과 역할 계약을 따른다

## 진행 중 작업 (dispatch 기준)

| 역할 인스턴스 (Role 또는 Role_n) | mode / area / mutation | 작업 | 상태 | retain lease (있으면 기한·범위) |
|---|---|---|---|---|
| — | — | — | 활성 dispatch 없음 | — |

## 인계 사항

- CJ Comment는 이 Mercury 창구가 유일하게 직접 수신한다.
- Mercury는 조정·Git·문서 메타데이터만 집행한다. 제품·런타임·빌드·도구·테스트 코드는 Mars/Jupiter 역할로 라우팅한다.
- `main`·`dev` 직접 커밋은 금지한다. 최신 `origin/dev`에서 이슈 브랜치를 만들고 PR로 `dev`에 squash merge한다.
- 현재 저장소는 Public이다. 코드는 Apache License 2.0이고 자산은 `ASSET-LICENSE.md`의 별도 조건을 따른다.
- 서버 기본 실행은 루프백 전용이며 LAN 공개는 `server/LAN서버시작.bat`을 선택한 실행에만 적용된다.
- v0.4.3 하수인 외형 권장안은 설명창 512×512px 제작·192×192px 표시, 전투 도트 64×64px 작업·128×128px 납품/표시, 전투 영역 높이 200px이다.
- 하수인 외형은 설명창 20장과 전투 방향 한 종 20장, 총 40장 범위를 권장했으며 아직 구현 승인은 받지 않았다.
- 이전 Mercury 세션은 장기 대화와 실제 컨텍스트 압축 발생으로 교대한다. 새 Mercury 목표 모델은 `gpt-6-astra`, reasoning effort는 `high`다.

## 남은 결정 (CJ)

- [기획 필요] 단일 HTML 원칙을 완화하고 `demo/assets/minions/` 외부 상대경로를 사용할지
- [기획 필요] v0.4.3에서 전투 방향을 정면 또는 3/4 한 종으로 제한할지
- [기획 필요] 말판과 로스터 카드에도 개별 하수인 외형을 노출할지
- [기획 필요] 하수인 아트 제작 담당·제작 방식·캐릭터별 승인 절차

## 새 Mercury 개시 체크리스트

1. `CLAUDE.md` 전체와 이 스냅샷을 읽는다.
2. `git status --short --branch`로 `dev` 동기화 상태와 사용자 미추적 파일을 확인한다.
3. GitHub Milestone #7 및 열린 Issue/PR을 확인한다.
4. 역할 계약과 패스트트랙/10단계 워크플로우를 유지한다.
5. CJ에게 GPT-6 Astra Mercury 인수 완료를 보고하고 다음 Comment를 기다린다.

## 교대 기록

| 날짜 | 신호 | 이전 세션이 남긴 한 줄 |
|---|---|---|
| 2026-09-07 | 장기 상설 세션·컨텍스트 압축 발생·모델 전환 요청 | v0.4.3 하수인 외형 규격 문서와 GitHub 반영까지 완료. 구현은 미승인 상태이며 다음 결정은 위 4개 항목이다. |
