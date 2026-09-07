#!/usr/bin/env python3
"""tools/minion_art.py 회귀 테스트.

실행:  python -m unittest discover -s tests -v
       python tests/test_minion_art.py

원칙
- 저장소 안에 픽스처 파일을 남기지 않는다. 잘못된 입력 검사는 전부 임시 디렉터리에서 한다.
- 실제 저장소를 건드리는 테스트는 읽기 전용(--check / git blob 읽기)만 사용한다.
"""

from __future__ import annotations

import inspect
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "tools"))

from PIL import Image  # noqa: E402

import minion_art as ma  # noqa: E402


PALETTE_SYMBOLS = "abcdefgh"
PALETTE_COLORS = [
    "#1a1020", "#4a2b3c", "#8c3f2e", "#d2673a",
    "#f2a154", "#f7dba7", "#2f6f8f", "#e8f1f5",
]


def make_rows(x0: int = 12, x1: int = 19, y0: int = 10, y1: int = 29,
              symbols: str = PALETTE_SYMBOLS) -> list[str]:
    """규격을 만족하는 합성 아트 격자. 기본값은 중심 x=15.5 · 접지선 y=29."""
    rows = []
    for y in range(ma.ICON_SIZE):
        row = []
        for x in range(ma.ICON_SIZE):
            if x0 <= x <= x1 and y0 <= y <= y1:
                row.append(symbols[(x + y) % len(symbols)])
            else:
                row.append(ma.TRANSPARENT_SYMBOL)
        rows.append("".join(row))
    return rows


def make_source(minion_id: str = "fire_std", **overrides) -> dict:
    data = {
        "id": minion_id,
        "width": ma.ICON_SIZE,
        "height": ma.ICON_SIZE,
        "palette": dict(zip(PALETTE_SYMBOLS, PALETTE_COLORS)),
        "pixels": make_rows(),
        "notes": "합성 테스트 데이터 — 실제 아트가 아님 · 한글 노트 포함",
    }
    data.update(overrides)
    return data


def make_patch(minion_id: str = "fire_sustain", **overrides) -> dict:
    data = {
        "id": minion_id,
        "baseline": ma.BATTLE_BASELINE_COMMIT,
        "pixels": [[30, 30, "#ff8800"], [31, 30, "#ffcc44"], [30, 31, "#00000000"]],
        "notes": "합성 패치 — 손끝 불꽃 보강 예시",
    }
    data.update(overrides)
    return data


class TempRepo:
    """tools가 기대하는 최소 디렉터리 골격을 임시 폴더에 만든다."""

    def __init__(self) -> None:
        self._tmp = tempfile.TemporaryDirectory(prefix="minion_art_test_")
        self.root = Path(self._tmp.name)
        (self.root / ma.REL_PIXEL_SOURCES).mkdir(parents=True)
        (self.root / ma.REL_BATTLE_PATCHES).mkdir(parents=True)

    def write_source(self, data: dict, name: str | None = None) -> Path:
        path = self.root / ma.REL_PIXEL_SOURCES / f"{name or data['id']}.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path

    def write_patch(self, data: dict, name: str | None = None) -> Path:
        path = self.root / ma.REL_BATTLE_PATCHES / f"{name or data['id']}.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path

    def close(self) -> None:
        self._tmp.cleanup()


class TempRepoTestCase(unittest.TestCase):
    def setUp(self) -> None:
        self.repo = TempRepo()
        self.addCleanup(self.repo.close)

    def assert_rejects(self, data: dict, needle: str, *, name: str | None = None) -> None:
        path = self.repo.write_source(data, name=name)
        with self.assertRaises(ma.ArtError) as ctx:
            ma.load_icon_source(path, expected_id=name or data.get("id"))
        self.assertIn(needle, str(ctx.exception))


# --------------------------------------------------------------------------
# 아이콘 소스 — 정상 경로와 왕복
# --------------------------------------------------------------------------

