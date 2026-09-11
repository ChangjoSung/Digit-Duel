#!/usr/bin/env node
/**
 * unity_project_check.js 의 음성 대조 회귀 (#195).
 *
 * 실행: node --test tools/unity/ci/unity_project_check.test.js
 *
 * 왜 음성 대조인가
 *   "현재 트리가 통과한다"만 확인하는 검사는 **아무것도 보장하지 않는다** — 규칙이 조용히
 *   비활성화돼도 똑같이 초록이다. 그래서 각 규칙마다 그 규칙이 막아야 할 실제 회귀를 만들어
 *   넣고 정말 떨어지는지 본다. 구현을 그대로 베낀 대량 테스트는 만들지 않는다 —
 *   한 사례 = 기기·병합에서 실제로 났거나 날 수 있는 사고 하나다.
 *
 * 범위 — 정확히 읽을 것
 *   · 저장소를 수정하지 않는다. 모든 픽스처는 os.tmpdir() 아래 mkdtemp 로 만들고 끝나면 지운다.
 *   · Unity·Editor·MCP·dotnet 을 부르지 않는다. 검사기를 자식 프로세스로 돌릴 뿐이다.
 *   · 픽스처는 저장소의 **추적 파일**을 복사해 만들고 그 안에서 git init + git add 한다.
 *     검사기가 실제로 쓰는 `git ls-files` 경로를 그대로 태우기 위해서다.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const CHECKER = path.join(__dirname, 'unity_project_check.js');
const CONTRACT = path.join(__dirname, 'project-contract.json');
const REPO = path.resolve(__dirname, '..', '..', '..');

/** 픽스처에 복사할 추적 경로 — 검사기가 읽는 것 전부. */
const FIXTURE_PATHS = ['unity', 'tools/unity/build-android-apk.ps1'];

const TEMP_DIRS = [];
let baseFixture;

function makeTempDir(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TEMP_DIRS.push(dir);
  return dir;
}

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** 저장소의 추적 파일만 복사한 미니 저장소를 만든다. */
function buildBaseFixture() {
  const dir = makeTempDir('ddci-base-');
  const tracked = git(REPO, ['ls-files', '-z', '--', ...FIXTURE_PATHS]).split('\0').filter(Boolean);
  assert.ok(tracked.length > 100, `픽스처 원본이 너무 적다 (${tracked.length}). 저장소 경로를 확인한다.`);
  for (const relative of tracked) {
    const destination = path.join(dir, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(REPO, relative), destination);
  }
  initGit(dir);
  return dir;
}

function initGit(dir) {
  git(dir, ['init', '-q']);
  git(dir, ['add', '-A']);
}

/** 기본 픽스처를 복사해 격리된 작업본을 만든다. */
function cloneFixture() {
  const dir = makeTempDir('ddci-case-');
  fs.cpSync(baseFixture, dir, { recursive: true });
  return dir;
}

/** 파일을 더하거나 지운 뒤에는 인덱스를 다시 맞춰야 `git ls-files` 가 따라온다. */
function restage(dir) {
  git(dir, ['add', '-A']);
}

/**
 * unity/.gitignore 가 이미 막고 있는 경로를 일부러 추적시킨다.
 * C9 가 막으려는 사고가 정확히 이것이다 — 평범한 `git add` 로는 들어오지 않고,
 * `git add -f` 나 무시 규칙이 망가진 순간에 들어온다.
 */
function forceStage(dir, relative) {
  git(dir, ['add', '-f', '--', relative]);
}

function readFixture(dir, relative) {
  return fs.readFileSync(path.join(dir, relative), 'utf8');
}

function writeFixture(dir, relative, contents) {
  const destination = path.join(dir, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contents);
}

/** 파일 안에서 정확히 한 번 나오는 문자열을 바꾼다. 없거나 여러 번이면 테스트가 잘못된 것이다. */
function replaceOnce(dir, relative, from, to) {
  const text = readFixture(dir, relative);
  const occurrences = text.split(from).length - 1;
  assert.equal(occurrences, 1, `픽스처 치환 대상이 ${occurrences} 번 나온다 (${relative}): ${from}`);
  writeFixture(dir, relative, text.replace(from, to));
}

