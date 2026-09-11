# #182 — Unity 최소 프로젝트 부트스트랩 (Mars_1)
2026-09-11 · Mars_1(Claude Code) · Task `task_3b3b0acd5248` / Dispatch `ctx_f74c9bd47fde` / Run `run_e7acdb9f7900`

**이 문서의 범위**: CJ 승인 순서 중 2단계(최소 프로젝트)까지의 실측 기록이다. **#182 전체 환경 준비 완료도, 이슈 종결 근거도 아니다.** Android 모듈·참조 구조 적용·APK 검증은 다음 Task다. 연결(#183) 결과는 [별도 보고](https://github.com/ChangjoSung/Digit-Duel/issues/183#issuecomment-5630340391)에 있다.

## 1. 확정 — 설치·버전

| 항목 | 실측 값 | 확인 방법 |
|---|---|---|
| Unity CLI | `1.0.0-beta.9` | `unity --version` |
| Editor | `6000.6.0f1` (revision `f7f8ed4d1e24`) | `unity editors list --json`, `ProjectSettings/ProjectVersion.txt` |
| Editor 경로 | `C:\Program Files\Unity\Hub\Editor\6000.6.0f1\Editor\Unity.exe` | `unity editors list --json` |
| 최신 정식 재확인 | `unity releases --stream tech`의 최상위 정식이 `6000.6.0f1`(installed=true), 차순위는 `6000.5.11f1` | 착수 당일 재조회 |
| 로그인·라이선스 | 로그인됨 · Unity Personal ULF 유효 | `unity auth status`, `unity license list` |
| Editor 설치 | 이번 Task에서 **설치하지 않았다**. 앞선 시도의 설치가 이미 완료돼 있었다 | `unity editors list` 에 location·버전 존재 |

`6000.6.0f1`은 6.5 계열보다 **날짜가 아니라 계열이 위**다. 6.5 패치가 더 최근에 나와도 최신 정식 계열은 6.6이다.

## 2. 확정 — 생성한 프로젝트

```
unity projects create unity --path "C:\Users\pc_77\orca\Digit-Duel" \
  --editor-version 6000.6.0f1 --template com.unity.template.universal-2d \
  --no-cloud --non-interactive        # exit 0
```

| 항목 | 값 |
|---|---|
| 경로 | `C:\Users\pc_77\orca\Digit-Duel\unity` |
| 템플릿 | `com.unity.template.universal-2d` 7.0.0 (로컬 캐시가 이미 "준비됨"이라 추가 다운로드 없음) |
| 렌더 파이프라인 | URP `com.unity.render-pipelines.universal` 17.6.0 |
| Hub 등록 GUID | `e9f10b50b9cdce843bfd9d1355d8fc66` |
| 게임 구현 | **0** — 템플릿 기본 자산(SampleScene·Settings·Welcome)뿐이다 |
| 컴파일 | `recompile` → `status=up_to_date, failed=false, errors=[]`, `console --level error` → 0건 |
| productName | `unity` → **`Digit Duel`** 로 변경 (`set_player_settings --confirm true`) |
| companyName | `DefaultCompany` 유지 — **[기획 필요]** Android 패키지 식별자 기본값에 들어가므로 CJ 확정 후 설정한다 |

### 추론 — 되돌릴 수 있는 부트스트랩 선택
- **URP 2D 템플릿**: 게임이 2D 보드게임이고 Android 타깃이라 URP 2D를 골랐다. 게임 콘텐츠가 0이라 #187의 UI Toolkit·렌더 파이프라인 결정 시 교체 비용이 사실상 없다. **채택 확정이 아니다.**
- **템플릿 기본 패키지 54개**: `com.unity.learn.iet-framework`·`visualscripting`·`collab-proxy` 등 게임에 불필요한 것이 섞여 있다. PD 지시대로 **본구성 Task에서 실제 필요 기준으로 정리**한다. 지금 지우면 연결 검증과 원인이 섞인다.

## 3. 확정 — 저장소 경계 (nested ignore·attributes)

저장소 루트 `.gitignore`는 이미 Unity 템플릿 내용이지만 **루트 앵커**(`/[Ll]ibrary/`)라 `unity/` 하위를 덮지 못했다. 실측:

