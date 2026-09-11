#!/usr/bin/env node
/**
 * Unity MCP stdio 스모크 — 설정 파일 존재가 아니라 "실제 MCP 호출"을 증명한다. (#183)
 *
 * 하는 일: `unity mcp --project-path <프로젝트>` 를 stdio 로 띄우고 JSON-RPC 로
 *   1) initialize  2) tools/list  3) tools/call(--tool 로 지정한 도구)
 * 를 실행한 뒤 **응답 구조를 검증하고** 요약 출력한다.
 *
 * 응답 검증 계약 — MCP 2024-11-05 lifecycle
 * (https://modelcontextprotocol.io/specification/2024-11-05/basic/lifecycle):
 *   - 세 호출 모두 `jsonrpc:"2.0"` 과 **객체 result** 를 요구한다. result 가 없거나
 *     객체가 아니거나 error 가 오면 종료 0 이 될 수 없다.
 *   - initialize: 명세가 server capabilities 와 server information 을 **필수**로 정한다.
 *     · result.protocolVersion 은 이 클라이언트가 지원하는 버전이어야 한다(현재 2024-11-05 뿐).
 *       지원하지 않는 버전을 돌려주면 협상 실패로 보고 연결을 끊는다.
 *     · result.capabilities 는 객체여야 한다.
 *     · result.serverInfo 는 비어 있지 않은 name 과 version 을 가진 객체여야 한다.
 *   - tools/list 는 서버가 `capabilities.tools` 를 **객체로 광고했을 때만** 보낸다.
 *     광고하지 않은 기능을 호출하지 않는다는 lifecycle 규칙이다.
 *   - tools/list: result.tools 는 배열이고 각 원소는 문자열 name 을 가진 객체여야 한다.
 *   - tools/call: result.content 는 배열이고 각 원소는 문자열 type 을 가진 객체,
 *     result.isError 는 있으면 boolean 이어야 한다.
 *   - isError=true 는 **실패**다. stdout 에 OK 를 쓰지 않고 오류 요약을 stderr 에 쓴 뒤 1 로 끝난다.
 *
 * 변경 범위 — 정확히 읽을 것:
 *   - 기본값(--tool 생략 = editor_status)일 때만 읽기 전용이다.
 *   - --tool 은 Pipeline 에 등록된 **임의의** 도구를 받는다. create_scene·delete_asset·
 *     set_player_settings 처럼 프로젝트·씬·에셋을 실제로 바꾸는 도구도 그대로 실행된다.
 *     이 스크립트는 도구 이름을 검열하지 않으며 destructive 도구의 confirm 도 --args 로 넘긴다.
 *   - 따라서 변경형 도구를 쓸 때는 전용 임시 씬·폴더(#183 검증에서는 Assets/_CliSmoke/)로
 *     범위를 한정하고, 끝나면 지우고 원래 씬을 다시 연다. 제품 씬에 직접 쓰지 않는다.
 *   - 이 스크립트는 Editor 를 열거나 닫지 않는다. 이미 떠 있는 Editor 에 붙을 뿐이다.
 *
 * --timeout 의 의미 (Saturn 수정 요청 4 반영):
 *   요청 **하나**에 대한 응답 대기 상한이며 전체 실행 시간 예산이 아니다. 시간이 초과되면
 *   이 프로세스는 기다리기를 그만두고 서버를 종료할 뿐, **Editor 안에서 이미 시작된 변경을
 *   취소하거나 롤백하지 않는다.** 변경형 --tool 이 시간 초과로 실패했다면 반영 여부는
 *   `unity command get_scene_hierarchy` 같은 별도 조회로 직접 확인해야 한다.
 *
 * --timeout 의 허용 범위 (Saturn 재검수 P2 반영):
 *   **정수 1 ~ 2147483647 ms 만 받는다.** Node 의 setTimeout 은 delay 가 32 비트 부호 있는
 *   정수 범위를 넘거나 1 보다 작으면 **1 ms 로 축소**하고 경고만 낸다
 *   (https://nodejs.org/api/timers.html#settimeoutcallback-delay-args).
 *   그래서 2147483648 을 그대로 받으면 "약 25 일 대기"가 아니라 사실상 **즉시 시간 초과**가 되어
 *   사용자가 지정한 값과 실제 동작이 어긋난다. 소수(0.5·1500.5)도 문서의 정수 계약과 다르므로
 *   축소·반올림해 삼키지 않고 사용법 오류(종료 2)로 거부한다.
 *
 * Windows 실행 파일 (Saturn 수정 요청 3 반영):
 *   shell 없는 spawn 은 Windows 에서 .BAT/.CMD 를 실행할 수 없고, shell:true 는 인수를
 *   이스케이프 없이 이어 붙여(DEP0190) 공백 있는 경로를 깨뜨린다. 그래서 이 스크립트는
 *   **.EXE/.COM 만 허용**하고, PATH 에 .BAT/.CMD 셰임뿐이면 실행을 거부하면서
 *   `--unity-bin <실제 .exe 경로>` 를 안내한다. BAT/CMD 를 대신 실행해 주지 않는다.
 *
 * 사용법:
 *   node tools/unity/mcp_smoke.js [--project-path <경로>] [--tool <이름>] [--args <JSON 객체>]
 *                                 [--timeout <정수 1..2147483647 ms>] [--unity-bin <실행 파일>] [--help]
 * 기본값: --project-path <저장소>/unity, --tool editor_status, --timeout 60000,
 *         --unity-bin 은 PATH 에서 찾은 unity.exe
 *
 * 종료 코드: 0 성공 / 1 실행·프로토콜 실패(요약을 stderr 에 출력) / 2 사용법 오류
 */
