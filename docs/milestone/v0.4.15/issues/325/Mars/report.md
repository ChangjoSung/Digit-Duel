# #325 배틀 스텟 구현 보고 (#326 · #327 · #328 · #329) — Mars

- 작성: 2026-10-04 · Mars_Client(단일 인스턴스) · 기준 `origin/milestone/v0.4.15` HEAD `f57c936` · 계약 [Venus spec](../Venus/spec.md)
- 상태: **구현 · 자체 검증 완료, Saturn 독립 QA 전**. Git stage/commit/push · GitHub · Notion 쓰기 없음. 서버 파일(`server/`)은 건드리지 않았다(Jupiter 소관).

## 요약

1. **#326** 전투 카드 여섯째 칸을 "왕국 효과 발동률"로 바꿨다. 공용 헬퍼 `kingdomProcView(f)`가 `v2Apply`와 같은 식(`statusProcP`) 하나를 읽는다. 난수 · 판정 순서 · 전투원 값은 그대로다.
2. **#327** 라운드 줄 상성표 버튼 왼쪽에 "스텟" 버튼과 `하수인 스텟` 설명 창(6행)을 붙였다. 기존 안내 창 틀을 그대로 쓴다.
3. **#328** 성장 표를 정수 % 로 바꿨다(HP 100/135/175/225 · 공격력 100/125/155/190). 전설은 270/50 · 257/46 · 244/58 이다.
4. **#329** 말 정보 창의 폭탄 · 함정 문장 두 개와 그 주석만 바꿨다. 튜토리얼 · 로그 · 토스트 · 규칙은 그대로다.
5. 헤드리스 회귀 38개 파일이 마지막 실행 기준 전부 exit 0 이다. 계약 변경으로 기대값이 달라진 5개 파일은 새 계약값으로 고쳤다.
6. 실제 Chrome 렌더(320×568 · 390×844)에서 24개 확인이 통과했다. 그 과정에서 **320 폭 결함 2건을 찾아 CSS로 고쳤다**(여섯째 칸 넘침 · 버튼이 둘이 된 줄 넘침).
7. 확정 계약 표로 좁게 다시 잰 전투 비교(2,368판)는 예비 측정과 같은 방향이다. 승인 목표에 어긋나는 측정은 없었다.
8. 남은 것: Saturn QA, PR 필수 CI(여기서는 통과를 주장하지 않는다), CJ Image 1 대조(이미지를 구하지 못해 하지 않았다), 아래 §5의 미실행 검사.

## 1. 바꾼 것

| 파일 | 내용 |
|---|---|
| `demo/js/data.js` | `GRADE_HP_PCT` · `GRADE_ATK_PCT` 표와 `gradeHp` · `gradeAtk`(`round(값 × % ÷ 100)`, 등급은 1~4로 자름) · `LEGEND_BASE` HP/공격력 3종 · `statusProcP(f, prob)` 추출 · `kingdomProcView(f)` 신설 · `v2Apply`가 `statusProcP`를 부르게 함 |
| `demo/js/network.js` | `kingdomProc` 닫힌 값 검증(`NET_KP_KINDS`) → 전투원 `kp`. `effectiveStats` 6칸 처리는 그대로 |
| `demo/js/ui.js` | `BSTAT` 5칸 + `battleKpHtml`(여섯째 칸) · `KP_KO` · 스텟 버튼 · `battleStatHelpOpen` · `BSTAT_HELP` · 바깥 누름 초점 복귀 조건에 스텟 창 추가 · `UNIT_NOTE` 두 문자열과 주석 |
| `demo/css/game.css` | 스텟 버튼 모양 · `.bStats` 셋째 열 1.2fr · 360px 이하에서 이모지 아이콘/여섯째 칸 글자 9px, 라운드 줄 간격 4px와 대기 배지 말줄임 |
| `demo/test/shared/harness.js` | `kingdomProcView` · `statusProcP` · `battleStatHelpOpen` 노출 |
| `demo/test/regression/smoke_issue233.js` · `234` · `235` · `316` · `smoke_memo.js` · `smoke_public_rooms.js` | 아래 §3 |
| `demo/test/reports/grade_compare.js` | 전설 계산을 계약 방식으로 정정 · 표 이름 정리 · 한정 부분집합 S · L 절 |
| `demo/test/milestone/v0.4.15/issues/325/issue325_cdp.js` | 실제 브라우저 렌더 확인 도구(신규) |
| `demo/test/README.md` | 도구 두 줄 |
| `docs/milestone/v0.4.15/issues/325/Mars/grade-comparison.md` · `report.md` | 정정 재검증 부록 · 이 보고서 |

