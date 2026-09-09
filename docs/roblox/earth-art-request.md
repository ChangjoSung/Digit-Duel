# [Earth 요청] Digit Dual Roblox 포팅 — 아트 자산 납품 요청

> **사용법**: 아래 `--- PROMPT ---` 이후 전체를 Codex(Earth 역할) 세션에 그대로 붙여넣는다.
> 작성: Mars (Claude Code) 2026-09-09 · Ref #118 · 기준 브랜치 `feature/118-roblox-port`

--- PROMPT ---

## dispatch preflight

| 필드 | 값 |
|---|---|
| required_role | **Earth** (Art, Codex) |
| mode | IMPLEMENT |
| area | ART |
| mutation | assets / docs (코드 수정 금지) |
| instance_index | null (단일) |

역할 계약(CLAUDE.md rev 6): Earth는 **아트 자산·문서만** 만든다. Luau·JS·Python 등 코드 작성·수정 금지, 기획 결정 대체 금지(불명확하면 `[기획 필요]`로 보고), git 쓰기 금지. 결과는 `worker_done` 형식으로 Mercury(PD)에게 보고한다.

## 1. 배경

- CJ 결정(2026-09-09): HTML 데모(`demo/index.html` v0.4.5)를 **Roblox**로 포팅한다. 구현은 Mars, 아트는 Earth.
- Mars가 Phase 1(룰 엔진·서버 권위·최소 UI)을 `roblox/` 에 구현했다. 현재 클라이언트는 텍스트·이모지·단색 박스로만 그린다.
- Phase 2(본 UI·연출)에 들어가려면 Roblox용 아트 자산이 필요하다. **이 요청은 그 자산 일체의 납품**이다.
- 하수인 20종 외형은 이미 v0.4.3에서 확정·납품됐다 (`demo/assets/minions/`, 원본 `docs/art/minions-v0.4.3/pixel-sources/*.json`, 생성 도구 `tools/minion_art.py`). **디자인을 바꾸지 말고 Roblox 규격으로 재출력**한다.

## 2. 반드시 읽을 참조

1. `docs/minion-visual-spec-v0.4.3.md` — 하수인 외형 규격·검수 기준(7장)·아키타입 실루엣 원칙
2. `docs/art/minions-v0.4.3/README.md`, `art-pipeline.md`, `delivery-manifest.csv` — 기존 납품 파이프라인
3. `demo/index.html` `<style>` 블록 (7~242행) — 현행 팔레트(`--fire --water --grass --lightning --panel --line --dim --buff` 등)·보드 셀 색·전투 토큰 규격
4. `roblox/README.md`, `docs/roblox/port-plan.md` — 포팅 구조와 Phase 계획
5. `roblox/src/client/init.client.luau` — 현재 클라이언트가 그리는 요소 목록(무엇이 자산으로 대체될지)
6. `ASSET-LICENSE.md` — 자산 라이선스 표기 규칙 (신규 자산도 동일 적용)

## 3. Roblox 플랫폼 제약 (납품 규격의 근거)

| 항목 | 제약 | 납품 지침 |
|---|---|---|
| 이미지 형식 | **PNG(알파) 또는 JPG만**. WebP·SVG·GIF 불가 | 전부 PNG-32(알파) 또는 PNG-8. 기존 `portrait.webp`는 사용 불가 → PNG 재출력 |
| 최대 크기 | 1024×1024 초과 시 자동 축소(품질 저하) | 모든 자산 ≤ 1024px. 스프라이트 시트도 1024 안에 배치 |
| 픽셀아트 확대 | 클라이언트가 `ResampleMode = Pixelated`로 정수 배율 표시 | 도트 원본은 **정수 배율**로만 출력 (64 그리드 → 256 = 4×). 보간 금지 |
| UI 프레임 | `ImageLabel.ScaleType = Slice` (9-slice) | 프레임류는 9-slice 가능한 형태로 제작하고 **슬라이스 경계(px)** 를 manifest에 기재 |
| 텍스트 | 코드에서 렌더(로컬라이즈·크기 대응) | 이미지에 **글자를 굽지 않는다**. 배너·버튼은 프레임만 |
| 이모지 | 플랫폼(PC/모바일/콘솔)별 글리프 차이·누락 | 현재 이모지로 표현되는 요소(👑🤝💣🪤🔥💧🌿⚡🔍🛡🎯 등)는 **전부 래스터 아이콘으로 대체** |
| 모바일 | Roblox 이용자 다수가 모바일·세로 | 터치 최소 44px 기준. 아이콘은 32px 축소에서도 식별 가능해야 함 |
| 업로드 | rbxassetid 발급은 Studio/Open Cloud 업로드 필요 | **업로드는 Mars가 한다.** Earth는 파일 + manifest만 납품 |

## 4. 납품 목록

우선순위: **P0 = Phase 2 착수 필수 / P1 = Phase 2 완료 필수 / P2 = 출시 전**

### P0-A 하수인 20종 Roblox 재출력 (디자인 변경 없음)

