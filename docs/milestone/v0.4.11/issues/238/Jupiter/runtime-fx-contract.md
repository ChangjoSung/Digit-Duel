# #238 런타임 FX 계약 — cast 재기준선 · 전설 정체 (Jupiter)

- 작성: 2026-09-28 Jupiter (Claude Code `claude-opus-5-5` high · Ponytail full)
- dispatch: task_43f25e3aca79 / ctx_cfba85929bef · 기준 HEAD e1bfdc2 (작업 트리 미커밋 상태 위)
- 승인: PD FIX GO(Saturn 감사 msg_b1da490ab0cc 이후) · 범위 확장 5파일 · 전설 회선 APPROVE(정확한 규칙 아래 2절)
- 표기: **[확정]** 실측·소스 근거 / **[추론]** 판단 / **[미확정]** 남은 것

## 1. runtime-contract REVISE — fx.cast 재기준선

### 원인 [확정]
Saturn 실측 `test-runtime-contract.js` exit 1 (72 passed / 2 failed): seed 44·55 의 fx 해시만 불일치.
승인된 #238 표시 태그 `fx.cast`(시전 측 `'A'|'D'`)가 기술 사용 줄에 더해졌기 때문이다.
- 생산: `demo/js/data.js` execV2 · 해일 발동, `demo/js/core.js` 사신의 낫 · 레거시 기술 줄 — 모두 `{key:"skillFx"}`
- 두 화이트리스트: `engine.js normalizeMsgFx` · `room.js _serializeFxMsgFx` (A/D 만 통과)

### 재기준선 전 좁은 진단 [확정]
기존 `drive()` 원문을 추출해 seed 44·55 만 1회 실행, 떼어 낸 사본에서 **fx.cast 한 칸만** 지운 투영 해시를 비교했다
(cast 만 있던 fx 는 normalizeMsgFx 규칙대로 null). 소스 변경 전과 전설 정체 변경 후 두 번 모두 같은 값.

| seed | fxN | 새 전체 해시 | cast 제거 투영 | 종전 값 | cast 수 (A/D) | skillFx 중 cast 없음 | 그 밖의 이벤트 차이 |
|---|---|---|---|---|---|---|---|
| 44 | 40 | `1b677f50ffb8c810` | `0b8775810364dfca` | `0b8775810364dfca` ✅ | 10 (5/5) | 0 | 없음 |
| 55 | 40 | `42f759efc5216e2f` | `bd52ade6a2b27033` | `bd52ade6a2b27033` ✅ | 6 (3/3) | 0 | 없음 |
| 11 | 40 | `9802fc2eaad2f033` (불변) | 동일 | 동일 | 0 (전투 0) | — | 없음 |

진단 재시도 1회: 첫 실행은 추출 정규식이 CRLF 를 못 맞춰 스크립트 오류(측정 전 종료) → 인덱스 추출로 교체. DD_GOLDEN 전체 스위트는 돌리지 않았다.

### 테스트 변경 (`server/authoritative/test/test-runtime-contract.js`)
- `fx` = 새 전체 해시(엄격) · `fxLegacy` = cast 한 칸만 걷은 투영이 종전 값과 같아야 함 · `casts` = cast 실린 이벤트 수
- 새 단언: cast 는 `src msg · key skillFx` 줄에만, **모든** skillFx 줄에 `'A'|'D'` 로 실린다
- 유지(무변경): turns/phase/winner · state · log/logN · fxN · metrics 해시 · 전투/강제/탐색 경로 · 타이머 0 · 쌍둥이 엔진 상태·fx 동일
- 임의 필드 마스킹 없음 — 투영이 지우는 것은 `fx.cast` 하나뿐이라 그 밖의 어떤 변화도 `fxLegacy` 를 깬다.

## 2. 온라인 전설 정체 (범위 확장)

### 원인 [확정]
전설 본체는 보드 칸 `type:'minion' · rosterId:null · legend:key`(data.js applyLegend · core.js shopSwap),
전설 대리는 `piece.cap.legend` 에 `artRosterId` 없음. 그래서 battle.a/d 와 FX scene 모두 전설에 `rosterId/artRosterId = null` 을 보냈다.

