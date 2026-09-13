'use strict';
/* #217 WAN 배포 준비(Jupiter deploy-readiness) 회귀.
 *
 * 실제 Render 서비스는 만들지 않는다 — 여기서 검증하는 것은 이 저장소의 코드가
 * "PORT 를 플랫폼이 주입한다 / 소켓 피어가 항상 리버스 프록시다"라는 배포 형태를 opt-in
 * 상태에서 올바르게 다루고, opt-in 하지 않으면 기존 로컬/LAN 동작이 그대로라는 것이다.
 *
 * (1) 순수 판정 — 같은 프로세스에서 매 케이스 전에 require 캐시를 비우고 env를 바꿔 재요구한다.
 *     (module.exports.server 를 listen 하지 않으므로 포트를 열지 않는다 — 안전하다.)
 * (2) 기동 fail-closed/성공 — test-config.js 와 같은 패턴으로 authoritative/server.js 를 자식
 *     프로세스로 실제 기동해 종료 코드·리스닝 여부·로그 문구를 확인한다.
 * (3) 프록시 뒤 통합 — 공개 배포 모드로 띄운 실서버에 리버스 프록시가 전달했을 법한
 *     Host/Origin 헤더로 실제 HTTP 요청을 보내 허용/거부를 확인한다.
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

let failures = 0;
function ok(cond, label) {
  if (cond) return true;
  failures += 1;
  console.error('  FAIL:', label);
  return false;
}
const eq = (actual, expected, label) => ok(actual === expected, `${label} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
const section = (name) => console.log('-', name);

const MODULE_PATH = require.resolve('../server');

function withEnv(env, fn) {
  const saved = {};
  for (const k of Object.keys(env)) saved[k] = process.env[k];
  Object.assign(process.env, env);
  delete require.cache[MODULE_PATH];
  try {
    return fn(require('../server'));
  } finally {
    delete require.cache[MODULE_PATH];
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
}

/* ===== 1. 순수 판정 (같은 프로세스, listen 하지 않음) ===== */

function unitTests() {
  section('peerAllowed — 공개 배포 옵트인만 소켓 피어 IP 검사를 건너뛴다');
  withEnv({ DD_AUTH_PUBLIC_DEPLOY: '', DD_LAN: '' }, (m) => {
    eq(m.PUBLIC_DEPLOY, false, '기본값 — 공개 배포 아님');
    eq(m.peerAllowed('127.0.0.1'), true, '기본값 — 루프백 허용');
    eq(m.peerAllowed('203.0.113.5'), false, '기본값 — 공인 IP 거부(피어 검사 그대로)');
  });
  withEnv({ DD_AUTH_PUBLIC_DEPLOY: '1', DD_LAN: '' }, (m) => {
    eq(m.PUBLIC_DEPLOY, true, '옵트인 — 플래그 반영');
    eq(m.peerAllowed('203.0.113.5'), true, '옵트인 — 리버스 프록시(공인 IP로 보이는 피어)도 통과');
    eq(m.peerAllowed('127.0.0.1'), true, '옵트인 — 루프백도 여전히 통과');
  });
  withEnv({ DD_AUTH_PUBLIC_DEPLOY: '', DD_LAN: '1' }, (m) => {
    eq(m.peerAllowed('203.0.113.5'), false, 'LAN 옵트인만으로는 공인 IP 피어를 여전히 거부(별개 축)');
    eq(m.peerAllowed('192.168.1.5'), true, 'LAN 옵트인 — 사설 대역 피어 허용');
  });

  section('PORT 우선순위 — DD_AUTH_PORT > PORT(플랫폼 주입) > 8081');
  withEnv({ DD_AUTH_PORT: '', PORT: '' }, (m) => eq(m.PORT, 8081, '둘 다 미설정 — 기본 8081'));
  withEnv({ DD_AUTH_PORT: '', PORT: '9500' }, (m) => eq(m.PORT, 9500, 'PORT만 설정(Render 방식) — PORT 사용'));
  withEnv({ DD_AUTH_PORT: '9600', PORT: '' }, (m) => eq(m.PORT, 9600, 'DD_AUTH_PORT만 설정 — 기존 동작'));
  withEnv({ DD_AUTH_PORT: '9600', PORT: '9500' }, (m) => eq(m.PORT, 9600, '둘 다 설정 — DD_AUTH_PORT 우선(기존 로컬/LAN 문서·실행기 보존)'));
}

/* ===== 2. 실제 기동 — fail-closed / 성공 ===== */

function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['authoritative/server.js'], {
      cwd: path.join(__dirname, '..', '..'),
      env: {
        ...process.env,
        DD_AUTH_PORT: '', PORT: '0', DD_LAN: '0', DD_AUTH_BIND: '',
        DD_AUTH_PUBLIC_DEPLOY: '', DD_AUTH_PUBLIC_HOST: '',
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    const timer = setTimeout(() => { child.kill(); reject(new Error('기동이 끝나지 않았다: ' + out)); }, 15000);
    child.once('error', reject);
    let settled = false;
    child.stdout.on('data', () => {
      if (settled || !/listening/.test(out)) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: null, out, child });
    });
    child.once('exit', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, out, child: null });
    });
  });
}

const HOST = 'digit-duel-readiness-check.onrender.com';

