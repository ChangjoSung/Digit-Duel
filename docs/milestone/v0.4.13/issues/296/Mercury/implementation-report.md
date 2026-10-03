# #296 배틀 UI/UX — 구현 납품 및 독립 QA 인계

2026-10-02 18:50 KST · Mercury_PD · [결정] CJ 구현 승인 및 최신 명시 정정 반영. 이 문서는 감정표현 REVISE 수정 인계 시점의 기록이며 최종 CI/Saturn 결과는 아래 외부 완료 영수증과 통합 PR 본문에서 확인한다.

## 구현 결과

- 내 싸우기 목록은 #294 하수인 정보의 설명을 재사용한다. 미해금 기술 소개는 잠금·필요 등급과 함께 읽기 전용으로 보인다. 온라인 버튼은 서버의 `usable`만 따르고 값이 없으면 잠긴다.
- 상대 스킬 목록·설명·숨긴 줄·칸 수·도움말을 전투 화면에 표시하지 않는다. 기존 공개 전투 메시지·연출·통신은 유지한다.
- 실제 출전 개체의 이름·등급·HP/최대 HP·현재 방어막·기본 6스탯·상태를 양쪽 패널에 표시한다. 가방 대리 출전도 출전한 개체의 값을 사용한다. 왕·동료에게 하수인 등급을 만들지 않는다.
- 계산한 위력/범위 표시를 모두 삭제했다. 고정 설명의 계수는 유지하며 실제 0은 0, 없는 스탯은 `—`로 표시한다. 전투 엔진·판정·밸런스 수치는 변경하지 않았다.
- CJ 콘티의 상단·차례/왕국/개인 칩·라운드/내 시계/아키타입·두 전투원·상황 메시지·행동·뒤로 순서로 기존 UI와 아트를 재배치했다. 칩은 전투 시작 스냅샷과 현재 출전 개체를 사용한다.

`0~0`의 정적 경로는 서버 공격력 누락 → 불완전한 클라이언트 복원 → 0 기본값 → 위력 범위였다. 서버 실제 피해 판정과 별개다. 이번에는 범위 표시 자체를 삭제하고 패널을 실제 서버 값으로 연결했다. CJ 제보 장면 자체를 재현했다는 주장은 하지 않는다.

## 구현 부서 검증과 한계

| 담당 | 확보한 증거 | 한계 |
|---|---|---|
| Mars | 기존 22개 회귀 통과, 마지막 변경 후 영향받은 `issue238` 186/0·`public_rooms` 207/0, 타입 검사 exit 0 | 통과한 나머지 20개는 반복하지 않음 |
| Jupiter | 경계·보안·권위 회귀 9개 통과; 등급 추가 후 변경된 3개만 재검사(714/0·64/0·1842/0) | 초기 `test-issue237-economy`는 `ws` 미설치로 단언 전 중단. 이후 기존 lockfile 의존성 설치, CI에서 확인 예정 |
| Mars 실서버 | `smoke_public_live 2` 23/0(2경기·164 전투 행동·클라이언트 예외 0), `smoke_public_eco_live` 54/0 | 실제 서버와 클라이언트 코드의 자동 검증이며 실제 브라우저 플레이 PASS가 아님 |
| Mars 실제 렌더 | 수정 전후 320/390/PC 각 루트·싸우기·가방 및 상대 차례 19장, 390 가방 마녀 2장; 기존 아트 로드·버튼 44px·겹침/가로 넘침 검사 | 320px 일부 스탯 칸 내부 너비 1~2px 초과. 2등급·용 개인 칩의 실제 캡처 없음 |
| 브라우저 E2E | 기존 스크립트 1회 실행 로그·실패 화면 보존 | 구형 타이틀 버튼을 찾아 전투 진입 전 실패. 변경한 설명 검사는 실행되지 않았고 온라인 실브라우저 전투는 이 증거로 검증하지 못함 |
| Saturn / 필수 CI | 최초 HEAD `d3e061b`의 CI 6/6 PASS. 독립 QA는 감정표현 배치 REVISE로 [기록](../Saturn/qa-report.md) | Mars 수정 뒤 fresh 영향 범위 QA와 최신 HEAD CI가 필요하며, 최종 결과는 외부 완료 영수증에 기록 |

