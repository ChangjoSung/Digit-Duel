# #217/#218 — 공개 방 클라이언트 구현 보고: Mars (Sonnet 5 HIGH, 후속 패스 3차 — 실브라우저 증빙)

- 작성: Mars(Claude Sonnet 5, HIGH), 2026-09-13. 범위: `mutation=code`, 소유: `demo/**`·client tests·client
  tooling·`.github/workflows/ci.yml`·이 폴더뿐. `server/**`은 한 글자도 건드리지 않았다(모든 서버 수정은
  Jupiter 소관이며, 이 보고는 그 결과를 **소비**한 client 배선만 다룬다).
- 이 문서는 치환본이다. 이전 패스(프로토콜 v1→v2→v3 적응, Node WebSocket 실서버 통합 검증)의 결론은 §1에
  요약만 남기고, 이번 패스의 핵심인 **실제 Edge 브라우저 두 창(호스트·게스트) E2E 증빙**을 §2 이후에 담는다.
- **2026-09-13 안전 체크포인트 인계 — 아래 §0~§10은 이 인계 시점 이전 패스 기록이며 그대로 보존한다.
  현재 진행 상황·미해결 항목·작업 중단 사유는 §11(맨 아래)이 최신이다. PD 지시(msg_008c51632774, 동일
  원인 2회 REVISE → Opus5 high 인계)에 따라 이 세션은 §11 작성 후 `worker_done(outcome=failed)`를 보내고
  idle한다 — 코드는 삭제·되돌리지 않고 그대로 보존한다.**

## 0. 결론

1. **실브라우저 증빙(이번 패스, 신규)**: 실제 Windows Edge 프로세스 두 개(별도 프로필, 실 OS 창)로 접속→로비→
   방 생성/참가→로스터→배치→준비→`phase:"play"` 전환→실제 이동 액션 송수신까지 확인했다(§2). Node WebSocket
   증빙(§1)과는 별개의, 실제 DOM/CSS 렌더링·클릭 이벤트 기반 증빙이다.
2. **실브라우저 검증 중 두 가지 실제 버그를 발견해 고쳤다**(§3): (a) `netRoomsHtml()`의 참가 버튼이 실제
   브라우저에서만 깨지는 HTML 이스케이프 버그, (b) 서버가 준 `rosterId`/전투 아트 필드를 클라이언트가
   버리고 있던 **보드·전투 아트 소실**(CJ 재확인 지시 + Earth 독립 감사로 발견, PD 경유 확인).
3. **서버 측 변형-소스 사건(02:23~02:27Z) 이후 제 검증 서버를 재시작**하고 모든 실브라우저 캡처를 재시작
   이후로 다시 찍었다(§4) — 재시작 전 캡처는 폐기했다.
4. **DOM 정보 은닉 실증(신규, §8)**: 실제 브라우저 콘솔로 확인 — 미공개 상대 칸("?") 14개 전부 `<img>` 0개,
   `assets/minions` 문자열 0개(자산 경로 전혀 없음). 같은 페이지의 내 말 9개는 실제 `<img>` 9개로 렌더링 확인 —
   Earth 감사 문서가 요구한 "정체 미공개 칸에 자산 경로가 전혀 없어야 한다"는 조건을 DOM 레벨로 실증했다.
5. **재접속 1차 시도는 PD가 무효로 판정**했다 — 서버 프로세스를 죽이는 방식은 방(룸) 자체를 지워
   "같은 방으로 성공 복귀"를 증명하지 못한다(PD msg_6ee02021f9a8). **CDP `Network.emulateNetworkConditions`
   (offline)**로 서버·방·상대는 그대로 둔 채 한쪽 소켓만 끊는 방식으로 교체했고, roomId·seat·revision
   수렴까지 실제로 비교하도록 `run_full_e2e.js`를 다시 짰다(§9) — 이번 패스 실행이 §6에 진행 상태로 남는다.
6. **CDP(Chrome DevTools Protocol) 자동화로 전환**(PD 지시 msg_301e8639835e) — OS 접근성 수동 클릭 대신
   `demo/test/browser/`에 재사용 가능한 CDP 스크립트를 만들어 로비→배치→접촉/전투→재접속을 실제 마우스
   입력 이벤트로 재현한다(§9). DOM 정보 은닉 검사도 이 스크립트가 자동 재현한다.
7. **전투 무대 FX용 서버 이벤트 계약**(`Jupiter/battle-fx-protocol.md` v2)이 도착했고, Mars 소유 2줄 훅
   (`explosionFx`/`trapFxPlay`의 좌표 push)을 반영했다(§10) — 소비 측(클라이언트 재생) 설계는 진행 중이다.
8. **잔여 항목**(§6): 실브라우저에서의 완결된 전투 1회·결과 화면 캡처, `fx` 이벤트 소비(무대 애니메이션)
   클라이언트 구현, roomId/seat/revision 수렴까지 확인한 재접속 캡처 — 이번 패스 실행이 진행 중이며 완료
   여부는 §9·artifacts/MANIFEST.md에 최종 기록한다. "성공"으로 마감하지 않는다.

## 1. 이전 패스 요약 (Node WebSocket 실서버 통합 검증)

