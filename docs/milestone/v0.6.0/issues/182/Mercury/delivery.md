# #182 Unity·Android 개발 기반 검증

2026-09-11 · Mercury. 개발 기반 납품이며 게임 포팅과 CJ 수락은 별도다. 새 체크아웃 import·40개 검사·최종 래퍼 APK 빌드를 통과했다. 통합 PR·필수 CI6·CJ 수락의 최신 상태는 [Issue182](https://github.com/ChangjoSung/Digit-Duel/issues/182)에 기록한다.

## 구성과 실행

- 프로젝트: 저장소의 `unity/`. Unity Editor **6000.6.0f1**과 해당 Editor의 Android 모듈을 사용한다.
- 7개 asmdef로 Core/Application/Infrastructure/Presentation/Editor/두 테스트 계층을 분리한다. Core는 현재 순수 C# 타입·인터페이스만 포함한다.
- Boot scene은 입력·safe area·Sprite Atlas·자산 수명 검증용이다. 최종 게임 UI나 UI Toolkit 구현이 아니다.
- Windows에서 프로젝트를 짧은 경로에 체크아웃한다. 긴 경로에서는 Unity 패키지 내부 경로가 길어져 import 실패가 관측됐다.

```powershell
unity open "C:/WORK/Digit-Duel/unity"
unity command editor_status --project-path "C:/WORK/Digit-Duel/unity" --json
```

빌드 전에 해당 프로젝트의 Editor를 정상 종료한 뒤 저장소 루트에서 실행한다. 다른 프로젝트의 Editor를 닫을 필요는 없다.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/unity/build-android-apk.ps1
```

기본 출력은 `unity/Builds/Android/DigitDuel-dev.apk`, 로그는 `unity/Logs/android-build-<시각>.log`다. 둘 다 Git에서 제외된다. 기본 설치 경로와 다른 Editor는 `-UnityExe`, 다른 프로젝트는 `-ProjectPath`로 지정한다. 기존 로그 파일은 덮어쓰지 않는다.

## 확인한 APK

| 항목 | 결과 |
|---|---|
| 파일 | DigitDuel-dev.apk · 129,878,662 bytes |
| SHA256 | E1210D7555E3BFF8F08B9073EE7E67E4A685204EBBDF2E45293CC8BC63CD17EB |
| 빌드 | 06:49 UTC 성공 · errors0 / warnings5 |
| Player | ARM64만 포함 · IL2CPP · min API26 / target API36 |
| 개발 식별자 | com.creat2ve.digitduel.dev · 최종 스토어 식별자 아님 |
| 실기 | 삼성 SM_S948N · Android16 / API36 |
| 동작 | 설치·실행, 터치2회, 홈 이동 후 동일 PID 복귀, 세로/safe area, ETC2 Atlas 연결 |

[실기 화면](../Mars/artifacts/device-boot-portrait.png) · [앱 로그 발췌](../Mars/artifacts/device-run-logcat.txt) · [전체 구현 보고](../Mars/environment.md).

## 검증 범위와 제한

- 실제 Claude MCP Unity 검사 EditMode19/19·PlayMode21/21. [Saturn 독립 소스 검수](saturn-source-review.md) PASS는 정적 소스 판정이며 테스트 재실행·실기 검증과 구분한다.
- 새 Git checkout `095e4dfccdcfc52cd60764c896f2a501cbecf354`를 `C:/Temp/DD QA 095e4df/unity`에서 캐시 없이 열어 import/컴파일 오류0·EditMode19/19·PlayMode21/21을 확인했다(Mars_2 `msg_36d95491eed7`). 첫 긴 경로 clone의 import 오류25건과 PlayMode0건은 PASS에 포함하지 않는다. 이 snapshot은 납품 브랜치를 변경하지 않은 임시 검증 커밋이다.
- 같은 새 체크아웃에서 최종 래퍼를 실제 실행해 종료 코드0·오류0·경고5로 APK 빌드에 성공했다(5분38.142초). 공백 경로 인용과 시각별 로그 생성도 확인했다. 검증용 APK는129,877,150 bytes, SHA256 `630631C011A26D5A0F5C46F0F7EB6C60F8441D4114CDEB929A952F0A705A4839`다. 위 실기에 설치한 APK와 구분하며 바이트 동일성을 주장하지 않는다.
- 체크아웃은 열기 전 깨끗했으며, import/검사 이후 URP GlobalSettings의 파생 runtime 목록이 비워지는 직렬화 차이1파일을 Mercury가 확인했다. 배치 빌드 뒤에는 다시 깨끗했다. 변동 기전은 미확인이며 이를 원본 프로젝트에 자동 복사하지 않았다.
- Mercury는 원본 APK를 aapt2와 ZIP 조회로 직접 대조해 API26/36, ARM64만 포함, libil2cpp.so와 IL2CPP metadata를 확인했다.
- 원본 APK의 `assets/bin/Data/Managed/Metadata/global-metadata.dat`를 메모리로 읽어 Core/Application/Infrastructure/Presentation의 `.dll` 이름이 모두 존재하고, DigitDuel.Editor/Tests.EditMode/Tests.PlayMode의 `.dll` 이름은 모두 없음을 대조했다. 이는 해당 어셈블리 메타데이터의 포함 여부 확인이며 전체 네이티브 코드 역분석은 아니다.
- 첫 API37 빌드는 설치된 `android-37.0`과 Gradle의 `android-37` 식별자 불일치로 실패했다. Editor 최신 버전은 유지하고 이번 개발 APK를 API36으로 고정했다.
- 자산 핸들·캐시 해제는 검사했으며 실제 메모리 회수량은 측정하지 않았다. 태블릿/폴더블·멀티윈도우·장시간 구동은 이번 실기 검증 범위 밖이다.
- 최초 설치 작업의 Hub DB 수동 열 추가는 남아 있다. 무결성 검사는 통과했지만 안전한 변경 전 백업을 입증하지 못해 복원하지 않았다. [실행 원장](execution.md)에 예외를 보존한다.

## 되돌리기

기준 커밋에는 Unity 프로젝트가 없으므로 일부 폴더만 지우는 대신 #182 납품 커밋 전체를 되돌리는 PR을 만든다. 뒤이어 #183을 통합했다면 연결 도구·등록 경로의 의존성도 함께 정리한다. 공유 Editor/Android 모듈과 다른 프로젝트 설정은 그대로 둔다. 기기의 개발 앱 제거 명령은 `adb uninstall com.creat2ve.digitduel.dev`다.
