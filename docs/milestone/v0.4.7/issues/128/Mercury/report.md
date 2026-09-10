# #128 매 페이지 로드 튜토리얼 — Mercury 통합 기록

- 작성: 2026-09-10 Mercury(PD, Codex/GPT-6 Astra/high).
- 상태: 제품·Chrome 증빙·최종 README 렌더의 Saturn 독립 검수 PASS. [Issue128](https://github.com/ChangjoSung/Digit-Duel/issues/128)과 [PR157](https://github.com/ChangjoSung/Digit-Duel/pull/157)의 마지막 head 검사·dev 병합 기록을 최종 통합 원본으로 사용한다. 새 CJ Play QA 전까지 OPEN. 정식 v0.4.5, v0.4.7 미출시.
- 출발: `fix/128-tutorial-every-load`, `origin/dev bdce124e73fe82534dd1757deef70976e12a7ef5`(Roblox PR153), HTML blob `2a9b54c769a58fc5c0db9e913ce4421bec6758e3`.
- 승인: [CJ 승인 기록](https://github.com/ChangjoSung/Digit-Duel/issues/128#issuecomment-5613625598), [GDD13](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38) 본문4.13·DL47, [GDD18](https://app.notion.com/p/3d61e7f17085809ea410fe6a1431f06c).

## 동작과 변경 이유

CJ는 같은 LAN 주소에서 튜토리얼을 본 뒤 서버를 재시작하고 재접속하면 자동 팝업이 생략된다고 구체화했다. 기존 `tutClose`는 완료·건너뛰기 모두 `localStorage.tutorialSeen=1`을 저장하고 최초 로드에서 `tutSeen`을 확인하므로 이 설명과 일치한다. LAN 실행기는 브라우저 저장을 초기화하지 않는다. 이는 주소 전체가 다른 PC와 하나의 시청 이력을 공유한다는 증거가 아니다. [과거 #128 관측·실행 순서·한계](../../146/Mercury/report.md)는 그대로 보존한다.

계정 없이도 브라우저별 최초1회는 가능하다. 이번 변경은 QA용 데모에서 접속 시마다 안내를 동일하게 제공하려는 노출 정책 개정이다. CJ가 분석 보고 뒤 ‘권고 방향으로 진행’을 승인했다.

| 상황 | 승인 동작 |
|---|---|
| URL 새접속·새탭·새로고침·브라우저 재실행 후 새문서 | 기존 열람값과 무관하게 1단계 자동 표시 |
| LAN 서버 재시작 후 같은 주소 새접속 | 다시 표시 |
| 같은 페이지의 새게임·재대전·모드변경·온라인 연결 복구 | 자동 재표시 없음 |
| 탭 복귀·보존된 페이지 복원 | 추가 자동 표시 없음 |
| 완료·건너뛰기·Esc | 즉시 닫기, 같은 로드 자동 반복 없음 |
| 수동 다시 보기 | 언제든 1단계부터 표시 |

10단계 내용·접근성·다른 저장값·게임/온라인 상태를 보존한다. 계정·LAN 실행기 변경이나 저장 전체 삭제는 범위가 아니다.

## 역할·자원 경계

- Run `run_3b8c920c6131`. Mars(Claude) `task_ff8b87eb8f34`/`ctx_ffcfa8ab83d6`: 제품·회귀·브라우저 증빙. Venus(Claude) `task_8d03d4efca48`/`ctx_e0d7f71a5341`: 사용자 문서. 문서의 현재 PR 출처 정정·플레이어 안내 간결화는 같은 터미널의 즉시 후속 `task_dbd44df80209`/`ctx_1c8665490b67`로 배정했다. Saturn(Codex) `task_a63dbc8e8054`/`ctx_6cebb4f9fb68`은 전파일 쓰기0으로 제품을 독립 검수하며, 진행 중인 증빙은 최종 해시·내용을 다시 대조한다. Mercury는 조정·Git·문서 메타데이터만 집행한다.
- #130·#131·#146은 2026-09-10 CJ QA PASS로 CLOSED다. 기존 전투 규칙과 Roblox PR153·담당자 자산은 변경하지 않는다.
- 보호 root art/·orca-hook-latency-report.md의 내용/직접 메타데이터·Downloads·승인 아트·기존 QA/미디어·다른 주체 자원은 작업 대상이 아니다. 일반 git status의 이름 표시는 허용한다.
- 과거 #146 후속 Task의 임시폴더24개 wildcard 삭제 위반을 보존하며 재발 방지로 이번 실행이 직접 만든 정확한 절대경로/PID만 소유권 목록으로 관리하도록 명시했다. 과거 Temp 접두사 열거·일괄 정리·다른 브라우저/서버 종료는 금지했다.

## 검증·통합

- 제품 커밋 `17cdae8c5cabe77c791bc61349cbebb0ecd659cd`, [통합 PR157](https://github.com/ChangjoSung/Digit-Duel/pull/157). 원격 Roblox PR154/155의 dev `817f79ded44102f21227501a2f00664ae66fdaab`를 먼저 반영했으며 incoming은 `roblox/`·`docs/roblox/`뿐이고 HTML 기준 blob은 불변이었다. PR157 최종 head의 CI·병합 기록이 최종 통합 원본이다.
- 최종 문서 커밋 전 Roblox PR156의 dev `e9a4c24821197db568dc6b897471ca5388230711`도 병합했다. incoming은 `docs/roblox/`의 Earth 요청서2개뿐으로 충돌·제품 변경이 없었으며 해당 담당자 문서 내용은 유지했다.
- 제품 HTML blob `8027cd72d8445c9a7077d0e43b1c5559645ee165`, 작업 파일 SHA256 `d253453f121fa151390dcb82ef098f440cf7556d13c4fdec40f5134aaad6686a`. 변경은 튜토리얼 영구 저장 의존 제거와 문서 로드별 표시 상태다. 기존10단계 내용은 런타임·LF 정규화 소스 대조로 동일하다.
- Saturn 독립 제품 검사: 튜토리얼135/0·관련 회귀208/0·메모122/0, 별도 메모리 검사61/0. 이전 제품은 저장값 존재·같은 프로필 새 로드의 새 기대를 충족하지 못하고 변경 후 제품은 통과했다. 튜토리얼 저장 읽기/쓰기0, S/NET/난수·접근성 유지, 과거 고정 ref 하네스 호환을 확인했다. 파일 쓰기0 계약 때문에 임시 변이 파일을 만드는 smoke_online은 실행하지 않고 읽기 검수했다.
- [Chrome 증빙](../Mars/artifacts/i128-browser-report.json): 26/0, 저장값 있음/없음 두 독립 프로필·실제 새로고침·새탭·건너뛰기·수동재보기·단계이동·Esc, 같은 포트62868의 검증 HTTP 서버 재시작 후 새접속을 확인했다. Saturn이 최종 도구·JSON·대표 이미지3장을 독립 대조해 PASS했다. 모드 전환은 Runtime.evaluate(startMode)로 호출했고 마우스 클릭 검증으로 확대하지 않는다.
- 실제 동일 프로필 브라우저 재시작·실제 WS 재연결·탭복귀/BFCache·저장 getter 거부·물리2PC/LAN 실행기 재시작은 이 CDP의 측정 범위가 아니다. 코드/헤드리스 근거와 실제 브라우저 측정을 구분한다. 과거 타 PC 공유 신고를 재현/해결했다고 소급하지 않는다.
- 최종 README SHA256 `94e09470dd10b0b722daf44fe0a2a0b58eb8e218e17fe0060b1cea6f2dbad446`가 [1100px](../Mars/artifacts/readme-final/verify-report.json)·[390px](../Mars/artifacts/readme-final/verify-report-w390.json) 보고의 대상 해시와 일치한다. 두 결과는 문제0, 참조71건·로컬 이미지13/13·갤러리10/10 로드다. Saturn이 대표 화면3장과 JSON/해시를 독립 대조해 PASS했다. 근사 GitHub CSS·외부 링크 미검증·모바일 코드 블록 내부 넘침 관측은 남으며 페이지 폭 넘침은 없다. 미디어 도구의 `tutorial` 정적 항목은 과거 `docs/media` 고정 경로 검사이므로 현행 #146 촬영본의 새로운 바이트 증명으로 취급하지 않는다.
- [Saturn 최종 원문](../Saturn/report.md)에 제품·브라우저·렌더 PASS, 해시, 음성 대조 및 한계를 보관했다. 제품 커밋 `17cdae8`의 [CI5개](https://github.com/ChangjoSung/Digit-Duel/actions/runs/34442463434)는 PASS이며 문서·증빙 후속 커밋도 PR157의 마지막 head에서 필수 검사를 확인해야 한다. 이전 #146 PASS를 새 #128 정책의 검증으로 재사용하지 않는다.
- 최종 문서 스테이징 후 링크 검사: 문서152개·내부 링크843건, 문제0. 제품·README 해시는 검수 대상과 같으며 나머지 후속 변경은 문서·증빙·Git 통합 메타데이터다.

### 작업 정산과 후속 기록

Mars 원 Task는 14:47 제품·회귀·Chrome 완료를 보고하면서 README freeze를 기다린다고 기재했다. PD는 이미 14:40:40·14:43:34에 최종 README를 전달했으므로 이 대기 표기는 부정확했다. 마지막 inbox 확인이 메시지 본문 대신 `total 6`만 출력한 것도 관측했다. 원 Task의 제품 결과를 수락하되 전체 납품 완료로 확대하지 않았고, 같은 터미널의 즉시 후속 `task_e46ca5e09d1a`/`ctx_9eba4ee655f0`에 누락된 최종 렌더·보고 정정을 명시 배정했다. 신규 CJ 승인이 필요한 상황은 아니었다. 후속 Task는 두 렌더·정확 자원 정리·원 보고 정정을 완료했고 Saturn도 최종 렌더를 PASS했다.

원 Task가 추가로 실행한 과거 `issue146_cdp.js`는 저장 지속성의 옛 기대3건만 실패(78/3)했으며 보존용 도구라 수정하지 않는다. 그 실행은 출력 필터로 RESOURCE/CLEANUP 행을 잃어 개별 생성 경로·PID와 정리를 대조하지 못했다. 따라서 새128 Chrome·README 렌더의 확인된 정리를 이 실행까지 확대하지 않는다. 이를 찾기 위한 Temp 접두사 열거·추가 정리는 하지 않았다. 세부 한계는 Mars 보고5.3에 남겼다.

Venus 문서·즉시 후속, Mars 제품·렌더 후속, Saturn 독립 QA는 모두 결과를 수락했고 각 터미널의 최종 소유 Dispatch에서 archive/release했다. 이전 Dispatch의 자원은 같은 터미널 후속 소유자로 이전됐으므로 중복 종료하지 않았다. 사용자/과거 소유권 불명 자원은 보존했다.

## 추가 CJ 지시 — Notion 두 문서 이관

2026-09-10 요청한 Game Design Docs 보기는 같은 GDD 데이터 원본의 승인 문서 필터다. 기존 페이지를 복사하지 않고 이동했으며 URL/ID를 유지했다. [README·릴리스 노트 작성 규격 #105](https://app.notion.com/p/3d51e7f1708580f18f2dc4a643721059)는 GDD-19(Technical), [턴 행동·접촉·전투 흐름 #106·#114](https://app.notion.com/p/3d51e7f1708580b0916ded4bd3d9d06e)는 GDD-20(System)으로 등록됐다. Project·문서 상태·버전·사람 Editor·수정일·상위 기획서를 맞추고 #121 문서와 같은 상단 요약/이슈·표·승인 계약·검수 이력 구조로 정리했다.

재조회에서 대상 데이터 원본과 승인 목록 필터 일치를 확인했다. README 원문과 이미지4개, System 이미지5개와 토글 제목 끝 공백1개 정규화 외 원문을 보존했다. 기존 Status/Summary도 보존했으며 System 외부 편집 Summary `v0.4.4 1차 완료 / v0.4.5 2차 완료`는 그대로다. 현재 승인 규칙과 과거 요청을 구분했고 신규 제품 범위를 추가하지 않았다. GDD13 DL48에 이관 근거를 기록했다.

## 문서 반영 위치

| 기록 | 위치 |
|---|---|
| 승인 규칙·AC | Issue128, GDD13 본문4.13·DL47, GDD18 |
| 사용자 안내·일정 | README, v0.4.7 릴리스 노트·마일스톤 |
| 구현·독립 QA·화면 근거 | [Mars 보고](../Mars/report.md), [Saturn 원문](../Saturn/report.md), Mars/artifacts |
| 추가 문서 이관 | GDD19·GDD20, GDD13 DL48 |
| 과거 제품·절차 예외 | [#146 PD 기록](../../146/Mercury/report.md) |
| 현재 조정·인수인계 | 이 보고, [HANDOVER](../../../../../creat2ve/HANDOVER_SNAPSHOT.md) |
