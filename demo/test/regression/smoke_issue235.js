/* #235 시너지 — 왕국(속성) · 아키타입 · 전설 직접 참전 패시브 · 동료 사망 🪄 칸 집중 회귀
   실행: node demo/test/regression/smoke_issue235.js [demo/index.html]
   파일을 쓰지 않는다 (Saturn --read-only 재실행 안전).

   절
     N  승인 수치표 대조 (왕국 4단계 · 아키타입 5단계 · 전설 패시브)
     C  집계 경계 — 필드 9칸 · 사망/포획 칸 동결 · 가방 제외 · 전설/무속성 0 · 가방 전설 타입 집계
     F  참전 확정 순간 스냅샷 고정 — 전투 중 변화는 다음 전투부터
     A  아키타입 수혜 — 참전자 전원 · 타입별 상한 · 2 미만 무효 · 기존 상한 보존
     K  왕국 수혜 — 같은 속성 참전자 · 스킬당 1판정 · 회피 미발동 · 방어막 흡수도 적중 · 도망 실패 평타 미발동
     L  전설 직접 참전 — 용 · 마녀 · 사신 · 가방 대기 전설 미적용
     R  동료 사망 🪄 칸과 왕국 (2) 미달 무효 (V2_KINGDOM_STAGE2 연결점)
     V  소유자 전용 selector (상대 집계 비노출)
   모든 검사는 실제 엔진 경로(startRounds → applySynergy → execSlot → execV2 → resolveHit)로 몰아서 본다. */
"use strict";
const path=require("path");
const H=require("../shared/harness");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","index.html");
const T=H.load(htmlPath);
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
function eq(got,want,name){ ok(got===want,name+` [기대 ${JSON.stringify(want)} · 실측 ${JSON.stringify(got)}]`); }
const near=(a,b)=>Math.abs(a-b)<1e-9;

const realRandom=Math.random;
const RC={n:0};
function fixRand(v){ T.setSeed(null); RC.n=0; Math.random=()=>{RC.n++; return v;}; }
function unfix(){ Math.random=realRandom; T.setSeed(null); }

/* ===== 필드 9칸 픽스처 — 하수인 6칸(ROSTER id · 전설 key · null=미배치) + 왕 1 + 동료 2 ===== */
const LEGEND_KEYS=T.LEGEND_ROSTER.map(L=>L.key);
function board(){ H.freshPlay(T,"pvp"); H.clearBoard(T); T.S.reserve=[null,null]; return T.S; }
function field(p,spec){
  const S=T.S, row=p===0?11:1, row2=p===0?12:2;
  S.pieces.filter(x=>x.owner===p&&x.type==="minion").forEach((m,i)=>{
    const id=spec.minions[i]; m.placed=false; m.alive=true;
    if(!id) return;
    if(LEGEND_KEYS.includes(id)) T.applyLegend(m,id);
    else T.applySpecies(m,T.ROSTER.find(r=>r.id===id),1);
    H.place(T,m,row,i+1);
  });
  const k=S.pieces.find(x=>x.owner===p&&x.type==="king");
  k.leaderElChosen=true; k.element=spec.el||null; k.placed=false; k.alive=true;
  if(spec.king!==false) H.place(T,k,row2,1);
  S.pieces.filter(x=>x.owner===p&&x.type==="ally").forEach((a,i)=>{
    a.leaderElChosen=true; a.element=spec.el||null; a.placed=false; a.alive=true;
    if(i<(spec.allies===undefined?2:spec.allies)) H.place(T,a,row2,i+2);
  });
  T.syncOwnerLeaders(p);
  return S;
}
const six=id=>[id,id,id,id,id,id];
function fighterOf(p,idx){ return T.S.pieces.filter(x=>x.owner===p&&x.type==="minion")[idx]; }
function battle(A,D){ T.S.battle=null; T.S.battlesUsed=0; T.TQ.length=0; T.startRounds(A,D,A,D); T.TQ.length=0; T.S.battle.msgQ.length=0; return T.S.battle; }
function act(side,slot){ const B=T.S.battle; B.phase=(B.firstSide===side)?0:1; T.execSlot(side,slot); T.TQ.length=0; if(T.S.battle) T.S.battle.msgQ.length=0; }
/* 상대를 "맞고 버티는 허수아비"로 — 회피 0 · 방어 0 · HP 충분 */
function dummy(f){ f.hp=9999; f.maxHp=9999; f.dodge=0; f.def=0; f.synDef=0; f.synDodge=0; f.crit=0; }

fixRand(0.5); // 회피 0 · 분산 ×1.0 · 치명 없음 · 확률 0.5 미만 효과는 발동하지 않는다

