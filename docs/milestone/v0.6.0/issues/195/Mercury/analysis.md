# #195 Unity CI 적용 판단

2026-09-11 · Mercury. CJ의 “객관적으로 분석해서 있으면 적용” 지시에 따른 구현 판단이다. #182·#183은 같은 Comment의 QA PASS로 종결했다. CI는 독립 납품 목표다.

## 확인한 공백

현재 필수 A/B/B2/C/D/E는 HTML 규칙·서버·Windows 실행기·문서·아트·Roblox를 검증한다. Unity의 .meta 누락, 어셈블리 경계 변경, Core/Application의 컴파일 오류와 MCP 점검 도구 회귀는 감지하지 못한다. 앞선 Unity40개 검사는 로컬 실제 Editor 증거이며 GitHub CI가 자동 반복하는 상태가 아니다.

GitHub API/CLI 직접 조회에서 저장소는 PUBLIC, repository Actions secrets 목록은 비어 있고 repository self-hosted runners는0개다. 로컬 dotnet SDK 명령도 없다. Unity6000.6.0f1와 Android 모듈은 PC에 설치돼 있으나 이 PC의 라이선스가 GitHub-hosted runner에 자동 전달되는 것은 아니다.

## 선택지

| 구성 | 검출 범위 | 전제·비용 | 이번 판단 |
|---|---|---|---|
| 호스팅 구조·도구 검사 | 추적 .meta/GUID, 설정·패키지·asmdef 경계, MCP 회귀 | Editor·라이선스 불필요, 짧은 PR 검사 | 적용 |
| 호스팅 순수 C# 컴파일 | 실제 Core/Application 소스의 타입·문법 오류와 계층 참조 | .NET SDK, .NET Standard2.1/C#9 제한 | 적용; Unity 전체 컴파일과 구분 |
| 호스팅 Unity Editor 검사·APK 빌드 | 실제 import/컴파일, Edit/Play, Android toolchain | 라이선스 인증·정확한 Editor 실행 환경·큰 다운로드/캐시 | 인증·환경 검증 후 별도 활성화 |
| 현재 개인 PC의 self-hosted runner | 설치된 Editor 활용 가능 | 공개 PR 코드 실행, 기기/세션 충돌·장비 가동 의존 | 이번 자동 적용에서 제외 |

GameCI의 [활성화 안내](https://game.ci/docs/github/activation/)는 Unity action 실행에 라이선스 활성화를 요구하며 계정/라이선스 secret 또는 라이선스 서버 구성을 안내한다. 현재 설정이 없는 상태에서 빈 secret을 넣고 건너뛰는 workflow는 실제 검증을 제공하지 않는다. [GitHub의 runner 안내](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners)는 공개 저장소의 fork PR이 self-hosted 장비에서 코드를 실행할 수 있다고 설명한다. 이 PC를 자동 연결하는 것은 현재 선택에 맞지 않는다.

Unity6000.6의 [공식 C# 문서](https://docs.unity3d.com/6000.6/Documentation/Manual/csharp-compiler.html)는 C#9와 지원 제한을 명시한다. 외부 .NET 컴파일은 해당 언어 수준과 .NET Standard2.1 표면으로 좁히되 Unity의 조건부 심볼·엔진 API·직렬화·IL2CPP 동작을 대체하지 않는다. 정확한 구현과 음성 대조는 Mars 보고에 기록한다.

## 적용 원칙

- 새 F job은 Unity 트랙 PR에서 항상 실행한다. unity/ 필수 파일 삭제를 skip/성공으로 넘기지 않는다.
- 기존 CI6·permissions·트리거를 보존한다. Actions는 전체 SHA로 고정하며 비밀값을 쓰지 않는다.
- 실제 PR에서 새 검사를 성공시킨 뒤 milestone/v0.6.0에만 필수 context를 추가하고 보호 설정을 다시 조회한다. 아직 workflow가 없는 main/dev/Roblox 트랙의 필수 목록은6개로 유지한다.
- 실제 Unity Editor CI가 활성화됐다고 보고하지 않는다. 향후 전용 인증/라이선스, 정확한6000.6 실행환경, 오류/0테스트 실패 처리, NUnit 결과·로그 보관, Android 빌드 성공을 함께 입증해야 한다.
- 통합·독립 검수·보호 설정 결과의 최신 상태는 [Issue195](https://github.com/ChangjoSung/Digit-Duel/issues/195)를 따른다.
