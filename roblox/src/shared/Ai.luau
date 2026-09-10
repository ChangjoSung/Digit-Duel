--!nonstrict
-- Ai.luau — #21 PVE AI 포팅 (demo/index.html v0.4.5 "AI (공정 관측 휴리스틱)" + "5단 탐색·추론 강AI" 그대로)
--   grade5 (5급): T6 성격 프로파일·ε-무작위·목적 이동·전투 쌍 점수 휴리스틱
--   dan5   (5단): 후보 행동 → 1-ply 위치 평가 → 상위 K 후보 2-ply 최악 응수 → 기대치 기반 전투 행동
-- 공정 관측 원칙: visibleTo(me)·revealed·공개 제거 집계·목격 이동 기억(aiSeenMoved)만 사용한다. 숨은 적의 정체는 절대 읽지 않는다.
-- 실행 모델: 서버(또는 헤드리스 테스트)가 Ai.act(engine, me) 를 봇 차례마다 호출한다. 모든 행동은 Engine:apply(me, action) 로
-- 사람과 같은 검증 경로를 지나므로 봇이 사람보다 더 할 수 있는 일은 없다. 판단·정책 순서는 JS 원본과 같다.

local function req(mod)
	if script then
		return require(script.Parent:WaitForChild(mod))
	end
	return require("./" .. mod)
end

local Data = req("Data")
local Config = req("Config")
local BAL = Config.BAL
local AIC = Config.AI
local ROWS, COLS = Config.ROWS, Config.COLS
local BEATS = Data.BEATS
local SKILLS = Data.SKILLS
local DIRS = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } }
local STUB = { element = nil, hp = 100, maxHp = 100, atk = 22, type = "minion" } -- 미공개 적 추정용 기본 하수인

local Ai = {}
Ai.LEVEL_KO = { grade5 = "5급", dan5 = "5단" }

--==================================================================
-- 공용 유틸
--==================================================================

local function dist(a, b)
	return math.abs(a.r - b.r) + math.abs(a.c - b.c)
end
local function distRC(e, r, c)
	return math.abs(e.r - r) + math.abs(e.c - c)
end
local function adj(a, b)
	return dist(a, b) == 1
end
local function isVip(x)
	return x.type == "ally" or x.type == "king"
end
local function inBounds(r, c)
	return r >= 1 and r <= ROWS and c >= 1 and c <= COLS
end
local function inForestRow(r)
	return (r >= 4 and r <= 5) or (r >= 9 and r <= 10)
end
local function zoneHas(p, r)
	return (p == 0) and (r >= 11 and r <= 13) or (p == 1) and (r >= 1 and r <= 3)
end
local function nowMs()
	return os.clock() * 1000
end

-- 안정 정렬 (JS Array.sort 는 안정 — 동점 시 삽입 순서 유지)
local function stableSortDesc(list, key)
	for i, x in list do
		x.__i = i
	end
	table.sort(list, function(a, b)
		local ka, kb = key(a), key(b)
		if ka ~= kb then
			return ka > kb
		end
		return a.__i < b.__i
	end)
	for _, x in list do
		x.__i = nil
	end
	return list
end
local function stableSortAsc(list, key)
	for i, x in list do
		x.__i = i
	end
	table.sort(list, function(a, b)
		local ka, kb = key(a), key(b)
		if ka ~= kb then
			return ka < kb
		end
		return a.__i < b.__i
	end)
	for _, x in list do
		x.__i = nil
	end
	return list
end

-- 세션별 AI 상태 (엔진 상태 안에 둔다 — 프로파일·선봉·이동 이력·난이도)
local function aiState(en)
	local S = en.S
	if not S.ai then
		S.ai = { profile = {}, vanguard = {}, hist = {}, level = { [0] = "grade5", [1] = "grade5" }, lastThinkMs = 0 }
	end
	return S.ai
end

function Ai.setLevel(en, me, level)
	aiState(en).level[me] = (level == "dan5") and "dan5" or "grade5"
end

local function levelOf(en, me)
	return aiState(en).level[me] or "grade5"
end
Ai.levelOf = levelOf

local function mine(en, me)
	local out = {}
	for _, p in en:alivePieces() do
		if p.owner == me then
			table.insert(out, p)
		end
	end
	return out
end

local function findEvent(en, me, p)
	local S = en.S
	for _, e in S.events do
		if e.r == p.r and e.c == p.c and not e.consumed and S.traces[me][e.r .. "_" .. e.c] then
			return e
		end
	end
	return nil
end

--==================================================================
-- T6 성격 프로파일·관측
--==================================================================

local function aiProf(en, me)
	local st = aiState(en)
	if not st.profile[me] then
		if levelOf(en, me) == "dan5" then -- #21 5단: 고정 프로파일·ε 무작위 없음
			st.profile[me] = { aggression = 1, capture = 1, kingRush = 1, caution = 1, eps = 0 }
		else
			local function r()
				return 0.6 + en:rand() * 0.8
			end
			local prof = {}
			prof.aggression = r()
			prof.capture = r()
			prof.kingRush = r()
			prof.caution = r()
			prof.eps = 0.05 + en:rand() * 0.10
			st.profile[me] = prof
		end
	end
	return st.profile[me]
end

-- T6 전멸 회피: 전투 가능 말(하수인+동료) 2 이하면 신중 가중 강화
local function aiCaution(en, me)
	local n = 0
	for _, x in en:alivePieces() do
		if x.owner == me and (x.type == "minion" or x.type == "ally") then
			n += 1
		end
	end
	return aiProf(en, me).caution * ((n <= 2) and 1.6 or 1)
end

-- 관측: AI 는 visibleTo(me)·revealed·목격 이동 기억만 사용
local function aiVisible(en, me)
	local out = {}
	for _, e in en:alivePieces() do
		if e.owner ~= me and en:visibleTo(me, e) then
			table.insert(out, e)
		end
	end
	return out
end

local function aiSeenMoved(en, me, e)
	local sm = en.S.aiSeenMoved
	return sm ~= nil and sm[me] ~= nil and sm[me][e.id] == true
end

local function aiThreatOf(en, me, e)
	if e.revealed then
		if e.type == "bomb" then
			return "bomb"
		end
		if e.type == "trap" then
			return "trap"
		end
		return "unit"
	end
	-- 이동 이력은 '함정 아님'만 증명 — 폭탄 후보는 남음 (관측자가 실제로 목격한 이동만)
	return aiSeenMoved(en, me, e) and "unknownMoved" or "unknownStatic"
end

-- 공개 정보(제거는 전부 공개 이벤트)·목격 이동 기반 폭탄·함정 확률 추정
local function aiStaticRisk(en, me, moved)
	local S = en.S
	local opp = 1 - me
	local bombsLeft, trapsLeft, pool = 0, 0, 0
	for _, p in S.pieces do
		if p.owner == opp and p.alive then
			if p.type == "bomb" then
				bombsLeft += 1
			elseif p.type == "trap" then
				trapsLeft += 1
			end
			if p.placed and not p.revealed then
				local seen = aiSeenMoved(en, me, p)
				if (moved and seen) or (not moved and not seen) then
					pool += 1
				end
			end
		end
	end
	return ((moved and 0 or trapsLeft * 0.5) + bombsLeft) / math.max(1, pool)
end

--==================================================================
-- 이동·전투 후보 공용
--==================================================================

local function aiMoveOptions(en, p)
	local out = {}
	local ks = en:isBurning() and { 1, 2 } or { 1 }
	for _, d in DIRS do
		for _, k in ks do
			local r, c = p.r + d[1] * k, p.c + d[2] * k
			if inBounds(r, c) and en:canMoveTo(p, r, c) then
				table.insert(out, { r, c })
			end
		end
	end
	return out
end

