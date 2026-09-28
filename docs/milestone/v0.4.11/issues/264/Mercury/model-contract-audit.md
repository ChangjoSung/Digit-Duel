# #264 Worker 모델 계약 재점검 — 2026-09-25 Mercury

## 현재 Render 읽기 전용 확인 — 2026-09-27

Orca의 기존 로그인된 Dashboard에서 `digit-duel` Web은 Free, 브랜치는 main, 공개 주소는 https://digit-duel-mipa.onrender.com/ 로 표시됐다. 현재 My project의 Production 목록에는 Web 하나만 표시되고 PostgreSQL 항목은 없었다. 이 관측은 해당 프로젝트 화면에 한정되며 다른 프로젝트·계정의 DB 존재를 단정하지 않는다. 지역·DB 생성/만료·실제 계정 연결·HTTPS/WSS·메일·백업/복원은 미검증이다. 설정·자원 생성·요금제·배포·결제는 변경하지 않았다. 기존 GitHub 완료 조건의 부분 상태만 갱신했고 새 댓글은 없다. 브라우저 첫 snapshot 연결 오류 뒤 읽기 전용 eval로 복구했으며 로그인 전 상태를 현재로 계속 쓰지 않는다.

## 판정

- 현행 결정은 CJ 승인 [#250](https://github.com/ChangjoSung/Digit-Duel/issues/250), 병합 [PR #251](https://github.com/ChangjoSung/Digit-Duel/pull/251), 병합 커밋 `5435b40`이다. Mercury·Saturn `gpt-6-sol/xhigh/default`, Venus·Mars·Jupiter `claude-opus-5-5/high`, Earth 신규 `gpt-6-astra/medium/default`·기존 `gpt-6-luna/xhigh/default`를 고정한다. `default`는 No Fast다.
- 2026-09-25 첫 #264 트리는 오래된 로컬 `milestone/v0.4.11` HEAD `33490f9`에서 만들어 #250을 포함하지 않았다. 첫 Jupiter `claude-opus-5/high`와 첫 Saturn `gpt-5.6-sol/high`는 잘못 배정됐다. 당시 Saturn의 IPv6/TLS 및 백업·복원 REVISE는 결함 증거로 남기지만 #250 모델의 정식 QA로 소급하지 않는다. 원래 트리의 모든 파일은 `C:/Users/pc_77/orca/archives/Digit-Duel/issue-264-render-db-2026-09-25.zip`에 manifest·해시를 검증해 보존한 뒤, CJ의 작업 트리 정리 지시에 따라 Orca에서 제거했다. 원래 Mercury 운영 기록은 [이력 사본](operations-history.md)으로 이 트리에도 보존했다.
- 이 트리는 `origin/milestone/v0.4.11`의 `fafc619`에서 별도로 생성했고 `git merge-base --is-ancestor 5435b40 HEAD`가 exit 0이다. 원본·#263·이 트리의 JSON 7개 역할과 Codex/Claude 프로젝트 기본값을 비교해 모두 #250과 일치함을 확인했다. 원본 로컬 HEAD 자체는 여전히 오래됐으므로 앞으로 새 트리를 만들 때 base 검사를 생략하면 안 된다.

## 재발 방지 실행 게이트

`CLAUDE.md`, `docs/README.md`, `docs/creat2ve/{README,AUTHORITY,WORKER_MODELS,QA_MINIMUM_POLICY,HANDOVER_SNAPSHOT}.md`, `worker-models.json`의 활성 계약을 #250에 맞췄다. 새 작업 트리를 만들기 전에는 #250 병합 커밋 포함 여부를 확인하고, 만든 뒤에는 그 트리의 표·JSON·`.codex/config.toml`·`.claude/settings.json`을 다시 읽는다. 역할별 명시 기동값, 시작 영수증, 실제 TUI footer, `turn_started`, preamble·dispatch capability를 확인한다. 기존 TUI 재사용 시 Orca launch requested/effective가 `null`이면 명시 기동 명령과 footer를 남기고 그 필드를 관측값으로 기록하지 않는다. 불일치/`start_unknown`은 작업 전에 조사한다.

이번 #264에서 CJ가 지시한 모든 Worker full access·무확인 실행은 권한 예외다. 모델, Mercury 제품 코드 비작성, Saturn 파일 무수정 QA, Worker Git 쓰기 금지, Render 자원·결제 별도 승인 경계는 유지한다.

## 재실행 증거와 판정

- 새 Jupiter `task_0aad1d9b4497` / `ctx_7c30588516d0` / `term_025fa56c-7d4f-46c6-8d73-459616eb46ab`는 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions`로 명시 기동했다. TUI에 Opus 5.5/high와 bypass permissions가 보였고, `worker-start`의 `turnStart=observed`, preamble·TASK 전달을 확인했다. 기존 TUI 재사용이므로 launch requested/effective는 `null`이며 이것을 실효 모델 영수증으로 주장하지 않는다.
- 올바른 모델의 첫 Saturn `ctx_8bf983a914fb`는 호스트·`sslmode`·URL 오류와 빈 복원 대상 확인을 REVISE했다. Jupiter가 현재 base에서 수리하고 DB 회귀 42건, 서버 전체 검사, 공개 방 스모크를 통과했다고 보고했다. 뒤의 fresh Saturn들은 복원 런북에서 원격 TLS 미지정, 불완전한 빈 DB 검사, 연결 문자열로 해석될 입력, 숫자형 호스트 별칭, 상속된 libpq 설정과 GSSAPI 우선 연결을 차례로 발견했다. Jupiter는 제품 코드 추가 변경 없이 런북을 수리했고, 마지막 fresh Saturn `task_9ceb08f9aff5`/`ctx_84fdb5a9f39c`가 §5.3·§15의 **로컬 런북 GO**를 보고했다. 모든 Saturn은 `gpt-6-sol/xhigh/default`·YOLO로 명시 기동했으며 TUI footer·preamble·capability·`turn_started`를 관측했다. 기존 TUI 기반 dispatch의 launch requested/effective는 `null`로 기록한다.
- Mercury는 `git diff --check` exit 0, 현재 트리 문서 링크 검사 254개 문서·1,217건 링크·문제 0건, JSON 7개 역할과 `.codex`·`.claude` 기본 모델의 원본·#263·#264 트리 일치를 확인했다. 옛 #264 Orca 작업 트리는 `HISTORICAL / DO NOT DISPATCH`, 이 트리는 `ACTIVE #264`로 주석을 달았다. 원본 checkout의 링크 검사는 오래된 HEAD와 별도 미추적 문서가 만드는 대상 없음 9건으로 실패했으며 이번 모델 링크에서 새 오류는 확인되지 않았다.
- 판정은 **로컬 코드·런북 준비 GO, #264 전체 완료는 아님**이다. 살아 있는 Postgres에서의 TLS/CA·마이그레이션·백업·독립 스크래치 복원, 실제 Render Dashboard plan/region/만료일, 배포 후 HTTPS/WSS·2클라이언트·재배포 보존은 미검증이다. [GitHub #264](https://github.com/ChangjoSung/Digit-Duel/issues/264)의 현재 상태 문구를 이 구분으로 갱신하고 OPEN을 확인했다. 제품 코드·문서 변경은 미커밋이고 stage·commit·PR·배포·Render 자원 생성/결제는 하지 않았다. CJ가 앞서 Render Dashboard 로그인 후 알리겠다고 했으며, 외부 자원 생성은 별도 승인 게이트다.