'use strict';

const { spawn } = require('node:child_process');
const { StringDecoder } = require('node:string_decoder');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_TOOL = 'editor_status';
const DEFAULT_TIMEOUT_MS = 60000;
// Node setTimeout 의 delay 상한. 이를 넘기면 1ms 로 축소되므로 여기서 미리 거부한다.
// https://nodejs.org/api/timers.html#settimeoutcallback-delay-args
const MAX_TIMEOUT_MS = 2147483647;
const MIN_TIMEOUT_MS = 1;
// 이 클라이언트가 말할 수 있는 MCP 버전. 서버가 이 밖의 버전을 돌려주면 협상 실패다.
const CLIENT_PROTOCOL_VERSION = '2024-11-05';
const SUPPORTED_PROTOCOL_VERSIONS = [CLIENT_PROTOCOL_VERSION];
const VALUE_FLAGS = new Set(['project-path', 'tool', 'args', 'timeout', 'unity-bin']);
const BOOL_FLAGS = new Set(['help']);
const WIN_EXEC_EXTS = ['.exe', '.com']; // shell 없이 직접 spawn 가능한 것만

const USAGE = [
  '사용법: node tools/unity/mcp_smoke.js [--project-path <경로>] [--tool <이름>]',
  `                                      [--args <JSON 객체>] [--timeout <정수 ${MIN_TIMEOUT_MS}..${MAX_TIMEOUT_MS} ms>]`,
  '                                      [--unity-bin <.exe 경로>] [--help]',
  `기본값: --project-path <저장소>/unity, --tool ${DEFAULT_TOOL}, --timeout ${DEFAULT_TIMEOUT_MS}`,
].join('\n');

