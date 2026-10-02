# #296 CJ QA REVISE1 — Mars 구현 기록 (2026-10-03)

- Mars_1 · run `run_c5374ba15658` · task `task_5c5fab804e0e` / dispatch `ctx_6b35eec0fb5d` · 5필드: required_role=Mars · mode=IMPLEMENT · area=CLIENT · mutation=code(+소유 문서) · instance_index=1
- `claude-opus-5-5` / effort high · `bypassPermissions`(--dangerously-skip-permissions) · Ponytail full · 세션 `b9489f39-a605-4274-ae64-47a6e92c5337`
- 기준 HEAD `93c1e70` · WorkTree `issue-296-battle-flow` · Git 읽기 1회(사전 점검의 `rev-parse HEAD` — 기준과 일치, 그 뒤 0회) · Git 쓰기 0 · GitHub/Notion 쓰기 0 · 새 의존성 0 · 서버 · Core 수정 0
- 기준: [CJ 원문 · 그림 7장](../cj-qa-revise1.md)(7장 모두 직접 열어 봄 · 6 = 7) · [Venus 화면 계약](../Venus/cj-qa-revise1-contract.md) · PD 확정(정보 칸 = 살아 있는 내 **하수인**만 · 실제 방어막 0 은 `(+0)` · 바깥 '← 뒤로'는 싸우기만)
- 판정 아님: Saturn 독립 QA · CJ 플레이 QA 전이다.

## 변경

