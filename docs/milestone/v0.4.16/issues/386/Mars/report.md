# #386 v0.4.16 README 플레이 사진 8장 — Mars 촬영·구도 보완 감사 보고

- 1차 촬영: task_939638aaaef9 / ctx_a1dd55003b4d · 2026-10-28 (KST). 원문은 artifact `Mars-Report.original.md`와 커밋 `431d9cb`에 보존돼 있다.
- 구도 보완: task_93050522f0f0 / ctx_511ec36e01ed · 2026-10-28 (KST). Saturn 구도 REVISE 3건(01 하단 비네트 · 06 시너지 칩 잘림 · 05 가방 슬롯 화면 밖)을 촬영·프레이밍만으로 고쳤다. 03~08의 기록은 이 단계 그대로다.
- **CJ README QA REVISE — 01·02 전체 화면 복원(01·02의 현재 상태)**: task_bee92d4f86a8 / ctx_9d879241a827 · 2026-10-28 (KST). 작업 공간 `doc-386-readme-fullscreen`, HEAD `acac1c279335969d0c37d373bbf52d96f9b37416`(= `origin/milestone/v0.4.16`, `.git` 파일 직접 읽기). 실행 Mars, Claude Code `claude-opus-5-5` · effort high · `--dangerously-skip-permissions`(argv 실측 PID 33388) · Ponytail full · Mercury GO 수신 뒤 작업. CJ는 구도 보완의 01(390×844 중 clip 390×654)·02(뷰포트 390×654)가 실제 화면 규격이 아니고 하단이 잘려 보인다고 REVISE했다. 그래서 두 장을 390×844 CSS · DPR 2 **전체 뷰포트**(780×1688 PNG) 원판으로 되돌렸다. 앞 단계의 "01 하단 비네트 제거"는 더 이상 목표가 아니다. 01 아래쪽 어두운 배경은 제품 타이틀 화면의 실제 일부라 그대로 둔다. **재촬영하지 않았다**: 같은 제품의 기존 원판을 바이트 그대로 복사했다(아래 1·3절). 바꾼 파일은 PNG 2장(01·02)과 이 보고서뿐이다.
- (구도 보완 이력) 실행: Mars, Claude Code `claude-opus-5-5` · effort high · `--dangerously-skip-permissions` (argv 실측, PID 32924) · Ponytail full. 코디네이터 GO 수신 뒤 촬영했다. fixture 2건(아래 3절)은 코디네이터 응답(`Q1A Q2A`)과 05/07 짝 높이 선택(`A`)을 받은 뒤 진행했다.
- (구도 보완 이력) 범위: 그 단계에서는 PNG 6장(01·02·05·06·07·08)과 이 보고서만 바꿨다. 03·04 PNG, README 본문, milestone README, 제품 demo/server/tools/test/config/자산/CSS/DOM, 검증 도구, Git, GitHub·Notion·Render는 건드리지 않았다. README QA 판정은 하지 않는다. 현재 CJ REVISE의 범위는 01·02 PNG 2장과 이 보고서뿐이다(바로 아래 항목).

## 1. 결과물

사진마다 해상도가 다르다. README는 두 칸 표에서 같은 너비로 보여 주므로 표시 높이는 가로세로 비율이 정한다.