/* ===================== N. 승인 수치표 대조 ===================== */
{
  /* 승인 계약을 스위트 안에 따로 옮겨 적고 제품 표와 대조한다 — 한쪽만 고치면 떨어진다 */
  const SPEC={
    fire:     {kind:"burn",  p:[0.20,0.40,0.60,1.00], mag:[0.02,0.04,0.06,0.10], rounds:1},
    water:    {kind:"weaken",p:[0.25,0.45,0.65,1.00], mag:[0.04,0.08,0.12,0.20], hits:1},
    lightning:{kind:"shock", p:[0.15,0.30,0.45,0.70], rounds:1},
    land:     {kind:"harden",p:[0.20,0.40,0.60,1.00], mag:[0.03,0.06,0.09,0.15], rounds:1},
    grass:    {kind:"absorb",p:[0.20,0.40,0.60,1.00], mag:[0.10,0.20,0.30,0.50], rounds:1}
  };
  eq(JSON.stringify(T.V2_KINGDOM_STEPS),"[2,4,6,9]","N1 왕국 단계 = (2)(4)(6)(9)");
  let bad=[];
  for(const el of Object.keys(SPEC)){
    const s=SPEC[el], tbl=T.V2_KINGDOM_STAGES[el];
    if(!tbl||tbl.length!==4){ bad.push(el+":길이"); continue; }
    tbl.forEach((e,i)=>{
      if(e.kind!==s.kind) bad.push(el+i+":kind");
      if(!near(e.p,s.p[i])) bad.push(el+i+":p="+e.p);
      if(s.mag&&!near(e.mag,s.mag[i])) bad.push(el+i+":mag="+e.mag);
      if(s.rounds!==undefined&&e.rounds!==s.rounds) bad.push(el+i+":rounds");
      if(s.hits!==undefined&&e.hits!==s.hits) bad.push(el+i+":hits");
    });
  }
  ok(bad.length===0,"N2 왕국 4단계 확률·수치·지속이 승인표와 같다: "+JSON.stringify(bad));
  /* #234 가 예약해 둔 소비자 이름은 단계 (2) 줄 그 자체다 (값을 두 곳에 적지 않는다) */
  ok(Object.keys(T.V2_KINGDOM_STAGES).every(el=>T.V2_KINGDOM_STAGE2[el]===T.V2_KINGDOM_STAGES[el][0]),
    "N3 V2_KINGDOM_STAGE2 = 각 속성 단계 (2) 줄 (예약 소비자 연결)");

  const ASPEC={
    std:    [{atk:0.03,def:3,spd:1},{atk:0.05,def:5,spd:1},{atk:0.07,def:7,spd:2},{atk:0.09,def:9,spd:2},{atk:0.12,def:12,spd:3}],
    atk:    [{crit:0.05},{crit:0.10},{crit:0.15},{crit:0.20},{crit:0.25}],
    def:    [{def:5},{def:10},{def:15},{def:20}],
    swift:  [{spd:1,dodge:0.03},{spd:2,dodge:0.06},{spd:3,dodge:0.09},{spd:4,dodge:0.12}],
    sustain:[{statusPct:0.05},{statusPct:0.10},{statusPct:0.15},{statusPct:0.20},{statusPct:0.25}],
    guard:  [{shieldPct:0.05},{shieldPct:0.08},{shieldPct:0.11},{shieldPct:0.14}]
  };
  eq(JSON.stringify(T.V2_ARCH_STEPS),"[2,3,4,5,6]","N4 아키타입 단계 = 2·3·4·5·6");
  const abad=[];
  for(const a of Object.keys(ASPEC)){
    const want=ASPEC[a], got=T.V2_ARCH_SYN[a];
    if(!got||got.length!==want.length) abad.push(a+":길이 "+(got?got.length:"없음"));
    else want.forEach((w,i)=>{ if(JSON.stringify(Object.keys(w).sort().map(k=>[k,w[k]]))!==JSON.stringify(Object.keys(got[i]).sort().map(k=>[k,got[i][k]]))) abad.push(a+i); });
  }
  ok(abad.length===0,"N5 아키타입 5단계 수치가 승인표와 같다 · 방어·속공·보호는 5단계까지: "+JSON.stringify(abad));
  ok(near(T.V2_LEGEND_SYN.witch.statusPct,0.05)&&near(T.V2_LEGEND_SYN.witch.max,0.25)
    &&near(T.V2_LEGEND_SYN.reaper.atk,0.05)&&near(T.V2_LEGEND_SYN.reaper.max,0.40),
    "N6 전설 패시브 — 마녀 💫 +5%p(최대 25) · 사신 💪 +5%(최대 40)");
}

/* ===================== C. 집계 경계 ===================== */
{
  board();
  field(0,{minions:six("M-F1"),el:"fire"});          // 불 6 + 왕 + 동료 2 = 9칸
  const s=T.synCount(0,T.S);
  eq(s.el.fire,9,"C1 필드 9칸 = 하수인 6 + 왕 1 + 동료 2");
  eq(s.arch.std,6,"C2 아키타입은 필드 하수인 6칸만 센다 (왕·동료 제외)");
  eq(T.synKingdomStage(s,"fire"),3,"C3 달성 단계는 최고 하나 — 9칸이면 (9)");
  eq(s.dead,0,"C4 사망 칸 0");

  // 사망 칸 동결 — 죽어도 그 자리는 그대로 센다. 사망 수(사신 패시브 입력)만 오른다.
  fighterOf(0,0).alive=false; T.S.pieces.find(x=>x.owner===0&&x.type==="ally").alive=false;
  const s2=T.synCount(0,T.S);
  eq(s2.el.fire,9,"C5 사망 칸 동결 — 하수인·동료가 죽어도 속성 칸 수는 줄지 않는다");
  eq(s2.arch.std,6,"C6 사망 칸 동결 — 타입 칸 수도 줄지 않는다");
  eq(s2.dead,2,"C7 사망 하수인+동료 칸 수만 오른다 (왕 제외)");

  // 가방은 왕국 집계에서 빠진다
  board(); field(0,{minions:["M-F1",null,null,null,null,null],el:"fire",allies:0,king:false});
  T.S.reserve[0]={element:"fire",hp:70,maxHp:100,atk:20,skills:[],cds:[]};
  eq(T.synCount(0,T.S).el.fire,1,"C8 가방(예비 하수인)은 왕국 9칸에 들어가지 않는다");

  // 전설·무속성은 왕국 0, 타입은 센다
  board(); field(0,{minions:["dragon","witch",null,null,null,null],el:null,allies:0,king:false});
  const s3=T.synCount(0,T.S);
  eq(Object.keys(s3.el).reduce((a,k)=>a+s3.el[k],0),0,"C9 전설·무속성 칸은 왕국 0");
  ok(s3.arch.std===1&&s3.arch.sustain===1,"C10 필드 전설은 자기 아키타입으로 집계 (용=표준 · 마녀=지속)");
  fighterOf(0,0).alive=false;
  eq(T.synCount(0,T.S).arch.std,1,"C11 필드 사망 전설도 타입 동결 — 그대로 집계");

  // 가방 전설은 타입만 집계하고 살아 있는 전설은 한 번만
  board(); field(0,{minions:["reaper",null,null,null,null,null],el:null,allies:0,king:false});
  T.S.reserve[0]={element:null,legend:"reaper",hp:100,maxHp:158,atk:40,skills:[],cds:[]};
  eq(T.synCount(0,T.S).arch.atk,2,"C12 가방 전설도 타입 집계 — 필드 1 + 가방 1 (각 1회)");
  T.S.reserve[0]=null;
  eq(T.synCount(0,T.S).arch.atk,1,"C13 대리로 나가 진 가방 전설은 그 자리에서 빠진다");
}