| 용도 | 크기 | 형식 | 원본 |
|---|---|---|---|
| 보드 아이콘 | **64×64** | PNG-32 | 기존 icon(32) 원본 그리드에서 2× 정수 확대 (재작업 아님) |
| 전투 도트 | **256×256** | PNG-32 | 64×64 도트 그리드 → 4× 최근접 확대 |
| 설명창 일러스트 | **512×512** | PNG-32 | 기존 `portrait.png` 그대로 (webp 제외) |

- 경로: `roblox/assets/minions/<속성>_<아키타입>/{icon64.png, battle256.png, portrait512.png}` — 폴더명은 기존 20종과 동일(`fire_std` … `lightning_sustain`)
- 발 위치·기준선 통일(규격 3.2)은 기존 그대로 유지

### P0-B 말 토큰·기호 (이모지 대체 — 규격 7.10.1 "확정 표시와 추측 메모는 같은 기호")

| 자산 | 수량 | 크기 | 비고 |
|---|---|---|---|
| 말 토큰: 왕·동료·폭탄·함정 | 4 | 64 + 128 | 보드 칩 + 전투 스테이지(왕·동료 본체는 도트 없음 — 현행 속성색 원형 대체) |
| 미공개 말 `?` | 1 | 64 | 상대 미공개 말. 아군/적군 색은 코드에서 틴트하므로 **흰색 단색 + 알파** |
| 속성 아이콘 불·물·풀·번개 | 4 | 64 | 보드 정보행·배지·기술 버튼 접두 |
| 추측 메모 8종 | 0 | — | 위 토큰 4 + 속성 4를 **그대로 재사용** (신규 제작 금지 — 기호 어휘 통일) |
| 흔적 마커(🔍 대체) | 1 | 48 | 탐색 가능 칸 표시 |

### P0-C 보드 타일·하이라이트

| 자산 | 크기 | 비고 |
|---|---|---|
| 셀 배경 4종: 자기 진영 / 상대 진영 / 숲 / 중앙 | 128×128 (타일) | 현행 색(`.zA .zB .forest .cell`) 계승. 숲은 "숨을 수 있는 곳"이 읽히는 질감 |
| 하이라이트 3종: 이동 가능(파랑) / 공격 가능(빨강) / 선택(노랑) | 128×128, 9-slice 또는 테두리 오버레이 | 셀 위에 겹치는 알파 오버레이 |
| 도망 교환 후보(파랑 변형) · 강제 전투 대상(빨강 강조) | 2 | 위 3종의 변형이면 됨 |
| 보드 외곽 프레임 | 9-slice | 7×13 보드를 감싸는 프레임 |

### P0-D UI 프레임·아이콘

| 자산 | 수량 | 비고 |
|---|---|---|
| 패널 프레임 (사이드·전투·모달) | 3 | 9-slice, 다크 테마(`--panel --panel2 --line`) |
| 버튼 4상태 × 3종 (기본 / primary 파랑 / danger 빨강) | 12 | 9-slice: normal / hover / pressed / disabled |
| 배지 프레임 | 1 | 9-slice |
| HP 바 배경·채움 · 방어막 바 배경·채움 | 4 | 9-slice 가로. 채움은 흰색(코드 틴트) |
| 상태 아이콘 7종: 방어막·화상·약화·감전·감쇠(피격 감소)·집중·피격+15%(결정타 반동) | 7 | 48×48 |
| 아이템 3종(회복약·쿨링수·해독제) + 몬스터볼 + 예비 하수인 슬롯 | 5 | 64×64 |
| 행동 아이콘 9종: 탐색·텔레포트·회복·주 행동 생략·턴 종료·기권 / 싸우기·가방·포획·도망 | 10 | 48×48 |
| 기술 종류 아이콘 3종: 공격기·보조기·시그니처 (미공개 슬롯 `?` 표시용) | 3 | 32×32 |

### P1 전투 연출·배너 (FX 계약 #106 — 시간표는 코드가 가짐)

| 자산 | 비고 |
|---|---|
| 전투 스테이지 배경 | 1024×512 이하. 상단(상대)/하단(나) 토큰 위치 여백 |
| 속성 플래시 오버레이 4색 · 시그니처 점멸 프레임 | 알파 오버레이 |
| 배너 프레임 4종: 턴 시작(나/상대 색 변형) · 접촉 경고 · 결과(승/패) · 버닝 타임 | 9-slice, 텍스트 없음 |
| 폭발 · 함정 발동 · 피해 팝(숫자 배경) · 포획(볼 투척) · 도망 | 스프라이트 시트 (프레임 수·크기 자유, ≤1024) |
| 카운트다운 3·2·1 프레임 | 숫자는 코드 텍스트 — 원형 프레임만 |

### P2 스토어·모바일

| 자산 | 규격 |
|---|---|
| Roblox 경험 아이콘 | 512×512 PNG |
| 썸네일 | 1920×1080 PNG (1~3장) |
| 메뉴·매칭 대기 키 비주얼 · 로고 | 1024 이하 |
| 모바일 세로 레이아웃 시안 | 1080×1920 목업 1~2장 (`docs/`에 문서로) |

## 5. 파일 구조·매니페스트