| README 위치 | 파일 | px | bytes | SHA-256 | 상태 |
|---|---|---|---|---|---|
| 1행 왼쪽 | `docs/screenshots/v0.4.16/01-login.png` | 780×1688 | 1067960 | `430b223e6d25112fff0354a66a7f9610c42a72d77f98511f6892b12d16a3598f` | CJ REVISE로 전체 뷰포트 복원 |
| 1행 오른쪽 | `docs/screenshots/v0.4.16/02-main-lobby.png` | 780×1688 | 1364740 | `3692013cee07a546c1b62608d1e5d5bd7be0b2b19fd36f4dedd662c73fd70275` | CJ REVISE로 전체 뷰포트 복원(1차 02와 바이트 동일) |
| 2행 왼쪽 | `docs/screenshots/v0.4.16/03-public-rooms.png` | 780×1688 | 803042 | `5a96a76ef45d23942ad1b93c397637d752f5ff1ed88bf9193e301a513ba2d634` | 변경 없음 |
| 2행 오른쪽 | `docs/screenshots/v0.4.16/04-waiting-room.png` | 780×1688 | 923179 | `e8eb5f8bc63409da253b64c5627da7b61fde98c674db29fc174204ee940c4539` | 변경 없음 |
| 3행 왼쪽 | `docs/screenshots/v0.4.16/06-strategy-board.png` | 860×1864 | 1262466 | `04157469ce0278496f9bc449ab48b7e7f2ebe47daf48734c8151e62490f1d91d` | 교체 |
| 3행 오른쪽 | `docs/screenshots/v0.4.16/08-element-battle.png` | 860×1864 | 1266655 | `f62293aed22fd03114c6bf410e04e0918a9326407817d148854ae6124854a6ce` | 교체 |
| 4행 왼쪽 | `docs/screenshots/v0.4.16/05-start-shop.png` | 780×2908 | 1483920 | `7f5435981ff506954c3d23f16ffad09cba1017c5d2d8f4ce9941d29c37a88b1d` | 교체 |
| 4행 오른쪽 | `docs/screenshots/v0.4.16/07-turn-shop.png` | 780×2838 | 1223835 | `b4fb12b4860693c653f53d6d294ba344e78cea4c5f5621518abe6552904724cc` | 교체 |

**짝 높이**

| 짝 | 크기 | 표시 높이 |
|---|---|---|
| 01 로그인 / 02 로비 | 둘 다 780×1688 (390×844 전체 뷰포트, 세로/가로 2.164103) | 같다. README 1행은 두 칸 모두 `width="50%"` 칸에 `width="100%"` 이미지다 |
| 03 방 목록 / 04 대기실 | 둘 다 780×1688 (1차 그대로) | 같다 |
| 06 전략 보드 / 08 속성 전투 | 둘 다 860×1864 | 같다 |
| 05 시작 상점 / 07 턴 상점 | 780×2908 / 780×2838 | **다르다.** 05가 2.47% 더 길다 |

05/07의 높이 차이는 의도한 선택이다. 두 상점은 실제 스크롤 내용 끝까지 담았다. 합법 상태로는 05 전체 높이가 52 CSS px 단위(1402·1454·1506 …)로만 바뀌어 07의 1419와 같아질 수 없다. 코디네이터가 A안을 골랐다. 실제 상점 내용과 구매 상태를 지키고, 높이를 맞추려고 내용을 자르거나 여백을 붙이지 않는다. 코디네이터에 따르면 `README_RELEASE_STYLE`이 같은 높이를 요구하는 짝은 로그인/로비와 보드/전투이고, 상점 짝의 같은 높이는 PD의 추가 목표였다(Mars가 그 문서를 직접 읽어 확인한 것은 아니다).

원판과 probe는 `C:/Users/pc_77/orca/artifacts/Digit-Duel/readme-v0416-branch-alignment-20261028/Mars-Framing/shots/`에 있다. 납품본은 그 원판을 바이트 그대로 복사했다: 01=`p01-844` · 02=`p02-844` (CJ REVISE, 이전 납품 `p01-clip654`·`p02-654b`를 대체) · 05=`p05-full` · 06=`p06-430` · 07=`p07-full` · 08=`p08-430`. 1차 원판(`Mars/shots/`)·구도 보완 원판·helper는 덮지 않았다. CJ REVISE의 원판 영수증과 검사 helper(`pnginfo.js`·`treecmp.js`, 읽기 전용)는 artifact `CJ-REVISE-Login-Lobby/Mars/`에 있다.

## 2. 원본·환경 (구도 보완 이력 — CJ REVISE는 재촬영하지 않았다)

