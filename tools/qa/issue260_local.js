"use strict";
/* #260 로컬 QA 보조 — 이 작업 트리의 server/(수정 없이)를 전용 Postgres 55460 · HTTP 8082 로 띄운다. #259 의 8081·55459·데이터는 건드리지 않는다.
   사용 (Windows, 이 저장소 루트에서):
     node tools/qa/issue260_local.js start          # 처음이면 폴더·클러스터 생성 → PG → 서버(기동 때 마이그레이션). 이 터미널과 무관한 숨김 프로세스로 뜬다
     node tools/qa/issue260_local.js status         # 두 포트와 /readyz
     node tools/qa/issue260_local.js stop           # 서버 + PG 정지 (데이터는 남는다)
     node tools/qa/issue260_local.js stop --server-only
     … --issue261                                  # #261 미리보기: 같은 절차를 전용 Postgres 55461 · HTTP 8083 · qa/issue-261-local 로(#260 기본값·데이터·PID 는 그대로)
     … --issue262                                  # #262 미리보기: 전용 Postgres 55462 · HTTP 8085(8084 는 이 PC 의 다른 서비스가 쓴다) · qa/issue-262-local (다른 값·데이터·PID 는 그대로)
     node tools/qa/issue260_local.js lan --issue262 # #276 server/LAN모드실행.bat 전용: 같은 공유기 LAN 공개 서버를 **이 창에서 HTTPS 로** 띄운다(아래 ensureCert()·lan() 참조)
   - 데이터: C:/Users/pc_77/orca/qa/Digit-Duel/issue-260-local/pgdata · data/match-results-outbox.jsonl — 정지·재기동해도 남는다. 이 도구는 아무것도 지우지 않는다.
   - 비밀: 첫 기동 때 만든 전용 DB 비밀번호(secrets/local.json, 사용자 전용 ACL)와 #259 의 secrets/smtp.json(있으면 **읽기만**)을
     서버 자식 프로세스의 환경에만 넘긴다. 명령줄·로그·출력에 값을 쓰지 않는다.
   - 메일·계정: 이 도구는 GET /healthz·/readyz 말고 어떤 API 도 부르지 않는다 — 메일 발송·가입·삭제를 하지 않는다.
   - #259 폴더에서 쓰는 것은 PG 실행 파일(pg18/bin)과 smtp.json 읽기뿐이다. */
const fs=require("fs"), path=require("path"), crypto=require("crypto"), net=require("net"), http=require("http"), https=require("https"), os=require("os"), cp=require("child_process");

const I261=process.argv.includes("--issue261"), I262=process.argv.includes("--issue262"); // #261·#262 — 이 칸만 포트·폴더를 바꾼다
const QA="C:/Users/pc_77/orca/qa/Digit-Duel/issue-"+(I262?"262":I261?"261":"260")+"-local";
const QA259="C:/Users/pc_77/orca/qa/Digit-Duel/issue-259-local";
const PG_BIN=QA259+"/pg18/bin", SMTP_FILE=QA259+"/secrets/smtp.json";
const PG_PORT=I262?55462:I261?55461:55460, HTTP_PORT=I262?8085:I261?8083:8082, PG_USER="dd_qa", PG_DB="postgres"; // 전용 클러스터 하나 = 전용 DB
const SERVER=path.resolve(__dirname,"../../server"), SERVER_JS=path.join(SERVER,"authoritative","server.js"); // 절대 경로로 띄운다 — 명령줄로 "이 checkout 의 서버"인지 가린다
const DATA=QA+"/pgdata", SECRETS=QA+"/secrets", LOGS=QA+"/logs", CFG=SECRETS+"/local.json";
const OUTBOX=QA+"/data/match-results-outbox.jsonl"; // Jupiter #260 결과 저장 재시도 파일(확정: DD_RESULT_OUTBOX, 상한 200 은 서버 고정). 정지·재기동에도 남는다
const SERVER_PID=QA+"/run/server.pid"; // 이 도구가 띄운 서버 PID — 끄기·재사용 전 대조
/* #276 LAN HTTPS: 이 서버 전용 자체 서명 leaf(CA:FALSE·serverAuth·정확한 SAN) — 사용자 전용 secrets/tls 에만 둔다. 개인 키는 출력·Git 에 두지 않는다 */
const TLS_DIR=SECRETS+"/tls", CRT=TLS_DIR+"/server.crt", KEY=TLS_DIR+"/server.key", TRUSTED=TLS_DIR+"/trusted-thumbprint.txt";
const OPENSSL="C:/Program Files/Git/usr/bin/openssl.exe", CERT_CN="Digit Dual LAN QA server", CERT_DAYS=90, RENEW_MS=14*864e5;

