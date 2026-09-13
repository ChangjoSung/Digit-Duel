# #217 공개 룸·호스팅 후속 — Mercury 공식 자료 확인

기준일: 2026-09-13 (Asia/Seoul). [결정] 서버 권위 전환 승인. [피드백/질문] 초대 코드 대신 공개 방 목록·자유 입장 의도와 구현 가능성, 공동작업자 호스팅 코멘트 분석.

이 문서는 Mercury가 수집한 공식 서비스 조건과 운영 판단 근거다. 게임/서버 아키텍처 판단은 [Jupiter 독립 분석](../Jupiter/public-rooms-analysis.md), 기획·결정 반영은 [Venus 기록](../Venus/public-lobby-update.md)이 담당한다. 이전 비공개 초대 코드 번들은 승인된 요구사항이 아니며, 이번 CJ 지시에서 서버 권위 방향만 명시적으로 확정됐다.

## 공동작업자 코멘트 검증

| 코멘트 | 판정 | 근거와 적용 한계 |
|---|---|---|
| 도메인을 따로 구매해야 한다 | 필수라는 뜻이면 틀림 | 제공업체 주소를 사용할 수 있다. ngrok은 할당 개발 도메인, Render는 onrender.com 하위 도메인을 제공한다. 브랜드 도메인 구매는 별도 선택이다. |
| 도메인 없이 IP로 연결할 수 있다 | 조건부로 맞음 | 공인 IP 도달성·방화벽·포트·브라우저에서 신뢰되는 HTTPS/WSS가 필요하다. Let's Encrypt의 IP 인증서도 현재 정식 지원된다. 일반적인 로컬 사설 IP를 인터넷에 그대로 적는 것과 다르다. |
| 서버 비용은 반드시 발생한다 | 자원/운영 비용과 현금 결제를 구분 | 서버를 실행하는 컴퓨터·회선·운영은 필요하지만 기존 PC·무료 호스팅 할당량으로 추가 서비스 결제 없이 테스트할 수 있다. 무료가 상시 운영·무제한 용량을 보장하지는 않는다. |
| ngrok 무료 외부망 개방은 테스트에 좋다 | 적절한 후보 | 기존 컴퓨터에서 실행 중인 서버에 외부 통로를 붙인다. 게임 서버 자체를 대신 실행하지 않는다. 할당량·PC 가동·회선·지연을 고려해야 한다. |
| HTML 게임 포털이 주소를 제공하니 비용이 없다 | 게임 파일 호스팅에는 가능, 대전 서버까지 일반화 불가 | CrazyGames는 공식 FAQ에서 멀티플레이 서버를 제공하지 않는다고 명시한다. itch.io의 HTML 업로드는 파일/iframe 호스팅이다. 공동작업자가 특정한 사이트 이름은 아직 확인되지 않았다. |

## 1. ngrok 공식 조건

- Free: 할당 개발 도메인 1개, 온라인 endpoint 최대 3개, 월 outbound 1GB, HTTP 요청 20,000회. 요청률 상한은 월 할당량과 별도로 존재한다.
- 무료 HTTPS와 자동 TLS 인증서를 제공한다. 문서의 'TLS endpoints 불가'는 직접 종단하는 raw TLS endpoint를 뜻하며 무료 HTTPS/WSS 불가가 아니다.
- HTTP endpoint가 WebSocket을 지원하고 같은 포트에서 HTTP와 WS를 함께 서비스할 수 있다. 외부에서는 WSS를 사용한다.
- endpoint는 서비스의 외부 입구이며 게임 방·동접 인원 수가 아니다. 하나의 endpoint 뒤에서 여러 룸을 처리하는 것은 서버 애플리케이션 설계에 달린다.
- 무료 endpoint 자체의 강제 시간 만료는 없지만 할당량과 origin 컴퓨터의 가동 상태는 별도다. HTML 방문자에게 안내 중간 화면이 표시될 수 있다.
- 20,000 HTTP 요청을 20,000 게임 행동/경기라고 계산하지 않는다. 실제 WS 전송량·정적 자산 다운로드를 측정해야 월 경기 수를 추정할 수 있다.