/* ===================== F. 참전 확정 순간 스냅샷 고정 ===================== */
{
  board();
  field(0,{minions:six("M-F1"),el:"fire"});
  field(1,{minions:six("M-W1"),el:"water"});
  const a=fighterOf(0,0), d=fighterOf(1,0);
  const B=battle(a,d); dummy(B.fd);
  const before=JSON.stringify(B.syn[0]);
  ok(B.syn&&B.syn[0]&&B.syn[1],"F1 전투 인스턴스가 양 좌석 스냅샷을 들고 있다");
  // 전투 중에 다른 필드 칸이 죽어도 이번 전투의 집계는 움직이지 않는다
  fighterOf(0,5).alive=false; T.S.pieces.find(x=>x.owner===0&&x.type==="ally").alive=false;
  eq(JSON.stringify(B.syn[0]),before,"F2 전투 중 사망은 이번 전투 스냅샷을 바꾸지 않는다 (전투 종료까지 고정)");
  eq(B.fa.synEl&&B.fa.synEl.kind,"burn","F3 참전자는 자기 왕국 효과를 들고 싸운다");
  // 다음 전투는 바뀐 칸을 반영한다
  T.S.battle=null;
  const B2=battle(fighterOf(0,1),fighterOf(1,1));
  eq(B2.syn[0].dead,2,"F4 다음 전투부터 사망 칸이 반영된다");
  eq(B2.syn[0].el.fire,9,"F5 사망해도 속성 칸은 동결 — 다음 전투에서도 9");
}

/* ===================== A. 아키타입 수혜 ===================== */
{
  board();
  field(0,{minions:six("M-F1"),el:"fire"});       // 표준형 6 → 6단계
  field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0}); // 표준 1 → 2 미만
  const B=battle(fighterOf(0,0),fighterOf(1,0));
  ok(near(B.fa.synAtk,0.12)&&B.fa.synDef===12&&B.fa.synSpd===3,"A1 표준 6칸 → 💪+12% · 방어 +12 · 속도 +3");
  ok(B.fd.synAtk===0&&B.fd.synDef===0&&B.fd.synSpd===0,"A2 2 미만은 아무 효과도 없다");
  ok(near(T.effAtk(B.fa),B.fa.atk*1.12),"A3 💪 가산은 유효 공격력에만 들어간다 (기본 스탯 f.atk 불변)");
  eq(T.effSpd(B.fa),B.fa.spd+3,"A4 속도 가산이 1라운드 선턴 판정 입력에 들어간다");

  // 왕·동료·대리 참전자도 같은 수혜를 받는다 (타입 집계에는 들어가지 않는다)
  T.S.battle=null;
  const king=T.S.pieces.find(x=>x.owner===0&&x.type==="king");
  const B2=battle(king,fighterOf(1,0));
  ok(near(B2.fa.synAtk,0.12)&&B2.fa.synDef===12,"A5 왕·동료도 활성화된 타입 효과를 그대로 받는다");

  // 타입별 상한 — 방어·속공·보호는 6칸이어도 5단계 값
  board(); field(0,{minions:six("M-F3"),el:"fire"}); // 방어형 6
  let bon=T.synArchBonus(T.synCount(0,T.S));
  eq(bon.def,20,"A6 방어형은 6칸이어도 5단계(+20) — 6단계 없음");
  board(); field(0,{minions:six("M-F4"),el:"fire"}); // 속공형 6
  bon=T.synArchBonus(T.synCount(0,T.S));
  ok(bon.spd===4&&near(bon.dodge,0.12),"A7 속공형은 6칸이어도 5단계(속도 +4 · 회피 +12%p)");
  board(); field(0,{minions:six("M-F6"),el:"fire"}); // 보호형 6
  bon=T.synArchBonus(T.synCount(0,T.S));
  ok(near(bon.shieldPct,0.14),"A8 보호형은 6칸이어도 5단계(+14%)");

  // 보호형 방어막은 기본 10% 층과 합산돼 전투 시작에 1회 붙는다
  board();
  field(0,{minions:six("M-F6"),el:"fire"});
  field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0});
  const B3=battle(fighterOf(0,0),fighterOf(1,0));
  eq(B3.fa.shield,Math.round(B3.fa.maxHp*0.10)+Math.round(B3.fa.maxHp*0.14),"A9 보호형 시작 방어막 = 기본 10% 층 + 시너지 14% 층");
  eq(B3.fd.shield,0,"A10 상대는 보호형 시너지가 없으므로 방어막 0");

  // 기존 상한 보존 — 회피 40% · 치명 50%
  board();
  field(0,{minions:six("M-F4"),el:"fire"});
  field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0});
  const B4=battle(fighterOf(0,0),fighterOf(1,0));
  B4.fa.dodge=0.35;
  ok(near(T.effEvade(B4.fa),0.40),"A11 회피 상한 40% 유지 (기본 35% + 시너지 12%p → 40%)");
}

/* ===================== K. 왕국 수혜 ===================== */
{
  // 불 9칸 → 단계 (9) = 화상 100% · 최대 HP 10% · 1R
  const openFire=()=>{ board();
    field(0,{minions:six("M-F1"),el:"fire"});
    field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0,king:false}); // 물 1칸 = (2) 미달
    const B=battle(fighterOf(0,0),fighterOf(1,0)); dummy(B.fd); B.fd.element=null; return B; };

  let B=openFire();
  ok(B.fa.synEl&&near(B.fa.synEl.p,1.00)&&near(B.fa.synEl.mag,0.10),"K1 같은 속성 참전자가 단계 (9) 값을 받는다");
  eq(B.fd.synEl,null,"K2 (2) 미달 속성의 참전자는 왕국 효과가 없다");
  act("A",0);
  ok(B.fd.burn>0&&near(B.fd.burnMag,0.10),"K3 왕국 화상이 스킬 적중에 붙는다 (최대 HP 10%)");
  eq(B.fd.burn,1,"K4 지속 1R");

  // 스킬당 1판정 — 난수 소비가 스킬 1회에 정확히 1 늘어난다
  B=openFire(); B.fa.synEl=null; const n0=RC.n; act("A",0); const base=RC.n-n0;
  B=openFire(); const n1=RC.n; act("A",0); const withK=RC.n-n1;
  eq(withK-base,1,"K5 왕국 판정은 스킬당 정확히 1회 (multi-hit 여부와 무관)");

  // 회피하면 미발동
  B=openFire(); B.fd.dodgeForce=true; act("A",0);
  ok(B.fd.burn===0,"K6 회피하면 왕국 효과 미발동");

  // 방어막이 전부 막아도 적중이다
  B=openFire(); T.shieldAdd(B.fd,9999,"test"); act("A",0);
  ok(B.fd.burn>0,"K7 방어막이 전부 흡수해도 적중 — 왕국 효과 발동");

  // 도망 실패 페널티 기본 공격은 execV2 를 타지 않으므로 미발동
  B=openFire(); B.fd.skills=null; // 상대 4슬롯 가드를 피해 기본 공격 경로만 확인
  const target=B.fa; target.burn=0;
  T.execSlot("D",-1,{allowBasic:true}); T.TQ.length=0;
  ok(target.burn===0,"K8 도망 실패 페널티 평타(기본 공격 경로)는 왕국 효과를 발동하지 않는다");

  // 확률 가산 — 최종 확률 = 표기 확률 + 💫(statusPct · 지속형 시너지), 100% 상한
  const openBolt=()=>{ board();
    field(0,{minions:six("M-L1"),el:"lightning"});   // 번개 9칸 → 단계 (9) = 표기 70%
    field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0,king:false});
    const b=battle(fighterOf(0,0),fighterOf(1,0)); dummy(b.fd); b.fd.element=null;
    b.fa.statusPct=0; b.fa.synStatusPct=0; return b; };
  fixRand(0.8);
  B=openBolt(); act("A",0);
  eq(B.fd.shock,0,"K9 난수 0.80 > 표기 70% — 미발동");
  B=openBolt(); B.fa.synStatusPct=0.15; act("A",0);
  eq(B.fd.shock,1,"K10 💫 가산 — 70% + 15%p = 85% > 0.80 이면 발동");
  B=openBolt(); B.fa.synStatusPct=5; act("A",0);
  eq(B.fd.shock,1,"K11 가산해도 100% 상한 (난수 1 미만이면 언제나 발동)");
  fixRand(0.5);
}

