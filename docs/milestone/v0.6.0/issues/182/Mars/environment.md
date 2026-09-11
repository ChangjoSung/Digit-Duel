# #182 — Unity 6·Android 본구성 환경 (Mars_2)

2026-09-11 · Mars_2(Claude Code) · Task `task_6152d4dd2b92` / Dispatch `ctx_ffc9dbb61059` / Run `run_e7acdb9f7900`

**선행**: [최소 프로젝트 부트스트랩](bootstrap.md) · [#183 연결 실측](../../183/Mars/report.md) · [PD 인계서](../Mercury/implementation-handoff.md)
**대상**: `C:\Users\pc_77\orca\Digit-Duel\unity` · Editor `6000.6.0f1` · 브랜치 `infra/182-unity-environment`

> 이 문서는 Mars_2가 실제로 실행해 관측한 것만 담는다. Saturn 독립 QA와 CJ 플레이 QA는 아직이며,
> 이 보고는 이슈 종결 근거가 아니다. 확정과 미확정을 절마다 구분한다.

---

## 0. 한눈에 — 무엇이 증명됐고 무엇이 안 됐나

| 항목 | 상태 | 증거 |
|---|---|---|
| Android 모듈·SDK·NDK·JDK 설치 | **확정** | 공식 CLI result `success=true`, 11개 completedUid, 디스크 경로·버전 실측 (1절) |
| fresh Claude 세션의 실제 MCP 도구 호출 | **확정** | `mcp__unity-editor-mcp__*` 직접 호출 (2절) — #183 AC ④ |
| 계층 분리(Core 순수성 포함) | **확정** | EditMode 테스트가 컴파일된 assembly 참조를 검사 (4절) |
| 자산 비동기 로드·실패·해제 수명 | **확정** | PlayMode 12건, 동시·취소·타입 분리 포함 (6절) |
| SpriteAtlas 패킹 | **확정** | EditMode `PackAtlases` 후 `spriteCount=1` (6절) |
| 세로·safe area·입력·일시정지 복귀 | **에디터·실기 모두 확정** | PlayMode 9건(7절) + 실기 로그·화면(10절) |
| ARM64 IL2CPP 개발 APK | **확정** | 배치 CLI exit 0, APK 129,878,662 bytes, `aapt2 dump badging` 실측 (9절) |
| **실기 설치·실행·백그라운드 복귀** | **확정** | SM_S948N/Android 16 설치·실행·터치·복귀 로그와 화면 (10절) |
| 다중 Editor 동시 기동 시 프로젝트 지정 | **확정** | 일회용 2번째 Editor와 동시 기동, 양방향 확인 (15절) — #183 AC |
| 새 checkout에서 열기·컴파일·검사 | **확정** | Mercury의 clean git clone(공백 포함 경로)에서 오류 0 · EditMode 19/19 · PlayMode 21/21 (16절) |
| Claude MCP 임시 scene 변경·복구 | **확정** | create/mutate/restore 후 소스 지문 불변 (16.5절) — #183 AC |
| Unity 전용 CI | **미수행** | 이번 범위 밖. 기존 필수 CI 6개와 별개다 |

---

## 1. 확정 — Android 모듈 설치

설치는 공식 CLI만 썼다. Hub 설치 DB를 읽지도 쓰지도 않았다.

```
unity install-modules -e 6000.6.0f1 \
  -m android -m android-sdk-ndk-tools -m android-open-jdk-17.0.18+8 \
  --cm --accept-eula -y --retries 2 --no-banner --non-interactive
```

결과 JSON `{"type":"result","success":true,...}`, `completedUids` 11개:
`android`, `android-ndk-r27c`, `cmake-3.22.1`, `android-sdk-build-tools-36.0.0`,
`android-sdk-platform-tools-36.0.0`, `android-sdk-platforms-34`, `android-sdk-platforms-36`,
`android-sdk-platforms-37.0`, `android-sdk-command-line-tools-16.0`, `android-sdk-ndk-tools`,
`android-open-jdk-17.0.18+8`.

설치 후 디스크에서 직접 확인한 값 (설치 목록 값이 아니라 파일 실측):

| 구성 요소 | 실측 값 | 확인 방법 |
|---|---|---|
| PlaybackEngines | `AndroidPlayer`, `windowsstandalonesupport` | 폴더 목록 |
| NDK | `Pkg.Revision = 27.2.12479018`, `Pkg.ReleaseName = r27c` | `AndroidPlayer/NDK/source.properties` |
| OpenJDK | `JAVA_VERSION="17.0.18"`, Eclipse Adoptium `Temurin-17.0.18+8` | `AndroidPlayer/OpenJDK/release` |
| SDK platforms | `android-34`, `android-36`, `android-37.0` | `AndroidPlayer/SDK/platforms` |
| SDK build-tools | `36.0.0` | `AndroidPlayer/SDK/build-tools` |
| platform-tools | `adb 1.0.41 / 36.0.0-13206524` | `adb version` |
| cmdline-tools | `16.0` | 폴더 목록 |

**설치 목록과 실제 빌드 설정은 다른 값이다.** SDK 37이 설치돼 있다는 사실이 APK의 target SDK를 정하지
않는다. APK에 실제로 적용된 값은 8절에 따로 적는다.

Editor는 모듈 설치 전에 이미 떠 있었으므로 한 번 정상 종료 후 재기동했다 (`unity close` → `unity open`,
graceful, PID 20300 → 17456). 재기동 후 `list_build_targets` 의 Android `isInstalled` 가
`false` → **`true`** 로 바뀐 것을 실측했다. 다른 프로젝트 Editor는 열지 않았다.

### 관측 — Unity가 다른 SDK의 ADB 서버를 종료했다

재기동 직후 콘솔 로그:

```
Multiple ADB server instances found, the following ADB server instance have been terminated
due to being run from another SDK. ...
Process paths: C:\Program Files\Unity\Hub\Editor\6000.4.10f1\...\platform-tools\adb.exe
```

앞선 Task가 6000.4.10f1의 adb를 썼기 때문이다. **이것은 Unity의 자동 동작이며 이 Task가 프로세스를
죽인 것이 아니다.** 이후로는 6.6의 adb만 쓴다. 10절의 기기 미인식과 시간상 인접하지만 인과를
확정하지 않는다.

---

## 2. 확정 — fresh Claude 세션의 실제 MCP 도구 호출 (#183 AC ④)

#183 보고서가 미검증으로 남긴 항목이다. 이 Task 시작 시점에 쉘 `unity` CLI나 `mcp_smoke.js` 가 아니라
**Claude 에이전트의 MCP 도구를 직접** 호출했다. 서버 등록명 `unity-editor-mcp`, 도구 이름은
`mcp__unity-editor-mcp__<tool>` 형식이다.

| 도구 | 응답 |
|---|---|
| `editor_status` | `status=ready`, `compiling=false`, `domainReloadInProgress=false`, `playMode=stopped`, `projectPath=C:\Users\pc_77\orca\Digit-Duel\unity`, `unityVersion=6000.6.0f1` |
| `list_open_scenes` | `count=1` · `SampleScene` (`Assets/Scenes/SampleScene.unity`) · `isLoaded=true` `isActive=true` `isDirty=false` `rootCount=2` |
| `get_scene_hierarchy` | roots 2개 — `/Main Camera`(Transform, Camera, AudioListener, UniversalAdditionalCameraData), `/Global Light 2D`(Transform, Light2D) |

이후 같은 채널로 실제 **변경·실행** 도구도 썼다 (읽기만이 아니라는 증거):
`package_list`, `recompile`, `get_console_logs`, `list_build_targets`, `menu`(생성기 2종 실행),
`delete_asset`(템플릿 scene 폴더 제거), `eval`(AndroidSdkVersions 열거 조회),
**`run_tests`**(EditMode·PlayMode, 5절).

호출자는 전부 이 Claude 세션이다. **Codex(Saturn)는 READ_ONLY QA이며 scene을 변경하지 않았다** —
혼동하지 않도록 여기 명시한다.

---

## 3. 확정 — 프로젝트 구성 정리

### 3.1 패키지 정리

템플릿 기본 54개 중 실제로 쓰지 않는 9개를 `Packages/manifest.json` 에서 제거했다. 직접 의존
**55 → 46**.

| 제거 | 이유 |
|---|---|
| `com.unity.learn.iet-framework` | 템플릿 튜토리얼 프레임워크. 게임과 무관 |
| `com.unity.visualscripting` | 코드로 구현한다. 그래프 에디터를 쓰지 않는다 |
| `com.unity.collab-proxy` | 버전 관리는 git 이다 |
| `com.unity.2d.animation` | 뼈대 애니메이션 요구가 없다 |
| `com.unity.2d.aseprite` | `.aseprite` 원본을 쓰지 않는다 |
| `com.unity.2d.psdimporter` | `.psd` 원본을 쓰지 않는다 |
| `com.unity.2d.spriteshape` | 절차적 형태를 쓰지 않는다 |
| `com.unity.2d.tilemap.extras` | 기본 tilemap 으로 충분하다 |
| `com.unity.timeline` | 컷신 편집 요구가 없다 |

`Assets/Welcome`(iet-framework 전용 템플릿 자산, 자체 asmdef 포함)도 함께 지웠다 — 패키지를 빼면
컴파일이 깨진다. `Assets/Scenes/SampleScene.unity`(템플릿 예제 scene)도 제거했고 부팅 scene이 대신한다.

**유지한 것과 이유**: `render-pipelines.universal`(URP 2D), `inputsystem`(입력), `ugui`(Canvas·safe area),
`test-framework`(검사), `2d.sprite`·`2d.common`·`2d.tooling`·`2d.tilemap`(스프라이트·Atlas 편집),
`ide.visualstudio`·`ide.rider`(IDE 선택은 개발자별이라 둘 다 남김), `pipeline`(MCP 연결 — #183).

되돌리기: `Packages/manifest.json` 에 해당 줄을 다시 넣고 Editor 재열기.

### 3.2 어셈블리 경계

```
Assets/DigitDuel/
  Runtime/
    Core/            DigitDuel.Core            noEngineReferences=true, 참조 없음
    Application/     DigitDuel.Application     noEngineReferences=true, -> Core
    Infrastructure/  DigitDuel.Infrastructure  -> Core, Application
    Presentation/    DigitDuel.Presentation    -> Core, Application, Infrastructure, InputSystem, UI
  Editor/            DigitDuel.Editor          includePlatforms=[Editor]
  Tests/EditMode/    DigitDuel.Tests.EditMode  includePlatforms=[Editor], defineConstraints=[UNITY_INCLUDE_TESTS]
  Tests/PlayMode/    DigitDuel.Tests.PlayMode  defineConstraints=[UNITY_INCLUDE_TESTS]
  Scenes/Boot.unity  Resources/BootProbe/  Art/BootProbeAtlas.spriteatlasv2
```

- **Core는 순수 C#이다.** 다만 그 보장이 어디서 오는지 정확히 구분한다 — `noEngineReferences=true` 는
  **Unity 엔진 assembly 자동 참조만** 끈다. 임의의 서드파티·네트워크 SDK를 막아 주지는 않는다.
  그런 참조는 asmdef 의 `references`/`precompiledReferences` 로만 들어오는데 Core는 둘 다 비어 있다.
  하지만 설정은 나중에 누가 한 줄 추가하면 무너진다. 그래서 **실제 보장은 4절의 컴파일된 assembly
  참조 검사**이고, 설정은 그 검사를 통과하기 쉽게 만드는 기본값일 뿐이다.
- Application도 엔진에 묶지 않았다. 계층 규칙이 더 단순해지고, `DigitDuel.Application` 네임스페이스와
  `UnityEngine.Application` 이 부딪히는 일도 없앤다.
- **Player 배제**: Editor assembly는 `includePlatforms=[Editor]`, 테스트 assembly 2개는
  `defineConstraints=[UNITY_INCLUDE_TESTS]` + `autoReferenced=false` 라 Player 빌드에 들어가지 않는다.
  빌드 옵션에 `IncludeTestAssemblies` 를 넣지 않았다.
- 서버·DB 타입이 게임 정의를 소유하지 않게 `IPlayerProfileStore`·`IMatchState` 는 Core의 인터페이스로만
  뒀다. 구현은 없다.

### 3.3 Table 경계만 준비 (#185 범위 아님)

`ITableRow`·`ITable<TRow>`·`ITableCatalog`(Core) 와 `TableSourceLayout`(Infrastructure)의 폴더 상수뿐이다.
**TSV 스키마·생성기·행 타입·게임 규칙은 넣지 않았다.** 정적 테이블 / 경기 런타임 상태 / 영속 DB 를
세 갈래로 나눈 경계만 세웠고 전역 Singleton·불필요한 추상 계층은 만들지 않았다.
`ITableCatalog` 는 명시적 등록을 전제로 한다 — 리플렉션 자동 등록은 IL2CPP stripping과 부딪힌다.

---

## 4. 확정 — Core 순수성·의존 방향 검증

설정 파일을 읽는 것이 아니라 **로드된 assembly의 `GetReferencedAssemblies()`** 를 본다. 설정은 맞는데
코드가 새는 경우를 잡기 위해서다. (`Assets/DigitDuel/Tests/EditMode/AssemblyBoundaryTests.cs`)

| 검사 | 결과 |
|---|---|
| Core가 UnityEngine·UnityEditor·InputSystem·RenderPipelines·Grpc·Protobuf·Newtonsoft를 참조하지 않는다 | PASS |
| Application이 UnityEngine·UnityEditor를 참조하지 않는다 | PASS |
| Core가 Application·Presentation·Infrastructure·Editor를 참조하지 않는다 | PASS |
| Application이 Infrastructure·Presentation·Editor를 참조하지 않는다 | PASS |
| 런타임 4개 assembly가 DigitDuel.Editor·UnityEditor를 참조하지 않는다 | PASS |

---

## 5. 확정 — 검사 실행 결과 (실제 MCP `run_tests`)

`mcp__unity-editor-mcp__run_tests` 로 실행했다. PlayMode는 동기 호출이 도메인 리로드로 끊겨
`async_tests=true` 로 돌리고 결과를 받았다.

| 모드 | 총 | 통과 | 실패 | 시간 |
|---|---|---|---|---|
| EditMode | 19 | **19** | 0 | 0.64s |
| PlayMode | 21 | **21** | 0 | 0.57s |

검사는 세 차례 돌았고 이력을 그대로 남긴다 — 중간 실패를 지우지 않는다.

| 차수 | 시점 | EditMode | PlayMode |
|---|---|---|---|
| 1차 | 최초 구현 직후 | 17/17 | 13건 중 **11 통과 / 2 실패** (터치 입력, probe Image 탐색) |
| 2차 | 초기 결함 4건 수정 후 | 17/17 | 19/19 |
| 3차 | Saturn 델타 + target SDK 고정 후 (**최종**) | **19/19** | **21/21** |

2차의 19/19는 그 이후 변경까지 검증한 것이 아니다. 최종 판정은 3차다.

컴파일 오류 0 (`recompile` → `failed=false, errors=[]`), 콘솔 error 0.

재현:
```
unity command run_tests --mode editmode --filter DigitDuel.Tests.EditMode
unity command run_tests --mode playmode --filter DigitDuel.Tests.PlayMode --async_tests true
unity command test_status          # 비동기 실행 중 상태 조회
```

---

## 6. 확정 — 자산 로더: 선택·수명·실제로 잡은 결함

### 6.1 Resources를 고른 이유와 교체 경계

- 지금 요구는 앱에 동봉된 로컬 자산의 비동기 로드·해제뿐이다. 원격 콘텐츠 갱신·패치 요구가 없다.
- 참조 프로젝트(MyFundManager·audition_idol) **어느 쪽 manifest에도 Addressables 패키지가 없다.**
  이식해서 얻을 검증된 기반이 없다.
- Addressables는 그룹·빌드 산출물·CI 단계를 추가로 요구한다. 갱신 요구가 생기기 전에는 비용만 남는다.

**교체 경계**: 호출부는 `IAssetLoader`/`IAssetHandle<T>` 만 본다. Addressables로 옮길 때
`ResourcesAssetLoader` 와 등록 지점만 바뀐다. **이 판단은 영구적이지 않다.**

### 6.2 구현 중 고친 결함 6건

**관측한 실패와 예방적 변경을 구분한다.** "재현함"은 고치기 전 코드로 실제 실패를 본 것이고,
"예방"은 정적 추론으로 고쳤을 뿐 실패를 재현하지 않은 것이다. 출처도 함께 남긴다.

| # | 결함 | 확인 방식 | 출처 |
|---|---|---|---|
| 1 | **`Resources.LoadAsync(key)` 무타입 호출** — main asset(Texture2D)만 돌려주므로 Sprite 같은 서브 자산은 **항상 실패**한다. `Resources.LoadAsync(key, typeof(T))` 로 고쳤다 | **재현함** — 고치기 전 Sprite 로드가 실패했다 | 자체 발견 |
| 2 | **동시 캐시 miss 시 항목 중복 생성** — 같은 키를 동시에 요청하면 둘 다 `_entries[key]` 를 `RefCount=1` 로 덮어써서, 첫 Dispose가 살아 있는 다른 핸들의 캐시를 버리고 두 번째 Release는 항목을 못 찾아 `LiveHandleCount` 가 1로 샜다. in-flight Task 공유로 고쳤다 | **재현함** — 회귀 테스트가 고치기 전 코드에서 실패한다 | PD 리뷰 |
| 3 | **취소 경로의 미소유 자산** — 요청 완료 전에 취소하면 Unity 요청은 계속 진행되는데 정리 계약이 없었다. 이제 취소된 호출자는 핸들을 받지 않고 그 로드는 캐시에 남지 않는다 | **재현함** — 취소 회귀 테스트로 확인 | PD 리뷰 |
| 4 | **개별 `Resources.UnloadAsset` 이 공유 자산을 파괴** — Sprite는 텍스처의 서브 자산이고 Atlas에 묶이면 텍스처를 여러 스프라이트가 공유한다. 호출을 제거하고 회수를 `UnloadUnusedAsync` 로 분리했다 | **예방적 변경 — 재현하지 않았다.** 시험 Atlas에 스프라이트가 하나뿐이라 형제 스프라이트 파괴를 실증할 수 없다. 형제가 여럿인 Atlas를 만들어야 증명되며 이번 범위에서 하지 않았다 | PD 리뷰 |
| 5 | **캐시·in-flight 키가 타입을 무시했다** — 백엔드 호출은 `Resources.LoadAsync(path, type)` 로 타입별인데 키는 경로뿐이었다. 그래서 ① 같은 경로로 `AudioClip`(무효)과 `Sprite`(유효)를 동시에 요청하면 멀쩡한 요청이 실패한 요청에 올라타 **같이 실패**하고, ② 같은 PNG의 `Sprite` 캐시와 `Texture2D` 요청이 서로를 밀어냈다. 키를 **(경로, 요청 타입) 쌍**으로 바꿨다 | **재현함** — 두 회귀 테스트 모두 고치기 전 코드에서 실패한다 | Saturn 정적 검수 |
| 6 | **취소와 검증의 선후가 불명확** — 취소 검사가 자산 없음·타입 불일치 검증 뒤에 있어 취소된 요청이 `AssetLoadException` 으로 끝날 수 있었다. 취소 검사를 `await` 직후로 올려 **취소가 검증보다 앞선다**는 계약을 명시했다 | **재현함** — 취소 검사가 `OperationCanceledException` 을 요구하도록 강화했다 | Saturn 정적 검수 |

### 6.3 검증한 수명 (PlayMode 12건, 전부 실제 Resources 자산)

로드·해제 / 같은 키 2회 로드의 참조 계수 / 이중 Dispose 멱등 / 없는 키 실패 / 타입 불일치 실패 /
**동시 2로드의 항목 공유와 첫 해제 뒤 둘째 유효** / **진행 중 취소** / 동시 2로드 중 하나만 취소 /
이미 취소된 토큰 / `UnloadUnusedAsync` 완료 /
**같은 경로의 무효·유효 타입 동시 요청이 서로를 오염시키지 않음** /
**같은 경로의 Sprite·Texture2D 가 별도 항목으로 공존하고 한쪽 해제가 다른 쪽을 죽이지 않음**.

취소 검사는 "실패했다"로 통과시키지 않는다. `IsCanceled` 이거나 내부 예외가
`OperationCanceledException` 이어야 하고, 살아남아야 하는 요청은 `IsCompletedSuccessfully` 를 요구한다.

**알려진 한계(명시)**: `CachedKeyCount`·`LiveHandleCount` 로 참조 계수·캐시 해제는 결정적으로
증명했지만, **실제 메모리 회수까지는 입증하지 않았다.** `UnloadUnusedAssets` 는 관리 힙에서 도달
가능한 참조가 있으면 해제하지 않으므로 테스트가 잡고 있는 참조로는 측정이 성립하지 않는다.
이 항목을 PASS로 쓰지 않는다.

### 6.4 SpriteAtlas

시험 자산은 외부 아트를 복사하지 않고 `BootProbeAssetGenerator` 가 코드로 만든다(64x64 체커 PNG,
Point 필터, 무압축 — 압축 원본은 Atlas 패킹 시 픽셀 손실 경고를 낸다). Atlas는
`SpriteAtlasAsset`(V2) + `IncludeInBuild`. EditMode에서 `SpriteAtlasUtility.PackAtlases` 실행 후
`spriteCount=1` 과 `BootProbeSprite` 포함을 확인했다.

---

## 7. 확정(에디터) — 최소 부팅 scene

`Assets/DigitDuel/Scenes/Boot.unity` 는 손으로 만든 YAML이 아니라 `BootSceneBuilder.Generate()`
(메뉴 `DigitDuel/Generate Boot Scene`)가 결정적으로 생성한다. 구성: Main Camera(직교) ·
Canvas(ScreenSpaceOverlay, 1080x1920 세로 기준, match=height) · SafeArea 패널(`SafeAreaFitter`) ·
중앙 AssetProbeImage(로드 성공 시에만 켜짐) · BootRoot(`BootRoot` + `BootAssetProbe`).

PlayMode 9건 통과: 세로·safe area 적용 / 앵커가 `Screen.safeArea` 와 정확히 일치 / 자산 로드 후
Image 표시 + 핸들 1개 / **로드 중 파괴 시 핸들 0** / **씬 전환 시 핸들 반환** / 일시정지·복귀 시
safe area 재적용 / 포커스 전환 / 터치 입력 / 마우스 입력.

`Destroying_probe_while_loading_leaves_no_live_handle` 은 파괴 전에 **`InFlightCount > 0` 을 실제로
확인한 뒤에만** 파괴하고, `HasSettled` 로 유계 대기한 뒤 취소 정산·핸들 0·in-flight 0을 본다.
이 체크포인트가 없으면 이미 끝난 로드를 파괴해 놓고 통과했다고 착각할 수 있다(Saturn 지적).
`BootAssetProbe` 에 추가한 것은 `InFlightCount`·`HasSettled` 두 개의 읽기 전용 seam뿐이고
새 추상 계층은 만들지 않았다.

### 구현 중 잡은 결함 7 — 입력 폴링이 터치를 통째로 놓쳤다

처음엔 `Update()` 에서 `Pointer.current.press.wasPressedThisFrame` 을 폴링했다. 마우스는 잡히는데
**터치는 한 번도 안 잡혔다.** 로그로 확인한 사실: 터치 이벤트가 처리된 갱신 단계와 MonoBehaviour
`Update` 의 순서가 어긋나, `wasPressedThisFrame` 이 true인 창을 `Update` 가 통째로 건너뛰었다
(frame 0에서 이미 true였고 frame 1부터 false).

프레임 플래그 폴링을 버리고 `InputAction("<Pointer>/press")` 의 `performed` 콜백으로 바꿨다.
이벤트가 처리될 때 불리므로 프레임 순서에 의존하지 않는다. 터치·마우스 둘 다 통과한다.
**이것은 테스트를 맞춘 것이 아니라 기기에서도 눌림을 놓칠 수 있던 실제 결함을 고친 것이다.**

**범위**: 위 전부 에디터 PlayMode 결과다(가상 화면 960x2658). 에디터 결과는 실기 동작을 대체하지
않으므로 **실기 세로·노치 safe area·실제 터치·홈 복귀는 10절에서 따로 실측했다.** 또한 이 검증은
게임 UI나 UI Toolkit 채택 PoC 완료가 아니다 — #187은 그대로 남는다.

---

## 8. 확정 — Android Player 설정 (APK 실측값은 9절)

설정은 GUI 수작업이 아니라 `AndroidPlayerConfigurator.Configure()` 가 원본이고, 빌드 명령이 매번
먼저 호출한다. EditMode 7건이 호출 후 실제 값을 되읽어 검사한다(SDK 고정 여부와 해당 플랫폼의 실제
설치 여부 포함 — 9.1절의 실패를 빌드 전에 잡기 위한 검사다).

| 설정 | 값 | 근거 |
|---|---|---|
| scripting backend | IL2CPP | #182 AC |
| target architectures | ARM64 단독 | #182 AC |
| orientation | Portrait 고정, 자동 회전 3방향 off | 세로 게임 |
| **target SDK** | **API 36 (Android 16)** 명시 고정 | `Auto` 는 설치된 SDK 목록에 따라 흔들려 빌드가 재현되지 않는다. 37로 먼저 시도했다가 **실제 빌드가 실패**해서 36으로 내렸다 — 근거는 9.1절 |
| min SDK | API 26 | 개발 단계 하한. 낮출 근거가 생기면 실기 호환성과 함께 바꾼다 |
| managed stripping | Minimal | 개발 APK. 배포 stripping 수준은 별도 실측 후 판정 |
| company / product | `Creat2ve` / `Digit Duel` | **PD가 정한 개발용 기술 설정** |
| application id | `com.creat2ve.digitduel.dev` | 동일. **CJ의 출시 식별자 확정이 아니다** |
| 서명 | `useCustomKeystore=false` (Unity 디버그 서명) | 개인 keystore·비밀번호를 저장소가 추적하지 않는다 |
| internet / SD 권한 | 강제하지 않음 | 필요해질 때 근거와 함께 켠다 |

---

## 9. APK 빌드

`tools/unity/build-android-apk.ps1` 이 재현 명령이다.

```
Unity.exe -quit -batchmode -nographics -buildTarget Android \
  -projectPath <repo>\unity \
  -executeMethod DigitDuel.Editor.Build.AndroidBuildCommand.BuildDevelopmentApk \
  -logFile <repo>\unity\Logs\android-build.log
```

배치에서는 **명령줄 `-buildTarget Android` 가 필수다.** `executeMethod` 안의
`SwitchActiveBuildTarget` 은 도메인 리로드를 동반해 시작 시점의 타깃 지정을 대신할 수 없다
(코드의 전환은 메뉴 수동 실행용 대비책으로만 남겼다). 같은 프로젝트를 연 Editor가 떠 있으면 프로젝트
잠금으로 실패하므로 `unity close` 를 먼저 한다.

산출물 `unity/Builds/Android/DigitDuel-dev.apk` 는 `unity/.gitignore` 의 `/[Bb]uilds/` 로 추적하지 않는다.

### 9.1 확정 — 1차 빌드는 실패했다 (target SDK 37 비호환)

먼저 target SDK를 **API 37(Android 17)** 로 고정해 빌드했고 **실패했다.** IL2CPP ARM64 컴파일(2,529 노드)과
il2cppOutput 생성은 모두 통과했고 Gradle `assembleDebug` 에서 죽었다.

```
build result=Failed  errors=3  duration=00:06:01
FAILURE: Build failed with an exception.
* What went wrong:
Could not determine the dependencies of task ':launcher:compileDebugJavaWithJavac'.
> Failed to find target with hash string 'android-37' in: ...\AndroidPlayer\SDK
```

원인은 이름 불일치다. Unity의 `AndroidApiLevel37` 은 플랫폼을 해시 `android-37` 로 찾는데, **Unity 자체
설치기가 넣은 폴더는 `android-37.0`** 이고 그 `source.properties` 도 `AndroidVersion.ApiLevel=37.0` 이다
(Android 16부터 도입된 minor SDK 표기). 즉 열거값이 있고 플랫폼이 설치돼 있어도 둘이 맞지 않는다.

**판정**: target을 **API 36(Android 16)** 으로 고정했다. PD 지시의 "36은 구체적 호환성 근거가 있을 때만"
조건을 위 실측이 충족한다. 검증 기기도 Android 16(API 36)이라 일관된다. 공유 Unity 설치의 SDK 폴더
이름을 바꾸는 것은 이 Task 범위 밖이라 하지 않았다. Unity가 `37.0` 표기를 지원하면 다시 올린다.

**증거 보존 실패(기록)**: 빌드 래퍼가 로그를 고정 이름(`Logs/android-build.log`)에 써서 **2차 빌드가
1차 실패 로그를 덮어썼다.** 위 인용문은 덮어쓰기 전에 읽어 둔 것이고 원본 로그 파일은 남아 있지 않다.
래퍼를 고쳐 기본 로그 이름에 타임스탬프를 붙이고, 같은 이름이 이미 있으면 빌드를 거부하게 했다 —
다시는 이런 식으로 증거를 잃지 않는다.

회귀 방지로 EditMode에 두 검사를 넣었다 — target이 `Auto` 가 아니라 명시 고정인지, 그리고 **고정한 target의
플랫폼 폴더가 실제로 설치돼 있는지.** 이 검사가 있었다면 6분짜리 빌드 전에 잡혔다.

### 9.2 확정 — 최종 빌드 성공

```
Unity exit code: 0
APK OK: unity\Builds\Android\DigitDuel-dev.apk (129,878,662 bytes)
```

APK 자체를 `aapt2 dump badging` 으로 읽은 값이다(설정 파일이 아니라 산출물 실측):

| 항목 | APK 실측값 |
|---|---|
| package | `com.creat2ve.digitduel.dev` (versionCode 1, versionName 1.0) |
| **native-code** | **`arm64-v8a`** — 이것 하나뿐이다 (ARM64 단독 확인) |
| `minSdkVersion` | `26` |
| `targetSdkVersion` | `36` |
| compileSdkVersion | `36` (codename 16) |
| application-label | `Digit Duel` |
| launchable-activity | `com.unity3d.player.UnityPlayerGameActivity` |
| uses-permission | `android.permission.INTERNET`, `...DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` |

**INTERNET 권한 관측**: `forceInternetPermission=false` 로 뒀는데도 들어 있다. 개발 빌드는 프로파일러·
디버거 연결을 위해 Unity가 자동으로 넣는다. **배포 빌드에서 다시 확인해야 할 항목이며 지금 해결됐다고
적지 않는다.**

---

## 10. 확정 — 실기 설치·실행·백그라운드 복귀

차단은 해소됐다(CJ가 재연결·USB 디버깅 허용). `kill-server` 없이 조회했다.

기기: **Samsung SM_S948N / Android 16 (API 36) / arm64-v8a**, `state=device`.
일련번호는 이 문서와 아티팩트에 싣지 않았고 설치 대상 지정에만 로컬로 썼다.

```
adb install -r -d unity/Builds/Android/DigitDuel-dev.apk   ->  Success
adb shell am start -n com.creat2ve.digitduel.dev/com.unity3d.player.UnityPlayerGameActivity
```

앱 PID **27787** 로 기동했다. 아래는 앱 PID로만 필터링한 앱 자신의 로그다
([전문 발췌](artifacts/device-run-logcat.txt)).

```
ApplicationInfo 'com.creat2ve.digitduel.dev', Version '1.0', Min API Level '26', Target API Level '36'
[DigitDuel.Boot] awake screen=1440x3120 orientation=Portrait portrait=True
                 safeArea=(x:0, y:0, width:1440, height:2981) applied=True anchors=(0,0,1.00,0.96)
[DigitDuel.Boot] start  ... resume=1 focusGained=1
[DigitDuel.Boot] asset loaded key=BootProbe/BootProbeSprite sprite=BootProbeSprite
                 texture=sactx-0-64x64-ETC2-BootProbeAtlas-cead4da9 liveHandles=1
[DigitDuel.Boot] pointer press #1 at (720.00, 1620.00) device=Touchscreen2
[DigitDuel.Boot] pointer press #2 at (400.00, 2220.00) device=Touchscreen2
[DigitDuel.Boot] focus=False focusGained=1 focusLost=1
[DigitDuel.Boot] pause=True  ... pause=1 resume=1 pointerPress=2
[DigitDuel.Boot] pause=False ... pause=1 resume=2 pointerPress=2
[DigitDuel.Boot] focus=True  focusGained=2 focusLost=1
```

항목별로 무엇이 증명됐는지:

| 확인 | 실기 증거 |
|---|---|
| ARM64 IL2CPP 실행 | `IL2CPP : JNI_OnLoad`, `lib/arm64/libgame.so`·`libmain.so` 로드, `nativeLibraryDirectories=.../lib/arm64` |
| 세로 | `screen=1440x3120 orientation=Portrait portrait=True`. 화면 캡처도 세로다 |
| **safe area(실제 노치)** | 화면 높이 3120인데 `safeArea.height=2981` — 139px 컷아웃이 실제로 빠졌다. 앵커 높이 `0.96`. 시스템 로그의 `mDisplayCutout=...insets=Rect(0, 139 - 0, 0)` 과 일치한다 |
| **자산 로드 + Atlas 바인딩** | `texture=sactx-0-64x64-ETC2-BootProbeAtlas-cead4da9` — 원본 텍스처가 아니라 **아틀라스 텍스처**에 묶여 있다. 에디터가 아닌 기기에서 ETC2로 패킹된 실물이다 |
| **터치 입력** | 탭 2회가 `device=Touchscreen2` 로 잡혔다. 좌표도 맞는다 — adb `tap 720 1500` → Unity `(720, 1620)`, `3120-1500=1620` (Y축 방향 반전). `tap 400 900` → `(400, 2220)` |
| **백그라운드 복귀** | HOME 후 복귀에서 `focusLost=1 → pause=1 → resume=2 → focusGained=2`. 복귀 후에도 **PID가 27787로 동일**하다 — 프로세스가 죽고 다시 뜬 것이 아니라 진짜 복귀다. safe area도 `applied=True` 로 재적용됐다 |
| 개발 빌드 | 화면 우하단 `Development Build` 워터마크 |

화면 캡처: [artifacts/device-boot-portrait.png](artifacts/device-boot-portrait.png) — 세로 화면, 컷아웃
아래로 물러난 safe area 패널, 가운데에 아틀라스에서 그려진 시험 스프라이트가 보인다.

기기 차단 시점의 escalation은 `msg_96a547ee23c5` 이고 복구 후 재검증한 결과가 위다.

**여기서 주장하지 않는 것**: 소형 화면 세로만 확인했다. **큰 화면(태블릿·폴더블)의 방향 고정 지원은
확인하지 않았다.** 회전·멀티윈도우·장시간 구동·메모리 압박 하의 복귀도 확인 대상이 아니었다.
이 검증은 게임 UI나 UI Toolkit 채택 PoC 완료가 아니다 — #187은 그대로 남는다.

---

## 11. 저장소 경계

`unity/.gitignore`(부트스트랩에서 추가)가 `Library/` `Temp/` `Logs/` `Builds/` `UserSettings/` 를
덮는다 — 저장소 루트의 `/[Ll]ibrary/` 는 루트 앵커라 `unity/` 하위를 덮지 못한다(부트스트랩 실측).
`.meta` 는 추적한다. 개인 MCP 경로·계정 값·서명키·기기 일련번호는 저장소에 넣지 않았다.

이번에 추가된 추적 후보: `unity/Assets/DigitDuel/**`(소스·asmdef·scene·생성 자산·meta),
`unity/Packages/manifest.json`(수정), `unity/ProjectSettings/**`(수정),
`tools/unity/build-android-apk.ps1`, 이 문서와 `Mars/artifacts/`(기기 화면 캡처·로그 발췌).
**Git 쓰기는 하지 않았다** — `add`/`commit` 없이 두며 통합은 Mercury 소관이다.

아티팩트에는 일련번호·계정·키가 없다. 로그 발췌는 앱 PID로 필터링한 앱 자신의 로그이고
기기는 모델·OS까지만 적었다. APK(130MB)는 `Builds/` 아래라 추적되지 않는다.

`tools/unity/mcp_smoke.js` 와 `docs/milestone/v0.6.0/issues/183/Mars/report.md` 는 **이 Task가 수정하지
않았다.** 소유권을 Mercury에 반환했고 Saturn REVISE 반영은 별도 Worker 몫이다.
사용자 `art/`, `orca-hook-latency-report.md`, Downloads·다른 worktree는 열지도 바꾸지도 않았다.

---

## 12. 롤백

**기준선(baseline)을 먼저 분명히 한다.** 현재 브랜치의 부모 커밋 `9b87921` 에는 **`unity/` 추적 파일이
0개**다(`git ls-tree -r HEAD -- unity` 가 비어 있다). 즉 `unity/` 전체가 #182에서 새로 생기는 것이고,
"ProjectSettings 를 이전 커밋으로 되돌린다" 같은 부분 되돌리기는 **되돌릴 대상 자체가 없어서 성립하지
않는다.**

따라서 롤백은 **#182 납품 전체를 한 번에 되돌리는 것**이 기본이다. 부분 삭제는 남은 참조(asmdef 참조,
`EditorBuildSettings` 의 scene 목록, `manifest.json` 의 패키지)가 서로를 가리키는 깨진 상태를 만든다.

| 대상 | 되돌리는 법 |
|---|---|
| **#182 납품 전체(기본)** | 통합 PR 되돌리기 또는 병합 전 브랜치 폐기. 작업 트리에서는 `unity/`, `tools/unity/build-android-apk.ps1`, `docs/.../issues/182/Mars/` 를 통째로 제거하면 기준선과 같아진다. Git 조작은 Mercury 소관이다 |
| 패키지 정리만 되돌리기 | `Packages/manifest.json` 에 9개 줄 복원 후 Editor 재열기. 단 `Assets/Welcome`·`Assets/Scenes` 는 템플릿에서 다시 받아야 하고, 그 상태는 기준선이 아니라 "부트스트랩 직후"다 |
| Android Player 설정만 되돌리기 | 기준선에 되돌릴 대상이 없다. 값을 바꾸려면 `AndroidPlayerConfigurator` 의 상수를 고쳐 다시 실행한다 |
| APK·빌드 캐시 | `unity/Builds/` 삭제 (추적 대상 아님) |
| 기기에 설치된 앱 | `adb uninstall com.creat2ve.digitduel.dev` |
| Android 모듈 설치 | **되돌리지 않는다** — Hub Editor를 다른 프로젝트와 공유한다 |

## 12.1 패키지·의존성·라이선스

**출처**: 아래 라이선스는 설치된 각 패키지의 `LICENSE.md` **첫 줄을 직접 읽은 값**이다(추정이 아니다).
경로는 `unity/Library/PackageCache/<패키지>@<해시>/LICENSE.md` 이며 캐시는 추적하지 않는다.
법적 해석은 하지 않고 파일에 적힌 것만 옮긴다. **wrapper 패키지의 라이선스와 그 안에 담긴 upstream
소프트웨어의 라이선스는 다를 수 있으므로 구분해서 적는다.**

`Packages/manifest.json` 의 **직접 의존은 46개**이고, 그중 **36개가 `com.unity.modules.*` 내장 모듈**,
나머지 **10개가 아래 표**다. (이전 판에서 직접 개수와 표 행수가 어긋났던 것을 바로잡았다.)

### 직접 의존 — 모듈이 아닌 10개

| 패키지 | 버전 | LICENSE.md 가 말하는 것 |
|---|---|---|
| `com.unity.render-pipelines.universal` | 17.6.0 | Unity Companion License |
| `com.unity.inputsystem` | 1.20.0 | Unity Companion License |
| `com.unity.ugui` | 2.6.0 | Unity Companion License |
| `com.unity.test-framework` | 1.8.0 | Unity Companion License |
| `com.unity.2d.sprite` | 1.0.0 | **Unity Package Distribution License** |
| `com.unity.2d.tilemap` | 1.0.0 | **Unity Package Distribution License** |
| `com.unity.2d.tooling` | 4.0.0 | **Unity Terms of Service** (https://unity.com/legal) — 위 둘과 또 다르다 |
| `com.unity.ide.visualstudio` | 2.0.26 | **MIT License** (Unity Technologies + Microsoft Corporation 저작권 표기) |
| `com.unity.ide.rider` | 3.0.38 | **MIT License** |
| `com.unity.pipeline` | **0.6.0-exp.1** | **Unity Package Distribution License** |

### 직접 의존 — `com.unity.modules.*` 36개

**라이선스 미확인.** 이 내장 모듈들은 `PackageCache` 에 폴더는 있지만(38개 디렉터리) **`LICENSE.md` 파일이
하나도 없다(0개)**. 로컬에 근거가 없으므로 라이선스를 임의로 단정하지 않는다. Unity 에디터 배포 약관에
따르는 것으로 보이나 **이 문서에서는 "로컬 원본 없음 — 미확인"** 으로 남긴다.

### 주요 간접 의존 (실제 읽은 것만)

| 패키지 | 버전 | LICENSE.md 가 말하는 것 |
|---|---|---|
| `com.unity.nuget.newtonsoft-json` | 3.2.2 | **wrapper 는 Unity Companion License.** upstream Newtonsoft.Json 자체의 MIT 고지는 별개이며 이 파일에서 확인한 값이 아니다 |
| `com.unity.nuget.mono-cecil` | 1.11.6 | **wrapper 는 Unity Companion License** (upstream Cecil 의 고지는 별개) |
| `com.unity.ext.nunit` | 2.1.0 | **Unity Package Distribution License** (upstream NUnit 의 MIT 고지는 별개) |
| `com.unity.collections` | 6.6.0 | Unity Companion License |
| `com.unity.mathematics` | 1.4.0 | Unity Companion License |
| `com.unity.2d.common` | 15.0.0 | Unity Companion License |
| `com.unity.burst` | 2.0.0 | **미확인 — 패키지에 `LICENSE.md`·third-party 고지 파일이 없다** |

나머지 간접 의존(`shadergraph`, `render-pipelines.core`, `render-pipelines.universal-config`,
`searcher` 4.9.5, `settings-manager` 2.1.1, `profiling.core` 1.0.3, `editorcoroutines` 6.6.0,
`graph-authoring` 1.0.0, `test-framework.performance` 6.6.0, `subsystems`, `hierarchycore`)는 버전이
`Packages/packages-lock.json` 에 잠겨 있다. 개별 LICENSE 는 이번에 읽지 않았으므로 **미확인**으로 둔다.

### 요약

- **Unity 배포 패키지 외 별도 유료·외부 SDK 추가는 0개다.** 배포 패키지 안의 upstream 제3자 코드를 없다고 주장하지 않는다. 새 레지스트리·NuGet·npm 원본을 추가하지 않았고, 참조 프로젝트에서
  바이너리 플러그인을 복사하지도 않았다. 전부 Unity가 배포하는 패키지다.
- 다만 **라이선스가 한 종류가 아니다** — Companion / Package Distribution / Terms of Service / MIT 가 섞여
  있다. 출시 전 고지 의무는 별도 확인이 필요하다(이 Task의 판단 범위 밖).
- `com.unity.pipeline` 은 **실험(exp) 버전**이다. MCP 연결(#183)에 필요해 들어와 있고 게임 런타임 코드가
  의존하지는 않지만, 출시 빌드 포함 여부는 별도 판정이 필요하다.
- Unity 에디터 라이선스는 Unity Personal이다(부트스트랩 확인).

## 13. 프로세스·의존성

- 이 Task가 띄운 것: 모듈 설치 CLI(완료 후 종료), Editor(인계받은 PID 20300 → graceful close →
  `unity open` PID 17456 → close → PID 23308 → close), 배치 빌드용 Unity 프로세스 2회(둘 다 빌드 전
  Editor 정상 종료 후 실행), adb 서버(6.6 platform-tools).
- Editor 재기동이 세 번인 이유: ① Android 모듈 인식 ② 배치 빌드의 프로젝트 잠금 해제 ③ 수정 소스
  컴파일·테스트. 매 시점에 Editor writer 는 하나뿐이었다.
- **종료시킨 것**: 이 Task가 관리하는 Digit-Duel Editor뿐이다. 다른 프로젝트 Editor·사용자 프로세스·
  installer 는 종료하지 않았다. 앞선 6000.4.10f1 adb 서버 종료는 Unity의 자동 동작이다(1절).
  기기 미인식 구간에서 adb `kill-server`/`start-server` 를 한 번 했고, 복구 뒤에는 재시작 없이
  조회만 했다.
- 기기에 설치한 앱(`com.creat2ve.digitduel.dev`)은 **남겨 뒀다.** 지우려면
  `adb uninstall com.creat2ve.digitduel.dev` 다. 기기의 다른 앱·설정은 건드리지 않았다.
- Hub 설치 DB는 읽지도 쓰지도 않았다. 앞선 Task의 수동 `ALTER TABLE` 은 그대로 남아 있으며
  이 문서가 그것을 정상화하지 않는다.
- 의존성: Unity CLI `1.0.0-beta.9`, Unity Hub 3.21.2, `com.unity.pipeline 0.6.0-exp.1`, git `core.autocrlf=true`.

---

## 14. 남은 일 · 이 Task가 하지 않은 것

이 보고서는 완료 선언이 아니다. 다음은 명시적으로 범위 밖이거나 아직 미확인이다.

| 항목 | 상태 |
|---|---|
| Saturn 독립 QA · CJ 플레이 QA | 구현자 자기 보고와 별개로 [Saturn 소스 검수](../Mercury/saturn-source-review.md) PASS. **CJ 수락 대기** |
| Windows 경로 길이 한계 | **미해결 — 제약으로 기록.** 체크아웃 루트가 길면(실측 95자) 패키지 캐시 추출이 MAX_PATH 로 깨진다. 개발자·CI 안내에 반영이 필요하다(16.4절) |
| 1차 API37 실패 로그 원본 파일 | **덮어써서 유실.** 오류 전문은 9.1절에 인용돼 있고 래퍼는 재발하지 않도록 고쳤다 |
| 결함 4(공유 Atlas 형제 파괴) 재현 | **미재현.** 형제가 여럿인 Atlas가 필요하다(6.2절) |
| Git 커밋·PR·Issue 코멘트·Notion | **하지 않았다.** Mercury 소관 |
| Unity 전용 CI | 미착수. 기존 필수 CI 6개와 별개이며 Unity 빌드 성공으로 대신하지 않는다 |
| target SDK 37(Android 17) | Unity의 `android-37` ↔ 설치 폴더 `android-37.0` 불일치로 보류(9.1절). Unity가 지원하면 올린다 |
| 개발 빌드의 INTERNET 권한 | 개발 빌드가 자동으로 넣는다. **배포 빌드에서 재확인 필요**(9.2절) |
| 실제 메모리 회수(언로드) 측정 | 참조 계수·캐시 해제는 증명, 실제 회수는 미증명(6.3절) |
| 큰 화면·회전·멀티윈도우 | 미확인. 소형 화면 세로만 봤다(10절) |
| 배포 stripping 수준·서명·스토어 식별자 | 미정. 개발 설정만 고정했다 |
| TSV 스키마·테이블 생성기·게임 규칙·UI | #185·#186·#187 범위. 경계만 뒀다(3.3절) |
| `tools/unity/mcp_smoke.js`, #183 `Mars/report.md` | **이 Task가 건드리지 않았다.** 소유권을 Mercury에 반환했고 별도 Worker 몫이다 |

---

## 15. 확정 — 다중 Editor 동시 기동 시 프로젝트 지정 (#183 AC)

"다른 프로젝트 Editor가 함께 열려도 Digit-Duel만 선택된다"를 실측했다. 사용자의 기존 프로젝트는
열지 않았다 — 이 Task가 만든 **일회용 프로젝트**를 scratchpad에 만들어 썼다.

```
unity projects create SecondaryProbe --path <scratchpad>/multieditor \
  --editor-version 6000.6.0f1 --template com.unity.template.2d --no-cloud --non-interactive
unity pipeline install --project-path <...>/SecondaryProbe
unity open <...>/SecondaryProbe
```

두 Editor가 동시에 떠 있는 상태(`unity status` → `count=2`):

| Editor | port | PID | 프로젝트 |
|---|---|---|---|
| Digit-Duel | 7800 | 31516 | `C:\Users\pc_77\orca\Digit-Duel\unity` |
| 일회용 SecondaryProbe | 7801 | 22468 | `<scratchpad>/multieditor/SecondaryProbe` |

이 상태에서 확인한 것:

| 호출 | 결과 |
|---|---|
| **Claude MCP** `mcp__unity-editor-mcp__editor_status` | `projectPath = ...\Digit-Duel\unity` — 두 번째 Editor가 떠 있어도 고정된 프로젝트를 고른다 |
| **Claude MCP** `find_assets --name BootProbeAtlas` | `count=1`, `Assets/DigitDuel/Art/BootProbeAtlas.spriteatlasv2` — Digit-Duel에만 있는 자산을 실제로 본다 |
| 직접 CLI, `--project-path <SecondaryProbe>` | `projectPath = ...\SecondaryProbe` |
| 직접 CLI, `find_assets --name BootProbeAtlas --project-path <SecondaryProbe>` | **`count=0`** — 두 프로젝트가 실제로 분리돼 있음을 반대 방향에서도 확인 |
| 직접 CLI, `--project-path <Digit-Duel>` | `projectPath = ...\Digit-Duel\unity` |

MCP 서버는 등록 시 `--project-path` 로 Digit-Duel에 고정돼 있어 선택 여지가 없고, 직접 CLI는
`--project-path` 로 원하는 쪽을 고른다. 둘 다 의도대로 동작한다.

정리: `unity close <SecondaryProbe>`(PID 22468, graceful) → `unity projects remove` 로 Hub 등록 해제.
**일회용 Editor만 닫았고** Digit-Duel Editor(PID 31516)는 그대로 살아 있다(`unity status` → `count=1`).
일회용 프로젝트는 저장소 밖 scratchpad에 있어 추적되지 않는다.

---

## 16. 확정 — 새 checkout에서 열기·컴파일·검사 (Windows 경로 길이 한계 포함)

Worker는 Git 쓰기를 하지 않으므로 Mercury가 **실제 clean git clone** 을 만들어 줬다(스냅샷
`095e4dfccdcfc52cd60764c896f2a501cbecf354`, `git status` 깨끗, `Library/Temp/Logs/Builds` 없음).
경로에 공백이 들어 있어 래퍼의 인용 처리도 함께 검증된다.

### 16.1 결과

| 대상 경로 | 루트 길이 | 임포트/컴파일 오류 | EditMode | PlayMode |
|---|---|---|---|---|
| 1차 clone `C:\Users\pc_77\AppData\Local\Temp\Digit Duel QA <id>\checkout\unity` | 95자 | **25건** (전부 `DirectoryNotFoundException`) | 19/19 | **0건 실행됨** |
| 대조용 사본 `C:\ddqa\unity` (16.3절) | 13자 | **0건** | — | — |
| 2차 clone `C:\Temp\DD QA 095e4df\unity` (**공백 포함**) | 27자 | **0건** | **19/19 PASS** | **21/21 PASS** |

**새 checkout AC는 2차 clone에서 충족했다**: Library 없이 새로 임포트 → 오류 0 → 컴파일 성공 →
EditMode 19/19 · PlayMode 21/21.

### 16.2 확정 — 원인은 공백이 아니라 Windows `MAX_PATH`

1차 clone의 실패 경로를 직접 쟀다.

```
...\Digit Duel QA <id>\checkout\unity\Library\PackageCache\com.unity.2d.tooling@92c2769ac09c
   \Editor\Insider\SpriteAtlas\SpriteAtlasIssueReport\UIElement\CommonSpriteAtlasIssueView
   \CommonSpriteAtlasIssueView.uss
→ 268자 (> MAX_PATH 260)
```

같은 파일이 기본 프로젝트(`C:\Users\pc_77\orca\Digit-Duel\unity`, 루트 36자) 아래에서는 **209자**라
문제가 없다. 즉 **실패한 것은 패키지 캐시 압축 해제이지 이 프로젝트의 소스가 아니다.**

- PackageCache의 **최장 상대 경로는 193자**(`com.unity.render-pipelines.universal`,
  `com.unity.collections`). 이 구성에서 **루트 길이 여유는 대략 66자**로 계산된다(259 − 193).
  이는 **이번에 실측한 패키지 구성 기준의 안내 수치이지 보편적인 보장값이 아니다** — 패키지 버전이
  바뀌면 최장 경로도 바뀐다.
- OS 설정 `HKLM\...\FileSystem\LongPathsEnabled = 1` 인데도 실패한다 — Unity 임포터가 긴 경로 인식을
  적용받지 않는다.
- **공백은 무관하다.** 27자짜리 **공백 포함** 경로가 오류 0으로 통과한다.

**PlayMode 0건의 정체 (추론 — 기전은 미확인)**: 1차 clone에서 `list_tests --mode playmode` 는 21개를
찾는데 실행은 `Run started: 0 test(s)` 로 끝났다. 소스 문제였다면 2차 clone에서도 같아야 하는데 거기서는
21/21이다. **그래서 깨진 PackageCache 상태와 연관됐다고 추론한다 — 다만 어떤 기전으로 0이 되는지는
로그로 입증하지 못했다.** 대조 실험에 근거한 추론이지 확정된 인과가 아니다.
**0건을 통과로 적지 않으며** 이 관측을 지우지 않고 남긴다. 이를 맞추려고 제품 코드나 Pipeline 패키지를
고치지 않았다.

### 16.3 대조용 사본 `C:\ddqa` (이 Task가 만든 것 — 공개 기록)

원인이 "공백"인지 "경로 길이"인지 변수를 하나로 줄이려고, 1차 clone에서 `Assets`·`Packages`·
`ProjectSettings`·`.gitignore`·`.gitattributes` **만** 13자 루트로 복사해 열어 봤다(`Library` 는 복사하지
않았다). 결과가 오류 0이어서 길이가 원인임이 드러났다. 새 프로젝트를 생성한 것이 아니라 같은 스냅샷의
사본이다. 확인 후 그 Editor만 graceful close 했고 폴더는 보존했다. 저장소 밖이라 추적되지 않는다.
PD가 짧은 clone을 준비해 준 메시지와 시간이 겹쳐 실행됐다.

### 16.4 권고 (구현하지 않음 — 기획·조정 사항)

- **개발자 안내에 "체크아웃 경로를 짧게(루트 ~60자 이하)" 를 명시**해야 한다. CI 작업 디렉터리도 같다.
- `com.unity.2d.tooling` 이 가장 깊은 실패 경로의 주인이었다. 이 패키지가 정말 필요한지 재검토할 여지가
  있으나 **소스 동결 상태라 건드리지 않았다.** 제거하면 최장 경로가 줄어든다.
- 레지스트리·SDK·패키지 메타데이터는 아무것도 바꾸지 않았다.

### 16.5 확정 — Claude MCP 로 전용 임시 scene 변경·복구 (#183)

기본 프로젝트에서 **Claude 에이전트 MCP 도구로** 수행했다(쉘 CLI·헬퍼 스크립트가 아니다).

| 순서 | 도구 | 결과 |
|---|---|---|
| 1 | `create_scene` | `Assets/_CliSmoke/McpProbe.unity` (guid `823b0c73…`) |
| 2 | `create_gameobject` | `/McpProbeObject` |
| 3 | `get_scene_hierarchy` | `sceneName=McpProbe`, root `/McpProbeObject`, `isDirty=true` — 변경이 실제로 반영됐다 |
| 4 | `open_scene` | `Assets/DigitDuel/Scenes/Boot.unity` 로 복귀 |
| 5 | `delete_asset --confirm` | `Assets/_CliSmoke` 제거 |

**복구 검증**: 작업 전후로 `unity/` 추적 후보 145파일과 내용 지문
`60d16ee4f13ba15cc0c2ec64040b8c882b23e68986a41cb02e45600d0d3ee106` 가 동일하다. 잔여물이 없다.
임시 경로는 기존 `unity/.gitignore` 의 `/[Aa]ssets/_CliSmoke/` 대상이라 애초에 추적되지도 않는다.

`tools/unity/mcp_smoke.js` 는 이 Task 소유가 아니라 실행하지 않았다. 그 헬퍼의 최종본 실행 증거는
Mercury의 독립 실측(`183/Mercury/final-live-verification.md`)에 있다.

### 16.6 확정 — 최종 래퍼를 공백 포함 clean 경로에서 실제 실행

인용 처리 수정을 정적 검토로 끝내지 않고 **공백이 든 경로에서 실제로 빌드**했다.

```
powershell -File tools/unity/build-android-apk.ps1 -ProjectPath "C:\Temp\DD QA 095e4df\unity"
→ Unity exit code: 0
→ APK OK: C:\Temp\DD QA 095e4df\unity\Builds\Android\DigitDuel-dev.apk (129,877,150 bytes)
```

- **인용 처리가 실제로 동작한다**: 공백이 든 `-projectPath` 가 쪼개졌다면 Unity가 다른 경로를 열거나
  실패했을 텐데, 로그의 `[DigitDuel.Editor] build start ... output=C:\Temp\DD QA 095e4df\unity\Builds\...`
  가 의도한 프로젝트를 가리킨다.
- **타임스탬프 로그도 동작한다**: `Logs/android-build-20260911-160951.log` 로 남아 이전 로그를 덮어쓰지
  않는다.
- APK 실측: `package=com.creat2ve.digitduel.dev`, `targetSdkVersion=36`, `native-code=arm64-v8a`,
  `compileSdkVersion=36`. 기본 프로젝트 APK와 같은 계약이다.
- 크기가 1,512 bytes 다르다(129,877,150 vs 129,878,662). 차이의 원인은 조사하지 않았으며
  **bit-for-bit 재현 빌드를 주장하지 않는다.** 재현되는 것은 절차와 산출물 계약
  (식별자·ABI·SDK 레벨)이지 바이트 동일성이 아니다.

이 빌드는 **clean checkout 검증용**이다. 실기 설치·실행 증거(10절)는 기본 프로젝트에서 만든
앞선 APK로 수집한 것이고, 그 provenance를 이 빌드로 바꾸지 않는다.

### 16.7 관측 — clean clone의 임포트 후 직렬화 변동 (일시적)

Mercury가 2차 clone에서 임포트·검사 직후 `git status` 에 변경 1건을 관측했다:
`unity/Assets/Settings/UniversalRenderPipelineGlobalSettings.asset` 의 `m_RuntimeSettings.m_List` 에
있던 runtime rid 14개가 비워진 상태.

그 뒤 배치 빌드까지 끝난 시점에 내가 같은 clone에서 다시 확인했을 때는 **작업 트리가 깨끗했다**
(`git status --porcelain` 출력 0바이트, `HEAD = 095e4dfccdcfc52cd60764c896f2a501cbecf354`).
즉 그 변동은 **지속되지 않았다.**

기록하는 이유와 한계:
- 스냅샷은 **열기 전에는 깨끗했다.** 변동은 Unity가 임포트 과정에서 만든 것이다.
- 두 관측은 시점이 다르고 둘 다 사실이다. **"임포트 후에도 Git이 항상 깨끗하다"고 일반화하지 않는다.**
- 이 변동을 기본 프로젝트로 옮기거나 자동 반영하지 않았다. 소스는 동결 상태 그대로다.
- 어떤 조건에서 비워졌다가 되돌아오는지는 **확인하지 못했다.** 동작 결함이라는 증거는 아직 없다.

### 16.8 산출물 체크섬

| 산출물 | 크기 | SHA-256 |
|---|---|---|
| 기본 프로젝트 APK (**실기 설치·실행에 쓴 것**) | 129,878,662 bytes | `E1210D7555E3BFF8F08B9073EE7E67E4A685204EBBDF2E45293CC8BC63CD17EB` |
| clean clone APK (재현 검증용) | 129,877,150 bytes | `630631C011A26D5A0F5C46F0F7EB6C60F8441D4114CDEB929A952F0A705A4839` |

두 APK는 **서로 다른 파일이며 혼동하면 안 된다.** 10절의 실기 증거는 위쪽 APK로 만든 것이다.
clean clone 빌드는 `Succeeded`, 소요 `00:05:38.14`, errors 0 / warnings 5 로 끝났다.

**소스 동결 지문** (이 Task 종료 시점, 변동 없음):
`60d16ee4f13ba15cc0c2ec64040b8c882b23e68986a41cb02e45600d0d3ee106` — `unity/` 추적 후보 145파일.