`node server/authoritative/server.js`를 실제로 띄우고 `demo/test/shared/harness.js`의 선택 옵션
(`opts.WebSocketCtor`·`opts.realTimers`)으로 Node 네이티브 `WebSocket`을 주입해 호스트·게스트 두 클라이언트를
한 프로세스에서 구동, credential 접속→로비→생성/참가→setup/ready→`phase:"play"`→실제 이동→**실제 전투
(기술 사용·서버 RNG 판정·정보 은닉)**→소켓 강제 종료 후 60초 유예 자동 재접속→기권까지 전부 확인했다. 이
증빙은 실제 소켓·실제 서버 판정이지만 **DOM/CSS 렌더링은 거치지 않는다** — PD가 이번 패스에서 요구한 것은
그 DOM 증빙이다.

## 2. 실브라우저 E2E (이번 패스)

### 2.1 환경
- 두 개의 격리된 msedge 프로세스(`--user-data-dir` 분리, host/guest)를 `orca computer`(OS 접근성 API)로
  독립 구동. 별도로 모바일 폭(400px) 확인용 3번째 프로필도 구동 후 정리했다.
- 서버는 `server/authoritative/server.js`를 `npm start`로 직접 띄웠다 — v4에서 `demo/`를 **같은 포트(8081)
  에서 직접 정적 서빙**하므로, 이전 패스에서 필요했던 동일-출처 우회 프록시(`combo_server.js`, 8082)는
  이번 패스부터 불필요해 폐기했다. 브라우저는 `http://127.0.0.1:8081/index.html`에 직접 접속한다.

### 2.2 확인된 흐름 (§4 서버 재시작 이후 최종본 기준)
- 타이틀→튜토리얼 건너뛰기→모드 메뉴: **공개 대전 카드가 PVE/PVP보다 먼저 보인다**(§3-2 수정 반영),
  공개 방 탭이 기본, 서버 주소가 `location.host`에서 `127.0.0.1:8081`로 자동 채워짐.
- 호스트 "새 방 만들기" → 로스터 6/6 선택(카드 클릭→정보 팝업→선택하기, 6회) → 무작위 배치 14/14 →
  준비 완료 → "🌐 방 #1 — 준비 완료 / 상대: 입장 대기".
- 게스트 "🔄 새로고침" → 방 #1 목록에 뜸(1/2) → **"참가" 버튼 클릭**(§3-1에서 고친 바로 그 버튼, 실브라우저에서
  최초로 실사용) → 로스터 화면 진입 확인.
- 게스트 로스터 6/6→배치 14/14→준비 완료 클릭 → **host가 지연 없이 즉시 `phase:"play"`로 전환**(host-join
  notify가 실제로 동작함, §5). 양쪽 모두 실제 보드(28기물, 등급별 마스킹: 상대는 `?`, 내 쪽은 실명)가 뜬다.
- 호스트 쪽에서 실제 말 클릭(선택)→하이라이트된 칸 클릭(이동) 실행 → 서버가 액션을 받아들여 주 행동을
  소비하고 자동으로 턴을 넘김(2턴, 상대 차례로 전환) — **실제 클릭 기반 액션 송수신**을 브라우저에서 확인.
  게스트 쪽에서도 동일하게 말 선택→이동 실행 확인.
- 모바일 폭(400px): 모드 메뉴·로스터 선택·실제 대국 보드(2턴 진행 중) 세 화면 모두 가로 스크롤 없이
  올바르게 세로 스택으로 렌더링되는 것을 확인(온라인 대전 카드·로스터 2열 그리드·보드+행동 버튼 전부 폭
  안에 들어옴).

### 2.3 확인하지 못한 것 (§6에 상세)
- 완결된 전투 1회(공격→기술 교환→라운드 종료)의 브라우저 스크린샷 — 두 창을 번갈아 여러 턴 진행시켜야
  접촉하는데, 이번 패스는 인접 확인 전 리소스를 §3의 버그 수정·서버 재기동 검증에 우선 투입했다.
- 결과(승패) 화면, 재접속(강제 단절 후 자동 복귀) 화면의 브라우저 스크린샷.
- 전투 스테이지의 슬라이드 연출·카운트다운 FX(§3-2에서 스프라이트 자체는 복원했으나 무대 애니메이션은
  범위 밖으로 남겨둠).

## 3. 실브라우저 검증 중 발견한 버그 (둘 다 이번 패스에서 수정, client 소유 범위)

### 3-1. 참가 버튼 HTML 이스케이프 버그 (수정 완료)
`netRoomsHtml()`의 참가 버튼이
```html
onclick="netJoinPublicRoom(${JSON.stringify(String(rm.roomId))})"
```
형태였다. `JSON.stringify("14")`는 실제 큰따옴표 문자를 포함한 `"14"`를 만들고, 이것이 이미 큰따옴표로 감싼
`onclick="..."` 속성 안에 그대로 삽입되면 속성이 첫 번째 내부 큰따옴표에서 조기 종료된다 — **깨진 마크업**이다.
`T.netJoinPublicRoom(9)`처럼 함수를 직접 호출하는 헤드리스 테스트는 실제 브라우저의 HTML 파서를 거치지 않으므로
이 버그를 전혀 잡지 못했다. `escAttr()`로 감싸 수정(`onclick="netJoinPublicRoom(${escAttr(JSON.stringify(...))})"`)
했고, 이번 패스에서 실제로 그 참가 버튼을 클릭해 게스트가 방 #1에 들어가는 것으로 수정을 확인했다(§2.2).
파일 전체에서 `onclick="...(${JSON.stringify`와 같은 동일 패턴이 이 한 곳뿐임을 확인했다(다른 위험 패턴 없음).

