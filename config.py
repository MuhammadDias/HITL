# config.py
import os
from pathlib import Path

# ================================================================
# EDIT SESUAI KEBUTUHAN
# ================================================================
# Kategori Quick, Draw! (nama Inggris = nama file dataset) -> label bahasa Indonesia
# yang dikirim backend ke game. Urutan menentukan indeks output model.
LABELS_ID = {
    # bisa dipijak
    'ladder': 'tangga',
    'stairs': 'anak tangga',
    'bridge': 'jembatan',
    'bench': 'bangku',
    'table': 'meja',
    'skateboard': 'papan luncur',
    # berbahaya
    'cactus': 'kaktus',
    'campfire': 'api unggun',
    'lightning': 'petir',
    'saw': 'gergaji',
    'knife': 'pisau',
    'sword': 'pedang',
    'snake': 'ular',
    'spider': 'laba-laba',
    # netral / pengecoh
    'fence': 'pagar',
    'zigzag': 'zigzag',
    'line': 'garis',
    'cloud': 'awan',
    'bucket': 'ember',
    'umbrella': 'payung',
}
CATEGORIES = list(LABELS_ID)

# Kategori model lama (sebelum v0.6.0). Dipakai backend untuk model yang belum
# punya file <model>.labels.json, supaya label model lama tidak tertukar.
LEGACY_CATEGORIES = [
    'apple', 'banana', 'bicycle', 'bird', 'book',
    'car', 'cat', 'cloud', 'dog', 'fish',
    'flower', 'house', 'moon', 'star', 'sun',
    'tree', 'airplane', 'sailboat', 'chair', 'mountain',
]

SAMPLES_PER_CLASS = 60000   # Jumlah sampel per kategori (max 50k)
BATCH_SIZE = 64
EPOCHS = 50
LEARNING_RATE = 0.001
RANDOM_SEED = 42
NUM_CLASSES = len(CATEGORIES)

# Folder structure
BASE_DIR = Path(__file__).parent
DIR_DATA = BASE_DIR / 'data'
DIR_WEIGHTS = BASE_DIR / 'weights'
DIR_OUTPUT = BASE_DIR / 'output'

# Buat folder jika belum ada
for d in [DIR_DATA, DIR_WEIGHTS, DIR_OUTPUT]:
    d.mkdir(exist_ok=True)

print(f'Jumlah kategori : {NUM_CLASSES}')
print(f'Sampel per kelas: {SAMPLES_PER_CLASS:,}')
print(f'Total sampel    : {NUM_CLASSES * SAMPLES_PER_CLASS:,}')
