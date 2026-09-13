# Digit-Duel — Mercury_PD 인수인계 스냅샷

기준: 2026-09-13 11:31 KST 부근. 최신 CJ Comment: **Mercury 계정을 변경하므로 새 Session의 Mercury PD에게 인계**. 이 문서는 이전 누적/미착수 표현을 현재 상태로 치환한다. 새 계정 인증을 바꾸거나 새 계정 세션이 이미 인수했다고 주장하지 않는다. 현재 PD는 인계 기록 후 감독을 종료하며, 아래 두 기존 Worker는 살아 있다.

## 최우선 현재 상태

- **CJ 구현 승인 있음. 재승인 질문 금지.** #217 서버 권위 전환(기존 전체 게임 규칙 유지) + 초대 코드 없는 최소 공개 로비(목록/생성/자유 입장/준비), #218 필수 흐름, Notion 동기화를 하나의 납품 목표/통합 PR로 진행한다.
- **미완료**: 서버 3차 수정 및 클라이언트 실제 브라우저 검증 진행 중. 마지막 독립 서버 QA는 **REVISE**, 최종 통합 QA/PR/커밋/배포 없음. Worker 테스트 통과를 제품 PASS로 간주하지 않는다.
- 실제 구현 경로: `C:/Users/pc_77/orca/workspaces/Digit-Duel/feature-217-public-authority`.
- 브랜치 `feature/217-public-authority` → PR 대상 `milestone/v0.4.10`. dev `6a58f6f1cfcd5c178c7adcf6c42c072cdd10120c`에서 분기. 트랙 원격 생성 및 strict CI6/관리자 우회 금지/PR 필수 보호 완료. **구현 변경은 아직 모두 미커밋·미푸시.** 새 worktree/중복 구현 Worker를 만들지 말고 이 작업 공간을 이어받는다.
- 원본 cwd `C:/Users/pc_77/orca/Digit-Duel`은 `milestone/v0.6.0`이며 별도 미커밋 설정/문서가 있다. 직접 커밋 금지. 사용자 `art/`, `orca-hook-latency-report.md`는 읽기·수정·스테이징·삭제 금지.
- 유료 호스팅/도메인 구매/실제 외부 배포는 선택·실행되지 않았다. 이를 코드 구현의 승인 게이트로 되돌리지 않는다.

## 새 Mercury의 첫 실행

실행기 `orca` (Windows PowerShell). 스킬: `orca skills get orchestration`, `orca skills get orca-cli`. 새 세션 자신의 터미널에서:

```text
orca orchestration run-use --id run_a9e503daa1ce --json
orca orchestration check --run run_a9e503daa1ce --json
orca orchestration worker-list --run run_a9e503daa1ce --include-remote --json
```

Run `run_a9e503daa1ce` 유지. 새 Run/동일 역할 중복 Worker 생성 금지. 이전 coordinator handle은 `term_304a80b5-cff8-418f-86d0-3e060857ed75`이며 새 세션이 사칭하지 않는다. run-use가 실패하면 오류와 현재 runtime 상태를 확인하고, 임의 reset/legacy takeover하지 않는다.

- 마지막 처리 delivery `delivery_a18f789b43f4`(Jupiter heartbeat, isolated mutation run + docs)는 ACK 완료, 그 직후 inbox count0. 이후 메시지는 새 세션이 처리한다.
- `check`는 FIFO이며 **읽은 delivery를 --ack 하지 않으면 옛 메시지만 반복**한다. ACK 응답에 다음 delivery가 올 수 있다. 모든 내용을 처리하고 ACK한다.
- `check --wait --timeout-ms 50000 --json`으로 감독. 3회 빈 대기 뒤 worker-list로 liveness/nextAction 확인. live/unverifiable를 침묵만으로 kill/retry/release하지 않는다.
- worker_done 확인 후 즉시 같은 터미널 재사용 또는 release. Worker Git/Notion 금지(Venus 기획 Notion 예외). release는 transcript 캡처/터미널 정리 포함.
- peer 전달은 `send --to dispatch:<ID> --type status`. run으로 온 peer용 escalation은 PD가 실제 대상에 전달해야 한다. enqueue는 읽음 증거가 아니다.

