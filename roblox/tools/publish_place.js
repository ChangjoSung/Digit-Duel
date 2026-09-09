#!/usr/bin/env node
/* publish_place.js — build/DigitDual.rbxl 을 Open Cloud Place Publishing API 로 기존 경험에 게시한다.
   Studio 의 File → Publish to Roblox As… → Update existing experience 와 같은 결과.

   사용:
     환경변수  ROBLOX_API_KEY   API 키 ("Universe Places(Place Publishing) → Write" 권한 + 대상 경험 선택)
              ROBLOX_PLACE_ID  (선택) Place ID · Universe ID · Creator Hub/게임 링크 중 아무거나 — 없으면 roblox/roblox.config.json 의 placeId
     node roblox/tools/publish_place.js [--saved]     (--saved: 게시 대신 저장본만 올림)

   Node 18+, 외부 의존성 없음. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const RBXL = path.join(ROOT, 'roblox', 'build', 'DigitDual.rbxl');
const CONFIG = path.join(ROOT, 'roblox', 'roblox.config.json');
const KEY = process.env.ROBLOX_API_KEY;
const SAVED = process.argv.includes('--saved');

async function getJson(url, headers) {
  const r = await fetch(url, { headers });
  const t = await r.text();
  return { ok: r.ok, status: r.status, body: t, json: (() => { try { return JSON.parse(t); } catch { return null; } })() };
}

// 입력(숫자·링크)에서 place/universe 를 확정 — place 우선, 아니면 universe → rootPlace
async function resolveIds(raw) {
  const m = String(raw).match(/(\d{6,})/);
  if (!m) throw new Error('ID 를 찾을 수 없습니다: ' + raw);
  const id = m[1];
  const asPlace = await getJson(`https://apis.roblox.com/universes/v1/places/${id}/universe`);
  if (asPlace.ok && asPlace.json && asPlace.json.universeId) return { placeId: id, universeId: String(asPlace.json.universeId) };
  const asUni = await getJson(`https://apis.roblox.com/cloud/v2/universes/${id}`, { 'x-api-key': KEY });
  if (asUni.ok && asUni.json && asUni.json.rootPlace) {
    const rp = String(asUni.json.rootPlace).match(/places\/(\d+)/);
    if (rp) return { placeId: rp[1], universeId: id, name: asUni.json.displayName, visibility: asUni.json.visibility };
  }
  throw new Error(`${id} 는 Place 도 Universe 도 아닙니다 (place 조회 ${asPlace.status} / universe 조회 ${asUni.status})`);
}

async function main() {
  if (!KEY) {
    console.error('ROBLOX_API_KEY 환경변수가 필요합니다.');
    console.error('  키 권한: https://create.roblox.com/dashboard/credentials → 키 편집 → Universe Places(Place Publishing) Write + 경험 선택');
    process.exit(2);
  }
  if (!fs.existsSync(RBXL)) {
    console.error('build/DigitDual.rbxl 이 없습니다 — 먼저 roblox\\build.bat 을 실행하세요.');
    process.exit(2);
  }
  let raw = process.env.ROBLOX_PLACE_ID;
  if (!raw && fs.existsSync(CONFIG)) raw = JSON.parse(fs.readFileSync(CONFIG, 'utf8')).placeId;
  if (!raw) {
    console.error('ROBLOX_PLACE_ID 환경변수 또는 roblox/roblox.config.json 의 placeId 가 필요합니다.');
    process.exit(2);
  }
  const ids = await resolveIds(raw);
  console.log(`place ${ids.placeId} → universe ${ids.universeId}${ids.name ? ' (' + ids.name + ')' : ''} · ${SAVED ? 'Saved' : 'Published'} 로 올립니다`);

  const body = fs.readFileSync(RBXL);
  const res = await fetch(`https://apis.roblox.com/universes/v1/${ids.universeId}/places/${ids.placeId}/versions?versionType=${SAVED ? 'Saved' : 'Published'}`, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'Content-Type': 'application/octet-stream' },
    body,
  });
  const text = await res.text();
  if (res.status === 401) throw new Error('401 — API 키가 만료됐거나 잘못됐습니다. Creator Hub 에서 Regenerate 후 다시 실행하세요.');
  if (res.status === 403) throw new Error('403 — 키에 Universe Places(Place Publishing) Write 권한이 없거나 이 경험이 키 범위에 없습니다.');
  if (!res.ok) throw new Error(`게시 실패 ${res.status}: ${text}`);
  const j = JSON.parse(text);
  console.log(`완료 — versionNumber ${j.versionNumber} (${(body.length / 1024).toFixed(1)} KB)`);
  console.log(`  플레이: https://www.roblox.com/games/${ids.placeId}`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
