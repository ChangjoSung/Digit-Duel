--!nonstrict
-- init.client.luau — Digit Dual Roblox 클라이언트 (Phase 2b: 판 위 대국 + 납품 아트)
-- 구조:
--   로비 HUD(왼쪽 위) · 테이블 패널(앉았을 때, 중앙) · 사이드 패널(대전 중, 오른쪽) · 전투 패널(중앙) · 2D 보드(폴백, 왼쪽)
--   판 위 대국: 앉으면 카메라가 판을 향하고, 서버가 보내준 뷰어 필터 상태(view.board)로 **이 클라이언트에만** 말을 로컬 생성한다.
--     공개 말 = 도트 빌보드(하수인 icon64 / 토큰 64 팀 틴트) · 미공개 말 = 공통 덮개 메시(팀 틴트) · 모든 말 아래 팀 색 받침
--     → 숨은 정보는 서버가 애초에 보내지 않으므로 로컬 인스턴스에 새어 나갈 정체가 없다 (인계서 §6)
--   입력: 판(Board 파트)·로컬 말을 raycast 로 맞혀 셀(r,c) → onCell (2D 보드 클릭과 같은 경로)
--   판 파트가 없거나 [2D 보드] 를 켜면 기존 2D 보드 GUI 로 폴백한다.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local StarterGui = game:GetService("StarterGui")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local CLIENT_VERSION = "0.5.0-p2b.1"

local Shared = ReplicatedStorage:WaitForChild("Shared")
local remotes = ReplicatedStorage:WaitForChild("DDRemotes")
local reAction = remotes:WaitForChild("Action")
local reState = remotes:WaitForChild("State")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- 아바타는 로비를 걸어 다니지만 체력바·가방은 게임과 무관 → 숨김. 채팅·이모트·플레이어 목록은 유지 (로비 상호작용)
task.defer(function()
	for _, ct in { Enum.CoreGuiType.Health, Enum.CoreGuiType.Backpack } do
		pcall(function()
			StarterGui:SetCoreGuiEnabled(ct, false)
		end)
	end
end)

--==================================================================
-- 진단 푸터 — 스크립트 진행·서버 응답을 화면에 표시 (팀 테스트 문제 진단용)
--==================================================================
local diagGui = Instance.new("ScreenGui")
diagGui.Name = "DigitDualDiag"
diagGui.ResetOnSpawn = false
diagGui.DisplayOrder = 10
diagGui.Parent = playerGui
local footer = Instance.new("TextLabel")
footer.Size = UDim2.new(1, 0, 0, 18)
footer.Position = UDim2.new(0, 0, 1, -18)
footer.BackgroundTransparency = 1
footer.TextColor3 = Color3.fromRGB(154, 163, 184)
footer.TextSize = 12
footer.Font = Enum.Font.Gotham
footer.TextXAlignment = Enum.TextXAlignment.Right
footer.Parent = diagGui
local DIAG = { server = "서버 확인 중…", modules = false, ui = false, board = "" }
local function refreshFooter()
	footer.Text = ("client v%s · %s%s%s%s"):format(CLIENT_VERSION, DIAG.server, DIAG.modules and " · 모듈 OK" or "", DIAG.ui and " · UI OK" or "", DIAG.board)
end
refreshFooter()
reState.OnClientEvent:Connect(function(msg)
	if type(msg) == "table" and msg.t == "hello" then
		DIAG.server = ("server v%s 연결됨 · 접속 %d명"):format(tostring(msg.version), msg.players or 0)
		refreshFooter()
	end
end)
reAction:FireServer({ t = "ping" })

-- 모듈은 복제가 끝난 뒤에 읽는다 (실서버에서 Shared 자식이 늦게 올 수 있다)
local Data = require(Shared:WaitForChild("Data"))
local Art = require(Shared:WaitForChild("Art"))
DIAG.modules = true
refreshFooter()

local COLS, ROWS = 7, 13
local CELL = 34
local CELL_STUD = 0.6
local WHITE = Color3.new(1, 1, 1)

-- 현재 상태
local view = nil -- 서버 필터 뷰 (대전 중)
local tableInfo = nil -- 서버 "table" 메시지 (앉았을 때)
local selectedId = nil
local teleFirst = nil
local logLines = {}
local force2D = false
local boardMode = "2d" -- render() 가 판 파트 유무로 결정
local render -- 전방 선언 (renderButtons 등이 참조)

--==================================================================
-- UI 구성
--==================================================================

local function mk(class, props, parent)
	local o = Instance.new(class)
	for k, v in props do
		o[k] = v
	end
	o.Parent = parent
	return o
end

local gui = mk("ScreenGui", { Name = "DigitDual", ResetOnSpawn = false, IgnoreGuiInset = true }, playerGui)

-- 로비 HUD
local hud = mk("Frame", {
	Size = UDim2.new(0, 460, 0, 92), Position = UDim2.new(0, 12, 0, 12),
	BackgroundColor3 = Color3.fromRGB(19, 22, 30), BackgroundTransparency = 0.15, BorderSizePixel = 0,
}, gui)
mk("TextLabel", {
	Text = "Digit Dual", Size = UDim2.new(1, -16, 0, 24), Position = UDim2.new(0, 8, 0, 4),
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 18, Font = Enum.Font.GothamBold,
	TextXAlignment = Enum.TextXAlignment.Left,
}, hud)
local hudLabel = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -16, 0, 40), Position = UDim2.new(0, 8, 0, 28),
	TextColor3 = Color3.fromRGB(180, 188, 205), BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true,
}, hud)
local standBtn = mk("TextButton", {
	Text = "🪑 자리 떠나기", Size = UDim2.new(0, 110, 0, 22), Position = UDim2.new(1, -118, 0, 4), Visible = false,
	TextColor3 = WHITE, BackgroundColor3 = Color3.fromRGB(120, 60, 60), TextSize = 12, Font = Enum.Font.GothamBold,
}, hud)
local modeBtn = mk("TextButton", {
	Text = "2D 보드", Size = UDim2.new(0, 70, 0, 22), Position = UDim2.new(1, -196, 0, 4), Visible = false,
	TextColor3 = WHITE, BackgroundColor3 = Color3.fromRGB(60, 68, 88), TextSize = 12, Font = Enum.Font.GothamBold,
}, hud)

