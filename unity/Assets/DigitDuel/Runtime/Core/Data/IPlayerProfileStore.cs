using System.Threading;
using System.Threading.Tasks;

namespace DigitDuel.Core.Data
{
    /// <summary>
    /// 영속 플레이어 데이터의 경계. 저장 위치(로컬·서버 DB)는 #184 서버 계약 이후에 정한다.
    /// 서버·DB 타입이 게임 정의를 소유하지 않도록 Core는 인터페이스만 갖는다.
    /// </summary>
    public interface IPlayerProfileStore
    {
        Task<string> LoadRawAsync(string profileId, CancellationToken cancellationToken);

        Task SaveRawAsync(string profileId, string payload, CancellationToken cancellationToken);
    }
}
