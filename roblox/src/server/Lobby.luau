--!nonstrict
-- Lobby.luau — 3D 로비 (Phase 2a): 바닥·스폰·테이블 N개(책상 + 7×13 판 + 마주보는 의자 2개).
-- 지금은 Roblox 기본 Part 로 만든 플레이스홀더 지오메트리 — Earth 자산(docs/roblox/earth-lobby-request.md)으로 교체 예정.
-- 규칙: 의자(Seat)에 앉으면 그 테이블의 A/B 자리에 배정된다. 자리 배정·이탈은 콜백으로 서버 본체에 알린다.
--       판 위의 그리드는 장식(정적)이다 — 실제 대국 상태를 판에 그리는 것은 관전 정보 은닉 정책 확정 뒤 (port-plan [기획 필요]).

local Players = game:GetService("Players")

local Lobby = {}

local TABLE_COUNT = 4
local SPACING = 30 -- 테이블 간격 (studs)
local COLS, ROWS = 7, 13

local tables = {} -- [id] = { model, desk, board, seats = {A=Seat, B=Seat}, status = TextLabel, occupants = {A=Player?, B=Player?} }
local seatedCb, vacatedCb = nil, nil

local C = {
	floor = Color3.fromRGB(58, 52, 46),
	desk = Color3.fromRGB(110, 78, 50),
	boardBg = Color3.fromRGB(30, 34, 46),
	zoneA = Color3.fromRGB(94, 47, 58),
	zoneB = Color3.fromRGB(47, 58, 94),
	forest = Color3.fromRGB(35, 66, 47),
	mid = Color3.fromRGB(43, 49, 64),
	seatA = Color3.fromRGB(70, 90, 150),
	seatB = Color3.fromRGB(150, 70, 80),
}

local function part(props, parent)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in props do
		p[k] = v
	end
	p.Parent = parent
	return p
end

-- 판 윗면에 7×13 그리드 (장식) — 진영·숲·중앙 색은 HTML 보드와 동일 계열
local function buildBoardGui(board)
	local sg = Instance.new("SurfaceGui")
	sg.Face = Enum.NormalId.Top
	sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	sg.PixelsPerStud = 50
	sg.LightInfluence = 0.6
	sg.Parent = board
	local grid = Instance.new("Frame")
	grid.Size = UDim2.fromScale(1, 1)
	grid.BackgroundColor3 = C.boardBg
	grid.BorderSizePixel = 0
	grid.Parent = sg
	for r = 1, ROWS do
		for c = 1, COLS do
			local cell = Instance.new("Frame")
			cell.Size = UDim2.new(1 / COLS, -2, 1 / ROWS, -2)
			cell.Position = UDim2.new((c - 1) / COLS, 1, (r - 1) / ROWS, 1)
			cell.BorderSizePixel = 0
			cell.BackgroundColor3 = (r <= 3) and C.zoneA or (r >= 11) and C.zoneB
				or ((r >= 4 and r <= 5) or (r >= 9 and r <= 10)) and C.forest or C.mid
			cell.Parent = grid
		end
	end
end

local function buildSeat(id, side, pos, lookAt, color, parent)
	local seat = Instance.new("Seat")
	seat.Name = "Seat" .. side
	seat.Size = Vector3.new(2, 0.5, 2)
	seat.Anchored = true
	seat.CFrame = CFrame.lookAt(pos, Vector3.new(lookAt.X, pos.Y, lookAt.Z))
	seat.Color = color
	seat.Material = Enum.Material.Fabric
	seat.TopSurface = Enum.SurfaceType.Smooth
	seat.Parent = parent
	part({ Name = "Back", Size = Vector3.new(2, 2.2, 0.3), CFrame = seat.CFrame * CFrame.new(0, 1.35, 1.15), Color = color, Material = Enum.Material.Fabric, CanCollide = false }, parent)
	part({ Name = "Legs", Size = Vector3.new(1.6, 0.9, 1.6), CFrame = seat.CFrame * CFrame.new(0, -0.7, 0), Color = C.desk, Material = Enum.Material.Wood }, parent)
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "앉기"
	prompt.ObjectText = ("테이블 %d · %s 자리"):format(id, side)
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.MaxActivationDistance = 8
	prompt.HoldDuration = 0
	prompt.RequiresLineOfSight = false
	prompt.Parent = seat
	prompt.Triggered:Connect(function(player)
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		if hum and not seat.Occupant and hum.Health > 0 then
			seat:Sit(hum)
		end
	end)
	return seat
end

