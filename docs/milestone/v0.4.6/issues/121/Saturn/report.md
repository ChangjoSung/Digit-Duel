# #121 · #125 · #129 Saturn 독립 QA

2026-09-09 · 판정 **PASS** · READ_ONLY_QA / Codex / instance_index=null / files_modified=[].

이 파일은 Mercury가 Saturn의 메시지 원문 1/2·2/2·worker_done을 취합해 저장했다. 제품 검수와 CJ 플레이 QA·출시 승인은 별개다.

PD 메타데이터 정정: 보고의 비차단 P3(스크린샷 7→8)는 실제 파일 8개와 대조해 수정했다. 일반 `git status --short --branch`는 CJ가 직접 요청한 대조 명령이다. 그 출력에 보호 경로 이름이 나온 사실을 아래 원문에 보존하되, 이를 보호 파일 내용 열람·순회 또는 수정과 동일한 위반으로 판정하지 않는다. 보호 파일 내용 열람·수정·스테이징의 근거는 없다.

## Saturn 원문 1/2 — msg_2c0a9a11f45e

Saturn 독립 QA 최종 보고 1/2 — PASS (개발판 #121·#125·#129, CJ 플레이 QA·출시 승인이 아님)
검사 HEAD c6b016277f3a8985c844c26f6b2bdb6ca2c24c89; base origin/dev 68cd825b7928b8296c3bb6c28ec48dc179488b35; 제품 검증 ref157026ba617166644ada0686b897d3ae2a166486와 최종 HTML 동일; Git blob4535791bbefd86ad829cdd436d4957f8a530846b; LF SHA25684ebbff4a33fcb910e01f7f09ad5a0aa2a91ef8486dbeeef7d064757e5748a20; Windows 원문 SHA256b5c80b07c8baa94635a3a52454ec8170229a345cb8ae57e6cbc124a5984fcc94.
CLAUDE.md 전체·CJ 승인 Venus gameplay-spec 전체·최종 Mars report284행을 읽고 실제 diff/source/assertions와 대조했으며 구현자의 PASS를 QA 판정으로 재사용하지 않았다.

독립 재현으로 발견·수정 확인한 6건:
P1 사신 실제 CD2 및 상대 차례의 오래된 act closure로 즉사: freshPlay/startRounds, R6·자기HP열세·사신장착·CD2에서 netAction act, 또는 자기차례 __actCore 저장 후 phase상대변경 호출; 최종에서는 즉사 차단/오래된 행동 무효.
P1 기본 공격의 미공개 사신 이름 누출: slot0=reaper,CD[0,2,2,2],R1,4슬롯불가에서 정상 basic 버튼; 최종 공유 blog/log·revealedSkills에 사신 없음, 기본 피해 진행.
P1 상대 자원 누출: NET.me=상대 관찰자에서 ball47 및 PVE AI차례 gift7/buff8/아이템 보유; 최종 DOM에 재고·아이템 이름 없음, 자기 차례 대조는 표시.
P2 기권·gameOver에서 battle/버프 상태 잔존: 버프 적용 후 resign; 최종 양측 effect reset/battle=null, 미사용 패키지는 보존.
P2 사망·중복 recruit 대상의 문구만 불가: 신규기술 선택 후 해당 대상 버튼; 최종 실제 disabled/handler없음·선택 mutation없음.
P2 원격 resign 후 전투창/CSS 잔존: 실제 버프 선택→NET 관찰자→applyAction resign; 최종 overlay hidden/마크업·FX큐·잠금 제거, 옛 callback0; 정상 왕 패배 결과는2499ms잠금/2500ms종료 유지.
검사 사각지대 E2f(grass 조합 없는 회복0), E3e(함수 참조만), I2(stall break 후 pass)도 보강한 assertion을 직접 읽어 확인했다.

계약 대조 범위: 숲별3종각1/총6·자격3종·옛CD/+15%폐기; 시작1/1/1/ball2·상한해제·4선택 확정소비/취소무소모·자기행동 무료·item 라운드1회/ball별도; 플레이어별 버프전투1개·power분산상단1.2·time R1/3R/HP비율/동률defender/사신불가·flee HPgate만해제/50%/반격·교환·밀기; 기술3직접선택→최초6생존→4슬롯/중복금지/CD승계/공개초기화/취소/event소모·상대정보; dragon30/CD3/elemental1.3/neutral1, witch18/CD3/중립·6균등2효과·sharedrand1·burn2/weaken자기공격2/shockFresh/refresh·grass실HP/흡수·overkill제외/maxHP·cure; reaper봉인/CD/차례/strict비율/왕대리패배/기본폴백/AIcounter; forest20종실수치·4skills·정체·복사/배열분리·후보고정·수령자cap조건·safe2/100,risk1/50,attack1/70·실패탐색자25%maxHP/min1·1attempt·기존enemyreserve70/100; #129 필수선택완료/1200끝점/추가1000없음/optional·manual/모달·FX·forced·teleport·newgame·stale·owner가드; #125 12FX1200/CSS1.2/bar350+.35s/나머지타이머보존; 공유seed/RNG-render0/invalidnonowner/AI5급·5단완주·튜토리얼10/help.

직접 실행: 17531ef7에서 안전16종 모두 exit0 — smoke_cycle5 69/0, smoke_turnflow200/0, smoke_turnflow_timers36/0, smoke_memo122/0, smoke_own_side66/0, smoke_online_sync23/0, smoke_testclient41/0, smoke_issue114 16groups, smoke_tutorial124/0, smoke_search_packages270/0, smoke_fx_timing82/0, smoke_attack_balance52/0, smoke_shock67/0(469/1000), smoke_cross_skill86/0, smoke_ai_completion59/0(13판·364전투·67탐색·13teleport), smoke_orientation_audit --path demo/index.html 8908/0.
157026ba에서 영향6종 재실행 모두 exit0 — search289/0, turnflow200/0, timers36/0, issue114 16groups(5급/5단6sim), AI59/0(13판), fx82/0; 최종 c6b01627에서 제품/이 회귀/harness diff0이므로 그대로 적용.
smoke_online은 원본명령의 tmp 쓰기를 실행하지 않고 fs write/read/unlink를 해당 mutant 한정 메모리로 치환해157/0 exit0, virtualWrites1/virtualDeletes1/memoryRemaining0/diskWrites0.
인라인 saturn_recheck9/0, saturn_inline_rules14/0(1200끝점·중복/가드·20종clone), saturn_end_cleanup9/0(원격종료DOM·FX/2500보존), saturn_media_hash34/0, 최종43개/추적43개/10PNG일치 점검 exit0; 초기668ea573 독립 combat6/0·온라인양측탐색10/0도 근거로 보존.
실패 이력: 초기 독립 recheck1/7 exit1 및 기본privacy0/1 exit1은 실제 결함이며 수정 후 해소; 종료추가검사 최초6성공 뒤 harness 미노출 finishBattle 함수 TypeError exit1은 검사 작성오류라 execSlot 정상경로로 바꿔9/0 재실행, 초기 PowerShell UTF8 미설정 진단 파싱오류도 제품실패로 세지 않음.


## Saturn 원문 2/2 — msg_9d1bbac838d5

Saturn 독립 QA 최종 보고 2/2 — 증빙·한계·전체 파일목록 (1/2 msg_2c0a9a11f45e와 함께 그대로 보존)
최종 Mars report 전체 및 최신 browser JSON at2026-09-09T11:46:25.175Z(57/0, 제품ref157026ba/HTML4535791 동일)를 대조했다: 배너1230ms, shield1217→HP1576 간격359ms, 잠금3646ms까지, 탐색1222ms/turn+1/autoEnds+1/추가확인없음; CSS1.2s/.35s와 버프 계산CSS 및 실제 기술선택3단계 증거가 있다.
이것은 Mars의 실제 HeadlessChrome152 브라우저 실행 결과를 Saturn이 검토한 것이며 Saturn이 브라우저를 직접 실행한 결과가 아니다; harness fxLive=false의 시간0과 구분한다.
튜토리얼10장 직접 시각검수 및 SHA256/bytes/2224x1628/README href+src10/10 일치, manifest env.ref157026ba/htmlBlob4535791과 최종HEAD 제품동일을 확인했다; 재실행된 최신 기능 PNG8장도 모두 직접 열어 확인했다.
privacy-owner-control.png는 내차례 볼47이 표시되는 정상 소유자 대조이며 비소유자 캡처로 인용하지 않는다; 비소유자·PVE AI 마스킹의 실제 브라우저 근거는 JSON DOM스캔이고 독립Node재현으로 보완했다.
문서의 정식v0.4.5/계획v0.4.7·미출시/CJ대기 구분, README캡처 출처·10장 경로, CI v047 manifest 및 검사인덱스CDP14종 정정 확인.
비차단 P3 문서 오기1: Mars/report.md:61 표에는 스크린샷7장이라고 남지만 실제8장이고 같은 문서160행의8장 목록은 정확함; 제품 재수정이나 전체 재검사가 필요한 결함이 아니며 PD의 메타데이터 정리 때7→8로 맞출 수 있다.

잔여 검증 한계:
- CI5 실제 PR 검사는 아직 별도 필수이며 서버/Windows실행기/전체자산·도구의 임시파일 회귀는 Saturn 직접 미실행; smoke_minion_art205/0은 Mars보고값으로만 남기고 독립PASS로 세지 않았으며20종실스탯/skills/정체/clone은 인라인·소스에서 별도 확인했다.
- 실제2기기/릴레이 종단간 온라인, GitHub 실제 Markdown sanitize/브라우저README레이아웃, CJ 체감플레이는 미실행; 두Node인스턴스락스텝과 같은브라우저탭 시점변경을 실제네트워크로 과장하지 않는다.
- media verify는 --no-gh --no-render의 오프라인 부분검사이고 새 경로PNG에 대한 엄격SHA 게이트가 아니므로 Saturn이10장바이트를 별도로 대조했다.
- Mars의 #121/#129 31종 및14종 축소 mutant sweep은 모두 중단/미완료로 보존; 기존 역사 shock_compare pass10/fail1/exit1을 고치거나 현재PASS로 바꾸지 않았고 직접 재실행하지 않았다.
- 절차 예외를 숨기지 않음: 초반 범위 미지정 git status 출력에서 보호 경로 이름이 노출된 메타데이터 조회가 있었고 내용 읽기·보호 파일검사·파일수정은 없었으며 이후 명시적 허용경로만 사용했다; 따라서 보호경로 무접근을 완전 충족했다고 소급 주장하지 않는다.
- files_modified=[]; 제품/테스트/문서/임시/보고서/스크린샷 파일쓰기0, Git/GH/Notion쓰기0, worker spawn0, Roblox변경0; 이 보고서는 메시지 본문이며 Saturn이 보고서 파일을 만들지 않았다.

최종검사 HEAD c6b016277f3a8985c844c26f6b2bdb6ca2c24c89; base68cd825b7928b8296c3bb6c28ec48dc179488b35; 허용범위 git status 출력0, git diff --check exit0; 아래43개가 origin/dev...HEAD 전체 납품변경목록이며 전부tracked43/43이고 보호경로는 검사범위에 포함하지 않았다.

.github/workflows/ci.yml
CLAUDE.md
README.md
demo/index.html
demo/test/README.md
demo/test/milestone/v0.4.7/issues/121/v047_cdp.js
demo/test/regression/smoke_attack_balance.js
demo/test/regression/smoke_cross_skill.js
demo/test/regression/smoke_cycle5.js
demo/test/regression/smoke_fx_timing.js
demo/test/regression/smoke_minion_art.js
demo/test/regression/smoke_search_packages.js
demo/test/regression/smoke_turnflow.js
demo/test/regression/smoke_turnflow_timers.js
demo/test/shared/harness.js
docs/README.md
docs/creat2ve/HANDOVER_SNAPSHOT.md
docs/milestone/README.md
docs/milestone/v0.4.7/README.md
docs/milestone/v0.4.7/issues/121/Mars/artifacts/capture-manifest.json
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-01.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-02.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-03.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-04.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-05.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-06.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-07.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-08.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-09.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/tutorial/tutorial-10.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-battle-damage-stage.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-browser-report.json
docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-buff-power.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-privacy-owner-control.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-search-done.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-search-root.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-search-skill.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-search-slot.png
docs/milestone/v0.4.7/issues/121/Mars/artifacts/v047-search-target.png
docs/milestone/v0.4.7/issues/121/Mars/report.md
docs/milestone/v0.4.7/issues/121/Venus/gameplay-spec.md
docs/releases/README.md
docs/releases/v0.4.7.md

## worker_done — msg_54fe9b347152

PASS — CLAUDE·CJ 승인 계약·최종 Mars 보고 전체와 실제 diff/source/assertions/미디어를 독립 대조하여 P1 사신CD·차례 우회/기본공격 비밀기술 로그/상대재고 노출 및 P2 종료상태/불가버튼/원격기권 화면잔존 총6건의 재현·해소를 확인했고, 검사HEAD c6b016277f3a8985c844c26f6b2bdb6ca2c24c89·base68cd825b7928b8296c3bb6c28ec48dc179488b35·HTML blob4535791bbefd86ad829cdd436d4957f8a530846b·LF SHA25684ebbff4a33fcb910e01f7f09ad5a0aa2a91ef8486dbeeef7d064757e5748a20·원문 SHA256b5c80b07c8baa94635a3a52454ec8170229a345cb8ae57e6cbc124a5984fcc94 및 정확한 변경43파일/tracked43/43을 보고1/2 msg_2c0a9a11f45e와2/2 msg_9d1bbac838d5에 기록했다.
직접 안전16suite와 수정영향6suite의 최종 관련 결과는 smoke_search_packages289/0·smoke_fx_timing82/0·smoke_cycle569/0·smoke_turnflow200/0·smoke_turnflow_timers36/0·smoke_memo122/0·smoke_own_side66/0·smoke_online_sync23/0·smoke_testclient41/0·smoke_issue114 16groups·smoke_tutorial124/0·smoke_attack_balance52/0·smoke_shock67/0·smoke_cross_skill86/0·smoke_ai_completion59/0(13판)·smoke_orientation_audit --path demo/index.html 8908/0(17531ef7), 추가 메모리치환 smoke_online157/0(diskWrites0), saturn_recheck9/0·saturn_inline_rules14/0·saturn_end_cleanup9/0·saturn_media_hash34/0 모두 exit0이며 최종HEAD 제품/회귀/harness는 검증ref157026ba와 diff0, 별도 제공 브라우저57/0의1230ms/359ms/탐색1222ms와 최신PNG8장·튜토리얼10장 해시10/10을 검토했다.
잔여는 비차단P3 Mars표61행 스크린샷7→실제8 오기, PR CI5·CJ플레이QA·실제2기기온라인·GitHub렌더 미실행 및 전체자산/임시파일도구 직접미실행 한계이며 정식v045/미출시v047·과거shock_compare10/1 exit1·중단mutant sweep을 보존하고, 초반 범위미지정git status의 보호경로 이름 메타데이터 노출 예외도 보고2/2에 명시하여 무접근 완전충족으로 과장하지 않았으며 files_modified=[]·전파일쓰기0·Git/GH/Notion쓰기0·spawn0·Roblox변경0으로 이 QA 작업을 완료한다.
