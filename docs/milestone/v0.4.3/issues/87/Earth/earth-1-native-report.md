# Earth_1 native32 파일럿 원고 납품

[결정] Issue #87, CJ 2026-09-07의 직접 native 픽셀 제작·전투 보정 구현 승인에 따라 지정된 두 종의 실제 아트 데이터를 작성했다. 명세와 이전 보고서의 제작 방식 승인 대기 문구는 최신 dispatch 승인으로 대체하여 적용했다.

- required_role=Earth; instance=Earth_1; instance_index=1
- mode=IMPLEMENT; area=ART; mutation=assets; provider=Codex
- taskId=task_67008f802435; dispatchId=ctx_9b3ca92f3af7
- 납품 범위: 아이콘 원고 2개 + 전투 보정 원고 2개 + 이 보고서, 총 5파일
- 상태: 파일럿 원고 완료 및 Mars export 요청 전달; PNG 납품·독립 시각 QA 완료를 의미하지 않는다.

## 실제 작업과 근거

`CLAUDE.md`, `docs/minion-visual-spec-v0.4.3.md`, `source-qa-saturn.md`, 이전 `earth-1-report.md`를 전문으로 읽었다. 두 종의 Downloads 원본 `portrait.png`, `battle.png`, `battle-grid.png`를 모두 직접 열어 확인했고, 64격자의 최근접 확대를 메모리에서만 열람했다. 원본의 RGBA 좌표를 읽어 손끝·몸통·얼굴 수정 위치를 선택했으며 파일로 렌더러·스크립트·미리보기를 만들지 않았다.

아이콘은 32개의 ASCII 행에 개별 픽셀을 직접 작성한 native32 원고다. 기존 battle 축소, 자동 도형 생성, 공통 몸통 템플릿, 이미지 생성 참고본의 축소·마스킹은 사용하지 않았다. 기호를 좌표에 배치하고 직접 고른 팔레트에 대응하는 정적 아트 데이터만 납품한다.

| 종 | 원본에서 유지한 정체 | 이번 원고의 처리 |
|---|---|---|
| fire_sustain / 재의 주술사 | 흰 세로 가면, 꽃잎형 칼라, 재색 망토, 검은 몸통, 양손 불씨, 세 갈래 연기 | 아이콘에서 가면과 넓은 칼라를 확보하고 손끝·가슴 균열에만 따뜻한 색을 집중했다. 회색 외형을 유지하며 내부 어두운 선과 선택적 회백색 림을 배치했다. |
| water_swift / 안개 무희 | 비대칭 물결 막날개, 흰 얼굴과 이마 지느러미, 가는 몸통, 긴 말린 꼬리 | 왼쪽 위·오른쪽 아래의 날개를 나누고 얼굴 면과 눈을 확보했다. 몸통을 중심으로 굽혀 날개 사이 빈 공간을 남기고 남색 내부선으로 얼굴과 날개를 분리했다. |

## 정적 검증 결과 [확정]

파일을 쓰지 않는 `python -B` stdin 검사로 JSON을 읽고 32행×32열, 사용 기호=팔레트 기호, 투명 점, 여백, 하단, 원본 좌표 및 패치 중복·실제 변경 여부를 확인했다. 초기 fire 원고의 여분 끝점 16행은 검증 중 발견하여 제거했고 최종 원고에서 행 길이 검사를 통과했다.

| 항목 | fire_sustain | water_swift |
|---|---:|---:|
| 크기 / 실제 행 | 32×32 / 32×32 | 32×32 / 32×32 |
| 사용 불투명 색 | 12 | 10 |
| 불투명 픽셀 | 306 | 348 |
| 알파 bbox, 우하단 제외 | (2,2,28,30) | (2,2,29,30) |
| 최하단 | y=29 | y=29 |
| 상하좌우 2px 점 여백 | 충족 | 충족 |
| 불투명 마스크 x 평균 | 15.715686 | 15.801724 |
| 전투 실제 변경 픽셀 | 28 | 25 |
| 패치 좌표 중복 / 동일색 무효 변경 | 0 / 0 | 0 / 0 |
| 패치 전후 알파 마스크 | 동일 | 동일 |

