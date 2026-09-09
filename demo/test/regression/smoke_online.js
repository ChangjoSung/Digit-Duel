/* #54·#63 온라인 PVP 접속 경로 헤드리스 회귀 — node demo/test/regression/smoke_online.js [demo/index.html]
   범위:
     A. 서버 주소 기본값 — 사설 IP 하드코딩 부재 · http(s) → 현재 host · file:// → 127.0.0.1:8080 · 저장값 우선 · 스토리지 예외 허용
     B. 주소 정규화(스킴 제거·포트 보정·공백) · 페이지 프로토콜별 ws/wss · 정규화 결과만 저장
     H. 목적지 허용 목록 — localhost·루프백·사설·링크로컬 IP 리터럴만 접속. 도메인 이름·공인 IP·사용자정보·잘못된 포트·경로/쿼리/프래그먼트는 소켓 생성 전에 거부(조용한 잘라내기 없음)
     C. 접속 코드 — 분리 입력칸(password) · 8~64자 RFC 7230 토큰 검증(서버 계약과 동일) · 하위 프로토콜 [마커, 코드] 제시
     D. 코드 비노출 — 저장소·쿠키·URL/쿼리/프래그먼트·토스트·상태 배지·게임 로그·콘솔·예외 어디에도 남지 않음
     E. 저장값 마크업 주입 방어 — localStorage 주소가 input value 속성으로 그대로 보간되지 않음
     F. 사전 배치 준비 상태(배치 미완 시 매칭 금지 · 완료 시 배치 캡처 후 큐 진입 · 매칭 취소 시 배치 유지)
     G. 하네스 격리 — 나중 load()가 앞선 T의 관측을 흔들지 못한다
   게임 규칙·UI는 검증 범위가 아니다 (규칙 회귀는 smoke_cycle5). */
"use strict";
const H=require("../shared/harness");
/* 인자 없이 돌리는 저장소 표준 명령(node demo/test/regression/smoke_online.js)이 기본이다 — 경로는 여기서 한 번 확정해
   두어야 하네스 밖에서 직접 파일을 읽는 곳(J 음성 대조군)도 같은 대상을 본다. 명시 인자는 그대로 우선하며,
   과거 커밋의 소스로 이 테스트를 돌리는 음성 대조 실행이 그 통로를 쓴다. */
