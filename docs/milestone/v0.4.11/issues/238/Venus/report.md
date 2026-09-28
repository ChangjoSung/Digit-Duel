# #238 Venus — 경기 UI 구현 계약 · 문서 동기화

Venus / PLAN / PLAN / docs / 단일 인스턴스. Git·GitHub·제품·테스트 파일은 건드리지 않았다. 작업 영수증의 adopted requested/effective는 **null** 그대로 — 관측값으로 채우지 않았다.

## 현재 — 2026-09-28 CJ 기록 아이콘 높이 명확화

task_968c06466d59 · ctx_6bee83a7428f · native PID 36304 `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions` · PD preflight GO. adopted requested/effective = null 유지.

[결정] 왼쪽 이전 승인 기록(책) 아이콘 = **오른쪽 ★ 이벤트 아이콘과 같은 높이**. 옛 "받침대 아래 왼쪽"은 [대체됨]. 아이콘 · 최근 20경기 팝업 · 최신 3/4 · 8항목 나머지 규칙은 그대로. [확정] CJ PASS = 잠금 Toast · 참가자 나가기 · 5초 목록·인원 집계 갱신 · 로그인 계정 인원 갱신 · 이 수정 뒤 추가 CJ 플레이 QA 면제. 작성 시점에는 Mars 구현·Saturn 필수 QA가 대기였다. 이후의 구현·QA·통합 현황은 [Mercury 원장](../Mercury/report.md)과 GitHub #238의 기존 완료 조건을 따른다. 역할 메타데이터 정정: `demo/js/network.js`(클라이언트 통신) = Mars · `server/**` = Jupiter.

| 변경 | 위치 |
|---|---|
| 높이 명확화 · CJ PASS · QA 면제 | planning 머리(새 줄 · 최신 3 ②) · 0절 2행 · 최소 검증 · 11절 Mars / visual-alignment 머리 · L01 표 · 5절 / GDD-24 · GDD-23 · GDD-13 본문 + Decision Log(아래 Notion 절) |
| network.js 소유 정정 | planning W 절 '화면 API' 줄 / GDD-24 00.10-16 · GDD-23 · GDD-13 새 행 담당 문구 |

Notion 세부: GDD-24 00.2 ① L01 위치 치환 · 00.10-14 ② 대체 표기 · 00.10-16 신설 · 운영 이력 / GDD-23 ㉖ 문단 치환 · 9장 최신 3 ② 대체 표기 · '기록 아이콘 높이' 행 / GDD-13 9장 최신 3 ② 대체 표기 · 새 행 · 운영 이력(1~8장 v0.4.10 서술 불변). 다시 불러와 확인: 새 문구 있음 · 옛 활성 "받침대 아래 왼쪽에 둔다" 0건 · Project = 3ae1e7f1… · Editor = 사람 편집자 · Edit Date = 2026-09-28. 새 페이지 없음.

## 이전 — 2026-09-28 CJ 최신 3항목 + 추가 요청(멀티 접속 인원) [이력]

3항목 = task_59aba3e182f8 · ctx_97d5b6dbe3bd. 접속 인원 = 같은 범위 즉시 후속 task_4d05b51a0bf4 · ctx_16d95f8db3de(새 preflight GO · 완료 시 argv 재확인).

[피드백] CJ QA 재수정 3항목만, 나머지는 CJ PASS. 실행: native argv `claude --model claude-opus-5-5 --effort high --dangerously-skip-permissions`(PID 41136) · bypass · PD preflight GO(PD가 argv · JSONL 모델 · footer 독립 확인).

