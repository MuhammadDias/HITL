# 02_preprocess_data.py
import numpy as np
from sklearn.model_selection import train_test_split
from tensorflow.keras.utils import to_categorical
from config import DIR_DATA, RANDOM_SEED, NUM_CLASSES

def main():
    # Load raw data
    data = np.load(DIR_DATA / 'quickdraw_raw.npz')
    X_raw = data['X']
    y_raw = data['y']

    print(f'Raw data: {X_raw.shape}')

    # Images stay uint8 (0-255, ~1 GB for 1.2M sketches): float32 would need ~4 GB
    # plus copies during the split and got the process killed for lack of RAM.
    # create_dataset() in utils.py normalizes to [0, 1] per batch.
    X_28 = X_raw.reshape(-1, 28, 28, 1)

    # Split indices only (no data copies): 75% train | 15% val | 10% test
    idx = np.arange(len(y_raw))
    idx_tmp, idx_test = train_test_split(
        idx, test_size=0.10, random_state=RANDOM_SEED, stratify=y_raw
    )
    idx_train, idx_val = train_test_split(
        idx_tmp, test_size=0.1667, random_state=RANDOM_SEED
    )

    def subset(ids):
        return X_28[ids], to_categorical(y_raw[ids], NUM_CLASSES), y_raw[ids]

    X_train_28, y_train, y_train_raw = subset(idx_train)
    X_val_28, y_val, y_val_raw = subset(idx_val)
    X_test, y_test, y_test_raw = subset(idx_test)

    # Simpan processed data
    np.savez_compressed(
        DIR_DATA / 'processed_data.npz',
        X_train=X_train_28, X_val=X_val_28, X_test=X_test,
        y_train=y_train, y_val=y_val, y_test=y_test,
        y_train_raw=y_train_raw,
        y_val_raw=y_val_raw,
        y_test_raw=y_test_raw
    )

    print(f'\n✅ Processed data saved!')
    print(f'   Train : {X_train_28.shape[0]:,}')
    print(f'   Val   : {X_val_28.shape[0]:,}')
    print(f'   Test  : {X_test.shape[0]:,}')

if __name__ == '__main__':
    main()
