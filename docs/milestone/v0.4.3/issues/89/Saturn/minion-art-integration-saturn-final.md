# 하수인 아트 게임 적용 — Saturn 독립 재검 PASS

2026-09-07 · Issue #89 / PR #90 · task_cd870483c74a / ctx_d39379ab9c0b.

**최종 PASS · 남은 수정 요청 0.** 최종 직접 회귀249/249, Chrome82측정0문제, 수정 전 CSS 및 전투 진행/FX 음성 대조 검출 확인. 초기 독립 통과 범위 승계와 직접 재검 범위는 아래에 구분한다. 실제 기기·비Chrome·브라우저 UI 확대 조작·사람 대상 블라인드 식별은 미검증이며 CJ 플레이 QA는 남는다.

아래는 Saturn 인라인 원문을 Mercury가 보존한 것이다. Saturn의 files_modified=[] 계약을 유지하며 PD가 이 문서를 작성했다. 1차 REVISE는 initial 보고서에 보존한다. 이 문서의 1/3·2/3은 중간 시점 기록이며 최종 판정·해시는 3/3을 따른다.

## Saturn QA2 근거 1/3 — browser 및 보존 완료

출처: msg_c1bab66ca0a1

[피드백] Saturn QA2 직접 검증 1/3 — browser/회귀/보존 (J13 최종 판정은 Mars 완료 해시 후 별도).
역할 Saturn / QA / QA / none / instance_index=null / Codex, files_modified=[]. CLAUDE 전체·스냅샷2026-09-07·규격rev7·1차QA전체·Mars 수정기록을 먼저 읽었고 CJ 디자인 최종수락/제품 적용 승인을 유지했다.
직접 명령: node demo/test/smoke_minion_art.js =128/128(exit0, 수정전 ddebec86 해시), node demo/test/smoke_memo.js =49/49(exit0), node demo/test/smoke_cycle5.js =69/69(exit0, AI vs AI 완주·grade5/dan5 각450 치환 차이0). 합계246/246. smoke_online 원본은 mutantHTML을 쓰므로 실행0, 서버 npm test 실행0; 해당 Mars157/157 및 서버결과는 내 결과로 계상하지 않는다. 1차 tutorial124/testclient41·추가11뷰포트 baseline·20icon/20battle 순환·실클릭/정보은닉 전수는 승계 영역으로 이번 직접 검증과 구분한다.
CDP 정상명령 의미는 node demo/test/minion_art_cdp.js --read-only; 실제로 PowerShell literal here-string→node stdin에서 process.argv=['node','demo/test/minion_art_cdp.js','--read-only'];require('./demo/test/minion_art_cdp.js')로 원본을 실행했다. fs.mkdtempSync 생성 정확절대경로를 Set으로 기록하고 fs.rmSync는 그 Set에 있는 경로만 허용, fs.writeFileSync는 throw하여 검증파일출력 금지, cp.spawn은 windowsHide:true만 추가, WebSocket message listener로 Network.requestWillBeSent와 loadingFailed를 독립 수집했다. node 실제 exit0, 82측정=기존64+roster-fb18, 문제0, shots=[]/captures0. actual blockedReason=inspector18건(file9/HTTP9; viewport별 webp실패1+양쪽실패2) 확인. callback 직접호출로 대신하지 않았다.
Chrome152.0.7977.82 Windows10 headless, Node24.16.0. file/HTTP 각각1280x800 DPR1,1024x640 DPR1.25,360x640 DPR1에서 normal/webpfail/allfail을 Network.setBlockedURLs + cacheDisabled로 검증. 정상webp·webp실패png는natural512, allfail은img0/.fb/대체문구. 3경우 공통 표시폭/높이=192/128/128, 모달기준 artTop55/55/55, 버튼top405/341/375, scrollHeight/clientHeight465/465·401/401·435/435. 버튼2개 유지. 원본64측정의 board376x700/cell52/pc48/icon32/battle128/stage200·미공개img/종경로0도 직접 재확인.
추가 독립 narrow 실행: 같은 CDP 소스를 Module._compile으로만 로드, VIEWPORTS=[]로 기존64 반복제외, --read-only --no-http, schemes를 current/css-regression으로 복제. css-regression에서는 페이지 style의 기존128 @media 문자열을 제거 후 .rosterArt.fb{width:192px 앞에 재삽입해 수정전 결함만 메모리복원. 원래 roster-fb 판정 로직은 그대로 실행. 총18측정=current9 정상+negative9, 실제 차단18, node exit1/문제2는 의도된 old-CSS allfail1024/360만 정확검출(192px·버튼405/439·scroll465/499로 확대), current9 문제0. MEASURE_ROSTER_FB에 중심좌표차/pageScrollW/scrollTop만 추가해 current9 중앙오차0, page폭1280/1024/722와 모달scrollTop0 보존을 확인했다. 이 결과는 테스트의 수정전 결함 검출력 실증이며 제품 실패가 아니다.
보존: git ls-files demo/assets/minions docs/art/minions-v0.4.3/pixel-sources docs/art/minions-v0.4.3/battle-patches tools tests 목록(README 제외)을 fs.readFileSync와 git show258d4ea:경로 Buffer로 전수대조.126파일(아트100 포함) 불일치0. 검증산출물/제품/테스트/스크립트/보고서/스크린샷 작성0, Downloads접근0, 사용자art/·orca-hook-latency-report.md 수정/스테이징0, Git/Issue/PR/Notion쓰기0.
부수리소스: 첫CDP ChromePID81280/QA서버PID24396 및 C:/Users/pc_77/AppData/Local/Temp/artcdp-KfNWm5, narrow ChromePID107736 및 C:/Users/pc_77/AppData/Local/Temp/artcdp-yLHf51. 각 원래spawn핸들종료·정확한생성경로삭제 guard=true/removed=true, Get-Process -Id24396,81280,107736 결과없음 및 두 Test-Path false 직접확인. 사용자서버/기존브라우저/node_modules 변경·종료0.

## Saturn QA2 근거 2/3 — 메타데이터·한계·음성대조

출처: msg_5ebd5328537b

[피드백] Saturn QA2 근거 2/3 — 문구·해시·화면·한계 및 J13 수정전 음성대조.
--read-only 소스 검토: minion_art_cdp.js:3-5,19,372,394에 검증산출물0과 Chrome임시프로필 부수생성예외가 명시되고 실제 repo writeFileSync가 SHOTS/READ_ONLY 조건으로 막힘. 내 실행은 writeFileSync 자체를 throw로 계측했어도82측정 exit0. commit용JSON html='demo/index.html', report82/issues0, shots70=unique70=디스크PNG70, captures.count74/overwrites4; 문서 4.4/8.6 수와 일치.
기준 HEAD는 시작258d4ea4e9f5e2f866775605809d29741942db63에서 PD 승인된 Git 작업으로 ea4f18935067e1b5c847f7a9e74e755507a88ec4로 이동했다. 내 Git 쓰기는0이며 제품SHA는 시작·종료 동일. 최종동결SHA256: demo/index.html=1c172a638307046258c2e794ab22a28b6587029d04f17337269252cfd69a11e3; harness=2381e0ec51fd56af3e63ccd40e3ca4a9a39731105af14a4e4394f3f30d813e0b; memo=c14f63437e8edeeb4f58689fa011db03bcf036365556396ac7650bd7ae6ed00a; CDP=d2f044b891deaf5e40c73f9805493438c0d356a9bc21eeefbe11350118bca75a; JSON=ccb168e46dc7e7be0a48633497e681d06754080986cd9725fa90c068a18531d2. 전체82실행CDP는889e508df6e2f2299cb0f021bede6a41cf4dcd07a8bdd28b0c4eac4eb4cbbb0b였고 종료까지 무변경 확인. 이후 PD가292행공백1자만 제거한 현d2f에 그 공백을 인메모리 복원한 SHA가 정확히889e와 같음을 독립 검증했다. narrow18은d2f 기반. 현 보고서 5절/8.7은d2f값으로 갱신돼 일치한다. J13 테스트/보고서 최종SHA는3/3에서 확정.
전체 origin/dev→제품diff 소스 검토는 CSS/아트헬퍼/표시호출만이며 BAL·규칙·AI관측·known/visibleTo의 기존조건을 변경하지 않는다. 내 QA 진행 중 productJS 변경0. pcInfoHtml은 알려진 하수인/동료/왕의 현재HP, 미공개는? 또는수동8종메모, 비가시는미렌더 계약 유지. 온라인 lockstep의 기존 상대rosterId 메모리 보관은 승계한 범위이며 새보안/기능규칙을 요구하지 않는다.
직접 본 기존스크린샷4장(모두 docs/qa/minion-art-integration/): file_desktop-1280_6-roster-allfail.png, http_desktop-1280-zoom125_6-roster-allfail.png, file_mobile-360-short_2-roster.png, file_mobile-360-short_6-roster-allfail.png. 정상/대체상자의 중앙정렬·문구·하단버튼이 보이고 모바일정상/실패에서 위치차이를 관측하지 않았다. 새스크린샷 저장0. 이는 기존PNG 표본시각검토와 별도 실제CDP좌표측정이며 사람20종블라인드검사로 계상하지 않는다.
J13 수정전 ddebec86dbc58cebac81f8c49d08f53330914725ee0fcf3de26ac8bab6fc77e7 음성대조는 PowerShell literal here-string→node stdin 안에서 child_process.spawnSync(process.execPath,['-e',code],{encoding:'utf8',windowsHide:true}) 사용. child의 fs.readFileSync를 감싸 demo/index.html을 읽을 때만 문자열 치환하고 원본 smoke_minion_art.js require; mutant파일 작성0. 결과: doMove 시작return 추가→125/128 exit1(H8d/e/h); fallback innerHTML을 WRONG<small>WRONG</small>으로 치환→127/128 exit1(J13a); artSpriteFail에서 el.style.display='none' 추가→127/128 exit1(J13b). 반면 __act no-op은127/128 exit1이지만 J13f는통과하고 J13g만실패; applyFx의 A측 shake/ko/float만제거하면128/128 exit0; __act를 applyFx({shake:'A'})만하는함수로 바꾸면 실제진행0이어도128/128 exit0. baseline실측은 전투시작 blog1→9,HP120→102,phase0→1,FX A/D 모두true. 따라서 J13f는기존blog>0 대신이전값대비델타, J13g는실패대체된동일tok-A 자체FX를 검증해야 하는 P2 테스트공백을 PD에 즉시 전달했고 Mars가같은범위 보완중이다. 제품실제결함이라고 판정하지 않는다.
한계: 실제브라우저 UI125%줌 조작, 실기기모바일, 비Chrome엔진, 사람블라인드20종식별/학습률, 권리체인조사는미수행. 1024x640 DPR1.25는에뮬레이션이다. portrait실패는M-F1공통CSS 표본이며20종재제작/재검수로확장하지 않았다. CJ디자인수락을새승인게이트로되돌리지 않는다.
정정:1/3 보존명령 표기는 git show HEAD:<path>이며 실행당시HEAD=258d4ea였다(요약문 git show258d4ea는띄어쓰기누락).

## QA2 스크롤 보존 추가 실증 / readiness 대기

출처: msg_2015eb69820e

[피드백] Browser 보존 증거에 실제 스크롤도 추가했습니다: 기존 낮은 화면 표본640x400 DPR2에서 page scroll(60,90), overlayBox.scrollTop20을 설정한 뒤 현재img의src에 쿼리만추가하고 Network.setBlockedURLs로 실제 WebP실패/양쪽실패를 유발했으며 두 경우 모두 page(60,90), modal20, scrollHeight/clientHeight401/366,128px가 유지돼 node exit0입니다. 이 추가 검사는 minion_art_cdp.js main 이전prefix만 Module._compile하여 별도검증했으며 출력파일0, ChromePID21872 및 C:/Users/pc_77/AppData/Local/Temp/artcdp-sGKVjP 생성/정확경로삭제 완료입니다. readiness Orca ask는 아직 응답 대기중이고 frozen J13 해시를 받으면 그 정상·음성대조만 확인해1개 최종 판정으로 종료하겠습니다.

## Saturn QA2 최종 3/3 — PASS

출처: msg_8717f7680975

[피드백] Saturn QA2 최종 3/3 — PASS.
대상 Issue #89 / task_cd870483c74a / ctx_d39379ab9c0b. required_role=Saturn, mode=QA, area=QA, mutation=none, instance_index=null, provider=Codex, files_modified=[]. 최종 판정은 1/3(msg_c1bab66ca0a1)·2/3(msg_5ebd5328537b) 및 스크롤 추가(msg_2015eb69820e)의 직접 증거와 아래 최종 J13 재검을 합친 것이며, 2/3의 J13 보완중 상태를 PASS로 치환한다.
최종 정상 명령 node demo/test/smoke_minion_art.js →131/131, node 실제 종료코드0. source diff 검토: J13만 pvp고정, D행동으로 실패대체 tok-A가 직접 피격되게 설정, 이전로그길이·HP·라운드 저장 후 델타 검사, FX잔재 제거 후 같은노드 appendChild의 신규float 기록, 동일객체·shake·정확한피해float1개·HP표시동기화·tok-D FX부재 검사. J13i/j/k 3개가 추가됐고 이전 H8 합법빈칸이동/소모 및 대체내용/id 단언은 그대로다. 새 제품JS 변경0. 이번 최종 정상 회귀 조합은131+memo49+cycle5 69=249/249이며 이미 통과한 memo/rules는 최종 J13-only delta 이후 재반복하지 않았다.
독립 negative 명령은 node stdin에서 child_process.spawnSync(process.execPath,['-e',code],{encoding:'utf8',windowsHide:true}); child의 fs.readFileSync가 demo/index.html을 읽을 때만 아래 문자열을 메모리치환하고 원본 smoke_minion_art.js를 require했다(fs.writeFileSync throw, mutant파일0). 세 child 실제exit1 확인:
1) window.__act=k=>netAction({t:act,k}); → window.__act=k=>{}; :128/131, J13f/g/k 실패. A120/D120, 로그+0, R1p1 고정, FX0.
2) function applyFx(fx){ 시작에 if(fx){fx={...fx};if(fx.shake===A)delete fx.shake;if(fx.ko===A)delete fx.ko;if(fx.float&&fx.float.side===A)delete fx.float;} 삽입 :129/131, J13g/k 실패. 실제진행 A120→100/D120불변, 피해로그20·로그+3·R2p0이지만 A shake=false/float0을 정확검출.
3) __act 본문을 {applyFx({shake:A});}만 수행하도록 치환 :128/131, J13f/g/k 실패. HP·로그·라운드 변화0이고 shake만true/float0인 허위진행을 정확검출.
Mars의 양성호출만치환한129/131·130/131과 내제품전체치환128/131·129/131은 변이범위가 다르다(내변이는 새J13k에도 영향을 줌). 원래PVE128판의 no-op127/128(J13g만실패/J13f허위통과), A FX제거128/128, FX-only128/128과 최종판을 혼동하지 않는다. 보고8.8의잘못된역사수치2곳을 PD가 정정했고 직접 다시 읽어 정확한 귀속/범위가 반영됐음을 확인했다. 남은 수정요청0.
최종 SHA256: demo/index.html=1c172a638307046258c2e794ab22a28b6587029d04f17337269252cfd69a11e3; demo/test/smoke_minion_art.js=bbf08d5d7b7c333568ca354df9035726b299e7b8b730f6dbc0e67921bace2923; demo/test/minion_art_cdp.js=d2f044b891deaf5e40c73f9805493438c0d356a9bc21eeefbe11350118bca75a; docs/qa/minion-art-integration/minion_art_cdp_report.json=ccb168e46dc7e7be0a48633497e681d06754080986cd9725fa90c068a18531d2; PD역사수치정정후 구현보고=809efa028003b58edcc347b8616de666145df23d105b87ce9160c8fe09f22ba2(정정전1fc16827…). 마지막HEAD=cef07ba6db06af9254c8c67ab9d31f18aa1b6520; QA중PD Git/메타데이터변경은 허용된타인작업으로 구분했고 내수정0. 제품·CDP·JSON은 동결해시 유지.
결론: 초기P2 CSS fallback, P2무효단언, P3 read-only문구는 해소됐다. 2차에서 발견한 J13 실제진행/대체노드FX 검증공백도 동일scope Mars보완 후 독립negative로 해소됐다. Chrome82측정 문제0·추가 current9 기하정상·oldCSS9중정확2실패검출·실스크롤2경우보존, 아트/원고/도구126파일(아트100)보존. 기존4개PNG 표본시각검토와 초기사전통과영역 승계를 구분하며, 실제browserUI zoom/실기기/비Chrome/사람블라인드식별/권리조사는 미수행이다. 이 PASS는 해당제품적용수정범위의 QA판정이고 CJ플레이QA를 대신하지 않는다; 디자인재승인게이트는 없다. 보고파일/스크린샷작성0이며 PD가 인라인근거를 최종재검문서로 보존한다. 자기Chrome3프로필/PID는 정확경로로 모두정리했으며 마지막PID21872/경로artcdp-sGKVjP도 Get-Process결과없음/Test-Path false를확인했다.
