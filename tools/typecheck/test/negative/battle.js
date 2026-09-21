"use strict";
/* #245 음성 대조군 — 전투·탐색 보상 상태 계약 (Saturn REVISE MEDIUM).
   종전에는 둘 다 any 라 이 파일 전체가 조용히 통과했다. */
(function negBattle(){
  const B=S.battle;
  B.roundz=1;                              // 전투 상태에 없는 칸 쓰기
  if(B.nonexistentContractField) return;   // 전투 상태에 없는 칸 읽기
  B.phase="0";                             // 차례는 숫자다
  B.firstSide="X";                         // 선턴은 A|D 다
  B.pkgSel={kind:"itemGift"};              // 개봉 표는 네 칸을 다 싱는다
  S.recruit.stagee="root";                 // 탐색 보상 상태에 없는 칸
  S.recruit.token=7;                       // 토큰은 문자열이다 (숫자 카운터와 다르다)
})();
