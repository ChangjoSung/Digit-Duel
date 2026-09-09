#!/usr/bin/env node
/* upload_assets.js — roblox/assets/manifest.csv 의 PNG 를 Roblox Open Cloud Assets API 로 업로드하고
   roblox/assets/asset-ids.json 과 roblox/src/shared/AssetIds.luau 를 생성한다.

   사용:
     환경변수  ROBLOX_API_KEY   Creator Hub → Open Cloud → API Keys 에서 만든 키 (Assets API: Read + Write)
              ROBLOX_USER_ID   업로드할 계정의 숫자 ID (roblox.com/users/<ID>/profile)  — 또는 ROBLOX_GROUP_ID
     node roblox/tools/upload_assets.js [--dry] [--force]

   - 재실행 시 sha256 이 같은 파일은 건너뛴다 (idempotent). --force 는 전부 재업로드.
   - Node 18+ (fetch/FormData 내장). 외부 의존성 없음.
   - 업로드된 이미지는 Roblox 검수(moderation)를 거친다 — 검수 완료 전에는 게임에서 빈 이미지로 보일 수 있다 (보통 수 분). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..', '..'); // client 저장소 루트
const MANIFEST = path.join(ROOT, 'roblox', 'assets', 'manifest.csv');
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
    assetType: 'Decal',
    displayName: `DD ${entry.name.replace(/_/g, ' ')}`,
    description: `Digit Dual ${entry.name}`,
    creationContext: { creator: GROUP_ID ? { groupId: String(GROUP_ID) } : { userId: String(USER_ID) } },
  }));
  form.append('fileContent', new Blob([buf], { type: 'image/png' }), path.basename(entry.file));
  const op = await api(`${API}/assets`, { method: 'POST', body: form });
  const opId = String(op.path || op.operationId || '').replace(/^operations\//, '');
  if (!opId) throw new Error('operation id 없음: ' + JSON.stringify(op));
  for (let i = 0; i < 40; i++) {
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
  const rows = parseCsv(fs.readFileSync(MANIFEST, 'utf8'));
  const entries = rows.map(r => {
    const file = path.join(ROOT, r.path);
    if (!fs.existsSync(file)) throw new Error('파일 없음: ' + r.path);
    return { name: `${r.kind}_${r.id}`, file, rel: r.path, sha256: sha256(fs.readFileSync(file)) };
  });
  const prev = fs.existsSync(IDS_JSON) ? JSON.parse(fs.readFileSync(IDS_JSON, 'utf8')) : { assets: {} };
  const assets = { ...(prev.assets || {}) };
  const todo = entries.filter(e => FORCE || !assets[e.name] || assets[e.name].sha256 !== e.sha256);

  console.log(`manifest ${entries.length}개 · 업로드 대상 ${todo.length}개 · 기존 ID ${entries.length - todo.length}개 재사용`);
  if (DRY) { todo.forEach(e => console.log('  ' + e.name + '  ' + e.rel)); return; }
  if (!KEY || !(USER_ID || GROUP_ID)) {
    console.error('\nROBLOX_API_KEY 와 ROBLOX_USER_ID(또는 ROBLOX_GROUP_ID) 환경변수가 필요합니다.');
    console.error('  API 키: https://create.roblox.com/dashboard/credentials → Create API Key → Assets API (Read, Write)');
    process.exit(2);
  }

  let ok = 0, fail = 0;
  const queue = todo.slice();
  async function worker() {
    while (queue.length) {
      const e = queue.shift();
      try {
        const id = await upload(e);
        assets[e.name] = { assetId: id, sha256: e.sha256, file: e.rel };
        ok++;
        console.log(`  ✓ ${e.name} → ${id}`);
      } catch (err) {
        fail++;
        console.log(`  ✗ ${e.name}: ${err.message}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);

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
    'return {',
    ...Object.entries(out.assets).map(([k, v]) => `\t${k} = ${v.assetId},`),
    '} :: { [string]: number }',
    '',
  ];
  fs.writeFileSync(LUAU_OUT, lines.join('\n'));
  console.log(`\n완료: 성공 ${ok} · 실패 ${fail} · 총 ID ${Object.keys(out.assets).length}`);
  console.log(`  → ${path.relative(ROOT, IDS_JSON)}\n  → ${path.relative(ROOT, LUAU_OUT)}`);
  console.log('다음: roblox\\build.bat 로 rbxl 재생성 → Studio 에서 열기 → File → Publish to Roblox As… → 기존 경험 선택');
  if (fail) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
