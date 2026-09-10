# #146·#131·#128·#130 Saturn 제품 코어·헤드리스 최종 검수

- 작성: Saturn(Codex), 2026-09-10. PD가 Orca inline 원문을 보존했다.
- Task `task_9ee7f6a02819`, Dispatch `ctx_32da7ffbb53b`, 원문 `msg_04982e0e29ac`.
- 범위: 제품 코어와 관련 헤드리스 회귀 PASS. 최종 브라우저·미디어·문서·CI는 별도.

[피드백] PASS — 수정 제품 코어·헤드리스 회귀 한정이며 최종 납품/출시 QA가 아닙니다.
Preflight READ_ONLY_QA / Saturn / instance Saturn / index null / QA / area QA / mutation none / Codex 일치; CLAUDE.md 전체, Venus gameplay-spec.md, Saturn initial-review.md를 읽었습니다. files_modified=[]이며 원본 smoke_online.js 직접 실행, 새 파일/임시파일/로그/이미지/프로필/설정 쓰기, 서버/브라우저 시작, 패키지 설치, Git/GH/Notion 쓰기, 스폰은 하지 않았습니다. 허용된 정상 git status 이름 열거 외 보호 대상 직접 읽기·메타조회도 없었습니다.

제품 SHA256 시작=8b9a26a5acf635426325fa9bfe356a3ebd964011017f3fc8a79f33233a34d8f0, 최종=b1c33ae8ff87e64cb71481714d73966f09e3af5f3b8506d82893dccb77f305de.
최종 smoke_issue146.js SHA256=5ebc18318f9d784cfef9fcfa3bba754a52fabbc55562bee77886d2a383470778; 최종 실행 전후 두 해시 동일.
HEAD 시작33bbc19e9c1ec5314903c3d6f77ecc7c5f6a9051 → 종료697212e515f4621dd10d765ddefd53bf471b7e55는 PD의 관련 없는 ff-only 전진으로 통지받았고 HTML 해시로 검토를 추적했습니다.
검토 중 Mars가 바꾼 제품은 예산거부 비공개 분기와 루트 pass 버튼 두 곳뿐이며, 두 변경을 메모리 문자열에서 되돌린 SHA256이 시작 해시와 정확히 같았습니다; 파일에 복원하거나 변이 제품을 실행하지 않았습니다.

초기 7실재현(5묶음) 동일 경로/입력 재검수:
- R1 후공D의 옛 pass를 호출해 R2 선공D로 넘긴 뒤 같은 클로저 재호출: expected 두 번째 무동작; actual round/phase/HP/RNG 불변 (:2138, :2389, :2741).
- msgQ 대기 중 pass: expected 무소모; actual 무소모; 추가 fxLock 중 pass/flee도 무소모 (:2138).
- 4슬롯 execSlot(A,-1), 상대 HP90: expected90 유지; actual90 유지 (:2514).
- 사신 봉인 + 다른 합법 슬롯, 상대 HP100: expected 기본공격 폴백 없음; actual100/phase 유지, 미사용 기술 공개 없음 (:2514 이후 reaper 분기).
- pass 공용 blog: expected 중립 결과만; actual 행동불가 사유 없음 (:2394 이후).
- immobile 대상 teleport 클릭·실행의 비소유 NET replay: expected 공용log/toast 사유0; actual0 (:1429, :1582).
- 같은 id의 복제 객체 teleport: expected 거부/좌표·주행동 불변; actual false/불변 (:1556).

추가 독립 인메모리 확인:
- 일반 공격과 seed2 실패 포획 각각을 거친 R1 D→R2 D에서 oldFlee/oldPass를 호출: 상대 actor가 같아도 상태/RNG 무변화; oldPass 호출 전 전슬롯쿨을 만들어 합법성 가드와 구분했습니다.
- item potion + escape 패키지 실제 사용 뒤 같은 행동의 기존 flee 콜백은 유효; HP 회복·버프/재고 소비, actSeq/round/phase 불변 후 seed2 도망 실패1회.
- NET host/join 두 활성 인스턴스에 실패포획/pass/실패도망 applyAction, 비대칭 렌더 횟수: 양측 actSeq/round/phase/HP/볼/지표와 다음 RNG 일치.
- 실제 king/ally 본체 basic: HP 피해와 phase 전환 정상; skills를 제거한 가짜 minion만으로 대체하지 않았습니다.
- 3/6라운드 전체 pass: HP 동률 방어자 승·judged1·양측 보호막 초기화; 비경계 pass는 nonzero weaken/focus/vuln/dmgCut·주행동·전투횟수·RNG 유지; 경계는 CD감소/화상/감전/아이템·볼리셋 정상.
- 성공 도망 시 forcedQueue는 선택 동안 보류, 후방 교환 또는 생략 뒤 밀기와 큐 승격; battlesUsed1 유지; immobile 후방 말 도망 교환도 허용.
- 보호막18+22=40,30+22=52, absorb 집계상한30에 이미 도달했어도 보호막은 실제 피해를 계속 흡수하여 HP불변; 새 게임/새 전투/포획성공/도망성공/판정 종료 모두 보호막·도망버프 초기화 (:2109, :2811).

