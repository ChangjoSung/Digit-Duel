# v0.4.11 작업 트리 정리 — Mercury, 2026-09-28

## 현재 작업 공간 — #232 통합 후

| 남은 경로 | 용도 | 상태 |
|---|---|---|
| C:/Users/pc_77/orca/Digit-Duel | 사용자 원본·Mercury 창구 | dirty/untracked·로컬HEAD33490f9 보존 |
| C:/Users/pc_77/orca/workspaces/Digit-Duel/release-review-v0.4.11 | 후속 Release 검토 | 최신 통합 milestone 기준, Worker 없음 |

승인 납품을 먼저 마일스톤에 반영한 뒤 기존 트리8·로컬 브랜치8·원격 브랜치6을 정리했다. ZIP 원문·미커밋/미추적 파일·Git bundle·삭제 영수증은 C:/Users/pc_77/orca/archives/Digit-Duel/issue232-integration-2026-09-28에 보존했다. QA8085·PG55462는 종료, 데이터·SMTP·cold backup은 유지했다. [#232 통합·Render 준비 보고](../../issues/232/Mercury/integration-review.md)가 현재 판정이며 현재 Render 운영 설정 NO-GO와 CJ 별도 Release/배포 게이트를 따른다.

## 과거 작업 공간 — 2026-09-25 당시 기록


| 경로 / 브랜치 | 기준 HEAD | 보존할 작업 | 판정 |
|---|---|---|---|
| `issue-263-shop-timers` / `ChangjoSung/issue-263-shop-timers` | `fafc619` | #263 보드·전투 시계의 서버/Core·클라이언트 구현, 회귀 검사, Saturn 수동 GO 원장 | **활성, 유지**. 미커밋. CJ 플레이 QA·PR 필수 CI·통합 대기. [#263 Mercury 원장](../../issues/263/Mercury/report.md). |
| `issue-264-render-db-current` / `ChangjoSung/issue-264-render-db-current` | `fafc619` | #264 선택적 Postgres 연결·마이그레이션·실행 게이트·복원 런북, 올바른 모델의 Saturn 로컬 GO | **활성, 유지**. 미커밋. 실 DB·Render Dashboard·백업/복원·배포 검증 대기. 해당 트리의 `issues/264/Jupiter/report.md`와 `issues/264/Mercury/model-contract-audit.md`가 현재 원장이다. |
| `issue-264-render-db` / `ChangjoSung/issue-264-render-db` | `33490f9` | 오래된 기준의 첫 시도와 잘못 배정된 Jupiter/Saturn 실행 이력 | **보존 후 제거**. 2026-09-25 원본 파일 1,469개를 ZIP으로 검증·보관하고 Orca `worktree rm --force`로 제거했다. 최신 구현·QA로 소급하지 않는다. |

두 활성 트리의 제품 변경은 서로 다른 이슈의 미커밋 작업이다. 한 브랜치로 합치거나 원본 checkout에 덮어쓰지 않았다. 원본 `milestone/v0.4.11`은 HEAD `33490f9`와 사용자 dirty·untracked 파일을 그대로 유지한다. 새 작업 트리는 로컬 원본 HEAD가 아니라 `origin/milestone/v0.4.11`의 최신 기준과 #250 모델 커밋 `5435b40` 포함 여부를 확인해야 한다.

## 오래된 #264 보존 내용과 기준 선택

- 보관 파일: `C:/Users/pc_77/orca/archives/Digit-Duel/issue-264-render-db-2026-09-25.zip` (1,469개, ZIP SHA-256 `4fb855b48689cb430cbc43b187403e680e62ca34a4e60b8898575420d4e72117`). `_PRESERVATION_MANIFEST.json`에 각 파일 경로·크기·SHA-256을 기록하고 ZIP을 다시 읽어 전부 대조했다. 공유 Git 메타데이터를 가리키는 `.git` 링크 파일만 제외했다.
- 첫 시도의 `server/db-migrate.js`, `server/db/migrations/001_db_meta.sql`, `server/package-lock.json`은 최신 트리와 SHA-256이 같다. `server/db.js`, `server/test-db.js`, `server/authoritative/server.js`, `server/package.json`, `server/README.md`, Jupiter 보고서는 최신 기준 및 후속 REVISE 수리로 달라졌다. 최신 트리가 납품 후보이며 첫 시도 코드를 다시 적용하지 않는다.
- 첫 시도에만 있던 Mercury `operations.md`는 최신 #264 트리의 `issues/264/Mercury/operations-history.md`에 **바이트 동일**하게 복사했다(SHA-256 `A20AF2B4ADFB92E3E956D1CC5A4FF7FCE4269D1A4767F77192CDD177D40EB917`). 옛 기준과 당시 미확인 Render 상태를 담은 **이력**이다. 최신 판정은 `model-contract-audit.md` 및 Jupiter 최종 보고서가 우선한다.
- 첫 Jupiter `claude-opus-5/high`와 첫 Saturn `gpt-5.6-sol/high`는 CJ #250 계약과 달랐다. 결함 발견 사실만 보존한다. 최신 트리의 Jupiter `claude-opus-5-5/high`·Saturn `gpt-6-sol/xhigh/default` 재실행 및 독립 QA를 정식 근거로 쓴다.

## 대상 폴더의 과거 잔여물

- `feature-217-public-authority`는 Git/Orca에 등록된 작업 트리가 아닌 과거 파일 폴더다. 1,147개 파일(약 115 MiB) 중 1,077개가 원본 checkout과 바이트 동일하고 70개는 예전 판본이며, 원본에 없는 상대 경로는 없다. `C:/Users/pc_77/orca/archives/Digit-Duel/feature-217-public-authority-2026-09-25.zip`으로 전부 보존했다(ZIP SHA-256 `4ab4c766779669338ab852435a6c4ed8ad07abe20e366a34c25049d49e458c7c`, manifest 전건 검증). 잠금 주체를 확인해 과거 로컬 미리보기 서버·로그 tail을 종료한 뒤 원본 폴더를 `C:/Users/pc_77/orca/archives/Digit-Duel/feature-217-public-authority-preserved`로 이동했다. 보관본과 이동한 원본을 모두 유지한다.
- `issue-236-economy-v0411`, `issue-237-online-authority`는 Git/Orca 작업 트리가 아닌 파일 0개의 빈 폴더였다. 잠금 주체는 각각 과거 로컬 HTTP 미리보기 서버와 9월 24일 시작된 완료되지 않은 `npm test` 프로세스였다. 해당 프로세스를 종료한 뒤 두 빈 폴더를 삭제했다. `.orca-worktree-trash`는 빈 Orca 내부 폴더라 건드리지 않았다.
- 따라서 **실제 Git/Orca 작업 트리는 원본 + #263 + 최신 #264 세 개**이며, `C:/Users/pc_77/orca/workspaces/Digit-Duel` 안에는 활성 #263·최신 #264와 Orca 내부 빈 폴더만 남는다. #217/236/237 경로는 후속 구현 기준으로 사용하지 않는다.

## 다음 구현 경계

권장 순서의 다음 대상은 #259 계정 기반이다. #263/#264의 미커밋 작업과 별개 브랜치·이슈로 다뤄야 한다. 특히 #264 DB 기반을 요구하는 #259 부분은 현재 #264가 미통합이고 실제 Render/DB가 미확인인 점을 전제로 분리해 계획한다. CJ 별도 지시 전 stage·commit·PR·issue close·배포·Render 자원 생성/결제는 하지 않는다.

정리 완료 **후** 새 `issue-259-accounts` 작업 트리를 `fafc619`에서 생성했다. 이것은 위의 정리 대상에 속했던 과거 폴더가 아니라 CJ의 다음 구현 지시에 따른 신규 활성 트리다. CJ는 초기 HTML 복구 수단을 가입 시 1회 발급 복구 코드로 확정했고 [#259 본문](https://github.com/ChangjoSung/Digit-Duel/issues/259)에 반영했다. #259 작업은 별도 Orca Run `run_ea381b9521ea`에서 진행한다. #264의 미통합 DB 파일을 전제하는 부분은 Jupiter가 의존 파일의 해시·기준을 기록한 뒤 이식하며, #259 제품 코드를 Mercury가 직접 작성하지 않는다.
