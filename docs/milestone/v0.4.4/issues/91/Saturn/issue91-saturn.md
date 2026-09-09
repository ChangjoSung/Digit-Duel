# Issue #91 — Saturn_1 최종 PASS

2026-09-07 · Mercury가 Saturn inline 보고 `msg_10f396550f76`와 완료 `msg_009c82acf714`의 검증 근거를 보존했다. Windows 전송 중 한국어 일부가 `?`로 손실됐으나 아래 판정·해시·명령·검사 수·파일 변경 없음은 수신 메시지에서 확인된다.

- 역할: Saturn_1 / QA / QA / mutation=none / instance_index=1 / Codex, `files_modified=[]`, reportPath 없음. Task `task_a666200c569a`, dispatch `ctx_c7c21e93ba4a`, 완료 후 release.
- 검수 HEAD: `0323bb6ede1c6e133c437b9644fc403dcc878238`.
- **PASS: 최초 K8b 송신 검사 REVISE 해소.** 실제 연결 소켓의 `ws.sent` 증분을 검사하고 불필요한 송신을 같은 검사기로 탐지한다.

## 직접 재검수

| 검사 | 결과 |
|---|---|
| `node demo/test/smoke_minion_art.js` | 199 PASS / 0 FAIL, exit 0 |
| `tryCapture` 진입에 `netSend`를 넣은 HTML 메모리 사본, 원래 검사기 실행 | 198 PASS / 1 FAIL: K8b, 양 인스턴스 실제 송신 1 |
| `finishByCapture` 진입에 `netSend`를 넣은 메모리 사본, 원래 검사기 실행 | 198 PASS / 1 FAIL: K8c', 양 인스턴스 실제 송신 1 |
| 새 소켓으로 송신한 뒤 원래 소켓으로 복귀하는 메모리 사본 | 198 PASS / 1 FAIL: K8b, 소켓 생성 감시로 탐지 |
| 원본 K8d | 실제 `netAction→netSend→ws.send` 1회·payload·동일 검사기 거부 확인 |

변형은 Node stdin에서 `fs.readFileSync`의 `demo/index.html` 읽기만 메모리 문자열로 대체했다. 파일·변형 HTML·스크립트·JSON·스크린샷 작성은 없다. `git diff 3360d56 HEAD`로 제품·harness 불변, 테스트 K8만 +19/−6임을 확인했다.

## SHA-256

| 파일 | SHA-256 |
|---|---|
| `demo/index.html` | `90224fe64b89e2b9919ad9266d022cee38ee4159d92cec82b93c17e867c4cf2c` |
| `demo/test/harness.js` | `c04df34ccb04a36fbc34598b046d523292e85b9005ea4ddccabf0f750919e765` |
| `demo/test/smoke_minion_art.js` | `ea6d573eee183f1e8481f36b7e88323332857abcefaa0d5834ab6db9c31088c1` |

## 기존 검증과 한계

[최초 독립 검수](issue91-saturn-initial.md)의 5스위트 480개에는 예전 minion_art 197개가 포함된다. 이번 199개와 중복 합산하지 않는다. 최종 스모크 검사 기준으로 Saturn 직접 검증은 199+기존 다른 283개이며, 최초 CDP 9+82=91측정 문제 0·기존 이미지100개 동일 근거는 제품/harness 불변으로 유지한다. 온라인157개는 Mars 검증이며 Saturn 직접 실행이 아니다.

실제 온라인 2연결의 end-to-end 포획/대리 출전, 사람의 미술 품질 판정, AI 자발 포획 전체 플레이는 미검증이다. K8은 연결된 기록형 소켓과 두 독립 상태 인스턴스의 단위 검증이다. 추가적인 프로토콜·게임 규칙 변경은 없다.

남은 단계는 PD의 dev 통합과 CJ 플레이 확인이다. v0.4.4 출시 승인을 뜻하지 않는다.
