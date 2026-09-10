# [피드백] Claude에게 — Roblox P1·P2 코드 수정 인수인계

작성일: 2026-09-10 (KST) · 작성: Mercury/Codex · 대상: Claude Code의 Mars / Jupiter

## 1. 먼저 알아둘 상태

**리뷰에서 지적한 P1 2건·P2 7건, 총 9건은 이미 로컬 코드에 수정되어 있습니다. 재구현하거나 같은 패치를 중복 적용하지 마세요.** 여기서 P1·P2는 코드 결함의 우선순위이며, 이전 아트 납품의 P1·P2와는 별개입니다.

- 사용자 요청: Roblox 코드만 점검 → “p1 p2 다 처리해줘” → Claude에게 전달할 인수인계 문서 작성.
- Git 저장소 루트: `C:\WOOK\pvpserver\client` (상위 `C:\WOOK\pvpserver`와 구분).
- Roblox 실행·검사 루트: `C:\WOOK\pvpserver\client\roblox`.
- 문서 작성 시 브랜치: `dev`.
- 확인한 HEAD: `2c04b7f4c14c3d6b71902b17b742205136c6ba83`.
- HEAD 제목: `[infra] CI 잡 E — Roblox 클라이언트·규칙 검사 추가 (#118) (#163)`.
- **이번 수정은 미커밋 워킹트리에 있습니다. 위 HEAD 자체에 수정이 들어 있다는 뜻이 아닙니다.** 다른 PC에서 해당 커밋만 체크아웃하면 이번 수정은 없습니다.
- 코드·테스트 변경 10개 파일 중 `roblox/src/client/SeatLock.luau`는 신규 미추적 파일입니다. diff만 전달하거나 추적 파일만 처리하면 빠질 수 있으므로 반드시 함께 보존하세요.
- 이번 문서 작성에서는 제품·테스트 코드를 추가로 수정하지 않았습니다. 아래 검증 수치는 직전 수정 작업의 최종 결과입니다.
- 커밋·push·PR 생성·병합·Roblox 게시·자산 업로드는 하지 않았습니다. 이 문서도 해당 권한을 추가하지 않습니다.

먼저 [CLAUDE.md](../../CLAUDE.md), 현재 `git status --short`, `git diff -- roblox/src roblox/tests`를 확인하세요. 공유 작업 중 다른 세션의 변경이 있을 수 있습니다. 기존 변경을 보존하고 `git reset --hard`나 파일 전체 되돌리기로 정리하지 마세요. `dev` 직접 커밋은 저장소 규칙상 금지이며 Git 통합은 Mercury와 조정합니다.

## 2. 수정된 9건과 담당 파일

아래 경로는 저장소 루트 기준입니다. 수정 완료는 코드 반영 및 아래에 명시한 검증 범위를 뜻하며, Studio 실플레이까지 통과했다는 뜻은 아닙니다.

