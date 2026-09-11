using System;

namespace DigitDuel.Core.Primitives
{
    /// <summary>
    /// 보드 좌표. 구조적 기본 타입이며 게임 규칙(보드 크기·이동 규칙)을 담지 않는다.
    /// 규칙은 GDD-13 확정 후 #186에서 구현한다.
    /// </summary>
    public readonly struct GridCoord : IEquatable<GridCoord>
    {
        public readonly int X;
        public readonly int Y;

        public GridCoord(int x, int y)
        {
            X = x;
            Y = y;
        }

        public GridCoord Offset(int dx, int dy) => new GridCoord(X + dx, Y + dy);

        /// <summary>축 정렬 거리(체비쇼프가 아니라 맨해튼). 규칙이 아니라 좌표 연산이다.</summary>
        public int ManhattanDistanceTo(GridCoord other)
            => Math.Abs(X - other.X) + Math.Abs(Y - other.Y);

        public bool Equals(GridCoord other) => X == other.X && Y == other.Y;

        public override bool Equals(object obj) => obj is GridCoord other && Equals(other);

        public override int GetHashCode() => unchecked((X * 397) ^ Y);

        public override string ToString() => $"({X}, {Y})";

        public static bool operator ==(GridCoord a, GridCoord b) => a.Equals(b);

        public static bool operator !=(GridCoord a, GridCoord b) => !a.Equals(b);
    }
}
