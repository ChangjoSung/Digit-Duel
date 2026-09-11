/* #201 (v0.4.8) 온라인 아트 손실 HotFix 헤드리스 회귀 — node demo/test/regression/smoke_online_art.js [demo/index.html]
 *
 * 배경: 온라인(HTTP)에서는 자산이 멀쩡히 있어도 서버 요청 한도·순간 혼잡으로 개별 이미지가 한 번 실패할 수 있다.
 * 변경 전 소스는 그 한 번을 ART.failed 에 영구히 남겼고, 왕·동료는 ART.loaded 확인 경로가 프리로드 1회뿐이라
 * 새로고침 전에는 되돌아올 길이 아예 없었다 — 화면에는 "일부 말만" 이모지·텍스트로 남는 부분 아트 손실로 보였다.
 *
 * ── 시계 ─────────────────────────────────────────────────────────────────────
 * 공용 하네스의 setTimeout 은 핸들을 0 으로 돌려주고 지연을 무시한다. 그래서 "예약 중복 제거·백오프 간격·
 * 능동 마감" 같은 타이머 계약은 그 위에서 진실하게 시험할 수 없다 (핸들이 falsy 라 재그리기 중복 제거가
 * 우연히 무력화되고, 마감이 즉시 발화해 순서가 뒤집힌다).
 * 이 파일만 **테스트 지역 가짜 시계**를 쓴다 — 고유 양수 핸들 · 예약 시각 순 실행 · clearTimeout 실동작.
 * 다른 스위트의 의미는 건드리지 않는다 (load() 이후 이 프로세스의 전역만 바꿔 끼운다).
 *
 * ── 고정하는 계약 (전부 표시 계층 · 관측 가능한 동작으로만 판정한다) ───────────
 *   A 재시도 예약이 유한하고 실제로 점점 길어진다 (관측한 예약 시각 간격으로 본다 — 상수를 베껴 적지 않는다)
 *   B 프리로드의 고정 44 요청 집합이 그대로이고, 복구 조회도 그 집합 안에서만 일어난다 (새 URL 0건)
 *   C 일시적 실패는 복구된다 — 하수인 아이콘·왕 아이콘·왕 전투 도트·전투 도트 실패 경로
 *   D 영구 결손은 유한하게 끝난다 — 예산 소진 후 조회도 재그리기도 더 없다
 *   E 중복 제거 — 예약 중복·진행 중 중복 모두
 *   F 미공개 적 말의 정보 경계는 복구 전·중·후 모두 그대로다
 *   G 변경 전 소스 음성 대조 — 같은 **동작** 단언이 기준판에서는 떨어진다
 *   H 성공 뒤 뒤늦은 실패 (프리로드는 전부 성공, 게임 도중 한 건이 떨어짐)
 *   I 능동 마감 — onload·onerror 어느 쪽도 오지 않는 요청에서도 스스로 끝나고 다시 예약된다
 *   J 파일 단위 책임 — 전투 도트가 영영 없어도 멀쩡한 보드 아이콘을 영구히 막지 않고, 없는 전투 파일을 다시 요청하지도 않는다
 *
 * 실제 HTTP·브라우저 캐시 동작(no-store 재요청 여부)은 여기서 흉내 내지 않는다 —
 * 그것은 docs/hotfix/201/Mars/ 의 실제 두 클라이언트 브라우저 증빙 소관이다.
 */
"use strict";
const H=require("../shared/harness");
const { execFileSync }=require("child_process");
const path=require("path");
const htmlPath=process.argv[2];
const ROOT=path.resolve(__dirname,"..","..","..");
const BASE_REF="ff6e87a0c028ae39725d5bb5971052a84410f328"; // #201 수정 직전 출시본 (v0.4.6)
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }
/* 기준판(변경 전) html 로 음성 대조를 돌릴 때도 크래시 대신 실패로 집계되게 감싼다 — smoke_minion_art 의 adf 와 같은 방식 */
const FILES=(T,d)=>typeof T.artFilesOf==="function"?T.artFilesOf(d)
  :((T.LEADER_DIRS&&T.LEADER_DIRS.indexOf(d)>=0)?[T.LEADER_FILES.icon,T.LEADER_FILES.battle]:["icon.png","battle.png"]);
const GONE=(T,d,f)=>!!(T.ART.gone&&T.ART.gone.has&&T.ART.gone.has(d+"/"+f));
const SETTLED=(T,d)=>!!(T.ART.settled&&T.ART.settled.has&&T.ART.settled.has(d));
const BATOK=(T,d)=>typeof T.artBattleOk==="function"?T.artBattleOk(d):T.artOk(d);
const HMAX=T=>(T.ART_RETRY&&Number.isFinite(T.ART_RETRY.hardMax))?T.ART_RETRY.hardMax:0;
const GONELIST=T=>(T.ART.gone&&T.ART.gone.forEach)?Array.from(T.ART.gone).sort():[];

