from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
frames = sorted((root / "assets" / "frames").glob("website-frame-*.png"))
thumbs = []

for frame in frames:
    image = Image.open(frame).convert("RGB")
    image.thumbnail((240, 180), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (240, 205), "white")
    canvas.paste(image, (0, 0))
    ImageDraw.Draw(canvas).text((8, 184), frame.stem, fill="black")
    thumbs.append(canvas)

cols = 5
rows = (len(thumbs) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 240, rows * 205), "#dddddd")

for index, thumb in enumerate(thumbs):
    sheet.paste(thumb, ((index % cols) * 240, (index // cols) * 205))

out = root / "assets" / "frames-contact-sheet.jpg"
sheet.save(out, quality=90)
print(out)
