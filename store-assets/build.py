#!/usr/bin/env python3
"""Build Chrome Web Store graphics from the Gatekeep logo."""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
LOGO_PATH = Path(
    "/Users/jackmartinosullivan/.cursor/projects/"
    "Users-jackmartinosullivan-Documents-CRATEKREEPER-cratecreeper/assets/"
    "ChatGPT_Image_Jun_26__2026__09_56_10_PM-3f2db609-f8c4-4276-8c05-46e81bd24ea7.png"
)

WHITE = "#FFFFFF"
PANEL = "#F4F7FB"
BORDER = "#DBE4F0"
FG = "#0F1B2D"
MUTED = "#5B6B7F"
ACCENT = "#2563EB"

FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

PRODUCT = "cratecreep"
PARENT = "Gatekeep"


def font(path: str, size: int):
    return ImageFont.truetype(path, size)


def load_logo(size: int) -> Image.Image:
    img = Image.open(LOGO_PATH).convert("RGBA")
    return img.resize((size, size), Image.Resampling.LANCZOS)


def paste_centered(base: Image.Image, overlay: Image.Image, cx: int, cy: int):
    x = cx - overlay.width // 2
    y = cy - overlay.height // 2
    base.paste(overlay, (x, y), overlay)


def paste_topleft(base: Image.Image, overlay: Image.Image, x: int, y: int):
    base.paste(overlay, (x, y), overlay)


def draw_rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def save_rgb(img: Image.Image, path: Path, fmt: str):
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, WHITE)
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode != "RGB":
        img = img.convert("RGB")
    if fmt == "JPEG":
        img.save(path, "JPEG", quality=92, optimize=True)
    else:
        img.save(path, "PNG", optimize=True)


def build_icon():
    logo = Image.open(LOGO_PATH).convert("RGB")
    out = logo.resize((128, 128), Image.Resampling.LANCZOS)
    save_rgb(out, ROOT / "store-icon-128.png", "PNG")


