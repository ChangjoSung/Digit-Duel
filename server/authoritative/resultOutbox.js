'use strict';
// #260 전적 결과 아웃박스 — 서버가 경기 결과를 확정한 순간 **DB 보다 먼저** 로컬 파일에 적어 둔다(JSONL, 경기당 한 줄 = 좌석 행 배열).
// DB 에 들어간 것이 확인된 항목만 지운다. 그래서 DB 장애·제약 거부·프로세스 재시작·크래시로 완료된 결과를 잃지 않는다
// — **같은 디스크가 남는 한**. 재배포마다 디스크가 사라지는 호스트(Render Free 등)에서는 재시작 중 DB 장애분을 지키지 못한다(README).
//
// 계약:
//   - add(rows): 메모리에 먼저 넣고, 한 줄 append + fsync. 파일 쓰기가 실패해도 항목은 메모리에 남고 dirty 가 되어 blocked() 가 참이다
//     (새 공식 경기 시작을 막는다). 다음 persist()·remove() 가 전체를 다시 쓰면 풀린다.
//   - remove(rows): 남은 항목 전체를 임시 파일에 쓰고 fsync 뒤 rename(원자 교체) — 중간에 죽으면 옛 파일(상위 집합)이 남고,
//     다시 읽어 넣어도 DB 의 UNIQUE(match_id, account_id) + ON CONFLICT DO NOTHING 이라 한 번만 남는다.
//   - 기동 시 파일을 다시 읽고 줄마다 형식을 검사한다. 깨진·형식 밖 줄은 버리지 않고 `<파일>.bad` 에 덧붙여(fsync) 보존하고 로그한다.
//     보존이 실패하면 throw(fail-closed) — 원본을 고쳐 쓰지 않는다.
//   - 항목은 절대 버리지 않는다. 상한(max)은 blocked() 로 "새 공식 경기 시작을 막는" 신호일 뿐이다.
//   - 로그에는 건수·오류 코드만 적는다(계정 id·경로 원문 없음). 파일 자체에는 계정 id 가 있으니 현재 사용자 전용 경로여야 한다(checkPrivate — 아니면 기동 거부).
// 모든 파일 작업은 동기다 — 이벤트 루프 한 턴 안에서 append 와 rewrite 가 섞이지 않고, add 가 끝난 뒤에만 결과 프레임이 나간다.
// ponytail: 한 줄마다 fsync · 제거마다 전체 재작성 · 한 파일 한 프로세스 — 경기 종료 빈도(분 단위)·단일 인스턴스에서는 충분하다.
//   초당 수십 경기면 배치 커밋, 인스턴스 여럿이면 DB 쪽 큐로.
const fs = require('fs');
const path = require('path');

const RESULTS = new Set(['WIN', 'LOSS', 'NO_CONTEST']);
// matchRows(accounts.js) 가 만드는 모양 그대로인지 — 005 의 CHECK 와 같은 규칙
function validEntry(rows) {
  return Array.isArray(rows) && rows.length >= 1 && rows.length <= 2 && rows.every((r) => r && typeof r === 'object'
    && /^[0-9a-f]{32}$/.test(r.match_id) && r.match_id === rows[0].match_id && /^[1-9][0-9]{0,18}$/.test(String(r.account_id))
    && RESULTS.has(r.result) && /^[a-z_]{1,32}$/.test(r.reason) && (r.opponent_nickname === null || typeof r.opponent_nickname === 'string')
    && Number.isSafeInteger(r.turns) && r.turns >= 0 && Number.isSafeInteger(r.duration_ms) && r.duration_ms >= 0
    && typeof r.ended_at === 'string' && !Number.isNaN(Date.parse(r.ended_at)));
}

