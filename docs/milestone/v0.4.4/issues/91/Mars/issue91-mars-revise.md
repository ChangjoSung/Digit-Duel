# Issue #91 — Saturn REVISE 대응: K8b 송신 0 검사기 교정 (Mars_3 보고)

- 역할: **Mars_3** (required_role=Mars · mode=IMPLEMENT · area=HTML · mutation=code · instance_index=3 · provider=Claude Code)
- Task `task_a4a9a1e7c5ce` · dispatch `ctx_4de59dcc0904` · 브랜치 `fix/91-reserve-minion-art` · 기준 커밋 `3360d56`
- 대응 대상: Saturn_1 판정 REVISE `msg_41022d7d1fa4` — `demo/test/smoke_minion_art.js` K8b 가 `wsLog.length`(생성된 소켓 수)를 메시지 수로 오인했고 연결 소켓도 준비하지 않아, `tryCapture` 진입에 `netSend` 를 심은 변형 제품에서도 197/0 으로 잘못 통과했다.
- 최초 납품 보고 `docs/qa/issue91-mars.md` 는 보존한다. 이 문서는 그 뒤의 테스트 교정만 다룬다.
- 작성: 2026-09-07
- **이 문서가 주장하는 범위**: Mars_3 자기 검증이다. Saturn 재검수·CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다.

---

## 1. 무엇을 바꿨나 — `demo/test/smoke_minion_art.js` K8 블록만 (+19/−6줄)

| # | 변경 | 확정/추론 |
|---|---|---|
| 1 | `mk(me)` 가 하네스의 `T.WebSocketCtor` 로 소켓 스텁을 만들고 `readyState=1`, `T.NET.ws=ws` 로 **연결 상태**를 준비한다 (하위 프로토콜 `[NET_PROTOCOL_MARKER, "qa-k8-code"]`). | [확정] |
| 2 | 검사기 `sentBy(X, fn)` 신설: fn 동안 (1) 연결 소켓의 **실제 `ws.sent` 증분** (2) `wsLog` 로 잰 새 소켓 생성 수 (3) 감시 소켓이 여전히 `NET.ws` 이고 열려 있는지를 함께 돌려준다. `silent(r)` = 셋 다 무송신 조건. (3) 은 제품이 다른 소켓으로 바꿔 보내는 경우를 놓치지 않기 위한 것. | [확정] |
| 3 | K8b: `tryCapture`(중립 포획) 양 인스턴스 → `silent`. 메시지에 실제 send 수를 찍는다. | [확정] |
| 4 | K8c' 신설: `finishByCapture`(적 포획) 양 인스턴스 → `silent`. `initBattle` 은 검사 구간 밖(포획 순간의 정체 기록만 잰다). | [확정] |
| 5 | K8d 음성 대조 신설: 제품의 실제 송신 경로 `netAction({t:"qa-unwanted-send"})` → `netSend` → `NET.ws.send` 로 1건 보내면 **같은 검사기**가 `sent===1` 로 잡고, 마지막 payload 에 `qa-unwanted-send` 가 실려 있으며, `wsLog` 증분은 여전히 0 임을 고정한다 (소켓 수로는 잡히지 않는다는 REVISE 지적 자체를 회귀로 남김). | [확정] |

바꾸지 않은 것: 제품 `demo/index.html` (SHA 아래 동일) · `demo/test/harness.js` (기존 `WebSocketCtor`·`ws.sent` 로 충분해 미수정) · 다른 절(A~J, K1~K7, K9~K10) · CLI 인자 호환(`node demo/test/smoke_minion_art.js [demo/index.html]`).

`netSend` 는 하네스가 노출하지 않으므로 음성 대조는 그것을 감싸는 유일한 제품 경로 `netAction` 을 썼다(`NET.mode && !NET.replaying && netActor()===NET.me` 이면 `netSend({t:"a",a})`). 이를 위해 K8d 직전에 `S.current=0` 을 명시했다. 하네스 export 를 늘리는 대안은 CRLF 고정 파일을 건드리므로 택하지 않았다. [추론: 더 직접적인 대조를 원하면 하네스에 `netSend` 노출 1단어 추가로 가능]

