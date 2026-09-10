--!nonstrict
-- init.server.luau — Digit Dual Roblox 서버 (Phase 2a: 3D 로비 + 테이블 매칭)
-- 매칭 규칙 (CJ 2026-09-09): 로비를 걸어 다니다 테이블 의자에 앉으면 그 테이블의 A/B 자리 배정.
--   같은 테이블에 둘이 앉으면 배치 단계 → 둘 다 [배치 완료] → 그 둘만의 대전 세션 시작.
--   대전 중 자리를 떠나면(일어남·퇴장) 기권 처리. 종료 후 앉은 채로 다시 배치하면 재대전.
-- 클라이언트는 액션만 보내고, 서버가 엔진을 굴려 뷰어별로 필터링된 상태를 돌려준다 (Phase 1 구조 유지).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Engine = require(Shared.Engine)
local Views = require(Shared.Views)
local Ai = require(Shared.Ai)
local Rng = require(Shared.Rng)
local Config = require(Shared.Config)
local AIC = Config.AI
local Lobby = require(script:WaitForChild("Lobby"))
local Stats = require(script:WaitForChild("Stats")) -- Phase 4 전적 (DataStore · 실패 시 메모리)

local VERSION = "0.5.0-p4.5"

-- Remotes 생성
local remotes = Instance.new("Folder")
remotes.Name = "DDRemotes"
local reAction = Instance.new("RemoteEvent") -- 클라 → 서버: {t=...}
reAction.Name = "Action"
reAction.Parent = remotes
local reState = Instance.new("RemoteEvent") -- 서버 → 클라: state | table | left | hello | reject
reState.Name = "State"
reState.Parent = remotes
remotes.Parent = ReplicatedStorage

Lobby.build()

local seedRandom = Random.new()
local sessions = {} -- [player] = session
local seatOf = {} -- [player] = { id, side }
-- setupOpen: 둘 다 앉은 뒤 한 명이 [게임 시작] 을 누르면 true → 양측 배치 단계(카메라 판 고정·로스터/배치 UI). 자리 이탈·대전 종료 시 false
local tableState = {} -- [id] = { players = {A=?,B=?}, ready = {A=setup?,B=setup?}, session = nil, setupOpen = false }
for i = 1, Lobby.tableCount() do
	tableState[i] = { players = {}, ready = {}, session = nil, setupOpen = false }
end
local nextRoomId = 1

--==================================================================
-- 재접속 (Phase 4): 대전 중 나가면 바로 기권시키지 않고 일정 시간 자리를 잡아 둔다.
-- 같은 UserId 로 다시 들어오면 그 자리·세션을 그대로 이어받고, 유예가 지나면 그때 기권 처리한다.
-- 서버 인스턴스 안에서만 유지된다 (서버가 내려가면 사라진다 — DataStore 로 보존하지 않는다).
--==================================================================
local RECONNECT_GRACE = 90 -- 초
local pending = {} -- [userId] = { session, owner, tableId, side, deadline, name, userId, gen }
local pendingGen = 0 -- 보류 세대: 재접속 → 재이탈 시 예전 타이머가 새 유예를 끝내지 못하게 한다
local function pendingKey(player)
	return player.UserId
end

--==================================================================
-- 봇 (PVE — 구조.txt "1인 대전"): 혼자 앉은 사람이 [B] 를 누르면 맞은편에 AI 가 앉는다. 봇은 로스터·배치를 자동으로 마친다
--==================================================================
local BOT_NAME = { grade5 = "🤖 AI 5급", dan5 = "🤖 AI 5단" }
local function newBot(level)
	level = (level == "dan5") and "dan5" or "grade5"
	return { isBot = true, level = level, Name = "Bot-" .. level, DisplayName = BOT_NAME[level], Parent = nil }
end
local function isBot(p)
	return type(p) == "table" and p.isBot == true
end
-- 참가자 신원은 연결 상태와 무관하게 고정한다 (끊겨도 UserId 로 결과를 남긴다)
local function identityOf(p)
	if isBot(p) then
		return { isBot = true, name = p.DisplayName or p.Name }
	end
	return { userId = p.UserId, name = p.DisplayName or p.Name }
