# v0.6.0 Unity 포팅 사전 분석
2026-09-11 · Mercury(PD) · CJ Comment에 따른 분석·이슈 등록. **구현 완료 보고나 확정 게임 기획서가 아니다.**

## 1. 결론과 범위
CJ의 네 안건을 환경, MCP, 데이터, 코어, Android UI, 온라인의 여섯 납품 목표로 나눈다. 데이터 생성기와 UI는 각각 독립 검증·교체가 가능하고, 서버는 담당자·프로토콜이 아직 미정이므로 클라이언트의 오프라인 구현을 막지 않도록 경계를 둔다. 별도 부모 에픽은 만들지 않고 Milestone 4가 전체 일정의 단일 원본이다.
- 확정 입력: 최신 Unity 정식 버전, Android APK, MyFundManager 기본 구성 참조, audition_idol 보완 구조 검토, HTML 데모 전체 시스템 포팅 준비.
- 분석 제안: 순수 C# Core, 정적 TSV와 런타임/DB 분리, UI Toolkit 실기 검증 후 채택, 로컬/원격 세션 어댑터.
- 미확정: UI Toolkit 최종 채택, 서버 담당/권위 모델/프로토콜·DB 스키마, APK 최소 기기·성능 예산, 튜토리얼의 앱 수명주기, 추가 아트 규격.
- 범위 밖: 현재 턴의 Unity 설치/게임 구현/운영 서버 배포, 새 밸런싱, 보류 #119/#120/#123/#127의 자동 재개, Earth 제작 착수.

