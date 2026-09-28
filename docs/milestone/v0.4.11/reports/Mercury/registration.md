# v0.4.11 일정·브랜치 등록 — 2026-09-16

CJ 승인 범위는 Milestone·Issue 등록, Notion 링크 연결, 브랜치 규칙 적용이다. **구현·Issue 해결·게임 QA·시뮬레이션·배포는 별도 CJ 착수 지시 대기**다.

## Milestone·트랙

- [Milestone 15](https://github.com/ChangjoSung/Digit-Duel/milestone/15): v0.4.11 — 전투·시너지·성장·상점 개편. 기한은 CJ가 지정하지 않아 설정하지 않았다.
- 원격·로컬 추적 브랜치: `milestone/v0.4.11`.
- 분기 기준: 원격 `dev`, `654a6e2c1c36fe825d3242c0fe464df494ef4cdb`.
- 기존 작업공간의 `milestone/v0.6.0` 체크아웃과 미커밋 파일은 그대로 유지했다. 제품 커밋·PR·태그는 생성하지 않았다.
- 향후 이슈 브랜치: 트랙에서 `feature/<issue>-<slug>`, `fix/<issue>-<slug>`, `infra/<issue>-<slug>`, `doc/<issue>-<slug>`로 분기. 구현을 시작하지 않았으므로 이슈 작업 브랜치는 미리 만들지 않았다.
- 병합: 이슈 PR → 트랙은 squash, 트랙 → dev → main은 merge commit. 공유 브랜치에 직접 커밋하지 않는다.

## 보호 설정 재조회

- PR 필수, GitHub 승인 리뷰 수 0(별도 Saturn·CJ 승인 계약 유지).
- strict=true, enforce_admins=true, 대화 해결 필수.
- 강제 push·삭제 금지, 우회 허용 없음.
- GitHub Actions 앱 15368의 필수 검사 6개: A. 규칙 회귀·AI 완주 / B. 서버 / B2. Windows 실행기 / C. 문서 링크·이미지 / D. 납품 아트 / E. Roblox 클라이언트·규칙.
- `.github/workflows/ci.yml`의 기존 `milestone/v*` PR·push 범위가 적용되므로 CI 파일 변경은 없다. Unity 전용 F는 이 HTML 트랙에 추가하지 않았다.

## 부서 검토

Venus PLAN: Claude Sonnet 5 medium, requested/effective 일치. `run_cb65efe78359` / `task_37f5c084264e` / `ctx_893d64252521`. 역할 범위는 일정 등록용 기획 검토와 문서 1개 작성이며 코드·Git·외부 쓰기는 금지했다. Mercury가 GitHub·Notion 메타데이터·브랜치 등록을 담당한다.

기획 근거: [GDD-23](https://app.notion.com/p/3dc1e7f1708580329da6fe4986654f7b), [GDD-24](https://app.notion.com/p/3dc1e7f1708581a48421fcec63d3cdf8).

## Issue 등록 및 검토 반영

상위 [#232](https://github.com/ChangjoSung/Digit-Duel/issues/232)에 GitHub native sub-issue 6개를 연결했다. [#233 전투](https://github.com/ChangjoSung/Digit-Duel/issues/233) → [#234 로스터](https://github.com/ChangjoSung/Digit-Duel/issues/234) → [#235 시너지](https://github.com/ChangjoSung/Digit-Duel/issues/235) → [#236 경제](https://github.com/ChangjoSung/Digit-Duel/issues/236)가 핵심 통합 순서다. [#237 온라인](https://github.com/ChangjoSung/Digit-Duel/issues/237)은 경제 상태 계약을 공유하고, [#238 UI](https://github.com/ChangjoSung/Digit-Duel/issues/238)는 전체 상태와 연결해 완료 판정한다. 선행 관계는 통합 기준이며 설계 병렬 가능 여부와 실제 착수 순서는 CJ 지시 후 결정한다.

모든 Issue는 OPEN·Milestone #15 소속이며 담당 부서·범위·완료 조건·의존관계·트랙/PR 규칙·CJ 착수 대기를 본문에 명시했다. 부서별 중복 Issue나 문서 전용 Issue는 만들지 않았다. 상위 Issue는 자체 구현 PR 없이 통합 검증·CJ 승인만 추적한다. #238은 Earth 시각 자산과 Mars 실행 코드를 함께 납품한다. HTML 데모·관련 온라인 서버 범위이며 Roblox/Unity 포팅을 자동 확장하지 않는다.

### Venus 제출본에서 정정한 사항

[검토 제출본](../../planning/issue-registration-review.md)의 7건 구성을 채택하되, 현재 Notion 원문과 충돌하는 다음 주장은 등록에 반영하지 않았다.

- 승급 최대 HP 회복, 전설 출전 방식, 순차 블라인드 즉시 확정/취소 없음, 가방 초과 선택 중 단절 타이머 정지, 완료 후 상점 재편집 금지, 신규 구매 무확인·레드닷, 닫힌 상점 Dim·잔여 턴은 최신 GDD-23에 이미 적혀 있다. 이를 다시 미확정으로 돌리지 않았다.
- 남아 있는 [설계 보완]은 왕·동료가 낀 등급 비교 생략(4.4), 레드닷 위치·읽음 해제(7.5)다. #233·#238에 경계 표시를 보존했다. 등록 승인을 구현 또는 경계 일괄 승인으로 해석하지 않았다.
- 수풀 재화 전용화 ⑧은 미결 기획이 아니라 구현 후 관찰 대상이다. #236 범위와 #232 검증 지표에 포함했다. 8.4의 전투 평균 라운드·마지막 동률 빈도도 누락하지 않았다.
- 상점 초기 소모품 4종, VIP 속성 선택, 80턴 전설, 가방 초과 및 비공개 상태, 재접속/서버 재시작 종료 처리를 등록 완료 조건에 보강했다. 완전 동시 단절 만료를 일반 전투 무승부와 혼동하지 않도록 승자 없는 종료로 표현했다.
- `dev_server` 라벨은 이미 존재했다. 새 라벨을 만들지 않았다. CJ가 이미 일정 등록을 지시했으므로 제출본의 '다음 지시 후 등록' 문구는 현재 승인 상태가 아니다.
- 과거 GDD-13·15·16 및 UI/UX 인계 미확정 목록을 현재 기획보다 우선하지 않았다. 현재 규칙 안내 GDD-13은 출시본 v0.4.10을 유지하고 다음 패치 일정 상태만 갱신했다.

## Notion·Worker 마감

GDD-23의 Milestone은 v0.4.11 링크, Issue는 #232~#238 링크다. GDD-24는 같은 Milestone과 흐름 관련 #232·#236·#237·#238을 연결했다. 문서명/문서 유형/Milestone/Issue/Owner/마지막 수정 표시 순서와 기존 승인 본문·Owner를 보존했다. Summary와 현재 규칙 문서의 다음 패치 상태만 등록 완료·구현 대기로 맞췄다.

Venus의 worker_done `msg_9dc03188727d` 및 task/dispatch를 대조하고 제출 파일을 검토했다. release 결과 `released`, archive `captured`, reclaimable 0 확인. Mercury 외 제품 구현·QA Worker를 시작하지 않았다. 로컬 문서는 미커밋 상태로 보존한다.

## 최종 재조회

- GitHub #232~#238 전부 OPEN·Milestone 15, #232 native sub-issue가 정확히 #233~#238인 것을 확인했다. 본문에 미치환 의존 키가 없고 모든 Issue에 v0.4.11 트랙을 명시했다.
- 원격 트랙 SHA가 dev 분기점과 같고 protected=true다. 보호 API에서 PR·strict·관리자 적용·필수 6개 검사·강제 push/삭제 금지를 재확인했다. 필수 검사 설정 확인이며 새 CI 실행 PASS를 뜻하지 않는다.
- Notion GDD-23·24 재조회에서 실제 Milestone/Issue 링크·Owner 보존을 확인했다. 서명 이미지 URL의 임시 쿼리를 제외한 GDD-23 본문은 등록 전후 동일했다.
- 현재 체크아웃은 `milestone/v0.6.0`이다. 변경 문서의 `git diff --check`와 등록 인덱스·보고서의 로컬 링크 확인을 통과했다. 게임 테스트는 실행하지 않았다.
