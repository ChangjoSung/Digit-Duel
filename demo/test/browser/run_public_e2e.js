// #217/#218 공개 방 실브라우저 2클라이언트 E2E (Mars 소유, 클라이언트 테스트 도구)
// 실행: node demo/test/browser/run_public_e2e.js [--out C:/dd_cdp/out_pub] [--minutes 25]
//
// 무엇을 증명하나 — 실제 Windows Edge 두 프로세스(격리 프로필)가 실제 공개 방 서버(server/authoritative, 이 작업 공간의
// 최신 코드를 임의 포트로 새로 띄움 · 기존 8081 검증 서버는 건드리지 않음)에 붙어:
//   로비 → 방 생성/목록/참가 → 로스터 → 배치 → 준비(입장 대기·준비 대기 표시) → 대국 → 접촉/전투 무대·메시지·KO·결과 배너
//   → 선택창(소유자 선택/비소유자 대기) → 대국 중 실제 TCP 단절 → 같은 방·같은 좌석 재개 → 계속 진행 → 결과 화면
// 입력은 전부 CDP Input.dispatchMouseEvent(실제 마우스 이벤트)다. Runtime.evaluate 는 클릭할 좌표·화면 상태를 **읽기만** 하며,
// 게임 함수 호출·상태 주입은 하지 않는다(PD 지시). 비밀값(seatToken)은 읽지도 기록하지도 않는다.
// 움직임 줄이기 computed style 은 호스트 창에 prefers-reduced-motion:reduce 를 에뮬레이트해 실제 연출 요소에서 읽는다.
'use strict';
const { spawn, execSync } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const net = require('net');
const ROOT = path.join(__dirname, '..', '..', '..');
const WebSocket = require(path.join(ROOT, 'server', 'node_modules', 'ws'));
const { startDropProxy } = require('./tcp_drop_proxy');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = arg('--out', 'C:/dd_cdp/out_pub');
const MINUTES = Number(arg('--minutes', '25'));
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
fs.mkdirSync(OUT, { recursive: true });
const LOG = [];
function log(...a) { const line = '[' + new Date().toISOString().slice(11, 23) + '] ' + a.map((x) => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); LOG.push(line); console.log(line); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, ms, label, every) { const end = Date.now() + ms; let last; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { last = e; } await sleep(every || 250); } throw new Error('timeout: ' + label + (last ? ' (' + last.message + ')' : '')); }
function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); }); }
function httpJson(url) { return new Promise((res, rej) => { http.get(url, (r) => { let d = ''; r.on('data', (c) => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej); }); }

const RESULT = { startedAt: new Date().toISOString(), checks: [], screenshots: [], notes: [] };
function check(name, ok, detail) { RESULT.checks.push({ name, ok: !!ok, detail: detail === undefined ? null : detail }); log((ok ? 'PASS ' : 'FAIL ') + name, detail === undefined ? '' : detail); }

class Browser {
  constructor(name, port, width, height) { this.name = name; this.port = port; this.width = width; this.height = height; this.id = 0; this.pending = new Map(); this.errors = []; this.dir = `C:/dd_cdp/${name}_pub_${Date.now()}`; }
  async launch() {
    this.proc = spawn(EDGE, [`--remote-debugging-port=${this.port}`, `--user-data-dir=${this.dir}`, '--no-first-run', '--no-default-browser-check',
      '--disable-features=msEdgeTranslate,Translate', `--window-size=${this.width},${this.height}`, 'about:blank'], { stdio: 'ignore', detached: true });
    this.proc.unref();
    const info = await waitFor(() => httpJson(`http://127.0.0.1:${this.port}/json/version`), 20000, this.name + ' devtools');
    this.ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((r, j) => { this.ws.on('open', r); this.ws.on('error', j); });
    this.ws.on('message', (d) => this._msg(d));
    const t = await this.raw('Target.getTargets', {});
    let page = (t.targetInfos || []).find((x) => x.type === 'page');
    if (!page) page = { targetId: (await this.raw('Target.createTarget', { url: 'about:blank' })).targetId };
    this.sid = (await this.raw('Target.attachToTarget', { targetId: page.targetId, flatten: true })).sessionId;
    await this.send('Page.enable', {}); await this.send('Runtime.enable', {});
    log(this.name, 'edge pid', this.proc.pid);
  }
  _msg(d) { let m; try { m = JSON.parse(d); } catch (e) { return; }
    if (m.id != null && this.pending.has(m.id)) { const p = this.pending.get(m.id); this.pending.delete(m.id); m.error ? p.j(new Error(JSON.stringify(m.error))) : p.r(m.result); return; }
    if (m.method === 'Runtime.exceptionThrown') this.errors.push(JSON.stringify(m.params.exceptionDetails).slice(0, 600));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') this.errors.push('console.error: ' + JSON.stringify(m.params.args.map((a) => a.value || a.description)).slice(0, 400)); }
  raw(method, params) { const id = ++this.id; return new Promise((r, j) => { this.pending.set(id, { r, j }); this.ws.send(JSON.stringify({ id, method, params })); }); }
  send(method, params) { const id = ++this.id; return new Promise((r, j) => { this.pending.set(id, { r, j }); this.ws.send(JSON.stringify({ id, method, params, sessionId: this.sid })); }); }
  async ev(expr) { const r = await this.send('Runtime.evaluate', { expression: expr, returnByValue: true }); if (r.exceptionDetails) throw new Error('eval: ' + JSON.stringify(r.exceptionDetails).slice(0, 300)); return r.result.value; }
  async nav(url) { await this.send('Page.navigate', { url }); await waitFor(() => this.ev('document.readyState==="complete"'), 20000, this.name + ' load'); await sleep(600); }
  async click(x, y) { for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); await sleep(90); }
  // selector 의 요소 중 (텍스트 조건에 맞고) 보이고 활성이며 가려지지 않은 첫 요소의 중심을 클릭한다
  async clickWhere(selector, text, opt) {
    opt = opt || {};
    const r = await this.ev(`(()=>{ const els=[...document.querySelectorAll(${JSON.stringify(selector)})];
      const want=${JSON.stringify(text || null)}, exact=${!!opt.exact};
      for(const el of els){ const t=(el.textContent||'').trim(); if(want!==null&&(exact?t!==want:!t.includes(want))) continue;
        if(el.disabled) continue; const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') continue;
        el.scrollIntoView({block:'center',inline:'center'}); const b=el.getBoundingClientRect(); if(!b.width||!b.height) continue;
        const x=b.left+b.width/2, y=b.top+b.height/2; const hit=document.elementFromPoint(x,y);
        if(hit&&(hit===el||el.contains(hit))) return {x,y,t}; }
      return null; })()`);
    if (!r) return false;
    await this.click(r.x, r.y); return r.t || true;
  }
  async clickWait(selector, text, ms, opt) { return waitFor(() => this.clickWhere(selector, text, opt), ms || 15000, this.name + ' click ' + selector + ' ' + (text || '')); }
  async shot(name) { const r = await this.send('Page.captureScreenshot', { format: 'png' }); const p = path.join(OUT, `${this.name}_${name}.png`); fs.writeFileSync(p, Buffer.from(r.data, 'base64')); RESULT.screenshots.push(path.basename(p)); log('shot', path.basename(p)); return p; }
  async text(sel) { return this.ev(`(document.querySelector(${JSON.stringify(sel)})||{}).textContent||''`); }
  // 공개 상태(읽기 전용) — seatToken 은 읽지 않는다
  async net() { return this.ev(`({roomId:NET.roomId, me:NET.me, revision:NET.revision, state:NET.roomState, started:NET.started, resuming:NET.resuming, phase:S&&S.phase, turn:S&&S.turnCount, current:S&&S.current, winner:S&&S.winner, battle:!!(S&&S.battle), stageBid:NET.stageBid, fxQ:NET.fxQueue.length, fxPlaying:NET.fxPlaying})`); }
  close() { try { execSync(`taskkill /F /T /PID ${this.proc.pid}`, { stdio: 'ignore' }); } catch (e) {} }
}

async function startServer(port) {
  const proc = spawn(process.execPath, [path.join(ROOT, 'server', 'authoritative', 'server.js')], { env: Object.assign({}, process.env, { DD_AUTH_PORT: String(port) }), stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; proc.stdout.on('data', (d) => out += d); proc.stderr.on('data', (d) => out += d);
  await waitFor(() => new Promise((res) => http.get(`http://127.0.0.1:${port}/healthz`, (r) => { r.resume(); res(r.statusCode === 200); }).on('error', () => res(false))), 15000, 'server');
  log('server pid', proc.pid, 'port', port);
  return { proc, out: () => out };
}

async function enterLobby(b) {
  // 첫 방문 튜토리얼(문서 로드마다 표시, #128) — 실제 버튼으로 닫는다. 표시가 늦게 뜰 수 있어 닫힐 때까지 반복
  await waitFor(() => b.ev(`typeof TUT!=="undefined"`), 10000, b.name + " script ready");
  await sleep(800);
  await waitFor(async () => {
    const open = await b.ev(`TUT.open`);
    if (!open) return true;
    if (!(await b.clickWhere("button", "대전 시작"))) await b.clickWhere("button", "건너뛰기");
    await sleep(500); return false;
  }, 20000, b.name + " tutorial closed", 300);
  await waitFor(async () => { if (await b.ev(`(document.getElementById("app")||{dataset:{}}).dataset.screen==="lobby"`)) return true; await b.clickWhere("#titleScreen button", "대전 시작"); await sleep(400); return false; }, 15000, b.name + " title → lobby", 300);
  await waitFor(() => b.ev(`!!document.getElementById("netLobbyTitle")`), 10000, b.name + " lobby card");
}
async function pickRosterAndPlace(b) {
  for (let i = 0; i < 6; i++) {
    const r = await waitFor(() => b.ev(`(()=>{ const c=[...document.querySelectorAll('.rosterCard')].find(d=>!d.classList.contains('on')); if(!c) return null; c.scrollIntoView({block:'center'}); const x=c.getBoundingClientRect(); return {x:x.left+x.width/2,y:x.top+x.height/2}; })()`), 8000, 'roster card');
    await b.click(r.x, r.y);
    await b.clickWait('#obBtns button', '선택하기', 8000);
    await sleep(150);
  }
  await b.clickWait('button', '02 비공개 배치', 5000).catch(() => {});
  await b.clickWait('button', '무작위 배치', 8000);
  await sleep(300);
}

/* ---- 화면만 보고 두는 봇 (클릭만) ---- */
async function screenState(b) {
  return b.ev(`(()=>{ const vis=el=>!!el&&getComputedStyle(el).display!=='none'&&!el.classList.contains('hidden');
    const ov=document.getElementById('overlay'), box=document.getElementById('overlayBox');
    const btns=sel=>[...document.querySelectorAll(sel)].filter(x=>!x.disabled&&vis(x)&&x.offsetParent!==null).map(x=>(x.textContent||'').trim());
    return { locked:document.body.classList.contains('fx-lock'), overlay:vis(ov), battle:!!document.getElementById('bmenu')&&vis(ov),
      bmenu:btns('#bmenu button'), fight:btns('#bsub-fight button:not(.skillInfoBtn):not(.skillInfoClose)'), infoBtns:document.querySelectorAll('#bsub-fight .skillInfoBtn').length, teleStage:(S&&S.teleport)?S.teleport.stage:0, fleeMine:!!(S&&S.fleePick&&S.fleePick.owner===NET.me), flee:btns('#bsub-flee button'), obBtns:btns('#obBtns button'),
      turnBar:btns('#turnBar button'), who:(document.querySelector('#boardInfo .who')||{}).textContent||'', side:(document.getElementById('sidePanel')||{}).textContent||'',
      hlAttack:document.querySelectorAll('#board .cell.hl-attack').length, hlMove:document.querySelectorAll('#board .cell.hl-move').length,
      fxBanner:vis(document.getElementById('fxBanner'))?(document.getElementById('fxTitle')||{}).textContent:'', msgBox:(document.getElementById('msgBox')||{}).textContent||'',
      waitingModal:vis(ov)&&/상대 선택 대기 중|상대가 행동을 선택하고 있습니다/.test(box.textContent) }; })()`);
}
const STATS = { host: { battleClicks: 0, modalClicks: 0, moves: 0, fleeClicks: 0 }, guest: { battleClicks: 0, modalClicks: 0, moves: 0, fleeClicks: 0 } };
const INFO = { done: false }, TELE = { count: 0 }; let SYNC = null; const SYNCSTAT = { fleeSwap: 0, fleeSkip: 0, teleSwap: 0, compared: 0, progressed: 0, mismatches: [] };
function markSync(b, kind) { SYNCSTAT[kind]++; if (!SYNC) SYNC = { kind, by: b.name, at: Date.now(), rev: null }; }
async function skillInfoProbe(b) {
  INFO.done = true;
  const rev0 = await b.ev('NET.revision');
  const t = await b.clickWhere('#bsub-fight .skillInfoBtn', null);
  await sleep(900);
  const st = await b.ev(`(()=>{ const box=document.getElementById('skillInfoBox'); const r=box?box.getBoundingClientRect():{height:0}; return {open:!!box&&getComputedStyle(box).display!=='none'&&r.height>0, text:box?box.textContent.slice(0,120):'', rev:NET.revision, expanded:[...document.querySelectorAll('#bsub-fight .skillInfoBtn')].some(x=>x.getAttribute('aria-expanded')==='true'), btnH:Math.round(((document.querySelector('#bsub-fight .skillInfoBtn')||{getBoundingClientRect:()=>({height:0})}).getBoundingClientRect()).height)}; })()`);
  await b.shot('14_skill_info_open_guest_432');
  check('I1 모바일(432px) 전투 기술 ⓘ 실제 클릭 → 설명 상자 열림·aria-expanded·44px 이상, 전송/턴 소비 없음(revision 불변)', !!t && st.open && st.expanded && st.btnH >= 44 && st.rev === rev0, st);
  await b.clickWhere('#skillInfoBox .skillInfoClose', '닫기'); await sleep(300);
  check('I2 [닫기]로 설명 상자가 닫힌다', await b.ev(`getComputedStyle(document.getElementById('skillInfoBox')).display==='none'`));
  return 'skillInfo';
}
async function botTurn(b, st, role, rnd) {
  const S = STATS[role];
  if (st.locked) return 'locked';
  if (st.battle) {
    if (st.fight.length) {
      if (role === 'guest' && !INFO.done && st.infoBtns > 0) return await skillInfoProbe(b); // CJ 모바일 QA — 432px 창에서 ⓘ 설명 실제 클릭
      const skill = st.fight[Math.floor(rnd() * st.fight.length)]; await b.clickWhere('#bsub-fight button:not(.skillInfoBtn):not(.skillInfoClose)', skill, { exact: true }); S.battleClicks++; return 'skill:' + skill; }
    if (st.flee.length) { await b.clickWhere('#bsub-flee button', st.flee[0], { exact: true }); S.fleeClicks++; return 'flee'; }
    if (st.bmenu.some((t) => t === '턴 종료')) { await b.clickWhere('#bmenu button', '턴 종료', { exact: true }); S.battleClicks++; return 'pass'; }
    if (st.bmenu.length) {
      const back = await b.clickWhere('#bmenuBack', null); if (back && st.fight.length === 0 && st.flee.length === 0) { /* 하위 메뉴가 비활성이면 뒤로 */ }
      if (rnd() < 0.08 && st.bmenu.includes('🏃 도망가기')) { await b.clickWhere('#bmenu button', '🏃 도망가기', { exact: true }); return 'menu:flee'; }
      await b.clickWhere('#bmenu button', '⚔️ 싸우기', { exact: true }); return 'menu:fight';
    }
    return 'battle-wait';
  }
  if (st.overlay && st.obBtns.length) {
    const pick = st.obBtns.filter((t) => !/취소/.test(t)); const t = (pick.length ? pick : st.obBtns)[Math.floor(rnd() * (pick.length || st.obBtns.length))];
    await b.clickWhere('#obBtns button', t, { exact: true }); S.modalClicks++; return 'modal:' + t;
  }
  if (st.overlay) return 'overlay-wait';
  if (st.fleeMine && st.turnBar.some((t) => /교환 생략/.test(t))) { // 도망 교환 — 후보(파란 칸) 실제 클릭 또는 [교환 생략]
    if (st.hlMove && rnd() < 0.7 && await b.clickWhere('#board .cell.hl-move', null)) { markSync(b, 'fleeSwap'); return 'fleeSwap'; }
    await b.clickWhere('#turnBar button', '교환 생략'); markSync(b, 'fleeSkip'); return 'fleeSkip'; }
  if (st.teleStage) { // 텔레포트 스왑 — 1단계·2단계 자기 말(파란 칸) 실제 클릭
    if (st.hlMove && await b.clickWhere('#board .cell.hl-move', null)) { if (st.teleStage === 2) markSync(b, 'teleSwap'); return 'tele' + st.teleStage; }
    await b.clickWhere('#turnBar button', '텔레포트 취소'); return 'teleCancel'; }
  if (!/나의 턴/.test(st.who)) return 'not-my-turn';
  if (st.hlAttack) { await b.clickWhere('#board .cell.hl-attack', null); return 'attack'; }
  if (st.turnBar.some((t) => /싸우지 않고 종료/.test(t))) { await b.clickWhere('#turnBar button', '싸우지 않고 종료'); return 'endNoFight'; }
  if (/주 행동 완료/.test(st.side)) return 'await-auto-end';
  if (TELE.count < 4 && st.turnBar.some((t) => /텔레포트/.test(t) && !/취소/.test(t)) && rnd() < 0.3) { if (await b.clickWhere('#turnBar button', '🌀 텔레포트')) { TELE.count++; return 'tele'; } }
  // 내 말 중 가장 전진한 하수인/폭탄을 골라 선택 → 전진 칸 클릭
  const plan = await b.ev(`(()=>{ const me=NET.me, fwd=me===0?-1:1; const cells=[...document.querySelectorAll('#board .cell')];
    const own=cells.filter(c=>c.querySelector('.pc.own')).map(c=>({r:+c.dataset.r,c:+c.dataset.c}));
    const foes=cells.filter(c=>c.querySelector('.pc:not(.own)')).map(c=>({r:+c.dataset.r,c:+c.dataset.c}));
    const sel=cells.find(c=>c.classList.contains('hl-sel'));
    const moves=cells.filter(c=>c.classList.contains('hl-move')).map(c=>({r:+c.dataset.r,c:+c.dataset.c}));
    return {own,foes,sel:sel?{r:+sel.dataset.r,c:+sel.dataset.c}:null,moves,fwd}; })()`);
  const cellXY = (r, c) => b.ev(`(()=>{ const e=document.querySelector('#board .cell[data-r="${r}"][data-c="${c}"]'); if(!e) return null; e.scrollIntoView({block:'center'}); const x=e.getBoundingClientRect(); return {x:x.left+x.width/2,y:x.top+x.height/2}; })()`);
  if (plan.sel && plan.moves.length) {
    const best = plan.moves.sort((a, c) => (c.r - plan.sel.r) * plan.fwd - (a.r - plan.sel.r) * plan.fwd + (rnd() - 0.5))[0];
    const xy = await cellXY(best.r, best.c); if (xy) { await b.click(xy.x, xy.y); S.moves++; return 'move'; }
  }
  // 가장 전진한 말부터(전진 방향 fwd 기준 행이 앞선 순서) — 막힌 말만 계속 고르지 않도록 이미 골랐던 칸(hl-sel)은 뒤로 돌린다
  const own = plan.own.sort((a, c) => (c.r - a.r) * plan.fwd + (rnd() - 0.5) * 2).filter((p) => !(plan.sel && p.r === plan.sel.r && p.c === plan.sel.c));
  const tried = own.slice(0, 8); const pickOne = tried[Math.floor(rnd() * Math.min(4, tried.length))];
  if (pickOne) { const xy = await cellXY(pickOne.r, pickOne.c); if (xy) { await b.click(xy.x, xy.y); return 'select'; } }
  return 'idle';
}

async function hidingAudit(b) {
  return b.ev(`(()=>{ const chips=[...document.querySelectorAll('#board .pc:not(.own)')]; const hidden=chips.filter(c=>c.classList.contains('hiddenId'));
    const leak=hidden.filter(c=>c.querySelector('img')||/assets\\/(minions|leaders)/.test(c.outerHTML)||c.getAttribute('aria-label')&&!/미공개/.test(c.getAttribute('aria-label')));
    return {opponentChips:chips.length, hiddenChips:hidden.length, leaks:leak.length, ownImgs:document.querySelectorAll('#board .pc.own img').length}; })()`);
}
async function motionProbe(b) { // 실제 연출 요소가 떠 있으면 그 요소의 computed animation 을 읽는다(읽기 전용)
  return b.ev(`(()=>{ const out={}; for(const sel of ['#board .cell.fx-boom','#board .cell.fx-trap','.btok.shake','#bstage.sigblink','.dmgfloat']){ const el=document.querySelector(sel); if(el) out[sel]=getComputedStyle(el).animationName; } return out; })()`);
}
async function noHScroll(b) { return b.ev(`document.documentElement.scrollWidth<=document.documentElement.clientWidth+1`); }

(async () => {
  let seed = 917; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const serverPort = await freePort();
  const srv = await startServer(serverPort);
  const proxy = await startDropProxy(0, serverPort);
  log('guest proxy port', proxy.port);
  const host = new Browser('host', 20000 + Math.floor(Math.random() * 4000), 1200, 900);
  const guest = new Browser('guest', 24500 + Math.floor(Math.random() * 4000), 432, 900);
  const browsers = [host, guest];
  try {
    await host.launch(); await guest.launch();
    await host.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    RESULT.notes.push('host: prefers-reduced-motion=reduce 에뮬레이트, 창 1200px · guest: 432px 창, TCP 중계 경유(재접속 단절용)');
    await host.nav(`http://127.0.0.1:${serverPort}/index.html`);
    await guest.nav(`http://127.0.0.1:${proxy.port}/index.html`);
    await enterLobby(host); await enterLobby(guest);
    check('L1 로비 카드: 공개 대전·초대 코드 안내, 코드/주소 입력칸 없음', await host.ev(`(()=>{ const c=document.querySelector('.lobbyCard.net'); return !!c&&/초대 코드는 필요하지 않습니다/.test(c.textContent)&&!document.getElementById('netCode')&&!document.getElementById('netServer')&&!/코드로 참가/.test(c.textContent); })()`));
    await guest.shot('01_lobby_432');
    await guest.send('Emulation.setDeviceMetricsOverride', { width: 320, height: 800, deviceScaleFactor: 1, mobile: true });
    await sleep(400);
    check('L2 320px 로비 가로 스크롤 없음', await noHScroll(guest));
    check('L3 320px 주요 버튼 높이 ≥44px', await guest.ev(`[...document.querySelectorAll('.lobbyCard.net button')].every(b=>b.getBoundingClientRect().height>=44)`));
    await guest.shot('01_lobby_320');
    await guest.send('Emulation.clearDeviceMetricsOverride', {});
    await host.shot('01_lobby_desktop');

    await host.clickWait('button', '새 방 만들기');
    await waitFor(() => host.ev(`!!NET.roomId`), 10000, 'room opened');
    await pickRosterAndPlace(host);
    await host.shot('02_placed_host');
    await host.clickWait('button', '배치 완료 → 준비 완료');
    await waitFor(() => host.ev(`/상대를 기다리는 중/.test(document.getElementById('sidePanel').textContent)`), 8000, 'host waiting text');
    check('R1 호스트: 상대 입장 전 "상대를 기다리는 중…"·내 준비 미확정 표시', await host.ev(`(()=>{ const t=document.getElementById('sidePanel').textContent; return /상대: 입장 대기/.test(t)&&!/내 준비: ● 완료/.test(t); })()`));
    await host.shot('03_waiting_guest_host');

    await guest.clickWait('button', '새로고침');
    await waitFor(() => guest.ev(`!!document.querySelector('.netRoomRow')`), 10000, 'guest sees room');
    await guest.shot('04_room_list_guest');
    const roomLabel = await guest.text('.netRoomRow .netRoomInfo');
    check('L4 게스트 목록에 "방 #… · 1/2 · 경과" 행', /방 #.+· 1\/2 · /.test(roomLabel), roomLabel);
    await guest.clickWait('.netRoomRow button', '참가', 10000, { exact: true });
    await waitFor(() => host.ev(`NET.roomState==='SETUP'`), 10000, 'host notified');
    await waitFor(() => host.ev(`/서버에 준비를 알리는 중|상대의 준비를 기다리는 중/.test(document.getElementById('sidePanel').textContent)`), 10000, 'host auto-sent ready');
    await waitFor(() => host.ev(`NET.myReady===true`), 10000, 'host ready confirmed');
    check('R2 게스트 입장 알림 뒤 호스트 준비가 서버에서 확정되고 "상대의 준비를 기다리는 중…"', await host.ev(`/상대의 준비를 기다리는 중/.test(document.getElementById('sidePanel').textContent)&&/내 준비: ● 완료/.test(document.getElementById('sidePanel').textContent)`));
    await host.shot('05_waiting_ready_host');
    await pickRosterAndPlace(guest);
    await guest.shot('05_placed_guest');
    await guest.clickWait('button', '배치 완료 → 준비 완료');
    await waitFor(() => host.ev(`S.phase==='play'`) && guest.ev(`S.phase==='play'`), 20000, 'match started');
    await waitFor(async () => (await host.ev(`S.phase==='play'`)) && (await guest.ev(`S.phase==='play'`)), 20000, 'both play');
    await host.shot('06_play_host'); await guest.shot('06_play_guest');
    check('P1 양측 서버 스냅샷으로 대국 시작', true, { host: await host.net(), guest: await guest.net() });

    const audit0 = await hidingAudit(guest);
    check('H1 게스트 화면: 미공개 상대 칩에 이미지·자산 경로·정체 라벨 없음', audit0.leaks === 0 && audit0.ownImgs > 0, audit0);

    const t0 = Date.now(); let reconnected = false; let battleShots = 0, modalShots = 0, waitShots = 0, bannerShots = 0; const motion = {}; let lastHideAudit = 0; let resultShot = false; let koShot = false;
    let step = 0; const actions = { host: [], guest: [] };
    while (Date.now() - t0 < MINUTES * 60000) {
      step++;
      for (const [b, role] of [[host, 'host'], [guest, 'guest']]) {
        let st; try { st = await screenState(b); } catch (e) { continue; }
        if (st.battle && battleShots < 6 && (step % 3 === 0)) { await b.shot(`07_battle_${role}_${++battleShots}`); }
        if (st.waitingModal && !st.fxBanner && waitShots < 2) { await b.shot(`08_modal_wait_${role}_${++waitShots}`); }
        if (st.overlay && !st.battle && !st.fxBanner && st.obBtns.length && modalShots < 3) { await b.shot(`08_modal_owner_${role}_${++modalShots}`); }
        if (st.fxBanner && bannerShots < 8 && /승리|패배|포획|쓰러|밀어|접촉|폭발|함정|도망/.test(st.fxBanner)) { await b.shot(`09_banner_${role}_${++bannerShots}`); }
        if (!koShot && st.overlay && /쓰러졌다/.test(st.msgBox)) { koShot = true; await b.shot(`09_ko_msg_${role}`); }
        if (role === 'host') { const m = await motionProbe(host).catch(() => ({})); Object.assign(motion, m); }
        const a = await botTurn(b, st, role, rnd).catch((e) => 'err:' + e.message);
        if (a && !/wait|locked|not-my-turn|idle/.test(a)) actions[role].push(a);
      }
      const hn = await host.net(), gn = await guest.net();
      if (step % 40 === 0) log("progress", { step, turn: hn.turn, rev: hn.revision, cur: hn.current, battle: hn.battle || gn.battle, stats: STATS, recent: { host: actions.host.slice(-4), guest: actions.guest.slice(-4) } });
      if (SYNC) { // 교환·텔레포트 직후 — 양측이 조용해지고 revision 이 같아지면 current·turn 비교, 이후 진행 확인
        const quiet = !hn.fxQ && !gn.fxQ && !hn.fxPlaying && !gn.fxPlaying && !hn.resuming && !gn.resuming;
        if (SYNC.rev === null) SYNC.rev = Math.min(hn.revision, gn.revision);
        if (!SYNC.cmp && quiet && hn.revision === gn.revision && hn.revision > SYNC.rev) { SYNC.cmp = { rev: hn.revision, t: Date.now() }; SYNCSTAT.compared++;
          if (!(hn.current === gn.current && hn.turn === gn.turn && hn.phase === gn.phase)) SYNCSTAT.mismatches.push({ kind: SYNC.kind, host: hn, guest: gn }); }
        if (SYNC.cmp) { if (hn.revision > SYNC.cmp.rev || hn.phase === 'over') { SYNCSTAT.progressed++; SYNC = null; } else if (Date.now() - SYNC.cmp.t > 25000) { SYNCSTAT.mismatches.push({ kind: SYNC.kind, deadlock: true, host: hn, guest: gn }); SYNC = null; } }
      }
      if (Date.now() - lastHideAudit > 20000 && hn.phase === 'play') { lastHideAudit = Date.now(); const au = await hidingAudit(host); if (au.leaks) check('H2 진행 중 호스트 화면 정보 은닉', false, au); }
      // 전투가 진행 중일 때(전투 행동 2회 이상 뒤) 게스트 네트워크를 실제로 끊었다가 복구 — 같은 경기·같은 전투로 돌아오는지 본다
      if (!reconnected && hn.phase === 'play' && (STATS.host.battleClicks + STATS.guest.battleClicks) >= 2 && gn.battle) {
        const pre = await guest.net();
        log('reconnect: dropping guest TCP', pre);
        proxy.drop(4500);
        await waitFor(() => guest.ev(`!!document.getElementById('netResumeBar')&&getComputedStyle(document.getElementById('netResumeBar')).display!=='none'`), 8000, 'guest reconnecting ui');
        await sleep(300);
        await guest.shot('10_reconnecting_guest');
        check('C1 실제 TCP 단절 → 전투 화면 위에도 보이는 고정 "재접속 중…" 상태 줄(남은 시간·포기 버튼)·전투 버튼 잠금', await guest.ev(`(()=>{ const b=document.getElementById('netResumeBar'); const r=b.getBoundingClientRect(); const hit=document.elementFromPoint(r.left+r.width/2, r.top+10);
          const btns=[...document.querySelectorAll('#overlayBox button')].filter(x=>x.id!=='bmenuBack');
          return getComputedStyle(b).display!=='none'&&/남은 시간 [0-9]+초/.test(b.textContent)&&!!hit&&b.contains(hit)&&btns.every(x=>x.disabled); })()`));
        await waitFor(async () => { const n = await guest.net(); return !n.resuming && n.phase === 'play'; }, 30000, 'guest resumed', 400);
        await sleep(1500);
        const post = await guest.net(), hpost = await host.net();
        if (post.battle) { await waitFor(() => guest.ev(`!document.getElementById('overlay').classList.contains('hidden')&&!!document.getElementById('bmenu')`), 8000, 'battle stage restored'); check('C2b 재개 직후 진행 중이던 전투 무대가 서버 스냅샷으로 다시 그려진다', true, { battle: post.battle }); }
        check('C2 같은 방·같은 좌석으로 재개, revision 역행 없음·호스트와 수렴', post.roomId === pre.roomId && post.me === pre.me && post.revision >= pre.revision && post.revision === hpost.revision, { pre, post, host: hpost, proxy: proxy.stats });
        await guest.shot('11_reconnected_guest'); await host.shot('11_after_guest_reconnect_host');
        reconnected = true; RESULT.reconnectRevisionAtResume = post.revision;
      }
      if (reconnected && !RESULT.progressAfterResume && gn.revision > (RESULT.reconnectRevisionAtResume || 1e9) + 2) { RESULT.progressAfterResume = gn.revision; check('C3 재개 뒤 대국이 계속 진행된다(새 행동 수락)', true, { from: RESULT.reconnectRevisionAtResume, to: gn.revision }); }
      if (hn.phase === 'over' && gn.phase === 'over') {
        await waitFor(async () => !(await host.ev('document.body.classList.contains("fx-lock")')) && !(await guest.ev('document.body.classList.contains("fx-lock")')), 20000, 'result fx done');
        await host.shot('12_result_host'); await guest.shot('12_result_guest'); resultShot = true;
        break;
      }
      await sleep(150);
    }
    if (!resultShot) {
      RESULT.notes.push('시간 상한 안에 자연 종료되지 않아 현재 차례 좌석이 기권 버튼으로 종료했다(기권도 실제 클릭).');
      for (const b of browsers) { const st = await screenState(b); if (/나의 턴/.test(st.who) && !st.overlay) { await b.clickWhere('#turnBar button', '기권'); await sleep(400); await b.clickWhere('#obBtns button', '기권 확정'); break; } }
      await waitFor(async () => (await host.ev(`S.phase==='over'`)) && (await guest.ev(`S.phase==='over'`)), 20000, 'over after resign');
      await sleep(3500); await host.shot('12_result_host'); await guest.shot('12_result_guest');
    }
    const hn = await host.net(), gn = await guest.net();
    check('E1 양측 결과 화면·승자·revision 일치', hn.phase === 'over' && gn.phase === 'over' && hn.winner === gn.winner && hn.revision === gn.revision, { host: hn, guest: gn });
    check('E2 결과 화면 문구(VICTORY/DEFEAT·공개 방 안내)', await host.ev(`/VICTORY|DEFEAT/.test(document.getElementById('sidePanel').textContent)&&/공개 방 목록/.test(document.getElementById('sidePanel').textContent)`));
    check('E3 종료 공개: 결과 화면에서 상대 말 정체가 모두 보인다(미공개 칩 0)', (await hidingAudit(host)).hiddenChips === 0, await hidingAudit(host));
    if (!INFO.done) check('I1 모바일(432px) 전투 기술 ⓘ 실제 클릭', false, '게스트 전투 차례에 도달하지 못해 검증하지 못함');
    check('S1 도망 교환·텔레포트 스왑 실제 클릭 직후 양측 current·turn·revision 일치, 이후 진행(교착 0)', SYNCSTAT.compared > 0 && SYNCSTAT.teleSwap > 0 && SYNCSTAT.mismatches.length === 0 && SYNCSTAT.progressed >= SYNCSTAT.compared - (SYNC ? 1 : 0), SYNCSTAT);
    if (!(SYNCSTAT.fleeSwap + SYNCSTAT.fleeSkip)) RESULT.notes.push('S1: 이번 실행에서 도망 성공(교환 선택)은 브라우저에서 발생하지 않았다 — 교환 동기화는 실서버 2클라이언트 통합(smoke_public_live T3)이 증빙.');
    check('B1 실제 전투 행동 클릭이 서버에 수락되어 진행', STATS.host.battleClicks + STATS.guest.battleClicks > 0, STATS);
    check('B2 전투 무대 스크린샷 확보', battleShots > 0, battleShots);
    check('M1 reduced-motion 창의 실제 연출 요소 computed animation-name', Object.keys(motion).length === 0 ? null : Object.values(motion).every((v) => v === 'none'), motion);
    if (Object.keys(motion).length === 0) RESULT.notes.push('M1: 관측 구간에 fx-boom/shake 등 연출 요소가 떠 있는 순간을 잡지 못했다 — 판정 보류(PASS로 기재하지 않음).');
    check('X1 브라우저 예외/console.error 0', host.errors.length + guest.errors.length === 0, host.errors.concat(guest.errors).slice(0, 5));
    RESULT.actions = { host: actions.host.slice(-60), guest: actions.guest.slice(-60), counts: STATS };
    // 로비 복귀 — 실제 버튼
    await host.clickWhere('button', '로비로 돌아가기'); await sleep(1500);
    check('E4 결과 → 로비 복귀 시 공개 방 목록을 다시 불러온다', await host.ev(`!!document.getElementById('netLobbyTitle')&&(NET.roomsLoaded||NET.roomsLoading)`));
    await host.shot('13_back_to_lobby_host');
  } catch (e) {
    check('FATAL', false, e.stack || String(e));
    for (const b of browsers) { try { await b.shot('zz_fatal_' + Date.now()); } catch (x) {} }
  } finally {
    RESULT.finishedAt = new Date().toISOString();
    RESULT.serverLogTail = srv.out().slice(-1500);
    fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(RESULT, null, 2));
    fs.writeFileSync(path.join(OUT, 'run.log'), LOG.join('\n'));
    for (const b of browsers) b.close();
    await proxy.close(); srv.proc.kill();
    const failed = RESULT.checks.filter((c) => c.ok === false);
    log('DONE checks', RESULT.checks.length, 'failed', failed.length, 'out', OUT);
    process.exit(failed.length ? 1 : 0);
  }
})();
