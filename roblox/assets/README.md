# [결정] Roblox 아트 — 현재 납품 현황

2026-09-10 · Ref #118. **기본 P0 129/129 + 별도 AI 창·봇 + 중앙 배너1종 납품**.

- **[중앙 배너 납품·적용 보고](../../docs/art/roblox-v0.5.0/earth-banner-report.md)**: banner.png256×128, ui_banner, 현행 panel 슬라이스와 호환.540×112 글자 목업 포함.

- **[AI 창·봇 적용 계약](ai-window-README.md)**: 이번 UI6PNG·알베도1PNG·로봇1종(FBX/OBJ/MTL). [납품 보고](../../docs/art/roblox-v0.5.0/earth-ai-window-report.md). 코드 연결 차이도 해당 문서에 정리했다.

- [manifest.csv](manifest.csv): 기본 P0 PNG129개 + AI UI6개 + 배너1개 =136행. 기존18열 유지, 파일·원고 SHA-256와 크기·틴트·SliceCenter 기록. 모델은 넣지 않는다.
- 하수인60: icon64는 native32 최근접2배, battle256은 승인64그리드 최근접4배, portrait512는 기존 파일 바이트 복사. 디자인 변경 없음, tint=no.
- [토큰9PNG](tokens/README.md): 왕관·협력 문양·폭탄·물리적 덫·공통 가림. 흰색+알파, tint=yes. CJ 선택3건은 승인 완료다.
- **[신규60PNG 적용 계약·키 전수표](ui/README.md)**: 속성4·흔적1, 타일4·하이라이트5·프레임1, UI 프레임20·상태7·아이템5·행동10·기술 종류3.
- 기본 PNG129개 중 tint=yes는 총16개(기존 토큰9 + 신규 하이라이트5·채움2), SliceCenter가 있는 것은 신규26개다. 다른 자산에 팀 틴트를 곱하지 않는다.
- 추가 [공통 가림3D](tokens/model-manifest.csv): 메시1종(FBX/OBJ/MTL), 260tri, 0.44×0.42×0.44stud. 종류별 차이 없이 같은 외형을 쓴다.
- 별도 [로비 납품](lobby/README.md): 기존6메시·6알베도·1상태 표지 + 신규봇1메시·1알베도, [로비 manifest](lobby/manifest.csv)15행. 루트136PNG와 분리한다.
- 중앙 공통 배너1장은 별도 소규모 요청 납품이다. 기존 P1 연출·FX·배너 전체 및 P2 스토어·모바일 완료를 뜻하지 않는다.

[최신 UI 납품 보고](../../docs/art/roblox-v0.5.0/earth-ui-report.md) · [하수인 이력](../../docs/art/roblox-v0.5.0/earth-report.md) · [토큰 이력](../../docs/art/roblox-v0.5.0/earth-token-report.md) · [로비 이력](../../docs/art/roblox-v0.5.0/earth-lobby-report.md) · [Claude 적용 인계](../../docs/roblox/claude-art-apply-handoff.md).

manifest 경로는 저장소 루트 C:\WOOK\pvpserver\client 기준이다.
현행 업로더의 세 manifest 집계는152대상(Image144·Model8)이며, 배너 dry-run은 **신규 Image1 · 기존151 재사용**이다.
기존 업로드는 Mars의 작업이다. Earth는 이번 배너를 업로드하거나 rbxassetid를 발급하지 않았다.
정보 은닉은 이미지뿐 아니라 서버 뷰 정책까지 필요하다. 이전 ID 누출에 대해 Mars가 셔플·뷰 정렬 수정/테스트를 보고했으며 최신 런타임 검증은 구현 QA 범위다.

## 라이선스

이 폴더의 원본·파생 시각 아트는 [ASSET-LICENSE.md](../../ASSET-LICENSE.md)에 따라 **Apache-2.0에서 제외**된다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
신규60개에는 외부 소재·플랫폼 이모지·폰트 글리프를 사용하지 않았다.
