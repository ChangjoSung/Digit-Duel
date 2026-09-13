'use strict';
// 좌석 토큰 — analysis.md §2.4.2~§2.4.4. 정체(roomId,seat)는 안정적이고 자격(토큰)은 회전한다.
const crypto = require('crypto');

const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/; // base64url, 128비트, 패딩 없음

function generateToken() {
  return crypto.randomBytes(16).toString('base64url'); // 22자
}

function isWellFormedToken(s) {
  return typeof s === 'string' && TOKEN_RE.test(s);
}

// 좌석마다 현재/직전 토큰과 tokenGen·connGen을 관리한다.
class SeatCredential {
  constructor() {
    this.current = generateToken();
    this.previous = null; // ack 겹침 동안만 유효 (§2.4.3)
    this.tokenGen = 0;
    this.connGen = 0; // 연결 펜싱 (§2.4.4)
    this.acked = true; // 마지막 회전이 confirmed 됐는가
  }

  // 재개 요청 토큰 검증. 결과: 'current' | 'previous' | 'invalid'
  classify(token) {
    if (!isWellFormedToken(token)) return 'invalid';
    if (this.timingSafeEqual(token, this.current)) return 'current';
    if (this.previous && this.timingSafeEqual(token, this.previous)) return 'previous';
    return 'invalid';
  }

  timingSafeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  }

  // 일반 명령 인증: 반드시 current + 일치하는 tokenGen만 허용 (previous는 재개 전용).
  verifyForCommand(token, tokenGen) {
    if (this.classify(token) !== 'current') return false;
    if (tokenGen !== this.tokenGen) return false;
    // 확인(ack): 현재 tokenGen을 실은 프레임을 받았으므로 직전 토큰을 폐기한다.
    if (this.previous) this.previous = null;
    this.acked = true;
    return true;
  }

  // 재개 승인. 아직 확인되지 않은 회전이 떠 있으면 재회전하지 않고 재전송한다 (§2.4.3 ack 겹침).
  resume(token) {
    const cls = this.classify(token);
    if (cls === 'invalid') return null;
    if (cls === 'current' && this.acked) {
      // 확인된 현재 토큰으로 재개 — 새 토큰을 회전 발급한다.
      this.previous = this.current;
      this.current = generateToken();
      this.tokenGen += 1;
      this.acked = false;
    }
    // cls === 'previous', 혹은 아직 확인되지 않은 'current' 재개는 회전하지 않고 그대로 재전송한다.
    this.connGen += 1;
    return { seatToken: this.current, tokenGen: this.tokenGen, connGen: this.connGen };
  }

  // 최초 발급(생성/참가) — 연결을 처음 승인할 때만 호출.
  issue() {
    this.connGen += 1;
    return { seatToken: this.current, tokenGen: this.tokenGen, connGen: this.connGen };
  }

  revokeAll() {
    this.current = generateToken();
    this.previous = null;
    this.acked = true;
  }
}

module.exports = { generateToken, isWellFormedToken, SeatCredential };
