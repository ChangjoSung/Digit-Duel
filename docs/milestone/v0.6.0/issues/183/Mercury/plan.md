# #183 — Unity CLI·MCP와 Codex·Claude 연결
2026-09-11 · Mercury(PD) · 기술 검증 완료, 통합·CJ 수락 상태는 아래 GitHub Issue를 따른다.

- [GitHub Issue](https://github.com/ChangjoSung/Digit-Duel/issues/183)가 범위·AC·현재 상태의 원본이다.
- 순서: CLI·에이전트 설정 준비를 먼저 수행하고 #182 최소 프로젝트 이후 실제 Editor 호출을 검증한다. #182 전체 완료를 기다리지 않는다. 직접 CLI 경로를 기본으로 확보하며 MCP도 별도 검증한다.
- CJ 추가 지정: Unity MCP는 이 PC의 로컬 stdio 서버로 구성한다. 현재 Orca/Codex 활성 계정과 Claude Code에 등록하고 Digit-Duel 경로를 고정한다. 직접 CLI 성공만으로 MCP를 완료하지 않으며 각 에이전트의 실제 MCP 호출을 확인한다.
- 구현 소관: Mars. QA=Saturn, Git·문서·취합=Mercury.
- [마일스톤 인덱스](../../../README.md) · [전체 분석](../../../reports/Mercury/unity-port-analysis.md) · [등록 원장](../../../reports/Mercury/registration.md).
- 이슈 브랜치는 milestone/v0.6.0에서 분기하고 PR base도 같은 트랙. 실제 구현 보고·증빙은 이 Issue의 역할별 폴더에 보관한다.
- 이번 등록을 Unity 설치·MCP 연결·APK 빌드·게임 포팅·온라인 검증 완료로 해석하지 않는다.
