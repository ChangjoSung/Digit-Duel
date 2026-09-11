using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace DigitDuel.Editor.Build
{
    /// <summary>
    /// 재현 가능한 Android 개발 APK 빌드. 메뉴와 CLI(-executeMethod)가 같은 경로를 탄다.
    ///
    ///   Unity.exe -quit -batchmode -nographics -buildTarget Android \
    ///     -projectPath &lt;repo&gt;/unity \
    ///     -executeMethod DigitDuel.Editor.Build.AndroidBuildCommand.BuildDevelopmentApk \
    ///     -logFile &lt;log&gt;
    ///
    /// 배치에서는 반드시 명령줄 <c>-buildTarget Android</c> 로 시작한다. executeMethod 안의
    /// SwitchActiveBuildTarget 은 도메인 리로드를 동반하므로 배치 시작 시점의 타깃 지정을 대신할 수 없다.
    /// 아래 전환 코드는 에디터 메뉴에서 수동 실행할 때를 위한 대비책이다.
    /// </summary>
    public static class AndroidBuildCommand
    {
        [MenuItem("DigitDuel/Build Android Development APK")]
        public static void BuildDevelopmentApkMenu() => BuildDevelopmentApk();

        public static void BuildDevelopmentApk()
        {
            var exitCode = 0;
            try
            {
                AndroidPlayerConfigurator.Configure();

                var scenes = BootSceneBuilder.BuildScenes();
                if (scenes.Length == 0)
                {
                    throw new InvalidOperationException(
                        "빌드 대상 scene이 없다. DigitDuel/Generate Boot Scene 을 먼저 실행한다.");
                }

                foreach (var scene in scenes)
                {
                    if (!File.Exists(scene))
                    {
                        throw new FileNotFoundException($"빌드 대상 scene 파일이 없다: {scene}");
                    }
                }

                if (EditorUserBuildSettings.activeBuildTarget != BuildTarget.Android)
                {
                    if (!EditorUserBuildSettings.SwitchActiveBuildTarget(
                            BuildTargetGroup.Android, BuildTarget.Android))
                    {
                        throw new InvalidOperationException(
                            "Android 빌드 타깃으로 전환하지 못했다. Android Build Support 모듈 설치를 확인한다.");
                    }
                }

                var outputPath = Path.Combine(Directory.GetCurrentDirectory(), DigitDuelPaths.AndroidApkRelative);
                Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
                if (File.Exists(outputPath))
                {
                    File.Delete(outputPath);
                }

                EditorUserBuildSettings.buildAppBundle = false;
                EditorUserBuildSettings.exportAsGoogleAndroidProject = false;
                EditorUserBuildSettings.androidBuildType = AndroidBuildType.Development;

                var options = new BuildPlayerOptions
                {
                    scenes = scenes,
                    locationPathName = outputPath,
                    target = BuildTarget.Android,
                    targetGroup = BuildTargetGroup.Android,
                    // 테스트 assembly는 포함하지 않는다 (IncludeTestAssemblies 미설정).
                    options = BuildOptions.Development | BuildOptions.AllowDebugging
                };

                Debug.Log($"[DigitDuel.Editor] build start scenes=[{string.Join(", ", scenes)}] output={outputPath}");

                var report = BuildPipeline.BuildPlayer(options);
                var summary = report.summary;

                Debug.Log($"[DigitDuel.Editor] build result={summary.result} " +
                          $"sizeBytes={summary.totalSize} duration={summary.totalTime} " +
                          $"errors={summary.totalErrors} warnings={summary.totalWarnings} output={summary.outputPath}");

                if (summary.result != BuildResult.Succeeded)
                {
                    foreach (var step in report.steps)
                    {
                        foreach (var message in step.messages.Where(m =>
                                     m.type == LogType.Error || m.type == LogType.Exception))
                        {
                            Debug.LogError($"[DigitDuel.Editor] build error [{step.name}] {message.content}");
                        }
                    }

                    exitCode = 1;
                }
                else if (!File.Exists(outputPath))
                {
                    Debug.LogError($"[DigitDuel.Editor] build reported success but APK is missing: {outputPath}");
                    exitCode = 1;
                }
                else
                {
                    var length = new FileInfo(outputPath).Length;
                    Debug.Log($"[DigitDuel.Editor] APK OK path={DigitDuelPaths.AndroidApkRelative} bytes={length}");
                }
            }
            catch (Exception ex)
            {
                Debug.LogError($"[DigitDuel.Editor] build threw: {ex}");
                exitCode = 1;
            }

            if (UnityEditorInternal.InternalEditorUtility.inBatchMode)
            {
                EditorApplication.Exit(exitCode);
            }
        }
    }
}
