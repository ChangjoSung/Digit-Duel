/* #316 v0.4.14 CJ 승인 6항목 — 클라이언트 경계 최소 회귀: node demo/test/regression/smoke_issue316.js
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전). 기존 하네스(H.load · freshPlay · startRounds)와 실제 서버 Room 좌석 뷰를 재사용한다.
     ① 포획 잠금 = Core ballWhy 실제 사유 한 줄(소유자 화면만) · 던질 수 있으면 줄 없음
     ② B08 = 상점 교체와 같은 카드 4장 · 결정은 bagPick{i,token} 하나 · 같은 표 연타 1회 · 상대 대기 문구(CJ 원문)
     ③ 전투 시너지 = 우상단 토글 하나(개수) · 기본 접힘 · 펼침은 로컬(송신 0) · 새 전투 접힘
     ④ 탐색 흔적 = 내가 발견한 미소모 칸 전체 표시 · 소모/상대 흔적은 없음
     ⑤ 온라인 자기 사망 칸: 서버 좌석 뷰 → hydrate → 보드 밖 · 시너지 수치 = 서버 Core · 기여 목록 · 상점 필드에 사망 카드
     ⑥ 왕 · 동료 HP = 상점 속성 줄 · 기여 카드 · 정보 창(현재 방어막은 실제 값만) · 폭탄/함정 HP 없음 */
"use strict";
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
let pass=0,fail=0;
function ok(cond,name){ if(cond) pass++; else { fail++; console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(JSON.stringify(got)===JSON.stringify(want),name+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }
const count=(s,re)=>(s.match(re)||[]).length;
function ecoPlay(seed){ const T=H.load(htmlPath); T.setSeed(seed); T.startMode("pve",{aiLevel:"grade5"}); T.TQ.length=0; // smoke_issue238 pvePlay 와 같은 경제 판
  T.dispatchCoreAction({t:"shopTimeout",player:0}); T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  const S=T.S; S.current=0; S.mainUsed=false; S.battlesUsed=0; S.forcedTargets=[]; S.forcedQueue=[]; S.movedPiece=null; T.TQ.length=0; return T; }
function battle(seed){ const T=ecoPlay(seed);
  const me=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), em=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,me,12,4); H.place(T,em,11,4); T.TQ.length=0; T.startRounds(me,em,me,em); T.TQ.length=0;
  const B=T.S.battle; B.firstSide=B.firstSideR1="A"; B.phase=0; return T; }