- 코드: 작업 공간 `doc-386-v0416-readme`, HEAD `431d9cb8a8257238fc7d24b03088086004a401cf` (시작 시 clean). 제품 runtime·source·자산·설정은 `a1fa420`과 같다(PD 지시 기준).
- 페이지: 수정하지 않은 `demo/`. 01·02는 Mars 소유 정적 서버(127.0.0.1 임의 포트, 읽기 전용, `/api/*`=503 `E_ACCOUNTS_DISABLED`, DB 없음)에서 열었다. 05~08은 `file:///…/demo/index.html` 오프라인으로 열었다.
- 브라우저: Google Chrome `Chrome/155.0.8059.85`, headless=new, UA `HeadlessChrome/155.0.0.0`. 격리 프로필(종료 후 삭제), `--hide-scrollbars --force-color-profile=srgb --lang=ko-KR`. CDP Emulation · DPR 2 · mobile. 뷰포트는 사진마다 아래 표와 같다. Node v24.16.0.
- 도구: 새 artifact `Mars-Framing/`에만 만들었다. `driver.js`·`cli.js`는 1차 helper 복사본이다. 포트를 9426/9427로 바꾸고 실행 중 뷰포트를 바꾸는 `/vp`를 더했다. `auto.js`는 1차 복사본에 "내 차례마다 이동 전에 보드를 찍는다"를 더했다. `fight.js`·`bottomcheck.js`·`blobcheck.js`는 그대로 복사했다. 측정용 `groups.js`·`tree.js`(읽기 전용)는 새로 만들었다. 1차 `Mars/` helper·로그·원판과 `tools/media/readme_media_capture.js`는 수정하지 않았다.

## 3. 사진별 촬영 방법·범위·fixture

**공통**: 실제 회원 E2E가 아니다. 서버·DB·계정·SMTP를 쓰지 않았고 외부 Production·QA 서버에 접속하지 않았다. 닉네임 `루나`와 전적은 가상 값이다. 이메일·사용자 ID·접속 코드·로그·DevTools·테스트 배지는 화면에 없다. `Math.random`은 고정하지 않았으므로 05~08의 진열·배치는 1차와 다르다. 모든 상호작용은 CDP 실제 마우스 클릭이다. 아래에 적은 함수 호출과 상태값 하나만 예외다. 캡처는 모두 `Page.captureScreenshot`의 clip(CSS px, DPR 2)이고, 사진 위에 아무것도 합성하거나 덧붙이지 않았다.

