using System;
using System.Collections;
using System.Threading;
using System.Threading.Tasks;
using DigitDuel.Application.Assets;
using DigitDuel.Infrastructure.Assets;
using DigitDuel.Presentation.Boot;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;

namespace DigitDuel.Tests.PlayMode
{
    /// <summary>
    /// 자산 로더의 실제 비동기 로드·실패·해제 수명을 확인한다. 인터페이스 모킹이 아니라
    /// 진짜 Resources 자산으로 돌린다 — 기기에서만 나타나는 경로/키 오류를 여기서 잡기 위해서다.
    /// </summary>
    public sealed class AssetLoaderLifetimeTests
    {
        private const string MissingKey = "BootProbe/__does_not_exist__";

        private static IEnumerator Await(Task task)
        {
            while (!task.IsCompleted)
            {
                yield return null;
            }
        }

        private static void AssertCancelled<T>(Task<T> task, string because)
        {
            // "실패했다"로는 부족하다. 취소가 자산 없음·타입 불일치보다 앞선다는 계약을 확인한다.
            if (task.IsCanceled)
            {
                return;
            }

            Assert.IsTrue(task.IsFaulted, because);
            Assert.IsInstanceOf<OperationCanceledException>(task.Exception.InnerException,
                $"{because} 실제 예외: {task.Exception.InnerException}");
        }

        [UnityTest]
        public IEnumerator Loads_sprite_asynchronously_then_releases_it()
        {
            var loader = new ResourcesAssetLoader();
            Assert.AreEqual(0, loader.LiveHandleCount);

            var task = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            yield return Await(task);

            Assert.IsFalse(task.IsFaulted, task.Exception?.ToString());
            var handle = task.Result;

            Assert.IsNotNull(handle.Value, "스프라이트를 로드하지 못했다.");
            Assert.AreEqual(BootAssetProbe.ProbeSpriteKey, handle.Key);
            Assert.IsFalse(handle.IsReleased);
            Assert.AreEqual(1, loader.LiveHandleCount);
            Assert.AreEqual(1, loader.CachedKeyCount);

            Debug.Log($"[DigitDuel.Tests] loaded sprite={handle.Value.name} texture={handle.Value.texture?.name}");

            handle.Dispose();

            Assert.IsTrue(handle.IsReleased);
            Assert.AreEqual(0, loader.LiveHandleCount, "해제 후 살아 있는 핸들이 남았다.");
            Assert.AreEqual(0, loader.CachedKeyCount, "해제 후 캐시 항목이 남았다.");
        }

        [UnityTest]
        public IEnumerator Second_load_shares_one_cache_entry_and_needs_two_releases()
        {
            var loader = new ResourcesAssetLoader();

            var first = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            yield return Await(first);
            var second = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            yield return Await(second);

            Assert.AreEqual(2, loader.LiveHandleCount);
            Assert.AreEqual(1, loader.CachedKeyCount, "같은 키는 자산을 한 번만 들고 있어야 한다.");
            Assert.AreSame(first.Result.Value, second.Result.Value);

            first.Result.Dispose();
            Assert.AreEqual(1, loader.CachedKeyCount, "참조가 남아 있는데 자산을 버렸다.");

            second.Result.Dispose();
            Assert.AreEqual(0, loader.CachedKeyCount);
            Assert.AreEqual(0, loader.LiveHandleCount);
        }

        [UnityTest]
        public IEnumerator Double_dispose_is_idempotent()
        {
            var loader = new ResourcesAssetLoader();
            var task = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            yield return Await(task);

            var handle = task.Result;
            handle.Dispose();
            handle.Dispose();

            Assert.AreEqual(0, loader.LiveHandleCount, "중복 Dispose 가 참조 수를 음수로 만들면 안 된다.");
        }

        [UnityTest]
        public IEnumerator Missing_key_fails_with_asset_load_exception()
        {
            var loader = new ResourcesAssetLoader();
            var task = loader.LoadAsync<Sprite>(MissingKey, CancellationToken.None);
            yield return Await(task);

            Assert.IsTrue(task.IsFaulted, "없는 키가 성공으로 돌아왔다.");
            Assert.IsInstanceOf<AssetLoadException>(task.Exception.InnerException);
            Assert.AreEqual(0, loader.LiveHandleCount, "실패한 로드가 핸들을 남겼다.");
        }

