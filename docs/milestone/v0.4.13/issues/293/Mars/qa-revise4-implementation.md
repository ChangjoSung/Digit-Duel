# #293 CJ QA REVISE 추가 4건 — Mars 구현 보고 (2026-10-02)

- 역할 5필드: required_role=Mars · mode=IMPLEMENT · area=CLIENT_TOOLING · mutation=code/docs · instance_index=null
- 실행값: Claude `claude-opus-5-5` · effort high · bypass(루트가 PID 36592 실행 인수·footer 확인) · Ponytail full
- dispatch `ctx_ee5431908c72` / task `task_40f85d981c1d` · 기준 HEAD `08e3995` · 계약: [Venus 구현 계약 9장](../Venus/implementation-contract.md) (AC 14~18) · 원문: [CJ 4건](../references/CJ_QA_REVISE4_20261002.md)
- Git·GitHub·Render·Notion·브라우저·새 테스트 파일·새 의존성·하위 Worker: 0회. 서버 파일 무수정(Jupiter 소관).

## 1. 원인과 수정 (확정 = 코드·헤드리스 실행으로 확인 / 추론 = 미실행)

| # | 원인 | 수정 | 파일 |
|---|---|---|---|
| 1 교체 창 [취소] | ✕가 맨 아래 첫 버튼을 대신 누르고(`#obBtns button`.click), 공용 Esc도 "취소" 글자의 버튼만 찾았다 → 버튼만 지우면 ✕·Esc가 함께 죽는다. 그 버튼은 `modal()`의 입력 잠금 가드도 지나서 단절·연출 중엔 닫히지 않았다 | `__shop('swapX',uid)` 신설(닫기 + 누른 [교체]로 포커스) · ✕가 직접 호출 · 버튼 목록 `[]` · 공용 Esc는 [취소]가 없으면 창의 `.acctHead .acctX`를 누른다. 닫기는 잠금 가드를 지나지 않는다. 상점이 이미 끝났으면 창만 닫는다 | `demo/js/ui.js` · `demo/js/ui-overlays.js` |
| 2 수호자 1→3 | 8종이 `ECO.goodPrice` 하나를 공유 | `ECO.buffPrice=3` + `ecoGoodPrice(k)`(수호자 3종만 3). Core `shopGood`의 부족·예비·차감 3곳과 화면 가격·활성(상품별)이 이 함수 하나를 읽는다. 효과·사용 규칙·나머지 5종·AI 무변경 | `demo/js/data.js` · `demo/js/core.js` · `demo/js/ui.js` |
| 3 설명 팝업 | 아이콘 → 맨 아래 `#goodDesc` 한 줄 | `#goodDesc`·`goodInfoText`·`UI.goodInfo`·`.goodDesc` CSS 삭제. `goodHelp()`가 시너지 안내 창(`.synHelp`·`acctHead`·`acctX`·SYNHELP 닫기/Esc/바깥 누름/포커스 복귀)을 그대로 쓴다 — 공용 여는 부분만 `synHelpOpen()`으로 뺐다. 구성: 머리줄 아이콘+이름·✕ / 큰 아이콘 \| 이름+🪙가격 / 설명 한 줄. 문구 8종은 계약 9.3 표 그대로(`GOOD_DESC`), 전투·선물 화면 문구(`ITEMS`/`BUFFS.desc`) 무변경 | `demo/js/ui.js` · `demo/css/game.css` |
| 4 단절 중 방 나가기 | `netLeave()`가 `NET.pause`를 지우지 않았다. 나간 직후 방 목록 소켓이 `NET.publicMode`를 다시 켜면 `netResumeBarSync()`가 남은 값으로 X01·`inert`·초 타이머를 되살렸다 | 공용 `netLeave()` 한 곳에서 `NET.pause=null; NET.lobby=null;` 뒤 `netResumeBarSync()` 호출(숨김·타이머 해제·inert 해제). `netLeaveRoom()`은 열려 있던 그 경기의 창(교체 선택·설명 팝업)도 닫는다. 유예 60초·입력 잠금·기권·방장 취소·재대전 경로 무변경 | `demo/js/ui.js` · `demo/js/network.js` |

