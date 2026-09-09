#!/usr/bin/env python3
"""Digit Dual v0.4.3 하수인 아트 파이프라인 (오프라인 결정적 익스포터 · 검증기).

역할 계약: Mars (CLIENT_TOOLING). 이 도구는 아트 **데이터**를 만들지 않는다.
Earth가 작성한 소스 데이터를 읽어 납품 PNG와 검토용 미리보기를 생성·검증만 한다.

입력 (Earth 소유):
  docs/milestone/v0.4.3/assets/minions/pixel-sources/<id>.json    32x32 말판 아이콘 원본 데이터
  docs/milestone/v0.4.3/assets/minions/battle-patches/<id>.json   64 그리드 국소 보정 패치 (허용 4종만)

출력 (Mars 소유):
  demo/assets/minions/<id>/icon.png                  32x32 RGBA (전 20종)
  demo/assets/minions/<id>/battle-grid.png           64x64 RGBA (패치 4종만)
  demo/assets/minions/<id>/battle.png                128x128 RGBA, 64의 최근접 정확한 2배
  docs/milestone/v0.4.3/assets/minions/review/*.png               검토용 미리보기 시트
  docs/milestone/v0.4.3/assets/minions/delivery-manifest.csv      납품 메타데이터

네트워크·AI 생성 의존성 없음. Python 표준 라이브러리 + Pillow + git 읽기만 사용한다.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import sys
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:  # pragma: no cover - 환경 문제는 즉시 알린다
    raise SystemExit("Pillow가 필요합니다: python -m pip install Pillow") from exc


# --------------------------------------------------------------------------
# 규격 상수 — docs/minion-visual-spec-v0.4.3.md 4장 / 7.6 / 14.1
# --------------------------------------------------------------------------

ROSTER_IDS: tuple[str, ...] = (
    "fire_std", "fire_atk", "fire_def", "fire_swift", "fire_sustain",
    "water_std", "water_atk", "water_def", "water_swift", "water_sustain",
    "grass_std", "grass_atk", "grass_def", "grass_swift", "grass_sustain",
    "lightning_std", "lightning_atk", "lightning_def", "lightning_swift", "lightning_sustain",
)

#: 전투 도트 보정이 허용된 종. Saturn 원본 QA의 128px 가독성 REVISE 의견 4종.
BATTLE_PATCH_ALLOWLIST: frozenset[str] = frozenset(
    {"fire_sustain", "water_swift", "grass_atk", "lightning_atk"}
)

#: 전투 보정의 고정 기준 git 커밋. 멱등성과 원본 보존을 위해 작업 트리가 아니라
#: 이 커밋의 blob에서 64 그리드를 읽는다.
BATTLE_BASELINE_COMMIT = "202edf3c23e65453bd7db8dd9fed5fdf0587fd0d"

ICON_SIZE = 32
ICON_MARGIN = 2          # 상하좌우 투명 여백 (행/열 0,1,30,31)
ICON_GROUND_Y = 29       # 접지선 — 아트의 가장 아래 불투명 픽셀 y
# 시각 중심(AC 14.1.11)의 **기하 대리 지표**다. 불투명 외접상자의 가로 중점일 뿐이며
# 사람이 느끼는 무게중심을 측정하지 않는다. 이 검사를 통과해도 시각 중심 AC 통과가 아니다 —
# 실제 판정은 Saturn의 독립 지각 QA가 한다. AC 자체는 이 상수가 바꾸지 않는다.
ICON_BBOX_MIDPOINT_X = 15.5    # 외접상자 가로 중점 목표 (시각 중심 대리 지표)
ICON_BBOX_MIDPOINT_TOL = 1.0   # 대리 지표 허용 오차 (px) — 비대칭 포즈 여유
ICON_MAX_COLORS = 16     # 투명 제외 최대 색 수
ICON_RECOMMENDED_COLORS = (8, 12)

BATTLE_GRID_SIZE = 64
BATTLE_FILE_SIZE = 128

TRANSPARENT_SYMBOL = "."
TRANSPARENT_HEX = "#00000000"

#: 말판 진영 배경색 (demo/index.html 실측) — 대비 검토 시트에 사용.
BOARD_BACKGROUNDS: tuple[tuple[str, str], ...] = (
    ("side0", "#33406e"),
    ("side1", "#6e3340"),
    ("hidden", "#3a4152"),
)

_ID_RE = re.compile(r"^[a-z]+_[a-z]+$")
_HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")

#: 아트 소스·검토 산출물의 보관 위치. Issue #132(2026-09-09)에서 마일스톤 보관 구조로 옮겼다
#: (docs/art/minions-v0.4.3/ → docs/milestone/v0.4.3/assets/minions/, 전수 대조표는 docs/milestone/MOVES.csv).
#: 네 경로가 같은 접두사를 공유하므로 base 하나만 두고 파생한다 — 다음 이동 때 이 한 줄만 고치면 된다.
REL_ART_BASE = Path("docs/milestone/v0.4.3/assets/minions")
REL_PIXEL_SOURCES = REL_ART_BASE / "pixel-sources"
REL_BATTLE_PATCHES = REL_ART_BASE / "battle-patches"
REL_REVIEW = REL_ART_BASE / "review"
REL_MANIFEST = REL_ART_BASE / "delivery-manifest.csv"
#: 납품 자산은 게임이 상대경로로 로드하므로 이동 대상이 아니다. BATTLE_BASELINE_COMMIT 기준
#: git blob 조회(read_baseline_grid 등)도 전부 이 경로만 쓰므로 위 이동의 영향을 받지 않는다.
REL_ASSETS = Path("demo/assets/minions")


class ArtError(Exception):
    """데이터·규격 위반. 메시지는 어떤 파일의 무엇이 틀렸는지 그대로 말한다."""


# --------------------------------------------------------------------------
# 공통 유틸
# --------------------------------------------------------------------------

def safe_minion_id(raw: object, *, where: str) -> str:
    """로스터에 실재하는 안전한 종 id만 통과시킨다 (경로 조작 차단)."""
    if not isinstance(raw, str):
        raise ArtError(f"{where}: id는 문자열이어야 합니다 (받은 값 {raw!r})")
    if not _ID_RE.fullmatch(raw):
        raise ArtError(f"{where}: 안전하지 않은 id {raw!r} — 소문자 '속성_아키타입' 형식만 허용합니다")
    if raw not in ROSTER_IDS:
        raise ArtError(f"{where}: 로스터에 없는 id {raw!r} (12장 매핑표 20종만 허용)")
    return raw


def parse_hex_color(raw: object, *, where: str, allow_transparent: bool) -> tuple[int, int, int, int]:
    """#RRGGBB 또는 #RRGGBBAA 를 RGBA로. 알파는 00 또는 FF만 허용한다."""
    if not isinstance(raw, str) or not _HEX_RE.fullmatch(raw):
        raise ArtError(f"{where}: 색은 '#RRGGBB' 또는 '#RRGGBBAA' 형식이어야 합니다 (받은 값 {raw!r})")
    body = raw[1:]
    r, g, b = (int(body[i:i + 2], 16) for i in (0, 2, 4))
    a = int(body[6:8], 16) if len(body) == 8 else 255
    if a not in (0, 255):
        raise ArtError(f"{where}: 중간 알파 {a}는 허용되지 않습니다 — 투명 0 또는 불투명 255만 사용하세요 ({raw})")
    if a == 0 and not allow_transparent:
        raise ArtError(f"{where}: 이 자리에는 투명색을 쓸 수 없습니다 ({raw})")
    return (r, g, b, a)


