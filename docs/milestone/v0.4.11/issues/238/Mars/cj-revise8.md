# #238 CJ 재수정 8항목 — Mars 구현·시각 증거 (2026-09-28)

- 작업: Mars_Client · Claude `claude-opus-5-5` · effort high · bypass (argv `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions`) · task_c94d975def31 / ctx_38e729d42fcb · PD GO 뒤 착수
- 원본: [PD 전달](../Mercury/cj-revise-8-items.md) · CJ 첨부 9장(직접 열람) · [Jupiter 대기방 계약](../Jupiter/cj-revise-contract.md) · [현행 계획 0절](../../../planning/2026-09-28-issue-238-ui-system.md)
- 표기: **[확정]** 실측·실행 결과 · **[추론]** Mars 해석 · **[미확정]** 검증하지 않은 것

## 1. 화면 매트릭스 (전 = 직전 Mars 실측·CJ 첨부 · 후 = 이번 오프라인 픽스처 실측)

| # | 변경 | 전 | 후 (320 · 432) | 실측 기하 [확정] |
|---|---|---|---|---|
| 1 | L02 ← 제목 앞(좌상단) · 방 만들기 창 제목 한 줄 · ✕ 44 정사각 · Esc/✕ → [생성] 초점 | CJ 이미지 1 · [l02-rooms-320](visual/l02-rooms-320.png) | [320](visual/cj8/k1-l02-create-320.png) · [432](visual/cj8/k1-l02-create-432.png) | ← x=18 < 제목 x=70 · 제목 높이 23px(한 줄) · ✕ 44×44 · 열면 초점 `roomName`, Esc 뒤 `roomMk` |
| 2 | L01 기록 아이콘 자리 = 전체 공식 `n승 n패` → 누르면 최근 20경기 창(인라인 기록·토글 없음) | CJ 이미지 2 · [l01-lobby-320](visual/l01-lobby-320.png) | [320](visual/cj8/k2-l01-320.png) · [창](visual/cj8/k2-l01-hist-320.png) | 배지 48×44 · 실제 탭 → 창 열림(초점 ✕) · Esc → 배지로 초점 복귀 |
| 3 | L03 WAITING: 참가자 [준비]/[준비 취소] · 방장 [시작](준비 전·상대 결과 확인 중·단절·카운트다운 중 비활성) · 서버 남은 ms 카운트다운 · 6종 이모티콘을 채팅 🔒 옆 | CJ 이미지 3 · [l03-wait-432](visual/l03-wait-432.png) | [방장 320](visual/cj8/k3-l03-host-ready-320.png) · [432](visual/cj8/k3-l03-host-ready-432.png) · [참가자 5초](visual/cj8/k3-l03-guest-countdown-320.png) · [이모티콘](visual/cj8/k3-l03-emote-320.png) | data-screen=room · 44px 미만 0 · 이모티콘 버튼 top = 채팅 줄 top · 겹침 0 · 1.3초 뒤 표시 4 |
| 4 | S01 왕 · 공격 동료 · 방어 동료 = 말 그림 + 속성 5, 선택 = 금색 테두리(aria-pressed) · "선택됨" 문장은 접근성 이름에만 | CJ 이미지 4 · [s01-shop-320](visual/s01-shop-320.png) | [320](visual/cj8/k4-s01-leaders-320.png) · [그림 32/64/128](visual/cj8/leaders-contact-32-64-128.png) | 3줄 순서 왕→공격→방어 · 그림 king/companion_atk/companion_def 64px 로드 |
| 5 | 전투 내 시너지 = 전투창 우상단(제목 줄 오른쪽) 아이콘+칸 수 · HP 카드 문장 삭제 · 달성 시너지만 · 상대 없음 | CJ 이미지 5 · [r3-b04-battle-320-new](visual/r3-b04-battle-320-new.png) | [320](visual/cj8/k5-b04-battle-320.png) · [432](visual/cj8/k5-b04-battle-432.png) | 제목 줄 높이 30px(44px 칩이 음수 여백이라 줄을 늘리지 않음 · 1차 캡처는 91px 로 넘쳐 수정) · 칩 3 · HP 카드 칩 0 |
| 6 | 시너지 칩(보드 HUD·S01/M01·전투·결과) 누르기/터치/Enter·Space → 이름 + 전 단계 실제 효과(달성 단계 강조) · Esc·바깥 누름 닫기 | CJ 이미지 7 · 종전 `#synWhy` 한 줄 | [전투 탭](visual/cj8/k6-b04-synhelp-tap-320.png) · [상점 탭](visual/cj8/k6-s01-synhelp-tap-320.png) · [보드 HUD](visual/cj8/k6-s03-board-320.png) | 실제 CDP 탭으로 열림 · Esc 뒤 초점 칩 복귀 |
| 7 | 공용 팝업(상점 완료·확인 등) 남색·파랑·금색 · 첫 버튼 금색 · 기권 빨강 테두리 · 전투창 제외 | CJ 이미지 8 | [상점 완료](visual/cj8/k7-popup-shopdone-320.png) · [확인](visual/cj8/k7-popup-confirm-320.png) | 가로 넘침 0 |
| 8 | 결과 카드 아래 최종 공개 말판 · 온라인 CTA **와 좌상단 ←(“← 방으로”)** = 같은 방 `netReturnToRoom`(`lobby_return`) · 오프라인 [로비로 돌아가기]·← 로비 (6절 정정) | CJ 이미지 9 · [r3-s04-result-320-new](visual/r3-s04-result-320-new.png) | [결과](visual/cj8/k8-s04-result-320.png) · [말판 320](visual/cj8/k8-s04-board-320.png) · [432](visual/cj8/k8-s04-board-432.png) · [온라인 CTA 320](visual/cj8/k8-s04-online-320.png) · [432](visual/cj8/k8-s04-online-432.png) | 320: 보드 304px · 칸 42.1px · 결과 카드 아래 · 432: 376px · 52px |