/* ===== 테스트 지역 가짜 시계 — 고유 핸들 · 시각 순 · 취소 실동작 ===== */
function installClock(T){
  const q=new Map(); let seq=0, now=0;
  const sched=[];                       // {at, ms} — 백오프 간격 관측용
  global.setTimeout=function(fn,ms){
    const h=++seq, at=now+(Number(ms)||0);
    q.set(h,{fn,at,seq:h}); sched.push({at,ms:Number(ms)||0});
    return h;                            // 실제 브라우저처럼 항상 양수 (falsy 핸들이 중복 제거를 무력화하지 않게)
  };
  global.clearTimeout=function(h){ q.delete(h); };
  T.clock={
    now:()=>now, pending:()=>q.size, sched,
    /* ms 만큼 흐르게 한다. 예약 시각이 이른 것부터, 같으면 예약 순서대로 — 실제 스케줄러와 같은 순서 */
    advance(ms){
      const end=now+(ms===undefined?0:ms);
      for(;;){
        let best=null;
        for(const e of q.values()) if(e.at<=end&&(!best||e.at<best.at||(e.at===best.at&&e.seq<best.seq))) best=e;
        if(!best) break;
        q.delete(best.seq); now=best.at;
        try{ best.fn(); }catch(e){}
      }
      now=end; return now;
    }
  };
  return T.clock;
}

/* ===== 관측 하네스 ===== */
function loadRec(opts){
  const T=H.load(htmlPath,opts);
  const made=[]; const orig=T.document.createElement;
  T.document.createElement=function(tag){ const el=orig.call(T.document,tag); made.push(el); return el; };
  T.made=made;
  installClock(T);
  /* 프리로드는 스크립트 끝에서 이미 한 번 돌았다(기록 전·옛 시계 위에서). 관측 가능한 상태에서 다시 돌리려고 초기화한다 —
     제품 코드를 고치는 것이 아니라 테스트가 같은 진입점을 다시 부르는 것뿐이다. */
  T.ART.preloaded=false; T.ART.loaded.clear(); T.ART.failed.clear(); T.ART.rerender=null;
  for(const k of ["retry","gone","settled"]) if(T.ART[k]&&T.ART[k].clear) T.ART[k].clear();
  T.made.length=0; T.clock.sched.length=0;
  T.rerenders=0;
  return T;
}
const reqs=T=>T.made.filter(e=>typeof e.src==="string"&&e.src.indexOf("assets/")===0);
const nReq=T=>reqs(T).length;
const pend=T=>reqs(T).filter(e=>!e._fired);
/* 재그리기 예약 수 — artRerender 만 대기 0 으로 예약한다 */
const nRerender=T=>T.clock.sched.filter(x=>x.ms===0).length;
const backoffs=T=>T.clock.sched.filter(x=>x.ms>0&&x.ms<5000).map(x=>x.ms);   // 마감(5000)은 백오프가 아니다
function fire(T,pred,kind){
  let n=0;
  for(const e of reqs(T)){
    if(e._fired||!pred(e.src)) continue;
    e._fired=kind;
    const fn=kind==="ok"?e.onload:e.onerror;
    if(typeof fn==="function"){ fn(); n++; }
  }
  return n;
}
const fireAll=(T,kind)=>fire(T,()=>true,kind);
/* 시간을 흘리고, 그 사이 나간 요청에 응답을 먹인다 */
function step(T,ms,pred,kind){ T.clock.advance(ms); return fire(T,pred||(()=>true),kind||"err"); }
/* 그 자산이 계속 실패하는 상황을 끝까지 돌린다. 조회 라운드 수를 돌려준다 */
function burn(T,pref,keepOthersOk){
  let rounds=0;
  for(let i=0;i<40;i++){
    T.clock.advance(6000);
    const a=fire(T,u=>u.indexOf(pref)===0,"err");
    if(keepOthersOk!==false) fire(T,()=>true,"ok");
    if(a) rounds++;
    if(!a&&T.clock.pending()===0) break;
  }
  return rounds;
}
function corpus(T){
  const out=[];
  for(const d of T.ART_DIRS) for(const f of ["icon.png","battle.png"]) out.push(T.ART_BASE+d+"/"+f);
  for(const d of (T.LEADER_DIRS||[])) for(const f of [T.LEADER_FILES.icon,T.LEADER_FILES.battle]) out.push(T.LEADER_BASE+d+"/"+f);
  return out;
}
function board(T){
  T.setSeed(20260911);
  H.freshPlay(T,"pve"); H.clearBoard(T);
  const own=t=>T.S.pieces.find(x=>x.owner===0&&x.type===t);
  const P={me:own("minion"),king0:own("king"),ally0:own("ally")};
  P.ek=T.S.pieces.find(x=>x.owner===1&&x.type==="king");
  P.em=T.S.pieces.find(x=>x.owner===1&&x.type==="minion");
  H.place(T,P.me,12,4); H.place(T,P.king0,13,1); H.place(T,P.ally0,13,4);
  H.place(T,P.ek,2,4); H.place(T,P.em,2,5);
  for(const x of [P.ek,P.em]) x.revealed=false;
  T.S.selected=null; T.render();
  return P;
}
const cellOf=(T,r,c)=>T.els.board.children.find(x=>x.dataset.r===String(r)&&x.dataset.c===String(c));
const chipOf=(T,r,c)=>{ const cell=cellOf(T,r,c); return cell&&cell.children.find(x=>/^pc /.test(x.className)); };
function chipDump(T,r,c){ const x=chipOf(T,r,c); return x?JSON.stringify([x.className,x.innerHTML,x.getAttribute("title"),x.getAttribute("aria-label"),x.dataset]):"none"; }
const isArt=(T,p)=>/<img/.test(T.pcFaceHtml(p));
const mkImg=T=>{ const el=T.document.createElement("img"); el.onerror=function(){}; return el; };

