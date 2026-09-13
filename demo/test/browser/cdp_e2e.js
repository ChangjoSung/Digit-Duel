// #217/#218 실브라우저 E2E 증빙 스크립트 (Mars 소유, demo/test/browser).
// PD 지시(msg_301e8639835e): OS 접근성 자동화 대신 CDP(Chrome DevTools Protocol)로 독립 Edge 두 인스턴스를
// 구동해 로비→배치→접촉→전투/결과/재접속을 재현한다. 실제 마우스 입력 이벤트(Input.dispatchMouseEvent)만
// 으로 행동을 일으킨다 — Runtime.evaluate는 "어디를 클릭할지" 좌표를 읽거나(getBoundingClientRect) 결과
// DOM을 검증하는 데만 쓰고, 페이지 내부 함수를 직접 호출해 게임 상태를 만들지 않는다(헤드리스 엔진 fixture나
// 내부 상태 주입으로 실브라우저 증빙을 대체하는 것은 금지, PD 지시 원문).
// 기존 사용자 브라우저는 건드리지 않는다 — 별도 user-data-dir로 새 Edge 프로세스 두 개를 띄운다.
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require(path.join(__dirname, '..', '..', '..', 'server', 'node_modules', 'ws'));

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const SERVER_URL = 'http://127.0.0.1:8081/index.html';
const OUT_DIR = process.env.CDP_OUT_DIR || 'C:/dd_cdp/out';
fs.mkdirSync(OUT_DIR, { recursive: true });

function log(...a) { console.log('[cdp_e2e]', new Date().toISOString().slice(11, 19), ...a); }

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (d) => (data += d));
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

async function waitFor(fn, timeoutMs, intervalMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try { const v = await fn(); if (v) return v; } catch (e) { lastErr = e; }
    await new Promise((r) => setTimeout(r, intervalMs || 200));
  }
  throw new Error('waitFor timeout: ' + (lastErr ? lastErr.message : 'condition never true'));
}

