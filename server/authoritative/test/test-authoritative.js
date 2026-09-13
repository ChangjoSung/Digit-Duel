'use strict';
// #217 인증 서버 헤드리스 통합 테스트 — protocol.md·analysis.md §3 QA 매트릭스의 부분집합.
// 실제 WebSocket 연결로 서버 프로세스를 통해 검증한다(단위 함수 모킹이 아니다). 게임 규칙 자체는
// demo/index.html 원본 엔진을 그대로 구동하므로(room.js·engine.js), 여기서는 프로토콜·인가·
// 가시성 화이트리스트·생명주기만 검증하고 규칙 세부 회귀는 CLAUDE.md가 요구하는 기존 데모 스모크가 맡는다.
const WebSocket = require('ws');
const { server, EPOCH, lobby } = require('../server');
const { createEngine } = require('../engine');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error('FAIL: ' + msg); } }

function mkQueue(ws) {
  const buf = []; const waiters = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    const idx = waiters.findIndex((w) => w.pred(msg));
    if (idx >= 0) { const w = waiters.splice(idx, 1)[0]; w.resolve(msg); } else buf.push(msg);
  });
  function take(pred, timeoutMs) {
    const i = buf.findIndex(pred);
    if (i >= 0) return Promise.resolve(buf.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout waiting for message')), timeoutMs || 5000);
      waiters.push({ pred, resolve: (m) => { clearTimeout(t); resolve(m); } });
    });
  }
  return { any: () => take(() => true), withRequestId: (id) => take((m) => m.requestId === id), matching: (pred) => take(pred), peekAll: () => buf.slice() };
}

function connect(port, credential) { return new WebSocket(`ws://127.0.0.1:${port}/`, ['digit-duel.v1', credential]); }
function send(ws, tok, gen, obj) { ws.send(JSON.stringify(Object.assign({ v: 1, seatToken: tok, tokenGen: gen }, obj))); }

// 실제 배치 화면과 같은 형태 — engine.js의 createEngine()(snapshot/restore로 감싼 harness.load())을 통해서만
// 만든다. 직접 harness.load()를 부르면 global.setTimeout이 흘러가지 않고 이 테스트의 타이머가 멈춘다.
function makeSetup() {
  const T = createEngine();
  const roster = T.ROSTER.slice(0, 6).map((r) => r.id);
  const pos = [];
  for (const r of T.zoneOf(0)) { for (let c = 1; c <= 7 && pos.length < 14; c++) pos.push([r, c]); }
  return { roster, pos };
}

