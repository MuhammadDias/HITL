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
    
    # Reshape + normalize (28x28 grayscale)
    X_28 = X_raw.reshape(-1, 28, 28, 1).astype('float32') / 255.0
    y = to_categorical(y_raw, NUM_CLASSES)
    
    # Shuffle
    np.random.seed(RANDOM_SEED)
    perm = np.random.permutation(len(X_28))
    X_28, y, y_raw_s = X_28[perm], y[perm], y_raw[perm]
    
    # Split 75% train | 15% val | 10% test
    X_tmp, X_test, y_tmp, y_test, y_tmp_r, y_test_r = train_test_split(
        X_28, y, y_raw_s, test_size=0.10, 
        random_state=RANDOM_SEED, stratify=y_raw_s
    )
    X_train_28, X_val_28, y_train, y_val = train_test_split(
        X_tmp, y_tmp, test_size=0.1667, random_state=RANDOM_SEED
    )
    
    # Simpan processed data
    np.savez_compressed(
        DIR_DATA / 'processed_data.npz',
        X_train=X_train_28, X_val=X_val_28, X_test=X_test,
        y_train=y_train, y_val=y_val, y_test=y_test,
        y_train_raw=y_tmp_r[:len(y_train)], 
        y_val_raw=y_tmp_r[len(y_train):],
        y_test_raw=y_test_r
    )
    
    print(f'\n✅ Processed data saved!')
    print(f'   Train : {X_train_28.shape[0]:,}')
    print(f'   Val   : {X_val_28.shape[0]:,}')
    print(f'   Test  : {X_test.shape[0]:,}')

if __name__ == '__main__':
    main()