| 번호 | 우선순위 | 기존 문제 | 반영한 수정 | 파일 |
|---|---|---|---|---|
| 1 | P1 | 폭탄 등으로 죽은 공격자의 ID로 다시 전투 요청 가능 | `canBattle`과 `apply`의 전투 진입 모두 공격자·방어자의 생존/배치 여부 검증. 강제 전투 분기 이전에도 거부 | `roblox/src/shared/Engine.luau` |
| 2 | P1 | 비활성 프롬프트에 의존해 봇 자리·재접속 예약 좌석 탈취 가능 | 서버 `canClaim`으로 실제 Player, 봇, 예약 UserId, 논리·물리 점유 검사. 프롬프트와 실제 Occupant 변경 양쪽 방어 | `roblox/src/server/Lobby.luau`, `roblox/src/server/init.server.luau` |
| 3 | P2 | `A and aValue or dValue`가 A의 `false`/`nil`을 D의 값으로 바꿈 | 아이템·볼·버프 사용 정보 선택을 Luau `if ... then ... else ...` 표현식으로 변경. 엔진·뷰·AI를 함께 수정 | `roblox/src/shared/Battle.luau`, `roblox/src/shared/Views.luau`, `roblox/src/shared/Ai.luau` |
| 4 | P2 | 감전 해독제 사용 시 현재 행동자가 바뀌어 상대가 중복 행동 | 라운드 시작에 선공 순서를 확정하고 그 라운드 동안 유지. `actorOfPhase`는 읽기 전용 | `roblox/src/shared/Battle.luau` |
| 5 | P2 | 연결이 끊긴 패자의 Player 참조가 없어 전적 누락 | 세션 참가자의 고정 신원을 보존하고 `Stats.recordId`로 기록. 동일 세션 중복 종료의 중복 기록 차단 | `roblox/src/server/init.server.luau`, `roblox/src/server/Stats.luau` |
| 6 | P2 | 재접속 후 다시 끊으면 이전 타이머가 새 유예를 종료 | pending 객체 동일성·세대 번호·원래 deadline을 검사. 착석 성공 후에만 복귀 확정 | `roblox/src/server/init.server.luau`, `roblox/src/server/Lobby.luau` |
| 7 | P2 | 저장 중 새 결과가 들어오면 이전 저장 완료 처리가 dirty를 지움 | `rev`/`savedRev`/`saving`으로 관리. 실제 저장한 revision까지만 완료 처리하고 이후 결과는 dirty 유지 | `roblox/src/server/Stats.luau` |
| 8 | P2 | 서버의 점프 금지만으로 클라이언트 입력을 막지 못해 착석 이탈·기권 | Player 속성을 통한 서버/클라이언트 잠금 연결. 클라이언트에서 점프 상태와 입력 차단·복원, 리스폰/오래된 콜백 방어 | 신규 `roblox/src/client/SeatLock.luau`, `roblox/src/client/init.client.luau`, `roblox/src/server/Lobby.luau` |
| 9 | P2 | ‘행동 넘기기’ 버튼이 아이템 줄과 겹침 | 패스 버튼 y=126, 하단 안내 y=158로 분리. 아이템 y=62, 기존 행동 버튼 y=94 유지 | `roblox/src/client/init.client.luau` |

추가 변경 파일: [roblox/tests/run.luau](../../roblox/tests/run.luau)의 `[15] battle order snapshot / per-side accounting regressions` 구간. 기존 검사 1,837개에 회귀 검사 63개를 추가했습니다. 따라서 제품 코드 9개 파일 + 테스트 1개 파일 = 총 10개입니다.

## 3. 후속 수정 시 반드시 유지할 계약

### 전투 순서와 사용 정보

- `Battle.luau`의 `firstSide`/`orderRound`는 라운드 시작 시점의 순서 스냅샷입니다. 최초 라운드는 `resetTemps` 이후, 다음 라운드는 상태이상 소진 처리 이후 확정합니다.
- `actorOfPhase`에서 상태를 쓰거나 매번 현재 감전 상태로 순서를 다시 계산하지 마세요. Views·AI가 조회만 해도 상태/RNG/로그가 바뀌어서는 안 됩니다.
- 스냅샷 없는 직접 구성 테스트 상태는 읽기 전용 계산으로 호환합니다. 실제 기술 실행 및 유효한 아이템 사용에서 상태 변경 전 순서를 확정합니다.
- 감전 우선순위, 홀수/짝수 라운드 순서, `shockFresh` 지속 규칙은 유지했습니다. 새로운 밸런스 변경이 아닙니다.
- A/D 값 선택을 `and/or` 관용구로 일괄 되돌리지 마세요. `false`·`nil` 자체가 의미 있는 값입니다. 다만 모든 `and/or`가 버그인 것은 아니며 양쪽 side 조건을 각각 검사하는 기존 버프 중복 가드는 유지했습니다.

### 좌석과 재접속

- `Lobby`는 `holds`에 예약 UserId를 보존하고 `bots`·논리 occupant·실제 Seat.Occupant를 함께 검사합니다. `ProximityPrompt.Enabled`만으로 권한을 판단하지 않습니다.
- `Lobby.sitPlayer`는 `Seat:Sit` 호출 성공 여부만 보지 않고 실제 `Seat.Occupant == 대상 Humanoid`를 확인합니다. 예외/무동작 등 실패 시 이전 예약과 논리 점유를 복구합니다.
- `tryReconnect`는 실제 착석 성공 후에만 pending을 소비하고 `session.players`/`sessions`/`seatOf`/테이블 상태를 연결합니다.
- 실패 시 약 1초 간격으로 같은 pending을 재시도합니다. 새 90초를 부여하지 않으며 원래 deadline을 보존합니다. 플레이어 퇴장, pending 교체/소비/만료 후에는 이전 재시도가 진행되지 않습니다.
- 현재 `RECONNECT_GRACE = 90`초이며 만료 콜백은 `GRACE + 1`초 후 실행됩니다. deadline 이후의 늦은 복귀는 거부합니다.
- 재접속 복원은 **동일 서버 인스턴스의 메모리에 남은 세션과 동일 UserId** 기준입니다. 서버 간 복원이나 서버 재시작 후 세션 복구를 추가한 작업이 아닙니다.

