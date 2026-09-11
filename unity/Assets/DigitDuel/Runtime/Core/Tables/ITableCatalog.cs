namespace DigitDuel.Core.Tables
{
    /// <summary>
    /// 테이블 조회 진입점. 구현은 Infrastructure가 소유하며 명시적 등록을 쓴다.
    /// 리플렉션 자동 등록은 IL2CPP stripping과 충돌할 수 있어 채택하지 않았다.
    /// </summary>
    public interface ITableCatalog
    {
        ITable<TRow> Get<TRow>() where TRow : ITableRow;
    }
}
