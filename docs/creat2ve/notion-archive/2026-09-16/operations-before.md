# 운영 문서 정리 전 발췌

## 기획 문서 허브
Here is the result of "fetch" for the Page with URL https://app.notion.com/p/3c91e7f17085802499f1f5ccae7c8f50 as of 2026-09-15T02:17:47.065Z:
<page url="https://app.notion.com/p/3c91e7f17085802499f1f5ccae7c8f50" icon="📝">
<ancestor-path>
<parent-data-source url="collection://0461e7f1-7085-8326-96d2-0763ea7a5469" name="프로젝트 진행 과정"/>
<ancestor-2-database url="https://app.notion.com/p/39e1e7f170858038a903fc5f9f1dbc9e" title="프로젝트 진행 과정"/>
<ancestor-3-page url="https://app.notion.com/p/39f1e7f170858059bf29d83945fe66f4" title=""/>
<ancestor-4-page url="https://app.notion.com/p/8a41e7f170858229aa2581a550a1d951" title=""/>
<ancestor-5-page url="https://app.notion.com/p/eb11e7f170858325803f016db2a96ab8" title="CJ"/>
</ancestor-path>
<properties>
{"Editor":["<mention-user url=\"user://8e0a8270-d0e3-407e-a7d2-b3f992f1e366\"></mention-user>"],"Project":["https://app.notion.com/p/3ae1e7f1708580f7bb88c7ee4f511aa0"],"Status":"Doc","Summary":"프로젝트별 표준 기획서, 검토 흐름, 공용 원본을 관리하는 허브 템플릿입니다.","Title":"\\[Digit Duel\\] 기획 문서 허브","date:Edit Date:is_datetime":0,"date:Edit Date:start":"2026-08-27","url":"https://app.notion.com/p/3c91e7f17085802499f1f5ccae7c8f50"}
</properties>
<iconMetadata>{"type":"emoji","emoji":"📝"}</iconMetadata>
<content>
<callout icon="🎮" color="blue_bg">
	**프로젝트 기획 문서 허브**
	프로젝트 기획서를 **초안 → 검토 요청 → 승인** 흐름으로 관리합니다.
	운영 기준 데이터베이스: [Game Design Docs](https://app.notion.com/p/470445c36855472b9060cf597c2cb241)
</callout>
<callout icon="⚙️" color="yellow_bg">
	**생성 후 최초 1회 설정**
	1. 제목의 `[프로젝트 이름]`을 실제 프로젝트명으로 바꿉니다.
	2. 이 페이지의 Project 관계가 현재 프로젝트인지 확인합니다. 프로젝트 내부의 필터된 보기에서 만들면 자동 입력됩니다.
	3. 아래 **초안·검토 요청·승인** 보기 각각의 `Project 비어 있음` 필터를 현재 Project로 바꿉니다.
	다른 프로젝트 문서가 노출되지 않도록 초기 상태에서는 문서가 보이지 않게 설정했습니다.
</callout>
# 빠른 시작
1. **공용 기획서 템플릿**에서 필요한 문서를 복제합니다.
2. 복제한 문서에서 `템플릿 원본`을 해제하고 Project, 문서명, 문서 유형, Owner, Version, 요약을 입력합니다.
3. 초안 작성 후 Reviewer와 검토 예정일을 지정하고 **검토 요청**으로 변경합니다.
4. 승인 문서는 구현·QA의 기준으로 사용하고 관련 작업을 Relation으로 연결합니다.
---
# Game Design Docs
## 1. ⚪ 초안
작성 중인 프로젝트 문서입니다.
<database url="https://app.notion.com/p/3c91e7f1708580a4895ef90b094d1087" inline="true" data-source-url="collection://cb30f124-3ae2-409c-a4c9-ed4c6fe9163a"></database>
<empty-block/>
---
## 2. 🟡 검토 요청
Reviewer의 확인을 기다리는 문서입니다.
<database url="https://app.notion.com/p/3c91e7f1708580a8bb1aed45c70d9131" inline="true" data-source-url="collection://cb30f124-3ae2-409c-a4c9-ed4c6fe9163a"></database>
<empty-block/>
---
## 3. 🟢 승인
구현과 QA의 기준으로 사용하는 확정 문서입니다.
<database url="https://app.notion.com/p/3c91e7f17085804b923bfb27be18ce1d" inline="true" data-source-url="collection://cb30f124-3ae2-409c-a4c9-ed4c6fe9163a"></database>
<empty-block/>
---
# 공용 기획서 템플릿
필요한 유형을 복제한 뒤 `템플릿 원본`을 해제하고 현재 Project를 지정하세요.
<database url="https://app.notion.com/p/3c91e7f170858088b092d96232f1083a" inline="true" data-source-url="collection://cb30f124-3ae2-409c-a4c9-ed4c6fe9163a"></database>
<empty-block/>
---
# 문서 승인 기준
- [ ] 한 문장 요약과 목적이 작성되어 있다.
- [ ] 목표와 비목표가 구분되어 있다.
- [ ] 규칙, 입력, 출력, 예외 조건이 정의되어 있다.
- [ ] UI·데이터·리소스 의존성이 연결되어 있다.
- [ ] Acceptance Criteria가 검증 가능하다.
- [ ] Reviewer와 Version이 지정되어 있다.
# 제목 규칙
- Game Overview: `Game Overview — 프로젝트명`
- System: `[SYS] 시스템명 — 기능명`
- Content: `[CONTENT] 콘텐츠명 — 세부 항목`
- UI·UX: `[UI] 화면명 — 사용자 흐름`
- Data·Economy: `[DATA] 테이블/재화명 — 목적`
- Decision: `[DEC] 결정 주제 — YYYY-MM-DD`
<empty-block/>
</content>
</page>

## 혼합 인수인계 스냅샷
Here is the result of "fetch" for the Page with URL https://app.notion.com/p/3ce1e7f170858115b24efc353bdc845c as of 2026-09-02T10:17:16.585Z:
<page url="https://app.notion.com/p/3ce1e7f170858115b24efc353bdc845c" icon="📦">
<ancestor-path>
<parent-data-source url="collection://0461e7f1-7085-8326-96d2-0763ea7a5469" name="프로젝트 진행 과정"/>
<ancestor-2-database url="https://app.notion.com/p/39e1e7f170858038a903fc5f9f1dbc9e" title="프로젝트 진행 과정"/>
<ancestor-3-page url="https://app.notion.com/p/39f1e7f170858059bf29d83945fe66f4" title=""/>
<ancestor-4-page url="https://app.notion.com/p/8a41e7f170858229aa2581a550a1d951" title=""/>
<ancestor-5-page url="https://app.notion.com/p/eb11e7f170858325803f016db2a96ab8" title="CJ"/>
</ancestor-path>
<properties>
{"Editor":["<mention-user url=\"user://8e0a8270-d0e3-407e-a7d2-b3f992f1e366\"></mention-user>"],"Project":["https://app.notion.com/p/3ae1e7f1708580f7bb88c7ee4f511aa0"],"Status":"환경 설정","Summary":"PD 온보딩·세션 인수인계용 프로젝트 현재 상태 스냅샷 — Digit-Duel QA 사이클 5 commits 4c3df3a/2e68beb, Creat2ve Structure v0.2.1/rev5 오프라인 편집판 및 참조 사이트 비연동 경계 기준.","Title":"Mercury 인수인계 스냅샷","date:Edit Date:is_datetime":0,"date:Edit Date:start":"2026-09-02","url":"https://app.notion.com/p/3ce1e7f170858115b24efc353bdc845c"}
</properties>
<iconMetadata>{"type":"emoji","emoji":"📦"}</iconMetadata>
<content>
<callout icon="📦" color="yellow_bg">
	**인수인계 스냅샷 — 기준일 2026-09-02.** QA 사이클 5와 Creat2ve Structure v0.2.1 / rev 5 집행 완료 기준본입니다. 이 문서는 누적하지 않고 프로젝트 현재 상태로 치환합니다.
</callout>
# Mercury 운영 상태
- **CJ 창구:** 이 터미널의 Mercury(PD/Codex)가 CJ Comment를 직접 수신하는 유일 창구. 기존 감사역 Claude 세션은 종료.
- **Workflow:** 복합 안건 10단계, 범위·정답이 명확한 단일 변경은 패스트트랙.
- **Worker 품질:** 구현=Claude, QA=Codex fresh Worker. 완료 후 archive/release가 기본이며 상설 창구와 내부 PD 세션을 분리.
- **현재 Worker:** 활성 supervised Worker 0. 이번 Run의 소유 Worker는 모두 release. 초기 Venus 터미널 1개는 user-owned/external로 유지되지만 감독 작업에는 사용하지 않음.
# Digit-Duel 현재 상태
- **브랜치:** dev_html, origin push 완료.
- **커밋:** 4e3e159 세션 lease·Mercury 교대 운영 계약 / 106eb3c QA 사이클 4 / **4c3df3a QA 사이클 5 지표·AI 난이도·포획 경계** / **2e68beb 현 프로젝트 Notion 수명주기 rev5 동기화**.
- **Issue:** QA 사이클 4 상위 [#16](https://github.com/ChangjoSung/Digit-Duel/issues/16)은 CJ 플레이 피드백 접수 후 종료. [#20](https://github.com/ChangjoSung/Digit-Duel/issues/20)·[#21](https://github.com/ChangjoSung/Digit-Duel/issues/21) 구현·Saturn QA 후 종료. 상위 [#19](https://github.com/ChangjoSung/Digit-Duel/issues/19)은 **CJ 플레이 QA 대기**로 OPEN.
- **QA 사이클 5 확정:** 플레이어별 지표+합산·선공/승자·포획 시도/실패·폭탄 이동·함정 발동; 왕 숲 체류/전투 회피 정합 수정; PVE 5급(기준선)·5단(공정 관측 제한 탐색); 전투 중 적 포획 예비 HP 70/100, 숲 중립 포획 100/100; 탐색은 하수인·동료·왕만 실행.
- **검증:** Mars 회귀 69/69. Saturn 독립 QA PASS — 두 50판 범위 각 37:13, 추가 100판 포함 총 5단 132승·5급 67승·1무, 선후공 97/102, 불변식 위반 0. Mercury 추가 40판 27:13, 판단 최대 5ms.
- **잔여 위험:** 5단 강도는 시드 범위에 따라 변동. 120ms 판단 상한에 걸리는 저사양 환경에서는 동일 시드 결정이 달라질 수 있음. 브라우저 확장 UX 자동 검증은 미연결로 생략했고 headless·정적·PVP 턴 검증으로 대체.
- **문서:** GDD-13 v0.9 본문·Acceptance Criteria·결정 대장·Decision Log 동기화 완료.
# Creat2ve Structure v0.2.1 / rev 5
- **비공개 원본:** [ChangjoSung/creat2ve-structure](https://github.com/ChangjoSung/creat2ve-structure), main 커밋 **d38002f**.
- **릴리스:** [v0.2.1 — Offline Editable Handbook](https://github.com/ChangjoSung/creat2ve-structure/releases/tag/v0.2.1). Issue #3·v0.2.1 마일스톤 종료.
- **Notion 계약:** 새 문서·갱신 시 Project=현재 프로젝트, Edit Date=실제 수정일, Editor=실제 Notion 사람 편집자. Agent 표기는 Summary/본문 운영 이력에만. Archive는 홀딩이며, 삭제는 현재 프로젝트·대체/중복·연결 부재를 모두 확인한 때에만; 다른 프로젝트·연결 문서 자동 삭제 금지.
- **참조 사이트 경계:** UI·편집 운영 방식 참고 전용이다. Creat2ve Structure를 업로드·연동·수정하지 않으며 별도 로컬 HTML만 독립 편집·열람 채널로 사용한다.
- **산출물:** ELI-adult self-contained HTML 2종 — 읽기 전용 `Creat2veVibeCodingStructure.html`과 별도 편집판 `Creat2veVibeCodingStructure.editable.html`. 편집판은 명시적 편집 모드, 브라우저 로컬 저장·재열기 복원, 독립 HTML 내보내기·재편집, 원본 복원을 제공한다. 승인형 bootstrap은 읽기 전용판만 배포하며 편집판을 대상 프로젝트에 자동 적용하지 않는다. v0.2.0 이전 파일은 `Creat2veVibeCodingStructure.pre-v0.2.0.html`로 보관.
- **검증:** build/verify PASS, 자동화 **69/69 PASS**, Claude 구현 ↔ Saturn(Codex) 독립 릴리스 게이트 PASS. 실제 Chrome에서 공격 페이로드의 문서 외 HTTP 요청 0, 320px 가로 overflow 0, 활성 터치 목표 44px 이상을 확인했다.
- **무결성:** 저장소 dist·GitHub Release·Downloads/html 일치. 읽기 전용판 SHA-256 **357ec8ac621b5784077524c7fe5b1630d22d7cd145a4e35e4ae9b9074fb1548a**, 편집판 SHA-256 **866b435e0b2062c6d7301e073902e5a37c292aff20e28656713eae648066fd61**.
- **보안:** 편집 본문은 요소·속성·값 형식 allowlist로 정화하고 SVG image/use href·CSS 외부 참조·이벤트 핸들러·원격/임시/로컬 주소를 제거한다. dist 검증은 raw-byte SHA-256·바이트 수·SHA256SUMS 파일 집합·미등록 파일·fresh build 일치를 강제한다. bootstrap의 사람 승인 토큰·drift·경로 escape·realpath·symlink/junction/reparse 차단은 유지한다.
# 권위 링크
- [Creat2ve Vibe Coding Structure](https://app.notion.com/p/3ce1e7f17085818c82c5dd886149ad5b)
- [Digit-Duel 저장소](https://github.com/ChangjoSung/Digit-Duel)
- [Creat2ve Structure 저장소](https://github.com/ChangjoSung/creat2ve-structure)
- [CJ 세션 사용 가이드](https://app.notion.com/p/3cd1e7f17085810e9514e5773757bbe3)
# 다음 결정·행동
1. **CJ:** Digit-Duel [#19](https://github.com/ChangjoSung/Digit-Duel/issues/19) 플레이 QA — 5급 체감 유지, 5단의 폭탄·왕 러시·텔레포트 활용, 적 포획 예비 HP 70/100, 상세 지표, 폭탄·함정 탐색 불가 확인 후 승인/수정 의견.
2. **Mercury:** CJ 승인 시 #19를 정리하고 v0.3.0 마일스톤 상태를 갱신. 다음 구조 수정은 source/structure.json·핸드북 source 변경 → build/verify/test → Saturn QA → version/revision 판정 → GitHub Release·Downloads/html의 별도 읽기 전용판·편집판 갱신 → Notion 스냅샷 치환.
3. **호스팅 경계:** 참조 사이트에는 영향·연동·업로드·수정하지 않는다. Creat2ve Structure는 Downloads/html의 self-contained HTML로 서버 없이 열고 수정하며, 외부 공유가 필요할 때만 별도 배포 채널을 설계한다.
</content>
</page>
