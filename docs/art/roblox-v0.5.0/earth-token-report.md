# [결정] Earth 토큰 · 공통 가림 모델 납품

2026-09-09 · Ref #118 · Earth / IMPLEMENT / ART / assets·docs / instance_index null.

## 완료 범위

**CJ가 답한 선택3건을 반영한 토큰9PNG와 공통 가림3D1종을 제작했다. 선택 대기가 아니다.**
왕·동료는 상징 문양, 폭탄은 짧은 심지의 둥근 장치, 함정은 맞물리는 톱니가 있는 **물리적 덫**이다.
모든 미공개 유닛에는 같은 닫힌 덮개를 사용하며 아군/적군은 파랑·빨강 틴트로 구분한다.

- [2D 팀 틴트 미리보기](review/tokens-tint-preview.png)
- [3D 공통 가림 미리보기](review/unknown-model-tints.png)
- [실제0.6셀 보드 적합성 렌더](review/unknown-board-fit.png)
- [납품 폴더·Mars 적용 안내](../../../roblox/assets/tokens/README.md)
- [Blender 편집 원본](token-source/token-set.blend)

**아트 파일 완료와 게임 적용은 다르다.** Roblox 업로드·rbxassetid 연결·클라이언트 교체·실게임 정보 은닉 검증은 하지 않았다.
특히 기존 순번 ID로 종류를 추정할 수 있는 문제가 발견되어 아래에 별도 인계한다. 공통 외형만으로 보안 완료를 주장하지 않는다.

| 기본 요청 묶음 | 현재 PNG | 요구 PNG | 남음 |
|---|---:|---:|---:|
| P0-A 하수인 | 60 | 60 | 0 |
| P0-B 토큰·속성·흔적 | 9 | 14 | 속성4 + 흔적1 |
| P0-C 보드·프레임 | 0 | 10 | 10 |
| P0-D UI·상태·행동 등 | 0 | 45 | 45 |
| 합계 | **69** | **129** | **60** |

추가 가림 모델1종과 이전 로비6메시는 PNG129장 집계 밖의 별도 납품이다.
남은 P0 자산 및 P1/P2까지 이번에 완료했다고 주장하지 않는다.

## CJ Decision Log와 제작 선택

| 날짜 | 구분 | 내용 |
|---|---|---|
| 2026-09-09 | CJ 결정 | “1번 상징문양” → 왕·동료를 사람형 캐릭터가 아닌 상징 문양으로 제작 |
| 2026-09-09 | CJ 결정 | “어울리는 모양… 함정은 덫” → 폭탄 세부 형태는 아트 재량, 함정은 물리적 덫 |
| 2026-09-09 | CJ 결정 | 팀 틴트 승인 + 공개 전 정체를 가릴 모습도 모델링 요청 |
| 2026-09-09 | Earth 제작 선택 | 왕관·연결 고리·심지 폭탄·톱니 덫·무문자 덮개. 물음표 글리프를 굽지 않아 텍스트 금지와 충돌하지 않음 |

과거 “폭탄/함정 모두 마법형” 제안은 사용자 결정으로 대체됐다.
가림 모델은 존재가 보이되 종류를 모르는 상태용이다. 숲 등으로 존재 자체가 안 보이는 말을 새로 드러내는 규칙 변경이 아니다.

문서 반영 위치: [원 요청서 P0-B·8장](../../roblox/earth-art-request.md), [전체 진행·최초 하수인 이력](earth-report.md),
[로비 보고의 선택 현황](earth-lobby-report.md), [아트 인덱스](README.md), [납품 루트 안내](../../../roblox/assets/README.md).
Notion/GitHub Decision Log에는 게시하지 않았다. 외부 기록은 Mercury 인계 사항이다.

## 제작 방식과 규격

기존 native32 픽셀 원고 체계를 확장하여 5종 JSON 원본을 만들고 Blender 내부 아트 명령으로 출력했다.
기존 도구가 하수인 roster만 받으므로 도구 코드를 바꾸거나 신규 제작 스크립트를 저장하지 않았다.
imagegen 스킬의 적용 경계를 확인했으며, 이번 토큰은 기존 픽셀 원고 시스템의 확장이므로 imagegen을 사용하지 않았다.
문서화 스킬에 따라 산출물 규격과 런타임 적용 조건·제외 범위를 분리했다.

