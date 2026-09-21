'use strict';
/* #245 회선 호환 직렬화 — 공개 방 동기화 모달.
 *
 * 무엇인가: 권위 런타임은 이제 규칙 3종(data·state·core)만 싣는다. 종전에 이 화면들을 그리던 ui.js 는 서버에
 * 없다. 그런데 **공개 방 프로토콜과 클라이언트는 바뀌지 않았다** — 클라이언트는 여전히 toSeatView().modal 의
 * {seq,owner,count} 와 소유자 전용 {html,buttons} 를 받고, {t:"modal",seq,i} 로 버튼 자리를 되돌려 보낸다.
 * 그 계약을 그대로 유지하려고 이 파일이 **Core 가 이미 확정해 둔 결정 상태**만 읽어 같은 모양을 만든다.
 *
 * 무엇이 아닌가: 두 번째 규칙 엔진이 아니다. 여기에는 합법성 판정도, 난수도, 상태 전이도 없다.
 *   - 어느 화면이 떠 있는가 = Core 상태가 정한다 (S.entryPick · S.battle.pkgSel · S.recruit).
 *   - 버튼을 누르면 무엇이 일어나는가 = Core 액션 하나를 그대로 되돌려 보낸다 (아래 act 필드). 판정은 reducer 가 한다.
 *   - disabled 는 **Core 가 이미 상태로 들고 있는 사실**(재고·볼 개수·보유 기술·생사·라운드)을 그대로 읽어 표시한다.
 *     여기서 막지 않아도 reducer 가 같은 이유로 거부한다 — 이 값은 회선 표시와 room.js 의 종전 버튼 게이트용이다.
 * 문구·마크업은 종전 ui.js 가 회선으로 내보내던 것과 같아야 하는 **호환 자산**이다(클라이언트가 그대로 그린다).
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ESC[c]);

// 버튼 한 자리 — text/disabled 는 회선 모양, act 는 그 자리가 되돌려 보낼 Core 액션(비활성이면 null).
const btn = (text, act, disabled) => ({ text, disabled: !!disabled, act: disabled ? null : act });

// ===== 출전 선택 (#12 대리 출전) — S.entryPick 이 그 보류 결정이다 =====
function entryModal(T) {
  const S = T.S, EP = S.entryPick;
  if (!EP) return null;
  const att = S.pieces.find((x) => x.id === EP.attId), def = S.pieces.find((x) => x.id === EP.defId);
  if (!att || !def) return null;
  if (EP.stage === 'reveal') {
    const fa = EP.A === 'cap' ? att.cap : att, fd = EP.D === 'cap' ? def.cap : def;
    const name = (f, p) => (f === p ? T.TYPE_KO[p.type] : '포획 하수인(' + T.ELEM_KO[f.element] + ')');
    const desc = `공격: ${name(fa, att)} vs 방어: ${name(fd, def)}`;
    return {
      key: 'entry:reveal', owner: T.netActor(),
      html: `<h2>출전 공개</h2><p>${esc(desc)}</p>`,
      buttons: [btn('전투 시작', { t: 'battleEntryGo' })],
    };
  }
  const side = EP.stage, piece = side === 'A' ? att : def;
  // entryStep() 이 사람에게 묻는 단계에서만 멈춘다 — 그 조건 그대로 읽는다(판정이 아니라 같은 상태 읽기).
  const res = (!piece.cap && S.reserve[piece.owner]) ? S.reserve[piece.owner] : null;
  if (!(piece.type === 'ally' || piece.type === 'king') || (!piece.cap && !res)) return null;
  const sub = res
    ? `예비 하수인(${T.ELEM_KO[res.element]}) HP ${res.hp}/${res.maxHp} 대리 출전`
    : `포획 하수인(${T.ELEM_KO[piece.cap.element]}) HP ${piece.cap.hp}/${piece.cap.maxHp} 출전`;
  return {
    key: 'entry:' + side, owner: piece.owner,
    html: `<h2>🔒 ${esc(T.pname(piece.owner))}만 확인</h2>\n        <p>${esc(T.TYPE_KO[piece.type])} 출전 선택 — 어느 쪽이 패배해도 ${piece.type === 'king' ? '경기 패배' : '동료·포획 하수인 동시 제거'}입니다.</p>`,
    buttons: [
      btn('본체 출전', { t: 'battleEntryPick', side, what: 'body' }),
      btn(sub, { t: 'battleEntryPick', side, what: 'cap' }),
    ],
  };
}

// ===== 패키지 개봉 (#121) — 그 표(B.pkgSel)가 곧 이 화면의 존재 근거다 =====
function pkgModal(T) {
  const S = T.S, B = S.battle, sel = B && B.pkgSel;
  if (!sel) return null;
  const own = sel.owner, id = sel.id;
  const frame = () => T.battleCmdFrame(S);
  if (sel.kind === 'itemGift') {
    const row = (k) => `<div class="fighter"><b>${esc(T.GIFT_KO[k])}</b><small>${k === 'ball' ? `보유 ${S.balls[own]} → ${S.balls[own] + 1}` : esc(T.ITEMS[k].desc)}</small></div>`;
    return {
      key: 'pkg:' + id, owner: own,
      html: `<h2>🎁 아이템 선물 패키지</h2><p>하나를 골라 지금 받습니다. 취소하면 패키지는 그대로 남습니다.</p>\n      ${T.GIFT_PICKS.map(row).join('')}`,
      buttons: T.GIFT_PICKS.map((k, i) => btn(T.GIFT_KO[k], { t: 'pkgPick', what: 'gift', i, id, frame: frame() }))
        .concat([btn('취소', { t: 'pkgCancel', id, frame: frame() })]),
    };
  }
  const r1 = sel.round === 1; // 계약 3.3: 시간의 수호자는 1라운드에만
  const row = (key) => `<div class="fighter"><b>${esc(T.BUFFS[key].ko)}</b><small>${esc(T.BUFFS[key].desc)}${key === 'time' && !r1 ? ' · <b>1라운드에만 선택 가능</b>' : ''}</small></div>`;
  return {
    key: 'pkg:' + id, owner: own,
    html: `<h2>✨ 전투 버프 패키지</h2><p>하나를 골라 이번 전투에만 적용합니다. 전투당 1개이며 취소하면 패키지는 그대로 남습니다.</p>\n    ${T.BUFF_KEYS.map(row).join('')}`,
    buttons: T.BUFF_KEYS.map((key, i) => {
      const no = key === 'time' && !r1;
      return btn(T.BUFFS[key].ko + (no ? ' (1R 전용)' : ''), { t: 'pkgPick', what: 'buff', i, id, frame: frame() }, no);
    }).concat([btn('취소', { t: 'pkgCancel', id, frame: frame() })]),
  };
}

// ===== 탐색 보상 (#129) — S.recruit 의 단계가 그대로 화면이다 =====
function skCard(T, sid, head, extra) {
  const sk = T.SKILLS[sid];
  return `<div class="fighter"><b>${esc(head)} ${esc(T.skillNameKo(sid, null))}</b><small>${sk.cls ? `<span class="badge">${esc(T.SKILL_CLS_KO[sk.cls])} 분류</span> ` : sk.el ? `<span class="badge el-${sk.el}">${esc(T.ELEM_KO[sk.el])}</span> ` : ''}${esc(T.SKILL_TIER_KO[sk.tier] || T.SKIND_KO[sk.kind])} · 위력 ${sk.pow ? sk.pow : '-'} · 쿨 ${sk.reaper ? '봉인' : sk.cd}<br>${esc(sk.desc)}${extra || ''}</small></div>`;
}

function recruitModal(T) {
  const S = T.S, st = T.recruitState(S);
  if (!st) return null;
  const R = st.R, p = st.p, rd = st.rd, own = R.owner, tk = R.token;
  const step = (label, s, i, disabled) => btn(label, { t: 'recruit', step: s, i, token: tk }, disabled);
  const tail = [step('← 뒤로', 'back', 0), step('포기', 'giveup', 0)];
  const key = (extra) => 'recruit:' + tk + ':' + R.stage + (extra === undefined ? '' : ':' + extra);

  if (R.stage === 'root') {
    const recv = T.capReceivers(own);
    return {
      key: key(), owner: own,
      html: `<h2>🌿 숲에서 무언가를 찾았다</h2><p>기술을 배우거나, 공용 하수인을 포획할 수 있습니다.<br><small>포기해도 이 칸은 다시 쓸 수 없습니다.</small></p>\n      <div class="fighter"><b>📘 기술 교체</b><small>신규 공용 기술 3종 중 하나를 직접 골라, 내 최초 하수인 6명 중 살아 있는 말의 4슬롯 어디든 바꿉니다.</small></div>\n      <div class="fighter"><b>🔴 하수인 포획</b><small>${recv.length ? `동료·왕 중 포획 슬롯이 빈 말 ${recv.length}기가 받을 수 있습니다 (보유 볼 ${S.balls[own]})` : '<b>포획 슬롯이 빈 동료·왕이 없습니다 — 포획 불가</b>'}</small></div>`,
      buttons: (T.V2_INTERP.recruitSkillSwap
        ? [step('📘 기술 교체', 'skills', 0)]
        : [btn('📘 기술 교체 (v0.4.11 과도기 — 닫힘)', null, true)])
        .concat(recv.length ? [step('🔴 하수인 포획', 'cap', 0)] : [])
        .concat([step('포기', 'giveup', 0)]),
    };
  }
  if (R.stage === 'skill') {
    const openFor = (sid) => T.rosterMinions(own).some((m) => m.alive && m.placed && m.skills && !m.skills.includes(sid));
    return {
      key: key(), owner: own,
      html: `<h2>📘 배울 기술 선택</h2><p>하나를 고르세요.<br><small>같은 말에 같은 기술을 두 번 장착할 수 없습니다.</small></p>\n      ${T.NEW_SKILLS.map((sid, i) => skCard(T, sid, `${i + 1}.`, openFor(sid) ? '' : ' <b>· 내 모든 하수인이 이미 보유</b>')).join('')}`,
      buttons: T.NEW_SKILLS.map((sid, i) => (openFor(sid)
        ? step(`${i + 1}. ${T.SKILLS[sid].ko}`, 'skill', i)
        : btn(`${i + 1}. ${T.SKILLS[sid].ko} (보유)`, null, true))).concat(tail),
    };
  }
  if (R.stage === 'target') {
    const ms = T.rosterMinions(own);
    const row = (m, i) => {
      const dead = !m.alive || !m.placed, has = m.skills && m.skills.includes(R.skill);
      return `<div class="fighter"><b>${i + 1}. ${esc(m.name || T.TYPE_KO.minion)}${m.element ? ` <span class="badge el-${m.element}">${esc(T.ELEM_KO[m.element])}</span>` : ''}</b>\n        <small>${dead ? '<b>제거됨 — 선택 불가</b>' : `HP ${m.hp}/${m.maxHp} · 공 ${m.atk} · 기술 ? ? ? ?`}${has ? ' · <b>이미 이 기술 보유</b>' : ''}</small></div>`;
    };
    return {
      key: key(R.skill), owner: own,
      html: `<h2>📘 ${esc(T.SKILLS[R.skill].ko)} — 대상 말</h2><p>이 기술을 배울 말을 고르세요. 고르면 그 말의 4슬롯이 보입니다.</p>\n      ${ms.map(row).join('')}`,
      buttons: ms.map((m, i) => {
        const sel = m.alive && m.placed && m.skills && !m.skills.includes(R.skill);
        const why = (!m.alive || !m.placed) ? '제거됨' : '이미 보유';
        return sel ? step(`${i + 1}. ${m.name || '하수인'}`, 'target', i)
          : btn(`${i + 1}. ${m.name || '하수인'} (${why})`, null, true);
      }).concat(tail),
    };
  }
  if (R.stage === 'slot') {
    const m = S.pieces.find((x) => x.id === R.targetId);
    if (!m || !m.alive || !m.skills) return null; // Core 의 entryStep 과 같은 자리 — 되돌림은 Core 가 소유한다
    return {
      key: key(R.targetId), owner: own,
      html: `<h2>📘 ${esc(T.SKILLS[R.skill].ko)} → ${esc(m.name || '하수인')}</h2><p>바꿀 슬롯을 고르세요.<br><small>새 기술은 그 자리의 남은 쿨타임을 이어받습니다.</small></p>\n      ${skCard(T, R.skill, '새 기술:')}\n      <p style="margin:6px 0 2px"><small>${esc(m.name || '하수인')}의 현재 4슬롯</small></p>\n      ${m.skills.map((sid, i) => skCard(T, sid, `슬롯 ${i + 1}:`, m.cds[i] ? ` · 남은 쿨 ${m.cds[i]}` : '')).join('')}`,
      buttons: m.skills.map((sid, i) => step(`슬롯 ${i + 1} 교체 (${T.SKILLS[sid].ko})`, 'slot', i)).concat(tail),
    };
  }
  if (R.stage === 'capRecv') {
    const recv = T.capReceivers(own);
    if (!recv.length) return null;
    return {
      key: key(), owner: own,
      html: `<h2>🔴 포획 하수인을 받을 말</h2><p>받을 말을 고르세요.<br><small>공격 포획이 실패하면 피해는 탐색한 ${esc(T.idLabel(own, p))}가 받습니다.</small></p>\n      ${recv.map((x, i) => `<div class="fighter"><b>${i + 1}. ${esc(T.TYPE_KO[x.type])}</b><small>HP ${x.hp}/${x.maxHp} · 포획 슬롯 비어 있음</small></div>`).join('')}`,
      buttons: recv.map((x, i) => step(`${i + 1}. ${T.TYPE_KO[x.type]}`, 'recv', i)).concat(tail),
    };
  }
  if (R.stage === 'capMode') {
    const b = S.balls[own], recv = S.pieces.find((x) => x.id === R.recvId);
    const opt = (name, cost, rate, risk) => `<div class="fighter"><b>${name}</b><small>볼 ${cost} · 성공 ${rate}${risk ? ' · ' + risk : ''}</small></div>`;
    return {
      key: key(R.recvId), owner: own,
      html: `<h2>🔴 포획 시도 (몬스터볼 ${b})</h2>\n      <div class="fighter"><b>발견: ${esc(rd.name)} <span class="badge el-${rd.element}">${esc(T.ELEM_KO[rd.element])}</span></b>\n        <small>HP ${rd.hp} · 공 ${rd.atk} · ⭐1 스킬 ${esc(T.speciesSkills(rd.id, 1).map((s) => T.SKILLS[s].ko).join('·'))} — 이 종의 ⭐1 수치·스킬로 합류합니다<br>받을 말: ${recv ? esc(T.TYPE_KO[recv.type]) : '-'}</small></div>\n      <small>공격 포획 실패 시 <b>탐색 말</b>이 최대 HP 25% 피해!</small>\n      ${opt('안전 포획', 2, '100%', '')}${opt('위험 포획', 1, '50%', '실패 시 소멸')}${opt('공격 포획', 1, '70%', '실패 시 소멸 + 탐색 말 HP 25% 피해')}`,
      buttons: [
        btn('안전 포획 (볼 2)', { t: 'recruit', step: 'mode', i: 0, token: tk }, b < 2),
        btn('위험 포획 (볼 1)', { t: 'recruit', step: 'mode', i: 1, token: tk }, b < 1),
        btn('공격 포획 (볼 1)', { t: 'recruit', step: 'mode', i: 2, token: tk }, b < 1),
      ].concat(tail),
    };
  }
  return null;
}

/* 지금 입력을 기다리는 동기화 모달 — Core 결정 상태에서 그대로 읽는다.
   셋은 서로 배타적이다(출전 선택은 전투 개시 전, 패키지는 전투 중, 탐색 보상은 전투 밖). 순서는 그 배타성을
   확인하는 자리이지 우선순위 규칙이 아니다. */
