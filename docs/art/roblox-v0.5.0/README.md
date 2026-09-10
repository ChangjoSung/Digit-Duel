# [결정] Roblox 아트 인계 — 기본 P0 완료

2026-09-10 · Ref #118 · **기본 P0 129/129 + 별도 Phase3 AI 창·봇 납품.** 이 폴더의 v0.5.0은 기존 경로명이며 Roblox #118의 현재 마일스톤은 v0.4.6이다.

- [최신 AI 창·봇 납품 보고](earth-ai-window-report.md): UI6PNG·알베도1PNG·앉은 로봇1종(FBX/OBJ/MTL), [Mars 적용 계약](../../../roblox/assets/ai-window-README.md).
- [AI 창 미리보기](review/ai-window/window-composition.png) · [로봇 착석 미리보기](review/ai-window/bot-chair-fit.png).

- [기본 UI·속성·흔적·보드 납품 보고](earth-ui-report.md): 앞선60PNG 납품 이력과 독립 QA.
- [기존 Claude 적용 인계](../../roblox/claude-art-apply-handoff.md): 기본 P0 연결 당시 문서. 최신 AI 창·봇은 위 전용 계약을 따른다.
- [UI 적용 계약·60개 키 전수표](../../../roblox/assets/ui/README.md): 틴트7개, SliceCenter26개, 작은 셀의 SliceScale 주의점.
- [하수인 납품 보고·전체 진행표](earth-report.md): 최초 P0-A60PNG 제작 이력과 최신 전체 수량.
- [토큰·공통 가림 모델 보고](earth-token-report.md): 승인 선택3건과 토큰9PNG·가림3D1종.
- [로비 납품 보고](earth-lobby-report.md): 별도6메시·6알베도·1상태 표지.
- [PNG manifest](../../../roblox/assets/manifest.csv): 기본 P0 129개 + AI UI6개 =135개. [가림 모델 manifest](../../../roblox/assets/tokens/model-manifest.csv)와 [로비 manifest](../../../roblox/assets/lobby/manifest.csv)(봇 포함15행)는 별도.
- [하수인 원본 보존 기준](source-baseline.json): 최초 하수인 작업 전100개 이미지와 README의 SHA-256.
- [신규 원고60개](ui-source/native-assets.json) · [Blender 보조 원본](ui-source/p0-ui.blend) · [52개 슬라이스 검토 좌표](ui-source/slice-review-cases.json).

## 검토 이미지

- [보드·UI 조합](review/p0-board-ui-composition.png) · [아이콘30종](review/p0-icons-contact.png) · [32px 세 배경](review/p0-icons32-backgrounds.png).
- [왕·동료·폭탄·덫·가림·속성4의 기호9종](review/p0-symbols9-proof.png) · [타일 반복](review/p0-board-tiles-2x2.png) · [버튼12상태](review/p0-buttons-states.png).
- [보드·패널 슬라이스](review/p0-9slice-board-panels.png) · [버튼 슬라이스](review/p0-9slice-buttons.png) · [배지·바 슬라이스](review/p0-9slice-meters.png).
- 기존 하수인: [32px 세 배경](review/minions-icons32-three-backgrounds.png) · [흑백 실루엣](review/minions-icons32-silhouette.png).
- 기존 토큰: [팀 틴트](review/tokens-tint-preview.png) · [32px 세 배경](review/tokens-32-three-backgrounds.png) · [흑백 실루엣](review/tokens-silhouette.png).
- 기존 가림 모델: [3D 팀 색](review/unknown-model-tints.png) · [0.6셀 보드 적합성](review/unknown-board-fit.png) · [편집 원본](token-source/token-set.blend).

조합 그림은 아트 배치 검토용이며 실제 게임 화면·규칙·승인된 모바일 레이아웃의 증빙이 아니다.
48px 계열은 native24여서32px 시트가 비정수 최근접 축소 스트레스 테스트다. 정수 표시는24/48/72px를 사용한다.
P1 연출·배너와 P2 스토어·모바일은 미납품이다. 정적 아트 QA와 Studio/실플레이 QA는 구분한다.

이 폴더의 원본·파생 시각 아트는 [ASSET-LICENSE.md](../../../ASSET-LICENSE.md)에 따라 Apache-2.0에서 제외된다.
Copyright 2026 Sung Changjo and the respective contributors. All rights reserved.