### 계약과 맞춘 지점
- **한 식**: 왕국 판정은 `v2KingdomProc → v2Apply → statusProcP`, 표시는 `kingdomProcView → statusProcP`다. `min(1, 표기 + statusPct + synStatusPct)` 뒤에 모래 폭풍 ×0.5. `core.js`의 레거시 `tryStatus` · `gate`(왕국 판정이 아닌 구형 스킬 경로)는 건드리지 않았다.
- **세 상태**: `active`(= `f.synEl` 있음) · `inactive`(전설이면 용, 아니면 속성 있음) · `none`(그 밖 — 마녀 · 사신). `applySynergy`의 수혜자 규칙과 같은 조건이다.
- **회선**: `active`는 종류 5종 + 유한한 `p`(0~1)만, `inactive`/`none`은 `kind` · `p`가 없거나 null일 때만 통과한다. 어긋나면 값 없음 → `—`. 서버 값을 쓰는 전투원(`eff` 있음 · 공개 방)은 로컬 `synEl`로 메우지 않는다.
- **표시**: 정수면 `55%`, 아니면 소수 한 자리(`27.5%`). 종전 `+N%p`는 0보다 클 때 이름/title 끝에만 ` · 기술 효과 +N%p`로 붙는다.
- **성장**: 정수 % 로 나누므로 .5 경계 9칸이 전부 올림이다. 종전 식이 내리던 두 칸(공격형 ⭐2 HP 103 · 보호형 ⭐2 HP 126)은 새 표에서 122 · 149 다.
- **바꾸지 않은 것**: 방어 · 속도 · 회피 · 치명타 · 💫 · 시작 방어막 · 스킬 해금 · 낮은 등급 선턴 · 가격 · 보상 · 왕/동료 스탯 · 말 정보 창 8칸의 `상태 부여 +N%p` · `SYN_STAT_KO`.

### 확인만 한 것 (spec §3.6 · §1.6)
- `ai.js`에 등급 배율 사본은 없다. `gradeHp`/`gradeAtk` 호출처는 `data.js`와 `ui.js`(`unitHp` 표시)뿐이고 `server/`에 사본이 없다 [확정 · 코드 검색].
- `roblox/src`에는 등급 성장식이 없다(검색 0건). Roblox 쪽 반영 여부는 이 Task 범위 밖이다.
- 오프라인 여섯 칸 중 앞 다섯 칸의 식(`effAtk` · `def+synDef` · `effSpd` · `effEvade` · `min(50%, crit+synCrit)`)은 기존 회귀 R3-②a가 그대로 통과한다. 서버 `effectiveStats`와의 대조는 Jupiter 서버 검사 몫이다.

## 2. 실제 브라우저 확인

- 명령: `node demo/test/milestone/v0.4.15/issues/325/issue325_cdp.js` — 마지막 실행 **pass 24 / fail 0 · exit 0**. 헤드리스 Chrome, 임시 프로필은 실행마다 생성 후 삭제됐다(CLEANUP 출력 확인). 테스트 서버는 띄우지 않았다(`file://`).
- 스크린샷 10장(저장소 밖): `C:/Users/pc_77/AppData/Local/Temp/digitduel-issue325-evidence/`
  - `battle-320x568.png` · `battle-390x844.png` — 여섯 칸(내 쪽 55% · 상대 미활성)
  - `battle-sandstorm-320x568.png` · `-390x844.png` — 모래 폭풍 절반 27.5%
  - `stathelp-320x568.png` · `-390x844.png` — 스텟 설명 창
  - `unitinfo-bomb-*.png` · `unitinfo-trap-*.png` — 폭탄 · 함정 말 정보 창
