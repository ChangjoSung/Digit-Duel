// #217/#218 CDP 실브라우저 E2E 실행기 (Mars 소유). demo/test/browser/cdp_e2e.js 사용.
// 실행: node demo/test/browser/run_full_e2e.js
'use strict';
const { Session, waitFor, skipTutorialAndStart, pickRoster, tryOneMove, OUT_DIR } = require('./cdp_e2e');

function log(...a) { console.log('[run]', new Date().toISOString().slice(11, 19), ...a); }

(async () => {
  const runId = Date.now();
  const portBase = 20000 + (runId % 5000);
  const host = new Session('host', portBase, `C:/dd_cdp/host_${runId}`);
  const guest = new Session('guest', portBase + 1, `C:/dd_cdp/guest_${runId}`);
  await host.launch();
  await guest.launch();

  await host.navigate('http://127.0.0.1:8081/index.html');
  await guest.navigate('http://127.0.0.1:8081/index.html');
  await host.screenshot('00_pre_skip_debug');
  const dbg = await host.rectOfText('button', '건너뛰기');
  log('debug rectOfText before skip:', JSON.stringify(dbg));
  await skipTutorialAndStart(host);
  await skipTutorialAndStart(guest);
  await host.screenshot('01_lobby');
  log('both at lobby');

  await host.clickText('button', '새 방 만들기');
  await host.screenshot('02_roster_host');
  await pickRoster(host, 6);
  await host.clickText('button', '무작위 배치');
  await host.screenshot('03_placed_host');
  await host.clickText('button', '준비 완료');
  await host.screenshot('04_ready_host');
  log('host created+ready');

  await guest.clickText('button', '새로고침');
  await waitFor(() => guest.rectOfText('button', '참가', true), 8000, 300);
  await guest.clickText('button', '참가', true);
  await guest.screenshot('02_roster_guest');
  await pickRoster(guest, 6);
  await guest.clickText('button', '무작위 배치');
  await guest.clickText('button', '준비 완료');
  await guest.screenshot('04_ready_guest');
  log('guest joined+ready');

  // 두 클라이언트 모두 phase:play 전환 확인 (#phaseLabel 텍스트로 판정 — 내부 상태 조작 아님, 읽기만).
  await waitFor(() => host.evaluate(`document.getElementById('phaseLabel')?.textContent.includes('턴')`), 15000, 400);
  await waitFor(() => guest.evaluate(`document.getElementById('phaseLabel')?.textContent.includes('턴')`), 15000, 400);
  await host.screenshot('05_play_host');
  await guest.screenshot('05_play_guest');
  log('both in play phase');

  // DOM 정보 은닉 실증 (§8과 동일한 점검을 스크립트로 재현).
  const hideCheck = await host.evaluate(`(() => {
    const qCells=[...document.querySelectorAll('.cell')].filter(c=>c.textContent.trim()==='?');
    const withImg=qCells.filter(c=>c.querySelector('img')).length;
    const leaks=qCells.map(c=>c.outerHTML).join('|').includes('assets/minions');
    const ownImgs=document.querySelectorAll('.cell img').length;
    return {qCells:qCells.length, withImg, leaks, ownImgs};
  })()`);
  log('info-hiding check:', JSON.stringify(hideCheck));
  require('fs').writeFileSync(require('path').join(OUT_DIR, 'info_hiding_check.json'), JSON.stringify(hideCheck, null, 2));

  // 턴 루프: 접촉/전투가 열릴 때까지 번갈아 실제 클릭으로 이동. 최대 40턴(왕복 20회씩)으로 시간 상한을 둔다.
  let battled = false;
  for (let turn = 0; turn < 40 && !battled; turn++) {
    const active = turn % 2 === 0 ? host : guest;
    const other = turn % 2 === 0 ? guest : host;
    // 내 턴인지 확인: 헤더에 "나의 턴" 문구가 있는지 (읽기 전용 판정).
    const myTurn = await active.evaluate(`document.getElementById('phaseLabel')?.textContent.includes('나(')`);
    if (!myTurn) { await new Promise((r) => setTimeout(r, 400)); continue; }
    const result = await tryOneMove(active);
    log('turn', turn, active.name, JSON.stringify(result));
    if (result.battled) { battled = true; await new Promise((r) => setTimeout(r, 600)); break; }
    await new Promise((r) => setTimeout(r, 500));
  }
  await host.screenshot(battled ? '06_battle_host' : '06_noBattle_host');
  await guest.screenshot(battled ? '06_battle_guest' : '06_noBattle_guest');
  log('battle loop done, battled=', battled);

  // 재접속 실증 — PD 지시(msg_c781754ca42a): 대국이 IN_PROGRESS일 때(기권 전에) 해야 하고, "재접속" 문구
  // 소실만으로는 성공 증거가 아니다 — 같은 방(roomId)·같은 좌석(me)·revision 수렴(끊기기 전보다 뒤로 가지
  // 않음)까지 실제로 비교한다. NET.seatToken(비밀값)은 절대 읽거나 기록하지 않는다.
  try {
    const pre = await guest.evaluate(`({roomId:NET.roomId, me:NET.me, revision:NET.revision, phase:document.getElementById('phaseLabel')?.textContent||''})`);
    log('reconnect pre-state (no secrets):', JSON.stringify(pre));
    await guest.setOffline(true);
    // 버그 수정: document.body.textContent는 인라인 <script> 소스 텍스트까지 포함해 "재접속" 문자열이
    // 코드 주석/문자열 리터럴만으로도 항상 매치되는 거짓양성이 있었다(단일 파일 앱이라 script가 body 안에
    // 있다). #sidePanel(실제 렌더된 UI만)로 좁힌다 — 재접속 화면은 `<h2>🌐 재접속 중…</h2>`로 그 안에만 있다.
    await waitFor(() => guest.evaluate(`document.getElementById('sidePanel')?.textContent.includes('재접속 중')`), 15000, 500);
    await guest.screenshot('08_reconnecting_guest');
    log('reconnect UI confirmed (offline)');
    await guest.setOffline(false);
    await waitFor(() => guest.evaluate(`!document.getElementById('sidePanel')?.textContent.includes('재접속 중')`), 20000, 500);
    await new Promise((r) => setTimeout(r, 1200));
    const post = await guest.evaluate(`({roomId:NET.roomId, me:NET.me, revision:NET.revision, phase:document.getElementById('phaseLabel')?.textContent||''})`);
    log('reconnect post-state (no secrets):', JSON.stringify(post));
    const sameRoom = pre.roomId != null && pre.roomId === post.roomId;
    const sameSeat = pre.me === post.me;
    const revisionOk = typeof post.revision === 'number' && post.revision >= pre.revision;
    const converged = sameRoom && sameSeat && revisionOk;
    log('reconnect verified (sameRoom/sameSeat/revisionOk):', sameRoom, sameSeat, revisionOk, '=>', converged);
    require('fs').writeFileSync(require('path').join(OUT_DIR, 'reconnect_check.json'), JSON.stringify({ pre, post, sameRoom, sameSeat, revisionOk, converged }, null, 2));
    await guest.screenshot('09_reconnected_guest');
    // 호스트 쪽도 같은 시점에 같은 방/진행 상태를 계속 보고 있는지 확인 (재접속이 상대 쪽 상태를 깨지 않았는지).
    const hostState = await host.evaluate(`({roomId:NET.roomId, phase:document.getElementById('phaseLabel')?.textContent||''})`);
    log('host state after guest reconnect (no secrets):', JSON.stringify(hostState));
    await host.screenshot('09_reconnected_host_view');
  } catch (e) {
    log('reconnect test failed:', e.message);
    await guest.setOffline(false).catch(() => {});
  }

  if (!battled) {
    // 전투에 이르지 못했으면 기권으로 결과 화면까지는 확보한다 (전투 PASS로 대체 기재하지 않는다, PD 지시).
    try {
      await host.clickText('button', '기권');
      await new Promise((r) => setTimeout(r, 300));
      const confirmRect = await host.rectOfText('button', '기권');
      if (confirmRect) await host.click(confirmRect.x, confirmRect.y);
      await new Promise((r) => setTimeout(r, 800));
      await host.screenshot('07_result_host');
      await guest.screenshot('07_result_guest');
      log('resigned to reach result screen (NOT a battle-overlay pass)');
    } catch (e) { log('resign attempt failed:', e.message); }
  }

  log('DONE. screenshots in', OUT_DIR);
  await host.close();
  await guest.close();
  process.exit(0);
})().catch((e) => { console.error('[run] FATAL', e); process.exit(1); });