local function aiCellDanger(en, me, r, c) -- 그 칸에 인접한 (보이는) 적 유닛 수
	local n = 0
	for _, e in aiVisible(en, me) do
		if distRC(e, r, c) == 1 and aiThreatOf(en, me, e) ~= "trap" then
			n += 1
		end
	end
	return n
end

-- 말 가치 (자기 말 또는 공개된 적 말) — 적의 포획 하수인 보유(cap)는 비공개 정보라 자기 말만 반영
local function aiUnitValue(x, me)
	if x.type == "king" then
		return 200
	end
	if x.type == "ally" then
		return 40 + ((x.cap and x.owner == me) and 25 or 0)
	end
	if x.type == "minion" then
		return 26 + (x.hp / x.maxHp) * 24
	end
	if x.type == "bomb" then
		return 18
	end
	if x.type == "trap" then
		return 10
	end
	return 20
end

-- #114 AI 밀기 평가 (5급·5단 공용 — def 는 revealed 동료/왕일 때만 호출)
local function aiVipPair(att, def)
	return isVip(att) and def.revealed == true and isVip(def)
end
local function aiPushScore(att, def)
	if def.type == "king" then
		local s = def.r - att.r
		local nr = def.r + ((s > 0) and 1 or (s < 0) and -1 or 0)
		if nr == ((def.owner == 0) and 1 or ROWS) then
			return -aiUnitValue(def, att.owner)
		end
	end
	return 0
end

-- T6: 전투 쌍 기대 점수 — aiEvalBattles·강제 전투 예측 공용, 프로파일 가중 포함
local function aiBattlePairScore(en, me, att, def)
	local S = en.S
	local prof = aiProf(en, me)
	local th = aiThreatOf(en, me, def)
	local pressure = (S.turnCount / BAL.maxTurns) * 14
	local sc = 0
	if th == "bomb" then
		sc = (att.type == "ally") and 30 or -100
	elseif th == "trap" then
		sc = (att.type == "minion") and -15 or -30
	elseif th == "unknownStatic" or th == "unknownMoved" then
		local risk = aiStaticRisk(en, me, th == "unknownMoved")
		if att.type == "ally" then
			sc = 18 + pressure
		elseif att.type == "king" then
			sc = -100
		else
			sc = 8 - 18 * risk + pressure
		end
	elseif aiVipPair(att, def) then
		return aiPushScore(att, def)
	else -- 유닛 (공개)
		if def.type == "king" then
			sc = 45
		elseif def.type == "ally" then
			sc = 25
		else
			sc = 10
			if att.element and def.element then
				if BEATS[att.element] == def.element then
					sc += 20
				elseif BEATS[def.element] == att.element then
					sc -= 20
				end
			end
			sc += (att.hp - def.hp) / 5
		end
		if att.type == "king" then
			sc -= 25
		end
		if att.type == "ally" and not att.cap then
			sc -= 15
		end
	end
	sc += att.hp / 20
	if sc > 0 then
		sc = sc * prof.aggression
	else
		sc = sc * aiCaution(en, me)
	end
	-- 수비: 자기 최후방 행 인접 적은 우선 제거 — 끝줄 승리 저지
	if th ~= "bomb" and th ~= "trap" and math.abs(def.r - ((me == 0) and ROWS or 1)) <= 1 then
		sc += 40
	end
	return sc
end

local function aiEvalBattles(en, me)
	local best = nil
	for _, att in mine(en, me) do
		for _, def in en:adjEnemies(att) do
			if en:visibleTo(me, def) and en:canBattle(att, def) then
				local sc = aiBattlePairScore(en, me, att, def)
				if not best or sc > best.score then
					best = { att = att, def = def, score = sc }
				end
			end
		end
	end
	if not best or best.score < 6 then
		return nil
	end
	return best
end

-- T6 강제 전투 예측: (r,c) 이동 시 새로 인접하게 될 보이는 적 중 최선 전투 기대 점수 (없으면 nil)
local function aiForcedScore(en, me, p, r, c)
	local best = nil
	for _, e in aiVisible(en, me) do
		if distRC(e, r, c) == 1 and not adj(p, e) and not (p.type == "king" and e.type == "king") then
			local s = aiBattlePairScore(en, me, p, e)
			if best == nil or s > best then
				best = s
			end
		end
	end
	return best
end

-- #14 텔레포트 스왑 판단: 왕 러시 · 위기 왕 구출
local function aiTeleportPick(en, me)
	local S = en.S
	if S.mainUsed or not en:teleportAvailable(me) or S.teleUsed[me] >= BAL.teleMax then
		return nil
	end
	local prof, caut = aiProf(en, me), aiCaution(en, me)
	local my = mine(en, me)
	local king = nil
	for _, x in my do
		if x.type == "king" and x.immobile == 0 then
			king = x
		end
	end
	if not king then
		return nil
	end
	local best = nil
	local goal = (me == 0) and 1 or ROWS
	for _, p in my do
		if p.id ~= king.id and p.immobile == 0 and zoneHas(1 - me, p.r) then
			if aiCellDanger(en, me, p.r, p.c) == 0 and not en:teleportSwapBlock(king, p) then
				local sc = (20 + (3 - math.abs(p.r - goal)) * 8) * prof.kingRush
				if not best or sc > best.sc then
					best = { a = king, b = p, sc = sc }
				end
			end
		end
	end
	if #en:adjEnemies(king) > 0 then
		local rears = {}
		for _, x in my do
			if x.id ~= king.id and x.immobile == 0 and zoneHas(me, x.r) and aiCellDanger(en, me, x.r, x.c) == 0
				and not en:teleportSwapBlock(king, x) then
				table.insert(rears, x)
			end
		end
		if #rears > 0 then
			local sc = 24 * caut
			if not best or sc > best.sc then
				best = { a = king, b = rears[1], sc = sc }
			end
		end
	end
	return best
end

-- #106 5급 회복 후보: 가시 인접 적 없고 HP<60% 인 자기 말 (난수 미소비)
local function aiHealPick(en, me)
	local caut = aiCaution(en, me)
	local vis = aiVisible(en, me)
	local best = nil
	for _, p in mine(en, me) do
		if en:canHeal(p) and p.hp < p.maxHp * 0.6 then
			local near = false
			for _, e in vis do
				if adj(e, p) then
					near = true
					break
				end
			end
			if not near then
				local sc = (1 - p.hp / p.maxHp) * 30 * caut + ((p.type == "king") and 10 or 0)
				if not best or sc > best.sc then
					best = { p = p, sc = sc }
				end
			end
		end
	end
	return best
end

