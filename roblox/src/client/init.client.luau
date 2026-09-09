--!nonstrict
-- init.client.luau — Digit Dual Roblox 클라이언트 스캐폴드 (Phase 1)
-- 목적: Studio 2인 로컬 테스트로 배치→매칭→대전→종료 전 플로우를 돌릴 수 있는 최소 UI.
-- 아트·연출·수동 배치 UI는 Phase 2 (Earth 자산 + FX 포팅). 지금은 무작위 배치 + 기능 버튼 중심.
-- 보드 표시: P2는 행 반사(#93 — 논리 좌표 불변, 화면만 뒤집는다).

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local StarterGui = game:GetService("StarterGui")

local CLIENT_VERSION = "0.5.0-p1.2"

local remotes = ReplicatedStorage:WaitForChild("DDRemotes")
local reAction = remotes:WaitForChild("Action")
local reState = remotes:WaitForChild("State")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

-- 아바타 없는 2D 보드게임: 체력바·가방 등 캐릭터용 기본 UI 숨김 (실패해도 무시)
task.defer(function()
	for _, ct in { Enum.CoreGuiType.Health, Enum.CoreGuiType.Backpack, Enum.CoreGuiType.EmotesMenu } do
		pcall(function()
			StarterGui:SetCoreGuiEnabled(ct, false)
		end)
	end
end)

-- 진단 푸터: 이 스크립트가 여기까지 왔고 서버가 응답하는지 화면에 표시한다.
-- 아래 UI 구성 중 오류가 나면 이 라벨은 "서버 확인 중…" 또는 "서버 연결됨"에서 멈추고 버튼은 반응하지 않는다 → Output 창 확인
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
local DIAG = { server = "서버 확인 중…", modules = false, ui = false }
local function refreshFooter()
	footer.Text = ("client v%s · %s%s%s"):format(CLIENT_VERSION, DIAG.server, DIAG.modules and " · 모듈 OK" or "", DIAG.ui and " · UI OK" or "")
end
refreshFooter()
reState.OnClientEvent:Connect(function(msg)
	if type(msg) == "table" and msg.t == "hello" then
		DIAG.server = ("server v%s 연결됨 · 접속 %d명%s"):format(tostring(msg.version), msg.players or 0, msg.waiting and " · 대기자 있음" or "")
		refreshFooter()
	end
end)
reAction:FireServer({ t = "ping" })

-- 모듈은 복제가 끝난 뒤에 읽는다 — 실서버(팀 테스트·라이브)에서는 Shared 폴더가 먼저 오고 자식 모듈이 뒤따를 수 있다 (직접 인덱스는 경합)
local Data = require(Shared:WaitForChild("Data"))
local Art = require(Shared:WaitForChild("Art")) -- #89 하수인 아트 (AssetIds 비어 있으면 전부 nil → 텍스트 폴백)
DIAG.modules = true
refreshFooter()

local COLS, ROWS = 7, 13
local CELL = 34

-- 현재 상태
local view = nil
local selectedId = nil
local teleFirst = nil -- 텔레포트 1번째 말 id
local logLines = {}

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

-- 메뉴
local menu = mk("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(18, 20, 28) }, gui)
mk("TextLabel", {
	Text = "Digit Dual — Roblox 프로토타입", Size = UDim2.new(1, 0, 0, 60), Position = UDim2.new(0, 0, 0.25, 0),
	TextColor3 = Color3.fromRGB(232, 236, 245), BackgroundTransparency = 1, TextSize = 28, Font = Enum.Font.GothamBold,
}, menu)
local queueBtn = mk("TextButton", {
	Text = "🌐 빠른 매칭 (무작위 배치)", Size = UDim2.new(0, 280, 0, 48), Position = UDim2.new(0.5, -140, 0.42, 0),
	TextColor3 = Color3.new(1, 1, 1), BackgroundColor3 = Color3.fromRGB(91, 140, 255), TextSize = 18, Font = Enum.Font.GothamBold,
}, menu)
local menuStatus = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, 0, 0, 30), Position = UDim2.new(0, 0, 0.52, 0),
	TextColor3 = Color3.fromRGB(154, 163, 184), BackgroundTransparency = 1, TextSize = 15, Font = Enum.Font.Gotham,
}, menu)