        [UnityTest]
        public IEnumerator Wrong_type_fails_instead_of_returning_null()
        {
            var loader = new ResourcesAssetLoader();
            var task = loader.LoadAsync<AudioClip>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            yield return Await(task);

            Assert.IsTrue(task.IsFaulted, "타입이 다른 로드가 성공으로 돌아왔다.");
            Assert.IsInstanceOf<AssetLoadException>(task.Exception.InnerException);
            Assert.AreEqual(0, loader.LiveHandleCount);
        }

        [UnityTest]
        public IEnumerator Concurrent_invalid_and_valid_type_at_same_path_do_not_poison_each_other()
        {
            // 경로만으로 요청을 묶으면 먼저 출발한 AudioClip 요청(실패)에 Sprite 요청이 올라타
            // 멀쩡한 호출자까지 실패한다. 키는 (경로, 타입) 이어야 한다.
            var loader = new ResourcesAssetLoader();

            var invalid = loader.LoadAsync<AudioClip>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            var valid = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);

            Assert.AreEqual(2, loader.InFlightCount, "타입이 다른 요청이 같은 요청을 공유했다.");

            yield return Await(invalid);
            yield return Await(valid);

            Assert.IsTrue(invalid.IsFaulted, "AudioClip 요청이 실패해야 한다.");
            Assert.IsInstanceOf<AssetLoadException>(invalid.Exception.InnerException);

            Assert.IsTrue(valid.IsCompletedSuccessfully,
                $"잘못된 타입의 동시 요청이 멀쩡한 Sprite 요청까지 실패시켰다: {valid.Exception?.InnerException}");
            Assert.IsNotNull(valid.Result.Value);
            Assert.AreEqual(1, loader.LiveHandleCount, "실패한 요청이 핸들을 남겼다.");
            Assert.AreEqual(1, loader.CachedKeyCount);

            valid.Result.Dispose();
            Assert.AreEqual(0, loader.LiveHandleCount);
            Assert.AreEqual(0, loader.CachedKeyCount);
        }

        [UnityTest]
        public IEnumerator Sprite_and_texture_at_same_path_coexist_as_separate_entries()
        {
            // 같은 PNG 를 Sprite 로도 Texture2D 로도 쓸 수 있다. 경로만 키로 쓰면 서로를 밀어낸다.
            var loader = new ResourcesAssetLoader();

            var spriteTask = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            yield return Await(spriteTask);
            var textureTask = loader.LoadAsync<Texture2D>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            yield return Await(textureTask);

            Assert.IsTrue(spriteTask.IsCompletedSuccessfully, spriteTask.Exception?.ToString());
            Assert.IsTrue(textureTask.IsCompletedSuccessfully,
                $"같은 경로의 Texture2D 로드가 캐시된 Sprite 와 충돌했다: {textureTask.Exception?.InnerException}");

            Assert.AreEqual(2, loader.CachedKeyCount, "타입이 다르면 캐시 항목도 따로여야 한다.");
            Assert.AreEqual(2, loader.LiveHandleCount);

            spriteTask.Result.Dispose();
            Assert.IsNotNull(textureTask.Result.Value, "Sprite 해제가 Texture2D 항목까지 버렸다.");
            Assert.AreEqual(1, loader.CachedKeyCount);

            textureTask.Result.Dispose();
            Assert.AreEqual(0, loader.CachedKeyCount);
            Assert.AreEqual(0, loader.LiveHandleCount);
        }

        [UnityTest]
        public IEnumerator Two_concurrent_loads_of_the_same_key_share_one_cache_entry()
        {
            // 두 요청이 모두 캐시 miss 인 상태로 동시에 출발한다. 항목을 각자 만들면 참조 수가 어긋나
            // 한쪽 해제가 살아 있는 다른 핸들의 자산을 버린다.
            var loader = new ResourcesAssetLoader();

            var first = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            var second = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);

            Assert.AreEqual(1, loader.InFlightCount, "같은 키로 Resources 요청이 두 번 나갔다.");