/* ===== A. 재시도 예약은 유한하고 실제로 점점 길어진다 (관측값으로 판정) ===== */
{
  const T=loadRec();
  T.artPreload();
  const dir=T.ART_DIRS[0], pref=T.ART_BASE+dir+"/icon.png";
  /* 다른 파일들의 성공을 먼저 확정한 뒤 이 한 파일만 떨어뜨린다 — 그래야 관측한 간격이 "한 파일의 백오프"다.
     (여러 파일이 동시에 미확정인 채 떨어지는 경우는 B 절이 따로 본다.) */
  fire(T,u=>u!==pref,"ok");
  fire(T,u=>u===pref,"err");
  const rounds=burn(T,pref);
  const w=backoffs(T);
  ok(w.length>=2,"A1 같은 자산의 재시도가 여러 번 예약된다 (관측 "+w.length+"회)");
  ok(w.length>0&&w.every(x=>Number.isFinite(x)&&x>0),"A2 예약 간격이 전부 유한한 양수다");
  ok(w.length>1&&w.every((x,i)=>i===0||x>w[i-1]),"A3 예약 간격이 실제로 단조 증가한다 (백오프): "+w.join("→"));
  ok(rounds>0&&rounds<=5,"A4 영구 결손에서 조회 라운드가 유한하게 끝난다 (관측 "+rounds+"회)");
  ok(T.clock.pending()===0,"A5 끝난 뒤 남은 예약이 없다");
}

/* ===== B. 고정 44 요청 집합과 조회 경계 ===== */
{
  const T=loadRec();
  T.artPreload();
  const got=reqs(T).map(e=>e.src), want=corpus(T);
  ok(got.length===44&&want.length===44,"B1 냉시작 프리로드가 정확히 44건이다 (실제 "+got.length+")");
  ok(JSON.stringify([...got].sort())===JSON.stringify([...want].sort()),"B2 요청 URL 집합이 고정 44 집합과 정확히 같다");
  const before=got.length;
  fireAll(T,"err");
  for(let i=0;i<40;i++){ T.clock.advance(6000); const a=fireAll(T,"err"); if(!a&&T.clock.pending()===0) break; }
  const all=reqs(T).map(e=>e.src), wantSet=new Set(want);
  ok(all.every(u=>wantSet.has(u)),"B3 복구 조회도 같은 44 집합 안에서만 일어난다 (새 URL 0건)");
  const extra=all.length-before;
  ok(extra>0&&extra<=44*8,"B4 전 종 영구 결손에서도 추가 요청 총량이 절대 상한 이내다 ("+extra+")");
  ok(T.clock.pending()===0,"B5 예산을 다 쓰면 남은 예약이 없다");
}

