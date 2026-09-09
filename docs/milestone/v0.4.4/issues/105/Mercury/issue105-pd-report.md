# Issue #105 — README·Releases 갱신 취합

2026-09-08 · Mercury(PD) · 최신 정식 릴리스 v0.4.3, v0.4.4 미출시.

## 결과와 검수 상태

README를 CJ 원문의 여덟 범주로 구성했다. Earth 소개 일러스트, 기존 정식 v0.4.3 보드·전투 화면, 같은 태그의 실제 튜토리얼 10단계를 연결했다. 튜토리얼은 작은 미리보기와 원본 링크가 있는 접기형 갤러리다. 작은 이미지에서 모든 본문을 읽는 구성은 아니다.

**최종 Saturn PASS**(msg_e4dbcc01b99d). 첫 독립 전체 렌더 검수의 임시 HTML·JSON 쓰기/렌더 생략 REVISE를 Mars가 수정했고, 이어서 발견한 비로그인 Stars 링크 404도 PD가 수정한 뒤 독립 재검수했다. 초기 실패 이력을 보존했다.

재검수에서 GitHub Stars 명단 URL이 비로그인 사용자에게 404를 반환하는 것도 확인했다. PD는 Stars 카운터는 유지하고 두 링크를 공개 저장소 루트로 수정했다. 현재 README 재검수 결과가 최종 근거이며, 저장된 HTML·JSON·PNG의 이전 README 해시는 링크 수정 전 측정 이력이다. 링크 목적지만 바뀌었으므로 기존 PNG를 새 화면 캡처라고 다시 표기하지 않는다.

최종 README SHA256 `2d4e5f9dac0b6f6293aff9bbe3393a3e2d5201e727574bc692a849a4865dcd53`, 최종 정제 HTML SHA256 `36737d1d1e9eb50103c8e9e70c0f67daede7413e71c1294cbe124e0824f1e82d`. 데스크톱1100×900·좁은390×844 실제 Chrome에서 실패0, 갤러리10/10, 페이지 가로 넘침0. 이전 동일 미디어 입력에서 튜토리얼10/10 바이트 재현, 실제 원본 링크20회 이동, 실패 감지 대조도 통과했다. 상세 `docs/qa/issue105-saturn-final.md`.

## Release 게시

v0.3.0·v0.3.1·v0.4.0·v0.4.1·v0.4.2·v0.4.3 여섯 기존 Release의 본문을 `docs/releases/`의 검토본으로 게시했다. PD와 Saturn이 각각 API로 여섯 본문 일치 및 기존 id·published_at·target_commitish·첨부자산 메타데이터 보존을 확인했다. 원본 백업은 로컬 `.git/releases-before-renewal.json`이다.

원문 예시에 v0.4.3 변경으로 적힌 #91·#94·#96은 실제 v0.4.4 개발 사항이므로 과거 릴리스에 소급하지 않았다. 태그나 릴리스 날짜를 바꾸거나 새 버전을 발행하지 않았다.

## 근거와 한계

- 아트 출처: `docs/art/readme-hero-v0.4.4.md`. 승인 아트 원본은 보존했다.
- 미디어 출처·도구: `docs/qa/issue105-media.md`, `tools/readme_media_capture.js`.
- 독립 편집/아트 QA: `docs/qa/issue105-saturn-editorial.md`.
- 초기 미디어 QA 및 REVISE: `docs/qa/issue105-saturn-media-first.md`.
- 렌더는 GitHub가 정제한 HTML과 근사 CSS를 사용한다. github.com 실제 전체 스타일과 픽셀 단위 동일성을 보장하는 증거는 아니다.
- 게임 화면은 렌더된 실제 제품이며 보드·전투 증빙의 배치는 검증용으로 구성했다. 홍보 일러스트는 실제 플레이 화면과 구분해 표시했다.
- 이미지·브랜딩 제외 범위는 `ASSET-LICENSE.md`에 명시하며 일반 문서까지 아트로 분류하지 않는다.

전체 최종 QA는 PASS이며 단일 PR dev 통합 및 CJ 확인 상태는 Issue #105에서 관리한다.