-- 테이블 패널 (앉았을 때)
local tablePanel = mk("Frame", {
	Size = UDim2.new(0, 380, 0, 150), Position = UDim2.new(0.5, -190, 1, -170), Visible = false,
	BackgroundColor3 = Color3.fromRGB(24, 27, 37), BackgroundTransparency = 0.1, BorderSizePixel = 0,
}, gui)
local tableTitle = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -16, 0, 26), Position = UDim2.new(0, 8, 0, 6),
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 16, Font = Enum.Font.GothamBold,
	TextXAlignment = Enum.TextXAlignment.Left,
}, tablePanel)
local tableLabel = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -16, 0, 56), Position = UDim2.new(0, 8, 0, 34),
	TextColor3 = Color3.fromRGB(180, 188, 205), BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true,
}, tablePanel)
local readyBtn = mk("TextButton", {
	Text = "배치 완료 (무작위 배치)", Size = UDim2.new(0, 200, 0, 34), Position = UDim2.new(0, 8, 1, -42),
	TextColor3 = WHITE, BackgroundColor3 = Color3.fromRGB(91, 140, 255), TextSize = 14, Font = Enum.Font.GothamBold,
}, tablePanel)
local unreadyBtn = mk("TextButton", {
	Text = "배치 취소", Size = UDim2.new(0, 100, 0, 34), Position = UDim2.new(0, 216, 1, -42), Visible = false,
	TextColor3 = WHITE, BackgroundColor3 = Color3.fromRGB(60, 68, 88), TextSize = 14, Font = Enum.Font.GothamBold,
}, tablePanel)

-- 대전 화면 (배경 투명 — 3D 판이 보인다)
local game_ = mk("Frame", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false }, gui)

-- 2D 보드 (폴백)
local boardFrame = mk("Frame", {
	Size = UDim2.new(0, COLS * CELL, 0, ROWS * CELL), Position = UDim2.new(0, 20, 0, 116),
	BackgroundColor3 = Color3.fromRGB(30, 34, 46), Visible = false,
}, game_)
local cells = {} -- [dispRow][c] = TextButton
for dr = 1, ROWS do
	cells[dr] = {}
	for c = 1, COLS do
		local b = mk("TextButton", {
			Size = UDim2.new(0, CELL - 2, 0, CELL - 2), Position = UDim2.new(0, (c - 1) * CELL + 1, 0, (dr - 1) * CELL + 1),
			Text = "", TextSize = 12, Font = Enum.Font.Gotham, TextColor3 = WHITE,
			BackgroundColor3 = Color3.fromRGB(43, 49, 64), BorderSizePixel = 0,
		}, boardFrame)
		mk("ImageLabel", {
			Name = "Icon", Size = UDim2.new(1, -4, 1, -4), Position = UDim2.new(0, 2, 0, 2), BackgroundTransparency = 1,
			ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResampleMode.Pixelated, Visible = false, ZIndex = 2,
		}, b)
		mk("TextLabel", {
			Name = "Hp", Size = UDim2.new(1, -2, 0, 12), Position = UDim2.new(0, 0, 1, -12), BackgroundTransparency = 1,
			Text = "", TextSize = 10, Font = Enum.Font.GothamBold, TextColor3 = WHITE, TextStrokeTransparency = 0.2,
			TextXAlignment = Enum.TextXAlignment.Right, Visible = false, ZIndex = 3,
		}, b)
		mk("TextLabel", {
			Name = "Mark", Size = UDim2.new(0, 14, 0, 12), Position = UDim2.new(0, 1, 0, 0), BackgroundTransparency = 1,
			Text = "🔍", TextSize = 10, Font = Enum.Font.Gotham, TextColor3 = WHITE, Visible = false, ZIndex = 3,
		}, b)
		cells[dr][c] = b
	end
end

-- 사이드 패널 (오른쪽)
local side = mk("Frame", {
	Size = UDim2.new(0, 360, 0, ROWS * CELL), Position = UDim2.new(1, -372, 0, 116),
	BackgroundColor3 = Color3.fromRGB(24, 27, 37), BackgroundTransparency = 0.08, BorderSizePixel = 0,
}, game_)
local infoLabel = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -16, 0, 150), Position = UDim2.new(0, 8, 0, 8),
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 14, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true, RichText = true,
}, side)
local btnRow = mk("Frame", { Size = UDim2.new(1, -16, 0, 100), Position = UDim2.new(0, 8, 0, 160), BackgroundTransparency = 1 }, side)
local logBox = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -16, 1, -390), Position = UDim2.new(0, 8, 0, 270),
	TextColor3 = Color3.fromRGB(180, 188, 205), BackgroundColor3 = Color3.fromRGB(19, 22, 30), TextSize = 12,
	Font = Enum.Font.Gotham, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Bottom, TextWrapped = true,
}, side)
local promptFrame = mk("Frame", {
	Size = UDim2.new(1, -16, 0, 110), Position = UDim2.new(0, 8, 1, -118), BackgroundColor3 = Color3.fromRGB(35, 40, 54), Visible = false,
}, side)
local promptLabel = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -12, 0, 40), Position = UDim2.new(0, 6, 0, 4),
	TextColor3 = WHITE, BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham, TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
}, promptFrame)
local promptBtns = mk("Frame", { Size = UDim2.new(1, -12, 0, 60), Position = UDim2.new(0, 6, 0, 46), BackgroundTransparency = 1 }, promptFrame)

