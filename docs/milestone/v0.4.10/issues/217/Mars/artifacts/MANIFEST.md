# #217/#218 실브라우저 증빙 매니페스트 (Mars)

모든 캡처는 CDP(Chrome DevTools Protocol)로 구동한 독립 Edge 두 인스턴스(`demo/test/browser/run_full_e2e.js`)의
실제 렌더 결과다. 서버는 `node server/authoritative/server.js`(포트 8081, `npm start`와 동일)를 매 재현 전에
새로 기동했다. 재현 명령: `node demo/test/browser/run_full_e2e.js` (repo root에서 실행).

세션 비밀값(seatToken 등)은 화면에 렌더되지 않는다 — WebSocket 하위 프로토콜 헤더로만 전송되고 페이지
어디에도 표시하지 않는 기존 계약(§ demo/index.html netOpenCredentialSocket 주석)을 그대로 따른다.

| 파일 | 좌석 | 실제 viewport | URL | 화면 | 재현 단계 | 기대 결과 | 실제 결과 |
|---|---|---|---|---|---|---|---|
| 01_lobby_host.png | host(P1) | 496×808 (CDP window-size 520×900) | http://127.0.0.1:8081/index.html | 모드 메뉴(로비) | 튜토리얼 건너뛰기 → 대전 시작 클릭 | 공개 대전 카드가 PVE/PVP보다 먼저 보임 | 일치 — `.lobbyCard.net`이 최상단 |
| 02_roster_host.png | host(P1) | 496×808 | 〃 | 로스터 선택(0/6) | "새 방 만들기" 클릭 | 20종 카드 그리드 표시 | 일치 |
| 02_roster_guest.png | guest(P2) | 496×808 | 〃 | 로스터 선택(0/6) | 방 목록 새로고침 → 참가(정확 일치, "코드로 참가"와 구분) 클릭 | 같은 그리드, 별도 좌석 | 일치 |
| 03_placed_host.png | host(P1) | 496×808 | 〃 | 비공개 배치(14/14) | 로스터 6종 선택 → 무작위 배치 클릭 | 14개 말이 자기 진영에 배치 | 일치 |
| 04_ready_host.png | host(P1) | 496×808 | 〃 | 방 대기(준비 완료) | 배치 완료 → 준비 완료 클릭 | "상대: 입장 대기" 배지 | 일치 |
| 04_ready_guest.png | guest(P2) | 496×808 | 〃 | 실제 대국(1턴) | guest 준비 완료 클릭 직후 | host-join-notify로 즉시 phase:play 전환 | 일치 — guest가 선공 1턴으로 바로 진입 |
| 05_play_host.png | host(P1) | 496×808 | 〃 | 실제 대국 보드 | `#phaseLabel`에 "턴" 텍스트 포함될 때까지 대기 후 캡처 | 실제 스프라이트 렌더(§3-2 아트 복원) | 일치 — 자기 말 9개 실아이콘 |
| 05_play_guest.png | guest(P2) | 496×808 | 〃 | 실제 대국 보드 | 〃 | 마스킹된 상대칸("?") + 공개된 내 말 아이콘 | 일치 |
| 08_info_hiding_check.json | host(P1) | — | 〃 | DOM 콘솔 검사 결과(스크립트 자동 실행) | `document.querySelectorAll('.cell')`로 "?" 칸 14개 필터 → `querySelector('img')` 유무·outerHTML의 `assets/minions` 포함 여부 확인 | 미공개 칸 img 0·자산 경로 0, 내 말 img>0 | `{"qCells":14,"withImg":0,"leaks":false,"ownImgs":9}` — 일치 |

## 재현 명령 (DOM 정보 은닉 검사, 콘솔에 직접 붙여넣기 가능)
```js
JSON.stringify({
  qCells: [...document.querySelectorAll('.cell')].filter(c=>c.textContent.trim()==='?').length,
  withImg: [...document.querySelectorAll('.cell')].filter(c=>c.textContent.trim()==='?').filter(c=>c.querySelector('img')).length,
  leaks: [...document.querySelectorAll('.cell')].filter(c=>c.textContent.trim()==='?').map(c=>c.outerHTML).join('|').includes('assets/minions'),
  ownImgs: document.querySelectorAll('.cell img').length,
})
```

## 잔여 (이 매니페스트 갱신 예정)
- 전투 무대(접촉·battle overlay) 캡처 — `run_full_e2e.js`가 실제 클릭으로 접촉을 시도 중(진행 중, §report.md §6).
- 결과(승패) 화면 — 접촉 실패 시 기권 경로로 확보 예정이며, "전투 PASS"로 대체 기재하지 않는다(PD 지시).
- 재접속 — `Network.emulateNetworkConditions({offline:true})`로 서버·방을 살려둔 채 guest만 단절시키고,
  동일 방·좌석·revision 수렴까지 확인할 예정(단순 "재접속" 문구 소실은 증거로 삼지 않는다, PD 지시).
- 이전(구 mutation/재시작 전) 캡처는 이 매니페스트에 포함하지 않았다 — 전부 이번 재현 기준 최신본이다.
