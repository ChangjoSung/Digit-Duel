# #295 CJ REVISE 구현 고정·독립 QA 인계

- CJ 원문과 원본 그림 3장은 [references](../references/CJ_REVISE_20261002.md), 화면 계약은 [Venus](../Venus/cj-revise-contract.md)와 [Earth](../Earth/cj-revise-ui-contract.md)에 보존했다. 기존 #295 브랜치와 Draft PR307을 사용한다.
- 선택한 하수인 버튼은 종 이름 + 하수인 정보로 간결하게 표시한다. 실제 설명 동작과 접근성 HP 정보는 유지한다.
- 정기 상점 TopBar를 게임 프레임 맨 위에 붙이고 창을 바닥까지 채운다. 신원/도구 각각 50%, 시계·코인·기존 이모티콘·설정을 한 줄에 둔다.
- 좁은 화면의 시계는 숫자를 간결하게 표시하고, 남은 초·정지·시간 확인 중 의미는 접근성 이름에 유지한다. 온라인 서버 시계와 오프라인 기존 마감은 유지하며 같은 좌석 재표시는 마감을 초기화하지 않는다.
- 승급 카드는 보유 등급 ↓ 승급 뒤 등급을 왼쪽에 쌓아 일반 카드와 같은 높이를 사용한다. 정가 취소선·실제 가격·차감·확인 규칙은 유지한다.
- 구매 목록·필드·가방은 실제 1~5등급의 기존 색상에 3px 테두리를 공통 적용한다. 빈칸은 중립 점선, 품절은 내용만 흐리게 표시한다.
- 제품 변경은 ui.js·game.css, 기존 회귀 기대 표시는 smoke_issue236 두 줄·smoke_issue238 한 줄이다. 서버·경제·데이터·네트워크 소스·의존성 변경은 없다.
- [Mars 최종 보고](../Mars/cj-revise-followup-report.md): 최종 typecheck 및 236 299/0·293 140/0·238 181/0·262 55/0. 중간 자체 편집 실패와 재검사 횟수는 두 Mars 보고서에 그대로 남겼다.
- 첫 구현의 시계/코인 두 줄과 안쪽 여백은 후속 수정으로 대체했다. 이전 PNG는 이력이며 최종 헤더 근거는 [후속 화면](../Mars/evidence/cj-revise-followup-20261002/320-running-180.png)이다.
- 합성 온라인 상태(180초·코인112), 실제 오프라인 상점에서 320/390/PC432 프레임을 확인했다. TopBar 프레임 일치, 50/50, 이모티콘·설정44px/간격3px, 승급/일반 높이56px, 끝 항목 도달을 자체 실측했다.
- 구현 Worker는 Opus5.5/high/bypass의 현재 턴·GO·완료 실행 근거를 확인한 뒤 종료했다. Mercury는 제품 코드를 수정하지 않았고 Git·문서·운영 메타데이터를 취합했다.
- 이 문서의 커밋 시점에는 Saturn 독립 QA·새 SHA CI·새 QA 배포가 대기다. 최종 동일 SHA 판정·CI·배포 영수증과 CJ 재검사 목록은 [Issue295](https://github.com/ChangjoSung/Digit-Duel/issues/295)·[PR307](https://github.com/ChangjoSung/Digit-Duel/pull/307)가 원본이다.
- 한계: 실제 두 단말·실제180초 플레이는 CJ 재검사 대상. 상점 스크롤 막대는 숨김(휠·터치·키보드 사용), 320px 정지 표시는 금색 이중 막대와 기존 X01 팝업으로 보인다. 네 자리 코인은 미검증이다.
- Issue295 OPEN·PR307 Draft를 유지한다. 원본 main 변경·unity/·stash·handoff·PR304는 보존하며 main/milestone 병합·Release·운영 Render·결제는 실행하지 않는다.
