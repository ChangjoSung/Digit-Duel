// UI 레이아웃 정적 검사 — Studio 없이 "겹침·화면 밖으로 나감"을 잡는다.
//   · 자식이 부모 밖으로 나가는가 (넘침)
//   · 같은 부모의 형제끼리 사각형이 겹치는가 (동시에 보일 수 있는 것만 — 배타 쌍은 EXCLUSIVE 로 제외)
//   · 창 자체가 기준 화면(1280×720)보다 큰가
// 한계: mk(...) 에 숫자 상수로 적힌 정적 배치만 본다. smallBtn 등 런타임 좌표는 대상이 아니다.
// 사용: node tools/uicheck.js [파일]   (기본 src/client/init.client.luau) — 문제가 있으면 exit 1
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(ROOT, "src", "client", "init.client.luau");
const SCREEN = { w: 1280, h: 720 }; // 기준 화면 (autoFit 이 이보다 작은 화면에서 축소한다)

// 동시에 보이지 않는 형제 쌍 (한쪽이 보이면 다른 쪽은 숨는다) — 겹침 검사 제외
const EXCLUSIVE = [
	["setupPanel", "side"], // 배치 패널 ↔ 대전 사이드 패널 (같은 자리)
	["battleFrame", "recruitFrame"], // 전투 창 ↔ 탐색 보상 창
	["modalBack", "battleFrame"], // 암막은 모달 뒤 전면
	["modalBack", "recruitFrame"],
	["detailBack", "rosterDetail"],
	["hud", "win"], // 창이 열리면 HUD 는 숨는다
	["win", "game_"], // game_ 는 전체 화면 투명 컨테이너
	["hud", "game_"],
	["win", "detailBack"],
	["hud", "detailBack"],
	["game_", "detailBack"],
	["win", "rosterDetail"],
	["hud", "rosterDetail"],
	["game_", "rosterDetail"],
	["boardFrameImg", "boardFrame"], // 판 테두리 아트 위에 판을 얹는 의도된 구성
	["winThinking", "winStatus"], // 아이콘 유무에 따라 상태줄이 좌우로 밀린다 (setThinking)
];

// 의도적으로 겹쳐 그리는 컨테이너 (2D 셀 = 타일·아이콘·HP·흔적·하이라이트 스택)
const STACK_PARENTS = new Set(["b"]);
const isExclusive = (a, b) => EXCLUSIVE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// 전체 화면 컨테이너 — 넘침·겹침 기준에서 제외
const FULLSCREEN = new Set(["game_", "modalBack", "detailBack"]);

const src = fs.readFileSync(FILE, "utf8");
const lineOf = (idx) => src.slice(0, idx).split("\n").length;

// ── 숫자 상수 수집 (local A, B = 1, 2 / local A = 3)
const consts = {};
for (const m of src.matchAll(/^local\s+([A-Za-z_][\w]*(?:\s*,\s*[A-Za-z_][\w]*)*)\s*=\s*([^\n]+)$/gm)) {
	const names = m[1].split(",").map((x) => x.trim());
	const vals = m[2].split(/,(?![^(]*\))/).map((x) => x.trim());
	if (names.length !== vals.length) continue;
	names.forEach((n, i) => {
		const v = evalExpr(vals[i]);
		if (v !== null) consts[n] = v;
	});
}

function evalExpr(expr) {
	if (typeof expr !== "string") return null;
	const e = expr.trim().replace(/\s*--.*$/, "");
	if (!/^[-+*/(). \d\w]+$/.test(e)) return null;
	const ids = e.match(/[A-Za-z_][\w]*/g) || [];
	if (ids.some((id) => !(id in consts))) return null;
	try {
		const fn = new Function(...Object.keys(consts), `return (${e});`);
		const v = fn(...Object.values(consts));
		return typeof v === "number" && isFinite(v) ? v : null;
	} catch {
		return null;
	}
}

// ── mk("Class", { ... }, parent) 파싱
function tableBody(from) {
	let i = from, depth = 1;
	while (i < src.length && depth > 0) {
		if (src[i] === "{") depth++;
		else if (src[i] === "}") depth--;
		i++;
	}
	return { body: src.slice(from, i - 1), end: i - 1 };
}
function prop(body, name) {
	// 최상위 키만 (중첩 괄호 제거 후 위치를 찾고 원본에서 값을 읽는다)
	const re = new RegExp(`(^|[,{\\s])${name}\\s*=\\s*`, "m");
	const m = re.exec(body);
	if (!m) return null;
	let i = m.index + m[0].length;
	let depth = 0, out = "";
	while (i < body.length) {
		const c = body[i];
		if (c === "(" || c === "{") depth++;
		else if (c === ")" || c === "}") depth--;
		else if (c === "," && depth === 0) break;
		if (depth < 0) break;
		out += c;
		i++;
	}
	return out.trim();
}
function udim2(expr, parentW, parentH) {
	if (expr === null) return null;
	let m = /^UDim2\.new\(([^]*)\)$/.exec(expr);
	if (m) {
		const parts = splitArgs(m[1]);
		if (parts.length !== 4) return null;
		const [sx, ox, sy, oy] = parts.map(evalExpr);
		if ([sx, ox, sy, oy].some((v) => v === null)) return null;
		return { x: sx * parentW + ox, y: sy * parentH + oy };
	}
	m = /^UDim2\.fromScale\(([^]*)\)$/.exec(expr);
	if (m) {
		const parts = splitArgs(m[1]).map(evalExpr);
		if (parts.some((v) => v === null)) return null;
		return { x: parts[0] * parentW, y: parts[1] * parentH };
	}
	return null;
}
function splitArgs(s) {
	const out = [];
	let depth = 0, cur = "";
	for (const c of s) {
		if (c === "(") depth++;
		else if (c === ")") depth--;
		if (c === "," && depth === 0) {
			out.push(cur);
			cur = "";
		} else cur += c;
	}
	if (cur.trim()) out.push(cur);
	return out.map((x) => x.trim());
}

