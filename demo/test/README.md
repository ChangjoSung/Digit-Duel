# 검사 인덱스 — `demo/test`

이 폴더의 33개 파일은 **성격에 따라 네 폴더**로 나뉜다. 어디에 두느냐가 곧 그 파일의 성격이다.

| 폴더 | 성격 | 지금도 도는가 | 파일 쓰기 |
|---|---|---|---|
| [`regression/`](regression) | 현행 규칙을 지키는 **살아 있는 게이트**. CI 잡 A가 매 PR에서 16개 전부 실행한다 | 예 | 저장소에는 없음 (한 곳만 tmp 음성 대조 사본) |
| [`reports/`](reports) | 필요할 때 돌려 표를 뽑는 **재사용 리포트 생성기**. 어서션·종료 코드가 없어 게이트가 아니다 | 필요 시 | 인자로 출력 파일을 줄 때만 |
| [`milestone/`](milestone) | 그 이슈에서 한 번 돌려 증빙을 남긴 **과거 시점의 감사 도구** | 재현용 | 기본값이 보관소 경로인 것이 많다 — 아래 표 참조 |
| [`shared/`](shared) | 위 셋이 공통으로 쓰는 로더 | — | 없음 |

버전·Issue 열은 **그 파일이 처음 들어온 커밋이 담긴 최초 태그**다(실행 이력이 아니라 출처). 현재 출시된 최신 태그는 v0.4.5이고, **v0.4.7은 아직 출시 전 계획 마일스톤**이다 — 그 표기는 #132에서 들어와 아직 태그에 담기지 않은 파일이라는 뜻이다. 문서 쪽 보관소 규약은 [docs/milestone/README.md](../../docs/milestone/README.md), 옛 코드 경로 대조는 [#134 MOVES.csv](../../docs/milestone/v0.4.7/issues/134/Mercury/MOVES.csv)에서 본다.

## 공용 (`shared/`)

| 파일 | 버전 | Issue | 하는 일 |
|---|---|---|---|
| [`harness.js`](shared/harness.js) | v0.3.0 | #19·#20·#21 | `demo/index.html`의 `<script>`를 DOM 스텁 위에서 eval하고 내부 심볼을 노출한다. **18개**가 이 로더를 쓴다 — 회귀 15 · `ai_compare` · `attack_balance_compare` · `shock_compare`. CDP 증빙 13종과 `smoke_testclient`는 쓰지 않는다 |

## 회귀 게이트 (`regression/`) — CI 잡 A

**저장소에는 아무것도 쓰지 않는다.** 예외는 하나뿐이다 — `smoke_online.js`의 J절 음성 대조가 `os.tmpdir()/digitduel_stale_mutant_<pid>.html`에 변이 사본을 만들고 그 자리에서 지운다. Saturn의 엄격한 READ_ONLY 재검증에서는 이 한 건을 감안한다. 인자를 주지 않으면 현재 작업 트리의 `demo/index.html`을 검사한다(예외는 표에 적었다).

