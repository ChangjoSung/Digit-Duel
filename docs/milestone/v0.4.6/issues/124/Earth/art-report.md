# [피드백] Earth — #122 / #124 / #126 아트 납품

> **2026-09-10 Mercury 후속 정정:** 아래는 Earth 납품 당시 보고다. 이후 Saturn이 왕 원본 왼쪽 아래 모서리 alpha=1(나머지 파생4개 모서리=0)을 확인했다. 본문의 모든 원본 모서리 alpha0이라는 전달은 정확하지 않았다. 최종 파생은 Mars가 LANCZOS 단순 축소로 납품했으며 원본은 보존했다. 도망은 fleeFx1200ms 뒤 교환 선택으로 이어지고, 적 포획은 captureFx1200ms 메시지 뒤 resultBanner2500ms 결과 단계로 이어진다. 각 상수는 보존한다. [현재 통합 검수 기록](../../122/Mercury/report.md).

2026-09-10 · Run `run_031dae03dc6e` · Task `task_361876d47908` · Dispatch `ctx_b66017b5187b`.

**신규 창작 아트 제안이며 CJ 최종 아트 승인 아님.** Earth / IMPLEMENT / ART / assets·docs / instance null / Codex 계약을 확인했다. 제품·도구·테스트 코드, Git/GitHub/Notion 쓰기는 수행하지 않았다.

