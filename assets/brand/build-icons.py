#!/usr/bin/env python
"""
Generates the web logo and the full favicon set from the brand source mark.

    python assets/brand/build-icons.py

Source : assets/brand/Deetech-logo.png   (661x606, transparent padding)
Outputs:
    apps/web/public/brand/deetech-mark.png   trimmed mark, full resolution
    apps/web/src/app/icon.png                512x512, Next.js app icon
    apps/web/src/app/apple-icon.png          180x180, opaque white background
    apps/web/src/app/favicon.ico             16/32/48, multi-size

Requires Pillow. Re-run whenever the source mark changes.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "brand" / "Deetech-logo.png"
PUBLIC_BRAND = ROOT / "apps" / "web" / "public" / "brand"
APP_DIR = ROOT / "apps" / "web" / "src" / "app"


def trimmed_mark() -> Image.Image:
    """The source carries ~50px of transparent padding; crop to the real bounds."""
    image = Image.open(SOURCE).convert("RGBA")
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        raise SystemExit("Source image is fully transparent.")
    return image.crop(bbox)


def square(mark: Image.Image, size: int, pad_ratio: float = 0.06) -> Image.Image:
    """
    Fits the mark into a transparent square with a little breathing room, so
    the icon is not flush against the tile edge at small sizes.
    """
    inner = int(size * (1 - 2 * pad_ratio))
    scaled = mark.copy()
    scaled.thumbnail((inner, inner), Image.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(
        scaled,
        ((size - scaled.width) // 2, (size - scaled.height) // 2),
        scaled,
    )
    return canvas


def on_white(image: Image.Image) -> Image.Image:
    """iOS does not honour transparency on home-screen icons; flatten to white."""
    background = Image.new("RGBA", image.size, (255, 255, 255, 255))
    background.alpha_composite(image)
    return background.convert("RGB")


def main() -> None:
    mark = trimmed_mark()
    PUBLIC_BRAND.mkdir(parents=True, exist_ok=True)

    mark.save(PUBLIC_BRAND / "deetech-mark.png", optimize=True)
    print(f"deetech-mark.png      {mark.width}x{mark.height}")

    icon = square(mark, 512)
    icon.save(APP_DIR / "icon.png", optimize=True)
    print("icon.png              512x512")

    apple = on_white(square(mark, 180, pad_ratio=0.10))
    apple.save(APP_DIR / "apple-icon.png", optimize=True)
    print("apple-icon.png        180x180 (opaque white)")

    # Pillow builds the multi-size ICO itself from one source; give it a
    # generous square so each embedded size downsamples cleanly.
    square(mark, 256, pad_ratio=0.02).save(
        APP_DIR / "favicon.ico",
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    print("favicon.ico           16/32/48")


if __name__ == "__main__":
    main()