class Session {
  constructor(name, port, userDataDir) {
    this.name = name;
    this.port = port;
    this.userDataDir = userDataDir;
    this.id = 0;
    this.pending = new Map();
  }
  async launch() {
    this.proc = spawn(EDGE_PATH, [
      `--remote-debugging-port=${this.port}`,
      `--user-data-dir=${this.userDataDir}`,
      '--no-first-run', '--no-default-browser-check',
      '--window-size=520,900',
      'about:blank',
    ], { stdio: 'ignore', detached: true });
    this.proc.unref();
    const info = await waitFor(() => httpGetJson(`http://127.0.0.1:${this.port}/json/version`), 15000, 300);
    this.browserWsUrl = info.webSocketDebuggerUrl;
    this.browserWs = new WebSocket(this.browserWsUrl);
    await new Promise((res, rej) => { this.browserWs.on('open', res); this.browserWs.on('error', rej); });
    this.browserWs.on('message', (d) => this._onMessage(d));
    const targets = await this._sendOn('Target.getTargets', {});
    let target = (targets.targetInfos || []).find((t) => t.type === 'page');
    if (!target) {
      const created = await this._sendOn('Target.createTarget', { url: 'about:blank' });
      target = { targetId: created.targetId };
    }
    const attach = await this._sendOn('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    this.sessionId = attach.sessionId;
    await this._send('Page.enable', {});
    await this._send('Runtime.enable', {});
    await this._send('Network.enable', {});
    log(this.name, 'launched, pid', this.proc.pid, 'port', this.port);
  }
  _onMessage(data) {
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    if (m.id != null && this.pending.has(m.id)) {
      const { resolve, reject } = this.pending.get(m.id);
      this.pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error))); else resolve(m.result);
    }
  }
  _sendOn(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.browserWs.send(JSON.stringify({ id, method, params }));
    });
  }
  _send(method, params) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.browserWs.send(JSON.stringify({ id, method, params, sessionId: this.sessionId }));
    });
  }
  async navigate(url) {
    await this._send('Page.navigate', { url });
    await waitFor(() => this.evaluate('document.readyState==="complete"&&!!document.title'), 15000, 300);
    await new Promise((r) => setTimeout(r, 500));
  }
  async evaluate(expression) {
    const r = await this._send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: false });
    if (r.exceptionDetails) throw new Error('evaluate error: ' + JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  async click(x, y) {
    await this._send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this._send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await this._send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    // PD 지시(msg_4109ba90312c) — 고정 sleep을 줄인다. 이 게임은 클릭 시 동기 로컬 렌더(선택·하이라이트)라
    // 짧은 정착 시간이면 충분하고, 서버 왕복이 필요한 전이는 각 호출부의 waitFor()가 실제 상태 변화를 본다.
    await new Promise((r) => setTimeout(r, 120));
  }
  async rectOfText(selector, textMatch, exact) {
    // scrollIntoView는 실제 사용자가 화면을 스크롤해 버튼을 보이게 하는 것과 같다(내부 상태 조작이 아니다) —
    // 좁은 창 높이에서 튜토리얼/모달 내부 스크롤 때문에 버튼이 뷰포트 밖에 있으면 클릭 좌표만 맞고 실제
    // 히트테스트는 다른 요소(오버레이 배경 등)에 걸리는 문제를 막는다. exact=true는 "참가"가 "코드로 참가"
    // 처럼 다른 버튼의 부분 문자열일 때 잘못된 버튼을 집지 않게 한다.
    return this.evaluate(`(() => {
      const nodes=[...document.querySelectorAll(${JSON.stringify(selector)})];
      const el=nodes.find(n => {
        const t=(n.textContent||'').trim();
        return ${exact ? 't===' + JSON.stringify(textMatch) : 't.includes(' + JSON.stringify(textMatch) + ')'};
      });
      if(!el) return null;
      el.scrollIntoView({block:'center', inline:'center'});
      const r=el.getBoundingClientRect();
      const cx=r.left+r.width/2, cy=r.top+r.height/2;
      const hit=document.elementFromPoint(cx,cy);
      const covered = hit!==el && !el.contains(hit) && !(hit&&hit.contains(el));
      return {x:cx, y:cy, covered};
    })()`);
  }
  async clickText(selector, textMatch, exact) {
    const rect = await waitFor(async () => {
      const r = await this.rectOfText(selector, textMatch, exact);
      return r && !r.covered ? r : null;
    }, 15000, 300);
    if (!rect) throw new Error(`clickText: no unobstructed match for ${selector} / ${textMatch}`);
    await this.click(rect.x, rect.y);
    return rect;
  }
  async screenshot(name) {
    const r = await this._send('Page.captureScreenshot', { format: 'png' });
    const p = path.join(OUT_DIR, `${this.name}_${name}.png`);
    fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
    log(this.name, 'screenshot ->', p);
    return p;
  }
  async setOffline(offline) {
    await this._send('Network.emulateNetworkConditions', {
      offline, latency: 0, downloadThroughput: offline ? 0 : -1, uploadThroughput: offline ? 0 : -1,
    });
    log(this.name, 'network offline =', offline);
  }
  async close() {
    try { if (this.proc && this.proc.pid) require('child_process').execSync(`taskkill /F /T /PID ${this.proc.pid}`, { stdio: 'ignore' }); } catch (e) {}
  }
}

async function skipTutorialAndStart(s) {
  await s.clickText('button', '건너뛰기');
  await s.clickText('button', '대전 시작');
}

async function pickRoster(s, count) {
  for (let i = 0; i < count; i++) {
    const rect = await waitFor(() => s.evaluate(`(() => {
      const card=[...document.querySelectorAll('.rosterCard')].find(d=>!d.classList.contains('on'));
      if(!card) return null;
      const r=card.getBoundingClientRect();
      return {x:r.left+r.width/2, y:r.top+r.height/2};
    })()`), 5000, 200);
    if (!rect) throw new Error('pickRoster: no unselected card found');
    await s.click(rect.x, rect.y);
    await s.clickText('button', '선택하기');
  }
}

