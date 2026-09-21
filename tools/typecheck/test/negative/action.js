"use strict";
/* #245 음성 대조군 — 액션 계약. */
(function negAction(){
  reduceCoreAction(S, {t:"movee", id:1, r:2, c:3});   // 없는 어휘
  reduceCoreAction(S, {t:"move", id:1, r:2});          // 좌표 한 칸 누락
  reduceCoreAction(S, {t:"heal", id:1, healz:true});   // 액션에 없는 칸
  dispatchCoreAction({t:"roster", rid:7});             // rid 는 문자열이다
  dispatchCoreAction({t:"recruit", step:"back", i:0, token:1}); // recruit 토큰은 문자열이다
})();
