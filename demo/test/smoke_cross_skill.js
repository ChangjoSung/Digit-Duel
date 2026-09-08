/* #92 탐색 보상 — 속성 교차 공격기 획득·교체 (v0.4.4 §2) 헤드리스 회귀 — node demo/test/smoke_cross_skill.js [demo/index.html]
   범위:
     A. 데이터 — 공격기 12종 el·tier, 후보 목록(타 3속성 × 3계열 − 장착)
     B. 탐색 흐름(실제 search 액션 경로) — 후보 1종·rand 1회·슬롯0/1 교체·유지·쿨 승계·비공개 복귀·로그 generic
     C. AI 교체 정책 — 방어/지속형 효과기 보존 → 최저 위력 슬롯 → 후보 위력 ≥ 슬롯 위력, 결정론
     D. 전투 판정 — 공격 상성·상태 종류·감전 확률·플래시는 기술 속성, 방어 상성·기본 공격·시그니처·잔류장·레거시는 본체 속성, 부가효과 유지
     E. UI — 소유자 화면 속성 표시·설명, 상대 화면 ?공격기, 사이드 패널, 로스터 팝업 불변, 제품 문구에 개발 용어 없음
     F. 포획 승계 — 실제 4슬롯 복사(참조 비공유)·쿨0·공개[]·수치 공용 규격·레거시 템플릿 폴백·중립 포획 불변 (AC9)
     G. 다른 분기 불변 — 동료·왕 recruit, 다른 이벤트 5종, AI 동료 포획
     H. 온라인 2인스턴스 락스텝(연결 소켓 스텁) — 후보·seq·skills·cds·rand 일치, 비소유자 화면 마스킹, 포획 승계 양측 일치·송신 0, 음성 대조
     I. 정보 경계 — 상대 인스턴스 DOM 어디에도 새 기술 이름·표시 없음, 사용 후에만 공개
     J. AI vs AI 완주(recruit 강제)·불변식 0 · K. 기준판(d614392) 같은 시드 대조(학습 없는 경기 완전 일치) · L. 메모리 변형 음성 대조
   파일 쓰기 0 (기준판·변형은 메모리 로드). */
"use strict";
const H=require("./harness"), path=require("path"), {execFileSync}=require("child_process");
const htmlPath=process.argv[2]||path.join(__dirname,"..","index.html");
const BASE_REF=process.env.BASE_REF||"d614392";
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
const J=x=>JSON.stringify(x);
function giveSpecies(T,m,r){ m.rosterId=r.id; m.name=r.name; m.element=r.element; m.hp=r.hp; m.maxHp=r.hp; m.atk=r.atk; m.skillAtk=r.skill; m.cdMax=r.cd; m.skills=T.archSkills(r.arch,r.element); m.cds=[0,0,0,0]; m.revealedSkills=[]; }
const R=(T,id)=>T.ROSTER.find(r=>r.id===id);
/* 표준 판: 내 하수인(12,4)·상대 하수인(11,4)·왕 둘, 볼 3·예비 없음 */
function setup(T,mode){
  H.freshPlay(T,mode||"pvp"); H.clearBoard(T);
  const me=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), em=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  const k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  const ally0=T.S.pieces.find(x=>x.owner===0&&x.type==="ally");
  H.place(T,k0,13,1); H.place(T,k1,1,7); H.place(T,me,12,4); H.place(T,em,11,4);
  T.S.balls=[3,3]; T.S.reserve=[null,null]; T.S.inv=[[],[]]; T.TQ.length=0;
  return {me,em,k0,k1,ally0};
}
/* 실제 사용자 경로: 말 아래 recruit 이벤트 + 흔적 → 선택 → search 액션(netAction) */
function recruitAt(T,p,kind){
  T.byId("obBtns").children.length=0; // 하네스 스텁은 모달마다 버튼이 누적되므로 새 모달 전에 비운다 (제품은 innerHTML 로 교체)
  T.S.current=p.owner; T.S.mainUsed=false; T.S.battlesUsed=0;
  T.S.events=[{r:p.r,c:p.c,kind:kind||"recruit",consumed:false}]; T.S.traces[p.owner].add(p.r+"_"+p.c);
  T.S.selected=p; T.netAction({t:"search"});
}
const ob=T=>T.byId("overlayBox").innerHTML, hidden=T=>T.byId("overlay").classList.contains("hidden");
const btns=T=>(T.byId("obBtns").children||[]).map(b=>b.textContent);
const click=(T,txt)=>{ const b=(T.byId("obBtns").children||[]).slice().reverse().find(x=>x.textContent===txt); if(!b) throw new Error("버튼 없음: "+txt+" / "+J(btns(T))); b.onclick(); };
/* rand 소비 횟수 — 시드 고정 후 fn 실행, 다음 rand 가 몇 번째 값인지로 역산 */
function randConsumed(T,seed,fn,max){ T.setSeed(seed); const seq=[]; for(let i=0;i<(max||12);i++) seq.push(T.rand()); T.setSeed(seed); fn(); const n=T.rand(); const k=seq.indexOf(n); T.setSeed(null); return k; }
function openBattle(T,a,d){ T.S.battle=null; T.S.battlesUsed=0; a.hp=a.maxHp; d.hp=d.maxHp; a.cds=[0,0,0,0]; d.cds=[0,0,0,0]; a.cd=0; d.cd=0; a.shield=0; d.shield=0; a.burn=0; d.burn=0; a.shock=0; d.shock=0; a.weaken=0; d.weaken=0; T.TQ.length=0; T.startRounds(a,d,a,d); T.TQ.length=0; }
/* 하네스는 load()마다 전역 setTimeout 을 그 로드의 TQ 로 갈아끼운다 — 여러 로드가 살아 있을 때 시뮬을 돌릴 로드로 타이머를 되돌린다 */
const useTimers=X=>{ global.setTimeout=fn=>{ X.TQ.push(fn); return 0; }; };
const fixed=(T,v)=>{ T.BAL.dmgVar=0; T.BAL.statusProb=v===undefined?1:v; T.BAL.shockProb=v===undefined?1:v; };

const T=H.load(htmlPath);

/* ===== A. 데이터 ===== */
{
  const atk=Object.keys(T.SKILLS).filter(k=>T.SKILLS[k].kind==="attack");
  ok(atk.length===12&&atk.every(k=>T.SKILLS[k].el===k.split("_")[0]&&T.SKILLS[k].tier===k.split("_")[1]&&T.ELEMS.includes(T.SKILLS[k].el)),"A1 공격기 12종 el=키 접두사·tier=키 접미사");
  ok(Object.keys(T.SKILLS).filter(k=>T.SKILLS[k].kind!=="attack").every(k=>T.SKILLS[k].el===undefined&&T.SKILLS[k].tier===undefined),"A2 보조기·시그니처에는 el 없음 (본체 속성 규칙 유지)");
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1"));
  const c=T.recruitCandidates(P.me);
  ok(c.length===9&&c.every(k=>T.SKILLS[k].kind==="attack"&&T.SKILLS[k].el!=="fire")&&J(c)===J(["water_stable","water_effect","water_heavy","grass_stable","grass_effect","grass_heavy","lightning_stable","lightning_effect","lightning_heavy"]),"A3 불 표준형 후보 9종 = 물·풀·번개 × 안정·효과·고위력 (순서 고정)");
  P.me.skills[0]="water_stable"; P.me.skills[1]="grass_heavy";
  const c2=T.recruitCandidates(P.me);
  ok(c2.length===7&&!c2.includes("water_stable")&&!c2.includes("grass_heavy")&&!c2.some(k=>k.startsWith("fire_")),"A4 이미 장착한 타 속성 공격기는 후보에서 제외 (7종)·본체 속성은 항상 제외");
  ok(T.atkElOf(P.me,T.SKILLS.water_stable)==="water"&&T.atkElOf(P.me,T.SKILLS.sig_atk)==="fire"&&T.atkElOf(P.me,T.SKILLS.sup_heal)==="fire"&&T.atkElOf(P.me,null)==="fire","A5 판정 속성: 공격기=기술 속성, 시그니처·보조기·기본 공격=본체 속성");
  ok(T.skillNameKo("water_stable","fire")==="💧물대포"&&T.skillNameKo("fire_stable","fire")==="화염탄"&&T.skillNameKo("sig_atk","fire")==="결정타","A6 표시 이름: 본체와 다른 속성의 공격기만 속성 이모지 접두");
}

