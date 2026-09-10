--!nonstrict
-- init.client.luau — Digit Dual Roblox 클라이언트 (Phase 2d: P0 UI 아트 전량 적용)
-- 구조:
--   로비 HUD(왼쪽 위) · 배치 패널(앉았을 때, 하단: 로스터 → 배치 → 준비) · 사이드 패널(대전 중, 오른쪽) · 전투 패널(중앙) · 2D 보드(폴백)
--   판 위 대국: 앉으면 카메라가 판을 향하고, 서버 필터 상태(view.board)로 **이 클라이언트에만** 말을 로컬 생성한다.
--   배치: 설정 좌표는 "내 진영 = 11~13행". B 자리는 엔진 행 1~3 이 내 진영이므로 화면(엔진) 행 ↔ 설정 행을 14-r 로 변환한다.
--   합법 수: 서버가 view.legal 을 보내고 클라이언트는 그리기만 한다.
--   아트(roblox/assets/ui/README.md 계약): 타일·하이라이트·프레임(2D 셀), 패널 3종, 버튼 4상태×3종, 배지, HP/방어막 바(클립 채움),
--     상태·아이템·행동·기술 종류·속성·흔적 아이콘. 자산이 없으면 이전 단색/텍스트 폴백. 틴트는 Art.TINT 7개 + 팀 토큰뿐.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local StarterGui = game:GetService("StarterGui")
local UserInputService = game:GetService("UserInputService")
local Workspace = game:GetService("Workspace")

local CLIENT_VERSION = "0.5.0-p4.2"

local Shared = ReplicatedStorage:WaitForChild("Shared")
local remotes = ReplicatedStorage:WaitForChild("DDRemotes")
local reAction = remotes:WaitForChild("Action")
local reState = remotes:WaitForChild("State")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

task.defer(function()
	for _, ct in { Enum.CoreGuiType.Health, Enum.CoreGuiType.Backpack, Enum.CoreGuiType.Chat } do -- Chat: 왼쪽 위 기본 채팅창이 HUD 와 겹쳐 숨김 (CJ 2026-09-10)
		pcall(function()
			StarterGui:SetCoreGuiEnabled(ct, false)
		end)
	end
end)

--==================================================================
-- 진단 푸터
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
local DIAG = { server = "서버 확인 중…", modules = false, ui = false, board = "", err = nil }
local function refreshFooter()
	if DIAG.err then
		footer.TextColor3 = Color3.fromRGB(255, 90, 100)
		footer.Text = ("client v%s · ⛔ 오류: %s"):format(CLIENT_VERSION, DIAG.err)
		return
	end
	footer.TextColor3 = Color3.fromRGB(154, 163, 184)
	footer.Text = ("client v%s · %s%s%s%s"):format(CLIENT_VERSION, DIAG.server, DIAG.modules and " · 모듈 OK" or "", DIAG.ui and " · UI OK" or "", DIAG.board)
end
refreshFooter()
-- 클라이언트 스크립트 오류를 화면에 그대로 보여준다 (원격 진단용). 이 스크립트가 죽어도 이 연결은 살아 있다
local function reportError(msg)
	DIAG.err = tostring(msg):sub(1, 160)
	refreshFooter()
	warn("[DD client] " .. tostring(msg))
end
pcall(function()
	game:GetService("ScriptContext").Error:Connect(function(message, trace, scr)
		if scr == script or (typeof(scr) == "Instance" and scr:IsDescendantOf(ReplicatedStorage)) then
			reportError(message .. "\n" .. tostring(trace):sub(1, 200))
		end
	end)
end)
local function safe(fn, label)
	local ok, err = pcall(fn)
	if not ok then
		reportError((label or "render") .. ": " .. tostring(err))
	end
	return ok
end
reState.OnClientEvent:Connect(function(msg)
	if type(msg) == "table" and msg.t == "hello" then
		DIAG.server = ("server v%s 연결됨 · 접속 %d명"):format(tostring(msg.version), msg.players or 0)
		refreshFooter()
	end
end)
reAction:FireServer({ t = "ping" })

local Data = require(Shared:WaitForChild("Data"))
local Art = require(Shared:WaitForChild("Art"))
local Banner = require(Shared:WaitForChild("Banner"))
DIAG.modules = true
-- 이미지 사전 로드: Roblox 는 rbxassetid 이미지를 처음 그릴 때 내려받아 카드·초상화가 늦게 뜬다 → 접속 직후 백그라운드로 전부 받아 둔다 (메시 제외)
task.spawn(function()
	local okIds, AssetIds = pcall(function()
		return require(Shared:WaitForChild("AssetIds"))
	end)
	if not okIds or type(AssetIds) ~= "table" then
		return
	end
	local urls = {}
	for key, id in AssetIds do
		if type(id) == "number" and id > 0 and not string.find(key, "^lobbymesh_") and not string.find(key, "^mesh_") then
			table.insert(urls, "rbxassetid://" .. id)
		end
	end
	table.sort(urls) -- 결정적 순서
	local n = #urls
	pcall(function()
		game:GetService("ContentProvider"):PreloadAsync(urls)
	end)
	DIAG.board = DIAG.board .. (" · 이미지 %d 로드"):format(n)
	refreshFooter()
end)
refreshFooter()

local COLS, ROWS = 7, 13
local CELL = 40 -- 보드게임 창의 2D 판 셀 크기 (7×13 → 280×520)
local CELL_STUD = 0.6
local WHITE = Color3.new(1, 1, 1)
local SLOT_TYPES = { "minion", "minion", "minion", "minion", "minion", "minion", "bomb", "bomb", "bomb", "ally", "ally", "trap", "trap", "king" }

-- 현재 상태
local view = nil
local tableInfo = nil
local selectedId = nil
-- #11·#36 추측 메모 — **내 화면에만** 보이는 표시다. 서버로 보내지 않고 상대는 알 수 없다 (규칙·난수 무관)
local MEMO_OPTS = {
	{ key = "king", emoji = "👑", ko = "왕" },
	{ key = "ally", emoji = "🤝", ko = "동료" },
	{ key = "minion_fire", emoji = "🔥", ko = "불 하수인" },
	{ key = "minion_water", emoji = "💧", ko = "물 하수인" },
	{ key = "minion_grass", emoji = "🌿", ko = "풀 하수인" },
	{ key = "minion_lightning", emoji = "⚡", ko = "전기 하수인" },
	{ key = "bomb", emoji = "💣", ko = "폭탄" },
	{ key = "trap", emoji = "🪤", ko = "함정" },
}
local memos = {} -- [pieceId] = key
local myStats = nil -- Phase 4 전적 (서버 DataStore 에서 받아 표시만 한다)
local memoMode = false -- 메모 모드: 적 말을 클릭하면 공격이 아니라 메모 선택
local memoPick = nil -- 메모 선택 중인 말 id
local function memoOpt(key)
	for _, o in MEMO_OPTS do
		if o.key == key then
			return o
		end
	end
	return nil
end
local teleFirst = nil
local teleMode = false -- #131 계약 3.2: 텔레포트 1단계(첫 말 고르는 중) 표시
local logLines = {}
local battleSub = nil -- 전투 창 하위 선택 (gift | buff | nil) — 로컬 표시 상태
local recruitUi = { stage = "root", skill = nil, targetId = nil, recvId = nil, token = nil } -- #121 기술 교체·포획 선택 단계 (로컬)
local force2D = true -- 구조.txt: 판은 항상 "보드게임 창"(2D) 으로 본다. 3D 판 클릭은 쓰지 않는다
local boardMode = "2d"
local render
local renderSetup
local flashHud -- ⛔ 같은 일시 안내를 HUD 에 보여 주고 1초 뒤 원래 안내문으로 복구
local setup = { stage = "roster", roster = {}, pos = {}, tray = nil, detail = nil }

--==================================================================
-- UI 헬퍼 (아트 적용 — 자산 없으면 단색 폴백)
--==================================================================

local function mk(class, props, parent)
	local o = Instance.new(class)
	for k, v in props do
		o[k] = v
	end
	o.Parent = parent
	return o
end

local function slice(img, kind, scale) -- SliceCenter 는 원본 중앙 사각형 좌표 (README 계약)
	local s = Art.SLICE[kind]
	img.ScaleType = Enum.ScaleType.Slice
	img.SliceCenter = Rect.new(s[1], s[2], s[3], s[4])
	img.SliceScale = scale or 1
end

-- 프레임 위에 9-slice 배경을 깐다 (ZIndex 0 = 그 프레임 자식 중 맨 아래).
-- 프레임 자체 배경은 **불투명하게 유지**한다 — 이미지가 아직 안 받아졌거나 9-slice 여백이 생겨도 뒤 화면이 비치면 안 된다 (CJ 2026-09-10)
local function bgImage(frame, uiKey, sliceKind, scale)
	local u = Art.ui(uiKey)
	if not u then
		return nil
	end
	local img = mk("ImageLabel", {
		Name = "Bg", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Image = u,
		ResampleMode = Enum.ResamplerMode.Pixelated, ZIndex = 0,
	}, frame)
	slice(img, sliceKind, scale)
	frame.BackgroundTransparency = 0
	return img
end

--==================================================================
-- 전투 연출 스프라이트 (Earth 납품 fx96_* · 768×96 = 96×96 8프레임 가로)
-- 표시 계층 전용 — 규칙·난수와 무관하고 **입력을 막지 않는다**. earth-fx-p1p2-request.md 6장의 [기획 필요]
-- (재생 시간·입력 잠금)는 "잠금 없이 표시만" 으로 두고 프레임당 시간만 정했다. 자산이 없으면 조용히 아무것도 안 한다.
--==================================================================
-- 최상위 local 은 Luau 한도(200)에 걸리므로 재생기는 테이블 하나에 모은다
local Fx = {
	FRAME_S = 0.055, -- 8프레임 ≈ 0.44초 — 배너(1.2초)보다 먼저 끝난다
	seq = {}, -- [label] = 재생 번호. 새 연출이 끼어들면 이전 타이머를 무효화한다
}

function Fx.mk(parent, x, y, size, z)
	return mk("ImageLabel", {
		Size = UDim2.new(0, size, 0, size), Position = UDim2.new(0, x, 0, y), BackgroundTransparency = 1,
		ImageRectSize = Vector2.new(Art.FX.size, Art.FX.size), ImageRectOffset = Vector2.new(0, 0),
		ResampleMode = Enum.ResamplerMode.Pixelated, Visible = false, ZIndex = z, Active = false,
	}, parent)
end

function Fx.stop(label)
	Fx.seq[label] = (Fx.seq[label] or 0) + 1
	label.Visible = false
end

function Fx.play(label, key) -- key 가 nil 이거나 자산이 없으면 false (호출 측이 신경 쓸 것 없음)
	local u = Art.fx(key)
	if not u then
		return false
	end
	local n = (Fx.seq[label] or 0) + 1
	Fx.seq[label] = n
	label.Image = u
	label.ImageColor3 = Art.FX_TINT[key] or WHITE
	label.ImageRectOffset = Vector2.new(0, 0)
	label.Visible = true
	task.spawn(function()
		for i = 1, Art.FX.frames - 1 do
			task.wait(Fx.FRAME_S)
			if Fx.seq[label] ~= n then
				return -- 다른 연출이 끼어들었다
			end
			label.ImageRectOffset = Vector2.new(Art.FX.size * i, 0)
		end
		task.wait(Fx.FRAME_S)
		if Fx.seq[label] == n then
			label.Visible = false -- 마지막 프레임은 완전 투명이라 사라지는 모습 그대로 끝난다
		end
	end)
	return true
end

local function iconLabel(parent, x, y, size, image, tint, zindex)
	return mk("ImageLabel", {
		Size = UDim2.new(0, size, 0, size), Position = UDim2.new(0, x, 0, y), BackgroundTransparency = 1, Image = image,
		ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResamplerMode.Pixelated, ImageColor3 = tint or WHITE, ZIndex = zindex or 2,
	}, parent)
end

local BTN_FALLBACK = { default = Color3.fromRGB(60, 68, 88), primary = Color3.fromRGB(91, 140, 255), danger = Color3.fromRGB(170, 60, 70) }

-- 이미지 버튼 (btn_<kind>_<normal|hover|pressed|disabled> 9-slice, SliceScale 0.5). icon = 이미지 URL(선택). enabled=false 면 disabled 이미지 + 입력 무시
local function smallBtn(parent, x, y, w, text, cb, kind, enabled, icon, h)
	kind = kind or "default"
	local on = enabled ~= false
	h = h or 26
	local normal = Art.ui("btn_" .. kind .. "_normal")
	local disabledImg = Art.ui("btn_" .. kind .. "_disabled")
	local b = mk("ImageButton", {
		Size = UDim2.new(0, w, 0, h), Position = UDim2.new(0, x, 0, y),
		BackgroundTransparency = normal and 1 or 0, BackgroundColor3 = on and BTN_FALLBACK[kind] or Color3.fromRGB(38, 42, 54),
		AutoButtonColor = (normal == nil) and on, Image = (on and normal or disabledImg) or "", ResampleMode = Enum.ResamplerMode.Pixelated,
		ZIndex = parent.ZIndex,
	}, parent)
	if normal then
		slice(b, "btn", 0.5)
	end
	local tx = 2
	if icon then
		iconLabel(b, 6, math.floor((h - 18) / 2), 18, icon, nil, b.ZIndex + 1)
		tx = 26
	end
	mk("TextLabel", {
		Size = UDim2.new(1, -tx - 4, 1, 0), Position = UDim2.new(0, tx, 0, 0), BackgroundTransparency = 1, Text = text,
		TextSize = 12, Font = Enum.Font.GothamBold, TextColor3 = on and WHITE or Color3.fromRGB(120, 126, 140),
		ZIndex = b.ZIndex + 1, TextTruncate = Enum.TextTruncate.AtEnd,
	}, b)
	if on and normal then
		local hover, pressed = Art.ui("btn_" .. kind .. "_hover"), Art.ui("btn_" .. kind .. "_pressed")
		b.MouseEnter:Connect(function()
			b.Image = hover or normal
		end)
		b.MouseLeave:Connect(function()
			b.Image = normal
		end)
		b.MouseButton1Down:Connect(function()
			b.Image = pressed or normal
		end)
		b.MouseButton1Up:Connect(function()
			b.Image = hover or normal
		end)
	end
	b.Activated:Connect(function()
		if on then
			cb()
		end
	end)
	return b
end

