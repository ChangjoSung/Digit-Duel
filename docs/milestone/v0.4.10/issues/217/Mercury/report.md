# #217 / #218 v0.4.10 — Mercury 현재 진행 현황

2026-09-13 15:16 KST. 기존 작업을 Run `run_a9e503daa1ce`에서 인수해 관리 중이다. 이전 Mercury 터미널 종료와 `ptyKilled=true`를 확인했다.

## 현재 승인과 구현 상태

- CJ 승인 범위: 기존 전체 규칙을 유지하는 서버 권위 전환, 초대 코드 없는 공개 로비, #218 흐름, 누락 아트 복구, 모바일 기술 설명 및 도망/텔레포트 후 턴 동기화 확인. `digit-duel`이 포함된 Render 주소 생성과 실제 배포도 승인됐다.
- 작업 브랜치 `feature/217-public-authority`, 통합 PR 대상 `milestone/v0.4.10`. 구현 커밋·PR·외부 서비스 생성은 아직 하지 않았다.
- 서버 엔진/아트 필드/FX/공개 표시 정보 delta는 Saturn 독립 PASS. 근거는 `server-qa-v4.md`, `art-data-qa.md`, `fx-qa-v3.md`, `public-view-qa.md`. 새 WAN 배포 delta는 별도 최종 검수 전이다.
- Mars `task_5493ab34cdf0` / `ctx_75a85d4c58fb`: 기존 전투 무대 복구, 재접속 후 push 누락 수정, 모바일/실브라우저 검증 진행 중. 최신 실제 브라우저 로그 `C:/dd_cdp/run_pub5.log`에서 전투 진행과 TCP 단절 후 같은 좌석 재접속 및 새 행동 수락 PASS를 관측했다. 최종 게임 완주/모바일 회귀/독립 클라이언트 QA는 미완료다.
- Jupiter `task_b9dd97092f4f` / `ctx_66ddebd4fd3d`: WAN opt-in, 플랫폼 PORT 수용, Render 설정을 구현하고 문서 작성 중. 서버 구현·테스트 완료 heartbeat를 받았으나 최종 worker_done은 아직 없다.
- Render 로그인 및 GitHub `ChangjoSung/Digit-Duel` 소스 연결 확인. 새 서비스 폼에 digit-duel, Free($0), Singapore, root 전체 저장소, build `npm ci --prefix server`, start `npm start --prefix server`, health `/healthz`, CI 통과 후 자동 배포를 준비했다. 배포 브랜치는 아직 변경 전이므로 생성 버튼을 누르지 않았다. 후보 `digit-duel.onrender.com`은 실제 배정 주소가 아니다.
- `netParseAddr`의 도메인 거부는 구 릴레이 경로다. 공개방은 `netPublicAddr()`와 `netOpenCredentialSocket()`에서 같은 출처 host 및 wss를 직접 사용하므로 공개방 차단이라고 단정할 근거가 없다. Jupiter 문서의 단정은 정정을 요청했다.
- 시간 지연 원인: 표시 계층 누락 재작업, 헤드리스 통과와 실제 화면 간 불일치, 재접속 후 push 폐기, 조정 메시지 처리 지연. 배포/클라이언트 책임을 나누고 변경된 경계만 우선 검수한다. 계정 사용률은 직접 조회할 수 없어 CJ의 12%→20% 목표 준수를 보장할 수 없다.
## 문서 반영 위치

| 항목 | 위치 |
|---|---|
| 세션 인수·현재 조정 상태 | 이 보고서 및 원본 작업 폴더 `docs/creat2ve/HANDOVER_SNAPSHOT.md` |
| 서버 구현자 완료 근거 | `../Jupiter/report.md`, `../Jupiter/protocol.md` |
| 독립 재검수 수용 기준 | `acceptance-audit.md`, `server-qa-revise.md` |
| 클라이언트 진행 근거 | `../Mars/report.md` (작업 중) |

---

## 과거 분석 단계 기록 — 아래 상태는 현재 진행 상태로 사용하지 않음

# v0.4.10 #217 및 Notion 정합성 — Mercury_PD 최종 기록

기준일: 2026-09-13 (Asia/Seoul). CJ Comment: 부서별 모델 규칙 확인 후 #217과 Notion 업데이트 문제를 묶어 진행.

**후속 Comment 반영:** 이 보고 이후 CJ가 서버 권위 전환 방향을 승인하고, 초대 코드 대신 공개 방 목록·자유 입장 방식과 외부망 비용을 분석하도록 지시했다. 현재 승인·검토 상태는 [공개 로비 후속 보고](public-lobby-review.md)가 우선하며 아래는 이전 Comment의 납품 이력이다.

## 최종 상태

