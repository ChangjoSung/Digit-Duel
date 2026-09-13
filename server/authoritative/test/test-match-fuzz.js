'use strict';
// #217 v4 — 룸 API만으로 실제 매치를 끝까지 둔다(시드 고정 퍼즈). 축소판이 아니라 원본 엔진의 이동·전투(기술·아이템·볼·
// 도망·패키지)·동기화 모달(출전 선택·전투 시작·탐색 보상·패키지)·도망 교환·텔레포트·회복·탐색·강제 전투·기권 없는 왕 격파까지.
// 매 단계 불변식:
//   (1) 두 좌석 엔진의 규칙 상태가 락스텝으로 일치한다(불일치면 룸이 VOID — E_INTERNAL로 드러난다).
//   (2) 행위자가 아닌 좌석의 잡음 입력은 절대 수락되지 않고 revision·상태를 바꾸지 않는다.
//   (3) 상태가 바뀐 성공 명령은 revision을 정확히 +1, noop·거부는 0.
//   (4) 좌석 뷰(자기 you 영역 제외)에 상대의 미공개 말 정체(이름)가 나타나지 않는다 — 로그·전투 로그·모달 포함.
// 사용: node test-match-fuzz.js [--seeds N] [--steps N]
const H = require('./helpers');
const { STATES } = H;
const { ok, done } = H.makeCounter('match-fuzz');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
const SEEDS = opt('--seeds', 6), STEPS = opt('--steps', 1500);

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const CAT = H.createEngine();
const ROSTER_IDS = CAT.ROSTER.map((x) => x.id);

function randomSetup(rnd) {
  const ids = ROSTER_IDS.slice(); const roster = [];
  while (roster.length < 6) roster.push(ids.splice(Math.floor(rnd() * ids.length), 1)[0]);
  const cells = []; for (const r of [11, 12, 13]) for (let c = 1; c <= 7; c++) cells.push([r, c]);
  const pos = []; while (pos.length < 14) pos.push(cells.splice(Math.floor(rnd() * cells.length), 1)[0]);
  return { roster, pos };
}

function chooseAction(room, rnd) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const T = room.engine, S = T.S;
  const pm = room._pendingModal();
  if (pm) {
    const en = pm.disabled.map((d, k) => (d ? -1 : k)).filter((k) => k >= 0);
    return { seat: pm.owner, a: { t: 'modal', seq: pm.seq, i: pick(en) }, kind: 'modal' };
  }
  if (S.fleePick) {
    const seat = S.fleePick.owner;
    const cands = room.toSeatView(seat).fleePick.cands;
    return { seat, a: rnd() < 0.4 || !cands.length ? { t: 'fleeSkip' } : { t: 'fleeSwap', id: pick(cands) }, kind: 'flee' };
  }
  if (S.battle) {
    const B = S.battle; const side = T.actorOfPhase(); const seat = side === 'A' ? B.attP.owner : B.defP.owner;
    const f = side === 'A' ? B.fa : B.fd;
    const slots = f.skills ? [0, 1, 2, 3].filter((k) => T.slotUsable(f, k, side)) : [];
    const r = rnd();
    let a;
    if (r < 0.04) a = { t: 'flee' };
    else if (r < 0.1) a = { t: 'ball' };
    else if (r < 0.16 && S.inv[seat].length) a = { t: 'item', i: Math.floor(rnd() * S.inv[seat].length) };
    else if (r < 0.22) a = { t: 'pkgOpen', kind: pick(['itemGift', 'battleBuff']) };
    else if (f.skills) a = slots.length ? { t: 'act', k: pick(slots) } : { t: 'pass' };
    else a = { t: 'act', k: rnd() < 0.8 ? 'basic' : 'skill' };
    return { seat, a, kind: 'battle' };
  }
  const me = S.current;
  const view = room.toSeatView(me);
  if (S.forcedTargets.length) {
    const tid = pick(S.forcedTargets);
    const t = T.S.pieces.find((p) => p.id === tid);
    return { seat: me, a: { t: 'cell', r: t.r, c: t.c }, kind: 'forced' };
  }
  if (S.teleport) {
    const mine = view.you.pieces;
    const p = pick(mine);
    return { seat: me, a: rnd() < 0.15 ? { t: 'tele' } : { t: 'cell', r: p.r, c: p.c }, kind: 'tele' };
  }
  const atk = [];
  for (const p of T.alivePieces().filter((x) => x.owner === me)) {
    for (const e of T.alivePieces()) if (e.owner !== me && Math.abs(e.r - p.r) + Math.abs(e.c - p.c) === 1 && T.visibleTo(me, e) && T.canBattle(p, e)) atk.push([p, e]);
  }
  const selAtk = atk.filter(([p]) => S.selected && S.selected.id === p.id);
  if (selAtk.length && rnd() < 0.85) { const [, e] = pick(selAtk); return { seat: me, a: { t: 'cell', r: e.r, c: e.c }, kind: 'attack' }; }
  if (atk.length && rnd() < 0.6) { const [p] = pick(atk); return { seat: me, a: { t: 'cell', r: p.r, c: p.c }, kind: 'select' }; }
  if (S.mainUsed) return { seat: me, a: { t: 'endTurn' }, kind: 'end' };
  const r = rnd();
  const sel = view.you.selected;
  if (r < 0.06) return { seat: me, a: { t: 'tele' }, kind: 'tele' };
  if (r < 0.1 && sel) return { seat: me, a: { t: 'heal', id: sel }, kind: 'heal' };
  const selPiece = sel ? view.you.pieces.find((p) => p.id === sel) : null;
  if (selPiece && view.events.some((e) => e.r === selPiece.r && e.c === selPiece.c) && rnd() < 0.8) return { seat: me, a: { t: 'search' }, kind: 'search' };
  if (r < 0.12 && sel) return { seat: me, a: { t: 'search' }, kind: 'search' };
  const cands = [];
  for (const p of T.alivePieces().filter((x) => x.owner === me && x.immobile === 0 && x.type !== 'trap')) {
    for (let rr = 1; rr <= 13; rr++) for (let c = 1; c <= 7; c++) if (T.canMoveTo(p, rr, c)) cands.push([p, rr, c]);
  }
  if (!cands.length) return { seat: me, a: { t: 'skipMain' }, kind: 'skip' };
  const fwd = cands.filter(([p, rr]) => (me === 0 ? p.r - rr : rr - p.r) > 0);
  const [p, rr, c] = fwd.length && rnd() < 0.7 ? pick(fwd) : pick(cands);
  const selected = S.selected && !S.selected.tray && S.selected.id === p.id;
  return { seat: me, a: selected ? { t: 'cell', r: rr, c } : { t: 'cell', r: p.r, c: p.c }, kind: 'move' };
}

