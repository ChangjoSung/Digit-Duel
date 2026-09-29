'use strict';
// #295 (2026-09-30 CJ QA REVISE) 공개 대기방·결과 화면 — 방장 즉시 내보내기(연결·단절 무관, 30초 대기 없음) · 빈 좌석 E_NO_GUEST ·
// 참가자 단절 60초 자동 비움(방 OPEN 유지) · 방장 전송 단절 = 즉시 무효화 + 살아 있는 참가자 승격(없으면 방 닫힘) ·
// 결과·기록 불변 · 경기 중 60초 유예/몰수 그대로 · selfPingMs/self_ping + peerPingMs/peer_ping. 운영 60초는 GRACE ms 로 줄인다.
const { makeCounter, fakeWs, makeSetup, Room, STATES } = require('./helpers');
const { ok, done } = makeCounter('test-issue295-lobby-disconnect');

const GRACE = 200, CD = 30;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cmd = (room, seat, t) => room.handleCommand(seat, { t, round: room.round });
function gateRoom(id) {
  const room = new Room(id, { isPublic: true, epoch: 'aaaaaaaa', graceMs: GRACE, startGate: true, countdownMs: CD });
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
const resume = (room, seat, tok) => room.resumeSeat(seat, tok, fakeWs());

(async () => {
  // 1) WAITING — 연결 중 참가자도 즉시 · 참가자는 불가 · 결과/기록 없음 · 옛 토큰 무효
  const a = gateRoom(1);
  ok(lobbyOf(a).canKick === true && a.toSeatView(1).lobby.canKick === false, '방장만 canKick (연결 중에도)');
  ok(cmd(a, 1, 'lobby_kick').reason === 'E_NOT_OWNER', '참가자 내보내기 거부');
  const oldTok = a.seats[1].credential.current, oldWs = a.seats[1].ws, rev = a.revision;
  const k = cmd(a, 0, 'lobby_kick');
  ok(k.ok && k.data.state === 'OPEN' && a.state === STATES.OPEN && !a.seats[1].credential && a.revision > rev && a.isListable(), '연결 중 참가자 즉시 내보내기 → OPEN 유지');
  ok(k.kicked && k.kicked.phase === 'closed' && k.kicked.seat === 1 && oldWs.closed === null, '내보낸 참가자용 닫힘 뷰(소켓 종료는 server.js)');
  ok(resume(a, 1, oldTok).reason === 'E_SEAT_TOKEN_INVALID' && a.records.length === 0 && a.result === null, '옛 토큰 재개 거부 · 결과·기록 없음');
  const r0 = a.revision;
  ok(cmd(a, 0, 'lobby_kick').reason === 'E_NO_GUEST' && a.revision === r0 && a.state === STATES.OPEN, '빈 좌석 E_NO_GUEST · 무변경');
  ok(a.joinGuestSeat(fakeWs()).ok && a.state === STATES.WAITING, '새 참가자 입장');

  // 2) 단절 참가자 — 대기 없이 즉시 · 내보내지 않으면 60초 자동 비움(OPEN · 기록 없음)
  a.socketClosed(1);
  ok(cmd(a, 0, 'lobby_kick').ok && a.state === STATES.OPEN && a.pushes === 0, '단절 직후 즉시 내보내기');
  const b = gateRoom(2);
  b.socketClosed(1);
  await wait(GRACE / 2);
  ok(b.seats[1].credential && b.state === STATES.WAITING, '60초 전 좌석 유지');
  await wait(GRACE / 2 + 40);
  ok(b.state === STATES.OPEN && !b.seats[1].credential && b.pushes === 1 && b.records.length === 0, '60초 자동 비움 → OPEN(취소 아님) · 푸시 1회');

  // 3) FINISHED — 결과 화면에서도 즉시 내보내기(복귀 전·후), 지난 결과·기록 불변
  const c = await finished(3);
  const rec = JSON.stringify(c.records), res = JSON.stringify(c.result);
  ok(cmd(c, 1, 'lobby_kick').reason === 'E_NOT_OWNER', '결과 화면 — 참가자 내보내기 거부');
  ok(cmd(c, 0, 'lobby_kick').ok && c.state === STATES.FINISHED && !c.seats[1].credential && JSON.stringify(c.result) === res && c.records.length === 1, '둘 다 결과 화면 — 즉시 내보내기 · 결과 그대로');
  ok(!!c.toSeatView(0).result && c.toSeatView(0).phase !== 'waiting', '방장 결과 화면 유지');
  cmd(c, 0, 'lobby_return');
  ok(c.state === STATES.OPEN && JSON.stringify(c.records) === rec, '방장 복귀 → 빈 대기방 OPEN · 기록 1건 그대로');
  const d = await finished(4);
  cmd(d, 0, 'lobby_return'); d.socketClosed(1);
  ok(cmd(d, 0, 'lobby_kick').ok && d.state === STATES.OPEN && d.records.length === 1, '방장 복귀 뒤 단절 참가자 즉시 내보내기 → OPEN');
  const e = await finished(5);
  e.socketClosed(1); // 둘 다 결과 화면 — 참가자 단절도 60초 뒤 좌석만 비운다
  await wait(GRACE + 40);
  ok(e.state === STATES.FINISHED && !e.seats[1].credential && e.records.length === 1 && e.result, '결과 화면 참가자 60초 자동 비움 · 결과 유지');
  cmd(e, 0, 'lobby_return');
  ok(e.state === STATES.OPEN, '이후 방장 복귀 → OPEN');

  // 4) 방장 전송 단절 — 대기방
  const h = new Room(6, { isPublic: true, epoch: 'aaaaaaaa', graceMs: GRACE, startGate: true, countdownMs: CD });
  h.openHostSeat(fakeWs());
  h.socketClosed(0);
  ok(h.state === STATES.CLOSED && !h.isListable(), '혼자인 방장 단절 → 즉시 닫힘');
  const p = gateRoom(7);
  const hostTok = p.seats[0].credential.current, guestSeat = p.seats[1];
  cmd(p, 1, 'lobby_ready'); cmd(p, 0, 'lobby_start');
  p.socketClosed(0);
  ok(p.seats[0] === guestSeat && !p.seats[1].credential && p.state === STATES.OPEN && !p._countdown && p.isListable(), '참가자 승격 → 좌석0 · 빈 대기방 OPEN · 카운트다운 취소');
  ok(resume(p, 0, hostTok).reason === 'E_SEAT_TOKEN_INVALID', '옛 방장 토큰 재개 거부');
  ok(p.toSeatView(0).seat === 0 && p.records.length === 0, '승격 방장 뷰 seat 0 · 기록 없음');
  ok(p.joinGuestSeat(fakeWs()).ok && cmd(p, 1, 'lobby_ready').ok && cmd(p, 0, 'lobby_start').ok, '승격 방장 — 새 참가자 준비 · 시작');
  await wait(CD + 30);
  ok(p.state === STATES.SETUP, '승격 방장의 경기 시작');
  p.socketClosed(0);
  await wait(GRACE + 40);
  ok(p.state === STATES.CANCELED, 'SETUP 방장 60초 → 취소(종전)');
  const q = gateRoom(8);
  q.socketClosed(1); q.socketClosed(0);
  ok(q.state === STATES.CLOSED, '참가자도 끊긴 상태 → 방 닫힘');
  const kq = gateRoom(9);
  kq.seats[0].left = true; kq.socketClosed(0);
  ok(kq.seats[0].credential && kq.state === STATES.WAITING, 'left 방장은 종전 경로');

  // 5) 방장 전송 단절 — 결과 화면: 방장 역할은 즉시 참가자에게(owner 1), 결과·최종 보드·좌석 매핑은 그대로
  // 결과 뷰에서 방장 역할(owner)·revision·비운 좌석의 경기 전 준비 배지만 바뀐다 — 결과·자기 말·상대 말·fx 는 한 글자도 같아야 한다
  const board = (v) => JSON.stringify(Object.assign({}, v, { revision: 0, owner: 0, seats: null }));
  const f = await finished(10);
  const fRes = JSON.stringify(f.result), fRec = JSON.stringify(f.records), fGuest = f.seats[1], fView = board(f.toSeatView(1)), hostTok10 = f.seats[0].credential.current;
  ok(f.owner === 0 && f.toSeatView(1).owner === 0 && f.toSeatView(1).result, '결과 화면 — 기본 방장 좌석0');
  f.socketClosed(0);
  ok(f.state === STATES.FINISHED && !f.seats[0].credential && f.seats[1] === fGuest && JSON.stringify(f.result) === fRes && board(f.toSeatView(1)) === fView, '결과 중 방장 단절 — 참가자 결과·최종 보드·좌석 매핑 그대로');
  ok(f.owner === 1 && f.toSeatView(1).owner === 1 && f.toSeatView(1).seat === 1, '방장 역할 즉시 승계 — owner 1 (좌석은 1 그대로)');
  ok(cmd(f, 1, 'lobby_kick').reason === 'E_NO_GUEST' && f.state === STATES.FINISHED, '승계 방장의 내보내기 — 상대 없음 E_NO_GUEST(E_NOT_OWNER 아님)');
  ok(resume(f, 0, hostTok10).reason === 'E_SEAT_TOKEN_INVALID' && JSON.stringify(f.records) === fRec, '옛 방장 토큰 거부 · 기록 불변');
  const fr = cmd(f, 1, 'lobby_return');
  ok(fr.ok && f.seats[0] === fGuest && fr.data.seat === 0 && fr.data.owner === 0 && f.owner === 0 && f.state === STATES.OPEN && f.isListable() && JSON.stringify(f.records) === fRec, '승계 방장 복귀 → 좌석0 · OPEN 목록 · 기록 불변');
  ok(f.joinGuestSeat(fakeWs()).ok && cmd(f, 0, 'lobby_kick').ok && f.state === STATES.OPEN, '복귀 뒤 새 참가자 받기·내보내기');
  const fd = await finished(14);
  const fdRec = JSON.stringify(fd.records);
  fd.socketClosed(0); fd.socketClosed(1);
  ok(fd.state === STATES.CLOSED && !fd.isListable() && JSON.stringify(fd.records) === fdRec, '승계 방장도 끊김 → 즉시 닫힘(고아 방 없음) · 기록 불변');
  const fl = await finished(15);
  fl.socketClosed(0);
  ok(cmd(fl, 1, 'leave').ok && fl.state === STATES.CLOSED && fl.records.length === 1, '승계 방장 나가기 → 즉시 닫힘 · 기록 1건');
  const g = await finished(11);
  const gGuest = g.seats[1];
  cmd(g, 1, 'lobby_return'); g.socketClosed(0);
  ok(g.seats[0] === gGuest && g.state === STATES.OPEN && g.records.length === 1, '참가자가 먼저 복귀 · 방장 단절 → 즉시 승격 OPEN');
  const gl = await finished(12);
  gl.socketClosed(1); gl.socketClosed(0);
  ok(gl.state === STATES.CLOSED && gl.records.length === 1, '결과 중 둘 다 끊김 → 닫힘 · 기록 유지');

  // 6) 경기 중 유예·몰수는 그대로
  const m = gateRoom(13); await startRound(m);
  m._handleSetup(0, makeSetup()); m._handleSetup(1, makeSetup()); m._handleReady(0, true); m._handleReady(1, true);
  ok(cmd(m, 0, 'lobby_kick').reason === 'E_ILLEGAL_ACTION', '경기 중 내보내기 없음');
  m.socketClosed(0);
  await wait(GRACE / 2);
  ok(m.state === STATES.IN_PROGRESS && m.seats[0].credential, '경기 중 방장 단절 — 즉시 무효화 아님');
  await wait(GRACE / 2 + 40);
  ok(m.state === STATES.FINISHED && m.result.type === 'FORFEIT' && m.result.winner === 1 && m.records.length === 1, '경기 중 60초 → 몰수(종전)');

  // 7) 실제 서버 — 연결 중 참가자 WS 내보내기 · 방장 WS 단절 승격 · selfPingMs/self_ping · peer_ping · 결과 화면 승계
  const WebSocket = require('ws');
  const { server, lobby, heartbeatTick } = require('../server');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const conn = (cred) => new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/`, ['digit-duel.v1', cred]); const frames = [];
    ws.on('message', (x) => frames.push(JSON.parse(x))); ws.on('close', (code) => { ws.closedCode = code; }); ws.on('open', () => res({ ws, frames }));
  });
  const until = async (x, pred, from = 0, ms = 3000) => {
    for (const end = Date.now() + ms; Date.now() < end; await wait(10)) { const fr = x.frames.slice(from).find(pred); if (fr) return fr; }
    return null;
  };
  const send = (x, first, o) => x.ws.send(JSON.stringify(Object.assign({ v: 1, seatToken: first.seatToken, tokenGen: first.tokenGen }, o)));
  const H = await conn('cp-lobby295'); const Ho = await until(H, (fr) => fr.type === 'room_opened');
  const R = lobby.getRoom(Ho.roomId); R.graceMs = GRACE;
  const G = await conn('p-' + Ho.roomId); const Go = await until(G, (fr) => fr.type === 'room_joined');
  ok(Ho.selfPingMs === null && Go.selfPingMs === null && Go.peerPingMs === null, '첫 프레임 selfPingMs·peerPingMs — 아직 재지 않음 null');
  heartbeatTick();
  const sp = await until(H, (fr) => fr.type === 'self_ping'), pp = await until(H, (fr) => fr.type === 'peer_ping');
  ok(sp && Number.isInteger(sp.ms) && sp.seq === undefined && pp && Number.isInteger(pp.ms), 'self_ping(내 왕복) · peer_ping(상대 왕복) — seq 없음');
  send(G, Go, { requestId: 'rs', t: 'resync' });
  const rs = await until(G, (fr) => fr.requestId === 'rs');
  ok(rs && Number.isInteger(rs.selfPingMs) && Number.isInteger(rs.peerPingMs), '응답 프레임 selfPingMs·peerPingMs 실측값');
  send(H, Ho, { requestId: 'k1', t: 'lobby_kick', round: 0 });
  const kr = await until(H, (fr) => fr.requestId === 'k1');
  const kg = await until(G, (fr) => fr.type === 'room_state' && fr.reason === 'kicked');
  ok(kr && kr.type === 'room_state' && kr.data.state === 'OPEN' && R.state === STATES.OPEN, 'WS 연결 중 참가자 즉시 내보내기 → OPEN');
  await wait(50);
  ok(kg && kg.data.phase === 'closed' && G.ws.closedCode === 1000, '내보낸 참가자 — 닫힘 뷰 · 소켓 종료');
  const Old = await conn('r-' + Go.epoch + '.' + Go.seatToken);
  ok((await until(Old, (fr) => fr.type === 'error')).code === 'E_SEAT_TOKEN_INVALID', 'WS 옛 참가자 토큰 재개 거부');
  send(H, Ho, { requestId: 'k2', t: 'lobby_kick', round: 0 });
  ok((await until(H, (fr) => fr.requestId === 'k2')).code === 'E_NO_GUEST', 'WS 빈 좌석 E_NO_GUEST');

  const G2 = await conn('p-' + Ho.roomId); const G2o = await until(G2, (fr) => fr.type === 'room_joined');
  let n = G2.frames.length;
  H.ws.close();
  const prom = await until(G2, (fr) => fr.type === 'room_state' && fr.seat === 0, n);
  ok(prom && prom.data.seat === 0 && prom.data.state === 'OPEN' && R.seats[0].ws && R.state === STATES.OPEN, 'WS 방장 단절 → 참가자에게 seat 0 · OPEN 푸시');
  const V = await conn('l-list295'); await until(V, (fr) => fr.type === 'lobby_ready');
  V.ws.send(JSON.stringify({ v: 1, t: 'list_rooms' }));
  const lr = await until(V, (fr) => fr.type === 'lobby_rooms');
  ok(lr && lr.rooms.some((r) => r.roomId === Ho.roomId && r.state === 'OPEN' && r.seats === '1/2'), '방 목록 — 승격 방 OPEN 1/2');
  const OldH = await conn('r-' + Ho.epoch + '.' + Ho.seatToken);
  ok((await until(OldH, (fr) => fr.type === 'error')).code === 'E_SEAT_TOKEN_INVALID', 'WS 옛 방장 토큰 재개 거부');
  send(G2, G2o, { requestId: 'p1', t: 'resync' });
  const p1 = await until(G2, (fr) => fr.requestId === 'p1');
  ok(p1 && p1.seat === 0 && p1.data.seat === 0, '승격 소켓·토큰의 명령은 좌석0으로 처리');
  const G3 = await conn('p-' + Ho.roomId); await until(G3, (fr) => fr.type === 'room_joined');
  ok(await until(G2, (fr) => fr.type === 'room_state' && fr.data.state === 'WAITING', n) && R.state === STATES.WAITING, '승격 방장에게 새 참가 푸시');
  n = G3.frames.length;
  send(G2, G2o, { requestId: 'k3', t: 'lobby_kick', round: 0 });
  ok((await until(G2, (fr) => fr.requestId === 'k3')).data.state === 'OPEN' && await until(G3, (fr) => fr.reason === 'kicked', n), '승격 방장의 내보내기');
  G2.ws.close();
  await wait(100);
  ok(R.state === STATES.CLOSED, '혼자 남은 승격 방장 단절 → 방 닫힘');

  // 결과 화면 — 방장 WS 단절 → 참가자에게 owner 1 푸시(좌석 1·결과 그대로) · 옛 방장 토큰 거부 · 승계 방장 단절 → 닫힘
  const H4 = await conn('cp-result295'); const H4o = await until(H4, (fr) => fr.type === 'room_opened');
  const R4 = lobby.getRoom(H4o.roomId);
  const G4 = await conn('p-' + H4o.roomId); const G4o = await until(G4, (fr) => fr.type === 'room_joined');
  R4.state = STATES.FINISHED; R4.result = { type: 'WIN', winner: 1, winType: 'resign' }; // 경기 진행 경로는 위 단위 검사가 맡는다 — 여기서는 회선만
  n = G4.frames.length;
  H4.ws.close();
  const own = await until(G4, (fr) => fr.type === 'room_state' && fr.data && fr.data.owner === 1, n);
  ok(own && own.seat === 1 && own.data.seat === 1 && own.data.result.winner === 1 && R4.owner === 1, 'WS 결과 중 방장 단절 → owner 1 푸시 · 좌석1·결과 그대로');
  const OldH4 = await conn('r-' + H4o.epoch + '.' + H4o.seatToken);
  ok((await until(OldH4, (fr) => fr.type === 'error')).code === 'E_SEAT_TOKEN_INVALID', 'WS 결과 화면 옛 방장 토큰 거부');
  send(G4, G4o, { requestId: 'k4', t: 'lobby_kick', round: 0 });
  ok((await until(G4, (fr) => fr.requestId === 'k4')).code === 'E_NO_GUEST', 'WS 승계 방장 내보내기 = E_NO_GUEST');
  G4.ws.close();
  await wait(100);
  ok(R4.state === STATES.CLOSED, 'WS 승계 방장 단절 → 방 닫힘');
  for (const x of [H, G, Old, G2, G3, V, OldH, H4, OldH4]) x.ws.close();
  server.close();

  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
