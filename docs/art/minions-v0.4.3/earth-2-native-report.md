# [결정] Earth_2 native32 파일럿 소스 납품

- 날짜: 2026-09-07 / Issue #87
- required_role=Earth; instance=Earth_2; instance_index=2; mode=IMPLEMENT; area=ART; mutation=assets; provider=Codex.
- 상태: 파일럿 2종의 정적 아트 소스 완료. PNG export와 독립 시각 QA는 Mars·Saturn 후속이며 최종 아트 PASS를 주장하지 않는다.
- 근거: 이번 dispatch에 명시된 CJ의 native 직접 픽셀 제작·전투 국소 보정 승인이 과거 문서의 제작 방식 대기 표기보다 우선한다.

CLAUDE.md, docs/minion-visual-spec-v0.4.3.md, source-qa-saturn.md, 이전 earth-2-report.md 전문을 읽었다. Downloads의 두 종 portrait.png, battle.png, battle-grid.png 총6개를 직접 열었고 64격자 원본을 메모리에서 최근접 확대해 관찰했다. 원본64의 팔레트와 좌표별 색을 문자 행으로 출력하여 수정 위치를 선택했다. 신규 icon은 이미지를 축소하거나 도형으로 대체하지 않고 각32행의 ASCII 셀을 직접 작성했다. 최종 중심 보정은 이미 작성된 픽셀의 위치 이동이며 형상 생성이 아니다.

## 확정: 납품 데이터 및 검증

| 항목 | grass_atk | lightning_atk |
|---|---:|---:|
| 아이콘 격자 / 행 길이 | 32×32 / 32행 모두32자 | 32×32 / 32행 모두32자 |
| 사용 불투명 색 | 11 | 10 |
| 불투명 셀 | 391 | 321 |
| 불투명 bbox, 양끝 포함 | x3..28, y2..29 | x4..29, y2..29 |
| 알파 마스크 평균 x | 15.52685 | 15.34268 |
| 전투 실제 변경 셀 | 35 | 28 |
| 전투 수정 범위 | x47..54, y20..24 | x27..37, y19..28 |

읽기 전용 Python stdin 검사로 JSON 파싱, 행 수·폭, 단일 ASCII 팔레트 기호, 미정의 기호 없음, 투명 제외16색 이하, `.`=#00000000, 나머지 #RRGGBB 불투명 색, 상하좌우2칸 전부 투명, 최하단 y29를 확인했다. 패치 좌표는64 안이며 중복과 무효 override가 없다. 두 패치 모두 기준 SHA `202edf3c23e65453bd7db8dd9fed5fdf0587fd0d`의 원본 battle-grid PNG와 Downloads 원본의 파일 바이트가 정확히 일치함을 `git show` 읽기와 비교로 확인했다. 마스크 평균 x는 지각적 중심의 참고 수치이며 인간 시각 중심 판정의 대체가 아니다.

| 소스 | SHA-256 |
|---|---|
| pixel-sources/grass_atk.json | 114123b251bb8de0432b3f9edadd7c1f8d59b09d6d43d64688e8a546fc871e14 |
| pixel-sources/lightning_atk.json | 6a1a15d93dcdd58a0640ce20d85bc16f04b742055041ad508845aa6447db0210 |
| battle-patches/grass_atk.json | feca7233aba83f4310d7babf5c34d047d5a34048ca599850a75ad691b6e6e14a |
| battle-patches/lightning_atk.json | b5726ecab9dd2bfb1b5bd1f6746b868fc79002a0d8e7ae4006a6830ed2d49c4b |

## 아트 의도와 후속 검토점

