using System.Collections;
using DigitDuel.Presentation.Boot;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.TestTools;

namespace DigitDuel.Tests.PlayMode
{
    /// <summary>
    /// 가상 입력 장치로 포인터 입력 경로를 확인한다. 모킹한 콜백이 아니라 Input System 이벤트를 실제로 흘려
    /// BootRoot 가 잡는지 본다. 실기 터치 확인은 APK 실행 로그가 별도 증거다.
    /// </summary>
    public sealed class BootInputTests : InputTestFixture
    {
        private GameObject _host;
        private BootRoot _bootRoot;

        public override void Setup()
        {
            base.Setup();
            _host = new GameObject("BootRootUnderTest", typeof(BootRoot));
            _bootRoot = _host.GetComponent<BootRoot>();
        }

        public override void TearDown()
        {
            if (_host != null)
            {
                Object.DestroyImmediate(_host);
            }

            base.TearDown();
        }

        [UnityTest]
        public IEnumerator Touch_press_is_counted_with_its_screen_position()
        {
            var touchscreen = InputSystem.AddDevice<Touchscreen>();
            yield return null;

            var before = _bootRoot.Diagnostics.PointerPressCount;

            BeginTouch(1, new Vector2(240f, 480f), screen: touchscreen);

            // action 콜백은 이벤트가 처리될 때 불리므로 프레임 순서에 덜 민감하다.
            // 그래도 정해진 프레임 수만 기다리고 무한 대기하지 않는다.
            for (var frame = 0; frame < 10 && _bootRoot.Diagnostics.PointerPressCount == before; frame++)
            {
                yield return null;
            }

            Assert.AreEqual(before + 1, _bootRoot.Diagnostics.PointerPressCount,
                "터치 입력이 BootRoot 에 도달하지 않았다.");
            Assert.AreEqual(240f, _bootRoot.Diagnostics.LastPointerPosition.x, 1f);
            Assert.AreEqual(480f, _bootRoot.Diagnostics.LastPointerPosition.y, 1f);

            Debug.Log($"[DigitDuel.Tests] touch press count={_bootRoot.Diagnostics.PointerPressCount} " +
                      $"pos={_bootRoot.Diagnostics.LastPointerPosition}");
        }

        [UnityTest]
        public IEnumerator Mouse_press_is_counted_for_editor_playmode_input()
        {
            var mouse = InputSystem.AddDevice<Mouse>();
            yield return null;

            var before = _bootRoot.Diagnostics.PointerPressCount;

            Set(mouse.position, new Vector2(100f, 200f));
            yield return null;
            Press(mouse.leftButton);
            yield return null;
            yield return null;

            Assert.AreEqual(before + 1, _bootRoot.Diagnostics.PointerPressCount,
                "마우스 입력이 BootRoot 에 도달하지 않았다.");

            Release(mouse.leftButton);
            yield return null;
        }
    }
}