**모델 계약 확인·불일치 정정, #217 설계 작성·문서 검수, Notion 실제 정정·재조회 완료.** [GitHub #217](https://github.com/ChangjoSung/Digit-Duel/issues/217)에 분석 결과·제안 번들·Notion 링크·검수 근거·CJ 승인 게이트를 반영했다. 이슈는 CJ 설계 승인 전 OPEN이다. 코드 구현·배포·제품/보안/런타임 QA는 이번 납품이 아니다.

- Saturn 기본 검수 `msg_7a1d92bd5a25`에서 GDD-22·Jupiter 최종 보완과 GDD-13 규칙을 확인했고, 남은 세 문구는 Venus `msg_d034bedeec6b`가 정정했다. Saturn 최종 차이 검수 `task_577edc849494` / `ctx_8b77f0c4622a` / `msg_adc2ad321758`는 **문서 검토 준비 PASS**다. Mercury는 이 두 범위의 검수를 취합해 문서 정합성 검수를 완료 처리했다. 마지막 Worker 보고에 인용된 '최종 문서 QA 대기'는 갱신 전 페이지 표시이며 추가 검수 과제를 뜻하지 않는다.
- 최종 Saturn 조회: GDD-13 본문 as-of `2026-09-12T17:19:40.065Z`, page last edited `17:19:53.046Z`. 마지막 세 항목 외 재전수 검수를 반복하지 않았다.
- Mercury가 운영 상태만 후속 반영했다: GDD-13 `Status=완료`(이번 문서 동기화), 기존 `문서 상태=승인` 보존. GDD-22 `Status=검토 중`·`문서 상태=검토 요청`·PROPOSED·CJ 미승인 유지. 요약·Version·QA 상태 문구는 실제 검수 결과로 맞췄고 기획 정책·수치·규칙은 변경하지 않았다.
- 최종 실제 Notion readback: GDD-13 last edited `2026-09-12T17:23:36.700Z`, GDD-22 `2026-09-12T17:23:38.225Z`. 요청한 상태 문구 존재·옛 대기 문구 제거, 사람/Project 속성 보존을 확인했다. Venus/Jupiter 보고서의 작성 당시 QA 대기 문구는 이 최종 운영 기록이 대체한다.
- 마지막 Venus `ctx_7671a97dfb03`와 Saturn `ctx_8b77f0c4622a`도 출력 보관 후 release했다. 최종 worker-list에서 active 0·소유 자원 0, released 13을 확인했다. retained 3행은 후속 Task로 소유권을 넘긴 과거 dispatch이며 자원은 없다.
- 로컬 `git diff --check`와 모델 JSON 파싱이 통과했다. GitHub #217은 최종 본문과 OPEN 상태를 재조회했다. 로컬 문서 변경은 미커밋 상태로 보존하며 기존 사용자 변경을 포함해 스테이징하지 않았다.

아래 실행 기록의 REVISE·진행 중 표기는 각 시점의 이력이며 이 최종 상태와 구분한다.

## 승인 범위와 역할

- 이번 지시는 #217 설계 진행과 기존 승인 규칙의 Notion 동기화 권한이다. 새 서버 정책·유료 호스팅·배포 승인으로 확대하지 않는다.
- Jupiter_Server가 원본 코드 근거로 서버 설계를 분석하고, Venus_Plan이 Notion 기획 본문·속성을 관리한다. Mercury는 결과 취합과 GitHub·운영 메타데이터를 담당하며 Saturn이 독립 검수한다.
- #217 초기 본문의 Jupiter 분석 표기는 Mercury 예비 분석을 잘못 귀속한 것이어서 GitHub 본문을 정정했다. 독립 분석은 [Jupiter 보고](../Jupiter/analysis.md)부터다.

## 모델 계약 확인

| 역할 | 모델 | effort |
|---|---|---|
| Mercury_PD | gpt-6-astra | low |
| Venus_Plan / Mars_Client / Jupiter_Server | claude-sonnet-5 | medium |
| Earth_Art 신규 창작 | gpt-6-astra | medium |
| Earth_Art 기존 자산 수정 | gpt-5.6-terra | medium |
| Saturn_QA | gpt-5.6-sol | medium |

Mercury는 2026-09-13 후속 CJ 지시와 기존 미커밋 `.codex/config.toml`·인계문의 Astra low를 기준으로 한다. 이번에 CLAUDE.md·WORKER_MODELS.md·worker-models.json의 오래된 Terra 기본값을 정정했다. 계정 전역 설정과 기존 프로젝트 MCP 설정은 변경하지 않았다. 설정 변경이 실행 중 세션의 모델을 소급 변경했다는 의미는 아니다.

## 실행 근거

Orca Run: `run_14a4d1e9f662`.

