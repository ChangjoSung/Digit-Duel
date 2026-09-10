--!nonstrict
-- Banner.luau — 서버가 보낸 로그 한 줄을 화면 중앙 배너로 바꿀지 판정한다 (표시 계층 전용).
-- HTML 데모의 fxPlay{kind="banner"} 가 띄우던 순간(접촉·폭탄·함정·밀기·재배치·텔레포트·탐색 결과·전투 개시/종료·도망·경기 종료)과 같은 집합이다.
-- 규칙 문구는 엔진이 만든 로그를 그대로 쓴다 — 여기서 새 문구를 지어내지 않는다. 규칙·난수와 무관하다.

local Banner = {}

-- pat: 로그 앞부분 패턴 (엔진 로그 문구 기준) · tone: 제목 색 (default|good|bad|warn) · fx: 배너 안에서 재생할 연출 키 (Art.fx)
Banner.RULES = {
	{ pat = "^💥", tone = "bad", fx = "explosion" }, -- 폭탄 발동
	{ pat = "^🪤", tone = "bad", fx = "trap" }, -- 함정 발동
	{ pat = "^⚔️ 신규 인접", tone = "warn" }, -- 강제 전투
	{ pat = "^💣 신규 인접", tone = "warn" }, -- 폭탄 접촉
	{ pat = "^⚔️ 강제 전투 —", tone = "warn" },
	{ pat = "^⚔️ 텔레포트 스왑 —", tone = "warn" },
	{ pat = "^⚔️ 전투 종료", tone = "default" },
	{ pat = "^🤜", tone = "default" }, -- 밀어내기
	{ pat = "^🔄", tone = "default" }, -- 재배치
	{ pat = "^🌀 텔레포트 스왑 완료", tone = "default" },
	{ pat = "^🏃", tone = "warn", fx = "flee" }, -- 도망
	{ pat = "^📦", tone = "good" }, -- 패키지 획득 (탐색)
	{ pat = "^🎁", tone = "good" }, -- 선물 개봉
	{ pat = "^📘", tone = "good" }, -- 기술 습득
	{ pat = "^🔴 포획", tone = "good", fx = "capture" }, -- 포획 결과
	{ pat = "^🔍", tone = "good" }, -- 흔적 발견 (도착한 그 순간 — 실제 탐색은 다음 턴)
	{ pat = "^🌿 숲에서", tone = "good" }, -- 탐색 발견
	{ pat = "^🔥 버닝 타임", tone = "warn" },
	{ pat = "^🏁", tone = "good" }, -- 경기 종료
	{ pat = "^🏳️", tone = "bad" }, -- 기권
	{ pat = "^🔌", tone = "bad" }, -- 연결 끊김
}

-- text → { title, sub, tone } 또는 nil(배너 대상 아님)
function Banner.fromLog(text: string?)
	if type(text) ~= "string" then
		return nil
	end
	for _, r in Banner.RULES do
		if string.find(text, r.pat) then
			-- 제목/설명은 " — " 를 **평문**으로 찾아 나눈다. Lua 문자 클래스는 바이트 단위라 [—] 가 이모지(⚔️ 등)의 바이트를 잘라 버린다
			local i = string.find(text, " — ", 1, true)
			if i then
				return { title = string.sub(text, 1, i - 1), sub = string.sub(text, i + 5), tone = r.tone, fx = r.fx }
			end
			return { title = text, sub = nil, tone = r.tone, fx = r.fx }
		end
	end
	return nil
end

-- 전투 창 메시지(bmsg) 한 줄 → 연출 키. 엔진이 만든 문구를 **평문**으로 찾는다 (Lua 문자 클래스는 바이트 단위라 이모지를 자른다).
-- 위에서부터 먼저 맞는 것을 쓰므로 순서가 규칙이다 — 해제·실패 문구가 부여 문구로 잘못 잡히지 않도록 골랐다.
Banner.FX_RULES = {
	{ has = "사신의 낫", fx = "reaper" }, -- 기술 사용 줄 + 💀 즉사 줄
	{ has = "즉사!", fx = "reaper" },
	{ has = "드래곤 숨결", fx = "dragon" },
	{ has = "용의 숨결", fx = "dragon" },
	{ has = "마녀의 장난", fx = "witch" },
	{ has = "몬스터볼 적중", fx = "capture" }, -- 포획 성공만 (실패는 "볼이 튕겨나왔다")
	{ has = "도망 성공", fx = "flee" }, -- 시도·실패는 제외
	{ has = "화상을 입었다", fx = "burn" }, -- "화상이 해제되었다" 는 안 잡힌다
	{ has = "화상 피해", fx = "burn" },
	{ has = "약화되었다", fx = "weaken" }, -- "약화가 풀렸다"·"약화가 정화되었다" 제외
	{ has = "감전 — 다음 1라운드 후공", fx = "shock" }, -- "감전이 풀렸다" 제외
	{ has = "보호막 ", fx = "shield" }, -- "보호막째 베였다" 는 뒤에 공백이 없어 안 잡힌다
	{ has = "회복!", fx = "heal" }, -- 💚 · 🌿 흡수 · 🌿 잔류 흡수 · 어둠의 덩굴
	{ has = "회복.", fx = "heal" }, -- 🧪 회복약
	{ has = "피해!", fx = "hit" }, -- "N 피해! · 유효 N" — 화상 피해 줄은 위에서 이미 잡혔다
}

-- text → 연출 키 또는 nil (연출 없음). 규칙·난수와 무관한 표시 계층 판정이다.
function Banner.fxFromBattle(text: string?)
	if type(text) ~= "string" then
		return nil
	end
	for _, r in Banner.FX_RULES do
		if string.find(text, r.has, 1, true) then
			return r.fx
		end
	end
	return nil
end

return Banner