## 현재 살아 있는 두 Worker — 인계 시 그대로 유지

| 역할 | 모델 실효 | Task / Dispatch / Terminal | 현재 책임 |
|---|---|---|---|
| Mars_Client | claude-sonnet-5 high | task_5493ab34cdf0 / ctx_8118387cc58b / term_27cf4b0b-21b2-4e0b-a467-8003e717eed9 | demo/클라이언트/도구·실행기·테스트/CI. 실제 브라우저 증빙 및 전체 플레이 연결 |
| Jupiter_Server | claude-opus-5 high | task_86c6d1b5d2e8 / ctx_bf9e2d04bdc5 / term_798eeee1-8170-4ac7-b12a-288096a7857e | server 전체, 독립 QA 결함 수정·유한 취소 가능 스케줄러·정적 호스팅/기본 실행 계약/서버 검사 |

모두 requested/effective 일치 및 실제 응답 확인. Jupiter의 Opus 상향은 같은 행동권위/phase 검증 원인이 Sonnet medium/high 두 차례에서 남은 근거에 따른 프로젝트 승인 규칙 적용이다. 새 Saturn은 아직 없다.

Venus 최초 dispatch ctx_1272a2b339a2가 fleet에서 retained/unverifiable로 보이나, **같은 터미널을 ctx_8a297689775c로 재사용한 뒤 release 완료**했다. 원 dispatch의 resource=null 흔적을 살아 있는 Venus로 오인하거나 재정리하지 않는다.

## 진행·검증의 실제 수준

### Mars

- 최초 medium ctx_82b836b1e0aa는 미연결 공개 로비만 만들고 종료했다. 부분 산출물로 수락/삭제 없이 보존, release. 현재 high 후속이 이어받았다.
- `msg_0582d3aee145`(02:10 UTC): 실제 authoritative 서버8081 + Node native WebSocket 두 개 + 실제 타이머로 로비/배치/준비/이동/전투 기술·HP·로그/정보 등급/강제 단절 후 재접속/기권 검증 보고. 신규97단언 및 기존 회귀 통과 보고. **브라우저 DOM/CSS 검증과는 다르다.** 당시 실제 data.modal 트리거 검증 미완료, 서버 QA 결함 잔존.
- 실제 통합에서 host에게 guest 입장을 알리지 않는 서버 버그 발견(`msg_31cb978ea815`). Jupiter에 host room_state broadcast 수정 요청 전달. 클라이언트 임시 조용한 재시도는 서버 알림 수정 후 제거/검증할 것. ready 표시를 서버 수락 이전에 확정하면 안 된다.
- 현재 실제 Edge/Orca computer로 브라우저 확인을 진행하는 transcript 확인. 데스크톱 및320~432px, 로비/배치/전투/선택창/결과/재접속 스크린샷과 재현 가능한 증거를 요구했다. **아직 최종 증빙/완료 보고 없음.**
- 신뢰할 최신 보고: 구현 경로 `docs/milestone/v0.4.10/issues/217/Mars/report.md` 및 실제 파일. 작업 중 계속 바뀐다.

### Jupiter 및 QA