local function mkBadge(parent, x, y, w, icon, text, z)
	z = z or parent.ZIndex
	local f = mk("Frame", { Size = UDim2.new(0, w, 0, 22), Position = UDim2.new(0, x, 0, y), BackgroundColor3 = Color3.fromRGB(43, 49, 64), BorderSizePixel = 0, ZIndex = z }, parent)
	bgImage(f, "badge", "badge", 0.5)
	local tx = 6
	if icon then
		iconLabel(f, 4, 3, 16, icon, nil, z + 1)
		tx = 22
	end
	mk("TextLabel", {
		Size = UDim2.new(1, -tx - 4, 1, 0), Position = UDim2.new(0, tx, 0, 0), BackgroundTransparency = 1, Text = text,
		TextSize = 11, Font = Enum.Font.GothamBold, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left, ZIndex = z + 1, TextTruncate = Enum.TextTruncate.AtEnd,
	}, f)
	return f
end

-- HP/방어막 바: 배경 9-slice + 전체 길이 채움을 클립 폭으로 가린다 (캡 압축 금지, 0 이면 숨김)
local function mkBar(parent, x, y, w, h, kind, z)
	z = z or parent.ZIndex
	local fillImg = Art.ui(kind .. "bar_fill")
	local tint = Art.TINT[kind .. "bar_fill"] or (kind == "hp" and Color3.fromRGB(0x4f, 0xd8, 0x8a) or Color3.fromRGB(0x4d, 0xa3, 0xff))
	local f = mk("Frame", { Size = UDim2.new(0, w, 0, h), Position = UDim2.new(0, x, 0, y), BackgroundColor3 = Color3.fromRGB(40, 44, 56), BorderSizePixel = 0, ZIndex = z }, parent)
	bgImage(f, kind .. "bar_bg", "bar", 0.5)
	local clip = mk("Frame", { Name = "Clip", Size = UDim2.new(1, 0, 1, 0), BackgroundTransparency = 1, ClipsDescendants = true, ZIndex = z + 1 }, f)
	local fi = mk("ImageLabel", {
		Name = "Fill", Size = UDim2.new(0, w, 0, h), BackgroundTransparency = fillImg and 1 or 0, BackgroundColor3 = tint,
		Image = fillImg or "", ImageColor3 = tint, ResampleMode = Enum.ResamplerMode.Pixelated, ZIndex = z + 1,
	}, clip)
	if fillImg then
		slice(fi, "bar", 0.5)
	end
	return f
end

local function setBar(bar, pct)
	local clip = bar:FindFirstChild("Clip")
	if not clip then
		return
	end
	pct = math.clamp(pct or 0, 0, 1)
	clip.Visible = pct > 0
	clip.Size = UDim2.new(pct, 0, 1, 0)
end

local function clearChildren(parent, keepName)
	for _, ch in parent:GetChildren() do
		if ch.Name ~= keepName then
			ch:Destroy()
		end
	end
end

--==================================================================
-- UI 구성
--==================================================================

-- ZIndexBehavior: 기본값(Global)이면 ZIndex 가 화면 전체에서 비교돼 패널 배경(ZIndex 0)이 다른 패널 아래로 깔린다
-- → 창이 통째로 투명해 보이고 뒤의 판·다른 창 글씨가 겹쳐 보였다. Sibling 이면 각 창의 자식은 그 창 안에서만 정렬된다 (CJ 2026-09-10)
local gui = mk("ScreenGui", {
	Name = "DigitDual", ResetOnSpawn = false, IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
}, playerGui)

-- 작은 창에서도 팝업이 화면 밖으로 나가지 않도록 창별 축소 배율을 자동 계산한다
local fitted = {} -- { frame, w, h, marginX, marginY }
local function applyFit()
	local cam = Workspace.CurrentCamera
	local vp = cam and cam.ViewportSize or Vector2.new(1280, 720)
	for _, e in fitted do
		local sx = (vp.X - e.mx) / e.w
		local sy = (vp.Y - e.my) / e.h
		e.scale.Scale = math.clamp(math.min(sx, sy, 1), 0.45, 1)
	end
end
local function autoFit(frame, w, h, mx, my)
	local sc = mk("UIScale", { Scale = 1 }, frame)
	table.insert(fitted, { scale = sc, w = w, h = h, mx = mx or 24, my = my or 24 })
	return frame
end
task.defer(function()
	local cam = Workspace.CurrentCamera
	if cam then
		cam:GetPropertyChangedSignal("ViewportSize"):Connect(applyFit)
	end
	applyFit()
end)

-- 로비 HUD
local hud = mk("Frame", {
	Size = UDim2.new(0, 660, 0, 92), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 12), ZIndex = 3, -- 상단 가운데 (CJ 2026-09-10)
	BackgroundColor3 = Color3.fromRGB(19, 22, 30), BorderSizePixel = 0,
}, gui)
bgImage(hud, "panel_side", "panel", 1)
autoFit(hud, 660, 92, 24, 0)
mk("TextLabel", {
	Text = "Digit Dual", Size = UDim2.new(0, 130, 0, 24), Position = UDim2.new(0, 10, 0, 6),
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 18, Font = Enum.Font.GothamBold,
	TextXAlignment = Enum.TextXAlignment.Left,
}, hud)
local hudLabel = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -20, 0, 50), Position = UDim2.new(0, 10, 0, 32),
	TextColor3 = Color3.fromRGB(180, 188, 205), BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true,
}, hud)
local hudBtns = mk("Frame", { Size = UDim2.new(0, 500, 0, 26), Position = UDim2.new(1, -508, 0, 6), BackgroundTransparency = 1 }, hud)
local lastSetupOpen = false -- 서버 setupOpen 전이 감지 (false→true 면 배치 단계 초기화)

-- 보드게임 창 (구조.txt): 왼쪽 2D 판 · 오른쪽 배치/대전 패널. 배치 단계·대전 중에만 보이고 [나가기] 로만 닫힌다 (그동안 캐릭터 이동 불가)
local WIN_W, WIN_H = 720, 640 -- 제목 띠(0~36) · 본문(36~588) · 상태줄(596~626) 세 구역
local win = mk("Frame", {
	Size = UDim2.new(0, WIN_W, 0, WIN_H), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Visible = false, ZIndex = 2,
	BackgroundColor3 = Color3.fromRGB(24, 27, 37), BorderSizePixel = 0,
}, gui)
autoFit(win, WIN_W, WIN_H, 16, 16)
win:GetPropertyChangedSignal("Visible"):Connect(function() -- 창이 열리면 HUD 를 숨긴다 (겹침 방지 — 창에 자체 [나가기]·안내가 있다)
	hud.Visible = not win.Visible
end)
if not bgImage(win, "panel_window", "window", 1) then -- 창 전용 프레임(SliceCenter 24,40,232,232) — 없으면 기존 패널로 폴백
	bgImage(win, "panel_side", "panel", 1)
end
local winTitle = mk("TextLabel", {
	Text = "", Size = UDim2.new(0, 248, 0, 22), Position = UDim2.new(0, 16, 0, 8),
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 14, Font = Enum.Font.GothamBold,
	TextXAlignment = Enum.TextXAlignment.Left, TextTruncate = Enum.TextTruncate.AtEnd,
}, win)
local winBadge = mk("ImageLabel", { -- 상대가 봇이면 난이도 배지 (badge48_ai_grade5/dan5)
	Size = UDim2.new(0, 24, 0, 24), Position = UDim2.new(0, 272, 0, 7), BackgroundTransparency = 1, Visible = false,
	ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResamplerMode.Pixelated, ImageColor3 = WHITE,
}, win)
local winThinking = mk("ImageLabel", { -- 🤖 AI 행동 중 (status48_thinking)
	Size = UDim2.new(0, 24, 0, 24), Position = UDim2.new(0, 16, 1, -40), BackgroundTransparency = 1, Visible = false,
	ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResamplerMode.Pixelated, ImageColor3 = WHITE,
}, win)
local winStatus = mk("TextLabel", { -- 판 아래 한 줄 상태 (🤖 AI 행동 중 등)
	Text = "", Size = UDim2.new(0, 540, 0, 30), Position = UDim2.new(0, 44, 1, -40),
	TextColor3 = Color3.fromRGB(180, 188, 205), BackgroundTransparency = 1, TextSize = 12, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextWrapped = true,
}, win)
local function setBotBadge()
	local u = tableInfo and tableInfo.oppBot and Art.badge(tableInfo.botLevel == "dan5" and "ai_dan5" or "ai_grade5") or nil
	winBadge.Image = u or ""
	winBadge.Visible = u ~= nil
end
local function setThinking(on)
	local u = on and Art.status("thinking") or nil
	winThinking.Image = u or ""
	winThinking.Visible = u ~= nil
	winStatus.Position = UDim2.new(0, u and 44 or 16, 1, -40) -- 아이콘이 없으면 왼쪽으로 당긴다
end
-- 배치 패널 (창 오른쪽 컬럼)
local setupPanel = mk("Frame", {
	Size = UDim2.new(0, 388, 0, WIN_H - 88), Position = UDim2.new(0, 316, 0, 40), Visible = false, BackgroundTransparency = 1,
}, win)
local setupTitle = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -142, 0, 22), Position = UDim2.new(0, 10, 0, 0),
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 15, Font = Enum.Font.GothamBold,
	TextXAlignment = Enum.TextXAlignment.Left, TextTruncate = Enum.TextTruncate.AtEnd,
}, setupPanel)
local setupTop = mk("Frame", { Size = UDim2.new(0, 116, 0, 22), Position = UDim2.new(1, -126, 0, 0), BackgroundTransparency = 1 }, setupPanel) -- 봇 난이도 토글
local setupHint = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -20, 0, 34), Position = UDim2.new(0, 10, 0, 24),
	TextColor3 = Color3.fromRGB(180, 188, 205), BackgroundTransparency = 1, TextSize = 12, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true,
}, setupPanel)
local setupContent = mk("Frame", { Size = UDim2.new(1, -20, 0, 400), Position = UDim2.new(0, 10, 0, 62), BackgroundTransparency = 1 }, setupPanel)
local setupBtns = mk("Frame", { Size = UDim2.new(1, -20, 0, 66), Position = UDim2.new(0, 10, 1, -72), BackgroundTransparency = 1 }, setupPanel)

-- 로스터 상세 팝업
local detailBack = mk("Frame", { -- 상세 팝업 뒤 암막 — 뒤 카드 글씨가 겹쳐 보이지 않게
	Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.45, BorderSizePixel = 0,
	Visible = false, ZIndex = 7,
}, gui)
local rosterDetail = mk("Frame", {
	Size = UDim2.new(0, 520, 0, 300), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Visible = false, ZIndex = 8,
	BackgroundColor3 = Color3.fromRGB(28, 32, 44), BorderSizePixel = 0,
}, gui)
bgImage(rosterDetail, "panel_modal", "panel", 1)
autoFit(rosterDetail, 520, 300)
local detailPortrait = mk("ImageLabel", {
	Size = UDim2.new(0, 168, 0, 168), Position = UDim2.new(0, 14, 0, 14), BackgroundColor3 = Color3.fromRGB(19, 22, 30),
	BorderSizePixel = 0, ScaleType = Enum.ScaleType.Fit, ZIndex = 8,
}, rosterDetail)
local detailElem = iconLabel(rosterDetail, 182, 12, 22, "", nil, 9)
local detailText = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -212, 0, 236), Position = UDim2.new(0, 196, 0, 14), ZIndex = 8,
	TextColor3 = WHITE, BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham, RichText = true,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true,
}, rosterDetail)
local detailBtns = mk("Frame", { Size = UDim2.new(1, -24, 0, 30), Position = UDim2.new(0, 12, 1, -38), BackgroundTransparency = 1, ZIndex = 8 }, rosterDetail)

--==================================================================
-- 중앙 배너 (HTML 데모의 fxPlay{kind="banner"} 대응) — 턴 시작·접촉·폭탄·함정·탐색 결과 등을 화면 중앙에 잠깐 띄운다.
-- 표시 계층 전용: 규칙·난수와 무관하고, 클릭을 가로채지 않는다 (Active=false 기본). 서버가 보낸 이벤트에서 규칙을 그대로 읽어 만든다.
--==================================================================
local BANNER_MS = 1.2 -- #125 계약과 같은 1.2초
local BANNER_TONE = {
	default = Color3.fromRGB(232, 236, 245),
	good = Color3.fromRGB(0x6f, 0xe0, 0xa0),
	bad = Color3.fromRGB(0xff, 0x7a, 0x8a),
	warn = Color3.fromRGB(0xff, 0xd1, 0x6a),
}
local bannerFrame = mk("Frame", {
	Size = UDim2.new(0, 540, 0, 112), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
	BackgroundColor3 = Color3.fromRGB(19, 22, 30), BorderSizePixel = 0, Visible = false, ZIndex = 9,
}, gui)
-- 획득·손실은 배경까지 바꿔 한눈에 구분한다 (Earth earth-banner-variants-report.md — 실루엣·글자 영역은 공통과 동일)
local bannerArt = { VARIANT = { good = "banner_good", bad = "banner_bad" }, base = "" }
bannerArt.bg = bgImage(bannerFrame, "banner", "panel", 1) -- 전용 배너 아트 (Earth 납품)
if not bannerArt.bg then
	bannerArt.bg = bgImage(bannerFrame, "panel_modal", "panel", 1)
end
if bannerArt.bg then
	bannerArt.base = bannerArt.bg.Image
end
autoFit(bannerFrame, 540, 112)
local bannerTitle = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -24, 0, 44), Position = UDim2.new(0, 12, 0, 18), ZIndex = 10,
	BackgroundTransparency = 1, TextSize = 30, Font = Enum.Font.GothamBold, TextColor3 = WHITE,
	TextStrokeTransparency = 0.4, TextTruncate = Enum.TextTruncate.AtEnd,
}, bannerFrame)
local bannerSub = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -24, 0, 34), Position = UDim2.new(0, 12, 0, 64), ZIndex = 10,
	BackgroundTransparency = 1, TextSize = 14, Font = Enum.Font.Gotham, TextColor3 = Color3.fromRGB(180, 188, 205),
	TextWrapped = true,
}, bannerFrame)
bannerArt.fx = Fx.mk(bannerFrame, 14, 8, 96, 10) -- 판 위에서 일어난 일(폭탄·함정·포획·도망)은 배너 안에서 보여 준다
local bannerQ, bannerBusy = {}, false
local function bannerPump()
	if bannerBusy then
		return
	end
	local b = table.remove(bannerQ, 1)
	if not b then
		bannerFrame.Visible = false
		return
	end
	bannerBusy = true
	if bannerArt.bg then -- 상황별 배경 (없으면 공통 배너 그대로)
		local key = bannerArt.VARIANT[b.tone or ""]
		local u = nil
		if key then
			u = Art.ui(key)
		end
		bannerArt.bg.Image = u or bannerArt.base
	end
	local hasFx = false
	if b.fx then
		hasFx = Fx.play(bannerArt.fx, b.fx)
	end
	if not hasFx then
		Fx.stop(bannerArt.fx)
	end
	local tx = 12 -- 연출이 있으면 글자를 오른쪽으로 밀어 겹치지 않게 한다
	if hasFx then
		tx = 116
	end
	bannerTitle.Position = UDim2.new(0, tx, 0, 18)
	bannerTitle.Size = UDim2.new(1, -(tx + 12), 0, 44)
	bannerSub.Position = UDim2.new(0, tx, 0, 64)
	bannerSub.Size = UDim2.new(1, -(tx + 12), 0, 34)
	bannerTitle.Text = b.title
	bannerTitle.TextColor3 = BANNER_TONE[b.tone or "default"] or BANNER_TONE.default
	bannerSub.Text = b.sub or ""
	bannerFrame.Visible = true
	task.delay(BANNER_MS, function()
		bannerBusy = false
		bannerPump()
	end)
