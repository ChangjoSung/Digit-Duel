# [결정] Earth_2 나머지 8종 native32 원고 납품

2026-09-07 · Issue #87 · task_8978a957cd91 · ctx_988684f621a8

required_role=Earth; instance=Earth_2; instance_index=2; mode=IMPLEMENT; area=ART; mutation=assets; provider=Codex.

**상태: 8/8 정적 JSON 원고 ready.** 기존 파일럿 grass_atk·lightning_atk를 합쳐 Earth_2 담당 10종의 원고가 준비되었다. 이번 작업의 수정 파일은 아래 9개뿐이다. 최종 PNG 납품 완료나 Saturn ART PASS를 주장하지 않는다.

## 수행과 직접 시각 검토

CLAUDE.md, visual spec 전문과 특히 7.6, source-qa-saturn.md, 이전 Earth_2 보고서 두 개 전문 및 파일럿 V0/V1/V2 QA를 읽었다. 문서의 오래된 제작 대기 표기는 이번 CJ 구현 승인과 V2 파일럿 ART PASS 통지에 따라 해석했다. 담당 8종의 원본 portrait/battle을 각각 메모리 합성 시트에서 직접 보았고, 승인된 4종의 PNG가 실린 기존 세 배경 리뷰 시트도 확인했다.

각 종의 팔레트와 32행 ASCII 셀을 개별 작성했다. 행 끝 투명 패딩은 직렬화만 했으며 battle 축소, 생성 이미지 후처리, 도형·템플릿 생성은 사용하지 않았다. 첫 원고를 본 뒤 새싹 잎의 면적을 넓히고, 여우 꼬리·등·다리에 선택적 청회색 림을 더하고, 후드 가면의 눈 두 개를 상아색 두 셀로 분리했다. 갑주/고리 내부의 의도치 않은 투명 틈을 메웠으며 여러 종의 완성된 셀 배치를 1~2칸 오른쪽으로 이동해 무게를 조절했다.

기존 Mars **load_icon_source / render_icon**만 사용해 각 원고를 읽고 RGBA로 렌더했다. 모든 Python 호출은 **python -B stdin**이며 미리보기는 BytesIO와 도구 이미지 출력으로만 전달했다. PNG·스크립트·렌더러·도구 파일 저장은 없다. 전 8종에 대해 원본 portrait 나란히 대조, **실제 32×32 1배·최근접 128×128 4배·#33406e/#6e3340/#3a4152 세 배경**, 흰 실루엣을 직접 확인했다. 수정 후 두 가족 전체를 다시 검토했고, 마지막 가면 눈 보정 뒤 lightning_sustain도 세 배경 1배/4배를 재검토했다.

제작자 관찰상 큰 머리/얼굴과 짧은 몸·다리 관계가 유지되고, 새싹/수관/버섯 날개/사슴 망토와 수정/코일/여우 꼬리/후드 고리의 차이가 읽힌다. humanoid의 긴 성인 전투 체형은 압축했으며, 여우·곤충·나무 생물은 식별 머리/기관을 크게 남겼다. 밝은 림은 잎 끝·날개·수정·갑주·꼬리 일부에만 있고 내부선은 어둡게 유지했다. 이 관찰은 독립 QA 판정이 아니다.

## 최종 원고 수치 — 확정

bbox는 **양끝 포함 [xmin,ymin,xmax,ymax]**다. 8종 전부 32행×32자, 단일 ASCII 기호, 유효 팔레트, 점=#00000000, 그 외 불투명색, 알파={0,255}, 외곽 2칸 투명, 최하단 y29, Mars 로더 경고0을 확인했다. HP·문자·숫자·원소 글리프는 없다. 가슴 코어·고리·보주는 캐릭터 장비/신체 요소다.

| ID | 사용색 | bbox | 불투명 셀 | 알파 평균 x | 보존 정체 |
|---|---:|---|---:|---:|---|
| grass_std | 11 | 5,2,27,29 | 401 | 15.496259 | 큰 두 새싹·나무 얼굴·잎 갑주/장갑·갈라진 뿌리 발 |
| grass_def | 11 | 3,2,29,29 | 529 | 15.336484 | 넓은 수관과 오른쪽 가지·나무 눈썹·이끼 수염·양쪽 목재 방패 팔 |
| grass_swift | 10 | 3,2,27,29 | 382 | 15.58377 | 크림 버섯 모자·큰 곤충 얼굴·비대칭 잎 날개·황금 포자 복부 |
| grass_sustain | 10 | 4,2,29,29 | 358 | 15.910615 | 가지 뿔·긴 사슴 가면·층진 잎 망토·꽃봉오리 지팡이·분리된 뿌리 |
| lightning_std | 10 | 5,2,26,29 | 369 | 15.333333 | 세 금색 수정·큰 상아 얼굴·둥근 남색 갑주·구리 원형 코어·상아 발 |
| lightning_def | 10 | 3,2,28,29 | 461 | 15.375271 | 적층 피뢰 코일·넓은 돌 갑주·호박 눈 틈·거대 방패 주먹·짧은 발 |
| lightning_swift | 10 | 3,2,29,29 | 396 | 16.106061 | 긴 두 귀·상아 주둥이·압축한 사족 몸·위로 감긴 금색 끝 꼬리 |
| lightning_sustain | 10 | 4,2,26,29 | 361 | 15.390582 | 큰 남색 후드·상아 가면·구리 궤도 고리·양손 보주·갈라진 말린 망토 |