### 전적 저장과 점프 잠금

- `session.participants`는 접속 여부와 무관한 신원입니다. 오프라인 결과를 다시 현재 Player 참조에만 의존하게 만들지 마세요.
- `Stats.recordId(userId, result, name)`를 보존하세요. 봇은 기록에서 제외하고 사람의 기존 전적 정책은 변경하지 않았습니다.
- 이전 저장의 응답이 새 결과의 dirty를 지우지 않아야 합니다. 이번 수정은 동일 서버의 저장 경쟁 방어이며, 여러 서버 전체에 걸친 정확히 한 번 기록 보장을 새로 구현한 것은 아닙니다.
- 서버/클라이언트 공통 속성명은 `DigitDualSeatLocked`입니다. `init.client.luau`가 `require(script:WaitForChild("SeatLock")).start(player)`를 호출합니다.
- `default.project.json`의 기존 Rojo 매핑으로 `SeatLock`이 Client LocalScript의 자식 ModuleScript가 됩니다. 수동 복사 시에도 이 위치와 시작 호출을 함께 유지하세요.
- 잠금은 점프에만 적용합니다. 키보드 Space/게임패드 ButtonA, 모바일 JumpRequest·Humanoid.Jump 변경을 처리하고, 해제 시 원래 Jumping 허용값을 복원합니다.
- 오래된 CharacterAdded/Removing 콜백이 새 캐릭터의 잠금을 풀면 안 됩니다. 중복 attach 시 리스너를 추가하거나 원래 복원값을 덮어쓰지 않도록 보완했습니다.

## 4. 완료한 검증과 한계

| 검증 | 최종 결과 | 범위/한계 |
|---|---|---|
| Luau 헤드리스 테스트 | **1,900 passed / 0 failed** | `tests/run.luau`, 신규 회귀 assertion 63개 포함 |
| AI 대 AI | **24/24 경기 종료 도달** | 위 테스트 실행에 포함 |
| Luau 컴파일 | **21개 파일 / 실패 0** | 소스 20개 + 테스트 1개. Studio 런타임 검증은 아님 |
| `rbxcheck.js` | **20개 소스 / 문제 0** | Roblox API 정적 검사 |
| `uicheck.js` | **클라이언트 7개 파일 / 실패 0** | 정적 UI 검사. 버튼 상태별 좌표 겹침도 별도 메모리 검사에서 통과 |
| Rojo 빌드 | **성공** | 최종 수정본을 임시 `.rbxl`로 생성. 게시하지 않음 |
| `git diff --check` | **통과** | LF→CRLF 안내만 있었으며 whitespace 오류 없음 |
| Saturn 독립 규칙/클라이언트 QA | **89개 검사 PASS** | 죽은 공격자·사용 회계 27 + 감전 순서 33 + SeatLock 29 |
| Saturn 독립 서버 QA | **PASS** | 예약 좌석, 재접속·타이머·오프라인 전적·저장 ACK 경쟁을 실제 소스 + 모의 서비스로 검증 |

독립 서버 검증에는 착석 예외/무동작/없는·죽은 Humanoid, 재시도 성공, 원래 deadline 유지, 반복 끊김, 양쪽 끊김, 중복 종료, 저장 중 다음 결과 유입을 포함했습니다. 저장 경쟁 검증에서 재로드 후 `games=2, wins=1, losses=1, writes=2` 보존을 확인했습니다.

**검증 한계:** 독립 QA의 모의 하네스는 메모리에서 실행했으며 별도 테스트 파일로 납품하지 않았습니다. 저장소에 추가한 자동 회귀 검사는 `run.luau`의 `[15]` 구간입니다. 실제 Studio 물리 착석/신호 타이밍, 기기별 실제 입력, 실제 DataStore 서비스, 실제 네트워크 재접속은 아직 검증하지 않았습니다. 이 결과를 전체 Roblox 코드의 무결함 또는 운영 배포 승인으로 확대 해석하지 마세요.

## 5. 다시 실행할 로컬 검사

