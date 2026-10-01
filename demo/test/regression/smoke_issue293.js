/* #293 시작 상점 → 배치 → 완료 · 공통 하수인 카드 · 교체 선택 · 시너지 단계 색/기여 카드 (클라이언트 표시 계층)
   실행: node demo/test/regression/smoke_issue293.js [demo/index.html]   파일을 쓰지 않는다.
   근거: docs/milestone/v0.4.13/issues/293/Venus/implementation-contract.md (AC1~13) · Earth/UI_CONTRACT.md
   규칙(거래·시계·준비·자동 구매/배치)은 #236·#263·#285 회귀가 본다 — 여기는 이번에 새로 생긴 표시 논리만:
     A 카드 4정보 + 그림 · 등급 테두리 = grade(가격 무관) · 상태가 테두리를 안 바꾼다      B 필드 판매(S01 전용) · 가방 [교체][판매] 한 줄
     C 교체 선택 6카드 · 빈칸/사망 비활성 · shopSwap 1회 · HP 그대로 · 취소 = 무변경      D 시너지 단계 색 = 순위(칸 수 아님) · 기여 카드 수 = 칩 숫자
     E 진행 막대 = 내 단계(직접 완료 · 시간 초과 · 준비 취소) · 상대는 준비 완료만 · 추측 없음    F 트레이 14칸 · 글 줄이기 · 그리기는 상태를 바꾸지 않는다 */
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
  T.__shop("sell",bag.uid);
  ok(T.S===S0&&/원장 100%/.test(T.byId("overlayBox").innerHTML),"B5 [판매] = 기존 확인 창 1회 (상태 무변경)"); T.closeModal();
  const sh0=T.S.eco.shop; T.S.eco.shop=Object.assign({},sh0,{kind:"turn",turn:20}); const th=T.shopHtml(0); T.S.eco.shop=sh0;
  ok(!/sellField/.test(th)&&count(th,/__shop\('sell',/g)===1&&/20턴 상점/.test(th)&&!/flowHead|flowSteps/.test(th),"B6 턴 상점: 필드 [판매] 없음 · 가방만 판매 · 진행 막대 없음");
}
/* ===== C. 교체 선택 ===== */
{
  const T=pveSetup(53); buy(T,7);
  const f=field(T,0), u=T.S.eco.bag[0][0], key0=f[0].rosterId;
  f[0].rosterId=null; f[1].alive=false;                 // 빈칸 1 · 사망 1 (턴 상점에서 생기는 모양) — 자격 표시만 본다
  T.__shop("swap",u.uid);
  let box=T.byId("overlayBox").innerHTML, grid=box.slice(box.indexOf('class="slotGrid swapGrid"'));
  ok(/교체할 필드 하수인 선택/.test(box)&&/aria-label="닫기"/.test(box)&&!!lastBtn(T,"취소"),"C1 [교체] → 제목 · ✕ · 취소가 있는 선택 창");
  eq([count(grid,/class="uSlot/g),count(grid,/<button[^>]*disabled aria-disabled="true"/g),count(grid,/__shop\('swapTo'/g)],[6,2,4],"C2 필드 6칸 · 빈칸/사망 2칸은 실제 disabled · 살아 있는 4칸만 선택");
  const S0=T.S, before=sig(T);
  T.__shop("swapTo",f[1].id,u.uid); T.__shop("swapTo",f[0].id,u.uid);
  ok(T.S===S0&&sig(T)===before,"C3 사망·빈칸을 직접 불러도 요청이 나가지 않는다");
  lastBtn(T,"취소").onclick();
  ok(T.S===S0&&sig(T)===before&&T.byId("overlay").classList.contains("hidden"),"C4 취소 = 상태 무변경 · 창 닫힘");
  f[0].rosterId=key0; f[1].alive=true; f[2].hp=37; u.hp=11;
  const outName=f[2].name, inName=u.name, id=f[2].id;
  T.__shop("swap",u.uid); T.__shop("swapTo",id,u.uid);
  const S1=T.S, now=S1.pieces.find(x=>x.id===id), b=S1.eco.bag[0][0];
  ok(now.name===inName&&now.hp===11&&b.name===outName&&b.hp===37,"C5 선택 1회 = 기존 shopSwap — 1:1 교체 · HP 그대로 이동");
  const after=sig(T); T.__shop("swapTo",id,S1.eco.bag[0][0].uid); T.__shop("swapTo",id,u.uid);
  ok(sig(T)===after,"C6 연타는 두 번째 요청을 만들지 않는다 (선택 1회 = shopSwap 1회)");
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
  eq(count(rail,/class="synChip/g),11,"D1 우측 열 = 칩 11개(왕국 5 + 아키타입 6)");
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
  ok(stepOf(h)==="상점"&&/id="shopClock" role="timer"/.test(h)&&!/id="placeClock"/.test(h)&&h.includes(`aria-label="재화 ${T.S.eco.coins[0]}"`)&&count(h,/aria-label="재화 /g)===1,"E1 S01: 내 표식 01 상점 · 시계 하나(상점) · 내 코인만");
  ok(/<button type="button" class="primary go" onclick="window\.__shop\('done'\)" disabled title="필드 빈칸 6개를 채우세요">다음 단계/.test(h)&&!/data-prep-step|prepTabs/.test(h),"E2 [다음 단계]는 필드 6칸 전 비활성(사유는 title·접근성 이름) · 01/02 탭 없음");
  buy(T,6); h=side(T);
  ok(/onclick="window\.__shop\('done'\)" >다음 단계/.test(h),"E3 6칸을 채우면 [다음 단계] 활성");
  T.__shop("done"); h=side(T);
  ok(stepOf(h)==="배치"&&T.UI.prep==="place"&&/id="placeClock" role="timer"/.test(h)&&!/id="shopClock"/.test(h)&&!/shopSheet/.test(h),"E4 직접 완료 → 02 배치 · 시계는 배치 시계 하나 · 상점 본문 없음");
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
  let v=feed(), h=view();
  ok(stepOf(h)==="상점"&&/class="flowOpp" role="status" aria-label="[^"]* — 준비 중"/.test(h)&&!/class="mk op"/.test(h.slice(h.indexOf("<ol"),h.indexOf("</ol>"))),"E7 공개 방 S01: 내 01 · 상대는 단계 없는 '준비 중'(막대 위에 상대 표식 없음)");
  ok(P.byId("app").getAttribute("data-flow")==="1","E8 공통 틀 표시 속성(data-flow)");
  finish(1); v=feed(); const afterOpp=view();
  eq(bar(afterOpp),bar(h),"E9 상대가 상점을 끝내도 내 화면의 진행 막대는 그대로 — 좌석 뷰에 없는 값으로 상대 위치를 정하지 않는다");
  ok(!("step" in (v.seats||{}))&&Array.isArray(v.seats.ready),"E10 서버 좌석 뷰는 seats.ready 뿐(단계 필드 없음 · 서버 무변경)");
  finish(0); v=feed(); h=view();
  ok(stepOf(h)==="배치"&&/준비 중/.test(bar(h)),"E11 내 상점 완료 → 02 배치 · 상대는 여전히 '준비 중'");
  P.NET.peerReady=true; P.render(); h=view();
  ok(!/flowOpp/.test(h)&&/<li><span class="mks" aria-hidden="true"><span class="mk op">[^<]+<\/span><\/span><span><b>03<\/b> 완료/.test(h),"E12 상대 준비 완료(seats.ready) → 상대 표식 03 완료");
  P.NET.peerReady=false; global.autoPlace(); global.setupDone(); P.render(); h=view();
  ok(P.NET.readyWanted&&stepOf(h)==="배치"&&/onclick="netRoomReady\(false\)">준비 취소/.test(bar(h))&&/서버에 준비를 알리는 중|상대의 준비를 기다리는 중|상대를 기다리는 중/.test(h),"E13 준비 요청 중: 서버 확정 전에는 내 표식이 02 에 머문다 · 진행 버튼 자리에 [준비 취소]");
  P.NET.myReady=true; P.render(); h=view();
  ok(stepOf(h)==="완료"&&!/role="timer"/.test(h)&&/onclick="uiLeaveConfirm\(\)">방 나가기/.test(h)&&/내 준비: .*완료/.test(h),"E14 서버 확정(seats.ready) → 03 완료 · 시계 없음 · 나가기는 ⚙ 안 · 현행 대기 내용 유지");
  P.NET.myReady=false; P.NET.readyWanted=false; P.render(); h=view();
  ok(stepOf(h)==="배치"&&/class="tray"/.test(h),"E15 준비 취소 → 02 배치 화면으로 복귀");
  P.NET.myReady=true; P.render(); h=view(); // 준비 의사 없이 서버가 준비 완료 = S01 시간 초과 자동 완료(01 → 03 직행)
  ok(stepOf(h)==="완료"&&/자동 배치 완료/.test(h),"E16 시간 초과 자동 완료 좌석 = 03 완료 + 기존 '자동 배치 완료' 한 줄");
}
/* ===== F. 트레이 · 글 줄이기 · 무변경 ===== */
{
  const T=pveSetup(56); buy(T,6);
  const raw=T.shopHtml(0), vis=visible(raw);
  ok(/남겨 둡니다/.test(pveSetup(57).shopHtml(0))&&/아이콘을 누르면 설명이 보입니다/.test(raw)&&/미선택 → 자동/.test(raw),"F1 안내 문장은 접근성 전용으로 남아 있다");
  ok(!/남겨 둡니다|아이콘을 누르면|미선택|원장|환급/.test(vis)&&!/남겨 둡니다/.test(visible(pveSetup(57).shopHtml(0))),"F2 화면 글에서는 안내 문장·환급액이 빠졌다");
  ok(/하수인 구매/.test(vis)&&/필드 6\/6/.test(vis)&&/가방 0\/3/.test(vis)&&/왕·동료 속성/.test(vis)&&/아이템/.test(vis),"F3 제목·수량은 남아 있다");
  act(T,{t:"shopDone",player:0});
  const b0=sig(T); let h=side(T);
  const tray=h.slice(h.indexOf('<div class="tray">'),h.indexOf('class="row trayActs"'));
  const items=tray.split(/(?=<button class="(?:uSlot|trayItem))/).slice(1), min=items.filter(x=>/^<button class="uSlot uCard g\d trayItem/.test(x));
  eq([items.length,min.length],[14,6],"F4 트레이 14 고정 칸 · 하수인 6칸은 공통 카드");
  ok(min.every(c=>/class="stars"/.test(c)&&/class="tags"/.test(c)&&/class="(icon|face)"/.test(c)&&/HP <\/span>\d+\/\d+/.test(c)&&/<b class="srOnly">[^<]+<\/b>/.test(c)),"F5 트레이 하수인 = 그림·등급·왕국·아키타입·HP · 이름은 접근성 이름");
  ok(items.filter(x=>!min.includes(x)).every(c=>!/class="stars"|uCard/.test(c)&&/aria-label="(왕|동료|폭탄|함정)/.test(c)),"F6 왕·동료·폭탄·함정에는 등급·아키타입을 붙이지 않는다");
  ok(/말을 클릭 → 자기 진영 칸 클릭/.test(h)&&!/말을 클릭/.test(visible(h))&&/무작위 배치/.test(h)&&/전체 회수/.test(h),"F7 배치 안내 문장은 접근성 전용 · 무작위 배치/전체 회수 한 줄");
  T.netAction({t:"auto"}); h=side(T);
  eq(count(h,/trayItem placed" type="button"[^>]*disabled/g),14,"F8 놓은 칸은 ✓(placed) 표시");
  const b1=sig(T); T.render(); T.render(); T.ui238.synHelp("fire",1,null,0);
  ok(sig(T)===b1&&b0!==b1,"F9 그리기·시너지 안내는 말·경제 상태를 바꾸지 않는다");
}
console.log(`smoke_issue293: ${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
