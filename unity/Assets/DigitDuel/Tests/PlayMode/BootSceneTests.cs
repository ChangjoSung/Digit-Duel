using System.Collections;
using DigitDuel.Presentation.Boot;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using UnityEngine.UI;

namespace DigitDuel.Tests.PlayMode
{
    /// <summary>
    /// 빌드에 들어가는 부팅 scene을 실제로 로드해 세로·safe area·자산 표시·일시정지 복귀를 확인한다.
    /// 에디터에서 도는 검증이며 실기 동작 증거를 대체하지 않는다 — 기기 확인은 APK 설치·실행 로그가 원본이다.
    /// </summary>
    public sealed class BootSceneTests
    {
        private const string BootScenePath = "Assets/DigitDuel/Scenes/Boot.unity";

        private BootRoot _bootRoot;
        private BootAssetProbe _probe;

        [UnitySetUp]
        public IEnumerator LoadBootScene()
        {
            yield return SceneManager.LoadSceneAsync(BootScenePath, LoadSceneMode.Single);
            yield return null;

            _bootRoot = Object.FindFirstObjectByType<BootRoot>();
            _probe = Object.FindFirstObjectByType<BootAssetProbe>();

            Assert.IsNotNull(_bootRoot, "부팅 scene 에 BootRoot 가 없다.");
            Assert.IsNotNull(_probe, "부팅 scene 에 BootAssetProbe 가 없다.");
        }

        [UnityTest]
        public IEnumerator Boot_scene_reports_portrait_and_applied_safe_area()
        {
            _bootRoot.Capture();
            var diagnostics = _bootRoot.Diagnostics;

            Assert.IsTrue(diagnostics.SafeAreaApplied, "safe area 가 적용되지 않았다.");

            var anchors = diagnostics.AppliedAnchorRect;
            Assert.Greater(anchors.width, 0f, "safe area 앵커 폭이 0 이다.");
            Assert.Greater(anchors.height, 0f, "safe area 앵커 높이가 0 이다.");
            Assert.LessOrEqual(anchors.xMax, 1.0001f);
            Assert.LessOrEqual(anchors.yMax, 1.0001f);
            Assert.GreaterOrEqual(anchors.xMin, -0.0001f);
            Assert.GreaterOrEqual(anchors.yMin, -0.0001f);

            Debug.Log($"[DigitDuel.Tests] boot diagnostics {diagnostics}");
            yield return null;
        }

        [UnityTest]
        public IEnumerator Safe_area_panel_fills_the_safe_rect_exactly()
        {
            var fitter = Object.FindFirstObjectByType<SafeAreaFitter>();
            Assert.IsNotNull(fitter);

            var rect = fitter.GetComponent<RectTransform>();
            var expectedMin = new Vector2(Screen.safeArea.xMin / Screen.width, Screen.safeArea.yMin / Screen.height);
            var expectedMax = new Vector2(Screen.safeArea.xMax / Screen.width, Screen.safeArea.yMax / Screen.height);

            Assert.AreEqual(expectedMin.x, rect.anchorMin.x, 0.0005f);
            Assert.AreEqual(expectedMin.y, rect.anchorMin.y, 0.0005f);
            Assert.AreEqual(expectedMax.x, rect.anchorMax.x, 0.0005f);
            Assert.AreEqual(expectedMax.y, rect.anchorMax.y, 0.0005f);
            Assert.AreEqual(Vector2.zero, rect.offsetMin);
            Assert.AreEqual(Vector2.zero, rect.offsetMax);
            yield return null;
        }

        [UnityTest]
        public IEnumerator Boot_scene_loads_and_displays_the_probe_asset()
        {
            // 비동기 로드가 끝날 때까지 몇 프레임 기다린다. 무한 대기하지 않는다.
            for (var frame = 0; frame < 300 && !_probe.LoadSucceeded && _probe.LoadError == null; frame++)
            {
                yield return null;
            }

            Assert.IsNull(_probe.LoadError, $"자산 로드 실패: {_probe.LoadError}");
            Assert.IsTrue(_probe.LoadSucceeded, "자산 로드가 제한 프레임 안에 끝나지 않았다.");
            Assert.AreEqual("BootProbeSprite", _probe.LoadedSpriteName);

            // 표시 대상은 Canvas 아래에 있고 probe 의 자식이 아니다. 직렬화된 참조로 확인한다.
            var image = _probe.Target;
            Assert.IsNotNull(image, "BootAssetProbe 의 표시 대상 Image 참조가 비어 있다.");
            Assert.IsTrue(image.enabled, "로드에 성공했는데 표시 Image 가 꺼져 있다.");
            Assert.IsNotNull(image.sprite, "표시 Image 에 스프라이트가 들어가지 않았다.");
            Assert.AreEqual("BootProbeSprite", image.sprite.name);
            Assert.AreEqual(1, _probe.LiveHandleCount, "표시 중에는 핸들 1개를 들고 있어야 한다.");

            Debug.Log($"[DigitDuel.Tests] probe sprite={_probe.LoadedSpriteName} texture={_probe.LoadedTextureName}");
        }