async function main() {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  // ===== 1. 비공개 룸 생성·참가·독립 배치·시작 원자성 (F4/B6) =====
  const host = connect(port, 'c-nonce1'); const hostQ = mkQueue(host);
  const opened = await hostQ.any();
  ok(opened.type === 'room_opened' && opened.seat === 0 && opened.inviteCode, '방 생성 응답 형태');
  const inviteCode = opened.inviteCode;

  const guest = connect(port, 'j-' + inviteCode); const guestQ = mkQueue(guest);
  const joined = await guestQ.any();
  ok(joined.type === 'room_joined' && joined.seat === 1, '초대 코드 참가 응답 형태');
  // v4 — 호스트는 게스트 참가(OPEN→SETUP)를 능동 푸시로 즉시 안다 (Mars 실통합 msg_31cb978ea815)
  const joinNotice = await hostQ.matching((m) => m.type === 'room_state' && !m.requestId);
  ok(joinNotice.seat === 0 && joinNotice.data.state === 'SETUP' && joinNotice.data.phase === 'setup' && joinNotice.revision === joined.revision,
    '호스트에게 참가 알림 room_state(SETUP, 게스트와 같은 revision): ' + JSON.stringify({ state: joinNotice.data.state, rev: joinNotice.revision, jrev: joined.revision }));

  const guest2 = connect(port, 'j-' + inviteCode); const guest2Q = mkQueue(guest2);
  const rejected = await guest2Q.any();
  ok(rejected.type === 'error' && rejected.code === 'E_ROOM_NOT_FOUND', 'F5 재사용 초대 코드 거부: ' + JSON.stringify(rejected));
  guest2.close();
  await new Promise((r) => setTimeout(r, 80));
  ok(!hostQ.peekAll().some((m) => m.type === 'room_state' && !m.requestId), '실패한 재참가 시도는 호스트에게 거짓 참가 알림을 보내지 않음');

  const setupHost = makeSetup(), setupGuest = makeSetup();
  send(host, opened.seatToken, opened.tokenGen, Object.assign({ requestId: 'r1', t: 'setup' }, setupHost));
  const hostSetupResp = await hostQ.withRequestId('r1');
  ok(hostSetupResp.type === 'room_state', 'host setup 응답: ' + JSON.stringify(hostSetupResp));

  send(guest, joined.seatToken, joined.tokenGen, Object.assign({ requestId: 'r2', t: 'setup' }, setupGuest));
  const guestSetupResp = await guestQ.withRequestId('r2');
  ok(guestSetupResp.type === 'room_state', 'guest setup 응답');

  send(host, opened.seatToken, opened.tokenGen, { requestId: 'r3', t: 'ready' });
  const hostReadyResp = await hostQ.withRequestId('r3');
  ok(hostReadyResp.data.phase === 'setup', '한쪽만 ready면 아직 setup 단계: ' + JSON.stringify(hostReadyResp));

  send(guest, joined.seatToken, joined.tokenGen, { requestId: 'r4', t: 'ready' });
  const guestReadyResp = await guestQ.withRequestId('r4');
  ok(guestReadyResp.data.phase === 'play', 'F4 양쪽 ready → 원자적으로 play 시작: ' + JSON.stringify(guestReadyResp));
  ok(guestReadyResp.data.you.pieces.length === 14, '자기 좌석 14기 전부 수신');
  const startRevision = guestReadyResp.revision;
  const current = guestReadyResp.data.current;

  // E_MATCH_STARTED — 시작 후 setup 재시도는 거부.
  send(host, opened.seatToken, opened.tokenGen, Object.assign({ requestId: 'r5', t: 'setup' }, setupHost));
  const lateSetup = await hostQ.withRequestId('r5');
  ok(lateSetup.code === 'E_MATCH_STARTED', 'F4 시작 후 setup 거부: ' + JSON.stringify(lateSetup));

  // ===== 2. 인가 — B1(행위자) =====
  const notCurrentWs = current === 0 ? guest : host;
  const notCurrentQ = current === 0 ? guestQ : hostQ;
  const notCurrentTok = current === 0 ? joined : opened;
  send(notCurrentWs, notCurrentTok.seatToken, notCurrentTok.tokenGen, {
    requestId: 'r6', t: 'action', baseRevision: startRevision, action: { t: 'endTurn' },
  });
  const notActor = await notCurrentQ.withRequestId('r6');
  ok(notActor.code === 'E_NOT_ACTOR', 'B1 상대 턴 행동 거부: ' + JSON.stringify(notActor));

  // 정상 이동: 자기 진영 말 하나를 선택 → 한 칸 이동 (등급 A/B로 새는 좌표가 없는 시작 위치 사용)
  const currentWs = current === 0 ? host : guest;
  const currentQ = current === 0 ? hostQ : guestQ;
  const currentTok = current === 0 ? opened : joined;
  const startPos = current === 0 ? { r: 11, c: 1, to: { r: 10, c: 1 } } : { r: 3, c: 1, to: { r: 4, c: 1 } };
  send(currentWs, currentTok.seatToken, currentTok.tokenGen, {
    requestId: 'r7', t: 'action', baseRevision: startRevision, action: { t: 'cell', r: startPos.r, c: startPos.c },
  });
  const selectResp = await currentQ.withRequestId('r7');
  ok(selectResp.type === 'room_state', '자기 말 선택 성공: ' + JSON.stringify(selectResp));

  send(currentWs, currentTok.seatToken, currentTok.tokenGen, {
    requestId: 'r8', t: 'action', baseRevision: selectResp.revision, action: { t: 'cell', r: startPos.to.r, c: startPos.to.c },
  });
  const moved = await currentQ.withRequestId('r8');
  ok(moved.type === 'room_state' && moved.data.you.pieces.some((p) => p.r === startPos.to.r && p.c === startPos.to.c), '정상 이동 반영: ' + JSON.stringify(moved.data.you.pieces.map((p) => [p.r, p.c])));

  // ===== 3. C1 — 중복 제거: 같은 requestId 재전송은 재실행하지 않는다 =====
  send(currentWs, currentTok.seatToken, currentTok.tokenGen, {
    requestId: 'r8', t: 'action', baseRevision: selectResp.revision, action: { t: 'cell', r: startPos.to.r, c: startPos.to.c },
  });
  const dup = await currentQ.matching((m) => m.requestId === 'r8' && m !== moved);
  ok(dup.revision === moved.revision, 'C1 중복 requestId는 revision을 바꾸지 않음: ' + dup.revision + ' vs ' + moved.revision);

  // ===== 4. C3 — 낡은 baseRevision =====
  send(notCurrentWs, notCurrentTok.seatToken, notCurrentTok.tokenGen, {
    requestId: 'r9', t: 'action', baseRevision: startRevision, action: { t: 'endTurn' },
  });
  const stale = await notCurrentQ.withRequestId('r9');
  ok(stale.code === 'E_STALE_REVISION', 'C3 낡은 baseRevision 거부: ' + JSON.stringify(stale));

  // ===== 5. 좌석 토큰 위조 =====
  send(notCurrentWs, 'not-a-real-token-xxxxxx', notCurrentTok.tokenGen, {
    requestId: 'r10', t: 'action', baseRevision: moved.revision, action: { t: 'endTurn' },
  });
  const badToken = await notCurrentQ.withRequestId('r10');
  ok(badToken.code === 'E_SEAT_TOKEN_INVALID', '위조 토큰 거부: ' + JSON.stringify(badToken));

  // ===== 6. 가시성 화이트리스트 (A5/A4) =====
  const oppUnit = (moved.data.units || [])[0];
  if (oppUnit) {
    ok(!('hp' in oppUnit) && !('type' in oppUnit) && !('skills' in oppUnit), 'A5 미공개 상대 유닛에 정체/HP/스킬 미노출: ' + JSON.stringify(oppUnit));
  }
  ok(JSON.stringify(moved.data.you).includes('"skills"'), '자기 유닛에는 skills 포함');
  ok(!/seed/i.test(JSON.stringify(moved)), 'A4 시드 키가 어디에도 없음');

  // ===== 7. F6 — IN_PROGRESS의 leave는 거부된다 =====
  send(currentWs, currentTok.seatToken, currentTok.tokenGen, { requestId: 'r11', t: 'leave' });
  const leaveDuringGame = await currentQ.withRequestId('r11');
  ok(leaveDuringGame.code === 'E_ILLEGAL_ACTION', 'F6 경기 중 leave 거부: ' + JSON.stringify(leaveDuringGame));

  // ===== 8. 기권 =====
  send(notCurrentWs, notCurrentTok.seatToken, notCurrentTok.tokenGen, { requestId: 'r12', t: 'resign' });
  const wrongResign = await notCurrentQ.withRequestId('r12');
  ok(wrongResign.code === 'E_NOT_ACTOR', '기권도 S.current 기준: ' + JSON.stringify(wrongResign));

  send(currentWs, currentTok.seatToken, currentTok.tokenGen, { requestId: 'r13', t: 'resign' });
  const resigned = await currentQ.withRequestId('r13');
  ok(resigned.data.result && resigned.data.result.type === 'WIN', '기권 후 결과 확정: ' + JSON.stringify(resigned.data.result));

  host.close(); guest.close();

  // ===== 9. 공개 로비 — 생성·목록·참가 시 목록에서 제거 =====
  const pubHost = connect(port, 'cp-nonce2'); const pubHostQ = mkQueue(pubHost);
  const pubOpened = await pubHostQ.any();
  ok(pubOpened.public === true && !pubOpened.inviteCode, '공개 룸에는 초대 코드가 없음');

  const viewer = connect(port, 'l-nonce3'); const viewerQ = mkQueue(viewer);
  await viewerQ.any(); // lobby_ready
  viewer.send(JSON.stringify({ v: 1, t: 'list_rooms' }));
  const rooms1 = await viewerQ.matching((m) => m.type === 'lobby_rooms');
  ok(rooms1.rooms.some((r) => r.roomId === pubOpened.roomId), '공개 로비 목록에 노출: ' + JSON.stringify(rooms1));

  const pubGuest = connect(port, 'p-' + pubOpened.roomId); const pubGuestQ = mkQueue(pubGuest);
  await pubGuestQ.any(); // room_joined

  viewer.send(JSON.stringify({ v: 1, t: 'list_rooms' }));
  const rooms2 = await viewerQ.matching((m) => m.type === 'lobby_rooms');
  ok(!rooms2.rooms.some((r) => r.roomId === pubOpened.roomId), 'SETUP 전이 후 로비 목록에서 제거: ' + JSON.stringify(rooms2));

  const pubNotice = await pubHostQ.matching((m) => m.type === 'room_state' && !m.requestId);
  ok(pubNotice.data.state === 'SETUP', '공개 룸 참가도 호스트에게 참가 알림');
  const pubGuest2 = connect(port, 'p-' + pubOpened.roomId); const pubGuest2Q = mkQueue(pubGuest2);
  const pubRej = await pubGuest2Q.any();
  ok(pubRej.code === 'E_ROOM_NOT_FOUND', '이미 찬 공개 룸 참가 거부');
  await new Promise((r) => setTimeout(r, 80));
  ok(!pubHostQ.peekAll().some((m) => m.type === 'room_state' && !m.requestId), '거부된 공개 참가는 호스트에게 알림 없음');
  pubGuest2.close();

  pubHost.close(); pubGuest.close(); viewer.close();

  // ===== 10. 재개(resume) — 정상 토큰 재개 성공, 잘못된 에폭은 E_EPOCH =====
  const h2 = connect(port, 'c-nonce4'); const h2Q = mkQueue(h2);
  const o2 = await h2Q.any();
  h2.close();
  await new Promise((r) => setTimeout(r, 50));

  const resumed = connect(port, `r-${EPOCH}.${o2.seatToken}`); const resumedQ = mkQueue(resumed);
  const resumedMsg = await resumedQ.any();
  ok(resumedMsg.type === 'room_resumed', '정상 재개 성공: ' + JSON.stringify(resumedMsg));
  resumed.close();

  const badEpoch = connect(port, `r-deadbeef.${o2.seatToken}`); const badEpochQ = mkQueue(badEpoch);
  const badEpochMsg = await badEpochQ.any();
  ok(badEpochMsg.code === 'E_EPOCH', 'G1 에폭 불일치 즉시 E_EPOCH: ' + JSON.stringify(badEpochMsg));

  // ===== 11. E_SUPERSEDED — 같은 좌석으로 재개하면 이전 소켓이 밀려난다 (E1) =====
  const h3 = connect(port, 'c-nonce5'); const h3Q = mkQueue(h3);
  const o3 = await h3Q.any();
  const supersedePromise = h3Q.matching((m) => m.code === 'E_SUPERSEDED');
  await new Promise((r) => setTimeout(r, 20));
  const h3b = connect(port, `r-${EPOCH}.${o3.seatToken}`); const h3bQ = mkQueue(h3b);
  const resumed3 = await h3bQ.any(); // room_resumed
  const supersededMsg = await supersedePromise;
  ok(supersededMsg.code === 'E_SUPERSEDED', 'E1 이전 소켓 E_SUPERSEDED: ' + JSON.stringify(supersededMsg));

  // ===== 12. 낡은 소켓의 뒤늦은 close — 재개된 좌석을 잘못 끊으면 안 된다 (Mercury 사전 감사) =====
  // _attach()가 h3(구 소켓)에 close(4001,'superseded')를 걸어 뒀다(위) — 그 실제 TCP 종료가 이제(또는
  // 나중에) 서버에 'close' 이벤트로 도착한다. h3b(신 소켓)로 이미 재개했으므로, 이 뒤늦은 close가
  // connGen 검사 없이 room.socketClosed(seat)을 부르면 seat.connected=false·seat.ws=null이 되고
  // 60초 이탈 유예 타이머가 걸린다 — 실제 손상은 60초 뒤에나 관측되므로(그레이스를 못 줄이는 이 경로에서는)
  // 타이머 발화를 기다리지 않고 room 내부 상태를 직접 읽어 "유예가 걸렸는가"를 그 자리에서 확인한다.
  const room3 = lobby.getRoom(o3.roomId);
  h3.close(); // 낡은 소켓의 클라이언트측 close — 서버는 이미 4001로 닫아 뒀으므로 이건 실통신의 뒷정리일 뿐
  await new Promise((r) => setTimeout(r, 60)); // close 이벤트가 서버에 도착해 처리될 시간
  const seat3 = room3.seats[0]; // 'c-nonce5'로 개설한 호스트는 항상 좌석 0, 재개도 같은 좌석이다
  ok(seat3.connected === true, '구 소켓의 뒤늦은 close 이후에도 재개된 좌석은 connected=true로 남음: ' + JSON.stringify(seat3.connected));
  ok(seat3.ws !== null, '구 소켓의 뒤늦은 close 이후에도 seat.ws가 null로 지워지지 않음');
  ok(seat3.disconnectTimer === null, '구 소켓의 뒤늦은 close가 이탈 유예 타이머를 잘못 걸지 않음');
  // 재개된 소켓으로 정상 명령이 여전히 통하는지도 실통신으로 재확인한다.
  h3b.send(JSON.stringify({ v: 1, requestId: 'r14', seatToken: resumed3.seatToken, tokenGen: resumed3.tokenGen, t: 'resync' }));
  const resyncAfterStaleClose = await h3bQ.withRequestId('r14');
  ok(resyncAfterStaleClose.type === 'room_state', '구 소켓의 뒤늦은 close 이후에도 재개된 좌석은 정상 응답: ' + JSON.stringify(resyncAfterStaleClose));
  h3.close(); h3b.close();

  // ===== 13. leave 인증 — v3: WS t:leave 분기가 좌석 토큰 검사보다 앞에 있어 위조 토큰으로 OPEN 룸 취소 (Saturn msg_eb240f4c5b27) =====
  {
    const lh = connect(port, 'cp-nonce13'); const lhQ = mkQueue(lh);
    const lo = await lhQ.any();
    const room13 = lobby.getRoom(lo.roomId);
    for (const [label, tok, gen] of [['위조 토큰', 'AAAAAAAAAAAAAAAAAAAAAA', lo.tokenGen], ['형식 불량 토큰', 'x', lo.tokenGen], ['낡은 tokenGen', lo.seatToken, lo.tokenGen + 5]]) {
      const rid = 'leave-' + label;
      send(lh, tok, gen, { requestId: rid, t: 'leave' });
      const r = await lhQ.withRequestId(rid);
      ok(r.type === 'error' && (r.code === 'E_SEAT_TOKEN_INVALID' || r.code === 'E_TOKEN_GEN_STALE'), 'leave(' + label + ') 인증 실패: ' + JSON.stringify(r));
      ok(room13.state === 'OPEN' && room13.isListable(), 'leave(' + label + ') 뒤에도 룸은 OPEN·로비 노출 유지');
    }
    lh.send(JSON.stringify({ v: 1, requestId: 'leave-notoken', t: 'leave' }));
    const noTok = await lhQ.matching((m) => m.type === 'error' && m.code === 'E_BAD_ENVELOPE');
    ok(!!noTok && room13.state === 'OPEN', 'seatToken 없는 leave는 E_BAD_ENVELOPE·룸 불변');
    const lg = connect(port, 'p-' + lo.roomId); const lgQ = mkQueue(lg);
    const lj = await lgQ.any();
    await lhQ.matching((m) => m.type === 'room_state' && !m.requestId);
    const rev = room13.revision;
    send(lh, lo.seatToken, lo.tokenGen, { requestId: 'leave-ok', t: 'leave' });
    const lr = await lhQ.withRequestId('leave-ok');
    ok(lr.type === 'room_state' && lr.data.state === 'CANCELED' && lr.data.phase === 'canceled' && lr.revision === rev + 1, '정당한 leave → CANCELED(phase canceled), revision +1: ' + JSON.stringify({ t: lr.type, st: lr.data && lr.data.state, ph: lr.data && lr.data.phase, rev: lr.revision }));
    const gpush = await lgQ.matching((m) => m.type === 'room_state' && m.data && m.data.state === 'CANCELED');
    ok(gpush.data.phase === 'canceled' && gpush.revision === rev + 1, '상대 좌석에도 CANCELED 푸시(같은 revision)');
    send(lh, lo.seatToken, lo.tokenGen, { requestId: 'leave-ok', t: 'leave' });
    const again = await lhQ.matching((m) => m.requestId === 'leave-ok' && m !== lr);
    ok(again.type === 'error' && again.code === 'E_SEAT_TOKEN_INVALID' && room13.revision === rev + 1, '취소 후 폐기된 토큰의 재전송은 인증 실패·revision 불변');
    send(lg, lj.seatToken, lj.tokenGen, { requestId: 'g-after', t: 'resync' });
    const gAfter = await lgQ.withRequestId('g-after');
    ok(gAfter.code === 'E_SEAT_TOKEN_INVALID', '취소된 룸의 게스트 토큰도 폐기');
    lh.close(); lg.close();
  }

  // ===== 14. 실제 소켓으로 행동 인가 — 전투 중 방어자 skipMain 거부·상태 불변 =====
  {
    const a = connect(port, 'cp-nonce14'); const aQ = mkQueue(a);
    const ao = await aQ.any();
    const b = connect(port, 'p-' + ao.roomId); const bQ = mkQueue(b);
    const bo = await bQ.any();
    await aQ.matching((m) => m.type === 'room_state' && !m.requestId);
    const room14 = lobby.getRoom(ao.roomId);
    const toks = [ao, bo], qs = [aQ, bQ], socks = [a, b];
    send(a, ao.seatToken, ao.tokenGen, Object.assign({ requestId: 's0', t: 'setup' }, makeSetup())); await aQ.withRequestId('s0');
    send(b, bo.seatToken, bo.tokenGen, Object.assign({ requestId: 's1', t: 'setup' }, makeSetup())); await bQ.withRequestId('s1');
    send(a, ao.seatToken, ao.tokenGen, { requestId: 'y0', t: 'ready' }); await aQ.withRequestId('y0');
    send(b, bo.seatToken, bo.tokenGen, { requestId: 'y1', t: 'ready' }); const started = await bQ.withRequestId('y1');
    ok(started.data.phase === 'play', '실소켓 매치 시작');
    const cur = room14.engine.S.current, def = 1 - cur;
    const E0 = room14.engine;
    const attId = E0.S.pieces.find((p) => p.owner === cur && p.type === 'minion').id;
    const dId = E0.S.pieces.find((p) => p.owner === def && p.type === 'minion').id;
    for (const E of room14.engines) { E.initBattle(E.S.pieces.find((p) => p.id === attId), E.S.pieces.find((p) => p.id === dId)); E.drain(); }
    send(socks[cur], toks[cur].seatToken, toks[cur].tokenGen, { requestId: 'atk', t: 'action', baseRevision: room14.revision, action: { t: 'act', k: 0 } });
    const atk = await qs[cur].withRequestId('atk');
    ok(atk.type === 'room_state' && room14.state === 'IN_PROGRESS', '공격자 act k0 수락(실소켓): ' + JSON.stringify(atk.code));
    if (room14.engine && room14.engine.S.battle) {
      const revBefore = room14.revision, mainUsed = room14.engine.S.mainUsed;
      send(socks[def], toks[def].seatToken, toks[def].tokenGen, { requestId: 'dskip', t: 'action', baseRevision: revBefore, action: { t: 'skipMain' } });
      const dskip = await qs[def].withRequestId('dskip');
      ok(dskip.code === 'E_ILLEGAL_ACTION' && room14.revision === revBefore && room14.engine.S.mainUsed === mainUsed && !!room14.engine.S.battle, '실소켓: 방어자 전투 차례 skipMain 거부·mainUsed·전투 불변');
    }
    a.close(); b.close();
  }

  console.log(`authoritative: ${pass} passed, ${fail} failed`);
  server.close();
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
