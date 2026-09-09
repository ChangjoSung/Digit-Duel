--!nonstrict
-- init.server.luau — Digit Dual Roblox 서버 (Phase 1)
-- 역할: 1:1 매치메이킹(대기 슬롯 1개 — Node 릴레이 서버와 같은 선착순 페어링) + 서버 권위 게임 세션.
-- 클라이언트는 액션만 보내고, 서버가 엔진을 굴려 뷰어별로 필터링된 상태를 돌려준다.
-- HTML의 시드 락스텝(비권위 릴레이)과 달리 숨은 정보가 클라이언트에 아예 전송되지 않는다.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Engine = require(Shared.Engine)
local Views = require(Shared.Views)

local VERSION = "0.5.0-p1.2"

-- 보드게임이라 아바타가 필요 없다. 맵에 바닥이 없어 캐릭터가 스폰되면 허공으로 떨어져 죽고(빨간 피격 효과) 리스폰을 반복한다
Players.CharacterAutoLoads = false
for _, plr in Players:GetPlayers() do
	if plr.Character then
		plr.Character:Destroy()
	end
end

-- Remotes 생성
local remotes = Instance.new("Folder")
remotes.Name = "DDRemotes"
local reAction = Instance.new("RemoteEvent") -- 클라 → 서버: {t=...}
reAction.Name = "Action"
reAction.Parent = remotes
local reState = Instance.new("RemoteEvent") -- 서버 → 클라: {view=..., events={...}} | {t="queue"} | {t="reject", reason} | {t="left"}
reState.Name = "State"
reState.Parent = remotes
remotes.Parent = ReplicatedStorage

local seedRandom = Random.new()

local waiting = nil -- {player, setup} — 1:1 대기 슬롯
local sessions = {} -- [player] = session
local nextRoomId = 1

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

local function startSession(p1, s1, p2, s2)
	local seed = seedRandom:NextInteger(0, 2 ^ 31 - 1)
	local engine = Engine.new(seed)
	engine:applySetup(0, s1)
	engine:applySetup(1, s2)
	engine:begin()
	local session = {
		room = nextRoomId,
		engine = engine,
		players = { [0] = p1, [1] = p2 },
	}
	nextRoomId += 1
	sessions[p1] = session
	sessions[p2] = session
	print(("[DD] room %d 시작: %s vs %s (seed %d)"):format(session.room, p1.Name, p2.Name, seed))
	broadcast(session)
end

local function leaveSession(player, resigned)
	local session = sessions[player]
	if not session then
		return
	end
	local owner = (session.players[0] == player) and 0 or 1
	sessions[player] = nil
	local opp = session.players[1 - owner]
	if opp then
		sessions[opp] = nil
	end
	if session.engine.S.phase ~= "over" then
		session.engine:gameOver(1 - owner, "resign")
		session.engine:log("🏳️ 상대가 떠났습니다 — P" .. (2 - owner) .. " 승리!", "imp")
	end
	if opp and opp.Parent then
		local events = session.engine:drainOutbox()
		reState:FireClient(opp, {
			t = "state",
			room = session.room,
			view = Views.forViewer(session.engine, 1 - owner),
			events = events,
			opponentLeft = not resigned,
		})
	end
end

reAction.OnServerEvent:Connect(function(player, a)
	if type(a) ~= "table" or type(a.t) ~= "string" then
		return
	end

	if a.t == "ping" then -- 클라이언트 진단용 핸드셰이크: 서버 생존·버전 표시
		reState:FireClient(player, { t = "hello", version = VERSION, players = #Players:GetPlayers(), waiting = waiting ~= nil })
		return
	end

	if a.t == "queue" then -- 배치 완료 → 매칭 (HTML 사전 배치 플로우와 동일: 배치가 먼저, 매칭이 나중)
		if sessions[player] then
			return
		end
		if waiting and waiting.player == player then
			waiting.setup = a.setup -- 배치 갱신
			return
		end
		if waiting and waiting.player.Parent then
			local w = waiting
			waiting = nil
			startSession(w.player, w.setup, player, a.setup)
		else
			waiting = { player = player, setup = a.setup }
			reState:FireClient(player, { t = "queue" })
		end
		return
	end

	if a.t == "cancelQueue" then
		if waiting and waiting.player == player then
			waiting = nil
			reState:FireClient(player, { t = "queueCancelled" })
		end
		return
	end

	local session = sessions[player]
	if not session then
		return
	end
	local owner = (session.players[0] == player) and 0 or 1
	local ok, err = session.engine:apply(owner, a)
	if not ok then
		session.engine:drainOutbox() -- 거부된 액션이 남긴 이벤트는 없어야 하나, 방어적으로 비운다
		reState:FireClient(player, { t = "reject", reason = err or "요청이 거부되었습니다" })
		return
	end
	broadcast(session)
	if session.engine.S.phase == "over" then
		local p0, p1 = session.players[0], session.players[1]
		sessions[p0] = nil
		if p1 then
			sessions[p1] = nil
		end
		print(("[DD] room %d 종료 — 승자: %s"):format(session.room, tostring(session.engine.S.winner)))
	end
end)

Players.PlayerRemoving:Connect(function(player)
	if waiting and waiting.player == player then
		waiting = nil
	end
	leaveSession(player, false)
end)

print("[DD] Digit Dual 서버 준비 완료 v" .. VERSION .. " (Phase 1 — 서버 권위 룰 엔진)")
