--!nonstrict
-- run.luau — 룰 엔진 헤드리스 테스트 (luau CLI / lune 용 — Roblox 불필요)
-- 실행: luau tests/run.luau (roblox/ 디렉터리 기준)
-- 커밋 전 검증 계약(CLAUDE.md)의 Roblox판: RNG 골든 → 배치·반사 → 이동 규칙 → 접촉 6상황 유닛 → 전멸·끝줄 → 무작위 완주 스모크

local Engine = require("../src/shared/Engine")
local Rng = require("../src/shared/Rng")
local Data = require("../src/shared/Data")
local Config = require("../src/shared/Config")

local ROWS, COLS = Config.ROWS, Config.COLS

local passed, failed = 0, 0
local function ok(cond, name)
	if cond then
		passed += 1
	else
		failed += 1
		print("  ❌ FAIL: " .. name)
	end
end

local function eq(a, b, name)
	ok(a == b, name .. (" (got %s, want %s)"):format(tostring(a), tostring(b)))
end

--==================================================================
print("[1] mulberry32 RNG 골든 (JS 원본 대조)")
--==================================================================
local GOLDEN = {
	[1] = { 0.627073940588, 0.002735721180, 0.527447039960, 0.981050967472, 0.968377898214 },
	[12345] = { 0.979728267761, 0.306752264500, 0.484205421526, 0.817934412509, 0.509428369347 },
	[999999937] = { 0.422243195120, 0.747603441589, 0.033541144570, 0.154896796914, 0.453671634663 },
}
for seed, want in GOLDEN do
	local r = Rng.new(seed)
	for i = 1, 5 do
		local v = r:next()
		ok(math.abs(v - want[i]) < 1e-11, ("seed %d #%d"):format(seed, i))
	end
end

--==================================================================
print("[2] 사전 배치 적용·P2 행 반사 (#93)")
--==================================================================
local function fixedSetup()
	-- 로스터 6종 + 11~13행 14칸 고정 배치 (클라이언트 좌표 = 자기 하단 기준)
	local pos = {}
	for i = 1, 14 do
		pos[i] = { 11 + math.floor((i - 1) / 7), ((i - 1) % 7) + 1 }
	end
	return { roster = { "M-F1", "M-W2", "M-G3", "M-L4", "M-F5", "M-W1" }, pos = pos }
end

local e = Engine.new(42)
e:applySetup(0, fixedSetup())
e:applySetup(1, fixedSetup())
e:begin()
eq(e.S.phase, "play", "phase play")
local p0first, p1first = nil, nil
for _, p in e.S.pieces do
	if p.owner == 0 and not p0first then
		p0first = p
	end
	if p.owner == 1 and not p1first then
		p1first = p
	end
