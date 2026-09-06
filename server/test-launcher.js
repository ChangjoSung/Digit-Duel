/* 원클릭 실행기 회귀 (#75) — Windows 배치 실행기의 계약만 검증한다.
 *
 * 계약은 "실행기는 고정 목적 실행기다" 하나다. 서버시작.bat 은 언제나 로컬 전용,
 * LAN서버시작.bat 은 언제나 LAN 이고, 두 파일 모두 호출자가 준 인자를 읽지도
 * 출력하지도 server.js 에 넘기지도 않는다. 그래서 인자를 어떻게 주든 argv 와
 * 모드가 그대로여야 하고, 인자 안에 심은 명령이 실행돼서도 안 된다.
 *
 * 진짜 서버는 띄우지 않는다. 공백과 한글이 섞인 임시 폴더에 실행기를 복사한 뒤
 * argv 를 그대로 찍는 스텁 server.js 를 둔다. 포트를 열지 않으므로 이미 떠 있는
 * 서버(8080)와 무관하고, node_modules 를 미리 만들어 두어 npm install 도 타지 않는다.
 *
 * Windows 전용이라 다른 OS 에서는 SKIP 하고 종료 코드 0 으로 끝난다.
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

const SRC = __dirname;
const LOCAL_BAT = '서버시작.bat';
const LAN_BAT = 'LAN서버시작.bat';

/* 인자에 심어 두고 "실행되지 않았는지" 를 보는 표식. 실행기가 %1 을 echo 로
 * 펼치면 그 줄이 `echo ... & echo DD_INJECTED_MARKER` 로 갈라져 표식이 찍히거나,
 * 리다이렉트가 살아나 표식 파일이 생긴다. 둘 다 없어야 통과다. */
const MARKER = 'DD_INJECTED_MARKER';
const MARKER_FILE = 'dd_injected_marker.txt';

let failed = 0;
function check(name, cond, detail) {
  if (cond) { console.log('  ok   ' + name); return; }
  failed++;
  console.log('  FAIL ' + name + (detail ? '\n       ' + String(detail).replace(/\n/g, '\n       ') : ''));
}

