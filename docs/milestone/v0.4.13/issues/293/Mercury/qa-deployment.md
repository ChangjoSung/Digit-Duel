# [결정][피드백] #293 Render QA 재배포 · CJ QA Test List

2026-10-01 · Mercury_PD · 확인 시각 15:14 KST(06:14 UTC).

**새 QA 사이트:** <https://digit-duel-mipa-qa.onrender.com/>. #293의 최신 제품 구현으로 배포했고 실제 제공 중인 JS·CSS가 배포 커밋의 Git blob과 일치한다. 기존 QA 서비스는 삭제했다. **CJ QA 판정은 REVISE이며, 새 사이트에서 재테스트를 기다린다.** 배포 확인은 제품 QA PASS나 병합·출시 승인이 아니다.

## CJ 지시와 원인

CJ 최신 Comment: 기존 Render QA Site 정리, 현재 #293 최신 구현 배포, `http://digit-duel-mipa-QA.onrender.com` 사용, 새 사이트를 열어 재테스트, 보고서에 CJ QA Test List 포함.

기존 QA는 연결 브랜치가 `main`이고 자동 배포가 꺼져 있었으며, 실제 실행 커밋은 `98a26a1b98ef5c49a2b78db34e941a0acdf2875b`였다. 제공 중인 `ui.js`·`game.css`도 그 커밋과 일치해 #293 변경을 확인할 수 없었다. 브라우저 캐시가 원인이라고 추정하지 않는다. 이번 작업은 QA 환경 교체와 운영 기록이며 제품 코드·규칙을 변경하지 않았다.

## 배포와 정리 증거

