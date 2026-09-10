#!/usr/bin/env python3
"""Digit Dual v0.4.7 #124 왕·동료 납품 익스포터 (오프라인 결정적 · 검증기).

역할 계약: Mars (CLIENT_TOOLING). 이 도구는 아트를 **만들지 않는다**.
Earth 가 생성한 원본을 읽기 전용으로 열어 게임이 쓰는 크기로 **단순 축소**만 한다.
창작적 편집·매트 제거·색 보정·리터칭·합성을 하지 않는다 — 그런 변경이 필요하면 Earth 의 imagegen 으로 되돌린다.

입력 (Earth 소유 · 읽기 전용):
  docs/milestone/v0.4.7/issues/124/Earth/king-sovereign-source-v1.png       1254x1254 RGBA
  docs/milestone/v0.4.7/issues/124/Earth/companion-guide-source-v1.png      1254x1254 RGBA

출력 (Mars 소유):
  demo/assets/leaders/king/icon64.png            64x64  RGBA — 보드 말 아이콘 (32 CSS px 에 2x 로 표시)
  demo/assets/leaders/king/battle256.png         256x256 RGBA — 전투 스프라이트 (128 CSS px 에 2x 로 표시)
  demo/assets/leaders/companion/icon64.png       64x64  RGBA
  demo/assets/leaders/companion/battle256.png    256x256 RGBA
  demo/assets/leaders/leaders-manifest.json      납품 메타데이터 (원본·산출 크기·바이트·SHA-256)

변환 규칙 (전부):
  1. RGBA 로 연 원본을 **LANCZOS** 로 목표 크기까지 축소한다. 알파는 그대로 따라 축소된다.
  2. 그 밖의 픽셀 연산이 없다 — 크롭·패딩·매트 제거·색 공간 변환·샤프닝·양자화를 하지 않는다.
  3. PNG 는 optimize=True 로 굽는다 (minion_art.py 와 같은 저장 설정).
결정성: 같은 원본 + 같은 Pillow/zlib 환경이면 같은 바이트가 나온다. 잡 D 가 windows-2025 ·
Python 3.14.3 · Pillow 12.3.0 에서 --check 로 그 바이트를 대조한다 (인코더 환경이 다르면 흔들린다 —
requirements-art.txt 머리말의 관측 참조).

사용:
  python tools/art/leaders_export.py            # 산출물 생성·갱신 + 매니페스트 기록
  python tools/art/leaders_export.py --check    # **어떤 경로에도 쓰지 않고** 일치 여부만 판정 (CI 잡 D)
  python tools/art/leaders_export.py --list     # 계획만 출력 (쓰기 0)

종료 코드: 0 정상 · 1 불일치(--check) · 2 환경/입력 오류.
네트워크·AI 생성 의존성 없음. Python 표준 라이브러리 + Pillow 만 쓴다.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - 환경 오류 경로
    print("Pillow 가 필요합니다: python -m pip install -r tools/art/requirements-art.txt", file=sys.stderr)
    raise SystemExit(2)

REPO_ROOT = Path(__file__).resolve().parents[2]
REL_SOURCE_DIR = Path("docs/milestone/v0.4.7/issues/124/Earth")
REL_OUT_DIR = Path("demo/assets/leaders")
REL_MANIFEST = REL_OUT_DIR / "leaders-manifest.json"

# 말 종류 → (Earth 원본 파일, 게임 폴더). 이름은 소유자·진영과 무관하다 —
# 요청 목록이 어느 말이 어디 있는지와 상관관계를 만들지 않는다 (정보 은닉, demo/index.html #124 주석 참조).
LEADERS: dict[str, str] = {
    "king": "king-sovereign-source-v1.png",
    "companion": "companion-guide-source-v1.png",
}
# 산출 파일 → 한 변의 픽셀. 게임 CSS 표시 크기(32 / 128)의 2배라 고해상도 화면에서도 뭉개지지 않는다.
OUTPUTS: dict[str, int] = {"icon64.png": 64, "battle256.png": 256}

EXPECTED_SOURCE_SIZE = 1254  # Earth 납품 원본 실측 (정사각 RGBA). 다르면 경고만 하고 그대로 축소한다.


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def render_png(src: Image.Image, size: int) -> bytes:
    """원본을 size x size 로 축소해 PNG 바이트를 만든다. 축소 외의 편집은 하지 않는다."""
    if src.mode != "RGBA":
        src = src.convert("RGBA")
    out = src.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def build(repo_root: Path) -> tuple[list[dict], list[str]]:
    """계획을 만든다 — (산출물 목록, 문제 목록). 이 함수는 파일을 쓰지 않는다."""
    rows: list[dict] = []
    problems: list[str] = []
    for name, src_file in sorted(LEADERS.items()):
        src_path = repo_root / REL_SOURCE_DIR / src_file
        if not src_path.is_file():
            problems.append(f"원본이 없습니다: {REL_SOURCE_DIR / src_file}")
            continue
        src_bytes = src_path.read_bytes()
        with Image.open(io.BytesIO(src_bytes)) as im:
            im.load()
            src_size = im.size
            if im.mode != "RGBA":
                problems.append(f"{src_file}: RGBA 가 아닙니다 ({im.mode}) — 알파가 없으면 폴백 대신 사각 배경이 남습니다")
            if src_size[0] != src_size[1]:
                problems.append(f"{src_file}: 정사각이 아닙니다 {src_size} — 축소만 하는 도구라 비율을 임의로 바꾸지 않습니다")
            if src_size[0] != EXPECTED_SOURCE_SIZE:
                problems.append(f"[경고] {src_file}: 실측 원본 {EXPECTED_SOURCE_SIZE}px 와 다릅니다 {src_size}")
            for out_file, size in sorted(OUTPUTS.items()):
                data = render_png(im, size)
                rows.append({
                    "leader": name,
                    "path": str((REL_OUT_DIR / name / out_file).as_posix()),
                    "size": size,
                    "bytes": len(data),
                    "sha256": sha256_hex(data),
                    "source": str((REL_SOURCE_DIR / src_file).as_posix()),
                    "sourceSize": f"{src_size[0]}x{src_size[1]}",
                    "sourceSha256": sha256_hex(src_bytes),
                    "_data": data,
                })
    return rows, problems


def manifest_json(rows: list[dict]) -> bytes:
    doc = {
        "tool": "tools/art/leaders_export.py",
        "issue": "#124",
        "note": "Earth 원본을 LANCZOS 축소만 한 납품본. 창작적 편집·매트 제거·색 보정 없음.",
        "files": [{k: r[k] for k in ("leader", "path", "size", "bytes", "sha256", "source", "sourceSize", "sourceSha256")}
                  for r in sorted(rows, key=lambda r: r["path"])],
    }
    return (json.dumps(doc, ensure_ascii=False, indent=2, sort_keys=False) + "\n").encode("utf-8")


def run(repo_root: Path, check: bool, list_only: bool) -> int:
    rows, problems = build(repo_root)
    hard = [p for p in problems if not p.startswith("[경고]")]
    for p in problems:
        print(p, file=sys.stderr)
    if hard:
        return 2
    if not rows:
        print("산출할 항목이 없습니다.", file=sys.stderr)
        return 2

    man = manifest_json(rows)
    man_path = repo_root / REL_MANIFEST

    if list_only:
        for r in rows:
            print(f"  {r['path']}  {r['size']}px  {r['bytes']}B  {r['sha256'][:12]}  ← {r['source']}")
        print(f"  {REL_MANIFEST.as_posix()}  {len(man)}B")
        print(f"=== leaders_export --list: {len(rows)} 파일 + 매니페스트 (쓰기 0) ===")
        return 0

    if check:
        # --check 는 **어떤 경로에도 쓰지 않는다**. 승인된 납품 바이트를 재생성하지 않고 대조만 한다.
        bad: list[str] = []
        for r in rows:
            f = repo_root / r["path"]
            if not f.is_file():
                bad.append(f"없음      {r['path']}")
                continue
            cur = f.read_bytes()
            if cur != r["_data"]:
                bad.append(f"불일치    {r['path']}  (현재 {len(cur)}B/{sha256_hex(cur)[:12]} ≠ 생성 {r['bytes']}B/{r['sha256'][:12]})")
        if not man_path.is_file():
            bad.append(f"없음      {REL_MANIFEST.as_posix()}")
        elif man_path.read_bytes() != man:
            bad.append(f"불일치    {REL_MANIFEST.as_posix()}")
        for b in bad:
            print(b, file=sys.stderr)
        print(f"=== leaders_export --check: 일치 {len(rows) + 1 - len(bad)} / 불일치 {len(bad)} (쓰기 0) ===")
        return 1 if bad else 0

    written = 0
    for r in rows:
        f = repo_root / r["path"]
        f.parent.mkdir(parents=True, exist_ok=True)
        if not f.is_file() or f.read_bytes() != r["_data"]:
            f.write_bytes(r["_data"])
            written += 1
            print(f"쓰기      {r['path']}  {r['size']}px  {r['bytes']}B  {r['sha256'][:12]}")
        else:
            print(f"동일      {r['path']}")
    man_path.parent.mkdir(parents=True, exist_ok=True)
    if not man_path.is_file() or man_path.read_bytes() != man:
        man_path.write_bytes(man)
        written += 1
        print(f"쓰기      {REL_MANIFEST.as_posix()}  {len(man)}B")
    print(f"=== leaders_export: 갱신 {written} / 전체 {len(rows) + 1} ===")
    return 0


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="#124 왕·동료 납품 익스포터 (Earth 원본 → 게임 자산 단순 축소)")
    ap.add_argument("--check", action="store_true", help="쓰기 없이 납품 바이트·매니페스트 일치만 검사한다 (CI 잡 D)")
    ap.add_argument("--list", action="store_true", dest="list_only", help="계획만 출력한다 (쓰기 0)")
    ap.add_argument("--repo-root", default=str(REPO_ROOT), help="저장소 루트 (기본: 이 파일 기준)")
    a = ap.parse_args(argv)
    return run(Path(a.repo_root).resolve(), a.check, a.list_only)


if __name__ == "__main__":
    raise SystemExit(main())
