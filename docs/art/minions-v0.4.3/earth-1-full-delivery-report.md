# Earth_1 불·물 나머지 8종 native32 원고 납품

[결정] 2026-09-07 CJ 구현 승인 및 Saturn 파일럿 V2 ART PASS 이후 승인된 잔여 제작을 완료했다.

- required_role=Earth; instance=Earth_1; instance_index=1
- mode=IMPLEMENT; area=ART; mutation=assets; provider=Codex
- taskId=task_68db3be634d4; dispatchId=ctx_35aef7b93c5e
- 상태: **8/8 원고 ready — Mars export 가능**. 이전 파일럿 2종과 합쳐 Earth_1 담당 10종의 원고가 준비되었다.
- files_modified: 아래 **정확히 9파일**. 이번 보고는 자체 아트 검토이며 Saturn PASS 선언이 아니다.

## 제작과 실제 시각 검토

CLAUDE.md, visual spec(특히 7.6), source-qa-saturn.md, 이전 earth-1-report.md·earth-1-native-report.md, 파일럿 1차/V1/V2 QA를 읽었다. 8종 모두 Downloads 원본 portrait와 battle을 메모리 합성 화면에서 직접 보았으며, 최종에는 portrait·실제128 battle·native32의 1×/최근접4×를 나란히 다시 대조했다. 승인된 파일럿 4종 PNG도 기존 icons-board-backgrounds.png의 세 배경 1×/4×로 직접 확인했다.

각 종의 픽셀 행과 팔레트를 개별 작성했다. 큰 머리/얼굴과 짧은 몸통을 우선했고, 거북·게·화염 정령은 원본 생물 구조를 유지하며 식별 기관을 크게 단순화했다. 공통 몸통 템플릿·전투 축소·도형 생성·image_gen 후처리는 사용하지 않았다. HP·텍스트·속성 글리프는 없다.

기존 Mars의 `load_icon_source` / `render_icon` / `build_background_sheet`를 **python -B로 메모리에서만 호출**했다. 전 8종의 실제32 및 최근접4×를 #33406e / #6e3340 / #3a4152에서 직접 보고, 최초 좌우 배치 조정 후 재검토했다. 화염 투사는 검은 갑주 안 눈·뺨·턱 면을 보완했고, 물방울 요정은 둥근 몸통과 얼굴 음영을 보완했으며, 산호 수호자는 패각 층의 어두운 색을 추가했다. 이 세 수정본도 세 배경에서 다시 보았다.

자체 관찰상 원본의 주요 정체가 유지되고 얼굴과 핵심 기관을 읽을 수 있다. 따뜻한 불 계열과 청록 물 계열, 어두운 내부선과 선택적 밝은 면으로 파일럿에 맞췄다. 기존 Mars 실루엣 함수의 **2×** 흑백 시트도 메모리에서 확인하여 이번 8종의 서로 다른 외형을 대조했다; 전체20종의 독립 식별 검사를 뜻하지 않는다.

## 최종 정적 검사 [확정]

모든 파일은 정확히 32행×32열이며, 점은 #00000000이고 나머지는 완전 불투명 RGB다. 전8종 렌더 결과는 RGBA 32×32, 알파 집합 {0,255}, 원고 1024셀과 픽셀 exact, 네 변 2px 이상의 투명 여백, 최하단 y=29를 충족했다. 최종 로더 경고 0개이며, 초기 중심 대리 지표 오류와 수정 후 미사용 팔레트 기호는 해결했다.

bbox는 Pillow 기준 **우하단 제외**다. 불투명 x평균은 산술값이며 지각 중심을 증명하지 않는다. x15.5를 목표로 배치하고 세 배경에서 균형을 자체 검토했으나, 지각적 정렬의 독립 최종 판정은 Saturn에 남긴다.

| id | 사용색 | bbox | 불투명 수 | x평균 | 유지한 정체 |
|---|---:|---|---:|---:|---|
| fire_std | 11 | (4,2,28,30) | 411 | 16.043796 | 크림 쌍뿔·주둥이·배, 현무암 이마판, 작은 날개, 둥근 용암 꼬리. 큰 머리와 짧은 하체로 구성. |
| fire_atk | 10 | (3,2,28,30) | 400 | 14.9175 | 불꽃 쌍뿔, 검은 용암 갑주, 전방 거대 주먹·반대 작은 주먹. 큰 얼굴의 눈/뺨/턱과 어두운 목을 분리. |
| fire_def | 11 | (3,4,28,30) | 451 | 14.991131 | 낮은 사족, 넓은 분절 등껍질, 주 분화구와 작은 불기둥, 돌출 크림 부리. 날개 없는 무거운 실루엣. |
| fire_swift | 10 | (6,2,26,30) | 279 | 16.437276 | 검은 타원 머리·밝은 눈, 대각선 위/아래 화염 날개, 후방 불꽃 띠. 넓어진 머리와 매우 짧은 몸. |
| water_std | 11 | (6,2,26,30) | 345 | 16.576812 | 말린 물방울 머리, 크림 얼굴·파란 눈, 작은 지느러미 날개, 둥근 물몸·짧은 발. |
| water_atk | 11 | (3,2,28,30) | 415 | 15.13012 | 큰 상어 머리·이빨, 등지느러미, 양쪽 낫날 팔, 감긴 꼬리. 얼굴/턱을 확대하고 다리를 압축. |
| water_def | 11 | (3,2,28,30) | 411 | 15.690998 | 층진 산호색 나선 패각, 청록 게의 두 눈·집게, 한쪽 부채 패각 방패와 짧은 다리. |
| water_sustain | 10 | (5,2,29,30) | 417 | 15.323741 | 파도 갈기, 흰 수염의 큰 얼굴, 손의 물 구체, 투명 속공간이 있는 C형 물꼬리. |

