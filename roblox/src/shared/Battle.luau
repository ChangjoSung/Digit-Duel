--!nonstrict
-- Battle.luau — 전투 시스템 (demo/index.html ===== 전투 ===== 부 포팅)
-- Engine 에 메서드를 부착한다 (attach). 표시 계층(모달·FX·메시지 재생)은 제거 —
-- 전투 메시지는 bmsg 이벤트로 방출되고 규칙 전이는 동기 완결이다.
-- HTML의 vipChoice 모달 체인·볼/도망 버튼은 pending 상태 + 명시적 액션(vipPick / act·item·ball·flee)으로 재구성.

local Battle = {}

function Battle.attach(Engine, deps)
	local Config = deps.Config
	local Data = deps.Data
	local BAL = Config.BAL
	local round = Data.round

	local function isVip(x)
		return x.type == "ally" or x.type == "king"
	end

	local function fighterName(B, sid)
		local pf = (sid == "A") and B.fa or B.fd
		local piece = (sid == "A") and B.attP or B.defP
		if pf == piece then
			return (piece.type == "minion" and piece.name) and piece.name or Data.TYPE_KO[piece.type]
		end
		return "포획 하수인·" .. Data.ELEM_KO[pf.element]
	end

	function Engine:bmsg(text, big)
		local B = self.S.battle
		if B then
			table.insert(B.blog, text)
		end
		self:emit({ t = "bmsg", text = text, big = big or nil })
	end

	local function resetTemps(f)
		f.burn = 0
		f.burnBy = nil
		f.weaken = 0
		f.shield = 0
		f.absorbed = 0
		f.shock = 0
		f.shockFresh = false
		f.focusCharge = false
		f.vulnMark = false
		f.dmgCut = 0
		f.atkBuff = false
		f.powerBuff = false -- #121 계약 3.1: 버프는 전투 간 이어지지 않는다
		f.fleeFree = false
	end
	Engine.resetFighterTemps = resetTemps

	local function addRec(B, side, amount)
		if side == "A" then
			B.recA = math.min(B.fd.maxHp, B.recA + amount)
		elseif side == "D" then
			B.recD = math.min(B.fa.maxHp, B.recD + amount)
		end
	end

	--==============================================================
	-- 전투 개시
	--==============================================================

	function Engine:initBattle(att, def)
		local S = self.S
		local forced = #S.forcedTargets > 0 and table.find(S.forcedTargets, def.id) ~= nil
		if forced then
			S.forcedTargets = {}
			self:met(att.owner, "forcedBattles") -- T1 강제 이행
		end
		self:emit({ t = "contact", attId = att.id, defId = def.id, attOwner = att.owner })
		self:healBreak(att)
		self:healBreak(def)
		if att.type == "bomb" then -- #106 4.4.2 폭탄 직접 접촉 발동
			self:bombAttack(att, def)
			return
		end
		if def.type == "bomb" then
			S.battlesUsed += 1
			self:met(att.owner, "battles")
			def.alive = false
			if att.type == "minion" then
				att.alive = false
				self:met(def.owner, "bombHitsMinion")
				self:log("💥 폭탄 발동! 공격한 말과 폭탄이 모두 제거되었습니다.", "imp")
			else
				self:met(def.owner, "bombClearedByVip")
				self:log("💥 폭탄 발동! 폭탄만 제거되고 공격한 말은 생존했습니다. (정체 비공개 유지)", "imp")
			end
			if self:checkWipe() then
				return
			end
			self:afterBattle(att, false)
			return
		end
		if def.type == "trap" then
			S.battlesUsed += 1
			self:met(att.owner, "battles")
			self:met(def.owner, "trapTriggers")
			def.alive = false
			att.immobile = 2
			def.revealed = true
			att.revealed = true -- #106 T4: 함정과 걸린 말 모두 정체 공개
			self:log("🪤 함정 발동! " .. (att.name or Data.TYPE_KO[att.type]) .. " 정체 공개 · 2턴 이동 불가 (함정 제거)", "imp")
			self:afterBattle(att, false)
			return
		end
		if isVip(att) or isVip(def) then
			self:vipChoice(att, def)
			return
		end
		self:startRounds(att, def, att, def)
	end

	-- #106 4.4.2 폭탄 직접 접촉 발동 (상황 4·5·6)
	function Engine:bombAttack(bomb, def)
		local S = self.S
		S.battlesUsed += 1
		self:met(bomb.owner, "battles")
		self:met(bomb.owner, "bombContacts")
		if def.type == "minion" then
			bomb.alive = false
			def.alive = false
			self:met(bomb.owner, "bombHitsMinion")
			self:log("💥 폭탄 접촉 발동! 폭탄과 상대 하수인이 함께 제거되었습니다.", "imp")
			if self:checkWipe() then
				return
			end
		elseif isVip(def) then
			bomb.alive = false
			self:met(bomb.owner, "bombClearedByVip")
			self:log("💥 폭탄 접촉 발동! 상대 말이 폭탄을 제거했습니다 — 상대 말 생존 (정체 비공개 유지)", "imp")
			if self:checkWipe() then
				return
			end
		else -- #114 상황 6: 폭탄 → 폭탄/함정 — 제거·공개 없이 양측 한 칸씩 밀기
			self:log("💣 폭탄이 상대 폭탄·함정과 접촉 — 아무 일도 일어나지 않습니다. 말을 한칸씩 밀어냅니다. (양쪽 유지 · 정체 비공개)", "imp")
			self:pushResolve(bomb, def, { who = bomb.owner })
			if S.phase ~= "play" then
				return
			end
		end
		self:afterBattle(bomb, false)
	end

	--==============================================================
	-- 출전 선택 (HTML vipChoice 모달 체인 → pending "vip")
	--==============================================================

	function Engine:vipChoice(att, def)
		local S = self.S
		if isVip(att) and isVip(def) then -- #114 상황 8: 전투 없이 밀기
			self:log("🤜 동료·왕끼리 접촉 — 아무 일도 일어나지 않습니다. 말을 한칸씩 밀어냅니다. (양측 정체 비공개)", "imp")
			self:doPush(att, def)
			return
		end
		S.pending = { kind = "vip", attId = att.id, defId = def.id, choices = {}, stage = nil, owner = nil }
		self:advanceVip()
	end

	function Engine:advanceVip()
		local S = self.S
		local pd = S.pending
		local att, def = self:pieceById(pd.attId), self:pieceById(pd.defId)
		for _, stage in { "A", "D" } do
			if pd.choices[stage] == nil then
				local piece = (stage == "A") and att or def
				local res = (not piece.cap) and S.reserve[piece.owner] or nil
				if not isVip(piece) or (not piece.cap and not res) then
					pd.choices[stage] = "body"
				else
					pd.stage = stage
					pd.owner = piece.owner -- 이 비공개 선택의 주인 (방어자 포함)
					self:log("출전 선택 대기 — " .. Data.TYPE_KO[piece.type] .. " 본체 또는 포획 하수인", nil, piece.owner)
					return
				end
			end
		end
		self:resolveVip()
	end

	function Engine:applyVipPick(a)
		local S = self.S
		local pd = S.pending
		if a.t ~= "vipPick" then
			return false, "출전 선택 대기 중"
		end
		local use = a.use
		if use ~= "body" and use ~= "cap" then
			return false, "body 또는 cap 을 선택하세요"
		end
		local att, def = self:pieceById(pd.attId), self:pieceById(pd.defId)
		local piece = (pd.stage == "A") and att or def
		if use == "cap" and not piece.cap then
			local res = S.reserve[piece.owner]
			if not res then
				return false, "대리 출전할 하수인이 없습니다"
			end
			piece.cap = res -- 예비 하수인 소모 → 이 말의 cap
			S.reserve[piece.owner] = nil
		end
		pd.choices[pd.stage] = use
		pd.stage = nil
		pd.owner = nil
		self:advanceVip()
		self:autoStep()
		return true
	end

	function Engine:resolveVip()
		local S = self.S
		local pd = S.pending
		S.pending = nil
		local att, def = self:pieceById(pd.attId), self:pieceById(pd.defId)
		att.revealed = true
		def.revealed = true
		local fa = (pd.choices.A == "cap") and att.cap or att
		local fd = (pd.choices.D == "cap") and def.cap or def
		local aIsBody = isVip(att) and pd.choices.A ~= "cap"
		local dIsBody = isVip(def) and pd.choices.D ~= "cap"
		if aIsBody and dIsBody then -- Q2-b C안
			self:doPush(att, def)
			return
		end
		self:log("출전 공개 — 공격: " .. ((fa == att) and Data.TYPE_KO[att.type] or ("포획 하수인(" .. Data.ELEM_KO[fa.element] .. ")"))
			.. " vs 방어: " .. ((fd == def) and Data.TYPE_KO[def.type] or ("포획 하수인(" .. Data.ELEM_KO[fd.element] .. ")")), "imp")
		self:startRounds(att, def, fa, fd)
	end

	--==============================================================
	-- 라운드 진행
	--==============================================================

	function Engine:startRounds(attP, defP, fa, fd)
		local S = self.S
		S.battlesUsed += 1
		self:met(attP.owner, "battles")
		attP.revealed = true
		defP.revealed = true
		self:healBreak(attP)
		self:healBreak(defP)
		S.battle = {
			attP = attP, defP = defP, fa = fa, fd = fd, round = 1, phase = 0,
			recA = 0, recD = 0, itemsA = 0, itemsD = 0, itemRoundA = false, itemRoundD = false,
			lastItemA = nil, lastItemD = nil,
			ballThrowA = false, ballThrowD = false,
			blog = {},
			buffA = nil, buffD = nil, maxRounds = nil, -- #121 계약 3: 버프 회계(플레이어별 한 전투 1개)·시간의 수호자 라운드 상한 (전역 불변)
		}
		resetTemps(fa)
		resetTemps(fd)
		local B = S.battle
		for _, e in { { attP, fa, "A" }, { defP, fd, "D" } } do -- #12 일시버프: 개시 시 소진·전투 내내 유지
			local piece, f, sd = e[1], e[2], e[3]
			if piece.nextBattleBuff then
				piece.nextBattleBuff = false
				f.atkBuff = true
				self:bmsg("✨ " .. fighterName(B, sd) .. " 일시 버프 — 이번 전투 공격 +15%!")
			end
		end
		self:bmsg("⚔️ " .. fighterName(B, "A") .. " vs " .. fighterName(B, "D") .. " — 전투 개시!")
	end

	function Engine:actorOfPhase()
		local B = self.S.battle
		local firstIsAtt = B.round % 2 == 1
		if firstIsAtt and B.fa.shock > 0 then
			firstIsAtt = false
		end
		if not firstIsAtt and B.fd.shock > 0 then
			firstIsAtt = true
		end
		if B.phase == 0 then
			return firstIsAtt and "A" or "D"
		end
		return firstIsAtt and "D" or "A"
	end

	-- #121 계약 3.3: 이 전투의 최대 라운드 — 전투 인스턴스 값이 있으면 그것, 없으면 전역 BAL.maxRounds
	function Engine:battleMaxRounds()
		local B = self.S.battle
		return (B and B.maxRounds) or BAL.maxRounds
	end

	-- #121 계약 5.3 사신의 낫 사용 자격 — CD 와 분리된 봉인. 매 사용 시점 최신 상태로 검사. nil = 가능, 아니면 사유
	function Engine:reaperWhy(side)
		local B = self.S.battle
		if not B then
			return "전투 중에만 사용할 수 있습니다"
		end
		local f = (side == "A") and B.fa or B.fd
		local opp = (side == "A") and B.fd or B.fa
		local cap = self:battleMaxRounds()
		if cap < BAL.reaperRound then
			return ("이 전투는 %d라운드까지입니다 — 봉인 해제 불가"):format(cap)
		end
		if B.round < BAL.reaperRound then
			return ("%d라운드부터 (현재 %dR) — 봉인"):format(BAL.reaperRound, B.round)
		end
		local mine, theirs = f.hp / f.maxHp, opp.hp / opp.maxHp
		if not (mine < theirs) then
			return ("내 HP 비율 %d%% — 상대 %d%% 보다 낮아야 합니다"):format(round(mine * 100), round(theirs * 100))
		end
		return nil
	end

	-- 이 슬롯을 지금 실제로 쓸 수 있는가 — 쿨 + 기술 고유 게이트. 사람 UI·AI·기본 공격 폴백이 모두 이 함수를 본다
	function Engine:slotUsable(f, i, side)
		if not f.skills or f.cds[i] > 0 then
			return false
		end
		local sk = Data.SKILLS[f.skills[i]]
		if sk and sk.reaper then
			return self:reaperWhy(side) == nil
		end
		return true
	end

	-- #121 계약 5.2 🕯 마녀의 장난 — 4효과 중 서로 다른 2개를 100% 적용 (공유 rand 1회 · 재부여는 지속 갱신 · 풀 = 실HP 피해 100% 즉시 회복)
	function Engine:witchApply(side, oSide, f, opp, actual)
		local S = self.S
		local B = S.battle
		local combo = Data.WITCH_COMBOS[math.floor(self:rand() * #Data.WITCH_COMBOS) + 1]
		for _, idx in combo do
			local eff = Data.WITCH_EFFECTS[idx]
			if eff == "burn" then
				opp.burn = BAL.burnRounds
				opp.burnBy = side
				S.metrics.statusApplied += 1
				self:bmsg("🔥 " .. fighterName(B, oSide) .. "는 화상을 입었다! (" .. BAL.burnRounds .. "R)")
			elseif eff == "weaken" then
				opp.weaken = BAL.weakenHits
				S.metrics.statusApplied += 1
				self:bmsg("💧 " .. fighterName(B, oSide) .. "는 약화되었다! (" .. BAL.weakenHits .. "회)")
			elseif eff == "shock" then
				opp.shock = 1
				opp.shockFresh = true
				S.metrics.statusApplied += 1
				self:bmsg("⚡ " .. fighterName(B, oSide) .. "는 감전 — 다음 1라운드 후공!")
			else
				local gh = math.min(actual, f.maxHp - f.hp)
				if gh > 0 then
					f.hp += gh
					self:bmsg("🌿 어둠의 덩굴이 생명을 빨아들인다 — HP " .. gh .. " 회복!")
				else
					self:bmsg("🌿 어둠의 덩굴 — 빨아들일 생명이 없었다. (회복 0)")
				end
			end
		end
	end

	--==============================================================
	-- 4슬롯 실행 엔진 (GDD-16) — slot=nil 은 폴백 기본 공격
	--==============================================================

	function Engine:execSlot(side, slot)
		local S = self.S
		local B = S.battle
		if not B then
			return
		end
		local f = (side == "A") and B.fa or B.fd
		local opp = (side == "A") and B.fd or B.fa
		local oSide = (side == "A") and "D" or "A"
		local sk = (slot and f.skills) and Data.SKILLS[f.skills[slot]] or nil
		local atkEl = Data.atkElOf(f, sk) -- #92 판정 속성 · #121 cls 기술은 nil(중립)
		-- #121 계약 5.3 💀 사신의 낫 — 피해 파이프라인을 타지 않는 별도 분기. 게이트를 최신 상태로 다시 검사하고, 불가면 기본 공격 폴백
		if sk and sk.reaper then
			if f.cds[slot] > 0 then
				self:execSlot(side, nil)
				return
			end
			if self:actorOfPhase() ~= side then
				return
			end
			if self:reaperWhy(side) then
				self:execSlot(side, nil)
				return
			end
			if f.revealedSkills and not table.find(f.revealedSkills, slot) then
				table.insert(f.revealedSkills, slot)
			end
			self:bmsg("💀 " .. fighterName(B, side) .. "의 사신의 낫!")
			local lethal = opp.hp
			opp.shield = 0
			opp.hp = 0
			addRec(B, side, lethal)
			self:bmsg("💀 " .. fighterName(B, oSide) .. "는 보호막째 베였다 — 즉사!")
			if self:checkDeath() then
				return
			end
			self:nextPhase()
			return
		end
		if sk then
			f.cds[slot] = sk.cd
			if f.revealedSkills and not table.find(f.revealedSkills, slot) then
				table.insert(f.revealedSkills, slot) -- 기술 공개: 사용 시
			end
		end
		local function gate(force, prob)
			if force or self:rand() < (prob or BAL.statusProb) then
				S.metrics.statusApplied += 1
				return true
			end
			S.metrics.statusFailed += 1
			self:bmsg("상태이상 부여 실패!")
			return false
		end
		local function applyStatus(force)
			-- 상태 종류는 판정 속성 기준 (#92) — 이미 걸린 상태면 rand 미소비 (JS 단락 평가와 동일)
			if atkEl == "fire" then
				if opp.burn == 0 and gate(force) then
					opp.burn = BAL.burnRounds
					opp.burnBy = side
					self:bmsg("🔥 " .. fighterName(B, oSide) .. "는 화상을 입었다! (" .. BAL.burnRounds .. "R)")
				end
			elseif atkEl == "water" then
				if opp.weaken == 0 and gate(force) then
					opp.weaken = BAL.weakenHits
					self:bmsg("💧 " .. fighterName(B, oSide) .. "는 약화되었다! (" .. BAL.weakenHits .. "회)")
				end
			elseif atkEl == "lightning" then
				if opp.shock == 0 and gate(force, BAL.shockProb) then
					opp.shock = 1
					opp.shockFresh = true
					self:bmsg("⚡ " .. fighterName(B, oSide) .. "는 감전 — 다음 1라운드 후공!")
				end
			end
		end
		local function coolReduce(filter, label)
			local pick = nil
			for i = 1, 4 do
				if f.cds[i] > 0 and filter(i) and (not pick or f.cds[i] > f.cds[pick]) then
					pick = i
				end
			end
			if not pick then
				if label then
					self:bmsg(label .. " — 단축할 쿨이 없다.")
				end
				return
			end
			f.cds[pick] -= 1
			self:bmsg("🔄 " .. Data.SKILLS[f.skills[pick]].ko .. " 쿨 -1 (남은 쿨 " .. f.cds[pick] .. ")")
		end

		self:bmsg(fighterName(B, side) .. "의 " .. (sk and sk.ko or "기본 공격") .. "!")

		if sk and not sk.pow then -- 비피해 기술: 보조기·불굴 진형
			if sk.healPct then
				local h = round(f.maxHp * sk.healPct)
				f.hp = math.min(f.maxHp, f.hp + h)
				self:bmsg("💚 HP " .. h .. " 회복!")
			end
			if sk.shieldPct then
				f.shield += round(f.maxHp * sk.shieldPct) -- #130 계약 4: 남은 보호막 + 이번 부여량 (max 갱신 → 합산). 상한·기간 없음
				self:bmsg("🛡 보호막 " .. f.shield .. "!")
			end
			if sk.dmgCut then
				f.dmgCut = math.max(f.dmgCut, sk.dmgCut)
				self:bmsg("🌀 다음 피격 " .. round(sk.dmgCut * 100) .. "% 감소!")
			end
			if sk.focus then
				f.focusCharge = true
				self:bmsg("🎯 집중 — 다음 공격기 위력 +20%!")
			end
			if sk.coolAny then
				coolReduce(function(i)
					return i ~= slot
				end, "냉각")
			end
			if sk.cleanse then
				if f.burn > 0 then
					f.burn = 0
					f.burnBy = nil
					self:bmsg("✨ 화상이 정화되었다!")
				elseif f.weaken > 0 then
					f.weaken = 0
					self:bmsg("✨ 약화가 정화되었다!")
				elseif f.shock > 0 then
					f.shock = 0
					f.shockFresh = false
					self:bmsg("✨ 감전이 정화되었다!")
				else
					self:bmsg("정화 — 제거할 상태이상이 없다.")
				end
			end
		else -- 피해 기술: 공격기·시그니처·기본 공격
			local dmg = sk and Data.slotPow(f, sk) or f.atk
			if f.atkBuff then
				dmg = round(dmg * (1 + BAL.nextBuffPct)) -- #12 일시버프
			end
			if f.focusCharge and sk and sk.kind == "attack" then
				dmg = round(dmg * 1.2)
				f.focusCharge = false
				self:bmsg("🎯 집중 발동 — 위력 +20%!")
			end
			if BAL.dmgVar > 0 then -- D8 피해 분산 ±20% · #121 계약 3.2 힘의 수호자: 분산 단계만 상단 고정 (난수는 그대로 뽑아 버린다 — 소비 횟수 불변)
				local roll = self:rand()
				dmg = round(dmg * (f.powerBuff and (1 + BAL.dmgVar) or (1 - BAL.dmgVar + roll * 2 * BAL.dmgVar)))
			end
			if f.weaken > 0 then
				dmg = round(dmg * (1 - BAL.weakenPct))
				f.weaken -= 1
				if f.weaken == 0 then
					self:bmsg("💧 " .. fighterName(B, side) .. "의 약화가 풀렸다.")
				end
			end
			if atkEl and opp.element then -- #92 공격 상성 = 판정 속성 vs 상대 본체
				if Data.BEATS[atkEl] == opp.element then
					dmg = round(dmg * BAL.advMult)
				elseif Data.BEATS[opp.element] == atkEl then
					dmg = round(dmg * BAL.disMult)
				end
			end
			if sk and sk.dragonMult and opp.element then -- #121 계약 5.1 드래곤 숨결: 속성 있는 상대에게 항상 ×1.3 (무속성 중립)
				dmg = round(dmg * sk.dragonMult)
				self:bmsg("🐉 용의 숨결이 속성을 태운다 — ×" .. sk.dragonMult .. "!")
			end
			if sk and sk.bonusVsShield and opp.shield > 0 then
				dmg += sk.bonusVsShield
				self:bmsg("🌊 보호막 대상 추가 위력 +" .. sk.bonusVsShield .. "!")
			end
			if sk and sk.bonusVsStatus and (opp.burn > 0 or opp.weaken > 0 or opp.shock > 0) then
				dmg += sk.bonusVsStatus
				self:bmsg("⚡ 상태이상 대상 추가 위력 +" .. sk.bonusVsStatus .. "!")
			end
			if opp.dmgCut > 0 then
				dmg = round(dmg * (1 - opp.dmgCut))
				self:bmsg(fighterName(B, oSide) .. "는 자세를 낮춰 피해 " .. round(opp.dmgCut * 100) .. "% 감소!")
				opp.dmgCut = 0
			end
			if opp.vulnMark then
				dmg = round(dmg * 1.15)
				opp.vulnMark = false
				self:bmsg("⚠️ 결정타의 반동 — 피격 +15%!")
			end
			local absorbed = math.min(dmg, opp.shield)
			opp.shield -= absorbed
			local hpDmg = dmg - absorbed
			local actual = math.min(hpDmg, opp.hp)
			opp.hp -= actual
			local capLeft = math.max(0, round(opp.maxHp * BAL.absorbCapPct) - opp.absorbed)
			local freeAbsorb = math.min(absorbed, capLeft)
			opp.absorbed += freeAbsorb
			local counted = actual + (absorbed - freeAbsorb)
			addRec(B, side, counted)
			self:bmsg(dmg .. " 피해!" .. (absorbed > 0 and (" (흡수 " .. absorbed .. ")") or "") .. " · 유효 " .. counted)
			if sk then
				if sk.drainPct and actual > 0 then
					local gh = round(actual * sk.drainPct)
					f.hp = math.min(f.maxHp, f.hp + gh)
					self:bmsg("🌿 흡수 — HP " .. gh .. " 회복!")
				end
				if sk.selfShieldPct then
					f.shield += round(f.maxHp * sk.selfShieldPct) -- #130 계약 4: 공격 부가 보호막도 합산
					self:bmsg("🌿 보호막 " .. f.shield .. "!")
				end
				if sk.witch then -- #121 계약 5.2 — 피해 확정 뒤(실HP 피해 actual 기준) 2효과 100%
					self:witchApply(side, oSide, f, opp, actual)
				end
				if sk.status then
					applyStatus(false)
				end
				if sk.statusSelf then -- 잔류장: 자기 속성 상태효과 100% — 풀은 흡수 회복 임시 대체 [기획 필요]
					if f.element == "grass" then
						local gh = round(actual * 0.4)
						if gh > 0 then
							f.hp = math.min(f.maxHp, f.hp + gh)
							self:bmsg("🌿 잔류 흡수 — HP " .. gh .. " 회복!")
						end
					else
						applyStatus(true)
					end
				end
				if sk.selfVuln then
					f.vulnMark = true
					self:bmsg("⚠️ " .. fighterName(B, side) .. "의 자세가 무너졌다 — 다음 피격 +15%!")
				end
				if sk.coolAttack then -- 전술 연계
					coolReduce(function(i)
						return i ~= slot and Data.SKILLS[f.skills[i]].kind == "attack"
					end, nil)
				end
				if sk.coolAttackLongest then -- 급속 순환
					coolReduce(function(i)
						return Data.SKILLS[f.skills[i]].kind == "attack"
					end, nil)
				end
			end
		end
		if self:checkDeath() then
			return
		end
		self:nextPhase()
	end

	function Engine:nextPhase()
		local S = self.S
		local B = S.battle
		if B.phase == 0 then
			B.phase = 1
			return
		end
		for _, e in { { B.fa, "A" }, { B.fd, "D" } } do
			local f, side = e[1], e[2]
			if f.burn > 0 then
				local d = math.min(f.hp, round(f.maxHp * BAL.burnPct))
				f.hp -= d
				f.burn -= 1
				addRec(B, f.burnBy, d)
				self:bmsg("🔥 " .. fighterName(B, side) .. "는 화상 피해 " .. d .. "!")
				if f.burn == 0 then
					self:bmsg("🔥 " .. fighterName(B, side) .. "의 화상이 해제되었다.")
				end
				if self:checkDeath() then
					return
				end
			end
			if f.cd > 0 then
				f.cd -= 1
			end
			if f.skills then
				for i = 1, 4 do
					if f.cds[i] > 0 then
						f.cds[i] -= 1
					end
				end
			end
			if f.shockFresh then
				f.shockFresh = false -- 감전은 부여 라운드가 아닌 다음 라운드부터 소진
			elseif f.shock > 0 then
				f.shock -= 1
				if f.shock == 0 then
					self:bmsg("⚡ " .. fighterName(B, side) .. "의 감전이 풀렸다.")
				end
			end
		end
		B.itemRoundA = false
		B.itemRoundD = false
		B.ballThrowA = false
		B.ballThrowD = false
		B.round += 1
		if B.round > self:battleMaxRounds() then -- #121 계약 3.3: 시간의 수호자 전투는 3라운드 (전역 불변)
			self:judge()
			return
		end
		B.phase = 0
	end

	function Engine:checkDeath()
		local B = self.S.battle
		if B.fd.hp <= 0 then
			self:finishBattle("A", "즉사")
			return true
		end
		if B.fa.hp <= 0 then
			self:finishBattle("D", "즉사")
			return true
		end
		return false
	end

	-- #106 T6 (H1): 남은 HP 비율 판정, 동률은 방어자 승 (방어막 미포함)
	function Engine:judge()
		local S = self.S
		local B = S.battle
		S.metrics.judged += 1
		local ra, rd = B.fa.hp / B.fa.maxHp, B.fd.hp / B.fd.maxHp
		self:bmsg("⚖️ 남은 HP 비율로 판별합니다!", true)
		self:bmsg(fighterName(B, "A") .. " " .. round(ra * 100) .. "% vs " .. fighterName(B, "D") .. " " .. round(rd * 100) .. "%")
		if ra > rd then
			self:finishBattle("A", "판정 " .. round(ra * 100) .. "% vs " .. round(rd * 100) .. "%")
		elseif rd > ra then
			self:finishBattle("D", "판정 " .. round(rd * 100) .. "% vs " .. round(ra * 100) .. "%")
		else
			S.metrics.ties += 1
			self:finishBattle("D", "동률 " .. round(ra * 100) .. "% — 방어자 승")
		end
	end

	function Engine:finishBattle(winSide, how)
		local S = self.S
		local B = S.battle
		local winP = (winSide == "A") and B.attP or B.defP
		local loseP = (winSide == "A") and B.defP or B.attP
		local loseF = (winSide == "A") and B.fd or B.fa
		local loseSide = (winSide == "A") and "D" or "A"
		if winSide == "A" then
			S.metrics.attackerWins += 1
		else
			S.metrics.defenderWins += 1
		end
		self:bmsg(fighterName(B, loseSide) .. "는(은) 쓰러졌다!")
		self:bmsg(how .. " — P" .. (winP.owner + 1) .. " 승!")
		local msg
		if loseF == loseP then
			loseP.alive = false
			msg = Data.TYPE_KO[loseP.type] .. " 패배(" .. how .. ") — 제거"
		else
			loseP.cap = nil
			loseP.alive = false
			msg = "포획 하수인 패배(" .. how .. ") — " .. Data.TYPE_KO[loseP.type] .. " 동시 " .. (loseP.type == "king" and "패배" or "제거")
		end
		self:log("⚔️ 전투 종료: P" .. (winP.owner + 1) .. " 승 — " .. msg, "imp")
		resetTemps(B.fa)
		resetTemps(B.fd)
		local attacker = B.attP
		S.battle = nil
		if loseP.type == "king" then
			self:gameOver(winP.owner, "king")
			self:log("🏁 경기 종료 — P" .. (winP.owner + 1) .. " 승리!", "imp")
			return
		end
		if self:checkWipe() then
			return
		end
		self:afterBattle(attacker, winSide == "A" and attacker.alive)
	end

	-- #12 포획 종료: 적 하수인 즉시 제거 + 예비 저장
	function Engine:finishByCapture(side)
		local S = self.S
		local B = S.battle
		local winP = (side == "A") and B.attP or B.defP
		local loseP = (side == "A") and B.defP or B.attP
		local p = winP.owner
		local cb = BAL.captured
		local el = loseP.element
		if not el then
			local els = table.clone(Data.ELEMS)
			self:shuffle(els)
			el = els[1]
		end
		local arch = Data.archOf(loseP) or "std"
		local rd = Data.rosterById(loseP.rosterId) -- #91 외형 정체 보존 (표시 전용)
		S.reserve[p] = {
			element = el, hp = BAL.enemyCapHp, maxHp = cb.hp, atk = cb.atk, skillAtk = cb.skill, cd = 0, cdMax = cb.cd,
			-- #92 (GDD-13 4.8): 대상의 현재 장착 기술 4슬롯 복사 승계 (참조 비공유) · 레거시 폴백은 템플릿
			skills = loseP.skills and table.clone(loseP.skills) or Data.archSkills(arch, el),
			cds = { 0, 0, 0, 0 }, revealedSkills = {},
			artRosterId = rd and rd.id or nil,
		}
		self:met(p, "enemyCaptures")
		loseP.alive = false
		self:bmsg("🔴 몬스터볼 적중! 상대 하수인을 포획했다!")
		self:log("🔴 포획 종료: P" .. (p + 1) .. "가 적 하수인을 포획 — 전투 즉시 종료 (예비 하수인 HP " .. BAL.enemyCapHp .. "/" .. cb.hp .. ")", "imp")
		resetTemps(B.fa)
		resetTemps(B.fd)
		local attacker = B.attP
		S.battle = nil
		if self:checkWipe() then
			return
		end
		self:afterBattle(attacker, side == "A" and attacker.alive)
	end


	--==============================================================
	-- 전투 액션 (act / item / ball / flee)
	--==============================================================

	function Engine:applyBattleAction(side, a)
		local S = self.S
		local B = S.battle
		local f = (side == "A") and B.fa or B.fd
		local opp = (side == "A") and B.fd or B.fa
		local ownerP = (side == "A") and B.attP.owner or B.defP.owner
		local oppPiece = (side == "A") and B.defP or B.attP
		local myPiece = (side == "A") and B.attP or B.defP

		if a.t == "pass" then -- #146 계약 2.3: 4슬롯 전부 불가일 때의 수동 종료 = 전투 행동 1회 소모 (보드 턴·주 행동·전투 횟수·약화 불변)
			if not f.skills then
				return false, "이 전투원은 기본 공격을 쓸 수 있습니다"
			end
			for i = 1, 4 do
				if self:slotUsable(f, i, side) then
					return false, "사용 가능한 기술이 있습니다"
				end
			end
			self:bmsg("⏭️ " .. fighterName(B, side) .. " — 쓸 수 있는 기술이 없어 이번 행동을 넘겼다.")
			self:nextPhase()
			return true
		elseif a.t == "act" then
			local k = a.k
			if f.skills then
				local slot = nil
				if k == "basic" then
					-- #146 계약 2.1·2.4: 4슬롯 전투원에게는 기본 공격 폴백을 주지 않는다 (합법 슬롯이 있으면 그 슬롯을, 없으면 수동 패스)
					slot = self:slotUsable(f, 1, side) and 1 or nil
					if slot == nil then
						return false, "쓸 수 있는 기술이 없습니다 — [행동 넘기기] 로 이번 행동을 넘기세요"
					end
				elseif type(k) == "number" and k >= 1 and k <= 4 then
					if f.cds[k] > 0 then
						return false, "쿨타임 중인 기술입니다"
					end
					if not self:slotUsable(f, k, side) then -- #121 계약 5.3: 봉인된 사신은 거부 (사유 안내)
						return false, "💀 사신의 낫 봉인 — " .. tostring(self:reaperWhy(side))
					end
					slot = k
				else
					return false, "슬롯은 1~4 또는 basic"
				end
				self:execSlot(side, slot)
				return true
			end
			if k ~= "basic" then
				return false, "이 전투원은 기본 공격만 가능합니다"
			end
			self:execSlot(side, nil)
			return true
		elseif a.t == "item" then
			local usedItems = (side == "A") and B.itemsA or B.itemsD
			local itemRound = (side == "A") and B.itemRoundA or B.itemRoundD
			local lastItem = (side == "A") and B.lastItemA or B.lastItemD
			local i = a.i
			local k = (type(i) == "number") and S.inv[ownerP][i] or nil
			if not k then
				return false, "해당 아이템이 없습니다"
			end
			-- #121 계약 2.3: 플레이어별 라운드 1회만 남는다 (전투당 2회·연속 동일 금지는 제거 — usedItems·lastItem 은 기록만)
			if itemRound then
				return false, "이번 라운드에 이미 아이템을 사용했습니다"
			end
			table.remove(S.inv[ownerP], i)
			if side == "A" then
				B.itemsA += 1
				B.itemRoundA = true
				B.lastItemA = k
			else
				B.itemsD += 1
				B.itemRoundD = true
				B.lastItemD = k
			end
			if k == "potion" then
				local h = round(f.maxHp * BAL.itemHealPct)
				f.hp = math.min(f.maxHp, f.hp + h)
				self:bmsg("🧪 회복약! " .. fighterName(B, side) .. "의 HP " .. h .. " 회복.")
			elseif k == "cool" then
				f.cd = 0
				if f.skills then
					f.cds = { 0, 0, 0, 0 }
				end
				self:bmsg("🧪 쿨링수 — 스킬 쿨타임 초기화!")
			elseif k == "cure" then
				f.burn = 0
				f.weaken = 0
				f.shock = 0
				f.shockFresh = false
				self:bmsg("🧪 해독제 — 상태이상 해제!")
			end
			return true -- 보너스 행동 — 페이즈 미소모
		elseif a.t == "ball" then
			local thrown = (side == "A") and B.ballThrowA or B.ballThrowD
			if oppPiece.type ~= "minion" then
				return false, "상대가 하수인이 아닙니다"
			end
			if opp.hp >= opp.maxHp * 0.3 then
				return false, "상대 HP가 30% 미만이어야 합니다"
			end
			if S.balls[ownerP] <= 0 then
				return false, "몬스터볼이 없습니다"
			end
			if S.reserve[ownerP] then
				return false, "예비 슬롯이 차 있습니다"
			end
			if thrown then
				return false, "이번 라운드에 이미 던졌습니다"
			end
			S.balls[ownerP] -= 1
			if side == "A" then
				B.ballThrowA = true
			else
				B.ballThrowD = true
			end
			self:met(ownerP, "enemyCapTries")
			self:bmsg("🔴 P" .. (ownerP + 1) .. "의 몬스터볼 투척!")
			if self:rand() < BAL.enemyCapProb then
				self:finishByCapture(side)
				return true
			end
			self:met(ownerP, "enemyCapFails")
			self:bmsg("🔴 포획 실패! 볼이 튕겨나왔다. (남은 볼 " .. S.balls[ownerP] .. ")")
			self:nextPhase()
			return true
		elseif a.t == "gift" then -- #121 계약 2.2: 아이템 선물 패키지 개봉 (행동·아이템 카운터 미소모 · 확정 순간에만 재고 이동)
			local pk = S.pkgs[ownerP]
			if pk.itemGift <= 0 then
				return false, "아이템 선물 패키지가 없습니다"
			end
			local pick = a.pick
			if not table.find(Data.GIFT_PICKS, pick) then
				return false, "회복약·쿨링수·해독제·공용 볼 중에서 고르세요"
			end
			pk.itemGift -= 1
			if pick == "ball" then
				S.balls[ownerP] += 1
			else
				table.insert(S.inv[ownerP], pick)
			end
			self:bmsg("🎁 P" .. (ownerP + 1) .. "가 선물 상자를 열었다.") -- 종류는 소유자 전용 로그로만 (미사용 자원은 비공개)
			self:log("🎁 " .. Data.GIFT_KO[pick] .. " 획득", nil, ownerP)
			return true
		elseif a.t == "buff" then -- #121 계약 3: 전투 버프 패키지 — 플레이어별 한 전투 1개, 아이템 회계와 별도, 무료
			local pk = S.pkgs[ownerP]
			if pk.battleBuff <= 0 then
				return false, "전투 버프 패키지가 없습니다"
			end
			local key = a.kind
			if not table.find(Data.BUFF_KEYS, key) then
				return false, "힘·시간·도망 중에서 고르세요"
			end
			if (side == "A") and B.buffA or (side == "D") and B.buffD then
				return false, "이번 전투에 이미 버프를 적용했습니다 (전투당 1개)"
			end
			if key == "time" and B.round ~= 1 then
				return false, "시간의 수호자는 1라운드에만 사용할 수 있습니다"
			end
			pk.battleBuff -= 1
			if side == "A" then
				B.buffA = key
			else
				B.buffD = key
			end
			if key == "power" then
				f.powerBuff = true
			elseif key == "escape" then
				f.fleeFree = true
			else
				B.maxRounds = BAL.buffTimeRounds -- 전투 인스턴스 값만 (BAL.maxRounds 전역 불변)
			end
			self:bmsg(Data.BUFFS[key].ko .. " — " .. fighterName(B, side) .. "에게 적용!")
			if key == "time" then
				self:bmsg("🧭 이 전투는 " .. BAL.buffTimeRounds .. "라운드까지 — 사신의 낫은 발동할 수 없다.")
			end
			return true
		elseif a.t == "flee" then
			-- #146 계약 1.1: HP 50% 게이트 폐지 — 자기 전투 행동 차례면 언제나 시도 가능
			self:met(ownerP, "fleeTries")
			self:bmsg("🏃 " .. fighterName(B, side) .. "의 도망 시도!")
			local prob = f.fleeFree and BAL.fleeProbBuff or BAL.fleeProb -- #146 계약 1.4: 도망의 수호자 = 성공률 치환 70%
			if self:rand() < prob then
				self:met(ownerP, "fleeOks")
				self:bmsg("🏃 도망 성공! 전투가 종료되었다.")
				self:log("🏃 P" .. (ownerP + 1) .. " 도망 성공 — 전투 종료 (판정·제거 없음)", "imp")
				resetTemps(B.fa)
				resetTemps(B.fd)
				S.battle = nil
				self:fleeSwapPrompt(myPiece, oppPiece) -- #114 교환·밀기
				return true
			end
			-- #146 계약 1.2: 상대의 추가 반격 삭제 — 실패는 도망 측 전투 행동 1회 소모로만 끝나고 상대 정상 차례가 온다
			self:bmsg("🏃 도망 실패! 이번 행동을 소모했다.")
			self:nextPhase()
			return true
		end
		return false, "알 수 없는 전투 액션"
	end
end

return Battle
