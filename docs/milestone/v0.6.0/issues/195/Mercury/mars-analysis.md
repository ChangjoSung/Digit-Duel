# #195 Mars 분석 수신 기록

2026-09-11 · Mercury가 READ_ONLY 분석 보고를 보관한다.

- Run: `run_933444413862`; Task: `task_ba1aa07b3540`; Dispatch: `ctx_8ceca9679c43`.
- 수신: `msg_a834a0563537`, 2026-09-11 07:59:59 UTC. 결과 succeeded, 파일 변경 없음.
- Unity 트랙의 추적 파일 145개, 로컬 meta GUID 69개, 중복 0개. 전체 GUID 참조 중 상당수는 UPM/내장 자산이므로 미해소 참조 전체를 실패 처리하면 오탐이다.
- Core/Application 9개 C# 소스는 System 계열과 Core 계약만 참조한다. 실제 두 어셈블리를 .NET Standard 2.1/C#9로 분리 컴파일하는 검사가 가능하다. 이 분석 시점에는 실제 dotnet 컴파일을 실행하지 않았다.
- Assets 루트에는 meta가 필요 없고, `folderAsset: yes`인 빈 폴더 meta는 Git의 빈 디렉터리 미추적 특성상 허용한다.
- 캐시 경로는 `unity/` 직속에 한정한다. 부분 문자열 `Build` 검색은 정상 `Editor/Build/*.cs`를 잘못 차단한다.
- stripping-level 직렬화 수치의 의미는 이 분석에서 확정하지 않았으므로 새 정적 게이트에 추가하지 않는다.

Mercury 결정: 분석의 구조 검사·순수 C# 컴파일 축을 **단일 F job**으로 묶고 MCP 회귀를 포함한다. 기존 6개에 추가해 총 7개 검사가 된다. 구현은 별도 Task `task_3bb0763599f3`, Dispatch `ctx_4301b2ba576c`로 같은 Mars에게 즉시 이어 맡겼다. 후속 구현과 검수 완료까지 한정해 세션을 재사용하며, 독립 QA는 fresh Saturn으로 수행한다.

Editor CI는 현재 인증이 없다는 관측으로 이번 적용에서 분리한다. 분석 중 조사한 컨테이너 크기나 라이선스 좌석 정책은 환경별 추가 검증이 필요하므로 확정 제약으로 채택하지 않는다. 적용 근거와 제한은 [분석 판단](analysis.md)을 따른다.