### 3-2. 보드/전투 아트 소실 — CJ 재확인 지시 + Earth 독립 감사로 발견 (client 측 수정 완료, 서버 측은 이미 반영됨)
CJ가 "아트 디자인 누락이 다시 보인다"고 재확인을 요청했고, Earth(Codex)가 독립 감사
(`docs/milestone/v0.4.10/issues/217/Earth/art-omission-audit.md`)로 원인을 특정했다:
- **P0**: 자기 보드 하수인이 텍스트 폴백으로 보인다 — `netStubPiece()`가 `rosterId`를 **항상 `null`로
  강제**해 기존 `artDirOf()` 아이콘 조회 경로가 죽어 있었다.
- **P0**: 공개 방 전투가 기존 전투 무대·도트·HP바를 버리고 텍스트/버튼만 있는 화면으로 대체됐다 — 제
  전용 오버레이(`netRenderBattleOverlay`)가 애초에 전투원 종/외형 식별 필드 없이 만들어졌기 때문.
- **P1**: 공개 로비 카드가 PVE/핫시트 뒤로 밀려 있었다(§2.2에서 수정 확인).

조사 결과 **서버(Jupiter, `server/authoritative/room.js`) 쪽은 이미 이 감사에 대응해 필요한 필드를 추가한
상태**였다(제 mutation-test 복구본 MD5와 다른, 2026-09-13 11:58 수정본 확인): `_serializeOwn()`에 `rosterId`,
`_serializeBattle()`의 전투원 쪽에 `type`/`element`/`rosterId`(본체 출전)/`artRosterId`(포획·예비 대리 출전)를
추가했다 — 둘 다 이미 그 좌석/그 전투 문맥에 공개된 값의 whitelist 누락이었을 뿐 새 정보 노출이 아니다(원본
주석에 상세 근거 있음). 저는 이 서버 반영을 확인한 뒤 **소비 측만** 연결했다:
1. `netStubPiece().rosterId`가 서버 값을 그대로 보존하도록 수정(기존 `null` 강제 제거) — 이것만으로 기존
   `artDirOf()`/`pcBodyHtml()` 경로가 그대로 살아나 보드의 내 하수인이 실제 아이콘으로 다시 그려진다.
   §2.2에서 실브라우저로 확인(용암 거북·불티 정령·화염 투사 등 실제 스프라이트).
2. `netArtDirForFighter(f)`를 추가해 기존 `artDirOfFighter(pf,piece)`/`leaderBattleDir(pf,piece)`와 **동일한
   판정 로직**(본체 출전 vs 포획 대리 출전 구분, ROSTER 20종 허용 목록·`ART_DIR_SET` 재사용, 새 허용 목록
   없음)을 서버가 이미 납작하게 편 `bodyFight` 플래그 기준으로 재현했다.
   **PD 재확인(2026-09-13 03:13Z, high)** — 정적 스프라이트만으로는 Earth P0-1·CJ 지시의 수용 기준(기존
   전투 무대·HP바·상태·연출 보존)에 못 미친다는 반려를 받고, `netPanel(sid,f)`/`netFighterToken(sid,f,pos)`로
   다시 만들어 기존 `panel()`/`token()`과 **동일한 마크업·class·id**(`#bstage`·`.scene`·`.bslot`·
   `.slot-op`/`.slot-me`·`.btok`·`.fighter`·`.fhead`·`.hpbar`·`.hpfill-`·`.shbar`·`.shfill-`·`.hptxt-`·
   `.fscroll`·`.status`·`#bst-`)를 그대로 재사용했다 — 원본 `stIcons()`도 그대로 호출한다. 기존 CSS(레이아웃·
   바 색상·크기)가 그대로 적용되므로 HP바·방어막바·상태 아이콘·이름/속성 배지·스프라이트는 시각적으로
   원본과 동등하다. **다만 라운드 전환 슬라이드·타격 플래시·승패 배너 같은 이산 이벤트 기반 FX는 만들지
   않았다** — 서버는 매 폴링 시점의 스냅샷만 줄 뿐 그 사이 벌어진 이벤트 스트림을 안 주므로, 여기서
   재현하면 추측 연출이 된다(금지 사항). 이 무대 연출/FX에 필요한 정확한 서버 필드(예: 이번 행동에서
   발생한 개별 효과 목록·타이밍)를 PD 경유로 Jupiter에 다시 요청해야 한다 — 아직 보내지 않았다(§6/§7).
   이 변경은 클라이언트 회귀로는 검증했으나 **실제 전투를 브라우저에서 열어 시각적으로 캡처하는 것은
   이번 패스에서 완료하지 못했다**(§6) — 두 창을 여러 턴 교대로 진행시켜 접촉시키는 데 필요한 조사
   자원(각 이동마다 select+move 왕복 4회 이상의 OS 자동화 호출)을 다 쓰지 못했다.
3. 정보 경계: 미공개 상대(B등급)에는 이 필드들이 여전히 전혀 오지 않는다(서버 whitelist가 애초에 안 보냄).
   공개된 상대(C-2)도 서버가 이미 공개한 type/name/element/HP 범위를 넘는 별도 자산 키를 클라이언트가
   추론하지 않는다 — Earth 감사 문서의 "정보 등급 경계" 절을 그대로 따른다.