/* ===== B. 탐색 흐름 (사람·핫시트 PVP, 실제 search 액션) ===== */
{
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1")); giveSpecies(T,P.em,R(T,"M-W1"));
  const cands=T.recruitCandidates(P.me);
  // 후보 = 공유 rand 1회: 시드의 첫 난수로 결정, 두 번째 난수는 소비되지 않는다
  T.setSeed(92001); const r1=T.rand(), next=T.rand(); const expect=cands[Math.floor(r1*cands.length)];
  T.setSeed(92001); P.me.cds=[2,1,0,0]; P.me.revealedSkills=[0,1]; recruitAt(T,P.me);
  const html=ob(T), sk=T.SKILLS[expect];
  ok(T.S.events[0].consumed&&T.S.mainUsed&&!hidden(T),"B1 하수인 recruit 소비: 이벤트 소모·주 행동 소모·모달 열림");
  ok(J(btns(T))===J(["공격기 1과 교체","공격기 2와 교체","유지"]),"B2 버튼 3개: 공격기 1 교체 / 공격기 2 교체 / 유지");
  ok(html.includes(sk.ko)&&html.includes(T.ELEM_KO[sk.el])&&html.includes(T.SKILL_TIER_KO[sk.tier])&&html.includes(sk.desc)&&html.includes("위력 "+T.dmgRange(T.slotPow(P.me,sk)))&&html.includes("쿨 "+sk.cd),"B3 모달에 후보의 이름·속성·계열·위력 범위·쿨·효과 표시 ("+expect+")");
  ok(html.includes("화염탄")&&html.includes("잔불 표식")&&html.includes("(남은 쿨 2)")&&html.includes("(남은 쿨 1)")&&html.includes(T.ELEM_KO.fire),"B4 현재 공격기 1·2의 이름·속성·남은 쿨을 나란히 비교");
  ok(T.rand()===next,"B5 후보 굴림은 rand 정확히 1회 (재굴림·shuffle 없음)");
  ok(!T.S.log.some(l=>l.msg.includes(sk.ko))&&T.S.log.some(l=>/숲 이벤트 발생/.test(l.msg))&&!T.S.log.some(l=>/교체|기술/.test(l.msg)),"B6 보드 로그는 generic '숲 이벤트 발생'만 — 후보·교체 정보 없음");
  const before=P.me.skills.slice();
  click(T,"공격기 1과 교체");
  ok(P.me.skills[0]===expect&&P.me.skills[1]===before[1]&&P.me.skills[2]===before[2]&&P.me.skills[3]===before[3],"B7 공격기 1 교체: skills[0]=후보, 나머지 슬롯 불변");
  ok(J(P.me.cds)===J([2,1,0,0]),"B8 교체 슬롯의 남은 쿨 승계 (cds[0]=2 유지, 초기화 없음)");
  ok(J(P.me.revealedSkills)===J([1])&&hidden(T),"B9 교체 슬롯은 공개 기록에서 제거([0,1]→[1])·모달 닫힘");
  // 두 번째 탐색: 공격기 2 교체 — 두 슬롯 모두 타 속성 허용
  T.setSeed(92002); recruitAt(T,P.me);
  const c2=T.recruitCandidates(P.me); T.setSeed(92002); const e2=c2[Math.floor(T.rand()*c2.length)];
  ok(!c2.includes(expect)&&e2!==expect&&T.SKILLS[e2].el!=="fire","B10 두 번째 후보는 이미 배운 기술 제외·타 속성");
  click(T,"공격기 2와 교체");
  ok(P.me.skills[1]===e2&&P.me.skills[0]===expect&&J(P.me.cds)===J([2,1,0,0])&&J(P.me.revealedSkills)===J([]),"B11 공격기 2 교체: 두 공격 슬롯 모두 타 속성·쿨 승계·공개 기록 []");
  // 세 번째: 유지 — 이벤트는 소모, 아무 것도 안 바뀜
  const snap=J([P.me.skills,P.me.cds,P.me.revealedSkills]);
  T.setSeed(92003); recruitAt(T,P.me); click(T,"유지");
  ok(J([P.me.skills,P.me.cds,P.me.revealedSkills])===snap&&T.S.events[0].consumed&&T.S.mainUsed&&hidden(T),"B12 유지: 기술·쿨·공개 불변, 이벤트 칸·주 행동은 소모");
  ok(P.me.skills[2]==="sup_heal"&&P.me.skills[3]==="sig_std","B13 보조기(2)·시그니처(3)는 교체 대상 아님");
  // 후보 전수: 200시드에서 후보는 항상 목록 안·미장착·타 속성
  let all=true; for(let s=1;s<=200;s++){ const Q=setup(T); giveSpecies(T,Q.me,R(T,["M-F1","M-W2","M-G3","M-L4","M-F5"][s%5])); Q.me.skills[0]=T.recruitCandidates(Q.me)[s%9]; const cs=T.recruitCandidates(Q.me);
    T.setSeed(s); const e=cs[Math.floor(T.rand()*cs.length)]; T.setSeed(s); recruitAt(T,Q.me); const h=ob(T);
    if(!(h.includes(T.SKILLS[e].ko)&&cs.includes(e)&&!Q.me.skills.includes(e)&&T.SKILLS[e].el!==Q.me.element&&T.SKILLS[e].kind==="attack")) all=false; click(T,"유지"); }
  ok(all,"B14 200시드 전수: 후보는 항상 타 속성 공격기·미장착·모달 표시 일치 (5종 아키타입)");
  // 레거시(기술 배열 없음) 하수인: 예외 없이 이벤트만 소모
  const L=setup(T); L.me.skills=null; L.me.rosterId=null; L.me.element="fire"; L.me.revealedSkills=null;
  let err=null; try{ recruitAt(T,L.me); }catch(e){ err=e; }
  ok(!err&&L.me.skills===null&&T.S.events[0].consumed,"B15 기술 배열 없는 레거시 하수인은 예외 없이 이벤트만 소모");
  T.setSeed(null);
}

/* ===== C. AI 교체 정책 ===== */
{
  const P=setup(T,"sim");
  const pol=(rid,alt,pre)=>{ giveSpecies(T,P.me,R(T,rid)); if(pre) Object.assign(P.me,{skills:pre}); return T.aiRecruitSlot(P.me,alt); };
  ok(pol("M-F1","water_stable")===1&&pol("M-F1","grass_effect")===-1&&pol("M-F1","lightning_heavy")===1,"C1 표준형(안정26·효과22): 최저 위력 슬롯1(효과기) — 후보 26·34 교체, 20 유지");
  ok(pol("M-F3","water_heavy")===-1&&pol("M-F3","grass_heavy")===-1&&pol("M-F3","lightning_stable")===-1,"C2 방어형 불(효과22·고위력38): 효과기 보존 → 고위력 슬롯만 후보, 38 미만은 모두 유지");
  ok(pol("M-W3","fire_heavy")===1&&pol("M-W3","grass_heavy")===1&&pol("M-W3","fire_effect")===-1,"C3 방어형 물(효과22·고위력32): 고위력 38·34 후보는 슬롯1 교체, 효과기 22 는 보존 슬롯이라 유지");
  ok(pol("M-L5","fire_heavy")===1&&pol("M-L5","water_heavy")===-1&&pol("M-L5","fire_effect")===-1,"C4 지속형 번개(효과22·고위력34): 효과기 보존·고위력 슬롯만 — 38 교체, 32·22 유지");
  ok(pol("M-F2","water_stable")===0&&pol("M-F2","grass_effect")===-1&&pol("M-F2","lightning_heavy")===0,"C5 공격형(안정26·고위력38): 최저 위력 슬롯0(안정) — 26·34 교체, 22 유지");
  ok(pol("M-F4","water_stable")===1&&pol("M-F4","water_stable",["fire_stable","water_stable","sup_cool","sig_swift"])===0,"C6 속공형: 슬롯1(효과22) 교체 → 두 슬롯이 26 동률이면 앞 슬롯0");
  ok(pol("M-F3","water_stable",["fire_effect","grass_effect","sup_guard","sig_def"])===-1,"C7 방어형: 두 공격 슬롯이 모두 효과기(타 속성 효과기 포함)면 교체 가능 슬롯 없음 → 유지(-1)");
  // 실제 doSearch(AI) 경로 — 같은 시드 같은 결과, rand 는 후보 굴림 1회만
  giveSpecies(T,P.me,R(T,"M-F1")); const cands=T.recruitCandidates(P.me);
  const run=(seed)=>{ giveSpecies(T,P.me,R(T,"M-F1")); P.me.cds=[1,2,0,0]; P.me.revealedSkills=[0,1]; const k=randConsumed(T,seed,()=>recruitAt(T,P.me)); return {k,skills:P.me.skills.slice(),cds:P.me.cds.slice(),rev:P.me.revealedSkills.slice()}; };
  let det=true, swapped=0, kept=0, randOk=true;
  for(let s=1;s<=60;s++){ const a=run(1000+s), b=run(1000+s); if(J(a)!==J(b)) det=false; if(a.k!==1) randOk=false;
    T.setSeed(1000+s); const e=cands[Math.floor(T.rand()*cands.length)]; const exp=T.aiRecruitSlot({skills:T.archSkills("std","fire"),rosterId:"M-F1",element:"fire"},e);
    if(exp>=0){ swapped++; if(!(a.skills[exp]===e&&a.cds[exp]===[1,2][exp]&&!a.rev.includes(exp))) det=false; } else { kept++; if(J(a.skills)!==J(T.archSkills("std","fire"))||J(a.rev)!==J([0,1])) det=false; } }
  ok(det&&swapped>0&&kept>0,"C8 AI 탐색 60시드: 같은 시드 같은 결과·정책과 일치·쿨 승계·공개 제거 (교체 "+swapped+"·유지 "+kept+")");
  ok(randOk,"C9 AI 경로 rand 소비는 후보 굴림 1회뿐 (정책은 난수 미사용)");
  T.setSeed(null);
}

