# Issue #93/#104 — 온라인 보드 방향(orientation) 독립 감사 (Mars_3 보고, rev 3)

- 역할: **Mars_3** (required_role=Mars · mode=IMPLEMENT · area=TOOLING · mutation=code · instance_index=3 · provider=Claude Code)
- Task `task_93c7aaca8f0f`(1차) → `task_66b6fa36ebea`(2차) → **`task_0978bc2dbbec`(3차 — Saturn_1 REVISE 수리, dispatch `ctx_6d747f9e4aa4`)** · 감사 대상 = 고정 기준 **`dev 6baa0b5`**(#93 행 반사 + #104 행위자 시야 1행 수정 포함) · 비교 기준 `dadc8bc`(#93 이전)
- 근거: `CLAUDE.md` · `docs/v0.4.4-gameplay-spec.md` 5장(#93 계약) · `docs/qa/issue93-mars.md` · `docs/qa/issue104-mars.md` · **`docs/qa/issue104-orientation-saturn-first.md`(Saturn_1 1차 REVISE, PD 취합)** · PD dispatch TASK 블록 3건. CJ 의 원인 가설: "2P 를 위→아래로 바꾸면 좌상→우하로 가는 것(180° 회전) 아닌가, 말이 중앙을 넘으면 전진 방향이 뒤집히는 것 아닌가, 오류는 65턴 이전에도 날 수 있다 — 전 경로 감사". 양측 같은 URL·같은 버전은 이미 확인된 사실로 둔다.
- 작성: 2026-09-08 (rev 3 — rev 2 의 감사 도구 false-green 을 수리하고 증거 문구를 Saturn 지적대로 좁혔다. 제품 관찰 결과 자체는 rev 2 와 같다)
- **이 문서가 주장하는 범위**: 기계로 잰 사실과 저장한 증빙까지다. CJ 세션 자체는 재현하지 않았다(7절). Saturn 재검증 이전이므로 "검증 완료"가 아니다. Git·GitHub·Notion 쓰기 없음.
- **접근·수정 사실**: 수정한 파일은 9절의 소유 파일뿐이다(`smoke_orientation_audit.js` · `orientation_audit_cdp.js` · 이 보고 · `issue104-orientation-audit/` 산출물). `demo/index.html`·`demo/test/harness.js`·기존 테스트·다른 소유자의 보고서·`docs/qa/issue104-orientation-saturn-first.md` 는 읽기만 했다(하네스 sha256 전후 동일 `8a3596fd…`). **`art/` 와 `orca-hook-latency-report.md` 는 접근 0**. 승인 자산 `demo/assets/minions/` 는 Chrome 감사에서 릴레이 서버가 디스크에서 읽어 서빙한 것(읽기)만 있다. 제품 본문은 `git show 6baa0b5:demo/index.html` 을 **메모리에 고정**해 감사했다(헤드리스는 하네스 `opts.html`, 브라우저는 같은 출처 빈 URL 에 `Page.setDocumentContent`). Worker 하위 생성 0.

---

## 0. rev 3 — Saturn_1 REVISE 의 원인과 수정

| 항목 | 내용 |
|---|---|
| [확정] REVISE 원인 | rev 2 의 `smoke_orientation_audit.js` 에서 `step()`(행동 → 릴레이 → 양측 S 동일 + 양 화면 91칸 대조)이 불일치를 `fails` 목록에만 push 하고 `fail` 카운터를 올리지 않았다. `move()`·`teleSwap()`·`passTurn()` 등 호출자는 반환값을 버렸고, 요약·종료 코드는 `fail` 만 봤다. 즉 **step 안에서만 드러나는 불일치는 화면에 FAIL 로 찍히지도, 종료 코드에 반영되지도 않았다**(false-green). Saturn 이 텔레포트 2단계 선택 중에만 P2 화면 owner 클래스를 뒤집는 메모리 변이로 28건 불일치가 기록되고도 pass 5194/fail 0/exit 0 이 나오는 것을 증명했다. `battleLoop()` 의 두 push(`sync modal no buttons`·after-battle 불일치)와 픽스처 F 의 push 도 같은 결함이었다(F 는 `allOk` 로 별도 집계됐지만 목록엔 중복 기록). |
| [확정] 수정 (도구) | ① `step()` 이 매 호출을 `ok()` 로 집계한다(`REC(!bad, "<tag> — 양측 S 동일·양 화면 91칸 대조", bad)`): 불일치 1건 = fail 1 = 즉시 `FAIL:` 출력 = 종료 코드 1. 호출자가 반환값을 버려도 결과가 사라지지 않는다. ② `battleLoop()` 는 **완주를 명시 검사**한다(전투·오버레이 닫힘, 반복 한도 미소진, 버튼 없음/비행위자 오버레이 잔존이면 실패) 뒤 after-battle 대조를 "생략 0" 조건으로 집계. ③ 픽스처 F 는 라운드마다 `ok()`. ④ `AUDIT.done/skipped/agreeFull/agreePartial/steps` 를 요약에 출력하고 절마다 검사: 횡단 14경기는 "대조 수행 = step×2+4, 생략 0", H 는 "완전 대조 + 부분 생략 = step+3, 부분 생략 ≤3(전투 열린 step 만)", 퍼즈는 시드마다 완전 대조 > 생략, 총합 done>0. ⑤ `fails.length===fail` 일관성 검사 + 종료 코드 `(fail||fails.length)?1:0`. ⑥ 대조 도중 스크립트 예외는 `uncaughtException` 에서 그때까지의 집계를 출력하고 **종료 코드 3**(앵커 없음 등 도구 오류 2, 판정 실패 1 과 구분). ⑦ 변이 적용 시 "앵커 일치 + 소스 실제 변경"을 확인하고 `MUTANT … applied` 를 출력. |
| [확정] 수정 (음성 대조) | Saturn 의 변이를 `--mutate teleOwnerStage2` 로 그대로 추가(`cell.appendChild(chip)` 직전, `NET.mode&&NET.me===1&&S.teleport&&S.teleport.stage===2` 일 때 `p<owner>`→`p<1−owner>`). 결과: **fail 28 / 종료 1**, 28건 전부 `owner class at (13,1) pc p1 hiddenId` — 즉 비교 자체의 실패이지 앵커 누락(종료 2)이나 대조 전 예외(종료 3)가 아니다(3.6절). 원본 6baa0b5 는 같은 도구로 fail 0 / 종료 0. |
| [확정] 자기 검사(SELF — 도구 6절 신설, 보고 3.7절) | 제품을 바꾸지 않고 **테스트 쪽 DOM 스텁만** 손상시킨 뒤 원상복구: P2 화면 owner 클래스 뒤집기 → `owner class` 검출, 칩 제거 → `chip missing`, 두 칸 DOM 순서 교환 → `reflect-contract expects`, `data-flip` 변조 → `data-flip` 검출, 복구 후 통과. 그리고 `step()` 안에서 일어난 불일치가 기록기에 실패로 들어가고 `false` 를 돌려주는지 포획기로 확인(rev 2 회귀 차단). 이 검사는 실제 `fail` 카운터를 건드리지 않는다(포획기는 그 한 step 에만 쓰고 즉시 `ok` 로 복귀). |
| [확정] Chrome 도구 보강 | `afterEach`(매 클릭·매 턴 교대 뒤 양 탭 91칸 픽셀 대조)에서 **`elementFromPoint(칸 중심)=그 칸 91/91` 도 판정**(이전엔 시작 직후 2d 만). 공개 하수인 칩의 아트를 경로만이 아니라 **실제 로드 성공**(`img.complete && naturalWidth>0`)으로 세고 종료 화면(전체 공개)에서 전부 로드됐는지 판정(신규 7). 종료 코드 3 = 실행 예외. 결과 **20/20**(5절). |
| [확정] 회계 수치가 바뀐 이유 | step 마다 집계하므로 pass 수가 rev 2 의 5194 에서 8924 로 늘었고, 변이 실패 수도 커졌다(예: flipOnCross 59→313). 이는 "실패를 감춰 저자 수치에 맞추지 않는다"는 지시대로 실제 수치다. 첫 로드의 선공·퍼즈 경로가 제품 `Math.random` 이라 pass/step 수는 실행마다 조금씩 다르다(이번 두 실행: 8916/3689 · 8924/3697). |

---

## 1. 결론 요약

| 구분 | 내용 |
|---|---|
| [확정] 구현된 규칙 | 온라인 P2 화면은 **행 반사**(화면 행 = 14 − 논리 행, **열 유지**)다. P1 화면은 항등. 규격 5장의 결정("행 반사·열 유지")과 일치한다. |
| [확정] CJ 원인 가설 ① "좌상 → 우하(180° 회전)" | 코드상 열은 어떤 단계에서도 뒤집히지 않는다(`applyNetSetup` `x.c=data.pos[i][1]`, `renderBoard` 열 순회 불변, `onCell(r,c)` 논리 좌표). 실측: P2 화면 91칸 중 행 반사 가설 91/91, 180° 회전 가설은 중앙 4열 13칸만, 항등은 7행 7칸만 일치(14경기 + Chrome). P2 가 배치에서 좌하에 둔 말은 P2 화면에서도 좌하(배치 보존 14/14, 픽셀 동일), P1 화면에서는 좌상이다. 따라서 "좌상 → 우하"는 이 코드에서 일어나지 않으며, 회전 가설은 **원인이 아니다**. 이는 원인 가설의 검토 결과이지 설계 변경 요청이 아니다(6절). |
| [확정] CJ 원인 가설 ② "중앙을 넘으면 전진 방향이 뒤집힌다" | 반사 조건 `boardFlipped()= NET.mode && NET.me===1` 은 말 위치·`S.current`·턴 수와 무관하다. **65턴 이전에** 양 플레이어의 말이 모든 열(7열)에서 중앙 7행·양쪽 숲을 넘어 상대 진영 2행/12행까지 간 7경기(pre)와 65턴 이후 같은 횡단 7경기(post), Chrome 실제 클릭 1경기(65턴 이전 전체 횡단 + 65턴 이후 상대 숲 5/9행) 모두에서 `data-flip` 은 클라이언트별 단 하나의 값(P1=0/P2=1)이었고, 매 이동의 화면 벡터가 (P1: (Δr,Δc) / P2: (−Δr,Δc)) 예측과 전부 일치했다. |
| [확정] 좌표 경로 결함 | 6baa0b5 에서 방향·좌표 경로의 결함을 **찾지 못했다**. 헤드리스 2클라이언트 감사 **pass 8924 / fail 0 (종료 0)** + 실제 Chrome 2탭 픽셀 감사 **20/20**(실제 픽셀 클릭 80회, 송신 페이로드 불일치 0, 매 step 뒤 양 탭 91칸 픽셀 대조 119회 전부 `elementFromPoint` 91/91). rev 3 회계로 "step 안 불일치"까지 전부 집계된 상태의 수치다. |
| [확정] 이중 변환·부분 변환 없음 | 상태 → 화면 변환은 `renderBoard` 의 행 인덱스 한 곳뿐이고 역변환은 없다. 배치 단계(`NET.mode=false`)는 반사하지 않으며, `applyNetSetup` 의 14−r 미러 + 렌더의 14−r 반사가 합성되어 P2 자기 화면은 항등이 된다(배치 보존). |
| [확정] 감사 도구의 검출력 | 메모리 변이 7종(180° 회전·턴 따라 반사·중앙 횡단 시 반사 해제·배치 열 미러·#104 수정 제거·dataset 화면행 기록·**텔레포트 2단계 owner 뒤집기**)과 #93 이전 소스(`dadc8bc`)가 전부 실패(종료 1, setupColMirror 는 50 실패 뒤 예외 종료 3). 자기 검사 SELF 통과. |
| [한계] CJ 세션 | CJ 가 본 "양측 말·위치가 다르다"의 원래 세션(같은 서버·같은 버전)은 재현하지 않았다. 6baa0b5 기준 전 경로에서 재현되는 좌표·표시 불일치는 0건이다(발견 못함 ≠ 없음). 한계 진술이지 승인 게이트가 아니며, #93/#104 원 증상은 CJ 플레이 QA 까지 OPEN 이다. |

---

## 2. 좌표 경로 전수 감사 (소스 6baa0b5, 가설별)

| 가설 (dispatch 열거) | 코드 지점 | 판정 | 근거 |
|---|---|---|---|
| 행 반사 vs 180° 회전 — 실제 구현 | `renderBoard` :688~693 `flip=boardFlipped(); for i=1..13, c=1..7 { r=flip?14−i:i; dataset.r=r; dataset.c=c }` | **행 반사** (열 불변) | 열 루프는 `c` 를 그대로 쓰고 `dataset.c=c`. 회전이라면 `c` 도 `8−c` 여야 한다 |
| 규격 | `docs/v0.4.4-gameplay-spec.md` 5장 "행 반사(화면 행 = 14−r, 열 유지)" | 구현 = 계약 | 6절 |
| 열 처리 / 소유자 정체 | `applyNetSetup` :2961 `x.r=(p===1)?(14−pos[0]):pos[0]; x.c=pos[1]` · `mkPiece` 소유자 · 로스터 순서 `applyRoster` | 열 유지·소유자 고정 | 배치 데이터는 항상 P0 프레임(11~13행)이고 P2 만 행 미러. 양측이 같은 `[P1,P2]` 순서로 적용(`netStart` :3181~3182) |
| `boardFlipped` / 표시 행 / `cell.dataset` / `onCell` / 네트워크 페이로드 | :634 `NET.mode&&NET.me===1` · :693 · :730 `cell.onclick=()=>onCell(r,c)` · :2886 `netAction({t:"cell",r,c})` | 논리 좌표 일관 | 클릭 클로저는 논리 `(r,c)` 를 캡처하고 그대로 송신. 상대는 `applyAction→onCellCore(a.r,a.c)` 로 같은 논리 좌표 재생. Chrome 에서 실제 송신 페이로드 80회 관측(5절) |
| 방향 벡터 canonical vs viewer | `canMoveTo` :733(거리·직선·`expedZone(owner,r)`) · `doMove` :1069(중간 칸 `(p.r+r)/2`) · `doPush` :1365(`dr=def.r−att.r`) · `zoneOf(owner)` · `checkKingReach`(P1 r=1 / P2 r=13) | 전부 canonical, 뷰어 무관 | 유일한 뷰어 의존 로직 분기였던 `onCellCore` :1056 은 #104 로 `visibleTo(S.current,p)` 로 결정론화됨. AI 전용 `fwd = me===1 ? (r−p.r) : (p.r−r)` :1944 는 소유자 기준(뷰어 아님) |
| 자기 숲 / 중앙 / 상대 숲 횡단 (65턴 이전·이후) | 좌표 경로에 행 범위·턴 수 분기 없음 (`inForest`·`expedZone` 은 canonical 규칙, `isBurning` 은 2칸 허용 여부만) | 반사에 영향 없음 | 3.1절 실측: pre 7경기 + post 7경기 + Chrome 3c·4c |
| BT 전후 1칸/2칸 전·후·측면, 2칸 충돌 | `isBurning()` :641 · `doMove` 2칸 단계 해석 | 뷰어 무관 | 3.1·3.2절 실측 (양 행위자) |
| 텔레포트 스왑·강제 접촉·밀어내기·도망·포획 대리·턴 교대·재매칭 | `doTeleportSwap` :1146 · `applyForced` · `doPush` · `fleeSwap` · `startTurn/endTurn` · `netStart`(리로드 후 새 `NET.me`) | 좌표 canonical, 렌더는 공통 `renderBoard` | 3.1(텔레포트 28회, 이제 2단계 선택 화면도 집계)·3.2(강제 전투 완주 명시 검사)·3.5 퍼즈·3.3(over·재매칭 역할 교대) |
| 고정 뷰어 = `NET.me` (S.current 변화 무관) | `humanViewer()` :629 · `renderBoard` viewer · `boardFlipped` | 확정 | 매 턴 교대마다 `data-flip` 불변 관측 (14경기 각 79~88턴) |
| 중앙 횡단 시 보드 뒤집힘 없음 · 부분 이중 변환 없음 | 반사는 셀 순회 1곳, 역변환 0곳 (`grep` `ROWS+1-`·`14-` 는 :690·:2961·AI :2226 뿐) | 확정 | 픽스처 91칸×4 + 변이 `flipOnCross` 검출 |
| 로그·메모 피커 문구 | `memoModal` 제목 `(r행 c열)`·`doPush` 로그 `(nr행 nc열)` 은 논리 좌표 | 결함 아님·계약대로 | #93 보고 7절의 "남은 관찰"과 동일 — P2 화면 위치와 숫자가 어긋나 보일 수 있음(표시 규칙이며 이번 감사 범위 밖) |

`humanViewer()` 호출은 :687(렌더)·:1056→#104 로 제거·:2527·:2541(메모 로컬 분기) 뿐이며 상태를 바꾸는 분기에는 남아 있지 않다 [확정].

---

## 3. 헤드리스 감사 — `demo/test/smoke_orientation_audit.js` (rev 3, 파일 쓰기 0)

```
node demo/test/smoke_orientation_audit.js                 # 기본: git show 6baa0b5:demo/index.html 메모리 로드 → pass 8924 / fail 0 · 종료 0 · 약 1분(병렬 실행 시)~수 분
node demo/test/smoke_orientation_audit.js --verbose       # 가설 적중 칸수·절별 회계·매핑 예시·퍼즈 통계 출력
node demo/test/smoke_orientation_audit.js --ref dadc8bc   # #93 이전 소스 (음성 대조)
node demo/test/smoke_orientation_audit.js --mutate <name> # 메모리 변이 음성 대조 (3.6절) — teleOwnerStage2 가 Saturn 변이
git show <sha>:demo/index.html | node demo/test/smoke_orientation_audit.js --stdin
종료 코드: 0 통과 · 1 판정 실패 · 2 도구 오류(변이 앵커 없음 등, 대조 전) · 3 대조 도중 스크립트 예외(집계 출력 후)
```

측정 원칙: 화면 좌표를 `dataset` 이 아니라 **DOM 순서(index)** 로 잰다(`#board` 는 7열 row-major grid). 각 DOM 자리의 `dataset(r,c)`·칩(owner 클래스·own·hiddenId·아트 `img src` 의 `element_arch` 디렉터리 — **경로 검사이며 로드 성공 검사가 아니다**, 로드 성공은 Chrome 7 이 본다)을 **테스트가 독자 구현한 변환**(`XF.reflect`)과 **상대 클라이언트의 S**(독자 `visIndep` 가시성)로 예측해 91칸 전수 대조한다. 오버레이가 열린 동안은 대조하지 않되 **생략 횟수를 절마다 집계·검사**한다(0절 ④). 턴 수는 강제 대입하지 않고 실제 `skipMain`/`endTurn` 경로로만 진행한다. 헤드리스 `gameCanon` 은 S 의 넓은 스냅샷(phase·current·turn·mainUsed·battlesUsed·selected·forced·teleport·movedPiece·battle·events·balls·inv·reserve·traces·tempReveal·teleUsed·winner·modalSeq·말 27필드)이지만 **S 전 필드는 아니다**(memos·metrics·log 등 제외).

### 3.1 G1~G7 × {pre, post} — 자연 경기 14판, 모든 열 횡단
- 경기 k: 서로 다른 로스터 6종(실제 토글 순서)·수동 배치(`selTray→onCell`)·실제 `matched→hello→hello2`. P1 은 열 k 로, P2 는 열 (k+3 mod 7)+1 로 횡단. 홀수 경기는 첫 로드가 P2.
- 공통 시작 검사: 배치 단계 flip=0 · 배치 화면 자리 14개 = 시작 후 자기 화면 자리 14개(양측) · 상대 화면에서는 행만 뒤집힌 자리 14/14 · 가설 판별(P1 항등 91/91 · P2 **행 반사 91/91, 180° 회전 13/91, 항등 7/91**) — 14경기 동일(`headless_verbose.log`).
- 매 이동 검사: 행위자 화면 hl-sel 자리 · 목표 칸 hl-move 자리 · 상대 화면 강조 0 · 화면 벡터 = 예측 · 전진=화면 위/후진=아래 · 이동 후 양측 S 동일 · 양 화면 칩 자리 = 독자 변환 · **매 step(선택·이동·skip·end·텔레포트 on/pick1/pick2/end) 양측 S 동일 + 양 화면 91칸 전수 — 각각 ok() 집계**.
- pre 유형: 전진 3 · 측면 · 후진 · 전진 · 측면 복귀 → **곧바로 1칸씩 7행 → 상대 숲 → 2행/12행**(도달 시 turn<65 확인) → 텔레포트 스왑(횡단 말 ↔ 자기 폭탄; **2단계 선택 중 화면도 집계**) → 자연 턴 교대로 65턴 → 두 번째 하수인 BT 2칸 전·후·전 → 65턴 이후 중앙 횡단(상대 숲 5행/9행). post 유형: 전진 3 · 측면 · 후진 · 전진 · 복귀 → 65턴 → BT 2칸 후·전·측면·복귀 → 7행 횡단 → 2행/12행 → 텔레포트 스왑.
- 결과: 14경기 전부 통과. `data-flip` 은 클라이언트별 1값. **회계(경기별)**: post 244~246 step·대조 492~496회·생략 0, pre 240 step·대조 484회·생략 0 (`headless_verbose.log` "회계" 행).

### 3.2 H — 숨은 말 2칸 충돌(#104) 양방향
P1 행위자·P2 행위자 각각: 행위자 (10,3)/(4,3) 대기, 상대 하수인이 열 5 로 횡단(매 이동 양 화면 대조) → 행위자 시점 비가시(독자 판정) → 65턴 → 2칸 측면 이동이 합법 → **양측 모두 경유 칸 (r,4) 정지 + 일시 공개 + 강제 전투 진입** → 전투를 실제 버튼으로 완주 → **battleLoop 완주 명시 검사(전투·오버레이 닫힘, 반복 한도 내)** → 양측 S·91칸 대조(생략 0 조건) → 생존 말의 양 화면 칩 자리. 통과. 회계: step 148/150 · 대조 300/304회 · 완전 대조 agree 150/152 · 부분 생략 1(충돌 이동 직후 전투 오버레이가 열린 그 step 뿐).

### 3.3 O — 종료·재매칭
기권 → 양측 `over` · 종료 화면(전체 공개 viewer=2) 91칸 대조 · P2 는 여전히 행 반사 · P2 화면 28칩 전부 공개. 재매칭(새 로드 2개, 첫 로드가 P2): flip 은 `NET.me` 를 따른다. 통과.

### 3.4 F — 픽스처 91칸 전수 (자연 흐름 아님)
28개 말을 4회 재배치해 91칸을 전부 한 번 이상 덮고 양 화면 91칸×4 대조(라운드마다 ok, 생략 0). 통과.

### 3.5 Z — 시드 퍼즈 6시드 × 최대 400행동
실제 클릭·버튼 경로만, 매 행동 뒤 양측 S·91칸 대조. 불일치 0. 이번 `headless_verbose.log` 실행분 합계: 전투 63 · 강제 전투 51 · 밀어내기 3 · 도망 2 · 포획 2 · BT 도달 6/6 · 텔레포트 0(3.1 에서 28회 명시 검증) · 탐색 0(미커버). **게임 난수는 제품 `Math.random` 이라 실행마다 표본이 다르며 고정 횟수를 주장하지 않는다** — 필수 조건은 "BT·전투·강제 전투 1회 이상"과 "시드마다 완전 대조 agree 가 1회 이상이며 생략(전투·오버레이)보다 많다"뿐이고, 밀어내기·도망·포획·탐색은 방향별 매트릭스가 아니다.

### 3.6 음성 대조 — 감사가 각 결함을 잡는가 (메모리 변이, 파일 쓰기 0, `--seeds 1`, `mutants.log`)

| 변이 `--mutate` | 심는 결함 | 첫 실패 | 결과 (rev 3 회계) |
|---|---|---|---|
| **`teleOwnerStage2`** (Saturn 변이) | P2 화면, 텔레포트 2단계 선택 중에만 칩 owner 클래스 뒤집기(다음 렌더에서 원상복구) | `G1post P1 tele pick1 P2-screen←P1.S: owner class at (13,1) pc p1 hiddenId` | **fail 28 / 종료 1** — 28건 전부 `owner class` 비교 실패 (rev 2: fail 0 / 종료 0 — REVISE 원인) |
| `rotate180` | P2 렌더 열도 `8−c` (좌상 → 우하) | `DOM#0 screen(1,1) holds logical (13,7); reflect-contract expects (13,1)` · 가설 적중 reflect 0/rotate 1 | fail 719 / 종료 1 |
| `flipByTurn` | 반사가 `S.current===1` 을 따름 | `data-flip=0 expected 1` 시작 직후, 이후 매 step | fail 700 / 종료 1 |
| `flipOnCross` | P2 말이 7행을 넘으면 반사 해제 | `cross P2 →8 mv→(8,4) P2-screen←P1.S: data-flip=0 expected 1`(step 집계 — rev 2 에선 목록에만 남던 실패) + 칩 DOM#-1 · pre·post 모두 | fail 313 / 종료 1 (rev 2: 59) |
| `setupColMirror` | P2 배치 열 미러(렌더는 그대로) | 배치 보존 `same=3`·`mirror=3` | fail 50 뒤 H 절에서 대본 전제(횡단 말 위치) 붕괴 → 스크립트 예외 → **종료 3**(집계 출력 후) |
| `no104` | `visibleTo(humanViewer(),p)` 복원 | `H(P1 actor) BT lateral2 onto hidden mv→(10,5): S.mainUsed true≠false` · `X=(10,4) Y=(10,3)`(#104 서명) · battleLoop 완주 실패 | fail 20 / 종료 1 (rev 2: 10) |
| `datasetSwap` | dataset 에 화면 행 기록 | `screen(1,1) holds logical (1,1); expects (13,1)` | fail 708 / 종료 1 |
| `--ref dadc8bc` (#93 이전) | 반사 없음 | `배치 단계 flip=0` 실패·`data-flip=undefined` | fail 726 / 종료 1 |

원본 6baa0b5 는 같은 도구로 fail 0 / 종료 0. 변이 실패 수는 첫 로드 선공 등 난수로 실행마다 조금 다를 수 있다(예: rotate180 716→719). 모든 변이는 `MUTANT … applied (anchor matched, source changed)` 를 출력했다(종료 2 없음).

### 3.7 SELF — 오라클·회계 자기 검사 (6절, 제품 무변경)
테스트 쪽 DOM 스텁만 손상 → 검출 → 복구 → 통과: owner 클래스(`owner class`) · 칩 제거(`chip missing`) · 두 칸 DOM 순서 교환(`reflect-contract expects`) · `data-flip` 변조(`data-flip`). `step()` 안의 불일치가 기록기에 실패로 기록되고 `false` 를 돌려주는지 포획기로 확인. 총합 검사: `AUDIT done=15162 skipped=890 agreeFull=7562 agreePartial=445 steps=3697`, `fails.length===fail`. 전부 통과.

**하네스 의존** [확정]: 작업 트리의 `demo/test/harness.js`(Mars_1 소유, 편집 0, sha256 `8a3596fd…` 전후 동일) 를 `require` 한다. Saturn 이 기준판 하네스(`git show 6baa0b5:demo/test/harness.js`, `cf1dec19…`)를 메모리에 올려 같은 통과를 독립 확인했고, 현재 하네스와의 차이(#106 심볼 노출·`BAL.fx` 조건부)는 6baa0b5 제품에 영향이 없다. 이번 rev 3 에서는 하네스 교차 재실행을 다시 하지 않았다(도구 변경은 회계·집계이고 하네스 사용 방식은 그대로).

---

## 4. 실제 Chrome 2클라이언트 — `demo/test/orientation_audit_cdp.js` (rev 3)

```
node demo/test/orientation_audit_cdp.js --read-only   # 산출물 0 · Chrome 임시 프로필(os.tmpdir()/orient-cdp-*)·PORT=0 서버만 생성·정리
node demo/test/orientation_audit_cdp.js               # docs/qa/issue104-orientation-audit/ 에 PNG 4장 + orientation_audit_cdp_report.json (이 폴더만)
종료 코드: 0 통과 · 1 판정 실패 · 2 Chrome 없음 · 3 실행 예외
```

조건: 헤드리스 Chrome · CDP 탭 2개 · 실제 릴레이 서버(`PORT=0` 루프백, 사용자 8080 무접촉) · 1280×1000. 두 탭은 서버의 같은 출처 빈 URL(`/qa-orientation-blank`)로 간 뒤 `Page.setDocumentContent` 로 문서 본문을 `git show 6baa0b5:demo/index.html`(메모리, sha256 `d77be36d…`)로 바꿔 넣는다. 아트는 서버가 `demo/assets` 를 디스크에서 읽어 서빙한다. 페이지 안 계측은 `WebSocket.prototype.send` 를 감싸 나가는 `{t:"a"}` 를 관측만 한다.

측정 원칙: 화면 좌표는 **`getBoundingClientRect` 픽셀**(91칸 중심 y 정렬 → 화면 행, x 정렬 → 화면 열). 클릭은 **독자 변환으로 계산한 픽셀**에 실제 마우스 이벤트를 넣고, 실제 송신 페이로드 `{t:"cell",r,c}` 가 의도한 논리 좌표인지, 상대 탭이 같은 좌표로 재생했는지, 그 뒤 양 탭 91칸 픽셀 대조 + **`elementFromPoint(중심)` 91/91** 까지 매 step(각 이동의 mv·end, 각 턴 교대) 확인한다. **선택 클릭 직후는** hl-sel/hl-move 픽셀 자리·전진 방향·상대 화면 강조 0·상태 정착만 보고 91칸 전수 픽셀 대조는 하지 않는다(그 다음 mv step 에서 한다). `CANON` 은 **선택 필드**(phase·current·turn·mainUsed·battlesUsed·forced·teleUsed·events·tempReveal·battle·modalSeq·말의 id/owner/type/rosterId/name/element/hp/r/c/alive/placed/revealed/immobile/skills)이며 S 전체가 아니다(cds·memos·traces·inv·reserve·selected 제외).

---

## 5. Chrome 실측 결과 — **20/20** (`cdp_read_only.log` 읽기 전용 실행 · `orientation_audit_cdp_report.json` + PNG 4장은 산출물 실행, 2026-09-08T07:09:42Z)

| # | 측정 | 결과 |
|---|---|---|
| 0 | 두 탭이 고정 ref 본문을 받음 (`setDocumentContent` 2회 · #104 주석 존재 · 출처 = 서버 주소) | ok |
| 1a·1b | 서로 다른 로스터 6종 카드 클릭 · 트레이→칸 클릭 14개 · 배치 단계 flip=0 | ok |
| 1c | 실제 서버 매칭 A=P1 · B=P2 (선공은 난수: 산출물 실행 P2, 읽기 전용 실행도 P2) | ok |
| 2a | P1 탭 픽셀 91칸 ↔ 항등 ↔ P2 탭 S · elementFromPoint 91/91 · flip=0 | ok |
| 2b | P2 탭 픽셀 91칸 ↔ 행 반사 ↔ P1 탭 S — **reflect 91 · rotate 13 · identity 7** · elementFromPoint 91/91 · flip=1 | ok |
| 2c | 가설 판별: P2 화면 = 행 반사, 180° 회전은 중앙열 13칸만 | ok |
| 2d | `elementFromPoint(칸 중심)` = 그 칸 (양 탭 91/91, 시작 직후) | ok |
| 2e×2 | 배치 단계에 클릭한 픽셀 14개 = 시작 후 자기 화면의 그 말 픽셀 (P1·P2 14/14) | ok |
| 3a | 횡단 말 P1 (11,2) · P2 (3,6) | ok |
| 3b | 65턴 이전 픽셀 클릭(전진 3·측면·후진·전진·측면 복귀, 양 플레이어) — 28클릭 | ok |
| 3c | **65턴 이전 중앙·양쪽 숲 횡단 → P1 (2,2) · P2 (12,6)** — 도달 시 표시 턴 28(선공 P2 실행; 선공에 따라 27 또는 28), BT 아님 | ok |
| 4a | 실제 턴 버튼으로 65턴 BT 진입 — 매 교대 뒤 양 탭 91칸 픽셀 대조 | ok |
| 4b | 두 번째 하수인 자동 선택 P1 (11,1) · P2 (3,4) | ok |
| 4c | 65턴 이후 BT 2칸 전·후·전 + 중앙 횡단 → P1 (5,1) · P2 (9,4) — **Chrome 의 65턴 이후 경로는 상대 숲 5/9행까지**(2/12행 전체 횡단은 헤드리스만) | ok |
| 4d | 전 과정 flip 불변(P1=0·P2=1) · **80클릭 페이로드 불일치 0** · **매 step 뒤 양 탭 91칸 픽셀 대조 119회, 그 전부 elementFromPoint 91/91** | ok |
| 5 | 기권 → 양 탭 over · 종료 화면(전체 공개) 91칸 픽셀 대조 · P2 여전히 행 반사 | ok |
| 6 | 콘솔 오류 0 (두 탭) | ok |
| **7** | **아트 실제 로드 성공**: 종료 화면의 공개 하수인 칩 img 전부 `complete && naturalWidth>0` — P1 12/12 · P2 12/12 (시작 직후 자기 말 6/6·6/6) | ok |

Chrome 에서는 텔레포트·충돌·밀어내기·도망을 재생하지 않는다(헤드리스 전용). 메모 마커 위치·흔적(trace) 아이콘·튜토리얼 힌트·강제 대상 강조 위치는 두 도구 모두 명시 검사하지 않는다(7절).

---

## 6. 행 반사(구현) 와 180° 회전(원인 가설) 의 차이 — 매핑 예시

논리 좌표 `(r,c)`: r=1 이 P2 진영 최후방, r=13 이 P1 진영 최후방, c=1 이 **양 플레이어 모두 화면 왼쪽**.

| 논리 (r,c) | P1 화면 (행,열) | P2 화면 — 구현 (행 반사) | P2 화면 — 180° 회전이었다면 |
|---|---|---|---|
| (1,1) P2 최후방 좌 | (1,1) 좌상 | **(13,1) 좌하** | (13,7) 우하 |
| (1,7) | (1,7) 우상 | (13,7) 우하 | (13,1) 좌하 |
| (3,4) | (3,4) | (11,4) | (11,4) (중앙열은 동일) |
| (7,1) 중앙 좌 | (7,1) | (7,1) | (7,7) |
| (13,1) P1 최후방 좌 | (13,1) 좌하 | (1,1) 좌상 | (1,7) 우상 |
| (11,4) | (11,4) | (3,4) | (3,4) |

- **구현(확정)**: 두 화면은 수평축 거울상이고 열은 공유한다. "좌상 → 우하"는 일어나지 않는다.
- **회전 가설(원인 아님)**: 회전 변환은 91칸 중 중앙열 13칸에서만 행 반사와 같은 값을 준다. 실측은 모든 경기·모든 시점에서 행 반사 91/91, 회전 13/91.
- 두 규칙 모두 "자기 진영 아래·전진 = 화면 위"는 같고 차이는 열 방향뿐이므로, 어느 규칙에서도 "중앙을 넘으면 전진이 뒤집히는" 현상은 코드상 생기지 않는다. **이 보고는 설계 변경이나 새 결정을 요청하지 않는다.** CJ 의 180° 언급은 원인 가설로 검토했을 뿐 재설계 요청으로 읽지 않았다.

---

## 7. 한계 (Saturn 지적대로 좁힌 주장)

- **원래 CJ 세션 미재현**: 6baa0b5 의 코드 경로와 자연 흐름 재현이며 CJ 가 본 세션의 재생이 아니다. 발견 못함 ≠ 없음. 한계 진술이며 승인 게이트가 아니다.
- **S 비교 범위**: 헤드리스 `gameCanon`·Chrome `CANON` 은 선택 스냅샷이지 S 전 필드가 아니다(4절·3절 명시).
- **아트**: 헤드리스는 `img src` 경로 검사뿐. 로드 성공은 Chrome 7(종료 화면 12/12) 이 본다. 헤드리스 스텁은 이미지를 로드하지 않는다.
- **픽셀 검사 시점**: Chrome 의 91칸 전수 픽셀 대조 + elementFromPoint 91/91 은 시작 직후와 **매 이동 완료(mv)·턴 종료(end)·턴 교대 뒤**(119회)다. 선택 클릭 직후는 강조 픽셀 자리·방향·상대 강조 0·정착만 본다.
- **명시 검사 없는 항목**: 메모 마커 위치, 흔적(🔍 trace) 아이콘 위치, 튜토리얼 힌트, 강제 대상(hl-attack) 강조 위치. 퍼즈의 메모 피커 열고 닫기는 마커 배치 검증이 아니다.
- **퍼즈 통계는 확률적**: 밀어내기·도망·포획·탐색·텔레포트 횟수는 시드·제품 난수 의존이며 고정 횟수를 주장하지 않는다. 방향별 밀어내기/도망 매트릭스는 없다.
- **Chrome 경로**: 65턴 이전 전체 횡단(2/12행)은 Chrome 도 수행. 65턴 이후는 상대 숲 5/9행까지이고 2/12행 전체 횡단은 헤드리스만. 표시 턴은 선공에 따라 27/28.
- 헤드리스 `dataset` 은 숫자 스텁이라 수치 비교, 실제 문자열 DOM·픽셀은 Chrome 이 확인. 새로고침 이탈(`opponent_left`)은 방향과 무관해 미검증, 재매칭은 새 로드로 검증.
- 로그·메모 피커의 `n행 m열` 문구는 논리 좌표라 P2 화면과 다르게 보인다 — 계약대로이며 결함으로 분류하지 않았다.

---

## 8. Saturn 재실행 경로 (읽기 전용, 파일 쓰기 0)

```
node demo/test/smoke_orientation_audit.js --verbose                # pass 8924 / fail 0 (수치는 난수로 소폭 변동) · AUDIT 행 · 종료 0
node demo/test/smoke_orientation_audit.js --mutate teleOwnerStage2 --seeds 1   # fail 28 (전부 owner class) · 종료 1  ← REVISE 재현 변이
node demo/test/smoke_orientation_audit.js --mutate flipOnCross --seeds 1       # 종료 1 (첫 실패 cross P2 →8 data-flip)
node demo/test/smoke_orientation_audit.js --mutate no104 --seeds 1             # 종료 1 (X=(10,4) Y=(10,3) 서명 + battleLoop 완주 실패)
for m in rotate180 flipByTurn setupColMirror datasetSwap; do node demo/test/smoke_orientation_audit.js --mutate $m --seeds 1; done   # 종료 1·1·3·1
node demo/test/smoke_orientation_audit.js --ref dadc8bc --seeds 1  # 종료 1
node demo/test/orientation_audit_cdp.js --read-only                # 20/20 · 산출물 0 · Chrome 임시 프로필·PORT=0 서버만 (RESOURCE/CLEANUP 행)
```
의존: Node 22+ · git · 로컬 Chrome · `server/node_modules`(ws) · 작업 트리 `demo/test/harness.js`(헤드리스). 두 스크립트 모두 작업 트리 `demo/index.html` 을 읽지 않는다. 이번 실행 환경: Node v24.16.0, Chrome 152, 9개 헤드리스 실행을 병렬로 돌려 각 약 1분.

런타임 정리(이번 실행): 산출물 실행 서버 PID 71780(127.0.0.1:58403)·Chrome PID 98336·프로필 `orient-cdp-8lFYvv`, 읽기 전용 실행 서버 PID 80672(:58545)·Chrome PID 43280·프로필 `orient-cdp-hf957E`. 사후 확인: 네 PID 모두 부재, `orient-cdp-*` 프로필 0개, 두 포트 리스너 0. 사용자 8080 무접촉.

---

## 9. 납품 파일 (Mars_3 소유분만 — rev 3 에서 전부 갱신)

| 파일 | 역할 |
|---|---|
| `demo/test/smoke_orientation_audit.js` | 헤드리스 2클라이언트 방향 감사(14경기 pre/post + H + O + F + Z + SELF) · step 집계 회계 · 변이 7종 |
| `demo/test/orientation_audit_cdp.js` | 실제 Chrome 2탭 픽셀 감사 20 (매 step elementFromPoint 91/91 · 아트 로드 성공) |
| `docs/qa/issue104-orientation-audit.md` | 이 보고 (rev 3) |
| `docs/qa/issue104-orientation-audit/headless_verbose.log` | 헤드리스 `--verbose` 전체 로그(가설 적중 14경기·절별 회계·퍼즈 통계·AUDIT 요약) |
| `docs/qa/issue104-orientation-audit/mutants.log` | 변이 7종 + dadc8bc 음성 대조(첫 4 FAIL·owner class 건수·AUDIT·요약·종료 코드) |
| `docs/qa/issue104-orientation-audit/cdp_read_only.log` | Chrome 읽기 전용 실행 로그 20/20 |
| `docs/qa/issue104-orientation-audit/orientation_audit_cdp_report.json` · PNG 4장 | Chrome 산출물 실행(픽셀 격자·stepBad=[]·클릭 80·stepAudits 119)·화면 |
| `docs/qa/issue104-orientation-audit/README.txt` | 폴더 안내 |

rev 2 의 PNG·JSON 은 도구가 바뀌었으므로 재촬영·치환했다(폴더 내용 = rev 3 실행 산출물). 스크린샷은 토스트가 상단 행을 일부 가리므로 91칸 위치의 증거가 아니라 참고 화면이며, 위치 증거는 JSON 의 픽셀 격자와 로그 수치다.

## 10. SHA256 (rev 3 최종)

| 파일 | SHA256 |
|---|---|
| `demo/test/smoke_orientation_audit.js` | `abe1516f79ffeecb5660ada7f96218122a051d961c94527a30c77b2334d69dfa` |
| `demo/test/orientation_audit_cdp.js` | `8bf065dadc70aa482281981c3fabd1c6568226a276b6d98083cac9bdb66a1bbb` |
| `docs/qa/issue104-orientation-audit/README.txt` | `3a76e63a86ef2dfa7e9b87b187c21ff4cf0078bb5de42e2042a5d901ba8c7fea` |
| `docs/qa/issue104-orientation-audit/cdp_read_only.log` | `74bc5872f7c60f447b28a0ee2663c89920b2c88c15689e7a68446de33f3132a1` |
| `docs/qa/issue104-orientation-audit/headless_verbose.log` | `a59378e8b6969dc2c30a0e0f3c4433eb97805520a82c826d8ed75495821f7631` |
| `docs/qa/issue104-orientation-audit/http_desktop-1280_1-p2-start.png` | `f9911dd78047f2e7cd7b8de31bfbb246bbb6b7faf1533f85927c4ae18b875dda` |
| `docs/qa/issue104-orientation-audit/http_desktop-1280_2-p2-pre65-after-crossing.png` | `cb806434c51bff9ad76160da31fafba82c087bb6c19eb6531213e10b7e4ee480` |
| `docs/qa/issue104-orientation-audit/http_desktop-1280_3-p2-after-crossing.png` | `5837d4d94729ba32f5ea97fa3015bf98d7dcffd4f8a68339daf1f88ac47854a3` |
| `docs/qa/issue104-orientation-audit/http_desktop-1280_4-p1-after-crossing.png` | `ec869c5f902283159841b484e8037cb777de20f9018fb2b51e5cd791b134889b` |
| `docs/qa/issue104-orientation-audit/mutants.log` | `3b96ddd6cf11a248372124f80f2f25e194852a5f18392acf8714be11d1070c36` |
| `docs/qa/issue104-orientation-audit/orientation_audit_cdp_report.json` | `e98b0c20683d6665d500683be0ce0193e528a62e8d7f08896a6220dcee3118e1` |
| `docs/qa/issue104-orientation-audit.md` | (PD 취합 시 계산 — 이 표를 포함한 파일이라 자기 해시를 넣을 수 없다) |

rev 2 → rev 3 변경 전 해시(Saturn 보고와 동일): `smoke_orientation_audit.js` `9f29bbb5…` · `orientation_audit_cdp.js` `2bbea1fc…` · 보고 `eab81d77…`.
읽기 전용 의존물 전후 동일: `demo/test/harness.js` `8a3596fdf73acdcec4c071e435c5b64ffaee371211b825e9a43df0e2ff0d336c` · 감사 대상 `git show 6baa0b5:demo/index.html` `d77be36dcd5d9528ea0cbd2c96286e6c865f9a59b1fcdb0b67e78c588a044fef` · 기준 하네스 `cf1dec192b1b05a0a5ec125fdde9d99810e36388831d6464354ce9b4ac321a60`.

작업 트리 상태 메모 [확정]: #105 README 미디어는 PR #108(`40415c2`) 로 이미 병합됐고(rev 2 의 "미커밋 #105 문서" 문구는 역사적 기록), 현재 트리의 `demo/index.html`·`harness.js`·`smoke_cross_skill.js`·`smoke_cycle5.js`·#106 문서 등은 Mars_1/Mars_2 등 다른 주체의 진행 중 변경이다. Mars_3 는 9절 파일만 만들거나 고쳤다.