4. PD 후속(msg_52d90b218b1e): `_serializeKnownOpponent()`에도 `rosterId`(하수인일 때만, 왕/동료는 항상
   `null`)를 추가했다 — `name`이 이미 ROSTER 20종을 1:1로 특정하므로 새 정보 노출이 아니라 표시 키 형태
   추가라는 서버 쪽 근거를 확인했다. `netStubPiece()`는 이미 임의의 `u.rosterId`를 보존하도록 고쳐 뒀으므로
   (§3-2 1단계) **이 델타는 추가 client 코드 변경 없이 그대로 적용된다** — 공개 전 `?`/자산 없음 → 공개 후
   같은 종 아이콘으로 바뀌는 회귀는 아직 실브라우저로 재확인하지 못했다(§6에 추가).

수정 후 클라이언트 회귀 전부 재확인: `smoke_public_rooms`(97) · `smoke_online`(159) · `smoke_minion_art`(208) ·
`smoke_issue146`(212) · `smoke_online_sync`(23) — 5개 스위트 699개 어서션 전부 통과. 서버 회귀
(`npm run test:authoritative`, 460개 어서션)도 재확인 통과.

## 4. 서버 변형-소스 사건(02:23~02:27Z) 대응

Jupiter가 `server/authoritative/{room,server,engine}.js`에 대해 격리된 mutation-test를 02:23~02:27Z에
돌렸고, 그 창 안에서 시작된 서버 프로세스는 변형된 코드를 메모리에 물고 있을 수 있다는 공지가 왔다. 제
검증 서버(8081)가 그 창 근처에 떠 있었으므로:
1. 파일 MD5를 복구 공지값과 대조해 소스가 깨끗함을 확인.
2. 해당 시점 이후 시작된 제 서버 프로세스를 kill하고 **깨끗한 소스에서 재기동**.
3. 재기동 전에 캡처한 모든 브라우저 스크린샷/상태는 폐기하고, 재기동 이후로 호스트·게스트 흐름을
   처음부터 다시 밟았다(§2.2가 그 최종본이다).
4. §3-2의 아트 수정이 반영된 뒤 **한 번 더** 재기동(현재 PID)해, 최종 스크린샷은 소스 정합성과 아트 수정을
   모두 반영한 서버 기준이다.

## 5. host-join-notify — 오인이었던 조사 기록 (참고용)

재기동 직후 1차 시도에서 host 창이 게스트 참가·준비 완료 이후로도 계속 "상대: 입장 대기"로 멈춰 있는
것처럼 보여, 실서버 조사(별도 Node WebSocket 프로브: 방 생성→게스트 참가 즉시 host 소켓에 `room_state`
푸시 도착 확인)로 **서버 쪽 host-join notify 자체는 정상 동작**함을 먼저 확인했다. 이어서 원인을 좁혀보니,
백그라운드(비활성) OS 창의 접근성 트리 스냅샷이 실제 DOM 갱신을 반영하지 않고 캐시된 채로 남아 있던
**조사 도구(스크린샷/트리 조회) 쪽 현상**이었다 — DevTools를 열어 강제로 리페인트시키자 그 창은 이미
"나의 턴! · 1턴"으로 정확히 전환돼 있었다. 이후 재현(§2.2의 흐름)에서는 지연 없이 정상 전환됐다. Jupiter
서버 코드에 대한 실질적 지적 사항 아님 — 향후 유사 조사에서 "백그라운드 OS 창의 스냅샷은 포그라운드로
전환한 뒤 다시 조회해야 신뢰할 수 있다"는 메모로 남긴다.

## 6. 잔여 항목 (성공으로 마감하지 않는 이유)

- 실브라우저에서의 완결된 전투 1회 스크린샷(공격/기술 교환/라운드 종료) — 전투 무대/HP바/스프라이트
  배선(§3-2)은 코드·회귀 레벨로 확인했으나, 실제 두 말을 인접시켜 전투를 열고 그 화면을 캡처하는 것까지는
  이번 패스에서 마치지 못했다. 재기동한 방(#1)에서 5턴까지 실제로 진행시켰고(양쪽 다 실제 클릭으로 이동,
  §2.2) 계속 서로 다가가는 중이었으나 접촉 전에 시간을 다 썼다.
- 결과(승패) 화면 브라우저 스크린샷.
- **같은 방으로의 재접속 성공** 화면 — §9에서 서버 프로세스를 죽여 두 클라이언트가 예상대로 재접속을
  시도하다 유예 만료 후 방 목록으로 안전 복귀하는 것까지는 확인했지만, 이 방식은 방(룸) 자체를 지우므로
  "같은 대국으로 돌아온다"는 성공 케이스는 재현하지 못했다(그 왕복은 §1의 Node WebSocket 증빙 참조).
  소켓만 끊고 서버 프로세스·룸은 살려두는 방법(관리자 권한 방화벽 규칙 등)을 이번 세션에서 시도했으나
  권한 부족으로 막혔다 — 다음 세션 과제로 남긴다.
- 전투 무대의 **이산 이벤트 기반 FX**(라운드 전환 슬라이드·타격 플래시·승패 배너) — 정적 요소(HP/방어막
  바·상태·스프라이트·배지)는 원본 마크업 그대로 복원했지만(§3-2), 이 FX들은 서버가 스냅샷 이상의 이벤트
  스트림을 주기 전까지는 추측으로 만들 수 없다. PD 경유로 Jupiter에 요청 완료(§10) — task_be7b04a09157/
  ctx_75b8632d8c1f에 배정되어 스키마 초안 대기 중. 필드가 오면 바로 연결할 것.
