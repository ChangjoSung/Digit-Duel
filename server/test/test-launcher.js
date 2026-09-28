/* 단일 실행기 회귀 (#276, #75·#217 계약 승계) — server/LAN모드실행.bat 과 그 수명주기 소유 판정만 검증한다.
 *
 * 계약: 실행기는 고정 목적이다. 호출자가 준 인자를 읽지도 출력하지도 넘기지도 않고, 언제나
 * `node ..\tools\qa\issue260_local.js lan --issue262` 하나만 실행하며 그 종료 코드를 올려보낸다.
 * 의존성이 없으면 npm ci 를 돌리고, 실패하면 서버를 띄우지 않고 멈춘다.
 * 소유 판정: 도구는 이 checkout 의 server.js 로 뜬 프로세스만 재사용·정지하고, LAN(0.0.0.0) 리스너도 찾는다.
 * LAN HTTPS 인증서: 전용 leaf(CA 아님·serverAuth·정확한 SAN·90일)를 만들고 재사용·재발급을 가리며, 도구 없음·실패·신뢰 실패는 멈춘다.
 *
 * 진짜 서버·DB 는 띄우지 않는다. 공백과 한글이 섞인 임시 폴더에 실행기를 복사하고 argv 를 찍는 스텁
 * 도구와 스텁 npm 을 둔다. Windows 전용이라 다른 OS 에서는 SKIP 하고 종료 코드 0 으로 끝난다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.platform !== 'win32') {
  console.log('SKIP  test-launcher.js — Windows 전용 배치 실행기 회귀 (현재: ' + process.platform + ')');
  process.exit(0);
}

const BAT = 'LAN모드실행.bat';
const HELPER = path.join(__dirname, '..', '..', 'tools', 'qa', 'issue260_local.js');
const MARKER = 'DD_INJECTED_MARKER';
const MARKER_FILE = 'dd_injected_marker.txt';
const PATH_KEY = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';

let failed = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; return; }
  failed++;
  console.log('  FAIL ' + name + (detail ? '\n       ' + String(detail).replace(/\n/g, '\n       ') : ''));
}

/* 1) 소유 판정 — 실제 도구의 순수 함수 (require 해도 아무것도 띄우지 않는다) */
{
  const { listenerPid, ownsServer, SERVER_JS } = require(HELPER);
  const netstat = [
    '  TCP    0.0.0.0:18085          0.0.0.0:0              LISTENING       7',
    '  TCP    192.168.0.5:8085       192.168.0.9:50000      ESTABLISHED     8',
    '  TCP    0.0.0.0:8085           0.0.0.0:0              LISTENING       111',
    '  TCP    127.0.0.1:55462        0.0.0.0:0              LISTENING       222',
  ].join('\r\n');
  check('LAN(0.0.0.0) 리스너 PID', listenerPid(netstat, 8085) === 111, listenerPid(netstat, 8085));
  check('루프백 리스너 PID', listenerPid(netstat, 55462) === 222, listenerPid(netstat, 55462));
  check('없는 포트는 null (접두 포트·연결 행 무시)', listenerPid(netstat, 1808) === null && listenerPid(netstat, 50000) === null);
  const lan = ownsServer('"C:\\node.exe" ' + SERVER_JS + ' --lan');
  check('이 checkout 의 LAN 서버 = 소유·LAN', lan.ours && lan.lan, JSON.stringify(lan));
  const fwd = ownsServer('node "' + SERVER_JS.replace(/\\/g, '/').toUpperCase() + '"');
  check('슬래시·대소문자 차이도 소유, --lan 없으면 로컬', fwd.ours && !fwd.lan, JSON.stringify(fwd));
  check('다른 checkout 의 서버는 소유 아님', !ownsServer('node C:\\other\\server\\authoritative\\server.js --lan').ours);
  check('상대 경로로 뜬 서버는 소유 아님(출처 불명)', !ownsServer('node authoritative/server.js').ours);
  check('--lanx 는 LAN 아님', !ownsServer('node ' + SERVER_JS + ' --lanx').lan);
  check('따옴표로 감싼 경로도 소유', ownsServer('"C:\\Program Files\\nodejs\\node.exe" "' + SERVER_JS + '" --lan').ours);
  check('접미 경로(server.js.other)는 소유 아님', !ownsServer('node ' + SERVER_JS + '.other --lan').ours && !ownsServer('"node" "' + SERVER_JS + '.other"').ours);
  check('다른 스크립트의 뒷인자면 소유 아님', !ownsServer('node C:\\x\\other.js ' + SERVER_JS + ' --lan').ours);
}

