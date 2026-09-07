# Issue #89 — Saturn 1차 독립 QA

> 2026-09-07 · 판정 **REVISE** · Saturn 인라인 보고를 Mercury가 보존했다.
> Task task_35af2f199d89 / Dispatch ctx_7587a359d6a6 · files_modified=[]
> 아래 판정은 수정 전 고정 해시에 대한 기록이다. 수정 후 재검 결과와 구분한다.

## Saturn 최종 QA 1/3 — REVISE 수정목록

출처: msg_c3f2095653c3

[피드백] Saturn 최종 독립 QA: REVISE. required_role=Saturn / mode=QA / area=QA / mutation=none / instance_index=null / provider=Codex / files_modified=[]. 기준 HEAD=258d4ea4e9f5e2f866775605809d29741942db63, 검증 시작·종료 제품/테스트 SHA 동일, 직접 수정 0.

수정 목록(한 번에 인계):
1) P2 제품 결함 — demo/index.html:68,70 및 artPortraitFail:394-400. Chrome 152.0.7977.82에서 viewport1024x640 DPR1.25, startMode(pvp), fillRosterRandom(0), rosterInfo(M-F1) 실행 후 img에 artPortraitFail(img,fire_std)를 2회 호출하면 정상 이미지/부모 높이128→fallback192, 버튼 top459.5→491.5로 바뀐다. 별도로 viewport360x640 DPR1에서 Network.setBlockedURLs로 *fire_std/portrait.webp 및 *fire_std/portrait.png 실제 요청을 차단해도 fallback 높이192를 재현했다. 기대: 짧은 화면128px 자리와 버튼 위치 보존; 실제: 뒤쪽 .rosterArt.fb가 동일 specificity의 media128 규칙을 덮어 대체상자64px 확대. 수정 소유자 Mars, 규격 실측 문서 반영 필요시 Venus. 192 desktop과128 short 모두 실제 CSS/버튼/스크롤로 검증해야 한다.
2) P2 테스트 결함 — demo/test/smoke_minion_art.js:242-243 H8 및 :307 J13. H8은 const moved=T.doMove(...)!==false||true 로 moved가 항상 true이며, 목적지11,4는 이미 상대가 놓인 칸이어서 실제 이동 성공을 증명하지 않는다; J13은 img.style.display!==none||true여서 어떤 결과도 통과한다. 기대: 실패 시 단언 실패 및 실제 좌표/행동소모/대체DOM/FX 보존 확인; 실제: no-op·잘못된 결과도 두 단언을 통과할 수 있다. F7/F9(:175-182)는 문자열과 클래스만 보고 실제128→192 CSS 결함을 놓쳤다. Mars가 테스트를 고치고 재실행해야 하며 Saturn은 수정하지 않았다.
3) P3 문구 결함 — demo/test/minion_art_cdp.js:14,204-205,292,305 및 docs/qa/minion-art-integration-mars.md:204. --read-only도 Chrome 임시 profile 생성/캐시 쓰기를 수행하므로 파일 생성 없음/파일을 하나도 만들지 않음은 부정확하다. 기대: 검증 산출물0(스크린샷/보고서/스크립트 생성 없음), 자기 임시 profile은 실행 부수 리소스 예외라고 명확히 표현. PD msg_c1a4bb96091e 및 msg_c206f0f0d103의 명시 허용에 따라 실제 재실행은 수행했다; 실행 불가/제품 보안 결함으로 판단하지 않는다. 수정 소유자 Mars(스크립트·구현 보고); 역할계약 문서 정합성은 Venus/PD.

기존 메모 피커/사이드 목록의 🪤 빈 네모는 한글 라벨을 동반한 기존 상태이고 PD의 보존 지시를 확인했다. 같은 MEMO_OPTS8종과 말판 확정/추측 텍스트 fallback은 유지되며 이 baseline을 이번 신규 회귀로 추가 분류하지 않는다. 현재 증거에서 신규 정보누출·규칙변경은 발견하지 않았다.

## Saturn 최종 QA 2/3 — 명령·직접 실행 근거

출처: msg_43b49bd75afa

[피드백] Saturn 최종 QA 2/3 — 직접 실행과 소스 검토 증거.
실행한 기존 명령(모두 node 종료코드0):
node demo/test/smoke_cycle5.js →69/69(규칙·AI vs AI 완주, grade5/dan5 치환불변성 각450 차이0)
node demo/test/smoke_memo.js →49/49
node demo/test/smoke_tutorial.js →124/124
node demo/test/smoke_testclient.js →41/41
node demo/test/smoke_minion_art.js →113/113
합계396/396이며 신규113에는 앞서 보고한 무효 단언이 있으므로 품질 PASS와 동치가 아니다. smoke_online.js:655가 임시 mutant HTML을 쓰므로 원본 스위트는 실행하지 않았다; 서버 무변경이므로 npm test도 이번 QA에서는 실행하지 않았으며 구현자157/157·npm test 결과를 내 결과로 복사하지 않는다.

