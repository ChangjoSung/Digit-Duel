# #183 로컬 Unity MCP 사용과 검증

2026-09-11 · Mercury. 현재 PC에서 새 Codex·Claude 세션의 실제 Unity MCP 호출을 확인했다. 기존에 실행 중이던 에이전트의 도구 목록이 자동 갱신된다고 보장하지 않으므로 **새 세션에서 사용한다.**

## 사용

1. `C:/Users/pc_77/orca/Digit-Duel/unity`를 Unity6000.6.0f1로 연다.
2. 새 Codex 또는 Claude Code 세션을 시작한다. Codex 등록명은 `unity`, Claude는 `unity-editor-mcp`다.
3. Unity의 프로젝트 상태·열린 scene을 조회해 대상 경로가 위 프로젝트인지 확인한다. 두 에이전트가 함께 연결돼도 scene·asset 수정은 한 에이전트만 담당한다.

연결은 이 PC의 `Unity/bin/unity.exe mcp --project-path <프로젝트>`가 제공하는 **로컬 stdio**다. Unity 계정·패키지 설치는 별도의 서비스 연결을 사용하며 기존 Notion MCP 항목은 보존했다.

직접 점검은 저장소 루트에서 실행한다. PATH에 Unity CLI가 없으면 실제 설치된 exe를 지정한다.

```powershell
node tools/unity/mcp_smoke.js --unity-bin "C:/Users/pc_77/AppData/Local/Unity/bin/unity.exe"
```

기본 호출은 읽기 전용 `editor_status`다. `--tool`로 변경형 도구를 지정하면 실제 프로젝트를 변경하며, timeout은 Editor 변경을 취소하거나 되돌리지 않는다. 출력은 자동 마스킹되지 않는다.

## 검증

| 항목 | 증거 |
|---|---|
| CLI / Editor / Pipeline | 1.0.0-beta.9 / 6000.6.0f1 / 0.6.0-exp.1 |
| 에이전트 실행기 | 07:08 UTC 직접 조회: codex-cli0.154.0 / Claude Code2.1.268 |
| 새 Codex | [149도구·실제4콜](codex-mcp-verification.md) |
| 새 Claude | [실제4콜](claude-mcp-verification.md)와 환경 구현 중 실제 테스트/Editor 작업 |
| 개정 점검 도구 | [회귀46/46·실제 서버 재연결](final-live-verification.md) |
| 독립 소스 검수 | [Saturn PASS](saturn-final-review.md) |
| 다중 Editor | [환경 보고15절](../../182/Mars/environment.md): 두 Editor 동시 실행, Claude MCP는 Digit-Duel·Atlas1개, 반대쪽 CLI Atlas0개 |

MCP 연결과 공식 에이전트 플러그인 설치는 별개다. 공식 unity-cli 스킬은 설치했지만 플러그인 전체 설치 완료로 표현하지 않는다. Pipeline은 실험 버전이다.

## 설정 위치와 복원

Orca 환경에서는 Codex 활성 계정 파일만 등록했을 때 새 세션에서 Unity 항목이 사라지는 것을 관측했다. 기본 사용자 `.codex`, Orca 공용 `codex-runtime-home/home`, 활성 `codex-accounts/<계정>/home`에 정상 Codex CLI로 등록한 뒤 실제 새 세션에서 유지됨을 확인했다. 내부 동기화 구현 자체를 확정한 것은 아니다.

정확한 명령·scope·기존 항목 보존·설정 제거는 [구현 보고8절](../Mars/report.md)에 있다. 복원 시 각 Codex home의 `unity` 항목과 Claude 사용자 scope의 `unity-editor-mcp`만 제거하며 기존 MCP 설정 전체를 덮어쓰지 않는다. 프로젝트 위치를 옮기면 고정 경로도 함께 갱신한다. CJ의 실제 사용 확인과 PR/CI 완료 여부는 Issue183에서 관리한다.
