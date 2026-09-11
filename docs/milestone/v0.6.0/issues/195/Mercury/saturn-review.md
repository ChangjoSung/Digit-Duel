# #195 Saturn 독립 검수 기록

## 1차 — REVISE (2026-09-11 08:21:49 UTC)

Task `task_f565b290d619`, Dispatch `ctx_88bc77669e67`, 수신 `msg_06b0dfd96b37`. QA 수행은 succeeded, 제품 판정은 REVISE다. 파일 변경 없음. 임시 fixture·빌드 산출물을 만드는 명령은 실행하지 않았다.

검수 범위는 `b1f7467..71abc8d`의 실제 소스다. 기존 6개 보존, 단일 F·권한·트리거, 프로젝트 부재 실패, meta/씬/참조 검사, 실제 두 netstandard2.1/C#9 프로젝트와 빈 소스 가드는 확인했다. 구조 검사기를 직접 실행했고, Mercury의 구조37/MCP46 및 PR197 CI7 PASS 증거와 대조했다.

**P2:** 런타임 asmdef의 `includePlatforms`만 확인하고 `excludePlatforms`와 런타임 `defineConstraints`를 놓친다. Presentation에 `excludePlatforms: [Android]` 또는 `defineConstraints: [UNITY_EDITOR]`를 넣어도 통과해 Android 빌드에서 계층이 빠질 수 있다. Saturn은 파일 쓰기 없는 메모리 읽기 오버레이로 두 경우 모두 `failures=[]`를 재현했다.

Mercury는 지적을 수락해 Mars 수정 Task `task_37b8e5f49602`로 두 조건과 자료형 검증·음성 대조를 맡겼다. 같은 Issue/PR에서 수정 후 Saturn이 재검수한다. Saturn 세션은 이 직접 후속 재검수에 한해 유지하며, 재검수 완료 또는 2026-09-11 08:40 UTC까지의 lease로 제한한다. 기한이 지나면 release 후 fresh QA로 이어간다.

## 재검수 — PASS (2026-09-11 08:29:09 UTC)

Task `task_5a5ee25e3c56`, Dispatch `ctx_e131390fdc80`, 수신 `msg_6fc4ff46561b`. 같은 직접 후속 범위의 재검수이며 파일 변경 없음, 보고 파일은 Mercury가 이 문서로 보관한다.

Saturn은 `71abc8d` 이후 checker·회귀 수정만 있는 것을 대조하고, 읽기 전용 구조 검사와 **메모리 오버레이 113개**를 직접 실행했다. 네 런타임 어셈블리의 비어 있지 않은 플랫폼/define 제약, 비배열·비문자열 자료형을 거부하며, 현재 런타임과 정상 Editor/Test 구성이 통과하는 것을 확인했다. 원래 누락과 정상 경계를 검증하는 회귀를 검토하고 Mercury의 수정 후 구조43/43·실패0·exit0 증거와 대조했다. 남은 지적은 없다.

1차 REVISE는 위 이력으로 보존한다. 이번 PASS는 수정 범위의 독립 검수이며, 최종 PR head에서 GitHub CI7을 다시 통과하는 것은 Mercury가 확인한다. 실제 Unity Editor·APK 검증은 이 CI의 범위가 아니다.
