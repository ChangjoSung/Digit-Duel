# #146·#131·#128·#130 Saturn 문서·미디어 납품 검수

- 작성: Saturn(Codex), 2026-09-10. PD가 inline 원문을 보존했다.
- Task `task_184f630d7393`, Dispatch `ctx_0505d20f172c`, 메시지 `msg_8edd972c75dd`.
- 범위: 문서·미디어·브라우저 증빙·CI 연결 정적 검수 PASS. 최종 README 재렌더와 실제 PR CI는 PD 확인 게이트.

[피드백] PASS — 문서·새 튜토리얼 미디어·브라우저 증빙·CI 연결의 읽기 전용 납품 검수 범위; 아래 최종 렌더 갱신/실제 PR CI/CJ QA/출시 게이트는 제외합니다.
역할 preflight: required_role=Saturn, instance=Saturn, instance_index=null, mode=QA, area=QA, mutation=none, provider=Codex 일치. CLAUDE 전체 후반 역할 계약 우선 적용, 실제 Orca 자신의 inbox 전체 처리 및 delivery_570dc914c942 ack 완료. files_modified=[]; 제품/테스트/보고서/임시파일/로그/프로필 생성0, 브라우저/서버 시작0, 패키지설치0, Git/GH/Notion 쓰기0, 다른 Worker spawn0. 보호 root art/ 및 orca-hook-latency-report.md 직접 읽기·목록·메타조회0, 기존 자원 정리0; READ_ONLY 위반 없음.

식별값(직접 계산):
최종 읽은 HEAD=d60085edc71cebe3480ab07afa4a549c0d33d61d (시작 aa6998ae8d2ca8b5fc8136c5fa19bc6aca5c12ea; PD 제품불변 테스트/문서 커밋).
demo/index.html Windows SHA256=b1c33ae8ff87e64cb71481714d73966f09e3af5f3b8506d82893dccb77f305de; LF 정규화 Git blob=2a9b54c769a58fc5c0db9e913ce4421bec6758e3; 촬영 ref=aa6998ae8d2ca8b5fc8136c5fa19bc6aca5c12ea.
demo/test/regression/smoke_issue146.js SHA256=5ebc18318f9d784cfef9fcfa3bba754a52fabbc55562bee77886d2a383470778.
docs/milestone/v0.4.7/issues/146/Mars/artifacts/capture-manifest.json SHA256=67f147182adc13f92936af67a6243973f8f0a0ad42c7dfa5c4e8796b8353787a.
i146-browser-report.json SHA256=27768fc85733ba3c17a1ea883b380f1c995f47da0ccc009434dbcf03b64f85ef; issue146_cdp.js SHA256=3fe20daa369f27c80bc4b1f7ec3e5ceb83b05bef95cd407ac1db44711f9f5951.
제품/회귀/manifest 시작과 최종 해시 동일. 기존 core-review PASS 및 신규207/0·선택8종1062/0·독립63/0·Mars19종은 원래 실행 주체/시점의 결과로만 인용하며 이번에 반복 실행하지 않았습니다.

문서 대조:
Venus 계약, Mars/Mercury 보고, README, releases/v0.4.7, milestone/v0.4.7, 문서/릴리스/마일스톤/검사 인덱스, HANDOVER/CLAUDE 현 상태는 도망 HP제한 없음·30%/해당전투70%·실패 추가반격 없음/정상 상대 차례·4슬롯 전부불가 수동 전투행동1회/왕동료 본체 유지·함정상태 양끝 텔레포트 차단·보호막 남은값+기존부여량에 부합합니다.
#128은 독립 Chrome 프로필2개/동일origin에서 신고 미재현·원인미확인·제품 저장로직 무변경이며 물리2PC/신고해결 PASS가 아닙니다. #121/125/129 CJQA CLOSED, 새4개 CJQA OPEN, v0.4.7 미출시·v0.4.5 정식·Roblox#118별도 상태가 일치합니다. Venus 현행코드 설명은 명시된 시작 blob, Mars README가 아직121이라고 한 문장은 촬영 시점의 보고로 구분했고 현재 README는146입니다.

직접 검증 수와 실패:
새 tutorial-01~10 PNG10/10 존재·PNG signature·2224x1636 IHDR·byte length·전체SHA256·frames.path/file 일치, source ref/blob와 현재 제품blob 일치. 실제 이미지10장 모두 시각 확인: 한국어 본문/카드/내비 누락·잘림·겹침으로 읽을 수 없는 곳0. 7번 도망30/70/실패 무추가공격, 8번 함정 양단 제외, 5번 수동대기·보호막40/52, 10번 보드 턴 복습을 확인했습니다.
README href/src20개=서로다른 새146 PNG10개×2, 모두 manifest 경로 일치; ref/manifest 링크도 일치. 기존121 Mars/artifacts는 시작33bbc19 대비 git diff0으로 보존 확인. browser-report shots20개는 중복0·실제PNG20/20·모두1280x1000, 기록81/0·fails[]이며 JSON 소스blob도 일치. 그중 noattack-root/flee30/flee70/tele stage1/stage2/reject/shield/profileA first/done/profileB first 실제10장을 읽어 JSON/화면을 대조했습니다.

