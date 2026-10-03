# v0.4.14 README·Release 사진 05~08 — Mars 보고 (task_ed4340c821af)

1. **[확정] 실행값**: Claude Code `claude-opus-5-5` · effort high · `--dangerously-skip-permissions`(PID 18084, 부모 cmd 24200 ← Orca daemon 24164). Mercury preflight GO 뒤에만 촬영.
2. **[확정] 기준**: 새 WorkTree `release-v0414-docs` HEAD `7fcd81b8` = origin/dev, tree `bad7771f`. ref·object 파일 직접 읽기(Git 명령 0). 제품 코드 수정 0.
3. **[확정] 렌더 방법**: 수정 없는 `demo/index.html`을 file://로 연 헤드리스 Chrome 154 1개(CDP 390×844 · DPR2). 서버·DB·계정·실서버·QA 게임 미사용. 네이티브 자산 로드, 이미지 생성·DOM 편집 없음.
4. **[확정] 오프라인 고정 장면**: 온라인 플레이가 아니라 **오프라인 PVE(AI 5급·로컬 경제) 1판**이다. 싱글플레이 카드가 잠겨 있어 기존 `startMode('pve')`를 페이지 안에서 호출해 시작했다. 이후 구매·배치·이동·전투는 실제 마우스 클릭이다.
5. **[확정] 05 시작 상점**: 1★ 3구매 뒤 스크롤. 고정 머리, 필드 3/6, 가방, 왕·동료 속성 3줄, 시너지 열이 보인다.
6. **[확정] 06 보드(턴 15)**: 전투로 공개된 상대(빨간 테·`적`·HP 31), 탐색 가능한 수풀 칸, 상성 순환표, 행동 줄이 보인다.
7. **[확정] 07 20턴 상점**: 2★ 파랑·1★ 초록 등급 테, 2★ 가방 구매, 고정 머리, 동료 HP 29/100이 보인다. **08 전투**: 시너지 한 줄 펼침, 상성표 버튼, 양쪽 실효 스탯, 행동 4버튼이 보인다.
8. **[확정] 크기·검사**: 4장 모두 780×1688이라 05/07과 06/08 쌍의 폭·높이가 같다. 하단 80px 색 수는 6934/2031/6900/659(빈 띠 없음)이고 4장 모두 육안으로 확인했다. 페이지 예외는 0이다. SHA256은 [capture-manifest.json](../../../../screenshots/v0.4.14/capture-manifest.json)에 있다. v0.4.13 01~04는 바꾸지 않았다.
9. **[확정] 자원 정리**: driver 34416·Chrome A 29676(9390/9391)을 종료하고 프로필을 삭제했다. 버전 확인 중 `chrome --version`이 기본 프로필 Chrome(PID 7824, 부모가 Mars bash)을 잘못 띄워 그 트리만 종료했다. 이후 chrome.exe와 해당 리스너는 0개이고 8084·다른 프로세스는 건드리지 않았다.
10. **[확정] 변경 파일**: `docs/screenshots/v0.4.14/{05-start-shop,06-strategy-board,07-turn-shop,08-element-battle}.png`, `capture-manifest.json`, 이 보고서. 캡처 도구는 저장소 밖 `artifacts/.../release-v0.4.14-20261004/mars`에 있다. [추론] 장면은 실제 플레이로 만든 것이라 재현해도 같은 픽셀이 나오지 않는다.