/* ===== D. 전투 판정 ===== */
{
  const P=setup(T); fixed(T);
  const dmg=(a,d,slot)=>{ openBattle(T,a,d); const h0=d.hp; T.execSlot("A",slot); return h0-d.hp; };
  giveSpecies(T,P.me,R(T,"M-F1")); giveSpecies(T,P.em,R(T,"M-W1"));
  P.me.skills[1]="lightning_effect";
  ok(dmg(P.me,P.em,1)===29&&P.em.shock===1&&P.em.burn===0&&T.S.battle.blog.some(l=>/감전 — 다음 1라운드 후공/.test(l))&&!T.S.battle.blog.some(l=>/화상/.test(l)),"D1 불 본체의 감전 침 → 물 상대: 22×1.3=29 (강상성)·감전 부여·화상 아님 (AC3)");
  P.me.skills[1]="fire_effect";
  ok(dmg(P.me,P.em,1)===17&&P.em.burn===T.BAL.burnRounds&&P.em.shock===0,"D1b 대조: 같은 불 본체의 잔불 표식 → 물: 22×0.75=17 (약상성)·화상");
  giveSpecies(T,P.em,R(T,"M-G1")); P.me.skills[1]="lightning_effect";
  ok(dmg(P.me,P.em,1)===17&&P.em.shock===1,"D2 불 본체의 감전 침 → 풀 상대: 번개는 풀에 약상성 17 (본체 불이면 29였을 값)");
  // 방어 상성은 본체 속성: 물 상대가 (번개 기술을 배운) 불 본체를 때리면 ×1.3
  giveSpecies(T,P.em,R(T,"M-W1"));
  ok(dmg(P.em,P.me,0)===34,"D3 물대포(26) → 번개 기술 배운 불 본체: 26×1.3=34 — 방어는 본체 속성 (AC3 후반)");
  giveSpecies(T,P.em,R(T,"M-G1"));
  ok(dmg(P.em,P.me,0)===20,"D3b 덩굴 채찍(26) → 불 본체: 26×0.75=20");
  // 상태 확률: 배운 감전 침은 shockProb, 배운 잔불 표식은 statusProb
  giveSpecies(T,P.em,R(T,"M-W1"));
  Object.assign(T.BAL,{statusProb:1,shockProb:0}); dmg(P.me,P.em,1); // 확률 경로 분리 검사 (감전만 0) — 결정론 고정이 아님
  ok(P.em.shock===0&&T.S.battle.blog.includes("상태이상 부여 실패!"),"D4a 배운 감전 침은 shockProb(0)를 읽는다 — statusProb 1 이어도 실패");
  T.BAL.statusProb=0; T.BAL.shockProb=1; dmg(P.me,P.em,1);
  ok(P.em.shock===1,"D4b shockProb 1·statusProb 0 → 감전");
  giveSpecies(T,P.me,R(T,"M-W1")); P.me.skills[1]="fire_effect"; giveSpecies(T,P.em,R(T,"M-G1"));
  Object.assign(T.BAL,{statusProb:1,shockProb:0}); dmg(P.me,P.em,1); // 확률 경로 분리 검사 (감전만 0) — 결정론 고정이 아님
  ok(P.em.burn===T.BAL.burnRounds&&P.em.weaken===0,"D4c 물 본체가 배운 잔불 표식: statusProb 로 화상(약화 아님), shockProb 무관");
  T.BAL.statusProb=0; dmg(P.me,P.em,1);
  ok(P.em.burn===0&&T.S.battle.blog.includes("상태이상 부여 실패!"),"D4d statusProb 0 → 화상 실패");
  // 부여율: 기본 확률에서 배운 감전 침 45~55%, 배운 잔불 표식 65~75% (분산 난수 1회 + 판정 1회)
  T.BAL.statusProb=0.7; T.BAL.shockProb=0.5; T.BAL.dmgVar=0.2;
  const rate=(a,d,slot,N,base,pred)=>{ let hit=0, cons={}; for(let i=0;i<N;i++){ openBattle(T,a,d); const k=randConsumed(T,base+i,()=>T.execSlot("A",slot)); cons[k]=(cons[k]||0)+1; if(pred(d)) hit++; } return {rate:hit/N,cons}; };
  giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[1]="lightning_effect"; giveSpecies(T,P.em,R(T,"M-W1"));
  let r=rate(P.me,P.em,1,1000,50000,o=>o.shock===1);
  ok(r.rate>=0.45&&r.rate<=0.55&&Object.keys(r.cons).join(",")==="2","D5 배운 감전 침 1000회 부여율 "+(r.rate*100).toFixed(1)+"% (45~55%) · rand 2회(분산+판정)");
  giveSpecies(T,P.me,R(T,"M-L1")); P.me.skills[1]="fire_effect"; giveSpecies(T,P.em,R(T,"M-G1"));
  r=rate(P.me,P.em,1,1000,60000,o=>o.burn>0);
  ok(r.rate>=0.65&&r.rate<=0.75,"D5b 번개 본체가 배운 잔불 표식 1000회 화상 "+(r.rate*100).toFixed(1)+"% (65~75%)");
  // 잔류장: 본체 속성 100% 유지 — 공격 슬롯이 모두 타 속성이어도
  fixed(T,0);
  giveSpecies(T,P.me,R(T,"M-F5")); P.me.skills[0]="water_effect"; P.me.skills[1]="lightning_heavy"; giveSpecies(T,P.em,R(T,"M-G1"));
  const k5=randConsumed(T,777,()=>{ openBattle(T,P.me,P.em); T.execSlot("A",3); });
  ok(P.em.burn===T.BAL.burnRounds&&k5===0,"D6 불 지속형 잔류장: 공격 슬롯이 물·번개여도 본체 속성 화상 100%·판정 난수 0 (확률 키 0)");
  giveSpecies(T,P.me,R(T,"M-L5")); P.me.skills[0]="fire_effect"; openBattle(T,P.me,P.em); T.execSlot("A",3);
  ok(P.em.shock===1&&P.em.burn===0,"D6b 번개 지속형 잔류장: 슬롯0이 잔불 표식이어도 감전 100%");
  // 배운 공격기의 부가효과 유지
  fixed(T);
  giveSpecies(T,P.me,R(T,"M-F1")); giveSpecies(T,P.em,R(T,"M-W1"));
  P.me.skills[0]="grass_effect"; openBattle(T,P.me,P.em); P.me.hp=50; T.execSlot("A",0);
  ok(P.em.hp===100-20&&P.me.hp===58,"D7a 불 본체가 배운 흡수 새싹 → 물: 20(무상성)·실피해 40% 회복 8");
  P.me.skills[0]="grass_heavy"; openBattle(T,P.me,P.em); T.execSlot("A",0);
  ok(P.em.hp===100-34&&P.me.shield===10,"D7b 배운 가시 폭발: 34·자기 보호막 10");
  giveSpecies(T,P.em,R(T,"M-G1")); P.me.skills[0]="water_heavy"; openBattle(T,P.me,P.em); P.em.shield=20; T.execSlot("A",0);
  ok(P.em.hp===100-18&&P.em.shield===0&&T.S.battle.blog.some(l=>/보호막 대상 추가 위력 \+6/.test(l)),"D7c 배운 쇄도 파도 → 보호막 풀: 32+6=38, 흡수 20·HP 18");
  P.me.skills[0]="lightning_heavy"; openBattle(T,P.me,P.em); P.em.burn=2; T.execSlot("A",0);
  ok(P.em.hp===100-(Math.round(34*0.75)+6),"D7d 배운 연쇄 번개 → 화상 풀: 34×0.75=26 +6 = 32 (상성은 번개 기준)");
  // 기본 공격·시그니처는 본체 속성
  giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[0]="water_stable"; P.me.skills[1]="lightning_effect"; giveSpecies(T,P.em,R(T,"M-G1"));
  ok(dmg(P.me,P.em,-1)===29,"D8a 기본 공격(폴백)은 본체 불 기준: 22×1.3=29 (공격 슬롯이 물·번개여도)");
  giveSpecies(T,P.me,R(T,"M-F2")); P.me.skills[0]="water_stable"; P.me.skills[1]="lightning_heavy";
  ok(dmg(P.me,P.em,3)===59,"D8b 결정타(시그니처 40, atk25→45)는 본체 불 기준 45×1.3=59");
  giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[0]="water_stable"; openBattle(T,P.me,P.em); T.execSlot("A",3);
  ok(P.em.hp===100-Math.round(30*1.3),"D8c 전술 연계(30)도 본체 불 기준 39");
  // 플래시(속성 이펙트)는 판정 속성 — 실제 재생 환경을 흉내(msgBox nodeType) 내 boxShadow 기록
  const flashes=[]; const st=T.byId("bstage"); st.style=new Proxy({},{set(t,k,v){ if(k==="boxShadow"&&v) flashes.push(v); t[k]=v; return true; }}); T.byId("msgBox").nodeType=1;
  const liveOpen=(a,d)=>{ T.S.battle=null; T.S.battlesUsed=0; a.hp=a.maxHp; d.hp=d.maxHp; a.cds=[0,0,0,0]; d.cds=[0,0,0,0]; d.burn=0; d.shock=0; T.TQ.length=0; T.startRounds(a,d,a,d); T.drain(); flashes.length=0; }; // 재생 환경에서는 큐를 비우지 않고 끝까지 재생
  giveSpecies(T,P.me,R(T,"M-F1")); P.me.skills[1]="lightning_effect"; liveOpen(P.me,P.em); T.execSlot("A",1); T.drain();
  const f1=flashes.slice();
  liveOpen(P.me,P.em); T.execSlot("A",0); T.drain();
  ok(f1.some(v=>/var\(--lightning\)/.test(v))&&!f1.some(v=>/var\(--fire\)/.test(v))&&flashes.some(v=>/var\(--fire\)/.test(v)),"D9 속성 플래시: 배운 감전 침은 번개색, 화염탄은 불색");
  delete T.byId("msgBox").nodeType; T.byId("bstage").style={}; T.TQ.length=0;
  // 레거시(기술 배열 없음) 경로 불변: 본체 속성 스킬
  const L=setup(T); fixed(T); L.me.skills=null; L.me.rosterId=null; L.me.element="fire"; L.me.skillAtk=35; L.me.cd=0; L.me.revealedSkills=null; giveSpecies(T,L.em,R(T,"M-G1"));
  openBattle(T,L.me,L.em); global.__actCore("skill");
  ok(L.em.hp===100-46&&L.em.burn===T.BAL.burnRounds,"D10 레거시 속성 스킬 경로: 35×1.3=46·화상 — 본체 속성 그대로");
  // 사용 시 공개
  const Q=setup(T); giveSpecies(T,Q.me,R(T,"M-F1")); Q.me.skills[0]="water_stable"; giveSpecies(T,Q.em,R(T,"M-G1"));
  openBattle(T,Q.me,Q.em); T.execSlot("A",0);
  ok(J(Q.me.revealedSkills)===J([0])&&Q.me.cds[0]===0,"D11 배운 기술도 사용하면 그 슬롯이 공개되고 쿨은 기술 쿨(물대포 0)");
  fixed(T,0.7); T.BAL.shockProb=0.5; T.BAL.dmgVar=0.2; T.setSeed(null);
}

