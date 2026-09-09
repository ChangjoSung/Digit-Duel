--!strict
-- Rng.luau — 시드 가능한 RNG (demo/index.html mulberry32 포팅, #21)
-- JS 원본과 같은 시드에서 같은 수열을 생성한다 (32비트 정수 연산을 bit32로 재현).
-- 게임 로직의 모든 난수는 이 모듈 인스턴스를 경유한다 — 서버 권위 구조에서는 서버만 굴린다.

local MOD = 4294967296 -- 2^32

-- 32비트 곱 (Math.imul 등가, mod 2^32) — 53비트 배정도 안에서 정확
local function mul32(a: number, b: number): number
	local ah = math.floor(a / 65536)
	local al = a % 65536
	return ((ah * b % 65536) * 65536 + al * b) % MOD
end

local Rng = {}
Rng.__index = Rng

export type Rng = typeof(setmetatable({} :: { state: number }, Rng))

function Rng.new(seed: number): Rng
	local self = setmetatable({}, Rng)
	self.state = math.floor(seed) % MOD -- JS: Number(seed)>>>0
	return self
end

-- [0,1) 난수 — JS mulberry32와 비트 단위 동일
function Rng.next(self: Rng): number
	local a = (self.state + 0x6D2B79F5) % MOD
	self.state = a
	local t = mul32(bit32.bxor(a, bit32.rshift(a, 15)), bit32.bor(1, a))
	t = bit32.bxor((t + mul32(bit32.bxor(t, bit32.rshift(t, 7)), bit32.bor(61, t))) % MOD, t)
	return bit32.bxor(t, bit32.rshift(t, 14)) / MOD
end

return Rng
