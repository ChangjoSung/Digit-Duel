# #217 — 서버 권위 프로토콜 v4 (Jupiter_Server → Mars 조율안)

- 작성: Jupiter_Server (Claude Opus 5, high — 같은 원인 2회 실패 후 WORKER_MODELS 승격), 2026-09-13. v1(축소판)은 PD 반려, v2(프로세스 global 직접 로드)는 사전 감사 반려, v3는 Saturn 최종 소스 스냅샷 REVISE(`msg_9a62b8728ecf`)로 반려됐다. **이 문서는 v4 확정안이며 v3 문서를 치환한다.**
- 근거: [analysis.md](analysis.md) §2, [public-rooms-analysis.md](public-rooms-analysis.md) §2·§4, [Mercury/server-qa-revise.md](../Mercury/server-qa-revise.md), [Mercury/acceptance-audit.md](../Mercury/acceptance-audit.md).
- 표기: [확정]=코드·테스트로 확인, [추론]=확정에서 도출, [기획 필요]=CJ 결정 필요.

## 0. 구현 방식 [확정]

- 서버는 `demo/index.html`의 실제 엔진을 `demo/test/shared/harness.js`로 헤드리스 구동한다. 새 규칙 모듈은 없다. `demo/**`는 읽기만 한다.
- **좌석별 락스텝 엔진 쌍.** 룸마다 엔진 두 개(`engines[0]`=NET.me 0, `engines[1]`=NET.me 1)를 각각 독립 V8 컨텍스트(Node `vm`)에 띄운다. 시작은 기존 온라인 경로 그대로 `T.netStart(서버비밀시드,[setup0,setup1])`. 이후 서버가 인가한 입력을 **두 엔진에 같은 순서로** `applyAction`한다(원본 수신측 재생과 같은 `NET.replaying=true`). 규칙 상태는 원래 락스텝 설계대로 시점과 무관하게 일치하며, 매 입력 뒤 `lockstepDigest` 비교가 다르면 룸을 VOID(E_INTERNAL)로 닫는다(fail-closed).
  - 이유: v3의 단일 엔진 + `NET.me` 접근자 트릭은 로그 문구를 행동자 시점으로 만들어 공용 로그에 행동자 자기 말 정체(예: 회복 틱 이름·속성)가 실려 상대에게 나갔다. 좌석 엔진 쌍에서는 로그·전투 로그·모달 문구가 원본 온라인 클라이언트와 똑같이 그 좌석 시점이다.
- **서버 스케줄러.** 각 엔진 컨텍스트의 `setTimeout/clearTimeout/setInterval/clearInterval`을 서버 스케줄러로 교체한다: 고유 양의 정수 id, 실제 취소, 가상 시계 `(due, 등록순)` 순서 실행, drain당 콜백 20만·가상 30분 예산 초과 또는 콜백 예외 시 큐를 비우고 `EngineFault`(룸 VOID). `setInterval`은 id만 주고 발화하지 않는다(index.html의 interval은 락스텝 수신 펌프·클라이언트 재접속 tick뿐, 규칙 상태 없음). 프로세스 네이티브 타이머는 건드리지 않는다.

## 1. 전송·HTTP

- 인증 서버 `server/authoritative/server.js`, 포트 `DD_AUTH_PORT`(기본 **8081**), 바인드 기본 루프백·`--lan`/`DD_LAN=1`이면 사설 대역. 기존 코드 접속 릴레이(`server/server.js`, 8080)는 변경 없음.
- **정적 호스팅**: `GET/HEAD /`·`/index.html`·`/assets/**` 등 `demo/`를 릴레이와 같은 `security.js` 검사(피어·요청 예산·메서드·Host·URL 길이·Origin·경로 잠금·보안 헤더)로 서빙. `/healthz` 유지. 따라서 `http://127.0.0.1:8081`로 연 페이지의 `location.host`가 곧 이 서버다.
- 실행: `npm start`/`공개서버시작.bat`(로컬), `npm run start:lan`/`공개LAN서버시작.bat`(LAN). 릴레이: `npm run start:relay[:lan]`/`서버시작.bat`/`LAN서버시작.bat`(그대로).
- WebSocket 업그레이드: `Sec-WebSocket-Protocol: digit-duel.v1, <credential>`. 서버는 공개 마커만 반향.