grass_atk: 원본의 오른쪽으로 벌린 긴 턱과 S자 덩굴 목, 좌우 가시 채찍, 나무 뿌리를 남겼다. 전투는 기존 턱에 둘러싸인 입 내부35셀만 바꾸어 크림색 윗니3개·아랫니2개 및 짙은 구강을 넣었다. 이 중14셀은 원래 투명했던 입 내부이며 외곽 머리나 줄기를 새로 만든 것이 아니다. 신규 적갈색 #632632는 원본의 붉은 가시와 어두운 입 사이 중간톤이다. 아이콘은 크게 보이는 치아와 어두운 입, 크림색 줄기 내측, 갈색 나무 띠를 서로 분리했다. Saturn은 입이 눈이나 붉은 문양으로 오독되지 않는지, 채찍과 뿌리가 같은 식물 몸으로 연결되어 보이는지 확인해야 한다.

lightning_atk: 원본의 긴 머리뿔·상아 어깨·가느다란 남색 갑주·구리색 왼쪽 낫팔·오른쪽 대각선 창·갈라진 발톱을 유지했다. 전투28셀은 모두 기존 불투명 셀이고 원본 팔레트 색만 사용했다. 얼굴의 상아 면과 호박 눈을 남기고 턱 아래 남색 경계, 공격팔의 청색 면을 이어 얼굴·가슴·창의 밝은 면 사이를 나눴다. 아이콘도 얼굴과 가슴에 별도 상아 면을 두고 오른팔에 청색 띠를 남겼다. Saturn은 얼굴 방향, 눈과 머리뿔의 분리, 팔에서 창까지 연결되는 해부학적 읽기를 특히 확인해야 한다.

두 아이콘 모두 어두운 내부선을 두고 머리·무기·잎·발 일부에 밝은 림을 배치했다. HP·텍스트·숫자·별도 원소 글리프는 없다. 무기 형상의 금색 대각선은 원본 창의 일부다. 세 배경 #33406e/#6e3340/#3a4152에서의 실제 대비·1x 식별성과 흑백 실루엣 판정은 아직 수행하지 않았으므로 보장하지 않는다.

## 인계와 제한

Mars에는 coordinator CLI status로 두 종의 소스4개가 준비됐음을 알렸다. 마지막 중심 보정과 무효 override 제거 이후 위 해시의 최종 소스를 사용해야 한다. Mars가 canonical64에 패치를 적용하고 battle128 및 icon32와 미리보기를 export한다. Earth는 PNG·renderer·tool·script 파일을 만들거나 수정하지 않았다. 이번 턴은 소스 완료 시 종료하므로 export된 최종 이미지의 직접 시각 검토, 세 배경 미리보기, portrait/battle/icon 삼자 동일성 최종 판정은 미수행이다. Saturn 독립 QA와 CJ 최종 판단이 남는다. 나머지8종은 파일럿 QA 이후 별도 후속 dispatch 범위다.

제품 demo/index.html·server·gameplay 변경과 게임/브라우저/DPR 회귀 검사는 범위 밖이다. repo art/, orca-hook-latency-report.md, Downloads 원본은 읽기 전용으로 유지했다. Git 쓰기·GitHub·Notion 쓰기·하위 위임 없음. 원본과 파생 아트의 권리 조건은 ASSET-LICENSE.md를 따르며 권리 체인·상용 캐릭터 유사성 포괄 검증을 주장하지 않는다.

## files_modified

- docs/art/minions-v0.4.3/pixel-sources/grass_atk.json
- docs/art/minions-v0.4.3/pixel-sources/lightning_atk.json
- docs/art/minions-v0.4.3/battle-patches/grass_atk.json
- docs/art/minions-v0.4.3/battle-patches/lightning_atk.json
- docs/art/minions-v0.4.3/earth-2-native-report.md

## [피드백] V1 lightning_atk 얼굴 수정 — 2026-09-07

required_role=Earth; instance=Earth_2; instance_index=2; mode=IMPLEMENT; area=ART; mutation=assets; provider=Codex. 상태: **sourcefixed**. 이번 수정의 files_modified는 `docs/art/minions-v0.4.3/pixel-sources/lightning_atk.json`, `docs/art/minions-v0.4.3/earth-2-native-report.md` 두 파일뿐이다.

