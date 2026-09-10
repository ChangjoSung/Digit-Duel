--!nonstrict
-- BannerUi.luau — 화면 중앙 배너 (표시 계층 전용).
-- init.client.luau 에서 **원문 그대로** 옮겼다 (Luau 는 함수 하나가 지역 변수 200개까지만 쓸 수 있는데
-- 클라이언트 본체가 그 한도에 닿았다 — 2026-09-10 전투 연출을 붙이다 빌드가 멈췄다).
-- Rojo 가 src/client/ 의 형제 파일을 Client LocalScript 의 **자식 ModuleScript** 로 올린다 → require(script.BannerUi)
-- 규칙·난수와 무관하고 클릭을 가로채지 않는다. 판정은 공유 모듈 Banner (헤드리스 테스트 [12]·[14]).

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Art = require(Shared:WaitForChild("Art"))
local Banner = require(Shared:WaitForChild("Banner"))

local BannerUi = {}

-- gui: 배너를 붙일 ScreenGui · Ui: Ui.luau
function BannerUi.mount(gui, Ui)
	local mk, bgImage, WHITE = Ui.mk, Ui.bgImage, Ui.WHITE
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
	Ui.autoFit(bannerFrame, 540, 112)
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
	bannerArt.fx = Ui.fxMk(bannerFrame, 14, 8, 96, 10) -- 판 위에서 일어난 일(폭탄·함정·포획·도망)은 배너 안에서 보여 준다
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
			hasFx = Ui.fxPlay(bannerArt.fx, b.fx)
		end
		if not hasFx then
			Ui.fxStop(bannerArt.fx)
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


	return {
		show = banner, -- (title, sub, tone, fx)
		fromLog = Banner.fromLog, -- 서버 로그 한 줄 → { title, sub, tone, fx } 또는 nil
		frame = bannerFrame,
	}
end

return BannerUi
