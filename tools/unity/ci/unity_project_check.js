#!/usr/bin/env node
/**
 * Unity 프로젝트 구조 검사 (#195) — **Unity 없이** 도는 추적 파일 정적 검사다.
 *
 * 무엇이 아닌지 먼저 읽을 것:
 *   - C# 을 컴파일하지 않는다. Editor 를 열지 않는다. EditMode·PlayMode 를 돌리지 않는다.
 *     APK 를 만들지 않는다. 라이선스도 secret 도 쓰지 않는다.
 *   - 이 검사가 초록이어도 "Unity 프로젝트가 컴파일된다"는 보장은 **없다**.
 *     Core·Application 두 층의 실제 컴파일은 tools/unity/ci/compile 의 csproj 가 따로 본다.
 *
 * 무엇을 보는가 (전부 **git 이 추적하는 파일**만 본다 — 작업 트리의 무시된 산출물은 대상이 아니다):
 *   C1 프로젝트 트리·필수 파일 존재 (unity/ 가 없거나 필수 파일이 지워지면 실패)
 *   C2 Editor 버전 일관성 (ProjectVersion.txt ↔ 계약 ↔ 빌드 스크립트의 Hub 경로)
 *   C3 필수 Player 설정 (ProjectSettings.asset ↔ AndroidPlayerConfigurator.cs 의 const)
 *   C4 manifest 직접 의존성 ↔ packages-lock 고정·레지스트리
 *   C5 meta 짝 (Assets 루트 제외 · 빈 폴더의 folderAsset meta 허용)
 *   C6 GUID 중복
 *   C7 asmdef 그래프·경계 · Editor/Test 격리 · asmdef 밖 .cs · 런타임의 UnityEditor 누출
 *   C8 활성 빌드 씬의 파일·GUID 무결성
 *   C9 잘못 추적된 캐시·산출물·자격증명
 *
 * 알아 둘 판정 경계 두 가지:
 *   · 씬의 미해소 GUID 는 **세기만 하고 판정하지 않는다**. Library/PackageCache 를 추적하지 않아
 *     빌트인·UPM 인지 확인할 방법이 없다. 우리 자산이 사라진 경우는 계약의 mustReferenceAssets 가
 *     이름을 대고 잡는다.
 *   · 런타임의 UnityEditor 누출 검사는 전처리기 **어휘 검사**이지 C# 파서가 아니다. 보호로
 *     인정하는 형태는 정확히 `#if UNITY_EDITOR` 하나다 (unguardedEditorUse 주석 참조).
 *
 * 기대값은 전부 tools/unity/ci/project-contract.json 에 있다. 이 파일에는 숫자를 적지 않는다.
 *
 * 사용법:
 *   node tools/unity/ci/unity_project_check.js [--root <저장소>] [--contract <경로>] [--verbose]
 * 종료 코드: 0 통과 / 1 검사 실패 / 2 사용법·환경 오류
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const USAGE = `사용법: node tools/unity/ci/unity_project_check.js [--root <저장소 경로>] [--contract <경로>] [--verbose]`;

// ─────────────────────────────────────────────────────────────────────────────
// 인자
// ─────────────────────────────────────────────────────────────────────────────
function parseOptions(argv) {
  const opts = { root: process.cwd(), contract: null, verbose: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--verbose') { opts.verbose = true; continue; }
    if (arg === '--help' || arg === '-h') { opts.help = true; continue; }
    if (arg === '--root' || arg === '--contract') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new UsageError(`${arg} 에 값이 없다.`);
      }
      opts[arg === '--root' ? 'root' : 'contract'] = value;
      i += 1;
      continue;
    }
    throw new UsageError(`알 수 없는 인자: ${arg}`);
  }
  opts.root = path.resolve(opts.root);
  opts.contract = opts.contract
    ? path.resolve(opts.contract)
    : path.join(__dirname, 'project-contract.json');
  return opts;
}

class UsageError extends Error {}

// ─────────────────────────────────────────────────────────────────────────────
// 도움 함수
// ─────────────────────────────────────────────────────────────────────────────

/** git 이 추적하는 경로 목록 (저장소 루트 기준 슬래시 경로). */
function trackedFiles(root) {
  let out;
  try {
    out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    throw new UsageError(`git ls-files 실패 (${root}): ${error.message}`);
  }
  return out.split('\0').filter(Boolean).map((p) => p.replace(/\\/g, '/'));
}

