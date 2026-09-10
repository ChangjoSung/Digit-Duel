# Issue #92 — 탐색 보상: 속성 교차 공격기 획득·교체 (Mars_3 구현 납품 보고)

- 역할: **Mars_3** (required_role=Mars · instance_index=3 · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- Task `task_3d3b706a2533` · dispatch `ctx_85703abbfdd1` · 작업공간 루트 · 브랜치 `feat/92-cross-element-skills` · 기준 dev `d614392` (#91·#95·#96 통합본, 8스모크 754 기준)
- 근거 문서: `CLAUDE.md`(HTML 데모 절, 2026-09-07 v0.4.4 착수 문구) · `docs/v0.4.4-gameplay-spec.md` 2장(계약 1~8·AC 1~9) · Issue #92 최신 코멘트(포획 승계 보완 계약) · PD dispatch 계약
- 작성: 2026-09-07
- **이 문서가 주장하는 범위**: 기계로 잰 사실과 저장한 화면 증빙까지다. **Saturn 독립 QA와 CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다.** 아래 통과 수치는 Mars 자기 검증이고 Saturn 판정이 아니다.
- 표기: [확정] 코드·측정 사실 / [추론] 해석 / [미확정] 이번에 재지 않은 것
- Git/GitHub/Notion 쓰기 0 (stash 포함). `docs/creat2ve/HANDOVER_SNAPSHOT.md` 의 작업 트리 변경은 PD 작업이며 이 납품 목록에 포함하지 않는다. `art/`·`orca-hook-latency-report.md`·기존 아트 100파일·서버 제품 코드·기획 문서는 손대지 않았다.

---

## 1. 무엇을 바꿨나 (`demo/index.html` +85/−46)

| # | 위치 | 변경 | 계약 |
|---|---|---|---|
| 1 | `SKILLS` 공격기 12종 | `el`(키 접두사와 동일 속성) · `tier`(stable/effect/heavy) 필드 추가. 위력·쿨·플래그·설명 불변. 보조기·시그니처에는 두 필드 없음 | §2.4 |
| 2 | 헬퍼 (`archSkills` 아래) | `SKILL_TIER_KO` · `atkElOf(f,sk)`(공격기=기술 속성, 그 외=본체) · `skillNameKo(sid,bodyEl)`(본체와 다른 속성의 공격기만 속성 이모지 접두) · `recruitCandidates(p)`(타 3속성 × 3계열 − 장착, 순서 고정) · `aiRecruitSlot(p,alt)`(방어/지속형 효과기 보존 → 최저 위력 슬롯(동률 앞 슬롯) → 후보 위력 ≥ 슬롯 위력이면 교체) | §2.1·2.7 |
| 3 | `doSearch` recruit 하수인 분기 | 임시 보조기 교체("[임시 대체 — 기획 확정 전]") 제거. 후보 = `cands[Math.floor(rand()*len)]` **rand 1회**. `swap(slot)`은 `skills[slot]` 교체 + `revealedSkills`에서 slot 제거, **`cds[slot]` 유지**. AI는 `aiRecruitSlot`(난수 0), 사람은 `recruitModal`. 후보가 없으면(이론상 불가, 최소 7종) 안내만 | §2.1~2.3·2.5·2.7 |
| 4 | `recruitModal(p,alt,swap)` 신설 | 새 기술 / 공격기 1 / 공격기 2 를 `.fighter` 카드로 나란히: 속성 배지 · 계열 · 위력 범위(`dmgRange(slotPow)`) · 쿨 · 남은 쿨 · 효과 설명. 버튼 `[공격기 1과 교체] [공격기 2와 교체] [유지]`. 기존 `modal()` 동기화 래퍼 사용(신규 메시지 0). 문구에 개발 필드명·동기화 용어 없음 | §2.2·2.6 |
| 5 | `execSlot` | `atkEl=atkElOf(f,sk)`: 공격 상성(`BEATS[atkEl]` vs 상대 본체) · `applyStatus` 상태 종류(불→화상·물→약화·번개→감전, 감전은 `shockProb`) · 피해 플래시 `flash:atkEl` 이 판정 속성. 방어 상성(상대가 나를 칠 때)은 상대 코드의 `opp.element`=내 본체라 그대로. 잔류장(`statusSelf`)·기본 공격·시그니처는 `sk.el` 이 없어 본체 속성 그대로. 풀 흡수/보호막·고위력 부가효과·`gate` 확률 경로(#96) 불변 | §2.4 |
| 6 | `finishByCapture` | `skills: loseP.skills ? loseP.skills.slice() : archSkills(arch,el)` — 대상의 실제 4슬롯 복사(참조 비공유), 기술 배열 없는 레거시 대상만 템플릿 폴백. HP 70/100 · 20/30/CD2 · `cds [0,0,0,0]` · `revealedSkills []` · `artRosterId` 그대로. `tryCapture`(중립 숲 포획) 불변 | §2.8 · Issue 보완 계약 |
| 7 | 전투 AI 5급 `aiBattleAction` / 5단 `aiBattleActionStrong` | `multOf(el)` 로 기대 피해 상성을 기술별 판정 속성으로, `statusKey` 도 `atkElOf(f,sk)` 기준(+4 가산 규칙 유지). 상대 기대 피해(`oppEst`)는 상대 미공개 기술을 보지 않으므로 본체 속성 그대로(공정 관측). 보드 AI(`aiBattlePairScore`·`aiWinProb`)는 전투 전 추정이라 본체 속성 유지 | §2.7 |
| 8 | 전투 UI `battleModal` | 소유자 화면: 패널 기술 목록·커맨드 버튼에 `skillNameKo`(타 속성 공격기 `⚡감전 침`) · 버튼 title `desc + " · 번개 속성으로 판정"`. 상대 화면은 종전대로 `?공격기`·title 빈 문자열 | §2.5 · AC4 |
| 9 | 사이드 패널(자기 말 선택) | 기술 목록에 `skillNameKo` | UI |
| 10 | `modal()` 동기화 래퍼 | 비소유자(온라인 상대)는 원문 HTML 을 한 번도 쓰지 않고 잠금 화면만 그린다(종전에는 원문을 그린 뒤 덮어썼다 — 표시 결과는 동일, DOM 쓰기만 제거). 소유자 경로·seq·버튼 인덱스 중계는 불변 | §2.6 정보 경계 |

**바꾸지 않은 것** [확정]: 동료·왕 recruit 포획 분기 · 다른 이벤트 5종 · 2·1·1 슬롯 구조 · 로스터 스탯 · 잔류장 100% · 감전 침 shockProb 50%(잔불 표식 70%) · 레거시 속성 스킬 경로 · 온라인 프로토콜/메시지 종류 · 서버 · 아트 · 기획 문서. **템플릿 불일치는 임시 보조기 교체 때부터 있던 잠재 불일치이며 새로 발생한 것이 아니다**(계약 §2.8) — 6번에서 정합화했다.

### 테스트·도구 (제품 외)

| 파일 | 변경 |
|---|---|
| `demo/test/harness.js` (+4) | 노출 심볼 추가: `applyAction`·`netPump`(온라인 수신 경로)·`slotPow`·`dmgRange`·`SKIND_KO`·`ELEM_KO`·`ELEM_EMO`·`shuffle`, 그리고 `recruitCandidates`·`aiRecruitSlot`·`atkElOf`·`skillNameKo`·`recruitModal`·`SKILL_TIER_KO` 는 `typeof` 가드(기준판 로드 호환) |
| `demo/test/smoke_shock.js` (2행) | A7: 관련 기술 JSON 단언에 `el`·`tier` 필드만 추가(위력·쿨·플래그 값 불변) · J3 음성 대조 앵커 `f.element==="fire"` → `atkEl==="fire"` (변형 의미 동일). 그 외 63단언·음성 대조 그대로 |
| `demo/test/smoke_cross_skill.js` (신규 114단언) | A~L 절(2장 표 참조). 파일 쓰기 0 — 기준판·변형은 메모리 로드 |
| `demo/test/issue92_cdp.js` (신규) | 실제 Chrome(CDP·실제 마우스 클릭) + 실제 릴레이 서버 2클라이언트 20측정·스크린샷 5장. `--read-only` 시 산출물 0 |
| `docs/qa/issue92/` | 스크린샷 5장 + `issue92_cdp_report.json` |

---

## 2. 계약 대조 (규격 §2 AC · Issue 보완 · dispatch)

| 계약 | 구현·근거 (smoke_cross_skill 단언 / CDP 측정) | 판정 |
|---|---|---|
| AC1 하수인 recruit 소비 시 타 속성 공격기 1종 후보 모달(슬롯0/슬롯1/유지) | B1·B2·B3·B4·B14(200시드 전수) / CDP 1b | [확정] |
| AC2 교체 후 `skills[slot]`=후보·`cds[slot]` 승계·`revealedSkills`에서 slot 제거 | B7·B8·B9·B11 / CDP 1c(쿨 [2,1,0,0] 유지·공개 [0,1]→[1]) | [확정] |
| AC3 불 하수인의 `lightning_effect` → 물 ×1.3·감전·화상 아님 / 물이 불 본체를 칠 때 불로 판정 | D1(29·감전) · D1b(대조 17·화상) · D2(풀에 17) · D3(물대포 34)·D3b(덩굴 20) / CDP 2b(29 피해·감전·⚡감전1R) | [확정] |
| AC4 상대 화면 `?공격기` 유지 | E2·E2b·I2 / CDP 3d | [확정] |
| AC5 온라인 두 클라이언트 `skills`·`cds` 동일 | H1~H10(헤드리스 2인스턴스: 슬롯0·슬롯1·유지·포획, rand 일치, 음성 H11) / CDP 3c~3k(**실제 서버·실제 2탭·실제 클릭**: 3회 탐색 모두 skills·cds·공개·seq·난수 일치, 포획 승계 양측 동일) | [확정] |
| AC6 AI 규칙 동일 시드 동일 결과 | C1~C7(정책 표) · C8(60시드 결정론·정책 일치) · C9(난수 미사용) | [확정] |
| AC7 동료·왕 포획 분기·다른 이벤트 무변경 | G1~G8 | [확정] |
| AC8 임시 보조기 교체 제거 후 회귀 통과 | 기존 8스모크 754/754 + K1(기준판에만 임시 문구) · K2(recruit 없는 5경기 기준판과 로그·지표 완전 일치) | [확정] |
| AC9 포획 승계: `water_stable` 배운 불 하수인 → `reserve.skills[0]==="water_stable"`·`element==="fire"`·`cds` 전부 0·`revealedSkills []`·참조 비공유 · 무교체 포획은 종전과 동일 | F1·F2·F3·F5(템플릿 동일·비공유)·F6(레거시 폴백)·F7(중립 포획 불변)·F8(대리 출전 시 물 판정) / CDP 3j | [확정] |
| 감전 침 배워도 shockProb 50%·잔불 표식 70%·잔류장 100% | D4a~D4d(확률 경로 분리) · D5(1000회 46.9%가 아니라 이 파일 기준 45~55% 창) · D5b(65~75%) · D6·D6b(잔류장 100%·판정 난수 0) | [확정] |
| 풀 흡수/보호막·고위력 부가효과 유지 | D7a~D7d | [확정] |
| 기본 공격·시그니처·레거시는 본체 속성 | D8a·D8b·D8c·D10 | [확정] |
| 속성 플래시는 판정 속성 | D9 | [확정] |
| 전투 AI 상태 키·기대 피해 = 기술 속성 (5급·5단) | L8a·L9a(5단 결정 케이스)·L9c(5급 60시드 선택률) + 음성 L8b·L9b·L9d | [확정] |
| 보드 로그 generic · 상대 DOM/title/aria/URL/로그에 새 기술 노출 없음 · 사용 후에만 공개 | B6·I1~I4 / CDP 3d·3h(W 의 오버레이 변이 기록·body HTML 증가 0·title·aria·URL·로그·송신 0) | [확정] |
| 제품 문구에 개발 필드명·동기화 용어 없음 | E6·E7 / CDP 1b·3c `devWords=false` | [확정] |
| 신규 메시지 없이 기존 search 락스텝·공유 rand·modal seq 사용 | H1(search 1프레임)·H4(modal seq·i 프레임) / CDP 3c(송신 2 = 선택+탐색) | [확정] |
| 음성 대조 | L1~L7·L8b·L9b·L9d·H11·K3: 계약을 어기는 변형 10종을 메모리에서 로드해 검사기가 잡는지 확인 | [확정] |

---

## 3. 검증 — 명령 · 개수 · 결과 (Mars 자기 검증, Node v24.16.0, 저장소 루트)

### 3.1 헤드리스 회귀 (기존 8 + 신규 1)
```
node demo/test/smoke_cycle5.js          # 69
node demo/test/smoke_memo.js            # 49
node demo/test/smoke_online.js          # 157
node demo/test/smoke_minion_art.js      # 199
node demo/test/smoke_tutorial.js        # 124
node demo/test/smoke_testclient.js      # 41
node demo/test/smoke_shock.js           # 65  (감전 침 1000회 469/1000 = 46.9%)
node demo/test/smoke_attack_balance.js  # 50
node demo/test/smoke_cross_skill.js     # 114 (신규)
```

| 구분 | 기준 dev d614392 | 이번 | 차이 |
|---|---|---|---|
| 기존 8스모크 | 754 / 754 | **754 / 754** | 0 (smoke_shock A7·J3 는 계약 필드 정정만, 개수 동일) |
| 신규 `smoke_cross_skill` | — | **114 / 114** | +114 |
| **합계** | 754 | **868 / 868 PASS** | +114 |

### 3.2 신규 회귀 `smoke_cross_skill.js` (114)
| 절 | 내용 | 단언 |
|---|---|---|
| A | 공격기 12종 `el`·`tier`, 후보 목록 9/7종·순서, 판정 속성·표시 이름 | 6 |
| B | 실제 search 액션 경로: 모달 내용·버튼·rand 1회·슬롯0/1 교체·유지·쿨 승계·공개 제거·로그 generic·200시드 전수·레거시 | 15 |
| C | AI 정책 표(표준/방어 불·물/지속/공격/속공/동률)·60시드 결정론·난수 미사용 | 9 |
| D | 판정 속성(상성·상태·확률·잔류장·부가효과·기본/시그니처/레거시·플래시·공개) | 24 |
| E | 소유자/상대 전투 UI·사이드 패널·로스터 팝업·문구 | 9 |
| F | 포획 승계 AC9(복사·비공유·쿨0·공개[]·수치·레거시·중립·대리 출전 판정) | 8 |
| G | 동료·왕 recruit·다른 이벤트 5종·AI 동료 포획 불변 | 8 |
| H | 온라인 2인스턴스(연결 소켓 스텁·실제 send 계측): search 프레임·seq·마스킹·슬롯0/1/유지·rand·포획·음성 | 12 |
| I | 정보 경계(2P 모든 요소 innerHTML·text·속성·로그) · 사용 전 ?공격기 · 사용 후 공개 | 4 |
| J | AI vs AI recruit 강제 4경기 완주·불변식 0·실제 학습 발생 | 2 |
| K | 기준판 d614392 메모리 대조: 임시 문구 확인·recruit 없는 5경기 완전 일치·recruit 에서 갈라짐 | 4 |
| L | 메모리 변형 음성 대조 13종(판정 속성·쿨 초기화·공개 유지·shuffle·템플릿·참조 공유·AI 정책·AI 상태 키·AI 기대 피해 5급/5단) | 13 |

### 3.3 실제 Chrome + 실제 릴레이 서버 (`node demo/test/issue92_cdp.js` — 20측정 · 문제 0 · 콘솔 오류 0)
- file:// PVE (desktop-1280): 시드 30 → 후보 감전 침. 실제 클릭(말 → [탐색] → [공격기 1과 교체]) → `skills=[lightning_effect,fire_effect,sup_heal,sig_std]`, `cds=[2,1,0,0]`, 공개 `[0,1]→[1]`, 로그 "플레이어 숲 이벤트 발생"만. 사이드 패널 `⚡감전 침(쿨2)`. 실제 클릭 전투(vs 물 표준형): 버튼 `⚡감전 침 22` · title `50% 확률 감전(후공 1회) · 번개 속성으로 판정`, 잔불 표식 title 그대로. [⚡감전 침] 클릭 → 물 HP 100→71(**22×1.3=29**), 감전 1R, 화상 0, 상태 아이콘 ⚡감전1R. (`dmgVar 0`·`shockProb 1` 은 이 표본 1회를 결정적으로 만들기 위한 페이지 내 고정 — 확률 자체는 3.2 D5 로 잰다)
- 온라인 HTTP (`PORT=0` 검증 전용 서버, 실제 코드 인증, 2탭 실제 매칭): 행동 측 X(P1) 실제 클릭 탐색 → 송신 2(선택+탐색) → X 후보 모달(가시 폭발) / 대기 측 W(P2) 잠금 화면 — W 오버레이 변이 기록 2건(잠금 문구뿐)·body HTML 후보 이름 수 1→1(증가 0, 1은 W 자기 로스터의 같은 이름)·title·aria/title 속성·URL·로그 0·W 송신 0. [공격기 1과 교체] → 양측 `sk/cds/rev/seq` JSON 동일·다음 `rand()` 동일. 2회차 덩굴 채찍 → [공격기 2와 교체] → 두 슬롯 모두 풀(타 속성). 3회차 전기탄 → [유지] → 기술 불변·seq 3. 포획: W 하수인이 실제 클릭으로 전투 개시 → 같은 시드 1 → 실제 [🔴 볼 투척] → 양측 `S.reserve[1]` 동일 `{skills:[grass_heavy,grass_stable,sup_heal,sig_std], cds:[0,0,0,0], rev:[], hp:70/100, el:fire, art:M-F1, atk:20, alias:false}`, 대상 제거, 이후 난수 동일, W 사이드 패널 "예비 하수인(불) HP 70/100".
- 스크린샷: `docs/qa/issue92/1-pve-recruit-modal.png`(후보·현재 공격기 비교 모달) · `2-pve-battle-buttons.png`(⚡감전 침 버튼·패널) · `3-pve-cross-skill-hit.png`(29 피해·감전) · `4-online-actor-recruit-modal.png`(X 모달) · `5-online-waiting-view.png`(W 잠금 화면, 로그는 "상대(P1) 숲 이벤트 발생"뿐)
- 보고서: `docs/qa/issue92/issue92_cdp_report.json` (2026-09-07T12:02:47Z)

### 3.4 Saturn `--read-only` 재실행 경로 (산출물 0)
```
node demo/test/smoke_cross_skill.js        # 파일 쓰기 0 (기준판은 git show 읽기만 · 변형은 메모리) · [BASE_REF=<ref>] 로 기준 커밋 변경 가능
node demo/test/issue92_cdp.js --read-only  # 스크린샷·JSON 없음, stdout 만 · 임시 Chrome 프로필(os.tmpdir()/cross92cdp-*)과 PORT=0 서버만 생성·정리
```
확인: `--read-only` 실행 전후 `docs/qa/issue92` 의 `ls -l --time-style=full-iso` 지문(md5) `3917130b…` 동일 · 파일 6개 그대로 · 20/20 PASS. 헤드리스 파일 안에 `mutant HTML`·캡처를 파일로 쓰는 경로는 없다(`H.load(htmlPath,{html})` 메모리 로드).

---

## 4. 한계 · 미확정 · [기획 필요]
- [미확정] 사람 플레이 체감(교체 선택 빈도·타 속성 조합의 밸런스)은 CJ 플레이 QA 몫이다. AI 정책은 계약 §2.7 문자 그대로 구현했고 그 정책의 밸런스 효과는 재지 않았다.
- [미확정] 보드 AI(전투 전 승률·전투 쌍 점수)는 본체 속성 그대로다. 계약이 "전투 AI(5급·5단)"만 지정했고 상대 기술은 비공개라 본체 속성이 공정 관측의 근사다. 자기 하수인의 배운 기술을 보드 단계 승률 추정에 반영할지는 [기획 필요].
- [미확정] CDP 실측은 headless Chrome desktop-1280·file:// 와 127.0.0.1 HTTP 만이다. 모바일 뷰포트·wss·LAN 원격은 재지 않았다.
- [추론] `modal()` 래퍼의 비소유자 원문 미기록(1장 10번)은 표시 결과를 바꾸지 않는다 — smoke_online 157·smoke_minion_art 199·smoke_memo 49 그대로 통과, CDP 3d 에서 잠금 화면 확인. 다만 이 변경은 다른 동기화 모달(포획 선택 등)의 비소유자 화면에도 적용된다(같은 잠금 문구).
- [추론] `recruitCandidates` 는 최소 7종이라 "후보 없음" 안내 분기는 도달하지 않는다(방어 코드).
- 문서 반영은 PD 집행: 규격 §7 표의 #92 행(GDD-13 3장·4.7·4.8, GDD-16 2장·5장, GDD-14 D15).

---

## 5. 최종 SHA256 (작업공간 상대 경로)

| 파일 | SHA256 |
|---|---|
| `demo/index.html` (3149행) | `500bb4130eee93344faaa7dee096a166636fa3d16ca80842ddaaa48ae68346d5` |
| `demo/test/harness.js` (267행) | `0224af3103021a234de00c32685de9b61aad4f09247a0ecea099d09846f5b932` |
| `demo/test/smoke_shock.js` (241행) | `6db34bf0caccdacd616a4cb5b32cd6f3f37f97a37ad9be0499156cb0ac512a27` |
| `demo/test/smoke_cross_skill.js` (420행, 신규) | `c37c6e2dbe1ae46eeba9bef38341cf5e695d0b3e60b0d65726ce7db90100be2a` |
| `demo/test/issue92_cdp.js` (259행, 신규) | `04545d72f386675bc1c4f7220ba93a83d86aa82ce977eb8485f96a0eefdbe3ef` |
| `docs/qa/issue92/issue92_cdp_report.json` | `9a4b5e3b2eec745dc6419313f18e91f896e4e4582b6c7d7436c8ac32b03bee97` |
| `docs/qa/issue92/1-pve-recruit-modal.png` | `7a4fe20ecfe9adfaa247962febd1b6145796395f52b3e377e5f1eb270d626cc3` |
| `docs/qa/issue92/2-pve-battle-buttons.png` | `9ecbff74dcea1dd57305a21c1fce86b40939180f2b170eb84e735a132bdc9971` |
| `docs/qa/issue92/3-pve-cross-skill-hit.png` | `8d23f17bd7f228f6e59ea3cf219e1d448c863512f3b57b75f9a192d2b874adbd` |
| `docs/qa/issue92/4-online-actor-recruit-modal.png` | `2d99d96c032345939300ee07dee38e2aab47c03aa12c19ea09c8e8117267040a` |
| `docs/qa/issue92/5-online-waiting-view.png` | `296397daa0c1d1895d3b59c35fbee6bf01155962c5018b98ec26290274cad95b` |

git numstat (base d614392, 이 납품분만): `demo/index.html` +85/−46 · `demo/test/harness.js` +4/−0 · `demo/test/smoke_shock.js` +2/−2 · 신규 `demo/test/smoke_cross_skill.js` · `demo/test/issue92_cdp.js` · `docs/qa/issue92/`(6) · `docs/qa/issue92-mars.md`.
