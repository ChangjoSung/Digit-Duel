/* #234 하수인 30종 · 전설 · 왕 · 동료 스킬 (GDD-23 6장 + 3.3~3.6 · 4.3 · 4.5 · 4.6 · 8.1 ②⑩⑮) 집중 회귀 —
   실행: node demo/test/regression/smoke_issue234.js [demo/index.html]
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).

   Issue #234 완료 조건(AC) ↔ 절
     AC1 데이터·실제 전투 연결   A (GDD 6.3 · 6.4 · 6.2 표를 이 파일에 **따로 옮겨 적고** 제품 데이터와 대조) · M (스킬 고유 동작을 실제 실행기로)
     AC2 등급 개방·전설·왕/동료 칸 B
     AC3 기본기·⌛ 증가 대상·페널티 예외 C
     AC4 AI 공정 관측           D
     과도기 경계(명세 3장)       E

   모든 검사는 실제 엔진 경로(execSlot → execV2 → resolveHit · nextPhase · finishBattle · __fleeCore)로 몰아서 본다.
   헬퍼 전용 대체물은 없다. 해석이 필요한 경계는 V2_INTERP(Venus 판정 · CJ 결정)를 따른다. */
"use strict";
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
const T=H.load(htmlPath);
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(got===want,name+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }

const realRandom=Math.random;
function fixRand(v){ T.setSeed(null); Math.random=()=>v; }
function unfix(){ Math.random=realRandom; T.setSeed(null); }

/* ===== GDD-23 표 사본 (이 파일 전용 — 제품 데이터에서 만들지 않았다) ===== */
const ARCHS=["std","atk","def","swift","sustain","guard"];
const GDD_GRID={ // 6.3 속성 × 아키타입
  fire:["새끼 화룡","화염 투사","용암 거북","불티 정령","재의 주술사","화산 딱정벌레"],
  water:["물방울 요정","심해 사냥꾼","빙벽 정령","안개 무희","파도 술사","방패 게"],
  lightning:["스파크","뇌격수","피뢰 골렘","번개 여우","전자기 술사","축전 해파리"],
  land:["바위 두더지","돌창 거인","철갑 코뿔소","모래 여우","고대 골렘","황토 아르마딜로"],
  grass:["새싹 파수꾼","가시 덩굴","고목 수호자","포자 요정","이끼 거인","방패 버섯"]
};
/* 6.3 종별 스킬 4개 — [1차, 2차, [3차 이름, 💪%|null, ⌛|"once"], [4차 …]] */
const GDD_SK={
  "새끼 화룡":["불씨 할퀴기","불씨 브레스",["달군 비늘",null,3],["성룡의 포효",100,4]],
  "화염 투사":["불꽃 주먹","화염 방사",["조준 사격",120,2],["폭발 연소",120,4]],
  "용암 거북":["등껍질 박치기","용암 박치기",["달궈진 껍질",null,3],["분화",80,4]],
  "불티 정령":["불티 튀기기","스치는 열기",["불꽃 표식",60,2],["꺼지지 않는 불티",130,3]],
  "재의 주술사":["재 뿌리기","재의 저주",["잿불 심기",null,2],["영겁의 재",null,"once"]],
  "화산 딱정벌레":["딱지 들이받기","용암 껍질",["열기 축적",null,3],["화산 폭발",100,4]],
  "물방울 요정":["물방울 톡","물방울 탄",["맑은 물",null,3],["거울 수면",80,4]],
  "심해 사냥꾼":["작살 찌르기","심해 작살",["잠영",null,3],["심연의 일격",150,4]],
  "빙벽 정령":["서리 조각","빙결 강타",["동결",60,3],["빙벽 반사",null,4]],
  "안개 무희":["물보라 발차기","물보라 스텝",["안개 걸음",null,3],["환영 무도",null,"once"]],
  "파도 술사":["물결 치기","파도의 저주",["밀물",60,2],["해일 예고",null,"once"]],
  "방패 게":["집게 찍기","거품 방패",["껍질 닫기",null,3],["집게 반격",null,4]],
  "스파크":["찌릿 박치기","스파크 샷",["충전",60,3],["연쇄 번개",100,4]], // #241 CJ 승인 Q1 충전 수정안: 💪🏻 60% · 감전 100% · 가하는 피해 +10%(2R)
  "뇌격수":["번개 주먹","뇌격 일섬",["번개 발도",160,2],["천둥 낙인",130,4]],
  "피뢰 골렘":["피뢰 주먹","피뢰 강타",["접지",null,3],["과부하 방벽",null,"once"]],
  "번개 여우":["번개 할퀴기","스파크 스침",["전광석화",70,2],["번개 꼬리",100,4]],
  "전자기 술사":["자력 튕기기","전자기 저주",["자기장",50,2],["영구 자기장",null,"once"]],
  "축전 해파리":["촉수 쏘기","전류막",["축전",null,3],["방전",120,4]],
  "바위 두더지":["흙 할퀴기","록 태클",["굴 파기",null,3],["지하 매복",230,4]],
  "돌창 거인":["돌 주먹","돌창 투척",["창 박기",110,2],["대지 관통",180,4]],
  "철갑 코뿔소":["뿔 들이받기","철갑 돌진",["강철 가죽",null,3],["철벽 돌파",null,4]],
  "모래 여우":["모래 할퀴기","모래 스침",["모래바람",60,2],["모래 폭풍",null,4]], // #241 CJ 결정 R4 모래바람: 💪🏻 60% · 회피율 −10%p(2R) · 자기 회피 +10%(1R)
  "고대 골렘":["돌덩이 내려치기","태고의 저주",["풍화",null,2],["태고의 각성",null,"once"]],
  "황토 아르마딜로":["몸통 굴리기","황토 껍질",["웅크린 공",null,3],["요새 전환",null,4]],
  "새싹 파수꾼":["새싹 치기","잎날 베기",["광합성",null,3],["성장 매듭",100,4]],
  "가시 덩굴":["가시 찌르기","가시 채찍",["뿌리 고정",100,3],["포식",160,4]],
  "고목 수호자":["가지 휘두르기","뿌리 강타",["나이테",null,3],["천년목",null,"once"]],
  "포자 요정":["포자 뿌리기","포자 스침",["수면 포자",null,3],["번식 포자",null,4]],
  "이끼 거인":["이끼 주먹","이끼 덮기",["이끼 흡혈",90,3],["이끼 잠식",null,4]],
  "방패 버섯":["갓 부딪기","버섯갓 방패",["포자 막",null,3],["균사 전환",null,4]]
};
/* 6.1 2차 골격 [💪%, 효과 확률, 감전 확률, ⌛, 자기 경화, 자기 방어막] */
const GDD_SKEL={std:[140,.70,.50,2,0,0],atk:[170,.50,.30,3,0,0],def:[120,.40,.30,2,.10,0],swift:[120,.40,.30,1,0,0],sustain:[110,1,1,2,0,0],guard:[110,.40,.30,2,0,.12]};
const GDD_ELFX={fire:"burn",water:"weaken",lightning:"shock",land:"crack",grass:"absorb"};
/* 6.4 · 3.6 전설 */
const GDD_LEG={
  dragon:{arch:"std",stats:[175,35,15,11,.05,.10,0],sk:[["용 발톱",100,0],["비늘 세우기",null,3],["날개 강타",140,2],["드래곤 숨결",140,3]]},
  witch:{arch:"sustain",stats:[165,32,12,13,.10,.05,.25],sk:[["저주 손짓",100,0],["독약 병",110,2],["변덕 주문",null,3],["마녀의 장난",80,3]]},
  reaper:{arch:"atk",stats:[158,40,8,14,.15,.20,0],sk:[["낫 베기",100,0],["영혼 수확",130,2],["죽음의 그림자",null,3],["사신의 낫",null,"seal"]]}
};
/* 6.2 왕 · 동료 */
const GDD_LEADER={
  king:{basic:"왕의 일격",pct:180,cd:3,p:{burn:.70,weaken:.70,shock:.50,crack:.70,absorb:.70},names:{fire:"파이어 볼",water:"물방울 던지기",lightning:"스파크 볼트",land:"락 스매시",grass:"리프 커터"}},
  assassin:{basic:"단검 찌르기",pct:200,cd:3,p:{burn:.30,weaken:.30,shock:.30,crack:.30,absorb:.30},names:{fire:"화염 단검",water:"급류 베기",lightning:"전격 찌르기",land:"암석 관통",grass:"맹독 가시"}},
  shield:{basic:"방패 치기",pct:120,cd:2,shield:.15,p:{burn:.40,weaken:.40,shock:.30,crack:.40,absorb:.40},names:{fire:"인화 방패",water:"조류 방패",lightning:"절연 방패",land:"대지 방패",grass:"가시 방패"}}
};
const SK=id=>T.SKILLS[id];
const rdOf=name=>T.ROSTER.find(r=>r.name===name);

/* ===== 전투 무대 — 실제 startRounds 로 연다 (smoke_issue233 과 같은 방식) ===== */
function arena(){
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const m=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"), e=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,m,7,4); H.place(T,e,6,4);
  H.place(T,T.S.pieces.find(x=>x.owner===0&&x.type==="king"),13,1);
  H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  return {m,e};
}
/* o.skills: 스킬 id 배열 · 기본 수치는 계산이 쉬운 중립값(공격 20 · 방어 0 · 회피 0 · 치명 0 · 무속성). A 가 선턴 */
function openBattle(A,D){
  const {m,e}=arena();
  const setup=(p,o)=>{ o=o||{}; p.hp=o.hp!==undefined?o.hp:100; p.maxHp=o.maxHp!==undefined?o.maxHp:100;
    p.atk=o.atk!==undefined?o.atk:20; p.def=o.def||0; p.spd=o.spd!==undefined?o.spd:10; p.dodge=o.dodge||0; p.crit=o.crit||0;
    p.statusPct=o.statusPct||0; p.grade=o.grade!==undefined?o.grade:1; p.element=o.element!==undefined?o.element:null;
    p.shieldStartPct=0; p.skills=o.skills||["M-F1-1"]; p.revealedSkills=[]; p.legend=o.legend||null; };
  setup(m,A); setup(e,D);
  T.S.battle=null; T.S.battlesUsed=0; T.TQ.length=0;
  T.startRounds(m,e,m,e); T.TQ.length=0;
  const B=T.S.battle; B.msgQ.length=0;
  return {B,a:B.fa,d:B.fd};
}
function act(side,slot){ const B=T.S.battle; B.phase=(B.firstSide===side)?0:1; T.execSlot(side,slot); T.TQ.length=0; if(T.S.battle) T.S.battle.msgQ.length=0; }
function endRound(){ const B=T.S.battle; if(!B) return; B.phase=1; T.nextPhase(); T.TQ.length=0; if(T.S.battle) T.S.battle.msgQ.length=0; }
function idx(f,id){ return f.skills.indexOf(id); }

