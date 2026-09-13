/* #217 공개 대전(인증 서버) 원클릭 실행기 회귀 — server/test-launcher.js(#75)와 같은 계약을 새 실행기에 적용한다.
 *
 * 계약: 공개서버시작.bat 은 언제나 로컬 전용, 공개LAN서버시작.bat 은 언제나 LAN 이고, 두 파일 모두 호출자가 준 인자를
 * 읽지도 출력하지도 authoritative\server.js 에 넘기지도 않는다. 기존 릴레이 실행기(서버시작.bat·LAN서버시작.bat)는
 * 이 테스트 대상이 아니다(server/test-launcher.js가 그대로 검증한다).
 *
 * 진짜 서버는 띄우지 않는다. 공백과 한글이 섞인 임시 폴더에 실행기를 복사하고 argv 를 찍는 스텁
 * authoritative/server.js 를 둔다. Windows 전용이라 다른 OS 에서는 SKIP 하고 종료 코드 0 으로 끝난다.
 */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

if (process.platform !== 'win32') {
  console.log('SKIP  test-launcher-authoritative.js — Windows 전용 배치 실행기 회귀 (현재: ' + process.platform + ')');
  process.exit(0);
}

const SRC = path.join(__dirname, '..', '..');
const LOCAL_BAT = '공개서버시작.bat';
const LAN_BAT = '공개LAN서버시작.bat';
const MARKER = 'DD_INJECTED_MARKER';
const MARKER_FILE = 'dd_injected_marker.txt';