| 경로 | 루트 규칙만 있을 때 | `unity/.gitignore` 추가 후 |
|---|---|---|
| `unity/Library/` `unity/Temp/` `unity/Logs/` `unity/UserSettings/` | NOT-IGNORED | IGNORED |
| `unity/unity.sln` `unity/*.csproj` | IGNORED (루트의 비앵커 규칙이 이미 덮음) | 동일 |

- 추가 파일: **`unity/.gitignore`**, **`unity/.gitattributes`** (둘 다 `unity/` 범위 전용).
- **루트 `.gitignore`·`.gitattributes`는 건드리지 않았다.** 템플릿 생성이 기존 ignore를 덮어쓰지도 않았다(내용 동일).
- `.gitattributes`가 필요한 이유: 이 PC의 git은 `core.autocrlf=true`인데 Unity는 YAML 자산·`.meta`를 항상 LF로 다시 쓴다. CRLF로 체크아웃되면 Editor를 열 때마다 전 파일이 수정된 것처럼 보인다. 그래서 Unity 자산 확장자에 `eol=lf`, 이미지·오디오·폰트·네이티브 라이브러리에 `binary`를 지정했다.
- 추적 후보는 63파일(`git status --porcelain -uall unity`). **Git 쓰기는 하지 않았다** — `add`/`commit` 없이 untracked 상태로 둔다. 통합은 Mercury 소관이다.
- 사용자 미추적 자산(`art/`, `orca-hook-latency-report.md`)과 다른 워크트리는 열지도 바꾸지도 않았다.

## 4. 확정 — 다음 Task로 넘기는 것 (이번 범위 아님)

| 항목 | 실측 상태 | 근거 |
|---|---|---|
| Android Build Support | **미설치** | `list_build_targets` → `{name: Android, isInstalled: false}`; `unity editors list`의 6000.6.0f1 `modules=""`; `6000.6.0f1/Editor/Data/PlaybackEngines/`에 `windowsstandalonesupport`만 존재 |
| SDK/NDK/OpenJDK | 6.6에는 없음. 6000.4.10f1·6000.0.25f1에는 있음 | `unity editors list` modules 열 |
| 실기기 | **연결돼 있음** — `adb devices -l` 이 삼성 `SM_S948N`(product m3qksx) 1대를 `device` 상태로 보고. adb는 PATH에 없고 `6000.4.10f1`의 `PlaybackEngines/AndroidPlayer/SDK/platform-tools/adb.exe`(1.0.41 / 36.0.0)를 사용했다. **일련번호는 공개 기록에 싣지 않는다.** 이번 Task에서 APK 설치·실행은 하지 않았다 |
| 참조 구조(MFM·audition_idol) 적용 | 미착수 | 본구성 Task 범위 |
| 패키지 정리 | 미착수 | 본구성 Task 범위 |

## 5. 롤백

| 대상 | 되돌리는 법 | 비고 |
|---|---|---|
| `unity/` 프로젝트 전체 | 폴더 삭제 + `unity projects remove "C:\Users\pc_77\orca\Digit-Duel\unity"` | untracked라 Git 이력 영향 없음 |
| `unity/.gitignore` `unity/.gitattributes` | 파일 삭제 | 루트 파일 미변경이라 부작용 없음 |
| productName | `unity command set_player_settings --settings '{"productName":"unity"}' --confirm true` | |
| Pipeline 패키지 | `unity/Packages/manifest.json` 의 `"com.unity.pipeline"` 줄 제거 후 Editor 재열기 | #183 롤백 표와 동일 |
| Editor 설치 | **되돌리지 않는다** — 이번 Task가 설치하지 않았고 다른 프로젝트도 Hub를 공유한다 | |

## 6. 프로세스·의존성

- 이번 Task가 띄운 것: Editor PID 28860(+자식 32684) → 재연결 시험으로 graceful close → 재기동 PID **20300**(port 7800, state ready). CLI 프로세스 2160.
- 기동 전 Unity 관련 프로세스는 `Unity.Licensing.Client` PID 25800 하나뿐이었고 **다른 프로젝트 Editor는 없었다.** 종료시킨 것은 이번 Task가 띄운 Digit-Duel Editor 한 번뿐이다.
- Hub 설치 DB는 **읽지도 쓰지도 않았다.** 앞선 Task의 수동 `ALTER TABLE`은 그대로 남아 있으며 이 문서가 그것을 정상화하지 않는다.
- 의존성: Node `v24.16.0`(연결 스모크용), Unity Hub 3.21.2, git `core.autocrlf=true`.