- Jupiter 첫 분석: `task_0786e8fbf3a1` / `ctx_278cc7c27138`, Sonnet 5 medium requested/effective 일치·실제 응답·문서 납품 확인. 같은 역할·터미널에서 즉시 설계 보완으로 재사용했다.
- Jupiter 설계 보완: `task_aaf4dc515cf1` / `ctx_1c777c6052d9`.
- Venus Notion 정정: `task_128fa4354be4` / `ctx_40a52f37f933`, Sonnet 5 medium requested/effective 일치·실제 Notion 읽기 확인.

- Venus 현재 본문 마무리·#217 기획 연결: `task_fdba9b69cd1d` / `ctx_7283314e4b48`. 최초 후속 실행 시 Mercury가 터미널 핸들의 한 글자를 잘못 입력해 `terminal_handle_stale`로 사전 거절됐다. request/task/worker 상태를 읽어 추가 실행이 없음을 확인하고 실제 핸들로 실행했다. 중복 Worker는 만들지 않았다.
- Saturn 독립 설계 검수: `task_7c532ccd492a` / `ctx_bcec03f63a60`, Sol medium requested/effective 일치. worker_done `msg_7f478d1e63b7`의 판정은 **REVISE**(검수 작업 자체는 succeeded), 파일 변경 없음. 실행 출력 보관 후 release했다.
- Jupiter REVISE 보완: `task_7c8941ba83ee` / `ctx_98658594b72b`, fresh Sonnet 5 medium.
- 두 Sonnet 설계판에서 ready 유지/리셋·비공개/전송 등 같은 정합성 문제가 반복돼 Jupiter를 계약의 Opus 5 high로 상향했다: `task_5da90a245210` / `ctx_64b53da7e18e`. requested/effective 일치, 실제 재작성 납품 확인 후 release.
- Saturn 재작성본 검수 `task_55e11987f6e0` / `ctx_c18424859674`는 **REVISE**였다. 공개된 말의 미공개 기술, 독립 배치 인가, epoch 전달, 연속 응답 유실 시 토큰 회전, 명시적 이탈·양측 단절의 잔여 모순을 지적했다. Jupiter Opus 5 high의 한정 보완 `task_02f75e65d826` / `ctx_b691b9dce594`로 전달했다.
- 같은 Saturn 터미널은 즉시 Notion 현행 본문 검수 `task_242a886f6692` / `ctx_46e1230952d5`에 재사용했다.
- Venus의 후속 Notion 수정에서 들여쓰기/직렬화 문자열 불일치와 읽기 전용 문서 ID·존재하지 않는 문서 유형값 쓰기가 거절됐다. 현재 반영분을 보존하고 시도를 정산한 뒤 같은 Venus 역할의 상향 후속으로 인계하도록 요청했다. 이 오류는 사용자 권한 거절로 보고하지 않는다.

- Venus Sonnet 후속은 부분 반영을 보존한 `failed`로 정산하고 release했다. 같은 task의 Opus 5 high 재시도 `ctx_0b3a451f34ad`가 GDD-13 잔여 본문과 기존 GDD-22를 이어서 정정한다. 새 문서를 중복 생성하지 않는다.
- Jupiter 한정 보완 후 Saturn `task_2dfce422fa01` / `ctx_6ca17962a35a`는 여섯 지적이 해결됐음을 확인했다. 마지막 FINISHED 허용 명령표의 `leave` 누락만 REVISE로 남겼다(`msg_eb21750600c8`). Jupiter `task_e9ee395afb11` / `ctx_d8584d97ca01`가 154행을 본문 §2.3.1과 일치시켰다(`msg_09d4c1997da4`). 두 Worker 모두 출력 보관 후 release했다.

진행 중 판정을 완료·출시로 기록하지 않는다. 최종 Notion readback과 독립 검수 결과는 아래에 취합한다.

## 검토할 서버 제안