현재 icon.png, Downloads 원본 portrait.png, review/icons-board-backgrounds.png를 직접 열람했다. Saturn이 지적한 밝은 세로선 대신 x13..16,y8..11에 이마·호박 눈(14,9)·뺨·턱을 모으고, y12의 x13..17을 어두운 목/갑주로 연결했다. 뿔·대각선 창·남색 갑옷·낫팔·다리 포즈는 보존했다. 실제 변경은 **x12..17,y8..12 안 17셀**이며, 이 밖의 1007셀 및 팔레트는 동일하다.

좌표는 0부터 시작한다. 아래 각 항목은 `x:이전→이후`이며 모든 변경을 열거한다.

| y | 변경 x와 팔레트 기호 | 셀 수 |
|---|---|---:|
| 8 | 12:s→k, 14:i→u, 15:k→i, 16:.→i, 17:w→k | 5 |
| 9 | 14:i→o, 17:b→k | 2 |
| 10 | 14:g→i, 15:k→i, 16:b→k, 17:b→k | 4 |
| 11 | 13:i→s, 14:k→i, 16:s→k | 3 |
| 12 | 13:i→k, 14:k→s, 17:i→b | 3 |

기호 색: `.`=#00000000, k=#151827, s=#252D4A, b=#3C4D7C, u=#7385AA, i=#DDCF9C, w=#FFF2C2, g=#E5B839, o=#C96523. 불투명 셀 **321→322**(기존 불투명16셀 재색칠 + 투명1셀 추가), 사용 불투명색 **10→10**, bbox **x4..29,y2..29 유지**, 알파 **0/255**, 32행×32자·2칸 투명 여백·최하단 y29 모두 확인했다. 알파 마스크 평균 x는 **15.34268→15.34472**이며 시각 중심 목표15.5의 참고 수치일 뿐 독립 지각 판정이 아니다.

수정 파일을 기존 Mars `load_icon_source`/`render_icon`으로 다시 읽어 검사했으며 경고0이었다. `python -B` stdin과 메모리 버퍼만 사용해 이전 PNG와 수정 원고의 **32px 1:1·최근접 4배율을 #33406e/#6e3340/#3a4152 세 배경에서 나란히 직접 확인**했다. 제작자 관찰상 작은 얼굴 면과 눈이 생기고 턱 아래 어두운 단절이 보여 머리와 가슴의 밝은 선이 분리되었다. 원래 무기·뿔·발의 밝은 림과 세 배경 위 전체 포즈는 유지된다. PNG·스크립트·도구 파일은 저장하거나 수정하지 않았다.

소스 SHA-256: 이전 `6a1a15d93dcdd58a0640ce20d85bc16f04b742055041ad508845aa6447db0210` → V1 `8497b1c2f94dbf91862c9a8a3aaf2659e524c85b8c93210c889c7cc195a770c0`.

남은 제한: 눈은 1셀이고 얼굴은 작은 각진 면이므로 실제32에서 방향 식별은 여전히 Saturn 재판정 대상이다. 어두운 갑주 일부의 낮은 대비는 유지되며, 제작자 관찰을 독립 PASS로 보고하지 않는다. **Mars의 최종 PNG·시트 재출력과 Saturn 독립 재검수**가 남는다. 전투 패치·grass·기타 아이콘·제품·사용자 보호 파일은 수정하지 않았고 나머지16종에는 착수하지 않았다.

## [피드백] V2 lightning_atk 전체 비례 재구성 — 2026-09-07

required_role=Earth; instance=Earth_2; instance_index=2; mode=IMPLEMENT; area=ART; mutation=assets; provider=Codex. 상태: **sourcefixed**. 이번 files_modified는 `docs/art/minions-v0.4.3/pixel-sources/lightning_atk.json`, `docs/art/minions-v0.4.3/earth-2-native-report.md` 두 파일이다.