| 최종 source JSON | SHA-256 |
|---|---|
| fire_std.json | `509339bdbac7a2a901ea8675a051808fb0af545a4a0869082dd05b52cb19c559` |
| fire_atk.json | `554f33d12c823d61cb29abe34453921fd7e313b7b193196eded8898049399b96` |
| fire_def.json | `ac3fe2bc226b468c27250a2ecd3396edbd5aea098887e731d6ecf2af4afb74ed` |
| fire_swift.json | `bad2694d12197d9a686bc8bf7c9e20ad4dced0267ca43df9df207c8bded0e9ee` |
| water_std.json | `37b279e72d96970b5e4e110b47cbce153cd9964d58bcaf76479759ac8492f4bd` |
| water_atk.json | `05eb393deff56ecaff0ab967451b39a267f9fa21dad6b05d1792e78a7e707dd0` |
| water_def.json | `75d7b44e1aa906fe9de5e45eb6475e789b6b06a7f50f9889f4019a799e0b555d` |
| water_sustain.json | `be0c76104e797adba9ab00163eb643351348a2be86084c3bda7f3a3bd18f3b64` |

8종 최종 세 배경 시트를 기존 Mars 함수로 재구성한 **메모리 PNG 바이트** SHA-256: `a38cecb6db1a8a8f7b45781d09c5c70dd77406e7f0b9eb1a36838dede83cfa9f`. 이 값은 파일 경로가 아니며 PNG/미리보기 파일을 저장하지 않았다. 원고 해시가 일치하는 소스를 Mars가 같은 함수로 렌더하면 검토 화면을 재구성할 수 있다.

담당 8종의 기존 portrait.png / portrait.webp / battle.png / battle-grid.png **32파일 모두 Downloads 원본과 바이트 일치**를 읽기 전용 검사로 확인했다.

## 제한과 후속

- **미확정:** 이 8종의 Saturn 독립 ART 판정, 전체20종 32px/흑백 식별과 지각 중심, 최종 CJ 디자인 승인.
- 원본의 복잡한 균열·산호 가지·비늘·미세 수염은 32px 가독성을 위해 축약했다. 화염 투사의 작은 눈과 어두운 하체, 거북의 오른쪽을 향한 부리, 물방울 요정의 말린 머리와 한쪽 날개가 만드는 무게, 파도 술사의 손/구체 분리는 독립 QA에서 특히 다시 확인할 부분이다.
- Mars가 이 원고 8개와 다른 담당 원고를 취합하여 **전체20종 PNG export 및 리뷰 시트**를 만들고 Saturn이 독립 검수한다. 이번 작업에서 PNG 파일은 생성·수정하지 않았다.
- 제품 표시·HP·DPR·브라우저 확대·게임플레이 회귀, 권리 체인·상용 캐릭터 유사성 포괄 검증은 수행하지 않았다.
- 사용자 art/·orca-hook-latency-report.md·Downloads, 네 파일럿 JSON, 모든 battle-patches, 도구·테스트·다른 Earth 보고서에 쓰지 않았다. Git/GitHub/Notion 쓰기, 하위 위임, demo/index.html·서버·게임플레이 변경은 없으며 단일 Issue #87/통합 PR 운영은 Mercury 소관이다.

## files_modified [정확히 9개]

1. docs/art/minions-v0.4.3/pixel-sources/fire_std.json
2. docs/art/minions-v0.4.3/pixel-sources/fire_atk.json
3. docs/art/minions-v0.4.3/pixel-sources/fire_def.json
4. docs/art/minions-v0.4.3/pixel-sources/fire_swift.json
5. docs/art/minions-v0.4.3/pixel-sources/water_std.json
6. docs/art/minions-v0.4.3/pixel-sources/water_atk.json
7. docs/art/minions-v0.4.3/pixel-sources/water_def.json
8. docs/art/minions-v0.4.3/pixel-sources/water_sustain.json
9. docs/art/minions-v0.4.3/earth-1-full-delivery-report.md