/* ===================== A. AC1 — 데이터를 GDD 표와 대조 ===================== */
{
  eq(T.ROSTER.length,30,"A1 일반 하수인 30종");
  eq(new Set(T.ROSTER.map(r=>r.id)).size,30,"A1b 종 id 중복 없음");
  for(const el of Object.keys(GDD_GRID)) GDD_GRID[el].forEach((name,i)=>{
    const rs=T.ROSTER.filter(r=>r.element===el&&r.arch===ARCHS[i]);
    ok(rs.length===1&&rs[0].name===name,`A2 6.3 ${el}×${ARCHS[i]} = ${name} (실측 ${rs.map(r=>r.name)})`);
  });
  /* 3.3 ⭐1 ❤️·💪 */
  const HPATK={std:[100,22],atk:[90,25],def:[120,18],swift:[85,24],sustain:[95,20],guard:[110,19]};
  ok(T.ROSTER.every(r=>r.hp===HPATK[r.arch][0]&&r.atk===HPATK[r.arch][1]),"A3 3.3 아키타입 ⭐1 HP·공격력");
  let names=0, skel=0, hi=0;
  for(const r of T.ROSTER){
    const g=GDD_SK[r.name], ids=T.V2_SPECIES[r.id];
    ok(!!g&&Array.isArray(ids)&&ids.length===4,`A4 ${r.name} 스킬 4개 정의`); if(!g||!ids) continue;
    const s=ids.map(SK);
    if(s[0].ko===g[0]&&s[1].ko===g[1]&&s[2].ko===g[2][0]&&s[3].ko===g[3][0]) names++; else console.error("  이름 불일치",r.name,s.map(x=>x.ko));
    /* 1차 기본기 */
    ok(s[0].kind==="basic"&&s[0].pct===100&&s[0].cd===0&&!s[0].req&&!s[0].once&&!s[0].fx&&!s[0].st&&!s[0].selfAbsorb,`A5 ${r.name} 1차 = 기본기 💪100%·⌛0·조건·효과 없음`);
    /* 2차 골격 + 속성 효과 */
    const k=GDD_SKEL[r.arch], fx=GDD_ELFX[r.element], p=fx==="shock"?k[2]:k[1];
    const eff=fx==="absorb"?s[1].selfAbsorb===p&&!s[1].st:(s[1].st&&s[1].st.k===fx&&s[1].st.p===p);
    if(s[1].pct===k[0]&&s[1].cd===k[3]&&eff&&((s[1].selfHarden&&s[1].selfHarden.pct)||0)===k[4]&&(s[1].selfShield||0)===k[5]) skel++;
    else console.error("  2차 골격 불일치",r.name,JSON.stringify(s[1]));
    /* 3·4차 위력·⌛·전투당 1회 */
    let good=true;
    for(const j of [2,3]){ const [nm,pct,cd]=g[j], x=s[j];
      if((x.pct||null)!==pct) good=false;
      if(cd==="once"){ if(!x.once) good=false; } else if(x.cd!==cd||x.once) good=false; }
    if(good) hi++; else console.error("  3·4차 수치 불일치",r.name,s.slice(2).map(x=>[x.ko,x.pct,x.cd,x.once]));
  }
  eq(names,30,"A6 일반 120 스킬 이름이 6.3 표와 전부 일치 (30종 × 4)");
  eq(skel,30,"A7 2차 30개 = 6.1 아키타입 골격 + 속성 효과 (감전 예외 50/100/30 · 방어형 경화 10% · 보호형 방어막 12%)");
  eq(hi,30,"A8 3·4차 60개의 💪%·⌛·전투당 1회가 6.3 문구와 일치");
  eq(T.ROSTER.reduce((n,r)=>n+T.V2_SPECIES[r.id].length,0),120,"A9 일반 스킬 총 120개");
  /* 전설 12 스킬 · 스탯 21값 (3.6) */
  let lsk=0, lstat=0;
  for(const key of Object.keys(GDD_LEG)){ const L=T.LEGEND_ROSTER.find(x=>x.key===key), G=GDD_LEG[key];
    ok(!!L&&L.arch===G.arch,`A10 전설 ${key} 아키타입 ${G.arch}`); if(!L) continue;
    L.skills.forEach((id,i)=>{ const x=SK(id), [nm,pct,cd]=G.sk[i];
      const cdOk=cd==="seal"?(x.reaper===true):(x.cd===cd);
      if(x.ko===nm&&(x.pct||null)===pct&&cdOk&&x.neutral===true) lsk++; else console.error("  전설 스킬 불일치",key,i,x.ko,x.pct,x.cd); });
    const b=T.LEGEND_BASE[key]; const got=[b.hp,b.atk,b.def,b.spd,b.dodge,b.crit,b.statusPct];
    got.forEach((v,i)=>{ if(v===G.stats[i]) lstat++; });
  }
  eq(lsk,12,"A11 전설 12 스킬 이름·위력·⌛(사신의 낫 봉인형)·중립이 6.4 와 일치");
  eq(lstat,21,"A12 전설 스탯 21값(3종 × ❤️💪🛡️🏃💨🎯💫)이 3.6 표 그대로");
  eq(SK(T.LEGEND_ROSTER[0].skills[3]).kind==="basic"?0:SK("L-DRAGON-1").kind,"basic","A13 전설 1차도 기본기");
  /* 6.2 왕 · 동료 */
  let ld=0;
  for(const [kind,pre] of [["king","K"],["assassin","AS"],["shield","SH"]]){ const G=GDD_LEADER[kind];
    if(SK(pre+"-1").ko===G.basic&&SK(pre+"-1").kind==="basic"&&SK(pre+"-1").pct===100&&SK(pre+"-1").cd===0) ld++;
    for(const el of T.V2_ELEM_ORDER){ const x=SK(pre+"-2-"+el), fx=GDD_ELFX[el];
      const eff=fx==="absorb"?x.selfAbsorb===G.p[fx]:(x.st&&x.st.k===fx&&x.st.p===G.p[fx]);
      if(x.ko===G.names[el]&&x.pct===G.pct&&x.cd===G.cd&&eff&&(x.selfShield||0)===(G.shield||0)) ld++; else console.error("  왕·동료 2차 불일치",kind,el,JSON.stringify(x)); } }
  eq(ld,18,"A14 왕·암살자·방패병 기본기 3 + 속성 스킬 15가 6.2 표와 일치");
  ok(SK("LD-REVENGE").pct===220&&SK("LD-REVENGE").cd===2&&SK("LD-WRATH").pct===280&&SK("LD-WRATH").cd===2,"A15 5.3 동료의 복수 220%/⌛2 · 왕의 분노 280%/⌛2");
  /* 아트 과도기 (명세 3장) */
  eq(T.ART_DIRS.length,20,"A16 아트 허용 목록은 기존 20 폴더 그대로 — 새 경로 없음");
  ok(T.ROSTER.filter(r=>r.arch==="guard"||r.element==="land").every(r=>!T.ART_DIR_SET.has(r.element+"_"+r.arch)),"A17 보호형·땅 10종은 아트 목록 밖(이모지 폴백)");
  ok(T.ART_DIR_SET.has("water_def")&&T.ART_DIR_SET.has("grass_sustain"),"A18 이름만 바뀐 빙벽 정령·이끼 거인은 같은 속성·아키타입 폴더 재사용");
}

/* A19 — 132 + 왕·동료 스킬 전부가 **실제 실행기**로 한 번씩 돈다 (예외 없음 · ⌛ 적용 · 차례 진행) */
{
  const all=[];
  for(const r of T.ROSTER) all.push(...T.V2_SPECIES[r.id]);
  for(const L of T.LEGEND_ROSTER) all.push(...L.skills);
  for(const pre of ["K","AS","SH"]){ all.push(pre+"-1"); for(const el of T.V2_ELEM_ORDER) all.push(pre+"-2-"+el); }
  all.push("LD-REVENGE","LD-WRATH");
  let ran=0, errs=[];
  fixRand(0.5);
  for(const id of all){
    try{
      const x=SK(id);
      const {B,a,d}=openBattle({skills:["M-F1-1",id],element:"fire",statusPct:1},{skills:["M-F1-1","M-W3-2","M-L4-3"],hp:400,maxHp:400});
      if(x.req==="afterBurrow"){ a.burrowRound=1; B.round=2; }
      if(x.req==="round4") B.round=4;
      if(x.reaper){ B.round=6; a.hp=10; }
      const before=d.hp+(d.shield||0), aHp=a.hp, cdBefore=a.cds[1];
      act("A",1);
      /* #241 CJ 설계 R1: 번개 꼬리는 같은 턴 추가 공격 단계를 연다 — 차례 진행은 추가 공격(허용 슬롯 기본기)까지 끝나야 본다 */
      if(T.S.battle&&T.S.battle.bonus&&T.S.battle.bonus.stage==="active"){ act("A",0); }
      const moved=!T.S.battle||T.S.battle.phase===1||T.S.battle.round>B.round;
      const touched=(d.hp+(d.shield||0))!==before||a.hp!==aHp||(a.shield||0)>0||a.cds[1]!==cdBefore||JSON.stringify(a.onceUsed||{})!=="{}";
      if(moved&&touched) ran++; else errs.push(id+(moved?" 효과 흔적 없음":" 차례 미진행"));
    }catch(e){ errs.push(id+" 예외 "+e.message); }
  }
  unfix();
  if(errs.length) console.error("  ",errs.slice(0,10));
  eq(ran,all.length,`A19 스킬 ${all.length}개(일반 120 · 전설 12 · 왕·동료 17) 전부 실제 execSlot 경로로 실행·효과 흔적`);
}

/* ===================== B. AC2 — 등급 개방 · 전설 · 왕/동료 칸 ===================== */
{
  const {B,a}=openBattle({},{});
  const rd=rdOf("새끼 화룡");
  for(const g of [1,2,3,4]){ T.applySpecies(a,rd,g);
    ok(a.skills.length===g&&a.skills.every((id,i)=>id===T.V2_SPECIES[rd.id][i])&&a.cds.length===g,`B1 ⭐${g} = 1~${g}차 스킬 ${g}개`); }
  T.applySpecies(a,rd,4); ok(a.hp===145&&a.atk===29&&a.grade===4,"B2 ⭐4 표준형 = ❤️145 · 💪29 (3.4 예시)");
  T.applySpecies(a,rd,9); eq(a.skills.length,4,"B3 등급 상한 4 — 5칸 이상 열리지 않는다");
  /* 전설 */
  const L=T.applyLegend(a,"reaper");
  ok(L&&a.skills.length===4&&a.grade===5&&a.element===null&&a.legend==="reaper"&&T.archOf(a)==="atk"&&a.hp===158&&a.atk===40&&a.crit===0.20,"B4 사신 = ⭐5 고정·스킬 4개·무속성·공격형·3.6 스탯");
  T.applyLegend(a,"dragon"); ok(T.archOf(a)==="std",   "B5 용 = 표준형");
  T.applyLegend(a,"witch");  ok(T.archOf(a)==="sustain"&&a.statusPct===0.25,"B6 마녀 = 지속형 · 💫+25%p");
}
{ /* 새 게임: 모든 하수인 ⭐1(스킬 1개) · 왕 2칸 · 동료 2칸 · 속성 기본값 */
  H.freshPlay(T,"pvp");
  const ms=T.S.pieces.filter(x=>x.type==="minion");
  ok(ms.every(m=>m.grade===1&&m.skills.length===1&&T.SKILLS[m.skills[0]].kind==="basic"),"B7 경기 시작 하수인은 모두 ⭐1 — 1차 기본기 1개 (GDD 2.2)");
  const kings=T.S.pieces.filter(x=>x.type==="king"), allies=T.S.pieces.filter(x=>x.type==="ally");
  ok(kings.every(k=>k.skills.length===2&&k.skills[0]==="K-1"&&k.skills[1]==="K-2-"+k.element),"B8 왕 2칸 = 왕의 일격 + 본체 속성 스킬");
  ok(allies.every(x=>x.skills.length===2&&x.skills[0]===(x.allyKind==="shield"?"SH-1":"AS-1")),"B9 동료 2칸 = 기본기 + 본체 속성 스킬 (암살자·방패병 각각)");
  ok(new Set(allies.filter(x=>x.owner===0).map(x=>x.allyKind)).size===2,"B9b 동료 2명 = 암살자 1 · 방패병 1");
  for(const o of [0,1]){ const cnt={}; for(const m of ms.filter(x=>x.owner===o)) cnt[m.element]=(cnt[m.element]||0)+1;
    const want=T.V2_ELEM_ORDER.reduce((b,el)=>(cnt[el]||0)>(cnt[b]||0)?el:b,T.V2_ELEM_ORDER[0]);
    ok(T.S.pieces.filter(x=>x.owner===o&&(x.type==="king"||x.type==="ally")).every(x=>x.element===want),`B10 P${o+1} 왕·동료 속성 = 필드 하수인 최다 속성 ${want}`); }
}
{ /* B11 동률 순서 🔥 → 💧 → ⚡ → 🗻 → 🌿 */
  H.freshPlay(T,"pvp");
  const ms=T.S.pieces.filter(x=>x.owner===0&&x.type==="minion");
  const setEls=els=>{ ms.forEach((m,i)=>{ m.element=els[i]||null; }); return T.leaderDefaultElement(0); };
  eq(setEls(["grass","grass","land","land","water","lightning"]),"land","B11a 풀2·땅2 동률 → 땅(🗻 가 🌿 보다 앞)");
  eq(setEls(["water","lightning","land","grass","fire","water"]),"water","B11b 물2 단독 최다 → 물");
  eq(setEls(["lightning","water","grass","land","fire",null]),"fire","B11c 전부 1 동률 → 불");
  eq(setEls(["lightning","lightning","water","water","grass","grass"]),"water","B11d 물2·번개2·풀2 → 물");
}
{ /* B12 동료 사망 → 🪄 칸 추가 — 실제 finishBattle 경로 */
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const king=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), al=T.S.pieces.filter(x=>x.owner===0&&x.type==="ally");
  const em=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,king,13,1); H.place(T,al[0],12,3); H.place(T,al[1],12,5); H.place(T,em,11,3);
  H.place(T,T.S.pieces.find(x=>x.owner===1&&x.type==="king"),1,7);
  T.S.battlesUsed=0; T.startRounds(em,al[0],em,al[0]); T.TQ.length=0;
  T.finishBattle("A","검사"); T.TQ.length=0;
  ok(!al[0].alive,"B12a 동료 1 사망(실제 finishBattle)");
  ok(king.skills.length===3&&king.skills[2]==="LD-REVENGE","B12b 왕 3번째 칸 = 🪄 동료의 복수");
  ok(al[1].skills.length===3&&al[1].skills[2]==="LD-REVENGE","B12c 남은 동료 3번째 칸 = 🪄 동료의 복수");
  T.S.battlesUsed=0; T.startRounds(em,al[1],em,al[1]); T.TQ.length=0; T.finishBattle("A","검사"); T.TQ.length=0;
  ok(king.skills.length===4&&king.skills[3]==="LD-WRATH"&&king.skills[2]==="LD-REVENGE","B12d 동료 2 사망 → 왕 4번째 칸 = 🪄 왕의 분노 (복수도 유지)");
  T.syncLeaderSkills(king); ok(king.skills.length===4&&T.leaderSkillIds(king).length===4,"B12e 왕은 최대 4칸 (동료는 B12c 의 3칸이 최대)");
  /* 속성이 바뀌면 2차만 바뀐다 */
  king.element="grass"; T.syncLeaderSkills(king); eq(king.skills[1],"K-2-grass","B13 왕 속성 변경 → 2차 스킬도 리프 커터로");
}
{ /* B14 AI 로스터: 30종 중 6종 · 5속성 전부 · 모두 ⭐1 */
  T.newGame("pve",{}); T.S.roster[1]=[]; T.aiPickRoster(1);
  const r=T.S.roster[1];
  ok(r.length===6&&new Set(r).size===6&&r.every(id=>T.ROSTER.some(x=>x.id===id)),"B14a AI 로스터 6종 중복 없음");
  ok(new Set(r.map(id=>T.ROSTER.find(x=>x.id===id).element)).size===5,"B14b 5속성을 모두 포함");
}

