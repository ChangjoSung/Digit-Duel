'use strict';
// #261 멀티 방 이름 · 공개 목록 상태 · 실측 핑(rtt) — 서버 경계.
//   A. normalizeRoomName · rtt 봉투 검사 (단위)
//   B. 실제 서버에 독립 클라이언트 여럿: 이름 있는/없는/틀린 생성 · 목록 상태·순서·공개 필드 · 참가 경합 · 시작된 방 참가 거부 ·
//      재접속 roomName · 로비 rtt 왕복 · 좌석 소켓 rtt 무시(seq 불변).
const WebSocket = require('ws');
process.env.DD_AUTH_MAX_CONNECTIONS_PER_IP = '32'; // 한 루프백 IP 에서 독립 클라이언트 10개 가까이 동시에 연다(기본 상한 8)
const { normalizeRoomName, validateEnvelope } = require('../protocol');
const { server, lobby } = require('../server');
const { STATES } = require('../room');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL: ' + msg); } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ===== A. 단위 ===== */
const N = normalizeRoomName;
ok(N('내 방') === '내 방', 'A1 한글·공백');
ok(N('  테스트   Room_1-a  ') === '테스트 Room_1-a', 'A1 앞뒤 공백 제거·연속 공백 1칸');
ok(N('가'.repeat(20)) === '가'.repeat(20) && N('가'.repeat(21)) === null, 'A2 20자 허용 · 21자 거부');
ok(N('ab') === 'ab' && N('a') === null && N('  a   ') === null && N('') === null && N('     ') === null, 'A2 정리 뒤 2자 미만 거부');
for (const bad of ['a\tb', 'a\nb', 'a b', '<b>x', 'a&b', 'ㄱㄴ', '한한', '방🙂', 'a\u0000b', 'é방', ' '.repeat(65), 7, null, undefined, ['ab']]) {
  ok(N(bad) === null, 'A3 허용 밖 거부(지우지 않음): ' + JSON.stringify(bad));
}
const env = (o) => validateEnvelope(JSON.stringify(Object.assign({ v: 1, t: 'rtt' }, o)));
ok(env({ n: 0 }).ok && env({ n: 2147483647 }).ok, 'A4 rtt n 0·2147483647 허용 (credential 불필요)');
for (const n of [-1, 2147483648, 1.5, '1', null, undefined]) ok(!env({ n }).ok, 'A4 rtt n 거부: ' + JSON.stringify(n));