| 산출물 | 수량·규격 |
|---|---|
| 왕·동료·폭탄·덫 | 64px와128px 각각4장, native32 최근접2배/4배 |
| 공통 가림 아이콘 | 64px1장, native32 최근접2배 |
| 런타임 PNG 합계 | **9장 / 7,635 bytes**, RGBA8, white RGB255, alpha0/255, tint=yes |
| 공통 가림 메시 | FBX1 + 대체OBJ1/MTL1, **132정점 / 260삼각형** |
| 모델 크기·피벗 | Y-up, X×Y×Z **0.44×0.42×0.44stud**, 바닥중앙(0,0,0) |
| 편집 원본 | native32 JSON5개 + 패킹된 token-set.blend |
| 검토 이미지 | 틴트·32px·흑백·3D색·보드적합성5장 |

함정은 1차 시안에서 눈 모양으로 오독될 수 있어 큰 맞물림 톱니·각진 턱·경첩을 보강했다.
최종 파일은 보강본이며 Saturn이 물리적 덫으로 다시 식별했다.
왕·동료는 성별·종족·얼굴 설정을 추가하지 않았다. 덮개도 특정 유닛의 머리·귀·무기·속성 무늬를 쓰지 않았다.

흰 단색은 신규5종의 틴트 전용 원본이다. 기존 컬러 하수인60PNG는 변경하거나 틴트하지 않는다.
메모는 같은 토큰 어휘를 점선·불투명도0.5로 재사용하며, 추측 메모 파일을 중복 제작하지 않았다.

모델은 한 덩어리로 닫힌 불투명 메시다. 별도 이미지 텍스처 없이 MeshPart.Color(Color3 값)로 팀 색을 입힌다.
0.6셀에서 좌우 여백0.08을 확보한다. Blender 원본은 Z-up이며 내보내기 -Z Forward/Y Up으로 변환했다.
실제 Studio가 피벗을 외접 중심으로 재설정하는 경우 바닥 대비 Y0.21 보정을 확인해야 한다.

## 독립 검수 — Saturn

독립 검수자는 읽기 전용으로 파일·이미지·별도 headless Blender 재반입·저장 원본을 확인했다.

| 검사 | 결과 |
|---|---|
| PNG 수량/지정크기/RGBA8 | 9/9 PASS |
| 모든 불투명 RGB255, alpha0/255 | 9/9 PASS |
| JSON native32와 PNG 최근접2배/4배 전픽셀 비교 | 9/9 일치, mismatch0 |
| 32px·흑백·세 말 배경·팀 틴트 | 5종 정적 시각 검수 PASS, 최종 덫 보강본 포함 |
| FBX/OBJ 재반입 | 단일 메시·단일 흰 재질, 132정점260tri, 치수·바닥 피벗 일치 |
| 모델 건전성 | 경계 모서리0, 축퇴면0, 닫힌 manifold, 양의 체적 |
| FBX 대 OBJ 좌표 | 월드 정점 좌표 소수6자리 일치 |
| 모델에 숨은 정체 데이터 | 내장 이미지·애니메이션·shape key·사용자 속성 없음 |
| 루트 PNG manifest | 69행, bytes·SHA·sourceSHA·크기·경로 일치, 중복 경로/업로드 키0, 비PNG0 |
| 기존 원본·납품 보존 | source-baseline101개 및 기존 하수인60PNG 해시 일치 |
| 저장 .blend | 정상 열림, Text/Action/driver/외부 링크 라이브러리0, 필요 이미지 패킹, JSON5개와 내장 원고 일치 |

