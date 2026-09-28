# #262 경기 중 이모티콘 — Mars(Client) 구현 보고

2026-09-27 · Mars (Claude Opus 5.5 · effort high · bypass · Ponytail full) · task_5e4653c86eb3 / ctx_54d9f97f85ac
실행 확인: claude.exe PID 35132 `--model claude-opus-5-5 --effort high --dangerously-skip-permissions`, 현재 JSONL `aff5457c-fc9a-4e68-b6e6-2f90bdfe5368.jsonl`. Git 명령 0회(읽기 포함) · GitHub/Notion 쓰기 0 · 전역 설정 변경 0.

## 1. 판정

**확정** — CJ 승인 규칙(6종 · 서버 좌석별 5초 · 표시 2.5초 · 경기 전반 양쪽 차례 · 브라우저 상대 숨김)과 PD msg_676b615b44e2 회선 계약대로 클라이언트를 구현했다. 새 테스트 55/55, 정적 계약 검사 PASS, 영향 스위트 PASS. 서버(Jupiter)와 실제 두 브라우저로 주고받기·서버 간격 거부·새로고침 뒤 간격 유지·숨김을 확인했다.
**미확정** — 보드·전투·결과·게임 모달 화면의 배치는 **fixture 스크린샷**(아래 4절)으로만 봤다. 실서버에서 경기를 끝까지 진행한 확인은 하지 않았다. Saturn 독립 QA와 CJ 플레이 QA가 남았다.

## 2. 회선 계약 (클라이언트 쪽)

| 방향 | 프레임 | 클라이언트 처리 |
|---|---|---|
| C→S | `{v:1,t:"emote",requestId,seatToken,tokenGen,id}` | `NET.sendEmote(id)` 한 곳에서만 보낸다. `netAction`·`netSendAction`·모달 중계·resync·재생 경로를 타지 않는다. 봉투 칸은 이 6개뿐이다 |
| S→C 성공 | `{type:"emote",epoch,roomId,from,id}` + 보낸 쪽만 `requestId,cooldownMs` | epoch·roomId가 지금 방과 같고 `from`∈{0,1}·ID가 목록 안일 때만 그린다. 내 것이면 대기 해제 + `cooldownMs`로 초읽기 |
| S→C 거부 | `{type:"emote_result",ok:false,requestId,code,retryMs?}` | 대기 중 requestId와 같을 때만 처리한다. `retryMs`가 있으면 초읽기, 없으면 짧은 사유 토스트. 일반 `error` 경로(staleView·자동 턴·경제 resync·준비 재전송)를 타지 않는다 |
| S→C 메타 | 모든 좌석 프레임의 `peerConnected` | `false`면 잠금 — 결과 화면처럼 정지가 없는 단계에서 상대가 나간 경우 |
| S→C 재개 | `room_resumed.emoteRetryMs` | 같은 좌석의 남은 간격을 이어 센다(새로고침 포함) |

- 보낼 수 있는 때: 공개 방 · 소켓 열림 · 방 상태 SETUP/IN_PROGRESS/FINISHED · `netPaused()` 아님(내 재접속 중·단절 정지 포함) · `peerConnected!==false` · 응답 대기 없음 · 간격 끝남. OPEN(상대 없음)·로비·오프라인·코드 릴레이·종결 방에서는 층 자체가 숨는다.
- 간격은 서버가 준 **남은 ms**만 쓴다(절대 시각 비교 없음 → 기기 시계 차이 무관). 원본은 서버 좌석 시각이다.
- 낙관 표시 없음: 보낸 뒤 서버 `emote` 프레임을 받기 전에는 내 말풍선·간격을 세우지 않는다.
- 정리: 새 방(room_opened/joined)·나가기(netLeave)에서 말풍선·타이머·대기·간격 사본 0. 소켓 끊김·재개에서는 말풍선·대기만 지우고 간격은 서버 값으로 다시 맞춘다. 큐·재생 없음(같은 쪽 새 것이 대체).

