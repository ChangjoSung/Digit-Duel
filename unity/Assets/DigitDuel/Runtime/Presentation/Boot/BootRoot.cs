using UnityEngine;
using UnityEngine.InputSystem;

namespace DigitDuel.Presentation.Boot
{
    /// <summary>
    /// 최소 부팅 진입점. Android 세로 고정·safe area·포인터 입력·일시정지/복귀만 확인한다.
    /// 게임 화면·튜토리얼·아트는 #187 범위이며 이 컴포넌트가 대체하지 않는다.
    /// </summary>
    public sealed class BootRoot : MonoBehaviour
    {
        public const string LogTag = "[DigitDuel.Boot]";

        [SerializeField]
        private SafeAreaFitter _safeAreaFitter;

        [SerializeField]
        private bool _lockPortrait = true;

        private BootDiagnostics _diagnostics;
        private InputAction _pressAction;

        public BootDiagnostics Diagnostics => _diagnostics;

        private void Awake()
        {
            _diagnostics = new BootDiagnostics();
            BootDiagnostics.Current = _diagnostics;

            if (_lockPortrait)
            {
                LockToPortrait();
            }

            // 프레임 플래그(wasPressedThisFrame) 폴링은 입력 갱신과 Update 의 순서에 따라 눌림을 통째로
            // 놓친다(#182 실측: 터치는 놓치고 마우스는 잡혔다). 이벤트가 처리될 때 불리는 action 콜백을 쓴다.
            _pressAction = new InputAction("BootPointerPress", InputActionType.Button, "<Pointer>/press");
            _pressAction.performed += OnPointerPressed;

            Capture();
            Debug.Log($"{LogTag} awake {_diagnostics}");
        }

        private void OnEnable() => _pressAction?.Enable();

        private void OnDisable() => _pressAction?.Disable();

        private void OnDestroy()
        {
            if (_pressAction == null)
            {
                return;
            }

            _pressAction.performed -= OnPointerPressed;
            _pressAction.Dispose();
            _pressAction = null;
        }

        private void OnPointerPressed(InputAction.CallbackContext context)
        {
            _diagnostics.PointerPressCount++;

            if (context.control?.device is Pointer pointer)
            {
                _diagnostics.LastPointerPosition = pointer.position.ReadValue();
            }

            Debug.Log($"{LogTag} pointer press #{_diagnostics.PointerPressCount} " +
                      $"at {_diagnostics.LastPointerPosition} device={context.control?.device.name ?? "(unknown)"}");
        }

        private void Start()
        {
            if (_safeAreaFitter != null)
            {
                _safeAreaFitter.Apply();
            }

            Capture();
            Debug.Log($"{LogTag} start {_diagnostics}");
        }

        private static void LockToPortrait()
        {
            // 자동 회전 후보를 먼저 좁히지 않으면 Android에서 orientation 설정이 되돌아온다.
            Screen.autorotateToPortrait = true;
            Screen.autorotateToPortraitUpsideDown = false;
            Screen.autorotateToLandscapeLeft = false;
            Screen.autorotateToLandscapeRight = false;
            Screen.orientation = ScreenOrientation.Portrait;
        }

        private void OnApplicationPause(bool paused)
        {
            if (paused)
            {
                _diagnostics.PauseEventCount++;
            }
            else
            {
                _diagnostics.ResumeEventCount++;
                if (_safeAreaFitter != null)
                {
                    _safeAreaFitter.Apply();
                }
            }

            Capture();
            Debug.Log($"{LogTag} pause={paused} {_diagnostics}");
        }

        private void OnApplicationFocus(bool focused)
        {
            if (focused)
            {
                _diagnostics.FocusGainedCount++;
            }
            else
            {
                _diagnostics.FocusLostCount++;
            }

            Debug.Log($"{LogTag} focus={focused} focusGained={_diagnostics.FocusGainedCount} focusLost={_diagnostics.FocusLostCount}");
        }

        /// <summary>현재 화면 상태를 계측값에 반영한다. 테스트가 명시적으로 호출할 수 있다.</summary>
        public void Capture()
        {
            _diagnostics.ScreenWidth = Screen.width;
            _diagnostics.ScreenHeight = Screen.height;
            _diagnostics.Orientation = Screen.orientation;
            _diagnostics.SafeArea = Screen.safeArea;
            _diagnostics.SafeAreaApplied = _safeAreaFitter != null && _safeAreaFitter.HasApplied;
            _diagnostics.AppliedAnchorRect = _safeAreaFitter != null ? _safeAreaFitter.AppliedAnchorRect : default;
        }

        /// <summary>에디터 생성 스크립트가 참조를 채울 때 쓴다.</summary>
        public void SetSafeAreaFitter(SafeAreaFitter fitter) => _safeAreaFitter = fitter;
    }
}
