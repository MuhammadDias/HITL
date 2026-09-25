# utils.py (LENGKAP DENGAN GPU OPTIMIZATION)
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks
import time
import os
from config import DIR_WEIGHTS, BATCH_SIZE, EPOCHS

# ================================================================
# GPU OPTIMIZATION UNTUK RTX
# ================================================================

def setup_gpu():
    """Konfigurasi GPU untuk performa maksimal di RTX"""
    os.environ['TF_GPU_ALLOCATOR'] = 'cuda_malloc_async'
    all_gpus = tf.config.list_physical_devices('GPU')
    nvidia_gpus = all_gpus
    
    if nvidia_gpus:
        try:
            tf.config.set_visible_devices(nvidia_gpus[0], 'GPU')
            selected_gpu = nvidia_gpus[0]
            
            print(f"\n{'='*50}")
            print(f"GPU OPTIMIZED: {selected_gpu.name}")
            print(f"{'='*50}")
            
            # Set memory growth
            tf.config.experimental.set_memory_growth(selected_gpu, True)
            
            # ✅ Ganti dengan float32 eksplisit
            from tensorflow.keras import mixed_precision
            mixed_precision.set_global_policy('float32')
            
            print(f"\n[OK] Mixed Precision FP16: DISABLED (pakai float32)")
            print(f"[OK] Memory Growth: ENABLED")
            print(f"[OK] Target GPU: LOCKED to Discrete GPU")
            
        except Exception as e:
            print(f"WARN GPU Setup Warning: {e}")
    else:
        print("\nERR: GPU tidak terdeteksi! Fallback ke CPU")
    
    return nvidia_gpus

# Panggil setup di awal
_ = setup_gpu()

def create_dataset(X, y, batch_size, is_training=True, target_size=None, num_channels=1, sobel_edge=False):
    """Membuat tf.data.Dataset yang efisien untuk training tanpa GPU OOM"""
    with tf.device('/CPU:0'):
        dataset = tf.data.Dataset.from_tensor_slices((X, y))
    
    if is_training:
        dataset = dataset.shuffle(buffer_size=2048)
    
    def process_image(image, label):
        # Resize jika diperlukan
        if target_size:
            image = tf.image.resize(image, target_size)
        
        # Tambahkan Sobel edge jika diminta (untuk SketchNN)
        if sobel_edge:
            kx = tf.constant([[-1,0,1],[-2,0,2],[-1,0,1]], dtype=tf.float32)[:,:,tf.newaxis,tf.newaxis]
            ky = tf.constant([[-1,-2,-1],[0,0,0],[1,2,1]], dtype=tf.float32)[:,:,tf.newaxis,tf.newaxis]
            t = tf.cast(image, tf.float32)
            # t shape is (H, W, 1) -> but conv2d needs (1, H, W, 1)
            t_batch = t[tf.newaxis, ...]
            gx = tf.nn.conv2d(t_batch, kx, strides=1, padding='SAME')
            gy = tf.nn.conv2d(t_batch, ky, strides=1, padding='SAME')
            mag = tf.sqrt(gx**2 + gy**2)
            mag = mag / (tf.reduce_max(mag) + 1e-8)
            # Concatenate raw image + edge map
            image = tf.concat([image, mag[0]], axis=-1)
        
        # Konversi ke RGB jika 3 channel diminta (dan bukan SketchNN)
        elif num_channels == 3 and image.shape[-1] == 1:
            image = tf.image.grayscale_to_rgb(image)
            
        return image, label

    dataset = dataset.map(process_image, num_parallel_calls=tf.data.AUTOTUNE)
    dataset = dataset.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return dataset

class ScalarMetricsCallback(keras.callbacks.Callback):
    """Callback untuk memastikan metrik adalah scalar (bukan Tensor) 
    agar tidak error saat serialisasi JSON di TF 2.10."""
    def on_epoch_end(self, epoch, logs=None):
        if logs:
            for k, v in logs.items():
                if hasattr(v, 'numpy'):
                    logs[k] = float(v.numpy())