/* 1b) LAN HTTPS 인증서 (#276) — 임시 폴더에서만 만든다. 신뢰 저장소에는 넣지 않고(읽기만) 서버도 띄우지 않는다 */
{
  const H = require(HELPER);
  const env = H.cleanEnv({ DD_AUTH_TLS_CERT: 'C:\\x.crt', DD_AUTH_TLS_KEY: 'C:\\x.key', DATABASE_URL: 'x', KEEP: '1' });
  check('물려받은 TLS·DB 설정은 버림', !('DD_AUTH_TLS_CERT' in env) && !('DD_AUTH_TLS_KEY' in env) && !('DATABASE_URL' in env) && env.KEEP === '1', JSON.stringify(env));
  const v4 = (address, internal) => ({ family: 'IPv4', address, internal: !!internal });
  const ips = H.lanIps({ '이더넷': [v4('192.168.3.30'), { family: 'IPv6', address: 'fe80::1', internal: false }], 'Wi-Fi': [{ family: 4, address: '10.0.0.7', internal: false }, v4('192.168.3.30')],
    'vEthernet (WSL)': [v4('172.20.112.1')], Tailscale: [v4('169.254.83.107')], lo: [v4('127.0.0.1', true)], pub: [v4('8.8.8.8')] });
  check('SAN 주소 = 쓸 수 있는 사설 IPv4 만 (가상 스위치·169.254·공인·루프백·IPv6 제외, 중복 제거)', JSON.stringify(ips) === '["10.0.0.7","192.168.3.30"]', JSON.stringify(ips));
  check('SAN 은 localhost·127.0.0.1·그 주소뿐 (와일드카드 없음)', JSON.stringify(H.wantSan(ips)) === '["DNS:localhost","IP Address:127.0.0.1","IP Address:10.0.0.7","IP Address:192.168.3.30"]');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-tls-'));
  try {
    const f = (n) => path.join(tmp, n);
    check('openssl 없음 = 실패·파일 없음', /openssl not found/.test(H.genCert(f('a.key'), f('a.crt'), ips, f('no-openssl.exe'))) && !fs.existsSync(f('a.key')) && !fs.existsSync(f('a.crt')));
    const bad = H.genCert(f('a.key'), f('a.crt'), ips, process.execPath); // 실패하는 도구
    check('도구 실패 = 실패·임시 파일 삭제', /openssl exit 1/.test(bad) && !fs.existsSync(f('a.key')) && !fs.existsSync(f('a.crt')), bad);
    if (!fs.existsSync(H.OPENSSL)) check('Git for Windows openssl 있음 (' + H.OPENSSL + ')', false);
    else {
      const made = H.genCert(f('a.key'), f('a.crt'), ips);
      const [c, k] = H.loadPair(f('a.crt'), f('a.key'));
      check('새 인증서: 만들고 검증 통과', made === null && c && H.certProblem(c, k, ips) === null, made);
      check('새 인증서: CA 아님·serverAuth·전용 CN·정확한 SAN', c && !c.ca && JSON.stringify(c.keyUsage) === '["1.3.6.1.5.5.7.3.1"]' && c.subject === 'CN=' + H.CERT_CN
        && c.subjectAltName === 'DNS:localhost, IP Address:127.0.0.1, IP Address:10.0.0.7, IP Address:192.168.3.30', c && c.subjectAltName);
      const days = c ? (Date.parse(c.validTo) - Date.parse(c.validFrom)) / 864e5 : 0;
      check('유효 기간 90일', days >= 89.9 && days <= 90.1, days);
      if (c) {
        check('주소가 바뀌면 재발급', H.certProblem(c, k, ['192.168.3.31']) === 'address change');
        check('만료 14일 전부터 재발급', H.certProblem(c, k, ips, Date.parse(c.validTo) - 13 * 864e5) === 'expiry' && H.certProblem(c, k, ips, Date.parse(c.validTo) - 15 * 864e5) === null);
        H.genCert(f('b.key'), f('b.crt'), ips);
        check('다른 키면 재발급', H.certProblem(c, H.loadPair(f('b.crt'), f('b.key'))[1], ips) === 'key mismatch');
        check('파일 없음·깨짐이면 재발급', H.certProblem(...H.loadPair(f('none.crt'), f('a.key')), ips) === 'missing');
        check('신뢰 추가 실패(도구 없음) = false', H.trust(c, f('a.crt'), f('no-certutil.exe')) === false);
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/* 2) 배치 실행기 — 스텁 트리에서 */
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-launcher-'));
try {
  const game = path.join(root, '게임 폴더 with space');
  const dir = path.join(game, 'server');
  fs.mkdirSync(path.join(game, 'tools', 'qa'), { recursive: true });
  fs.mkdirSync(dir);
  fs.copyFileSync(path.join(__dirname, '..', BAT), path.join(dir, BAT));
  fs.writeFileSync(path.join(game, 'tools', 'qa', 'issue260_local.js'), [
    "console.log('STUB_ARGV=' + JSON.stringify(process.argv.slice(2)));",
    "console.log('STUB_CWD=' + JSON.stringify(process.cwd()));",
    "process.exit(Number(process.env.STUB_EXIT || 0));",
    '',
  ].join('\n'));
  const deps = ['ws', 'pg', 'nodemailer'];
  for (const d of deps) {
    fs.mkdirSync(path.join(dir, 'node_modules', d), { recursive: true });
    fs.writeFileSync(path.join(dir, 'node_modules', d, 'package.json'), '{}');
  }
  // 스텁 npm: 불리면 표시를 찍고 실패한다 — 설치를 건너뛰었는지·실패 시 멈추는지 둘 다 본다
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'npm.cmd'), '@echo STUB_NPM %*\r\n@exit /b 1\r\n');

  function run(args, env) {
    const list = args || [];
    for (const a of list) if (a.indexOf('"') !== -1) throw new Error('harness: 인자에 따옴표를 넣지 않는다: ' + a);
    const extra = list.map((a) => '"' + a + '"').join(' ');
    const line = '""' + path.join(dir, BAT) + '"' + (extra ? ' ' + extra : '') + '"';
    const r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', line], {
      cwd: os.tmpdir(), input: '', encoding: 'utf8', windowsVerbatimArguments: true,
      env: Object.assign({}, process.env, { [PATH_KEY]: bin + ';' + process.env[PATH_KEY] }, env || {}),
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const m = /STUB_ARGV=(\[.*\])/.exec(out);
    return { code: r.status, out, argv: m ? JSON.parse(m[1]) : null };
  }
  const markerFileExists = () => fs.existsSync(path.join(dir, MARKER_FILE));
  const FIXED = '["lan","--issue262"]';

  {
    const r = run([]);
    check('더블클릭: 종료 코드 0', r.code === 0, 'code=' + r.code + '\n' + r.out);
    check('더블클릭: 도구를 lan --issue262 로만 실행', JSON.stringify(r.argv) === FIXED, JSON.stringify(r.argv) + '\n' + r.out);
    check('더블클릭: 실행기 폴더(server)에서 실행', r.out.indexOf('STUB_CWD=' + JSON.stringify(dir)) !== -1, r.out);
    check('더블클릭: 의존성이 있으면 npm 을 부르지 않음', !/STUB_NPM/.test(r.out), r.out);
    check('더블클릭: 배너가 LAN 모드·DB 유지 안내', /LAN mode/.test(r.out) && /keeps running/.test(r.out), r.out);
    check('더블클릭: 배너가 HTTPS·인증서 신뢰 안내', /https port 8085/.test(r.out) && /trust this server's certificate/.test(r.out), r.out);
  }
  for (const args of [['--wan'], ['--lan', '--lan', '--wan'], [''], ['', 'stop'], ['& echo ' + MARKER],
    ['| echo ' + MARKER], ['& echo ' + MARKER + '> ' + MARKER_FILE], ['^& echo %DD_NOT_A_VAR% ' + MARKER]]) {
    fs.rmSync(path.join(dir, MARKER_FILE), { force: true });
    const r = run(args);
    const detail = 'args=' + JSON.stringify(args) + ' code=' + r.code + '\n' + r.out;
    check('인자 ' + JSON.stringify(args) + ': 고정 인자로 실행', r.code === 0 && JSON.stringify(r.argv) === FIXED, detail);
    check('인자 ' + JSON.stringify(args) + ': 출력·실행 없음', r.out.indexOf(MARKER) === -1 && !markerFileExists() && !/--wan/.test(r.out), detail);
  }
  {
    const r = run([], { STUB_EXIT: '3' });
    check('도구 종료 코드 전파·안내', r.code === 3 && /Server exited with code 3/.test(r.out), 'code=' + r.code + '\n' + r.out);
  }
  {
    fs.rmSync(path.join(dir, 'node_modules', 'pg'), { recursive: true });
    const r = run([]);
    check('의존성 누락: npm ci 를 부름', /STUB_NPM ci/.test(r.out), r.out);
    check('npm ci 실패: 종료 코드 1·안내·서버 미실행', r.code === 1 && /npm ci failed/.test(r.out) && r.argv === null, 'code=' + r.code + '\n' + r.out);
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(`launcher: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
