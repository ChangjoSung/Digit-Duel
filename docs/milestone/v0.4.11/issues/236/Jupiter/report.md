# #236 Jupiter 보고 — 서버 경계 독립 검토

- 작성: 2026-09-24 · Jupiter (Claude, IMPLEMENT/SERVER, mutation=docs) · preflight `required_role=Jupiter, mode=IMPLEMENT, area=SERVER, mutation=docs, instance_index=null`
- 대상: worktree `ChangjoSung/issue-236-economy-v0411` (base `6d1b788` + 미커밋 Mars 변경) · [Issue #236](https://github.com/ChangjoSung/Digit-Duel/issues/236) · [#237](https://github.com/ChangjoSung/Digit-Duel/issues/237) · [Venus](../Venus/report.md) · [Mars](../Mars/report.md)
- 이 파일 외 수정 없음. 서버·제품·테스트·도구 코드 무수정, Git 쓰기 없음, #237 미착수.
- 표기: **[확정]** 코드·실행으로 확인 · **[추론]** Jupiter 해석

## 1. 결론

**#236 서버 경계 차단 사유(blocker) 없음.** 온라인 PVP(권위 서버·릴레이)는 종전 경제·종전 프로토콜 그대로다. 아래 3장 항목은 전부 #237 설계 입력이며 #236 수정 요구가 아니다.

## 2. 근거

| # | 확인 | 결과 |
|---|---|---|
| E1 | 권위 런타임 적재 파일 | [확정] `runtime.js:24` = `data.js`·`state.js`·`core.js`만. `ai.js`·`ui.js` 변경은 서버에 안 실린다 |
| E2 | 서버 개시 경로 | [확정] `engine.js:222` `T.newGame('pvp', {})` — `opts.eco` 없음 → `S.eco` 없음 |
| E3 | 클라이언트 온라인 경로 | [확정] `network.js:176·444·455` `newGame("pvp")`(eco 없음), 릴레이 `netStart`는 `NET.mode=true` 뒤 `startMode` → `eco:!NET.mode`=false. 재접속 유예 중에도 `NET.mode` 유지라 로컬 시작해도 eco 안 붙음 |
| E4 | Core 변경의 게이팅 | [확정] core.js diff 전 분기가 `state.eco`/`S.eco` 유무로 갈림(roster·netSetup·setupDone·endTurn 상점·수풀 코인·battleEntryPick bag·entryStep·finishBattle 대리/코인·포획·synBagLegends·humanViewer). 비경제 경로의 변경은 순수 추출 2건뿐: `battleBuffApply`(pkgPick 본문 그대로), `ballWhy`(종전 조건과 같은 불리언 — eco 조건 2개와 `!eco&&reserve`만 추가). `ai.js`의 `rand()` 단락 평가 순서도 동일 |
| E5 | 난수·상태 모양 | [확정] 비경제 `genEvents`·`newGame` 난수 소비 불변(`ecoOpenShop` 추첨은 eco에서만). `battleEntryStart` 이벤트의 `aU/dU`는 비경제에서 `undefined`(JSON 직렬화 시 빠짐). 서버 골든(runtime-contract)·match-fuzz 통과가 이를 뒷받침 |
| E6 | 회선 거부 | [확정] `room.js:46` `ACTION_TYPES`에 경제 어휘 없음 → `E_BAD_ENVELOPE`. 좌석 뷰(`toSeatView`)·`lockstepDigest`는 필드 화이트리스트라 `eco`가 우연히 새지 않는다 |
| E7 | 서버에 `eco` 참조 | [확정] `server/authoritative/*.js` 0건 (`decodeFloat`만 문자열 일치) |

### 실행 결과 (2026-09-24, Windows 로컬, 읽기 전용)

| 명령 | 결과 |
|---|---|
| `cd server && npm test` (정적 부하 + authoritative 17종) | 전부 통과 — runtime-contract 74 · scheduler 41 · engine-isolation 18 · room 57 · security-gaps 104 · authority-rules 177 · battle-fx 474 · public-authority-delta 40 · match-fuzz 16 · authoritative 50 · http-static 26 · launcher 47 · public-deploy PASS · combat-stats 547 · issue234 81 · issue241 74 · issue235 37 |
| `node demo/test/regression/smoke_issue236.js` | pass 169 / fail 0 (Mars 수치 재현) |
| 스크래치 탐침 `probe236.js` (세션 스크래치 디렉터리, 저장소 밖) | pass 34 / fail 0 — 시작된 공개 방에서 ① 두 엔진 `S.eco` 없음·코인 수풀 없음·종전 볼/아이템 시작 유지 ② 경제 어휘 12종(shop*·leaderEl·bagPick·buffUse·battleEntryPick bag) × 두 좌석 = 전부 `E_BAD_ENVELOPE`, 방·엔진 스냅샷 불변 ③ 같은 12종을 엔진 Core(`dispatchCoreAction`)에 직접 넣어도 throw 없이 상태 불변 |

## 3. #237 설계 입력 (현재 #236 blocker 아님)

eco를 권위 경로로 켜는 순간 깨지는 지점이다. Mars 보고 1장의 "한 줄 옮기면 된다"는 **[추론] 과소평가**다 — 아래가 함께 필요하다.

| # | 지점 | 내용 |
|---|---|---|
| J1 | `core.js` `ecoShopOpenState`: `if(state.mode==="pvp") active=…` | 온라인 서버도 `mode:"pvp"`라 정기 상점이 **핫시트 순차**가 된다. 동시 오픈(온라인 90초)이 되려면 핫시트/온라인 구분이 `mode` 밖에서 와야 한다. `humanViewer`의 shop/bagPick 분기도 같은 전제 |
| J2 | `ecoGate` S01: `p===state.setupPlayer` | 온라인 S01은 양측 동시. 또 서버 배치는 `setup` 명령(`room.js:526` 무료 로스터 6종 검사) → eco에서는 Core `netSetup`이 상점 완료 전 거부. 배치 프로토콜 자체를 "상점 구매 → 배치"로 재설계해야 한다 |
| J3 | `ecoReduce`가 `action.player`, `bagPick`이 `token`만 신뢰 | 로컬에선 UI가 유일 발신자라 무해. 서버 `_authorize`는 좌석→`player`/`bagPick.owner`를 **서버가 채워** 넣어야 한다(클라이언트 값 불신) |
| J4 | `_authorize`: `S.phase!=='play'` 거부 | 새 phase `shop`·`bagPick`(및 setup 중 S01) 분기 필요 |
| J5 | 타이머 | `shopTimeout`·B08 20초는 지금 `ui.js` 시계가 발행. 권위에선 서버 스케줄러가 발행·단절 시 정지(#237 범위 그대로) |
| J6 | `toSeatView`·`lockstepDigest` | 화이트리스트라 eco를 **명시 추가**해야 한다: 뷰는 자기 좌석 coins·bag·tickets·buffInv·진열만, 상대는 7.9 공개 사실만. digest에는 eco 전체(두 좌석 엔진 불일치 검출) |
| J7 | 말 단위 새 칸 | `paid`(원장)·`grade`·`fresh`·`swapMark`·`leaderElChosen`이 piece에 붙는다. 유닛 직렬화 시 `paid`는 비공개, `swapMark`는 공개 등 필드별 판정 필요 |
| J8 | `hydrate` reducer | `Object.assign({},state,…)`라 기존 `state.eco`를 그대로 들고 간다. 지금은 모든 온라인 진입이 eco 없는 `newGame("pvp")`라 도달 불가(E3). #237에서 eco를 뷰로 보낼 때는 hydrate가 `eco`를 뷰 값으로 **치환**해야 옛 로컬 값이 남지 않는다 |
| J9 | 수풀 코인 금액 | 금액 = 구역 발견 순서. 상대가 소모된 수풀 수를 볼 수 있으면 금액이 역산된다 — 7.9 비공개 범위에 들어가는지 [기획 확인 필요, Venus] |

## 4. #236 자체 관찰 (서버 무관, 참고)

- 차단 결함 없음. `ecoCaptureFinish`·`finishBattle`의 `S` 직접 변경은 기존 전투 종료 관례와 같다.
- `ui.js` 볼 버튼은 `ballWhy(ST,side)`로 바뀌었고 `ST`=`S`+전투 스냅샷이라 온라인 클라이언트의 버튼 활성 판정은 종전과 같다 [확정 — 코드 대조]. `thrown`·`oppPiece` 지역 변수는 이제 미사용(무해).
- Mars 보고의 `test:typecheck` 1건 실패(CRLF 기준선)는 서버 무관 — 재확인하지 않았다.
