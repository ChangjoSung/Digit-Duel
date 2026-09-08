# Mercury PD 수치 기반 자가 점검

2026-09-08 · Mercury(PD, GPT-6 Astra/high). 제품 QA가 아닌 운영 메타데이터 점검이다.

## 측정

- 근거: 현재 CODEX_THREAD_ID에 정확히 일치하는 로컬 Codex JSONL의 session_meta, compacted, event_msg/token_count만 집계했다. 다른 세션 대화나 인증 정보는 사용하지 않았다.
- 세션 시작: 2026-09-07 02:08:39 UTC. 모델 기록: gpt-6-astra. CLI 0.153.4.
- 압축 완료 레코드(compacted): 15개. 마지막 시각 2026-09-08 08:37:45 UTC.
- 측정 표본: 2026-09-08 08:47:40 UTC(17:47:40 KST). last_token_usage 입력91,882 + 출력137 = 92,019, model_context_window 258,400. 비율35.6%, 차감166,381(64.4%). 이는 마지막 기록 기준 근사 여유이며 이후 도구·대화 및 다음 응답 예약분을 반영한 실시간 잔량이 아니다. 누적 과금/처리 토큰을 현재 컨텍스트 점유량으로 사용하지 않았다.
- GitHub 열린 Issue/PR 각각0, v0.4.4 Milestone10 열린 항목0·CLOSED. main/tag aff9812 일치. 출시 당시 main/dev 트리 일치. 사용자 미추적2경로 보존.
- Orca 현재 터미널 목록은 Mercury1개. 과거 #93 REVISE/in-progress 카드 표기 누락1건을 발견해 정정했다. 인계 때 새 Mercury가 추가되는 것은 별도다.

## 판정과 한계

**교대 진행.** 즉시 컨텍스트 부족은 아니다. 그러나 CLAUDE.md의 교대 조건 중 마일스톤 종료와 반복 압축에 모두 해당한다. 다음 독립 마일스톤 전환이며 열린 구현 작업이 없어 인계 부담도 작다.

판단력 저하율·정확도·피로도는 측정하지 못했다. 비교 가능한 독립 평가나 기준선이 없으므로 점수나 감소율을 만들지 않는다. 압축15회나 누락1건이 인지 저하를 증명하거나 인과관계를 확정하지 않는다. 이전 #106 Worker 절차 위반도 PD 인지 점수로 환산하지 않는다.

CJ가 교대가 타당하면 실행하도록 승인했으므로 인계 스냅샷을 갱신하고 fresh Astra/high 세션으로 소유권을 전달한다. 새 세션은 인수 보고 후 v0.4.5 CJ Comment를 기다린다. 제품·서버·아트·테스트는 변경하거나 실행하지 않는다.

공식 필드 설명: [model_context_window](https://learn.chatgpt.com/docs/config-file/config-reference)는 활성 모델의 컨텍스트 토큰 수다. [Codex 상태 확인](https://learn.chatgpt.com/docs/developer-commands?surface=cli)은 토큰 사용량을 보여주지만 판단력 평가 지표를 제공한다는 근거는 아니다.