local function buildTable(id, cx, cz, parent)
	local model = Instance.new("Model")
	model.Name = "Table" .. id
	model:SetAttribute("TableId", id)
	local desk = part({ Name = "Desk", Size = Vector3.new(9, 0.6, 7), Position = Vector3.new(cx, 2.7, cz), Color = C.desk, Material = Enum.Material.Wood }, model)
	for _, d in { { -4, -3 }, { 4, -3 }, { -4, 3 }, { 4, 3 } } do
		part({ Name = "Leg", Size = Vector3.new(0.5, 2.4, 0.5), Position = Vector3.new(cx + d[1], 1.2, cz + d[2]), Color = C.desk, Material = Enum.Material.Wood }, model)
	end
	-- 판: 7열이 X 축, 13행이 Z 축. A 자리(−Z 쪽)에서 보면 1행이 멀고 13행이 가깝다 (= 자기 진영이 앞)
	local board = part({ Name = "Board", Size = Vector3.new(COLS * 0.6, 0.2, ROWS * 0.6), Position = Vector3.new(cx, 3.1, cz), Color = C.boardBg, Material = Enum.Material.SmoothPlastic }, model)
	buildBoardGui(board)
	local seats = {
		A = buildSeat(id, "A", Vector3.new(cx, 1.25, cz + 5.2), board.Position, C.seatA, model),
		B = buildSeat(id, "B", Vector3.new(cx, 1.25, cz - 5.2), board.Position, C.seatB, model),
	}
	-- 상태 표지 (서버가 갱신 → 전원에게 복제)
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.new(0, 220, 0, 56)
	bb.StudsOffset = Vector3.new(0, 4.5, 0)
	bb.MaxDistance = 70
	bb.Adornee = desk
	bb.Parent = desk
	local status = Instance.new("TextLabel")
	status.Size = UDim2.fromScale(1, 1)
	status.BackgroundColor3 = Color3.fromRGB(19, 22, 30)
	status.BackgroundTransparency = 0.25
	status.TextColor3 = Color3.fromRGB(232, 236, 245)
	status.TextScaled = true
	status.Font = Enum.Font.GothamBold
	status.Text = ("테이블 %d · 빈 자리 2"):format(id)
	status.Parent = bb
	model.Parent = parent

	local t = { id = id, model = model, desk = desk, board = board, seats = seats, status = status, occupants = {} }
	for side, seat in seats do
		seat:GetPropertyChangedSignal("Occupant"):Connect(function()
			local hum = seat.Occupant
			local prev = t.occupants[side]
			if hum then
				local plr = Players:GetPlayerFromCharacter(hum.Parent)
				if plr and plr ~= prev then
					t.occupants[side] = plr
					if seatedCb then
						seatedCb(plr, id, side)
					end
				end
			elseif prev then
				t.occupants[side] = nil
				if vacatedCb then
					vacatedCb(prev, id, side)
				end
			end
		end)
	end
	return t
end

function Lobby.build()
	local folder = Instance.new("Folder")
	folder.Name = "Lobby"
	part({ Name = "Floor", Size = Vector3.new(140, 1, 140), Position = Vector3.new(0, -0.5, 0), Color = C.floor, Material = Enum.Material.WoodPlanks }, folder)
	for _, w in { { 0, 70, 140, 1 }, { 0, -70, 140, 1 }, { 70, 0, 1, 140 }, { -70, 0, 1, 140 } } do
		part({ Name = "Wall", Size = Vector3.new(w[3], 12, w[4]), Position = Vector3.new(w[1], 6, w[2]), Color = Color3.fromRGB(40, 42, 52), Material = Enum.Material.Concrete }, folder)
	end
	local spawn = Instance.new("SpawnLocation")
	spawn.Size = Vector3.new(10, 1, 10)
	spawn.Position = Vector3.new(0, 0.5, 48)
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Transparency = 0.6
	spawn.Color = Color3.fromRGB(91, 140, 255)
	spawn.Parent = folder
	local n = 0
	for i = 1, TABLE_COUNT do
		local col, row = (i - 1) % 2, math.floor((i - 1) / 2)
		local cx = (col == 0) and -SPACING / 2 or SPACING / 2
		local cz = row * SPACING - SPACING / 2 - 10
		tables[i] = buildTable(i, cx, cz, folder)
		n += 1
	end
	folder.Parent = workspace
	print(("[DD] 로비 생성: 테이블 %d개"):format(n))
end

function Lobby.onSeated(fn)
	seatedCb = fn
end

function Lobby.onVacated(fn)
	vacatedCb = fn
end

function Lobby.setStatus(id, text)
	local t = tables[id]
	if t then
		t.status.Text = text
	end
end

function Lobby.tableCount()
	return #tables
end

function Lobby.occupants(id)
	local t = tables[id]
	return t and t.occupants or {}
end

-- 대전 중 실수로 일어나는 것 방지 (점프 = 기립). 종료 시 해제
function Lobby.lockSeated(player, locked)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if hum then
		pcall(function()
			hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, not locked)
		end)
	end
end

function Lobby.standUp(player)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if hum then
		pcall(function()
			hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, true)
		end)
		hum.Sit = false
		pcall(function()
			hum:ChangeState(Enum.HumanoidStateType.Jumping)
		end)
	end
end

return Lobby