end
local function botOf(ts)
	for side, plr in ts.players do
		if isBot(plr) then
			return plr, side
		end
	end
	return nil, nil
end
local function botReady(ts) -- 봇 자동 로스터·배치 (사람이 [배치 완료] 를 누르면 바로 시작)
	local bot, side = botOf(ts)
	if bot then
		ts.ready[side] = Ai.autoSetup(Rng.new(seedRandom:NextInteger(1, 2 ^ 31 - 1)))
	end
end
local function removeBot(ts, id)
	local bot, side = botOf(ts)
	if bot then
		ts.players[side] = nil
		ts.ready[side] = nil
		Lobby.setBotSeat(id, side, nil)
	end
end
-- 배치·대전 중에는 앉은 사람이 점프로 일어나지 못한다 (구조.txt: 창이 떠 있는 동안 이동 불가 — [나가기] 로만 닫는다)
local function lockTable(ts, on)
	for _, plr in ts.players do
		if not isBot(plr) then
			Lobby.lockSeated(plr, on)
		end
	end
end

-- 자리 슬롯 정리: 이미 나가 버린(Parent 가 없는) 참가자만 지운다 — 돌아와 앉은 사람은 건드리지 않는다
local function clearStaleSeat(tableId, side)
	local ts = tableId and tableState[tableId] or nil
	if not (ts and side) then
		return
	end
	local held = ts.players[side]
	if held ~= nil and not isBot(held) and held.Parent == nil then
		ts.players[side] = nil
	end
	if ts.players[side] == nil then
		ts.ready[side] = nil
	end
end

--==================================================================
-- 테이블 상태 알림
--==================================================================

local function updateStatus(id)
	local ts = tableState[id]
	local n = (ts.players.A and 1 or 0) + (ts.players.B and 1 or 0)
	local text
	local botTag = botOf(ts) and "🤖 AI 대전 · " or ""
	if ts.session then
		text = ("테이블 %d · %s⚔️ 대전 중"):format(id, botTag)
	elseif n == 2 and ts.setupOpen then
		text = ("테이블 %d · %s배치 중 (%d/2 완료)"):format(id, botTag, (ts.ready.A and 1 or 0) + (ts.ready.B and 1 or 0))
	elseif n == 2 then
		text = ("테이블 %d · 둘 다 착석 — [게임 시작] 대기"):format(id)
	elseif n == 1 then
		text = ("테이블 %d · 상대 기다리는 중 — 맞은편에 앉으세요"):format(id)
	else
		text = ("테이블 %d · 빈 자리 2"):format(id)
	end
	Lobby.setStatus(id, text)
	Lobby.setStartPrompt(id, n == 2 and not ts.setupOpen and not ts.session) -- [F] 게임 시작 프롬프트는 둘 다 앉았을 때만
end

local function notifyTable(id)
	local ts = tableState[id]
	for side, plr in ts.players do
		if plr.Parent then
			local opp = ts.players[side == "A" and "B" or "A"]
			reState:FireClient(plr, {
				t = "table",
				tableId = id,
				side = side,
				opp = opp and opp.DisplayName or nil,
				myReady = ts.ready[side] ~= nil,
				oppReady = opp ~= nil and ts.ready[side == "A" and "B" or "A"] ~= nil,
				inGame = ts.session ~= nil,
				setupOpen = ts.setupOpen == true,
				oppBot = (opp ~= nil and isBot(opp)) or false,
				botLevel = (opp ~= nil and isBot(opp)) and opp.level or nil,
			})
		end
	end
end

-- [▶ 게임 시작] — HUD 버튼·[F] 프롬프트·Enter 공용. 둘 다 앉은 테이블의 착석자만
local function tryStartSetup(player)
	local at = seatOf[player]
	if not at then
		reState:FireClient(player, { t = "reject", reason = "먼저 테이블 의자에 앉으세요 (의자 앞에서 E)" })
		return
	end
	local ts = tableState[at.id]
	if ts.session or ts.setupOpen then
		return
	end
	if not (ts.players.A and ts.players.B) then
		reState:FireClient(player, { t = "reject", reason = "맞은편에 상대가 앉아야 시작할 수 있습니다" })
		return
	end
	ts.setupOpen = true
	ts.ready = {}
	botReady(ts)
	lockTable(ts, true)
	notifyTable(at.id)
	updateStatus(at.id)
