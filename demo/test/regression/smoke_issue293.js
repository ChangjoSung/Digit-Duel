/* #293 시작 상점 → 배치 → 완료 · 공통 하수인 카드 · 교체 선택 · 시너지 단계 색/기여 카드 (클라이언트 표시 계층)
   실행: node demo/test/regression/smoke_issue293.js [demo/index.html]   파일을 쓰지 않는다.
   근거: docs/milestone/v0.4.13/issues/293/Venus/implementation-contract.md (AC1~13) · Earth/UI_CONTRACT.md
   규칙(거래·시계·준비·자동 구매/배치)은 #236·#263·#285 회귀가 본다 — 여기는 이번에 새로 생긴 표시 논리만:
     A 카드 4정보 + 그림 · 등급 테두리 = grade(가격 무관) · 상태가 테두리를 안 바꾼다      B 필드 판매(S01 전용) · 가방 [교체][판매] 한 줄
     C 교체 선택 6카드 · 빈칸/사망 비활성 · shopSwap 1회 · HP 그대로 · 취소 = 무변경      D 시너지 단계 색 = 순위(칸 수 아님) · 기여 카드 수 = 칩 숫자
     E 진행 막대 = 두 좌석 표식(서버 seats.step) · 중앙 준비 팝업 · 추측 없음    F 트레이 14칸 · 글 줄이기 · 그리기는 상태를 바꾸지 않는다
   CJ QA REVISE(2026-10-01) 로 대체된 기대값: 판매 확인 창 → 즉시 판매 · 상점/배치 시계 두 개 → 공통 준비 시계 하나 · 상대 '준비 중' 상자/하단 대기 영역 → 막대 위 표식 + 중앙 팝업 ·
   트레이 ★ 카드 → 보드와 같은 말 얼굴(등급 = 배경 · HP 실제 값) · 우측 열 11칩 → + 왕관 칩.  G 말 얼굴(땅·왕/동료·상대 공개 범위)  H 시너지 덧붙임 칩 */
