# #316 Jupiter 서버 계약 보고 — 2026-10-03

## CJ 추가 — B08 가방 3/3 포획 교환 30초 (2026-10-03)

판정: **완료(미커밋)**. 실제 실행: Claude `claude-opus-5-5` · high · bypass · Ponytail full. Git·클라이언트·공유 Core/data 쓰기 0. 독립 QA PASS 주장 없음.
- 확정: 서버 B08 시한은 `_wantSeatClock` → `this._ms('bagPick', T.ECO.bagPickSec)`(공유 data.js)뿐이고 서버 20 상수는 없다 → **Mars의 data.js `bagPickSec:30` 하나로 온라인 권위 시한이 30초**. 서버 코드 로직 무변경(room.js는 주석 "B08 20초→30초" 4곳만).
- 무변경: 주입 `bagPickMs`, 소유자 전용 `key:'bag'` 시계, 상대 `bagPick:{owner}`만·B08 시계 비노출, 만료 시 포획 말만 방출, 토큰·지난 토큰 거부, 환급, 단절 정지, 종료 우선, boardClock. 서버 resign 동사 무변경(버튼 제거는 Mars).
- 테스트: `test-issue237-economy.js` 8절 라벨 20초→B08 표기, 새 블록(주입 없는 방) — `ECO.bagPickSec===30`·소유자 `_wantSeatClock.ms===30000`·상대 null, 소유자 시계 흐름 29~30초, 상대 `{owner}`만·bag 시계 없음.
- 검사: `node authoritative/test/test-issue237-economy.js` 1차 `ws` 모듈 미발견으로 테스트 0개 실행 전 종료(환경) → `NODE_PATH`=원본 checkout `server/node_modules`로 1회 재실행 **206/0 exit0**(종전 203 + 3). 앞 stats 검사 730/0은 이 변경과 무관해 재실행 안 함.
- 한계: 단절 정지·재연결·만료 방출은 기존 주입 단기 시계 검사가 그대로 덮는다(30초 실시간 대기 검사는 하지 않음). 클라이언트 표시·오프라인 카운트다운은 Mars.
- 인계: `C:/Users/pc_77/orca/artifacts/Digit-Duel/issue-316-cj-revise-20261003/jupiter-b08-30s-contract.md`.

---

## CJ REVISE — 전투 실제 적용 스탯(effectiveStats) DTO

판정: **완료(미커밋)**. 실제 실행: Claude `claude-opus-5-5` · high · bypass(full) · Ponytail full. Git 쓰기·클라이언트/Core/Notion/GitHub 쓰기 0. 독립 QA PASS 주장 없음.

