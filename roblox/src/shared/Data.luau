--!strict
-- Data.luau — 게임 데이터 테이블 (demo/index.html v0.4.5 포팅)
-- SKILLS·ROSTER·아키타입 템플릿은 GDD-16 v1.0 / GDD-13 4.2 그대로. 수치 임의 변경 금지.
-- 주의: JS 원본의 슬롯 인덱스 0~3 은 Luau에서 1~4 로 옮겼다 (액션 프로토콜도 1~4).

local Data = {}

Data.ELEMS = { "fire", "water", "grass", "lightning" }
Data.ELEM_KO = { fire = "불", water = "물", grass = "풀", lightning = "번개" }
Data.ELEM_EMO = { fire = "🔥", water = "💧", grass = "🌿", lightning = "⚡" }
-- D1: 불→풀→번개→물→불
Data.BEATS = { fire = "grass", grass = "lightning", lightning = "water", water = "fire" }
Data.TYPE_KO = { minion = "하수인", bomb = "폭탄", ally = "동료", trap = "함정", king = "왕", captured = "포획" }
Data.WINTYPE_KO = { king = "왕 제거", edge = "끝줄 승리", resign = "기권", draw = "무승부", wipe = "전멸" }
Data.SKILL_KO = { fire = "화염탄", water = "물대포", grass = "넝쿨 흡수", lightning = "낙뢰" }
Data.ARCH_KO = { std = "표준", atk = "공격", def = "방어", swift = "속공", sustain = "지속" }
Data.SKIND_KO = { attack = "공격기", support = "보조기", sig = "시그니처" }
Data.SKILL_TIER_KO = { stable = "안정", effect = "효과", heavy = "고위력" }

Data.SKILL_ATK_BASE = 22 -- 최종 위력 = 기술 위력 × (종 atk / 22), 사사오입

