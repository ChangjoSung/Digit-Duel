// 선언 없는 식별자 검사 — "고쳤다고 생각했는데 화면에 아무것도 안 나오는" 사고를 막는다.
//
// 왜 필요한가: Luau 는 선언 없는 이름을 **오류가 아니라 nil 전역**으로 조용히 받아들인다.
//   local myStats = nil   ← 이 한 줄이 빠져도
//   myStats = msg         ← 대입되고
//   if myStats then ...   ← 읽히고, 컴파일도 테스트도 CI 도 전부 통과한다. 화면에만 아무것도 안 나온다.
// 2026-09-10 전적 기능이 정확히 이렇게 죽은 채로 v30 으로 배포됐다 (PR #158 에서 복구).
//
// 어떻게 잡는가: `luau-analyze --mode=strict` 는 선언 없는 이름을 읽을 때도 **대입할 때도** 잡아 준다.
//   다만 파일 첫 줄의 `--!nonstrict` 주석이 그 모드를 되돌리므로, **임시 사본에서 그 주석만 떼고** 검사한다
//   (저장소 파일은 건드리지 않는다). 타입 오류는 무시하고 `Unknown global` 만 본다 — 목적이 그것뿐이다.
//
// 사용: node tools/globalcheck.js [파일...]   (인수 없으면 src/ 전체) — 문제가 있으면 exit 1
//   luau-analyze 는 PATH · build/ · $LUAU_ANALYZE 순서로 찾는다.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");

// **닫힌 목록**이다. 실제로 쓰는 Roblox 전역 전부를 적어 두고, 여기 없는 이름이 나오면 실패시킨다.
// 새 Roblox 전역(예: TweenInfo)을 쓰기 시작하면 여기서 한 번 막히는데 — 그때 이름을 눈으로 확인하고
// 이 목록에 추가하는 것이 의도된 절차다. 목록을 열어 두면 오타가 그대로 지나간다.
const ROBLOX_GLOBALS = new Set([
	"Enum", "UDim", "UDim2", "Color3", "Vector2", "Vector3", "Rect", "CFrame",
	"Instance", "Random", "RaycastParams", "game", "workspace", "script", "task", "warn",
]);

function listLuau(dir, acc = []) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) listLuau(p, acc);
		else if (e.name.endsWith(".luau")) acc.push(p);
	}
	return acc;
}

function findAnalyzer() {
	if (process.env.LUAU_ANALYZE) return process.env.LUAU_ANALYZE;
	for (const c of ["luau-analyze", path.join(ROOT, "build", "luau-analyze"), path.join(ROOT, "build", "luau-analyze.exe")]) {
		const r = spawnSync(c, ["--help"], { encoding: "utf8" });
		if (!r.error) return c;
	}
	return null;
}

const analyzer = findAnalyzer();
if (!analyzer) {
	// 도구가 없다고 조용히 통과시키지 않는다 — 검사를 안 한 것과 통과한 것은 다르다.
	console.error("luau-analyze 를 찾지 못했습니다. PATH 에 두거나 roblox/build/ 에 넣거나 LUAU_ANALYZE 로 지정하세요.");
	console.error("  받기: https://github.com/luau-lang/luau/releases (luau-<플랫폼>.zip)");
	process.exit(1);
}

const files = process.argv.length > 2 ? process.argv.slice(2) : listLuau(path.join(ROOT, "src"));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "globalcheck-"));
let problems = 0;

for (const f of files) {
	const src = fs.readFileSync(f, "utf8");
	// 첫 줄의 모드 주석만 뗀다 (줄 수를 유지해야 보고되는 줄 번호가 원본과 맞는다).
	const stripped = src.replace(/^--!(nonstrict|strict|nocheck)[ \t]*$/m, "-- (globalcheck: 모드 주석 제거)");
	const tmp = path.join(work, path.basename(f));
	fs.writeFileSync(tmp, stripped);

	const r = spawnSync(analyzer, ["--mode=strict", tmp], { encoding: "utf8" });
	const out = (r.stdout || "") + (r.stderr || "");
	const found = new Map(); // 이름 → 처음 나온 줄
	for (const m of out.matchAll(/\((\d+),\d+\): TypeError: Unknown global '([^']+)'/g)) {
		if (!ROBLOX_GLOBALS.has(m[2]) && !found.has(m[2])) found.set(m[2], Number(m[1]));
	}
	for (const [name, line] of found) {
		console.log(`${path.relative(ROOT, f)}:${line}: 선언 없는 식별자 '${name}' — local 선언이 빠졌거나 오타입니다`);
		problems++;
	}
}

fs.rmSync(work, { recursive: true, force: true });
console.log(`globalcheck: ${files.length}개 파일 · 문제 ${problems}건`);
process.exit(problems ? 1 : 0);
