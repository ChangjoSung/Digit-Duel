#!/usr/bin/env node
/* publish_place.js — build/DigitDual.rbxl 을 Open Cloud Place Publishing API 로 기존 경험에 게시한다.
   Studio 의 File → Publish to Roblox As… → Update existing experience 와 같은 결과.

   사용:
     환경변수  ROBLOX_API_KEY   API 키에 "Universe Places(Place Publishing) → Write" 권한 + 대상 경험을 추가해 둘 것
              ROBLOX_PLACE_ID  경험 페이지 URL 의 숫자 (roblox.com/games/<PLACE_ID>/...)
     node roblox/tools/publish_place.js [--saved]     (--saved: 게시 대신 저장본만 올림)

   universeId 는 placeId 로 자동 조회한다. Node 18+, 외부 의존성 없음. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const RBXL = path.join(ROOT, 'roblox', 'build', 'DigitDual.rbxl');
const KEY = process.env.ROBLOX_API_KEY;
const PLACE = process.env.ROBLOX_PLACE_ID;
const SAVED = process.argv.includes('--saved');

async function main() {
  if (!KEY || !PLACE) {
    console.error('ROBLOX_API_KEY 와 ROBLOX_PLACE_ID 환경변수가 필요합니다.');
    console.error('  키 권한: https://create.roblox.com/dashboard/credentials → 키 편집 → Universe Places(Place Publishing) Write + 경험 선택');
    process.exit(2);
  }
  if (!fs.existsSync(RBXL)) {
    console.error('build/DigitDual.rbxl 이 없습니다 — 먼저 roblox\\build.bat 을 실행하세요.');
    process.exit(2);
  }
  const uRes = await fetch(`https://apis.roblox.com/universes/v1/places/${PLACE}/universe`);
  if (!uRes.ok) throw new Error(`universe 조회 실패 ${uRes.status}: ${await uRes.text()}`);
  const { universeId } = await uRes.json();
  if (!universeId) throw new Error('universeId 없음 — placeId 를 확인하세요');
  console.log(`place ${PLACE} → universe ${universeId} · ${SAVED ? 'Saved' : 'Published'} 로 올립니다`);

  const body = fs.readFileSync(RBXL);
  const res = await fetch(`https://apis.roblox.com/universes/v1/${universeId}/places/${PLACE}/versions?versionType=${SAVED ? 'Saved' : 'Published'}`, {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'Content-Type': 'application/octet-stream' },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`게시 실패 ${res.status}: ${text}`);
  const j = JSON.parse(text);
  console.log(`완료 — versionNumber ${j.versionNumber} (${(body.length / 1024).toFixed(1)} KB)`);
  console.log(`  플레이: https://www.roblox.com/games/${PLACE}`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
