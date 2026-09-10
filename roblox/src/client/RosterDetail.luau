--!nonstrict
-- RosterDetail.luau — 로스터 종 상세 팝업 (초상화·기술 목록·선택/해제).
-- init.client.luau 에서 원문 그대로 옮겼다 (Luau 지역 변수 200개 한도 — Ui.luau 머리말 참고).
-- 표시와 선택 토글만 한다. 배치 상태(ctx.setup) 는 init 이 가진 그 테이블을 그대로 쓴다.

local Shared = game:GetService("ReplicatedStorage"):WaitForChild("Shared")
local Data = require(Shared:WaitForChild("Data"))
local Art = require(Shared:WaitForChild("Art"))

local RosterDetail = {}

-- gui: 팝업을 붙일 ScreenGui · Ui: Ui.luau
-- ctx = { setup = 배치 상태 테이블, flashHud = 안내 문구, onChanged = 배치 화면 다시 그리기 }
function RosterDetail.mount(gui, Ui, ctx)
	local mk, bgImage, smallBtn, clearChildren = Ui.mk, Ui.bgImage, Ui.smallBtn, Ui.clearChildren
	local WHITE = Ui.WHITE
	local D = {}
	local detailBack = mk("Frame", { -- 상세 팝업 뒤 암막 — 뒤 카드 글씨가 겹쳐 보이지 않게
		Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.45, BorderSizePixel = 0,
		Visible = false, ZIndex = 7,
	}, gui)
	local rosterDetail = mk("Frame", {
		Size = UDim2.new(0, 520, 0, 300), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.new(0.5, 0, 0.5, 0), Visible = false, ZIndex = 8,
		BackgroundColor3 = Color3.fromRGB(28, 32, 44), BorderSizePixel = 0,
	}, gui)
	bgImage(rosterDetail, "panel_modal", "panel", 1)
	Ui.autoFit(rosterDetail, 520, 300)
	local detailPortrait = mk("ImageLabel", {
		Size = UDim2.new(0, 168, 0, 168), Position = UDim2.new(0, 14, 0, 14), BackgroundColor3 = Color3.fromRGB(19, 22, 30),
		BorderSizePixel = 0, ScaleType = Enum.ScaleType.Fit, ZIndex = 8,
	}, rosterDetail)
	local detailElem = Ui.iconLabel(rosterDetail, 182, 12, 22, "", nil, 9)
	local detailText = mk("TextLabel", {
		Text = "", Size = UDim2.new(1, -212, 0, 236), Position = UDim2.new(0, 196, 0, 14), ZIndex = 8,
		TextColor3 = WHITE, BackgroundTransparency = 1, TextSize = 13, Font = Enum.Font.Gotham, RichText = true,
		TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextWrapped = true,
	}, rosterDetail)
	local detailBtns = mk("Frame", { Size = UDim2.new(1, -24, 0, 30), Position = UDim2.new(0, 12, 1, -38), BackgroundTransparency = 1, ZIndex = 8 }, rosterDetail)

	function D.close()
		ctx.setup.detail = nil
		rosterDetail.Visible = false
		detailBack.Visible = false
	end

	function D.open(rid)
		local rd = Data.rosterById(rid)
		if not rd then
			return
		end
		ctx.setup.detail = rid
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
		local on = table.find(ctx.setup.roster, rid) ~= nil
		smallBtn(detailBtns, 0, 0, 120, on and "선택 해제" or "선택하기", function()
			local idx = table.find(ctx.setup.roster, rid)
			if idx then
				table.remove(ctx.setup.roster, idx)
				ctx.setup.pos = {}
			elseif #ctx.setup.roster < 6 then
				table.insert(ctx.setup.roster, rid)
				ctx.setup.pos = {}
			else
				ctx.flashHud("⛔ 이미 6종을 선택했습니다 — 다른 종을 해제하세요")
				return
			end
			D.close()
			ctx.onChanged()
		end, on and "danger" or "primary", on or #ctx.setup.roster < 6)
		smallBtn(detailBtns, 126, 0, 70, "닫기", D.close)
	end

	return D
end

return RosterDetail