| 사진 | 뷰포트(CSS) | clip(CSS) | 진입·fixture | 사진 범위 |
|---|---|---|---|---|
| 01 로그인 (CJ REVISE) | 390×844 | 전체 뷰포트(x0 y0 390×844 = 화면 전체) | 1차와 같다. 계정 서비스가 켜진 첫 방문을 `AUTH.state="anon"; render(); acctRender()`로 재현했다. 원판 `p01-844`는 구도 보완의 01 세션에서 찍은 전체 뷰포트다. | 타이틀 묶음(문장 방패·`Digit Duel` 로고·미니 보드·`로그인`·`Google 로그인 — 추후 공개`)이 모두 들어 있다. Google 버튼은 y577..625에서 끝난다. 그 아래 y625..844는 제품 타이틀 화면의 실제 배경(바닥과 어두운 비네트)이며 자르거나 지우지 않았다. |
| 02 메인 로비 (CJ REVISE) | 390×844 | 전체 뷰포트(x0 y0 390×844 = 화면 전체) | 1차와 같다. `UI.entered=true; render()` 뒤 `LOBBY.profile=lobbyParseProfile({nickname:"루나",representativeMinion:"M-F2",stats:{wins:12,losses:7}}); LOBBY.prof="ok"; render()`. 원판 `p02-844`는 1차 납품 02(`Mars/shots/p02a`)와 SHA가 같다. | 프로필·도움말/설정/나가기·재화 2칸·미션/하루에 한 판·대표 화염 투사와 이름판·좌우 버튼·멀티/싱글플레이·하단 4탭(상점·하수인·로비·랭크)이 모두 온전하다. 하단 4탭은 화면 아래 끝 바로 위에서 끝난다(사진 px 약 1666/1688). 654 높이에서 보이던 불꽃·미션 줄 겹침은 844에서는 없다. |
| 06 전략 보드 | **430×932** | 전체 뷰포트 | 새 PVE(`startMode("pve",{aiLevel:"grade5"})`)를 열었다. 시작 상점 6마리 구매 → 다음 단계 → 무작위 배치 → 배치 완료를 실제 클릭으로 진행했다. `auto.js`가 1~15턴을 실제 이동으로 진행했고, 16턴 AI 공격 전투(08)는 `fight.js`로 끝냈다. 사진은 17턴 내 차례다. 차례 배너가 사라지고 `fxLocked()=false`인 뒤에 찍었다. | 전체 7×13 보드(칸 91개, 마지막 칸 아래 y770 = boardWrap 아래 끝), 머리·시간/턴/코인/전투 HUD, 왼쪽 속성 열, 오른쪽 시너지 열, 하단 조작 6개가 모두 들어 있다. |
| 08 속성 전투 | **430×932** | 전체 뷰포트 | 06과 같은 판이다. 16턴에 AI 고대 골렘(땅)이 내 새싹 파수꾼(풀)과 실제로 접촉해 전투가 시작됐다. 라운드 1 내 차례이고, 시작 연출이 끝난(`fxLocked()=false`) 뒤 찍었다. | 전투 창(y0..688): 머리, `나의 턴!`, 라운드·타이머, 스텟·속성 버튼, 두 좌석과 능력치 카드, 안내문, `싸우기·가방·포획·도망가기` 4개. **Seat D**(상대 전측면) = `land_sustain/battle-d@2x.png`, **Seat A**(내 쪽 후측면) = `grass_std/battle-a@2x.png`. B/C 뷰는 계약에 없다. 그 아래는 제품 모달 배경에 어둡게 깔린 보드다(1차 08과 같은 구성). |
| 05 시작 상점 | **390×1454** | 전체 뷰포트 | 새 PVE를 열고 실제 클릭으로 3마리(철갑 코뿔소·용암 거북·이끼 거인)를 샀다. 1454는 같은 상태를 390×844에서 연 `#screenBody.scrollHeight`(실제 스크롤 내용 전체)다. 이 뷰포트에서 scrollHeight = clientHeight = 1454, scrollTop 0이다. | 머리+단계 표시(y0..162), 하수인 구매 6줄(168..579), 필드 3/6(591..857), **가방 0/3 슬롯 3칸(869..987)**, 왕·동료 속성 3줄(993..1186), 아이템 8칸(1202..1446). 실제 내용 끝(shopSheet 1446 + 아래 padding 8)에서 끝난다. 부분 스크롤 사진이 아니다. |
| 07 턴 상점 | **390×1419** | 전체 뷰포트 | **상태 fixture(명시)**: 06/08과 다른 새 PVE 판이다. 시작 상점 6마리 구매·배치를 실제 클릭으로 했다. 첫 내 차례에 `S.turnCount=19` 한 값만 넣었다. 이어 실제 클릭으로 말 하나를 옮겼다(11,1→10,1). 그러자 제품의 `endTurn`이 20턴을 만들었고, `ecoShopOpenState`가 보너스 +2와 정기 상점을 열었다. 상점에서 실제 클릭으로 가시 덩굴을 누르자 제품의 승급 확인이 떴다. 이것은 `취소`했다. 이어 전자기 술사·철갑 코뿔소를 사서 가방에 넣었다. 1454와 같은 방법으로, 390×844에서 잰 `#overlayBox.scrollHeight` = 1419를 뷰포트로 썼다. | 머리·타이머·완료(y0..104), 하수인 구매 6줄(110..521), 필드 6/6(559..759), 가방 2/3(797..944), 왕·동료 속성(950..1143), 아이템 8칸(1185..1403). 실제 내용 끝(shopSheet 1411 + 8)에서 끝난다. fixture 때문에 실제 19턴 전투를 거치지 않았다. 그래서 필드 하수인 HP가 모두 가득이다. |