class IconRoundTripTest(TempRepoTestCase):
    def test_render_matches_source_grid_after_png_roundtrip(self):
        data = make_source()
        path = self.repo.write_source(data)
        src = ma.load_icon_source(path, expected_id="fire_std")
        img = ma.render_icon(src)

        out = self.repo.root / "icon.png"
        out.write_bytes(ma.png_bytes(img))
        decoded = Image.open(out)
        decoded.load()

        self.assertEqual(decoded.size, (32, 32))
        self.assertEqual(decoded.mode, "RGBA")
        px = decoded.convert("RGBA").load()
        for y, row in enumerate(data["pixels"]):
            for x, symbol in enumerate(row):
                expected = src.palette[symbol]
                self.assertEqual(px[x, y], expected, f"({x},{y}) 기호 {symbol!r}")

    def test_alpha_is_binary_and_margins_transparent(self):
        src = ma.load_icon_source(self.repo.write_source(make_source()))
        img = ma.render_icon(src)
        alphas = set(img.tobytes()[3::4])
        self.assertTrue(alphas <= {0, 255}, f"중간 알파 발견: {alphas}")
        px = img.load()
        edge = list(range(ma.ICON_MARGIN)) + list(range(32 - ma.ICON_MARGIN, 32))
        for i in edge:
            for j in range(32):
                self.assertEqual(px[j, i][3], 0)
                self.assertEqual(px[i, j][3], 0)

    def test_geometry_metrics_recorded(self):
        src = ma.load_icon_source(self.repo.write_source(make_source()))
        self.assertEqual(src.bbox, (12, 10, 19, 29))
        self.assertEqual(src.used_colors, 8)
        self.assertEqual(src.warnings, [])
        self.assertIn("한글", src.notes)

    def test_png_encoding_is_deterministic(self):
        src = ma.load_icon_source(self.repo.write_source(make_source()))
        img = ma.render_icon(src)
        self.assertEqual(ma.png_bytes(img), ma.png_bytes(ma.render_icon(src)))
        self.assertEqual(ma.png_bytes(img), ma.png_bytes(img))

    def test_sixteen_colors_pass_with_recommendation_warning(self):
        symbols = "abcdefghijklmnop"
        palette = {s: f"#{i * 15:02x}20{i * 13:02x}" for i, s in enumerate(symbols)}
        data = make_source(palette=palette, pixels=make_rows(symbols=symbols))
        src = ma.load_icon_source(self.repo.write_source(data))
        self.assertEqual(src.used_colors, 16)
        self.assertTrue(any("권장" in w for w in src.warnings))


# --------------------------------------------------------------------------
# 아이콘 소스 — 거부되어야 하는 입력
# --------------------------------------------------------------------------

class IconRejectionTest(TempRepoTestCase):
    def test_row_count_mismatch(self):
        self.assert_rejects(make_source(pixels=make_rows()[:31]), "정확히 32개의 문자열")

    def test_row_length_mismatch(self):
        rows = make_rows()
        rows[15] = rows[15][:31]
        self.assert_rejects(make_source(pixels=rows), "길이 31")

    def test_unknown_symbol(self):
        rows = make_rows()
        rows[20] = rows[20][:15] + "Z" + rows[20][16:]
        self.assert_rejects(make_source(pixels=rows), "팔레트에 없습니다")

    def test_intermediate_alpha_in_palette(self):
        palette = dict(zip(PALETTE_SYMBOLS, PALETTE_COLORS))
        palette["a"] = "#1a102080"
        self.assert_rejects(make_source(palette=palette), "중간 알파")

    def test_non_dot_symbol_may_not_be_transparent(self):
        palette = dict(zip(PALETTE_SYMBOLS, PALETTE_COLORS))
        palette["a"] = "#00000000"
        self.assert_rejects(make_source(palette=palette), "투명색을 쓸 수 없습니다")

    def test_dot_symbol_may_not_be_redefined(self):
        palette = dict(zip(PALETTE_SYMBOLS, PALETTE_COLORS))
        palette["."] = "#ff0000"
        self.assert_rejects(make_source(palette=palette), "'.' 기호는")

    def test_palette_over_sixteen_colors(self):
        symbols = "abcdefghijklmnopq"  # 17
        palette = {s: f"#{i * 14:02x}30{i * 11:02x}" for i, s in enumerate(symbols)}
        data = make_source(palette=palette, pixels=make_rows(symbols=symbols))
        self.assert_rejects(data, "최대 16색")

    def test_multi_character_palette_symbol(self):
        palette = dict(zip(PALETTE_SYMBOLS, PALETTE_COLORS))
        palette["ab"] = "#112233"
        self.assert_rejects(make_source(palette=palette), "ASCII 한 글자")

    def test_art_outside_two_pixel_margin_row(self):
        rows = make_rows()
        rows[1] = rows[1][:15] + "a" + rows[1][16:]
        self.assert_rejects(make_source(pixels=rows), "행 1는 전부 투명")

    def test_art_outside_two_pixel_margin_column(self):
        rows = make_rows(x0=1, x1=30, y0=10, y1=29)
        self.assert_rejects(make_source(pixels=rows), "열 1는 전부 투명")

    def test_ground_line_violation(self):
        self.assert_rejects(make_source(pixels=make_rows(y0=8, y1=27)), "접지선 위반")

    def test_optical_center_violation(self):
        self.assert_rejects(make_source(pixels=make_rows(x0=18, x1=25)), "대리 지표 위반")

    def test_optical_center_tolerance_accepts_small_offset(self):
        src = ma.load_icon_source(self.repo.write_source(make_source(pixels=make_rows(x0=13, x1=20))))
        self.assertEqual(src.bbox[0], 13)

    def test_empty_artwork(self):
        rows = [ma.TRANSPARENT_SYMBOL * 32] * 32
        self.assert_rejects(make_source(pixels=rows), "불투명 픽셀이 하나도 없습니다")

    def test_wrong_canvas_size(self):
        self.assert_rejects(make_source(width=64), "width/height는 32")

    def test_id_must_match_filename(self):
        self.assert_rejects(make_source("fire_std"), "본문 id", name="water_std")

    def test_unsafe_id_is_rejected(self):
        for bad in ("../evil", "fire/std", "fire_std ", "FIRE_STD", "fire_std.png"):
            with self.subTest(bad=bad):
                with self.assertRaises(ma.ArtError):
                    ma.safe_minion_id(bad, where="test")

    def test_unknown_roster_id_is_rejected(self):
        with self.assertRaises(ma.ArtError) as ctx:
            ma.safe_minion_id("plasma_std", where="test")
        self.assertIn("로스터에 없는 id", str(ctx.exception))

    def test_missing_source_file(self):
        with self.assertRaises(ma.ArtError) as ctx:
            ma.load_icon_source(self.repo.root / ma.REL_PIXEL_SOURCES / "fire_std.json")
        self.assertIn("소스 파일이 없습니다", str(ctx.exception))

    def test_malformed_json(self):
        path = self.repo.root / ma.REL_PIXEL_SOURCES / "fire_std.json"
        path.write_text("{not json", encoding="utf-8")
        with self.assertRaises(ma.ArtError) as ctx:
            ma.load_icon_source(path)
        self.assertIn("JSON 파싱 실패", str(ctx.exception))


