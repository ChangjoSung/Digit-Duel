--!nonstrict
-- Engine.luau — Digit Dual 코어 룰 엔진 (demo/index.html v0.4.5 스크립트부 포팅)
--
-- 설계 원칙 (docs/roblox/port-plan.md):
--  * 표시 계층(FX·모달·렌더)은 전부 제거 — 규칙 상태 전이는 동기 완결 그대로.
--  * HTML의 시드 락스텝 대신 서버 권위: 이 엔진은 서버에서만 실행되고 클라이언트는 액션만 보낸다.
--  * HTML의 모달 선택(출전 선택·포획·기술 교체)은 S.pending 상태 + 명시적 액션으로 재구성.
--  * 모든 난수는 self.rng 경유 (mulberry32 — JS와 동일 수열).
--  * 로그·전투 메시지는 self.outbox 이벤트로 방출 (vis: nil=전체 / 0·1=해당 플레이어만).
--  * 슬롯 인덱스는 1~4 (JS 0~3), 플레이어는 0·1 유지.
--  * Phase 1 제외: AI(grade5/dan5)·추측 메모·튜토리얼·레거시 속성 스킬 경로(로스터 미적용 하수인 전용 — Roblox에는 존재하지 않음).

local function req(mod)
	if script then
		return require(script.Parent:WaitForChild(mod)) -- 클라이언트 복제 경합 방지 (서버에서는 즉시 반환)
	end
	return require("./" .. mod)
end

local Config = req("Config")
local Data = req("Data")
local Rng = req("Rng")

local BAL = Config.BAL
local COLS, ROWS = Config.COLS, Config.ROWS
local round = Data.round

local Engine = {}
Engine.__index = Engine

-- #20 플레이어별 핵심 행동 지표 키 (합산 + byPlayer 동시 집계)
local PLAYER_METRIC_KEYS = {
	"battles", "forcedBattles", "teleports", "searches", "minionSearches", "captures", "captureFails",
	"enemyCapTries", "enemyCaptures", "enemyCapFails", "fleeTries", "fleeOks", "bombMoves", "trapTriggers", "kingForestTurns",
	"battleRefusals", "pushes", "bombHitsMinion", "bombClearedByVip", "minionInvades",
	"heals", "healHp", "bombContacts", "autoEnds",
	"relocations", "fleePushes",
}
Engine.PLAYER_METRIC_KEYS = PLAYER_METRIC_KEYS

local function newPlayerMetrics()
	local o = {}
	for _, k in PLAYER_METRIC_KEYS do
		o[k] = 0
	end
	return o
end

--==================================================================
-- 생성·배치
--==================================================================

function Engine.new(seed)
	local self = setmetatable({}, Engine)
	self.rng = Rng.new(seed)
	self.seed = seed
	self.outbox = {}
	self.nextId = 1
	local S = {
		phase = "setup", -- setup → play → over
		current = 0,
		turnCount = 0,
		pieces = {},
		events = {},
		inv = { [0] = {}, [1] = {} },
		pkgs = { [0] = { itemGift = 0, battleBuff = 0 }, [1] = { itemGift = 0, battleBuff = 0 } }, -- #121 계약 2·3: 미개봉 패키지 재고 (상한 없음)
		balls = { [0] = BAL.ballStart, [1] = BAL.ballStart },
		reserve = { [0] = nil, [1] = nil },
		teleUsed = { [0] = 0, [1] = 0 },
		forcedQueue = {},
		roster = { [0] = {}, [1] = {} },
		traces = { [0] = {}, [1] = {} }, -- set["r_c"]=true
		setupDone = { [0] = false, [1] = false },

		mainUsed = false,
		battlesUsed = 0,
		movedPiece = nil,
		contactSet = {},
		firstBattleWonByMover = false,
		forcedTargets = {},
		tempReveal = {}, -- set[id]=true
		battle = nil,
		winner = nil, -- 0 | 1 | -1(무승부)
		healTickTurn = -1,
		contactKind = "move",
		fleePick = nil,
		pending = nil, -- {kind="vip"|"capture"|"recruit", ...}

		-- #21 공개 관측 기억 (향후 AI 포팅용으로 유지 — 규칙에는 미사용)
		aiSeenMoved = { [0] = {}, [1] = {} },

		metrics = {
			battles = 0, judged = 0, ties = 0, pushes = 0, searches = 0, captures = 0, captureFails = 0,
			heals = 0, healHp = 0, bombContacts = 0, autoEnds = 0, relocations = 0, fleePushes = 0,
			bombHitsMinion = 0, bombClearedByVip = 0, kingForestTurns = 0, battleRefusals = 0,
			attackerWins = 0, defenderWins = 0, kingStandoff = 0, endTurn = 0,
			winType = nil, btReached = false, btEnterTurn = 0,
			forcedBattles = 0, teleports = 0, statusApplied = 0, statusFailed = 0, minionInvades = 0,
			enemyCaptures = 0, fleeTries = 0, fleeOks = 0, minionSearches = 0,
			enemyCapTries = 0, enemyCapFails = 0, bombMoves = 0, trapTriggers = 0,
			firstPlayer = nil, winner = nil,
			byPlayer = { [0] = newPlayerMetrics(), [1] = newPlayerMetrics() },
		},
	}
	self.S = S
	for p = 0, 1 do
		for _ = 1, 6 do
			self:mkPiece(p, "minion")
		end
		for _ = 1, 3 do
			self:mkPiece(p, "bomb")
		end
		for _ = 1, 2 do
			self:mkPiece(p, "ally")
		end
		for _ = 1, 2 do
			self:mkPiece(p, "trap")
		end
		self:mkPiece(p, "king")
		for _, k in BAL.itemStart do -- #121 계약 2.1: 시작 아이템 고정 (회복약·쿨링수·해독제 각 1 — 난수 미소비)
			table.insert(S.inv[p], k)
		end
	end
	-- 정보 은닉 (인계서 §6): 종류별 고정 순서의 순번 ID 는 미공개 말도 ID 만으로 정체를 역추정하게 한다 (예: 14·28 = 왕).
	-- 생성 순서(S.pieces 배열)는 유지하되 ID 값만 시드 RNG 로 뒤섞는다 — 클라이언트는 ID 를 불투명 핸들로만 쓴다.
	local ids = {}
	for i = 1, #S.pieces do
		ids[i] = i
	end
	self:shuffle(ids)
	for i, p in S.pieces do
		p.id = ids[i]
	end
	self.nextId = #S.pieces + 1
	self:genEvents()
	return self
end

function Engine:rand()
	return self.rng:next()
end

function Engine:shuffle(a)
	for i = #a, 2, -1 do
		local j = math.floor(self:rand() * i) + 1
		a[i], a[j] = a[j], a[i]
	end
	return a
end

function Engine:emit(ev)
	table.insert(self.outbox, ev)
end

function Engine:log(text, cls, vis)
	self:emit({ t = "log", text = text, cls = cls, vis = vis })
end

-- 서버가 브로드캐스트 후 호출 — 방출 이벤트 회수
function Engine:drainOutbox()
	local out = self.outbox
	self.outbox = {}
	return out
end

function Engine:mkPiece(owner, type)
	local b = BAL[type] or {}
	local p = {
		id = self.nextId, owner = owner, type = type, element = nil,
		hp = b.hp or 1, maxHp = b.hp or 1, atk = b.atk or 0, skillAtk = b.skill or 0,
		rosterId = nil, name = nil, cdMax = b.cd or 0,
		cd = 0, skills = nil, cds = { 0, 0, 0, 0 }, revealedSkills = nil,
		r = 0, c = 0, placed = false, revealed = false, alive = true, movedEver = false, movedPreBT = false,
		immobile = 0, cap = nil, nextBattleBuff = false, healing = false,
		burn = 0, burnBy = nil, weaken = 0, shield = 0, absorbed = 0, shock = 0, shockFresh = false,
		focusCharge = false, vulnMark = false, dmgCut = 0,
		powerBuff = false, fleeFree = false, -- #121 계약 3: 전투 버프 플래그 (그 전투에만 — 개시·종료 때 지운다)
	}
	self.nextId += 1
	table.insert(self.S.pieces, p)
	return p