end

Lobby.onStartPrompt(function(player, id)
	local at = seatOf[player]
	if at and at.id == id then
		tryStartSetup(player)
	else
		reState:FireClient(player, { t = "reject", reason = "이 테이블에 앉은 사람만 시작할 수 있습니다" })
	end
end)

--==================================================================
-- 세션
--==================================================================

local function broadcast(session)
	local events = session.engine:drainOutbox()
	for owner = 0, 1 do
		local plr = session.players[owner]
		if plr and plr.Parent then
			local myEvents = {}
			for _, ev in events do
				if ev.vis == nil or ev.vis == owner then
					table.insert(myEvents, ev)
				end
			end
			reState:FireClient(plr, {
				t = "state",
				room = session.room,
				view = Views.forViewer(session.engine, owner),
				events = myEvents,
			})
		end
	end
end

local function endSession(session)
	session.ended = true
	if not session.recorded and session.engine.S.phase == "over" then -- 전적은 세션당 1회만
		session.recorded = true
		local w = session.engine.S.winner
		for owner = 0, 1 do
			-- session.players 는 연결이 끊기면 nil 이 된다 → 시작 시 고정한 참가자 신원으로 기록한다 (봇 제외 정책 유지)
			local who = session.participants and session.participants[owner]
			if who and who.userId then
				local res = (w == -1) and "draw" or (w == owner) and "win" or "loss"
				task.spawn(function() -- DataStore 대기가 세션 종료 흐름을 막지 않게 한다
					local rec = Stats.recordId(who.userId, res, who.name)
					local plr = Players:GetPlayerByUserId(who.userId)
					if plr and plr.Parent then
						reState:FireClient(plr, { t = "stats", rec = rec, line = Stats.line(rec) })
					end
				end)
			end
		end
	end
	for uid, p in pending do -- 이 세션을 기다리던 재접속 보류는 함께 정리한다 (자리 잠금도 해제)
		if p.session == session then
			pending[uid] = nil
			clearStaleSeat(p.tableId, p.side) -- 돌아오지 못한 참가자의 자리 슬롯도 비운다
			Lobby.setSeatHold(p.tableId, p.side, false)
		end
	end
	for owner = 0, 1 do
		local plr = session.players[owner]
		if plr then
			sessions[plr] = nil
			Lobby.lockSeated(plr, false)
		end
	end
	local ts = tableState[session.tableId]
	if ts and ts.session == session then
		ts.session = nil
		ts.ready = {}
		ts.setupOpen = false -- 재대전은 다시 [게임 시작]
		notifyTable(session.tableId)
		updateStatus(session.tableId)
	end
	print(("[DD] room %d 종료 — 승자: %s"):format(session.room, tostring(session.engine.S.winner)))
end

-- 봇 턴 진행: 사람 행동·세션 시작 직후 호출. 봇 차례면 AI 딜레이 뒤 한 행동씩 수행하고 브로드캐스트 (사람이 따라볼 수 있게)
local function botOwnerOf(session)
	for owner = 0, 1 do
		if isBot(session.players[owner]) then
			return owner
		end
	end
	return nil
end
local function scheduleBot(session)
	local owner = botOwnerOf(session)
	if not owner then
		return
	end
	local en = session.engine
	if session.ended or session.botPending or en.S.phase ~= "play" or not Ai.needsAct(en, owner) then
		return
	end
	session.botPending = true
	task.delay(en.S.battle and AIC.battleDelay or AIC.delay, function()
		session.botPending = false
		if session.ended or en.S.phase ~= "play" or not Ai.needsAct(en, owner) then
			return
		end
		local ok, why = Ai.act(en, owner)
		if not ok then -- 방어: AI 가 진행 못 하면 턴 종료 → 그것도 안 되면 봇 기권 (게임이 멈추지 않게)
			warn(("[DD] 봇 행동 실패 (room %d): %s"):format(session.room, tostring(why)))
			if not en:apply(owner, { t = "endTurn" }) then
				en:gameOver(1 - owner, "resign")
				en:log("🏳️ AI 가 진행할 수 없어 기권합니다.", "imp")
			end
		end
		broadcast(session)
		if en.S.phase == "over" then
			endSession(session)
		else
			scheduleBot(session)
		end
	end)
