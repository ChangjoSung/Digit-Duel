# Roblox 아트 — P0-A 부분 납품

2026-09-09 · Ref #118. **하수인 60PNG만 납품됐다. 전체 P0 완료가 아니다.**

- [manifest.csv](manifest.csv): 실제 납품 파일 60개. 기존 CSV 6열을 유지하고 Roblox 메타데이터를 추가했다.
- `minions/<element>_<archetype>/icon64.png`: 승인된 native32 아이콘의 최근접2배, RGBA.
- `battle256.png`: 승인된64그리드를 RGBA로 해석한 후 최근접4배, RGBA.
- `portrait512.png`: 기존512PNG를 바이트 그대로 복사.
- 신규 디자인·글자·이모지 추가 없음. 모든 이미지 1024px 이하.
- tint는 모두 no, slice 경계는 모두 빈 값. 토큰·UI·FX 자산은 아직 없다.

[Earth 보고서·검수 이미지](../../docs/art/roblox-v0.5.0/earth-report.md).
manifest 경로는 프로젝트 루트 `C:\WOOK\pvpserver\client` 기준이다.

업로드·rbxassetid 발급·클라이언트 연결은 Mars가 수행한다. Earth는 업로드하지 않았다.

## 라이선스

이 폴더의 원본·파생 시각 아트는 [ASSET-LICENSE.md](../../ASSET-LICENSE.md)에 따라
**Apache-2.0 라이선스에서 제외**된다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
외부 소재나 플랫폼 이모지 글리프를 사용하지 않았다.