local function aiRandomMove(en, me)
	local ps = {}
	for _, p in mine(en, me) do
		if p.immobile == 0 and p.type ~= "bomb" and p.type ~= "trap" then
			table.insert(ps, p)
		end
	end
	en:shuffle(ps)
	for _, p in ps do
		local o = aiMoveOptions(en, p)
		if #o > 0 then
			local pick = o[math.floor(en:rand() * #o) + 1]
			return { t = "move", id = p.id, r = pick[1], c = pick[2] }
		end
	end
	return nil
end

--==================================================================
-- 5급 주 행동 — 실행 대신 액션 목록(우선순위순)을 돌려준다. 실행자는 Ai.act
--==================================================================

local function aiMain(en, me)
	local S = en.S
	local prof, caut = aiProf(en, me), aiCaution(en, me)
	local my = mine(en, me)
	-- ε-무작위 — T6 프로파일 기반 0.05~0.15
	if en:rand() < prof.eps then
		local rm = aiRandomMove(en, me)
		if rm then
			return { rm }, "이동"
		end
	end
	-- 1. 흔적 위 말이 있으면 탐색
	for _, p in my do
		if en:canSearchPiece(p) then
			local ev = findEvent(en, me, p)
			if ev then
				return { { t = "search", id = p.id } }, "탐색"
			end
		end
	end
	-- 2. 왕 안전: 인접 적 있으면 회피 이동
	local king = nil
	for _, p in my do
		if p.type == "king" then
			king = p
		end
	end
	if king and #en:adjEnemies(king) > 0 and king.immobile == 0 then
		local opts = {}
		for _, rc in aiMoveOptions(en, king) do
			if not en:at(rc[1], rc[2]) then
				table.insert(opts, { r = rc[1], c = rc[2], d = aiCellDanger(en, me, rc[1], rc[2]) })
			end
		end
		stableSortAsc(opts, function(o)
			return o.d
		end)
		if #opts > 0 and aiCellDanger(en, me, king.r, king.c) > opts[1].d then
			return { { t = "move", id = king.id, r = opts[1].r, c = opts[1].c } }, "이동"
		end
	end
	-- 2.5 폭탄 이동 활용: BT 중 왕 비인접 폭탄을 왕 인접 빈 칸으로 호위 재배치
	if en:isBurning() and king then
		local holes = {}
		for _, d in DIRS do
			local r, c = king.r + d[1], king.c + d[2]
			if inBounds(r, c) and not en:at(r, c) then
				table.insert(holes, { r, c })
			end
		end
		local vis = aiVisible(en, me)
		local function vipAdj(r, c)
			for _, e in vis do
				if e.revealed and isVip(e) and distRC(e, r, c) == 1 then
					return true
				end
			end
			return false
		end
		for _, b in my do
			if b.type == "bomb" and b.immobile == 0 and not adj(b, king) then
				for _, h in holes do
					if en:canMoveTo(b, h[1], h[2]) and not vipAdj(h[1], h[2]) then
						return { { t = "move", id = b.id, r = h[1], c = h[2] } }, "이동"
					end
				end
			end
		end
	end
	-- 3. 강한 전투 기회가 있으면 주 행동 생략(위치 보존)
	local pick = aiEvalBattles(en, me)
	if pick and pick.score >= 18 then
		return { { t = "skipMain" } }, "주 행동 생략"
	end
	-- 4. 목적 이동 — 선봉 집중
	local st = aiState(en)
	local vg = st.vanguard[me]
	local vgAlive = false
	if vg then
		for _, p in S.pieces do
			if p.id == vg and p.alive and p.immobile == 0 then
				vgAlive = true
			end
		end
	end
	if not vg or not vgAlive then
		local vcands = {}
		for _, p in my do
			if p.type == "minion" and p.immobile == 0 then
				table.insert(vcands, p)
			end
		end
		stableSortAsc(vcands, function(p)
			return ((me == 1) and -p.r or p.r) * 10 + math.abs(p.c - 4)
		end)
		vg = (#vcands > 0) and vcands[1].id or nil
		st.vanguard[me] = vg
	end
	local hunt = nil
	for _, e in aiVisible(en, me) do
		if e.type == "king" and e.revealed then
			hunt = e
			break
		end
	end
	local cands = {}
	for _, p in my do
		if p.immobile == 0 and p.type ~= "bomb" and p.type ~= "trap" then
			for _, rc in aiMoveOptions(en, p) do
				local r, c = rc[1], rc[2]
				local sc = 0
				local fwd = (me == 1) and (r - p.r) or (p.r - r)
				if p.type == "minion" then
					sc += fwd * 6 * prof.aggression + (4 - math.abs(c - 4))
					if p.id == vg then
						sc += 12
					end
					if hunt then
						sc += (dist(p, hunt) - distRC(hunt, r, c)) * 12
					end
				end
				if p.type == "ally" and (p.cap or S.balls[me] == 0) then
					sc += fwd * 5
					if hunt then
						sc += (dist(p, hunt) - distRC(hunt, r, c)) * 10
					end
				elseif p.type == "ally" or (p.type == "king" and #en:adjEnemies(p) == 0) then
					local targetRows = (me == 1) and { 4, 5 } or { 9, 10 }
					local dNow = math.min(math.abs(p.r - targetRows[1]), math.abs(p.r - targetRows[2]))
					local dNew = math.min(math.abs(r - targetRows[1]), math.abs(r - targetRows[2]))
					sc += (dNow - dNew) * 8 * prof.capture
					if p.type == "king" then
						sc -= 4
					end
					if inForestRow(r) then
						sc += 3 * prof.capture
					end
				end
				if p.type == "king" then
					local goal = (me == 0) and 1 or ROWS
					if r == goal then
						sc += 100 * prof.kingRush
					end
					sc += (math.abs(p.r - goal) - math.abs(r - goal)) * 1.5 * prof.kingRush
				end
				local fsc = aiForcedScore(en, me, p, r, c)
				if fsc ~= nil then
					sc += fsc * 0.8
				end
				sc -= aiCellDanger(en, me, r, c) * 3 * caut
				sc += en:rand() * 2
				table.insert(cands, { p = p, r = r, c = c, sc = sc })
			end
		end
	end
	stableSortDesc(cands, function(x)
		return x.sc
	end)
	local tp = aiTeleportPick(en, me)
	local hl = aiHealPick(en, me)
	local top = (#cands > 0) and cands[1].sc or 0
	if hl and hl.sc > top and (not tp or hl.sc > tp.sc) then
		return { { t = "heal", id = hl.p.id } }, "회복 행동"
	end
	local list = {}
	if tp and tp.sc > top then
		table.insert(list, { t = "tele", aId = tp.a.id, bId = tp.b.id }) -- 차단 시 일반 이동으로 대체
	end
	if #cands > 0 then
		table.insert(list, { t = "move", id = cands[1].p.id, r = cands[1].r, c = cands[1].c })
	end
	table.insert(list, { t = "skipMain" })
	return list, "주 행동"
end

--==================================================================
-- 5단 — 기대치·위치 평가·2-ply
--==================================================================

-- 공개 스탯 기반 승률 추정 — 포획 하수인(cap) 출전은 자기 말(owner==me)만 가정
local function aiWinProb(att, def, me)
	local fa = (att.owner == me and att.cap) and att.cap or att
	local fd = (def.owner == me and def.cap) and def.cap or def
	local p = 0.5
	if fa.element and fd.element then
		if BEATS[fa.element] == fd.element then
			p += 0.18
		elseif BEATS[fd.element] == fa.element then
			p -= 0.18
		end
	end
	p += ((fa.hp / fa.maxHp) - (fd.hp / fd.maxHp)) * 0.3
	p += ((fa.atk or 0) - (fd.atk or 0)) / 60
	if not fa.skills and (att.type == "king" or att.type == "ally") then
		p -= 0.1
	end
	if not fd.skills and (def.type == "king" or def.type == "ally") then
		p += 0.1
	end
	if att.nextBattleBuff then
		p += 0.05
	end
	return math.max(0.08, math.min(0.92, p))
end

-- 전투 기대치 (me 관점, 양수=유리): 미공개 적은 목격 이동 여부별 폭탄·함정 확률 혼합
local function aiBattleEV(en, me, att, def)
	local S = en.S
	if att.type == "trap" then
		return nil
	end
	if att.type == "bomb" then
		local th = aiThreatOf(en, me, def)
		if th == "bomb" or th == "trap" then
			return 0
		end
		if th == "unit" then
			return (def.type == "minion") and (aiUnitValue(def, me) - 18) or -18
		end
		return (1 - math.min(1, aiStaticRisk(en, me, th == "unknownMoved"))) * 2
	end
	if att.type == "king" and def.type == "king" then
		return nil
	end
	local th, va = aiThreatOf(en, me, def), aiUnitValue(att, me)
	local bombEV = (att.type == "minion") and (-va + 16) or 22
	local trapEV = -10
	if th == "bomb" then
		return bombEV
	end
	if th == "trap" then
		return trapEV
	end
	local edgeGuard = (math.abs(def.r - ((me == 0) and ROWS or 1)) <= 1) and 45 or 0
	local pressure = math.min(1, S.turnCount / BAL.maxTurns) * 8
	if th == "unit" then
		if aiVipPair(att, def) then
			return aiPushScore(att, def)
		end
		local p = aiWinProb(att, def, me)
		local ev = p * (aiUnitValue(def, me) + ((def.type == "king") and 400 or 0)) - (1 - p) * va
		if att.type == "king" and not att.cap then
			ev -= (1 - p) * 400
		else
			ev += 4
		end
		return ev + edgeGuard + pressure
	end
	local r = math.min(1, aiStaticRisk(en, me, th == "unknownMoved"))
	local trapShare = (th == "unknownMoved") and 0 or 0.35
	local p = aiWinProb(att, STUB, me)
	local unitEV = p * 28 - (1 - p) * va
	if att.type == "king" and not att.cap then
		unitEV -= (1 - p) * 400
	end
	return r * (bombEV * (1 - trapShare) + trapEV * trapShare) + (1 - r) * unitEV
		+ edgeGuard * ((att.type == "king") and 0 or 1) + pressure
end

-- 위치 평가 — V: 결정 시점 고정 가시 적 목록 (가상 이동 중 새로 인접해도 숨은 말은 절대 참조하지 않음)
local function aiEvalPos(en, me, V)
	local S = en.S
	local my = mine(en, me)
	local king = nil
	for _, x in my do
		if x.type == "king" then
			king = x
		end
	end
	local units = {}
	for _, e in V do
		if not (e.revealed and (e.type == "bomb" or e.type == "trap")) then
			table.insert(units, e)
		end
	end
	local v = 0
	for _, x in my do
		v += aiUnitValue(x, me)
	end
	for _, e in S.pieces do
		if e.owner ~= me and e.alive and e.placed then
			v -= e.revealed and aiUnitValue(e, me) or 28
		end
	end
	local goal = (me == 0) and 1 or ROWS
	local last = (me == 0) and ROWS or 1
	if king then
		local danger, near = 0, 0
		for _, e in units do
			local d = dist(e, king)
			if d == 1 then
				danger += 1
			elseif d == 2 then
				near += 1
			end
		end
		v -= danger * 48 + near * 10
		for _, b in my do
			if b.type == "bomb" and dist(b, king) == 1 then
				v += 6
			end
		end
		if inForestRow(king.r) then
			v += 3
		end
		local dg = math.abs(king.r - goal)
		if dg == 0 then
			v += 1000
		else
			v += (12 - dg) * ((danger == 0 and near == 0) and 4 or 1)
		end
		if zoneHas(1 - me, king.r) and danger > 0 then
			v -= 40
		end
	end
	local eking = nil
	for _, e in V do
		if e.type == "king" and e.revealed then
			eking = e
			break
		end
	end
	for _, e in units do -- 끝줄 저지
		local d = math.abs(e.r - last)
		if d <= 2 then
			v -= (3 - d) * 18
			if d <= 1 then
				v -= 30
				for _, x in my do
					if x.type ~= "bomb" and x.type ~= "trap" and dist(x, e) == 1 then
						v += 28
						break
					end
				end
			end
		end
	end
	for _, x in my do
		if x.type == "minion" then
			v += ((me == 1) and x.r or (ROWS + 1 - x.r)) * 1.2 + (4 - math.abs(x.c - 4)) * 0.5
			if eking then
				v += (10 - math.min(10, dist(x, eking))) * 3
			end
		end
		if x.type == "ally" and eking then
			v += (10 - math.min(10, dist(x, eking))) * 2
		end
		if en:canSearchPiece(x) then
			if findEvent(en, me, x) then
				v += 10
			end
			if isVip(x) and S.balls[me] > 0 and not x.cap and not S.reserve[me] then
				local tr = (me == 1) and { 4, 5 } or { 9, 10 }
				local df = math.min(math.abs(x.r - tr[1]), math.abs(x.r - tr[2]))
				v += (5 - math.min(5, df)) * ((x.type == "king") and 0.8 or 2)
			end
		end
		if x.type == "bomb" then
			for _, e in units do
				if e.type ~= "king" and dist(e, x) == 1 then
					v += 5
					break
				end
			end
			if x.revealed then
				v -= 6
			end
		end
		if x.type ~= "bomb" and x.type ~= "trap" and x.type ~= "king" then
			for _, e in units do
				if dist(x, e) == 1 then
					local p = aiWinProb(x, e.revealed and e or STUB, me)
					v += (p - 0.5) * 10
				end
			end
		end
	end
	v += S.balls[me] * 3 + (S.reserve[me] and 15 or 0) + #S.inv[me] * 2
	return v
end

-- 2-ply: 보이는 적의 최선 응수(내 말 공격 또는 1칸 이동) 후 내 평가의 최악값
local function aiWorstReply(en, me, V, deadline)
	local my = mine(en, me)
	local function occ(r, c)
		for _, x in my do
			if x.r == r and x.c == c then
				return true
			end
		end
		for _, e in V do
			if e.r == r and e.c == c then
				return true
			end
		end
		return false
	end
	local base = aiEvalPos(en, me, V)
	local worst, n = base, 0
	for _, e in V do
		if not (e.revealed and (e.type == "bomb" or e.type == "trap")) and e.immobile == 0 then
			for _, x in my do
				if dist(e, x) == 1 and x.type ~= "bomb" and x.type ~= "trap"
					and not (e.type == "king" and e.revealed and x.type == "king")
					and not (e.revealed and isVip(e) and isVip(x)) then
					local p = 1 - aiWinProb(e.revealed and e or STUB, x, me)
					local harm = (1 - p) * (aiUnitValue(x, me) + ((x.type == "king") and 400 or 0))
						- p * (e.revealed and aiUnitValue(e, me) or 28)
					worst = math.min(worst, base - harm)
					n += 1
				end
			end
			for _, d in DIRS do
				local r, c = e.r + d[1], e.c + d[2]
				if inBounds(r, c) and not occ(r, c) then
					local o_r, o_c = e.r, e.c
					e.r, e.c = r, c
					worst = math.min(worst, aiEvalPos(en, me, V))
					n += 1
					e.r, e.c = o_r, o_c
					if n >= AIC.strongReplyCap or nowMs() > deadline then
						return worst
					end
				end
			end
		end
	end
	return worst
end

local function aiMainStrong(en, me)
	local S = en.S
	local t0 = nowMs()
	local deadline = t0 + AIC.strongBudgetMs
	local V = aiVisible(en, me) -- 결정 시점 고정 가시 집합
	local my = mine(en, me)
	local st = aiState(en)
	st.hist[me] = st.hist[me] or {}
	local hist = st.hist[me]
	local cands = {}
	local function snapshot()
		local snap = {}
		for _, x in my do
			table.insert(snap, { x, x.r, x.c })
		end
		return snap
	end
	local function restore(snap)
		for _, s in snap do
			s[1].r, s[1].c = s[2], s[3]
		end
	end
	local function virt(fn)
		local snap = snapshot()
		fn()
		local s = aiEvalPos(en, me, V)
		restore(snap)
		return s
	end
	local function forcedGain(p, before)
		local best = nil
		for _, e in V do
			if dist(e, p) == 1 and not before[e.id] then
				local ev = aiBattleEV(en, me, p, e)
				if ev ~= nil and (best == nil or ev > best) then
					best = ev
				end
			end
		end
		return best or 0
	end
	local function attackOpp()
		local best = 0
		for _, x in my do
			if x.type ~= "bomb" then
				for _, e in V do
					if dist(e, x) == 1 then
						local ev = aiBattleEV(en, me, x, e)
						if ev ~= nil and ev > best then
							best = ev
						end
					end
				end
			end
		end
		return best * 0.8
	end
	local function adjIds(p)
		local set = {}
		for _, e in V do
			if dist(e, p) == 1 then
				set[e.id] = true
			end
		end
		return set
	end
	local enemyLeft = 0
	for _, e in S.pieces do
		if e.owner ~= me and e.alive and e.placed then
			enemyLeft += 1
		end
	end
	local hiddenLeft = enemyLeft - #V
	local function unseenForestAdj(r, c, mover)
		local n = 0
		for _, d in DIRS do
			local fr, fc = r + d[1], c + d[2]
			if inBounds(fr, fc) and inForestRow(fr) then
				local watched = false
				for _, x in my do
					if x ~= mover and distRC(x, fr, fc) <= 1 then
						watched = true
						break
					end
				end
				if not watched then
					n += 1
				end
			end
		end
		return n
	end
	-- 후보 1: 탐색
	for _, p in my do
		if en:canSearchPiece(p) then
			local ev = findEvent(en, me, p)
			if ev then
				table.insert(cands, { kind = "search", p = p, s1 = aiEvalPos(en, me, V) + 14 + attackOpp() })
			end
		end
	end
	-- 후보 1b: 회복 (난수 미소비)
	for _, p in my do
		if en:canHeal(p) and p.hp < p.maxHp * 0.6 then
			local near = false
			for _, e in V do
				if dist(e, p) == 1 then
					near = true
					break
				end
			end
			if not near then
				table.insert(cands, { kind = "heal", p = p, noTie = true,
					s1 = aiEvalPos(en, me, V) + (1 - p.hp / p.maxHp) * 24 + ((p.type == "king") and 8 or 0) + attackOpp() })
			end
		end
	end
	-- 후보 2: 이동 (폭탄 포함·함정 제외)
	for _, p in my do
		if p.immobile == 0 and p.type ~= "trap" then
			for _, rc in aiMoveOptions(en, p) do
				local r, c = rc[1], rc[2]
				local before = adjIds(p)
				local s1 = virt(function()
					p.r, p.c = r, c
				end)
				do
					local o_r, o_c = p.r, p.c
					p.r, p.c = r, c
					s1 += forcedGain(p, before) + attackOpp()
					p.r, p.c = o_r, o_c
				end
				for _, h in hist do
					if h.id == p.id and h.r == r and h.c == c then
						s1 -= 6
						break
					end
				end
				if p.type == "king" and r == ((me == 0) and 1 or ROWS) then
					s1 += 1000
				end
				if p.type == "king" and hiddenLeft > 0 then
					s1 -= unseenForestAdj(r, c, p) * 22
				end
				table.insert(cands, { kind = "move", p = p, r = r, c = c, s1 = s1 })
			end
		end
	end
	-- 후보 3: 텔레포트 스왑 (상한 12)
	if en:teleportAvailable(me) and S.teleUsed[me] < BAL.teleMax then
		local king = nil
		for _, x in my do
			if x.type == "king" and x.immobile == 0 then
				king = x
			end
		end
		local pairs_ = {}
		if king then
			for _, x in my do
				if x.id ~= king.id and x.immobile == 0 then
					table.insert(pairs_, { king, x })
				end
			end
		end
		for _, b in my do
			if b.type == "bomb" and b.immobile == 0 then
				for _, m in my do
					if m.type == "minion" and m.immobile == 0 and zoneHas(1 - me, m.r) then
						table.insert(pairs_, { b, m })
					end
				end
			end
		end
		for i = 1, math.min(12, #pairs_) do
			local a, b = pairs_[i][1], pairs_[i][2]
			local ba, bb = adjIds(a), adjIds(b)
			local s1 = virt(function()
				a.r, a.c, b.r, b.c = b.r, b.c, a.r, a.c
			end)
			do
				local ar, ac = a.r, a.c
				a.r, a.c, b.r, b.c = b.r, b.c, ar, ac
				s1 += forcedGain(a, ba) + forcedGain(b, bb) + attackOpp()
				b.r, b.c = a.r, a.c
				a.r, a.c = ar, ac
			end
			s1 -= 8
			table.insert(cands, { kind = "tele", a = a, b = b, s1 = s1 })
		end
	end
	-- 후보 4: 생략
	table.insert(cands, { kind = "skip", s1 = aiEvalPos(en, me, V) + attackOpp() - 2 })
	for _, c in cands do
		if not c.noTie then
			c.s1 += en:rand() * 0.5
		end
	end
	stableSortDesc(cands, function(x)
		return x.s1
	end)
	local top = {}
	for i = 1, math.min(AIC.strongTopK, #cands) do
		table.insert(top, cands[i])
	end
	for _, c in top do
		if nowMs() > deadline then
			c.s2 = c.s1
		else
			local snap = snapshot()
			if c.kind == "move" then
				c.p.r, c.p.c = c.r, c.c
			elseif c.kind == "tele" then
				c.a.r, c.a.c, c.b.r, c.b.c = c.b.r, c.b.c, c.a.r, c.a.c
			end
			local worst = aiWorstReply(en, me, V, deadline)
			restore(snap)
			c.s2 = 0.4 * c.s1 + 0.6 * (worst + (c.s1 - aiEvalPos(en, me, V)))
		end
	end
	stableSortDesc(top, function(x)
		return x.s2
	end)
	st.lastThinkMs = nowMs() - t0
	local list = {}
	for _, c in top do
		if c.kind == "search" then
			table.insert(list, { t = "search", id = c.p.id })
		elseif c.kind == "heal" then
			table.insert(list, { t = "heal", id = c.p.id })
		elseif c.kind == "move" then
			table.insert(list, { t = "move", id = c.p.id, r = c.r, c = c.c, __hist = true })
		elseif c.kind == "tele" then
			table.insert(list, { t = "tele", aId = c.a.id, bId = c.b.id })
		else
			table.insert(list, { t = "skipMain" })
			break -- JS: 생략 후보에 도달하면 그 자리에서 종료
		end
	end
	table.insert(list, { t = "skipMain" })
	return list, "주 행동"
end

local function aiEvalBattlesStrong(en, me)
	local best = nil
	for _, att in mine(en, me) do
		for _, def in en:adjEnemies(att) do
			if en:visibleTo(me, def) and en:canBattle(att, def) then
				local ev = aiBattleEV(en, me, att, def)
				if ev ~= nil and (not best or ev > best.score) then
					best = { att = att, def = def, score = ev }
				end
			end
		end
	end
	return (best and best.score > 2) and best or nil
end

--==================================================================
-- 전투 중 행동
--==================================================================

local STATUS_KEY = { fire = "burn", water = "weaken", lightning = "shock" }

local function usableSlots(f)
	local out = {}
	if f.skills then
		for i = 1, 4 do
			if f.cds[i] == 0 then
				table.insert(out, { i = i, sk = SKILLS[f.skills[i]] })
			end
		end
	end
	return out
end

local function battleCtx(en, side)
	local S = en.S
	local B = S.battle
	return {
		B = B,
		f = (side == "A") and B.fa or B.fd,
		opp = (side == "A") and B.fd or B.fa,
		ownerP = (side == "A") and B.attP.owner or B.defP.owner,
		myPc = (side == "A") and B.attP or B.defP,
		oppPc = (side == "A") and B.defP or B.attP,
		usedItems = (side == "A") and B.itemsA or B.itemsD,
		itemRound = (side == "A") and B.itemRoundA or B.itemRoundD,
		lastItem = (side == "A") and B.lastItemA or B.lastItemD,
		thrown = (side == "A") and B.ballThrowA or B.ballThrowD,
	}
end

local function hasStatus(f)
	return f.burn > 0 or f.weaken > 0 or f.shock > 0
end

-- 5급 전투 행동 (T6 프로파일·확률 혼합)
local function aiBattleAction(en, side)
	local S = en.S
	local x = battleCtx(en, side)
	local f, opp, ownerP = x.f, x.opp, x.ownerP
	local prof, caut = aiProf(en, ownerP), aiCaution(en, ownerP)
	-- 보너스 아이템 — 신중할수록 일찍 회복
	if not x.itemRound and x.usedItems < BAL.itemPerBattle then
		local inv = S.inv[ownerP]
		local use = nil
		if f.hp < f.maxHp * (0.25 + 0.15 * caut) and table.find(inv, "potion") and x.lastItem ~= "potion" then
			use = table.find(inv, "potion")
		elseif (f.burn > 0 or f.weaken > 0) and table.find(inv, "cure") and x.lastItem ~= "cure" then
			use = table.find(inv, "cure")
		end
		if use then
			return { t = "item", i = use }
		end
	end
	-- #12 적 하수인 포획: 게이트 충족 시 확률적 투척
	if x.oppPc.type == "minion" and opp.hp < opp.maxHp * 0.3 and S.balls[ownerP] > 0 and not S.reserve[ownerP] and not x.thrown
		and en:rand() < 0.4 + 0.4 * prof.capture then
		return { t = "ball" }
	end
	-- #13 도망: 동료·왕 본체 또는 열세 전투원
	if f.hp < f.maxHp * 0.5 then
		local vipBody = isVip(x.myPc) and f == x.myPc
		local losing = f.hp / f.maxHp < opp.hp / opp.maxHp - 0.15
		if (vipBody or losing) and en:rand() < (vipBody and 0.5 or 0.25) * caut then
			return { t = "flee" }
		end
	end
	if not f.skills then
		return { t = "act", k = "basic" }
	end
	local usable = usableSlots(f)
	if #usable == 0 then
		return { t = "act", k = "basic" }
	end
	local function multOf(el)
		local advM = el and opp.element and BEATS[el] == opp.element
		local disM = el and opp.element and BEATS[opp.element] == el
		return (advM and BAL.advMult or disM and BAL.disMult or 1) * ((f.weaken > 0) and (1 - BAL.weakenPct) or 1)
	end
	local lowHp = f.hp < f.maxHp * (0.3 + 0.15 * caut)
	local scored = {}
	for _, u in usable do
		local i, sk = u.i, u.sk
		local sc = 0
		local atkEl = Data.atkElOf(f, sk)
		local statusKey = atkEl and STATUS_KEY[atkEl] or nil
		if sk.pow then
			local est = Data.slotPow(f, sk) * multOf(atkEl) * ((f.focusCharge and sk.kind == "attack") and 1.2 or 1)
			sc = 6 + est / 4
			if est * (1 - BAL.dmgVar) >= opp.hp + opp.shield then
				sc = 100
			elseif sk.kind == "sig" then
				sc += 5
			end
			if sk.status and statusKey and opp[statusKey] == 0 then
				sc += 4
			end
			if sk.bonusVsShield and opp.shield > 0 then
				sc += 3
			end
			if sk.bonusVsStatus and hasStatus(opp) then
				sc += 3
			end
			if sk.selfVuln and lowHp then
				sc -= 6
			end
			sc *= prof.aggression
		else
			if sk.healPct then
				sc = lowHp and (20 + 10 * caut) or 2
			elseif sk.shieldPct then
				sc = (lowHp and 14 or 5) * ((f.shield > 0) and 0.3 or 1)
			elseif sk.dmgCut then
				sc = lowHp and 10 or 3
			elseif sk.focus then
				sc = (not f.focusCharge and not lowHp) and 7 or 1
			elseif sk.coolAny then
				local any = false
				for j = 1, 4 do
					if j ~= i and f.cds[j] >= 2 then
						any = true
					end
				end
				sc = any and 6 or 0.5
			elseif sk.cleanse then
				sc = hasStatus(f) and 9 or 0.5
			end
			if lowHp then
				sc *= caut
			end
		end
		table.insert(scored, { i = i, sc = sc + en:rand() * 3 })
	end
	stableSortDesc(scored, function(s)
		return s.sc
	end)
	local pick = scored[1]
	if #scored > 1 and en:rand() < 0.10 then
		pick = scored[2]
	end
	return { t = "act", k = pick.i }
end

-- 5단 전투 행동: 킬 가능·피해 경쟁 기반
local function aiBattleActionStrong(en, side)
	local S = en.S
	local x = battleCtx(en, side)
	local f, opp, ownerP = x.f, x.opp, x.ownerP
	local function multOf(el)
		local advM = el and opp.element and BEATS[el] == opp.element
		local disM = el and opp.element and BEATS[opp.element] == el
		return (advM and BAL.advMult or disM and BAL.disMult or 1) * ((f.weaken > 0) and (1 - BAL.weakenPct) or 1)
			* (f.atkBuff and (1 + BAL.nextBuffPct) or 1)
	end
	local oAdv = opp.element and f.element and BEATS[opp.element] == f.element
	local oDis = opp.element and f.element and BEATS[f.element] == opp.element
	local oppEst = (opp.atk or 16) * (opp.skills and 1.18 or 1) * (oAdv and BAL.advMult or oDis and BAL.disMult or 1)
		* ((opp.weaken > 0) and (1 - BAL.weakenPct) or 1) * ((f.dmgCut > 0) and (1 - f.dmgCut) or 1)
	local usable = usableSlots(f)
	local function dmgOf(sk)
		return (sk and Data.slotPow(f, sk) or f.atk) * multOf(Data.atkElOf(f, sk)) * ((f.focusCharge and sk and sk.kind == "attack") and 1.2 or 1)
	end
	local bestDmg = f.atk * multOf(f.element)
	for _, u in usable do
		if u.sk.pow and dmgOf(u.sk) > bestDmg then
			bestDmg = dmgOf(u.sk)
		end
	end
	local killNow = bestDmg * (1 - BAL.dmgVar) >= opp.hp + opp.shield
	local toKillMe = math.ceil(math.max(1, f.hp) / math.max(1, oppEst))
	local toKillOpp = math.ceil((opp.hp + opp.shield) / math.max(1, bestDmg))
	local losing = toKillMe < toKillOpp
	-- 아이템: 사망 위기면 회복약, 상태이상이면 해독제, 전 슬롯 쿨이면 쿨링수
	if not x.itemRound and x.usedItems < BAL.itemPerBattle then
		local inv = S.inv[ownerP]
		local use = nil
		if not killNow and f.hp <= oppEst * 1.25 and table.find(inv, "potion") and x.lastItem ~= "potion" then
			use = table.find(inv, "potion")
		elseif hasStatus(f) and table.find(inv, "cure") and x.lastItem ~= "cure" and toKillOpp > 1 then
			use = table.find(inv, "cure")
		elseif #usable == 0 and f.skills and table.find(inv, "cool") and x.lastItem ~= "cool" then
			use = table.find(inv, "cool")
		end
		if use then
			return { t = "item", i = use }
		end
	end
	-- 볼 투척
	if x.oppPc.type == "minion" and opp.hp < opp.maxHp * 0.3 and S.balls[ownerP] > 0 and not S.reserve[ownerP] and not x.thrown
		and (not killNow or f.hp > f.maxHp * 0.6) then
		return { t = "ball" }
	end
	-- 도망
	if f.hp < f.maxHp * 0.5 and not killNow then
		local vipBody = isVip(x.myPc) and f == x.myPc
		if (vipBody and (losing or toKillMe <= 1)) or (losing and toKillMe <= 2) then
			return { t = "flee" }
		end
	end
	if not f.skills or #usable == 0 then
		return { t = "act", k = "basic" }
	end
	local lowHp = f.hp <= oppEst * 1.5
	local scored = {}
	for _, u in usable do
		local i, sk = u.i, u.sk
		local sc = 0
		local atkEl = Data.atkElOf(f, sk)
		local statusKey = atkEl and STATUS_KEY[atkEl] or nil
		if sk.pow then
			local est = dmgOf(sk)
			sc = est / 3
			if est * (1 - BAL.dmgVar) >= opp.hp + opp.shield then
				sc = 100
			elseif est >= opp.hp + opp.shield then
				sc = 60
			end
			if sk.kind == "sig" then
				sc += 3
			end
			if sk.status and statusKey and opp[statusKey] == 0 then
				sc += 4
			end
			if sk.drainPct and lowHp then
				sc += 4
			end
			if sk.selfShieldPct and lowHp then
				sc += 3
			end
			if sk.bonusVsShield and opp.shield > 0 then
				sc += 2
			end
			if sk.bonusVsStatus and hasStatus(opp) then
				sc += 2
			end
			if sk.selfVuln and lowHp then
				sc -= 8
			end
		else
			if sk.healPct then
				sc = (lowHp and toKillOpp > 1) and 25 or 1
			elseif sk.shieldPct then
				sc = ((lowHp and toKillOpp > 1) and 16 or 4) * ((f.shield > 0) and 0.3 or 1)
			elseif sk.dmgCut then
				sc = (lowHp and toKillOpp > 1) and 12 or 2
			elseif sk.focus then
				sc = (not f.focusCharge and toKillOpp >= 2 and not lowHp) and 8 or 0.5
			elseif sk.coolAny then
				local any = false
				for j = 1, 4 do
					if j ~= i and f.cds[j] >= 2 then
						any = true
					end
				end
				sc = any and 5 or 0.3
			elseif sk.cleanse then
				sc = hasStatus(f) and 9 or 0.3
			end
		end
		table.insert(scored, { i = i, sc = sc + en:rand() * 0.3 })
	end
	stableSortDesc(scored, function(s)
		return s.sc
	end)
	return { t = "act", k = scored[1].i }
end

--==================================================================
-- 보류 선택 정책 (HTML 에서는 모달 대신 인라인으로 처리하던 부분)
--==================================================================

-- #92 AI 교체 정책 (v0.4.4 §2.7): 방어형·지속형은 효과기 제외, 위력 최저 슬롯과 비교 (난수 미소비)
local function aiRecruitSlot(p, alt)
	local a = Data.archOf(p)
	local keepEffect = (a == "def" or a == "sustain")
	local pick = nil
	for _, i in { 1, 2 } do
		local sk = SKILLS[p.skills[i]]
		if sk and sk.kind == "attack" and not (keepEffect and sk.tier == "effect") then
			if not pick or sk.pow < SKILLS[p.skills[pick]].pow then
				pick = i
			end
		end
	end
	if not pick then
		return nil
	end
	return (SKILLS[alt].pow >= SKILLS[p.skills[pick]].pow) and pick or nil
end
Ai.recruitSlot = aiRecruitSlot

local function aiCaptureMode(en, p)
	local S = en.S
	local b = S.balls[p.owner]
	local caut = aiCaution(en, p.owner)
	if b >= 2 then
		return "safe"
	elseif b == 1 and p.hp > p.maxHp * math.min(0.9, 0.5 * caut) then
		return "attack"
	end
	return nil
end

-- #114 도망 교환: 폭탄>함정>하수인>동료>왕 순, 동순위는 더 후방 (난수 미소비)
local FLEE_PRI = { bomb = 0, trap = 1, minion = 2, ally = 3, king = 4 }
local function aiFleePick(en, fp)
	local own = fp.owner
	local list = {}
	for _, id in fp.cands do
		local x = en:pieceById(id)
		if x then
			table.insert(list, x)
		end
	end
	stableSortAsc(list, function(x)
		return (FLEE_PRI[x.type] or 5) * 100 + ((own == 0) and -x.r or x.r)
	end)
	return list[1]
end

--==================================================================
-- 배치 (AI 휴리스틱 배치 — 클라이언트 배치 데이터 형식 {roster, pos} 로 반환. 행 11~13 = 자기 진영, 13 = 후열)
--==================================================================

local function rngShuffle(rng, a)
	for i = #a, 2, -1 do
		local j = math.floor(rng:next() * i) + 1
		a[i], a[j] = a[j], a[i]
	end
	return a
end

-- AI 로스터 선택: 4속성 각 1종 이상 + 나머지 2종 무작위 (아키타입 혼합 선호)
function Ai.pickRoster(rng)
	local roster = {}
	local archs = rngShuffle(rng, { "std", "atk", "def" })
	local els = rngShuffle(rng, table.clone(Data.ELEMS))
	for i, el in els do
		local pick = nil
		local first = nil
		for _, r in Data.ROSTER do
			if r.element == el then
				first = first or r
				if not pick and r.arch == archs[((i - 1) % 3) + 1] then
					pick = r
				end
			end
		end
		table.insert(roster, (pick or first).id)
	end
	local rest = {}
	for _, r in Data.ROSTER do
		if not table.find(roster, r.id) then
			table.insert(rest, r.id)
		end
	end
	rngShuffle(rng, rest)
	table.insert(roster, rest[1])
	table.insert(roster, rest[2])
	rngShuffle(rng, roster)
	return roster
end

-- 슬롯 순서 = 엔진 생성 순서 (하수인 6 · 폭탄 3 · 동료 2 · 함정 2 · 왕 1)
local SLOT_TYPES = { "minion", "minion", "minion", "minion", "minion", "minion", "bomb", "bomb", "bomb", "ally", "ally", "trap", "trap", "king" }

function Ai.autoSetup(rng)
	local roster = Ai.pickRoster(rng)
	local back, mid, front = 13, 12, 11
	local occ = {}
	local pos = {}
	local function free(r, c)
		return r >= 11 and r <= 13 and c >= 1 and c <= COLS and not occ[r .. "_" .. c]
	end
	local function put(i, r, c)
		pos[i] = { r, c }
		occ[r .. "_" .. c] = true
	end
	local function putRandom(i)
		local cells = {}
		for r = 11, 13 do
			for c = 1, COLS do
				if free(r, c) then
					table.insert(cells, { r, c })
				end
			end
		end
		rngShuffle(rng, cells)
		put(i, cells[1][1], cells[1][2])
	end
	local function slots(ty)
		local out = {}
		for i, t in SLOT_TYPES do
			if t == ty then
				table.insert(out, i)
			end
		end
		return out
	end
	-- 왕: 후열(80%) 또는 중열(20% 블러핑), 무작위 열
	local kingSlot = slots("king")[1]
	local kr = (rng:next() < 0.8) and back or mid
	local cols = rngShuffle(rng, { 1, 2, 3, 4, 5, 6, 7 })
	local kc = nil
	for _, c in cols do
		if free(kr, c) then
			kc = c
			break
		end
	end
	put(kingSlot, kr, kc)
	-- 폭탄: 1~2개 왕 인접 호위, 나머지 무작위
	local guard = 0
	for _, i in slots("bomb") do
		local placed = false
		if guard < 2 then
			local spots = rngShuffle(rng, { { kr + 1, kc }, { kr - 1, kc }, { kr, kc + 1 }, { kr, kc - 1 } })
			for _, s in spots do
				if free(s[1], s[2]) then
					put(i, s[1], s[2])
					guard += 1
					placed = true
					break
				end
			end
		end
		if not placed then
			putRandom(i)
		end
	end
	-- 함정: 전열 중앙(3~5열) 침투로
	for _, i in slots("trap") do
		local spots = rngShuffle(rng, { { front, 3 }, { front, 4 }, { front, 5 }, { mid, 3 }, { mid, 4 }, { mid, 5 } })
		local placed = false
		for _, s in spots do
			if free(s[1], s[2]) then
				put(i, s[1], s[2])
				placed = true
				break
			end
		end
		if not placed then
			putRandom(i)
		end
	end
	-- 동료: 측면(1·2·6·7열) 숲 접근
	for _, i in slots("ally") do
		local spots = rngShuffle(rng, { { front, 1 }, { front, 2 }, { front, 6 }, { front, 7 }, { mid, 1 }, { mid, 7 } })
		local placed = false
		for _, s in spots do
			if free(s[1], s[2]) then
				put(i, s[1], s[2])
				placed = true
				break
			end
		end
		if not placed then
			putRandom(i)
		end
	end
	-- 하수인: 전열 우선, 속성 분산 유지
	for _, i in slots("minion") do
		local spots = {}
		for _, c in rngShuffle(rng, { 1, 2, 3, 4, 5, 6, 7 }) do
			if free(front, c) then
				table.insert(spots, { front, c })
			end
		end
		for _, c in rngShuffle(rng, { 1, 2, 3, 4, 5, 6, 7 }) do
			if free(mid, c) then
				table.insert(spots, { mid, c })
			end
		end
		if #spots > 0 then
			put(i, spots[1][1], spots[1][2])
		else
			putRandom(i)
		end
	end
	return { roster = roster, pos = pos }
end

--==================================================================
-- 실행자 — 봇 차례에 한 행동을 수행한다. 반환: acted(boolean), desc(string)
--==================================================================

local function tryApply(en, me, a)
	local ok, err = en:apply(me, a)
	return ok, err
end

-- 5급/5단 공용 턴 진행 (HTML aiStep)
local function aiStep(en, me)
	local S = en.S
	local level = levelOf(en, me)
	if not S.mainUsed then
		local list, desc
		if level == "dan5" then
			list, desc = aiMainStrong(en, me)
		else
			list, desc = aiMain(en, me)
		end
		local st = aiState(en)
		for _, a in list do
			local ok = tryApply(en, me, a)
			if ok then
				if a.__hist then -- 5단 반복 완화 이력
					st.hist[me] = st.hist[me] or {}
					table.insert(st.hist[me], { id = a.id, r = a.r, c = a.c })
					if #st.hist[me] > 6 then
						table.remove(st.hist[me], 1)
					end
				end
				return true, "🤖 AI " .. desc
			end
		end
		-- 어떤 주 행동도 받아들여지지 않음 (엔진이 이미 주 행동을 소진했을 수 있다) → 아래 전투/종료 단계로
		if not S.mainUsed then
			if tryApply(en, me, { t = "skipMain" }) then
				return true, "🤖 AI 주 행동 생략"
			end
		end
	end
	if #S.forcedTargets == 0 then
		en:drainForcedQueue(false) -- #18 안전장치
	end
	if #S.forcedTargets > 0 then -- T1: 강제 전투 최우선 이행
		local att = S.movedPiece
		local def = nil
		for _, e in en:alivePieces() do
			if en:forcedPickOk(e) then
				def = e
				break
			end
		end
		if att and def then
			local ok = tryApply(en, me, { t = "battle", attId = att.id, defId = def.id })
			if ok then
				return true, "🤖 AI 강제 전투"
			end
		end
		S.forcedTargets = {} -- 이행 불가 조합 방어 (크래시 방지)
		if #S.forcedQueue > 0 then
			return true, "🤖 AI 강제 전투 대기"
		end
	end
	local pick = (level == "dan5") and aiEvalBattlesStrong(en, me) or aiEvalBattles(en, me)
	if pick then
		local ok = tryApply(en, me, { t = "battle", attId = pick.att.id, defId = pick.def.id })
		if ok then
			return true, "🤖 AI 전투 개시"
		end
	end
	if tryApply(en, me, { t = "endTurn" }) then
		return true, "🤖 AI 턴 종료"
	end
	if not S.mainUsed and tryApply(en, me, { t = "skipMain" }) then
		return true, "🤖 AI 주 행동 생략"
	end
	return false, "AI 진행 불가"
end

-- 봇이 지금 행동해야 하는가
function Ai.needsAct(en, me)
	local S = en.S
	if S.phase ~= "play" then
		return false
	end
	if S.pending then
		return S.pending.owner == me
	end
	if S.fleePick then
		return S.fleePick.owner == me
	end
	if S.battle then
		local side = en:actorOfPhase()
		local ownerP = (side == "A") and S.battle.attP.owner or S.battle.defP.owner
		return ownerP == me
	end
	return S.current == me
end

function Ai.act(en, me)
	local S = en.S
	if not Ai.needsAct(en, me) then
		return false, "차례 아님"
	end
	if S.pending then
		local pd = S.pending
		if pd.kind == "vip" then -- AI: 보유 시 항상 대리 (엔진은 cap·예비가 있을 때만 묻는다)
			local ok = tryApply(en, me, { t = "vipPick", use = "cap" })
			if not ok then
				ok = tryApply(en, me, { t = "vipPick", use = "body" })
			end
			return ok, "🤖 AI 출전 선택"
		elseif pd.kind == "capture" then
			local p = en:pieceById(pd.pieceId)
			local mode = p and aiCaptureMode(en, p) or nil
			if mode then
				local ok = tryApply(en, me, { t = "capTry", mode = mode })
				if ok then
					return true, "🤖 AI 포획 시도"
				end
			end
			return tryApply(en, me, { t = "capSkip" }), "🤖 AI 포획 포기"
		elseif pd.kind == "recruit" then
			local p = en:pieceById(pd.pieceId)
			local slot = (p and p.skills) and aiRecruitSlot(p, pd.alt) or nil
			if slot then
				local ok = tryApply(en, me, { t = "recruitSwap", slot = slot })
				if ok then
					return true, "🤖 AI 기술 교체"
				end
			end
			return tryApply(en, me, { t = "recruitKeep" }), "🤖 AI 기술 유지"
		end
		return false, "알 수 없는 대기 상태"
	end
	if S.fleePick then
		local t = aiFleePick(en, S.fleePick)
		if t then
			local ok = tryApply(en, me, { t = "fleeSwap", id = t.id })
			if ok then
				return true, "🤖 AI 도망 교환"
			end
		end
		return tryApply(en, me, { t = "fleeSkip" }), "🤖 AI 도망 교환 생략"
	end
	if S.battle then
		local side = en:actorOfPhase()
		local a = (levelOf(en, me) == "dan5") and aiBattleActionStrong(en, side) or aiBattleAction(en, side)
		local ok = tryApply(en, me, a)
		if ok then
			return true, "🤖 AI 전투 행동"
		end
		-- 폴백: 준비된 첫 슬롯 → 기본 공격
		local f = (side == "A") and S.battle.fa or S.battle.fd
		for _, u in usableSlots(f) do
			if tryApply(en, me, { t = "act", k = u.i }) then
				return true, "🤖 AI 전투 행동"
			end
		end
		return tryApply(en, me, { t = "act", k = "basic" }), "🤖 AI 기본 공격"
	end
	return aiStep(en, me)
end

-- 헤드리스: 봇 차례가 끝날 때까지 반복 (테스트·시뮬레이션용). 반환: 수행 횟수, 실패 사유
function Ai.drive(en, me, maxSteps)
	local n = 0
	while Ai.needsAct(en, me) and n < (maxSteps or 200) do
		local ok, why = Ai.act(en, me)
		if not ok then
			return n, why
		end
		n += 1
	end
	return n, nil
end

return Ai
