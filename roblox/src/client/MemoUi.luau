--!nonstrict
-- MemoUi.luau — #11·#36 추측 메모 (내 화면 전용).
-- **서버로 아무것도 보내지 않는다** — 상대는 내가 무엇을 적었는지 알 수 없고 규칙·난수와도 무관하다.
-- init.client.luau 에서 원문 그대로 옮겼다 (Luau 지역 변수 200개 한도 — Ui.luau 머리말 참고).

local MemoUi = {}

-- gui: 팝업을 붙일 ScreenGui · Ui: Ui.luau · onChanged: 메모가 바뀌어 판을 다시 그려야 할 때 부른다
function MemoUi.mount(gui, Ui, onChanged)
	local mk, bgImage, smallBtn, clearChildren = Ui.mk, Ui.bgImage, Ui.smallBtn, Ui.clearChildren
	local M = { memos = {} } -- memos[pieceId] = 메모 키 · M.mode 메모 모드 · M.pick 선택 중인 말
	-- #11·#36 추측 메모 — **내 화면에만** 보이는 표시다. 서버로 보내지 않고 상대는 알 수 없다 (규칙·난수 무관)
	M.OPTS = {
		{ key = "king", emoji = "👑", ko = "왕" },
		{ key = "ally", emoji = "🤝", ko = "동료" },
		{ key = "minion_fire", emoji = "🔥", ko = "불 하수인" },
		{ key = "minion_water", emoji = "💧", ko = "물 하수인" },
		{ key = "minion_grass", emoji = "🌿", ko = "풀 하수인" },
		{ key = "minion_lightning", emoji = "⚡", ko = "전기 하수인" },
		{ key = "bomb", emoji = "💣", ko = "폭탄" },
		{ key = "trap", emoji = "🪤", ko = "함정" },
	}

	M.mode = false -- 메모 모드: 적 말을 클릭하면 공격이 아니라 메모 선택
	M.pick = nil -- 메모 선택 중인 말 id
	function M.opt(key)
		for _, o in M.OPTS do
			if o.key == key then
				return o
			end
		end
		return nil
	end

	-- #11·#36 추측 메모 선택 팝업 (내 화면 전용 — 서버로 아무것도 보내지 않는다)
	local memoFrame = mk("Frame", {
		Size = UDim2.new(0, 300, 0, 246), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0),
		BackgroundColor3 = Color3.fromRGB(28, 32, 44), BorderSizePixel = 0, Visible = false, ZIndex = 11,
	}, gui)
	bgImage(memoFrame, "panel_modal", "panel", 1)
	Ui.autoFit(memoFrame, 300, 246)
	mk("TextLabel", {
		Text = "📝 이 말은 뭘까? (내 화면에만 보입니다)", Size = UDim2.new(1, -24, 0, 22), Position = UDim2.new(0, 12, 0, 10), ZIndex = 11,
		BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.GothamBold, TextColor3 = Color3.fromRGB(232, 236, 245),
		TextXAlignment = Enum.TextXAlignment.Left,
	}, memoFrame)
	local memoBtns = mk("Frame", { Size = UDim2.new(1, -24, 0, 200), Position = UDim2.new(0, 12, 0, 36), BackgroundTransparency = 1, ZIndex = 11 }, memoFrame)

	function M.close()
		M.pick = nil
		memoFrame.Visible = false
	end

	function M.render()
		if not M.pick then
			memoFrame.Visible = false
			return
		end
		memoFrame.Visible = true
		clearChildren(memoBtns)
		local cur = M.memos[M.pick]
		for i, o in M.OPTS do
			local on = cur == o.key
			smallBtn(memoBtns, ((i - 1) % 2) * 140, math.floor((i - 1) / 2) * 30, 134, o.emoji .. " " .. o.ko, function()
				if cur == o.key then -- 같은 항목을 다시 누르면 해제
					M.memos[M.pick] = nil
				else
					M.memos[M.pick] = o.key
				end
				M.close()
				onChanged()
			end, on and "primary" or "default")
		end
		smallBtn(memoBtns, 0, 124, 134, "메모 지우기", function()
			M.memos[M.pick] = nil
			M.close()
			onChanged()
		end, "danger", cur ~= nil)
		smallBtn(memoBtns, 140, 124, 134, "닫기", function()
			M.close()
			onChanged()
		end)
	end

	return M
end

return MemoUi