/* ===== E. UI ===== */
{
  const P=setup(T,"pvp"); giveSpecies(T,P.me,R(T,"M-F1")); giveSpecies(T,P.em,R(T,"M-W1")); P.me.skills[1]="lightning_effect";
  T.S.current=0; openBattle(T,P.me,P.em); let h=ob(T);
  ok(/>⚡감전 침 \d+~\d+<\/button>/.test(h)&&h.includes('title="50% 확률 감전(후공 1회) · 번개 속성으로 판정"'),"E1 소유자 전투 버튼: 타 속성 공격기는 속성 이모지 접두 + 설명에 판정 속성");
  ok(/>화염탄 \d+~\d+<\/button>/.test(h)&&h.includes('title="안정 공격기"')&&!h.includes("불 속성으로 판정"),"E1b 같은 속성 공격기 버튼·설명은 변경 없음");
  ok(h.includes("⚡감전 침")&&h.includes("화염탄 · ⚡감전 침 · 응급 치유 · 전술 연계"),"E1c 소유자 패널 기술 목록에도 속성 표시");
  // 상대 화면(PVE 뷰어 0): AI 상대 하수인이 배운 기술은 사용 전 ?공격기
  const Q=setup(T,"pve"); giveSpecies(T,Q.em,R(T,"M-W1")); Q.em.skills[1]="lightning_effect"; giveSpecies(T,Q.me,R(T,"M-G1"));
  T.S.current=1; openBattle(T,Q.em,Q.me); h=ob(T);
  const qb=(h.match(/<button[^>]*>\? [^<]+<\/button>/g)||[]).map(x=>x.replace(/<[^>]+>/g,""));
  ok(J(qb)===J(["? 공격기","? 공격기","? 보조기","? 시그니처"])&&!h.includes("감전 침")&&!h.includes("⚡감전")&&h.includes("?공격기 · ?공격기"),"E2 상대 화면: 배운 기술도 사용 전에는 '? 공격기'·패널 '?공격기'·이름 없음 (AC4)");
  ok(!/title="[^"]*감전/.test(h),"E2b 상대 화면 버튼 title 에도 설명 없음");
  T.execSlot("A",1); T.TQ.length=0; h=ob(T);
  ok(J(Q.em.revealedSkills)===J([1])&&h.includes("⚡감전 침")&&h.includes("?공격기 · ⚡감전 침"),"E3 상대가 사용한 뒤에만 그 슬롯이 공개되어 이름·속성 표시 (슬롯0은 여전히 ?공격기)");
  // 사이드 패널(자기 말 선택)
  T.S.battle=null; T.S.current=0; T.S.selected=Q.me; Q.me.skills[0]="fire_heavy"; T.render();
  ok(T.byId("sidePanel").innerHTML.includes("🔥폭염 강타 · 흡수 새싹"),"E4 사이드 패널 자기 말 기술 목록에 속성 표시");
  // 로스터 팝업은 템플릿 그대로
  T.rosterInfo("M-F1"); h=ob(T);
  ok(h.includes("화염탄")&&h.includes("잔불 표식")&&!h.includes("💧")&&!h.includes("⚡감전"),"E5 로스터 정보 팝업은 종 템플릿 그대로");
  // 제품 문구에 개발 용어 없음
  const W=setup(T,"pvp"); giveSpecies(T,W.me,R(T,"M-F1")); T.setSeed(5); recruitAt(T,W.me); h=ob(T);
  ok(!/\bslot\b|\bcds\b|revealedSkills|\bseq\b|lockstep|임시 대체|기획 확정|\brand\b|\bel\b/.test(h.replace(/class="[^"]*"/g,"")),"E6 교체 모달 문구에 개발 필드명·동기화 용어·임시 표기 없음");
  ok(h.includes("<h2>공용 하수인 발견</h2>")&&h.includes("남은 쿨타임을 이어받고")&&h.includes("다시 비공개"),"E7 모달 제목·규칙 안내(쿨 승계·비공개) 표시");
  click(T,"유지"); T.setSeed(null);
}

/* ===== F. 포획 승계 (AC9) ===== */
{
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1")); giveSpecies(T,P.em,R(T,"M-W1"));
  P.me.skills[0]="water_stable"; P.me.cds=[2,0,1,0]; P.me.revealedSkills=[0,1];
  T.S.current=1; openBattle(T,P.em,P.me); P.me.cds=[2,0,1,0]; T.finishByCapture("A"); T.TQ.length=0;
  const rv=T.S.reserve[1];
  ok(!!rv&&J(rv.skills)===J(["water_stable","fire_effect","sup_heal","sig_std"])&&rv.element==="fire","F1 교체된 물대포를 가진 불 하수인 포획 → 예비 skills[0]='water_stable'·element 'fire'");
  ok(J(rv.cds)===J([0,0,0,0])&&J(rv.revealedSkills)===J([])&&rv.hp===T.BAL.enemyCapHp&&rv.maxHp===100&&rv.atk===20&&rv.skillAtk===30&&rv.cdMax===2&&rv.cd===0&&rv.artRosterId==="M-F1"&&rv.rosterId===undefined,"F2 예비 하수인 쿨 전부 0·공개 []·HP 70/100·공용 스탯 20/30/CD2·외형 정체 유지·rosterId 없음");
  ok(rv.skills!==P.me.skills&&(rv.skills[0]="x",P.me.skills[0]==="water_stable")&&(P.me.skills[1]="y",rv.skills[1]==="fire_effect"),"F3 예비 skills 는 대상 배열과 참조 비공유 (한쪽 변경이 다른 쪽에 영향 없음)");
  ok(!P.me.alive&&T.S.battle===null,"F4 포획 종료: 대상 제거·전투 종료 (현행)");
  // 무교체 포획 회귀: 템플릿과 동일
  const Q=setup(T); giveSpecies(T,Q.me,R(T,"M-G2")); giveSpecies(T,Q.em,R(T,"M-W1"));
  T.S.current=1; openBattle(T,Q.em,Q.me); T.finishByCapture("A"); T.TQ.length=0; const r2=T.S.reserve[1];
  ok(J(r2.skills)===J(T.archSkills("atk","grass"))&&r2.skills!==Q.me.skills&&r2.artRosterId==="M-G2"&&r2.element==="grass","F5 교체 이력 없는 하수인 포획: skills 는 변경 전(아키타입 템플릿)과 동일·참조 비공유");
  // 레거시 대상(기술 배열 없음) → 템플릿 폴백
  const L=setup(T); L.me.skills=null; L.me.rosterId=null; L.me.element="fire"; giveSpecies(T,L.em,R(T,"M-W1"));
  T.S.current=1; openBattle(T,L.em,L.me); T.finishByCapture("A"); T.TQ.length=0; const r3=T.S.reserve[1];
  ok(J(r3.skills)===J(T.archSkills("std","fire"))&&r3.artRosterId===null,"F6 기술 배열 없는 레거시 대상은 표준형 템플릿 폴백·정체 null");
  // 중립 숲 포획 불변
  const N=setup(T); T.setSeed(4242); N.k0.cap=null; T.tryCapture(N.k0,"safe");
  ok(!!N.k0.cap&&J(N.k0.cap.skills)===J(T.archSkills("std",N.k0.cap.element))&&N.k0.cap.hp===100,"F7 숲 공용 포획은 속성 표준형 세트·100/100 그대로");
  // 예비 → 대리 출전: 승계한 물대포는 물 속성으로 판정
  const U=setup(T); fixed(T); giveSpecies(T,U.me,R(T,"M-F1")); U.me.skills[0]="water_stable"; giveSpecies(T,U.em,R(T,"M-W1"));
  T.S.current=1; openBattle(T,U.em,U.me); T.finishByCapture("A"); T.TQ.length=0;
  const em2=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x!==U.me); giveSpecies(T,em2,R(T,"M-F1")); H.place(T,em2,10,4);
  const ally1=T.S.pieces.find(x=>x.owner===1&&x.type==="ally"); H.place(T,ally1,9,4); ally1.cap=T.S.reserve[1]; T.S.reserve[1]=null;
  T.S.battle=null; T.S.battlesUsed=0; T.startRounds(ally1,em2,ally1.cap,em2); T.TQ.length=0; T.execSlot("A",0);
  ok(em2.hp===100-Math.round(Math.round(26*20/22)*1.3)&&ally1.cap.revealedSkills.includes(0),"F8 대리 출전한 예비 하수인의 물대포 → 불 상대: 물 판정 ×1.3 (24→31)");
  fixed(T,0.7); T.BAL.shockProb=0.5; T.BAL.dmgVar=0.2; T.setSeed(null);
}

