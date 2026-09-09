--!strict
-- Art.luau — 아트 자산 연결 (HTML #89 artDirOf/artUrl 포팅 — 표시 계층 전용)
-- 자산 키는 roblox/assets/*/manifest 의 kind·id 를 따르며 AssetIds.luau(생성 파일) 에서 rbxassetid 를 찾는다.
-- 정보 은닉: 호출 측(Views)이 이미 공개된 말에만 rosterId/type 을 싣는다 — 여기서는 받은 값으로만 경로를 만든다.
-- ID 가 없거나(업로드 전·검수 중) 허용 목록 밖이면 nil → 호출 측이 텍스트 폴백.

local function req(mod: string): any
	if script then
		return require((script.Parent :: any):WaitForChild(mod)) -- 클라이언트 복제 경합 방지
	end
	return require("./" .. mod)
end

local Data = req("Data")
local AssetIds: { [string]: number } = req("AssetIds")

local Art = {}

-- Color3 는 Roblox 전용 전역 — 헤드리스(luau CLI) 테스트에서는 없으므로 순수 테이블로 대체한다
local function rgb(r: number, g: number, b: number): any
	local C3 = (Color3 :: any) -- Roblox 환경에서만 정의된 전역 (CLI 에서는 nil)
	if C3 ~= nil then
		return C3.fromRGB(r, g, b)
	end
	return { r = r, g = g, b = b }
end

-- 팀 틴트 (인계서 §2): owner 0 = A 자리 = 파랑 #5b8cff · owner 1 = B 자리 = 빨강 #ff5b6e. 하수인 컬러 도트에는 곱하지 않는다
Art.TEAM = {
	[0] = rgb(0x5b, 0x8c, 0xff),
	[1] = rgb(0xff, 0x5b, 0x6e),
}
-- 로비 의자 알베도(회색) 틴트 — 로비 README 프리뷰 값. 말 토큰 팀 색과 다른 값이다
Art.CHAIR_TINT = {
	A = rgb(0x71, 0x85, 0xbd),
	B = rgb(0xbd, 0x71, 0x80),
}

local TOKEN_KINDS = { king = true, ally = true, bomb = true, trap = true, unknown = true }

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

-- 말 토큰 (흰색+알파 → ImageColor3 로 팀 색): kind = king|ally|bomb|trap|unknown, size = 64|128 (unknown 은 64 만)
function Art.token(kind: string, size: number): string?
	if not TOKEN_KINDS[kind] then
		return nil
	end
	return url(AssetIds["token" .. size .. "_" .. kind])
end

-- 로비 텍스처·UI 이미지 (lobby manifest 의 asset_id): desk_albedo · chair_albedo · board_grid · floor_tile · wall_albedo · pillar_albedo · table_sign
function Art.lobbyImage(key: string): string?
	return url(AssetIds["lobby_" .. key])
end

-- 모델 자산 ID (숫자, 서버 InsertService 용): 로비 메시 desk|chair|board|floor|wall|pillar, 공통 가림 unknown
function Art.lobbyMeshId(name: string): number?
	local id = AssetIds["lobbymesh_" .. name]
	return (type(id) == "number" and id > 0) and id or nil
end

function Art.meshId(name: string): number?
	local id = AssetIds["mesh_" .. name]
	return (type(id) == "number" and id > 0) and id or nil
end

return Art