- `data.modal`(탐색 보상·패키지 개봉 등 2차 선택 화면)의 실브라우저 캡처 — 이번 세션에서도 실제로
  모달을 트리거하는 게임 상황(탐색 이벤트 칸 발견 등)까지 진행하지 못했다. 클라이언트 배선
  (`netRenderModalOverlay`)은 헤드리스 회귀(smoke_public_rooms M절)로 검증돼 있으나 실브라우저 캡처는
  아직이다.
- 공개 상대 하수인의 "공개 전 `?` → 공개 후 아이콘" 전환(§3-2 4단계, `_serializeKnownOpponent` rosterId
  추가분)의 실브라우저 재확인 — 서버 회귀(460개)는 통과했고 client 쪽은 코드 변경이 필요 없음을 확인했으나,
  실제로 상대 말을 발견/공개시켜 화면 전환을 캡처하지는 못했다. **이 델타 반영을 위해 검증 서버를 다시
  재기동**(최종 PID, 이 문서 시점 기준)했고, 그 결과 §2.2의 진행 중이던 방 #1(5턴)도 함께 초기화됐다 —
  다음 세션은 이 최종 서버 기준으로 방을 새로 만들어 처음부터 다시 진행해야 한다.

## 8. DOM 정보 은닉 실증 (신규, 실브라우저 DevTools 콘솔)

PD/Earth가 요구한 "미공개 상대 칸에 자산 경로가 전혀 없어야 한다"를 코드 검토가 아니라 **실제 렌더된 DOM**으로
확인했다. host 창에서 `Ctrl+Shift+I`로 실제 Edge DevTools를 열고 Console에서 직접 실행:

```js
JSON.stringify({qCellsWithImg:
  [...document.querySelectorAll('.cell')].filter(c=>c.textContent.trim()==='?')
    .filter(c=>c.querySelector('img')).length})
// → {"qCellsWithImg":0}   (미공개 "?" 칸 14개 중 <img>가 있는 칸 0개)

JSON.stringify({leaks:
  [...document.querySelectorAll('.cell')].filter(c=>c.textContent.trim()==='?')
    .map(c=>c.outerHTML).join('|SEP|').includes('assets/minions')})
// → {"leaks":false}   (미공개 칸들의 outerHTML 전체에 자산 경로 문자열 전무)

JSON.stringify({ownImgs: document.querySelectorAll('.cell img').length})
// → {"ownImgs":9}   (양성 대조군 — 내 말 9개는 실제 <img>로 렌더링됨)
```
결과: 미공개 상대 칸 14개 전부 `<img>` 0개·자산 경로 문자열 0개, 같은 페이지의 내 말 9개는 실제 `<img>` 9개.
Earth 감사 문서(§3-2, "정보 등급 경계")가 코드 레벨로 약속한 것을 DOM 레벨로 그대로 실증했다.

## 9. 재접속 실증 (신규, 실서버 강제 종료)

방을 만들고(host) 참가·로스터·배치·준비(guest)까지 마쳐 `phase:"play"`(guest 선공 1턴)에 들어간 뒤, 검증
서버 프로세스를 강제 종료해 두 브라우저 클라이언트가 예상대로 반응하는지 확인했다:
- host: 종료 직후(0~5초)에는 이전 화면이 그대로 남아 있었으나, 이후 확인(약 20초 시점)에는 이미 로비
  메뉴 화면(`새 방 만들기` 버튼 등)으로 안전하게 복귀해 있었다 — 재접속 유예(60초) 안에서 재시도하다 방을
  더 이상 찾을 수 없어 포기하고 방 목록으로 돌아가는 `netAbandonResume`/`netResumeExpire` 경로가 정상
  작동한 것으로 보인다.
- guest: 같은 시점(20초)에는 아직 이전 대국 화면(2턴, 상대 턴)에 멈춰 있었으나, 추가로 ~9초 더 기다린
  뒤에는 guest도 로비 메뉴로 복귀해 있었다 — host보다 늦게 단절을 감지했다(정확한 지연 원인은 조사하지
  않았다 — 진행 중이던 요청 유무에 따른 정상적인 타이밍 차이로 추정한다).
- **한계**: 이 테스트는 서버 프로세스 자체를 죽였으므로 방(룸)이 메모리에서 완전히 사라졌다 — 그래서
  두 클라이언트 모두 "재접속 시도 → 유예 만료 → 안전하게 방 목록 복귀"까지만 확인했고, "같은 대국으로
  성공적으로 복귀"하는 케이스는 재현하지 못했다. 그 성공 케이스는 이전 패스에서 Node WebSocket으로
  실제 소켓만 강제로 끊고(서버 프로세스는 살려둔 채) 60초 유예 안에서 자동 재접속에 성공하는 것까지
  실제로 확인했다(§1). 이번 세션에서는 방 관리자 권한이 없어 방화벽으로 단일 소켓만 끊는 방법
  (`New-NetFirewallRule`)이 `PermissionDenied`로 막혔다 — 다음 세션에서 다른 방법(예: 서버에 테스트 전용
  강제-단절 훅을 임시로 추가했다가 제거)을 시도할 수 있다.

## 10. 조정 메시지 로그 (이번 패스, 발췌)

- Jupiter: "restart auth server — transient mutated source restored" (msg_fee44a31b62c) → 제 대응 §4.
- PD(신규 세션 인수, term_94043a14): CJ 재확인 지시 + Earth 감사 + rosterId 원인 확인(msg_626ee0abd579·
  msg_821ea7df3e1c·msg_affa857f2ae3) → 제 대응 §3-2 1~2단계, PD에 확인 회신 발송 완료(msg_f5acefaf7b89).