-- 전투 패널 (중앙)
local battleFrame = mk("Frame", {
	Size = UDim2.new(0, 380, 0, 430), Position = UDim2.new(0.5, -190, 0.5, -215),
	BackgroundColor3 = Color3.fromRGB(28, 32, 44), Visible = false, ZIndex = 5,
}, game_)
local battleTop = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -120, 0, 70), Position = UDim2.new(0, 8, 0, 6), ZIndex = 5,
	TextColor3 = WHITE, BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true, RichText = true,
}, battleFrame)
local battleBottom = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -120, 0, 70), Position = UDim2.new(0, 8, 0, 80), ZIndex = 5,
	TextColor3 = WHITE, BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true, RichText = true,
}, battleFrame)
local function mkSpriteLabel(y) -- 전투 도트 (battle256 / 토큰128, Pixelated). 아트 없으면 숨김
	return mk("ImageLabel", {
		Size = UDim2.new(0, 96, 0, 96), Position = UDim2.new(1, -104, 0, y), BackgroundTransparency = 1, ZIndex = 6,
		ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResampleMode.Pixelated, Visible = false,
	}, battleFrame)
end
local spriteTop, spriteBottom = mkSpriteLabel(2), mkSpriteLabel(76)
local battleMsg = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -16, 0, 120), Position = UDim2.new(0, 8, 0, 155), ZIndex = 5,
	TextColor3 = Color3.fromRGB(255, 224, 150), BackgroundColor3 = Color3.fromRGB(19, 22, 30), TextSize = 12,
	Font = Enum.Font.Gotham, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Bottom, TextWrapped = true,
}, battleFrame)
local battleBtns = mk("Frame", { Size = UDim2.new(1, -16, 0, 140), Position = UDim2.new(0, 8, 0, 282), BackgroundTransparency = 1, ZIndex = 5 }, battleFrame)

--==================================================================
-- 헬퍼
--==================================================================

local function send(a)
	reAction:FireServer(a)
end

local function addLog(text)
	table.insert(logLines, text)
	while #logLines > 14 do
		table.remove(logLines, 1)
	end
	logBox.Text = table.concat(logLines, "\n")
end

-- #93 2D 보드용 P2 화면 행 반사 (표시 전용). 3D 판은 물리적으로 각자 자기 쪽에서 보므로 반사 없음
local function dispRow(r)
	if view and view.me == 1 then
		return ROWS + 1 - r
	end
	return r
end

local function pieceAt(r, c)
	if not view then
		return nil
	end
	for _, p in view.board do
		if p.r == r and p.c == c then
			return p
		end
	end
	return nil
end

local function pieceById(id)
	if not view then
		return nil
	end
	for _, p in view.board do
		if p.id == id then
			return p
		end
	end
	return nil
end

local function pieceLabel(p) -- 아트 없을 때의 텍스트 폴백
	if not p.known then
		return "?"
	end
	local sym = { minion = "", bomb = "💣", ally = "🤝", trap = "🪤", king = "👑" }
	if p.type == "minion" then
		return (Data.ELEM_EMO[p.element] or "") .. "\n" .. tostring(p.hp or "")
	end
	return (sym[p.type] or "?") .. (p.hp and ("\n" .. p.hp) or "")
end

-- 말 아이콘·틴트 (2D 칩·3D 빌보드 공용): 공개 하수인 = 도트 무틴트 / 공개 왕·동료·폭탄·덫 = 토큰 팀 틴트 / 미공개 = 공통 덮개 팀 틴트
local function pieceImage(p, size)
	local team = Art.TEAM[p.owner]
	if not p.known then
		return Art.token("unknown", 64), team
	end
	if p.type == "minion" then
		return Art.icon(p.rosterId), nil
	end
	return Art.token(p.type, size or 64), team
end

local function hpText(p)
	if p.known and (p.type == "minion" or p.type == "ally" or p.type == "king") and p.hp then
		return tostring(p.hp)
	end
	return nil
end

local function clearChildrenBtns(parent)
	for _, ch in parent:GetChildren() do
		ch:Destroy()
	end
end

local function smallBtn(parent, x, y, w, text, cb, color)
	local b = mk("TextButton", {
		Size = UDim2.new(0, w, 0, 26), Position = UDim2.new(0, x, 0, y), Text = text, TextSize = 12,
		Font = Enum.Font.GothamBold, TextColor3 = WHITE,
		BackgroundColor3 = color or Color3.fromRGB(60, 68, 88), ZIndex = parent.ZIndex,
	}, parent)
	b.Activated:Connect(cb)
	return b
end

-- 무작위 배치 (수동 배치 UI 는 후속) — 로스터 6종 + 11~13행 14칸
local function randomSetup()
	local rng = Random.new()
	local ids = {}
	for _, r in Data.ROSTER do
		table.insert(ids, r.id)
	end
	for i = #ids, 2, -1 do
		local j = rng:NextInteger(1, i)
		ids[i], ids[j] = ids[j], ids[i]
	end
	local roster = { ids[1], ids[2], ids[3], ids[4], ids[5], ids[6] }
	local cellsList = {}
	for r = 11, 13 do
		for c = 1, COLS do
			table.insert(cellsList, { r, c })
		end
	end
	for i = #cellsList, 2, -1 do
		local j = rng:NextInteger(1, i)
		cellsList[i], cellsList[j] = cellsList[j], cellsList[i]
	end
	local pos = {}
	for i = 1, 14 do
		pos[i] = cellsList[i]
	end
	return { roster = roster, pos = pos }