end
local function banner(title, sub, tone, fx)
	if #bannerQ >= 4 then -- 몰릴 때는 최신 것만 (연출이 밀려 게임이 답답해지지 않게)
		table.remove(bannerQ, 1)
	end
	table.insert(bannerQ, { title = title, sub = sub, tone = tone, fx = fx })
	bannerPump()
end

-- 서버 로그 한 줄 → 배너 (규칙 문구를 그대로 쓴다). 판정은 공유 모듈 Banner (헤드리스 테스트 [12] 대상)
local bannerFromLog = Banner.fromLog

-- 📜 게임 기록 창 — 사이드 패널의 최근 14줄 말고 **전체 기록**을 스크롤해서 본다 (내 화면 전용)
local logWin = mk("Frame", {
	Size = UDim2.new(0, 560, 0, 420), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
	BackgroundColor3 = Color3.fromRGB(24, 27, 37), BorderSizePixel = 0, Visible = false, ZIndex = 12,
}, gui)
bgImage(logWin, "panel_modal", "panel", 1)
autoFit(logWin, 560, 420)
mk("TextLabel", {
	Text = "📜 게임 기록", Size = UDim2.new(1, -120, 0, 24), Position = UDim2.new(0, 14, 0, 10), ZIndex = 12,
	BackgroundTransparency = 1, TextSize = 15, Font = Enum.Font.GothamBold, TextColor3 = Color3.fromRGB(232, 236, 245),
	TextXAlignment = Enum.TextXAlignment.Left,
}, logWin)
local logScroll = mk("ScrollingFrame", {
	Size = UDim2.new(1, -28, 1, -84), Position = UDim2.new(0, 14, 0, 38), ZIndex = 12,
	BackgroundColor3 = Color3.fromRGB(19, 22, 30), BackgroundTransparency = 0.25, BorderSizePixel = 0,
	CanvasSize = UDim2.new(0, 0, 0, 0), ScrollBarThickness = 8, ScrollingDirection = Enum.ScrollingDirection.Y,
	AutomaticCanvasSize = Enum.AutomaticSize.Y,
}, logWin)
local logText = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -12, 0, 0), Position = UDim2.new(0, 6, 0, 4), ZIndex = 13,
	AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, TextSize = 12, Font = Enum.Font.Gotham,
	TextColor3 = Color3.fromRGB(200, 206, 220), TextXAlignment = Enum.TextXAlignment.Left,
	TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true,
}, logScroll)
local logWinBtns = mk("Frame", { Size = UDim2.new(1, -28, 0, 30), Position = UDim2.new(0, 14, 1, -40), BackgroundTransparency = 1, ZIndex = 12 }, logWin)

-- #11·#36 추측 메모 선택 팝업 (내 화면 전용 — 서버로 아무것도 보내지 않는다)
local memoFrame = mk("Frame", {
	Size = UDim2.new(0, 300, 0, 246), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
	BackgroundColor3 = Color3.fromRGB(28, 32, 44), BorderSizePixel = 0, Visible = false, ZIndex = 11,
}, gui)
bgImage(memoFrame, "panel_modal", "panel", 1)
autoFit(memoFrame, 300, 246)
mk("TextLabel", {
	Text = "📝 이 말은 뭘까? (내 화면에만 보입니다)", Size = UDim2.new(1, -24, 0, 22), Position = UDim2.new(0, 12, 0, 10), ZIndex = 11,
	BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.GothamBold, TextColor3 = Color3.fromRGB(232, 236, 245),
	TextXAlignment = Enum.TextXAlignment.Left,
}, memoFrame)
local memoBtns = mk("Frame", { Size = UDim2.new(1, -24, 0, 200), Position = UDim2.new(0, 12, 0, 36), BackgroundTransparency = 1, ZIndex = 11 }, memoFrame)

-- 대전 화면 (배경 투명)
local game_ = mk("Frame", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Visible = false, ZIndex = 6 }, gui) -- 전투 모달 등 (창 위)
local modalBack = mk("Frame", { -- 전투·탐색 보상 창 뒤 암막 (뒤의 판·사이드 패널이 겹쳐 보이지 않게)
	Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.45, BorderSizePixel = 0,
	Visible = false, ZIndex = 4,
}, game_)

-- 2D 판 (보드게임 창 왼쪽 — 대전·배치 공용). 외곽 프레임(board_frame) + 셀마다 타일·하이라이트 오버레이
local boardFrameImg = mk("ImageLabel", {
	Size = UDim2.new(0, COLS * CELL + 32, 0, ROWS * CELL + 32), Position = UDim2.new(0, 0, 0, 36), BackgroundTransparency = 1,
	Image = Art.board("frame") or "", ResampleMode = Enum.ResamplerMode.Pixelated, Visible = false, ZIndex = 0,
}, win)
if Art.board("frame") then
	slice(boardFrameImg, "hl", 0.5)
end
local boardFrame = mk("Frame", {
	Size = UDim2.new(0, COLS * CELL, 0, ROWS * CELL), Position = UDim2.new(0, 16, 0, 52),
	BackgroundColor3 = Color3.fromRGB(30, 34, 46), Visible = false,
}, win)
local cells = {}
for dr = 1, ROWS do
	cells[dr] = {}
	for c = 1, COLS do
		local b = mk("TextButton", {
			Size = UDim2.new(0, CELL - 2, 0, CELL - 2), Position = UDim2.new(0, (c - 1) * CELL + 1, 0, (dr - 1) * CELL + 1),
			Text = "", TextSize = 12, Font = Enum.Font.Gotham, TextColor3 = WHITE,
			BackgroundColor3 = Color3.fromRGB(43, 49, 64), BorderSizePixel = 0,
		}, boardFrame)
		mk("ImageLabel", { -- 타일 (128→32 균등 축소)
			Name = "Tile", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ScaleType = Enum.ScaleType.Stretch,
			ResampleMode = Enum.ResamplerMode.Pixelated, Visible = false, ZIndex = 0,
		}, b)
		mk("ImageLabel", {
			Name = "Icon", Size = UDim2.new(1, -4, 1, -4), Position = UDim2.new(0, 2, 0, 2), BackgroundTransparency = 1,
			ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResamplerMode.Pixelated, Visible = false, ZIndex = 2,
		}, b)
		mk("TextLabel", {
			Name = "Hp", Size = UDim2.new(1, -2, 0, 12), Position = UDim2.new(0, 0, 1, -12), BackgroundTransparency = 1,
			Text = "", TextSize = 10, Font = Enum.Font.GothamBold, TextColor3 = WHITE, TextStrokeTransparency = 0.2,
			TextXAlignment = Enum.TextXAlignment.Right, Visible = false, ZIndex = 3,
		}, b)
		local mark = mk("ImageLabel", { -- 흔적 (trace48) — 없으면 텍스트 폴백
			Name = "Mark", Size = UDim2.new(0, 14, 0, 14), Position = UDim2.new(0, 1, 0, 1), BackgroundTransparency = 1,
			Image = Art.trace() or "", ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResamplerMode.Pixelated, Visible = false, ZIndex = 3,
		}, b)
		mk("TextLabel", {
			Name = "MarkTxt", Size = UDim2.new(0, 14, 0, 12), Position = UDim2.new(0, 1, 0, 0), BackgroundTransparency = 1,
			Text = "🔍", TextSize = 10, Font = Enum.Font.Gotham, TextColor3 = WHITE, Visible = false, ZIndex = 3,
		}, b)
		mk("TextLabel", { -- #11·#36 추측 메모 (내 화면 전용)
			Name = "Memo", Size = UDim2.new(1, -2, 0, 14), Position = UDim2.new(0, 1, 1, -15), BackgroundTransparency = 1,
			Text = "", TextSize = 12, Font = Enum.Font.GothamBold, TextColor3 = WHITE, TextStrokeTransparency = 0.2,
			TextXAlignment = Enum.TextXAlignment.Left, Visible = false, ZIndex = 3,
		}, b)
		mk("ImageLabel", { -- 메모가 달린 말 배지 (Earth token64_memo) — 무엇을 적었는지는 왼쪽 아래 이모지가 보여 준다
			Name = "MemoIcon", Size = UDim2.new(0, 14, 0, 14), Position = UDim2.new(1, -15, 0, 1), BackgroundTransparency = 1,
			Image = Art.memoToken() or "", ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResamplerMode.Pixelated,
			Visible = false, ZIndex = 3,
		}, b)
		local hl = mk("ImageLabel", { -- 하이라이트 오버레이 (128 9-slice, 32px 셀 → SliceScale 0.25)
			Name = "Hl", Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ResampleMode = Enum.ResamplerMode.Pixelated, Visible = false, ZIndex = 4,
		}, b)
		slice(hl, "hl", 0.25)
		cells[dr][c] = b
	end
end

-- 사이드 패널 (대전 중 · 오른쪽)
local side = mk("Frame", { -- 대전 중 창 오른쪽 컬럼 (배치 패널과 같은 자리)
	Size = UDim2.new(0, 388, 0, WIN_H - 88), Position = UDim2.new(0, 316, 0, 40), Visible = false, BackgroundTransparency = 1,
}, win)
local infoHead = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -20, 0, 44), Position = UDim2.new(0, 10, 0, 8),
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 14, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true, RichText = true,
}, side)
local badgeRow = mk("Frame", { Size = UDim2.new(1, -20, 0, 24), Position = UDim2.new(0, 10, 0, 54), BackgroundTransparency = 1 }, side)
local infoLabel = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -20, 0, 78), Position = UDim2.new(0, 10, 0, 82),
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true, RichText = true,
}, side)
local btnRow = mk("Frame", { Size = UDim2.new(1, -20, 0, 100), Position = UDim2.new(0, 10, 0, 162), BackgroundTransparency = 1 }, side)
local logBox = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -20, 1, -392), Position = UDim2.new(0, 10, 0, 270),
	TextColor3 = Color3.fromRGB(180, 188, 205), BackgroundColor3 = Color3.fromRGB(19, 22, 30), BackgroundTransparency = 0.3, TextSize = 12,
	Font = Enum.Font.Gotham, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Bottom, TextWrapped = true,
}, side)
local promptFrame = mk("Frame", {
	Size = UDim2.new(1, -20, 0, 110), Position = UDim2.new(0, 10, 1, -118), BackgroundColor3 = Color3.fromRGB(35, 40, 54), Visible = false,
}, side)
bgImage(promptFrame, "panel_modal", "panel", 1)
local promptLabel = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -16, 0, 40), Position = UDim2.new(0, 8, 0, 6),
	TextColor3 = WHITE, BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham, TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
}, promptFrame)
local promptBtns = mk("Frame", { Size = UDim2.new(1, -16, 0, 60), Position = UDim2.new(0, 8, 0, 46), BackgroundTransparency = 1 }, promptFrame)

-- 전투 패널
local BF_W, BF_H = 440, 566
local battleFrame = mk("Frame", {
	Size = UDim2.new(0, BF_W, 0, BF_H), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
	BackgroundColor3 = Color3.fromRGB(28, 32, 44), Visible = false, ZIndex = 5,
}, game_)
bgImage(battleFrame, "panel_battle", "panel", 1)
autoFit(battleFrame, BF_W, BF_H)
local fighterTop = mk("Frame", { Size = UDim2.new(1, -108, 0, 74), Position = UDim2.new(0, 12, 0, 10), BackgroundTransparency = 1, ZIndex = 5 }, battleFrame)
local fighterBottom = mk("Frame", { Size = UDim2.new(1, -108, 0, 74), Position = UDim2.new(0, 12, 0, 88), BackgroundTransparency = 1, ZIndex = 5 }, battleFrame)
local function mkSpriteLabel(y)
	return mk("ImageLabel", { -- 전투원 카드 오른쪽 (카드 폭 밖 — 글씨와 겹치지 않는다)
		Size = UDim2.new(0, 76, 0, 76), Position = UDim2.new(1, -84, 0, y), BackgroundTransparency = 1, ZIndex = 6,
		ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResamplerMode.Pixelated, Visible = false,
	}, battleFrame)
end
local spriteTop, spriteBottom = mkSpriteLabel(10), mkSpriteLabel(88)
-- 전투 연출: 위·아래 전투원 카드가 맞닿는 지점에 한 번 재생한다. 어느 쪽이 맞았는지는 이름 문자열로 가리지 않는다
-- (오인 표시보다 중앙 1회가 낫다 — 좌우 구분은 서버가 연출 키를 실어 보내게 되면 후속으로 나눈다)
local battleFx = Fx.mk(battleFrame, math.floor((BF_W - 96) / 2), 40, 96, 7)
local battleRound = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -24, 0, 34), Position = UDim2.new(0, 12, 0, 168), ZIndex = 5, TextWrapped = true,
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.GothamBold,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top,
}, battleFrame)
local battleMsg = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -24, 0, 96), Position = UDim2.new(0, 12, 0, 206), ZIndex = 5,
	TextColor3 = Color3.fromRGB(255, 224, 150), BackgroundColor3 = Color3.fromRGB(19, 22, 30), BackgroundTransparency = 0.25, TextSize = 12,
	Font = Enum.Font.Gotham, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Bottom, TextWrapped = true,
}, battleFrame)
local battleBtns = mk("Frame", { Size = UDim2.new(1, -24, 0, 244), Position = UDim2.new(0, 12, 0, 310), BackgroundTransparency = 1, ZIndex = 5 }, battleFrame)

