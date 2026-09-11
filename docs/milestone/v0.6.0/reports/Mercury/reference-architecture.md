# 참조 Unity 구조 판정

2026-09-11 · Mars_1 읽기 전용 조사 → Mercury 검토·취합. 구현 승인 규격이 아닌 #182·#185·#184의 기술 준비 자료다.

## 확인 범위

[MyFundManager](https://github.com/ChangjoSung/MyFundManager)의 `main/client/`와 로컬 `C:\WORK\Client\audition_idol`을 읽었다. 비공개 프로젝트의 구조와 의존성만 요약하며 업무 데이터·키·소스 전문을 이 저장소에 복사하지 않는다. audition_idol에서 서버 구현과 원본 `.proto`는 확인하지 못했으므로 서버 구조 검증 완료로 취급하지 않는다.

| 항목 | MyFundManager 관찰 | audition_idol 관찰 | Digit-Duel 판단 |
|---|---|---|---|
| Editor·렌더링 | 6000.4.10f1, URP17.4, 2D Renderer 설정 | 6000.0.25f1, URP17.0 | 최신 정식 6.6에서 최소 프로젝트부터 구성·빌드 검증 |
| 폴더·Assembly | Runtime/Editor/Tests 및 기능별 구성, 자체 asmdef 6개 | 번호별 폴더, 34개 Contents 기능 묶음, 자체 asmdef 없음 | MFM의 분리 원칙을 기본으로 채택; 이름·게임 기능은 새로 구성 |
| Table | GameTable의 POCO, TablePath, CSV 2행 이름/타입, 코드 생성·Editor 창, 지연 조회 | MonoBehaviour 테이블, 수동 타입 등록; Resources/Table의 `.csv` 내용은 탭 구분 | TSV 명세·POCO·멱등 생성·명시적 등록 채택; 잘못된 확장자와 수동 큐 제외 |
| 자산 | GlobalBase에 Resources 구현, Addressable enum 항목과 조사 문서 | SpriteAtlasV2와 SpriteManager의 enum 매핑 | Atlas·수명 관리 원칙 재사용. 두 manifest에 Addressables 패키지 없음; 실제 로딩 방식은 구현·측정 후 선택 |
| 공통 유틸 | GlobalBase/Enum/Function | gbBase/gbUI/gbUtil, 큰 GlobalFunction, Focus/ScreenQueue/Navigator | 화면 스택·입력 잠금은 작은 서비스로 추출. 게임 상태를 전역 Singleton에 결합하지 않음 |
| 네트워크 | UnityWebRequest·Newtonsoft API 클라이언트; gRPC 없음 | Grpc.Net.Client2.71, Protobuf3.30.2, Grpc.Tools2.72, YetAnotherHttpHandler, 생성 스텁 | transport adapter 후보. 원본 proto·재생성·ARM64 IL2CPP·네이티브 플러그인 검증 전 복사 금지 |
| 편집·빌드 도구 | Table 코드 생성·UI Toolkit 편집 창, GameCI test-runner v4 | Android APK 메뉴·ProtoCompiler·Excel→JSON/클래스 WinForms 도구 | 텍스트 원본과 재현 가능한 CLI/Editor 작업을 우선. 바이너리 도구만 이식하지 않음 |
| CI·설정 | client 경로·Library 캐시·라이선스 가정이 있는 GameCI | minSDK30·High stripping 등 프로젝트 전용 설정 | 패키지·권한·서명·네트워크 허용·stripping을 통째 상속하지 않음 |

주요 관찰 위치: MFM `client/Assets/Scripts/Runtime/RMC/MFM/{GameTable,Global,Network}` 및 Editor/GameTable, `.github/workflows/unity-ci.yml`; audition_idol `Assets/70_Contents/{00_Global,01_GameTable,02_CommonUI}`, `Assets/20_ArtData/Ui/Atlas`, `Assets/90_Extention/gRPC`, `Assets/51_Resources/Resources/Table`, `DataGenerator`.

## #182에서 먼저 막을 위험

- 프로젝트 루트는 `unity/` 제안이다. 현재 루트 `.gitignore`의 `/[Ll]ibrary/`는 `unity/Library`를 막지 못한다. 프로젝트 생성 전에 중첩 Unity 폴더의 캐시·빌드·개인 설정 제외 규칙을 검증한다. `.meta`는 보존한다.
- 의존 방향: Core는 UnityEngine·UI·Editor·네트워크 SDK를 참조하지 않는다. Application은 Core를 사용하고 Presentation/Infrastructure는 정해진 인터페이스를 구현한다. Editor와 테스트 Assembly는 Player에서 분리한다.
- MFM의 Editor asmdef에 테스트 관련 설정 잔재가 있어 그대로 복제하지 않는다. audition_idol의 반사 기반 등록은 IL2CPP stripping과 함께 검증해야 한다. 명시적으로 생성한 타입 등록을 우선 검토한다.
- Addressables는 참조 프로젝트에 완성된 기반이 없다. Resources/로컬 Addressables와 향후 콘텐츠 갱신 요구를 비교하고 최소 로딩·해제 시험으로 선택한다. 첫 버전 이후 영원히 도입 불가능하다는 주장은 채택하지 않는다.
- Unity 버전 상승만으로 외부 네이티브 플러그인의 Android 호환성이 보장되지 않는다. 실제 APK와 사용할 기기에서 검증한다. R3·UniTask·NuGet 등은 사용 사례가 확인된 의존성만 도입한다.

## 서버 경계

#184는 이번에는 등록만 한다. audition_idol 클라이언트 구조에서 gRPC 사용은 확인했지만 MongoDB 서버 설계·인증·운영은 확인하지 못했다. 이를 Digit-Duel 확정 스택으로 승격하지 않는다. 서버 담당자 합류 후 권위 모델, 공개 정보, 프로토콜 원본, 인증·재접속·저장 책임을 먼저 합의한다.

## 검토 결과의 처리

Mars 제안 중 계층 분리·TSV 명세·AOT 검증·Atlas·작은 공통 서비스는 후속 AC에 반영한다. Addressables를 v0.7 이후로 단정, 서버를 v0.6 범위 밖으로 제거, Roblox를 HTML보다 상위 규칙 원본으로 사용, 패키지를 일괄 필수화하는 제안은 채택하지 않는다. 이 문서는 분석이며 실제 이식·APK·서버 검증은 미수행이다.

[전체 분석](unity-port-analysis.md) · [시스템·데이터·UI](systems-data-ui.md) · [등록·검증 기록](registration.md)
