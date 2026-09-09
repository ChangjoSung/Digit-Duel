# Issue #104 — 온라인 양측 말·위치 불일치 (Mars_1 구현 납품 보고)

- 역할: **Mars_1** (required_role=Mars · mode=IMPLEMENT · area=HTML · mutation=code · instance_index=1 · provider=Claude Code)
- Task `task_da5f079c8e51` · dispatch `ctx_4cd47c9317d9` · 브랜치 `fix/104-online-piece-sync` · 기준 `ad5f2a8`(#92 통합) · #104 는 #93 의 sub-issue
- 근거: `CLAUDE.md` · `docs/v0.4.4-gameplay-spec.md` 5장(#93)·6장(#94) · PD dispatch TASK 블록 · PD 중간 메시지(2026-09-08 05:32Z: "같은 서버·같은 버전, 중앙 횡단 뒤 불일치 의심 — 가설로만 취급")
- 작성: 2026-09-08
- **이 문서가 주장하는 범위**: 기계로 잰 사실과 저장한 증빙까지다. Saturn 독립 QA·CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다. Git 쓰기·GitHub·Notion 기록은 하지 않았다(PD 집행). 서버(`server/`)는 읽기만 했고 변경하지 않았다(변경 불필요 — 3절).

---

## 1. 결론 요약

| 구분 | 내용 |
|---|---|
| [확정] 근본 원인 | `demo/index.html` `onCellCore` 의 **상대 말 분기가 뷰어 시점(`humanViewer()`=온라인 `NET.me`) 가시성으로 갈린다**. 온라인에서 같은 `{t:"cell",r,c}` 를 상대 클라이언트가 재생하면 그 칸의 말이 "자기 말"이라 항상 보이는 말로 분류되어, 행위자에게는 **숨은** 말(중앙을 넘어 내 쪽 숲에 비인접 은신)이 있는 칸으로의 **버닝 타임 2칸 이동**이 행위자 쪽에서는 `doMove` 충돌 처리(경유 칸 정지·일시 공개·강제 전투)되고 상대 쪽에서는 `memoModal` 분기(`NET.replaying` 이라 무동작)로 빠져 **이동이 적용되지 않는다**. 이후 양측 `S` 가 영구 분기한다(말 위치·`mainUsed`·전투 유무·이후 모든 판정). |
| [확정] 발생 조건 | ① 버닝 타임(표시 턴 65+, `BAL.burnStart`) ② 상대 말이 중앙(7행)을 넘어 **내 쪽 숲**(P2 기준 4·5행 / P1 기준 9·10행)에 내 말과 비인접으로 숨어 있음 ③ 그 칸으로 직선 2칸 이동(경유 칸 빈 칸). `expedZone` 규칙상 2칸 이동 목적지는 자기 쪽 숲까지만 가능하므로, **"상대 말이 중앙을 넘어온 뒤"** 에만 성립한다 — CJ 관찰("중앙 횡단 뒤 불일치")과 일치. 1칸 이동은 목적지가 항상 이동 말과 인접해 가시이므로 이 분기가 갈리지 않는다. |
| [확정] #93 무관 | #93 의 행 반사·`applyNetSetup` 미러링·시드·id·로스터 직렬화·수신 펌프 순서는 원인이 아니다. 자연 배치(서로 다른 로스터·수동 배치)로 시작한 직후 28개 말 정규 스냅샷(id 포함)·제출 배치 매핑·양측 뷰어 DOM 이 모두 일치했고, 12시드×최대 700행동 퍼즈(전투·강제 전투·탐색·턴 교대·BT 2칸·상대 잡음 클릭 포함)에서 위 분기 외 불일치 0건. 이 결함은 #11(메모 분기 도입) 이후 존재했으며 #93 이전 `dadc8bc`·`ad5f2a8` 소스에서도 같은 테스트가 실패한다(4.2절 음성 대조). |
| [확정] 수정 | 1행: `visibleTo(humanViewer(),p)` → `visibleTo(S.current,p)` — 분기를 **행위자 시점**으로 결정론화. 행위자 클라이언트(`NET.me===S.current`)·핫시트(`humanViewer()===S.current`)·PVE(사람 클릭은 `S.current===0`)에서는 종전과 완전히 같은 값이라 동작 변화 없음. |
| [추론] CJ 증상 대응 | "양측 말·위치가 다르다"는 이 분기 이후 한쪽에는 이동·공개·전투가 있고 다른 쪽에는 없는 상태다. 이후 행위자가 이어가는 행동(전투 버튼·턴 종료)은 상대 쪽에서 `netReady` 조건(`S.battle` 부재)에 막혀 큐에 쌓이거나 다른 상태에 적용되어 화면이 계속 어긋난다. |
| [미확정] | CJ 세션이 실제로 BT(65턴+)까지 진행됐는지는 확인하지 못했다(PD 확인 요청). BT 이전에 다른 원인이 있다면 이번 퍼즈(헤드리스)·CDP(실제 브라우저)로는 재현되지 않았다 — 혼합 버전·캐시 가설은 PD 지시대로 크리티컬 패스에서 제외했다(서버는 `Cache-Control`/`ETag` 를 보내지 않는다는 사실만 기록). |

## 2. 무엇을 바꿨나 (`demo/index.html` — 1개 지점, +5/−1 줄)

| 위치 | 변경 |
|---|---|
| `onCellCore` (:1052~1056) | `if(p&&p.owner!==S.current&&visibleTo(humanViewer(),p))` → `visibleTo(S.current,p)` + 4줄 주석(#104 근거). 그 안의 `initBattle`·`memoModal` 호출, 이후 `canMoveTo→doMove` 는 그대로. |

바꾸지 않은 것: `renderBoard`·`boardFlipped`·`applyNetSetup`·`netStart`·`netPump`/`netReady`·`modal` 래퍼·`memoClickTarget`·`memoModal`(로컬 메모·상대 비노출 유지)·전투·아트·기획 문서·서버·README·턴 흐름.

### 2.1 원인 확인 경로 (조사 순서)

1. 직렬화·정체: `NET.mySetup={roster, pos}` 는 소유자 0 의 말 순서([하수인6·폭탄3·동료2·함정2·왕], `newGame` 고정)로 캡처되고, `applyNetSetup` 이 같은 순서로 `roster[i]→하수인 i`, `pos[i]→말 i`(P2 는 `14−r`, 열 유지)를 적용한다 — 양측이 같은 `[P1,P2]` 순서로 호출. `PID` 는 두 클라이언트 모두 load→`netPrepare`→`netStart` 의 `newGame` 3회로 동일(실측 A3·CDP 2a). 문제 없음.
2. RNG: 모든 게임 난수는 `rand()`(공유 시드) 경유이며 표시 계층·로컬 모달은 난수를 쓰지 않는다. 문제 없음.
3. 수신 펌프: 행위자는 `netActor()===NET.me` 일 때만 송신하고, 상대는 상태 순서대로 재생한다. 순서 역전 경로 없음(퍼즈 실측).
4. **로직 안의 뷰어 의존**: `humanViewer()` 호출 4곳 중 렌더(:687)·메모(:2523·2537)를 제외한 **:1052 한 곳**만 게임 상태를 바꾸는 분기에 있다 → 위 결함.

## 3. 서버

변경 없음. 서버는 `{t:"a"}` 를 무해석 중계하고 `matched` 를 p1→p2 순서로 보낸다(`server/server.js` :245~246). 이번 결함은 클라이언트 재생 로직이며 서버 소유권 변경이 필요하지 않아 PD 에게 별도 질의하지 않았다.

## 4. 테스트

### 4.1 신규 `demo/test/smoke_online_sync.js` — 23/23 (파일 쓰기 0)

```
node demo/test/smoke_online_sync.js                       # 23/23 · 기본 12시드 × 최대 700행동 · 약 4초
node demo/test/smoke_online_sync.js --seeds 3 --verbose   # 시드별 통계 출력
git show ad5f2a8:demo/index.html | node demo/test/smoke_online_sync.js --stdin   # 음성 대조 — 20/23 · 종료 1 · 파일 작성 0
```

| 절 | 내용 | 결과 |
|---|---|---|
| A (12) | 서로 다른 로스터 6종을 **실제 토글 순서**로 선택, 14개를 서로 다른 비공개 배치로 **`selTray`→`onCell` 수동 배치**, 실제 `matched(p1→p2)→hello→hello2` 로 시작. 28개 말 정규 스냅샷(owner·type·rosterId·name·hp·기술·좌표) 동일(A2)·**id 까지 동일**(A3)·각자가 제출한 배치가 자기/상대 클라이언트 정규 좌표에 정확히 반영(A4×4, P2 는 `14−r`·열 유지)·로스터 순서(A5)·락스텝(A6)·양측 뷰어 DOM↔자기 S(A7)·자기 말 14개 화면 아래(A8)·P2 논리 1~3행(A9) | 통과 |
| B (2) | P1 하수인 11→5행, P2 하수인 3→9행을 **실제 클릭 경로**로 번갈아 횡단(중앙 7행·숲 경계 양방향), 매 클릭 뒤 S·DOM 대조 | 통과 |
| C (4) | 시드 무작위 완주 퍼즈(이동·공격·강제 전투·탐색·턴 교대·BT 2칸·동기화 모달 버튼·**상대(비행위자) 잡음 클릭 + 행위자 오클릭**), 매 행동 뒤 28개 말 정규 스냅샷·수신 큐·행위자 합의·DOM 대조 | 통과 (12시드 모두 종료까지 완주) |
| D (5) | **결정적 fail-first 재현**: P1 하수인(M-G3) 11→5행 횡단 후 (5,3) 은신 → 실제 버튼 턴 교대로 65턴 → P2 (3,3)→(5,3) 2칸 클릭 → D2 행위자 쪽 충돌 처리, **D3 상대 쪽 재생 결과 동일**, D4 정규 스냅샷 합의 | 통과 |

### 4.2 음성 대조 (수정 전 소스, 파일 작성 0)

```
git show ad5f2a8:demo/index.html | node demo/test/smoke_online_sync.js --stdin
→ 20/23 · 실패 3: C1(seed 1003 step 189 P1 ally 2칸 이동 — S.mainUsed 불일치) · D3(P1 클라 (3,3)·mainUsed=false·battle=false vs P2 클라 (4,3)·true·true) · D4
```
A·B 전부 통과 = **배치·시작·1칸 횡단은 수정 전에도 일치**(#93 무관 근거). D3 의 실패 문구가 결함 서명 그대로다.

```
git show dadc8bc:demo/index.html | node demo/test/smoke_online_sync.js --stdin   # #93 이전 소스
→ 19/23 · 실패 4: D3·D4(같은 결함 서명) + A8·C1(`data-flip` 부재 — #93 이전이라 P2 화면이 반사되지 않는 표시 차이, 결함과 무관)
```
= 결함은 #93 의 행 반사 이전부터 존재했다 [확정].

### 4.3 기존 회귀 — 1009/1009 (수정 후)

```
node demo/test/smoke_cycle5.js          # 69      node demo/test/smoke_shock.js           # 65
node demo/test/smoke_memo.js            # 122     node demo/test/smoke_attack_balance.js  # 50
node demo/test/smoke_online.js          # 157 (※ os.tmpdir 에 변이본을 쓰는 원본 — Saturn 실행 금지)
node demo/test/smoke_minion_art.js      # 199     node demo/test/smoke_own_side.js        # 66
node demo/test/smoke_tutorial.js        # 124     node demo/test/smoke_cross_skill.js     # 116
node demo/test/smoke_testclient.js      # 41
```
합계 1009 (PD 기준치와 일치) + 신규 23 = **1032**.

### 4.4 실제 Chrome 2클라이언트 — `demo/test/issue104_cdp.js` 22/22

```
node demo/test/issue104_cdp.js --read-only   # 22/22 · 산출물 0 · 약 2.5분 (Chrome 임시 프로필 i104cdp-* · PORT=0 서버만 생성·정리)
node demo/test/issue104_cdp.js               # 22/22 · docs/qa/issue104/ 에 PNG 2장 + issue104_cdp_report.json (덮어씀)
```
조건: 헤드리스 Chrome · CDP 탭 2개 · **실제 릴레이 서버**(`PORT=0` 루프백, 사용자 8080 무접촉) · `http://127.0.0.1:<port>/index.html` · 1280×1000 · 제품 코드 무수정 · 메뉴/로스터 카드→[선택하기]/트레이→칸/[배치 완료 → 매칭 시작]/턴바/전투 버튼 전부 **실제 DOM 클릭**.

| # | 측정 | 결과 |
|---|---|---|
| 1a·1b | 두 탭 서로 다른 로스터(카드 클릭 순서)·서로 다른 14개 수동 배치 | ok |
| 1c | 실제 서버 매칭 A=P1 · B=P2 | ok |
| 2a | 시작 직후 28개 말 정규 스냅샷(id·owner·rosterId·name·hp·기술·좌표) 양 탭 동일 — JSON `initial.P1/P2` 에 원본 | ok |
| 2b×4 | P1·P2 가 제출한 배치가 두 탭 모두의 정규 좌표에 반영 (JSON `initial.submitted`) | ok |
| 2c·2d | 양 탭 DOM↔자기 S (칩·가시성·공개·순서·자기 말 하단, P2 행 반사) | ok |
| 3 | P1 하수인 11→5행 횡단(실제 클릭·실제 턴 버튼) 매 이동 뒤 양 탭 일치 | ok |
| 4a·4b | 65턴 BT · (5,3) 의 P1 말이 P2 시점 비가시/P1 시점 가시 · 2칸 이동 합법 | ok |
| 4c | 행위자 P2 탭: (4,3) 정지·공개·주 행동 소모·강제 전투 | ok |
| **4d** | **상대 P1 탭이 같은 클릭을 재생한 결과 동일** (수정 전 소스에서는 헤드리스 D3 와 같은 서명으로 갈린다) | ok |
| 4e | 양 탭 전체 스냅샷 동일 | ok |
| 5a~5c | 강제 전투를 실제 전투 버튼 12회로 완주 → 양 탭 동일 · DOM↔S | ok |
| 5d·5e | 턴 교대 후 동일 · 콘솔 오류 0 | ok |
| 6 | 재매칭(새로고침 후 재접속) 시작 스냅샷(id 포함) 동일·DOM↔S | ok |

스크린샷(`docs/qa/issue104/`): `http_desktop-1280_1-p1-after-hidden-collision.png`(P1 시점 — 충돌·전투 후 보드) · `http_desktop-1280_2-p2-after-hidden-collision.png`(P2 시점 — 같은 상태의 행 반사 보드). 두 장에서 같은 논리 칸의 말이 서로 반사 위치에 있고 공개 상태가 같다.

한계: 서버가 `demo/` 를 서빙하므로 수정 전 HTML 의 브라우저 음성 대조는 하지 않았다(헤드리스 `--stdin` 음성 대조로 대신). 상대 정보 비노출·포획 아트·기술·메모는 건드리지 않았고 기존 `issue93_cdp`·`memo_cdp`·`issue92_cdp --read-only` 로 회귀 확인(4.5절).

### 4.5 연결 브라우저 회귀 (read-only)

```
node demo/test/issue93_cdp.js --read-only   # 18/18 · 산출물 0 (#93 행 반사·클릭·메모 — 수정 후에도 동일)
node demo/test/memo_cdp.js --read-only      # 18/18 · 산출물 0 (#94 상대 턴 로컬 메모·송신 0)
node demo/test/issue92_cdp.js --read-only   # 20/20 · 산출물 0 (#92 탐색 교체 모달·비소유자 마스킹)
```

## 5. Saturn 재실행 경로 (읽기 전용)

```
node demo/test/smoke_online_sync.js                                              # 23/23 · 파일 쓰기 0
git show ad5f2a8:demo/index.html | node demo/test/smoke_online_sync.js --stdin   # 20/23 종료 1 (음성 대조 · 파일 쓰기 0)
node demo/test/smoke_cycle5.js && node demo/test/smoke_memo.js && node demo/test/smoke_tutorial.js && node demo/test/smoke_testclient.js
node demo/test/smoke_minion_art.js && node demo/test/smoke_attack_balance.js && node demo/test/smoke_shock.js && node demo/test/smoke_own_side.js && node demo/test/smoke_cross_skill.js
node demo/test/issue104_cdp.js --read-only                                       # 22/22 · 산출물 0
node demo/test/issue93_cdp.js --read-only && node demo/test/memo_cdp.js --read-only && node demo/test/issue92_cdp.js --read-only
```
주의: `smoke_online.js` 는 `os.tmpdir()` 에 변이본을 쓰므로 Saturn 실행 금지(Mars 157 결과만 기재). `issue104_cdp.js` 를 `--read-only` 없이 돌리면 `docs/qa/issue104/` 를 덮어쓴다. 의존: Node 22+ · 로컬 Chrome · `server/node_modules`(ws).

## 6. 납품 파일 · SHA256

| 파일 | 역할 | SHA256 |
|---|---|---|
| `demo/index.html` | 제품 (변경 전 ad5f2a8 `02122fcb35f652fb37eff4cfecf90101edb5dbbe7d7e49e7b254cee1c0bbc7e3`) | `d77be36dcd5d9528ea0cbd2c96286e6c865f9a59b1fcdb0b67e78c588a044fef` |
| `demo/test/smoke_online_sync.js` | 신규 헤드리스 회귀 23 (자연 배치·횡단·퍼즈·결정적 재현 D) | `58cbf5125a29586b7a3e87c2200d6692b9bbd2062748848b03d4fd4ab0f5d349` |
| `demo/test/issue104_cdp.js` | 신규 실제 Chrome 2클라이언트 증빙 22 (`--read-only` 지원) | `6e7052bfb493c1de124d5eaf65b7c4bba8e029f46f9d5943c43f1d6ed3b9bb3e` |
| `docs/qa/issue104/http_desktop-1280_1-p1-after-hidden-collision.png` | 증빙 — P1 시점 | `d897c32fe25f8a9d5945810be10d84bb277d564bf17e5045c894d2760a21a93d` |
| `docs/qa/issue104/http_desktop-1280_2-p2-after-hidden-collision.png` | 증빙 — P2 시점(행 반사) | `25ecd4acacf7c32c49203eb8fb5953baafe9e416f0bebc934235f04640ca6796` |
| `docs/qa/issue104/issue104_cdp_report.json` | 측정 원본 + 시작 직후 28개 말 정규 스냅샷(`initial.P1/P2`)·제출 배치(`initial.submitted`) | `70e037b8e7f0a909b433f0b7b2d9d5196960e12625b960176ba262ab9d0dc08b` |
| `docs/qa/issue104-mars.md` | 이 보고 | (PD 취합 시 계산) |

작업 트리에는 이 작업과 무관한 다른 주체의 변경(`README.md`·`ASSET-LICENSE.md`·`docs/creat2ve/HANDOVER_SNAPSHOT.md`·`docs/qa/v044-pd-report.md`·`docs/media/`·`docs/releases/`·`docs/v0.4.4-turn-flow-spec.md`·`docs/art/readme-hero-v0.4.4.md`)이 동시에 존재한다. Mars_1 은 위 표의 파일만 만들거나 고쳤다.

## 7. [기획 필요] 없음 · PD 참고

- 규칙 변경 없음: "행위자에게 보이는가"는 이미 `canMoveTo`·`doMove` 가 쓰는 기준이며, 이번 수정은 클릭 분기를 같은 기준으로 맞춘 것이다(GDD 충돌 규칙 그대로).
- 테스트 설계 메모: 하네스 스텁의 `#obBtns` 는 id 캐시라 모달 교체 시 옛 버튼이 누적되어 제품 `modal` 래퍼의 버튼 인덱스가 어긋난다. `smoke_online_sync.js` 는 브라우저처럼 `overlayBox.innerHTML` 교체 시 `#obBtns` 자식을 비우도록 **테스트 쪽에서** 감쌌다(하네스·제품 무수정). 전투·모달 오버레이가 열린 동안 보드는 그 뒤에 있고 닫힐 때 다시 그리므로 DOM 대조는 오버레이가 닫힌 상태에서만 한다.
- 남은 관찰(결함 아님·보고만): 온라인 P2 화면의 로그·메모 피커 문구는 논리 행(`11행`)을 쓰므로 반사 화면의 위치와 어긋나 보일 수 있다(#93 계약 "로그 문구 불변" 그대로). 필요하면 별도 안건.
