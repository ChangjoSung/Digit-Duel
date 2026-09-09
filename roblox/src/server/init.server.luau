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
local Lobby = require(script:WaitForChild("Lobby"))

local VERSION = "0.5.0-p2d.4"

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
-- 테이블 상태 알림
--==================================================================

local function updateStatus(id)
	local ts = tableState[id]
	local n = (ts.players.A and 1 or 0) + (ts.players.B and 1 or 0)
	local text
	if ts.session then
		text = ("테이블 %d · ⚔️ 대전 중"):format(id)
	elseif n == 2 and ts.setupOpen then
		text = ("테이블 %d · 배치 중 (%d/2 완료)"):format(id, (ts.ready.A and 1 or 0) + (ts.ready.B and 1 or 0))
	elseif n == 2 then
		text = ("테이블 %d · 둘 다 착석 — [게임 시작] 대기"):format(id)
	elseif n == 1 then
		text = ("테이블 %d · 상대 기다리는 중 — 맞은편에 앉으세요"):format(id)
	else
		text = ("테이블 %d · 빈 자리 2"):format(id)
	end
	Lobby.setStatus(id, text)
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
			})
		end
	end
end

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

local function startSession(tableId, pA, sA, pB, sB)
	local seed = seedRandom:NextInteger(0, 2 ^ 31 - 1)
	local engine = Engine.new(seed)
	engine:applySetup(0, sA)
	engine:applySetup(1, sB)
	engine:begin()
	local session = { room = nextRoomId, tableId = tableId, engine = engine, players = { [0] = pA, [1] = pB } }
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
end

-- 대전 중 이탈(일어남·퇴장·자리 떠나기) = 기권. resigned=true 면 상대에게 "기권", false 면 "연결 끊김"
local function leaveSession(player, resigned)
	local session = sessions[player]
	if not session then
		return
	end
	local owner = (session.players[0] == player) and 0 or 1
	local opp = session.players[1 - owner]
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

	if a.t == "startGame" then -- 둘 다 앉은 뒤 한 명이 누르면 양측 배치 단계 진입
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
		notifyTable(at.id)
		updateStatus(at.id)
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
	end
end)

Players.PlayerRemoving:Connect(function(player)
	if seatOf[player] then
		vacate(player)
	elseif sessions[player] then
		leaveSession(player, false)
	end
end)

print("[DD] Digit Dual 서버 준비 완료 v" .. VERSION .. " (Phase 2b — 로비 메시 · 판 위 대국)")