def load_json(path: Path) -> dict:
    if not path.is_file():
        raise ArtError(f"소스 파일이 없습니다: {path}")
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except json.JSONDecodeError as exc:
        raise ArtError(f"{path}: JSON 파싱 실패 — {exc}") from exc
    if not isinstance(data, dict):
        raise ArtError(f"{path}: 최상위는 객체여야 합니다")
    return data


def png_bytes(img: Image.Image) -> bytes:
    """결정적 PNG 인코딩. Pillow는 타임스탬프 청크를 쓰지 않는다."""
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def nearest_2x(img: Image.Image) -> Image.Image:
    return img.resize((img.width * 2, img.height * 2), Image.Resampling.NEAREST)


@lru_cache(maxsize=256)
def git_blob(repo_root: Path, commit: str, rel_path: str) -> bytes:
    """고정 git 객체에서 파일 바이트를 읽는다 (읽기 전용, 작업 트리 무시).

    커밋 해시로 지정한 객체는 불변이므로 캐시해도 안전하다. 보존 검증이 같은 원본을
    반복해서 읽기 때문에 캐시가 없으면 실행마다 80회 넘는 프로세스를 띄우게 된다.
    """
    proc = subprocess.run(
        ["git", "-C", str(repo_root), "cat-file", "blob", f"{commit}:{rel_path}"],
        capture_output=True,
    )
    if proc.returncode != 0:
        detail = proc.stderr.decode("utf-8", "replace").strip()
        raise ArtError(f"git 객체를 읽지 못했습니다 ({commit}:{rel_path}) — {detail}")
    return proc.stdout


# --------------------------------------------------------------------------
# 아이콘 소스 (32x32 직접 픽셀 데이터)
# --------------------------------------------------------------------------

@dataclass
class IconSource:
    minion_id: str
    path: Path
    palette: dict[str, tuple[int, int, int, int]]
    rows: list[str]
    notes: str = ""
    warnings: list[str] = field(default_factory=list)
    used_colors: int = 0
    bbox: tuple[int, int, int, int] = (0, 0, 0, 0)
    bbox_midpoint_x: float = 0.0  # 시각 중심의 기하 대리 지표 (지각 판정 아님)


