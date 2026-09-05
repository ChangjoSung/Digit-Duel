/* #54 온라인 PVP 접속 경로 헤드리스 회귀 — node demo/test/smoke_online.js [demo/index.html]
   범위: 서버 주소 기본값(file: → 내부망 기본 / http(s): → 현재 host)·저장값 우선·스토리지 예외 허용·
   주소 정규화(스킴 제거·포트 보정·공백 제거)·페이지 프로토콜별 ws/wss 선택·정규화 결과 저장·
   사전 배치 준비 상태(배치 미완 시 매칭 금지 · 완료 시 배치 캡처 후 큐 진입 · 매칭 취소 시 배치 유지).
   게임 규칙·UI는 검증 범위가 아니다 (규칙 회귀는 smoke_cycle5). */
"use strict";
const H=require("./harness");
const htmlPath=process.argv[2];
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const FILE_HREF="file:///C:/Digit-Duel/demo/index.html";
/* href(페이지 위치) + 저장소 내용을 지정해 새 로드 — 실제 사용자가 그 주소에서 html을 연 상태와 같다 */
function loadAt(href,st){ return H.load(htmlPath,{href:href,storage:H.mkStorage(Object.assign({tutorialSeen:"1"},st||{}))}); }
/* #54 REVISE: 요소는 반드시 "그 로드의" 문서에서 집는다 (전역 document 경유는 나중 load에 끌려간다).
   하네스 els는 getElementById로 접근한 순간 생기므로 렌더 문자열만으로는 아직 없다. */
function $el(T,id){ return T.byId(id); }
function toasts(T){ return ($el(T,"toasts").children||[]).map(x=>x.textContent); }

/* ===== A. 서버 주소 기본값 — 페이지 프로토콜·저장값 ===== */
{
  const T=loadAt(FILE_HREF);
  ok(T.netServerDefault()===T.NET_LAN_DEFAULT&&T.NET_LAN_DEFAULT==="192.168.3.19:8080","A1 file:// 실행(host 없음)은 내부망 기본값 "+T.NET_LAN_DEFAULT);
  ok(T.location.protocol==="file:"&&T.location.host==="","A2 하네스 location 스텁은 실제 file:// 처럼 protocol·host를 갖는다 (없으면 로드 즉시 예외)");
  ok($el(T,"sidePanel").innerHTML.indexOf(T.NET_LAN_DEFAULT)>=0,"A3 메뉴 서버 주소 입력칸에 기본값이 채워진다 (렌더가 예외 없이 완주)");
}
{
  const T=loadAt("http://192.168.0.7:8080/demo/index.html");
  ok(T.netServerDefault()==="192.168.0.7:8080","A4 http:// 실행은 현재 host(포트 포함)를 기본값으로 — 배포한 서버가 곧 relay 서버");
}
{
  const T=loadAt("https://duel.example.com/demo/index.html");
  ok(T.netServerDefault()==="duel.example.com","A5 https:// 실행은 현재 host (기본 포트는 생략된 그대로)");
}
{
  const T=loadAt("http://10.0.0.5:3000/x/index.html");
  ok(T.netServerDefault()==="10.0.0.5:3000","A6 비표준 포트도 host 그대로 유지");
}
{
  const T=loadAt(FILE_HREF,{netServer:"10.1.2.3:9000"});
  ok(T.netServerDefault()==="10.1.2.3:9000","A7 저장된 주소가 있으면 file:// 기본값보다 우선");
}
{
  const T=loadAt("http://192.168.0.7:8080/demo/index.html",{netServer:"10.1.2.3:9000"});
  ok(T.netServerDefault()==="10.1.2.3:9000","A8 저장된 주소가 있으면 현재 host보다도 우선 (사용자가 직접 고른 값)");
}
{
  // 시크릿 모드·정책 차단 등 접근 자체가 예외인 환경 — 전역에 꽂지 않고 이 로드에만 주입한다
  let err=null,T=null;
  try{ T=H.load(htmlPath,{href:FILE_HREF,storage:H.throwingStorage("SecurityError: denied")}); }catch(e){ err=e; }
  ok(!err&&T&&T.netServerDefault()===T.NET_LAN_DEFAULT,"A9 localStorage 접근이 예외를 던져도 로드·기본값 정상 ("+(err&&err.message)+")");
}