// 좌석 X의 뷰(자기 you 영역 제외)에 나타나면 안 되는 이름: 상대의 살아 있는 미공개 말 이름 중,
// 지금까지 공개적으로 드러난 적이 있거나(공개 말·전투원) 좌석 X 자신의 말 이름과 겹치는 것은 제외한다(같은 종일 수 있다).
function privacyViolation(room, seat, publicNames) {
  const T = room.engines[seat];
  const S = T.S;
  const own = new Set();
  for (const p of S.pieces) if (p.owner === seat && p.name) own.add(p.name);
  for (const p of S.pieces) if (p.owner === seat && p.cap && p.cap.name) own.add(p.cap.name);
  if (S.reserve[seat] && S.reserve[seat].name) own.add(S.reserve[seat].name);
  const forbidden = [];
  for (const p of S.pieces) {
    if (p.owner === seat || !p.alive || !p.placed || p.revealed || !p.name) continue;
    if (publicNames.has(p.name) || own.has(p.name)) continue;
    forbidden.push(p.name);
  }
  if (!forbidden.length) return null;
  const v = room.toSeatView(seat);
  // 자기 소유 모달(탐색 발견·포획 등)의 문구는 원본이 소유자에게만 그리는 자기 정보다 — 같은 종 이름이 우연히 겹칠 수 있어 제외한다.
  const modal = v.modal && v.modal.owner === seat ? { seq: v.modal.seq, owner: v.modal.owner, count: v.modal.count } : v.modal;
  const outside = JSON.stringify(Object.assign({}, v, { you: undefined, modal }));
  const hit = forbidden.find((n) => outside.indexOf(n) !== -1);
  return hit ? { name: hit, where: outside.slice(Math.max(0, outside.indexOf(hit) - 120), outside.indexOf(hit) + 40) } : null;
}

function notePublic(room, publicNames) {
  for (const T of room.engines) {
    for (const p of T.S.pieces) {
      if (p.revealed && p.name) publicNames.add(p.name);
      if (p.revealed && p.cap && p.cap.name) publicNames.add(p.cap.name);
    }
    const B = T.S.battle;
    if (B) for (const f of [B.fa, B.fd, B.attP, B.defP]) if (f && f.name) publicNames.add(f.name);
  }
}

