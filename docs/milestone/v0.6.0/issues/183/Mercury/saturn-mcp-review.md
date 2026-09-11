# #183 MCP 점검 도구 독립 검수

2026-09-11 06:23 UTC · Saturn(Codex) READ_ONLY 결과를 Mercury가 보관한다. Task `task_bcdf50163b18`, Dispatch `ctx_1ca2755fce3f`, 완료 메시지 `msg_9ab768d5fc08`. 검수 작업 succeeded, 제품 판정 **REVISE**, 파일 변경 0. #182 전체 구현·APK와 #183 다중 Editor·테스트 실행 AC는 이번 검수 범위 밖이다.

## 통과한 항목

- `node --check tools/unity/mcp_smoke.js` 통과. 새 Codex에서 Unity MCP 도구149개 노출 및 실제 `editor_status` 호출 성공: 정확한 Digit-Duel/unity, Unity6000.6.0f1, ready, stopped, not compiling.
- 명시적 프로젝트 경로와 기본 editor_status 조회가 존재한다. 임의 `--tool` 지정은 변경 작업일 수 있다는 구분이 문서에 있다.
- 설치 후 Hub DB를 `mode=ro`로 열어 quick_check=ok. `installs.writer_kind`는 nullable TEXT, 기본값 NULL로 남아 있다. 열 수/행 수: downloads12/0, file_claims4/0, installs9/1, schema_meta2/1. 무결성 검사는 수동 변경의 원상복구나 완전한 사전 백업을 입증하지 않는다.
- Android 공식 모듈 로그 마지막 결과 success=true, 완료11개, errors/warnings 없음. AndroidPlayer의 extension DLL, adb, aapt2, platform34/36/37.0, sdkmanager, ndk-build, java, cmake 존재. 메타데이터: SDK tools36.0.0, command-line tools16.0, NDK27.2.12479018, JDK17.0.18+8, CMake3.22.1. 실제 APK의 target SDK는 별도 빌드 결과로 확인한다.

## 수정 요청 — 검수 당시 줄 번호

1. 스크립트121·134–140: initialize/result 필수 구조와 tools/call 결과 구조를 검증하지 않아, result가 없는 응답도 종료0으로 판정할 수 있다. 필수 응답 구조를 검증한다.
2. 136: isError=true에서 종료1은 맞지만 OK를 출력한다. 실패로 표시하고 오류 요약은 stderr에 쓴다.
3. 45–59: BAT/CMD를 찾지만 Windows의 shell-free spawn으로 실행할 수 없다. 안전한 실행을 지원하거나 EXE만 허용한다고 명시한다.
4. 28–40: 알 수 없는 옵션·누락 값·잘못된 JSON·유효하지 않은 timeout을 거부한다. timeout은 요청별 제한이며 변경 호출의 시간 초과가 취소·롤백을 보장하지 않음을 설명한다.
5. Mars/report.md의 active-home만 수정/default 미수정 및 새 세션 검증 대기 문구는 과거 상태다. 세 홈 등록과 Codex·Claude 실제 호출 성공 증거에 맞게 교체한다.

Mercury는 `msg_bd3076b57bfd`로 Mars_2에 수정 요청을 전달한 뒤, 06:31 UTC 소유권 반환 응답 `msg_2d8b5b665316`을 받아 별도 Mars_3 `task_1ec55e9b7f84` / `ctx_ae356384c19d`에 스크립트·회귀 테스트·#183 Mars 보고만 재배정했다. Mars_3는 실제 Editor 호출/변경을 하지 않으며 Mars_2는 #182 코드·APK와 단일 Editor writer를 유지한다. 수정 후 재검수가 필요하다.