`node roblox/tools/upload_assets.js --dry`는 기존ID60 재사용 + 신규9 업로드 예정만 출력하고 종료했다.
실제 업로드가 아니며 파일·네트워크 변경은 없다.
기존 업로더는 루트 manifest 전체를 PNG로 처리하므로 모델은 별도 [model-manifest.csv](../../../roblox/assets/tokens/model-manifest.csv)에 둔다.
신규 kind는 token64/token128로 구분되어 왕 등 같은 이름의 크기별 키가 충돌하지 않는다.

원본 .blend에는 기존 로비·프리뷰 등 총95개 객체가 문맥 보존용으로 들어 있다.
**Earth_Unknown_Source 장면의 unknown만 선택하여 내보낸다.** 납품 FBX/OBJ는 이미 해당 단일 메시만 포함한다.
이전 lobby-cafe.blend와 로비 자산 파일은 이번에 수정하지 않았다.

검수 한계: Studio 실제 임포트·모바일 가독성·사용자 블라인드 식별·통합 플레이·전체 보안·포괄적 권리 조사는 미검증이다.
보드 렌더는 14개 덮개의 크기/색 비교용이며, 내 말까지 가리는 실제 게임 규칙을 뜻하지 않는다.

## Mars 인계 — 적용과 기존 정보 누출 위험

1. `visibleTo=false`면 아예 표시하지 않는다. 보이지만 `known=false`면 공통 덮개/unknown64만 사용한다.
2. 실제 숨은 유닛을 덮개 뒤에 복제하지 않는다. 이름·Attributes·HP·접근성 텍스트·종별 이미지 요청에도 정체를 남기지 않는다.
3. 내 말/공개된 상대 말의 확정 외형과 플레이어가 선택한 추측 메모를 구별한다. 숨은 정답으로 메모를 자동 생성하지 않는다.
4. **현재 ID 누출은 별도 수정 필요:** [Engine.new](../../../roblox/src/shared/Engine.luau)는 소유자별 하수인6→폭탄3→동료2→덫2→왕1 고정 순서로 만들고, mkPiece는 nextId를 순증가한다.
   [Views.forViewer](../../../roblox/src/shared/Views.luau)는 known=false여도 원본 p.id를 전송한다.
   필드에서 type/rosterId/HP를 빼더라도 ID에서 종류를 추정할 수 있다(예: 최초 왕14/28).
   이는 읽기 전용 코드 확인으로 발견한 기존 위험이며, 이번 아트 작업에서 고치지 않았다.
5. Mars는 외부에서 종류와 연결할 수 없는 뷰어용 ID 매핑 등의 방안을 검토하고, 서버 행동 검증과 함께 공개 전후/배치/숲/포획/메모의 누출을 Saturn에게 검증 요청해야 한다.
6. Roblox 업로드·ID 연결·표시 교체·피벗·실기기 검수는 후속 구현 범위다. 이번 승인 범위를 확대해 게임 코드나 테스트를 고치지 않았다.

## 라이선스와 작업 경계

시각 아트·픽셀 원고·모델·재질·편집 원본·검토 렌더는 [ASSET-LICENSE.md](../../../ASSET-LICENSE.md)에 따라 Apache-2.0에서 제외한다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
신규 토큰에 외부 소재·이모지/폰트 글리프·특정 IP를 쓰지 않았다. 보드 렌더의 목재는 이전 로비 자산 재사용이다.
기본 육안 유사성 검수는 권리 보증이 아니다.

작업 시작 HEAD: `6d80a1fb0b53961288e0ef25f242ee098f5ecb5c`, 브랜치 `feature/118-roblox-port`.
게임·빌드·도구·테스트 코드 작성/수정0, git쓰기0, 업로드0, 기존 하수인 자산 변경0.
최종 자체 점검: 아래32개 경로의 실제 존재·보고 목록 일치, 문서 상대링크85개 누락0, PNG69개 출력 해시 일치.
`git diff --check` 통과, HEAD 변경 없음. Git의 LF→CRLF 안내는 있었으나 공백 오류는 없었다.

## worker_done

경로는 공유 작업공간 `C:\WOOK\pvpserver` 기준이다. 총32개 실제 신규/수정 파일이며, 이전 로비 자산은 이번 목록에 포함하지 않는다.