end

local function startSession(tableId, pA, sA, pB, sB)
	local seed = seedRandom:NextInteger(0, 2 ^ 31 - 1)
	local engine = Engine.new(seed)
	engine:applySetup(0, sA)
	engine:applySetup(1, sB)
	for owner, plr in { [0] = pA, [1] = pB } do
		if isBot(plr) then
			Ai.setLevel(engine, owner, plr.level)
		end
	end
	engine:begin()
	local session = {
		room = nextRoomId, tableId = tableId, engine = engine, players = { [0] = pA, [1] = pB },
		participants = { [0] = identityOf(pA), [1] = identityOf(pB) }, -- 연결과 무관한 고정 신원 (전적 기록용)
	}
	nextRoomId += 1
	sessions[pA] = session
	sessions[pB] = session
	tableState[tableId].session = session
	Lobby.lockSeated(pA, true)
	Lobby.lockSeated(pB, true)
	print(("[DD] room %d 시작 (테이블 %d): %s vs %s (seed %d)"):format(session.room, tableId, pA.Name, pB.Name, seed))
	notifyTable(tableId)
	updateStatus(tableId)
	broadcast(session)
	scheduleBot(session)
end

-- 대전 중 이탈(일어남·퇴장·자리 떠나기) = 기권. resigned=true 면 상대에게 "기권", false 면 "연결 끊김"
-- hold=true 면 기권시키지 않고 재접속 유예를 건다 (연결 끊김). 자리 떠나기·기권은 hold=false
local function leaveSession(player, resigned, hold, at)
	local session = sessions[player]
	if not session then
		return
	end
	local owner = (session.players[0] == player) and 0 or 1
	local opp = session.players[1 - owner]
	if hold and session.engine.S.phase ~= "over" then
		-- 자리·세션을 그대로 두고 유예만 건다. 상대에게는 "재접속 대기 중" 을 알린다
		sessions[player] = nil
		pendingGen += 1
		local key = pendingKey(player)
		local entry = { -- 이 이탈 한 번을 가리키는 고유 객체 (아래 타이머가 그대로 붙잡는다)
			session = session, owner = owner, tableId = session.tableId,
			side = at and at.side or ((owner == 0) and "A" or "B"),
			deadline = os.clock() + RECONNECT_GRACE, name = player.DisplayName,
			userId = player.UserId, gen = pendingGen,
		}
		pending[key] = entry
		session.players[owner] = nil -- 자리는 비우되 세션은 살려 둔다
		session.waiting = session.waiting or {} -- 양쪽이 동시에 끊길 수 있어 자리별로 기록한다
		session.waiting[owner] = true
		session.engine:log(("🔌 상대의 연결이 끊어졌습니다 — %d초 안에 돌아오면 이어서 진행합니다."):format(RECONNECT_GRACE), "imp")
		if opp and opp.Parent then
			reState:FireClient(opp, {
				t = "state", room = session.room,
				view = Views.forViewer(session.engine, 1 - owner),
				events = session.engine:drainOutbox(),
				oppWaiting = RECONNECT_GRACE,
			})
		end
		task.delay(RECONNECT_GRACE + 1, function() -- 유예 만료 → 그때 기권 처리
			local p = pending[key]
			if p ~= entry or p.gen ~= entry.gen then -- 이미 돌아왔거나 새 이탈로 교체됨 → 예전 타이머는 새 유예를 끊지 않는다
				return
			end
			if os.clock() < entry.deadline then -- 유예가 아직 남아 있으면 끝내지 않는다
				return
			end
			pending[key] = nil
			Lobby.setSeatHold(p.tableId, p.side, false)
			clearStaleSeat(p.tableId, p.side)
			if session.ended or session.engine.S.phase == "over" then
				return
			end
			session.engine:gameOver(1 - owner, "resign")
			session.engine:log("🔌 재접속 시간이 지났습니다 — P" .. (2 - owner) .. " 승리!", "imp")
			local o = session.players[1 - owner]
			if o and o.Parent then
				reState:FireClient(o, {
					t = "state", room = session.room,
					view = Views.forViewer(session.engine, 1 - owner),
					events = session.engine:drainOutbox(),
					opponentLeft = true,
				})
			end
			endSession(session)
		end)
		return
	end
	if session.engine.S.phase ~= "over" then
		session.engine:gameOver(1 - owner, "resign")
		session.engine:log(resigned and ("🏳️ 상대가 자리를 떠났습니다 — P" .. (2 - owner) .. " 승리!") or ("🔌 상대의 연결이 끊어졌습니다 — P" .. (2 - owner) .. " 승리!"), "imp")
	end
	if opp and opp.Parent then
		reState:FireClient(opp, {
			t = "state",
			room = session.room,
			view = Views.forViewer(session.engine, 1 - owner),
			events = session.engine:drainOutbox(),
			opponentLeft = not resigned,
		})
	end
	endSession(session)