기하 원자료: [cj8-geometry.json](visual/cj8/cj8-geometry.json). 모든 캡처 가로 넘침 false.

## 2. 구현 요점

- [확정] 대기방: Jupiter API(`netLobbyReady`·`netLobbyStart`·`netReturnToRoom`·`netLobbyCountdownLeft`·`NET.lobby`)만 호출·표시한다. `uiScreenName` 은 `OPEN`·`WAITING` 을 L03 로 본다(네트워크 로직 복제 없음). 누른 버튼은 서버 revision 이 바뀌거나 3초까지 잠근다(낙관 표시 없음). 목록 행에 `WAITING`(2/2 · 참가 불가 "대기 중") 표시를 더했다 — 종전에는 모르는 상태라 행이 빠졌다.
- [확정] 역할 그림: `LEADER_DIRS` 에 `companion_atk`·`companion_def` 를 더한 **고정 프리로드 집합**(74건). 역할은 내 말 = 소유자 값, 상대 = **공개된 기술 id**(AS-/SH-)로만 안다. 모르면 공용 `companion`, 역할 그림 실패 시 공용으로, 그것도 없으면 이모지. 결과 카드(`final`)에는 역할 필드가 없어 공용 그림이다.
- [확정] 시너지 안내 수치: `V2_KINGDOM_STAGES`·`V2_ARCH_SYN`·`V2_KINGDOM_STEPS`·`V2_ARCH_STEPS` 를 그대로 읽는 문장 변환(단계 경계는 `synKingdomStage`·`synArchBonus` 와 같은 식). 새 계산·기록·송신 없음. 칩은 `<span role=button>` 이라 단절 정지 `<fieldset disabled>` 안에서도 읽기 전용 안내가 열리고 게임 조작은 잠긴 그대로다.
- [확정] 아트: `tools/art/leaders_export.py` 에 Earth_3 원본 2종 그룹을 더해 64(icon64)·256(battle256)을 **LANCZOS 축소만**으로 내보냈다(실제 알파 0~255 · 모서리 0). 새 매니페스트 `demo/assets/leaders/roles-manifest.json` 에만 적어 승인 177파일(leaders-manifest.json 포함) SHA **177/177 불변**. CI 잡 D 의 `--check` 가 새 파일도 대조한다(로컬 동일 환경 Python 3.14.3 · Pillow 12.3.0 일치 10/10).
- [추론] PD 권고 "padded crop" 대신 기존 도구 계약(크롭 없는 축소)을 유지했다: 의미 있는 알파 경계가 이미 캔버스의 6~11% 여백 안이라 칼·방패·발 기준선이 온전하고, king/companion 과 같은 파이프라인·CI 대조를 그대로 쓴다. 32/64/128 판독은 [대조표](visual/cj8/leaders-contact-32-64-128.png).

