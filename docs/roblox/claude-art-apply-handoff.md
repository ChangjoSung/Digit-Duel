# [결정] Claude(Mars)에게 — P0 잔여60PNG 적용 인계

2026-09-09 · Ref #118 · Earth(Codex) · **P0-B 속성·흔적5 / P0-C10 / P0-D45 신규 납품**.

기본 요청은 이제 **P0 129/129 PNG**가 준비됐습니다. 이미 적용한 하수인·토큰·가림 모델·로비는 유지하고, 이번60개를 현재 UI에 연결해주세요.
[60개 키·크기·틴트·SliceCenter 전수표](../../roblox/assets/ui/README.md)와 [신규 납품·독립 QA 보고](../art/roblox-v0.5.0/earth-ui-report.md)가 적용 계약입니다.
P1 연출·배너 및 P2 스토어·모바일은 아직 미납품입니다.

## 1. 시작점·역할·현재 구현과 구분

- Git 저장소/명령 루트: C:\WOOK\pvpserver\client. 이하 인라인 경로도 저장소 기준입니다.
- 작성 중 최종 확인 HEAD: ce1cc54dd4426587434cec01973b34ad215e06bc, 브랜치 feature/118-roblox-setup-ui.
- 공유 작업 중 커밋이 바뀌었습니다. [CLAUDE.md](../../CLAUDE.md), 최신 HEAD·diff부터 확인하고 기존 변경을 보존하세요. 아트 경로의 v0.5.0은 기존 폴더명이며 Roblox #118은 현재 v0.4.6입니다.
- dispatch: required_role=Mars / mode=IMPLEMENT / area=CLIENT·TOOLING / mutation=code·docs / instance_index=null(단일 기준).
- 서버 영역 변경이 필요하면 소관에 따라 Mercury/Jupiter와 조정하세요. 이 문서는 Worker Git 쓰기·PR·외부 게시 권한을 추가하지 않습니다.
- Earth는 신규 이미지·원고·문서만 만들었고, 이번60개 업로드·ID 발급·게임 코드 변경은 하지 않았습니다.

[기존 Mars 적용 보고](art-apply-report.md)의83개 업로드와 하수인·토큰·덮개·로비·판 위 대국 연결은 이미 진행된 작업입니다.
현재 Art.luau에도 icon/battle/portrait뿐 아니라 token, lobbyImage, lobbyMeshId, meshId가 있습니다.
후속 ce1cc54 커밋에는 로스터 선택·수동 배치·합법 수 표시가 추가됐습니다.
따라서 그 이전 보고의 “로스터 UI 없음”, “이동/공격 하이라이트 없음”, “60PNG 미납품”을 현재 상태로 재사용하지 마세요.
이 문서가 코드·Studio 검수 완료를 대신 판정하는 것은 아닙니다.

## 2. 납품 범위와 확정 디자인

| 묶음 | 수량 | 연결 기준 |
|---|---:|---|
| 기존 하수인20종×3용도 | PNG60 | 승인 외형·원본색 보존, 무틴트 |
| 기존 왕·동료·폭탄·덫·가림 | PNG9 | 왕관 / 협력 고리 / 심지 폭탄 / 물리적 덫 / 공통 덮개. 팀 틴트 |
| 신규 속성·흔적 | PNG5 | 불·물·풀·번개64, 흔적48 |
| 신규 보드 | PNG10 | 타일4, 하이라이트5, 외곽 프레임1 |
| 신규 UI | PNG45 | 프레임20, 상태7, 아이템5, 행동10, 기술 종류3 |
| 별도 로비 | PNG7 + FBX6 | 기존 전용 manifest, OBJ/MTL은 대체 원본 |
| 별도 공통 가림3D | FBX1 + OBJ/MTL | 기존 모델 manifest, 종류별 변형 없음 |