const nodes = []; // {name, cls, parent, sizeExpr, posExpr, anchorExpr, line}
const reMk = /(?:local\s+([A-Za-z_][\w]*)\s*=\s*)?mk\(\s*"(\w+)"\s*,\s*\{/g;
let m;
while ((m = reMk.exec(src))) {
	const { body, end } = tableBody(reMk.lastIndex);
	const after = src.slice(end + 1, end + 60);
	const pm = /^\s*\}\s*,\s*([A-Za-z_][\w]*)\s*\)/.exec("}" + after);
	nodes.push({
		name: m[1] || null,
		cls: m[2],
		parent: pm ? pm[1] : null,
		size: prop(body, "Size"),
		pos: prop(body, "Position"),
		anchor: prop(body, "AnchorPoint"),
		line: lineOf(m.index),
	});
}

// ── 부모 크기 해석 (gui = 화면)
const sizeOf = {};
sizeOf.gui = { w: SCREEN.w, h: SCREEN.h };
let changed = true;
while (changed) {
	changed = false;
	for (const n of nodes) {
		if (!n.name || sizeOf[n.name] || !n.parent || !sizeOf[n.parent]) continue;
		const p = sizeOf[n.parent];
		const sz = udim2(n.size, p.w, p.h);
		if (sz) {
			sizeOf[n.name] = { w: sz.x, h: sz.y };
			changed = true;
		}
	}
}

let problems = 0;
const report = (line, msg) => {
	console.log(`${path.relative(ROOT, FILE)}:${line}: ${msg}`);
	problems++;
};

// ── 1) 자식이 부모 밖으로 나가는가
const rects = {}; // parent -> [{name, line, x, y, w, h}]
for (const n of nodes) {
	if (!n.parent || !sizeOf[n.parent]) continue;
	const p = sizeOf[n.parent];
	const sz = udim2(n.size, p.w, p.h);
	const po = n.pos ? udim2(n.pos, p.w, p.h) : { x: 0, y: 0 };
	if (!sz || !po) continue;
	let { x, y } = po;
	if (n.anchor) {
		const am = /^Vector2\.new\(([^)]*)\)$/.exec(n.anchor);
		if (am) {
			const [ax, ay] = splitArgs(am[1]).map(evalExpr);
			if (ax !== null && ay !== null) {
				x -= ax * sz.x;
				y -= ay * sz.y;
			}
		}
	}
	const r = { name: n.name || `${n.cls}@${n.line}`, line: n.line, x, y, w: sz.x, h: sz.y };
	(rects[n.parent] ||= []).push(r);
	if (n.parent === "gui") {
		if (sz.x > SCREEN.w || sz.y > SCREEN.h) {
			report(n.line, `${r.name}: 기준 화면(${SCREEN.w}×${SCREEN.h})보다 큼 — ${sz.x}×${sz.y}`);
		}
		continue;
	}
	const eps = 0.5;
	if (x < -eps || y < -eps || x + sz.x > p.w + eps || y + sz.y > p.h + eps) {
		report(n.line, `${r.name}: 부모 ${n.parent}(${p.w}×${p.h}) 밖으로 나감 — x ${x}..${x + sz.x}, y ${y}..${y + sz.y}`);
	}
}

// ── 2) 형제 겹침 (배타 쌍·전체 화면 컨테이너 제외)
for (const [parent, list] of Object.entries(rects)) {
	for (let i = 0; i < list.length; i++) {
		for (let j = i + 1; j < list.length; j++) {
			const a = list[i], b = list[j];
			if (STACK_PARENTS.has(parent)) continue;
			if (FULLSCREEN.has(a.name) || FULLSCREEN.has(b.name)) continue;
			if (isExclusive(a.name, b.name)) continue;
			const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
			const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
			if (ox > 0.5 && oy > 0.5) {
				report(a.line, `${a.name} ↔ ${b.name} (${parent}) 겹침 — ${Math.round(ox)}×${Math.round(oy)}px`);
			}
		}
	}
}

const checked = Object.values(rects).reduce((n, l) => n + l.length, 0);
console.log(`uicheck: 정적 요소 ${checked}개 · 컨테이너 ${Object.keys(rects).length}개 · 문제 ${problems}건`);
process.exit(problems ? 1 : 0);