# --------------------------------------------------------------------------
# 전투 보정 패치
# --------------------------------------------------------------------------

def synthetic_grid() -> Image.Image:
    """가장자리가 투명한 합성 64 그리드 (기준 원본 대역)."""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    px = img.load()
    for y in range(8, 56):
        for x in range(8, 56):
            px[x, y] = (60 + x, 40 + y, 90, 255)
    return img


class BattlePatchTest(TempRepoTestCase):
    def load(self, data: dict, name: str | None = None) -> ma.BattlePatch:
        path = self.repo.write_patch(data, name=name)
        return ma.load_battle_patch(path, expected_id=name or data.get("id"))

    def assert_rejects(self, data: dict, needle: str, *, name: str | None = None) -> None:
        with self.assertRaises(ma.ArtError) as ctx:
            self.load(data, name=name)
        self.assertIn(needle, str(ctx.exception))

    def test_valid_patch_applies_only_listed_coordinates(self):
        patch = self.load(make_patch())
        grid = synthetic_grid()
        patched, changed = ma.apply_battle_patch(grid, patch)
        self.assertEqual(changed, 3)
        after = patched.load()
        self.assertEqual(after[30, 30], (255, 136, 0, 255))
        self.assertEqual(after[31, 30], (255, 204, 68, 255))
        self.assertEqual(after[30, 31], (0, 0, 0, 0))

        before = grid.load()
        touched = {(30, 30), (31, 30), (30, 31)}
        for y in range(64):
            for x in range(64):
                if (x, y) not in touched:
                    self.assertEqual(before[x, y], after[x, y], f"({x},{y}) 비대상 픽셀 변경됨")

    def test_original_grid_is_not_mutated(self):
        patch = self.load(make_patch())
        grid = synthetic_grid()
        snapshot = grid.tobytes()
        ma.apply_battle_patch(grid, patch)
        self.assertEqual(grid.tobytes(), snapshot)

    def test_battle_file_is_exact_nearest_two_times(self):
        patch = self.load(make_patch())
        patched, _ = ma.apply_battle_patch(synthetic_grid(), patch)
        battle = ma.nearest_2x(patched)
        self.assertEqual(battle.size, (128, 128))
        src, dst = patched.load(), battle.load()
        for y in range(64):
            for x in range(64):
                for dy in (0, 1):
                    for dx in (0, 1):
                        self.assertEqual(dst[x * 2 + dx, y * 2 + dy], src[x, y])

    def test_duplicate_coordinates_rejected(self):
        data = make_patch(pixels=[[10, 10, "#ffffff"], [10, 10, "#000000"]])
        self.assert_rejects(data, "중복됩니다")

    def test_out_of_range_coordinate_rejected(self):
        self.assert_rejects(make_patch(pixels=[[64, 10, "#ffffff"]]), "범위를 벗어납니다")
        self.assert_rejects(make_patch(pixels=[[10, -1, "#ffffff"]]), "범위를 벗어납니다")

    def test_non_integer_coordinate_rejected(self):
        self.assert_rejects(make_patch(pixels=[[10.5, 10, "#ffffff"]]), "정수여야 합니다")
        self.assert_rejects(make_patch(pixels=[[True, 10, "#ffffff"]]), "정수여야 합니다")

    def test_intermediate_alpha_rejected(self):
        self.assert_rejects(make_patch(pixels=[[10, 10, "#ffffff7f"]]), "중간 알파")

    def test_bad_hex_rejected(self):
        self.assert_rejects(make_patch(pixels=[[10, 10, "ffffff"]]), "형식이어야 합니다")
        self.assert_rejects(make_patch(pixels=[[10, 10, "#fff"]]), "형식이어야 합니다")

    def test_malformed_entry_rejected(self):
        self.assert_rejects(make_patch(pixels=[[10, 10]]), "3원소 배열")

    def test_empty_patch_rejected(self):
        self.assert_rejects(make_patch(pixels=[]), "비어 있지 않은 배열")

    def test_non_allowlisted_id_rejected(self):
        self.assert_rejects(make_patch("fire_std"), "허용 목록에 없습니다")

    def test_baseline_mismatch_rejected(self):
        self.assert_rejects(make_patch(baseline="0" * 40), "고정 기준")

    def test_patch_touching_canvas_edge_rejected(self):
        patch = self.load(make_patch(pixels=[[0, 32, "#ffffff"]]))
        with self.assertRaises(ma.ArtError) as ctx:
            ma.apply_battle_patch(synthetic_grid(), patch)
        self.assertIn("캔버스 경계", str(ctx.exception))

    def test_allowlist_matches_saturn_revise_set(self):
        self.assertEqual(
            ma.BATTLE_PATCH_ALLOWLIST,
            frozenset({"fire_sustain", "water_swift", "grass_atk", "lightning_atk"}),
        )


