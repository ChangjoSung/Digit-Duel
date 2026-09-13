# #217 / #218 v0.4.10 진행 보고

2026-09-13 15:56 KST. [결정] CJ 승인에 따라 공개방 서버·기존 게임 규칙·아트 복구·모바일 설명·위치교환 동기화를 구현하고 Render 외부 테스트 서버를 배포했다.

## 배포와 GitHub

- URL: https://digit-duel-mipa.onrender.com — Render Free/Singapore, 서버와 HTML 동일 출처. 외부 health HTTP200, HTTPS/WSS 공개방 생성·목록·참가·준비·행동·기권 상태 수렴을 Saturn이 확인했다.
- PR: https://github.com/ChangjoSung/Digit-Duel/pull/219 → milestone/v0.4.10. e335cba에서 필수 CI6 SUCCESS. 최종 전투기록 정리 수정과 증빙은 후속 커밋·CI·배포로 반영한다.
- main 출시·마일스톤 완료·CJ 휴대폰 플레이 QA·이슈 종료는 아직 하지 않았다. Render는 feature/217-public-authority를 구독한다. 브랜치를 삭제하기 전에 배포 소스 전환이 필요하다.

## QA 근거

| 범위 | 결과 |
|---|---|
| 서버 규칙/좌석정보/아트 표시/FX/public-view/WAN 설정 | Saturn 독립 검수 PASS, 아래 개별 보고 참조 |
| 실제 Edge 2클라이언트 대국·재접속 | run_pub6 20/0, 전투 중 TCP 단절 후 복귀·입력잠금·안내·자연 종료 |
| 모바일 기술 설명 | 432px 실제 ⓘ 클릭·설명닫기·44px·aria·revision무변경 PASS, PC title 보존 |
| 위치교환 동기화 | 구현자 실제WS VM tele52/flee7; Saturn 독립 tele35/flee5 후40회 일치·진행; 표적 브라우저 fleeSwap8/fleeSkip5/teleSwap1 후14회 일치·진행,16/0 |
| 전투 아트 | 기존 원본 무대/스프라이트/HP·KO·모달 복구, root 및 Saturn 실제 스크린샷 확인 |
| 남은 독립 재검수 | battle snapshot 정리 정규식 오타 수정과 보호중인 이벤트 보존, 일반Edge 외부시작버튼 확인 |

Mars 최종 구현 완료 msg_6b189466cc9c, index SHA256 8f5fc2b4338e144841a7fccc258228bf5a2406d9237cbe8796bdf54c6ca873c4, FX52/0·publicrooms143/0. Mars와 Jupiter는 산출물 보관 후 released. Saturn 후속 ctx_87bffe8f5f34만 검수 중이다.

## 시간·한계

지연 원인은 표시 계층 누락 재작업, 헤드리스 결과와 실제화면의 차이, 재접속 push 폐기, 조정 메시지 처리 지연, 무작위 대전에서 교환 조건 미도달이었다. root의 배포 검증·통합 착수도 늦었다. 중간 커밋/PR로 CI와 배포를 병행하고, 문서를 한 페이지로 줄이고, 교환 표적시험·변경 경계 재검수로 전체대전 반복을 줄였다.

CJ 제공 계정 사용률12%와 목표20%는8%p 여유를 뜻하지만 root가 계정 사용률을 조회할 수 없어 준수를 보장하지 않는다. 무료 휴면/재시작 시 방 소실, 프록시 공유 한도, 브라우저 텔레포트 표본1회와 일부 표시연출 한계는 숨기지 않는다. 후속 실제 휴대폰 플레이 확인 전 미검증 완료/종결을 주장하지 않는다.

## 문서 반영 위치

| 내용 | 근거 |
|---|---|
| 배포 주소·실행 설정·이력 | [deployment.md](deployment.md) |
| WAN 독립 QA | [wan-deploy-qa.md](wan-deploy-qa.md) |
| 클라이언트 QA/잔여 | [client-qa-final.md](client-qa-final.md) |
| 서버 원본·FX·공개정보 | [server-qa-v4.md](server-qa-v4.md), [fx-qa-v3.md](fx-qa-v3.md), [public-view-qa.md](public-view-qa.md) |
| 구현·화면 증거·명령 | [Mars/report.md](../Mars/report.md) |