PowerShell 기준입니다. 첫 줄의 경로를 구분하세요.

```powershell
Set-Location 'C:\WOOK\pvpserver\client\roblox'
& 'C:\WOOK\Roblox\tools\luau\luau.exe' tests/run.luau
node tools/rbxcheck.js
node tools/uicheck.js
git diff --check
```

전체 Luau 컴파일:

```powershell
rg --files src tests -g '*.luau' | ForEach-Object {
    & 'C:\WOOK\Roblox\tools\luau\luau-compile.exe' --null $_
    if ($LASTEXITCODE -ne 0) { throw "Luau compile failed: $_" }
}
```

기존 place 파일을 덮어쓰지 않는 임시 빌드:

```powershell
$reviewBuildDir = Join-Path ([System.IO.Path]::GetTempPath()) ('digitdual-p1p2-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $reviewBuildDir | Out-Null
& '.\build\rojo.exe' build default.project.json -o (Join-Path $reviewBuildDir 'DigitDual-review.rbxl')
```

## 6. Claude가 이어서 확인할 항목

새 기능 구현보다 현재 수정본의 diff 확인과 Studio 검증이 우선입니다. 이 체크리스트는 후속 제안이며 실제 수행 권한은 최신 CJ 요청과 저장소 역할 계약을 따릅니다. 데이터 검사는 테스트 환경/계정으로 제한하고 운영 전적을 변경하지 마세요.

- [ ] 신규 `SeatLock.luau`를 포함한 10개 코드·테스트 파일이 전달/동기화됐는지 확인.
- [ ] Studio 다중 클라이언트에서 정상 착석·대전 시작·종료 후 일어서기 확인.
- [ ] 봇 자리와 다른 UserId의 예약 좌석에 접근해도 점유/세션 참여가 거부되는지 확인.
- [ ] 대전 중 Space·게임패드·모바일 점프로 자리를 이탈하지 않고, 종료/잠금 해제 후 점프가 복원되는지 확인.
- [ ] 리스폰과 빠른 캐릭터 교체 후에도 현재 캐릭터만 잠기고 이전 콜백이 잠금을 풀지 않는지 확인.
- [ ] 동일 UserId·동일 서버에서 유예 안 복귀 시 기존 대전 재개, 유예 밖 복귀 시 기존 대전 종료 확인. 단순 테스트 서버 재시작은 이 검증의 대체가 아님.
- [ ] 반복 끊김: 첫 이탈 t=0 → 복귀 t=20 → 재이탈 t=30일 때 이전 만료 콜백(t≈91)이 새 유예를 끝내지 않고, 새 deadline(t=120) 이후 만료 콜백(t≈121)에서 처리되는지 확인.
- [ ] 재착석이 일시 실패해도 제3자에게 자리가 열리지 않고 원래 deadline 안에서만 재시도되는지 확인.
- [ ] 오프라인 패배와 상대 승리가 각각 기록되고 동일 종료 처리 반복으로 중복 증가하지 않는지 확인. 양쪽 이탈 후 한쪽 복귀도 확인.
- [ ] 테스트 DataStore에서 저장 지연/실패·재시도 중 다음 경기 결과가 들어와도 재로드 후 두 결과가 남는지 확인.
- [ ] D가 먼저 아이템/볼/버프를 사용해도 A의 자기 사용 권한과 표시가 유지되는지 확인.
- [ ] 감전으로 후공이 된 플레이어가 해독제를 사용한 뒤 자기 정상 행동을 이어서 하고, 상대가 같은 라운드에 두 번 행동하지 않는지 확인.
- [ ] 기술 전부 사용 불가 + 아이템 보유 상태에서 ‘행동 넘기기’와 아이템 버튼이 겹치지 않고 각각 눌리는지 확인. 작은 화면에서도 확인.

클라이언트·공유 규칙·테스트 후속 수정은 Mars, 서버 수정은 Jupiter, 독립 판정은 Saturn, 문서·Git 통합은 Mercury 소관입니다. 기존 로비 메시·텍스처·토큰·배너·FX·자산 ID와 다른 세션의 CI 변경은 이번 수정 대상이 아니므로 유지하세요.

후속 보고에는 수정한 파일, 재실행한 검사, Studio 검증 결과와 미검증 항목을 구분해 적어주세요. **인수인계 완료를 커밋·게시·운영 검증 완료로 보고하지 마세요.**