end

--==================================================================
-- 3D 판 (로컬 전용 인스턴스 — 이 클라이언트에만 존재)
--==================================================================

local local3d = Instance.new("Folder")
local3d.Name = "DDLocal"
local3d.Parent = Workspace

local function findBoardPart()
	if not tableInfo then
		return nil
	end
	local lobby = Workspace:FindFirstChild("Lobby")
	local t = lobby and lobby:FindFirstChild("Table" .. tableInfo.tableId)
	return t and t:FindFirstChild("Board") or nil
end

-- 판 로컬 좌표 계약: X=(col-4)×0.6, Z=(row-7)×0.6, 윗면 = 로컬 Y+0.1 (두께 0.2)
local function cellCFrame(bp, r, c)
	return bp.CFrame * CFrame.new((c - 4) * CELL_STUD, 0.1, (r - 7) * CELL_STUD)
end

local function tagCell(inst, r, c)
	inst:SetAttribute("r", r)
	inst:SetAttribute("c", c)
	inst.Anchored = true
	inst.CanCollide = false
	inst.CanTouch = false
	inst.CanQuery = true
	inst.Parent = local3d
	return inst
end

local function mkBase(cf, color, r, c) -- 팀 색 받침 (모든 말 공통 — 미공개 말도 같은 받침)
	local p = Instance.new("Part")
	p.Name = "Base"
	p.Size = Vector3.new(0.52, 0.04, 0.52)
	p.CFrame = cf * CFrame.new(0, 0.02, 0)
	p.Color = color
	p.Material = Enum.Material.SmoothPlastic
	return tagCell(p, r, c)
end

local function mkBillboard(cf, r, c, sizeStud)
	local anchor = Instance.new("Part")
	anchor.Name = "Piece"
	anchor.Size = Vector3.new(0.5, 0.5, 0.5)
	anchor.Transparency = 1
	anchor.CFrame = cf * CFrame.new(0, 0.32, 0)
	tagCell(anchor, r, c)
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromScale(sizeStud or 0.62, sizeStud or 0.62)
	bb.LightInfluence = 0
	bb.AlwaysOnTop = false
	bb.Parent = anchor
	return anchor, bb
end

local function mkSprite(cf, image, tint, hp, r, c)
	local anchor, bb = mkBillboard(cf, r, c)
	local img = Instance.new("ImageLabel")
	img.Size = UDim2.fromScale(1, 1)
	img.BackgroundTransparency = 1
	img.Image = image
	img.ScaleType = Enum.ScaleType.Fit
	img.ResampleMode = Enum.ResampleMode.Pixelated
	img.ImageColor3 = tint or WHITE
	img.Parent = bb
	if hp then
		local t = Instance.new("TextLabel")
		t.Size = UDim2.new(1, 0, 0.3, 0)
		t.Position = UDim2.new(0, 0, 0.76, 0)
		t.BackgroundTransparency = 1
		t.Text = hp
		t.TextScaled = true
		t.Font = Enum.Font.GothamBold
		t.TextColor3 = WHITE
		t.TextStrokeTransparency = 0.2
		t.Parent = bb
	end
	return anchor
end

local function mkTextSprite(cf, text, color, r, c)
	local anchor, bb = mkBillboard(cf, r, c)
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Text = text
	t.TextScaled = true
	t.Font = Enum.Font.GothamBold
	t.TextColor3 = color or WHITE
	t.TextStrokeTransparency = 0.2
	t.Parent = bb
	return anchor
end

local function unknownTemplate()
	local f = ReplicatedStorage:FindFirstChild("DDTemplates")
	return f and f:FindFirstChild("Unknown") or nil
end

local function mkUnknown(cf, color, r, c)
	local tpl = unknownTemplate()
	if tpl then
		local m = tpl:Clone()
		m.Name = "Piece"
		m.CFrame = cf * CFrame.new(0, 0.21, 0) -- 외접 상자 중심 = 바닥 +0.21
		m.Color = color
		return tagCell(m, r, c)
	end
	local u = Art.token("unknown", 64)
	if u then
		return mkSprite(cf, u, color, nil, r, c)
	end
	local p = Instance.new("Part") -- 최종 폴백: 단색 블록
	p.Name = "Piece"
	p.Size = Vector3.new(0.44, 0.42, 0.44)
	p.CFrame = cf * CFrame.new(0, 0.21, 0)
	p.Color = color
	return tagCell(p, r, c)
end

local function mkHighlight(cf, color, r, c, transparency)
	local p = Instance.new("Part")
	p.Name = "Hl"
	p.Size = Vector3.new(0.58, 0.02, 0.58)
	p.CFrame = cf * CFrame.new(0, 0.01, 0)
	p.Color = color
	p.Material = Enum.Material.Neon
	p.Transparency = transparency or 0.45
	return tagCell(p, r, c)
end

local HL = { sel = Color3.fromRGB(255, 220, 80), forced = Color3.fromRGB(255, 70, 70), flee = Color3.fromRGB(80, 140, 255) }

