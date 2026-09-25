import sys
import numpy as np
import matplotlib.pyplot as plt
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.applications import EfficientNetB0
from pathlib import Path
from PIL import Image, ImageOps, ImageFilter

# ── Konfigurasi ───────────────────────────────────────────────
CATEGORIES = [
    'apple', 'banana', 'bicycle', 'bird', 'book',
    'car', 'cat', 'cloud', 'dog', 'fish',
    'flower', 'house', 'moon', 'star', 'sun',
    'tree', 'airplane', 'sailboat', 'chair', 'mountain',
]
DIR_WEIGHTS = Path('weights')

# ── SliceChannel untuk SketchNN ───────────────────────────────
@tf.keras.utils.register_keras_serializable()
class SliceChannel(layers.Layer):
    def __init__(self, channel_idx, **kwargs):
        super().__init__(**kwargs)
        self.channel_idx = channel_idx
    def call(self, x):
        return x[:, :, :, self.channel_idx:self.channel_idx + 1]
    def get_config(self):
        config = super().get_config()
        config['channel_idx'] = self.channel_idx
        return config


# ── Preprocessing gambar ──────────────────────────────────────
def load_and_preprocess(image_path, target_size, to_rgb=False, sobel=False):
    img = Image.open(image_path).convert('L')

    # Step 1: Pastikan background putih goresan hitam
    arr = np.array(img)
    if arr.mean() < 127:
        img = ImageOps.invert(img)

    # Step 2: Auto-crop — hilangkan whitespace berlebih di tepi
    # Konversi ke binary dulu
    arr   = np.array(img)
    mask  = arr < 200  # pixel gelap = goresan
    rows  = np.any(mask, axis=1)
    cols  = np.any(mask, axis=0)
    if rows.any() and cols.any():
        rmin, rmax = np.where(rows)[0][[0, -1]]
        cmin, cmax = np.where(cols)[0][[0, -1]]
        pad = 10  # padding agar tidak mepet
        rmin = max(0, rmin - pad)
        rmax = min(arr.shape[0], rmax + pad)
        cmin = max(0, cmin - pad)
        cmax = min(arr.shape[1], cmax + pad)
        img = img.crop((cmin, rmin, cmax, rmax))

    # Step 3: Resize ke ukuran target
    img = img.resize(target_size, Image.LANCZOS)
    arr = np.array(img, dtype='float32') / 255.0
    arr = arr.reshape(1, target_size[1], target_size[0], 1)

    if to_rgb:
        arr = np.repeat(arr, 3, axis=-1)

    if sobel:
        kx  = tf.constant([[-1,0,1],[-2,0,2],[-1,0,1]], dtype=tf.float32)[:,:,tf.newaxis,tf.newaxis]
        ky  = tf.constant([[-1,-2,-1],[0,0,0],[1,2,1]], dtype=tf.float32)[:,:,tf.newaxis,tf.newaxis]
        t   = tf.cast(arr, tf.float32)
        gx  = tf.nn.conv2d(t, kx, strides=1, padding='SAME')
        gy  = tf.nn.conv2d(t, ky, strides=1, padding='SAME')
        mag = tf.sqrt(gx**2 + gy**2)
        mag = mag / (tf.reduce_max(mag) + 1e-8)
        arr = np.concatenate([arr, mag.numpy()], axis=-1)

    return arr


# ── Load semua model ──────────────────────────────────────────
def load_all_models():
    models = {}

    print('Memuat semua model...')

    # Model 1 — Custom CNN
    try:
        models['1_custom_cnn'] = {
            'model' : keras.models.load_model(str(DIR_WEIGHTS / 'model_1_custom_cnn_best.keras')),
            'size'  : (28, 28),
            'rgb'   : False,
            'sobel' : False,
            'label' : 'Custom CNN',
        }
        print('  ✅ [1] Custom CNN dimuat')
    except Exception as e:
        print(f'  ⚠️  [1] Custom CNN gagal: {e}')

    # Model 2 — EfficientNet
    try:
        models['2_efficientnet'] = {
            'model' : keras.models.load_model(str(DIR_WEIGHTS / 'model_2_efficientnet_best.keras')),
            'size'  : (96, 96),
            'rgb'   : True,
            'sobel' : False,
            'label' : 'EfficientNet-B0',
        }
        print('  ✅ [2] EfficientNet dimuat')
    except Exception as e:
        print(f'  ⚠️  [2] EfficientNet gagal: {e}')

    # Model 3 — SqueezeNet
    try:
        models['3_squeezenet'] = {
            'model' : keras.models.load_model(str(DIR_WEIGHTS / 'model_3_squeezenet_best.keras')),
            'size'  : (64, 64),
            'rgb'   : True,
            'sobel' : False,
            'label' : 'SqueezeNet',
        }
        print('  ✅ [3] SqueezeNet dimuat')
    except Exception as e:
        print(f'  ⚠️  [3] SqueezeNet gagal: {e}')

    # Model 4 — MobileNetV2
    try:
        models['4_mobilenetv2'] = {
            'model' : keras.models.load_model(str(DIR_WEIGHTS / 'model_4_mobilenetv2_best.keras')),
            'size'  : (96, 96),
            'rgb'   : True,
            'sobel' : False,
            'label' : 'MobileNetV2',
        }
        print('  ✅ [4] MobileNetV2 dimuat')
    except Exception as e:
        print(f'  ⚠️  [4] MobileNetV2 gagal: {e}')

    # Model 5 — ResNet-18
    try:
        models['5_resnet18'] = {
            'model' : keras.models.load_model(str(DIR_WEIGHTS / 'model_5_resnet18_best.keras')),
            'size'  : (56, 56),
            'rgb'   : False,
            'sobel' : False,
            'label' : 'ResNet-18',
        }
        print('  ✅ [5] ResNet-18 dimuat')
    except Exception as e:
        print(f'  ⚠️  [5] ResNet-18 gagal: {e}')

    # Model 6 — SketchNN
    try:
        models['6_sketchnn'] = {
            'model' : keras.models.load_model(
                str(DIR_WEIGHTS / 'model_6_sketchnn_best.keras'),
                safe_mode=False
            ),
            'size'  : (28, 28),
            'rgb'   : False,
            'sobel' : True,
            'label' : 'SketchNN',
        }
        print('  ✅ [6] SketchNN dimuat')
    except Exception as e:
        print(f'  ⚠️  [6] SketchNN gagal: {e}')

    return models


