# #217 WAN/Render 배포 준비도 — Jupiter_Server

기준일: 2026-09-13 (Asia/Seoul). 범위: `server/**`(authoritative 전용) 코드·설정·테스트·본 문서. **실제 Render
계정 로그인·서비스 생성·구매·DNS·GitHub 연동은 하지 않았다** — 그 실행은 root(PD/Mercury 세션)가 맡는다.
CJ가 실배포와 `digit-duel` 계열 도메인 생성을 이미 승인했다는 통지를 받았다(2026-09-13 06:05 UTC, root
메시지). 이 문서는 그 실행 전에 필요한 코드/설정 쪽 선결 조건과 남은 입력값을 정리한다.

**갱신(2026-09-13, 같은 날 root 지적 반영)**: root가 Render 대시보드에 이미 로그인해 GitHub 소스를
연결했고, 저장소 루트를 Root Directory로 둔 채 `npm ci --prefix server` / `npm start --prefix server`
로 서비스를 준비 중이며 배포는 CI 통과 후(after-CI-pass)로 건다고 보고했다 — 아래 "기동 명령"·
`render.yaml`을 이 실제 접근에 맞춰 고쳤다. 또한 이전 버전이 "공개 방 기능이 클라이언트 도메인 거부로
막힌다"고 적은 것은 코드를 다시 확인한 결과 **틀린 주장**이었다 — 아래 "요약"에서 정정한다.

## 요약 (확정/추론/미확정 구분)

- **[확정]** `server/authoritative/server.js` 는 배포 전 `DD_AUTH_PORT`만 읽고 플랫폼이 주입하는 `PORT`를
  무시했다 — Render는 자체 `PORT`를 주입하고 앱이 그 포트를 듣지 않으면 헬스체크가 통과할 수 없다.
  이번 변경으로 `DD_AUTH_PORT`(명시하면 우선, 기존 로컬/LAN 문서·실행기 보존) → `PORT`(플랫폼 주입) →
  `8081`(기본) 순으로 해결한다. 릴레이(`server/server.js`)는 이미 `process.env.PORT`를 직접 썼으므로
  이번 변경 대상이 아니다.
- **[확정]** 소켓 피어 IP 기반 허용(`peerAllowed`)은 "같은 공유기"(LAN) 전제다. 리버스 프록시 뒤에서는
  소켓의 직접 피어가 항상 플랫폼 엣지이지 실제 클라이언트가 아니므로 이 판정을 재사용할 수 없다.
  `DD_AUTH_PUBLIC_DEPLOY=1` 명시 옵트인을 신설해 `peerAllowed`가 피어 IP 검사를 건너뛰게 했다 —
  이 축은 `DD_LAN`(같은 공유기 신뢰)과 별개이며 서로 대체하지 않는다. 이 모드의 실질 경계는 Host
  허용 목록·Origin 동일 출처 검사·좌석 토큰이다(둘 다 peerAllowed 통과 여부와 무관하게 그대로 동작).
- **[확정]** 기존 `DD_AUTH_PUBLIC_HOST`(Host 허용 목록에 추가)에는 형식 검증이 없었다 — 스킴·포트·경로가
  섞이거나 사설/루프백 주소를 잘못 넣으면 "설정했는데 모든 요청이 400(bad host)"인 조용한 고장이 된다.
  `S.validatePublicHost`를 신설해 기동 전 fail-closed 한다(`resolveBindAddress`와 같은 원칙). 이 검증은
  `DD_AUTH_PUBLIC_DEPLOY` 여부와 무관하게 `DD_AUTH_PUBLIC_HOST`가 설정되면 항상 적용된다.
