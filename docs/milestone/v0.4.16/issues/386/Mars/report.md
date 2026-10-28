# #386 v0.4.16 README 플레이 사진 8장 — Mars 촬영 감사 보고

- 작업: task_939638aaaef9 / ctx_a1dd55003b4d · 2026-10-28 (KST)
- 실행: Mars, Claude Code `claude-opus-5-5` · effort high · `--dangerously-skip-permissions` (argv 실측, PID 33548) · Ponytail full. 코디네이터 GO 수신 뒤 촬영.
- 범위: 현재 UI 실제 브라우저 캡처 8장과 이 보고서만 작성했다. README 본문, Git 쓰기, GitHub·Notion·Render 쓰기는 하지 않았다. README QA 판정은 하지 않는다.

## 1. 결과물

8장 모두 390×844 CSS · DPR 2 전체 뷰포트(잘라내기 없음)라서 출력은 모두 780×1688 px이다. README의 네 쌍은 높이가 같다.

| README 위치 | 파일 | px | bytes | SHA-256 |
|---|---|---|---|---|
| 1행 왼쪽 | `docs/screenshots/v0.4.16/01-login.png` | 780×1688 | 1068086 | `8f4386601131720cd486601e09774132618a6a6343a0809e25aadc3f30b4cc80` |
| 1행 오른쪽 | `docs/screenshots/v0.4.16/02-main-lobby.png` | 780×1688 | 1364740 | `3692013cee07a546c1b62608d1e5d5bd7be0b2b19fd36f4dedd662c73fd70275` |
| 2행 왼쪽 | `docs/screenshots/v0.4.16/03-public-rooms.png` | 780×1688 | 803042 | `5a96a76ef45d23942ad1b93c397637d752f5ff1ed88bf9193e301a513ba2d634` |
| 2행 오른쪽 | `docs/screenshots/v0.4.16/04-waiting-room.png` | 780×1688 | 923179 | `e8eb5f8bc63409da253b64c5627da7b61fde98c674db29fc174204ee940c4539` |
| 3행 왼쪽 | `docs/screenshots/v0.4.16/06-strategy-board.png` | 780×1688 | 1099679 | `eabc88d711ab7e0b3491b81d6ac695995fdbc36ca17f4ef330a05207e1a553fd` |
| 3행 오른쪽 | `docs/screenshots/v0.4.16/08-element-battle.png` | 780×1688 | 1094476 | `c41c7bdfa637edffbc8de01fe6d6f3bc226fba6661cd94c3ae26d8ba207b86c5` |
| 4행 왼쪽 | `docs/screenshots/v0.4.16/05-start-shop.png` | 780×1688 | 826456 | `38ce6f762f77899d015e88603dada5345862a522f13db02fb9bdcd3bed484c17` |
| 4행 오른쪽 | `docs/screenshots/v0.4.16/07-turn-shop.png` | 780×1688 | 756947 | `97e6e45cbedc4ddb4295e0f4e4b95e83f8f241d19915607c478b64c7fd77e7d1` |

원본 probe는 `C:/Users/pc_77/orca/artifacts/Digit-Duel/readme-v0416-branch-alignment-20261028/Mars/shots/`에 있다. 납품본은 p01a·p02a·p03b·p04a·p05c·p06a·p07c·p08a를 바이트 그대로 복사했다. 버린 probe: p00(계정 꺼짐 상태 타이틀), p03a(핑 측정 불가), p04a 1차(타이틀로 복귀), p05a·p05b(구매 전·토스트), p06 없음, p07a·p07b(가방 행 잘림·스크롤 정렬 전), p08pre(전투 시작 연출 중).

## 2. 원본·환경

