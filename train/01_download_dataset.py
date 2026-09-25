# 01_download_dataset.py
import numpy as np
import urllib.request
import urllib.parse
from pathlib import Path
from config import CATEGORIES, SAMPLES_PER_CLASS, DIR_DATA, RANDOM_SEED

BASE_URL = 'https://storage.googleapis.com/quickdraw_dataset/full/numpy_bitmap'

def download_category(category, n_samples):
    """Download satu kategori dari QuickDraw"""
    filepath = DIR_DATA / f'{category}.npy'
    
    if not filepath.exists():
        print(f'  >> Downloading {category}...', end=' ', flush=True)
        url = f'{BASE_URL}/{urllib.parse.quote(category)}.npy'
        urllib.request.urlretrieve(url, filepath)
        print('OK')
    else:
        print(f'  OK Already exists: {category}')
    
    data = np.load(filepath)
    idx = np.random.choice(len(data), min(n_samples, len(data)), replace=False)
    return data[idx]

def main():
    np.random.seed(RANDOM_SEED)
    print('[v] Downloading QuickDraw dataset...\n')
    
    all_data = []
    all_labels = []
    
    for i, cat in enumerate(CATEGORIES):
        data = download_category(cat, SAMPLES_PER_CLASS)
        all_data.append(data)
        all_labels.append(np.full(len(data), i))
    
    X_raw = np.concatenate(all_data, axis=0)
    y_raw = np.concatenate(all_labels, axis=0)
    
    # Simpan raw data ke file .npz agar tidak perlu download ulang
    np.savez_compressed(DIR_DATA / 'quickdraw_raw.npz', X=X_raw, y=y_raw)
    
    print(f'\nOK Dataset saved: {DIR_DATA}/quickdraw_raw.npz')
    print(f'   Shape X: {X_raw.shape}')
    print(f'   Shape y: {y_raw.shape}')

if __name__ == '__main__':
    main()