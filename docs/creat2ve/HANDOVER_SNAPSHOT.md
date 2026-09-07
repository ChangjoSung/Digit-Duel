# Digit-Duel — 인수인계 스냅샷

> 기준일: 2026-09-07 · 작성: Mercury (PD) · 누적 금지, 현재 상태로 치환한다.

## 현재 상태

- 상설 Mercury: GPT-6 Astra, high. 인수 절차 완료. CJ Comment를 이 창구에서 수신한다.
- 최신 릴리스: **v0.4.2**. 현재 GitHub Milestone #7: **v0.4.3 — HTML 데모 후속 업데이트**.
- 원본 기준: PR #86 / 202edf3c23e65453bd7db8dd9fed5fdf0587fd0d. 이번 납품 통합 기준은 Issue #87에 연결한 단일 PR의 squash 커밋이다. 실제 dev/origin/dev HEAD는 교대 시 Git·GitHub에서 확인한다.
- 열린 납품 목표: [Issue #87](https://github.com/ChangjoSung/Digit-Duel/issues/87). 최종 통합 PR 1개로 관리하며 CJ 납품 확인 전 Issue를 닫지 않는다.
- 원본 80파일은 PR #86으로 등록했고, 이번 납품은 전투4종 보완·아이콘20종을 더한 100파일이다. 원본 해시는 docs/art/minions-v0.4.3/source-manifest.csv에 보존한다.
- 최신 CJ **“구현 승인”**은 보고한 전투 4종 보완·직접 32px 아이콘 20종·독립 검수·필요한 출력 도구·단일 Issue/PR 운영안 착수 승인이다. 제작 방식 재승인 요청 금지. 게임 화면 적용은 해당 납품 제안 범위 밖이다.
- 사용자 소유 미추적 **art/**, **orca-hook-latency-report.md**는 수정·스테이징 금지. Downloads/all-minions-v0.4.3 원본도 읽기 전용이다.

## 납품 결과·진행 상태

- 아이콘 **20/20 출력 완료**, 최종 자산 **100파일**. 원본 portrait40·비대상 전투32파일의 바이트를 유지하고 승인된 전투4쌍8파일만 보완했다.
- Saturn **ART PASS 20/20·REVISE0, Technical PASS**. 모든 원고/PNG exact, 전투20종 최근접2배 exact, manifest28행 exact. 전체 --check exit0/write0/unchanged36.
- 뇌격수는 파일럿 두 차례 수정 후 V2에서 통과했다. 초기·수정·최종 판정은 docs/art/minions-v0.4.3의 pilot-qa / pilot-v1-qa / pilot-v2-qa / final-qa-saturn.md에 보존한다.
- Mars 도구 테스트 **68/68 PASS**, Saturn 독립 도구 검수 **PASS**(tooling-qa-saturn.md). 최종 출력·재실행 write0/unchanged36 증빙은 mars-pipeline-report.md §5.1이며 Saturn이 인수 완료했다.
- 원본 이력은 source-manifest.csv, 현재 파생 산출물28개는 delivery-manifest.csv로 구분한다. 납품 인덱스·비교 시트는 docs/art/minions-v0.4.3/README.md.
- 도구 SHA256: 3f9ecf1ed9b649f982ff6626e18a6be519e51b5fa04dbe25c5a7f93e2bf6ec8c. 검수 대상 해시가 바뀌면 해당 판정 범위를 다시 확인한다.

Run: run_d5fb1e7a2b5f. Earth_1·Earth_2·Mars·Saturn·Venus의 모든 Worker는 결과 보존·archive·release 완료. 활성 Worker 없음.
PD는 단일 통합 PR의 검증·dev squash 통합 및 CJ 보고를 수행한다. PR 상태와 실제 병합 SHA는 Issue #87의 연결 PR을 확인한다.

## 승인 규격·역할 경계

- 설명창: 512×512px 제작·192×192px 표시 권장. 전투: 64×64px 작업·128×128px nearest 2배 납품, 영역 높이 200px 권장.
- 아이콘: native 32×32px, 투명 여백 2px, 8~12색 목표·최대 16색+투명, alpha 0/255. HP·글자·속성 기호를 이미지에 굽지 않는다. 말판 세 배경 #33406e, #6e3340, #3a4152에서 검수한다.
- HP 결정: 아이콘 아래 현재 HP 숫자 한 줄. 기존 공개 조건을 유지하고 미공개 상대·메모에는 HP를 표시하지 않는다.
- 기존 메모 8종 이모지를 확정 말의 종류·속성 기호에도 재사용한다. 메모 20종 확장은 범위 밖이며 실제 종·HP를 추측으로 노출하지 않는다.
- Earth는 docs/art/minions-v0.4.3/pixel-sources/<id>.json, battle-patches/<id>.json 및 아트 보고서만 작성한다. Mars가 소스를 검증해 PNG·미리보기를 출력한다. 과거 실패한 1254px 체크무늬 생성 시험 2건은 참고 이력이며 납품 수량에서 제외한다.
- Saturn은 모든 파일에 읽기 전용(files_modified=[]). Mars/Jupiter만 도구·테스트·제품 코드를 구현한다. Mercury는 조정·Git·문서 메타데이터만 집행하며 QA 판정을 대신하지 않는다. Venus는 기획 문서만 담당한다.
- 코드와 납품 자산은 목표당 Issue 1개 + 통합 PR 1개. Worker별 분할은 Task·체크리스트로 관리하며 GitHub·Notion·Git 쓰기는 Mercury가 취합한다. 독립 출시·롤백 범위만 별도 Issue·PR로 분리한다(CLAUDE 운영 계약에 CJ 승인 반영).
- main·dev 직접 커밋 금지. 최신 origin/dev에서 분기, dev에 squash merge 후 해당 feature 로컬·원격 브랜치를 명시 삭제한다. 장수 main/dev는 삭제하지 않는다.
- Public 저장소. 코드 Apache-2.0, 아트는 ASSET-LICENSE.md 별도 조건. 서버 기본 루프백, LAN은 사용자가 선택한 LAN 실행에만 적용한다.

## 남은 제품 결정

- 외부 상대경로 이미지의 게임 화면 적용·단일 HTML 원칙 완화.
- 정면/3/4 한 방향 전투 이미지 사용 및 로스터 카드 적용 범위.
- 52px 칸·최대 48px 둥근 사각형 말 컨테이너 권장안의 최종 화면 검토.
- 이번 20종 아이콘 및 4종 보완의 CJ 최종 디자인 확인. Saturn 정적 ART·기술 검수는 완료했으며 실제 게임 이미지 로딩·HP·DPR·사람 대상 식별 시험을 뜻하지 않는다.

기준 문서: docs/minion-visual-spec-v0.4.3.md §8.2(현재 수량·QA). Notion GDD-13 9장 및 Decision Log 26에 승인·납품 결과를 기록한다. Project=Digit Dual·Edit Date=2026-09-07·Editor=실제 사람 성창조 유지.

## 교대 시 확인

CLAUDE.md와 이 스냅샷 전체 → git status 및 실제 origin/dev → Milestone #7·열린 Issue/PR → 위 Run/Task/Dispatch의 실제 상태를 순서대로 확인한다. 진행 중 승인 작업은 계속 수행하며 중복 Worker·Issue·PR을 만들지 않는다.
