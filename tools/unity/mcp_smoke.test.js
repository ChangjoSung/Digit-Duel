#!/usr/bin/env node
/**
 * tools/unity/mcp_smoke.js 회귀 테스트 (#183)
 *
 * 실행: node --test tools/unity/mcp_smoke.test.js
 *
 * 범위 — 정확히 읽을 것:
 *   - **라이브 Unity Editor·Unity CLI·MCP 서버를 쓰지 않는다.** 자식 프로세스를 spawn 하지도
 *     않는다. 가짜 자식(EventEmitter + 스트림)을 runSmoke 에 주입해 JSON-RPC 프로토콜만 검증한다.
 *   - 프로젝트·Editor·에이전트 설정을 읽거나 바꾸지 않는다. 실기기 동작도 없다.
 *   - PATH 탐색 테스트는 os.tmpdir() 아래 mkdtemp 로 만든 임시 디렉터리(이름에 공백 포함)에
 *     **빈 파일**을 두고 존재 여부만 본다. 그 파일을 실행하지 않으며 테스트 끝에 지운다.
 *   - 긴 타이머를 실제로 기다리지 않는다. timeout 경계값은 parseOptions 파싱만 검사하고,
 *     실행 경로 테스트는 60~200ms 짜리 짧은 값만 쓴다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough, Writable } = require('node:stream');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const smoke = require('./mcp_smoke.js');

const PROJECT_WITH_SPACES = 'C:\\Users\\pc 77\\orca\\Digit Duel\\unity';

/** 실패 메시지에 쓰는 값 표기 (undefined 도 그대로 보이게). */
function preview(value) {
  return value === undefined ? 'undefined' : JSON.stringify(value);
}

function baseOptions(overrides = {}) {
  return {
    projectPath: PROJECT_WITH_SPACES,
    toolName: 'editor_status',
    toolArgs: {},
    timeoutMs: 200,
    unityBin: 'C:\\fake\\unity.exe',
    ...overrides,
  };
}

/**
 * 가짜 MCP 자식 프로세스. respond(request) 가 돌려주는 값을 stdout 에 쓴다.
 *   - 객체/배열  → 줄 단위 JSON 으로 기록
 *   - 문자열     → 그대로 한 줄 기록 (비 JSON 로그 섞임 재현)
 *   - null       → 아무 응답도 하지 않는다 (timeout 재현)
 */
function makeFakeSpawn(respond, hooks = {}) {
  const calls = [];
  const spawnFn = (bin, args, opts) => {
    const child = new EventEmitter();
    calls.push({ bin, args, opts });
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = () => { child.killed = true; };

    let inbound = '';
    child.stdin = new Writable({
      write(chunk, _enc, cb) {
        inbound += chunk.toString();
        let nl;
        while ((nl = inbound.indexOf('\n')) >= 0) {
          const line = inbound.slice(0, nl).trim();
          inbound = inbound.slice(nl + 1);
          if (!line) continue;
          const req = JSON.parse(line);
          if (req.id === undefined) continue; // notification
          const reply = respond(req, child);
          if (reply === null || reply === undefined) continue;
          const items = Array.isArray(reply) ? reply : [reply];
          setImmediate(() => {
            for (const item of items) {
              // Buffer 는 그대로 — 바이트 경계를 테스트가 직접 정하는 청크 분할용이다
              if (Buffer.isBuffer(item)) { child.stdout.write(item); continue; }
              child.stdout.write(typeof item === 'string' ? `${item}\n` : `${JSON.stringify(item)}\n`);
            }
          });
        }
        cb();
      },
    });

    if (hooks.onSpawn) setImmediate(() => hooks.onSpawn(child));
    return child;
  };
  spawnFn.calls = calls;
  return spawnFn;
}

function okInitialize(id, resultOverrides = {}) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'unity-mcp', version: '1.0.0-beta.9' },
      ...resultOverrides,
    },
  };
}

function okToolsList(id, names = ['editor_status', 'list_open_scenes']) {
  return { jsonrpc: '2.0', id, result: { tools: names.map((name) => ({ name })) } };
}

