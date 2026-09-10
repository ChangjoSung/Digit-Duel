--!nonstrict
-- Banner.luau — 서버가 보낸 로그 한 줄을 화면 중앙 배너로 바꿀지 판정한다 (표시 계층 전용).
-- HTML 데모의 fxPlay{kind="banner"} 가 띄우던 순간(접촉·폭탄·함정·밀기·재배치·텔레포트·탐색 결과·전투 개시/종료·도망·경기 종료)과 같은 집합이다.
-- 규칙 문구는 엔진이 만든 로그를 그대로 쓴다 — 여기서 새 문구를 지어내지 않는다. 규칙·난수와 무관하다.

local Banner = {}

-- pat: 로그 앞부분 패턴 (엔진 로그 문구 기준) · tone: 제목 색 (default|good|bad|warn)
Banner.RULES = {
	{ pat = "^💥", tone = "bad" }, -- 폭탄 발동
	{ pat = "^🪤", tone = "bad" }, -- 함정 발동
	{ pat = "^⚔️ 신규 인접", tone = "warn" }, -- 강제 전투
	{ pat = "^💣 신규 인접", tone = "warn" }, -- 폭탄 접촉
	{ pat = "^⚔️ 강제 전투 —", tone = "warn" },
	{ pat = "^⚔️ 텔레포트 스왑 —", tone = "warn" },
	{ pat = "^⚔️ 전투 종료", tone = "default" },
	{ pat = "^🤜", tone = "default" }, -- 밀어내기
	{ pat = "^🔄", tone = "default" }, -- 재배치
	{ pat = "^🌀 텔레포트 스왑 완료", tone = "default" },
	{ pat = "^🏃", tone = "warn" }, -- 도망
	{ pat = "^📦", tone = "good" }, -- 패키지 획득 (탐색)
	{ pat = "^🎁", tone = "good" }, -- 선물 개봉
	{ pat = "^📘", tone = "good" }, -- 기술 습득
	{ pat = "^🔴 포획", tone = "good" }, -- 포획 결과
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
				return { title = string.sub(text, 1, i - 1), sub = string.sub(text, i + 5), tone = r.tone }
			end
			return { title = text, sub = nil, tone = r.tone }
		end
	end
	return nil
end

return Banner
