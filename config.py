# config.py
import os
from pathlib import Path

# ================================================================
# EDIT SESUAI KEBUTUHAN
# ================================================================
CATEGORIES = [
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