| 접두사 | 뜻 |
|---|---|
| `c-<nonce>` / `cp-<nonce>` | 비공개(초대 코드) / 공개 룸 생성 |
| `j-<inviteCode>` / `p-<roomId>` | 초대 코드 참가 / 공개 룸 참가 |
| `l-<nonce>` | 로비 전용(`list_rooms`) |
| `r-<epoch>.<seatToken>` | 좌석 재개 |

## 2. 서버→클라이언트 프레임

- 첫 프레임: `room_opened`(seat 0, 비공개면 `inviteCode`) · `room_joined`(seat 1) · `room_resumed`(`data` 동봉) · `lobby_ready`. 공통 `{v,type,epoch,roomId,seat,seatToken,tokenGen,revision,seq}`.
- **참가 알림(v4)**: 게스트 참가가 성공하는 즉시 호스트(seat 0)에게 `{type:"room_state", seat:0, revision, data}`(data.state=`SETUP`)를 푸시한다. 실패한 참가는 알림 없음.
- 명령 응답: `{type:"room_state", requestId, revision, seat, data}` 또는 `{type:"error", requestId, code, revision[, data]}`(`E_STALE_REVISION`이면 최신 뷰 동봉).
- 상대 푸시: **상태가 바뀐** 성공 명령 뒤에만 상대 좌석에 `room_state`(requestId 없음). noop·오류는 푸시하지 않는다.
- 능동 푸시: 유예 만료(CANCELED/FORFEIT)·재시작 VOID·엔진 장애 VOID·로비 정리 CLOSED는 양 좌석에 `room_state`(requestId 없음).

## 3. 명령 봉투

```json
{ "v":1, "requestId":"…", "seatToken":"…", "tokenGen":3, "t":"setup", "roster":["…6종"], "pos":[[11,1],"…14개"] }
{ "v":1, "requestId":"…", "seatToken":"…", "tokenGen":3, "baseRevision":12, "t":"action", "action":{ "t":"cell","r":10,"c":1 } }
```
- `t`: `setup`·`ready`·`unready`·`action`·`resign`·`leave`·`resync`·`list_rooms`.
- **모든 좌석 명령(`leave` 포함)은 좌석 토큰(current)+tokenGen 인증 → requestId 중복 제거 → 처리** 순서다. v3는 `leave`가 인증보다 앞서 위조 토큰으로 OPEN 룸을 취소할 수 있었다. `list_rooms`만 읽기 전용이라 인증이 없다.
- `setup`: 좌석 0 기준 좌표(11~13행). 서버가 **상태 변경 전에** 검증한다 — 로스터 정확히 6종·중복 없음·카탈로그에 있음, `pos` 정확히 14개·전부 정수·행 11~13·열 1~7·중복 없음. 형식(타입) 오류는 `E_BAD_ENVELOPE`, 내용 오류는 `E_ILLEGAL_ACTION`. 거부 시 rawSetup·placed·ready·상대 ready·revision 모두 불변. 수락은 자기 ready만 해제. 배치 없는 좌석은 `ready` 불가.
- `leave`: OPEN/SETUP → CANCELED(응답 `room_state` + 상대 푸시, 토큰 폐기), IN_PROGRESS → `E_ILLEGAL_ACTION`, FINISHED → 결과 불변, 응답 후 소켓 종료.

## 4. `action` 합법성 (v4 명시 판정) [확정]

형태 검사 → `baseRevision` → 판정 → 두 엔진 적용. 판정 우선순위는 원본 입력 모델과 같다. **판정 전 단계 거부는 엔진에 닿지 않으며 상태·revision 불변.** 행위자가 아닌 좌석은 `E_NOT_ACTOR`, 행위자지만 그 단계의 입력이 아니거나 자원·조건 불충족이면 `E_ILLEGAL_ACTION`.