4번 원인은 수정 뒤 헤드리스 단언(F22)이 통과하는 것으로 확인했다. **수정 전 상태에서 F22가 실패하는지는 따로 돌려 보지 않았다**(승인 실행 횟수 안에서 생략) — 실기기 재현은 CJ 플레이 QA 몫이다.

## 2. 명시적으로 대체한 기존 기대값 (그 밖의 단언은 무수정)

| 파일 | 대체 |
|---|---|
| `smoke_issue293.js` | C1 "취소 버튼 있음" → ✕ 직결·버튼 0개 / C4 취소 클릭 → `swapX` + C4b Esc 폴백·대리 누름 삭제(소스 단언) / F1의 `#goodDesc` 안내 문장 → 아이콘 접근성 이름 / 추가 C'1~C'8(가격 3·상품별 활성·거부·팝업 8종 문구·무변경·`#goodDesc` 없음) |
| `smoke_issue285.js` | B5·B6 `#goodDesc`/`UI.goodInfo` → 팝업 내용·본문에 설명 줄 없음 |
| `smoke_issue238.js` | A3 수호자 3종 각 🪙1 구매 → power 🪙3 구매 + time·escape 예비 재화 거부 (A4 🪙6·A5 그대로 통과) |
| `smoke_issue263_client.js` | F21 뒤에 F22(AC17) 추가: 나간 뒤 `publicMode`가 다시 켜져도 정지 상태·타이머·inert·열린 창 없음 |

## 3. 검증 — 승인 예산(기존 8종 + typecheck 각 1회, 실패분만 재실행)

| 스크립트 | 1회차 | 비고 |
|---|---|---|
| smoke_issue293 | 107 pass / **1 fail** | F1이 삭제된 `#goodDesc` 안내 문장을 요구 → 기대값 대체 뒤 **재실행 1회: 108 / 0** |
| smoke_issue285 | 43 / 0 | |
| smoke_issue238 | 147 / 0 | |
| smoke_issue236 | 290 / 0 | E13 정기 상점 수호자 구매 포함, 기대값 무수정 |
| smoke_issue263_client | 174 / 0 | |
| smoke_public_rooms | 191 / 0 | |
| smoke_fx_consumer | 133 / 0 | |
| smoke_issue146 | 218 / 0 | `BUFFS.escape.desc` 단언 무수정 통과 |
| `npm run typecheck` | exit 0 | |

실행 합계: 스크립트 9회(8 + 재실행 1) + typecheck 1회. 실제 실패 1건(위 F1), 그 외 0.

## 4. 한계 · 남은 일

- (1차 dispatch 시점 기록) 브라우저 0회 — 팝업 배치·✕/Esc·포커스·잠금 중 닫기를 화면으로 보지 않았다.
- **후속 dispatch `ctx_8ddb55c00a02` / task `task_ecc6021abe21`로 갱신**: Orca 내장 브라우저 390·320 합성 상태에서 실제 키·클릭으로 확인했다 — 증거와 조건은 [qa-revise4-visual/README.md](qa-revise4-visual/README.md). 팝업 ✕·Esc가 팝업만 닫고 정기 상점은 열린 채 포커스 복귀, 교체 창 ✕·Esc가 모의 잠금(`fxLocked()=true`) 중에도 상태 무변경으로 닫히고 [교체]로 복귀, Tab이 창 안에서 순환, 가격 1·1·1·1·1·3·3·3.
- 그 확인에서 나온 수정 1건: 설명이 낱말 중간에서 끊겨 `game.css` `.goodHelp .desc`에 `word-break:keep-all` 추가 → `smoke_issue293` 재실행 1회 108/0(누적 실행: 스크립트 10회 + typecheck 1회).
- 여전히 없는 것: 실제 서버·두 번째 플레이어·실기기, 실제 단절 정지(`inert`) 중의 닫기, 단절 뒤 방 나가기의 화면 증거(자동 단언 F22만). 두 실브라우저 사람 PASS를 주장하지 않는다.
- 서버 테스트(`server/authoritative/test/test-issue237-economy.js` 162~170·180행 등 수호자 🪙1 가정)는 Jupiter 소관이라 돌리지도 고치지도 않았다. Core 가격 수정 직후 Mercury에 알렸다.
- 따라 나오는 결과(새 규칙 아님, 루트 확인): 예비 재화가 그대로라 시작 상점에서 수호자는 최대 1개다.
- Saturn 독립 QA·CJ 플레이 QA·Git/PR은 이 작업 밖이다.