/* ===================== C. AC3 — 기본기 · ⌛ 증가 대상 · 페널티 예외 ===================== */
{
  const basics=Object.keys(T.SKILLS).filter(id=>T.SKILLS[id].v2&&T.SKILLS[id].kind==="basic");
  eq(basics.length,36,"C1 기본기 36개 = 일반 30 + 전설 3 + 왕 1 + 암살자 1 + 방패병 1");
  ok(basics.every(id=>{const x=SK(id); return x.pct===100&&x.cd===0&&!x.req&&!x.once&&!x.fx&&!x.st&&!x.selfAbsorb&&!x.selfShield&&!x.hpCost;}),"C2 모든 기본기 💪100%·⌛0·조건·HP 소모·추가 효과 없음");
  /* 왕 · 동료 기본기가 실제 스킬로 나간다 — 레거시 'basic' 별칭도 슬롯 0 */
  H.freshPlay(T,"pvp"); H.clearBoard(T);
  const k0=T.S.pieces.find(x=>x.owner===0&&x.type==="king"), k1=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  H.place(T,k0,7,4); H.place(T,k1,6,4);
  k0.spd=20; T.S.battlesUsed=0; T.startRounds(k0,k1,k0,k1); T.TQ.length=0;
  const B=T.S.battle; T.battleModal(); fixRand(0.5);
  window.__actCore("basic"); T.TQ.length=0; unfix();
  ok(k0.revealedSkills.includes(0)&&k1.hp<100,"C3 왕도 기본기 '왕의 일격' 스킬로 공격 (8.1 ②⑩)");
  ok(k0.cds[0]===0,"C3b 기본기 사용 후 ⌛0");
}
{ /* C4 동결 · 자기장 — 기본기는 ⌛ 증가 대상이 아니다, 남은 ⌛ 가장 짧은 것 · 같으면 슬롯 순서 */
  fixRand(0.5);
  let t=openBattle({skills:["M-W3-1","M-W3-3"]},{skills:["M-F1-1"]});
  act("A",1); eq(t.d.cds[0],0,"C4a 대상이 기본기뿐이면 동결은 아무 ⌛도 늘리지 않는다");
  t=openBattle({skills:["M-W3-1","M-W3-3"]},{skills:["M-F1-1","M-F1-2","M-F1-3","M-F1-4"]});
  t.d.cds=[0,2,0,1]; act("A",1);
  ok(t.d.cds[0]===0&&t.d.cds[2]===1&&t.d.cds[1]===2&&t.d.cds[3]===1,"C4b 기본기 제외 · 남은 ⌛ 최소(3차 0) → +1");
  t=openBattle({skills:["M-W3-1","M-W3-3"]},{skills:["M-F1-1","M-F1-2","M-F1-3","M-F1-4"]});
  t.d.cds=[0,1,1,1]; act("A",1); ok(t.d.cds[1]===2&&t.d.cds[2]===1&&t.d.cds[3]===1,"C4c 동률이면 슬롯 순서(2차 먼저)");
  t=openBattle({skills:["M-L5-1","M-L5-3"]},{skills:["M-F1-1","M-F1-2"]});
  act("A",1); eq(t.d.cds[1],0,"C4d 자기장 — 대상이 감전이 아니면 ⌛ 증가 없음");
  t=openBattle({skills:["M-L5-1","M-L5-3"]},{skills:["M-F1-1","M-F1-2"]});
  t.d.shock=1; act("A",1); ok(t.d.cds[1]===1&&t.d.cds[0]===0,"C4e 자기장 — 감전 대상의 기본기 외 스킬 ⌛ +1, 기본기 불변");
  unfix();
}
{ /* C5 수면 포자 — 기본기만 가능, 다음 스킬 사용 1회에 소모 */
  fixRand(0.5);
  const t=openBattle({skills:["M-G4-1","M-G4-3"]},{skills:["M-F1-1","M-F1-2"]});
  act("A",1);
  ok(t.d.sleepNext===true&&T.slotUsable(t.d,0,"D")&&!T.slotUsable(t.d,1,"D"),"C5a 수면 포자 → 대상은 기본기만 합법");
  act("D",0); ok(t.d.sleepNext===false,"C5b 기본기를 쓰면 수면 소모");
  unfix();
}
{ /* C6 도망 실패 페널티 = 스킬 밖 예외 — 실제 __fleeCore 경로 */
  const t=openBattle({skills:["M-F1-1","M-F1-2"],atk:20},{skills:["M-F1-1","M-F1-2","M-F1-3","M-F1-4"],atk:20,statusPct:1});
  const B=t.B;
  /* 반격자 D 에게 스킬용 1회성 효과·흡수를 심어 둔다 — 페널티는 하나도 쓰거나 발동시키면 안 된다 */
  /* #241: 달군 비늘·축전·모래바람·충전의 1회성 필드는 단순화·교체로 삭제 — 남은 1회성(확정 치명·위력+)만 심는다 */
  Object.assign(t.d,{critForce:true,nextPowUp:0.8,absorbR:1,absorbPct:0.5});
  t.d.cds=[0,1,2,3]; t.a.reflectR=2; t.d.hp=50;
  T.battleModal();
  const log0=B.blog.length;
  Math.random=(()=>{ const seq=[0.99,0.5,0.5,0.5]; let i=0; return ()=>seq[i++]!==undefined?seq[i-1]:0.5; })(); T.setSeed(null);
  window.__fleeCore(); T.TQ.length=0; unfix();
  const dmg=100-t.a.hp;
  eq(dmg,20,"C6a 페널티 = 상대 공격력 100% (20 · 분산 1.0 · 치명 없음 · 방어 0)");
  ok(JSON.stringify(t.d.cds)==="[0,1,2,3]","C6b 페널티는 ⌛를 바꾸지 않는다");
  ok(t.d.critForce===true&&t.d.nextPowUp===0.8,"C6c 스킬용 1회성 효과(확정 치명·위력+)를 소모하지 않는다");
  ok(t.d.hp===50,"C6d 흡수 회복 없음 (스킬 효과 아님)");
  ok(t.a.burn===0&&t.a.shock===0&&t.a.weaken===0&&t.a.crack===0,"C6e 상태이상 부여 없음");
  ok(t.d.hp===50&&!B.blog.slice(log0).some(x=>/반사/.test(x)),"C6f 반사 반응도 일으키지 않는다");
  ok(!t.d.revealedSkills.length,"C6g 스킬 공개 기록 없음 (스킬이 아니다)");
}

