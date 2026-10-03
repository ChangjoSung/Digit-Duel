# [결정][아트 결과] #293 시작 흐름 — Earth 정적 컨셉
- 판정: 최신 CJ #293 Comment의 flow PASS 유지; 보완한 것은 정적 아트·문서이며 제품 구현·최종 CJ QA는 아님.
- CJ 원본 #1 대응: A 시작 상점, B 필드/가방/아이템, C 7×13 배치·14칸 축약 트레이, D 완료 예시, E 시너지, F 설정.
- CJ 원본 #2 대응: R1/R2 교체 모달; 양쪽 모두 실제 카드 정보 6종, 선택 강조는 등급 테두리와 분리.
- 실제 grade-1/★1 예시(ROSTER): M-F2 90, M-W4 85, M-L2 90, M-G1 100, M-E3 120, M-F6 110 HP; 시작 상점 구매가는 각 1코인.
- 색상/기준: 등급 1–5 흰색·민트·파랑·보라·금색; 시너지 rank −1, 0–4 단계별 분리; 주요 진행 버튼은 빨강·진한 테두리·흰 글자. 기존 synSteps/synTier 사용. [UI_CONTRACT.md](UI_CONTRACT.md)에 hex·아이콘·상태 의미.
- 납품: [flow-overview.svg](flow-overview.svg) / [PNG](flow-overview.png) 1314×2010; [replacement-detail.svg](replacement-detail.svg) / [PNG](replacement-detail.png) 900×1030; 본 report와 contract.
- 확인: 수정 SVG 1× Chrome 렌더와 PNG 치수 확인; 실제 출력에서 한글/겹침, grade·★1, 90초, 빨강 CTA, 비활성+rank0–4 6색, 축약 트레이·방 나가기 확인. 진행 막대+주요 버튼 한 줄은 runtime 계약에 기록.
- 한계: 보드 개념도 셀 26px·피치28px(7:13 비율); 제품 크기 제안 아님. 정적 SVG는 상호작용하지 않으며 교체·완료·선택은 [확정된 Venus 계약](../Venus/implementation-contract.md)이 런타임 기준.
- 근거: [최신 CJ Comment](../references/CJ_COMMENT.md), [원본 흐름](../references/cj-start-flow.png), [원본 교체](../references/cj-replacement-modal.png); dispatch HEAD 2febd197, handoff shared HEAD ce96f25, base 4f638a1.
