# Issue #93 — 온라인 양측 자기 진영 아래 표시 (Mars_2 구현 납품 보고)

- 역할: **Mars_2** (instance=Mars_2 · instance_index=2 · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- Task `task_c0e8c2226a2d` · dispatch `ctx_cb260ff4ed07` · 브랜치 `fix/93-own-side-bottom` · 기준 dev `dadc8bc` (#91/#95 통합) · 작업공간 폴더명은 `fix-95-attack-archetype-balance`(재사용)이나 작업은 #93 만
- 근거 문서: `CLAUDE.md` · `docs/v0.4.4-gameplay-spec.md` 5장(#93 기술 계약·AC 1~5, 읽기 전용) · PD dispatch 계약(TASK 블록) · PD 중간 메시지 "실제2클라이언트 CDP 재사용 참고"(#94 `memo_cdp.js` 배선 참고 — 읽기만, 복사·수정 없음)
- 작성: 2026-09-07
- **이 문서가 주장하는 범위**: 기계로 잰 사실과 저장한 화면 증빙까지다. **Saturn 독립 QA와 CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다.** 아래 통과 수치는 Mars_2 자기 검증이고 Saturn 판정이 아니다. Git 쓰기·GitHub·Notion 기록은 하지 않았다(PD 집행).

---

## 1. 무엇을 바꿨나 (`demo/index.html` — 3개 지점, +10/−3 줄)

| # | 위치 | 변경 | 확정/추론 |
|---|---|---|---|
| 1 | 유틸 (`humanViewer` 아래, :606~611) | **신설** `const boardFlipped=()=> NET.mode&&NET.me===1;` — 표시 전용 반사 조건 (주석에 단계별 근거) | [확정] G1 |
| 2 | `renderBoard` (:664~666) | 순회를 `for i=1..13` 화면 행으로 바꾸고 `r = flip ? 14−i : i` 로 논리 행을 잡는다. `cell.dataset.r=r; cell.dataset.c=c` · 강조·칩·클릭(`onCell(r,c)`)은 모두 논리 좌표 그대로. 열 순서 불변. `#board` 에 `data-flip="1|0"` 표시 메타데이터 1개 추가 | [확정] C3·D3·G2 |
| 3 | `netStart` (:3104~3105) | 시작 로그·토스트의 고정 문구 `"P1(하단)"/"P2(상단)"` → `당신은 P${me+1}입니다 (자기 진영이 화면 아래)` / `P${me+1} — 자기 진영이 화면 아래입니다` (P2 가 이제 하단이므로 "상단" 문구가 거짓이 되는 것을 막음. 좌표 로그는 손대지 않음) | [확정] C8·C9·G4 |

바꾸지 않은 것: `S`·`dataset.r/c`·`onCell→netAction({t:"cell",r,c})`·네트워크 메시지·로그 좌표·`applyNetSetup`(P2 행 미러링 `14−r`, 열 유지 — G3)·`humanViewer`·`visibleTo`·강조 조건식·핫시트 `pname` 문구(G5)·PVE/핫시트/sim 렌더(A1~A6)·서버·아트·기획 문서. 상태를 화면 좌표로 되돌리는 역변환은 어디에도 없다(G7).

### 1.1 표시 조건을 `NET.mode && NET.me===1` 로 고른 이유 — 단계별 소스 확인 [확정]

| 단계 | 상태 | 보드 방향 | 근거 |
|---|---|---|---|
| 온라인 사전 배치 (`netPrepare`) | `NET.mode=false`, `NET.me=null`, `newGame("pvp")` 로컬 P0 배치(11~13행) | **뒤집지 않음** — 이미 자기 진영 하단 | B1·B2, CDP "A/B 배치 단계" |
| 매칭 대기 (`setupDone` → `netConnect`, `NET.queued`) | `NET.mode=false` | 뒤집지 않음 | CDP "A 매칭 대기 중" |
| `matched` 수신 (`NET.me=1` 결정, 아직 `netStart` 전) | `NET.mode=false` | **뒤집지 않음** — `NET.me` 단독 조건이었다면 여기서 이미 하단인 배치 화면을 위로 올리는 이중 반전이 생긴다 | B3 |
| `netStart` (`NET.mode=true` → `applyNetSetup(1)` 이 P2 말을 1~3행으로 미러링 → `beginPlay`) | `NET.mode=true`, `NET.me=1` | **여기서부터 반사** — 논리 1~3행(내 진영)이 화면 아래 | C3~C7, CDP 2절 |
| 대전 중 · 전투 모달 | 동일 | 반사 유지 (전투 모달은 보드와 무관, 기존 `mySide` 로직 그대로) | D·E |
| 종료 (`over`, viewer=2 전체 공개) | `NET.mode` 유지 | 반사 유지 — 리빌이 보던 방향 그대로 | F1·F2·F4 |
| "처음으로" | `location.reload()` | NET 초기화 | (기존) |

P1(`NET.me===0`)·핫시트 PVP(현재 플레이어가 P2여도)·PVE·sim 은 조건이 거짓이라 종전과 동일하다(A1~A6, C4).

---

## 2. 계약(AC) 대조 — `docs/v0.4.4-gameplay-spec.md` 5장

| AC | 요구 | 상태 | 근거 |
|---|---|---|---|
| (1) | 2P 화면에서 자기 진영(1~3행)이 아래, 1P 화면은 종전과 동일 | 충족 | 헤드리스 C3~C6 · CDP: B 픽셀 y(1행)=729 > y(13행)=81, 내 말 14개 최소 y 621 > 상대 말 최대 y 189 · A 는 flip=0·(1,1) 첫 칸 · 스크린샷 1·2 |
| (2) | 2P 가 반전 화면의 칸을 클릭하면 논리 좌표로 이동·전투·메모가 정확히 적용 | 충족(이동·메모 실측, 전투는 강조 위치 실측) | CDP: 실제 마우스 클릭 → `S.selected.id` 논리 말, 목표 클릭 → 양측 (2,5) 이동 · 메모 피커 제목 "(11행 5열)" 논리 좌표 · 헤드리스 D3~D9(네트워크 메시지 `{t:"cell",r,c}` 논리 좌표 그대로) · 전투 진입은 클릭 경로가 `onCellCore(r,c)` 논리 좌표로 동일하고 hl-attack/강제 대상 강조 위치를 E5·E6 로 확인 |
| (3) | 양 클라이언트 `S` 동일(스냅샷 대조) | 충족 | 헤드리스 C1·D1·D10·D13·D14 · CDP: 시작·턴 교대·이동·메모 후 4회 스냅샷 동일 (실제 릴레이 서버 경유) |
| (4) | 배치·메모·선택 표시가 2P 화면에서 올바른 칸에 | 충족 | 배치 트레이는 배치 단계(미반사) 그대로(B2) · 선택/합법 이동/공격/강제 전투/텔레포트 1·2단계/버닝 2칸/메모 추측/흔적 🔍 — 반사·비반사 렌더의 논리 칸별 서명 동일 + DOM 순서만 반사(E1~E11) · CDP 스크린샷 3 (선택 흰 테두리 + 위쪽 파란 이동 칸) |
| (5) | 회귀 통과 | 충족 | 기존 7묶음 689/689 (기준 dadc8bc 에서도 동일 수치) + 신규 63/63 + CDP 18/18 |

계약이 열거한 검증 항목 중 **튜토리얼 힌트**는 보드 칸을 가리키지 않는(텍스트 카드형) 구조라 위치 검증 대상이 없었다 — `tutHint("teleport"/"burning")` 호출 조건은 손대지 않았다 [확정]. **버닝 타임**은 E9 (2칸 직선 hl-move) 로 확인했다.

---

## 3. 테스트 — 정확한 실행 명령 · 결과

```
node demo/test/smoke_own_side.js        # 63/63 — #93 신규 (A 오프라인 무변경 6 · B 배치/대기 4 · C 시작 13 · D 입력/락스텝 17 · E 강조 12 · F 종료 4 · G 소스 7) · 파일 쓰기 0
node demo/test/smoke_cycle5.js          # 69/69
node demo/test/smoke_memo.js            # 49/49
node demo/test/smoke_tutorial.js        # 124/124
node demo/test/smoke_online.js          # 157/157   (※ mutant HTML 을 os.tmpdir 에 쓰는 원본 — Saturn 실행 금지, Mars 결과만 기재)
node demo/test/smoke_testclient.js      # 41/41
node demo/test/smoke_minion_art.js      # 199/199
node demo/test/smoke_attack_balance.js  # 50/50
```

합계 **752/752 = 기존 689 + 신규 63** (종료 코드 모두 0). 기존 7묶음은 변경 전 `dadc8bc` 사본으로도 같은 수치(`smoke_testclient` 는 경로 인자를 받지 않는 서버 test-client 검사라 사본 실행에서 제외 — 이번 변경과 무관한 파일).
"현행 571" 은 #91·#95 이전 기준이며, 이번 기준 `dadc8bc` 의 같은 7묶음은 571 + #91 신설 68 + #95 신설 50 = 689 이다.

**음성 대조 (변경 전 HTML 로 같은 테스트, 파일 작성 0)**:
```
git show dadc8bc:demo/index.html | node demo/test/smoke_own_side.js --stdin   # 30/63 · 종료 코드 1
```
실패 33개 = A1~A6(`data-flip` 속성 부재) · B2·B3 · C3·C3b·C4·C5·C7·C8·C9 · D4·D5·D6·D11·D15 · E1·E3·E4~E9·E11 · F1·F2 · G1·G4 — 전부 #93 이 새로 고정한 단언이고, 논리 좌표·락스텝·미러링·비노출 단언(B1·C0~C2·C6·C7b·C10·D0~D3·D7~D10·D12~D14·D16·E0·E2·E10·F4·G2·G3·G5~G7)은 옛 HTML 에서도 통과한다 — 테스트가 표시 변경분만 잡는다는 근거. `--stdin` 은 `fs.readFileSync` 의 제품 HTML 읽기만 메모리 사본으로 대체하며 저장소 밖에도 파일을 만들지 않는다.

### 3.1 `smoke_own_side.js` 설계 메모
- 기존 `harness.js` 를 그대로 쓴다(수정 0). 온라인 두 클라이언트는 하네스 2로드 + 스텁 소켓의 `sent` 를 상대 `onmessage` 로 옮기는 중계(`relay`)로 재현하고, 실제 `matched→hello→hello2` 순서로 시작한다.
- 하네스는 제품이 `window.X=` 로 붙이는 심볼(`setupDoneCore`·`netConnect` 등 33개)을 Node 전역에 그대로 두므로, 두 로드를 번갈아 조작할 때 `use(T)` 로 그 로드의 심볼을 되돌려 놓는다(테스트 쪽 조치, 하네스·제품 무수정).
- E 절 "서명 동일" 검사는 같은 뷰어(P2, `S.current=1`)를 온라인(`NET.mode=true, me=1`, 반사)과 핫시트(`NET.mode=false`, 현재 플레이어=1 → `humanViewer()=1`, 비반사)로 두 번 렌더해 논리 칸별 클래스·강조·칩 HTML 이 같고 DOM 순서만 반사인지 본다.

---

## 4. 실제 Chrome 2클라이언트 증빙 — `demo/test/issue93_cdp.js`

```
node demo/test/issue93_cdp.js                 # 18/18 · 문제 0건 · PNG 4장 + docs/qa/issue93/issue93_cdp_report.json
node demo/test/issue93_cdp.js --read-only     # 18/18 · 산출물 0, stdout 만 (docs/qa/issue93 디렉터리 목록 해시 전후 동일 확인)
```

조건: 헤드리스 Chrome(로컬 `chrome.exe`) · CDP 탭 2개 · **실제 릴레이 서버** `server/server.js` 를 `PORT=0` 임의 포트·루프백으로 검증 전용 기동(사용자 8080 서버 무접촉, 접속 코드는 서버 stdout 에서 읽어 프로세스 메모리에만) · 페이지는 `http://127.0.0.1:<port>/index.html` · 뷰포트 1280×1000(13행이 스크롤 없이 들어와 픽셀 y 비교가 스크롤과 무관) · 제품 코드 무수정, 메뉴/배치/매칭 버튼은 실제 DOM 버튼 클릭, 보드 칸·메모 선택지는 `Input.dispatchMouseEvent` 실제 마우스 클릭.

| # | 측정 | 결과 |
|---|---|---|
| 1 | A·B 배치 단계: `data-flip=0` · 첫 칸 (1,1) · 내 말 14개 아래 (y13=729 > y1=81) | ok |
| 2 | A 매칭 대기: `NET.mode=false` · flip=0 | ok |
| 3 | 실제 서버 매칭: A=P1(me 0) · B=P2(me 1) · 양측 play · 스냅샷 동일 | ok |
| 4 | B 보드: flip=1 · DOM 순서 행 반사(열 유지) · 첫 칸 (13,1) · 마지막 (1,7) | ok |
| 5 | B 픽셀: y(1행)=729 > y(13행)=81 · 내 말 14개 최소 y 621 > 상대 14개 최대 y 189 | ok |
| 6 | B `elementFromPoint` 보드 좌상단 픽셀 → 논리 (13,1) | ok |
| 7 | A 보드: flip=0 · (1,1) 첫 칸 · 내 말 아래 · 좌상단 픽셀 (1,1) | ok |
| 8 | P2 턴으로(A 실제 버튼 "주 행동 생략"·"턴 종료") · 상태 동일 | ok |
| 9 | B 기하: 내 말 (1,5) y=729, 전방 (2,5) y=675 — 전방이 화면 위 · 내 말은 보드 아래 절반 | ok |
| 10 | B 실제 클릭 (1,5) → `S.selected.id=73` · hl-sel [(1,5)] · hl-move [(2,5),(1,6)] | ok |
| 11 | B 실제 클릭 (2,5) → A·B 모두 논리 (2,5) 이동 · 스냅샷 동일 | ok |
| 12 | 이동 후: B own 칩 y=675(반사 위치) · A 상대 칩 y=135(종전 규칙) · 양쪽 DOM 순서 유지 | ok |
| 13 | B 상대 말 (11,5) y=189 — 보드 위 절반 · 실제 클릭 → 기존 메모 피커 "(11행 5열)" | ok |
| 14 | 👑 저장 → 추측 칩이 (11,5) 반사 위치(y=189, 클릭 픽셀과 동일)에 · `S.memos[1][57]="king"` · 양측 논리 상태 여전히 동일 | ok |
| 15 | A 화면에 B 메모 비노출 | ok |
| 16 | 콘솔 오류 0 (두 탭) | ok |

스크린샷(`docs/qa/issue93/`): `http_desktop-1280_1-p2-start-own-bottom.png`(P2 시작 — 내 말 아래·? 상대 위, 토스트 "P2 — 자기 진영이 화면 아래") · `http_desktop-1280_2-p1-start-unchanged.png`(P1 종전) · `http_desktop-1280_3-p2-selected-highlights.png`(P2 (1,5) 선택 흰 테두리 + 위쪽 (2,5)·오른쪽 (1,6) 파란 이동 강조) · `http_desktop-1280_4-p2-after-move.png`(이동 후). 캡처 시점상 토스트가 상단 두 행 위에 겹쳐 있으나 게임 상태·판정과 무관하다(토스트는 2.3초 자동 소멸).

---

## 5. Saturn 재실행 경로 (읽기 전용)

```
node demo/test/smoke_own_side.js                                              # 63/63, 파일 쓰기 0
git show dadc8bc:demo/index.html | node demo/test/smoke_own_side.js --stdin   # 30/63 종료 1 (음성 대조, 파일 쓰기 0)
node demo/test/smoke_cycle5.js
node demo/test/smoke_memo.js
node demo/test/smoke_tutorial.js
node demo/test/smoke_testclient.js
node demo/test/smoke_minion_art.js
node demo/test/smoke_attack_balance.js
node demo/test/issue93_cdp.js --read-only                                     # 18/18, 산출물 0 · Chrome 임시 프로필(os.tmpdir()/i93cdp-*)·PORT=0 서버만 부수 생성·정리 (RESOURCE/CLEANUP 행)
```
주의: 원본 `smoke_online.js` 는 mutant HTML 을 `os.tmpdir()` 에 쓰므로 Saturn 실행 금지(위 Mars 157 결과와 구분). `issue93_cdp.js` 를 `--read-only` 없이 돌리면 `docs/qa/issue93/` 에 PNG·JSON 을 덮어쓴다. 의존: Node 22+(내장 WebSocket) · 로컬 Chrome · `server/node_modules`(ws, 기존 lockfile — 서버 코드 편집 없음).

---

## 6. 납품 파일 · 최종 SHA256

| 파일 | 역할 | SHA256 |
|---|---|---|
| `demo/index.html` | 제품 (변경 전 `bda17a75cac50718d4aee2286589ffc4f96553152a924332bd0ba1184daa419b`) | `dfd9eb16112d684c33e67273d045271fc4a011cfa86c75709d2ace4adf5a07f7` |
| `demo/test/smoke_own_side.js` | 신규 헤드리스 회귀 63 | `4d50ed48f9c55d884a53143c8f40751701a78705b69fea29fbed90577ed6afe2` |
| `demo/test/issue93_cdp.js` | 신규 실제 Chrome 2클라이언트 증빙 18 | `8e1c3cb9b5039b632471412ca70799b988a1e6292b770ccad2fd1d50b91226ed` |
| `docs/qa/issue93/http_desktop-1280_1-p2-start-own-bottom.png` | 증빙 | `6d79e523a346c8acf2eb66558ec8889c975e0d9bcde1d421e94842ba331ca4e9` |
| `docs/qa/issue93/http_desktop-1280_2-p1-start-unchanged.png` | 증빙 | `86e6470da7efa0a96268c13e02420c59c5ac68c042af966042b6505f0ccd2d00` |
| `docs/qa/issue93/http_desktop-1280_3-p2-selected-highlights.png` | 증빙 | `4759802b4d369d045303e9955c0593cb6094dd2a08048aa69ac17d7a68a5e714` |
| `docs/qa/issue93/http_desktop-1280_4-p2-after-move.png` | 증빙 | `b3c7cb352a0899debf253cb9643f89e008ab5e93d6cf1261f08f33681da5a649` |
| `docs/qa/issue93/issue93_cdp_report.json` | 측정 원본 | `0bb3b42abe301cec7173fd8f5ab8efade3a73059c4e2a390d844c6aa40d77d25` |
| `docs/qa/issue93-mars.md` | 이 보고 | (PD 취합 시 계산) |

`demo/index.html` 은 작업 트리 LF 그대로(`git ls-files --eol`: i/lf w/lf, attr eol=crlf — 기존과 동일 상태, 변경 전에도 같은 경고).

---

## 7. #94 통합 시 참고 · 한계 · [기획 필요] 없음

- **#94(상대 턴 로컬 메모)와의 좌표 정합** [확정]: 메모 칩은 `renderBoard` 가 논리 `(p.r,p.c)` 의 칸에 그리고, 피커는 클릭 칸의 `dataset.r/c` 논리 좌표로 `memoModal(p)` 에 도달한다(CDP 13·14). #94 가 `netAction` 우회 분기를 추가해도 `onCellCore(r,c)` 논리 좌표를 받는 한 상대 턴 메모도 반사 화면에서 같은 칸에 표시된다. 이번 기반에는 #94 미반영이며 동시 수정하지 않았다.
- **한계 1**: CDP 스크립트는 서버가 `demo/` 폴더를 서빙하므로 변경 전 HTML 로의 음성 대조는 헤드리스(`--stdin`)로만 했다.
- **한계 2**: 전투 진입 자체의 실제 클릭은 CDP 흐름에 넣지 않았다(전투는 좌표 무관 모달·기존 `smoke_cycle5` 범위). 전투 대상·강제 대상 강조 위치는 헤드리스 E5·E6 으로 확인했다.
- **한계 3**: 헤드리스 하네스의 `dataset` 은 문자열이 아닌 숫자를 담는 스텁이라 테스트는 수치 비교(`+x.dataset.r`)를 쓴다. 실제 DOM 값은 CDP 검사가 문자열→숫자 변환으로 확인했다.
- 기획 판단이 필요한 항목은 없었다. 반사 조건(`NET.mode && NET.me===1`)은 계약 "온라인 P2 화면에서만 행 반사"를 만족하는 기술 조건 선택이며 신규 규칙이 아니다.
