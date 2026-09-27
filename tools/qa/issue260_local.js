"use strict";
/* #260 로컬 QA 보조 — 이 작업 트리의 server/(수정 없이)를 전용 Postgres 55460 · HTTP 8082 로 띄운다. #259 의 8081·55459·데이터는 건드리지 않는다.
   사용 (Windows, 이 저장소 루트에서):
     node tools/qa/issue260_local.js start          # 처음이면 폴더·클러스터 생성 → PG → 서버(기동 때 마이그레이션). 이 터미널과 무관한 숨김 프로세스로 뜬다
     node tools/qa/issue260_local.js status         # 두 포트와 /readyz
     node tools/qa/issue260_local.js stop           # 서버 + PG 정지 (데이터는 남는다)
     node tools/qa/issue260_local.js stop --server-only
     … --issue261                                  # #261 미리보기: 같은 절차를 전용 Postgres 55461 · HTTP 8083 · qa/issue-261-local 로(#260 기본값·데이터·PID 는 그대로)
   - 데이터: C:/Users/pc_77/orca/qa/Digit-Duel/issue-260-local/pgdata · data/match-results-outbox.jsonl — 정지·재기동해도 남는다. 이 도구는 아무것도 지우지 않는다.
   - 비밀: 첫 기동 때 만든 전용 DB 비밀번호(secrets/local.json, 사용자 전용 ACL)와 #259 의 secrets/smtp.json(있으면 **읽기만**)을
     서버 자식 프로세스의 환경에만 넘긴다. 명령줄·로그·출력에 값을 쓰지 않는다.
   - 메일·계정: 이 도구는 GET /healthz·/readyz 말고 어떤 API 도 부르지 않는다 — 메일 발송·가입·삭제를 하지 않는다.
   - #259 폴더에서 쓰는 것은 PG 실행 파일(pg18/bin)과 smtp.json 읽기뿐이다. */
const fs=require("fs"), path=require("path"), crypto=require("crypto"), net=require("net"), http=require("http"), cp=require("child_process");

const I261=process.argv.includes("--issue261"); // #261 — 이 한 칸만 포트·폴더를 바꾼다
const QA="C:/Users/pc_77/orca/qa/Digit-Duel/issue-"+(I261?"261":"260")+"-local";
const QA259="C:/Users/pc_77/orca/qa/Digit-Duel/issue-259-local";
const PG_BIN=QA259+"/pg18/bin", SMTP_FILE=QA259+"/secrets/smtp.json";
const PG_PORT=I261?55461:55460, HTTP_PORT=I261?8083:8082, PG_USER="dd_qa", PG_DB="postgres"; // 전용 클러스터 하나 = 전용 DB
const SERVER=path.resolve(__dirname,"../../server");
const DATA=QA+"/pgdata", SECRETS=QA+"/secrets", LOGS=QA+"/logs", CFG=SECRETS+"/local.json";
const OUTBOX=QA+"/data/match-results-outbox.jsonl"; // Jupiter #260 결과 저장 재시도 파일(확정: DD_RESULT_OUTBOX, 상한 200 은 서버 고정). 정지·재기동에도 남는다
const SERVER_PID=QA+"/run/server.pid"; // 이 도구가 띄운 서버 PID — 끄기·재사용 전 대조

