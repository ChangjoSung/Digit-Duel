// Roblox API 정적 검사 — Studio 없이 잡히지 않는 런타임 오류 예방
//   · mk("Class", { Prop = … }) / part({ Prop = … }) 의 속성 이름이 그 클래스에 있는지
//   · Enum.X.Y 가 실제 존재하는지 (예: Enum.ResampleMode 는 없음 → Enum.ResamplerMode)
//   · x.Prop = … 직접 대입의 Prop 이 Roblox 의 어떤 클래스·데이터타입에도 없는지
// 기준: luau-lsp 의 globalTypes.d.luau (build/ 에 없으면 내려받는다)
// 사용: node tools/rbxcheck.js [파일...]   (인수 없으면 src/ 전체) — 문제가 있으면 exit 1
const fs = require("fs");
const path = require("path");
const https = require("https");

const ROOT = path.resolve(__dirname, "..");
const DEFS = path.join(ROOT, "build", "globalTypes.d.luau");
const DEFS_URL = "https://raw.githubusercontent.com/JohnnyMorganz/luau-lsp/main/scripts/globalTypes.d.luau";

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
	if (!fs.existsSync(DEFS)) {
		console.log(`정의 파일 내려받는 중 → ${path.relative(ROOT, DEFS)}`);
		await download(DEFS_URL, DEFS);
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
	for (const f of files) {
		const src = fs.readFileSync(f, "utf8");
		const lineOf = (idx) => src.slice(0, idx).split("\n").length;
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