/* ===== ① 포획 잠금 사유 ===== */
{
  const T=battle(316), B=T.S.battle, opp=B.fd, html=()=>T.byId("overlayBox").innerHTML;
  const line=()=>{ B.menu="ball"; T.battleModal(); const m=html().match(/<p class="capWhy" role="status">🔒 ([^<]*)<\/p>/); return m?m[1]:null; };
  ok(!!T.S.eco&&T.actorOfPhase()==="A","① 전제 — 경제 판 · 지금 차례 A(owner0)");
  T.S.balls[0]=1; B.ballThrowA=false; opp.hp=opp.maxHp*0.3;
  const w30=T.ballWhy(T.S,"A");
  ok(/^상대 HP/.test(w30)&&line()==="상대 HP 30% 이상"&&html().includes(`title="${w30}"`),"①a 정확히 30% = Core 거부 · 한 줄 '상대 HP 30% 이상' · 긴 원문은 버튼 title");
  opp.hp=Math.ceil(opp.maxHp*0.3)-1; T.S.balls[0]=0;
  eq(line(),"몬스터 볼 없음","①b 볼 0 (HP 30% 미만)");
  T.S.balls[0]=1; B.ballThrowA=true;
  eq(line(),"이번 라운드에 사용함","①c 같은 라운드 재투척");
  B.ballThrowA=false; T.S.eco.bag[0].push({rosterId:T.ecoKey(opp),grade:1,hp:1,maxHp:1,uid:9901});
  eq(line(),"이미 가진 하수인","①d 동종 보유(가방) — HP · 볼 칩이 둘 다 초록이어도 실제 사유가 보인다");
  ok(/<span class="cond ok"[^>]*>❤ ✓<\/span>/.test(html())&&/class="cond ok"[^>]*aria-label="몬스터볼 1개"/.test(html()),"①d2 그때 HP · 볼 칩은 둘 다 충족 표시(두 조건뿐)");
  T.S.eco.bag[0].pop(); opp.legend="dragon";
  eq(line(),"전설은 포획 불가","①e 전설"); delete opp.legend;
  ok(T.ballWhy(T.S,"A")===null&&line()===null&&/onclick="window\.__throwBall\(\)"/.test(html()),"①f 던질 수 있으면 사유 줄 없음 · 버튼은 종전 그대로 활성");
  B.firstSide=B.firstSideR1="D"; B.menu="ball"; T.battleModal(); // AI(owner1) 행동 차례 = 비소유자 화면
  ok(T.actorOfPhase()==="D"&&!/capWhy/.test(html()),"①g 상대(비소유자) 차례 화면에는 사유 줄이 없다(볼 수 · 보유 종 비공개)");
}
/* ===== ③ 전투 시너지 토글 ===== */
{
  const T=battle(317), B=T.S.battle, html=()=>T.byId("overlayBox").innerHTML, n0=T.wsLog.length;
  B.fa.element="fire"; B.syn=[{el:{fire:5,water:0,lightning:0,land:0,grass:0},arch:{std:0,atk:3,def:0,swift:0,sustain:0,guard:0},dead:0,stage:{fire:1,water:-1,lightning:-1,land:-1,grass:-1},bonus:{}},null];
  B.menu=null; T.battleModal(); let h=html();
  const strip=h.slice(h.indexOf('id="bsynStrip"'),h.indexOf('id="bsynTog"')), round=h.slice(h.indexOf('class="bhead bround"'),h.indexOf('id="bstage"'));
  ok(count(h,/id="bsynTog"/g)===1&&count(strip,/class="synChip/g)===2&&/aria-label="활성 시너지 2개 — 펼치기"[^>]*>.*<b>2<\/b><\/button>/.test(h)&&/id="bsynStrip" hidden/.test(h),"③a 토글 하나 · 활성 개수 2 = 펼칠 칩 수(왕국 · 아키타입 한 번씩) · 기본 접힘");
  ok(!/synChip/.test(round)&&/class="bhead"><h2[^>]*>▶[^<]*<\/h2><div class="bsynWrap"/.test(h),"③b 라운드 줄에는 칩이 없다 · 토글은 차례 줄 오른쪽");
  global.__synTog(true); T.battleModal(); h=html();
  ok(T.UI.synOpen===B&&/aria-expanded="true"/.test(h)&&!/id="bsynStrip" hidden/.test(h)&&T.wsLog.length===n0,"③c 펼침은 같은 전투의 재렌더에서 유지 · 송신 0");
  T.S.battle=Object.assign({},B); T.battleModal(); // 새 전투 객체
  ok(/aria-expanded="false"/.test(html())&&/id="bsynStrip" hidden/.test(html()),"③d 새 전투는 접힘으로 시작");
  T.S.battle=B; B.syn=[null,B.syn[0]]; B.fd.element="fire"; B.firstSide=B.firstSideR1="D"; T.battleModal(); // 화면 주인(0) 쪽 스냅샷 없음 → 상대 것은 그리지 않는다
  ok(!/bsynTog|synChip/.test(html().slice(0,html().indexOf('id="bstage"'))),"③e 상대 시너지 · 스냅샷 없는 칩은 토글 자체가 없다(비공개)");
}
/* ===== ② B08 카드 선택 ===== */
{
  const T=ecoPlay(318); const S=T.S, html=()=>T.byId("overlayBox").innerHTML;
  const r=T.ROSTER, mk=(i,g)=>{ const u={uid:++S.eco.unitSeq,paid:g,fresh:false,revealed:false,reaperSeal:0,cap:null}; T.applySpecies(u,r[i],g); return u; };
  S.eco.bag[0]=[mk(10,1),mk(11,2),mk(12,3)]; const cap=mk(13,4); cap.paid=0; cap.hp=Math.round(cap.maxHp*0.7);
  S.eco.bagPick={owner:0,unit:cap,token:cap.uid}; S.phase="bagPick"; const c0=S.eco.coins[0], n0=T.wsLog.length;
  T.bagPickShow(); const h=html(), cards=h.match(/<button class="uSlot uCard g\d[^>]*>[\s\S]*?<\/button>/g)||[];
  ok(/<div class="slotGrid swapGrid bagPickGrid"/.test(h)&&cards.length===4&&cards.every((c,i)=>c.includes(`onclick="window.__bagPick(${i})"`))&&T.byId("obBtns").children.length===0,"②a 교체 창과 같은 카드 격자 · 카드 4장 = 실제 버튼(가방 0~2 · 포획 3) · 모달 버튼 줄 없음");
  ok(h.includes("가방이 가득찼습니다. 가방 하수인을 교체하거나 즉시 풀어주세요.")&&cards.slice(0,3).every(c=>/<b>교체<\/b>/.test(c))&&/<b>풀어주기<\/b>/.test(cards[3])&&/class="uSlot uCard g4/.test(cards[3])&&cards[3].includes(`${cap.hp}/${cap.maxHp}`)&&!/shopSwap|__shop\(/.test(h),"②b CJ 소유자 문구 · [교체]×3 · [풀어주기] · 포획 말 실제 등급 · HP · shopSwap 호출 없음");
  global.__bagPick(1); global.__bagPick(1);
  ok(S.phase==="play"&&!S.eco.bagPick&&S.eco.bag[0][1]===cap&&S.eco.coins[0]===c0+2&&T.wsLog.length===n0,"②c 가방 1번 [교체] → 기존 bagPick: 원장 환급 · 포획 말이 그 칸 · 연타 1회");
  /* 온라인 상대 대기 — 가방 내용 · 대상 · 남은 초 없음 */
  const N=T.NET; Object.assign(N,{mode:true,publicMode:true,me:1}); S.eco.bagPick={owner:0,unit:cap,token:77}; S.phase="bagPick";
  T.netRenderEcoOverlay("bag"); const w=html();
  ok(w.includes("상대방이 가방이 가득 차서 포획 하수인을 더 들고갈 수 없습니다. 행동 진행 중이므로 잠시만 기다려주세요.")&&!w.includes(cap.name)&&!/bagPickGrid|bagClock|__bagPick/.test(w),"②d 상대 대기 = CJ 원문 · 포획 말 · 카드 · 시계 없음");
}
/* ===== ④ 탐색 흔적 칸 ===== */
{
  const T=ecoPlay(319); const S=T.S;
  S.events=[{r:9,c:3,kind:"recruit",consumed:false},{r:9,c:5,kind:"recruit",consumed:false},{r:10,c:6,kind:"recruit",consumed:false}];
  S.traces[0]=new Set(["9_3","9_6"]); S.traces[1]=new Set(["9_5"]); T.renderBoard();
  const cls=(r,c)=>{ const k=T.byId("board").children.find(x=>x.dataset.r===r&&x.dataset.c===c); return k?k.className+" "+(k.classList&&k.classList.contains&&k.classList.contains("traced")?"traced":""):""; };
  ok(/traced/.test(cls(9,3))&&!/traced/.test(cls(9,5))&&!/traced/.test(cls(10,6))&&!/traced/.test(cls(9,6)),"④a 내가 발견한 미소모 흔적 칸만 칸 전체 표시(상대 흔적 · 미발견 · 이벤트 없는 칸 없음)");
  S.events[0].consumed=true; T.renderBoard();
  ok(!/traced/.test(cls(9,3)),"④b 소모되면 다음 렌더에서 바로 사라진다");
}
/* ===== ⑥ 왕 · 동료 HP ===== */
{
  const T=ecoPlay(320); const S=T.S, U=T.ui238, help=()=>{ const h=U.SYNHELP.el?U.SYNHELP.el.innerHTML:""; U.synHelpClose(false); return h; };
  T.ecoOpenShop(S,"regular",20); S.phase="shop";
  const king=S.pieces.find(x=>x.owner===0&&x.type==="king"), ally=S.pieces.find(x=>x.owner===0&&x.type==="ally");
  king.hp=73; king.shield=12;
  const th=T.shopHtml(0), rows=th.split('class="row leadRow"').slice(1);
  ok(rows.length===3&&rows.every(r=>/<small class="hp">[\s\S]*?<\/small>/.test(r.slice(0,r.indexOf("<button"))))&&rows.some(r=>r.includes("73/100"))&&rows.every(r=>/class="faceBtn"[^>]*onclick="unitHelpPiece\(/.test(r)),"⑥a 상점 속성 줄 = 왕 · 동료 그림 아래 실제 HP(공통 hpHtml) + 읽기 전용 말 정보 진입(속성 버튼 밖)");
  U.unitHelpPiece(king.id,null); let h=help();
  ok(/aria-label="HP 73\/100"/.test(h)&&/현재 방어막 12/.test(h),"⑥b 정보 창: 왕 HP 칸(빨간 하트) + 현재 방어막(실제 값)");
  /* Saturn REVISE R1: 정보 창 줄(<ul class="uhRows"> 의 <li>)을 글자만 남겨 하나씩 본다 — 방어막 줄 뒤 사망 · 이동 불가 줄이 따로 살아 있어야 한다 */
  const li=s=>(((s.match(/<ul class="uhRows">([\s\S]*?)<\/ul>/)||[])[1]||"").match(/<li>[\s\S]*?<\/li>/g)||[]).map(r=>r.replace(/<[^>]+>/g,"").trim());
  ok(!li(h).some(r=>/사망|이동 불가/.test(r)),"⑥b2 살아 있고 이동 가능(immobile 0)하면 사망 · 이동 불가 줄 없음");
  king.immobile=2; king.alive=false; U.unitHelpPiece(king.id,null); const r2=li(help()); king.immobile=0; king.alive=true;
  ok(r2.includes("현재 방어막 12")&&r2.includes("사망")&&r2.includes("이동 불가 2턴"),"⑥b3 hp73/100 · 방어막12 · 이동 불가2 · 사망 = 세 줄 각각 [실측 "+JSON.stringify(r2)+"]");
  U.unitHelpPiece(ally.id,null); h=help();
  ok(/aria-label="HP \d+\/\d+"/.test(h)&&!/현재 방어막/.test(h),"⑥c 동료: HP 칸 · 방어막 0 이면 줄 없음");
  for(const t of ["bomb","trap"]){ const x=S.pieces.find(y=>y.owner===0&&y.type===t); U.unitHelpPiece(x.id,null); ok(!/HP|❤️/.test(help()),"⑥d "+t+" 은 HP 없음(지어내지 않는다)"); }
  S.phase="play"; U.synHelp(king.element,3,null,0); h=help();
  const lead=h.match(/<div class="uSlot uCard lead[^"]*"[\s\S]*?<\/div>/g)||[];
  ok(lead.length>0&&lead.every(c=>/<small class="hp">[\s\S]*?\d+\/\d+<\/small>/.test(c)),"⑥e 시너지 기여 목록의 왕 · 동료 카드도 HP");
  const ek=S.pieces.find(x=>x.owner===1&&x.type==="king"); ek.revealed=true; S.tempReveal=new Set([ek.id]);
  U.unitHelpPiece(ek.id,null); h=help();
  ok(/❤️<\/i> HP \d+\/\d+/.test(h)&&!/현재 방어막|uhStats/.test(h),"⑥f 공개된 상대 왕 = 서버 값 hp/maxHp 만 빨간 하트(방어막 · 능력치 없음)");
}
/* ===== ⑤ 시작 상점 고정 3행 (턴 상점 2행은 smoke_issue293 T1) ===== */
{
  const T=H.load(htmlPath); T.setSeed(321); T.startMode("pve",{aiLevel:"grade5"}); T.TQ.length=0; T.render();
  const h=T.byId("sidePanel").innerHTML, head=h.slice(h.indexOf('<header class="flowHead s01">'),h.indexOf("</header>"));
  ok(/<div class="tbTools"><h2 class="who">시작 상점<\/h2>[\s\S]*class="flowGear"/.test(head)&&!/prepClock[\s\S]*class="flowSteps"/.test(head)
    &&/<\/div><div class="flowBar"><ol class="flowSteps"[\s\S]*?<\/ol><\/div><div class="flowBar flowAct"><span class="badge clk" id="prepClock" role="timer">[\s\S]*?aria-label="재화 \d+"[\s\S]*?<button type="button" class="primary go" onclick="window\.__shop\('done'\)"/.test(head),
    "⑤f S01 = ① 신원 · 시작 상점 · ⚙ ② 01/02/03 ③ 공통 준비 시계 · 코인 · [다음 단계](종전 id · 동작)");
  const css=require("fs").readFileSync(path.join(path.dirname(htmlPath),"css","game.css"),"utf8");
  ok(!/- 116px\)/.test(css)&&/function railFit\(\)/.test(require("fs").readFileSync(path.join(path.dirname(htmlPath),"js","ui.js"),"utf8")),"⑤g 시너지 열 높이 = 실측(railFit) — 옛 고정 116px 가정 없음");
}
/* ===== ⑤ 온라인 자기 사망 칸 — 실제 서버 좌석 뷰 → hydrate ===== */
{
  const SH=require(path.join(__dirname,"..","..","..","server","authoritative","test","helpers.js"));
  const {Room,STATES}=SH;
  const sws=()=>({readyState:1,sent:[],send(){},close(){ this.readyState=3; }});
  const room=new Room(316,{isPublic:true,epoch:"e1",graceMs:60000,economy:true,seed:316,shopMs:600000,placeMs:600000,actMs:600000,bagPickMs:600000,prepMs:600000});
  room.openHostSeat(sws()); room.joinGuestSeat(sws());
  const E0=room.engines[0], S0=()=>E0.S;
  const shop=(seat,t,extra)=>{ const v=room.toSeatView(seat); return room._handleAction(seat,{baseRevision:0,action:Object.assign({t,shop:v.shop.shop,seq:v.shop.seq},extra||{})}); };
  for(const seat of [0,1]) for(let n=0;n<20&&room.toSeatView(seat).phase==="shop";n++){ const v=room.toSeatView(seat), empty=S0().pieces.filter(p=>p.owner===seat&&p.type==="minion"&&!p.rosterId).length, i=v.shop.slots.findIndex(x=>x&&!x.sold);
    shop(seat,empty?(i>=0?"shopBuy":"shopRefresh"):"shopDone",empty&&i>=0?{i}:{}); }
  const pos=SH.makeSetup().pos; for(const s of [0,1]) room.handleCommand(s,{t:"setup",roster:S0().roster[s].slice(),pos});
  room.handleCommand(0,{t:"ready"}); room.handleCommand(1,{t:"ready"});
  ok(room.state===STATES.IN_PROGRESS,"⑤ 전제 — 실제 Room 경기 시작");
  const dead=S0().pieces.filter(p=>p.owner===0&&p.type==="minion"&&p.element).slice(0,2);
  SH.both(room,E=>{ for(const m of dead) SH.byId({S:E.S},m.id).alive=false; });
  const P=H.load(htmlPath,{href:"file:///C:/Digit-Duel/demo/index.html",storage:H.mkStorage({tutorialSeen:"1"})}); if(P.TUT.open) P.tutClose();
  P.netCreatePublicRoom(); const ws=P.wsLog[0]; ws.readyState=1; ws.protocol="digit-duel.v1"; ws.onopen();
  ws.onmessage({data:JSON.stringify({v:1,type:"room_opened",epoch:"e1",roomId:316,seat:0,seatToken:"h",tokenGen:0,revision:0,seq:1,economy:true})});
  P.UI.entered=true; P.byId("tutOverlay").classList.add("hidden");
  const feed=()=>{ const v=room.toSeatView(0); ws.onmessage({data:JSON.stringify({v:1,type:"room_state",revision:v.revision,seat:0,data:v})}); P.byId("overlay").classList.add("hidden"); return v; };
  const v=feed(), ids=dead.map(m=>room._alias(m.id)), pd=ids.map(id=>P.S.pieces.find(x=>x.id===id));
  ok(pd.every((x,i)=>x&&x.alive===false&&x.placed===true&&x.r===dead[i].r&&x.c===dead[i].c&&!P.at(x.r,x.c)),"⑤a hydrate 뒤 자기 사망 칸 = 원래 자리 · alive:false · 보드에는 없다(at() 거름)");
  const sv=E0.synView(0,E0.S), cv=P.synView(0,P.S);
  eq([cv.el,cv.arch,cv.dead],[sv.el,sv.arch,sv.dead],"⑤b 화면 시너지 칸 수 = 서버 Core synView(사망 동결 포함)");
  const k=pd[0].element; P.ui238.synHelp(k,cv.el[k],null,0); const ch=P.ui238.SYNHELP.el?P.ui238.SYNHELP.el.innerHTML:""; P.ui238.synHelpClose(false);
  ok(/class="uSlot uCard g\d dead"[\s\S]*?class="tagMk dead">사망</.test(ch),"⑤c 기여 목록에 사망 카드(사망 표식)로 남는다");
  P.S.selected=pd[0]; P.ui238.infoSlotOpen(String(pd[0].id),null);
  ok(!P.ui238.SYNHELP.el,"⑤d 사망 칸은 말 정보 칸 대상이 아니다(선택 · 이동 루프는 at() · alive 거름)");
  /* 정기 상점: 필드 6칸 순서 그대로 · 사망 카드 · 교체 불가 */
  SH.both(room,E=>{ E.S.turnCount=19; }); const cur=S0().current; if(!S0().mainUsed) SH.act(room,cur,{t:"skipMain"}); SH.act(room,cur,{t:"endTurn"});
  feed(); const fh=P.S.eco&&P.S.eco.shop?P.shopHtml(0):"", grid=fh.split('<div class="slotGrid">')[1]||"";
  const order=P.S.pieces.filter(x=>x.owner===0&&x.type==="minion").map(x=>x.alive===false);
  const cards=grid.split("<h3>")[0].match(/class="uSlot uCard g\d( dead)?"/g)||[];
  ok(cards.length===6&&cards.map(c=>/dead/.test(c)).join()===order.join()&&order.filter(Boolean).length===2,"⑤e 정기 상점 필드 = 원래 6칸 순서 · 사망 2칸은 사망 카드");
  room._clearClock();
}
/* ===== CJ REVISE3 (2026-10-03) ① 공개된 상대 말 표식 ② 전투 6스탯 = 적용 중인 값 ③ 상성 띠 · 전투 상성표 버튼 ===== */
{
  const T=battle(322), S=T.S, B=S.battle, html=()=>T.byId("overlayBox").innerHTML, n0=T.wsLog.length, slot=(h,s)=>h.split(`class="bslot slot-${s}"`)[1].split("</ul>")[0];
  const f=B.fa; Object.assign(f,{atk:24,def:5,spd:14,dodge:0.1,crit:0.05,statusPct:0,synAtk:0.1,synDef:3,synSpd:1,synDodge:0.03,synCrit:0.5,synStatusPct:0.05});
  const snap=()=>JSON.stringify(["atk","def","spd","dodge","crit","statusPct","synAtk","synDef","synSpd","synDodge","synCrit","synStatusPct"].map(k=>f[k])), s0=snap();
  B.menu=null; T.battleModal(); let me=slot(html(),"me");
  ok(/aria-label="공격력 26"/.test(me)&&/aria-label="방어력 8"/.test(me)&&/aria-label="속도 15"/.test(me)&&/aria-label="회피 13%"/.test(me)&&/aria-label="치명타 50%"/.test(me)&&/aria-label="상태 부여 확률 \+5%p"/.test(me)&&/>\+5%p<\/b>/.test(me),
    "R3-②a 오프라인 = Core 식(effAtk 26.4→26 · def+synDef · effSpd 15 · effEvade 13% · 치명 50% 상한 · 💫 +5%p 가산)");
  T.battleModal(); ok(snap()===s0,"R3-②b 표시만 — 다시 그려도 기본값 · 가산칸이 쌓이거나 바뀌지 않는다");
  B.fd.eff={atk:22.4,def:12,spd:15,dodge:0.13,crit:undefined,statusPct:0.05}; T.battleModal(); const op=slot(html(),"op"); delete B.fd.eff;
  ok(/aria-label="공격력 22"/.test(op)&&/aria-label="속도 15"/.test(op)&&/aria-label="회피 13%"/.test(op)&&/aria-label="치명타 정보 없음"/.test(op)&&/aria-label="상태 부여 확률 \+5%p"/.test(op),"R3-②c 서버 effectiveStats 가 있으면 그 값(없는 칸 '—')");
  const sb=T.ui238.netSynthBattle({battleId:1,round:1,phase:0,actor:"A",a:{owner:0,type:"minion",hp:85,maxHp:85,spd:14,dodge:0.1,statusPct:0,effectiveStats:{atk:24,def:5,spd:15,dodge:0.13,crit:0.05,statusPct:0.05}},
    d:{owner:1,type:"minion",hp:90,maxHp:90,effectiveStats:{atk:"9",def:null,spd:NaN,dodge:Infinity,crit:0,statusPct:0}}},{});
  const nb=T.ui238.netSynthBattle({battleId:2,round:1,phase:0,actor:"A",a:{owner:0,type:"minion",hp:1,maxHp:1},d:{owner:1,type:"minion",hp:1,maxHp:1,effectiveStats:null}},{});
  ok(sb.fa.eff.spd===15&&sb.fa.spd===14&&sb.fa.eff.statusPct===0.05&&sb.fd.eff.atk===undefined&&sb.fd.eff.def===undefined&&sb.fd.eff.spd===undefined&&sb.fd.eff.dodge===undefined&&sb.fd.eff.crit===0
    &&nb.fa.eff===undefined&&nb.fd.eff===undefined&&!("synSpd" in sb.fd)&&!("synDef" in sb.fd),"R3-②d hydrate: 유한한 숫자만(진짜 0 유지) · 문자열/null/NaN/Infinity 는 '—' · 없으면 eff 없음(종전 기본값) · 가산칸 역산 없음");
  /* ③ 전투 상성표 버튼 — 라운드 줄 오른쪽 하나 · 양쪽 차례 모두 · 그리기만으로 송신 0 */
  const rnd=h=>h.slice(h.indexOf('class="bhead bround"'),h.indexOf('id="bstage"'));
  ok(count(html(),/class="cycBtn"/g)===1&&/onclick="battleCycleOpen\(this\)"/.test(rnd(html()))&&/aria-label="상성표 보기"/.test(rnd(html())),"R3-③a 전투: 라운드 줄 오른쪽 상성표 버튼 하나(이름 있음)");
  B.firstSide=B.firstSideR1="D"; T.battleModal(); ok(count(rnd(html()),/class="cycBtn"/g)===1&&T.wsLog.length===n0,"R3-③b 상대 차례에도 같은 버튼 · 송신 0");
  /* R3-③e 바깥 누름(공용 click 캡처): 상성표(.cyc)만 연 버튼으로 초점 복귀 · 다른 안내 창은 종전(복귀 없음). battleCycleOpen = 공용 창 + .cyc 라 같은 틀로 본다 */
  const U=T.ui238, D=T.document, cyc=D.createElement("button"), out=D.createElement("button"), ev=t=>({target:t,stopPropagation(){},preventDefault(){}});
  U.idHelp(0,0,cyc); U.SYNHELP.el.classList.add("cyc"); out.focus(); D.dispatch("click",ev(out));
  ok(!U.SYNHELP.el&&D.activeElement===cyc&&T.wsLog.length===n0,"R3-③e 상성표 바깥 누름 = 닫고 상성표 버튼으로 초점 복귀 · 송신 0");
  U.idHelp(0,0,cyc); out.focus(); D.dispatch("click",ev(out));
  ok(!U.SYNHELP.el&&D.activeElement===out,"R3-③f 다른 안내 창의 바깥 누름은 종전 그대로(초점 복귀 없음)");
}
{
  const T=ecoPlay(323), S=T.S;
  const mine=S.pieces.find(x=>x.owner===0&&x.type==="minion"), em=S.pieces.filter(x=>x.owner===1&&x.type==="minion");
  H.place(T,mine,7,3); H.place(T,em[0],7,4); H.place(T,em[1],6,4); em[0].revealed=true; em[1].revealed=false; T.renderBoard();
  const chip=(r,c)=>{ const k=T.byId("board").children.find(x=>x.dataset.r===r&&x.dataset.c===c); return k&&k.children[0]; };
  const a=chip(7,4), b=chip(6,4), o=chip(7,3);
  ok(a&&/\bfoe\b/.test(a.className)&&/^상대 말 · /.test(a.getAttribute("aria-label")||"")&&/ gf g\d/.test(a.className)&&/^pc p1 /.test(a.className),"R3-①a 공개된 상대 말 = foe(보이는 '적' 표식 · CSS) + '상대 말' 접근성 이름 · 등급 바탕 그대로 · 상대 색");
  ok(o&&!/\bfoe\b/.test(o.className)&&/\bown\b/.test(o.className)&&!/^상대/.test(o.getAttribute("aria-label")||""),"R3-①b 바로 옆 내 말에는 표식 없음");
  ok(!b||(!/\bfoe\b/.test(b.className)&&/hiddenId/.test(b.className)&&b.getAttribute("aria-label")===null),"R3-①c 미공개 상대 말 = ?/메모 그대로(foe · 정체 문구 없음)");
  mine.revealed=true; S.mode="pvp"; S.current=1; T.renderBoard(); const a1=chip(7,4), o1=chip(7,3); // 핫시트 P1 시점: 같은 말의 소유 색 · 표식이 보는 사람 기준으로 뒤집힌다
  const css=require("fs").readFileSync(path.join(path.dirname(htmlPath),"css","game.css"),"utf8");
  ok(/^pc p1 own /.test(a1.className)&&!/\bfoe\b/.test(a1.className)&&/^pc p0 foe /.test(o1.className)&&/^상대 말 · /.test(o1.getAttribute("aria-label")||"")
    &&/#board \.pc\.own:not\(\.gf\):not\(\.inbush\)\{background:#33406e;\}/.test(css)&&/#board \.pc\.own\.gf\{border-color:#33406e;\}/.test(css)&&/#board \.pc\.foe \.info::before[^{]*\{content:"적"/.test(css),
    "R3-①e P1 시점: 내 말 = own(파랑으로 덮음) · 표식 없음, 공개된 상대(P0) 말 = foe('적' · 빨강) — 좌석 클래스는 그대로");
  S.mode="pve"; S.current=0;
  S.phase="over"; T.renderBoard(); ok(!T.byId("board").children.some(k=>k.children[0]&&/\bfoe\b/.test(k.children[0].className))&&/^pc p1 /.test(chip(7,4).className)&&/^pc p0 /.test(chip(7,3).className),"R3-①d 종료 전체 공개(관전 시점)에는 표식 없음 · 좌석 색 그대로");
  S.phase="play"; T.ui238.renderBoardInfo(); const bi=T.byId("boardInfo").innerHTML, col=bi.slice(bi.indexOf('class="cycleCol"'));
  const byI=Object.fromEntries(Object.entries(T.ui238.GI).map(([k,v])=>[v,k])), seq=[...col.matchAll(/--i:(\d+)/g)].map(m=>byI[m[1]]);
  eq(seq,["fire","water","lightning","land","grass","fire"],"R3-③c 말판 왼쪽 띠 = 위→아래 불 · 물 · 번개 · 땅 · 풀 · 불");
  ok(seq.slice(1).every((w,i)=>T.BEATS[w]===seq[i])&&count(col,/class="up"/g)===5&&/role="img" aria-label="속성 상성 \(이기는 쪽 → 지는 쪽\): 물 → 불/.test(col)&&!/<b>|<small>/.test(col),"R3-③d 아래가 위를 이긴다(BEATS 그대로) · ↑ 5개 · 글자는 접근성 이름에만");
}
/* ===== CJ REVISE3 ④ B08 30초 · 창 안 기권 없음 (소유자 · 상대 대기 모두) ===== */
{
  const T=ecoPlay(324); const S=T.S, html=()=>T.byId("overlayBox").innerHTML, r=T.ROSTER;
  const mk=(i,g)=>{ const u={uid:++S.eco.unitSeq,paid:g,fresh:false,revealed:false,reaperSeal:0,cap:null}; T.applySpecies(u,r[i],g); return u; };
  S.eco.bag[0]=[mk(10,1),mk(11,2),mk(12,3)]; const cap=mk(13,1); cap.paid=0;
  S.eco.bagPick={owner:0,unit:cap,token:cap.uid}; S.phase="bagPick"; const n0=T.wsLog.length, c0=S.eco.coins[0];
  T.bagPickShow(); let h=html();
  ok(T.ECO.bagPickSec===30&&/<span class="badge" id="bagClock" role="timer">⏱ 30초<\/span>/.test(h)&&!/기권|netEcoResign/.test(h)&&S.eco.bagPick&&T.wsLog.length===n0&&S.eco.coins[0]===c0,"R3-④a 오프라인 소유자 창 = 처음부터 ⏱ 30초 · 기권 없음 · 여는 것만으로 결정 · 송신 0");
  const N=T.NET; Object.assign(N,{mode:true,publicMode:true,me:0,ecoClock:{leftMs:27000,running:false,at:Date.now()}}); S.eco.bagPick={owner:0,unit:cap,token:91};
  T.netRenderEcoOverlay("bag"); h=html();
  ok(/id="bagClock" role="timer">⏱ 27초 \(정지\)<\/span>/.test(h)&&!/기권|netEcoResign/.test(h)&&/__bagPick\(0\)/.test(h)&&T.wsLog.length===n0,"R3-④b 공개 방 소유자 창 = 서버가 준 남은 시간(지어낸 30 아님) · 기권 없음 · 송신 0");
  N.me=1; T.netRenderEcoOverlay("bag"); h=html();
  ok(h.includes("상대방이 가방이 가득 차서")&&!/기권|netEcoResign|bagClock|__bagPick/.test(h),"R3-④c 상대 대기 창 = CJ 원문뿐 · 기권 없음(보드 · 상점 · 전투 기권은 별도로 유지)");
  ok(/onclick="netEcoResign\(\)"/.test(T.netResignBtn()),"R3-④d 기권 버튼 부품 자체는 그대로(다른 화면용)");
}
console.log(`smoke_issue316: ${pass} passed, ${fail} failed`);
process.exitCode=fail?1:0;