| 항목 | 실제 확인 |
|---|---|
| QA URL | <https://digit-duel-mipa-qa.onrender.com/> |
| CJ 지정 HTTP URL | `http://digit-duel-mipa-QA.onrender.com` → **301** → 위 HTTPS 주소. 도메인의 대소문자는 같은 주소다 |
| 새 서비스 | `digit-duel-mipa-qa` · `srv-dauvf1m0tbcc73ctepsg` · [Render Dashboard](https://dashboard.render.com/web/srv-dauvf1m0tbcc73ctepsg) |
| 소스 | `ChangjoSung/Digit-Duel` · `ChangjoSung/issue-293-start-flow-concept` |
| 배포 커밋 | [`0cf0179e0ccafd39b0cb6308ae3c0c315b988dcf`](https://github.com/ChangjoSung/Digit-Duel/commit/0cf0179e0ccafd39b0cb6308ae3c0c315b988dcf) · 생성 직전 PR #305 HEAD·로컬/원격 HEAD 일치 확인 |
| 배포 | `dep-dauvf1u0tbcc73cterb0` · **live** · 완료 2026-10-01 15:03:43 KST |
| 요금·지역 | **Free** · Singapore · Node 24 · 신규 DB·디스크·유료 요금제·결제 없음 |
| 빌드·기동 | 저장소 루트 · `npm ci --prefix server` · `npm start --prefix server` |
| 배포 제어 | 자동 배포 **Off**, QA 대상 커밋 유지. 보고서 커밋·push가 QA 버전을 바꾸지 않음 |
| 공개 배포 설정 | `DD_AUTH_PUBLIC_DEPLOY=1` · `DD_AUTH_PUBLIC_HOST=digit-duel-mipa-qa.onrender.com` · Render 주입 PORT 사용 |
| Health Check Path | Render 설정 `/healthz` 저장 후 MCP 실제 재조회 확인 |
| HTTP 확인 | `/` **200** · `/healthz` **200 `ok`** · `/readyz` **200 `ok (no db)`** |
| 실제 클라이언트 | `/js/ui.js` 217,553 bytes · SHA-256 `bab967637a81ec8e9497dd89808b0e01113bc65e43eac691214ea04eef2ddb14` · 배포 Git blob 일치 |
| 실제 스타일 | `/css/game.css` 135,122 bytes · SHA-256 `8c7493da308201b5f557d16489a157c71b0ca5f03cfa710227ca7ae2c32e6a23` · 배포 Git blob 일치 |
| 브라우저 실제 읽기 | Orca #293 WorkTree QA 탭에서 타이틀 `Digit Dual — HTML 프로토타입 데모`, `AUTH.state=off`, `시작 →`, 같은 출처 스크립트 로딩 확인 |
| 기존 QA 정리 | `digit-duel-cjqa-292-20260929` · `srv-datq2ou0tbcc73eril0g` 삭제. MCP `list_services`에서 부재, `get_service` **404** 확인 |
| 보존 | 삭제 전 서비스 메타데이터·최근 배포 5건·새 배포/HTTP 증거를 `C:/Users/pc_77/orca/archives/Digit-Duel/issue293-render-qa-20261001/before-old-qa-delete.json`에 보관 |
| 운영 서비스 | `digit-duel` · `srv-daj498mq1p3s73a31s3g` · `main` · 기존 플랜·디스크·설정 보존, 실제 목록 전후 대조 |

Render MCP는 생성·조회에 사용했다. 삭제·Health Check 설정은 **기존 로그인된 Render Dashboard를 Orca 내장 브라우저로 조작**하고 MCP로 효과를 확인했다. API 키 발급·새 계정·새 MCP 연결은 하지 않았다. 내장 브라우저 `snapshot`의 런타임 연결 오류는 같은 페이지의 `eval`로 복구했다.

## CJ QA 시작 순서

1. PC 일반 창과 시크릿 창, 또는 PC와 휴대폰에서 **새 QA URL**을 각각 연다. 같은 일반 창의 탭 두 개보다 독립 브라우저 세션을 권장한다.
2. 이 QA는 기존처럼 **DB 없는 게스트 환경**이다. 실제 `/api/auth/session`은 `503 E_ACCOUNTS_DISABLED`이고 클라이언트는 정상적으로 `AUTH.state=off`가 된다. 로그인·회원가입·영구 전적 검증은 이 환경의 범위가 아니다.
3. 양쪽에서 `시작 → 멀티플레이`로 들어간다. 한쪽은 `생성 → 방 만들기`, 다른 쪽은 방 목록에서 같은 방에 참가한다.
4. 참가자가 `준비`, 방장이 `시작`을 누르면 #293 시작 상점으로 진입한다. 시작 상점 이후의 `배치 완료`는 방 대기 화면의 `준비`와 별개다.
5. 아래 기본 목록을 확인하고 CJ Comment에 결과를 남긴다. 실제 두 브라우저에서 경기 시작까지 확인하는 CJ 플레이 QA는 아직 실행되지 않았다.

## CJ QA Test List — 기본

| ID | 조작·확인 대상 | 기대 결과 |
|---|---|---|
| CJ-01 | 휴대폰 세로 화면에서 시작 상점 진입 | 이름 VS 이름·시간·코인·설정이 상단 한 줄이며, 진행 막대와 진행 버튼도 한 줄. 겹침·잘림·불필요한 안내 문장 없음 |
| CJ-02 | 하수인 구매·필드·가방·교체·배치 트레이·시너지 기여 카드 확인 | 실제 하수인 아트와 **등급·왕국·아키타입·HP**가 모두 표시. 왕·동료 등 비하수인에 없는 등급·아키타입·HP를 지어내 붙이지 않음 |
| CJ-03 | 구매 행·등급 테두리 확인 | 구매 버튼/가격이 한 행에 읽힘. **시작 상점은 전부 1등급이므로 같은 흰 테두리가 정상**. 등급 1~5는 흰색/민트/파랑/보라/금색이며 가격으로 테두리가 바뀌지 않음 |
| CJ-04 | 필드 카드 판매 → 확인 창 취소/확정 | 시작 상점의 살아 있는 하수인에 판매 표시. 취소 시 그대로, 확정 시 기존 환급·필드 변경 적용. 다른 규칙·판매 조건이 추가되지 않음 |
| CJ-05 | 필드를 채운 뒤 가방 카드 확인·판매 | **교체와 판매가 한 줄에 나란히** 표시되고 손가락으로 누를 수 있음. 판매 확인·취소와 기존 환급 동작 유지 |
| CJ-06 | 가방 교체 → 선택 창 → 취소/실제 교체 | 필드 **6카드(2×3)**로 대상 표시. 빈칸은 선택 불가. 취소·✕·Esc는 코인/로스터/HP를 바꾸지 않고, 교체는 한 번 적용되며 HP가 초기화되지 않음 |
| CJ-07 | 우측 시너지 아이콘 누르기 → 상세 닫기 | 미달/활성 단계 구분·색·단계 표시가 읽힘. 효과와 실제 기여 카드 표시, 카드 수와 칩 숫자 일치. 같은 숫자라도 왕국/아키타입 단계가 다르면 다른 색이 정상 |
| CJ-08 | 필드 6칸 채우기 → 다음 단계 → 배치 | ① 상점 → ② 배치. 상점 완료 전 배치로 건너뛰지 않고 완료한 상점으로 되돌아가지 않음. **7×13 정사각 보드·트레이 14칸**, 무작위 배치·전체 회수 유지 |
| CJ-09 | 보드 끝까지 스크롤 → 마지막 행 배치 | 트레이 때문에 처음에 가려진 마지막 행도 내부 스크롤 끝에서 보이고 누를 수 있음. 14개 전에는 완료가 비활성, 전부 놓으면 활성 |
| CJ-10 | 한쪽 배치 완료 → 준비 취소 → 수정·다시 완료 | ② → ③ → ② → ③. 대기·취소가 실제 상태와 일치. 상대 미완료는 **준비 중/입장 대기**, 상대 완료일 때만 ③ 표시. 상대 구매·코인·필드·가방은 공개되지 않음 |
| CJ-11 | 두 브라우저 모두 배치 완료 | 실제 서버 확인 후 경기 시작. 상대 미완료 상태에서 먼저 시작하거나 대기 화면에 계속 갇히지 않음 |

**화면 추가 확인:** 기본 테스트 중 PC에서도 주요 화면을 한 번 확인한다. 가능한 경우 폭 390px·320px에서 TopBar, 가방 액션, 교체 창, 보드 스크롤을 대조한다. 320px 가방이 2열인 것은 버튼의 한 줄 배치와 터치 영역을 지키기 위한 정상 표시다. PC 교체 창은 Tab·Enter·Esc로 열기/선택/취소 및 버튼 포커스 복귀를 확인한다.

## 선택 확인 — 시간 초과

기본 흐름 뒤 별도 판에서 확인한다. 시계는 스케치의 120초가 아니라 **현행 90초**다.

| ID | 조작 | 기대 결과 |
|---|---|---|
| CJ-T1 | 시작 상점을 수동 완료하지 않고 90초 기다림 | 기존 자동 구매·자동 배치·준비, **① → ③ 직행**. 추가 배치 90초가 생기지 않음 |
| CJ-T2 | 시작 상점을 수동 완료한 뒤 일부 말을 남기고 배치 90초 기다림 | 남은 말 자동 배치·준비, **② → ③**. 양쪽 준비 조건으로 경기 시작 |

## 판정·남은 범위

- CJ 결과 형식: **PASS / REVISE + 테스트 ID + 화면/조작 순서 + 기대/실제 결과 + 스크린샷**. 새 GitHub Issue 댓글은 만들지 않고 CJ Comment로 접수한다.
- 필수 CI는 배포 소스 `0cf0179`에서 **6/6 PASS**, [run 36807134575](https://github.com/ChangjoSung/Digit-Duel/actions/runs/36807134575). Saturn의 독립 QA 이력은 [QA 보고](../Saturn/report.md)에 보존한다. 이번 보고서의 문서 갱신은 제품 blob을 바꾸지 않는다.
- #293 Issue OPEN·PR #305 Draft 유지. **CJ REVISE 후 새 환경 재테스트 대기**, 병합·수동 종료·main Release·운영 Render 배포 없음. #294·#295 전체 개편·#296은 별도 착수 대기.
- 상대 ①/② 구분 비공개(R1), DB 없는 QA, 무료 서비스 휴면은 남아 있는 제약이다. 무료 서비스는 15분 무트래픽 후 휴면하며 첫 접속 기동은 약 1분일 수 있다. 페이지가 열린 뒤 테스트한다. [Render Free 문서](https://render.com/docs/free#spinning-down-on-idle).
