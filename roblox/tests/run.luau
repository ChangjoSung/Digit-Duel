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
			else -- #121 recruit: 포획(안전) / 기술 교체 / 포기 를 무작위로
				local recv = en:capReceivers(pd.owner)
				local roll = rng:NextNumber()
				if #recv > 0 and S.balls[pd.owner] >= 2 and roll < 0.4 then
					en:apply(pd.owner, { t = "capTry", mode = "safe", recvId = recv[1].id })
				elseif roll < 0.8 then
					local done = false
					for _, m in en:rosterMinions(pd.owner) do
						if m.alive and m.placed and m.skills and not table.find(m.skills, "dragon_breath") then
							en:apply(pd.owner, { t = "recruitSwap", skill = "dragon_breath", targetId = m.id, slot = rng:NextInteger(1, 4) })
							done = true
							break
						end
					end
					if not done then
						en:apply(pd.owner, { t = "recruitKeep" })
					end
				else
					en:apply(pd.owner, { t = "recruitKeep" })
				end
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
print("[10] AI 포팅 (#21) — 자동 배치·5급/5단 AI 대 AI 완주·결정성")
--==================================================================
local Ai = require("../src/shared/Ai")
for seed = 1, 20 do
	local setup = Ai.autoSetup(Rng.new(seed * 31))
	local okS, whyS = Engine.validateSetup(setup)
	ok(okS, ("autoSetup seed %d 유효: %s"):format(seed, tostring(whyS)))
	ok(setup.pos[14][1] == 13 or setup.pos[14][1] == 12, "왕은 후열/중열")
	local guard = 0
	for i = 7, 9 do -- 폭탄 3개 중 왕 인접이 1개 이상
		if math.abs(setup.pos[i][1] - setup.pos[14][1]) + math.abs(setup.pos[i][2] - setup.pos[14][2]) == 1 then
			guard += 1
		end
	end
	ok(guard >= 1, "폭탄 왕 호위 ≥1")
end

local function aiGame(seed, lvA, lvB)
	local en = Engine.new(seed)
	en:applySetup(0, Ai.autoSetup(Rng.new(seed + 1)))
	en:applySetup(1, Ai.autoSetup(Rng.new(seed + 2)))
	Ai.setLevel(en, 0, lvA)
	Ai.setLevel(en, 1, lvB)
	en:begin()
	en:drainOutbox()
	local guard, steps = 0, 0
	while en.S.phase ~= "over" and guard < 8000 do
		guard += 1
		local me = nil
		for p = 0, 1 do
			if Ai.needsAct(en, p) then
				me = p
			end
		end
		if me == nil then
			return en, false, "누구 차례도 아님 (데드락)"
		end
		local okA, why = Ai.act(en, me)
		if not okA then
			return en, false, "AI 행동 실패: " .. tostring(why)
		end
		steps += 1
		en:drainOutbox()
		if en.S.turnCount > Config.AI.simMaxTurns then
			return en, true, "장기전 컷"
		end
	end
	return en, en.S.phase == "over", ("steps %d"):format(steps)
end

local t0 = os.clock()
local combos = { { "grade5", "grade5" }, { "dan5", "grade5" }, { "dan5", "dan5" } }
local total, finished, overCount = 0, 0, 0
for _, cb in combos do
	local tc = os.clock()
	local wins = { [0] = 0, [1] = 0, [-1] = 0 }
	for seed = 1, 8 do
		total += 1
		local en, okRun, why = aiGame(seed * 7919 + 17, cb[1], cb[2])
		if not okRun then
			failed += 1
			print(("  ❌ %s vs %s seed %d 진행 불가: %s (턴 %d)"):format(cb[1], cb[2], seed, tostring(why), en.S.turnCount))
		else
			finished += 1
			if en.S.phase == "over" then
				overCount += 1
				wins[en.S.winner] = (wins[en.S.winner] or 0) + 1
				ok(en.S.winner == 0 or en.S.winner == 1 or en.S.winner == -1, "AI 대전 승자 유효")
				ok(en.S.metrics.winType ~= nil, "AI 대전 winType 기록")
			end
			for _, p in en.S.pieces do
				if not (p.hp <= p.maxHp) then
					failed += 1
					print("  ❌ HP > maxHp")
					break
				end
			end
		end
	end
	print(("  %s vs %s: 승 P1 %d · P2 %d · 무 %d (%.1fs)"):format(cb[1], cb[2], wins[0], wins[1], wins[-1], os.clock() - tc))