/* ===== G. 다른 분기 불변 ===== */
{
  const P=setup(T); giveSpecies(T,P.me,R(T,"M-F1"));
  H.place(T,P.ally0,12,6); P.ally0.cap={element:"fire",hp:100,maxHp:100,atk:20,skillAtk:30,cd:0,cdMax:2,skills:T.archSkills("std","fire"),cds:[0,0,0,0],revealedSkills:[]};
  recruitAt(T,P.ally0); ok(ob(T).includes("이미 포획 하수인을 보유 중")&&J(btns(T))===J(["확인"]),"G1 동료(포획 보유) recruit → 보유 안내 (현행)"); click(T,"확인");
  P.ally0.cap=null; recruitAt(T,P.ally0); ok(/시도/.test(ob(T))&&/볼 2 · 성공/.test(ob(T)),"G2 동료(미보유) recruit → 포획 선택 모달 (현행)"); T.close();
  recruitAt(T,P.k0); ok(/시도/.test(ob(T)),"G3 왕 recruit → 포획 선택 모달 (현행)"); T.close();
  P.me.cds=[1,2,0,0]; recruitAt(T,P.me,"potion"); ok(J(P.me.cds)===J([0,0,0,0])&&ob(T).includes("이벤트 소모"),"G4 하수인 회복약 → 쿨 전체 초기화 (현행)"); click(T,"확인");
  recruitAt(T,P.k0,"potion"); ok(T.S.inv[0].includes("potion"),"G5 왕 회복약 → 아이템 획득 (현행)"); click(T,"확인");
  const b0=T.S.balls[0]; T.S.balls[0]=1; recruitAt(T,P.me,"ball"); ok(T.S.balls[0]===2,"G6 몬스터볼 +1 (현행)"); click(T,"확인"); T.S.balls[0]=b0;
  recruitAt(T,P.me,"buff"); ok(P.me.nextBattleBuff===true,"G7 일시 버프 (현행)"); click(T,"확인");
  const S2=setup(T,"sim"); H.place(T,S2.ally0,12,6); T.S.balls[0]=3; recruitAt(T,S2.ally0);
  ok(!!S2.ally0.cap&&T.S.balls[0]===1,"G8 AI 동료 recruit → 포획 시도(안전, 볼 2) (현행)");
}

/* ===== H. 온라인 2인스턴스 락스텝 ===== */
function mkNet(me){ const T=H.load(htmlPath); const P=setup(T,"pvp"); giveSpecies(T,P.me,R(T,"M-F1")); giveSpecies(T,P.em,R(T,"M-W1"));
  T.NET.mode=true; T.NET.me=me; T.NET.started=true;
  const ws=new T.WebSocketCtor("ws://127.0.0.1:8080/",[T.NET_PROTOCOL_MARKER,"qa-92-code"]); ws.readyState=1; T.NET.ws=ws; return {T,P,ws}; }