-- 게임 화면
local game_ = mk("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(18, 20, 28), Visible = false }, gui)

local boardFrame = mk("Frame", {
	Size = UDim2.new(0, COLS * CELL, 0, ROWS * CELL), Position = UDim2.new(0, 20, 0, 40),
	BackgroundColor3 = Color3.fromRGB(30, 34, 46),
}, game_)

local cells = {} -- [r][c] = TextButton
for dr = 1, ROWS do
	cells[dr] = {}
	for c = 1, COLS do
		local b = mk("TextButton", {
			Size = UDim2.new(0, CELL - 2, 0, CELL - 2), Position = UDim2.new(0, (c - 1) * CELL + 1, 0, (dr - 1) * CELL + 1),
			Text = "", TextSize = 12, Font = Enum.Font.Gotham, TextColor3 = Color3.new(1, 1, 1),
			BackgroundColor3 = Color3.fromRGB(43, 49, 64), BorderSizePixel = 0,
		}, boardFrame)
		-- 종 아이콘(icon64 → 셀 크기 정수 배율 아님이라 Fit + Pixelated) · HP 숫자 · 흔적 마커 — 아트 없으면 숨기고 버튼 텍스트로 폴백
		mk("ImageLabel", {
			Name = "Icon", Size = UDim2.new(1, -4, 1, -4), Position = UDim2.new(0, 2, 0, 2), BackgroundTransparency = 1,
			ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResampleMode.Pixelated, Visible = false, ZIndex = 2,
		}, b)
		mk("TextLabel", {
			Name = "Hp", Size = UDim2.new(1, -2, 0, 12), Position = UDim2.new(0, 0, 1, -12), BackgroundTransparency = 1,
			Text = "", TextSize = 10, Font = Enum.Font.GothamBold, TextColor3 = Color3.new(1, 1, 1), TextStrokeTransparency = 0.2,
			TextXAlignment = Enum.TextXAlignment.Right, Visible = false, ZIndex = 3,
		}, b)
		mk("TextLabel", {
			Name = "Mark", Size = UDim2.new(0, 14, 0, 12), Position = UDim2.new(0, 1, 0, 0), BackgroundTransparency = 1,
			Text = "🔍", TextSize = 10, Font = Enum.Font.Gotham, TextColor3 = Color3.new(1, 1, 1), Visible = false, ZIndex = 3,
		}, b)
		cells[dr][c] = b
	end
end

local side = mk("Frame", {
	Size = UDim2.new(0, 360, 0, ROWS * CELL), Position = UDim2.new(0, COLS * CELL + 40, 0, 40),
	BackgroundColor3 = Color3.fromRGB(24, 27, 37),
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
	TextColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham, TextWrapped = true,
	TextXAlignment = Enum.TextXAlignment.Left,
}, promptFrame)
local promptBtns = mk("Frame", { Size = UDim2.new(1, -12, 0, 60), Position = UDim2.new(0, 6, 0, 46), BackgroundTransparency = 1 }, promptFrame)

-- 전투 패널
local battleFrame = mk("Frame", {
	Size = UDim2.new(0, 380, 0, 430), Position = UDim2.new(0.5, -190, 0.5, -215),
	BackgroundColor3 = Color3.fromRGB(28, 32, 44), Visible = false, ZIndex = 5,
}, game_)
local battleTop = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -120, 0, 70), Position = UDim2.new(0, 8, 0, 6), ZIndex = 5,
	TextColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true, RichText = true,
}, battleFrame)
local battleBottom = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -120, 0, 70), Position = UDim2.new(0, 8, 0, 80), ZIndex = 5,
	TextColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham,
	TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true, RichText = true,
}, battleFrame)
-- #91 전투 도트 (battle256 → 96px 표시, Pixelated). 왕·동료 본체·업로드 전에는 숨김
local function mkSprite(y)
	return mk("ImageLabel", {
		Size = UDim2.new(0, 96, 0, 96), Position = UDim2.new(1, -104, 0, y), BackgroundTransparency = 1, ZIndex = 6,
		ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResampleMode.Pixelated, Visible = false,
	}, battleFrame)
end
local spriteTop, spriteBottom = mkSprite(2), mkSprite(76)
local battleMsg = mk("TextLabel", {
	Text = "", Size = UDim2.new(1, -16, 0, 120), Position = UDim2.new(0, 8, 0, 155), ZIndex = 5,
	TextColor3 = Color3.fromRGB(255, 224, 150), BackgroundColor3 = Color3.fromRGB(19, 22, 30), TextSize = 12,
	Font = Enum.Font.Gotham, TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Bottom, TextWrapped = true,
}, battleFrame)
local battleBtns = mk("Frame", { Size = UDim2.new(1, -16, 0, 140), Position = UDim2.new(0, 8, 0, 282), BackgroundTransparency = 1, ZIndex = 5 }, battleFrame)