const log=m=>{ try{ fs.mkdirSync(LOGS,{recursive:true}); fs.appendFileSync(LOGS+"/up.log",new Date().toISOString()+" "+m+"\n"); }catch(e){} };
const say=m=>{ console.log(m); log(m); };
const die=m=>{ say("FAIL: "+m); process.exit(1); };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const listening=port=>new Promise(res=>{ const s=net.connect(port,"127.0.0.1"); s.once("connect",()=>{ s.destroy(); res(true); }); s.once("error",()=>res(false)); });
async function waitFor(fn,sec){ for(let i=0;i<sec*2;i++){ if(await fn()) return true; await sleep(500); } return false; }
function get(p,tls){ return new Promise(res=>{ // tls = LAN 서버: 전용 인증서만 신뢰하고 127.0.0.1(SAN) 으로 확인한다
  let ca=null; if(tls) try{ ca=fs.readFileSync(CRT); }catch(e){ return res("no certificate"); }
  const r=(tls?https:http).get({host:"127.0.0.1",port:HTTP_PORT,path:p,timeout:5000,ca},x=>{ let b=""; x.on("data",d=>b+=d); x.on("end",()=>res(x.statusCode+" "+b.trim().slice(0,40))); }); r.on("error",()=>res("no answer")); r.on("timeout",()=>{ r.destroy(); res("timeout"); }); }); }
function run(file,args){ return cp.spawnSync(file,args,{windowsHide:true,encoding:"utf8"}); }
/* pg_ctl 전용: 출력 파이프를 만들지 않는다. pg_ctl start 가 띄운 postgres 가 그 파이프를 물려받아 살아 있는 한 spawnSync 는 EOF 를 기다리며
   끝나지 않는다(2026-09-27 첫 기동 정지 — pg_ctl 은 끝났는데 up 이 멈춤). 서버 로그는 -l logs/postgres.log 가 받는다 */
function pgCtl(args){ return cp.spawnSync(PG_BIN+"/pg_ctl.exe",args,{windowsHide:true,stdio:"ignore"}); }

/* 설정 파일 오류는 고정 문구만 — JSON.parse 오류는 입력 조각(비밀번호일 수 있다)을 인용한다 */
function readJson(file,check){ let v=null; try{ v=JSON.parse(fs.readFileSync(file,"utf8")); }catch(e){} return v&&check(v)?v:null; }
const readCfg=()=>readJson(CFG,v=>v.pgPort===PG_PORT&&typeof v.password==="string"&&v.password.length>=24);

/* QA 폴더 전체(secrets·pgdata·logs·data/outbox·run)는 현재 사용자 전용이다 — 상위(qa/Digit-Duel)는 다른 그룹에도 읽기를 준다(#259 보고 6장).
   만들 때 상속을 끊고 현재 사용자만 둔다(하위는 이를 상속). 매 기동마다 다시 읽어 상속·다른 주체가 보이면 멈춘다 — 서버의 chmod 는 Windows ACL 이 아니다. */
