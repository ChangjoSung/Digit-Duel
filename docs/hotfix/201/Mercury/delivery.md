# #201 납품·운영 기록

2026-09-11 · Mercury PD. [Issue201](https://github.com/ChangjoSung/Digit-Duel/issues/201)이 PR·CI·태그·역병합 SHA와 CJ 확인의 최신 상태 원본이다. 하나의 제품 hotfix PR로 main에 반영하고 v0.4.8 패치 후 main→dev→활성 Roblox/Unity 트랙을 각각 PR merge commit으로 동기화한다. 검사 우회·보호 완화는 하지 않는다.

## 결과와 재현

기존 정적 HTTP 버스트60·초당30은 같은 IP의 겹치는 45요청 페이지 로드를 담지 못했다. 실제 구서버 두 로드90건 중29건이429였고, 구클라이언트는 일시 실패를 영구 폴백으로 남겼다. 서버를 고정288·초당96의 유한 예산으로 조정하고 파일별 재시도·마감·영구 실패 종료를 추가했다. 규칙·수치·RNG·인증·프로토콜은 유지한다.

- [서버 보고](../Jupiter/report.md): 실제 HTTP 구·신 비교, 서버 5검사 묶음과 폭주 제한·timeout·변이 대조.
- [독립 QA](qa.md): Saturn 직접 101 PASS / 0 FAIL, 소스·미디어 최종 PASS와 한계.
- [실제 브라우저 기록](../Mars/artifacts/report.json): 최종 소스 지문, 온라인 두 접속·합법 이동 동기화·복구·새로고침 등34 PASS, 다섯 사진 지문. README 보드/전투 두 사진을 교체했다.
- [v0.4.8 실행 안내](../../../releases/v0.4.8.md): 경기 종료 후 새 서버 실행, 양쪽 페이지 새로고침.

로컬 회귀 명령: `node demo/test/regression/smoke_online_art.js`, `npm test --prefix server`. README 읽기 전용 검사: `node tools/media/readme_media_capture.js verify --read-only --no-gh --no-render --manifest docs/milestone/v0.4.6/issues/122/Mars/revise-cjqa-rules/tutorial/capture-manifest.json`. 문서 링크 검사는 새 파일을 stage한 후 `node tools/docs/docs_link_check.js`로 확인한다. 실제 CI6 및 Unity 트랙 CI7의 run 링크는 Issue에 남긴다.

## 적용·되돌리기

실행 중인 사용자 서버를 임의 종료하지 않는다. 현재 경기를 마치고 구서버를 종료한 후 새 버전 `server/LAN서버시작.bat`을 실행하고 두 브라우저를 새로고침한다. 서버만 새 버전으로 바꾸면 이미 열린 구클라이언트의 실패 상태는 없어지지 않는다.

되돌릴 경우 진행 중인 경기를 마친 뒤 직전 v0.4.7 Source code를 별도 폴더에 풀어 그 서버·클라이언트를 함께 사용한다(기존 아트 결함도 되돌아간다). 저장소 롤백은 main에서 hotfix revert 브랜치와 PR을 만들고 필수 CI·패치 태그·dev 및 활성 트랙 동기화를 같은 절차로 수행한다. 보호 브랜치를 reset/force-push하거나 태그를 옮기지 않는다.

## 역할·작업 정산

Run `run_3267eb5209f4`: Mars 진단 `task_ff86200d95ed`/`ctx_4f31eef5c977` 성공, Jupiter 구현 `task_40e9ad1845f4`/`ctx_69d67cc37bdb` 성공, Jupiter 서버 검사 후속 `task_e91749c3626c`/`ctx_bb2bc20bba5d` 성공·archive/release 완료. Mars 구현 `task_b8d416234df5`/`ctx_4898f2ea6a3f`, Saturn QA `task_6d2511c41221`/`ctx_8a8d34f5c9e1`의 최종 보고·자원 반환 상태도 Issue 최종 기록에 정산한다. Saturn은 파일 수정0이며 Mercury가 인라인 결과를 보관했다. Mars의 delivery ACK 누락으로 생긴 전달 지연과 해소는 [QA 원장](qa.md)에 남긴다.

원래 Unity checkout의 사용자 미추적 파일은 보존한다. 공동작업자의 Roblox PR200(왕·동료 아트)과 Unity PR197(CI F)은 동기화 때 유지한다. 이전 Unity 작업에서 user_takeover로 보존한 터미널은 이번 작업의 해제 대상이 아니다. CJ 플레이 확인 전 Issue201은 OPEN으로 남긴다.

최종 구현 보고 msg_e090fa6cc68f 및 QA worker_done msg_165aa7f83aaf를 수락했다. Mars·Saturn 모두 succeeded이며 각 보고를 archive한 뒤 worker-release로 소유 터미널 반환을 요청했다. 구현자의 서버·Chrome·임시 프로필 정리 보고를 수락했고 사용자 서버를 재시작하지 않았다. CI 주석만 최종 파일별 예산에 맞춰 정정했으며 제품·캡처 지문은 독립 검수 때와 같다.