- Jupiter: "아트 표시 필드 사용 가능" 계약 문서 `Jupiter/art-restore-fields.md` 안내(msg_74ec5c751b69).
- PD: "아트 복구 수용 경계 — 기존 무대/FX 제외 불가"(msg_808d4aca4997, high) → 제 대응 §3-2 2단계(패널/
  토큰 마크업 전면 재사용), 이 문서로 회신을 대신한다 — 잔여 FX 요청은 §6에 명시, 다음 세션에서 PD로 발송.
- PD: "FX 구조화 이벤트 서버 작업 연결"(msg_e85680b41e90) — Jupiter task_be7b04a09157/ctx_75b8632d8c1f에
  §6의 이벤트 필드 요청이 배정됨. PD가 "대기 중 무대·모달·재접속·DOM 비공개 증빙을 진행"을 요청 → §8·§9로
  대응(모달은 이번 세션에서도 트리거하지 못해 잔여로 남는다, §6).
- 이 문서 갱신과 함께 최신 진행 상황을 Run(`run_a9e503daa1ce`)에 보고했다.

## 11. 체크포인트 인계 — 작업 중단 (2026-09-13, Opus5 후속 인수)

PD msg_008c51632774(high): "같은 원인 2회 REVISE" 정책(WORKER_MODELS)에 따라 Opus5 high 기준으로 전환.
Saturn(msg_769a9dcc3466)이 PD 1차 코드검토(msg_fb1dc1057451) 항목(1) battleId/visible-stage 문맥을
1차 수정 후에도 동일 원인으로 독립 재현했다는 보고를 받고, **여기서 새 수정에 착수하지 않고** 안전
체크포인트로 이 절을 작성한 뒤 `worker_done(outcome=failed)`를 1회 보내고 idle한다. 코드는 삭제·되돌리지
않고 현재 diff·workspace를 그대로 보존한다.

### 11-1. 완료 (이번 패스에서 실제로 끝낸 것)
- **FX consumer v2 재작성** — PD 1차 코드검토 6개 지적 중 (2)battleStart 4프레임 원본 재현, (3)flash/sig/
  ko/st 소비+shake 명시신호만, (4)seq gap 로그+seat/room/epoch 경계 시 커서·scene·세대(`NET.fxGen`) 리셋,
  (5)`netFxPump`가 재생 중(`fxPlaying`)엔 배너를 지우지 않도록 수정 — 은 `demo/index.html`의
  `netFxResetCursorIfNeeded`/`netFxRememberScene`/`netFxIngest`/`netFxSide`/`netFxApplyMsg`/`netFxRenderOne`/
  `netFxPump`(약 5511~5643행)로 구현했다.
- **신규 targeted 회귀** `demo/test/regression/smoke_fx_consumer.js`(A~G, 34개 어서션) 작성 — 실제 디스패처
  (`netHandlePublicMessage`)를 그대로 거쳐 이 6개 계약을 검증한다. 디버깅 과정에서 harness 자체의 실제
  버그 셋도 함께 고쳤다(`demo/test/shared/harness.js`): (a) `document.querySelector`/`querySelectorAll`가
  아예 없었던 것을 최소 CSS 선택자 엔진으로 신설(`parseSimple`/`elClasses`/`matchesSimple`/`descendants`/
  `queryAllFrom`) — 이 신설 자체가 기존 로컬모드 폭발/함정 이펙트 코드가 헤드리스 테스트로 한 번도
  검증된 적 없었다는 기존 커버리지 공백을 드러냈다(그 코드 자체를 고치진 않았다, 범위 밖). (b) `cell.className=
  "cell"+...` 문자열 대입과 `classList.add/remove` 두 트래킹 경로가 분리돼 있던 것을 `elClasses()`에서 병합.
- 이 회귀 파일 자체의 버그 3개도 고쳤다(모두 **테스트 코드** 버그였다 — 아래는 프로덕션 결함이 아니다):
  (1) C절 explosion→trapFx 연속 적용 시 `netFxPump`가 재생 중이면 새 이벤트를 큐에만 쌓고 즉시 렌더하지
  않는 설계(비동기 1개씩 재생) — 두 `applyState` 사이 `T.drain()` 누락. (2) D8 `hptxtOp.textContent===63`을
  문자열 `"63"`과 비교하던 오류 — 이 하네스 스텁은 `textContent`를 타입 강제 변환 없이 그대로 저장한다
  (실제 DOM과 다른 점, 기존 다른 테스트 K0/K2/K7e·smoke_fx_timing D8''도 전부 숫자로 비교하는 동일 관례를
  이미 따르고 있어 하네스 자체는 고치지 않고 이 관례에 맞춰 어서션만 고쳤다). (3) G절 fixture 이벤트에
  `.scene`이 없어 "옛 battleId가 캐시에서 사라진다"를 검증할 대상 자체가 없던 것 — fixture에 실제 scene을
  실어 의도대로 고쳤다.
- 전체 회귀 스위트(`demo/test/regression/*.js`, 22개 파일) 재실행 — **전부 무회귀, smoke_fx_consumer
  34/34 포함 전 파일 fail 0** 확인(이 인계 직전 마지막 실행).
