'use strict';
// #260 프로필 · 대표 하수인 · 공식 전적 — 서버 쪽 경계.
//   A. Room: 보드 경기(IN_PROGRESS)를 떠나는 전이에서만 정확히 한 번 onResult(notify:false 인 기권 WIN 포함) · 경기 전 취소는 없음.
//   B. matchRows: 승/패(기권·몰수) · NO_CONTEST(기록만) · 사유 · 상대 닉네임 스냅샷 · 턴 · 시간.
//   C. HTTP /api/profile* (세션·CSRF·입력 검증·DB 장애 503) · WS reps(입장 때 고정, 재접속 유지) · 공개 목록 비노출 ·
//      같은 결과 1회 저장 · DB 장애 중 결과 보류 → 재시도 저장(조용한 유실 없음) · 최근 20 · DB 없는 서버.
// 저장소는 기본이 메모리 대역이고, DD_TEST_DATABASE_URL 이 있으면 실제 Postgres(pgStore + 001~005 마이그레이션)로 같은 C 를 돈다
// (그 DB 의 표를 지운다 — 전용 테스트 DB 에만).
const http = require('http');
const WebSocket = require('ws');
const H = require('./helpers');
const { server, lobby, useAccounts } = require('../server');
const A = require('../accounts');
const { STATES } = require('../room');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }

/* ===== 저장소 대역 — 이 테스트가 부르는 pgStore 메서드만, 같은 계약으로 ===== */
function memStore() {
  const accts = new Map(), sessions = new Map(), results = [];
  let seq = 0, rowId = 0, down = false;
  const guard = () => { if (down) { const e = new Error('connect ECONNREFUSED 10.0.0.5:5432'); e.code = 'ECONNREFUSED'; throw e; } };
  return {
    setDown(v) { down = v; },
    async createAccount({ userId, nickname, email, passwordHash }, sess) {
      guard();
      if ([...accts.values()].some((a) => a.user_id === userId)) return { taken: 'userId' };
      const id = String(++seq);
      accts.set(id, { id, user_id: userId, nickname, email, password_hash: passwordHash, rep_minion: 'M-F1' });
      sessions.set(sess.hash, { account_id: id, expires: Date.now() + sess.ttlMs });
      return { id, login_gen: 0 };
    },
    async deleteSession(h) { guard(); sessions.delete(h); },
    async findSession(h) {
      guard();
      const s = sessions.get(h);
      if (!s || s.expires <= Date.now()) return null;
      const a = accts.get(s.account_id);
      return { id: a.id, user_id: a.user_id, nickname: a.nickname, has_email: true, rep_minion: a.rep_minion, expires_at: s.expires, login_gen: 0 };
    },
    async getProfile(id) {
      guard();
      const a = accts.get(String(id));
      if (!a) return null;
      const mine = results.filter((r) => r.account_id === String(id));
      return { nickname: a.nickname, rep_minion: a.rep_minion, wins: mine.filter((r) => r.result === 'WIN').length, losses: mine.filter((r) => r.result === 'LOSS').length };
    },
    async recentMatches(id, limit) {
      guard();
      return results.filter((r) => r.account_id === String(id))
        .sort((x, y) => (y.ended_at.localeCompare(x.ended_at)) || (y.id - x.id)).slice(0, limit);
    },
    async setRepMinion(id, m) { guard(); const a = accts.get(String(id)); if (!a) return false; a.rep_minion = m; return true; },
    async insertMatchRows(rows) {
      guard();
      if (rows.some((r) => !['WIN', 'LOSS', 'NO_CONTEST'].includes(r.result) || !/^[a-z_]{1,32}$/.test(r.reason))) {
        const e = new Error('check'); e.code = '23514'; throw e; // CHECK 위반 흉내 — 문장 전체가 거부된다
      }
      if (rows.some((r) => !accts.has(String(r.account_id)))) { const e = new Error('fk'); e.code = '23503'; throw e; } // FK 위반 흉내
      for (const r of rows) {
        const account_id = String(r.account_id);
        if (results.some((x) => x.match_id === r.match_id && x.account_id === account_id)) continue; // ON CONFLICT DO NOTHING
        results.push(Object.assign({}, r, { account_id, id: ++rowId }));
      }
    },
  };
}

