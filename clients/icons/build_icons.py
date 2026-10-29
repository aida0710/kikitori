"""端末のアプリのアイコン（Windows の .ico、Mac の .icns、README 用の .png）を作る。

形は管理画面のロゴ（apps/web/src/components/KikitoriLogo.tsx）と同じ: 紫の傾きの角丸に、lucide の Mic を白い線で描く。
Mac は Apple のアイコンの決まりに合わせ、1024 の枠の中に 824 の角丸を置く。

  uv run --with pillow python clients/icons/build_icons.py
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
CLIENTS = HERE.parent

# ロゴの色（Tailwind の accent → accent-deep、左上から右下へ）
GRADIENT_START = (0x8B, 0x5C, 0xF6)
GRADIENT_END = (0x63, 0x66, 0xF1)
# ロゴの寸法（26px の角丸、角の半径 7px、マイクは 15px・線の太さは lucide の 24 の目盛りで 1.75）
LOGO_TILE = 26
LOGO_RADIUS = 7
LOGO_GLYPH = 15
GLYPH_GRID = 24
GLYPH_STROKE = 1.75
# 縮めたときの線のなめらかさのため、4 倍の大きさで描いてから縮める
SUPERSAMPLE = 4
# Apple のアイコンの決まり: 1024 の枠に 824 の角丸（角の半径はおよそ 185）
MAC_CANVAS = 1024
MAC_TILE = 824
MAC_RADIUS = 185

WINDOWS_ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 256]


def draw_icon(canvas: int, tile: int, radius: float) -> Image.Image:
    """canvas の正方形の真ん中に、tile の大きさの角丸のロゴを描く。"""
    scale = SUPERSAMPLE
    size = canvas * scale
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    offset = (canvas - tile) * scale / 2
    tile_size = tile * scale

    gradient = Image.new("RGBA", (size, size))
    pixels = gradient.load()
    for y in range(size):
        for x in range(size):
            # 左上から右下への傾き（Tailwind の bg-gradient-to-br と同じ向き）
            t = min(1.0, max(0.0, ((x - offset) + (y - offset)) / (2 * tile_size)))
            pixels[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(GRADIENT_START, GRADIENT_END)) + (255,)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (offset, offset, offset + tile_size, offset + tile_size), radius=radius * scale, fill=255
    )
    image.paste(gradient, (0, 0), mask)

    glyph = tile_size * LOGO_GLYPH / LOGO_TILE
    unit = glyph / GLYPH_GRID
    origin = offset + (tile_size - glyph) / 2
    stroke = GLYPH_STROKE * unit
    draw = ImageDraw.Draw(image)
    white = (255, 255, 255, 255)

    def point(x: float, y: float) -> tuple[float, float]:
        return origin + x * unit, origin + y * unit

    def cap(x: float, y: float) -> None:
        cx, cy = point(x, y)
        draw.ellipse((cx - stroke / 2, cy - stroke / 2, cx + stroke / 2, cy + stroke / 2), fill=white)

    def line(x1: float, y1: float, x2: float, y2: float) -> None:
        draw.line((point(x1, y1), point(x2, y2)), fill=white, width=round(stroke))
        cap(x1, y1)
        cap(x2, y2)

    # <rect x="9" y="2" width="6" height="13" rx="3"/>（線は図形の内側へ描かれるので、太さの半分だけ外へ広げる）
    left, top = point(9, 2)
    right, bottom = point(15, 15)
    half = stroke / 2
    draw.rounded_rectangle((left - half, top - half, right + half, bottom + half), radius=3 * unit + half, outline=white, width=round(stroke))
    # <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    line(19, 10, 19, 12)
    line(5, 10, 5, 12)
    cx, cy = point(12, 12)
    arc_radius = 7 * unit + half
    draw.arc((cx - arc_radius, cy - arc_radius, cx + arc_radius, cy + arc_radius), start=0, end=180, fill=white, width=round(stroke))
    # <path d="M12 19v3"/>
    line(12, 19, 12, 22)

    return image.resize((canvas, canvas), Image.Resampling.LANCZOS)


def main() -> None:
    full = draw_icon(256, 256, 256 * LOGO_RADIUS / LOGO_TILE)
    full.save(HERE / "kikitori-icon-256.png")
    windows_ico = CLIENTS / "windows" / "Kikitori.Windows" / "Assets" / "Kikitori.ico"
    windows_ico.parent.mkdir(parents=True, exist_ok=True)
    # 小さい大きさも、縮めたものではなくその大きさで描いたものを入れる（線がつぶれにくい）
    sizes = [draw_icon(size, size, size * LOGO_RADIUS / LOGO_TILE) for size in WINDOWS_ICO_SIZES]
    sizes[-1].save(windows_ico, format="ICO", sizes=[(s, s) for s in WINDOWS_ICO_SIZES], append_images=sizes[:-1])

    mac = draw_icon(MAC_CANVAS, MAC_TILE, MAC_RADIUS)
    mac.save(CLIENTS / "macos" / "Resources" / "AppIcon.icns", format="ICNS")
    print("wrote", windows_ico, CLIENTS / "macos" / "Resources" / "AppIcon.icns")


if __name__ == "__main__":
    main()
