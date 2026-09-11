using System;
using System.Linq;
using System.Reflection;
using NUnit.Framework;

namespace DigitDuel.Tests.EditMode
{
    /// <summary>
    /// asmdef 경계가 실제 컴파일 결과에서도 지켜지는지 확인한다. 설정 파일을 읽는 것이 아니라
    /// 로드된 assembly의 참조 목록을 본다 — 설정만 맞고 코드가 새는 경우를 잡는다.
    /// </summary>
    public sealed class AssemblyBoundaryTests
    {
        private static Assembly Load(string name)
        {
            var assembly = AppDomain.CurrentDomain.GetAssemblies()
                .FirstOrDefault(a => a.GetName().Name == name);
            Assert.IsNotNull(assembly, $"assembly [{name}] 를 찾지 못했다. asmdef 이름·컴파일 상태를 확인한다.");
            return assembly;
        }

        private static string[] ReferenceNames(Assembly assembly)
            => assembly.GetReferencedAssemblies().Select(a => a.Name).ToArray();

        [Test]
        public void Core_does_not_reference_engine_editor_ui_or_network()
        {
            var references = ReferenceNames(Load("DigitDuel.Core"));

            var forbidden = references.Where(name =>
                name.StartsWith("UnityEngine", StringComparison.Ordinal) ||
                name.StartsWith("UnityEditor", StringComparison.Ordinal) ||
                name.StartsWith("Unity.InputSystem", StringComparison.Ordinal) ||
                name.StartsWith("Unity.RenderPipelines", StringComparison.Ordinal) ||
                name.StartsWith("Grpc", StringComparison.Ordinal) ||
                name.StartsWith("Google.Protobuf", StringComparison.Ordinal) ||
                name.StartsWith("Newtonsoft", StringComparison.Ordinal)).ToArray();

            Assert.IsEmpty(forbidden,
                $"Core 는 순수 C# 이어야 한다. 금지된 참조: {string.Join(", ", forbidden)}");
        }

        [Test]
        public void Application_does_not_reference_engine_or_editor()
        {
            var references = ReferenceNames(Load("DigitDuel.Application"));

            var forbidden = references.Where(name =>
                name.StartsWith("UnityEngine", StringComparison.Ordinal) ||
                name.StartsWith("UnityEditor", StringComparison.Ordinal)).ToArray();

            Assert.IsEmpty(forbidden,
                $"Application 도 엔진에 묶이지 않는다. 금지된 참조: {string.Join(", ", forbidden)}");
        }

        [Test]
        public void Core_does_not_reference_application_or_outer_layers()
        {
            var references = ReferenceNames(Load("DigitDuel.Core"));

            var forbidden = references.Where(name =>
                name == "DigitDuel.Application" ||
                name == "DigitDuel.Presentation" ||
                name == "DigitDuel.Infrastructure" ||
                name == "DigitDuel.Editor").ToArray();

            Assert.IsEmpty(forbidden,
                $"의존 방향은 바깥에서 안쪽이다. 금지된 참조: {string.Join(", ", forbidden)}");
        }

        [Test]
        public void Application_does_not_reference_infrastructure_or_presentation()
        {
            var references = ReferenceNames(Load("DigitDuel.Application"));

            var forbidden = references.Where(name =>
                name == "DigitDuel.Presentation" ||
                name == "DigitDuel.Infrastructure" ||
                name == "DigitDuel.Editor").ToArray();

            Assert.IsEmpty(forbidden,
                $"Application 은 구현 계층을 모른다. 금지된 참조: {string.Join(", ", forbidden)}");
        }

        [Test]
        public void Runtime_assemblies_do_not_reference_editor_assembly()
        {
            foreach (var name in new[]
                     {
                         "DigitDuel.Core", "DigitDuel.Application",
                         "DigitDuel.Infrastructure", "DigitDuel.Presentation"
                     })
            {
                var references = ReferenceNames(Load(name));
                Assert.IsFalse(references.Contains("DigitDuel.Editor"),
                    $"{name} 이 DigitDuel.Editor 를 참조한다. Player 빌드가 깨진다.");
                Assert.IsFalse(references.Any(r => r.StartsWith("UnityEditor", StringComparison.Ordinal)),
                    $"{name} 이 UnityEditor 를 참조한다. Player 빌드가 깨진다.");
            }
        }
    }
}