function okToolsCall(id, text = '{"status":"ready"}', extra = {}) {
  return {
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text }], isError: false, ...extra },
  };
}

/**
 * 값을 UTF-8 바이트로 만든 뒤 지정한 바이트 크기로 잘라 Buffer 조각을 만든다.
 * 한글은 한 글자가 3바이트라 size 1·2 면 반드시 글자 중간이 갈라진다 —
 * 파이프에서 실제로 일어나는 임의 청크 경계를 재현한다.
 */
function utf8Chunks(value, size) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  const buf = Buffer.from(`${text}\n`, 'utf8');
  const chunks = [];
  for (let i = 0; i < buf.length; i += size) chunks.push(buf.subarray(i, i + size));
  return chunks;
}

/** 기본 응답기를 쓰되 지정한 메서드만 다른 응답으로 갈아끼운다. */
function responderWith(overrides = {}) {
  return (req) => {
    if (overrides[req.method] !== undefined) {
      const value = overrides[req.method];
      return typeof value === 'function' ? value(req) : value;
    }
    if (req.method === 'initialize') return okInitialize(req.id);
    if (req.method === 'tools/list') return okToolsList(req.id);
    if (req.method === 'tools/call') return okToolsCall(req.id);
    return { jsonrpc: '2.0', id: req.id, error: { code: -32601, message: 'method not found' } };
  };
}

async function run(options, respond, hooks) {
  const out = [];
  const err = [];
  const spawnFn = makeFakeSpawn(respond, hooks);
  const code = await smoke.runSmoke(options, {
    spawn: spawnFn,
    log: (line) => out.push(line),
    logErr: (line) => err.push(line),
  });
  return { code, out: out.join('\n'), err: err.join('\n'), spawnFn };
}

// ─────────────────────────────── 정상 경로 ───────────────────────────────

test('정상 응답이면 0 으로 끝나고 공백 있는 프로젝트 경로를 인수로 그대로 넘긴다', async () => {
  const { code, out, err, spawnFn } = await run(baseOptions(), responderWith());
  assert.equal(code, 0);
  assert.match(out, /\[1\/3\] initialize OK — server=unity-mcp 1\.0\.0-beta\.9/);
  assert.match(out, /\[2\/3\] tools\/list OK — 2개/);
  assert.match(out, /\[3\/3\] tools\/call\(editor_status\) OK — isError=false/);
  assert.equal(err, '');
  assert.deepEqual(spawnFn.calls[0].args, ['mcp', '--project-path', PROJECT_WITH_SPACES]);
  assert.equal(spawnFn.calls[0].opts.windowsHide, true);
  assert.equal(spawnFn.calls[0].bin, 'C:\\fake\\unity.exe');
});

test('서버가 섞어 쓰는 비 JSON 로그 줄은 무시한다', async () => {
  const { code } = await run(baseOptions(), responderWith({
    initialize: (req) => ['[info] booting unity mcp', okInitialize(req.id)],
  }));
  assert.equal(code, 0);
});

test('capabilities 에 tools 외 다른 기능이 더 있어도 통과한다', async () => {
  const { code } = await run(baseOptions(), responderWith({
    initialize: (req) => okInitialize(req.id, {
      capabilities: { tools: { listChanged: true }, resources: {}, logging: {} },
    }),
  }));
  assert.equal(code, 0);
});

// ───────────────────── 잘못된 응답 구조 = 절대 0 이 아니다 ─────────────────────

test('initialize 에 result 가 없으면 0 이 아니다', async () => {
  const { code, out, err } = await run(baseOptions(), responderWith({
    initialize: (req) => ({ jsonrpc: '2.0', id: req.id }),
  }));
  assert.equal(code, 1);
  assert.match(err, /initialize: result 가 없거나 객체가 아니다/);
  assert.doesNotMatch(out, /OK/);
});

test('initialize result 가 배열이면 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({
    initialize: (req) => ({ jsonrpc: '2.0', id: req.id, result: [] }),
  }));
  assert.equal(code, 1);
  assert.match(err, /initialize: result 가 없거나 객체가 아니다/);
});