async function readBoard(s) {
  // 실제 렌더된 셀에서 위치(data-r/c)와 소유(own 클래스 여부)만 읽는다 — 정체 판별에 필요한 값은 읽지 않는다.
  return s.evaluate(`(() => {
    const cells=[...document.querySelectorAll('#board .cell')];
    const mine=[], enemy=[];
    for(const c of cells){
      const pc=c.querySelector('.pc');
      if(!pc) continue;
      const r=+c.dataset.r, col=+c.dataset.c;
      const rect=c.getBoundingClientRect();
      const info={r,c:col,x:rect.left+rect.width/2,y:rect.top+rect.height/2};
      if(pc.classList.contains('own')) mine.push(info); else enemy.push(info);
    }
    return {mine, enemy};
  })()`);
}

async function endTurnIfMainUsed(s) {
  // PD 지시(msg_8e7c2603c366) — "주 행동 완료" 배지가 떠 있으면 이번 턴은 더 이상 이동/전투를 시도하지
  // 않는다(주 행동은 턴당 1회, 말 단위가 아니다). 남은 선택 전투가 있으면 "싸우지 않고 종료" 버튼을 실제
  // 클릭하고, 없으면(자동 진행 대기) 그대로 둔다 — 상태를 읽기만 하고 내부 값을 주입하지 않는다.
  const mainUsed = await s.evaluate(`document.getElementById('sidePanel')?.textContent.includes('주 행동 완료')`);
  if (!mainUsed) return false;
  const endRect = await s.rectOfText('button', '싸우지 않고 종료');
  if (endRect && !endRect.covered) { await s.click(endRect.x, endRect.y); return true; }
  return true; // 주 행동은 끝났고 종료 버튼도 없다 — 서버 자동 진행을 기다린다(다음 폴링에서 턴이 넘어가 있을 것)
}
async function tryOneMove(s) {
  if (await endTurnIfMainUsed(s)) return { moved: false, reason: 'main-already-used' };
  const { mine, enemy } = await readBoard(s);
  if (!mine.length || !enemy.length) return { moved: false, reason: 'no-pieces' };
  // 가장 가까운 적 칸까지의 맨해튼 거리 기준으로 내 말을 정렬 — 위치는 실제 DOM(data-r/c)에서 읽은 값이다.
  const dist = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
  mine.sort((a, b) => {
    const da = Math.min(...enemy.map((e) => dist(a, e)));
    const db = Math.min(...enemy.map((e) => dist(b, e)));
    return da - db;
  });
  for (const piece of mine) {
    await s.click(piece.x, piece.y);
    const highlights = await s.evaluate(`(() => {
      const cells=[...document.querySelectorAll('#board .cell')];
      const attack=[], move=[];
      for(const c of cells){
        const r=+c.dataset.r, col=+c.dataset.c;
        const rect=c.getBoundingClientRect();
        const info={r,c:col,x:rect.left+rect.width/2,y:rect.top+rect.height/2};
        if(c.classList.contains('hl-attack')) attack.push(info);
        else if(c.classList.contains('hl-move')) move.push(info);
      }
      return {attack, move};
    })()`);
    if (highlights.attack && highlights.attack.length) {
      await s.click(highlights.attack[0].x, highlights.attack[0].y);
      return { moved: true, battled: true };
    }
    if (highlights.move && highlights.move.length) {
      const nearestEnemy = enemy.reduce((best, e) => (dist(piece, e) < dist(piece, best) ? e : best), enemy[0]);
      highlights.move.sort((a, b) => dist(a, nearestEnemy) - dist(b, nearestEnemy));
      await s.click(highlights.move[0].x, highlights.move[0].y);
      return { moved: true, battled: false };
    }
    // 이 말은 움직일 수 없다 — 선택 해제 후 다음 후보로.
    await s.click(piece.x, piece.y);
  }
  return { moved: false, reason: 'no-valid-move' };
}

module.exports = { Session, waitFor, skipTutorialAndStart, pickRoster, readBoard, tryOneMove, OUT_DIR };
