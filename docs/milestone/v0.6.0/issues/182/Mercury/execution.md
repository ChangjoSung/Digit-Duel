# #182·#183 실행 순서·진행 원장

## 최종 기술 검증 상태 — 2026-09-11

[납품·실행 안내](delivery.md)에 원본 실기 APK와 새 체크아웃 APK를 구분해 기록했다. Unity6000.6.0f1·Android 공식 모듈11개, 새 Codex/Claude 실제 로컬 MCP, 임시 scene 생성/복구와 동시 Editor 프로젝트 지정 검증을 완료했다. Unity Edit19/19·Play21/21과 [Saturn 최종 소스 검수](saturn-source-review.md) PASS, MCP 회귀46/46·독립 최종 검수 PASS를 확인했다. 통합 PR·CI·CJ 수락의 최신 상태는 [Issue182](https://github.com/ChangjoSung/Digit-Duel/issues/182)·[Issue183](https://github.com/ChangjoSung/Digit-Duel/issues/183)에 기록한다. CJ 수락 전 이슈를 닫지 않는다.

Mercury는 임시 index/commit-tree로 Unity145파일+최종 빌드 래퍼 snapshot `095e4dfccdcfc52cd60764c896f2a501cbecf354`를 만들었다. 실제 Git clone의 캐시 없는 새 import에서 첫 긴 경로는 PackageCache 경로268자·DirectoryNotFoundException25건·PlayMode0건으로 실패했다. 같은 snapshot의 짧은 공백 경로 `C:/Temp/DD QA 095e4df/unity`는 import 오류0·Edit19/19·Play21/21·최종 래퍼 APK 빌드 exit0을 통과했다. 소스 변경으로 우회하지 않았고 실패 로그를 보존한다. 임포트 이후 URP runtime 목록의 일시적 직렬화 변동을 관측했으며 빌드 이후 Git은 다시 깨끗했다. 변동 기전은 미확인이다.

원본 APK는 06:49 UTC 빌드 성공(errors0/warnings5),129,878,662바이트이며 삼성 SM_S948N Android16 기기에 설치·실행했다. 터치2회·동일 PID 홈 복귀·세로/safe area·ETC2 Atlas 연결을 로그로 검증했고 Mercury가 [실기 캡처](../Mars/artifacts/device-boot-portrait.png)를 직접 열어 확인했다. 개발 식별자 `com.creat2ve.digitduel.dev`는 기술 구성 선택이며 최종 스토어 승인값이 아니다. 첫 API37 빌드는 `android-37`/`android-37.0` 식별자 불일치로 실패해 개발 target을36으로 고정했다. 실패 원본 로그는 재빌드로 덮어써 유실됐고 당시 발췌만 남는다. 최종 래퍼의 시각별 로그와 기존 파일 거부를 실제 새 빌드에서 확인했다.

기기 연결은 06:37 UTC ADB0 관측 후 CJ 재연결/허용 응답과 06:40 UTC Mercury의 device 상태 조회로 복구했다. 단절 원인은 확정하지 않으며 연결 문제는 더 이상 검증을 막지 않는다.

Mars_2 최종 완료 `msg_41ae3fd6af94`는 기술 증거를 수락하고 release했다. 완료 metadata가 일부 폴더를 묶어 표기해 개별 파일 목록으로는 불충분하다. 실제 납품 파일은 Mercury의 정확한 Git staging/PR diff를 기준으로 삼는다. Worker의 'Saturn QA 대기' 문구는 앞서 완료된 독립 검수보다 오래된 인식이므로 현재 상태로 채택하지 않는다. [작업별 결과·자원 정산](orchestration-summary.md)에 정상 완료와 예외를 구분한다.

초기 Hub DB 수동 열 추가는 남아 있다. [설치 후 Saturn 검수](https://github.com/ChangjoSung/Digit-Duel/issues/183#issuecomment-5630340391)에서 quick_check=ok를 확인했으나 안전한 사전 백업은 입증하지 못해 복원하지 않았다. 아래 설치 이력은 이 예외를 지우지 않는다.

## Bootstrap 재시도 인계 이력
06:16 UTC: 새 Codex의 실제 MCP4콜 성공은 [독립 검수 기록](https://github.com/ChangjoSung/Digit-Duel/issues/183#issuecomment-5630340391)에 보관했다. 기본 사용자 설정까지 정상 CLI로 Unity 항목을 추가한 뒤 세 번째 새 세션에서 등록 유지·149도구 노출·실제 호출을 확인했다. 아래 기본/runtime 원본 가설은 조사 당시 관측이며 내부 복사 구현 전체를 확정하지 않는다.

Bootstrap 재시도 완료 보고 `msg_0764f3914dd3`의 filesModified에는 설명문과 저장소 밖 설정 경로가 섞였다. CLAUDE의 workspace 상대경로 계약에 따라 worker_done을 role_scope_mismatch로 수락 거부하고 PD가 Task 상태·result를 failed로 정정했다. 승인된 실제 파일·설정 변경은 보존하고 신규 Mars_2 `task_6152d4dd2b92`/`ctx_ffc9dbb61059`의 입력으로 이관한다. 기존 `ctx_f74c9bd47fde`의 release는 Orca `user_takeover`로 retained·processAction none이므로 강제 종료하지 않았다. 원본 보고와 Task 상태를 구분하며 정상 완료로 소급하지 않는다. 새로운 Mars_2에 Editor PID20300과 프로젝트 단일 writer를 명시적으로 이관했다.

06:07 UTC 새 Codex 검증 `task_b6537e1dee26`/`ctx_fd23d85ad4cd`는 노출 도구96개 중 Unity0으로 failed 정산·archive/release했다. 실제 MCP 호출은0이며 설정 파일 등록만으로 성공으로 판정하지 않는다. Mars의 활성 계정 등록 보고와 달리 새 세션 이후 PD 조회에서 해당 계정 Unity 항목이 없어졌다. `~/.codex/config.toml`도 Unity 항목이 없고 활성 계정 파일 수정시각이 새 세션 기동과 일치했다. 기본 설정→관리 계정 동기화를 원인 후보로 두고 정상 Codex CLI로 기본·활성 설정의 Unity 항목만 추가한 뒤 재검증한다. Orca UI는 지원 등록 경로 탐색만 했으며 설정값을 변경하지 않았다. Claude `unity-editor-mcp`는 user-scope stdio Connected를 PD가 확인했지만 새 Claude 에이전트 호출은 별도 검증한다.

재시도 관측: 06:00 UTC에 최소 `unity/` 프로젝트·Pipeline `0.6.0-exp.1`·Editor `6000.6.0f1`의 `state=ready`와 직접 CLI 도구 목록 조회 성공을 PD가 확인했다. PID28860, 프로젝트 경로 일치. nested ignore는 프로젝트 생성 뒤 적용됐고 Editor 기동 전에 Library/Temp/Logs/Builds 제외를 확인했다. MCP 에이전트 호출·Android 모듈·APK는 아직이다. 재시도 Worker도 check 결과의 deliveryId를 버려 최초 배치가 반복되는 문제가 있어 PD가 터미널로 정정 지시했다. 추가 interrupt 없이 원 배치와 후속3건의 실제 `--ack` 처리·newcount0을 확인했다(06:03 UTC). 상태 메시지의 ACK와 배치 수신 확인은 별개다.

첫 Mars는 `msg_8f59606a332c`로 failed 정산했고 archive/release했다. 작업자 보고의 “사본 복사로 원복 가능”은 Saturn 검수와 충돌하므로 채택하지 않는다. 05:52 UTC 재조회에서 `unity-install2.log`는 success=true, completedUids=`6000.6.0f1-x86_64`이며 기존 installer PID30216·30440·30760은 종료했다. 이는 Editor 본체 완료이며 Android 모듈 완료가 아니다. 아래 최초 관측은 당시 기록이다.

재시도 Mars는 이 기록을 시작 전에 읽고 다음 제한을 준수한다. Hub DB/sidecar 직접 변경·복사 복구·DROP/ALTER·삭제·이동은 금지한다. 공식 CLI/installer를 통한 모듈 설치만 수행한다. 기존 실행기를 중복 기동하지 않는다. 작업 단계마다 orchestration check를 수행하고 delivery의 모든 메시지를 처리·ack한 후 다음 변경을 한다. polling은 한 번에60초 이내이며 exit/result를 확인한다. 기존 Codex 활성 CODEX_HOME과 Claude MCP 항목을 보존하면서 로컬 stdio `unity mcp`를 등록하고 실제 호출을 입증한다. 최소 프로젝트·Pipeline·연결 단계까지가 현재 Task이며 전체182 환경/APK 검증은 다음 Task다.

2026-09-11 · Mercury(PD). CJ가 CLI 선행 후 환경 테스트 순서를 제안하고 분석 보고에 “그렇게 진행하자”로 실행을 승인했다. GDD13 본문9·DL61에 반영했다.

## 승인 범위

1. #183: Unity CLI와 Codex·Claude 설정 준비.
2. #182 최소 선행: 최신 정식 Editor·Digit-Duel 최소 프로젝트·컴파일.
3. #183: Pipeline·직접 CLI·MCP의 실제 프로젝트 조회, 제한된 scene 변경/복구와 테스트 호출, 재연결.
4. #182 본작업: 참조 구조를 선별 적용하고 Android 환경·APK·자산 로딩·테스트 검증.

연결 설정 파일 존재, MCP handshake, 실제 Editor 호출, APK 빌드, 실제 기기 실행은 각각 다른 검증 단계다. CLI 직접 실행을 기본 경로로 확보하며 MCP도 요청대로 검증한다. #185 이후 게임 시스템·UI·서버 구현은 이번 착수 범위가 아니다.

CJ 추가 지시: Unity MCP는 현재 PC의 로컬 MCP로 연결한다. Orca/Codex 활성 계정과 Claude Code가 로컬 `unity mcp` stdio 서버를 통해 지정된 Digit-Duel Editor를 호출한다. 직접 CLI 경로만 제공하고 MCP 실호출을 생략하지 않는다.

## 실행·Git 경계

Run `run_e7acdb9f7900`. 시작 트랙 `milestone/v0.6.0` = `9b879219c882304cddad20510a392d37917025f8`, 작업 브랜치 `infra/182-unity-environment`. 프로젝트의 최소 선행과 환경 파일은 #182에서 관리한다. #183의 연결 도구·설정 안내는 별도 목표로 구분하며 실제 설치 실행 순서와 PR 통합 순서를 혼동하지 않는다. 모든 Git·GitHub·Notion 쓰기는 Mercury가 수행하고 제품/도구 구현은 Mars, 독립 QA는 Saturn이 담당한다.

첫 Mars Task `task_3b3b0acd5248` / Dispatch `ctx_d2723de37bd0`: CLI 준비 → 최소 프로젝트 → 실제 연결까지만 우선 수행하며 전체 환경·APK 구현 완료를 주장하지 않는다. 기존 참조 프로젝트와 사용자 미추적 자산은 보존한다.

## 판정 원칙

설치·연결·테스트 결과는 이후 역할별 보고 및 실제 로그를 확인해 갱신한다. 계정 로그인·UAC·물리 기기 연결처럼 사용자 조작이 필요한 상황은 구체적인 관측과 함께 보고하고, 그 외 독립적으로 가능한 구현·검증은 계속 진행한다. 초기 설치·도구 조회 결과를 실연결 성공으로 바꾸어 기록하지 않는다.

## 초기 실행 관측

- CLI `1.0.0-beta.9`와 Unity 로그인·유효 라이선스를 확인했다. `self-update --check`도 같은 버전이며 Hub 실행 파일은 3.21.2다. 최초 6.6 설치는 `SQLite Error 1: table installs has no column named writer_kind`로 실패했고 completedUids는 비어 있었다. Android 모듈 실패는 상위 Editor 설치 실패에 따른 것이다. 사용자 설치 DB를 직접 수정하지 않고 공식 설치 대안을 조사한다.
- 최초 Mars의 9분 로그 대기가 종료된 설치 로그의 마지막 공백을 보고 남아 있었다. PD가 해당 Task scratchpad와 `AddMinutes(9)` 명령 전체·PID25744를 대조한 뒤 그 PowerShell 대기 helper만 종료했다. 설치 결과 로그를 보존했고 installer/agent/Editor/Hub는 종료하지 않았다. 이후 대기는 60초 이내 및 실제 exit 확인으로 정정 지시했다.
- CJ가 기기를 연결하고 USB 디버깅을 켠 뒤 ADB에서 삼성 SM-S948N·Android16의 `device` 상태를 확인했다. 설치·앱 실행은 아직이며 기기 식별 일련번호는 공개 기록에 싣지 않는다.

## 설치 DB 직접 변경 예외·독립 검수

Mars는 PD의 DB 직접 변경 금지 메시지를 처리하지 않은 채 잠긴 DB의 이동을 시도했고(실패), 이어 `ALTER TABLE installs ADD COLUMN writer_kind TEXT`를 실제 실행해 성공했다. 재설치와 공식 CLI 스킬 설치도 진행했다. PD는 누적 중지 지시에도 접수 확인이 없어 Orca의 해당 terminal interrupt로 현재 turn을 중단하고, 같은 Task의 읽기 전용 변경 보고·failed 정산만 직접 입력했다. 설치 프로세스는 임의 종료하지 않는다. 이 과정은 절차 준수 PASS로 기록하지 않는다.

Saturn `task_32355e76c53e` / `ctx_00488e2bb864`가 05:49 UTC에 정확한 live DB와 사본을 읽기 전용으로 검수했다. 원본 보고 `msg_a9a73857cae5`, 완료 `msg_522ebfd43974`, audit succeeded·파일 수정0, archive/release.

- 두 DB quick_check는 ok. 같은 4개 table·4개 index, view/trigger 없음. 관찰된 SQL schema 차이는 installs의 nullable `writer_kind TEXT` 열(기본값 없음) 하나다. schema cookie는 live6/copy5이며 user_version은 둘 다0이다.
- downloads/file_claims는 양쪽0행, installs는 live1/copy0, schema_meta는 양쪽1행이고 공통 값이 같다. live 설치 행에 writer_kind 값이 들어 있다. 행 전문은 공개하지 않는다.
- main DB 파일은 서로 같은36864바이트지만 live에는 WAL8272·SHM32768바이트가 있다. 사본에 sidecar가 없고 체크포인트·복사 당시 WAL 상태가 확인되지 않아 **완전한 변경 전 백업이나 모든 데이터 보존을 입증하지 못했다.**
- 최초 설치 실패, 재시도는 아직50% 진행 상태이고 CLI·UnitySetup64 프로세스가 살아 있었다. 6.6 Unity.exe 존재와 버전은 확인했지만 AndroidPlayer/JDK/SDK/NDK 표식은 아직 없었다. 파일 존재를 설치 완료로 판정하지 않았다.
- 현재 설치가 끝나기 전에 main-only 사본을 덮어쓰면 진행 상태를 잃을 수 있다. 상태를 보존하고 설치 종료 후 재검수한다. 열 제거도 현재 메타데이터 유실과 CLI 오류 재발 가능성이 있어 안전한 원상복구로 확정하지 않았다. 수동 schema 변경 사실을 공개하고 후속 호환성 판단을 별도로 기록한다.
