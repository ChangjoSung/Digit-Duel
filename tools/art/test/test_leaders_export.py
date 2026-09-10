#!/usr/bin/env python3
"""tools/art/leaders_export.py 회귀 (#124).

무엇을 고정하는가:
  1. 축소 외의 편집이 없다 — 산출 픽셀이 원본을 LANCZOS 로 줄인 것과 **바이트까지** 같다.
  2. 알파가 보존된다 — 투명 모서리가 산출에서도 투명하다 (매트가 생기지 않는다).
  3. 결정성 — 같은 입력으로 두 번 구우면 같은 바이트다.
  4. `--check` 는 **어떤 경로에도 쓰지 않는다** (없는 산출물, 어긋난 산출물, 정상 산출물 세 경우 모두).
  5. 원본은 읽기만 한다 — 실행 뒤 원본 바이트가 그대로다.
  6. 경로 규약이 제품 코드가 기대하는 이름과 같다 (icon64.png · battle256.png · leaders-manifest.json).

픽스처는 전부 임시 디렉터리에 만든다 — 저장소에 쓰지 않는다.
"""

from __future__ import annotations

import hashlib
import io
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import leaders_export as LE  # noqa: E402


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def make_source(path: Path, size: int = LE.EXPECTED_SOURCE_SIZE) -> None:
    """투명 배경 + 불투명 도형이 있는 합성 원본. 실제 Earth 원본을 복사하지 않는다."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = im.load()
    r = size // 3
    cx = cy = size // 2
    for y in range(cy - r, cy + r):
        for x in range(cx - r, cx + r):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                px[x, y] = ((x * 7) % 256, (y * 5) % 256, 200, 253)
    path.parent.mkdir(parents=True, exist_ok=True)
    im.save(path, format="PNG", optimize=True)


class LeadersExportTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(tempfile.mkdtemp(prefix="leadersexp-"))
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        self.srcs = {}
        for name, f in LE.LEADERS.items():
            p = self.tmp / LE.REL_SOURCE_DIR / f
            make_source(p)
            self.srcs[name] = p

    # 1·2 ------------------------------------------------------------------
    def test_downscale_only_and_alpha_preserved(self) -> None:
        rows, problems = LE.build(self.tmp)
        self.assertEqual([p for p in problems if not p.startswith("[경고]")], [])
        self.assertEqual(len(rows), len(LE.LEADERS) * len(LE.OUTPUTS))
        for r in rows:
            with Image.open(self.tmp / LE.REL_SOURCE_DIR / Path(r["source"]).name) as src:
                src.load()
                expect = LE.render_png(src, r["size"])
            self.assertEqual(sha(r["_data"]), sha(expect), f"{r['path']} 는 순수 축소 결과와 같아야 한다")
            with Image.open(io.BytesIO(r["_data"])) as out:
                out.load()
                self.assertEqual(out.mode, "RGBA")
                self.assertEqual(out.size, (r["size"], r["size"]))
                self.assertEqual(out.getpixel((0, 0))[3], 0, "모서리 알파가 0 이어야 한다 (매트 없음)")
                self.assertGreater(max(out.getchannel("A").getextrema()), 200, "본체 픽셀은 불투명해야 한다")

    # 3 --------------------------------------------------------------------
    def test_deterministic(self) -> None:
        a, _ = LE.build(self.tmp)
        b, _ = LE.build(self.tmp)
        self.assertEqual([r["sha256"] for r in a], [r["sha256"] for r in b])

    # 6 --------------------------------------------------------------------
    def test_path_contract(self) -> None:
        rows, _ = LE.build(self.tmp)
        paths = sorted(r["path"] for r in rows)
        self.assertEqual(paths, [
            "demo/assets/leaders/companion/battle256.png",
            "demo/assets/leaders/companion/icon64.png",
            "demo/assets/leaders/king/battle256.png",
            "demo/assets/leaders/king/icon64.png",
        ])
        self.assertEqual(LE.REL_MANIFEST.as_posix(), "demo/assets/leaders/leaders-manifest.json")

    # 4 --------------------------------------------------------------------
    def _tree(self) -> dict[str, str]:
        return {str(p.relative_to(self.tmp).as_posix()): sha(p.read_bytes())
                for p in sorted(self.tmp.rglob("*")) if p.is_file()}

    def test_check_never_writes(self) -> None:
        # (a) 산출물이 아직 없다 → 불일치 1, 쓰기 0
        before = self._tree()
        self.assertEqual(LE.run(self.tmp, check=True, list_only=False), 1)
        self.assertEqual(self._tree(), before, "--check 는 없는 산출물을 만들지 않는다")
        # (b) 정상 생성 후 → 일치 0
        self.assertEqual(LE.run(self.tmp, check=False, list_only=False), 0)
        good = self._tree()
        self.assertEqual(LE.run(self.tmp, check=True, list_only=False), 0)
        self.assertEqual(self._tree(), good, "--check 는 일치할 때도 아무것도 쓰지 않는다")
        # (c) 산출물을 한 바이트 어긋내면 불일치 1, 그래도 쓰기 0 (덮어쓰지 않는다)
        victim = self.tmp / "demo/assets/leaders/king/icon64.png"
        victim.write_bytes(victim.read_bytes() + b"\x00")
        dirty = self._tree()
        self.assertEqual(LE.run(self.tmp, check=True, list_only=False), 1)
        self.assertEqual(self._tree(), dirty, "--check 는 어긋난 산출물도 되살리지 않는다")

    def test_list_never_writes(self) -> None:
        before = self._tree()
        self.assertEqual(LE.run(self.tmp, check=False, list_only=True), 0)
        self.assertEqual(self._tree(), before)

    # 5 --------------------------------------------------------------------
    def test_sources_untouched(self) -> None:
        before = {k: sha(p.read_bytes()) for k, p in self.srcs.items()}
        LE.run(self.tmp, check=False, list_only=False)
        LE.run(self.tmp, check=True, list_only=False)
        after = {k: sha(p.read_bytes()) for k, p in self.srcs.items()}
        self.assertEqual(before, after, "Earth 원본은 읽기만 한다")

    def test_manifest_shape(self) -> None:
        LE.run(self.tmp, check=False, list_only=False)
        doc = json.loads((self.tmp / LE.REL_MANIFEST).read_text(encoding="utf-8"))
        self.assertEqual(doc["tool"], "tools/art/leaders_export.py")
        self.assertEqual(len(doc["files"]), 4)
        for f in doc["files"]:
            self.assertEqual(set(f) - {"leader", "path", "size", "bytes", "sha256", "source", "sourceSize", "sourceSha256"}, set())
            self.assertEqual(sha((self.tmp / f["path"]).read_bytes()), f["sha256"])

    def test_missing_source_is_environment_error(self) -> None:
        for p in self.srcs.values():
            p.unlink()
        self.assertEqual(LE.run(self.tmp, check=False, list_only=False), 2)


if __name__ == "__main__":
    unittest.main()
