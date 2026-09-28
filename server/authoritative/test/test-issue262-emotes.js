'use strict';
// #262 경기 중 이모티콘 — 서버 경계.
//   A. 허용 ID·봉투 · Room.emote 판정(단위)
//   B. 실제 서버에 독립 클라이언트: 양쪽 전달·필드 · 틀린 ID · 연타 · 토큰 펜싱 · 상대 단절/재접속 · 쿨다운 유지 ·
//      시작 상점(SETUP)·경기 중 양쪽 차례(IN_PROGRESS)·결과(FINISHED) · 게임 상태/revision/seq/시계/중복 제거 불변.
const WebSocket = require('ws');
process.env.DD_AUTH_MAX_CONNECTIONS_PER_IP = '32';
const { validateEnvelope, EMOTE_IDS, isEmoteId } = require('../protocol');
const { server, lobby } = require('../server');
const { STATES } = require('../room');
const H = require('./helpers');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ===== A. 단위 ===== */
ok(EMOTE_IDS.join() === 'hello,nice,wow,think,oops,gg' && Object.isFrozen(EMOTE_IDS), 'A1 허용 ID 6종(CJ 승인 순서)');
for (const bad of ['HELLO', 'hello ', '', 'toString', '__proto__', 7, null, undefined, {}, ['hello']]) ok(!isEmoteId(bad), 'A1 허용 밖: ' + JSON.stringify(bad));
const env = (o) => validateEnvelope(JSON.stringify(Object.assign({ v: 1, t: 'emote', requestId: 'r1', seatToken: 't', tokenGen: 0, id: 'hello' }, o)));
ok(env({}).ok && env({ id: 7 }).ok, 'A2 봉투는 좌석 공통 필드만 본다(id 는 전용 응답에서 거부)');
ok(!env({ requestId: '' }).ok && !env({ seatToken: 1 }).ok && !env({ tokenGen: -1 }).ok, 'A2 좌석 공통 필드 누락은 봉투 거부');
{
  const r = H.setupRoom(1);
  ok(r.emote(0).ok && !r.emote(0).ok, 'A3 SETUP 성공 뒤 즉시 재전송은 거부');
  r.seats[1].ws.readyState = 3; // 연결 표시는 남았지만 소켓이 닫히는 중
  ok(r.emote(0).reason === 'E_PAUSED' && !r.peerConnected(0) && r.peerConnected(1) === true, 'A3 상대 소켓이 OPEN 이 아니면 E_PAUSED');
  for (const end of ['voidForRestart', 'close']) {
    const v = H.setupRoom(2);
    v[end]();
    ok(v.emote(0).reason === 'E_ILLEGAL_ACTION', 'A4 끝난 방 거부: ' + v.state);
  }
  const c = H.setupRoom(3); c.explicitLeave(0);
  ok(c.state === STATES.CANCELED && c.emote(1).reason === 'E_ILLEGAL_ACTION', 'A4 CANCELED 거부');
}

