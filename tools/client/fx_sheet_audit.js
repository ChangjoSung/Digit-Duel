/* #335 4번 대표기 런타임 시트 33장 정량 감사 — 읽기 전용, 외부 의존성 없음 (Node 22+)
   사용: node tools/client/fx_sheet_audit.js [--dir demo/assets/fx] [--json <out.json>]
   기대 목록은 손으로 적지 않는다: demo/js/data.js 의 V2_SPECIES_DEF(일반 30종 <속성>_<아키타입>) + 전설 3종(dragon·witch·reaper).
   판정 (시트마다):
     G1 파일 존재 · 기대 목록 밖 PNG 없음      G2 768×96 · 8비트 RGBA · 비인터레이스
     G3 크기 ≤ 80KB                              G4 F8 알파합 0 (완전 투명)
     G5 F7 알파 질량 ≤ 최대 프레임의 5% (PD-Errata 정의: 프레임별 alpha 합의 최대 프레임 대비 비율 — 최대 픽셀 alpha 와 다르다)
     G6 각 셀 사방 4px 안전 여백 alpha 0          G7 F4 가 알파 질량 최대 프레임(정점)
     G8 F1~F4 에 그림이 있다 (빈 시트·잘린 시트 방지)
   F7 최대 채널 알파는 같은 5% 게이트가 아니라 참고값으로만 기록한다. 종료 코드: 실패 0 이면 0, 아니면 1. */
"use strict";
const fs=require("fs"), path=require("path"), zlib=require("zlib");
const ROOT=path.resolve(__dirname,"..","..");

function png(file){ // 8비트 RGBA·비인터레이스만 픽셀을 푼다 (아니면 rgba:false)
  const b=fs.readFileSync(file); if(b.length<8||b.readUInt32BE(0)!==0x89504e47) return null;
  let o=8, w=0, h=0, depth=0, ct=0, il=0; const idat=[];
  while(o<b.length){ const n=b.readUInt32BE(o), t=b.toString("ascii",o+4,o+8), d=b.subarray(o+8,o+8+n);
    if(t==="IHDR"){ w=d.readUInt32BE(0); h=d.readUInt32BE(4); depth=d[8]; ct=d[9]; il=d[12]; } else if(t==="IDAT") idat.push(d); else if(t==="IEND") break; o+=12+n; }
  if(depth!==8||ct!==6||il!==0) return {w,h,rgba:false};
  const raw=zlib.inflateSync(Buffer.concat(idat)), bpp=4, stride=w*bpp, px=Buffer.alloc(h*stride);
  for(let y=0;y<h;y++){ const f=raw[y*(stride+1)], line=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1)), out=px.subarray(y*stride,(y+1)*stride), up=y?px.subarray((y-1)*stride,y*stride):null;
    for(let x=0;x<stride;x++){ const a=x>=bpp?out[x-bpp]:0, u=up?up[x]:0, c=(up&&x>=bpp)?up[x-bpp]:0, p=a+u-c, pa=Math.abs(p-a), pb=Math.abs(p-u), pc=Math.abs(p-c);
      out[x]=(line[x]+(f===1?a:f===2?u:f===3?((a+u)>>1):f===4?(pa<=pb&&pa<=pc?a:pb<=pc?u:c):0))&255; } }
  return {w,h,rgba:true,alpha:(x,y)=>px[(y*w+x)*4+3]};
}
function expectedKeys(){
  const src=fs.readFileSync(path.join(ROOT,"demo","js","data.js"),"utf8");
  const normal=[...src.matchAll(/\["(M-[FWGLE][1-6])","[^"]+","(\w+)","(\w+)"/g)].map(m=>({id:m[1]+"-4",key:m[2]+"_"+m[3]}));
  return normal.concat([["L-DRAGON-4","dragon"],["L-WITCH-4","witch"],["L-REAPER-4","reaper"]].map(([id,key])=>({id,key})));
}
function auditSheet(file){
  const r={file:path.basename(file),bytes:fs.statSync(file).size,gates:{}}, p=png(file);
  r.gates.G2=!!(p&&p.rgba&&p.w===768&&p.h===96); r.gates.G3=r.bytes<=80*1024;
  if(!r.gates.G2) return r;
  const mass=[], maxA=[]; let marginLeak=0;
  for(let fr=0;fr<8;fr++){ let s=0, m=0;
    for(let y=0;y<96;y++) for(let x=0;x<96;x++){ const a=p.alpha(fr*96+x,y); s+=a; if(a>m) m=a; if(a&&(x<4||x>91||y<4||y>91)) marginLeak++; }
    mass.push(s); maxA.push(m); }
  const peak=Math.max(...mass);
  Object.assign(r,{frameAlphaMass:mass,frameMaxAlpha:maxA,peakFrame:mass.indexOf(peak)+1,f7MassRatio:peak?+(mass[6]/peak).toFixed(4):null,f7MaxAlpha:maxA[6],marginLeakPx:marginLeak});
  r.gates.G4=mass[7]===0; r.gates.G5=peak>0&&mass[6]/peak<=0.05; r.gates.G6=marginLeak===0; r.gates.G7=r.peakFrame===4; r.gates.G8=mass.slice(0,4).every(n=>n>0);
  return r;
}
function audit(dir){
  const want=expectedKeys(), files=fs.readdirSync(dir).filter(f=>/\.png$/i.test(f));
  const extra=files.filter(f=>!want.some(w=>w.key+"_96x8.png"===f));
  const rows=want.map(w=>{ const f=path.join(dir,w.key+"_96x8.png"); if(!fs.existsSync(f)) return {id:w.id,key:w.key,gates:{G1:false}};
    return Object.assign({id:w.id,key:w.key},auditSheet(f),{}); });
  for(const r of rows) if(r.gates.G1===undefined) r.gates=Object.assign({G1:true},r.gates);
  const failed=rows.filter(r=>Object.values(r.gates).some(v=>!v));
  return {dir:path.relative(ROOT,dir).replace(/\\/g,"/")||".",expected:want.length,files:files.length,extra,rows,failed:failed.map(r=>({key:r.key,gates:Object.keys(r.gates).filter(k=>!r.gates[k])}))};
}
module.exports={png,audit,expectedKeys};
if(require.main===module){
  const args=process.argv.slice(2), opt=(k,d)=>{ const i=args.indexOf(k); return i>=0?args[i+1]:d; };
  const rep=audit(path.resolve(opt("--dir",path.join(ROOT,"demo","assets","fx"))));
  for(const r of rep.rows) console.log(`${Object.values(r.gates).every(Boolean)?"PASS":"FAIL"} ${r.id.padEnd(11)} ${r.key.padEnd(18)} ${String(r.bytes||"-").padStart(6)}B peak F${r.peakFrame||"-"} F7 ${r.f7MassRatio} F7maxA ${r.f7MaxAlpha} F8 ${r.frameAlphaMass?r.frameAlphaMass[7]:"-"} margin ${r.marginLeakPx}`);
  console.log(`expected ${rep.expected} · files ${rep.files} · extra ${JSON.stringify(rep.extra)} · failed ${JSON.stringify(rep.failed)}`);
  const out=opt("--json",null); if(out) fs.writeFileSync(out,JSON.stringify(rep,null,1));
  process.exit(rep.failed.length||rep.extra.length?1:0);
}
