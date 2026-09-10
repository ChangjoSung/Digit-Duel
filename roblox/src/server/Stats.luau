--!nonstrict
-- Stats.luau — 전적 저장 (Phase 4, DataStore). 승·패·무·대전 수와 마지막 플레이 시각을 플레이어별로 남긴다.
-- 규칙과 무관한 운영 데이터다. Studio 에서는 DataStore 접근이 막혀 있을 수 있어(설정 미허용) 실패하면
-- **메모리 전용으로 조용히 낮춘다** — 저장이 안 된다고 대전이 막히면 안 된다.
-- 저장 키: "p_<UserId>" · 값: { wins, losses, draws, games, updated }

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Stats = {}

local STORE_NAME = "DigitDualStats_v1"
local store = nil
local ok, err = pcall(function()
	store = DataStoreService:GetDataStore(STORE_NAME)
end)
if not ok then
	warn("[DD] DataStore 사용 불가 — 메모리 전용 전적으로 진행합니다: " .. tostring(err))
	store = nil
end

local cache = {} -- [userId] = { wins, losses, draws, games, updated }
local dirty = {} -- [userId] = true

local function blank()
	return { wins = 0, losses = 0, draws = 0, games = 0, updated = 0 }
end

local function keyOf(userId)
	return "p_" .. tostring(userId)
end

-- 저장된 값을 안전하게 받아 형태를 맞춘다 (손상·구버전 값 방어)
local function normalize(v)
	if type(v) ~= "table" then
		return blank()
	end
	local out = blank()
	for _, k in { "wins", "losses", "draws", "games" } do
		local n = v[k]
		out[k] = (type(n) == "number" and n >= 0 and n < 1e9) and math.floor(n) or 0
	end
	out.updated = type(v.updated) == "number" and v.updated or 0
	return out
end

function Stats.load(player)
	local uid = player.UserId
	if cache[uid] then
		return cache[uid]
	end
	local rec = blank()
	if store then
		local okGet, got = pcall(function()
			return store:GetAsync(keyOf(uid))
		end)
		if okGet then
			rec = normalize(got)
		else
			warn("[DD] 전적 불러오기 실패 (" .. player.Name .. ") — 이번 세션은 0 부터: " .. tostring(got))
		end
	end
	cache[uid] = rec
	return rec
end

function Stats.get(player)
	return cache[player.UserId] or blank()
end

-- result: "win" | "loss" | "draw"
function Stats.record(player, result)
	if not player then
		return
	end
	local rec = Stats.load(player)
	rec.games += 1
	if result == "win" then
		rec.wins += 1
	elseif result == "loss" then
		rec.losses += 1
	else
		rec.draws += 1
	end
	rec.updated = os.time()
	dirty[player.UserId] = true
	return rec
end

local function flushOne(uid)
	if not store or not dirty[uid] then
		return
	end
	local rec = cache[uid]
	if not rec then
		dirty[uid] = nil
		return
	end
	local okSet, e = pcall(function()
		store:UpdateAsync(keyOf(uid), function(old) -- 다른 서버가 먼저 올린 값이 있으면 큰 쪽을 남긴다
			local prev = normalize(old)
			if prev.games > rec.games then
				return prev
			end
			return { wins = rec.wins, losses = rec.losses, draws = rec.draws, games = rec.games, updated = rec.updated }
		end)
	end)
	if okSet then
		dirty[uid] = nil
	else
		warn("[DD] 전적 저장 실패 (" .. tostring(uid) .. "): " .. tostring(e))
	end
end

function Stats.flush(player)
	flushOne(player.UserId)
end

function Stats.release(player)
	local uid = player.UserId
	flushOne(uid)
	cache[uid] = nil
	dirty[uid] = nil
end

-- 주기 저장 (서버가 갑자기 내려가도 최근 결과가 남도록) — 실패해도 계속 돈다
task.spawn(function()
	while true do
		task.wait(60)
		for uid in dirty do
			flushOne(uid)
			task.wait(0.2) -- DataStore 호출 간격 여유
		end
	end
end)

-- 서버 종료 시 남은 것 저장 (Studio 는 BindToClose 가 짧아 최선 노력)
game:BindToClose(function()
	if RunService:IsStudio() then
		return
	end
	for uid in dirty do
		flushOne(uid)
	end
end)

Players.PlayerRemoving:Connect(function(player)
	Stats.release(player)
end)

-- 표시용 한 줄 (승/패/무 · 승률)
function Stats.line(rec)
	rec = rec or blank()
	local decided = rec.wins + rec.losses
	local rate = (decided > 0) and math.floor(rec.wins / decided * 100 + 0.5) or 0
	return ("%d승 %d패 %d무 · 승률 %d%%"):format(rec.wins, rec.losses, rec.draws, rate)
end

return Stats