## 3. 화면

- 모달(z50)·연출 배너(z55) 위, 튜토리얼(z60)·재접속 줄(z70) 아래의 고정 층 `#emoteLayer` 하나. 세로 프레임 오른쪽 위 44×44 여는 버튼(💬, 간격 중 `💬4`처럼 남은 초, `aria-label`에도 사유·남은 초, `aria-expanded`).
- 상단 바는 오른쪽 56px, 게임 모달은 위 52px를 비워 두어 여는 버튼이 어떤 버튼도 가리지 않는다.
- 고르기 창은 모달이 아니다: `<fieldset>` 안 네이티브 버튼 6개(그림+문구, 44px) + "상대 이모티콘 숨기기" 체크박스(44px 줄). 잠금은 `<fieldset disabled>`라 키보드·스크린리더까지 함께 잠긴다. Esc·보내기는 닫고 포커스를 여는 버튼으로 돌린다. 바깥을 누르면 닫는다(포커스는 누른 곳으로).
- 말풍선 두 줄(위 상대 · 아래 나, 내 것은 파란 테두리)은 **상단 바 제목·단계 글자 칸(`#appBar h1`) 위에만** 뜬다. 칸 위치는 표시할 때 h1을 실측해 맞춘다. `pointer-events:none`·`aria-hidden`이다. 처음 배치(상단 바 아래)는 fixture에서 보드 맨 윗줄 칸과 "상대: 준비 중" 칩을 가려 옮겼다.
- 움직임: 등장 0.3초 + 사라짐 0.2초(상한 1.2초 안), 표시 2.5초. 동작 줄이기 설정에서는 불투명도만 0.1초.
- 읽어 주기: 화면 밖 `aria-live="polite"`에 "상대: 문구"를 넣는다. 숨김 중에는 읽지 않고, 나중에 다시 보여 주지 않는다. 내 것은 숨김과 무관하게 보인다.
- 숨김 저장: `localStorage["dd_emote_mute"]="1"`(이 브라우저 · 다음 경기에도 유지). 저장소가 막혀 있으면 이 탭 메모리로만 동작한다(기본값 '보임').
- 문구는 클라이언트 고정 목록만 `textContent`로 넣는다. 서버 값은 ID 대조에만 쓴다(HTML 삽입 없음).

## 4. 증거

| 파일 | 종류 | 내용 |
|---|---|---|
| [262-s01-shop-popover-320.png](262-s01-shop-popover-320.png) | **실서버**(8085, 두 계정) | S01 시작 상점에서 연 고르기 창 |
| [262-s01-own-bubble-320.png](262-s01-own-bubble-320.png) | **실서버** | 보낸 쪽: 내 말풍선 + `💬5` 초읽기 (등장 연출 중 캡처라 반투명) |
| [262-s01-opp-bubble-390.png](262-s01-opp-bubble-390.png) | **실서버** | 받은 쪽: 상대 말풍선 |
| [262-s01-after-reload-countdown-390.png](262-s01-after-reload-countdown-390.png) | **실서버** | 보낸 직후 새로고침 → 재접속 뒤 `💬5`(서버 남은 간격 4148ms) |
| [262-FIXTURE-board-bubbles-320.png](262-FIXTURE-board-bubbles-320.png) · [432](262-FIXTURE-board-bubbles-432.png) | **fixture** | 보드 화면 — 말풍선이 제목 칸 위에만, 보드·상세/기록·뒤로가기·행동 독 비침범 |
| [262-FIXTURE-modal-bubbles-320.png](262-FIXTURE-modal-bubbles-320.png) | **fixture** | 게임 모달(`modal()`) 위에서 버튼·말풍선이 보이고 모달 본문을 가리지 않음 |
| [262-FIXTURE-result-bubbles-320.png](262-FIXTURE-result-bubbles-320.png) | **fixture** | 결과 화면 |