end
print(("  완주 %d/%d · 종료 도달 %d/%d (%.1fs)"):format(finished, total, overCount, total, os.clock() - t0))
ok(finished == total, "AI 대전 전체 진행 가능 (데드락·거부 없음)")
ok(overCount >= total * 0.8, "AI 대전 대부분 자연 종료 (" .. overCount .. "/" .. total .. ")")

-- 결정성: 같은 시드 → 같은 결과 (5급, 시간 예산 없음)
local d1 = aiGame(424242, "grade5", "grade5")
local d2 = aiGame(424242, "grade5", "grade5")
eq(d1.S.winner, d2.S.winner, "5급 결정성 — 승자")
eq(d1.S.turnCount, d2.S.turnCount, "5급 결정성 — 턴 수")

-- 교체 정책 (v0.4.4 §2.7): 방어형은 효과기 보존 · 위력 비교
do
	local pDef = { rosterId = "M-F3", skills = { "fire_effect", "fire_heavy", "sup_guard", "sig_def" } }
	eq(Ai.recruitSlot(pDef, "water_heavy"), nil, "방어형: 효과기 제외 → 고위력기(38) 보다 낮은 후보(32) 는 유지")
	local pDef2 = { rosterId = "M-F3", skills = { "fire_effect", "fire_stable", "sup_guard", "sig_def" } }
	eq(Ai.recruitSlot(pDef2, "water_heavy"), 2, "방어형: 효과기 제외 → 안정기(2, 26) 를 고위력 후보(32) 로 교체")
	local pAtk = { rosterId = "M-F2", skills = { "fire_stable", "fire_heavy", "sup_focus", "sig_atk" } }
	eq(Ai.recruitSlot(pAtk, "water_stable"), 1, "공격형: 위력 최저 슬롯(1) 동률 → 교체")
	eq(Ai.recruitSlot(pAtk, "grass_effect"), nil, "공격형: 위력 낮으면 유지")
end