# --------------------------------------------------------------------------
# 실행 드라이버 — 계획 → 보존 검증 → 기록
#
# 드라이버는 고정 기준 커밋의 git 객체를 읽어야 하므로, 임시 폴더에 실제 저장소를 복제해
# 그 안에서만 검사한다. 원본 저장소에는 읽기 접근만 한다(clone).
# --------------------------------------------------------------------------

def _git_available() -> bool:
    if shutil.which("git") is None:
        return False
    proc = subprocess.run(["git", "-C", str(REPO_ROOT), "cat-file", "-t",
                           ma.BATTLE_BASELINE_COMMIT], capture_output=True)
    return proc.returncode == 0 and proc.stdout.strip() == b"commit"


PILOT_IDS = sorted(ma.BATTLE_PATCH_ALLOWLIST)


@unittest.skipUnless(_git_available(), "기준 커밋을 읽을 수 있는 git 저장소가 아님")
class DriverTest(unittest.TestCase):
    """복제본 저장소 위에서 계획·보존·기록 순서를 검사한다."""

    @classmethod
    def setUpClass(cls) -> None:
        cls._tmp = tempfile.TemporaryDirectory(prefix="minion_art_clone_")
        cls.root = Path(cls._tmp.name) / "repo"
        subprocess.run(
            ["git", "clone", "--quiet", "--local", "--no-hardlinks",
             str(REPO_ROOT), str(cls.root)],
            check=True, capture_output=True)
        # 복제본 작업 트리를 기준 커밋 상태로 되돌리기 위한 원본 바이트 (읽기 전용)
        cls._baseline: dict[str, bytes] = {}
        for minion_id in ma.BATTLE_PATCH_ALLOWLIST:
            for name in ("battle-grid.png", "battle.png"):
                rel = f"{ma.REL_ASSETS.as_posix()}/{minion_id}/{name}"
                cls._baseline[rel] = ma.git_blob(cls.root, ma.BATTLE_BASELINE_COMMIT, rel)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._tmp.cleanup()

    def setUp(self) -> None:
        for rel in (ma.REL_PIXEL_SOURCES, ma.REL_BATTLE_PATCHES, ma.REL_REVIEW):
            shutil.rmtree(self.root / rel, ignore_errors=True)
            (self.root / rel).mkdir(parents=True, exist_ok=True)
        (self.root / ma.REL_MANIFEST).unlink(missing_ok=True)
        for minion_id in ma.ROSTER_IDS:
            (self.root / ma.REL_ASSETS / minion_id / "icon.png").unlink(missing_ok=True)
        for rel, data in self._baseline.items():
            (self.root / rel).write_bytes(data)

    # --- 픽스처 ---------------------------------------------------------

    def write_source(self, data: dict, name: str | None = None) -> Path:
        path = self.root / ma.REL_PIXEL_SOURCES / f"{name or data['id']}.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path

    def write_patch(self, data: dict, name: str | None = None) -> Path:
        path = self.root / ma.REL_BATTLE_PATCHES / f"{name or data['id']}.json"
        path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        return path

    def seed_pilot(self, ids=PILOT_IDS) -> None:
        """허용 목록 종에 유효한 아이콘 소스와 최소 패치를 심는다."""
        for i, minion_id in enumerate(ids):
            self.write_source(make_source(minion_id, pixels=make_rows(x0=12 + (i % 2),
                                                                      x1=19 + (i % 2))))
            self.write_patch(make_patch(minion_id, pixels=[[30, 30 + i, "#ff8800"]]))

    def snapshot(self) -> dict[str, tuple[int, bytes]]:
        """저장소 안 모든 산출물 후보의 (mtime_ns, 바이트) 지문."""
        out: dict[str, tuple[int, bytes]] = {}
        for rel in (ma.REL_ASSETS, ma.REL_REVIEW):
            for path in sorted((self.root / rel).rglob("*")):
                if path.is_file():
                    out[str(path)] = (path.stat().st_mtime_ns, path.read_bytes())
        manifest = self.root / ma.REL_MANIFEST
        if manifest.is_file():
            out[str(manifest)] = (manifest.stat().st_mtime_ns, manifest.read_bytes())
        return out

    # --- 정상 경로 ------------------------------------------------------

    def test_export_then_rerun_is_idempotent(self):
        self.seed_pilot()
        first = ma.run(self.root, PILOT_IDS, check_only=False, make_previews=True)
        self.assertFalse(first.failed, first.problems + first.missing)
        self.assertIn("demo/assets/minions/fire_sustain/icon.png", first.written)
        self.assertIn("docs/art/minions-v0.4.3/review/icons-contact-sheet.png", first.written)
        self.assertIn("docs/art/minions-v0.4.3/delivery-manifest.csv", first.written)
        self.assertEqual(first.problems, [])

        second = ma.run(self.root, PILOT_IDS, check_only=False, make_previews=True)
        self.assertEqual(second.written, [])
        self.assertFalse(second.failed)

    def test_check_reports_mismatch_without_rewriting(self):
        self.seed_pilot()
        ma.run(self.root, PILOT_IDS, check_only=False, make_previews=False)
        icon = self.root / ma.REL_ASSETS / "fire_sustain" / "icon.png"
        corrupted = b"corrupted-on-purpose"
        icon.write_bytes(corrupted)

        out = ma.run(self.root, PILOT_IDS, check_only=True, make_previews=False)
        self.assertIn("demo/assets/minions/fire_sustain/icon.png", out.mismatched)
        self.assertTrue(out.failed)
        self.assertEqual(icon.read_bytes(), corrupted, "--check가 파일을 덮어썼다")

    def test_check_reports_missing_output(self):
        self.seed_pilot()
        out = ma.run(self.root, PILOT_IDS, check_only=True, make_previews=False)
        self.assertIn("demo/assets/minions/fire_sustain/icon.png", out.missing)
        self.assertTrue(out.failed)
        self.assertFalse((self.root / ma.REL_ASSETS / "fire_sustain" / "icon.png").exists())

    def test_only_expected_asset_files_are_written(self):
        self.seed_pilot()
        ma.run(self.root, PILOT_IDS, check_only=False, make_previews=False)
        produced = sorted(p.name for p in (self.root / ma.REL_ASSETS / "fire_sustain").iterdir())
        self.assertEqual(produced,
                         ["battle-grid.png", "battle.png", "icon.png",
                          "portrait.png", "portrait.webp"])

    def test_manifest_columns_and_sorting(self):
        self.seed_pilot()
        ma.run(self.root, PILOT_IDS, check_only=False, make_previews=False)
        lines = (self.root / ma.REL_MANIFEST).read_text(encoding="utf-8").strip().splitlines()
        self.assertEqual(lines[0], "kind,id,path,bytes,sha256,detail")
        paths = [line.split(",")[2] for line in lines[1:]]
        self.assertEqual(paths, sorted(paths))
        self.assertEqual(len(paths), len(PILOT_IDS) * 3)  # icon + battle-grid + battle

    # --- 입력 누락은 성공을 주장하지 않는다 (T4) --------------------------

    def test_explicitly_requested_missing_icon_source_fails(self):
        out = ma.run(self.root, ["grass_def"], check_only=False, make_previews=False)
        self.assertTrue(out.failed, "요청한 소스가 없는데 성공을 주장했다")
        self.assertIn("docs/art/minions-v0.4.3/pixel-sources/grass_def.json", out.missing)
        self.assertTrue(out.wrote_nothing)
        self.assertFalse((self.root / ma.REL_ASSETS / "grass_def" / "icon.png").exists())

    def test_allowlisted_id_requires_its_patch(self):
        self.write_source(make_source("fire_sustain"))
        out = ma.run(self.root, ["fire_sustain"], check_only=False, make_previews=False)
        self.assertIn("docs/art/minions-v0.4.3/battle-patches/fire_sustain.json", out.missing)
        self.assertTrue(out.failed)
        self.assertTrue(out.wrote_nothing)

    def test_all_requires_every_source_and_patch(self):
        self.seed_pilot()
        out = ma.run(self.root, list(ma.ROSTER_IDS), check_only=False, make_previews=False)
        self.assertTrue(out.failed)
        self.assertIn("docs/art/minions-v0.4.3/pixel-sources/water_std.json", out.missing)
        self.assertEqual(len(out.missing), len(ma.ROSTER_IDS) - len(PILOT_IDS))
        self.assertTrue(out.wrote_nothing)

    # --- 원자성: 실패하면 한 개도 쓰지 않는다 (T4) ------------------------

    def test_invalid_later_source_writes_nothing_at_all(self):
        """두 번째 종의 데이터가 규격 위반이면 첫 종의 아이콘도 쓰이지 않아야 한다."""
        self.seed_pilot()
        broken = make_source("grass_atk", pixels=make_rows(y0=8, y1=27))  # 접지선 위반
        self.write_source(broken)
        before = self.snapshot()

        with self.assertRaises(ma.ArtError) as ctx:
            ma.run(self.root, PILOT_IDS, check_only=False, make_previews=True)
        self.assertIn("접지선 위반", str(ctx.exception))

        self.assertEqual(self.snapshot(), before, "검증 실패에도 파일이 바뀌었다")
        self.assertFalse((self.root / ma.REL_ASSETS / "fire_sustain" / "icon.png").exists())
        self.assertFalse((self.root / ma.REL_MANIFEST).exists())
        self.assertFalse(any((self.root / ma.REL_REVIEW).iterdir()))

    def test_missing_later_input_writes_nothing_at_all(self):
        """--all의 소스 16종 누락이 이미 준비된 4종을 부분 기록하지 않는다."""
        self.seed_pilot()
        before = self.snapshot()
        out = ma.run(self.root, list(ma.ROSTER_IDS), check_only=False, make_previews=True)
        self.assertTrue(out.failed)
        self.assertEqual(self.snapshot(), before, "누락 보고와 함께 파일이 쓰였다")

    def test_preservation_failure_blocks_all_writes(self):
        """파이프라인 밖에서 손상된 원본이 있으면 아무것도 쓰지 않는다."""
        self.seed_pilot()
        victim = self.root / ma.REL_ASSETS / "water_std" / "portrait.png"
        original = victim.read_bytes()
        self.addCleanup(victim.write_bytes, original)
        victim.write_bytes(b"tampered")
        before = self.snapshot()

        out = ma.run(self.root, PILOT_IDS, check_only=False, make_previews=True)
        self.assertTrue(out.failed)
        self.assertTrue(any("water_std/portrait.png" in p for p in out.problems))
        self.assertTrue(out.wrote_nothing)
        self.assertEqual(self.snapshot(), before, "보존 위반에도 파일이 쓰였다")

    # --- T3: 부분집합 실행과 이미 보정된 다른 종 --------------------------

    def test_subset_run_does_not_flag_other_patched_battles(self):
        """이미 합법적으로 보정된 다른 허용 종이 '원본 위반'으로 오판되지 않는다."""
        self.seed_pilot()
        ma.run(self.root, PILOT_IDS, check_only=False, make_previews=False)
        problems = ma.verify_repository_assets(self.root)
        self.assertEqual(problems, [], "보정 결과가 원본 위반으로 잡혔다")

    def test_patched_battle_is_verified_not_exempted(self):
        """허용 종이라도 패치와 무관한 내용이면 위반으로 잡힌다 (면제가 아니라 검증)."""
        self.seed_pilot()
        ma.run(self.root, PILOT_IDS, check_only=False, make_previews=False)
        victim = self.root / ma.REL_ASSETS / "water_swift" / "battle-grid.png"
        rogue = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        rogue.load()[10, 10] = (1, 2, 3, 255)
        victim.write_bytes(ma.png_bytes(rogue))

        problems = ma.verify_repository_assets(self.root)
        self.assertTrue(any("water_swift/battle-grid.png" in p for p in problems),
                        "허용 목록이라는 이유로 검사를 건너뛰었다")

    def test_pristine_allowlisted_battle_without_patch_is_legal(self):
        """패치 데이터가 없으면 허용 종의 전투 파일도 기준 원본이어야 하고, 그 상태는 합법이다."""
        self.assertEqual(ma.verify_repository_assets(self.root), [])

    def test_expected_patched_battle_matches_written_output(self):
        self.seed_pilot()
        ma.run(self.root, PILOT_IDS, check_only=False, make_previews=False)
        for minion_id in PILOT_IDS:
            with self.subTest(minion_id=minion_id):
                grid_bytes, battle_bytes = ma.expected_patched_battle(self.root, minion_id)
                base = self.root / ma.REL_ASSETS / minion_id
                self.assertEqual((base / "battle-grid.png").read_bytes(), grid_bytes)
                self.assertEqual((base / "battle.png").read_bytes(), battle_bytes)

    # --- 부분집합이 납품 기록을 줄이지 못한다 ------------------------------

    def test_subset_run_refuses_to_shrink_manifest(self):
        self.seed_pilot()
        ma.run(self.root, PILOT_IDS, check_only=False, make_previews=True)
        before = self.snapshot()

        out = ma.run(self.root, ["fire_sustain"], check_only=False, make_previews=True)
        self.assertTrue(out.failed)
        self.assertTrue(any("delivery-manifest.csv" in p for p in out.problems))
        self.assertTrue(out.wrote_nothing)
        self.assertEqual(self.snapshot(), before, "부분집합 실행이 납품 기록을 줄였다")