function removeFixture(dir, relative) {
  fs.rmSync(path.join(dir, relative), { recursive: true, force: true });
}

/** 검사기를 자식 프로세스로 돌린다. contract 를 바꾼 사례는 경로를 넘긴다. */
function runChecker(dir, { contract = CONTRACT } = {}) {
  const result = spawnSync(process.execPath, [CHECKER, '--root', dir, '--contract', contract, '--verbose'], {
    encoding: 'utf8',
  });
  return { code: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

/** 실패를 기대한다 — 지정한 규칙 코드가 이유에 있어야 한다. */
function expectFailure(dir, code, options) {
  const result = runChecker(dir, options);
  assert.equal(result.code, 1,
    `검사가 통과해 버렸다. ${code} 규칙이 비활성화됐다.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  assert.ok(result.stderr.includes(`[${code}]`),
    `다른 이유로 떨어졌다. ${code} 를 기대했다.\n${result.stderr}`);
  return result;
}

function expectPass(dir, options) {
  const result = runChecker(dir, options);
  assert.equal(result.code, 0, `통과해야 하는데 떨어졌다 — 오탐이다.\n${result.stderr}`);
  return result;
}

test.before(() => { baseFixture = buildBaseFixture(); });
test.after(() => {
  for (const dir of TEMP_DIRS) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 정리 실패는 테스트 결과가 아니다 */ }
  }
});

// ── 양성 대조 ────────────────────────────────────────────────────────────────

test('실제 저장소가 통과한다 — 게이트가 첫날부터 빨간 불이 아니다', () => {
  const result = runChecker(REPO);
  assert.equal(result.code, 0, `저장소가 검사에 걸린다:\n${result.stderr}`);
});

test('저장소 meta 로 풀리지 않는 씬 GUID 는 실패가 아니다 — 판정하지 않고 세기만 한다', () => {
  const result = expectPass(baseFixture);
  const note = result.stdout.match(/참조 GUID (\d+) 개 중 (\d+) 개가 저장소 meta 로 풀리지 않는다/);
  assert.ok(note, `미해소 GUID 집계를 출력하지 않았다:\n${result.stdout}`);
  assert.ok(Number(note[2]) > 0,
    'Boot.unity 에는 외부 참조가 있어야 한다. 0 이면 이 오탐 방지 사례가 무의미해진다.');
  assert.ok(result.stdout.includes('일 수 있으며'),
    `미해소 GUID 를 빌트인·UPM 이라고 단정해서는 안 된다. 확인할 방법이 없다:\n${result.stdout}`);
});

// ── C1. 프로젝트 트리·필수 파일 ──────────────────────────────────────────────

test('C1 unity/ 가 통째로 사라지면 실패한다 — skip 도 성공도 아니다', () => {
  const dir = cloneFixture();
  removeFixture(dir, 'unity');
  restage(dir);
  const result = expectFailure(dir, 'C1');
  assert.ok(result.stderr.includes('사라졌'), result.stderr);
});

test('C1 packages-lock.json 삭제를 잡는다', () => {
  const dir = cloneFixture();
  removeFixture(dir, 'unity/Packages/packages-lock.json');
  restage(dir);
  expectFailure(dir, 'C1');
});

// ── C2. Editor 버전 일관성 ───────────────────────────────────────────────────

test('C2 ProjectVersion.txt 만 다른 Editor 로 바뀌면 잡는다', () => {
  const dir = cloneFixture();
  writeFixture(dir, 'unity/ProjectSettings/ProjectVersion.txt',
    'm_EditorVersion: 6000.7.0f1\nm_EditorVersionWithRevision: 6000.7.0f1 (aaaaaaaaaaaa)\n');
  expectFailure(dir, 'C2');
});

test('C2 버전 상향이 절반만 되면 잡는다 — 프로젝트는 올렸는데 빌드 스크립트는 옛 Hub 경로', () => {
  const dir = cloneFixture();
  const contractPath = path.join(dir, 'contract.json');
  const contract = JSON.parse(fs.readFileSync(CONTRACT, 'utf8'));
  contract.editorVersion = { version: '6000.7.0f1', revision: 'aaaaaaaaaaaa' };
  fs.writeFileSync(contractPath, JSON.stringify(contract));
  writeFixture(dir, 'unity/ProjectSettings/ProjectVersion.txt',
    'm_EditorVersion: 6000.7.0f1\nm_EditorVersionWithRevision: 6000.7.0f1 (aaaaaaaaaaaa)\n');
  // build-android-apk.ps1 은 그대로 6000.6.0f1 을 가리킨다.
  const result = expectFailure(dir, 'C2', { contract: contractPath });
  assert.ok(result.stderr.includes('build-android-apk.ps1'), result.stderr);
});

// ── C3. 필수 Player 설정 ─────────────────────────────────────────────────────

test('C3 target SDK 가 Auto(0) 로 풀리면 잡는다 — 같은 소스가 다른 APK 를 낸다', () => {
  const dir = cloneFixture();
  replaceOnce(dir, 'unity/ProjectSettings/ProjectSettings.asset',
    '\n  AndroidTargetSdkVersion: 36\n', '\n  AndroidTargetSdkVersion: 0\n');
  expectFailure(dir, 'C3');
});

test('C3 ARM64 단독이 아닌 아키텍처를 잡는다', () => {
  const dir = cloneFixture();
  replaceOnce(dir, 'unity/ProjectSettings/ProjectSettings.asset',
    '\n  AndroidTargetArchitectures: 2\n', '\n  AndroidTargetArchitectures: 1\n');
  expectFailure(dir, 'C3');
});

test('C3 개인 keystore 사용이 켜지면 잡는다 — 공개 저장소에 개인키가 딸려 온다', () => {
  const dir = cloneFixture();
  replaceOnce(dir, 'unity/ProjectSettings/ProjectSettings.asset',
    '\n  androidUseCustomKeystore: 0\n', '\n  androidUseCustomKeystore: 1\n');
  expectFailure(dir, 'C3');
});

test('C3 상수 원본은 .cs 다 — 소스만 고치고 설정을 안 고치면 잡는다', () => {
  const dir = cloneFixture();
  replaceOnce(dir, 'unity/Assets/DigitDuel/Editor/Build/AndroidPlayerConfigurator.cs',
    '"com.creat2ve.digitduel.dev"', '"com.creat2ve.digitduel.qa"');
  const result = expectFailure(dir, 'C3');
  assert.ok(result.stderr.includes('applicationIdentifier'), result.stderr);
});

// ── C4. manifest ↔ lock ──────────────────────────────────────────────────────

test('C4 manifest 만 올리고 lock 을 안 갱신하면 잡는다', () => {
  const dir = cloneFixture();
  replaceOnce(dir, 'unity/Packages/manifest.json',
    '"com.unity.inputsystem": "1.20.0"', '"com.unity.inputsystem": "1.21.0"');
  expectFailure(dir, 'C4');
});

test('C4 승인되지 않은 레지스트리가 lock 에 들어오면 잡는다', () => {
  const dir = cloneFixture();
  const lock = JSON.parse(readFixture(dir, 'unity/Packages/packages-lock.json'));
  lock.dependencies['com.unity.inputsystem'].url = 'https://packages.example.invalid';
  writeFixture(dir, 'unity/Packages/packages-lock.json', JSON.stringify(lock, null, 2));
  expectFailure(dir, 'C4');
});

// ── C5. meta 짝 ──────────────────────────────────────────────────────────────

test('C5 .cs 의 .meta 가 사라지면 잡는다 — 다른 사람 Editor 가 새 GUID 를 발급해 참조가 끊긴다', () => {
  const dir = cloneFixture();
  removeFixture(dir, 'unity/Assets/DigitDuel/Runtime/Core/Primitives/GridCoord.cs.meta');
  restage(dir);
  expectFailure(dir, 'C5');
});

test('C5 본체는 지우고 meta 만 남은 경우를 잡는다', () => {
  const dir = cloneFixture();
  removeFixture(dir, 'unity/Assets/DigitDuel/Runtime/Core/Primitives/GridCoord.cs');
  restage(dir);
  expectFailure(dir, 'C5');
});

test('C5 빈 폴더의 folderAsset meta 는 통과한다 — git 은 빈 디렉터리를 추적하지 않는다', () => {
  const dir = cloneFixture();
  writeFixture(dir, 'unity/Assets/DigitDuel/Audio.meta',
    'fileFormatVersion: 2\nguid: 11112222333344445555666677778888\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n');
  restage(dir);
  expectPass(dir);
});

test('C5 folderAsset 이 아닌 짝 없는 meta 는 잡는다', () => {
  const dir = cloneFixture();
  writeFixture(dir, 'unity/Assets/DigitDuel/Audio.meta',
    'fileFormatVersion: 2\nguid: 11112222333344445555666677778888\nDefaultImporter:\n  externalObjects: {}\n');
  restage(dir);
  expectFailure(dir, 'C5');
});

test('C5 점이 든 폴더 이름의 빈 폴더 meta 도 통과한다 — 확장자로 폴더를 추측하지 않는다', () => {
  // My.Folder 는 Unity 에서 정상적인 폴더 이름이다. 스템의 확장자를 먼저 보면
  // 이 meta 가 '본체 없는 파일 meta' 로 오탐된다. folderAsset 이 권위다.
  const dir = cloneFixture();
  writeFixture(dir, 'unity/Assets/DigitDuel/My.Folder.meta',
    'fileFormatVersion: 2\nguid: 2222333344445555666677778888aaaa\nfolderAsset: yes\nDefaultImporter:\n  externalObjects: {}\n');
  restage(dir);
  expectPass(dir);
});

// ── C6. GUID 중복 ────────────────────────────────────────────────────────────

test('C6 GUID 중복을 잡는다 — 폴더를 복사하면 이렇게 되고 참조가 한쪽으로 쏠린다', () => {
  const dir = cloneFixture();
  const target = 'unity/Assets/DigitDuel/Runtime/Core/Primitives/GridCoord.cs.meta';
  const donor = readFixture(dir, 'unity/Assets/DigitDuel/Runtime/Core/Tables/ITable.cs.meta');
  const donorGuid = donor.match(/guid: ([0-9a-f]{32})/)[1];
  writeFixture(dir, target, readFixture(dir, target).replace(/guid: [0-9a-f]{32}/, `guid: ${donorGuid}`));
  expectFailure(dir, 'C6');
});

// ── C7. asmdef 그래프·경계 ───────────────────────────────────────────────────

test('C7 안쪽 층이 바깥 층을 참조하면 잡는다 (Core → Presentation)', () => {
  const dir = cloneFixture();
  const file = 'unity/Assets/DigitDuel/Runtime/Core/DigitDuel.Core.asmdef';
  const definition = JSON.parse(readFixture(dir, file));
  definition.references = ['DigitDuel.Presentation'];
  writeFixture(dir, file, JSON.stringify(definition, null, 4));
  expectFailure(dir, 'C7');
});

test('C7 Core 의 noEngineReferences 가 풀리면 잡는다 — 순수 C# 계약이 깨진다', () => {
  const dir = cloneFixture();
  const file = 'unity/Assets/DigitDuel/Runtime/Core/DigitDuel.Core.asmdef';
  const definition = JSON.parse(readFixture(dir, file));
  definition.noEngineReferences = false;
  writeFixture(dir, file, JSON.stringify(definition, null, 4));
  expectFailure(dir, 'C7');
});

test('C7 테스트 어셈블리의 UNITY_INCLUDE_TESTS 가 빠지면 잡는다 — Player 빌드에 테스트가 섞인다', () => {
  const dir = cloneFixture();
  const file = 'unity/Assets/DigitDuel/Tests/PlayMode/DigitDuel.Tests.PlayMode.asmdef';
  const definition = JSON.parse(readFixture(dir, file));
  definition.defineConstraints = [];
  writeFixture(dir, file, JSON.stringify(definition, null, 4));
  expectFailure(dir, 'C7');
});

test('C7 Editor 어셈블리가 전 플랫폼으로 풀리면 잡는다', () => {
  const dir = cloneFixture();
  const file = 'unity/Assets/DigitDuel/Editor/DigitDuel.Editor.asmdef';
  const definition = JSON.parse(readFixture(dir, file));
  definition.includePlatforms = [];
  writeFixture(dir, file, JSON.stringify(definition, null, 4));
  expectFailure(dir, 'C7');
});

test('C7 순수 C# 층의 엔진 참조를 잡는다 — 전역 external 목록이었다면 통과했을 것', () => {
  const dir = cloneFixture();
  const file = 'unity/Assets/DigitDuel/Runtime/Core/DigitDuel.Core.asmdef';
  const definition = JSON.parse(readFixture(dir, file));
  definition.references = ['UnityEngine.UI'];   // 다른 어셈블리에서는 정상인 이름이다
  writeFixture(dir, file, JSON.stringify(definition, null, 4));
  const result = expectFailure(dir, 'C7');
  assert.ok(result.stderr.includes('UnityEngine.UI'), result.stderr);
});

test('C7 런타임 어셈블리의 테스트 프레임워크 참조를 잡는다 — 어셈블리별 화이트리스트', () => {
  const dir = cloneFixture();
  const file = 'unity/Assets/DigitDuel/Runtime/Presentation/DigitDuel.Presentation.asmdef';
  const definition = JSON.parse(readFixture(dir, file));
  definition.references.push('UnityEditor.TestRunner');  // Tests.EditMode 에서는 정상인 이름이다
  writeFixture(dir, file, JSON.stringify(definition, null, 4));
  const result = expectFailure(dir, 'C7');
  assert.ok(result.stderr.includes('UnityEditor.TestRunner'), result.stderr);
});

test('C7 등록되지 않은 어셈블리 이름(오타)을 잡는다', () => {
  const dir = cloneFixture();
  const file = 'unity/Assets/DigitDuel/Runtime/Presentation/DigitDuel.Presentation.asmdef';
  const definition = JSON.parse(readFixture(dir, file));
  definition.references = definition.references.map((r) => (r === 'UnityEngine.UI' ? 'UnityEngine.Ui' : r));
  writeFixture(dir, file, JSON.stringify(definition, null, 4));
  const result = expectFailure(dir, 'C7');
  assert.ok(result.stderr.includes('알 수 없는'), result.stderr);
});

test('C7 asmdef 밖의 .cs 를 잡는다 — Assembly-CSharp 으로 들어가 계층이 무의미해진다', () => {
  const dir = cloneFixture();
  writeFixture(dir, 'unity/Assets/DigitDuel/Stray.cs', 'public static class Stray { }\n');
  writeFixture(dir, 'unity/Assets/DigitDuel/Stray.cs.meta',
    'fileFormatVersion: 2\nguid: aaaabbbbccccddddeeeeffff00001111\nMonoImporter:\n  externalObjects: {}\n');
  restage(dir);
  expectFailure(dir, 'C7');
});

test('C7 런타임 소스의 보호 없는 UnityEditor 를 잡는다 — Player 빌드가 깨진다', () => {
  const dir = cloneFixture();
  const file = 'unity/Assets/DigitDuel/Runtime/Core/Primitives/GridCoord.cs';
  writeFixture(dir, file, `using UnityEditor;\n${readFixture(dir, file)}`);
  expectFailure(dir, 'C7');
});

test('C7 #if UNITY_EDITOR 로 감싼 UnityEditor 는 통과한다 — 오탐을 내지 않는다', () => {
  const dir = cloneFixture();
  const file = 'unity/Assets/DigitDuel/Runtime/Core/Primitives/GridCoord.cs';
  writeFixture(dir, file, `#if UNITY_EDITOR\nusing UnityEditor;\n#endif\n${readFixture(dir, file)}`);
  expectPass(dir);
});

// 보호 인식은 `#if UNITY_EDITOR` 정확히 한 형태만 인정한다. 아래 세 가지는 문자열 포함
// 검사였다면 전부 "보호됨"으로 통과했을 것들이다 — 그중 둘은 Player 빌드를 실제로 깬다.
for (const [label, header] of [
  ['#if !UNITY_EDITOR — 오히려 플레이어 전용 블록이다', '#if !UNITY_EDITOR\nusing UnityEditor;\n#endif\n'],
  ['#if UNITY_EDITOR || UNITY_ANDROID — 플레이어에서도 켜진다', '#if UNITY_EDITOR || UNITY_ANDROID\nusing UnityEditor;\n#endif\n'],
  ['#if UNITY_EDITOR 의 #else 가지 — 에디터가 아닌 쪽이다', '#if UNITY_EDITOR\n#else\nusing UnityEditor;\n#endif\n'],
]) {
  test(`C7 ${label}`, () => {
    const dir = cloneFixture();
    const file = 'unity/Assets/DigitDuel/Runtime/Core/Primitives/GridCoord.cs';
    writeFixture(dir, file, header + readFixture(dir, file));
    expectFailure(dir, 'C7');
  });
}

// ── C8. 활성 빌드 씬 ─────────────────────────────────────────────────────────

test('C8 씬이 붙잡고 있던 스크립트가 사라지면 잡는다 — 기기에서 Missing script 로만 드러나던 회귀', () => {
  const dir = cloneFixture();
  removeFixture(dir, 'unity/Assets/DigitDuel/Runtime/Presentation/Boot/BootRoot.cs');
  removeFixture(dir, 'unity/Assets/DigitDuel/Runtime/Presentation/Boot/BootRoot.cs.meta');
  restage(dir);
  expectFailure(dir, 'C8');
});

test('C8 씬의 meta GUID 가 바뀌었는데 EditorBuildSettings 가 옛 값이면 잡는다', () => {
  const dir = cloneFixture();
  replaceOnce(dir, 'unity/Assets/DigitDuel/Scenes/Boot.unity.meta',
    'guid: 831f4e99dae8a374183107f8155fac56', 'guid: 99999999999999999999999999999999');
  expectFailure(dir, 'C8');
});

test('C8 활성 빌드 씬이 늘어나면 잡는다 — 최소 부팅 검증 범위가 조용히 바뀐다', () => {
  const dir = cloneFixture();
  replaceOnce(dir, 'unity/ProjectSettings/EditorBuildSettings.asset',
    '    guid: 831f4e99dae8a374183107f8155fac56\n',
    '    guid: 831f4e99dae8a374183107f8155fac56\n' +
    '  - enabled: 1\n    path: Assets/Settings/Scenes/URP2DSceneTemplate.unity\n' +
    '    guid: 11111111111111111111111111111111\n');
  expectFailure(dir, 'C8');
});

// ── C9. 잘못 추적된 캐시·산출물·자격증명 ─────────────────────────────────────

test('C9 APK 가 강제로 추적되면 잡는다 — unity/.gitignore 를 우회한 경우', () => {
  const dir = cloneFixture();
  writeFixture(dir, 'unity/Builds/Android/DigitDuel-dev.apk', 'not really an apk');
  forceStage(dir, 'unity/Builds/Android/DigitDuel-dev.apk');
  expectFailure(dir, 'C9');
});

test('C9 자격증명 파일이 추적되면 잡는다 — 이 저장소는 공개다', () => {
  const dir = cloneFixture();
  writeFixture(dir, 'unity/release.keystore', 'not really a keystore');
  restage(dir);
  expectFailure(dir, 'C9');
});

test('C9 Editor/Build 아래 정상 소스는 통과한다 — 경로 앵커 오탐 방지', () => {
  // 부분 문자열로 'Build/' 를 맞추면 Assets/DigitDuel/Editor/Build/*.cs 가 전부 걸린다(실측).
  const dir = cloneFixture();
  writeFixture(dir, 'unity/Assets/DigitDuel/Editor/Build/BuildNotes.cs',
    'namespace DigitDuel.Editor.Build { internal static class BuildNotes { } }\n');
  writeFixture(dir, 'unity/Assets/DigitDuel/Editor/Build/BuildNotes.cs.meta',
    'fileFormatVersion: 2\nguid: 1234123412341234123412341234abcd\nMonoImporter:\n  externalObjects: {}\n');
  restage(dir);
  expectPass(dir);
});
