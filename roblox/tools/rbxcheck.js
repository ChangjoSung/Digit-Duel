// Roblox API 정적 검사 — Studio 없이 잡히지 않는 런타임 오류 예방
//   · mk("Class", { Prop = … }) / part({ Prop = … }) 의 속성 이름이 그 클래스에 있는지
//   · Enum.X.Y 가 실제 존재하는지 (예: Enum.ResampleMode 는 없음 → Enum.ResamplerMode)
//   · x.Prop = … 직접 대입의 Prop 이 Roblox 의 어떤 클래스·데이터타입에도 없는지
// 기준: luau-lsp 의 globalTypes.d.luau (build/ 에 없으면 내려받는다)
// 사용: node tools/rbxcheck.js [파일...]   (인수 없으면 src/ 전체) — 문제가 있으면 exit 1
const fs = require("fs");
const path = require("path");
const https = require("https");
const crypto = require("crypto");

const ROOT = path.resolve(__dirname, "..");
const DEFS = path.join(ROOT, "build", "globalTypes.d.luau");
// **커밋으로 고정한다.** main 을 가리키면 저장소를 하나도 안 고쳤는데 검사 결과가 바뀐다 —
// 어제 통과한 코드가 오늘 실패하거나(가짜 실패), 반대로 오타를 잡아 주던 정의가 사라져도 아무도 모른다.
// 정의를 올릴 때는 아래 두 줄(커밋·해시)을 같이 바꾸고, 그 커밋에서 검사가 통과하는 것을 확인한 뒤 커밋한다.
const DEFS_COMMIT = "12c95f732f09497d7a5a85e8c448730fd549cebc"; // luau-lsp "Update to latest types dump (#1618)" 2026-09-09
const DEFS_SHA256 = "84afaa8191701da02cebeacc104178c0e5a6ad2ae6f7bd3c2eef9b160ba5ee9f";
const DEFS_URL = `https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/${DEFS_COMMIT}/scripts/globalTypes.d.luau`;

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function download(url, dest) {
	return new Promise((resolve, reject) => {
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		const req = https.get(url, (res) => {
			if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
				return download(res.headers.location, dest).then(resolve, reject);
			}
			if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} ${url}`));
			const out = fs.createWriteStream(dest);
			res.pipe(out);
			out.on("finish", () => out.close(resolve));
		});
		req.on("error", reject);
	});
}

function listLuau(dir, acc = []) {
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, e.name);
		if (e.isDirectory()) listLuau(p, acc);
		else if (e.name.endsWith(".luau")) acc.push(p);
	}
	return acc;
}

function parseDefs(text) {
	const classes = {}; // name -> {base, props:Set}
	const enums = {}; // EnumName -> Set(items)
	let cur = null;
	for (const line of text.split("\n")) {
		let m = line.match(/^declare extern type (\w+)(?: extends (\w+))? with\s*(end)?$/);
		if (m) {
			if (m[1].startsWith("Enum") && m[1].endsWith("_INTERNAL")) {
				cur = { items: new Set() };
				enums[m[1].slice(4, -9)] = cur.items;
			} else {
				cur = { name: m[1], base: m[2], props: new Set() };
				classes[m[1]] = cur;
			}
			if (m[3]) cur = null;
			continue;
		}
		if (/^end\s*$/.test(line)) {
			cur = null;
			continue;
		}
		if (!cur) continue;
		m = line.match(/^\t(\w+):/) || line.match(/^\tfunction (\w+)\(/);
		if (m) (cur.props || cur.items).add(m[1]);
	}
	return { classes, enums };
}

function tableBody(src, openIdx) {
	// openIdx = '{' 바로 다음 위치. 괄호 균형으로 닫는 '}' 까지
	let i = openIdx, depth = 1;
	while (i < src.length && depth > 0) {
		if (src[i] === "{") depth++;
		else if (src[i] === "}") depth--;
		i++;
	}
	return src.slice(openIdx, i - 1);
}

function topLevelKeys(body) {
	// 중첩 괄호 안(함수 호출·중첩 테이블)은 공백으로 지우고 최상위 `key =` 만
	let prev;
	do {
		prev = body;
		body = body.replace(/\([^()]*\)/g, (s) => " ".repeat(s.length)).replace(/\{[^{}]*\}/g, (s) => " ".repeat(s.length));
	} while (body !== prev);
	const keys = [];
	const re = /(\w+)\s*=(?!=)/g;
	let k;
	while ((k = re.exec(body))) keys.push(k[1]);
	return keys;
}

async function main() {
	// 받아 둔 파일도 해시를 본다 — 예전에 main 에서 받아 둔 것이 남아 있으면 조용히 다른 기준으로 검사하게 된다.
	if (!fs.existsSync(DEFS) || sha256(DEFS) !== DEFS_SHA256) {
		console.log(`정의 파일 내려받는 중 (${DEFS_COMMIT.slice(0, 7)}) → ${path.relative(ROOT, DEFS)}`);
		await download(DEFS_URL, DEFS);
		const got = sha256(DEFS);
		if (got !== DEFS_SHA256) {
			console.error(`정의 파일 해시 불일치 — 기대 ${DEFS_SHA256}\n            받음 ${got}`);
			process.exit(1);
		}
	}
	const { classes, enums } = parseDefs(fs.readFileSync(DEFS, "utf8"));
	const hasProp = (cls, prop, depth = 0) => {
		const c = classes[cls];
		if (!c || depth > 20) return false;
		return c.props.has(prop) || hasProp(c.base, prop, depth + 1);
	};
	const allProps = new Set();
	for (const c of Object.values(classes)) for (const p of c.props) allProps.add(p);

	const files = process.argv.length > 2 ? process.argv.slice(2) : listLuau(path.join(ROOT, "src"));
	let problems = 0;
	const report = (f, line, msg) => {
		console.log(`${path.relative(ROOT, f)}:${line}: ${msg}`);
		problems++;
	};
	// Luau 는 함수 하나가 지역 변수를 200개까지만 쓴다. 이 파일들은 전부 최상위 스코프라 한 예산을 공유하고,
	// 넘으면 "Out of local registers when trying to allocate <아무 함수 이름>" 으로 **엉뚱한 줄**을 가리키며 빌드가 멈춘다.
	// 그래서 여유가 줄어드는 것을 미리 알린다 (2026-09-10 전투 연출을 붙이다 실제로 걸렸다 → 자식 ModuleScript 로 쪼갰다).
	const LOCAL_WARN = 170, LOCAL_MAX = 190;
	const countTopLocals = (text) => {
		let n = 0;
		for (const line of text.split("\n")) {
			if (/^local\s+function\b/.test(line)) {
				n += 1;
			} else {
				const d = /^local\s+([\w\s,]+?)\s*(=|$)/.exec(line);
				if (d) n += d[1].split(",").length;
			}
		}
		return n;
	};

	for (const f of files) {
		const src = fs.readFileSync(f, "utf8");
		const lineOf = (idx) => src.slice(0, idx).split("\n").length;
		const nLocals = countTopLocals(src);
		if (nLocals > LOCAL_MAX) {
			report(f, 1, `최상위 지역 변수 ${nLocals}개 — Luau 한도 200 에 너무 가깝다. 관련된 것끼리 테이블로 묶거나 자식 ModuleScript 로 나눌 것`);
		} else if (nLocals > LOCAL_WARN) {
			console.log(`${path.relative(ROOT, f)}:1: [경고] 최상위 지역 변수 ${nLocals}개 (한도 200) — 새 기능은 테이블로 묶는 편이 안전하다`);
		}
		let m;
		const reMk = /\bmk\(\s*"(\w+)"\s*,\s*\{/g;
		while ((m = reMk.exec(src))) {
			const cls = m[1];
			if (!classes[cls]) {
				report(f, lineOf(m.index), `unknown class ${cls}`);
				continue;
			}
			for (const k of topLevelKeys(tableBody(src, reMk.lastIndex))) {
				if (!hasProp(cls, k)) report(f, lineOf(m.index), `${cls} has no property '${k}'`);
			}
		}
		const rePart = /\bpart\(\s*\{/g;
		while ((m = rePart.exec(src))) {
			for (const k of topLevelKeys(tableBody(src, rePart.lastIndex))) {
				if (!hasProp("Part", k)) report(f, lineOf(m.index), `Part has no property '${k}'`);
			}
		}
		const reEnum = /\bEnum\.(\w+)\.(\w+)/g;
		while ((m = reEnum.exec(src))) {
			if (!enums[m[1]]) report(f, lineOf(m.index), `unknown enum Enum.${m[1]}`);
			else if (!enums[m[1]].has(m[2])) report(f, lineOf(m.index), `Enum.${m[1]} has no item '${m[2]}'`);
		}
		src.split("\n").forEach((ln, idx) => {
			// 받는 쪽이 소문자로 시작하는 변수(인스턴스)일 때만 — Data.X / Art.X 같은 모듈 테이블은 제외
			const a = ln.match(/^\s*(?!self\b)[a-z_][\w.\[\]"]*\.([A-Z]\w*)\s*=(?!=)/);
			if (a && !allProps.has(a[1])) report(f, idx + 1, `no Roblox class has property '${a[1]}' (direct assignment)`);
		});
	}
	console.log(`rbxcheck: ${files.length} files · classes ${Object.keys(classes).length} · enums ${Object.keys(enums).length} · problems ${problems}`);
	process.exit(problems ? 1 : 0);
}

main().catch((e) => {
	console.error("rbxcheck 실패:", e.message);
	process.exit(2);
});
