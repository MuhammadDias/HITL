import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw, ImageFont
import tensorflow as tf
from tensorflow import keras
import argparse
import sys

CATEGORIES = [
    'apple','banana','bicycle','bird','book',
    'car','cat','cloud','dog','fish',
    'flower','house','moon','star','sun',
    'tree','airplane','sailboat','chair','mountain'
]

DIR_WEIGHTS = Path("weights")
DIR_OUTPUT  = Path("output")

def preprocess(img_path, size, rgb=False):
    mode = 'RGB' if rgb else 'L'
    img = Image.open(img_path).convert(mode)

    # PERBAIKAN DI SINI: 
    # Jika mean > 127 artinya gambar dominan cerah/putih (misal hasil coretan kertas/Paint).
    # Kita INVERT agar menjadi latar hitam (0) sesuai standar dataset training.
    # Jika mean < 127 artinya sudah dominan gelap/hitam (seperti file .npy), maka BIARKAN SAJA.
    mean_arr = np.array(img.convert('L'))
    if mean_arr.mean() > 127:
        img = ImageOps.invert(img)

    img = img.resize(size)
    arr = np.array(img).astype(np.float32) / 255.0

    if rgb:
        # ensure shape is (1, H, W, 3)
        arr = arr.reshape(1, arr.shape[0], arr.shape[1], 3)
    else:
        # ensure shape is (1, H, W, 1)
        if arr.ndim == 2:
            arr = arr.reshape(1, arr.shape[0], arr.shape[1], 1)
        else:
            arr = arr[..., 0]
            arr = arr.reshape(1, arr.shape[0], arr.shape[1], 1)

    return arr


def load_mobilenet():
    path = DIR_WEIGHTS / "model_4_mobilenetv2_best.keras"
    if not path.exists():
        raise FileNotFoundError(f"MobileNet weights not found: {path}")
    model = keras.models.load_model(path)
    return {"model": model, "size": (96, 96), "rgb": True}

def predict_top3(model_info, img_path):
    arr = preprocess(img_path, model_info["size"], model_info["rgb"])
    pred = model_info["model"].predict(arr, verbose=0)[0]
    idx = np.argsort(pred)[::-1][:3]
    return [(CATEGORIES[i], float(pred[i])) for i in idx]

def save_plot_top3(img_path, top3):
    # annotate image with top-3 labels using PIL for clearer overlay
    pil_img = Image.open(img_path).convert('RGB')
    draw = ImageDraw.Draw(pil_img)
    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    text_lines = [f"{i+1}. {name}: {score*100:.2f}%" for i, (name, score) in enumerate(top3)]
    # compute background box size
    padding = 6
    # robust helper to compute text size with several fallbacks
    def _text_size(txt):
        try:
            # Pillow >=8: textbbox
            bbox = draw.textbbox((0, 0), txt, font=font)
            return (bbox[2] - bbox[0], bbox[3] - bbox[1])
        except Exception:
            try:
                # ImageFont.getsize
                return font.getsize(txt)
            except Exception:
                try:
                    # older Pillow: ImageDraw.textsize
                    return draw.textsize(txt, font=font)
                except Exception:
                    return (100, 14)

    w, h = _text_size(text_lines[0])
    line_height = h + 2
    box_width = max(_text_size(line)[0] for line in text_lines) + padding * 2
    box_height = line_height * len(text_lines) + padding * 2

    # draw semi-transparent rectangle
    rect_xy = (5, 5, 5 + box_width, 5 + box_height)
    try:
        draw.rectangle(rect_xy, fill=(0, 0, 0, 160))
    except Exception:
        draw.rectangle(rect_xy, fill=(0, 0, 0))

    # draw each line
    for i, line in enumerate(text_lines):
        y = 5 + padding + i * line_height
        draw.text((5 + padding, y), line, fill=(255, 255, 255), font=font)

    fig = plt.figure(figsize=(8, 5))
    ax = fig.add_subplot(1, 2, 1)
    ax.imshow(pil_img)
    ax.axis('off')

    ax2 = fig.add_subplot(1, 2, 2)
    names = [t[0] for t in top3]
    scores = [t[1] * 100 for t in top3]
    ax2.barh(names[::-1], scores[::-1])
    ax2.set_xlim(0, 100)

    out = DIR_OUTPUT / f"hasil_{img_path.stem}.png"
    plt.savefig(out, bbox_inches='tight')
    plt.close()
    print(f"✔ saved {out}")

def main():
    parser = argparse.ArgumentParser(description="Batch test PNGs with MobileNet and show top-3 results")
    parser.add_argument('--input', '-i', default='.', help='File or directory to process (defaults to current dir)')
    args = parser.parse_args()

    DIR_OUTPUT.mkdir(exist_ok=True)

    try:
        mob = load_mobilenet()
    except Exception as e:
        print(f"Error loading MobileNet: {e}")
        sys.exit(1)

    p = Path(args.input)
    files = []
    if p.is_dir():
        files = sorted([f for f in p.iterdir() if f.suffix.lower() in ('.png', '.jpg', '.jpeg')])
    elif p.is_file():
        files = [p]
    else:
        print(f"No such file or directory: {p}")
        sys.exit(1)

    if not files:
        print("No image files (.png/.jpg/.jpeg) found to process.")
        return

    for img_path in files:
        print(f"Processing {img_path}")
        try:
            top3 = predict_top3(mob, img_path)
        except Exception as e:
            print(f"Failed to process {img_path}: {e}")
            continue

        # Print Top-3 to console
        for rank, (name, score) in enumerate(top3, start=1):
            print(f"{rank}. {name}: {score*100:.2f}%")

        save_plot_top3(img_path, top3)

if __name__ == "__main__":
    main()