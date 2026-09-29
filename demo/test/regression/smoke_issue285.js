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
  const d=T.byId("goodDesc").innerHTML;
  ok(T.UI.goodInfo==="potion"&&/회복약/.test(d)&&/HP 20% 회복/.test(d)&&/보유 1/.test(d)&&/1/.test(d),"B5 설명 = 이름·효과·가격·보유");
  ok(/HP 20% 회복/.test(T.shopHtml(0)),"B6 다시 그려도 고른 설명 유지");
  T.__shop("good","ball");
  ok(S().eco.coins[0]===c0-1&&S().balls[0]===2,"B7 [구매] = 🪙1 차감 · 볼 +1");
}

/* C. S01 필드 판매 — 원장 100% · 종 잠금 · HP 비율 · 빈칸 · 교착 가드 · 불법 대상 */
{
  const T=pveSetup(3);
  act(T,{t:"shopBuy",player:0,i:0,seq:T.S.eco.shop.seq[0]});
  const f=field(T,0).find(x=>T.ecoKey(x)), key=T.ecoKey(f);
  ok(f.paid===1&&T.S.eco.coins[0]===9,"C0 필드 1칸 구매 (🪙1)");
  ok((T.shopHtml(0).match(/__shop\('sellField'/g)||[]).length===1,"C1 S01 필드 하수인마다 판매 버튼");
  const st0=T.S;
  ok(kind(act(T,{t:"shopSell",player:0,pieceId:f.id}))==="shopRefused"&&T.S===st0,"C2 산 칸이 품절이라 판매 뒤 빈 칸 6 > 살 수 있는 칸 5 → 거부 · 상태 불변");
  T.__shop("sellField",f.id); ok(T.S===st0,"C3 화면 판매 버튼은 확인 창만 (상태 무변경)"); T.closeModal();
  act(T,{t:"shopRefresh",player:0,seq:T.S.eco.shop.seq[0]});
  const c=T.S.eco.coins[0];
  ok(kind(act(T,{t:"shopSell",player:0,pieceId:f.id}))==="shopChanged","C4 새로 고침 뒤(빈 칸 6 ≤ 진열 6) 판매 허용");
  const S=T.S, g=S.pieces.find(x=>x.id===f.id);
  ok(S.eco.coins[0]===c+1,"C5 원장 100% 환급");
  ok(!T.ecoKey(g)&&T.ecoEmptyField(S,0).length===6&&!S.roster[0].includes(key),"C6 그 칸은 빈칸 · 로스터에서 빠짐");
  ok(S.eco.shop.sold[0].includes(key)&&S.eco.soldHp[0][key]===1,"C7 종 잠금 · HP 비율 기록");
  refused(T,{t:"shopSell",player:0,pieceId:f.id},"C8 빈칸 판매 거부");
  refused(T,{t:"shopSell",player:0,pieceId:S.pieces.find(x=>x.owner===0&&x.type==="king").id},"C9 왕 판매 거부");
  const opp=S.pieces.find(x=>x.owner===1&&x.type==="minion"&&T.ecoKey(x));
  refused(T,{t:"shopSell",player:0,pieceId:opp.id},"C10 상대 하수인 판매 거부");
  refused(T,{t:"shopDone",player:0},"C11 판매 뒤 6칸 미만이면 완료 거부");
  act(T,{t:"shopTimeout",player:0});
  ok(T.ecoEmptyField(T.S,0).length===0&&T.S.eco.shop.done[0],"C12 시간 초과 자동 완료가 판매한 칸까지 채운다 (교착 없음)");
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
