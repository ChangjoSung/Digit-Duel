# #238 Saturn 동결 감사 REVISE — Mars 필수 수리 3건

- 일시: 2026-09-28 · 역할: Mars / IMPLEMENT / CLIENT_TOOLING / code / instance_index=null
- 실행: PID 21900 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` · JSONL `90a829a4…` model=claude-opus-5-5 · Ponytail full
  - 채택된 기동 영수증 requested/effective(agent·model·effort)는 모두 **null**이다(PD 정정). effort high 는 argv 로만 관측됐다.
- 기준: HEAD e1bfdc2 · Jupiter ctx_cfba85929bef 서버 회선(전설 종 키) 완료 통지 뒤 작업

## 1. 온라인 시전 연출(fx.cast) — [확정]

| 결함 | 수리 |
|---|---|
| `netFxApplyMsgFx`가 서버 `fx.cast`를 버렸다 | 그 이벤트 `battleId`의 보관 스냅샷(`NET.fxBattleSnaps[bid]`, 없으면 `NET.fxScenes[bid]`) 전투원을 `netSynthFighter`로 만들어 공용 `castFx(side,f,live)`에 넘긴다. 전역 `S.battle`은 읽지도 바꾸지도 않는다 |
| 지연 정리 가드 | `castFx` 정리 타이머 = `FX.gen` + 토큰별 시전 번호(`t._castK`, 뒤 시전이 앞 정리에 지워지지 않음) + 온라인 `live(t)` = `NET.fxGen` 동일 · `$("tok-"+side)===t` |
| 종 유도 | 일반은 공개 종(`rosterId`, 대리는 `artRosterId`)의 ROSTER 아키타입·속성. 전설은 닫힌 `LEGEND_ROSTER` id 만 |
| 전설 정체 | `netSynthFighter`가 본체 `rosterId`·대리 `artRosterId`의 `L-DRAGON/L-WITCH/L-REAPER`만 `f.legend`로 되살린다(본체는 `piece.name`도). 대리 전설의 `artRosterId`는 null(ROSTER 전용 의미 유지). 새 원시 필드 없음 |
| 내 전설 대리 출전 | cap 짝짓기 키 = `cap.artRosterId ‖ (cap.legend ? ecoKey(cap) : null)` → 자기 atk/skillAtk 보존. 상대 전설은 atk 를 만들지 않는다(종전 "?" 유지) |

재접속: baseline 은 마지막 KO/결과 배너 1개만 재생하므로 옛 시전은 재생되지 않는다(코드 변경 없음, K7 로 고정). 움직임 줄이기·1.2초는 기존 CSS/타이머 그대로.

## 2. X03 로컬 마감 제거 — [확정]

`NET_RESUME_GRACE_MS`·`NET.resumeDeadline`·`netResumeTick`의 로컬 만료 분기를 삭제했다. 재접속은 3초 간격 재시도를 계속하고 서버 권위 응답(room_resumed · 회복 불가 error · E_SESSION_ENDED/4003 · 세션 확인)으로만 끝난다. 서버 60초 유예·X01·계정 무효화 경로는 변경 없음. `netCancelResume`(UI 미노출, 기존 K18~K20)은 그대로 둔다. [추론] 서버에 전혀 닿지 않으면(응답 없음) 요구대로 3초 간격 재시도가 끝없이 이어진다.

## 3. S01/S02 헤더 ← — [확정]

`uiBack`/`uiBackSpec`: 공개 방 시작 전(`publicMode && roomId && !started`)은 `uiLeaveConfirm()` → `netLeaveRoom()`(leave 명령 → 소켓 닫기)로 간다. 02 배치 **편집 중**(준비 의사·서버 준비 전)의 ←만 종전처럼 01 로 가는 화면 이동이다. 라벨 `← 방 나가기`. PVE/오프라인·L03·IN_PROGRESS 기권·X 잠금 경로는 변경 없음.

[추론] X01 정지 층의 시작 전 `방 나가기 (경기 취소)`(#263 G4)는 아래 화면이 inert 라 확인 창을 띄울 수 없어 `netLeaveRoom` 직행(leave 명령 먼저)을 유지했다.

## 검증 (각 1회)

| 검사 | 결과 |
|---|---|
| `node demo/test/regression/smoke_issue238.js` | 59 passed / 0 failed (H3~H7: 실제 `uiBack` → 확인 콜백 → leave 송신 뒤 close, 취소 = 송신·닫기 없음, 02 편집 ← = 화면 이동, PVE 종전 확인) |
| `node demo/test/regression/smoke_fx_consumer.js` | 133 / 0 (K0~K7: 실제 디스패처로 일반 30종 · 전설 3종 본체+왕 대리 · 닫힌 목록 밖 거부 · 내 전설 대리 atk 31/9 · 새 전투 스냅샷보다 이벤트 battleId 우선 · `NET.fxGen` 가드 · 재접속 무재생 · 정리 1200ms) |
| `node demo/test/regression/smoke_public_rooms.js` | 186 / 0 (K12~K14b: 가짜 시계 61s·121s 에도 재시도·inert·포기 없음, 3초 간격 유지, E_ROOM_CLOSED 에만 방 목록, 125s 뒤 room_resumed 복구) |
| `tsc -p tools/typecheck/tsconfig.json` | exit 0 (castFx 시그니처 변경 때문에 실행) |

- 종료 코드는 각 스크립트의 `fail?1:0` 규칙에 따른 값(0)이다. 별도 재실행은 하지 않았다.
- 한계: 헤드리스 스텁은 `$("tok-X")`가 항상 같은 노드라 DOM 교체 가드는 코드 검토로만 확인했다. 실제 브라우저·2연결 E2E·스크린샷은 하지 않았다(시각 변경 없음).
- 로컬 서버: `tools/qa/issue260_local.js --issue262`로 8085 서버만 재기동(pid 38552 → 20592) · PG 55462 pid 38816 그대로(데이터·계정 유지, 초기화 없음) · 8081~8083 미기동 확인.

## 변경 파일

- `demo/js/network.js` · `demo/js/ui.js`
- `demo/test/regression/smoke_issue238.js` · `smoke_fx_consumer.js` · `smoke_public_rooms.js`
- `docs/milestone/v0.4.11/issues/238/Mars/qa-repair.md`
