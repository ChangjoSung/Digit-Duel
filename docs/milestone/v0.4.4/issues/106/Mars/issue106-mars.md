# Issue #106 — 턴 흐름·연출 계약 구현 (Mars_1 납품 보고)

- 역할: **Mars_1** (required_role=Mars · mode=IMPLEMENT · area=HTML · mutation=code · instance_index=1 · provider=Claude Code)
- Task `task_6ae7dc111180` · dispatch `ctx_1f2761c63d3d` (1차 납품, 제품 a20be021…) → **REVISE 후속 Task `task_409978b5ce51` · dispatch `ctx_a87b85dea1bd`** (Saturn2 `msg_d847280b3dba`·`msg_db013b1c24df` 5건 수정, 최종 제품 d01845cd8e1595b5…) · 브랜치 `feature/106-turn-flow` (PD 전환) · 기준 `dev` 6baa0b5 (#104 통합·독립 QA PASS)
- 계약: `docs/v0.4.4-turn-flow-spec.md` (Venus 분석 → PD 채택 경계) + dispatch TASK 블록의 PD 채택 경계(회복 틱·폭탄 접촉·판정·연출 순서·자동 종료·헤드리스 호환) + PD 리뷰 `msg_41fdc516c9ba`
- 작성: 2026-09-08
- **이 문서가 주장하는 범위**: 기계로 잰 사실과 저장한 증빙까지다. Saturn 독립 QA·CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다. Git 쓰기·GitHub·Notion 기록은 하지 않았다(PD 집행). `server/`·README·릴리스·미디어·`art/`·`orca-hook-latency-report.md`는 손대지 않았다.

---

## 1. 결론 요약

| 구분 | 내용 |
|---|---|
| [확정] 구현 범위 | 계약 T1~T9 전부 + PD 경계 — 턴 배너·버닝 타임 배너·접촉 배너·6상황 문구·거울 문구·폭발/함정 연출(표시 유지)·회복 주 행동(각 플레이어 턴 5%·지속·해제)·폭탄 직접 접촉 발동(상황 4·5·6)·함정+걸린 말 공개·남은 HP 비율 판정(동률 방어자·방어막 미포함)·자동 턴 종료(행동자만·1초 grace·주 행동 전 특례)·전투 3·2·1·배틀 시작! → 라운드 배너 → 4카테고리(싸우기·가방·포획·도망가기) → 기술 2초 → 피해 2초 → 결과 배너 2.5초·HP/방어막 바·거울 사본·튜토리얼 문구 |
| [확정] 결정론 | 규칙 상태(S) 전이는 종전처럼 동기·즉시. 연출은 표시 계층(`FX` 큐·`#fxBanner` 오버레이·`body.fx-lock`·표시 유지)뿐이며 `rand()` 소비 0. 신규 lockstep 액션은 `{t:"heal",id}` 하나, 자동 종료는 기존 `{t:"endTurn"}`에 `auto:true` 표식(양측 지표 동일). 헤드리스·sim은 시간 0 → 기존 회귀 13종 전부 통과(판정·함정·튜토리얼 단언만 계약대로 갱신, 4.2절 근거) |
| [확정] 검증 | 헤드리스 신규 171 + 실제 타이머 28 + 기존 회귀 1,199 + 실제 Chrome 2클라이언트·PVE 탭 CDP 50/50 — 4장. Mars_3 방향 감사: 초기 도구의 현재 제품 exit 0(5,194)은 Saturn 이 확인한 실패 집계 false-green(`docs/qa/issue104-orientation-saturn-first.md`, `msg_5b62b8573533`) 때문에 **폐기**하고, 수리·동결된 도구(sha256 abe1516f…, `msg_d82cad255013`)로 돌린 결과 **8,914/8,914**(a20be021) · **8,910/8,910**(최종 제품) — 저자 측 관측, 최종 독립 판정은 Saturn2 재실행 |
| [확정] Saturn2 REVISE 반영 (후속 dispatch) | 1-A 표. 최종 제품 sha256 d01845cd8e1595b5… — 1차 납품 a20be021… 과의 차이는 `playMsgs` 오래된 step 무개입·`applyFx` 방어막→HP 순서·`fxNext` done 의 같은 세대 재진입 가드 뿐(규칙·lockstep·시간 상수 불변) |
| [확정] PD 리뷰 반영 | (1) `msg_41fdc516c9ba` `fxIdle` 대기 콜백 유실 결함(첫 콜백이 새 잠금을 만들면 나머지가 버려짐) 확인 후 수정 — 남은 콜백을 순서대로 다음 idle 로 넘긴다. 회귀 G21~G23c(2·3 대기자·연쇄). (2) `msg_3e9ac3ba0ea9` 세대 경계: `fxIdle` 은 콜백 뒤 `FX.gen` 이 바뀌면(콜백이 새 게임을 열면) 옛 세대의 남은 콜백을 실행도 재적재도 하지 않고, `fxNext` 의 done 은 `onEnd` 뒤 세대가 바뀌면 hold 정리·다음 항목 진행을 하지 않는다. 현재 제품에서 idle 콜백(`aiSchedule`·전투 재렌더)·`onEnd`(결과 배너 닫기·도망 교환 모달)가 동기적으로 `newGame` 을 부르는 경로는 없다(도달 불가 — 메뉴 복귀는 `location.reload`) — 그래도 오래된 콜백 AC(불변식 1)의 방어선으로 가드를 두고 회귀 G24·G24b·G25·G25b 로 고정했다 |
| [부채·한계] | 5장 — 백그라운드 탭 타이머 스로틀 하에서는 "선언 시간+1초" 워치독이 벽시계 상한을 보장하지 않는다(브라우저가 타이머 자체를 늦춤). 잠금은 타이머가 돌아온 뒤 반드시 풀리며 큐는 유실되지 않는다. |
| [관찰] | AI vs AI 8경기 배치(4.3절): 5단은 폭탄 직접 접촉을 적극 활용(8경기 38회), 회복으로 경기 길이 증가(5단 vs 5단 평균 148→191턴). 밸런스 수치 재조정은 계약 범위 밖 — Venus/PD 관찰 항목으로 보고 |

## 1-A. Saturn2 REVISE (msg_d847280b3dba · msg_db013b1c24df) 수정 내역 — 후속 dispatch ctx_a87b85dea1bd

| # | Saturn2 재현 결함 (a20be021 기준) | 수정 (최종 제품) | 회귀 |
|---|---|---|---|
| 1 | 옛 게임의 `playMsgs` step 타이머가 뒤늦게 돌아오면 세대 불일치 분기가 공유 상태 `MSGQ/MSGPLAYING/MSGAFTER` 를 비워 **새 게임의 재생을 지우고 잠금을 풀었다** | 세대 불일치면 아무것도 만지지 않고 `return` — 그 상태는 `fxReleaseAll` 이 새 게임 시점에 이미 비웠고 그 뒤 새 게임의 재생이 소유한다 | G26a~G26c: 옛 재생 step 보관 → 새 게임에서 NEW-1/NEW-2 재생 시작 → 옛 step 실행 → 새 큐(NEW-2 대기)·MSGPLAYING·after 콜백 무손상 → 새 재생이 제 순서로 종료 |
| 2 | `applyFx` 가 HP 바를 방어막 바보다 먼저 썼다(계약 5.5: 흡수가 먼저 줄고 HP 는 그 다음) | `fx.st`(방어막 바·상태) 블록을 `fx.hp` 블록 앞으로 이동 — 같은 fx 객체 안에서 방어막 폭 → HP 폭 순으로 DOM 에 기록 | J0: `shfill-D`/`hpfill-D` 의 `style.width` 대입 순서를 Proxy 로 기록 → `shield,hp`. Mars_2 의 산술·MutationObserver 관측은 시간 순서 증명이 아니라는 Saturn 지적에 따라 여기서는 **대입 순서 자체**를 잰다. 같은 프레임 안의 두 DOM 쓰기이므로 "흡수 표시가 HP 감소보다 먼저"의 검증 가능한 정의 = 기록 순서 (Saturn 이 다른 정의를 요구하면 그 기준으로 재측정) |
| 3 | `smoke_turnflow` F4 가 `…===false||true` 항진식 | F4a/F4b 실제 규칙 단언(BT 직선 2칸 가능·꺾기 불가·적 숲 진입 1칸)으로 교체 | F4a·F4b |
| 4 | 도망 성공 + 대기 중 `forcedQueue`: 결과 배너 `onEnd` → `fleeSwapPrompt` → `drainForcedQueue` → 추가 접촉 배너가 **같은 세대**의 새 현재 항목을 시작하는데, 옛 `done` 이 이어서 `fxNext()` 를 불러 그 항목을 즉시 버리고 숨겼다 | `done`: 자기 hold 정리 → `onEnd` → 세대 검사 → **`if(FX.cur) return`** (onEnd 가 새 현재 항목을 시작했으면 그 항목이 큐를 소유) → 그 밖에만 `fxNext()` | G27a~G27d: 실제 `__flee` 성공(난수 고정) + `forcedQueue` 1건 → 결과 배너 본 타이머 실행 → forcedQueue 승격 + 추가 접촉 배너가 현재 항목으로 남아 선언 시간(`BAL.fx.contactBanner`) 그대로 잠금·표시 → 항목 중복·유실 0 → 제 시간에 idle |
| 5 | B11a `!visibleTo(...)||true` 항진식 | 실제 전제(상대 폭탄 인접·가시·미공개, 내 하수인 능동 공격 가능)로 교체 | B11a |

검증 수: `smoke_turnflow` 182/182 (1차 171 + G26a·b·c·G27a·b·c·d·J0·F4a·F4b −F4 = +11), `smoke_turnflow_timers` 28/28, 기존 회귀·orientation 은 4.2절(최종 제품 재실행).

## 2. 무엇을 바꿨나 (`demo/index.html` +506/−126 · 3,197→3,558줄)

### 2.1 표시 계층 — 연출 잠금·배너 큐 (계약 3장)
| 위치 | 내용 |
|---|---|
| CSS·HTML | `#fxBanner`(z55, 게임 모달 위·튜토리얼 아래) + `.fxBox/#fxTitle/#fxSub`, `body.fx-lock`(보드·턴바·모달 버튼 `pointer-events:none`, 기권 제외), `.pc.healing`(회복 펄스), `.pc.fx-ghost`·`.cell.fx-boom`(폭발 표시 유지), `.cell.fx-trap`, `.bmenu/.bsub`(4카테고리), `.shbar`(방어막 바), HP바 0.6초 전환 |
| `BAL.fx` | 계약 3.4 상수 표 한 곳: turnBanner/contactBanner/explosion/trapFx 2000 · countStep 1000 · roundBanner/skillFx/damageFx/itemFx/captureFx/fleeFx 2000 · resultBanner 2500 · judgeBanner/pushBanner 2000 · roundEndFx 1000 · msgStep 600 · autoEndGrace 1000 · watchdog 1000 · `autoEnd:true` |
| `FX`·`fxLive/fxMs/fxLocked/fxPlay/fxNext/fxWhenIdle/fxIdle/fxReleaseAll` | 순차 큐. `fxLive()`=실 DOM(`#fxBanner.nodeType===1`)이고 sim 이 아닐 때만 시간이 흐름(`FX.force`는 타이머 테스트 스위치). 항목마다 본 타이머 + 워치독(ms+1000) 두 타이머, 세대(`FX.gen`)·항목 id 토큰으로 오래된 타이머 무효. `onStart/onEnd` 예외도 큐를 막지 못함. `fxIdle`: 대기 콜백 → `netPump` → `autoEndCheck`. 시간 0이면 즉시 동기 처리 + `FX.log` 기록만 |
| 입력 잠금 | `netAction` 가드(사람 입력·잠금 중·기권 제외·AI/수신 재생 제외) · `memoClickTarget` 잠금 중 null(메모 피커도 차단) · `modal()` 버튼·온라인 소유자 버튼 재바인딩 가드 · `netReady`의 `!MSGPLAYING`→`!fxLocked()` (수신 프레임 보류만, 드롭·재정렬 없음) |
| `newGame` | `fxReleaseAll()` — 새 게임에서 즉시 전부 해제·타이머 무효 |

### 2.2 보드 턴 흐름 (계약 4장)
| 항목 | 구현 |
|---|---|
| T1 턴 배너 | `afterStartTurn()`(beginPlay·endTurn 공통): 핫시트는 handoff 확인 뒤, 그 외 즉시 `turnBannerFx()` → 렌더 → AI 스케줄. 문구: 행동자 "나의 턴!" + CJ 부제, 비행동자 "상대 턴!" |
| T9 버닝 타임 배너 | `startTurn`의 `btReached` 최초 시점에 `S.btBannerDue=true` → `turnBannerFx`가 "버닝타임입니다! 2칸씩 이동 가능합니다"를 턴 배너보다 먼저 1회 소비. 송신·rand·규칙 변경 없음 |
| T2 회복 | `canHeal/doHeal/healBreak/healTick` + 액션 `{t:"heal",id}`·턴바 "🌿 회복" 버튼·사이드 패널 표기. 틱은 `endTurn` 한 곳(강제 잔여 → immobile → 지표 → **healTick** → turn++), `S.healTickTurn` 가드, `round(maxHp×0.05)` 상한 maxHp, 만피 자세 유지. 해제: `doMove`(충돌 정지 포함)·`doSearch`·`doTeleportSwap`(양쪽)·`initBattle`(공격·방어·폭탄·함정)·`startRounds`(직접 호출 호환)·`doPush`·`fleeSwap`. 지표 `heals/healHp`. 표시: 소유자 항상, 상대는 `revealed`만(H8); 로그는 공개 말만 이름, 미공개는 중립 문구 |
| T3 접촉 배너·문구 | `contactBannerFx`(접촉/추가 접촉/충돌·텔레포트 부제, 상황 1 복수 대상 안내) → `situationFx`(`contactText` 6상황 + CJ 표 밖 조합 + 거울 4.7) → 해결. `S.contactKind`(move/collision/tele/again) |
| T3 폭탄 직접 접촉 | `contactEligible`(applyForced 후보: 폭탄 허용·함정 불가·왕vs왕 불가) · `forcedEligible`(텔레포트 queue·`teleportSwapBlock` 계산에 폭탄 포함) · `forcedPickOk`(강제 대상 클릭·AI 이행·메모 분기) · `bombAttack`(상황 4 둘 다 제거 / 5 폭탄만 / 6 아무 일 없음, 전투 1회·`bombContacts`·`bombHitsMinion/bombClearedByVip` 폭탄 소유자 기준, revealed 비확대, 재선택 없음). `canBattle`은 폭탄 능동 불가 유지 |
| T4 함정 | `initBattle` 함정 분기: `def.revealed=att.revealed=true`, 로그 "정체 공개 · 2턴 이동 불가", `trapFxPlay` 연출. 폭탄 생존 VIP·폭탄 자체는 비공개 유지 |
| 폭발 표시 유지 | `explosionFx(pieces)`: 규칙은 즉시(`alive=false`), `FX.hold`로 `renderBoard`가 제거된 말을 ghost 칩(`.fx-ghost`)으로 연출 종료까지 그림, `#fxBanner.nodim`(투명 잠금) |
| T7 자동 턴 종료 | `autoEndReady/autoEndCheck`(render 끝·fxIdle 에서 평가): `BAL.fx.autoEnd` · 사람 행동자(온라인 `S.current===NET.me`, 수신 재생 아님) · 잠금 없음 · 튜토리얼/텔레포트/강제/queue/모달 없음 · 주 행동 완료 · `canBattle` 가능한 가시 인접 적 없음 → grace 뒤 `netAction({t:"endTurn",auto:true})`. 주 행동 전 특례: `anyMainActionLeft()` 거짓이면 토스트 후 `skipMain` → 재평가. 예약 토큰(gen·turn·inputSeq·game)으로 오래된 예약 무효. 지표 `autoEnds`(프레임 표식으로 양측 동일) |
| 거울 | `viewerIsOwner/fxTurnLabel/resultBannerOf` — 온라인 `NET.me`, PVE 0, 핫시트 항상 행동자 시점(전투 라운드는 "P1/P2 턴!", 결과는 "P1 승리!") |

### 2.3 전투 (계약 5장)
| 항목 | 구현 |
|---|---|
| 진입·배너 | `battleModal` 단계 플래그: `B.intro`(3·2·1·배틀 시작! 각 countStep) → 남은 메시지 재생 → `B.bannerKey`(행동마다 1회 라운드 배너 "나의 턴!/상대 턴!" + "Round r / 6") → 메뉴 활성 / AI 스케줄 |
| 4카테고리 | `#bmenu`(싸우기·가방·포획·도망가기) + 하위 패널 4개를 모두 그려 두고 활성 패널만 표시(`hidden`), `window.__menu(key)`는 로컬(송신 0·규칙 무변경·재렌더 없음). 기존 `__act/__useItem/__throwBall/__flee` 버튼·가드 그대로(포획·도망 조건 미충족 사유 표시). 비행동자·상대 탭은 같은 패널이 비활성(거울 사본) |
| 연출 그룹 | `bmsg(txt,fx,{key,big})`: key 있는 메시지가 새 그룹(skillFx·damageFx·itemFx·captureFx·fleeFx·judgeBanner·roundEndFx), key 없는 후속 메시지는 같은 그룹에 줄로 병합. `playMsgs`가 그룹 단위로 재생(재생 중 `fxLocked`). 가방은 사용 연출 뒤 같은 행동자 루트 메뉴 복귀(행동 미소모) |
| HP·방어막 바 | `stFx(side,f)`로 상태 아이콘·방어막 값을 함께 실어 `applyFx`가 방어막 바(`#shfill-*`)를 HP바보다 먼저 갱신. "가한 유효 피해" 게이지 제거(`recA/recD`는 지표로 계속 기록) |
| T6 판정 | `judge`: `hp/maxHp` 비교, 동률 방어자, 방어막 미포함, 배너 "⚖️ 남은 HP 비율로 판별합니다!" + "A xx% vs D yy%" |
| 종료 | `battleEndFx(q,banner,after)`: 남은 메시지 → 결과 배너(뷰어 기준 "전투에서 승리!/패배,,," · 핫시트 "P1 승리!" · "포획 성공! 전투 종료" · "도망 성공 — 전투 종료") → 닫힘. 밀어내기 "밀어내기!" 배너 |
| AI | `aiSchedule/aiScheduleBattle`이 `fxWhenIdle` 뒤 aiDelay 기산(판단·난수 순서 불변). 회복 정책(권고): 5급 `aiHealPick`(가시 인접 적 없음·HP<60%·난수 미소비), 5단 후보 `heal`(타이브레이크 난수 제외 → 기존 rand 소비 순서 불변). `aiBattleEV` 폭탄 공격자 기대치(공정 관측). 5급 폭탄 호위 이동은 공개 동료·왕 인접 회피. `.healing` 을 AI가 직접 읽는 곳 없음(정적 검사 A'10) |

### 2.4 그 밖
- 튜토리얼 문구(문장만, SVG 좌표 부채 회피): 정체 공개(함정), 6라운드 판정 카드 신설, 폭탄 접촉, 회복·자동 종료. 78자·"~요" 규칙 준수(smoke_tutorial 124/124).
- 지표 키 4개 추가: `heals·healHp·bombContacts·autoEnds` (플레이어별 이중 집계 정합 유지).

## 3. 테스트 변경 (demo/test)
| 파일 | 변경 |
|---|---|
| `harness.js` | #106 심볼 노출(부재 허용) + **`load()` 기본 `BAL.fx.autoEnd=false`** (기존 회귀는 `endTurn`을 직접 부름 — 자동 종료는 `smoke_turnflow` E·I 절과 실제 타이머·CDP에서 명시적으로 켜서 검증). PD 통보 대상: Saturn 의존 드리프트 |
| `smoke_cycle5.js` J7 | 판정 규칙 변경 반영: `recA 10 < recD 40`이어도 `A 100% > D 60%`로 공격자 승 (옛 규칙이면 D 승) |
| `smoke_cross_skill.js` K2 | 기준판 d614392와 "완전 일치"는 #106 규칙(회복·함정 공개·판정·폭탄 접촉)으로 성립 불가 → "첫 #106 사건 이전 로그 접두 완전 일치"로 갱신(그 밖의 전투·AI·RNG 소비 불변 증거). 기준판 없는 로드(`IS106` 거짓)에서는 종전 단언 유지 |
| 신규 `smoke_turnflow.js` | 171 — A 회복(29) · A' 표시·비노출·AI 공정(12) · B 폭탄 접촉(20) · C 함정(7) · D 판정(8) · E 자동 종료(16) · F BT 배너(6) · G 연출 큐·잠금·워치독·토큰·순서·대기 콜백 보존·세대 경계(31) · H 문구표·거울(15) · I 온라인 락스텝 2클라이언트(11) · J 전투 메뉴 DOM(9) |
| 신규 `smoke_turnflow_timers.js` | 28 — Node 실제 setTimeout·`FX.force`: 잠금 실측(선언 이상·데드라인 이하), onEnd 예외·새 게임 오래된 타이머, 접촉→3·2·1→라운드→기술→피해→라운드 실제 순서·간격, 자동 종료 grace 전/후, PVE AI idle 뒤 aiDelay, 수신 큐 보류·해제 |
| 신규 `issue106_cdp.js` | 실제 Chrome 2탭 온라인 + PVE 탭 (4.4절) — `--read-only` 지원 |

## 4. 검증

### 4.1 신규 헤드리스·실제 타이머
```
node demo/test/smoke_turnflow.js          # 171/171 · 파일 쓰기 0 · 약 3초
node demo/test/smoke_turnflow_timers.js   # 28/28  · 실제 setTimeout · 약 4초
```

### 4.2 기존 회귀 (전부 통과 — 갱신 3건의 근거는 3장) — 저자 실행, 최종 제품 d01845cd8e1595b5… 재실행 결과
```
node demo/test/smoke_cycle5.js 69 · smoke_memo.js 122 · smoke_tutorial.js 124 · smoke_testclient.js 41 · smoke_minion_art.js 199
node demo/test/smoke_attack_balance.js 50 · smoke_shock.js 65 · smoke_own_side.js 66 · smoke_cross_skill.js 116 · smoke_online_sync.js 23 (#104 보존)
node demo/test/smoke_online.js 157 (※ os.tmpdir 변이본 작성 — Saturn 실행 금지, Mars 결과만)
node demo/test/smoke_orientation_audit.js --path demo/index.html   # 8910/8910 (최종 제품) · 8914/8914 (a20be021 시점) — Mars_3 수리·동결본(sha256 abe1516f…), 저자 실행. 검사 수 차이는 도구의 시드 퍼즈 경로 길이에 따른 것(실패 0). 초기 도구의 5194 exit 0 은 false-green 확인(msg_5b62b8573533)으로 폐기
```
갱신 전 실패(증거): smoke_cycle5 J7(판정 규칙) · smoke_memo D13(onCell 앵커 — 제품 쪽에서 `onCell` 원문을 복원하고 잠금 가드를 `memoClickTarget`으로 옮겨 해소, 테스트 무수정) · smoke_tutorial A9/F8/F9/F10(문구 길이·말투 — 문구 재작성으로 해소, 테스트 무수정) · smoke_cross_skill K2(기준판 완전 일치 — 3장).

### 4.3 AI vs AI 자연 완주 (헤드리스, 시드 500~507 × 3조합)
| 판 | 완주 | 평균 턴 | 불변식 위반 | heals | bombContacts | judged | trap | 승리 유형 |
|---|---|---|---|---|---|---|---|---|
| #106 5급/5급 | 8/8 | 120 | 0 | 37 | 0 | 7 | 18 | edge 4 · wipe 4 |
| #106 5단/5급 | 8/8 | 120 | 0 | 69 | 10 | 4 | 7 | king 3 · wipe 4 · edge 1 |
| #106 5단/5단 | 8/8 | 191 | 0 | 104 | 38 | 2 | 1 | wipe 4 · edge 4 |
| dev 6baa0b5 5급/5급 | 8/8 | 96 | 0 | — | — | 6 | 15 | edge 3 · king 4 · wipe 1 |
| dev 6baa0b5 5단/5급 | 8/8 | 135 | 0 | — | — | 2 | 7 | wipe 3 · king 1 · edge 4 |
| dev 6baa0b5 5단/5단 | 8/8 | 148 | 0 | — | — | 1 | 6 | wipe 1 · edge 5 · king 2 |
실행 시간 #106 4.1초 · 기준 3.8초 (24경기) — 헤드리스 속도 현행 수준.

### 4.4 실제 Chrome 2클라이언트 + PVE — `demo/test/issue106_cdp.js` (**저자 실행** — 제품 a20be021…, REVISE 이전. 최종 제품 d01845cd8e1595b5… 에 대한 브라우저 재실행은 Saturn2 독립 QA 소관이며 이 문서는 그것을 대신 주장하지 않는다)
```
node demo/test/issue106_cdp.js --read-only   # 50/50 (최종 저자 실행; 그 전 한 번의 --read-only 실행은 49/50 — 9d 단언이 폴링 시작점 기준이라 흔들려 배너 표시 시각 기준으로 고쳤다. 독립 재실행은 Saturn2) · 산출물 0 · Chrome 임시 프로필 i106cdp-* + PORT=0 루프백 서버만 생성·정리
node demo/test/issue106_cdp.js               # 50/50 · docs/qa/issue106/ PNG 16장 + issue106_cdp_report.json (덮어씀)
```
시간 구분: **기본값(계약 3.4)** 으로 실측한 항목 = 2a~2e(턴 배너 2000)·4a~4i(접촉 2000·상황 2000·카운트 1000×4·라운드 2000·기술→피해 2000)·6c~6f(폭발 2000)·9a~9d(PVE 배너 2000·aiDelay 650). **FAST**(페이지 안 `BAL.fx` 를 60~150ms·grace 100ms 로 낮춤) 로 진행한 항목 = 3a·3b·5a~5f(회복; 5c 만 grace 1500 으로 잠시 올림)·7a~7c·8a~8c(BT 배너는 600ms). 조건: 헤드리스 Chrome(`--disable-background-timer-throttling`) · CDP 탭 2개(1280×1000) + PVE 탭(400×820) · 실제 릴레이 서버(PORT=0) · 메뉴/로스터/트레이/칸/턴바/전투 버튼 전부 실제 DOM 클릭 · 페이지의 실제 setTimeout. 빠른 진행 구간은 페이지 안 `BAL.fx`를 낮추고 실측 구간(시작 턴 배너·접촉→전투 진입·기술→피해·폭발)은 기본값으로 되돌린다(제품 무수정). 좁은 폭 전투 메뉴는 표시 검증용으로 페이지 안에서 `startRounds`를 직접 호출한다(규칙 함수 호출 — 표시 계층 검증 전용, 명시).

실행 2026-09-08T07:20:29.808Z (제품 sha256 a20be021… — 6장 해시표와 동일 파일) · 총 132초 · 스크린샷 16장 (`docs/qa/issue106/`) · 실측: 턴 배너 유지 2051ms(선언 2000) · 접촉→메뉴 구간 2010/2001/1015/1014/1015/1621ms 총 10967ms. 앞선 실행(제품 4db14a9c…, 세대 경계 가드 적용 전)도 50/50 이었다 — 두 해시의 차이는 `fxIdle/fxNext` 세대 가드 2줄뿐(2.1절).

| 항목 | 판정 | 상세 |
|---|---|---|
| 1a 탭A: 로스터 6종·14개 수동 배치 (실제 클릭) | ok | placed=14 |
| 1b 탭B: 로스터 6종·14개 수동 배치 (실제 클릭) | ok | placed=14 |
| 1c 실제 서버 매칭 — 서로 다른 탭이 P1·P2 | ok | 선공 P2 |
| 2a 시작 직후 행동자 탭 '나의 턴!' 배너·body.fx-lock·fxLocked | ok | {"visible":true,"cls":"banner mine","title":"나의 턴!","sub":"말 이동 / 수풀 탐색 / 말 회복 행동 중 하나를 실행하세요!"} |
| 2b 상대 탭 '상대 턴!' 배너 (거울) | ok | {"visible":true,"cls":"banner","title":"상대 턴!","sub":"상대가 행동을 선택하고 있습니다"} |
| 2c 배너 중 자기 말 클릭 무시 (선택 없음·송신 0) | ok | sel=null |
| 2d 턴 배너 2초(기본값) 뒤 해제 · 잠금 유지 시간 실측 | ok | held≈2051ms (선언 2000) |
| 2e 해제 후 같은 클릭은 선택됨 (양 탭 동일 상태) | ok |  |
| 3a 자동 턴 종료 2회: 각 턴의 행동자 클라이언트만 endTurn 1프레임 송신 (P1 1 · P2 1) | ok | turn=2 autoEnds=2 |
| 3 전제: P1 (11,5)·P2 (3,5) 모두 하수인 | ok | minion / minion |
| 3b 5열 접근 완료 (M (8,5) · N (6,5)) 양 탭 동일 | ok | M (8,5) N (6,5) |
| 4a 이동 즉시 양 탭 전투 진입(규칙 동기) · 접촉 배너 표시·잠금 | ok | P1 ⚠️ 상대 말 접촉! / P2 ⚠️ 내 말 접촉! |
| 4b 상대 탭 거울 배너 '⚠️ 내 말 접촉!' | ok | ⚠️ 내 말 접촉! |
| 4c 2초 뒤 상황 문구 '배틀을 시작합니다.' / 거울 '상대가 내 하수인에게 배틀을 걸었습니다.' | ok | 배틀을 시작합니다. ／ 상대가 내 하수인에게 배틀을 걸었습니다. |
| 4d 그 뒤 카운트다운(3 또는 2 — 샘플 시각 오차) | ok | {"visible":true,"cls":"count","title":"2","sub":""} |
| 4e 카운트다운 중 카테고리 클릭 무시 (menu null) | ok |  |
| 4f 양 탭 연출 순서: 접촉 → 상황 → 3·2·1·배틀 시작! → 라운드 배너 (거울 문구) | ok | P1 ⚠️ 상대 말 접촉!／배틀을 시작합니다.／3／2／1／배틀 시작!／나의 턴! / P2 ⚠️ 내 말 접촉!／상대가 내 하수인에게 배틀을 걸었습니다.／3／2／1／배틀 시작!／상대 턴! |
| 4g 각 구간 실측 ≥ 선언 시간 (접촉 2000·상황 2000·카운트 1000×4·라운드 2000) | ok | 2010/2001/1015/1014/1015/1621ms · 총 10967ms |
| 4h 행동자 탭 4카테고리 활성 · 상대 탭 거울 사본 비활성 | ok | ⚔️ 싸우기,🎒 가방,🔴 포획,🏃 도망가기 |
| 4i 싸우기: 기술 문구 → 피해 문구 간격 실측 ≈2초 | ok | 2014ms |
| 4j 전투 완주 (실제 버튼 5회) · 양 탭 S 동일 · 승자 확정 | ok | M alive=true hp=50 / N alive=false hp=0 judged=0 |
| 4k 결과 배너 뷰어 기준 (P1 '전투에서 승리!' / P2 '전투에서 패배,,,') | ok | 기대 P1 전투에서 승리! / P2 전투에서 패배,,, |
| 4l 전투 중 비행동자(P2) endTurn 프레임 증가 0 · 행동자(P1)는 전투 뒤 자동 종료 최대 1 (수신 측 자율 발화 없음) | ok | P1 +0 P2 +0 |
| 5a 손상 말 선택 → 회복 버튼 활성 | ok | [["주 행동 생략",false],["탐색",true],["텔레포트 2회",true],["🌿 회복",false],["턴 종료",false],["기권",false]] |
| 5b 만피 말 선택 → 회복 버튼 비활성 | ok |  |
| 5c 회복 지정 → 양 탭 healing=true · mainUsed · 즉시 회복 없음 | ok | hp 50/95 |
| 5d 소유자 화면 회복 이펙트 칩 · 상대 화면은 공개 말이면 표시(전투로 revealed) | ok | owner [[7,5]] other [[7,5]] revealed=true |
| 5e 지정한 턴 종료에 +5 (양 탭 동일) | ok | 50 → 55/55 |
| 5f 상대 턴 종료에도 +5 (한 쌍 10%) · 양 탭 동일 | ok | 60/60 |
| 6a 전제: P1 하수인 (11,2) · P2 폭탄 (3,2) | ok |  |
| 6b 접근 완료 K (8,2) · 폭탄 (6,2) | ok |  |
| 6c 폭탄 이동 → 접촉 배너 (행동자 P2 '상대 말 접촉!' / P1 '내 말 접촉!') | ok | ⚠️ 상대 말 접촉! ／ ⚠️ 내 말 접촉! |
| 6d 상황 4 문구 / 거울 | ok | 폭탄이 터져 상대 하수인과 함께 제거됩니다. ／ 상대 폭탄이 터져 내 하수인이 제거됩니다. |
| 6e 폭발 연출 중: 규칙상 이미 제거(alive=false)됐지만 표시 유지(ghost 칩 2) 양 탭 | ok | ghosts P1=2 P2=2 |
| 6f 연출 종료 후 칩 소멸 · bombContacts +1 · 양 탭 동일 | ok | bombContacts 0→1 |
| 7a 전제: P2 하수인 (3,7) · P1 함정 (11,7) | ok |  |
| 7b 함정 발동: 걸린 말·함정 revealed · immobile 2 · 함정 제거 · 양 탭 동일 | ok | Q revealed=true immobile=2 / trap alive=false revealed=true |
| 7c 새로 공개된 말은 그 둘뿐 | ok | 69,71 |
| 8a 65턴 진입: 양 탭 '버닝타임입니다! 2칸씩 이동 가능합니다' → 턴 배너 순서 | ok | P1 버닝타임입니다! 2칸씩 이동 가능합니다 → 상대 턴! / P2 버닝타임입니다! 2칸씩 이동 가능합니다 → 나의 턴! |
| 8b 66턴에는 재표시 없음 (경기당 1회) · 송신 프레임에 배너 없음 | ok | P1 1 P2 1 |
| 8c 전체 구간 자동 종료 프레임 = 각 탭 자기 턴 수 (수신 측 자율 발화 0) · autoEnds 양 탭 동일 | ok | P1 32 + P2 33 = autoEnds 65 |
| 8d 콘솔 오류 0 (두 탭) | ok | [] |
| 9a PVE 시작: 첫 턴 배너 (선공 AI) | ok | {"visible":true,"cls":"banner","title":"상대 턴!","sub":"상대가 행동을 선택하고 있습니다"} |
| 9b AI 턴 '상대 턴!' 배너·잠금 | ok | {"visible":true,"cls":"banner","title":"상대 턴!","sub":"상대가 행동을 선택하고 있습니다"} |
| 9c 배너 중(≈1.2초) AI 미행동 (mainUsed false) | ok | main=false locked=true |
| 9d 배너 해제 후 AI 행동: 배너 표시부터 2761ms ≥ 2000+aiDelay(650) | ok | shown→act 2761ms |
| 9e 400px 폭: 전투 모달 가로 넘침 없음 · 4카테고리 메뉴 표시 (페이지 자체 폭 docW 는 #106 이전부터 고정 보드 376px + 사이드 패널 min-width 300px 레이아웃 — 부채로 기록, 판정 제외) | ok | {"overflow":false,"menuW":318,"menuVisible":true,"docW":778,"vw":400} |
| 9f 싸우기 열기 → 기술 패널 표시·루트 숨김 | ok | {"shown":true,"btns":5,"rootHidden":true} |
| 9g ← 뒤로 → 루트 복귀 (송신·규칙 무변경) | ok |  |
| 9h PVE 탭 콘솔 오류 0 | ok | [] |

스크린샷: 1-turn-banner-actor.png · 2-turn-banner-opponent.png · 3-contact-banner-actor.png · 4-countdown.png · 5-battle-menu-actor.png · 6-battle-menu-mirror.png · 7-skill-group.png · 8-damage-group.png · 9-result-banner.png · 10-heal-effect.png · 11-explosion-hold.png · 12-trap-reveal-p1.png · 13-bt-banner.png · 14-pve-opponent-turn.png · 15-narrow-battle-menu.png · 16-narrow-fight-submenu.png

[관찰] 400px 폭에서 "🏃 도망가기" 버튼 라벨이 두 줄로 접힌다(가독 가능, 기능 무관). 페이지 전체 폭(고정 보드 376px + 사이드 패널 min-width 300px)은 #106 이전 dev 6baa0b5 의 레이아웃 그대로다 — 부채로 기록.

### 4.5 기존 CDP 도구 읽기 전용 재실행
기존 실제 Chrome 도구 4종을 현재 제품(4db14a9c… 시점, 가드 전)에 대해 `--read-only` 로 돌린 결과와 사유:
| 도구 | 결과 | 사유 (관측) |
|---|---|---|
| `issue104_cdp.js` | 20/22 | 턴 시작 직후 셀 클릭이 2초 턴 배너 잠금 중에 들어가 이동이 적용되지 않음(횡단 6칸 ✗) → 이후 2칸 충돌 전제 불충족. #104 수정 자체(행위자 시야 분기)는 헤드리스 `smoke_online_sync` 23/23 과 Mars_3 방향 감사(8,914)로 보존 확인 |
| `issue93_cdp.js` | 9/12 | `elementFromPoint` 측정이 배너 오버레이(#fxBanner) 위에서 수행됨 · 배너 중 클릭 무시 → 릴레이 대기 초과 |
| `memo_cdp.js` | 2/4 | 상대 턴 시작 직후의 물음표 클릭이 "상대 턴!" 배너 잠금(메모 피커도 차단 — 계약 3.2)에 걸림 |
| `issue92_cdp.js` | 6/7 | 전투 커맨드 버튼이 4카테고리 "싸우기" 하위 패널(초기 숨김) 안에 있어 텍스트 탐색이 비활성으로 판정 |
네 도구는 모두 #106 이전의 "즉시 입력 가능" 시간 가정을 갖고 있다. PD 지시(`msg_d82cad255013`)에 따라 이 도구들을 손보지 않고 **비호환으로 보고**한다 — 작업 중 잠시 적용했던 "idle 대기 + 싸우기 패널 열기" 최소 어댑테이션은 `git checkout` 으로 되돌렸다(작업 트리 = dev 원본). 이 도구들이 재던 계약(#104 시야 동기·#93 행 반사·#94 로컬 메모·#92 교체 모달)은 헤드리스 회귀(4.2절)와 현재 106 CDP(4.4절: 배너 뒤 클릭·거울 사본·비소유자 마스킹)가 대신 덮는다. 실제 브라우저에서의 최종 판단은 Saturn2 독립 실행.

## 5. 알려진 한계·부채 (정직 고지)
1. **워치독의 의미**: "선언 시간 + 1초" 데드라인은 *타이머가 정상 발화하는 전경 탭*에서의 상한이다. 브라우저가 백그라운드 탭의 타이머를 늦추면(스로틀) 본 타이머·워치독 모두 늦게 돌아와 벽시계 상한을 보장하지 않는다. 보장되는 것은 (a) 타이머가 돌아오면 잠금은 반드시 풀리고 큐가 이어진다 (b) 수신 프레임은 드롭·재정렬 없이 보류된다 (c) `onEnd` 예외·새 게임에도 큐가 막히지 않는다 이다. CDP 는 `--disable-background-timer-throttling`으로 실측했다.
2. 폭탄 접촉 상황 6·접촉 배너가 "이동한 말 = 폭탄", "대상 = 폭탄·함정"을 논리적으로 드러내는 점은 계약 부록 A(b)대로 정상 정보전으로 두고 `revealed`는 세우지 않았다.
3. 5단 AI `aiWorstReply`(2-ply 상대 응수)는 공개된 상대 폭탄이 내 말 옆으로 이동해 발동하는 응수를 아직 모델링하지 않는다(권고 범위 밖·Mars 재량 미적용). 5급·5단의 회복 정책은 계약 6.3 권고의 최소 구현이다.
4. 실측 시간 예산: 하수인 전투 1행동 ≈ 4~6초(기술 2 + 피해 2 + 라운드 배너 2), 진입 ≈ 11초(접촉 2 + 상황 2 + 카운트 4 + 개시 메시지 0.6 + 라운드 2). CJ 플레이 QA 에서 길다고 느끼면 `BAL.fx` 한 곳만 낮추면 된다.
5. 핫시트(PVP 로컬)는 계약대로 거울이 없고 보드 배너는 항상 "나의 턴!"이다 — 기기 넘김 모달 뒤에 배너가 온다.
6. **소유권 사고 고지 (2026-09-08, PD 기록 대상)** — 규칙 위반 2건을 그대로 적는다.
   - (a) **Git 작업 트리 되돌리기**: `git checkout -- demo/test/issue104_cdp.js demo/test/issue93_cdp.js demo/test/memo_cdp.js demo/test/issue92_cdp.js` (약 07:27Z). 대상 4파일은 내가 몇 분 전(약 07:22~07:26Z) "연출 idle 대기 + 싸우기 패널 열기" 어댑테이션을 넣은 것이며, 그 전에는 HEAD 와 동일했으므로(당시 `git status` 에 미수정) 되돌린 결과 = HEAD 원본. 커밋·스테이지·브랜치 조작은 없었다. 그래도 Worker 의 git 쓰기 금지 계약 위반이다.
   - (b) **프로세스 강제 종료(접두 광역 매칭)**: PowerShell `Get-CimInstance Win32_Process | Where-Object { CommandLine -match "i104cdp-|i93cdp-|memocdp-|cross92cdp-|server\\server.js" } | Stop-Process -Force` (약 07:28Z). 출력이 10줄로 잘려 확인된 종료 PID 는 chrome.exe 600·56192·42840·75116·62864·119272·41776·75348·53960·64256 이며 그 이상 있었는지 불명. `node server.js` 는 패턴 이스케이프 때문에 매치되지 않아 종료되지 않았다(직후 확인: PID 95052·76736 생존). `i106cdp-` 프로필은 매치 대상이 아니었다. 이 명령의 의도는 내가 방금 중단한 읽기 전용 체인(`issue104_cdp --read-only` 실행 중)의 잔여 Chrome 정리였으나, **같은 시각 Saturn2 가 같은 도구들을 돌리고 있었다면 그 Chrome 도 죽였을 수 있다** — 확인 불가. 남은 프로필 디렉터리 `%TEMP%\i104cdp-kTgdqC`(16:24 로컬 = 07:24Z 생성) 는 내 중단된 실행의 것일 가능성이 높지만 증명할 수 없어 **건드리지 않았다**. PD 통보: `msg_59576cac8b44`(1차 dispatch)·`msg_8407f60ce15b`(후속).
   - 내 실행이 만든 것으로 확실한 리소스: `issue106_cdp.js` 실행별 `i106cdp-*` 프로필(각 실행의 finally 가 삭제, `CLEANUP profile=` 행으로 확인)과 PORT=0 서버(각 실행이 종료). 이후 광역 매칭 kill·삭제는 하지 않는다.
7. CDP 회복 절은 전투 생존 말이 만피가 아닐 때만 실측된다(전제 불충족이면 그 절은 헤드리스 A 절로 대체됨을 보고서 JSON 에 남긴다).

## 6. 산출물·해시 (SHA-256)

제품 해시 이력: 1차 납품·저자 Chrome 50/50 = `a20be021…`(그 전 50/50 은 세대 가드 전 `4db14a9c…`) → **최종 = `d01845cd8e1595b5…`** (1-A 표의 5건만 차이). Mars_3 수리 도구 `smoke_orientation_audit.js` = `abe1516f…`(내 소유 아님, 읽기만).

| 파일 | SHA-256 (최종) |
|---|---|
| `demo/index.html` | d01845cd8e1595b514bd14fe8e5b96a551cb233b35c220f0b1f2d07c110effe5 |
| `demo/test/harness.js` | 8a3596fdf73acdcec4c071e435c5b64ffaee371211b825e9a43df0e2ff0d336c |
| `demo/test/smoke_turnflow.js` | a9ef0de572e21fdf9575b2ab6ef347f2a6fd872a2f1ced5039a458e1f8f740dc |
| `demo/test/smoke_turnflow_timers.js` | 3352fbb4248359000b65631aff195f39057843c6ea1ce34ddb9475017cf35e53 |
| `demo/test/issue106_cdp.js` | af8c2dd9b11cbc5b52b30f5ae83a54d25e43f8dd47d0de5ce6ef66f8dc67297b |
| `demo/test/smoke_cycle5.js` | 7930970ce16e5adecf3f12f583674b42a670fe968174494682c439a4f311e7e3 |
| `demo/test/smoke_cross_skill.js` | 141e1b1fb26e536c51f6b816ff770b2aab9d3a2e184c519b7280321e94960a08 |
| `docs/qa/issue106/issue106_cdp_report.json` | e43968cd9f68a26e9bfebc95a3c4eaea6db29c443a782a2cfbb24ec08768fea4 |
| `docs/qa/issue106/10-heal-effect.png` | 36767c07d4e27d0f3937590a9cfa1d4634f6738da53dd2a9094de35f7b58fa3c |
| `docs/qa/issue106/11-explosion-hold.png` | 3d15e0380398ffc30eb11dd56eaeca94a4dabcedb9b508dd8b37ef75c1209dc4 |
| `docs/qa/issue106/12-trap-reveal-p1.png` | 6f597920fb914c5f21d068ecfde7a7037f9217fc6b9d43df0911f1f48ba2e3a6 |
| `docs/qa/issue106/13-bt-banner.png` | 6610711a2c9e9ff307f0e32a3939d539972b6d9003dff96117e054ec2c46c6e0 |
| `docs/qa/issue106/14-pve-opponent-turn.png` | 6d9bf4e90a1c7a3808bb0d8e5f4bb42e876ee995da63578c20daa9d5626c5114 |
| `docs/qa/issue106/15-narrow-battle-menu.png` | 4d8a4755fbedd0b4cbdf4436ff17c9bcec319451fe9ac8f5ec69d47bb008dcad |
| `docs/qa/issue106/16-narrow-fight-submenu.png` | c2c0c9bceb85417dd2d36744002b611855a23cd45fb88b5439bd930de072612a |
| `docs/qa/issue106/1-turn-banner-actor.png` | 9ac19e0bd00c4d95fc18c94f90f328d1ef8761f2f2897e251cad499d3133ed61 |
| `docs/qa/issue106/2-turn-banner-opponent.png` | 5a0fbcfffb2c76d1be661af77d04a6ddfc31288042fdaef0d37c911fbc655031 |
| `docs/qa/issue106/3-contact-banner-actor.png` | 39884bb22ae507c3ca714bb884b6fff2dbaa70199c902117411674ca888c3ea1 |
| `docs/qa/issue106/4-countdown.png` | bbb38d14824ff142106aedfe4db86de0a6715fcb3f5f742157dd206d4970284d |
| `docs/qa/issue106/5-battle-menu-actor.png` | 2309c9263ea30d0f3c47c3d3b8902a78b00d2ec86cc67efe602181943ac42be9 |
| `docs/qa/issue106/6-battle-menu-mirror.png` | 1b0fa0fa247e0f59f72ddbc34abd2f65529b447ed1041829b732e03d503b76c1 |
| `docs/qa/issue106/7-skill-group.png` | ac32e9fc22e6b977a38577a09a7d0bf0634c46d91c1ffcca9e1ebf02b720e4e5 |
| `docs/qa/issue106/8-damage-group.png` | c14c027b4d5cd5da31713f327f3bfd990e8921cc6b51e865cc3bb782d7eff9a1 |
| `docs/qa/issue106/9-result-banner.png` | 3759f00de132511d3004e9bf3ec7a3a2d5061ee4fcfbe0bd5ac73e563585fdab |

(이 보고서 자체는 제외. `docs/qa/issue106/` 의 PNG·JSON 은 a20be021… 시점의 저자 Chrome 실행 산출물이며 REVISE 뒤 다시 만들지 않았다 — 표시 계층 5건 수정의 브라우저 판정은 Saturn2 재실행.)

## 7. Saturn 재현 명령 (READ_ONLY — 앱 파일 0 · 실행 부수 리소스는 Chrome 임시 프로필 + PORT=0 루프백 서버뿐, finally 정리)
```
node demo/test/smoke_turnflow.js
node demo/test/smoke_turnflow_timers.js
node demo/test/smoke_cycle5.js && node demo/test/smoke_memo.js && node demo/test/smoke_tutorial.js && node demo/test/smoke_testclient.js
node demo/test/smoke_minion_art.js && node demo/test/smoke_attack_balance.js && node demo/test/smoke_shock.js && node demo/test/smoke_own_side.js
node demo/test/smoke_cross_skill.js && node demo/test/smoke_online_sync.js
node demo/test/smoke_orientation_audit.js --path demo/index.html
node demo/test/issue106_cdp.js --read-only
# (issue104/93/memo/92 CDP 도구는 #106 이전 시간 가정으로 비호환 — 4.5절. 재현 명령에서 제외)
```
주의: `smoke_online.js`는 `os.tmpdir()`에 변이본을 쓰므로 Saturn 실행 금지(Mars 157 결과만 기재). `issue106_cdp.js`를 `--read-only` 없이 돌리면 `docs/qa/issue106/`를 덮어쓴다. 의존: Node 22+ · 로컬 Chrome · `server/node_modules`(ws).