/* ===== B. 주소 정규화 · ws/wss 선택 · 정규화 결과 저장 ===== */
function connectWith(href,input,st){
  const T=loadAt(href,st);
  if(input!==null&&input!==undefined) $el(T,"netServer").value=input;
  T.netConnect();
  return T;
}
{
  const T=connectWith(FILE_HREF,null);
  ok(T.wsLog.length===1&&T.wsLog[0].url==="ws://"+T.NET_LAN_DEFAULT,"B1 입력 없음 → 기본값으로 ws:// 접속 ("+T.wsLog[0].url+")");
  ok(T.NET.ws===T.wsLog[0],"B2 생성된 소켓이 NET.ws에 보관된다");
  T.netConnect();
  ok(T.wsLog.length===1&&/이미 서버에 연결 중/.test(toasts(T).join("|")),"B3 이미 연결 중이면 소켓을 새로 만들지 않는다");
}
{
  const T=connectWith(FILE_HREF,"1.2.3.4");
  ok(T.wsLog.length===1&&T.wsLog[0].url==="ws://1.2.3.4:8080","B4 포트 생략 → 기본 포트 8080 보정");
  ok(T.storage.getItem("netServer")==="1.2.3.4:8080","B5 저장되는 값은 원문이 아니라 정규화 결과");
}
{
  const T=connectWith(FILE_HREF,"http://1.2.3.4:9999");
  ok(T.wsLog[0].url==="ws://1.2.3.4:9999","B6 스킴을 붙여 입력해도 제거 후 사용 (http://…)");
}
{
  const T=connectWith(FILE_HREF,"  ws://192.168.5.5:7000  ");
  ok(T.wsLog[0].url==="ws://192.168.5.5:7000"&&T.storage.getItem("netServer")==="192.168.5.5:7000","B7 앞뒤 공백 제거 + ws:// 스킴 제거");
}
{
  const T=connectWith("https://duel.example.com/demo/index.html",null);
  ok(T.wsLog[0].url==="wss://duel.example.com:8080","B8 https 페이지는 wss:// (혼합 콘텐츠 차단 회피) — "+T.wsLog[0].url);
}
{
  const T=connectWith("http://192.168.0.7:8080/demo/index.html",null);
  ok(T.wsLog[0].url==="ws://192.168.0.7:8080","B9 http 페이지는 ws://");
}
{
  const T=connectWith("https://duel.example.com/demo/index.html","10.9.9.9");
  ok(T.wsLog[0].url==="wss://10.9.9.9:8080","B10 wss 선택은 페이지 프로토콜 기준 — 직접 입력한 주소에도 적용");
}
{
  // 저장 실패(용량 초과·정책)해도 접속은 계속되어야 한다
  const T=loadAt(FILE_HREF);
  T.storage.setItem=()=>{ throw new Error("QuotaExceededError"); };
  $el(T,"netServer").value="1.2.3.4:5555";
  let err=null; try{ T.netConnect(); }catch(e){ err=e; }
  ok(!err&&T.wsLog.length===1&&T.wsLog[0].url==="ws://1.2.3.4:5555","B11 주소 저장이 실패해도 예외 없이 접속 진행");
}
{
  const T=loadAt(FILE_HREF);
  ok(/const url=\(location\.protocol==="https:"\?"wss:\/\/":"ws:\/\/"\)/.test(T.html)&&!/ws:\/\/\$\{/.test(T.html),"B12 ws/wss 선택이 코드 한 곳(netConnect)에서만 결정된다 (정적)");
}

/* ===== C. 사전 배치 준비 상태 — 배치 완료 후에만 매칭 ===== */
function prepared(){ const T=loadAt(FILE_HREF); T.netPrepare(); return T; }
{
  const T=prepared();
  ok(T.NET.preparing===true&&T.NET.queued===false&&T.NET.mySetup===null&&T.NET.ws===null&&T.wsLog.length===0,"C1 netPrepare는 배치 준비만 — 아직 서버에 접속하지 않는다");
  ok(T.S.phase==="setup"&&T.S.mode==="pvp"&&T.S.setupPlayer===0,"C2 배치 화면(pvp setup, 내가 P0)으로 진입");
  ok(/온라인 대전 — 내 로스터 선택/.test($el(T,"sidePanel").innerHTML)&&/배치 완료 → 매칭 시작/.test($el(T,"sidePanel").innerHTML),"C3 배치 화면 안내·버튼 문구가 온라인용");
}
{
  const T=prepared();
  T.netAction({t:"setupDone"}); // 로스터 0종·배치 0개 상태
  ok(T.NET.queued===false&&T.NET.mySetup===null&&T.wsLog.length===0&&/로스터 6종 선택과 14개 배치/.test(toasts(T).join("|")),"C4 배치 미완 상태에서는 매칭 큐에 들어가지 않는다 (접속 시도 0)");
  T.netAction({t:"auto"}); // 로스터 자동 + 14개 배치
  const unplaced=T.S.pieces.filter(x=>x.owner===0&&!x.placed).length;
  ok(T.S.roster[0].length===6&&unplaced===0,"C5 전제: 무작위 배치로 로스터 6종·14개 배치 완료");
  T.netAction({t:"setupDone"});
  ok(T.NET.queued===true&&!!T.NET.mySetup&&T.wsLog.length===1,"C6 배치 완료 후 setupDone → 배치 캡처 + 매칭 큐 진입 + 서버 접속 1회");
  const su=T.NET.mySetup;
  ok(Array.isArray(su.roster)&&su.roster.length===6&&new Set(su.roster).size===6&&su.roster.every(id=>T.ROSTER.some(r=>r.id===id)),"C7 캡처된 로스터: 중복 없는 6종·모두 실제 종");
  ok(Array.isArray(su.pos)&&su.pos.length===14&&su.pos.every(q=>[11,12,13].includes(q[0])&&q[1]>=1&&q[1]<=7)&&new Set(su.pos.map(q=>q.join("_"))).size===14,"C8 캡처된 배치: 14칸·모두 자기 진영(11~13행)·중복 없음");
  ok(/매칭 대기 중/.test($el(T,"sidePanel").innerHTML),"C9 큐 진입 후 화면은 매칭 대기");
  const posBefore=JSON.stringify(su.pos);
  T.netCancelQueue();
  ok(T.NET.queued===false&&T.NET.ws===null&&T.wsLog[0].closed===true&&JSON.stringify(T.NET.mySetup.pos)===posBefore,"C10 매칭 취소: 연결만 끊고 배치는 유지");
  ok(T.S.pieces.filter(x=>x.owner===0&&x.placed).length===14,"C11 매칭 취소 후에도 보드 배치 그대로");
}
{
  const T=prepared();
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  T.netPrepare();
  ok(T.wsLog.length===1&&/이미 온라인 대전이 진행 중/.test(toasts(T).join("|")),"C12 이미 매칭 중이면 netPrepare가 배치를 초기화하지 않는다");
}
{
  // 사전 배치 데이터 적용: P1은 그대로, P2는 행 미러링 (양측 동일 데이터 → 동일 결과)
  const T=loadAt(FILE_HREF);
  T.newGame("pvp");
  const roster=T.ROSTER.slice(0,6).map(r=>r.id);
  const pos=[]; for(const r of [11,12,13]) for(let c=1;c<=7&&pos.length<14;c++) pos.push([r,c]);
  T.applyNetSetup(0,{roster:roster,pos:pos});
  T.applyNetSetup(1,{roster:roster,pos:pos});
  const p0=T.S.pieces.filter(x=>x.owner===0), p1=T.S.pieces.filter(x=>x.owner===1);
  ok(p0.every(x=>x.placed&&[11,12,13].includes(x.r))&&p1.every(x=>x.placed&&[1,2,3].includes(x.r)),"C13 사전 배치 적용: P1은 11~13행, P2는 1~3행으로 미러링");
  ok(p1.every((x,i)=>x.r===14-p0[i].r&&x.c===p0[i].c),"C14 미러링 규칙은 r→14−r (열 동일)");
  T.applyNetSetup(1,{roster:["없는말"],pos:[]}); // 손상 데이터
  const p1b=T.S.pieces.filter(x=>x.owner===1);
  ok(p1b.every(x=>x.placed&&[1,2,3].includes(x.r))&&T.S.roster[1].length===6,"C15 손상된 배치 데이터는 무작위 배치로 대체 (락스텝 유지)");
  T.TQ.length=0;
}

/* ===== D. 하네스 격리 — 나중 load()가 앞선 T의 관측을 흔들지 못한다 (#54 REVISE) =====
   회귀 원인: WebSocket 로그가 모듈 전역 하나였고 load()마다 그것을 비웠으며, location·localStorage·document를
   전역에만 꽂아 제품 코드가 "가장 최근 load"의 것을 봤다. 아래는 그 회귀를 직접 잡는다. */
{
  const T1=connectWith(FILE_HREF,"1.1.1.1:1111");
  const n1=T1.wsLog.length, u1=T1.wsLog[0].url;
  const T2=loadAt("https://duel.example.com/demo/index.html",{netServer:"2.2.2.2:2222"});
  ok(T1.wsLog!==T2.wsLog&&T1.WebSocketCtor!==T2.WebSocketCtor,"D1 load()마다 고유한 WebSocket 생성자·로그를 가진다");
  ok(T1.wsLog.length===n1&&T1.wsLog[0].url===u1,"D2 나중 load()가 앞선 T의 wsLog를 비우지 않는다 ("+u1+")");
  T2.netConnect();
  ok(T2.wsLog.length===1&&T1.wsLog.length===n1,"D3 나중 load의 접속은 자기 로그에만 쌓인다 (앞선 T 로그 불변)");
  ok(T1.location.protocol==="file:"&&T1.netServerDefault()==="1.1.1.1:1111","D4 앞선 T의 location·저장소는 나중 load의 https/다른 주소에 끌려가지 않는다");
  ok(T2.netServerDefault()==="2.2.2.2:2222"&&T2.wsLog[0].url==="wss://2.2.2.2:2222","D5 나중 T는 자기 페이지 프로토콜(https→wss)과 자기 저장값을 쓴다");
  T1.render();
  ok($el(T1,"sidePanel").innerHTML.indexOf("1.1.1.1:1111")>=0,"D6 앞선 T의 render()는 자기 문서에 그린다 (나중 load의 document로 새지 않음)");
}
{
  // storage 옵션을 생략한 load는 "앞선 load가 남긴 저장소"를 물려받지 않는다 (결정적 기본값 = 빈 저장소)
  H.resetStorage();
  const A=H.load(htmlPath,{href:FILE_HREF,storage:H.mkStorage({netServer:"9.9.9.9:9999"})});
  ok(A.netServerDefault()==="9.9.9.9:9999","D7 전제: 명시한 저장소의 주소를 쓴다");
  const B=H.load(htmlPath,{href:FILE_HREF});
  ok(B.netServerDefault()===B.NET_LAN_DEFAULT&&B.storage!==A.storage&&H.storageTrace(B.storage).all.length===0,
    "D8 storage 옵션 생략 = 빈 저장소 (앞선 load의 저장소를 우연히 물려받지 않는다)");
  const pre=H.setStorage(H.mkStorage({netServer:"8.8.8.8:8888"})); // 명시적 사전 설치 계약
  const C=H.load(htmlPath,{href:FILE_HREF});
  ok(C.storage===pre&&C.netServerDefault()==="8.8.8.8:8888","D9 setStorage()로 명시 설치한 저장소만 옵션 없는 load가 물려받는다");
  H.resetStorage();
  const E=H.load(htmlPath,{href:FILE_HREF});
  ok(E.storage!==pre&&E.netServerDefault()===E.NET_LAN_DEFAULT,"D10 resetStorage() 후에는 다시 빈 저장소가 기본");
}

console.log(`\n=== smoke_online: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
