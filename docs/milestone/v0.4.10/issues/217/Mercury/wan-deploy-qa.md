# #217 WAN 배포 delta 독립 QA

2026-09-13 15:28 KST. 最終更新: Saturn task_4eea9a5170b5 / ctx_9bd8ef28afc8, 최종 msg_7b5e93bc88d5. 파일 수정 0, 외부 서비스 작업 0. 검수 완료 outcome succeeded는 제품 PASS와 다르며 판정은 REVISE다.

- public-deploy 27/27, HTTP static 24/24, 관련 security 검사 통과.
- 프록시 헤더 위조/좌석 credential 관련 독립 음성 검사 6건 통과.
- HTTPS 도메인 공개방 클라이언트가 location.host의 wss 주소를 여는 것 확인. 구 릴레이 netParseAddr 제한은 공개방 차단 근거가 아니다.
- 서버/보안/테스트/blueprint/문서의 검수 전후 SHA-256 동일. 보고 접두사: AC93FE / 1BC878 / 4D81E1 / A51477 / DBB782.

## 수정 요청

1. render.yaml의 rootDir: server는 demo/test/shared/harness.js를 배포에서 제외하여 엔진 기동이 실패한다. rootDir 생략 및 npm ci --prefix server / npm start --prefix server로 변경한다. [Render 공식 monorepo 문서](https://render.com/docs/monorepo-support)는 root 밖 파일이 빌드·실행 시 제공되지 않는다고 명시한다. 실제 root 대시보드 폼은 이미 저장소 전체를 선택했다.
2. render.yaml·server/README·Jupiter/deploy-readiness의 공개 도메인 차단 단정을 정정한다.
3. 프록시 peer를 공유할 때 적용되는 한도를 빠짐없이 명시한다: HTTP burst288/refill96초당, upgrade60/refill1초당, authfail10/5분, 연결 global64/peer8, 공개 대기방 peer2. 실제 프록시 peer 분산 수는 미측정이며 사용자별 한도라고 주장하지 않는다.

Jupiter ctx_4a981d5fb550가 같은 문서정정 작업에서 반영 중. Saturn 후속 task_3d0ef351dce4 / ctx_28cbc8ad4c58는 해당 세 변경만 확인하며 런타임 hash 변경이 없으면 통과한 테스트를 반복하지 않는다. 아직 실제 Render 배포·외부 2클라이언트 QA 완료 근거는 없다.
## 최종 판정 — PASS (배포 전 코드·설정 범위)

Saturn 후속 msg_45b5f5b0ce6c, task_3d0ef351dce4 / ctx_28cbc8ad4c58. 세 수정 모두 PASS. runtime/security/test hash 접두사 AC93FE / 1BC878 / 4D81E1 유지, 수정 문서 세 파일도 검수 중 안정. 통과한 런타임 검사를 반복하지 않았다. render.yaml 11–19·51–60, README55–73, deploy-readiness30–44·132–144에서 root 전체/명령/공개방 경로/공유 한도 정정 확인. 외부 배포와 실 HTTPS/WSS·게임·health·휴면재개 검증은 여전히 미완료로 명시한다. 두 구현/검수 Worker는 출력 보관 후 released.