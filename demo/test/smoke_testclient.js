/* #63 릴레이 점검용 클라이언트(server/test-client.html) 접속 경로 회귀 —
   node demo/test/smoke_testclient.js [server/test-client.html]
   범위: 목적지 허용 목록(공인·도메인·사용자정보·경로/쿼리/프래그먼트·잘못된 포트는 소켓 생성 0건) ·
   접속 코드 분리 입력과 8~64자 토큰 검증 · 하위 프로토콜 [마커, 코드] 제시 · 코드 비노출(상태·로그·URL) ·
   릴레이 봉투 계약(예약 키 type 금지).
   demo/index.html 과 같은 방어 경계를 이 파일에도 적용했는지 확인하는 것이 목적이다 —
   여기 규칙이 느슨하면 같은 접속 코드가 남의 WebSocket 으로 나간다. */
"use strict";
const fs=require("fs"), path=require("path");
const htmlPath=process.argv[2]||path.join(__dirname,"..","..","server","test-client.html");
let pass=0,fail=0; const fails=[];
function ok(cond,name){ if(cond) pass++; else { fail++; fails.push(name); console.error("FAIL: "+name); } }

const CODE="5F65J3YKGD";
const MARKER="digit-duel.v1";
const html=fs.readFileSync(htmlPath,"utf8");
const script=(html.match(/<script>([\s\S]*)<\/script>/)||[])[1];
if(!script) throw new Error("script block not found: "+htmlPath);

/* 최소 DOM 스텁 — 요소는 id로 접근한 순간 생긴다 (실제 문서 구조가 아니라 스크립트의 행동만 본다) */
function load(href){
  const els={};
  const mkEl=()=>({value:"",textContent:"",hidden:true,onclick:null,scrollTop:0,scrollHeight:0,
    nodes:[],appendChild(n){this.nodes.push(n);},addEventListener(t,fn){(this.on=this.on||{})[t]=fn;}});
  const doc={getElementById:id=>els[id]||(els[id]=mkEl()),
    createTextNode:t=>({text:String(t)}),createElement:()=>mkEl()};
  const wsLog=[];
  const env={document:doc,location:{protocol:href.protocol,host:href.host},
    WebSocket:function(url,protocols){ this.url=String(url); this.readyState=0;
      this.protocols=protocols===undefined?undefined:(Array.isArray(protocols)?protocols.map(String):[String(protocols)]);
      this.protocol=""; this.sent=[]; this.send=m=>this.sent.push(m); this.close=()=>{this.readyState=3;};
      wsLog.push(this); }};
  const code=`const {document,location,WebSocket}=__ENV;`+script+`
;__OUT.parseAddr=typeof parseAddr==="function"?parseAddr:null;`;
  const __ENV=env, __OUT={};
  eval(code);
  return {els,doc,wsLog,parseAddr:__OUT.parseAddr,
    status:()=>doc.getElementById("status").textContent,
    logText:()=>doc.getElementById("log").nodes.map(n=>n.text||"").join("|"),
    connect(addr,c){ if(addr!==undefined) doc.getElementById("addr").value=addr;
      if(c!==undefined) doc.getElementById("code").value=c;
      doc.getElementById("connect").onclick(); return this; }};
}
const HTTP={protocol:"http:",host:"192.168.0.7:8080"};
const FILE={protocol:"file:",host:""};

/* ===== A. 기본 주소 · 하드코딩 부재 ===== */
{
  ok(!/192\.168\.3\.19/.test(html),"A1 특정 개발 PC의 내부망 IP가 소스에 없다");
  ok(!/new WebSocket\('ws:\/\/localhost:8080'\)/.test(html),"A2 고정 주소로 바로 접속하는 코드가 없다");
  const T=load(HTTP);
  ok(T.doc.getElementById("addr").value==="192.168.0.7:8080","A3 http로 서빙되면 현재 host가 기본 주소");
  const F=load(FILE);
  ok(F.doc.getElementById("addr").value==="127.0.0.1:8080","A4 file://로 열면 이 PC 기본값");
  ok(F.doc.getElementById("fileWarn").hidden===false&&T.doc.getElementById("fileWarn").hidden===true,
    "A5 file://일 때만 Origin 거부 경고를 보여준다");
}