test('initialize 에 protocolVersion 이 없거나 문자열이 아니면 실패한다', async () => {
  for (const bad of [undefined, 20241105, null, '']) {
    const { code, err } = await run(baseOptions(), responderWith({
      initialize: (req) => okInitialize(req.id, { protocolVersion: bad }),
    }));
    assert.equal(code, 1, `protocolVersion=${preview(bad)} 를 통과시켰다`);
    assert.match(err, /result\.protocolVersion 문자열이 없다/);
  }
});

test('지원하지 않는 protocolVersion 은 협상 실패다', async () => {
  for (const other of ['2025-06-18', '2024-10-07', '1.0']) {
    const { code, err } = await run(baseOptions(), responderWith({
      initialize: (req) => okInitialize(req.id, { protocolVersion: other }),
    }));
    assert.equal(code, 1, `protocolVersion=${other} 를 통과시켰다`);
    assert.match(err, /지원하지 않는 protocolVersion/);
    assert.match(err, /2024-11-05/); // 지원 목록을 알려준다
  }
});

test('클라이언트가 보내는 protocolVersion 은 지원 목록의 것이다', async () => {
  let sent = null;
  await run(baseOptions(), (req) => {
    if (req.method === 'initialize') { sent = req.params.protocolVersion; return okInitialize(req.id); }
    if (req.method === 'tools/list') return okToolsList(req.id);
    return okToolsCall(req.id);
  });
  assert.equal(sent, smoke.CLIENT_PROTOCOL_VERSION);
  assert.ok(smoke.SUPPORTED_PROTOCOL_VERSIONS.includes(sent));
});

test('initialize 에 capabilities 객체가 없으면 실패한다', async () => {
  for (const bad of [undefined, null, [], 'tools', 3]) {
    const { code, err } = await run(baseOptions(), responderWith({
      initialize: (req) => okInitialize(req.id, { capabilities: bad }),
    }));
    assert.equal(code, 1, `capabilities=${preview(bad)} 를 통과시켰다`);
    assert.match(err, /result\.capabilities 객체가 없다/);
  }
});

test('initialize 에 serverInfo 객체가 없으면 실패한다', async () => {
  for (const bad of [undefined, null, 'unity-mcp', []]) {
    const { code, err } = await run(baseOptions(), responderWith({
      initialize: (req) => okInitialize(req.id, { serverInfo: bad }),
    }));
    assert.equal(code, 1, `serverInfo=${preview(bad)} 를 통과시켰다`);
    assert.match(err, /result\.serverInfo 객체가 없다/);
  }
});

test('initialize 에 serverInfo.name 이 없으면 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({
    initialize: (req) => okInitialize(req.id, { serverInfo: { version: '1.0.0-beta.9' } }),
  }));
  assert.equal(code, 1);
  assert.match(err, /serverInfo\.name 이 없다/);
});

test('initialize 에 serverInfo.version 이 없거나 비어 있으면 실패한다', async () => {
  for (const bad of [undefined, '', null, 9]) {
    const { code, err } = await run(baseOptions(), responderWith({
      initialize: (req) => okInitialize(req.id, { serverInfo: { name: 'unity-mcp', version: bad } }),
    }));
    assert.equal(code, 1, `serverInfo.version=${preview(bad)} 를 통과시켰다`);
    assert.match(err, /serverInfo\.version 이 없다/);
  }
});

test('tools capability 를 광고하지 않으면 tools/list 를 보내지 않고 실패한다', async () => {
  for (const bad of [undefined, null, true, [], 'yes']) {
    const seen = [];
    const { code, err } = await run(baseOptions(), (req) => {
      seen.push(req.method);
      if (req.method === 'initialize') {
        return okInitialize(req.id, { capabilities: bad === undefined ? {} : { tools: bad } });
      }
      if (req.method === 'tools/list') return okToolsList(req.id);
      return okToolsCall(req.id);
    });
    assert.equal(code, 1, `capabilities.tools=${preview(bad)} 를 통과시켰다`);
    assert.match(err, /tools capability 를 객체로 광고하지 않았다/);
    assert.deepEqual(seen, ['initialize'], '광고 없는 기능을 호출했다');
  }
});

