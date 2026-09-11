using System;
using System.Threading;
using DigitDuel.Application.Assets;
using DigitDuel.Infrastructure.Assets;
using UnityEngine;
using UnityEngine.UI;

namespace DigitDuel.Presentation.Boot
{
    /// <summary>
    /// 부팅 시 로컬 자산 1개를 비동기로 로드해 화면에 띄운다. 실기에서 자산 로드·Atlas 바인딩을 눈으로 보기 위한
    /// 최소 검증이며 게임 아트 파이프라인이 아니다. 수명(해제) 검증은 PlayMode 테스트가 담당한다.
    ///
    /// 수명 계약: 로드 요청은 이 컴포넌트의 수명에 묶인다. 완료 전에 파괴되면 요청을 취소하고,
    /// 그래도 늦게 도착한 핸들은 즉시 해제한다 — 취소는 정상 경로이므로 오류로 기록하지 않는다.
    /// </summary>
    public sealed class BootAssetProbe : MonoBehaviour
    {
        /// <summary>Resources 하위 키. 확장자를 쓰지 않는다.</summary>
        public const string ProbeSpriteKey = "BootProbe/BootProbeSprite";

        [SerializeField]
        private Image _target;

        private readonly ResourcesAssetLoader _loader = new ResourcesAssetLoader();
        private readonly CancellationTokenSource _lifetime = new CancellationTokenSource();

        private IAssetHandle<Sprite> _handle;
        private bool _destroyed;

        public bool LoadSucceeded { get; private set; }

        public bool LoadCancelled { get; private set; }

        public string LoadedSpriteName { get; private set; }

        /// <summary>런타임에 실제로 쓰인 텍스처 이름. Atlas에 묶이면 아틀라스 텍스처 이름이 나온다.</summary>
        public string LoadedTextureName { get; private set; }

        public string LoadError { get; private set; }

        /// <summary>로더가 들고 있는 살아 있는 핸들 수. 누수 검증용이다.</summary>
        public int LiveHandleCount => _loader.LiveHandleCount;

        /// <summary>진행 중인 로드 수. 테스트가 "아직 안 끝난 상태"를 결정적으로 잡는 데 쓴다.</summary>
        public int InFlightCount => _loader.InFlightCount;

        /// <summary>로드 시도가 성공·취소·실패 중 하나로 끝났는지. 테스트의 유계 대기 조건이다.</summary>
        public bool HasSettled => LoadSucceeded || LoadCancelled || LoadError != null;

        /// <summary>생성기가 참조를 채울 때 쓴다.</summary>
        public void SetTarget(Image target) => _target = target;

        /// <summary>표시 대상 Image. 테스트가 화면 반영을 확인할 때 쓴다.</summary>
        public Image Target => _target;

        private async void Start()
        {
            IAssetHandle<Sprite> handle = null;
            try
            {
                handle = await _loader.LoadAsync<Sprite>(ProbeSpriteKey, _lifetime.Token);

                if (_destroyed)
                {
                    // 늦게 도착했다. 주인이 없으므로 즉시 돌려준다.
                    handle.Dispose();
                    LoadCancelled = true;
                    return;
                }

                _handle = handle;
                LoadSucceeded = true;
                LoadedSpriteName = _handle.Value.name;
                LoadedTextureName = _handle.Value.texture != null ? _handle.Value.texture.name : "(null)";

                if (_target != null)
                {
                    _target.sprite = _handle.Value;
                    _target.enabled = true;
                }

                Debug.Log($"{BootRoot.LogTag} asset loaded key={ProbeSpriteKey} sprite={LoadedSpriteName} " +
                          $"texture={LoadedTextureName} liveHandles={_loader.LiveHandleCount}");
            }
            catch (OperationCanceledException)
            {
                // 파괴·씬 전환으로 인한 취소는 정상이다. 오류 로그를 남기지 않는다.
                handle?.Dispose();
                LoadCancelled = true;
                Debug.Log($"{BootRoot.LogTag} asset load cancelled key={ProbeSpriteKey} " +
                          $"liveHandles={_loader.LiveHandleCount}");
            }
            catch (Exception ex)
            {
                handle?.Dispose();
                LoadError = ex.Message;
                Debug.LogError($"{BootRoot.LogTag} asset load failed key={ProbeSpriteKey}: {ex.Message}");
            }
        }

        private void OnDestroy()
        {
            _destroyed = true;

            if (!_lifetime.IsCancellationRequested)
            {
                _lifetime.Cancel();
            }

            _handle?.Dispose();
            _handle = null;
            _lifetime.Dispose();

            Debug.Log($"{BootRoot.LogTag} asset probe destroyed liveHandles={_loader.LiveHandleCount}");
        }
    }
}