class UsageError extends Error {}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function preview(value, limit = 300) {
  let text;
  try { text = JSON.stringify(value); } catch { text = String(value); }
  if (text === undefined) text = String(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function must(condition, message) {
  if (!condition) throw new Error(message);
}

/** 알 수 없는 옵션·값 누락·잘못된 JSON·유효하지 않은 timeout 을 모두 거부한다. */
function parseOptions(argv, deps = {}) {
  const defaultProjectPath = deps.defaultProjectPath
    || path.resolve(__dirname, '..', '..', 'unity');
  const raw = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      throw new UsageError(`위치 인수는 받지 않는다: ${token}`);
    }
    const name = token.slice(2);
    if (BOOL_FLAGS.has(name)) { raw[name] = true; continue; }
    if (!VALUE_FLAGS.has(name)) {
      throw new UsageError(`알 수 없는 옵션: --${name}`);
    }
    if (Object.prototype.hasOwnProperty.call(raw, name)) {
      throw new UsageError(`옵션이 중복됐다: --${name}`);
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new UsageError(`--${name} 에 값이 없다`);
    }
    raw[name] = value;
    i += 1;
  }

  if (raw.help) return { help: true };

  const projectPath = raw['project-path'] === undefined
    ? defaultProjectPath
    : raw['project-path'].trim();
  if (!projectPath) throw new UsageError('--project-path 가 비어 있다');

  const toolName = raw.tool === undefined ? DEFAULT_TOOL : raw.tool.trim();
  if (!toolName) throw new UsageError('--tool 이 비어 있다');

  let toolArgs = {};
  if (raw.args !== undefined) {
    try {
      toolArgs = JSON.parse(raw.args);
    } catch (err) {
      throw new UsageError(`--args 가 올바른 JSON 이 아니다: ${err.message}`);
    }
    if (!isPlainObject(toolArgs)) {
      throw new UsageError('--args 는 JSON 객체여야 한다 (tools/call 의 arguments)');
    }
  }

  let timeoutMs = DEFAULT_TIMEOUT_MS;
  if (raw.timeout !== undefined) {
    timeoutMs = Number(raw.timeout);
    // Number.isInteger 가 소수·NaN·Infinity 를 함께 걸러낸다. 상한은 setTimeout 이 1ms 로
    // 축소하는 경계(2^31-1)다 — 조용히 축소해 "즉시 시간 초과"로 둔갑시키지 않는다.
    if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
      throw new UsageError(
        `--timeout 은 ${MIN_TIMEOUT_MS} 이상 ${MAX_TIMEOUT_MS} 이하의 정수 밀리초여야 한다: ${raw.timeout} `
        + '(Node setTimeout 은 이 범위를 벗어난 delay 를 1ms 로 축소한다)',
      );
    }
  }

  return {
    help: false,
    projectPath,
    toolName,
    toolArgs,
    timeoutMs,
    unityBin: raw['unity-bin'],
  };
}

/** Windows 에서는 shell 없이 직접 실행 가능한 .EXE/.COM 만 허용한다. */
function assertSpawnableBin(binPath, deps = {}) {
  const platform = deps.platform || process.platform;
  const exists = deps.exists || fs.existsSync;
  if (!exists(binPath)) {
    throw new UsageError(`--unity-bin 경로가 없다: ${binPath}`);
  }
  if (platform === 'win32') {
    const ext = path.extname(binPath).toLowerCase();
    if (!WIN_EXEC_EXTS.includes(ext)) {
      throw new UsageError(
        `Windows 에서는 shell 없는 spawn 으로 ${ext || '확장자 없는 파일'} 을 실행할 수 없다. `
        + `.EXE/.COM 경로를 지정한다: ${binPath}`,
      );
    }
  }
  return binPath;
}

