"use strict";
const fs=require("fs");
const path=require("path");
const {execFileSync}=require("child_process");
const H=require("../shared/harness");
const {lockstepDigest}=require("../../../server/authoritative/room");

const demo=path.join(__dirname,"..","..");
const index=path.join(demo,"index.html");
const html=fs.readFileSync(index,"utf8");
const expected=["data.js","state.js","ui.js","core.js","ai.js","ui-overlays.js","network.js","bootstrap.js"];
let pass=0,fail=0;
function ok(value,name){ if(value) pass++; else { fail++; console.error("FAIL: "+name); } }

const scripts=[...html.matchAll(/<script\s+src="js\/([^"]+)"\s*><\/script>/g)].map(match=>match[1]);
ok(JSON.stringify(scripts)===JSON.stringify(expected),"scripts load once in dependency order");
ok(/<link rel="stylesheet" href="css\/game\.css">/.test(html),"stylesheet is external");
ok(!/<style>|<script>(?![\s\S]*src=)/.test(html),"entry document has no inline CSS or JavaScript");
ok(expected.every(name=>fs.existsSync(path.join(demo,"js",name))),"all JavaScript files exist");
ok(fs.existsSync(path.join(demo,"css","game.css")),"stylesheet exists");

const T=H.load(index);
ok(typeof T.newGame==="function"&&typeof T.netConnect==="function","combined source executes in the test harness");
ok(typeof T.reduceCoreAction==="function"&&typeof T.dispatchCoreAction==="function","Core action boundary is exposed");
const input={current:1,mainUsed:false,selected:{id:7},teleport:null};
const reduced=T.reduceCoreAction(input,{t:"skipMain",origin:"ai"});
ok(input.mainUsed===false&&reduced.state!==input&&reduced.state.mainUsed===true&&reduced.events[0].type==="mainSkipped","Core reducer is pure and returns a semantic event");
ok((T.html.match(/<script>/g)||[]).length===1&&!T.html.includes('<script src='),"harness exposes one compatible inline script");
ok(T.html.includes("<style>")&&T.html.includes("</style>"),"harness exposes compatible inline CSS");
let blocked=false;
try { H.load(index,{html:'<script src="../package.json"></script>'}); } catch(error) { blocked=/escapes demo root/.test(error.message); }
ok(blocked,"harness rejects asset traversal");

let baseHtml=null;
try { baseHtml=execFileSync("git",["show","9853a2c:demo/index.html"],{cwd:path.resolve(demo,".."),maxBuffer:1<<26}).toString("utf8"); }
catch(error) { console.error(error.message); }
ok(!!baseHtml,"pre-split baseline source is available");
if(baseHtml){
  const trace=(opts,seed)=>{
    const X=H.load(index,opts), result=H.runSim(X,["grade5","grade5"],seed,{cap:3000000});
    return JSON.stringify({digest:lockstepDigest(X),snapshot:result.snap,winner:result.winner,phase:result.phase,turns:result.turns,winType:result.winType,steps:result.steps,viol:result.viol});
  };
  for(const seed of [24501,24502]) ok(trace({html:baseHtml},seed)===trace({},seed),"seed "+seed+" snapshot/digest/winner matches the pre-split baseline");
}

console.log(`\n=== smoke_issue245: pass ${pass} / fail ${fail} ===`);
if(fail) process.exit(1);