| 요구 | 구현 | 파일 |
|---|---|---|
| 1 정보 칸 | `renderBoardInfo` 가 우측 시너지 열과 그 아래 고정 버튼을 `.sideCol` 하나로 그린다(`infoSlotHtml`). 글자는 늘 `하수인 정보`, 46×56. 내 차례 · 고른 살아 있는 내 하수인일 때만 켜짐(`unitHelpPiece` · 전송 0). 그 밖에는 `disabled`로 자리를 지킨다. 행동 줄 조건부 버튼은 삭제했다. 상대 차례 탭(`ownInfoTarget`)은 그대로다. | ui.js · game.css |
| 2 전투 상단 | `.overlay:has(.battleTop)` = 프레임 위(`--appTop`) 정렬 · 창 높이 `--appH`(#295 상점 시트와 같은 방식) — 위 86px 여백과 가운데 정렬은 없다. 이모티콘 자리 맞춤(`emoteSync`)은 그대로다. | game.css |
| 2 카드 | 양쪽 같은 틀: `★ 이름` + 아키타입 · 속성 아이콘(`gi`)이 한 줄. HP 바 안에 `❤ hptxt/최대(+shtxt)`(0 포함)를 두고 방어막 막대는 같은 바 아래쪽에 둔다. 6스탯 3×2와 상태 · 버프 칩이 뒤따른다. id 5종은 그대로다. `bst-`는 `stIcons` 원문(화면 밖 접근성 글자)이고, 칩(`bch-`)은 같은 원문 낱말을 그대로 쓴다(한글 이름만 title로 · 값 · 단위 그대로 · 단순 `🛡n`은 바 안 숫자로만). 연출이 글자를 바꾸면 `battleStSync`가 칩을 다시 그린다: 오프라인 `applyFx`, 온라인 `network.js` fx 경로 한 줄. 주인 글자는 `srOnly`다. 따로 있던 버프 상태 줄은 카드 칩으로 옮겼다. | ui.js · network.js · game.css |
| 2 도망 | `정말로 도망갈까요?` + `[🏃 도망 (성공 N%)]` `[↺ 돌아가기]`. 설명 문단을 삭제했다(규칙 설명은 버튼 title). | ui.js |
| 3 포획 | 제목은 `ballWhy` 결과에 따라 `포획을 시도할까요?` / `지금은 포획이 불가합니다.`. 우상단 칩: HP 30% 미만(✓ 초록 / 실제 HP 비율 빨강) · 내 볼 `×N`(0 빨강 · 소유자만). 못 던지면 `🔒` · `aria-disabled` · onclick 없음 · title = `ballWhy` 정확한 문장(소유자만)이고, 초점은 남는다. 성공률은 `BAL.enemyCapProb`. | ui.js · game.css |
| 4 가방 | `🎒 가방` + 오른쪽 위 `[↺ 돌아가기]`. 3열 칸 두 묶음: 아이템 `ITEMS` 3종 · 버프 `BUFF_KEYS`(비경제 = 패키지 2종). 칸 = 아이콘 · 이름 · 실제 `×N` · 짧은 효과(`ITEMS.desc` · `GOOD_DESC`). 같은 종류는 한 칸이고, 누르면 그 종류의 **첫 실제 칸 번호**(`S.inv.indexOf`)로 `__useItem(i)`. `itemRound` · 버프 제한 · ×0은 잠금 + title. 소유자만. | ui.js · game.css |
| 5 싸우기 | `unitHelpOpen`의 스킬 줄을 `skillListHtml(skills,act)` 하나로 뺐다. 정보 창과 전투가 같은 함수 · 같은 줄 데이터(`unitSkillRows`, 줄에 원래 칸 번호 `i` 추가)를 쓴다. 전투는 쓸 수 있는 줄만 `<button … onclick="window.__act(i)">`로 감싼다. 쿨 = `남은 쿨타임 n` 칩, 봉인 · 불가 = 칩 + disabled. 잠긴 소개 줄은 버튼이 없다. `battleSlotOk` · `noAtkShow` · `dis`는 그대로이고 `dmgRange` · 범위 숫자는 없다. 다른 속성 판정 · 분류 · 봉인 사유는 버튼 title. 바깥 `#bmenuBack`은 싸우기에서만 보인다(`uiBattleMenu`). | ui.js · game.css |

## 테스트 갱신(요구가 바뀐 문자열 · 선택자만 · 강도 유지)

- `smoke_public_rooms` L5b · L5c · L5h · L10 · L11 · P1 · P2 · P8 · P9 · P10 · P14 · P17 · L17 · P12: 새 마크업으로 옮겼다(쿨 칩 · 칸 · `uhSkills` · 잠금 title).
  - 상대 스킬 부재 판정은 `bSkills|uhSkills` 둘 다 본다.
  - 기본기 desc 는 위력 · 쿨 칩과 같은 글이라 정보 창처럼 줄에 쓰지 않는다. P2 는 위력 칩으로 확인한다.
  - P10 은 전투원 등급(`등급 \d"`)만 본다.
- `smoke_fx_consumer` J1 · J2: HP 글자의 새 위치(바 안).
- `smoke_cross_skill` E1 · E1b · 상대 스킬 부재(`uhSkills` 추가): 판정 속성은 이제 title 에 있다.
- `smoke_turnflow` J4 · J5 · J6b, `smoke_search_packages` C7 · C7b · J2g · J2i, `smoke_issue146` A5:
  - 지운 설명 문단은 title 문장(`HP 조건 없이`)으로 본다.
  - 잠긴 볼 = `aria-disabled` + 정확한 사유 + onclick 없음 + HP 칩 `❤ 100%`.
  - 재고 비공개 음성 판정에 새 칸 형식도 넣었다.
- `smoke_issue238` C4c~C4f: 행동 줄 버튼 → 고정 칸(켜짐 → 설명 창 · 선택 유지 · 송신 0 / 선택 없음 · 하수인 아닌 말 = 같은 꺼진 마크업).
- **새 R1a~R1g**(`smoke_issue238`): 다음 일곱 가지를 검사한다.
  - 가방 묶음의 실제 칸 번호, 그리고 실제 사용 시 회복약만 줄어드는지
  - 하위 창 [돌아가기]의 행동 · 자원 · 전송 무변경
  - 도망 구성
  - 연출 뒤 칩 · `shtxt-` 갱신
  - 싸우기 = 정보 창과 같은 `span.uhSk` 줄 · 싸우기만 바깥 뒤로

- **후속(PD 검토 · task `task_c66f0c148e65` / dispatch `ctx_402ab0faade5`) — 테스트 원문 정정만:** 옛 마크업을 보던 음성 단언 두 곳이 새 마크업에서는 늘 참이었다(무의미). 이번 7개 파일의 다른 음성 단언(`<button` · `bSkills` · 쿨/불가 · 재고 글자)은 다시 대조했고 무의미한 것이 없었다. 제품 · 픽스처 · 기대값 변경은 없다.
  - `smoke_public_rooms` P15 — 활성 `__act` 버튼 0(새 `<button type="button" …>` 형식)과 잠긴 `__act(0)` 버튼의 실재를 함께 본다. `NO_ATTACK_MSG` · `__pass()` 단언은 그대로다.
  - `smoke_search_packages` J2b — 온라인 비소유자 화면에 상대 패키지 재고가 새 칸 형식(`×7` · `×8`)으로도 없음을 본다.
  - 두 파일만 1회씩 다시 돌렸다: public_rooms **211 / 0** · search_packages **302 / 0**(사유: 테스트 원문 정정).

## 검증(같은 실행에서 종료 코드 수집 · Node 24)

1. 영향 16개 1회:
   - 통과 9개: cycle5 70 · memo 129 · own_side 66 · online_sync 23 · issue241 86 · issue245 352 · issue236 299 · orientation_audit 8916 · issue293 140
   - 실패 7개: turnflow · search_packages · issue146 · public_rooms · fx_consumer · issue238 · cross_skill
   - 실패 원인은 모두 바뀐 문구 · 마크업 단언이었다.
2. 테스트 갱신 뒤 실패 7개만 재실행:
   - 6개 통과: turnflow 203 · search_packages 302 · issue146 218 · public_rooms 211 · fx_consumer 134 · cross_skill 86
   - issue238 은 내 새 단언의 함수 참조 오류(`global.unitHelpPiece`)로 중단됐다.
3. PD 확정 반영(하수인만 · `(+0)` · 칩 글자) 뒤 영향 3개만: issue238 187 · fx_consumer 134 · public_rooms 211 통과.
4. R1 추가 뒤 issue238 1회: **194 / 0**.
5. `tsc -p tools/typecheck` 1회: exit 0.

나머지 회귀(22개 전수 · 전체 네트워크 · 장시간 AI)는 이 변경이 닿지 않아 돌리지 않았다.

**실브라우저 렌더**(헤드리스 Edge · 자체 프로필 · PD 승인 포트 8296 · 디버그 9296). 하네스는 [render-harness.js](../../../../../../../artifacts/Digit-Duel/issue-296/cj-qa-revise1-20261003/mars/render-harness.js) — 제품 함수만 호출하고 계정 게이트만 우회했다. 320 · 390 · PC 1280 각 1벌 + 줄바꿈 수정 뒤 1벌 재실행.

- 보드: 선택 없음 · 하수인 선택 · 하수인 아닌 말 선택 · 상대 차례 네 상태에서 `#board` · `.sideCol` · 칸 · `#turnBar` 좌표 · 크기가 세 폭 모두 동일하다.
  - 하수인 선택 때만 켜진다.
  - 행동 줄 정보 버튼 0 · 가로 넘침 0.
  - 상대 차례 내 하수인 탭 → 설명 창이 열린다.
- 전투:
  - 창 위 = 0(모바일) / 18(PC 프레임).
  - 카드 `❤ 90/90(+17)` · 상대 `(+0)` · 칩 `🔥2R 💧1` / 내 `🛡25%·2R` + 힘의 수호자 칩.
  - 도망 · 가방 · 싸우기(잠긴 소개 3줄) · 포획 미충족(`❤ 100%` · `×0` · 잠금 · 사유 title) · 충족(`❤ ✓` · `×1` · `__throwBall`) 화면을 확인했다.
  - 페이지 예외 0.
- 스크린샷 36장 · `render-report.json`: `C:/Users/pc_77/orca/artifacts/Digit-Duel/issue-296/cj-qa-revise1-20261003/mars/`(`shots/` · `logs/`).
- 320 에서 한글이 낱자 단위로 끊기던 제목 · 버튼 · 칸 효과는 `word-break:keep-all`로 고치고 렌더 1회 재확인했다.
- 끝난 뒤 8296 · 9296 리스너 0 · 하네스 Edge 프로세스 0.

## 남은 것 · 한계

- [추론] 320 폭 상대 카드에서 긴 이름은 말줄임된다(아이콘 2개 자리). 전체 이름은 그림 alt · 메시지에 있다.
- 온라인 실서버 · 2클라이언트 렌더는 하지 않았다(네트워크 코드 변경은 fx 경로 한 줄 · 헤드리스 fx_consumer · public_rooms 로 확인).
- 이모티콘이 켜진 공개 방의 실제 버튼 위치는 기존 `emoteSync` 회귀(public_rooms L4e · L4f)로 확인했고, 실브라우저로는 보지 않았다.
- Saturn 독립 QA · CJ 플레이 QA 가 남았다.