1. **대기 중인 동기화 모달**(버튼 있는 선택 화면: VIP 출전 선택·출전 공개 "전투 시작"·탐색 보상·포획·패키지 개봉 등): 행위자는 `NET.syncModal.owner`(방어자일 수 있다). 허용 입력은 `{t:"modal", seq, i}`뿐이며 seq 일치·`0≤i<count`·그 버튼이 disabled 아님. 처리된 seq 재전송은 거부. 모달이 떠 있는 동안 다른 모든 행동(skipMain·tele·act·cell…)은 거부.
2. **도망 후 교환(fleePick)**: 행위자는 도망친 말 소유자. `fleeSkip`, `fleeSwap{id:<뷰의 교환 후보 별칭>}`, `cell`(후보 말 칸)만.
3. **전투**: 행위자는 `actorOfPhase()` 쪽 소유자. `act`·`item`·`ball`·`flee`·`pass`·`pkgOpen`만.
   - `act.k`: 정수 슬롯(4슬롯 전투원, `slotUsable`) 또는 `'basic'`(4슬롯이면 슬롯0 사용 가능 시, 왕·동료 본체는 항상), `'skill'`(4슬롯=슬롯1 / 본체=skillAtk 있고 쿨 0), `'common'`(4슬롯=슬롯2). 그 밖의 문자열·실수는 `E_BAD_ENVELOPE`.
   - `item.i`: 자기 인벤토리에 있는 아이템·이번 라운드 미사용. `ball`: 상대 하수인·HP<30%·볼 보유·예비 슬롯 비었음·이번 라운드 미투척. `pass`: 4슬롯 전부 사용 불가일 때만. `pkgOpen.kind`: `itemGift|battleBuff`, 재고>0, battleBuff는 이 전투 버프 미적용.
4. **보드 플레이**: 행위자는 `S.current`.
   - `cell{r,c}`: 보드 안(1~13, 1~7). 선택·이동·전투 지정·강제 대상·텔레포트 선택은 원본 `onCellCore`.
   - `skipMain`: 주 행동 미사용·텔레포트 선택 아님·강제 전투 대기 없음. `tele`: 선택 중이면 취소, 아니면 주 행동 미사용·`teleportAvailable`·횟수 여유. `search`: 선택 말이 자기 말이고 흔적 이벤트 칸·주 행동 미사용·`canSearchPiece`. `heal{id}`: **자기 말 별칭**이고 `canHeal`. `endTurn{auto?}`: 주 행동 사용(생략 포함) 후·텔레포트 선택 아님·강제 전투 대기 없음.
   - 기권은 `t:"resign"` 명령 또는 `action{t:"resign"}` — 둘 다 `S.current` 좌석만(원본 규칙).
- 매치 중 `auto`·`clear`·`roster`·`setupDone`·`selTray`는 항상 `E_ILLEGAL_ACTION`.
- 판정은 통과했지만 두 엔진 상태가 전혀 안 바뀐 입력(예: 빈 칸 클릭): 성공 `room_state`, **revision 불변**, 상대 푸시 없음(noop).
- 별칭: 뷰의 모든 말 id는 `u-…` 불투명 별칭(룸 단위 안정). `heal`/`fleeSwap`은 자기 말 별칭만 받는다 — 원시 엔진 id(숫자)는 `E_BAD_ENVELOPE`, 숫자 문자열·상대 별칭·모르는 별칭은 `E_ILLEGAL_ACTION`. `you.selected`는 같은 별칭.

## 5. 오류 코드

`E_BAD_ENVELOPE`·`E_SEAT_TOKEN_INVALID`·`E_TOKEN_GEN_STALE`·`E_ROOM_NOT_FOUND`·`E_ROOM_CLOSED`·`E_EPOCH`·`E_STALE_REVISION`·`E_NOT_ACTOR`·`E_ILLEGAL_ACTION`·`E_MATCH_STARTED`·`E_SUPERSEDED`·`E_CAPACITY`·`E_RATE_LIMITED`·`E_INTERNAL`·`E_DRAINING`. `E_INTERNAL`은 엔진 장애로 룸이 VOID가 됐다는 뜻이며 원인 문자열은 어떤 프레임에도 싣지 않는다(서버 `room.lastFault`에만).

## 6. revision·생명주기