- **[정정 — 2026-09-13 root 지적, 이전 버전의 이 문서가 잘못 주장했던 항목]** 이전 버전은
  `demo/index.html`의 `netParseAddr()`(도메인 이름을 거부하고 `localhost`·사설/링크로컬 IP 리터럴만
  허용, `:5268-5296`)가 공개 방 기능의 기본 접속까지 막는다고 적었다 — **틀렸다.** 실제로 공개 방
  (생성·목록·참가·재개)은 전부 `netOpenCredentialSocket()`(`:5377`) 한 곳만 거치며, 그 함수는
  `netPublicAddr()`(`:5373` = `location.host`)에 `location.protocol` 기준으로 `ws:`/`wss:`만 붙일 뿐
  `netParseAddr()`를 전혀 호출하지 않는다(호출부는 `:5172`·`:5963` 두 곳뿐이고 둘 다 `netPrepare()`·
  `window.netConnect()` — **구 코드 접속 릴레이**(수동 주소 입력, `server/server.js` 8080 전용) UI다).
  즉 **도메인 이름 거부는 그 구 릴레이 UI에만 적용되는 의도된 설계**(`server/README.md` "클라이언트
  쪽 목적지 제한 (#63)")이고, 공개 방/authoritative 서버 경로와는 무관하다 — Render 같은 도메인 배포에서
  공개 방 접속이 막힐 근거가 이 코드에는 없고, 이를 풀기 위한 클라이언트 수정이나 별도 CJ 승인도
  필요하지 않다. `Jupiter/analysis.md` §2.1의 "배포 빌드 한정 도메인 리터럴 허용 분기" 제안은 구
  릴레이(§1.9 클라이언트 코드 접속)를 WAN에 여는 시나리오에 대한 것이었지, 서버 권위 공개 방 경로를
  가리킨 것이 아니었다 — 두 경로를 섞어 인용한 것이 이전 버전의 오류였다. **남은 것은 코드 차단이
  아니라 실측 검증**이다: 이 경로가 실제 인터넷 클라이언트 ↔ Render 배포 사이에서 브라우저로 끝까지
  동작하는지는 이 세션에서 관측하지 못했다 — 실배포 후 root/CJ가 실제 접속으로 확인해야 한다.
- **[추론]** Render Web Service는 무료 인스턴스 1개, 고유 `onrender.com` 서브도메인 + 관리형 TLS를
  제공한다(Mercury `hosting-evidence.md` §2·§3, 공식 문서 인용 포함). 최근 정책 변경(2026-02-24)으로
  수신 WebSocket 메시지도 15분 휴면 타이머를 늦춘다 — "연결만 열려 있음"과 "메시지 수신"은 다르다.
  이 서버의 30초 주기 `ws.ping()`이 그 판단 기준에서 어느 쪽으로 잡히는지는 이 세션에서 실측하지
  않았다 — **[미확정]**.
- **[확정, 범위 밖으로 유지]** 방 상태는 프로세스 메모리에만 있다(`Lobby`/`Room`). 재배포·재시작·(관측된)
  휴면 재개 시 진행 중이던 경기는 전부 사라진다. 영속화·수평 확장(방 어피니티·공유 스토어)은 이번
  변경에 넣지 않았다 — CJ 태스크 범위 지시와 기존 `analysis.md` §2.7/§2.10 결론(2단계 과제) 그대로다.

## 변경한 것 (server/** 만)

| 파일 | 변경 |
| --- | --- |
| `server/authoritative/server.js` | `PORT` 폴백, `DD_AUTH_PUBLIC_DEPLOY` 신설, `peerAllowed` 옵트인 분기, `DD_AUTH_PUBLIC_HOST` 형식 검증 연결, 기동 fail-closed 3종 추가, 콘솔 안내 문구, 테스트용 export 4종(`peerAllowed`·`PUBLIC_DEPLOY`·`PUBLIC_HOST`·`LAN_OPT_IN`·`PORT`) |
| `server/security.js` | `validatePublicHost` 신설(순수 함수, I/O 없음) |
| `server/authoritative/test/test-public-deploy.js` | 신규 — 판정 단위 테스트 + 기동 fail-closed/성공 + 프록시 뒤 Host/Origin 통합 검증 |
| `server/authoritative/test/test-http-static.js` | 기본 포트 정규식 어서션을 새 폴백 체인에 맞게 갱신(동작 자체는 안 바뀜, 리터럴 인접성만 깨짐) |
| `server/test-security.js` | `validatePublicHost` 단위 케이스 10종 추가 |
| `server/package.json` | `test:authoritative` 체인에 새 테스트 추가 |
| `server/README.md` | "공개 배포(WAN) 옵트인" 절 신설 — 환경 변수·기동 예시·프록시 IP 한도 주의·클라이언트 차단 요인 상호 참조 |
| `render.yaml` (repo root) | Render Blueprint 설계도. **이 파일 자체가 실행된 증거는 없다** — root는 대시보드에서 직접 서비스를 구성 중이라고 보고했다(저장소 루트 + `--prefix server`, CI 통과 후 배포). 이 파일은 그 실제 접근과 같은 결과가 나오도록 `buildCommand`/`startCommand`/`autoDeployTrigger`를 맞춘 참고용이며, root가 Blueprint 경로를 쓰기로 하면 그대로 쓸 수 있다 |

기존 로컬/LAN 릴레이(`server/server.js`) 코드는 건드리지 않았다. 기존 로컬/LAN 인증 서버 기본 동작도
바뀌지 않는다 — 새 옵트인 두 개(`DD_AUTH_PUBLIC_DEPLOY`, 그리고 이미 있던 `DD_AUTH_PUBLIC_HOST`의
형식 검증 강화)는 모두 미설정 시 기존 그대로다.

## 실제 검증한 것 (이번 세션에서 실행)

- `npm test`(server/) 전체 — 릴레이·보안·설정·실행기·정적 예산·authoritative 전 스위트(신규 포함) 전부
  통과, 종료 코드 0. 기존 로컬/LAN 회귀에 회귀 없음.
- `npm ci`(server/, 격리된 스크래치 디렉터리) — 커밋된 `package-lock.json`으로 클린 설치 성공(`ws` 1개
  패키지 추가, 4초).
- `npm start`를 Render 방식 환경(`PORT=0`(임의 포트로 대체 검증) `DD_AUTH_PUBLIC_DEPLOY=1
  DD_AUTH_PUBLIC_HOST=<가상 도메인>`)으로 실제 기동 → `/healthz` 200, 리버스 프록시가 원본 Host/Origin을
  그대로 전달했다고 가정한 요청 200, 허용 목록 밖 Host 400, Host는 맞지만 다른 Origin 403, 임의
  `X-Forwarded-For`를 얹어도 결과 불변(신뢰하지 않음을 확인) — 전부 기대대로.
- 잘못된 설정의 fail-closed: `DD_AUTH_PUBLIC_DEPLOY=1` + `DD_AUTH_PUBLIC_HOST` 없음, `DD_AUTH_PUBLIC_HOST`에
  스킴/포트/사설 주소 혼입 — 네 경우 모두 종료 코드 1, `listen` 하지 않음, 원인이 stderr에 남음.
- `render.yaml`을 PyYAML로 파싱해 문법·구조를 확인했고(Render Blueprint 스펙 공식 문서 재확인 —
  `autoDeployTrigger`가 폐기된 `autoDeploy` 불리언을 대체한 필드로 `commit`/`checksPass`/`off`를 받는 것,
  `envVars`는 `key`/`value` 형태인 것 포함), `runtime: node`/`buildCommand: npm ci --prefix server`/
  `startCommand: npm start --prefix server`/`healthCheckPath: /healthz` 조합을 **저장소 루트에서 직접
  실행해** 이 저장소의 실제 진입점과 일치하는지 확인했다(아래 두 명령 모두 실행·성공, 후자는 `/healthz`
  200까지 확인) — root가 보고한 실제 대시보드 설정(루트 디렉터리 그대로 + `--prefix server`)과 같은
  형태다. `region`(추론)·`autoDeployTrigger: checksPass`(root 보고 "after-CI-pass"와 일치)는 문법
  확인만 했고 Render 서버에 실제로 적용해보지는 않았다.

## root(PD/Mercury)가 확인·입력해야 하는 것 — 실배포 직전 체크리스트

1. **실제 배정 도메인** — `render.yaml`의 `DD_AUTH_PUBLIC_HOST: digit-duel.onrender.com`은 후보값이다.
   서비스 이름 `digit-duel`이 이미 다른 사용자에게 있으면 Render가 접미사 붙은 다른 서브도메인을
   배정할 수 있다. **실제 배정된 주소로 이 값을 맞추지 않으면 모든 페이지 요청이 400(bad host)이 된다**
   — 서버는 정상 기동한 것처럼 보이므로 이 불일치는 헬스체크만으로는 드러나지 않는다.
2. **실제 접속 확인** — 위 "요약"에서 정정한 대로, 공개 방 경로는 도메인 이름으로 코드상 막히지
   않는다. 그래도 이 세션은 실제 인터넷 클라이언트가 Render 배포 도메인으로 브라우저에서 끝까지
   접속·대전하는 것을 관측하지 못했다 — 실배포 후 root/CJ 플레이 QA에서 처음부터 끝까지(방 생성→
   목록→참가→대전) 확인해야 한다. `netParseAddr()`의 도메인 거부는 구 코드 접속 릴레이(8080) UI에만
   적용되는 별개 기능이라 이 확인 대상이 아니다.
3. **Render 계정 실행 자체** — 로그인, 서비스 생성, Blueprint 적용 또는 수동 생성, 환경 변수 입력,
   빌드/기동 확인, 실제 배정 도메인 확인. 전부 root 몫이며 이 작업에서 실행하지 않았다.
4. **region 선택** — `render.yaml`의 `region: singapore`는 한국 사용자 지연을 노린 추론이며 실측 근거가
   없다(Mercury `hosting-evidence.md`의 미확인 항목과 동일). 근거 있는 값이 있으면 교체한다.
5. **휴면/WS 메시지 상호작용 실측** — 위 "미확정" 항목. 실제 배포 후 30초 heartbeat ping이 휴면을
   늦추는지, 유휴 15분 후 재접속 지연이 실제 얼마인지는 이 세션에서 관측하지 못했다 — 실배포 시
   root/CJ 플레이 QA에서 관측해 문서에 채워 넣어야 한다.
6. **인메모리 상태 트레이드오프 재확인** — 배포/재시작 시 진행 중 경기가 사라진다는 것을 실제 배포
   공지·CJ 승인 범위에 다시 한 번 명시할 것을 권고한다(이미 알려진 사실이나, 실사용자에게 노출되는
   시점에 재확인 가치가 있다).

## 기동 명령 (정확한 재현 — root의 실제 접근과 동일한 형태)

저장소 루트에서 그대로 재현 가능(실제 Render 서비스 없이 검증용, 이번 세션에서 실행·확인함):

```
npm ci --prefix server
DD_AUTH_PUBLIC_DEPLOY=1 DD_AUTH_PUBLIC_HOST=<확인된 도메인> PORT=<플랫폼이 줄 값> npm start --prefix server
curl http://127.0.0.1:<PORT>/healthz     # -> 200 ok
```

root가 보고한 실제 Render 대시보드 설정(Root Directory = 저장소 루트, Build/Start Command에
`--prefix server`)과 같은 형태다. `render.yaml`(Blueprint, 참고용)도 같은 `buildCommand`/
`startCommand`/`healthCheckPath`를 선언하도록 맞췄다. `PORT`는 Render가 자동 주입한다고 공식 문서가
설명하므로 `render.yaml`·위 예시 어디에도 값을 넣지 않았다 — "직접 지정하면 Render가 무시한다"는
이전 버전의 문구는 검증하지 않은 단정이라 지웠다.

## 남은 트레이드오프 재확인 (server/README.md와 동일 내용 요약)

- 리버스 프록시 뒤에서는 소켓 피어(`creatorIp` 포함)가 전부 같은 주소로 보이므로, IP당 요청/연결 한도
  (`DD_AUTH_MAX_CONNECTIONS`·`DD_AUTH_MAX_CONNECTIONS_PER_IP`·정적 서빙 토큰 버킷·`AttemptLimiter`·
  `Lobby.maxOpenPublicPerIp`)가 이 인스턴스에 붙는 모든 실제 사용자가 나눠 쓰는 **공유 한도**가 된다.
  런타임을 임의로 완화하지 않고 현재 코드 기본값을 그대로 적으면: 동시에 열려 있는(대기 중) 공개
  방은 **인스턴스 전체 통틀어 2개**(`maxOpenPublicPerIp`, 기본값 — 서로 다른 사용자 둘이 각자 방을
  열면 셋째 사용자의 "새 방 만들기"부터 거부된다), WebSocket 동시 연결 전체 64·공유 한도당 8, 정적
  HTTP 버스트 288 토큰(초당 96 회복), WS 업그레이드 분당 60회, 인증 실패 5분에 10회로 차단. 한 사용자가
  한도를 소진하면 다른 사용자도 일시적으로 막힐 수 있다 — 이것은 가용성 저하이지 인증 우회가 아니다
  (Host·Origin·좌석 토큰 검사는 그대로 살아 있다). `X-Forwarded-For`로 원 클라이언트 IP를 복원해 한도를 사람 단위로
  세분화하는 방법은 프록시가 그 헤더를 조작 불가하게 덮어쓰는지 확인되지 않아 **이번 변경에 넣지
  않았다** — 검증되지 않은 헤더를 신뢰 경계로 쓰면 스푸핑으로 한도·차단 로직을 우회당할 수 있다.
  안전한 최소 대응은 문서화 + 기존에 이미 env로 조정 가능한 한도값 상향 검토이며, 새 신뢰 메커니즘을
  넣지 않는 쪽을 택했다(과설계 회피 지시와도 일치).
- 무료 인스턴스는 workspace 전체 월 750시간, 유휴 15분 시 휴면(2026-02-24부터 수신 WS 메시지도 지연
  요인) — Mercury `hosting-evidence.md` §3 그대로.