"use strict";
const path=require("path"), fs=require("fs");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
const css=fs.readFileSync(path.join(path.dirname(htmlPath),"css","game.css"),"utf8");
let pass=0,fail=0;
function ok(c,n){ if(c) pass++; else { fail++; console.error("FAIL: "+n); } }
function eq(got,want,n){ ok(JSON.stringify(got)===JSON.stringify(want),n+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }
const act=(T,a)=>T.dispatchCoreAction(a);
const count=(s,re)=>(s.match(re)||[]).length;
const side=T=>{ T.render(); return T.byId("sidePanel").innerHTML; };
const field=(T,p)=>T.S.pieces.filter(x=>x.owner===p&&x.type==="minion");
const sig=T=>JSON.stringify([T.S.pieces,T.S.eco]);
function pveSetup(seed){ const T=H.load(htmlPath); T.setSeed(seed); T.startMode("pve",{aiLevel:"grade5"}); T.TQ.length=0; return T; }
/* 필드 6칸을 채우고(실제 구매) 필요하면 새로 고침 뒤 가방으로 n마리 더 산다 */
function buy(T,n){ for(let k=0;k<n;k++){ let i=T.ecoBuyable(T.S,0); if(i<0){ act(T,{t:"shopRefresh",player:0,seq:T.S.eco.shop.seq[0]}); i=T.ecoBuyable(T.S,0); }
  act(T,{t:"shopBuy",player:0,i,seq:T.S.eco.shop.seq[0]}); } }
function unit(T,key,grade){ const u={uid:++T.S.eco.unitSeq,paid:0,fresh:false,revealed:false,reaperSeal:0,cap:null};
  const L=T.LEGEND_ROSTER.find(x=>x.id===key); if(L) T.applyLegend(u,L.key); else T.applySpecies(u,T.ROSTER.find(r=>r.id===key),grade); return u; }
const cards=h=>h.split(/(?=<(?:div|button) class="uSlot)/).filter(x=>/^<(?:div|button) class="uSlot uCard/.test(x));
const lastBtn=(T,t)=>T.byId("obBtns").children.slice().reverse().find(b=>b.textContent===t);
const visible=h=>h.replace(/<small class="srOnly[\s\S]*?<\/small>/g,"").replace(/<h2 class="srOnly[\s\S]*?<\/h2>/g,"").replace(/<(span|b) class="srOnly[^>]*>[^<]*<\/\1>/g,"").replace(/<[^>]+>/g,"");

/* ===== A. 카드 — 4정보 + 그림 · 등급 테두리 ===== */
{
  const T=pveSetup(51); let h=T.shopHtml(0);
  const rows=h.split('class="shopCard').slice(1).map(x=>x.split("</div>")[0]);
  ok(rows.length===6&&rows.every((r,i)=>{ const s=T.S.eco.shop.slots[0][i], rd=T.ROSTER.find(x=>x.id===s.key);
    return /^ g1"/.test(r)&&/aria-label="등급 1">★</.test(r)&&/class="tags" role="img" aria-label="[^"]+ · [^"]+"/.test(r)&&(/<img class="icon" src="[^"]+icon\.png"/.test(r)||/class="face"/.test(r))
      &&r.includes(`<b>${rd.name}</b>`)&&r.includes(`<span class="srOnly">HP </span>${T.gradeHp(rd.hp,1)}</small>`); }),"A1 구매 6행 = 그림·실제 이름·등급 1 테두리+★·왕국/아키타입 아이콘·그 등급 최대 HP");
  buy(T,7); h=T.shopHtml(0);
  const f=field(T,0), bag=T.S.eco.bag[0];
  ok(f.every(x=>T.ecoKey(x))&&bag.length===1,"A2 전제: 필드 6칸 + 가방 1마리 (실제 구매)");
  const fc=cards(h.split('class="slotGrid')[1]), bc=cards(h.split('class="slotGrid')[2]);
  ok(fc.length===6&&fc.every((c,i)=>c.includes(`<b>${f[i].name}</b>`)&&c.includes(`HP </span>${f[i].hp}/${f[i].maxHp}`)&&/class="stars" aria-label="등급 1"/.test(c)&&/class="tags"/.test(c)&&/class="(icon|face)"/.test(c)),"A3 필드 카드 6장 = 4정보 + 그림");
  ok(bc.length===1&&bc[0].includes(`<b>${bag[0].name}</b>`)&&bc[0].includes(`HP </span>${bag[0].hp}/${bag[0].maxHp}`)&&/class="stars"/.test(bc[0])&&/class="tags"/.test(bc[0]),"A4 가방 카드 = 4정보 + 그림");
  /* 등급 테두리는 grade 만 본다 — 원장(paid)이 달라도 같은 등급이면 같은 테두리 · 사망이 테두리를 바꾸지 않는다 */
  f[0].grade=3; f[0].paid=1; f[1].grade=3; f[1].paid=9; f[2].grade=2; f[3].grade=4; f[3].alive=false;
  const g=cards(T.shopHtml(0).split('class="slotGrid')[1]).map(c=>c.match(/class="uSlot uCard (g\d)( dead)?/).slice(1));
  eq(g.slice(0,4),[["g3",null],["g3",null],["g2",null],["g4"," dead"]],"A5 테두리 등급 = 개체 grade (원장 1 vs 9 같은 g3) · 사망은 별도 표시(g4 유지)");
  f[0].grade=f[1].grade=f[2].grade=f[3].grade=1; f[3].alive=true;
  /* 전설 = 등급 5 · 왕국 대신 왕관(기존 unitTags 규칙) */
  T.S.eco.bag[0].push(unit(T,"L-DRAGON"));
  const lg=cards(T.shopHtml(0).split('class="slotGrid')[2])[1];
  ok(/class="uSlot uCard g5"/.test(lg)&&/aria-label="전설 · /.test(lg)&&lg.includes(`style="--i:${13}"`),"A6 전설 = g5 테두리 · 왕국 자리는 왕관");
  ok(/\.g1\{--gc:var\(--g1\);\}/.test(css)&&["#ffffff","#bce2cf","#376bce","#7651a8","#c89c3c"].every((c,i)=>css.includes(`--g${i+1}:${c}`)),"A7 등급 1~5 테두리 색 = Earth 토큰");
}
/* ===== B. 필드 판매(S01 전용) · 가방 한 줄 ===== */
{
  const T=pveSetup(52); buy(T,7); const S0=T.S, h=T.shopHtml(0), bag=S0.eco.bag[0][0];
  eq(count(h,/__shop\('sellField'/g),6,"B1 S01 필드 카드마다 [판매]");
  const acts=h.split('class="slotGrid')[2].match(/<span class="acts">([\s\S]*?)<\/span>/)[1];
  eq([...acts.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map(m=>m[1]),["교체","판매"],"B2 가방 = [교체][판매] 두 버튼 한 묶음 · 글자는 두 낱말뿐(환급액 없음)");
  ok(acts.includes(`aria-label="${bag.name} 판매 🪙${bag.paid} 환급"`),"B3 환급액은 접근성 이름에 남는다");
  const rules=[...css.matchAll(/\.shopSheet \.slotGrid\.bag \.uSlot \.acts\{flex-direction:(\w+);\}/g)].map(m=>m[1]);
  eq(rules[rules.length-1],"row","B4 좁은 폭 예외(세로 두 줄)보다 뒤에서 한 줄로 되돌린다");
  const sh0=T.S.eco.shop; T.S.eco.shop=Object.assign({},sh0,{kind:"turn",turn:20}); const th=T.shopHtml(0); T.S.eco.shop=sh0;
  ok(!/sellField/.test(th)&&count(th,/__shop\('sell',/g)===1&&/20턴 상점/.test(th)&&!/flowHead|flowSteps/.test(th),"B6 턴 상점: 필드 [판매] 없음 · 가방만 판매 · 진행 막대 없음");
  const c0=T.S.eco.coins[0]; T.byId("overlayBox").innerHTML=""; T.__shop("sell",bag.uid); T.__shop("sell",bag.uid);
  ok(T.S.eco.bag[0].length===0&&T.S.eco.coins[0]===c0+bag.paid&&T.S.eco.shop.sold[0].includes(T.ecoKey(bag))&&!/판매 확인|원장 100%/.test(T.byId("overlayBox").innerHTML),"B5 [판매] = 확인 창 없이 요청 1회 (코인 +원장 · 종 잠금 · 연타 1회)");
  const fx=field(T,0)[0]; T.__shop("sellField",fx.id);
  ok(!T.ecoKey(fx)&&T.S.eco.coins[0]===c0+bag.paid+1&&!/판매 확인/.test(T.byId("overlayBox").innerHTML),"B7 필드 [판매]도 확인 창 없이 즉시 (6칸 구매 직후 · 진열 품절이어도)");
}
/* ===== C. 교체 선택 ===== */
{
  const T=pveSetup(53); buy(T,7);
  const f=field(T,0), u=T.S.eco.bag[0][0], key0=f[0].rosterId;
  f[0].rosterId=null; f[1].alive=false;                 // 빈칸 1 · 사망 1 (턴 상점에서 생기는 모양) — 자격 표시만 본다
  T.__shop("swap",u.uid);
  let box=T.byId("overlayBox").innerHTML, grid=box.slice(box.indexOf('class="slotGrid swapGrid"'));
  ok(/교체할 필드 하수인 선택/.test(box)&&box.includes(`aria-label="닫기" onclick="window.__shop('swapX',${u.uid})"`)&&T.byId("obBtns").children.length===0&&!lastBtn(T,"취소"),"C1 [교체] → 제목 · ✕(닫기 직결)만 — 맨 아래 [취소] 없음 (2026-10-02 CJ)");
  eq([count(grid,/class="uSlot/g),count(grid,/<button[^>]*disabled aria-disabled="true"/g),count(grid,/__shop\('swapTo'/g)],[6,2,4],"C2 필드 6칸 · 빈칸/사망 2칸은 실제 disabled · 살아 있는 4칸만 선택");
  const S0=T.S, before=sig(T);
  T.__shop("swapTo",f[1].id,u.uid); T.__shop("swapTo",f[0].id,u.uid);
  ok(T.S===S0&&sig(T)===before,"C3 사망·빈칸을 직접 불러도 요청이 나가지 않는다");
  T.__shop("swapX",u.uid);
  ok(T.S===S0&&sig(T)===before&&T.byId("overlay").classList.contains("hidden"),"C4 ✕ = 상태 무변경 · 창 닫힘");
  ok(/find\(b=>b\.textContent==="취소"&&!b\.disabled\)\s*\|\|\$\("overlayBox"\)\.querySelector\("\.acctHead \.acctX"\)/.test(T.html)&&!/querySelector\('#obBtns button'\)\.click\(\)/.test(T.html),
     "C4b Esc = [취소]가 없는 창에서는 그 ✕ · ✕ 는 맨 아래 버튼을 대신 누르지 않는다 (입력 잠금 가드 밖)");
  f[0].rosterId=key0; f[1].alive=true; f[2].hp=37; u.hp=11;
  const outName=f[2].name, inName=u.name, id=f[2].id;
  T.__shop("swap",u.uid); T.__shop("swapTo",id,u.uid);
  const S1=T.S, now=S1.pieces.find(x=>x.id===id), b=S1.eco.bag[0][0];
  ok(now.name===inName&&now.hp===11&&b.name===outName&&b.hp===37,"C5 선택 1회 = 기존 shopSwap — 1:1 교체 · HP 그대로 이동");
  const after=sig(T); T.__shop("swapTo",id,S1.eco.bag[0][0].uid); T.__shop("swapTo",id,u.uid);
  ok(sig(T)===after,"C6 연타는 두 번째 요청을 만들지 않는다 (선택 1회 = shopSwap 1회)");
}
/* ===== C'. 2026-10-02 CJ: 수호자 3종 🪙3 · 상품 설명 팝업 (Venus 계약 9.2 · 9.3 · AC15 · AC16) ===== */
{
  const T=pveSetup(56), U=T.ui238; buy(T,6);
  const BUFF=["power","time","escape"], DESC={potion:"최대 HP 20% 회복",cool:"스킬 쿨타임 초기화",cure:"상태이상 해제",ball:"HP 30% 미만인 적 하수인 포획",ticket:"왕 · 동료 속성 교체 (정기 상점에서 사용)",
    power:"이 전투 동안 내 피해 최대치 고정",time:"이 전투 최대 3라운드 · 1라운드에만 사용 (사신의 낫 불가)",escape:"이 전투 동안 도망 성공률 70%"};
  const off=(h,n)=>count(h,new RegExp(`class="buy" disabled aria-label="[^"]*구매 🪙${n}"`,"g"));
  let h=T.shopHtml(0);
  eq([T.S.eco.coins[0],count(h,/구매 🪙3"/g),count(h,/구매 🪙1"/g),off(h,3),off(h,1)],[4,3,5,0,0],"C'1 전제 🪙4 · 수호자 3종 버튼 🪙3 · 나머지 5종 🪙1 · 전부 활성");
  act(T,{t:"shopGood",player:0,item:"power"});
  eq([T.S.eco.coins[0],T.S.eco.buffInv[0].power],[1,1],"C'2 수호자 구매 = 🪙3 차감 · 보유 +1");
  T.S.eco.coins[0]=2; h=T.shopHtml(0);
  eq([off(h,3),off(h,1)],[3,0],"C'3 🪙2 — 수호자 [구매]만 비활성 (활성 판정은 상품별)");
  const s2=T.S; act(T,{t:"shopGood",player:0,item:"time"});
  ok(T.S===s2&&T.S.eco.coins[0]===2&&T.S.eco.buffInv[0].time===0,"C'4 🪙2 로 수호자는 거부 · 상태 무변경");
  act(T,{t:"shopGood",player:0,item:"cure"});
  eq(T.S.eco.coins[0],1,"C'5 나머지 상품은 그대로 🪙1");
  /* 설명 팝업 — 시너지 안내와 같은 창(SYNHELP) · 이름 + 가격 + 설명 한 줄 · 코인/보유 무변경 · 맨 아래 설명 줄 없음 */
  const s3=T.S, before=sig(T);
  const bad=T.ECO.goods.filter(k=>{ T.__shop("info",k); const d=U.SYNHELP.el.innerHTML, pr=BUFF.includes(k)?3:1;
    return !(d.includes(`<span class="desc">${DESC[k]}</span>`)&&d.includes(`<span class="srOnly">가격 </span>${pr}</span>`)&&(BUFF.includes(k)?T.ECO.buffPrice:T.ECO.goodPrice)===pr&&d.includes(`style="--g:${T.ECO.goods.indexOf(k)}"`)
      &&/class="acctX" aria-label="닫기" onclick="synHelpClose\(true\)"/.test(d)&&!/보유|구매|<button class="buy"/.test(d.replace(/<[^>]+>/g,""))); });
  eq(bad,[],"C'6 상품 8종 팝업 = 아이콘 · 이름 · Core 가격 · 계약 문구 그대로 · ✕ (구매 버튼·보유 문구 없음)");
  ok(U.SYNHELP.el.getAttribute("role")==="dialog"&&U.SYNHELP.el.className==="synHelp"&&T.S===s3&&sig(T)===before,"C'7 시너지 안내와 같은 창(role=dialog) · 열어도 코인·보유·상태 무변경");
  h=T.shopHtml(0);
  ok(!/goodDesc/.test(h)&&count(h,/aria-haspopup="dialog" aria-label="[^"]* 설명 · 보유 \d+" onclick="window\.__shop\('info','\w+',this\)"/g)===8&&!/goodDesc|goodInfo/.test(T.html.replace(/\/\*[\s\S]*?\*\//g,"")),"C'8 맨 아래 설명 줄(#goodDesc) 삭제 · 아이콘 8개가 팝업을 연다");
  /* 팝업 수명 — 열어 둔 설명 팝업은 그 화면과 함께 끝난다: 상점 완료 · 준비 시간 만료 · 정기 상점 닫힘 · 새 판 (공용 정리 = uiApply 화면 전환 · closeModal/modal · gameReset) */
  const pop=X=>{ X.__shop("info","potion"); return !!X.ui238.SYNHELP.el; }, gone=X=>!X.ui238.SYNHELP.el;
  const o1=pop(T); act(T,{t:"shopDone",player:0}); const c1=gone(T);
  const T2=pveSetup(57), o2=pop(T2); act(T2,{t:"shopTimeout",player:0}); T2.render(); const c2=gone(T2);
  const o3=pop(T2)||(T2.ui238.synHelp("fire",1,null),!!T2.ui238.SYNHELP.el); T2.startMode("pve",{aiLevel:"grade5"}); const c3=gone(T2);
  const T4=pveSetup(58); act(T4,{t:"shopTimeout",player:0}); T4.netAction({t:"auto"}); T4.netAction({t:"setupDone"}); T4.TQ.length=0;
  T4.S.turnCount=20; T4.ecoOpenShop(T4.S,"regular",20); T4.S.eco.shop.done[1]=true; T4.S.eco.shop.next=0; T4.S.phase="shop"; T4.render();
  T4.modal(T4.shopHtml(0),[]); T4.__shop("info","potion",{closest:()=>T4.byId("overlayBox")});
  const o4=!!T4.ui238.SYNHELP.el&&T4.byId("overlayBox").contains(T4.ui238.SYNHELP.el); T4.closeModal(); const c4=gone(T4);
  eq([o1,c1,o2,c2,o3,c3,o4,c4],[true,true,true,true,true,true,true,true],"C'9 설명 팝업 수명: 상점 완료 · 준비 만료 · 새 판 · 정기 상점 창 닫힘에서 남지 않는다 (열림/닫힘 쌍)");
}
/* ===== D. 시너지 단계 색 · 기여 카드 ===== */
{
  const T=pveSetup(54), U=T.ui238; buy(T,6);
  const S=T.S, f=field(T,0), R=T.ROSTER, pick=(el,arch,not)=>R.find(r=>r.element===el&&r.arch===arch&&!(not||[]).includes(r.id));
  /* 불 3(+왕 불 = 4칸) · 표준 4칸 — 같은 4칸이라도 왕국은 2단계, 표준은 3단계 */
  const plan=[pick("fire","std"),pick("water","std"),pick("lightning","std"),pick("grass","std"),pick("fire","atk"),pick("fire","def")];
  f.forEach((x,i)=>{ x.rosterId=plan[i].id; x.element=plan[i].element; x.name=plan[i].name; });
  const king=S.pieces.find(x=>x.owner===0&&x.type==="king"); T.__shop("lead",king.id,"fire");
  const v=T.ecoSynView(T.S,0);
  eq([v.el.fire,v.arch.std],[4,4],"D0 전제: 불 4칸 · 표준 4칸");
  const h=side(T), rail=h.slice(h.indexOf('class="synRail"'),h.indexOf("</aside>"));
  const tierOf=(k,n)=>{ const m=rail.match(new RegExp(`class="synChip(?: on)? t(\\d)"[^>]*onclick="synHelp\\('${k}',${n},this,0\\)"`)); return m?+m[1]:null; };
  eq([count(rail,/class="synChip/g),count(rail,/onclick="synHelp\('(?!crown)/g)],[12,11],"D1 우측 열 = 왕국 5 + 아키타입 6 + 왕·동료(왕관) 칩 1");
  eq([tierOf("fire",4),tierOf("std",4)],[v.stage.fire+1,U.synTier("std",4)+1],"D2 칩 단계 = 왕국 syn.stage · 아키타입 synTier");
  ok(tierOf("fire",4)===2&&tierOf("std",4)===3&&tierOf("water",1)===0,"D3 같은 4칸이라도 왕국(2단계)과 표준(3단계)의 색이 다르다 · 미달은 무채색(t0)");
  eq([3,4,5,6].map(n=>U.synTier("std",n)).concat([5,6].map(n=>U.synTier("def",n))),[1,2,3,4,3,3],"D4 아키타입은 한 칸마다 단계가 오르고 방어형은 6칸이어도 5단계에서 멈춘다");
  ok(/<i class="pips" aria-hidden="true">●●○○<\/i>/.test(rail.match(/synHelp\('fire',4,this,0\)[^]*?<\/span>/)[0])&&/\(4\) 달성/.test(rail),"D5 색 외에 단계 점 + 접근성 이름의 단계 글");
  ok(["#b8754a","#9ea9b7","#c99b39","#376bce","#7651a8"].every((c,i)=>css.includes(`--syn${i+1}:${c}`)&&css.includes(`.synChip.t${i+1}{border-color:var(--syn${i+1})`)),"D6 단계 색 = Earth 토큰(순위 0~4 = 동·은·금·파랑·보라 · 순위마다 한 색)");
  { /* 최고 순위(4)는 따로 한 색 — 표준 6칸은 5단계(t5), 방어 6칸은 4단계(t4)에서 멈춘다 */
    f.forEach(x=>{ x.rosterId=plan[0].id; }); const c6=side(T).match(/class="synChip(?: on)? t(\d)"[^>]*onclick="synHelp\('std',6,this,0\)"/);
    f.forEach((x,i)=>{ x.rosterId=plan[i].id; });
    ok(!!c6&&+c6[1]===5&&U.synTier("std",6)+1===5&&U.synTier("def",6)+1===4,"D6b 순위 3 이상을 한 색으로 묶지 않는다 (표준 6칸 t5 · 방어 6칸 t4)"); }
  /* 기여 카드 수 = 칩 숫자 (11개 전부) — 가방 일반 하수인 · 미선택 동료는 없다 */
  T.S.eco.bag[0]=[unit(T,pick("fire","swift").id,1)]; // 가방의 일반 하수인(불 · 속공)
  const keys=T.V2_ELEM_ORDER.concat(Object.keys(T.V2_ARCH_SYN));
  const con=(k,n)=>{ U.synHelp(k,n,null,0); return U.SYNHELP.el.innerHTML; };
  const mism=state=>keys.filter(k=>{ const n=state.el[k]!==undefined?state.el[k]:state.arch[k]; return count(con(k,n),/class="uSlot uCard/g)!==n; });
  const v2=T.ecoSynView(T.S,0);
  eq([v2.el.fire,v2.arch.swift],[4,0],"D7 가방 일반 하수인은 칩 숫자에 없다");
  eq(mism(v2),[],"D8 S01: 기여 카드 수 = 칩 숫자 (왕국 5 + 아키타입 6)");
  const fire=con("fire",4), lead=fire.split('class="uSlot uCard lead"')[1];
  ok(count(fire,/class="uSlot uCard lead"/g)===1&&!!lead&&!/class="stars"|class="hp"|등급/.test(lead)&&/<b>왕<\/b>/.test(lead)&&count(fire,/class="stars"/g)===3,"D9 왕·동료 기여 카드 = 말 그림 + 이름 + 왕국 아이콘만(등급·아키타입·HP 없음) · 하수인 3장은 공통 카드");
  T.S.eco.bag[0].push(unit(T,"L-DRAGON"));
  const v3=T.ecoSynView(T.S,0);
  ok(v3.arch.std===5&&/class="uSlot uCard g5"/.test(con("std",5))&&mism(v3).length===0,"D10 가방 전설은 아키타입 칸에 들고 기여 카드에도 나온다");
  U.synHelp("fire",4,null); ok(!/synCon/.test(U.SYNHELP.el.innerHTML),"D11 소유자를 주지 않은 칩(전투·결과·HUD)은 종전 안내 그대로 — 기여 카드 없음");
  /* 배치 단계 · 경기 중(사망 칸 포함)에도 같은 거름 */
  T.S.eco.bag[0]=[]; act(T,{t:"shopDone",player:0});
  eq(mism(T.ecoSynView(T.S,0)),[],"D12 배치 단계: 기여 카드 수 = 칩 숫자");
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  const dead=field(T,0)[0]; dead.alive=false;
  const pv=T.synView(0,T.S);
  ok(T.S.phase==="play"&&mism(pv).length===0&&/class="uSlot uCard g\d dead"/.test(con(T.archOf(dead),pv.arch[T.archOf(dead)])),"D13 경기 중: Core synView 칸 수와 같고 사망 칸은 사망 표시로 나온다");
}
/* ===== E. 진행 막대 ===== */
const stepOf=h=>{ const m=h.match(/aria-current="step">[\s\S]*?<b>0\d<\/b> ([^<]+)<\/span>/); return m?m[1]:null; };
const bar=h=>h.slice(h.indexOf('class="flowBar"'),h.indexOf('class="synRail"')>0?h.indexOf('<aside class="synRail"'):h.indexOf("</header>"));
{ /* 오프라인(PVE): 01 → 02 직접 완료 */
  const T=pveSetup(55); let h=side(T);
  ok(stepOf(h)==="상점"&&count(h,/role="timer"/g)===1&&/id="prepClock" role="timer"/.test(h)&&!/id="(shop|place)Clock"/.test(h)&&h.includes(`aria-label="재화 ${T.S.eco.coins[0]}"`)&&count(h,/aria-label="재화 /g)===1,"E1 S01: 내 표식 01 상점 · 시계 하나(공통 준비) · 내 코인만");
  ok(/<button type="button" class="primary go" onclick="window\.__shop\('done'\)" disabled title="필드 빈칸 6개를 채우세요">다음 단계/.test(h)&&!/data-prep-step|prepTabs/.test(h),"E2 [다음 단계]는 필드 6칸 전 비활성(사유는 title·접근성 이름) · 01/02 탭 없음");
  buy(T,6); h=side(T);
  ok(/onclick="window\.__shop\('done'\)" >다음 단계/.test(h),"E3 6칸을 채우면 [다음 단계] 활성");
  T.__shop("done"); h=side(T);
  ok(stepOf(h)==="배치"&&T.UI.prep==="place"&&count(h,/role="timer"/g)===1&&/id="prepClock" role="timer"/.test(h)&&!/id="(shop|place)Clock"/.test(h)&&!/shopSheet/.test(h),"E4 직접 완료 → 02 배치 · 시계는 같은 준비 시계 하나 · 상점 본문 없음");
  ok(/onclick="setupDone\(\)" disabled title="말 14개를 더 배치하세요">배치 완료/.test(h),"E5 [배치 완료]는 14개 전 비활성");
  T.netAction({t:"auto"}); h=side(T);
  ok(/onclick="setupDone\(\)" >배치 완료/.test(h),"E6 14개를 놓으면 [배치 완료] 활성 (기존 준비 경로)");
}
{ /* 공개 방: 서버 좌석 뷰만 — 상대 단계를 추측하지 않는다 */
  const {Room}=require(path.join(__dirname,"..","..","..","server","authoritative","room.js"));
  const sws=()=>({readyState:1,sent:[],send(){},close(){ this.readyState=3; }});
  const room=new Room(21,{isPublic:true,epoch:"e1",graceMs:60000,economy:true,seed:293,shopMs:600000,placeMs:600000,actMs:600000,bagPickMs:600000});
  room.openHostSeat(sws()); room.joinGuestSeat(sws());
  const P=H.load(htmlPath,{href:"file:///C:/Digit-Duel/demo/index.html",storage:H.mkStorage({tutorialSeen:"1"})}); if(P.TUT.open) P.tutClose();
  P.netCreatePublicRoom(); const ws=P.wsLog[0]; ws.readyState=1; ws.protocol="digit-duel.v1"; ws.onopen();
  ws.onmessage({data:JSON.stringify({v:1,type:"room_opened",epoch:"e1",roomId:21,seat:0,seatToken:"h",tokenGen:0,revision:0,seq:1,economy:true})});
  P.UI.entered=true; P.byId("tutOverlay").classList.add("hidden");
  const feed=()=>{ const v=room.toSeatView(0); ws.onmessage({data:JSON.stringify({v:1,type:"room_state",revision:v.revision,seat:0,data:v})}); P.byId("overlay").classList.add("hidden"); return v; };
  const shopAct=(seat,t,extra)=>{ const v=room.toSeatView(seat); return room._handleAction(seat,{baseRevision:v.revision,action:Object.assign({t,shop:v.shop.shop,seq:v.shop.seq},extra||{})}); };
  const finish=seat=>{ for(let n=0;n<20&&room.toSeatView(seat).phase==="shop";n++){ const v=room.toSeatView(seat);
    const empty=room.engines[seat].S.pieces.filter(x=>x.owner===seat&&x.type==="minion"&&!x.rosterId).length, i=v.shop.slots.findIndex(x=>x&&!x.sold);
    shopAct(seat,empty?(i>=0?"shopBuy":"shopRefresh"):"shopDone",empty&&i>=0?{i}:{}); } };
  const view=()=>P.byId("sidePanel").innerHTML;
  const olOf=h=>h.slice(h.indexOf("<ol"),h.indexOf("</ol>")), opAt=h=>{ const li=olOf(h).split("<li").slice(1).find(x=>x.includes('class="mk op"')), m=li&&li.match(/<b>0(\d)<\/b>/); return m?+m[1]:0; }; // #294 REVISE: 표식 안은 대표 얼굴(중첩 태그)이라 칸 단위로 찾는다
  let v=feed(), h=view();
  ok(stepOf(h)==="상점"&&opAt(h)===1&&!/flowOpp/.test(h),"E7 공개 방 S01: 두 표식 모두 01 상점(서버 seats.step) · 떨어진 상대 상자 없음");
  ok(P.byId("app").getAttribute("data-flow")==="1","E8 공통 틀 표시 속성(data-flow)");
  finish(1); v=feed(); const afterOpp=view();
  ok(JSON.stringify(v.seats.step)==='["shop","place"]'&&stepOf(afterOpp)==="상점"&&opAt(afterOpp)===2,"E9 상대가 상점을 끝내면 서버 seats.step 대로 상대 표식만 02 배치로 간다 (내 단계 그대로)");
  ok(Array.isArray(v.seats.ready)&&Array.isArray(v.seats.step)&&v.seats.step.length===2&&v.seats.step.every(x=>["shop","place","done"].includes(x)),"E10 서버 좌석 뷰 seats.step = shop/place/done 뿐");
  ok(Object.keys(v.seats).sort().join()==="ready,step"&&(v.units||[]).length===0&&!("opp" in v)&&!("peer" in v),"E10b 준비 구간 좌석 뷰에 상대의 구매·코인·필드가 새로 나가지 않는다 (단계 값뿐)");
  P.NET.steps=null; P.render(); ok(opAt(view())===0&&stepOf(view())==="상점","E10c seats.step 이 없으면(구 서버) 상대 위치를 추측하지 않는다"); feed();
  { /* ===== #294 공용 신원 부품 — 서버가 준 NET.players · NET.reps 만, 보는 사람 기준, 누락은 중립 ===== */
    const U=P.ui238, long="가나다라마바사아자차카타", frame=(players,reps)=>ws.onmessage({data:JSON.stringify({v:1,type:"room_state",revision:room.toSeatView(0).revision,seat:0,players,reps,data:room.toSeatView(0)})});
    const seats=h=>h.slice(h.indexOf('class="idHead"'),h.indexOf("</div>",h.indexOf('class="idHead"'))).split('class="idSeat ').slice(1);
    frame([long,"상대닉"],["M-F1","M-W1"]); P.byId("overlay").classList.add("hidden"); let s=seats(view());
    ok(s.length===2&&/^me"/.test(s[0])&&/^op"/.test(s[1])&&s[0].includes(`<b class="idNm">${long}</b>`)&&s[1].includes(`<b class="idNm">상대닉</b>`)&&!/<small>/.test(s.join(""))&&/^<div class="topBar"><div class="idHead">/.test(view().slice(view().indexOf('<div class="topBar"')))&&count(view(),/class="idHead"/g)===1&&!/flowTop/.test(view())
      &&s[0].includes(U.lobbyRepHtml("M-F1","xs"))&&s[1].includes(U.lobbyRepHtml("M-W1","xs")),"I1 공용 상단 한 줄(topBar) 왼쪽 = 내 대표 · 이름(NET.players/reps) VS 상대 대표 · 이름 — 색(me/op) · 따로 떨어진 신원 줄 없음");
    ok(s[0].includes(`aria-label="나 · ${long} — 프로필 보기"`)&&!/king|ally|leader/.test(s.join("")),"I2 12자 전체 이름은 접근성 이름에 그대로 · 왕/동료 그림이 아니다");
    const mks=olOf(view()); ok(mks.includes(`<span class="mk me">${U.lobbyRepHtml("M-F1","xs")}</span>`)&&mks.includes(`<span class="mk op">${U.lobbyRepHtml("M-W1","xs")}</span>`)&&!/P[12]|나|상대닉/.test(mks.split("<li").slice(1).map(x=>x.slice(0,x.indexOf("<span><b>")).replace(/<[^>]+>/g,"")).join("")),"I3 진행 표식 = 같은 대표 얼굴뿐 — P1/P2 · 첫 글자 · 나/상대 글자 없음");
    U.idHelp(0,0,null); ok(!!U.SYNHELP.el&&U.SYNHELP.el.getAttribute("role")==="dialog"&&U.SYNHELP.el.innerHTML.includes(`<b>${long}</b>`)&&!/<button(?![^>]*acctX)/.test(U.SYNHELP.el.innerHTML),"I4 신원 표식 창 = 대표 + 전체 이름뿐(읽기 전용 · 명령 없음)");
    U.synHelpClose(false);
    frame(["<img src=x>","상대닉"],["L-DRAGON",null]); P.byId("overlay").classList.add("hidden"); s=seats(view());
    ok(P.NET.players[0]===null&&P.NET.reps[0]===null&&/^me"/.test(s[0])&&/^op"/.test(s[1])&&!/<img/.test(s[0])&&/class="repFace xs nt"/.test(s[0])&&s[0].includes(`<b class="idNm">나</b>`)
      &&s[1].includes(`<b class="idNm">상대닉</b>`)&&/class="repFace xs nt"/.test(s[1]),"I5 규칙 밖 이름·대표(전설 ID · null)는 중립 아이콘 + 나/상대만 — 기본 종 그림으로 꾸미지 않는다 · 테두리 색(me/op)은 그대로");
    ok(count(olOf(view()),/<span class="mk (me|op)"><span class="repFace xs nt">/g)===2&&!/<img/.test(olOf(view()))&&!/[가-힣A-Za-z0-9]/.test(olOf(view()).split("<li").slice(1).map(x=>x.slice(x.indexOf(">")+1,x.indexOf("<span><b>")).replace(/<[^>]+>/g,"")).join("")),"I6 대표가 없으면 진행 표식도 같은 중립 아이콘 — 글자 표식 없음");
    frame([long,"상대닉"],["M-F1","M-W1"]); P.byId("overlay").classList.add("hidden");
    const me0=P.NET.me; P.NET.me=1; const flip=seats(U.idHeadHtml(0)); P.NET.me=me0;
    ok(/^me"/.test(flip[0])&&flip[0].includes(`<b class="idNm">상대닉</b>`)&&flip[0].includes(U.lobbyRepHtml("M-W1","xs"))&&/^op"/.test(flip[1])&&flip[1].includes(`<b class="idNm">${long}</b>`),"I7 좌석 1 로 보면 왼쪽(나) = 좌석 1 값 — 좌석 0 을 내 색으로 고정하지 않는다");
    P.NET.players=null; P.NET.reps=null; feed(); }
  finish(0); v=feed(); h=view();
  ok(stepOf(h)==="배치"&&opAt(h)===2,"E11 내 상점 완료 → 두 표식 모두 02 배치");
  P.NET.steps=["place","done"]; P.NET.peerReady=true; P.render(); h=view();
  ok(!/flowOpp/.test(h)&&opAt(h)===3,"E12 상대 준비 완료(seats.step done) → 상대 표식 03 완료");
  feed(); global.autoPlace(); global.setupDone(); P.render(); h=view();
  ok(P.NET.readyWanted&&stepOf(h)==="배치"&&/onclick="netRoomReady\(false\)">준비 취소/.test(bar(h))&&/서버에 준비를 알리는 중|상대의 준비를 기다리는 중|상대를 기다리는 중/.test(h),"E13 준비 요청 중: 서버 확정 전에는 내 표식이 02 에 머문다 · 진행 버튼 자리에 [준비 취소]");
  P.NET.myReady=true; P.NET.steps=["done","place"]; P.render(); h=view();
  const pop=(h.match(/<div class="readyPop" role="status" aria-live="polite">([\s\S]*?)<\/div>/)||[])[1]||"";
  ok(stepOf(h)==="완료"&&/id="prepClock" role="timer"/.test(h)&&/onclick="uiLeaveConfirm\(\)">방 나가기/.test(h)&&/준비 완료 · 상대 기다리는 중…/.test(pop),"E14 서버 확정 → 03 완료 · 공통 시계는 계속 보인다 · 나가기는 ⚙ 안 · 중앙 상태 팝업");
  ok(!/netRoomTitle|내 준비:|상대: /.test(h)&&!/button/.test(pop)&&count(h,/준비 취소/g)===1&&/onclick="netRoomReady\(false\)">준비 취소/.test(bar(h)),"E14b 하단 대기 영역(방 이름·준비 배지) 없음 · [준비 취소]는 우상단 진행 버튼 자리 하나뿐(팝업 안 중복 없음)");
  ok(/\.readyPop\{position:absolute; left:50%; top:50%;[^}]*transform:translate\(-50%,-50%\);[^}]*background:#0b1a3c/.test(css)&&/#left\{[^}]*position:relative;/.test(css)
    &&/sp\.querySelector\("\.readyPop"\); if\(pop\) \$\("left"\)\.appendChild\(pop\);/.test(fs.readFileSync(path.join(path.dirname(htmlPath),"js","ui.js"),"utf8"))
    &&/\$\("left"\)\.querySelector\("\.readyPop"\); if\(old\) old\.remove\(\);/.test(fs.readFileSync(path.join(path.dirname(htmlPath),"js","ui.js"),"utf8")),"E14c 팝업은 말판 래퍼(#left, position:relative) 가운데의 불투명 상자 — 화면 고정이 아니다 · 매 렌더에 치우고 준비 대기에서만 다시 붙인다");
  P.NET.myReady=false; P.NET.readyWanted=false; P.NET.steps=["place","place"]; P.render(); h=view();
  ok(stepOf(h)==="배치"&&/class="tray"/.test(h)&&!/readyPop/.test(h),"E15 준비 취소 → 팝업이 닫히고 02 배치 화면으로 복귀");
  P.NET.myReady=true; P.NET.steps=["done","place"]; P.render(); h=view(); // 준비 의사 없이 서버가 준비 완료 = 준비 시간 초과 자동 완료(01 → 03 직행)
  ok(stepOf(h)==="완료"&&/자동 배치 완료/.test(h),"E16 시간 초과 자동 완료 좌석 = 03 완료 + 기존 '자동 배치 완료' 한 줄");
  /* 공통 마감 — 같은 revision 에서 두 좌석의 준비 시계가 같은 절대 마감이다 */
  { const a=room.toSeatView(0).clock, b=room.toSeatView(1).clock;
    ok(!!a&&!!b&&a.key==="prep"&&b.key==="prep"&&Number.isFinite(a.deadline)&&a.deadline===b.deadline,"E17 두 좌석 시계 뷰 = key prep · 같은 deadline"); }
}
{ /* 오프라인 핫시트: 이 기기가 아는 실제 단계로 두 표식 · 티켓 '무료' */
  const T=H.load(htmlPath); T.setSeed(58); T.startMode("pvp"); T.TQ.length=0; let h=side(T);
  const at=(h,cls)=>h.slice(h.indexOf("<ol"),h.indexOf("</ol>")).split("<li").slice(1).findIndex(x=>x.includes('class="mk '+cls+'"'))+1;
  ok(at(h,"me")===1&&at(h,"op")===1&&!/flowOpp/.test(h),"E18 핫시트 시작: P1 · P2 표식 모두 01 상점 (CJ 이미지 1)");
  buy(T,6); act(T,{t:"shopDone",player:0}); h=side(T);
  ok(at(h,"me")===2&&at(h,"op")===1,"E19 P1 상점 완료 → P1 02 배치 · P2 는 01 그대로");
  const st=pveSetup(59).shopHtml(0), head=st.slice(st.indexOf("왕·동료 속성"),st.indexOf("leadRow"));
  ok(/role="img" aria-label="시작 상점은 티켓 없이 속성을 바꿀 수 있습니다"[^>]*><i class="gi" style="--i:42"[^>]*><\/i>무료<\/span>/.test(head),"E20 시작 상점 제목 옆 티켓 아이콘 + '무료' — 보유 0장이어도 항상 · 접근성 이름");
  { const R=pveSetup(60); act(R,{t:"shopTimeout",player:0}); R.S.eco.tickets[0]=2; R.ecoOpenShop(R.S,"regular",20); R.S.phase="shop"; const rh=R.shopHtml(0);
    ok(/티켓 사용 \(2\)/.test(rh)&&!/>무료</.test(rh),"E21 정기 상점의 티켓 ×N 표시·사용 버튼은 그대로"); }
}
/* ===== F. 트레이 · 글 줄이기 · 무변경 ===== */
{
  const T=pveSetup(56); buy(T,6);
  const raw=T.shopHtml(0), vis=visible(raw);
  ok(/남겨 둡니다/.test(pveSetup(57).shopHtml(0))&&/aria-haspopup="dialog" aria-label="[^"]* 설명 · 보유 \d+"/.test(raw)&&/미선택 → 자동/.test(raw),"F1 안내 문장은 접근성 전용으로 남아 있다 (2026-10-02 CJ: #goodDesc 안내 줄 삭제 → 아이콘 접근성 이름 '설명')");
  ok(!/남겨 둡니다|아이콘을 누르면|미선택|원장|환급/.test(vis)&&!/남겨 둡니다/.test(visible(pveSetup(57).shopHtml(0))),"F2 화면 글에서는 안내 문장·환급액이 빠졌다");
  ok(/하수인 구매/.test(vis)&&/필드 6\/6/.test(vis)&&/가방 0\/3/.test(vis)&&/왕·동료 속성/.test(vis)&&/아이템/.test(vis),"F3 제목·수량은 남아 있다");
  act(T,{t:"shopDone",player:0});
  const b0=sig(T); let h=side(T);
  const tray=h.slice(h.indexOf('<div class="tray">'),h.indexOf('class="row trayActs"'));
  const items=tray.split(/(?=<button class="(?:uSlot|trayItem))/).slice(1), min=items.filter(x=>/<span class="pc p0 gf g1">/.test(x));
  eq([items.length,min.length],[14,6],"F4 트레이 14 고정 칸 · 하수인 6칸은 등급 배경(g1) 말 얼굴");
  const fm=field(T,0), GI=T.ui238.GI;
  ok(min.every((c,i)=>{ const x=fm[i], rd=T.ROSTER.find(r=>r.id===x.rosterId);
    return c.includes(`<i class="gi cr tl" style="--i:${GI[rd.element]}"`)&&c.includes(`<i class="gi cr tr" style="--i:${GI[rd.arch]}"`)&&/class="(icon|face)"/.test(c)
      &&c.includes(`<span class="hp pill"><i class="gi" style="--i:22" aria-hidden="true"></i>${x.hp}</span>`)&&c.includes(`aria-label="${x.name} · ${T.ELEM_KO[rd.element]} · ${T.ARCH_KO[rd.arch]} · 등급 1 · HP ${x.hp}"`); }),
    "F5 트레이 하수인 = 왕국(왼쪽 위)·아키타입(오른쪽 위)·그림·♥ 실제 HP · 이름·등급은 접근성 이름");
  ok(!/★|class="stars"|uCard|\d%|\d\/\d/.test(tray),"F5b 트레이에 ★ · % · 현재/최대 표기가 없다");
  ok(items.filter(x=>!min.includes(x)).every(c=>!/class="stars"|uCard| gf| g\d"|등급/.test(c)&&/aria-label="(왕|동료|폭탄|함정)/.test(c)),"F6 왕·동료·폭탄·함정에는 등급(배경)·아키타입을 붙이지 않는다");
  ok(/말을 클릭 → 자기 진영 칸 클릭/.test(h)&&!/말을 클릭/.test(visible(h))&&/무작위 배치/.test(h)&&/전체 회수/.test(h),"F7 배치 안내 문장은 접근성 전용 · 무작위 배치/전체 회수 한 줄");
  T.netAction({t:"auto"}); h=side(T);
  eq(count(h,/trayItem placed" type="button"[^>]*disabled/g),14,"F8 놓은 칸은 ✓(placed) 표시");
  const b1=sig(T); T.render(); T.render(); T.ui238.synHelp("fire",1,null,0);
  ok(sig(T)===b1&&b0!==b1,"F9 그리기·시너지 안내는 말·경제 상태를 바꾸지 않는다");
}
/* ===== G. 말 얼굴 — 땅/풀 왕국 · 왕·동료(배정 속성 + 역할) · 상대 공개 범위 · 결과 ===== */
{
  const T=pveSetup(61), U=T.ui238, GI=U.GI; buy(T,6);
  const f=field(T,0), R=T.ROSTER, land=R.find(r=>r.element==="land"), grass=R.find(r=>r.element==="grass");
  T.applySpecies(f[0],land,1); T.applySpecies(f[1],grass,3);
  const lead=T.S.pieces.filter(x=>x.owner===0&&(x.type==="king"||x.type==="ally")), king=lead.find(x=>x.type==="king"), ally=lead.find(x=>x.type==="ally");
  ok(T.pcBodyHtml(f[0]).includes(`<i class="gi cr tl" style="--i:${GI.land}"`)&&T.pcBodyHtml(f[1]).includes(`<i class="gi cr tl" style="--i:${GI.grass}"`),"G1 땅 · 풀 하수인도 왕국 아이콘이 나온다 (5속성 전부)");
  ok(U.pcGradeCls(f[1])===" gf g3"&&U.pcGradeCls(f[0])===" gf g1"&&U.pcGradeCls(king)===""&&/등급 3/.test(T.pcLabel(f[1]))&&!/★|%/.test(T.pcBodyHtml(f[1])+T.pcLabel(f[1])),"G2 등급 = 배경 클래스(g1~g5) + 접근성 이름 · ★/% 없음 · 왕·동료는 중립");
  const kb0=T.pcBodyHtml(king), v0=T.ecoSynView(T.S,0), sum=v=>T.V2_ELEM_ORDER.reduce((n,k)=>n+v.el[k],0), arch0=JSON.stringify(v0.arch);
  ok(!/cr tl/.test(kb0)&&kb0.includes(`<i class="gi cr tr" style="--i:${GI.crown}"`)&&v0.pending.length===3&&sum(v0)===6,"G3 상점 완료 전 미선택 왕: 왕국 자리 비움 · 역할 기호만 · 시너지에 세지 않는다");
  act(T,{t:"shopDone",player:0});
  const v1=T.ecoSynView(T.S,0), el=king.element;
  ok(!king.leaderElChosen&&!!el&&lead.every(x=>x.element===el)&&T.pcBodyHtml(king).includes(`<i class="gi cr tl" style="--i:${GI[el]}"`),"G4 상점 완료 뒤 미선택 왕·동료도 실제 배정 속성이 얼굴에 나온다");
  ok(v1.pending.length===0&&sum(v1)===9&&v1.el[el]===v0.el[el]+3&&JSON.stringify(v1.arch)===arch0,"G5 시너지 열 집계에도 반영 (왕국 +3) · 아키타입 집계는 늘지 않는다");
  { U.synHelp(el,v1.el[el],null,0); eq(count(U.SYNHELP.el.innerHTML,/class="uSlot uCard/g),v1.el[el],"G5b 기여 카드 수 = 칩 숫자 (배정된 왕·동료 포함)"); U.synHelpClose(false); }
  ok(/역할 — 왕 · HP \d+$/.test(T.pcLabel(king))&&/역할 — (공격|방어) 동료/.test(T.pcLabel(ally))&&/cr tr/.test(T.pcBodyHtml(ally))&&T.pcBodyHtml(king).includes(`<span class="hp pill"><i class="gi" style="--i:22" aria-hidden="true"></i>${king.hp}</span>`),"G6 왕·동료 = 왕국 + 역할 기호 + ♥ 실제 HP · 접근성 이름 '역할 — …'");
  /* 보드 — 내 말 칩에 등급 배경 · 상대 미공개 말은 ? 뿐 */
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"}); T.render();
  const chips=[]; for(const c of T.byId("board").children) for(const k of (c.children||[])) if(/(^| )pc( |$)/.test(k.className||"")) chips.push(k);
  const mineChip=chips.find(k=>/ own/.test(k.className)&&/ gf g\d/.test(k.className)), hid=chips.filter(k=>/hiddenId/.test(k.className));
  ok(T.S.phase==="play"&&!!mineChip&&/cr tl/.test(mineChip.innerHTML)&&/hp pill/.test(mineChip.innerHTML),"G7 보드의 내 하수인 = 등급 배경 + 같은 얼굴");
  ok(hid.every(k=>!/ gf| g\d/.test(k.className)&&!/cr t|hp|icon|<i /.test(k.innerHTML)),"G8 정체 미공개 상대 말 = ? 뿐 (종·왕국·역할·HP·등급 없음)");
  /* 공개 방: 정체가 공개된 상대 말 = 서버가 보낸 실제 HP·등급 그대로 (% 없음) */
  const stub=T.netStubPiece({id:"u-e",r:4,c:4,owner:1,alive:true,immobile:0,type:"minion",element:land.element,name:land.name,rosterId:land.id,hp:77,maxHp:130,grade:3});
  T.NET.publicMode=true; T.NET.me=0;
  ok(stub.grade===3&&stub.hp===77&&U.pcGradeCls(stub)===" gf g3"&&/>77<\/span>/.test(T.pcInfoHtml(stub))&&!/%/.test(T.pcInfoHtml(stub)+T.pcLabel(stub))&&/등급 3 · HP 77$/.test(T.pcLabel(stub)),"G9 공개된 상대 말 = 서버 실제 HP + 등급(배경) · % 없음");
  /* 결과 화면 — 같은 얼굴 · 실제 값 · % 와 ★ 없음 */
  T.NET.final={sides:[{seat:0,pieces:[{type:"minion",rosterId:land.id,name:land.name,element:"land",alive:true,hp:50,maxHp:120,grade:2}],bag:[],syn:T.synView(0,T.S)},
    {seat:1,pieces:[{type:"minion",rosterId:grass.id,name:grass.name,element:"grass",alive:false,hp:0,maxHp:200,grade:4},{type:"king",name:"왕",element:"fire",alive:true,hp:88,maxHp:100}],bag:[],syn:T.synView(1,T.S)}]};
  const rs=U.resultSeatsHtml().replace(/<div class="synRow">[\s\S]*?<\/section>/g,""); T.NET.publicMode=false; T.NET.final=null;
  ok(/class="uSlot faceBox gf g2"/.test(rs)&&/class="uSlot faceBox gf g4 dead"/.test(rs)&&/>50<\/span>/.test(rs)&&/>88<\/span>/.test(rs)&&/aria-hidden="true">사망<\/i>/.test(rs)&&!/\d%|★|class="stars"/.test(rs),"G10 결과 = 보드와 같은 얼굴 · 실제 HP + 등급 배경(상대 포함) · 사망 표식 · % / ★ 없음");
  ok(/\.pc\.gf\.p0,\.pc\.gf\.p1\{background:var\(--gc\);\}/.test(css)&&/\.resultSeat \.uSlot\.gf\{background:var\(--gc\);\}/.test(css),"G11 등급 배경 = 상점과 같은 Earth 토큰(--gc ← --g1~--g5) · 새 색 없음");
  /* Saturn REVISE(2026-10-01): 결과에서 내 동료의 역할이 사라지지 않는다(상대 역할은 싣지 않는다) · 수풀/놓은 칸에서도 등급 배경·기호·HP 는 불투명 · 팝업 문구는 낱말 중간에서 끊기지 않는다 */
  { const s0=U.resultSideOffline(0), s1=U.resultSideOffline(1), a0=s0.pieces.filter(e=>e.type==="ally"), mine=T.S.pieces.filter(x=>x.owner===0&&x.type==="ally");
    ok(a0.length===2&&a0.every((e,i)=>e.allyKind===mine[i].allyKind&&!!e.allyKind)&&s1.pieces.every(e=>!("allyKind" in e))&&s0.pieces.concat(s1.pieces).every(e=>!("skills" in e)&&!("arch" in e)),"G12 결과 항목: 내 동료만 실제 역할(allyKind)을 지닌다 · 상대 동료 역할·기술·아키타입은 없다");
    T.S.phase="over"; T.S.winner=0; const rs2=U.resultSeatsHtml(), own=rs2.slice(rs2.indexOf('resultSeat mine'),rs2.indexOf('resultVs')), opp=rs2.slice(rs2.indexOf('resultVs'));
    const allySlots=own.split('<div class="uSlot').filter(x=>/역할 — (공격|방어) 동료/.test(x));
    ok(count(own,/역할 — (공격|방어) 동료/g)===4&&allySlots.length===2&&allySlots.every(x=>new RegExp(`<i class="gi cr tr" style="--i:(${GI.atk}|${GI.def})"`).test(x))&&!/역할 — (공격|방어) 동료/.test(opp),"G13 결과 화면: 내 동료 둘은 역할 기호 + 접근성 이름 '역할 — …' · 상대 동료는 역할 표시 없음 ["+[count(own,/역할 — (공격|방어) 동료/g),count(own,/cr tr/g),/역할 — (공격|방어) 동료/.test(opp),own.length,opp.length].join(",")+"]"); }
  ok(/\.pc\.gf\.p0\.inbush::before,\.pc\.gf\.p1\.inbush::before\{content:none;\}/.test(css)&&!/\.pc\.gf[^{]*inbush[^{]*\{background-color:transparent/.test(css)
    &&/\.trayItem\.placed>\.pc\{opacity:1;\}/.test(css)&&/\.readyPop\{[^}]*word-break:keep-all;/.test(css)&&/\.gf \.nm,\.gf \.face \.sym\.ng\{[^}]*background:#06102a; color:#fff;\}/.test(css),"G14 수풀·놓은 칸: 등급 배경 불투명 유지(반투명 층 없음) · 준비 팝업 낱말 단위 줄바꿈 · 그림 없는 이름표는 밝은 등급 배경에서도 읽힌다");
  { const X=pveSetup(63); act(X,{t:"shopTimeout",player:0}); X.netAction({t:"setupDone"}); const a=field(X,0)[0], d=field(X,1)[0];
    X.applySpecies(d,X.ROSTER.find(r=>!field(X,0).some(y=>X.ecoKey(y)===r.id)),1); // 내가 갖지 않은 종 — '이미 가진 종' 사유가 앞서지 않게
    X.startRounds(a,d,a,d); X.drain(); a.hp=Math.max(1,a.maxHp-7); d.hp=d.maxHp; const why=X.ballWhy(X.S,"A");
    ok(why===`상대 HP ${d.hp}/${d.maxHp} — 최대 HP의 30% 미만이어야 합니다`,"G15 포획 불가 사유 = 실제 HP(현재/최대) · 조건(최대 HP의 30% 미만)은 그대로: "+why);
    X.judge(); X.drain();
    ok(X.S.log.some(l=>l.msg.includes(`판정 ${d.maxHp}/${d.maxHp} vs ${a.maxHp-7}/${a.maxHp}`))&&!X.S.log.some(l=>/판정 \d+% vs/.test(l.msg))&&d.alive&&!a.alive,"G16 판정 문구 = 실제 HP(현재/최대) · 승패는 비율 비교 그대로(만피 방어자 승)"); }
}
/* ===== H. 시너지 덧붙임 칩 — 전설 개인 시너지(필드에 살아 있고 값 > 0 일 때만) · 왕·동료(왕관) 0/1/2 ===== */
{
  const T=pveSetup(62), U=T.ui238; act(T,{t:"shopTimeout",player:0}); T.netAction({t:"setupDone"});
  const S=T.S, f=field(T,0), chips=()=>U.synExtraChips(0), lg=h=>h.filter(x=>/synChip on lg/.test(x));
  ok(S.phase==="play"&&lg(chips()).length===0&&T.synExtraView(0,S).legends.length===0,"H1 전설이 없으면 전설 칩이 없다");
  S.eco.bag[0]=[unit(T,"L-WITCH")];
  ok(lg(chips()).length===0,"H2 가방에만 있는 전설은 개인 시너지 칩이 없다 (가방에서 켜지는 개인 효과 없음)");
  S.eco.bag[0]=[]; T.applyLegend(f[0],"witch");
  const kinds=T.synElemKinds(T.synCount(0,S)), want=Math.min(T.V2_LEGEND_SYN.witch.max,kinds*T.V2_LEGEND_SYN.witch.statusPct), ex=T.synExtraView(0,S);
  ok(kinds>0&&ex.legends.length===1&&ex.legends[0].legend==="witch"&&ex.legends[0].v===want&&lg(chips()).length===1&&lg(chips())[0].includes("+"+Math.round(want*100)+"%"),"H3 필드에 살아 있는 마녀 = 칩 1개 · 값은 Core(속성 종류 × 5%p · 상한 25)와 같다");
  f[0].alive=false; ok(lg(chips()).length===0,"H4 그 전설이 죽으면 칩이 사라진다"); f[0].alive=true;
  T.applyLegend(f[0],"reaper");
  ok(T.synCount(0,S).dead===0&&lg(chips()).length===0,"H5 사신: 사망 칸 0 이면 값 0 — 칩 없음(활성 전에는 보이지 않는다)");
  f[1].alive=false; const rv=T.synExtraView(0,S).legends[0];
  ok(!!rv&&rv.legend==="reaper"&&rv.v===Math.min(T.V2_LEGEND_SYN.reaper.max,1*T.V2_LEGEND_SYN.reaper.atk)&&lg(chips())[0].includes("+5%"),"H6 사망 칸 1 → 사신 칩 +5% (Core 값)");
  ok(chips().length===2&&/synHelp\('crown'/.test(chips()[0])&&/synChip on lg/.test(chips()[1]),"H6b 순서 = 왕관 → 활성 전설 (#294 계약 5 · 칩 수 그대로)");
  f[1].alive=true; T.applyLegend(f[0],"dragon");
  const del=T.synDragonEl(T.synCount(0,S)), dx=T.synExtraView(0,S).legends[0];
  ok(del?(dx.legend==="dragon"&&dx.el===del&&dx.fx===T.synKingdomEffect(T.synCount(0,S),del)&&lg(chips()).length===1):lg(chips()).length===0,"H7 용: 달성한 최고 왕국 효과가 있을 때만 칩 (Core synDragonEl 값)");
  const allies=S.pieces.filter(x=>x.owner===0&&x.type==="ally"), crown=()=>chips().find(x=>/synHelp\('crown'/.test(x));
  ok(/synHelp\('crown',0,/.test(crown())&&/class="synChip t0"/.test(crown())&&/죽은 동료 0\/2 · 미달/.test(crown()),"H8 왕관 칩은 항상 · 0명은 미달 표시");
  allies[0].alive=false; ok(/synHelp\('crown',1,/.test(crown())&&/class="synChip on t1"/.test(crown())&&crown().includes(T.SKILLS["LD-REVENGE"].ko),"H9 동료 1명 사망 → 동료의 복수 해금");
  allies[1].alive=false; ok(/synHelp\('crown',2,/.test(crown())&&/class="synChip on t2"/.test(crown())&&crown().includes(T.SKILLS["LD-WRATH"].ko)&&T.synExtraView(0,S).deadAllies===2,"H10 2명 사망 → 왕의 분노 해금");
  T.render(); const hud=T.byId("boardInfo").innerHTML;
  /* #294 대체 기대값: 달성 칩만 가로 줄(hudSyn) → 준비 화면과 같은 세로 열 전체(미달 포함) */
  const rail=hud.slice(hud.indexOf('class="synRail"'),hud.indexOf("</aside>")), v=T.synView(0,S);
  ok(!/hudSyn/.test(hud)&&/synHelp\('crown',2,/.test(rail)&&T.V2_ELEM_ORDER.every(k=>rail.includes(`synHelp('${k}',${v.el[k]},this,0)`))&&Object.keys(T.V2_ARCH_SYN).every(k=>rail.includes(`synHelp('${k}',${v.arch[k]},this,0)`))
    &&count(rail,/onclick="synHelp\('(?!crown)/g)===11&&Object.values(v.arch).some(n=>n===0),"H11 메인 시너지 열 = 왕국 5 + 아키타입 6(미달 0 포함) + 왕관 — 숫자는 Core synView 값");
  { const at=s=>rail.indexOf(s), ks=T.V2_ELEM_ORDER.concat(Object.keys(T.V2_ARCH_SYN)).map(k=>at(`synHelp('${k}',`)), cr=at("synHelp('crown',"), lgAt=at("synChip on lg");
    ok(ks.every((x,i)=>x>=0&&(!i||x>ks[i-1]))&&cr>ks[10]&&(lgAt<0?lg(chips()).length===0:lgAt>cr),"H11c 열 순서 = 왕국 5 → 아키타입 6 → 왕관 → 활성 전설"); }
  ok(hud.includes(U.idHeadHtml(0))&&/^<div class="topBar"><div class="idHead"><button type="button" class="idSeat me"/.test(hud)&&/class="idSeat op"/.test(hud)&&count(hud,/class="repFace xs nt"/g)===2&&!/class="hudVs"|hudTools/.test(hud),"H11b 메인 상단도 같은 공용 한 줄(오프라인 = 중립 아이콘 + pname · 테두리 me/op)");
  { /* 기여 = 숫자(전투가 없을 때) · 사망 유지 · 일반 가방 제외 · 가방 전설 꼬리표 · 전투 중에는 명단 없음 */
    allies.forEach(x=>{ x.alive=true; }); S.eco.bag[0]=[unit(T,T.ROSTER.find(r=>!f.some(x=>x.rosterId===r.id)).id,1),unit(T,"L-WITCH")]; const lost=f[2]; lost.alive=false;
    const v2=T.synView(0,S), cardsOf=(k,n)=>{ U.synHelp(k,n,null,0); const d=U.SYNHELP.el.innerHTML; U.synHelpClose(false); return d; };
    ok(T.V2_ELEM_ORDER.every(k=>count(cardsOf(k,v2.el[k]),/class="uSlot uCard/g)===v2.el[k])&&Object.keys(T.V2_ARCH_SYN).every(k=>count(cardsOf(k,v2.arch[k]),/class="uSlot uCard/g)===v2.arch[k]),"H13 경기 중 11개 칩 모두 기여 카드 수 = 칩 숫자(Core synView)");
    S.eco.shop={kind:"start",turn:0,seq:[0,0],slots:[[],[]],sold:[[],[]],done:[false,false],active:null,next:null}; S.pieces.filter(x=>x.owner===0&&x.type!=="minion").forEach(x=>{ x.leaderElChosen=false; });
    const stale=T.V2_ELEM_ORDER.every(k=>count(cardsOf(k,v2.el[k]),/class="uSlot uCard/g)===v2.el[k])&&T.V2_ELEM_ORDER.some(k=>S.pieces.some(x=>x.owner===0&&(x.type==="king"||x.type==="ally")&&x.placed&&x.element===k)); S.eco.shop=null;
    ok(stale,"H13b 시작 상점 값이 남아 있어도 경기 중 기여 목록은 Core synCount(놓인 칸 — 왕·동료 포함)와 같다 — 준비 미리보기 거름을 쓰지 않는다");
    const la=T.archOf(lost), dl=cardsOf(la,v2.arch[la]);
    ok(dl.includes(`<span class="srOnly">사망 </span>${lost.name}`)&&/<i class="tagMk dead">사망<\/i>/.test(dl),"H14 죽은 기여 말은 목록에 남고 '사망' 표시가 붙는다");
    const wa=T.archOf(S.eco.bag[0][1]), wl=cardsOf(wa,v2.arch[wa]);
    ok(/<i class="tagMk">가방<\/i>/.test(wl)&&T.V2_ELEM_ORDER.every(k=>!cardsOf(k,v2.el[k]).includes(S.eco.bag[0][0].name))&&Object.keys(T.V2_ARCH_SYN).every(k=>!cardsOf(k,v2.arch[k]).includes(S.eco.bag[0][0].name)),"H15 가방 전설은 '가방' 꼬리표로 그 아키타입에 · 일반 가방 말은 어느 목록에도 없다");
    S.battle={syn:{0:T.synCount(0,S),1:T.synCount(1,S)}}; const inB=cardsOf(la,v2.arch[la]); S.battle=null;
    ok(!/synCon/.test(inB)&&/<ol>/.test(inB),"H16 전투가 열려 있는 동안에는 기여 명단 없이 단계표만");
    S.eco.bag[0]=[]; lost.alive=true; }
  ok(JSON.stringify(Object.keys(T.synExtraView(1,S)).sort())==='["deadAllies","legends"]'&&!/ecoSynView|synExtraView/.test(T.aiShop.toString()),"H12 소유자 전용 읽기 selector — 새 효과·수치 없음(AI 입력 아님)");
}
console.log(`smoke_issue293: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
