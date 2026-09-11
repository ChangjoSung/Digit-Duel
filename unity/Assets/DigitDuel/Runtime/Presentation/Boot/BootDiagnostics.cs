using UnityEngine;

namespace DigitDuel.Presentation.Boot
{
    /// <summary>
    /// 부팅 검증에서 관측한 값. 게임 상태가 아니라 #182 환경 검증 계측용이다.
    /// PlayMode 테스트와 기기 로그가 같은 값을 읽게 하려고 한 곳에 모았다.
    /// </summary>
    public sealed class BootDiagnostics
    {
        public static BootDiagnostics Current { get; internal set; }

        public int ScreenWidth { get; internal set; }

        public int ScreenHeight { get; internal set; }

        public ScreenOrientation Orientation { get; internal set; }

        public Rect SafeArea { get; internal set; }

        public bool SafeAreaApplied { get; internal set; }

        /// <summary>safe area 적용 후 패널이 차지한 앵커 사각형. 0..1 정규화 값이다.</summary>
        public Rect AppliedAnchorRect { get; internal set; }

        public int PauseEventCount { get; internal set; }

        public int ResumeEventCount { get; internal set; }

        public int FocusLostCount { get; internal set; }

        public int FocusGainedCount { get; internal set; }

        public int PointerPressCount { get; internal set; }

        public Vector2 LastPointerPosition { get; internal set; }

        public bool IsPortrait => ScreenHeight >= ScreenWidth;

        public override string ToString()
            => $"screen={ScreenWidth}x{ScreenHeight} orientation={Orientation} portrait={IsPortrait} " +
               $"safeArea={SafeArea} applied={SafeAreaApplied} anchors={AppliedAnchorRect} " +
               $"pause={PauseEventCount} resume={ResumeEventCount} focusLost={FocusLostCount} " +
               $"focusGained={FocusGainedCount} pointerPress={PointerPressCount}";
    }
}