/* ===================== L. 전설 직접 참전 패시브 ===================== */
{
  // 마녀 — 필드 9칸의 서로 다른 속성 수 × 💫 +5%p (최대 25)
  board();
  field(0,{minions:["witch","M-F1","M-W1","M-G1",null,null],el:"lightning"}); // 불·물·풀 + 왕/동료 번개 = 4종
  field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0});
  let B=battle(fighterOf(0,0),fighterOf(1,0));
  eq(T.synElemKinds(B.syn[0]),4,"L1 서로 다른 속성 수 = 4 (왕·동료 칸 포함)");
  ok(near(B.fa.synStatusPct,0.20),"L2 마녀의 집회 — 속성 종류 4 × +5%p = +20%p");
  eq(B.fa.synEl,null,"L3 무속성 전설은 왕국 수혜자가 아니다 (용 제외)");

  // 사신 — 사망 하수인+동료 칸 수 × 💪 +5% (최대 40)
  board();
  field(0,{minions:["reaper","M-F1","M-F1","M-F1","M-F1","M-F1"],el:"fire"});
  [1,2,3,4].forEach(i=>{ fighterOf(0,i).alive=false; });
  field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0});
  B=battle(fighterOf(0,0),fighterOf(1,0));
  eq(B.syn[0].dead,4,"L4 사망 칸 4");
  ok(near(B.fa.synAtk-T.synArchBonus(B.syn[0]).atk,0.20),"L5 죽음의 수확 — 사망 4칸 × 💪 +5% = +20%");
  // 상한 40% — 하수인 6 + 동료 2 = 8칸이 전부 죽어도 +40%
  board();
  field(0,{minions:six("reaper"),el:"fire"});
  T.S.pieces.filter(x=>x.owner===0&&(x.type==="minion"||x.type==="ally")).forEach(x=>{ x.alive=false; });
  fighterOf(0,0).alive=true; // 참전자는 살아 있어야 한다 (사망 칸 7)
  field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0});
  B=battle(fighterOf(0,0),fighterOf(1,0));
  ok(B.syn[0].dead>=7&&near(B.fa.synAtk-T.synArchBonus(B.syn[0]).atk,0.35),"L6 사망 7칸 × 5% = +35% (상한 40% 이하)");

  // 용 — 달성 왕국 최고 단계 1속성 · 동률은 칸 수 → 🔥💧⚡🗻🌿
  board();
  field(0,{minions:["dragon","M-W1","M-W1","M-G1","M-G1",null],el:null,allies:0,king:false}); // 물 2 · 풀 2 (동률)
  field(1,{minions:["M-F1",null,null,null,null,null],el:"fire",allies:0});
  B=battle(fighterOf(0,0),fighterOf(1,0));
  eq(T.synDragonEl(B.syn[0]),"water","L7 용의 군주 — 단계·칸 수 동률이면 🔥→💧→⚡→🗻→🌿 순서");
  ok(B.fa.synEl&&B.fa.synEl.kind==="weaken","L8 용은 그 속성의 왕국 효과를 받는다");
  eq(B.fa.element,null,"L9 용 본체는 무속성 그대로 — 상성 중립 유지");

  board();
  field(0,{minions:["dragon","M-G1","M-G1","M-G1","M-G1",null],el:null,allies:0,king:false}); // 풀 4 단독 최고
  field(1,{minions:["M-F1",null,null,null,null,null],el:"fire",allies:0});
  B=battle(fighterOf(0,0),fighterOf(1,0));
  eq(T.synDragonEl(B.syn[0]),"grass","L10 용의 군주 — 최고 단계 속성 우선 (풀 4칸 = 단계 (4))");

  board();
  field(0,{minions:["dragon","M-F1",null,null,null,null],el:null,allies:0,king:false}); // 불 1 → 모두 (2) 미달
  field(1,{minions:["M-F1",null,null,null,null,null],el:"fire",allies:0});
  B=battle(fighterOf(0,0),fighterOf(1,0));
  eq(T.synDragonEl(B.syn[0]),null,"L11 모든 속성이 2 미만이면 용의 군주는 효과 없음");
  eq(B.fa.synEl,null,"L12 그때 용도 왕국 효과를 받지 않는다");

  // 가방 대기 전설은 타입 집계만 — 패시브는 붙지 않는다
  board();
  field(0,{minions:["M-F1","M-F1",null,null,null,null],el:"fire",allies:0,king:false});
  T.S.reserve[0]={element:null,legend:"reaper",hp:100,maxHp:158,atk:40,skills:[],cds:[]};
  field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0});
  B=battle(fighterOf(0,0),fighterOf(1,0));
  eq(B.syn[0].arch.atk,1,"L13 가방 대기 전설도 타입 집계에는 들어간다");
  ok(near(B.fa.synAtk,T.synArchBonus(B.syn[0]).atk),"L14 가방 대기 전설의 패시브는 참전자에게 붙지 않는다");
}