- revision은 상태 전이 하나당 정확히 +1: 참가(OPEN→SETUP), setup 수락, ready/unready 변화(양측 ready로 시작하는 경우도 그 명령의 +1 하나), 상태를 바꾼 action, 기권(+1, 종료 전이 포함), 명령 경로 leave 취소, 유예 만료·VOID·CLOSED 종료 전이. 이미 종료된 룸의 재종료·중복 만료 콜백은 전이·revision·푸시 없음. 확정된 FINISHED는 VOID로 덮어쓰지 않는다.
- VOID 결과: `{type:"NO_CONTEST", winner:null, reason:"E_INTERNAL"|"RESTART"}`.

## 7. 좌석 뷰 `data`

- 공통: `seat`, **`state`**(OPEN|SETUP|IN_PROGRESS|FINISHED|CANCELED|VOID|CLOSED), `phase`, `revision`, `seats.ready`, `result`, `fx`(전투 표시 이벤트 — 모든 phase·모든 state에 존재, 아래 7.2).
- `phase`: OPEN/SETUP=`setup` · CANCELED/VOID/CLOSED=**`canceled`|`void`|`closed`**(보드 없음: `units:[]`, `you:{placed}`) · IN_PROGRESS=`play`|`battle`|`flee` · FINISHED=`over`(보드 유지). **클라이언트는 `setup` 외의 시작 전 종료 phase를 게임 화면으로 해석하면 안 된다.**
- IN_PROGRESS/FINISHED 추가 필드: `turnCount`·`current`·`mainUsed`·`battlesUsed`·`units`·`you`·`turn`·`battle`·`fleePick`·`modal`·`log`·`events`.
  - `units`(상대): 비가시(A)는 제외, 미공개(B) `{id,r,c,owner,alive,immobile}`, 공개(C-2) `+type,name,element,hp,maxHp,healing,rosterId`(`rosterId`는 하수인일 때만 값·왕/동료는 항상 `null` — v4.2, 아래 7.1). **FINISHED에서는 이 마스킹 자체가 해제된다**(원본 `viewer===2` "#11 종료 리빌" — 아래 7.3).
  - `you`: 자기 말 전체(`+rosterId` — v4.1, 아래 7.1)·`inv`·`balls`·`reserve`·`pkgs`·`selected`(별칭)·`placed`·`teleUsed`(자기 텔레포트 사용 횟수 — v4.3, 아래 7.3).
  - `turn`: **S.current 좌석에만**(비행동자는 `null`) `{teleport,forcedTargets,forcedQueue,movedPiece,firstBattleWonByMover,contactSet}` — v4.3, 아래 7.3.
  - `battle`: `round,phase,actor("A"|"D"),actSeq,maxRounds,battleId`(fx `battleStart`/이후 이벤트와 같은 값 — v4.3, 아래 7.3)`,log`(이 좌석 시점 전투 로그 최근 40), `a`/`d` 각
    `{owner,hp,maxHp,shield,burn,weaken,shock,shockFresh,dmgCut,focusCharge,vulnMark,skills,rec,items,itemRound,lastItem,ballThrow,buff,type,element,bodyFight,rosterId,artRosterId}`(뒤 5개 — v4.1, 아래 7.1) — 상대 전투원 미공개 기술은 `{i,revealed:false,kind}`만. `cd`/`atk`/`skillAtk`는 제안됐으나 불필요한 공개 확장으로 판단해 철회했다(아래 7.3).
  - `fleePick`: `{owner}` + 소유자에게만 `pieceId`(도망친 말 별칭)·`cands`(교환 후보 별칭) — v4.3, 아래 7.3.
  - `modal`: 대기 중인 동기화 모달이 있을 때만 `{seq,owner,count}`, 소유 좌석에만 `html`·`buttons:[{text,disabled}]`(그 좌석 엔진이 실제로 그린 내용).
  - `log`: 이 좌석 시점 엔진의 보드 로그 최근 40 `{msg,cls}` — "나/상대" 인칭과 공개 범위가 원본 온라인 클라이언트와 같다. v3의 "인칭 신뢰 불가" 한계는 해소.
  - `events`: 자기 흔적(`traces`)에 있는 미소비 이벤트 칸.