/* ===================== D. AC4 — AI 공정 관측 ===================== */
{
  /* 같은 공개 상태에서 상대의 **비공개** 스킬·등급·⌛만 다르게 해 두 난이도 AI 의 선택이 한 글자도 바뀌지 않아야 한다 */
  /* 제품의 window.__act 는 로드별 프록시에 묶여 있어 테스트가 바꿔 끼울 수 없다 — 그래서 AI 가 **실제로 실행한 결과**(내 ⌛·공개 기록·양측 HP·도망 시도)를 서명으로 비교한다 */
  const decide=(level,oppHidden)=>{
    /* A 속도 20 — 4.4 등급 비교(낮은 등급 선턴)가 순서를 바꾸지 않게 한다. 순서는 엔진 규칙이지 AI 의 관측이 아니다 */
    const t=openBattle({skills:["M-F2-1","M-F2-2","M-F2-3","M-F2-4"],grade:4,hp:70,spd:20},{skills:oppHidden.skills,grade:oppHidden.grade,hp:60});
    t.d.cds=oppHidden.cds.slice(); t.d.revealedSkills=[];
    T.S.mode="sim"; T.S.aiLevel={0:level,1:level}; // isAI: sim 은 양측 AI · aiLevelOf 가 난이도를 고른다 (실제 분기 그대로)
    for(const o of [0,1]){ T.S.pkgs[o]={itemGift:0,battleBuff:0}; T.S.inv[o]=[]; T.S.balls[o]=0; }
    t.B.phase=0; T.setSeed(777); const blog0=t.B.blog.length, tries=T.S.metrics.fleeTries;
    let err="";
    try{ T.aiBattleAction(); T.TQ.length=0; }catch(e){ err="ERR:"+e.message; }
    T.setSeed(null);
    const sig=JSON.stringify({cds:t.a.cds,rev:t.a.revealedSkills,aHp:t.a.hp,dHp:t.d.hp,dSh:t.d.shield,flee:T.S.metrics.fleeTries-tries,log:t.B.blog.slice(blog0,blog0+2).map(x=>x.split(t.a.name+"의 ").join(""))}); // 무대 말 이름은 경기마다 무작위라 그 이름만 정확히 빼고 비교 (이름에 '의'가 들어간 종 대비)
    return err||sig;
  };
  const hidA={skills:["M-L2-1"],grade:1,cds:[0]};
  const hidB={skills:["M-G2-1","M-G2-2","M-G2-3","M-G2-4"],grade:4,cds:[0,3,0,4]};
  for(const level of ["grade5","dan5"]){
    const a=decide(level,hidA), b=decide(level,hidB);
    ok(!/ERR/.test(a)&&/"rev":\[\d/.test(a),`D1 ${level} AI 가 실제 스킬을 골라 실행한다 (${a.slice(0,80)})`);
    eq(b,a,`D2 ${level} — 상대의 비공개 스킬·등급·⌛가 달라도 같은 선택 (공정 관측)`);
  }
}
{ /* D3 AI 는 같은 등급·스킬 규칙을 쓴다 — 전설·⭐4·조건부 스킬을 가진 전투원끼리 AI 전투가 합법 선택만으로 끝난다 */
  let illegal=0, done=0;
  for(const seed of [11,12]){
    const t=openBattle({skills:T.V2_SPECIES["M-L2"].slice(),grade:4,hp:131,maxHp:131,atk:33,element:"lightning"},{skills:T.LEGEND_ROSTER[2].skills.slice(),grade:5,hp:158,maxHp:158,atk:40,legend:"reaper"});
    T.S.mode="sim"; T.S.aiLevel={0:"dan5",1:"grade5"};
    T.S.pkgs[0]={itemGift:0,battleBuff:0}; T.S.pkgs[1]={itemGift:0,battleBuff:0}; T.S.inv[0]=[]; T.S.inv[1]=[];
    T.setSeed(seed);
    let n=0; while(T.S.battle&&n<40){
      const B=T.S.battle, side=B.phase===0?B.firstSide:(B.firstSide==="A"?"D":"A"), f=side==="A"?B.fa:B.fd;
      const legal=new Set(f.skills.filter((id,k)=>T.slotUsable(f,k,side)).map(id=>T.SKILLS[id].ko)), all=new Set(f.skills.map(id=>T.SKILLS[id].ko));
      const b0=B.blog.length; T.battleModal(); T.aiBattleAction(); T.TQ.length=0; n++;
      for(const line of B.blog.slice(b0)){ const mm=/의 (.+)!$/.exec(line); if(mm&&all.has(mm[1])&&!legal.has(mm[1])&&line.indexOf("번개 꼬리")<0) illegal++; }
    }
    T.setSeed(null);
    if(!T.S.battle) done++;
  }
  eq(illegal,0,"D3a AI 는 slotUsable 로 막힌 스킬(⌛·전투당 1회·번개 발도 조건·사신의 낫 봉인)을 고르지 않는다");
  eq(done,2,"D3b ⭐4 뇌격수 vs 전설 사신 AI 전투가 끝까지 진행된다");
}
{ /* D4 AI 코드가 상대 전투원의 grade·skills·cds·revealedSkills 를 읽지 않는다 — 정적 대조(보조) */
  const src=T.html;
  const body=name=>{ const i=src.indexOf("function "+name+"("); const j=src.indexOf("\nfunction ",i+10); return src.slice(i,j); };
  for(const fn of ["aiBattleAction","aiBattleActionStrong","aiBattleEV","aiWinProb","aiBattlePairScore"]){
    const b=body(fn);
    ok(b.length>50&&!/\bopp\.(grade|skills|cds|revealedSkills|onceUsed)\b/.test(b)&&!/\b(fd|def)\.(grade|skills|cds|onceUsed)\b/.test(b),`D4 ${fn} 는 상대의 등급·스킬·⌛를 읽지 않는다`);
  }
}

/* ===================== M. 스킬 고유 동작 — 실제 실행기 ===================== */
fixRand(0.5); // 회피 없음(회피율 0) · 분산 ×1.0 · 치명 없음 · 확률 효과는 statusPct 로 고정
{
  let t;
  /* 🔥 */
  t=openBattle({skills:["M-F1-1","M-F1-3","M-F1-4"]},{hp:300,maxHp:300});
/* #241 CJ 승인(2026-09-17 스킬 정리) — 단순화 9: 달군 비늘 = 가하는 피해 +20%(1R) 버프 — 1회성 소모 → 1R 지속 */
  act("A",1); ok(t.a.shield===10&&t.a.dmgUpBuff===0.2&&t.a.dmgUpBuffR===1,"MF1a 달군 비늘 — 방어막 10% · 가하는 피해 +20%(1R)");
  act("D",0); t.B.round=3; act("A",2); eq(300-t.d.hp,Math.round(20*1.6*1.2),"MF1b 성룡의 포효 R3 = 💪(100+3×20)% × 1.2(달군 비늘 ⑤)");
  ok(t.d.burn>0,"MF1c 성룡의 포효 화상 100% (달군 비늘 버프는 1회성 소모가 아니라 1R 지속 — MF1b 타격에 적용)");
  t=openBattle({skills:["M-F2-1","M-F2-3"]},{hp:300,maxHp:300}); t.d.burn=2;
  const blog0=t.B.blog.length; act("A",1); ok(t.B.blog.slice(blog0).some(x=>/치명타/.test(x))&&300-t.d.hp===36,"MF2a 조준 사격 — 화상 대상이면 치명타 확정 (20×1.2×1.5=36)");
  t=openBattle({skills:["M-F2-1","M-F2-4"]},{hp:200,maxHp:200}); t.d.burn=2; t.d.burnMag=0.05;
  act("A",1); ok(200-t.d.hp===30&&t.d.burn===0,"MF2b 폭발 연소 — 남은 2R × 10 × 1.5 = 30 즉시 · 화상 해제");
  t=openBattle({skills:["M-F2-1","M-F2-4"]},{hp:200,maxHp:200}); t.d.shield=50; t.d.shieldLayers=[{amt:50,src:"x"}]; t.d.burn=1; t.d.burnMag=0.05;
  act("A",1); ok(200-t.d.hp===15&&t.d.shield===50,"MF2c 폭발 연소는 지속 피해 — 방어막 무시 HP 직행");
  t=openBattle({skills:["M-F2-1","M-F2-4"]},{hp:200,maxHp:200}); act("A",1); eq(200-t.d.hp,24,"MF2d 화상이 없으면 💪120%");
  t=openBattle({skills:["M-F3-1","M-F3-3"]},{skills:["M-F1-1"],statusPct:0}); act("A",1);
  ok(t.a.hardenPct===0.2&&t.a.retaliateBurnR>0,"MF3a 달궈진 껍질 — 경화 20%"); act("D",0);
  ok(t.d.burn>0,"MF3b 그동안 자신을 공격한 상대에게 화상 100%");
  t=openBattle({skills:["M-F3-1","M-F3-4"],def:20},{skills:["M-F1-1"],hp:300,maxHp:300});
  t.B.phase=1; T.execSlot("D",0); T.TQ.length=0; t.B.msgQ.length=0; // D 가 먼저 때려 방어력 감소분 누적 (20×20% = 4)
  const mit=t.a.mitigated; ok(Math.abs(mit-4)<1e-9,"MF3c 분화 누계 — 방어력으로 줄인 피해 4");
  endRound(); act("A",1); eq(300-t.d.hp,Math.round(16+4),"MF3d 분화 = 💪80% + 줄인 피해 총량(최대 40)");
  t=openBattle({skills:["M-F4-1","M-F4-3"]},{hp:200,maxHp:200}); t.d.burn=2; t.d.burnMag=0.05;
  act("A",1); ok(200-t.d.hp===12+10&&t.d.burn===2,"MF4a 불꽃 표식 — 💪60% + 화상 피해 1회 즉시(지속 유지)");
  t=openBattle({skills:["M-F4-1","M-F4-4"]},{hp:200,maxHp:200}); t.d.burn=3;
  act("A",1); ok(t.d.burn===3&&t.a.vanguardTurn>0,"MF4b 꺼지지 않는 불티 — 화상 +1R 최대 3R · 다음 라운드 선턴 효과");
  t.a.spd=1; endRound(); eq(t.B.firstSide,"A","MF4c 다음 라운드 선턴 (속도가 낮아도)");
  t=openBattle({skills:["M-F5-1","M-F5-3","M-F5-4"],hp:50},{}); t.d.burn=2; t.d.burnMag=0.05;
/* #241 CJ 승인(2026-09-17 스킬 정리) — 단순화 10: 잿불 심기 = 화상 수치 8% 갱신(큰 값) — +3%p·최대 +6%p 보너스 필드 삭제 */
  act("A",1); ok(t.d.burnMag===0.08&&t.a.hp===55,"MF5a 잿불 심기 — 화상 수치 5% → 8% · 최대 HP 5% 회복");
  act("D",0); ok(t.a.cds[1]===1&&!T.slotUsable(t.a,1,"A"),"MF5b 잿불 심기 ⌛2 — 다음 라운드에는 아직 쓸 수 없다");
  t=openBattle({skills:["M-F5-1","M-F5-3"]},{}); t.d.burn=2; t.d.burnMag=0.10; act("A",1); eq(t.d.burnMag,0.10,"MF5c 잿불 심기 — 더 큰 화상 수치(10%)는 유지(큰 값)");
  t=openBattle({skills:["M-F5-1","M-F5-4"],statusPct:0},{});
  act("A",1); ok(t.d.burn===4&&t.d.burnNoCure===true&&t.a.onceUsed["M-F5-4"]&&!T.slotUsable(t.a,1,"A"),"MF5d 영겁의 재 — 화상 2R +2R · 해독제 불가 · 전투당 1회");
  t.B.phase=1; T.S.inv[1]=["cure"]; T.battleModal(); window.__useItemCore(0); T.TQ.length=0; ok(t.d.burn===4,"MF5e 해독제로 영겁의 재 화상이 풀리지 않는다");
  t=openBattle({skills:["M-F6-1","M-F6-3","M-F6-4"]},{skills:["M-F1-1"],hp:300,maxHp:300});
/* #241 CJ 승인(2026-09-17 스킬 정리) — 단순화 7: 열기 축적 = 방어막 15% · 사용 시 대상 화상 70% (반격 화상 삭제) — 난수 0.5 < 0.70 이면 부여 */
  act("A",1); ok(t.a.shield===15&&t.d.burn>0,"MF6a 열기 축적 — 방어막 15% · 대상 화상 70%(사용 시)"); const bl6=t.B.blog.length; act("D",0); ok(!t.B.blog.slice(bl6).some(x=>/화상을 입었다/.test(x)),"MF6b 공격한 상대에게 반격 화상은 더 이상 없다");
  t=openBattle({skills:["M-F6-1","M-F6-4"]},{hp:300,maxHp:300}); T.shieldAdd(t.a,20,"x");
  act("A",1); ok(t.a.shield===0&&300-t.d.hp===20+30&&t.d.burn>0,"MF6c 화산 폭발 — 방어막 20 소모 → 💪100% + 20×150% · 화상 100%");
  /* 💧 */
  t=openBattle({skills:["M-W1-1","M-W1-3"],hp:50},{}); t.a.burn=2; t.a.weaken=2;
  act("A",1); ok(t.a.burn===0&&t.a.weaken===2&&t.a.hp===58,"MW1a 맑은 물 — 상태이상 1개(화상 먼저) 해제 · 8% 회복");
/* #241 CJ 승인(2026-09-17 스킬 정리) — R3 거울 수면 = 자기 상태이상 1개를 대상에게 옮김 (1R 되돌림 mirrorR 삭제) — 세부는 smoke_issue241 */
  t=openBattle({skills:["M-W1-1","M-W1-4"]},{skills:["M-F1-1","M-F1-2"],hp:300,maxHp:300}); t.a.burn=2; t.a.burnMag=0.05;
  act("A",1); ok(t.a.burn===0&&t.d.burn===2&&300-t.d.hp===16,"MW1b 거울 수면 — 💪80% · 자기 화상 2R 을 대상에게 옮김"); ok(!(t.a.mirrorR>0),"MW1c 되돌림 필드 없음");
  t=openBattle({skills:["M-W2-1","M-W2-3"]},{}); act("A",1); ok(t.a.evadeBuff===0.2&&t.a.vanguardTurn>0,"MW2a 잠영 — 회피 +20%(1R) · 다음 라운드 선턴");
  t=openBattle({skills:["M-W2-1","M-W2-4"]},{hp:300,maxHp:300}); t.d.weaken=2;
  act("A",1); ok(300-t.d.hp===50&&t.d.weaken===0,"MW2b 심연의 일격 — 약화 소모 시 💪250%");
  t=openBattle({skills:["M-W2-1","M-W2-4"]},{hp:300,maxHp:300}); act("A",1); eq(300-t.d.hp,30,"MW2c 약화 없으면 💪150%");
  t=openBattle({skills:["M-W3-1","M-W3-4"]},{skills:["M-F1-1"],hp:300,maxHp:300});
  act("A",1); act("D",0); eq(100-t.a.hp,20,"MW3a 빙벽 반사 중 받은 HP 피해 20"); eq(300-t.d.hp,6,"MW3b 공격자에게 받은 HP 피해의 30% 반사 (6)");
  t=openBattle({skills:["M-W4-1","M-W4-3"]},{}); act("A",1); eq(t.a.evadeBuff,0.3,"MW4a 안개 걸음 회피 +30%");
  t=openBattle({skills:["M-W4-1","M-W4-4"]},{skills:["M-F1-1","M-F1-2"]});
  act("A",1); act("D",1); ok(t.a.hp===100&&t.d.cds[1]===1&&t.a.burn===0&&t.d.revealedSkills.includes(1),"MW4b 환영 무도 — 상대 다음 행동 피해·효과 0, ⌛는 정상 소모(⌛2 → 라운드 종료 1)");
  t=openBattle({skills:["M-W5-1","M-W5-3"]},{}); t.d.weaken=4; act("A",1); eq(t.d.weaken,4,"MW5a 밀물 — 약화 +1 최대 4");
  t=openBattle({skills:["M-W5-1","M-W5-3"]},{}); t.d.weaken=2; act("A",1); eq(t.d.weaken,3,"MW5b 밀물 +1");
/* #241 CJ 승인(2026-09-17 스킬 정리) — R2 해일 예고 = 사용 시 X 확정 표식 · HP+방어막 ≤ X 면 사망 (2라운드 뒤 예고 피해 · pendingFx 삭제) — 세부는 smoke_issue241 */
  t=openBattle({skills:["M-W5-1","M-W5-4"]},{hp:400,maxHp:400}); t.d.weaken=2; act("A",1);
  ok(!(t.a.pendingFx&&t.a.pendingFx.length)&&t.d.tideMark===Math.round(20*(1.2+0.6))&&t.d.hp===400,"MW5c 해일 예고 — 예약 없이 표식 X = 💪(120% + 약화 2 × 30%) = 36 · 즉시 피해 없음");
  t.d.hp=30; act("D",0); ok(!T.S.battle,"MW5d HP+방어막 ≤ X 가 되면 행동 뒤 발동 · 사망");
  t=openBattle({skills:["M-W5-1","M-W5-4"]},{hp:400,maxHp:400}); act("A",1); t.B.round=6; endRound();
  ok(!T.S.battle&&t.d.hp===400,"MW5f 조건이 끝내 안 맞으면 피해 없이 전투 종료(T15)");
  t=openBattle({skills:["M-W6-1","M-W6-3","M-W6-4"]},{skills:["M-F1-1"],hp:300,maxHp:300});
  act("A",1); eq(t.a.shield,18,"MW6a 껍질 닫기 방어막 18%"); act("D",0); endRound();
/* #241 CJ 승인(2026-09-17 스킬 정리) — 단순화 6: 집게 반격 = 방어막이 막은 피해의 50% 반사 (💪50% 반격 · 라운드당 1회 삭제) — 막은 20 × 50% = 10 */
  T.shieldAdd(t.a,30,"x"); act("A",2); act("D",0); ok(300-t.d.hp===10&&t.B.blog.some(x=>/반사/.test(x)),"MW6b 집게 반격 — 방어막이 막은 피해 20 의 50% 반사(10)");
  /* ⚡ */
  t=openBattle({skills:["M-L1-1","M-L1-3","M-F1-2"],statusPct:0},{skills:["M-L1-1","M-L1-2"]});
  t.a.skills=["M-L1-1","M-L1-3","M-L1-2"]; t.a.cds=[0,0,0];
/* #241 CJ 승인(2026-09-17 스킬 정리) — 단순화 2 수정안: 충전 = 💪🏻 60% · 감전 100% · 가하는 피해 +10%(2R) (다음 스킬 감전 확정 · 속도 +3 삭제) */
  const d0=t.d.hp; act("A",1); ok(d0-t.d.hp===12&&t.d.shock>0&&t.a.dmgUpBuff===0.1&&t.a.dmgUpBuffR===2&&!(t.a.spdBuff>0),"ML1a 충전 — 💪60%(12) · 감전 · 가하는 피해 +10%(2R)");
  act("D",0); ok(t.a.dmgUpBuffR===2,"ML1b 충전 버프 — 부여 라운드는 세지 않는다(5.6)");
  t=openBattle({skills:["M-L1-1","M-L1-4"]},{hp:400,maxHp:400}); t.a.shocksDealt=3; act("A",1); eq(400-t.d.hp,38,"ML1c 연쇄 번개 — 💪(100+3×30)%");
  t=openBattle({skills:["M-L1-1","M-L1-4"]},{hp:400,maxHp:400}); t.a.shocksDealt=9; act("A",1); eq(400-t.d.hp,44,"ML1d 연쇄 번개 최대 220%");
  t=openBattle({skills:["M-L2-1","M-L2-3"]},{}); ok(T.slotUsable(t.a,1,"A")&&!T.slotUsable(t.d,0,"D")===false,"ML2a 번개 발도 — 선턴이면 사용 가능");
  t.d.skills=["M-L2-1","M-L2-3"]; t.d.cds=[0,0]; ok(!T.slotUsable(t.d,1,"D"),"ML2b 후턴이면 사용 불가");
  t=openBattle({skills:["M-L2-1","M-L2-4"]},{skills:["M-L2-1","M-L2-4"],hp:300,maxHp:300});
  act("A",1); eq(300-t.d.hp,52,"ML2c 천둥 낙인 — 사용자가 선턴(대상 후턴) → 💪260% (Q2 확정)");
  act("D",1); eq(100-t.a.hp,26,"ML2d 후턴 사용 → 💪130%");
  t=openBattle({skills:["M-L3-1","M-L3-3"]},{skills:["M-L1-1","M-L1-2"],statusPct:1}); t.a.shock=1;
  act("A",1); ok(t.a.shock===0&&t.a.immuneShockR>0&&t.a.hardenPct===0.15,"ML3a 접지 — 감전 해제 · 면역 · 경화 15%");
  act("D",1); eq(t.a.shock,0,"ML3b 감전 면역");
  t=openBattle({skills:["M-L3-1","M-L3-4"]},{skills:["M-F2-1","M-F2-2"],atk:60});
  act("A",1); act("D",1); eq(100-t.a.hp,15,"ML3c 과부하 방벽 — 한 번에 받는 피해 최대 HP 15%");
  t=openBattle({skills:["M-L4-1","M-L4-2","M-L4-3"]},{hp:300,maxHp:300}); t.a.cds=[0,1,0]; t.a.skills=["M-L4-1","M-L4-2","M-L4-3"];
  t.a.cds=[0,0,0]; t.a.cds[1]=1; act("A",2); eq(t.a.cds[1],0,"ML4a 전광석화 — 다른 스킬 중 남은 ⌛ 최장 1개 −1");
  t=openBattle({skills:["M-L4-1","M-L4-2","M-L4-3","M-L4-4"],statusPct:0},{hp:300,maxHp:300});
/* #241 CJ 승인(2026-09-17 스킬 정리) — R1 번개 꼬리 = 같은 턴 추가 공격(플레이어 선택) — 자동 연계(첫 ⌛0 2차) 삭제 · 세부는 smoke_issue241 */
  act("A",3); ok(300-t.d.hp===20&&t.B.bonus&&t.B.bonus.stage==="active"&&t.B.phase===0,"ML4b 번개 꼬리 — 💪100% 뒤 추가 공격 단계(차례 유지)");
  act("A",1); ok(300-t.d.hp===20+Math.round(20*1.2*0.6)&&t.a.cds[1]===0&&!t.B.bonus,"ML4c 추가 공격 스파크 스침 60% · 2차 ⌛ 사본 복원(0)");
  t=openBattle({skills:["M-L5-1","M-L5-4"]},{});
/* #241 CJ 승인(2026-09-17 스킬 정리) — 단순화 1: 영구 자기장 = 사용 시 감전 3R 확정 (라운드 시작 재부여 삭제) */
  act("A",1); ok(t.d.shock===3&&t.d.shockFresh===true,"ML5a 영구 자기장 — 감전 3R(부여 라운드 제외)"); act("D",0);
  ok(t.d.shock>0&&t.B.round===2&&t.B.firstSide==="A","ML5b R2 — 예정 선턴 D 가 감전이라 A 선턴");
  endRound(); endRound(); ok(t.B.round===4&&t.d.shock>0,"ML5c R4 까지 감전 유지(3라운드)"); endRound(); ok(!(t.d.shock>0),"ML5d R4 종료에 해제");
  t=openBattle({skills:["M-L6-1","M-L6-3","M-L6-4"]},{skills:["M-F1-1"],hp:300,maxHp:300});
/* #241 CJ 승인(2026-09-17 스킬 정리) — 단순화 3: 축전 = 방어막 20% (막은 피해 → 다음 스킬 고정 피해 삭제) */
  act("A",1); ok(t.a.shield===20,"ML6a 축전 — 방어막 20%"); act("D",0);
  endRound(); act("A",0); eq(300-t.d.hp,20,"ML6b 다음 기본기에 고정 피해 추가 없음");
  t=openBattle({skills:["M-L6-1","M-L6-4"],statusPct:0},{hp:300,maxHp:300}); T.shieldAdd(t.a,40,"x");
  act("A",1); ok(300-t.d.hp===24+20&&t.a.shield===40&&t.d.shock>0,"ML6c 방전 — 💪120% + 방어막 50% 고정 · 방어막 유지 · 감전 100%");
  /* 🗻 */
  t=openBattle({skills:["M-E1-1","M-E1-3","M-E1-4"]},{skills:["M-F1-1"],hp:300,maxHp:300});
  ok(!T.slotUsable(t.a,2,"A"),"ME1a 지하 매복 — 굴 파기 전에는 불가");
  act("A",1); act("D",0); eq(100-t.a.hp,12,"ME1b 굴 파기 — 받는 피해 −40% (⑧ 합산)");
  ok(t.B.round===2&&T.slotUsable(t.a,2,"A"),"ME1c 다음 라운드에만 지하 매복 가능");
  T.shieldAdd(t.d,50,"x"); act("A",2); ok(300-t.d.hp===46&&t.d.shield===50,"ME1d 지하 매복 💪230% · 방어막 무시");
  t=openBattle({skills:["M-E1-1","M-E1-3","M-E1-4"]},{}); act("A",1); act("D",0); endRound(); ok(t.B.round===3&&!T.slotUsable(t.a,2,"A"),"ME1e 두 라운드 뒤에는 불가");
  t=openBattle({skills:["M-E2-1","M-E2-3"]},{hp:300,maxHp:300}); T.shieldAdd(t.d,30,"x"); act("A",1); ok(300-t.d.hp===22&&t.d.shield===30,"ME2a 창 박기 방어막 무시");
  t=openBattle({skills:["M-E2-1","M-E2-4"]},{hp:300,maxHp:300,def:30}); T.applyHarden(t.d,0.2,2);
  act("A",1); eq(300-t.d.hp,36,"ME2b 대지 관통 — 방어력·경화 전부 무시 💪180%");
  t=openBattle({skills:["M-E3-1","M-E3-3"]},{}); act("A",1); eq(t.a.hardenPct,0.3,"ME3a 강철 가죽 경화 30%");
  t=openBattle({skills:["M-E3-1","M-E3-4"]},{skills:["M-F1-1"],hp:300,maxHp:300});
  act("A",1); act("D",0); ok(t.a.hp===100&&t.a.nullHitN===0,"ME3b 철벽 돌파 — 받는 피해 1회 무효");
  endRound(); act("A",0); eq(300-t.d.hp,36,"ME3c 다음 피해 스킬 위력 +80%p (기본기 180%)");
  t=openBattle({skills:["M-E4-1","M-E4-3"]},{skills:["M-F1-1"]});
/* #241 CJ 승인(2026-09-17 스킬 정리) — R4 모래바람 교체 · V1 회피율 감소 전환 */
  act("A",1); ok(100-t.d.hp===12&&t.d.evadeDown===0.1&&t.d.evadeDownR===2&&t.a.evadeBuff===0.1,"ME4a 모래바람 — 💪60%(12) · 대상 회피율 −10%p(2R) · 자기 회피 +10%");
  t.a.evadeBuff=0; act("D",0); eq(100-t.a.hp,20,"ME4b 상대의 다음 피해 스킬은 줄지 않는다(−30% 삭제)");
  t=openBattle({skills:["M-E4-1","M-E4-4"]},{skills:["M-F1-1","M-F1-2"],statusPct:0});
  act("A",1); ok(t.d.sandStormR>0&&t.d.evadeDown===0.2&&t.d.evadeDownR===2,"ME4c 모래 폭풍 — 상태이상 부여 확률 절반 · 회피율 −20%p(2R)");
  fixRand(0.4); act("D",1); fixRand(0.5); eq(t.a.burn,0,"ME4d 화상 70% → 35%: 난수 0.4 는 실패");
  t=openBattle({skills:["M-E5-1","M-E5-3"]},{}); t.d.crack=3; act("A",1); ok(t.d.crack===3&&t.a.hardenPct===0.1,"ME5a 풍화 — 균열 +1R 최대 3R · 경화 10%");
  t=openBattle({skills:["M-E5-1","M-E5-4"],hp:40},{}); ok(!T.slotUsable(t.a,1,"A"),"ME5b 태고의 각성 — 4라운드 전에는 불가");
  t.B.round=4; ok(T.slotUsable(t.a,1,"A"),"ME5c 4라운드부터 가능"); act("A",1); ok(t.a.hp===70&&t.a.hardenPct===0.2&&t.a.harden===2,"ME5d 30% 회복 · 경화 20%(2R)");
  t=openBattle({skills:["M-E6-1","M-E6-3"]},{}); act("A",1); eq(t.a.shield,25,"ME6a 웅크린 공 방어막 25%");
  t=openBattle({skills:["M-E6-1","M-E6-4"]},{skills:["M-F1-1"],atk:20});
/* #241 CJ 승인(2026-09-17 스킬 정리) — 단순화 11: 요새 전환 = 현재 방어막만큼 추가(최대 HP 20% 한도) · 방어막 10% (내구 2배 삭제) */
  act("A",1); eq(t.a.shield,10,"ME6b 요새 전환 — 방어막이 없으면 10% 만"); act("D",0); ok(t.a.hp===90&&t.a.shield===0,"ME6c 방어막 10 은 피해 10 만 막는다(내구 2배 없음)");
  t=openBattle({skills:["M-E6-1","M-E6-4"]},{}); T.shieldAdd(t.a,15,"x"); act("A",1); eq(t.a.shield,15+15+10,"ME6d 현재 방어막 15 만큼 추가 + 10%");
  t=openBattle({skills:["M-E6-1","M-E6-4"]},{}); T.shieldAdd(t.a,50,"x"); act("A",1); eq(t.a.shield,50+20+10,"ME6e 추가분은 최대 HP 20% 한도");
  /* 🌿 */
  t=openBattle({skills:["M-G1-1","M-G1-3"],hp:50},{}); act("A",1); eq(t.a.hp,65,"MG1a 광합성 — 선턴이면 15%");
  t=openBattle({skills:["M-G1-1","M-G1-3"],hp:50},{skills:["M-G1-1","M-G1-3"],hp:50}); act("A",1); act("D",1); eq(t.d.hp,60,"MG1b 후턴이면 10%");
  t=openBattle({skills:["M-G1-1","M-G1-4"]},{hp:300,maxHp:300}); t.a.healTotal=100; act("A",1); eq(300-t.d.hp,60,"MG1c 성장 매듭 — 💪100% + 회복 총량 50%(최대 40)");
  t=openBattle({skills:["M-G2-1","M-G2-3"]},{hp:80}); act("A",1);
  ok(t.d.fleeLock&&t.d.healCut===0.5,"MG2a 뿌리 고정 — 도망 불가 · 회복량 −50%");
  t.B.phase=1; T.battleModal(); const tries=T.S.metrics.fleeTries; window.__fleeCore(); eq(T.S.metrics.fleeTries,tries,"MG2b 도망 시도 자체가 막힌다");
  t=openBattle({skills:["M-G2-1","M-G2-4"]},{hp:30}); act("A",1); ok(!T.S.battle,"MG2c 포식 — HP 30% 이하 💪260% (52) 로 쓰러뜨림");
  t=openBattle({skills:["M-G2-1","M-G2-4"]},{hp:300,maxHp:300}); act("A",1); eq(300-t.d.hp,32,"MG2d 포식 💪160%");
  t=openBattle({skills:["M-G3-1","M-G3-3"],hp:50},{skills:["M-F1-1"]}); act("A",1); act("D",0); ok(t.a.hp===30,"MG3a 나이테 — 부여 라운드 종료에는 회복 없음");
  /* REVISE 4차 CJ 결정(2026-09-17): R2 는 R1 반대 측(D)이 먼저 — 행동 순서만 바꾼다, 기대값 불변 */
  act("D",0); act("A",0); ok(t.a.hp===30-20+6,"MG3b 다음 라운드 종료에 6% 회복");
  t=openBattle({skills:["M-G3-1","M-G3-4"],hp:10},{skills:["M-F1-1"]}); act("A",1); act("D",0);
  ok(T.S.battle&&t.a.hp===10&&t.a.enduredUsed,"MG3c 천년목 — HP 0 이 될 피해를 최대 HP 15%로 버팀(현재 HP 가 더 낮으면 그대로)");
  t=openBattle({skills:["M-G3-1","M-G3-4"],hp:90},{skills:["M-F1-1"],atk:200}); act("A",1); act("D",0); eq(t.a.hp,15,"MG3d 천년목 — 90 에서 치명 피해 → 15");
  t=openBattle({skills:["M-G3-1","M-G3-4"],hp:30},{skills:T.LEGEND_ROSTER[2].skills.slice(),hp:10,legend:"reaper"});
  act("A",1); t.B.round=4; t.d.cds=[0,0,0,0]; t.B.phase=1; T.execSlot("D",3); T.TQ.length=0;
  /* REVISE 2차 CJ 결정(2026-09-17): 사신의 낫은 절대 판정 즉사 — 종전 MG3e(천년목이 즉사를 버팀, Q7 Venus 대안)의 기대값을 뒤집는다 */
  ok(t.a.hp===0&&!T.S.battle&&!t.a.enduredUsed&&!t.B.blog.some(x=>/천년목 — 쓰러지지 않고|낫을 버텨/.test(x)),"MG3e ① 천년목은 사신의 낫 즉사를 버티지 못한다 (CJ 결정 2026-09-17 · 4R)");
  t=openBattle({skills:["M-G4-1","M-G4-4"]},{skills:["M-F1-1","M-F1-2"],hp:100});
  act("A",1); act("D",1); ok(t.d.hp<=95&&t.a.healTotal>=0,"MG4a 번식 포자 — 기본기가 아닌 스킬 사용 시 대상 최대 HP 5% 피해");
  t=openBattle({skills:["M-G4-1","M-G4-4"],hp:50},{skills:["M-F1-1"]}); act("A",1); act("D",0); ok(t.a.hp===30,"MG4b 기본기 사용에는 번식 포자 피해 없음");
  t=openBattle({skills:["M-G5-1","M-G5-3"],hp:50},{hp:300,maxHp:300}); act("A",1); ok(300-t.d.hp===18&&t.a.hp===59,"MG5a 이끼 흡혈 — 💪90% · HP 피해의 50% 회복");
  t=openBattle({skills:["M-G5-1","M-G5-4"],hp:50},{skills:["M-F1-1"],hp:100}); act("A",1); act("D",0);
  ok(t.d.hp===100&&t.a.hp===30,"MG5b 이끼 잠식 — 부여 라운드 종료에는 없음"); /* REVISE 4차: R2 는 D 먼저 */ act("D",0); act("A",0); ok(t.d.hp===100-20-4&&t.a.hp===30-20+4,"MG5c 다음 라운드 종료 대상 4% 피해 · 같은 양 회복");
  t.B.phase=1; T.S.inv[1]=["cure"]; T.battleModal(); window.__useItemCore(0); T.TQ.length=0; eq(t.d.mossR,0,"MG5d 이끼 잠식은 해독제로 해제");
/* #241 CJ 승인(2026-09-17 스킬 정리) — 단순화 12: 포자 막 = 방어막 15% · 즉시 최대 HP 6% 회복 (막은 피해 50% 라운드 종료 회복 삭제) */
  t=openBattle({skills:["M-G6-1","M-G6-3"],hp:50},{skills:["M-F1-1"]}); act("A",1); ok(t.a.hp===56&&t.a.shield===15,"MG6a 포자 막 — 방어막 15 · 6 회복"); act("D",0); eq(t.a.hp,56-5,"MG6a2 라운드 종료 추가 회복 없음");
  t=openBattle({skills:["M-G6-1","M-G6-4"],hp:50},{}); T.shieldAdd(t.a,40,"x"); act("A",1);
  ok(t.a.hp===80&&t.a.shield===0&&t.a.absorbPct===0.3&&t.a.absorbR===2,"MG6b 균사 전환 — 방어막 → HP(최대 30%) · 2R 흡수 30%");
  /* 전설 */
  t=openBattle({skills:T.LEGEND_ROSTER[0].skills.slice(),legend:"dragon"},{hp:300,maxHp:300,element:"fire"});
  act("A",1); ok(t.a.shield===15&&t.a.hardenPct===0.15,"ML-D2 비늘 세우기 — 방어막 15% · 경화 15%");
  act("D",0); endRound(); act("A",2); ok(t.d.evadeDown===0.15&&t.d.evadeDownR===2,"ML-D3 날개 강타 — 대상 회피율 −15%p(2R) (#241 V1 CJ 승인 Q2 · 속도 −4 대체)");
  act("D",0); endRound(); endRound(); const hpD=t.d.hp; act("A",3); eq(hpD-t.d.hp,Math.round(20*1.4*1.3),"ML-D4 드래곤 숨결 — 속성 있는 상대 ×1.3");
  t=openBattle({skills:T.LEGEND_ROSTER[0].skills.slice(),legend:"dragon"},{hp:300,maxHp:300,element:null,legend:"witch"}); act("A",3); eq(300-t.d.hp,28,"ML-D5 무속성(전설) 상대 ×1.0");
  t=openBattle({skills:T.LEGEND_ROSTER[1].skills.slice(),legend:"witch",statusPct:1},{hp:300,maxHp:300}); t.d.burn=2;
  act("A",1); ok(t.d.weaken>0,"ML-W2 독약 병 — 걸려 있지 않은 약화 부여");
  t=openBattle({skills:T.LEGEND_ROSTER[1].skills.slice(),legend:"witch"},{}); T.shieldAdd(t.d,30,"x"); T.applyHarden(t.d,0.1,1); t.a.burn=2;
  act("A",2); ok(t.d.shield===0&&t.d.hardenPct===0.1&&t.a.burn===0,"ML-W3 변덕 주문 — 버프 1개(방어막 전 층) 제거 · 자기 상태이상 1개 해제");
  t=openBattle({skills:T.LEGEND_ROSTER[2].skills.slice(),legend:"reaper",hp:50},{hp:300,maxHp:300});
  act("A",1); ok(300-t.d.hp===26&&t.a.hp===58,"ML-R2 영혼 수확 — 💪130% · HP 피해 30% 회복");
  t=openBattle({skills:T.LEGEND_ROSTER[2].skills.slice(),legend:"reaper"},{hp:300,maxHp:300});
  act("A",2); ok(t.a.evadeBuff===0.25&&t.a.critForce,"ML-R3 죽음의 그림자 — 회피 +25% · 다음 피해 스킬 치명 확정");
  act("D",0); endRound(); act("A",0); ok(t.a.critForce===false,"ML-R3b 다음 피해 스킬에 소모");
  /* 왕 · 동료 시너지 스킬 (5.3) — #234 REVISE 3차 CJ 결정(2026-09-17 D4): 왕국 (2) 미달성이면 (2) 값을 쓰지 않는다 → 효과 없이 위력만.
     #235 전에는 왕국 집계가 없어 항상 미달성이다. 종전 MK1~MK5 는 (2) 값 효과를 기대했다(GDD 5.3 구 문언) — 결정에 따라 기대값을 바꾼다 */
  t=openBattle({skills:["K-1","K-2-fire","LD-REVENGE","LD-WRATH"],element:"fire"},{hp:600,maxHp:600});
  act("A",2); ok(!(t.d.burn>0)&&!(t.d.burnMag>0)&&600-t.d.hp===44,"MK1 동료의 복수 🔥 — 왕국 미달성: 💪220% 피해만 · 화상 없음");
  act("D",0); endRound(); endRound(); endRound(); const hpMK2=t.d.hp; act("A",3); ok(!(t.d.burn>0)&&hpMK2-t.d.hp===56,"MK2 왕의 분노 — 왕국 미달성: 💪280% 피해만 · 화상·지속 연장 없음");
  t=openBattle({skills:["K-1","K-2-water","LD-REVENGE","LD-WRATH"],element:"water"},{hp:600,maxHp:600});
  act("A",3); ok(!(t.d.weaken>0)&&!(t.d.weakenMag>0)&&600-t.d.hp===56,"MK3 왕의 분노 💧 — 왕국 미달성: 약화 없음 · 피해만");
  t=openBattle({skills:["K-1","K-2-land","LD-REVENGE"],element:"land"},{hp:600,maxHp:600}); act("A",2); ok(!(t.a.hardenPct>0)&&!(t.a.harden>0)&&600-t.d.hp===44,"MK4 동료의 복수 🗻 — 왕국 미달성: 자신 경화 없음 · 피해만");
  t=openBattle({skills:["K-1","K-2-grass","LD-REVENGE"],element:"grass",hp:50},{hp:600,maxHp:600}); act("A",2); ok(!(t.a.absorbPct>0)&&t.a.hp===50&&600-t.d.hp===44,"MK5 동료의 복수 🌿 — 왕국 미달성: 흡수·회복 없음 · 피해만");
  t=openBattle({skills:["K-1","K-2-lightning","LD-REVENGE"],element:"lightning"},{hp:600,maxHp:600}); act("A",2); ok(!(t.d.shock>0)&&600-t.d.hp===44,"MK1b 동료의 복수 ⚡ — 왕국 미달성: 감전 없음 · 피해만");
  t=openBattle({skills:["SH-1","SH-2-fire"],element:"fire",statusPct:1},{hp:600,maxHp:600}); act("A",1); ok(t.a.shield===15&&t.d.burn>0,"MK6 방패병 속성 스킬 — 💪120% · 방어막 15% · 효과");
  /* REVISE 1차 (Saturn 백업 QA 2026-09-17) — 결함 1: 마녀의 장난이 v2 실행기로 가면서 효과 0 */
  { const W=T.LEGEND_ROSTER[1].skills.slice();
    t=openBattle({skills:W,legend:"witch",hp:50,statusPct:0},{hp:300,maxHp:300}); fixRand(0.55); act("A",3); fixRand(0.5); // 분산 roll 0.55 → 16×0.98 반올림 16 · 조합 floor(0.55×6)=3 [약화·감전]
    ok(300-t.d.hp===16&&t.d.weaken>0&&t.d.shock>0&&!(t.d.burn>0)&&t.a.hp===50,"RV1a 마녀의 장난 — 💪80% · 조합 [약화·감전] 확률 판정 없이 둘 다 적용 (💫0)");
    t=openBattle({skills:W,legend:"witch",hp:50,statusPct:0},{hp:300,maxHp:300}); fixRand(0.45); act("A",3); fixRand(0.5); // 분산 roll 0.45 → 16×0.98 반올림 16 · 조합 floor(0.45×6)=2 [화상·풀 회복]
    ok(300-t.d.hp===16&&t.d.burn>0&&!(t.d.weaken>0)&&!(t.d.shock>0)&&t.a.hp===50+16,"RV1b 마녀의 장난 — 조합 [화상·풀 회복] · 이번 HP 피해 16 의 100% 회복");
    t=openBattle({skills:W,legend:"witch",hp:50,statusPct:0},{hp:300,maxHp:300,dodge:0.4}); T.S.battle.fd.dodgeForce=true; act("A",3);
    ok(t.d.hp===300&&!(t.d.burn>0)&&!(t.d.weaken>0)&&!(t.d.shock>0)&&t.a.hp===50,"RV1c 마녀의 장난 — 회피되면 대상 효과·회복 없음");
  }
  /* 결함 2: 사신의 낫이 execV2 앞 분기라 환영 무도 · 번식 포자를 우회 */
  { const R=T.LEGEND_ROSTER[2].skills.slice();
    const reap=o=>{ const t2=openBattle({skills:R,legend:"reaper",hp:10,maxHp:100},{skills:["M-F1-1"],hp:100,maxHp:100});
      t2.B.round=4; t2.a.cds=[0,0,0,0]; Object.assign(t2.a,o); return t2; };
    /* REVISE 2차 CJ 결정(2026-09-17): 사신의 낫은 행동 차단(환영 무도·수면 포자)도 무시하는 절대 판정 — REVISE 1차 RV2a~c 기대값을 뒤집는다.
       즉사가 반드시 성립해 전투가 끝나므로 번식 포자 피해는 적용할 틈이 없다 [추론·PD] */
    t=reap({nullifyNext:true}); act("A",3);
    ok(!T.S.battle&&t.d.hp===0&&!t.B.blog.some(x=>/환영 무도 — .*무효/.test(x)),"RV2a ③ 환영 무도가 걸려 있어도 사신의 낫은 즉사 (CJ 결정)");
    t=reap({breedR:2,breedBy:"D"}); act("A",3);
    ok(t.a.hp===10&&t.d.hp===0&&!t.B.blog.some(x=>/번식 포자 —/.test(x)),"RV2b 번식 포자 피해 없이 즉사 — 전투 종료로 정리 (CJ 결정 · [추론·PD])");
    t=reap({nullifyNext:true,breedR:2,breedBy:"D"}); act("A",3);
    ok(!T.S.battle&&t.d.hp===0&&t.a.hp===10,"RV2c QA 재현 조합(4R · 낮은 HP 비율 · 환영 무도 + 번식 포자)에서도 즉사 (CJ 결정)");
    t=reap({sleepNext:true});
    ok(t.a.sleepNext===true&&T.slotUsable(t.a,3,"A")===true,"RV2d ③ 수면 포자(기본기만) 상태에서도 사신의 낫은 합법 슬롯 (UI·AI 공통 slotUsable)");
    act("A",3); ok(!T.S.battle&&t.d.hp===0,"RV2e ③ 수면 포자 상태에서 사신의 낫 즉사");
    /* ① 결과 경감 효과 전부 — 방어막 · 철벽 돌파 1회 무효 · 과부하 방벽 · 천년목 */
    t=reap({}); Object.assign(t.d,{shield:500,nullHitR:1,nullHitN:1,overloadR:1,enduredR:1,enduredUsed:false}); act("A",3);
    ok(!T.S.battle&&t.d.hp===0&&!t.B.blog.some(x=>/철벽 — 피해 1회 무효|천년목 — 쓰러지지 않고/.test(x)),"RV2f ① 방어막·철벽 돌파·과부하·천년목을 모두 무시하고 즉사");
    /* ② 천년목은 일반 피해에는 계속 버틴다 (Q7 사신의 낫만 제외) */
    t=openBattle({skills:["M-G3-1","M-G3-4"],hp:90},{skills:["M-F1-1"],atk:200}); act("A",1); act("D",0);
    ok(!!T.S.battle&&t.a.hp===15&&t.a.enduredUsed,"RV2g ② 천년목은 일반 치명 피해를 계속 버틴다 (90 → 15)");
    /* ④ 봉인 해제 라운드 6 → 4 (CJ 결정) */
    t=reap({}); t.B.round=3;
    ok(T.BAL.reaperRound===4&&/4라운드부터/.test(T.reaperWhy("A")||"")&&T.slotUsable(t.a,3,"A")===false,"RV2h ④ 3라운드는 봉인 ("+T.reaperWhy("A")+")");
    t.B.round=4; ok(T.reaperWhy("A")===null&&T.slotUsable(t.a,3,"A")===true,"RV2i ④ 4라운드부터 사용 가능");
    /* ⑤⑥⑦ 전투를 넘는 봉인 — 같은 말(전투원 객체)로 전투를 이어 연다. 판정 종료는 실제 nextPhase 경로 */
    const judgeEnd=tt=>{ const Bx=T.S.battle; Bx.round=T.battleMaxRounds(); Bx.phase=1; tt.a.hp=90; tt.d.hp=30; T.nextPhase(); T.drain(20000); T.TQ.length=0; };
    const again=tt=>{ Object.assign(tt.d,{alive:true,hp:100,maxHp:100}); tt.a.alive=true; tt.a.hp=10; T.S.phase="play"; T.S.battle=null;
      T.startRounds(tt.a,tt.d,tt.a,tt.d); T.TQ.length=0; const Bx=T.S.battle; Bx.msgQ.length=0; Bx.round=4; tt.a.cds=tt.a.skills.map(()=>0); tt.B=Bx; return Bx; };
    t=reap({}); act("A",3);
    ok(!T.S.battle&&t.d.hp===0&&t.a.reaperSeal===2,"RV2j ⑤ 전투 1 사용 → 말에 봉인 기록(전투 종료 초기화 뒤에도 유지)");
    again(t);
    ok(t.a.reaperSeal===1&&/지난 전투에서 사용/.test(T.reaperWhy("A")||"")&&T.slotUsable(t.a,3,"A")===false,"RV2k ⑤ 전투 2 는 봉인 — 사유 표시 ("+T.reaperWhy("A")+")");
    T.byId("obBtns").children.length=0; T.battleModal();
    ok(/사신의 낫 \(봉인\)/.test(T.byId("overlayBox").innerHTML)&&/지난 전투에서 사용/.test(T.byId("overlayBox").innerHTML),"RV2k2 ⑤ 소유자 전투 화면에 (봉인)·사유가 보인다");
    act("A",3); ok(!!T.S.battle&&t.d.hp===100&&!t.B.blog.some(x=>/사신의 낫/.test(x)),"RV2l ⑤ 봉인 중 호출은 즉사 없음 · 공용 로그에 이름 없음");
    /* ⑦ 쿨링수로 봉인이 풀리지 않는다 */
    t.a.cds=t.a.skills.map(()=>2); t.B.itemRoundA=false; T.S.inv[0]=["cool"];
    t.B.phase=(t.B.firstSide==="A")?0:1; T.byId("obBtns").children.length=0; T.battleModal(); T.__useItemCore(0); T.TQ.length=0;
    ok(t.a.cds.every(c=>c===0)&&t.a.reaperSeal===1&&/지난 전투에서 사용/.test(T.reaperWhy("A")||"")&&T.slotUsable(t.a,3,"A")===false,"RV2m ⑦ 쿨링수로 쿨 0 이 돼도 전투 간 봉인은 유지 (cds "+JSON.stringify(t.a.cds)+")");
    judgeEnd(t); ok(!T.S.battle&&t.a.reaperSeal===1,"RV2n ⑤ 봉인 전투 종료 뒤에도 말 상태 유지 (다음 참전 시 해제)");
    again(t);
    ok(t.a.reaperSeal===0&&T.reaperWhy("A")===null&&T.slotUsable(t.a,3,"A")===true,"RV2o ⑤ 전투 3 사용 가능");
    act("A",3); ok(!T.S.battle&&t.d.hp===0&&t.a.reaperSeal===2,"RV2p ⑤ 전투 3 즉사 → 다시 봉인 기록");
    /* ⑥ 사용하지 않은 전투 뒤에는 봉인되지 않는다 */
    t=reap({}); judgeEnd(t);
    ok(!T.S.battle&&!(t.a.reaperSeal>0),"RV2q ⑥ 사용하지 않은 전투 종료 — 봉인 없음");
    again(t); ok(T.reaperWhy("A")===null&&T.slotUsable(t.a,3,"A")===true,"RV2r ⑥ 다음 전투 4R 에서 바로 사용 가능");
  }
  /* 흡수 · 회피(자기 대상) */
  t=openBattle({skills:["M-G1-1","M-G1-2"],statusPct:1,hp:50},{hp:300,maxHp:300}); act("A",1);
  ok(t.a.absorbR===1&&t.a.hp===50+Math.round(28*0.2),"MX1 흡수 70% 당첨 — 그 공격 HP 피해 20% 회복 (Q9 확정)");
  t=openBattle({skills:["M-G1-1","M-G1-2"],statusPct:1},{dodge:0.4}); T.S.battle.fd.dodgeForce=true; act("A",1);
  ok(t.a.absorbR===1&&t.d.hp===100,"MX2 공격이 회피돼도 자기 대상 흡수 부여는 유지");
  t=openBattle({skills:["M-F3-1","M-F3-2"],statusPct:0},{}); fixRand(0.99); act("A",1); fixRand(0.5);
  ok(t.a.hardenPct===0.1&&t.d.burn===0,"MX3 방어형 2차 — 효과 판정 실패해도 자기 경화 10%는 확정");
}
unfix();

/* ===================== E. 과도기 경계 ===================== */
{
  eq(T.V2_INTERP.recruitSkillSwap,false,"E1 [CJ 결정 2026-09-17] 탐색 기술 교체 비활성");
  H.freshPlay(T,"pvp");
  const own=0, p=T.S.pieces.find(x=>x.owner===0&&x.type==="minion"&&x.placed);
  T.S.recruit={owner:own,pieceId:p.id,species:"M-E3",stage:"root",skill:null,targetId:null,recvId:null,token:1};
  window.__recruitCore("skills",0); eq(T.S.recruit&&T.S.recruit.stage,"root","E2 '기술 교체' 단계로 진입하지 않는다 (코어 거부)");
  window.__recruitCore("skill",0); ok(T.S.recruit&&T.S.recruit.skill===null,"E3 기술 선택도 거부");
  const recv=T.capReceivers(own)[0]; T.S.balls[own]=2;
  window.__recruitCore("cap",0); window.__recruitCore("recv",0); window.__recruitCore("mode",0); T.TQ.length=0;
  ok(recv.cap&&recv.cap.rosterId==="M-E3"&&recv.cap.grade===1&&recv.cap.skills.length===1&&recv.cap.skills[0]==="M-E3-1"&&recv.cap.cds.length===1,"E4 하수인 포획은 유지 — 30종 후보(땅 포함) · ⭐1 · 1차 기본기");
  const ks=T.S.pieces.filter(x=>x.type==="minion"&&x.owner===1);
  ok(ks.every(m=>!T.SKILLS[m.skills[0]].reaper),"E5 일반 하수인에 전설 스킬 없음");
}

/* ===================== N. 공개 방 수신 경로 — reaperSeal (REVISE 2차 Mars 후속) =====================
   서버는 소유자 좌석 프레임(you.pieces·you.reserve·자기 전투원)에만 reaperSeal 을 보낸다(Jupiter 보고서 REVISE 2차 2절).
   실제 netApplyRoomState → netBuildAuthoritativeBoard → netStubPiece/netSynthBattle 경로로 받은 뒤 로컬과 같은 reaperWhy·slotUsable 을 본다. */
{
  const N=H.load(htmlPath); N.NET.me=0;
  const R=N.LEGEND_ROSTER[2].skills.map(id=>({id,revealed:true,cd:0}));
  const side=o=>Object.assign({owner:0,hp:10,maxHp:100,shield:0,burn:0,weaken:0,shock:0,shockFresh:false,dmgCut:0,focusCharge:false,vulnMark:false,
    skills:null,rec:0,items:0,itemRound:false,lastItem:null,ballThrow:false,buff:null,type:"ally",element:null,bodyFight:true,rosterId:null,artRosterId:null,atk:10,skillAtk:10},o);
  const own=o=>Object.assign({id:"u-m1",r:10,c:4,owner:0,type:"ally",element:null,name:null,hp:10,maxHp:100,atk:10,skillAtk:10,rosterId:null,skills:R,cdMax:0,immobile:0,cap:null,alive:true,placed:true,movedEver:true,revealed:true},o);
  const frame=(sealA,sealD)=>{ const a=side({owner:0,skills:R}), d=side({owner:1,hp:100}), me=own({});
    if(sealA!==undefined){ a.reaperSeal=sealA; me.reaperSeal=sealA; }
    if(sealD!==undefined) d.reaperSeal=sealD;
    return {seat:0,state:"IN_PROGRESS",phase:"play",revision:1,turnCount:9,current:0,mainUsed:false,battlesUsed:0,seats:{ready:[true,true]},
      units:[{id:"u-o1",r:4,c:4,owner:1,alive:true,immobile:0}],
      you:{pieces:[me],inv:[],balls:0,reserve:own({id:"u-r1",r:-1,c:-1,reaperSeal:sealA}),pkgs:{itemGift:0,battleBuff:0},selected:null,placed:true,teleUsed:0},
      battle:{battleId:1,round:4,phase:0,actor:"A",actSeq:0,maxRounds:null,log:[],a,d},fleePick:null,modal:null,log:[],events:[],result:null,turn:null,fx:{firstSeq:null,lastSeq:0,events:[]}}; };
  N.netApplyRoomState(frame(1),false);
  const mine=N.S.pieces.find(p=>p.id==="u-m1"), opp=N.S.pieces.find(p=>p.id==="u-o1");
  ok(mine.reaperSeal===1&&N.S.reserve[0].reaperSeal===1&&N.S.battle.fa.reaperSeal===1&&/지난 전투에서 사용/.test(N.reaperWhy("A")||"")&&N.slotUsable(N.S.battle.fa,3,"A")===false,
    "NR1 소유자 프레임 reaperSeal=1 → 말·예비·자기 전투원에 복사 · 봉인 사유 · 슬롯 비활성 ("+N.reaperWhy("A")+")");
  ok(opp.reaperSeal===0&&N.S.battle.fd.reaperSeal===0,"NR2 상대 말·상대 전투원은 키가 없어 0");
  N.netApplyRoomState(frame(undefined),false);
  ok(N.S.pieces.find(p=>p.id==="u-m1").reaperSeal===0&&N.S.battle.fa.reaperSeal===0&&N.reaperWhy("A")===null&&N.slotUsable(N.S.battle.fa,3,"A")===true,
    "NR3 키가 없으면 0 — 4R · HP 비율 낮음 조건에서 사용 가능");
}

/* ===== REVISE 3차 — CJ 결정 2026-09-17 (P13 · P14 · I1) ===== */
{ fixRand(0.5); // 분산 1.0 · 치명 0% · 회피 0%
  const R=T.LEGEND_ROSTER[2].skills; // [낫 베기, 영혼 수확, 죽음의 그림자, 사신의 낫]
  const reaperD=()=>({skills:[R[0],R[3],R[1]],hp:300,maxHp:300,legend:"reaper"}); // 사신의 낫을 ⌛0 · 앞 슬롯에 둔다 — 종전 규칙이면 동결 대상
  /* P13 사신의 낫은 어떤 스킬로도 막을 수 없다 — ⌛ 증가 대상 제외 */
  let t=openBattle({skills:["M-W3-1","M-W3-3"]},reaperD());
  act("A",1); ok(t.d.cds[1]===0&&t.d.cds[2]===1&&t.d.cds[0]===0,"P13a 동결 — 사신의 낫(⌛0·앞 슬롯) 제외 · 다음 후보(영혼 수확) ⌛ +1");
  t.B.round=4; t.d.hp=10; ok(T.slotUsable(t.d,1,"D"),"P13b 동결 뒤에도 4R · HP 열세면 사신의 낫 사용 가능");
  t=openBattle({skills:["M-W3-1","M-W3-3"]},{skills:[R[0],R[3]],hp:300,maxHp:300,legend:"reaper"});
  act("A",1); ok(t.d.cds[0]===0&&t.d.cds[1]===0,"P13c 기본기 · 사신의 낫뿐이면 동결은 아무 ⌛도 늘리지 않는다");
  t=openBattle({skills:["M-L5-1","M-L5-3"]},reaperD()); t.d.shock=1;
  act("A",1); ok(t.d.cds[1]===0&&t.d.cds[2]===1,"P13d 자기장 — 감전 대상이어도 사신의 낫 제외 · 다음 후보 ⌛ +1");
  /* P14 '다음 피해 스킬' 1회성 효과는 회피돼도 소모 */
  t=openBattle({skills:R.slice(),legend:"reaper"},{hp:300,maxHp:300});
  act("A",2); act("D",0); endRound(); t.d.dodgeForce=true; act("A",0);
  ok(t.d.hp===300&&t.a.critForce===false,"P14a 죽음의 그림자 확정 치명 — 회피된 타격에서 소모");
  act("D",0); endRound(); act("A",0); eq(300-t.d.hp,20,"P14b 소모 뒤 다음 피해 스킬(기본기)은 치명 확정 아님 (20)");
  t=openBattle({skills:["M-E3-1","M-E3-4"]},{hp:300,maxHp:300});
  act("A",1); act("D",0); endRound(); t.d.dodgeForce=true; act("A",0);
  ok(t.d.hp===300&&t.a.nextPowUp===0,"P14c 철벽 돌파 +80%p — 회피돼도 소모");
  act("D",0); endRound(); act("A",0); eq(300-t.d.hp,20,"P14d 다음 기본기는 💪100% 그대로");
  t=openBattle({skills:["M-F1-1"]},{hp:300,maxHp:300});
  /* #241: 달군 비늘·축전·모래바람·충전 1회성 필드는 단순화·교체로 삭제 — P14e 는 남은 위력+ 로 본다 */
  Object.assign(t.a,{nextPowUp:0.5}); t.d.dodgeForce=true; act("A",0);
  ok(t.d.hp===300&&t.a.nextPowUp===0,"P14e 위력+ 1회성 — 회피돼도 소모");
  /* I1 조준 사격 확정 치명은 그 타격 한정 */
  t=openBattle({skills:["M-F2-1","M-F2-3"]},{hp:300,maxHp:300}); t.d.burn=2; t.d.dodgeForce=true;
  act("A",1); ok(t.d.hp===300&&t.a.critForce===false,"I1a 조준 사격 회피 — 확정 치명 플래그가 남지 않는다");
  act("D",0); endRound(); let hp0=t.d.hp; act("A",0); eq(hp0-t.d.hp,20,"I1b 회피된 조준 사격 뒤 기본기는 치명 확정 아님 (20)");
  t=openBattle({skills:["M-F2-1","M-F2-3"]},{hp:300,maxHp:300}); t.d.burn=2;
  act("A",1); ok(300-t.d.hp===36&&t.a.critForce===false,"I1c 적중 — 그 타격만 치명 (36) · 플래그 없음");
  act("D",0); endRound(); hp0=t.d.hp; act("A",0); eq(hp0-t.d.hp,20,"I1d 적중한 조준 사격 뒤 기본기도 치명 확정 아님");
  t=openBattle({skills:["M-F2-1","M-F2-3"]},{hp:300,maxHp:300}); t.a.critForce=true;
  act("A",1); ok(300-t.d.hp===36&&t.a.critForce===false,"I1e 죽음의 그림자 확정 치명은 화상 아닌 대상의 조준 사격에서도 1회 소모 (섞이지 않음)");
  unfix();
}

/* ===== REVISE 4차 — CJ 결정 2026-09-17: 속도는 1라운드 선턴 판별에만, 2라운드부터 기존(v0.4.10) 교대 =====
   원문: "속도는 첫 라운드 선턴 판별만 진행하고, 나머지는 전부 기존 전투 방식대로 진행해야 돼."
   홀수 라운드 = R1 선턴 측 · 짝수 라운드 = 반대 측. 감전·선턴 효과는 그 라운드 순서만 뒤집는다. */
{
  fixRand(0.5);
  const fs=B=>T.decideFirstSide(B);
  eq(fs({round:1,fa:{spd:6},fd:{spd:14}}),"D","O1 R1 은 속도로 판정 (빠른 D 선턴)");
  eq(fs({round:2,firstSideR1:"A",fa:{spd:1},fd:{spd:99}}),"D","O1b R2 는 속도와 무관하게 R1 반대 측");
  eq(fs({round:3,firstSideR1:"A",fa:{spd:1},fd:{spd:99}}),"A","O1c R3 은 R1 선턴 측");
  eq(fs({round:2,firstSideR1:"A",fa:{spd:1,grade:1},fd:{spd:1,grade:4}}),"D","O1d R2 는 등급·접촉도 다시 보지 않는다");
  let t=openBattle({spd:6},{spd:14});
  ok(t.B.firstSide==="D"&&t.B.firstSideR1==="D"&&T.actorOfPhase()==="D","O2 실제 전투 R1 — 빠른 D 선턴 · R1 기준 기록");
  endRound(); ok(t.B.round===2&&t.B.firstSide==="A"&&T.actorOfPhase()==="A","O3 R2 — 속도가 더 빠른 D 도 후순 (교대)");
  endRound(); ok(t.B.round===3&&t.B.firstSide==="D","O4 R3 — 다시 R1 선턴 측 D");
  /* 속도 증가·감소는 R2 이후 순서를 바꾸지 않는다 (모래바람·모래 폭풍·날개 강타·충전) */
  t=openBattle({spd:14},{spd:6});
  /* #241 V1: 속도 감소는 폐지(회피율 감소로) — 남은 속도 증가 버프로 본다 */
  t.d.spdBuff=50; endRound(); eq(t.B.firstSide,"D","O5 R2 — 속도 증가와 무관하게 기준 교대 D");
  t.d.spdBuff=90; endRound(); eq(t.B.firstSide,"A","O6 R3 — 속도 증가와 무관하게 R1 측 A");
  /* 감전이 기준 선순 쪽에 걸리면 그 라운드만 뒤집힌다 */
  t=openBattle({spd:14},{spd:6});
  t.d.shock=1; t.d.shockFresh=true; endRound();
  ok(t.B.round===2&&t.d.shock>0&&t.B.firstSide==="A","O7 R2 기준 선순 D 가 감전 → A 가 먼저");
  endRound(); ok(!(t.d.shock>0)&&t.B.firstSide==="A","O7b R3 감전 해제 — 기준 A");
  endRound(); eq(t.B.firstSide,"D","O7c R4 — 기준 D 로 복귀 (뒤집힘은 그 라운드만)");
  /* 양측 모두 감전이면 기준을 따른다 */
  t=openBattle({spd:14},{spd:6});
  t.a.shock=1; t.a.shockFresh=true; t.d.shock=1; t.d.shockFresh=true; endRound();
  ok(t.a.shock>0&&t.d.shock>0&&t.B.firstSide==="D","O8 R2 양측 감전 → 기준 교대 D");
  /* 선턴 효과가 기준 후순 쪽에 있으면 앞당긴다 (꺼지지 않는 불티) */
  t=openBattle({skills:["M-F4-1","M-F4-4"],spd:14},{hp:300,maxHp:300,spd:6}); t.d.burn=3;
  act("A",1); ok(t.a.vanguardTurn>0,"O9 전제: 꺼지지 않는 불티 — 다음 라운드 선턴 효과");
  endRound(); ok(t.B.round===2&&t.B.firstSide==="A","O9b R2 기준 후순 A 가 선턴 효과로 먼저");
  /* 선턴 결과를 읽는 스킬은 새 순서를 쓴다 — 번개 발도(선턴일 때만) */
  t=openBattle({skills:["M-L2-1","M-L2-3"],spd:14},{spd:6});
  ok(T.slotUsable(t.a,1,"A"),"O10 R1 선턴 A — 번개 발도 사용 가능");
  endRound(); ok(t.B.firstSide==="D"&&!T.slotUsable(t.a,1,"A"),"O10b R2 교대로 후순 — 번개 발도 불가 (속도가 빨라도)");
  /* 시간의 수호자 3R 전투에서도 같은 규칙 */
  t=openBattle({spd:6},{spd:14}); t.B.maxRounds=3;
  const order=[t.B.firstSide]; endRound(); order.push(t.B.firstSide); endRound(); order.push(t.B.firstSide);
  eq(order.join(""),"DAD","O11 시간의 수호자 3R — R1 속도(D) · R2 교대(A) · R3 R1 측(D)");
  endRound(); ok(T.S.battle!==t.B,"O11b 3R 종료 후 판정으로 전투 종료");
  unfix();
}

console.log(`smoke_issue234: ${pass} pass / ${fail} fail`);
if(fail){ console.error(fails.join("\n")); process.exit(1); }