## 3. 수정 파일

`demo/js/ui.js` · `demo/js/lobby.js` · `demo/js/data.js` · `demo/css/game.css` · `tools/art/leaders_export.py` · `tools/art/test/test_leaders_export.py` · `demo/assets/leaders/companion_atk/{icon64,battle256}.png`(신규) · `demo/assets/leaders/companion_def/{icon64,battle256}.png`(신규) · `demo/assets/leaders/roles-manifest.json`(신규) · `demo/test/regression/smoke_issue238.js` · `demo/test/milestone/v0.4.6/issues/122/issue122_rules.js` · `demo/test/regression/smoke_online_art.js`(기대값만) · `demo/test/shared/harness.js`(ui238 노출 6개 추가 · 부재 시 undefined) · 이 보고서 · `visual/cj8/`.
`server/**` · `demo/js/network.js` · `smoke_public_rooms.js` · Git 무수정.

## 4. 검사 (각 1회 · 실패 수정 뒤 해당 검사만 재실행)

| 검사 | 결과 |
|---|---|
| `node demo/test/regression/smoke_issue238.js` | 1회차 exit 1 — 첫 실패 E3·F6(칩 라벨이 CJ 6 형식으로 바뀐 옛 기대값) → 기대값 갱신 + K절 38항 추가 → exit 0 **124/0**. 캡처 뒤 전투 칩·CSS 수정으로 1회 더 → exit 0 124/0 |
| `node demo/test/milestone/v0.4.6/issues/122/issue122_rules.js` | 1회차 exit 1 — 첫 실패 D2(폴더 2종 고정) → 4종 + D6b → exit 0 **98/0** |
| `npm run typecheck` | exit 0 (구현 뒤 1회 · 최종 수정 뒤 1회) |
| `python -m unittest tools/art/test/test_leaders_export.py` | exit 0 **8 OK** (첫 실행 출력 꼬리가 잘려 결과 확인용으로 1회 더 · 둘 다 통과) |
| `python tools/art/leaders_export.py --check` | exit 0 일치 10/0 · 승인 177 SHA 177/177 |
| 위험 회귀 `smoke_online_art.js` | 1회차 exit 1 — 첫 실패 B1 "프리로드 70건"(역할 2종 추가 전 고정 수) → 74 로 기대값만 갱신 → exit 0 **101/0** |
| 위험 회귀 `smoke_issue259` · `smoke_issue260` · `smoke_issue262` | 각 1회 exit 0 (208/0 · 74/0 · 55/0) |
| 시각 픽스처(헤드리스 Chrome · 임시 정적 서버 8771/CDP 9371 · 오프라인 PVE·NET 상태 주입) | 3회 캡처(1회차 경로 오류로 빈 캡처 · 2회차 전투 제목 줄 넘침·L01 배지 가림 발견 · 3회차 320 팝업 여백 수정 확인) |

## 6. 정정 — 결과 좌상단 ← 도 같은 방 (2026-09-28 · task_cd14e7e71407 / ctx_1dccb38f64e6 · fresh Mars · claude-opus-5-5 high bypass)