/* ===================== R. 동료 사망 🪄 칸과 왕국 (2) 미달 ===================== */
{
  board();
  field(0,{minions:six("M-F1"),el:"fire"});
  const king=T.S.pieces.find(x=>x.owner===0&&x.type==="king");
  const allies=T.S.pieces.filter(x=>x.owner===0&&x.type==="ally");
  eq(T.leaderSkillIds(king,T.S).length,2,"R1 동료 생존 — 왕은 2칸");
  allies[0].alive=false; T.syncOwnerLeaders(0);
  eq(T.leaderSkillIds(king,T.S)[2],"LD-REVENGE","R2 동료 1명 사망 → 왕·살아 있는 동료의 3번째 칸 = 동료의 복수");
  eq(T.leaderSkillIds(allies[1],T.S)[2],"LD-REVENGE","R3 살아 있는 동료도 같은 칸을 얻는다");
  allies[1].alive=false; T.syncOwnerLeaders(0);
  eq(T.leaderSkillIds(king,T.S)[3],"LD-WRATH","R4 동료 2명 사망 → 왕의 4번째 칸 = 왕의 분노");
  ok(near(T.SKILLS["LD-REVENGE"].pct,220)&&T.SKILLS["LD-REVENGE"].cd===2
    &&near(T.SKILLS["LD-WRATH"].pct,280)&&T.SKILLS["LD-WRATH"].cd===2,"R5 💪 220% / ⌛2 · 💪 280% / ⌛2");

  // 왕국 달성 → 동료의 복수는 확률 판정 없이 100% 부여, 왕의 분노는 지속 +1
  field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0});
  let B=battle(king,fighterOf(1,0)); dummy(B.fd); B.fd.element=null;
  eq(T.v2KingdomEffectOf(0,"fire")&&T.v2KingdomEffectOf(0,"fire").kind,"burn","R6 달성 왕국이면 최고 단계 값을 돌려준다");
  act("A",king.skills.indexOf("LD-REVENGE"));
  ok(B.fd.burn===1&&near(B.fd.burnMag,0.10),"R7 동료의 복수 — 확정 부여 · 왕국 (9) 값 (화상 10% · 1R)");
  B=battle(king,fighterOf(1,1)||fighterOf(1,0)); dummy(B.fd); B.fd.element=null;
  act("A",king.skills.indexOf("LD-WRATH"));
  eq(B.fd.burn,2,"R8 왕의 분노 — 같은 효과에 지속 +1R");

  // 왕국 (2) 미달이면 아무 효과도 없다 — 위력만 남는다
  board();
  field(0,{minions:["M-F1",null,null,null,null,null],el:"fire",allies:0}); // 불 1 + 왕 1 = 2? → 왕 칸까지 2가 되지 않게 왕 속성을 비운다
  const k2=T.S.pieces.find(x=>x.owner===0&&x.type==="king"); k2.element=null; T.syncOwnerLeaders(0);
  field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0});
  const B2=battle(k2,fighterOf(1,0)); dummy(B2.fd); B2.fd.element=null;
  eq(T.v2KingdomEffectOf(0,"fire"),null,"R9 (2) 미달이면 v2KingdomEffectOf 는 null");
  const hp0=B2.fd.hp;
  k2.skills=["K-1","LD-REVENGE"]; k2.cds=[0,0];
  act("A",1);
  ok(B2.fd.hp<hp0&&B2.fd.burn===0&&B2.fd.weaken===0&&B2.fd.shock===0,"R10 (2) 미달 — 동료의 복수는 효과 없이 위력만");
}

/* ===================== V. 소유자 전용 selector ===================== */
{
  board();
  field(0,{minions:six("M-F1"),el:"fire"});
  field(1,{minions:six("M-W1"),el:"water"});
  const v=T.synView(0,T.S);
  ok(v&&v.el.fire===9&&v.arch.std===6,"V1 소유자 selector 는 자기 집계를 돌려준다");
  ok(v.el.water===0&&v.arch.std===6&&v.arch.def===0,"V2 소유자 selector 에 상대 칸이 섞이지 않는다 (상대는 물 9 · 표준 6)");
  eq(T.synView(2,T.S),null,"V3 좌석이 아닌 값에는 아무것도 돌려주지 않는다");
  const B=battle(fighterOf(0,0),fighterOf(1,0));
  eq(JSON.stringify(T.synView(1,T.S).el),JSON.stringify(B.syn[1].el),"V4 전투 중에는 고정된 스냅샷을 본다");
}

/* ===================== N. 공개 방 수신 경로 — synAtk (Jupiter owner-only 경계) =====================
   서버는 battle.a/d 중 **자기 전투원에만** synAtk 를 싣는다(room.js _serializeBattle · test-issue235-boundary R1c/R1d).
   실제 netApplyRoomState → netSynthBattle → netSynthFighter 경로로 받아 위력 표기(effAtk)가 그 값을 쓰는지,
   키가 없는 상대 쪽은 0 으로 떨어지는지를 본다 — 로컬 규칙 계산·역산은 하지 않는다. */
{
  const N=H.load(htmlPath); N.NET.me=0;
  const side=o=>Object.assign({owner:0,hp:100,maxHp:100,shield:0,burn:0,weaken:0,shock:0,shockFresh:false,dmgCut:0,focusCharge:false,vulnMark:false,
    skills:null,rec:0,items:0,itemRound:false,lastItem:null,ballThrow:false,buff:null,type:"ally",element:null,bodyFight:true,rosterId:null,artRosterId:null,atk:10,skillAtk:10},o);
  const own=o=>Object.assign({id:"u-m1",r:10,c:4,owner:0,type:"ally",element:null,name:null,hp:100,maxHp:100,atk:10,skillAtk:10,rosterId:null,skills:null,cdMax:0,immobile:0,cap:null,alive:true,placed:true,movedEver:true,revealed:true},o);
  const frame=synA=>{ const a=side({owner:0}), d=side({owner:1});
    if(synA!==undefined) a.synAtk=synA; // 상대(d)에는 어떤 경우에도 키를 만들지 않는다 — 서버와 같은 경계
    return {seat:0,state:"IN_PROGRESS",phase:"play",revision:1,turnCount:9,current:0,mainUsed:false,battlesUsed:0,seats:{ready:[true,true]},
      units:[{id:"u-o1",r:4,c:4,owner:1,alive:true,immobile:0}],
      you:{pieces:[own({})],inv:[],balls:0,reserve:null,pkgs:{itemGift:0,battleBuff:0},selected:null,placed:true,teleUsed:0},
      battle:{battleId:1,round:1,phase:0,actor:"A",actSeq:0,maxRounds:null,log:[],a,d},fleePick:null,modal:null,log:[],events:[],result:null,turn:null,fx:{firstSeq:null,lastSeq:0,events:[]}}; };
  N.netApplyRoomState(frame(0.2),false);
  ok(N.S.battle.fa.synAtk===0.2&&near(N.effAtk(N.S.battle.fa),12),"NS1 소유자 전투원의 synAtk 를 숫자로 합성 — 위력 표기가 10 → 12");
  eq(N.S.battle.fd.synAtk,0,"NS2 상대 전투원은 키가 없어 0 (역산하지 않는다)");
  N.netApplyRoomState(frame(undefined),false);
  eq(N.S.battle.fa.synAtk,0,"NS3 서버가 안 보내면 0 — 로컬에서 규칙을 다시 계산하지 않는다");
}