local function sync3D()
	local3d:ClearAllChildren()
	local bp = findBoardPart()
	if not bp or not view then
		return
	end
	local forced = view.forcedTargets or {}
	for _, p in view.board do
		local cf = cellCFrame(bp, p.r, p.c)
		local team = Art.TEAM[p.owner]
		mkBase(cf, team, p.r, p.c)
		if p.known then
			local img, tint = pieceImage(p, 64)
			if img then
				mkSprite(cf, img, tint, hpText(p), p.r, p.c)
			else
				mkTextSprite(cf, pieceLabel(p), team, p.r, p.c)
			end
		else
			mkUnknown(cf, team, p.r, p.c)
		end
		if p.id == selectedId or p.id == teleFirst then
			mkHighlight(cf, HL.sel, p.r, p.c)
		end
		if table.find(forced, p.id) then
			mkHighlight(cf, HL.forced, p.r, p.c, 0.3)
		end
		if view.fleePick and table.find(view.fleePick.cands, p.id) then
			mkHighlight(cf, HL.flee, p.r, p.c)
		end
	end
	for _, tr in view.traces do -- 탐색 가능 흔적
		local cf = cellCFrame(bp, tr.r, tr.c)
		if not pieceAt(tr.r, tr.c) then
			mkHighlight(cf, Color3.fromRGB(255, 255, 255), tr.r, tr.c, 0.7)
		end
		mkTextSprite(cf * CFrame.new(0.18, 0.25, -0.18), "🔍", WHITE, tr.r, tr.c)
	end
end

local function setBoardCamera(on)
	local cam = Workspace.CurrentCamera
	if not cam then
		return
	end
	local bp = on and findBoardPart() or nil
	if bp and tableInfo then
		local dir = (tableInfo.side == "A") and 1 or -1 -- A 는 판의 +Z 쪽에 앉는다
		cam.CameraType = Enum.CameraType.Scriptable
		local eye = (bp.CFrame * CFrame.new(0, 7.4, dir * 6.4)).Position
		local look = (bp.CFrame * CFrame.new(0, 0, dir * 0.4)).Position
		cam.CFrame = CFrame.lookAt(eye, look)
	elseif cam.CameraType == Enum.CameraType.Scriptable then
		cam.CameraType = Enum.CameraType.Custom
	end
end

local function raycastCell(pos)
	local bp = findBoardPart()
	local cam = Workspace.CurrentCamera
	if not bp or not cam then
		return nil
	end
	local ray = cam:ViewportPointToRay(pos.X, pos.Y)
	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { bp, local3d }
	local hit = Workspace:Raycast(ray.Origin, ray.Direction * 300, params)
	if not hit then
		return nil
	end
	local r, c = hit.Instance:GetAttribute("r"), hit.Instance:GetAttribute("c")
	if r and c then
		return r, c
	end
	local lp = bp.CFrame:PointToObjectSpace(hit.Position)
	c = math.floor(lp.X / CELL_STUD + 0.5) + 4
	r = math.floor(lp.Z / CELL_STUD + 0.5) + 7
	if r < 1 or r > ROWS or c < 1 or c > COLS then
		return nil
	end
	return r, c
end

--==================================================================
-- 로비 상태 표시
--==================================================================

local function renderLobby()
	setBoardCamera(tableInfo ~= nil) -- 앉아 있으면 판을 바라본다
	if view and view.phase ~= "over" then
		tablePanel.Visible = false
		standBtn.Visible = true
		hudLabel.Text = tableInfo and ("테이블 %d · ⚔️ 대전 중 (자리 떠나기 = 기권)"):format(tableInfo.tableId) or "⚔️ 대전 중"
		return
	end
	if not tableInfo then
		hudLabel.Text = "🪑 테이블 의자 앞에서 [E] 앉기 → 배치 완료 → 맞은편 상대도 배치를 마치면 대전 시작"
		standBtn.Visible = false
		modeBtn.Visible = false
		tablePanel.Visible = false
		return
	end
	local ti = tableInfo
	standBtn.Visible = true
	hudLabel.Text = ("테이블 %d · %s 자리 · %s"):format(ti.tableId, ti.side, ti.opp and ("상대: " .. ti.opp) or "상대 기다리는 중 (맞은편 의자)")
	if ti.inGame then
		tablePanel.Visible = false
		return
	end
	tablePanel.Visible = true
	tableTitle.Text = ("테이블 %d — %s 자리"):format(ti.tableId, ti.side)
	local oppLine = ti.opp and ("상대: " .. ti.opp .. (ti.oppReady and " (배치 완료)" or " (배치 중)")) or "상대 없음 — 맞은편에 누가 앉으면 시작할 수 있습니다"
	if ti.myReady then
		tableLabel.Text = oppLine .. "\n✅ 내 배치 완료 — " .. ((ti.opp and ti.oppReady) and "시작 중…" or "상대를 기다립니다")
		readyBtn.Visible = false
		unreadyBtn.Visible = true
	else
		tableLabel.Text = oppLine .. "\n배치를 마치면 준비 완료. 둘 다 완료되면 바로 대전이 시작됩니다."
		readyBtn.Visible = true
		unreadyBtn.Visible = false
	end
end

local function closeGame() -- 종료된 대국 닫기 → 로비 복귀 (앉은 채면 테이블 패널로 재대전)
	game_.Visible = false
	view = nil
	selectedId = nil
	teleFirst = nil
	local3d:ClearAllChildren()
	modeBtn.Visible = false
	renderLobby()
end

--==================================================================
-- 렌더 — 2D 보드(폴백)
--==================================================================

