# #182 자산 수명 중간 검수

2026-09-11 06:35 UTC · Saturn READ_ONLY 결과를 Mercury가 보관한다. Task `task_068ee8efc245`, Dispatch `ctx_3d4470469519`, 상세 메시지 `msg_bc250170680a`, 완료 `msg_b3f99d4f2241`. 검수 작업 succeeded, 제품 판정 **REVISE**, 파일 변경0. 테스트·Editor·기기 호출을 하지 않은 정적 중간 검수이며 전체 #182/APK 수락과 다르다.

## 확인된 수정 사항

- **P2: 타입이 다른 요청 간 간섭.** `ResourcesAssetLoader.cs` 73–77·104–113·129–131·163–179에서 요청/캐시 키는 경로뿐인데 실제 Resources 요청은 타입을 지정한다. 같은 경로에 AudioClip 요청 후 Sprite 요청을 동시에 보내면 유효한 Sprite 요청도 실패한 AudioClip 요청을 공유한다. Sprite/Texture2D 하위·주 자산 조합도 캐시를 포함해 충돌한다. 경로+요청 타입으로 요청/캐시/해제 식별자를 구분하고 잘못된 타입이 정상 동시 요청을 오염시키지 않는 회귀 검사를 추가한다.
- **P2: 취소 검사의 잘못된 성공 조건.** `AssetLoaderLifetimeTests.cs` 159·180·203의 IsCanceled 또는 모든 IsFaulted 허용은 타입/인자/공급자 결함까지 통과시킨다. 실제 취소 상태 또는 명시적으로 검증한 OperationCanceledException을 요구하고 살아남은 요청의 성공을 확인한다.
- **지연 완료 검사의 재현 조건 부족.** `BootSceneTests.cs` 102–116은 한 프레임 뒤 Destroy하지만 Start가 미완료 요청을 발행했는지 확인하지 않는다. Start 이전이면 기본값으로 거짓 통과하고, 이미 로드됐다면 정상 동작도 실패할 수 있다. 제어 가능한 진행 중 지점과 제한 시간 내 취소/완료를 검증한다. 동시 로드 검사의 InFlightCount=1도 backend 호출 횟수 자체를 입증하지는 않는다.

Mercury는 `msg_edd738eac23f`로 Mars_2에 위 사항을 전달했다. 큰 구조 변경 없이 수정하고 실제 검사를 다시 실행한다.

## 정적 검토에서 확인한 동작과 한계

같은 타입의 메인 스레드 호출은 await 이후 캐시를 다시 확인해 참조 수가 일치한다. ReferenceEquals가 이전 요청의 정리가 새 요청을 지우는 것을 막으며, finally는 공유 요청의 실패에도 실행된다. 취소된 정상 로드는 핸들/캐시를 만들지 않고 살아남은 호출은 취득할 수 있다. 다만 null/타입 검증과 raw 요청 실패가 취소 검사보다 앞서므로 실패한 요청을 취소했을 때 오류가 우선한다. 취소 우선순위는 명시해야 한다.

BootAssetProbe는 UI 접근 전 파괴 여부 확인, 늦은 핸들 Dispose, 수명 token 취소/해제를 수행한다. 유효 자산의 지연 완료 누수는 정적으로 추가 확인하지 못했다. 개별 UnloadAsset을 호출하지 않아 해제 시 다른 SpriteAtlas 자산을 직접 무효화하지 않는다. UnloadUnusedAsync 완료/캐시0 검사는 실제 메모리 회수나 살아 있는 다른 Sprite 렌더링까지 증명하지 않는다.

공유 실패 후 재시도·전체 호출자 취소·해제/재로드 재진입·혼합 타입 테스트가 당시에는 없었다. 이들은 미실행 범위이며 실제 오류를 관측했다고 주장하지 않는다. 수정 대상은 위 확인된 결함과 이를 검출할 의미 있는 회귀 검사다.

## 검수 스냅샷

공통 루트 `unity/Assets/DigitDuel/`. 검수 후 SHA256이 같음을 확인했다. 아래 줄 번호와 판단은 이 스냅샷 기준이다.

| 파일 | SHA256 |
|---|---|
| Runtime/Infrastructure/Assets/ResourcesAssetLoader.cs | B53879DC414BA20B03BD1A9E6C7ADC817BF5415FDC2F51730244D802A0E6DCCC |
| Runtime/Presentation/Boot/BootAssetProbe.cs | E73FAD8E1E12C8908E2A1E71320A72B946991FB8415A611CA6FF9673F25B1DC3 |
| Runtime/Application/Assets/IAssetLoader.cs | 1D739FB4ACBBC386C3908711E77E0DB087943100E81D15E61842282CDAB0F65A |
| Runtime/Application/Assets/IAssetHandle.cs | C74926CFDE6A19CF2CE033CE15C1ECA19D0F3492A1BF816AD5966AB017FB6A74 |
| Runtime/Application/Assets/AssetLoadException.cs | 9BC1C103F28E2808F5DE842C97F9916D7CFA4195B6BC28C3C510814CAE0C3A1B |
| Tests/PlayMode/AssetLoaderLifetimeTests.cs | 39059FF12D751AB4D340B463CCEC13CDB64603F569FB528ED2696DA551A13859 |
| Tests/PlayMode/BootSceneTests.cs | 415BB8E77F5AF18F0982898B735B1E9F784A747542517CC4F0DA4A17A0C5FE26 |