- [확정] PD 지적: 결과 CTA 는 `netReturnToRoom()` 인데 헤더 ← 는 `uiBackSpec` "← 로비" · `uiBack` 결과 분기 `toLobby()` 로 남아 방을 떠났다. 1절 8행의 헤더 경로는 이번에 고쳤다.
- [확정] `ui.js` `uiPubFinished()`(= CTA 가 쓰던 `NET.publicMode&&NET.roomState==="FINISHED"` 그대로) 한 곳으로 헤더 문구·설명(“← 방으로” · “같은 멀티 대기방으로 돌아갑니다 (방은 유지됩니다)” = title·aria-label) · `uiBack` 결과 분기 · CTA 를 묶었다. `fxLocked` 잠금이 먼저, 오프라인·비공개 온라인은 종전 `toLobby`.
- [확정] `smoke_issue238.js` K16b~d: 실제 `uiApply`·`uiBack` 호출 — 헤더 문구·접근성 이름, 연출 중 잠금 뒤 `netReturnToRoom` 1회 · `roomId` 유지, 오프라인 ← = `toLobby`·“← 로비”. `node demo/test/regression/smoke_issue238.js` 1회 exit 0 **127/0**. issue122(B11 = `NET.mode` 비공개 경로) 기대값 무변경이라 미실행. 4절 이전 실패·unittest 2회 실행 사실은 그대로 둔다.
- [미확정] 실서버 두 계정 결과→헤더 ← 복귀는 플레이하지 않았다.

## 5. 한계 · 남은 것

- [미확정] 두 계정 실서버 흐름(참가→준비→방장 시작→5초→상점, 결과→양측 복귀→2경기·기록 2줄)은 **플레이하지 않았다**. L03·결과 화면은 `NET` 상태를 주입한 오프라인 렌더다. 서버 전이·기록은 Jupiter 계약·검증 범위, 통합 게이트는 PD.
- [미확정] `smoke_public_rooms.js` 미실행(Jupiter 소관). 목록 `WAITING` 행 표시를 새로 켰으므로 그쪽 기대값과 충돌 여부를 PD 통합 때 확인 필요.
- [추론] 전투창(.battleBox)은 CJ 7 팝업 색 정리에서 제외했다(배치 불변 지시). 필요하면 색만 따로 맞춘다.
- 전설 직접 참전 패시브(`V2_LEGEND_SYN`)는 이번 안내에 넣지 않았다 — 칩이 없는 값이다. 필요 시 [기획 필요].
- 사용량: 세션 안에서 입력·캐시·출력·추론 토큰을 측정할 수단이 없어 **미측정**.

## 7. 정정 — Saturn 독립 QA REVISE 4건 (2026-09-28 · task_12d68c4d501d / ctx_302897b0f929 · fresh Mars · claude-opus-5-5 high bypass · PD GO 뒤 착수)

원본: Saturn `C:/Users/pc_77/orca/qa/Digit-Duel/issue238-revise2-saturn/report.md`(REVISE · 1~4). 범위는 이 4건뿐이며 `ui.js`·`game.css`·`smoke_issue238.js`·이 보고서만 고쳤다.

| # | 지적 | 수정 [확정] |
|---|---|---|
| 1 | 일반 상점 👑 죽은 동료 = 작은 글자·title 뿐 | `shopSynHtml` 👑 줄을 공용 `synChipHtml("crown",d,…)`(44×44 · 누르기/터치/Enter·Space · 읽기 전용 `synHelp`)로. `synName`·`synSteps`([1,2])·`synTier`·`synTierText` 에 `crown` 분기 — 본문은 원본 `SKILLS["LD-REVENGE"/"LD-WRATH"]`(data.js 523-524)의 `pct`·`cd`·`desc` 를 그대로 읽는다: 1명 = 동료의 복수 220% · 쿨 2 · 사용자 속성 왕국 효과 100% 부여(왕국 (2) 미달이면 위력만), 2명 = 왕의 분노 280% · 쿨 2 · 같은 효과 + 지속 +1라운드. 부여 대상 문장 = `leaderSkillIds`(1명 → 왕·살아 있는 동료, 2명 → 왕). 👑 는 일반 상점에서만 그려진다(시작 상점은 종전대로 미선택 안내) |
| 2 | 결과 칩 `min-height:30px; min-width:0` | `.resultSeat .synChip` 에서 최소 크기 재정의 삭제 → 공용 `.synChip` 44×44 유지(글자 18px·여백만). `.synRow` 가 줄바꿈 |
| 3 | 번개 안내에 감전이 하는 일 없음 | 왕국 `shock` 단계 문장 = `감전 n% 확률 · 대상은 다음 1라운드 후공(상대보다 나중에 행동)` — 4단계 모두 원본 표 `p`·`rounds`, 의미는 data.js 105 "후공 1회" · core `fighterOrderCat`(감전 = 후턴) · 전투 메시지 "다음 n라운드 후공" |
| 4 | 방 만들기 창 432 에서 360 고정 | `.roomsScreen .roomCreate .histCard{width:min(480px,100%)}` — 시트 여백 16×2 라 뷰포트 − 32. 다른 `.acctCard`·`.histCard`(계정·기록 창)는 무변경 |

