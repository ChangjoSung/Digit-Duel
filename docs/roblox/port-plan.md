# Roblox 포팅 플랜 (Ref #118)

- 기준: CJ Comment 2026-09-09 — "이거 로블록스로 포팅하고싶어. 디자인·그래픽은 Codex(Earth), 구현은 Claude Code(Mars)"
- 원본: `demo/index.html` v0.4.5 (dev 39f0222)
- 상태 구분: **확정** = CJ 지시·기존 GDD 그대로 / **추론** = 포팅상 기술 판단 (아래 "의도적 차이" 표) / **[기획 필요]** = 별도 표기

## 페이즈 로드맵

| Phase | 범위 | 상태 |
|---|---|---|
| **1** | 코어 룰 엔진 Luau 포팅 + 서버 권위 구조 + 매치메이킹 + 최소 클라 UI + 헤드리스 테스트 | ✅ (규칙 기준: **HTML v0.4.7 전량** — #121·#125·#129 + #146·#131·#130, 2026-09-10) |
| 2 | 클라 본 UI: 수동 배치·로스터 선택·전투 연출(FX 계약 #106)·Earth 아트 적용 · 3D 로비·테이블 매칭 | ✅ dev (PR #141·#142) — FX 연출은 미적용 |
| 3 | PVE AI 포팅 (grade5·dan5) + 봇 대전 + 보드게임 창(`roblox/구조.txt`) | ✅ dev (2026-09-10) — 튜토리얼·추측 메모는 Phase 4 로 이월 |
| 4 | 운영: 재접속·관전·랭크/매치메이킹 고도화, DataStore 전적 | 대기 |

## HTML → Luau 대응표

| HTML (index.html) | Roblox | 비고 |
|---|---|---|
| BAL 상수 | `src/shared/Config.luau` | 표시 상수(fx·aiDelay 등) 제외 |
| mulberry32 / setSeed | `src/shared/Rng.luau` | 골든 테스트로 JS 수열 일치 검증 |
| SKILLS·ROSTER·ARCH_TMPL·ITEMS | `src/shared/Data.luau` | 슬롯 인덱스 0~3 → 1~4 |
| newGame·mkPiece·applyRoster·genEvents | `Engine.new` 등 | |
| 유틸(visibleTo·adj·zoneOf·isBurning…) | `Engine` 메서드 | |
| canMoveTo·canBattle·doMove·applyForced | `Engine` | |
| 텔레포트 스왑·강제 전투 queue (#14·#18) | `Engine` | 2단 클릭 → `tele{aId,bId}` 1액션 |
| 밀기·재배치·도망 교환 (#114) | `Engine` | |
| 탐색·숲 이벤트·포획 (#12·#92) | `Engine` + pending | 모달 → pending 상태 |
| 전투 전체 (initBattle~judge~finishBattle) | `src/shared/Battle.luau` | |
| vipChoice 모달 체인 | pending "vip" + `vipPick` 액션 | 순차 A→D, 소유자만 |
| applyAction (netAction 액션 어휘) | `Engine:apply(actor, a)` | 서버 검증 추가 |
| renderBoard/Side 가시성 가드 | `src/shared/Views.luau` | 데이터 계층에서 은닉 |
| 릴레이 서버(server/server.js) 매칭 | `src/server/init.server.luau` | 대기 슬롯 1개 선착순 동일 |
| autoEndCheck (#106 T7) | `Engine:autoStep` | 아래 차이 참조 |

## 의도적 차이 (추론 — 검토 요청)

| 항목 | HTML | Roblox | 근거 |
|---|---|---|---|
| 동기화 모델 | 비권위 릴레이 + 시드 락스텝 | **서버 권위** | Roblox 서버가 Luau 실행 — 숨은 정보 미전송으로 치팅 차단. GDD의 "동기 완결" 규칙 코어는 그대로 |
| 자동 턴 종료 유예 | 1초 grace + 입력 재평가 | 액션 직후 즉시 | grace 는 표시 계층(BAL.fx). 클라 UX 는 Phase 2 에서 클라 측 연출로 복원 |
| 모달 선택 | 동기화 모달 (seq·버튼 인덱스 중계) | pending 상태 + 명시 액션 | 서버 권위에서는 모달 자체가 없음 |
| 레거시 속성 스킬 경로 | 로스터 미적용 하수인용 잔존 | 미포팅 | Roblox 에서는 도달 불가 (전 하수인 로스터 적용, 왕·동료 skillAtk=0) |
| aiMain·aiMainStrong·aiBattleAction(Strong)·aiEvalPos·aiWorstReply·aiPickRoster·aiAutoPlace·aiRecruitSlot·aiCapture·도망 교환 정책·vip "항상 대리" | `src/shared/Ai.luau` (`Ai.act`·`Ai.autoSetup`) | 판단·정책·난수 순서 동일. 실행은 `Engine:apply` 경유(사람과 같은 검증) · 모달 인라인 처리 → pending 응답 |
| aiSchedule / aiScheduleBattle (setTimeout) | `init.server.luau` `scheduleBot` (`task.delay`, Config.AI.delay 0.65s / battleDelay 0.45s) | 봇 차례마다 한 행동씩 브로드캐스트 |
| PVE 모드 시작 (startMode pve) | 혼자 앉은 뒤 `[B]`(5급)·`[N]`(5단) 또는 HUD 버튼 → 서버 `bot` 액션 → 맞은편에 봇 착석·자동 배치 | 구조.txt "1인 대전" |
| 추측 메모·튜토리얼 | 클라 로컬 기능 | Phase 2~3 | 규칙 무관 표시 계층 |
| 난수 소비 순서 | — | 규칙 함수 내부 순서 동일 유지 | 밸런스 의미 보존 (락스텝 목적 아님) |

## 검증 (Phase 1)

- `roblox/tests/run.luau` — luau CLI 헤드리스: **641 assertions pass**
  - RNG 골든 3시드 × 5값 (JS 원본 대조, 1e-11)
  - 사전 배치 검증·P2 행 반사(#93)·손상 데이터 폴백
  - 이동 규칙 (1칸·주 행동 소모·자동 턴 종료·BT 이전 2칸 거부)
  - 접촉 유닛: 하수인→폭탄 동귀 / 왕→폭탄 비공개 생존 / 함정 2턴·양측 공개 / 동료↔동료 밀기(비공개·비인접 보장)
  - 왕 끝줄 즉시 승리 · 전투 완주(즉사/판정) · 지표 기록
  - 20시드 무작위 완주: 룰 데드락 0 · 지표 합산=byPlayer 정합 · HP≤maxHp 불변식
- Studio 2인 로컬 테스트: 배치→매칭→대전→종료 플로우 (수동 — CJ 플레이 QA 대상)

## 검증 (Phase 3 — AI)

- `roblox/tests/run.luau` [10]: **1303 assertions pass** — 자동 배치 유효성 20시드(왕 후열/중열·폭탄 호위) · AI 대 AI 완주 24판(5급×5급 / 5단×5급 / 5단×5단, 데드락·거부 0, 자연 종료 20/24 — 나머지는 500턴 컷) · 5급 결정성(같은 시드 = 같은 결과) · #92 교체 정책 유닛
- 공정 관측: `Ai.luau` 는 `visibleTo`·`revealed`·공개 잔여 수·`aiSeenMoved` 만 읽는다 (코드 리뷰 기준 — 숨은 말의 `type`/`element` 직접 접근 없음)
- 봇 행동은 전부 `Engine:apply(botOwner, action)` 를 지나므로 사람보다 더 할 수 있는 일이 없다

## v0.4.7 규칙 반영 (#121·#125·#129 — HTML PR #143 → Roblox, 2026-09-10)

CJ 지시 "dev 풀 받고 바뀐 규칙도 전부 적용" 에 따라 [v0.4.7 게임플레이 계약](../milestone/v0.4.7/issues/121/Venus/gameplay-spec.md) 전 항목을 Luau 엔진에 옮겼다. 규칙 수치·판단 순서·난수 소비 위치는 HTML 구현(`demo/index.html` blob 4535791b)과 같다.

| 계약 | Roblox 구현 | 검증 |
|---|---|---|
| 1.1 숲 이벤트 = 구역당 itemGift·battleBuff·recruit 각 1개 (6개, 셔플 1회) | `Engine:genEvents` · `Data.EVENT_KINDS` | [11] 20시드 |
| 1.3 옛 6종 보상 폐기 (CD 초기화·+15% 버프 소멸) | `doSearch` 재작성 | [11] |
| 2.1 시작 회복약·쿨링수·해독제 각 1 · 볼 2 · 상한 해제 | `Config.BAL.itemStart/ballStart/invMax/ballMax` | [11] |
| 2.2 선물 패키지 개봉 4종 (행동·카운터 미소모) | 전투 액션 `gift{pick}` | [11] |
| 2.3 아이템 라운드 1회만 (전투 2회·연속 동일 제거) | `applyBattleAction item` | [11] |
| 3 전투 버프 3종 — 한 전투 1개 · 무료 · 종료 시 정리 | 전투 액션 `buff{kind}` · `B.buffA/D` · `resetTemps` · `gameOver` | [11] |
| 3.2 힘 = 분산 상단 고정(난수는 소비) | `execSlot` | [11] 결정적 피해 |
| 3.3 시간 = R1 한정 · 그 전투만 3R · 사신 불가 | `B.maxRounds` · `battleMaxRounds()` | [11] |
| 3.4 도망 = HP 게이트만 해제 | `fleeFree` | [11] |
| 4 기술 교체: 3종 직접 선택 · 최초 6명 생존 · 4슬롯 · 중복 금지 · 쿨 승계·공개 초기화 | pending `recruit` + `recruitSwap{skill,targetId,slot}` · 클라 선택 창 3단계 | [11] |
| 5.1 드래곤 30/CD3 · 속성 상대 ×1.3 · 무속성 1.0 | `Data.SKILLS.dragon_breath` · `execSlot` | [11] 하수인·왕 |
| 5.2 마녀 18/CD3 · 서로 다른 2효과 100% · rand 1회 · 갱신 · 풀 = 실피해 회복 | `Engine:witchApply` | [11] 24시드 |
| 5.3 사신 6R·strict 열세·봉인(CD 분리)·보호막 무시 즉사·폴백 | `reaperWhy` · `slotUsable` · `execSlot` | [11] |
| 6 숲 포획 ROSTER 20종 그대로 (rosterId 보존) · 수령 말 · 반동은 탐색 말 | `tryCapture(p,mode,recv,rd)` · `capTry{mode,recvId}` | [11] |
| 7 (#129) 탐색 후 정확히 한 번 종료 — 단순 획득은 확인 없이, recruit 는 선택 뒤 | `autoStep` (pending 이 종료를 막고, 해소 시 즉시 재평가) | [11] |
| 8 (#125) 연출 1200ms | 해당 없음 — Roblox 클라는 연출 잠금이 없다 (상태 즉시 반영) | — |
| 9 AI 수용 (패키지·직접 선택·4슬롯·사신) | `Ai.luau` `aiPkgAction`·`aiRecruitPlan`·`slotUsable` | [10]·[11] AI 대전 완주 |

프로토콜 추가: 전투 `gift{pick}` · `buff{kind}`, pending recruit 응답 `recruitSwap{skill,targetId,slot}` · `capTry{mode,recvId}` · `recruitKeep`. 뷰: `gifts`·`buffPacks`(소유자만), `battle.usable/canBasic/reaperWhy/canFlee/buffA/buffD/timed/itemRound`, `pending.recruit{skills,minions,receivers,species,balls}`.

## v0.4.7 후속 규칙 반영 (#146·#131·#130 — HTML PR #152 → Roblox, 2026-09-10)

[#146 게임플레이 계약](../milestone/v0.4.7/issues/146/Venus/gameplay-spec.md) 을 같은 수치·판단 순서로 Luau 에 반영했다.

| 계약 | Roblox 구현 | 검증 |
|---|---|---|
| C1 도망 HP 게이트 폐지 · 기본 성공률 **30%** | `Config.BAL.fleeProb 0.5→0.3` · `applyBattleAction flee` 게이트 제거 | [13] |
| C2 도망 실패의 **상대 추가 반격 삭제** — 자기 행동 1회 소모만 | `fleeCounter` 제거 · 실패 시 `nextPhase()` | [13] HP 불변·phase 진행 |
| C3 성공 처리·시도 상한 무변경 | 기존 `fleeSwapPrompt` 경로 유지 | [11]·[13] |
| C4 도망의 수호자 = 성공률 **치환 70%** (가산·보장 아님) | `BAL.fleeProbBuff` · `f.fleeFree` 로 확률 선택 | [13] roll 0.5 로 30%/70% 구분 |
| C5 4슬롯 전부 불가 → **기본 공격 없음** · 안내 + 수동 종료 | 액션 `pass` 신설 · `act basic` 은 4슬롯 전투원에서 거부 | [13] |
| C6 슬롯 하나라도 합법이면 정상 커맨드 · 왕·동료 본체 기본 공격 유지 | `slotUsable` 단일 판정 · `f.skills == nil` 이면 기본 공격 | [13] |
| C7 수동 종료 = 전투 행동 1회 (`nextPhase`) — 주 행동·전투 횟수·약화 불변 | `pass` → `nextPhase()` | [13] |
| C8 함정(`immobile>0`) 말은 텔레포트 **양 끝 금지** | `apply tele` 기존 검사 + `doTeleportSwap` 재검사 | [13] |
| C9 2단계 안내 문구 · 거부 안내는 소유자만 | 클라 `teleMode`/`teleFirst` 단계 문구 · `flashHud` | 수동 |
| C10 실행 직전 재검사 · 거부 시 상태·RNG 불변 | `doTeleportSwap` 진입 검사(차례·주 행동·owner·alive·placed·immobile·동일 말) | [13] |
| C11 보호막 **합산** (`max`·직접 대입 대체) | `f.shield += …` 2경로 · AI 평가에서 기존 보유 감점 제거 | [13] 18+22=40 · 30+22=52 |
| C12 튜토리얼 저장 독립성 | **해당 없음** — Roblox 판에 튜토리얼 없음 (Phase 4) | — |

프로토콜 추가: 전투 `pass`. 뷰 추가: `battle.canPass`·`battle.fleeProb`, `canBasic` 은 4슬롯 없는 전투원만 true.

## 구조.txt (CJ 2026-09-10) 대비 구현 현황

| 구조.txt 항목 | 구현 | 비고 |
|---|---|---|
| 2인: 둘이 앉으면 시작 버튼 활성 · F 로 시작 | ✅ 판 앞 [F] 프롬프트 · Enter · HUD [▶ 게임 시작] | |
| 보드게임 창: 왼쪽 판 · 오른쪽 배치 말 선택 · 이동 불가 | ✅ `win` 720×592 (2D 판 280×520 + 우측 패널 388) · 서버가 점프 잠금 | 창 프레임·봇 메시·배지 아트 적용 완료 (2026-09-10) |
| 배치 완료 → 둘 다 완료 시 자동 시작 | ✅ 기존 | |
| 배치 완료 옆 [나가기] 로만 창 닫힘·이동 가능 | ✅ 배치·대전·종료 화면 모두 [나가기](=자리 떠나기, 대전 중이면 기권) | |
| 전투 등은 새 창 (웹 참고) | ✅ 전투 모달(`battleFrame`)·로스터 상세·출전/포획/교체 프롬프트 | |
| 1인: 혼자 앉고 B 로 AI 모드 | ✅ `[B]` 5급 · `[N]` 5단 · HUD 버튼 · 창 안 난이도 토글 | |
| 봇 자동 선택·배치, 나만 완료 누르면 시작 | ✅ `Ai.autoSetup` (왕 후열 80%·폭탄 호위·함정 중앙·동료 측면·하수인 전열) | |

## [기획 필요] / 미결

- 잔류장 풀 속성 대체 효과(흡수 회복 40%)는 HTML의 임시 구현 그대로 승계 — 기존 [기획 필요] 유지
- Roblox 경험(Experience) 이름·공개 범위·수익화 정책 — CJ 결정 필요
- 모바일 터치 UI 레이아웃 (Phase 2 에서 Earth 시안과 함께)
