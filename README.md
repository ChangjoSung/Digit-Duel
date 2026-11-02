# Digit-Duel

<p align="center">
  <a href="docs/media/digit-duel-hero.png"><img src="docs/media/digit-duel-hero.png" alt="Digit-Duel 홍보 일러스트" width="100%"></a>
</p>

<p align="center">
  <a href="https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.16"><img src="https://img.shields.io/badge/release-v0.4.16-2e7d32" alt="정식 출시 v0.4.16"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/code-Apache--2.0-blue" alt="코드 라이선스 Apache-2.0"></a>
</p>

**[▶ 정식 웹 게임](https://digit-duel.site)** · **[최신 정식 출시 v0.4.16](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.16)**

## 게임 소개

**상대 말의 정체를 추리하며 싸우는 온라인 턴제 전략 보드게임입니다.** 각자 말 14개를 비밀리에 배치합니다. 상대 말은 물음표로 보이고, 숲에 들어간 말은 위치도 숨겨집니다. 하수인을 움직여 단서를 모으고 속성 전투로 상대를 제압하세요. 다른 플레이어와 1대1로 겨루거나, 싱글플레이에서 AI와 대전할 수 있습니다.

상대 왕을 쓰러뜨리거나, 내 왕을 상대 진영의 마지막 줄까지 보내거나, 상대의 하수인과 동료를 모두 제거하면 승리합니다.

## 게임 기능

- **구매와 비밀 배치** — 일반 하수인 30종 중 6명을 고르고 왕·동료·폭탄·함정과 함께 7열 × 13행 보드에 배치합니다. 회복 아이템과 몬스터 볼은 각각 1개씩 가지고 시작합니다.
- **정체 추리와 숲** — 표시된 수풀에서 탐색해 코인을 얻고 숨은 말을 추적합니다. 공개된 적 말은 소속 표시로 구분하고, 상대 말에는 나만 보는 추측 메모를 남길 수 있습니다.
- **속성 전투** — 불 → 풀 → 땅 → 번개 → 물 → 불의 상성과 스킬·가방·포획·도망을 활용합니다. 전투 후 HP는 유지되고 상태이상·쿨타임은 초기화됩니다.
- **성장과 시너지** — 턴 상점에서 하수인을 승급·교체하고 아이템을 구매합니다. 등급이 오르면 HP·공격력이 크게 증가하며, 왕국·아키타입 시너지로 전력을 조합합니다.
- **튜토리얼** — 마녀의 안내를 따라 기본 실습과 심화 실습으로 규칙을 배웁니다. 원하지 않으면 건너뛸 수 있습니다.
- **싱글플레이** — 무제한 AI 대전에서 브론즈·실버·골드 난이도의 AI와 겨룹니다. 이기면 다음 난이도가 열리고, 진행은 계정에 저장됩니다. 입장 무료이며 횟수 제한이 없습니다.
- **공개 방과 전적** — 방 이름으로 검색해 대전하고 이모티콘 6종으로 반응합니다. 로비에서 대표 하수인·공식 승패·최근 20경기를 확인합니다.
- **테이블탑 판타지** — 원목·황동·양피지 UI와 성소·길드 회관·전술실 배경을 사용합니다. 일반 30종과 전설 3종 하수인이 회화풍 미니어처로 등장하고, 각자의 4번 대표기에 전용 효과가 재생됩니다.

## 게임 플레이 사진

v0.4.16 화면입니다. 이미지를 누르면 원본 크기로 볼 수 있습니다.

<table>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/01-login.png"><img src="docs/screenshots/v0.4.16/01-login.png" alt="로그인" width="100%"></a><br><b>로그인</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/02-main-lobby.png"><img src="docs/screenshots/v0.4.16/02-main-lobby.png" alt="메인 로비" width="100%"></a><br><b>메인 로비</b></td>
  </tr>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/09-tutorial-basic.png"><img src="docs/screenshots/v0.4.16/09-tutorial-basic.png" alt="기본 튜토리얼 — 말의 역할 안내" width="100%"></a><br><b>기본 튜토리얼</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/10-tutorial-advanced.png"><img src="docs/screenshots/v0.4.16/10-tutorial-advanced.png" alt="심화 튜토리얼 — 시작 상점과 시너지 안내" width="100%"></a><br><b>심화 튜토리얼</b></td>
  </tr>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/11-singleplayer.png"><img src="docs/screenshots/v0.4.16/11-singleplayer.png" alt="싱글플레이 선택" width="100%"></a><br><b>싱글플레이</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/12-ai-tiers.png"><img src="docs/screenshots/v0.4.16/12-ai-tiers.png" alt="무제한 AI 대전 난이도" width="100%"></a><br><b>무제한 AI 대전 난이도</b></td>
  </tr>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/13-bronze-board.png"><img src="docs/screenshots/v0.4.16/13-bronze-board.png" alt="브론즈 AI 대전 보드" width="100%"></a><br><b>브론즈 AI 대전</b></td>
    <td width="50%"></td>
  </tr>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/03-public-rooms.png"><img src="docs/screenshots/v0.4.16/03-public-rooms.png" alt="공개 방 목록" width="100%"></a><br><b>공개 방 목록</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/04-waiting-room.png"><img src="docs/screenshots/v0.4.16/04-waiting-room.png" alt="대기실" width="100%"></a><br><b>대기실</b></td>
  </tr>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/06-strategy-board.png"><img src="docs/screenshots/v0.4.16/06-strategy-board.png" alt="전략 보드" width="100%"></a><br><b>전략 보드</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/08-element-battle.png"><img src="docs/screenshots/v0.4.16/08-element-battle.png" alt="속성 전투" width="100%"></a><br><b>속성 전투</b></td>
  </tr>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/05-start-shop.png"><img src="docs/screenshots/v0.4.16/05-start-shop.png" alt="시작 상점" width="100%"></a><br><b>시작 상점</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.16/07-turn-shop.png"><img src="docs/screenshots/v0.4.16/07-turn-shop.png" alt="턴 상점" width="100%"></a><br><b>턴 상점</b></td>
  </tr>
</table>

## 새로운 기능

**v0.4.16 — 튜토리얼·싱글플레이와 테이블탑 판타지 UI**

- **새 튜토리얼** — 새 계정으로 처음 로그인하면 마녀의 안내를 따라 기본 실습(말·이동·전투·승리 조건)과 심화 실습(상점·배치·AI와 첫 경기)으로 규칙을 배웁니다. 원하지 않으면 건너뛸 수 있습니다.
- **싱글플레이 · 무제한 AI 대전** — 튜토리얼을 마치거나 건너뛰면 열립니다. 브론즈·실버·골드 난이도가 있고, 이기면 다음 난이도가 열립니다. 진행은 계정에 저장됩니다. 이전 버전부터 쓰던 계정은 튜토리얼 없이 바로 이용할 수 있습니다.
- **입장 무료 · 횟수 제한 없음** — AI 대전 결과는 공식 전적·랭킹·보상에 반영되지 않습니다.
- **화면 전체의 미술 통일** — 로그인·로비·상점·보드·전투에 원목, 황동, 양피지 재질과 판타지 배경을 적용했습니다.
- **33종 회화풍 하수인과 대표기 효과** — 초상화·소형 아이콘·전투 모습을 같은 미니어처 화풍으로 연결하고, 일반 30종·전설 3종의 4번 대표기에 전용 효과를 표시합니다.
- **추후 공개** — 도전! 왕국 대전과 플래티넘 이상 난이도는 화면에 "추후 공개"로 표시됩니다.

[v0.4.16 릴리스 노트](docs/releases/v0.4.16.md) · [이전 릴리스](docs/releases/README.md)

## 게임 정보

| 항목 | 내용 |
| --- | --- |
| Release Version | [v0.4.16](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.16) |
| 플레이 주소 | [digit-duel.site](https://digit-duel.site) |
| 장르·인원 | 숨은 정체·속성 전투를 결합한 턴제 전략 — 온라인 1대1, AI 싱글플레이 |
| 환경 | PC·휴대폰의 최신 브라우저, 인터넷과 가입용 이메일 |
| 플랫폼 | HTML 웹 게임 |
| 개발자 | 성창조 (Sung Changjo) |
| 첫 정식 출시 | 2026-09-02 (v0.3.0) |

## 플레이 방법

1. [게임 페이지](https://digit-duel.site)에서 가입하거나 ID·비밀번호로 로그인합니다.
2. 처음 가입했다면 튜토리얼을 **진행**하거나 **건너뛰기**를 고릅니다. 기본과 심화를 마치거나 건너뛰면 로비로 이동합니다.
3. 로비에서 **멀티플레이**를 누르면 공개 방에서 다른 플레이어와 겨룹니다. 한 사람이 방을 만들고 상대가 참가합니다. 참가자가 준비하면 방장이 시작합니다. **싱글플레이 → 무제한 AI 대전**에서는 열린 난이도를 골라 AI와 바로 대전합니다.
4. 공통 **180초** 안에 시작 상점에서 하수인 6명을 고르고 왕·동료 속성을 정한 뒤 말 14개를 배치합니다. 양쪽이 준비를 마치면 바로 시작합니다.
5. 자기 차례 **30초** 안에 이동·탐색·회복·텔레포트를 선택합니다. 내 말의 정보는 오른쪽 **말 정보**에서 확인합니다.
6. 적과 맞붙으면 **60초** 안에 싸우기·가방·포획·도망을 선택합니다. 스텟 버튼으로 능력치 설명을 확인합니다. 가방이 가득 찬 포획 교체는 **30초**, 턴 상점의 구매·승급·교체는 **180초**입니다.
7. 세 가지 승리 조건 중 하나를 달성합니다. 멀티플레이 결과는 로비의 전적에, AI 대전 승리는 계정의 난이도 진행에만 반영됩니다.

Google 로그인·로비 상점·채팅은 잠겨 있고, 도전! 왕국 대전은 추후 공개입니다. 서버 재시작 시 진행 중인 경기는 복구되지 않으며 확정된 계정·전적·진행은 보존됩니다.

## 저장소 구조

~~~
demo/               웹 게임과 게임 자산
server/             계정·공개 방·경기 판정 서버
docs/releases/      버전별 릴리스 노트
docs/screenshots/   실제 게임 화면
~~~

## 라이선스

코드·문서는 [Apache License 2.0](LICENSE)입니다. 이름·아트·게임 화면의 이용 조건은 [ASSET-LICENSE.md](ASSET-LICENSE.md), 저작권 귀속은 [NOTICE](NOTICE)를 따릅니다.
