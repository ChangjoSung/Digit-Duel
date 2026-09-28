"use strict";
/* #245 음성 대조군 — 이벤트 계약. */
(function negEvent(){
  applyUiEvents([{type:"healStartd", piece:null}]);    // 오타난 이벤트 종류
  applyUiEvents([{type:"toast"}]);                     // toast 는 message 를 반드시 싱는다
  applyUiEvents([{type:"setupHandoff", player:"0"}]);  // player 는 숫자다
  applyUiEvents([{type:"battleSlot", side:"A", slto:1}]);              // emit 칸 오타 (slot→slto)
  applyUiEvents([{type:"battleSlot", side:"X", slot:1}]);              // side 는 A|D 다
  applyUiEvents([{type:"pkgOpenModal", kind:"itemGift", owner:0, round:1}]); // 개봉 표 번호(id)를 반드시 싱는다
  applyUiEvents([{type:"searchDone", owner:0, title:"t", sub:"s"}]);   // 종료 순번(seq)을 반드시 싱는다
  /** @type {CoreEvent} */
  const bad = {type:"moved", piece:null, trace:false}; // moved 는 healBroken 을 반드시 싱는다
  applyUiEvents([bad]);
})();
