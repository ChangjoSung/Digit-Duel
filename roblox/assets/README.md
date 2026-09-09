# Roblox 아트 — 현재 납품 현황

2026-09-09 · Ref #118. **기본 요청 P0: 하수인60 + 토큰9 = 69/129PNG 납품.** 속성4·흔적1·P0-C10·P0-D45, 총60PNG는 아직 없다.

- [manifest.csv](manifest.csv): 기본 요청의 실제 납품 PNG69개. 기존 CSV 6열을 유지하고 Roblox 메타데이터를 추가했다. 모델 파일을 넣지 않는다.
- `minions/<element>_<archetype>/icon64.png`: 승인된 native32 아이콘의 최근접2배, RGBA.
- `battle256.png`: 승인된64그리드를 RGBA로 해석한 후 최근접4배, RGBA.
- `portrait512.png`: 기존512PNG를 바이트 그대로 복사.
- 기존 하수인60PNG는 디자인 변경 없고 tint=no다. 신규 [토큰9PNG](tokens/README.md)는 native32 흰색 단색+알파, tint=yes다. 기본 요청 PNG69개 모두 slice 경계는 빈 값이다.
- 왕관·협력 문양·폭탄·물리적 덫·공통 가림 토큰을 납품했다. 선택3건은 CJ 승인으로 해소됐다. 글자·이모지 글리프 없고 런타임 이미지 최대1024px다.
- 추가 [공통 가림3D](tokens/model-manifest.csv): 메시1종(FBX/OBJ/MTL). 260tri, 0.44×0.42×0.44stud. 종류별 형태 차이 없이 팀 색만 적용한다.
- 별도 [로비 납품](lobby/README.md): 6메시·6알베도·1상태 표지, 전용 [로비 manifest](lobby/manifest.csv). 위69PNG 집계와 분리한다.
- 기본 요청의 보드·UI·FX·P1/P2는 미납품이다. 로비 상태 표지를 기본 요청 P0-D 완료로 세지 않는다.

[하수인 보고](../../docs/art/roblox-v0.5.0/earth-report.md) · [토큰 보고·검수 이미지](../../docs/art/roblox-v0.5.0/earth-token-report.md) · [로비 보고](../../docs/art/roblox-v0.5.0/earth-lobby-report.md).
manifest 경로는 프로젝트 루트 `C:\WOOK\pvpserver\client` 기준이다.

업로드·rbxassetid 발급·클라이언트 연결은 Mars가 수행한다. Earth는 업로드하지 않았다.
공통 가림 모델만으로 데이터 은닉이 완성되지 않는다. 현재 고정 순번 ID의 종류 추정 가능성은 토큰 보고의 별도 구현 인계 사항이다.

## 라이선스

이 폴더의 원본·파생 시각 아트는 [ASSET-LICENSE.md](../../ASSET-LICENSE.md)에 따라
**Apache-2.0 라이선스에서 제외**된다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
외부 소재나 플랫폼 이모지 글리프를 사용하지 않았다.
