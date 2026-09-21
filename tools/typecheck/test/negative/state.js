"use strict";
/* #245 음성 대조군 — 상태 계약. tsc 가 이 파일에서 오류를 내지 못하면 상태 검사가 죽은 것이다.
   (이 폴더는 tsconfig.negative.json 에서만 읽는다 — 브라우저도 CI 의 양성 검사도 이 파일을 보지 않는다.) */
(function negState(){
  S.mainUsedd = true;                    // 오타난 상태 칸
  S.pieces = "not an array";             // 상태 칸의 타입 위반
  S.aiVanguard[0] = S.pieces[0];         // 선봉은 말이 아니라 말 id 다
  S.metrics.byPlayer = 5;                // 중첩 상태 칸의 타입 위반
})();
