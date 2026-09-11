using UnityEditor;
using UnityEditor.Build;
using UnityEngine;

namespace DigitDuel.Editor.Build
{
    /// <summary>
    /// Android 개발 빌드에 필요한 Player 설정을 코드로 고정한다. GUI 수작업 대신 이 메서드가 원본이며
    /// CI/CLI에서 같은 결과를 낸다. 출시 서명·스토어 식별자·권한 정책은 여기서 정하지 않는다.
    /// </summary>
    public static class AndroidPlayerConfigurator
    {
        // PD가 정한 개발용 기술 설정. CJ의 출시 식별자 확정이 아니다.
        public const string CompanyName = "Creat2ve";
        public const string ProductName = "Digit Duel";
        public const string DevelopmentApplicationIdentifier = "com.creat2ve.digitduel.dev";

        /// <summary>
        /// API 36 = Android 16. 명시 고정한다 (Auto 는 설치된 SDK 목록에 따라 흔들려 재현되지 않는다).
        ///
        /// 37(Android 17)을 쓰지 않는 이유는 실측된 비호환이다. 이 Editor 의 Gradle 은 플랫폼을
        /// 해시 문자열 <c>android-37</c> 로 찾는데, Unity 자체 설치기가 넣은 폴더는 <c>android-37.0</c> 이고
        /// 그 <c>source.properties</c> 도 <c>AndroidVersion.ApiLevel=37.0</c> 이다(Android 16부터의
        /// minor SDK 표기). 실제 빌드가 다음으로 실패했다:
        ///   Failed to find target with hash string 'android-37' in: ...\AndroidPlayer\SDK
        /// 공유 Unity 설치의 SDK 폴더 이름을 고치는 것은 이 Task 범위 밖이라 하지 않았다.
        /// 검증 기기도 Android 16(API 36)이라 36 이 현재 실측 가능한 최신 target 이다.
        /// Unity 가 37.0 표기를 지원하면 다시 올린다.
        /// </summary>
        public const AndroidSdkVersions TargetSdkVersion = AndroidSdkVersions.AndroidApiLevel36;

        /// <summary>개발 단계 하한. 낮출 이유가 생기면 실기 호환성 근거와 함께 바꾼다.</summary>
        public const AndroidSdkVersions MinSdkVersion = AndroidSdkVersions.AndroidApiLevel26;

        [MenuItem("DigitDuel/Configure Android Player Settings")]
        public static void Configure()
        {
            PlayerSettings.companyName = CompanyName;
            PlayerSettings.productName = ProductName;
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Android, DevelopmentApplicationIdentifier);

            // 세로 고정. BootRoot가 런타임에서도 같은 값을 세우지만 Player 기본값부터 맞춘다.
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.Portrait;
            PlayerSettings.allowedAutorotateToPortrait = true;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = false;
            PlayerSettings.allowedAutorotateToLandscapeRight = false;

            // ARM64 단독 + IL2CPP. #182 AC가 요구하는 조합이다.
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64;

            // 개발 APK는 stripping을 최소로 둔다. 배포 stripping 수준은 실측 후 별도 판정한다.
            PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.Android, ManagedStrippingLevel.Minimal);

            // 두 값 모두 명시 고정한다. 근거는 각 상수의 주석에 있다.
            PlayerSettings.Android.minSdkVersion = MinSdkVersion;
            PlayerSettings.Android.targetSdkVersion = TargetSdkVersion;

            // 개발 서명(Unity 디버그 keystore)만 쓴다. 개인 keystore·비밀번호를 저장소에 넣지 않는다.
            PlayerSettings.Android.useCustomKeystore = false;

            PlayerSettings.Android.forceInternetPermission = false;
            PlayerSettings.Android.forceSDCardPermission = false;

            AssetDatabase.SaveAssets();
            Debug.Log($"[DigitDuel.Editor] android player settings configured: id={DevelopmentApplicationIdentifier} " +
                      $"backend=IL2CPP arch=ARM64 minSdk={PlayerSettings.Android.minSdkVersion}");
        }
    }
}
