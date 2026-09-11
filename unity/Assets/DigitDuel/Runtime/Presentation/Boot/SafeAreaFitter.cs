using UnityEngine;

namespace DigitDuel.Presentation.Boot
{
    /// <summary>
    /// Screen.safeArea를 RectTransform 앵커로 옮긴다. 노치·제스처 바 영역을 피하기 위한 최소 구현이며
    /// 게임 UI 레이아웃 규격이 아니다. 화면 크기·safe area가 바뀌면 다시 적용한다.
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public sealed class SafeAreaFitter : MonoBehaviour
    {
        private RectTransform _rectTransform;
        private Rect _lastSafeArea;
        private int _lastScreenWidth;
        private int _lastScreenHeight;

        public Rect AppliedAnchorRect { get; private set; }

        public bool HasApplied { get; private set; }

        private void Awake()
        {
            _rectTransform = GetComponent<RectTransform>();
            Apply();
        }

        private void Update()
        {
            if (Screen.safeArea != _lastSafeArea ||
                Screen.width != _lastScreenWidth ||
                Screen.height != _lastScreenHeight)
            {
                Apply();
            }
        }

        /// <summary>즉시 재적용한다. 테스트에서 방향 전환 후 강제 갱신에 쓴다.</summary>
        public void Apply()
        {
            if (_rectTransform == null)
            {
                _rectTransform = GetComponent<RectTransform>();
            }

            var width = Screen.width;
            var height = Screen.height;
            if (width <= 0 || height <= 0)
            {
                return;
            }

            var safeArea = Screen.safeArea;
            var min = new Vector2(safeArea.xMin / width, safeArea.yMin / height);
            var max = new Vector2(safeArea.xMax / width, safeArea.yMax / height);

            _rectTransform.anchorMin = min;
            _rectTransform.anchorMax = max;
            _rectTransform.offsetMin = Vector2.zero;
            _rectTransform.offsetMax = Vector2.zero;

            AppliedAnchorRect = new Rect(min.x, min.y, max.x - min.x, max.y - min.y);
            HasApplied = true;

            _lastSafeArea = safeArea;
            _lastScreenWidth = width;
            _lastScreenHeight = height;
        }
    }
}
