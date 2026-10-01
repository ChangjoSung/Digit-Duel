/* #285 HotFix — 시작 아이템 · 상점 설명/구매 분리 · 가방 보유 표시 · S01 필드 판매 (클라이언트·공용 Core)
   실행: node demo/test/regression/smoke_issue285.js [demo/index.html]   파일을 쓰지 않는다. */
"use strict";
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
let pass=0,fail=0;
function ok(c,n){ if(c) pass++; else { fail++; console.error("FAIL: "+n); } }
const act=(T,a)=>T.dispatchCoreAction(a);
const kind=r=>r&&r.events&&r.events[0]&&r.events[0].type;
const J=JSON.stringify;
function pveSetup(seed){ const T=H.load(htmlPath); T.setSeed(seed); T.startMode("pve",{aiLevel:"grade5"}); T.TQ.length=0; return T; }
const field=(T,p)=>T.S.pieces.filter(x=>x.owner===p&&x.type==="minion");

/* A. 시작 지급 — 모든 모드 회복약 1 · 볼 1 · 다른 소모품 0 · 🪙10 그대로 */
for(const [mode,opts] of [["pvp",{}],["pvp",{eco:true}],["pve",{eco:true}]]){
  const T=H.load(htmlPath); T.newGame(mode,opts); const S=T.S, nm=mode+(opts.eco?"+eco":"");
  ok([0,1].every(p=>J(S.inv[p])==='["potion"]'&&S.balls[p]===1),"A1 "+nm+" 회복약 1·볼 1만");
  if(opts.eco) ok([0,1].every(p=>S.eco.coins[p]===10&&S.eco.tickets[p]===0&&Object.values(S.eco.buffInv[p]).every(n=>n===0)),"A2 "+nm+" 🪙10 · 티켓·버프 0");
}
{ const T=pveSetup(1); ok(J(T.S.inv[0])==='["potion"]'&&T.S.balls[0]===1,"A3 PVE 첫 상점(startMode)도 회복약 1·볼 1"); }

