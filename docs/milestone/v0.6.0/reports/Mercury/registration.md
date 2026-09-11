# v0.6.0 이슈 등록·준비 검증

2026-09-11 · Mercury(PD). CJ가 요청한 분석·이슈 등록 결과다. Unity 구현·연결·출시 완료 보고가 아니다.

## 등록 결과

[Milestone4](https://github.com/ChangjoSung/Digit-Duel/milestone/4)의 #182 환경, #183 MCP, #184 온라인, #185 데이터, #186 Core, #187 UI를 OPEN으로 등록했다. 담당자는 확정되지 않아 GitHub assignee를 강제 지정하지 않았고 역할 책임은 각 본문에 명시했다. #184는 담당자·서버 계약 확인까지 등록 상태다. 미착수 구현을 닫는 closing keyword는 준비 PR에 사용하지 않는다.

문서 주소는 [v0.6.0 인덱스](../../README.md), `reports/Mercury/`, `issues/<번호>/Mercury/plan.md`다. GDD13 본문9의 버전 관리·개발 인프라와 DL60, Project/Editor/Edit Date/Summary를 함께 갱신했다. 게임 규칙을 새로 승인한 것이 아니다.

## 브랜치·검사

- dev `f6bbc7a6239aefd7045800e724ca4e70f3357a03`에서 `milestone/v0.6.0` 생성; dev와 동일한 CI6·strict·PR 필수·관리자 적용·강제 push/삭제 금지 설정 후 API 재조회.
- 이슈 브랜치 `doc/182-unity-port-plan`에서 분석 문서와 #181의 milestone/** workflow 트리거만 준비한다. Mars_3 변경은 기존 #181 workflow와 대조했고 검사 job은 바꾸지 않았다.
- 이 준비 PR은 #182의 선행 정비다. 실제 프로젝트 생성·설치·연결·게임 포팅은 해당 이슈의 후속 통합 PR과 AC로 검증한다. 이 PR의 CI6은 Unity 빌드 성공의 증거가 아니다.
- 독립 QA·CI·통합의 최종 결과는 준비 PR의 리뷰/검사/병합 기록을 기준으로 한다. 아래 작업 완료는 기술 분석과 workflow 변경 완료를 뜻한다.

## Orca 작업 정산

Run `run_4ef1e8847d4b`.

| 작업 | Task / Dispatch | 결과·증거 |
|---|---|---|
| Mars_1 참조 구조 읽기 | task_c6111402b57b / ctx_77bbf12ae734 | succeeded, 수정0; [구조 판정](reference-architecture.md)에 Mercury 채택/제외를 구분. worker_done 수신 후 archive/release |
| Mars_2 HTML·데이터·UI 읽기 | task_648672dca335 / ctx_1a9d61d89b8b | succeeded, 수정0; [시스템 대응](systems-data-ui.md)에 취합. worker_done 수신 후 archive/release |
| Mars_3 CI 트리거 | task_6c7ab61e01bb / ctx_a7eea2e9d27d | succeeded, ci.yml만 +6/-2; #181 delta 대조, archive/release |

Mars_1/2 초기 mode 표기는 PD가 정정했다. 기술 분석은 mode=IMPLEMENT·mutation=none이며 구현이나 기획 승인 권한을 부여하지 않았다. 원본 보고의 제안은 PD 검토 결과와 다를 수 있으므로 보고를 모두 확정 결정으로 옮기지 않았다.

## 남은 구현 결정

UI Toolkit 최종 선택, 실제 검증 기기/최소 지원·성능 예산, 앱 튜토리얼 노출, Addressables 사용 범위, 서버 담당자·권위·전송/DB 계약, 실제 부족 자산의 제작 규격. 이는 이슈 등록을 막는 항목이 아니라 각 구현 단계의 선결 판단이다. Unity/MCP는 조사·dry-run까지이며 실연결 미검증이다.
