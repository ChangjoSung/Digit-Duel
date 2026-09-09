# [결정] Roblox 아트 — 현재 납품 현황

2026-09-09 · Ref #118. **기본 요청 P0 129/129 PNG 납품 완료**: 하수인60 + 토큰9 + 이번 속성·흔적5 / 보드10 / UI45.

- [manifest.csv](manifest.csv): 기본 P0 PNG129개. 기존18열 유지, 파일·원고 SHA-256와 크기·틴트·SliceCenter 기록. 모델은 넣지 않는다.
- 하수인60: icon64는 native32 최근접2배, battle256은 승인64그리드 최근접4배, portrait512는 기존 파일 바이트 복사. 디자인 변경 없음, tint=no.
- [토큰9PNG](tokens/README.md): 왕관·협력 문양·폭탄·물리적 덫·공통 가림. 흰색+알파, tint=yes. CJ 선택3건은 승인 완료다.
- **[신규60PNG 적용 계약·키 전수표](ui/README.md)**: 속성4·흔적1, 타일4·하이라이트5·프레임1, UI 프레임20·상태7·아이템5·행동10·기술 종류3.
- 기본 PNG129개 중 tint=yes는 총16개(기존 토큰9 + 신규 하이라이트5·채움2), SliceCenter가 있는 것은 신규26개다. 다른 자산에 팀 틴트를 곱하지 않는다.
- 추가 [공통 가림3D](tokens/model-manifest.csv): 메시1종(FBX/OBJ/MTL), 260tri, 0.44×0.42×0.44stud. 종류별 차이 없이 같은 외형을 쓴다.
- 별도 [로비 납품](lobby/README.md): 6메시·6알베도·1상태 표지, [로비 manifest](lobby/manifest.csv). 위129PNG와 분리한다.
- P1 연출·배너·FX 및 P2 스토어·모바일은 아직 없다. 이번 P0 완료가 전체 단계 완료를 뜻하지 않는다.

[최신 UI 납품 보고](../../docs/art/roblox-v0.5.0/earth-ui-report.md) · [하수인 이력](../../docs/art/roblox-v0.5.0/earth-report.md) · [토큰 이력](../../docs/art/roblox-v0.5.0/earth-token-report.md) · [로비 이력](../../docs/art/roblox-v0.5.0/earth-lobby-report.md) · [Claude 적용 인계](../../docs/roblox/claude-art-apply-handoff.md).

manifest 경로는 저장소 루트 C:\WOOK\pvpserver\client 기준이다.
현행 업로더의 세 manifest 집계는143대상(Image136·Model7)이며, 이번 dry-run은 **신규 Image60 · 기존83 재사용**이다.
이전83개 업로드는 [Mars 적용 보고](../../docs/roblox/art-apply-report.md)의 작업이다. Earth는 이번60개를 업로드하거나 rbxassetid를 발급하지 않았다.
정보 은닉은 이미지뿐 아니라 서버 뷰 정책까지 필요하다. 이전 ID 누출에 대해 Mars가 셔플·뷰 정렬 수정/테스트를 보고했으며 최신 런타임 검증은 구현 QA 범위다.

## 라이선스

이 폴더의 원본·파생 시각 아트는 [ASSET-LICENSE.md](../../ASSET-LICENSE.md)에 따라 **Apache-2.0에서 제외**된다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
신규60개에는 외부 소재·플랫폼 이모지·폰트 글리프를 사용하지 않았다.