function pendingModal(T) {
  if (!T.S || T.S.phase !== 'play') return null;
  const m = entryModal(T) || pkgModal(T) || recruitModal(T);
  if (!m || m.owner !== 0 && m.owner !== 1) return null;
  return m;
}

/* ===== 회선 fx 배너 문구 — 종전 ui.js 가 같은 Core 이벤트를 받아 만들던 것과 같은 값 =====
   공개 방 클라이언트는 이 문구를 그대로 그린다. 규칙은 이미 끝났고, 여기 있는 것은 이미 확정된 사실
   (누구 말인가 · 접촉 종류 · 말 종류)을 문장으로 옮기는 일뿐이다 — 판정도 난수도 상태 변경도 없다. */
const TURN_MINE = '나의 턴!', TURN_OTHER = '상대 턴!';
function turnLabel(T, p) { return T.viewerIsOwner(p) ? TURN_MINE : TURN_OTHER; }

const BT_TITLE = '버닝타임입니다! 2칸씩 이동 가능합니다';
const BT_SUB = '직선 2칸 이동 강화 (폭탄 포함 · 함정 제외 · 적진·적 숲은 1칸)';
const TURN_SUB_MINE = '말 이동 / 수풀 탐색 / 말 회복 행동 중 하나를 실행하세요!';
const TURN_SUB_OTHER = '상대가 행동을 선택하고 있습니다';