async function abortTests() {
  section('기동 fail-closed');
  {
    const r = await startServer({ DD_AUTH_PUBLIC_DEPLOY: '1' });
    ok(r.code === 1 && !/listening/.test(r.out), 'PUBLIC_DEPLOY=1 + PUBLIC_HOST 없음 — 종료 코드 1, listen 안 함: ' + r.out);
    ok(/DD_AUTH_PUBLIC_HOST/.test(r.out), '이유를 안내: ' + r.out);
  }
  {
    const r = await startServer({ DD_AUTH_PUBLIC_HOST: 'https://' + HOST });
    ok(r.code === 1 && !/listening/.test(r.out), 'PUBLIC_HOST에 스킴 포함 — 종료 코드 1(옵트인 여부와 무관): ' + r.out);
  }
  {
    const r = await startServer({ DD_AUTH_PUBLIC_HOST: HOST + ':443' });
    ok(r.code === 1 && !/listening/.test(r.out), 'PUBLIC_HOST에 포트 포함 — 종료 코드 1: ' + r.out);
  }
  {
    const r = await startServer({ DD_AUTH_PUBLIC_HOST: '192.168.0.5' });
    ok(r.code === 1 && !/listening/.test(r.out), 'PUBLIC_HOST가 사설 주소 — 종료 코드 1: ' + r.out);
  }
}

function requestOnce(port, opts) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: '/healthz', headers: opts.headers || {} }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function acceptAndProxyTests() {
  section('정상 설정 — Render 방식(PORT만, DD_AUTH_PORT 미설정)으로 공개 배포 기동');
  const started = await startServer({ DD_AUTH_PUBLIC_DEPLOY: '1', DD_AUTH_PUBLIC_HOST: HOST, PORT: '0' });
  ok(started.code === null && /listening/.test(started.out), 'listen 성공: ' + started.out);
  ok(/공개 배포\(WAN\)/.test(started.out), '공개 배포 모드로 안내: ' + started.out);
  ok(/0\.0\.0\.0/.test(started.out), 'PUBLIC_DEPLOY 기본 바인드 — 0.0.0.0(DD_AUTH_BIND 미지정): ' + started.out);
  const m = /listening on [^:]+:(\d+)/.exec(started.out);
  ok(!!m, 'listening 로그에서 포트 파싱 가능: ' + started.out);
  const port = m && Number(m[1]);

  if (started.child && port) {
    try {
      // 리버스 프록시가 원본 Host/Origin을 그대로 전달했다고 가정한 요청.
      const good = await requestOnce(port, { headers: { Host: HOST, Origin: 'https://' + HOST } });
      ok(good.status === 200 && good.body === 'ok', '프록시가 전달한 실제 배포 Host/Origin — 200: ' + JSON.stringify(good));

      const badHost = await requestOnce(port, { headers: { Host: 'evil.example', Origin: 'https://evil.example' } });
      ok(badHost.status === 400, '허용 목록 밖 Host — 공개 배포 모드에서도 여전히 400: ' + JSON.stringify(badHost));

      const badOrigin = await requestOnce(port, { headers: { Host: HOST, Origin: 'https://evil.example' } });
      ok(badOrigin.status === 403, 'Host는 맞지만 다른 출처 Origin — 여전히 403: ' + JSON.stringify(badOrigin));

      // 프록시가 실제 클라이언트 주소를 담아 보냈다고 주장하는 헤더 — 신뢰(peerAllowed 우회 근거)로 쓰지 않는다.
      // 이 요청은 공개 배포 옵트인 자체로 이미 통과하므로, 헤더 유무가 결과를 바꾸지 않는다는 것만 확인한다.
      const spoofed = await requestOnce(port, { headers: { Host: HOST, Origin: 'https://' + HOST, 'X-Forwarded-For': '198.51.100.9' } });
      ok(spoofed.status === 200, '임의 X-Forwarded-For 유무가 결과를 바꾸지 않음(신뢰하지 않음): ' + JSON.stringify(spoofed));
    } finally {
      started.child.kill();
    }
  } else if (started.child) {
    started.child.kill();
  }

  section('정상 설정 — DD_AUTH_PORT 미설정 시 PORT(플랫폼 주입) 그대로 리슨');
  const chosen = 20000 + Math.floor(Math.random() * 20000);
  const r2 = await startServer({ PORT: String(chosen) });
  ok(r2.code === null && new RegExp(`:${chosen}\\b`).test(r2.out), `PORT=${chosen} 그대로 리슨(로컬 전용 모드): ` + r2.out);
  if (r2.child) r2.child.kill();

  section('정상 설정 — DD_AUTH_PORT가 PORT보다 우선(기존 로컬/LAN 실행기 보존)');
  const a = 20000 + Math.floor(Math.random() * 10000);
  const b = 30000 + Math.floor(Math.random() * 10000);
  const r3 = await startServer({ DD_AUTH_PORT: String(a), PORT: String(b) });
  ok(r3.code === null && new RegExp(`:${a}\\b`).test(r3.out) && !new RegExp(`:${b}\\b`).test(r3.out), `DD_AUTH_PORT(${a}) 사용, PORT(${b}) 무시: ` + r3.out);
  if (r3.child) r3.child.kill();
}

/* ===== 실행 ===== */

(async () => {
  try {
    unitTests();
    await abortTests();
    await acceptAndProxyTests();
  } catch (e) {
    failures += 1;
    console.error('  FAIL: 예외 —', e && e.stack || e);
  }
  if (failures) {
    console.error(`PUBLIC DEPLOY TESTS FAILED (${failures})`);
    process.exit(1);
  }
  console.log('ALL PUBLIC DEPLOY TESTS PASSED');
  process.exit(0);
})();
