# #195 Unity 전용 CI — Mars 구현 보고

2026-09-11 · Mars (Claude Code) · 브랜치 `infra/195-unity-ci` (base `b1f7467`)
근거 문서: [Mercury 적용 판단](../Mercury/analysis.md) · CLAUDE.md · Dispatch `ctx_4301b2ba576c`

기존 필수 A·B·B2·C·D·E 6개를 그대로 두고 **F 하나**를 더했다. 총 7개다. Editor 인증이 필요한
구성은 만들지 않았고, 동작하지 않는 템플릿도 넣지 않았다.

---

## 1. 변경한 파일 (전체)

| 파일 | 상태 | 내용 |
|---|---|---|
| `.github/workflows/ci.yml` | 수정 (+77 / −0) | 잡 `unity-structure-csharp-mcp` = `F. Unity 구조·순수 C#·MCP` 추가 |
| `tools/unity/ci/unity_project_check.js` | 신규 | 추적 파일 정적 정합성 검사기 (Node, 외부 패키지 0) |
| `tools/unity/ci/unity_project_check.test.js` | 신규 | 음성 대조 회귀 43건 (`node --test`) — 최초 37건 + Saturn 지적 반영 6건(11장) |
| `tools/unity/ci/project-contract.json` | 신규 | 기대값 원본 — 검사기 코드에 숫자를 적지 않는다 |
| `tools/unity/ci/compile/.gitignore` | 신규 | 루트 `.gitignore`의 `*.csproj` 무효화 + `bin/` `obj/` 제외 |
| `tools/unity/ci/compile/DigitDuel.Core/DigitDuel.Core.csproj` | 신규 | Core 실제 소스 컴파일 (netstandard2.1 · C# 9) |
| `tools/unity/ci/compile/DigitDuel.Application/DigitDuel.Application.csproj` | 신규 | Application 실제 소스 컴파일 · Core 만 ProjectReference |
| `docs/milestone/v0.6.0/issues/195/Mars/report.md` | 신규 | 이 문서 |

**건드리지 않은 것 (실측 확인)**: `unity/` 145개 추적 파일 전부 · `tools/unity/mcp_smoke.js` ·
`tools/unity/mcp_smoke.test.js` · `tools/unity/build-android-apk.ps1` · `art/` ·
`orca-hook-latency-report.md` · 브랜치 보호 · secrets · Hub/라이선스 · Git/GitHub/Notion 쓰기.
`git status --porcelain unity tools/unity/mcp_smoke.js tools/unity/mcp_smoke.test.js tools/unity/build-android-apk.ps1`
가 빈 출력이다. `ci.yml` 은 삭제 라인 0줄로 순수 추가이며 기존 6잡·`permissions`·트리거·SHA 핀이
그대로임을 YAML 파싱으로 확인했다 (잡 7개, `permissions: {contents: read}`,
트리거 `[main, dev, 'milestone/**']`).

---

## 2. 잡 F 의 구성

`ubuntu-24.04` · `timeout-minutes: 15` · secret 0 · `permissions` 상속(`contents: read`).
`paths:` 필터도 잡 수준 `if:` 도 **없다** — 이 workflow 가 있는 곳에서는 항상 돈다.

| # | 스텝 | 실행 |
|---|---|---|
| 1 | checkout `@3d3c42e5…` (v7.0.1) | `persist-credentials: false`, 얕은 클론 (히스토리 불필요) |
| 2 | setup-node `@82076278…` (v7.0.0) | `NODE_VERSION` (24) |
| 3 | setup-dotnet `@a98b5685…` (v6.0.0) | `dotnet-version: '10.0.x'` |
| 4 | 검사기 회귀 | `node --test tools/unity/ci/unity_project_check.test.js` |
| 5 | 구조 검사 | `node tools/unity/ci/unity_project_check.js --verbose` |
| 6 | Core 컴파일 | `dotnet build …/DigitDuel.Core/DigitDuel.Core.csproj -c Release` |
| 7 | Application 컴파일 | `dotnet build …/DigitDuel.Application/DigitDuel.Application.csproj -c Release` |
| 8 | 두 어셈블리 산출 확인 | 두 DLL 이 실제로 있고 크기가 0 이 아닌지 |
| 9 | MCP 회귀 | `node --test tools/unity/mcp_smoke.test.js` |

**setup-dotnet SHA 독립 확인**: PD가 지정한 `a98b56852c35b8e3190ac28c8c2271da59106c68` 을
GitHub API `repos/actions/setup-dotnet/git/ref/tags/v6.0.0` 로 다시 조회해
`refs/tags/v6.0.0 -> commit a98b56852c35b8e3190ac28c8c2271da59106c68` 로 일치함을 확인했다.

**왜 필터가 없는가**: GitHub 공식 문서상 워크플로가 path·branch 필터로 건너뛰어지면
그 검사는 Pending 으로 남고 그것을 필수로 요구하는 PR 은 영영 머지되지 않는다.
그리고 `unity/` 가 사라진 것을 초록으로 넘기면 게이트가 아니라 장식이다 — C1 이 **실패**로 낸다.

---

## 3. 검사 항목

기대값은 전부 `tools/unity/ci/project-contract.json` 에 있다. Android Player 값 중 소스가 원본인
것(id·SDK 레벨·회사/제품명)은 계약에 옮겨 적지 않고 `AndroidPlayerConfigurator.cs` 의 `const` 를
파싱해서 쓴다 — 두 곳에 적으면 갈린다.

| 코드 | 검사 | 막으려는 사고 |
|---|---|---|
| C1 | `unity/` 추적 파일 존재 + 필수 7파일 | 프로젝트·lock·설정이 사라진 채 병합 |
| C2 | ProjectVersion ↔ 계약 ↔ `build-android-apk.ps1` 의 Hub 경로 | 다른 Editor 로 열어 전 자산 재직렬화 / 버전 상향 절반만 반영 |
| C3 | ProjectSettings ↔ 설정기 `const` (IL2CPP·ARM64·min26/target36·세로·keystore 미사용) | target SDK Auto 풀림, 개인 keystore 켜짐, 소스만 고치고 설정 누락 |
| C4 | manifest 직접 의존성 ↔ lock 버전·레지스트리 | lock 미갱신으로 기계마다 다른 패키지, 사설 레지스트리 유입 |
| C5 | meta 짝 (Assets 루트 제외 · `folderAsset: yes` 빈 폴더 허용) | meta 누락으로 GUID 재발급 → 참조 끊김 |
| C6 | GUID 중복 | 폴더 복사로 같은 GUID 두 개 → 참조가 한쪽으로 쏠림 |
| C7 | asmdef 그래프·계층·externals·Editor/Test 격리·asmdef 밖 `.cs`·런타임 UnityEditor 누출 | 계층 역행, 테스트가 Player 빌드에 섞임, `Assembly-CSharp` 유출 |
| C8 | 활성 빌드 씬 개수·파일·meta GUID 일치·씬이 잡고 있는 우리 자산 존재 | "기기에서 Missing script 로만 드러나는" 회귀 |
| C9 | `unity/` 직속 앵커로 캐시·산출물·자격증명 추적 여부 | APK·Library 유입, **공개 저장소에 keystore/ulf 유출** |

### 판정하지 않기로 한 것 (의도된 경계)

- **씬의 미해소 GUID**: 세기만 하고 실패로 보지 않는다. `Library/PackageCache` 를 추적하지 않아
  빌트인·UPM 인지 **확인할 방법이 없다**. 실측으로 `Boot.unity` 의 참조 7개 중 4개가 그렇다.
  전량 실패로 걸면 첫날부터 빨간 불이다. 우리 자산이 사라진 경우는 계약의 `mustReferenceAssets`
  (BootRoot·BootAssetProbe·SafeAreaFitter)가 **이름을 대고** 잡는다.
- **`managedStrippingLevel`**: 검사하지 않는다. 커밋된 값은 `Android: 4` 인데 설정기는
  `ManagedStrippingLevel.Minimal`(=1)을 넣는다. Editor 없이 원인을 규명할 수 없어 **미확정**이고,
  진위 불명인 채로 게이트에 넣으면 실패가 신호가 아니라 잡음이 된다. 계약 파일에 제외 사유를 남겼다.

---

## 4. 실제 C# 컴파일 — 무엇을 증명하고 무엇을 못 하는가

두 층은 asmdef 에서 `noEngineReferences: true` 로 선언돼 있다. 그 선언이 사실인지 **실제 컴파일로**
확인한다. 소스 9개 파일의 `using` 은 `System`·`System.Collections.Generic`·`System.Threading(.Tasks)`
뿐이다.

**어셈블리를 둘로 나눈 이유**: 한 프로젝트에 합치면 `Application → Core` 한 방향만 있는지
컴파일러가 확인하지 못한다. 따로 컴파일하고 `ProjectReference` 를 한쪽에만 걸어야, Core 가
Application 타입을 쓰는 순간 Core 빌드가 깨진다. C7 이 asmdef **선언**을 보는 것과 달리 이쪽은
**컴파일 결과**로 같은 경계를 본다 — 서로를 대체하지 않는다.

**빈 소스 집합 가드 (실측 검증함)**: 폴더가 옮겨지면 MSBuild 가 조용히 빈 어셈블리를 만들고
초록으로 끝날 수 있다. `!Exists($(UnitySourceRoot))` 와 `'@(UnitySource)' == ''` 두 `<Error>` 로
막았고, 경로를 `Runtime/CoreMoved` 로 바꾼 사본을 실제로 빌드해
`error : 소스 폴더가 없다: …/Runtime/CoreMoved` 로 떨어지는 것을 확인했다.

### 외부 컴파일러의 한계 (문서화 요구 사항)

1. **이것은 Unity 컴파일이 아니다.** Roslyn 버전과 참조 어셈블리가 Unity 번들과 같지 않다.
   **실패는 거의 항상 진짜지만, 통과가 Unity 컴파일을 보장하지 않는다.**
2. Unity 의 조건부 심볼(`UNITY_EDITOR`·`UNITY_ANDROID` 등)이 정의되지 않는다. 그 심볼로 갈라지는
   코드는 여기서 다른 가지를 탄다.
3. 직렬화·IL2CPP·스트리핑·도메인 리로드 동작은 전혀 보지 않는다.
4. **Infrastructure·Presentation·Editor·Tests 는 대상이 아니다.** 엔진·에디터 참조가 있어 Unity 없이
   컴파일할 수 없다. 가짜 `UnityEngine.dll` 스텁으로 흉내내지 않았다 — 거짓 초록을 만드는 짓이다.
5. 언어 수준은 Unity 6000.6 공식 C# 문서가 명시한 **C# 9** 로 고정했다. `netstandard2.1` 표면과
   Unity 의 .NET Standard 프로필이 완전히 같지는 않다.
6. 패키지 의존성 0 — NuGet 패키지를 하나도 받지 않는다. 참조는 SDK 동봉 타기팅 팩뿐이다.

---

## 5. 음성 대조 회귀 (43건 — 최초 37건 + 11장 6건)

`node --test tools/unity/ci/unity_project_check.test.js`. 전부 `os.tmpdir()` 아래 임시 저장소에
저장소의 추적 파일을 복사하고 `git init` + `git add` 로 만든 픽스처를 쓴다 — 검사기가 실제로 쓰는
`git ls-files` 경로를 그대로 태운다. **저장소를 수정하지 않는다.** Unity·Editor·MCP·dotnet 을
부르지 않는다.

구현을 그대로 베낀 대량 테스트는 만들지 않았다. 한 사례 = 실제로 났거나 날 수 있는 사고 하나다.

**양성·오탐 방지 (최초 7건)** — 이게 없으면 게이트가 과민해져 결국 꺼진다:
실제 저장소 통과 · 미해소 GUID 통과와 문구 검증 · 빈 폴더 `folderAsset` meta 통과 ·
**점이 든 폴더 이름**(`My.Folder.meta`) 통과 · `#if UNITY_EDITOR` 보호 통과 ·
`Editor/Build/` 아래 정상 소스 통과(경로 앵커).

**음성 (최초 30건)**: C1 `unity/` 전체 삭제 · lock 삭제 / C2 Editor 버전 변경 · 절반만 상향 /
C3 target SDK Auto · 아키텍처 변경 · keystore 켜짐 · 상수만 변경 / C4 lock 미갱신 · 사설 레지스트리 /
C5 meta 삭제 · 본체 삭제 · `folderAsset` 없는 고아 meta / C6 GUID 중복 /
C7 Core→Presentation · `noEngineReferences` 해제 · `UNITY_INCLUDE_TESTS` 제거 · Editor 전 플랫폼화 ·
**Core→UnityEngine.UI** · **런타임→UnityEditor.TestRunner** · 어셈블리 이름 오타 · asmdef 밖 `.cs` ·
보호 없는 `UnityEditor` · `#if !UNITY_EDITOR` · `#if UNITY_EDITOR || UNITY_ANDROID` · `#else` 가지 /
C8 참조 스크립트 삭제 · 씬 meta GUID 불일치 · 활성 씬 증가 /
C9 APK 강제 추적 · keystore 추적.

**C9 픽스처에서 배운 것**: 평범한 `git add -A` 로는 `unity/.gitignore` 가 APK 를 막아 테스트가
통과해 버렸다. C9 가 막으려는 사고는 `git add -f` 이거나 무시 규칙이 망가진 순간이므로
`git add -f` 로 바꿨다. 처음 작성한 규칙은 통과했지만 **아무것도 증명하지 못하는 테스트**였다.

---

## 6. PD 검수 지적 4건 — 반영 내역

| # | 지적 | 반영 |
|---|---|---|
| 1 | 빈 폴더 meta 판정에서 `folderAsset: yes` 가 스템 확장자 검사보다 **앞서야** 한다 (`My.Folder.meta`) | 순서를 뒤집었다. 확장자로 폴더 여부를 추측하지 않는다. 전용 회귀 추가 |
| 2 | 전역 external 화이트리스트가 `Core → UnityEngine.UI`·`런타임 → UnityEditor.TestRunner` 를 허용 | 계약을 **어셈블리별 `externals`** 로 바꿨다. `engineFree` 는 `externals: []` 강제. `knownExternalAssemblies` 는 오타 구분용이며 허가가 아니다. 회귀 3건 추가 |
| 3 | `includes('UNITY_EDITOR')` 라 `#if !UNITY_EDITOR`·`#if UNITY_EDITOR \|\| UNITY_ANDROID` 가 조용히 통과 | 보호로 인정하는 형태를 **정확히 `#if UNITY_EDITOR` 하나**로 좁혔다(괄호·줄 끝 주석 허용). 판정이 틀리는 방향을 실패 쪽으로 고정했고 C# 파서를 만들지 않았다. 인식 범위를 함수 주석에 명시. 회귀 3건 추가 |
| 4 | 미해소 GUID 를 빌트인·UPM 이라고 **단정**하면 안 된다 | 문구를 "저장소 meta 로 풀리지 않는다 (빌트인·UPM 일 수 있으며 여기서는 판정하지 않는다)" 로 바꾸고, 단정 문구가 돌아오면 떨어지도록 회귀에 문자열 단언을 넣었다 |

지적 3에 대한 판단을 분명히 적는다: `#if UNITY_EDITOR && X` 는 실제로는 에디터 전용인데 여기서는
보호로 세지 않으므로 **오탐 가능성이 남는다**. 오탐은 시끄럽고 고칠 수 있지만 누락은 깨진 Player
빌드를 내보낸다. 그런 형태가 필요해지면 계약과 함수를 함께 고친다.

---

## 7. 로컬 실행 결과 (전부 실제 실행)

Windows 10 · Node v24.16.0 · .NET SDK **10.0.401** (공식 `dotnet-install.ps1` 로 **scratchpad 임시
디렉터리에만** 설치, 승격·전역 설정·PATH 변경 없음).

```
1) 검사기 회귀            tests 37 · pass 37 · fail 0
2) 구조 검사              OK — 추적 145 · 자산 113 · .cs 27 · GUID 69 · 직접 의존성 46 · Editor 6000.6.0f1
                             Boot.unity 참조 GUID 7 중 4 미해소 (판정 없음)
3) Core 컴파일            오류 0 · 경고 0
4) Application 컴파일     오류 0 · 경고 0
5) 두 어셈블리 산출       DigitDuel.Core.dll 5,632 B · DigitDuel.Application.dll 4,608 B
6) MCP 회귀               tests 46 · pass 46 · fail 0
```

부수 검증: YAML 파싱으로 잡 7개·기존 6잡 보존·`permissions`·트리거 확인 / `ci.yml` 삭제 라인 0 /
setup-dotnet SHA GitHub API 재확인 / 폴더 이동 음성 대조로 빈 소스 가드 발화 확인 /
`git add -An` 으로 `bin/` `obj/` 가 제외되고 `!*.csproj` 가 csproj 를 되살리는 것 확인 /
`unity/` 트리 무변경 확인.

---

## 8. 한계와 CI 가 증명해야 할 것

로컬 실행은 **Windows** 다. 잡 F 는 **ubuntu-24.04** 에서 돈다. 아래는 실제 PR 실행으로만 확정된다.

1. **Ubuntu 에서 6스텝 전부 통과** — 특히 경로 대소문자와 `git ls-files` 결과. 검사기는 git 이 주는
   POSIX 경로만 쓰지만 리눅스 실측 전까지는 추론이다.
2. **호스티드 러너의 .NET SDK 10 (`10.0.x`) 이 `netstandard2.1` 을 네트워크 패키지 없이 빌드** —
   로컬 10.0.401 에서는 됐다. 러너가 집는 패치 버전은 다를 수 있다.
3. **잡 F 의 실제 소요 시간** — `timeout-minutes: 15` 가 충분한지. 로컬 합계는 약 25초지만 SDK 설치
   시간이 더해진다.
4. **체크 이름 `F. Unity 구조·순수 C#·MCP` 가 그대로 보고되는지** — 보호 규칙에 등록하려면 이름이
   정확히 일치해야 한다.

**이 잡이 초록이어도 증명되지 않는 것** (보고서·이슈에 이 문장 그대로 쓸 것):
> Unity Editor 를 열지 않고, EditMode·PlayMode 를 돌리지 않으며, APK 를 만들지 않는다.
> **F 가 초록이어도 "Unity 프로젝트가 컴파일된다"는 보장은 없다.** Roblox 의 E 가 전 소스를
> `luau-compile` 하는 것과 같은 수준이 아니다. 실제 Editor CI 는 인증·실행 환경·결과 보관을
> 따로 입증한 뒤 별도로 활성화한다.

**후속 주의 (PD 판단 필요)**: `unity/` 는 현재 `milestone/v0.6.0` 트랙에만 있고 `origin/main`·
`origin/dev` 에는 0건이다. 이 `ci.yml` 이 dev·main 으로 흘러갈 때 `unity/` 가 **함께 가지 않으면**
그 브랜치의 잡 F 는 C1 로 실패한다. 설계상 의도한 동작이지만(부재를 초록으로 넘기지 않는다),
트랙→dev 병합 시점에 같이 확인해야 한다.

---

## 9. 롤백

- 전체 되돌리기: `.github/workflows/ci.yml` 의 잡 F 블록(파일 끝 77줄) 삭제 + `tools/unity/ci/` 삭제.
  기존 6잡은 한 글자도 바꾸지 않았으므로 되돌림이 다른 검사에 영향을 주지 않는다.
- 부분 되돌리기: 컴파일만 빼려면 스텝 6·7·8 과 `setup-dotnet` 스텝을 지우고 `tools/unity/ci/compile/`
  를 삭제한다. 검사기만 빼려면 스텝 4·5 와 `unity_project_check*`·`project-contract.json` 을 지운다.
- 보호 규칙은 건드리지 않았다. F 는 아직 required 가 아니므로 되돌려도 PR 이 막히지 않는다.
  required 등록은 실제 PR 성공 뒤 PD 가 `milestone/v0.6.0` 에만 수행한다.

## 10. 남긴 것 (Mars 범위 밖)

Git 쓰기·PR·이슈 코멘트·Notion·CLAUDE.md 의 "필수 CI 6개" 표기 갱신·보호 규칙 등록은 전부 PD 몫이다.
Saturn 독립 QA 가 뒤따른다. 표기 갱신은 F 가 **실제로 required 로 켜진 시점**에 하는 것이 맞다 —
먼저 고치면 문서가 설정보다 앞선다.

---

## 11. Saturn 지적 P2 — 런타임 asmdef 플랫폼·define 제약 (2026-09-11 반영)

Dispatch `ctx_ac43c80e6d7f` · 범위는 `unity_project_check.js` · `unity_project_check.test.js` ·
이 보고서 **셋뿐**이다. 계약(`project-contract.json`)·워크플로우·`unity/` 트리·컴파일 csproj 는
한 글자도 바꾸지 않았다.

### 무엇이 틀렸나

C7 의 런타임 경계 검사가 `includePlatforms` **하나만** 봤다. 어셈블리를 Player 에서 빼는 길은
세 가지인데 나머지 둘이 무검사였다:

| 조작 | 결과 | 종전 판정 |
|---|---|---|
| `excludePlatforms: ["Android"]` | Android Player 에서 어셈블리가 통째로 빠진다 | **통과 (exit 0)** |
| `defineConstraints: ["UNITY_EDITOR"]` | Editor 에서는 멀쩡하고 기기 빌드에서만 빠진다 | **통과 (exit 0)** |
| `includePlatforms: ["Editor"]` | 지정 플랫폼 밖에서 빠진다 | 실패 (검사됨) |

Unity 는 어느 쪽에도 에러를 내지 않는다. 씬이 참조하던 컴포넌트가 기기에서 Missing script 가
될 뿐이라 CI 가 잡지 못하면 실기에서만 드러난다. 같은 결함의 타입 판 하나가 더 있었다 —
`defineConstraints` 가 배열이 아니라 문자열이면
`"UNITY_INCLUDE_TESTS".includes('UNITY_INCLUDE_TESTS')` 가 참이라, Unity 가 읽지도 못하는
asmdef 가 **테스트 격리 검사까지 통과**했다.

실측(같은 픽스처, 옛 검사기 `HEAD:71abc8d` ↔ 새 검사기):

```
excludePlatforms=["Android"]      (Presentation)  old exit=0  →  new exit=1
defineConstraints=["UNITY_EDITOR"] (Core)         old exit=0  →  new exit=1
defineConstraints="UNITY_INCLUDE_TESTS" (PlayMode) old exit=0 →  new exit=1
```

### 무엇을 고쳤나

`editorOnly` 도 `test` 도 아닌 **런타임 어셈블리**(Core·Application·Infrastructure·Presentation)에
대해 기존의 전 플랫폼 계약을 세 필드로 넓혀 집행한다 — `includePlatforms` · `excludePlatforms` ·
`defineConstraints` 가 **모두 비어 있어야 한다**. 계약에 새 키를 만들지 않았다. 기존
`assemblies` 의 `editorOnly` · `test` 플래그가 그대로 대상을 가른다.

함께 들어간 것 둘:
- **타입 검사**: 세 필드가 있으면 문자열 배열이어야 한다. 배열이 아니거나 항목이 문자열이 아니면
  실패하고, 그 필드의 내용 검사는 건너뛴다(신뢰할 수 없는 값으로 2차 오진을 내지 않는다).
- **상호 배타**: `includePlatforms` 와 `excludePlatforms` 가 둘 다 채워지면 실패. Unity Inspector 는
  둘 중 하나만 채우게 하고, 손으로 둘 다 채우면 무엇이 남는지 asmdef 만 봐서는 읽히지 않는다.

**보존한 것**: Editor 어셈블리의 `includePlatforms: ["Editor"]`, 테스트 어셈블리의
`UNITY_INCLUDE_TESTS` 와 플랫폼 제한은 종전대로 정상이다 — 런타임 전 플랫폼 규칙의 대상이
아니다. 4·5장의 외부 컴파일러 한계와 `#if UNITY_EDITOR` **어휘** 검사 경계도 그대로다.
이 변경은 asmdef 의 JSON 필드만 본다.

### 추가한 회귀 (6건 · 음성 5 · 양성 1)

| 사례 | 기대 |
|---|---|
| 런타임 `excludePlatforms: ["Android"]` | 실패 · 이유에 `excludePlatforms` |
| 런타임 `includePlatforms: ["Editor"]` | 실패 · 이유에 `includePlatforms` |
| 런타임 `defineConstraints: ["UNITY_EDITOR"]` | 실패 · 이유에 `defineConstraints` |
| 두 플랫폼 목록 동시 지정 | 실패 |
| `defineConstraints` 가 문자열 | 실패 · 이유에 `배열이 아니다` |
| **테스트 어셈블리의 `excludePlatforms: ["WebGL"]`** | **통과** — 새 규칙이 Editor·Test 를 오탐하지 않는다 |

### 실행 결과 (실제 실행 · 2026-09-11)

```
검사기 회귀   node --test tools/unity/ci/unity_project_check.test.js
              tests 43 · pass 43 · fail 0 · exit 0   (종전 37 → +6)
구조 검사     node tools/unity/ci/unity_project_check.js --verbose
              OK · exit 0 — 추적 145 · 자산 113 · .cs 27 · GUID 69 · 직접 의존성 46 · Editor 6000.6.0f1
              Boot.unity 참조 GUID 7 중 4 미해소 (판정 없음)
```

MCP 회귀·C# 컴파일은 **다시 돌리지 않았다** — 소스를 건드리지 않았으므로 7장의 결과가 그대로
유효하다. `git status`로 `unity/` 트리 무변경을 확인했다.

**판정은 여기 적지 않는다.** 위는 구현자의 실행 기록이고, PASS/REVISE 는 Saturn 의 독립 재검이
내린다. Git 쓰기·이슈 코멘트는 Mercury 몫이다.
