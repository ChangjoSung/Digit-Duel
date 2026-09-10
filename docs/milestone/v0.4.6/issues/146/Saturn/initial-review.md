# #146·#131·#128·#130 Saturn 1차 독립 검토

- 검토: 2026-09-10 Saturn(Codex), Task `task_f5b084b02fb8`, Dispatch `ctx_2f5db1c96932`.
- 보존: Mercury. Saturn은 파일을 생성하지 않고 inline 보고했다.
- 판정: **REVISE**. 아래는 해당 시점의 제한된 검토이며 최종 납품 QA가 아니다.

## 원 보고

[피드백] 제한된 1차 제품 검토 완료, 판정 REVISE이며 최종 제품 QA/출시 판정 아님. Preflight READ_ONLY_QA/Saturn/QA/QA/none/index null/Codex 일치; files_modified=[]; 보고서·임시파일·이미지·프로필 생성 없음. CLAUDE.md 전체와 #146 Venus 계약 전체 확인. HEAD 33bbc19e9c1ec5314903c3d6f77ecc7c5f6a9051, 검토 제품 demo/index.html SHA256 3f094eef72315e75edf0061fe418f3b10bb0766451395170d8b3ffe888449f13, 실행 전후 동일. 확정 결함: (1) P1 :2363 동일 pass 코어 콜백이 R1 후공D→R2 선공D 두 행동을 소모, msgQ 잠금도 통과; (2) P1 :2493 execSlot(A,-1) 4슬롯 기본공격 차단 누락 및 :2489 사신 봉인+다른 합법슬롯 존재 시 기본공격 폴백, 각각 HP90→73/100→81; (3) P1 :2368 pass 공개 blog에 행동불가 사유 노출; (4) P1 :1428/:1573 teleport 거부 addLog가 :1174 공용 렌더를 통해 비소유 화면에 노출; (5) P2 :1556 대상이 실제 현재 보드 말인지 검증 없어 복제 객체로 실행 시 원래 말과 목적 말 중첩 및 주행동 소비. 재현 상세는 msg_d41dede907e6 및 msg_104fd3ea9772. 독립 node stdin/in-memory harness 통과: pass 합법슬롯 존재/다른 actor/다른 전투 거부; 실제 쿨링수 후 CD0 및 stale pass 거부; pass 비경계에서 RNG0·weaken/focus/vuln/dmgCut 유지, 라운드 경계에서 CD1 감소·화상 HP6/보호막100 유지·감전1 소진·아이템/볼 초기화; fullHP 도망 기본0.3/버프0.7에서 seed2=0.73425 실패, HP불변/phase1/RNG정확히1; noAtk 안내·pass버튼·hint PVE/online 비소유 마스킹 및 핫시트 소유 표시; teleport 양끝 immobile/owner/alive/placed/동일말/mainUsed 거부와 상태·RNG 불변, trap유닛 자체 허용, 접촉예산 초과 거부; NET 양측 pass 정상 applyAction 재생 phase1 일치; 보호막 보조18+22=40/30+22=52, 공격110+10=120, 레거시18+15=33. 정적 확인: 지정 teleport 2단계 문구, 첫말 재클릭/접촉차단 stage1 복귀, 새 hint의 별도 DOM·게임상태 미변경 구조, 왕·동료 본체 basic 경로 유지. 미검증: 실브라우저 시각 QA(검토용 Mars 이미지가 제공되지 않음), 물리2PC, 실제 WebSocket 전송·재접속, AI 양난이도 완주, 3/6라운드 종결과 fleeSwap 전체 회귀, hint의 실제 포커스/모달 영향; full18/smoke_online/광범위 변이 반복 안함. #128은 기존 실측의 신고증상 미재현/원인 미확인/저장로직 유지 상태로만 취급하며 해결 PASS 아님; #121/125/129 CJQA CLOSED와 새4건 CJQA OPEN/v047 미출시/v045 정식 상태 유지. 초기 git status --short 실행이 금지 대상 이름까지 열거한 절차상 일탈을 명시하며 해당 대상의 내용·직접 메타조회는 하지 않았고 이후 관련 명시 경로만 읽음. 후속 전체 inbox 확인은 모두 빈 배열이며 수정 대기 없이 이 제한 검토를 종료함.

## PD 기록 정정

원 보고의 `git status --short`에 보호 대상 이름이 나타났다는 사실은 확인 대상으로 보존한다. 다만 CJ가 Git 상태 대조를 명시적으로 요청했고 정상 상태 출력의 이름 열거는 세션에서 허용한 범위이므로, 이 사실만으로 무접근 계약 위반으로 분류하지 않는다. 보호 대상의 내용 읽기·직접 메타데이터 조사·수정·스테이징은 보고되지 않았다. Saturn의 전파일 쓰기0와 제품 QA REVISE 판정은 별개다.

제품의 5개 결함 묶음은 Mars에게 수정·회귀 추가를 요청했다. 최종 판정은 수정 후 고정 코드의 새 독립 검수를 따른다.
