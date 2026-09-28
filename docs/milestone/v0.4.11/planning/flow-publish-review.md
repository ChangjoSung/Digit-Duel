# Venus 게시 보고 — v0.4.11 UI/UX System Flow Notion 등록 (2026-09-16)

- 작성: 2026-09-16 Venus_Plan (Claude Code · Opus 5 high, PLAN / area PLAN / mutation=docs, instance 단일)
- 입력: Earth [handoff.md](uiux-flow/handoff.md) + SVG 3 · PNG 3 (Mercury 시각 검토 PASS). Mercury 후속 지시 `msg_703e0a839c2f`.
- 성격: 완료된 시각 산출물 **게시만** 했다. 새 규칙·스킬 재기획·재분석 없음. 게시 결과는 검토 요청 상태이며 CJ 최종 승인·밸런스·기능 QA 전이다.

## 1. 게시 페이지

| 항목 | 값 |
|---|---|
| URL | https://app.notion.com/p/3dc1e7f1708581a48421fcec63d3cdf8 |
| Page ID | `3dc1e7f1-7085-81a4-8421-fcec63d3cdf8` |
| 부모 | Game Design Docs data source `cb30f124-3ae2-409c-a4c9-ed4c6fe9163a` (스키마 fetch 후 생성) |
| 문서 ID (자동) | GDD-24 |
| 문서명 | [Digit Duel] v0.4.11 UI/UX System Flow |
| 문서 유형 / Status / 문서 상태 / Version | UI·UX / System Flow / 검토 요청 / v0.4.11 |
| Project | https://app.notion.com/p/3ae1e7f1708580f7bb88c7ee4f511aa0 |
| 상위 기획서 (relation) | GDD-23 https://app.notion.com/p/3dc1e7f1708580329da6fe4986654f7b |
| Edit Date / Editor | 2026-09-16 / CJ `8e0a8270-d0e3-407e-a7d2-b3f992f1e366` (Agent 가짜 사람 없음) |
| Summary | Earth 시각 설계 → Mercury 시각 검토 PASS → Venus 게시, 규칙 원본은 GDD-23, 검증 전 시각 제안임을 명시 |

본문 구성: 문서 성격 callout(GDD-23 우선) → 읽는 방법·범례 → 시트 01/02/03 각각 [PNG inline 이미지 → 화면 ID·핵심 조건·예외 표 → GDD-23/GDD-13 native mention → 편집 원본 SVG 파일 블록] → 미확정 4건.
화면 ID·전이·조건은 handoff 전이표와 SVG 라벨 텍스트에서만 옮겼다. 긴 기획서 중복·Mermaid 대체 없음.

## 2. 이미지·첨부

모두 `notion-create-file-upload` → 반환 `upload_url`에 `authorization` 헤더 포함 multipart POST 각 1회(curl) → `status: uploaded` 확인 후 `file-upload://` 소스로 페이지에 배치.
SVG는 `create-attachment` content 방식(≤200KiB 허용)도 가능했지만, 수작업 재입력으로 XML 바이트가 달라질 위험을 피하려고 같은 file-upload 경로로 원본 파일을 그대로 올렸다.

| 시트 | 블록 | 로컬 파일 | file_upload_id | 크기(byte) |
|---|---|---|---|---|
| 01 | inline image | `docs/creat2ve/planning-v0411/uiux-flow/01-match-flow.png` | `3dc1e7f1-7085-81d1-aea9-00b2d73efad2` | 288,302 |
| 01 | file (SVG 원본) | `docs/creat2ve/planning-v0411/uiux-flow/01-match-flow.svg` | `3dc1e7f1-7085-8108-877b-00b200d7c091` | 27,878 |
| 02 | inline image | `docs/creat2ve/planning-v0411/uiux-flow/02-shop-flow.png` | `3dc1e7f1-7085-8126-ba94-00b220774e78` | 326,928 |
| 02 | file (SVG 원본) | `docs/creat2ve/planning-v0411/uiux-flow/02-shop-flow.svg` | `3dc1e7f1-7085-8193-8c8a-00b2ee63d284` | 21,921 |
| 03 | inline image | `docs/creat2ve/planning-v0411/uiux-flow/03-battle-flow.png` | `3dc1e7f1-7085-81e5-a2b4-00b252939b6a` | 389,170 |
| 03 | file (SVG 원본) | `docs/creat2ve/planning-v0411/uiux-flow/03-battle-flow.svg` | `3dc1e7f1-7085-818a-8514-00b25528a32a` | 28,873 |

