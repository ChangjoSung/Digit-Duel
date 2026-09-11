--!strict
-- Config.luau — 규칙 상수 (demo/index.html v0.4.5 BAL 포팅)
-- 표시 계층 전용 상수(BAL.fx, aiDelay, simDelay 등)는 클라이언트 소관이라 제외.
-- 수치는 [DATA] 전투 수치 v0.1 + v0.4.4/v0.4.5 개정 그대로 — 임의 변경 금지.

local Config = {
	COLS = 7,
	ROWS = 13,

	BAL = {
		minion = { hp = 100, atk = 22, skill = 35, cd = 2 },
		ally = { hp = 100, atk = 16 },
		king = { hp = 100, atk = 16 },
		captured = { hp = 100, atk = 20, skill = 30, cd = 2 },
		bomb = { hp = 1, atk = 0 },
		trap = { hp = 1, atk = 0 },

		advMult = 1.3,
		disMult = 0.75,
		burnPct = 0.05,
		burnRounds = 2,
		weakenPct = 0.2,
		weakenHits = 2,
		shieldPct = 0.15,
		healPct = 0.10,
		absorbCapPct = 0.30,
		maxRounds = 6,
		maxTurns = 60,
		simMaxTurns = 500,
		dmgVar = 0.2,
		itemPerBattle = math.huge, -- #121 (v0.4.7 계약 2.3): 전투당 2회 제한 제거 — 라운드 1회(itemPerRound)만 남는다
		itemPerRound = 1,
		invMax = math.huge, -- #121 계약 2.1: 보유 상한 해제
		ballStart = 2, -- #121 계약 2.1: 공용 볼 2 로 시작
		itemStart = { "potion", "cool", "cure" }, -- #121 계약 2.1: 회복약·쿨링수·해독제 각 1 (고정 — 난수 미소비)
		burnStart = 65, -- 버닝 타임 진입 표시 턴 (GDD-13 4.11)
		captureAtkFailPct = 0.25,
		statusProb = 0.7, -- T5-A(D10): 화상·약화 부여 확률 (지속형 100%)
		shockProb = 0.5, -- #96 (v0.4.4 §4): 감전 부여 확률
		eventsPerForest = 3, -- 구역당 최소 개수 (3~4개 무작위 — #12)
		ballMax = math.huge, -- #121 계약 2.1: 볼 보유 상한 해제
		enemyCapProb = 0.7, -- #12 적 하수인 포획 성공률
		fleeProb = 0.3, -- #146 (v0.4.7 계약 1.1): HP 게이트 폐지 · 기본 성공률 30%
		fleeProbBuff = 0.7, -- #146 계약 1.4: 도망의 수호자 = 성공률 **치환** 70% (가산·성공 보장 아님)
		teleMax = math.huge, -- #114 (v0.4.5): 경기당 횟수 무제한 (주 행동 1회 소모는 유지)
		enemyCapHp = 70, -- #20 전투 중 적 포획 예비 하수인 시작 HP
		itemHealPct = 0.20,
		healPostPct = 0.05, -- #106 T2 회복 자세 — 턴 종료마다 최대 HP 5%
		-- #121 계약 3·5 (v0.4.7) 전투 버프 패키지·신규 기술
		buffTimeRounds = 3, -- 🧭 시간의 수호자: 그 전투만 양측 최대 3라운드 (BAL.maxRounds 전역 불변 — S.battle.maxRounds 로만)
		reaperRound = 6, -- 💀 사신의 낫 봉인 해제 라운드 (자기 행동 차례 · 내 HP 비율 strict 열세와 AND)
		witchEffects = 2, -- 🕯 마녀의 장난: 4효과 중 서로 다른 2개 (균등 6조합 · 공유 rand 1회)
	},

	-- #21 AI (Phase 3 포팅) — HTML BAL.ai* 그대로. delay 는 서버 봇의 행동 간격(초, 표시용)
	AI = {
		delay = 0.65, -- HTML aiDelay 650ms
		battleDelay = 0.45,
		strongBudgetMs = 120, -- 5단 판단 시간 상한
		strongTopK = 14, -- 5단 2-ply 후보 상한
		strongReplyCap = 36, -- 5단 상대 응수 상한
		simMaxTurns = 500,
	},
}

return Config