end

function Engine:pieceById(id)
	for _, p in self.S.pieces do
		if p.id == id then
			return p
		end
	end
	return nil
end

-- 선택된 로스터 6종의 스탯을 하수인 6기에 주입
function Engine:applyRoster(p)
	local S = self.S
	local i = 0
	for _, m in S.pieces do
		if m.owner == p and m.type == "minion" then
			i += 1
			local rd = Data.rosterById(S.roster[p][i])
			if rd then
				m.rosterId = rd.id
				m.name = rd.name
				m.element = rd.element
				m.hp = rd.hp
				m.maxHp = rd.hp
				m.atk = rd.atk
				m.skillAtk = rd.skill
				m.cdMax = rd.cd
				m.skills = Data.archSkills(rd.arch, rd.element)
				m.cds = { 0, 0, 0, 0 }
				m.revealedSkills = {}
			else
				m.rosterId = nil
				m.name = nil
				m.element = nil
				m.hp = BAL.minion.hp
				m.maxHp = BAL.minion.hp
				m.atk = BAL.minion.atk
				m.skillAtk = BAL.minion.skill
				m.cdMax = BAL.minion.cd
				m.skills = nil
				m.cds = { 0, 0, 0, 0 }
				m.revealedSkills = nil
			end
		end
	end
end

function Engine:fillRosterRandom(p)
	local S = self.S
	local rest = {}
	for _, r in Data.ROSTER do
		if not table.find(S.roster[p], r.id) then
			table.insert(rest, r.id)
		end
	end
	self:shuffle(rest)
	while #S.roster[p] < 6 do
		table.insert(S.roster[p], table.remove(rest))
	end
	self:applyRoster(p)
end

-- #12 숲 이벤트: 구역당 3~4개, 풀 6종 완전 랜덤
function Engine:genEvents()
	local S = self.S
	S.events = {}
	for _, rows in { { 4, 5 }, { 9, 10 } } do
		local cells = {}
		for _, r in rows do
			for c = 1, COLS do
				table.insert(cells, { r, c })
			end
		end
		self:shuffle(cells) -- #121 계약 1.1: 구역마다 shuffle 1회뿐 — 난수 소비 결정적
		for i, kind in Data.EVENT_KINDS do -- 각 구역에 itemGift·battleBuff·recruit 정확히 1개 (칸 위치만 무작위)
			table.insert(S.events, { r = cells[i][1], c = cells[i][2], kind = kind, consumed = false })
		end
	end
end

-- 사전 배치 데이터 검증 — data = {roster={6 ids}, pos={14×{r,c}}} (자기 진영 = 11~13행, 클라이언트 공통 좌표)
-- 서버가 ready 시점에 사유와 함께 거부하는 데 쓰고, applySetup 은 같은 판정으로 무작위 대체 여부를 정한다
function Engine.validateSetup(data)
	if type(data) ~= "table" or type(data.roster) ~= "table" or type(data.pos) ~= "table" then
		return false, "배치 데이터 형식 오류"
	end
	if #data.roster ~= 6 then
		return false, "로스터 6종을 선택하세요 (" .. #data.roster .. "/6)"
	end
	local seen = {}
	for _, rid in data.roster do
		if type(rid) ~= "string" or not Data.rosterById(rid) or seen[rid] then
			return false, "로스터에 잘못됐거나 중복된 종이 있습니다"
		end
		seen[rid] = true
	end
	if #data.pos ~= 14 then
		return false, "말 14개를 모두 배치하세요 (" .. #data.pos .. "/14)"
	end
	local cellSeen = {}
	for _, rc in data.pos do
		local r, c = type(rc) == "table" and rc[1] or nil, type(rc) == "table" and rc[2] or nil
		if type(r) ~= "number" or type(c) ~= "number" or r % 1 ~= 0 or c % 1 ~= 0 or r < 11 or r > 13 or c < 1 or c > COLS then
			return false, "자기 진영(3행) 밖의 칸이 있습니다"
		end
		if cellSeen[r .. "_" .. c] then
			return false, "같은 칸에 말이 겹쳤습니다"
		end
		cellSeen[r .. "_" .. c] = true
	end
	return true
end

-- 온라인 사전 배치 적용 (HTML applyNetSetup 포팅)
-- p==1 은 행 반사(r → ROWS+1-r), 열 유지. 손상 데이터는 무작위 대체.
function Engine:applySetup(p, data)
	local S = self.S
	local valid = Engine.validateSetup(data)
	local mine = {}
	for _, x in S.pieces do
		if x.owner == p then
			table.insert(mine, x)
		end
	end
	if valid then
		S.roster[p] = table.clone(data.roster)
		self:applyRoster(p)
		for i, x in mine do
			x.r = (p == 1) and (ROWS + 1 - data.pos[i][1]) or data.pos[i][1]
			x.c = data.pos[i][2]
			x.placed = true
		end
	else
		self:fillRosterRandom(p)
		local rows = (p == 0) and { 11, 12, 13 } or { 1, 2, 3 }
		local cells = {}
		for _, r in rows do
			for c = 1, COLS do
				table.insert(cells, { r, c })
			end
		end
		self:shuffle(cells)
		for i, x in mine do
			x.r = cells[i][1]
			x.c = cells[i][2]
			x.placed = true
		end
		self:log("⚠️ P" .. (p + 1) .. " 배치 데이터 손상 — 무작위 배치로 대체", "imp")
	end
	S.setupDone[p] = true
end

-- beginPlay 포팅 — 무작위 선공 (Q6)
function Engine:begin()
	local S = self.S
	S.phase = "play"
	S.current = math.floor(self:rand() * 2)
	S.metrics.firstPlayer = S.current
	self:log("무작위 선공: P" .. (S.current + 1), "sys")
	self:startTurn()
end

--==================================================================
-- 유틸 (HTML ===== 유틸 ===== 포팅)
--==================================================================

function Engine:met(p, key, n)
	local m = self.S.metrics
	n = n or 1
	m[key] = (m[key] or 0) + n
	if p == 0 or p == 1 then
		m.byPlayer[p][key] = (m.byPlayer[p][key] or 0) + n
	end
end

function Engine:alivePieces()
	local out = {}
	for _, p in self.S.pieces do
		if p.alive and p.placed then
			table.insert(out, p)
		end
	end
	return out
end

function Engine:at(r, c)
	for _, p in self.S.pieces do
		if p.alive and p.placed and p.r == r and p.c == c then
			return p
		end
	end
	return nil
end

local function inForestRow(r)
	return (r >= 4 and r <= 5) or (r >= 9 and r <= 10)
end
Engine.inForestRow = inForestRow

function Engine.inForest(p)
	return inForestRow(p.r)
end

function Engine.zoneOf(p)
	return (p == 0) and { 11, 12, 13 } or { 1, 2, 3 }
end

local function zoneHas(p, r)
	return (p == 0) and (r >= 11 and r <= 13) or (p == 1) and (r >= 1 and r <= 3)
end
Engine.zoneHas = zoneHas

local function adj(a, b)
	return math.abs(a.r - b.r) + math.abs(a.c - b.c) == 1
end
Engine.adj = adj

-- 버닝 타임 (GDD-13 4.11): 표시 턴 65부터
function Engine:isBurning()
	return self.S.turnCount + 1 >= BAL.burnStart
