# 07_train_resnet18.py
import numpy as np
import os
import tensorflow as tf

# ── WAJIB: aktifkan sebelum import keras ─────────────────────
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'  # matikan oneDNN yang bermasalah

gpus = tf.config.list_physical_devices('GPU')
if gpus:
    for gpu in gpus:
        tf.config.experimental.set_memory_growth(gpu, True)
    print(f'✅ Memory growth aktif — GPU: {gpus[0].name}')

from tensorflow import keras
from tensorflow.keras import layers
from config import NUM_CLASSES, LEARNING_RATE, DIR_DATA, BATCH_SIZE
from utils import train_and_save, augmentation, create_dataset


def residual_block(x, filters, stride=1, name='res'):
    """
    Basic Residual Block — versi fix.
    
    Perubahan dari versi sebelumnya:
    - BN tidak di-share antar path (setiap BN punya nama unik eksplisit)
    - Struktur pre-activation lebih clean
    """
    shortcut = x

    # Conv path
    x = layers.Conv2D(
        filters, 3, strides=stride, padding='same',
        use_bias=False, name=f'{name}_c1'
    )(x)
    x = layers.BatchNormalization(name=f'{name}_bn1')(x)
    x = layers.Activation('relu', name=f'{name}_act1')(x)

    x = layers.Conv2D(
        filters, 3, strides=1, padding='same',
        use_bias=False, name=f'{name}_c2'
    )(x)
    x = layers.BatchNormalization(name=f'{name}_bn2')(x)

    # Shortcut projection jika dimensi berubah
    if stride != 1 or shortcut.shape[-1] != filters:
        shortcut = layers.Conv2D(
            filters, 1, strides=stride,
            use_bias=False, name=f'{name}_proj_c'
        )(shortcut)
        shortcut = layers.BatchNormalization(
            name=f'{name}_proj_bn'
        )(shortcut)

    # Add + aktivasi akhir
    x = layers.Add(name=f'{name}_add')([x, shortcut])
    x = layers.Activation('relu', name=f'{name}_act2')(x)
    return x


def build_model():
    inputs = keras.Input(shape=(224, 224, 3), name='input')
    x = augmentation(inputs)

    x = layers.Conv2D(32, 3, padding='same', use_bias=False, name='stem_c')(x)
    x = layers.BatchNormalization(name='stem_bn')(x)
    x = layers.Activation('relu', name='stem_act')(x)

    x = residual_block(x, 32, 1, 'l1a')
    x = residual_block(x, 32, 1, 'l1b')

    x = residual_block(x, 64, 2, 'l2a')
    x = residual_block(x, 64, 1, 'l2b')

    x = residual_block(x, 128, 2, 'l3a')
    x = residual_block(x, 128, 1, 'l3b')

    x = residual_block(x, 128, 2, 'l4a')
    x = residual_block(x, 128, 1, 'l4b')

    # ===== FIX DI SINI =====
    x = layers.GlobalAveragePooling2D(name='gap')(x)
    x = layers.BatchNormalization(name='head_bn')(x)   # tambah ini
    x = layers.Dropout(0.4, name='dropout')(x)

    out = layers.Dense(
        NUM_CLASSES,
        activation='softmax',
        dtype='float32',
        name='output'
    )(x)

    m = keras.Model(inputs, out, name='Model5_ResNet18')

    m.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),  # dari LEARNING_RATE → lebih responsif
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),  # ini penting banget
        metrics=[
            'accuracy',
            keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc')
        ]
    )
    return m


def main():
    data = np.load(DIR_DATA / 'processed_data.npz')

    ds_train = create_dataset(
        data['X_train'], data['y_train'],
        BATCH_SIZE, target_size=(56, 56)
    )
    ds_val = create_dataset(
        data['X_val'], data['y_val'],
        BATCH_SIZE, is_training=False, target_size=(56, 56)
    )
    ds_test = create_dataset(
        data['X_test'], data['y_test'],
        BATCH_SIZE, is_training=False, target_size=(56, 56)
    )

    model = build_model()
    total = model.count_params()
    print(f'Parameter : {total:,}')
    print(f'Estimasi ukuran: ~{total*4/1024/1024:.1f} MB')

    result = train_and_save(
        model_name='model_5_resnet18',
        model=model,
        X_train=ds_train, X_val=ds_val, X_test=ds_test,
        y_train=None, y_val=None, y_test=None
    )

    print(f"\n🏆 ResNet-18 Final Accuracy: {result['acc']*100:.2f}%")


if __name__ == '__main__':
    main()