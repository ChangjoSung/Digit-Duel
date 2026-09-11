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

--==================================================================
-- P0-B/C/D UI 자산 (roblox/assets/ui/README.md 가 적용 계약) — 키는 루트 manifest 의 kind_id
--==================================================================

-- 9-slice SliceCenter 좌표 {L,T,R,B} — 원본 이미지의 중앙 사각형 (여백값이 아님). 클라이언트가 Rect.new 로 만든다
Art.SLICE = {
	hl = { 32, 32, 96, 96 }, -- 하이라이트 5 · board frame (128×128) — 32px 셀은 SliceScale 0.25, 64px 는 0.5
	panel = { 16, 16, 112, 112 }, -- 패널 3 (128×128)
	btn = { 12, 12, 116, 52 }, -- 버튼 12 (128×64)
	badge = { 12, 12, 52, 28 }, -- badge (64×40)
	bar = { 8, 8, 56, 24 }, -- HP/방어막 바 4 (64×32)
	window = { 24, 40, 232, 232 }, -- 보드게임 창 프레임 (256×256, 상단 제목 띠 40 · 좌우·하단 24) — ai-window-README
}

-- 흰색 단색 자산에 입힐 색 (신규 60 중 tint=yes 7개만). 나머지는 흰색 ImageColor3 유지
Art.TINT = {
	hl_move = rgb(0x5b, 0x8c, 0xff),
	hl_flee = rgb(0x5b, 0x8c, 0xff),
	hl_attack = rgb(0xff, 0x5b, 0x6e),
	hl_forced = rgb(0xff, 0x5b, 0x6e),
	hl_sel = rgb(0xff, 0xd8, 0x4d),
	hl_trace = rgb(0x4f, 0xd8, 0x8a), -- 탐색 가능 칸 (전용 아트가 없어 흰 알파 원본인 hl_sel 을 초록으로 물들여 쓴다)
	-- 돋보기 배지(trace48)는 manifest 가 tint=no 다 — 자체 색을 가진 그림이라 곱하지 않는다. 대신 뒤에 어두운 판을 깔아 대비를 준다
	hpbar_fill = rgb(0x4f, 0xd8, 0x8a),
	shbar_fill = rgb(0x4d, 0xa3, 0xff),
}

function Art.element(el: string?): string? -- fire|water|grass|lightning (64) — 공개된 속성 또는 사용자의 수동 추측에만
	return el and url(AssetIds["element64_" .. el]) or nil
end

function Art.trace(): string? -- 흔적 (48) — 서버가 허용한 칸에만
	return url(AssetIds["trace48_trace"])
end

function Art.status(key: string): string? -- shield|burn|weaken|shock|dmgcut|focus|vuln|thinking (48)
	return url(AssetIds["status48_" .. key])
end

function Art.item(key: string): string? -- potion|cool|cure|ball|reserve (64)
	return url(AssetIds["item64_" .. key])
end

function Art.action(key: string): string? -- search|teleport|heal|skip|endturn|resign|fight|bag|capture|flee|exit|bot (48)
	return url(AssetIds["action48_" .. key])
end

-- 전투 연출 스프라이트 시트 (Earth 납품 · docs/art/roblox-v0.5.0/earth-fx-report.md)
-- 시트 768×96 = 96×96 프레임 8장 가로 배치. 프레임 n 의 ImageRectOffset 은 (96*n, 0) 이고 8번째는 완전 투명이라 저절로 사라진다.
-- 반복 루프가 아니라 1회 연출이다. 9-slice 를 쓰지 않고 ResamplerMode.Pixelated 로만 그린다.
Art.FX = { frames = 8, size = 96, sheetW = 768 }

-- manifest tint=yes 인 3종만 흰색 원본이라 상황색을 곱한다. 나머지 10종은 그림에 색이 들어 있어 흰색 유지
Art.FX_TINT = {
	hit = rgb(0xff, 0x5b, 0x6e), -- 피해 — 공격 하이라이트와 같은 빨강
	shield = rgb(0x4d, 0xa3, 0xff), -- 보호막 — 방어막 바와 같은 파랑
	heal = rgb(0x4f, 0xd8, 0x8a), -- 회복 — HP 바와 같은 초록
}

function Art.fx(key: string?): string? -- hit|explosion|trap|shield|heal|burn|weaken|shock|capture|flee|dragon|witch|reaper
	return key and url(AssetIds["fx96_" .. key]) or nil
end

-- #124 왕·동료 픽셀 아트 (HTML 데모 납품본 미러) — kind = king|ally, size = 64|256.
-- 하수인과 달리 **자체 색을 가진 그림**이라 팀 틴트를 곱하지 않는다. 판 위 말은 여전히 흰 토큰 + 팀 색이다
-- (판에서는 색이 편을 가르는 유일한 단서라 바꾸면 안 된다).
function Art.leader(kind: string?, size: number): string?
	if kind ~= "king" and kind ~= "ally" then
		return nil
	end
	return url(AssetIds["leader" .. size .. "_" .. kind])
end

-- 튜토리얼 단계 삽화 (512×288) — key = win|pieces|move|search|battle|bomb|capture|tele|burn|check
-- 납품 전에는 nil 이고 창이 그림 칸을 숨긴 채 글만 보여 준다 (earth-tutorial-request.md)
function Art.tut(key: string?): string?
	return key and url(AssetIds["tut512_" .. key]) or nil
end

-- 메모가 달린 말 배지 (내 화면 전용 표시 — 무엇을 적었는지는 담지 않는다)
function Art.memoToken(): string?
	return url(AssetIds["token64_memo"])
end

function Art.badge(key: string): string? -- ai_grade5|ai_dan5 (48) — 봇 난이도 배지 (earth-ai-window-request.md)
	return url(AssetIds["badge48_" .. key])
end

function Art.skillKind(kind: string): string? -- attack|support|sig (32) — 이미 공개된 종류만
	return url(AssetIds["skill32_" .. kind])
end

function Art.board(key: string): string? -- tile_own|tile_enemy|tile_forest|tile_mid|hl_move|hl_attack|hl_sel|hl_flee|hl_forced|frame (128, 2D 셀 전용)
	return url(AssetIds["board_" .. key])
end

function Art.ui(key: string): string? -- panel_side|panel_battle|panel_modal|panel_window|banner|btn_<default|primary|danger>_<normal|hover|pressed|disabled>|badge|hpbar_bg|hpbar_fill|shbar_bg|shbar_fill
	return url(AssetIds["ui_" .. key])
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