# --------------------------------------------------------------------------
# 실제 저장소 — 읽기 전용 확인
# --------------------------------------------------------------------------

@unittest.skipUnless(_git_available(), "기준 커밋을 읽을 수 있는 git 저장소가 아님")
class RealRepoReadOnlyTest(unittest.TestCase):
    def test_baseline_grid_readable_for_every_allowlisted_id(self):
        for minion_id in PILOT_IDS:
            with self.subTest(minion_id=minion_id):
                grid = ma.read_baseline_grid(REPO_ROOT, minion_id)
                self.assertEqual(grid.size, (64, 64))
                self.assertEqual(grid.mode, "RGBA")
                self.assertTrue(set(grid.tobytes()[3::4]) <= {0, 255})

    def test_baseline_battle_is_nearest_two_times_of_grid(self):
        for minion_id in PILOT_IDS:
            with self.subTest(minion_id=minion_id):
                grid = ma.read_baseline_grid(REPO_ROOT, minion_id)
                raw = ma.git_blob(REPO_ROOT, ma.BATTLE_BASELINE_COMMIT,
                                  f"demo/assets/minions/{minion_id}/battle.png")
                battle = Image.open(io.BytesIO(raw))
                battle.load()
                self.assertEqual(battle.convert("RGBA").tobytes(),
                                 ma.nearest_2x(grid).tobytes())

    def test_repository_assets_are_all_legal_values(self):
        """portrait 40장은 기준 원본, 전투 파일은 원본이거나 승인된 보정 결과여야 한다."""
        self.assertEqual(ma.verify_repository_assets(REPO_ROOT), [])

    def test_unknown_id_blocks_baseline_read(self):
        with self.assertRaises(ma.ArtError):
            ma.read_baseline_grid(REPO_ROOT, ma.safe_minion_id("fire_std", where="t") + "x")