출처: [무료 한도](https://ngrok.com/docs/pricing-limits/free-plan-limits), [WebSocket 지원](https://ngrok.com/docs/using-ngrok-with/websockets), [요금표](https://ngrok.com/pricing).

## 2. 도메인·IP·TLS

- 2026-01-15부터 Let's Encrypt IP 주소 인증서가 정식 제공된다. IPv4·IPv6를 지원하며 유효기간은 160시간이다. 짧은 유효기간에 맞는 자동 갱신이 필요하다.
- 따라서 'HTTPS에는 반드시 구매한 도메인이 필요하다'는 판단은 현재 사실과 다르다. 다만 제공업체 하위 도메인+관리형 TLS가 초기 운영을 단순하게 할 수 있다는 것은 권고다.
- Render Web Service는 고유 onrender.com 주소와 관리형 TLS를 제공한다. 직접 구매 도메인을 추가하는 것은 선택이다.

출처: [Let's Encrypt IP 인증서 정식 제공](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability), [Render Web Services](https://render.com/docs/web-services).

## 3. 실제 백엔드 무료/유료 예시 — Render

- 무료 Node.js Web Service가 존재하므로 테스트 단계에서 별도 서버 구독료가 반드시 필요한 것은 아니다.
- 무료 instance 시간은 workspace 전체 월 750시간. inbound HTTP 요청 또는 기존 WebSocket 메시지가 15분간 없으면 휴면한다. 다시 접속하면 기동에 약 1분이 걸릴 수 있고 서비스가 임의로 재시작될 수도 있다.
- 2026-02-24 변경 이후에는 수신 WebSocket 메시지도 휴면을 지연시킨다. 단순히 연결만 열려 있는 것과 메시지를 수신하는 것은 구분한다.
- 현재 요금표의 소형 유료 compute 예시는 0.5c-512mb(이전 이름 Starter) 월 US$7이다. 이는 전체 비용 견적이 아니다. workspace 요금·초과 전송량·추가 저장소·세금 등은 사용 구성에 따라 달라진다. 성능/동접 보장도 아니다.
- 인메모리 경기 상태를 쓰는 경우 휴면·재시작·배포와 경기 지속성이 충돌하므로 Jupiter가 제안한 서버 세대/무효 처리 정책과 함께 판단해야 한다. 유료 플랜도 프로세스 교체 때 WS 연결과 경기 상태가 자동 보존되는 것은 아니다.

출처: [무료 서비스 조건](https://render.com/docs/free), [WS 휴면 변경 공지](https://render.com/changelog/free-web-services-now-remain-active-while-receiving-websocket-messages), [요금표](https://render.com/pricing), [Compute 사양](https://render.com/docs/compute-plans), [WS 종료/재개 조건](https://render.com/docs/websocket).

## 4. HTML 게임 포털

- itch.io는 HTML/JS/CSS와 자산을 업로드해 iframe 안에서 실행한다. 외부 API/자산 연결에는 HTTPS가 필요하다. 이는 임의의 Node.js 권위 서버를 무료로 계속 실행해준다는 서비스 설명이 아니다.
- CrazyGames는 파일/CDN 호스팅을 제공하지만, 멀티플레이 서버는 개발자가 별도 해결해야 한다고 공식 FAQ에 명시한다. 초대 링크 SDK나 클라우드 저장 기능이 있다는 것만으로 게임 판정 서버 제공이라고 판단하지 않는다.
- 일부 다른 업체가 무료 멀티플레이 할당량을 제공할 가능성은 있으나, 구체적인 플랫폼·실행 모델·할당량·약관 확인 없이 이 프로젝트의 상시 서버비를 0원이라고 확정할 수 없다.

출처: [itch.io HTML5 업로드](https://itch.io/docs/creators/html5), [CrazyGames 멀티플레이 서버 FAQ](https://docs.crazygames.com/faq/#do-you-provide-a-server-for-multiplayer-games).

## 운영 권고와 미확정

도메인 구매를 선행 조건으로 두지 않는다. 외부 테스트는 기존 PC+ngrok 또는 무료 백엔드가 후보이고, PC 없이 상시 운영하려면 관리형 유료 소형 서버를 별도 검토한다. 게임 포털은 배포/파일 호스팅 후보로 평가하며 권위 서버의 대체물로 간주하지 않는다. 어느 후보도 이번 보고에서 가입·결제·외부 개방하지 않았다.

아직 실측하지 않은 값: 경기당 전송량, 동시 룸별 CPU·메모리, 한국 사용자 실제 지연, 연결 안정성, 월 총 비용. 공동작업자 추천 포털의 정확한 이름도 미확인이다. 따라서 구독료 예시와 서비스 조건을 제시하되 전체 비용·용량·일정을 확정하지 않는다.
