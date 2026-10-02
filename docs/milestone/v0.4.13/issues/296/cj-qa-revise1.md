# #296 CJ QA REVISE1 — 2026-10-03
[피드백] CJ QA Test: REVISE. 이번 수정은 기존 #296 / PR308에서 진행하며, 이전 구현·QA 기록은 당시 상태의 이력이다. 아래 최신 CJ 지시는 이전 구현 계약의 조건부 정보 버튼 및 별도 외부 뒤로 버튼보다 우선한다.

## CJ 원문
1. [UI/UX] 게임 메인 화면 하수인 정보 버튼 관련
(1) 상대 차례일 때
- 내 하수인을 클릭하면 정보 창이 바로 Open됩니다.
(2) 내 차례일 때
- 내 하수인을 클릭하면 이동 표시와 함께 우측 시너지 밑 "하수인 정보 버튼"이 클릭할 수 있도록 활성화됩니다. (UI가 변경되지 않고, "하수인 정보" 텍스트 고정)
- 하수인 정보 버튼을 누르면 정보 창이 Open 됩니다.
=> 기존에 있던 버튼 On/Off 방식은 삭제합니다. (이유 : On 될 때마다 말판 규격이 매번 달라져서 정신없음.)

2. [UI/UX] 배틀 메인 화면 & 도망가기 수정
(1) [배틀 화면 공용]
- [Top Bar] 빈 공간을 없앱니다. 위로 올립니다.
- [하수인 정보 창] CJ Concept Conti 처럼 변경합니다.
(2) [도망가기]
- 불필요한 텍스트는 전부 삭제합니다.
- CJ Concept Conti 처럼 변경합니다.

3. [UI/UX] 포획 수정
- 포획 조건이 충족되었을 시: Image3.
- 포획 조건이 미충족되었을 시: Image4.
=> 포획 조건 및 몬스터 볼 개수는 우상단에 표시합니다.
=> 포획 조건 및 몬스터 볼 충족 UI 표시는 위 이미지와 같이 표시합니다.

4. [UI/UX] 가방
- CJ Concept Conti 처럼 변경합니다.
- 불필요한 텍스트는 전부 삭제합니다.

5. [UI/UX] 싸우기
- 싸우기 기술 정보는 무조건 하수인 정보에 있는 스킬 설명창을 그대로 가져옵니다.
- 가독성 떨어지게 하지 마세요.

## CJ 후속 Comment — 2026-10-03

> 싸우기도 내부 복귀 버튼으로 통일해주세요

[운영 기록] 후속 지시를 접수해 Mars 구현·Venus 계약 갱신·Saturn 영향 검수를 같은 run에서 이어간다. 이전 싸우기 외부 복귀 예외는 이 지시로 대체된다.

## 첨부 원본
7개 이미지는 복사 후 SHA256 일치를 확인했다. 이미지 번호와 CJ 주석을 유지한다.
- [Image1](references/CJ_QA_REVISE1_20261003/CJ_QA_REVISE1_1.png)
- [Image2](references/CJ_QA_REVISE1_20261003/CJ_QA_REVISE1_2.png)
- [Image3](references/CJ_QA_REVISE1_20261003/CJ_QA_REVISE1_3.png)
- [Image4](references/CJ_QA_REVISE1_20261003/CJ_QA_REVISE1_4.png)
- [Image5](references/CJ_QA_REVISE1_20261003/CJ_QA_REVISE1_5.png)
- [Image6](references/CJ_QA_REVISE1_20261003/CJ_QA_REVISE1_6.png)
- [Image7](references/CJ_QA_REVISE1_20261003/CJ_QA_REVISE1_7.png)

## 운영 메타데이터
- Orca run: run_c5374ba15658; Mars_Client 구현, Venus_Plan 기획 갱신, fresh Saturn_QA 독립 읽기 전용 검수.
- 수정 기준: source93c1e70e6c6ba5e312cdd08b9ea91efaaa238862, Issue296 OPEN, PR308 OPEN.
- 기존 Free QA: https://digit-duel-mipa-qa.onrender.com/ ; source93c1e70 / Live dep-davolge7bikc73esbml0. 최신 REVISE 수정은 아직 배포 전이다.
- CJ의 기존 QA 서버 지시는 유효하며, 검증된 수정 SHA만 같은 QA 서비스에 특정 커밋 배포한다.
- CJ 재검토가 완료될 때까지 Issue/PR 병합·종결·main/dev·Release·운영 배포는 별도 범위이다.
- 원본 main dirty6·unity/·stash2·PR304·계정 기본값은 보존한다.