/* 공백·한글이 함께 든 경로에서 인용이 깨지지 않는지까지 같이 본다.
 * root 를 만든 직후부터 finally 로 지우므로, 중간에 어떤 검사가 던져도
 * 임시 폴더가 남지 않는다. */
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dd-launcher-'));
try {
  const dir = path.join(root, '서버 폴더 with space');
  fs.mkdirSync(dir);
  fs.mkdirSync(path.join(dir, 'node_modules'));
  for (const f of [LOCAL_BAT, LAN_BAT]) fs.copyFileSync(path.join(SRC, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'server.js'), [
    "const args = process.argv.slice(2);",
    "console.log('STUB_ARGV=' + JSON.stringify(args));",
    "console.log('STUB_DD_LAN=' + JSON.stringify(process.env.DD_LAN === undefined ? null : process.env.DD_LAN));",
    "console.log('STUB_CWD=' + JSON.stringify(process.cwd()));",
    "process.exit(Number(process.env.STUB_EXIT || 0));",
    ''
  ].join('\n'));

  /* 호출 harness. 인자는 배열로 받아 각각 따옴표로 감싼 뒤 한 줄로 만든다.
   *
   * 이 인용이 harness 쪽 안전 장치다. cmd 는 따옴표 안의 & | < > ( ) 를 메타
   * 문자로 보지 않으므로, 표식이 실행된다면 그것은 바깥 cmd 가 아니라 실행기가
   * %1 을 펼친 결과다 — 테스트 잡음이 아니라 진짜 결함이다. 인자에 따옴표 자체는
   * 넣지 않는다(그 경우 인용 규칙이 깨져 무엇을 재는지 불분명해진다).
   *
   * 경로에 공백이 있으므로 `cmd /d /s /c ""<bat>" <args>"` 형태(바깥 따옴표
   * 한 겹 추가)로 감싼다. /s 는 바깥 따옴표만 벗기고 나머지는 그대로 쓴다. */
  function run(bat, args, env) {
    const list = args || [];
    for (const a of list) {
      if (a.indexOf('"') !== -1) throw new Error('harness: 인자에 따옴표를 넣지 않는다: ' + a);
    }
    const extra = list.map(function (a) { return '"' + a + '"'; }).join(' ');
    const line = '""' + path.join(dir, bat) + '"' + (extra ? ' ' + extra : '') + '"';
    const r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', line], {
      cwd: os.tmpdir(),          // 실행기가 스스로 %~dp0 로 이동하는지 확인
      input: '',                 // pause 가 EOF 로 즉시 통과
      encoding: 'utf8',
      windowsVerbatimArguments: true,
      env: Object.assign({}, process.env, { DD_LAN: undefined }, env || {}),
    });
    const out = (r.stdout || '') + (r.stderr || '');
    const m = /STUB_ARGV=(\[.*\])/.exec(out);
    return { code: r.status, out: out, argv: m ? JSON.parse(m[1]) : null };
  }

  /* 표식 파일은 실행기가 %~dp0 로 이동한 뒤 만들어지므로 dir 밑에서 찾는다. */
  function markerFileExists() {
    return fs.existsSync(path.join(dir, MARKER_FILE));
  }
  function clearMarkerFile() {
    fs.rmSync(path.join(dir, MARKER_FILE), { force: true });
  }

  /* 실행기가 인자를 어떻게 받아도 결과가 같아야 한다 — 평범한 인자, 빈 인자,
   * 빈 인자로 자리를 메운 뒤 붙인 인자, cmd 메타 문자를 닮은 인자. */
  const IGNORED_ARGS = [
    { label: '평범한 인자 1개', args: ['--wan'] },
    { label: '인자 여러 개', args: ['--lan', '--lan', '--wan'] },
    { label: '빈 인자 1개', args: [''] },
    { label: '빈 인자로 자리를 메운 뒤 붙인 인자', args: ['', '--wan'] },
    { label: '--lan 뒤에 빈 인자를 끼운 3개', args: ['--lan', '', '--wan'] },
    { label: 'cmd 메타 문자 (&)', args: ['& echo ' + MARKER] },
    { label: 'cmd 메타 문자 (|)', args: ['| echo ' + MARKER] },
    { label: 'cmd 메타 문자 (리다이렉트)', args: ['& echo ' + MARKER + '> ' + MARKER_FILE] },
    { label: 'cmd 메타 문자 (^ 와 미정의 %VAR%)', args: ['^& echo %DD_NOT_A_VAR% ' + MARKER] },
  ];

  console.log('원클릭 실행기 회귀 (#75)');
  console.log('  작업 폴더: ' + dir);

  /* 1) 로컬 실행기 더블클릭 = 로컬 전용. --lan 이 절대 붙지 않는다. */
  {
    const r = run(LOCAL_BAT, []);
    check('로컬 실행 종료 코드 0', r.code === 0, 'code=' + r.code + '\n' + r.out);
    check('로컬 실행이 server.js 에 인자를 넘기지 않음', Array.isArray(r.argv) && r.argv.length === 0, JSON.stringify(r.argv));
    check('로컬 실행 출력 어디에도 --lan 이 없음', !/--lan/.test(r.out), r.out);
    check('로컬 실행 배너가 로컬 전용임을 밝힘', /LOCAL ONLY/.test(r.out), r.out);
    check('로컬 실행이 DD_LAN 을 설정하지 않음', /STUB_DD_LAN=null/.test(r.out), r.out);
    check('로컬 실행이 실행기 폴더로 이동함', r.out.indexOf('STUB_CWD=' + JSON.stringify(dir)) !== -1, r.out);
    check('로컬: node_modules 가 있으면 설치를 건너뜀', !/Installing dependencies/.test(r.out), r.out);
  }

  /* 2) LAN 실행기 더블클릭 = --lan 정확히 하나. 로컬 실행기를 거치지 않는
   *    독립 실행기이므로 %~dp0 이동과 설치 건너뛰기를 따로 확인한다. */
  {
    const r = run(LAN_BAT, []);
    check('LAN 실행 종료 코드 0', r.code === 0, 'code=' + r.code + '\n' + r.out);
    check('LAN 실행이 --lan 을 정확히 하나 전달', JSON.stringify(r.argv) === '["--lan"]', JSON.stringify(r.argv));
    check('LAN 실행 배너가 LAN 모드임을 밝힘', /LAN - same router only/.test(r.out), r.out);
    check('LAN 실행이 DD_LAN 환경 변수를 설정하지 않음', /STUB_DD_LAN=null/.test(r.out), r.out);
    check('LAN 실행이 실행기 폴더로 이동함', r.out.indexOf('STUB_CWD=' + JSON.stringify(dir)) !== -1, r.out);
    check('LAN: node_modules 가 있으면 설치를 건너뜀', !/Installing dependencies/.test(r.out), r.out);
  }

  /* 3) 로컬 실행기는 어떤 인자를 받아도 로컬 전용 고정 동작. 거부(종료 코드 1)가
   *    아니라 무시다 — 인자가 모드를 바꿀 통로 자체가 없다. */
  for (const c of IGNORED_ARGS) {
    clearMarkerFile();
    const r = run(LOCAL_BAT, c.args);
    const detail = 'args=' + JSON.stringify(c.args) + ' code=' + r.code + ' argv=' + JSON.stringify(r.argv) + '\n' + r.out;
    check('로컬 — ' + c.label + ': 그대로 기동하고 인자 없음', r.code === 0 && Array.isArray(r.argv) && r.argv.length === 0, detail);
    check('로컬 — ' + c.label + ': 모드가 로컬 전용 그대로', /LOCAL ONLY/.test(r.out) && !/--lan/.test(r.out), detail);
    check('로컬 — ' + c.label + ': 표식 명령이 실행되지 않음', r.out.indexOf(MARKER) === -1 && !markerFileExists(), detail);
  }

  /* 4) LAN 실행기도 대칭으로 고정 — 인자가 늘어나도 --lan 하나뿐이다. */
  for (const c of IGNORED_ARGS) {
    clearMarkerFile();
    const r = run(LAN_BAT, c.args);
    const detail = 'args=' + JSON.stringify(c.args) + ' code=' + r.code + ' argv=' + JSON.stringify(r.argv) + '\n' + r.out;
    check('LAN — ' + c.label + ': 그대로 기동하고 --lan 하나뿐', r.code === 0 && JSON.stringify(r.argv) === '["--lan"]', detail);
    check('LAN — ' + c.label + ': 모드가 LAN 그대로', /LAN - same router only/.test(r.out), detail);
    check('LAN — ' + c.label + ': 표식 명령이 실행되지 않음', r.out.indexOf(MARKER) === -1 && !markerFileExists(), detail);
  }
  clearMarkerFile();

  /* 5) server.js 의 종료 코드를 그대로 올려보낸다 — 양쪽 실행기 모두. */
  {
    const r = run(LOCAL_BAT, [], { STUB_EXIT: '3' });
    check('로컬: server.js 종료 코드 전파', r.code === 3, 'code=' + r.code + '\n' + r.out);
    check('로컬: 비정상 종료를 사용자에게 알림', /Server exited with code 3/.test(r.out), r.out);
  }
  {
    const r = run(LAN_BAT, [], { STUB_EXIT: '4' });
    check('LAN: server.js 종료 코드 전파', r.code === 4, 'code=' + r.code + '\n' + r.out);
    check('LAN: 비정상 종료를 사용자에게 알림', /Server exited with code 4/.test(r.out), r.out);
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.log('\n실패 ' + failed + '건');
  process.exit(1);
}
console.log('\n모든 실행기 회귀 통과');