- 검증 서버를 깨끗하게 재기동(epoch `171201bb`, PID 33672, `127.0.0.1:8081`, 이 문서 시점까지 살아 있음 —
  아래 11-3 참조)한 뒤 `run_full_e2e.js`를 전체 재실행해 로비→방 생성/참가→로스터→배치→준비→`phase:"play"`
  →정보은닉 점검→40턴 이동 루프→재접속 시도→(전투 미도달로) 기권→결과 화면까지 스크린샷 8종을 새로
  확보했다(`C:\dd_cdp\out\host_00~07_*.png`·`guest_02~07_*.png`, `info_hiding_check.json`). **artifacts/
  MANIFEST.md는 아직 이 최신 캡처로 치환하지 못했다** — 인계 시점에 시간이 없어 §11-4에 원본 로그 경로만
  남긴다(다음 세션이 MANIFEST 갱신).

### 11-2. Saturn이 재확인한 미해결 — 왜 "6개 반영 완료"로 마감할 수 없는가
- **(P1, msg_3e3259c2f71c) battleId/visible-stage 보존 미해결·기존 targeted test가 false green이었다**:
  `netFxSide(battleId,side)`(5557~5562행)는 `NET.fxScenes[battleId]`가 있으면 그 scene으로, 없으면
  `S.battle.mySide`로 me/op를 계산하지만, **실제 화면에 떠 있는 오버레이 자체**가 그 battleId의 것인지는
  전혀 확인하지 않는다. 전투 종료(`battle=null`)나 새 전투 시작 시 오버레이를 열고/닫고/교체하는 별도
  wrapper(대략 5813~5819행 부근 — 이번 패스에서 직접 특정하지 못했다, 다음 세션이 정확한 함수명·라인을
  다시 확인할 것)가 존재하고, 이 wrapper와 `netFxQueue`의 트레일링 이벤트 재생 사이 타이밍이 맞물리지
  않으면: (a) 옛 battle의 마지막 KO/HP/float가 이미 닫힌(숨겨진) 오버레이에 적용되어 사용자에게 전혀
  보이지 않거나, (b) 옛 battleId로 큐잉된 이벤트가 그 사이 열린 **새** battle의 토큰(`tok-me`/`tok-op`)에
  잘못 적용될 수 있다. **`smoke_fx_consumer.js`의 E절(126~146행 부근)은 이 문제를 실제로 검증하지 못한다**
  — `T.S.battle=null`을 테스트가 직접 대입하는 하네스 지름길만 쓰고, 실제 오버레이 open/close/replace
  wrapper를 거치지 않기 때문에 E1~E3가 통과해도 "실제 화면에서 올바른 오버레이에 반영된다"는 보장이 없다
  (Saturn이 독립 재현·false green으로 명명). **다음 세션 우선 작업**: (i) 오버레이 open/close/replace를
  실제로 담당하는 함수를 특정하고 그 호출 시점과 `netFxQueue`/`netFxPump` 재생 시점의 상호작용을 실제로
  추적, (ii) `S.battle=null`을 직접 대입하는 대신 실제 오버레이 wrapper를 거치는 헤드리스 테스트로 E절을
  다시 쓰거나, 최소한 브라우저 스크린샷으로 트레일링 KO/승패 배너가 올바른 오버레이에 실제로 표시되는지
  캡처해 증명할 것.
- **(msg_94c6261b3dac) msg 이벤트별 지속시간 불일치**: `netFxRenderOne`(약 5626행) 마지막 `dur` 계산이
  `ev.src==="msg"`인 모든 이벤트에 `BAL.fx.damageFx`(1200ms 상당) 하나만 쓴다. 원본 로컬 FX 시스템은
  이벤트 종류별로 다른 `BAL.fx[key]`(예: `itemFx`·`skillFx`·`captureFx`·`fleeFx`)를 쓰고 그 사이 텍스트
  단계 간격은 `BAL.fx.msgStep`(600ms)을 쓴다 — 이 구분이 없어 예를 들어 `itemFx`가 실제로는 15ms 뒤
  종료해야 할 것이 damageFx 기준 값 전체를 채워 재생 속도가 원본과 달라진다(Saturn이 40ms/150ms 구체
  타이밍으로 재현). **다음 세션 수정 방향**: `ev.key`(msg 이벤트도 key를 갖는지 프로토콜 재확인 필요 —
  없다면 Jupiter에 필드 추가 요청) 기준으로 `BAL.fx[ev.key]||BAL.fx.msgStep` 우선순위로 dur을 고른다.
- **(msg_b1da7780cbef) reduced-motion이 CSS 애니메이션까지는 끄지 못한다**: `netFxReducedMotion()`은
  JS `setTimeout` 지속시간만 줄인다. CSS(약 387~395행) `prefers-reduced-motion` 규칙은 `result`/`flee`류만
  다루고 `.fx-boom`/`.fx-trap`(cell)·`.btok.shake`·`#bstage.sigblink`·`.dmgfloat` 자체 애니메이션(원본
  0.5~1.2초)은 그 미디어 쿼리에 없다 — JS 쪽 타이머는 짧아져도 CSS keyframe 애니메이션은 원래 길이로
  계속 돈다(시각·타이밍 불일치). **다음 세션 수정 방향**: 이 CSS 셀렉터들을 동일한
  `@media (prefers-reduced-motion: reduce)` 블록에 추가(duration 0 또는 즉시 종료 처리)하고, 실제 브라우저
  computed style로 확인할 것(코드 검토만으로는 불충분 — Saturn 지적).

