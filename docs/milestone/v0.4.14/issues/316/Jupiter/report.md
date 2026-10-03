# #316 Jupiter 서버 계약 보고 — 2026-10-03

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