export type Skill = {
	ko: string,
	kind: string, -- "attack" | "support" | "sig"
	el: string?, -- 공격기만: 기술 속성 (#92 — 공격 상성·상태 종류는 기술 속성)
	tier: string?,
	cd: number,
	pow: number?,
	status: boolean?,
	drainPct: number?,
	selfShieldPct: number?,
	bonusVsShield: number?,
	bonusVsStatus: number?,
	healPct: number?,
	shieldPct: number?,
	focus: boolean?,
	coolAny: boolean?,
	cleanse: boolean?,
	dmgCut: number?,
	coolAttack: boolean?,
	selfVuln: number?,
	coolAttackLongest: boolean?,
	statusSelf: boolean?,
	cls: string?, -- #121: 기술 전용 분류 (dragon|dark|blood) — 본체 속성·상성표와 무관
	dragonMult: number?,
	witch: boolean?,
	reaper: boolean?,
	desc: string,
}

-- 기술 4슬롯 체계 (GDD-16 v1.0 3장) — 속성 공격기 12종 + 공용 보조기 6종 + 시그니처 5종
Data.SKILLS = {
	fire_stable = { ko = "화염탄", kind = "attack", el = "fire", tier = "stable", cd = 0, pow = 26, desc = "안정 공격기" },
	fire_effect = { ko = "잔불 표식", kind = "attack", el = "fire", tier = "effect", cd = 2, pow = 22, status = true, desc = "70% 확률 화상 2R" },
	fire_heavy = { ko = "폭염 강타", kind = "attack", el = "fire", tier = "heavy", cd = 3, pow = 38, desc = "고위력 공격기" },
	water_stable = { ko = "물대포", kind = "attack", el = "water", tier = "stable", cd = 0, pow = 26, desc = "안정 공격기" },
	water_effect = { ko = "침식 수류", kind = "attack", el = "water", tier = "effect", cd = 2, pow = 22, status = true, desc = "70% 확률 약화 2회" },
	water_heavy = { ko = "쇄도 파도", kind = "attack", el = "water", tier = "heavy", cd = 3, pow = 32, bonusVsShield = 6, desc = "대상 보호막 보유 시 +6" },
	grass_stable = { ko = "덩굴 채찍", kind = "attack", el = "grass", tier = "stable", cd = 0, pow = 26, desc = "안정 공격기" },
	grass_effect = { ko = "흡수 새싹", kind = "attack", el = "grass", tier = "effect", cd = 2, pow = 20, drainPct = 0.4, desc = "실HP 피해의 40% 회복" },
	grass_heavy = { ko = "가시 폭발", kind = "attack", el = "grass", tier = "heavy", cd = 3, pow = 34, selfShieldPct = 0.10, desc = "자기 최대 HP 10% 보호막" },
	lightning_stable = { ko = "전기탄", kind = "attack", el = "lightning", tier = "stable", cd = 0, pow = 26, desc = "안정 공격기" },
	lightning_effect = { ko = "감전 침", kind = "attack", el = "lightning", tier = "effect", cd = 2, pow = 22, status = true, desc = "50% 확률 감전(후공 1회)" },
	lightning_heavy = { ko = "연쇄 번개", kind = "attack", el = "lightning", tier = "heavy", cd = 3, pow = 34, bonusVsStatus = 6, desc = "대상 상태이상 시 +6" },
	-- 공용 보조기 6종
	sup_heal = { ko = "응급 치유", kind = "support", cd = 3, healPct = 0.20, desc = "자기 HP 20% 회복" },
	sup_guard = { ko = "수호 자세", kind = "support", cd = 3, shieldPct = 0.18, desc = "최대 HP 18% 보호막" },
	sup_focus = { ko = "집중", kind = "support", cd = 3, focus = true, desc = "다음 공격기 위력 +20% (1회)" },
	sup_cool = { ko = "냉각", kind = "support", cd = 4, coolAny = true, desc = "남은 쿨 최장 기술 1개 쿨 -1 (자기 제외)" },
	sup_cleanse = { ko = "정화", kind = "support", cd = 3, cleanse = true, desc = "자기 상태이상 1개 제거" },
	sup_evade = { ko = "회피 자세", kind = "support", cd = 3, dmgCut = 0.25, desc = "다음 피격 25% 감소" },
	-- 시그니처 5종 (아키타입별)
	sig_std = { ko = "전술 연계", kind = "sig", cd = 3, pow = 30, coolAttack = true, desc = "다른 속성 공격기 1개 쿨 -1" },
	sig_atk = { ko = "결정타", kind = "sig", cd = 4, pow = 40, selfVuln = 0.15, desc = "사용 후 다음 피격 피해 +15%" },
	sig_def = { ko = "불굴 진형", kind = "sig", cd = 4, shieldPct = 0.22, dmgCut = 0.15, desc = "22% 보호막 + 다음 피격 15% 감소" },
	sig_swift = { ko = "급속 순환", kind = "sig", cd = 2, pow = 22, coolAttackLongest = true, desc = "남은 쿨 최장 공격기 쿨 -1" },
	sig_sustain = { ko = "잔류장", kind = "sig", cd = 3, pow = 18, statusSelf = true, desc = "자기 속성 상태효과 부여 (100%)" },
	-- #121 계약 5 — 신규 공용 기술 3종. cls 는 기술 전용 분류다(본체 속성·다섯 번째 상성 아님). cls 기술은 atkElOf 가 nil 을 돌려줘 상성 블록을 타지 않는다
	dragon_breath = { ko = "드래곤 숨결", kind = "attack", cls = "dragon", cd = 3, pow = 30, dragonMult = 1.3, desc = "용 분류 · 속성이 있는 상대에게 항상 ×1.3 (무속성 왕·동료 본체에는 중립 1.0)" },
	witch_prank = { ko = "마녀의 장난", kind = "attack", cls = "dark", cd = 3, pow = 18, witch = true, desc = "어둠 분류 · 중립 1.0 · 화상·약화·감전·풀 회복 중 서로 다른 2효과를 100% 적용" },
	reaper_scythe = { ko = "사신의 낫", kind = "attack", cls = "blood", cd = 0, reaper = true, desc = "핏빛 분류 · 6라운드 · 내 HP 비율이 상대보다 낮을 때만 — 보호막을 무시하고 즉사" },
} :: { [string]: Skill }

-- #121 (v0.4.7) 상수 — 순서 고정 (표시·AI·프로토콜 공용)
Data.SKILL_CLS_KO = { dragon = "용", dark = "어둠", blood = "핏빛" }
Data.SKILL_CLS_EMO = { dragon = "🐉", dark = "🕯", blood = "💀" }
Data.NEW_SKILLS = { "dragon_breath", "witch_prank", "reaper_scythe" } -- 계약 4.2 제안 목록 (제안 표시에 난수 0)
Data.GIFT_PICKS = { "potion", "cool", "cure", "ball" } -- 계약 2.2 아이템 선물 패키지 4종
Data.GIFT_KO = { potion = "회복약", cool = "쿨링수", cure = "해독제", ball = "공용 몬스터볼" }
Data.BUFFS = { -- 계약 3.2~3.4 전투 버프 3종
	power = { ko = "💪 힘의 수호자", desc = "이 전투 동안 내 피해 분산을 최대치로 고정 (상성·약화·보호막 계산은 그대로)" },
	time = { ko = "🧭 시간의 수호자", desc = "이 전투만 양측 최대 3라운드 — 1라운드에만 사용 가능 · 사신의 낫은 발동 불가" },
	escape = { ko = "🏃 도망의 수호자", desc = "이 전투 동안 도망 HP 50% 조건 해제 (성공률·반격·교환은 그대로)" },
}
Data.BUFF_KEYS = { "power", "time", "escape" }
Data.EVENT_KINDS = { "itemGift", "battleBuff", "recruit" } -- 계약 1.1: 구역마다 각 1개
Data.EVENT_KO = { itemGift = "아이템 선물 패키지", battleBuff = "전투 버프 패키지", recruit = "기술 교체 / 하수인 포획" }
Data.CAP_MODES = { "safe", "risky", "attack" }
Data.WITCH_EFFECTS = { "burn", "weaken", "shock", "grassHeal" } -- 계약 5.2 순서 고정
Data.WITCH_COMBOS = { { 1, 2 }, { 1, 3 }, { 1, 4 }, { 2, 3 }, { 2, 4 }, { 3, 4 } } -- 4C2 균등 6조합

-- 종별 장착 템플릿 (GDD-16 4장) — 공격기는 자기 속성 풀, 슬롯3=보조기·슬롯4=시그니처 고정 (Luau 1-기준)
Data.ARCH_TMPL = {
	std = { "stable", "effect", "sup_heal", "sig_std" },
	atk = { "stable", "heavy", "sup_focus", "sig_atk" },
	def = { "effect", "heavy", "sup_guard", "sig_def" },
	swift = { "stable", "effect", "sup_cool", "sig_swift" },
	sustain = { "effect", "heavy", "sup_cleanse", "sig_sustain" },
} :: { [string]: { string } }

function Data.archSkills(arch: string, el: string): { string }
	local out = {}
	for _, t in Data.ARCH_TMPL[arch] do
		if t == "stable" or t == "effect" or t == "heavy" then
			table.insert(out, el .. "_" .. t)
		else
			table.insert(out, t)
		end
	end
	return out
end

local function round(x: number): number
	return math.floor(x + 0.5)
end
Data.round = round

-- 위력 스케일 (사사오입) — f: atk 필드를 가진 전투원
function Data.slotPow(f: { atk: number }, sk: Skill): number
	return round((sk.pow or 0) * f.atk / Data.SKILL_ATK_BASE)
end

-- #92 판정 속성 — 공격기(el 보유)는 기술 속성, 기본 공격·시그니처·보조기는 본체 속성
function Data.atkElOf(f: { element: string? }, sk: Skill?): string?
	if sk and sk.cls then -- #121 계약 5: cls 기술(용·어둠·핏빛)은 속성 판정에서 빠진다 → 중립
		return nil
	end
	return (sk and sk.kind == "attack" and sk.el) and sk.el or f.element
end

Data.ITEMS = {
	potion = { ko = "회복약", desc = "HP 20% 회복" },
	cool = { ko = "쿨링수", desc = "스킬 쿨타임 초기화" },
	cure = { ko = "해독제", desc = "상태이상 해제" },
}
Data.ITEM_KEYS = { "potion", "cool", "cure" } -- 순회 순서 고정 (JS Object.keys(ITEMS) 등가)

-- #12 숲 이벤트 풀 6종 완전 랜덤
Data.EVENT_POOL = { "potion", "cool", "cure", "ball", "buff", "recruit" }

export type RosterDef = {
	id: string,
	name: string,
	element: string,
	arch: string,
	hp: number,
	atk: number,
	skill: number,
	cd: number,
}

-- 하수인 로스터 20종 — 아키타입 5종 × 속성 4종 (GDD-13 4.2, T5-B)
Data.ROSTER = {
	{ id = "M-F1", name = "새끼 화룡", element = "fire", arch = "std", hp = 100, atk = 22, skill = 35, cd = 2 },
	{ id = "M-F2", name = "화염 투사", element = "fire", arch = "atk", hp = 90, atk = 25, skill = 40, cd = 3 },
	{ id = "M-F3", name = "용암 거북", element = "fire", arch = "def", hp = 120, atk = 18, skill = 30, cd = 2 },
	{ id = "M-W1", name = "물방울 요정", element = "water", arch = "std", hp = 100, atk = 22, skill = 35, cd = 2 },
	{ id = "M-W2", name = "심해 사냥꾼", element = "water", arch = "atk", hp = 90, atk = 25, skill = 40, cd = 3 },
	{ id = "M-W3", name = "산호 수호자", element = "water", arch = "def", hp = 120, atk = 18, skill = 30, cd = 2 },
	{ id = "M-G1", name = "새싹 파수꾼", element = "grass", arch = "std", hp = 100, atk = 22, skill = 35, cd = 2 },
	{ id = "M-G2", name = "가시 덩굴", element = "grass", arch = "atk", hp = 90, atk = 25, skill = 40, cd = 3 },
	{ id = "M-G3", name = "고목 수호자", element = "grass", arch = "def", hp = 120, atk = 18, skill = 30, cd = 2 },
	{ id = "M-L1", name = "스파크", element = "lightning", arch = "std", hp = 100, atk = 22, skill = 35, cd = 2 },
	{ id = "M-L2", name = "뇌격수", element = "lightning", arch = "atk", hp = 90, atk = 25, skill = 40, cd = 3 },
	{ id = "M-L3", name = "피뢰 골렘", element = "lightning", arch = "def", hp = 120, atk = 18, skill = 30, cd = 2 },
	{ id = "M-F4", name = "불티 정령", element = "fire", arch = "swift", hp = 85, atk = 24, skill = 30, cd = 1 },
	{ id = "M-W4", name = "안개 무희", element = "water", arch = "swift", hp = 85, atk = 24, skill = 30, cd = 1 },
	{ id = "M-G4", name = "포자 요정", element = "grass", arch = "swift", hp = 85, atk = 24, skill = 30, cd = 1 },
	{ id = "M-L4", name = "번개 여우", element = "lightning", arch = "swift", hp = 85, atk = 24, skill = 30, cd = 1 },
	{ id = "M-F5", name = "재의 주술사", element = "fire", arch = "sustain", hp = 95, atk = 20, skill = 28, cd = 2 },
	{ id = "M-W5", name = "파도 술사", element = "water", arch = "sustain", hp = 95, atk = 20, skill = 28, cd = 2 },
	{ id = "M-G5", name = "숲의 현자", element = "grass", arch = "sustain", hp = 95, atk = 20, skill = 28, cd = 2 },
	{ id = "M-L5", name = "전자기 술사", element = "lightning", arch = "sustain", hp = 95, atk = 20, skill = 28, cd = 2 },
} :: { RosterDef }

function Data.rosterById(id: string?): RosterDef?
	if not id then
		return nil
	end
	for _, r in Data.ROSTER do
		if r.id == id then
			return r
		end
	end
	return nil
end

-- 아키타입 (rosterId 기반) — 없으면 nil
function Data.archOf(f: { rosterId: string? }): string?
	local rd = Data.rosterById(f.rosterId)
	return rd and rd.arch or nil
end

-- T5-B 아키타입별 스킬 파라미터 (레거시 속성 스킬 경로용 — 지속형 강화)
function Data.skillParamsOf(f: { rosterId: string?, element: string? }, BAL: any)
	local a = Data.archOf(f)
	return {
		burnRounds = a == "sustain" and 3 or BAL.burnRounds,
		weakenHits = a == "sustain" and 3 or BAL.weakenHits,
		shockRounds = a == "sustain" and 2 or 1,
	}
end

-- #92 탐색 보상 — 속성 교차 공격기 후보 (순서 고정 → 공유 rand 1회로 결정)
function Data.recruitCandidates(p: { element: string?, skills: { string }? }): { string }
	local have = {}
	for _, s in (p.skills or {}) do
		have[s] = true
	end
	local out = {}
	for _, el in Data.ELEMS do
		if el ~= p.element then
			for _, tier in { "stable", "effect", "heavy" } do
				local id = el .. "_" .. tier
				if not have[id] then
					table.insert(out, id)
				end
			end
		end
	end
	return out
end

return Data
