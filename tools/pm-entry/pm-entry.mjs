// Digit-Duel PM entry: one explicit, human-started launch of a fresh Codex PM in the root workspace.
// Control group only. It is NOT GUI "+" no-input auto-entry and is not wired to "+", hooks or schedules.
// The brief rides Orca's supported launch intent (Codex promptInjectionMode argv), so there is no
// hook, terminal send, draft paste or first-prompt race.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HELP = `node pm-entry.mjs <command>
  --preview                          print the exact launch argv and preflight result; starts nothing
  --run [--retry-launch <operationId>]
                                     preflight, then exactly one Orca launch of a NEW Codex PM terminal
                                     in the root workspace. Every --run starts another PM; it does not
                                     detect or reuse an existing PM. After a lost reply, re-run only with
                                     the printed operationId (Orca replays instead of launching again).
  --selfcheck                        counterexample checks; no Orca calls
  --help
Fixed: Orca ${'1.4.244'}, root workspace, codex gpt-6.1-sol/xhigh, read-only intake brief.
Chat or terminal follows the user's Orca setting.`;

const ORCA_EXE = 'C:/Users/pc_77/AppData/Local/Programs/orca/resources/bin/orca.exe';
const ORCA_VERSION = '1.4.244'; // launch path read in this build only; re-review on update
const ROOT_PATH = 'C:/Users/pc_77/orca/Digit-Duel';
const ROOT_ID = `003dc8a0-372c-4547-9290-31d34edd82be::${ROOT_PATH}`;
const MODEL = 'gpt-6.1-sol'; // worker-models.json Mercury
const EFFORT = 'xhigh';
export const PROMPT =
  '[Digit-Duel PM 인수 진입 · 읽기 전용 · 사람이 명시 실행한 1회 launcher] 이 세션은 Digit-Duel 상설 root의 Mercury / PM 인수 확인용이며 소유권 이전이 아니다. ' +
  '먼저 AGENTS.md를 읽고, 회사 Vault 613e72a275ee9be3 (E:/Toolkit/Mirror/CJ Library/CHANGJO GAMES)를 정확한 Vault·상대 경로의 Obsidian CLI로 읽는다: ' +
  'Org Chart and R&R.md의 정본·소유자 목록, Projects/Digit Duel.md의 current → work → team/runtime → authority → qa-policy → handoff. ' +
  'docs/creat2ve/worker-models.json의 승인값과 현재 실제 모델·effort·권한·tier 관측을 구분한다. CLI 연결 실패는 확인 불가로 보고하고 다른 Vault·파일시스템·HTML로 대신하지 않는다. ' +
  '모든 Git 읽기는 GIT_OPTIONAL_LOCKS=0으로 실행한다. ' +
  'Ponytail 자동 mode hook은 이 프로젝트에서 꺼져 있을 수 있으므로 현재 설치된 Ponytail SKILL.md를 직접 읽고 full 규칙을 적용한다(설치 경로·버전을 보고). ' +
  '실제 cwd·HEAD, 정본·Role·승인 경계, 미결·차단, 다음 행동을 CJ에게 인수 보고하라. ' +
  '읽기·파악·보고만 하며 파일 수정·Git 쓰기·Worker 기동·삭제·배포·설정/hook 신뢰 변경은 하지 않는다.';

