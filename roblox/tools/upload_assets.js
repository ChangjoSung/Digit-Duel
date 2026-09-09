#!/usr/bin/env node
/* upload_assets.js — 납품 manifest 의 자산을 Roblox Open Cloud Assets API 로 업로드하고
   roblox/assets/asset-ids.json 과 roblox/src/shared/AssetIds.luau 를 생성한다.

   소스 (인계서 §3 의 세 manifest 를 각각 규칙대로 읽는다 — 서로 섞지 않는다):
     roblox/assets/manifest.csv               PNG 전용 (하수인·토큰)  → 키 <kind>_<id>            → Image
     roblox/assets/lobby/manifest.csv         텍스처·UI → 키 lobby_<asset_id> → Image / 메시(fbx) → 키 lobbymesh_<name> → Model
     roblox/assets/tokens/model-manifest.csv  fbx 만   → 키 mesh_<id>           → Model  (obj/mtl 은 업로드하지 않는다)

   사용:
     환경변수  ROBLOX_API_KEY   (Assets API Read+Write)   ROBLOX_USER_ID 또는 ROBLOX_GROUP_ID
     node roblox/tools/upload_assets.js [--dry] [--force]

   - sha256 과 assetType 이 같은 항목은 건너뛴다 (idempotent). --force 는 전부 재업로드.
   - 이미지는 Image 자산(ImageLabel·MeshPart.TextureID 에 그대로 사용 가능), FBX 는 Model 자산(서버 InsertService:LoadAsset).
   - Node 18+, 외부 의존성 없음. 업로드된 이미지는 검수(moderation)를 거친다 (보통 수 분). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..'); // client 저장소 루트
const IDS_JSON = path.join(ROOT, 'roblox', 'assets', 'asset-ids.json');
const LUAU_OUT = path.join(ROOT, 'roblox', 'src', 'shared', 'AssetIds.luau');
const API = 'https://apis.roblox.com/assets/v1';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const FORCE = args.has('--force');
const KEY = process.env.ROBLOX_API_KEY;
const USER_ID = process.env.ROBLOX_USER_ID;
const GROUP_ID = process.env.ROBLOX_GROUP_ID;

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 세 manifest → 업로드 항목 목록
function collectEntries() {
  const out = [];
  const add = (name, rel, type) => {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) throw new Error('파일 없음: ' + rel);
    out.push({ name, file, rel: rel.replace(/\\/g, '/'), type, sha256: sha256(fs.readFileSync(file)) });
  };
  // 1) 루트 PNG manifest — path 는 저장소 루트 기준
  const rootCsv = path.join(ROOT, 'roblox', 'assets', 'manifest.csv');
  for (const r of parseCsv(fs.readFileSync(rootCsv, 'utf8'))) {
    if (!/\.png$/i.test(r.path)) continue;
    add(`${r.kind}_${r.id}`, r.path, 'Image');
  }
  // 2) 로비 manifest — path 는 roblox/assets/lobby 기준
  const lobbyCsv = path.join(ROOT, 'roblox', 'assets', 'lobby', 'manifest.csv');
  if (fs.existsSync(lobbyCsv)) {
    for (const r of parseCsv(fs.readFileSync(lobbyCsv, 'utf8'))) {
      const rel = path.posix.join('roblox/assets/lobby', r.path);
      if (r.kind === 'mesh') {
        if (!/\.fbx$/i.test(r.path)) continue;
        add(`lobbymesh_${path.basename(r.path, path.extname(r.path))}`, rel, 'Model');
      } else if (r.kind === 'texture' || r.kind === 'ui') {
        if (!/\.png$/i.test(r.path)) continue;
        add(`lobby_${r.asset_id || path.basename(r.path, '.png')}`, rel, 'Image');
      }
    }
  }
  // 3) 토큰 모델 manifest — fbx 만
  const modelCsv = path.join(ROOT, 'roblox', 'assets', 'tokens', 'model-manifest.csv');
  if (fs.existsSync(modelCsv)) {
    for (const r of parseCsv(fs.readFileSync(modelCsv, 'utf8'))) {
      if (r.kind !== 'mesh' || !/\.fbx$/i.test(r.path)) continue;
      add(`mesh_${r.id}`, path.posix.join('roblox/assets/tokens', r.path), 'Model');
    }
  }
  const seen = new Set();
  for (const e of out) { if (seen.has(e.name)) throw new Error('키 중복: ' + e.name); seen.add(e.name); }
  return out;
}

async function api(url, opts, tries = 6) {
  for (let t = 1; ; t++) {
    const res = await fetch(url, { ...opts, headers: { 'x-api-key': KEY, ...(opts.headers || {}) } });
    if (res.status === 429 || res.status >= 500) {
      if (t >= tries) throw new Error(`${res.status} ${await res.text()}`);
      const wait = Math.min(30000, 1000 * 2 ** t);
      console.log(`    ↻ ${res.status} — ${wait / 1000}s 후 재시도`);
      await sleep(wait); continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  }
}

async function upload(entry) {
  const buf = fs.readFileSync(entry.file);
  const form = new FormData();
  form.append('request', JSON.stringify({
    assetType: entry.type,
    displayName: `DD ${entry.name.replace(/_/g, ' ')}`,
    description: `Digit Dual ${entry.name}`,
    creationContext: { creator: GROUP_ID ? { groupId: String(GROUP_ID) } : { userId: String(USER_ID) } },
  }));
  const mime = entry.type === 'Model' ? 'model/fbx' : 'image/png';
  form.append('fileContent', new Blob([buf], { type: mime }), path.basename(entry.file));
  const op = await api(`${API}/assets`, { method: 'POST', body: form });
  const opId = String(op.path || op.operationId || '').replace(/^operations\//, '');
  if (!opId) throw new Error('operation id 없음: ' + JSON.stringify(op));
  for (let i = 0; i < 60; i++) {
    const st = await api(`${API}/operations/${opId}`, { method: 'GET' });
    if (st.done) {
      if (st.error) throw new Error(JSON.stringify(st.error));
      const id = Number(st.response && st.response.assetId);
      if (!id) throw new Error('assetId 없음: ' + JSON.stringify(st));
      return id;
    }
    await sleep(1500);
  }
  throw new Error('operation 대기 시간 초과');
}

async function main() {
  const entries = collectEntries();
  const prev = fs.existsSync(IDS_JSON) ? JSON.parse(fs.readFileSync(IDS_JSON, 'utf8')) : { assets: {} };
  const assets = { ...(prev.assets || {}) };
  const todo = entries.filter(e => FORCE || !assets[e.name] || assets[e.name].sha256 !== e.sha256 || (assets[e.name].assetType || 'Decal') !== e.type);
  const byType = t => todo.filter(e => e.type === t).length;
  console.log(`manifest ${entries.length}개 · 업로드 대상 ${todo.length}개 (Image ${byType('Image')} · Model ${byType('Model')}) · 재사용 ${entries.length - todo.length}개`);
  if (DRY) { todo.forEach(e => console.log(`  ${e.type.padEnd(5)} ${e.name}  ${e.rel}`)); return; }
  if (!KEY || !(USER_ID || GROUP_ID)) {
    console.error('\nROBLOX_API_KEY 와 ROBLOX_USER_ID(또는 ROBLOX_GROUP_ID) 환경변수가 필요합니다.');
    process.exit(2);
  }
  let ok = 0, fail = 0;
  const queue = todo.slice();
  async function worker() {
    while (queue.length) {
      const e = queue.shift();
      try {
        const id = await upload(e);
        assets[e.name] = { assetId: id, assetType: e.type, sha256: e.sha256, file: e.rel };
        ok++;
        console.log(`  ✓ ${e.type.padEnd(5)} ${e.name} → ${id}`);
      } catch (err) {
        fail++;
        console.log(`  ✗ ${e.type.padEnd(5)} ${e.name}: ${err.message}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);

  const valid = new Set(entries.map(e => e.name));
  for (const k of Object.keys(assets)) if (!valid.has(k)) delete assets[k]; // manifest 에서 사라진 키 정리
  const out = {
    generatedAt: new Date().toISOString(),
    creator: GROUP_ID ? { groupId: String(GROUP_ID) } : { userId: String(USER_ID) },
    assets: Object.fromEntries(Object.keys(assets).sort().map(k => [k, assets[k]])),
  };
  fs.writeFileSync(IDS_JSON, JSON.stringify(out, null, 2) + '\n');
  const lines = [
    '--!strict',
    '-- AssetIds.luau — 생성 파일 (roblox/tools/upload_assets.js). 직접 수정하지 말 것.',
    `-- 생성 ${out.generatedAt} · 업로더 ${GROUP_ID ? 'group ' + GROUP_ID : 'user ' + USER_ID} · ${Object.keys(out.assets).length}개`,
    '-- 키: icon_/battle_/portrait_<종> · token64_/token128_<토큰> (Image) · lobby_<텍스처> (Image) · lobbymesh_<메시> · mesh_unknown (Model)',
    'return {',
    ...Object.entries(out.assets).map(([k, v]) => `\t${k} = ${v.assetId}, -- ${v.assetType}`),
    '} :: { [string]: number }',
    '',
  ];
  fs.writeFileSync(LUAU_OUT, lines.join('\n'));
  console.log(`\n완료: 성공 ${ok} · 실패 ${fail} · 총 ID ${Object.keys(out.assets).length}`);
  console.log(`  → ${path.relative(ROOT, IDS_JSON)}\n  → ${path.relative(ROOT, LUAU_OUT)}`);
  if (fail) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