- 시드·RNG·엔진 원시 id는 어떤 프레임에도 없다.

### 7.3 공개 뷰 델타 (v4.3, 2026-09-13 — Jupiter delta, Mars ctx_75a85d4c58fb 요청 · PD 정정 msg_db7a8fa06aee 반영)

강제 전투/텔레포트 단계의 `autoEndReady` 오판·원본 하이라이트(강제 대상·텔레포트 스왑·도망친 말) 복원·자기
텔레포트 사용 횟수 표시, 그리고 Mars가 정정 메시지에서 함께 지적한 FINISHED 종료 리빌(#11) 누락 대응이다.
스키마·근거·철회 경위·검증은 [public-view-delta.md](public-view-delta.md)가 원본이다 — 여기서는 계약만
고정한다: `turn`은 S.current 좌석 전용, `you.teleUsed`는 자기 값만, `battle.battleId`는 fx와 대응하는 정수,
`fleePick.pieceId`는 소유자 전용, FINISHED는 `units` 마스킹을 해제한다(다른 종료 상태는 board 자체가 없어
해당 없음). 검사: `server/authoritative/test/test-public-authority-delta.js`(37개 단언).

### 7.1 아트 표시 필드 (v4.2, 2026-09-13 — Jupiter delta, ctx_7293bb90151c → v4.1 재검수 → Saturn ctx_e6437fa06ae4 REVISE 수정)

CJ의 "기존 아트 연결 누락" 지시·[Earth/art-omission-audit.md](../Earth/art-omission-audit.md) P0에 따라 Mars가 기존 승인 렌더(`artDirOf`/`artDirOfFighter`/`leaderBattleDir`, 원본 `battleModal()`)를 재사용할 수 있도록 필드를 추가했다. 근거·검사·미해결은 [art-restore-fields.md](art-restore-fields.md)가 원본이다 — 여기서는 계약 요약과 가시성 등급 구분만 고정한다.

**v4.2 수정**: Saturn(ctx_e6437fa06ae4)이 `_serializeKnownOpponent`(등급 C-2)에 `rosterId`가 없어 **전투 밖 board** 표시에서 공개된 상대 하수인 아이콘이 계속 폴백하는 REVISE를 재현했다. `you.pieces[]`(자기 말)에는 이미 v4.1에서 `rosterId`를 추가했지만, 상대가 공개(C-2)된 뒤 board `units`로 볼 때는 whitelist에서 빠져 있었다 — 새 기획 공개 범위 확장이 아니라 §2.6.1 whitelist 누락 복구다(name이 로스터 20종을 1:1로 특정하므로 정보량 동치, 아래 표). `_serializeUnknownOpponent`(등급 B)·비가시(A)에는 이 필드 자체가 여전히 없다.

| 필드 | 위치 | 등급 | 의미 |
|---|---|---|---|
| `rosterId` | `you.pieces[]`(자기 말 전체) | **자기 좌석** — B에는 필드 자체가 없음 | 자기 하수인의 종(예 `"M-F1"`). 자기 말은 이미 `type`·`element`·`skills`·`name`이 전부 나가므로(§2.6.1 "자기 좌석") 새 노출이 아니라 종전 whitelist 누락 |
| `units[].rosterId`(C-2) | board `units`(공개된 상대) | **상대 — v4.2 신규**, `type==="minion"`일 때만 값·왕/동료는 `null`. B·A에는 필드 자체가 없음 | Saturn REVISE(ctx_e6437fa06ae4) 수정. C-2는 이미 `name`을 보내 로스터 20종을 1:1로 특정하므로(동명 없음) 형태만 추가된 것이고 정보량 증가는 없다 — 상대 board 하수인 아이콘(`artDirOf`)이 이 필드를 직접 소비한다(`demo/index.html` `netStubPiece`가 이미 `u.rosterId`를 일반적으로 매핑) |
| `battle.a/d.type`·`.element` | `battle`(전투 문맥 한정) | 자기 = 자기 좌석 정보 그대로 / 상대 = **C-2와 동치** | 전투는 상호 인접이라야 열리므로(§4.4) 두 전투원은 전투 시작 즉시 서로 `visibleTo`+`revealed=true`가 된다 — 그래서 상대 쪽 `type`/`element`는 board `units`의 C-2 `type/element`와 같은 시점에 같은 값이 이미 나가는 정보다 |
| `battle.a/d.bodyFight` | 〃 | 자기·상대 동일 | 지금 실제로 싸우는 개체가 그 말 본체(`true`)인지 포획·예비 하수인 대리(`false`)인지. 원본 `artDirOfFighter(pf,piece)`의 `pf===piece` 판정을 서버가 대신 계산해 내려보낸다(클라이언트가 규칙을 재계산하지 않게) |
| `battle.a/d.rosterId` | 〃 | `bodyFight&&type==="minion"`일 때만, 자기·상대 동일 | 하수인 본체 전투일 때 그 하수인의 rosterId. v4.1 당시엔 "형태는 C-2에 없지만 정보량은 새 노출이 아니다"였으나, v4.2부터는 **형태로도 C-2와 동치**다 — `units[].rosterId`가 같은 값을 이미 board에서 보낸다 |
| `battle.a/d.artRosterId` | 〃 | `bodyFight===false`(대리 출전)일 때만, **자기·상대 동일하게 노출** | 대리로 싸우는 포획/예비 하수인의 종. board 뷰의 `cap`은 상대에게 절대 안 보내므로(§2.6.1 "포획 cap") 이 필드는 형태·정보량 모두 진짜 새 노출이다. 다만 정책 신설이 아니라 **#91 승인 동작의 복원**이다 — 원본 `token()`/`artDirOfFighter()`는 `viewer`로 분기하지 않고 `battle.fa/fd` 기준 스프라이트를 그렸고, `demo/test/regression/smoke_minion_art.js` K9e가 "전투 스테이지(출전 공개 후)에서만 대리 전투원의 종이 나타난다"를 승인 계약으로 고정했다(K9f: 그 밖의 비공개 cap/예비는 전투 중에도 안 나옴). 권위화 이전 온라인 모델(§0의 `hello`/`hello2`, 두 클라이언트가 각자 전체 로컬 상태로 같은 락스텝)에서는 이 마스킹 없는 렌더가 곧 "양쪽 다 봄"이었다. 다만 실제 2브라우저 온라인 접속으로 이 순간을 본 기록은 #91 당시에도 없었다(`issue91-saturn.md`: "실제 온라인 2연결의 end-to-end 포획/대리 출전 … 은 미검증") — 그래서 이 한 항목만 "코드·승인 계약상 기존 동작"이되 "실제 교차 브라우저 확인 이력은 없다"는 caveat을 남긴다. `battle` 객체가 사라지면(전투 종료) 이 필드도 함께 사라져 board 뷰로 새지 않는다 |

기술 공개(§2.6.2, `revealed:false`→`{i,kind}`만)·쿨/버프/아이템 등 기존 전투-공개 필드의 은닉 범위는 이번 변경으로 넓어지지 않았다 — 대리 출전이어도 상대에게는 여전히 기술 id·이름이 안 나간다(검사: `server/authoritative/test/test-security-gaps.js` "대리 출전이어도 상대에게 미공개 기술 id/name은 여전히 안 나감"). `units[].rosterId`(C-2) 추가의 board 표시·은닉 경계 회귀는 같은 파일의 "#217 C-2 board 표시 회귀" 블록(공개 전→전투 공개→전투 후 3단계 + 왕 rosterId=null)에 편입했다.

### 7.2 전투 표시 이벤트 `fx` (v2, 2026-09-13 — Jupiter delta, Mars/report.md §6 요청 · PD REVISE msg_c0657afb7242/
msg_336c58a0114a/msg_467892193706/msg_16e693d42efe 반영)