-- #121 계약 4·6: 탐색 보상 선택 창 (기술 교체 3단계 · 포획 2단계 · 포기) — 소유자 화면에만 (서버가 소유자에게만 내려보낸다)
local RF_W, RF_H = 580, 496
local recruitFrame = mk("Frame", {
	Size = UDim2.new(0, RF_W, 0, RF_H), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
	BackgroundColor3 = Color3.fromRGB(28, 32, 44), Visible = false, ZIndex = 5,
}, game_)
bgImage(recruitFrame, "panel_modal", "panel", 1)
autoFit(recruitFrame, RF_W, RF_H)
local recruitTitle = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -28, 0, 24), Position = UDim2.new(0, 14, 0, 10), ZIndex = 5,
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 16, Font = Enum.Font.GothamBold,
	TextXAlignment = Enum.TextXAlignment.Left, TextTruncate = Enum.TextTruncate.AtEnd,
}, recruitFrame)
local recruitTextBox = mk("Frame", { -- 본문 영역 (버튼과 겹치지 않게 넘치는 글은 잘라 낸다)
	Size = UDim2.new(1, -28, 0, 172), Position = UDim2.new(0, 14, 0, 38), BackgroundColor3 = Color3.fromRGB(19, 22, 30),
	BackgroundTransparency = 0.35, BorderSizePixel = 0, ClipsDescendants = true, ZIndex = 5,
}, recruitFrame)
local recruitText = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -12, 1, -8), Position = UDim2.new(0, 6, 0, 4), ZIndex = 6, RichText = true,
	TextColor3 = Color3.fromRGB(200, 206, 220), BackgroundTransparency = 1, TextSize = 12, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true,
}, recruitTextBox)
local recruitBtns = mk("Frame", { Size = UDim2.new(1, -28, 0, 268), Position = UDim2.new(0, 14, 0, 218), BackgroundTransparency = 1, ZIndex = 5 }, recruitFrame)

--==================================================================
-- 헬퍼
--==================================================================

local logWinOpen = false
function refreshLogWin()
	local n = #logLines
	local lines = {}
	for i = 1, n do
		table.insert(lines, ("%3d. %s"):format(i, logLines[i]))
	end
	logText.Text = (n > 0) and table.concat(lines, "\n") or "아직 기록이 없습니다."
	task.defer(function() -- 최신 줄로 내려 준다
		if logWinOpen then
			logScroll.CanvasPosition = Vector2.new(0, math.max(0, logScroll.AbsoluteCanvasSize.Y))
		end
	end)
end

local function send(a)
	reAction:FireServer(a)
end

-- 창 오른쪽 맨 아래 [나가기] — 탐색·텔레포트 같은 게임 행동 버튼과 떨어뜨린다 (CJ 2026-09-10)
local winExit = smallBtn(win, WIN_W - 120, 0, 104, "🚪 나가기", function()
	send({ t = "stand" })
end, "danger", true, Art.action("exit") or Art.action("resign"), 28)
winExit.Position = UDim2.new(0, WIN_W - 120, 1, -42)
winExit.ZIndex = 3