/* ===== B. 목적지 허용 목록 — 허용 밖이면 소켓 0건 ===== */
{
  const T=load(HTTP);
  const P=T.parseAddr;
  ok(typeof P==="function","B1 주소 판정 함수(parseAddr)가 존재한다");
  const allow=[["127.0.0.1","127.0.0.1:8080"],["localhost:8080","localhost:8080"],
    ["192.168.0.7:8080","192.168.0.7:8080"],["10.1.2.3:9000","10.1.2.3:9000"],["172.16.0.1","172.16.0.1:8080"],
    ["169.254.1.5","169.254.1.5:8080"],["http://192.168.5.5:7000/","192.168.5.5:7000"],
    ["[::1]:8080","[::1]:8080"],["::1","[::1]:8080"],["fe80::1","[fe80::1]:8080"]];
  ok(allow.every(([i,o])=>P(i)===o),"B2 허용: localhost·루프백·사설·링크로컬 리터럴 (IPv6는 [주소]:포트로 정규화)");
  const deny=["1.2.3.4:8080","8.8.8.8","172.32.0.1","2001:db8::1","[2001:db8::1]:8080","0.0.0.0","0.0.0.0:8080","::","[::]:8080",
    "evil.com","evil.com:8080","http://evil.com:8080","my-nas.local:8080","user:pw@192.168.0.7:8080",
    "010.1.2.3","999.1.1.1","192.168.0.7:0","192.168.0.7:70000","192.168.0.7:80x","192.168.0.7:","[::1:8080",
    "192.168.0.7:8080/demo/index.html","192.168.0.7:8080?code=Z","192.168.0.7:8080#h","fe80::1%eth0",""];
  const leaked=deny.filter(a=>P(a));
  ok(leaked.length===0,"B3 거부: 공인·비특정 IP·도메인·사용자정보·잘못된 포트·경로/쿼리/프래그먼트"
    +(leaked.length?" — 통과해버린 값: "+JSON.stringify(leaked):""));
}
{
  // 실제 접속 시도: 허용 밖 주소는 소켓을 만들지 않고, 안내에 주소·코드 원문을 되풀이하지 않는다
  const bad=[];
  for(const addr of ["evil.com:8080","1.2.3.4:8080","http://evil.com","user:pw@192.168.0.7:8080",
    "0.0.0.0:8080","192.168.0.7:70000","192.168.0.7:8080/demo/index.html","192.168.0.7:8080?code="+CODE]){
    const T=load(HTTP).connect(addr,CODE);
    const st=T.status();
    if(T.wsLog.length!==0||st.indexOf(CODE)>=0||st.indexOf(addr)>=0||!/접속할 수 없는 주소/.test(st)) bad.push(addr);
  }
  ok(bad.length===0,"B4 허용 밖 주소: WebSocket 생성 0건 · 안내에 주소·코드 원문 미노출"
    +(bad.length?" — 실패: "+JSON.stringify(bad):""));
  const T=load(HTTP).connect("evil.com:8080",CODE);
  ok(T.doc.getElementById("code").value===CODE,"B5 거부된 시도에서는 코드를 소비하지도 않는다 (입력칸 유지)");
}