| 파일 | 버전 | Issue | 검사 범위 |
|---|---|---|---|
| [`smoke_cycle5.js`](regression/smoke_cycle5.js) | v0.3.0 | #19 #20 #21 | 이동·상성·폭탄·함정·밀어내기·왕 불가침·판정 기본 회귀 |
| [`smoke_tutorial.js`](regression/smoke_tutorial.js) | v0.3.1 | #26 #32 | 튜토리얼 10단계 내용·장면 그림·접근성·1회 자동 표시 |
| [`smoke_memo.js`](regression/smoke_memo.js) | v0.3.1 | #36 #38 (+#94) | 추측 메모 피커·viewer 격리·AI 비관측·상대 턴 로컬 메모 |
| [`smoke_online.js`](regression/smoke_online.js) | v0.4.0 | #54 #63 | 온라인 PVP 접속 경로·주소 정규화·스킴. **J절 음성 대조만 `os.tmpdir()`에 변이 HTML 사본 1개를 만들고 삭제한다** |
| [`smoke_testclient.js`](regression/smoke_testclient.js) | v0.4.1 | #63 | 릴레이 점검 클라이언트(`server/test-client.html`)의 목적지 허용 목록·코드 비노출 |
| [`smoke_minion_art.js`](regression/smoke_minion_art.js) | v0.4.3 | #89 (+#91) | 하수인 아이콘 체계·미공개 정보 비노출·납품 아트 바이트 보존 |
| [`smoke_cross_skill.js`](regression/smoke_cross_skill.js) | v0.4.4 | #92 | 탐색 보상 속성 교차 공격기. 기준판 `d614392`를 `git show`로 읽어 대조한다(CI `fetch-depth: 0` 필요) |
| [`smoke_own_side.js`](regression/smoke_own_side.js) | v0.4.4 | #93 | 온라인 양측 자기 진영 아래 표시 — 표시 전용 행 반사, 논리 좌표 불변 |
| [`smoke_attack_balance.js`](regression/smoke_attack_balance.js) | v0.4.4 | #95 | 공격형 atk 25 · `sig_atk.pow` 40 수치 고정과 파생값 |
| [`smoke_shock.js`](regression/smoke_shock.js) | v0.4.4 | #96 | `shockProb=0.5` 계약. H절이 같은 폴더의 다른 `smoke_*.js`를 읽어 결정론 계약(H0·H0b·H1·H2)을 검사한다 |
| [`smoke_online_sync.js`](regression/smoke_online_sync.js) | v0.4.4 | #104 | 2클라이언트 락스텝 동기화. `--stdin`으로 임의 ref 음성 대조 가능 |
| [`smoke_orientation_audit.js`](regression/smoke_orientation_audit.js) | v0.4.4 | #93 #104 | 보드 방향 감사. **기본 소스가 고정 ref `6baa0b5`라 현재 코드를 보려면 `--path demo/index.html`이 필요하다** — CI가 그렇게 부른다 |
| [`smoke_turnflow.js`](regression/smoke_turnflow.js) | v0.4.4 | #106 | 턴 흐름·회복 주 행동·폭탄 접촉·함정 공개 계약 |
| [`smoke_turnflow_timers.js`](regression/smoke_turnflow_timers.js) | v0.4.4 | #106 | 가짜 타이머 대신 Node 실제 `setTimeout`으로 잠금·데드라인 검증 |
| [`smoke_issue114.js`](regression/smoke_issue114.js) | v0.4.5 | #114 | v0.4.5 턴 행동 규칙 + 격리된 2클라이언트 락스텝 |
| [`smoke_ai_completion.js`](regression/smoke_ai_completion.js) | v0.4.7(미출시) | #132 | AI vs AI 완주 게이트 — 고정 시드·스텝 예산·불변식·종료 상태 적법성 |

## 리포트 생성기 (`reports/`)

| 파일 | 버전 | Issue | 하는 일 | 파일 쓰기 |
|---|---|---|---|---|
| [`ai_compare.js`](reports/ai_compare.js) | v0.3.0 | #21 | 시드 고정 다경기 비교표(5단/5급 조합). 어서션도 `process.exit`도 없어 **게이트가 아니다** | 3번째 인자로 `out.md`를 줄 때만 |

## 과거 증빙 (`milestone/<버전>/issues/<번호>/`)

그 이슈에서 실제로 돌려 보관소의 증빙을 만든 도구다. 대부분 헤드리스 Chrome(CDP)을 띄우고, 기본 `--out`이 **이미 승인된 보관소 경로**라 인자 없이 돌리면 그 증빙을 덮어쓴다. 재현할 때는 `--read-only`(또는 `--out`으로 자기 소유 경로 지정)를 쓴다.

`--read-only`가 뜻하는 것은 **검증 산출물 0건**이지 프로세스 전체의 쓰기 0이 아니다. CDP 도구는 그 모드에서도 `os.tmpdir()`에 헤드리스 Chrome 임시 프로필을 만들고(종료 시 자기 것만 정리), 온라인 계열은 검증 전용 릴레이 서버(PORT=0·루프백)를 띄운다. 각 파일이 그 사실을 RESOURCE/CLEANUP 행으로 스스로 보고한다.

