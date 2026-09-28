# #260 Mars — 계정 로비·로딩·싱글 잠금 (클라이언트)

- 역할: Mars / IMPLEMENT / CLIENT / code · Claude Opus 5.5 high · Ponytail full · Git 명령 미사용
- 기준: 작업 트리 `issue-260-account-lobby` (HEAD 24945b7 기준 dispatch), GitHub #260 본문, CJ 확정 사항(dispatch 전달)
- 분류: [결정] CJ 확정 정책 구현. 서버 필드는 PD 확정 계약(2026-09-27) 반영

## 한 일 (확정)

| 영역 | 내용 | 파일 |
|---|---|---|
| 진입 흐름 | 로그인 유지여도 타이틀 → [시작] → 실제 로딩 → 로비. 진행 중 좌석 재접속(#259 `acctResumeSaved`)은 그대로 | `demo/js/lobby.js`, `demo/js/ui.js`(uiApply 한 줄), `demo/js/bootstrap.js` |
| 로딩 | 화면 자산(n/m 실제 완료 수)·계정 정보·방 목록 항목별 상태. 퍼센트 없음. 요청마다 8초 제한(AbortController+경주). 자산 실패·무응답은 이모지·CSS 대체. 프로필 오류·무응답은 오류+[다시 시도], 전적을 0으로 꾸미지 않음. 401 E_NO_SESSION 은 #259 로그아웃 경로. 방 목록·최근 기록은 로비를 막지 않음 | `lobby.js` |
| 로비 재진입 | 어느 경로로든(시작·결과·방 나가기·재접속 실패) 로비로 들어오는 순간 한 번 다시 불러온다 — `uiApply` 의 화면 전환 한 곳 | `ui.js` |
| 로비 | 닉네임·서버 전적(승·패)·대표 하수인·재화 0·멀티(기존 공개 방 목록/생성/참가)·싱글 두 카드 잠금·최근 기록 20·잠긴 메뉴 7(설정·재화 획득·미션·이벤트·로비 상점·하수인 설정·랭크). Google 로그인은 #259 잠금 그대로 | `lobby.js`, `demo/css/game.css` |
| 잠금 UX | `aria-disabled` 버튼(키보드 포커스·Enter/Space) → `role=status` 안내 "추후 공개 예정" | `lobby.js` |
| 대표 하수인 | 일반 ROSTER 30종만, 기본 M-F1 새끼 화룡, 서버 저장 성공 때만 반영, 아트 없는 10종은 기존 속성 이모지. 방 좌석 `reps[]`(30종 ID만) 를 방 막대·준비 화면에 상대 닉네임과 표시 | `lobby.js`, `demo/js/network.js`(수신 1줄·NET.reps), `ui.js`(방 막대 2곳) |
| 제거 | 페이지 로드 튜토리얼 자동 표시·타이틀/상단 `?`·로비 튜토리얼 버튼·옛 PVE 5급/5단·핫시트·관전 링크·경기 중 도움말 표시. 튜토리얼 모듈·엔진 `startMode`·AI 난이도는 회귀용으로 유지(CJ/PD 선택 A) | `demo/index.html`, `bootstrap.js`, `ui.js` |
| 접근성 | 터치 44px+, 로딩 제목 → 로비 제목 초점 이동, focus-visible, safe-area, reduced-motion 정지 로딩 | `game.css`, `lobby.js` |
| 자산 | #253 Earth `icons.svg`·`panel.svg` 를 `demo/assets/ui/` 로 복사(원본 무수정). frame/buttons/status/wait 는 이번 화면에서 쓰지 않아 복사하지 않음 | `demo/assets/ui/*` |
| 주석 | CSS 의 '복구 코드 표시' → '이메일 코드 비밀번호 재설정·이메일 등록' | `game.css` |

## 서버 계약 — PD 확정(2026-09-27) 반영

클라이언트는 `lobby.js` 의 `LOBBY_API`·`lobbyParseProfile`·`lobbyParseHist` 와 `network.js` 의 `reps` 한 줄만 본다.

- `GET /api/profile` → `{nickname, representativeMinion, stats:{wins,losses}, matches:[≤20 {result:WIN|LOSS|NO_CONTEST, reason, opponentNickname, turns, durationMs, endedAt}], pendingMatches}` — 프로필·기록을 한 요청으로 받는다(별도 /matches 요청 제거).
- `pendingMatches` 는 "결과 저장을 기다리는 경기 N건" 안내로만 보인다(음 아닌 정수만 — PD 확정). 전적을 추정해 더하지 않는다.
- `POST /api/profile/representative {minionId}` → `{representativeMinion}` — 응답 값이 요청과 같을 때만 반영.
- 방 프레임 `reps:[seat0Id|null, seat1Id|null]` (players[] 무변경). 30종 밖 값은 그리지 않는다.

## 로컬 QA 보조 — `tools/qa/issue260_local.js` (PD 확정: Mars 소유)

```powershell
node tools/qa/issue260_local.js start                # 숨김·분리 기동(WMI). 처음이면 폴더·클러스터 생성 → PG 55460 → 서버 8082(기동 때 마이그레이션)
node tools/qa/issue260_local.js status               # 두 포트 · /readyz
node tools/qa/issue260_local.js stop [--server-only]  # 정지 — 데이터(pgdata)는 남는다
```

- 폴더 `C:/Users/pc_77/orca/qa/Digit-Duel/issue-260-local` (pgdata·logs·secrets — secrets 는 사용자 전용 ACL, 무작위 DB 비밀번호). 주소 **http://127.0.0.1:8082/**
- `server/` 무수정 실행 · `DD_DB_MIGRATE_ON_START=1` 로 서버가 미적용 마이그레이션을 적용 · #259 의 `pg18/bin` 실행 파일과 `secrets/smtp.json`(있으면)만 **읽기 전용** 재사용 — 값은 서버 자식 환경에만.
- 이 도구는 `/healthz`·`/readyz` 말고 API 를 부르지 않는다(메일·가입·삭제 0). 8081·55459·#259 데이터는 보지도 않는다. 아무것도 지우지 않는다.
- `stop` 은 8082 소유 프로세스의 명령줄이 `authoritative/server.js` 일 때만 끈다.
- 결과 저장 재시도 파일 `DD_RESULT_OUTBOX=<QA>/data/match-results-outbox.jsonl` — **확정**(Jupiter ctx_3f87b31151ef, 005 동결, 상한 200 서버 고정, 다른 env 없음).
- 보강(후속 task_f5a62fc536de): QA 폴더 전체를 만들 때 상속을 끊고 현재 사용자만 두며 매 기동 `Get-Acl` 로 다시 확인(다른 주체·상속이면 중단) — data/·logs/·secrets/ 는 이를 상속. `stop`·재사용은 8082 를 듣는 PID = 띄울 때 기록한 `run/server.pid` 이고 명령줄이 `authoritative/server.js` 일 때만, 55460 은 그 포트 PID = 우리 `postmaster.pid` 일 때만. ACL 식은 스크래치 폴더(양성)·상위 `qa/Digit-Duel`(음성)로 먼저 확인했다.
- **기동 [확정] 2026-09-27 17:57 KST (PD GO_START)**: 첫 `start`(17:53)는 initdb·PG 기동 뒤 멈췄다 — `pg_ctl start` 를 `spawnSync` 파이프로 불러 postgres 가 그 파이프를 물려받아 EOF 가 오지 않았다. `pg_ctl` 을 `stdio:"ignore"` 로 바꾸고, 멈춘 up 부트스트랩(38776)만 명령줄 정확 일치 확인 뒤 종료(PG 31704·데이터 보존, 재초기화 없음), `start` 1회 재시도.
- 현재: **PG pid 31704 (55460, 우리 클러스터) · 서버 pid 33464 (8082)** · `/healthz` 200 · `/readyz` 200 `ok (db)` · `GET /` 200 · 무쿠키 `/api/auth/session` 401 · 제공 `js/lobby.js` 16,526 B = 작업 트리. 서버 로그: 001~005 적용 · SMTP 설정됨(#259 smtp.json 읽기만). 로그 3종에 DB 비밀번호 없음. 계정 생성·메일 발송·#259 변경 0 — 8081(36888)·55459(34176) 그대로.

 (각 1회, 출력·종료 코드 같은 실행에서 수집)

- 신규 `demo/test/regression/smoke_issue260.js` — 최종 68 pass / 0 fail (후속: 서버 `E_RESULTS_BACKLOG` 생성·참가 거부 → "지난 경기 결과를 저장하는 중…잠시 후 다시 시도" 안내, 로비·프로필·버튼 유지 6건 추가, 1회 실행). CI A 잡에 추가(`.github/workflows/ci.yml`).
- 최종 배치: `tsc`·`typecheck_test`·CI A 잡 명령 전부 1회 → smoke_cycle5·smoke_turnflow·smoke_issue245 만 실패(아래 계약 갱신), 나머지 전부 EXIT 0. 수정 뒤 그 셋과 smoke_issue260·tsc 만 재실행 → 모두 EXIT 0 (cycle5 70/0, turnflow 203/0, issue245 352/0).
- 총 실행 횟수(최종 배치 포함, 매번 직전 수정이 있었음 — 예외 1건): smoke_issue260 14(Saturn REVISE 2 포함 · 최종 계약·pendingMatches 정수·E_RESULTS_BACKLOG 각 1 포함) · smoke_issue259 는 최종 계약 뒤 1 추가 · smoke_tutorial 7(**그중 1회는 수정 없이 재실행** — 내 grep 필터가 출력을 가려 결과를 다시 수집했다. 반복 제한 위반으로 보고한다) · smoke_issue259·smoke_public_rooms·smoke_online·back_nav 4 · smoke_issue146 3 · issue122_rules·cycle5·turnflow·issue245 2 · fx_consumer·issue236·issue263_client·own_side 2(첫 영향 확인 1 + 최종 배치 1) · 그 밖의 A 잡 명령 1.
- 마지막 `lobby.js` 변경(실패 자산만 재요청)은 최종 배치 뒤라 smoke_issue260(B11 강화)·tsc 로만 확인.
- 네트워크 실서버 통합(B 잡)·브라우저는 실행하지 않음.

### 계약이 바뀐 기존 단언 (기대값을 낮추지 않고 새 정책으로 교체)

| 파일 | 바뀐 것 |
|---|---|
| `smoke_tutorial.js` | 자동 표시 단언 → "자동 표시 없음", 진입점 단언 반전. 내용·a11y·키보드 절은 `tutOpen()`/`tutHint()` 직접 호출로 유지 |
| `smoke_issue146.js` E | #128 로드당 1회 → #260 자동 표시·`?` 없음. 저장 흔적 0·공유 경로 없음 그대로 |
| `smoke_cycle5.js` H1 | 로비 5급/5단 버튼 → 진입점 없음 + 엔진 난이도 표기 유지 |
| `smoke_issue259.js` | 소켓 단언이 로비 로딩의 방 목록 소켓(`l-`)만 제외(`rs()`), D3b·G1 은 로비 프로필 GET 허용 |
| `smoke_issue245.js` | 스크립트 순서에 `lobby.js` |
| `smoke_turnflow.js`·`back_nav.js` | 스텁 요소를 `byId`/`hidden` 으로 직접 준비(자동 튜토리얼이 만들던 것) |
| `harness.js` | `LOBBY`·`lobby.*` 노출 |

## Saturn REVISE 수리 (task_e3819aaa286b · 2026-09-27)

| 지적 | 조치 | 파일 |
|---|---|---|
| 계정 탭 40px | `#acctPanel` 탭·모든 버튼·입력 `min-height:44px`(미디어 규칙의 덮어쓰기 없음 — 뷰포트 무관, 432 포함). 새 로비 컨트롤(잠금·재시도·대표 선택·카드)은 이미 44 이상 | `demo/css/game.css` |
| 무효 경기 사유 | 서버 `matchReason` 어휘대로 `both_disconnected` 양쪽 연결이 모두 끊겨 무효 · `server_restart` 서버 재시작으로 무효 · `server_error` 서버 문제로 중단. 모르는 값은 '경기 종료' — 원 코드 비표시 | `demo/js/lobby.js` |
| 내부 문서 노출 | 로비·준비·결과에 보이던 'ℹ️ 기준 문서·간소화 범위'(GDD·[DATA]·구현 메모) 서랍 제거, 지표 서랍 제목 '📊 지표 (GDD-12 연동 스캐폴드)' → '📊 경기 지표'. 라이선스·저작권 문서는 무변경 | `demo/index.html` |

- 잠긴 메뉴는 그대로 aria-disabled + '추후 공개' 안내, 실제 로딩·오류·재시도와 대표 30종·입장 고정 계약 무변경.
- 검사: `smoke_issue260.js` 2회 — 1차 74 중 D3 1건 실패(픽스처가 서버가 보내지 않는 사유 `NO_CONTEST` 를 썼고, 제거한 `no_contest` 라벨에만 기대 통과하던 것) → 픽스처를 서버 어휘(`resign`·`forfeit`·`both_disconnected`)로 맞춘 뒤 **74 pass / 0 fail**. 새 단언: D8 무효 사유 3종·모르는 값·원 코드 비표시, G1~G4 계정 44px·미디어 덮어쓰기 없음·새 컨트롤 44·내부 문서 문구 없음. 다른 스위트는 이 문자열·서랍·높이를 보지 않아 재실행하지 않았다. 8082/55460·8081/55459·DB·SMTP 무변경.

## 남은 일·증거 필요

- 확정 계약 반영 뒤 smoke_issue260 61/0 · smoke_issue259 208/0 · tsc 0 (각 1회).
- QA 보조: `tools/qa/issue260_local.js` (Mars 소유, PD 확정).
- Mercury: `demo/assets/ui/` 를 `ASSET-LICENSE.md` 제외 목록에 추가(#253 원본 파생).
- 스크린샷 필요(Saturn/CJ, 브라우저): 320·390·432px 에서 ① 타이틀(로그인 유지) ② 로딩(자산·계정·방 목록 항목) ③ 프로필 오류+다시 시도 ④ 로비 전체(잠금 9·재화 0·기록) ⑤ 대표 하수인 선택 창 ⑥ 방 막대의 상대 대표 하수인 ⑦ reduced-motion 정지 로딩. 실제 전적 일치(AC1)는 Jupiter 서버와 함께 실서버에서만 확인 가능.