**변경 파일**
- `server/authoritative/room.js` `_serializeBattle` side(): `effectiveStats:{atk,def,spd,dodge,crit,statusPct}` 추가 — 양 좌석·양 전투원(대리 출전 포함 실제 전투원 f). 기존 기본 6칸(#296)·grade·synAtk(소유자 전용)·skills 무변경.
- `server/authoritative/test/test-combat-stats-boundary.js` 3b 블록에 #316 회귀 1개.
- 인계 문서: `C:/Users/pc_77/orca/artifacts/Digit-Duel/issue-316-cj-revise-20261003/jupiter-effective-stats-dto.md`(PD 통지 msg_e1e7a8ad03ea).

**계약(확정 — 서버 Core 판정식 그대로, 반올림 없음, 단위는 기본값과 같음)**
| 칸 | 식 | 성격 |
|---|---|---|
| atk | `effAtk` = atk×(1+synAtk) (리퍼 패시브 포함) | **백분율 배수** · 소수 가능 → 화면 반올림 |
| def | def+synDef | **가산 점수**. 피해 감소 상한 50%(def%+경화+dmgCut 합)는 타격 시점이라 미적용 |
| spd | `effSpd` = spd+spdBuff(일시)+synSpd | 가산 |
| dodge | `effEvade` = clamp(dodge+synDodge+evadeBuff−evadeDown(활성 시), 0, 0.40) | 일시 증감·상한 포함 |
| crit | min(0.5, crit+synCrit) | 엔진 critP · critForce(1회 확정)는 제외 |
| statusPct | statusPct+synStatusPct(마녀 패시브 포함) | **가산 %p 보정치 — 최종 확률 아님**. 기술별 min(1, 표기+이 값), 모래 폭풍 ×0.5 |
- 시너지는 참전 확정(applySynergy) 전 0, 이후 전투 동안 고정. 기본값이 없거나 비유한이면 그 칸 null(대체값 없음).
- 제외(별도 효과): atkBuff·dmgUpBuff(가하는 피해 %), weaken, harden·dmgCut, crack·vulnMark.
- 원본 synDef/Spd/Dodge/Crit/StatusPct·synEl·evadeBuff·spdBuff 키와 출처·로스터·기술은 싣지 않는다. 한계(추론): 기본값과 합계를 함께 보이므로 상대도 뺄셈으로 증가분을 알 수 있다 — CJ가 승인한 "파생 합계 공개"의 필연적 결과.
- 포자 요정 재현: spd14·회피10%·💫0 + 속공(2)+지속(2) → 15 · 13% · +5%p.

**Mars 소비 지침**: `network.js` netSynthFighter가 `sd.effectiveStats`를 숫자 검증 후 전달(아니면 null), `ui.js` battleStatHtml은 이 값을 표시(atk 반올림, statusPct는 "+N%p"). 오프라인은 Core에서 같은 식으로 계산(Mars 범위 — Core/data 수정은 Mars).

**검사(1회, 출력·exit 동시)**: `node authoritative/test/test-combat-stats-boundary.js` 730/0 exit0 — 새 블록: 양 좌석 재현값·기본값 불변·atk 22.4/def 가산/crit·dodge 상한·Core eff* 동일·6칸 정확·원본 키 미노출·lockstepDigest 불변·누락 null. typecheck는 demo/js 전용이라 미해당·미실행. 필수 CI 전체는 Mercury.

**미해결·한계**: 클라이언트 hydrate·화면 미검증(Mars·Saturn). 실제 applySynergy 경로가 아닌 가산칸 직접 주입으로 검사(식 동일성은 Core eff* 대조로 확인). 서버 미기동·브라우저 미사용.

---

## 이전 6항목(CJ PASS 보존)

판정: **완료(미커밋)**. 실제 실행: Claude `claude-opus-5-5` · high · `--dangerously-skip-permissions`(bypass) · Ponytail full. Git 쓰기·클라이언트/Notion/GitHub 쓰기 0.

**변경 파일**
- `server/authoritative/room.js` `toSeatView`(경기 중 분기): 자기 좌석 `you.pieces`에서만 `!alive` 거름을 제거. 상대 `units`는 `!alive` 거름 그대로(노출 확대 0).
- `server/authoritative/test/test-issue237-economy.js`: #316 두 블록 추가(포획 경계 · 사망 칸 좌석 뷰).

**서버 계약(확정)**
- J1/J2: 자기 placed 칸은 사망·포획당함 포함 `alive:false`로 원래 r·c·rosterId·element 그대로 실린다(오프라인 Core `S.pieces`와 같은 모양). 좌석 뷰 칸으로 센 `synCount` = 서버 Core `synCount`(사망 동결 포함) 검증. `shop.syn`은 종전대로 Core `ecoSynView` 결과. 매각·교체·속성은 Core가 `alive`로 막고(`shopSell`·`shopSwap`·`leaderEl`/`shopTicket`), 보드 `at()`/`alivePieces`가 사망 칸을 거르므로 행동 후보에 섞이지 않는다.
- J3: 검증한 상태에서 Core `ballWhy` 엔진 불일치 **없음**(코드 수정 없음). 두 좌석 사유 동일 + 서버 거부·상태 불변: HP 30/100(정확히 30%), 동종 보유, 전설, 볼 0, 같은 라운드 재투척. HP 29/100 허용, **동종 미보유 · HP 16/100 · 볼 1 · 미투척 → 서버 수락**. CJ 사진의 당시 상태 기록은 없어 신고 원인을 확정하지 않는다. 동종 제한과 일치할 수 있다는 분석은 추론이며 이번 검사만으로 당시 엔진 결함을 배제하지 않는다(Mercury 판정 범위 명확화). 참고: `ecoOwnsKey`는 **살아 있는** 필드 하수인과 가방만 센다(기존 규칙).
- J4: B08(`bagPick` 소유자·토큰·20초·단절·종료 우선·상대 `{owner}`만)·`shopSwap` 무변경 — 기존 B08 검사 통과.
- J5: 자기 왕·동료 `hp/maxHp/shield`는 이미 `_serializeOwn`으로 실림(검증 추가), 공개된 상대 말은 `hp/maxHp`. **서버 필드 누락 없음** → `말 정보` 왕·동료 HP 누락은 클라이언트 공통 부품 원인(Mars).

**Mars 소비 지침**
- 온라인 hydrate 뒤 `S.pieces`에 자기 사망 칸(`alive:false`, `netStubPiece`가 `placed:true`)이 들어온다. 상점 필드(`ui.js` 2139)·교체 대상(2359)·기여 목록(1442)·말 목록(2274)·정보 창 id 조회(1532/1564)에서 오프라인과 같은 사망 표시/조작 금지가 되는지 확인. 보드는 `at()`가 이미 거른다.
- 포획 사유는 서버가 문자열을 보내지 않는다 — 클라이언트 Core `ballWhy(S,side)` 반환 문자열을 짧게 표시(소유자 화면만). B08은 `bagPick{i,token}`만 송신.

**검사(각 1회, 출력·exit 동시 수집, `NODE_PATH`=원본 checkout `server/node_modules` 읽기 재사용 — 작업트리 설치 0)**
- test-issue237-economy 203/0 exit0 · test-room 57/0 exit0 · test-security-gaps 104/0 exit0 · test-public-authority-delta 40/0 exit0 · test-match-fuzz 16/0 exit0(텔레포트 경로가 `you.pieces` 소비자라 실행).

**미해결·한계**: 새 사망 칸 검사가 수정 전 코드에서 실패하는지는 재실행하지 않고 정적 판단(종전 거름이면 사망 칸이 `undefined` → 첫 단언 실패). 클라이언트 실제 hydrate·화면은 미검증(Mars·Saturn). 필수 CI 전체는 Mercury 1회.
