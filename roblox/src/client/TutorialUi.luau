--!nonstrict
-- TutorialUi.luau — 📖 10단계 튜토리얼 (HTML 데모 #26·#42 의 TUT_STEPS 포팅).
-- 문장은 HTML 원문 그대로다 — 규칙을 여기서 새로 쓰지 않는다. HTML 규칙이 바뀌면 저기서 먼저 바뀌고 여기로 미러한다.
-- 표시 계층 전용: 서버로 아무것도 보내지 않고 게임 상태를 건드리지 않는다.
--
-- CJ 결정 (2026-09-11):
--   · 첫 접속 자동 표시 **하지 않는다** — 간판·버튼·[H] 로만 연다
--   · **대전 중에도** 열 수 있다 (보드게임 창 위에 뜬다)
--   · 로비 간판은 스폰에서 바로 보이는 자리 (server/Lobby.luau)
--
-- 그림(tut512_*)은 Earth 납품 대기 — 자산이 없으면 그림 칸을 숨기고 글이 그 자리를 쓴다.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Art = require(Shared:WaitForChild("Art"))

-- HTML demo/index.html 의 TUT_STEPS 와 1:1. <b> 는 Roblox RichText 가 그대로 읽는다
local STEPS = {
	{ key = "win", icon = "🏆", title = "이기는 법 세 가지", lines = {
		"상대 <b>왕</b>을 찾아서 잡으면 이겨요.",
		"내 <b>왕</b>이 상대편 <b>맨 끝줄</b>에 서도 이겨요. 스스로 걸어가도, 상대에게 <b>밀려서</b> 닿아도 승리예요.",
		"상대의 싸우는 말(<b>하수인</b> 6개 + <b>동료</b> 2개)을 모두 없애도 이겨요.",
	} },
	{ key = "pieces", icon = "🎭", title = "말 5가지와 숨은 정체", lines = {
		"내 말은 모두 <b>14개</b>예요. <b>하수인</b>(싸우는 말) 6개, <b>동료</b> 2개, <b>왕</b> 1개, <b>폭탄</b> 3개, <b>함정</b> 2개예요.",
		"상대에게 내 말은 전부 <b>물음표(?)</b>로 보여요. 상대 말도 나에게는 물음표예요.",
		"싸우고 나면 그 말의 정체가 드러나요. <b>함정</b>을 밟으면 함정과 밟은 말도 드러나요.",
	} },
	{ key = "move", icon = "🌲", title = "움직이기와 숲에 숨기", lines = {
		"내 차례에 말 <b>하나</b>를 위·아래·옆으로 <b>한 칸</b> 움직여요. 대각선은 안 돼요.",
		"초록 칸은 <b>숲</b>이에요. 숲의 말은 상대가 <b>바로 옆</b>에 올 때만 보이고, 떨어지면 다시 숨어요.",
		"숨은 말이 있는 칸으로 가면 <b>부딪혀요</b>. 그 앞 칸에 멈추고, 둘 다 이번 차례 동안 보여요.",
	} },
	{ key = "search", icon = "🔍", title = "흔적과 탐색", lines = {
		"숲 어딘가에 <b>선물</b>이 숨어 있어요. 말이 그 칸에 서면 <b>흔적</b> 표시가 떠요.",
		"그 말로 <b>다음 차례</b>에 <b>탐색</b>(찾아보기) 버튼을 누르면 선물을 받아요.",
		"탐색은 <b>하수인·동료·왕</b>만 할 수 있어요. <b>폭탄·함정은 못</b> 해요.",
		"선물은 <b>🎁 아이템 선물</b>(회복약·몬스터볼 등)·<b>✨ 전투 버프</b>·<b>📘 기술 교체</b> 셋이에요!",
	} },
	{ key = "battle", icon = "⚔️", title = "옆에 붙으면 꼭 싸워요", lines = {
		"내 말이 움직여서 상대 말 <b>바로 옆</b>에 새로 붙으면 꼭 싸워요. 이게 <b>강제 전투</b>(무조건 싸움)예요. 한 차례에 싸움은 <b>최대 2번</b>이에요.",
		"싸움은 불·물·풀·번개 <b>가위바위보</b>예요. <b>불→풀→번개→물→불</b> 순서로 이겨요.",
		"싸움이 끝나도 <b>HP</b>(체력)와 기술 <b>쿨타임</b>은 그대로예요. 화상 같은 <b>상태이상</b>은 사라져요.",
		"싸움은 최대 <b>6라운드</b>예요. 끝까지 가면 <b>남은 HP 비율</b>이 높은 쪽이 이겨요. 같으면 지킨 쪽이 이겨요.",
		"<b>동료·왕</b>끼리도 모두 <b>싸워요</b>(왕↔왕 포함). <b>왕 본체</b>가 지면 그 자리에서 <b>경기 패배</b>예요.",
		"기술 <b>4칸</b>이 전부 못 쓰는 상태면 <b>기본 공격도 나오지 않아요</b>. 「턴 종료」를 눌러야 내 <b>싸움 차례 한 번</b>만 넘어가요.",
		"<b>보호막(🛡)</b>은 겹쳐 쓰면 <b>남은 양에 더해져요</b>. 18에 22를 더 받으면 <b>40</b>이에요.",
	} },
	{ key = "bomb", icon = "💣", title = "폭탄과 함정", lines = {
		"<b>폭탄</b>은 한 칸씩 움직일 수 있어요(버닝 타임엔 2칸). 상대 옆에 새로 붙으면 터져요. <b>함정</b>은 <b>스스로 움직일 수 없어요</b>.",
		"<b>하수인</b>이 폭탄을 건드리면 둘 다 사라져요. <b>동료·왕</b>은 살아남아요. 폭탄끼리·폭탄과 함정은 <b>그 자리에서 터져 둘 다 사라져요</b>.",
		"<b>함정</b>을 건드리면 함정은 사라지고 그 말은 <b>내 차례 2번</b> 못 움직여요. 둘 다 정체가 드러나요. 함정도 <b>밀기·재배치</b>로 옮겨질 수 있어요.",
	} },
	{ key = "capture", icon = "🔴", title = "잡아오기와 도망치기", lines = {
		"싸울 때 상대 <b>하수인</b> HP가 <b>30%</b> 아래면 <b>몬스터볼</b>을 던져요. 성공률 <b>70%</b>예요.",
		"성공하면 내 <b>예비 하수인</b>(HP 70/100)이 돼요. 성공·실패 모두 볼 <b>1개</b>가 없어져요.",
		"<b>도망</b>은 <b>HP 조건 없이</b> 언제든 칠 수 있어요. 기본 성공률은 <b>30%</b>예요.",
		"성공하면 <b>뒤에 있는 내 말</b>과 교환하거나 생략하고, 상대를 <b>한 칸씩</b> 밀어요.",
		"실패하면 <b>상대의 기본 공격 한 번</b>을 맞고, 내 <b>싸움 차례 한 번</b>이 지나가요.",
	} },
	{ key = "tele", icon = "🌀", title = "텔레포트(순간이동)", lines = {
		"내 말이 <b>상대편 땅</b>(상대 진영 3줄)에 들어가 있으면 <b>텔레포트</b>(순간이동)를 쓸 수 있어요.",
		"텔레포트는 내 말 <b>두 개</b>의 자리를 서로 바꿔요. 왕·폭탄·함정도 돼요. 한 경기에 <b>몇 번이든</b> 쓸 수 있지만, 한 차례의 <b>주 행동</b>을 써요.",
		"바뀐 두 말이 각각 상대 옆에 새로 붙으면 <b>각자 따로</b> 싸워요. 남은 싸움 횟수가 모자라면 못 써요.",
		"<b>함정</b>에 걸려 멈춘 말은 텔레포트로 <b>자리를 바꿀 수 없어요</b>. 양쪽 어느 자리든 안 돼요.",
	} },
	{ key = "burn", icon = "🔥", title = "버닝 타임(불타는 시간)", lines = {
		"<b>65번째 턴</b>부터 <b>버닝 타임</b>(불타는 시간)이에요. 말이 <b>곧게 2칸</b>까지 움직일 수 있어요.",
		"상대편 <b>숲</b>이나 상대편 <b>땅</b>에 있거나, 들어가거나, 지나갈 때는 그대로 <b>1칸</b>이에요.",
		"<b>폭탄</b>도 2칸 움직여요. <b>함정</b>은 버닝 타임에도 <b>스스로는</b> 못 움직여요. 밀리면 옮겨져요.",
	} },
	{ key = "check", icon = "🏁", title = "빠른 복습 — 첫 차례 체크리스트", lines = {
		"이기는 길은 셋! 상대 <b>왕</b> 잡기, 내 왕이 상대 <b>끝줄</b>에 서기, 상대 <b>하수인·동료 전멸</b>이에요.",
		"<b>주 행동 하나</b> 뒤 새로 붙은 상대와 꼭 싸워요. 할 게 없으면 <b>턴 종료</b>는 자동이에요. 싸울 상대만 남으면 <b>싸우지 않고 종료</b>를 눌러요.",
		"<b>회복</b>은 나와 상대 차례 끝마다 최대 HP의 <b>5%</b>씩 나아요. 만피도 고를 수 있어요. 이동·탐색·텔레포트·싸움으로 풀려요. 이제 시작해요!",
	} },
}

local W, H = 700, 540
local IMG_W, IMG_H = 512, 288

local TutorialUi = {}

-- gui: 창을 붙일 ScreenGui · Ui: Ui.luau
function TutorialUi.mount(gui, Ui)
	local mk, bgImage, smallBtn, clearChildren = Ui.mk, Ui.bgImage, Ui.smallBtn, Ui.clearChildren
	local T = { step = 1 }

	local tutBack = mk("Frame", { -- 뒤 암막 — 대전 중에도 열리므로 판·전투 창 글씨가 비쳐 보이면 안 된다
		Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.5,
		BorderSizePixel = 0, Visible = false, ZIndex = 13,
	}, gui)
	local frame = mk("Frame", {
		Size = UDim2.new(0, W, 0, H), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
		BackgroundColor3 = Color3.fromRGB(24, 27, 37), BorderSizePixel = 0, Visible = false, ZIndex = 14,
	}, gui)
	if not bgImage(frame, "panel_window", "window", 1) then
		bgImage(frame, "panel_modal", "panel", 1)
	end
	Ui.autoFit(frame, W, H)

	local head = mk("TextLabel", {
		Text = "", Size = UDim2.new(1, -122, 0, 26), Position = UDim2.new(0, 14, 0, 8), ZIndex = 14, -- 오른쪽 단계 표시(1/10) 자리를 비운다
		BackgroundTransparency = 1, TextSize = 16, Font = Enum.Font.GothamBold, TextColor3 = Color3.fromRGB(232, 236, 245),
		TextXAlignment = Enum.TextXAlignment.Left, RichText = true, TextTruncate = Enum.TextTruncate.AtEnd,
	}, frame)
	local counter = mk("TextLabel", {
		Text = "", Size = UDim2.new(0, 80, 0, 26), Position = UDim2.new(1, -94, 0, 8), ZIndex = 14,
		BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.GothamBold, TextColor3 = Color3.fromRGB(154, 163, 184),
		TextXAlignment = Enum.TextXAlignment.Right,
	}, frame)
	local shot = mk("ImageLabel", { -- 단계 그림 (Earth 납품 대기 — 없으면 숨기고 글이 그 자리를 쓴다)
		Size = UDim2.new(0, IMG_W, 0, IMG_H), Position = UDim2.new(0.5, -IMG_W / 2, 0, 40), ZIndex = 14,
		BackgroundColor3 = Color3.fromRGB(19, 22, 30), BorderSizePixel = 0, Visible = false,
		ScaleType = Enum.ScaleType.Fit, ResampleMode = Enum.ResamplerMode.Pixelated,
	}, frame)
	local scroll = mk("ScrollingFrame", {
		Size = UDim2.new(1, -28, 0, H - 336 - 48), Position = UDim2.new(0, 14, 0, 336), ZIndex = 14, -- 그림 아래가 기준. draw() 가 그림이 없으면 위로 올린다
		BackgroundColor3 = Color3.fromRGB(19, 22, 30), BackgroundTransparency = 0.3, BorderSizePixel = 0,
		CanvasSize = UDim2.new(0, 0, 0, 0), ScrollBarThickness = 8, ScrollingDirection = Enum.ScrollingDirection.Y,
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
	}, frame)
	local body = mk("TextLabel", {
		Text = "", Size = UDim2.new(1, -16, 0, 0), Position = UDim2.new(0, 8, 0, 6), ZIndex = 15,
		AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, TextSize = 14, Font = Enum.Font.Gotham,
		TextColor3 = Color3.fromRGB(214, 220, 234), TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true, RichText = true, LineHeight = 1.25,
	}, scroll)
	local btns = mk("Frame", { Size = UDim2.new(1, -28, 0, 30), Position = UDim2.new(0, 14, 1, -40), BackgroundTransparency = 1, ZIndex = 14 }, frame)

	local function draw()
		local s = STEPS[T.step]
		head.Text = ("📖 %s %s"):format(s.icon, s.title)
		counter.Text = ("%d / %d"):format(T.step, #STEPS)
		local img = Art.tut(s.key)
		shot.Image = img or ""
		shot.Visible = img ~= nil
		local top = img and (40 + IMG_H + 8) or 40 -- 그림이 없으면 글이 위까지 쓴다
		scroll.Position = UDim2.new(0, 14, 0, top)
		scroll.Size = UDim2.new(1, -28, 0, H - top - 48)
		local out = {}
		for i, ln in s.lines do
			table.insert(out, ("<font color=\"#5b8cff\">%d.</font>  %s"):format(i, ln))
		end
		body.Text = table.concat(out, "\n\n")
		scroll.CanvasPosition = Vector2.new(0, 0)

		clearChildren(btns)
		smallBtn(btns, 0, 0, 96, "◀ 이전", function()
			T.step = math.max(1, T.step - 1)
			draw()
		end, "default", T.step > 1)
		smallBtn(btns, 102, 0, 96, "다음 ▶", function()
			T.step = math.min(#STEPS, T.step + 1)
			draw()
		end, "primary", T.step < #STEPS)
		smallBtn(btns, 208, 0, 88, "닫기", function()
			T.close()
		end, "danger", true, Art.action("exit"))
		if T.step == #STEPS then
			smallBtn(btns, 302, 0, 120, "처음부터", function()
				T.step = 1
				draw()
			end)
		end
	end

	function T.isOpen()
		return frame.Visible
	end

	function T.open(step)
		T.step = math.clamp(tonumber(step) or T.step or 1, 1, #STEPS)
		draw()
		tutBack.Visible = true
		frame.Visible = true
	end

	function T.close()
		frame.Visible = false
		tutBack.Visible = false
	end

	function T.toggle()
		if frame.Visible then
			T.close()
		else
			T.open()
		end
	end

	T.count = #STEPS
	return T
end

return TutorialUi
