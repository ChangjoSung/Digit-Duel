# #293 독립 QA 기록 — Mercury 작성

- 판정 주체: Saturn(읽기 전용) · 기록 주체: Mercury_PD. Saturn은 제품·테스트·보고서 파일을 수정하지 않았다.
- 대상: `0e3afc032f0d3f54e138e585a45e575058fd3129` · base `4f638a12dbab5e85b5b3b8d1d50ab17d029ea5b3` · 기존 Issue #293 / PR #305.
- Task `task_7654cd492e75` · dispatch `ctx_1a0b862375ac` · terminal `term_72147b7a-30ff-48c7-8486-97309c064ba8` · thread `01a0f506-2980-7810-ad38-f224302027ee`.
- **독립 QA PASS**: 2026-10-01 10:35 KST, 실제 완료 메시지 `msg_130471e85d33`(01:35:09Z). CJ 최종 플레이 QA나 Release 판정은 아니다.

## 모델·권한 게이트

새 세션의 실제 turn_context는 `gpt-6.1-sol/xhigh`, approval `never`, sandbox `danger-full-access`다. 샘플링의 실제 `feedback_tags`는 `service_tier=default`(No Fast)이며 시작 GO와 완료 직전에 각각 재조회하고 footer·전환 팝업을 대조했다. native argv도 동일하며 읽기 전용은 역할 제한이다. 처음 요청이 입력란에 남아 `turn_start_unobserved`였던 상태는 같은 입력에 Enter 1회로 이어 제출했다. 재전송·중복 dispatch·미확인 모델의 정식 결과 재사용은 없었다.

## 검증과 판정 범위

| 영역 | 근거·결과 |
|---|---|
| 자동 검사 | `node demo/test/regression/smoke_issue293.js` **정확히 1회, 59 passed / 0 failed / exit 0** |
| 카드·색상 | 구매/필드/가방/교체/트레이/기여의 기존 아트와 실제 4정보, 가격과 독립인 등급 1~5, 시너지 미달/순위 0~4, 선택/사망 별도 표시 대조 |
| 거래·교체 | S01 판매·원장 환급·종 잠금, 가방 액션 한 줄, 필드 6칸 적격성·HP 이동·요청 1회·단절 가드, Esc/Tab/포커스는 코드·자동 검사 및 Mars 실제 입력 증거 대조 |
| 기여·진행 | owner/미선택 리더/가방 일반/가방 전설/포획 동결 필터, 직접 완료/시간 초과/준비 취소, 공개 상대 ready만 표시, S05 기존 모달 보존 대조 |
| 시각 | CJ 원본 2장과 실제 Mars `02/03/05/06/08/14/15`, 모의 상태 `10`을 직접 열어 비교. 390px·320px 한 줄·아트·44px 버튼, 7×13 보드 46px/37px 정사각(기존 최소32), 트레이14, 마지막 행 내부 스크롤 도달 증거 대조 |
| AC10 | 승인된 UI 단언 9건(위치/픽스처7 + 오프라인 순서2)만 변경, 경제·시계·HP·보안 수치 단언은 무수정임을 독립 diff 확인 |

검사 수를 늘리는 전체 회귀·typecheck·브라우저 네트워크 매트릭스는 되풀이하지 않고 Mars의 영향 회귀/입력 실측 증거를 재사용했다. `filesModified=[]`, QA 당시 WorkTree clean이었다. 비차단 문서 지적 `Mars/report.md:6`의 "전부 자리 이동/AC10 충돌" 표현은 Mercury가 최신 Venus 분류에 맞게 정정했다. 이 정정과 QA 기록·운영 메타데이터는 제품 blob을 바꾸지 않는다.

## 별도 게이트·한계

- 최신 최종 PR HEAD의 필수 CI 6개는 PD가 게시 후 독립 확인한다. **현재 결과는 [PR #305 Checks](https://github.com/ChangjoSung/Digit-Duel/pull/305/checks)의 최신 HEAD가 기준**이다.
- 완료 대기 이미지 `10/11`은 공개 방 값을 넣어 같은 렌더러로 그린 모의 상태다. 실서버 브라우저 E2E는 미실행이며 PASS 범위로 주장하지 않는다.
- 상대 01/02 구분은 공개 데이터가 없어 미표시(R1). 별도 CJ 결정·Jupiter 계약 없이 추가하지 않는다.
- CJ 플레이 QA·병합·main Release·Render 배포·#294/#295 전면 개편/#296은 이 판정 밖이다.

## CI 보정 추가 독립 QA — Mercury 기록

- 2026-10-01 11:14 KST **PASS**, 완료 `msg_26cf6c7ca7e5`; fresh task `task_9572b75d4426` / dispatch `ctx_21f4612070bf` / thread `01a0f534-4f1a-7ca0-8d47-0cb76164f454`. 시작/완료 실제 `gpt-6.1-sol/xhigh/default(No Fast)` · `danger-full-access/never`와 현재 footer/argv를 각각 새로 확인했다.
- 후보 `5e605cd40c0ad6c997ac25a876ab42dba57cc156` 대 `2c8bebdc4ad6b939fa9d26d7fe5070ed4b605dd9`: Venus AC10·Mars CI 보고·기존 #122 검사만, 정확히 3파일. A12 표시/현재 단계, A14 경제 모드 재진입 잠금, 새 A14b 비경제 전환 보존을 실제 UI/Core와 대조했다. 기존 98 = 수정 2 + 무수정 96, +새 1 = 99; 규칙·수치·보안·경제 단언을 삭제/약화하지 않았다.
- `node demo/test/milestone/v0.4.6/issues/122/issue122_rules.js` **정확히 1회: 99 passed / 0 failed / exit0**. 다른 검사/typecheck/브라우저/CI 재실행 없음.
- 제품·기존 다른 7검사·워크플로·최초 승인 UI 기대값 9건은 최초 QA `0e3afc032f0d3f54e138e585a45e575058fd3129` 이후 불변, 13AC/R1/R2 보존. 따라서 최초 QA는 불변 범위에만 재사용한다. QA 전후 HEAD 동일·status clean, `filesModified=[]`, Saturn 파일 작성 없음.
- 전체 현재 목록은 변경된 기존 UI 기대값 **11건 + 새 A14b 1건**이며 앞선 최초 QA의 9건 기록은 그 당시 범위다. 이후 문서 정정/QA 기록 커밋은 제품·검사 코드를 바꾸지 않는다. 최종 HEAD CI/CJ 플레이 QA/실서버 E2E의 별도 한계는 위와 같다.