end
eq(p0first.r, 11, "P1 첫 말 r=11 (원좌표)")
eq(p1first.r, 3, "P2 첫 말 r=3 (14-11 반사)")
eq(p1first.c, 1, "P2 열 유지")
ok(p0first.rosterId == "M-F1" and p0first.name == "새끼 화룡", "로스터 주입")
eq(#p0first.skills, 4, "기술 4슬롯")

-- 손상 데이터 → 무작위 폴백
local e2 = Engine.new(7)
e2:applySetup(0, { roster = { "BAD" }, pos = {} })
local placed = 0
for _, p in e2.S.pieces do
	if p.owner == 0 and p.placed then
		placed += 1
		ok(p.r >= 11 and p.r <= 13, "폴백 배치 자기 진영")
	end
end
eq(placed, 14, "폴백 14개 배치")

--==================================================================
print("[3] 이동 규칙 (BT 이전 1칸·점유 차단)")
--==================================================================
local cur = e.S.current
local function ownPieceAt(eng, owner, r, c)
	for _, p in eng:alivePieces() do
		if p.owner == owner and p.r == r and p.c == c then
			return p
		end
	end
	return nil
end
-- 현재 플레이어의 전열 말 (P0 전열 r=11 / P1 전열 r=3)
local frontR = cur == 0 and 11 or 3
local mover = ownPieceAt(e, cur, frontR, 4)
ok(mover ~= nil, "전열 말 존재")
local fwd = cur == 0 and -1 or 1
local okMove = e:apply(cur, { t = "move", id = mover.id, r = frontR + fwd, c = 4 })
ok(okMove, "1칸 전진 허용")
eq(mover.r, frontR + fwd, "좌표 갱신")
-- #106 T7 서버판: 주 행동 후 전투 가능 대상이 없으면 자동 턴 종료 → 교대 확인
eq(e.S.current, 1 - cur, "자동 턴 종료 — 교대")
eq(e.S.turnCount, 1, "턴 수 증가")
local no2 = e:apply(cur, { t = "move", id = mover.id, r = 1, c = 1 })
ok(not no2, "상대 턴 아님 거부")
-- BT 이전 2칸 차단
local cur2 = e.S.current
local m2 = ownPieceAt(e, cur2, cur2 == 0 and 11 or 3, 1)
if m2 then
	local f2 = cur2 == 0 and -1 or 1
	ok(not e:apply(cur2, { t = "move", id = m2.id, r = m2.r + f2 * 2, c = 1 }), "BT 이전 2칸 거부")
end

--==================================================================
print("[4] 접촉 유닛: 폭탄·함정·밀기 (#106·#114)")
--==================================================================
local function freshPlay(seed)
	local en = Engine.new(seed)
	en:applySetup(0, fixedSetup())
	en:applySetup(1, fixedSetup())
	en:begin()
	en:drainOutbox()
	return en
end
local function findType(en, owner, ty)
	for _, p in en:alivePieces() do
		if p.owner == owner and p.type == ty then
			return p
		end
	end
	return nil
end

-- 4a. 하수인 → 폭탄: 둘 다 제거
local u = freshPlay(100)
local minion = findType(u, 0, "minion")
local bomb = findType(u, 1, "bomb")
minion.r, minion.c = 7, 4
bomb.r, bomb.c = 7, 5
u.S.current = 0
u.S.battlesUsed = 0
u:initBattle(minion, bomb)
ok(not minion.alive and not bomb.alive, "하수인·폭탄 동귀")
eq(u.S.metrics.bombHitsMinion, 1, "bombHitsMinion 지표")

-- 4b. 왕 → 폭탄: 폭탄만 제거·비공개 유지
local u2 = freshPlay(101)
local king = findType(u2, 0, "king")
local bomb2 = findType(u2, 1, "bomb")
king.r, king.c = 7, 4
bomb2.r, bomb2.c = 7, 5
u2.S.current = 0
u2:initBattle(king, bomb2)
ok(king.alive and not bomb2.alive, "왕 생존·폭탄 제거")
ok(not king.revealed, "왕 정체 비공개 유지")

-- 4c. 하수인 → 함정: 함정 제거·2턴 이동 불가·양측 공개
local u3 = freshPlay(102)
local m3 = findType(u3, 0, "minion")
local trap = findType(u3, 1, "trap")
m3.r, m3.c = 7, 4
trap.r, trap.c = 7, 5
u3.S.current = 0
u3:initBattle(m3, trap)
ok(not trap.alive and m3.immobile == 2 and m3.revealed and trap.revealed, "함정 발동 계약")

-- 4d. 동료 ↔ 동료: 전투 없이 밀기 (상황 8)
local u4 = freshPlay(103)
local a4 = findType(u4, 0, "ally")
local d4 = findType(u4, 1, "ally")
a4.r, a4.c = 7, 3
d4.r, d4.c = 7, 4
u4.S.current = 0
u4:initBattle(a4, d4)
ok(a4.alive and d4.alive, "밀기 — 양측 생존")
ok(not a4.revealed and not d4.revealed, "밀기 — 양측 비공개")
eq(u4.S.metrics.pushes, 1, "pushes 지표")
ok(math.abs(a4.r - d4.r) + math.abs(a4.c - d4.c) >= 2 or u4.S.metrics.relocations > 0, "밀기 후 비인접(또는 재배치)")

--==================================================================
print("[5] 왕 끝줄 승리·전투 완주")
--==================================================================
local u5 = freshPlay(104)
local k5 = findType(u5, 0, "king")
k5.r, k5.c = 2, 4
-- 진로 비우기
for _, p in u5:alivePieces() do
	if p ~= k5 and p.r == 1 and p.c == 4 then
		p.placed = false
	end
end
u5.S.current = 0
u5.S.mainUsed = false
local okK = u5:apply(0, { t = "move", id = k5.id, r = 1, c = 4 })
ok(okK, "왕 끝줄 이동")
eq(u5.S.phase, "over", "끝줄 즉시 종료")
eq(u5.S.winner, 0, "끝줄 승자")
eq(u5.S.metrics.winType, "edge", "winType edge")

-- 하수인 vs 하수인 전투 완주 (기본 공격 반복 → 즉사 또는 판정)
local u6 = freshPlay(105)
local a6, d6
for _, p in u6:alivePieces() do
	if p.type == "minion" then
		if p.owner == 0 and not a6 then
			a6 = p
		elseif p.owner == 1 and not d6 then
			d6 = p
		end
	end
end
a6.r, a6.c = 7, 3
d6.r, d6.c = 7, 4
u6.S.current = 0
u6.S.battlesUsed = 0
u6.S.mainUsed = true
local okB = u6:apply(0, { t = "battle", attId = a6.id, defId = d6.id })
ok(okB, "전투 개시")
ok(u6.S.battle ~= nil, "전투 객체 생성")
local guard = 0
while u6.S.battle and guard < 100 do
	guard += 1
	local side = u6:actorOfPhase()
	local owner = (side == "A") and u6.S.battle.attP.owner or u6.S.battle.defP.owner
	local okA, errA = u6:apply(owner, { t = "act", k = "basic" })
	if not okA then
		print("    battle act 거부: " .. tostring(errA))
		break
	end
end
ok(u6.S.battle == nil, "전투 종결 (라운드 " .. guard .. "회 행동)")
eq(u6.S.metrics.battles, 1, "battles 지표")
ok(u6.S.metrics.attackerWins + u6.S.metrics.defenderWins == 1, "승패 기록")

--==================================================================
print("[6] 무작위 완주 스모크 (20시드 — 정책: 무작위 합법 행동)")
--==================================================================
local function randomPolicy(en, rng)
	local S = en.S
	local guardTotal = 0
	while S.phase ~= "over" and guardTotal < 3000 do
		guardTotal += 1
		if S.pending then
			local pd = S.pending
			if pd.kind == "vip" then
				en:apply(pd.owner, { t = "vipPick", use = "body" })
			elseif pd.kind == "capture" then
				if S.balls[pd.owner] >= 2 and rng:NextNumber() < 0.7 then
					en:apply(pd.owner, { t = "capTry", mode = "safe" })
				else
					en:apply(pd.owner, { t = "capSkip" })
				end
			else
				en:apply(pd.owner, { t = "recruitKeep" })
			end
		elseif S.fleePick then
			en:apply(S.fleePick.owner, { t = "fleeSkip" })
		elseif S.battle then
			local side = en:actorOfPhase()
			local owner = (side == "A") and S.battle.attP.owner or S.battle.defP.owner
			local f = (side == "A") and S.battle.fa or S.battle.fd
			-- HTML UI 규칙 준수: 기본 공격은 전 슬롯 쿨일 때만 (그 외엔 준비된 슬롯 중 무작위)
			local slots = {}
			if f.skills then
				for i = 1, 4 do
					if f.cds[i] == 0 then
						table.insert(slots, i)
					end
				end
			end
			local k = (#slots > 0) and slots[rng:NextInteger(1, #slots)] or "basic"
			local okA, errA = en:apply(owner, { t = "act", k = k })
			if not okA then
				return false, "전투 행동 거부: " .. tostring(errA)
			end
		else
			local me = S.current
			if #S.forcedTargets > 0 then
				local okF = en:apply(me, { t = "battle", attId = S.movedPiece.id, defId = S.forcedTargets[rng:NextInteger(1, #S.forcedTargets)] })
				if not okF then
					return false, "강제 전투 이행 실패"
				end
			elseif not S.mainUsed then
				-- 무작위 합법 이동 수집
				local moves = {}
				for _, p in en:alivePieces() do
					if p.owner == me and p.type ~= "trap" and p.immobile == 0 then
						for _, d in { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } } do
							for _, k in (en:isBurning() and { 1, 2 } or { 1 }) do
								local r, c = p.r + d[1] * k, p.c + d[2] * k
								if r >= 1 and r <= ROWS and c >= 1 and c <= COLS and en:canMoveTo(p, r, c) then
									table.insert(moves, { p.id, r, c })
								end
							end
						end
					end
				end
				if #moves > 0 then
					local mv = moves[rng:NextInteger(1, #moves)]
					en:apply(me, { t = "move", id = mv[1], r = mv[2], c = mv[3] })
				else
					en:apply(me, { t = "endTurn" })
				end
			else
				en:apply(me, { t = "endTurn" })
			end
		end
		en:drainOutbox()
		if S.turnCount > 400 then
			return true, "장기전 컷"
		end
	end
	return S.phase == "over" or guardTotal < 3000, "guard " .. guardTotal
end

-- 간이 RNG (테스트 정책용 — Roblox Random 대체)
local function testRng(seed)
	local r = Rng.new(seed)
	return {
		NextNumber = function(_)
			return r:next()
		end,
		NextInteger = function(_, lo, hi)
			return lo + math.floor(r:next() * (hi - lo + 1))
		end,
	}
end

local finished, overCount = 0, 0
for seed = 1, 20 do
	local en = freshPlay(seed * 7919)
	local rng = testRng(seed * 104729)
	local okRun, why = randomPolicy(en, rng)
	if not okRun then
		print(("  ❌ seed %d 진행 불가: %s (턴 %d)"):format(seed, tostring(why), en.S.turnCount))
		failed += 1
	else
		finished += 1
		if en.S.phase == "over" then
			overCount += 1
			-- 불변식: 승자 유효·지표 정합
			local m = en.S.metrics
			ok(en.S.winner == 0 or en.S.winner == 1 or en.S.winner == -1, "seed " .. seed .. " 승자 유효")
			ok(m.winType ~= nil, "seed " .. seed .. " winType 기록")
			for p = 0, 1 do
				for _, k in Engine.PLAYER_METRIC_KEYS do
					local sum = (m.byPlayer[0][k] or 0) + (m.byPlayer[1][k] or 0)
					if m[k] ~= nil and sum ~= m[k] then
						failed += 1
						print(("  ❌ seed %d 지표 불일치 %s: 합산 %s vs byPlayer 합 %s"):format(seed, k, tostring(m[k]), tostring(sum)))
					end
				end
				break -- 지표 비교는 한 번이면 충분
			end
		end
		-- HP 불변식
		for _, p in en.S.pieces do
			ok(p.hp <= p.maxHp, "seed " .. seed .. " HP ≤ maxHp")
			if not (p.hp <= p.maxHp) then
				break
			end
		end
	end
end
print(("  완주 %d/20 · 종료 도달 %d/20"):format(finished, overCount))
ok(finished == 20, "20시드 전체 진행 가능 (룰 데드락 없음)")
-- 무작위 정책은 공격성이 없어 장기전이 흔하다 (400턴 컷) — 자연 종료가 일부라도 나오면 승리 경로 정상
ok(overCount >= 5, "자연 종료 도달 시드 존재 (" .. overCount .. "/20)")

--==================================================================
print("[7] Art 연결 — 업로드 전 폴백·허용 목록 (#89)")
--==================================================================
local Art = require("../src/shared/Art")
local AssetIds = require("../src/shared/AssetIds")
eq(Art.dirOf("M-F2"), "fire_atk", "rosterId → 종 폴더")
eq(Art.dirOf("BAD"), nil, "허용 목록 밖 → nil")
eq(Art.dirOf(nil), nil, "nil rosterId → nil")
local n = 0
for _ in AssetIds do
	n += 1
end
if n == 0 then
	eq(Art.icon("M-F2"), nil, "ID 없음 → 폴백 nil")
	eq(Art.battle("M-F2"), nil, "ID 없음 → 폴백 nil")
else
	ok(string.find(Art.icon("M-F2") or "", "^rbxassetid://%d+$") ~= nil, "ID 있음 → rbxassetid URL")
	ok(string.find(Art.battle("M-F2") or "", "^rbxassetid://%d+$") ~= nil, "battle URL")
	print(("  AssetIds %d개 로드"):format(n))
	if n >= 143 then -- P0 129 PNG + 로비 13 + 가림 1 전량 업로드 후
		local function isUrl(u)
			return type(u) == "string" and string.find(u, "^rbxassetid://%d+$") ~= nil
		end
		for _, k in { "king", "ally", "bomb", "trap", "unknown" } do
			ok(isUrl(Art.token(k, 64)), "token64 " .. k)
		end
		for _, el in Data.ELEMS do
			ok(isUrl(Art.element(el)), "element " .. el)
		end
		ok(isUrl(Art.trace()), "trace")
		for _, k in { "shield", "burn", "weaken", "shock", "dmgcut", "focus", "vuln" } do
			ok(isUrl(Art.status(k)), "status " .. k)
		end
		for _, k in { "potion", "cool", "cure", "ball", "reserve" } do
			ok(isUrl(Art.item(k)), "item " .. k)
		end
		for _, k in { "search", "teleport", "heal", "skip", "endturn", "resign", "fight", "bag", "capture", "flee" } do
			ok(isUrl(Art.action(k)), "action " .. k)
		end
		for _, k in { "attack", "support", "sig" } do
			ok(isUrl(Art.skillKind(k)), "skillKind " .. k)
		end
		for _, k in { "tile_own", "tile_enemy", "tile_forest", "tile_mid", "hl_move", "hl_attack", "hl_sel", "hl_flee", "hl_forced", "frame" } do
			ok(isUrl(Art.board(k)), "board " .. k)
		end
		for _, kind in { "default", "primary", "danger" } do
			for _, st in { "normal", "hover", "pressed", "disabled" } do
				ok(isUrl(Art.ui("btn_" .. kind .. "_" .. st)), "btn " .. kind .. " " .. st)
			end
		end
		for _, k in { "panel_side", "panel_battle", "panel_modal", "badge", "hpbar_bg", "hpbar_fill", "shbar_bg", "shbar_fill" } do
			ok(isUrl(Art.ui(k)), "ui " .. k)
		end
		for _, k in { "desk", "chair", "board", "floor", "wall", "pillar" } do
			ok(type(Art.lobbyMeshId(k)) == "number", "lobby mesh " .. k)
		end
		ok(type(Art.meshId("unknown")) == "number", "unknown mesh id")
		-- 틴트 7종·슬라이스 5군 계약
		for _, k in { "hl_move", "hl_flee", "hl_attack", "hl_forced", "hl_sel", "hpbar_fill", "shbar_fill" } do
			ok(Art.TINT[k] ~= nil, "tint " .. k)
		end
		for _, k in { "hl", "panel", "btn", "badge", "bar" } do
			ok(Art.SLICE[k] ~= nil and #Art.SLICE[k] == 4, "slice " .. k)
		end
	end
end

--==================================================================
print("[8] 정보 은닉 — 순번 ID 셔플·뷰 보드 위치순 정렬 (인계서 §6)")
--==================================================================
local Views = require("../src/shared/Views")
local seqLeak = 0
for seed = 1, 10 do
	local en = freshPlay(seed * 31337)
	local king0 = findType(en, 0, "king")
	local king1 = findType(en, 1, "king")
	if king0.id == 14 and king1.id == 28 then
		seqLeak += 1
	end
	-- 종류별 ID 구간이 고정이면 누출: 하수인 6개의 ID 가 정확히 {1..6} 인지
	local mids = {}
	for _, p in en.S.pieces do
		if p.owner == 0 and p.type == "minion" then
			table.insert(mids, p.id)
		end
	end
	table.sort(mids)
	local isSeq = true
	for i = 1, 6 do
		if mids[i] ~= i then
			isSeq = false
		end
	end
	if isSeq then
		seqLeak += 1
	end
	-- ID 유일성·범위
	local seen = {}
	for _, p in en.S.pieces do
		ok(p.id >= 1 and p.id <= 28 and not seen[p.id], "seed " .. seed .. " ID 유일·범위")
		seen[p.id] = true
	end
	-- 뷰 보드는 위치순 (생성 순서 = 종류 순서가 새지 않는다)
	local v = Views.forViewer(en, 0)
	local sorted = true
	for i = 2, #v.board do
		local a, b = v.board[i - 1], v.board[i]
		if a.r > b.r or (a.r == b.r and a.c > b.c) then
			sorted = false
		end
	end
	ok(sorted, "seed " .. seed .. " 뷰 보드 위치순 정렬")
	-- 미공개 상대 말에는 정체·HP·rosterId 가 없다
	for _, e in v.board do
		if e.owner == 1 and not e.known then
			ok(e.type == nil and e.hp == nil and e.rosterId == nil and e.name == nil, "seed " .. seed .. " 미공개 말 정체 비전송")
		end
	end
end
ok(seqLeak == 0, "종류별 고정 순번 ID 없음 (누출 " .. seqLeak .. "/10)")

--==================================================================
print("[9] 배치 검증·합법 수 목록 (Phase 2c)")
--==================================================================
local okS, whyS = Engine.validateSetup(fixedSetup())
ok(okS, "정상 배치 통과")
ok(not Engine.validateSetup({ roster = { "M-F1" }, pos = {} }), "로스터 부족 거부")
local dup = fixedSetup()
dup.roster[2] = "M-F1"
ok(not Engine.validateSetup(dup), "로스터 중복 거부")
local outside = fixedSetup()
outside.pos[1] = { 10, 1 }
ok(not Engine.validateSetup(outside), "진영 밖 거부")
local overlap = fixedSetup()
overlap.pos[2] = { 11, 1 }
ok(not Engine.validateSetup(overlap), "칸 겹침 거부")
ok(select(2, Engine.validateSetup(overlap)) ~= nil, "거부 사유 문자열")

local g9 = freshPlay(4242)
local cur9 = g9.S.current
local v9 = Views.forViewer(g9, cur9)
ok(v9.legal ~= nil, "내 턴 뷰에 legal 존재")
local vOpp = Views.forViewer(g9, 1 - cur9)
ok(vOpp.legal == nil, "상대 턴 뷰에 legal 없음")
local movable, trapMoves, anyAttack = 0, 0, 0
for _, p in g9:alivePieces() do
	if p.owner == cur9 then
		local lg = v9.legal[tostring(p.id)]
		ok(lg ~= nil, "자기 말마다 legal 항목")
		if lg then
			if #lg.moves > 0 then
				movable += 1
			end
			if p.type == "trap" then
				trapMoves += #lg.moves
			end
			anyAttack += #lg.attacks
			for _, rc in lg.moves do
				ok(g9:canMoveTo(p, rc[1], rc[2]), "legal 이동은 canMoveTo 와 일치")
			end
		end
	end
end
ok(movable >= 7, "전열 말 다수 이동 가능 (" .. movable .. ")")
eq(trapMoves, 0, "함정은 이동 불가")
eq(anyAttack, 0, "개시 직후 공격 대상 없음")
-- 상대 말은 legal 에 없다 (자기 말만)
for _, p in g9:alivePieces() do
	if p.owner ~= cur9 then
		ok(v9.legal[tostring(p.id)] == nil, "상대 말 legal 미포함")
		break
	end
end

--==================================================================
print(("\n결과: %d passed · %d failed"):format(passed, failed))
if failed > 0 then
	error("테스트 실패", 0)
end
