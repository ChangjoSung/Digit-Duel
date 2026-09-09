--!nonstrict
-- Views.luau — 뷰어별 상태 직렬화 (정보 은닉)
-- HTML renderBoard/renderSide/battleModal 의 가시성 가드를 데이터 계층으로 옮겼다:
--  * 미공개 상대 말: id·좌표·소유자만 (정체·HP·상태 비노출) — visibleTo false 면 아예 제외
--  * 종료(over) 시 전체 공개 (HTML #11 종료 리빌)
--  * 상대 인벤토리는 개수만, 상대 예비 하수인·전투 미공개 기술은 종류만
--  * 강제 대상·도망 교환 후보·pending 상세는 소유자에게만

local function req(mod)
	if script then
		return require(script.Parent:WaitForChild(mod))
	end
	return require("./" .. mod)
end

local Data = req("Data")
local Config = req("Config")

local Views = {}

local function serializeFighter(pf, piece, viewer, over)
	local skills = nil
	if pf.skills then
		skills = {}
		for i = 1, 4 do
			local sk = Data.SKILLS[pf.skills[i]]
			local known = over or piece.owner == viewer or (pf.revealedSkills and table.find(pf.revealedSkills, i) ~= nil)
			skills[i] = known and { id = pf.skills[i], cd = pf.cds[i] } or { kind = sk.kind }
		end
	end
	return {
		isCap = pf ~= piece,
		pieceType = piece.type,
		name = (pf == piece) and piece.name or nil,
		element = pf.element,
		artRosterId = (pf ~= piece) and pf.artRosterId or piece.rosterId,
		hp = pf.hp,
		maxHp = pf.maxHp,
		shield = pf.shield,
		burn = pf.burn,
		weaken = pf.weaken,
		shock = pf.shock,
		dmgCut = pf.dmgCut,
		focusCharge = pf.focusCharge,
		vulnMark = pf.vulnMark,
		atkBuff = pf.atkBuff,
		atk = pf.atk,
		skills = skills,
		owner = piece.owner,
	}
end

function Views.forViewer(engine, viewer)
	local S = engine.S
	local over = S.phase == "over"
	local opp = 1 - viewer

	local board = {}
	for _, p in engine:alivePieces() do
		if over or engine:visibleTo(viewer, p) then
			local known = over or p.owner == viewer or p.revealed
			local entry = { id = p.id, r = p.r, c = p.c, owner = p.owner, known = known }
			if known then
				entry.type = p.type
				entry.element = p.element
				entry.name = p.name
				entry.rosterId = p.rosterId
				if p.type == "minion" or p.type == "ally" or p.type == "king" then
					entry.hp = p.hp
					entry.maxHp = p.maxHp
				end
				entry.immobile = p.immobile
				entry.revealed = p.revealed
				if p.healing and (over or p.owner == viewer or p.revealed) then
					entry.healing = true
				end
				if p.owner == viewer then -- 자기 말 상세 (skills·cap·버프)
					entry.skills = p.skills
					entry.cds = p.cds
					entry.nextBattleBuff = p.nextBattleBuff or nil
					if p.cap then
						entry.cap = { element = p.cap.element, hp = p.cap.hp, maxHp = p.cap.maxHp }
					end
				end
			end
			table.insert(board, entry)
		end
	end
	-- 정보 은닉: 배열 순서가 생성 순서(종류별 고정)를 따르면 미공개 말의 종류가 순서로 새어 나간다 → 이미 보이는 정보(위치)로만 정렬
	table.sort(board, function(a, b)
		if a.r ~= b.r then
			return a.r < b.r
		end
		return a.c < b.c
	end)

	-- 내 흔적 (탐색 가능 표시) — 이벤트가 아직 살아 있는 칸만
	local traces = {}
	for key in S.traces[viewer] do
		for _, ev in S.events do
			if (ev.r .. "_" .. ev.c) == key and not ev.consumed then
				table.insert(traces, { r = ev.r, c = ev.c })
			end
		end
	end

	local view = {
		phase = S.phase,
		me = viewer,
		current = S.current,
		turnCount = S.turnCount,
		burning = engine:isBurning(),
		winner = S.winner,
		winType = S.metrics.winType,
		mainUsed = S.mainUsed,
		battlesUsed = S.battlesUsed,
		balls = S.balls[viewer],
		oppBalls = S.balls[opp],
		inv = table.clone(S.inv[viewer]),
		oppInvCount = #S.inv[opp],
		reserve = S.reserve[viewer] and {
			element = S.reserve[viewer].element,
			hp = S.reserve[viewer].hp,
			maxHp = S.reserve[viewer].maxHp,
		} or nil,
		board = board,
		traces = traces,
	}

	if S.phase == "play" and viewer == S.current and #S.forcedTargets > 0 then
		view.forcedTargets = table.clone(S.forcedTargets)
		view.movedPieceId = S.movedPiece and S.movedPiece.id or nil
	end

	-- 내 턴의 합법 수 (표시용) — 자기 말에 대해서만. 미공개 적 칸으로의 이동은 규칙상 허용이므로 목록에 있어도 정체는 새지 않는다
	if S.phase == "play" and viewer == S.current and not S.battle and not S.pending and not S.fleePick then
		local legal = {}
		for _, p in engine:alivePieces() do
			if p.owner == viewer then
				legal[tostring(p.id)] = {
					moves = engine:legalMoves(p),
					attacks = engine:legalAttacks(p),
					heal = engine:canHeal(p),
					search = engine:canSearchAt(p),
				}
			end
		end
		view.legal = legal
		view.teleAvailable = not S.mainUsed and #S.forcedTargets == 0 and engine:teleportAvailable(viewer) and S.teleUsed[viewer] < Config.BAL.teleMax
	end

	if S.fleePick then
		if S.fleePick.owner == viewer then
			view.fleePick = { pieceId = S.fleePick.pieceId, cands = table.clone(S.fleePick.cands) }
		else
			view.fleeWait = true -- "상대가 말을 교체 중입니다"
		end
	end

	if S.pending then
		local pd = S.pending
		if pd.owner == viewer then
			if pd.kind == "vip" then
				local piece = engine:pieceById((pd.stage == "A") and pd.attId or pd.defId)
				local res = (not piece.cap) and S.reserve[viewer] or nil
				view.pending = {
					kind = "vip",
					pieceType = piece.type,
					cap = piece.cap and { element = piece.cap.element, hp = piece.cap.hp, maxHp = piece.cap.maxHp } or nil,
					reserve = res and { element = res.element, hp = res.hp, maxHp = res.maxHp } or nil,
				}
			elseif pd.kind == "capture" then
				view.pending = { kind = "capture", balls = S.balls[viewer] }
			elseif pd.kind == "recruit" then
				local piece = engine:pieceById(pd.pieceId)
				view.pending = {
					kind = "recruit",
					alt = pd.alt,
					slots = piece and piece.skills and { piece.skills[1], piece.skills[2] } or nil,
					cds = piece and piece.cds and { piece.cds[1], piece.cds[2] } or nil,
				}
			end
		else
			view.pendingWait = true -- "🔒 상대 선택 대기 중…"
		end
	end

	if S.battle then
		local B = S.battle
		local side = engine:actorOfPhase()
		local actorOwner = (side == "A") and B.attP.owner or B.defP.owner
		view.battle = {
			round = B.round,
			maxRounds = Config.BAL.maxRounds,
			phase = B.phase,
			actorSide = side,
			actorOwner = actorOwner,
			mySide = (B.attP.owner == viewer) and "A" or "D",
			A = serializeFighter(B.fa, B.attP, viewer, over),
			D = serializeFighter(B.fd, B.defP, viewer, over),
			myItems = table.clone(S.inv[viewer]),
			itemsUsed = (B.attP.owner == viewer) and B.itemsA or B.itemsD,
			blog = table.clone(B.blog),
		}
	end

	return view
end

return Views
