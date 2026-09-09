# 말 토큰 · 공통 가림 모델

2026-09-09 · Ref #118 · Earth 아트 납품. **선택 3건은 CJ 승인으로 해소됐다.**
게임 적용·업로드는 하지 않았다. [납품 보고](../../../docs/art/roblox-v0.5.0/earth-token-report.md).

## 디자인과 파일

| 대상 | 표현 | PNG |
|---|---|---|
| 왕 | 세 꼭짓점 왕관 상징 | `king_64.png`, `king_128.png` |
| 동료 | 맞물린 두 고리의 협력 문양 | `ally_64.png`, `ally_128.png` |
| 폭탄 | 짧은 심지·불꽃이 있는 둥근 장치 | `bomb_64.png`, `bomb_128.png` |
| 함정 | 큰 톱니·경첩·압력판이 있는 물리적 덫 | `trap_64.png`, `trap_128.png` |
| 미공개 말 | 얼굴·속성·장비가 없는 닫힌 덮개 | `unknown_64.png` |

왕·동료 상징형 / 어울리는 폭탄과 **덫** / 파랑·빨강 팀 틴트는 CJ 결정이다.
문양의 구체적 픽셀과 덮개 형태는 이 결정 안에서 Earth가 제작한 디자인이다.
기존 요청서의 `?` 상태를 문자 없는 덮개로 표현했다. 글자·이모지 글리프를 사용하지 않았다.

5종 모두 native32 원고를 최근접 2배/4배로 출력했다. RGBA8, 흰색 RGB255 단색, alpha0/255다.
ImageLabel의 `ImageColor3`로 파랑 `#5b8cff` / 빨강 `#ff5b6e`를 입힌다.
별도 팀별 PNG나 프레임 모양은 이번에 만들지 않았다. `ResampleMode=Pixelated`, 정수 배율 표시를 유지한다.
**기존 20종 하수인 그림은 틴트하지 않는다.** 속성색·승인 외형을 보존하고 팀 색은 칩/테두리 등 별도 표시부에 적용한다.

## 공통 3D 모델

- 주 파일: [unknown.fbx](meshes/unknown.fbx). 대안: [unknown.obj](meshes/unknown.obj) + [unknown.mtl](meshes/unknown.mtl). 둘을 동시에 배치하지 않는다.
- 닫힌 12각 덮개와 낮은 받침이 연결된 단일 메시. **132정점 / 260삼각형**, 단일 흰색 불투명 재질.
- X×Y×Z = **0.44×0.42×0.44 stud**, Y-up, 1unit=1stud, 원점은 바닥 중앙 `(0,0,0)`.
- 보드 셀 0.6 안에서 좌우 여백 0.08. 보드 윗면 Y3.2에 바닥을 놓으면 윗끝 Y3.62.
- Studio가 피벗을 외접 중심으로 바꾸면 중심은 바닥보다 Y0.21 높다. 실제 임포트에서 확인·보정한다.
- 순백 재질이므로 별도 이미지 텍스처가 필요 없다. `MeshPart.Color`에 Color3 팀 색을 지정한다.
- 애니메이션·종별 형태·얼굴·장비·문양·내부 실제 유닛·사용자 정의 속성·내장 이미지가 없다.
- 모든 종류에 **같은 메시·크기·방향·재질**을 사용한다. 색만 팀을 구분한다.

## 정보 은닉 적용 계약 — Mars 구현 사항

| 뷰어가 아는 상태 | 표시 |
|---|---|
| 보이지 않는 말 (`visibleTo=false`) | 덮개도 만들지 않음 |
| 보이지만 정체 미확인 (`known=false`) | 공통 가림 모델 또는 `unknown_64`만 표시 |
| 내 말·공개된 상대 말 등 `known=true` | 해당 확정 아이콘/본체 표시 |
| 플레이어가 직접 지정한 추측 메모 | 동일 토큰 어휘 재사용, 점선·불투명도0.5로 추측임을 표시 |

메모는 숨은 정답으로 자동 생성하지 않는다. 가림 모델에 메모 내용을 종별 형상으로 새기지 않는다.
미공개 상태에 HP·실제 종 이름·rosterId·속성·종별 이미지 경로를 싣지 않는다.
덮개 뒤에 실제 유닛을 숨겨서 복제하는 방식도 금지한다. 뷰어별로 공통 모델만 표시하고,
종별 자산 요청·객체 이름·Attributes·접근성 텍스트로 정체가 노출되지 않도록 구현해야 한다.
확정/추측은 같은 PNG를 재사용하며, 요청서의 메모 8종을 별도 파일로 만들지 않는다.

