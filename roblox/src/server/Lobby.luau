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
-- signpost: Earth 가 앞면 -Z 로 납품했고 배치 CFrame 이 이미 스폰을 향하므로 보정 0.
-- (Earth 인계서 4장: 의자의 180도 보정을 간판에 그대로 복사하지 말 것 — Studio 에서 정면을 확인한다)
local MESH_YAW = { desk = 0, chair = math.pi, board = math.pi, floor = 0, wall = math.pi, pillar = 0, bot = 0, signpost = 0 }
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
	bot = Vector3.new(1.8, 3.2, 1.8), -- 착석 자세 로봇 (earth-ai-window-request.md #7)
	signpost = Vector3.new(4, 4.6, 0.35), -- 튜토리얼 간판 (earth-tutorial-request.md · 밑단 피벗 · bbox 중심 (0,2.3,0))
}
local MESH_TEX = { desk = "desk_albedo", chair = "chair_albedo", board = "board_grid", floor = "floor_tile", wall = "wall_albedo", pillar = "pillar_albedo", bot = "bot_albedo", signpost = "signpost_albedo" }

local tables = {} -- [id] = { model, desk, board, seats = {A=Seat,B=Seat}, status, occupants = {A=Player?,B=Player?}, holds = {A=userId|true,..}, bots = {..}, startPrompt }
local seatedCb, vacatedCb, startCb = nil, nil, nil
local templates = {} -- [name] = MeshPart 템플릿 (로드 성공분)

--==================================================================
-- 좌석 권한 상태 (서버 판정)
-- Occupant 프로퍼티·ProximityPrompt.Enabled 는 근거로 쓰지 않는다: 프롬프트는 클라이언트가 부를 수 있고,
-- 연결이 끊기면 캐릭터가 사라져 Occupant 가 먼저 nil 이 된다. 자리 상태는 서버가 셋으로 들고 판정한다.
--   occupants[side] = 서버가 인정한 착석자 · holds[side] = 재접속 예약(UserId · true 면 모두 금지) · bots[side] = AI 더미
--==================================================================
local LOCK_ATTR = "DigitDualSeatLocked" -- 점프 잠금 권위 값: 서버 전용 SetStateEnabled 는 복제되지 않아 클라이언트가 이 속성을 보고 로컬 잠금을 건다

local function isPlayer(p)
	return typeof(p) == "Instance" and p:IsA("Player")
end

local function promptOf(seat)
	return seat and seat:FindFirstChildOfClass("ProximityPrompt") or nil
end

-- 앉기 프롬프트는 자리 상태에서 파생된다 (각 지점에서 직접 켜고 끄지 않는다)
local function refreshPrompt(t, side)
	local seat = t and t.seats[side]
	local prompt = promptOf(seat)
	if prompt then
		prompt.Enabled = t.occupants[side] == nil and t.holds[side] == nil and t.bots[side] == nil and seat.Occupant == nil
	end
end

-- 이 사람이 자리를 차지할 수 있는가. 예약된 자리는 예약자 본인만 통과한다 (원래 사용자의 재접속은 막지 않는다)
local function canClaim(t, side, player)
	if not (t and t.seats[side] and isPlayer(player)) then
		return false
	end
	if t.bots[side] ~= nil then
		return false
	end
	local hold = t.holds[side]
	if hold ~= nil and hold ~= player.UserId then
		return false
	end
	local occ = t.occupants[side]
	if occ ~= nil and occ ~= player then
		return false
	end
	local hum = t.seats[side].Occupant
	if hum and Players:GetPlayerFromCharacter(hum.Parent) ~= player then
		return false
	end
	return true
end

-- 점프 잠금 적용: 권위 값은 플레이어 속성이고, 서버 쪽 Humanoid 상태도 함께 맞춘다 (양보하지 않는다)
local function applyJumpLock(player, hum)
	if not isPlayer(player) then
		return
	end
	local locked = player:GetAttribute(LOCK_ATTR) == true
	if not hum then
		local char = player.Character
		hum = char and char:FindFirstChildOfClass("Humanoid")
	end
	if hum then
		pcall(function()
			hum:SetStateEnabled(Enum.HumanoidStateType.Jumping, not locked)
		end)
	end