def build_small_tile():
    w, h = 440, 280
    img = Image.new("RGB", (w, h), WHITE)
    draw = ImageDraw.Draw(img)

    logo = load_logo(72)
    paste_centered(img, logo, w // 2, 78)

    title = font(FONT_BOLD, 34)
    sub = font(FONT_REG, 20)
    t1 = PARENT
    t2 = PRODUCT
    b1 = draw.textbbox((0, 0), t1, font=title)
    b2 = draw.textbbox((0, 0), t2, font=sub)
    draw.text(((w - (b1[2] - b1[0])) // 2, 128), t1, fill=FG, font=title)
    draw.text(((w - (b2[2] - b2[0])) // 2, 170), t2, fill=ACCENT, font=sub)

    save_rgb(img, ROOT / "promo-small-440x280.jpg", "JPEG")


def build_marquee():
    w, h = 1400, 560
    img = Image.new("RGB", (w, h), WHITE)
    draw = ImageDraw.Draw(img)

    # subtle corner accents
    accent = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ad = ImageDraw.Draw(accent)
    ad.pieslice([-120, -120, 180, 180], 0, 90, fill=(219, 228, 240, 180))
    ad.pieslice([w - 180, h - 180, w + 120, h + 120], 180, 270, fill=(219, 228, 240, 140))
    img.paste(accent, (0, 0), accent)

    logo = load_logo(120)
    paste_topleft(img, logo, 180, (h - logo.height) // 2)

    title = font(FONT_BOLD, 72)
    sub = font(FONT_REG, 36)
    tag = font(FONT_REG, 28)
    draw.text((340, 190), PARENT, fill=FG, font=title)
    draw.text((340, 275), PRODUCT, fill=ACCENT, font=sub)
    draw.text((340, 340), "Fill your Beatport cart from a tracklist", fill=MUTED, font=tag)

    save_rgb(img, ROOT / "promo-marquee-1400x560.jpg", "JPEG")


def draw_check(draw, cx, cy, r=14):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ACCENT)
    draw.line((cx - 5, cy, cx - 1, cy + 5), fill=WHITE, width=3)
    draw.line((cx - 1, cy + 5, cx + 7, cy - 5), fill=WHITE, width=3)


def draw_spinner(draw, cx, cy, r=14):
    draw.arc((cx - r, cy - r, cx + r, cy + r), 0, 270, fill=ACCENT, width=3)


def draw_dash(draw, cx, cy, r=14):
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill="#CBD5E1")
    draw.line((cx - 6, cy, cx + 6, cy), fill=WHITE, width=3)


def build_screenshot():
    w, h = 1280, 800
    img = Image.new("RGB", (w, h), WHITE)
    draw = ImageDraw.Draw(img)

    # outer card
    margin = 48
    draw_rounded_rect(
        draw,
        (margin, margin, w - margin, h - margin),
        20,
        fill=WHITE,
        outline=BORDER,
        width=2,
    )

    # header
    logo = load_logo(44)
    paste_topleft(img, logo, margin + 32, margin + 28)
    draw.text((margin + 88, margin + 30), PARENT, fill=FG, font=font(FONT_BOLD, 28))
    draw.text((margin + 88, margin + 62), PRODUCT, fill=ACCENT, font=font(FONT_REG, 18))

    draw.line((margin + 24, margin + 108, w - margin - 24, margin + 108), fill=BORDER, width=1)

    # progress
    bar_x = margin + 40
    bar_y = margin + 140
    bar_w = w - 2 * margin - 80
    bar_h = 12
    draw_rounded_rect(draw, (bar_x, bar_y, bar_x + bar_w, bar_y + bar_h), 6, fill=BORDER)
    draw_rounded_rect(draw, (bar_x, bar_y, bar_x + int(bar_w * 0.86), bar_y + bar_h), 6, fill=ACCENT)

    draw.text((bar_x, bar_y + 28), "12 / 14", fill=FG, font=font(FONT_BOLD, 42))
    draw.text((bar_x + 145, bar_y + 48), "in cart", fill=MUTED, font=font(FONT_REG, 22))

    tracks = [
        ("J Dilla", "Don't Cry", "check"),
        ("Nujabes", "Feather", "check"),
        ("Madlib", "The Blast", "check"),
        ("Erykah Badu", "On & On", "check"),
        ("The Roots", "You Got Me", "check"),
        ("Miles Davis", "So What", "check"),
        ("Robert Glasper", "Afro Blue", "spinner"),
        ("Tom Waits", "Downtown Train", "dash"),
    ]

    row_x = margin + 40
    row_w = w - 2 * margin - 80
    row_h = 52
    start_y = margin + 230

    for i, (artist, title, status) in enumerate(tracks):
        y = start_y + i * (row_h + 10)
        draw_rounded_rect(draw, (row_x, y, row_x + row_w, y + row_h), 10, fill=PANEL, outline=BORDER)
        draw.text((row_x + 18, y + 10), artist, fill=FG, font=font(FONT_BOLD, 16))
        draw.text((row_x + 18, y + 28), title, fill=MUTED, font=font(FONT_REG, 14))
        cx = row_x + row_w - 28
        cy = y + row_h // 2
        if status == "check":
            draw_check(draw, cx, cy)
        elif status == "spinner":
            draw_spinner(draw, cx, cy)
        else:
            draw_dash(draw, cx, cy)

    label = "Cart ready — review & check out"
    lb = draw.textbbox((0, 0), label, font=font(FONT_BOLD, 16))
    btn_w = max(420, (lb[2] - lb[0]) + 48)
    btn_h = 52
    btn_x = (w - btn_w) // 2
    btn_y = h - margin - 72
    draw_rounded_rect(draw, (btn_x, btn_y, btn_x + btn_w, btn_y + btn_h), 12, fill=ACCENT)
    draw.text(
        (btn_x + (btn_w - (lb[2] - lb[0])) // 2, btn_y + 16),
        label,
        fill=WHITE,
        font=font(FONT_BOLD, 16),
    )

    save_rgb(img, ROOT / "screenshot-1280x800.jpg", "JPEG")


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    build_icon()
    build_small_tile()
    build_marquee()
    build_screenshot()
    for p in sorted(ROOT.glob("*")):
        if p.suffix.lower() in {".png", ".jpg", ".jpeg"}:
            im = Image.open(p)
            print(f"{p.name}: {im.width}x{im.height}")


if __name__ == "__main__":
    main()
