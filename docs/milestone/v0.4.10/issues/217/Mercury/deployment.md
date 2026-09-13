# #217 Render 외부 테스트 배포

2026-09-13 15:41 KST. CJ가 digit-duel 포함 주소 생성·배포를 승인했고, 사용자 직접 로그인 후 root가 GitHub 연결과 서비스를 생성했다. 개인정보·인증정보는 기록하지 않는다.

- 공개 URL: https://digit-duel-mipa.onrender.com
- 서비스: digit-duel / srv-daj498mq1p3s73a31s3g, Free, Singapore, 단일 Node 인스턴스.
- GitHub source: ChangjoSung/Digit-Duel, feature/217-public-authority, e335cba94c19aef434b32e4bbd0c346eb5db7c63.
- 통합 Draft PR: https://github.com/ChangjoSung/Digit-Duel/pull/219 (base milestone/v0.4.10). 필수 CI6 전부 SUCCESS 확인.
- root directory 비움(저장소 전체), build npm ci --prefix server, start npm start --prefix server, health /healthz, auto-deploy After CI Checks Pass.
- DD_AUTH_PUBLIC_DEPLOY=1, DD_AUTH_PUBLIC_HOST=digit-duel-mipa.onrender.com. PORT는 플랫폼 제공10000, 기동로그0.0.0.0:10000 확인.
- 첫 배포 dep-daj499eq1p3s73a31umg는 후보주소 digit-duel.onrender.com을 썼으므로 실제 배정주소와 달랐다. 환경변수를 실제 suffix 주소로 수정하고 재배포를 큐에 넣은 뒤 첫 배포를 2분22초에 취소했다. 잘못된 배포의 긴 health timeout을 기다리지 않았다.
- 후속 배포 로그 15:40:28 KST Your service is live, 15:40:29 실제 URL 확인. 외부 curl /healthz는 ok / HTTP200, HTML 문서 제목도 외부 브라우저에서 확인.
- 공개방 두 클라이언트·WSS·행동 수렴 독립 QA는 Saturn ctx_5bd53909c0cb에 요청했고 아직 결과 대기. 이 문서는 배포 기동 근거이며 전체 제품 QA 완료가 아니다.

무료 휴면·재시작 시 인메모리 방 소실, 공유 프록시 연결/대기방 한도는 Jupiter/deploy-readiness.md 및 Mercury/wan-deploy-qa.md 참조. 현재 주소는 feature 브랜치 외부 테스트 배포다. PR 병합·브랜치 정리 전에 Render source branch를 새 배포 기준으로 전환해야 한다. main 출시·마일스톤 완료를 주장하지 않는다.