## 4b. 팝업 수명 정리 (dispatch `ctx_62e2985b7790` / task `task_99a651708feb` · 2026-10-02)

- 실행값: Claude `claude-opus-5-5`(시스템 표기 · `.claude/settings.json` model 동일) · effort high(설정값 — 세션 안에서 실효값은 보이지 않음) · 권한은 이 세션에서 거부·확인 요청 0회(실행 인수·footer 는 루트 확인 몫) · role5 Mars / IMPLEMENT / CLIENT_TOOLING / code+docs / null. Git·브라우저·새 파일 0.
- 문제(앞 화면 확인에서 내가 남긴 위험): 열어 둔 설명 팝업(시너지 안내 포함, `SYNHELP`)이 화면이 바뀌어도 남았다. 재현 = 기존 `smoke_issue293.js`에 넣은 C'9 한 단언을 **수정 전에 1회** 돌려 4개 전환 모두 실패 확인: `[열림,닫힘]` 쌍 실측 `[true,false]`×4 — 상점 완료(`shopDone`) · 준비 만료(`shopTimeout`) · 새 판(`startMode`) · 정기 상점 창 닫힘(`closeModal`). 108 pass / 1 fail.
- 정리 호출처 추적: 닫기는 `synHelpClose` 하나. 종전 호출처는 ✕ · Esc · 바깥 누름 · 다른 칩 열기 · `netLeaveRoom`뿐이었고, 화면 전환 쪽 공용 정리(`uiApply` · `closeModal`/`modal` · `gameReset` 이벤트 · `uiResetScreen` · `netLeave` · `netRematchReset`) 어디에도 없었다.
- 수정(전부 `synHelpClose(false)` 재사용, 새 기능 없음):
  - `demo/js/ui.js` `uiApply()` — 화면 이름+준비 단계 키(`UI.helpKey`)가 바뀔 때만 닫는다. 같은 화면의 다시 그리기는 닫지 않는다(읽는 중 상대 갱신으로 꺼지지 않음). 온라인도 `render()`가 이 함수를 지나므로 서버가 단계를 넘겨도 같다.
  - `demo/js/ui.js` `gameReset` 이벤트 — 새 판(같은 화면에서 다시 시작·재대전 포함).
  - `demo/js/ui-overlays.js` `modal()` · `closeModal()` — 그 창 **안에** 떠 있던 팝업만 닫는다(`modalHelpDrop`). 종전에는 창 내용이 바뀌면 요소만 떨어지고 `SYNHELP.el`이 남아 다음 Esc 한 번을 삼켰다. 창 밖(보드 HUD) 안내는 건드리지 않는다.
- 검증(각 1회): `smoke_issue293` 수정 전 108/1(C'9) → 수정 뒤 **109/0** · `smoke_issue238` 147/0(전투창 안 시너지 안내 경로) · `npm run typecheck` exit 0. 이번 dispatch 실행 합계: 스크립트 3회 + typecheck 1회. 4건 수정·AC14~18 단언은 무수정 통과.
- 한계: 헤드리스 합성이다 — 정기 상점은 `ecoOpenShop`으로 만든 모의 20턴 상점이고 창 안 팝업은 `closest` 대역 객체로 붙였다. 브라우저·실서버·온라인 단계 전환(room_state) 화면 확인은 하지 않았다(온라인은 `uiApply` 공용 경로라는 코드 근거뿐). 준비 단계 안에서 01 상점 ↔ 02 배치 탭을 직접 바꿔도 팝업이 닫힌다(의도).

## 5. 수정 파일

`demo/js/data.js` · `demo/js/core.js` · `demo/js/ui.js` · `demo/js/ui-overlays.js` · `demo/js/network.js` · `demo/css/game.css` · `demo/test/regression/smoke_issue293.js` · `smoke_issue285.js` · `smoke_issue238.js` · `smoke_issue263_client.js` · 이 보고서
