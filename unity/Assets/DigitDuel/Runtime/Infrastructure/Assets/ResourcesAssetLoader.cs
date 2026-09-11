using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using DigitDuel.Application.Assets;
using UnityEngine;

namespace DigitDuel.Infrastructure.Assets
{
    /// <summary>
    /// Resources 기반 <see cref="IAssetLoader"/> 구현.
    ///
    /// 선택 이유(#182 실측 근거):
    /// - 현재 요구는 앱에 동봉된 로컬 자산의 비동기 로드·해제뿐이다. 원격 콘텐츠 갱신·패치 요구가 아직 없다.
    /// - 참조 프로젝트(MyFundManager·audition_idol) 어느 쪽 manifest에도 Addressables 패키지와 완성된
    ///   빌드 파이프라인이 없어, 이식으로 얻을 검증된 기반이 없다.
    /// - Addressables는 그룹·빌드 산출물·CI 단계를 추가로 요구한다. 콘텐츠 갱신 요구가 생기기 전에는 비용만 남는다.
    ///
    /// 교체 경계: 호출부는 <see cref="IAssetLoader"/>/<see cref="IAssetHandle{T}"/>만 참조한다.
    /// Addressables로 옮길 때 이 클래스와 등록 지점만 바꾸면 되고, 이 판단은 영구적이지 않다.
    ///
    /// 키 단위: <b>경로 하나가 아니라 (경로, 요청 타입) 쌍</b>이 캐시·진행 중 요청의 키다.
    /// 백엔드 호출 <c>Resources.LoadAsync(path, type)</c> 자체가 타입별로 다른 결과를 주기 때문이다.
    /// 경로만으로 묶으면 같은 PNG에 대한 <c>Sprite</c> 요청과 <c>Texture2D</c> 요청이 서로를 밀어내고,
    /// 잘못된 타입의 동시 요청이 멀쩡한 요청까지 실패시킨다(#182에서 실제로 재현했다).
    ///
    /// 동시성: 같은 (경로, 타입) 을 동시에 요청하면 요청 하나를 공유한다(in-flight 공유).
    /// 메인 스레드 전용이며 사전은 잠금 없이 다룬다.
    ///
    /// 취소: 요청 자체는 Unity가 중간에 멈추지 못한다. <b>취소가 검증보다 앞선다</b> — 대기 중에 취소되면
    /// 자산이 없든 타입이 틀렸든 <see cref="OperationCanceledException"/>이다. 취소된 호출자는 핸들을
    /// 받지 않고, 그 로드 결과는 주인이 없으면 캐시에 남기지 않는다.
    ///
    /// 해제 의미(한계를 분명히 한다): Dispose는 참조 수를 줄이고 마지막 참조에서 캐시 항목을 버린다.
    /// 개별 자산에 <c>Resources.UnloadAsset</c>을 부르지는 않는다 — Sprite는 텍스처의 서브 자산이고
    /// SpriteAtlas에 묶이면 텍스처를 여러 스프라이트가 공유하므로 개별 언로드가 안전하지 않다.
    /// 실제 메모리 회수는 <see cref="UnloadUnusedAsync"/>(Resources.UnloadUnusedAssets)가 맡는다.
    /// Addressables로 옮기면 이 지점이 진짜 참조 계수 기반 언로드로 바뀐다.
    /// </summary>
    public sealed class ResourcesAssetLoader : IAssetLoader
    {
        /// <summary>캐시·진행 중 요청의 키. 경로만으로는 부족하다 — 클래스 주석의 "키 단위" 참고.</summary>
        private readonly struct AssetKey : IEquatable<AssetKey>
        {
            public readonly string Path;
            public readonly Type Type;

            public AssetKey(string path, Type type)
            {
                Path = path;
                Type = type;
            }

            public bool Equals(AssetKey other)
                => string.Equals(Path, other.Path, StringComparison.Ordinal) && Type == other.Type;

            public override bool Equals(object obj) => obj is AssetKey other && Equals(other);

            public override int GetHashCode()
                => unchecked((Path?.GetHashCode() ?? 0) * 397 ^ (Type?.GetHashCode() ?? 0));

            public override string ToString() => $"{Path} as {Type?.Name ?? "null"}";
        }

        private sealed class Entry
        {
            public UnityEngine.Object Asset;
            public int RefCount;
        }

        private sealed class Handle<T> : IAssetHandle<T> where T : class
        {
            private readonly ResourcesAssetLoader _owner;
            private readonly AssetKey _cacheKey;

            public Handle(ResourcesAssetLoader owner, AssetKey cacheKey, T value)
            {
                _owner = owner;
                _cacheKey = cacheKey;
                Value = value;
            }

            /// <summary>호출자가 넘긴 Resources 경로. 내부 캐시 키가 아니다.</summary>
            public string Key => _cacheKey.Path;

            public T Value { get; private set; }

            public bool IsReleased { get; private set; }

            public void Dispose()
            {
                if (IsReleased)
                {
                    return;
                }

                IsReleased = true;
                Value = null;
                _owner.Release(_cacheKey);
            }
        }

        private readonly Dictionary<AssetKey, Entry> _entries = new Dictionary<AssetKey, Entry>();