**별도 보안 인계:** 현재 `Engine`은 종류별 고정 순서로 순번 ID를 만들고 `Views`는 미공개 말에도 그 ID를 전송한다.
ID로 종류를 역추정할 수 있으므로 공통 외형만으로 정보 은닉이 완성되지 않는다.
게임 코드는 변경하지 않았다. Mars는 외부에서 종류와 연결할 수 없는 뷰어용 ID 매핑 등을 검토하고
서버 행동 검증·공개 전후·숲 은닉·메모·종별 요청 누출을 Saturn과 검증해야 한다.

## Manifest와 편집 원본

- [상위 manifest](../manifest.csv)는 **PNG 전용**이다. 이 묶음 9행은 `token64`/`token128` kind를 사용하므로 크기별 업로드 키가 충돌하지 않는다.
- [model-manifest.csv](model-manifest.csv)는 모델 전용이다. path/source는 이 `tokens/` 폴더 기준. 기존 PNG 업로더에 FBX·OBJ·MTL을 넣지 않는다.
- native32 원고: [king](../../../docs/art/roblox-v0.5.0/token-source/king.json), [ally](../../../docs/art/roblox-v0.5.0/token-source/ally.json), [bomb](../../../docs/art/roblox-v0.5.0/token-source/bomb.json), [trap](../../../docs/art/roblox-v0.5.0/token-source/trap.json), [unknown](../../../docs/art/roblox-v0.5.0/token-source/unknown.json).
- 편집 원본: [token-set.blend](../../../docs/art/roblox-v0.5.0/token-source/token-set.blend). `Earth_Tokens_Native32` 장면의 `token_pixel_sources_json`에도 같은 원고를 보존했다.
- 모델 원본은 `Earth_Unknown_Source`, 검토 장면은 `Earth_Unknown_Tint_Proof`와 `Earth_Unknown_Board_Fit`다.
- 기존 로비/기본 장면도 문맥 보존용으로 들어 있다. 배포할 원본 메시만 선택해서 내보낸다. 기존 `lobby-cafe.blend` 파일은 수정하지 않았다.

이번 토큰은 기존 native32 픽셀 시스템을 확장한 것으로 imagegen을 사용하지 않았다.
사용자가 허용한 Blender 내부 아트 명령으로 픽셀 이미지·메시·프리뷰를 제작했으며 별도 실행 스크립트나 게임 코드를 만들지 않았다.
보드 적합성 프리뷰의 목재는 이전 로비 자산을 재사용한 배경이며 unknown 모델 재질이 아니다.

## 검토 이미지

- [팀 틴트](../../../docs/art/roblox-v0.5.0/review/tokens-tint-preview.png): 왼쪽부터 왕·동료·폭탄·덫·가림, 위 파랑/아래 빨강.
- [실제 32px · 세 배경](../../../docs/art/roblox-v0.5.0/review/tokens-32-three-backgrounds.png): 같은 열 순서, 위부터 `#33406e` / `#6e3340` / `#3a4152`.
- [흑백 실루엣](../../../docs/art/roblox-v0.5.0/review/tokens-silhouette.png): 같은 열 순서, 흰색/검정 비교.
- [3D 팀 색](../../../docs/art/roblox-v0.5.0/review/unknown-model-tints.png): 흰 원본 / 파랑 / 빨강.
- [0.6셀 보드 적합성](../../../docs/art/roblox-v0.5.0/review/unknown-board-fit.png): 14개 공통 덮개의 크기·색 비교를 위한 Blender 렌더. **내 말까지 가리는 실제 게임 상태를 뜻하지 않는다.**

## 라이선스

이 폴더와 편집 원본·검토 이미지의 시각 아트는 [ASSET-LICENSE.md](../../../ASSET-LICENSE.md)에 따라 Apache-2.0에서 제외된다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
외부 소재·폰트 글리프·특정 IP를 가져오지 않았다. 기본 육안 유사성 검수는 포괄적 권리 보증을 뜻하지 않는다.
