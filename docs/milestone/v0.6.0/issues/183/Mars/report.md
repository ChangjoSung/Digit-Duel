# #183 — Unity CLI·MCP 연결 실측 (Mars_1 · Mars_3 · Mars_4 개정)
2026-09-11 · Mars_1(Claude Code) · Task `task_3b3b0acd5248` / Dispatch `ctx_f74c9bd47fde` / Run `run_e7acdb9f7900`

**개정 (2026-09-11 · Mars_3, Task `task_1ec55e9b7f84` / Dispatch `ctx_ae356384c19d`)**: Saturn 검수 REVISE
5건을 반영했다. 1~4는 `tools/unity/mcp_smoke.js` 수정(4절·4.1절), 5는 이 문서의 과거 상태 문구 교체
(0절 ④·3.1·3.1.1·7절)다.
**후속 개정 (같은 날 · Task `task_e299b082ba8e` / Dispatch `ctx_5f73b352a77f`)**: PD 지시로 initialize
계약을 MCP 2024-11-05 lifecycle 명세에 맞춰 강화했다 — 객체 `capabilities`, `serverInfo{name, version}`,
지원 버전 협상, `capabilities.tools` 광고 확인 후에만 `tools/list`. 회귀는 33건 → **39건**이다(4.1절). Mars_3 는 **Editor·Unity CLI·MCP 를 실제로 호출하지 않았고** 에이전트 설정
파일·Hub 설치 DB 를 읽거나 바꾸지 않았다 — 앞선 Task 의 Hub DB 수동 `ALTER TABLE` 흔적은
[#182 bootstrap](../../182/Mars/bootstrap.md) 기록 그대로 남아 있으며 이 개정이 정상화하지 않는다.
아래 실호출 결과는 모두 **Mars_1·Mars_2·Saturn 이 남긴 기록의 인용**이다.
**재검수 개정 (같은 날 · Mars_4, Task `task_8ceca8bb3f44` / Dispatch `ctx_c2fb2ad0b9af`)**: Saturn_2 의
06:50 UTC 재검수 REVISE 3건을 반영했다 — `--timeout` 을 정수 `1`~`2147483647` 로 제한하고(Node
`setTimeout` 이 그 밖의 값을 1ms 로 축소한다), stdout·stderr 를 `StringDecoder` 로 상태 있는 UTF-8
디코딩해 청크 경계에서 갈라진 한글이 보존되게 했으며, 9절의 "비밀값 미출력" 보장을 실제 출력 범위 서술로
교체했다(4.2·9절). 회귀는 39건 → **46건**이다. Mars_4 도 **Editor·Unity CLI·MCP·실기기를 호출하지 않았고**
에이전트 설정·Hub DB·외부 설정을 읽거나 바꾸지 않았다. 이 구현자 개정 시점에는 live 호환성이 미확인이었다.

**Mercury 검증 상태 갱신(07:02 UTC):** [최종 독립 정적 검수](../Mercury/saturn-final-review.md) PASS, Mercury의 회귀46/46과 [실제 서버 재실행](../Mercury/final-live-verification.md) PASS. 다중 Editor에서의 Claude MCP 고정 대상 선택은 [Mars_2 환경 보고 15절](../../182/Mars/environment.md)에 증거가 있다. 아래 과거 실행 기록은 당시 관측이며 CJ 사용 확인과 PR/CI는 별도다.

**선행**: [#182 최소 프로젝트 부트스트랩](../../182/Mars/bootstrap.md). 대상 프로젝트는 `C:\Users\pc_77\orca\Digit-Duel\unity` / Editor `6000.6.0f1` / CLI `1.0.0-beta.9` 이다.

## 0. 검증 단계를 섞지 않는다

PD 지적대로 네 가지는 서로 다른 증거다. Mars_1 작성 시점에는 셋까지였고, ④는 이후 fresh Codex(Saturn)·
fresh Claude(Mars_2) 세션의 실호출로 확인됐다 — 아래 표는 **2026-09-11 개정 시점의 상태**다.

| 단계 | 무엇을 증명하나 | 이번 결과 |
|---|---|---|
| ① 설정 존재 | config 파일에 항목이 있다 | 확인 — **세 CODEX_HOME 모두**(기본 `~/.codex` 포함)와 Claude Code user config. 활성 Codex 계정 config 만 채웠던 초기 상태에서는 세션 기동 때 두 번 덮어써져 소실됐다 — 3.1.1 |
| ② 클라이언트 handshake | 클라이언트가 서버를 띄워 연결했다 | 확인 (`claude mcp get` = Connected) |
| ③ MCP 프로토콜 실호출 | initialize·tools/list·tools/call 이 실제 Editor 응답을 돌려준다 | **확인** (아래 4절) |
| ④ 에이전트 세션 실사용 | fresh Claude·Codex 세션이 대화 중 그 도구를 실제로 호출한다 | **확인** — fresh Codex(Saturn) 4건·fresh Claude(Mars_2) 4건이 모두 실제 MCP 도구 호출로 성공했다 (7절) |

③은 표준 MCP 클라이언트 동작을 그대로 재현한 것이지 ④의 대체가 아니다.
①~④가 확인됐다는 것이 **#183 전체 AC 완료나 CJ 수락은 아니다**. 스모크 회귀 테스트 실행 결과 반영과
다중 Editor 선택은 후속 Mars_2 검증에서 통과했다 (7.1절).

## 1. 확정 — Pipeline 패키지와 라이브 Editor

```
unity pipeline install --project-path "C:\Users\pc_77\orca\Digit-Duel\unity"   # exit 0
→ com.unity.pipeline  0.6.0-exp.1   (list-versions 최신 exp)
→ unity/Packages/manifest.json 에 "com.unity.pipeline": "0.6.0-exp.1" 추가
```

`unity status --json` 이 설치 전 `STATUS_NO_INSTANCES` 에서 설치+Editor 기동 후 다음으로 바뀌었다.

```json
{"count":1,"instances":[{"port":7800,"project":"C:\Users\pc_77\orca\Digit-Duel\unity",
  "version":"6000.6.0f1","pid":28860,"state":"ready"}]}
```

## 2. 확정 — 직접 CLI 경로 (기본 경로)

| 명령 | 결과 |
|---|---|
| `unity list` | 라이브 Editor가 등록한 도구 **149개** 나열 |
| `unity command editor_status` | `status=ready`, `projectPath=…\Digit-Duel\unity`, `unityVersion=6000.6.0f1` |
| `unity command get_player_settings` | `productName=Digit Duel`, `scriptingBackend=Mono2x` |
| `unity command recompile` / `recompile_status` | `up_to_date`, `failed=false`, `errors=[]` |
| `unity command console --level error --tail 20` | `entries=[]` (오류 0) |
| `unity command get_scene_hierarchy` | 씬 트리 반환 — MCP로 만든 오브젝트를 교차 확인하는 데 사용 |
| `unity command list_build_targets` | `Android: isInstalled=false` (다음 Task 근거) |

프로젝트 식별은 모든 응답의 `target.projectPath` 가 Digit-Duel `unity` 를 가리키는 것으로 확인했다.

## 3. 확정 — 에이전트별 등록 (기존 항목 보존)

### 3.1 Codex — 최종적으로 세 CODEX_HOME 모두에 기록

**최종 상태(확정)**: `mcp_servers.unity` 는 ① `C:\Users\pc_77\.codex` ② `…\orca\codex-runtime-home\home`
③ 활성 `…\orca\codex-accounts\0808…\home` **세 곳 모두**에 있다. 아래 3.1 본문과 3.1.1 은 그 결론에
이르는 **과거 시도 순서의 기록**이며, "활성 home 에만 기록" · "기본 config 미변경" 은 **그 시점의 상태**다.

`unity mcp configure codex --dry-run` 은 실제로 **당시 비활성이던 기본 경로**를 가리켰다:

```
다음 위치에 작성됩니다: C:\Users\pc_77\.codex\config.toml
```

현재 Orca 활성 계정은 `CODEX_HOME=C:\Users\pc_77\AppData\Roaming\orca\codex-accounts\0808e204-…\home` 이다(계정 폴더는 1개뿐이라 대상이 모호하지 않다). 그래서 **자동 configure 를 쓰지 않고** 활성 home 을 존중하는 공식 명령으로 등록했다.

```
codex mcp add unity -- "C:\Users\pc_77\AppData\Local\Unity\bin\unity.exe" mcp \
  --project-path "C:\Users\pc_77\orca\Digit-Duel\unity"
→ Added global MCP server 'unity'.
```

- `codex mcp get unity` → `enabled: true`, `transport: stdio`, args 에 Digit-Duel 경로 고정.
- **보존 확인**: 변경 전후 config.toml 의 섹션 목록 diff 가 `+[mcp_servers.unity]` **한 줄뿐**이다. `mcp_servers.node_repl`·`mcp_servers.notion`·plugins·projects·hooks 전부 그대로다.
- **이 시점의 기본 config**: `C:\Users\pc_77\.codex\config.toml` 에 `mcp_servers.unity` 는 **0건**이었다(1차 등록에서는 손대지 않았다). **이 문장은 과거 상태다** — 3.1.1 의 2차 조치로 기본 config 에도 같은 항목을 넣었고, 그것이 fresh 세션 유지의 조건이었다.

#### 3.1.1 계정 config 가 덮어써지는 문제와 원본 추적 (확정 관측 + 추론)

첫 등록 직후 PD·Saturn 조회에서 `unity` 가 **사라졌다**. 실측한 사실:

- 그 시점의 계정 config 는 변경 전 백업과 한 줄(`gpt-6-astra = 1`, `[tui.model_availability_nux]`) 차이로 관측됐고, 새 Codex 세션 기동(15:06:48 KST) 이후 `[mcp_servers.unity]`가 없었다. 기동 시 설정 동기화/덮어쓰기를 원인 후보로 판단했다. 다만 Orca 내부 복사 구현을 직접 확인한 것은 아니므로 파일 전체를 어떤 프로세스가 다시 썼는지까지 확정하지 않는다.
- 원본 후보를 찾았다: **`C:\Users\pc_77\AppData\Roaming\orca\codex-runtime-home\home\config.toml`** (한 단계 아래 `home/` 에 있어 처음 조회에서 누락됐다). 계정 config 와의 diff 는 `model_reasoning_effort`, `gpt-6-astra` 한 줄, 그리고 `hooks.state` 경로가 `codex-runtime-home` → `codex-accounts\0808…` 로 치환된 것뿐이다. `node_repl`·`notion` 도 여기에 들어 있다.
- 기본 `~/.codex/config.toml` 은 크기·섹션 순서가 달라 원본으로 보기 어렵다(그리고 마지막 수정 시각이 더 이르다).

1차 조치: **DB·앱 코드·수동 TOML 편집 없이** 공식 CLI 만 사용해, `CODEX_HOME` 을 각각 지정해 `codex mcp add unity` 를 ① 활성 `0808…\home` ② `codex-runtime-home\home` 두 곳에 실행했다.

**그 가설은 반증됐다.** 15:12:19 에 계정 config 가 또 다시 쓰이며 `unity` 가 사라졌는데, **그 시점 `codex-runtime-home\home` 에는 `unity` 가 그대로 남아 있었다.** 즉 계정 config 재생성 원본은 그 템플릿 단독이 아니다. 기본 `~/.codex/config.toml` 도 이 시점까지 수정 시각이 12:40 그대로였다.

2차 조치(PD 지시 · 사용자 로컬 MCP 연동 승인 범위): 공식 CLI 로 **세 CODEX_HOME 모두**에 같은 항목을 넣었다.

| CODEX_HOME | `mcp_servers.unity` | 기존 `node_repl`·`notion` |
|---|---|---|
| `C:\Users\pc_77\.codex` | 1 | 보존 |
| `…\orca\codex-runtime-home\home` | 1 | 보존 |
| `…\orca\codex-accounts\0808…\home` (활성) | 1 | 보존 |

기본 config 의 섹션 diff 도 `+[mcp_servers.unity]` 한 줄뿐이다. 다른 키·DB·앱 코드·Orca UI 는 건드리지 않았다.

판정(PD 실측): 세 곳을 채운 뒤 기동한 **3차 fresh Codex 세션에서 `codex mcp get unity` 가 성공**했고, 그 세션의 도구 목록에 **`mcp__unity__` 149개가 노출**됐으며, 이어서 그 세션(Saturn)이 **실제 도구 호출 4건에 성공**했다(7절). 앞선 두 번(기본 config 미포함 상태)은 모두 소실됐으므로 **기본 `~/.codex` 포함 여부가 차이를 만들었다**는 것이 실측이다. 실패한 두 시도는 failed 로 정산·archive 했고 성공 기록에 합산하지 않는다.

**미확정으로 남기는 것**: Orca 가 계정 config 를 어떤 규칙으로 재생성·복사하는지(내부 구현)는 추론이며 특정하지 않았다. 앱 소스·DB 는 조사하지 않았다.

### 3.2 Claude Code

```
unity mcp configure claude-code --project-path "C:\Users\pc_77\orca\Digit-Duel\unity" --yes
→ 실행: claude mcp add --scope user --transport stdio unity-editor-mcp unity mcp -- --project-path …
→ Added stdio MCP server unity-editor-mcp … to user config
```

- `claude mcp get unity-editor-mcp` → **Status: ✔ Connected**, Scope: User config, Args 에 Digit-Duel 경로 고정.
- **보존 확인**: `claude mcp list` 에 기존 5개(claude.ai Slack/Drive/Calendar/Gmail, notion)가 그대로 있고 `unity-editor-mcp` 가 추가됐다.
- **범위 주의**: 공식 CLI 의 기본값이 `--scope user` 라 **모든 프로젝트에서 보인다**(단, 서버는 Digit-Duel 경로에 고정). 프로젝트 단위로 좁히려면 `claude mcp remove unity-editor-mcp -s user` 후 저장소에서 `claude mcp add --scope local …` 로 다시 등록하면 된다 — CJ 판단 사항이며 임의로 바꾸지 않았다.

### 3.3 공식 skill

`unity skill install --list` 기준 `claude-code`(`~/.claude/skills/unity-cli`)·`codex`(`~/.agents/skills/unity-cli`) 모두 **이미 설치됨** 상태였다(앞선 Task에서 설치). 이번 Task는 재설치하지 않았다.

## 4. 확정 — MCP 프로토콜 실호출 (③)

도구: **`tools/unity/mcp_smoke.js`** (이번 Task 산출물, Node v24.16.0).
`unity mcp --project-path <프로젝트>` 를 stdio 로 띄워 JSON-RPC 로 `initialize` → `tools/list` → `tools/call` 을 보낸다.

```
node tools/unity/mcp_smoke.js
[1/3] initialize OK — server=unity-mcp 1.0.0-beta.9 protocol=2024-11-05
[2/3] tools/list OK — 149개
[3/3] tools/call(editor_status) OK — isError=false
  { "status":"ready", "projectPath":"C:\Users\pc_77\orca\Digit-Duel\unity", "unityVersion":"6000.6.0f1" }
```

위 출력은 **Mars_1 의 실측 기록**이다. 아래 4.1 의 개정판은 같은 성공 경로의 출력 형식을 유지하지만
Mars_3 가 라이브 Editor 로 재실행하지는 않았다 — 재실행은 Saturn 재검수·CJ QA 단계의 몫이다.

**이 스크립트의 변경 범위(PD 지적 반영)**: 기본값(`--tool` 생략 = `editor_status`)일 때만 읽기 전용이다. `--tool`/`--args` 는 Pipeline 에 등록된 **임의의** 도구를 받고 `create_scene`·`delete_asset` 같은 변경형·파괴형 도구도 그대로 실행한다(이름을 검열하지 않고 `confirm` 도 그대로 전달한다). 그래서 헤더에 그 사실과 "변경형은 전용 임시 폴더로 한정하라"는 사용 규칙을 명시했다. 스크립트는 Editor 를 열거나 닫지 않는다. `windowsHide`, spawn `error`/`exit` 처리도 넣어 서버가 응답 전에 죽으면 매달리지 않고 즉시 실패한다(존재하지 않는 project-path 로 실패 경로도 실측했다: tools/list 0개 → 명시적 실패).

### 4.1 확정 — Saturn REVISE 1~4 반영 (Mars_3)

| Saturn 지적 | 반영 내용 |
|---|---|
| 1. 응답 구조 미검증 → result 없는 응답도 종료 0 | 세 호출 모두 `jsonrpc:"2.0"` + **객체 result** 를 요구한다. initialize 는 [MCP 2024-11-05 lifecycle](https://modelcontextprotocol.io/specification/2024-11-05/basic/lifecycle) 대로 **협상된 `protocolVersion`·객체 `capabilities`·`serverInfo{name, version}`** 을 모두 강제하고, `tools/list` 는 서버가 **`capabilities.tools` 를 객체로 광고했을 때만** 보낸다. tools/list 는 배열 `tools` 와 각 원소의 문자열 `name`, tools/call 은 배열 `content`·각 원소의 문자열 `type`·boolean 인 `isError` 를 강제한다. 하나라도 어긋나면 stderr 요약 후 **1** 이다 |
| 2. isError=true 인데 OK 출력 | `[3/3] … 실패 — isError=true` 와 오류 본문(앞 1200자)·서버 stderr(앞 500자)를 **stderr** 로 보내고 stdout 에 OK 를 쓰지 않는다. 종료 1 |
| 3. Windows BAT/CMD | **.EXE/.COM 만 허용**한다고 명시하고 그렇게 구현했다. PATH 에 `unity.bat`/`unity.cmd` 셰임뿐이면 실행하지 않고 `--unity-bin <실제 .exe>` 를 안내하며 종료 2. `--unity-bin` 도 존재·확장자를 검사한다. BAT/CMD 를 대신 실행하지 않는다 |
| 4. 느슨한 인수 파싱 | 알 수 없는 옵션·값 누락·중복 옵션·위치 인수·잘못된 JSON·객체가 아닌 `--args`·0 이하/비유한 `--timeout` 을 모두 거부하고 **종료 2**. 헤더에 "`--timeout` 은 요청별 대기 상한이며 시간 초과가 Editor 안에서 이미 시작된 변경을 취소·롤백하지 않는다"를 명시했고 timeout 오류 메시지 자체에도 같은 문장을 넣었다 |

**initialize 계약의 기준은 명세다.** MCP 2024-11-05 lifecycle 은 서버가 initialize 응답에 협상된
프로토콜 버전과 **server capabilities·server information 을 반드시** 싣도록 정한다. 따라서 이 스크립트는
`capabilities`(객체)·`serverInfo.name`·`serverInfo.version` 을 **필수**로 두고, `protocolVersion` 이
이 클라이언트가 말할 수 있는 버전(`2024-11-05`)이 아니면 협상 실패로 끝낸다. 또 lifecycle 의 "광고하지
않은 기능은 호출하지 않는다"에 따라 `capabilities.tools` 가 객체로 광고되지 않으면 **tools/list 를 아예
보내지 않고** 실패한다. 종전 스크립트는 원본 initialize 응답을 남기지 않고 일부 필드만 출력했으므로
그 출력은 서버의 명세 위반을 입증하지도, 필드 누락을 허용할 근거가 되지도 않는다 — 실제 transport 응답
확인은 Editor 가 빌드에서 돌아온 뒤 라이브 재실행에서 한다(7.1).
종료 코드는 **0 성공 / 1 실행·프로토콜 실패 / 2 사용법 오류**로 늘렸다.
stdio 프로젝트 지정(`mcp --project-path <프로젝트>`)은 그대로다. 출력 범위는 9 에 적는다 —
스크립트가 **도구 응답 본문과 서버 stderr 를 그대로 옮기므로** 그 내용에 대한 보장은 하지 않는다.

### 4.2 확정 — Saturn 재검수 P2 반영 (Mars_4)

| Saturn 재검수 지적 | 반영 내용 |
|---|---|
| P2 `--timeout` 범위 | **정수 `1`~`2147483647`** 만 받는다. Node 의 `setTimeout` 은 delay 가 32 비트 부호 있는 정수 범위를 넘으면 **1ms 로 축소**하므로([Node 타이머 계약](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args)) `2147483648` 을 받으면 "약 25 일 대기"가 아니라 사실상 즉시 시간 초과가 된다. 소수(`0.5`·`1500.5`·`1e-3`)도 문서의 정수 계약과 달라 반올림해 삼키지 않고 거부한다. 거부는 **종료 2** 이고 메시지가 축소 사실을 알려 준다. `MIN_TIMEOUT_MS`·`MAX_TIMEOUT_MS` 를 export 해 테스트가 같은 상수로 경계를 검사한다 |
| P2 UTF-8 청크 | stdout·stderr 를 청크마다 `Buffer.toString()` 하던 것을 **`node:string_decoder` 의 `StringDecoder('utf8')`** 로 바꿨다. 파이프는 바이트 스트림이라 청크 경계가 임의여서 한글(3바이트)·이모지(4바이트)가 중간에 갈라지면 조각마다 `U+FFFD` 로 바뀌었다. `StringDecoder` 는 불완전한 선행 바이트를 다음 청크까지 들고 있어 문자가 그대로 살아남는다. stdout(줄 단위 JSON 조립)과 stderr(요약 출력) 양쪽에 각각 디코더를 둔다 |
| 보고 정확성 | 9 의 "비밀값 미출력" 보장을 실제 출력 범위 서술로 교체했다 |

**이 두 수정은 프로토콜 계약을 바꾸지 않는다.** initialize 필수 필드·도구 기능 광고·버전 협상,
`result` 누락·`isError`, 옵션/JSON 검증, BAT/CMD 거부·shell-free argv 는 4.1 그대로 유지했고
기존 테스트 39 개도 그대로다(오류 문구가 바뀐 timeout 거부 테스트의 정규식만 새 문구에 맞췄다).

**회귀 테스트**: `tools/unity/mcp_smoke.test.js` (Node `node:test`). 실행 방법과 결과:

```
node --check tools/unity/mcp_smoke.js        → 통과
node --check tools/unity/mcp_smoke.test.js   → 통과
node --test tools/unity/mcp_smoke.test.js    → tests 46 / pass 46 / fail 0 (300ms)
```

(Mars_3 시점은 39/39 이었고 Mars_4 가 timeout 범위·UTF-8 청크 회귀 7 개를 더해 46 개다.)

테스트는 **라이브 Unity Editor·Unity CLI·MCP 서버를 호출하지 않는다.** 자식 프로세스를 spawn 하지도
않고, JSON-RPC 를 말하는 가짜 자식(EventEmitter+스트림)을 `runSmoke` 에 주입한다. 덮는 음성 경로:
initialize·tools/call 의 result 누락·result 가 배열·`jsonrpc` 불일치·JSON-RPC error 응답·
`protocolVersion` 누락/비문자열·**지원하지 않는 `protocolVersion`**(`2025-06-18`·`2024-10-07`·`1.0`)·
**`capabilities` 누락/비객체**·**`serverInfo` 누락/비객체**·`serverInfo.name` 누락·
**`serverInfo.version` 누락/빈 문자열**·**`capabilities.tools` 미광고·비객체**(이때 tools/list 요청이
서버에 도달하지 않았음까지 확인한다)·`tools` 비배열·원소 name 누락·요청 도구 미존재·`content` 비배열·
`type` 누락·`isError` 비boolean·`isError=true`·요청별 timeout·응답 전 자식 종료·spawn error.
양성 경로로는 클라이언트가 보내는 `protocolVersion` 이 지원 목록의 값인지, tools 외 다른 capability 가
더 광고돼도 통과하는지를 본다.
인수 파싱은 알 수 없는 옵션·값 누락·중복·위치 인수·잘못된 JSON·비객체 args·`0`/`-1`/`abc`/`Infinity`/`NaN`
timeout 을 각각 검사한다. Mars_4 가 여기에 **소수 timeout**(`0.5`·`1.5`·`1500.5`·`2147483646.999`·`1e-3`)과
**상한 초과**(`2147483648`·`2147483650`·`4294967296`·`1e10`·`9007199254740991`) 거부, 그리고 **경계값
`1`·`2147483646`·`2147483647` 수용**을 더했다. 경계값 검사는 `parseOptions` 파싱만 보므로 **긴 타이머를
실제로 기다리지 않는다**(실행 경로 테스트는 60~200ms 짜리 짧은 값만 쓴다).
**UTF-8 청크 분할**은 가짜 자식이 응답을 `Buffer` 조각으로 직접 써서 재현한다 — 한글·이모지가 섞인 본문을
1·2·3·5·7 바이트 단위로 잘라 보내고(한글 한 글자가 3바이트라 1·2 바이트 조각은 반드시 글자 중간을 가른다)
출력이 원문과 정확히 같고 대체 문자 `U+FFFD` 가 하나도 섞이지 않는지 본다. 서버 stderr 의 한글도 같은 방식으로
1바이트씩 쪼개 보내 실패 요약에 온전히 남는지 확인하고, 비 JSON 로그와 응답이 한 조각에 섞여 걸쳐 와도
줄 단위 조립이 깨지지 않는지 본다. 이 회귀들은 수정 전 구현에서 실제로 실패하는 것을 확인했다.
**공백 있는 경로**는 두 방향으로 본다 — 공백 있는 프로젝트 경로가 spawn 인수
배열에 쪼개지지 않고 그대로 전달되는지, 그리고 `os.tmpdir()` 아래 이름에 공백이 있는 임시 디렉터리의
`unity.exe` 를 PATH 탐색이 그대로 돌려주는지(빈 파일을 만들어 존재만 확인하고 실행하지 않으며 끝나면 지운다).
`.cmd` 셰임만 있는 디렉터리는 거부되는 것을 확인한다. 저장소 안에 고정 fixture 파일을 남기지 않는다.

## 5. 확정 — 전용 임시 씬 변경·복구

| 순서 | 경로 | 결과 |
|---|---|---|
| 1 | MCP `create_scene` | `Assets/_CliSmoke/CliSmoke.unity` 생성 (guid `01ae86a6…e98b9b`) |
| 2 | MCP `create_gameobject` | `/CliSmokeProbe` 생성 |
| 3 | 직접 CLI `get_scene_hierarchy` | 같은 오브젝트를 교차 확인 — **MCP 쓰기를 CLI 가 본다** |
| 4 | 직접 CLI `save_scene` → `open_scene Assets/Scenes/SampleScene.unity` | 원래 씬 복귀 |
| 5 | 직접 CLI `delete_asset --asset Assets/_CliSmoke --confirm true` | 폴더 제거, 디스크에서 사라진 것 확인 |
| 검증 | `SampleScene.unity` md5 | 작업 전후 **`fed7a1b2351b2ca06bc833598d28091f` 동일** |

`unity/.gitignore` 에 `/Assets/_CliSmoke/` 를 넣어 검증 잔여물이 추적되지 않게 했다.

## 6. 확정 — 재시작 후 재연결

```
unity close …\unity      → PID 28860, 닫힘 true, 방법 graceful
unity status             → STATUS_NO_INSTANCES (연결 끊김 확인)
unity open …\unity       → 재기동
unity status             → count=1, pid=20300, port=7800, state=ready
node tools/unity/mcp_smoke.js --tool get_player_settings → productName "Digit Duel" (변경 영속 + MCP 재호출 성공)
```

Editor writer 는 시종 1개다. 다른 프로젝트 Editor 는 존재하지 않았고 아무것도 종료시키지 않았다.

## 7. 확정 — fresh 에이전트 세션의 실제 MCP 호출 (④)

Mars_1 은 PD 지시대로 **새 agent/subagent 를 스스로 만들지 않았다.** ④는 PD 가 붙인 별도 fresh Task 에서
확인됐고, 아래는 그 기록의 인용이다 (원본: [Codex 검증](../Mercury/codex-mcp-verification.md) ·
[Claude 검증](../Mercury/claude-mcp-verification.md)). Mars_3 는 이 호출들을 재실행하지 않았다.

- **Codex (fresh 세션, Saturn READ_ONLY · 06:14:50 UTC)**: 세션 ALL_TOOLS 에 `mcp__unity__` **149개** 노출.
  실제 MCP 도구 호출 4건 전부 첫 시도 성공 — `editor_status`(ready, compiling=false, playMode=stopped,
  Unity 6000.6.0f1, 정확한 Digit-Duel/unity 경로) · `list_open_scenes`(SampleScene 1개) ·
  `get_scene_hierarchy`(Main Camera·Global Light 2D) · `get_console_logs`(error, total 0).
  shell CLI 나 자체 JSON-RPC 스크립트로 대체하지 않았다.
- **Claude Code (fresh 세션, Mars_2 · 06:17 UTC)**: `unity-editor-mcp` 도구로 4건 성공 —
  `editor_status` · `list_open_scenes` · `get_scene_hierarchy`(Codex 조회와 동일 구성) ·
  `package_list`(설치 73·직접 의존 56, Pipeline 0.6.0-exp.1 — **#182 패키지 정리 이전 수치**).
- **과거 시도(보존)**: 세 CODEX_HOME 을 채우기 전의 fresh Codex 세션 두 번(`ctx_fd23d85ad4cd` 노출 96개·
  Unity 0, `ctx_73d6a2f40a53` unknown MCP server unity)은 모두 failed 로 정산·archive 했다.
  성공 기록에 합산하지 않는다.
- **공통 전제**: 실제 Editor 도구 호출 시 지정한 프로젝트가 실행 중이어야 한다(`unity status` ready). 앞선 새 Codex 두 번의 실패는 Editor가 실행 중인데도 설정/도구 등록이 없는 상태였으므로 Editor 미실행 실패와 같은 원인으로 설명하지 않는다.
- 동시에 쓸 때는 **writer 를 하나로** 유지한다. 읽기 조회는 병행해도 되지만 씬·에셋 쓰기는 한 주체만 한다.

### 7.1 남아 있는 것 (이 문서가 증명하지 않는 것)

| 항목 | 상태 |
|---|---|
| 스모크 회귀 테스트(`node --test`) 46건 | Mars_4와 Mercury 각각46/46. Saturn은 파일을 만들지 않는 정적/구문 검수 PASS |
| 개정된 스크립트의 라이브 Editor 재실행 | Mercury 07:00 UTC 종료0, initialize 계약·149도구·지정 프로젝트 editor_status 성공. UTF-8 분할 경계는 격리 회귀 증거와 구분 |
| 기존 `--timeout` 사용처 | `2147483648` 이상이나 소수를 쓰던 호출이 있었다면 이제 **종료 2** 로 거부된다. `tools/unity/` 안에서 `mcp_smoke.js` 를 `--timeout` 과 함께 부르는 곳은 두 산출물 자신뿐이다. **그 밖의 호출자는 확인하지 않았다** — 다른 경로·외부 스크립트는 이 개정의 검색 범위가 아니다 |
| 다중 Editor 환경에서의 대상 선택 | Mars_2가 일회용 두 번째 Editor와 동시 실행, Claude MCP는 Digit-Duel 선택·전용 Atlas1개, 반대쪽 CLI는 Atlas0개. 일회용 Editor만 정상 종료 |
| Android APK·#182 전체 구현 | 이 문서 범위 밖 (Mars_2 / #182) |
| #183 AC 전체 완료·CJ 수락 | **아직 아니다** |

## 8. 롤백

| 대상 | 되돌리는 법 |
|---|---|
| Codex 등록 | `codex mcp remove unity` 를 **세 번** — `CODEX_HOME` 을 ① `C:\Users\pc_77\.codex` ② `…\orca\codex-runtime-home\home` ③ 활성 `…\orca\codex-accounts\0808…\home` 로 각각 지정해 실행한다. 세 파일의 변경 전 백업은 Task scratchpad 에 보관했고 저장소에 넣지 않았다 |
| Claude Code 등록 | `claude mcp remove unity-editor-mcp -s user` |
| Pipeline 패키지 | `unity/Packages/manifest.json` 에서 `"com.unity.pipeline"` 줄 제거 후 Editor 재열기 |
| 검증 도구 | `tools/unity/mcp_smoke.js` 와 `tools/unity/mcp_smoke.test.js` 삭제 (다른 코드가 의존하지 않는다) |
| 스크립트 개정만 되돌리기 | 두 파일을 `git checkout` 으로 되돌린다. Editor·설정·프로젝트 파일은 개정이 건드리지 않았으므로 되돌릴 것이 없다 |
| 임시 씬 | 이미 제거됨 (`Assets/_CliSmoke` 없음) |

## 9. 이 문서에 기록하지 않은 것 · 스크립트가 실제로 출력하는 것

**이 문서에 싣지 않은 것**: 계정 토큰·인증 정보·세션 원본 로그·기기 일련번호. config 파일 전문도 옮기지
않았고 변경 여부는 섹션 단위 diff 로만 확인했다. 개정(Mars_3·Mars_4)은 여기에 더해 **에이전트 config·Hub
설치 DB 를 열지도 바꾸지도 않았다.**

**스크립트의 실제 출력 범위 (Saturn 재검수 "보고 정확성" 반영 — 종전의 "비밀값 미출력" 서술을 대체한다)**:

| 스트림 | 내용 | 성질 |
|---|---|---|
| stdout | `serverInfo.name`·`serverInfo.version`·`protocolVersion`, 도구 개수와 앞 5개 이름 | 서버가 준 값을 그대로 |
| stdout | **`tools/call` 응답 본문 텍스트 앞 1200자** | **임의 도구의 응답을 그대로** |
| stderr | 실패 요약(검증 위반 메시지·`isError` 본문 앞 1200자) | 위반한 값의 `JSON.stringify` 앞 300자 포함 |
| stderr | **서버 stderr 앞 500자** | **서버가 뱉은 것을 그대로** |

즉 스크립트는 출력 내용을 **검열하거나 마스킹하지 않는다.** 앞 1200자·500자라는 길이 상한이 있을 뿐이고,
`--tool` 은 임의의 도구를 받으므로 그 도구가 비밀값·토큰·전체 경로를 응답에 담으면 **그대로 stdout 에 나온다.**
서버가 stderr 에 쓰는 내용도 마찬가지다. 따라서 "비밀값이 절대 출력되지 않는다"는 보장은 하지 않으며,
출력을 로그·이슈에 붙일 때는 사람이 확인하고 붙인다.

**실제로 확인한 것과 보장을 구분한다**: 기본 경로(`--tool` 생략 = `editor_status`)로 돌린 4 의 출력에는
프로젝트 절대 경로·Unity 버전·상태 문자열만 있었고 자격 증명은 없었다 — 이는 **그 도구·그 실행의 관측**이지
임의 도구·임의 서버에 대한 보장이 아니다. 응답 본문을 검증한 것은 Mars_1 의 라이브 실행 1 회분이고,
Mars_3·Mars_4 의 개정은 라이브 재실행 없이 가짜 자식 프로세스로만 검증했다(7.1).

**테스트가 만드는 파일**: `os.tmpdir()` 아래 `mkdtemp` 로 만든 임시 디렉터리 안의 빈 파일뿐이고 테스트
종료 시 `fs.rmSync` 로 지운다. 저장소에 fixture 를 남기지 않고, UTF-8 청크 회귀는 메모리 안 `Buffer` 만
쓰므로 파일을 만들지 않는다.
