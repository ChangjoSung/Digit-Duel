using System.Linq;
using DigitDuel.Editor.Build;
using DigitDuel.Presentation.Boot;
using NUnit.Framework;
using UnityEditor;
using UnityEditor.U2D;
using UnityEngine;
using UnityEngine.U2D;

namespace DigitDuel.Tests.EditMode
{
    /// <summary>
    /// 시험 자산과 SpriteAtlas가 실제로 존재하고 대상 스프라이트를 담는지 확인한다.
    /// 파일 존재만이 아니라 atlas 패킹 결과를 본다.
    /// </summary>
    public sealed class BootProbeAssetTests
    {
        [Test]
        public void Probe_sprite_is_imported_as_sprite()
        {
            var sprite = AssetDatabase.LoadAssetAtPath<Sprite>(DigitDuelPaths.ProbeSpriteAsset);
            Assert.IsNotNull(sprite, $"{DigitDuelPaths.ProbeSpriteAsset} 가 Sprite 로 import 되지 않았다.");

            var importer = (TextureImporter)AssetImporter.GetAtPath(DigitDuelPaths.ProbeSpriteAsset);
            Assert.AreEqual(TextureImporterType.Sprite, importer.textureType);
        }

        [Test]
        public void Probe_sprite_lives_under_resources_at_the_runtime_key()
        {
            var expected = $"{DigitDuelPaths.ResourcesRoot}/{BootAssetProbe.ProbeSpriteKey}.png";
            Assert.AreEqual(expected, DigitDuelPaths.ProbeSpriteAsset,
                "런타임 Resources 키와 자산 경로가 어긋나면 기기에서만 실패한다.");
        }

        [Test]
        public void Atlas_exists_and_packs_the_probe_sprite()
        {
            var atlas = AssetDatabase.LoadAssetAtPath<SpriteAtlas>(DigitDuelPaths.ProbeAtlas);
            Assert.IsNotNull(atlas, $"{DigitDuelPaths.ProbeAtlas} 를 찾지 못했다.");
            Assert.IsTrue(atlas.IsIncludeInBuild(), "빌드에 포함되지 않는 atlas 는 기기에서 바인딩되지 않는다.");

            SpriteAtlasUtility.PackAtlases(new[] { atlas }, EditorUserBuildSettings.activeBuildTarget, false);

            Assert.AreEqual(1, atlas.spriteCount, "atlas 가 시험 스프라이트를 담고 있어야 한다.");

            var sprites = new Sprite[atlas.spriteCount];
            atlas.GetSprites(sprites);
            Assert.IsTrue(sprites.Any(s => s != null && s.name.StartsWith("BootProbeSprite")),
                "atlas 안에서 BootProbeSprite 를 찾지 못했다.");
        }
    }
}