end

local function tryStart(id)
	local ts = tableState[id]
	if ts.session or not ts.players.A or not ts.players.B or not ts.ready.A or not ts.ready.B then
		return
	end
	startSession(id, ts.players.A, ts.ready.A, ts.players.B, ts.ready.B)
end

--==================================================================
-- 자리 배정
--==================================================================

-- 같은 UserId 가 다시 들어오면 자리·세션을 그대로 이어받는다
local tryReconnect -- 전방 선언: 아래 재착석 재시도 헬퍼와 서로 참조한다

-- 원래 마감 시각이 이미 지났는가. 필드가 없거나 다른 시계면 판정을 원래 만료 타이머에 맡긴다
local function pendingLate(p)
	local deadline = p.deadline or p.expiresAt
	return type(deadline) == "number" and os.clock() >= deadline
end

-- 세션은 살아 있는데 물리적 착석만 실패한 경우: 같은 pending/마감 안에서만 짧게 재시도한다 (유예 연장 없음)
local function scheduleResit(player, p)
	p.resitTries = (p.resitTries or 0) + 1
	if p.resitTries == 1 then
		warn(("[DD] 재접속 재착석 실패 (테이블 %d %s) — 원래 마감까지 재시도합니다"):format(p.tableId, p.side))
	end
	if p.resitPending then -- 중복 예약은 무해하게 무시한다 (pending 하나당 타이머 하나)
		return
	end
	p.resitPending = true
	task.delay(1, function()
		p.resitPending = false
		if pending[pendingKey(player)] ~= p or player.Parent == nil then
			return -- 이미 소비/만료됐거나 접속이 끊겼다. 원래 만료 타이머가 권위를 갖는다
		end
		tryReconnect(player)
	end)
end

function tryReconnect(player)
	local key = pendingKey(player)
	local p = pending[key]
	if not p then
		return false
	end
	local session, owner = p.session, p.owner
	local ts = tableState[p.tableId]
	if session.ended or session.engine.S.phase == "over" or not ts or ts.session ~= session then
		pending[key] = nil
		Lobby.setSeatHold(p.tableId, p.side, false) -- 이어받을 세션이 없으면 예약을 풀어 자리를 연다 (잠긴 채 남지 않게)
		clearStaleSeat(p.tableId, p.side)
		if ts then -- 테이블 상태가 없으면 알림/상태 갱신은 건너뛴다 (nil 참조 방지)
			notifyTable(p.tableId)
			updateStatus(p.tableId)
		end
		return false
	end
	if pendingLate(p) then
		return false -- 마감 뒤 늦은 재접속. pending 은 그대로 두어 원래 타이머가 정리하게 한다
	end
	if not Lobby.sitPlayer(p.tableId, p.side, player) then
		scheduleResit(player, p) -- pending·예약·마감을 그대로 유지한 채 재시도만 건다
		return false
	end
	-- 물리적 착석 성공. 여기부터 커밋까지 양보(yield) 하지 않는다
	pending[key] = nil
	session.players[owner] = player
	if session.waiting then
		session.waiting[owner] = nil
	end
	sessions[player] = session
	seatOf[player] = { id = p.tableId, side = p.side }
	ts.players[p.side] = player
	Lobby.lockSeated(player, true)
	session.engine:log("🔌 상대가 돌아왔습니다 — 대전을 이어서 진행합니다.", "imp")
	notifyTable(p.tableId)
	updateStatus(p.tableId)
	broadcast(session)
	scheduleBot(session)
	print(("[DD] room %d 재접속: %s (P%d)"):format(session.room, player.Name, owner + 1))
	return true