const lastFrame=X=>JSON.parse(X.ws.sent[X.ws.sent.length-1]);
const recv=(X,a)=>{ X.T.NET.queue.push(a); X.T.netPump(); };
const stateOf=X=>J({sk:X.P.me.skills,cds:X.P.me.cds,rev:X.P.me.revealedSkills,seq:X.T.NET.modalSeq,sync:X.T.NET.syncModal?X.T.NET.syncModal.seq:null,ev:X.T.S.events[0].consumed,main:X.T.S.mainUsed,hidden:hidden(X.T)});
{
  const A=mkNet(0), B=mkNet(1);
  for(const X of [A,B]){ X.T.setSeed(2026); X.P.me.cds=[2,1,0,0]; X.P.me.revealedSkills=[0,1]; }
  const cands=A.T.recruitCandidates(A.P.me); A.T.setSeed(2026); const alt=cands[Math.floor(A.T.rand()*cands.length)]; A.T.setSeed(2026);
  // 1P 실제 search 액션 → 송신 1 프레임 → 2P 수신 재생
  const s0=A.ws.sent.length; recruitAt(A.T,A.P.me);
  ok(A.ws.sent.length===s0+1&&J(lastFrame(A))===J({t:"a",a:{t:"search"}}),"H1 1P 탐색은 기존 search 락스텝 액션 1프레임만 송신 (신규 메시지 없음)");
  B.T.S.current=0; B.T.S.mainUsed=false; B.T.S.events=[{r:B.P.me.r,c:B.P.me.c,kind:"recruit",consumed:false}]; B.T.S.traces[0].add(B.P.me.r+"_"+B.P.me.c); B.T.S.selected=B.P.me;
  const b0=B.ws.sent.length; recv(B,lastFrame(A).a);
  ok(ob(A.T).includes(A.T.SKILLS[alt].ko)&&J(btns(A.T)).length>0&&A.T.NET.syncModal&&A.T.NET.syncModal.seq===1&&A.T.NET.syncModal.owner===0,"H2 1P(소유자): 후보 모달·seq 1");
  ok(B.T.NET.syncModal&&B.T.NET.syncModal.seq===1&&ob(B.T).includes("상대 선택 대기")&&!ob(B.T).includes(A.T.SKILLS[alt].ko)&&!hidden(B.T)&&B.ws.sent.length===b0,"H3 2P(비소유자): 같은 seq·대기 화면·후보 이름 없음·송신 0");
  ok(B.T.MEMO_UI.overlayOpen===true&&B.T.MEMO_UI.token===null&&(B.T.byId("obBtns").children||[]).length===0,"H3b 2P 잠금 화면도 코어 modal()을 지나간다 — #94 메모 피커 소유권(overlayOpen true·token null) 유지·버튼 0");
  // 1P 버튼 클릭(래핑된 onclick) → modal 프레임 송신 → 2P 재생 → 동일
  click(A.T,"공격기 1과 교체");
  const f=lastFrame(A); ok(J(f)===J({t:"a",a:{t:"modal",seq:1,i:0}}),"H4 1P 선택은 기존 modal 동기화 프레임(seq·버튼 인덱스)");
  recv(B,f.a);
  ok(stateOf(A)===stateOf(B)&&A.P.me.skills[0]===alt&&J(A.P.me.cds)===J([2,1,0,0])&&J(A.P.me.revealedSkills)===J([1])&&hidden(A.T)&&hidden(B.T),"H5 슬롯0 교체 후 양측 skills·cds·공개·seq 동일·모달 닫힘 (AC5)");
  ok(A.T.rand()===B.T.rand(),"H6 양측 공유 난수 상태 동일 (다음 rand 일치)");
  // 슬롯1 교체 · 유지 — 매번 양측 동일
  const step=(txt,i)=>{ for(const X of [A,B]){ X.T.byId("obBtns").children.length=0; X.T.S.current=0; X.T.S.mainUsed=false; X.T.S.events=[{r:X.P.me.r,c:X.P.me.c,kind:"recruit",consumed:false}]; X.T.S.traces[0].add(X.P.me.r+"_"+X.P.me.c); X.T.S.selected=X.P.me; }
    A.T.netAction({t:"search"}); recv(B,lastFrame(A).a); const seq=A.T.NET.syncModal.seq; click(A.T,txt); const fr=lastFrame(A); recv(B,fr.a); return {seq,fr}; };
  const s1=step("공격기 2와 교체");
  ok(s1.seq===2&&J(s1.fr.a)===J({t:"modal",seq:2,i:1})&&stateOf(A)===stateOf(B)&&A.P.me.skills[1]!=="fire_effect"&&A.T.SKILLS[A.P.me.skills[1]].el!=="fire"&&J(A.P.me.revealedSkills)===J([]),"H7 슬롯1 교체(seq 2·i 1): 양측 동일·두 슬롯 모두 타 속성");
  const before=stateOf(A); const s2=step("유지");
  ok(s2.seq===3&&J(s2.fr.a)===J({t:"modal",seq:3,i:2})&&stateOf(A)===stateOf(B)&&J(A.P.me.skills)===J(B.P.me.skills)&&J(A.P.me.skills)===J(JSON.parse(before).sk),"H8 유지(seq 3·i 2): 양측 동일·기술 불변");
  ok(A.T.rand()===B.T.rand()&&A.T.S.log.length===B.T.S.log.length,"H9 3회 탐색 뒤 난수·로그 길이 동일");
  // 포획 승계: 양측이 같은 대상 skills 를 보유 → finishByCapture 결과 동일·송신 0
  const cap=X=>{ X.T.S.current=1; X.T.S.mainUsed=false; X.T.S.battlesUsed=0; X.T.S.battle=null; X.T.startRounds(X.P.em,X.P.me,X.P.em,X.P.me); X.T.TQ.length=0; const n0=X.ws.sent.length; X.T.finishByCapture("A"); X.T.TQ.length=0; return {rv:X.T.S.reserve[1],sent:X.ws.sent.length-n0}; };
  const ca=cap(A), cb=cap(B);
  ok(J(ca.rv.skills)===J(cb.rv.skills)&&ca.rv.skills[0]===alt&&J(ca.rv.cds)===J([0,0,0,0])&&ca.sent===0&&cb.sent===0&&ca.rv.skills!==A.P.me.skills,"H10 포획 승계 양측 동일(교체 기술 포함)·쿨 0·송신 0·참조 비공유");
  // 음성 대조: 2P 가 modal 프레임을 재생하지 않으면 같은 검사기가 불일치를 잡는다
  const A2=mkNet(0), B2=mkNet(1); for(const X of [A2,B2]) X.T.setSeed(2027);
  recruitAt(A2.T,A2.P.me); B2.T.S.current=0; B2.T.S.mainUsed=false; B2.T.S.events=[{r:B2.P.me.r,c:B2.P.me.c,kind:"recruit",consumed:false}]; B2.T.S.traces[0].add(B2.P.me.r+"_"+B2.P.me.c); B2.T.S.selected=B2.P.me; recv(B2,lastFrame(A2).a);
  click(A2.T,"공격기 1과 교체");
  ok(stateOf(A2)!==stateOf(B2)&&B2.T.NET.syncModal&&!hidden(B2.T),"H11 [음성] 선택 프레임을 재생하지 않은 2P 는 skills·모달 상태가 달라 검사기가 잡는다");
  recv(B2,lastFrame(A2).a); ok(stateOf(A2)===stateOf(B2),"H12 프레임 재생 뒤 다시 일치");
  A.T.TQ.length=0; B.T.TQ.length=0; A2.T.TQ.length=0; B2.T.TQ.length=0;
  /* ===== I. 정보 경계 — 2P 인스턴스(B) DOM 전체에 1P 의 새 기술 이름·표시 없음 ===== */
  const alt2=A.P.me.skills[1];
  B.T.S.battle=null; B.T.S.current=1; B.T.S.selected=null; B.T.render();
  const leaks=[]; for(const [id,el] of Object.entries(B.T.els)){ const txt=(el._html||"")+"|"+(el.textContent||"")+"|"+Object.values(el._attrs||{}).join("|"); if(txt.includes(B.T.SKILLS[alt].ko)||txt.includes(B.T.SKILLS[alt2].ko)||/(💧|🌿|⚡)(물대포|침식 수류|쇄도 파도|덩굴 채찍|흡수 새싹|가시 폭발|전기탄|감전 침|연쇄 번개)/.test(txt)) leaks.push(id); }
  ok(leaks.length===0&&!B.T.S.log.some(l=>l.msg.includes(B.T.SKILLS[alt].ko)||l.msg.includes(B.T.SKILLS[alt2].ko)),"I1 2P DOM(모든 요소 innerHTML·text·속성)·로그에 1P 가 배운 기술 이름·속성 표시 없음"+(leaks.length?" — "+leaks.join(","):""));
  // 전투 개시 후 사용 전 ?공격기 · 사용 후 공개 — 2P 화면(NET.me=1)
  for(const X of [A,B]){ X.P.me.alive=true; X.P.me.placed=true; X.T.S.reserve=[null,null]; X.T.S.current=0; X.T.S.battlesUsed=0; X.T.S.battle=null; X.T.startRounds(X.P.me,X.P.em,X.P.me,X.P.em); X.T.TQ.length=0; }
  let hb=ob(B.T);
  ok(hb.includes("?공격기 · ?공격기")&&!hb.includes(B.T.SKILLS[alt].ko)&&(hb.match(/<button[^>]*>\? 공격기<\/button>/g)||[]).length===2,"I2 2P 전투 화면: 1P 하수인의 배운 기술은 사용 전 '?공격기'·'? 공격기'");
  for(const X of [A,B]) X.T.execSlot("A",0);
  for(const X of [A,B]) X.T.TQ.length=0;
  hb=ob(B.T);
  ok(J(B.P.me.revealedSkills)===J([0])&&hb.includes(B.T.skillNameKo(alt,"fire"))&&!hb.includes(B.T.SKILLS[alt2].ko),"I3 1P 가 슬롯0 을 쓴 뒤 2P 화면에 그 기술만 이름·속성 공개, 슬롯1은 여전히 비공개");
  ok(!B.T.S.log.some(l=>l.msg.includes(B.T.SKILLS[alt].ko)),"I4 보드 로그에는 여전히 기술 이름 없음 (전투 로그는 전투 모달 내부)");
}

