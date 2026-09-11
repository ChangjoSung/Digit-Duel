using System;

namespace DigitDuel.Application.Assets
{
    public sealed class AssetLoadException : Exception
    {
        public AssetLoadException(string key, string reason)
            : base($"자산 로드 실패: key='{key}' 이유={reason}")
        {
            Key = key;
        }

        public string Key { get; }
    }
}
