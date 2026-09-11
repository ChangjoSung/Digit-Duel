# #195 CI 운영 범위와 실패 대응

## 검사 범위

`F. Unity 구조·순수 C#·MCP`는 Unity 트랙의 프로젝트 구조, 엔진 비의존 Core/Application C# 컴파일, MCP 도구 회귀를 담당한다. 기존 A/B/B2/C/D/E와 함께 실행한다. `unity/`를 삭제하거나 필수 설정이 빠진 PR도 검사하며 경로 필터로 통과시키지 않는다.

이 검사는 Unity Editor import/전체 컴파일, EditMode/PlayMode, Android IL2CPP/APK, UI·실기 검증을 대신하지 않는다. #182의 과거 Unity40개·실기 PASS와 이 CI의 새 결과는 별개의 증거다. 구현 파일·재현 명령·음성 대조 결과는 Mars 보고, 실제 GitHub 실행·보호 설정 결과는 [Issue195](https://github.com/ChangjoSung/Digit-Duel/issues/195)를 따른다.

## 로컬 재현

저장소 루트에서 Node 24와 .NET SDK 10으로 실행한다. 새 자산은 Git에 추적돼 있어야 구조 검사의 대상에 들어간다. 구조 검사기는 읽기 전용이고, 회귀 테스트는 임시 fixture를 만들며, dotnet은 CI 프로젝트 아래 무시된 bin/obj를 생성한다.

```text
node --test tools/unity/ci/unity_project_check.test.js
node tools/unity/ci/unity_project_check.js --verbose
dotnet build tools/unity/ci/compile/DigitDuel.Core/DigitDuel.Core.csproj -c Release --nologo
dotnet build tools/unity/ci/compile/DigitDuel.Application/DigitDuel.Application.csproj -c Release --nologo
node --test tools/unity/mcp_smoke.test.js
```

2026-09-11 Mercury 재실행: 구조 회귀37/37, MCP46/46, 실제 프로젝트 구조 PASS. `git diff --exit-code HEAD -- unity`로 기존 Unity 제품 파일의 변경이 없음을 확인했다. 실제 컴파일·GitHub PR·독립 검수의 최종 증거는 Issue195에 함께 기록한다.

## 실패 대응

- 구조 실패: 로그에 표시된 자산과 `.meta`, GUID, asmdef, 패키지 잠금 또는 프로젝트 설정을 함께 확인한다. 검사만 끄거나 캐시 파일을 커밋해 해결하지 않는다.
- C# 실패: Core/Application의 실제 소스·참조 경계를 수정한다. Unity 엔진 API가 필요해졌다면 해당 코드를 엔진 의존 계층으로 옮길지 검토한다. 검사 프로젝트에 임의 스텁이나 참조를 넣어 숨기지 않는다.
- MCP 회귀 실패: 기존 도구의 입출력·실패 전달 계약을 확인한다. 로컬 인증 정보나 실제 Editor 연결 없이 실행되는 회귀 검사다.
- 러너·다운로드 실패: 실패한 단계와 외부 장애를 구분한 뒤 재실행한다. 검사를 skip하거나 성공으로 재분류하지 않는다.

## 보호 정책과 되돌리기

새 F의 실제 PR 성공 후 `milestone/v0.6.0`에만 GitHub Actions 앱15368의 필수 context를 추가한다. 기존 6개 context·strict·관리자 적용·PR 요구는 유지한다. `main`, `dev`, `milestone/v0.5.0`는 F가 도입되지 않은 브랜치라 기존 6개를 유지한다. Unity 트랙을 dev/main에 통합할 때 그 시점의 workflow와 필수 context를 함께 재검토한다.

도구 결함이면 같은 Issue의 수정 PR을 우선한다. F 자체를 철회해야 한다면 승인된 되돌리기 PR과 보호 context 변경을 한 작업으로 기록한다. F를 삭제한 PR은 F 필수 보호가 남아 있으면 pending되므로, 변경 전 context 목록과 실제 실패 근거를 보관하고 F만 해제한 뒤 기존 6개를 통과해 병합한다. strict·관리자 적용 등 기존 보호를 끄는 방식은 사용하지 않는다. 보호 설정 변경 후 API를 다시 조회한다.

## 실제 Unity Editor CI의 후속 조건

전용 CI 인증/라이선스와 유지 주체를 정하고, 고정 Editor 버전·Android 모듈이 있는 실행 환경에서 다음 증거를 갖춘 뒤 활성화한다.

1. 깨끗한 checkout의 import·전체 C# 컴파일 성공.
2. EditMode/PlayMode 결과 파일을 확인하고 0개 실행·실패·타임아웃을 실패 처리.
3. Android IL2CPP 빌드 성공과 APK·NUnit 결과·Editor 로그 보관.
4. 공개 fork PR과 인증을 쓰는 실행의 권한 경계를 검증.

현재 개인 PC의 로컬 라이선스를 클라우드에 복사하거나 공개 PR용 runner로 자동 등록하지 않는다. 인증이 없어 건너뛰는 placeholder workflow는 납품하지 않는다.
