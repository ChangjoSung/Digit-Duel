# Digit-Duel 운영 문서 진입점

**[CHANGJO GAMES Org Chart and R&R](CHANGJO_GAMES_ORG_RNR.html)** 이 현황·승인·역할·QA·PM 인수인계의 단일 정본입니다.

- [worker-models.json](worker-models.json): 승인된 모델/effort의 기계 설정. 실행 인수 전달과 실제 관측은 별도 확인합니다.
- [prompts/](prompts/): 기존 수동 기동 경로를 유지하는 짧은 연결 파일입니다.
- [범용 핸드북](Creat2veVibeCodingStructure.html)·`github-infra.json`: 범용 구조 보관 자료이며 Digit-Duel 최신 CJ 결정과 PM 운영 원장이 우선합니다.

이번 CJ 승인으로 프로젝트 문서 체계를 전환했습니다. 범용 bootstrap이나 다른 프로젝트를 자동 갱신하지 않습니다. 과거 `AUTHORITY`, `HANDOVER_SNAPSHOT`, `WORKER_MODELS`, `QA_MINIMUM_POLICY`, `README_RELEASE_STYLE`의 현재 내용은 운영 원장으로 통합했습니다.

## 조직 상세의 원본과 HTML 갱신

회사 Vault `613e72a275ee9be3` / `Org Chart and R&R.md`의 `source_scope: ai-organization`만 Obsidian 정본이다. 프로젝트 계약·현황 등 나머지는 운영 HTML의 항목별 정본 목록을 따른다. 이관된 HTML 영역은 직접 편집하지 않는다.

Python의 기존 `beautifulsoup4`, `markdown-it-py` 설치가 필요하다. `tools/docs/org_rnr_source.py preview --out <artifact HTML> --receipt <JSON>`으로 CLI 원본과 변경을 검토한 후, `apply --target-sha256 <preview의 target_sha256_before> --source-sha256 <preview의 source_sha256> --receipt <JSON>`으로 반영한다. 최초 이관 모드는 내용·링크·ID 동등성을 요구한다. `--fixture`는 명시된 오프라인 미리보기 전용이며 실제 원본 읽기가 아니다. 연결·경로·효력·SHA 불일치는 쓰기 전 중단한다. 검사는 `python -B tools/docs/test/org_rnr_source_test.py`다.
