// #62 기동 설정 fail-closed 회귀 테스트 — 설정 판정(순수 유틸) + 실제 기동 중단 확인.
//
// 여기서 검증하는 것은 "잘못된 설정으로는 서버가 아예 뜨지 않는다"이다. 잘못 뜬 서버는
// 안내문(루프백 전용·코드 인증)과 실제 노출이 어긋난 채로 돌아가고, 피어 검사(peerAllowed)는
// 이미 열린 소켓에 붙은 상대를 돌려보낼 뿐 소켓을 안 여는 것이 아니다.
//
// 기동을 시도하는 케이스도 전부 PORT=0(임의 포트)이라 이미 떠 있는 8080 을 건드리지 않는다.
const { spawn } = require('child_process');
const S = require('./security');

const CODE = 'TESTCODE2345';
const MARKER = S.PROTOCOL_MARKER;
let failures = 0;

/* ===== 최소 어서션 헬퍼 (test-security.js 와 같은 형태) ===== */

function ok(cond, label) {
  if (cond) return true;
  failures += 1;
  console.error('  FAIL:', label);
  return false;
}
const eq = (actual, expected, label) => ok(actual === expected, `${label} — expected ${expected}, got ${actual}`);
const rejects = (r, reason, label) => ok(r && r.ok === false && r.reason === reason, `${label} — got ${JSON.stringify(r)}`);
const section = (name) => console.log('-', name);

/* ===== 1. 설정 판정 (I/O 없음) ===== */

function unitTests() {
  // 접근 코드는 Sec-WebSocket-Protocol 토큰으로만 전달된다. 그 통로가 실어 나를 수 없는 값은
  // "설정했는데 아무도 못 붙는" 조용한 고장이고, 공개 마커와 같은 값은 아예 비밀이 아니다.
  section('DD_ACCESS_CODE 검증');
  ok(S.validateAccessCode(CODE).ok, '정상 코드 통과');
  ok(S.validateAccessCode('a-b_c.9~x').ok, 'RFC 토큰 문자(-_.~) 허용');
  rejects(S.validateAccessCode(''), 'absent', '빈 값');
  rejects(S.validateAccessCode(' PADDED12 '), 'whitespace', '앞뒤 공백 — 트림하지 않고 거부');
  rejects(S.validateAccessCode('has space12'), 'whitespace', '내부 공백');
  rejects(S.validateAccessCode('코드코드코드코드'), 'non_ascii', '비ASCII');
  rejects(S.validateAccessCode('CODE' + String.fromCharCode(1) + '234'), 'non_ascii', '제어 문자');
  rejects(S.validateAccessCode('SEVEN12'), 'too_short', '8자 미만');
  rejects(S.validateAccessCode('x'.repeat(S.MAX_ACCESS_CODE_LENGTH + 1)), 'too_long', '헤더 토큰 상한 초과');
  rejects(S.validateAccessCode('CODE,OTHER99'), 'bad_char', '쉼표 — 헤더에서 토큰이 쪼개진다');
  rejects(S.validateAccessCode('CODE;OTHER99'), 'bad_char', '세미콜론');
  rejects(S.validateAccessCode(MARKER), 'public_marker', '공개 마커와 동일 — 비밀이 아니다');
  rejects(S.validateAccessCode(MARKER.toUpperCase()), 'public_marker', '공개 마커 대소문자 변형');

  section('DD_BIND 검증');
  eq(S.resolveBindAddress('', false).bind, '127.0.0.1', '미지정 기본 — 루프백');
  eq(S.resolveBindAddress('', true).bind, '0.0.0.0', 'LAN 옵트인 기본 — 전체 인터페이스');
  eq(S.resolveBindAddress('127.0.0.1', false).bind, '127.0.0.1', '루프백 명시 허용');
  eq(S.resolveBindAddress('[::1]', false).bind, '::1', 'IPv6 루프백 정규화');
  eq(S.resolveBindAddress('192.168.0.5', true).bind, '192.168.0.5', 'LAN 옵트인 — 사설 주소 허용');
  // 옵트인 없는 전체 인터페이스 바인드가 이 판정의 핵심이다.
  rejects(S.resolveBindAddress('0.0.0.0', false), 'wildcard_without_lan', '옵트인 없는 와일드카드');
  rejects(S.resolveBindAddress('::', false), 'wildcard_without_lan', '옵트인 없는 IPv6 와일드카드');
  rejects(S.resolveBindAddress('192.168.0.5', false), 'not_loopback', '옵트인 없는 LAN 주소');
  rejects(S.resolveBindAddress('localhost', false), 'not_loopback', '호스트명 — 주소 리터럴만 허용');
  rejects(S.resolveBindAddress('8.8.8.8', true), 'not_private', 'LAN 옵트인이어도 공인 주소 거부');
}

