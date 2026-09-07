# v0.4.3 하수인 아트 납품

2026-09-07 CJ 구현 승인에 따라 [Issue #87](https://github.com/ChangjoSung/Digit-Duel/issues/87)에서
전투 4종 보완·직접 32px 아이콘 20종·출력 도구·독립 검수를 [PR #88](https://github.com/ChangjoSung/Digit-Duel/pull/88) 하나로 취합했다.
게임 화면 적용은 후속 제품 작업이다. 최신 수량과 QA 상태는 [외형 규격 §8.2](../../minion-visual-spec-v0.4.3.md)에 모은다.

## 납품 구성

- 20종 `icon.png`: Earth가 각 종의 제공 디자인을 직접 32×32 픽셀로 재구성했다.
- 4종 전투 보완: 재의 주술사 불꽃 단서, 안개 무희 얼굴·날개 분리, 가시 덩굴 입·이빨, 뇌격수 턱·팔 분리.
- 최종 자산은 20종×5파일 = **100파일**이다. 설명창 40파일과 비대상 전투 32파일은 원본 바이트 그대로 유지한다.
- 원본 반입 80파일·7,488,176바이트의 해시는 [원본 매니페스트](source-manifest.csv)에 보존한다.
  승인된 전투 8파일의 변경과 아이콘 20파일은 [납품 매니페스트](delivery-manifest.csv)로 별도 기록한다.

| 검토 자료 | 확인할 내용 |
|---|---|
| [20종 비교 시트](review/icons-contact-sheet.png) | 실제 32px·최근접 4배 확대 |
| [세 말판 배경](review/icons-board-backgrounds.png) | 아군·적군·중립 배경 대비 |
| [흑백 실루엣](review/icons-silhouette.png) | 실제 2배 확대에서 전체 형태 구별 |
| [불 보완](review/battle-repair-fire_sustain.png) · [물 보완](review/battle-repair-water_swift.png) · [풀 보완](review/battle-repair-grass_atk.png) · [번개 보완](review/battle-repair-lightning_atk.png) | 원본·수정 결과·변경 픽셀 대조 |

## 제작·검수 근거

Earth_1은 불·물, Earth_2는 풀·번개를 담당했다. [픽셀 원고](pixel-sources/)와
[전투 패치](battle-patches/)를 Mars의 [출력 도구](art-pipeline.md)로 검증·출력한다.
도구의 외접상자 중점은 기하학적 대리 지표이며 시각 중심의 독립 판정을 대체하지 않는다.

- Earth 제작 보고: [불·물 파일럿](earth-1-native-report.md), [풀·번개 파일럿](earth-2-native-report.md),
  [불·물 잔여 8종](earth-1-full-delivery-report.md), [풀·번개 잔여 8종](earth-2-full-delivery-report.md).
- 파일럿 검수: [1차](pilot-qa-saturn.md) → [뇌격수 V1 REVISE](pilot-v1-qa-saturn.md) → [V2 ART PASS](pilot-v2-qa-saturn.md).
  뇌격수는 국소 수정으로 해결되지 않아 얼굴·몸 비례를 재구성한 뒤 통과했다.
- 도구: [Mars 구현·출력 증빙](mars-pipeline-report.md), [Saturn 독립 기술 PASS](tooling-qa-saturn.md).
  Mars 테스트 68/68과 Saturn의 읽기 전용 검증은 수행 주체와 범위를 구분한다.
- 전체 납품: [Saturn 최종 20종 ART·기술 검수](final-qa-saturn.md). 종별 판정과 검수 대상 해시를 보존한다.
- [원본 QA](source-qa-saturn.md)는 최초 반입 시점의 기록이며 현재 수정본 판정과 구분한다.

초기 이미지 생성 시험 2건은 투명도·크기·색 수 규격을 충족하지 못해 참고 이력으로만 보존한다.
[Earth_1 시험 보고](earth-1-report.md)와 [Earth_2 시험 보고](earth-2-report.md)의 생성 이미지는 납품 수량에서 제외한다.

정적 아트·파일 규격 검수는 실제 게임의 이미지 로딩·HP 배치·DPR 검증이나 사람 대상 식별 시험을 뜻하지 않는다.
현재 HP 숫자 한 줄과 메모 8종 이모지 재사용은 결정됐으며, 게임 화면 반영은 후속 제품 범위다.

## 문서 반영 위치

| 문서 | 역할 |
|---|---|
| [외형 규격](../../minion-visual-spec-v0.4.3.md) | 제작 기준·현재 수량·최종 QA·제품 결정 |
| [인계 스냅샷](../../creat2ve/HANDOVER_SNAPSHOT.md) | 현재 통합 상태·남은 작업 |
| [GDD-13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) 9·12장 | CJ 결정 본문·Decision Log |

원본 및 파생 아트의 자산 조건은 [ASSET-LICENSE.md](../../../ASSET-LICENSE.md)를 따른다.
