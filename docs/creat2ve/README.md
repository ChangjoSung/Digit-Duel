# Digit-Duel — Creat2ve Vibe Coding Structure 적용 문서

이 폴더는 creat2ve-structure bootstrap 도구가 생성·관리한다 (구조 rev 6 · release 0.3.0, 기준일 2026-09-02).

| 파일 | 종류 | 설명 |
|---|---|---|
| `Creat2veVibeCodingStructure.html` | managed | 자기완결 핸드북 사본 (브라우저로 열어 읽는다. 스크립트 없음, 외부 자원 없음) |
| `AUTHORITY.md` | seed | 이 프로젝트의 권위 문서 등록표 — 링크를 사람이 채운다 |
| `HANDOVER_SNAPSHOT.md` | seed | 인수인계 스냅샷 — PD가 세션 교대·마일스톤 종료 시 치환 갱신 |
| `github-infra.json` | managed | 라벨·마일스톤 권장안 — 사람 승인 후 PD가 `gh`로 적용 |
| `prompts/*.md` | managed | 부서별 수동 백업 Prompt — 자동 경로 장애 시만 사용 |

- **managed** 파일은 구조 rev 또는 release가 오르면 bootstrap `plan → 승인 → apply`로 갱신된다. 직접 고치지 않는다.
- **seed** 파일은 처음 한 번만 생성되며 이후 프로젝트 소유다. 자유롭게 고친다.
- 무결성 확인: creat2ve-structure 저장소에서 `node tools/bootstrap.mjs status --target <이 프로젝트>`.
- 운영 계약 원본은 저장소 루트 `CLAUDE.md`의 `<!-- creat2ve:begin -->` … `<!-- creat2ve:end -->` 구간이다.