end

Players.PlayerAdded:Connect(function(player)
	task.spawn(function() -- 전적 불러오기 (DataStore 는 느릴 수 있어 별도 스레드)
		local rec = Stats.load(player)
		if player.Parent then
			reState:FireClient(player, { t = "stats", rec = rec, line = Stats.line(rec) })
		end
	end)
	player.CharacterAdded:Connect(function()
		task.wait(0.6) -- 캐릭터가 자리를 잡은 뒤 앉힌다
		if player.Parent then
			pcall(tryReconnect, player)
		end
	end)
end)

Lobby.onSeated(function(player, id, side)
	if seatOf[player] then -- 다른 자리에서 순간이동한 경우 방어
		local prev = seatOf[player]
		if prev.id ~= id or prev.side ~= side then
			local pts = tableState[prev.id]
			if pts.players[prev.side] == player then
				pts.players[prev.side] = nil
				pts.ready[prev.side] = nil
				notifyTable(prev.id)
				updateStatus(prev.id)
			end
		end
	end
	seatOf[player] = { id = id, side = side }
	local ts = tableState[id]
	ts.players[side] = player
	ts.ready[side] = nil
	notifyTable(id)
	updateStatus(id)
end)

local function vacate(player)
	local at = seatOf[player]
	if not at then
		return
	end
	seatOf[player] = nil
	local ts = tableState[at.id]
	if ts.players[at.side] == player then
		ts.players[at.side] = nil
	end
	ts.ready = {} -- 한 명이 떠나면 배치 단계 해제 (남은 사람은 다시 [게임 시작] 대기)
	ts.setupOpen = false
	removeBot(ts, at.id) -- 사람이 떠나면 봇도 자리를 비운다
	Lobby.lockSeated(player, false)
	if sessions[player] then
		leaveSession(player, true)
	end
	if player.Parent then
		reState:FireClient(player, { t = "left" })
	end
	notifyTable(at.id)
	updateStatus(at.id)
end

Lobby.onVacated(function(player, id, side)
	local at = seatOf[player]
	if at and at.id == id and at.side == side then
		vacate(player)
	end
end)

--==================================================================
-- 액션 처리
--==================================================================