업로드 content_length는 로컬 파일 크기와 6/6 일치. 로컬 Earth 자산은 읽기만 했고 수정하지 않았다.

## 3. GDD-23 좁은 문구 정정 (Mercury `msg_703e0a839c2f` 허용 범위)

| 위치 | 이전 | 이후 |
|---|---|---|
| 상점 운영 › 경기 시작 상점 › 시간 초과 | 현재 진열의 **왼쪽 칸부터** 자동 구매합니다 | 현재 진열의 **진열 순번이 낮은 칸부터(화면 위→아래)** 자동 구매합니다 |

- `update_content` 1건(search-and-replace)만 사용. 전체 치환·새 섹션·이미지·보고 추가 없음.
- 재조회 diff(서명 URL 쿼리 제거 후): 변경 줄 1줄, `왼쪽` 잔존 0, 이미지 2 → 2 보존.
- 속성 재조회: Edit Date 2026-09-16 · Editor CJ · Status 검토 중 · 문서 상태 검토 요청 · Summary 모두 이전과 동일(속성 미변경).

## 4. 등록 후 재조회 검사

| 검사 | 결과 |
|---|---|
| inline PNG 이미지 수 | 3 / 3 (S3 서명 URL로 해석됨) |
| SVG 파일 블록 수 | 3 / 3 (`attachment:…svg`) |
| native mention | GDD-23 ×4, GDD-13 ×2 해석됨 |
| 화면 ID 표 | 시트 01 10행 · 02 9행 · 03 12행, 본문 누락 없음 |
| truncated / unknown block | 없음 |
| 속성 | §1 표와 일치 |
| 1차 저장 결함 | 범례 `*` 줄의 굵게 표기가 저장 시 깨져 해당 줄만 `update_content`로 정정 → 재조회 정상 |
| Mercury 게시 검토 REVISE 1회 | 시트 03 표 화면 ID `D23 → B06 → Y24`가 그림·handoff 순서와 반대 → `B06 → D23 → Y24`로 정정. 같은 행의 짝 라벨 셀도 순서를 맞춰 `포획 버튼 → 포획 조건? → 볼 소모`로 정정. 다른 본문·이미지 무변경, 재조회 확인 |

## 5. 확정 / 추론 / 미확정

- **확정**: 페이지 생성·속성·이미지 3·SVG 3·mention·GDD-23 문구 1건 정정은 Notion 재조회로 확인했다.
- **추론**: 범례의 D=조건·Y=시스템 표기는 SVG에서 D노드가 조건 다이아몬드, Y노드가 `/ 시스템` 라벨인 점을 근거로 적었다.
- **미확정 (페이지 본문에도 기재)**: ① GDD-23 원문 제안 전반과 승급 HP 충돌 판단의 CJ 최종 승인·구현 검증 ② 출전 순차 블라인드 상세 선택 순서·미확정 선택 취소 버튼 [기획 필요] ③ 가방 초과 선택 중 연결 끊김 시 20초 타이머 처리 [기획 필요] ④ 완료 후 상점 재편집·일반 구매 확인 모달·상점 닫힌 시간 아이콘 표현 [기획 필요].
- **Mercury 처리 완료**: GDD-23의 `하위 기획서` relation(자동 역연결 아님)과 Summary의 "UI/UX System Flow 별도 작성 중" 문구는 Mercury가 운영 메타데이터로 갱신·확인했다(Mercury 최종 응답). Venus는 GDD-23 속성을 변경하지 않았다.

## 7. 게시 검토 판정

- Mercury 게시 검토: REVISE 1회(시트 03 B06→D23→Y24 순서) → 정정 후 **PASS**. Mercury가 게시 PNG 3개의 SHA256이 검토한 로컬 파일과 같음을 확인했다.
- PASS는 문서 게시 완료를 뜻한다. CJ 최종 승인·게임 기능 QA·밸런스 검증을 뜻하지 않는다.

## 6. 경계 준수

- 미수정: GDD-13·15·16·Decision Log, Earth SVG/PNG/handoff, `art/`, `orca-hook-latency-report.md`(읽기·수정·stage·삭제 모두 없음), 사용자 미커밋 파일, `C:/dd_cdp/track-sync-untracked-backup`.
- 없음: Git 쓰기·Issue·Milestone·구현·배포·QA 실행·Agent/fork/추가 Worker 생성·도구 코드 파일 작성.
- 로컬 변경: 이 보고서 1개(`docs/creat2ve/planning-v0411/flow-publish-review.md`).
