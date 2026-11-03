'use strict';
// #401 v0.4.17 — 정적 자산 버전 경로 /b/<rev>/.
// 현재 rev 의 비HTML 정적 파일만 immutable, 옛 rev 는 현재 바이트 + no-cache·내용 ETag(304), 나머지(HTML·버전 없는 경로·오류)는 no-store 유지.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const S = require('../../security');
const { server, ROOT, STATIC } = require('../server');
const H = require('./helpers');
const { ok, done } = H.makeCounter('static-revision');

const IMMUTABLE = 'public, max-age=31536000, immutable';
const OLD = 'f'.repeat(32) === STATIC.rev ? 'e'.repeat(32) : 'f'.repeat(32);

function request(port, p, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: opts.method || 'GET', path: p,
      headers: Object.assign({ Host: `127.0.0.1:${port}` }, opts.headers || {}) }, (res) => {
      const c = [];
      res.on('data', (d) => c.push(d));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(c) }));
    });
    req.on('error', reject);
    req.end();
  });
}

function revisionContract() {
  ok(/^[0-9a-f]{32}$/.test(STATIC.rev), 'rev 는 32자 hex: ' + STATIC.rev);
  ok(S.staticRevision(ROOT).rev === STATIC.rev, '같은 트리 → 같은 rev(결정적)');
  ok(STATIC.files.has('index.html') && STATIC.files.has('css/game.css') && STATIC.files.has('js/ui.js'), '서빙 파일이 해시 대상');
  ok(![...STATIC.files].some((f) => f.startsWith('test/') || f.split('/').some((s) => s.startsWith('.'))), 'test/·숨김 파일은 해시 대상 밖');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-rev-'));
  try {
    fs.mkdirSync(path.join(tmp, 'a'));
    fs.writeFileSync(path.join(tmp, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(tmp, 'a', 'x.png'), Buffer.from([1, 2, 3]));
    const r1 = S.staticRevision(tmp).rev;
    fs.writeFileSync(path.join(tmp, 'a', 'x.png'), Buffer.from([1, 2, 4]));
    const r2 = S.staticRevision(tmp).rev;
    ok(r2 !== r1, '바이트 1개가 바뀌면 rev 가 바뀐다');
    fs.renameSync(path.join(tmp, 'a', 'x.png'), path.join(tmp, 'a', 'y.png'));
    const r3 = S.staticRevision(tmp).rev;
    ok(r3 !== r2, '경로만 바뀌어도 rev 가 바뀐다');
    fs.mkdirSync(path.join(tmp, 'test'));
    fs.writeFileSync(path.join(tmp, 'test', 't.js'), 'x');
    fs.writeFileSync(path.join(tmp, '.hidden.png'), 'x');
    fs.writeFileSync(path.join(tmp, 'notes.txt'), 'x');
    ok(S.staticRevision(tmp).rev === r3, 'test/·숨김·서빙 밖 확장자는 rev 에 영향 없음');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

async function main() {
  revisionContract();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const cur = `/b/${STATIC.rev}/`;
  const disk = (rel) => fs.readFileSync(path.join(ROOT, rel));

  // 진입: / · /index.html · 옛 rev · 슬래시 없는 rev → 현재 rev 로 302(no-store, 쿼리 원문 보존)
  {
    const r = await request(port, '/?room=ABC123&x=%ZZ');
    ok(r.status === 302 && r.headers.location === cur + '?room=ABC123&x=%ZZ' && r.headers['cache-control'] === 'no-store', '/ → 302 현재 rev, 쿼리 원문 보존, no-store');
    const i = await request(port, '/index.html?a=1');
    ok(i.status === 302 && i.headers.location === cur + '?a=1', '/index.html → 302 현재 rev');
    const o = await request(port, `/b/${OLD}/?a=1`);
    ok(o.status === 302 && o.headers.location === cur + '?a=1', '옛 rev 페이지 → 302 현재 rev');
    const oi = await request(port, `/b/${OLD}/index.html`);
    ok(oi.status === 302 && oi.headers.location === cur, '옛 rev index.html → 302 현재 rev');
    const ns = await request(port, `/b/${STATIC.rev}`);
    ok(ns.status === 302 && ns.headers.location === cur, '슬래시 없는 /b/<rev> → 302 /b/<rev>/');
  }
  // 현재 rev 페이지: HTML 은 no-store
  {
    const r = await request(port, cur);
    ok(r.status === 200 && r.body.equals(disk('index.html')) && r.headers['cache-control'] === 'no-store' && !r.headers.etag, '/b/<rev>/ 200 index.html, no-store');
    ok(r.headers['content-security-policy'] === S.SECURITY_HEADERS['Content-Security-Policy'], '보안 헤더 유지');
    const i = await request(port, cur + 'index.html');
    ok(i.status === 200 && i.headers['cache-control'] === 'no-store', '/b/<rev>/index.html 200 no-store');
  }
  // 현재 rev 자산: immutable, 디스크 바이트 그대로
  const minionDir = path.join(ROOT, 'assets', 'minions');
  const sub = fs.readdirSync(minionDir).find((d) => fs.statSync(path.join(minionDir, d)).isDirectory());
  const png = `assets/minions/${sub}/${fs.readdirSync(path.join(minionDir, sub)).find((f) => /\.png$/.test(f))}`;
  for (const rel of ['css/game.css', 'js/ui.js', png]) {
    const r = await request(port, cur + rel);
    ok(r.status === 200 && r.body.equals(disk(rel)) && r.headers['cache-control'] === IMMUTABLE && r.headers['content-type'] === S.MIME[path.extname(rel)], `현재 rev ${rel} 200 immutable·바이트 일치`);
  }
  {
    const h = await request(port, cur + 'css/game.css', { method: 'HEAD' });
    ok(h.status === 200 && h.body.length === 0 && Number(h.headers['content-length']) === disk('css/game.css').length && h.headers['cache-control'] === IMMUTABLE, 'HEAD 현재 rev 자산 200·본문 없음');
  }
  // 옛 rev 자산: 현재 바이트, no-cache + 내용 ETag, If-None-Match → 304
  {
    const rel = 'css/game.css';
    const tag = '"' + crypto.createHash('sha256').update(disk(rel)).digest('hex') + '"';
    const r = await request(port, `/b/${OLD}/${rel}`);
    ok(r.status === 200 && r.body.equals(disk(rel)) && r.headers['cache-control'] === 'no-cache' && r.headers.etag === tag, '옛 rev 자산 200 no-cache·내용 ETag(immutable 아님)');
    const n1 = await request(port, `/b/${OLD}/${rel}`, { headers: { 'If-None-Match': tag } });
    ok(n1.status === 304 && n1.body.length === 0 && n1.headers.etag === tag, 'If-None-Match 일치 → 304 본문 없음');
    const n2 = await request(port, `/b/${OLD}/${rel}`, { headers: { 'If-None-Match': `"x", W/${tag}` } });
    ok(n2.status === 304, 'W/ 약한 ETag 목록 → 304');
    const n3 = await request(port, `/b/${OLD}/${rel}`, { headers: { 'If-None-Match': '"other"' } });
    ok(n3.status === 200 && n3.body.equals(disk(rel)), '불일치 → 200 전체');
    const c = await request(port, cur + rel, { headers: { 'If-None-Match': tag } });
    ok(c.status === 200 && c.headers['cache-control'] === IMMUTABLE, '현재 rev 는 재검증 없이 200 immutable');
  }
  // 거부: 해시 밖·잘못된 rev·없는 파일 → 404 no-store, 원문 경로 검사는 버전 없는 경로와 같은 판정
  {
    const testFile = fs.readdirSync(path.join(ROOT, 'test'), { recursive: true }).map(String).find((f) => /\.js$/.test(f));
    const t = await request(port, cur + 'test/' + testFile.split(path.sep).join('/'));
    ok(t.status === 404 && t.headers['cache-control'] === 'no-store', 'test/ 는 버전 경로에서 404');
    for (const p of ['/b/zzz/css/game.css', `/b/${STATIC.rev.toUpperCase()}/css/game.css`, cur + 'no-such.png', `/b/${OLD}/no-such.png`]) {
      const r = await request(port, p);
      ok(r.status === 404 && r.headers['cache-control'] === 'no-store', '404 no-store: ' + p);
    }
    for (const p of ['/%2e%2e/server/package.json', '/../server/security.js', '/.git/config', '/css/%252e.css', '/css/a%00.css', '/css/x:y.css']) {
      const plain = await request(port, p);
      const ver = await request(port, cur.slice(0, -1) + p);
      ok(ver.status === plain.status && ver.status !== 200 && ver.body.indexOf('digit-duel-server') === -1, `원문 경로 검사 동일 ${p}: ${plain.status}/${ver.status}`);
    }
  }
  // 기존 경로는 그대로 no-store
  for (const p of ['/css/game.css', '/healthz', '/no-such-file.png']) {
    const r = await request(port, p);
    ok(r.headers['cache-control'] === 'no-store' && !r.headers.etag, '버전 없는 경로 no-store 유지: ' + p + ' ' + r.status);
  }

  server.close();
  done();
}

main().catch((e) => { console.error(e); process.exitCode = 1; try { server.close(); } catch (x) { /* noop */ } });