local function renderBoard2D()
	local forced = view.forcedTargets or {}
	for r = 1, ROWS do
		for c = 1, COLS do
			local dr = dispRow(r)
			local b = cells[dr][c]
			local zone = (r <= 3) and Color3.fromRGB(74, 46, 58) or (r >= 11) and Color3.fromRGB(47, 58, 94)
				or ((r >= 4 and r <= 5) or (r >= 9 and r <= 10)) and Color3.fromRGB(35, 66, 47)
				or Color3.fromRGB(43, 49, 64)
			b.BackgroundColor3 = zone
			b.Text = ""
			b.TextColor3 = WHITE
			b.BorderSizePixel = 0
			local icon, hpLabel, mark = b.Icon, b.Hp, b.Mark
			icon.Visible = false
			hpLabel.Visible = false
			mark.Visible = false
			local p = pieceAt(r, c)
			if p then
				local team = Art.TEAM[p.owner]
				b.TextColor3 = team
				b.BorderSizePixel = 2
				b.BorderColor3 = team
				local img, tint = pieceImage(p, 64)
				if img then
					icon.Image = img
					icon.ImageColor3 = tint or WHITE
					icon.Visible = true
					local hp = hpText(p)
					if hp then
						hpLabel.Text = hp
						hpLabel.Visible = true
					end
				else
					b.Text = pieceLabel(p)
				end
				if p.id == selectedId or p.id == teleFirst then
					b.BackgroundColor3 = Color3.fromRGB(120, 120, 40)
				end
				if table.find(forced, p.id) then
					b.BackgroundColor3 = Color3.fromRGB(160, 50, 50)
				end
				if view.fleePick and table.find(view.fleePick.cands, p.id) then
					b.BackgroundColor3 = Color3.fromRGB(50, 90, 160)
				end
			end
			for _, tr in view.traces do
				if tr.r == r and tr.c == c then
					mark.Visible = true
				end
			end
		end
	end
end

