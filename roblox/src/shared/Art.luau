--!strict
-- Art.luau — 하수인 아트 연결 (HTML #89 artDirOf/artUrl 포팅 — 표시 계층 전용)
-- 자산 키: <kind>_<element>_<arch> (roblox/assets/manifest.csv 의 kind·id 열) → AssetIds.luau 의 rbxassetid.
-- 정보 은닉: 호출 측(Views)이 이미 공개된 말에만 rosterId 를 싣는다 — 여기서는 받은 rosterId 로만 경로를 만든다.
-- ID 가 없거나(업로드 전) 허용 목록 밖이면 nil → 호출 측이 현행 텍스트 표시로 폴백한다.

local function req(mod: string): any
	if script then
		return require((script.Parent :: any)[mod])
	end
	return require("./" .. mod)
end

local Data = req("Data")
local AssetIds: { [string]: number } = req("AssetIds")

local Art = {}

local function url(id: number?): string?
	if type(id) == "number" and id > 0 then
		return "rbxassetid://" .. id
	end
	return nil
end

-- rosterId → 종 폴더명 (fire_std …) — 로스터 20종 밖이면 nil
function Art.dirOf(rosterId: string?): string?
	local rd = Data.rosterById(rosterId)
	return rd and (rd.element .. "_" .. rd.arch) or nil
end

function Art.icon(rosterId: string?): string?
	local d = Art.dirOf(rosterId)
	return d and url(AssetIds["icon_" .. d]) or nil
end

function Art.battle(rosterId: string?): string?
	local d = Art.dirOf(rosterId)
	return d and url(AssetIds["battle_" .. d]) or nil
end

function Art.portrait(rosterId: string?): string?
	local d = Art.dirOf(rosterId)
	return d and url(AssetIds["portrait_" .. d]) or nil
end

return Art
