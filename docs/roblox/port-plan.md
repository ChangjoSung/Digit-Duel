# Roblox 포팅 플랜 (Ref #118)

- 기준: CJ Comment 2026-09-09 — "이거 로블록스로 포팅하고싶어. 디자인·그래픽은 Codex(Earth), 구현은 Claude Code(Mars)"
- 원본: `demo/index.html` v0.4.5 (dev 39f0222)
- 상태 구분: **확정** = CJ 지시·기존 GDD 그대로 / **추론** = 포팅상 기술 판단 (아래 "의도적 차이" 표) / **[기획 필요]** = 별도 표기

## 페이즈 로드맵

| Phase | 범위 | 상태 |
|---|---|---|
| **1** | 코어 룰 엔진 Luau 포팅 + 서버 권위 구조 + 매치메이킹 + 최소 클라 UI + 헤드리스 테스트 | ✅ 이 브랜치 |
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

## 구조.txt (CJ 2026-09-10) 대비 구현 현황

| 구조.txt 항목 | 구현 | 비고 |
|---|---|---|
| 2인: 둘이 앉으면 시작 버튼 활성 · F 로 시작 | ✅ 판 앞 [F] 프롬프트 · Enter · HUD [▶ 게임 시작] | |
| 보드게임 창: 왼쪽 판 · 오른쪽 배치 말 선택 · 이동 불가 | ✅ `win` 720×592 (2D 판 280×520 + 우측 패널 388) · 서버가 점프 잠금 | 창 프레임 아트는 Earth 요청 |
| 배치 완료 → 둘 다 완료 시 자동 시작 | ✅ 기존 | |
| 배치 완료 옆 [나가기] 로만 창 닫힘·이동 가능 | ✅ 배치·대전·종료 화면 모두 [나가기](=자리 떠나기, 대전 중이면 기권) | |
| 전투 등은 새 창 (웹 참고) | ✅ 전투 모달(`battleFrame`)·로스터 상세·출전/포획/교체 프롬프트 | |
| 1인: 혼자 앉고 B 로 AI 모드 | ✅ `[B]` 5급 · `[N]` 5단 · HUD 버튼 · 창 안 난이도 토글 | |
| 봇 자동 선택·배치, 나만 완료 누르면 시작 | ✅ `Ai.autoSetup` (왕 후열 80%·폭탄 호위·함정 중앙·동료 측면·하수인 전열) | |

## [기획 필요] / 미결

- 잔류장 풀 속성 대체 효과(흡수 회복 40%)는 HTML의 임시 구현 그대로 승계 — 기존 [기획 필요] 유지
- Roblox 경험(Experience) 이름·공개 범위·수익화 정책 — CJ 결정 필요
- 모바일 터치 UI 레이아웃 (Phase 2 에서 Earth 시안과 함께)
