from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
frame_dir = root / "assets" / "frames"
out = root / "assets" / "purple-scroll-composite.jpg"
frames = sorted(frame_dir.glob("website-frame-*.png"))[1:6]

if not frames:
    raise SystemExit("No frames found. Run extract-video-frames.mjs first.")

loaded = []
for frame in frames:
    image = Image.open(frame).convert("RGB")
    width, height = image.size
    # Crop away the white page chrome inside the reference video and keep the
    # purple illustration as a reusable art plate.
    image = image.crop((0, int(height * 0.13), width, int(height * 0.88)))
    loaded.append(image)
width = min(image.width for image in loaded)
target = []

for index, image in enumerate(loaded):
    image = image.resize((width, int(image.height * width / image.width)), Image.Resampling.LANCZOS)
    crop_top = 0 if index == 0 else int(image.height * 0.18)
    crop_bottom = image.height if index == len(loaded) - 1 else int(image.height * 0.82)
    target.append(image.crop((0, crop_top, width, crop_bottom)))

height = sum(image.height for image in target)
composite = Image.new("RGB", (width, height), "#4b16c9")
y = 0
for image in target:
    composite.paste(image, (0, y))
    y += image.height

composite.save(out, quality=92, optimize=True)
print(out)
print(f"{width}x{height}")
