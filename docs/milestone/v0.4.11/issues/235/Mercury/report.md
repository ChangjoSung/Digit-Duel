# Issue #235 Mercury 통합 보고서

## 결과

Issue #235의 왕국·아키타입·전설 시너지를 #243 장기 유지보수 구조 안에서 구현하고, CJ 플레이 QA PASS 후 [PR #248](https://github.com/ChangjoSung/Digit-Duel/pull/248)을 `milestone/v0.4.11`에 squash merge했다.

- PR HEAD: `ef9d8bcba33915673bba49bb3c561e67495798e5`
- 통합 commit: `957228ddcccad4f769a373e27caaa791d30131a3`
- Issue #235: 모든 완료 조건 체크 후 CLOSED
- 부모 Issue #232: #235를 CLOSED로 갱신
- 원격 `feature/235-synergies`: 삭제 완료

## 구현 범위

- 전투 시작 시 왕국·아키타입·전설 집계를 한 번 계산하고 battle snapshot으로 고정
- 왕국의 필드 9칸 집계, 사망·포획 기여 동결, 가방 제외, 동속성 전투원 수혜
- 아키타입의 하수인 6칸+가방 전설 집계, 전설 중복 방지, 왕·동료 포함 전 참전자 수혜
- 표준·공격·지속 6단계와 방어·속공·보호 5단계, 최고 단계·중첩·상한
- 전설 직접 참전 패시브, 동료의 복수, 왕의 분노
- 온라인 snapshot·digest·표시 경계와 상대 비공개 정보 비노출

## #243 구조 보존

- Data는 시너지 표와 정의를 소유한다.
- Core는 집계·snapshot·효과 적용과 결정론적 상태 변경을 소유한다.
- UI는 공개 가능한 결과만 표시하고 규칙 상태를 직접 바꾸지 않는다.
- AI는 자기 공개 정보와 공용 Core만 사용한다.
- Network·Server adapter는 허용된 좌석 소유 정보만 전달하며 상대 집계와 숨은 정보를 노출하지 않는다.
- #233·#234·#241·#245 회귀는 공용 fixture 경계에서 시너지를 중립화해 기존 기대값을 보존했다.

## QA·CI

- fresh Saturn 최종 판정: PASS, HIGH 0 / MEDIUM 0 / LOW 0
- 필수 CI [run 35679411036](https://github.com/ChangjoSung/Digit-Duel/actions/runs/35679411036): A/B/B2/C/D/E 6/6 SUCCESS
- `smoke_issue235` 122/0
- `smoke_issue233` 310/0
- `smoke_issue234` 352/0
- `smoke_issue241` 86/0
- `smoke_issue245` 352/0
- typecheck PASS, `test:typecheck` 70/0
- 서버 전체 검사 PASS, `test-issue235-boundary` 37/0
- `git diff --check` PASS

CI 과정에서 `smoke_issue245`가 삭제된 PR 브랜치의 도달 불가능한 commit `9853a2c`를 기준판으로 참조하는 문제가 드러났다. 기준판을 #243 squash merge의 실제 분리 전 부모이자 HEAD 조상인 `0b7f683`으로 바꾸고, 분리 후 문서를 가리키는 자기 대조를 막는 assertion을 추가했다. fresh clone 재현과 correction 뒤 fresh Saturn 검증을 거쳤다.

## 운영 기록

- 구현은 Jupiter(Core·서버)와 Mars(Client·AI·테스트)를 한 번에 한 editor로 순차 배치했다.
- Worker는 Git/GitHub를 수정하지 않았고 Mercury가 exact staging·commit·push·PR·Issue 메타데이터를 담당했다.
- correction마다 fresh Saturn READ_ONLY QA를 다시 수행했다.
- 최종 worker는 모두 release-before-ack로 해제했다.
- 원본 작업공간의 사용자 변경과 대량 미추적 파일은 건드리지 않았다.

## Rollback

#235 제품 변경은 squash commit `957228d` 한 개로 통합됐다. 되돌림이 필요하면 이 commit을 단위로 revert하고, #243의 Data/Core/UI/AI/Network/Server 책임 경계와 이전 #233·#234·#241·#245 계약을 유지한다.
