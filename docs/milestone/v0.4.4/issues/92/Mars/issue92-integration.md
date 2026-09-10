# Issue #92 — dev 통합 검증 (#91~#96 결합) · Mars_3 후속 납품 보고

- 역할: **Mars_3** (required_role=Mars · instance_index=3 · mode=IMPLEMENT · area=HTML · mutation=code · provider=Claude Code)
- Task `task_b7698e3e2b28` · dispatch `ctx_6c7d2211748c` · 작업공간 루트 · 브랜치 `feat/92-cross-element-skills`
- 통합 상태 [확정]: HEAD `9018700`(PD 커밋, #92 원 납품) + MERGE_HEAD `3f006bb`(origin/dev, #93 시점 반사·#94 상대 턴 메모 통합). 자동 병합이 인덱스에 스테이지돼 있고 충돌 0. **Git 쓰기 0**(stash 포함) — 아래 수정은 작업 트리에만 있고 PD가 커밋한다.
- 원 납품 보고 `docs/qa/issue92-mars.md` 는 이력이다. 이 문서가 통합 후 현재 상태의 명령·개수·해시다.
- 표기: [확정] 코드·측정 사실 / [추론] 해석 / [미확정] 이번에 재지 않은 것. Saturn 독립 QA·CJ 플레이 QA 이전이므로 "검증 완료"를 주장하지 않는다.

---

## 1. 통합 검토 결과와 수정 (작업 트리, 병합 결과 대비 +2/−2 · 테스트 +5)

### 1.1 병합 자체 [확정]
- `git diff MERGE_HEAD` 로 본 #92 델타는 원 납품과 동일: `demo/index.html` +85/−46 · `harness.js` +4 · `smoke_shock.js` 2행 · 신규 `smoke_cross_skill.js`·`issue92_cdp.js`. #93(행 반사 `renderBoard`·`dataset` 논리 좌표)·#94(`memoClickTarget`·`MEMO_UI.token/overlayOpen`·코어 `modal()`/`close()` 토큰 무효화)와 겹치는 hunk 없이 자동 병합됐다.
- `harness.js` 는 양쪽 노출 심볼(#92 `applyAction/netPump/recruitCandidates…`, #94 `memoClickTarget/memoTargetOk`)이 나란히 들어갔다.

### 1.2 발견한 통합 결함 1건과 수정 [확정]
| 항목 | 내용 |
|---|---|
| 증상 | 병합 직후 10스모크 1003/1007 — `smoke_memo` D9·D9a·D10a·D10b 4건 실패 |
| 원인 | #94 는 코어 `modal()` 에 `MEMO_UI.token=null; MEMO_UI.overlayOpen=true` 를 두어 "새 모달이 오버레이를 가져가면 열려 있던 메모 피커 콜백은 무효, 오버레이가 열린 동안 로컬 메모 분기 금지"를 보장한다. #92 의 동기화 모달 래퍼는 비소유자(온라인 상대) 잠금 화면을 **코어를 거치지 않고** `overlayBox.innerHTML` 에 직접 썼으므로, 상대 소유 동기화 모달이 뜰 때 토큰이 남아 오래된 피커 콜백이 살아 있었고 `overlayOpen` 도 false 였다 |
| 수정 | `demo/index.html` `modal=function` 래퍼의 masked 분기: 직접 innerHTML → `_modalCore(잠금 HTML,[])`. 원문(후보 기술 등 소유자 전용 정보)을 비소유자 DOM 에 쓰지 않는 #92 성질은 그대로이고, #94 소유권(토큰 무효·overlayOpen)과 `close()` 경로도 종전과 동일하게 지나간다. DOM 차이는 빈 `<div class="row" id="obBtns">` 한 개(버튼 0) |
| 회귀 | `smoke_cross_skill` H3b(잠금 화면에서 `overlayOpen true·token null·버튼 0`) 추가 + L10 음성 대조(잠금 화면이 코어를 우회하는 변형을 메모리에서 로드하면 H3b 검사기가 잡는다). 기존 단언은 약화하지 않았다 |

### 1.3 #93·#94 보존 확인 [확정]
- #94: `memoModal` 은 `netLocalModal()` 로 local=true → 래퍼의 masked 분기에 걸리지 않는다(로컬 피커는 종전대로 코어 직행). `smoke_memo` 122/122 · `memo_cdp --read-only` 18/18(실제 2탭·상대 턴 피커·송신 0·PVE AI 턴).
- #93: `issue92_cdp.js` 는 `.cell[data-r][data-c]` 의 **논리 좌표**로 클릭하므로 2P 화면의 행 반사와 무관하게 같은 칸을 누른다. 통합 후 재생성한 `5-online-waiting-view.png` 는 P2 자기 진영이 화면 아래(#93)이고 그 위에 #92 잠금 화면, 로그는 "상대(P1) 숲 이벤트 발생"뿐이다. `smoke_own_side` 66/66 · `issue93_cdp --read-only` 18/18.

---

## 2. 명령 · 개수 · 결과 (Node v24.16.0, 저장소 루트, 통합 후 최종 트리)

### 2.1 헤드리스 10스위트
```
node demo/test/smoke_cycle5.js          # 69
node demo/test/smoke_memo.js            # 122
node demo/test/smoke_online.js          # 157
node demo/test/smoke_minion_art.js      # 199
node demo/test/smoke_tutorial.js        # 124
node demo/test/smoke_testclient.js      # 41
node demo/test/smoke_shock.js           # 65  (감전 침 1000회 469/1000 = 46.9%)
node demo/test/smoke_attack_balance.js  # 50
node demo/test/smoke_own_side.js        # 66
node demo/test/smoke_cross_skill.js     # 116 (원 114 + H3b + L10)
```
| 시점 | 결과 |
|---|---|
| 병합 직후(수정 전) | 1003 / 1007 (smoke_memo 4건 실패 — 1.2) |
| 수정 후(최종) | **1009 / 1009 PASS** (PD 기대치 1007 + 이번 추가 2) |

### 2.2 실제 Chrome 증빙
```
node demo/test/issue92_cdp.js               # 20 / 20 · 스크린샷 5장·JSON 재생성 (docs/qa/issue92/, 2026-09-07T12:12:49Z)
node demo/test/issue92_cdp.js --read-only   # 20 / 20 · 산출물 0 — 실행 전후 docs/qa/issue92 의 ls -l --time-style=full-iso 지문(md5) 동일
node demo/test/issue93_cdp.js --read-only   # 18 / 18 · 산출물 0
node demo/test/memo_cdp.js --read-only      # 18 / 18 · 산출물 0
```
- issue92 온라인 구간(재생성 실행): 후보 물대포 → [공격기 1과 교체] · 후보 전기탄 → [공격기 2와 교체] · 후보 흡수 새싹 → [유지], 매 단계 양측 `skills/cds/공개/seq/난수` 동일 · 대기 측 body HTML 후보 이름 수 증가 0 · 송신 0. 실제 볼 투척(시드 1) → 양측 예비 `{skills:[water_stable,lightning_stable,sup_heal,sig_std], cds:[0,0,0,0], rev:[], hp:70/100, el:fire, art:M-F1, atk:20, alias:false}`. 콘솔 오류 0. (후보는 온라인 매칭 시드가 매 실행 다르므로 원 납품과 다른 기술이지만 계약 판정은 동일)
- file:// PVE 구간: 시드 30 감전 침 → 교체·쿨 [2,1,0,0] 승계·공개 [0,1]→[1] → 버튼 `⚡감전 침 22`·설명 "번개 속성으로 판정" → 29 피해·감전·화상 0. 원 납품과 동일.

### 2.3 Saturn `--read-only` 재실행 경로 (산출물 0)
```
node demo/test/smoke_cross_skill.js         # 파일 쓰기 0 (기준판 git show 읽기·변형은 메모리) · BASE_REF=<ref> 로 기준 커밋 변경 가능
node demo/test/issue92_cdp.js --read-only   # 스크린샷·JSON 없음, 임시 Chrome 프로필(cross92cdp-*)·PORT=0 서버만 생성·정리
node demo/test/issue93_cdp.js --read-only
node demo/test/memo_cdp.js --read-only
```
주의: `smoke_cross_skill` K절은 `git show d614392:demo/index.html` **읽기**만 한다. 병합 트리에서도 K2(recruit 없는 5경기 기준판과 완전 일치)가 통과했다 — #93·#94 는 RNG·전투 로그를 바꾸지 않는다는 뜻이다 [확정].

---

## 3. 통합 리스크 · 검증된 한계

| 구분 | 내용 | 상태 |
|---|---|---|
| [확정] 래퍼-코어 결합 | 1.2 결함은 "동기화 모달 래퍼가 코어 `modal()` 의 부수 효과(#94 토큰)를 우회"한 구조 문제였다. 수정 후 잠금 화면도 코어를 지나므로 앞으로 코어에 붙는 소유권 규칙은 자동으로 적용된다 | 수정·회귀 추가 |
| [확정] 다른 동기화 모달 | masked 분기는 포획 선택 등 모든 소유자 전용 동기화 모달의 비소유자 화면에 적용된다(문구 종전과 동일). smoke_online 157·minion_art 199·memo 122·issue93/memo CDP 통과 | 변경 없음 |
| [확정] 좌표 | #93 행 반사는 표시만 바꾸고 `dataset`·네트워크 좌표는 논리 좌표라 #92 CDP·온라인 흐름은 무영향 | 통과 |
| [미확정] 사람 체감 | 교체 선택 빈도·타 속성 조합 밸런스는 CJ 플레이 QA | 미측정 |
| [문서화된 한계] 보드 AI | 전투 전 승률·전투 쌍 점수(`aiWinProb`·`aiBattlePairScore`)는 본체 속성 추정 그대로. 승인 범위(전투 AI 5급·5단)밖의 기록 사항이며 새 승인 게이트가 아니다 | 기록 |
| [미확정] 환경 | headless Chrome desktop-1280 · file:// · 127.0.0.1 HTTP 만. 모바일 뷰포트·wss·LAN 원격 미측정 | 미측정 |
| 제외 | 작업 트리의 `README.md`·`.gitattributes`·`docs/creat2ve/HANDOVER_SNAPSHOT.md` 변경은 PD 작업이며 이 납품에 포함하지 않는다. `art/`·`orca-hook-latency-report.md`·서버 제품·기획·아트 미접근 | — |

---

## 4. 최종 SHA256 (작업공간 상대 경로, 통합 후 작업 트리)

| 파일 | SHA256 |
|---|---|
| `demo/index.html` (3192행) | `0fe0bf450c5c29bd3d2a65034cdd832b16927fc898774f5b7d3c2ebecbcb7fbb` |
| `demo/test/harness.js` (병합 결과 그대로) | `51c73dd5f8fc29543de6c40e8f23b21ab2ec837652cb98d49f31ce5220c5881c` |
| `demo/test/smoke_shock.js` (변경 없음) | `6db34bf0caccdacd616a4cb5b32cd6f3f37f97a37ad9be0499156cb0ac512a27` |
| `demo/test/smoke_cross_skill.js` (425행) | `5bda168468f52c582388da1d57c4f385e3c6bcaa7396c3abc5d14a3345c5182d` |
| `demo/test/issue92_cdp.js` (259행, 변경 없음) | `04545d72f386675bc1c4f7220ba93a83d86aa82ce977eb8485f96a0eefdbe3ef` |
| `demo/test/smoke_memo.js` (dev 그대로) | `6ce4d233aa4701ce06494e723f57ba195e8e05cfc440dc89861840363c711eee` |
| `demo/test/smoke_own_side.js` (dev 그대로) | `4211943867fd407974c45e7fb282430223c702e0941532536183e515579b7e80` |
| `demo/test/issue93_cdp.js` (dev 그대로) | `8e1c3cb9b5039b632471412ca70799b988a1e6292b770ccad2fd1d50b91226ed` |
| `demo/test/memo_cdp.js` (dev 그대로) | `8431545b37f636b4ac7f408d776797606546196335fb87ca042717853cd3662e` |
| `docs/qa/issue92/issue92_cdp_report.json` | `4787fd14a9583024372eef6bb3abcbc52283b493b51f6cf2ecc39614c4565d08` |
| `docs/qa/issue92/1-pve-recruit-modal.png` | `e9f6d64df07ac05b0f9a422aedd2b20dc1da3969b5797e271e4c9a5be8080bdf` |
| `docs/qa/issue92/2-pve-battle-buttons.png` | `0892e7319917f3397001b15fdadcffb91a2817f7443f50c9ebe2599d829bbf48` |
| `docs/qa/issue92/3-pve-cross-skill-hit.png` | `b974aeaaf7ba0c45bc3fb58785d52bb2a5f2bf152f6ead2edbc412a6a6efeab8` |
| `docs/qa/issue92/4-online-actor-recruit-modal.png` | `350d2f1fdc265444ae584e54448b54f7ec5bd2dc64dc15c46af5f6c6a3c7fafc` |
| `docs/qa/issue92/5-online-waiting-view.png` | `deafc69e935e7511ac5b3fb935b6fc499d85f77eb971694d64bade52c5485a8f` |

이번 후속 납품에서 바뀐 파일(병합 결과 대비): `demo/index.html` +2/−2 · `demo/test/smoke_cross_skill.js` +5 · `docs/qa/issue92/`(스크린샷 5장·JSON 재생성) · 신규 `docs/qa/issue92-integration.md`.