### 회선 (PD APPROVE) — `room.js _serializeBattle side()` 와 `engine.js sceneSideOf(T, f, piece)` 에 **같은 규칙**
```js
rosterId:    bodyFight && piece.type === 'minion' ? (T.ecoKey(piece) || null) : null,
artRosterId: bodyFight ? null : (f.artRosterId || (f.legend ? T.ecoKey(f) : null)),
```
- `T.ecoKey` = Core `ecoKey`: 일반은 `rosterId` 그대로 → **일반 값 바이트 불변**, 전설만 `L-DRAGON`/`L-WITCH`/`L-REAPER`
- 대리 출전은 기존 `artRosterId` 우선(포획 하수인 경로 불변). 새 필드·원시 `legend`·`grade`·`skills`·`cap` 추가 없음
- `room.js _serializeFxScene` 은 이미 문자열 화이트리스트라 무변경. 종료 뒤 resultBanner 는 기존 `lastScene` 을 그대로 쓰므로 같은 정체 유지

### 검증 추가 (`server/authoritative/test/test-battle-fx.js` T18)
전설 3종 × {본체, 대리} × 좌석 {소유자, 상대}:
battle.a 의 rosterId/artRosterId · battleStart scene.a 가 같은 종 키 · 본체는 종료 뒤(battle=null) resultBanner scene 유지 ·
battle.a 에 legend/grade/cap 없음 · scene 에 legend/grade/cap/skills 없음 · fx 전체에 `"legend"`/`"grade"` 키 없음 · 기존 이벤트 모양 화이트리스트.

### Mars 소비자 주의 [확정 · Mars 소관]
- `demo/js/network.js:1029` `ROSTER.find(L-*)` → null (안전 이모지 폴백, 전설 아트 매핑 필요)
- `demo/js/network.js:1037` 내 대리 수치 조회가 `p.cap.artRosterId`(전설=undefined→null) vs `sd.artRosterId('L-…')` 로 어긋남
  → 내 전설 대리의 atk/skillAtk 가 undefined. `ecoKey(p.cap)` 비교로 자기 cap 에서만 읽을 것(상대 비공개 수치 추론 금지).

## 3. 최종 실행 [확정]
| 스위트 | 결과 | exit | 비고 |
|---|---|---|---|
| test-runtime-contract.js | 80 passed / 0 failed | 0 | 1회 |
| test-battle-fx.js | 1962 passed / 0 failed | 0 | 재시도 1회 — 첫 실행 1873/12 fail, 모두 T18 내 내 단언 오류(battle 뷰의 기존 은닉 `skills` 목록을 "없어야 함"으로 잘못 검사). 정체 단언은 첫 실행에서도 전부 통과. battle 뷰는 legend/grade/cap 만 보도록 좁히고(scene 은 skills 까지 유지) 재실행 |

[추론] 두 실행의 총 단언 수(1885 vs 1962)가 다른 것은 난수에 따른 전투 길이·이벤트 수 차이로 assertEventShape 호출 수가 달라지기 때문으로 보인다. 실패 0 판정에는 영향 없음.

## 4. 수정 파일
- `server/authoritative/engine.js` (sceneSideOf/sceneOf 에 T 전달 · 전설 종 키)
- `server/authoritative/room.js` (_serializeBattle side 전설 종 키)
- `server/authoritative/test/test-runtime-contract.js`
- `server/authoritative/test/test-battle-fx.js`
- `docs/milestone/v0.4.11/issues/238/Jupiter/runtime-fx-contract.md` (이 문서)

## 5. 남은 것 [미확정]
- Mars: 위 소비자 두 곳 반영 · 8085 서버 재기동은 PD 지시로 Mars 가 수행
- 다른 서버 스위트(22종)는 지시대로 돌리지 않았다. Git·GitHub·Notion 쓰기 없음.