test('jsonrpc 필드가 2.0 이 아니면 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({
    initialize: (req) => ({ ...okInitialize(req.id), jsonrpc: '1.0' }),
  }));
  assert.equal(code, 1);
  assert.match(err, /jsonrpc/);
});

test('JSON-RPC error 응답이면 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({
    'tools/list': (req) => ({ jsonrpc: '2.0', id: req.id, error: { code: -32603, message: 'boom' } }),
  }));
  assert.equal(code, 1);
  assert.match(err, /tools\/list 실패/);
  assert.match(err, /boom/);
});

test('tools/list 의 tools 가 배열이 아니면 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({
    'tools/list': (req) => ({ jsonrpc: '2.0', id: req.id, result: { tools: 149 } }),
  }));
  assert.equal(code, 1);
  assert.match(err, /result\.tools 가 배열이 아니다/);
});

test('tools/list 원소에 문자열 name 이 없으면 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({
    'tools/list': (req) => ({ jsonrpc: '2.0', id: req.id, result: { tools: [{ title: 'editor_status' }] } }),
  }));
  assert.equal(code, 1);
  assert.match(err, /tools\[0\] 에 문자열 name 이 없다/);
});

test('요청한 도구가 목록에 없으면 실패한다', async () => {
  const { code, err } = await run(baseOptions({ toolName: 'no_such_tool' }), responderWith());
  assert.equal(code, 1);
  assert.match(err, /tools\/list 에 no_such_tool 없음/);
});

test('tools/call 응답에 result 가 없으면 0 이 아니다', async () => {
  const { code, out, err } = await run(baseOptions(), responderWith({
    'tools/call': (req) => ({ jsonrpc: '2.0', id: req.id, ok: true }),
  }));
  assert.equal(code, 1);
  assert.match(err, /tools\/call\(editor_status\): result 가 없거나 객체가 아니다/);
  assert.doesNotMatch(out, /\[3\/3\]/);
});

test('tools/call 의 content 가 배열이 아니면 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({
    'tools/call': (req) => ({ jsonrpc: '2.0', id: req.id, result: { content: 'ready' } }),
  }));
  assert.equal(code, 1);
  assert.match(err, /result\.content 가 배열이 아니다/);
});

test('tools/call 의 content 원소에 문자열 type 이 없으면 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({
    'tools/call': (req) => ({ jsonrpc: '2.0', id: req.id, result: { content: [{ text: 'ready' }] } }),
  }));
  assert.equal(code, 1);
  assert.match(err, /content\[0\] 에 문자열 type 이 없다/);
});

test('isError 가 boolean 이 아니면 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({
    'tools/call': (req) => okToolsCall(req.id, 'ready', { isError: 'false' }),
  }));
  assert.equal(code, 1);
  assert.match(err, /result\.isError 가 boolean 이 아니다/);
});

// ─────────────────────── 도구 실패(isError=true) ───────────────────────

test('isError=true 는 OK 를 찍지 않고 오류 요약을 stderr 로 보내며 1 로 끝난다', async () => {
  const { code, out, err } = await run(baseOptions(), responderWith({
    'tools/call': (req) => okToolsCall(req.id, 'Editor is compiling', { isError: true }),
  }));
  assert.equal(code, 1);
  assert.doesNotMatch(out, /OK — isError/);
  assert.match(err, /\[3\/3\] tools\/call\(editor_status\) 실패 — isError=true/);
  assert.match(err, /Editor is compiling/);
});

// ──────────────────────── 시간 초과·자식 사망 ────────────────────────

test('응답이 오지 않으면 요청별 timeout 으로 실패한다', async () => {
  const { code, err } = await run(baseOptions({ timeoutMs: 60 }), responderWith({
    'tools/call': () => null,
  }));
  assert.equal(code, 1);
  assert.match(err, /timeout: tools\/call/);
  assert.match(err, /취소·롤백하지 않는다/);
});

test('initialize 응답 전에 서버가 죽으면 즉시 실패한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({ initialize: () => null }), {
    onSpawn: (child) => { child.emit('exit', 9, null); },
  });
  assert.equal(code, 1);
  assert.match(err, /응답 전에 종료했다/);
});