# ── Prediksi satu gambar dengan satu model ────────────────────
def predict_one(model_info, image_path):
    arr   = load_and_preprocess(
        image_path,
        target_size = model_info['size'],
        to_rgb      = model_info['rgb'],
        sobel       = model_info['sobel'],
    )
    preds    = model_info['model'].predict(arr, verbose=0)[0]
    top3_idx = np.argsort(preds)[::-1][:3]
    top3     = [(CATEGORIES[i], float(preds[i])) for i in top3_idx]
    return top3


# ── Tampilkan hasil dalam grafik ──────────────────────────────
def tampilkan_hasil(image_path, semua_hasil):
    n_model = len(semua_hasil)
    fig     = plt.figure(figsize=(16, 4 + n_model * 1.2))
    gs      = fig.add_gridspec(n_model + 1, 4, hspace=0.5, wspace=0.4)

    # Tampilkan gambar asli di kiri atas
    ax_img = fig.add_subplot(gs[0:2, 0])
    img    = Image.open(image_path).convert('L')
    ax_img.imshow(img, cmap='gray_r')
    ax_img.set_title('Gambar Input', fontsize=11, fontweight='bold')
    ax_img.axis('off')

    # Tampilkan hasil tiap model
    for row, (model_key, hasil) in enumerate(semua_hasil.items()):
        label_model = hasil['label']
        top3        = hasil['top3']

        # Nama + prediksi utama
        ax_text = fig.add_subplot(gs[row, 1])
        ax_text.axis('off')
        warna = 'green' if hasil['top3'][0][1] > 0.7 else \
                'orange' if hasil['top3'][0][1] > 0.4 else 'red'
        ax_text.text(0, 0.7, f'[{row+1}] {label_model}',
                     fontsize=10, fontweight='bold')
        ax_text.text(0, 0.3, f'→ {top3[0][0].upper()}',
                     fontsize=12, color=warna, fontweight='bold')
        ax_text.text(0, 0.0, f'   {top3[0][1]*100:.1f}%',
                     fontsize=10, color=warna)

        # Bar chart Top-3
        ax_bar = fig.add_subplot(gs[row, 2:])
        names  = [t[0] for t in top3]
        scores = [t[1] * 100 for t in top3]
        colors = ['#2ecc71' if i == 0 else '#3498db' for i in range(3)]
        bars   = ax_bar.barh(names[::-1], scores[::-1], color=colors[::-1])
        ax_bar.set_xlim(0, 100)
        ax_bar.set_xlabel('Confidence (%)')
        for bar, score in zip(bars, scores[::-1]):
            ax_bar.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
                        f'{score:.1f}%', va='center', fontsize=9)
        ax_bar.grid(axis='x', alpha=0.3)

    plt.suptitle(
        f'Hasil Prediksi 6 Model — {Path(image_path).name}',
        fontsize=14, fontweight='bold', y=1.01
    )

    output_path = Path('output') / f'hasil_{Path(image_path).stem}.png'
    output_path.parent.mkdir(exist_ok=True)
    plt.savefig(output_path, dpi=150, bbox_inches='tight')
    print(f'\n✅ Grafik disimpan di: {output_path}')
    plt.show()


# ── Main ──────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2:
        print('Usage: python test_gambar.py <path_gambar>')
        print('Contoh: python test_gambar.py gambar/kucingku.jpg')
        sys.exit(1)

    image_path = sys.argv[1]
    if not Path(image_path).exists():
        print(f'❌ File tidak ditemukan: {image_path}')
        sys.exit(1)

    print(f'\n{"="*50}')
    print(f'  TEST GAMBAR: {image_path}')
    print(f'{"="*50}\n')

    # Load semua model
    models = load_all_models()

    # Prediksi dengan semua model
    print('\nMemprediksi...')
    semua_hasil = {}
    for key, info in models.items():
        top3 = predict_one(info, image_path)
        semua_hasil[key] = {'label': info['label'], 'top3': top3}

        print(f'  [{key[0]}] {info["label"]:<16} → '
              f'{top3[0][0]:<12} {top3[0][1]*100:.1f}%  '
              f'| #{2} {top3[1][0]} {top3[1][1]*100:.1f}%  '
              f'| #{3} {top3[2][0]} {top3[2][1]*100:.1f}%')

    # Tampilkan grafik
    tampilkan_hasil(image_path, semua_hasil)


if __name__ == '__main__':
    main()