- 확인 항목(폭마다 12개): 폭탄/함정 창 문장 · 여섯 칸 넘침 없음 · 55%/미활성 이름 · 27.5% · 버튼 44px와 위치 · 가장 긴 줄(`⏳ 상대 응답 대기` 배지) 넘침 없음 · 창 제목/6행/✕/초점 · Tab 가둠 · 바깥 누름(상성표 버튼 위 — 상성표가 열리지 않고 창만 닫힘) · Esc · 다시 그리면 닫힘.
- 실행 이력 5회(숨기지 않는다): ① 개시 연출이 끝나기 전에 눌러 3건 실패 + 스크립트 오류 → 대기 조건 수정. ② 4건 실패 — **320 폭 여섯 칸 넘침 · 줄 넘침은 실제 결함**, 1건은 창에 가려진 버튼을 누른 스크립트 문제. ③ 진단 출력 추가 후 3건 실패(같은 결함 수치 확인: `미활성` 47px > 43px, 줄 308px > 264px). ④ CSS 수정 뒤 24/0(스크린샷 없이). ⑤ 스크린샷 생성 24/0.
- 한계: 전투 장면은 페이지 안 제품 함수로 직접 세웠다(로비 · 상점 · 배치 경로 아님). 오프라인 PVE 한 장면이다. 공개 방 화면(서버 `kingdomProc`)은 헤드리스 회귀로만 봤다. 실기기 · 다른 브라우저는 보지 않았다. **CJ Image 1 · 콘티 대조는 하지 않았다** — 이슈 본문에서 이미지 주소를 찾지 못했다.

## 3. 회귀

### 고친 기대값 (규칙을 되돌리지 않음)
| 파일 | 변경 |
|---|---|
| `smoke_issue233.js` | A2: 6 아키타입 × 4 등급 정수표 전체(.5 경계 9칸 포함) · A3 등급 범위 자름 · B10~B12 전설 새 값 · B12b 전설 = ⭐4 정수 × 120% 재반올림 |
| `smoke_issue234.js` | 전설 스탯 표 · B2(⭐4 표준형 225/42) · B4(사신 244/58) |
| `smoke_memo.js` | D4z: "튜토리얼 문장과 글자 일치" 요구를 없앴다. 종류 줄 · 규칙 한 줄(폭탄 ≠ 함정) · HP/스킬 없음은 유지. 두 문자열을 그대로 베낀 검사는 넣지 않았다 |
| `smoke_public_rooms.js` | P3 여섯째 칸 기대 이름 · P3b(회선 → 화면, 덧붙은 칸 버림) |
| `smoke_issue316.js` | R3-②a/c 여섯째 칸 · ②d에 `kp`/`synEl` 부재 |

### 새로 넣은 검사 (전투 · 회선 · 상호작용 불변식만)
- `smoke_issue235.js` K12~K18: 헬퍼의 `p`가 **실제 왕국 판정의 경계**와 같다. 난수를 `p` 바로 아래/위로 고정하고 실제 경로(`act → v2SkillSettle → v2KingdomProc → v2Apply`)의 발동이 갈리는지 본다 — 가산 0(70%) · 기본+시너지(85%) · 상한(100%) · 상한 뒤 모래 폭풍(50%). 헬퍼 호출의 난수 소비 0 · 전투원 불변. inactive · 용(active/inactive) · 마녀/사신(none).
- `smoke_issue316.js` R3-②e~h: 여섯째 칸의 네 표시가 서로 다른 글자 · 이름 · 표시 전용, `kingdomProc` 정상 5종과 비정상 16종. S1~S5: 스텟 버튼 위치 · 창 6행 · 송신 0 · 전투 상태 불변 · 바깥 누름/Esc 초점 복귀 · 다시 그리면 닫힘.

### 실행 기록 (출력과 종료 코드를 같은 실행에서 수집)
| 단계 | 대상 | 결과 |
|---|---|---|
| 1차 · 각 1회 | 회귀 34개 파일(CI 잡 A의 `regression/` 목록에서 아래 미실행 3개 제외) | 29 exit 0 · 5 exit 1(계약 변경으로 예상된 `smoke_memo` · `smoke_public_rooms` · `233` · `234` · `316`) |
| 2차 · 수정한 파일만 | `smoke_memo` 129 · `smoke_public_rooms` 213 · `233` 307 · `234` 354 · `316` 65 · `235` 129 | 6개 전부 exit 0 · fail 0 |
| 3차 · CSS 수정 뒤 | CSS/전투 줄을 읽는 9개(`236` · `238` · `245` · `260` · `286` · `293` · `295` · `316` · `public_rooms`) + 아직 안 돌린 4개(`issue122_rules` 99 · `back_nav` 122 · `smoke_fx_timing` 82 · `smoke_orientation_audit --path demo/index.html` 8920) | 13개 전부 exit 0 |
| 정적 검사 | `npm run typecheck`(UI 수정 전후 2회) · `npm run test:typecheck`(72 passed) | exit 0 |
| 문서 링크 · 1회 | `node tools/docs/docs_link_check.js`(문서 424개 · 내부 링크 1,710건 · 문제 0건) | exit 0 |