test('spawn error 이벤트는 실행 실패로 보고한다', async () => {
  const { code, err } = await run(baseOptions(), responderWith({ initialize: () => null }), {
    onSpawn: (child) => { child.emit('error', new Error('ENOENT')); },
  });
  assert.equal(code, 1);
  assert.match(err, /unity mcp 실행 실패/);
});

test('서버 stderr 는 실패 요약에 함께 남는다', async () => {
  const { code, err } = await run(baseOptions({ timeoutMs: 60 }), responderWith({ 'tools/call': () => null }), {
    onSpawn: (child) => { child.stderr.write('unity: pipeline not installed\n'); },
  });
  assert.equal(code, 1);
  assert.match(err, /서버 stderr\(앞 500자\): unity: pipeline not installed/);
});

// ─────────────── UTF-8 멀티바이트 문자가 청크 경계에서 갈라질 때 ───────────────

const KOREAN_BODY = '씬이 준비됐다 — 컴파일 중 아님. 경로: Assets/씬/테스트 씬.unity 🎮';

test('한글 응답이 1바이트씩 쪼개져 도착해도 글자가 깨지지 않는다', async () => {
  const { code, out, err } = await run(baseOptions(), responderWith({
    'tools/call': (req) => utf8Chunks(okToolsCall(req.id, KOREAN_BODY), 1),
  }));
  assert.equal(code, 0);
  assert.ok(out.includes(KOREAN_BODY), `출력이 깨졌다: ${JSON.stringify(out)}`);
  assert.doesNotMatch(out, /�/, '대체 문자(U+FFFD)가 섞였다');
  assert.equal(err, '');
});

test('청크 크기를 바꿔 가며 갈라도 응답 본문이 바이트 단위로 보존된다', async () => {
  for (const size of [1, 2, 3, 5, 7]) {
    const { code, out } = await run(baseOptions(), (req) => {
      if (req.method === 'initialize') return utf8Chunks(okInitialize(req.id), size);
      if (req.method === 'tools/list') return utf8Chunks(okToolsList(req.id), size);
      return utf8Chunks(okToolsCall(req.id, KOREAN_BODY), size);
    });
    assert.equal(code, 0, `청크 ${size}바이트에서 실패했다`);
    assert.ok(out.includes(KOREAN_BODY), `청크 ${size}바이트에서 본문이 깨졌다: ${JSON.stringify(out)}`);
    assert.doesNotMatch(out, /�/, `청크 ${size}바이트에서 대체 문자가 생겼다`);
  }
});

test('한 청크가 여러 응답 줄에 걸쳐 있어도 모두 파싱한다', async () => {
  // 비 JSON 로그 + 실제 응답을 한 덩어리로 만든 뒤 큰 조각으로 잘라 보낸다
  const { code, out } = await run(baseOptions(), responderWith({
    initialize: (req) => utf8Chunks(
      `[info] 유니티 MCP 시작\n${JSON.stringify(okInitialize(req.id))}`,
      4,
    ),
  }));
  assert.equal(code, 0);
  assert.match(out, /\[1\/3\] initialize OK/);
});

test('서버 stderr 의 한글도 청크 경계에서 깨지지 않는다', async () => {
  const message = '유니티 파이프라인 패키지가 설치되지 않았습니다';
  const { code, err } = await run(
    baseOptions({ timeoutMs: 60 }),
    responderWith({ 'tools/call': () => null }),
    {
      onSpawn: (child) => {
        for (const chunk of utf8Chunks(message, 1)) child.stderr.write(chunk);
      },
    },
  );
  assert.equal(code, 1);
  assert.ok(err.includes(message), `stderr 가 깨졌다: ${JSON.stringify(err)}`);
  assert.doesNotMatch(err, /�/, '대체 문자(U+FFFD)가 섞였다');
});

// ──────────────────────────── 인수 파싱 ────────────────────────────