Mars가 지목한 공백(서버 snapshot·battle.log만으로는 라운드 배너·타격 플래시·승패 배너를 복원할 수 없음) 대응.
근거·캡처 방식·설계 사유·PD REVISE 다섯 가지 대응 내역은 [battle-fx-protocol.md](battle-fx-protocol.md)가
원본이다(치환본 v2, v1의 스테일 문구 없음) — 여기서는 계약만 고정한다. **이 절은 v1을 치환한다**(v1에 있던
"explosion/trap은 board diff로 특정" 문구는 명시적으로 금지 사항으로 뒤집혔다 — 아래 참조).

`fx: {firstSeq, lastSeq, events:[...]}` — **모든** 좌석 뷰 응답(OPEN/SETUP·IN_PROGRESS/FINISHED·CANCELED/VOID/CLOSED
전부)에 존재한다. `firstSeq`/`lastSeq`는 이 엔진(좌석)이 게임 시작부터 생성한 이벤트의 **단조 증가·룸 수명 동안
유일**한 정수 커서(재사용 없음) — 아직 이벤트가 없으면 `firstSeq:null, lastSeq:0`. `events`는 최근 40개까지만
유한 보관(기존 `log`/`battle.log`의 `.slice(-40)` 관례와 동일 크기)한 창이다.