local ELEM_COLOR = {
	fire = Color3.fromRGB(224, 90, 70),
	water = Color3.fromRGB(70, 130, 224),
	grass = Color3.fromRGB(80, 180, 100),
	lightning = Color3.fromRGB(220, 190, 60),
}

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

-- #93 P2 화면 행 반사 (표시 전용 — 논리 좌표 불변)
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

local function pieceLabel(p)
	if not p.known then
		return "?"
	end
	local emo = { minion = "", bomb = "💣", ally = "🤝", trap = "🪤", king = "👑" }
	if p.type == "minion" then
		return (Data.ELEM_EMO[p.element] or "") .. "\n" .. tostring(p.hp or "")
	end
	return (emo[p.type] or "?") .. (p.hp and ("\n" .. p.hp) or "")
end

local function clearChildrenBtns(parent)
	for _, ch in parent:GetChildren() do
		ch:Destroy()
	end
end

local function smallBtn(parent, x, y, w, text, cb, color)
	local b = mk("TextButton", {
		Size = UDim2.new(0, w, 0, 26), Position = UDim2.new(0, x, 0, y), Text = text, TextSize = 12,
		Font = Enum.Font.GothamBold, TextColor3 = Color3.new(1, 1, 1),
		BackgroundColor3 = color or Color3.fromRGB(60, 68, 88), ZIndex = parent.ZIndex,
	}, parent)
	b.Activated:Connect(cb)
	return b
end

--==================================================================
-- 무작위 배치 생성 (Phase 1 — 수동 배치 UI는 Phase 2)
--==================================================================

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
-- 렌더
--==================================================================

local function renderBoard()
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
			b.TextColor3 = Color3.new(1, 1, 1)
			b.BorderSizePixel = 0
			local icon, hpLabel, mark = b.Icon, b.Hp, b.Mark
			icon.Visible = false
			hpLabel.Visible = false
			mark.Visible = false
			local p = pieceAt(r, c)
			if p then
				local mine = p.owner == view.me
				local ownColor = mine and Color3.fromRGB(160, 200, 255) or Color3.fromRGB(255, 160, 170)
				b.TextColor3 = ownColor
				b.BorderSizePixel = 2 -- 아군/적군 테두리 (아이콘 표시 시에도 소속이 보이도록)
				b.BorderColor3 = ownColor
				-- #89 확정된 하수인만 종 아이콘 — 미공개 말(known=false)은 rosterId 자체가 없어 "?" 텍스트 (정보 은닉은 Views 가 보장)
				local iconUrl = (p.known and p.type == "minion") and Art.icon(p.rosterId) or nil
				if iconUrl then
					icon.Image = iconUrl
					icon.Visible = true
					hpLabel.Text = tostring(p.hp or "")
					hpLabel.Visible = true
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
			.. "(" .. (Data.WINTYPE_KO[view.winType] or "") .. ")\n"
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
		head ..= "🏃 도망 성공 — 후방 말(파란 칸) 클릭으로 교환 또는 생략\n"
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
			smallBtn(btnRow, 0, 0, 120, "메뉴로", function()
				game_.Visible = false
				menu.Visible = true
				menuStatus.Text = ""
				view = nil
			end)
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
		renderBoard()
		renderSide()
		renderButtons()
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
		local u = Art.battle(fv.artRosterId) -- 대리 출전(포획 하수인)은 Views 가 artRosterId 로 원래 종을 싣는다
		img.Image = u or ""
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

local function render()
	if not view then
		return
	end
	menu.Visible = false
	game_.Visible = true
	renderBoard()
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

queueBtn.Activated:Connect(function()
	menuStatus.Text = "🌐 매칭 대기 중… (상대를 기다립니다)"
	send({ t = "queue", setup = randomSetup() })
end)
DIAG.ui = true -- 여기까지 왔으면 UI·입력 연결 완료
refreshFooter()

--==================================================================
-- 서버 수신
--==================================================================

reState.OnClientEvent:Connect(function(msg)
	if msg.t == "queue" then
		menuStatus.Text = "🌐 매칭 대기 중… (상대를 기다립니다)"
		return
	elseif msg.t == "queueCancelled" then
		menuStatus.Text = "매칭 취소됨"
		return
	elseif msg.t == "reject" then
		addLog("⛔ " .. (msg.reason or "거부됨"))
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
