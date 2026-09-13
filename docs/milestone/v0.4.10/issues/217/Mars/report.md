# #217/#218 공개 방 클라이언트 — Mars 보고 (Opus 5 high, 2026-09-13)

범위: `demo/**`·클라이언트 테스트·브라우저 러너·`.github/workflows/ci.yml`·이 폴더. `server/**`는 수정하지 않았다(서버 표시 필드는
PD 경유 Jupiter가 [public-view-delta.md](../Jupiter/public-view-delta.md)로 구현, Saturn 독립 PASS). Git·Notion·GitHub 쓰기 없음.
이 문서는 이전 Sonnet 초안(§0~§11)을 **치환**한다. 표기: [확정]=실행 결과로 확인 · [추론] · [미확정].

## 1. 무엇을 바꿨나 [확정]

| 영역 | 변경 |
|---|---|
| 무대 수명(Saturn P1) | 전투 오버레이를 **재생 중 fx 이벤트의 `battleId`가 소유**(`NET.stageBid`). battle=null·다음 전투 스냅샷이 먼저 와도 그 전투의 남은 타격·KO·결과 배너가 끝날 때까지 battleId별 보관 스냅샷(`NET.fxBattleSnaps[battle.battleId]`)으로 옛 무대를 유지하고, 끝나면 닫힘/다음 전투/선택창으로 전환(원본 `battleEndFx` 순서). 이벤트는 render 전에 큐에 올리고 render 후 재생 — 최종 HP 선반영 없음(원본 `dispHp`). |
| 전투 화면 | 간이 UI를 버리고 **원본 `battleModal()`을 서버 화이트리스트로 지은 표시용 전투로 그대로 호출**(4카테고리 메뉴·쿨/봉인·위력·가방·패키지·포획 조건·도망 확률·수동 턴 종료·버프 줄·아트). 버튼은 원본 `window.__act` 등 → 의도만 전송. |
| 시간(Saturn P1/P2) | msg 그룹 = 원본 `playMsgs`(key→`BAL.fx[key]`, 무key 병합, 무key 시작=`msgStep`), `#msgBox` 표시. 배너 = `BAL.fx[key]`(0이면 미표시), countStep 4프레임, 워치독. |
| 움직임 줄이기(Saturn P3) | 시간은 원본 그대로, CSS가 `.cell.fx-boom/.fx-trap`, `.btok.shake`, `#bstage.sigblink`, `.dmgfloat`, `.pc.fx-ghost` 움직임을 끄고 정지 표시. |
| 규칙 UI 동등성 | `data.turn`(텔레포트 단계·강제 대상·이동 말·접촉), `you.teleUsed`, `fleePick.pieceId`, FINISHED 종료 공개 소비. 상대 C-2 공개 말이 `?`로 그려지던 결함 수정. 자동 턴 종료 거부 시 같은 revision 재예약 금지. |
| 로비·준비 | 공개 방이 유일한 진입(코드 탭·주소·접속 코드 입력칸 비노출, 공개 방은 페이지를 서빙한 서버로 접속). Earth 가이드 문구·카드 내 지속 오류·44px·aria-live. 준비는 서버 `seats.ready`만 표시, OPEN에서는 보내지 않고 입장 알림에 전송, 준비 취소. 오류 코드→한국어. |
| 재접속 | **재개 뒤 onmessage가 재시도 조건에 묶여 이후 푸시를 전부 버리던 결함 수정**(실서버 재현: 재개 좌석 revision 정지·차례 교착). 전투/보드 화면에서도 보이는 고정 `#netResumeBar`(남은 시간·포기) + 재접속 중 입력 잠금. |
| CJ 모바일 QA | 기술 버튼 옆 ⓘ 설명(44px, aria-label/expanded/controls, 닫기) — 표시 전용(송신·턴 소비 0), 미공개 기술엔 버튼 없음, PC hover 유지. |
| 테스트·CI | `smoke_fx_consumer.js` 재작성(50, 실제 디스패처→render 래퍼→battleModal, 돌연변이 4종 검출), `smoke_public_rooms.js` 갱신(143), `smoke_online.js` 구 메뉴 단언 교체(159), 신규 `demo/test/integration/smoke_public_live.js`(실서버+VM 격리 2클라이언트), 브라우저 러너 `demo/test/browser/run_public_e2e.js`+`tcp_drop_proxy.js`. CI A에 fx_consumer, B에 live(2게임, timeout 15분). |

## 2. 검증 [확정 — 실행 결과]