두 이벤트 모양(공통: `seq`, `src`, `battleId`):
- `{seq,src:"msg",battleId,round,actSeq,key,big,txt,fx}` — `bmsg()`가 실제로 만든 개별 타격/상태/아이템 신호.
  `fx`는 `{shake,sig,flash,ko,float:{side,sign,amount},hp:{side,val,max},st:{side,text,shield,max}}` 중 그
  이벤트에 실제로 있던 것만(원시 타입만, HTML·piece·콜백 없음 — `float`는 원본 `<span class="pos|neg">±숫자</span>`
  고정 템플릿을 디코드한 값).
- `{seq,src:"stage",battleId,turn,key,kind,title,sub,cls?,cells?,scene?}` — `fxPlay()`가 무조건 호출되는
  배너(턴/접촉/밀기/도망/폭발/함정)는 `FX.log` 훅으로, **호출 자체가 `if(fxLive())` 안이라 헤드리스에서 안
  불리는 `countStep`/`roundBanner`는 서버가 확정 상태(`battle.intro`/`battle.bannerKey`)를 읽어 선언적으로
  합성한다**(`battleStart`/`roundBanner` — v1은 이 구분을 놓쳐 두 배너가 통째로 빠졌었다, battle-fx-protocol.md §3).
  `cls`는 `roundBanner`에만("mine" 또는 생략). `cells`는 §Mars 훅(아래)이 실제로 채운 `explosion`/`trapFx`에만.
  `scene`은 `battleStart`/`resultBanner`에만.
- `battleId`: 전투마다 새로 발급되는 엔진별 단조 정수(재사용 없음), 전투와 무관한 이벤트는 `null`,
  `battle=null` 이후 트레일링 배너(`resultBanner`)는 직전 전투의 battleId를 유지한다 — 연속 전투에서 옛
  이벤트가 새 전투 무대에 섞이지 않는다(v1의 공백, battle-fx-protocol.md §4).
- `scene`: `{a,d}` 각 `{owner,type,element,bodyFight,rosterId,artRosterId}` — `battle.a/d`와 같은 화이트리스트
  (hp·shield·skills·cap 없음). `battle=null` 이후에도 마지막 무대를 그릴 수 있게 `resultBanner`에도 동봉한다.

**explosion/trap 좌표(`cells`)**: v1은 "Mars가 board diff로 셀을 특정하라"였으나 이는 명시적으로 금지됐다
(추측 금지). 대신 Mars(demo/index.html 소유)가 `explosionFx`/`trapFxPlay`의 기존 `fxPlay(...)` 호출 바로
앞에 `if(Array.isArray(S.__ddFxCells)) S.__ddFxCells.push({key,cells})`(이미 넘기는 `cells` 값 그대로,
`hold`는 절대 포함 안 함) 한 줄씩만 추가하면 된다 — 큐 자체는 서버(`engine.js` `ensureFxCellsQueue`)가 새
`S`마다 non-enumerable로 미리 설치하므로, 서버 없는 PVE/hotseat에서는 이 필드가 없어 데모 쪽 push가 그냥
아무 일도 안 한다(무한 보관 걱정 없음 — battle-fx-protocol.md §5, msg_fb108078aa15 → msg_16e693d42efe REVISE).