### 11-3. 프로세스/포트 보존 상태 (인계 시점 그대로 둠, 아무것도 죽이지 않았다)
- 검증 서버: PID **33672**, `node server/authoritative/server.js`, epoch `171201bb`, `127.0.0.1:8081`
  LISTENING — **살아 있음, 그대로 둔다**. 로그: `C:\dd_cdp\server_restart.log`.
  (참고: 인계 전 재기동 전 PID였던 13888은 이번 패스 중 정상적으로 종료·교체했다 — 사고나 강제 조치 아님.)
  ⚠ 이 서버는 이번 세션이 회귀 검증용으로 띄운 것이며 **CI 서버가 아니다** — 다음 세션이 그대로 재사용
  하거나(같은 방/룸 상태가 남아 있을 수 있음), 필요하면 재기동해도 무방하다.
- CDP E2E 테스트 브라우저(host/guest msedge, 이번 마지막 실행분 `run_full_e2e.js`): 스크립트가
  `host.close()`/`guest.close()`를 정상 호출하고 `DONE`으로 종료했으므로 **이미 스스로 깨끗이 종료됐다**
  — 인계 시점에 남아 있는 CDP 테스트 브라우저 프로세스 없음(`ps aux`로 재확인, msedge는 사용자의 실제
  창 PID 32532/4660 두 개만 남아 있고 이 둘은 이번 세션이 전혀 건드리지 않았다). 프로필 디렉터리
  `C:\dd_cdp\host_*`·`C:\dd_cdp\guest_*`는 여러 회차가 누적돼 있다 — 다음 세션이 정리해도 되고(모두 이번
  세션이 만든 격리 프로필, 사용자 데이터 아님), 재사용해도 무방하다.
- 최신 실행 로그: `C:\dd_cdp\run3.log` (이번 인계 직전 마지막 전체 실행, 04:53:56~04:57:07Z). 이번
  실행에서도 전투 접촉은 없었고(40턴 루프 소진), **재접속 UI 감지가 이전 실행(run2.log)과 다른 방식으로
  실패했다**: run2.log는 "재접속 중" 텍스트가 뜨는 것까지는 확인했으나 해제(재접속 완료) 감지에서
  타임아웃났고, 이번 run3.log는 오프라인 전환 후 15초 동안 "재접속 중" 텍스트 자체가 전혀 뜨지 않아
  1차 `waitFor`에서 바로 타임아웃났다(`reconnect_check.json` 미생성 — try 블록이 그 지점에서 예외로
  빠졌다). 두 실행의 증상이 다르다는 것은 **원인을 아직 특정하지 못했다는 뜻**이다 — CDP
  `Network.emulateNetworkConditions(offline)`이 이미 열려 있는 WebSocket 연결의 끊김을 안정적으로
  재현하지 못할 가능성(알려진 CDP 한계 후보, 미확인)과 순수 타이밍 경합 둘 다 배제하지 못했다. 다음
  세션이 이 부분을 근본 원인까지 조사할 것 — 이번 패스에서는 코드를 고치지 않았다(PD 중단 지시 이전에
  이미 발견만 하고 미착수 상태였다).
- git 작업 트리: 삭제·되돌림·커밋 없음. `git status --short` 기준 수정 파일은 `.github/workflows/ci.yml`·
  `demo/index.html`·`demo/test/regression/smoke_online.js`·`demo/test/shared/harness.js`·
  `server/README.md`·`server/package.json`(server 쪽 수정은 Jupiter 소유분, 제가 만들지 않음), 신규
  파일은 `demo/test/browser/`·`demo/test/regression/smoke_fx_consumer.js`·
  `demo/test/regression/smoke_public_rooms.js`·`docs/milestone/v0.4.10/`·`server/authoritative/`(Jupiter
  소유)·서버 시작 `.bat` 2개(Jupiter 소유) — 전부 그대로 보존.

### 11-4. 다음 세션(Opus5 high)을 위한 우선순위
1. §11-2 첫 항목(오버레이 lifecycle·battleId 문맥) — PD 1차 목록의 원래 (1)번, 아직 실제로 안 끝났다.
   근본 원인을 실제 오버레이 open/close/replace 코드까지 추적한 뒤 고칠 것 — 추측으로 재수정하지 말 것
   (이미 2회 같은 원인으로 반려됨).
2. E절 테스트를 실제 오버레이 lifecycle을 거치는 방식으로 다시 작성(또는 브라우저 캡처로 보강)해 false
   green이 아니게 만들 것.
3. §11-2 나머지 두 항목(msg 지속시간 매핑, reduced-motion CSS)도 함께 반영.
4. `docs/milestone/v0.4.10/issues/217/Mars/artifacts/MANIFEST.md`를 `run3.log`/`C:\dd_cdp\out\*` 최신
   캡처로 치환(현재 MANIFEST는 이보다 이전 캡처를 가리키는 stale 상태).
5. 재접속 감지 실패(§11-3 마지막 항목)의 근본 원인 조사 — 특히 CDP `Network.emulateNetworkConditions`가
   기존 열린 WebSocket에 실제로 영향을 주는지부터 확인.
6. 위 전부가 실제 브라우저 증빙(전투 1회·결과 화면·재접속 성공)까지 확보된 뒤에만 "완료"로 보고할 것 —
   지금까지 두 차례 모두 "코드는 고쳤다"만으로 완료를 주장했다가 Saturn이 반례를 재현했다.