/* ===== C. 일시적 실패 → 복구 ===== */
{
  /* C-a 하수인 아이콘 (프리로드에서 1건 실패) */
  const T=loadRec();
  T.artPreload();
  const P=board(T);
  const dir=T.artDirOf(P.me);
  ok(!!dir,"C0 내 하수인의 종 폴더를 안다");
  fire(T,u=>u===T.ART_BASE+dir+"/icon.png","err");
  fire(T,u=>u!==T.ART_BASE+dir+"/icon.png","ok");
  T.render();
  ok(T.ART.failed.has(dir)&&!isArt(T,P.me),"C1 실패 직후에는 종전처럼 안전 폴백(텍스트)이다");
  ok(T.clock.pending()>0,"C2 실패와 함께 복구 조회가 예약된다");
  step(T,500,u=>u.indexOf(dir+"/")>=0,"ok");
  T.clock.advance(10);
  ok(!T.ART.failed.has(dir),"C3 성공하면 그 종이 실패 목록에서 빠진다");
  T.render();
  ok(/<img class="icon" src="assets\/minions\/[a-z_]+\/icon\.png"/.test(T.pcFaceHtml(P.me)),"C4 보드 얼굴이 다시 아트로 돌아온다");
  ok(!GONE(T,dir,"icon.png"),"C5 복구된 자산은 영구 결손으로 굳지 않는다");
}
{
  /* C-b 왕 아이콘 — 변경 전에는 프리로드 1회가 유일한 확인 경로였다 */
  const T=loadRec();
  T.artPreload();
  const P=board(T);
  fire(T,u=>u===T.LEADER_BASE+"king/"+T.LEADER_FILES.icon,"err");
  fire(T,()=>true,"ok");
  T.render();
  ok(T.leaderArtDir(P.king0)===null&&/👑/.test(T.pcFaceHtml(P.king0)),"C6 왕 아이콘 실패 직후에는 현행 이모지다");
  step(T,500,u=>u.indexOf("king/")>=0,"ok");
  T.clock.advance(10);
  ok(T.leaderArtDir(P.king0)==="king","C7 왕 아이콘이 복구되면 아트 경로가 살아난다");
  ok(/<img class="icon leader" src="assets\/leaders\/king\/icon64\.png"/.test(T.pcFaceHtml(P.king0)),"C8 보드의 왕이 다시 아트로 보인다");
  ok(T.leaderArtDir(P.ally0)==="companion","C9 동료는 영향을 받지 않았다");
}
{
  /* C-c 왕 전투 도트 (icon64 는 성공, battle256 만 실패) */
  const T=loadRec();
  T.artPreload();
  const P=board(T);
  fire(T,u=>u===T.LEADER_BASE+"king/"+T.LEADER_FILES.battle,"err");
  fire(T,()=>true,"ok");
  ok(T.leaderArtDir(P.king0)==="king"&&T.leaderBattleDir(P.king0,P.king0)===null,"C10 보드 아이콘은 살아 있고 전투 도트만 빠진다");
  step(T,500,u=>u.indexOf("king/")>=0,"ok");
  T.clock.advance(10);
  ok(T.leaderBattleDir(P.king0,P.king0)==="king","C11 전투 도트 자산도 복구된다");
}
{
  /* C-d 전투 도트 실패 경로(artSpriteFail)도 같은 유한 복구에 오른다 */
  const T=loadRec();
  T.artPreload(); fireAll(T,"ok");
  const P=board(T);
  const dir=T.artDirOf(P.me);
  const el=mkImg(T);
  T.artSpriteFail(dir,el);
  ok(T.ART.failed.has(dir)&&el.onerror===null,"C12 전투 도트 실패는 종전대로 그 종을 실패로 기록하고 onerror 를 끊는다");
  ok(T.clock.pending()>0,"C13 전투 도트 실패도 복구 조회를 예약한다");
  step(T,500,u=>u.indexOf(dir+"/")>=0,"ok");
  T.clock.advance(10);
  ok(!T.ART.failed.has(dir)&&isArt(T,P.me),"C14 복구되면 다음 렌더부터 다시 아트다");
}

/* ===== D. 영구 결손은 유한하게 끝난다 ===== */
{
  const T=loadRec();
  T.artPreload();
  const P=board(T);
  const dir=T.artDirOf(P.me), pref=T.ART_BASE+dir+"/";
  fire(T,u=>u.indexOf(pref)===0,"err");
  fire(T,()=>true,"ok");
  const base=reqs(T).filter(e=>e.src.indexOf(pref)===0).length;
  const rrBase=nRerender(T);
  const rounds=burn(T,pref);
  const total=reqs(T).filter(e=>e.src.indexOf(pref)===0).length;
  ok(rounds>0&&rounds<=8,"D1 영구 결손 조회 라운드가 유한하다 (관측 "+rounds+")");
  ok(total-base>0&&total-base<=16,"D2 그 종의 추가 요청 총량이 상한 이내다 ("+(total-base)+")");
  ok(GONE(T,dir,"icon.png")&&GONE(T,dir,"battle.png"),"D3 예산을 다 쓴 파일은 영구 결손으로 굳는다");
  ok(SETTLED(T,dir),"D4 모든 파일이 결정되면 그 종이 종료 표시로 굳는다");
  ok(T.clock.pending()===0,"D5 더 예약된 타이머가 없다 (무한 재시도 없음)");
  ok(T.ART.failed.has(dir)&&!isArt(T,P.me),"D6 화면은 안전 폴백에 머문다");
  ok(nRerender(T)-rrBase===0,"D7 실패만 있는 복구 조회는 재그리기를 예약하지 않는다 (재그리기 폭주 없음)");
  // 굳은 뒤에는 같은 종의 새 실패가 아무 요청·예약도 만들지 않는다
  const beforeReq=nReq(T);
  T.ART.failed.delete(dir);
  T.artFail(dir,mkImg(T));
  T.clock.advance(30000);
  ok(nReq(T)===beforeReq,"D8 굳은 종은 다시 조회하지 않는다 (요청 0건 추가)");
  ok(T.clock.pending()===0,"D9 굳은 종은 다시 예약하지 않는다");
}

