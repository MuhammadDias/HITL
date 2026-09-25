# 03_train_custom_cnn.py
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from config import NUM_CLASSES, LEARNING_RATE, DIR_DATA, BATCH_SIZE
from utils import train_and_save, create_dataset

# ================= GPU LIMIT (WAJIB BUAT 2GB) =================
gpus = tf.config.list_physical_devices('GPU')
if gpus:
    try:
        tf.config.experimental.set_memory_growth(gpus[0], True)
    except:
        pass

# ================= AUGMENTATION (UPGRADE) =================
augmentation = keras.Sequential([
    layers.RandomRotation(0.15),
    layers.RandomZoom(0.15),
    layers.RandomTranslation(0.1, 0.1),
])

# ================= MODEL =================
def build_model():
    inputs = keras.Input(shape=(28, 28, 1), name='input')
    
    # Augmentasi langsung sebagai layer
    x = layers.RandomRotation(0.15)(inputs)
    x = layers.RandomZoom(0.15)(x)
    x = layers.RandomTranslation(0.1, 0.1)(x)

    # Conv Block 1
    x = layers.Conv2D(32, 3, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)
    x = layers.MaxPooling2D(2)(x)
    x = layers.Dropout(0.15)(x)

    # Conv Block 2
    x = layers.Conv2D(64, 3, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)
    x = layers.MaxPooling2D(2)(x)
    x = layers.Dropout(0.15)(x)

    # Conv Block 3
    x = layers.Conv2D(128, 3, padding='same')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)
    x = layers.Dropout(0.2)(x)

    # Head
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(128)(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)
    x = layers.Dropout(0.3)(x)

    out = layers.Dense(NUM_CLASSES, activation='softmax')(x)

    model = keras.Model(inputs, out, name='Model1_CustomCNN')

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-4),
        loss=keras.losses.SparseCategoricalCrossentropy(),
        metrics=[
            'accuracy',
            keras.metrics.SparseTopKCategoricalAccuracy(k=3, name='top3_acc')
        ]
    )

    return model

# ================= MAIN =================
def main():
    data = np.load(DIR_DATA / 'processed_data.npz')

    ds_train = create_dataset(data['X_train'], data['y_train'], BATCH_SIZE)
    ds_val   = create_dataset(data['X_val'], data['y_val'], BATCH_SIZE, is_training=False)
    ds_test  = create_dataset(data['X_test'], data['y_test'], BATCH_SIZE, is_training=False)

    # Callbacks
    early_stop = keras.callbacks.EarlyStopping(
        monitor='val_loss',
        patience=10,
        restore_best_weights=True,
        mode='min'
    )
    reduce_lr = keras.callbacks.ReduceLROnPlateau(
        monitor='val_loss',
        factor=0.5,
        patience=5,
        min_lr=1e-6
    )

    result = train_and_save(
        model_name='model_1_custom_cnn',
        model=build_model(),
        X_train=ds_train,
        X_val=ds_val,
        X_test=ds_test,
        y_train=None,
        y_val=None,
        y_test=None,
        callbacks=[early_stop, reduce_lr],
        epochs=50
    )

    print(f"\n🏆 Custom CNN Final Accuracy: {result['acc']*100:.2f}%")

if __name__ == '__main__':
    main()