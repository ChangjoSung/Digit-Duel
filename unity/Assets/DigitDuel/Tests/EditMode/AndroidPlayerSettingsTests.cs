using System.IO;
using System.Linq;
using DigitDuel.Editor.Build;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.Build;

namespace DigitDuel.Tests.EditMode
{
    /// <summary>
    /// APK를 만들지 않고도 Android Player 설정 계약을 확인한다. 설정기를 호출한 뒤 실제 값을 읽는다.
    /// </summary>
    public sealed class AndroidPlayerSettingsTests
    {
        [OneTimeSetUp]
        public void Configure() => AndroidPlayerConfigurator.Configure();

        [Test]
        public void Scripting_backend_is_il2cpp_and_architecture_is_arm64_only()
        {
            Assert.AreEqual(ScriptingImplementation.IL2CPP,
                PlayerSettings.GetScriptingBackend(NamedBuildTarget.Android));
            Assert.AreEqual(AndroidArchitecture.ARM64, PlayerSettings.Android.targetArchitectures);
        }

        [Test]
        public void Orientation_is_portrait_only()
        {
            Assert.AreEqual(UIOrientation.Portrait, PlayerSettings.defaultInterfaceOrientation);
            Assert.IsFalse(PlayerSettings.allowedAutorotateToLandscapeLeft);
            Assert.IsFalse(PlayerSettings.allowedAutorotateToLandscapeRight);
            Assert.IsFalse(PlayerSettings.allowedAutorotateToPortraitUpsideDown);
        }

        [Test]
        public void Development_application_identifier_is_set()
        {
            Assert.AreEqual(AndroidPlayerConfigurator.DevelopmentApplicationIdentifier,
                PlayerSettings.GetApplicationIdentifier(NamedBuildTarget.Android));
            Assert.AreEqual(AndroidPlayerConfigurator.ProductName, PlayerSettings.productName);
            Assert.AreEqual(AndroidPlayerConfigurator.CompanyName, PlayerSettings.companyName);
        }

        [Test]
        public void Sdk_levels_are_pinned_explicitly_not_auto()
        {
            // Auto 는 설치된 SDK 목록에 따라 흔들려서 같은 소스가 다른 APK 를 낸다.
            Assert.AreNotEqual(AndroidSdkVersions.AndroidApiLevelAuto, PlayerSettings.Android.targetSdkVersion);
            Assert.AreEqual(AndroidPlayerConfigurator.TargetSdkVersion, PlayerSettings.Android.targetSdkVersion);
            Assert.AreEqual(AndroidPlayerConfigurator.MinSdkVersion, PlayerSettings.Android.minSdkVersion);
            Assert.LessOrEqual((int)PlayerSettings.Android.minSdkVersion,
                (int)PlayerSettings.Android.targetSdkVersion);
        }

        [Test]
        public void Target_sdk_platform_is_actually_installed()
        {
            // API 37 은 설치 폴더가 android-37.0 이라 Gradle 의 'android-37' 조회가 실패했다(#182 실측).
            // 고정한 target 의 플랫폼이 실제로 있는지 빌드 전에 확인한다.
            var sdkRoot = Path.Combine(
                BuildPipeline.GetPlaybackEngineDirectory(BuildTarget.Android, BuildOptions.None),
                "SDK", "platforms");
            var expected = Path.Combine(sdkRoot, $"android-{(int)AndroidPlayerConfigurator.TargetSdkVersion}");

            Assert.IsTrue(Directory.Exists(sdkRoot), $"Android SDK platforms 폴더가 없다: {sdkRoot}");
            Assert.IsTrue(Directory.Exists(expected),
                $"target SDK 플랫폼이 설치돼 있지 않다: {expected}. 설치된 목록: " +
                string.Join(", ", Directory.GetDirectories(sdkRoot).Select(Path.GetFileName)));
        }

        [Test]
        public void Custom_keystore_is_not_used_so_no_private_key_is_tracked()
        {
            Assert.IsFalse(PlayerSettings.Android.useCustomKeystore,
                "개발 빌드는 Unity 디버그 서명을 쓴다. 개인 keystore 를 저장소가 추적하면 안 된다.");
        }

        [Test]
        public void Boot_scene_is_the_only_enabled_build_scene()
        {
            var scenes = BootSceneBuilder.BuildScenes();
            Assert.AreEqual(1, scenes.Length, "최소 부팅 검증은 scene 1개만 빌드한다.");
            Assert.AreEqual(DigitDuelPaths.BootScene, scenes[0]);
        }
    }
}