```text
roblox/assets/
├─ manifest.csv          # path, kind, w, h, slice(l,t,r,b), tint(yes/no), source, notes
├─ minions/<el>_<arch>/{icon64,battle256,portrait512}.png
├─ tokens/{king,ally,bomb,trap}_{64,128}.png · unknown_64.png · trace_48.png
├─ elements/{fire,water,grass,lightning}_64.png
├─ board/{tile_own,tile_enemy,tile_forest,tile_mid,hl_move,hl_attack,hl_sel,hl_flee,hl_forced,frame}.png
├─ ui/{panel_side,panel_battle,panel_modal,btn_*_{normal,hover,pressed,disabled},badge,hpbar_bg,hpbar_fill,shbar_bg,shbar_fill}.png
├─ status/{shield,burn,weaken,shock,dmgcut,focus,vuln}_48.png
├─ items/{potion,cool,cure,ball,reserve}_64.png
├─ actions/{search,teleport,heal,skip,endturn,resign,fight,bag,capture,flee}_48.png
├─ skillkind/{attack,support,sig}_32.png
└─ fx/ (P1)  banners/ (P1)  store/ (P2)
```

- `manifest.csv`의 `tint=yes`는 "흰색 단색으로 만들어 코드가 색을 입힌다"는 뜻 — `?` 토큰·HP 채움·하이라이트에 적용
- 기존 파이프라인(`docs/art/minions-v0.4.3/delivery-manifest.csv`)과 같은 열 구성을 유지하고 열을 추가하는 방식으로

## 6. 제작 원칙·금지

1. **디자인 정체성**: 하수인 20종은 기존 확정 디자인 그대로 — 색·실루엣·표정 변경 금지. 신규 토큰(왕·동료·폭탄·함정)은 같은 도트 언어·팔레트로
2. **흑백 실루엣 검수**(규격 7): 토큰 5종 + 속성 4종은 색을 빼도 구별돼야 한다
3. **32px 축소 검수**: 보드 칩에서 64→32로 줄여도 왕/동료/폭탄/함정/`?`가 구별돼야 한다
4. **기존 유명 IP 연상 금지**(규격 1·7): 포켓몬·기타 캐릭터의 실루엣·색 배치·특징 요소 복제 금지
5. **텍스트·이모지 금지**: 이미지 안에 글자·이모지 없음
6. **코드 작성 금지**: Luau·JS·Python 수정·추가 금지. `tools/minion_art.py`로 재출력이 필요하면 **파라미터 변경 요청을 보고서에 적어 Mars에게** 넘긴다 (직접 고치지 않는다)
7. **라이선스**: 신규 자산은 `ASSET-LICENSE.md` 규칙대로 표기 — 외부 소재 사용 시 출처·라이선스를 manifest `source`에 기재. 불명확한 소재는 사용하지 않는다

## 7. 수용 기준 (AC)

- [ ] P0 전 항목 납품 · manifest.csv 에 전 파일 등재 · 모든 PNG ≤ 1024px · WebP/SVG 0개
- [ ] 하수인 20종 × 3규격 = 60장, 기존 디자인과 픽셀 단위 일치(정수 확대만)
- [ ] 9-slice 자산은 슬라이스 경계가 manifest에 있고 늘렸을 때 모서리가 깨지지 않음
- [ ] 흑백 실루엣·32px 축소 검수 결과를 보고서에 스크린샷으로 첨부
- [ ] 이모지·텍스트가 구워진 이미지 0개
- [ ] `[기획 필요]` 항목(8장)은 임의 결정하지 않고 목록으로 보고

## 8. `[기획 필요]` — Earth가 결정하지 않고 보고할 것

- 왕·동료의 **캐릭터 외형**(현재 이모지 👑🤝) — 사람형? 상징형? 성별·종족 표현 여부
- 폭탄·함정의 **세계관 설정**(마법 장치? 기계?) — 스타일 방향
- 아군/적군 구분을 **틴트(파랑/빨강)** 로만 할지, 별도 프레임을 둘지
- 모바일 세로에서 7×13 보드의 **최소 셀 크기**(터치 44px 기준 시 보드 높이 572px+) — 세로 스크롤 vs 축소
- 경험(Experience) 이름·아이콘 컨셉 — CJ 결정

## 9. 보고 형식 (`worker_done` → Mercury)

```yaml
worker_done:
  role: Earth
  instance_index: null
  dispatch_ref: "#118 Roblox 아트 P0"
  files_modified: [ "roblox/assets/**", "docs/art/roblox-v0.5.0/earth-report.md" ]  # 코드 파일 0개
  summary: |
    납품 수량 · 규격 검수 결과(흑백 실루엣·32px) · 스크린샷 경로
  requests_to_mars: |
    tools/minion_art.py 파라미터 변경 요청(있으면) · 업로드 시 주의점
  planning_needed: [ ... 8장 항목 중 판단 필요한 것 ... ]
  qa_request: Saturn 검수 요청 항목
```

보고서 위치: `docs/art/roblox-v0.5.0/earth-report.md` (기존 `docs/art/minions-v0.4.3/` 구조와 동일한 포맷).

--- END PROMPT ---
