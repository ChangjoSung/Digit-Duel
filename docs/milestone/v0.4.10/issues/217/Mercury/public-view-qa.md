# Public-view delta 독립 QA — PASS

2026-09-13 14:47 KST. Saturn task_27035bc28752 / ctx_f43421692c79 / worker_done msg_793a7eca45ec. 파일 쓰기0, Mercury 전사. 정산 후 release 완료. 클라이언트/브라우저 PASS가 아니다.

검증 명령: `node authoritative/test/test-public-authority-delta.js`, `node authoritative/test/test-match-fuzz.js`, PowerShell here-string을 `node -`로 전달한 독립 fixture 2종, server 디렉터리에서 `npm.cmd test`. bare npm은 로컬 npm.ps1 실행 정책 때문에 거부되어 npm.cmd 사용.

결과: 신규 delta37, fuzz16, 독립 fixture50 단언 PASS. 전체 package chain scheduler32/isolation18/room57/security61/authority176/FX420/delta37/fuzz16/WebSocket50/HTTP24/launcher47 PASS.

독립 검증 범위: S.current와 방어자 전투 행동자 구분, 실제 강제대상 선택, 정상 tele 1→2→swap, 방어자 소유 fleeSwap, 강제/tele 상태의 skip·auto-end 거부와 optional battle endTurn 허용, visible alias membership와 hidden/raw turn ID 차단, 종료 전 보드/기술 은닉, 반환 중첩 객체 변조 격리, FINISHED에서만 alive·placed 상대 말 공개, CANCELED/VOID/CLOSED 빈 보드, 빈 FX 창·resync·연속 전투의 battleId 일치. Fixture 구성 후 엔진/API를 실행한 검사이며 실브라우저 E2E로 승격하지 않는다.

검사 중 유지된 SHA256:

- room.js: 92CDBFE4D7BE6C73711779E89D76E9D5830D3394A6C1E3CC2549A09DF8475086
- engine.js: 55BFFA0B694C1AC582BCD6DD44CF9DD4FA5520B7D489100F99B43D8100CECBB5
- test-public-authority-delta.js: 8240E3F86FB8BD0A93E92A88024AE1935EA0AD10810205DBA370BC5D01CF4335
- test-match-fuzz.js: 00A7E5C924368ADB5D25FDAC18E3120B87AED696B7DF1368255C464584ADC853
- server/package.json: 6AC9555079794A949E49179C786A19A73EBFD60F1D0656B21914727E4DCC34CB
- Jupiter/public-view-delta.md: B3BD7945C51A8F77053A3D34DAE07DF7E52A3E3046DFB8ABE93E90D7BCA86874

Mars가 동시 수정한 demo/index.html 해시는 11AB3B70B14FF3BFC69BF010D3D93BD31437D2CA7F9455567210539FFDC54601 → 2652DBD2D6EECD2AAE9DC87B443B241A46016A4AF518E793A27973F31F15469A. harness.js는 8175D69D5F494E4D5E1D748F4A7C1395BD1D1146C902E465D4733F2EFF8675EB 유지. 이 동시 변경은 서버 소스 변경과 구분했다.

유일한 비차단 문서 결함: Jupiter/protocol.md 165·174행의 옛 FX229 표기. 실제 최신 관측은420, public-view-delta.md는 이미420. Jupiter task_ff798b039dd1 / ctx_25b2fdd04562에 문서만 정정 배정했다. 수정 전 protocol SHA256 F6C1BA5295EBC70E817E692C513E6F2C510F1EBA6DF9015E6BA7F2672D469977. 새 runtime 결함은 발견되지 않았다.

14:48 추가: Jupiter 정정 worker_done msg_4e28d9ae6ad6 수리/release 완료. Mercury가 protocol.md 165·174행의420 관측 기준 명시와229 잔존 부재를 읽기로 확인했다. 문서 결함도 해결됐다.
