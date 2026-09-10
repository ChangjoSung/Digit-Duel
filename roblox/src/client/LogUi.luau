--!nonstrict
-- LogUi.luau — 📜 게임 기록 (사이드 패널 최근 14줄 + 전체 기록 창).
-- init.client.luau 에서 **원문 그대로** 옮겼다 (Luau 는 함수 하나가 지역 변수 200개까지만 쓸 수 있는데
-- 클라이언트 본체가 그 한도에 닿았다 — 2026-09-10 전투 연출을 붙이다 빌드가 멈췄다).
-- Rojo 가 src/client/ 의 형제 파일을 Client LocalScript 의 **자식 ModuleScript** 로 올린다 → require(script.LogUi)
-- 내 화면 전용이다 — 서버로 아무것도 보내지 않는다.

local LogUi = {}

-- gui: 기록 창을 붙일 ScreenGui · Ui: Ui.luau
function LogUi.mount(gui, Ui)
	local mk, bgImage, autoFit, smallBtn = Ui.mk, Ui.bgImage, Ui.autoFit, Ui.smallBtn
	local logLines = {}
	local logBox = nil -- 사이드 패널의 최근 14줄 라벨 (init 이 만들어 setBox 로 넘긴다)
	-- 📜 게임 기록 창 — 사이드 패널의 최근 14줄 말고 **전체 기록**을 스크롤해서 본다 (내 화면 전용)
	local logWin = mk("Frame", {
		Size = UDim2.new(0, 560, 0, 420), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
		BackgroundColor3 = Color3.fromRGB(24, 27, 37), BorderSizePixel = 0, Visible = false, ZIndex = 12,
	}, gui)
	bgImage(logWin, "panel_modal", "panel", 1)
	Ui.autoFit(logWin, 560, 420)
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

	local logWinOpen = false
	local function refreshLogWin()
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

	local function addLog(text)
		table.insert(logLines, text)
		while #logLines > 300 do -- 전체 기록은 [📜 기록] 창에서 본다 (사이드 패널은 최근 14줄만)
			table.remove(logLines, 1)
		end
		local tail = {}
		for i = math.max(1, #logLines - 13), #logLines do
			table.insert(tail, logLines[i])
		end
		if logBox then -- 사이드 패널이 아직 연결되기 전에도 창에는 쌓인다
			logBox.Text = table.concat(tail, "\n")
		end
		if logWinOpen then
			refreshLogWin()
		end
	end

	return {
		setBox = function(label) -- 사이드 패널 라벨 연결 (없으면 창에만 쌓인다)
			logBox = label
		end,
		add = addLog,
		setWin = setLogWin,
		isOpen = function()
			return logWinOpen
		end,
		lines = function()
			return logLines
		end,
	}
end

return LogUi
