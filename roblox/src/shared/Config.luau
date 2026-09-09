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
		itemPerBattle = 2,
		itemPerRound = 1,
		invMax = 5,
		ballStart = 3,
		itemStart = 2, -- D11 시작 아이템 수
		burnStart = 65, -- 버닝 타임 진입 표시 턴 (GDD-13 4.11)
		captureAtkFailPct = 0.25,
		statusProb = 0.7, -- T5-A(D10): 화상·약화 부여 확률 (지속형 100%)
		shockProb = 0.5, -- #96 (v0.4.4 §4): 감전 부여 확률
		eventsPerForest = 3, -- 구역당 최소 개수 (3~4개 무작위 — #12)
		ballMax = 3,
		nextBuffPct = 0.15, -- #12 일시버프 (다음 전투 공격 +15%)
		enemyCapProb = 0.7, -- #12 적 하수인 포획 성공률
		fleeProb = 0.5, -- #13 도망 성공률 (자기 HP<50%)
		teleMax = math.huge, -- #114 (v0.4.5): 경기당 횟수 무제한 (주 행동 1회 소모는 유지)
		enemyCapHp = 70, -- #20 전투 중 적 포획 예비 하수인 시작 HP
		itemHealPct = 0.20,
		healPostPct = 0.05, -- #106 T2 회복 자세 — 턴 종료마다 최대 HP 5%
	},
}

return Config