/* ===================== P. 공용 피해 스킬 경계 (Saturn REVISE) =====================
   왕국 1판정은 execV2 후처리가 아니라 resolveHit → v2SkillSettle 공용 경계에 산다.
   중복·누락은 **난수 소비**와 **statusApplied** 로 바로 드러나므로 둘 다 숫자로 못 박는다. */
{
  const met=()=>T.S.metrics.statusApplied;
  const openEl=(el,sp)=>{ board();
    field(0,{minions:six(sp),el});
    field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0,king:false}); // 물 1칸 = (2) 미달
    const B=battle(fighterOf(0,0),fighterOf(1,0)); dummy(B.fd); B.fd.element=null; return B; };
  const openFire=()=>openEl("fire","M-F1");
  /* 드래곤 숨결 = 지금 습득 가능한 **비-v2 피해 스킬**. cls 기술이라 스스로는 상태이상을 걸지 않으므로
     여기서 붙는 화상·난수·지표는 전부 왕국 몫이다. 상대를 무속성으로 두어 고유 배율도 중립 1.0. */
  const legacy=B=>{ B.fa.skills=["dragon_breath"]; B.fa.cds=[0]; B.fa.revealedSkills=[]; return B; };

  let B=legacy(openFire()); B.fa.synEl=null;
  let n0=RC.n, m0=met(); act("A",0);
  const baseN=RC.n-n0, baseM=met()-m0;
  ok(B.fd.burn===0&&baseM===0,"P1 기준선 — 왕국이 없으면 레거시 드래곤 숨결은 상태이상 0");
  B=legacy(openFire()); n0=RC.n; m0=met(); act("A",0);
  ok(B.fd.burn===1&&near(B.fd.burnMag,0.10),"P2 레거시(비-v2) 피해 스킬도 왕국 화상이 붙는다 — Core 경로 누락 교정");
  eq(RC.n-n0-baseN,1,"P3 레거시 경로 난수 소비 = 기준선 +1 (왕국 판정 정확히 1회)");
  eq(met()-m0-baseM,1,"P4 레거시 경로 statusApplied = 기준선 +1");

  /* multi-hit — 라이브 스킬에 2타가 없으므로 실제 실행기 위에 2타 fx 를 잠시 얹어 엔진 계약만 본다 */
  B=openFire(); const sid=B.fa.skills[0], sk=T.SKILLS[sid], keepFx=sk.fx;
  T.V2_FX.__synTwice=c=>{ c.hit(40,{}); c.hit(40,{}); };
  sk.fx="__synTwice";
  B.fa.synEl=null; n0=RC.n; m0=met(); act("A",0);
  const twoN=RC.n-n0, twoM=met()-m0;
  B=openFire(); n0=RC.n; m0=met(); act("A",0);
  eq(RC.n-n0-twoN,1,"P5 v2 2타 스킬도 왕국 난수 소비는 스킬당 1회");
  eq(met()-m0-twoM,1,"P6 v2 2타 스킬도 statusApplied +1 — 타격마다 굴리지 않는다");
  eq(B.fd.burn,1,"P7 2타여도 화상은 1회분");
  sk.fx=keepFx; delete T.V2_FX.__synTwice;

  /* 도망 실패 페널티 평타 — **왕국을 가진 쪽이** 때려도 발동하지 않는다(#234 6.1 스킬 밖 예외) */
  B=openFire(); m0=met(); T.execSlot("A",-1,{allowBasic:true}); T.TQ.length=0;
  ok(B.fd.burn===0&&met()-m0===0,"P8 도망 실패 페널티 평타는 왕국 미발동 — 난수·지표 모두 그대로");

  /* 회피 · 방어막 완전 흡수 — 기존 계약을 지표로 다시 못 박는다 */
  B=legacy(openFire()); B.fd.dodgeForce=true; m0=met(); act("A",0);
  ok(B.fd.burn===0&&met()-m0===0,"P9 회피하면 레거시 경로도 왕국 미발동 (statusApplied 불변)");
  B=legacy(openFire()); T.shieldAdd(B.fd,9999,"test"); m0=met(); act("A",0);
  ok(B.fd.burn===1&&met()-m0===1,"P10 방어막이 전부 흡수해도 적중 — 왕국 1회");

  /* 🌿 왕국 흡수는 **당첨된 그 공격의 실 HP 피해**부터 회복한다 (레거시 경로 포함) */
  B=legacy(openEl("grass","M-G1"));
  B.fa.hp=B.fa.maxHp-60; const hp0=B.fa.hp, dhp0=B.fd.hp;
  act("A",0);
  ok(near(B.fa.absorbPct,0.50)&&B.fa.hp-hp0===Math.round((dhp0-B.fd.hp)*0.5),
    "P11 풀 왕국 흡수 — 같은 공격의 실 HP 피해 50% 회복 (Q9)");

  /* 동료의 복수 · 왕의 분노 — 확정 효과 정확히 1회. 자동 proc 과 겹치면 난수 +1 · statusApplied +1 이 더 붙는다. */
  const openKing=(fireCells)=>{ board();
    field(0,{minions:six("M-F1").map((v,i)=>i<fireCells-3?v:null),el:"fire"});
    const kk=T.S.pieces.find(x=>x.owner===0&&x.type==="king");
    const al=T.S.pieces.filter(x=>x.owner===0&&x.type==="ally");
    al.forEach(a=>{ a.alive=false; }); T.syncOwnerLeaders(0);
    field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0,king:false});
    const b=battle(kk,fighterOf(1,0)); dummy(b.fd); b.fd.element=null; return {B:b,k:kk}; };

  let kk=openKing(9); B=kk.B;
  const revSlot=kk.k.skills.indexOf("LD-REVENGE");
  B.fa.synEl=null; n0=RC.n; m0=met(); act("A",revSlot);
  const revN=RC.n-n0, revM=met()-m0;
  ok(revM===0,"P12 기준선 — 왕국 (2) 미달이면 동료의 복수는 효과 없이 위력만 (statusApplied 0)");
  kk=openKing(9); B=kk.B; n0=RC.n; m0=met(); act("A",kk.k.skills.indexOf("LD-REVENGE"));
  eq(RC.n-n0-revN,0,"P13 동료의 복수 — 확정 효과라 난수를 쓰지 않는다 (자동 proc 중복 없음)");
  eq(met()-m0-revM,1,"P14 동료의 복수 statusApplied 정확히 +1 (중복이면 2)");
  ok(B.fd.burn===1&&near(B.fd.burnMag,0.10),"P15 동료의 복수 — 왕국 (9) 값 1회분");

  kk=openKing(9); B=kk.B; const wrSlot=kk.k.skills.indexOf("LD-WRATH");
  n0=RC.n; m0=met(); act("A",wrSlot);
  eq(RC.n-n0-revN,0,"P16 왕의 분노도 난수를 쓰지 않는다");
  eq(met()-m0-revM,1,"P17 왕의 분노 statusApplied 정확히 +1");
  eq(B.fd.burn,2,"P18 왕의 분노 — 같은 효과에 지속 +1R (1회분에만 붙는다)");

  /* 회피한 동료의 복수 — 대상 지정 효과는 미발동이고 다음 스킬로 새지 않는다 */
  kk=openKing(9); B=kk.B; B.fd.dodgeForce=true; m0=met(); act("A",kk.k.skills.indexOf("LD-REVENGE"));
  ok(B.fd.burn===0&&met()-m0===0,"P19 회피한 동료의 복수는 대상 효과 미발동");
  ok(!("synHit" in B.fa)&&!("synDone" in B.fa),"P20 회피해도 행동 누적칸이 다음 스킬로 새지 않는다 — 키 자체가 남지 않는다(말 객체는 전투를 넘어 살아남는다)");

  /* 💥 폭발 연소(화상 소모 분기) — 이 스킬만 피해를 resolveHit 가 아니라 v2Dot 으로 낸다.
     그래도 스킬 1회의 적중이므로 왕국 1판정이 정확히 1번 나와야 한다 (Saturn MEDIUM: 누락). */
  const bbId=Object.keys(T.SKILLS).find(k=>T.SKILLS[k].fx==="burnBurst");
  const burst=(Bx,burn,mag)=>{ Bx.fa.skills=[bbId]; Bx.fa.cds=[0]; Bx.fa.revealedSkills=[];
    Bx.fd.burn=burn; Bx.fd.burnMag=mag||0.10; Bx.fd.burnBy="D"; return Bx; };

  B=burst(openFire(),2); B.fa.synEl=null;
  n0=RC.n; m0=met(); let bhp0=B.fd.hp; act("A",0);
  const bstN=RC.n-n0, bstM=met()-m0, bstDmg=bhp0-B.fd.hp;
  ok(bstDmg>0&&bstM===0&&B.fd.burn===0,"P21 기준선 — 왕국이 없으면 폭발 연소 소모 분기는 화상만 걷어내고 상태이상 0");
  B=burst(openFire(),2); n0=RC.n; m0=met(); bhp0=B.fd.hp; act("A",0);
  eq(met()-m0-bstM,1,"P22 폭발 연소 소모 분기도 왕국 1판정 — statusApplied 기준선 +1 (v2Dot 은 resolveHit 를 타지 않는다)");
  eq(RC.n-n0-bstN,1,"P23 그 판정은 정확히 1회 — 난수 소비 기준선 +1 (중복이면 2)");
  ok(B.fd.burn===1&&near(B.fd.burnMag,0.10)&&bhp0-B.fd.hp===bstDmg,"P24 걷어낸 자리에 왕국 화상 1회분 · 피해는 기준선과 같다");
  ok(!("synHit" in B.fa)&&!("synDone" in B.fa),"P25 v2Dot 으로 채운 누적칸도 같은 경계에서 비워진다");

  /* 🌿 흡수 — 같은 경계를 쓰므로 이 지속 피해도 "당첨된 그 공격"에 포함된다(Q9) */
  B=burst(openEl("grass","M-G1"),1,0.001); // 허수아비 최대 HP 가 커서 회복이 빈 HP 에 잘리지 않게 1회 피해를 줄인다
  B.fa.hp=B.fa.maxHp-60; const bha0=B.fa.hp; bhp0=B.fd.hp;
  act("A",0);
  ok(near(B.fa.absorbPct,0.50)&&B.fa.hp-bha0===Math.round((bhp0-B.fd.hp)*0.5),
    "P26 풀 왕국 흡수 — 폭발 연소의 실 HP 피해 50% 회복");

  /* 🔥 불꽃 표식 — 이 스킬만 resolveHit 적중 **뒤에** v2Dot 을 한 번 더 낸다. 그 실 HP 피해도 같은 공격의 몫이므로
     공용 정산칸에 들어가야 흡수가 전액을 회복한다 (Saturn MEDIUM: 누락). 왕국 판정 횟수는 c.hit 누적만으로 이미 1회다. */
  const fmId=Object.keys(T.SKILLS).find(k=>T.SKILLS[k].fx==="flameMark");
  const mark=Bx=>{ Bx.fa.skills=[fmId]; Bx.fa.cds=[0]; Bx.fa.revealedSkills=[];
    Bx.fd.burn=2; Bx.fd.burnMag=0.001; Bx.fd.burnBy="D"; return Bx; }; // 허수아비 최대 HP 가 커서 회복이 빈 HP 에 잘리지 않게 1회 피해를 줄인다

  B=mark(openEl("grass","M-G1")); B.fa.synEl=null;
  n0=RC.n; m0=met(); let mhp0=B.fd.hp; act("A",0);
  const mkN=RC.n-n0, mkM=met()-m0, mkDmg=mhp0-B.fd.hp;
  ok(mkDmg>0&&mkM===0&&B.fd.burn===2,"P27 기준선 — 왕국이 없으면 불꽃 표식은 상태이상 0 · 화상 지속은 줄지 않는다");
  /* 대조군: 화상이 없으면 v2Dot 분기 자체가 없다 — 아래 흡수 검사가 "적중분만" 세는 구현과 실제로 갈리는지 먼저 못 박는다 */
  B=mark(openEl("grass","M-G1")); B.fa.synEl=null; B.fd.burn=0; const hOnly=B.fd.hp; act("A",0);
  const hitOnly=hOnly-B.fd.hp;
  ok(mkDmg>hitOnly&&Math.round(mkDmg*0.5)!==Math.round(hitOnly*0.5),
    "P27b 표식 지속 피해가 회복량을 실제로 가른다 (적중분만 세면 다른 값이 나온다)");

  B=mark(openEl("grass","M-G1"));
  B.fa.hp=B.fa.maxHp-60; const mha0=B.fa.hp; mhp0=B.fd.hp;
  n0=RC.n; m0=met(); act("A",0);
  eq(met()-m0-mkM,1,"P28 불꽃 표식도 왕국 1판정 — statusApplied 기준선 +1");
  eq(RC.n-n0-mkN,1,"P29 그 판정은 정확히 1회 — 난수 소비 기준선 +1 (v2Dot 누적이 판정을 늘리지 않는다)");
  eq(mhp0-B.fd.hp,mkDmg,"P30 피해 총량은 기준선과 같다 (적중 + 표식 지속 피해)");
  ok(near(B.fa.absorbPct,0.50)&&B.fa.hp-mha0===Math.round(mkDmg*0.5),
    "P31 풀 왕국 흡수 — 표식 지속 피해까지 포함한 실 HP 피해 50% 회복 (적중분만 세면 떨어진다)");
  ok(!("synHit" in B.fa)&&!("synDone" in B.fa),"P32 표식이 채운 누적칸도 같은 경계에서 비워진다");
}