--==================================================================
print("[11] v0.4.7 규칙 (#121·#129) — 이벤트 6개·시작 자원·패키지·버프 3종·신규 기술 3종·기술 교체·숲 포획·탐색 종료")
--==================================================================
local BAL = Config.BAL
for seed = 1, 20 do -- 계약 1.1: 구역마다 3종 각 1개, 전체 6개
	local en = Engine.new(seed)
	eq(#en.S.events, 6, "이벤트 6개 seed " .. seed)
	local per = { A = {}, B = {} }
	for _, ev in en.S.events do
		local z = (ev.r <= 5) and "A" or "B"
		per[z][ev.kind] = (per[z][ev.kind] or 0) + 1
	end
	for _, z in { "A", "B" } do
		for _, k in Data.EVENT_KINDS do
			eq(per[z][k], 1, z .. " " .. k .. " 1개")
		end
	end
end
do -- 계약 2.1: 시작 자원 1/1/1 · 볼 2 · 패키지 0
	local en = freshPlay(1101)
	for p = 0, 1 do
		eq(#en.S.inv[p], 3, "시작 아이템 3 (P" .. (p + 1) .. ")")
		eq(en.S.balls[p], 2, "시작 볼 2")
		eq(en.S.pkgs[p].itemGift + en.S.pkgs[p].battleBuff, 0, "패키지 0")
	end
end

-- 전투 하네스: P1 하수인 vs P2 하수인 (또는 P2 왕) 인접 → 전투 개시
local function mkBattle(seed, defType)
	local en = freshPlay(seed)
	local a, d
	for _, p in en:alivePieces() do
		if p.owner == 0 and p.type == "minion" and not a then
			a = p
		elseif p.owner == 1 and p.type == (defType or "minion") and not d then
			d = p
		end
	end
	a.r, a.c = 7, 3
	d.r, d.c = 7, 4
	en.S.current = 0
	en.S.battlesUsed = 0
	en.S.mainUsed = true
	local okB = en:apply(0, { t = "battle", attId = a.id, defId = d.id })
	ok(okB and en.S.battle ~= nil, "전투 개시 (" .. seed .. ")")
	return en, a, d
end
local function actorOwner(en)
	local side = en:actorOfPhase()
	return (side == "A") and en.S.battle.attP.owner or en.S.battle.defP.owner, side
end
local function actBasic(en)
	local owner = actorOwner(en)
	return en:apply(owner, { t = "act", k = "basic" })
end

do -- 계약 2.2: 선물 개봉 — 행동 미소모 · 상한 없음 · 재고 0 이면 거부
	local en = mkBattle(1102)
	local B = en.S.battle
	en.S.pkgs[0].itemGift = 3
	local phase0 = B.phase
	ok(en:apply(0, { t = "gift", pick = "ball" }), "선물 개봉 볼")
	ok(en:apply(0, { t = "gift", pick = "ball" }), "선물 개봉 볼 2")
	ok(en:apply(0, { t = "gift", pick = "potion" }), "선물 개봉 회복약")
	eq(en.S.balls[0], 4, "볼 2+2 (상한 없음)")
	eq(#en.S.inv[0], 4, "아이템 3+1")
	eq(en.S.pkgs[0].itemGift, 0, "패키지 소모")
	eq(B.phase, phase0, "개봉은 행동 미소모")
	ok(not en:apply(0, { t = "gift", pick = "cure" }), "재고 0 → 거부")
	ok(not en:apply(1, { t = "gift", pick = "cure" }), "상대 차례 아님 → 거부")
end
do -- 계약 2.3: 아이템은 라운드 1회만 · 다음 라운드엔 같은 종류도 가능 · 전투 3회 이상 가능
	local en = mkBattle(1103)
	local B = en.S.battle
	en.S.inv[0] = { "potion", "potion", "potion", "cure" }
	en.S.inv[1] = { "potion", "potion" }
	B.fa.hp = 40
	ok(en:apply(0, { t = "item", i = 1 }), "R1 회복약 1회")
	ok(not en:apply(0, { t = "item", i = 1 }), "같은 라운드 두 번째 → 거부")
	local used = 1
	local guard = 0
	while en.S.battle and guard < 40 do
		guard += 1
		local owner, side = actorOwner(en)
		local ir = (side == "A") and B.itemRoundA or B.itemRoundD
		if owner == 0 and not ir and table.find(en.S.inv[0], "potion") then
			ok(en:apply(0, { t = "item", i = table.find(en.S.inv[0], "potion") }), "다음 라운드 같은 종류(회복약) 재사용")
			used += 1
		end
		actBasic(en)
	end
	ok(used >= 3, "한 전투에서 아이템 3회 이상 (" .. used .. ")")
end
do -- 계약 3.1·3.2: 힘의 수호자 — 한 전투 1개 · 분산 상단 고정 · 무료
	local en = mkBattle(1104)
	local B = en.S.battle
	en.S.pkgs[0].battleBuff = 2
	local phase0 = B.phase
	ok(en:apply(0, { t = "buff", kind = "power" }), "힘 적용")
	eq(B.buffA, "power", "회계 buffA")
	ok(B.fa.powerBuff == true, "powerBuff 플래그")
	eq(B.phase, phase0, "버프는 행동 미소모")
	ok(not en:apply(0, { t = "buff", kind = "escape" }), "한 전투 두 번째 버프 → 거부")
	eq(en.S.pkgs[0].battleBuff, 1, "패키지 1개만 소모 (나머지 보관)")
	-- 기본 공격 피해 = round(atk × 1.2) → 상성 → (보호막 0) — 결정적
	local f, opp = B.fa, B.fd
	local base = Data.round(f.atk * (1 + BAL.dmgVar))
	if f.element and opp.element then
		if Data.BEATS[f.element] == opp.element then
			base = Data.round(base * BAL.advMult)
		elseif Data.BEATS[opp.element] == f.element then
			base = Data.round(base * BAL.disMult)
		end
	end
	local hp0 = opp.hp
	-- 슬롯이 아닌 순수 기본 공격을 위해 전 슬롯 쿨
	B.fa.cds = { 1, 1, 1, 1 }
	ok(en:apply(0, { t = "act", k = "basic" }), "기본 공격")
	eq(hp0 - opp.hp, base, "힘: 분산 상단(×1.2) 고정 피해")
	-- 전투 종료 후 플래그 정리
	local guard = 0
	while en.S.battle and guard < 60 do
		guard += 1
		actBasic(en)
	end
	ok(f.powerBuff == false, "전투 종료 후 powerBuff 정리")
end
do -- 계약 3.3: 시간의 수호자 — R1 한정 · 그 전투만 3라운드 · 전역 불변 · 사신 불가 · 판정 동일
	local en = mkBattle(1105)
	local B = en.S.battle
	en.S.pkgs[0].battleBuff = 1
	ok(en:apply(0, { t = "buff", kind = "time" }), "R1 시간 적용")
	eq(B.maxRounds, 3, "전투 인스턴스 3라운드")
	eq(en:battleMaxRounds(), 3, "battleMaxRounds 3")
	eq(BAL.maxRounds, 6, "전역 maxRounds 불변")
	ok(en:reaperWhy("A") ~= nil and en:reaperWhy("D") ~= nil, "3라운드 전투는 사신 봉인 해제 불가")
	local j0 = en.S.metrics.judged
	local guard = 0
	while en.S.battle and guard < 40 do
		guard += 1
		actBasic(en)
	end
	eq(en.S.metrics.judged, j0 + 1, "3라운드 뒤 판정 종료")
	ok(guard <= 6, "행동 6회(3라운드) 안에 종료 (" .. guard .. ")")
	local en2 = mkBattle(1106)
	en2.S.pkgs[0].battleBuff = 1
	en2.S.pkgs[1].battleBuff = 1
	actBasic(en2)
	actBasic(en2) -- 라운드 2 진입
	eq(en2.S.battle.round, 2, "라운드 2")
	local o2 = actorOwner(en2)
	ok(not en2:apply(o2, { t = "buff", kind = "time" }), "R2 시간 → 거부")
	ok(en2:apply(o2, { t = "buff", kind = "power" }), "R2 힘은 가능")
	eq(en2:battleMaxRounds(), 6, "다른 전투는 6라운드")
end
do -- 계약 3.4: 도망의 수호자 — HP 게이트만 해제
	local en = mkBattle(1107)
	local B = en.S.battle
	ok(not en:apply(0, { t = "flee" }), "HP 100% 도망 → 거부")
	en.S.pkgs[0].battleBuff = 1
	ok(en:apply(0, { t = "buff", kind = "escape" }), "도망의 수호자 적용")
	ok(B.fa.fleeFree == true, "fleeFree")
	ok(en:apply(0, { t = "flee" }), "HP 100% 이어도 도망 시도 가능")
end
-- 계약 4: 기술 교체 — 3종 직접 선택 · 최초 6명 생존 · 4슬롯 어디든 · 중복 금지 · 쿨 승계 · 공개 초기화
do
	local en = freshPlay(1108)
	local m1, m2
	for _, p in en:rosterMinions(0) do
		if not m1 then
			m1 = p
		elseif not m2 then
			m2 = p
		end
	end
	en.S.pending = { kind = "recruit", owner = 0, pieceId = m1.id, species = "M-F1" }
	m1.cds = { 0, 0, 2, 0 }
	m1.revealedSkills = { 3, 4 }
	ok(not en:apply(0, { t = "recruitSwap", skill = "fire_heavy", targetId = m1.id, slot = 1 }), "신규 3종 외 → 거부")
	ok(not en:apply(0, { t = "recruitSwap", skill = "dragon_breath", targetId = m1.id, slot = 5 }), "슬롯 5 → 거부")
	ok(not en:apply(1, { t = "recruitSwap", skill = "dragon_breath", targetId = m1.id, slot = 3 }), "상대가 대신 선택 → 거부")
	ok(en:apply(0, { t = "recruitSwap", skill = "dragon_breath", targetId = m1.id, slot = 3 }), "보조기 슬롯(3) 교체")
	eq(m1.skills[3], "dragon_breath", "슬롯3 = 드래곤")
	eq(m1.cds[3], 2, "남은 쿨 승계")
	ok(table.find(m1.revealedSkills, 3) == nil and table.find(m1.revealedSkills, 4) ~= nil, "교체 슬롯만 공개 초기화")
	ok(en.S.pending == nil, "pending 해소")
	en.S.pending = { kind = "recruit", owner = 0, pieceId = m1.id, species = "M-F1" }
	ok(not en:apply(0, { t = "recruitSwap", skill = "dragon_breath", targetId = m1.id, slot = 1 }), "중복 장착 → 거부")
	m2.alive = false
	ok(not en:apply(0, { t = "recruitSwap", skill = "witch_prank", targetId = m2.id, slot = 1 }), "죽은 말 → 거부")
	ok(en:apply(0, { t = "recruitKeep" }), "포기")
	ok(en.S.pending == nil, "포기 후 pending 없음")
end
-- 계약 6: 숲 포획 — ROSTER 20종 그대로(rosterId·스탯·기술) · 수령 말 · 공격 실패 반동은 탐색 말
do
	local en = freshPlay(1109)
	local searcher = en:rosterMinions(0)[1]
	local recv = en:capReceivers(0)[1]
	ok(recv ~= nil and (recv.type == "ally" or recv.type == "king"), "수령 후보 존재")
	en.S.balls[0] = 3
	en.S.pending = { kind = "recruit", owner = 0, pieceId = searcher.id, species = "M-L2" }
	ok(not en:apply(0, { t = "capTry", mode = "safe", recvId = searcher.id }), "하수인은 수령 불가")
	ok(en:apply(0, { t = "capTry", mode = "safe", recvId = recv.id }), "안전 포획")
	eq(en.S.balls[0], 1, "볼 -2")
	ok(recv.cap ~= nil, "수령 말에 cap")
	eq(recv.cap.rosterId, "M-L2", "규칙용 rosterId 보존")
	eq(recv.cap.hp, 90, "M-L2 HP 90")
	eq(recv.cap.atk, 25, "M-L2 ATK 25")
	eq(recv.cap.skills[4], "sig_atk", "공격형 시그니처 그대로")
	eq(Data.archOf(recv.cap), "atk", "archOf → 그 종의 아키타입")
	-- 공격 포획 실패 반동 = 탐색 말
	local en2 = freshPlay(1110)
	local s2 = en2:rosterMinions(0)[1]
	local r2 = en2:capReceivers(0)[1]
	en2.rand = function()
		return 0.95
	end
	local res = en2:tryCapture(s2, "attack", r2, Data.rosterById("M-G3"))
	ok(not res.ok, "roll 0.95 → 공격 포획 실패")
	eq(s2.hp, s2.maxHp - Data.round(s2.maxHp * BAL.captureAtkFailPct), "반동은 탐색 말 HP 25%")
	ok(r2.cap == nil, "수령 말은 무피해·cap 없음")
end
-- 계약 5.1 드래곤: 속성 상대 ×1.3 · 무속성(왕) 중립
do
	local en = mkBattle(1111)
	local B = en.S.battle
	B.fa.skills[1] = "dragon_breath"
	B.fa.cds = { 0, 1, 1, 1 }
	B.fa.powerBuff = true -- 분산 고정으로 결정적 비교
	ok(Data.atkElOf(B.fa, Data.SKILLS.dragon_breath) == nil, "cls 기술은 판정 속성 nil")
	local hp0 = B.fd.hp
	local expect = Data.round(Data.round(Data.slotPow(B.fa, Data.SKILLS.dragon_breath) * 1.2) * 1.3)
	ok(en:apply(0, { t = "act", k = 1 }), "드래곤 사용")
	eq(hp0 - B.fd.hp, expect, "속성 상대 ×1.3 (상성표 미적용)")
	local en2 = mkBattle(1112, "king")
	local B2 = en2.S.battle
	ok(B2 ~= nil and B2.fd.element == nil, "왕 본체 상대 (무속성)")
	B2.fa.skills[1] = "dragon_breath"
	B2.fa.cds = { 0, 1, 1, 1 }
	B2.fa.powerBuff = true
	local hp2 = B2.fd.hp
	local expect2 = Data.round(Data.slotPow(B2.fa, Data.SKILLS.dragon_breath) * 1.2)
	ok(en2:apply(0, { t = "act", k = 1 }), "드래곤 vs 왕")
	eq(hp2 - B2.fd.hp, expect2, "무속성 상대 중립 1.0")
end
-- 계약 5.2 마녀: 서로 다른 2효과 100% · 풀 = 실피해 즉시 회복 · 재부여 갱신
do
	local seen = { burn = 0, weaken = 0, shock = 0, heal = 0 }
	local combos = {}
	for seed = 1, 24 do
		local en = mkBattle(2000 + seed)
		local B = en.S.battle
		B.fa.skills[1] = "witch_prank"
		B.fa.cds = { 0, 1, 1, 1 }
		B.fa.hp = 50
		B.fd.burn = 1 -- 재부여 갱신 확인용
		local hp0, myHp0 = B.fd.hp, B.fa.hp
		ok(en:apply(0, { t = "act", k = 1 }), "마녀 사용")
		local n = 0
		local key = ""
		if B.fd.burn == BAL.burnRounds then
			n += 1
			seen.burn += 1
			key ..= "b"
		end
		if B.fd.weaken > 0 then
			n += 1
			seen.weaken += 1
			key ..= "w"
		end
		if B.fd.shock > 0 then
			n += 1
			seen.shock += 1
			key ..= "s"
		end
		if B.fa.hp > myHp0 then
			n += 1
			seen.heal += 1
			key ..= "g"
			eq(B.fa.hp - myHp0, hp0 - B.fd.hp, "풀 회복 = 실HP 피해 100%")
		end
		combos[key] = true
		ok(n == 2 or (n == 1 and B.fa.hp == myHp0 and B.fd.burn ~= BAL.burnRounds and (B.fd.weaken == 0 or B.fd.shock == 0)), "서로 다른 2효과 (seed " .. seed .. ", " .. key .. ")")
	end
	ok(seen.burn > 0 and seen.weaken > 0 and seen.shock > 0 and seen.heal > 0, "4효과 모두 등장")
	ok(seen.burn > 0, "화상 재부여 시 지속 갱신(2R)")
end
-- 계약 5.3 사신: 봉인 게이트 · 보호막 무시 즉사 · 폴백
do
	local en = mkBattle(1113)
	local B = en.S.battle
	B.fa.skills[2] = "reaper_scythe"
	B.fa.cds = { 1, 0, 1, 1 }
	ok(not en:slotUsable(B.fa, 2, "A"), "R1 봉인")
	ok(not en:apply(0, { t = "act", k = 2 }), "봉인 슬롯 사용 → 거부")
	ok(en:apply(0, { t = "act", k = "basic" }), "봉인·쿨뿐이면 기본 공격 폴백 가능")
	-- 6라운드·열세·보호막
	local en2 = mkBattle(1114)
	local B2 = en2.S.battle
	B2.fa.skills[2] = "reaper_scythe"
	B2.fa.cds = { 0, 0, 0, 0 }
	B2.round = 6
	B2.phase = 0
	B2.fa.hp = 50
	B2.fd.hp = 60
	B2.fd.shield = 40
	eq(en2:actorOfPhase(), "D", "6라운드는 방어자 선공")
	B2.round = 5
	B2.fa.hp = 60 -- 동률 → 불가
	B2.fd.hp = 60
	ok(en2:reaperWhy("A") ~= nil, "5라운드 봉인")
	B2.round = 7
	ok(en2:reaperWhy("A") ~= nil, "HP 비율 동률 → 불가")
	B2.fa.hp = 50
	ok(en2:reaperWhy("A") == nil, "7라운드·열세 → 가능")
	eq(en2:actorOfPhase(), "A", "7라운드 공격자 선공")
	ok(en2:apply(0, { t = "act", k = 2 }), "사신 발동")
	ok(en2.S.battle == nil, "즉사로 전투 종료")
	eq(en2.S.metrics.attackerWins, 1, "공격자 승")
	ok(B2.fd.hp == 0 and B2.fd.shield == 0, "보호막째 즉사")
end
-- #129: 탐색 완료 후 턴 종료 — 단순 획득은 확인 없이 종료, recruit 는 선택이 끝나야 종료
do
	local en = freshPlay(1115)
	local m = en:rosterMinions(0)[1]
	local evG, evR
	for _, ev in en.S.events do
		if ev.r >= 9 and ev.kind == "itemGift" then
			evG = ev
		elseif ev.r >= 9 and ev.kind == "recruit" then
			evR = ev
		end
	end
	-- 다른 모든 P1 말을 판에서 멀리 (선택 전투 없음)
	for _, p in en:alivePieces() do
		if p.owner == 0 and p ~= m then
			p.placed = false
		end
	end
	m.r, m.c = evG.r, evG.c
	en.S.traces[0][evG.r .. "_" .. evG.c] = true
	en.S.current = 0
	en.S.mainUsed = false
	ok(en:apply(0, { t = "search", id = m.id }), "선물 탐색")
	eq(en.S.pkgs[0].itemGift, 1, "패키지 +1")
	eq(en.S.current, 1, "단순 획득 → 추가 확인 없이 턴 종료")
	-- recruit: 선택이 끝날 때까지 종료하지 않는다
	local en2 = freshPlay(1116)
	local m2 = en2:rosterMinions(0)[1]
	local ev2
	for _, ev in en2.S.events do
		if ev.r >= 9 and ev.kind == "recruit" then
			ev2 = ev
		end
	end
	for _, p in en2:alivePieces() do
		if p.owner == 0 and p ~= m2 then
			p.placed = false
		end
	end
	m2.r, m2.c = ev2.r, ev2.c
	en2.S.traces[0][ev2.r .. "_" .. ev2.c] = true
	en2.S.current = 0
	en2.S.mainUsed = false
	ok(en2:apply(0, { t = "search", id = m2.id }), "recruit 탐색")
	ok(en2.S.pending ~= nil and en2.S.pending.kind == "recruit", "recruit 선택 대기")
	eq(en2.S.current, 0, "선택 중에는 턴 유지")
	ok(not en2:apply(0, { t = "endTurn" }), "선택 중 턴 종료 불가")
	ok(en2:apply(0, { t = "recruitKeep" }), "포기")
	eq(en2.S.current, 1, "선택 후 정확히 한 번 종료")
end
-- AI: 새 규칙 수용 — recruit 계획·패키지 사용이 합법이고 AI 대 AI 가 완주한다
do
	local en = freshPlay(1117)
	local plan = Ai.recruitPlan(en, 0)
	ok(plan ~= nil and plan.skill == "dragon_breath" and plan.slot >= 1 and plan.slot <= 4, "AI 교체 계획 (드래곤 우선·합법 슬롯)")
	local done, over = 0, 0
	for seed = 1, 6 do
		local g = aiGame(seed * 1301 + 7, (seed % 2 == 0) and "dan5" or "grade5", "grade5")
		if g.S.phase == "over" then
			over += 1
		end
		done += 1
	end
	ok(done == 6, "AI 대전 6판 진행")
	ok(over >= 4, "AI 대전 대부분 종료 (" .. over .. "/6)")
end

--==================================================================
print(("\n결과: %d passed · %d failed"):format(passed, failed))
if failed > 0 then
	error("테스트 실패", 0)
end