            yield return Await(first);
            yield return Await(second);

            Assert.IsFalse(first.IsFaulted, first.Exception?.ToString());
            Assert.IsFalse(second.IsFaulted, second.Exception?.ToString());
            Assert.AreEqual(1, loader.CachedKeyCount, "동시 로드가 키 항목을 두 개 만들었다.");
            Assert.AreEqual(2, loader.LiveHandleCount);
            Assert.AreSame(first.Result.Value, second.Result.Value);

            first.Result.Dispose();

            Assert.IsFalse(second.Result.IsReleased, "다른 핸들이 살아 있는데 함께 해제됐다.");
            Assert.IsNotNull(second.Result.Value, "다른 핸들의 자산이 버려졌다.");
            Assert.AreEqual(1, loader.CachedKeyCount, "참조가 남아 있는데 캐시를 비웠다.");
            Assert.AreEqual(1, loader.LiveHandleCount);

            second.Result.Dispose();

            Assert.AreEqual(0, loader.CachedKeyCount);
            Assert.AreEqual(0, loader.LiveHandleCount, "해제 뒤 핸들 수가 새고 있다.");
        }

        [UnityTest]
        public IEnumerator Cancelling_in_flight_load_leaves_no_handle_and_no_cache_entry()
        {
            var loader = new ResourcesAssetLoader();
            var cts = new CancellationTokenSource();

            var task = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, cts.Token);
            cts.Cancel();
            yield return Await(task);

            AssertCancelled(task, "취소된 로드가 핸들을 돌려줬다.");
            Assert.AreEqual(0, loader.LiveHandleCount, "취소된 로드가 핸들을 남겼다.");
            Assert.AreEqual(0, loader.CachedKeyCount, "주인 없는 자산이 캐시에 남았다.");
            Assert.AreEqual(0, loader.InFlightCount, "끝난 요청이 in-flight 목록에 남았다.");

            cts.Dispose();
        }

        [UnityTest]
        public IEnumerator Cancelling_one_of_two_concurrent_loads_keeps_the_other_valid()
        {
            var loader = new ResourcesAssetLoader();
            var cts = new CancellationTokenSource();

            var cancelled = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, cts.Token);
            var kept = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            cts.Cancel();

            yield return Await(cancelled);
            yield return Await(kept);

            AssertCancelled(cancelled, "취소한 호출자가 취소로 끝나지 않았다.");
            Assert.IsTrue(kept.IsCompletedSuccessfully, kept.Exception?.ToString());
            Assert.IsNotNull(kept.Result.Value, "취소가 다른 호출자의 자산까지 없앴다.");
            Assert.AreEqual(1, loader.LiveHandleCount);
            Assert.AreEqual(1, loader.CachedKeyCount);

            kept.Result.Dispose();
            Assert.AreEqual(0, loader.LiveHandleCount);
            Assert.AreEqual(0, loader.CachedKeyCount);

            cts.Dispose();
        }

        [UnityTest]
        public IEnumerator Already_cancelled_token_does_not_start_a_request()
        {
            var loader = new ResourcesAssetLoader();
            var cts = new CancellationTokenSource();
            cts.Cancel();

            var task = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, cts.Token);
            yield return Await(task);

            AssertCancelled(task, "이미 취소된 토큰이 취소로 끝나지 않았다.");
            Assert.AreEqual(0, loader.InFlightCount);
            Assert.AreEqual(0, loader.LiveHandleCount);
            Assert.AreEqual(0, loader.CachedKeyCount);

            cts.Dispose();
        }

        [UnityTest]
        public IEnumerator Unload_unused_completes_after_release()
        {
            var loader = new ResourcesAssetLoader();
            var task = loader.LoadAsync<Sprite>(BootAssetProbe.ProbeSpriteKey, CancellationToken.None);
            yield return Await(task);
            task.Result.Dispose();

            var unload = loader.UnloadUnusedAsync(CancellationToken.None);
            yield return Await(unload);

            Assert.IsTrue(unload.IsCompletedSuccessfully, unload.Exception?.ToString());
            Assert.AreEqual(0, loader.CachedKeyCount);
        }
    }
}