- 다시 돌린 이유는 둘뿐이다: 기대값을 새 계약으로 고쳤다(2차), 320 폭 결함을 CSS로 고쳤다(3차).
- `npm ci`로 잠금 파일의 typescript 1개를 이 작업 트리 `node_modules`(gitignore 대상)에 설치했다. 새 의존성은 없다.

## 4. 등급 비교 정정 재검증

- 예비 도구는 사신 전설을 243/57(반올림 1회)로 쟀다. 계약은 244/58(⭐4 정수 × 120% 재반올림)이다. 도구를 계약 방식으로 고치고 자기검사가 `LEGEND_BASE`까지 대조하게 했다.
- 명령: `node demo/test/reports/grade_compare.js --only S,L --n 32 --seed 32800` — **2,368판 · exit 0 · 1회**(칸당 64판 = 개시자 2 × 짝 시드 32).
- 결과와 한계는 [grade-comparison.md 부록 C](grade-comparison.md)에 있다. 요지: 실제 스킬 표준형 2v3 60.9 → 96.9%, 역상성 낮은 쪽 승률 14.1 / 82.8 / 54.7%, 전설 vs 대응 ⭐4 98.4 / 98.4 / 92.2%. 칸당 64판이라 반폭이 최대 약 ±12pt인 **방향 확인**이다.
- 예비 본문 · 부록 A · B는 그대로 보존했다.

## 5. 하지 않은 것 · 남은 위험

| 항목 | 이유 |
|---|---|
| `smoke_ai_completion.js`(AI vs AI 완주 게이트) | Task가 전체 AI 경기 실행을 금지했다. PR CI에서 처음 돈다 — 성장 표가 완주 결과를 바꾸는지 **미확인** |
| `smoke_cross_skill.js` | 내부에서 `git show`로 기준판을 읽는다. Worker의 Git 명령 금지 범위라 돌리지 않았다 |
| 서버 회귀 · 실서버 통합(`server` `npm test` · `smoke_public_live` · `smoke_public_eco_live`) | Jupiter 소관. 코디네이터가 서버 검사 통과를 알려 왔으나 내가 확인한 것은 아니다 |
| CI 잡 D(아트) · E(Roblox) | 바꾼 파일과 무관 |
| PR 필수 CI 6개 | PR이 없다. 통과를 주장하지 않는다 |
| CJ Image 1 · 콘티 대조 | 이미지 미확보 |
| 속도 높은 쪽이 2자리 %(예: 회피 40%)인 320 폭 장면 | 대표 장면에 없었다. 360px 이하에서 이모지 아이콘을 9px로 줄여 여유는 종전보다 늘었다 |

- **320 폭 대기 배지**: 버튼이 둘이 되면서 `⏳ 상대 응답 대기`가 360px 이하에서 말줄임(`…`)될 수 있다. 문구는 바꾸지 않았다. 다른 처리를 원하면 [기획 필요].
- **왕 · 동료**: 수치는 [grade-comparison.md §5.5](grade-comparison.md)에 기록만 했다. 바꾸지 않았다.
- **공개 범위**: 여섯째 칸은 발동률 합계 · 효과 종류 · 상태만 싣는다. spec §6의 "달성 단계를 역산할 수 있다"는 사실은 그대로 남는다.

## 6. PR 전에 돌 필수 CI 명령 (기록 — 여기서 통과를 주장하지 않는다)

- A: `npm ci` · `npm run typecheck` · `npm run test:typecheck` · `.github/workflows/ci.yml` 127~228행의 회귀 목록(`smoke_ai_completion.js` · `smoke_cross_skill.js` 포함)
- B · B2: `server`에서 `npm ci` · `npm test` · `node demo/test/integration/smoke_public_live.js 2` · `node demo/test/integration/smoke_public_eco_live.js` · `node test/test-launcher.js`
- C: `node tools/docs/test/docs_link_check_test.js` · `node tools/docs/docs_link_check.js --verbose` · `node tools/media/readme_media_capture.js selfcheck`
- D · E: 아트 무결성 · Roblox Luau(변경 없음)