let failed = 0, passed = 0;
function check(name, cond, detail) {
  if (cond) { passed++; return; }
  failed++;
  console.log('  FAIL ' + name + (detail ? '\n       ' + String(detail).replace(/\n/g, '\n       ') : ''));
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-auth-launcher-'));
try {
  const dir = path.join(root, '공개 서버 폴더 with space');
  fs.mkdirSync(dir);
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.mkdirSync(path.join(dir, 'authoritative'));
  for (const f of [LOCAL_BAT, LAN_BAT]) fs.copyFileSync(path.join(SRC, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'authoritative', 'server.js'), [
    "const args = process.argv.slice(2);",
    "console.log('STUB_AUTH_ARGV=' + JSON.stringify(args));",
    "console.log('STUB_DD_LAN=' + JSON.stringify(process.env.DD_LAN === undefined ? null : process.env.DD_LAN));",
    "console.log('STUB_CWD=' + JSON.stringify(process.cwd()));",
    "process.exit(Number(process.env.STUB_EXIT || 0));",
    '',
  ].join('\n'));
  // 릴레이 스텁도 둔다 — 공개 실행기가 실수로 릴레이를 띄우면 드러난다
  fs.writeFileSync(path.join(dir, 'server.js'), "console.log('STUB_RELAY_STARTED'); process.exit(0);\n");

  function run(bat, args, env) {
    const list = args || [];
    for (const a of list) if (a.indexOf('"') !== -1) throw new Error('harness: 인자에 따옴표를 넣지 않는다: ' + a);
    const extra = list.map((a) => '"' + a + '"').join(' ');
    const line = '""' + path.join(dir, bat) + '"' + (extra ? ' ' + extra : '') + '"';
    const r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', line], {
      cwd: os.tmpdir(), input: '', encoding: 'utf8', windowsVerbatimArguments: true,
      env: Object.assign({}, process.env, { DD_LAN: undefined }, env || {}),
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const m = /STUB_AUTH_ARGV=(\[.*\])/.exec(out);
    return { code: r.status, out, argv: m ? JSON.parse(m[1]) : null };
  }
  const markerFileExists = () => fs.existsSync(path.join(dir, MARKER_FILE));
  const clearMarkerFile = () => fs.rmSync(path.join(dir, MARKER_FILE), { force: true });

  const IGNORED_ARGS = [
    { label: '평범한 인자 1개', args: ['--wan'] },
    { label: '인자 여러 개', args: ['--lan', '--lan', '--wan'] },
    { label: '빈 인자 1개', args: [''] },
    { label: '빈 인자로 자리를 메운 뒤 붙인 인자', args: ['', '--wan'] },
    { label: 'cmd 메타 문자 (&)', args: ['& echo ' + MARKER] },
    { label: 'cmd 메타 문자 (|)', args: ['| echo ' + MARKER] },
    { label: 'cmd 메타 문자 (리다이렉트)', args: ['& echo ' + MARKER + '> ' + MARKER_FILE] },
    { label: 'cmd 메타 문자 (^ 와 미정의 %VAR%)', args: ['^& echo %DD_NOT_A_VAR% ' + MARKER] },
  ];

  {
    const r = run(LOCAL_BAT, []);
    check('공개 로컬: 종료 코드 0', r.code === 0, 'code=' + r.code + '\n' + r.out);
    check('공개 로컬: 인증 서버를 인자 없이 기동', Array.isArray(r.argv) && r.argv.length === 0, JSON.stringify(r.argv) + '\n' + r.out);
    check('공개 로컬: 릴레이를 띄우지 않음', !/STUB_RELAY_STARTED/.test(r.out), r.out);
    check('공개 로컬: 배너가 로컬 전용', /LOCAL ONLY/.test(r.out) && !/--lan/.test(r.out), r.out);
    check('공개 로컬: DD_LAN 미설정', /STUB_DD_LAN=null/.test(r.out), r.out);
    check('공개 로컬: 실행기 폴더로 이동', r.out.indexOf('STUB_CWD=' + JSON.stringify(dir)) !== -1, r.out);
    check('공개 로컬: node_modules 있으면 설치 건너뜀', !/Installing dependencies/.test(r.out), r.out);
  }
  {
    const r = run(LAN_BAT, []);
    check('공개 LAN: 종료 코드 0', r.code === 0, 'code=' + r.code + '\n' + r.out);
    check('공개 LAN: --lan 정확히 하나', JSON.stringify(r.argv) === '["--lan"]', JSON.stringify(r.argv) + '\n' + r.out);
    check('공개 LAN: 릴레이를 띄우지 않음', !/STUB_RELAY_STARTED/.test(r.out), r.out);
    check('공개 LAN: 배너가 LAN', /LAN - same router only/.test(r.out), r.out);
    check('공개 LAN: DD_LAN 환경 변수 미설정', /STUB_DD_LAN=null/.test(r.out), r.out);
    check('공개 LAN: 실행기 폴더로 이동', r.out.indexOf('STUB_CWD=' + JSON.stringify(dir)) !== -1, r.out);
  }
  for (const [bat, want, label] of [[LOCAL_BAT, '[]', '공개 로컬'], [LAN_BAT, '["--lan"]', '공개 LAN']]) {
    for (const c of IGNORED_ARGS) {
      clearMarkerFile();
      const r = run(bat, c.args);
      const detail = 'args=' + JSON.stringify(c.args) + ' code=' + r.code + ' argv=' + JSON.stringify(r.argv) + '\n' + r.out;
      check(label + ' — ' + c.label + ': 고정 인자로 기동', r.code === 0 && JSON.stringify(r.argv) === want, detail);
      check(label + ' — ' + c.label + ': 표식 명령 미실행', r.out.indexOf(MARKER) === -1 && !markerFileExists(), detail);
    }
  }
  clearMarkerFile();
  {
    const r = run(LOCAL_BAT, [], { STUB_EXIT: '3' });
    check('공개 로컬: 종료 코드 전파·안내', r.code === 3 && /Server exited with code 3/.test(r.out), 'code=' + r.code + '\n' + r.out);
    const r2 = run(LAN_BAT, [], { STUB_EXIT: '4' });
    check('공개 LAN: 종료 코드 전파·안내', r2.code === 4 && /Server exited with code 4/.test(r2.out), 'code=' + r2.code + '\n' + r2.out);
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

console.log(`launcher-authoritative: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