const htmlPath=process.argv[2]||require("path").join(__dirname,"..","..","index.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const FILE_HREF="file:///C:/Digit-Duel/demo/index.html";
const CODE="5F65J3YKGD";          // 서버가 만드는 것과 같은 모양의 유효 코드 (10자 · Crockford 계열)
const MARKER="digit-duel.v1";     // 공개 마커 — server/security.js PROTOCOL_MARKER 와 같아야 한다
/* href(페이지 위치) + 저장소 내용을 지정해 새 로드 — 실제 사용자가 그 주소에서 html을 연 상태와 같다 */
function loadFrom(p,href,st){ return H.load(p,{href:href,storage:H.mkStorage(Object.assign({tutorialSeen:"1"},st||{}))}); }
function loadAt(href,st){ return loadFrom(htmlPath,href,st); }
/* #54 REVISE: 요소는 반드시 "그 로드의" 문서에서 집는다 (전역 document 경유는 나중 load에 끌려간다).
   하네스 els는 getElementById로 접근한 순간 생기므로 렌더 문자열만으로는 아직 없다. */
function $el(T,id){ return T.byId(id); }
function toasts(T){ return ($el(T,"toasts").children||[]).map(x=>x.textContent); }
function logText(T){ return (T.S&&T.S.log?T.S.log:[]).map(l=>l.msg).join("|"); }
/* 코드를 넣고 접속하는 표준 경로 (메뉴 입력칸 → netConnect) */
function protos(ws){ return ws&&Array.isArray(ws.protocols)?ws.protocols:[]; }
function typeCode(T,code){ $el(T,"netCode").value=(code===undefined?CODE:code); return T; }

/* ===== A. 서버 주소 기본값 — 사설 IP 하드코딩 부재 · 페이지 프로토콜 · 저장값 ===== */
{
  const T=loadAt(FILE_HREF);
  /* 조각 결합으로 만든다 — 이 회귀를 지키자고 저장소에 그 리터럴을 다시 심어 두면
     "코드에서 지웠다"는 사실 자체가 문자열 검색에서 흐려진다. */
  const LEGACY_ADDR=["192","168","3","19"].join(".");
  ok(T.html.indexOf(LEGACY_ADDR)<0,"A0 구형 개발 PC 내부망 주소가 소스 어디에도 없다");
  ok(!/\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\s*:\s*\d+/.test(T.html),
    "A0b 어떤 사설 IP:포트도 기본값으로 박혀 있지 않다 (예시·플레이스홀더 포함)");
  ok(T.netServerDefault()===T.NET_LOCAL_DEFAULT&&T.NET_LOCAL_DEFAULT==="127.0.0.1:8080",
    "A1 file:// 실행(host 없음)은 이 PC 기본값 "+T.NET_LOCAL_DEFAULT);
  ok(T.location.protocol==="file:"&&T.location.host==="","A2 하네스 location 스텁은 실제 file:// 처럼 protocol·host를 갖는다 (없으면 로드 즉시 예외)");
  ok($el(T,"sidePanel").innerHTML.indexOf(T.NET_LOCAL_DEFAULT)>=0,"A3 메뉴 서버 주소 입력칸에 기본값이 채워진다 (렌더가 예외 없이 완주)");
  const menu=$el(T,"sidePanel").innerHTML;
  ok(/file:\/\//.test(menu)&&/Origin/.test(menu)&&/http:\/\/127\.0\.0\.1:8080/.test(menu),
    "A3b file:// 로 열면 '서버가 Origin을 거부한다 + 서버가 서빙하는 주소로 열어라' 안내가 메뉴에 뜬다");
}
{
  const T=loadAt("http://192.168.0.7:8080/demo/index.html");
  ok(T.netServerDefault()==="192.168.0.7:8080","A4 http:// 실행은 현재 host(포트 포함)를 기본값으로 — 배포한 서버가 곧 relay 서버");
  ok(!/file:\/\//.test($el(T,"sidePanel").innerHTML),"A4b http:// 로 열면 file:// 경고를 띄우지 않는다");
}
{
  const T=loadAt("https://duel.example.com/demo/index.html");
  ok(T.netServerDefault()==="duel.example.com","A5 https:// 실행은 현재 host를 기본값으로 보여준다 (기본 포트는 생략된 그대로)");
  typeCode(T); T.netConnect();
  ok(T.wsLog.length===0&&/접속할 수 없는 주소/.test(toasts(T).join("|")),
    "A5b 그 host가 공인 도메인이면 접속은 거부된다 — 기본값이라고 해서 코드를 내보내지 않는다");
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
  ok(!err&&T&&T.netServerDefault()===T.NET_LOCAL_DEFAULT,"A9 localStorage 접근이 예외를 던져도 로드·기본값 정상 ("+(err&&err.message)+")");
}

/* ===== B. 주소 정규화 · ws/wss 선택 · 정규화 결과 저장 ===== */
function connectWith(href,input,st,code){
  const T=loadAt(href,st);
  if(input!==null&&input!==undefined) $el(T,"netServer").value=input;
  typeCode(T,code);
  T.netConnect();
  return T;
}
{
  const T=connectWith(FILE_HREF,null);
  ok(T.wsLog.length===1&&T.wsLog[0].url==="ws://"+T.NET_LOCAL_DEFAULT,"B1 입력 없음 → 기본값으로 ws:// 접속 ("+T.wsLog[0].url+")");
  ok(T.NET.ws===T.wsLog[0],"B2 생성된 소켓이 NET.ws에 보관된다");
  T.netConnect();
  ok(T.wsLog.length===1&&/이미 서버에 연결 중/.test(toasts(T).join("|")),"B3 이미 연결 중이면 소켓을 새로 만들지 않는다");
}
{
  const T=connectWith(FILE_HREF,"192.168.0.9");
  ok(T.wsLog.length===1&&T.wsLog[0].url==="ws://192.168.0.9:8080","B4 포트 생략 → 기본 포트 8080 보정");
  ok(T.storage.getItem("netServer")==="192.168.0.9:8080","B5 저장되는 값은 원문이 아니라 정규화 결과");
}
{
  const T=connectWith(FILE_HREF,"http://10.0.0.9:9999");
  ok(T.wsLog[0].url==="ws://10.0.0.9:9999","B6 스킴을 붙여 입력해도 제거 후 사용 (http://…)");
}
{
  const T=connectWith(FILE_HREF,"  ws://192.168.5.5:7000  ");
  ok(T.wsLog[0].url==="ws://192.168.5.5:7000"&&T.storage.getItem("netServer")==="192.168.5.5:7000","B7 앞뒤 공백 제거 + ws:// 스킴 제거");
}
{
  const T=connectWith("https://duel.example.com/demo/index.html",null,{netServer:"192.168.5.5:7000"});
  ok(T.wsLog[0].url==="wss://192.168.5.5:7000","B8 https 페이지는 wss:// (혼합 콘텐츠 차단 회피) — "+T.wsLog[0].url);
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
  // 경로·쿼리가 붙은 입력은 조용히 잘라내지 않는다 — 잘라내면 붙여 넣은 것과 실제 접속지가 달라지고,
  // 코드가 섞인 URL을 넣었을 때 "일부만 지워진 채 접속"하는 모호한 상태가 된다.
  const T=connectWith(FILE_HREF,"http://192.168.0.9:8080/demo/index.html?code="+CODE+"#x");
  ok(T.wsLog.length===0&&/접속할 수 없는 주소/.test(toasts(T).join("|")),"B11 경로·쿼리·프래그먼트가 붙은 주소는 접속 전에 거부된다");
  ok(toasts(T).join("|").indexOf(CODE)<0&&T.storage.getItem("netServer")===null,
    "B12 코드가 섞인 URL을 넣어도 저장·안내 어디에도 그 조각이 남지 않는다");
}
{
  // 저장 실패(용량 초과·정책)해도 접속은 계속되어야 한다
  const T=loadAt(FILE_HREF);
  T.storage.setItem=()=>{ throw new Error("QuotaExceededError"); };
  $el(T,"netServer").value="10.2.3.4:5555"; typeCode(T);
  let err=null; try{ T.netConnect(); }catch(e){ err=e; }
  ok(!err&&T.wsLog.length===1&&T.wsLog[0].url==="ws://10.2.3.4:5555","B13 주소 저장이 실패해도 예외 없이 접속 진행");
}
{
  const T=loadAt(FILE_HREF);
  ok(/const url=\(location\.protocol==="https:"\?"wss:\/\/":"ws:\/\/"\)/.test(T.html)&&!/ws:\/\/\$\{/.test(T.html),"B14 ws/wss 선택이 코드 한 곳(netConnect)에서만 결정된다 (정적)");
}

/* ===== H. 목적지 허용 목록 — 코드가 나갈 수 있는 곳을 위협 모델로 못 박는다 =====
   주소만 바꿔치기하면(저장값 오염·오타·유도된 붙여넣기) 코드가 하위 프로토콜 헤더에 실려 남의 서버로 간다.
   그래서 소켓을 만들기 전에 목적지를 판정하고, 허용 밖이면 접속 시도 자체를 하지 않는다. */
{
  const T=loadAt(FILE_HREF);
  const P=T.netParseAddr;
  const allow=[["127.0.0.1","127.0.0.1:8080"],["localhost:8080","localhost:8080"],["192.168.0.7:8080","192.168.0.7:8080"],
    ["10.1.2.3:9000","10.1.2.3:9000"],["172.16.0.1","172.16.0.1:8080"],["172.31.255.254:1","172.31.255.254:1"],
    ["169.254.1.5","169.254.1.5:8080"],["  ws://192.168.5.5:7000  ","192.168.5.5:7000"],
    ["http://192.168.0.7:8080/","192.168.0.7:8080"],["LOCALHOST","localhost:8080"]];
  ok(allow.every(([i,o])=>{const r=P(i); return r.ok&&r.addr===o;}),
    "H1 허용: localhost·루프백·10/8·172.16~31/12·192.168/16·169.254/16 (포트 보정·스킴 제거·후행 슬래시 하나까지)");
  const ipv6=[["[::1]:8080","[::1]:8080"],["::1","[::1]:8080"],["0:0:0:0:0:0:0:1","[0:0:0:0:0:0:0:1]:8080"],
    ["fe80::1","[fe80::1]:8080"],["[fd12:3456::9]:9000","[fd12:3456::9]:9000"]];
  ok(ipv6.every(([i,o])=>{const r=P(i); return r.ok&&r.addr===o;}),
    "H2 IPv6 루프백·링크로컬·유니크로컬은 [주소]:포트 형태로 정규화된다");
  const deny=["1.2.3.4:8080","8.8.8.8","172.32.0.1","172.15.0.1","2001:db8::1","[2001:db8::1]:8080",
    "0.0.0.0","0.0.0.0:8080","::","[::]:8080",
    "evil.com","evil.com:8080","http://evil.com:8080","duel.example.com","my-nas.local:8080","192.168.0.7.evil.com",
    "user:pw@192.168.0.7:8080","192.168.0.7@evil.com","010.1.2.3","999.1.1.1","192.168.0.7:0","192.168.0.7:70000",
    "192.168.0.7:80x","192.168.0.7:","[::1:8080",'evil"onload="x',"","   ","fe80::1%eth0",
    "192.168.0.7:8080/demo/index.html","192.168.0.7:8080/x","192.168.0.7:8080//","192.168.0.7:8080?code=Z",
    "192.168.0.7:8080#h","192.168.0.7:8080/?code=Z","http://192.168.0.7:8080/demo/","/192.168.0.7:8080"];
  const leaked=deny.filter(a=>P(a).ok);
  ok(leaked.length===0,"H3 거부: 공인·비특정 IP(0.0.0.0·::)·도메인 이름·사용자정보·8진수 표기·잘못된 포트·깨진 대괄호·존 인덱스·경로/쿼리/프래그먼트"
    +(leaked.length?" — 통과해버린 값: "+JSON.stringify(leaked):""));
  ok(P("1.2.3.4:8080").ok===false&&typeof P("1.2.3.4:8080").reason==="string"&&P("192.168.0.7").addr==="192.168.0.7:8080",
    "H4 판정 결과는 {ok,addr} / {ok:false,reason} 형태 — 거부를 조용한 빈 값으로 흘리지 않는다");
}
{
  // 실제 접속 경로: 허용 밖 주소면 wsLog 0 · 코드 미전송 · 저장값 미오염
  const cases=["1.2.3.4:8080","evil.com:8080","http://evil.com","user:pw@192.168.0.7:8080","192.168.0.7:70000",
    "[2001:db8::1]:8080","0.0.0.0:8080","192.168.0.7:8080/demo/index.html","192.168.0.7:8080?code=Z","192.168.0.7:8080#h"];
  const bad=[];
  for(const addr of cases){
    const T=loadAt(FILE_HREF);
    $el(T,"netServer").value=addr; typeCode(T,CODE);
    T.netConnect();
    const shown=toasts(T).join("|");
    if(T.wsLog.length!==0||shown.indexOf(CODE)>=0||!/접속할 수 없는 주소/.test(shown)
      ||JSON.stringify(T.storage.st).indexOf(addr)>=0) bad.push(addr);
  }
  ok(bad.length===0,"H5 허용 밖 주소: 소켓 생성 0회 · 코드 미전송 · 안내에 값 미노출 · 저장값 미오염"
    +(bad.length?" — 실패: "+JSON.stringify(bad):""));
}
{
  // 배치 진입(netPrepare)에서도 같은 판정을 한다 — 붙을 수 없는 주소로 14개를 배치하게 두지 않는다
  const T=loadAt(FILE_HREF);
  $el(T,"netServer").value="evil.com:8080"; typeCode(T,CODE);
  T.netPrepare();
  ok(T.NET.preparing===false&&T.S.phase==="menu"&&T.wsLog.length===0&&/접속할 수 없는 주소/.test(toasts(T).join("|")),
    "H6 netPrepare도 허용 밖 주소를 막는다 (배치 전에 중단)");
  ok(T.storage.getItem("netServer")===null,"H7 거부된 주소는 저장하지 않는다");
  $el(T,"netServer").value="192.168.0.7:8080";
  T.netPrepare();
  ok(T.NET.preparing===true&&T.storage.getItem("netServer")==="192.168.0.7:8080","H8 허용 주소면 정상 진입하고 그 값만 저장된다");
}
{
  // 저장된 값이 오염돼 있어도 접속 단계에서 걸린다 (렌더 이스케이프 + 목적지 판정 이중 방어)
  const T=loadAt(FILE_HREF,{netServer:"evil.com:8080"});
  typeCode(T,CODE);
  T.netConnect();
  ok(T.wsLog.length===0&&T.NET.code===null&&$el(T,"netCode").value===CODE,
    "H9 오염된 저장값으로는 접속하지 않는다 — 코드는 캡처조차 되지 않고 입력칸에 남는다");
  const src=T.html;
  ok(/if\(!parsed\.ok\)\{ showToast\(NET_ADDR_HINT\); return; \}/.test(src)&&(src.match(/netParseAddr\(/g)||[]).length>=3,
    "H10 판정은 netParseAddr 한 곳에서 하고, 두 진입점(netPrepare·netConnect)이 모두 그것을 거친다 (정적)");
}

/* ===== C. 접속 코드 — 분리 입력 · 검증 · 하위 프로토콜 계약 ===== */
{
  const T=loadAt(FILE_HREF);
  const menu=$el(T,"sidePanel").innerHTML;
  const codeTag=(menu.match(/<input id="netCode"[^>]*>/)||[""])[0];
  ok(/id="netServer"/.test(menu)&&!!codeTag,"C1 메뉴에 서버 주소 칸과 접속 코드 칸이 따로 있다");
  ok(/type="password"/.test(codeTag)&&/autocomplete="off"/.test(codeTag)&&/maxlength="64"/.test(codeTag),
    "C2 코드 칸은 password 타입 · 자동완성 off · 64자 상한");
  ok(!/value=/.test(codeTag),"C3 코드 칸에는 value 속성이 없다 (렌더가 코드를 HTML로 되돌려 쓰지 않는다)");
  ok(T.NET_PROTOCOL_MARKER===MARKER&&T.NET_CODE_MIN===8&&T.NET_CODE_MAX===64,
    "C4 공개 마커·길이 경계가 서버 계약(digit-duel.v1 · 8~64)과 같다");
}
{
  const T=loadAt(FILE_HREF);
  const V=T.netCodeValid;
  const good=["5F65J3YKGD","abcdefgh","A".repeat(64),"a-b_c.d~e","!#$%&'*+-.^_`|~09Az"];
  ok(good.every(V),"C5 유효 코드: 8~64자 RFC 7230 토큰 문자");
  const bad=["", "short7", "A".repeat(65), "code with space", " 5F65J3YKGD", "5F65J3YKGD ",
    "code,other", "code;x", 'co"de', "code\\x", "코드코드코드코드", "cod\u0000e0000", MARKER, MARKER.toUpperCase(),
    null, undefined, 12345678, ["5F65J3YKGD"]];
  ok(bad.every(c=>!V(c)),"C6 거부: 길이 밖·공백·쉼표/세미콜론/따옴표·역슬래시·비ASCII·제어문자·공개 마커·비문자열");
  ok(!V(MARKER)&&!V("DIGIT-DUEL.V1"),"C7 공개 마커는 대소문자 무관하게 코드로 쓸 수 없다 (비밀이 아닌 값)");
}
{
  const T=connectWith(FILE_HREF,"192.168.0.9:8080",null,CODE);
  const ws=T.wsLog[0]||{};
  ok(Array.isArray(ws.protocols)&&ws.protocols.length===2,"C8 하위 프로토콜 토큰은 정확히 2개 (여러 개면 한 번에 여러 코드 대입이 가능해진다)");
  ok(protos(ws)[0]===MARKER&&protos(ws)[1]===CODE,"C9 순서는 [공개 마커, 접속 코드] — 서버 presentedAccessCode 계약");
  ok(ws.url==="ws://192.168.0.9:8080"&&ws.url.indexOf(CODE)<0,"C10 코드는 URL에 실리지 않는다");
  ok(T.NET.code===CODE,"C11 코드는 메모리(NET.code)에만 보관된다");
  ok($el(T,"netCode").value==="","C12 캡처 후 입력칸은 비워진다 (DOM에 남기지 않음)");
}
{
  // 코드가 없거나 형식이 어긋나면 접속하지 않는다 — 메뉴 진입(netPrepare)에서 먼저 막는다
  const T=loadAt(FILE_HREF);
  T.netPrepare();
  ok(T.NET.preparing===false&&T.S.phase==="menu"&&T.wsLog.length===0,"C13 코드 미입력이면 배치 화면으로 넘어가지 않는다 (접속 시도 0)");
  ok(/접속 코드/.test(toasts(T).join("|")),"C14 코드 형식 안내 토스트를 띄운다");
  typeCode(T,"bad code");
  T.netPrepare();
  ok(T.NET.preparing===false&&T.wsLog.length===0&&$el(T,"netCode").value==="bad code","C15 형식 위반도 차단 (오타 수정용으로 입력칸 값은 유지)");
  typeCode(T,CODE);
  T.netPrepare();
  ok(T.NET.preparing===true&&T.NET.code===CODE&&T.wsLog.length===0,"C16 유효 코드면 배치 준비로 진입 (아직 접속하지는 않는다)");
}
{
  // 메뉴를 떠난 뒤(코드 없음)에는 재입력 모달이 유일한 경로다 — 새로고침 = 배치 손실이므로
  const T=loadAt(FILE_HREF);
  typeCode(T,CODE); T.netPrepare();
  T.NET.code=null; $el(T,"netCode").value=""; // 매칭 전 연결 종료로 코드를 버린 상태 재현
  T.netConnect();
  ok(T.wsLog.length===0&&/접속 코드 입력/.test($el(T,"overlayBox").innerHTML),"C17 코드가 없으면 접속하지 않고 재입력 모달을 연다");
  const retryTag=($el(T,"overlayBox").innerHTML.match(/<input id="netCodeRetry"[^>]*>/)||[""])[0];
  ok(/type="password"/.test(retryTag)&&!/value=/.test(retryTag),"C18 재입력 칸도 password · value 속성 없음");
  $el(T,"netCodeRetry").value="short";
  $el(T,"obBtns").children[0].onclick();
  ok(T.wsLog.length===0&&T.NET.code===null,"C19 재입력이 형식 위반이면 접속하지 않는다");
  $el(T,"netCodeRetry").value=CODE;
  $el(T,"obBtns").children[0].onclick();
  ok(T.wsLog.length===1&&protos(T.wsLog[0])[1]===CODE&&$el(T,"netCodeRetry").value==="","C20 유효 코드를 넣으면 그대로 접속하고 입력칸을 비운다");
  ok($el(T,"overlay")._cls.has("hidden"),"C21 접속과 함께 모달이 닫힌다");
}
{
  // 매칭 전 연결 종료(코드 거부 401 포함)는 들고 있던 코드를 버린다 — 서버 재기동이면 코드 자체가 새로 발급된다
  const T=loadAt(FILE_HREF);
  typeCode(T,CODE); T.netPrepare();
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  ok(T.NET.queued===true&&T.wsLog.length===1&&T.NET.code===CODE,"C22 전제: 배치 완료 → 큐 진입 + 접속 1회");
  T.wsLog[0].onclose();
  ok(T.NET.code===null&&T.NET.queued===false,"C23 매칭 전 연결 종료 → 코드 폐기 (다음 시도는 재입력을 묻는다)");
  ok(T.NET.mySetup!==null,"C24 코드를 버려도 배치는 유지된다");
}
{
  const T=loadAt(FILE_HREF);
  const src=T.html;
  ok(/new WebSocket\(url,\[NET_PROTOCOL_MARKER,NET\.code\]\)/.test(src),"C25 WebSocket 생성은 [마커, 코드] 2토큰 형태 한 곳뿐 (정적)");
  ok((src.match(/new WebSocket\(/g)||[]).length===1,"C26 소켓 생성 지점이 하나뿐이다 (코드 없는 우회 접속 경로 없음)");
}

/* ===== D. 코드 비노출 — 저장소·쿠키·URL·토스트·상태·로그·콘솔·예외 ===== */
{
  const T=loadAt(FILE_HREF);
  const before=JSON.stringify({href:T.location.href,search:T.location.search,hash:T.location.hash});
  typeCode(T,CODE); T.netPrepare();
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  const trace=H.storageTrace(T.storage);
  const hay=[JSON.stringify(trace),JSON.stringify(T.storage.st),JSON.stringify(H.storageTrace(T.sessionStorage)),
    JSON.stringify(T.sessionStorage.st),T.cookieWrites.join("|"),JSON.stringify(T.indexedDB.opens),
    T.location.href,T.location.search,T.location.hash,
    toasts(T).join("|"),$el(T,"netStatus").textContent,logText(T),
    $el(T,"sidePanel").innerHTML,$el(T,"overlayBox").innerHTML,T.wsLog[0].url].join("\u0000");
  ok(hay.indexOf(CODE)<0,"D1 코드는 저장소·세션스토리지·쿠키·indexedDB·URL·토스트·상태 배지·게임 로그·화면·ws URL 어디에도 없다");
  ok(trace.all.every(k=>k==="tutorialSeen"||k==="netServer")&&trace.writes.every(k=>k==="netServer"),
    "D2 저장 흔적은 주소(netServer)뿐 — 코드 키가 새로 생기지 않는다 ["+trace.all.join(",")+"]");
  ok(JSON.stringify({href:T.location.href,search:T.location.search,hash:T.location.hash})===before,
    "D3 접속 과정에서 URL·쿼리·프래그먼트가 바뀌지 않는다");
  ok(T.NET.code===CODE&&protos(T.wsLog[0])[1]===CODE,"D4 코드가 가는 곳은 메모리와 하위 프로토콜 토큰 둘뿐");
}
{
  // 소켓 생성이 실패하면(브라우저가 하위 프로토콜 토큰을 거부하는 등) 그 예외 메시지에는 코드가 들어 있다.
  // 제품 코드는 예외를 삼키고, 안내에 e를 싣지 않아야 한다.
  const T=loadAt(FILE_HREF);
  typeCode(T,CODE);
  T.WebSocketCtor.throwNext=true;
  T.WebSocketCtor.throwMessage="SyntaxError: subprotocol '"+CODE+"' is invalid";
  let thrown=null;
  try{ T.netConnect(); }catch(e){ thrown=e; }
  ok(!thrown&&T.wsLog.length===0&&T.NET.ws===null,"D5 소켓 생성 예외는 밖으로 새지 않고 접속도 성립하지 않는다");
  const shown=toasts(T).join("|");
  ok(/서버 연결 실패/.test(shown),"D6 실패 안내는 뜬다 ("+shown+")");
  ok(shown.indexOf(CODE)<0&&shown.indexOf("subprotocol")<0,"D7 그 안내에 예외 메시지·코드 값이 실리지 않는다");
}
{
  // 정적 검사: 코드를 담는 심볼이 저장·주소·로그 API 근처에 등장하지 않는다
  const src=loadAt(FILE_HREF).html;
  const codeLines=src.split(/\r?\n/).filter(l=>/NET\.code|netCode|netCaptureCode|netCodeValid/.test(l));
  const persistNear=codeLines.filter(l=>/localStorage|sessionStorage|indexedDB|document\.cookie|location\.(href|search|hash|assign|replace)|console\.|addLog\(/.test(l));
  ok(codeLines.length>0&&persistNear.length===0,
    "D8 코드 심볼이 등장하는 줄에 저장·주소·콘솔·게임 로그 API가 하나도 없다"+(persistNear.length?" — "+persistNear[0].trim():""));
  ok(!/setItem\(\s*["'][^"']*[Cc]ode/.test(src),"D9 'code' 이름의 저장 키를 쓰지 않는다");
  ok(/localStorage\.setItem\("netServer"/.test(src)&&(src.match(/localStorage\.setItem\(/g)||[]).length===2,
    "D10 localStorage.setItem 호출은 주소 저장 두 곳(netPrepare·netConnect)뿐");
}

/* ===== E. 저장값 마크업 주입 방어 — 저장된 주소가 곧 스크립트가 되지 않는다 ===== */
{
  const EVIL='"><img src=x onerror=alert(1)>';
  const T=loadAt(FILE_HREF,{netServer:EVIL});
  const menu=$el(T,"sidePanel").innerHTML;
  ok(menu.indexOf(EVIL)<0,"E1 저장된 주소가 원문 그대로 마크업에 들어가지 않는다");
  ok(menu.indexOf("onerror=alert(1)>")<0&&!/<img src=x/.test(menu),"E2 따옴표 탈출로 태그·이벤트 핸들러가 생기지 않는다");
  const tag=(menu.match(/<input id="netServer"[^>]*>/)||[""])[0];
  ok(/value="&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;"/.test(tag),"E3 value 속성은 이스케이프되어 한 개의 속성으로 닫힌다");
  ok((tag.match(/id="netServer"/g)||[]).length===1&&(menu.match(/<input /g)||[]).length===2,
    "E4 입력 태그 수가 늘지 않는다 (주소 칸 + 코드 칸 2개)");
}
{
  const T=loadAt(FILE_HREF);
  ok(T.escAttr('<a href="x">&\'`')==="&lt;a href=&quot;x&quot;&gt;&amp;&#39;&#96;","E5 escAttr: < > \" ' ` & 를 모두 실체 참조로 바꾼다");
  ok(T.escAttr("&amp;")==="&amp;amp;","E6 & 를 먼저 바꿔 이미 이스케이프된 값을 두 번 감싸지 않는다(멱등 아님 — 원문만 넣는다)");
  ok(T.escAttr(null)===""&&T.escAttr(undefined)===""&&T.escAttr(0)==="0","E7 null·undefined는 빈 문자열, 그 밖은 문자열화");
  ok(/value="\$\{escAttr\(netServerDefault\(\)\)\}"/.test(T.html),"E8 주소 value 보간은 escAttr를 거친다 (정적)");
}
{
  // 저장된 악성 주소는 렌더에서 이스케이프되고, 접속 단계에서는 아예 목적지로 인정되지 않는다
  const T=loadAt(FILE_HREF,{netServer:'evil"onload="x'});
  typeCode(T,CODE); T.netConnect();
  ok(T.wsLog.length===0&&/접속할 수 없는 주소/.test(toasts(T).join("|")),"E9 악성 저장값으로는 소켓을 만들지 않는다");
  ok(T.storage.getItem("netServer")==='evil"onload="x',"E10 거부된 주소는 저장값을 덮어쓰지도 않는다 (조용한 정규화 없음)");
}

/* ===== F. 사전 배치 준비 상태 — 배치 완료 후에만 매칭 ===== */
function prepared(){ const T=loadAt(FILE_HREF); typeCode(T,CODE); T.netPrepare(); return T; }
{
  const T=prepared();
  ok(T.NET.preparing===true&&T.NET.queued===false&&T.NET.mySetup===null&&T.NET.ws===null&&T.wsLog.length===0,"F1 netPrepare는 배치 준비만 — 아직 서버에 접속하지 않는다");
  ok(T.S.phase==="setup"&&T.S.mode==="pvp"&&T.S.setupPlayer===0,"F2 배치 화면(pvp setup, 내가 P0)으로 진입");
  ok(/온라인 대전 — 내 로스터 선택/.test($el(T,"sidePanel").innerHTML)&&/배치 완료 → 매칭 시작/.test($el(T,"sidePanel").innerHTML),"F3 배치 화면 안내·버튼 문구가 온라인용");
}
{
  const T=prepared();
  T.netAction({t:"setupDone"}); // 로스터 0종·배치 0개 상태
  ok(T.NET.queued===false&&T.NET.mySetup===null&&T.wsLog.length===0&&/로스터 6종 선택과 14개 배치/.test(toasts(T).join("|")),"F4 배치 미완 상태에서는 매칭 큐에 들어가지 않는다 (접속 시도 0)");
  T.netAction({t:"auto"}); // 로스터 자동 + 14개 배치
  const unplaced=T.S.pieces.filter(x=>x.owner===0&&!x.placed).length;
  ok(T.S.roster[0].length===6&&unplaced===0,"F5 전제: 무작위 배치로 로스터 6종·14개 배치 완료");
  T.netAction({t:"setupDone"});
  ok(T.NET.queued===true&&!!T.NET.mySetup&&T.wsLog.length===1,"F6 배치 완료 후 setupDone → 배치 캡처 + 매칭 큐 진입 + 서버 접속 1회");
  const su=T.NET.mySetup;
  ok(Array.isArray(su.roster)&&su.roster.length===6&&new Set(su.roster).size===6&&su.roster.every(id=>T.ROSTER.some(r=>r.id===id)),"F7 캡처된 로스터: 중복 없는 6종·모두 실제 종");
  ok(Array.isArray(su.pos)&&su.pos.length===14&&su.pos.every(q=>[11,12,13].includes(q[0])&&q[1]>=1&&q[1]<=7)&&new Set(su.pos.map(q=>q.join("_"))).size===14,"F8 캡처된 배치: 14칸·모두 자기 진영(11~13행)·중복 없음");
  ok(/매칭 대기 중/.test($el(T,"sidePanel").innerHTML),"F9 큐 진입 후 화면은 매칭 대기");
  const posBefore=JSON.stringify(su.pos);
  T.netCancelQueue();
  ok(T.NET.queued===false&&T.NET.ws===null&&T.wsLog[0].closed===true&&JSON.stringify(T.NET.mySetup.pos)===posBefore,"F10 매칭 취소: 연결만 끊고 배치는 유지");
  ok(T.S.pieces.filter(x=>x.owner===0&&x.placed).length===14,"F11 매칭 취소 후에도 보드 배치 그대로");
}
{
  const T=prepared();
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  T.netPrepare();
  ok(T.wsLog.length===1&&/이미 온라인 대전이 진행 중/.test(toasts(T).join("|")),"F12 이미 매칭 중이면 netPrepare가 배치를 초기화하지 않는다");
}
{
  // 매칭 → 시작까지 게임 흐름이 그대로인지 (코드 도입이 락스텝 개시를 건드리지 않는다)
  const T=prepared();
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  const ws=T.wsLog[0];
  ws.readyState=1;
  ws.onmessage({data:JSON.stringify({type:"matched",room:1,you:"p2"})});
  ok(T.NET.me===1,"F13 matched 수신 → 내 진영 결정 (P2)");
  const mySetup=T.NET.mySetup;
  ws.onmessage({data:JSON.stringify({t:"hello",seed:12345,setup:mySetup})});
  ok(T.NET.started===true&&T.NET.mode===true&&T.S.phase==="play","F14 hello 수신 → 공유 시드로 대국 시작 (온라인 흐름 보존)");
  ok(ws.sent.some(m=>JSON.parse(m).t==="hello2"),"F15 내 배치를 hello2로 회신한다");
  ok(ws.sent.every(m=>m.indexOf(CODE)<0),"F16 릴레이 메시지 어디에도 코드가 실리지 않는다");
  T.TQ.length=0;
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
  ok(p0.every(x=>x.placed&&[11,12,13].includes(x.r))&&p1.every(x=>x.placed&&[1,2,3].includes(x.r)),"F17 사전 배치 적용: P1은 11~13행, P2는 1~3행으로 미러링");
  ok(p1.every((x,i)=>x.r===14-p0[i].r&&x.c===p0[i].c),"F18 미러링 규칙은 r→14−r (열 동일)");
  T.applyNetSetup(1,{roster:["없는말"],pos:[]}); // 손상 데이터
  const p1b=T.S.pieces.filter(x=>x.owner===1);
  ok(p1b.every(x=>x.placed&&[1,2,3].includes(x.r))&&T.S.roster[1].length===6,"F19 손상된 배치 데이터는 무작위 배치로 대체 (락스텝 유지)");
  T.TQ.length=0;
}

/* ===== G. 하네스 격리 — 나중 load()가 앞선 T의 관측을 흔들지 못한다 (#54 REVISE) =====
   회귀 원인: WebSocket 로그가 모듈 전역 하나였고 load()마다 그것을 비웠으며, location·localStorage·document를
   전역에만 꽂아 제품 코드가 "가장 최근 load"의 것을 봤다. 아래는 그 회귀를 직접 잡는다. */
{
  const T1=connectWith(FILE_HREF,"192.168.1.11:1111");
  const n1=T1.wsLog.length, u1=T1.wsLog[0].url;
  const T2=loadAt("https://duel.example.com/demo/index.html",{netServer:"10.2.2.2:2222"});
  ok(T1.wsLog!==T2.wsLog&&T1.WebSocketCtor!==T2.WebSocketCtor,"G1 load()마다 고유한 WebSocket 생성자·로그를 가진다");
  ok(T1.wsLog.length===n1&&T1.wsLog[0].url===u1,"G2 나중 load()가 앞선 T의 wsLog를 비우지 않는다 ("+u1+")");
  typeCode(T2); T2.netConnect();
  ok(T2.wsLog.length===1&&T1.wsLog.length===n1,"G3 나중 load의 접속은 자기 로그에만 쌓인다 (앞선 T 로그 불변)");
  ok(T1.location.protocol==="file:"&&T1.netServerDefault()==="192.168.1.11:1111","G4 앞선 T의 location·저장소는 나중 load의 https/다른 주소에 끌려가지 않는다");
  ok(T2.netServerDefault()==="10.2.2.2:2222"&&T2.wsLog[0].url==="wss://10.2.2.2:2222","G5 나중 T는 자기 페이지 프로토콜(https→wss)과 자기 저장값을 쓴다");
  ok(T1.NET.code===CODE&&T2.NET.code===CODE&&T1.NET!==T2.NET,"G6 코드도 로드별 메모리에 따로 산다");
  T1.render();
  ok($el(T1,"sidePanel").innerHTML.indexOf("192.168.1.11:1111")>=0,"G7 앞선 T의 render()는 자기 문서에 그린다 (나중 load의 document로 새지 않음)");
}
{
  /* #54 REVISE(Saturn_3): 포커스 추적도 로드별로 갈린다.
     회귀: mkEl().focus()가 전역 document.activeElement에 썼기 때문에, T2가 로드된 뒤 T1을 조작하면
     T1의 포커스가 T2의 문서에 기록되고 T1.document.activeElement는 그대로였다. */
  const T1=loadAt(FILE_HREF), T2=loadAt(FILE_HREF);
  const t1Body=T1.document.body, t2Before=T2.document.activeElement;
  ok(T1.document!==T2.document&&T1.document.activeElement===t1Body,"G11 전제: 두 로드의 문서는 서로 다르고 T1 포커스는 자기 body");
  T1.tutOpen(); // 튜토리얼이 열리면 '다음' 버튼에 포커스가 간다 (T1에서만 조작)
  const f1=T1.document.activeElement;
  ok(f1!==t1Body&&f1===T1.TUT.btns[1]&&/다음/.test(f1.textContent),"G12 T1 튜토리얼 조작은 T1 문서의 activeElement를 바꾼다 ("+f1.textContent+")");
  ok(T2.document.activeElement===t2Before&&T2.document.activeElement===T2.document.body,"G13 같은 조작이 나중 로드 T2의 문서 포커스는 건드리지 않는다");
  ok(f1.ownerDocument===T1.document&&T2.document.body.ownerDocument===T2.document,"G14 요소는 자기를 만든 문서를 소유 문서로 들고 있다");
  T1.tutSkip(); T1.TQ.length=0; T2.TQ.length=0;
}
{
  // storage 옵션을 생략한 load는 "앞선 load가 남긴 저장소"를 물려받지 않는다 (결정적 기본값 = 빈 저장소)
  H.resetStorage();
  const A=H.load(htmlPath,{href:FILE_HREF,storage:H.mkStorage({netServer:"192.168.9.9:9999"})});
  ok(A.netServerDefault()==="192.168.9.9:9999","G8 전제: 명시한 저장소의 주소를 쓴다");
  const B=H.load(htmlPath,{href:FILE_HREF});
  ok(B.netServerDefault()===B.NET_LOCAL_DEFAULT&&B.storage!==A.storage&&H.storageTrace(B.storage).all.length===0,
    "G9 storage 옵션 생략 = 빈 저장소 (앞선 load의 저장소를 우연히 물려받지 않는다)");
  const pre=H.setStorage(H.mkStorage({netServer:"192.168.8.8:8888"})); // 명시적 사전 설치 계약
  const C=H.load(htmlPath,{href:FILE_HREF});
  ok(C.storage===pre&&C.netServerDefault()==="192.168.8.8:8888","G10 setStorage()로 명시 설치한 저장소만 옵션 없는 load가 물려받는다");
  H.resetStorage();
  const E=H.load(htmlPath,{href:FILE_HREF});
  ok(E.storage!==pre&&E.netServerDefault()===E.NET_LOCAL_DEFAULT,"G15 resetStorage() 후에는 다시 빈 저장소가 기본");
}

/* ===== I. 하위 프로토콜 협상 게이트 (#66) — 계약 밖 값이면 실패로 닫는다 =====
   서버 계약(server/security.js selectProtocol)상 되돌아오는 하위 프로토콜은 공개 마커 하나뿐이다.
   그런데 우리가 제시한 토큰은 [마커, 접속 코드] 둘이므로, 서버가 계약을 어기거나 중간에 누가 끼어들면
   **우리가 건네준 비밀 코드 자신**이 선택돼 돌아올 수 있다. 그때 접속을 그대로 이어가면
   ① 코드를 골라 되돌려준 상대와 매치를 시작하고 ② 그 값이 ws.protocol·중계 프록시 로그에 남는다.
   그래서 마커와 정확히 같지 않은 모든 선택값(비밀 코드·빈 값·임의 문자열)은 즉시 끊고,
   값 없는 고정 안내 하나만 띄우며, 뒤따르는 콜백이 그 안내를 덮거나 프레임을 처리하지 못하게 한다. */
/* 큐 진입까지 간 상태 — 배치 완료 → 매칭 시작 → 소켓 1개 생성 (실사용과 같은 경로) */
function queuedT(p){
  const T=loadFrom(p||htmlPath,FILE_HREF);
  typeCode(T,CODE); T.netPrepare();
  T.netAction({t:"auto"}); T.netAction({t:"setupDone"});
  return T;
}
/* 서버가 sel 을 골라 핸드셰이크가 열린 상황 재현 */
function openWs(ws,sel){ ws.readyState=1; ws.protocol=sel; ws.onopen(); return ws; }
function handshake(T,sel){ return openWs(T.wsLog[0],sel); }
/* 코드가 샐 수 있는 표면 전부 — 상태 배지·토스트·게임 로그·화면·URL·저장소 */
function surfaces(T){
  return [toasts(T).join("|"),$el(T,"netStatus").textContent,logText(T),
    $el(T,"sidePanel").innerHTML,$el(T,"overlayBox").innerHTML,
    T.wsLog.map(w=>w.url).join("|"),T.location.href,T.location.search,T.location.hash,
    JSON.stringify(H.storageTrace(T.storage)),JSON.stringify(T.storage.st),
    JSON.stringify(H.storageTrace(T.sessionStorage)),T.cookieWrites.join("|")].join("\u0000");
}
{
  // 공격 경로: 서버가 우리가 제시한 '접속 코드' 토큰을 골라 되돌려준다
  const T=queuedT();
  const ws=T.wsLog[0];
  ok(T.NET.queued===true&&protos(ws)[0]===MARKER&&protos(ws)[1]===CODE,
    "I1 전제: 큐 진입 + 코드가 하위 프로토콜 토큰으로 제시돼 있다 (서버가 고를 수 있다)");
  handshake(T,CODE);
  ok(ws.readyState===3&&ws.closed===true,"I2 마커가 아닌 값이 선택되면 즉시 소켓을 닫는다");
  ok(T.NET.ws===null,"I3 닫은 소켓을 연결로 들고 있지 않는다 (송신 경로가 열려 있지 않다)");
  ok(T.NET.started===false&&T.NET.mode===false&&T.S.phase!=="play","I4 매치를 시작하지 않는다");
  ok(T.NET.code===null,"I5 매칭 전 실패 경계 — 들고 있던 코드를 버린다 (다음 시도는 재입력을 묻는다)");
  const trace=H.storageTrace(T.storage);
  ok(trace.all.every(k=>k==="tutorialSeen"||k==="netServer")&&trace.writes.every(k=>k==="netServer"),
    "I6 코드를 버리는 과정에서 어떤 저장소에도 코드를 쓰지 않는다 ["+trace.all.join(",")+"]");
  const hay=surfaces(T);
  ok(hay.indexOf(CODE)<0,"I7 되돌아온 비밀값(=접속 코드)이 상태 배지·토스트·게임 로그·화면·ws URL·저장소 어디에도 없다");
  const shown=toasts(T).join("|");
  ok(/하위 프로토콜 협상/.test(shown),"I8 협상 실패는 값 없는 고정 안내 한 줄로만 알린다 ("+shown+")");
  ok(T.NET.mySetup!==null&&T.S.pieces.filter(x=>x.owner===0&&x.placed).length===14,"I9 코드를 버려도 배치는 유지된다");
}
{
  // 협상 실패 뒤에 오는 콜백은 고정 안내를 덮지도, 프레임을 처리하지도 못한다
  const T=queuedT();
  const ws=T.wsLog[0];
  handshake(T,CODE);
  const noticeBefore=toasts(T).join("|"), statusBefore=$el(T,"netStatus").textContent;
  ws.onerror(); ws.onclose();
  ok(toasts(T).join("|")===noticeBefore&&$el(T,"netStatus").textContent===statusBefore,
    "I10 뒤따르는 error·close 가 고정 안내를 덮거나 다른 안내를 덧붙이지 않는다");
  ws.onmessage({data:JSON.stringify({type:"matched",room:CODE,you:"p1"})});
  ws.onmessage({data:JSON.stringify({t:"hello",seed:12345,setup:T.NET.mySetup})});
  ok(T.NET.started===false&&T.NET.mode===false&&T.S.phase!=="play","I11 협상 실패 뒤 도착한 matched·hello 로는 매치가 시작되지 않는다");
  ok(ws.sent.length===0,"I12 협상 실패한 소켓으로는 아무것도 보내지 않는다 (배치·시드 회신 없음)");
  ok(surfaces(T).indexOf(CODE)<0&&toasts(T).join("|")===noticeBefore,"I13 그 프레임에 코드가 실려 와도 읽거나 기록하지 않는다");
}
{
  // 마커와 정확히 같지 않은 모든 값 — 비밀 코드·빈 값·대소문자 차이·꼬리 공백·임의 문자열
  const bad=[], notices=new Set();
  for(const sel of [CODE,"",MARKER.toUpperCase(),MARKER+" "," "+MARKER,"x-other",MARKER+".v2",CODE.toLowerCase()]){
    const T=queuedT();
    const ws=handshake(T,sel);
    const shown=toasts(T).join("|");
    notices.add(shown);
    if(ws.readyState!==3||T.NET.ws!==null||T.NET.started!==false||T.NET.code!==null
      ||!/하위 프로토콜 협상/.test(shown)||(sel&&shown.indexOf(sel)>=0)||surfaces(T).indexOf(CODE)>=0) bad.push(JSON.stringify(sel));
  }
  ok(bad.length===0,"I14 마커와 정확히 같지 않은 선택값은 모두 끊고, 그 값을 안내에 넣지 않는다"+(bad.length?" — 실패: "+bad.join(","):""));
  ok(notices.size===1,"I15 어떤 값이 선택됐든 안내는 같은 고정 문구 하나다 (사유가 값을 구분해 새지 않는다) — "+notices.size+"종");
}
{
  // 정상 경로 회귀: 공개 마커가 정확히 선택되면 기존 흐름이 그대로다
  const T=queuedT();
  const ws=handshake(T,MARKER);
  ok(ws.readyState===1&&ws.closed===false&&T.NET.ws===ws,"I16 마커가 선택되면 소켓을 유지한다");
  ok(T.NET.queued===true&&T.NET.code===CODE,"I17 정상 협상에서는 큐·코드를 그대로 둔다");
  ok(/매칭 요청/.test($el(T,"netStatus").textContent),"I18 정상 협상이면 매칭 요청 상태로 넘어간다");
  ok($el(T,"netStatus").textContent.indexOf(MARKER)<0&&toasts(T).join("|").indexOf(MARKER)<0,
    "I19 정상 경로에서도 협상 값을 화면에 되풀이하지 않는다");
  ws.onmessage({data:JSON.stringify({type:"matched",room:1,you:"p2"})});
  ws.onmessage({data:JSON.stringify({t:"hello",seed:12345,setup:T.NET.mySetup})});
  ok(T.NET.me===1&&T.NET.started===true&&T.NET.mode===true&&T.S.phase==="play","I20 마커 경로에서는 matched→hello 로 대국이 시작된다 (기존 흐름 보존)");
  ok(ws.sent.some(m=>JSON.parse(m).t==="hello2")&&ws.sent.every(m=>m.indexOf(CODE)<0),"I21 정상 협상 뒤 릴레이 송신도 그대로 (코드는 실리지 않는다)");
  T.TQ.length=0;
}
{
  // 정적: 협상 값은 마커와의 정확 비교에만 쓰이고, 어떤 출력 경로에도 끼워 넣지 않는다
  const src=loadAt(FILE_HREF).html;
  ok(/\.protocol!==NET_PROTOCOL_MARKER/.test(src.replace(/\s+/g,"")),"I22 협상 값은 공개 마커와의 정확 비교(!==)에만 쓴다 (정적)");
  ok(!/\$\{[^}]*(?:sock|ws)\.protocol[^}]*\}/.test(src),"I23 템플릿 문자열에 소켓 하위 프로토콜 값을 끼워 넣지 않는다 (정적)");
  ok(!/(?:showToast|addLog|textContent\s*=)[^\n]*\b(?:sock|ws)\.protocol/.test(src),
    "I24 토스트·게임 로그·상태 배지 어느 인자에도 소켓 protocol 값이 들어가지 않는다 (정적)");
  const failLines=src.split(/\r?\n/).filter(l=>/NET_PROTO_FAIL/.test(l));
  ok(failLines.length>0&&!failLines.some(l=>/localStorage|sessionStorage|indexedDB|document\.cookie|location\.(href|search|hash|assign|replace)|console\.|addLog\(/.test(l)),
    "I25 고정 안내가 등장하는 줄에 저장·주소·콘솔·게임 로그 API가 하나도 없다 (정적)");
}

/* ===== J. 버려진 소켓(stale socket) 경합 (#67 REVISE) =====
   시나리오: 옛 소켓이 닫혔거나(서버가 끊음) 취소된 뒤 새 소켓이 자리를 잡았는데, 그 옛 소켓의 콜백이
   뒤늦게 도착한다 — 브라우저는 close() 뒤에도 이미 큐에 들어간 open·message·error·close를 마저 전달한다.
   옛 소켓은 그때 새 연결의 무엇도 건드리면 안 된다: 전역 NET.ws를 타고 새 소켓으로 보내지 말 것,
   새 소켓을 지우거나 닫지 말 것, 새 연결의 상태 배지·토스트를 덮지 말 것,
   matched·hello·turn 프레임을 처리하지 말 것, 큐·코드·매치 상태를 바꾸지 말 것. */
/* 새 연결에서 관측 가능한 전부 — 하나라도 달라지면 옛 소켓이 새 연결을 흔든 것이다 */
function netSnap(T,fresh){
  return JSON.stringify({live:T.NET.ws===fresh,closed:fresh.closed,sent:fresh.sent.slice(),
    mode:T.NET.mode,started:T.NET.started,queued:T.NET.queued,code:T.NET.code,me:T.NET.me,
    queue:T.NET.queue.length,phase:T.S&&T.S.phase,
    status:$el(T,"netStatus").textContent,toasts:toasts(T).join("|"),log:logText(T),
    side:$el(T,"sidePanel").innerHTML.length,overlay:$el(T,"overlayBox").innerHTML.length});
}
/* 옛 소켓을 버리고 새 소켓을 세운 뒤, 옛 소켓의 뒤늦은 콜백을 전부 흘려보낸다.
   drop: "cancel"(사용자가 매칭 취소) | "close"(서버가 먼저 끊음) · oldProto: 옛 소켓이 들고 있던 협상 값 */
function staleRace(p,drop,oldProto){
  const T=queuedT(p);
  const oldWs=T.wsLog[0];
  oldWs.protocol=oldProto;
  if(drop==="cancel") T.netCancelQueue();                      // 취소 → 이 소켓은 버려진다
  else { openWs(oldWs,MARKER); oldWs.onclose(); typeCode(T,CODE); } // 서버가 끊음 → 코드 재입력 후 재시도
  T.netAction({t:"setupDone"});                                 // 다시 매칭 시작 → 새 소켓
  const freshWs=T.wsLog[1];
  openWs(freshWs,MARKER);                                       // 새 소켓은 정상 협상까지 마쳤다
  freshWs.onmessage({data:JSON.stringify({type:"waiting"})});    // 새 연결만의 뚜렷한 상태
  T.TQ.length=0;
  const before=netSnap(T,freshWs);
  oldWs.onmessage({data:JSON.stringify({type:"matched",room:1,you:"p1"})});
  oldWs.onmessage({data:JSON.stringify({t:"hello",seed:777,setup:T.NET.mySetup})});
  oldWs.onmessage({data:JSON.stringify({t:"a",a:{t:"endTurn"}})});
  oldWs.onerror();
  oldWs.onclose();
  oldWs.onopen();                                               // 뒤늦은 open (협상 판정까지 다시 도는 경로)
  const after=netSnap(T,freshWs);
  T.TQ.length=0;
  return {T:T,oldWs:oldWs,freshWs:freshWs,before:before,after:after};
}
/* 대조군에서 재사용하는 실패 목록 — 비어 있어야 통과 */
function staleBad(r){
  const bad=[];
  if(r.T.NET.ws!==r.freshWs) bad.push("새 소켓 연결이 지워짐");
  if(r.freshWs.sent.length!==0) bad.push("새 소켓으로 송신");
  if(r.freshWs.closed) bad.push("새 소켓이 닫힘");
  if(r.after!==r.before) bad.push("새 연결 상태·화면 변경");
  return bad;
}
{
  const r=staleRace(htmlPath,"cancel",MARKER);
  ok(r.T.wsLog.length===2&&r.oldWs!==r.freshWs&&r.T.NET.ws===r.freshWs,
    "J1 전제: 취소된 옛 소켓과 새 소켓이 따로 있고, 지금 연결은 새 소켓이다");
  ok(r.T.NET.ws===r.freshWs,"J2 옛 소켓의 close 가 새 소켓 연결(NET.ws)을 지우지 않는다");
  ok(r.freshWs.sent.length===0,"J3 옛 소켓이 받은 matched·hello 로 새 소켓에 아무것도 보내지 않는다");
  ok(r.freshWs.closed===false,"J4 옛 소켓의 콜백이 새 소켓을 닫지 않는다");
  ok(r.after===r.before,"J5 새 연결의 상태 배지·토스트·로그·큐·코드·매치 상태가 그대로다");
  ok(r.T.NET.started===false&&r.T.NET.mode===false&&r.T.S.phase!=="play","J6 옛 소켓의 hello 로는 대국이 시작되지 않는다");
  ok(r.T.NET.queue.length===0,"J7 옛 소켓의 액션 프레임은 재생 큐에 들어가지 않는다");
  ok(r.oldWs.closed===true,"J8 버려진 소켓은 자기만 닫는다");
}
{
  const r=staleRace(htmlPath,"cancel",CODE); // 옛 소켓은 협상까지 어긋나 있었다 — 그 실패 처리도 새 연결을 건드리면 안 된다
  ok(staleBad(r).length===0,"J9 협상이 어긋난 옛 소켓의 뒤늦은 open 도 새 연결의 코드·큐·안내를 덮지 않는다 ["+staleBad(r).join(",")+"]");
  ok(r.T.NET.code===CODE&&r.T.NET.queued===true,"J10 새 연결의 접속 코드·큐 상태가 옛 소켓의 실패로 버려지지 않는다");
  ok(surfaces(r.T).indexOf(CODE)<0,"J11 그 과정에서 코드가 화면·저장소 어디에도 새지 않는다");
}
{
  const r=staleRace(htmlPath,"close",MARKER); // 서버가 먼저 끊고 재접속한 경우
  ok(staleBad(r).length===0,"J12 서버가 끊은 뒤 재접속한 경우에도 옛 소켓의 뒤늦은 콜백은 새 연결을 흔들지 못한다 ["+staleBad(r).join(",")+"]");
}
{
  /* 음성 대조군(mutation control) — 이 회귀 검사가 실제로 무언가를 잡는지 스스로 증명한다.
     소켓 동일성 확인 live()를 항상 참으로 바꾼 사본 = 이 수정 이전(ed7fe345)의 동작이다.
     그 사본에서는 위 J 검사가 반드시 실패해야 한다 — 실패하지 않으면 검사가 비어 있는 것이다. */
  const fs=require("fs"), os=require("os"), path=require("path");
  const GUARD="const live=()=>NET.ws===sock;";
  const src=fs.readFileSync(htmlPath,"utf8");
  ok(src.indexOf(GUARD)>=0,"J13 전제: 소켓 동일성 확인(live)이 제품 소스에 있다");
  const mutantPath=path.join(os.tmpdir(),"digitduel_stale_mutant_"+process.pid+".html");
  fs.writeFileSync(mutantPath,src.replace(GUARD,"const live=()=>true;"));
  const caught=[];
  for(const c of [["cancel",MARKER],["cancel",CODE],["close",MARKER]]){
    let bad;
    try{ bad=staleBad(staleRace(mutantPath,c[0],c[1])); }catch(e){ bad=["예외: "+e.message]; }
    caught.push(c[0]+"/"+(c[1]===CODE?"비마커":"마커")+"→"+(bad.length?bad.join("+"):"잡지 못함"));
  }
  try{ fs.unlinkSync(mutantPath); }catch(e){}
  ok(caught.every(x=>x.indexOf("잡지 못함")<0),
    "J14 음성 대조군: 동일성 확인을 없앤 사본(=수정 전 동작)에서는 세 시나리오가 모두 실패로 잡힌다 ["+caught.join(" | ")+"]");
}

console.log(`\n=== smoke_online: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