local function addLog(text)
	table.insert(logLines, text)
	while #logLines > 300 do -- 전체 기록은 [📜 기록] 창에서 본다 (사이드 패널은 최근 14줄만)
		table.remove(logLines, 1)
	end
	local tail = {}
	for i = math.max(1, #logLines - 13), #logLines do
		table.insert(tail, logLines[i])
	end
	logBox.Text = table.concat(tail, "\n")
	if logWinOpen then
		refreshLogWin()
	end
end

local function mySide()
	return tableInfo and tableInfo.side or "A"
end

local function myOwner()
	if view then
		return view.me
	end
	return mySide() == "B" and 1 or 0
end

local function toEngineRow(setupRow)
	return mySide() == "B" and (ROWS + 1 - setupRow) or setupRow
end

local function dispRow(r)
	if myOwner() == 1 then
		return ROWS + 1 - r
	end
	return r
end

local function zoneOfRow(r) -- 뷰어 기준 타일: own / enemy / forest / mid
	local me = myOwner()
	local ownRows = (me == 0) and (r >= 11 and r <= 13) or (me == 1) and (r >= 1 and r <= 3)
	local oppRows = (me == 0) and (r >= 1 and r <= 3) or (me == 1) and (r >= 11 and r <= 13)
	if ownRows then
		return "own"
	elseif oppRows then
		return "enemy"
	elseif (r >= 4 and r <= 5) or (r >= 9 and r <= 10) then
		return "forest"
	end
	return "mid"
end
local ZONE_FALLBACK = { own = Color3.fromRGB(47, 58, 94), enemy = Color3.fromRGB(74, 46, 58), forest = Color3.fromRGB(35, 66, 47), mid = Color3.fromRGB(43, 49, 64) }

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

local function pieceLabel(p)
	if not p.known then
		return "?"
	end
	local sym = { minion = "", bomb = "💣", ally = "🤝", trap = "🪤", king = "👑" }
	if p.type == "minion" then
		return (Data.ELEM_EMO[p.element] or "") .. "\n" .. tostring(p.hp or "")
	end
	return (sym[p.type] or "?") .. (p.hp and ("\n" .. p.hp) or "")
end

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

local function legalOf(id)
	if not view or not view.legal or not id then
		return nil
	end
	return view.legal[tostring(id)]
end

-- 2D 셀 상태 그리기 공용: 타일·하이라이트(우선순위 forced > attack > sel > flee > move)·흔적
local function cellReset(b, r)
	local zone = zoneOfRow(r)
	local tu = Art.board("tile_" .. zone)
	b.BackgroundColor3 = ZONE_FALLBACK[zone]
	b.Tile.Image = tu or ""
	b.Tile.Visible = tu ~= nil
	b.Text = ""
	b.TextColor3 = WHITE
	b.BorderSizePixel = 0
	b.Icon.Visible = false
	b.Hp.Visible = false
	b.Mark.Visible = false
	b.MarkTxt.Visible = false
	b.Memo.Visible = false
	b.MemoIcon.Visible = false
	b.Hl.Visible = false
end

local HL_FALLBACK = { move = Color3.fromRGB(50, 90, 160), flee = Color3.fromRGB(50, 90, 160), sel = Color3.fromRGB(120, 120, 40), attack = Color3.fromRGB(150, 50, 50), forced = Color3.fromRGB(160, 50, 50), memo = Color3.fromRGB(140, 110, 40) }
local function cellHighlight(b, key) -- key: move|flee|sel|attack|forced|memo
	local u = Art.board("hl_" .. key)
	if u then
		b.Hl.Image = u
		b.Hl.ImageColor3 = Art.TINT["hl_" .. key] or WHITE
		b.Hl.Visible = true
	else
		b.BackgroundColor3 = HL_FALLBACK[key]
		b.Tile.Visible = false
	end
end

local function cellMark(b)
	if Art.trace() then
		b.Mark.Visible = true
	else
		b.MarkTxt.Visible = true
	end
end

--==================================================================
-- 3D 판 (로컬 전용 인스턴스)
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

local function mkBase(cf, color, r, c)
	local p = Instance.new("Part")
	p.Name = "Base"
	p.Size = Vector3.new(0.52, 0.04, 0.52)
	p.CFrame = cf * CFrame.new(0, 0.02, 0)
	p.Color = color
	p.Material = Enum.Material.SmoothPlastic
	return tagCell(p, r, c)
end

local function mkBillboard(cf, r, c, sizeStud, lift)
	local anchor = Instance.new("Part")
	anchor.Name = "Piece"
	anchor.Size = Vector3.new(0.5, 0.5, 0.5)
	anchor.Transparency = 1
	anchor.CFrame = cf * CFrame.new(0, lift or 0.32, 0)
	tagCell(anchor, r, c)
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromScale(sizeStud or 0.62, sizeStud or 0.62)
	bb.LightInfluence = 0
	bb.AlwaysOnTop = false
	bb.Parent = anchor
	return anchor, bb
end

local function mkSprite(cf, image, tint, hp, r, c, sizeStud, lift)
	local anchor, bb = mkBillboard(cf, r, c, sizeStud, lift)
	local img = Instance.new("ImageLabel")
	img.Size = UDim2.fromScale(1, 1)
	img.BackgroundTransparency = 1
	img.Image = image
	img.ScaleType = Enum.ScaleType.Fit
	img.ResampleMode = Enum.ResamplerMode.Pixelated
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
		m.CFrame = cf * CFrame.new(0, 0.21, 0)
		m.Color = color
		return tagCell(m, r, c)
	end
	local u = Art.token("unknown", 64)
	if u then
		return mkSprite(cf, u, color, nil, r, c)
	end
	local p = Instance.new("Part")
	p.Name = "Piece"
	p.Size = Vector3.new(0.44, 0.42, 0.44)
	p.CFrame = cf * CFrame.new(0, 0.21, 0)
	p.Color = color
	return tagCell(p, r, c)
end

local HL = {
	sel = Color3.fromRGB(255, 220, 80),
	forced = Color3.fromRGB(255, 70, 70),
	flee = Color3.fromRGB(80, 140, 255),
	move = Color3.fromRGB(80, 160, 255),
	attack = Color3.fromRGB(255, 80, 80),
}

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

local function mkTrace3D(cf, r, c)
	local tu = Art.trace()
	if tu then
		mkSprite(cf * CFrame.new(0.17, 0, -0.17), tu, nil, nil, r, c, 0.28, 0.2)
	else
		mkTextSprite(cf * CFrame.new(0.18, 0.25, -0.18), "🔍", WHITE, r, c)
	end
end

local function sync3D()
	local3d:ClearAllChildren()
	local bp = findBoardPart()
	if not bp or not view then
		return
	end
	local forced = view.forcedTargets or {}
	local legal = legalOf(selectedId)
	if legal then
		for _, rc in legal.moves do
			mkHighlight(cellCFrame(bp, rc[1], rc[2]), HL.move, rc[1], rc[2], 0.5)
		end
	end
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
		if legal and table.find(legal.attacks, p.id) then
			mkHighlight(cf, HL.attack, p.r, p.c, 0.35)
		end
		if table.find(forced, p.id) then
			mkHighlight(cf, HL.forced, p.r, p.c, 0.3)
		end
		if view.fleePick and table.find(view.fleePick.cands, p.id) then
			mkHighlight(cf, HL.flee, p.r, p.c)
		end
	end
	for _, tr in view.traces do
		local cf = cellCFrame(bp, tr.r, tr.c)
		if not pieceAt(tr.r, tr.c) then
			mkHighlight(cf, WHITE, tr.r, tr.c, 0.7)
		end
		mkTrace3D(cf, tr.r, tr.c)
	end
end

--==================================================================
-- 사전 배치 — 데이터
--==================================================================

local function setupPieceAt(sr, c)
	for i = 1, 14 do
		local rc = setup.pos[i]
		if rc and rc[1] == sr and rc[2] == c then
			return i
		end
	end
	return nil
end

local function placedCount()
	local n = 0
	for i = 1, 14 do
		if setup.pos[i] then
			n += 1
		end
	end
	return n
end

local function nextUnplaced(from)
	for k = 0, 13 do
		local i = ((from or 1) - 1 + k) % 14 + 1
		if not setup.pos[i] then
			return i
		end
	end
	return nil
end

local function slotImage(i)
	local ty = SLOT_TYPES[i]
	if ty == "minion" then
		return Art.icon(setup.roster[i]), nil
	end
	return Art.token(ty, 64), Art.TEAM[myOwner()]
end

local function slotLabel(i)
	local ty = SLOT_TYPES[i]
	if ty == "minion" then
		local rd = Data.rosterById(setup.roster[i])
		return rd and rd.name or "하수인"
	end
	return Data.TYPE_KO[ty]
end

local function rosterFillRandom()
	local rng = Random.new()
	local ids = {}
	for _, r in Data.ROSTER do
		if not table.find(setup.roster, r.id) then
			table.insert(ids, r.id)
		end
	end
	while #setup.roster < 6 and #ids > 0 do
		table.insert(setup.roster, table.remove(ids, rng:NextInteger(1, #ids)))
	end
end

local function autoPlace()
	rosterFillRandom()
	local rng = Random.new()
	local free = {}
	for sr = 11, 13 do
		for c = 1, COLS do
			if not setupPieceAt(sr, c) then
				table.insert(free, { sr, c })
			end
		end
	end
	for i = 1, 14 do
		if not setup.pos[i] and #free > 0 then
			setup.pos[i] = table.remove(free, rng:NextInteger(1, #free))
		end
	end
	setup.tray = nil
end

local function clearPlace()
	setup.pos = {}
	setup.tray = nextUnplaced(1)
end

local function sendReady()
	if #setup.roster ~= 6 then
		flashHud("⛔ 로스터 6종을 먼저 선택하세요")
		return
	end
	if placedCount() ~= 14 then
		flashHud("⛔ 말 14개를 모두 배치하세요 (" .. placedCount() .. "/14)")
		return
	end
	local pos = {}
	for i = 1, 14 do
		pos[i] = { setup.pos[i][1], setup.pos[i][2] }
	end
	send({ t = "ready", setup = { roster = table.clone(setup.roster), pos = pos } })
end

local function sync3DSetup()
	local3d:ClearAllChildren()
	local bp = findBoardPart()
	if not bp then
		return
	end
	local team = Art.TEAM[myOwner()]
	for sr = 11, 13 do
		for c = 1, COLS do
			local er = toEngineRow(sr)
			local cf = cellCFrame(bp, er, c)
			local i = setupPieceAt(sr, c)
			if i then
				mkBase(cf, team, er, c)
				local img, tint = slotImage(i)
				if img then
					mkSprite(cf, img, tint, nil, er, c)
				else
					mkTextSprite(cf, slotLabel(i), team, er, c)
				end
				if i == setup.tray then
					mkHighlight(cf, HL.sel, er, c)
				end
			else
				mkHighlight(cf, team, er, c, setup.tray and 0.55 or 0.82)
			end
		end
	end
end

--==================================================================
-- 카메라·클릭
--==================================================================

-- 판 화면(배치·대전)에서는 모든 캐릭터(나 포함)를 이 클라이언트에서만 숨긴다 — "판만 보이는" 화면
local charsHidden = false
local function applyCharVisibility(char)
	for _, d in char:GetDescendants() do
		if d:IsA("BasePart") or d:IsA("Decal") then
			d.LocalTransparencyModifier = charsHidden and 1 or 0
		elseif d:IsA("Humanoid") then
			d.DisplayDistanceType = charsHidden and Enum.HumanoidDisplayDistanceType.None or Enum.HumanoidDisplayDistanceType.Viewer
		end
	end
end
local function applyAllChars()
	for _, plr in Players:GetPlayers() do
		if plr.Character then
			applyCharVisibility(plr.Character)
		end
	end
end
local function setCharsHidden(on)
	if charsHidden == on then
		return
	end
	charsHidden = on
	applyAllChars()
end
task.spawn(function() -- 숨김 중 새로 들어온 플레이어·리스폰·액세서리도 계속 숨긴다
	while true do
		task.wait(0.5)
		if charsHidden then
			applyAllChars()
		end
	end
end)

local function setBoardCamera(on)
	local cam = Workspace.CurrentCamera
	if not cam then
		return
	end
	local bp = on and findBoardPart() or nil
	if bp and tableInfo then
		local dir = (tableInfo.side == "A") and 1 or -1
		cam.CameraType = Enum.CameraType.Scriptable
		-- 오른쪽 패널(배치 380px·대전 360px)이 판을 가리지 않도록 카메라를 내 기준 오른쪽으로 살짝 옮겨 판을 화면 왼쪽-중앙에 둔다
		local eye = (bp.CFrame * CFrame.new(dir * 1.7, 7.4, dir * 6.4)).Position
		local look = (bp.CFrame * CFrame.new(dir * 1.7, 0, dir * 0.4)).Position
		cam.CFrame = CFrame.lookAt(eye, look)
		setCharsHidden(true)
	else
		setCharsHidden(false)
		if cam.CameraType == Enum.CameraType.Scriptable then
			cam.CameraType = Enum.CameraType.Custom
		end
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
-- 사전 배치 — UI
--==================================================================

local function closeDetail()
	setup.detail = nil
	rosterDetail.Visible = false
	detailBack.Visible = false
end

local function openDetail(rid)
	local rd = Data.rosterById(rid)
	if not rd then
		return
	end
	setup.detail = rid
	rosterDetail.Visible = true
	detailBack.Visible = true
	detailPortrait.Image = Art.portrait(rid) or ""
	local eu = Art.element(rd.element)
	detailElem.Image = eu or ""
	detailElem.Visible = eu ~= nil
	local lines = {
		("<b>%s</b>  %s · %s형"):format(rd.name, Data.ELEM_KO[rd.element], Data.ARCH_KO[rd.arch]),
		("HP %d · 공격 %d  (기술 위력 = 표기 × 공격/%d)"):format(rd.hp, rd.atk, Data.SKILL_ATK_BASE),
		"",
	}
	for i, sid in Data.archSkills(rd.arch, rd.element) do
		local sk = Data.SKILLS[sid]
		local pow = sk.pow and (" 위력 " .. Data.slotPow({ atk = rd.atk }, sk)) or ""
		table.insert(lines, ("%d. <b>%s</b> [%s]%s%s — %s"):format(i, sk.ko, Data.SKIND_KO[sk.kind], pow, sk.cd > 0 and (" 쿨" .. sk.cd) or "", sk.desc))
	end
	detailText.Text = table.concat(lines, "\n")
	clearChildren(detailBtns)
	local on = table.find(setup.roster, rid) ~= nil
	smallBtn(detailBtns, 0, 0, 120, on and "선택 해제" or "선택하기", function()
		local idx = table.find(setup.roster, rid)
		if idx then
			table.remove(setup.roster, idx)
			setup.pos = {}
		elseif #setup.roster < 6 then
			table.insert(setup.roster, rid)
			setup.pos = {}
		else
			flashHud("⛔ 이미 6종을 선택했습니다 — 다른 종을 해제하세요")
			return
		end
		closeDetail()
		renderSetup()
	end, on and "danger" or "primary", on or #setup.roster < 6)
	smallBtn(detailBtns, 126, 0, 70, "닫기", closeDetail)
end

local function renderRosterGrid()
	clearChildren(setupContent)
	local row = 0
	for _, el in Data.ELEMS do -- 속성별로 묶어 한 줄에 3장 (5장 → 3+2)
		local col = 0
		for _, rd in Data.ROSTER do
			if rd.element == el then
				if col == 3 then
					col = 0
					row += 1
				end
				local on = table.find(setup.roster, rd.id) ~= nil
				local card = mk("TextButton", {
					Size = UDim2.new(0, 116, 0, 34), Position = UDim2.new(0, col * 121, 0, row * 37), Text = "",
					BackgroundColor3 = on and Color3.fromRGB(45, 60, 100) or Color3.fromRGB(38, 42, 54), BorderSizePixel = on and 2 or 0,
					BorderColor3 = Color3.fromRGB(91, 140, 255), AutoButtonColor = true,
				}, setupContent)
				local iu = Art.icon(rd.id)
				if iu then
					iconLabel(card, 2, 2, 30, iu)
				else
					mk("TextLabel", { Size = UDim2.new(0, 30, 0, 30), Position = UDim2.new(0, 2, 0, 2), BackgroundTransparency = 1, Text = Data.ELEM_EMO[rd.element] or "", TextSize = 18 }, card)
				end
				local eu = Art.element(rd.element)
				if eu then
					iconLabel(card, 100, 2, 14, eu)
				end
				mk("TextLabel", {
					Size = UDim2.new(1, -52, 0, 16), Position = UDim2.new(0, 34, 0, 1), BackgroundTransparency = 1, Text = rd.name,
					TextSize = 12, Font = Enum.Font.GothamBold, TextColor3 = on and WHITE or Color3.fromRGB(220, 224, 232), TextXAlignment = Enum.TextXAlignment.Left, TextTruncate = Enum.TextTruncate.AtEnd,
				}, card)
				mk("TextLabel", {
					Size = UDim2.new(1, -36, 0, 14), Position = UDim2.new(0, 34, 0, 17), BackgroundTransparency = 1,
					Text = ("%s·%s HP%d 공%d"):format(Data.ELEM_KO[rd.element], Data.ARCH_KO[rd.arch], rd.hp, rd.atk),
					TextSize = 10, Font = Enum.Font.Gotham, TextColor3 = Color3.fromRGB(154, 163, 184), TextXAlignment = Enum.TextXAlignment.Left,
				}, card)
				local rid = rd.id
				card.Activated:Connect(function()
					openDetail(rid)
				end)
				col += 1
			end
		end
		row += 1
	end
end

local function renderTray()
	clearChildren(setupContent)
	local team = Art.TEAM[myOwner()]
	for i = 1, 14 do -- 한 줄에 7개 × 2줄
		local placed = setup.pos[i] ~= nil
		local chip = mk("TextButton", {
			Size = UDim2.new(0, 44, 0, 58), Position = UDim2.new(0, ((i - 1) % 7) * 50, 0, 4 + math.floor((i - 1) / 7) * 62), Text = "",
			BackgroundColor3 = placed and Color3.fromRGB(30, 33, 42) or Color3.fromRGB(43, 49, 64),
			BorderSizePixel = (i == setup.tray) and 2 or 0, BorderColor3 = HL.sel, AutoButtonColor = not placed,
		}, setupContent)
		local iu, tint = slotImage(i)
		if iu then
			local il = iconLabel(chip, 4, 2, 36, iu, tint)
			il.ImageTransparency = placed and 0.65 or 0
		else
			mk("TextLabel", { Size = UDim2.new(1, 0, 0, 36), Position = UDim2.new(0, 0, 0, 2), BackgroundTransparency = 1, Text = slotLabel(i), TextSize = 10, TextColor3 = team, TextWrapped = true }, chip)
		end
		mk("TextLabel", {
			Size = UDim2.new(1, 0, 0, 16), Position = UDim2.new(0, 0, 1, -18), BackgroundTransparency = 1,
			Text = placed and "✔" or slotLabel(i), TextSize = 9, Font = Enum.Font.Gotham, TextColor3 = Color3.fromRGB(180, 188, 205), TextTruncate = Enum.TextTruncate.AtEnd,
		}, chip)
		local slot = i
		chip.Activated:Connect(function()
			if setup.pos[slot] then
				setup.pos[slot] = nil
			end
			setup.tray = slot
			renderSetup()
		end)
	end
	mk("TextLabel", {
		Size = UDim2.new(1, 0, 0, 60), Position = UDim2.new(0, 0, 0, 134), BackgroundTransparency = 1, TextWrapped = true,
		Text = setup.tray and ("손에 든 말: " .. slotLabel(setup.tray) .. " — 판의 내 진영(강조된 3행) 빈 칸을 클릭하면 놓입니다. 놓인 말을 클릭하면 회수.") or "모든 말을 배치했습니다 — [배치 완료] 를 누르세요",
		TextSize = 12, Font = Enum.Font.Gotham, TextColor3 = Color3.fromRGB(180, 188, 205), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top,
	}, setupContent)
end

local function renderBoard2DSetup()
	for r = 1, ROWS do
		for c = 1, COLS do
			local b = cells[dispRow(r)][c]
			cellReset(b, r)
			local sr = toEngineRow(r)
			if sr >= 11 and sr <= 13 then
				local i = setupPieceAt(sr, c)
				if i then
					local iu, tint = slotImage(i)
					if iu then
						b.Icon.Image = iu
						b.Icon.ImageColor3 = tint or WHITE
						b.Icon.Visible = true
					else
						b.Text = slotLabel(i)
					end
					cellHighlight(b, (i == setup.tray) and "sel" or "flee")
				elseif setup.tray then
					cellHighlight(b, "move")
				end
			end
		end
	end
end

function renderSetup()
	if not tableInfo or not tableInfo.setupOpen or (view and view.phase ~= "over") or tableInfo.inGame then
		setupPanel.Visible = false
		closeDetail()
		if not view then -- 대전 뷰가 없으면 창 자체를 닫는다 (대전 종료 화면은 render 가 유지)
			win.Visible = false
			boardFrame.Visible = false
			boardFrameImg.Visible = false
			local3d:ClearAllChildren()
		end
		return
	end
	if tableInfo.myReady then
		setup.stage = "ready"
	elseif setup.stage == "ready" then
		setup.stage = "place"
	end
	setupPanel.Visible = true
	side.Visible = false
	win.Visible = true
	boardFrame.Visible = true
	boardFrameImg.Visible = true
	clearChildren(setupBtns)
	clearChildren(setupTop)
	local ti = tableInfo
	local oppLine = ti.opp and ("상대: " .. ti.opp .. (ti.oppReady and " (배치 완료)" or " (배치 중)")) or "상대 없음 — 맞은편에 누가 앉으면 시작"
	winTitle.Text = ("테이블 %d · %s 자리 · %s"):format(ti.tableId, ti.side, oppLine)
	winStatus.Text = ti.oppBot and "🤖 봇은 로스터·배치를 자동으로 마쳤습니다 — 나만 [배치 완료 ✔] 를 누르면 시작" or "왼쪽 판의 강조된 내 진영 3행에 배치합니다"
	setBotBadge()
	setThinking(false)
	if ti.oppBot then -- 봇 난이도 토글 (배치 완료 전까지)
		local lv = ti.botLevel or "grade5"
		smallBtn(setupTop, 0, 0, 116, ("🤖 %s ▸ %s"):format(lv == "dan5" and "5단" or "5급", lv == "dan5" and "5급" or "5단"), function()
			send({ t = "botLevel", level = (lv == "dan5") and "grade5" or "dan5" })
		end, "default", not ti.myReady, nil, 22)
	end
	local function leaveBtn(_, _) end -- [나가기] 는 창 오른쪽 맨 아래로 통합했다 (CJ 2026-09-10)
	if setup.stage == "roster" then
		setupTitle.Text = ("로스터 선택 (%d/6) — 테이블 %d %s 자리"):format(#setup.roster, ti.tableId, ti.side)
		setupHint.Text = oppLine .. " · 카드를 누르면 상세(초상화·기술)와 선택 버튼"
		renderRosterGrid()
		smallBtn(setupBtns, 0, 2, 110, "무작위 6종", function()
			setup.roster = {}
			setup.pos = {}
			rosterFillRandom()
			renderSetup()
		end)
		smallBtn(setupBtns, 116, 2, 120, "배치로 →", function()
			setup.stage = "place"
			setup.tray = nextUnplaced(1)
			closeDetail()
			renderSetup()
		end, "primary", #setup.roster == 6)
		smallBtn(setupBtns, 0, 36, 240, "⚡ 전부 무작위 배치 완료 (빠른 시작)", function()
			autoPlace()
			closeDetail()
			sendReady()
		end)
		leaveBtn(246, 36)
		local3d:ClearAllChildren()
		renderBoard2DSetup()
	elseif setup.stage == "place" then
		setupTitle.Text = ("비공개 배치 (%d/14) — 테이블 %d %s 자리"):format(placedCount(), ti.tableId, ti.side)
		setupHint.Text = oppLine .. " · 손에 든 말을 왼쪽 판의 내 진영(강조된 3행) 빈 칸에 클릭"
		renderTray()
		smallBtn(setupBtns, 0, 2, 90, "← 로스터", function()
			setup.stage = "roster"
			renderSetup()
		end)
		smallBtn(setupBtns, 96, 2, 110, "남은 말 무작위", function()
			autoPlace()
			renderSetup()
		end)
		smallBtn(setupBtns, 212, 2, 90, "전체 회수", function()
			clearPlace()
			renderSetup()
		end)
		smallBtn(setupBtns, 0, 36, 140, "배치 완료 ✔", sendReady, "primary", placedCount() == 14)
		leaveBtn(146, 36)
		local3d:ClearAllChildren()
		renderBoard2DSetup()
	else
		setupTitle.Text = ("✅ 배치 완료 — 테이블 %d %s 자리"):format(ti.tableId, ti.side)
		setupHint.Text = oppLine .. " · " .. ((ti.opp and ti.oppReady) and "시작 중…" or "상대가 배치를 마치면 시작합니다")
		clearChildren(setupContent)
		smallBtn(setupBtns, 0, 2, 110, "배치 취소", function()
			send({ t = "unready" })
		end)
		leaveBtn(0, 36)
		renderBoard2DSetup()
	end
end

local function onSetupCell(er, c)
	if setup.stage ~= "place" then
		return
	end
	local sr = toEngineRow(er)
	if sr < 11 or sr > 13 then
		return
	end
	local i = setupPieceAt(sr, c)
	if i then
		setup.pos[i] = nil
		setup.tray = i
	elseif setup.tray and not setup.pos[setup.tray] then
		setup.pos[setup.tray] = { sr, c }
		setup.tray = nextUnplaced(setup.tray)
	end
	renderSetup()
end

--==================================================================
-- 로비 상태 표시
--==================================================================

local function setLogWin(on)
	logWinOpen = on
	logWin.Visible = on
	if on then
		refreshLogWin()
	end
end
smallBtn(logWinBtns, 0, 0, 100, "닫기", function()
	setLogWin(false)
end, "primary")
mk("TextLabel", {
	Text = "가장 최근 300줄까지 보관합니다 (내 화면 전용)", Size = UDim2.new(1, -110, 1, 0), Position = UDim2.new(0, 108, 0, 0),
	BackgroundTransparency = 1, TextSize = 11, Font = Enum.Font.Gotham, TextColor3 = Color3.fromRGB(154, 163, 184),
	TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 12,
}, logWinBtns)

local function closeMemo()
	memoPick = nil
	memoFrame.Visible = false
end

local function renderMemo()
	if not memoPick then
		memoFrame.Visible = false
		return
	end
	memoFrame.Visible = true
	clearChildren(memoBtns)
	local cur = memos[memoPick]
	for i, o in MEMO_OPTS do
		local on = cur == o.key
		smallBtn(memoBtns, ((i - 1) % 2) * 140, math.floor((i - 1) / 2) * 30, 134, o.emoji .. " " .. o.ko, function()
			if cur == o.key then -- 같은 항목을 다시 누르면 해제
				memos[memoPick] = nil
			else
				memos[memoPick] = o.key
			end
			closeMemo()
			render()
		end, on and "primary" or "default")
	end
	smallBtn(memoBtns, 0, 124, 134, "메모 지우기", function()
		memos[memoPick] = nil
		closeMemo()
		render()
	end, "danger", cur ~= nil)
	smallBtn(memoBtns, 140, 124, 134, "닫기", function()
		closeMemo()
		render()
	end)
end

local function renderHudButtons()
	clearChildren(hudBtns)
	local x = 0
	local inGame = view ~= nil and view.phase ~= "over"
	if tableInfo and not tableInfo.setupOpen and not inGame and not tableInfo.inGame then
		-- 둘 다 앉은 뒤 한 명이 누르면 양측이 배치 단계로 (서버 startGame)
		smallBtn(hudBtns, x, 0, 110, "▶ 게임 시작", function()
			send({ t = "startGame" })
		end, "primary", tableInfo.opp ~= nil, Art.action("fight"), 24)
		x += 116
	end
	if tableInfo and not tableInfo.setupOpen and not inGame and not tableInfo.inGame and not tableInfo.opp then
		-- 혼자 앉았을 때: AI 대전 ([B] 5급 · [N] 5단 키와 동일)
		smallBtn(hudBtns, x, 0, 100, "🤖 5급 봇", function()
			send({ t = "bot", level = "grade5" })
		end, "primary", true, Art.action("bot"), 24)
		x += 106
		smallBtn(hudBtns, x, 0, 100, "🤖 5단 봇", function()
			send({ t = "bot", level = "dan5" })
		end, "default", true, Art.action("bot"), 24)
		x += 106
	end
	if tableInfo then
		smallBtn(hudBtns, x, 0, 116, "자리 떠나기", function()
			send({ t = "stand" })
		end, "danger", true, Art.action("resign"), 24)
	end
end

local function renderLobby()
	-- 카메라는 배치 단계([게임 시작] 이후) 와 대전 중에만 판을 향한다. 그냥 앉아 있을 때는 자유 시점 (앉은 모습 확인·주변 보기)
	setBoardCamera((view ~= nil and view.phase ~= "over") or (tableInfo ~= nil and tableInfo.setupOpen == true))
	renderHudButtons()
	if view and view.phase ~= "over" then
		setupPanel.Visible = false
		hudLabel.Text = tableInfo and ("테이블 %d · ⚔️ 대전 중 (자리 떠나기 = 기권)"):format(tableInfo.tableId) or "⚔️ 대전 중"
		return
	end
	if not tableInfo then
		hudLabel.Text = "🪑 테이블 의자 앞에서 [E] 앉기 → 둘이 앉으면 [F] 게임 시작 · 혼자면 [B] 5급 봇 / [N] 5단 봇"
			.. (myStats and ("\n🏅 내 전적: " .. myStats.line) or "")
		setupPanel.Visible = false
		closeDetail()
		if not view then
			win.Visible = false
			boardFrame.Visible = false
			boardFrameImg.Visible = false
			local3d:ClearAllChildren()
		end
		return
	end
	local ti = tableInfo
	if ti.setupOpen then
		hudLabel.Text = ("테이블 %d · %s 자리 · 상대: %s\n배치 단계 — 로스터 6종 → 왼쪽 판에 14개 배치 → [배치 완료 ✔] (Enter 로 다음 단계/완료). 창은 [나가기] 로만 닫힙니다"):format(ti.tableId, ti.side, ti.opp or "?")
	else
		hudLabel.Text = ("테이블 %d · %s 자리 · %s\n%s · 일어나기: Space 또는 [자리 떠나기]"):format(ti.tableId, ti.side,
			ti.opp and ("상대: " .. ti.opp) or "상대 기다리는 중 (맞은편 의자)",
			ti.opp and "둘 다 앉았습니다 — [F] (판 앞 프롬프트) 또는 Enter 또는 [▶ 게임 시작] 버튼" or "상대가 앉으면 [F] 게임 시작 · 혼자 하려면 [B] 5급 봇 / [N] 5단 봇")
	end
	renderSetup()
end

function flashHud(text)
	if win.Visible then -- 창이 떠 있으면 HUD 가 숨겨져 있으므로 창 상태줄에 띄운다
		local prev = winStatus.Text
		winStatus.Text = text
		task.delay(1, function()
			if winStatus.Text == text then
				winStatus.Text = prev
			end
		end)
		return
	end
	hudLabel.Text = text
	task.delay(1, function()
		if hudLabel.Text == text then -- 그 사이 다른 갱신이 없었을 때만 원래 안내문으로
			if view then
				safe(render, "render(flash)")
			else
				safe(renderLobby, "renderLobby(flash)")
			end
		end
	end)
end

local function closeGame()
	game_.Visible = false
	win.Visible = false
	view = nil
	selectedId = nil
	teleFirst, teleMode = nil, false
	local3d:ClearAllChildren()
	boardFrame.Visible = false
	boardFrameImg.Visible = false
	renderLobby()
end

--==================================================================
-- 렌더 — 대전
--==================================================================

local function renderBoard2D()
	local forced = view.forcedTargets or {}
	local legal = legalOf(selectedId)
	for r = 1, ROWS do
		for c = 1, COLS do
			local b = cells[dispRow(r)][c]
			cellReset(b, r)
			local hl = nil
			if legal then
				for _, rc in legal.moves do
					if rc[1] == r and rc[2] == c then
						hl = "move"
					end
				end
			end
			local p = pieceAt(r, c)
			if p then
				local team = Art.TEAM[p.owner]
				b.TextColor3 = team
				b.BorderSizePixel = 2
				b.BorderColor3 = team
				local img, tint = pieceImage(p, 64)
				if img then
					b.Icon.Image = img
					b.Icon.ImageColor3 = tint or WHITE
					b.Icon.Visible = true
					local hp = hpText(p)
					if hp then
						b.Hp.Text = hp
						b.Hp.Visible = true
					end
				else
					b.Text = pieceLabel(p)
				end
				if view.fleePick and table.find(view.fleePick.cands, p.id) then
					hl = "flee"
				end
				if p.id == selectedId or p.id == teleFirst then
					hl = "sel"
				end
				if legal and table.find(legal.attacks, p.id) then
					hl = "attack"
				end
				if table.find(forced, p.id) then
					hl = "forced"
				end
				if not p.known and p.owner ~= view.me then -- #36: 실제 공개(known)면 실제 정체가 우선
					local mo = memoOpt(memos[p.id])
					if mo then
						b.Memo.Text = mo.emoji
						b.Memo.Visible = true
						b.MemoIcon.Visible = b.MemoIcon.Image ~= ""
					end
					if memoMode then
						hl = hl or "memo" -- 메모를 남길 수 있는 칸 표시 (Earth board_hl_memo — 금색 점선, 이동·도망과 구분)
					end
				end
			end
			if hl then
				cellHighlight(b, hl)
			end
			for _, tr in view.traces do
				if tr.r == r and tr.c == c then
					cellMark(b)
				end
			end
		end
	end
end

local function renderSide()
	local myTurn = view.phase == "play" and view.current == view.me
	local head = ("<b>%s</b>  턴 %d %s"):format(
		view.phase == "over" and "경기 종료" or (myTurn and "🟢 나의 턴" or (tableInfo and tableInfo.oppBot) and "🤖 AI 행동 중…" or "⏳ 상대 턴"),
		view.turnCount + 1, view.burning and "🔥BT" or "")
	if view.phase == "over" then
		local w = view.winner
		head ..= "\n" .. (w == view.me and "🏆 승리! " or w == -1 and "무승부 " or "패배… ")
			.. "(" .. (view.winType and Data.WINTYPE_KO[view.winType] or "") .. ")"
		if myStats then -- Phase 4 전적 (DataStore)
			head ..= "\n<font size=\"12\" color=\"#9aa3b8\">🏅 " .. myStats.line .. "</font>"
		end
	end
	infoHead.Text = head
	-- 배지 행: 몬스터볼 · 아이템 · 전투 · 예비 하수인
	clearChildren(badgeRow)
	local x = 0
	mkBadge(badgeRow, x, 0, 60, Art.item("ball"), "볼 " .. view.balls)
	x += 64
	mkBadge(badgeRow, x, 0, 74, Art.action("bag"), "아이템 " .. #view.inv)
	x += 78
	mkBadge(badgeRow, x, 0, 70, Art.action("fight"), ("전투 %d/2"):format(view.battlesUsed))
	x += 74
	mkBadge(badgeRow, x, 0, 54, nil, "🎁 " .. (view.gifts or 0)) -- #121 미개봉 패키지 (소유자만)
	x += 58
	mkBadge(badgeRow, x, 0, 54, nil, "✨ " .. (view.buffPacks or 0))
	local info = ""
	if view.reserve then
		info ..= ("예비 하수인(%s) HP %d/%d\n"):format(Data.ELEM_KO[view.reserve.element] or "", view.reserve.hp, view.reserve.maxHp)
	end
	local sel = selectedId and pieceById(selectedId)
	if sel and sel.known then
		info ..= ("선택: %s HP %s"):format(sel.name or Data.TYPE_KO[sel.type or ""] or "?", tostring(sel.hp or "-"))
		local lg = legalOf(selectedId)
		if lg then
			info ..= (" · 이동 %d칸%s"):format(#lg.moves, #lg.attacks > 0 and (" · 공격 가능 " .. #lg.attacks) or "")
		end
		info ..= "\n"
	end
	if teleFirst or teleMode then -- #131 계약 3.2: CJ 지정 2단계 문구
		info ..= (teleFirst and "🌀 교체할 말을 선택해주세요\n" or "🌀 먼저 텔레포트를 할 말을 선택해주세요! (함정에 걸린 말은 제외)\n")
	end
	if view.fleePick then
		info ..= "🏃 도망 성공 — 후방 말(파란 표시) 클릭으로 교환 또는 생략\n"
	end
	if view.fleeWait then
		info ..= "🛗 상대가 말을 교체 중입니다…\n"
	end
	if view.pendingWait then
		info ..= "🔒 상대 선택 대기 중…\n"
	end
	if view.forcedTargets then
		info ..= "⚔️ 강제 전투 — 빨간 대상 클릭\n"
	end
	if memoMode then
		info ..= "📝 메모 모드 — 정체가 안 보이는 상대 말을 클릭해 추측을 남기세요 (내 화면에만 보입니다)\n"
	end
	if myTurn and not sel and not view.battle and info == "" then
		info ..= "내 말을 클릭하면 이동 가능 칸(파랑)·공격 가능 대상(빨강)이 표시됩니다\n"
	end
	if view.mainUsed and myTurn and not view.battle then
		info ..= "주 행동 완료 — 전투 대상이 없으면 자동으로 턴이 넘어갑니다\n"
	end
	infoLabel.Text = info
end

local function renderButtons()
	clearChildren(btnRow)
	local myTurn = view.phase == "play" and view.current == view.me and not view.battle and not view.pending and not view.pendingWait
	if view.fleePick then
		smallBtn(btnRow, 0, 0, 190, "교환 생략 (그대로 밀기)", function()
			send({ t = "fleeSkip" })
		end, "primary", true, Art.action("skip"))
		return
	end
	if not myTurn then
		if view.phase == "over" then
			smallBtn(btnRow, 0, 0, 170, "닫기 (자리로 돌아가기)", closeGame, "primary")
		end
		smallBtn(btnRow, 0, 32, 130, memoMode and "📝 메모 끄기" or "📝 추측 메모", function()
			memoMode = not memoMode
			memoPick = nil
			render()
		end, memoMode and "primary" or "default")
		smallBtn(btnRow, 136, 32, 100, "📜 기록", function()
			setLogWin(true)
		end)
		return
	end
	local lg = legalOf(selectedId)
	smallBtn(btnRow, 0, 0, 90, "탐색", function()
		send({ t = "search", id = selectedId })
	end, "default", lg ~= nil and lg.search, Art.action("search"))
	smallBtn(btnRow, 96, 0, 112, (teleFirst or teleMode) and "취소" or "텔레포트", function()
		if teleFirst or teleMode then -- 취소 → 1단계 이전으로 (문구도 함께 돌아온다)
			teleFirst, teleMode = nil, false
		elseif selectedId then
			teleFirst, teleMode = selectedId, true
		else
			teleMode = true -- 아직 말을 안 골랐으면 1단계 안내부터
		end
		render()
	end, "default", teleFirst ~= nil or teleMode or view.teleAvailable == true, Art.action("teleport"))
	smallBtn(btnRow, 214, 0, 90, "회복", function()
		send({ t = "heal", id = selectedId })
	end, "default", lg ~= nil and lg.heal, Art.action("heal"))
	smallBtn(btnRow, 0, 32, 120, "주 행동 생략", function()
		send({ t = "skipMain" })
	end, "default", not view.mainUsed, Art.action("skip"))
	smallBtn(btnRow, 126, 32, 96, "턴 종료", function()
		send({ t = "endTurn" })
	end, "primary", true, Art.action("endturn"))
	smallBtn(btnRow, 228, 32, 130, memoMode and "📝 메모 끄기" or "📝 추측 메모", function() -- #11·#36 내 화면 전용 추측
		memoMode = not memoMode
		memoPick = nil
		render()
	end, memoMode and "primary" or "default")
	smallBtn(btnRow, 0, 64, 100, "📜 기록", function()
		setLogWin(true)
	end)
end

-- #121 계약 4·6 탐색 보상 선택 창 — 단계별로 다시 그린다 (확정 전에는 서버에 아무것도 보내지 않는다)
local function skillLine(sid, head)
	local sk = Data.SKILLS[sid]
	local cls = sk.cls and (Data.SKILL_CLS_KO[sk.cls] .. " 분류") or (sk.el and Data.ELEM_KO[sk.el] or (Data.SKIND_KO[sk.kind] or ""))
	return ("<b>%s %s%s</b>  %s · 위력 %s · 쿨 %s\n<font color=\"#9aa3b8\">%s</font>"):format(head, sk.cls and (Data.SKILL_CLS_EMO[sk.cls] or "") or "", sk.ko, cls, sk.pow and tostring(sk.pow) or "-", sk.reaper and "봉인" or tostring(sk.cd), sk.desc)
end
local function renderRecruit(pd)
	local token = tostring(pd.pieceId) .. ":" .. tostring(view.turnCount)
	if recruitUi.token ~= token then
		recruitUi = { stage = "root", skill = nil, targetId = nil, recvId = nil, token = token }
	end
	recruitFrame.Visible = true
	modalBack.Visible = true
	clearChildren(recruitBtns)
	local n = 0
	local function rbtn(text, fn, kind, enabled, icon)
		local b = smallBtn(recruitBtns, (n % 2) * 278, math.floor(n / 2) * 32, 272, text, fn, kind or "default", enabled ~= false, icon, 28)
		n += 1
		return b
	end
	local function goto_(stage)
		recruitUi.stage = stage
		renderRecruit(pd)
	end
	local function backBtn(stage)
		rbtn("← 뒤로", function()
			if stage == "target" then
				recruitUi.targetId = nil
			elseif stage == "skill" then
				recruitUi.skill = nil
			elseif stage == "recv" then
				recruitUi.recvId = nil
			end
			goto_(stage)
		end)
	end
	local function giveUpBtn()
		rbtn("포기 (칸은 소모)", function()
			send({ t = "recruitKeep" })
		end, "danger")
	end
	local function minionById(id)
		for _, m in pd.minions do
			if m.id == id then
				return m
			end
		end
		return nil
	end
	local st = recruitUi.stage
	if st == "root" then
		recruitTitle.Text = "🌿 숲에서 무언가를 찾았다"
		recruitText.Text = ("<b>📘 기술 교체</b> — 신규 공용 기술 3종 중 하나를 직접 골라, 내 최초 하수인 6명 중 살아 있는 말의 4슬롯 어디든 바꿉니다.\n<b>🔴 하수인 포획</b> — %s\n포기해도 이 칸은 다시 쓸 수 없습니다.")
			:format(#pd.receivers > 0 and ("동료·왕 중 포획 슬롯이 빈 말 " .. #pd.receivers .. "기가 받을 수 있습니다 (보유 볼 " .. pd.balls .. ")") or "<b>포획 슬롯이 빈 동료·왕이 없습니다 — 포획 불가</b>")
		rbtn("📘 기술 교체", function()
			goto_("skill")
		end, "primary", true, Art.skillKind("attack"))
		rbtn("🔴 하수인 포획", function()
			goto_("recv")
		end, "primary", #pd.receivers > 0, Art.item("ball"))
		giveUpBtn()
	elseif st == "skill" then
		recruitTitle.Text = "📘 배울 기술 선택"
		local lines = {}
		for i, sid in pd.skills do
			table.insert(lines, skillLine(sid, i .. "."))
		end
		recruitText.Text = table.concat(lines, "\n") .. "\n<font color=\"#9aa3b8\">같은 말에 같은 기술을 두 번 장착할 수 없습니다.</font>"
		for i, sid in pd.skills do
			local openFor = false
			for _, m in pd.minions do
				if m.alive and m.skills and not table.find(m.skills, sid) then
					openFor = true
				end
			end
			rbtn(i .. ". " .. Data.SKILLS[sid].ko .. (openFor and "" or " (전원 보유)"), function()
				recruitUi.skill = sid
				goto_("target")
			end, "primary", openFor)
		end
		backBtn("root")
		giveUpBtn()
	elseif st == "target" then
		recruitTitle.Text = ("📘 %s — 대상 말"):format(Data.SKILLS[recruitUi.skill].ko)
		local lines = {}
		for i, m in pd.minions do
			local has = m.skills and table.find(m.skills, recruitUi.skill) ~= nil
			table.insert(lines, ("%d. <b>%s</b> %s · %s"):format(i, m.name or "하수인", m.element and Data.ELEM_KO[m.element] or "", (not m.alive) and "<b>제거됨</b>" or ("HP " .. m.hp .. "/" .. m.maxHp .. " · 공 " .. m.atk .. " · 기술 ? ? ? ?" .. (has and " · <b>이미 보유</b>" or ""))))
		end
		recruitText.Text = table.concat(lines, "\n")
		for i, m in pd.minions do
			local has = m.skills and table.find(m.skills, recruitUi.skill) ~= nil
			local sel = m.alive and m.skills ~= nil and not has
			rbtn(i .. ". " .. (m.name or "하수인") .. (sel and "" or (m.alive and " (보유)" or " (제거됨)")), function()
				recruitUi.targetId = m.id
				goto_("slot")
			end, "primary", sel, Art.icon(m.rosterId))
		end
		backBtn("skill")
		giveUpBtn()
	elseif st == "slot" then
		local m = minionById(recruitUi.targetId)
		if not m or not m.skills then
			goto_("target")
			return
		end
		recruitTitle.Text = ("📘 %s → %s — 바꿀 슬롯"):format(Data.SKILLS[recruitUi.skill].ko, m.name or "하수인")
		local lines = { skillLine(recruitUi.skill, "새 기술:") }
		for i, sid in m.skills do
			table.insert(lines, ("슬롯 %d: <b>%s</b>%s"):format(i, Data.SKILLS[sid].ko, (m.cds[i] > 0) and (" · 남은 쿨 " .. m.cds[i] .. " (승계)") or ""))
		end
		recruitText.Text = table.concat(lines, "\n")
		for i, sid in m.skills do
			rbtn(("슬롯 %d 교체 (%s)"):format(i, Data.SKILLS[sid].ko), function()
				send({ t = "recruitSwap", skill = recruitUi.skill, targetId = m.id, slot = i })
			end, "primary", true, Art.skillKind(Data.SKILLS[sid].kind))
		end
		backBtn("target")
		giveUpBtn()
	elseif st == "recv" then
		recruitTitle.Text = "🔴 포획 하수인을 받을 말"
		local lines = {}
		for i, x in pd.receivers do
			table.insert(lines, ("%d. <b>%s</b> HP %d/%d · 포획 슬롯 비어 있음"):format(i, Data.TYPE_KO[x.type], x.hp, x.maxHp))
		end
		recruitText.Text = table.concat(lines, "\n") .. "\n<font color=\"#9aa3b8\">공격 포획이 실패하면 피해는 탐색한 말이 받습니다.</font>"
		for i, x in pd.receivers do
			rbtn(i .. ". " .. Data.TYPE_KO[x.type], function()
				recruitUi.recvId = x.id
				goto_("mode")
			end, "primary", true, Art.token(x.type, 64))
		end
		backBtn("root")
		giveUpBtn()
	elseif st == "mode" then
		local sp = pd.species
		recruitTitle.Text = ("🔴 포획 시도 (몬스터볼 %d)"):format(pd.balls)
		local sks = {}
		if sp then
			for _, sid in sp.skills do
				table.insert(sks, Data.SKILLS[sid].ko)
			end
		end
		recruitText.Text = (sp and ("발견: <b>%s</b> %s · HP %d · 공 %d · 기술 %s\n<font color=\"#9aa3b8\">이 종의 수치·기술 그대로 합류합니다 (방법을 바꿔도 같은 종)</font>\n"):format(sp.name, Data.ELEM_KO[sp.element] or "", sp.hp, sp.atk, table.concat(sks, "·")) or "")
			.. "안전 포획: 볼 2 · 100%\n위험 포획: 볼 1 · 50% (실패 시 소멸)\n공격 포획: 볼 1 · 70% (실패 시 소멸 + <b>탐색 말</b> HP 25% 피해)"
		rbtn("안전 포획 (볼 2 · 100%)", function()
			send({ t = "capTry", mode = "safe", recvId = recruitUi.recvId })
		end, "primary", pd.balls >= 2, Art.item("ball"))
		rbtn("위험 포획 (볼 1 · 50%)", function()
			send({ t = "capTry", mode = "risky", recvId = recruitUi.recvId })
		end, "default", pd.balls >= 1, Art.item("ball"))
		rbtn("공격 포획 (볼 1 · 70%)", function()
			send({ t = "capTry", mode = "attack", recvId = recruitUi.recvId })
		end, "danger", pd.balls >= 1, Art.item("ball"))
		backBtn("recv")
		giveUpBtn()
	end
end

local function renderPrompt()
	local pd = view.pending
	if pd and pd.kind == "recruit" then -- #121: 전용 창
		promptFrame.Visible = false
		renderRecruit(pd)
		return
	end
	recruitFrame.Visible = false
	modalBack.Visible = view.battle ~= nil
	promptFrame.Visible = pd ~= nil
	clearChildren(promptBtns)
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
			smallBtn(promptBtns, 106, 0, 220, ("하수인(%s) HP %d/%d 대리 출전"):format(Data.ELEM_KO[alt.element], alt.hp, alt.maxHp), function()
				send({ t = "vipPick", use = "cap" })
			end, "primary", true, Art.item("reserve"))
		end
	end
end


-- 전투원 카드: 속성 아이콘 · 이름 · HP 바 · 방어막 바 · 상태 아이콘
local function renderFighterCard(container, fv, label)
	clearChildren(container)
	local z = container.ZIndex
	local name = fv.isCap and ("포획 하수인·" .. (Data.ELEM_KO[fv.element] or "")) or (fv.name or Data.TYPE_KO[fv.pieceType] or "?")
	local x = 0
	local eu = Art.element(fv.element)
	if eu then
		iconLabel(container, 0, 0, 20, eu, nil, z + 1)
		x = 24
	end
	mk("TextLabel", {
		Size = UDim2.new(1, -x, 0, 20), Position = UDim2.new(0, x, 0, 0), BackgroundTransparency = 1, RichText = true,
		Text = ("<b>%s</b> %s (%s)"):format(label, name, fv.owner == view.me and "나" or "상대"), TextSize = 13, Font = Enum.Font.Gotham,
		TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left, ZIndex = z + 1, TextTruncate = Enum.TextTruncate.AtEnd,
	}, container)
	local hp = mkBar(container, 0, 24, 150, 12, "hp", z + 1)
	setBar(hp, fv.hp / fv.maxHp)
	mk("TextLabel", {
		Size = UDim2.new(0, 100, 0, 12), Position = UDim2.new(0, 156, 0, 24), BackgroundTransparency = 1,
		Text = ("HP %d/%d"):format(fv.hp, fv.maxHp), TextSize = 11, Font = Enum.Font.GothamBold, TextColor3 = WHITE,
		TextXAlignment = Enum.TextXAlignment.Left, ZIndex = z + 1,
	}, container)
	local sh = mkBar(container, 0, 39, 150, 8, "sh", z + 1)
	setBar(sh, fv.shield / fv.maxHp)
	if fv.shield > 0 then
		mk("TextLabel", {
			Size = UDim2.new(0, 100, 0, 10), Position = UDim2.new(0, 156, 0, 38), BackgroundTransparency = 1,
			Text = "방어막 " .. fv.shield, TextSize = 10, Font = Enum.Font.Gotham, TextColor3 = Color3.fromRGB(0x4d, 0xa3, 0xff),
			TextXAlignment = Enum.TextXAlignment.Left, ZIndex = z + 1,
		}, container)
	end
	local sx = 0
	local function st(key, txt, fallback)
		local u = Art.status(key)
		if u then
			iconLabel(container, sx, 52, 18, u, nil, z + 1)
			sx += 20
		else
			txt = fallback .. (txt or "")
		end
		if txt and txt ~= "" then
			local w = 8 + 7 * #txt
			mk("TextLabel", {
				Size = UDim2.new(0, w, 0, 18), Position = UDim2.new(0, sx, 0, 52), BackgroundTransparency = 1, Text = txt,
				TextSize = 11, Font = Enum.Font.GothamBold, TextColor3 = WHITE, TextXAlignment = Enum.TextXAlignment.Left, ZIndex = z + 1,
			}, container)
			sx += w
		end
		sx += 4
	end
	if fv.burn > 0 then
		st("burn", fv.burn .. "R", "🔥")
	end
	if fv.weaken > 0 then
		st("weaken", fv.weaken .. "회", "💧")
	end
	if fv.shock > 0 then
		st("shock", "", "⚡")
	end
	if fv.dmgCut > 0 then
		st("dmgcut", math.floor(fv.dmgCut * 100 + 0.5) .. "%", "🌀")
	end
	if fv.focusCharge then
		st("focus", "", "🎯")
	end
	if fv.vulnMark then
		st("vuln", "+15%", "⚠️")
	end
end

local function fighterImage(fv)
	if fv.isCap or fv.pieceType == "minion" then
		return Art.battle(fv.artRosterId), nil
	end
	return Art.token(fv.pieceType, 128), Art.TEAM[fv.owner]
end

local function renderBattle()
	local bt = view.battle
	battleFrame.Visible = bt ~= nil
	if bt then
		modalBack.Visible = true
	elseif not recruitFrame.Visible then
		modalBack.Visible = false
	end
	if not bt then
		battleSub = nil
		return
	end
	local myActing = bt.actorOwner == view.me
	local topSide = (bt.mySide == "A") and "D" or "A"
	renderFighterCard(fighterTop, bt[topSide], topSide == "A" and "[공격]" or "[방어]")
	renderFighterCard(fighterBottom, bt[bt.mySide], bt.mySide == "A" and "[공격]" or "[방어]")
	local buffs = {}
	if bt.buffA then
		table.insert(buffs, "A " .. Data.BUFFS[bt.buffA].ko)
	end
	if bt.buffD then
		table.insert(buffs, "D " .. Data.BUFFS[bt.buffD].ko)
	end
	battleRound.Text = ("⚔️ 라운드 %d/%d%s — %s%s"):format(bt.round, bt.maxRounds, bt.timed and " 🧭" or "", myActing and "🟢 나의 행동" or "⏳ 상대 행동",
		#buffs > 0 and ("  ✨ " .. table.concat(buffs, " · ")) or "")
	for _, pair in { { spriteTop, bt[topSide] }, { spriteBottom, bt[bt.mySide] } } do
		local img, fv = pair[1], pair[2]
		local u, tint = fighterImage(fv)
		img.Image = u or ""
		img.ImageColor3 = tint or WHITE
		img.Visible = u ~= nil
	end
	clearChildren(battleBtns)
	if not myActing then
		battleSub = nil
		return
	end
	local myF = bt[bt.mySide]
	if battleSub == "gift" then -- #121 계약 2.2: 선물 개봉 — 4종 중 1개, 취소는 무소모
		for i, k in Data.GIFT_PICKS do
			smallBtn(battleBtns, ((i - 1) % 2) * 186, math.floor((i - 1) / 2) * 30, 180, "🎁 " .. Data.GIFT_KO[k], function()
				battleSub = nil
				send({ t = "gift", pick = k })
			end, "primary", true, Art.item(k))
		end
		smallBtn(battleBtns, 0, 62, 100, "취소", function()
			battleSub = nil
			render()
		end)
		return
	elseif battleSub == "buff" then -- #121 계약 3: 버프 3종 중 1개 (시간은 1R 전용) — 전투당 1개
		for i, k in Data.BUFF_KEYS do
			local enabled = not (k == "time" and bt.round ~= 1)
			smallBtn(battleBtns, 0, (i - 1) * 30, 366, Data.BUFFS[k].ko .. (enabled and "" or " (1라운드 전용)"), function()
				battleSub = nil
				send({ t = "buff", kind = k })
			end, "primary", enabled)
		end
		smallBtn(battleBtns, 0, 94, 100, "취소", function()
			battleSub = nil
			render()
		end)
		return
	end
	if myF.skills then
		for i = 1, 4 do
			local sv = myF.skills[i]
			local text, kind
			local enabled = bt.usable ~= nil and bt.usable[i] == true
			if sv.id then
				local sk = Data.SKILLS[sv.id]
				local tag = ""
				if sv.cd > 0 then
					tag = " (쿨" .. sv.cd .. ")"
				elseif sk.reaper and not enabled then
					tag = " (봉인)" -- #121 계약 5.3: 쿨이 아니라 봉인
				end
				text = (sk.cls and (Data.SKILL_CLS_EMO[sk.cls] or "") or "") .. sk.ko .. tag
				kind = sk.kind
			else
				text = "? " .. (Data.SKIND_KO[sv.kind] or "")
				kind = sv.kind
			end
			smallBtn(battleBtns, ((i - 1) % 2) * 186, math.floor((i - 1) / 2) * 30, 180, text, function()
				send({ t = "act", k = i })
			end, "default", enabled, Art.skillKind(kind))
		end
		if bt.canPass then -- #146 계약 2.1: 기본 공격을 주지 않고 안내 + 명시적 수동 종료만 (누르기 전에는 넘어가지 않는다)
			smallBtn(battleBtns, 0, 62, 200, "⏭️ 행동 넘기기", function()
				send({ t = "pass" })
			end, "primary", true, Art.action("skip"))
		end
	else
		smallBtn(battleBtns, 0, 0, 120, "기본 공격", function()
			send({ t = "act", k = "basic" })
		end, "default", true, Art.action("fight"))
	end
	local shown = 0
	for i, k in bt.myItems do -- #121 계약 2.3: 라운드 1회만 (전투 횟수·연속 동일 제한 없음)
		if shown < 3 then
			smallBtn(battleBtns, 106 + shown * 88, 62, 84, Data.ITEMS[k].ko, function()
				send({ t = "item", i = i })
			end, "default", not bt.itemRound, Art.item(k))
			shown += 1
		end
	end
	smallBtn(battleBtns, 0, 94, 106, "볼 던지기", function()
		send({ t = "ball" })
	end, "danger", true, Art.item("ball"))
	smallBtn(battleBtns, 112, 94, 92, ("도망 %d%%"):format(math.floor((bt.fleeProb or 0.3) * 100 + 0.5)), function()
		send({ t = "flee" })
	end, "default", bt.canFlee ~= false, Art.action("flee")) -- #146: HP 조건 없음 · 기본 30% · 도망의 수호자 70%
	smallBtn(battleBtns, 210, 94, 76, "🎁 " .. (view.gifts or 0), function()
		battleSub = "gift"
		render()
	end, "default", (view.gifts or 0) > 0)
	smallBtn(battleBtns, 292, 94, 76, "✨ " .. (view.buffPacks or 0), function()
		battleSub = "buff"
		render()
	end, "default", (view.buffPacks or 0) > 0 and bt.buffUsed == nil)
	local hint = (bt.itemRound and "아이템: 이번 라운드 사용함" or "아이템: 라운드 1회") .. " · " .. (bt.buffUsed and ("버프: " .. Data.BUFFS[bt.buffUsed].ko) or "버프: 전투당 1개")
	if bt.canPass then -- #146 계약 2.1 안내 (소유자 화면에만 — 공용 로그에 사유를 쓰지 않는다)
		hint = "⚠️ 공격할 것이 없습니다. 턴 종료할까요?\n" .. hint
	end
	if myF.skills and bt.reaperWhy then
		for i = 1, 4 do
			local sv = myF.skills[i]
			if sv.id and Data.SKILLS[sv.id].reaper then
				hint ..= "\n💀 " .. bt.reaperWhy
			end
		end
	end
	mk("TextLabel", {
		Size = UDim2.new(1, 0, 0, 40), Position = UDim2.new(0, 0, 0, 126), BackgroundTransparency = 1, Text = hint, TextWrapped = true,
		TextSize = 11, Font = Enum.Font.Gotham, TextColor3 = Color3.fromRGB(154, 163, 184), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, ZIndex = 6,
	}, battleBtns)
end

function render()
	if not view then
		return
	end
	setupPanel.Visible = false
	closeDetail()
	game_.Visible = true
	win.Visible = true
	side.Visible = true
	local bp = findBoardPart()
	boardMode = "2d"
	boardFrame.Visible = true
	boardFrameImg.Visible = true
	DIAG.board = bp and " · 판 2d" or " · 판 없음(2D)"
	refreshFooter()
	renderLobby()
	renderBoard2D()
	local3d:ClearAllChildren()
	winTitle.Text = tableInfo and ("테이블 %d · %s 자리 · 상대: %s"):format(tableInfo.tableId, tableInfo.side, tableInfo.opp or "?") or "대전"
	local thinking = (tableInfo and tableInfo.oppBot and view.phase == "play" and view.current ~= view.me) == true
	winStatus.Text = thinking and "🤖 AI 행동 중…"
		or (view.phase == "over" and "경기가 끝났습니다 — [닫기] 로 자리로 돌아가거나 [나가기]" or "")
	setBotBadge()
	setThinking(thinking)
	do -- #11: 보드에서 사라진 말의 메모는 정리한다
		local alive = {}
		for _, p in view.board do
			alive[p.id] = true
		end
		for id in memos do
			if not alive[id] then
				memos[id] = nil
			end
		end
		if memoPick and not alive[memoPick] then
			closeMemo()
		end
	end
	renderMemo()
	renderSide()
	renderButtons()
	renderPrompt()
	renderBattle()
end

--==================================================================
-- 입력
--==================================================================

local function onCell(r, c)
	if not view then
		return
	end
	local p = pieceAt(r, c)
	if memoMode then -- #11·#36: 메모 모드에서는 미공개 상대 말을 눌러 추측을 남긴다 (규칙 행동 없음)
		if p and p.owner ~= view.me and not p.known then
			memoPick = p.id
			renderMemo()
		else
			flashHud("📝 메모는 정체가 드러나지 않은 상대 말에만 남길 수 있습니다")
		end
		return
	end
	if view.phase ~= "play" then
		return
	end
	if view.fleePick then
		if p and table.find(view.fleePick.cands, p.id) then
			send({ t = "fleeSwap", id = p.id })
		end
		return
	end
	if view.current ~= view.me or view.battle or view.pending or view.pendingWait then
		return
	end
	if teleFirst or teleMode then
		if p and p.owner == view.me and (p.immobile or 0) > 0 then -- #131 계약 3.2: 거부 안내는 소유자 화면에만
			flashHud("⛔ 함정에 걸린 하수인은 텔레포트를 사용할 수 없습니다")
			return
		end
		if teleFirst then
			if p and p.owner == view.me and p.id ~= teleFirst then
				send({ t = "tele", aId = teleFirst, bId = p.id })
				teleFirst, teleMode = nil, false
			elseif p and p.id == teleFirst then
				teleFirst = nil -- 첫 말 재클릭 = 선택 취소 → 1단계로
				render()
			end
		elseif p and p.owner == view.me then
			teleFirst = p.id
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

local function onBoardClick(r, c)
	if view and view.phase == "play" then
		onCell(r, c)
	elseif tableInfo and setupPanel.Visible then
		onSetupCell(r, c)
	end
end

for dr = 1, ROWS do
	for c = 1, COLS do
		cells[dr][c].Activated:Connect(function()
			local r = (myOwner() == 1) and (ROWS + 1 - dr) or dr
			onBoardClick(r, c)
		end)
	end
end

-- 키 입력: F / Enter = 게임 시작 (둘 다 착석 시) · Enter = 배치 단계 진행(로스터 6종 → 배치, 14개 배치 → 완료)
UserInputService.InputBegan:Connect(function(input, processed)
	if processed or input.UserInputType ~= Enum.UserInputType.Keyboard then
		return
	end
	local k = input.KeyCode
	if k == Enum.KeyCode.B or k == Enum.KeyCode.N then -- 혼자 앉은 상태에서 AI 대전 (B = 5급, N = 5단)
		if tableInfo and not tableInfo.setupOpen and not tableInfo.inGame and not view then
			if tableInfo.opp then
				flashHud("⛔ 맞은편에 상대가 있습니다 — [F] 로 시작하세요")
			else
				send({ t = "bot", level = (k == Enum.KeyCode.N) and "dan5" or "grade5" })
			end
		end
		return
	end
	if k ~= Enum.KeyCode.F and k ~= Enum.KeyCode.Return and k ~= Enum.KeyCode.KeypadEnter then
		return
	end
	if (view and view.phase == "play") or not tableInfo or tableInfo.inGame then
		return
	end
	if not tableInfo.setupOpen then
		if tableInfo.opp then
			send({ t = "startGame" }) -- 프롬프트 [F] 와 겹쳐도 서버가 한 번만 처리
		else
			flashHud("⛔ 맞은편에 상대가 앉아야 시작할 수 있습니다")
		end
	elseif k ~= Enum.KeyCode.F then
		if setup.stage == "roster" and #setup.roster == 6 then
			setup.stage = "place"
			setup.tray = nextUnplaced(1)
			closeDetail()
			renderSetup()
		elseif setup.stage == "place" and placedCount() == 14 then
			sendReady()
		end
	end
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed or force2D then
		return
	end
	if input.UserInputType ~= Enum.UserInputType.MouseButton1 and input.UserInputType ~= Enum.UserInputType.Touch then
		return
	end
	if not ((view and game_.Visible) or (tableInfo and setupPanel.Visible)) then
		return
	end
	local r, c = raycastCell(input.Position)
	if r then
		onBoardClick(r, c)
	end
end)

safe(renderLobby, "renderLobby(init)")
DIAG.ui = true
refreshFooter()

--==================================================================
-- 서버 수신
--==================================================================

reState.OnClientEvent:Connect(function(msg)
	if msg.t == "table" then
		tableInfo = msg
		if msg.setupOpen and not lastSetupOpen then -- [게임 시작] 직후: 배치 단계 초기화 (로스터가 6종이면 바로 배치로)
			setup.stage = (#setup.roster == 6) and "place" or "roster"
			setup.tray = nextUnplaced(1)
			closeDetail()
		end
		lastSetupOpen = msg.setupOpen == true
		if view then
			safe(render, "render(table)")
		else
			safe(renderLobby, "renderLobby(table)")
		end
		return
	elseif msg.t == "left" then
		tableInfo = nil
		lastSetupOpen = false
		closeDetail()
		if view then
			safe(closeGame, "closeGame")
		else
			safe(renderLobby, "renderLobby(left)")
		end
		return
	elseif msg.t == "stats" then -- Phase 4 전적 (서버가 접속 시·대전 종료 시 보낸다)
		myStats = msg
		safe(function()
			if view then
				render()
			else
				renderLobby()
			end
		end, "render(stats)")
		return
	elseif msg.t == "reject" then
		addLog("⛔ " .. (msg.reason or "거부됨"))
		flashHud("⛔ " .. (msg.reason or "거부됨"))
		return
	elseif msg.t == "state" then
		local prevBattle = view and view.battle ~= nil
		local prevTurn = view and view.turnCount or nil
		local prevPhase = view and view.phase or nil
		view = msg.view
		selectedId = selectedId and pieceById(selectedId) and selectedId or nil
		if view.battle == nil and prevBattle then
			teleFirst, teleMode = nil, false
			Fx.stop(battleFx) -- 창이 닫히는데 연출만 남지 않게
		end
		for _, ev in msg.events do
			if ev.t == "log" then
				addLog(ev.text)
				local b = bannerFromLog(ev.text)
				if b then
					banner(b.title, b.sub, b.tone, b.fx) -- 폭탄·함정·포획·도망은 배너 안에서 연출까지 재생한다
				end
			elseif ev.t == "bmsg" then
				if ev.big or string.find(ev.text, "전투 개시!", 1, true) then -- 전투 개시·판정은 중앙 배너로도
					banner(ev.text, nil, "warn")
				end
				Fx.play(battleFx, Banner.fxFromBattle(ev.text)) -- 연출 키가 없으면 아무것도 안 한다
				battleMsg.Text = (battleMsg.Text ~= "" and battleMsg.Text .. "\n" or "") .. ev.text
				local lines = string.split(battleMsg.Text, "\n")
				while #lines > 7 do
					table.remove(lines, 1)
				end
				battleMsg.Text = table.concat(lines, "\n")
				addLog(ev.text)
			elseif ev.t == "contact" then
				addLog("⚠️ 접촉 발생!")
				local mineAtt = ev.attOwner == view.me
				banner("⚠️ 적 발견 — 접촉!", mineAtt and "내 말이 상대 말과 부딪혔습니다" or "상대 말이 내 말과 부딪혔습니다", "warn")
			end
		end
		if prevTurn ~= nil and view.phase == "play" and view.turnCount ~= prevTurn then -- 턴 전환
			local mine = view.current == view.me
			banner(mine and "🟢 나의 턴" or "⏳ 상대 턴", ("턴 %d%s"):format(view.turnCount + 1, view.burning and " · 🔥 버닝 타임" or ""), mine and "good" or "default")
		end
		if prevPhase == "play" and view.phase == "over" then -- 경기 결과
			local w = view.winner
			banner(w == view.me and "🏆 승리!" or w == -1 and "무승부" or "패배…",
				view.winType and Data.WINTYPE_KO[view.winType] or nil, w == view.me and "good" or w == -1 and "default" or "bad")
		end
		if msg.oppWaiting then -- Phase 4 재접속: 상대가 끊겼지만 자리를 잡아 두고 기다리는 중
			addLog(("🔌 상대의 연결이 끊어졌습니다 — %d초 안에 돌아오면 이어서 진행합니다."):format(msg.oppWaiting))
			banner("🔌 상대 접속 끊김", ("%d초 안에 돌아오면 이어서 진행합니다"):format(msg.oppWaiting), "warn")
		end
		if msg.opponentLeft then
			addLog("🔌 상대의 연결이 끊어졌습니다.")
		end
		safe(render, "render(state)")
	end
end)