**CJ REVISE 원판 재사용 근거**(재촬영 없음):
- 제품 동일: Git 명령 없이 loose 객체를 직접 읽었다(`treecmp.js`). `a1fa420`(제품 기준) · `431d9cb`(1차 촬영) · `e48e7b1`(구도 보완 촬영) · `acac1c2`(현재)에서 최상위 `demo`·`server`·`tools`·`roblox`·`package.json`·`package-lock.json`·`render.yaml`·`.claude`·`.codex`·`.github` tree SHA가 모두 같다(`demo` `7021dc4951…`, `server` `e9ee4f2417…`, `tools` `f5680cb375…`). 다른 것은 `README.md`·`docs`뿐이다.
- 크기·디코드: 두 원판 모두 PNG 시그니처·전 chunk CRC·IDAT inflate·필터 복원이 통과했다. 780×1688, 8bit RGB, chunk `IHDR,IDAT,IEND`.
- UI·폰트·fixture 동일: `p01-844`의 위 1308줄은 이전 납품 `p01-clip654`와, 전체 1688줄은 1차 납품 01(`Mars/shots/p01a`, `8f438660…`)과 RGB 채널 차가 16을 넘는 픽셀이 0개다. 이것은 임계값 16 측정 결과이며 완전한 픽셀 일치를 뜻하지 않는다(16 이하 차이는 세지 않았다). 바이트는 애니메이션 순간 때문에 다르다. `p02-844`는 1차 02와 바이트까지 같다.
- 원판 경로: `…/Mars-Framing/shots/p01-844.png`(1067960 B) · `…/Mars-Framing/shots/p02-844.png`(1364740 B). 둘 다 CDP Emulation 390×844 · DPR 2 · mobile의 전체 뷰포트 캡처(clip 0,0,390,844)다.

**버린 probe**(모두 `Mars-Framing/shots/`):
- `p01-clip654`: 구도 보완 때 납품한 01(390×844 중 clip 390×654). CJ REVISE로 납품에서 빠졌다.
- `p01-654`: 390×654 네이티브 타이틀. 제품이 화면 가운데로 다시 배치해 아래에 약 124px 어두운 바닥이 다시 생겨서 버렸다.
- `p02-844-probe`: 프로필이 늦게 적용돼 게스트로 찍힌 사진.
- `p02-654`·`p02-654b`: 390×654 뷰포트 로비. `p02-654b`는 구도 보완 때 납품했고 CJ REVISE로 납품에서 빠졌다. 두 장은 픽셀 크기가 같고 애니메이션 때문에 바이트만 다르다.
- `b430`: 2턴 rail 확인용.
- `board-t1…t15`: `auto.js`가 차례마다 찍은 보드. t15에는 `플레이어 턴 15` 배너가 HUD를 가린다.
- `p07-alt-lead1146`: 05/07 같은 높이 C안 후보. 채택하지 않았다.

## 4. Saturn 지적 3건의 해결 근거

1. **01 하단 비네트 — CJ REVISE로 폐기**: 구도 보완은 01을 y0..654 CSS(780×1308 px)로 잘라 비네트를 사진 밖으로 뺐고, 02도 390×654 뷰포트로 맞췄다. CJ는 이것이 실제 화면 규격이 아니고 하단이 잘려 보인다고 REVISE했다. 그래서 이 해결은 더 이상 유효하지 않다. 현재 01·02는 390×844 전체 뷰포트이며, 01 아래쪽 배경은 제품의 실제 화면으로 남겨 둔다.
2. **06 시너지 칩 잘림**: 1차 390×844에서는 `synRail` scrollHeight/clientHeight가 554/513이었다. 41px이 넘쳐 마지막 칸이 잘렸다. 430×932에서는 588/588로 넘침이 없고, 12칸이 모두 `말 정보` 위에 온전히 보인다. 390 너비에서는 보드와 rail 높이가 너비에 묶여 높이만 늘려도 해결되지 않는다. 그래서 너비 430을 골랐다. 08도 같은 430×932로 다시 찍어 짝 크기를 맞췄다.
3. **05 가방 슬롯 화면 밖**: 시작 상점 전체 스크롤 내용(1454)을 그 높이의 네이티브 뷰포트에 담았다. 가방 0/3의 빈 슬롯 3칸(869..987)과 그 아래 왕·동료 속성·아이템까지 실제 내용 끝에서 끝난다. 07도 같은 방식(1419)으로 다시 찍었다.

