# 새 Claude 세션의 로컬 MCP 검증

2026-09-11 06:17 UTC · Mars_2 실제 호출 → Mercury 기록. Task `task_6152d4dd2b92`, Dispatch `ctx_ffc9dbb61059`. 원 보고 `msg_84c66cb0ab7e`. 이 Task는 이후 #182 구현도 수행하므로 전체 Task가 READ_ONLY였다는 뜻은 아니다.

새 Claude Code 세션은 `unity-editor-mcp` 서버의 실제 MCP 도구로 다음 네 조회를 수행했다. shell Unity CLI나 자체 JSON-RPC 스크립트로 대체하지 않았다.

| 도구 (`mcp__unity-editor-mcp__` 접두사) | 결과 |
|---|---|
| `editor_status` | ready, compiling=false, playMode=stopped, 정확한 Digit-Duel/unity 경로, Unity6000.6.0f1 |
| `list_open_scenes` | SampleScene1개, loaded/active=true, dirty=false, root2 |
| `get_scene_hierarchy` | Main Camera와 Global Light 2D, Codex 조회와 같은 구성 |
| `package_list` | 설치73개·직접 의존56개, Pipeline0.6.0-exp.1 |

이는 최소 프로젝트 당시 패키지 수이며 #182 패키지 정리 후의 수치를 대신하지 않는다. 이 조회 단계에서 설정/프로젝트 파일을 변경하지 않았다. 이후 PD가 Editor PID20300과 프로젝트 단일 writer를 Mars_2에 이관했다.

[Codex 독립 검증](codex-mcp-verification.md) · [설치와 설정 보고](../Mars/report.md). 두 에이전트의 실제 로컬 조회 성공과 임시 씬 변경·테스트 실행·다중 Editor 선택·Android 검증은 구분한다.
