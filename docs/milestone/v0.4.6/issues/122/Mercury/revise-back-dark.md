# #122 · #124 · #126 — CJ QA REVISE: 뒤로가기·어두운 배경

2026-09-10 · Mercury(PD). 현재 상태: 보완 구현·독립 제품 검수 PASS, 세 Issue OPEN·CJ 재검수 전. 정식 v0.4.5·v0.4.7 미출시.

## 요청과 범위

CJ가 첫 납품을 REVISE로 판정하고 좌상단 뒤로가기와 기존 배경처럼 어두운 하단 바탕을 요청했다. [PR160](https://github.com/ChangjoSung/Digit-Duel/pull/160)의 독립 제품 PASS는 이전 납품 이력이며 새 수정의 검수나 CJ 수락으로 재사용하지 않는다.

- 좌상단 뒤로가기: 로비→타이틀, 배치→로스터, 준비 취소→확인 후 로비, 보드의 정보 서랍→닫기. 경기 중에는 기존 기권 확인과 입력 소유자·온라인·모달·연출 잠금을 따른다. 자유로운 전투 이탈이나 행동 되돌리기를 추가하지 않는다.
- 매칭 대기는 기존 대기 취소로 배치를 보존하고, 전투 하위 메뉴는 기존 명령 선택으로 돌아간다. 오프라인 AI 대 AI 관전은 종료 확인 후 로비로 돌아간다. 이 관전 출구는 플레이어 경기의 승패 규칙을 바꾸지 않는 PD 실행 판단이다.
- 화면 바탕·패널·하단 행동 영역·안내창은 기존 남색/어두운 회색 계열로 맞추고 밝은 글자와 강조색의 가독성을 확인한다.
- 수풀 은폐/양측 말 반투명, 왕·동료 자산, 전투 배치, 강한 승패 효과·길이, 게임 규칙·난수·온라인·튜토리얼 표시 정책은 유지한다.

## 소유권과 기준

| 항목 | 값 |
|---|---|
| 출발 dev | `2055d5a9344f1476e87c3fb9dd19104a643bfe50` |
| 출발 HTML blob | `6bd3bed5bcbeda415b7d43591371ab77e5d31045` |
| 브랜치 | `fix/122-back-dark-theme` |
| Run | `run_593b37fa6871` |
| Mars / Claude | `task_7753c02bba5e` / `ctx_eb4e86fbc67d` — HTML·도구·테스트·자기 증빙 |
| Mercury / Codex | Git·Issue·Notion·문서 메타데이터 |
| Saturn / Codex | `task_43c6bf801879` / `ctx_a8c2e0895fd4` — 독립 READ_ONLY 검수, 파일 수정 불가 |

dispatch preflight: Mars / IMPLEMENT / HTML·CLIENT·TOOLING / code·docs / instance_index=null; Saturn / QA / QA / none / instance_index=null. 동일 역할 중복이 없음을 확인했다. Git 쓰기는 PD만 수행하고 보호 루트·Downloads·기존 브라우저 프로필·Roblox 담당 자원은 수정 범위 밖이다.

## 검수 및 통합

Saturn 초기 독립 코드 검수는 PASS다(19:13 KST). 대상 HTML blob `93bbae0e1d6fb2ce29e84eec52c50db45c92d1c8`, Back 검사113/0·기존 UI 계약93/0·코어69/0이며 seeded AI 완주·미공개 정체 치환450+450표본의 판단 차이0을 확인했다. Back 테스트 blob `fafa839832530ebe69e096f3d198ef2e06bebe65`, CI blob `2e701426f2a1daebb88e03bdd75b0aba18c8a5fb`다. 최초 Mars102/0 표본과 구분한다.

제품 확정 커밋은 `21637d1720a67c0400a2025ee8dad585d231ba15`, HTML blob은 `2a2c26da1728935ec024253ef9fad44945e3eabf`다. Saturn은 19:31 KST에 최종 CSS 변경분과 [실제 Chrome 13장](../Mars/revise-back-dark/media)을 독립 확인하고 제품·화면 PASS를 보고했다. 초기 검수 이후 변경은 CSS뿐이며 Back 검사·CI blob은 같다. 별도 stdin 검사9/0으로 새 준비/관전 확인창의 오래된 버튼이 새 게임·모달을 닫지 못하는 것을 확인했고, seeded 5급 AI 관전 일시 보류·취소 후 재개와 보류 없는 경기의 완료 지표도 같았다. 기존 모든 모달 콜백을 전수 감사했다는 뜻은 아니다.

[Chrome 보고](../Mars/revise-back-dark/media/back_dark_report.json)의 최종 결과는69/0·14PNG다. 62/0·13PNG는 중간 표본이다. 실제 화면 폭 검사는390px 로비·보드·전투,360/1280px 로비·보드다. 전투 하위 메뉴의 뒤로가기는 패널 좌상단에서 위/왼쪽15px다. 촬영은 상태를 준비한 fixture에서 실제 클릭으로 수행했으며 물리 기기 전체 플레이가 아니다. 관전 AI 보류는 초기 headless 타이머 검사에 더해 최종 Chrome S1–S7의 확인창·취소/재개·로비 전환 관측과14번째 이미지가 추가됐다.

**측정 정정:** 원 JSON/중간 Mars 보고의 primary11.93은 다른 표면의 수치다. 실제 버튼은5.724:1이다. fallback17.55는 반투명 배경의 alpha를 생략한 계산이므로 사용하지 않는다. Saturn과 PD의 독립 합성 계산(e0=224/255)은 불15.043:1·번개13.657:1이다. 전투 배경 fixture에 누락된 render를 보완해 최종08 이미지가 실제 보드 위에 뜨도록 수정했다. 이는 촬영 상태의 문제였고 제품 결함으로 소급하지 않는다.

튜토리얼은 새 제품 기본 캡처10장이 기존 이미지와 달랐다. 따라서 초기의 “색 토큰이 같으니 10장도 같다”는 추정을 철회했다. 옛 ref·margin0 대조에서도 차이가 관측됐으므로 픽셀 동일이라고 주장하지 않는다. 내용·규칙은 유지하고 [새10장](../Mars/revise-back-dark/tutorial/capture-manifest.json)을 현재 제품에서 납품한다. 기존10장을 보존한 채 README의 이미지20참조와 출처 링크를 새 경로로 전환했다. 새 고정 README SHA256은 `05e8f7c0cb7fdd26419bc61a800f3a20a9127ac46e80e3e0b2251c42cc8510b2`다. 앞선 `67e9599f` 고정본은 이 변경으로 대체됐다.

[README1100×900](../Mars/revise-back-dark/readme-1100/verify-report.json)·[390×844](../Mars/revise-back-dark/readme-390/verify-report-w390.json)의 실제 GitHub Markdown/Chrome 렌더가 모두 문제0이며 같은 새 README SHA256을 기록한다. PD의 중간 전달에서390 파일명 접미사 `-w390`을 빠뜨려 완료 여부를 잘못 전달한 뒤 즉시 정정했고, 정확한 파일을 다시 읽어 확인했다. 최종 독립 미디어 판정·필수 CI6·통합 정보는 아래 결과를 따른다. 물리 기기 실플레이와 CJ 재수락을 자동 검사로 주장하지 않는다.

## 최종 독립 판정

Saturn은 19:40 KST `msg_6cf63c69e6aa`에서 최종 READ_ONLY QA PASS를 보고했다. 최종14PNG를 모두 보고 초기13장과 달라진 것은 추가 관전 확인1장과 갱신한 수풀11번뿐임을 확인했다. 새 튜토리얼10장의 실제 SHA256·바이트·크기와 매니페스트가 일치하고, README20참조와 두 폭의20렌더PNG 해시도 대조했다. PC/모바일 게임·갤러리와 모바일 코드 부분을 직접 확인했으며 전체 페이지 폭390px, 코드 내부 스크롤과44px 갤러리 원본 링크는 기존 작성 방식이다.

CI blob `06186687094733a8eb851055df11c21010d16e50`은 A의 Back 검사와 C의 최종 매니페스트 경로/설명만 변경했다. 보고서 대비·뷰포트 수치를 정정하고 튜토리얼 픽셀 동일 주장을 철회한 것도 확인했다. Saturn은 파일·프로필 생성0, 별도 브라우저 재촬영 없이 제공된 증빙을 독립 대조했다. 제품 검수 PASS와 CJ 재수락을 구분한다.

## 조정 기록

Mars의 FIFO 처리 지연으로 후속 범위 제한 전달이 늦었고 추가 sim 검사·튜토리얼 차이 조사가 진행됐다. PD는 새 분석/테스트 확대를 중단하고 최종 캡처·보고에 집중하도록 반복 전달했으며, 같은 터미널에 interrupt 입력으로 최신 inbox 처리를 요청했다. 새 제품 소스를 옛 이미지에 맞추는 변경은 하지 않았다. 같은 Task를 유지했고 다른 PD/대체 Worker를 병렬로 배치하지 않았다. 새 Task의 결과는 과거 PR160 절차 실패와 구분한다.

## 통합 원본과 다음 게이트

이 기록의 제품·미디어 검수가 끝난 뒤 필수 CI6을 거쳐 dev에 squash한다. 후속 PR의 최종 head·CI 실행·dev SHA·Worker 정산은 [Issue122](https://github.com/ChangjoSung/Digit-Duel/issues/122)에 남기는 REVISE 보완 통합 코멘트가 원본이며, 같은 내용이 GDD13 DL56·GDD21에 연결된다. 파일 안에 기록한 초기 제품 커밋과 최종 통합 커밋을 혼동하지 않는다. 문서172개·내부링크1094건 문제0을 확인했다.

세 Issue는 OPEN으로 두고 **CJ 아트·플레이 재검수**를 기다린다. 전용 작업 브랜치만 정리하며 main·v0.4.5 태그/Release·Roblox 담당 범위는 보존한다. 같은 요청의 신규 출시나 다른 Issue 착수는 없다.

문서 원본: [GDD21](https://app.notion.com/p/3d71e7f1708581f292ede2ab862e63f5) · [GDD13 DL56](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38). 이전 절차 예외·증빙은 [PR160 통합 기록](report.md)에 보존한다.