def load_icon_source(path: Path, *, expected_id: str | None = None) -> IconSource:
    data = load_json(path)
    where = str(path)

    minion_id = safe_minion_id(data.get("id"), where=where)
    if expected_id is not None and minion_id != expected_id:
        raise ArtError(f"{where}: 파일 이름의 id '{expected_id}'와 본문 id '{minion_id}'가 다릅니다")

    width, height = data.get("width"), data.get("height")
    if width != ICON_SIZE or height != ICON_SIZE:
        raise ArtError(f"{where}: width/height는 {ICON_SIZE}이어야 합니다 (받은 값 {width!r}x{height!r})")

    raw_palette = data.get("palette")
    if not isinstance(raw_palette, dict) or not raw_palette:
        raise ArtError(f"{where}: palette는 비어 있지 않은 객체여야 합니다")

    palette: dict[str, tuple[int, int, int, int]] = {TRANSPARENT_SYMBOL: (0, 0, 0, 0)}
    for symbol, value in raw_palette.items():
        if not isinstance(symbol, str) or len(symbol) != 1 or not (33 <= ord(symbol) <= 126):
            raise ArtError(f"{where}: 팔레트 기호 {symbol!r}는 공백이 아닌 ASCII 한 글자여야 합니다")
        if symbol == TRANSPARENT_SYMBOL:
            if value != TRANSPARENT_HEX:
                raise ArtError(f"{where}: '.' 기호는 {TRANSPARENT_HEX} 전용입니다 (받은 값 {value!r})")
            continue
        rgba = parse_hex_color(value, where=f"{where} palette['{symbol}']", allow_transparent=False)
        palette[symbol] = rgba

    if len(palette) - 1 == 0:
        raise ArtError(f"{where}: 불투명 팔레트 색이 하나도 없습니다")
    if len(palette) - 1 > ICON_MAX_COLORS:
        raise ArtError(
            f"{where}: 팔레트 불투명 색 {len(palette) - 1}개 — 최대 {ICON_MAX_COLORS}색을 넘습니다"
        )

    rows = data.get("pixels")
    if not isinstance(rows, list) or len(rows) != ICON_SIZE:
        got = len(rows) if isinstance(rows, list) else type(rows).__name__
        raise ArtError(f"{where}: pixels는 정확히 {ICON_SIZE}개의 문자열이어야 합니다 (받은 값 {got})")
    for y, row in enumerate(rows):
        if not isinstance(row, str):
            raise ArtError(f"{where}: pixels[{y}]가 문자열이 아닙니다")
        if len(row) != ICON_SIZE:
            raise ArtError(f"{where}: pixels[{y}] 길이 {len(row)} — 정확히 {ICON_SIZE}자여야 합니다")

    # 미지 기호 검사
    for y, row in enumerate(rows):
        for x, symbol in enumerate(row):
            if symbol not in palette:
                raise ArtError(f"{where}: pixels[{y}][{x}]의 기호 {symbol!r}가 팔레트에 없습니다")

    src = IconSource(
        minion_id=minion_id,
        path=path,
        palette=palette,
        rows=list(rows),
        notes=str(data.get("notes", "")),
    )
    _validate_icon_geometry(src)
    return src


def _validate_icon_geometry(src: IconSource) -> None:
    where = str(src.path)
    rows = src.rows
    edge = tuple(range(ICON_MARGIN)) + tuple(range(ICON_SIZE - ICON_MARGIN, ICON_SIZE))

    for y in edge:
        if any(ch != TRANSPARENT_SYMBOL for ch in rows[y]):
            raise ArtError(f"{where}: 행 {y}는 전부 투명이어야 합니다 (여백 {ICON_MARGIN}px 위반)")
    for x in edge:
        for y in range(ICON_SIZE):
            if rows[y][x] != TRANSPARENT_SYMBOL:
                raise ArtError(f"{where}: 열 {x}는 전부 투명이어야 합니다 (여백 {ICON_MARGIN}px 위반, y={y})")

    opaque = [
        (x, y)
        for y in range(ICON_SIZE)
        for x in range(ICON_SIZE)
        if rows[y][x] != TRANSPARENT_SYMBOL
    ]
    if not opaque:
        raise ArtError(f"{where}: 불투명 픽셀이 하나도 없습니다")

    min_x = min(x for x, _ in opaque)
    max_x = max(x for x, _ in opaque)
    min_y = min(y for _, y in opaque)
    max_y = max(y for _, y in opaque)
    src.bbox = (min_x, min_y, max_x, max_y)

    if max_y != ICON_GROUND_Y:
        raise ArtError(
            f"{where}: 접지선 위반 — 가장 아래 불투명 픽셀 y={max_y}, 규격은 y={ICON_GROUND_Y}"
        )

    # 대리 지표 검사: 외접상자 중점만 본다. 지각적 중심은 사람이 판정한다 (AC 14.1.11).
    midpoint = (min_x + max_x) / 2
    src.bbox_midpoint_x = midpoint
    if abs(midpoint - ICON_BBOX_MIDPOINT_X) > ICON_BBOX_MIDPOINT_TOL:
        raise ArtError(
            f"{where}: 시각 중심 대리 지표 위반 — 외접상자 가로 중점 x={midpoint:.1f}, "
            f"목표 x={ICON_BBOX_MIDPOINT_X} ±{ICON_BBOX_MIDPOINT_TOL}. "
            f"(이 검사는 기하 근사이며 지각적 시각 중심 판정을 대체하지 않는다)"
        )

    used_symbols = {rows[y][x] for x, y in opaque}
    used_colors = {src.palette[s] for s in used_symbols}
    src.used_colors = len(used_colors)
    if src.used_colors > ICON_MAX_COLORS:
        raise ArtError(
            f"{where}: 실제 사용 불투명 색 {src.used_colors}개 — 최대 {ICON_MAX_COLORS}색 초과"
        )

    unused = sorted(set(src.palette) - used_symbols - {TRANSPARENT_SYMBOL})
    if unused:
        src.warnings.append(f"팔레트에 선언됐지만 쓰이지 않은 기호: {' '.join(unused)}")
    lo, hi = ICON_RECOMMENDED_COLORS
    if not (lo <= src.used_colors <= hi):
        src.warnings.append(f"사용 색 {src.used_colors}개 — 권장 {lo}~{hi}색 범위 밖 (규격 위반 아님)")


