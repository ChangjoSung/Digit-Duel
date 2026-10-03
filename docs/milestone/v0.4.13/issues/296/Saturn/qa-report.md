# #296 독립 QA — Mercury 기록

2026-10-02 18:46 KST · Saturn_1의 읽기 전용 검토 결과를 Mercury_PD가 기록했다. Saturn은 제품·테스트·보고서 파일을 수정하지 않았다. 이 기록은 최초 검토 시점이며 수정 후 최종 판정은 통합 PR 및 외부 완료 영수증에 기록한다.

## 최초 판정: REVISE

- 검토 HEAD: `d3e061b1f7d1f3c646af7a66e1c2a52384aadf30` (clean). accepted `worker_done`: `msg_ad24d8225bdf`, dispatch `ctx_bb83d9a27525`.
- 모델 게이트: 현재 턴 JSONL + exact terminal footer + 실제 PID 22060 argv를 시작·GO 직전·완료에 대조했다. `gpt-6.1-sol` / xhigh / `service_tier=default`(No Fast) / danger-full-access / never. API 실제 priority는 노출되지 않는다.
- 원본 CJ 콘티를 직접 열고 기존 실제 렌더 10장·fresh 실제 렌더 3장을 대조했다. 당시 필수 CI 6/6 PASS를 재사용했고 전체 회귀·네트워크 매트릭스를 반복하지 않았다.
- **제품 결함**: 온라인 390px 화면에서 감정표현 버튼이 페이지 `(292,8)`에 남고 배틀 자리 `(272,169)`로 이동하지 않았다. 싸우기 메뉴 전환 뒤에도 불일치했고 자리 높이는 0이었다.

| 독립 확인 | 결과 |
|---|---|
| 내 스킬 설명 4줄·미해금 소개 3줄, 잠긴 줄 읽기 전용 | 확인 |
| 상대 스킬 표시 없음, 범위·`?` 없음, 양쪽 기본 6스탯·실제 등급 경계 | 소스/실제 렌더 대조 |
| 현재 전투원·canonical `ownSyn.stage` 선택, 보드 역산 미사용 | 소스 대조 |
| 실제 포인터 메뉴 이동·뒤로·잠긴 줄 입력 | 전송 0·행동 소비 0 |
| 온라인 `usable` 누락 | 실제 DOM에서 사용 불가 |
| 보이는 버튼·문서 가로 넘침 | 버튼 44px 이상·가로 넘침 없음 |
| 배틀 상단 감정표현 위치(진입·메뉴) | **REVISE** |

명령은 기존 Room이 만든 좌석 뷰와 transport spy를 사용하는 inline PowerShell → Node 실행이다. 실브라우저 **표시/입력 fixture 증거**이며 실제 브라우저 WSS·로그인부터 전투까지의 전체 흐름 증거가 아니다.

첫 명령: 9 PASS / 3 FAIL, exit 1. 두 실패는 위 감정표현 제품 결함이다. 남은 상대 차례 실패는 같은 페이지의 좌석 전환 캐시를 섞은 fixture 문제였다. 실패만 fresh 반대 좌석으로 확인한 두 번째 명령은 0 PASS / 1 FAIL, exit 1(한국어 assertion의 PowerShell 전달 인코딩 오류). 캡처한 DOM은 상대 시계 없음·스킬 줄 0·대기 표시 있음이었으므로 **이 두 fixture assertion 실패를 제품 결함이나 PASS로 바꾸지 않는다**.

증거와 실제 inline 명령 로그: `C:/Users/pc_77/orca/artifacts/Digit-Duel/issue-296/saturn-qa/`의 `online_390_root.png`, `online_390_fight.png`, `online_390_foe_turn.png`, `focused-check.log/json`, `foe-turn-failure-only.log/json`, `inline-command-1.log`, `inline-command-2.log`.

## 후속 범위

Mars가 기존 #295의 자리 크기·헤더 배치·`emoteSync`를 재사용해 배틀 진입·메뉴·스크롤·종료 경로를 수정한다. fresh Saturn은 수정된 배치 경로만 대표 1회 확인하고 변경되지 않은 최초 QA/구현 회귀를 재사용한다. 이후 최신 HEAD의 필수 CI 6개가 필요하다. 실제 브라우저 WSS 전체 흐름과 CJ 플레이 QA는 별도 미검증 범위다.

최종 영수증: `C:/Users/pc_77/orca/artifacts/Digit-Duel/issue-296/implementation-completion.json` (최종 QA·CI 확인 뒤 Mercury 기록).