test('기본값은 editor_status·60000ms·저장소 unity 경로다', () => {
  const opts = smoke.parseOptions([], { defaultProjectPath: 'D:\\repo\\unity' });
  assert.equal(opts.toolName, smoke.DEFAULT_TOOL);
  assert.equal(opts.timeoutMs, smoke.DEFAULT_TIMEOUT_MS);
  assert.equal(opts.projectPath, 'D:\\repo\\unity');
  assert.deepEqual(opts.toolArgs, {});
  assert.equal(opts.unityBin, undefined);
});

test('공백 있는 경로와 JSON 객체 인수를 그대로 받는다', () => {
  const opts = smoke.parseOptions([
    '--project-path', PROJECT_WITH_SPACES,
    '--tool', 'open_scene',
    '--args', '{"path":"Assets/_CliSmoke/Cli Smoke.unity"}',
    '--timeout', '1500',
  ]);
  assert.equal(opts.projectPath, PROJECT_WITH_SPACES);
  assert.equal(opts.toolName, 'open_scene');
  assert.deepEqual(opts.toolArgs, { path: 'Assets/_CliSmoke/Cli Smoke.unity' });
  assert.equal(opts.timeoutMs, 1500);
});

test('알 수 없는 옵션을 거부한다', () => {
  assert.throws(() => smoke.parseOptions(['--project', 'x']), {
    name: 'Error', message: /알 수 없는 옵션: --project/,
  });
  assert.throws(() => smoke.parseOptions(['--project', 'x']), (e) => e instanceof smoke.UsageError);
});

test('값이 없는 옵션과 위치 인수를 거부한다', () => {
  assert.throws(() => smoke.parseOptions(['--tool']), /--tool 에 값이 없다/);
  assert.throws(() => smoke.parseOptions(['--tool', '--timeout', '100']), /--tool 에 값이 없다/);
  assert.throws(() => smoke.parseOptions(['editor_status']), /위치 인수는 받지 않는다/);
  assert.throws(() => smoke.parseOptions(['--tool', 'a', '--tool', 'b']), /옵션이 중복됐다/);
});

test('잘못된 JSON·비객체 --args 를 거부한다', () => {
  assert.throws(() => smoke.parseOptions(['--args', '{nope}']), /올바른 JSON 이 아니다/);
  assert.throws(() => smoke.parseOptions(['--args', '[1,2]']), /JSON 객체여야 한다/);
  assert.throws(() => smoke.parseOptions(['--args', '"text"']), /JSON 객체여야 한다/);
  assert.throws(() => smoke.parseOptions(['--args', 'null']), /JSON 객체여야 한다/);
});

test('유효하지 않은 timeout 을 거부한다', () => {
  for (const bad of ['0', '-1', 'abc', 'Infinity', 'NaN', '']) {
    assert.throws(
      () => smoke.parseOptions(['--timeout', bad || '--tool']),
      /정수 밀리초여야 한다|--timeout 에 값이 없다/,
      `timeout=${JSON.stringify(bad)} 를 통과시켰다`,
    );
  }
});

test('소수 timeout 은 조용히 반올림하지 않고 거부한다', () => {
  for (const bad of ['0.5', '1.5', '1500.5', '2147483646.999', '1e-3']) {
    assert.throws(
      () => smoke.parseOptions(['--timeout', bad]),
      /정수 밀리초여야 한다/,
      `timeout=${bad} 를 통과시켰다`,
    );
    assert.throws(() => smoke.parseOptions(['--timeout', bad]), (e) => e instanceof smoke.UsageError);
  }
});

test('setTimeout 상한을 넘는 timeout 을 거부한다 — 1ms 로 축소되면 즉시 시간 초과가 된다', () => {
  for (const bad of ['2147483648', '2147483650', '4294967296', '1e10', '9007199254740991']) {
    assert.throws(
      () => smoke.parseOptions(['--timeout', bad]),
      /정수 밀리초여야 한다/,
      `timeout=${bad} 를 통과시켰다`,
    );
  }
  // 거부 메시지는 축소 사실을 알려 준다 (Node 타이머 계약)
  assert.throws(() => smoke.parseOptions(['--timeout', '2147483648']), /1ms 로 축소한다/);
});