/* ===== C. 접속 코드 — 분리 입력 · 검증 · 하위 프로토콜 · 비노출 ===== */
{
  const codeTag=(html.match(/<input id="code"[^>]*>/)||[""])[0];
  ok(/id="addr"/.test(html)&&!!codeTag,"C1 주소 칸과 코드 칸이 따로 있다");
  ok(/type="password"/.test(codeTag)&&/autocomplete="off"/.test(codeTag)&&/maxlength="64"/.test(codeTag),
    "C2 코드 칸은 password · 자동완성 off · 64자 상한");
  ok(!/value=/.test(codeTag),"C3 코드 칸에 value 속성이 없다");
}
{
  const badCodes=["","short7","A".repeat(65),"code with space","code,other",MARKER,MARKER.toUpperCase()];
  const leaked=[];
  for(const c of badCodes){
    const T=load(HTTP).connect("192.168.0.7:8080",c);
    if(T.wsLog.length!==0||!/접속 코드를 확인/.test(T.status())) leaked.push(c);
  }
  ok(leaked.length===0,"C4 형식 위반 코드로는 접속하지 않는다 (길이·공백·쉼표·공개 마커)"
    +(leaked.length?" — 통과: "+JSON.stringify(leaked):""));
}
{
  const T=load(HTTP).connect("192.168.0.7:8080","  "+CODE+"  "); // 붙여넣기 공백은 다듬는다
  ok(T.wsLog.length===1,"C5 유효 코드 + 허용 주소면 소켓 1개");
  const ws=T.wsLog[0];
  ok(ws.url==="ws://192.168.0.7:8080"&&ws.url.indexOf(CODE)<0,"C6 코드는 URL에 실리지 않는다");
  ok(Array.isArray(ws.protocols)&&ws.protocols.length===2&&ws.protocols[0]===MARKER&&ws.protocols[1]===CODE,
    "C7 하위 프로토콜은 [공개 마커, 코드] 정확히 2개");
  ok(T.doc.getElementById("code").value==="","C8 캡처 후 입력칸을 비운다");
  ok(T.status().indexOf(CODE)<0&&T.logText().indexOf(CODE)<0,"C9 상태 줄·로그에 코드가 남지 않는다");
  ws.readyState=1;
  T.doc.getElementById("msg").value="hello";
  T.doc.getElementById("send").onclick();
  const sent=ws.sent.map(m=>JSON.parse(m));
  ok(sent.length===1&&sent[0].t==="chat"&&!("type" in sent[0]),
    "C10 릴레이 봉투는 문자열 t를 쓰고 예약 키 type을 쓰지 않는다 (서버가 위반으로 세는 형태 회피)");
  ok(JSON.stringify(sent).indexOf(CODE)<0,"C11 릴레이 메시지에도 코드가 실리지 않는다");
}
{
  const T=load(HTTP);
  ok(/new WebSocket\(url, \[PROTOCOL_MARKER, code\]\)/.test(html)&&(html.match(/new WebSocket\(/g)||[]).length===1,
    "C12 소켓 생성 지점은 [마커, 코드] 형태 한 곳뿐 (정적)");
  ok(!/localStorage|sessionStorage|document\.cookie|location\.(href|search|hash)\s*=/.test(script),
    "C13 코드를 저장하거나 주소에 실을 수 있는 API를 아예 쓰지 않는다");
  ok(T.wsLog.length===0,"C14 로드만으로는 접속하지 않는다 ([접속]을 눌러야 한다)");
}

/* ===== D. 하위 프로토콜 협상 결과 — 되돌아온 값은 화면에 싣지 않는다 =====
   서버 계약(server/security.js selectProtocol)상 되돌아오는 하위 프로토콜은 공개 마커 하나뿐이다.
   클라이언트가 제시한 토큰은 [마커, 접속 코드] 둘이므로, 마커가 아닌 값이 선택돼 돌아왔다면
   그 값이 접속 코드 자신일 수 있다. 여기서 값을 그대로 출력하면 서버(또는 중간자)가
   고른 문자열 하나로 코드가 화면·로그에 그대로 찍힌다 — 그래서 값을 되풀이하지 않고 끊는다. */
{
  // 정상 경로: 서버가 공개 마커를 골라 돌려준다
  const T=load(HTTP).connect("192.168.0.7:8080",CODE);
  const ws=T.wsLog[0];
  ws.readyState=1; ws.protocol=MARKER;
  ws.onopen();
  ok(ws.readyState===1,"D1 마커가 선택되면 소켓을 유지한다");
  ok(/서버 연결됨/.test(T.status()),"D2 정상 협상이면 접속 안내를 보여준다");
  ok(T.status().indexOf(MARKER)<0,"D3 정상 경로에서도 협상 값을 화면에 되풀이하지 않는다");
  T.doc.getElementById("msg").value="hi";
  T.doc.getElementById("send").onclick();
  ok(ws.sent.length===1,"D4 정상 협상 뒤에는 릴레이 송신이 된다 (기존 경로 회귀)");
}
{
  // 공격 경로: 서버가 우리가 제시한 '접속 코드' 토큰을 골라 되돌려준다
  const T=load(HTTP).connect("192.168.0.7:8080",CODE);
  const ws=T.wsLog[0];
  ok(ws.protocols[1]===CODE,"D5 전제: 코드가 하위 프로토콜 토큰으로 제시돼 있다 (서버가 고를 수 있다)");
  ws.readyState=1; ws.protocol=CODE; // 서버가 비밀 토큰을 선택해 돌려준 상황
  ws.onopen();
  ok(ws.readyState===3,"D6 마커가 아닌 값이 선택되면 즉시 소켓을 닫는다");
  const st=T.status();
  ok(st.indexOf(CODE)<0,"D7 상태 줄에 되돌아온 비밀값(=접속 코드)이 없다"+(st.indexOf(CODE)<0?"":" — 노출: "+st));
  ok(T.logText().indexOf(CODE)<0,"D8 로그에도 비밀값이 남지 않는다");
  ok(ws.url.indexOf(CODE)<0,"D9 URL에도 비밀값이 없다");
  ok(/프로토콜 협상/.test(st),"D10 협상 실패는 값 없는 고정 안내 한 줄로만 알린다");
  // 연결된 것으로 취급하지 않는다 — 닫힌 소켓으로는 송신 경로가 열리지 않는다
  T.doc.getElementById("msg").value="hi";
  T.doc.getElementById("send").onclick();
  ok(ws.sent.length===0&&/먼저 접속하세요/.test(T.status()),"D11 협상 실패한 소켓은 접속으로 취급하지 않는다");
  // 뒤이어 오는 close/error/message 가 안내를 덮거나 값을 흘리지 않는다
  T.doc.getElementById("status").textContent=st;
  ws.onclose(); ws.onerror();
  ok(T.status()===st,"D12 뒤따르는 close·error 가 협상 실패 안내를 덮지 않는다");
  ws.onmessage({data:JSON.stringify({type:"matched",room:CODE,you:"p1"})});
  ok(T.status()===st&&T.logText().indexOf(CODE)<0,"D13 협상 실패 뒤 도착한 프레임은 읽지도 기록하지도 않는다");
}
{
  // 마커도 코드도 아닌 임의의 값 · 빈 값 — 어느 쪽이든 계약 밖이므로 같은 처리
  const bad=[];
  for(const sel of ["x-other","", MARKER.toUpperCase(), MARKER+" ", CODE.toLowerCase()]){
    const T=load(HTTP).connect("192.168.0.7:8080",CODE);
    const ws=T.wsLog[0];
    ws.readyState=1; ws.protocol=sel; ws.onopen();
    const st=T.status();
    if(ws.readyState!==3||!/프로토콜 협상/.test(st)||(sel&&st.indexOf(sel)>=0)) bad.push(JSON.stringify(sel));
  }
  ok(bad.length===0,"D14 마커와 정확히 같지 않은 선택값은 모두 끊고, 그 값을 안내에 넣지 않는다"
    +(bad.length?" — 실패: "+bad.join(","):""));
}
{
  // 정적: 협상 값을 상태·로그로 흘려보내는 표현 자체가 없다
  ok(!/\$\{[^}]*\.protocol[^}]*\}/.test(script),"D15 템플릿 문자열에 하위 프로토콜 값을 끼워 넣지 않는다");
  ok(!/(?:status|log)\s*\([^)]*\bws\.protocol/.test(script)&&!/(?:status|log)\s*\([^)]*\bsock\.protocol/.test(script),
    "D16 status()·log() 인자에 소켓 protocol 값이 들어가지 않는다");
  ok(/\.protocol\s*!==\s*PROTOCOL_MARKER/.test(script),"D17 협상 값은 공개 마커와의 정확 비교에만 쓴다");
}

console.log(`\n=== smoke_testclient: pass ${pass} / fail ${fail} ===`);
if(fail){ console.log("실패:", fails.join(" | ")); process.exit(1); }
