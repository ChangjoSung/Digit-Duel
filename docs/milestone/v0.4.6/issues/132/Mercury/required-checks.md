# Issue #132 — CI E 필수 검사 연결 (Mercury)

- 2026-09-10 · 역할: COORDINATION_GIT_DOC_METADATA · CJ 명시 승인 집행
- 적용 및 재조회: 16:41–16:42 KST. GitHub 설정 변경으로 별도 제품 커밋은 발생하지 않는다.
- [GitHub 적용 기록](https://github.com/ChangjoSung/Digit-Duel/issues/132#issuecomment-5614971093) · [GDD13 DL54](https://app.notion.com/p/3cd1e7f17085817f8c35fa8548116f38)

## CI 필수 검사 연결 확장 — 2026-09-10 CJ 승인

[PR163](https://github.com/ChangjoSung/Digit-Duel/pull/163) / dev `2c04b7f4c14c3d6b71902b17b742205136c6ba83`의 Roblox 검사 E를 **dev와 main의 Require status checks to pass에 여섯 번째 필수 검사로 등록**했다. Ref #118 · #132. 기존 HTML 검사만으로 Roblox 컴파일/규칙 회귀가 차단되지 않았다는 담당자의 보고에 대한 CI 연결 보완이며, Roblox 제품 자체의 추가 QA 판정을 뜻하지 않는다.

1. `A. 규칙 회귀·AI 완주 (헤드리스)`
2. `B. 서버 (프로토콜·보안·설정)`
3. `B2. Windows 실행기 회귀`
4. `C. 문서 링크·이미지 무결성`
5. `D. 납품 아트 자산 무결성`
6. `E. Roblox 클라이언트·규칙 (Luau)`

- 여섯 검사 모두 GitHub Actions 앱 `15368`로 제한한다.
- 적용 뒤 두 브랜치 보호 API를 재조회해 검사 6개와 `strict=true`를 확인했다. 필수 검사 이외 보호 설정의 전후 값은 모두 동일하다: PR 필수, 관리자 적용, 대화 해결, force push/삭제 금지, 승인 리뷰 수 0 유지.
- 등록 전 성공 이력: [PR163 E 성공](https://github.com/ChangjoSung/Digit-Duel/actions/runs/34449168911/job/102780649496), [dev push E 성공](https://github.com/ChangjoSung/Digit-Duel/actions/runs/34449328401/job/102781189221). 새 실패 실행을 만들거나 보호 우회를 시험하지 않았다.
- 과거 5개 검사 성공 기록은 당시 증거로 보존한다. E가 없는 오래된 PR 브랜치는 최신 dev의 워크플로를 포함시켜 6개 결과를 받아야 한다. Issue의 기존 CLOSED 상태와 출시 버전은 유지한다.

기존 [Mars 보고](../Mars/report.md)와 [Venus 분석](../Venus/analysis.md)은 최초 도입 당시 기록이다. 이 보완은 보호 설정과 기록만 변경하며, 기존 담당자의 Roblox 구현이나 현재 HTML UI의 검수 결과를 대신하지 않는다.