점은 `#00000000`, 나머지는 모두 6자리 RGB로 지정하여 opaque255다. HP·텍스트·속성 글리프를 굽지 않았다. x 평균은 불투명 픽셀의 산술 평균이며 **지각적 중심을 수학적으로 증명한 값이 아니다**. 아트는 x15.5를 목표로 균형을 잡았으나 최종 시각 중심 정렬은 실제 표시에서 확인해야 한다.

전투 패치는 모두 `baseline=202edf3c23e65453bd7db8dd9fed5fdf0587fd0d`에 대한 절대 64격자 좌표다. `git show` 읽기 전용으로 얻은 해당 baseline grid와 Downloads grid의 디코딩 RGBA 전체 일치를 확인했다. 53개 좌표는 모두 원본에서 이미 불투명한 픽셀이고, 기존 RGB와 다른 값으로 변경되며 좌표 범위 0..63 안에 있다.

- fire_sustain: 양손 18픽셀 — 왼손 x7..12,y39..43, 오른손 x51..55,y26..33 — 과 기존 몸통 불씨·균열 10픽셀만 보정했다. 흰 가면·칼라·연기·전체 실루엣은 보존한다.
- water_swift: x37..43,y19..24 얼굴 내부와 경계의 25픽셀만 정리했다. 큰 눈을 x40..41,y21..22에 묶고 얼굴 왼쪽과 턱 경계를 분리하며, 기존 원본 팔레트만 사용했다. 날개·이마 지느러미·몸통·꼬리·전체 실루엣은 보존한다.

| 원본 grid | SHA-256 |
|---|---|
| fire_sustain | 8f5f2dc0ecf03131c6a11a0decfe11534b3617c55c4f03d88bae03f29b389f0b |
| water_swift | 8b57c14d3a1d0b4b0ce0a598496127c4bdb73959d47f0cda4f07efa1c141a6d3 |

| 최종 아이콘 JSON | SHA-256 |
|---|---|
| fire_sustain.json | f82a2151c021e68a8639025e3252df4088e5a056c33cf5db2cb6d7e1cb9b137a |
| water_swift.json | 4fe547294f8565c8d896ea68566797bdd2ab6a6ad99e4fec687df82f0555626c |

## Mars 전달과 미확정 사항

Orca status `msg_5c610919ce27`로 PD에 네 원고 경로와 export 가능 상태를 전달했다. Mars가 baseline에 patch를 적용하여 canonical grid/battle과 native32 PNG를 내보내고, 1×·정수 확대·세 배경 `#33406e` / `#6e3340` / `#3a4152` 미리보기를 제공한다. Earth는 PNG 파일을 수정하지 않았으며 renderer·tool·script 파일도 작성하지 않았다.

**독립 QA 미완료:** 새 PNG의 실제 1× 가독성, 세 배경 대비, 선택 림의 적정성, portrait/수정 battle/icon 동일 캐릭터 인식, 얼굴 방향, 지각적 중심은 export 후 시각 검토 대상이다. 두 원고의 정적 규격 충족을 Saturn PASS 또는 20종 흑백 식별 PASS로 확대하지 않는다. 권리 체인·상용 캐릭터 유사성의 포괄 검증, 제품 표시·DPR·브라우저 확대·게임플레이 회귀도 이번 작업에서 검증하지 않았다.

남은 불·물 8종은 이번 파일럿 범위 밖이며 pilot QA 이후 fresh 후속 dispatch에서만 진행한다. 이 완료 보고 후 자체 대기·추가 제작을 시작하지 않는다.

## files_modified [정확히 5개]

1. docs/art/minions-v0.4.3/pixel-sources/fire_sustain.json
2. docs/art/minions-v0.4.3/pixel-sources/water_swift.json
3. docs/art/minions-v0.4.3/battle-patches/fire_sustain.json
4. docs/art/minions-v0.4.3/battle-patches/water_swift.json
5. docs/art/minions-v0.4.3/earth-1-native-report.md

사용자 `art/`, `orca-hook-latency-report.md`, Downloads 원본은 읽기 전용으로 유지했다. Git 쓰기, GitHub/Notion 쓰기, 하위 위임, `demo/index.html`·서버·게임플레이 변경 및 PNG 변경은 하지 않았다. Issue/PR 통합은 Mercury 소관이다.
