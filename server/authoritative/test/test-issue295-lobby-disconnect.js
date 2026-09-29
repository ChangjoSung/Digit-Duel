'use strict';
// #295 (2026-09-29 CJ) 공개 대기방 참가자 단절 — 30초 방장 내보내기 · 60초 자동 비움(방 OPEN 유지) · 결과 불변 · 경기 중 유예 그대로 ·
// 상대 실측 왕복(peerPingMs·peer_ping)은 표시 전용. 운영 30/60초를 KICK/GRACE ms 로 줄여 주입한다.
const { makeCounter, fakeWs, makeSetup, Room, STATES } = require('./helpers');
const { ok, done } = makeCounter('test-issue295-lobby-disconnect');

const KICK = 150, GRACE = 300, CD = 30;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cmd = (room, seat, t) => room.handleCommand(seat, { t, round: room.round });
function gateRoom(id) {
  const room = new Room(id, { isPublic: true, epoch: 'aaaaaaaa', graceMs: GRACE, kickMs: KICK, startGate: true, countdownMs: CD });
  room.openHostSeat(fakeWs());
  room.joinGuestSeat(fakeWs());
  room.records = []; room.pushes = 0;
  room.onResult = (e) => room.records.push(e);
  room.onUpdate = () => { room.pushes++; };
  return room;
}
async function startRound(room) {
  cmd(room, 1, 'lobby_ready'); cmd(room, 0, 'lobby_start');
  await wait(CD + 30);
  if (room.state !== STATES.SETUP) throw new Error('round did not start');
}
async function finished(id) {
  const room = gateRoom(id);
  await startRound(room);
  room._handleSetup(0, makeSetup()); room._handleSetup(1, makeSetup());
  room._handleReady(0, true); room._handleReady(1, true);
  cmd(room, room.engines[0].S.current, 'resign');
  if (room.state !== STATES.FINISHED) throw new Error('did not finish');
  return room;
}
const lobbyOf = (room) => room.toSeatView(0).lobby;

