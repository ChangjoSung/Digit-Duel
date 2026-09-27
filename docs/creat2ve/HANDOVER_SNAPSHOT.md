# Digit-Duel — 인수인계 스냅샷

## 최신 체크포인트 — 2026-09-27 22:12 KST #261 CJ QA PASS·Git 정리 승인·#262 규칙 확정

- **#259**: CJ 최종 로컬 QA PASS와 커밋·PR 작성 승인에 따라 b865133 제품 커밋, 실제 원격 milestone bd4c90c 통합24945b7, 권한·QA·화면 기록68863dc를 feature에 push했다. [PR #269](https://github.com/ChangjoSung/Digit-Duel/pull/269)는 검토 가능 상태이며 최종 HEAD68863dc 필수 CI6/6 PASS(run36306785458). fresh Saturn 통합 LOCAL PASS(live46/runtime74), 파일 수정0. 단일 inline probe exit1은 정상 null 기대값 오류이며 그 뒤 privacy 단언 미실행을 원장에 보존했다. HTTPS/Render 검증은 남아 있고 마일스톤 병합·Issue close·배포는 승인되지 않았다. 계정 흐름 CJ PASS는 통합 전 검수로 구분한다. 원장은 활성 #259 Mercury/report.md 하나다.
- **#260**: CJ가 최종 플레이 QA **PASS**를 확인했다. Saturn 최종 로컬 PASS와 앞선 REVISE·수리·검사 제한은 활성 #260 Mercury/report.md 단일 원장에 보존한다. issue-260-account-lobby(HEAD24945b7)의 변경은 미커밋이며 CJ가 권장 순서 착수로 커밋·PR 작성과 필수 원격 CI를 승인했으며 #259 브랜치 기준의 분리 PR로 정리한다. milestone 병합·Issue close·배포 승인 없음. GitHub는 기존 완료 조건 한 목록에 CJ PASS만 반영한다.
- **Worker·보존·다음 작업**: 기존 완료 Worker13개 정리 뒤, CJ가 승인한 #261을 a444d57 기반 issue-261-multiplayer-lobby에서 구현했다. Venus GDD 동기화·Jupiter 서버·Mars 화면·fresh Saturn 독립 LOCAL PASS를 완료하고 네 Worker 모두 accepted 정산/release 후 정확한 terminal close(ptyKilled=true)했다. run_c1092f5b4df6 reclaimable0·#261 terminal0, QA 종료 시 동결281파일 SHA/HEAD 불변을 확인했고 이후 PD 인계 갱신 뒤 제품/도구/설정267파일도 불변이다. 실제 PG22단언 후 초기 참가 거부 timeout은 미확정 이력이며 격리13·실제Chrome320px8·마지막 별도PG 참가 거부 경계1건이 성공했다. 자세한 실패/재검사·모델 증거는 해당 트리 Mercury/report.md가 단일 원장이다. CJ 최종 QA PASS와 커밋·push·#260 기준 PR/CI 승인을 받았다. #262는6종/5초/2.5초·경기 전반 양쪽 차례·브라우저 숨김 유지가 CJ 확정돼 별도 트리에서 진행한다. 기존 QA http://localhost:8083/ · PG55461/서버PID6688/PGPID26768, /·healthz·readyz200. 기존127.0.0.1 QA와 쿠키 호스트를 분리했고 QA261 테스트 계정4개와 기존8081/8082·CJ DB/계정/SMTP/백업·dirty/untracked를 보존했다. #261 Git/CI·milestone 병합·Issue close·배포·Render 변경과 다음#262/#238은 별도 CJ 지시 범위다. 아래 날짜별 상태는 이력이다.

## 이전 기준 (2026-09-24 KST · 이력)