[Jupiter 상세 보고](../Jupiter/analysis.md)와 [GDD-22](https://app.notion.com/p/3d91e7f170858110bf64f7416bba2d01)를 연결했다. 기존 서버는 여러 소켓 쌍을 중계할 수 있으나, 공개망의 룸 관리·서버 권위·좌석별 비밀 정보 필터링은 구현돼 있지 않다.

- 최초 범위는 계정 없는 초대 코드 기반 비공개 1:1 룸. 서버가 판정하고 좌석별 허용 정보만 전송한다.
- 두 좌석이 독립적으로 배치·준비하며 배치는 비공개다. 상대의 준비 완료 여부 공개는 기존 규칙으로 위장하지 않은 새 제안이다.
- 초대 코드 10분·재접속 60초·종료 후 정리 5분은 잠정 제안값이다. 좌석 토큰은 현재 페이지 메모리에만 보관하므로 새로고침 복구를 보장하지 않는다.
- 초기 단일 프로세스·메모리 룸 구조에서 서버 재시작은 진행 경기 VOID다. 무중단 배포·프로세스 간 경기 복원은 이 번들에 없다.
- 퀵매칭은 비공개 룸 파일럿(2주 제안)의 실측을 검토한 뒤 별도 결정한다. 실측하지 않은 성능·용량을 보장하지 않는다.
- CJ 검토는 이 제안 번들에 대한 승인이다. 배포 호스트·도메인, 월 비용 상한, TLS 운영 주체는 구현 전 외부 입력이다.

## Notion 연결과 상태

- [GDD-13 현행 규칙](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38)
- [GDD-22 서버 제안](https://app.notion.com/p/3d91e7f170858110bf64f7416bba2d01) — PROPOSED·CJ 미승인, GDD-13과 양방향 연결
- [Venus 동기화 근거](../Venus/notion-sync.md) · [서버 기획 기록](../Venus/server-plan.md)

Notion 오류는 읽기 전용 `문서 ID`, 허용 목록 밖 select 값, 직렬화 문자열과 실제 본문의 불일치였다. 접근 권한 거절로 해석하지 않는다. 실제 fetch·쓰기·readback 성공을 기준으로 인계문의 과거 인증 미확인 안내도 정정했다.

Venus Opus 후속은 `msg_bf010aa2c1b5`(2026-09-12T17:15:34Z)에서 실제 GDD-13 정정과 GDD-22 v0.2 저장·readback 완료를 보고했고 release했다. DL1~66은 보존, DL67을 추가했다. Venus가 운영 담당 소관으로 남긴 GDD-13 `Summary`·`Status`는 Mercury가 실제 데이터소스 스키마를 조회한 뒤 직접 정정했다. `Summary`는 이번 #217 조정 상태와 과거 DL63~64 참조, `Status`는 이번 문서 검수의 `검토 중`이다. 기존 `문서 상태=승인`과 사람·관계 속성은 보존한다. 따라서 Venus 보고서의 Summary/Status 미해결 표시는 이 운영 갱신으로 대체된다. 전 프로젝트의 새 Status 정책을 정한 것이 아니다.

최종 Saturn 문서 검수: `task_c672fe4dc7da` / `ctx_6386a30b124c`, Sol medium requested/effective 일치. 실제 Notion 두 페이지와 서버의 마지막 FINISHED 한 셀을 읽어 판정한다.

`msg_7a1d92bd5a25`(2026-09-12T17:16:55Z): **GDD-22 제안과 Jupiter FINISHED 보완 PASS**, GDD-13의 규칙·자원·연출·튜토리얼·운영 속성도 PASS. 전체 문서 판정은 GDD-13의 오래된 안내 DL 범위·요약의 `Jupiter 분석 중`·4.6 활성 문장의 옛 v0.4.7 표기 세 곳 때문에 REVISE였다. 서버 구현·보안·런타임 검증을 의미하지 않는다. Venus Opus high `task_58470079a270` / `ctx_7671a97dfb03`에 세 문구만 한정 정정하도록 전달했다. Saturn 출력은 보관·release했다.

## Saturn 1차 지적 (Mercury 전사, 독립 판정 아님)

1. TLS 추가만으로 현 클라이언트/서버가 WAN을 허용하지 않는다. 공개 주소·Host 차단 경계를 모두 명시해야 한다.
2. 숲 속 위치 은폐와 보이는 말의 정체 비공개를 구분하고, 좌석별 전송 허용 필드·이벤트·로그·준비 정보를 정의해야 한다.
3. 방장/참가자 이탈을 SETUP·READY까지 다루고 코드 재발급·토큰 회수·중복 소켓·재접속을 구체화해야 한다.
4. 서버가 행동자를 인증하고 요청에 baseRevision을 포함해야 한다. 현재 보드 차례와 다른 방어자 선택 등의 입력 권한도 다뤄야 한다.
5. 정상 드레인 알림과 갑작스러운 장애는 다르다. 장애 시 알림 보장을 하지 않고 타임아웃·무효 처리를 명시해야 한다.
6. 이미 종료한 구 프로세스를 종료 역순으로 복구할 수 없다. 연결 소유권을 유지하는 배포/롤백을 정의해야 한다.
7. 인계문의 현재 Terra low·#211 OPEN 서술을 최신 지시/실제 상태에 맞춰야 한다. Mercury가 해당 운영 메타데이터를 정정했다.

## 보존 범위

작업 폴더는 Unity 트랙 `milestone/v0.6.0`의 `8bb6d98`다. 보호 브랜치 직접 커밋·push를 하지 않았다. 기존 미커밋 config·인계문과 사용자 미추적 `art/`, `orca-hook-latency-report.md`를 보존했다. 분석 문서와 운영 메타데이터의 로컬 변경은 코드 구현·릴리스가 아니다.
