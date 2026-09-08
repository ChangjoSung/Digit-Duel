# Issue #94 — 상대 턴 로컬 메모 허용 (Mars_1 구현 납품 보고)

- 역할: **Mars_1** (required_role=Mars · instance_index=1 · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- 브랜치: `fix/94-opponent-turn-memo` · 기준: `origin/dev` eff5c16 (worktree `fix-94-opponent-turn-memo`)
- 계약 입력: `docs/v0.4.4-gameplay-spec.md` §6 (읽기만) · GitHub Issue #94 PD 코멘트(2026-09-07) · CLAUDE.md
- 작성: 2026-09-07 · **이 문서가 주장하는 범위**: 기계로 잰 사실(헤드리스·실브라우저)과 저장한 화면 증빙까지. **Saturn 독립 QA·CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다.** Git/GitHub/Notion 쓰기는 하지 않았다(PD 집행).
- 표기: **[확정]** 코드·측정 사실 / **[추론]** 계약 문구를 구현자가 해석한 지점 / **[한계]** 이번 검증이 닿지 못한 범위
- PD 취합 확인: 공개된 말 안내는 계약 AC(5)를 따른다. 대상 변화 안내 문구와 상대 턴 목록 표시는 승인된 메모 기능을 설명하는 구현 범위로 인수하며 별도 승인 대기로 남기지 않는다. 아래 Saturn 실행 안내는 READ_ONLY 계약에 맞게 정정했다. 제품·테스트는 변경하지 않았다.

---

## 1. 무엇을 바꿨는가 (제품 `demo/index.html`, +44/-8줄)

| # | 지점 | 내용 |
|---|---|---|
| 1 | `onCell(r,c)` | 셀 클릭 진입점에서 **`memoClickTarget(r,c)` 가 대상 말을 돌려주면 `memoModal` 을 직접 연다** — `netAction` 을 타지 않으므로 송신·seq·RNG·`selected`·게임 로그 무변화. 그 외 클릭은 종전 `netAction({t:"cell"})` 그대로 |
| 2 | `memoClickTarget(r,c)` (신설) | (a) **상대 턴·AI 턴**: 뷰어 고정 모드(온라인 `NET.me` · PVE 뷰어 0)에서 뷰어가 볼 수 있는(`visibleTo`) 상대 말이면 대상. (b) **자기 턴**: `onCellCore` 우선순위(강제 전투 대상 → 텔레포트 → 자기 말 선택 → 인접 전투 지정)를 그대로 흉내 내어 **원래 memoModal 분기에 도달할 클릭만** 대상. 핫시트 PVP·sim은 (a) 없음. 오버레이가 열려 있으면(전투·상대 선택 대기·이미 열린 피커) 대상 없음 |
| 3 | `memoTargetOk(v,pc)` (신설) | 살아 있고 배치된 · 미공개 · 뷰어가 볼 수 있는 상대 말만 저장 자격 |
| 4 | `memoModal(pc)` | 죽은 말·비가시 말 조기 반환 추가. **피커 토큰**(`{game:S, piece, viewer, seq}`)을 발급하고 저장·삭제·닫기 콜백을 `commit/dismiss` 로 감쌈: 토큰이 오버레이 소유권을 잃었으면(다른 `modal()`·`close()`·새 게임 `S` 교체) **아무것도 하지 않음**(close·render 없음), 소유권은 있으나 대상이 공개·사망·비가시가 됐으면 **저장하지 않고 안내 토스트 + 피커만 닫음** |
| 5 | `modal()` / `close()` | `MEMO_UI.token=null` · `MEMO_UI.overlayOpen` 갱신 — 어떤 모달이 오버레이를 가져가거나 닫히면 열려 있던 피커 콜백은 무효 |
| 6 | `renderSide()` | 추측 메모 목록을 `!isAI(S.current) || NET.mode || S.mode==="pve"` 일 때 표시 — 온라인·PVE 는 상대 턴·AI 턴에도 내 목록이 보인다 |

**바꾸지 않은 것 [확정]**: `netAction` 의 `netActor()!==NET.me` 차단 가드 · `onCellCore` 의 `isAI(S.current)` 가드와 클릭 우선순위 · `applyAction`/`netReady`/`netPump`/동기화 모달 래퍼 · `memoSet` · AI 코드 · 서버 코드 · 기획 문서. `netSend`/`rand()`/`netAction` 호출은 메모 경로(`memoClickTarget`·`memoModal`·`memoTargetOk`·`memoSet`)에 없다(정적 검사 D12m).

### 1.1 해석 지점 [추론] — PD/CJ 가 바꾸려면 여기다
1. **상대 턴에 "공개된" 상대 말 클릭** → 계약 (a) 는 `!revealed` 만 적었지만 AC(5)·PD 지시("공개된 말은 기존 안내")에 맞춰 **memoModal 의 기존 "이미 공개된 말: …" 토스트**로 보냈다(송신 0). 대안은 `netAction` 경유 "🌐 상대 턴입니다." 토스트다. 한 줄(`memoClickTarget` 의 `!visibleTo` 조건에 `||p.revealed` 추가)로 바꿀 수 있다.
2. **대상이 바뀌어 저장하지 않을 때의 안내 문구** `"대상 말의 상태가 바뀌어 추측을 적용하지 않았습니다."` 는 승인된 오래된 콜백 무효 처리의 결과를 설명한다. PD는 이 구현 안내를 인수했으며 추가 게임 규칙이나 승인 대기는 없다.
3. **사이드 패널 메모 목록의 상대 턴·AI 턴 표시**는 "메모 편집 가능"의 자연스러운 귀결로 넣었다(뷰어 전용 정보이므로 노출 위험 없음).

---

## 2. AC 대응표 (계약 §6)

| AC | 헤드리스 (`smoke_memo.js` D절) | 실브라우저 (`memo_cdp.js`) |
|---|---|---|
| (1) 온라인 상대 턴 미공개 상대 말 → 피커 · 송신 0 | D1·D1b·D1e (락스텝 2클라이언트, **연결된 소켓 `ws.sent` 길이**·릴레이 전달 0) | 2b (실제 소켓 `send` 래핑 `__sent=0`) · 3b (상대 클라이언트 실제 수신 액션 프레임 `__recvA=0`) |
| (2) 상대 턴 이동·전투·텔레포트·턴 종료 차단 토스트 | D3·D3b·D3c·D3d | 4 (자기 말 클릭 → "🌐 상대 턴입니다.") · 3d (턴바 비활성) |
| (3) PVE AI 턴 메모 | D11a~D11e | 8a~8c (AI 지연 120 s 로 AI 턴 유지 · 배지 "🤖 AI 행동 중…") |
| (4) 자기 턴 강제 전투·인접 전투는 전투 진입 | D12·D12a·D12d (+ 기존 B7) · D5i(자기 말 선택 송신 1) | 6c (자기 말 선택 송신 1) |
| (5) 공개된 말 → 기존 안내 | D4(상대 턴)·D11e(AI 턴) · 기존 B4 | — |
| (6) 공개·사망·비가시·새 모달·새 게임 뒤 오래된 콜백 무효 | D6a~c (대상 변화) · D7b (닫힌 옛 피커) · D8a~c (**상대 전투 도착 → 전투 모달 우선 · 옛 콜백이 가리지 않음 · 이후 상대 전투 행동 대기 큐 정상 재생**) · D9~D9b (동기화 모달·`syncModal` 보존·상대 선택 재생) · D10 (새 게임) · D10a/b (오버레이 열림 중 분기 없음) | (한계 4절) |
| (7) `S.selected`·메시지 순서·RNG 불변 | D1d·D2c·D5c/e (양쪽 스냅샷 동일) · D5g/h (자기 턴 원래 메모 분기 송신 0) · **D11f 쌍둥이 실행(시드 777)**: AI 행동·로그·`rand()` 3연속 값·selected 동일 | 3c·5b·6c (양측 스냅샷 동일) · 6a/6b (자기 턴 메모 송신 0) |
| (8) 핫시트 PVP 현행 | D12f~h (+ 기존 C절) · sim D12i | — |
| (9) 회귀 | 6개 스모크 **644 / 0** (기준 571 + 신규 73) | 18 / 0 |

---

## 3. 실행 명령·결과 (모두 이 worktree 루트에서, Node v24.16.0, Windows 10)

### 3.1 헤드리스 회귀 [확정]
```
node demo/test/smoke_cycle5.js      → pass 69  / fail 0
node demo/test/smoke_memo.js        → pass 122 / fail 0   (기존 49 + #94 D절 73)
node demo/test/smoke_online.js      → pass 157 / fail 0
node demo/test/smoke_testclient.js  → pass 41  / fail 0
node demo/test/smoke_tutorial.js    → pass 124 / fail 0
node demo/test/smoke_minion_art.js  → pass 131 / fail 0
합계 644 / 0  (현행 기준 571 유지 + 73)   · smoke_memo 3회 반복 동일(D절은 고정 LCG 로 결정적)
```

### 3.2 음성 대조 [확정] — 검사기가 실제로 결함을 잡는가
- **변경 전 소스(eff5c16 `demo/index.html`, SHA256 `b2171e9a…385f`)로 같은 테스트 실행**:
  `git show eff5c16:demo/index.html > <임시>/index_base.html && node demo/test/smoke_memo.js <임시>/index_base.html`
  → **pass 55 / fail 9** — D1(피커 안 열림)·D1e(차단 토스트)·D11a(AI 턴 피커)·D12(`memoClickTarget` 부재)·D13 과 락스텝/콜백 블록 예외. A~C 절은 그대로 통과(기존 기능 무영향).
- **인메모리 변이본**(파일 쓰기 없음, `harness.load({html})`): M1 = `memoModal` 에 불필요한 `netSend` 삽입 → **연결된 소켓 `sent` 가 1 증가해 송신 0 검사기 실패**(D13a) · `wsLog.length` 는 변이 전후 모두 1(D13b — 소켓 생성 수는 판정 근거가 아님, #91 QA 지적 반영). M2 = `onCell` 을 변경 전으로 되돌림 → 피커 검사기 실패·차단 토스트(D13c).

### 3.3 실브라우저 증빙 [확정] — `node demo/test/memo_cdp.js` → **pass 18 / fail 0**
헤드리스 Chrome(CDP) + **실제 릴레이 서버**(`server/server.js`, PORT=0 임의 포트·루프백·실제 접속 코드 인증) + **온라인 클라이언트 탭 2개**(HTTP) + PVE 탭(file://). 클릭은 전부 `Input.dispatchMouseEvent` 실제 마우스 좌표 클릭. 송신 판정은 연결된 실제 `WebSocket` 인스턴스의 `send` 래핑(`__sent`)과 상대 탭의 실제 수신 액션 프레임 수(`__recvA`).
흐름: 매칭 → W(상대 턴) 미공개 상대 말 클릭 → 피커(송신 0) → 💣 저장(송신 0 · X 수신 0 · X 메모/추측 흔적 0 · 양측 스냅샷 동일) → W 자기 말 클릭 차단 토스트 → X 실제 이동(송신 2) → 양측 동일·W 메모 유지 → X 턴 종료 → W 자기 턴 비인접 메모 송신 0 · 자기 말 선택 송신 1 → 추측 삭제 → PVE AI 턴 피커·저장.
`--read-only` 재실행: **pass 18 / fail 0 (산출물 0)**, `docs/qa/issue94/` 변화 없음 확인.

### 3.4 화면 증빙 (`docs/qa/issue94/`, 1280×800)
| 파일 | 내용 |
|---|---|
| `1-online-opponent-turn-picker.png` | 온라인 P2 화면 · 상대(P1) 턴 · 턴바 "🌐 상대 턴 진행 중…" 배지 · 미공개 상대 말 클릭으로 열린 피커 |
| `2-online-opponent-turn-memo-saved.png` | 같은 화면 · 12행 6열 물음표 자리 💣(점선) · 사이드 패널 "📝 추측 메모 — 12행 6열 폭탄 추측" · 여전히 상대 턴 |
| `3-online-actor-view-no-memo.png` | 상대(P1) 화면 · 추측 표시·메모 목록 없음 |
| `4-pve-ai-turn-picker.png` | PVE(file://) · AI 턴 · "🤖 AI 행동 중…" 배지 · 상대 말 클릭으로 열린 피커 |
| `memo_cdp_report.json` | 18개 판정·detail |

---

## 4. 한계 [한계]
1. **헤드리스 2로드 락스텝은 전투를 건너뜀**: 제품이 `window.__actCore` 등 전역 진입점을 쓰므로 두 로드가 한 프로세스에서 전투를 동시에 돌리면 마지막 로드의 것이 호출된다(하네스 `T.activate()` 로 이동·턴 종료·메모까지는 격리했다). 그래서 **"피커 열린 채 상대 전투 도착 → 전투 모달 우선 → 옛 콜백 무효 → 상대 전투 행동 재생"**(D8) 은 단일 클라이언트 + 주입 상대(수신 프레임 직접 투입)로 검증했다. 실브라우저에서 전투 레이스는 재현하지 않았다(실브라우저는 이동·턴 종료 레이스와 상태 일치까지).
2. 실브라우저 "새 게임 모달 교체" 레이스는 온라인에서 새 게임이 `location.reload()` 이므로 헤드리스(D10: `S` 교체 뒤 옛 콜백 무시)로만 다뤘다.
3. 핫시트 PVP·sim 회귀는 헤드리스만(실브라우저 캡처 없음) — 화면 변화가 없는 범위다.
4. 실브라우저 도구는 로컬 Chrome·`server/node_modules`(`npm ci` 로 lockfile 설치, 서버 코드 무수정)에 의존한다.

---

## 5. 하네스·테스트 변경 (`demo/test/`)
- `harness.js` (+16/-4): `load(path,{html})` 인메모리 소스 옵션(변이본 음성 대조 — 파일 쓰기 없음) · `window.xxx=` 진입점의 로드별 기록 + `T.activate()`(다중 로드 락스텝용; 단일 로드에서는 종전과 동일) · `netPump` 노출 · `memoClickTarget/memoTargetOk` 노출(`typeof` 가드로 변경 전 소스에서도 로드 가능). **PD 참고**: #91(dev dcb668e)이 하네스 노출 목록에 helper 를 추가했다고 하므로 통합 시 같은 줄 근처 충돌 가능(기능 영역은 겹치지 않음).
- `smoke_memo.js` (+288): A16/A17 은 현재 피커의 버튼 행(`rowBtns`)을 누르도록 수정 — 스텁 `obBtns` 는 이전 모달의 버튼을 지우지 않아 `children[0/1]` 이 첫 피커의 오래된 버튼이었고, #94 계약상 오래된 콜백은 무효라 실제 브라우저처럼 "지금 열린 피커"를 눌러야 한다. 옛 버튼이 무효인 것 자체는 D7b 가 검사한다. D절 73건 신설(블록 단위 예외 보호 · 고정 LCG 로 결정적).
- `memo_cdp.js` (신규): 3.3 도구. `--read-only`(산출물 0) · `--no-shots` · `--out` · `--chrome`.

## 6. Saturn 재실행 경로 (읽기 전용)
```
node demo/test/smoke_memo.js                 # 122/0 기대 · 파일 쓰기 없음
node demo/test/memo_cdp.js --read-only       # 18/0 기대 · 스크린샷·JSON 없음 (Chrome 임시 프로필만 생성·정리, RESOURCE/CLEANUP 행)
# 음성 대조: Node stdin에서 HTML 읽기만 메모리 사본으로 대체하거나 H.load의 opts.html을 사용한다. 저장소 밖이라도 사본 파일을 만들지 않는다.
```
구현자가 수행한 전체 회귀는 644/0이다. Saturn은 파일을 작성하는 원본 `smoke_online.js`를 실행하지 않는다. 다른 읽기 전용 스모크를 실행하고 온라인157은 Mars 증거로 구분한다. 최신 dev 통합 후 추가된 스모크와 검사 수는 최종 Saturn 보고를 기준으로 한다.

## 7. 최종 SHA256 (worktree 파일, CRLF 그대로)
| 파일 | SHA256 |
|---|---|
| `demo/index.html` | `603b6b9685d9939db68feff49605883f4334727e1c0a6f1cc73ffa978f23a2be` |
| `demo/test/harness.js` | `995145f300f9edcfdd97c1a04e973551e63887d1f8610d0cc6efae125ff24bf2` |
| `demo/test/smoke_memo.js` | `6ce4d233aa4701ce06494e723f57ba195e8e05cfc440dc89861840363c711eee` |
| `demo/test/memo_cdp.js` | `5dc680c42b07af35ea1866b3f7c7c0196378c9b4cd30869241e34ee3f8987a49` |
| `docs/qa/issue94/1-online-opponent-turn-picker.png` | `9555f4bd11dd1861489efefa6a3b974b8550973a43babafb2b1bba2de9123956` |
| `docs/qa/issue94/2-online-opponent-turn-memo-saved.png` | `b484556fba965d0fb8fd291064d8c90119c13263fce773e372727117dbb9bfe0` |
| `docs/qa/issue94/3-online-actor-view-no-memo.png` | `6a2ec8134aeae5822ec7ca53f4d77cbe65d48f72b317d521009bf2fad61bedc0` |
| `docs/qa/issue94/4-pve-ai-turn-picker.png` | `38a23a657ba2cdfe3634d64044ec6d80f7bc7777caf564933826953fed484072` |
| `docs/qa/issue94/memo_cdp_report.json` | `1e1e7a6a2d74f99edb0ddf31fbc9f4728f360d2350a521066fb07a4e5b9f51c6` |

git blob(LF 정규화) SHA1: `index.html` 5e46c261 · `harness.js` f4ca7706 · `smoke_memo.js` da5addd2 · `memo_cdp.js` 49c09c9f. 기준(변경 전) `demo/index.html` SHA256 `b2171e9a0bd94df7e5623e3ace676b3be03c59b8418632ebf04acf232885385f`.

## 8. 문서 반영 위치 (PD 집행)
| 항목 | 저장소 | Notion |
|---|---|---|
| #94 구현 사실·해석 지점(1.1) | 이 문서 | GDD-13 6장 UI·UX "상대 턴·AI 턴에도 미공개 상대 말 메모 가능(온라인·PVE, 핫시트 제외)" 한 줄 · Decision Log 28 |
| 안내 문구(1.1-2) | 이 보고의 PD 취합 확인 | 승인된 콜백 무효 처리의 설명 문구로 인수, 별도 규칙 변경 없음 |