def get_callbacks(model_name: str):
    """Callbacks standar untuk semua model."""
    save_path = str(DIR_WEIGHTS / f'{model_name}_best.keras')
    return [
        ScalarMetricsCallback(),
        callbacks.ModelCheckpoint(
            save_path, monitor='val_accuracy',
            save_best_only=True, verbose=0
        ),
        callbacks.ReduceLROnPlateau(
            monitor='val_loss', factor=0.5,
            patience=5, min_lr=1e-6, verbose=1
        ),
        callbacks.EarlyStopping(
            monitor='val_accuracy', patience=10,
            restore_best_weights=True, verbose=1
        ),
    ]

def train_and_save(
    model_name: str,
    model: keras.Model,
    X_train, X_val, X_test,
    y_train, y_val, y_test
) -> dict:
    """Training satu model, simpan weights, return hasil evaluasi."""
    # Cek apakah input berupa Dataset atau Numpy
    is_dataset = isinstance(X_train, tf.data.Dataset)

    print(f'\n{"+"*55}')
    print(f'  Training: {model_name}')
    if is_dataset:
        for x, y in X_train.take(1):
            print(f'  Input shape: {x.shape[1:]}')
    else:
        print(f'  Input shape: {X_train.shape[1:]}')
    print(f'  Parameter  : {model.count_params():,}')
    print(f'{"+"*55}')

    t0 = time.time()
    
    # [RESUME LOGIC] Cek apakah ada checkpoint sebelumnya
    latest_path = str(DIR_WEIGHTS / f'{model_name}_latest.keras')
    best_path = str(DIR_WEIGHTS / f'{model_name}_best.keras')
    
    initial_epoch = 0
    checkpoint_to_load = None
    
    if os.path.exists(latest_path):
        checkpoint_to_load = latest_path
        print(f"  [Resume] Menemukan checkpoint terakhir (_latest). Memuat...")
    elif os.path.exists(best_path):
        checkpoint_to_load = best_path
        print(f"  [Resume] Menemukan model terbaik (_best). Memuat sebagai titik mulai...")

    if checkpoint_to_load:
        try:
            model = keras.models.load_model(checkpoint_to_load)
            print(f"  [Resume] Berhasil memuat {os.path.basename(checkpoint_to_load)}. Melanjutkan...")
        except Exception as e:
            print(f"  [Resume] Gagal memuat ({e}). Mulai dari awal.")

    # Update callbacks untuk simpan 'latest' juga setiap epoch
    all_callbacks = get_callbacks(model_name)
    all_callbacks.append(
        callbacks.ModelCheckpoint(latest_path, save_best_only=False, verbose=0)
    )

    fit_args = {
        'epochs': EPOCHS,
        'validation_data': (X_val, y_val) if not is_dataset else X_val,
        'callbacks': all_callbacks,
        'initial_epoch': initial_epoch,
        'verbose': 1
    }
    
    if not is_dataset:
        fit_args['batch_size'] = BATCH_SIZE

    history = model.fit(X_train, y_train if not is_dataset else None, **fit_args)

    elapsed = (time.time() - t0) / 60

    # Load best checkpoint
    best = keras.models.load_model(
            str(DIR_WEIGHTS / f'{model_name}_best.keras'),
                safe_mode=False
                )

    # Evaluasi di test set
    loss, acc, top3 = best.evaluate(X_test, y_test, verbose=0)

    # Simpan weights.h5
    weights_path = str(DIR_WEIGHTS / f'{model_name}.weights.h5')
    best.save_weights(weights_path)

    print(f'\n  [OK] {model_name} selesai!')
    print(f'     Test Accuracy : {acc*100:.2f}%')
    print(f'     Top-3 Accuracy: {top3*100:.2f}%')
    print(f'     Waktu training: {elapsed:.1f} menit')
    print(f'     Weights saved : weights/{model_name}.weights.h5')

    return {
        'name': model_name,
        'history': history,
        'acc': acc,
        'top3': top3,
        'loss': loss,
        'minutes': elapsed,
        'params': model.count_params(),
    }

# Augmentasi ringan
augmentation = keras.Sequential([
    layers.RandomRotation(0.10),
    layers.RandomZoom(0.10),
    layers.RandomTranslation(0.10, 0.10),
], name='augmentation')