--!nonstrict
-- Ui.luau — UI 만들기 헬퍼 + 화면 맞춤(UIScale) + 연출 재생기. 게임 상태를 갖지 않는 순수 표시 도구다.
-- init.client.luau 에서 **원문 그대로** 옮겼다 (Luau 는 함수 하나가 지역 변수 200개까지만 쓸 수 있는데
-- 클라이언트 본체가 그 한도에 닿았다 — 2026-09-10 전투 연출을 붙이다 빌드가 멈췄다).
-- Rojo 가 src/client/ 의 형제 파일을 Client LocalScript 의 **자식 ModuleScript** 로 올린다 → require(script.Ui)

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Workspace = game:GetService("Workspace")
local Art = require(Shared:WaitForChild("Art"))

local WHITE = Color3.new(1, 1, 1)

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

local Ui = {
	WHITE = WHITE,
	mk = mk,
	slice = slice,
	bgImage = bgImage,
	iconLabel = iconLabel,
	smallBtn = smallBtn,
	mkBadge = mkBadge,
	mkBar = mkBar,
	setBar = setBar,
	clearChildren = clearChildren,
	autoFit = autoFit,
	applyFit = applyFit,
	fxMk = Fx.mk, -- 연출 라벨 만들기 (부모, x, y, 크기, ZIndex)
	fxPlay = Fx.play, -- 한 번 재생 (라벨, 키) — 키가 nil 이거나 자산이 없으면 false
	fxStop = Fx.stop, -- 재생 중이면 끊고 숨긴다
}

return Ui