## 2. 조사 기준과 인계
GitHub dev `f6bbc7a6239aefd7045800e724ca4e70f3357a03`에서 새 트랙을 분기했다. HTML 게임 기준은 v0.4.6이며 v0.4.7은 동일 게임의 문서 hotfix다.
[기준 릴리스](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.7), [#121 계약](../../../v0.4.6/issues/121/Venus/gameplay-spec.md), [#146 계약](../../../v0.4.6/issues/146/Venus/gameplay-spec.md), [#122 최종 수정](../../../v0.4.6/issues/122/Mars/revise-cjqa-rules/report.md)을 함께 읽는다. **옛 #114/#146의 왕 불가침·동료 밀기·도망 반격 없음은 #122 최종 변경으로 대체됐다.**
자료 우선순위는 최신 CJ 결정 → 현행 승인 계약·제품 → 작성 당시 보고다. Roblox의 게시 버전이나 private 참조 프로젝트의 게임 정책을 Unity 기획으로 가져오지 않는다.

## 3. Unity·CLI·MCP
### 공식 근거와 버전
- 최신 정식 major/minor는 [Unity 6.6](https://discussions.unity.com/t/unity-6-6-is-now-available/1735357), 확인한 정확 버전은 [6000.6.0f1](https://unity.com/releases/editor/whats-new/6000.6.0f1)이다(출시 페이지 8월 31일, 발표 9월 1일). 공식 CLI `unity releases --stream tech --limit 5 --json`에도 존재한다. “날짜가 더 최근인 6.5 패치”와 “최신 정식 계열”을 구분한다. 설치 당일 공식 목록에서 패치를 재확인하고 잠근다. Alpha/Beta Editor로 자동 이동하지 않는다.
- 이 PC의 CLI는 `1.0.0-beta.9`; Editor는 `6000.0.25f1`, `6000.4.10f1` 설치 확인. 6.4에는 Android SDK/NDK/OpenJDK 모듈이 있지만 6.6에 설치됐다는 뜻은 아니다.
- 9월 2일 CLI beta.8 발표와 9월 9일 [Claude 공식 플러그인 발표](https://unity.com/blog/unity-plugin-for-claude-code)를 확인했다. CLI 최초 1.0 beta는 7월 23일이므로 “지난주 처음 생긴 MCP”라고 묶지 않는다. 설치된 beta.9는 로컬 버전 결과로 확인했다.
- [Unity MCP 전환 문서](https://docs.unity.com/en-us/unity-cli/replace-mcp-server-unity-cli)는 `com.unity.ai.assistant` 내부 서버에서 CLI의 `unity mcp` + `com.unity.pipeline` 경로로 이전을 안내한다. CLI 명령 호출도 가능하다.

### 실제 점검 결과
| 점검 | 관찰 |
|---|---|
| unity --version | 1.0.0-beta.9 |
| unity mcp configure --help | codex, claude-code 지원 명시 |
| unity status --json | STATUS_NO_INSTANCES, 연결 가능한 Pipeline Editor 0 |
| codex mcp get unity | 해당 이름 미등록 |
| claude mcp get unity-editor-mcp | 해당 이름 미등록 |
| Codex configure dry-run | 기본 ~/.codex/config.toml 대상 |
| 현 Orca 환경 | 별도 계정별 CODEX_HOME 사용 |
| Claude configure dry-run | claude mcp add 호출안 출력, 실제 등록되지 않음을 후속 get으로 확인 |

위 명령들은 설치·설정 변경을 실행하지 않았다. 알려진 서버명 조회만 했으므로 다른 이름으로 등록된 연결까지 전부 없다고 주장하지 않는다.

### 제안 연결 순서
1. 환경 이슈에서 최소 `unity/` 프로젝트를 만든다. CLI 준비는 프로젝트 생성과 병행할 수 있다.
2. [Pipeline 안내](https://docs.unity.com/en-us/unity-production-pipeline/local-tools-cli/unity-pipeline-package)에 따라 실제 프로젝트에 패키지를 설치하고 컴파일한다.
3. `unity mcp --project-path <실제 Unity 프로젝트>`로 대상을 고정한다.
4. Codex는 활성 CODEX_HOME에 대해 `codex mcp add`를 사용하거나 신뢰된 프로젝트 설정으로 등록하고 새 세션의 도구를 검증한다. 자동 configure의 기본 경로를 그대로 믿지 않는다. [OpenAI MCP 문서](https://developers.openai.com/codex/mcp/)
5. Claude Code는 프로젝트/사용자 범위를 명시한다. [Claude MCP 문서](https://code.claude.com/docs/en/mcp)
6. 양쪽에서 프로젝트 식별·조회·테스트 scene의 변경/복구·테스트 결과 수집·재시작 후 연결을 확인한다. Editor 쓰기는 한 writer가 소유한다.

공식 skills/plugin 경로도 [Claude Code](https://docs.unity.com/en-us/ai/unity-plugin/claude-code)와 [Codex](https://docs.unity.com/en-us/ai/unity-plugin/codex) 각각 확인했다. 로컬 `codex plugin --help`에 해당 명령군이 있다. 발표 블로그의 다른 에이전트 지원 예고보다 구체적인 현재 설치 문서를 참고하되 실제 설치·동작은 구현 AC로 남긴다.

## 4. 브랜치·폴더·CI
- 트랙: `milestone/v0.6.0`, dev에서 분기. 이슈 브랜치 → squash → 트랙 → merge commit → dev → merge commit → main.
- 트랙에 dev와 동일한 필수 CI6(A/B/B2/C/D/E), strict, PR 필수, 관리자 적용, force push/삭제 금지를 설정·재조회한다.
- dev의 workflow에는 milestone/**가 없었다. Roblox #181의 **workflow 변경만** 가져와 새 트랙의 첫 PR부터 검사가 실행되게 한다. Roblox 제품 코드를 함께 역이식하지 않는다.
- 문서는 `docs/milestone/v0.6.0/README.md`, `reports/Mercury/`, `issues/<번호>/<역할>/`에 둔다. 이번 제안은 승인 규격이 아니므로 `specs/`에 두지 않는다.
- 분석·등록 문서 PR은 환경 #182의 사전 준비 납품이며 Unity 프로젝트 생성 완료와 다르다. 각 실제 구현 목표는 자체 통합 PR로 검수한다.
- 여섯 기존 CI는 Unity를 빌드하지 않는다. Unity 프로젝트와 라이선스/실행 환경을 마련한 뒤 Unity EditMode/PlayMode·APK 검증을 별도로 추가한다.

## 5. 참조 구조·시스템 분석 결과

[참조 구조 판정](reference-architecture.md)은 MFM·audition_idol의 재사용/수정/제외 근거, [시스템·데이터·UI](systems-data-ui.md)는 HTML 대응표·정적 테이블 후보·UI Toolkit 검증·CJ 리소스 보고 목록이다. [등록·검증 기록](registration.md)에서 실제 이슈·트랙·작업 정산을 확인한다.

핵심 위험은 완성되지 않은 Addressables 기반을 있다고 가정하는 것, CSV 확장자와 실제 TSV를 혼동하는 것, 반사 등록·네이티브 gRPC 의존성을 APK 검증 없이 복제하는 것이다. Core는 Unity/UI/전송 SDK에 의존하지 않도록 분리한다. UI Toolkit은 공식 비교에서도 런타임 대안이며 실기 PoC 이전에는 채택 확정이 아니다. 서버 구현은 조사한 클라이언트 폴더에서 확인하지 못했으므로 MongoDB·권위 모델을 확정하지 않는다.

## 6. 분석·실행 기록
Run `run_4ef1e8847d4b`. Mars_1=참조 구조, Mars_2=HTML 시스템/데이터/UI의 읽기 전용 기술 분석, Mars_3=workflow 범위 수정. Mercury=취합·문서·GitHub.
Mars_1/2 dispatch의 최초 mode=PLAN 표기는 PD 입력 오류로, mode=IMPLEMENT·mutation=none으로 즉시 정정 통지했다. 실제 업무는 구현자 소관 기술 분석이며 게임 기획 확정이나 코드 수정 권한을 주지 않았다.