// 4.3.2 접촉 상황 문구 — 행동자 화면 / 4.7 거울(상대 화면). 현행 로그가 이미 공개하는 사실만 담는다.
function contactText(T, att, def, mine) {
  const vip = (x) => x.type === 'ally' || x.type === 'king';
  const dName = T.TYPE_KO[def.type] || '말';
  if (att.type === 'bomb') {
    if (def.type === 'minion') return mine ? '폭탄이 터져 상대 하수인과 함께 제거됩니다.' : '상대 폭탄이 터져 내 하수인이 제거됩니다.';
    if (vip(def)) return mine ? '상대 말이 내 폭탄을 제거하였습니다.' : '내 말이 상대 폭탄을 제거하였습니다.';
    return mine ? '폭탄이 터져 상대 폭탄·함정과 함께 제거됩니다.' : '상대 폭탄이 터져 내 폭탄·함정과 함께 제거됩니다.';
  }
  if (def.type === 'bomb') {
    if (att.type === 'minion') return mine ? '폭탄이 터져 내 하수인이 제거됩니다.' : '내 폭탄이 터져 상대 하수인이 제거됩니다.';
    return mine ? '상대 폭탄이 터졌지만 내 말은 생존했습니다.' : '상대 말이 내 폭탄을 제거하였습니다.';
  }
  if (def.type === 'trap') {
    const a = att.type === 'minion' ? '하수인' : '말';
    return mine ? `함정에 걸려 내 ${a}의 이동이 2턴간 제한됩니다.` : `상대 ${a}이 내 함정에 걸렸습니다! (정체 공개 · 2턴 이동 불가)`;
  }
  if (mine) return vip(att) ? '배틀을 시작합니다. (출전을 선택하세요)' : '배틀을 시작합니다.';
  return `상대가 내 ${dName}에게 배틀을 걸었습니다.`;
}

