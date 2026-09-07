# [결정] Earth_2 하수인 아트 반입 및 제작 검토

- 날짜: 2026-09-07
- required_role: Earth
- instance: Earth_2 / instance_index: 2
- mode: IMPLEMENT / area: ART / mutation: assets / provider: Codex
- 상태: **부분 완료 / 최종 아이콘 10개 미제작으로 dispatch outcome=failed**. 원본 40개 반입과 검수보고는 완료했고, native32 직접 픽셀 제작 방식은 CJ 선택 대기다.
- 근거: 최신 CJ 지시가 문서의 이전 미승인 표기보다 우선한다. 아트 반입·아이콘 제작은 승인되었으며 제품 구현은 후속 CJ OK 대기다.

## 수행 및 보호 범위

CLAUDE.md, docs/minion-visual-spec-v0.4.3.md, ASSET-LICENSE.md와 imagegen 스킬을 읽었다. 원본 10종의 portrait.png와 battle.png를 직접 시각 검사한 후 각 종의 portrait.png, portrait.webp, battle.png, battle-grid.png를 동일 이름으로 복사했다. Downloads 원본, 사용자 소유 art/, orca-hook-latency-report.md는 수정하지 않았으며 Git·Notion·GitHub 쓰기, 제품·도구·테스트 코드 수정, 실행 파일·스크립트 파일 생성, 하위 위임은 하지 않았다. battle-grid.png는 보존 자료이며 런타임 연결은 하지 않았다. 원본·파생 아트는 ASSET-LICENSE.md의 Apache-2.0 제외 대상이다.

## 객관 검증 — 확정

PowerShell Get-FileHash SHA256으로 원본과 복사본 40쌍을 각각 비교했고 40/40이 일치했다. Pillow를 메모리 내 읽기 전용 검사에 사용했다(스크립트 파일 없음). 10종 모두 portrait PNG/WebP는 512×512 RGBA, battle은 128×128 팔레트 PNG, battle-grid는 64×64 팔레트 PNG다. 10종 모두 battle-grid를 최근접 2배 확대한 RGBA 픽셀 배열과 battle의 RGBA 픽셀 배열이 바이트 단위로 일치했다.

| 종 폴더 | battle 불투명 RGB 색 수 | battle 투명 픽셀 수 | battle 부분 알파 | 2배 일치 |
|---|---:|---:|---:|---|
| grass_std | 32 | 11832 | 0 | 예 |
| grass_atk | 31 | 12068 | 0 | 예 |
| grass_def | 32 | 8964 | 0 | 예 |
| grass_swift | 32 | 11716 | 0 | 예 |
| grass_sustain | 31 | 12652 | 0 | 예 |
| lightning_std | 32 | 11276 | 0 | 예 |
| lightning_atk | 32 | 12560 | 0 | 예 |
| lightning_def | 32 | 10596 | 0 | 예 |
| lightning_swift | 32 | 11864 | 0 | 예 |
| lightning_sustain | 32 | 12992 | 0 | 예 |

원본 battle의 31~32색은 신규 icon의 최대 16색 요건과 별개다. 원본 portrait는 안티앨리어싱 및 부분 알파가 존재하며 원본 그대로 보존했다.

## 내장 이미지 생성 시험 — 확정

PD가 먼저 lightning_std 한 종을 시험하고 최종 icon.png가 아닌 제작 참고본으로 보존하도록 지시했다. built-in image_gen으로 원본 portrait 및 battle을 참조하여 별도 아이콘을 생성했다. API·CLI fallback은 사용하지 않았다.

- 저장: earth-2-lightning-std-generated-reference.png
- 실측: **1254×1254 RGB**, 81,249개 RGB 색, 알파 채널 없음. RGBA 변환 검사상 1,572,516픽셀 전부 A=255.
- 체크무늬는 투명 표시가 아니라 실제 이미지 픽셀이다.
- 1254÷32=39.1875로 캔버스가 논리 32그리드의 정수 배수가 아니다. 육안으로도 약 20px 크기의 세부 블록이 있어 정확한 32그리드 제작물로 판정할 수 없다.
- 원형 남색 몸통, 크림색 얼굴·발, 금색 중앙/어깨 수정 및 구리색 가슴 링은 유지되어 동일 캐릭터 참고로 활용 가능하다. 얼굴과 장비 디테일은 32px 납품에 여전히 과밀하다.

사용 프롬프트: stylized-concept / Digit Dual lightning_std 32×32 board inventory pixel icon production reference. 두 참조는 캐릭터 정체성 자료이며 기존 battle 축소 금지. 정면 2등신, 둥근 남색 갑옷 몸·큰 크림 얼굴·호박 눈·중앙 금색 수정과 어깨 수정·크림 발·구리 가슴 링의 단색 광원 유지, 번개 문양 제거. 논리 32×32 격자에 정렬된 단색 정사각 픽셀, 실제 32×32 RGBA 또는 논리 픽셀당 32×32의 정확한 1024 확대본. 투명 배경·외곽 2칸 투명·x2..29/y2..29·발 y29·중심 x15.5. 12색 목표/16색 최대, 내부 어두운 선과 세 보드 배경 위 선택적 밝은 림. HP·텍스트·숫자·기호·UI·받침대·배경·격자선·번짐·부분 알파 금지. 단일 캐릭터만 출력.