/* B. 아이콘 = 설명만 · [구매] = 구매만 */
{
  const T=pveSetup(2), S=()=>T.S, h=T.shopHtml(0);
  ok((h.match(/__shop\('info'/g)||[]).length===8&&(h.match(/class="buy"[^>]*onclick="window.__shop\('good'/g)||[]).length===8,"B1 상품 8칸 = 설명 아이콘 8 + 별도 구매 버튼 8");
  ok(!/class="goodIco"[^>]*__shop\('good'/.test(h),"B2 아이콘에는 구매 동작이 없다");
  ok(/aria-label="회복약 구매 🪙1"/.test(h)&&/aria-label="회복약 설명 · 보유 1"/.test(h),"B3 구매·설명 버튼 접근성 이름");
  const c0=S().eco.coins[0], st=S();
  T.__shop("info","potion");
  ok(S()===st&&S().eco.coins[0]===c0&&J(S().inv[0])==='["potion"]',"B4 아이콘 = 코인·상태 무변경");
  const d=T.ui238.SYNHELP.el.innerHTML; // #293 (2026-10-02 CJ 3): 맨 아래 설명 줄 → 시너지 안내와 같은 팝업
  ok(/회복약/.test(d)&&/최대 HP 20% 회복/.test(d)&&/가격 <\/span>1</.test(d)&&!/보유/.test(d),"B5 설명 팝업 = 이름·가격·효과 (보유는 카드 ×n 배지)");
  ok(!/goodDesc|HP 20% 회복/.test(T.shopHtml(0)),"B6 상점 본문에는 설명 줄이 없다");
  T.__shop("good","ball");
  ok(S().eco.coins[0]===c0-1&&S().balls[0]===2,"B7 [구매] = 🪙1 차감 · 볼 +1");
}

/* C. S01 필드 판매 — 원장 100% · 종 잠금 · HP 비율 · 빈칸 · 교착 가드 · 불법 대상 */
{
  /* #293 (2026-10-01 CJ 3 · 5 · 17:58): 6칸을 모두 산 직후(진열 전부 품절)에도 판다 — 진열 칸 수 가드 폐지 · 확인 창 없음.
     예비 코인(빈칸 + 모자란 진열의 새로 고침 1회 값)은 계속 강제하고, 만료 때 모자라면 그 코인으로 새로 고침 1회 뒤 채운다 */
  const T=pveSetup(3);
  for(let n=0;n<6;n++) act(T,{t:"shopBuy",player:0,i:T.ecoBuyable(T.S,0),seq:T.S.eco.shop.seq[0]});
  const fs=field(T,0), f=fs[0], key=T.ecoKey(f);
  ok(f.paid===1&&T.S.eco.coins[0]===4&&T.S.eco.shop.slots[0].every(s=>s&&s.soldOut)&&T.ecoBuyable(T.S,0)<0,"C0 필드 6칸 구매 (🪙10−6=4) · 진열 6칸 전부 품절");
  ok((T.shopHtml(0).match(/__shop\('sellField'/g)||[]).length===6,"C1 S01 필드 하수인마다 판매 버튼");
  const c=T.S.eco.coins[0];
  ok(kind(act(T,{t:"shopSell",player:0,pieceId:f.id}))==="shopChanged","C2 진열이 전부 품절이어도 구매 직후 필드 판매 허용 (진열 칸 수 가드 폐지)");
  const S=T.S, g=S.pieces.find(x=>x.id===f.id);
  ok(S.eco.coins[0]===c+1,"C5 원장 100% 환급");
  ok(!T.ecoKey(g)&&T.ecoEmptyField(S,0).length===1&&!S.roster[0].includes(key),"C6 그 칸은 빈칸 · 로스터에서 빠짐");
  ok(S.eco.shop.sold[0].includes(key)&&S.eco.soldHp[0][key]===1,"C7 종 잠금 · HP 비율 기록");
  { const i=S.eco.shop.slots[0].findIndex(s=>s.key===key), st=T.S, co=S.eco.coins[0];
    ok(kind(act(T,{t:"shopBuy",player:0,i,seq:S.eco.shop.seq[0]}))==="shopRefused"&&S.eco.coins[0]===co&&T.ecoEmptyField(st,0).length===1,"C4 판 종은 이번 상점에서 다시 살 수 없다 (품절 칸 유지 · 재개방 없음)"); }
  { const f2=fs[1], k2=T.ecoKey(f2); T.byId("overlayBox").innerHTML=""; T.__shop("sellField",f2.id);
    ok(!T.ecoKey(f2)&&S.eco.coins[0]===c+2&&S.eco.shop.sold[0].includes(k2)&&!/판매 확인/.test(T.byId("overlayBox").innerHTML),"C3 화면 [판매] = 확인 창 없이 요청 1회로 즉시 판매 (🪙 +1)");
    T.__shop("sellField",f2.id); ok(S.eco.coins[0]===c+2,"C3b 같은 칸 연타는 두 번째 판매를 만들지 않는다"); }
  refused(T,{t:"shopSell",player:0,pieceId:f.id},"C8 빈칸 판매 거부");
  refused(T,{t:"shopSell",player:0,pieceId:S.pieces.find(x=>x.owner===0&&x.type==="king").id},"C9 왕 판매 거부");
  const opp=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&T.ecoKey(x));
  refused(T,{t:"shopSell",player:0,pieceId:opp.id},"C10 상대 하수인 판매 거부");
  refused(T,{t:"shopDone",player:0},"C11 판매 뒤 6칸 미만이면 완료 거부");
  /* 만료 — 빈칸 2 · 살 수 있는 진열 0: 그 좌석 코인으로 새로 고침 1회(🪙1) + 구매 2(🪙2) → 6칸 · 완료 · 자동 배치. 무료 생성 없음 */
  const c12=S.eco.coins[0], locked=S.eco.shop.sold[0].slice();
  act(T,{t:"shopTimeout",player:0});
  ok(T.ecoEmptyField(T.S,0).length===0&&T.S.eco.shop.done[0],"C12 시간 초과 자동 완료가 판매한 칸까지 채운다 (교착 없음)");
  ok(c12===6&&T.S.eco.coins[0]===c12-T.ECO.refresh-2,"C12b 진열이 모자랄 때만 예비 코인으로 새로 고침 1회 + 구매가 (🪙6 → 3)");
  ok(field(T,0).every(x=>!locked.includes(T.ecoKey(x))&&x.paid===1)&&new Set(field(T,0).map(x=>T.ecoKey(x))).size===6,"C12c 채운 말은 새 진열에서 산 것 — 판 종 잠금 유지 · 중복 없음 · 원장 🪙1");
  ok(T.S.pieces.filter(x=>x.owner===0).every(x=>x.placed),"C12d 만료 좌석은 자동 배치까지 끝난다");
}
{ /* 예비 코인 — 판매 뒤 빈칸을 다시 채울 코인(+모자란 진열의 새로 고침 값)이 안 되면 거부 */
  const T=pveSetup(5);
  for(let n=0;n<6;n++) act(T,{t:"shopBuy",player:0,i:T.ecoBuyable(T.S,0),seq:T.S.eco.shop.seq[0]});
  for(let n=0;n<4;n++) act(T,{t:"shopGood",player:0,item:"ball"});
  const f=field(T,0)[0], sig=J([T.S.pieces,T.S.eco]), r=act(T,{t:"shopSell",player:0,pieceId:f.id});
  ok(T.S.eco.coins[0]===0&&kind(r)==="shopRefused"&&/코인을 남겨야/.test(r.events[0].message)&&J([T.S.pieces,T.S.eco])===sig,"C15 🪙0 에서 판매(+1)는 빈칸 1 + 새로 고침 1 = 2 에 못 미쳐 거부 · 상태 불변");
}
{ /* 정기 상점에서는 필드 직접 판매 불가 (교체 → 가방 판매) */
  const T=pveSetup(4); act(T,{t:"shopTimeout",player:0});
  const S=T.S, m=S.pieces.find(x=>x.owner===0&&x.type==="minion"&&T.ecoKey(x));
  T.ecoOpenShop(S,"regular",20); S.phase="shop";
  refused(T,{t:"shopSell",player:0,pieceId:m.id},"C13 정기 상점 필드 판매 거부");
  ok(!/__shop\('sellField'/.test(T.shopHtml(0)),"C14 정기 상점에는 필드 판매 버튼 없음");
}
function refused(T,a,n){ const st=T.S; ok(kind(act(T,a))==="shopRefused"&&T.S===st,n); }

/* D. 회선 — 필드 판매는 id(=pieceId 별칭)로, uid 없이 */
{
  const T=pveSetup(5); T.NET.started=true;
  const w=JSON.parse(J(T.netEcoWire({t:"shopSell",player:0,pieceId:7})));
  ok(w.t==="shopSell"&&w.id===7&&!("uid" in w)&&!("pieceId" in w),"D1 shopSell 필드 판매 = {id} (서버가 내부 pieceId 로 변환)");
  T.NET.started=false;
}

/* E. 가방 서랍 — 내 보유 아이템·볼·버프 수량 아이콘 */
{
  const T=pveSetup(6); act(T,{t:"shopTimeout",player:0}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  T.renderSide(); const h=T.byId("sidePanel").innerHTML;
  ok(/class="ownGrid" role="list"/.test(h)&&/aria-label="회복약 1개"/.test(h)&&/aria-label="몬스터 볼 1개"/.test(h)&&/aria-label="쿨링수 0개"/.test(h),"E1 보유 수량 아이콘 + 접근성 이름");
  ok((h.match(/class="ownItem/g)||[]).length===8,"E2 경제 경기 = 상품 8종 보유칸");
}
/* F. 공개 방 경기 전 — 시작 상점 구매 소모품은 서버 권위 값(you.inv·balls)으로 재수화 (Saturn REVISE: 서버 볼2·🪙9 인데 화면 볼1)
   서버 좌석 뷰(room.js 경기 전 분기) 모양을 로컬 경제 엔진에서 그대로 만든다 — 자기 좌석 값만 싣고 상대 값은 없다. */
{
  const R=H.load(htmlPath); R.newGame("pvp",{eco:true}); act(R,{t:"shopGood",player:0,item:"ball"});
  const sh=R.S.eco.shop;
  const view=(done,extra)=>({seat:0,state:"SETUP",phase:done?"setup":"shop",revision:2,current:null,seats:{ready:[false,false]},units:[],result:null,economy:true,
    you:Object.assign({placed:false,
      pieces:R.S.pieces.filter(x=>x.owner===0).map((x,k)=>({id:"u"+k,r:x.r,c:x.c,owner:0,type:x.type,element:x.element,name:x.name,hp:x.hp,maxHp:x.maxHp,
        atk:x.atk,skillAtk:x.skillAtk,rosterId:R.ecoKey(x),paid:x.paid||0,alive:true,placed:false})),
      eco:{coins:R.S.eco.coins[0],tickets:0,buffInv:Object.assign({},R.S.eco.buffInv[0]),soldHp:{},bag:[]}},extra),
    shop:{kind:sh.kind,shop:sh.turn,seq:sh.seq[0],done,slots:sh.slots[0].map(x=>x&&{key:x.key,grade:x.grade,soldOut:!!x.soldOut,sold:!!x.soldOut}),sold:[],syn:{pending:[]}}});
  const own={inv:R.S.inv[0].slice(),balls:R.S.balls[0]};
  ok(own.balls===2&&R.S.eco.coins[0]===9,"F0 기준 엔진: 볼 구매 = 볼2 · 🪙9");
  const client=()=>{ const N=H.load(htmlPath); N.NET.me=0; N.NET.publicMode=true; N.NET.mode=true; N.NET.started=false; return N; };
  const N=client(); N.netApplyRoomState(view(false,own));
  ok(N.S.balls[0]===2&&N.S.eco.coins[0]===9&&J(N.S.inv[0])===J(own.inv),"F1 시작 상점 구매 뒤 볼2 · 🪙9 (서버 값)");
  ok(/aria-label="몬스터 볼 설명 · 보유 2"/.test(N.shopHtml(0)),"F2 상점 보유 표시도 볼2");
  ok(N.S.balls[1]===1&&J(N.S.inv[1])==='["potion"]'&&N.S.eco.coins[1]===0,"F3 상대 자리는 로컬 기본값 (뷰에 상대 값 없음)");
  const N2=client(); N2.netApplyRoomState(view(false,own));
  ok(N2.S.balls[0]===2&&N2.S.eco.coins[0]===9,"F4 새로 고침(빈 클라이언트) 재수화도 볼2");
  N.netApplyRoomState(Object.assign(view(true,own),{revision:3}));
  ok(N.S.balls[0]===2&&N.UI.prep==="place","F5 상점 완료 → 배치 단계에서도 볼2 유지");
  const N3=client(); N3.netApplyRoomState(view(false,{}));
  ok(N3.S.balls[0]===1&&J(N3.S.inv[0])==='["potion"]',"F6 inv·balls 없는 구 서버 뷰 = 로컬 기본값 유지 (오류 없음)");
}
console.log(`=== smoke_issue285: pass ${pass} / fail ${fail} ===`);
process.exit(fail?1:0);