reAction.OnServerEvent:Connect(function(player, a)
	if type(a) ~= "table" or type(a.t) ~= "string" then
		return
	end

	if a.t == "ping" then -- 클라이언트 진단용 핸드셰이크
		reState:FireClient(player, { t = "hello", version = VERSION, players = #Players:GetPlayers(), tables = Lobby.tableCount() })
		local at = seatOf[player]
		if at then
			notifyTable(at.id)
		end
		return
	end

	if a.t == "startGame" then -- 둘 다 앉은 뒤 한 명이 누르면 양측 배치 단계 진입 (HUD 버튼·Enter)
		tryStartSetup(player)
		return
	end

	if a.t == "bot" then -- [B] 혼자 앉은 상태에서 AI 대전 시작 (level: grade5 | dan5)
		local at = seatOf[player]
		if not at then
			reState:FireClient(player, { t = "reject", reason = "먼저 테이블 의자에 앉으세요 (의자 앞에서 E)" })
			return
		end
		local ts = tableState[at.id]
		if ts.session or ts.setupOpen then
			return
		end
		local oppSide = (at.side == "A") and "B" or "A"
		if ts.players[oppSide] then
			reState:FireClient(player, { t = "reject", reason = "맞은편에 이미 상대가 있습니다" })
			return
		end
		local bot = newBot(a.level)
		if not Lobby.setBotSeat(at.id, oppSide, bot.DisplayName, bot.level) then -- 예약·착석 중인 자리는 거절
			reState:FireClient(player, { t = "reject", reason = "맞은편 자리를 지금 쓸 수 없습니다 (재접속 대기 중)" })
			return
		end
		ts.players[oppSide] = bot
		ts.setupOpen = true
		ts.ready = {}
		botReady(ts)
		lockTable(ts, true)
		notifyTable(at.id)
		updateStatus(at.id)
		return
	end

	if a.t == "botLevel" then -- 배치 중 봇 난이도 변경
		local at = seatOf[player]
		local ts = at and tableState[at.id] or nil
		local bot, side = nil, nil
		if ts then
			bot, side = botOf(ts)
		end
		if bot and not ts.session then
			bot.level = (a.level == "dan5") and "dan5" or "grade5"
			bot.DisplayName = BOT_NAME[bot.level]
			Lobby.setBotSeat(at.id, side, bot.DisplayName, bot.level)
			notifyTable(at.id)
		end
		return
	end

	if a.t == "ready" then -- 배치 완료 (setup = {roster, pos}) — 앉아 있어야 하고 배치 단계가 열려 있어야 한다
		local at = seatOf[player]
		if not at then
			reState:FireClient(player, { t = "reject", reason = "먼저 테이블 의자에 앉으세요 (의자 앞에서 E)" })
			return
		end
		local ts = tableState[at.id]
		if ts.session then
			return
		end
		if not ts.setupOpen then
			reState:FireClient(player, { t = "reject", reason = "먼저 [게임 시작] 을 누르세요 (둘 다 앉은 뒤)" })
			return
		end
		local okSetup, why = Engine.validateSetup(a.setup)
		if not okSetup then
			reState:FireClient(player, { t = "reject", reason = why })
			return
		end
		ts.ready[at.side] = a.setup
		notifyTable(at.id)
		updateStatus(at.id)
		tryStart(at.id)
		return
	end

	if a.t == "unready" then
		local at = seatOf[player]
		if at and not tableState[at.id].session then
			tableState[at.id].ready[at.side] = nil
			notifyTable(at.id)
			updateStatus(at.id)
		end
		return
	end

	if a.t == "stand" then -- 자리 떠나기 (대전 중이면 기권 처리 후 기립)
		if seatOf[player] then
			vacate(player)
		end
		Lobby.standUp(player)
		return
	end

	local session = sessions[player]
	if not session then
		return
	end
	local owner = (session.players[0] == player) and 0 or 1
	local ok, err = session.engine:apply(owner, a)
	if not ok then
		session.engine:drainOutbox()
		reState:FireClient(player, { t = "reject", reason = err or "요청이 거부되었습니다" })
		return
	end
	broadcast(session)
	if session.engine.S.phase == "over" then
		endSession(session)
	else
		scheduleBot(session)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	local session = sessions[player]
	if session and session.engine.S.phase ~= "over" then -- 대전 중 연결 끊김 → 재접속 유예 (자리·세션 보존)
		local at = seatOf[player]
		seatOf[player] = nil
		-- 캐릭터가 사라지기 전에 먼저 예약한다 (Occupant nil 신호로 자리가 열리지 않게) · 본인만 다시 앉을 수 있다
		Lobby.setSeatHold(at and at.id, at and at.side, true, player.UserId)
		leaveSession(player, false, true, at)
		return
	end
	if seatOf[player] then
		vacate(player)
	elseif session then
		leaveSession(player, false)
	end
end)

print("[DD] Digit Dual 서버 준비 완료 v" .. VERSION .. " (Phase 3 — AI 봇 대전 · 보드게임 창)")