(async () => {
  // 1) WAITING — 이른·참가자·재접속 뒤 내보내기 거부, 재단절은 시계를 다시 센다
  const a = gateRoom(1);
  ok(lobbyOf(a).kickInMs === null && lobbyOf(a).canKick === false, '연결 중 — kickInMs null · canKick false');
  a.socketClosed(1);
  const l1 = lobbyOf(a);
  ok(l1.kickInMs > 0 && l1.kickInMs <= KICK && l1.canKick === false && a.toSeatView(1).lobby.kickInMs === null, '단절 직후 방장에게만 남은 시간');
  ok(cmd(a, 0, 'lobby_kick').reason === 'E_ILLEGAL_ACTION', '30초 전 내보내기 거부');
  ok(cmd(a, 1, 'lobby_kick').reason === 'E_NOT_OWNER', '참가자 내보내기 거부');
  await wait(KICK / 2);
  ok(a.resumeSeat(1, a.seats[1].credential.current, fakeWs()).ok, '30초 전 재접속');
  await wait(KICK / 2 + 30);
  ok(cmd(a, 0, 'lobby_kick').reason === 'E_ILLEGAL_ACTION' && lobbyOf(a).kickInMs === null && a.pushes === 0, '재접속하면 자격 소멸 · 30초 푸시 없음');
  a.socketClosed(1);
  await wait(KICK / 2);
  ok(cmd(a, 0, 'lobby_kick').reason === 'E_ILLEGAL_ACTION', '재단절 — 시계를 처음부터 다시 센다');

  // 2) 30초 경계 — 허용 순간 정확히 한 번 푸시 → 내보내기 → OPEN · 옛 토큰 무효 · 새 참가자 · 결과 없음
  await wait(KICK / 2 + 30);
  ok(a.pushes === 1 && lobbyOf(a).canKick === true && lobbyOf(a).kickInMs === 0, '30초 — 허용 푸시 1회 · canKick');
  const oldTok = a.seats[1].credential.current, rev = a.revision;
  const k = cmd(a, 0, 'lobby_kick');
  ok(k.ok && k.data.state === 'OPEN' && a.state === STATES.OPEN && !a.seats[1].credential && a.revision > rev && a.isListable(), '내보내기 → 좌석 비움 · 방 OPEN 유지');
  ok(a.resumeSeat(1, oldTok, fakeWs()).reason === 'E_SEAT_TOKEN_INVALID', '옛 참가자 토큰 재개 거부');
  ok(a.joinGuestSeat(fakeWs()).ok && a.state === STATES.WAITING, '새 참가자(또는 같은 사람의 새 좌석) 입장');
  ok(a.records.length === 0 && a.result === null, '내보내기는 결과·기록을 만들지 않는다');

  // 3) 60초 — 내보내기 없이 자동 비움, 취소하지 않는다
  const b = gateRoom(2);
  b.socketClosed(1);
  await wait(GRACE + 40);
  ok(b.state === STATES.OPEN && !b.seats[1].credential && b.pushes === 2 && b.records.length === 0, '60초 자동 비움 → OPEN(취소 아님) · 30초·60초 푸시');
  ok(cmd(b, 0, 'lobby_kick').reason === 'E_ILLEGAL_ACTION', '빈 좌석 내보내기 거부');

  // 4) FINISHED + 방장 복귀 — 30초 내보내기 · 60초 자동 비움, 지난 결과 불변
  const c = await finished(3);
  const rec = JSON.stringify(c.records);
  cmd(c, 0, 'lobby_return');
  c.socketClosed(1);
  ok(cmd(c, 0, 'lobby_kick').reason === 'E_ILLEGAL_ACTION' && lobbyOf(c).kickInMs > 0, '결과 뒤 — 30초 전 거부');
  await wait(KICK + 30);
  ok(cmd(c, 0, 'lobby_kick').ok && c.state === STATES.OPEN && c.records.length === 1 && JSON.stringify(c.records) === rec, '결과 뒤 30초 내보내기 → OPEN · 지난 결과 1건 그대로');
  const d = await finished(4);
  d.socketClosed(1); // 방장 복귀 전 단절 — 복귀 순간부터 센다
  cmd(d, 0, 'lobby_return');
  await wait(GRACE + 40);
  ok(d.state === STATES.OPEN && !d.seats[1].credential && d.records.length === 1, '결과 뒤 60초 자동 비움 → OPEN · 기록 1건');
  const e = await finished(5);
  e.socketClosed(1);
  ok(cmd(e, 0, 'lobby_kick').reason === 'E_ILLEGAL_ACTION' && e.toSeatView(0).lobby === undefined, '방장이 결과 화면이면 해당 없음');

  // 5) 경기 전·중 유예와 방장 단절은 그대로
  const f = gateRoom(6); await startRound(f);
  f.socketClosed(1);
  await wait(GRACE + 40);
  ok(f.state === STATES.CANCELED, 'SETUP 참가자 60초 → 취소(종전)');
  const g = gateRoom(7); await startRound(g);
  g._handleSetup(0, makeSetup()); g._handleSetup(1, makeSetup()); g._handleReady(0, true); g._handleReady(1, true);
  g.socketClosed(1);
  await wait(KICK + 30);
  ok(g.state === STATES.IN_PROGRESS && cmd(g, 0, 'lobby_kick').reason === 'E_ILLEGAL_ACTION', '경기 중 30초 — 내보내기 없음');
  await wait(GRACE - KICK + 40);
  ok(g.state === STATES.FINISHED && g.result.type === 'FORFEIT' && g.result.winner === 0 && g.records.length === 1, '경기 중 60초 → 몰수(종전)');
  const h = gateRoom(8);
  h.socketClosed(0);
  await wait(GRACE + 40);
  ok(h.state === STATES.CANCELED, '대기방 방장 60초 → 취소(종전)');

  // 6) 실제 서버 — 단절 푸시 · 허용 푸시 · WS 내보내기 · 옛 토큰 · 새 참가 · peerPingMs/peer_ping
  const WebSocket = require('ws');
  const { server, lobby, heartbeatTick } = require('../server');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const conn = (cred) => new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/`, ['digit-duel.v1', cred]); const frames = [];
    ws.on('message', (m) => frames.push(JSON.parse(m))); ws.on('open', () => res({ ws, frames }));
  });
  const until = async (x, pred, from = 0, ms = 3000) => {
    for (const end = Date.now() + ms; Date.now() < end; await wait(10)) { const fr = x.frames.slice(from).find(pred); if (fr) return fr; }
    return null;
  };
  const send = (x, first, o) => x.ws.send(JSON.stringify(Object.assign({ v: 1, seatToken: first.seatToken, tokenGen: first.tokenGen }, o)));
  const H = await conn('cp-lobby295'); const Ho = await until(H, (fr) => fr.type === 'room_opened');
  const R = lobby.getRoom(Ho.roomId); R.graceMs = GRACE; R.kickMs = KICK;
  const G = await conn('p-' + Ho.roomId); const Go = await until(G, (fr) => fr.type === 'room_joined');
  ok(Ho.peerPingMs === null && Go.peerPingMs === null, '첫 프레임 peerPingMs — 아직 재지 않음 null');
  heartbeatTick();
  const pp = await until(H, (fr) => fr.type === 'peer_ping');
  ok(pp && Number.isInteger(pp.ms) && pp.ms >= 0 && pp.seq === undefined, 'peer_ping {ms} — 짝 맞은 pong 뒤 상대에게');
  let n = H.frames.length;
  G.ws.close();
  const dc = await until(H, (fr) => fr.type === 'room_state' && fr.peerConnected === false, n);
  ok(dc && dc.peerPingMs === null && dc.data.lobby.canKick === false && dc.data.lobby.kickInMs > 0, 'WS 단절 푸시 — 남은 시간 · peerPingMs null');
  send(H, Ho, { requestId: 'k1', t: 'lobby_kick', round: 0 });
  ok((await until(H, (fr) => fr.requestId === 'k1')).code === 'E_ILLEGAL_ACTION', 'WS 30초 전 내보내기 거부');
  ok(await until(H, (fr) => fr.type === 'room_state' && fr.data.lobby && fr.data.lobby.canKick === true, n), 'WS 30초 허용 푸시');
  send(H, Ho, { requestId: 'k2', t: 'lobby_kick', round: 0 });
  const kr = await until(H, (fr) => fr.requestId === 'k2');
  ok(kr && kr.type === 'room_state' && kr.data.state === 'OPEN' && R.state === STATES.OPEN, 'WS 내보내기 → OPEN');
  const Old = await conn('r-' + Go.epoch + '.' + Go.seatToken);
  ok((await until(Old, (fr) => fr.type === 'error')).code === 'E_SEAT_TOKEN_INVALID', 'WS 옛 토큰 재개 거부');
  const G2 = await conn('p-' + Ho.roomId);
  ok(await until(G2, (fr) => fr.type === 'room_joined') && R.state === STATES.WAITING, 'WS 새 참가 → WAITING');
  H.ws.close(); G2.ws.close(); Old.ws.close(); server.close();

  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