부서별 세부 명령·수정 파일·실행 횟수: [Mars](../Mars/implementation.md), [Jupiter](../Jupiter/implementation.md). 정식 QA 판정은 Saturn만 수행하며 Mercury는 취합·Git·문서 메타데이터를 담당한다.

## 문서 반영 위치

| 문서 | 반영 위치 |
|---|---|
| [GDD-23](https://app.notion.com/p/3dc1e7f1708580329da6fe4986654f7b) | 5.6 시너지 표시, 7.9 전투 공개 경계, 8.2 전투 화면, 기존 #296 Decision Log 행과 현행 절 치환 |
| [GDD-24](https://app.notion.com/p/3dc1e7f1708581a48421fcec63d3cdf8) | 00.7 공개 정보, 03 B04 배틀 화면, 기존 #296 현행 절 치환 |
| [GitHub #296](https://github.com/ChangjoSung/Digit-Duel/issues/296) | 기존 Description·완료 조건 5개를 치환. CJ 플레이 QA와 통합 전에는 완료 처리하지 않음 |
| [v0.4.13 마일스톤](https://github.com/ChangjoSung/Digit-Duel/milestone/18) | #296 착수 대기 문구만 구현 단계로 치환 |
| [프로토콜 원본](../../../../v0.4.10/issues/217/Jupiter/protocol.md) | `battle.a/d` 기본 6스탯·실제 등급 및 소유자 `usable` 전투 한정 계약 |
| [최신 구현 계약](../Venus/implementation-contract.md), [CJ 원문](../references/CJ_COMMENT.md) | 내 미해금 소개 포함, 상대 스킬 비표시, 위력 삭제를 명시. 과거 부서 분석의 상충 제안은 현행 요구가 아님 |

Notion의 기존 Project·실제 사람 Editor·수정일을 확인해 보존했다. 최종 25개 치환은 재조회로 의미 일치를 확인했다(1개 굵게 표시의 Notion 직렬화 정규화 포함). 새 문서·중복 Decision Log·Issue 댓글을 만들지 않았다.

## 기준·실행 설정·보존

- 작업 트리: `C:/Users/pc_77/orca/workspaces/Digit-Duel/issue-296-battle-flow`, 브랜치 `ChangjoSung/issue-296-battle-flow`, 분기 기준 `e48a8aabbf68d967cf47d45958e56d041ef63217`. 정확한 납품 HEAD와 PR/CI/QA 결과는 외부 완료 영수증에 기록한다.
- Mercury 실제 모델 `gpt-6.1-sol` / xhigh, 기동 tier `fast`. CJ 요청 권한은 workspace-write/on-request/user였으나 현재 host/developer 실행 권한은 **danger-full-access/never**다. 이 불일치를 보고했으며 설정을 자동 대체·확대하지 않았다. API 실제 priority는 노출되지 않는다.
- 구현·기획 부서는 `claude-opus-5-5` / high / full permission, Saturn은 별도 fresh `gpt-6.1-sol` / xhigh / default(No Fast) / danger-full-access / never 모델 게이트 대상이다. [구현 영수증](implementation-receipt.json)에 실제 기동 기록을 남긴다.
- 원본 main `9b306bbfda103263cb2feea90fd9c89527eb9290`의 dirty 6파일·index·unity/·stash 2개·handoff b44e302·PR304 Draft를 보존한다. root pull/reset/checkout/stage/commit은 수행하지 않는다.
- #293/#294/#295 완료 상태와 기존 QA Render Live는 유지한다. 이번 납품의 milestone/main/dev 병합·Release·Render 배포·운영·결제는 실행하지 않는다.

보존 증거 디렉터리: `C:/Users/pc_77/orca/artifacts/Digit-Duel/issue-296/implementation-visual/`.
최종 완료 영수증·QA 메시지·CI 결과: `C:/Users/pc_77/orca/artifacts/Digit-Duel/issue-296/implementation-completion.json` (CI/독립 QA 확인 뒤 Mercury 기록).