```yaml
worker_done:
  role: Earth
  instance_index: null
  dispatch_ref: "#118 CJ 토큰 선택3건 + 공통 가림 모델"
  status: completed_art_delivery
  files_modified:
    - "client/roblox/assets/tokens/README.md"
    - "client/roblox/assets/tokens/model-manifest.csv"
    - "client/roblox/assets/tokens/king_64.png"
    - "client/roblox/assets/tokens/king_128.png"
    - "client/roblox/assets/tokens/ally_64.png"
    - "client/roblox/assets/tokens/ally_128.png"
    - "client/roblox/assets/tokens/bomb_64.png"
    - "client/roblox/assets/tokens/bomb_128.png"
    - "client/roblox/assets/tokens/trap_64.png"
    - "client/roblox/assets/tokens/trap_128.png"
    - "client/roblox/assets/tokens/unknown_64.png"
    - "client/roblox/assets/tokens/meshes/unknown.fbx"
    - "client/roblox/assets/tokens/meshes/unknown.obj"
    - "client/roblox/assets/tokens/meshes/unknown.mtl"
    - "client/docs/art/roblox-v0.5.0/token-source/king.json"
    - "client/docs/art/roblox-v0.5.0/token-source/ally.json"
    - "client/docs/art/roblox-v0.5.0/token-source/bomb.json"
    - "client/docs/art/roblox-v0.5.0/token-source/trap.json"
    - "client/docs/art/roblox-v0.5.0/token-source/unknown.json"
    - "client/docs/art/roblox-v0.5.0/token-source/token-set.blend"
    - "client/docs/art/roblox-v0.5.0/review/tokens-tint-preview.png"
    - "client/docs/art/roblox-v0.5.0/review/tokens-32-three-backgrounds.png"
    - "client/docs/art/roblox-v0.5.0/review/tokens-silhouette.png"
    - "client/docs/art/roblox-v0.5.0/review/unknown-model-tints.png"
    - "client/docs/art/roblox-v0.5.0/review/unknown-board-fit.png"
    - "client/docs/art/roblox-v0.5.0/earth-token-report.md"
    - "client/docs/art/roblox-v0.5.0/earth-report.md"
    - "client/docs/art/roblox-v0.5.0/earth-lobby-report.md"
    - "client/docs/art/roblox-v0.5.0/README.md"
    - "client/docs/roblox/earth-art-request.md"
    - "client/roblox/assets/README.md"
    - "client/roblox/assets/manifest.csv"
  summary: |
    왕/동료 상징·어울리는 폭탄/물리적 덫·팀 틴트 승인 반영, 선택 대기 해소.
    native32 원고5종에서 64/128 토큰9PNG, 공통 가림3D1종 260tri 납품.
    기본 P0 현재69/129PNG이며 나머지60PNG와 P1/P2는 미납품.
    독립 파일·시각·모델 QA PASS. 실제 Roblox 적용/업로드/보안 검증은 별도.
    게임·도구·테스트 코드 및 기존 하수인 변경0, git쓰기0, 업로드0.
  requests_to_mars: |
    업로드·rbxassetid·2D/3D 연결 및 실제 Studio 임포트·피벗·모바일 검수.
    known/visibleTo 기반 공통 덮개 표시, 숨은 실제 본체/메타데이터/종별 요청 금지.
    기존 Engine 순번ID와 Views 전송에서 종류 추정 가능: 뷰어용 ID 등 별도 보안 수정·검증 필요.
    모델은 PNG 전용 업로더와 분리하고 메모는 동일 기호를 재사용.
  planning_needed:
    - "모바일44px 셀과 스크롤/축소 정책"
    - "Experience 이름·아이콘 콘셉트"
    - "P2 스토어·문서 이미지1024px 초과 예외 여부"
  qa_request: |
    아트 파일 범위는 Saturn 읽기 전용 독립 검수 완료.
    후속 구현 후 공개 전후·숲·메모·ID/요청 누출·실제 Roblox 표시를 Saturn 검증.
    CJ 최종 외형 확인과 Mercury 외부 Decision Log 동기화는 별도.
```