local function renderSide()
	local myTurn = view.phase == "play" and view.current == view.me
	local head = ("<b>%s</b>  턴 %d %s\n"):format(
		view.phase == "over" and "경기 종료" or (myTurn and "🟢 나의 턴" or "⏳ 상대 턴"),
		view.turnCount + 1, view.burning and "🔥BT" or "")
	if view.phase == "over" then
		local w = view.winner
		head ..= (w == view.me and "🏆 승리! " or w == -1 and "무승부 " or "패배… ")
			.. "(" .. (view.winType and Data.WINTYPE_KO[view.winType] or "") .. ")\n"
	end
	head ..= ("몬스터볼 %d · 아이템 %d개 · 전투 %d/2 · 주 행동 %s\n"):format(
		view.balls, #view.inv, view.battlesUsed, view.mainUsed and "완료" or "가능")
	if view.reserve then
		head ..= ("예비 하수인(%s) HP %d/%d\n"):format(Data.ELEM_KO[view.reserve.element], view.reserve.hp, view.reserve.maxHp)
	end
	local sel = selectedId and pieceById(selectedId)
	if sel and sel.known then
		head ..= ("선택: %s HP %s\n"):format(sel.name or Data.TYPE_KO[sel.type or ""] or "?", tostring(sel.hp or "-"))
	end
	if teleFirst then
		head ..= "🌀 텔레포트: 교환할 두 번째 말을 클릭\n"
	end
	if view.fleePick then
		head ..= "🏃 도망 성공 — 후방 말(파란 표시) 클릭으로 교환 또는 생략\n"
	end
	if view.fleeWait then
		head ..= "🛗 상대가 말을 교체 중입니다…\n"
	end
	if view.pendingWait then
		head ..= "🔒 상대 선택 대기 중…\n"
	end
	if view.forcedTargets then
		head ..= "⚔️ 강제 전투 — 빨간 대상 클릭\n"
	end
	if boardMode == "3d" then
		head ..= "판 위의 말을 클릭해 선택·이동·전투\n"
	end
	infoLabel.Text = head
end

local function renderButtons()
	clearChildrenBtns(btnRow)
	local myTurn = view.phase == "play" and view.current == view.me and not view.battle and not view.pending and not view.pendingWait
	if view.fleePick then
		smallBtn(btnRow, 0, 0, 170, "교환 생략 (그대로 밀기)", function()
			send({ t = "fleeSkip" })
		end, Color3.fromRGB(91, 140, 255))
		smallBtn(btnRow, 180, 0, 60, "기권", function()
			send({ t = "resign" })
		end, Color3.fromRGB(170, 60, 70))
		return
	end
	if not myTurn then
		if view.phase == "over" then
			smallBtn(btnRow, 0, 0, 150, "닫기 (자리로 돌아가기)", closeGame, Color3.fromRGB(91, 140, 255))
		end
		return
	end
	smallBtn(btnRow, 0, 0, 70, "탐색", function()
		if selectedId then
			send({ t = "search", id = selectedId })
		end
	end)
	smallBtn(btnRow, 76, 0, 90, teleFirst and "🌀 취소" or "🌀 텔레포트", function()
		if teleFirst then
			teleFirst = nil
		else
			teleFirst = selectedId
		end
		render()
	end)
	smallBtn(btnRow, 172, 0, 70, "🌿 회복", function()
		if selectedId then
			send({ t = "heal", id = selectedId })
		end
	end)
	smallBtn(btnRow, 0, 32, 100, "주 행동 생략", function()
		send({ t = "skipMain" })
	end)
	smallBtn(btnRow, 106, 32, 80, "턴 종료", function()
		send({ t = "endTurn" })
	end, Color3.fromRGB(91, 140, 255))
	smallBtn(btnRow, 192, 32, 60, "기권", function()
		send({ t = "resign" })
	end, Color3.fromRGB(170, 60, 70))
end

local function renderPrompt()
	local pd = view.pending
	promptFrame.Visible = pd ~= nil
	clearChildrenBtns(promptBtns)
	if not pd then
		return
	end
	if pd.kind == "vip" then
		promptLabel.Text = ("🔒 %s 출전 선택 — 본체 또는 대리 출전"):format(Data.TYPE_KO[pd.pieceType] or "")
		smallBtn(promptBtns, 0, 0, 100, "본체 출전", function()
			send({ t = "vipPick", use = "body" })
		end)
		local alt = pd.cap or pd.reserve
		if alt then
			smallBtn(promptBtns, 106, 0, 200, ("하수인(%s) HP %d/%d 대리 출전"):format(Data.ELEM_KO[alt.element], alt.hp, alt.maxHp), function()
				send({ t = "vipPick", use = "cap" })
			end, Color3.fromRGB(91, 140, 255))
		end
	elseif pd.kind == "capture" then
		promptLabel.Text = ("포획 시도 (몬스터볼 %d) — 공격 포획 실패 시 최대 HP 25%% 피해"):format(pd.balls)
		smallBtn(promptBtns, 0, 0, 105, "안전 (볼2·100%)", function()
			send({ t = "capTry", mode = "safe" })
		end)
		smallBtn(promptBtns, 110, 0, 100, "위험 (볼1·50%)", function()
			send({ t = "capTry", mode = "risky" })
		end)
		smallBtn(promptBtns, 215, 0, 100, "공격 (볼1·70%)", function()
			send({ t = "capTry", mode = "attack" })
		end)
		smallBtn(promptBtns, 0, 30, 60, "포기", function()
			send({ t = "capSkip" })
		end)
	elseif pd.kind == "recruit" then
		local alt = Data.SKILLS[pd.alt]
		promptLabel.Text = ("공용 하수인 — 새 기술 [%s] 을 배우겠습니까? (남은 쿨 승계·재비공개)"):format(alt.ko)
		local s1 = pd.slots and Data.SKILLS[pd.slots[1]] or nil
		local s2 = pd.slots and Data.SKILLS[pd.slots[2]] or nil
		smallBtn(promptBtns, 0, 0, 150, ("공격기1 교체 (%s)"):format(s1 and s1.ko or "?"), function()
			send({ t = "recruitSwap", slot = 1 })
		end)
		smallBtn(promptBtns, 156, 0, 150, ("공격기2 교체 (%s)"):format(s2 and s2.ko or "?"), function()
			send({ t = "recruitSwap", slot = 2 })
		end)
		smallBtn(promptBtns, 0, 30, 60, "유지", function()
			send({ t = "recruitKeep" })
		end)
	end
end

local function fighterText(fv, label)
	local st = {}
	if fv.shield > 0 then
		table.insert(st, "🛡" .. fv.shield)
	end
	if fv.burn > 0 then
		table.insert(st, "🔥화상" .. fv.burn .. "R")
	end
	if fv.weaken > 0 then
		table.insert(st, "💧약화" .. fv.weaken)
	end
	if fv.shock > 0 then
		table.insert(st, "⚡감전")
	end
	if fv.focusCharge then
		table.insert(st, "🎯집중")
	end
	local name = fv.isCap and ("포획 하수인·" .. (Data.ELEM_KO[fv.element] or "")) or (fv.name or Data.TYPE_KO[fv.pieceType] or "?")
	return ("<b>%s</b> %s (%s)\nHP %d/%d  %s"):format(
		label, name, fv.owner == view.me and "나" or "상대", fv.hp, fv.maxHp, table.concat(st, " "))
end

-- 전투 도트: 하수인·대리 출전(포획 하수인)은 battle256, 왕·동료 본체는 토큰128 팀 틴트
local function fighterImage(fv)
	if fv.isCap or fv.pieceType == "minion" then
		return Art.battle(fv.artRosterId), nil
	end
	return Art.token(fv.pieceType, 128), Art.TEAM[fv.owner]
end

local function renderBattle()
	local bt = view.battle
	battleFrame.Visible = bt ~= nil
	if not bt then
		return
	end
	local myActing = bt.actorOwner == view.me
	local topSide = (bt.mySide == "A") and "D" or "A"
	battleTop.Text = fighterText(bt[topSide], topSide == "A" and "[공격]" or "[방어]")
	battleBottom.Text = fighterText(bt[bt.mySide], bt.mySide == "A" and "[공격]" or "[방어]")
		.. ("\n라운드 %d/%d — %s"):format(bt.round, bt.maxRounds, myActing and "🟢 나의 행동" or "⏳ 상대 행동")
	for _, pair in { { spriteTop, bt[topSide] }, { spriteBottom, bt[bt.mySide] } } do
		local img, fv = pair[1], pair[2]
		local u, tint = fighterImage(fv)
		img.Image = u or ""
		img.ImageColor3 = tint or WHITE
		img.Visible = u ~= nil
	end
	clearChildrenBtns(battleBtns)
	if not myActing then
		return
	end
	local myF = bt[bt.mySide]
	if myF.skills then
		for i = 1, 4 do
			local sv = myF.skills[i]
			local text, enabled
			if sv.id then
				local sk = Data.SKILLS[sv.id]
				text = sk.ko .. (sv.cd > 0 and (" (쿨" .. sv.cd .. ")") or "")
				enabled = sv.cd == 0
			else
				text = "? " .. (Data.SKIND_KO[sv.kind] or "")
				enabled = false
			end
			local b = smallBtn(battleBtns, ((i - 1) % 2) * 180, math.floor((i - 1) / 2) * 30, 174, text, function()
				send({ t = "act", k = i })
			end)
			b.AutoButtonColor = enabled
			if not enabled then
				b.BackgroundColor3 = Color3.fromRGB(40, 44, 56)
			end
		end
		smallBtn(battleBtns, 0, 62, 90, "기본 공격", function()
			send({ t = "act", k = "basic" })
		end)
	else
		smallBtn(battleBtns, 0, 0, 120, "기본 공격", function()
			send({ t = "act", k = "basic" })
		end)
	end
	for i, k in bt.myItems do
		if i <= 3 then
			smallBtn(battleBtns, 96 + (i - 1) * 76, 62, 72, Data.ITEMS[k].ko, function()
				send({ t = "item", i = i })
			end, Color3.fromRGB(70, 100, 70))
		end
	end
	smallBtn(battleBtns, 0, 94, 110, "🔴 볼 던지기", function()
		send({ t = "ball" })
	end, Color3.fromRGB(150, 60, 60))
	smallBtn(battleBtns, 116, 94, 90, "🏃 도망", function()
		send({ t = "flee" })
	end, Color3.fromRGB(120, 90, 40))
end

function render()
	if not view then
		return
	end
	tablePanel.Visible = false
	game_.Visible = true
	local bp = findBoardPart()
	boardMode = (bp and not force2D) and "3d" or "2d"
	boardFrame.Visible = boardMode == "2d"
	modeBtn.Visible = bp ~= nil
	modeBtn.Text = force2D and "3D 판" or "2D 보드"
	DIAG.board = bp and (" · 판 " .. boardMode) or " · 판 없음(2D)"
	refreshFooter()
	renderLobby()
	if boardMode == "2d" then
		renderBoard2D()
		local3d:ClearAllChildren()
	else
		sync3D()
	end
	renderSide()
	renderButtons()
	renderPrompt()
	renderBattle()
end

--==================================================================
-- 입력
--==================================================================

local function onCell(r, c)
	if not view or view.phase ~= "play" then
		return
	end
	local p = pieceAt(r, c)
	if view.fleePick then
		if p and table.find(view.fleePick.cands, p.id) then
			send({ t = "fleeSwap", id = p.id })
		end
		return
	end
	if view.current ~= view.me or view.battle or view.pending or view.pendingWait then
		return
	end
	if teleFirst then
		if p and p.owner == view.me and p.id ~= teleFirst then
			send({ t = "tele", aId = teleFirst, bId = p.id })
			teleFirst = nil
		elseif p and p.id == teleFirst then
			teleFirst = nil
			render()
		end
		return
	end
	if view.forcedTargets and p and table.find(view.forcedTargets, p.id) then
		send({ t = "battle", attId = view.movedPieceId, defId = p.id })
		return
	end
	if p and p.owner == view.me then
		selectedId = p.id
		render()
		return
	end
	local sel = selectedId and pieceById(selectedId)
	if not sel then
		return
	end
	if p and p.owner ~= view.me then
		if math.abs(sel.r - r) + math.abs(sel.c - c) == 1 then
			send({ t = "battle", attId = sel.id, defId = p.id })
		end
		return
	end
	send({ t = "move", id = sel.id, r = r, c = c })
end

for dr = 1, ROWS do
	for c = 1, COLS do
		cells[dr][c].Activated:Connect(function()
			local r = (view and view.me == 1) and (ROWS + 1 - dr) or dr
			onCell(r, c)
		end)
	end
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or boardMode ~= "3d" or not view or not game_.Visible then
		return
	end
	if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then
		return
	end
	local r, c = raycastCell(input.Position)
	if r then
		onCell(r, c)
	end
end)