V1 QA와 spec7.6, 원본 portrait 및 현재 V1 PNG를 확인하고 32격자 전체를 직접 다시 구성했다. V1 대비 **452셀 변경**이며 팔레트는 유지했다. 쌍뿔·상아 얼굴·남색 갑주·오른쪽 창과 공격팔·주황 낫팔·갈라진 발톱을 보존하면서 긴 전투용 사지를 압축했다. 창을 얼굴 오른쪽 바깥으로 떼고, 가슴의 밝은 세로선을 짧게 줄였으며 낫팔 끝을 안으로 굽혀 선이 아닌 갈고리 덩어리로 만들었다.

좌표는 0부터 시작한다. 얼굴은 **y9..16의 8행**으로 V1의 4행 대비 두 배다. 뿔의 돌출부를 제외한 투구/머리 본체는 **y6..17의 12행**, 어두운 목 단절은 **y18, x13..16**, 몸통·다리는 **y19..29의 11행**이다. 머리 본체 시작부터 발까지 24/12=**2.0등신**, 돌출 뿔까지 포함한 전체 높이도 28/12=**2.33**이다. 밝은 얼굴을 작은 점이 아닌 연속 면으로 확보하고, y11의 비대칭 눈썹과 y12의 두 호박 눈/검은 눈 틈, 오른쪽으로 남긴 뺨 및 y15..17의 좁아지는 턱으로 정면에 가까운 약한 오른쪽 방향을 표현했다.

기존 Mars `load_icon_source`/`render_icon`을 **python -B stdin**에서 불러와 메모리 RGBA로 검사했다. 중간안의 왼쪽 치우침과 곧은 낫팔을 수정한 뒤, 최종안도 **실제32 및 최근접4배를 #33406e/#6e3340/#3a4152 모두에서 직접 열람**했다. 제작자 관찰상 큰 얼굴과 눈 틈·턱이 먼저 묶여 읽히고, 그 아래 어두운 목·짧은 갑주·짧은 두 다리가 분리되어 V1의 무기 교차/긴 막대 체형이 해소됐다. 밝은 림은 뿔·창날·어깨·발 등에 선택적으로 남겼다. 검증값은 **32×32, 불투명10색, 392셀, alpha={0,255}, bbox x3..29/y2..29, 외곽2칸 투명, 최하단 y29, 경고0**이다. 알파 평균 x=**15.553571**이며 중심 목표15.5 근처의 참고 지표이지 지각 중심의 독립 판정은 아니다.

최종 소스 SHA-256: `6c8869f1613559f6e4db4ea302daac91353e48f3051319bb35ccf3cf1b73f6cf`. 메모리 렌더의 RGBA 원시 바이트 SHA-256: `70a4c47890d9713c150397778bc866556c9f201a249c92b02bee6384aeee9e16` (**PNG 파일 해시가 아님**). PNG·미리보기·도구·스크립트 파일 저장은 하지 않았다. 시작/종료 해시 비교에서 기존 전체 PNG 및 다른 아이콘 원고·전투 패치의 불변을 확인했다. 같은 시간창에 `tests/test_minion_art.py` 및 tools/tests의 기존 pycache 2개 해시도 달라졌으나 Earth는 이 파일들을 쓰지 않았고 모든 Python 호출은 -B였다. 해당 변경의 작성 주체는 이 보고에서 단정하지 않으며 Mercury의 동시 작업 취합 대상이다.

남은 제한: 어두운 남색 하체 일부의 대비와 미세한 눈 방향은 Saturn 독립 시각 재판정 대상이다. **Mars가 이 소스로 PNG·시트를 재출력한 뒤 Saturn이 재검수**해야 하며, 제작자 관찰을 ART PASS로 대체하지 않는다. battle/portrait·제품·사용자 art/·Downloads 원본·orca-hook-latency-report.md는 편집하지 않았다. 나머지16종, 전체20종 실루엣 식별, 브라우저/DPR·게임 QA, 권리 유사성 포괄 검증 및 최종 CJ 승인은 이번 완료 범위에 포함하지 않는다. Git·GitHub·Notion 쓰기와 하위 위임은 없다.