end

local function watchPlayer(player)
	player.CharacterAdded:Connect(function(char)
		task.spawn(function() -- 리스폰: Humanoid 가 붙은 뒤 현재 속성 상태를 새 캐릭터에 다시 적용한다
			local hum = char:FindFirstChildOfClass("Humanoid") or char:WaitForChild("Humanoid", 5)
			if hum and player.Parent then
				applyJumpLock(player, hum)
			end
		end)
	end)
end
for _, p in Players:GetPlayers() do
	watchPlayer(p)
end
Players.PlayerAdded:Connect(watchPlayer)

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
		local t = tables[id] -- prompt.Enabled 가 아니라 서버 자리 상태로 판정한다 (예약·봇 자리 가로채기 차단)
		if not t or not canClaim(t, side, player) then
			if t then
				refreshPrompt(t, side) -- 어긋난 프롬프트 상태를 되돌린다
			end
			return
		end
		local char = player.Character
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		if hum and hum.Health > 0 and not hum.Sit then
			seat:Sit(hum) -- 최종 승인은 buildTable 의 Occupant 감시가 한다
		end
	end)
	-- 프롬프트 표시·착석 승인은 buildTable 의 좌석 감시가 함께 처리한다 (권한 상태 t 가 필요)
	return seat, { back, legs }
end

-- 테이블 머리 위 상태 팻말(BillboardGui). 로비 튜토리얼 간판은 buildTutorialSign 이다 — 이름을 겹치지 말 것.
-- (2026-09-11: 겹쳤다가 아래 호출이 나중 선언을 집어 model.Parent 에 숫자가 들어갔다 — 로비가 통째로 죽는다)
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