왕·동료 상징형, 물리적 덫, 파랑/빨강 팀 틴트는 CJ 승인 완료입니다.
공개된 왕·동료·폭탄·덫의 개별3D 메시를 새로 납품한 것은 아닙니다. 기존2D/빌보드 적용을 유지하세요.
포획 도구는 보라 다면체·사선 띠·마름모 코어로 제작했습니다. 유명 IP의 빨강/흰 반구 디자인으로 바꾸지 마세요.
추측 메모는 토큰4+속성4를 그대로 재사용합니다. 메모 전용 변형 이미지나 숨은 종류별 덮개는 만들지 않습니다.

## 3. 업로드·ID 연결

[루트 manifest](../../roblox/assets/manifest.csv)에는129개 PNG가 있습니다. 신규60개의 path, kind, id, source, SHA-256, 크기, 틴트, 슬라이스 경계를 모두 넣었습니다.

현재 roblox/tools/upload_assets.js는 **세 manifest**를 읽습니다.

- 루트 PNG: Image, 키는 kind_id. 예: element64_fire, **trace48_trace**, status48_shield, item64_ball, action48_search, skill32_sig, board_hl_move, ui_btn_primary_hover.
- 로비: PNG Image는 lobby_<asset_id>, FBX Model은 lobbymesh_<stem>.
- 가림: FBX Model은 mesh_unknown. OBJ/MTL은 업로드 대상에서 제외합니다.

현재 dry-run 결과: **전체143대상 / 신규 Image60 / 기존83 재사용 / 신규 Model0**.
전체 타입별로는 Image136·Model7입니다. 이미 업로드된83개를 중복 발급할 필요가 없습니다.
승인된 계정·기존 업로더 흐름으로 새60개를 올리고 asset-ids.json / 생성 AssetIds.luau를 갱신하세요.
검증용 dry-run 명령은 저장소 루트에서 node roblox/tools/upload_assets.js --dry 입니다.
구형 “PNG를 Decal로만 업로드” 설명은 현행 구현과 다릅니다.

현재 Art.luau에는 이번 UI/속성/상태/행동 키를 위한 접근 함수가 없습니다.
프로젝트의 허용 목록·nil 폴백 패턴에 맞게 연결하고, 미공개 서버 필드를 요청해서 키를 만들지 마세요.
기존 minion_art.py는20종 전용이므로 신규 native-assets.json을 입력으로 넣거나 도구 스키마를 임의 확장할 필요가 없습니다.

## 4. 이미지 표시·9-slice 핵심 계약

- 모든 신규 이미지는 PNG RGBA8, 알파0/255, 최대변128px. ResampleMode=Pixelated.
- 속성·아이템64: native32 →2배. 표시32/64/96px.
- 흔적·상태·행동48: native24 →2배. 표시24/48/72px. **32px 검토 그림은 비정수 최근접 스트레스 테스트**입니다.
- 기술 종류32: native32. 텍스트·숫자·단축키는 코드로 렌더하세요.
- 터치44px 이상은 별도 입력 영역으로 확보해야 합니다. 이번 조합 그림을 승인된 모바일 레이아웃으로 복사하지 마세요.

신규 tint=yes는 **7개만**입니다.

| 자산 | 색 |
|---|---|
| board_hl_move / board_hl_flee | #5b8cff |
| board_hl_attack / board_hl_forced | #ff5b6e |
| board_hl_sel | #ffd84d |
| ui_hpbar_fill | #4fd88a |
| ui_shbar_fill | #4da3ff |

이7개는 흰색+알파이며 ImageColor3로 색을 입힙니다. 나머지 신규53개는 흰색 ImageColor3를 유지합니다.
기존 토큰9개는 기존 팀 틴트를 계속 사용하고, 하수인 자체에는 팀 색을 곱하지 않습니다.

| 신규9-slice26개 | SliceCenter 좌표 L,T,R,B |
|---|---|
| 하이라이트5·board/frame | 32,32,96,96 |
| 패널3 | 16,16,112,112 |
| 버튼12 | 12,12,116,52 |
| badge | 12,12,52,28 |
| HP/방어막 바4 | 8,8,56,24 |

좌표는 네 방향 여백이 아니라 **원본 이미지의 중앙 사각형 좌표**입니다.
현재 CELL34/내부32px에128px 하이라이트의 SliceScale1을 쓰면 양쪽64px 캡이 겹칩니다.
32px 사각 오버레이는128→32 균등 축소 또는 **SliceScale0.25**, 64px는 SliceScale0.5를 사용하세요.
패널/버튼/바도 목표 크기가 축척 적용 후 캡 합계보다 커야 합니다.