/** PATH 에서 unity 실행 파일을 찾는다. .BAT/.CMD 셰임뿐이면 거부하고 안내한다. */
function resolveUnityBin(deps = {}) {
  const platform = deps.platform || process.platform;
  const env = deps.env || process.env;
  const exists = deps.exists || fs.existsSync;
  const dirs = (env.PATH || env.Path || '').split(path.delimiter).filter(Boolean);

  if (platform !== 'win32') {
    for (const dir of dirs) {
      const candidate = path.join(dir, 'unity');
      if (exists(candidate)) return candidate;
    }
    return 'unity'; // POSIX 는 spawn 이 PATH 를 다시 찾는다
  }

  const shims = [];
  for (const dir of dirs) {
    for (const ext of WIN_EXEC_EXTS) {
      const candidate = path.join(dir, `unity${ext}`);
      if (exists(candidate)) return candidate;
    }
    for (const ext of ['.bat', '.cmd']) {
      const candidate = path.join(dir, `unity${ext}`);
      if (exists(candidate)) shims.push(candidate);
    }
  }
  if (shims.length > 0) {
    throw new UsageError(
      `PATH 에 unity 의 BAT/CMD 셰임만 있다(${shims[0]}). shell 없는 spawn 으로는 실행할 수 없으니 `
      + '--unity-bin 으로 실제 unity.exe 경로를 지정한다.',
    );
  }
  throw new UsageError(
    'PATH 에서 unity.exe 를 찾지 못했다. --unity-bin 으로 실행 파일 경로를 지정한다.',
  );
}

/** JSON-RPC 응답 봉투를 검증하고 result 객체를 돌려준다. */
function assertResult(msg, method) {
  must(isPlainObject(msg), `${method}: 응답이 JSON 객체가 아니다 (${preview(msg)})`);
  must(msg.jsonrpc === '2.0', `${method}: jsonrpc 가 "2.0" 이 아니다 (${preview(msg.jsonrpc)})`);
  if (msg.error !== undefined) {
    throw new Error(`${method} 실패: ${preview(msg.error)}`);
  }
  must(isPlainObject(msg.result), `${method}: result 가 없거나 객체가 아니다 (${preview(msg)})`);
  return msg.result;
}

/** lifecycle 이 요구하는 protocolVersion 협상·server capabilities·server information 을 강제한다. */
function assertInitializeResult(msg) {
  const result = assertResult(msg, 'initialize');
  must(
    typeof result.protocolVersion === 'string' && result.protocolVersion.length > 0,
    `initialize: result.protocolVersion 문자열이 없다 (${preview(result)})`,
  );
  must(
    SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion),
    `initialize: 이 클라이언트가 지원하지 않는 protocolVersion 이다 — 서버 ${preview(result.protocolVersion)}, `
    + `지원 ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}`,
  );
  must(
    isPlainObject(result.capabilities),
    `initialize: result.capabilities 객체가 없다 (${preview(result)})`,
  );
  must(
    isPlainObject(result.serverInfo),
    `initialize: result.serverInfo 객체가 없다 (${preview(result)})`,
  );
  must(
    typeof result.serverInfo.name === 'string' && result.serverInfo.name.length > 0,
    `initialize: result.serverInfo.name 이 없다 (${preview(result.serverInfo)})`,
  );
  must(
    typeof result.serverInfo.version === 'string' && result.serverInfo.version.length > 0,
    `initialize: result.serverInfo.version 이 없다 (${preview(result.serverInfo)})`,
  );
  return result;
}

/** 광고하지 않은 기능은 호출하지 않는다 — tools/list 전에 tools capability 를 확인한다. */
function assertToolsCapability(initResult) {
  must(
    isPlainObject(initResult.capabilities.tools),
    `initialize: 서버가 tools capability 를 객체로 광고하지 않았다 — tools/list 를 보내지 않는다 `
    + `(${preview(initResult.capabilities)})`,
  );
  return initResult.capabilities.tools;
}

function assertToolsListResult(msg) {
  const result = assertResult(msg, 'tools/list');
  must(Array.isArray(result.tools), `tools/list: result.tools 가 배열이 아니다 (${preview(result)})`);
  result.tools.forEach((tool, index) => {
    must(
      isPlainObject(tool) && typeof tool.name === 'string' && tool.name.length > 0,
      `tools/list: tools[${index}] 에 문자열 name 이 없다 (${preview(tool)})`,
    );
  });
  return result;
}