실제 발견/해결1건:
README.md:67 expected 10번 캡션이 tutorial-10 실제 내용을 설명; actual 최초 캡션은 쓸 수 있는 기술이 없으면 수동 대기였으나 10번 그림은 보드 주 행동/자동 종료/싸우지 않고 종료이며 수동 전투대기는 tutorial-05의6번째카드. 재현=README 10번 캡션과 PNG05/10 직접 열기. msg_dea04b299dda로 전달, PD 수락 후 README:60을 전투·수동 대기·보호막 합산, :67을 빠른 복습·보드 턴 종료 선택으로 수정한 delta를 직접 재독해 해결 확인. 제품/이미지 수정은 필요 없었습니다. 현재 이 캡션 불일치 미해결0.

브라우저 도구 정적 검토/한계:
CDP Input.dispatchMouseEvent로 도망/루트pass/하위pass/가방/쿨링수/보드칸을 클릭하고 settle은 실제 fxLocked/msgQ 및 정상 타이머를 기다립니다. __fix는 전투장면·skills/cds/actor를 주입하고 70%는 boostA를 직접 설정합니다; 보호막은 execSlot 호출과 CD/phase/잔여shield 주입이며 사람의 정상경기 종단간 절차가 아닙니다. 프로필 A/B는 서로 다른 mkdtemp/Chrome이고 같은 서버origin; B 최초 탭은 A완료 전에 열고 A완료 후 probe하므로 정확한 최초 navigation 순서와 probe순서를 구분해야 합니다. 이후 B 미완료 재방문 자동표시·A완료 재방문 생략·B완료 후 생략까지 JSON에 있어 저장독립성 증거는 유지됩니다.
과거 작성 중 실패와 최종81/0을 구분했습니다. 현재 도구는 정상 teleport 좌표swap/지표1/선택해제를 명시 비교하며 mainUsed가 자동 턴 종료 후 reset되는 상황을 별도로 기록하고, 도움말 가림은 실제 알겠어요 클릭 후 진행합니다; 해당 조건을 삭제해 통과한 구조가 아닙니다. 검사 수는 조건분기 따라 달라질 수 있으며 81은 저장된 최종실행값입니다. 실제 WebSocket/릴레이2클라이언트/물리2PC/사람밸런스 PASS로 확대할 수 없습니다.
도구 파일의 기본 출력은146 artifacts, 프로필·다른ref 임시파일·Chrome·HTTP서버는 OWNED목록에 한정 정리합니다; 제품파일 쓰기·보호root 직접접근은 현재 정상 실행 경로에서 발견하지 않았습니다. 단 --read-only도 프로필 등 임시쓰기/프로세스를 생성하므로 Saturn 파일쓰기0 실행용이 아니고 이번에는 실행하지 않았습니다. 실제 정리 완료 여부를 사후 프로세스 조회로 입증한 것은 아니며 정적 소유범위 검토입니다.

CI/렌더:
ci.yml 시작33bbc19 대비 diff는 A의smoke_issue146 추가 및 C의새146manifest 연결/주석뿐이며 기존필수5잡·set-e·기존검사·핀·읽기권한 유지. 기존 docs_link_check/readme_media_capture 도구 diff0; 자체회귀는 임시파일을 만들므로 실행0. README verify는 기존WARN와 docs/media고정 크기/hash검사 한계가 있어 새PNG10장은 위 직접계산으로 별도 확인했습니다.
Mars 기존 README 렌더1100x900/390x844 JSON각64참조·문제0·갤러리10/10 로드와 실제 갤러리PNG2장을 읽었습니다. 390 썸네일44px은 원본 클릭 전제로만 읽히며 code블록 right552 overflow가 기록돼 있어 모든요소 넘침0이라고 확대하지 않습니다; GitHub 근사CSS 렌더이며 github.com 픽셀동일 증거가 아닙니다.
남은 게이트: 기존 렌더 JSON의 README SHA=4bcfff7e254f0b292b414347fb2ddb61398203b09d9fa6222eb5f1ad31b684bd는 캡션정정 전이고 최종 직접 읽은 README SHA=76ce2badfb79824299f87adfcbdbc6e3a9832ba042f18b2520fcafc4cd31cf0f입니다; 현재 정정캡션 자체는 검수했지만 그 최종 렌더로 소급하지 않습니다. 최종 렌더 갱신/기준시점 기록, 실제 PR152 CI5/통합상태 확인과 QA완료 metadata 치환은 PD 게이트로 남깁니다. PR152/CI시작은 PD 통지이며 직접 GitHub 조회로 확인하지 않았습니다. CJ Play QA·#128 신고환경 재현조사·v0.4.7 출시는 별도이며 이를 기다려 검수 세션을 붙잡지 않습니다.
files_modified=[]; inline 원문 전달, report_path 없음.

## PD 후속 관측과 구분

위 도구 소유 범위 검토는 `issue146_cdp.js` 정상 정리 코드에 대한 정적 판정이다. 별도 Mars 후속 Task `task_c5532cf6d758`/Dispatch `ctx_7799bd4b330b`에서 PD가 `%TEMP%/i146cdp-main-*`, `i146cdp-profA-*`, `i146cdp-profB-*`의 `rm -rf` 일괄 삭제를 발견했다. 정확한 대상 절대경로·소유권 사전 검증이 없는 절차 위반이며, 추가 정리를 중지시키고 이미 가진 출력으로 범위와 한계를 보고하도록 했다. 이 실행을 위 READ_ONLY QA나 정상 정리 코드 검토로 소급 승인하지 않는다. 후속 사실은 Mars·Mercury 보고서에 연결한다.