/* ===== B. 실제 서버 ===== */
let PORT, n = 0;
function open(cred) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/`, ['digit-duel.v1', cred]);
  const frames = [];
  ws.on('message', (d) => frames.push(JSON.parse(d.toString())));
  ws.on('error', () => {});
  return { ws, frames };
}
async function waitFor(c, pred, ms = 3000) {
  const end = Date.now() + ms;
  for (;;) {
    const f = c.frames.find(pred);
    if (f) return f;
    if (Date.now() > end) return null;
    await sleep(10);
  }
}
const first = (c) => waitFor(c, (f) => /^(room_opened|room_joined|room_resumed|error)$/.test(f.type));
const send = (c, o) => { try { c.ws.send(JSON.stringify(Object.assign({ v: 1 }, o))); } catch (e) { /* 닫힌 소켓 */ } };
const cmd = (c, me, t, extra) => send(c, Object.assign({ t, requestId: 'c' + (++n), seatToken: me.seatToken, tokenGen: me.tokenGen }, extra));
function emote(c, me, id, extra) {
  const requestId = 'e' + (++n);
  send(c, Object.assign({ t: 'emote', requestId, seatToken: me.seatToken, tokenGen: me.tokenGen, id }, extra));
  return requestId;
}
const reply = (c, rid) => waitFor(c, (f) => (f.type === 'emote' || f.type === 'emote_result') && f.requestId === rid);
const emotesOf = (c) => c.frames.filter((f) => f.type === 'emote' && !('requestId' in f));
const keys = (f) => Object.keys(f || {}).sort().join();
// 이모티콘이 건드리면 안 되는 것 전부 — revision·상태·좌석 seq·중복 제거 캐시·게임 시계·두 좌석 엔진 상태.
function frozen(room) {
  const clk = (c) => c && { key: c.key, left: c.left, deadline: c.deadline, expired: c.expired, owner: c.owner };
  return JSON.stringify({ rev: room.revision, state: room.state, seq: room.seats.map((s) => s.seq), dedup: room.dedup.size,
    clock: room._clock.map(clk), act: clk(room._act), pick: clk(room._pick), battle: clk(room._bclock) }) + H.snap(room);
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;

  /* --- OPEN: 상대 없음 --- */
  const h = open('c-emote1');
  const hOpen = await first(h);
  ok(hOpen && hOpen.type === 'room_opened' && hOpen.peerConnected === false, 'B1 room_opened peerConnected=false');
  const room = lobby.getRoom(hOpen.roomId);
  let rid = emote(h, hOpen, 'hello');
  let f = await reply(h, rid);
  ok(f && f.type === 'emote_result' && f.ok === false && f.code === 'E_ILLEGAL_ACTION' && !('seq' in f) && room.seats[0].emoteAt === 0, 'B1 OPEN 대기 방 거부·쿨다운 미소모: ' + JSON.stringify(f));

  /* --- SETUP(시작 상점) --- */
  const g = open('j-' + hOpen.inviteCode);
  const gJoin = await first(g);
  ok(gJoin && gJoin.type === 'room_joined' && gJoin.peerConnected === true, 'B2 room_joined peerConnected=true');
  ok(await waitFor(h, (x) => x.type === 'room_state' && x.peerConnected === true), 'B2 호스트 푸시 peerConnected=true');
  ok(room.state === STATES.SETUP && room.engines && room.toSeatView(0).phase === 'shop', 'B2 경제 방 시작 상점');
  let before = frozen(room);
  rid = emote(h, hOpen, 'hello');
  f = await reply(h, rid);
  const peer = await waitFor(g, (x) => x.type === 'emote');
  ok(f && keys(f) === 'cooldownMs,epoch,from,id,requestId,roomId,type,v' && f.id === 'hello' && f.from === 0 && f.cooldownMs === 5000 && f.roomId === hOpen.roomId && f.epoch === hOpen.epoch, 'B3 보낸 쪽 사본: ' + JSON.stringify(f));
  ok(peer && keys(peer) === 'epoch,from,id,roomId,type,v' && peer.id === 'hello' && peer.from === 0, 'B3 상대 사본(requestId·seq 없음): ' + JSON.stringify(peer));
  rid = emote(g, gJoin, 'nice');
  f = await reply(g, rid);
  ok(f && f.type === 'emote' && f.from === 1 && (await waitFor(h, (x) => x.type === 'emote' && x.from === 1)), 'B3 좌석별 쿨다운 — 상대 차례와 무관하게 양쪽 전송');
  ok(frozen(room) === before, 'B3 게임 상태·revision·seq·시계·중복 제거 불변');

  // 연타 — 전부 E_RATE_LIMITED, 거부가 쿨다운을 다시 세우지 않는다.
  const at0 = room.seats[0].emoteAt;
  const rids = [];
  for (let i = 0; i < 10; i++) rids.push(emote(h, hOpen, EMOTE_IDS[i % 6]));
  const spam = [];
  for (const r of rids) spam.push(await reply(h, r));
  ok(spam.every((x) => x && x.type === 'emote_result' && x.code === 'E_RATE_LIMITED' && Number.isInteger(x.retryMs) && x.retryMs > 0 && x.retryMs <= 5000), 'B4 연타 거부 + retryMs');
  ok(room.seats[0].emoteAt === at0 && emotesOf(g).length === 1, 'B4 거부는 쿨다운 미갱신·상대 미전달');

  // 틀린 ID — 되돌려 보내지 않고, 쿨다운을 쓰지 않는다.
  room.seats[0].emoteAt = 0;
  const long = 'Z'.repeat(4000);
  for (const bad of ['HELLO', 'hello ', '', 7, null, {}, ['hello'], '__proto__', long, undefined]) {
    rid = emote(h, hOpen, bad);
    f = await reply(h, rid);
    ok(f && f.type === 'emote_result' && f.code === 'E_BAD_ENVELOPE' && keys(f) === 'code,ok,requestId,type,v', 'B5 틀린 ID 거부(값 미반환): ' + JSON.stringify(bad));
  }
  ok(!h.frames.some((x) => JSON.stringify(x).includes('HELLO') || JSON.stringify(x).includes('ZZZZ')), 'B5 틀린 ID 원문이 어떤 프레임에도 없다');
  ok(room.seats[0].emoteAt === 0 && emotesOf(g).length === 1, 'B5 쿨다운 미소모·상대 미전달');

  // 토큰 펜싱 — 전용 응답, seq 미변경.
  const seq0 = room.seats[0].seq;
  rid = emote(h, hOpen, 'wow', { seatToken: 'A'.repeat(43) });
  f = await reply(h, rid);
  ok(f && f.type === 'emote_result' && f.code === 'E_SEAT_TOKEN_INVALID', 'B6 위조 토큰: ' + JSON.stringify(f));
  rid = emote(h, hOpen, 'wow', { tokenGen: hOpen.tokenGen + 1 });
  f = await reply(h, rid);
  ok(f && f.type === 'emote_result' && f.code === 'E_TOKEN_GEN_STALE', 'B6 지난 tokenGen: ' + JSON.stringify(f));
  ok(room.seats[0].seq === seq0 && room.seats[0].emoteAt === 0 && emotesOf(g).length === 1, 'B6 seq·쿨다운 불변·상대 미전달');
  send(h, { t: 'emote', id: 'wow', seatToken: hOpen.seatToken, tokenGen: hOpen.tokenGen }); // requestId 없음 — 기존 봉투 오류 경로
  ok(await waitFor(h, (x) => x.type === 'error' && x.code === 'E_BAD_ENVELOPE'), 'B6 봉투 불량은 기존 error 경로');

  // 상대 단절 → E_PAUSED, 재접속 → 쿨다운 유지·전송 재개.
  room.seats[1].emoteAt = 0;
  rid = emote(g, gJoin, 'think');
  f = await reply(g, rid);
  ok(f && f.type === 'emote', 'B7 단절 직전 게스트 전송');
  const gAt = room.seats[1].emoteAt;
  h.frames.length = 0;
  g.ws.close();
  ok(await waitFor(h, (x) => x.type === 'room_state' && x.peerConnected === false && Array.isArray(x.data.pause)), 'B7 호스트 푸시 peerConnected=false');
  before = frozen(room);
  rid = emote(h, hOpen, 'oops');
  f = await reply(h, rid);
  ok(f && f.code === 'E_PAUSED' && room.seats[0].emoteAt === 0 && frozen(room) === before, 'B7 상대 단절 중 E_PAUSED·쿨다운 미소모: ' + JSON.stringify(f));
  const gr = open(`r-${gJoin.epoch}.${gJoin.seatToken}`);
  const gRes = await first(gr);
  ok(gRes && gRes.type === 'room_resumed' && gRes.peerConnected === true && room.seats[1].emoteAt === gAt, 'B8 재접속 — 좌석 쿨다운 보존');
  ok(Number.isInteger(gRes.emoteRetryMs) && gRes.emoteRetryMs > 0 && gRes.emoteRetryMs <= 5000, 'B8 room_resumed emoteRetryMs: ' + (gRes && gRes.emoteRetryMs));
  ok(await waitFor(h, (x) => x.type === 'room_state' && x.peerConnected === true), 'B8 호스트 푸시 peerConnected=true');
  rid = emote(gr, gRes, 'gg');
  f = await reply(gr, rid);
  ok(f && f.code === 'E_RATE_LIMITED', 'B8 재접속으로 쿨다운이 풀리지 않는다');
  rid = emote(h, hOpen, 'oops');
  f = await reply(h, rid);
  ok(f && f.type === 'emote' && (await waitFor(gr, (x) => x.type === 'emote' && x.id === 'oops')), 'B8 복귀 후 호스트 전송 재개');

  // 밀려난 소켓 — 새 재접속이 좌석을 가져가면 옛 소켓의 이모티콘은 아무 데도 가지 않는다.
  const gr2 = open(`r-${gRes.epoch}.${gRes.seatToken}`);
  const gRes2 = await first(gr2);
  ok(gRes2 && gRes2.type === 'room_resumed', 'B9 두 번째 재접속');
  room.seats[1].emoteAt = 0;
  const hEmotes = h.frames.filter((x) => x.type === 'emote').length;
  rid = emote(gr, gRes, 'wow');
  await sleep(200);
  ok(!gr.frames.some((x) => x.requestId === rid) && h.frames.filter((x) => x.type === 'emote').length === hEmotes && room.seats[1].emoteAt === 0, 'B9 밀려난 소켓 전송 무시');

  /* --- IN_PROGRESS 양쪽 차례 · FINISHED --- */
  lobby.economy = false; // 무료 로스터 경기로 실제 명령 경로를 따라 시작한다(경제 방 경기 진행은 기존 테스트가 맡는다)
  const h2 = open('c-emote2');
  const h2o = await first(h2);
  const g2 = open('j-' + h2o.inviteCode);
  const g2o = await first(g2);
  const room2 = lobby.getRoom(h2o.roomId);
  const setup = H.makeSetup();
  cmd(h2, h2o, 'setup', setup); cmd(g2, g2o, 'setup', setup);
  cmd(h2, h2o, 'ready'); cmd(g2, g2o, 'ready');
  for (let i = 0; i < 100 && room2.state !== STATES.IN_PROGRESS; i++) await sleep(20);
  ok(room2.state === STATES.IN_PROGRESS, 'B10 경기 시작');
  const cur = room2.engine.S.current;
  before = frozen(room2);
  const pair = [[h2, h2o], [g2, g2o]];
  for (const s of [cur, 1 - cur]) {
    const [c, me] = pair[s];
    rid = emote(c, me, 'think');
    f = await reply(c, rid);
    ok(f && f.type === 'emote' && f.from === s && (await waitFor(pair[1 - s][0], (x) => x.type === 'emote' && x.from === s)), 'B10 경기 중 ' + (s === cur ? '내 차례' : '상대 차례') + ' 전송');
  }
  ok(frozen(room2) === before, 'B10 경기 중 게임 상태·revision·seq·시계·중복 제거 불변');
  cmd(pair[cur][0], pair[cur][1], 'resign'); // 무료 로스터 경기의 기권은 차례인 좌석만 한다
  for (let i = 0; i < 100 && room2.state !== STATES.FINISHED; i++) await sleep(20);
  ok(room2.state === STATES.FINISHED, 'B11 기권 → 결과');
  room2.seats[1].emoteAt = 0;
  const rev = room2.revision;
  rid = emote(g2, g2o, 'gg');
  f = await reply(g2, rid);
  ok(f && f.type === 'emote' && room2.revision === rev, 'B11 결과 화면 — 둘 다 연결이면 전송');
  h2.frames.length = 0;
  cmd(g2, g2o, 'leave');
  ok(await waitFor(h2, (x) => x.type === 'room_state' && x.peerConnected === false), 'B11 상대 퇴장 푸시 peerConnected=false');
  room2.seats[0].emoteAt = 0;
  rid = emote(h2, h2o, 'gg');
  f = await reply(h2, rid);
  ok(f && f.code === 'E_PAUSED' && room2.seats[0].emoteAt === 0, 'B11 상대가 나간 결과 화면 E_PAUSED');

  /* --- 로비 전용 소켓은 무시 --- */
  const lob = open('l-emote');
  await waitFor(lob, (x) => x.type === 'lobby_ready');
  send(lob, { t: 'emote', requestId: 'x', seatToken: 't', tokenGen: 0, id: 'hello' });
  await sleep(150);
  ok(lob.frames.length === 1, 'B12 로비 소켓 이모티콘 무응답');

  for (const x of [h, gr, gr2, h2, g2, lob]) x.ws.close();
  console.log(`#262 emotes: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