검사 (QA_MINIMUM · 각 1회, 실패 수정 뒤 해당 검사만):

| 검사 | 결과 |
|---|---|
| `node demo/test/regression/smoke_issue238.js` | 1회차 exit 1 — 새로 넣은 K40 뒤 `U.synHelpClose` 호출이 하네스 미노출이라 TypeError(테스트 코드 오류 · 제품 무관) → 그 한 줄 삭제(다음 `synHelp` 가 이전 안내를 닫는다) → 2회차 exit 0 **131/0**(127 + K39~K42) |
| K39~K42 | 일반 상점(`shop.kind` 주입 · 동료 1명 사망) 👑 칩 = `synHelp('crown',1,this)` + Enter/Space · 👑 안내 2단계 · 1명 강조 · 220/280%·쿨 2 · 번개 4단계 전부 "후공" · CSS 결과 칩 최소 재정의 없음 · 창 폭 규칙 |
| 격리 시각 픽스처(헤드리스 Chrome · 별도 프로필 · `file://` · 1회 · 브라우저 종료 확인) | 방 만들기 창 320: x16 · 폭 **288** · 432: x16 · 폭 **400** · ← x18 · 제목 23px 한 줄 · ✕ 44×44 · 초점 `roomName` · 가로 넘침 false. 결과 칩 11개 최소 44.5×44 · 320 3줄 · 432 2줄 · 넘침 false. 👑 칩 44×44(320)·48.5×44(432) · Enter·클릭으로 열림 · 초점 안내 안 · Esc 뒤 칩 복귀 · 모달 [상점 완료] 콜백 1회 유지 |

증거: `C:/Users/pc_77/orca/qa/Digit-Duel/issue238-revise3-mars/`(`fixture.json` · `create-320/432.png` · `result-chips-320/432.png` · `crown-help-320/432.png` · `mars-fixture.js` = Saturn 독립 픽스처 복제 후 측정만 교체). 저장소 밖에 두었다(이번 수정 파일 범위 밖이라).

- [확정] 픽스처는 **주입 렌더**다(가짜 프로필 · `modal()`에 칩·결과 줄을 직접 넣음). 실제 경기 흐름의 일반 상점·결과 화면은 smoke K39 의 헤드리스 렌더로만 확인했고 실서버 플레이는 하지 않았다. 8085 서버·PG·SMTP·사용자 브라우저·계정 무접촉, Node/PG 재시작 없음.
- [확정] 헤드리스 Chrome 에 🪄 글꼴이 없어 기술 이름 앞 이모지가 □ 로 보인다 — 원본 `SKILLS.ko` 문자열이며 기존 전투·상점 표기와 같다. 수정하지 않았다(범위 밖 · 실기기 글꼴 미확인 [미확정]).
- [확정] B02/B08/동기화 모달·전투 콜백 경로·타이머 30/60/20/90·준비 5초·결과 같은 방 복귀·상대 등급 비공개 코드는 건드리지 않았다. 광범위 스위트·authoritative·publicrooms·typecheck·unittest·아트 검사는 CSS/안내 전용 수정이라 미실행.
- 모델: 시스템 식별 `claude-opus-5-5` · 요청 effort high(유효 effort·푸터는 모델이 볼 수 없음 — PD 독립 대조: PID36984 argv · bypass 푸터). 사용량(입력·캐시·출력·추론)은 세션 안에서 측정 수단이 없어 **미측정**.

## 8. CJ 최신 3항목 (2026-09-28 · task_2cde127efe23 / ctx_f0581668bcde · fresh Mars · argv `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` · PD GO 뒤 착수)

