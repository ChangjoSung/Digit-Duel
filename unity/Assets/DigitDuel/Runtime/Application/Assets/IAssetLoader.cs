using System.Threading;
using System.Threading.Tasks;

namespace DigitDuel.Application.Assets
{
    /// <summary>
    /// 비동기 자산 로더 경계. 구현 교체(Resources -> Addressables)는 이 인터페이스 뒤에서만 일어난다.
    /// </summary>
    public interface IAssetLoader
    {
        /// <summary>살아 있는(미해제) 핸들 수. 수명 검증·누수 탐지에 쓴다.</summary>
        int LiveHandleCount { get; }

        Task<IAssetHandle<T>> LoadAsync<T>(string key, CancellationToken cancellationToken) where T : class;
    }
}
