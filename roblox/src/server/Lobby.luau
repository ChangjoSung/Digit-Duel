--!nonstrict
-- Lobby.luau — 3D 로비 (Phase 2b): 바닥·벽·기둥·스폰·테이블 4개(책상 + 7×13 판 + 마주보는 의자 2개).
-- 구조: 기능 파트(충돌·Seat·클릭 대상 "Board")는 즉시 Part 로 만들고, Earth 납품 메시(FBX → Model 자산)를
--       InsertService 로 불러와 시각 메시로 덧씌운다. 메시 로드에 실패하면 기존 Part 시각을 그대로 둔다 (폴백).
-- 좌표 계약 (roblox/assets/lobby/README.md): Y-up · 1 unit = 1 stud · 판 로컬 X=(col-4)×0.6, Z=(row-7)×0.6 · row1 은 Z-3.6(B 쪽·빨강),
--       row13 은 Z+3.6(A 쪽·파랑) · A 자리 = 테이블 Z+5.2, B 자리 = Z-5.2 · 테이블 중심 (-15,-25),(15,-25),(-15,5),(15,5)
-- 규칙: 판 위의 그리드/말은 서버가 그리지 않는다 — 말은 각 클라이언트가 서버 필터 뷰로 로컬 생성 (정보 은닉, 인계서 §6).

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local InsertService = game:GetService("InsertService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Art = require(Shared:WaitForChild("Art"))

local Lobby = {}

local TABLE_COUNT = 4
local COLS, ROWS = 7, 13
local TABLE_CENTERS = { { -15, -25 }, { 15, -25 }, { -15, 5 }, { 15, 5 } }

-- 임포트 축 보정 요(rad). CJ 실측(2026-09-09): FBX 임포트에서 Z 가 뒤집혀 의자 등받이가 앞(판 쪽)에 놓였다 → 앞뒤가 있는 메시(의자·판·벽)는 π.
-- 대칭 메시(책상·바닥·기둥)는 0. 판 진영(row1 빨강 = B 쪽)이나 벽 장식면이 반대로 보이면 해당 항목만 0/π 로 바꾼다
local MESH_YAW = { desk = 0, chair = math.pi, board = math.pi, floor = 0, wall = math.pi, pillar = 0 }
-- 좌석 방향 보정(rad): Seat 정면(-Z)이 판을 향하도록 lookAt 으로 두었다. 아바타가 판을 등지고 앉으면 math.pi 로 바꾼다
local SEAT_YAW = 0
-- 메시 외접 상자 중심 기준 크기 (로비 manifest)
local MESH_SIZE = {
	desk = Vector3.new(9, 3, 7),
	chair = Vector3.new(2.02, 3.7, 2.3),
	board = Vector3.new(4.2, 0.2, 7.8),
	floor = Vector3.new(140, 1, 140),
	wall = Vector3.new(140, 12, 0.89),
	pillar = Vector3.new(1.2, 12, 1.2),
}
local MESH_TEX = { desk = "desk_albedo", chair = "chair_albedo", board = "board_grid", floor = "floor_tile", wall = "wall_albedo", pillar = "pillar_albedo" }

local tables = {} -- [id] = { model, desk, board, seats = {A=Seat, B=Seat}, status = TextLabel, occupants = {A=Player?, B=Player?}, startPrompt = ProximityPrompt }
local seatedCb, vacatedCb, startCb = nil, nil, nil
local templates = {} -- [name] = MeshPart 템플릿 (로드 성공분)

local C = {
	floor = Color3.fromRGB(58, 52, 46),
	desk = Color3.fromRGB(110, 78, 50),
	boardBg = Color3.fromRGB(30, 34, 46),
	zoneA = Color3.fromRGB(0x5e, 0x2f, 0x3a), -- row1~3 (B·빨강 진영)
	zoneB = Color3.fromRGB(0x2f, 0x3a, 0x5e), -- row11~13 (A·파랑 진영)
	forest = Color3.fromRGB(0x23, 0x42, 0x2f),
	mid = Color3.fromRGB(0x2b, 0x31, 0x40),
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

--==================================================================
-- 메시 템플릿 로드 (Open Cloud 로 올린 Model 자산 → MeshPart)
--==================================================================

local function loadMeshTemplate(assetId, name)
	if not assetId then
		return nil
	end
	local ok, model = pcall(InsertService.LoadAsset, InsertService, assetId)
	if not ok or typeof(model) ~= "Instance" then
		warn(("[DD] 메시 로드 실패 %s (%s): %s"):format(name, tostring(assetId), tostring(model)))
		return nil
	end
	local mp = model:FindFirstChildWhichIsA("MeshPart", true)
	if not mp then
		warn(("[DD] 메시 없음 %s (%s)"):format(name, tostring(assetId)))
		model:Destroy()
		return nil
	end
	mp.Parent = nil
	model:Destroy()
	mp.Name = name
	mp.Anchored = true
	mp.CanCollide = false
	mp.CanTouch = false
	mp.CastShadow = true
	mp.Color = Color3.new(1, 1, 1)
	mp.Material = Enum.Material.SmoothPlastic
	return mp
end

local function placeMesh(name, cf, parent, color)
	local tpl = templates[name]
	if not tpl then
		return nil
	end
	local m = tpl:Clone()
	m.Name = name .. "Mesh"
	m.Size = MESH_SIZE[name]
	m.CFrame = cf * CFrame.Angles(0, MESH_YAW[name] or 0, 0)
	m.CanQuery = false -- 클릭 raycast 는 기능 파트(Board 등)가 받는다
	local tex = Art.lobbyImage(MESH_TEX[name])
	if tex then
		m.TextureID = tex
	end
	m.Color = color or Color3.new(1, 1, 1)
	m.Parent = parent
	return m
end

--==================================================================
-- 판 (장식 그리드 — 메시 로드 전 폴백)
--==================================================================

local function buildBoardGui(board)
	local sg = Instance.new("SurfaceGui")
	sg.Name = "GridGui"
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

--==================================================================
-- 의자·테이블
--==================================================================

local function buildSeat(id, side, pos, lookAt, color, parent)
	local seat = Instance.new("Seat")
	seat.Name = "Seat" .. side
	seat.Size = Vector3.new(2, 0.5, 2)
	seat.Anchored = true
	seat.CFrame = CFrame.lookAt(pos, Vector3.new(lookAt.X, pos.Y, lookAt.Z)) * CFrame.Angles(0, SEAT_YAW, 0) -- 앞(-Z 로컬)이 판을 향한다 → 등받이는 +Z 로컬
	seat.Color = color
	seat.Material = Enum.Material.Fabric
	seat.TopSurface = Enum.SurfaceType.Smooth
	-- 접촉 자동 착석 금지: Seat 는 닿기만 해도 앉히고, 점프로 일어나도 아직 닿아 있어 즉시 다시 앉히는 루프가 생긴다.
	-- 앉기는 아래 ProximityPrompt [E] → seat:Sit() 로만, 일어나기는 점프(Space) 또는 [자리 떠나기]
	seat.CanTouch = false
	seat.Parent = parent
	local back = part({ Name = "Back", Size = Vector3.new(2, 2.2, 0.3), CFrame = seat.CFrame * CFrame.new(0, 1.35, 1.15), Color = color, Material = Enum.Material.Fabric, CanCollide = false }, parent)
	local legs = part({ Name = "Legs", Size = Vector3.new(1.6, 0.9, 1.6), CFrame = seat.CFrame * CFrame.new(0, -0.7, 0), Color = C.desk, Material = Enum.Material.Wood }, parent)
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
		if hum and not seat.Occupant and hum.Health > 0 and not hum.Sit then
			seat:Sit(hum)
		end
	end)
	seat:GetPropertyChangedSignal("Occupant"):Connect(function() -- 누가 앉아 있으면 프롬프트 숨김
		prompt.Enabled = seat.Occupant == nil
	end)
	return seat, { back, legs }
end

local function buildSign(id, desk)
	local bb = Instance.new("BillboardGui")
	bb.Name = "Sign"
	bb.Size = UDim2.new(0, 220, 0, 56)
	bb.StudsOffset = Vector3.new(0, 4.5, 0)
	bb.MaxDistance = 70
	bb.Adornee = desk
	bb.Parent = desk
	local bg = Instance.new("ImageLabel") -- 납품 표지 9-slice (SliceCenter 16,16,240,48) — 이미지 없으면 단색 폴백
	bg.Size = UDim2.fromScale(1, 1)
	bg.BackgroundColor3 = Color3.fromRGB(19, 22, 30)
	bg.BackgroundTransparency = 0.25
	bg.BorderSizePixel = 0
	local sign = Art.lobbyImage("table_sign")
	if sign then
		bg.Image = sign
		bg.ScaleType = Enum.ScaleType.Slice
		bg.SliceCenter = Rect.new(16, 16, 240, 48)
		bg.SliceScale = 1
		bg.BackgroundTransparency = 1
	end
	bg.Parent = bb
	local status = Instance.new("TextLabel")
	status.Size = UDim2.new(1, -20, 1, -12)
	status.Position = UDim2.new(0, 10, 0, 6)
	status.BackgroundTransparency = 1
	status.TextColor3 = Color3.fromRGB(232, 236, 245)
	status.TextScaled = true
	status.Font = Enum.Font.GothamBold
	status.Text = ("테이블 %d · 빈 자리 2"):format(id)
	status.Parent = bg
	return status
end

local function buildTable(id, cx, cz, parent)
	local model = Instance.new("Model")
	model.Name = "Table" .. id
	model:SetAttribute("TableId", id)
	-- 기능 파트: 책상 상판 충돌 + 다리
	local desk = part({ Name = "Desk", Size = Vector3.new(9, 0.6, 7), Position = Vector3.new(cx, 2.7, cz), Color = C.desk, Material = Enum.Material.Wood }, model)
	local legs = {}
	for _, d in { { -4, -3 }, { 4, -3 }, { -4, 3 }, { 4, 3 } } do
		table.insert(legs, part({ Name = "Leg", Size = Vector3.new(0.5, 2.4, 0.5), Position = Vector3.new(cx + d[1], 1.2, cz + d[2]), Color = C.desk, Material = Enum.Material.Wood }, model))
	end
	-- 판: 클릭 raycast 대상 (메시가 오면 투명해지지만 CanQuery 는 유지)
	local board = part({ Name = "Board", Size = MESH_SIZE.board, Position = Vector3.new(cx, 3.1, cz), Color = C.boardBg, Material = Enum.Material.SmoothPlastic, CanCollide = false }, model)
	board.CanQuery = true
	buildBoardGui(board)
	-- 게임 시작 프롬프트 (앉기 [E] 와 같은 방식): 둘 다 앉았을 때만 서버가 켠다. 앉은 두 사람 중 아무나 [F]
	local startPrompt = Instance.new("ProximityPrompt")
	startPrompt.Name = "StartPrompt"
	startPrompt.ActionText = "게임 시작"
	startPrompt.ObjectText = ("테이블 %d"):format(id)
	startPrompt.KeyboardKeyCode = Enum.KeyCode.F
	startPrompt.MaxActivationDistance = 10
	startPrompt.HoldDuration = 0
	startPrompt.RequiresLineOfSight = false
	startPrompt.Enabled = false
	startPrompt.Parent = board
	startPrompt.Triggered:Connect(function(player)
		if startCb then
			startCb(player, id)
		end
	end)
	local seatA, seatAVis = buildSeat(id, "A", Vector3.new(cx, 1.25, cz + 5.2), board.Position, C.seatA, model)
	local seatB, seatBVis = buildSeat(id, "B", Vector3.new(cx, 1.25, cz - 5.2), board.Position, C.seatB, model)
	local status = buildSign(id, desk)
	model.Parent = parent

	local t = {
		id = id, cx = cx, cz = cz, model = model, desk = desk, legs = legs, board = board,
		seats = { A = seatA, B = seatB }, seatVis = { A = seatAVis, B = seatBVis },
		status = status, occupants = {}, startPrompt = startPrompt,
	}
	for side, seat in t.seats do
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

--==================================================================
-- 시각 메시 적용 (로드 완료 후)
--==================================================================

local function hide(p)
	if p then
		p.Transparency = 1
	end
end

local function applyTableMeshes(t)
	local center = CFrame.new(t.cx, 0, t.cz)
	if placeMesh("desk", center * CFrame.new(0, 1.5, 0), t.model) then
		hide(t.desk)
		for _, l in t.legs do
			hide(l)
		end
	end
	if placeMesh("board", center * CFrame.new(0, 3.1, 0), t.model) then
		hide(t.board)
		local gui = t.board:FindFirstChild("GridGui")
		if gui then
			gui:Destroy() -- 납품 판 텍스처와 겹치지 않게
		end
	end
	for side, seat in t.seats do
		-- 의자 메시: 외접 상자 중심 Y1.85 (Seat 중심 1.25 → +0.6), 로컬 Z+0.15. 회색 알베도에 A/B 틴트
		if placeMesh("chair", seat.CFrame * CFrame.new(0, 0.6, 0.15), t.model, Art.CHAIR_TINT[side]) then
			hide(seat)
			for _, v in t.seatVis[side] do
				v:Destroy()
			end
			t.seatVis[side] = {}
		end
	end
end

local function applyLobbyMeshes(folder, floorPart, wallParts)
	if placeMesh("floor", CFrame.new(0, -0.5, 0), folder) then
		hide(floorPart)
	end
	-- 벽: 장식면(로컬 -Z)이 실내를 향하도록 회전. 외접 중심은 제작 피벗에서 로컬 Z-0.055
	local walls = {
		{ CFrame.new(0, 6, 70), 0 }, -- 북: 안쪽 = -Z
		{ CFrame.new(0, 6, -70), math.pi }, -- 남: 안쪽 = +Z
		{ CFrame.new(70, 6, 0), math.pi / 2 }, -- 동: 안쪽 = -X
		{ CFrame.new(-70, 6, 0), -math.pi / 2 }, -- 서: 안쪽 = +X
	}
	local anyWall = false
	for _, w in walls do
		if placeMesh("wall", w[1] * CFrame.Angles(0, w[2], 0) * CFrame.new(0, 0, -0.055), folder) then
			anyWall = true
		end
	end
	if anyWall then
		for _, p in wallParts do
			hide(p)
		end
	end
	for _, s in { { 1, 1 }, { -1, 1 }, { 1, -1 }, { -1, -1 } } do
		placeMesh("pillar", CFrame.new(69.4 * s[1], 6, 69.4 * s[2]), folder)
	end
end

--==================================================================
-- 공개 API
--==================================================================

function Lobby.build()
	local folder = Instance.new("Folder")
	folder.Name = "Lobby"
	local floorPart = part({ Name = "Floor", Size = MESH_SIZE.floor, Position = Vector3.new(0, -0.5, 0), Color = C.floor, Material = Enum.Material.WoodPlanks }, folder)
	local wallParts = {}
	for _, w in { { 0, 70, 140, 1 }, { 0, -70, 140, 1 }, { 70, 0, 1, 140 }, { -70, 0, 1, 140 } } do
		table.insert(wallParts, part({ Name = "Wall", Size = Vector3.new(w[3], 12, w[4]), Position = Vector3.new(w[1], 6, w[2]), Color = Color3.fromRGB(40, 42, 52), Material = Enum.Material.Concrete }, folder))
	end
	local spawn = Instance.new("SpawnLocation")
	spawn.Size = Vector3.new(10, 1, 10)
	spawn.Position = Vector3.new(0, 0.5, 48)
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Transparency = 0.6
	spawn.Color = Color3.fromRGB(91, 140, 255)
	spawn.Parent = folder
	for i = 1, TABLE_COUNT do
		local c = TABLE_CENTERS[i]
		tables[i] = buildTable(i, c[1], c[2], folder)
	end
	folder.Parent = workspace
	print(("[DD] 로비 생성: 테이블 %d개 (Part 폴백) — 메시 로드 시작"):format(TABLE_COUNT))

	-- 클라이언트가 복제해 쓰는 템플릿 (미공개 말 공통 덮개)
	local tplFolder = Instance.new("Folder")
	tplFolder.Name = "DDTemplates"
	tplFolder.Parent = ReplicatedStorage

	task.spawn(function()
		for _, name in { "desk", "chair", "board", "floor", "wall", "pillar" } do
			templates[name] = loadMeshTemplate(Art.lobbyMeshId(name), name)
		end
		local loaded = 0
		for _ in templates do
			loaded += 1
		end
		applyLobbyMeshes(folder, floorPart, wallParts)
		for _, t in tables do
			applyTableMeshes(t)
		end
		local unknown = loadMeshTemplate(Art.meshId("unknown"), "Unknown")
		if unknown then
			unknown.Size = Vector3.new(0.44, 0.42, 0.44)
			unknown.CanQuery = true
			unknown.Parent = tplFolder
		end
		print(("[DD] 로비 메시 적용: %d/6 · 공통 덮개 %s"):format(loaded, unknown and "OK" or "없음(2D 폴백)"))
	end)
end

function Lobby.onSeated(fn)
	seatedCb = fn
end

function Lobby.onVacated(fn)
	vacatedCb = fn
end

function Lobby.onStartPrompt(fn) -- fn(player, tableId)
	startCb = fn
end

function Lobby.setStartPrompt(id, enabled)
	local t = tables[id]
	if t and t.startPrompt then
		t.startPrompt.Enabled = enabled == true
	end
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
	if not hum then
		return
	end
	pcall(function()
		hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, true)
	end)
	-- Seat 는 SeatWeld 로 붙잡는다 — Sit=false 로 풀고, 남은 weld 가 있으면 직접 제거한 뒤 살짝 점프시켜 확실히 떼어낸다
	local seatPart = hum.SeatPart -- SeatWeld 는 의자 파트의 자식으로 생긴다
	hum.Sit = false
	if seatPart then
		local w = seatPart:FindFirstChild("SeatWeld")
		if w then
			w:Destroy()
		end
	end
	task.defer(function()
		pcall(function()
			hum.Jump = true
			hum:ChangeState(Enum.HumanoidStateType.Jumping)
		end)
	end)
end

return Lobby
