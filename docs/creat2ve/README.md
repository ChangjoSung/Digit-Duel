# Digit-Duel 운영 문서 진입점

회사·프로젝트·각 부서의 현행 문서 정본은 **회사 Obsidian Vault**다. [AGENTS.md](../../AGENTS.md)에서 정확한 Vault·필독 순서를 확인하고 `Org Chart and R&R.md`의 정본 목록과 `Projects/Digit Duel.md`를 읽는다.

- [운영 HTML](CHANGJO_GAMES_ORG_RNR.html): 두 원본에서 생성한 열람·인쇄용 보고서.
- [worker-models.json](worker-models.json): 모델/effort의 기계 설정. 업무·AC·공식 종결은 GitHub, 코드·검사·배포는 각 시스템을 유지한다.
- [prompts/](prompts/): 기존 Role 기동의 짧은 진입점. 부서 내용은 지정 Obsidian 문서에서만 편집한다.
- [범용 핸드북](Creat2veVibeCodingStructure.html)·`github-infra.json`: 범용 구조 보관본이며 Digit Duel 최신 CJ 결정이 우선한다.

HTML 본문은 직접 편집하지 않는다. `tools/docs/org_rnr_source.py preview|apply`의 기본 scope는 회사 조직 `ai-organization`, `--scope project-operations`는 프로젝트 나머지 12개 영역이다. CLI preview에서 원본·대상·구조·해시를 검토하고 `apply --target-sha256 <preview 값> --source-sha256 <검토한 원본 값>`으로 반영한다. `--fixture`는 오프라인 미리보기 전용이다. 연결·소유자·효력·해시 불일치는 쓰기 전 중단한다. 기존 Python `beautifulsoup4`·`markdown-it-py`가 필요하며 회귀는 `python -B tools/docs/test/org_rnr_source_test.py`다.

역사·코드·게임 자산·백업은 원래 위치에 보존한다. 저장소의 필요한 안내 문서는 정본 링크·기준 시각·source ID/해시를 표시한 열람 출력으로 게시한다. 다른 프로젝트에 규칙을 전파하지 않는다.