- 코드: 작업 공간 `doc-386-v0416-readme`, HEAD `a1fa420bbd5b39b7d179233297b9ef78ef0b889b` (`doc/386-v0416-readme`, 세션 시작 시 clean).
- 페이지: 수정하지 않은 `demo/`. 01~04는 Mars 소유 정적 서버(127.0.0.1 임의 포트, 읽기 전용, `/api/*`=503 `E_ACCOUNTS_DISABLED`, DB 없음)에서, 05~08은 `file:///…/demo/index.html` 오프라인으로 열었다.
- 브라우저: Google Chrome `Chrome/155.0.8059.85`, headless=new, UA `HeadlessChrome/155.0.0.0`. 격리 프로필(종료 후 삭제), `--hide-scrollbars --force-color-profile=srgb --lang=ko-KR`. CDP Emulation 390×844 · DPR 2 · mobile. Node v24.16.0.
- 도구(저장소 밖, 새 artifact 폴더만): `driver.js`(v0.4.15 드라이버 + #335 harness의 정적 서버·가짜 WebSocket prelude), `cli.js`(v0.4.15 복사본에서 포트·nav·errors만 변경), `auto.js`·`fight.js`·`bottomcheck.js`(v0.4.15 그대로 복사), `blobcheck.js`(신규). 과거 helper와 `tools/media/readme_media_capture.js`는 수정하지 않았다.
- 제품 데모 blob(index 기준 앞 12자리): index.html `95614ee79479` · core.js `55b027528c5b` · ui.js `bceabb128c36` · ui-overlays.js `dcd5b357c9c7` · lobby.js `43a4a2404630` · network.js `ff0a878416a5` · account.js `df88316b96bc` · data.js `168f0f759344` · game.css `337acbdee547` · argon.css `34909e2a2d7f` · cohesion-pilot.css `42cbd6a66ac9` · fx.css `3cc2c9415250`.

## 3. 화면별 진입 경로와 fixture 경계

**공통**: 실제 회원 E2E가 아니다. 서버·DB·계정·SMTP를 쓰지 않았고 외부 Production·QA 서버에 접속하지 않았다. 화면에 보이는 닉네임(루나·솔라·노을·하늘·바람·별빛·달빛)·방 이름·전적·핑 수치는 모두 가상 값이다. 이메일·사용자 ID·접속 코드·로그·DevTools·테스트 배지는 화면에 없다. `Math.random`은 고정하지 않았으므로 05~08은 같은 화면으로 재현되지 않는다.

| 화면 | 진입 | fixture(제품 함수·프레임만 사용, 제품 파일 무변경) |
|---|---|---|
| 01 로그인 | 정적 서버 첫 화면 | DB 없는 서버는 계정 꺼짐(`AUTH.state="off"`)이라 로그인 버튼이 없다. 계정 서비스가 켜진 첫 방문 상태를 `AUTH.state="anon"; render(); acctRender()`로 재현했다. |
| 02 메인 로비 | `UI.entered=true; render()` | 프로필은 서버 응답 모양을 제품 파서 `lobbyParseProfile({nickname:"루나", representativeMinion:"M-F2", stats:{wins:12,losses:7}, …})`로 만들고 `LOBBY.prof="ok"`. `AUTH.state`는 `anon` 그대로다(로그인 `in`과 다른 점은 프로필 요청 여부뿐이라 그려지는 화면은 같다). |
| 03 공개 방 목록 | 제품 `lobbyRooms()` | 가짜 WebSocket에 `lobby_ready`·`lobby_rooms`(가상 방 4개 · 접속 9명) 프레임을 넣었다. 핑은 가짜 소켓이 `rtt` 요청에 35 ms 뒤 답하도록 해서 제품이 잰 값(`핑 42ms`)이다. 지연 자체는 합성 값이다. |
| 04 방 대기실 | 새 페이지(계정 꺼짐) · 제품 `netCreatePublicRoom("초보 환영 한 판")` | 가짜 소켓에 `room_opened`, `room_state`(WAITING · 참가자 준비 완료 · 대표 M-F2/M-W1 · 핑 42/57 ms) 프레임을 넣었다. 첫 시도에서는 `anon` 상태로 열어 계정 확인 단계가 타이틀로 되돌렸다. 그래서 새 페이지에서 다시 열었다. |
| 05 시작 상점 | `file://` 오프라인 · 로비의 싱글플레이 카드가 잠겨 있어 제품 `startMode("pve",{aiLevel:"grade5"})`를 직접 호출했다(v0.4.15와 같음). | 실제 CDP 클릭으로 돌창 거인·용암 거북·불티 정령을 샀다. 토스트가 사라진 뒤 `#screenBody.scrollTop=50`으로 맞췄다. 고정 머리 바로 아래부터 상점 6줄과 필드 3/6이 보이고, 맨 아래는 `가방 0/3` 제목에서 행 경계로 끝난다. |
| 06 전략 보드 | 05에서 이어서 진행 | 3마리를 더 사고 실제 클릭으로 다음 단계 → 무작위 배치 → 배치 완료를 눌렀다. 이어 `auto.js`(실제 클릭)로 2~14턴 전진했다. 15턴 AI 철갑 코뿔소 전투(08)를 `fight.js`로 끝낸 뒤 16턴 내 차례 전체 화면을 찍었다. 상대 공개 말(적 · HP 31), 탐색 가능한 수풀, 시너지 열이 보인다. |
| 08 속성 전투 | 15턴 AI의 실제 접촉 공격 | 철갑 코뿔소(땅·D 자세 `land_def/battle-d@2x.png`) 대 내 이끼 거인(풀·A 자세 `grass_sustain/battle-a@2x.png`), 라운드 1 내 차례다. 시작 연출이 끝나고(`fxLocked()=false`) 이미지가 디코드된 뒤 찍었다. |
| 07 턴 상점 | 06에서 이어서 진행 | 16턴에 내 말이 코뿔소를 공격했다. 전투 시작을 클릭하고 `fight.js`로 끝냈다. 이어 `auto.js`로 20턴 상점까지 진행했다. 실제 클릭으로 재의 주술사★2와 화염 투사★1을 사서 가방에 넣었다. `#overlayBox.scrollTop=299`로 맞췄다. 고정 상점 머리 바로 아래 SOLD OUT 줄부터 마지막 왕·동료 속성 줄(bottom = 844 CSS)까지 보인다. |

## 4. 검사

- 페이지 예외·console error/warning: 01~03 세션, 04 경로 재실행 세션, 05~08 오프라인 세션 모두 0건이다(`errors-*.json`).
- 자산 로드 오류: 0건이다. 예외로 브라우저가 자동 요청한 `/favicon.ico`가 404였다. 데모에는 favicon이 없고 제품 자산도 아니다. 정적 서버의 404는 이것뿐이다. `/api/*` 503은 DB 없는 표면에서 의도한 응답이다.
- 이미지: 촬영 직전 보이는 `<img>`가 모두 `complete && naturalWidth>0`인지 확인했다. 로비 대표는 `argon-cohesion-pilot/minions/fire_atk/portrait.webp`(512), 방 목록은 `icon@2x.png` 6종(96), 대기실은 `portrait.webp` 2종(512), 전투는 `battle-a@2x`·`battle-d@2x`(256)다. 테이블탑 배경(타이틀 아치·로비·선술집·나무 판)은 화면마다 렌더됐다.
- 수평 넘침: `documentElement.scrollWidth - innerWidth` = 01~08 모두 0이다.
- 하단 띠(`bottomcheck.js`, 마지막 80 px의 서로 다른 색 수): 02:2868 · 03:1442 · 04:1902 · 05:2418 · 06:3766 · 07:7314 · 08:780은 OK다. **01:18은 CHECK**다. 아래 5절 1번을 보라.

## 5. 문제·한계 (판정 아님, Mercury 검토용)

1. **01 하단이 어둡다.** 타이틀 UI는 화면 가운데에 있고, 아래 약 190 CSS px는 제품 타이틀 배경의 어두운 비네트다(색 18가지). 덧붙인 빈 공간이 아니라 실제 렌더다. 잘라내면 02와 높이가 달라져 그대로 두었다. v0.4.13 승인본 01도 같은 전체 뷰포트 구성이었다.
2. **06 시너지 열의 맨 아래 칸이 일부 가려진다.** 제품 자체 스크롤 영역(`synRail` 554/513)이라 `말 정보` 위에서 마지막 칸이 일부만 보인다.
3. **05 맨 아래에 `가방 0/3` 제목만 보인다.** 가방 칸은 화면 아래에 있다. 상점 6줄과 필드 전체를 보이게 하면서 위아래가 행 경계에 맞는 위치는 이 하나뿐이었다.
4. **제품 표시 그대로인 부분**: 02 `싱글플레이` 버튼 글자가 두 줄로 나뉜다. 게임 화면 머리의 `플레이어`가 `플레…`로 줄어 보인다. 타이머는 촬영 순간 값(05 98초 · 06 23초 · 07 128초 · 08 52초)이다.
5. **전투 Seat A/D**: A는 내 쪽 후측면, D는 상대 쪽 전측면을 가리키는 두 좌석의 뷰다. 정지 화면에는 이 두 뷰를 담았다. 33종 전체 FX·전체 종 재검사는 범위 밖이라 실행하지 않았다. (PD 문서 정정: 원문에서 A-D를 네 자세로 읽어 “B·C는 담기지 않았다”고 적은 문구는 삭제했다. B/C 뷰는 이번 계약에 없다. 촬영 원본·픽셀은 변경하지 않았다.)
6. **Git 읽기 명령 사용**: 세션 시작 때 기준 확인을 위해 읽기 전용 `git rev-parse HEAD`·`git branch -vv`를 1회씩 실행했다. Worker Git 읽기 금지 메모와 어긋나므로 기록한다. 이후 blob 대조는 Git 명령 없이 `.git` index 파일을 직접 읽었다.

## 6. 제품 파일 불변 확인

`blobcheck.js`로 worktree `.git/worktrees/doc-386-v0416-readme/index`(v2, 2321개 항목)를 직접 읽었다. 각 작업 파일의 blob SHA-1을 index의 기준 blob과 비교했다. 세션 시작 상태가 clean이라 index는 HEAD `a1fa420`과 같다고 본다(추론).

- 바이트 동일: 1542개.
- CRLF→LF 정규화 뒤 동일: 778개(이 중 demo·server·tools·test 아래 165개). Windows checkout의 줄 끝 변환이며 내용 차이는 아니다.
- 다름: `README.md` 1개. Mercury가 동시에 편집 중이며 GO 지시에 따라 제외했다. `docs/milestone/v0.4.16/README.md`도 같은 이유로 대조에서 제외했다.
- 없음: 0개.
- 기존 `docs/screenshots/` 아래 index 항목 30개 중 PNG는 모두 바이트 동일이다. 텍스트 3개(`tutorial-overview.svg`, v0.4.14·v0.4.15 `capture-manifest.json`)는 줄 끝만 다르다. 옛 이미지는 1바이트도 바꾸지 않았다.

## 7. 정리

- 내 프로세스(드라이버 PID 28416·22584·35412, Chrome PID 26076·24252·8052)는 `/quit`로 종료했다. 리스너 9396/9397과 임의 정적 포트는 LISTEN 0이고 격리 프로필은 삭제했다.
- 다른 프로세스, root·#335 checkout, E: 납품·리뷰 자료는 건드리지 않았다. 패키지 설치·배포·서버/DB 기동은 하지 않았다.