- medium ctx_4d8420442048의 축소 이동/기본공격 게임을 PD가 거부, 실제 demo 게임 엔진 재사용으로 전환시켰다. 직접 test harness가 host global timers를 덮어쓰는 문제 및 불완전 snapshot restore를 지적했다.
- high ctx_6142e99f4271이 per-room Node VM, 모달/로그/전투뷰, 일부 권한가드·구소켓 close 경합을 추가.139검사 통과로 완료 보고했으나, 독립 Saturn에서 아래 실제 결함이 재현돼 REVISE.
- Saturn task_915de96cd7cd / ctx_09177cc4d469 (Sol high) 완료/release. `msg_9a62b8728ecf` 상세, `msg_f6e09924d526` 최종 REVISE. **파일 쓰기0**, npm test 통과 사실과 제품 REVISE를 구별.
- 상세 수용 원본: `Mercury/acceptance-audit.md`, `Mercury/server-qa-revise.md` (모두 구현 경로 아래).
- P0: 방어자 모달 소유권 대신 netActor/current 인가 → rightful defender E_NOT_ACTOR, attacker가 대신 선택 성공.
- P0: 전투/모달 중 defender skipMain이 attacker mainUsed를 변경; tele도 단계 밖 상태 변경.
- P1: duplicate/unknown roster·13개 등 잘못된 배치를 수락, ready 해제 후 원본 applyNetSetup이 무작위 대체. 입력 거부 시 ready/state/revision 불변이어야 함.
- P1: view의 u-alias를 heal/fleeSwap에 번역하지 않아 수락 no-op; 왕/동료 basic/skill 정상 act가 E_BAD_ENVELOPE.
- P1: WS leave가 토큰 검증 전 분기 → 위조 토큰으로 방 취소.
- P1: grace _finalize revision 불변; prestart canceled view phase=setup 잔존.
- 스케줄러: VM은 개선됐으나 clearTimeout 미정의, timerID=0, drain delay 무시/5백만 callback 후 조용히 잔여. 실제 PVP stale callback 변조는 미입증이나 요구한 유한·취소 가능 보장 없음.
- 정적 HTTP/default launcher는 당시 미통합(health만,8081 auth와8080 relay). 현재 Jupiter가 server/static/package, Mars가 launcher/default endpoint 담당. 새 공개 bat 두 개가 미추적 상태에 등장했으므로 소유/실행 확인 필요.
- **현재 Opus Jupiter가 위 결함을 수정 중.** 중간: 여러 seed의 실제 전체 행동 경로13,161수락/no-op0 및 일부 승패 도달, room57통과 관찰. 아직 최종 완료·독립 재검수 없음.

### 중요한 임시 변형 검사 이력

Jupiter가02:23~02:27 UTC에 작업 공간 server/authoritative/{room,server,engine}.js를 mutation test로 잠시 변경했다. PD 지적으로 중단 후 정상본 byte 복원, 이후 isolated scratch copy로 전환했다(`msg_df89eb6e3bf0`). PD가 복원MD5 직접 확인:

- room.js ebbf5862344af67319fbf9e86502296e
- server.js b57d0a8c217498138e7609f65849eae7
- engine.js 9e206ae846c1847889f95235e68cae97

이는 복원 시점 증거이며 이후 정당한 수정으로 hash가 바뀔 수 있다. Mars에 소유 테스트 서버 재시작과 해당시간 결과 재검증을 전달(`msg_6bbd442eb4b6`). **재시작 실제 완료는 미확인**. 최종 브라우저/QA는 최신 정상본 새 process에서 시행해야 한다. 광범위 프로세스 kill 금지.

## Notion / GitHub

- GDD13: https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38
- GDD22: https://app.notion.com/p/3d91e7f170858110bf64f7416bba2d01
- Venus가 DL69 및 본문 서버 권위+최소 공개 로비 구현 승인을 반영. 비공개 초대코드 제안 SUPERSEDED, 기존 게임규칙 유지. 잘못된 로컬경로 URL 및 호스팅을 구현 전 게이트로 적은 문구도 한정 재작업으로 정정/readback. 최종 Venus ctx_8a297689775c release.
- Mercury는 두 페이지 Summary를 구현 진행·최종QA/출시 미완료·호스팅은 실제 외부배포 전 선택으로 갱신했고 재조회 성공. 최종QA/PR 상태는 추후 갱신 필요.
- 사람 Editor/Owner/Reviewer 보존. 실제사람 user8e0a8270-d0e3-407e-a7d2-b3f992f1e366. Project관계3ae1e7f1708580f7bb88c7ee4f511aa0. datasource collection://cb30f124-3ae2-409c-a4c9-ed4c6fe9163a. Agent를 person에 넣지 않는다.
- #217/#218 OPEN: 이슈 본문 앞부분 최신 구현승인으로 갱신했고 아래 과거 미승인 문구는 역사로 구분. https://github.com/ChangjoSung/Digit-Duel/issues/217
- **구현 통합 PR 아직 없음.** 1개 PR, target milestone/v0.4.10, Ref #217 / Ref #218 (자동close 금지), feature+html_demo 라벨, AC/검증/Saturn/UI캡처/rollback 포함. 보호 CI6 통과 필수. 아직 커밋/푸시/병합/태그/릴리스 없음.
- CI: A헤드리스규칙/AI, B서버, B2Windows실행기, C문서링크, D아트무결성, ERoblox. Mars가 milestone/v* 트리거 및 공개로비 검사를 CI에 추가 중. 최종 변경 diff 검토 후 CI 실제 실행.

