using System;

namespace DigitDuel.Application.Assets
{
    /// <summary>
    /// 로드된 자산의 수명 소유권. Dispose가 해제 시점이며 로더가 참조 수를 관리한다.
    /// Resources·Addressables 중 무엇을 쓰든 호출부는 이 인터페이스만 본다.
    /// </summary>
    public interface IAssetHandle<out T> : IDisposable where T : class
    {
        string Key { get; }

        T Value { get; }

        bool IsReleased { get; }
    }
}