/* ===== B. 실제 서버 ===== */
let PORT;
function open(cred, rn) {
  const q = rn === undefined ? '' : '?' + [].concat(rn).map((v) => 'rn=' + encodeURIComponent(v)).join('&');
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/${q}`, ['digit-duel.v1', cred]);
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
async function list(viewer) {
  viewer.frames.length = 0;
  viewer.ws.send(JSON.stringify({ v: 1, t: 'list_rooms' }));
  const f = await waitFor(viewer, (x) => x.type === 'lobby_rooms');
  return f ? f.rooms : [];
}
const ROW_KEYS = 'ageSec,label,players,reps,roomId,roomName,seats,state';

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  PORT = server.address().port;

  // 생성 — 이름 정리 · 중복 이름 허용 · 옛(rn 없음) 기본 이름
  const a = open('cp-a261', '  테스트   Room_1 ');
  const aOpen = await first(a);
  ok(aOpen && aOpen.type === 'room_opened' && aOpen.roomName === '테스트 Room_1', 'B1 이름 있는 공개 생성: ' + JSON.stringify(aOpen && aOpen.roomName));
  const b = open('cp-b261', '테스트 Room_1');
  const bOpen = await first(b);
  ok(bOpen && bOpen.roomName === '테스트 Room_1' && bOpen.roomId !== aOpen.roomId, 'B1 같은 이름 허용 · 방 번호로 구분');
  const p = open('c-p261');
  const pOpen = await first(p);
  ok(pOpen && pOpen.roomName === '방 ' + pOpen.roomId && pOpen.inviteCode, 'B2 rn 없는 옛 생성은 "방 <번호>" (비공개): ' + JSON.stringify(pOpen && pOpen.roomName));

  // 틀린 이름 — 방을 만들지 않고 E_BAD_ROOM_NAME
  const before = lobby.rooms.size;
  for (const rn of ['<script>', '', ' a ', 'x'.repeat(21), ['방이름', '두번째']]) {
    const c = open('cp-bad261', rn);
    const f = await first(c);
    ok(f && f.type === 'error' && f.code === 'E_BAD_ROOM_NAME', 'B3 틀린 이름 거부: ' + JSON.stringify(rn) + ' → ' + JSON.stringify(f));
  }
  ok(lobby.rooms.size === before, 'B3 거부된 생성은 방을 만들지 않는다');

  // 목록 — 공개 OPEN 만 · 비공개 없음 · 공개 필드만
  const viewer = open('l-v261');
  await waitFor(viewer, (x) => x.type === 'lobby_ready');
  let rows = await list(viewer);
  ok(rows.length === 2 && rows.every((r) => r.state === 'OPEN' && r.seats === '1/2') && !rows.some((r) => r.roomId === pOpen.roomId), 'B4 공개 참가 대기 2개 · 비공개 없음');
  ok(rows.every((r) => Object.keys(r).sort().join(',') === ROW_KEYS), 'B4 행 필드 화이트리스트: ' + JSON.stringify(rows[0]));
  ok(!/inviteCode|creatorIp|accountId|userId|email|seatToken|127\.0\.0\.1|roster|bag/.test(JSON.stringify(rows)), 'B4 비공개 정보 없음');
  ok(rows[0].roomId > rows[1].roomId, 'B4 같은 상태면 최신 방 먼저');

  // rtt — 로비 소켓 즉시 왕복 · 틀린 n 은 무응답(소켓 유지)
  viewer.frames.length = 0;
  viewer.ws.send(JSON.stringify({ v: 1, t: 'rtt', n: 42 }));
  const echo = await waitFor(viewer, (x) => x.type === 'rtt');
  ok(echo && JSON.stringify(echo) === '{"v":1,"type":"rtt","n":42}', 'B5 rtt 왕복 {v,type,n}: ' + JSON.stringify(echo));
  viewer.frames.length = 0;
  viewer.ws.send(JSON.stringify({ v: 1, t: 'rtt', n: -1 }));
  viewer.ws.send(JSON.stringify({ v: 1, t: 'rtt', n: 7 }));
  const after = await waitFor(viewer, (x) => x.type === 'rtt');
  ok(after && after.n === 7 && viewer.frames.length === 1, 'B5 틀린 n 은 답하지 않고 다음 rtt 는 답한다');

  // 참가 — 독립 클라이언트 둘이 같은 공개 방을 동시에: 하나만 성공
  const g1 = open('p-' + bOpen.roomId), g2 = open('p-' + bOpen.roomId);
  const [r1, r2] = await Promise.all([first(g1), first(g2)]);
  const types = [r1, r2].map((f) => f && (f.type === 'error' ? f.code : f.type)).sort().join(',');
  ok(types === 'E_ROOM_NOT_FOUND,room_joined', 'B6 참가 경합은 하나만 성공: ' + types);
  const bGuest = r1 && r1.type === 'room_joined' ? g1 : g2;
  const bJoined = r1 && r1.type === 'room_joined' ? r1 : r2;
  ok(bJoined && bJoined.roomName === '테스트 Room_1', 'B6 참가 첫 프레임 roomName');
  const ga = open('p-' + aOpen.roomId);
  const aJoined = await first(ga);
  ok(aJoined && aJoined.type === 'room_joined', 'B6 방 A 참가');

  // 좌석 소켓 rtt — 무시, seq 불변
  bGuest.frames.length = 0;
  bGuest.ws.send(JSON.stringify({ v: 1, t: 'rtt', n: 1 }));
  bGuest.ws.send(JSON.stringify({ v: 1, t: 'list_rooms' }));
  const seatList = await waitFor(bGuest, (x) => x.type === 'lobby_rooms');
  ok(seatList && !bGuest.frames.some((x) => x.type === 'rtt' || x.type === 'error') && seatList.seq === bJoined.seq + 1, 'B7 좌석 소켓 rtt 무시 · seq 불변: ' + JSON.stringify(bGuest.frames.map((x) => [x.type, x.seq])));

  // 준비 중 표시 · OPEN 먼저 · 시작된 방 참가 거부
  const c = open('cp-c261', 'Open Room');
  const cOpen = await first(c);
  rows = await list(viewer);
  ok(rows.map((r) => r.roomId + ':' + r.state + ':' + r.seats).join(' ') === `${cOpen.roomId}:OPEN:1/2 ${bOpen.roomId}:WAITING:2/2 ${aOpen.roomId}:WAITING:2/2`, 'B8 참가 대기 먼저 · 준비 중 2/2 표시: ' + JSON.stringify(rows.map((r) => [r.roomId, r.state])));
  const stale = open('p-' + aOpen.roomId);
  const staleF = await first(stale);
  ok(staleF && staleF.type === 'error' && staleF.code === 'E_ROOM_NOT_FOUND', 'B8 목록에 보여도 준비 중 방 참가 거부');

  // 재접속 — 서버가 들고 있는 이름
  a.ws.close();
  await sleep(100);
  const ar = open(`r-${aOpen.epoch}.${aOpen.seatToken}`);
  const resumed = await first(ar);
  ok(resumed && resumed.type === 'room_resumed' && resumed.roomName === '테스트 Room_1', 'B9 재접속 첫 프레임 roomName: ' + JSON.stringify(resumed && resumed.roomName));

  // 대전 중 표시 · 끝난 방 제외 (상태만 옮겨 목록 필터를 본다 — 경기 진행 경로는 기존 테스트가 맡는다)
  const roomA = lobby.getRoom(aOpen.roomId);
  roomA.state = STATES.IN_PROGRESS;
  rows = await list(viewer);
  ok(rows.some((r) => r.roomId === aOpen.roomId && r.state === 'IN_PROGRESS'), 'B10 대전 중 표시');
  for (const s of [STATES.FINISHED, STATES.CANCELED, STATES.VOID, STATES.CLOSED]) {
    roomA.state = s;
    rows = await list(viewer);
    ok(!rows.some((r) => r.roomId === aOpen.roomId), 'B10 목록에서 제외: ' + s);
  }

  for (const x of [ar, b, p, c, viewer, bGuest, ga, g1, g2, stale]) x.ws.close();
  console.log(`#261 lobby: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
