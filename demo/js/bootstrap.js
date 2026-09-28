"use strict";
/* ===== 시작: 모드 선택 화면 ===== */
newGame("pvp",{phase:"menu"});
artPreload(); // #89 20종 일괄 — 어떤 말이 무엇인지와 무관하게 항상 같은 요청 집합이 나간다 (규격 7.10.3)
render();
acctCheck(); // #259 계정 서버면 세션을 확인하고 진행 중 좌석에 다시 붙는다 (file://·DB 없는 서버는 기존 그대로)
if(!tutSeen()) tutOpen({auto:true}); // #26→#128 문서 로드당 1회 자동 표시 — 이 줄은 새 문서 로드에서만 실행된다(BFCache 복원·재대전·모드 변경은 재실행 없음)