function readText(root, relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

/**
 * Unity 직렬화 YAML 에서 한 키의 스칼라를 읽는다.
 * 전체 YAML 파서를 쓰지 않는 이유: Unity 의 `--- !u!129 &1` 태그·앵커는 일반 파서가 거부하고,
 * 여기서 필요한 것은 최상위 들여쓰기 2칸 키의 스칼라 몇 개뿐이다.
 */
function yamlScalar(text, key) {
  const match = text.match(new RegExp(`^\\s{2}${escapeRegExp(key)}:[ \\t]*(.*)$`, 'm'));
  return match ? match[1].trim() : undefined;
}

/** `key:` 아래 들여쓰기된 `sub: value` 를 읽는다 (scriptingBackend.Android 같은 플랫폼 맵). */
function yamlNestedScalar(text, key, sub) {
  const block = text.match(new RegExp(`^\\s{2}${escapeRegExp(key)}:[ \\t]*\\n((?:\\s{4}.*\\n)*)`, 'm'));
  if (!block) return undefined;
  const line = block[1].match(new RegExp(`^\\s{4}${escapeRegExp(sub)}:[ \\t]*(.*)$`, 'm'));
  return line ? line[1].trim() : undefined;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseJson(root, relative) {
  const raw = readText(root, relative);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new CheckError(`${relative} 가 올바른 JSON 이 아니다: ${error.message}`);
  }
}

class CheckError extends Error {}

/** 경로의 첫 구획이 dir 인가 — 부분 문자열 매칭 금지. */
function firstSegmentIs(relativeToProject, dir) {
  const segments = relativeToProject.split('/');
  return segments.length > 1 && segments[0] === dir;
}

// ─────────────────────────────────────────────────────────────────────────────
// 본체
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @returns {{failures: string[], notes: string[], stats: object}}
 */
function check(opts) {
  const failures = [];
  const notes = [];
  const stats = {};
  const fail = (code, message) => failures.push(`[${code}] ${message}`);

  const contract = JSON.parse(fs.readFileSync(opts.contract, 'utf8'));
  const projectDir = contract.projectDir;
  const root = opts.root;

  const tracked = trackedFiles(root);
  const trackedSet = new Set(tracked);
  const inProject = tracked.filter((p) => p === projectDir || p.startsWith(`${projectDir}/`));
  stats.trackedInProject = inProject.length;

  // ── C1. 프로젝트 트리·필수 파일 ────────────────────────────────────────────
  // unity/ 가 통째로 없거나 필수 파일이 지워지면 **실패**다. 건너뛰거나 통과시키지 않는다.
  if (inProject.length === 0) {
    fail('C1', `추적되는 ${projectDir}/ 파일이 하나도 없다. Unity 프로젝트가 사라졌거나 이 브랜치에 없다.`);
    return { failures, notes, stats };
  }
  for (const required of contract.requiredFiles) {
    if (!trackedSet.has(required)) fail('C1', `필수 파일이 추적되지 않는다: ${required}`);
  }
  if (failures.length > 0) return { failures, notes, stats };

  // ── C2. Editor 버전 일관성 ────────────────────────────────────────────────
  {
    const expected = contract.editorVersion;
    const text = readText(root, `${projectDir}/ProjectSettings/ProjectVersion.txt`);
    const version = (text.match(/^m_EditorVersion:\s*(.+)$/m) || [])[1]?.trim();
    const withRevision = (text.match(/^m_EditorVersionWithRevision:\s*(.+)$/m) || [])[1]?.trim();

    if (version !== expected.version) {
      fail('C2', `ProjectVersion.txt 의 m_EditorVersion 이 ${version} 이다. 계약값은 ${expected.version} 이다. ` +
        `다른 Editor 로 열면 Unity 가 이 파일을 다시 쓰고 자산을 재직렬화한다.`);
    }
    const expectedWithRevision = `${expected.version} (${expected.revision})`;
    if (withRevision !== expectedWithRevision) {
      fail('C2', `ProjectVersion.txt 의 m_EditorVersionWithRevision 이 ${withRevision} 이다. 계약값은 ${expectedWithRevision} 이다.`);
    }
    for (const pinned of contract.versionPinnedFiles) {
      if (!trackedSet.has(pinned.path)) { fail('C2', `버전이 고정된 파일이 추적되지 않는다: ${pinned.path}`); continue; }
      if (!readText(root, pinned.path).includes(expected.version)) {
        fail('C2', `${pinned.path} 가 Editor ${expected.version} 을 가리키지 않는다. 버전 상향이 절반만 반영됐다.`);
      }
    }
    stats.editorVersion = version;
  }

  // ── C3. 필수 Player 설정 ──────────────────────────────────────────────────
  {
    const settings = readText(root, `${projectDir}/ProjectSettings/ProjectSettings.asset`);
    const spec = contract.playerSettings;

    for (const [key, expected] of Object.entries(spec.scalars)) {
      const actual = yamlScalar(settings, key);
      if (actual === undefined) { fail('C3', `ProjectSettings.asset 에 ${key} 가 없다.`); continue; }
      if (Number(actual) !== expected) {
        const note = spec.scalarNotes?.[key];
        fail('C3', `ProjectSettings.asset 의 ${key} 가 ${actual} 이다. 계약값은 ${expected}${note ? ` (${note})` : ''} 다.`);
      }
    }
    for (const [key, map] of Object.entries(spec.mapped)) {
      for (const [sub, expected] of Object.entries(map)) {
        if (sub === '_') continue;
        const actual = yamlNestedScalar(settings, key, sub);
        if (actual === undefined) { fail('C3', `ProjectSettings.asset 에 ${key}.${sub} 이 없다.`); continue; }
        if (Number(actual) !== expected) {
          fail('C3', `ProjectSettings.asset 의 ${key}.${sub} 이 ${actual} 이다. 계약값은 ${expected} 다.`);
        }
      }
    }

    // 소스 상수가 원본인 값 — 계약 파일에 숫자를 옮겨 적지 않고 .cs 에서 읽는다.
    const source = contract.configuratorSource;
    if (!trackedSet.has(source.path)) {
      fail('C3', `Player 설정의 원본 소스가 추적되지 않는다: ${source.path}`);
    } else {
      const cs = readText(root, source.path);
      for (const [constName, settingKey] of Object.entries(source.stringConsts)) {
        const value = constString(cs, constName);
        if (value === undefined) { fail('C3', `${source.path} 에서 const ${constName} 을 읽지 못했다.`); continue; }
        const actual = yamlScalar(settings, settingKey);
        if (actual !== value) {
          fail('C3', `ProjectSettings.asset 의 ${settingKey} 가 '${actual}' 이다. ${constName} = '${value}' 와 달라야 할 이유가 없다.`);
        }
      }

      const appId = constString(cs, source.applicationIdentifierConst);
      const actualAppId = yamlNestedScalar(settings, 'applicationIdentifier', 'Android');
      if (appId === undefined) {
        fail('C3', `${source.path} 에서 const ${source.applicationIdentifierConst} 을 읽지 못했다.`);
      } else if (actualAppId !== appId) {
        fail('C3', `applicationIdentifier.Android 가 '${actualAppId}' 이다. ${source.applicationIdentifierConst} = '${appId}' 다.`);
      }

      const sdk = {};
      for (const [constName, settingKey] of Object.entries(source.sdkConsts)) {
        const level = constApiLevel(cs, constName);
        if (level === undefined) { fail('C3', `${source.path} 에서 const ${constName} 의 API 레벨을 읽지 못했다.`); continue; }
        sdk[constName] = level;
        const actual = yamlScalar(settings, settingKey);
        if (Number(actual) !== level) {
          fail('C3', `ProjectSettings.asset 의 ${settingKey} 가 ${actual} 이다. ${constName} 은 API ${level} 이다. ` +
            `(0 은 AndroidApiLevelAuto 이며 설치된 SDK 목록에 따라 흔들린다.)`);
        }
      }
      if (sdk.MinSdkVersion !== undefined && sdk.TargetSdkVersion !== undefined &&
          sdk.MinSdkVersion > sdk.TargetSdkVersion) {
        fail('C3', `min SDK(${sdk.MinSdkVersion}) 가 target SDK(${sdk.TargetSdkVersion}) 보다 높다.`);
      }
    }
  }

  // ── C4. manifest 직접 의존성 ↔ lock ───────────────────────────────────────
  {
    const manifest = parseJson(root, `${projectDir}/Packages/manifest.json`);
    const lock = parseJson(root, `${projectDir}/Packages/packages-lock.json`);
    const direct = manifest.dependencies || {};
    const locked = lock.dependencies || {};
    stats.directDependencies = Object.keys(direct).length;

    for (const [name, version] of Object.entries(direct)) {
      const entry = locked[name];
      if (!entry) { fail('C4', `manifest 의 직접 의존성 ${name} 이 packages-lock.json 에 없다. lock 을 갱신하지 않았다.`); continue; }
      if (entry.version !== version) {
        fail('C4', `${name} 의 버전이 갈렸다 — manifest ${version} / lock ${entry.version}.`);
      }
    }
    const allowed = new Set(contract.packages.allowedRegistries);
    for (const [name, entry] of Object.entries(locked)) {
      if (entry.url && !allowed.has(entry.url)) {
        fail('C4', `packages-lock.json 의 ${name} 이 승인되지 않은 레지스트리를 쓴다: ${entry.url}`);
      }
    }
  }

  // ── C5. meta 짝 ───────────────────────────────────────────────────────────
  const assetsRoot = `${projectDir}/Assets`;
  const assetFiles = inProject.filter((p) => p.startsWith(`${assetsRoot}/`));
  const trackedDirs = new Set();
  for (const file of assetFiles) {
    let dir = path.posix.dirname(file);
    while (dir !== assetsRoot && dir.startsWith(assetsRoot)) {
      trackedDirs.add(dir);
      dir = path.posix.dirname(dir);
    }
  }
  {
    for (const file of assetFiles) {
      if (file.endsWith('.meta')) {
        const stem = file.slice(0, -'.meta'.length);
        if (trackedSet.has(stem) || trackedDirs.has(stem)) continue;
        // folderAsset 이 권위다 — 스템의 확장자로 폴더인지 파일인지 추측하지 않는다.
        // `Assets/My.Folder` 처럼 점이 든 폴더 이름은 Unity 에서 정상이고, 확장자 검사를
        // 먼저 하면 그런 빈 폴더의 meta 가 '본체 없는 파일 meta' 로 오탐된다.
        // git 은 빈 디렉터리를 추적하지 않으므로 짝 없는 folderAsset meta 는 정상이다
        // (실측: Assets/Resources.meta).
        if (/^folderAsset:\s*yes\s*$/m.test(readText(root, file))) continue;
        fail('C5', `본체 없는 meta 다: ${file}. 자산은 지우고 meta 만 남았거나, ` +
          `빈 폴더 meta 인데 folderAsset: yes 가 없다.`);
        continue;
      }
      if (!trackedSet.has(`${file}.meta`)) fail('C5', `.meta 가 없는 추적 자산이다: ${file}.`);
    }
    // Assets 루트 자체는 meta 대상이 아니다 (Unity 가 만들지 않는다).
    for (const dir of trackedDirs) {
      if (!trackedSet.has(`${dir}.meta`)) fail('C5', `.meta 가 없는 추적 폴더다: ${dir}/.`);
    }
    stats.assetFiles = assetFiles.length;
  }

  // ── C6. GUID 중복 ─────────────────────────────────────────────────────────
  const guidToMeta = new Map();
  {
    for (const file of assetFiles) {
      if (!file.endsWith('.meta')) continue;
      const match = readText(root, file).match(/^guid:\s*([0-9a-f]{32})\s*$/m);
      if (!match) { fail('C6', `meta 에 guid 가 없다: ${file}.`); continue; }
      const existing = guidToMeta.get(match[1]);
      if (existing) {
        fail('C6', `GUID 가 중복이다 ${match[1]} — ${existing} 과 ${file}. 폴더를 복사하면 이렇게 되고 참조가 한쪽으로 쏠린다.`);
      } else {
        guidToMeta.set(match[1], file);
      }
    }
    stats.guids = guidToMeta.size;
  }

  // ── C7. asmdef 그래프·경계 ────────────────────────────────────────────────
  {
    const spec = contract.assemblies;
    const knownExternal = new Set(contract.knownExternalAssemblies.names);
    const asmdefFiles = assetFiles.filter((p) => p.endsWith('.asmdef'));
    const byName = new Map();

    for (const file of asmdefFiles) {
      let definition;
      try {
        definition = JSON.parse(readText(root, file));
      } catch (error) {
        fail('C7', `asmdef 이 올바른 JSON 이 아니다: ${file} — ${error.message}`);
        continue;
      }
      const stem = path.posix.basename(file, '.asmdef');
      if (definition.name !== stem) {
        fail('C7', `asmdef 의 name(${definition.name}) 이 파일 이름(${stem}) 과 다르다: ${file}.`);
      }
      if (byName.has(definition.name)) {
        fail('C7', `asmdef 이름이 중복이다: ${definition.name}.`);
        continue;
      }
      byName.set(definition.name, { file, definition, dir: path.posix.dirname(file) });
    }

    for (const name of Object.keys(spec)) {
      if (name === '_') continue;
      if (!byName.has(name)) fail('C7', `계약에 있는 asmdef 이 없다: ${name}.`);
    }
    for (const name of byName.keys()) {
      if (!(name in spec)) fail('C7', `계약에 없는 asmdef 이다: ${name}. 계층 규칙을 정한 뒤 추가한다.`);
    }

    for (const [name, { file, definition }] of byName) {
      const rule = spec[name];
      if (!rule) continue;
      const references = definition.references || [];

      // 내부·외부 참조를 **어셈블리마다** 따로 화이트리스트로 본다. 전역 external 목록 하나로
      // 두면 Core 가 UnityEngine.UI 를, 런타임이 UnityEditor.TestRunner 를 참조해도 통과한다.
      for (const reference of references) {
        if (byName.has(reference)) {
          if (!rule.allows.includes(reference)) {
            fail('C7', `${name} → ${reference} 참조는 계층 계약 위반이다. 허용: [${rule.allows.join(', ') || '없음'}].`);
          }
          continue;
        }
        if (!knownExternal.has(reference)) {
          fail('C7', `${name} 이 알 수 없는 어셈블리를 참조한다: ${reference} (${file}). ` +
            `오타이거나 계약에 등록하지 않은 패키지다.`);
          continue;
        }
        if (!rule.externals.includes(reference)) {
          fail('C7', `${name} 에 허용되지 않은 엔진·패키지 참조다: ${reference}. ` +
            `허용: [${rule.externals.join(', ') || '없음'}] (${file}).`);
        }
      }

      if (rule.engineFree) {
        if (definition.noEngineReferences !== true) {
          fail('C7', `${name} 은 순수 C# 이어야 한다 — noEngineReferences 가 true 가 아니다 (${file}).`);
        }
        if (rule.externals.length > 0) {
          fail('C7', `계약 오류: ${name} 은 engineFree 인데 externals 가 비어 있지 않다. 계약을 고친다.`);
        }
      }
      const platforms = definition.includePlatforms || [];
      if (rule.editorOnly) {
        if (platforms.length !== 1 || platforms[0] !== 'Editor') {
          fail('C7', `${name} 은 Editor 전용이어야 한다 — includePlatforms 가 [${platforms.join(', ')}] 이다. ` +
            `Player 빌드에 Editor 코드가 섞인다.`);
        }
      } else if (platforms.length > 0 && !rule.test) {
        fail('C7', `${name} 에 includePlatforms 가 지정돼 있다: [${platforms.join(', ')}]. 런타임 어셈블리는 전 플랫폼이어야 한다.`);
      }
      if (rule.test && !(definition.defineConstraints || []).includes('UNITY_INCLUDE_TESTS')) {
        fail('C7', `${name} 에 defineConstraints UNITY_INCLUDE_TESTS 가 없다. 테스트 어셈블리가 Player 빌드에 섞인다 (${file}).`);
      }
      if (!rule.test) {
        for (const reference of references) {
          if (spec[reference]?.test) {
            fail('C7', `${name} 이 테스트 어셈블리 ${reference} 를 참조한다 (${file}).`);
          }
        }
      }
    }

    // 순환 — 계약이 단방향이라도 계약 자체가 잘못 편집되면 잡아야 한다.
    const cycle = findCycle(byName);
    if (cycle) fail('C7', `asmdef 참조에 순환이 있다: ${cycle.join(' → ')}.`);

    // asmdef 밖의 .cs 는 predefined Assembly-CSharp 으로 들어가 모든 패키지를 참조한다 — 계층이 무의미해진다.
    const asmdefDirs = [...byName.values()].map((entry) => entry.dir);
    const csFiles = assetFiles.filter((p) => p.endsWith('.cs'));
    for (const file of csFiles) {
      if (!asmdefDirs.some((dir) => file.startsWith(`${dir}/`))) {
        fail('C7', `asmdef 이 덮지 않는 .cs 다: ${file}. Assembly-CSharp 으로 들어간다.`);
      }
    }
    stats.csFiles = csFiles.length;

    // 런타임 코드의 UnityEditor 누출 — Player 빌드가 깨진다.
    for (const file of csFiles) {
      if (!contract.runtimeAssemblyDirs.some((dir) => file.startsWith(`${dir}/`))) continue;
      const unguarded = unguardedEditorUse(readText(root, file));
      if (unguarded) {
        fail('C7', `런타임 소스가 #if UNITY_EDITOR 밖에서 UnityEditor 를 쓴다: ${file}:${unguarded}. Player 빌드가 깨진다.`);
      }
    }
  }

  // ── C8. 활성 빌드 씬 ──────────────────────────────────────────────────────
  {
    const text = readText(root, `${projectDir}/ProjectSettings/EditorBuildSettings.asset`);
    const enabled = [];
    // `- enabled: 1` / `  path: ...` / `  guid: ...` 세 줄 묶음.
    const entryRe = /^\s*-\s*enabled:\s*(\d+)\s*\n\s*path:\s*(.*)\s*\n\s*guid:\s*([0-9a-f]{32})\s*$/gm;
    for (const match of text.matchAll(entryRe)) {
      if (match[1] === '1') enabled.push({ path: match[2].trim(), guid: match[3] });
    }

    const expected = contract.buildScenes;
    if (enabled.length !== expected.length) {
      fail('C8', `활성 빌드 씬이 ${enabled.length} 개다. 계약은 ${expected.length} 개다: ` +
        `[${enabled.map((s) => s.path).join(', ')}].`);
    }
    for (const scene of expected) {
      const actual = enabled.find((s) => s.path === scene.path);
      if (!actual) { fail('C8', `활성 빌드 씬 목록에 ${scene.path} 가 없다.`); continue; }

      const sceneRelative = `${projectDir}/${scene.path}`;
      if (!trackedSet.has(sceneRelative)) { fail('C8', `빌드 씬 파일이 추적되지 않는다: ${sceneRelative}.`); continue; }
      const metaRelative = `${sceneRelative}.meta`;
      if (!trackedSet.has(metaRelative)) { fail('C8', `빌드 씬의 .meta 가 없다: ${metaRelative}.`); continue; }

      const metaGuid = (readText(root, metaRelative).match(/^guid:\s*([0-9a-f]{32})\s*$/m) || [])[1];
      if (metaGuid !== actual.guid) {
        fail('C8', `EditorBuildSettings 의 guid(${actual.guid}) 가 ${metaRelative} 의 guid(${metaGuid}) 와 다르다. ` +
          `빌드가 다른 씬을 집거나 아무것도 못 집는다.`);
      }

      const sceneText = readText(root, sceneRelative);
      for (const assetPath of scene.mustReferenceAssets) {
        if (!trackedSet.has(assetPath)) { fail('C8', `${scene.path} 가 붙잡고 있어야 할 자산이 없다: ${assetPath}.`); continue; }
        const assetMeta = `${assetPath}.meta`;
        if (!trackedSet.has(assetMeta)) { fail('C8', `${assetPath} 의 .meta 가 없다 — 씬 참조가 풀린다.`); continue; }
        const guid = (readText(root, assetMeta).match(/^guid:\s*([0-9a-f]{32})\s*$/m) || [])[1];
        if (!guid || !sceneText.includes(guid)) {
          fail('C8', `${scene.path} 에 ${assetPath} 의 guid(${guid}) 참조가 없다. ` +
            `기기에서 Missing script 로만 드러나는 회귀다.`);
        }
      }

      // 씬이 참조하는 GUID 중 저장소 meta 로 풀리지 않는 것들. Library/PackageCache 를 추적하지
      // 않으므로 여기서는 **빌트인·UPM 인지 확인할 수 없다** — 세기만 하고 판정하지 않는다.
      // 우리 자산이 사라진 경우는 위 mustReferenceAssets 가 이름을 대고 잡는다.
      const referenced = new Set([...sceneText.matchAll(/guid:\s*([0-9a-f]{32})/g)].map((m) => m[1]));
      const unresolved = [...referenced].filter((guid) => !guidToMeta.has(guid));
      notes.push(`${scene.path}: 참조 GUID ${referenced.size} 개 중 ${unresolved.length} 개가 ` +
        `저장소 meta 로 풀리지 않는다 (빌트인·UPM 일 수 있으며 여기서는 판정하지 않는다).`);
    }
  }

  // ── C9. 잘못 추적된 캐시·산출물·자격증명 ──────────────────────────────────
  {
    const rule = contract.forbiddenTracked;
    for (const file of inProject) {
      const relative = file.slice(`${projectDir}/`.length);
      const base = path.posix.basename(relative);
      const ext = path.posix.extname(base).toLowerCase();

      const dir = rule.topLevelDirs.find((d) => firstSegmentIs(relative, d));
      if (dir) { fail('C9', `캐시·산출물이 추적되고 있다: ${file} (${projectDir}/${dir}/ 은 무시 대상이다).`); continue; }
      if (rule.extensions.includes(ext)) { fail('C9', `자동 생성·산출물이 추적되고 있다: ${file}.`); continue; }
      if (rule.credentialExtensions.includes(ext) ||
          rule.credentialNamePrefixes.some((prefix) => base.startsWith(prefix))) {
        fail('C9', `자격증명으로 보이는 파일이 추적되고 있다: ${file}. 이 저장소는 공개다 — 즉시 제거하고 폐기한다.`);
      }
    }
  }

  return { failures, notes, stats };
}

/** `public const string Name = "value";` 에서 value 를 뽑는다. */
function constString(source, name) {
  const match = source.match(new RegExp(`const\\s+string\\s+${escapeRegExp(name)}\\s*=\\s*"([^"]*)"`));
  return match ? match[1] : undefined;
}

/** `public const AndroidSdkVersions Name = AndroidSdkVersions.AndroidApiLevel36;` → 36 */
function constApiLevel(source, name) {
  const match = source.match(new RegExp(`const\\s+AndroidSdkVersions\\s+${escapeRegExp(name)}\\s*=\\s*[\\s\\S]*?AndroidApiLevel(\\d+)`));
  return match ? Number(match[1]) : undefined;
}

/**
 * UnityEditor 토큰이 에디터 전용 블록 밖에 나오는 첫 줄 번호를 돌려준다 (없으면 0).
 *
 * 인식 범위 — 좁고 보수적으로 고정한다 (C# 전처리기 파서를 만들지 않는다):
 *   보호로 **인정하는 것은 정확히 `#if UNITY_EDITOR` 한 형태뿐이다** (괄호·공백·줄 끝 주석 허용).
 *   그 외는 전부 보호로 보지 않는다:
 *     · `#if !UNITY_EDITOR` — 오히려 플레이어 전용 블록이다. 문자열 포함 검사로 보호라고 봤다가는
 *       Player 빌드를 깨뜨리는 코드를 그대로 통과시킨다.
 *     · `#if UNITY_EDITOR || UNITY_ANDROID` — 플레이어에서도 켜진다.
 *     · `#if UNITY_EDITOR && X` — 실제로는 에디터 전용이지만 여기서는 보호로 세지 않는다.
 *       판정이 틀리는 방향을 **실패 쪽으로** 고정한 결과다. 이런 형태가 정말 필요해지면
 *       그때 계약과 이 함수를 함께 고친다.
 *     · `#if UNITY_EDITOR` 의 `#else` 가지 — 에디터가 아닌 쪽이므로 보호가 아니다.
 *   중첩은 스택으로 따라가며, 바깥 어느 한 층이라도 인정된 보호면 안쪽은 보호로 본다.
 */
const EDITOR_GUARD = /^\(*\s*UNITY_EDITOR\s*\)*$/;

function unguardedEditorUse(source) {
  const lines = source.split(/\r?\n/);
  const stack = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const directive = line.match(/^\s*#\s*(if|elif|else|endif)\b(.*)$/);
    if (directive) {
      const kind = directive[1];
      const condition = stripComment(directive[2]).trim();
      if (kind === 'if') stack.push(EDITOR_GUARD.test(condition));
      else if (kind === 'elif') { stack.pop(); stack.push(EDITOR_GUARD.test(condition)); }
      else if (kind === 'else') { stack.pop(); stack.push(false); }
      else stack.pop();
      continue;
    }
    if (stack.some(Boolean)) continue;
    if (/(^|[^A-Za-z0-9_])UnityEditor([^A-Za-z0-9_]|$)/.test(stripComment(line))) return i + 1;
  }
  return 0;
}

/** 한 줄 주석만 떼어낸다 (블록 주석 안의 UnityEditor 는 흔치 않고, 잡아도 무해한 쪽이다). */
function stripComment(line) {
  const index = line.indexOf('//');
  return index === -1 ? line : line.slice(0, index);
}

/** 참조 그래프의 순환 하나를 찾는다. */
function findCycle(byName) {
  const visiting = new Set();
  const done = new Set();
  let found = null;

  const walk = (name, trail) => {
    if (found) return;
    if (visiting.has(name)) { found = [...trail.slice(trail.indexOf(name)), name]; return; }
    if (done.has(name)) return;
    visiting.add(name);
    for (const reference of byName.get(name)?.definition.references || []) {
      if (byName.has(reference)) walk(reference, [...trail, name]);
    }
    visiting.delete(name);
    done.add(name);
  };

  for (const name of byName.keys()) walk(name, []);
  return found;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI
// ─────────────────────────────────────────────────────────────────────────────
function main(argv) {
  let opts;
  try {
    opts = parseOptions(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n${USAGE}\n`);
    return 2;
  }
  if (opts.help) { process.stdout.write(`${USAGE}\n`); return 0; }

  let result;
  try {
    result = check(opts);
  } catch (error) {
    if (error instanceof UsageError) { process.stderr.write(`${error.message}\n`); return 2; }
    process.stderr.write(`검사 중 오류: ${error.stack || error.message}\n`);
    return 2;
  }

  if (opts.verbose) {
    for (const note of result.notes) process.stdout.write(`  · ${note}\n`);
    process.stdout.write(`  · 추적 파일 ${result.stats.trackedInProject} · 자산 ${result.stats.assetFiles} · ` +
      `.cs ${result.stats.csFiles} · GUID ${result.stats.guids} · 직접 의존성 ${result.stats.directDependencies} · ` +
      `Editor ${result.stats.editorVersion}\n`);
  }

  if (result.failures.length > 0) {
    process.stderr.write(`Unity 프로젝트 구조 검사 실패 — ${result.failures.length} 건\n`);
    for (const failure of result.failures) process.stderr.write(`  ${failure}\n`);
    return 1;
  }
  process.stdout.write('Unity 프로젝트 구조 검사 OK (Unity·라이선스 없이 수행 — 컴파일 보증이 아니다)\n');
  return 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { check, parseOptions, unguardedEditorUse, constApiLevel, constString, main };
