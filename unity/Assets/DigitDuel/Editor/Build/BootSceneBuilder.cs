using System.IO;
using System.Linq;
using DigitDuel.Presentation.Boot;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UI;

namespace DigitDuel.Editor.Build
{
    /// <summary>
    /// 최소 부팅 scene을 코드로 만든다. 손으로 편집한 YAML 대신 생성기를 두어 재현 가능하게 한다.
    /// 여기서 만드는 것은 세로·safe area·입력·복귀 확인용 최소 구성이며 게임 화면이 아니다.
    /// </summary>
    public static class BootSceneBuilder
    {
        [MenuItem("DigitDuel/Generate Boot Scene")]
        public static void Generate()
        {
            BootProbeAssetGenerator.Generate();

            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            CreateCamera();
            var (fitter, probeImage) = CreateCanvas();
            CreateBootRoot(fitter, probeImage);

            Directory.CreateDirectory(Path.GetDirectoryName(DigitDuelPaths.BootScene));
            EditorSceneManager.SaveScene(scene, DigitDuelPaths.BootScene);
            RegisterAsOnlyBuildScene();

            Debug.Log($"[DigitDuel.Editor] boot scene generated at {DigitDuelPaths.BootScene}");
        }

        private static void CreateCamera()
        {
            var cameraObject = new GameObject("Main Camera", typeof(Camera));
            cameraObject.tag = "MainCamera";
            var camera = cameraObject.GetComponent<Camera>();
            camera.orthographic = true;
            camera.orthographicSize = 5f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.06f, 0.07f, 0.12f, 1f);
            cameraObject.transform.position = new Vector3(0f, 0f, -10f);
        }

        private static (SafeAreaFitter fitter, Image probeImage) CreateCanvas()
        {
            var canvasObject = new GameObject("UI Canvas", typeof(Canvas), typeof(CanvasScaler));
            var canvas = canvasObject.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080f, 1920f); // 세로 기준
            scaler.screenMatchMode = CanvasScaler.ScreenMatchMode.MatchWidthOrHeight;
            scaler.matchWidthOrHeight = 1f;

            var safeAreaObject = new GameObject("SafeArea", typeof(RectTransform), typeof(SafeAreaFitter), typeof(Image));
            safeAreaObject.transform.SetParent(canvasObject.transform, false);
            var safeAreaImage = safeAreaObject.GetComponent<Image>();
            safeAreaImage.color = new Color(0.13f, 0.16f, 0.27f, 1f);

            var probeObject = new GameObject("AssetProbeImage", typeof(RectTransform), typeof(Image));
            probeObject.transform.SetParent(safeAreaObject.transform, false);
            var probeRect = probeObject.GetComponent<RectTransform>();
            probeRect.anchorMin = new Vector2(0.5f, 0.5f);
            probeRect.anchorMax = new Vector2(0.5f, 0.5f);
            probeRect.pivot = new Vector2(0.5f, 0.5f);
            probeRect.anchoredPosition = Vector2.zero;
            probeRect.sizeDelta = new Vector2(256f, 256f);
            var probeImage = probeObject.GetComponent<Image>();
            probeImage.enabled = false; // 로드 성공 시에만 켜져서 실패와 구분된다.

            return (safeAreaObject.GetComponent<SafeAreaFitter>(), probeImage);
        }

        private static void CreateBootRoot(SafeAreaFitter fitter, Image probeImage)
        {
            var bootObject = new GameObject("BootRoot", typeof(BootRoot), typeof(BootAssetProbe));
            bootObject.GetComponent<BootRoot>().SetSafeAreaFitter(fitter);
            bootObject.GetComponent<BootAssetProbe>().SetTarget(probeImage);
        }

        private static void RegisterAsOnlyBuildScene()
        {
            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(DigitDuelPaths.BootScene, true)
            };
        }

        /// <summary>빌드 대상 scene 목록. 빌드 명령과 PlayMode 테스트가 같은 값을 쓴다.</summary>
        public static string[] BuildScenes()
            => EditorBuildSettings.scenes.Where(s => s.enabled).Select(s => s.path).ToArray();
    }
}
