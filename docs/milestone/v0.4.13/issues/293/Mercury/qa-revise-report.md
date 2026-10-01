# #293 CJ QA REVISE — 2026-10-01 수정 진행 기록

- 상태: **CJ QA REVISE**. 원인 분석·Venus 기획 계약·Earth 시각 계약 갱신 완료, 구현 게이트 준비. GDD-13/23/24 동기화도 Mercury가 독립 실제 재조회 확인했다. 이번 수정본 구현·Saturn QA·필수 CI·QA 재배포는 아직 미완료다.
- 입력: [CJ 최신 7건 원문과 원본 이미지 6장](../references/CJ_QA_REVISE_20261001.md). CJ 추가 응답으로, 180초 만료 시 판매로 진열이 부족하면 **예비 코인으로 새로고침 1회 후 무작위 구매·배치**한다.
- 분석: Venus·Mars·Jupiter가 `469b279e1866b4fb8019a93b6aa5cb17086e37cb`를 독립 정적 읽기로 확인했다. 세 역할 모두 테스트 실행 0·파일 수정 0. 실제 응답 모델 `claude-opus-5-5`, native argv `--effort high --dangerously-skip-permissions` 확인.

| CJ 항목 | 확인된 현행 원인 | 담당 |
|---|---|---|
| 1 공통 180초 | 서버 좌석별 shop→place 키 변경 때 새 90초를 발급. 클라이언트 오프라인 시계도 같은 단계 규칙 | Jupiter 서버·Mars Core/표시 |
| 2 준비 현황 | 상대는 별도 왼쪽 상자, 완료 대기는 보드 밑 문구. 서버는 준비 여부만 제공 | Jupiter 최소 단계 정보·Mars 화면·Earth 시각 계약 |
| 3 즉시 판매 | Core 필드 판매 시 빈 필드 수 > 구매 가능한 진열 수이면 거부 | Mars 공유 Core |
| 4 무료 속성 변경 | 티켓 수가 양수일 때만 표시. 시작 상점 속성 변경 자체는 이미 무료 | Venus 계약·Earth 표시·Mars 화면 |
| 5 판매 확인 삭제 | 클라이언트 필드·가방 판매 핸들러가 confirm() 사용 | Mars |
| 6 말 표시 | 왕·동료 속성/보드 아키타입 미표시, 땅 아이콘 별칭 누락, 서버·클라이언트 여러 경로가 상대 HP를 % 처리 | Jupiter raw HP·필요 표시 데이터 / Mars 공통 말 표시 / Earth 기존 등급 색 |
| 7 개인 시너지 | 왕국·아키타입 11개만 레일에 표시. 전설 개인 효과·왕/동료 해금 효과는 기존 Core 데이터에 있음 | Venus 적용 계약·Mars 화면 |

## 작업 기준과 보존

현재 WorkTree는 `003dc8a0-372c-4547-9290-31d34edd82be::C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-293-start-flow-concept`, 브랜치 `ChangjoSung/issue-293-start-flow-concept`다. 새 WorkTree는 만들지 않았다. 새 fetch 후 origin/milestone/v0.4.13=`4f638a12dbab5e85b5b3b8d1d50ab17d029ea5b3`, main=origin/main=`9b306bbfda103263cb2feea90fd9c89527eb9290`를 확인했다.

main의 미커밋 모델 계약 6파일·unity/·stash 2건·b44e302 handoff 브랜치를 보존했다. #293 OPEN·PR #305 Draft 유지, #294/#295 전체 개편/#296은 이번 수정과 별도다. main Release·운영 Render·유료 자원 변경은 하지 않았다. 최신 Release v0.4.12.

Render MCP는 현재 재인증 후 실제 `get_service` 성공. 기존 Free QA `srv-dauvf1m0tbcc73ctepsg`, <https://digit-duel-mipa-qa.onrender.com/>는 아직 이전 제품 커밋 `0cf0179e0ccafd39b0cb6308ae3c0c315b988dcf`이며 자동 배포 Off다. 수정 배포가 완료되기 전에는 새 QA가 반영됐다고 보고하지 않는다.

운영 증거: `C:/Users/pc_77/orca/archives/Digit-Duel/issue293-qa-revise-20261001/`에 각 역할 실행·모델·실제 응답·정적 분석과 보존 검증을 기록한다. 실행 토큰/비용은 확인 가능한 원시 계측만 사용한다.
