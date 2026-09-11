# 새 Codex 세션의 로컬 MCP 검증

2026-09-11 · Saturn READ_ONLY 실행 → Mercury 기록. Task `task_b6537e1dee26`, 최종 Dispatch `ctx_7982396f99d8`. 원 보고 `msg_09a4af229b3b`, 06:14:50 UTC. 파일 수정은 Saturn0건이다.

## 실제 호출 결과

새 세션의 ALL_TOOLS에 `mcp__unity__` 도구149개가 노출됐다. 아래 네 호출은 shell CLI나 자체 JSON-RPC 스크립트로 대체하지 않고 에이전트에 연결된 MCP 도구로 수행했다. 모두 첫 시도에 성공했다.

| 실제 MCP 도구 | 응답 |
|---|---|
| `mcp__unity__editor_status` | ready, compiling=false, domainReloadInProgress=false, playMode=stopped, Unity6000.6.0f1, 정확한 Digit-Duel/unity 경로 |
| `mcp__unity__list_open_scenes` | SampleScene 1개, Assets/Scenes/SampleScene.unity, loaded/active=true, dirty=false, root2 |
| `mcp__unity__get_scene_hierarchy` | 같은 씬, Main Camera와 Global Light 2D 두 루트, 자식 없음 |
| `mcp__unity__get_console_logs` (severity=error, limit=1000) | total0, returned0, logs=[] |

콘솔 오류0은 현재 캡처 버퍼의 관측이다. 전체 과거 로그나 Android 빌드 성공으로 확장하지 않는다. Editor 기동·변경·파일/보고서 생성은 Saturn이 하지 않았다. 이 결과는 새 Codex의 실제 로컬 MCP 조회를 검증하며 #183 전체 AC 완료나 CJ 수락은 별도다.

## 설정 지속성 문제와 수정

처음 활성 Orca 계정 CODEX_HOME에만 Unity를 등록했을 때 새 세션에서 항목이 사라졌다. `ctx_fd23d85ad4cd`는 실제 노출 도구96개·Unity0, MCP 호출0으로 failed 정산했다. 공용 `orca/codex-runtime-home/home`에도 등록한 다음 시도 `ctx_73d6a2f40a53` 역시 Unity0·unknown MCP server unity로 failed였다. 두 시도 모두 archive/release했으며 성공 기록으로 합산하지 않는다.

공식 `codex mcp add`로 기본 사용자 `~/.codex`, Orca 공용 runtime-home/home, 활성 계정 home 세 곳에 Unity를 등록한 뒤 새 세션에서 항목 유지와 위 실호출이 확인됐다. node_repl·notion 등 기존 항목은 보존했다. 기본 사용자 설정 추가가 관측 결과를 바꿨으나 Orca 내부 복사 구현 전체를 검증한 것은 아니다. 사용자가 나중에 계정/앱 설정을 바꾸면 새 세션에서 다시 확인한다.

세 설정은 공식 로컬 Unity 실행 파일의 `mcp --project-path <Digit-Duel/unity>` stdio 서버를 사용한다. 토큰·환경 비밀값·개인 설정 파일 전문은 저장소에 넣지 않는다. 상세 설치·rollback은 [Mars 보고](../Mars/report.md)를 따른다.