- **실서버**: 이 작업 트리의 서버(Jupiter 구현)를 격리 Postgres 55462 · HTTP 8085로 띄우고 헤드리스 Edge 프로필 두 개(localhost / 127.0.0.1)로 접속했다. 가입·방 만들기·참가는 페이지 함수 호출로, 여는 버튼·이모티콘·숨김 체크는 실제 CDP 마우스 클릭과 Esc 키로 했다(클릭 전 `elementFromPoint`로 가려지지 않음을 확인). 실측: 양쪽 수신·읽어 주기 문구, 44px 최소 높이, Esc 뒤 포커스 복귀, 클라이언트 잠금을 일부러 우회해 보낸 두 번째 전송이 서버에서 거부되고 retryMs로 4.6초 초읽기·상대 화면 변화 없음, 새로고침 뒤 서버 간격 유지, 숨김 저장값 "1"과 숨긴 동안 상대 말풍선 없음.
- **fixture**: 같은 8085 페이지에서 오프라인 엔진으로 보드를 만들고 `NET`에 공개 방 필드를 주입한 **가짜 상태**다(소켓·서버 없음). 배치 판단 전용이며 회선 증거가 아니다. 이 빌드의 S01 시작 상점은 모달이 아니라 화면 안 패널이라, 모달 위 도달성은 fixture로만 확인했다. 정기 상점·가방·전투 모달의 실서버 확인은 하지 않았다(같은 `.overlay` 층이라 fixture 결과와 같다고 **추론**).
- 360/390/432 fixture와 360/390/432 실서버 고르기 창 캡처는 scratchpad에만 두었다(보고서에는 대표 폭만).

## 5. 검사 (각 1회 원칙 · 재실행 사유)

| 검사 | 결과 | 실행 횟수·사유 |
|---|---|---|
| `node demo/test/regression/smoke_issue262.js` (신규) | 55/55 PASS | 2 — 말풍선 배치 변경 뒤 1회 재실행 |
| `npm run typecheck` | PASS | 2 — 같은 배치 변경(ui.js) 뒤 1회 재실행 |
| `npm run test:typecheck` | 72/0 PASS (서버 COMMAND_TYPES의 `emote` = 봉투 계약) | 1 |
| smoke_online.js | 158/1 → **159/0** | 2 — D10 정적 저장 가드(setItem 3곳 고정)가 승인된 숨김 저장으로 실패. PD 승인 범위로 D10만 4곳 + `dd_emote_mute`/`"1"` 고정값 확인으로 고쳤다. D8/D9 그대로 |
| smoke_tutorial.js | 138/1 → **139/0** | 2 — G17이 튜토리얼 절 이후 CSS 전체를 보므로 이모티콘 CSS를 튜토리얼 절 앞으로 옮겼다(규칙 불변) |
| smoke_public_rooms 182/0 · smoke_online_sync 23/0 · smoke_issue263_client 164/0 · smoke_issue259 208/0 · smoke_issue260 74/0 · smoke_memo 122/0 | PASS | 각 1 — 말풍선 배치 변경 **전** 실행. 변경은 이모티콘 전용 DOM·CSS·함수라 재실행하지 않았다 |
| 실서버 2브라우저 스크립트 (scratchpad) | PASS | 5 — ①B 목록 갱신을 5초 폴링에 기대다 시간 초과 → 명시 새로고침 ②방 번호 칸 이름 오기(`roomId`) ③A 방 만들기 15초 무응답(원인 미확인·재현 안 됨, 짧은 시간 연속 생성 제한일 수 있다는 **추론**) → 진단 추가 ④PASS ⑤배치 변경 뒤 증거 갱신 PASS |
| fixture 스크립트 (scratchpad) | — | 5 — 첫 회는 제목 화면에 그려짐(UI.entered 누락), 이후 배치 수정 확인용 폭별 캡처 |