end

-- 원정 구역 = 상대 측 숲 + 상대 진영 (BT 2칸 불가)
local function expedZone(owner, r)
	return (owner == 0) and r <= 5 or (owner == 1) and r >= 9
end

function Engine:adjEnemies(p)
	local out = {}
	for _, e in self:alivePieces() do
		if e.owner ~= p.owner and adj(p, e) then
			table.insert(out, e)
		end
	end
	return out
end

function Engine:visibleTo(viewer, e)
	if e.owner == viewer then
		return true
	end
	if not inForestRow(e.r) then
		return true
	end
	if self.S.tempReveal[e.id] then
		return true
	end
	for _, m in self:alivePieces() do
		if m.owner == viewer and adj(m, e) then
			return true
		end
	end
	return false
end

--==================================================================
-- 이동·전투 가능 판정
--==================================================================

function Engine:canMoveTo(p, r, c)
	local S = self.S
	if S.phase ~= "play" or S.mainUsed or p.owner ~= S.current then
		return false
	end
	if p.type == "trap" then -- 함정 상시 고정 (GDD-13 4.5)
		return false
	end
	if p.immobile > 0 then
		return false
	end
	local d = math.abs(p.r - r) + math.abs(p.c - c)
	if d ~= 1 then
		-- BT 직선 2칸 (폭탄 포함·함정 제외, 원정 구역 불가)
		if d ~= 2 or (p.r ~= r and p.c ~= c) or not self:isBurning() then
			return false
		end
		if expedZone(p.owner, p.r) or expedZone(p.owner, (p.r + r) / 2) or expedZone(p.owner, r) then
			return false
		end
		local m = self:at((p.r + r) / 2, (p.c + c) / 2)
		if m and self:visibleTo(p.owner, m) then -- 경유 칸의 보이는 말 차단
			return false
		end
	end
	local o = self:at(r, c)
	if o and o.owner == p.owner then
		return false
	end
	if o and self:visibleTo(p.owner, o) then
		return false
	end
	return true
end

function Engine:canBattle(att, def)
	local S = self.S
	if S.phase ~= "play" or att.owner ~= S.current or S.battlesUsed >= 2 then
		return false
	end
	if att.type == "bomb" or att.type == "trap" then
		return false
	end
	if att.type == "king" and def.type == "king" then -- 왕 vs 왕 불가침
		return false
	end
	if #S.forcedTargets > 0 and (att ~= S.movedPiece or not table.find(S.forcedTargets, def.id)) then
		return false -- T1: 강제 대상 외 전투 봉쇄
	end
	if S.battlesUsed == 1 then
		-- #14 텔레포트 승계 강제 전투는 연쇄 조건 면제
		local forcedOk = #S.forcedTargets > 0 and att == S.movedPiece and table.find(S.forcedTargets, def.id) ~= nil
		if not forcedOk then
			if not S.firstBattleWonByMover or not att.alive or att ~= S.movedPiece then
				return false
			end
			if not table.find(S.contactSet, def.id) then
				return false
			end
		end
	end
	return true
end

-- #106 4.4.2 접촉 적격 (폭탄 직접 접촉 포함)
function Engine:contactEligible(att, def)
	local S = self.S
	if att.type == "trap" then
		return false
	end
	if att.type == "bomb" then
		return S.phase == "play" and att.owner == S.current and S.battlesUsed < 2
	end
	return self:canBattle(att, def)
end

function Engine:forcedPickOk(def)
	local S = self.S
	if not (#S.forcedTargets > 0 and S.movedPiece and table.find(S.forcedTargets, def.id)) then
		return false
	end
	if S.movedPiece.type == "bomb" then
		return self:contactEligible(S.movedPiece, def)
	end
	return self:canBattle(S.movedPiece, def)
end

--==================================================================
-- 턴 진행
--==================================================================

function Engine:startTurn()
	local S = self.S
	S.mainUsed = false
	S.battlesUsed = 0
	S.movedPiece = nil
	S.contactSet = {}
	S.firstBattleWonByMover = false
	S.forcedTargets = {}
	S.forcedQueue = {}
	S.tempReveal = {}
	self:log("— P" .. (S.current + 1) .. " 턴 " .. (S.turnCount + 1) .. " —", "sys")
	if self:isBurning() and not S.metrics.btReached then
		S.metrics.btReached = true
		S.metrics.btEnterTurn = S.turnCount + 1
		self:log("🔥 버닝 타임! 직선 2칸 이동 강화 개시 (폭탄 포함·함정 제외)", "imp")
	end
end

function Engine:endTurn()
	local S = self.S
	if S.phase ~= "play" or S.battle or S.fleePick or S.pending then
		return false
	end
	if #S.forcedTargets == 0 then
		self:drainForcedQueue(false) -- #18 대기 강제 전투 먼저
	end
	if #S.forcedTargets > 0 then -- T1: 강제 전투 미이행 시 턴 종료 불가
		self:log("⚔️ 강제 전투 대상과 전투해야 턴을 마칠 수 있습니다.", "imp", S.current)
		return false
	end
	for _, x in self:alivePieces() do
		if x.owner == S.current and x.immobile > 0 then
			x.immobile -= 1
		end
	end
	for _, k in self:alivePieces() do -- #20 왕 숲 체류 (자기 턴 종료 시 1회)
		if k.owner == S.current and k.type == "king" and inForestRow(k.r) then
			self:met(S.current, "kingForestTurns")
		end
	end
	if S.battlesUsed == 0 and self:optionalBattleLeft() then -- #20 전투 회피
		self:met(S.current, "battleRefusals")
	end
	self:healTick() -- #106 4.2.2
	S.turnCount += 1
	S.current = 1 - S.current
	self:startTurn()
	return true
end

--==================================================================
-- #106 T2 회복 주 행동
--==================================================================

local function healTargetOk(p)
	return p ~= nil and p.alive and p.placed and (p.type == "minion" or p.type == "ally" or p.type == "king")
end

function Engine:canHeal(p)
	local S = self.S
	if S.phase ~= "play" or S.mainUsed or not p or p.owner ~= S.current or not healTargetOk(p) then
		return false
	end
	if S.fleePick or #S.forcedTargets > 0 then
		return false
	end
	return not p.healing -- #114: 만피 말도 지정 가능 (기다리기)
end

function Engine:doHeal(p)
	local S = self.S
	if not self:canHeal(p) then
		return false
	end
	S.mainUsed = true
	p.healing = true
	self:met(p.owner, "heals")
	if p.revealed then
		self:log("🌿 " .. (p.name or Data.TYPE_KO[p.type]) .. " 회복 자세 시작", "imp")
	else
		self:log("🌿 " .. (p.name or Data.TYPE_KO[p.type]) .. " 회복 자세 시작", "imp", p.owner)
		self:log("상대가 말 회복 행동을 했습니다.", "imp", 1 - p.owner)
	end
	return true
end

function Engine:healBreak(p)
	if p and p.healing then
		p.healing = false
	end
end

function Engine:healTick()
	local S = self.S
	if S.healTickTurn == S.turnCount then
		return
	end
	S.healTickTurn = S.turnCount
	for _, p in self:alivePieces() do
		if p.healing and healTargetOk(p) then
			local gain = math.min(round(p.maxHp * BAL.healPostPct), p.maxHp - p.hp)
			if gain > 0 then
				p.hp += gain
				self:met(p.owner, "healHp", gain)
			end
			local vis = (p.revealed) and nil or p.owner
			self:log(gain > 0 and ("🌿 " .. (p.name or Data.TYPE_KO[p.type]) .. " HP +" .. gain .. " (회복 자세)")
				or ("🌿 " .. (p.name or Data.TYPE_KO[p.type]) .. " 최대 HP — 회복 자세 유지"), nil, vis)
		end
	end
end

--==================================================================
-- 자동 진행 (#106 T7 — 서버 권위판: 유예 시간 없이 액션 후 평가)
--==================================================================

function Engine:optionalBattleLeft()
	for _, x in self:alivePieces() do
		if x.owner == self.S.current then
			for _, e in self:adjEnemies(x) do
				if self:visibleTo(self.S.current, e) and self:canBattle(x, e) then
					return true
				end
			end
		end
	end
	return false
end

function Engine:teleportAvailable(p)
	if self.S.phase ~= "play" then
		return false
	end
	for _, x in self:alivePieces() do
		if x.owner == p and zoneHas(1 - p, x.r) then
			return true
		end
	end
	return false
end

function Engine:anyMainActionLeft()
	local S = self.S
	if S.mainUsed then
		return false
	end
	local me = S.current
	for _, p in self:alivePieces() do
		if p.owner == me then
			if self:canHeal(p) then
				return true
			end
			for _, e in S.events do
				if e.r == p.r and e.c == p.c and not e.consumed and S.traces[me][e.r .. "_" .. e.c] and self:canSearchPiece(p) then
					return true
				end
			end
			if p.type ~= "trap" and p.immobile == 0 then
				for _, d in { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } } do
					local ks = self:isBurning() and { 1, 2 } or { 1 }
					for _, k in ks do
						local r, c = p.r + d[1] * k, p.c + d[2] * k
						if r >= 1 and r <= ROWS and c >= 1 and c <= COLS and self:canMoveTo(p, r, c) then
							return true
						end
					end
				end
			end
		end
	end
	if self:teleportAvailable(me) and S.teleUsed[me] < BAL.teleMax then
		local n = 0
		for _, x in self:alivePieces() do
			if x.owner == me and x.immobile == 0 then
				n += 1
			end
		end
		if n >= 2 then
			return true
		end
	end
	return false
end

--==================================================================
-- 합법 수 목록 (뷰어 표시용 — 규칙 평가는 서버에서만, 클라이언트는 결과를 그리기만 한다)
--==================================================================

function Engine:legalMoves(p)
	local S = self.S
	local out = {}
	if S.phase ~= "play" or S.mainUsed or #S.forcedTargets > 0 or p.owner ~= S.current then
		return out
	end
	local ks = self:isBurning() and { 1, 2 } or { 1 }
	for _, d in { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } } do
		for _, k in ks do
			local r, c = p.r + d[1] * k, p.c + d[2] * k
			if r >= 1 and r <= ROWS and c >= 1 and c <= COLS and self:canMoveTo(p, r, c) then
				table.insert(out, { r, c })
			end
		end
	end
	return out