function run(seed) {
  const rnd = lcg(seed);
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const room = H.setupRoom(seed, { seed: seed * 2654435761 >>> 0 }); // 엔진 시드 고정 — 실패 시드를 그대로 재현
  room._handleSetup(0, randomSetup(rnd)); room._handleSetup(1, randomSetup(rnd));
  room._handleReady(0, true); room._handleReady(1, true);
  const stat = { seed, steps: 0, accepted: 0, noop: 0, rejected: 0, kinds: {}, noise: 0, turn: 0, state: null, result: null, err: null };
  if (room.state !== STATES.IN_PROGRESS) { stat.err = 'did not start ' + JSON.stringify(room.lastFault); return stat; }
  const publicNames = new Set();
  for (let i = 0; i < STEPS && room.state === STATES.IN_PROGRESS; i++) {
    stat.steps++;
    notePublic(room, publicNames);
    const choice = chooseAction(room, rnd);
    // (2) 비행위자 잡음
    if (rnd() < 0.25) {
      stat.noise++;
      const other = 1 - choice.seat;
      const before = H.snap(room);
      const noise = pick([{ t: 'skipMain' }, { t: 'endTurn' }, { t: 'act', k: 0 }, { t: 'act', k: 'basic' }, { t: 'tele' }, { t: 'cell', r: 7, c: 4 },
        { t: 'flee' }, { t: 'fleeSkip' }, { t: 'pass' }, { t: 'modal', seq: room.engine.NET.modalSeq, i: 0 }, { t: 'heal', id: 'u-x' }]);
      const res = H.act(room, other, noise);
      if (res.ok) { stat.err = `step ${i}: non-actor seat ${other} ${JSON.stringify(noise)} accepted (actor ${choice.seat})`; break; }
      if (H.snap(room) !== before) { stat.err = `step ${i}: rejected noise changed state`; break; }
    }
    const rev = room.revision;
    const res = H.act(room, choice.seat, choice.a);
    stat.kinds[choice.kind] = (stat.kinds[choice.kind] || 0) + 1;
    if (!res.ok) {
      stat.rejected++;
      if (res.reason === 'E_INTERNAL') { stat.err = `step ${i}: E_INTERNAL ${JSON.stringify(choice.a)} ${JSON.stringify(room.lastFault)}`; break; }
      if (res.reason === 'E_NOT_ACTOR') { stat.err = `step ${i}: actor seat rejected E_NOT_ACTOR ${JSON.stringify(choice.a)}`; break; }
      if (room.revision !== rev) { stat.err = `step ${i}: rejection changed revision`; break; }
    } else if (res.noop) {
      stat.noop++;
      if (room.revision !== rev) { stat.err = `step ${i}: noop changed revision`; break; }
    } else {
      stat.accepted++;
      if (room.revision !== rev + 1) { stat.err = `step ${i}: accepted change revision delta ${room.revision - rev}`; break; }
    }
    if (room.state === STATES.IN_PROGRESS && H.lockstepDigest(room.engines[0]) !== H.lockstepDigest(room.engines[1])) { stat.err = `step ${i}: lockstep digest mismatch left open`; break; }
    // #217 Mars 델타(msg_db7a8fa06aee) — FINISHED(원본 index.html:1705 viewer===2, "#11 종료 리빌")는 승패가
    // 갈리는 바로 그 스텝에서 의도적으로 미공개 상대 전 병력의 이름·정체를 드러낸다. 이 불변식은 "경기 중"
    // 마스킹만 검증하므로 FINISHED로 전이한 스텝은 제외한다 — CANCELED/VOID/CLOSED 등 다른 종료는 board 자체가
    // 비므로(TERMINAL_NO_BOARD) room.engines가 이미 null이라 애초에 이 분기에 들어오지 않는다.
    if (room.engines && room.state !== STATES.FINISHED) {
      notePublic(room, publicNames);
      for (const seat of [0, 1]) {
        const leak = privacyViolation(room, seat, publicNames);
        if (leak) { stat.err = `step ${i}: seat ${seat} view leaks hidden opponent name ${JSON.stringify(leak)}`; break; }
      }
      if (stat.err) break;
    }
  }
  stat.state = room.state; stat.result = room.result; stat.turn = room.engines ? room.engine.S.turnCount : null;
  return stat;
}

const t0 = Date.now();
const results = [];
for (let s = 1; s <= SEEDS; s++) results.push(run(7000 + s));
const agg = { kinds: {}, finished: 0, accepted: 0, rejected: 0, noop: 0, noise: 0 };
for (const r of results) {
  console.log(`seed ${r.seed}: steps=${r.steps} turn=${r.turn} state=${r.state} result=${JSON.stringify(r.result)} accepted=${r.accepted} noop=${r.noop} rejected=${r.rejected} noise=${r.noise}${r.err ? '\n   ✗ ' + r.err : ''}`);
  ok(!r.err, `seed ${r.seed} 불변식 유지: ${r.err || ''}`);
  if (r.state === STATES.FINISHED) agg.finished++;
  for (const k of Object.keys(r.kinds)) agg.kinds[k] = (agg.kinds[k] || 0) + r.kinds[k];
  agg.accepted += r.accepted; agg.rejected += r.rejected; agg.noop += r.noop; agg.noise += r.noise;
}
console.log('coverage', JSON.stringify(agg), `${Date.now() - t0}ms`);
ok(agg.finished >= 1, '적어도 한 매치는 왕 격파 등으로 FINISHED까지 완주: ' + agg.finished);
for (const k of ['modal', 'battle', 'flee', 'move', 'end', 'heal', 'search', 'tele']) ok((agg.kinds[k] || 0) > 0, `퍼즈가 ${k} 경로를 실제로 지남: ${agg.kinds[k] || 0}`);
ok(agg.noise > 100, '비행위자 잡음 입력이 충분히 주입됨: ' + agg.noise);

done();