## 5. 검사

아래 앞 네 항목(예외·자산·이미지·가로 넘침)은 구도 보완 촬영 세션의 이력이다. CJ REVISE는 재촬영하지 않아 브라우저 세션 검사를 새로 하지 않았다.

- 페이지 예외·console error/warning: 0건이다. 확인한 세션은 01 세션, 02 재촬영 세션, 06/08 오프라인 세션, 07 세션, 05 세션이다(각 촬영 직후 `/errors`).
- 자산 로드 오류: 0건이다(CDP `loadingFailed`·HTTP ≥400·정적 서버 404 모두 비어 있음).
- 이미지: 촬영 직전 보이는 `<img>`가 모두 `complete && naturalWidth>0`이었다. 02 대표는 `portrait.webp`(512)다. 08 전투는 `battle-d@2x`·`battle-a@2x`(256)다.
- 가로 넘침: `documentElement.scrollWidth`가 innerWidth와 같았다(390 또는 430). 6장 모두 해당한다.
- 아래 빈 여백·잘림(`bottomcheck.js`, 마지막 80px의 서로 다른 색 수, 구도 보완 시점): 03:1442 · 04:1902 · 05:2085 · 06:3902 · 07:686 · 08:788. 05·07은 실제 내용 끝(아이템 카드 줄 + 8px)에서 끝난다. CJ REVISE의 01·02(`pnginfo.js`): 01:18 · 02:2868. 01의 18색은 제품 타이틀 배경의 어두운 아래쪽이며 덧붙인 여백이 아니다. 화면에 보이는 실제 배경이라 불량으로 보지 않는다.
- 1차 대비: 02·03·04는 SHA가 1차와 같다. 01은 1차와 같은 화면의 다른 순간(전체 1688줄에서 RGB 채널 차가 16을 넘는 픽셀 0개 — 16 이하의 작은 차이는 측정하지 않았다. 바이트는 다르다)이다. 05·06·07·08만 1차와 다르다(아래 6절).

## 6. 제품·기존 이미지 불변 확인

(구도 보완 이력) Git 명령 없이 `blobcheck.js`(1차와 같은 코드)로 worktree index(`…/.git/worktrees/doc-386-v0416-readme/index`, v2, 2331개 항목)를 직접 읽었다. 각 작업 파일의 blob SHA-1을 비교했다. 시작 상태가 clean이었으므로 index는 HEAD `431d9cb`와 같다고 본다(추론).

- 바이트 동일: 1546개.
- CRLF→LF 정규화 뒤 동일: 779개. demo·server·tools·test 아래 165개를 포함한다. Windows checkout의 줄 끝 변환이다.
- 다름: 정확히 6개다. `docs/screenshots/v0.4.16/` 01·02·05·06·07·08 PNG뿐이다. README.md·milestone README·03/04·옛 버전 이미지는 다르지 않다. 이 보고서는 검사 뒤에 고쳤다.
- 없음: 0개.