**재접속·재전송·resync 소비 계약**(battle-fx-protocol.md §7): 클라이언트는 `(epoch,roomId,seat)`별로
`enqueuedSeq`(로컬 큐에 이미 넣은 최대 seq)와 `playedSeq`(실제 재생 완료된 최대 seq)를 분리 보관한다. 일반
`room_state`/`resync`는 `seq>enqueuedSeq`인 것만 추가(재전송·중복 resync는 항상 같은 seq=같은 내용이라
자동으로 안전). 창 밖으로 밀려난 갭은 합성하지 않고 그냥 스킵한다. `room_resumed`(진짜 재접속, 프레임
타입으로 이미 구분됨 — §2)는 더 보수적으로 `enqueuedSeq=playedSeq=lastSeq`로 맞추고, 창의 마지막이
`resultBanner`/KO면 그 한 이벤트만 예외 재생하는 것을 권장 baseline으로 둔다(서버 강제 아님 — Mars 확정).

캡처는 `server/authoritative/engine.js`가 이미 존재하는 두 공유 가변 배열(`FX.log`, 전투마다 새로 생기는
`S.battle.msgQ`)의 push를 **해당 배열 인스턴스에만** 가로채 원본으로 그대로 위임하는 방식이다 — `demo/index.html`·
`demo/test/shared/harness.js`는 한 글자도 수정하지 않았고, `bmsg`/`fxPlay` 함수 자체를 재바인딩하지도, 규칙
함수를 호출하지도, 새 값을 계산하지도 않는다(순수 관측). 종료 직후(`battle:null`)에도 결과·마지막 타격을
보여줄 수 있도록, `_finalize()`가 `TERMINAL_NO_BOARD`(CANCELED/VOID/CLOSED)로 전이하며 `this.engines`를
비우기 直前에 `Room._fxCache`로 마지막 창을 떠 둔다(FINISHED는 engines가 계속 살아있어 해당 없음, toSeatView가
매번 라이브로 읽는다). 검사: `server/authoritative/test/test-battle-fx.js`(420개 단언 — Saturn ctx_f43421692c79 독립 실행·fx-qa-v3.md 확인 기준, T12는 전투에 관여하지
않는 실제 미공개 상대 하수인의 raw id·이름·기술 id·rosterId가 fx 문자열 전체에 없음을 실측) — §9에 편입.

## 8. `list_rooms`

`{v:1,type:"lobby_rooms",rooms:[{roomId,label,ageSec,seats:"1/2"}]}` — OPEN이고 좌석 하나가 빈 공개 룸만.

## 9. 검증 [확정]

`cd server && npm test` — 기존 5종 + `test:authoritative` **10종**: scheduler 32 · engine-isolation 18 · room 57 · security-gaps **61**(v4.2 C-2 rosterId board 표시 회귀 +6 편입) · authority-rules 176 · **battle-fx 420**(Saturn ctx_f43421692c79 독립 실행 확인 기준 — §7.2 fx 이벤트 순서·정규화·battleId/scene·선언적 countStep/roundBanner·종료 후 보존·재전송/resync 안전·유한 보관·explosion/trap cells 훅 계약·미공개 상대 정보 실측 부재) · match-fuzz 16(6시드 전 경로 퍼즈) · authoritative 50(실제 WebSocket) · http-static 24 · launcher-authoritative 47. 상세·뮤테이션 결과는 [report.md](report.md).

## 10. 남은 한계 [확정]

- 실배포(WAN 도메인·TLS)는 하지 않았다(`DD_AUTH_PUBLIC_HOST` 준비 경로만).
- 두 실제 브라우저 간 E2E 시연은 Mars 클라이언트 어댑터 반영 후 가능 — 서버 쪽은 실제 WebSocket·헤드리스로 검증.
- 메모리: 진행 중 룸당 엔진 2개(측정 약 3MB heap/엔진, RSS 기준 약 5MB). 기본 룸 상한 200 기준 최악 약 2GB [추론] — 상한 조정은 운영 결정 [기획 필요].
- 한 입력당 두 엔진 적용 + 상태 지문 비교로 약 1.2ms/입력(퍼즈 실측) [확정].
