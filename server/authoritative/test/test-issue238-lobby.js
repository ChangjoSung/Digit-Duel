'use strict';
// #238 CJ 8항목(2026-09-28) — 대기방 준비·방장 시작·서버 5초·결과 뒤 같은 방 재대전·경기별 기록·대기방 이모티콘·정보 경계.
// 계약: docs/milestone/v0.4.11/issues/238/Jupiter/cj-revise-contract.md
const { makeCounter, fakeWs, makeSetup, Room, STATES } = require('./helpers');
const { Lobby } = require('../lobby');
const { ok, done } = makeCounter('test-issue238-lobby');

const CD = 40; // 카운트다운 주입(운영 5초)
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const cmd = (room, seat, t) => room.handleCommand(seat, { t, round: room.round }); // 운영 방 명령은 round 필수
function gateRoom(id, opts) {
  const room = new Room(id, Object.assign({ isPublic: true, epoch: 'aaaaaaaa', graceMs: 5000, startGate: true, countdownMs: CD }, opts || {}));
  room.openHostSeat(fakeWs());
  room.joinGuestSeat(fakeWs());
  return room;
}
function playToFinish(room) {
  room._handleSetup(0, makeSetup()); room._handleSetup(1, makeSetup());
  room._handleReady(0, true); room._handleReady(1, true);
  if (room.state !== STATES.IN_PROGRESS) throw new Error('match did not start');
  const r = cmd(room, room.engines[0].S.current, 'resign');
  if (!r.ok || room.state !== STATES.FINISHED) throw new Error('resign did not finish');
}

