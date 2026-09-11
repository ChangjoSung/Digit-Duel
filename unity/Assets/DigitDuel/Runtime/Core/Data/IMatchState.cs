namespace DigitDuel.Core.Data
{
    /// <summary>
    /// 경기 런타임 상태의 경계 표식. 정적 테이블(ITable)·영속 DB(IPlayerProfileStore)와 분리한다.
    /// 실제 상태 모델은 규칙 확정 후 #186에서 정의한다. [기획 필요]
    /// </summary>
    public interface IMatchState
    {
        /// <summary>해당 경기 인스턴스를 식별하는 값. 저장·재접속 계약과 무관한 로컬 식별자다.</summary>
        string MatchId { get; }
    }
}
