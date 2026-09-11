namespace DigitDuel.Editor.Build
{
    /// <summary>에디터 도구가 공유하는 고정 경로. 사람 이름·개인 폴더를 넣지 않는다.</summary>
    public static class DigitDuelPaths
    {
        public const string BootScene = "Assets/DigitDuel/Scenes/Boot.unity";
        public const string ResourcesRoot = "Assets/DigitDuel/Resources";
        public const string ProbeSpriteFolder = "Assets/DigitDuel/Resources/BootProbe";
        public const string ProbeSpriteAsset = "Assets/DigitDuel/Resources/BootProbe/BootProbeSprite.png";
        public const string ArtRoot = "Assets/DigitDuel/Art";
        public const string ProbeAtlas = "Assets/DigitDuel/Art/BootProbeAtlas.spriteatlasv2";

        /// <summary>빌드 산출물 루트. unity/.gitignore 의 /[Bb]uilds/ 로 추적하지 않는다.</summary>
        public const string BuildRoot = "Builds";
        public const string AndroidApkRelative = "Builds/Android/DigitDuel-dev.apk";
    }
}