# --------------------------------------------------------------------------
# 라벨 정확성 — Saturn 지적 반영
# --------------------------------------------------------------------------

class LabellingTest(TempRepoTestCase):
    def test_silhouette_sheet_label_matches_actual_scale(self):
        """실루엣 시트는 32 -> 64, 즉 2배다. 헤더가 4배를 주장하면 안 된다."""
        src = ma.load_icon_source(self.repo.write_source(make_source()))
        icon = ma.render_icon(src)
        sheet = ma.build_silhouette_sheet([("fire_std", icon)])
        source = inspect.getsource(ma.build_silhouette_sheet)
        self.assertIn("2x", source)
        self.assertNotIn("4x", source)
        self.assertIn("(64, 64)", source, "32 -> 64 확대가 아니면 라벨을 다시 맞춰야 한다")
        self.assertGreater(sheet.width, 0)

    def test_contact_and_background_sheets_really_are_four_times(self):
        for fn in (ma.build_contact_sheet, ma.build_background_sheet):
            with self.subTest(fn=fn.__name__):
                source = inspect.getsource(fn)
                self.assertIn("4x", source)
                self.assertIn("(128, 128)", source)

    def test_bbox_midpoint_is_labelled_as_a_proxy(self):
        """외접상자 중점은 시각 중심 AC의 기하 대리 지표일 뿐이라고 코드가 말해야 한다."""
        self.assertTrue(hasattr(ma, "ICON_BBOX_MIDPOINT_X"))
        self.assertTrue(hasattr(ma, "ICON_BBOX_MIDPOINT_TOL"))
        self.assertFalse(hasattr(ma, "ICON_CENTER_X"), "시각 중심으로 오인되는 이름이 남아 있다")
        self.assertIn("대리 지표", inspect.getsource(ma._validate_icon_geometry))

    def test_center_violation_message_says_proxy(self):
        path = self.repo.write_source(make_source(pixels=make_rows(x0=18, x1=25)))
        with self.assertRaises(ma.ArtError) as ctx:
            ma.load_icon_source(path)
        message = str(ctx.exception)
        self.assertIn("대리 지표", message)
        self.assertIn("지각적 시각 중심 판정을 대체하지 않는다", message)

    def test_manifest_detail_marks_midpoint_as_proxy(self):
        src = ma.load_icon_source(self.repo.write_source(make_source()))
        self.assertEqual(src.bbox_midpoint_x, 15.5)
        self.assertIn("(proxy)", inspect.getsource(ma.build_plan))


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