## 필요한 제작 절차 — 제안, 미실행

현재 생성본은 정확한 격자 확대본이 아니므로 단순 export나 축소로 납품할 수 없다. native 픽셀 편집기의 새 32×32 RGBA 캔버스에서 생성 참고본과 원본을 보며 직접 단순화해야 한다. x=0,1,30,31 및 y=0,1,30,31은 투명, 불투명 실루엣은 x2..29/y2..29, 바닥 y29, 중심 x15.5를 맞춘다. 색상표 8~12색을 먼저 고정하고 A=0/255만 사용하며 셀 단위로 얼굴·수정·팔다리를 재설계한다. 체크무늬를 통째로 마스킹한 뒤 축소하는 방식도 직접32 설계 요건을 충족하지 않는다.

PD 후속 답변: 생성 규격 실패를 확인했고 CJ에게 native32 제작 방식 선택을 요청했으므로 답 전에는 직접 픽셀 재설계나 API 대체를 진행하지 않는다. 독립 작업인 원본40개 검수보고·캐릭터별 특징 정리는 완료했으며, 아이콘 제작은 동일 범위 후속 task로 연결 가능하다. 내장 생성 재시도는 하지 않았다.

## 시각 검토 — 추론 및 남은 위험

| 종 | 보존할 특징 | 32px에서 약해지거나 혼동할 위험 |
|---|---|---|
| grass_std | 큰 두 새싹, 둥근 나무 얼굴, 잎 장갑 | 잎 두 장과 얼굴이 너무 작으면 일반 식물 덩어리로 보임 |
| grass_atk | 구부러진 덩굴 목, 긴 턱, 낫 같은 두 팔 | 가느다란 몸과 붉은 가시가 분절되어 실루엣을 잃기 쉬움 |
| grass_def | 넓은 수관, 두꺼운 나무 몸, 넓은 뿌리 | 수관만 강조하면 grass_std 또는 sustain과 혼동 가능 |
| grass_swift | 큰 잎 날개, 버섯 모자, 가는 다리 | 밝은 날개가 몸통을 압도하고 곤충 얼굴이 소실될 위험 |
| grass_sustain | 사슴형 흰 가면, 가지 뿔, 층진 잎 망토 | 작은 뿔·다중 뿌리의 점 잡음, grass_def와 녹색 덩어리 유사 |
| lightning_std | 둥근 남색 갑옷, 크림 얼굴, 세 금색 수정 | lightning_def와 남색/금색 갑옷 배색 유사, 둥근 얼굴을 크게 유지해야 함 |
| lightning_atk | 비대칭 긴 창 팔, 날카로운 머리, 가는 체형 | 창·뿔의 길이를 모두 유지하면 몸통이 너무 작아짐 |
| lightning_def | 낮고 넓은 골렘, 큰 두 주먹, 중앙 피뢰 코일 | lightning_std와 구별되도록 가로 폭과 작은 눈 틈 유지 필요 |
| lightning_swift | 긴 귀, 네 발, 크게 휘는 금색 끝 꼬리 | 복잡한 꼬리와 다리 사이 여백이 사라져 몸이 뭉칠 위험 |
| lightning_sustain | 뾰족 후드, 흰 가면, 긴 부유 망토, 구리 고리 | 작은 보주·고리가 점처럼 흩어지고 grass_sustain과 망토형 유사 |

최종 아이콘 10개 및 아이콘 1x/확대 배경 미리보기는 아직 없다. 전체20종 실루엣 구별, 실제 보드 위 대비, DPR·브라우저 확대율, 정보 은닉·게임 동작·런타임 QA는 수행하지 않았으며 통과를 주장하지 않는다.

## files_modified

각 아래 폴더에 portrait.png, portrait.webp, battle.png, battle-grid.png 4개씩 총40개:

- demo/assets/minions/grass_std/
- demo/assets/minions/grass_atk/
- demo/assets/minions/grass_def/
- demo/assets/minions/grass_swift/
- demo/assets/minions/grass_sustain/
- demo/assets/minions/lightning_std/
- demo/assets/minions/lightning_atk/
- demo/assets/minions/lightning_def/
- demo/assets/minions/lightning_swift/
- demo/assets/minions/lightning_sustain/

검토 자료:

- docs/art/minions-v0.4.3/earth-2-lightning-std-generated-reference.png
- docs/art/minions-v0.4.3/earth-2-report.md