        [UnityTest]
        public IEnumerator Destroying_probe_while_loading_leaves_no_live_handle()
        {
            // 로드가 끝나기 전에 파괴한다. 늦게 도착한 핸들을 놓치면 핸들이 영구히 남는다.
            var host = new GameObject("InFlightProbe", typeof(BootAssetProbe));
            var probe = host.GetComponent<BootAssetProbe>();

            // 결정적 체크포인트: 요청이 실제로 "진행 중"인 것을 확인한 뒤에만 파괴한다.
            // 이게 없으면 로드가 이미 끝난 뒤 파괴해 놓고 통과했다고 착각할 수 있다.
            var startedInFlight = false;
            for (var frame = 0; frame < 120 && !startedInFlight && !probe.HasSettled; frame++)
            {
                yield return null;
                startedInFlight = probe.InFlightCount > 0;
            }

            Assert.IsTrue(startedInFlight,
                $"진행 중인 요청을 잡지 못했다(settled={probe.HasSettled}). 이 조건이 없으면 이 검사는 무의미하다.");

            Object.DestroyImmediate(host);

            // 유계 대기: 늦은 continuation 이 취소로 정산될 때까지.
            for (var frame = 0; frame < 300 && !probe.HasSettled; frame++)
            {
                yield return null;
            }

            Assert.IsTrue(probe.HasSettled, "파괴 후에도 로드가 정산되지 않았다(영구 대기).");
            Assert.IsTrue(probe.LoadCancelled, "진행 중 파괴는 취소로 정산돼야 한다.");
            Assert.IsFalse(probe.LoadSucceeded, "파괴된 probe 가 자산을 계속 붙들고 있다.");
            Assert.IsNull(probe.LoadError, $"취소는 오류가 아니어야 한다: {probe.LoadError}");
            Assert.AreEqual(0, probe.LiveHandleCount, "파괴 후 살아 있는 핸들이 남았다.");
            Assert.AreEqual(0, probe.InFlightCount, "끝난 요청이 in-flight 목록에 남았다.");
        }

        [UnityTest]
        public IEnumerator Unloading_the_boot_scene_releases_the_probe_handle()
        {
            for (var frame = 0; frame < 300 && !_probe.LoadSucceeded && _probe.LoadError == null; frame++)
            {
                yield return null;
            }

            Assert.IsTrue(_probe.LoadSucceeded);
            Assert.AreEqual(1, _probe.LiveHandleCount);

            var probe = _probe;
            yield return SceneManager.LoadSceneAsync(BootScenePath, LoadSceneMode.Single);
            yield return null;

            // 이전 씬의 probe 인스턴스는 파괴됐고 OnDestroy 에서 핸들을 돌려줬어야 한다.
            Assert.AreEqual(0, probe.LiveHandleCount, "씬 전환 후 이전 probe 의 핸들이 남았다.");
        }

        [UnityTest]
        public IEnumerator Pause_and_resume_are_observed_and_reapply_safe_area()
        {
            var diagnostics = _bootRoot.Diagnostics;
            var pauseBefore = diagnostics.PauseEventCount;
            var resumeBefore = diagnostics.ResumeEventCount;

            // OnApplicationPause 는 에디터에서 자동으로 오지 않는다. 실제 핸들러를 직접 호출해
            // 복귀 경로(safe area 재적용·계측 증가)가 동작하는지 본다. 기기 실측은 별도 증거다.
            _bootRoot.SendMessage("OnApplicationPause", true, SendMessageOptions.DontRequireReceiver);
            yield return null;
            _bootRoot.SendMessage("OnApplicationPause", false, SendMessageOptions.DontRequireReceiver);
            yield return null;

            Assert.AreEqual(pauseBefore + 1, diagnostics.PauseEventCount);
            Assert.AreEqual(resumeBefore + 1, diagnostics.ResumeEventCount);
            Assert.IsTrue(diagnostics.SafeAreaApplied, "복귀 후 safe area 가 다시 적용되지 않았다.");
        }

        [UnityTest]
        public IEnumerator Focus_changes_are_observed()
        {
            var diagnostics = _bootRoot.Diagnostics;
            var lostBefore = diagnostics.FocusLostCount;
            var gainedBefore = diagnostics.FocusGainedCount;

            _bootRoot.SendMessage("OnApplicationFocus", false, SendMessageOptions.DontRequireReceiver);
            yield return null;
            _bootRoot.SendMessage("OnApplicationFocus", true, SendMessageOptions.DontRequireReceiver);
            yield return null;

            Assert.AreEqual(lostBefore + 1, diagnostics.FocusLostCount);
            Assert.AreEqual(gainedBefore + 1, diagnostics.FocusGainedCount);
        }
    }
}