@unittest.skipUnless(_git_available(), "기준 커밋을 읽을 수 있는 git 저장소가 아님")
class CliTest(unittest.TestCase):
    def cli(self, *args: str) -> subprocess.CompletedProcess:
        return subprocess.run(
            [sys.executable, str(REPO_ROOT / "tools" / "minion_art.py"), *args],
            capture_output=True, cwd=str(REPO_ROOT))

    def test_cli_check_mode_prints_utf8_without_writing(self):
        before = {
            p: p.stat().st_mtime_ns
            for p in (REPO_ROOT / ma.REL_ASSETS).rglob("*") if p.is_file()
        }
        proc = self.cli("--ids", ",".join(PILOT_IDS), "--check")
        # Windows cp949 콘솔에서도 한글이 깨지지 않아야 한다 — 여기서 UnicodeDecodeError가
        # 나거나 exit 2(인자 오류)가 나면 실패다. exit 1은 Earth 데이터가 산출물보다 새로울 때
        # 정상적으로 나올 수 있으므로 통과 조건에서 제외하지 않는다.
        self.assertIn(proc.returncode, (0, 1), proc.stderr.decode("utf-8", "replace"))
        text = proc.stdout.decode("utf-8")
        self.assertIn("모드=검사", text)
        self.assertIn("[minion_art]", text)
        self.assertIn("루트=", text)
        after = {
            p: p.stat().st_mtime_ns
            for p in (REPO_ROOT / ma.REL_ASSETS).rglob("*") if p.is_file()
        }
        self.assertEqual(after, before, "--check가 자산을 건드렸다")

    def test_cli_rejects_unsafe_id_argument(self):
        proc = self.cli("--ids", "../../etc/passwd", "--check")
        self.assertEqual(proc.returncode, 2)
        self.assertIn("안전하지 않은 id", proc.stderr.decode("utf-8"))

    def test_cli_requires_a_selector(self):
        proc = self.cli()
        self.assertEqual(proc.returncode, 2)

    def test_cli_all_gate_fails_until_every_source_lands(self):
        proc = self.cli("--all", "--check")
        text = proc.stdout.decode("utf-8")
        if proc.returncode == 0:
            self.assertNotIn("MISSING", text)  # 20종이 모두 도착한 뒤에는 통과해야 한다
        else:
            self.assertIn("MISSING", text)
            self.assertIn("파일을 하나도 쓰지 않았습니다", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
