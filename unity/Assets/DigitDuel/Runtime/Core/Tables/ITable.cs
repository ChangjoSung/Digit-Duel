using System.Collections.Generic;

namespace DigitDuel.Core.Tables
{
    /// <summary>읽기 전용 정적 테이블. 런타임에 변경되지 않는 기획 데이터만 담는다.</summary>
    public interface ITable<TRow> where TRow : ITableRow
    {
        IReadOnlyList<TRow> Rows { get; }

        bool TryGet(int id, out TRow row);
    }
}