def render_icon(src: IconSource) -> Image.Image:
    img = Image.new("RGBA", (ICON_SIZE, ICON_SIZE), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(src.rows):
        for x, symbol in enumerate(row):
            px[x, y] = src.palette[symbol]
    return img


# --------------------------------------------------------------------------
# 전투 도트 국소 보정 패치 (64 그리드)
# --------------------------------------------------------------------------

@dataclass
class BattlePatch:
    minion_id: str
    path: Path
    pixels: list[tuple[int, int, tuple[int, int, int, int]]]
    notes: str = ""


def load_battle_patch(path: Path, *, expected_id: str | None = None) -> BattlePatch:
    data = load_json(path)
    where = str(path)

    minion_id = safe_minion_id(data.get("id"), where=where)
    if expected_id is not None and minion_id != expected_id:
        raise ArtError(f"{where}: 파일 이름의 id '{expected_id}'와 본문 id '{minion_id}'가 다릅니다")
    if minion_id not in BATTLE_PATCH_ALLOWLIST:
        raise ArtError(
            f"{where}: '{minion_id}'는 전투 보정 허용 목록에 없습니다 "
            f"(허용: {', '.join(sorted(BATTLE_PATCH_ALLOWLIST))})"
        )

    baseline = data.get("baseline")
    if baseline != BATTLE_BASELINE_COMMIT:
        raise ArtError(
            f"{where}: baseline이 고정 기준 {BATTLE_BASELINE_COMMIT}과 다릅니다 (받은 값 {baseline!r})"
        )

    raw_pixels = data.get("pixels")
    if not isinstance(raw_pixels, list) or not raw_pixels:
        raise ArtError(f"{where}: pixels는 비어 있지 않은 배열이어야 합니다")

    seen: dict[tuple[int, int], int] = {}
    pixels: list[tuple[int, int, tuple[int, int, int, int]]] = []
    for i, entry in enumerate(raw_pixels):
        loc = f"{where} pixels[{i}]"
        if not isinstance(entry, list) or len(entry) != 3:
            raise ArtError(f"{loc}: [x, y, '#RRGGBB(AA)'] 3원소 배열이어야 합니다 (받은 값 {entry!r})")
        x, y, color = entry
        for name, value in (("x", x), ("y", y)):
            if not isinstance(value, int) or isinstance(value, bool):
                raise ArtError(f"{loc}: {name}는 정수여야 합니다 (받은 값 {value!r})")
            if not 0 <= value < BATTLE_GRID_SIZE:
                raise ArtError(f"{loc}: {name}={value}는 0~{BATTLE_GRID_SIZE - 1} 범위를 벗어납니다")
        if (x, y) in seen:
            raise ArtError(f"{loc}: 좌표 ({x},{y})가 pixels[{seen[(x, y)]}]와 중복됩니다")
        seen[(x, y)] = i
        rgba = parse_hex_color(color, where=loc, allow_transparent=True)
        pixels.append((x, y, rgba))

    return BattlePatch(
        minion_id=minion_id,
        path=path,
        pixels=pixels,
        notes=str(data.get("notes", "")),
    )


def read_baseline_grid(repo_root: Path, minion_id: str) -> Image.Image:
    rel = f"{REL_ASSETS.as_posix()}/{minion_id}/battle-grid.png"
    raw = git_blob(repo_root, BATTLE_BASELINE_COMMIT, rel)
    img = Image.open(io.BytesIO(raw))
    img.load()
    img = img.convert("RGBA")
    if img.size != (BATTLE_GRID_SIZE, BATTLE_GRID_SIZE):
        raise ArtError(f"기준 {rel}의 크기가 {img.size} — {BATTLE_GRID_SIZE}x{BATTLE_GRID_SIZE}이어야 합니다")
    return img


def apply_battle_patch(grid: Image.Image, patch: BattlePatch) -> tuple[Image.Image, int]:
    """기준 64 그리드에 좌표 덮어쓰기를 적용한다. (결과, 실제로 바뀐 픽셀 수)"""
    out = grid.copy()
    px = out.load()
    changed = 0
    for x, y, rgba in patch.pixels:
        if px[x, y] != rgba:
            changed += 1
        px[x, y] = rgba

    # 캔버스 경계 잘림 방지 — 보정으로 아트가 가장자리에 닿으면 거부한다.
    check = out.load()
    for i in range(BATTLE_GRID_SIZE):
        for x, y in ((i, 0), (i, BATTLE_GRID_SIZE - 1), (0, i), (BATTLE_GRID_SIZE - 1, i)):
            if check[x, y][3] != 0:
                raise ArtError(
                    f"{patch.path}: 보정 결과가 캔버스 경계 ({x},{y})에 불투명 픽셀을 만듭니다"
                )
    return out, changed


# --------------------------------------------------------------------------
# 미리보기 시트
# --------------------------------------------------------------------------

def _font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # pragma: no cover - 구버전 Pillow
        return ImageFont.load_default()


def _checker(size: tuple[int, int], cell: int = 4) -> Image.Image:
    img = Image.new("RGBA", size, (58, 58, 66, 255))
    d = ImageDraw.Draw(img)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if ((x // cell) + (y // cell)) % 2 == 0:
                d.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(76, 76, 86, 255))
    return img


def _paste(dst: Image.Image, src: Image.Image, box: tuple[int, int]) -> None:
    dst.alpha_composite(src, dest=box)


def build_contact_sheet(icons: list[tuple[str, Image.Image]]) -> Image.Image:
    """색 1x / 4x 확대 대조 시트."""
    cols = 5
    cell_w, cell_h = 176, 168
    rows = (len(icons) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h + 22), (24, 26, 34, 255))
    d = ImageDraw.Draw(sheet)
    d.text((6, 5), f"Digit Dual v0.4.3 board icons - 1x / 4x  ({len(icons)} ids)",
           font=_font(13), fill=(232, 234, 240, 255))
    for i, (minion_id, icon) in enumerate(icons):
        ox, oy = (i % cols) * cell_w, 22 + (i // cols) * cell_h
        d.text((ox + 6, oy + 4), minion_id, font=_font(12), fill=(210, 214, 226, 255))
        big = icon.resize((128, 128), Image.Resampling.NEAREST)
        _paste(sheet, _checker((128, 128)), (ox + 6, oy + 22))
        _paste(sheet, big, (ox + 6, oy + 22))
        _paste(sheet, _checker((32, 32)), (ox + 140, oy + 22))
        _paste(sheet, icon, (ox + 140, oy + 22))
        d.text((ox + 140, oy + 58), "1x", font=_font(11), fill=(170, 176, 190, 255))
    return sheet


def build_background_sheet(icons: list[tuple[str, Image.Image]]) -> Image.Image:
    """세 진영 배경색 위 1x / 4x 대비 검토 시트 (AC 14.1.10)."""
    row_h = 140
    head = 40
    label_w = 130
    tile_w = 190
    sheet = Image.new("RGBA", (label_w + tile_w * len(BOARD_BACKGROUNDS), head + row_h * len(icons)),
                      (24, 26, 34, 255))
    d = ImageDraw.Draw(sheet)
    d.text((6, 5), "Board background contrast - 4x + 1x on side0 / side1 / hidden",
           font=_font(13), fill=(232, 234, 240, 255))
    for j, (name, hexcolor) in enumerate(BOARD_BACKGROUNDS):
        d.text((label_w + j * tile_w + 6, 24), f"{name} {hexcolor}", font=_font(12),
               fill=(210, 214, 226, 255))
    for i, (minion_id, icon) in enumerate(icons):
        oy = head + i * row_h
        d.text((6, oy + 50), minion_id, font=_font(12), fill=(210, 214, 226, 255))
        big = icon.resize((128, 128), Image.Resampling.NEAREST)
        for j, (_name, hexcolor) in enumerate(BOARD_BACKGROUNDS):
            ox = label_w + j * tile_w + 6
            d.rectangle([ox, oy + 4, ox + 127, oy + 131], fill=hexcolor)
            _paste(sheet, big, (ox, oy + 4))
            d.rectangle([ox + 136, oy + 4, ox + 167, oy + 35], fill=hexcolor)
            _paste(sheet, icon, (ox + 136, oy + 4))
    return sheet


def build_silhouette_sheet(icons: list[tuple[str, Image.Image]]) -> Image.Image:
    """알파 실루엣 흑/백 대조 시트 (AC 14.1.7). 32 -> 64, 실제 2배 확대."""
    cols = 5
    cell_w, cell_h = 150, 180
    rows = (len(icons) + cols - 1) // cols
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h + 22), (24, 26, 34, 255))
    d = ImageDraw.Draw(sheet)
    d.text((6, 5), "Alpha silhouette 2x (32->64) - black-on-white / white-on-black",
           font=_font(13), fill=(232, 234, 240, 255))
    for i, (minion_id, icon) in enumerate(icons):
        ox, oy = (i % cols) * cell_w, 22 + (i // cols) * cell_h
        d.text((ox + 6, oy + 4), minion_id, font=_font(12), fill=(210, 214, 226, 255))
        mask = icon.getchannel("A").point(lambda a: 255 if a else 0)
        mask2x = mask.resize((64, 64), Image.Resampling.NEAREST)
        dark = Image.new("RGBA", (64, 64), (255, 255, 255, 255))
        dark.paste((16, 16, 20, 255), (0, 0), mask2x)
        light = Image.new("RGBA", (64, 64), (16, 16, 20, 255))
        light.paste((248, 248, 252, 255), (0, 0), mask2x)
        _paste(sheet, dark, (ox + 6, oy + 22))
        _paste(sheet, light, (ox + 76, oy + 22))
    return sheet


def build_battle_compare(
    minion_id: str,
    portrait: Image.Image,
    original_grid: Image.Image,
    original_battle: Image.Image,
    patched_grid: Image.Image,
) -> Image.Image:
    """원본 일러스트 · 원본 64/128 · 보정 128 · 변경 픽셀 지도 대조."""
    tile = 128
    pad = 10
    labels = ["portrait 512->128", "original grid 64 (2x)", "original battle 128",
              "patched battle 128", "changed pixels"]
    sheet = Image.new("RGBA", (pad + (tile + pad) * len(labels), 200), (24, 26, 34, 255))
    d = ImageDraw.Draw(sheet)
    d.text((pad, 6), f"{minion_id} - battle repair compare (baseline {BATTLE_BASELINE_COMMIT[:7]})",
           font=_font(13), fill=(232, 234, 240, 255))

    diff = Image.new("RGBA", (BATTLE_GRID_SIZE, BATTLE_GRID_SIZE), (20, 20, 26, 255))
    dpx = diff.load()
    before = original_grid.load()
    after = patched_grid.load()
    for y in range(BATTLE_GRID_SIZE):
        for x in range(BATTLE_GRID_SIZE):
            if before[x, y] != after[x, y]:
                dpx[x, y] = (255, 96, 96, 255)

    views = [
        portrait.resize((tile, tile), Image.Resampling.LANCZOS),
        nearest_2x(original_grid),
        original_battle,
        nearest_2x(patched_grid),
        diff.resize((tile, tile), Image.Resampling.NEAREST),
    ]
    for i, (label, view) in enumerate(zip(labels, views)):
        ox = pad + i * (tile + pad)
        _paste(sheet, _checker((tile, tile)), (ox, 24))
        _paste(sheet, view.convert("RGBA"), (ox, 24))
        d.text((ox, 24 + tile + 6), label, font=_font(11), fill=(200, 205, 218, 255))
    return sheet


# --------------------------------------------------------------------------
# 실행 드라이버 — 계획 → 보존 검증 → 기록
#
# 순서가 계약이다. 요청한 입력을 전부 읽고 검증해 산출물 바이트를 메모리에 완성한 뒤,
# 저장소 자산의 보존을 확인하고, 그제서야 기록한다. 어느 단계에서 실패하든
# 파일은 한 개도 쓰이지 않는다 — 자산·매니페스트·미리보기가 반쯤 갱신되는 상태가 없다.
# --------------------------------------------------------------------------

@dataclass
class Plan:
    """이번 실행이 만들 산출물 전체. 기록 전에 완성되고, 완성에 실패하면 통째로 버려진다."""

    outputs: dict[str, bytes] = field(default_factory=dict)   # 저장소 상대 posix 경로 -> 바이트
    manifest: list[dict[str, str]] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    patched_ids: set[str] = field(default_factory=set)


@dataclass
class Outcome:
    written: list[str] = field(default_factory=list)
    unchanged: list[str] = field(default_factory=list)
    mismatched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    problems: list[str] = field(default_factory=list)   # 보존 위반
    manifest: list[dict[str, str]] = field(default_factory=list)
    patched_ids: set[str] = field(default_factory=set)
    wrote_nothing: bool = False                        # 이번 실행이 파일을 하나도 쓰지 않았다

    @property
    def failed(self) -> bool:
        return bool(self.mismatched or self.missing or self.problems)


# --------------------------------------------------------------------------
# 보존 검증
# --------------------------------------------------------------------------

def expected_patched_battle(repo_root: Path, minion_id: str) -> tuple[bytes, bytes]:
    """보정 데이터 + 고정 기준 커밋으로 계산한 (battle-grid, battle) 기대 바이트."""
    patch = load_battle_patch(
        repo_root / REL_BATTLE_PATCHES / f"{minion_id}.json", expected_id=minion_id)
    grid, _changed = apply_battle_patch(read_baseline_grid(repo_root, minion_id), patch)
    return png_bytes(grid), png_bytes(nearest_2x(grid))


def verify_repository_assets(repo_root: Path, *, skip: set[str] | None = None) -> list[str]:
    """저장소의 원본·전투 자산이 **합법적인 값**인지 확인한다.

    - `portrait.png`·`portrait.webp` 40장: 언제나 기준 커밋과 바이트 동일해야 한다.
    - 전투 파일: 보정 데이터가 없으면 기준 커밋과 동일해야 한다. 보정 데이터가 있으면
      **기준 커밋 원본** 이거나 **그 패치를 기준에 적용한 결과** 둘 중 하나여야 한다.
      허용 목록이라는 이유만으로 검사를 면제하지 않는다 — 부분집합(`--ids`) 실행에서
      이번 대상이 아닌 이미 보정된 종을 "원본 위반"으로 오판하지도, 무검증 통과시키지도 않는다.
    - `skip`: 이번 실행이 곧 덮어쓸 경로. 아직 옛 내용일 수 있으므로 이 단계에서 제외한다.
    """
    skip = skip or set()
    problems: list[str] = []

    for minion_id in ROSTER_IDS:
        for name in ("portrait.png", "portrait.webp"):
            rel = f"{REL_ASSETS.as_posix()}/{minion_id}/{name}"
            path = repo_root / rel
            if not path.is_file():
                problems.append(f"{rel}: 파일 없음")
            elif path.read_bytes() != git_blob(repo_root, BATTLE_BASELINE_COMMIT, rel):
                problems.append(f"{rel}: 기준 커밋과 바이트가 다릅니다 (portrait는 보정 대상이 아님)")

        expected: tuple[bytes, bytes] | None = None
        patch_path = repo_root / REL_BATTLE_PATCHES / f"{minion_id}.json"
        if minion_id in BATTLE_PATCH_ALLOWLIST and patch_path.is_file():
            try:
                expected = expected_patched_battle(repo_root, minion_id)
            except ArtError as exc:
                problems.append(
                    f"{REL_BATTLE_PATCHES.as_posix()}/{minion_id}.json: "
                    f"보정 데이터를 읽을 수 없어 전투 파일을 검증할 수 없습니다 — {exc}")

        for index, name in enumerate(("battle-grid.png", "battle.png")):
            rel = f"{REL_ASSETS.as_posix()}/{minion_id}/{name}"
            if rel in skip:
                continue
            path = repo_root / rel
            if not path.is_file():
                problems.append(f"{rel}: 파일 없음")
                continue
            data = path.read_bytes()
            if data == git_blob(repo_root, BATTLE_BASELINE_COMMIT, rel):
                continue
            if expected is not None and data == expected[index]:
                continue
            problems.append(
                f"{rel}: 기준 커밋 원본도 아니고 승인된 보정 결과도 아닙니다 "
                f"(파이프라인 밖에서 변경된 파일)")

    return problems


# --------------------------------------------------------------------------
# 계획 수립
# --------------------------------------------------------------------------

def build_plan(repo_root: Path, ids: list[str], *,
               make_previews: bool) -> tuple[Plan | None, list[str]]:
    """요청한 모든 입력을 읽고 검증해 산출물 바이트를 완성한다. 파일은 쓰지 않는다.

    반환: `(plan, missing_inputs)`. 입력이 하나라도 없으면 `(None, [경로...])`.
    데이터가 있으나 규격 위반이면 `ArtError`를 올린다 — 두 경우 모두 기록 단계에 가지 않는다.

    명시적으로 요청한 종은 아이콘 소스가 **반드시** 있어야 한다. 허용 목록 4종은 전투 보정
    패치도 함께 있어야 한다. `--ids`가 조용히 아무것도 만들지 않고 성공을 주장하지 않는다.
    """
    missing: list[str] = []
    for minion_id in ids:
        icon_rel = REL_PIXEL_SOURCES / f"{minion_id}.json"
        if not (repo_root / icon_rel).is_file():
            missing.append(icon_rel.as_posix())
        if minion_id in BATTLE_PATCH_ALLOWLIST:
            patch_rel = REL_BATTLE_PATCHES / f"{minion_id}.json"
            if not (repo_root / patch_rel).is_file():
                missing.append(patch_rel.as_posix())
    if missing:
        return None, missing

    plan = Plan()
    icons: list[tuple[str, Image.Image]] = []

    for minion_id in ids:
        src = load_icon_source(repo_root / REL_PIXEL_SOURCES / f"{minion_id}.json",
                               expected_id=minion_id)
        plan.warnings += [f"{minion_id}: {w}" for w in src.warnings]
        icon = render_icon(src)
        data = png_bytes(icon)
        rel = (REL_ASSETS / minion_id / "icon.png").as_posix()
        plan.outputs[rel] = data
        icons.append((minion_id, icon))
        plan.manifest.append({
            "kind": "icon", "id": minion_id, "path": rel,
            "bytes": str(len(data)), "sha256": sha256_hex(data),
            "detail": (f"colors={src.used_colors};bbox={src.bbox};"
                       f"bboxMidX={src.bbox_midpoint_x}(proxy)"),
        })

        if minion_id not in BATTLE_PATCH_ALLOWLIST:
            continue

        patch = load_battle_patch(repo_root / REL_BATTLE_PATCHES / f"{minion_id}.json",
                                  expected_id=minion_id)
        baseline_grid = read_baseline_grid(repo_root, minion_id)
        grid, changed = apply_battle_patch(baseline_grid, patch)
        battle = nearest_2x(grid)
        grid_data, battle_data = png_bytes(grid), png_bytes(battle)
        rel_grid = (REL_ASSETS / minion_id / "battle-grid.png").as_posix()
        rel_battle = (REL_ASSETS / minion_id / "battle.png").as_posix()
        plan.outputs[rel_grid] = grid_data
        plan.outputs[rel_battle] = battle_data
        plan.patched_ids.add(minion_id)
        plan.manifest.append({
            "kind": "battle-grid", "id": minion_id, "path": rel_grid,
            "bytes": str(len(grid_data)), "sha256": sha256_hex(grid_data),
            "detail": f"patched={len(patch.pixels)};changed={changed}",
        })
        plan.manifest.append({
            "kind": "battle", "id": minion_id, "path": rel_battle,
            "bytes": str(len(battle_data)), "sha256": sha256_hex(battle_data),
            "detail": "nearest2x(battle-grid)",
        })
        if make_previews:
            portrait = Image.open(repo_root / REL_ASSETS / minion_id / "portrait.png")
            portrait.load()
            original_battle = Image.open(io.BytesIO(git_blob(
                repo_root, BATTLE_BASELINE_COMMIT,
                f"{REL_ASSETS.as_posix()}/{minion_id}/battle.png")))
            original_battle.load()
            sheet = build_battle_compare(minion_id, portrait.convert("RGBA"), baseline_grid,
                                         original_battle.convert("RGBA"), grid)
            key = (REL_REVIEW / f"battle-repair-{minion_id}.png").as_posix()
            plan.outputs[key] = png_bytes(sheet)

    if make_previews and icons:
        for name, sheet in (
            ("icons-contact-sheet.png", build_contact_sheet(icons)),
            ("icons-board-backgrounds.png", build_background_sheet(icons)),
            ("icons-silhouette.png", build_silhouette_sheet(icons)),
        ):
            plan.outputs[(REL_REVIEW / name).as_posix()] = png_bytes(sheet)

    if plan.manifest:
        buf = io.StringIO()
        writer = csv.DictWriter(
            buf, fieldnames=["kind", "id", "path", "bytes", "sha256", "detail"],
            lineterminator="\n")
        writer.writeheader()
        for row in sorted(plan.manifest, key=lambda r: r["path"]):
            writer.writerow(row)
        plan.outputs[REL_MANIFEST.as_posix()] = buf.getvalue().encode("utf-8")

    return plan, []


def _manifest_shrink_problems(repo_root: Path, ids: list[str]) -> list[str]:
    """부분집합 실행이 이미 납품된 종을 매니페스트·집계 시트에서 지워버리는 것을 막는다.

    집계 산출물(대조 시트 3장·매니페스트)은 이번 실행의 id 집합만 담는다. 따라서 이미
    등록된 종을 빼고 실행하면 납품 기록이 조용히 줄어든다. 그것을 실패로 만들어 드러낸다.
    """
    path = repo_root / REL_MANIFEST
    if not path.is_file():
        return []
    try:
        rows = list(csv.DictReader(io.StringIO(path.read_text(encoding="utf-8"))))
    except (OSError, UnicodeDecodeError, csv.Error):
        return [f"{REL_MANIFEST.as_posix()}: 읽을 수 없어 축소 여부를 확인할 수 없습니다"]
    dropped = sorted({r.get("id", "") for r in rows} - set(ids) - {""})
    if not dropped:
        return []
    return [
        f"{REL_MANIFEST.as_posix()}: 이미 등록된 종 {', '.join(dropped)}이(가) 이번 실행에 "
        f"없습니다 — 부분집합 실행이 납품 기록과 집계 시트를 축소합니다. "
        f"해당 종을 --ids에 포함하거나 --all로 실행하세요"
    ]


def run(repo_root: Path, ids: list[str], *, check_only: bool, make_previews: bool) -> Outcome:
    out = Outcome()

    # 1) 계획 — 입력 검증과 렌더링. 실패하면 기록 단계에 가지 않는다.
    plan, missing = build_plan(repo_root, ids, make_previews=make_previews)
    if plan is None:
        out.missing = missing
        out.wrote_nothing = True
        return out
    out.warnings = plan.warnings
    out.manifest = plan.manifest
    out.patched_ids = plan.patched_ids

    # 2) 보존 검증 — 이번 실행이 덮어쓸 경로만 제외하고 저장소 자산을 확인한다.
    out.problems = verify_repository_assets(repo_root, skip=set(plan.outputs))
    out.problems += _manifest_shrink_problems(repo_root, ids)
    if out.problems:
        out.wrote_nothing = True
        return out

    # 3) 기록 (또는 검사). 바이트가 같으면 다시 쓰지 않는다.
    for rel, data in plan.outputs.items():
        path = repo_root / rel
        if check_only:
            if not path.is_file():
                out.missing.append(rel)
            elif path.read_bytes() != data:
                out.mismatched.append(rel)
            else:
                out.unchanged.append(rel)
            continue
        path.parent.mkdir(parents=True, exist_ok=True)
        if path.is_file() and path.read_bytes() == data:
            out.unchanged.append(rel)
            continue
        path.write_bytes(data)
        out.written.append(rel)

    out.wrote_nothing = check_only or not out.written

    # 4) 기록 후 전수 확인 — 이제 제외할 경로가 없다.
    if not check_only:
        out.problems = verify_repository_assets(repo_root)

    return out


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(
        prog="minion_art.py",
        description="Digit Dual v0.4.3 하수인 말판 아이콘·전투 보정 익스포터 / 검증기",
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true",
                       help="로스터 20종 전량. 소스가 하나라도 없으면 실패한다 (납품 게이트)")
    group.add_argument("--ids", help="쉼표로 구분한 종 id 부분집합. 요청한 종의 소스가 "
                                     "없으면 건너뛰지 않고 실패한다")
    parser.add_argument("--check", action="store_true",
                        help="기존 산출물을 덮어쓰지 않고 일치 여부만 검사한다")
    parser.add_argument("--no-preview", action="store_true", help="미리보기 시트를 만들지 않는다")
    parser.add_argument("--repo-root", default=None, help="저장소 루트 (기본: 이 파일의 상위 디렉터리)")
    args = parser.parse_args(argv)

    repo_root = Path(args.repo_root).resolve() if args.repo_root else Path(__file__).resolve().parents[2]

    if args.all:
        ids = list(ROSTER_IDS)
    else:
        ids = [s.strip() for s in args.ids.split(",") if s.strip()]
        if not ids:
            print("오류: --ids에 종 id가 없습니다", file=sys.stderr)
            return 2
        try:
            ids = [safe_minion_id(i, where="--ids") for i in ids]
        except ArtError as exc:
            print(f"오류: {exc}", file=sys.stderr)
            return 2
        seen: set[str] = set()
        ids = [i for i in ids if not (i in seen or seen.add(i))]

    try:
        out = run(repo_root, ids, check_only=args.check,
                  make_previews=not args.no_preview)
    except ArtError as exc:
        # 데이터·규격 위반은 계획 단계에서 잡힌다 — 이 시점까지 파일은 하나도 쓰이지 않았다.
        print(f"오류: {exc}", file=sys.stderr)
        print("기록하지 않았습니다 — 자산·매니페스트·미리보기는 그대로입니다.", file=sys.stderr)
        return 1

    mode = "검사" if args.check else "생성"
    print(f"[minion_art] 모드={mode} 대상={len(ids)}종 루트={repo_root}")
    for key in out.written:
        print(f"  WRITE     {key}")
    for key in out.unchanged:
        print(f"  UNCHANGED {key}")
    for key in out.mismatched:
        print(f"  MISMATCH  {key}")
    for key in out.missing:
        print(f"  MISSING   {key}")
    for problem in out.problems:
        print(f"  PRESERVE  {problem}")
    for warn in out.warnings:
        print(f"  WARN      {warn}")
    if out.failed and out.wrote_nothing:
        print("  NOTE      검증 실패 — 이번 실행은 파일을 하나도 쓰지 않았습니다")
    print(f"[minion_art] write={len(out.written)} unchanged={len(out.unchanged)} "
          f"mismatch={len(out.mismatched)} missing={len(out.missing)} "
          f"preserve={len(out.problems)} warn={len(out.warnings)}")
    return 1 if out.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