시각 중심 목표는 x15.5다. bbox 중점과 알파 평균은 **기하 참고값**이며 지각 중심 통과를 증명하지 않는다. 제작자 시각에서는 균형을 확인했으나 최종 중심 판정은 Saturn에 남긴다.

| ID | JSON 파일 SHA-256 |
|---|---|
| grass_std | `d643cf2213e2e336cb69e70aa7783e45f3570a0266b87664005e31ed89ca0493` |
| grass_def | `08a7f012d7e37926c8e5d96ab868ff4d1cd37be6d96d479687d2c3cfc44206ba` |
| grass_swift | `27fb45e6991f1173a617c5ef792d16d01549ac9faea8f6aedafa7d4657930c92` |
| grass_sustain | `aa89aa69ec447326278eb0e82356b6d0b5b874955d6c8a67fdecd6657955904e` |
| lightning_std | `160c67db75db89a17cfb7500998b9df7b1a27b18f7f141b2d2d7995ad0fcd359` |
| lightning_def | `2fc77fc75d8d0b744de87b6220d0e79805630b7c282275718d751b2a2d15b2f7` |
| lightning_swift | `1a56bd161ae2d2d3788f0ec171236cb9371cff08bf8f6bfd08c1533539ec4ad2` |
| lightning_sustain | `912dfa69dc5ac4458a9f400f9f0b1fe1461a734d001b4e3d5d5604f2cf2407b8` |

검수한 메모리 렌더의 RGBA 원시 바이트 해시다. **PNG 파일 해시가 아니다.**

| ID | RGBA SHA-256 |
|---|---|
| grass_std | `4be393f9bb52b90c50ae58e2837742e7c2cfe02dc2ed1cfa6a4f1a8b5a911dfe` |
| grass_def | `bf0469f6bca18feeb9eea9eaf98dfffd0ecf9862babe1770f553727c4cbd28bb` |
| grass_swift | `63666b3d351e84d9bfe9f6ebe24eaf657a6b6e900b41249b7fa9a736ece54a5a` |
| grass_sustain | `84ed34ba5507dab4d0ccbc8aa91b480d22380cb6436549e43c3af9843273bbf1` |
| lightning_std | `c1bdd0bd3b6bb6da5c3f11072db2f9ed8df21eef39f4fd7d2ddbc941f7a2018c` |
| lightning_def | `9179c661cb67e3da6c6cb85a3dcf3d5bc079e7cf91c1355cec07cd9e7dc85ff3` |
| lightning_swift | `e942e0ebde234c49db89ce86e9c1fb84d335b4b1c60d99afc176a799eabc7183` |
| lightning_sustain | `57f2dcaf42e695f4b051bc4b6186672234b3df83d64a9a5dd0e50ae2f73877d0` |

## 인계와 제한

Mars는 아래 8개 완성 JSON 및 기존 파일럿 두 개를 사용해 Earth_2 담당 10종을 출력하고, Earth_1 결과와 합쳐 전체20 PNG/리뷰 시트를 생성하면 된다. Saturn의 전20종 동일성·실루엣·지각 중심·스타일 독립 검수 및 최종 CJ 판단이 남는다. 특히 여우의 어두운 몸/꼬리와 비대칭 무게, 골렘의 작은 눈 틈, 후드 가면의 미세 눈, 나무 방패 팔과 수염의 실제32 분리는 독립 확인 대상이다. 실제 제품 브라우저/DPR/확대율·HP·게임/AI·권리 체인 및 상용 캐릭터 유사성 포괄 검증은 수행하지 않았다.

시작/종료 해시 대조에서 관찰 대상 기존 PNG 전체, 4개 파일럿 JSON, 전투 패치 전체, 기존 Earth_2 보고, tools/tests 및 사용자 art/·orca-hook-latency-report.md가 동일했다. 동시 작업 중 fire_atk/fire_swift JSON 변경과 다른 원고·tooling QA 보고서 추가가 관찰되었으나 Earth_2 작성분이 아니므로 아래 목록에 포함하지 않았다. Downloads 원본은 편집하지 않았고, 제품 demo/index.html·server·gameplay 변경, Git/GitHub/Notion 쓰기, 추가 Issue/PR 및 하위 위임은 없다.

## files_modified — 정확히 9개

- docs/art/minions-v0.4.3/pixel-sources/grass_std.json
- docs/art/minions-v0.4.3/pixel-sources/grass_def.json
- docs/art/minions-v0.4.3/pixel-sources/grass_swift.json
- docs/art/minions-v0.4.3/pixel-sources/grass_sustain.json
- docs/art/minions-v0.4.3/pixel-sources/lightning_std.json
- docs/art/minions-v0.4.3/pixel-sources/lightning_def.json
- docs/art/minions-v0.4.3/pixel-sources/lightning_swift.json
- docs/art/minions-v0.4.3/pixel-sources/lightning_sustain.json
- docs/art/minions-v0.4.3/earth-2-full-delivery-report.md