원본: [PD 전달 최신 3항목](../Mercury/cj-revise-8-items.md) · Image #1·#2 직접 열람 · Jupiter 이탈 계약(PD 메시지 전달: 방장 수신 = `room_state` OPEN · phase `setup` · 최상위 `players[1]=null`·`reps[1]=null`·`peerConnected:false`). 수정 파일: `demo/js/lobby.js` · `demo/css/game.css` · `demo/js/network.js`(1분기) · `smoke_issue238.js` · `smoke_issue260.js`(E4·E5 기대값) · 이 보고서.

| # | 수정 [확정] |
|---|---|
| 1 | `lobbyLocked` = 사라지는 토스트. 공용 `.toast` 모양·`toastFade`·시간(= `showToast` 2.3초) 재사용, 자리는 L01 미션 줄 · L02 프로필 줄 바로 아래 `role=status aria-live=polite` 호스트(`position:absolute` · `pointer-events:none` → 배치 불변). 다시 누르면 새 토스트로 교체, 옛 타이머는 `LOBBY.toast===자기` 일 때만 지운다. 다시 그리면 음수 `animation-delay` 로 남은 시간 이어서, 로비↔목록·재진입 시 비움. L01 고정 `#lobbyNotice` 삭제, L02 참가 불가 안내(`lobbyRoomLocked`)·오류·검증 안내는 그대로 |
| 2 | `l01Rec` = 이전 승인 `gi("record")` 아이콘(글자 승·패 삭제) · aria-label "전적 기록 — 최근 20경기 보기" · 전체 승·패는 프로필 줄 그대로 · 창(최근 20경기) 무변경. 위치는 11절 높이 보정으로 대체(이벤트 아이콘과 같은 높이) |
| 3 | `netApplyRoomState`: `state==="OPEN"` 을 대기 분기로(경기 중이었으면 `netRematchReset`), 방장이면 `players[1]`·`reps[1]` 비움 → 빈 대기방(준비·5초 해제는 `NET.lobby=null`). 참가자 나가기는 종전 `netLeaveRoom` → L02. 새 참가자 → WAITING 종전 흐름. 경기 중 기권·단절·타이머·결과·이모티콘 코드 무변경 |

검사 (각 1회, 실패 없음):

| 검사 | 결과 |
|---|---|
| `node demo/test/regression/smoke_issue238.js` | exit 0 **137/0**(K4 갱신 · K4b~g 토스트·아이콘) → 3번 뒤 L1~L3 추가 1회 exit 0 **140/0** |
| `node demo/test/regression/smoke_issue260.js` | exit 0 **74/0** (E4·E5 = 토스트 호스트) |
| `node demo/test/regression/smoke_public_rooms.js` (network.js 변경) | exit 0 **191/0** |
| `npm run typecheck` | exit 0 |
| 격리 헤드리스 Chrome(`file://` · 별도 프로필 · 서버·계정 무접촉) | `C:/Users/pc_77/orca/qa/Digit-Duel/issue238-latest3-mars/`(`fixture.js`·`fixture.json`·png). 스크립트 자체 오류로 4회 실행(Enter 문자열·탭 진단), 제품 수정 없음 |

실측 [확정] (`fixture.json`): 432×950 — 기록 아이콘 48×44 · y568~612(대표 이름표 하단 561 아래 · 왼쪽 x12) · 토스트 y180(미션 하단 172 + 8) · 320×640 — 아이콘 y351~395 · 토스트 L02 y70(프로필 줄 하단 62 + 8). 두 폭 모두 토스트 전후 `.l01Stage`·`.l01Main`·`.l01Nav` 좌표 동일 · 가로 넘침 없음. 마우스 클릭·Enter·Space 로 표시, 첫 표시 2.9초 뒤에도 두 번째 토스트 유지, 다시 그리기(기록 창 열고 닫기) 뒤 유지, 2.3초 뒤 빈 호스트, 목록 이동 시 비움, 기록 아이콘 Enter → 창(초점 ✕) · Esc → 아이콘 복귀.