readyBtn.Activated:Connect(function()
	send({ t = "ready", setup = randomSetup() })
end)
unreadyBtn.Activated:Connect(function()
	send({ t = "unready" })
end)
standBtn.Activated:Connect(function()
	send({ t = "stand" }) -- 대전 중이면 서버가 기권 처리 후 기립
end)
modeBtn.Activated:Connect(function()
	force2D = not force2D
	render()
end)
renderLobby()
DIAG.ui = true
refreshFooter()

--==================================================================
-- 서버 수신
--==================================================================

reState.OnClientEvent:Connect(function(msg)
	if msg.t == "table" then
		tableInfo = msg
		if view then
			render()
		else
			renderLobby()
		end
		return
	elseif msg.t == "left" then
		tableInfo = nil
		if view then
			closeGame()
		else
			renderLobby()
		end
		return
	elseif msg.t == "reject" then
		addLog("⛔ " .. (msg.reason or "거부됨"))
		if not view then
			hudLabel.Text = "⛔ " .. (msg.reason or "거부됨")
		end
		return
	elseif msg.t == "state" then
		local prevBattle = view and view.battle ~= nil
		view = msg.view
		selectedId = selectedId and pieceById(selectedId) and selectedId or nil
		if view.battle == nil and prevBattle then
			teleFirst = nil
		end
		for _, ev in msg.events do
			if ev.t == "log" then
				addLog(ev.text)
			elseif ev.t == "bmsg" then
				battleMsg.Text = (battleMsg.Text ~= "" and battleMsg.Text .. "\n" or "") .. ev.text
				local lines = string.split(battleMsg.Text, "\n")
				while #lines > 8 do
					table.remove(lines, 1)
				end
				battleMsg.Text = table.concat(lines, "\n")
				addLog(ev.text)
			elseif ev.t == "contact" then
				addLog("⚠️ 접촉 발생!")
			end
		end
		if msg.opponentLeft then
			addLog("🔌 상대의 연결이 끊어졌습니다.")
		end
		render()
	end
end)