/* ===== 2. 실제 기동 — 잘못된 설정은 listen 전에 중단 ===== */

// 서버를 띄워 보고 { code, out } 을 돌려준다. DD_* 를 먼저 비워 바깥 셸 환경이 판정에 새어들지
// 않게 한다. PORT=0 이라 설령 떴더라도 8080 을 잡지 않는다.
function startServer(env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: '0', DD_LAN: '0', DD_BIND: '', DD_ACCESS_CODE: '', ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { out += d.toString(); });
    const timer = setTimeout(() => { child.kill(); reject(new Error('기동이 끝나지 않았다')); }, 15000);
    child.once('error', reject);
    child.once('exit', (code) => { clearTimeout(timer); resolve({ code, out }); });
  });
}

// 상한을 넘기되 'xxx…' 처럼 뭉개지지 않게 — 반향 여부를 찾을 때 눈에 띄는 값이어야 한다.
const OVERLONG = 'L0NGCODE'.repeat(Math.ceil((S.MAX_ACCESS_CODE_LENGTH + 1) / 8));

// 각 케이스는 자기가 주입한 값(secret)을 들고 다닌다. 한 케이스의 값이 다른 케이스의 출력에
// 없다는 것은 아무것도 증명하지 못하므로, 반향 검사는 언제나 그 케이스 자신이 넣은 값으로 한다.
// 공개 마커처럼 비밀이 아닌 값도 포함한다 — 거부 사유를 알리자고 거부된 입력을 되풀이하면
// 그 값이 로그·터미널 기록에 남고, 기록에는 "코드로 쓰인 값"으로 남는다.
// DD_ACCESS_CODE 가 없는 바인드 전용 케이스만 secret 을 생략한다.
const ABORT_CASES = [
  { env: { DD_ACCESS_CODE: 'S3CRET,CODE99' }, label: '쉼표 포함 코드', secret: 'S3CRET,CODE99' },
  { env: { DD_ACCESS_CODE: ' PADDED12 ' }, label: '앞뒤 공백 코드', secret: 'PADDED12' },
  { env: { DD_ACCESS_CODE: '코드코드코드코드' }, label: '비ASCII 코드', secret: '코드코드코드코드' },
  { env: { DD_ACCESS_CODE: OVERLONG }, label: '과길이 코드', secret: OVERLONG },
  { env: { DD_ACCESS_CODE: MARKER }, label: '공개 마커를 코드로 지정', secret: MARKER },
  { env: { DD_ACCESS_CODE: MARKER.toUpperCase() }, label: '공개 마커 대문자 변형', secret: MARKER.toUpperCase() },
  { env: { DD_BIND: '0.0.0.0' }, label: '옵트인 없는 0.0.0.0 바인드' },
  { env: { DD_BIND: '192.168.0.5' }, label: '옵트인 없는 LAN 주소 바인드' },
  { env: { DD_LAN: '1', DD_BIND: '8.8.8.8', DD_ACCESS_CODE: CODE }, label: 'LAN 옵트인 + 공인 주소 바인드', secret: CODE },
];

async function abortTests() {
  section('기동 fail-closed — 잘못된 설정은 listen 전에 중단');
  for (const { env, label, secret } of ABORT_CASES) {
    const r = await startServer(env);
    eq(r.code, 1, `${label} — 종료 코드 1`);
    ok(!r.out.includes('listening'), `${label} — listen 하지 않는다`);
    if (secret) ok(!r.out.includes(secret), `${label} — 실패 로그에 자기가 넣은 값이 새지 않는다`);
  }
}

// 정상 설정은 그대로 떠야 한다 — fail-closed 가 멀쩡한 기동까지 막으면 그것도 회귀다.
async function acceptTests() {
  section('정상 설정은 기동한다');
  const started = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['server.js'], {
      cwd: __dirname,
      env: { ...process.env, PORT: '0', DD_LAN: '0', DD_BIND: '127.0.0.1', DD_ACCESS_CODE: CODE },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let out = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('기동하지 않았다')); }, 15000);
    child.stdout.on('data', (d) => {
      out += d.toString();
      if (!out.includes('listening')) return;
      clearTimeout(timer);
      child.kill();
      resolve(out);
    });
    child.once('error', reject);
  });
  ok(started.includes('127.0.0.1'), '루프백 명시 바인드로 기동');
  ok(started.includes('루프백 전용'), '루프백 전용으로 안내');
}

/* ===== 실행 ===== */

(async () => {
  try {
    unitTests();
    await abortTests();
    await acceptTests();
  } catch (e) {
    failures += 1;
    console.error('  FAIL: 예외 —', e && e.message);
  }
  if (failures) {
    console.error(`CONFIG TESTS FAILED (${failures})`);
    process.exit(1);
  }
  console.log('ALL CONFIG TESTS PASSED');
  process.exit(0);
})();