function assertToolsCallResult(msg, toolName) {
  const result = assertResult(msg, `tools/call(${toolName})`);
  must(
    Array.isArray(result.content),
    `tools/call(${toolName}): result.content 가 배열이 아니다 (${preview(result)})`,
  );
  result.content.forEach((item, index) => {
    must(
      isPlainObject(item) && typeof item.type === 'string' && item.type.length > 0,
      `tools/call(${toolName}): content[${index}] 에 문자열 type 이 없다 (${preview(item)})`,
    );
  });
  must(
    result.isError === undefined || typeof result.isError === 'boolean',
    `tools/call(${toolName}): result.isError 가 boolean 이 아니다 (${preview(result.isError)})`,
  );
  return result;
}

function contentText(result) {
  return (result.content || [])
    .map((item) => (typeof item.text === 'string' ? item.text : ''))
    .filter(Boolean)
    .join('\n');
}

/**
 * 실제 실행부. spawn·출력은 주입 가능해서 테스트가 가짜 자식 프로세스로 프로토콜 회귀를 돌린다.
 * throw 하지 않고 종료 코드(0/1)를 돌려준다.
 */
async function runSmoke(options, deps = {}) {
  const spawnFn = deps.spawn || spawn;
  const log = deps.log || ((line) => process.stdout.write(`${line}\n`));
  const logErr = deps.logErr || ((line) => process.stderr.write(`${line}\n`));

  let child;
  try {
    child = spawnFn(options.unityBin, ['mcp', '--project-path', options.projectPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (err) {
    logErr(`실패: unity mcp 실행 실패(${options.unityBin}): ${err.message}`);
    return 1;
  }

  let serverStderr = '';
  const pending = new Map();
  const rejecters = new Map();
  const timers = new Set();
  let spawnFailure = null;
  let finished = false;
  let buffer = '';

  // 청크마다 Buffer.toString() 하면 한글처럼 여러 바이트인 문자가 청크 경계에서 갈라질 때
  // 조각마다 U+FFFD 로 바뀐다 — 파이프는 바이트 스트림이라 경계는 임의다. StringDecoder 는
  // 불완전한 선행 바이트를 다음 청크까지 들고 있어 문자가 그대로 살아남는다.
  const stdoutDecoder = new StringDecoder('utf8');
  const stderrDecoder = new StringDecoder('utf8');
  // 스트림에 인코딩이 걸려 이미 문자열로 오는 경우에는 그대로 쓴다 (StringDecoder 는 Buffer 전용).
  function decodeChunk(decoder, chunk) {
    return typeof chunk === 'string' ? chunk : decoder.write(chunk);
  }

  // unity 바이너리를 못 찾거나 서버가 응답 전에 죽으면 요청이 영원히 매달린다 — 즉시 깨뜨린다.
  function failAll(err) {
    spawnFailure = err;
    for (const [, reject] of rejecters) reject(err);
    rejecters.clear();
    pending.clear();
  }

  child.stderr.on('data', (b) => { serverStderr += decodeChunk(stderrDecoder, b); });
  child.on('error', (err) => failAll(new Error(`unity mcp 실행 실패(${options.unityBin}): ${err.message}`)));
  child.on('exit', (code, signal) => {
    if (!finished) failAll(new Error(`unity mcp 가 응답 전에 종료했다 (code=${code}, signal=${signal})`));
  });
  if (child.stdin && typeof child.stdin.on === 'function') {
    child.stdin.on('error', (err) => failAll(new Error(`unity mcp stdin 쓰기 실패: ${err.message}`)));
  }
  child.stdout.on('data', (b) => {
    buffer += decodeChunk(stdoutDecoder, b);
    let nl;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; } // 서버가 섞어 쓰는 비 JSON 로그는 무시
      if (isPlainObject(msg) && msg.id !== undefined && pending.has(msg.id)) {
        const resolve = pending.get(msg.id);
        pending.delete(msg.id);
        rejecters.delete(msg.id);
        resolve(msg);
      }
    }
  });

  let nextId = 1;
  function request(method, params) {
    const id = nextId;
    nextId += 1;
    return new Promise((resolve, reject) => {
      if (spawnFailure) { reject(spawnFailure); return; }
      // 요청 하나에 대한 대기 상한이다. 초과해도 Editor 쪽 변경은 취소·롤백되지 않는다.
      const timer = setTimeout(() => {
        timers.delete(timer);
        pending.delete(id);
        rejecters.delete(id);
        reject(new Error(
          `timeout: ${method} 응답이 ${options.timeoutMs}ms 안에 오지 않았다 — `
          + '요청별 대기 상한일 뿐이며 이미 시작된 변경을 취소·롤백하지 않는다',
        ));
      }, options.timeoutMs);
      timers.add(timer);
      rejecters.set(id, (err) => { clearTimeout(timer); timers.delete(timer); reject(err); });
      pending.set(id, (msg) => { clearTimeout(timer); timers.delete(timer); resolve(msg); });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }
  function notify(method, params) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
  }

  function cleanup() {
    finished = true;
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    try { child.kill(); } catch { /* 이미 죽었으면 무시 */ }
  }

  try {
    const init = assertInitializeResult(await request('initialize', {
      protocolVersion: CLIENT_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'digit-duel-mcp-smoke', version: '1.0.0' },
    }));
    notify('notifications/initialized', {});
    log(`[1/3] initialize OK — server=${init.serverInfo.name} ${init.serverInfo.version} protocol=${init.protocolVersion}`);

    assertToolsCapability(init); // 광고 없으면 tools/list 를 보내지 않는다
    const list = assertToolsListResult(await request('tools/list', {}));
    const tools = list.tools;
    log(`[2/3] tools/list OK — ${tools.length}개, 예: ${tools.slice(0, 5).map((t) => t.name).join(', ')}`);
    if (!tools.some((t) => t.name === options.toolName)) {
      throw new Error(`tools/list 에 ${options.toolName} 없음`);
    }

    const call = assertToolsCallResult(
      await request('tools/call', { name: options.toolName, arguments: options.toolArgs }),
      options.toolName,
    );
    const text = contentText(call);
    if (call.isError === true) {
      // 실패다. stdout 에 OK 를 쓰지 않고 요약을 stderr 로 보낸다.
      logErr(`[3/3] tools/call(${options.toolName}) 실패 — isError=true`);
      logErr(text ? text.slice(0, 1200) : '(오류 본문 없음)');
      if (serverStderr.trim()) logErr(`서버 stderr(앞 500자): ${serverStderr.slice(0, 500)}`);
      cleanup();
      return 1;
    }
    log(`[3/3] tools/call(${options.toolName}) OK — isError=false`);
    log(text.slice(0, 1200));
    cleanup();
    return 0;
  } catch (err) {
    logErr(`실패: ${err.message}`);
    if (serverStderr.trim()) logErr(`서버 stderr(앞 500자): ${serverStderr.slice(0, 500)}`);
    cleanup();
    return 1;
  }
}

async function main(argv) {
  let options;
  try {
    options = parseOptions(argv);
    if (options.help) {
      process.stdout.write(`${USAGE}\n`);
      return 0;
    }
    options.unityBin = options.unityBin
      ? assertSpawnableBin(options.unityBin)
      : resolveUnityBin();
  } catch (err) {
    if (err instanceof UsageError) {
      process.stderr.write(`사용법 오류: ${err.message}\n${USAGE}\n`);
      return 2;
    }
    process.stderr.write(`실패: ${err.message}\n`);
    return 1;
  }
  return runSmoke(options);
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}

module.exports = {
  UsageError,
  USAGE,
  parseOptions,
  resolveUnityBin,
  assertSpawnableBin,
  assertInitializeResult,
  assertToolsCapability,
  assertToolsListResult,
  assertToolsCallResult,
  runSmoke,
  main,
  DEFAULT_TOOL,
  DEFAULT_TIMEOUT_MS,
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  CLIENT_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
};