function fsyncWrite(file, text, flag) {
  const fd = fs.openSync(file, flag, 0o600);
  try { fs.writeSync(fd, text); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
const code = (e) => (e && e.code) || '없음';
const fail = (c) => Object.assign(new Error('outbox store check failed'), { code: c });

/* 보관 폴더·파일이 이 서버 계정 전용인지 — 기동 때 한 번. 새로 만든 폴더만 잠그고, 이미 있던 폴더·파일은 **검사만** 한다
 * (사용자 데이터·ACL 을 고치거나 지우지 않는다). 넓으면 E_OUTBOX_INSECURE 로 throw → 서버는 기동하지 않는다(fail-closed).
 * POSIX: 소유자 = 이 프로세스 · group/other 비트 0(폴더 0700 · 파일 0600).
 * Windows: chmod 는 ACL 을 바꾸지 않아 새 폴더도 상위의 상속 ACE(다른 계정 Modify 등)를 그대로 받는다. 그래서 새 폴더는 icacls 로
 *   상속을 끊고 현재 사용자만 (OI)(CI)F — 안의 파일(.bad·.tmp 포함)은 그것을 상속한다. 검사는 Allow ACE 와 소유자가 모두
 *   현재 사용자·SYSTEM·Administrators 뿐인지(POSIX 의 root 처럼 이 둘은 어차피 막을 수 없다). 거부(Deny) ACE 는 더 좁히기만 하니 무시. */
const WIN_OK = new Set(['S-1-5-18', 'S-1-5-32-544']); // SYSTEM · BUILTIN\Administrators
const WIN_PS = `$ErrorActionPreference='Stop'
$u=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
if($env:DD_ACL_NEW){ & "$env:SystemRoot\\System32\\icacls.exe" $env:DD_ACL_NEW /inheritance:r /grant:r "*$($u):(OI)(CI)F" | Out-Null; if($LASTEXITCODE){ throw 'icacls' } }
$u
foreach($p in ($env:DD_ACL_PATHS -split "\`n")){ $a=Get-Acl -LiteralPath $p
  ($a.GetOwner([Security.Principal.SecurityIdentifier]).Value) + '|' + ((@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | ? { $_.AccessControlType -eq 'Allow' } | % { $_.IdentityReference.Value })) -join ',') }`;
function checkPrivate(dir, fresh, paths) {
  if (process.platform !== 'win32') {
    for (const p of paths) {
      const st = fs.statSync(p);
      if ((st.mode & 0o077) || st.uid !== process.getuid()) throw fail('E_OUTBOX_INSECURE');
    }
    return;
  }
  let out;
  try {
    out = require('child_process').execFileSync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', WIN_PS],
      { env: Object.assign({}, process.env, { DD_ACL_NEW: fresh ? dir : '', DD_ACL_PATHS: paths.join('\n') }), encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) { throw fail('E_OUTBOX_ACL_CHECK'); }
  const [user, ...lines] = out.trim().split(/\r?\n/);
  if (!/^S-1-5-\d[\d-]*$/.test(user) || lines.length !== paths.length) throw fail('E_OUTBOX_ACL_CHECK');
  for (const line of lines) {
    const [owner, allow] = line.split('|');
    if (![owner, ...allow.split(',').filter(Boolean)].every((sid) => sid === user || WIN_OK.has(sid))) throw fail('E_OUTBOX_INSECURE');
  }
}

// file = null → 메모리 전용(단위 테스트용). 운영 서버는 DB 가 켜지면 항상 파일을 준다(server.js).
function createOutbox(file, max) {
  const cap = max > 0 ? max : 200;
  const entries = [];
  let dirty = false; // 메모리와 파일이 어긋났다(쓰기 실패) — 전체 재작성으로만 되돌린다
  if (file) {
    const dir = path.dirname(file);
    const fresh = !fs.existsSync(dir);
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    // 잠근 뒤에 파일 존재를 본다 — 잠그기 전 틈에 다른 계정이 만든 파일도 검사에 걸린다
    checkPrivate(dir, fresh, [dir]);
    const present = [file, file + '.bad', file + '.tmp'].filter((p) => fs.existsSync(p));
    if (present.length) checkPrivate(dir, false, present);
    if (fs.existsSync(file)) {
      const bad = [];
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        let rows = null;
        try { rows = JSON.parse(line); } catch (e) { /* 아래 bad */ }
        if (validEntry(rows)) entries.push(rows); else bad.push(line);
      }
      if (bad.length) {
        fsyncWrite(file + '.bad', bad.join('\n') + '\n', 'a'); // 실패하면 throw — 원본은 그대로 둔다
        console.error(`[전적] 아웃박스에서 읽을 수 없는 줄 ${bad.length}개를 .bad 파일에 보존했다(수동 확인 필요)`);
      }
      rewrite(); // 보존이 끝난 뒤에만, 좋은 항목으로 정리 — 줄바꿈 없이 끝난 마지막 줄 뒤에 다음 기록이 붙지 않게
    } else {
      fsyncWrite(file, '', 'a'); // 기동 때 쓸 수 있는지 확인한다 — 못 쓰면 여기서 throw(fail-closed)
    }
  }
  function rewrite() {
    if (!file) return;
    const tmp = file + '.tmp'; // 남아 있던 tmp 는 rename 전의 부분 집합이라 덮어써도 잃는 것이 없다
    fsyncWrite(tmp, entries.map((rows) => JSON.stringify(rows) + '\n').join(''), 'w');
    fs.renameSync(tmp, file);
    dirty = false;
  }
  function tryRewrite() {
    try { rewrite(); } catch (e) {
      if (!dirty) console.error(`[전적] 아웃박스 파일 쓰기 실패(오류 코드 ${code(e)}) — 메모리에 ${entries.length}건 보관 · 새 공식 경기 시작 차단`);
      dirty = true;
    }
  }
  return {
    file,
    entries, // 읽기 전용으로 쓴다(순서 = 추가 순서)
    add(rows) {
      entries.push(rows);
      if (!file) return;
      if (dirty) return tryRewrite();
      try { fsyncWrite(file, JSON.stringify(rows) + '\n', 'a'); } catch (e) {
        dirty = true; // 반쯤 쓴 줄이 있을 수 있다 — 다음 기록부터는 전체 재작성
        console.error(`[전적] 아웃박스 파일 쓰기 실패(오류 코드 ${code(e)}) — 메모리에 ${entries.length}건 보관 · 새 공식 경기 시작 차단`);
      }
    },
    remove(rows) {
      const i = entries.indexOf(rows);
      if (i < 0) return;
      entries.splice(i, 1);
      tryRewrite(); // 실패해도 파일엔 이 항목이 남는다 — 재시작 뒤 재생해도 DB 가 한 번만 남긴다
    },
    persist() { if (dirty) tryRewrite(); },
    blocked: () => dirty || entries.length >= cap,
    size: () => entries.length,
  };
}

module.exports = { createOutbox, validEntry };