/* ===== J. AI vs AI 완주 (recruit 강제) ===== */
{
  const Tj=H.load(htmlPath); let cross=0, done=0, viol=0, detail=[]; useTimers(Tj); // AI 전투 행동은 window.__act(최신 로드) 경유 → 시뮬은 최신 로드에서
  for(const [lv,seed] of [[["grade5","grade5"],9201],[["grade5","grade5"],9202],[["dan5","grade5"],9203],[["dan5","dan5"],9204]]){
    Tj.setSeed(seed); Tj.TQ.length=0; Tj.startMode("sim",{aiLevel:lv}); for(const e of Tj.S.events) e.kind="recruit";
    let n=0; while(Tj.TQ.length&&n<3000000){ Tj.TQ.shift()(); n++; if(n%50===0){ const v=H.invariants(Tj); if(v.length){viol++; detail.push(v.join(",")); break;} } }
    if(Tj.S.phase==="over") done++; detail.push(lv.join("/")+"#"+seed+":"+Tj.S.phase+"/"+Tj.S.turnCount+"턴");
    for(const p of Tj.S.pieces) if(p.type==="minion"&&p.skills&&p.skills.some(k=>Tj.SKILLS[k].el&&Tj.SKILLS[k].el!==p.element)) cross++;
  }
  ok(done===4&&viol===0,"J1 recruit 만 있는 판 4경기(5급·5단) 완주·불변식 위반 0 ("+detail.join(" · ")+")");
  ok(cross>0,"J2 완주한 경기들에서 AI 하수인이 실제로 타 속성 공격기를 배웠다 ("+cross+"기)");
  Tj.setSeed(null); Tj.TQ.length=0;
}

/* ===== K. 기준판 대조 — 학습이 없는 경기는 완전 일치 (git show 로 메모리 로드, 파일 쓰기 0) ===== */
{
  let baseHtml=null, err=null;
  try{ baseHtml=execFileSync("git",["show",BASE_REF+":demo/index.html"],{cwd:path.resolve(__dirname,"..",".."),maxBuffer:1<<26}).toString("utf8"); }catch(e){ err=e; }
  ok(!!baseHtml&&!err,"K0 기준판 "+BASE_REF+" 소스 로드 (git 읽기만)");
  if(baseHtml){
    const Tb=H.load(htmlPath,{html:baseHtml});
    ok(!/el:"fire",tier:"stable"/.test(Tb.html)&&Tb.recruitCandidates===undefined&&/\[임시 대체 — 기획 확정 전\]/.test(Tb.html),"K1 기준판에는 기술 속성·후보 함수가 없고 임시 보조기 교체가 있다 (대조가 공허하지 않음)");
    const play=(X,seed)=>{ useTimers(X); X.setSeed(seed); X.TQ.length=0; X.startMode("sim",{aiLevel:["grade5","grade5"]}); for(const e of X.S.events) if(e.kind==="recruit") e.kind="potion";
      let n=0; while(X.TQ.length&&n<3000000){ X.TQ.shift()(); n++; } return J({w:X.S.winner,t:X.S.turnCount,wt:X.S.metrics.winType,log:X.S.log.map(l=>l.msg),m:X.metricsSnapshot()}); };
    /* #106 (turn-flow) 이후 기준판 d614392 와의 완전 일치는 규칙 변경(회복 주 행동·함정+걸린 말 공개·남은 HP 비율 판정·폭탄 직접 접촉)으로 성립하지 않는다.
       대신 "첫 #106 사건이 일어나기 전까지"는 같은 시드에서 로그가 기준판과 완전히 같아야 한다 — 학습 없는 전투·AI·RNG 소비 순서가 그 밖에서는 바뀌지 않았다는 증거. */
    const IS106=typeof T.healTick==="function";
    let same=0, tot=0, turns=[], pre=0, preOk=0, firstEv=[];
    const EV=/회복 자세 시작|회복 행동|함정 발동|남은 HP 비율|폭탄 접촉|폭탄이 상대 폭탄|동료·왕끼리 접촉|도망 성공/;
    let repeat=0;
    for(const seed of [31,32,33,34,35]){ const a=play(Tb,seed), b=play(T,seed); tot++; if(a===b) same++; const B=JSON.parse(b), A=JSON.parse(a); turns.push(B.t);
      if(T.pushResolve&&b===play(T,seed)) repeat++;
      if(IS106){ const i=B.log.findIndex(l=>EV.test(l)); firstEv.push(i); if(i>0){ pre++; if(J(B.log.slice(0,i))===J(A.log.slice(0,i))) preOk++; } } }
    if(!IS106) ok(same===tot,"K2 recruit 없는 같은 시드 5경기: 기준판과 승자·턴·로그·지표 완전 일치 ("+same+"/"+tot+", 턴 "+turns.join("/")+") — 학습 없는 전투·AI·RNG 소비 무변경");
    else if(T.pushResolve) ok(repeat===tot,"K2 #114 현행 동일 시드 5경기 두 번: 승자·턴·전체 로그·지표 결정론 일치 ("+repeat+"/"+tot+") — VIP 평가/도망 후 밀기로 구판 AI와 RNG 경로가 달라지는 것은 승인 범위");
    else ok(pre===tot&&preOk===pre&&firstEv.every(i=>i>5),"K2 (#106 이후) 같은 시드 5경기: 첫 #106 규칙 사건 이전 로그 접두가 기준판과 완전 일치 ("+preOk+"/"+pre+", 첫 사건 로그 index "+firstEv.join("/")+", 턴 "+turns.join("/")+") — 그 밖의 전투·AI·RNG 소비 무변경");
    // 대조 확인: recruit 가 있으면 기준판(보조기 교체·shuffle)과 갈라진다
    const P=setup(T); const Pb=setup(Tb); for(const [X,Q] of [[T,P],[Tb,Pb]]){ giveSpecies(X,Q.me,R(X,"M-F1")); X.setSeed(11); }
    recruitAt(T,P.me); click(T,"공격기 1과 교체"); recruitAt(Tb,Pb.me); (Tb.byId("obBtns").children.find(b=>b.textContent==="교체")).onclick();
    ok(P.me.skills[0]!=="fire_stable"&&P.me.skills[2]==="sup_heal"&&Pb.me.skills[0]==="fire_stable"&&Pb.me.skills[2]!=="sup_heal"&&T.rand()!==Tb.rand(),"K3 recruit 에서는 새 판(공격기 교체·rand 1회)과 기준판(보조기 교체·shuffle)이 갈라진다 — 대조 하네스가 차이를 본다");
    Tb.TQ.length=0; T.TQ.length=0; T.setSeed(null);
  }
}