const norm = (p) => String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
// Orca 1.4.244 host launch ids are <epoch-ms>-<32 hex> (observed 2026-10-30); UUIDs kept for other hosts.
const OPERATION_ID = /^(\d{13}-[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Only these exact command lines are accepted; anything else is refused before Orca is called.
export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (['--preview', '--selfcheck', '--help'].includes(cmd) && rest.length === 0) return { cmd };
  if (cmd === '--run' && rest.length === 0) return { cmd };
  if (cmd === '--run' && rest.length === 2 && rest[0] === '--retry-launch' && OPERATION_ID.test(rest[1])) return { cmd, retry: rest[1] };
  return null;
}

export const launchArgs = (retry) => [
  'agent', 'launch', '--agent', 'codex', '--worktree', `id:${ROOT_ID}`, '--model', MODEL, '--effort', EFFORT, '--prompt', PROMPT, ...(retry ? ['--retry-launch', retry] : []), '--json',
];

// The exact Orca build and the root workspace binding, read fresh before any launch.
export function preflightProblem(version, show) {
  if (String(version).trim() !== ORCA_VERSION) return `orca-version:${String(version).trim()}`;
  const w = show?.ok ? show.result?.worktree : null;
  if (!w || w.id !== ROOT_ID || norm(w.path) !== norm(ROOT_PATH)) return 'root-workspace';
  return null;
}

// Delivered only when Orca reports the brief rode the launch (chat or terminal) in the root workspace.
// This proves delivery, not a completed intake report; that needs PM/GUI verification.
export function judgeLaunch(r) {
  const l = r?.result?.launch ?? r?.result;
  if (!r?.ok || !l) return 'not-proven:launch-failed';
  if (l.worktreeId !== ROOT_ID) return 'not-proven:worktree';
  if (!['terminal', 'structured'].includes(l.outcome?.kind) || !l.outcome.handle) return 'not-proven:surface';
  if (l.prompt?.delivery !== 'submit' || !['handed-to-terminal', 'journaled'].includes(l.prompt.outcome)) return 'not-proven:prompt';
  return 'delivered';
}

const orca = (args, timeout = 60_000) => {
  const r = spawnSync(ORCA_EXE, args, { encoding: 'utf8', timeout, windowsHide: true });
  try { return JSON.parse(r.stdout); } catch { return { ok: false, raw: (r.stdout || r.stderr || '').slice(0, 500) }; }
};
const preflight = () => preflightProblem(
  spawnSync(ORCA_EXE, ['--version'], { encoding: 'utf8', windowsHide: true }).stdout ?? '',
  orca(['worktree', 'show', '--worktree', `id:${ROOT_ID}`, '--json']),
);

function selfcheck() {
  assert.deepEqual(parseArgs(['--preview']), { cmd: '--preview' });
  assert.deepEqual(parseArgs(['--run']), { cmd: '--run' });
  const op = '497bafa9-5a97-4f85-9e48-2b211b8f31fa';
  assert.deepEqual(parseArgs(['--run', '--retry-launch', op]), { cmd: '--run', retry: op });
  const hostOp = '1793296893867-1c7993b602624b7aa758e66e04d15f36'; // real Orca 1.4.244 launch id
  assert.deepEqual(parseArgs(['--run', '--retry-launch', hostOp]), { cmd: '--run', retry: hostOp });
  for (const bad of [[], ['--run', '--prompt', 'x'], ['--run', '--worktree', 'active'], ['--preview', '--run'],
    ['--run', '--retry-launch', 'abc'], ['--run', '--retry-launch'], ['--launch'], ['--run', '--model', 'gpt-6-astra'],
    ['--run', '--retry-launch', '179329689386-1c7993b602624b7aa758e66e04d15f36'],
    ['--run', '--retry-launch', '1793296893867-1c7993b602624b7aa758e66e04d15f3'],
    ['--run', '--retry-launch', '1793296893867-1c7993b602624b7aa758e66e04d15f36z'],
    ['--run', '--retry-launch', '1793296893867_1c7993b602624b7aa758e66e04d15f36'],
    ['--run', '--retry-launch', '1793296893867-1c7993b602624b7aa758e66e04d15g36'],
    ['--run', '--retry-launch', ` ${hostOp}`]]) {
    assert.equal(parseArgs(bad), null, bad.join(' '));
  }

  const a = launchArgs();
  assert.equal(a.filter((t) => t === PROMPT).length, 1);
  assert.equal(a[a.indexOf('--worktree') + 1], `id:${ROOT_ID}`);
  assert.ok(!a.includes('--focus') && !a.includes('--surface') && !a.includes('--retry-launch') && a.at(-1) === '--json');
  assert.equal(launchArgs(op).at(-2), op);
  for (const s of ['AGENTS.md', '613e72a275ee9be3', 'Org Chart and R&R.md', 'Projects/Digit Duel.md', 'worker-models.json', 'Git 쓰기',
    'GIT_OPTIONAL_LOCKS=0', 'Ponytail SKILL.md', 'full 규칙']) {
    assert.ok(PROMPT.includes(s), s);
  }

  const show = { ok: true, result: { worktree: { id: ROOT_ID, path: ROOT_PATH } } };
  assert.equal(preflightProblem(`${ORCA_VERSION}\n`, show), null);
  assert.ok(preflightProblem('1.4.245', show));
  assert.ok(preflightProblem(ORCA_VERSION, { ok: false }));
  assert.ok(preflightProblem(ORCA_VERSION, { ok: true, result: { worktree: { id: `x::${ROOT_PATH}`, path: ROOT_PATH } } }));
  assert.ok(preflightProblem(ORCA_VERSION, { ok: true, result: { worktree: { id: ROOT_ID, path: 'C:/other' } } }));

  const good = { ok: true, result: { launch: { worktreeId: ROOT_ID, outcome: { kind: 'terminal', handle: 'term_1' }, prompt: { delivery: 'submit', outcome: 'handed-to-terminal' } } } };
  assert.equal(judgeLaunch(good), 'delivered');
  const mut = (f) => { const c = structuredClone(good); f(c.result.launch); return judgeLaunch(c); };
  assert.equal(mut((l) => { l.outcome.kind = 'structured'; l.prompt.outcome = 'journaled'; }), 'delivered');
  for (const m of [
    (l) => { l.worktreeId = 'x::C:/other'; }, (l) => { l.outcome.kind = 'unknown'; }, (l) => { l.outcome.handle = ''; },
    (l) => { l.prompt.delivery = 'draft'; }, (l) => { l.prompt.outcome = 'not-delivered'; }, (l) => { l.prompt.outcome = 'unconfirmed'; },
    (l) => { delete l.prompt; },
  ]) assert.notEqual(mut(m), 'delivered');
  assert.notEqual(judgeLaunch({ ok: false }), 'delivered');
  console.log('selfcheck PASS: args 18, launch-argv 13, preflight 5, receipt 10');
}

function main(argv) {
  const p = parseArgs(argv);
  if (!p) { console.error(`refused: unsupported arguments\n${HELP}`); process.exitCode = 2; return; }
  if (p.cmd === '--help') return console.log(HELP);
  if (p.cmd === '--selfcheck') return selfcheck();
  const bad = preflight();
  if (p.cmd === '--preview') {
    console.log(JSON.stringify({ launches: 0, preflight: bad ?? 'ok', exe: ORCA_EXE, argv: launchArgs() }, null, 2));
    process.exitCode = bad ? 1 : 0;
    return;
  }
  if (bad) { console.error(`refused: ${bad}`); process.exitCode = 1; return; }
  const r = orca(launchArgs(p.retry), 120_000);
  const verdict = judgeLaunch(r);
  const l = r?.result?.launch ?? r?.result;
  console.log(JSON.stringify({
    launches: 1, verdict, handle: l?.outcome?.handle ?? null, prompt: l?.prompt ?? null,
    operationId: r?.operationId ?? r?.error?.operationId ?? r?.result?.operationId ?? null,
    note: 'delivery receipt only; intake report and GUI "+" auto-entry are not proven by this',
  }));
  process.exitCode = verdict === 'delivered' ? 0 : 1;
}

if (process.argv[1] && norm(process.argv[1]) === norm(fileURLToPath(import.meta.url))) main(process.argv.slice(2));