/* ===== E. 중복 제거 ===== */
{
  /* E-a 예약 중복 제거 — 같은 종이 여덟 칸에서 동시에 실패 */
  const T=loadRec();
  T.artPreload(); fireAll(T,"ok");
  const P=board(T);
  const dir=T.artDirOf(P.me);
  T.clock.advance(1);                        // 설정 단계에 남은 예약을 먼저 흘려보낸다
  const before=nReq(T), rrBefore=nRerender(T);
  for(let i=0;i<8;i++) T.artFail(dir,mkImg(T));
  ok(nRerender(T)-rrBefore===1,"E1 여덟 칸이 동시에 실패해도 재그리기 예약은 1회다");
  T.clock.advance(500);
  ok(nReq(T)-before===1,"E2 조회 요청도 실제로 떨어진 파일 한 건뿐이다 — 멀쩡한 파일을 덤으로 부르지 않는다 ("+(nReq(T)-before)+")");
}
{
  /* E-b 진행 중 중복 제거 — 조회 요청이 아직 응답 전인데 같은 종이 또 실패한다 */
  const T=loadRec();
  T.artPreload(); fireAll(T,"ok");
  const P=board(T);
  const dir=T.artDirOf(P.me);
  T.clock.advance(1);
  const before=nReq(T);
  T.artFail(dir,mkImg(T));
  T.clock.advance(500);                      // 예약된 조회만 실행 — 이미지 응답은 아직 없다
  const inflight=nReq(T)-before;
  ok(inflight===1,"E3 조회가 실제로 나갔다 ("+inflight+"건)");
  T.ART.failed.delete(dir);
  T.artFail(dir,mkImg(T));                   // 응답 전 재실패
  T.clock.advance(500);
  ok(nReq(T)-before===inflight,"E4 조회가 진행 중이면 겹쳐 보내지 않는다 (추가 요청 0건)");
  fire(T,u=>u.indexOf(T.ART_BASE+dir+"/")===0,"ok");
  T.clock.advance(10);
  ok(!T.ART.failed.has(dir),"E5 진행 중이던 조회가 성공하면 그대로 복구된다");
}

/* ===== I. 능동 마감 — 응답이 아예 오지 않는 요청 ===== */
{
  const T=loadRec();
  T.artPreload(); fireAll(T,"ok");
  const P=board(T);
  const dir=T.artDirOf(P.me), pref=T.ART_BASE+dir+"/icon.png";
  T.clock.advance(1);
  const before=nReq(T);
  T.artFail(dir,mkImg(T));                   // 이 뒤로 어떤 이미지 이벤트도 먹이지 않는다
  T.clock.advance(500);                      // 첫 조회(+400)
  ok(nReq(T)-before===1,"I1 조회가 나갔다 (응답은 오지 않는다)");
  T.clock.advance(4000);                     // 마감(조회 시각 +5000) 전
  ok(nReq(T)-before===1,"I2 마감 전에는 겹쳐 보내지 않는다 — 응답을 기다리는 동안 새 요청이 없다");
  T.clock.advance(3000);                     // 마감 통과 + 다음 예약(+1200) 발화
  ok(nReq(T)-before>1,"I3 응답이 없어도 마감이 조회를 끝내고 다음 조회를 예약한다 (누적 "+(nReq(T)-before)+"건)");
  T.clock.advance(200000);                   // 충분히 오래
  ok(T.clock.pending()===0,"I4 응답이 끝까지 오지 않아도 예약이 유한하게 소진된다");
  ok(GONE(T,dir,"icon.png"),"I5 응답 없는 자산도 영구 결손으로 굳는다");
  ok(nReq(T)-before<=HMAX(T),"I6 그래도 총 요청이 절대 상한 이내다 ("+(nReq(T)-before)+")");
  /* 마감으로 끝난 조회는 핸들러가 떨어져 있어야 한다 — 뒤늦게 도착한 이벤트가 상태를 다시 건드리지 못하게 */
  const probes=reqs(T).filter(e=>e.src.indexOf(pref)===0&&!e._fired);
  ok(probes.length>1&&probes.every(e=>e.onload===null&&e.onerror===null),
     "I7 마감으로 끝난 조회는 onload·onerror 가 모두 떨어져 있다 ("+probes.length+"건)");
  const snapshot=JSON.stringify([[...T.ART.failed].sort(),GONELIST(T),nReq(T)]);
  for(const e of probes){ try{ if(e.onload) e.onload(); if(e.onerror) e.onerror(); }catch(err){} }
  T.clock.advance(30000);
  ok(JSON.stringify([[...T.ART.failed].sort(),GONELIST(T),nReq(T)])===snapshot,
     "I8 늦은 이벤트를 억지로 발화시켜도 상태·요청이 그대로다");
}