06:42 UTC Mars_3 완료 `msg_542fb646056f`: 실제 상대경로3개만 변경했고 syntax2건·격리 회귀33/33을 보고했다. 기존 초기화 요약은 선택된 필드만 출력했으므로 capabilities 부재를 관측했다는 주장은 정정했다. 완료 직전 새 공식 계약 지시가 도착해, 같은 종속 범위의 즉시 후속으로 필수 capabilities·serverInfo.version·도구 기능 및 지원 프로토콜 확인을 보완한다. 원본 결과를 실패로 소급하지 않으며 실제 Editor 재실행과 Saturn 재검수는 아직이다.

06:47 UTC 즉시 후속 `task_e299b082ba8e` / `ctx_5f73b352a77f` 완료 `msg_1ff054869bac`: 공식 2024-11-05 초기화 계약의 필수 capabilities·serverInfo.name/version·지원 프로토콜과 tools 기능 광고를 검증한다. 같은 상대경로3개 변경, syntax2건·격리 회귀39/39을 보고했다. 실제 Unity 재실행 없이 검증했고, 강해진 응답 검증의 live 호환성은 Editor 복귀 후 확인한다. 후속 작업 정산 후 같은 terminal을 release하며 무기한 유지하지 않는다.

## 06:50 UTC 독립 재검수 — REVISE

Saturn_2 `task_35e8be64dd85` / `ctx_33db77bc250a`, 상세 `msg_7c8a1f6ad1d6`. syntax2건을 독립 실행해 통과했고 테스트 선언39개를 정적으로 확인했다. 임시 파일을 만드는 node --test는 READ_ONLY 계약상 실행하지 않았으며 보고 파일도 만들지 않았다.

- **P2 timeout 범위:** 양의 유한 Number만 검사하므로 2147483648ms가 허용되지만 Node 타이머는 이를1ms로 축소한다. 소수0.5도 문서의 정수 계약과 다르다. 정수1–2147483647 범위를 검증한다. [Node 타이머 계약](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args).
- **P2 UTF-8 청크:** stdout/stderr Buffer를 청크마다 toString하면 한글 바이트 중간이 갈라질 때 문자 대체가 발생한다. 스트림 UTF-8 인코딩 또는 StringDecoder를 쓰고 다중 바이트 문자 중간 분할 회귀를 추가한다.
- **보고 정확성:** 임의 도구 응답과 서버 stderr를 그대로 출력하므로 비밀값이 절대 출력되지 않는다는 보장은 제거한다. 실제 출력 범위와 검증한 로그를 구분한다.

초기화 필수 필드/도구 기능/버전 협상, result 누락·isError, 옵션/JSON 검증, BAT/CMD 거부·shell-free argv, 기본 조회와 임의 변경 도구 구분은 수정됐다. 종료 시 child.kill만 호출하므로 SIGTERM을 무시하는 POSIX 서버의 종료 대기는 남은 이식성 한계이며 이번 Windows에서 관측된 차단은 아니다. live 재실행·다중 Editor·CJ 수락은 별도다.

검수 SHA256: mcp_smoke.js `2AC7577ADAED4B1445500F8CD797B913D254917A569F03A7D1B31827B73E34C4`, mcp_smoke.test.js `C4C9A6E2D3DC530D5C19967C614C1375799F165E4F641F3E942082913545A446`, Mars/report.md `C7D25276C9E74A02CA7DC32BB4BF5846B57EBE7369E13EE610F537BC127EF678`.

06:58 UTC Mars_4 `task_8ceca8bb3f44` / `ctx_c2fb2ad0b9af` 완료 `msg_de6056313cd8`: timeout 정수 범위·stdout/stderr StringDecoder·출력 설명 수정, 실제 상대경로3개 변경을 수락하고 archive/release했다. syntax2건·회귀46/46이며 Mercury도 06:58 UTC 같은 node --test를 실행해46/46을 확인했다. 작업 중 저장소 루트 재귀 grep이 확인돼 tools/unity 한정 조회로 정정했다. 사용자 경로 내용 수정은 보고/관측되지 않았다. 강화된 도구의 live 재실행과 독립 최종 검수는 별도 진행한다.