### 줄 끝
체크아웃된 작업 트리 사본은 CRLF(`w/crlf`)였으나 `.gitattributes` 는 `/demo/test/smoke_minion_art.js text eol=lf`, 인덱스 blob 도 LF 였다. 정책대로 **LF 로 저장**했다(`git ls-files --eol` → `i/lf w/lf`). 따라서 아래 작업 트리 SHA = 커밋될 blob 내용의 SHA 다.

---

## 2. 실행 결과

정확한 명령과 결과 (저장소 루트, Node v24.16.0):

```
node demo/test/smoke_minion_art.js                 → === smoke_minion_art: pass 199 / fail 0 ===
node demo/test/smoke_minion_art.js demo/index.html → === smoke_minion_art: pass 199 / fail 0 ===
```
(197 → 199: K8c'·K8d 2건 추가. 수치 증가가 목적이 아니라 양 포획 경로 + 음성 대조 각 1건이다.)

### 반례(변형 제품) 결과 — 메모리 오버레이 대신 스크래치 사본으로 재현, 저장소 파일 무변경
`demo/index.html` 을 스크래치 폴더에 복사해 다음을 심은 두 변형을 만들었다.

| 변형 | 삽입 위치 | 삽입 문 | 새 테스트 결과 | 구(HEAD) 테스트 결과 |
|---|---|---|---|---|
| A | `function tryCapture(p,mode){` 직후 | `netSend({type:"qa-unwanted-send"});` | **FAIL 1 — K8b** (실제 send 1P 1·2P 1), 198/1 | 197/0 (잘못 통과 — Saturn 재현과 일치) |
| B | `function finishByCapture(...){` 직후 | 같은 문 | **FAIL 1 — K8c'** (실제 send 1P 1·2P 1), 198/1 | (미실행 — 구 테스트에는 적 포획 송신 검사가 없다) |

구 테스트는 Node stdin 으로 실행했다 (Saturn READ_ONLY 재현 가능 형태):
```
cd demo/test && git show HEAD:demo/test/smoke_minion_art.js | node - <스크래치>/mut_trycapture.html
```
새 테스트도 같은 stdin 형태로 원본 제품에 대해 199/0 을 확인했다 (`cat smoke_minion_art.js | node - ../index.html`).

변형 파일 생성 (Python, 저장소 밖 스크래치에만 기록):
```
h=open("demo/index.html",encoding="utf-8",newline="").read()
a="function tryCapture(p,mode){"; assert h.count(a)==1
write(mut_trycapture.html, h.replace(a, a+' netSend({type:"qa-unwanted-send"});'))
i=h.index("function finishByCapture("); j=h.index("{",i)+1
write(mut_finishbycapture.html, h[:j]+' netSend({type:"qa-unwanted-send"});'+h[j:])
```

### 이전 검증과의 구분
Saturn_1 보고의 브라우저 CDP 480/91 통과와 다른 5개 스위트는 **이번 변경 이전의 검증**이며, 제품이 바이트 단위로 불변이므로 재실행하지 않았다. 이번에 직접 실행한 것은 `smoke_minion_art` 와 위 반례 두 건뿐이다.

---

## 3. 해시 (작업 트리, sha256)

| 파일 | SHA-256 | 상태 |
|---|---|---|
| `demo/index.html` | `90224fe64b89e2b9919ad9266d022cee38ee4159d92cec82b93c17e867c4cf2c` | 불변 (Saturn 보존 요구 값과 동일) |
| `demo/test/smoke_minion_art.js` | `ea6d573eee183f1e8481f36b7e88323332857abcefaa0d5834ab6db9c31088c1` | 변경 (LF, git blob `81c939fc059108eb952ef55abcf93b613531b22a`) |
| `demo/test/harness.js` | `c04df34ccb04a36fbc34598b046d523292e85b9005ea4ddccabf0f750919e765` | 불변 |

---

## 4. 범위 밖 관찰 (Mars_3 가 만지지 않음)
- 작업 중 `.gitattributes` 에 `docs/qa/issue91-saturn-initial.md`·`docs/qa/issue91-mars-revise.md` 두 줄이 추가되고 `docs/qa/issue91-saturn-initial.md` 가 생겼다(다른 역할의 작업으로 보임). 이 보고 파일은 그 속성대로 LF 로 저장했다.
- `docs/creat2ve/HANDOVER_SNAPSHOT.md` 수정분·`art/`·`orca-hook-latency-report.md` 는 지시대로 접근하지 않았다.
- Git 쓰기는 하지 않았다. 커밋·PR 은 Mercury 집행.