test('경계값 1 과 2147483647 은 그대로 받는다 — 타이머를 실제로 기다리지 않는다', () => {
  assert.equal(smoke.MIN_TIMEOUT_MS, 1);
  assert.equal(smoke.MAX_TIMEOUT_MS, 2147483647);
  assert.equal(smoke.parseOptions(['--timeout', '1']).timeoutMs, smoke.MIN_TIMEOUT_MS);
  assert.equal(smoke.parseOptions(['--timeout', '2147483647']).timeoutMs, smoke.MAX_TIMEOUT_MS);
  assert.equal(smoke.parseOptions(['--timeout', '2147483646']).timeoutMs, 2147483646);
  // 기본값도 허용 범위 안이다
  assert.ok(smoke.DEFAULT_TIMEOUT_MS >= smoke.MIN_TIMEOUT_MS
    && smoke.DEFAULT_TIMEOUT_MS <= smoke.MAX_TIMEOUT_MS);
});

// ─────────────────── Windows 실행 파일 (.EXE/.COM 만) ───────────────────

test('PATH 에 unity.exe 가 있으면 그 경로를 쓴다 — 공백 있는 디렉터리 포함', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unity smoke '));
  const exe = path.join(dir, 'unity.exe');
  fs.writeFileSync(exe, ''); // 존재만 확인할 뿐 실행하지 않는다
  try {
    const resolved = smoke.resolveUnityBin({
      platform: 'win32',
      env: { PATH: `C:\\nope${path.delimiter}${dir}` },
    });
    assert.equal(resolved, exe);
    assert.ok(resolved.includes(' '), '공백 있는 경로가 유지돼야 한다');
    assert.equal(smoke.assertSpawnableBin(exe, { platform: 'win32' }), exe);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('PATH 에 BAT/CMD 셰임뿐이면 거부하고 --unity-bin 을 안내한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unity shim '));
  fs.writeFileSync(path.join(dir, 'unity.cmd'), '');
  try {
    assert.throws(
      () => smoke.resolveUnityBin({ platform: 'win32', env: { PATH: dir } }),
      /BAT\/CMD 셰임만 있다[\s\S]*--unity-bin/,
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('PATH 에 unity 가 전혀 없으면 실행하지 않고 거부한다', () => {
  assert.throws(
    () => smoke.resolveUnityBin({ platform: 'win32', env: { PATH: 'C:\\nope' } }),
    /unity\.exe 를 찾지 못했다/,
  );
});

test('--unity-bin 이 .cmd/.bat 이거나 없으면 거부한다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unity bin '));
  const cmd = path.join(dir, 'unity.cmd');
  fs.writeFileSync(cmd, '');
  try {
    assert.throws(
      () => smoke.assertSpawnableBin(cmd, { platform: 'win32' }),
      /shell 없는 spawn 으로 \.cmd 을 실행할 수 없다/,
    );
    assert.throws(
      () => smoke.assertSpawnableBin(path.join(dir, 'missing.exe'), { platform: 'win32' }),
      /--unity-bin 경로가 없다/,
    );
    // POSIX 에서는 확장자를 요구하지 않는다
    assert.equal(smoke.assertSpawnableBin(cmd, { platform: 'linux' }), cmd);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ───────────────────────── CLI 종료 코드 ─────────────────────────

test('사용법 오류는 종료 코드 2 다', async () => {
  const originalWrite = process.stderr.write;
  let captured = '';
  process.stderr.write = (chunk) => { captured += chunk; return true; };
  try {
    const code = await smoke.main(['--bogus', 'x']);
    assert.equal(code, 2);
    assert.match(captured, /사용법 오류: 알 수 없는 옵션: --bogus/);
  } finally {
    process.stderr.write = originalWrite;
  }
});

test('--help 는 사용법을 찍고 0 이다', async () => {
  const originalWrite = process.stdout.write;
  let captured = '';
  process.stdout.write = (chunk) => { captured += chunk; return true; };
  try {
    const code = await smoke.main(['--help']);
    assert.equal(code, 0);
    assert.match(captured, /사용법: node tools\/unity\/mcp_smoke\.js/);
  } finally {
    process.stdout.write = originalWrite;
  }
});