function aclPrivate(){
  const ps=`$a=Get-Acl -LiteralPath '${QA}'; $me=[Security.Principal.WindowsIdentity]::GetCurrent().Name; "$($a.AreAccessRulesProtected)|$(@($a.Access|Where-Object{$_.IdentityReference.Value -ne $me}).Count)|$(@($a.Access).Count)"`;
  const [prot,others,all]=String(run("powershell",["-NoProfile","-Command",ps]).stdout||"").trim().split("|");
  return prot==="True"&&others==="0"&&+all>0;
}
/* 첫 기동: 사용자 전용 QA 폴더 → 무작위 비밀번호 → initdb(SCRAM) — 이미 있으면 아무것도 바꾸지 않는다 */
function ensureInit(){
  if(!fs.existsSync(QA)){
    fs.mkdirSync(QA,{recursive:true});
    if(run("icacls",[QA,"/inheritance:r","/grant:r",process.env.USERNAME+":(OI)(CI)F"]).status!==0) die("could not restrict QA folder ACL - nothing written");
  }
  if(!aclPrivate()) die("QA folder ACL is not current-user-only (inherited or other principals) - nothing started");
  if(fs.existsSync(DATA+"/PG_VERSION")){ if(!readCfg()) die("secrets/local.json missing or malformed (contents not shown) - cluster left untouched"); return; }
  if(fs.existsSync(DATA)&&fs.readdirSync(DATA).length) die("pgdata exists but is not a cluster - left untouched");
  fs.mkdirSync(SECRETS,{recursive:true});
  const password=crypto.randomBytes(24).toString("base64url"), pw=SECRETS+"/initdb.pw";
  fs.writeFileSync(CFG,JSON.stringify({pgPort:PG_PORT,user:PG_USER,password,database:PG_DB})); // 클러스터가 아직 없으니 이 값을 쓰는 곳도 없다
  fs.writeFileSync(pw,password,{flag:"wx"});
  let r; try{ r=run(PG_BIN+"/initdb.exe",["-D",DATA,"-U",PG_USER,"-A","scram-sha-256","--pwfile="+pw,"-E","UTF8","--no-locale"]); }
  finally{ fs.unlinkSync(pw); } // die(process.exit) 전에 지운다
  if(r.status!==0) die("initdb failed (exit "+r.status+")");
  say("init: new cluster "+DATA);
}
/* pg_ctl -w 와 같은 신호: postmaster.pid 1행이 살아 있는 PID · 8행 ready — 복구 중(57P03)에는 서버를 띄우지 않는다 */
function pgPid(){ try{ return +fs.readFileSync(DATA+"/postmaster.pid","utf8").split(/\r?\n/)[0]||null; }catch(e){ return null; } }
function pgReady(){ // 그 포트를 듣는 프로세스가 **우리** postmaster 여야 한다
  try{ const l=fs.readFileSync(DATA+"/postmaster.pid","utf8").split(/\r?\n/); if((l[7]||"").trim()!=="ready") return false; process.kill(+l[0],0); return portPid(PG_PORT)===+l[0]; }catch(e){ return false; }
}
/* 명령줄이 우리가 띄운 모양 그대로인가: [node, **이 checkout** 의 authoritative/server.js(대소문자·슬래시 무시), 선택 --lan].
   스크립트는 정확히 두 번째 인자여야 한다 — 부분 일치(server.js.other)나 다른 스크립트의 뒷인자(node other.js <경로>)는 남의 것이다 */