-- 📖 튜토리얼 간판 — 스폰(0,·,48)에서 테이블(z ≤ 5)로 걸어가는 길목에 세워 **입장하자마자 보이게** 한다 (CJ 2026-09-11).
-- 메시(signpost)는 Earth 납품 대기 — 없으면 아래 Part 조합(판 + 기둥)이 그대로 쓰인다. 판 앞면은 글자를 굽지 않고
-- SurfaceGui 로 띄운다 — 나중에 문구를 바꾸거나 번역할 수 있어야 한다 (earth-tutorial-request.md).
local SIGN_POS = Vector3.new(0, 0, 40)
local signParts = nil -- buildTutorialSign 이 채우고 applyLobbyMeshes 가 메시로 바꿔 끼운다
local function buildTutorialSign(parent)
	local model = Instance.new("Model")
	model.Name = "TutorialSign"
	local face = CFrame.lookAt(SIGN_POS, SIGN_POS + Vector3.new(0, 0, 1)) -- 스폰(+Z) 쪽을 바라본다
	local post = part({
		Name = "Post", Size = Vector3.new(0.35, 2.4, 0.35), Color = Color3.fromRGB(96, 68, 44),
		Material = Enum.Material.Wood, CFrame = face * CFrame.new(0, 1.2, 0),
	}, model)
	local board = part({
		Name = "Board", Size = Vector3.new(4, 2.2, 0.25), Color = Color3.fromRGB(140, 104, 66),
		Material = Enum.Material.WoodPlanks, CFrame = face * CFrame.new(0, 3.5, 0),
	}, model)
	post.CanCollide = true
	board.CanCollide = true
	-- 보이는 몸통(메시)과 **글자를 받는 판**을 나눈다. 간판 전체 MeshPart 에 SurfaceGui 를 붙이면
	-- 글자가 기둥까지 포함한 bbox 에 펼쳐진다 (Earth 인계서 4장). Board 는 프롬프트·글자 캐리어로 남긴다.
	signParts = { model = model, post = post, board = board, face = face }
	local sg = Instance.new("SurfaceGui")
	sg.Face = Enum.NormalId.Front -- 판의 +Z 면. face 가 이미 스폰을 향하게 돌려 뒀다
	sg.CanvasSize = Vector2.new(400, 220)
	sg.AlwaysOnTop = false
	sg.Parent = board
	local panel = Art.ui("panel_sign") -- 있으면 글자 바탕을 깔아 나무결 위에서도 읽히게 한다
	if panel then
		local bg = Instance.new("ImageLabel")
		bg.Size = UDim2.fromScale(1, 1)
		bg.BackgroundTransparency = 1
		bg.Image = panel
		bg.ScaleType = Enum.ScaleType.Slice
		bg.SliceCenter = Rect.new(12, 12, 116, 52) -- 원본 중앙 사각형 좌표 (여백값이 아니다)
		bg.SliceScale = 1
		bg.ResampleMode = Enum.ResamplerMode.Pixelated
		bg.Parent = sg
	end
	local txt = Instance.new("TextLabel")
	txt.Size = UDim2.new(1, -28, 1, -24)
	txt.Position = UDim2.new(0, 14, 0, 12)
	txt.BackgroundTransparency = 1
	txt.Text = "📖 게임 방법\n\n[E] 눌러서 보기"
	txt.TextScaled = true
	txt.Font = Enum.Font.GothamBold
	-- 패널 중앙이 어두워 검은 글씨는 묻힌다 (Earth 인계서 3장) — 밝은 색으로 둔다
	txt.TextColor3 = Color3.fromRGB(232, 236, 245)
	txt.TextStrokeTransparency = 0.4
	txt.Parent = sg
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "튜토리얼 보기"
	prompt.ObjectText = "게임 방법"
	prompt.KeyboardKeyCode = Enum.KeyCode.E
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.Parent = board
	model.Parent = parent
	return model
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
		status = status, occupants = {}, holds = {}, bots = {}, startPrompt = startPrompt,
	}
	for side, seat in t.seats do
		seat:GetPropertyChangedSignal("Occupant"):Connect(function()
			local hum = seat.Occupant
			local prev = t.occupants[side]
			if hum then
				local plr = Players:GetPlayerFromCharacter(hum.Parent)
				if not (plr and canClaim(t, side, plr)) then -- 예약·봇·타인 자리에 앉으면 즉시 일으켜 세운다 (onSeated 도 알리지 않는다)
					pcall(function()
						hum.Sit = false
					end)
					refreshPrompt(t, side)
					return
				end
				if plr ~= prev then
					t.occupants[side] = plr
					t.holds[side] = nil -- 예약자 본인이 돌아와 앉았다
					if seatedCb then
						seatedCb(plr, id, side)
					end
				end
			elseif prev then
				t.occupants[side] = nil
				-- 연결이 끊기면 캐릭터가 사라져 Occupant 가 nil 이 된다. 이 신호로 자리를 해제하면 재접속 예약이 풀리므로,
				-- 이미 나간 사람·예약 중인 자리는 PlayerRemoving 쪽 판단에 맡긴다 (오래된 콜백 방어)
				if t.holds[side] == nil and isPlayer(prev) and prev.Parent ~= nil and vacatedCb then
					vacatedCb(prev, id, side)
				end
			end
			refreshPrompt(t, side)
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
	if signParts then -- 튜토리얼 간판: 몸통만 메시로 바꾸고 글자·프롬프트 캐리어(Board)는 그대로 둔다
		-- MeshPart 의 CFrame 은 **bbox 중심**이다. 밑단 피벗 기준 (0,2.3,0) 만큼 올려 바닥에 세운다
		if placeMesh("signpost", signParts.face * CFrame.new(0, 2.3, 0), signParts.model) then
			hide(signParts.post)
			hide(signParts.board)
			signParts.post.CanCollide = false -- 충돌은 Board 하나로 (메시와 이중으로 두지 않는다)
		end
	end
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
	buildTutorialSign(folder)
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
		for _, name in { "desk", "chair", "board", "floor", "wall", "pillar", "bot", "signpost" } do
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

-- 봇 좌석 표시: label 이 있으면 의자 위에 더미(몸통·머리·이름표)를 세우고 앉기 프롬프트를 끈다. nil 이면 제거
-- (Earth 봇 메시가 오면 placeMesh 로 교체 — docs/roblox/earth-ai-window-request.md)
local BOT_TINT = { grade5 = Color3.fromRGB(0x8e, 0xb2, 0xff), dan5 = Color3.fromRGB(0xff, 0xcf, 0x82) } -- ai-window-README 예시 색
function Lobby.setBotSeat(id, side, label, level)
	local t = tables[id]
	if not t or not t.seats[side] then
		return false
	end
	if label and (t.occupants[side] ~= nil or t.holds[side] ~= nil) then
		return false -- 사람이 앉아 있거나 재접속 예약된 자리에는 봇을 앉히지 않는다
	end
	local seat = t.seats[side]
	if t.bots[side] then
		t.bots[side]:Destroy()
		t.bots[side] = nil
	end
	if label then
		local m = Instance.new("Model")
		m.Name = "Bot" .. side
		local tint = BOT_TINT[level or "grade5"] or BOT_TINT.grade5 -- 난이도 색 (좌석 팀색과 별개 — 배지·텍스트 병기)
		local head
		if templates.bot then
			-- Earth 납품 로봇 메시: MeshPart 는 외접 상자 중심 기준이라 hip 피벗(좌석 윗면 +0.25)에 상자 중심 오프셋 (0,0.6,-0.45) 을 더한다 (ai-window-README)
			local mesh = placeMesh("bot", seat.CFrame * CFrame.new(0, 0.85, -0.45), m, tint)
			head = mesh
		else -- 임시 더미: 몸통·머리·네온 눈
			local body = part({ Name = "Body", Size = Vector3.new(1.6, 1.9, 0.9), CFrame = seat.CFrame * CFrame.new(0, 1.2, 0),
				Color = tint, Material = Enum.Material.Metal, CanCollide = false }, m)
			body.CanTouch = false
			head = part({ Name = "Head", Size = Vector3.new(1.1, 1.1, 1.1), CFrame = seat.CFrame * CFrame.new(0, 2.75, 0),
				Color = Color3.fromRGB(225, 228, 236), Material = Enum.Material.Metal, CanCollide = false }, m)
			head.CanTouch = false
			local eye = part({ Name = "Eye", Size = Vector3.new(0.8, 0.25, 0.1), CFrame = head.CFrame * CFrame.new(0, 0.1, -0.56),
				Color = Color3.fromRGB(91, 200, 255), Material = Enum.Material.Neon, CanCollide = false }, m)
			eye.CanTouch = false
		end
		local bb = Instance.new("BillboardGui")
		bb.Name = "Tag"
		bb.Size = UDim2.new(0, 170, 0, 30)
		bb.StudsOffset = Vector3.new(0, 1.4, 0)
		bb.AlwaysOnTop = true
		bb.MaxDistance = 60
		bb.Adornee = head
		local badge = Art.badge and Art.badge((level == "dan5") and "ai_dan5" or "ai_grade5") or nil -- 난이도 배지 (글자는 런타임 텍스트로 병기)
		if badge then
			local bi = Instance.new("ImageLabel")
			bi.Size = UDim2.new(0, 24, 0, 24)
			bi.Position = UDim2.new(0, 3, 0, 3)
			bi.BackgroundTransparency = 1
			bi.Image = badge
			bi.ScaleType = Enum.ScaleType.Fit
			bi.ResampleMode = Enum.ResamplerMode.Pixelated
			bi.ZIndex = 2
			bi.Parent = bb
		end
		local tl = Instance.new("TextLabel")
		tl.Size = UDim2.new(1, badge and -30 or 0, 1, 0)
		tl.Position = UDim2.new(0, badge and 30 or 0, 0, 0)
		tl.BackgroundColor3 = Color3.fromRGB(19, 22, 30)
		tl.BackgroundTransparency = 0.25
		tl.BorderSizePixel = 0
		tl.TextColor3 = Color3.fromRGB(232, 236, 245)
		tl.TextSize = 14
		tl.Font = Enum.Font.GothamBold
		tl.Text = label
		tl.Parent = bb
		bb.Parent = head
		m.Parent = t.model
		t.bots[side] = m
	end
	refreshPrompt(t, side)
	return true
end

-- 재접속(Phase 4): 끊긴 사람의 자리를 비워 두되 다른 사람이 앉지 못하게 잠근다.
-- userId 를 주면 그 사람만 다시 앉을 수 있다 (원래 사용자의 복귀는 막지 않는다). 없으면 모두 금지
function Lobby.setSeatHold(id, side, held, userId)
	local t = id and tables[id] or nil
	if not t or not side or not t.seats[side] then
		return false
	end
	if held then
		t.holds[side] = userId or true
		t.occupants[side] = nil -- 캐릭터가 사라지기 전에 착석자를 지운다 → 뒤늦은 Occupant nil 신호가 자리를 해제하지 못한다
	else
		t.holds[side] = nil
	end
	refreshPrompt(t, side)
	return true
end

-- 재접속한 사람을 그 자리에 다시 앉힌다 (예약자 본인만 통과)
function Lobby.sitPlayer(id, side, player)
	local t = tables[id]
	if not t then
		return false
	end
	local seat = t.seats[side]
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not (seat and hum and hum.Health > 0) then
		return false
	end
	if not canClaim(t, side, player) then -- 그 사이 자리가 넘어갔으면 앉히지 않는다
		return false
	end
	local prevHold, prevOcc = t.holds[side], t.occupants[side] -- 실패하면 되돌릴 이전 상태
	t.holds[side] = nil
	t.occupants[side] = player -- Occupant 신호로 onSeated 가 다시 불리지 않도록 먼저 채운다
	pcall(function()
		seat:Sit(hum)
	end)
	if seat.Occupant ~= hum then -- 실제 좌석 점유자가 대상이 아니면 성공이 아니다 (Sit 이 조용히 실패한 경우 포함)
		t.holds[side] = prevHold -- 예약과 논리적 점유를 원상복구해 제3자가 빈 자리를 채가지 못하게 한다
		t.occupants[side] = prevOcc
		refreshPrompt(t, side)
		return false
	end
	refreshPrompt(t, side)
	return true
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

-- 자리 권한 상태 스냅샷 (진단·회귀 확인용 — 읽기 전용)
function Lobby.seatInfo(id, side)
	local t = tables[id]
	if not t or not t.seats[side] then
		return nil
	end
	return {
		occupant = t.occupants[side],
		hold = t.holds[side],
		bot = t.bots[side] ~= nil,
		sitting = t.seats[side].Occupant ~= nil,
		prompt = (promptOf(t.seats[side]) and promptOf(t.seats[side]).Enabled) == true,
	}
end

-- 대전 중 실수로 일어나는 것 방지 (점프 = 기립). 종료 시 해제.
-- 서버에서만 건 SetStateEnabled 는 소유권이 클라이언트에 있는 캐릭터에 복제되지 않는다 →
-- 권위 값을 플레이어 속성으로 게시하고, 클라이언트가 이 속성을 보고 로컬 점프 잠금을 건다
function Lobby.lockSeated(player, locked)
	if not isPlayer(player) then -- 봇(테이블)·nil 방어
		return
	end
	player:SetAttribute(LOCK_ATTR, locked == true)
	applyJumpLock(player)
end

function Lobby.standUp(player)
	Lobby.lockSeated(player, false) -- 속성·서버 상태를 함께 푼다 (점프로 일어날 수 있어야 한다)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not hum then
		return
	end
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