필수 CI: `.github/workflows/ci.yml`의 "턴 흐름·전투·온라인 규칙 회귀" 단계에 `smoke_issue262.js` 한 줄과 설명만 추가했다(잡 이름·필수 검사 6개 불변). 원격 CI 결과는 아직 없다(Git 쓰기 없음).

## 6. 변경 파일

- `demo/js/network.js` — NET 필드·`NET.sendEmote`·수신/거부/잠금 함수·방 수명주기 연결
- `demo/js/ui.js` — 목록·층 표시·말풍선·초읽기·숨김·닫기/포커스·정리, `render()`/`netLeave()` 연결
- `demo/index.html` — `#emoteLayer`·`#emoteLive` 마크업
- `demo/css/game.css` — 층·버튼·창·말풍선·동작 줄이기
- `tools/typecheck/contracts.d.ts` — `emote` 봉투·`EmoteId`
- `demo/test/shared/harness.js` — 이모티콘 함수 노출 1줄
- `demo/test/regression/smoke_issue262.js` — 신규
- `demo/test/regression/smoke_online.js` — D10만(PD 승인)
- `.github/workflows/ci.yml` — 신규 테스트 1줄
- `tools/qa/issue260_local.js` — `--issue262`(PG 55462 · HTTP **8085** · `qa/issue-262-local`). 기존 기본값·`--issue261`·데이터 불변
- 이 보고서와 PNG 8장

서버·Jupiter 파일은 읽기만 했다.

## 7. 로컬 QA 서버 (CJ 확인용)

- 주소: **http://localhost:8085/** (8084는 이 PC의 Plastic SCM 서비스 plasticd.exe PID 4956이 쓰고 있어 PD 승인으로 8085로 바꿨다. 그 프로세스는 건드리지 않았다)
- 상태: `node tools/qa/issue260_local.js status --issue262` · 정지: `… stop --issue262`(데이터는 남는다)
- 새 격리 데이터: `C:/Users/pc_77/orca/qa/Digit-Duel/issue-262-local`(사용자 전용 ACL, 새 클러스터). #259/#260/#261 서버·DB·계정·8081/8082/8083·55459~55461은 그대로다.
- 첫 기동은 `server/node_modules`가 없어 실패했다 → `server/`에서 `npm ci`(잠금 파일 그대로 16개, gitignore 대상)로 설치 후 재기동 PASS. 루트에서도 `npm ci`(typescript 1개, CI와 같은 절차)를 했다. 새 의존성 추가 0.
- 계정: 격리 DB에만 QA 계정 약 10개(`qa262a…`/`qa262b…`, 이메일 `@example.invalid`). 가입은 메일을 보내지 않는다(서버 mailer는 비밀번호 재설정에만 쓰임 — 코드 확인). 재설정·이메일 등록 요청 0, 계정 삭제 0, SMTP 설정은 도구가 읽기만.
- 주의(제품 흐름 아님): 같은 브라우저에서 `localhost`와 `127.0.0.1`은 다른 사이트라 쿠키·로그인이 따로다. 반대로 같은 호스트의 다른 포트(8083·8085)는 쿠키를 공유할 수 있어 여러 QA 서버를 한 브라우저에서 번갈아 쓰면 로그인이 섞일 수 있다. 두 계정 대전은 두 브라우저(또는 프로필)나 두 호스트명으로 연다.

## 8. 한계·남은 일

- 보드·정기 상점·가방·전투·결과의 실서버 전 과정은 확인하지 않았다(fixture만). Saturn 독립 QA와 CJ 플레이 QA가 최종 확인이다.
- 말풍선이 뜬 채로 화면이 바뀌면(2.5초 안) 제목 칸 위치를 다시 재지 않는다. 폭이 크게 다르지 않아 두었다.
- 스크린리더는 같은 문구가 연속으로 오면 다시 읽지 않을 수 있다(aria-live 값이 같음).
- QA 서버·PG는 CJ 확인을 위해 켜 둔다. 헤드리스 Edge QA 프로세스는 모두 종료했다(잔존 0 확인).