const log=m=>{ try{ fs.mkdirSync(LOGS,{recursive:true}); fs.appendFileSync(LOGS+"/up.log",new Date().toISOString()+" "+m+"\n"); }catch(e){} };
const say=m=>{ console.log(m); log(m); };
const die=m=>{ say("FAIL: "+m); process.exit(1); };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const listening=port=>new Promise(res=>{ const s=net.connect(port,"127.0.0.1"); s.once("connect",()=>{ s.destroy(); res(true); }); s.once("error",()=>res(false)); });
async function waitFor(fn,sec){ for(let i=0;i<sec*2;i++){ if(await fn()) return true; await sleep(500); } return false; }
function get(p){ return new Promise(res=>{ const r=http.get({host:"127.0.0.1",port:HTTP_PORT,path:p,timeout:5000},x=>{ let b=""; x.on("data",d=>b+=d); x.on("end",()=>res(x.statusCode+" "+b.trim().slice(0,40))); }); r.on("error",()=>res("no answer")); r.on("timeout",()=>{ r.destroy(); res("timeout"); }); }); }
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
/* 이 도구가 띄운 서버인가: 8082 를 듣는 PID = 띄울 때 기록한 PID 이고 명령줄이 authoritative/server.js. 아니면 끄지도 재사용하지도 않는다 */
function serverPid(){
  let rec=null; try{ rec=+fs.readFileSync(SERVER_PID,"utf8"); }catch(e){}
  const pid=portPid(HTTP_PORT); if(!pid||pid!==rec) return {pid,ours:false};
  const line=String(run("powershell",["-NoProfile","-Command",`(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`]).stdout);
  return {pid,ours:/authoritative[\\/]server\.js/.test(line)};
}
async function up(){
  ensureInit();
  const cfg=readCfg();
  if(await listening(PG_PORT)&&portPid(PG_PORT)!==pgPid()) die("port "+PG_PORT+" is owned by a process that is not this cluster - nothing started");
  if(!await listening(PG_PORT)){
    const r=pgCtl(["start","-D",DATA,"-l",LOGS+"/postgres.log","-o",`-p ${PG_PORT} -c listen_addresses=127.0.0.1`]);
    if(r.status!==0) die("pg_ctl start failed (exit "+r.status+") - see logs/postgres.log");
  }
  if(!await waitFor(async()=>pgReady()&&await listening(PG_PORT),120)) die("postgres not ready in 120s - see logs/postgres.log");
  say("postgres: ready 127.0.0.1:"+PG_PORT);
  if(await listening(HTTP_PORT)){ const s=serverPid(); if(s.ours) return say("server: already running pid "+s.pid); die("port "+HTTP_PORT+" is owned by a process this tool did not start - left alone"); }
  const env=Object.assign({},process.env);
  for(const k of ["DD_LAN","DD_AUTH_PUBLIC_DEPLOY","DD_AUTH_PUBLIC_HOST","DD_AUTH_BIND","PORT","DD_SMTP_URL","DD_MAIL_FROM"]) delete env[k];
  fs.mkdirSync(path.dirname(OUTBOX),{recursive:true});
  Object.assign(env,{DD_AUTH_PORT:String(HTTP_PORT),DD_RESULT_OUTBOX:OUTBOX,DD_DB_MIGRATE_ON_START:"1", // 서버가 기동 게이트에서 미적용 마이그레이션(005 등)을 적용한다 — server/* 무수정
    DATABASE_URL:`postgres://${PG_USER}:${encodeURIComponent(cfg.password)}@127.0.0.1:${PG_PORT}/${PG_DB}`});
  const smtp=readJson(SMTP_FILE,v=>typeof v.smtpUrl==="string"&&v.smtpUrl&&typeof v.mailFrom==="string"&&v.mailFrom);
  if(smtp){ env.DD_SMTP_URL=smtp.smtpUrl; env.DD_MAIL_FROM=smtp.mailFrom; say("mail: #259 smtp.json loaded read-only (values not shown; nothing is sent by this tool)"); }
  else say("mail: not configured (reset requests answer 503)");
  const out=fs.openSync(LOGS+"/server.log","a");
  const child=cp.spawn(process.execPath,["authoritative/server.js"],{cwd:SERVER,env,detached:true,stdio:["ignore",out,out],windowsHide:true});
  fs.mkdirSync(path.dirname(SERVER_PID),{recursive:true}); fs.writeFileSync(SERVER_PID,String(child.pid)); child.unref();
  if(!await waitFor(()=>listening(HTTP_PORT),60)) die("server did not listen on "+HTTP_PORT+" - see logs/server.log");
  say("server: http://127.0.0.1:"+HTTP_PORT+"/ pid "+child.pid+" · postgres pid "+pgPid()+" · readyz "+await get("/readyz"));
}
/* start: up 을 WMI 로 띄운다 — 부모가 WmiPrvSE 라 이 셸·Orca 탭이 닫혀도 PG·서버가 산다(#259 서비스 중단 교훈). 명령줄에 비밀 없음 */
async function start(){
  const cmd=`"${process.execPath}" "${__filename}" up${I261?" --issue261":""}`.replace(/'/g,"''");
  const ps=`$r=([wmiclass]'Win32_Process').Create('${cmd}','${SERVER.replace(/'/g,"''")}'); "$($r.ReturnValue) $($r.ProcessId)"`;
  const r=run("powershell",["-NoProfile","-Command",ps]); const [rv,pid]=String(r.stdout||"").trim().split(" ");
  if(r.status!==0||rv!=="0") die("WMI launch failed ("+String(r.stdout||r.stderr).trim().slice(0,80)+")");
  console.log("launched hidden bootstrap pid "+pid+" - waiting (first run creates the cluster)...");
  const ok=await waitFor(()=>listening(HTTP_PORT),240);
  console.log(ok?"server: http://127.0.0.1:"+HTTP_PORT+"/ readyz "+await get("/readyz"):"not listening yet - see "+LOGS+"/up.log");
  process.exit(ok?0:1);
}
/* 이 포트를 가진 프로세스가 authoritative/server.js 일 때만 끈다 — 8082 밖은 보지도 않는다 */
function portPid(port){ const m=String(run("netstat",["-ano","-p","TCP"]).stdout).split(/\r?\n/).map(l=>l.trim().split(/\s+/)).find(c=>c[1]==="127.0.0.1:"+port&&c[3]==="LISTENING"); return m?+m[4]:null; }
function stop(serverOnly){
  const s=serverPid();
  if(s.ours){ process.kill(s.pid); console.log("server: stopped pid "+s.pid); }
  else console.log(s.pid?"port "+HTTP_PORT+" owned by a process this tool did not start - left alone":"server: not running");
  if(!serverOnly){ const r=pgCtl(["stop","-D",DATA,"-m","fast"]); console.log(r.status===0?"postgres: stopped (data kept)":"postgres: not running"); }
}
async function status(){
  const s=serverPid(), pg=portPid(PG_PORT);
  console.log("postgres 127.0.0.1:"+PG_PORT+" "+(pg?"pid "+pg+(pg===pgPid()?" (ours)":" (NOT ours)"):"down")
    +" · server 127.0.0.1:"+HTTP_PORT+" "+(s.pid?"pid "+s.pid+(s.ours?" (ours)":" (NOT ours)")+" · healthz "+await get("/healthz")+" · readyz "+await get("/readyz"):"down"));
}

const [cmd,flag]=process.argv.slice(2).filter(a=>a!=="--issue261");
if(cmd==="up") up().catch(e=>die("unexpected "+(e&&e.code||"error"))); // 예외 메시지는 쓰지 않는다(DSN 을 담을 수 있다)
else if(cmd==="start") start();
else if(cmd==="stop") stop(flag==="--server-only");
else if(cmd==="status") status();
else { console.log("usage: node tools/qa/issue260_local.js start|status|stop [--server-only] [--issue261]"); process.exit(2); }