        /// <summary>진행 중인 Resources 요청. 같은 (경로, 타입) 의 두 번째 호출자는 이걸 기다린다.</summary>
        private readonly Dictionary<AssetKey, Task<UnityEngine.Object>> _inFlight =
            new Dictionary<AssetKey, Task<UnityEngine.Object>>();

        private int _liveHandleCount;

        public int LiveHandleCount => _liveHandleCount;

        /// <summary>현재 캐시된 (경로, 타입) 항목 수. 해제 검증용이며 게임 로직이 의존하지 않는다.</summary>
        public int CachedKeyCount => _entries.Count;

        /// <summary>진행 중인 로드 수. 취소·파괴 경로 검증용이다.</summary>
        public int InFlightCount => _inFlight.Count;

        public async Task<IAssetHandle<T>> LoadAsync<T>(string key, CancellationToken cancellationToken)
            where T : class
        {
            if (string.IsNullOrEmpty(key))
            {
                throw new ArgumentException("자산 키가 비어 있다.", nameof(key));
            }

            cancellationToken.ThrowIfCancellationRequested();

            var cacheKey = new AssetKey(key, typeof(T));

            if (TryAcquireCached<T>(cacheKey, out var cachedHandle))
            {
                return cachedHandle;
            }

            if (!_inFlight.TryGetValue(cacheKey, out var pending))
            {
                pending = LoadRawAsync(key, typeof(T));
                _inFlight[cacheKey] = pending;
            }

            UnityEngine.Object loaded;
            try
            {
                loaded = await pending;
            }
            finally
            {
                // 요청을 시작한 쪽이든 올라탄 쪽이든, 끝난 요청은 in-flight 목록에서 지운다.
                if (_inFlight.TryGetValue(cacheKey, out var current) && ReferenceEquals(current, pending))
                {
                    _inFlight.Remove(cacheKey);
                }
            }

            // 취소가 검증보다 앞선다. 대기 중에 취소됐다면 결과가 무엇이든 취소로 끝낸다.
            // 핸들을 만들지 않고 캐시에도 넣지 않으므로 주인 없는 자산이 남지 않는다.
            cancellationToken.ThrowIfCancellationRequested();

            if (loaded == null)
            {
                throw new AssetLoadException(key, $"Resources 에서 {typeof(T).Name} 을(를) 찾지 못했다");
            }

            if (!(loaded is T))
            {
                throw new AssetLoadException(key, $"타입 불일치: {loaded.GetType().Name} != {typeof(T).Name}");
            }

            // 기다리는 동안 다른 호출자가 먼저 캐시에 넣었을 수 있다. 항목은 키마다 하나만 만든다.
            if (TryAcquireCached<T>(cacheKey, out var raced))
            {
                return raced;
            }

            _entries[cacheKey] = new Entry { Asset = loaded, RefCount = 1 };
            _liveHandleCount++;
            return new Handle<T>(this, cacheKey, (T)(object)loaded);
        }

        /// <summary>
        /// 참조가 끊긴 자산의 실제 메모리 회수를 요청한다. 프레임을 소비하므로 화면 전환처럼
        /// 끊겨도 되는 시점에만 부른다.
        /// </summary>
        public async Task UnloadUnusedAsync(CancellationToken cancellationToken)
        {
            var operation = Resources.UnloadUnusedAssets();
            while (!operation.isDone)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await Task.Yield();
            }
        }

        private bool TryAcquireCached<T>(AssetKey cacheKey, out IAssetHandle<T> handle) where T : class
        {
            handle = null;
            if (!_entries.TryGetValue(cacheKey, out var entry))
            {
                return false;
            }

            // 키에 타입이 들어 있으므로 여기서 타입이 어긋날 수 없다. 어긋나면 캐시가 깨진 것이다.
            if (!(entry.Asset is T typed))
            {
                throw new AssetLoadException(
                    cacheKey.Path,
                    $"캐시 불변식 위반: {cacheKey} 항목이 {entry.Asset?.GetType().Name ?? "null"} 을 담고 있다");
            }

            entry.RefCount++;
            _liveHandleCount++;
            handle = new Handle<T>(this, cacheKey, typed);
            return true;
        }

        /// <summary>
        /// 타입을 넘기는 오버로드여야 한다. 타입 없는 Resources.LoadAsync 는 main asset(= Texture2D)만
        /// 돌려주므로 Sprite 같은 서브 자산은 항상 실패한다.
        /// </summary>
        private static async Task<UnityEngine.Object> LoadRawAsync(string path, Type type)
        {
            var request = Resources.LoadAsync(path, type);
            while (!request.isDone)
            {
                // 취소는 호출자별로 처리한다. Unity 요청 자체는 멈출 수 없으므로 여기서는 끝까지 기다린다.
                await Task.Yield();
            }

            return request.asset;
        }

        private void Release(AssetKey cacheKey)
        {
            if (!_entries.TryGetValue(cacheKey, out var entry))
            {
                return;
            }

            entry.RefCount--;
            _liveHandleCount--;

            if (entry.RefCount > 0)
            {
                return;
            }

            _entries.Remove(cacheKey);
            entry.Asset = null;
        }
    }
}