HP/방어막 채움은 낮은 값에서 캡을 압축하지 않도록 전체 길이의 fill을 부모의 클립/크롭 폭으로 가립니다. 0이면 숨깁니다.
보드 HP 숫자 정책을 막대로 바꾸라는 요청은 아닙니다.
버튼 disabled는 별도 이미지이며 입력 차단도 코드에서 처리합니다. 자동 틴트·추가 투명도로 상태 대비를 중복 변경하지 마세요.
타일4개는2D 셀용이며 기존3D 판의 board_grid 텍스처를 무조건 덮어쓰는 자산이 아닙니다. 표시 계층에 맞게 적용하세요.

## 5. 정보 은닉·메모·공통 기호

- visibleTo=false면 말·덮개 모두 표시하지 않습니다.
- 보이지만 정체 미공개면 모든 종류에 같은 unknown 외형만 씁니다. 이미 공개된 정보에만 실제 토큰/하수인을 연결하세요.
- 속성 아이콘은 공개된 속성 또는 플레이어가 직접 고른 추측입니다. 숨은 정답을 자동 추측 메모·툴팁으로 제공하지 마세요.
- 흔적은 해당 뷰어에게 서버가 허용한 칸에만 표시합니다. 새 흔적 도형은 특정 종의 발자국이 아닙니다.
- 기술 종류 아이콘은 이미 공개된 종류만 표시합니다. 미공개 이름/ID/효과를 노출하지 않습니다.
- 확정 표시와 추측은 같은 기호를 쓰되 기존 규격대로 점선·불투명도0.5 등 **컨테이너 상태**로 구분하세요. 메모 기능 구현 여부는 최신 코드에서 별도로 확인합니다.
- 이전 고정 순번 ID 및 배열 순서 누출은 Mars가 ID 셔플·위치 정렬 수정과 테스트를 보고했습니다. 그 수정을 보존하고 회귀 확인하세요. Earth가 전체 은닉 안전성을 승인한 것은 아닙니다.
- 로컬 객체 이름·Attribute·툴팁·관전자 뷰에도 아직 공개되지 않은 정체가 새로 들어가지 않게 확인합니다.

## 6. 검수·완료 회신

Earth/Saturn이 통과시킨 것은 **로컬 아트**입니다:60개 원고↔PNG 픽셀,129행 manifest,9기호 흑백,30아이콘32px,버튼12상태,타일 반복,9-slice26개×2크기.
Studio 실제 표시·업로드 승인·입력·두 클라이언트·기기별 화면은 이번에 실행하지 않았습니다.

적용 후에는 다음을 구분해 회신해주세요.

1. 업로드60개 결과와143개 전체 키 중 누락/중복 여부.
2. 실제 연결된 화면/요소, 남은 폴백과 미연결 항목.
3. Studio에서 틴트7개·SliceCenter26개·작은 셀·짧은 바·disabled/hover/pressed 상태 확인.
4. 모바일 터치·픽셀 가독성,3D/2D 폴백 및 이미지 로드 실패.
5. 공개/미공개/숲 은닉/관전자/수동 추측 간 정보 은닉 회귀.
6. P1/P2 미납품은 별도 범위로 유지. 독립 Saturn QA와 CJ 실제 플레이 QA 요청.

**미결정:** 모바일 세로 7×13 보드의 스크롤/축소 정책, Experience 이름·아이콘 콘셉트. 이번 아트 납품은 이를 확정하지 않습니다.
신규 아트·원고는 [ASSET-LICENSE.md](../../ASSET-LICENSE.md)에 따라 Apache-2.0 제외입니다.

검토: [보드·UI 조합](../art/roblox-v0.5.0/review/p0-board-ui-composition.png) · [아이콘30종](../art/roblox-v0.5.0/review/p0-icons-contact.png) · [상세 적용 계약](../../roblox/assets/ui/README.md).