/* ===== F. 미공개 적 말의 정보 경계 ===== */
{
  const T=loadRec();
  T.artPreload();
  const P=board(T);
  const hiddenBefore=[chipDump(T,2,4),chipDump(T,2,5)];
  fireAll(T,"err");
  T.render();
  const hiddenMid=[chipDump(T,2,4),chipDump(T,2,5)];
  for(let i=0;i<6;i++){ T.clock.advance(5000); fireAll(T,"ok"); }
  T.clock.advance(100); T.render();
  const hiddenAfter=[chipDump(T,2,4),chipDump(T,2,5)];
  ok(JSON.stringify(hiddenBefore)===JSON.stringify(hiddenMid),"F1 실패 중에도 미공개 적 말 표시가 그대로다");
  ok(JSON.stringify(hiddenBefore)===JSON.stringify(hiddenAfter),"F2 복구 후에도 미공개 적 말 표시가 그대로다");
  const dump=hiddenBefore.join("|");
  ok(!/<img/.test(dump)&&!/assets\//.test(dump),"F3 미공개 말에는 <img>·자산 경로가 없다");
  const ed=T.artDirOf(P.em)||"";
  ok(ed&&dump.indexOf(ed)<0,"F4 미공개 적 하수인의 종 폴더 값이 DOM 어디에도 없다");
  ok(dump.indexOf("king")<0&&dump.indexOf("companion")<0&&P.ek.type==="king","F5 미공개 적 왕의 정체 값이 DOM 어디에도 없다");
  const all=reqs(T).map(e=>e.src), wantSet=new Set(corpus(T));
  ok(all.every(u=>wantSet.has(u)),"F6 복구 중 나간 요청이 전부 고정 44 집합 안이다");
  ok(isArt(T,P.me)&&T.leaderArtDir(P.king0)==="king","F7 같은 복구로 내 공개 말들은 실제로 아트를 되찾았다");
}

/* ===== H. 성공 뒤 뒤늦은 실패 ===== */
{
  /* H-a 프리로드는 전부 성공 → 게임 도중 보드 아이콘 1건 실패 → 조회 성공 → 아트 복귀.
     ART.loaded 에 이미 두 키가 다 들어 있으므로 "새로 얻은 파일"이 없다 — 그래도 폴백을 걷어내고 다시 그려야 한다. */
  const T=loadRec();
  T.artPreload(); fireAll(T,"ok");
  const P=board(T);
  const dir=T.artDirOf(P.me);
  ok(isArt(T,P.me),"H1 처음에는 아트로 보인다");
  T.clock.advance(1);                        // 설정 단계에 남은 예약을 먼저 흘려보낸다
  const rrBase=nRerender(T);
  T.artFail(dir,mkImg(T));
  T.render();
  ok(T.ART.failed.has(dir)&&!isArt(T,P.me),"H2 뒤늦은 실패도 즉시 안전 폴백으로 간다");
  step(T,500,u=>u.indexOf(T.ART_BASE+dir+"/")===0,"ok");
  T.clock.advance(10);
  ok(!T.ART.failed.has(dir),"H3 뒤늦은 실패도 복구된다 (지난 성공 기록을 지금 성공으로 오해하지 않는다)");
  ok(isArt(T,P.me),"H4 복구 후 다시 아트로 보인다");
  ok(nRerender(T)-rrBase>=2,"H5 실패와 복구 각각에서 다시 그린다 (복구 재그리기가 빠지지 않는다)");
}
{
  /* H-b 왕도 같은 경로 */
  const T=loadRec();
  T.artPreload(); fireAll(T,"ok");
  const P=board(T);
  ok(T.leaderArtDir(P.king0)==="king","H6 처음에는 왕이 아트다");
  T.artFail("king",mkImg(T));
  ok(T.leaderArtDir(P.king0)===null&&/👑/.test(T.pcFaceHtml(P.king0)),"H7 뒤늦은 실패면 왕이 이모지로 내려간다");
  step(T,500,u=>u.indexOf(T.LEADER_BASE+"king/")===0,"ok");
  T.clock.advance(10);
  ok(T.leaderArtDir(P.king0)==="king","H8 왕도 뒤늦은 실패에서 복구된다");
}

/* ===== J. 파일 단위 책임 — 전투 도트가 영영 없어도 보드 아이콘을 막지 않는다 ===== */
{
  /* J-a 프리로드에서 전투 파일만 실패 */
  const T=loadRec();
  T.artPreload();
  const P=board(T);
  const dir=T.artDirOf(P.me), bat=T.ART_BASE+dir+"/battle.png";
  fire(T,u=>u===bat,"err");
  fire(T,()=>true,"ok");
  const rrBase=nRerender(T), reqBase=nReq(T);
  ok(isArt(T,P.me)&&!T.ART.failed.has(dir),"J1 전투 파일만 빠져도 보드 아이콘은 막히지 않는다");
  const rounds=burn(T,bat);
  ok(rounds>0&&rounds<=8,"J2 전투 파일 조회도 유한하게 끝난다 (관측 "+rounds+")");
  ok(GONE(T,dir,"battle.png")&&!GONE(T,dir,"icon.png"),"J3 없는 파일만 영구 결손으로 굳는다 (아이콘은 멀쩡하다)");
  ok(T.clock.pending()===0,"J4 남은 예약이 없다");
  ok(isArt(T,P.me),"J5 그 동안에도 보드 아이콘은 계속 아트다");
  ok(nRerender(T)-rrBase===0,"J6 재그리기 고리를 만들지 않는다");
  ok(nReq(T)-reqBase<=HMAX(T),"J7 추가 요청 총량이 상한 이내다 ("+(nReq(T)-reqBase)+")");
  ok(BATOK(T,dir)===false,"J8 영구 결손으로 판정된 전투 파일은 다시 <img> 로 나가지 않는다");
}
{
  /* J-b 뒤늦은 전투 도트 실패 — 아이콘·전투 파일이 둘 다 로드된 뒤 전투창에서 전투 도트만 영영 실패한다.
     아이콘은 멀쩡하므로 보드 얼굴은 되돌아와야 하고, 전투 파일은 굳어 다음 전투창이 다시 요청하지 않아야 한다. */
  const T=loadRec();
  T.artPreload(); fireAll(T,"ok");
  const P=board(T);
  const dir=T.artDirOf(P.me), bat=T.ART_BASE+dir+"/battle.png";
  ok(isArt(T,P.me)&&BATOK(T,dir),"J9 전제: 아이콘·전투 파일이 둘 다 살아 있다");
  const reqBase=nReq(T);
  let loops=0;
  for(let i=0;i<12;i++){                       // 전투창이 열릴 때마다 전투 도트가 실패하는 상황을 되풀이한다
    if(!BATOK(T,dir)) break;
    loops++;
    T.artSpriteFail(dir,mkImg(T));
    ok(i>0||T.ART.failed.has(dir),"J10 전투 도트 실패는 종전대로 그 종을 실패로 기록한다 (기존 계약 보존)");
    for(let k=0;k<8;k++){ T.clock.advance(6000); fire(T,u=>u===bat,"err"); fire(T,()=>true,"ok"); }
  }
  ok(loops<=HMAX(T),"J11 전투 도트 실패 왕복이 유한하다 (관측 "+loops+"회)");
  ok(!T.ART.failed.has(dir)&&isArt(T,P.me),"J12 전투 도트가 영영 없어도 멀쩡한 보드 아이콘은 되돌아온다");
  ok(GONE(T,dir,"battle.png")&&BATOK(T,dir)===false,"J13 전투 파일은 굳어 다음 전투창이 다시 요청하지 않는다");
  ok(!GONE(T,dir,"icon.png"),"J14 아이콘은 영구 결손으로 굳지 않는다");
  ok(nReq(T)-reqBase<=2*HMAX(T),"J15 그 왕복의 총 요청이 절대 상한 이내다 ("+(nReq(T)-reqBase)+")");
  ok(T.clock.pending()===0,"J16 남은 예약이 없다");
}

{
  /* J-c 왕·동료 — 프리로드 4장이 전부 성공한 뒤, 전투창에서 전투 도트(battle256)만 영영 실패한다.
     보드 아이콘(icon64)은 멀쩡하므로 되돌아와야 하고, battle256 은 굳어 다음 전투창이 다시 요청하지 않아야 한다.
     (leaderBattleDir 은 과거 기록인 ART.loaded 만 보므로, 영구 결손 판정을 함께 보지 않으면 매번 다시 요청한다.) */
  for(const [who,kind] of [["king","king0"],["companion","ally0"]]){
    const T=loadRec();
    T.artPreload(); fireAll(T,"ok");
    const P=board(T);
    const piece=P[kind], bat=T.LEADER_BASE+who+"/"+T.LEADER_FILES.battle;
    ok(T.leaderArtDir(piece)===who&&T.leaderBattleDir(piece,piece)===who,"J17."+who+" 전제: 보드 아이콘·전투 도트가 둘 다 살아 있다");
    T.clock.advance(1);
    const reqBase=nReq(T);
    let loops=0;
    for(let i=0;i<12;i++){
      if(T.leaderBattleDir(piece,piece)===null) break;
      loops++;
      T.artSpriteFail(who,mkImg(T));                 // 전투창이 열릴 때마다 전투 도트가 실패하는 상황
      for(let k=0;k<8;k++){ T.clock.advance(6000); fire(T,u=>u===bat,"err"); fire(T,()=>true,"ok"); }
    }
    ok(loops<=HMAX(T),"J18."+who+" 전투 도트 실패 왕복이 유한하다 (관측 "+loops+"회)");
    ok(!T.ART.failed.has(who)&&T.leaderArtDir(piece)===who,"J19."+who+" 전투 도트가 영영 없어도 보드 아이콘은 되돌아온다");
    ok(/<img class="icon leader"/.test(T.pcFaceHtml(piece)),"J20."+who+" 보드에서 실제로 아트로 그려진다");
    ok(GONE(T,who,T.LEADER_FILES.battle)&&!GONE(T,who,T.LEADER_FILES.icon),"J21."+who+" 없는 파일만 영구 결손으로 굳는다");
    ok(T.leaderBattleDir(piece,piece)===null,"J22."+who+" 굳은 전투 도트는 다음 전투창이 다시 요청하지 않는다");
    ok(nReq(T)-reqBase<=2*HMAX(T),"J23."+who+" 그 왕복의 총 요청이 절대 상한 이내다 ("+(nReq(T)-reqBase)+")");
    ok(T.clock.pending()===0,"J24."+who+" 남은 예약이 없다");
  }
}

/* ===== G. 변경 전 소스 음성 대조 — 같은 동작을 기준판에서 재현한다 ===== */
{
  let baseHtml=null;
  try{ baseHtml=execFileSync("git",["show",BASE_REF+":demo/index.html"],{cwd:ROOT,encoding:"utf8",maxBuffer:64*1024*1024}); }
  catch(e){ baseHtml=null; }
  if(!baseHtml){
    console.error("SKIP: 기준판("+BASE_REF.slice(0,7)+")을 읽지 못해 음성 대조를 건너뛴다 — 얕은 클론이면 fetch-depth:0 이 필요하다");
    ok(false,"G0 기준판 소스를 읽었다");
  } else {
    /* G-a 프리로드 1건 실패 뒤 자산이 정상으로 돌아와도 기준판은 다시 조회하지 않는다 → 영구 텍스트 폴백 */
    const T=loadRec({html:baseHtml});
    T.artPreload();
    const P=board(T);
    const dir=T.artDirOf(P.me), pref=T.ART_BASE+dir+"/";
    fire(T,u=>u===pref+"icon.png","err");
    fire(T,()=>true,"ok");
    const reqBase=nReq(T);
    for(let i=0;i<10;i++){ T.clock.advance(6000); fire(T,u=>u.indexOf(pref)===0,"ok"); }
    T.render();
    ok(nReq(T)-reqBase===0,"G1 기준판은 실패한 자산을 다시 조회하지 않는다 (추가 요청 0건)");
    ok(T.ART.failed.has(dir)&&!isArt(T,P.me),"G2 기준판에서는 하수인이 영구히 텍스트 폴백이다 (#201 증상)");
    /* G-b 왕 아이콘 1건 실패 → 기준판은 영원히 이모지 */
    const T2=loadRec({html:baseHtml});
    T2.artPreload();
    const P2=board(T2);
    fire(T2,u=>u===T2.LEADER_BASE+"king/"+T2.LEADER_FILES.icon,"err");
    fire(T2,()=>true,"ok");
    for(let i=0;i<10;i++){ T2.clock.advance(6000); fire(T2,u=>u.indexOf("king/")>=0,"ok"); }
    T2.render();
    ok(T2.leaderArtDir(P2.king0)===null&&/👑/.test(T2.pcFaceHtml(P2.king0)),"G3 기준판에서는 왕이 영구히 이모지다 (#201 증상)");
    /* G-c 뒤늦은 실패도 기준판에서는 돌아오지 않는다 */
    const T3=loadRec({html:baseHtml});
    T3.artPreload(); fireAll(T3,"ok");
    const P3=board(T3);
    const d3=T3.artDirOf(P3.me);
    T3.artFail(d3,mkImg(T3));
    for(let i=0;i<10;i++){ T3.clock.advance(6000); fire(T3,u=>u.indexOf(T3.ART_BASE+d3+"/")===0,"ok"); }
    T3.render();
    ok(T3.ART.failed.has(d3)&&!isArt(T3,P3.me),"G4 기준판에서는 뒤늦은 실패도 영구히 남는다 (#201 증상)");
    /* G-d 기준판은 전투 도트 실패가 멀쩡한 보드 아이콘을 영구히 막는다 */
    const T5=loadRec({html:baseHtml});
    T5.artPreload(); fireAll(T5,"ok");
    const P5=board(T5);
    const d5=T5.artDirOf(P5.me);
    T5.artSpriteFail(d5,mkImg(T5));
    for(let i=0;i<10;i++){ T5.clock.advance(6000); fireAll(T5,"ok"); }
    T5.render();
    ok(T5.ART.failed.has(d5)&&!isArt(T5,P5.me),"G5 기준판에서는 전투 도트 실패가 보드 아이콘까지 영구히 막는다 (#201 증상)");
    /* G-f 기준판은 왕의 전투 도트가 영영 없어도 그 사실을 배우지 못해 계속 다시 요청한다 */
    const T6=loadRec({html:baseHtml});
    T6.artPreload(); fireAll(T6,"ok");
    const P6=board(T6);
    const bat6=T6.LEADER_BASE+"king/"+T6.LEADER_FILES.battle;
    T6.artSpriteFail("king",mkImg(T6));
    for(let i=0;i<10;i++){ T6.clock.advance(6000); fire(T6,u=>u===bat6,"err"); fire(T6,()=>true,"ok"); }
    T6.render();
    ok(T6.leaderBattleDir(P6.king0,P6.king0)==="king"||T6.ART.failed.has("king"),
       "G7 기준판은 전투 도트 영구 결손을 배우지 못하거나 왕 전체를 영구히 폴백에 둔다 (#201 증상)");
    /* G-e 현행 소스는 같은 상황들을 복구한다 — 대조의 반대쪽 */
    const T4=loadRec();
    T4.artPreload();
    const P4=board(T4);
    fire(T4,u=>u===T4.LEADER_BASE+"king/"+T4.LEADER_FILES.icon,"err");
    fire(T4,()=>true,"ok");
    step(T4,500,u=>u.indexOf("king/")>=0,"ok"); T4.clock.advance(10); T4.render();
    ok(T4.leaderArtDir(P4.king0)==="king","G6 현행 소스는 같은 상황에서 복구된다");
  }
}

console.log(`=== smoke_online_art (#201): pass ${pass} / fail ${fail} ===`);
if(fail){ console.error("실패 목록:\n  "+fails.join("\n  ")); process.exit(1); }
