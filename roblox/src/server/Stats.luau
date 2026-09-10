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

-- 저장 상태: rev 는 결과가 기록될 때마다 오르고, savedRev 는 실제로 저장에 성공한 rev 다.
-- UpdateAsync 는 중간에 양보(yield)하므로 "그 저장이 올린 rev" 까지만 확정한다 —
-- 저장 도중 들어온 새 결과는 rev 가 더 크므로 계속 dirty 로 남는다 (오래된 ACK 가 지우지 못한다)
local cache = {} -- [userId] = { wins, losses, draws, games, updated }
local rev = {} -- [userId] = 변경 리비전
local savedRev = {} -- [userId] = 저장 완료된 리비전
local saving = {} -- [userId] = true (UpdateAsync 진행 중 — 같은 키 중복 저장 방지)
local loading = {} -- [userId] = true (GetAsync 진행 중 — 중복 로드로 기록을 덮어쓰지 않게)

local function isDirty(uid)
	return cache[uid] ~= nil and (rev[uid] or 0) ~= (savedRev[uid] or 0)
end

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

-- 캐시에 없으면 DataStore 에서 읽는다 (여기서만 양보). 같은 UserId 동시 호출은 하나만 읽고 나머지는 그 결과를 공유한다
local function loadId(userId, name)
	local rec = cache[userId]
	if rec then
		return rec
	end
	if loading[userId] then
		local t0 = os.clock()
		while loading[userId] and os.clock() - t0 < 10 do
			task.wait(0.05)
		end
		if cache[userId] then
			return cache[userId]
		end
	end
	local out = blank()
	if store then
		loading[userId] = true
		local okGet, got = pcall(function()
			return store:GetAsync(keyOf(userId))
		end)
		loading[userId] = nil
		if cache[userId] then -- 기다리는 사이 다른 흐름이 채웠다면 그 값을 쓴다 (그 사이 기록된 결과 유실 방지)
			return cache[userId]
		end
		if okGet then
			out = normalize(got)
		else
			warn("[DD] 전적 불러오기 실패 (" .. tostring(name or userId) .. ") — 이번 세션은 0 부터: " .. tostring(got))
		end
	end
	cache[userId] = out
	rev[userId] = rev[userId] or 0
	savedRev[userId] = savedRev[userId] or 0
	return out
end

function Stats.load(player)
	return loadId(player.UserId, player.Name)
end

function Stats.get(player)
	return cache[player.UserId] or blank()
end

-- result: "win" | "loss" | "draw" — UserId 기준이라 접속이 끊긴 참가자도 기록할 수 있다.
-- 캐시에 없으면 불러오는 동안 양보하므로 게임 흐름 안에서는 task.spawn 으로 감싸 호출한다
function Stats.recordId(userId, result, name)
	if type(userId) ~= "number" then
		return blank()
	end
	local rec = loadId(userId, name)
	rec.games += 1
	if result == "win" then
		rec.wins += 1
	elseif result == "loss" then
		rec.losses += 1
	else
		rec.draws += 1
	end
	rec.updated = os.time()
	rev[userId] = (rev[userId] or 0) + 1
	return rec
end

function Stats.record(player, result)
	if not player then
		return
	end
	return Stats.recordId(player.UserId, result, player.Name)
end

local function flushOne(uid)
	if not store or saving[uid] or not isDirty(uid) then
		return false
	end
	local rec = cache[uid]
	if not rec then
		return false
	end
	saving[uid] = true
	local usedRev = rev[uid] or 0
	local okSet, e = pcall(function()
		store:UpdateAsync(keyOf(uid), function(old) -- 다른 서버가 먼저 올린 값이 있으면 큰 쪽을 남긴다
			local cur = cache[uid] or rec -- 재시도 사이에 들어온 새 결과까지 함께 올린다
			usedRev = rev[uid] or usedRev -- 실제로 올린 리비전 (변환 함수 안에서는 양보가 없어 값이 어긋나지 않는다)
			local prev = normalize(old)
			if prev.games > cur.games then
				return prev
			end
			return { wins = cur.wins, losses = cur.losses, draws = cur.draws, games = cur.games, updated = cur.updated }
		end)
	end)
	saving[uid] = nil
	if okSet then
		if (savedRev[uid] or 0) < usedRev then
			savedRev[uid] = usedRev -- 여기까지만 저장됨 — 저장 중 들어온 결과는 dirty 로 남아 다음에 실린다
		end
	else
		warn("[DD] 전적 저장 실패 (" .. tostring(uid) .. "): " .. tostring(e))
	end
	return okSet == true
end

function Stats.flush(player)
	flushOne(player.UserId)
end

-- 나갈 때 저장. 저장이 끝나지 않았거나 같은 사람이 이미 다시 들어와 있으면 캐시를 버리지 않는다 (미저장 결과 유실 방지)
function Stats.release(player)
	local uid = player.UserId
	task.spawn(function()
		flushOne(uid)
		if isDirty(uid) or saving[uid] or loading[uid] then
			return -- 아직 남은 결과가 있다 — 주기 저장·BindToClose 가 맡는다
		end
		local now = Players:GetPlayerByUserId(uid)
		if now and now ~= player then
			return -- 재접속해서 새 Player 로 들어와 있다 — 캐시를 유지한다
		end
		cache[uid] = nil
		rev[uid] = nil
		savedRev[uid] = nil
	end)
end

-- 주기 저장 (서버가 갑자기 내려가도 최근 결과가 남도록) — 실패해도 계속 돈다
task.spawn(function()
	while true do
		task.wait(60)
		local todo = {} -- 키를 먼저 모은다 (flushOne 이 양보하는 동안 cache 가 바뀔 수 있다)
		for uid in cache do
			if isDirty(uid) then
				table.insert(todo, uid)
			end
		end
		for _, uid in todo do
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
	local todo = {}
	for uid in cache do
		if isDirty(uid) then
			table.insert(todo, uid)
		end
	end
	for _, uid in todo do
		local t0 = os.clock()
		while saving[uid] and os.clock() - t0 < 3 do -- 진행 중인 저장이 끝나기를 잠깐 기다린다
			task.wait(0.1)
		end
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