## 현재 미커밋 변경 (인계 시 git status)

수정: .github/workflows/ci.yml, demo/index.html, demo/test/regression/smoke_online.js, demo/test/shared/harness.js, server/README.md, server/package.json.
미추적: demo/test/regression/smoke_public_rooms.js, docs/milestone/v0.4.10/, server/authoritative/, server/공개LAN서버시작.bat, server/공개서버시작.bat.
Worker 완료 후 git status 재조회. 기존 파일을 무차별 stage하거나 미완료 초안/rng.js/rules.js 등 사용 안 하는 파일을 자동 포함하지 않는다. 원본 폴더의 설정/역할 변경은 별도 보존하며 이 PR에 무조건 복사하지 않는다.

## 남은 순서

1. 기존 Run 인수·메시지 처리·두 Worker 상태 확인. 인계 후 새 coordinator handle을 둘에게 알린다.
2. Jupiter 결과를 독립 검수(새 Saturn Sol high, zero writes), REVISE면 역할 소유자에 수정. 기존 실패 사례와 실제 전체 대전 정상 경로 모두 검증.
3. Mars 실제 브라우저/모달/재접속/모바일 증거 및 기본 실행 경로 확인. 임시 재시도/구 relay 경로/개발자용 UI 흔적 정리, 오프라인 보존.
4. 안정된 통합본 최종 Saturn QA 및 필수 검사. 테스트 코드 오류는 Saturn이 고치지 않고 Mars/Jupiter로 반환.
5. PD diff 검토·필요 파일만 커밋·통합 PR 및 CI6. Notion/GitHub/보고·스냅샷을 실제결과로 갱신. CJ 플레이 QA·실제 배포와 구현 완료 구분.
6. 모든 settled Worker는 release(또는 즉시한정재사용), alive/unverifiable는 보존. 최종 보고는 [결정] 및 문서 반영 위치 표.

## 역할·모델 준수

최신 권위는 원본 폴더 CLAUDE.md, docs/creat2ve/AUTHORITY.md, WORKER_MODELS.md, worker-models.json. CJ최신 Comment가 최우선. Mercury=Git/조정/운영문서·메타데이터만, **소규모 제품/런타임/툴/테스트 코드도 금지**. Venus=기획/Notion, Mars=client/tooling/test/CI, Jupiter=server, Earth=시각가이드·아트, Saturn=파일쓰기0 QA.

Mercury Astra low, Venus/Mars/Jupiter Sonnet5 medium(필요 high, 동일원인2회실패 후 Opus5 high), Earth 신규Astra medium/기존Terra medium, Saturn Sol medium(보안/정보/동기화 high). Worker 인수 명시·requested/effective/응답 확인. 계정전역 기본값/인증은 변경하지 않는다. 이번 CJ계정변경은 사용자가 수행한다.

#211 역할설정은 CLOSED; PR212/215/216 및 CI/독립QA가 완료 근거. 사용량5~10건 관찰은 후속. 이전 Unity/Roblox 작업을 #217 완료로 혼동하지 않는다. 호스팅 분석 근거는 구현경로 Mercury/hosting-evidence.md와 public-lobby-review.md에 보존되어 있다.