CDP는 아래 JavaScript를 PowerShell literal here-string에서 node stdin으로 실행했다(파일 작성 없이 원본 require, --read-only 설정, PID/경로 계측과 정리 경계 검증만 추가):
const fs=require('fs'),cp=require('child_process'),path=require('path');
const made=new Set(), mk=fs.mkdtempSync, rm=fs.rmSync, sp=cp.spawn;
fs.mkdtempSync=function(...a){const p=mk.apply(this,a);made.add(path.resolve(p));console.log('QA_PROFILE '+p);return p;};
fs.rmSync=function(p,o){if(!made.has(path.resolve(p))) throw Error('unexpected cleanup path'); const r=rm.call(this,p,o);console.log('QA_PROFILE_REMOVED '+p);return r;};
cp.spawn=function(c,a,o){const p=sp(c,a,{...o,windowsHide:true});console.log('QA_CHILD '+p.pid+' '+path.basename(c));return p;};
const log=console.log;console.log=(...a)=>{if(typeof a[0]==='string'&&a[0].includes('READ_ONLY:'))return;log(...a);};
process.argv=['node','demo/test/minion_art_cdp.js','--read-only'];
require('./demo/test/minion_art_cdp.js');
결과64측정·문제0·exit0. file/HTTP 각8조건×tray/roster/board/battle. Chrome152.0.7977.82 Windows10 headless. DPR1/1.5/2, 125%는1024x640+DPR1.25, 200%는640x400+DPR2 에뮬레이션. desktop1280/1920, mobile360/390 포함. 그리드376x700/91칸, cell52, pc48, icon32, battle128, stage200, 숨김img/종폴더누출0, 이미지실패0, 정상문자10자 글리프오탐0. 기존 🪤만 미지원 fallback. source 측정기에서 누락한 실패 시나리오를 별도 검사해 P2를 찾았다.

추가 독립 실행: node_repl에서 원본 minion_art_cdp.js의 main 실행 전 prefix만 Module._compile로 메모리 로드하고 launch/connect/측정 문자열을 재사용, 임시 스크립트 파일은 만들지 않았다. 새 Target의 Runtime.evaluate·Network·Input 명령으로 다음을 직접 검증:
- 초기 Network.requestWillBeSent 총40/unique40(icon20+battle20), portrait0; ART.loaded40. 숨은 상대 종ID/속성/HP/이름 sentinel 변경 후 그 말 outerHTML 동일, hidden DOM 누출0, 요청 총40 유지. 숲 비인접 말 미렌더, tempReveal 후 정체는 ? 유지.
- ROSTER20개를 실제 known 말에 순환 표시·img.decode: icon20/20 natural32/display32/정보행 비겹침/고유URL20. 실제 B.fa===attP 전투원 순환 표시: battle20/20 natural128/display128/고유URL20.
- 실제 DOM 셀 click: 선택됨, 이동11,6→11,7 및 mainUsed=true; 미공개 상대 click→메모피커8종→trap 저장, 말판 점선/반투명·함정 텍스트·미공개 접근성 유지. 실제 공격셀 click→B.fa=M-F4/B.fd=M-L2 각각 올바른 battleURL.
- Input.dispatchMouseEvent press/release로 tray 첫말선택(id29)→11,1배치 완료, tray14→13. 로스터 선택해제/재선택→동일ID 제거·재추가·총6. 가득찬6종에서 추가 선택 차단은 기존 조건대로 유지.
- 실제 vipChoice 흐름: 왕본체 👑왕, 동료본체 🤝동료, tryCapture(safe) 후 포획 출전 B.fa!==attP·element=fire·🔥불, 세 경우 모두 종img 없음.
- 전투 이미지 실패 callback 직후 기존 tok-A 유지·art/img 제거·🔥불 즉시 대체. __act(0) 실행 후 상대HP90→57/phase0→1/tok-A·tok-D 유지/msgQ0(전투 진행 보존).
- 모바일360/DPR1 HP0·100 실제 텍스트, 정보행 비겹침/내부수용, immob danger RGB255,91,110. 종료 전체공개에서 hiddenId없음·폭탄/함정HP없음. 로드실패 portrait 실제 요청 차단은1/3의 제품결함 재현.

baseline은 git show HEAD:demo/index.html 바이트를 data: URL로 인메모리 실행하고 현재 file: 페이지와 동일 setSeed4242/SETUP_PLAY를 비교했다. 11조건(기존8+mobile360 DPR1+390 DPR1+394 DPR2) 전부 pageScrollW 및 grid376x700 동일; 360/390/394 page722, 200% page722, 1280 page1280, 125% page1024. 기존376px고정보드 overflow를 신규회귀로 오분류하지 않는다.
소스 diff195행 및 호출경로 검토: known/visibleTo·AI관측·BAL/게임규칙·전투진행 로직 무변경, 새 aria는 known만, 미공개 분기에서는 종경로 생성없음, artDirOf의 rosterId 검증은 ROSTER20 허용목록만. 기존 lockstep 메모리는 의도된 baseline 범위다.