이번 검토에서 발견·해결된 추가 제품 결함:
old :1589 예산부족 거부 addLog 및 무소유자검사 toast는 상대에게 사유를 노출했습니다; escalation msg_69c2c9dac1e2, PD 수락 후 Mars 수정.
입력 P0 a(2,2),b(12,4), P1 d(2,3),e(12,5), battlesUsed1/current0/mainUsedfalse, NET.me1 replay, cell(2,2)→cell(12,4); expected 공용log0/상대toast0, old actual 양쪽에 새 강제 전투2>남은1 표시.
최종 :1592에서 소유자toast만 표시; 양측 게임상태/RNG불변·stage1 안내까지 독립8/0.
최종 :2249 루트 pass: pvp/pve/NET 소유자 노출, 상대마스킹, fx중disabled, cool 후 제거, 기존handler 자기 행동1회 소모를 독립8/0 확인했습니다.

검사 수/실패 수:
- smoke_issue146 최초170/0 → 보강 중182/0 → 작성 중175/2(잘못된 실패포획 시드로 성공/전투null 예외) → 최종 고정본207/0.
- 나머지7종: search_packages299/0, tutorial132/0, ai_completion59/0(13판; 양난이도; 불변식0), online_sync23/0(--seeds2 --steps250), turnflow202/0, attack_balance54/0, cross_skill86/0.
- 최신 실행값 기준 선택8종1062/0; 독립 인메모리63/0; 최종 미해결 제품/테스트 실패0. 7종은 시작 해시, 최종207과 delta16은 최종 해시에서 확인했으며 전체19종을 반복하지 않았습니다.
- 인메모리 도구 작성 중 UTF8 stdin 전달 오류1회와 HP100 화상 기대6의 하네스 오류(실제 BAL5%=5)를 바로잡은 진단 재실행이 있었고 제품 오류로 세지 않았습니다.

회귀 약화/누락 검토:
기존 변경은 철회된 기본공격/50%도망/반격 전제를 새 계약으로 바꾸거나 합법 슬롯·본체 경로로 수치 검사를 옮긴 내용이며 수치/속성 회귀54/0·86/0도 실행했습니다.
초기 A11c의 fleePushes>=0 공허조건은 실제 후보/교환/밀기/큐로 보강됐고, F9c의 다른 합법슬롯으로 인한 공허성을 F9e 전슬롯쿨+실패포획 경계로 분리했으며 F11은 NET 활성과 실패포획/pass/flee RNG 비교로 보강됐습니다.
작성 중 F9e seed9999=0.1706179 및 F11 seed4242=0.5467061은 포획 성공값임과 F9e6 ||true를 즉시 전달했습니다(msg_bab0efcb2b22/msg_84da544594f7); 최종 :562 capFailSeed가 실제 실패 난수를 선택하며 :725는 실제 round/phase 변화 비교이고 ||true 제거, F12 예산거부 비공개 회귀 포함207/0을 확인했습니다.
root의 실제 화면 조작은 독립 DOM/handler 검사 범위이며 브라우저 시각 품질을 대신하지 않습니다.

누락/남은 게이트:
실제 브라우저 시각 QA, 새 튜토리얼 PNG, README 최종 링크, 최종 CI 및 미디어·문서 납품 확인은 별도입니다; 실제 WebSocket 네트워크/재접속, 물리2PC는 이 검사에서 수행하지 않았습니다.
#128은 기존 독립 Chrome 프로필 실측에서 신고증상 미재현·원인 미확인·저장로직 유지라는 범위이며 실제 신고 해결이나 물리2PC PASS가 아닙니다.
#121/125/129 CJ QA CLOSED, 새4개 CJ QA OPEN, v0.4.7 미출시/v0.4.5 정식 상태를 유지합니다.
초기 8~10분 검토 이후에는 PD의 최종 테스트 준비 통지 지시에 따른 대기와 해당 고정본1회 확인만 추가했으며 스크린샷·전체스위트·새 작업을 기다리거나 실행하지 않았습니다.

## PD 메타데이터 보충

Saturn이 마지막으로 읽어 기록한 HEAD는 `697212e`다. 검수 중 PD가 같은 제품 해시를 촬영 기준 커밋 `aa6998ae8d2ca8b5fc8136c5fa19bc6aca5c12ea`로 고정했으며 HTML blob은 `2a9b54c769a58fc5c0db9e913ce4421bec6758e3`다. 이는 제품 변경이 아니고, 검수 대상 식별은 원문의 최종 제품·테스트 SHA256을 따른다. 물리 두 PC나 신고된 #128 증상 해결 PASS로 확대하지 않는다.
