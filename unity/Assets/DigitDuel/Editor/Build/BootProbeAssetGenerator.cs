using System.IO;
using UnityEditor;
using UnityEditor.U2D;
using UnityEngine;
using UnityEngine.U2D;

namespace DigitDuel.Editor.Build
{
    /// <summary>
    /// 자산 수명·Atlas 검증에 쓸 작은 시험 자산을 만든다. 외부 아트를 복사하지 않고 코드로 생성해
    /// 재현 가능하게 유지한다. 게임 아트가 아니며 #187·Earth 범위와 무관하다.
    /// </summary>
    public static class BootProbeAssetGenerator
    {
        private const int Size = 64;
        private const int PixelsPerUnit = 64;

        [MenuItem("DigitDuel/Generate Boot Probe Assets")]
        public static void Generate()
        {
            EnsureFolder("Assets/DigitDuel", "Resources");
            EnsureFolder(DigitDuelPaths.ResourcesRoot, "BootProbe");
            EnsureFolder("Assets/DigitDuel", "Art");

            WriteProbeTexture();
            AssetDatabase.ImportAsset(DigitDuelPaths.ProbeSpriteAsset, ImportAssetOptions.ForceUpdate);
            ConfigureAsSprite(DigitDuelPaths.ProbeSpriteAsset);
            CreateOrUpdateAtlas();

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();
            Debug.Log($"[DigitDuel.Editor] boot probe assets generated: {DigitDuelPaths.ProbeSpriteAsset}, {DigitDuelPaths.ProbeAtlas}");
        }

        private static void WriteProbeTexture()
        {
            var texture = new Texture2D(Size, Size, TextureFormat.RGBA32, false);
            try
            {
                // 결정적 패턴: 8px 체커 + 테두리. 실기 화면에서 실제로 그려졌는지 눈으로 구분하기 쉽다.
                for (var y = 0; y < Size; y++)
                {
                    for (var x = 0; x < Size; x++)
                    {
                        var isBorder = x < 2 || y < 2 || x >= Size - 2 || y >= Size - 2;
                        var isDark = ((x / 8) + (y / 8)) % 2 == 0;
                        var color = isBorder
                            ? new Color32(255, 214, 0, 255)
                            : (isDark ? new Color32(32, 38, 64, 255) : new Color32(96, 132, 220, 255));
                        texture.SetPixel(x, y, color);
                    }
                }

                texture.Apply();

                var absolutePath = Path.Combine(Directory.GetCurrentDirectory(), DigitDuelPaths.ProbeSpriteAsset);
                Directory.CreateDirectory(Path.GetDirectoryName(absolutePath));
                File.WriteAllBytes(absolutePath, texture.EncodeToPNG());
            }
            finally
            {
                Object.DestroyImmediate(texture);
            }
        }

        private static void ConfigureAsSprite(string assetPath)
        {
            var importer = (TextureImporter)AssetImporter.GetAtPath(assetPath);
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = PixelsPerUnit;
            importer.filterMode = FilterMode.Point;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            // 압축 원본은 atlas 패킹 때 픽셀 손실 경고를 낸다. 시험 자산은 무압축으로 둔다.
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.SaveAndReimport();
        }

        private static void CreateOrUpdateAtlas()
        {
            var atlas = new SpriteAtlasAsset();
            atlas.SetIncludeInBuild(true);

            var packing = new SpriteAtlasPackingSettings
            {
                enableRotation = false,
                enableTightPacking = false,
                padding = 4
            };
            atlas.SetPackingSettings(packing);

            var texture = AssetDatabase.LoadAssetAtPath<Texture2D>(DigitDuelPaths.ProbeSpriteAsset);
            if (texture != null)
            {
                atlas.Add(new Object[] { texture });
            }

            SpriteAtlasAsset.Save(atlas, DigitDuelPaths.ProbeAtlas);
            AssetDatabase.ImportAsset(DigitDuelPaths.ProbeAtlas, ImportAssetOptions.ForceUpdate);
        }

        private static void EnsureFolder(string parent, string child)
        {
            var full = $"{parent}/{child}";
            if (!AssetDatabase.IsValidFolder(full))
            {
                AssetDatabase.CreateFolder(parent, child);
            }
        }
    }
}