## Saturn 최종 QA 3/3 — SHA·화면·보존·한계

출처: msg_4da4f1d15d14

[피드백] Saturn 최종 QA 3/3 — 고정해시·화면·보존·한계.
검토 SHA256(시작/종료 동일):
demo/index.html = 9a102ee03d1e0b6d339483f035fc4aaa32f89699c2f4e25cb246c1dffe0c10cd
demo/test/harness.js = 2381e0ec51fd56af3e63ccd40e3ca4a9a39731105af14a4e4394f3f30d813e0b
demo/test/smoke_memo.js = c14f63437e8edeeb4f58689fa011db03bcf036365556396ac7650bd7ae6ed00a
demo/test/smoke_minion_art.js = 049c45d64c5c15fd0dd49916ba86c7df5f3591d9280799cb1b3ddacf1a4991aa
demo/test/minion_art_cdp.js = e5d3aa9c1b0aba7447f206ed1aac6048595b1ec3cd6002fbb2f11508309bce85
demo/test/smoke_cycle5.js = 92e64e257eb6257ccb3ada7414a4991ab44768ba7572dee1fbd502413af1d40f
demo/test/smoke_tutorial.js = f78ff20a35745b5da23dfbe588ffbe982f2c3a1cfb4c052b886a1c14b2227e7f
demo/test/smoke_testclient.js = a03030b6ae276455d1bda2a1e409b1a2cdf7e78ce512d3a98efc03c7a0bf94ca
기존 CDP JSON = 8f2f22385159c028ff592a26a65f33d360a94539bbc3fc05a6342a9613f4d021 (docs/qa/minion-art-integration/minion_art_cdp_report.json;64측정·issues0 확인, 내64재실행은 stdout만).

직접 시각 검토한 기존 PNG10장(모두 docs/qa/minion-art-integration/ 아래):
file_desktop-1280_1-tray.png
file_desktop-1280_3-board.png
file_desktop-1280_4-battle.png
file_mobile-360_2-roster.png
file_desktop-1280-zoom125_3-board.png
file_desktop-1280-dpr1.5_3-board.png
http_mobile-390_4-battle.png
http_mobile-360_3-board.png
http_desktop-1280-zoom125_2-roster.png
http_desktop-1280-dpr2_4-battle.png
전반적으로 배경 위 아이콘 외곽과 원소/HP가 구분되고, 100/120 HP 및 own/선택 테두리가 아이콘을 가리는 결함은 관측하지 않았다. 검토된 전투 스프라이트는 그림끼리 겹치지 않고 핵심 실루엣이 보이며 portrait 이미지와 버튼도 확인했다. fractional DPR1.25/1.5는 정수 배율과 픽셀 폭이 달라지므로 완전 동일 선명도라고 과장하지 않는다. 모바일 screenshot의 오른쪽/하단 잘림은 기존 고정폭/스크롤 baseline과 일치하며 실제 클릭·보드기하와 함께 판단했다.

보존 검증 명령: git ls-files demo/assets/minions docs/art/minions-v0.4.3/pixel-sources docs/art/minions-v0.4.3/battle-patches tools tests 로 목록을 읽고 README.md만 제외, 각 파일의 fs.readFileSync 바이트를 git show HEAD:<path> execFileSync Buffer와 equals 비교. 총126파일/아트100파일 모두 불일치0. 현재56 PNG·JSON1 존재, 새로운 PNG/보고서/스크립트 작성0. git status --short 전후 동일이며 사용자 art/와 orca-hook-latency-report.md는 수정·스테이징0, Downloads 접근0, Git/Issue/PR/Notion쓰기0.

실행 부수 리소스 정리: 첫 CDP HTTP node PID6184/Chrome PID106872 및 C:/Users/pc_77/AppData/Local/Temp/artcdp-aVRaCR는 원본 종료 핸들로 정리. 독립 CDP Chrome PID50924 및 C:/Users/pc_77/AppData/Local/Temp/artcdp-gtSSc0는 Target.closeTarget 후 proc.kill/exit확인, resolve한 정확한 경로가 위 고정값과 같은지 확인 후 삭제했다. 마지막 Get-Process -Id 6184,106872,50924 -ErrorAction SilentlyContinue 결과없음; 두 프로필 삭제확인. 사용자 서버8080·기존 사용자브라우저·node_modules 변경/종료0.

한계: 실제 엔진은 Windows Chrome headless CDP이며 스텁과 별개다; 실제 브라우저 UI의125%줌 조작·실기기 모바일·비Chrome 엔진·실제 사람 블라인드20종 식별/학습률·권리체인 검증은 수행하지 않았다. 기존 screenshot10장 시각 검토는 정적 표본이지 사람 대상20종 식별 합격을 대체하지 않는다. CJ 디자인 최종수락은 존중하며 새 승인게이트를 만들지 않는다. 최종은 REVISE이고, Mars의 제품1건/테스트결함/문구 수정 후 해당 좁은 범위 재검이 필요하다.