/* ===================== G. 구형 상태이상 게이트도 💫 시너지를 쓴다 (Saturn MEDIUM) =====================
   v2Apply 는 statusPct + synStatusPct 를 같이 더하는데 레거시 두 게이트는 statusPct 만 봤다.
   난수를 두 값 사이(0.80)에 세워, 가산이 실제로 들어가야만 통과하게 못 박는다. 왕국은 꺼서 스킬 자체 확률만 본다. */
{
  const openL=()=>{ board();
    field(0,{minions:six("M-F1"),el:"fire"});
    field(1,{minions:["M-W1",null,null,null,null,null],el:"water",allies:0,king:false});
    const b=battle(fighterOf(0,0),fighterOf(1,0)); dummy(b.fd); b.fd.element=null;
    b.fa.synEl=null; b.fa.statusPct=0; b.fa.synStatusPct=0; return b; };
  /* 잔불 표식 = status:true 인 레거시 피해 스킬 → execSlot 의 gate() */
  const eff=b=>{ b.fa.skills=["fire_effect"]; b.fa.cds=[0]; b.fa.revealedSkills=[]; return b; };
  /* 로스터 미적용 하수인의 구형 속성 스킬 → legacySkillAct 의 tryStatus() (f.skills 가 없어야 이 경로로 간다) */
  const old=b=>{ b.fa.skills=null; b.fa.cds=null; b.fa.skillAtk=22; b.fa.cd=0; b.fa.element="fire"; return b; };
  const oldAct=()=>{ T.applyCoreEffects({type:"battleLegacySkill",side:"A"}); T.TQ.length=0; if(T.S.battle) T.S.battle.msgQ.length=0; };

  fixRand(0.8);
  let B=eff(openL()); act("A",0);
  eq(B.fd.burn,0,"G1 기준선 — 난수 0.80 > 표기 70% 면 레거시 피해 스킬 상태이상 미발동");
  B=eff(openL()); B.fa.synStatusPct=0.20; act("A",0);
  ok(B.fd.burn>0,"G2 execSlot 게이트도 💫 시너지 가산 — 70% + 20%p = 90% > 0.80 이면 발동");

  B=old(openL()); oldAct();
  eq(B.fd.burn,0,"G3 기준선 — 구형 속성 스킬도 0.80 > 70% 면 미발동");
  B=old(openL()); B.fa.synStatusPct=0.20; oldAct();
  ok(B.fd.burn>0,"G4 legacySkillAct 게이트도 💫 시너지 가산 — v2Apply 와 같은 자리");

  /* 모래 폭풍은 가산·상한 **뒤에** 절반 — (70%+20%p)*0.5 = 45% 라 0.60 은 실패해야 한다 (같은 픽스처 재사용) */
  fixRand(0.6);
  B=eff(openL()); B.fa.synStatusPct=0.20; B.fa.sandStormR=2; act("A",0);
  eq(B.fd.burn,0,"G5 execSlot 게이트도 모래 폭풍 절반 — 45% < 0.60 이면 미발동 (0.60 은 절반 없으면 90% 로 발동)");
  B=old(openL()); B.fa.synStatusPct=0.20; B.fa.sandStormR=2; oldAct();
  eq(B.fd.burn,0,"G6 legacySkillAct 게이트도 모래 폭풍 절반 — v2Apply 와 같은 순서");

  /* 지속형(M-F5)은 기본 100% 라 절반이 걸려도 50% 다 — 판정 자체를 건너뛰면 0.99 도 통과해버린다 (Saturn MEDIUM) */
  const openSus=()=>{ const b=openL(); b.fa.rosterId="M-F5"; return b; };
  fixRand(0.99);
  B=old(openSus()); let n0=RC.n; oldAct(); const susN=RC.n-n0;
  ok(B.fd.burn>0,"G7 모래 폭풍이 없으면 지속형은 종전대로 확정 부여 (기본 확률 100%)");
  B=old(openSus()); B.fa.sandStormR=2; n0=RC.n; oldAct();
  eq(B.fd.burn,0,"G8 지속형도 모래 폭풍이면 50% 판정 — 0.99 는 실패한다");
  eq(RC.n-n0-susN,1,"G8b 그 판정으로 상태 난수 1회만 더 쓴다 (확정 구간은 종전대로 미소비)");
  fixRand(0.5);
}

/* ===================== T. AI 해일 예고 추정 — 유효 공격력 반영 (Saturn LOW) ===================== */
{
  const sk={fx:"tsunami",ai:"buff"};
  const f=a=>({atk:20,synAtk:a,element:null,weaken:0});
  const opp={element:null,hp:25,shield:0,weaken:0,def:0,hardenPct:0}; // pool 25
  eq(T.aiV2SupportScore(f(0),sk,false,"A",opp),9,"T1 💪 가산이 없으면 X=24 — pool 25 가 임계 아래라 대기 점수");
  eq(T.aiV2SupportScore(f(0.12),sk,false,"A",opp),95,"T2 💪 +12% 면 X=26.88 — 실제 Core 와 같은 임계로 즉시 사용 점수");
  ok(near(T.effAtk(f(0.12)),22.4),"T3 추정은 공용 effAtk 를 그대로 쓴다 (규칙 사본 없음)");
}

unfix();
console.log(`smoke_issue235: ${pass} passed, ${fail} failed`);
if(fail){ console.error("실패 목록:\n - "+fails.join("\n - ")); process.exit(1); }