- [미확정] 헤드리스 `synthesizeTapGesture` 가 두 폭 모두 click 을 만들지 않아 터치는 실측하지 못했다(네이티브 `<button>` 이라 터치 → click 은 플랫폼 동작 [추론]).
- [확정] 320×640 에서는 대표 하수인 버튼이 미션 타일 가운데를 덮었다(`elementFromPoint` = `repBtn`) — 당시 미수정, 10절에서 해결.
- [미확정] 실서버 두 계정 흐름(참가자 이탈 → 방장 빈 방 → 새 참가 → 준비 → 시작)은 플레이하지 않았다. 서버 전이는 Jupiter 검증 범위, 8085·PG·SMTP·실계정 무접촉. 독립 PASS 판정은 Saturn.
- 사용량(입력·캐시·출력·추론)은 세션 안에서 측정 수단이 없어 **미측정**.

## 9. CJ 추가 — 방 찾기 멀티 접속 인원 (2026-09-28 · task_69f72ab3940d / ctx_ee3f14057c31 · 같은 Mars 즉시 후속 · argv `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` · PD GO 뒤 착수)

원본: [PD 전달 추가 요청](../Mercury/cj-revise-8-items.md) · PD 표준 계약 = `lobby_rooms` 최상위 선택 필드 `onlineCount`(음 아닌 정수 · 서버가 센 유효 로그인 계정 고유 인원). Jupiter 최종 계약·서버 검사는 별도(서버 무수정). 8절 3항목 구현은 그대로 두었다.

