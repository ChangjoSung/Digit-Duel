# v0.6.0 — Unity 포팅
[Milestone 4](https://github.com/ChangjoSung/Digit-Duel/milestone/4) · **2026-09-11 사전 분석·이슈 등록 / Unity 제품 미구현·미출시**

CJ의 네 안건(MCP·환경·HTML 포팅·온라인)을 독립 검증 가능한 여섯 목표로 정리했다. 테이블과 Android UI를 분리해 데이터 오류와 화면 적합성을 각자 검증한다. 서버는 **등록만**이며 담당자를 임의로 지정하지 않았다.

| Issue | 납품 목표 | 선행 조건 | 구현 소관 |
|---|---|---|---|
| [#182](https://github.com/ChangjoSung/Digit-Duel/issues/182) | Unity 6·Android 기본 환경 | 최초 준비 | Mars |
| [#183](https://github.com/ChangjoSung/Digit-Duel/issues/183) | Unity CLI·MCP와 Codex·Claude 연결 | CLI 준비 병행 / Editor 시험은 #182 최소 프로젝트 이후 | Mars |
| [#185](https://github.com/ChangjoSung/Digit-Duel/issues/185) | 정적 TSV·타입 생성·데이터 검증 | #182 / 스키마 분석은 선행 가능 | Mars |
| [#186](https://github.com/ChangjoSung/Digit-Duel/issues/186) | 순수 C# 규칙·AI·로컬 세션 | #182·#185 | Mars |
| [#187](https://github.com/ChangjoSung/Digit-Duel/issues/187) | Android UI Toolkit 검증·화면·자산 | #182 이후 PoC / 전체 통합은 #185·#186 | Mars |
| [#184](https://github.com/ChangjoSung/Digit-Duel/issues/184) | 온라인 매칭 서버·Client 연동 | #185·#186·#187 + 서버 담당/계약 확정 | 서버 담당 미정 / Client Mars |

## 실행 순서
1. #182 최소 Unity 프로젝트와 Android 환경을 준비하며 #183 CLI/설정 점검을 병행한다.
2. 프로젝트 생성 후 #183 실제 Editor 연결을 확인하고, #185 데이터 파이프라인과 #187 UI PoC를 진행한다.
3. #185를 바탕으로 #186 규칙·공정 AI를 포팅하고 #187에서 전체 화면·기존 아트를 통합한다.
4. #184는 서버 담당과 계약이 확정되면 연결한다. 서버 대기로 로컬 PVE/핫시트 개발을 막지 않는다.
5. 독립 QA·CJ APK 플레이 QA 후에만 마일스톤 종료·출시 판단. 온라인 범위를 미루려면 CJ가 마일스톤 범위를 명시적으로 조정한다.

## 기준과 미결정
- 게임은 HTML v0.4.6 기준(v0.4.7은 문서 hotfix). #122 최종 접촉·전투 규칙이 이전 #114/#146 일부를 대체한다.
- 최신 정식 Unity 사용: 조사 버전 6.6 `6000.6.0f1`, 설치 시 재확인·버전 고정. Android APK 목표.
- UI Toolkit 채택, 앱 튜토리얼 노출 시점, 성능/최소 기기, 서버 프로토콜·DB·담당은 미결정이다.
- gRPC·MongoDB·CSV→TSV는 CJ가 제시한 방향이다. 정적 테이블을 플레이어 DB와 혼동하지 않는다.
- 부족 아트는 #187에서 CJ에게 목록·규격을 보고한 뒤 Earth 제작 범위를 정한다.

## 브랜치
트랙 `milestone/v0.6.0`은 dev `f6bbc7a`에서 분기했다. `이슈 브랜치 →(squash) 트랙 →(merge) dev →(merge) main` 정책을 따른다.
트랙은 필수 CI6·strict·PR 필수·관리자 적용·force push/삭제 금지다. 첫 준비 PR에서 #181의 milestone/** workflow 변경을 연결한다. 기존 CI6는 Unity 제품 빌드 검증이 아니다.

## 기록
- [Mercury 전체 분석·공식 출처](reports/Mercury/unity-port-analysis.md)
- [참조 구조 분석](reports/Mercury/reference-architecture.md)
- [시스템·테이블·UI·리소스 분석](reports/Mercury/systems-data-ui.md)
- [등록·검증 원장](reports/Mercury/registration.md)
- [#182 준비 기록](issues/182/Mercury/plan.md)
- [#183 준비 기록](issues/183/Mercury/plan.md)
- [#185 준비 기록](issues/185/Mercury/plan.md)
- [#186 준비 기록](issues/186/Mercury/plan.md)
- [#187 준비 기록](issues/187/Mercury/plan.md)
- [#184 준비 기록](issues/184/Mercury/plan.md)

분석 제안은 reports에 두며 승인 전 specs로 올리지 않는다. Worker 인스턴스 접미사는 폴더명이 아니라 보고서의 작성자·Task에 기록한다.
