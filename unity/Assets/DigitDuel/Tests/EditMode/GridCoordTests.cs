using DigitDuel.Core.Primitives;
using NUnit.Framework;

namespace DigitDuel.Tests.EditMode
{
    public sealed class GridCoordTests
    {
        [Test]
        public void Equality_is_value_based()
        {
            Assert.AreEqual(new GridCoord(2, 3), new GridCoord(2, 3));
            Assert.AreNotEqual(new GridCoord(2, 3), new GridCoord(3, 2));
            Assert.IsTrue(new GridCoord(2, 3) == new GridCoord(2, 3));
            Assert.IsTrue(new GridCoord(2, 3) != new GridCoord(2, 4));
        }

        [Test]
        public void Hash_code_matches_for_equal_values()
        {
            Assert.AreEqual(new GridCoord(-4, 7).GetHashCode(), new GridCoord(-4, 7).GetHashCode());
        }

        [Test]
        public void Offset_moves_by_delta()
        {
            Assert.AreEqual(new GridCoord(3, 1), new GridCoord(1, 2).Offset(2, -1));
        }

        [Test]
        public void Manhattan_distance_is_symmetric_and_non_negative()
        {
            var a = new GridCoord(-2, 5);
            var b = new GridCoord(3, 1);

            Assert.AreEqual(9, a.ManhattanDistanceTo(b));
            Assert.AreEqual(a.ManhattanDistanceTo(b), b.ManhattanDistanceTo(a));
            Assert.AreEqual(0, a.ManhattanDistanceTo(a));
        }
    }
}