/* ===== L. 메모리 변형 음성 대조 — 계약을 어기는 변형을 메모리에서 로드해 위 검사기가 잡는지 ===== */
{
  const src=T.html;
  const mut=(name,from,to)=>{ if(!src.includes(from)) return {name,error:"변형 앵커 없음: "+from}; const M=H.load(htmlPath,{html:src.replace(from,to)}); M.BAL.aiDelay=0; return {name,M}; };
  const swapCheck=M=>{ const P=setup(M); giveSpecies(M,P.me,R(M,"M-F1")); P.me.cds=[2,1,0,0]; P.me.revealedSkills=[0,1]; M.setSeed(92001); recruitAt(M,P.me); click(M,"공격기 1과 교체"); return {cds:P.me.cds.slice(),rev:P.me.revealedSkills.slice(),sk:P.me.skills.slice()}; };
  let v=mut("no-skill-element",'return (sk&&sk.kind==="attack"&&sk.el)?sk.el:f.element;','return f.element;');
  if(v.M){ const P=setup(v.M); fixed(v.M); giveSpecies(v.M,P.me,R(v.M,"M-F1")); giveSpecies(v.M,P.em,R(v.M,"M-W1")); P.me.skills[1]="lightning_effect"; openBattle(v.M,P.me,P.em); v.M.execSlot("A",1);
    ok(P.em.hp===100-17&&P.em.burn>0&&P.em.shock===0,"L1 [음성] 판정 속성을 본체로 되돌리면 D1(29·감전) 검사기가 잡는다 (관측 "+(100-P.em.hp)+"·화상)"); } else ok(false,"L1 "+v.error);
  v=mut("cd-reset",'const swap=slot=>{p.skills[slot]=alt; if(p.revealedSkills)','const swap=slot=>{p.skills[slot]=alt; p.cds[slot]=0; if(p.revealedSkills)');
  if(v.M){ const r=swapCheck(v.M); ok(r.cds[0]===0,"L2 [음성] 교체 시 쿨 초기화 변형은 B8(쿨 승계) 검사기가 잡는다"); } else ok(false,"L2 "+v.error);
  v=mut("keep-revealed',",'if(p.revealedSkills) p.revealedSkills=p.revealedSkills.filter(i=>i!==slot);','');
  if(v.M){ const r=swapCheck(v.M); ok(J(r.rev)===J([0,1]),"L3 [음성] 공개 기록을 지우지 않는 변형은 B9 검사기가 잡는다"); } else ok(false,"L3 "+v.error);
  v=mut("reroll-shuffle",'cands[Math.floor(rand()*cands.length)]','shuffle(cands)[0]');
  if(v.M){ const P=setup(v.M); giveSpecies(v.M,P.me,R(v.M,"M-F1")); v.M.setSeed(92001); v.M.rand(); const next=v.M.rand(); v.M.setSeed(92001); recruitAt(v.M,P.me);
    ok(v.M.rand()!==next,"L4 [음성] shuffle 로 여러 번 굴리는 변형은 B5(rand 1회) 검사기가 잡는다"); } else ok(false,"L4 "+v.error);
  v=mut("capture-template",'skills:loseP.skills?loseP.skills.slice():archSkills(arch,el)','skills:archSkills(arch,el)');
  if(v.M){ const P=setup(v.M); giveSpecies(v.M,P.me,R(v.M,"M-F1")); giveSpecies(v.M,P.em,R(v.M,"M-W1")); P.me.skills[0]="water_stable"; v.M.S.current=1; openBattle(v.M,P.em,P.me); v.M.finishByCapture("A"); v.M.TQ.length=0;
    ok(v.M.S.reserve[1].skills[0]==="fire_stable","L5 [음성] 템플릿 재생성 변형은 F1(교체 기술 승계) 검사기가 잡는다"); } else ok(false,"L5 "+v.error);
  v=mut("capture-alias",'skills:loseP.skills?loseP.skills.slice():archSkills(arch,el)','skills:loseP.skills?loseP.skills:archSkills(arch,el)');
  if(v.M){ const P=setup(v.M); giveSpecies(v.M,P.me,R(v.M,"M-F1")); giveSpecies(v.M,P.em,R(v.M,"M-W1")); v.M.S.current=1; openBattle(v.M,P.em,P.me); v.M.finishByCapture("A"); v.M.TQ.length=0;
    ok(v.M.S.reserve[1].skills===P.me.skills,"L6 [음성] 참조 공유 변형은 F3(비공유) 검사기가 잡는다"); } else ok(false,"L6 "+v.error);
  v=mut("ai-ignore-pow",'return SKILLS[alt].pow>=SKILLS[p.skills[pick]].pow?pick:-1;','return 0;');
  if(v.M){ const P=setup(v.M,"sim"); giveSpecies(v.M,P.me,R(v.M,"M-F3")); ok(v.M.aiRecruitSlot(P.me,"water_stable")===0,"L7 [음성] 위력·보존 룰을 무시하는 AI 변형은 C2 검사기가 잡는다"); } else ok(false,"L7 "+v.error);
  // 전투 AI: 상태 키·기대 피해가 본체 속성으로 되돌아가면 5단 선택이 바뀐다 (결정론적 케이스)
  const aiPick=(M,skills,oppId,pre)=>{ const P=setup(M,"pve"); giveSpecies(M,P.me,R(M,"M-F1")); P.me.skills=skills; giveSpecies(M,P.em,R(M,oppId)); M.S.current=0; openBattle(M,P.me,P.em); if(pre) pre(P); M.setSeed(3); M.aiBattleActionStrong("A"); M.TQ.length=0; return P.me.revealedSkills[0]; };
  ok(aiPick(H.load(htmlPath),["fire_stable","lightning_effect","sup_heal","sig_def"],"M-F1",P=>{P.em.burn=2;})===1,"L8a 5단 AI: 불 본체 vs 불(화상 중) — 상태 키를 기술 속성(감전)으로 보면 감전 침 +4 로 슬롯1 선택");
  v=mut("ai-statuskey-body",'[atkElOf(f,sk)]; // 상태 키는 기술 속성 (#92)','[f.element];');
  if(v.M){ ok(aiPick(v.M,["fire_stable","lightning_effect","sup_heal","sig_def"],"M-F1",P=>{P.em.burn=2;})===0,"L8b [음성] 상태 키를 본체 속성으로 되돌리면 (이미 화상) +4 가 사라져 화염탄(슬롯0)을 고른다 — L8a 검사기가 잡는다"); } else ok(false,"L8b "+v.error);
  ok(aiPick(H.load(htmlPath),["fire_heavy","lightning_stable","sup_heal","sig_def"],"M-W1")===1,"L9a 5단 AI: 불 본체 vs 물 — 기대 피해를 기술 속성으로 보면 전기탄(26×1.3) > 폭염 강타(38×0.75) 로 슬롯1");
  v=mut("ai-mult-body",'multOf(atkElOf(f,sk))*(f.focusCharge','multOf(f.element)*(f.focusCharge');
  if(v.M){ ok(aiPick(v.M,["fire_heavy","lightning_stable","sup_heal","sig_def"],"M-W1")===0,"L9b [음성] 기대 피해를 본체 속성으로 계산하면 폭염 강타(슬롯0)를 고른다 — L9a 검사기가 잡는다"); } else ok(false,"L9b "+v.error);
  const pick5=(M,seeds)=>{ let s1=0; for(const sd of seeds){ const P=setup(M,"sim"); /* 5급 aiBattleAction() 은 인자 없이 actorOfPhase 의 소유자가 AI 일 때만 행동 → sim */ giveSpecies(M,P.me,R(M,"M-F1")); P.me.skills=["fire_heavy","lightning_stable","sup_heal","sig_def"]; giveSpecies(M,P.em,R(M,"M-W1")); M.S.current=0; openBattle(M,P.me,P.em); M.setSeed(sd); M.aiBattleAction(); M.TQ.length=0; if(P.me.revealedSkills[0]===1) s1++; } return s1/seeds.length; };
  const seeds=Array.from({length:60},(_,i)=>500+i); const r5=pick5(H.load(htmlPath),seeds);
  ok(r5>=0.6,"L9c 5급 AI(확률 혼합 포함) 60시드: 전기탄(기술 속성 ×1.3) 선택률 "+(r5*100).toFixed(0)+"% ≥ 60%");
  v=mut("ai5-mult-body",'const est=slotPow(f,sk)*multOf(atkEl)*(f.focusCharge','const est=slotPow(f,sk)*multOf(f.element)*(f.focusCharge');
  if(v.M){ const rm=pick5(v.M,seeds); ok(rm<=0.3,"L9d [음성] 5급 기대 피해를 본체 속성으로 되돌리면 전기탄 선택률 "+(rm*100).toFixed(0)+"% ≤ 30% — L9c 검사기가 잡는다"); } else ok(false,"L9d "+v.error);
  v=mut("mask-bypass-core",'_modalCore(`<h2>🔒 상대 선택 대기 중…</h2>','(x=>{ $("overlayBox").innerHTML=x; $("overlay").classList.remove("hidden"); })(`<h2>🔒 상대 선택 대기 중…</h2>');
  if(v.M){ const M=v.M; setup(M,"pvp"); M.NET.mode=true; M.NET.me=1; M.NET.started=true; M.S.current=0; M.MEMO_UI.overlayOpen=false; M.MEMO_UI.token={game:M.S};
    M.modal("<h2>x</h2>",[["ok",()=>{}]]);
    ok(M.MEMO_UI.overlayOpen!==true||M.MEMO_UI.token!==null,"L10 [음성] 잠금 화면이 코어 modal()을 우회하면(직접 innerHTML) H3b 검사기(overlayOpen true·token null)가 잡는다 (overlayOpen="+M.MEMO_UI.overlayOpen+" token="+(M.MEMO_UI.token?"유지":"null")+")"); } else ok(false,"L10 "+v.error);
  T.setSeed(null);
}

console.log(`\n=== smoke_cross_skill: pass ${pass} / fail ${fail} ===`);
if(fail){ console.error("실패: "+fails.join(" | ")); process.exit(1); }
