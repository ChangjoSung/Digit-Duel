namespace DigitDuel.Infrastructure.Tables
{
    /// <summary>
    /// 테이블 원본이 놓일 폴더 경계만 고정한다. 실제 TSV 스키마·코드 생성기·행 타입은 #185 범위다.
    /// 여기에 게임 값이나 컬럼 정의를 넣지 않는다.
    /// </summary>
    public static class TableSourceLayout
    {
        /// <summary>기획 원본 TSV가 커밋되는 저장소 경로(Assets 밖, 생성기 입력).</summary>
        public const string AuthoringRoot = "tables";

        /// <summary>생성된 런타임 테이블 자산이 놓이는 Resources 하위 경로.</summary>
        public const string RuntimeResourcesRoot = "Tables";

        /// <summary>생성된 POCO 행 타입이 놓이는 Assets 경로.</summary>
        public const string GeneratedCodeRoot = "Assets/DigitDuel/Runtime/Core/Tables/Generated";
    }
}