- [확정] `network.js` `lobby_rooms`: `NET.online = Number.isSafeInteger(onlineCount)&&≥0 ? 값 : null`(필드 없음·음수·소수·문자열·null·NaN·과대값 = null). `lobby_ready`(새 로비 소켓)·소켓 종료(`netHandlePublicSocketClosed`)에서 null. 클라이언트는 세지 않는다.
- [확정] `lobby.js` L02 `.roomsHead` = ← · 제목 · `#roomsOnline`(승인 `gi("team")` + 숫자, 스크린리더 "멀티 접속 N명"/"확인 불가"). 로비 소켓이 열려 있고 값이 있을 때만 숫자, 아니면 —. `lobbyRoomsPaint`(5초·수동 목록 갱신) 때 이 배지도 다시 채운다 — 새 타이머·엔드포인트·DB·아트 없음. 읽기 전용 표시라 버튼이 아니다(44px 대상 아님). `game.css` `.roomsOnline` 2줄.
- 검사 (각 1회 + 실패 수정 뒤 그 검사만): `smoke_issue238.js` 1회차 exit 1 — 새 M 블록 설정 오류(`S=null`로 render TypeError, 테스트 코드) → 2회차 146/1(M2 정규식이 innerHTML 에 id 를 기대한 테스트 오류) → 3회차 exit 0 **147/0**(M1~M7). `smoke_public_rooms.js` exit 0 **191/0** · `npm run typecheck` exit 0. `smoke_issue260` 은 이 변경이 닿지 않아 미실행.
- [확정] 격리 헤드리스 Chrome(`issue238-latest3-mars/online.js`·`online.json`·`online-320/432.png`, file:// · 가짜 소켓 주입): 320 — ← 44×44 x18 · 제목 한 줄(높이 23) · 배지 — 54 / 999 66 / 12345 84px · 머리줄 높이 56 · [생성] 52×44 · 가로 넘침 없음. 432 동일(제목 폭 244~274). 1회차 측정에서 5자리일 때 320 제목이 두 줄이라 배지 여백·아이콘을 줄였고(2회 실행), 1회차 432 "—" 값은 앞 폭의 상태가 남은 측정 오류였다.
- [미확정] 실서버 인원 집계·재접속 흐름은 플레이하지 않았다(Jupiter·Saturn). 8절의 터치 미실측·픽스처 스크립트 오류 이력은 그대로 유효하다. 사용량 미측정.

## 10. 정정 — Saturn REVISE: 320 미션 칸 터치 가로챔 (2026-09-28 · task_d31407e821ff / ctx_dee7984cc4f0 · fresh Mars · argv `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` pid45320 · PD GO 뒤 착수)

원본: Saturn `C:/Users/pc_77/orca/qa/Digit-Duel/issue238-revise4-saturn/report.md`. 원인 [확정]: 받침대에 맞춰 위로 올린 `.l01Rep`(transform·음수 margin)가 DOM 뒤라 320×640 에서 미션·하루에 한 판 칸 위에 그려져 누름을 가로챘다(`.repBtn` y127 ↔ 칸 y122~166).

- 수정 [확정]: `demo/css/game.css` 1줄 `.l01Tiles .tile::after{content:""; position:absolute; inset:0; z-index:1;}` — 칸 영역에만 투명 덮개. 그림·배치·다른 PASS 영역 무변경, `lobby.js`·서버·네트워크 무수정(lobby.js sha256 전후 동일 `80c8cd65…a073b`).
- 실측 [확정] (8085 served · 서빙 CSS = 디스크 sha256 `bdec590b…d8394` · 주입 로그인 로비 · 실 CDP `Input.dispatchTouchEvent` + `elementFromPoint`, 칸마다 가운데·좌하·우하 3점): 전 320 — 미션 가운데·우하, 하루 가운데·좌하 = `repBtn` → 대표 창 열림·토스트 없음 / 후 320·432 — 12점 모두 해당 칸 · "🔒 … 추후 공개 예정입니다." 토스트 · 창 안 열림. 대표 몸통 터치 → 대표 창, 기록 아이콘 터치 → 최근 20경기(초점 ✕), 위 재화·설정 hit 유지. 두 폭 좌표 12종 전후 동일 · 가로 넘침 없음 · L01 스크린샷 전후 바이트 동일.
- 증거: `C:/Users/pc_77/orca/qa/Digit-Duel/issue238-revise4-touch-mars/`(`touch.js` · `before.json`/`after.json` · png). 임시 Chrome 프로필 finally 삭제, 헤드리스 Chrome 잔존 0. 계정·PG·메일·서버 재기동 없음. 테스트 무수정(저위험 CSS 1줄 · 실터치 전후로 증명).
- [확정] 절차 예외: preflight 전 읽기 전용 `git rev-parse HEAD`(=e1bfdc2) 1회 실행 — PD 보고·GO 뒤 추가 Git 없음. 독립 PASS 판정은 Saturn. 사용량 미측정.

## 11. 정정 — CJ 기록 아이콘 높이 (2026-09-28 · task_c1c335967917 / ctx_07adbdbe68ed · fresh Mars · argv `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` pid43280 · PD GO 뒤 착수)
[확정] 원인 `.l01Stage .l01Rec{top:10vh}` → `top` 만 삭제. `.l01Stage` 격자 `align-items:center` 가 이벤트와 같은 행 가운데 정렬. `position:relative; z-index:1`(대표 그림 겹침 위 누름)은 유지. `lobby.js` 154행 위치 주석만 치환. 다른 제품·테스트 무수정.
| 뷰포트 | 전 기록/이벤트 top · 중심Y | 후 기록/이벤트 top · 중심Y | 기록 크기 | 겹침 누름 · 창 · 포커스 | 넘침 |
|---|---|---|---|---|---|
| 320×640 | 351/287 · 373/309 (+64) | 287/287 · 309/309 (0) | 48×44 | `l01Rec` · 최근 20경기 열림 · histClose→l01Rec | 없음 |
| 432×950 | 568/473 · 590/495 (+95) | 473/473 · 495/495 (0) | 48×44 | `l01Rec` · 최근 20경기 열림 · histClose→l01Rec | 없음 |
무수정 확인: `.l01Stage`·`.l01Rep`·`.repName`·`.l01Tiles`·`.l01Main`·`.l01Nav` 좌표 전후 동일. 실측: 서빙 8085 · 자체 임시 헤드리스 프로필 · 각 1회(`qa/Digit-Duel/issue238-record-height-mars/measure.js` · before/after.json · png).
[확정] 후속(task_5f9f9d336373 / ctx_951017887690 · 같은 Mars lease): 낡은 `smoke_issue238.js` 259행 K4b 의 `top:10vh` 절반을 삭제하고 승·패 글자 규칙 삭제 검사만 남겨 이름을 맞췄다(CSS 한 줄 정규식 복제 추가 없음 · 높이는 위 DOM 실측이 기준). `node demo/test/regression/smoke_issue238.js` 1회 exit 0 · 147 passed 0 failed(`qa/Digit-Duel/issue238-record-height-mars/k4b-smoke.log`). 남은 낡은 K4b 없음.