| 파일 | 버전 | Issue | 하는 일 | 기본 파일 쓰기 |
|---|---|---|---|---|
| [`tut_layout_cdp.js`](milestone/v0.4.0/issues/42/tut_layout_cdp.js) | v0.4.0 | #42 | 튜토리얼 카드 레이아웃 실측(여러 뷰포트) | `os.tmpdir()` · `--read-only` 지원(Chrome 임시 프로필 생성·정리) |
| [`minion_art_cdp.js`](milestone/v0.4.3/issues/89/minion_art_cdp.js) | v0.4.3 | #89 | 하수인 아트 게임 적용 실측 + 스크린샷 | `docs/milestone/v0.4.3/issues/89/Mars/artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`issue91_cdp.js`](milestone/v0.4.4/issues/91/issue91_cdp.js) | v0.4.4 | #91 | 공용·적 포획 하수인 대리 출전 아트 실측 | `…/91/Mars/artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`issue92_cdp.js`](milestone/v0.4.4/issues/92/issue92_cdp.js) | v0.4.4 | #92 | 속성 교차 공격기 교체 브라우저 증빙(릴레이 2클라이언트) | `…/92/Mars/artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`issue93_cdp.js`](milestone/v0.4.4/issues/93/issue93_cdp.js) | v0.4.4 | #93 | 온라인 양측 자기 진영 아래 표시 증빙 | `…/93/Mars/artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`memo_cdp.js`](milestone/v0.4.4/issues/94/memo_cdp.js) | v0.4.4 | #94 | 상대 턴 로컬 메모 브라우저 증빙 | `…/94/Mars/artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`issue95_cdp.js`](milestone/v0.4.4/issues/95/issue95_cdp.js) | v0.4.4 | #95 | 공격형 위력 표기 브라우저 증빙 | `…/95/Mars/artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`attack_balance_compare.js`](milestone/v0.4.4/issues/95/attack_balance_compare.js) | v0.4.4 | #95 | 시드 고정 1:1 전투 before/after 비교(v0.4.3 ↔ V6 상수) | 기본 stdout · `--out`을 줄 때만 기록 |
| [`issue96_cdp.js`](milestone/v0.4.4/issues/96/issue96_cdp.js) | v0.4.4 | #96 | 감전 확률 하향 브라우저 실측 + 스크린샷 | `…/96/Mars/artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`shock_compare.js`](milestone/v0.4.4/issues/96/shock_compare.js) | v0.4.4 | #96 | 같은 시드 before/after 대조. 기준판 기본값 `dadc8bc`를 메모리로 읽는다 | 기본 stdout · 파일을 쓰지 않는다 |
| [`issue104_cdp.js`](milestone/v0.4.4/issues/104/issue104_cdp.js) | v0.4.4 | #104 | 온라인 말·위치 불일치 브라우저 증빙 | `…/104/Mars/artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`orientation_audit_cdp.js`](milestone/v0.4.4/issues/104/orientation_audit_cdp.js) | v0.4.4 | #93 #104 | 보드 방향 독립 감사(실제 Chrome 2클라이언트) | `…/104/Mars/orientation-artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`issue106_cdp.js`](milestone/v0.4.4/issues/106/issue106_cdp.js) | v0.4.4 | #106 | 턴 흐름·연출 브라우저 증빙(릴레이 2클라이언트 + PVE 탭) | `…/106/Mars/artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`issue106_browser_audit.js`](milestone/v0.4.4/issues/106/issue106_browser_audit.js) | v0.4.4 | #106 | 위 도구가 다루지 않은 수용 기준(핫시트·PVE·온라인) 보완 감사 | `…/106/Mars/browser-artifacts` · `--read-only` 시 산출물 0건(Chrome 임시 프로필은 생성·정리) |
| [`issue114_cdp.js`](milestone/v0.4.5/issues/114/issue114_cdp.js) | v0.4.5 | #114 | v0.4.5 턴 행동 실제 클릭 증빙(2탭 + 실제 릴레이) | `docs/milestone/v0.4.5/issues/114/Mars/artifacts` · `--read-only` 지원(Chrome 임시 프로필·검증용 릴레이 서버) |

옛 문서가 인용하는 `node demo/test/<파일>.js` 같은 평문 명령은 **그때의 사실 진술이라 고치지 않았다**. 현재 경로는 위 표와 [#134 MOVES.csv](../../docs/milestone/v0.4.7/issues/134/Mercury/MOVES.csv)에서 찾는다.