(async () => {
  // 1) 두 번째 참가는 대기방 — 자동 시작·엔진 없음. 권한 없는 준비/시작 거부.
  const records = [];
  const room = gateRoom(1);
  room.onResult = (e) => records.push(e);
  ok(room.state === STATES.WAITING && !room.engines, '두 번째 참가 → WAITING, 시작 상점 자동 진입 없음');
  let v = room.toSeatView(1);
  ok(v.phase === 'waiting' && v.lobby && v.lobby.guestReady === false && v.lobby.countdownMs === null && v.round === 0, 'WAITING 뷰 모양');
  ok(cmd(room, 0, 'lobby_ready').reason === 'E_NOT_ACTOR', '방장 준비 거부');
  ok(cmd(room, 1, 'lobby_start').reason === 'E_NOT_OWNER', '참가자 시작 거부');
  ok(cmd(room, 0, 'lobby_start').reason === 'E_ILLEGAL_ACTION', '참가자 준비 전 시작 거부');
  ok(cmd(room, 1, 'ready').reason === 'E_ILLEGAL_ACTION', '배치 준비(ready)는 대기방 준비가 아니다');

  // 2) 준비 → 시작 → 중복 시작 무연장 → 준비 취소로 카운트다운 취소
  ok(cmd(room, 1, 'lobby_ready').ok && room.toSeatView(0).lobby.guestReady === true, '참가자 준비 확정');
  ok(cmd(room, 0, 'lobby_start').ok && room._countdown, '방장 시작 → 카운트다운');
  const dl = room._countdown.deadline;
  await wait(10);
  const dup = cmd(room, 0, 'lobby_start');
  ok(dup.ok && dup.noop && room._countdown.deadline === dl, '중복 시작은 noop — 연장 없음');
  ok(cmd(room, 1, 'lobby_unready').ok && !room._countdown, '준비 취소 → 카운트다운 취소');
  await wait(CD + 20);
  ok(room.state === STATES.WAITING, '취소된 카운트다운은 시작하지 않는다');

  // 3) 단절은 카운트다운을 취소하고, 참가자 단절은 준비도 푼다
  cmd(room, 1, 'lobby_ready'); cmd(room, 0, 'lobby_start');
  room.socketClosed(1);
  ok(!room._countdown && !room.seats[1].lobbyReady, '참가자 단절 → 카운트다운·준비 해제');
  ok(cmd(room, 0, 'lobby_start').reason === 'E_ILLEGAL_ACTION', '단절 중 시작 거부');
  ok(room.emote(0).reason === 'E_PAUSED', '상대 단절 중 대기방 이모티콘 거부');
  ok(room.resumeSeat(1, room.seats[1].credential.current, fakeWs()).ok, '대기방 재접속');
  ok(room.emote(0).ok, '두 좌석 연결된 대기방 이모티콘 허용');
  ok(room.emote(0).reason === 'E_RATE_LIMITED', '대기방 이모티콘도 서버 5초 간격');

  // 4) 5초 완료에서만 경기 개시 (종전 무료 로스터 방 → SETUP)
  let pushed = 0; room.onUpdate = () => { pushed++; };
  cmd(room, 1, 'lobby_ready'); cmd(room, 0, 'lobby_start');
  ok(room.state === STATES.WAITING, '카운트다운 중에는 아직 대기방');
  await wait(CD + 30);
  ok(room.state === STATES.SETUP && room.round === 1 && pushed === 1, '5초 완료 → SETUP · round 1 · 양 좌석 푸시');

  // 5) 경기 종료 → 결과 유지(최종 공개 말판·정보 경계) → 좌석별 복귀
  playToFinish(room);
  const fin = room.toSeatView(0);
  ok(fin.state === 'FINISHED' && fin.units.length > 0 && fin.units.every((u) => u.grade === undefined && u.skills === undefined), 'FINISHED 말판 공개 — 등급·스킬 없음');
  ok(records.length === 1 && records[0].matchId, '경기 1 기록 1회');
  const m1 = records[0].matchId;
  const tok0 = room.seats[0].credential.current, name = room.name, rev = room.revision;
  ok(cmd(room, 0, 'lobby_start').reason === 'E_ILLEGAL_ACTION', '결과 중 시작 거부');
  ok(cmd(room, 0, 'lobby_return').ok && room.state === STATES.FINISHED, '방장 먼저 복귀 — 상대는 아직 결과');
  v = room.toSeatView(0);
  ok(v.state === 'WAITING' && v.lobby.peerInResult === true && !v.fx && !v.final && v.result === null && v.units.length === 0, '복귀 좌석 뷰 — 대기방·지난 경기 값 없음');
  ok(room.toSeatView(1).state === 'FINISHED', '상대는 결과 화면 유지');
  ok(cmd(room, 1, 'lobby_ready').reason === 'E_ILLEGAL_ACTION', '상대 결과 확인 중 준비 불가');
  ok(cmd(room, 1, 'lobby_return').ok && room.state === STATES.WAITING, '두 좌석 복귀 → WAITING');
  ok(room.revision > rev && room.seats[0].credential.current === tok0 && room.name === name && !room.engines && room.result === null && room.matchId === null && !room._closeAt, '같은 방·토큰 유지, 경기별 상태 초기화');
  ok(room.seats.every((s) => !s.ready && !s.placed && !s.lobbyReady && !s.returned), '준비·배치 초기화');
  ok(room.handleCommand(0, { t: 'action', round: room.round, baseRevision: rev, action: { t: 'endTurn' } }).ok === false, '지난 경기 행동은 새 대기방에 닿지 않는다');
  ok(room.dedup.size === 0, '지난 경기 저장 응답 비움');
  ok(room.handleCommand(1, { t: 'lobby_ready', round: 0 }).reason === 'E_STALE_REVISION', '다른 round 명령 거부');
  ok(room.handleCommand(1, { t: 'lobby_ready' }).reason === 'E_STALE_REVISION', '운영 방에서 round 빠진 명령 거부');
  ok(room.handleCommand(1, { t: 'resync' }).ok, '복구(resync)는 round 없이도 받는다');
  const legacy = new Room(9, { isPublic: false, epoch: 'aaaaaaaa' }); legacy.openHostSeat(fakeWs()); legacy.joinGuestSeat(fakeWs());
  ok(legacy.handleCommand(0, Object.assign({ t: 'setup' }, makeSetup())).ok, 'startGate 없는 직접 생성 Room 만 round 생략 허용');

  // 6) 두 번째 경기 — 새 matchId 로 기록 1회 더, 앞 기록은 그대로
  cmd(room, 1, 'lobby_ready'); cmd(room, 0, 'lobby_start');
  await wait(CD + 30);
  ok(room.state === STATES.SETUP && room.round === 2, '재대전 5초 → round 2');
  ok(room.handleCommand(0, Object.assign({ t: 'setup', round: 1 }, makeSetup())).reason === 'E_STALE_REVISION', '지난 round 배치 거부');
  playToFinish(room);
  ok(records.length === 2 && records[1].matchId !== m1 && records[0].matchId === m1, '경기 2 새 matchId 기록 — 중복·덮어쓰기 없음');

  // 7) 최신 3항 — 결과에서 참가자가 나가면 방장 결과·방 유지, 방장 복귀 때 빈 대기방(새 참가자 가능)
  room.seats[1].accountId = 'acct-g';
  const lr7 = cmd(room, 1, 'leave'), rev7 = room.revision;
  ok(lr7.ok && lr7.noop && lr7.data.phase === 'closed', '결과 중 참가자 나가기 — 떠난 좌석엔 닫힘 뷰, 방장 쪽 전이 없음');
  ok(room.state === STATES.FINISHED && room.result && room.toSeatView(0).result && !room.seats[1].credential && !room.seats[1].accountId, '방장 결과 유지 · 참가자 좌석 자격/계정 해제');
  ok(!room.isListable() && room.joinGuestSeat(fakeWs()).reason === 'E_ROOM_NOT_FOUND', '방장 복귀 전 새 참가 없음');
  cmd(room, 0, 'lobby_return');
  ok(room.state === STATES.OPEN && room.revision === rev7 + 1 && room.toSeatView(0).state === 'OPEN' && !room.seats[1].nickname, '방장 복귀 → 빈 대기방(OPEN)');
  ok(room.joinGuestSeat(fakeWs()).ok && room.state === STATES.WAITING, '새 참가자 입장 → WAITING');
  cmd(room, 1, 'lobby_ready'); cmd(room, 0, 'lobby_start');
  await wait(CD + 30);
  ok(room.state === STATES.SETUP && room.round === 3, '새 참가자 준비 → 방장 시작 → 5초 → round 3');
  playToFinish(room);
  ok(records.length === 3 && new Set(records.map((r) => r.matchId)).size === 3, '새 참가자 경기도 경기별 1회 기록');

  // 7a) 참가자가 먼저 대기방으로 복귀한 뒤 나가도 방장 결과 유지 → 방장 복귀 시 빈 방
  cmd(room, 1, 'lobby_return'); cmd(room, 1, 'leave');
  ok(room.state === STATES.FINISHED && room.toSeatView(0).result && !room.seats[1].credential && !room._returnLive(), '복귀 참가자 나가기 — 방장 결과·방 유지');
  cmd(room, 0, 'lobby_return');
  ok(room.state === STATES.OPEN, '방장 복귀 → 빈 대기방');
  // 7b') 방장이 먼저 복귀해 기다리는 중 참가자가 결과에서 나가면 즉시 빈 방 · 방장이 대기방에서 나가면 참가자가 결과 중이어도 파괴
  room.joinGuestSeat(fakeWs()); cmd(room, 1, 'lobby_ready'); cmd(room, 0, 'lobby_start');
  await wait(CD + 30); playToFinish(room);
  cmd(room, 0, 'lobby_return');
  ok(!cmd(room, 1, 'leave').noop && room.state === STATES.OPEN, '대기 중 방장 — 참가자 결과 나가기 → 즉시 OPEN');
  room.joinGuestSeat(fakeWs()); cmd(room, 1, 'lobby_ready'); cmd(room, 0, 'lobby_start');
  await wait(CD + 30); playToFinish(room);
  cmd(room, 0, 'lobby_return'); cmd(room, 0, 'leave');
  ok(room.state === STATES.CLOSED, '대기방 방장 나가기 — 참가자가 결과 중이어도 방 파괴');

  // 7b) 복귀한 좌석은 5분 정리로 조용히 닫히지 않는다 — 결과 중인 상대가 끊기면 60초 유예 뒤 그 좌석만 비운다(#295 — 종전 닫힘 대체)
  const lob = new Lobby({ epoch: 'aaaaaaaa' });
  const lr = lob.createRoom('1.1.1.1', { isPublic: true }).room;
  lr.graceMs = 30; lr.countdownMs = CD;
  lr.openHostSeat(fakeWs()); lr.joinGuestSeat(fakeWs());
  ok(lr.state === STATES.WAITING, '로비 방은 기본 대기방');
  cmd(lr, 1, 'lobby_ready'); cmd(lr, 0, 'lobby_start');
  await wait(CD + 30);
  playToFinish(lr);
  lob.sweep();
  ok(lr._closeAt, '결과 방은 5분 정리 예약');
  cmd(lr, 0, 'lobby_return'); lob.sweep();
  ok(!lr._closeAt && lob.getRoom(lr.roomId), '복귀 좌석이 있으면 정리 예약 해제');
  lr.socketClosed(1);
  await wait(60);
  ok(lr.state === STATES.OPEN && !lr.seats[1].credential, '결과 중 상대 단절 유예 만료 → 좌석 비움·빈 대기방(OPEN)');
  lob.sweep();
  ok(lob.getRoom(lr.roomId) && lr.isListable(), '빈 대기방은 목록에 남는다');

  // 8) 나가기는 대기방 취소 · 방장 혼자 시작 불가 · 경제 방은 5초 뒤 시작 상점 90초가 그때부터
  const solo = new Room(2, { isPublic: true, epoch: 'aaaaaaaa', startGate: true, countdownMs: CD });
  solo.openHostSeat(fakeWs());
  ok(cmd(solo, 0, 'lobby_start').reason === 'E_ILLEGAL_ACTION', '혼자 시작 거부');
  const lv = gateRoom(3); cmd(lv, 1, 'lobby_ready'); cmd(lv, 0, 'lobby_start'); cmd(lv, 1, 'leave');
  ok(lv.state === STATES.OPEN && !lv._countdown && !lv.seats[1].credential && !lv.seats[1].lobbyReady, '대기방 참가자 나가기 → 방 유지(OPEN)·카운트다운·준비 해제');
  await wait(CD + 30);
  ok(lv.state === STATES.OPEN && lv.round === 0, '취소된 카운트다운은 늦게도 시작하지 않는다');
  for (let i = 0; i < 2; i++) { lv.joinGuestSeat(fakeWs()); cmd(lv, 1, 'leave'); }
  ok(lv.joinGuestSeat(fakeWs()).ok && lv.state === STATES.WAITING, '반복 입장·나가기 뒤에도 새 참가자 입장');
  cmd(lv, 1, 'lobby_ready'); cmd(lv, 0, 'lobby_start');
  await wait(CD + 30);
  ok(lv.state === STATES.SETUP && lv.round === 1, '새 참가자 준비 → 방장 시작 → 5초');
  lv._finalize(STATES.CANCELED, null, { notify: false });
  const hv = gateRoom(6); cmd(hv, 1, 'lobby_ready'); cmd(hv, 0, 'lobby_start'); cmd(hv, 0, 'leave');
  ok(hv.state === STATES.CANCELED && !hv._countdown, '대기방 방장 나가기 → 방 파괴·카운트다운 정리');
  const eco = gateRoom(4, { economy: true });
  ok(!eco.engines, '경제 방도 참가만으로 상점을 열지 않는다');
  cmd(eco, 1, 'lobby_ready'); cmd(eco, 0, 'lobby_start');
  await wait(CD + 30);
  const c = eco._clock[0];
  ok(eco.state === STATES.SETUP && eco.engines && c && c.key === 'shop:0' && c.deadline - Date.now() > 85000, '5초 완료 순간 S01 90초 시작');
  eco._finalize(STATES.CANCELED, null, { notify: false });

  // 8b) 경제 거래는 revision 을 보지 않는다 — 새 경기 S01 은 진열 번호가 다시 0 부터라 지난 경기 거래와 모양이 같다. round 경계가 막는다.
  const e2 = gateRoom(5, { economy: true, shopMs: 40 });
  cmd(e2, 1, 'lobby_ready'); cmd(e2, 0, 'lobby_start');
  await wait(CD + 30);
  const sh1 = e2.engines[0].S.eco.shop;
  const offer = { t: 'action', round: 1, action: { t: 'shopBuy', shop: sh1.turn, seq: sh1.seq[1], i: 0 } };
  await wait(200); // S01 40ms 만료 → 자동 구매·배치·준비 → 경기 시작
  ok(e2.state === STATES.IN_PROGRESS, '경제 경기 1 시작(시간 초과 자동 배치)');
  cmd(e2, 0, 'resign'); cmd(e2, 0, 'lobby_return'); cmd(e2, 1, 'lobby_return');
  e2._clockMs.shop = undefined; // 경기 2 는 운영 90초
  cmd(e2, 1, 'lobby_ready'); cmd(e2, 0, 'lobby_start');
  await wait(CD + 30);
  const sh2 = e2.engines[0].S.eco.shop;
  ok(e2.round === 2 && sh2.turn === offer.action.shop && sh2.seq[1] === offer.action.seq, '경기 2 S01 진열 번호가 경기 1 과 같다(재시작)');
  ok(e2.handleCommand(1, offer).reason === 'E_STALE_REVISION', '지난 경기 S01 거래 재전송 거부');
  ok(e2.handleCommand(1, Object.assign({}, offer, { round: undefined })).reason === 'E_STALE_REVISION', 'round 빠진 거래 거부');
  ok(e2.handleCommand(1, Object.assign({}, offer, { round: 2 })).ok, '같은 진열을 현재 round 로 보내면 통과(경계는 round 뿐)');
  e2._finalize(STATES.CANCELED, null, { notify: false });

  // 9) 실제 서버 경로 — round 경계는 중복 제거 조회보다 먼저(지난 경기 저장 응답 재전송 없음)
  const WebSocket = require('ws');
  const { server, lobby } = require('../server');
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const conn = (cred) => new Promise((res) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/`, ['digit-duel.v1', cred]); const frames = [];
    ws.on('message', (d) => frames.push(JSON.parse(d))); ws.on('open', () => res({ ws, frames }));
  });
  const until = async (c, pred, from = 0, ms = 3000) => {
    for (const end = Date.now() + ms; Date.now() < end; await wait(10)) { const f = c.frames.slice(from).find(pred); if (f) return f; }
    return null;
  };
  const send = (c, first, o) => c.ws.send(JSON.stringify(Object.assign({ v: 1, seatToken: first.seatToken, tokenGen: first.tokenGen }, o)));
  const h = await conn('cp-lobby238'); const ho = await until(h, (f) => f.type === 'room_opened');
  lobby.getRoom(ho.roomId).countdownMs = CD;
  const g = await conn('p-' + ho.roomId); const go = await until(g, (f) => f.type === 'room_joined');
  send(g, go, { requestId: 'g1', t: 'lobby_ready', round: 0 });
  ok((await until(g, (f) => f.requestId === 'g1')).type === 'room_state', 'WS 참가자 준비');
  send(h, ho, { requestId: 'h1', t: 'lobby_start', round: 0 });
  ok(await until(h, (f) => f.type === 'room_state' && f.data && f.data.state === 'SETUP' && f.data.round === 1), 'WS 5초 뒤 SETUP round 1 푸시');
  let n = g.frames.length;
  send(g, go, { requestId: 'g1', t: 'lobby_ready', round: 0 });
  const replay = await until(g, (f) => f.requestId === 'g1', n);
  ok(replay && replay.type === 'error' && replay.code === 'E_STALE_REVISION' && replay.data && replay.data.round === 1, 'WS 지난 round requestId 재전송 → 저장 응답이 아니라 거부+최신 뷰');
  n = g.frames.length;
  send(g, go, { requestId: 'g2', t: 'unready' });
  const miss = await until(g, (f) => f.requestId === 'g2', n);
  ok(miss && miss.code === 'E_STALE_REVISION', 'WS round 빠진 명령 거부');
  n = g.frames.length;
  send(g, go, { requestId: 'g3', t: 'resync' });
  ok((await until(g, (f) => f.requestId === 'g3', n)).type === 'room_state', 'WS 복구(resync)는 round 없이 통과');
  h.ws.close(); g.ws.close();

  // 10) 실제 서버 경로 — 대기방 참가자 나가기: 방장 OPEN 푸시 · 옛 소켓 종료/재개/중복 제거 차단 · 새 참가자 준비·시작
  const h3 = await conn('cp-lobby238b'); const h3o = await until(h3, (f) => f.type === 'room_opened');
  const r3 = lobby.getRoom(h3o.roomId); r3.countdownMs = CD;
  const g3 = await conn('p-' + h3o.roomId); const g3o = await until(g3, (f) => f.type === 'room_joined');
  send(g3, g3o, { requestId: 'x1', t: 'lobby_ready', round: 0 });
  await until(g3, (f) => f.requestId === 'x1');
  n = h3.frames.length;
  send(g3, g3o, { requestId: 'x2', t: 'leave' });
  const gl = await until(g3, (f) => f.requestId === 'x2');
  ok(gl && gl.data && gl.data.phase === 'closed', 'WS 떠난 참가자 응답 = 닫힘');
  const hp = await until(h3, (f) => f.type === 'room_state' && f.data && f.data.state === 'OPEN', n);
  ok(hp && hp.players[1] === null && hp.peerConnected === false && r3.state === STATES.OPEN, 'WS 방장에게 빈 대기방(OPEN) 푸시');
  ok(await new Promise((r) => { if (g3.ws.readyState === 3) r(true); g3.ws.on('close', () => r(true)); setTimeout(() => r(false), 2000); }), 'WS 떠난 참가자 소켓은 서버가 닫는다');
  const g4 = await conn('p-' + h3o.roomId); const g4o = await until(g4, (f) => f.type === 'room_joined');
  ok(g4o && r3.state === STATES.WAITING && r3.seats[1].connected, 'WS 새 참가자 입장');
  const old = await conn('r-' + g3o.epoch + '.' + g3o.seatToken);
  ok((await until(old, (f) => f.type === 'error')).code === 'E_SEAT_TOKEN_INVALID' && r3.seats[1].connected, 'WS 옛 참가자 토큰 재개 거부 · 새 참가자 유지');
  send(g4, g4o, { requestId: 'x2', t: 'lobby_ready', round: 0 }); // 옛 참가자 leave 와 같은 requestId — 저장 응답 재전송 없이 실행
  const rr = await until(g4, (f) => f.requestId === 'x2');
  ok(rr && rr.type === 'room_state' && rr.data.state === 'WAITING' && r3.seats[1].lobbyReady, 'WS 새 참가자 같은 requestId 준비 — 옛 저장 응답 아님');
  send(h3, h3o, { requestId: 'y1', t: 'lobby_start', round: 0 });
  ok(await until(g4, (f) => f.type === 'room_state' && f.data && f.data.state === 'SETUP' && f.data.round === 1), 'WS 새 참가자 경기 5초 뒤 SETUP');
  h3.ws.close(); g4.ws.close(); old.ws.close(); server.close();

  done();
})().catch((e) => { console.error(e); process.exitCode = 1; });
