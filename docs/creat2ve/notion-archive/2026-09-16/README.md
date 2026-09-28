# Notion 기획 문서 정리 — 2026-09-16

CJ 지시로 Digit-Duel 기획 문서의 중복·과거 기록을 정리했다. 이 폴더는 **과거 원문 보관본**이며 새 Agent의 현행 규칙 원본이 아니다.

## 현재 볼 문서

- [현재 게임 규칙 — GDD-13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38): 출시된 v0.4.10 안내.
- [온라인 대전 — GDD-22](https://app.notion.com/p/3d91e7f170858110bf64f7416bba2d01): 방·서버 판정·재접속·종료 규칙.
- [v0.4.11 기획 — GDD-23](https://app.notion.com/p/3dc1e7f1708580329da6fe4986654f7b): 다음 패치 기획, Milestone·Issue 미생성.
- [v0.4.11 UI/UX — GDD-24](https://app.notion.com/p/3dc1e7f1708581a48421fcec63d3cdf8): 그림 3장과 최신 흐름표. 그림의 미반영 조건 표시는 유지.
- [기획 문서 허브](https://app.notion.com/p/3c91e7f17085802499f1f5ccae7c8f50): 위 네 문서와 승인·검토 목록.

## 정리 결과와 판단

프로젝트 GDD 14개 중 현재 역할이 다른 4개를 남겼다. 나머지 10개와 자식 DIGEST 2개는 Notion 화면에서 휴지통으로 이동했다. 구 규칙·수치·로스터·완료 이슈 분석은 아래 원문과 기존 `docs/milestone/`의 버전별 계약으로 보관한다. README 작성 지침은 [현행 지침](../../README_RELEASE_STYLE.md)으로 이관했다.

Game Overview는 규칙 설명과 긴 운영 이력이 섞여 있어 8개 항목으로 다시 정리했다. 새 기획의 30종과 출시본의 20종을 구분한다. 온라인 문서는 미구현 제안과 출시 상태의 모순을 제거하고, 현행 서버 프로토콜·실제 room 계약과 대조했다. 재배포·게임 QA를 실행한 결과가 아니다.

| 정리 전 문서 | 처리 |
|---|---|
| [🎮 [Digit Dual] Game Overview / GDD](./3c91e7f17085801b8435fb3325a6e670.md) | Notion 휴지통 이동 |
| [🧪 [Digit Duel] Open Rules & Prototype Validation](./3ca1e7f170858183beddfb1e8ecbbfe7.md) | Notion 휴지통 이동 |
| [⚔️ [DATA] 전투 수치 — 판정·상성·쿨타임](./3cd1e7f170858116bbdbd60e98cc6924.md) | Notion 휴지통 이동 |
| [🎭 [CONTENT] 하수인 로스터 — 아키타입 5종 × 속성 4종](./3cd1e7f1708581e089c4c98511095634.md) | Notion 휴지통 이동 |
| [⚔️ [CONTENT] 전투 기술 로스터 — 4슬롯 체계](./3ce1e7f1708581f48640c974ec2dd540.md) | Notion 휴지통 이동 |
| [v0.4.7 CJ Comment 분석·Issue 등록 — 기술·탐색 전수 현황](./3d61e7f170858126a889e682610ebad7.md) | Notion 휴지통 이동 |
| [⚙️ [Digit Duel] 탐색 이벤트별·말별 현황 분석 및 삭제·추가 정리 #121](./3d61e7f17085809ea410fe6a1431f06c.md) | Notion 휴지통 이동 |
| [📖 [Digit Duel] README·릴리스 노트 작성 규격 #105](./3d51e7f1708580f18f2dc4a643721059.md) | Notion 휴지통 이동 |
| [⚙️ [Digit Duel] 턴 행동·접촉·전투 흐름 #106 · #114](./3d51e7f1708580b0916ded4bd3d9d06e.md) | Notion 휴지통 이동 |
| [🎨 [Digit Duel] 세로 UI·왕/동료 아트·승패 효과 #122](./3d71e7f1708581f292ede2ab862e63f5.md) | Notion 휴지통 이동 |
| [🌐 [Digit Duel] 외부망 룸 서버 설계 #217](./3d91e7f170858110bf64f7416bba2d01.md) | 온라인 대전 안내로 재작성 |
| [Game Overview](./3cd1e7f17085817f8c35fa8548116f38.md) | 현행 규칙 안내로 재작성 |
| [📖 Digit Dual 룰셋 정리본 — 읽는 판 (DIGEST 2호, v0.4.4 기준)](./3cd1e7f17085813992ccd85ce72b1d0f.md) | Notion 휴지통 이동 |
| [📖 Digit Dual 룰셋 정리본 — 읽는 판 (DIGEST 3호, v0.4.5 기준)](./3d51e7f1708581ea868df38e869a4955.md) | Notion 휴지통 이동 |

공용 템플릿 6개와 다른 프로젝트를 포함하는 Creat2ve 공통 문서는 삭제하지 않았다. 혼합 인수인계 문서는 오래된 Digit-Duel 현재 상태만 로컬 스냅샷 안내로 치환하고 Creat2ve의 2026-09-02 이력을 보존했다. 공용 Light Launcher의 Digit-Duel 참조만 현재 문서로 교체했다. [운영 문서 정리 전 원문](operations-before.md).

## 목록 규칙

표시 순서: **문서명 / 문서 유형 / Milestone / Issue / Owner / 마지막 수정**. 기본·전체·검토·승인·유형별 보기 5개와 프로젝트 허브의 표 3개에 적용했다. 템플릿 전용 보기는 보존했다.

- Milestone: 실제 GitHub 링크를 단 `v0.4.10`.
- Issue: 실제 GitHub 링크를 단 `#217`. 특정 이슈가 없는 공통 규칙은 `—`.
- v0.4.11: `v0.4.11 · 기획`, `미생성`. 존재하지 않는 링크를 만들지 않는다.
- Owner: 실제 CJ 사용자. 마지막 수정: Notion 자동 시각.
- 링크는 단방향 문서 연결이며 GitHub 상태의 자동 동기화 기능을 새로 구현한 것은 아니다.

## 확인과 보관 범위

- GitHub Milestone 목록으로 v0.4.10=/milestone/14와 v0.4.11 미생성을 확인했다.
- Notion 앱에서 v0.4.10·#217의 실제 링크와 휴지통 이동을 확인했다.
- 데이터 소스 재조회: 현재 프로젝트 문서 4개 + 공용 템플릿 6개, has_more=false.
- 원문은 Notion fetch 결과의 텍스트·속성·첨부 참조를 보관했다. 첨부 파일 바이너리를 복제한 것은 아니다. 만료되는 첨부 URL의 서명 쿼리는 제거했으며 필요하면 Notion 휴지통의 원본을 복구한다.
- 기존 승인/QA 이력은 해당 시점의 기록으로만 읽는다. v0.4.11 기획 승인·착수 범위를 확대하지 않았다.