const contactTitle = (mine, again) => (mine
  ? (again ? '⚠️ 상대 말 추가 접촉!' : '⚠️ 상대 말 접촉!')
  : (again ? '⚠️ 내 말 추가 접촉!' : '⚠️ 내 말 접촉!'));

/* Core 의 표시 이벤트 한 건 → 회선 fx 항목 0~2개. 반환값은 {key,kind,title,sub,cls} 목록이고
   순서는 종전 ui.js 호출 순서 그대로다(버닝타임 배너가 턴 배너보다 먼저). */
function fxItemsFor(T, ev) {
  const S = T.S;
  switch (ev.type) {
    case 'turnReady': {
      if (!S || S.phase !== 'play' || S.mode === 'sim') return [];
      const out = [];
      if (S.btBannerDue) {
        T.dispatchCoreAction({ t: 'btBannerShown' }); // 배너 예약 소비는 Core 가 소유한다 — 래치 수명은 종전 그대로
        out.push({ key: 'turnBanner', kind: 'bt', title: BT_TITLE, sub: BT_SUB });
      }
      const mine = T.viewerIsOwner(S.current);
      out.push({ key: 'turnBanner', kind: 'banner', cls: mine ? 'mine' : '', title: turnLabel(T, S.current),
        sub: mine ? TURN_SUB_MINE : TURN_SUB_OTHER });
      return out;
    }
    case 'contactBanner': {
      const mine = T.viewerIsOwner(ev.piece.owner), again = S.contactKind === 'again';
      const base = S.contactKind === 'collision' ? '이동 중 숨은 말과 충돌! 위치가 일시 공개되었습니다'
        : (S.contactKind === 'tele' ? '텔레포트로 새로 인접했습니다' : '');
      return [{ key: 'contactBanner', kind: 'contact', title: contactTitle(mine, again),
        sub: [base, ev.sub || ''].filter(Boolean).join('\n') }];
    }
    case 'contactSituation': {
      const mine = T.viewerIsOwner(ev.att.owner);
      return [{ key: 'contactBanner', kind: 'contact', title: contactTitle(mine, false), sub: contactText(T, ev.att, ev.def, mine) }];
    }
    case 'matchBanner':
      return [{ key: 'resultBanner', kind: 'result', cls: ev.banner.cls || '', title: ev.banner.title, sub: ev.banner.sub || '' }];
    case 'battleEndFx':
      return ev.banner ? [{ key: 'resultBanner', kind: 'result', cls: ev.banner.cls || '', title: ev.banner.title, sub: ev.banner.sub || '' }] : [];
    case 'searchBanner':
      return ev.title ? [{ key: ev.fxKey, kind: 'banner', title: ev.title, sub: ev.sub || '' }] : [];
    case 'fx':
      // explosion·trapFx 는 좌표까지 실은 완전한 이벤트를 S.__ddFxCells 훅이 그 자리에서 만든다(engine.js §5) — 중복 금지.
      return (ev.item.key === 'explosion' || ev.item.key === 'trapFx') ? [] : [ev.item];
    default:
      return [];
  }
}

module.exports = { pendingModal, fxItemsFor, turnLabel };
