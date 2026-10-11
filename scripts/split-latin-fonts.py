"""Splits each latin webfont into a core face and a rest face.

    python3 -m pip install fonttools brotli
    python3 scripts/split-latin-fonts.py

Run by hand when a latin file in app/fonts/ changes, then put the ranges it prints in app.css and
run npm run check:fonts -- --update; the output is committed. The core holds the characters pages
draw (ASCII, the footer's copyright sign and middle dot, quotes and dashes, the lab units and
marks content uses, and the combining accents that sit on ASCII letters), so a page that draws
nothing else downloads the core alone, about two thirds of the original. The rest holds the
remainder of the latin range and is fetched only by a page that draws one of those characters.
Same glyphs and every OpenType feature: a split moves no outline. The cost is kerning between a
core and a rest glyph, which a browser does not apply across two files.

check:fonts holds the result: each cut covers what its source covers, the two halves do not
overlap, app.css declares each file's characters, and a cut is from the source's version.

The originals stay as the source of the cut; the CV PDF and the Inter advance table also read
three of them whole.
"""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "app" / "fonts"
CSS = ROOT / "app" / "app.css"

# The latin subset's range, as fonts.gstatic.com cut the originals.
LATIN = (
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, "
    "U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"
)
# ASCII plus these. The footer draws the copyright sign and middle dot on every page; prose draws the
# quotes, dashes, bullet and ellipsis; procedures and posts draw the units and marks (degree, micro,
# squared, registered, times, prime, minus, which post-disclosures.css draws as content); the three
# combining accents attach to ASCII letters and must shape in the same file as them.
CORE_EXTRA = [
    0xA0, 0xA9, 0xAE, 0xB0, 0xB2, 0xB5, 0xB7, 0xD7, 0x0304, 0x0308, 0x0329,
    0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026, 0x2032, 0x2212,
]
FACES = ["inter-latin-normal", "inter-latin-italic", "source-serif-4-latin-normal", "source-serif-4-latin-italic"]


def parse(ranges):
    out = set()
    for part in ranges.split(","):
        first, _, last = part.strip()[2:].partition("-")
        out |= set(range(int(first, 16), int(last or first, 16) + 1))
    return out


def fmt(points):
    points = sorted(points)
    out = []
    i = 0
    while i < len(points):
        j = i
        while j + 1 < len(points) and points[j + 1] == points[j] + 1:
            j += 1
        out.append(f"U+{points[i]:04X}" + (f"-{points[j]:04X}" if j > i else ""))
        i = j + 1
    return ", ".join(out)


latin = parse(LATIN)
core = latin & (set(range(0x00, 0x7F)) | set(CORE_EXTRA))
rest = latin - core

for face in FACES:
    for part, points in (("core", core), ("rest", rest)):
        out = FONTS / f"{face.replace('latin', f'latin-{part}')}.woff2"
        subprocess.run(
            [sys.executable, "-m", "fontTools.subset", str(FONTS / f"{face}.woff2"), f"--unicodes={fmt(points)}",
             "--layout-features=*", "--flavor=woff2", f"--output-file={out}"],
            check=True,
        )
        print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size} bytes)")

print(f"core: unicode-range: {fmt(core)};")
print(f"rest: unicode-range: {fmt(rest)};")