const normPath=s=>String(s).replace(/\//g,"\\").toLowerCase();
function ownsServer(cmdline){
  const t=(String(cmdline).match(/"[^"]*"|\S+/g)||[]).map(a=>a.replace(/^"|"$/g,"")); // Windows 명령줄: 따옴표 묶음 또는 공백 구분
  return {ours:t.length>1&&normPath(t[1])===normPath(SERVER_JS),lan:t[2]==="--lan"};
}
/* 이 도구가 띄운 서버인가: 포트를 듣는 PID = 띄울 때 기록한 PID 이고 명령줄이 이 checkout 의 server.js. 아니면 끄지도 재사용하지도 않는다 */
function serverPid(){
  let rec=null; try{ rec=+fs.readFileSync(SERVER_PID,"utf8"); }catch(e){}
  const pid=portPid(HTTP_PORT); if(!pid||pid!==rec) return {pid,ours:false,lan:false};
  const line=String(run("powershell",["-NoProfile","-Command",`(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`]).stdout);
  return Object.assign({pid},ownsServer(line));
}
async function pgUp(){
  if(await listening(PG_PORT)&&portPid(PG_PORT)!==pgPid()) die("port "+PG_PORT+" is owned by a process that is not this cluster - nothing started");
  if(!await listening(PG_PORT)){
    const r=pgCtl(["start","-D",DATA,"-l",LOGS+"/postgres.log","-o",`-p ${PG_PORT} -c listen_addresses=127.0.0.1`]);
    if(r.status!==0) die("pg_ctl start failed (exit "+r.status+") - see logs/postgres.log");
  }
  if(!await waitFor(async()=>pgReady()&&await listening(PG_PORT),120)) die("postgres not ready in 120s - see logs/postgres.log");
  say("postgres: ready 127.0.0.1:"+PG_PORT);
}
const readSmtp=()=>readJson(SMTP_FILE,v=>typeof v.smtpUrl==="string"&&v.smtpUrl&&typeof v.mailFrom==="string"&&v.mailFrom);
/* 물려받은 배포·노출·DB·TLS 값은 버린다 — TLS 는 lan() 이 이 도구의 인증서로만 넣는다(up 은 HTTP 그대로) */
function cleanEnv(src){
  const env=Object.assign({},src);
  for(const k of ["DD_LAN","DD_AUTH_PUBLIC_DEPLOY","DD_AUTH_PUBLIC_HOST","DD_AUTH_BIND","DD_BIND","PORT","DD_SMTP_URL","DD_MAIL_FROM","DATABASE_URL","DD_DB_CA_CERT","DD_AUTH_TLS_CERT","DD_AUTH_TLS_KEY"]) delete env[k];
  return env;
}
/* 서버 자식 환경: 이 클러스터·비밀만 넣는다(값은 출력하지 않는다) */
function serverEnv(cfg,smtp){
  const env=cleanEnv(process.env);
  fs.mkdirSync(path.dirname(OUTBOX),{recursive:true});
  Object.assign(env,{DD_AUTH_PORT:String(HTTP_PORT),DD_RESULT_OUTBOX:OUTBOX,DD_DB_MIGRATE_ON_START:"1", // 서버가 기동 게이트에서 미적용 마이그레이션(005 등)을 적용한다 — server/* 무수정
    DATABASE_URL:`postgres://${PG_USER}:${encodeURIComponent(cfg.password)}@127.0.0.1:${PG_PORT}/${PG_DB}`});
  if(smtp){ env.DD_SMTP_URL=smtp.smtpUrl; env.DD_MAIL_FROM=smtp.mailFrom; say("mail: #259 smtp.json loaded read-only (values not shown; nothing is sent by this tool)"); }
  else say("mail: not configured (reset requests answer 503)");
  return env;
}
const writePid=pid=>{ fs.mkdirSync(path.dirname(SERVER_PID),{recursive:true}); fs.writeFileSync(SERVER_PID,String(pid)); };
async function up(){
  ensureInit();
  const cfg=readCfg();
  await pgUp();
  if(await listening(HTTP_PORT)){ const s=serverPid(); if(s.ours) return say("server: already running pid "+s.pid); die("port "+HTTP_PORT+" is owned by a process this tool did not start - left alone"); }
  const env=serverEnv(cfg,readSmtp());
  const out=fs.openSync(LOGS+"/server.log","a");
  const child=cp.spawn(process.execPath,[SERVER_JS],{cwd:SERVER,env,detached:true,stdio:["ignore",out,out],windowsHide:true});
  writePid(child.pid); child.unref();
  if(!await waitFor(()=>listening(HTTP_PORT),60)) die("server did not listen on "+HTTP_PORT+" - see logs/server.log");
  say("server: http://127.0.0.1:"+HTTP_PORT+"/ pid "+child.pid+" · postgres pid "+pgPid()+" · readyz "+await get("/readyz"));
}
/* ===== #276 LAN HTTPS 인증서 =====
   SAN = localhost·127.0.0.1·지금 쓰는 사설 IPv4. 가상 스위치(vEthernet*)·169.254 는 뺀다 — 다른 기기가 못 쓰고 재부팅마다 바뀐다.
   재사용: 기존 키·인증서가 정확히 맞고(우리 CN·CA 아님·serverAuth·같은 키·같은 SAN) 만료 14일 전까지. 아니면 새로 만든다. DB·계정은 건드리지 않는다. */
const S=require(path.join(SERVER,"security")); // 서버와 같은 사설 대역 판정(순수 함수)
function lanIps(nets=os.networkInterfaces()){
  const out=new Set();
  for(const [name,list] of Object.entries(nets)) if(!/^vEthernet/i.test(name)) for(const i of list||[])
    if((i.family==="IPv4"||i.family===4)&&!i.internal&&S.isPrivateIp(i.address)&&!/^169\.254\./.test(i.address)) out.add(i.address);
  return [...out].sort();
}
const wantSan=ips=>["DNS:localhost","IP Address:127.0.0.1",...ips.map(ip=>"IP Address:"+ip)];
function certProblem(c,key,ips,now=Date.now()){ // null = 그대로 쓴다
  if(!c||!key) return "missing";
  if(c.ca||!(c.keyUsage||[]).includes("1.3.6.1.5.5.7.3.1")||c.subject!=="CN="+CERT_CN) return "not this tool's server certificate";
  if(!c.checkPrivateKey(key)) return "key mismatch";
  if(String(c.subjectAltName).split(", ").sort().join()!==wantSan(ips).sort().join()) return "address change";
  if(Date.parse(c.validFrom)>now||Date.parse(c.validTo)-now<RENEW_MS) return "expiry";
  return null;
}
const opensslArgs=(keyOut,crtOut,ips)=>["req","-x509","-newkey","ec","-pkeyopt","ec_paramgen_curve:P-256","-nodes","-days",String(CERT_DAYS),"-subj","/CN="+CERT_CN,
  "-keyout",keyOut,"-out",crtOut,"-addext","basicConstraints=critical,CA:FALSE","-addext","keyUsage=critical,digitalSignature",
  "-addext","extendedKeyUsage=serverAuth","-addext","subjectAltName="+wantSan(ips).join(",").replace(/IP Address:/g,"IP:")];
function loadPair(crt,key){ try{ return [new crypto.X509Certificate(fs.readFileSync(crt)),crypto.createPrivateKey(fs.readFileSync(key))]; }catch(e){ return [null,null]; } }
function genCert(tk,tc,ips,openssl=OPENSSL){ // null = 만들고 검증까지 끝남. 실패하면 임시 파일을 지운다(오류 문구에 키·출력을 싣지 않는다)
  for(const f of [tk,tc]) fs.rmSync(f,{force:true});
  if(!fs.existsSync(openssl)) return "openssl not found ("+openssl+", Git for Windows)";
  const r=run(openssl,opensslArgs(tk,tc,ips)), [c,k]=loadPair(tc,tk), bad=r.status!==0?"openssl exit "+r.status:certProblem(c,k,ips);
  if(bad) for(const f of [tk,tc]) fs.rmSync(f,{force:true});
  return bad;
}
const thumb=c=>c.fingerprint.replace(/:/g,"");
/* 현재 사용자 신뢰 루트(CurrentUser\Root)에서 그 지문 항목의 Subject — 없으면 "". 다른 저장소·인증서는 보지 않는다 */
function storeSubject(t){
  if(!/^[0-9A-F]{40}$/.test(t)) return "";
  return String(run("powershell",["-NoProfile","-Command",`$c=Get-Item -LiteralPath 'Cert:\\CurrentUser\\Root\\${t}' -ErrorAction SilentlyContinue; if($c){$c.Subject}`]).stdout||"").trim();
}
/* 이 leaf 하나만 현재 사용자 신뢰에 넣는다(certutil -user). Windows 확인 창은 사용자가 직접 고른다 — 자동으로 닫지 않는다. 루트 CA·LocalMachine·브라우저 예외 플래그 없음 */
function trust(c,file,certutil="certutil"){
  if(storeSubject(thumb(c))==="CN="+CERT_CN) return true;
  console.log("tls: adding this server's own certificate to your Windows user trust - if Windows asks, choose Yes");
  return run(certutil,["-user","-addstore","Root",file]).status===0&&storeSubject(thumb(c))==="CN="+CERT_CN;
}
/* 교체 순서: 옛 항목이 우리 것인지 먼저 확인(기록 지문 = 옛 파일 지문 = 저장소의 우리 CN) → 새 키·인증서를 임시 파일로 만들고 검증 → 신뢰 추가 성공 →
   파일 교체 → 확인된 옛 항목만 제거. 중간에 실패하면 옛 파일·신뢰는 그대로 두고 LAN 을 띄우지 않는다(HTTP 로 내려가지 않는다) */
function ensureCert(){
  const ips=lanIps(); if(!ips.length) die("no private LAN IPv4 address on this PC - LAN mode not started");
  const [c,k]=loadPair(CRT,KEY), why=certProblem(c,k,ips);
  if(!why){
    if(!trust(c,CRT)) die("Windows user trust for this server certificate was not added (declined or failed) - LAN HTTPS not started");
    fs.writeFileSync(TRUSTED,thumb(c)); return ips;
  }
  say("tls: new server certificate ("+why+")");
  let rec=""; try{ rec=fs.readFileSync(TRUSTED,"utf8").trim(); }catch(e){}
  const oldT=c?thumb(c):"", ownOld=!!oldT&&rec===oldT&&storeSubject(oldT)==="CN="+CERT_CN;
  fs.mkdirSync(TLS_DIR,{recursive:true});
  const tk=KEY+".new", tc=CRT+".new", bad=genCert(tk,tc,ips);
  if(bad) die("certificate not created: "+bad+" - LAN HTTPS not started, previous files kept");
  const nc=loadPair(tc,tk)[0];
  if(!trust(nc,tc)){ for(const f of [tk,tc]) fs.rmSync(f,{force:true}); die("Windows user trust for the new certificate was not added (declined or failed) - LAN HTTPS not started, previous files kept"); }
  fs.renameSync(tk,KEY); fs.renameSync(tc,CRT); fs.writeFileSync(TRUSTED,thumb(nc));
  if(ownOld&&oldT!==thumb(nc)) say(run("certutil",["-user","-delstore","Root",oldT]).status===0?"tls: removed this tool's previous certificate from your user trust"
    :"tls: this tool's previous certificate "+oldT+" is still in your user trust (certmgr.msc to remove)");
  return ips;
}
/* lan: server/LAN모드실행.bat 전용 — 이 창이 서버를 소유한다(숨김·중복 서버 없음). 같은 공유기 사설 대역만 받는다(--lan · 0.0.0.0 바인드 · 사설 피어 검사).
   기존 전용 클러스터·DB 비밀·SMTP 가 하나라도 없으면 멈춘다 — 새 클러스터나 빈 DB 로 대신하지 않는다(계정·메일 유실 방지).
   Ctrl+C·창 닫기 = 이 서버만 종료. PG 는 127.0.0.1 에 남아 다음 실행이 재사용한다(데이터 유지). 끄기: node tools/qa/issue260_local.js stop --issue262 */
async function lan(){
  for(const [f,what] of [[PG_BIN+"/pg_ctl.exe","postgres binaries"],[DATA+"/PG_VERSION","existing QA database cluster"],[CFG,"DB secret (secrets/local.json)"],[SMTP_FILE,"mail secret (smtp.json)"]])
    if(!fs.existsSync(f)) die(what+" not found: "+f+" - nothing started (no new or blank DB is created)");
  if(!aclPrivate()) die("QA folder ACL is not current-user-only (inherited or other principals) - nothing started");
  const cfg=readCfg(); if(!cfg) die("secrets/local.json malformed (contents not shown) - nothing started");
  const smtp=readSmtp(); if(!smtp) die("smtp.json malformed (contents not shown) - nothing started");
  await pgUp();
  if(await listening(HTTP_PORT)){
    const s=serverPid();
    if(s.ours&&s.lan) return say("server: already running in LAN mode, pid "+s.pid+" (owned by its own window) · healthz "+await get("/healthz",true)+" · readyz "+await get("/readyz",true));
    die(s.ours?"port "+HTTP_PORT+" is used by this checkout's local-only server pid "+s.pid+" - run: node tools/qa/issue260_local.js stop --server-only --issue262, then start again"
      :"port "+HTTP_PORT+" is owned by a process this tool did not start - left alone");
  }
  const ips=ensureCert(); // LAN 은 HTTPS 만 — 인증서·신뢰가 없으면 여기서 멈춘다
  const env=Object.assign(serverEnv(cfg,smtp),{DD_AUTH_TLS_CERT:path.resolve(CRT),DD_AUTH_TLS_KEY:path.resolve(KEY)});
  const child=cp.spawn(process.execPath,[SERVER_JS,"--lan"],{cwd:SERVER,env,stdio:"inherit"});
  writePid(child.pid);
  let code=null, interrupted=false;
  process.on("SIGINT",()=>{ interrupted=true; }); // Ctrl+C 는 같은 콘솔의 서버도 받는다 — 서버가 끝날 때까지 기다렸다가 끝낸다
  const exited=new Promise(r=>child.on("exit",c=>{ code=c===null?0:c; r(); })); // 신호로 끝남(stop 명령) = 정상 정지
  if(await waitFor(async()=>code!==null||await listening(HTTP_PORT),120)&&code===null)
    say("server: LAN HTTPS pid "+child.pid+" · healthz "+await get("/healthz",true)+" · readyz "+await get("/readyz",true)+" · open "+["localhost",...ips].map(h=>"https://"+h+":"+HTTP_PORT+"/").join(" ")
      +" · Ctrl+C or close this window to stop (postgres stays on 127.0.0.1:"+PG_PORT+")");
  await exited;
  say("server: stopped"+(interrupted?"":" (exit "+code+")"));
  process.exit(interrupted?0:code);
}
/* start: up 을 WMI 로 띄운다 — 부모가 WmiPrvSE 라 이 셸·Orca 탭이 닫혀도 PG·서버가 산다(#259 서비스 중단 교훈). 명령줄에 비밀 없음 */
async function start(){
  const cmd=`"${process.execPath}" "${__filename}" up${I262?" --issue262":I261?" --issue261":""}`.replace(/'/g,"''");
  const ps=`$r=([wmiclass]'Win32_Process').Create('${cmd}','${SERVER.replace(/'/g,"''")}'); "$($r.ReturnValue) $($r.ProcessId)"`;
  const r=run("powershell",["-NoProfile","-Command",ps]); const [rv,pid]=String(r.stdout||"").trim().split(" ");
  if(r.status!==0||rv!=="0") die("WMI launch failed ("+String(r.stdout||r.stderr).trim().slice(0,80)+")");
  console.log("launched hidden bootstrap pid "+pid+" - waiting (first run creates the cluster)...");
  const ok=await waitFor(()=>listening(HTTP_PORT),240);
  console.log(ok?"server: http://127.0.0.1:"+HTTP_PORT+"/ readyz "+await get("/readyz"):"not listening yet - see "+LOGS+"/up.log");
  process.exit(ok?0:1);
}
/* 이 포트를 가진 프로세스가 이 checkout 의 server.js 일 때만 끈다 — 이 포트 밖은 보지도 않는다. LAN 모드는 0.0.0.0 에서 듣는다 */
function listenerPid(netstat,port){ const m=String(netstat).split(/\r?\n/).map(l=>l.trim().split(/\s+/)).find(c=>(c[1]==="127.0.0.1:"+port||c[1]==="0.0.0.0:"+port)&&c[3]==="LISTENING"); return m?+m[4]:null; }
const portPid=port=>listenerPid(run("netstat",["-ano","-p","TCP"]).stdout,port);
function stop(serverOnly){
  const s=serverPid();
  if(s.ours){ process.kill(s.pid); console.log("server: stopped pid "+s.pid); }
  else console.log(s.pid?"port "+HTTP_PORT+" owned by a process this tool did not start - left alone":"server: not running");
  if(!serverOnly){ const r=pgCtl(["stop","-D",DATA,"-m","fast"]); console.log(r.status===0?"postgres: stopped (data kept)":"postgres: not running"); }
}
async function status(){
  const s=serverPid(), pg=portPid(PG_PORT);
  console.log("postgres 127.0.0.1:"+PG_PORT+" "+(pg?"pid "+pg+(pg===pgPid()?" (ours)":" (NOT ours)"):"down")
    +" · server :"+HTTP_PORT+" "+(s.pid?"pid "+s.pid+(s.ours?(s.lan?" (ours, LAN)":" (ours, local only)"):" (NOT ours)")+" · healthz "+await get("/healthz",s.lan)+" · readyz "+await get("/readyz",s.lan):"down"));
}

module.exports={listenerPid,ownsServer,SERVER_JS,cleanEnv,lanIps,wantSan,certProblem,genCert,trust,loadPair,CERT_CN,OPENSSL}; // server/test/test-launcher.js 가 소유·인증서 판정을 검사한다
const [cmd,flag]=process.argv.slice(2).filter(a=>a!=="--issue261"&&a!=="--issue262");
if(require.main!==module){ /* require 됐을 때는 아무것도 띄우지 않는다 */ }
else if(cmd==="up") up().catch(e=>die("unexpected "+(e&&e.code||"error"))); // 예외 메시지는 쓰지 않는다(DSN 을 담을 수 있다)
else if(cmd==="lan") lan().catch(e=>die("unexpected "+(e&&e.code||"error")));
else if(cmd==="start") start();
else if(cmd==="stop") stop(flag==="--server-only");
else if(cmd==="status") status();
else { console.log("usage: node tools/qa/issue260_local.js start|status|stop [--server-only]|lan [--issue261|--issue262]"); process.exit(2); }