end

function Engine:legalAttacks(p)
	local S = self.S
	local out = {}
	if S.phase ~= "play" or p.owner ~= S.current then
		return out
	end
	if #S.forcedTargets > 0 then -- 강제 대상만 (이동한 말 기준)
		if p == S.movedPiece then
			for _, e in self:alivePieces() do
				if table.find(S.forcedTargets, e.id) and self:forcedPickOk(e) then
					table.insert(out, e.id)
				end
			end
		end
		return out
	end
	for _, e in self:adjEnemies(p) do
		if self:visibleTo(p.owner, e) and self:canBattle(p, e) then
			table.insert(out, e.id)
		end
	end
	return out
end

function Engine:canSearchAt(p)
	local S = self.S
	if S.phase ~= "play" or S.mainUsed or #S.forcedTargets > 0 or p.owner ~= S.current or not self:canSearchPiece(p) then
		return false
	end
	for _, e in S.events do
		if e.r == p.r and e.c == p.c and not e.consumed and S.traces[p.owner][e.r .. "_" .. e.c] then
			return true
		end
	end
	return false
end

-- 액션 처리 후 호출: 할 수 있는 행동이 없으면 자동 생략·턴 종료 (#106 4.6 — 유예 시간은 표시 계층이라 생략)
function Engine:autoStep()
	local S = self.S
	for _ = 1, 8 do
		if S.phase ~= "play" or S.battle or S.fleePick or S.pending or #S.forcedTargets > 0 or #S.forcedQueue > 0 then
			return
		end
		if not S.mainUsed then
			if self:anyMainActionLeft() then
				return
			end
			S.mainUsed = true
			self:log("가능한 주 행동이 없습니다 — 주 행동을 생략합니다.", nil, S.current)
		end
		if self:optionalBattleLeft() then
			return
		end
		self:met(S.current, "autoEnds")
		self:log("할 수 있는 행동이 없어 턴을 종료합니다.", nil, S.current)
		if not self:endTurn() then
			return
		end
	end
end

--==================================================================
-- 경기 종료·승리 조건
--==================================================================

function Engine:gameOver(winner, wtype)
	local S = self.S
	S.phase = "over"
	S.winner = winner
	S.metrics.endTurn = S.turnCount
	S.metrics.winType = wtype
	S.metrics.winner = winner
	-- #121 계약 3.1: 경기 종료가 전투 한가운데서 나도 전투 회계·버프 플래그를 즉시 정리한다 (미개봉 패키지 재고는 보존)
	if S.battle then
		if self.resetFighterTemps then
			self.resetFighterTemps(S.battle.fa)
			self.resetFighterTemps(S.battle.fd)
		end
		S.battle = nil
	end
	S.pending = nil
	S.fleePick = nil
end

-- T4 전멸 패배
function Engine:checkWipe()
	local S = self.S
	if S.phase ~= "play" then
		return false
	end
	for p = 0, 1 do
		local any = false
		for _, x in S.pieces do
			if x.owner == p and x.alive and x.placed and (x.type == "minion" or x.type == "ally") then
				any = true
				break
			end
		end
		if not any then
			self:gameOver(1 - p, "wipe")
			self:log("💀 P" .. (p + 1) .. " 전투 가능 말 전멸 — P" .. (2 - p) .. " 승리!", "imp")
			return true
		end
	end
	return false
end

-- 왕 끝줄 도달 즉시 승리 (GDD-13 4.1)
function Engine:checkKingReach()
	local S = self.S
	if S.phase ~= "play" then
		return false
	end
	for _, p in self:alivePieces() do
		if p.type == "king" and ((p.owner == 0 and p.r == 1) or (p.owner == 1 and p.r == ROWS)) then
			p.revealed = true
			self:gameOver(p.owner, "edge")
			self:log("👑 왕이 적진 최후방에 도달 — P" .. (p.owner + 1) .. " 승리!", "imp")
			return true
		end
	end
	return false
end

--==================================================================
-- 이동·접촉·강제 전투
--==================================================================

-- #21 공개 관측 기억 (향후 AI용 데이터 유지)
function Engine:observeMove(p, visBefore)
	if self:isBurning() then
		return
	end
	local obs = 1 - p.owner
	if visBefore or self:visibleTo(obs, p) then
		self.S.aiSeenMoved[obs][p.id] = true
	end
end

function Engine:doMove(p, r, c)
	local S = self.S
	S.mainUsed = true
	p.movedEver = true
	self:healBreak(p) -- #106 이동은 회복 자세 해제
	S.contactKind = "move"
	if not self:isBurning() then
		p.movedPreBT = true
	end
	if p.type == "bomb" then
		self:met(p.owner, "bombMoves")
	end
	local visBefore = self:visibleTo(1 - p.owner, p)
	local pr = p.r
	local beforeAdj = {}
	for _, e in self:adjEnemies(p) do
		beforeAdj[e.id] = true
	end
	if math.abs(p.r - r) + math.abs(p.c - c) == 2 then -- BT 2칸: 단계 해석
		local mr, mc = (p.r + r) / 2, (p.c + c) / 2
		if self:at(mr, mc) then
			r, c = mr, mc -- 경유 칸의 숨은 말 → 그 칸 진입 시도로 전환
		else
			p.r, p.c = mr, mc
		end
	end
	local hidden = self:at(r, c)
	if hidden then -- 숲 충돌: 직전 칸 정지 + 양측 일시 공개
		S.tempReveal[hidden.id] = true
		S.tempReveal[p.id] = true
		self:observeMove(p, visBefore)
		S.movedPiece = p
		S.contactSet = {}
		for _, e in self:adjEnemies(p) do
			table.insert(S.contactSet, e.id)
		end
		S.contactKind = "collision"
		self:log("P" .. (p.owner + 1) .. " 이동 중 숨은 말과 충돌! 위치가 일시 공개되었습니다.", "imp")
		if p.type == "minion" and zoneHas(1 - p.owner, p.r) and not zoneHas(1 - p.owner, pr) then
			self:met(p.owner, "minionInvades")
		end
		if self:applyForced(p, beforeAdj) then
			return
		end
		return
	end
	p.r, p.c = r, c
	self:observeMove(p, visBefore)
	S.movedPiece = p
	S.contactSet = {}
	for _, e in self:adjEnemies(p) do
		table.insert(S.contactSet, e.id)
	end
	if p.type == "minion" and zoneHas(1 - p.owner, r) and not zoneHas(1 - p.owner, pr) then
		self:met(p.owner, "minionInvades")
	end
	if self:checkKingReach() then
		return
	end
	for _, ev in S.events do
		if ev.r == r and ev.c == c and not ev.consumed then
			S.traces[p.owner][ev.r .. "_" .. ev.c] = true
			self:log("탐색 가능한 흔적을 발견했습니다. (다음 턴에 탐색 가능)", "imp", p.owner)
		end
	end
	if self:applyForced(p, beforeAdj) then
		return
	end
end

-- T1 강제 전투: 새로 인접한 적과 반드시 전투 (#106 폭탄 직접 접촉 포함)
function Engine:applyForced(p, beforeAdj, list)
	local S = self.S
	S.forcedTargets = {}
	if not list then
		list = {}
		for _, e in self:adjEnemies(p) do
			if not beforeAdj[e.id] and self:contactEligible(p, e) then
				table.insert(list, e.id)
			end
		end
	end
	if #list == 0 then
		return false
	end
	S.forcedTargets = list
	if #list == 1 then
		local def = nil
		for _, e in self:alivePieces() do
			if e.id == list[1] then
				def = e
			end
		end
		self:log(p.type == "bomb" and "💣 신규 인접 — 폭탄 접촉 발동!" or "⚔️ 신규 인접 — 강제 전투!", "imp")
		if def then
			self:initBattle(p, def) -- 즉시 개시 (왕·동료 출전 선택은 pending 흐름)
		end
		return true
	end
	self:log("⚔️ 강제 전투 — 신규 인접 대상 " .. #list .. "개 중 하나를 선택하세요.", "imp")
	return true
end

--==================================================================
-- #14 텔레포트 스왑 · #18 강제 전투 queue
--==================================================================

-- #18 강제 전투 적격 (텔레포트·숲 충돌 신규 인접)
local function forcedEligible(att, def)
	if att.type == "trap" then
		return false
	end
	if att.type == "king" and def.type == "king" then
		return false
	end
	return true
end

function Engine:newAdjAt(p, r, c, before)
	local out = {}
	for _, e in self:alivePieces() do
		if e.owner ~= p.owner and math.abs(e.r - r) + math.abs(e.c - c) == 1 and not before[e.id] and forcedEligible(p, e) then
			table.insert(out, e.id)
		end
	end
	return out
end

function Engine:teleportSwapBlock(a, b)
	local beforeA, beforeB = {}, {}
	for _, e in self:adjEnemies(a) do
		beforeA[e.id] = true
	end
	for _, e in self:adjEnemies(b) do
		beforeB[e.id] = true
	end
	local need = (#self:newAdjAt(a, b.r, b.c, beforeA) > 0 and 1 or 0) + (#self:newAdjAt(b, a.r, a.c, beforeB) > 0 and 1 or 0)
	local remain = math.max(0, 2 - self.S.battlesUsed)
	if need > remain then
		return "새 강제 전투 " .. need .. "회 > 남은 전투 " .. remain .. "회 (턴당 최대 2회)"
	end
	return nil
end

function Engine:doTeleportSwap(a, b)
	local S = self.S
	if S.teleUsed[S.current] >= BAL.teleMax then
		return false
	end
	-- #131 계약 3.3: 실행 직전 재검사 (늦은 콜백·수신 프레임 방어). 하나라도 어긋나면 자원·좌표·공개 상태·큐·RNG 전부 불변으로 거부
	if S.phase ~= "play" or S.battle or S.pending or S.fleePick or S.mainUsed then
		return false
	end
	for _, p in { a, b } do
		if not p or p.owner ~= S.current or not p.alive or not p.placed or p.immobile > 0 then
			return false -- 함정에 걸린 말(immobile>0)은 양 끝 모두 금지 — trap 유닛 금지가 아니다
		end
	end
	if a == b then
		return false
	end
	local block = self:teleportSwapBlock(a, b)
	if block then
		self:log("🌀 텔레포트 스왑 차단 — " .. block, "imp", S.current)
		return false
	end
	local beforeA, beforeB = {}, {}
	for _, e in self:adjEnemies(a) do
		beforeA[e.id] = true
	end
	for _, e in self:adjEnemies(b) do
		beforeB[e.id] = true
	end
	S.mainUsed = true
	self:met(S.current, "teleports")
	S.teleUsed[S.current] += 1
	self:healBreak(a)
	self:healBreak(b)
	S.contactKind = "tele"
	a.r, a.c, b.r, b.c = b.r, b.c, a.r, a.c -- movedEver/movedPreBT 미설정 (걷는 이동 아님)
	self:log("상대가 텔레포트를 사용했습니다", "imp", 1 - S.current)
	self:log("🌀 텔레포트 스왑 완료", "imp", S.current)
	for _, p in { a, b } do -- 도착 칸 흔적
		for _, ev in S.events do
			if ev.r == p.r and ev.c == p.c and not ev.consumed then
				S.traces[p.owner][ev.r .. "_" .. ev.c] = true
				self:log("탐색 가능한 흔적을 발견했습니다. (다음 턴에 탐색 가능)", "imp", p.owner)
			end
		end
	end
	if self:checkKingReach() then
		return true
	end
	S.forcedQueue = {}
	for _, pair in { { a, beforeA }, { b, beforeB } } do
		local p, before = pair[1], pair[2]
		local list = {}
		for _, e in self:adjEnemies(p) do
			if not before[e.id] and forcedEligible(p, e) then
				table.insert(list, e.id)
			end
		end
		if #list > 0 then
			table.insert(S.forcedQueue, { pid = p.id, targets = list })
		end
	end
	self:drainForcedQueue(true)
	return true
end

-- #18 강제 전투 queue 소비
function Engine:drainForcedQueue(autoStart)
	local S = self.S
	if S.fleePick then
		return false
	end
	while #S.forcedQueue > 0 and S.phase == "play" and not S.battle and #S.forcedTargets == 0 do
		local n = table.remove(S.forcedQueue, 1)
		local p = nil
		for _, x in self:alivePieces() do
			if x.id == n.pid then
				p = x
			end
		end
		if not p then
			self:log("⚔️ 강제 전투 면제 — 해당 말이 제거되었습니다.", "imp")
			continue
		end
		if S.battlesUsed >= 2 then
			self:log("⚔️ 강제 전투 면제 — 이번 턴 전투 횟수(2회)를 모두 사용했습니다.", "imp")
			continue
		end
		local list = {}
		for _, e in self:adjEnemies(p) do
			if table.find(n.targets, e.id) and forcedEligible(p, e) then
				table.insert(list, e.id)
			end
		end
		if #list == 0 then
			self:log("⚔️ 강제 전투 면제 — 신규 인접 대상이 사라졌습니다.", "imp")
			continue
		end
		S.movedPiece = p
		S.contactSet = {}
		for _, e in self:adjEnemies(p) do
			table.insert(S.contactSet, e.id)
		end
		if autoStart then
			self:applyForced(p, nil, list)
			return true
		end
		S.forcedTargets = list
		self:log(#list == 1 and "⚔️ 텔레포트 스왑 — 남은 말도 강제 전투! (대상 지정 필요)"
			or ("⚔️ 텔레포트 스왑 — 남은 말도 강제 전투! 대상 " .. #list .. "개 중 하나를 선택하세요."), "imp")
		return true
	end
	return false
end

--==================================================================
-- 탐색·이벤트·포획 (#12 · #92)
--==================================================================

function Engine:canSearchPiece(p)
	return p ~= nil and (p.type == "minion" or p.type == "ally" or p.type == "king")
end

function Engine:doSearch(p, ev)
	local S = self.S
	if not self:canSearchPiece(p) then
		return false
	end
	if not ev or ev.consumed or ev.r ~= p.r or ev.c ~= p.c then
		return false
	end
	S.mainUsed = true
	ev.consumed = true
	self:met(p.owner, "searches")
	self:healBreak(p)
	local own = p.owner
	-- GDD-13 4.7: 공용 로그에는 종류·보유량을 남기지 않는다 (상대는 "숲 이벤트 발생"만 본다 — #121 계약 4.8·9)
	self:log("P" .. (own + 1) .. " 숲 이벤트 발생", "imp")
	if p.type == "minion" then
		self:met(own, "minionSearches")
	end
	-- #121 계약 1.1 이후 이벤트는 3종뿐. itemGift·battleBuff 는 그 자리에서 재고 +1 로 끝나고(필수 선택 없음), 개봉은 전투 중 가방에서 한다
	if ev.kind == "itemGift" or ev.kind == "battleBuff" then
		S.pkgs[own][ev.kind] += 1
		self:log("📦 " .. Data.EVENT_KO[ev.kind] .. " 획득! (보유 " .. S.pkgs[own][ev.kind] .. "개)", nil, own)
		return true
	end
	if ev.kind ~= "recruit" then -- 폐기된 종류: 보상 없이 칸만 소모
		self:log("🌿 아무것도 없었다", nil, own)
		return true
	end
	-- #121 계약 4·6 recruit — 기술 교체 / 하수인 포획 / 포기 (소유자 선택 대기). 포획 후보 종은 여기서 rand 1회로 고정
	local species = Data.ROSTER[math.floor(self:rand() * #Data.ROSTER) + 1].id
	S.pending = { kind = "recruit", owner = own, pieceId = p.id, species = species }
	self:log("🌿 숲에서 무언가를 찾았다 — 기술 교체 · 하수인 포획 · 포기 중 선택", nil, own)
	return true
end

-- #121 계약 6 숲 포획 — ROSTER 20종 균등으로 뽑힌 종(rd, 탐색 시점에 고정)의 HP·ATK·기술 수치·CD·4기술·아트 정체를 그대로 적용한다.
-- recv = 포획 슬롯이 빈 동료·왕(수령 말), p = 탐색을 실행한 말. 공격 포획 실패 반동은 p 가 받는다. 난수는 성공 판정 1회뿐.
-- 전투 중 적 포획(finishByCapture → 예비 70/100 공용 규격)은 범위 밖 — 그대로.
function Engine:tryCapture(p, mode, recv, rd)
	local S = self.S
	local own = p.owner
	local target = recv or p
	local cost = (mode == "safe") and 2 or 1
	S.balls[own] -= cost
	local roll = self:rand()
	local ok = (mode == "safe") or (mode == "risky" and roll < 0.5) or (mode == "attack" and roll < 0.7)
	if ok then
		local sp = rd or Data.ROSTER[1]
		target.cap = {
			element = sp.element, hp = sp.hp, maxHp = sp.hp, atk = sp.atk, skillAtk = sp.skill, cd = 0, cdMax = sp.cd,
			skills = Data.archSkills(sp.arch, sp.element), cds = { 0, 0, 0, 0 }, revealedSkills = {},
			-- "그 종 그대로": 규칙이 읽는 rosterId 까지 유지 (archOf 파생 지속시간·계수도 그 종) · artRosterId 는 표시용
			rosterId = sp.id, artRosterId = sp.id,
		}
		self:met(own, "captures")
		return { ok = true, el = sp.element, rd = sp, recv = target }
	end
	self:met(own, "captureFails")
	local dmg = 0
	if mode == "attack" then
		dmg = round(p.maxHp * BAL.captureAtkFailPct)
		p.hp = math.max(1, p.hp - dmg) -- 반동은 탐색 말 (최소 1 남김)
	end
	return { ok = false, dmg = dmg }
end

--==================================================================
-- #114 양측 밀기·재배치
--==================================================================

local PUSH_MSG = "접촉 축을 따라 두 말을 각각 한 칸 밀어냅니다. (막힌 말은 제자리)"
local RELOC_MSG = "각자의 말이 밀어낼 수 없는 상황입니다. 두 말을 재배치합니다."

local function sign(x)
	return x > 0 and 1 or x < 0 and -1 or 0
end

function Engine:pushPair(att, def)
	local dr, dc = sign(def.r - att.r), sign(def.c - att.c)
	local function tryMove(p, r, c)
		if r < 1 or r > ROWS or c < 1 or c > COLS or self:at(r, c) then
			return false
		end
		p.r, p.c = r, c
		return true
	end
	local movedD = tryMove(def, def.r + dr, def.c + dc)
	local movedA = tryMove(att, att.r - dr, att.c - dc)
	return movedA, movedD
end

local function relocZone(o, r)
	if zoneHas(o, r) then
		return 0
	end
	if (o == 0) and (r >= 9 and r <= 10) or (o == 1) and (r >= 4 and r <= 5) then
		return 1
	end
	if r >= 6 and r <= 8 then
		return 2
	end
	return -1
end

function Engine:relocCandidates(p, others)
	local occ, en, out = {}, {}, {}
	for _, x in others do
		occ[x.r .. "_" .. x.c] = true
		if x.owner ~= p.owner then
			table.insert(en, x)
		end
	end
	for r = 1, ROWS do
		for c = 1, COLS do
			local z = relocZone(p.owner, r)
			if z >= 0 and not occ[r .. "_" .. c] then
				local nearEnemy = false
				for _, e in en do
					if math.abs(e.r - r) + math.abs(e.c - c) == 1 then
						nearEnemy = true
						break
					end
				end
				if not nearEnemy then
					table.insert(out, { r = r, c = c, z = z, d = math.abs(p.r - r) + math.abs(p.c - c), back = (p.owner == 0) and (ROWS - r) or (r - 1) })
				end
			end
		end
	end
	table.sort(out, function(a, b)
		if a.z ~= b.z then
			return a.z < b.z
		end
		if a.d ~= b.d then
			return a.d < b.d
		end
		if a.back ~= b.back then
			return a.back < b.back
		end
		return a.c < b.c
	end)
	return out
end

function Engine:relocatePair(att, def)
	local others = {}
	for _, x in self:alivePieces() do
		if x ~= att and x ~= def then
			table.insert(others, x)
		end
	end
	local LA, LD = self:relocCandidates(att, others), self:relocCandidates(def, others)
	local best = nil
	for i, a in LA do
		for j, d in LD do
			if not (a.r == d.r and a.c == d.c) and math.abs(a.r - d.r) + math.abs(a.c - d.c) ~= 1 then
				local key = { a.z + d.z, a.d + d.d, i, j }
				local better = false
				if not best then
					better = true
				else
					local bk = best.key
					if key[1] < bk[1] then
						better = true
					elseif key[1] == bk[1] then
						if key[2] < bk[2] then
							better = true
						elseif key[2] == bk[2] then
							if key[3] < bk[3] then
								better = true
							elseif key[3] == bk[3] and key[4] < bk[4] then
								better = true
							end
						end
					end
				end
				if better then
					best = { a = a, d = d, key = key }
				end
			end
		end
	end
	if not best then
		return false
	end
	att.r, att.c = best.a.r, best.a.c
	def.r, def.c = best.d.r, best.d.c
	return true
end

function Engine:pushResolve(att, def, opts)
	opts = opts or {}
	local who = opts.who ~= nil and opts.who or att.owner
	self:healBreak(att)
	self:healBreak(def)
	if not adj(att, def) then
		return false
	end
	self:met(who, "pushes")
	self:pushPair(att, def)
	self:log("🤜 밀어내기! " .. PUSH_MSG, "imp")
	if self:checkKingReach() then
		return true
	end
	local stuck = adj(att, def) or #self:adjEnemies(att) > 0 or #self:adjEnemies(def) > 0
	if stuck then
		if self:relocatePair(att, def) then
			self:met(who, "relocations")
			self:log("🔄 말 재배치! " .. RELOC_MSG, "imp")
		else
			self:log("🔄 재배치할 안전한 자리가 없어 밀기 결과를 유지합니다. (이 접촉은 처리 완료)", "imp")
		end
	end
	return true
end

function Engine:doPush(att, def)
	local S = self.S
	S.battlesUsed += 1
	self:met(att.owner, "battles")
	self:pushResolve(att, def)
	if S.phase ~= "play" then
		return
	end
	self:afterBattle(att, false)
end

--==================================================================
-- #114 도망 성공 후 교환·밀기
--==================================================================

function Engine:fleeSwapPrompt(piece, opp)
	local S = self.S
	if S.phase ~= "play" or not piece.alive then
		self:fleeDone()
		return
	end
	local own = piece.owner
	local duty = {}
	if #S.forcedTargets > 0 and S.movedPiece then
		duty[S.movedPiece.id] = true
	end
	for _, x in S.forcedQueue do
		duty[x.pid] = true
	end
	local rear = {}
	for _, x in self:alivePieces() do
		if x.owner == own and x.id ~= piece.id and not duty[x.id]
			and ((own == 0 and x.r > piece.r) or (own == 1 and x.r < piece.r)) then
			table.insert(rear, x)
		end
	end
	local cands = {}
	for _, x in rear do
		table.insert(cands, x.id)
	end
	S.fleePick = {
		owner = own, pieceId = piece.id,
		oppId = (opp and opp.alive and opp.placed) and opp.id or nil,
		cands = cands,
	}
	if #rear == 0 then
		self:fleeResolve(nil)
		return
	end
	self:log("🏃 도망 성공 — 후방 말 교환 선택 중", "imp")
end

function Engine:fleeDone()
	local S = self.S
	if S.phase == "play" and not S.battle then
		self:drainForcedQueue(false)
	end
end

function Engine:fleeResolve(swapId)
	local S = self.S
	local fp = S.fleePick
	if not fp then
		return false
	end
	S.fleePick = nil
	local piece = self:pieceById(fp.pieceId)
	local opp = fp.oppId and self:pieceById(fp.oppId) or nil
	local front = piece
	local t = swapId and self:pieceById(swapId) or nil
	if t and table.find(fp.cands, t.id) and t.alive and t.placed and piece.alive and piece.placed then
		self:fleeSwap(piece, t)
		front = t
	else
		self:log(#fp.cands > 0 and "🏃 도망 — 교환 생략" or "🏃 도망 — 교환할 후방 말이 없습니다", "imp")
	end
	if S.phase == "play" and opp and opp.alive and opp.placed and front.alive and front.placed and adj(front, opp) then
		self:met(fp.owner, "fleePushes")
		self:pushResolve(front, opp, { who = fp.owner })
	end
	self:fleeDone()
	return true
end

function Engine:fleeSwap(a, b)
	a.r, a.c, b.r, b.c = b.r, b.c, a.r, a.c
	self:healBreak(a)
	self:healBreak(b)
	self:log("🏃 도망 — 후방 말과 위치를 교환했습니다.", "imp")
	self:checkKingReach()
end

function Engine:afterBattle(attacker, attackerWonAlive)
	local S = self.S
	if S.battlesUsed == 1 then
		S.firstBattleWonByMover = (attacker == S.movedPiece and attackerWonAlive)
	end
	self:drainForcedQueue(false)
end

--==================================================================
-- 액션 라우팅 (서버 진입점)
--==================================================================

local BOARD_ACTS = { move = true, battle = true, search = true, tele = true, heal = true, skipMain = true, endTurn = true }
local BATTLE_ACTS = { act = true, item = true, ball = true, flee = true, gift = true, buff = true, pass = true } -- #121 패키지·버프 · #146 pass(쓸 기술 없음 수동 넘기기)

-- apply(actor, a) → true | false, 사유. 상태 전이는 동기 완결, 이벤트는 outbox 에 쌓인다.
function Engine:apply(actor, a)
	local S = self.S
	if type(a) ~= "table" or type(a.t) ~= "string" then
		return false, "잘못된 액션"
	end
	if S.phase == "over" then
		return false, "경기가 종료되었습니다"
	end
	if S.phase == "setup" then
		return false, "아직 게임이 시작되지 않았습니다"
	end
	local t = a.t

	if t == "resign" then
		if S.current ~= actor then
			return false, "자기 턴에만 기권할 수 있습니다"
		end
		self:gameOver(1 - actor, "resign")
		self:log("🏳️ P" .. (actor + 1) .. " 기권 — P" .. (2 - actor) .. " 승리!", "imp")
		return true
	end

	if S.pending then
		local pd = S.pending
		if actor ~= pd.owner then
			return false, "상대 선택 대기 중"
		end
		if pd.kind == "vip" then
			return self:applyVipPick(a)
		elseif pd.kind == "recruit" then
			return self:applyRecruit(a)
		end
		return false, "알 수 없는 대기 상태"
	end

	if S.fleePick then
		if actor ~= S.fleePick.owner then
			return false, "상대의 교환 선택 대기 중"
		end
		if t == "fleeSwap" then
			if not table.find(S.fleePick.cands, a.id) then
				return false, "교환 후보가 아닙니다"
			end
			self:fleeResolve(a.id)
			self:autoStep()
			return true
		elseif t == "fleeSkip" then
			self:fleeResolve(nil)
			self:autoStep()
			return true
		end
		return false, "도망 교환 선택 중"
	end

	if S.battle then
		if not BATTLE_ACTS[t] then
			return false, "전투 중에는 전투 행동만 가능합니다"
		end
		local side = self:actorOfPhase()
		local ownerP = (side == "A") and S.battle.attP.owner or S.battle.defP.owner
		if actor ~= ownerP then
			return false, "상대 행동 차례입니다"
		end
		local ok, err = self:applyBattleAction(side, a)
		if ok then
			self:autoStep()
		end
		return ok, err
	end

	if not BOARD_ACTS[t] then
		return false, "지금 할 수 없는 행동입니다"
	end
	if actor ~= S.current then
		return false, "자기 턴이 아닙니다"
	end

	if t == "move" then
		local p = self:pieceById(a.id)
		if not p or not p.alive or not p.placed or p.owner ~= actor then
			return false, "자기 말이 아닙니다"
		end
		if #S.forcedTargets > 0 then
			return false, "강제 전투 대상과 전투해야 합니다"
		end
		if not self:canMoveTo(p, a.r, a.c) then
			return false, "이동할 수 없는 칸입니다"
		end
		self:doMove(p, a.r, a.c)
		self:autoStep()
		return true
	elseif t == "battle" then
		local att, def = self:pieceById(a.attId), self:pieceById(a.defId)
		if not att or not def or att.owner ~= actor or def.owner == actor or not def.alive or not def.placed then
			return false, "전투 대상이 잘못되었습니다"
		end
		if #S.forcedTargets > 0 then
			if att ~= S.movedPiece or not self:forcedPickOk(def) then
				return false, "강제 전투 대상이 아닙니다"
			end
		else
			if not adj(att, def) or not self:visibleTo(actor, def) or not self:canBattle(att, def) then
				return false, "전투할 수 없는 대상입니다"
			end
		end
		self:initBattle(att, def)
		self:autoStep()
		return true
	elseif t == "search" then
		local p = self:pieceById(a.id)
		if not p or p.owner ~= actor or not p.alive or not p.placed then
			return false, "자기 말이 아닙니다"
		end
		if S.mainUsed then
			return false, "주 행동을 이미 사용했습니다"
		end
		if #S.forcedTargets > 0 then
			return false, "강제 전투 대상과 전투해야 합니다"
		end
		if not self:canSearchPiece(p) then
			return false, "폭탄·함정은 탐색할 수 없습니다"
		end
		local ev = nil
		for _, e in S.events do
			if e.r == p.r and e.c == p.c and not e.consumed and S.traces[actor][e.r .. "_" .. e.c] then
				ev = e
			end
		end
		if not ev then
			return false, "탐색할 흔적이 없습니다"
		end
		self:doSearch(p, ev)
		self:autoStep()
		return true
	elseif t == "tele" then
		if S.mainUsed then
			return false, "주 행동을 이미 사용했습니다"
		end
		if #S.forcedTargets > 0 then
			return false, "강제 전투 대상과 전투해야 합니다"
		end
		if not self:teleportAvailable(actor) or S.teleUsed[actor] >= BAL.teleMax then
			return false, "텔레포트를 사용할 수 없습니다"
		end
		local pa, pb = self:pieceById(a.aId), self:pieceById(a.bId)
		if not pa or not pb or pa == pb or pa.owner ~= actor or pb.owner ~= actor
			or not pa.alive or not pb.alive or not pa.placed or not pb.placed
			or pa.immobile > 0 or pb.immobile > 0 then
			return false, "교환할 두 자기 말을 지정하세요 (이동 불가 말 제외)"
		end
		if not self:doTeleportSwap(pa, pb) then
			return false, "텔레포트 스왑이 차단되었습니다"
		end
		self:autoStep()
		return true
	elseif t == "heal" then
		local p = self:pieceById(a.id)
		if not p or not self:canHeal(p) then
			return false, "회복을 지정할 수 없는 말입니다"
		end
		self:doHeal(p)
		self:autoStep()
		return true
	elseif t == "skipMain" then
		if S.mainUsed then
			return false, "주 행동을 이미 사용했습니다"
		end
		S.mainUsed = true
		self:log("P" .. (actor + 1) .. " 주 행동 생략")
		self:autoStep()
		return true
	elseif t == "endTurn" then
		if not self:endTurn() then
			return false, "지금은 턴을 종료할 수 없습니다"
		end
		self:autoStep()
		return true
	end
	return false, "알 수 없는 액션"
end


-- 계약 4.2: 교체 대상은 최초 로스터로 배치된 하수인 6명 (생성 순서). 죽은 말도 목록엔 있되 선택 불가
function Engine:rosterMinions(own)
	local out = {}
	for _, x in self.S.pieces do
		if x.owner == own and x.type == "minion" then
			table.insert(out, x)
		end
	end
	return out
end

-- 계약 6: 포획 수령 말 — 살아 있고 배치된 동료·왕 중 포획 슬롯(cap)이 빈 말
function Engine:capReceivers(own)
	local out = {}
	for _, x in self:alivePieces() do
		if x.owner == own and (x.type == "ally" or x.type == "king") and not x.cap then
			table.insert(out, x)
		end
	end
	return out
end

-- pending: recruit (#121 계약 4·6·7) — recruitSwap{skill,targetId,slot} / capTry{mode,recvId} / recruitKeep(포기)
-- 확정 전에는 어떤 슬롯도 건드리지 않는다. 이벤트 칸 소모는 되돌리지 않는다. 난수는 포획 판정 1회뿐
function Engine:applyRecruit(a)
	local S = self.S
	local pd = S.pending
	local own = pd.owner
	local searcher = self:pieceById(pd.pieceId)
	if a.t == "recruitKeep" then
		S.pending = nil
		self:log("🌿 아무것도 얻지 않았다 — 이벤트 칸은 소모되었습니다", nil, own)
		self:autoStep()
		return true
	end
	if a.t == "recruitSwap" then
		if not table.find(Data.NEW_SKILLS, a.skill) then
			return false, "신규 기술 3종 중에서 고르세요"
		end
		local m = self:pieceById(a.targetId)
		if not m or m.owner ~= own or m.type ~= "minion" or not m.alive or not m.placed or not m.skills then
			return false, "살아 있는 내 최초 하수인만 배울 수 있습니다"
		end
		if table.find(m.skills, a.skill) then
			return false, "이미 그 기술을 가진 말입니다"
		end
		local slot = a.slot
		if type(slot) ~= "number" or slot < 1 or slot > 4 or slot % 1 ~= 0 then
			return false, "슬롯은 1~4"
		end
		S.pending = nil
		m.skills[slot] = a.skill -- cds[slot] 유지 (남은 쿨 승계)
		if m.revealedSkills then
			local i = table.find(m.revealedSkills, slot)
			if i then
				table.remove(m.revealedSkills, i) -- 그 슬롯은 다시 비공개
			end
		end
		self:log(("📘 %s 습득! %s 슬롯 %d (남은 쿨 %d 승계)"):format(Data.SKILLS[a.skill].ko, m.name or "하수인", slot, m.cds[slot]), nil, own)
		self:autoStep()
		return true
	end
	if a.t == "capTry" then
		local mode = a.mode
		if not table.find(Data.CAP_MODES, mode) then
			return false, "알 수 없는 포획 방식"
		end
		local recv = self:pieceById(a.recvId)
		if not recv or recv.owner ~= own or not recv.alive or not recv.placed or not (recv.type == "ally" or recv.type == "king") or recv.cap then
			return false, "포획 슬롯이 빈 동료·왕을 고르세요"
		end
		local cost = (mode == "safe") and 2 or 1
		if S.balls[own] < cost then
			return false, "몬스터볼이 부족합니다"
		end
		if not searcher or not searcher.alive then
			return false, "탐색한 말이 사라졌습니다"
		end
		S.pending = nil
		local rd = Data.rosterById(pd.species)
		local r = self:tryCapture(searcher, mode, recv, rd)
		if r.ok then
			self:log(("🔴 포획 성공! %s — %s의 대리 출전 가능"):format(rd and rd.name or "공용 하수인", Data.TYPE_KO[recv.type]), nil, own)
		else
			self:log("🔴 포획 실패 — 공용 하수인이 사라졌습니다." .. (r.dmg > 0 and (" 탐색 말 HP -" .. r.dmg) or ""), nil, own)
		end
		self:autoStep()
		return true
	end
	return false, "기술 교체·포획·포기 중 선택 대기 중"
end

-- 전투 모듈 부착 (initBattle·execSlot·판정 등)
local Battle = req("Battle")
Battle.attach(Engine, { Config = Config, Data = Data })

return Engine
