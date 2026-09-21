"use strict";
/* #245 음성 대조군 — 프로토콜 계약. */
(function negProtocol(){
  netSend({t:"hello"});                                // 릴레이 hello 는 seed·setup 을 싱는다
  netSend({v:1, t:"list_roomz"});                      // 서버 봉투에 없는 명령
  netSend({v:1, t:"action"});                          // action 봉투는 credential·baseRevision·action 을 싱는다
  netSend({v:1, t:"ready"});                           // list_rooms 밖 명령은 credential 을 싱는다
  netSendCmd("ready_typo");                            // 없는 명령 이름
  netSendCmd("action",{baseRevision:0});               // action 봉투에 action 이 없다
  netSendCmd("setup",{roster:[]});                     // setup 봉투에 pos 가 없다
  netAction({t:"cel", r:1, c:1});                      // 회선 액션 어휘 오타
  netAction({t:"fleeSwap"});                           // fleeSwap 은 id 를 싱는다
  netAction({t:"act", k:"basic", bf:{side:0, seq:0, round:1, phase:"0"}}); // 겨냥 문맥은 side=A|D · phase=숫자다
  applyAction({t:"modal", seq:1});                     // modal 중계는 버튼 자리(i)를 싱는다
})();