async function pgFixture(url) {
  const { Pool } = require('pg');
  const mig = require('../../db-migrate');
  const pool = new Pool({ connectionString: url, max: 4 });
  await pool.query('DROP TABLE IF EXISTS match_results, password_resets, sessions, accounts, db_meta, schema_migrations');
  await mig.up(pool, mig.loadMigrations());
  let down = false;
  const query = (t, p) => (down ? Promise.reject(Object.assign(new Error('down'), { code: 'ECONNREFUSED' })) : pool.query(t, p));
  return { store: Object.assign(A.pgStore(query), { setDown(v) { down = v; } }), pool };
}

/* ===== HTTP·WS 도우미 (test-issue259-accounts.js 와 같은 모양) ===== */
let PORT;
function req(method, path, { body, cookie, origin = true, type = 'application/json' } = {}) {
  return new Promise((resolve, reject) => {
    const h = {};
    if (origin) h.Origin = `http://127.0.0.1:${PORT}`;
    if (cookie) h.Cookie = cookie;
    const data = body === undefined ? null : JSON.stringify(body);
    if (data !== null) { h['Content-Type'] = type; h['Content-Length'] = Buffer.byteLength(data); }
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path, headers: h }, (res) => {
      let buf = '';
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        let json = null; try { json = JSON.parse(buf); } catch (e) { /* noop */ }
        const set = res.headers['set-cookie'] ? res.headers['set-cookie'][0] : null;
        resolve({ status: res.statusCode, json, cookie: set ? set.split(';')[0] : null });
      });
    });
    r.on('error', reject);
    if (data !== null) r.write(data);
    r.end();
  });
}
const post = (path, body, opts) => req('POST', path, Object.assign({ body }, opts || {}));
function wsOpen(cred, cookie) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/`, ['digit-duel.v1', cred], { headers: cookie ? { Cookie: cookie } : {} });
    const frames = [];
    ws.on('message', (d) => frames.push(JSON.parse(d.toString())));
    ws.on('unexpected-response', (_q, res) => resolve({ status: res.statusCode }));
    ws.on('open', () => resolve({ status: 101, ws, frames }));
    ws.on('error', () => {});
  });
}
async function waitFor(frames, pred, ms = 3000) {
  const end = Date.now() + ms;
  for (;;) {
    const f = frames.find(pred);
    if (f) return f;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, 10));
  }
}
const ended = (matchId, result, turns = 3) => ({ matchId, result, turns, startedAt: Date.now() - 65000, endedAt: Date.now() });
const hex = (ch) => ch.repeat(32);

async function main() {
  /* ===== A. Room 훅 — 실제 엔진으로 ===== */
  const calls = (room) => { const got = []; room.onResult = (e) => got.push(e); return got; };
  {
    const room = H.startedRoom(2601);
    const got = calls(room);
    const cur = room.engines[0].S.current;
    const res = H.act(room, cur, { t: 'resign' }); // notify:false 로 끝나는 경로
    ok(res.ok && room.state === STATES.FINISHED && got.length === 1, 'A1 기권 WIN(notify:false) 도 onResult 정확히 1회');
    const e = got[0] || {};
    ok(e.result && e.result.type === 'WIN' && e.result.winType === 'resign' && e.result.winner === 1 - cur && /^[0-9a-f]{32}$/.test(e.matchId)
      && e.turns === room.engines[0].S.turnCount + 1 && e.turns >= 1 && e.endedAt >= e.startedAt, 'A1 결과·match id·턴(경기 턴 번호)·시각 ' + JSON.stringify(e));
    room.close(); // FINISHED → CLOSED 는 보드를 떠나는 전이가 아니다
    ok(got.length === 1, 'A1 이후 CLOSED 전이는 다시 기록하지 않는다');
  }
  {
    const room = H.setupRoom(2602);
    const got = calls(room);
    room.explicitLeave(0);
    ok(room.state === STATES.CANCELED && got.length === 0, 'A2 경기 시작 전 취소는 기록하지 않는다');
  }
  {
    const room = H.startedRoom(2603);
    const got = calls(room);
    room.socketClosed(0);
    room.seats[0].disconnectExpiry = Date.now() - 1;
    room._onGraceExpire(0);
    ok(room.result.type === 'FORFEIT' && got.length === 1 && got[0].result.winner === 1, 'A3 연결 종료 몰수 → 1회');
  }
  {
    const room = H.startedRoom(2604);
    const got = calls(room);
    room.socketClosed(0); room.socketClosed(1);
    const t = Date.now() - 1;
    room.seats[0].disconnectExpiry = t; room.seats[1].disconnectExpiry = t;
    room._onGraceExpire(0);
    ok(room.result.type === 'NO_CONTEST' && got.length === 1, 'A4 동시 만료 NO_CONTEST → 1회');
  }
  {
    const room = H.startedRoom(2605);
    const got = calls(room);
    room._engineFault(new Error('boom'));
    ok(room.state === STATES.VOID && got.length === 1 && got[0].turns >= 1, 'A5 경기 중 서버 장애 VOID → 1회(엔진을 비우기 전에 턴을 읽음)');
    const r2 = H.startedRoom(2606); const g2 = calls(r2); r2.voidForRestart();
    ok(g2.length === 1 && g2[0].result.reason === 'RESTART', 'A5 재시작 VOID → 1회');
  }

  /* ===== B. matchRows ===== */
  const seats = [{ accountId: '7', nickname: '호스트' }, { accountId: '8', nickname: '게스트' }];
  const rowsOf = (result) => A.matchRows(ended(hex('a'), result), seats);
  let rows = rowsOf({ type: 'WIN', winner: 1, winType: 'resign' });
  ok(rows.length === 2 && rows[0].result === 'LOSS' && rows[1].result === 'WIN' && rows.every((r) => r.reason === 'resign')
    && rows[0].opponent_nickname === '게스트' && rows[1].opponent_nickname === '호스트' && rows[0].duration_ms >= 65000 && rows[0].turns === 3,
  'B1 기권: 패/승 · 사유 resign · 상대 닉네임 스냅샷 · 시간 · 턴');
  rows = rowsOf({ type: 'FORFEIT', winner: 0 });
  ok(rows[0].result === 'WIN' && rows[1].result === 'LOSS' && rows[0].reason === 'forfeit', 'B2 몰수 = 승/패 · forfeit');
  ok(rowsOf({ type: 'NO_CONTEST', winner: null }).every((r) => r.result === 'NO_CONTEST' && r.reason === 'both_disconnected')
    && rowsOf({ type: 'NO_CONTEST', winner: null, reason: 'E_INTERNAL' })[0].reason === 'server_error'
    && rowsOf({ type: 'NO_CONTEST', winner: null, reason: 'RESTART' })[0].reason === 'server_restart'
    && rowsOf({ type: 'WIN', winner: 0, winType: 'king' })[0].reason === 'king', 'B3 NO_CONTEST 사유(동시 만료·장애·재시작) · WIN 사유는 winType');
  ok(A.matchRows(ended(hex('b'), { type: 'WIN', winner: 0, winType: 'edge' }), [{ accountId: null }, seats[1]]).length === 1, 'B4 계정 없는 좌석은 행이 없다');

  /* ===== C. HTTP · WS · 저장 ===== */
  const pgUrl = process.env.DD_TEST_DATABASE_URL;
  const fx = pgUrl ? await pgFixture(pgUrl) : { store: memStore(), pool: null };
  const store = fx.store;
  console.log(`#260 profile — 저장소: ${pgUrl ? '실제 Postgres(pgStore · 001~005)' : '메모리 대역'}`);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;

  useAccounts(null);
  let r = await req('GET', '/api/profile');
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_DISABLED', 'C0 DB 없는 서버: /api/profile 503 E_ACCOUNTS_DISABLED');
  let c = await wsOpen('c-nodb1');
  let f = c.frames && await waitFor(c.frames, (x) => x.type === 'room_opened');
  ok(f && JSON.stringify(f.reps) === '[null,null]' && JSON.stringify(f.players) === '[null,null]', 'C0 DB 없는 서버: reps·players null');
  c.ws && c.ws.close();

  const accounts = A.createAccounts(store, null, null);
  useAccounts(accounts);
  r = await req('GET', '/api/profile');
  ok(r.status === 401 && r.json.error === 'E_NO_SESSION', 'C1 세션 없음 → 401');
  r = await post('/api/profile/representative', { minionId: 'M-W2' });
  ok(r.status === 401, 'C1 세션 없이 대표 변경 → 401');
  const alice = (await post('/api/auth/signup', { userId: 'alice_260', nickname: '앨리스', password: 'alice-pass-1', email: 'a@example.com' })).cookie;
  const bob = (await post('/api/auth/signup', { userId: 'bob_0260', nickname: '밥돌', password: 'bobby-pass-1', email: 'b@example.com' })).cookie;
  ok(!!alice && !!bob, 'C1 두 계정 가입');
  r = await req('GET', '/api/profile', { cookie: alice });
  ok(r.status === 200 && r.json.nickname === '앨리스' && r.json.representativeMinion === 'M-F1' && r.json.stats.wins === 0 && r.json.stats.losses === 0
    && Array.isArray(r.json.matches) && r.json.matches.length === 0 && r.json.pendingMatches === 0 && !('userId' in r.json) && !('email' in r.json),
  'C2 새 계정 프로필: 기본 대표 M-F1 · 0승 0패 · 아이디/이메일 비노출 ' + JSON.stringify(r.json));

  for (const bad of ['L-DRAGON', 'M-Z9', 'KING', '', 7, null, ['M-F2']]) {
    r = await post('/api/profile/representative', { minionId: bad }, { cookie: alice });
    ok(r.status === 400 && r.json.error === 'E_BAD_INPUT', 'C3 일반 30종 밖 거부 400: ' + JSON.stringify(bad));
  }
  r = await post('/api/profile/representative', { minionId: 'M-W2' }, { cookie: alice, origin: false });
  ok(r.status === 403 && r.json.error === 'E_BAD_ORIGIN', 'C3 Origin 없는 POST 403');
  r = await post('/api/profile/representative', { minionId: 'M-W2' }, { cookie: alice, type: 'text/plain' });
  ok(r.status === 415, 'C3 JSON 아닌 본문 415');
  r = await post('/api/profile/representative', { minionId: 'M-E6' }, { cookie: alice });
  ok(r.status === 200 && r.json.representativeMinion === 'M-E6', 'C3 아트 없는 땅 종(M-E6)도 일반 30종이라 허용');
  r = await post('/api/profile/representative', { minionId: 'M-W2' }, { cookie: alice });
  ok(r.status === 200 && r.json.representativeMinion === 'M-W2', 'C3 대표 변경 200');
  r = await req('GET', '/api/profile', { cookie: alice });
  ok(r.json.representativeMinion === 'M-W2', 'C3 변경이 프로필에 복원된다');

  // WS — 입장 때 고정 · 재접속 유지 · 공개 목록 비노출
  const host = await wsOpen('c-rep1', alice);
  const opened = await waitFor(host.frames, (x) => x.type === 'room_opened');
  ok(opened && JSON.stringify(opened.reps) === '["M-W2",null]' && JSON.stringify(opened.players) === '["앨리스",null]', 'C4 room_opened reps·players');
  const guest = await wsOpen('j-' + opened.inviteCode, bob);
  const joined = await waitFor(guest.frames, (x) => x.type === 'room_joined');
  const pushed = await waitFor(host.frames, (x) => x.type === 'room_state' && Array.isArray(x.reps) && x.reps[1]);
  ok(joined && JSON.stringify(joined.reps) === '["M-W2","M-F1"]' && pushed && JSON.stringify(pushed.reps) === '["M-W2","M-F1"]', 'C4 참가 프레임·상대 푸시에 두 대표');
  r = await post('/api/profile/representative', { minionId: 'M-G1' }, { cookie: alice });
  host.ws.close();
  await new Promise((res) => setTimeout(res, 100));
  const again = await wsOpen(`r-${opened.epoch}.${opened.seatToken}`, alice);
  const resumed = again.frames && await waitFor(again.frames, (x) => x.type === 'room_resumed');
  ok(r.status === 200 && resumed && JSON.stringify(resumed.reps) === '["M-W2","M-F1"]', 'C4 방 안에서 바꿔도 재접속한 좌석은 입장 때 값(M-W2) 유지');
  const lob = await wsOpen('l-list1');
  lob.ws.send(JSON.stringify({ v: 1, t: 'list_rooms', requestId: 'l1' }));
  const list = await waitFor(lob.frames, (x) => x.type === 'lobby_rooms');
  ok(list && !/앨리스|밥|M-W2|M-F1|reps|nickname|wins/.test(JSON.stringify(list)), 'C5 공개 목록에 닉네임·대표·전적 없음');
  lob.ws.close();

  // 결과 기록 — 서버 배선(attachNotifier → recordMatch → 저장소). 경제 방의 시작 상점을 WS 로 끝까지 돌리지 않고 보드 시작 상태로 옮긴다
  // (실제 엔진 경로의 훅은 A 가 증명한다).
  const room = lobby.getRoom(opened.roomId);
  room.state = STATES.IN_PROGRESS; room.matchId = hex('c'); room.startedAt = Date.now() - 42000;
  room._finalize(STATES.FINISHED, { type: 'WIN', winner: 1, winType: 'resign' }, { bump: false, notify: false });
  await new Promise((res) => setTimeout(res, 50));
  r = await req('GET', '/api/profile', { cookie: alice });
  const m0 = r.json.matches[0] || {};
  ok(r.json.stats.losses === 1 && r.json.stats.wins === 0 && r.json.matches.length === 1 && m0.result === 'LOSS' && m0.reason === 'resign'
    && m0.opponentNickname === '밥돌' && m0.durationMs >= 42000 && Number.isInteger(m0.turns) && !Number.isNaN(Date.parse(m0.endedAt)),
  'C6 서버 확정 결과 → 앨리스 1패 기록 ' + JSON.stringify(r.json));
  r = await req('GET', '/api/profile', { cookie: bob });
  ok(r.json.stats.wins === 1 && r.json.matches[0].result === 'WIN' && r.json.matches[0].opponentNickname === '앨리스', 'C6 밥돌 1승 · 상대 닉네임');
  const aliceId = room.seats[0].accountId;
  await accounts.recordMatch(ended(hex('c'), { type: 'WIN', winner: 1, winType: 'resign' }), room.seats);
  ok(room._finalize(STATES.FINISHED, { type: 'WIN', winner: 0, winType: 'king' }) === false, 'C7 확정된 결과는 다시 전이하지 않는다');
  r = await req('GET', '/api/profile', { cookie: alice });
  ok(r.status === 200 && r.json.matches.length === 1 && r.json.pendingMatches === 0 && accounts.pendingCount() === 0, 'C7 같은 경기 재기록은 한 번만 저장');
  r = await req('GET', '/api/profile/matches', { cookie: alice });
  ok(r.status === 404, 'C7 /api/profile/matches 경로는 없다(단일 GET /api/profile)');

  // DB 장애 — 결과를 잃지 않는다
  store.setDown(true);
  const errs = []; const origErr = console.error; console.error = (...a) => errs.push(a.join(' '));
  await accounts.recordMatch(ended(hex('d'), { type: 'FORFEIT', winner: 0 }), room.seats);
  r = await req('GET', '/api/profile', { cookie: alice });
  console.error = origErr;
  ok(accounts.pendingCount() === 1 && errs.some((x) => /기록 저장 실패/.test(x)) && !errs.some((x) => /10\.0\.0\.5/.test(x)), 'C8 DB 장애: 보류 1건 · 로그(원문 주소 없음)');
  ok(r.status === 503 && r.json.error === 'E_ACCOUNTS_UNAVAILABLE', 'C8 DB 장애 중 프로필 503');
  r = await post('/api/profile/representative', { minionId: 'M-F2' }, { cookie: alice });
  ok(r.status === 503, 'C8 DB 장애 중 대표 변경 503');
  store.setDown(false);
  r = await req('GET', '/api/profile', { cookie: alice });
  ok(r.json.pendingMatches === 1 && r.json.stats.wins === 0, 'C9 복구 직후: 저장 대기 1건이 프로필에 보인다');
  await accounts.flushPending();
  r = await req('GET', '/api/profile', { cookie: alice });
  ok(accounts.pendingCount() === 0 && r.json.pendingMatches === 0 && r.json.stats.wins === 1 && r.json.stats.losses === 1 && r.json.matches[0].reason === 'forfeit',
    'C9 재시도로 저장 · 1승 1패 ' + JSON.stringify(r.json.stats));
  errs.length = 0; console.error = (...a) => errs.push(a.join(' '));
  await accounts.recordMatch(ended(hex('e'), { type: 'WIN', winner: 0, winType: 'king' }), [{ accountId: '999999999', nickname: '유령' }, room.seats[1]]); // 없는 계정(FK 위반)
  await accounts.flushPending(); // 다시 시도해도 같은 거부 — 로그는 한 번만
  console.error = origErr;
  r = await req('GET', '/api/profile', { cookie: bob });
  ok(accounts.pendingCount() === 1 && errs.filter((x) => /제약 위반/.test(x)).length === 1 && r.json.pendingMatches === 1,
    'C9 제약 위반 결과도 버리지 않는다 — 아웃박스에 남아 밥돌 pendingMatches 1 · 로그 1회');

  // 최근 20 · 전체 보존
  const many = [];
  for (let i = 0; i < 25; i++) {
    many.push({ match_id: (i + 10).toString(16).padStart(32, '0'), account_id: aliceId, result: 'WIN', reason: 'king', opponent_nickname: '밥돌',
      turns: i, duration_ms: 1000, ended_at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString() });
  }
  await store.insertMatchRows(many);
  r = await req('GET', '/api/profile', { cookie: alice });
  const ms = r.json.matches;
  ok(ms.length === 20 && r.json.stats.wins === 26 && r.json.stats.losses === 1 && ms[0].reason === 'forfeit' && ms[1].result === 'LOSS'
    && ms.every((m, i) => i === 0 || Date.parse(ms[i - 1].endedAt) >= Date.parse(m.endedAt)), 'C10 화면 최근 20 · 승패는 전체 행(26승 1패) · 최신순');

  /* ===== D. 파일 아웃박스 — 완료된 결과의 유실 위험(상한·재시작·깨진 파일·쓰기 실패) ===== */
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const { createOutbox } = require('../resultOutbox');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dd260-outbox-'));
  const file = path.join(dir, 'sub', 'outbox.jsonl');
  const lines = (f) => fs.readFileSync(f || file, 'utf8').split('\n').filter(Boolean);
  const pair = [{ accountId: aliceId, nickname: '앨리스' }, { accountId: room.seats[1].accountId, nickname: '밥돌' }];
  const at = Date.UTC(2026, 5, 1, 12, 0, 0);
  const endedAt = (id, k) => ({ matchId: id, result: { type: 'WIN', winner: 0, winType: 'king' }, turns: 7, startedAt: at + k * 1000 - 90000, endedAt: at + k * 1000 });
  errs.length = 0; console.error = (...a) => errs.push(a.join(' '));
  store.setDown(true);
  const acc1 = A.createAccounts(store, null, null, createOutbox(file, 2));
  const p1 = acc1.recordMatch(endedAt(hex('f'), 0), pair);
  ok(lines().length === 1 && JSON.parse(lines()[0]).length === 2, 'D1 결과는 recordMatch 가 돌아오기 전에 파일에 있다(두 좌석 한 줄)');
  await p1;
  const beforeRemoval = fs.readFileSync(file); // DB 에 쓴 뒤 줄을 지우기 전에 죽은 경우를 흉내 낼 사본
  await acc1.recordMatch(endedAt(hex('1'), 1), pair);
  await acc1.recordMatch(endedAt(hex('2'), 2), pair);
  ok(acc1.pendingCount() === 3 && lines().length === 3 && acc1.resultsBlocked(), 'D2 상한(2) 초과: 하나도 버리지 않고(3건) 새 공식 경기 차단 신호');
  store.setDown(false);
  useAccounts(acc1);
  const blockedWs = await wsOpen('c-backlog1', alice);
  const bf = blockedWs.frames && await waitFor(blockedWs.frames, (x) => x.type === 'error');
  ok(bf && bf.code === 'E_RESULTS_BACKLOG', 'D2 미저장 결과가 상한 이상이면 새 방 생성 거부 E_RESULTS_BACKLOG');
  const acc2 = A.createAccounts(store, null, null, createOutbox(file, 2)); // 재시작 — 같은 파일에서 다시 읽는다
  useAccounts(acc2);
  r = await req('GET', '/api/profile', { cookie: alice });
  ok(acc2.pendingCount() === 3 && r.json.pendingMatches === 3 && r.json.stats.wins === 26, 'D3 재시작 뒤 미저장 3건 복원 · pendingMatches 정수 3');
  await acc2.flushPending();
  r = await req('GET', '/api/profile', { cookie: alice });
  const orig = r.json.matches.find((m) => m.endedAt === new Date(at).toISOString()) || {};
  ok(acc2.pendingCount() === 0 && lines().length === 0 && r.json.pendingMatches === 0 && r.json.stats.wins === 29 && !acc2.resultsBlocked()
    && orig.durationMs === 90000 && orig.turns === 7 && orig.result === 'WIN', 'D3 재생 저장 · 원래 종료 시각·시간·턴 유지 · 차단 해제 ' + JSON.stringify(orig));
  fs.writeFileSync(file, beforeRemoval);
  const acc3 = A.createAccounts(store, null, null, createOutbox(file, 2));
  await acc3.flushPending();
  r = await req('GET', '/api/profile', { cookie: alice });
  ok(acc3.pendingCount() === 0 && r.json.stats.wins === 29, 'D3 지우기 전 크래시로 같은 결과를 다시 재생해도 정확히 한 번(29승 그대로)');

  const good = JSON.stringify(A.matchRows(endedAt(hex('3'), 3), pair));
  const badLines = ['garbage{', '[{"match_id":"x"}]', '[{"match_id":"'];
  fs.writeFileSync(file, [good, ...badLines].join('\n')); // 마지막 줄 = 쓰다 만 줄(줄바꿈 없음)
  let ob = createOutbox(file, 2);
  ok(ob.size() === 1 && lines().length === 1 && lines(file + '.bad').join('|') === badLines.join('|'), 'D4 깨진·형식 밖 줄은 버리지 않고 .bad 에 원문 보존 · 좋은 줄만 재생');
  ob = createOutbox(file, 2);
  fs.writeFileSync(file, good); // 줄바꿈 없이 끝난 온전한 줄 뒤에 다음 기록이 붙지 않는다
  ob = createOutbox(file, 2);
  ob.add(A.matchRows(endedAt(hex('4'), 4), pair));
  ok(createOutbox(file, 2).size() === 2 && lines(file + '.bad').length === 3, 'D4 다시 읽어도 .bad 중복 없음 · 줄바꿈 없는 끝 줄 뒤 기록도 온전');

  const f2 = path.join(dir, 'sub', 'fail.jsonl'); // 비공개 폴더 안 — mkdtemp 폴더는 Windows 에서 상위(Temp) ACL 을 상속해 넓을 수 있다
  ob = createOutbox(f2, 200);
  fs.rmSync(f2); fs.mkdirSync(f2); // 파일 자리에 폴더 — 이후 쓰기가 실패한다
  ob.add(A.matchRows(endedAt(hex('5'), 5), pair));
  ok(ob.size() === 1 && ob.blocked(), 'D5 파일 쓰기 실패: 결과는 메모리에 남고 새 공식 경기 차단');
  fs.rmdirSync(f2);
  ob.persist();
  ok(!ob.blocked() && lines(f2).length === 1, 'D5 복구 뒤 전체 재작성으로 파일에 기록 · 차단 해제');
  let threw = false;
  try { createOutbox(path.join(f2, 'x.jsonl'), 200); } catch (e) { threw = true; }
  ok(threw, 'D5 열 수 없는 경로는 기동 실패(fail-closed)');

  // D7~D9 보관소 권한 — 실제 OS 권한(Windows ACL · POSIX 모드)을 읽는다
  const cp = require('child_process');
  const win = process.platform === 'win32';
  const perm = (p) => win ? cp.execFileSync('icacls', [p], { encoding: 'utf8' }).split('\n').slice(0, -2).join('\n') : (fs.statSync(p).mode & 0o777).toString(8);
  const aclOf = (p) => cp.execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$a=Get-Acl -LiteralPath $env:P; [string]$a.AreAccessRulesProtected + '|' + ((@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | % { $_.IdentityReference.Value })) -join ',')"],
  { env: Object.assign({}, process.env, { P: p }), encoding: 'utf8' }).trim();
  const me = win && cp.execFileSync('powershell.exe', ['-NoProfile', '-Command', '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], { encoding: 'utf8' }).trim();
  const f3 = path.join(dir, 'new', 'deep', 'outbox.jsonl'); // 사용자 지정 경로처럼 없는 폴더
  ob = createOutbox(f3, 200);
  ob.add(A.matchRows(endedAt(hex('6'), 6), pair));
  const d3 = path.dirname(f3);
  ok(win ? aclOf(d3) === `True|${me}` && aclOf(f3) === `False|${me}` : perm(d3) === '700' && perm(f3) === '600',
    'D7 새 보관 폴더·파일은 현재 사용자 전용 ' + (win ? aclOf(d3) + ' / ' + aclOf(f3) : perm(d3) + '/' + perm(f3)));
  ok(createOutbox(f3, 200).size() === 1, 'D7 이미 있는 비공개 보관소는 다시 열고 재생');
  const insecureOpen = (p, why) => {
    const snap = () => perm(p) + perm(path.dirname(p)) + fs.readFileSync(p, 'utf8');
    const before = snap();
    let c = null;
    try { createOutbox(p, 200); } catch (e) { c = e.code; }
    ok(c === 'E_OUTBOX_INSECURE' && snap() === before
      && !fs.existsSync(p + '.bad') && !fs.existsSync(p + '.tmp'), why + ' → 기동 거부 · 데이터·권한 무변경 ' + c);
  };
  const f4 = path.join(dir, 'open', 'outbox.jsonl');
  fs.mkdirSync(path.dirname(f4)); fs.writeFileSync(f4, good + '\n');
  if (win) cp.execFileSync('icacls', [path.dirname(f4), '/grant', '*S-1-5-11:(OI)(CI)M']); else fs.chmodSync(path.dirname(f4), 0o755);
  insecureOpen(f4, 'D8 이미 있는 넓은 폴더(' + (win ? 'Authenticated Users Modify' : '0755') + ')');
  const f5 = path.join(d3, 'shared.jsonl'); // 비공개 폴더 안의 넓은 파일
  fs.writeFileSync(f5, good + '\n');
  if (win) cp.execFileSync('icacls', [f5, '/grant', '*S-1-5-11:R']); else fs.chmodSync(f5, 0o644);
  insecureOpen(f5, 'D9 이미 있는 넓은 파일');
  console.error = origErr;
  ok(!errs.some((x) => x.includes(dir) || /account_id|10\.0\.0\.5/.test(x)), 'D6 로그에 경로·계정 id·DB 원문 없음');
  fs.rmSync(dir, { recursive: true, force: true });

  for (const x of [guest, again, blockedWs]) try { x.ws.close(); } catch (e) { /* noop */ }
  server.close();
  if (fx.pool) await fx.pool.end();
  console.log(`#260 profile: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