| 검사 | 결과 |
|---|---|
| `demo/test/regression/*.js` 23종 + #122 `issue122_rules`·`back_nav` | 전부 fail 0 (ⓘ 추가 후 관련 8종 재실행 fail 0) |
| `cd server && npm test` (11 스위트) | EXIT 0 — demo 변경이 서버 엔진에 로드되므로 함께 확인 |
| `node demo/test/integration/smoke_public_live.js 3` | 33/0 — 3게임 완주(왕 제거·끝줄), 대국 중 소켓 파괴→같은 방/좌석·tokenGen 증가 재개, **텔레포트 스왑 52·도망 교환 7 직후 59회 양측 current/turnCount/revision 일치·이후 진행**, 교착·누출·예외 0 |
| 실브라우저 run_pub6 (`run_public_e2e.js`) | **20/0** — Edge 2창(1200px reduced-motion / 432px), 로비→생성/목록/참가→로스터→배치→입장·준비 대기→대국→전투(스킬 44클릭)·선택창·도망·KO/결과 배너→**전투 중 실제 TCP 단절**→고정 재접속 줄·버튼 잠금→같은 전투 무대 복원·revision 수렴→진행→자연 종료(68턴)·종료 공개·로비 복귀, computed `animation-name:none` 5종, 예외 0 |
| 실브라우저 run_pub7 | 22/1 — **I1/I2 432px ⓘ 실제 클릭: 열림·aria-expanded·44px·revision 불변·닫기 PASS**. S1 FAIL = 이 판에서 텔레포트 가능 상황·도망 성공이 발생하지 않아 비교 0건(불일치 검출 아님) |
| 실브라우저 run_swap2 (`--scenario swap`) | **16/0** — 실제 클릭 **도망 교환 8·교환 생략 5·텔레포트 스왑 1** 직후 14회 모두 양측 current/turn/revision 일치·이후 진행, 교착 0, 결과·종료 공개·예외 0 |
| Saturn 독립 QA REVISE 1건 | `fxBattleSnaps` 정리 정규식 오타(`/^d+$/`→`/^\d+$/`) 수정 + 재생 대기 전투 보호. 회귀 E5/E5b 추가(smoke_fx_consumer 52/0), 옛 오타·보호 제거 돌연변이 모두 검출. 수정 후 demo 회귀 23종 fail 0 (공개 방 전용 코드라 server npm test는 수정 전 EXIT 0 결과 유지 — 재실행 안 함) |

## 3. 재현 명령

```
node demo/test/regression/smoke_fx_consumer.js
node demo/test/regression/smoke_public_rooms.js
cd server && npm ci && cd .. && node demo/test/integration/smoke_public_live.js 3
node demo/test/browser/run_public_e2e.js --out C:/dd_cdp/out_pub2 --minutes 22          # 전체
node demo/test/browser/run_public_e2e.js --out C:/dd_cdp/out_swap2 --minutes 12 --scenario swap   # 교환·텔레포트 표적
```
러너는 작업 공간 서버를 **임의 포트로 새로 띄우고** 기존 8081(PID 33672)은 건드리지 않는다. 입력은 CDP 실제 마우스 이벤트, `Runtime.evaluate`는 좌표·화면·공개 진행값 읽기 전용(seatToken 미열람).

## 4. 증빙 경로

- 선별 스크린샷·결과: [artifacts/run_pub/](artifacts/run_pub/) — `run6_*`(로비 1200/320px·목록·입장/준비 대기·대국·전투·선택창 소유/대기·KO·재접속 줄·재개·결과·로비 복귀), `run7_guest_14_skill_info_open_guest_432.png`, `run6_result.json`/`run7_result.json`/`swap2_result.json`(체크 전체·세부값).
- 전체 원본: `C:/dd_cdp/out_pub2`(run6), `C:/dd_cdp/out_pub3`(run7), `C:/dd_cdp/out_swap2`(swap), 로그 `C:/dd_cdp/run_pub6.log`·`run_pub7.log`·`run_swap2.log`.
- 이전 `artifacts/*.png`·`MANIFEST.md`·`run_full_e2e.js`는 이전 세션 산출물로 보존(삭제 안 함) — 최신 근거는 위 경로다.

## 5. 남은 한계·미확정

- [확정] 텔레포트 스왑의 브라우저 실클릭 표본은 1회(run_swap2)다 — 대량 표본은 실서버 2클라이언트 통합 T3(52회)가 증빙.
- [확정] 폭발 잔상(`FX.hold` 유령 말)은 서버가 제거된 말 정보를 보내지 않아 공개 방에서 그리지 않는다 — 셀 폭발 표시·배너는 재생.
- [확정] 상대 대리 출전(포획 하수인) 공개 기술의 위력 범위는 유도 불가라 `?`로 표기(PD 결정, 서버 필드 철회).
- [추론] 재접속 baseline은 마지막 승패/KO 1건만 재생(battle-fx §7-4) — 끊긴 사이의 중간 타격 연출은 다시 보지 않는다.
- 독립 클라이언트 QA(Saturn)·CJ 플레이 QA·실제 배포는 이 보고의 PASS 범위가 아니다.
