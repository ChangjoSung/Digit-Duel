# #182 본구성 구현 인계

2026-09-11 · Mercury. CJ의 실행 승인 범위를 다음 Mars Task에 전달한다. [Issue182](https://github.com/ChangjoSung/Digit-Duel/issues/182)의 AC가 원본이며, 이 문서 자체는 구현 완료 증거가 아니다. #183의 최소 프로젝트·로컬 연결 확인 이후 착수한다.

## 납품 범위

- 최신 정식으로 확인한 `6000.6.0f1` 프로젝트를 유지하고 공식 Android 모듈·SDK·NDK·OpenJDK를 설치·기록한다. 기존 다른 Editor/프로젝트 설정은 보존한다. Hub 설치 DB를 직접 수정하거나 사본으로 복원하지 않는다.
- [참조 판정표](../../../reports/Mercury/reference-architecture.md)를 토대로 Runtime의 Core/Application/Presentation/Infrastructure와 Editor/Tests를 분리한다. Core asmdef는 UnityEngine·Editor·UI·네트워크 의존성을 차단한다. 서버·DB 타입이 게임 정의를 소유하지 않게 한다.
- 자산 로더는 현재 로컬 자산 요구에 맞는 최소 구현을 선택하고 선택 이유·향후 교체 경계를 설명한다. Resources/Addressables 비교는 확인된 요구와 의존 비용을 기준으로 한다. 실제 비동기 로드/실패/해제 수명과 Sprite/Atlas 사용을 작은 시험 자산으로 검증한다. 기존 프로젝트 소스·아트·바이너리 플러그인을 일괄 복사하지 않는다.
- Table은 정적 정의·경기 상태·영속 DB의 경계와 폴더/인터페이스까지만 준비한다. 실제 TSV 스키마·생성기와 게임 규칙/AI는 #185/#186의 후속 범위다. 현재 필요 없는 추상 계층이나 전역 Singleton을 추가하지 않는다.
- 최소 부팅 scene에서 Android 세로 화면, safe area, 입력, 백그라운드 복귀를 확인한다. 검증 표시는 게임 UI나 UI Toolkit 채택 PoC 완료로 취급하지 않는다. #187 전체 화면·튜토리얼·아트 구현은 포함하지 않는다.
- ARM64·IL2CPP 개발 APK를 재현 가능한 Editor/CLI 명령으로 만든다. 개발 서명을 사용하며 개인 서명키·계정값을 추적하지 않는다. 이미 승인된 연결 기기에 설치·실행하고 앱 PID/시작 로그·화면·백그라운드 복귀를 확인한다. 기기 일련번호는 공개 보고에서 제외한다.
- EditMode/PlayMode 검사, Player에서 Editor/테스트 assembly 배제, 새 checkout의 컴파일/실행 절차를 검증한다. 기존 CI6은 별도 회귀이며 Unity 빌드 성공으로 대신하지 않는다. 실제 사용하지 않은 Unity CI 라이선스 설정을 완료로 기록하지 않는다.
- Assets/Packages/ProjectSettings와 필요한 .meta만 추적 대상으로 남기고 Library/Temp/Logs/Builds/UserSettings·로컬 MCP 개인 경로/비밀값을 제외한다. 선택한 패키지/의존성/라이선스 및 로컬 재현·rollback 안내를 기록한다.

## 구현·검수 인계

Mars는 `unity/`, 필요한 `tools/unity/` 및 `issues/182/Mars/` 보고서를 소유한다. Git/GitHub/Notion 쓰기는 Mercury만 수행한다. 하나의 Editor writer를 유지하고 자체 생성 프로세스와 로그 경로를 기록한다. 모든 메시지를 단계마다 check·처리·ack하며 대기는60초 이내로 나눈다. 사용자 `art/`, `orca-hook-latency-report.md`, Downloads·다른 worktree는 열거나 바꾸지 않는다.

보고서는 실제 버전·재현 명령·성공/실패 결과·파일 목록·참조 재사용 판정·알려진 한계를 포함한다. Saturn은 파일 수정 없이 구현과 증거를 독립 대조하고 Mercury가 검수 결과를 보관한다. APK 빌드·실기 기술 검증과 CJ 플레이 QA는 구분하며, 자동으로 Issue를 닫지 않는다.