**CJ REVISE 재확인**: 같은 `blobcheck.js`(수정·복사 없이 실행)로 새 작업 공간 index(`…/.git/worktrees/doc-386-readme-fullscreen/index`, v2, 2331개 항목, 시작 시 clean이라 HEAD `acac1c2`와 같다고 본다 — 추론)를 읽었다. 바이트 동일 1548 · LF 정규화 뒤 동일 780(demo·server·tools·test 아래 165) · 없음 0. 다름은 정확히 3개다: `01-login.png` · `02-main-lobby.png` · 이 보고서. 결과는 artifact `CJ-REVISE-Login-Lobby/Mars/blobcheck.json`. 직접 SHA-256으로도 `README.md`(`9fada012…`)·milestone README(`56d4c48a…`)·03~08 PNG가 작업 전후 같다(`before-sha.txt`·`after-sha.txt`). README 1행 캡션 `로그인`·`메인 로비`와 이미지 경로는 그대로다.

## 7. 문제·한계 (판정 아님, Mercury·Saturn 검토용)

1. **05/07 높이 차이 2.47%**: 1절에서 설명했다. 코디네이터 A안 결정이다.
2. **07 fixture**: `S.turnCount=19` 값 하나와 실제 이동 1회로 제품의 정기 상점 경로를 탔다. 실제 20턴 대국이 아니라서 필드 HP가 모두 가득이다. 판 위 말 위치도 시작 배치 근처다(사진에는 보드가 없다).
3. **06/08은 1차와 다른 판**이다. 06은 전투 뒤 17턴 보드라서 상대 공개 말이 보이지 않는다. 그 대신 탐색 가능한 수풀 두 칸이 보인다.
4. **제품 표시 그대로인 부분**: 게임 머리의 `플레이어`가 `플레…`로 줄어 보인다(05·07·08). 02 `싱글플레이` 버튼 글자가 두 줄로 나뉜다(844에서도 같다). 01 아래쪽 약 220 CSS px는 타이틀 배경의 바닥·어두운 비네트다(제품 실제 화면). 타이머는 촬영 순간 값이다(05 73초 · 06 15초 · 07 58초 · 08 56초).
5. **Git 읽기 명령 사용**: 시작 확인 때 읽기 전용 `git rev-parse HEAD`·`git status --short`를 1회씩 실행했다. Worker Git 읽기 금지 메모와 어긋나므로 기록한다. 그 뒤에는 Git 명령을 쓰지 않았다.
6. 기존 `readme_media_capture.js verify`는 #105 튜토리얼 10장을 요구한다. 그래서 현재 8장 갤러리에는 legacy FAIL이 나온다. 범위 밖이라 실행·수정하지 않았다.
7. **CJ REVISE 검사 한계**: 브라우저·서버를 띄우지 않았고 재촬영하지 않았다. 01·02의 촬영 조건(뷰포트·DPR·fixture·Chrome)은 구도 보완·1차 기록과 원판 비교로 확인한 것이다. 원판의 픽셀 크기·디코드·제품 tree 동일·이전 납품과의 픽셀 일치는 직접 검사했다. Google 버튼·하단 4탭이 잘리지 않음은 원판 이미지를 눈으로 본 것과 기존 측정값(Google 버튼 y625)으로 확인했다. 이번 작업에서는 Git 명령을 쓰지 않았다(HEAD는 `.git` 파일을 직접 읽었다). 제품 runtime 변경은 없다. README 표시 QA 판정은 Saturn·CJ가 한다.

## 8. 정리

- 내 프로세스(드라이버 PID 32692, Chrome PID 35992)는 `/quit`로 종료했다. 남은 프로세스는 없다. 포트 9426/9427과 임의 정적 포트는 LISTEN 0이다. 격리 프로필 `Mars-Framing/profiles`는 삭제했다.
- 다른 프로세스, root·#335 checkout, E: 납품·리뷰 자료, 1차 `Mars/` artifact는 건드리지 않았다. 패키지 설치·배포·서버/DB 기동은 하지 않았다.
- CJ REVISE: 띄운 프로세스가 없다(Node 검사 스크립트만 실행 후 종료). 원본 root와 `doc-386-v0416-readme` 작업 공간은 읽기만 했다(`.git` 객체·HEAD 파일). `Mars-Framing/`·`Mars/` artifact는 덮지 않았다.