- 정식 출시본은 v0.4.10이며, v0.4.11 개발 트랙 `milestone/v0.4.11`의 확인된 원격 HEAD는 `e1285c153cae8d5f419a49b0415e17d35b13341a` (#237 통합)이다. 인수 시 실제 원격 HEAD와 GitHub 상태를 다시 조회한다.
- [부모 #232](https://github.com/ChangjoSung/Digit-Duel/issues/232)는 OPEN. #233·#234·#241·#235·#253·#236·#237과 구조 선행 #243·#245는 완료됐다. 남은 제품 하위 이슈는 [#238](https://github.com/ChangjoSung/Digit-Duel/issues/238)이며 OPEN·구현 미착수·CJ 별도 착수 지시 대기다.
- #253 공용 아트는 [PR #254](https://github.com/ChangjoSung/Digit-Duel/pull/254) → `750253c`, #236 경제 계약은 [PR #256](https://github.com/ChangjoSung/Digit-Duel/pull/256) → `dde2b48`, #237 온라인 권위 계약은 [PR #257](https://github.com/ChangjoSung/Digit-Duel/pull/257) → `e1285c1`로 통합·CLOSED다. #236은 CJ 플레이 QA 우선 PASS, #237은 CJ 플레이 QA PASS·병합 HEAD [CI 6/6](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35992526131)을 받았다.
- 이번 문서 갱신은 #238 착수 승인이 아니다. 승인 전 분석은 [#238 Mercury 착수 전 분석](../milestone/v0.4.11/issues/238/Mercury/prestart-analysis.md)에 있다. CJ가 범위·미결정 사항을 검토한 뒤 별도 착수 지시를 해야 최종 아트·코드·테스트·통합 PR을 시작한다.

## 권위·역할·인계

- 충돌 우선순위: CJ 최신 Comment > [CLAUDE.md](../../CLAUDE.md) > [GDD-23](https://app.notion.com/p/3dc1e7f1708580329da6fe4986654f7b)·[GDD-24](https://app.notion.com/p/3dc1e7f1708581a48421fcec63d3cdf8) 등 프로젝트 기획 > Notion 구조 정의 > 이 스냅샷 > 범용 핸드북. 미결정·제안을 확정 규칙으로 승격하지 않는다.
- Mercury는 조정·Git/GitHub·운영 문서/메타데이터만 담당한다. Venus는 기획·Notion GDD, Earth는 아트, Mars는 HTML 클라이언트, Jupiter는 서버, Saturn은 READ_ONLY 독립 QA다. Worker에게 Git을 맡기지 않으며, dispatch preflight 5필드와 한 번에 한 editor·수정 뒤 fresh Saturn·release-before-ack를 지킨다. [역할/모델 계약](WORKER_MODELS.md)을 확인한다.
- 제품 변경은 한 이슈·통합 PR 한 개, 트랙 직접 커밋 금지, exact file staging·diff check·새 HEAD 필수 CI A/B/B2/C/D/E 6/6·CJ 플레이 QA 후 squash merge다. 이슈·PR·커밋 제목과 PR·커밋 본문은 한국어(기술 식별자 제외)로 작성한다.
- 원본 작업공간 `C:\Users\pc_77\orca\Digit-Duel`의 사용자 변경·미추적 파일은 보존한다. 해당 체크아웃에서 수정·stage·pull·switch·reset·clean을 하지 않고, 독립 Orca 작업공간에서 문서 작업한다.

## #238에 넘길 확정 계약과 남은 결정

- #253은 CJ의 화면·공용 아트 **방향** 승인을 받았다. [Venus 흐름 보고](../milestone/v0.4.11/issues/253/Venus/report.md)·[Earth 자산 보고](../milestone/v0.4.11/issues/253/Earth/report.md)와 GDD-24 00.1~00.10을 입력으로 삼되 개별 모션 수치·새 기능까지 승인된 것은 아니다.
- #236 상점은 구매한 진열 칸을 새로 고침까지 비우고, 시작·정기 상점에서 자기 시너지 현황을 표시한다. 시작 상점 여섯 번째 필수 하수인은 유료 새로 고침 🪙1로 확보하며, 예비 재화와 시간 초과 자동 새로 고침을 유지한다. 핫시트 상점은 각자 자기 화면이 보이는 때부터 90초다.
- #237은 서버 권위 거래·타이머 정지/재개·좌석별 비공개 상태·상대 단절 표시 필드를 제공한다. 경제 방 SETUP의 자발적 나가기/기권은 승자 없는 취소, IN_PROGRESS의 기권은 상대 차례·상점·단절 정지 중에도 즉시 패배다. 이는 현행 서버 계약이므로 GDD-24 00.10의 오래된 '미결정' 행과 Venus가 대조해야 한다.
- #238은 기존 Core·서버 규칙을 다시 만들지 않고 T/L/S/M/B/X 화면 전이, 상점·가방·전투 HUD와 연출, 숨은 정보, 핫시트 가림, 접근성을 연결한다. 레드닷 위치/해제, S01 상품 숨김/Dim, 로딩/결과 화면, 모션 제안값, OPEN→SETUP 표시 등은 [착수 전 분석](../milestone/v0.4.11/issues/238/Mercury/prestart-analysis.md)의 CJ/Venus 결정 게이트를 따른다.
- 로그인·채팅·자동 매치·캠페인·고정 75% 로딩·배치/행동 타이머 등 계약 없는 스케치 요소는 구현 범위가 아니다. Roblox·Unity 포팅도 #238 범위가 아니다.

## 다음 Mercury PD 동작

1. [CLAUDE.md](../../CLAUDE.md), [권위 문서 등록표](AUTHORITY.md), [모델/Skill 계약](WORKER_MODELS.md), [#238 분석](../milestone/v0.4.11/issues/238/Mercury/prestart-analysis.md), GDD-23·24 및 #232/#238 최신 본문과 원격 HEAD를 읽어 이 스냅샷과 대조한다.
2. CJ에게 #238 실행 범위와 미결정 선택지를 보고하고 착수 승인 여부를 받는다. 답변 전에는 #238 최종 아트·코드·테스트·PR을 만들지 않는다.
3. 승인 후에는 Venus의 계약 정리, Earth/Mars의 소관 작업, Saturn 독립 QA, CJ 플레이 QA, Mercury 통합 순서로 #238을 진행한다. #232는 #238 종결 뒤에도 통합 회귀·관측·최종 CJ 승인 전까지 OPEN이다.