| 산출물 | 역할 / 출처 | 상태 |
|---|---|---|
| [왕 원본](king-sovereign-source-v1.png) | built-in imagegen 신규 생성; 왕관·넓은 자주색 망토·홀 | 전체 이미지 육안 확인 |
| [동료 원본](companion-guide-source-v1.png) | built-in imagegen 신규 생성; 투구·청록 깃털·방패·좁은 기사 실루엣 | 전체 이미지 육안 확인 |
| [정확한 생성 프롬프트](prompts.md) | 서로 다른 자산별 builtin 호출 각 1회 | 저장 완료 |
| [#122 v2 보고](../../122/Earth/v2/report.md) | 현행 HTML/승인 하수인 및 제공 참조의 구도 | 정적 SVG 2개, v1 보존 |
| [#126 스토리보드](../../126/Earth/effect-storyboard.md) | CJ 효과 방향 / 현재 전투·경기 결과 구분 | Markdown + 정적 정점 SVG |

왕은 왕관과 망토의 넓은 삼각형, 동료는 투구·깃털과 방패의 세로형으로 구분했다. 팀 P1/P2는 기존 프레임으로 구분하는 방향이며 별도 전신 변종은 만들지 않았다. 기존 하수인보다 사람이지만 픽셀 군집·외곽선·단계 음영과 작은 머리/몸 비율을 맞춘 제안이다. 생성 그림이 정확한 64×64 수작업 그리드를 따른다고 주장하지 않는다.

원본 복사 출처는 실제 built-in 결과 폴더 `C:/Users/pc_77/AppData/Roaming/orca/codex-runtime-home/home/generated_images/01a08a18-78e0-79d3-8b8d-ccdfe1f79b4b/`이다. 왕은 `exec-3f08d0d9-0f62-48cb-a9f2-64615014dc86.png`, 동료는 `exec-f58da711-03aa-4e83-9b07-022a0ce03524.png`를 이름만 바꾸어 복사했다. 생성 원본은 삭제하지 않았다. CLI fallback·모델 교체·Python 창작을 사용하지 않았다.

PD와 조율하여 **게임 파생본은 Mars 소유**로 넘겼다: `demo/assets/leaders/king/{icon64,battle256}.png`, `demo/assets/leaders/companion/{icon64,battle256}.png`. alpha 실측·최근접 파생은 Mars가 맡고, PD의 역할 경계 명확화에 따라 Earth가 기존 Chrome CLI로 정적 SVG를 직접 렌더했다. 새 렌더링 스크립트는 만들지 않았다.

## 검사 및 한계

**Mars 실측 / PD 전달:** 두 원본 모두 1254×1254 RGBA, 실제 alpha 존재·모서리 alpha0·매트 없음. 요청 크기1024와 실제 출력 크기1254를 구분한다. Earth는 [실제 크기 비교 PNG](source-use-size-review.png) (980×730, [정적 SVG](source-use-size-review.svg))를 직접 열어 두 원본 각각 **32/128/256px**를 어두운 배경과 밝은 배경에서 확인했다. 왕의 넓은 왕관·자주색 망토와 동료의 좁은 청록 깃털/방패가32px에서도 구분되고128/256px에서 얼굴·장비가 읽히며 직사각형 매트는 보이지 않았다. 32px의 세부 얼굴은 축약되므로 실루엣 식별을 기준으로 했다. 이 비교는 원본을 지정 크기로 표시한 결과이며 Mars 게임 파생 PNG의 픽셀 검증을 대신하지 않는다.

Earth가 직접 렌더·확인한 추가 PNG: [보드420×910](../../122/Earth/v2/board-v2.png), [전투420×780](../../122/Earth/v2/battle-v2.png), [효과840×370](../../126/Earth/effect-keyframes.png). 보드는1차 렌더의 울타리 같은 잎을 더 둥근 픽셀 군집으로 수정한 뒤 재렌더·검토했다. 실제 숲28칸만 잎이 있고 일반63칸에는 없으며, 말32px·HP행·`?`·선택 테두리가 읽힌다. 전투는128px 기존 승인 하수인·반대편 HP판·하단 명령이 겹치지 않는다. 효과 그림은 글자와 승리/패배 정점 대비가 읽힌다. PNG들은 불투명 화면 시안이고 원본 캐릭터 PNG2개만 투명 자산이다.

원본 복사 무변경은 출처와 목적지 SHA256을 직접 대조했다: 왕 `0accd0f8fadfda2d48d9e9b2e3eb030a99df827753fea8a736100283853588f4`, 동료 `38a52a18f2842f6d866dce05c5498c46e28146b37c82c7feca99f3dfa2b8bed7`.

시각 검토를 제품 QA나 CJ 승인으로 확대하지 않는다. 무승부는 경기 무승부에만 사용하며 전투 판정 동률은 방어자 승리다. #126은 **내부 강한 효과1200ms / 기존 결과 배너2500ms 보존**, 도망·포획은 기존 별도1200ms 경로로 정정했다. 전면 그림을 실제 뒷모습으로 주장하지 않는다.

## 자원 / 보존

서버·작업자는 띄우지 않았다. built-in 생성 호출2개, PowerShell/Orca CLI 및 정적 이미지 렌더용 Chrome headless만 사용했다. blocking ask 실행 세션90921은 PD 응답과 함께 exit0으로 끝났다. Chrome launcher PID는 순서대로 **113800**(원본 비교), **11812**(보드 초안), **97980**(전투), **84188**(효과), **41988**(최종 보드)이며 모두 WaitForExit에서 종료/exit0을 확인했다. 공통 신규 프로필은 정확히 `docs/milestone/v0.4.7/issues/124/Earth/render-profile-ctx-b66017b5187b`이고 첫 실행 전 부재 확인 후 직접 생성했다. 마지막에 해당 고유 프로필 문자열을 갖는 Chrome 프로세스가 없음을 조회했다. 프로세스 종료 명령은 수행하지 않았다.

**정리 차단:** 위 정확한 신규 프로필의 경로 검증 및 `Remove-Item -LiteralPath ... -Recurse -Force` 호출이 실행 전에 자동 승인 검토의 `blocked by policy`로 거부됐다. 다른 방법으로 우회하지 않았고 PD에 보고했다. 프로필은 남아 있으며 **납품/스테이징 대상에서 제외**해야 한다. 영구 아트 파일14개만 worker_done에 명시한다. 위 생성 출력2개는 보존했다. 루트 보호 경로와 과거 `.chrome-render`에 접근하지 않았고 기존 승인 하수인 파일과 Downloads 원본은 수정하지 않았다.