| # | 확정(CJ) | 문서 반영 |
|---|---|---|
| 1 | 잠금 안내 = 고정 문구 대신 **상단 Toast**(Image #1). 실제 오류 · 입력 검증 안내는 그대로 | [현행] Toast 모양(`.toast` · `toastFade`) · 기본 2300ms 재사용 + 로비 전용 자리(`lobbyToastHost` · `LOBBY.toast`, 미션 줄 아래) — 새 시간값 없음(PD 정정 반영: `showToast()` 직접 호출 아님) |
| 2 | 로비 기록 = **이전 승인 기록 아이콘 복원** · ~~받침대 아래 왼쪽(Image #2)~~ [대체됨 · 높이 명확화]. 팝업 = 현행 최근 20경기 그대로(전체 승 · 패는 상단 프로필 줄 · 팝업에 새 줄 없음 — PD 정정 msg_f992d7e37cf5 반영) | 8항목 때의 `n승 n패` 배지는 [대체됨] |
| 4 (추가) | L02 방 찾기 상단에 승인 사람 아이콘(`gi("team")` 재사용) + **현재 멀티 접속 인원 숫자** | [PD 기준] 서버 합계 `onlineCount`(방 목록 응답 선택 필드 · 0 이상 정수) = 연결된 유효 로그인 계정 고유 수(같은 계정 여러 연결 = 1 · 끊긴 유예 좌석 · 오프라인 PVE · 미로그인 제외) · 기존 5초/수동 갱신 · 값 없음/끊김 `—` · 새 타이머 · DB · 이력 · 관리자 화면 · 식별 정보 노출 없음 → planning 0절 최신 4행 · W5 · 검증 ⑪ |
| 3 | 대기방 **방장 나가기 = 방 파괴 · 참가자 나가기 = 방 유지 · 재모집**, 옛 좌석 · 준비 · 카운트다운 해제. 참가자가 결과에서 먼저 복귀 후 나가도 방장 결과 · 방 보존 → 방장 복귀 시 빈 대기방. 경기 중 기권 · 단절 불변 | planning 0절 W4 신설 · R1 · 유지 줄 치환, 최소 검증 ⑨⑩ |

**[Venus 해석]** 참가자가 결과 화면에서 곧바로 나가는 경우도 "참가자 나가기 = 방 유지"를 적용. **변경 안 함(현행 유지)**: 대기방 참가자 **단절 60초 만료 = 방 취소** — 최신 3은 명시적 나가기만 다룸. 비차단 질문으로 PD에 보고.

**Jupiter 계약 대조(재확인)**: 앞선 '불일치' 보고는 Jupiter가 갱신하기 전 읽은 경합이었다. 지금 [Jupiter/cj-revise-contract.md](../Jupiter/cj-revise-contract.md) §4b(대기방 나가기 역할 구분)와 17행은 최신 3과 일치한다 — 참가자 결과 중 · 먼저 복귀 후 나가기 모두 방장 결과 · 방 보존이라 위 [Venus 해석]도 서버 계약과 같다. 30행 카운트다운 취소 문구의 '나가기(방 취소)'와 통신 소유 문구는 Jupiter가 바로잡는 중(PD 전달).

### 문서 반영 위치

| 변경 | 위치 |
|---|---|
| 잠금 Toast | planning 0절 머리 · 최신 1행 · 최소 검증 / visual-alignment 1절 3 · L01 표 / GDD-24 00.8 잠금 두 행 · 00.10-14 / GDD-23 8.1 ㉖ · 9장 / GDD-13 9장 |
| 기록 아이콘 복원 | planning 0절 2행 · 11절 Mars / visual-alignment L01 · 5절 / GDD-24 00.2 ① L01 · 00.10-14 / GDD-23 8.1 ㉖ · 9장 / GDD-13 9장 |
| 접속 인원(추가) | planning 머리 · 0절 최신 4행 · W5 · 검증 ⑪ · 11절 Mars/Jupiter / visual-alignment 머리 · L02 표 / GDD-24 L02 · L03 절 '멀티 접속 인원' 행 · L02 화면 행 · 00.10-15 · 운영 이력 / GDD-23 8.1 ㉗ · 9장 '접속 인원' 행 / GDD-13 9장 '접속 인원' 행 · 운영 이력 |
| 방장 파괴 · 참가자 유지 | planning 0절 3행 · W4 · R1 · 유지 · 11절 Jupiter / visual-alignment L03 / GDD-24 00.2 ① L03 · L02·L03 절 흐름도 · L03 화면 행 · 00.3 흐름도 · 00.4 L03 · 00.10-13 대체 표기 · 00.10-14 / GDD-23 8.1 ㉗ · 9장(8항목 행 대체 표기 · 최신 3 행) / GDD-13 9장(재수정 행 대체 표기 · 최신 3 행) |

GDD-24 00.3의 옛 "참가 (SETUP)" · "상대 입장 → SETUP" 두 화살표(8항목 동기화 누락)도 이미 확정된 WAITING · 준비 → 시작 → 5초로 맞췄다(새 규칙 아님).

**읽어 확인**: 두 차례 모두(3항목 · 접속 인원) 세 페이지를 다시 불러와 새 문구 존재, 옛 "[방 나가기]는 현행대로 방 취소다" · "상대 입장 → SETUP" 0건. 속성 Project = 현재 프로젝트 · Edit Date = 2026-09-28 · Editor = 실제 사람 편집자. Summary 속성은 이스케이프 손상 위험으로 고치지 않고 본문 운영 이력(GDD-24 · GDD-13)과 결정 행 기록(GDD-23)에 남겼다.

## 이전 작업 요약 (같은 날 · 상세는 각 문서가 원본)

- 첫 작업: planning 문서(S · M · B · X 매트릭스 · 공통 규칙 · S04 서버 계약 · 제거 목록 · FX · 역할), GDD-24 · 23 · 13에 #262 최종 QA PASS · #238 착수 · S01 나가기 = 즉시 취소 반영. 첫 작업 중 read-only `git status` 1회 실수는 기록으로 남긴다.
- 후속 정정: S04 `final.sides`(보드 9칸 + 가방 ≤3 · PD · Venus 구현 해석 채택 · 새 영구 저장 없음), Y01 [기획 필요] → GDD-23 V1 · V2로 해결, S01 티켓 사용 = 비차단 나중 질문, X03 = 서버 권위 만료 · [포기] 없음.
- 시각 REVISE · 8항목: [visual-alignment.md](visual-alignment.md) · planning 0절이 원본.

## 한계

브라우저 · 2-client 실행 검증 없음(Saturn · 제품 부서 몫). 코드 사실은 읽기(rg · Read)로만 확인했다: Toast 모양 · 2300ms(demo/js/ui.js:20 · game.css `.toast`), 기록 아이콘 `gi("record")`(demo/js/lobby.js:152), 사람 아이콘 `gi("team")`(demo/js/lobby.js:187 · 193). `onlineCount`는 PD 표준 필드명이며 서버 최종 계약 · 테스트는 Jupiter 몫.
