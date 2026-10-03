# Digit-Duel

<p align="center">
  <a href="docs/media/digit-duel-hero.png"><img src="docs/media/digit-duel-hero.png" alt="Digit-Duel 홍보 일러스트" width="100%"></a>
</p>

<p align="center">
  <a href="https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.14"><img src="https://img.shields.io/badge/v0.4.14-release-4c9a2a" alt="v0.4.14 릴리스"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/code-Apache--2.0-blue" alt="코드 라이선스 Apache-2.0"></a>
</p>

**[▶ 웹에서 플레이](https://digit-duel.site)** · 최신 릴리스 **[v0.4.14](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.14)**

## 게임 소개

**상대 말의 정체를 추리하며 싸우는 2인 온라인 턴제 전략 보드게임입니다.** 각자 말 14개를 비밀리에 배치합니다. 상대 말은 물음표로 보이고, 숲에 들어간 말은 위치도 숨겨집니다. 하수인을 움직여 단서를 모으고 속성 전투로 상대를 제압하세요.

상대 왕을 쓰러뜨리거나, 내 왕을 상대 진영의 마지막 줄까지 보내거나, 상대의 하수인과 동료를 모두 제거하면 승리합니다.

## 게임 기능

- **구매와 비밀 배치** — 일반 하수인 30종 중 6명을 고르고 왕·동료·폭탄·함정과 함께 7열 × 13행 보드에 배치합니다. 회복 아이템과 몬스터 볼은 각각 1개씩 가지고 시작합니다.
- **정체 추리와 숲** — 표시된 수풀에서 탐색해 코인을 얻고 숨은 말을 추적합니다. 공개된 적 말은 소속 표시로 구분하고, 상대 말에는 나만 보는 추측 메모를 남길 수 있습니다.
- **속성 전투** — 불 → 풀 → 땅 → 번개 → 물 → 불의 상성과 스킬·가방·포획·도망을 활용합니다. 전투 후 HP는 유지되고 상태이상·쿨타임은 초기화됩니다.
- **성장과 시너지** — 턴 상점에서 하수인을 승급·교체하고 아이템을 구매합니다. 왕국·아키타입 시너지로 전력을 조합하세요.
- **말 정보** — 내 말의 능력치·기술·미해금 기술 소개를 읽습니다. 전투에서는 양쪽 하수인의 HP·방어막·시너지 적용 능력치와 속성 상성을 확인합니다.
- **공개 방과 전적** — 방 이름으로 검색해 대전하고 이모티콘 6종으로 반응합니다. 로비에서 대표 하수인·공식 승패·최근 20경기를 확인합니다.

## 게임 플레이 사진

이미지를 누르면 원본 크기로 볼 수 있습니다.

<table>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.13/01-login.png"><img src="docs/screenshots/v0.4.13/01-login.png" alt="로그인" width="100%"></a><br><b>로그인</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.13/02-main-lobby.png"><img src="docs/screenshots/v0.4.13/02-main-lobby.png" alt="메인 로비" width="100%"></a><br><b>메인 로비</b></td>
  </tr>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.13/03-public-rooms.png"><img src="docs/screenshots/v0.4.13/03-public-rooms.png" alt="공개 방 목록" width="100%"></a><br><b>공개 방 목록</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.13/04-waiting-room.png"><img src="docs/screenshots/v0.4.13/04-waiting-room.png" alt="대기실" width="100%"></a><br><b>대기실</b></td>
  </tr>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.14/06-strategy-board.png"><img src="docs/screenshots/v0.4.14/06-strategy-board.png" alt="전략 보드" width="100%"></a><br><b>전략 보드</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.14/08-element-battle.png"><img src="docs/screenshots/v0.4.14/08-element-battle.png" alt="속성 전투" width="100%"></a><br><b>속성 전투</b></td>
  </tr>
  <tr>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.14/05-start-shop.png"><img src="docs/screenshots/v0.4.14/05-start-shop.png" alt="시작 상점" width="100%"></a><br><b>시작 상점</b></td>
    <td align="center" width="50%"><a href="docs/screenshots/v0.4.14/07-turn-shop.png"><img src="docs/screenshots/v0.4.14/07-turn-shop.png" alt="턴 상점" width="100%"></a><br><b>턴 상점</b></td>
  </tr>
</table>

## 새로운 기능

**v0.4.14 — 멀티플레이 수정과 화면 개선**

- **포획** — 조건과 잠금 사유를 명확히 표시합니다. 가방이 가득 차면 30초 안에 교체하거나 풀어주고, 상대는 대기합니다.
- **배틀** — 시너지를 한 줄로 펼치고 적용된 능력치를 확인합니다. 상성표에는 양쪽 참전 말의 속성과 피해 배율을 표시합니다.
- **전략 보드** — 공개된 적 말과 탐색 가능한 수풀을 쉽게 구분합니다. 수풀 속 말은 반투명하게 표시합니다.
- **상점·말 정보** — 등급별 5색과 고정 머리줄을 적용했습니다. 사망 하수인의 표시·시너지 기여, 왕·동료 HP 표시를 수정했습니다.

[릴리스 노트](docs/releases/v0.4.14.md) · [이전 릴리스](docs/releases/README.md)

## 게임 정보

| 항목 | 내용 |
| --- | --- |
| 현재 정식 버전 | [v0.4.14](https://github.com/ChangjoSung/Digit-Duel/releases/tag/v0.4.14) |
| 플레이 주소 | [digit-duel.site](https://digit-duel.site) |
| 장르·인원 | 숨은 정체·속성 전투를 결합한 온라인 1대1 턴제 전략 |
| 환경 | PC·휴대폰의 최신 브라우저, 인터넷과 가입용 이메일 |
| 플랫폼 | HTML 웹 게임 |
| 개발자 | 성창조 (Sung Changjo) |
| 첫 정식 출시 | 2026-09-02 (v0.3.0) |

## 플레이 방법

1. [게임 페이지](https://digit-duel.site)에서 가입하거나 ID·비밀번호로 로그인합니다.
2. 로비에서 **멀티플레이**를 누릅니다. 한 사람이 방을 만들고 상대가 참가합니다. 참가자가 준비하면 방장이 시작합니다.
3. 공통 **180초** 안에 시작 상점에서 하수인 6명을 고르고 왕·동료 속성을 정한 뒤 말 14개를 배치합니다. 양쪽이 준비를 마치면 바로 시작합니다.
4. 자기 차례 **30초** 안에 이동·탐색·회복·텔레포트를 선택합니다. 내 말의 정보는 오른쪽 **말 정보**에서 확인합니다.
5. 적과 맞붙으면 **60초** 안에 싸우기·가방·포획·도망을 선택합니다. 가방이 가득 찬 포획 교체는 **30초**, 턴 상점의 구매·승급·교체는 **180초**입니다.
6. 세 가지 승리 조건 중 하나를 달성하고 로비에서 전적을 확인합니다.

싱글플레이·Google 로그인·로비 상점·채팅은 잠겨 있습니다. 서버 재시작 시 진행 중인 경기는 복구되지 않으며 확정된 계정·전적은 보존됩니다.

## 저장소 구조

~~~
demo/               웹 게임과 게임 자산
server/             계정·공개 방·경기 판정 서버
docs/releases/      버전별 릴리스 노트
docs/screenshots/   실제 게임 화면
~~~

## 라이선스

코드·문서는 [Apache License 2.0](LICENSE)입니다. 이름·아트·게임 화면의 이용 조건은 [ASSET-LICENSE.md](ASSET-LICENSE.md), 저작권 귀속은 [NOTICE](NOTICE)를 따릅니다.
