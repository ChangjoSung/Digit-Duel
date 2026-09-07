# Digit-Duel — 인수인계 스냅샷

> 기준일: 2026-09-07 · 작성: Mercury (PD) · 누적 금지, 현재 상태로 치환한다.

## 현재 상태

- 상설 Mercury: GPT-6 Astra, high. CJ Comment 접수·조정·Git·문서 메타데이터 담당.
- 최신 릴리스 **v0.4.2**, Milestone#7 **v0.4.3 — HTML 데모 후속 업데이트** OPEN.
- 아트 기준: **258d4ea4e9f5e2f866775605809d29741942db63**, PR#88. 게임 적용·최종 검수는 PR#90에 취합했다.
- CJ 최신 Comment: **Design 확인 완료. 해당 디자인을 게임에 적용 진행. 아이콘은 메모 형식으로 내 말·상대 말 모두 적용. 객관적 분석 후 구현 시작.**
- 아트 납품 [Issue#87](https://github.com/ChangjoSung/Digit-Duel/issues/87)은 CJ 명시 승인으로 CLOSED.
- 현재 제품 목표 [Issue#89](https://github.com/ChangjoSung/Digit-Duel/issues/89), [통합 PR#90](https://github.com/ChangjoSung/Digit-Duel/pull/90). 구현·Saturn 독립 QA 완료, CJ 플레이 QA 대기.
- 과거 제품 적용 미승인 게이트는 최신 CJ 지시로 해소됐다. 동일 승인을 재질문하지 않는다.
- 보호: 사용자 소유 미추적 **art/**·**orca-hook-latency-report.md** 수정·스테이징 금지. Downloads 원본 읽기 전용.

## 구현·QA 완료 상태

Run **run_d8e8db3f76a9**. 진행 중 Worker Task는 없다.

| Worker | 결과 | 생명주기 |
|---|---|---|
| Mars (Claude) | 제품·이미지 실패 수정·J13 보완 완료. 최종 task_b0d5cd57581d / ctx_c180061634a3 | 초기 구현·납품 정정·공백 보완 포함 모든 PD 소유 Mars archive·release |
| Venus (Claude) | rev7 계약 및 기술 선택 문구 정리(task_645ebb99dd51) | archive·release |
| Saturn 1차 (Codex) | REVISE, files_modified=[](ctx_7587a359d6a6) | release 요청은 runtime user_takeover로 retained/user_owned. 재사용·강제 종료 금지 |
| Saturn 2차 (Codex) | **최종 PASS**, files_modified=[](task_cd870483c74a / ctx_d39379ab9c0b) | archive·release |

- 제품 코드: ea4f189, 최종 테스트 보완: cef07ba. 통합 단위는 PR#90 하나다.
- 회귀 합계 **571/571** = 기존440 + 최종아트131. Saturn 2차 직접 **249/249**(131+메모49+규칙69), Chrome **82측정0문제**. 이전 독립 통과 영역과 수행 주체는 보고서에 구분한다.
- 증빙 PNG **70파일**, 캡처74회(4회 같은 이름 덮어쓰기), JSON 고유 경로70 일치.
- 1차 결함: 낮은 화면 portrait 이중 실패128→192 확대·무효 단언·read-only 문구. 수정 후 실제 요청 차단으로 통과했다. J13은 2차에서 발견한 실제 진행/대체 토큰 FX 검출 공백까지 보완하고 정상·3종 음성 대조를 통과했다.
- 초기 REVISE: [1차 보고](../qa/minion-art-integration-saturn-initial.md). 최종 판정·해시·한계: [최종 독립 QA](../qa/minion-art-integration-saturn-final.md). 구현자 근거: [Mars 보고](../qa/minion-art-integration-mars.md).
- 경로 wildcard가 들어간 worker_done(msg_695f9d51b4b2)은 role_scope_mismatch로 거절했고 올바른 Mars dispatch 입력으로 이관했다. 정정 납품(msg_6e016ddb006b) 인수 완료, Issue#89·Decision Log27에 기록. 구현 보고의 역사적 음성 대조 수치도 Saturn 근거로 PD가 정정했다.
- **CJ 최종 게임 플레이 확인은 남는다.** Issue#89는 OPEN. 기존 모바일 가로 스크롤 유지, 실제 기기·비Chrome·브라우저 UI 확대 조작·사람 블라인드 식별은 미검증이다.
- Git 통합은 PR#90의 dev squash 단위다. 실제 dev HEAD·병합 상태는 Git/PR/Issue의 최종 근거를 대조한다. 이 문서의 제품 기준 SHA를 최신 dev SHA로 오인하지 않는다.
- 검증 시 Chrome 임시 프로필은 실행 부수 리소스이며 --read-only는 검증 산출물을 쓰지 않는다. 자기 실행의 정확한 생성 경로·PID만 정리한다.

## 제품 적용 계약

- 내 말과 상대 공개 말: 하수인 종 고유32px 아이콘 + 기존 원소 메모 기호, 왕·동료·폭탄·함정은 기존 MEMO_OPTS 이모지 공통 재사용. 확정은 실선·불투명.
- 미공개 상대는 기존 ? 또는 뷰어가 직접 지정한 메모8종 점선·반투명. 숲의 비가시 말은 렌더하지 않는다. 실제 종·HP·속성을 DOM/URL/alt/title/aria/data에 넣지 않는다.
- 기존 온라인 lockstep의 applyNetSetup은 상대 rosterId를 클라이언트 메모리에 이미 보관한다. 이번 정보 은닉 검수는 새 렌더·접근성·이미지 요청 노출 방지 범위이며 서버 권위형 보안 개편은 포함하지 않는다.
- HP: 기존 known 조건의 하수인·동료·왕에만 아이콘 아래 현재 숫자 한 줄. 폭탄·함정·미공개·메모는 HP 없음.
- 배치 하수인 설명창 portrait, 하수인 전투 battle을 연결한다. 기존 한 방향 납품 이미지를 사용하고 미규격 특수말/포획 보조의 기존 표현은 보존한다.
- 상대경로 assets 로딩과 권장48px 둥근 사각 말은 적용에 필요한 구현 선택이며 CJ가 각 px를 별도 지정했다고 서술하지 않는다. 칸52px 유지, DPR·로드 실패 검증 완료. 실제 모바일 기기 검증은 미수행.
- 메모20종 확장·로스터 카드 새 기능·아트 재제작·밸런스/AI/규칙 변경은 이번 범위 밖이다.
- 코드·테스트는 Mars/Jupiter, Saturn은 모든 파일 읽기전용(files_modified=[]), Venus는 기획 문서만. PD가 역할을 대신하지 않는다.
- GitHub·Notion·Git 쓰기는 PD만. 목표당 Issue1개+통합PR1개, Worker 분할은 Task·체크리스트. 독립 출시·롤백 범위만 별도 분리.
- main/dev 직접 커밋 금지. origin/dev 기준 feature → dev squash 후 로컬·원격 feature 명시 삭제. 장수 main/dev 유지.

## 확정 아트 기준

- 20종×5파일=100파일, icon32·portrait512·battle-grid64·battle128(최근접2배).
- Saturn ART20/20 PASS·Technical PASS 후 CJ 디자인 확인 완료. 아트100파일·픽셀 원고·아트 도구는 이번 제품 구현에서 변경하지 않는다.
- 초기 원본80파일 중72파일 바이트 보존, 승인전투4쌍8파일 보완. source-manifest는 원본 이력, delivery-manifest는 현재 파생28파일.
- 제작·검수 근거: docs/art/minions-v0.4.3/README.md 및 final-qa-saturn.md. 뇌격수 두 차례 수정·생성 시험 실패본2건은 이력으로 보존한다.
- 아트 검수 해시는 .gitattributes로 바이트 보존한다. 정적 ART PASS는 제품 화면·HP·DPR·게임 QA PASS를 뜻하지 않는다.
- Public 저장소, 코드 Apache-2.0·아트 ASSET-LICENSE.md. 서버 루프백 기본 및 LAN 선택 경계 유지.

## 문서·교대 확인

규격: docs/minion-visual-spec-v0.4.3.md. Notion GDD-13 9장·Decision Log27에 최신 지시와 Issue89 반영.
Project=Digit Dual·Edit Date=2026-09-07·Editor=실제 사람 성창조 유지.

CLAUDE 전체 → 이 스냅샷 → 실제 Git status/origin/dev → Milestone#7·열린 Issue/PR →
활성 Run/Task/Dispatch 확인. 과거 미승인 상태로 되돌리거나 완료 아트를 재제작하지 않는다.
