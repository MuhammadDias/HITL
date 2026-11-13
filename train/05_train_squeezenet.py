# 05_train_squeezenet.py
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from config import NUM_CLASSES, DIR_DATA, BATCH_SIZE
from utils import train_and_save, create_dataset

# ==== GPU 2GB SAFE ====
gpus = tf.config.list_physical_devices('GPU')
if gpus:
    try:
        tf.config.experimental.set_memory_growth(gpus[0], True)
    except:
        pass

# ==== AUGMENT (ringan tapi ngaruh) ====
augmentation = keras.Sequential([
    layers.RandomRotation(0.08),
    layers.RandomZoom(0.1),
    layers.RandomTranslation(0.08, 0.08),
])

def fire_module(x, squeeze, expand, name):
    sq = layers.Conv2D(squeeze, 1, activation='relu', padding='same', name=f'{name}_sq')(x)
    ex1 = layers.Conv2D(expand, 1, activation='relu', padding='same', name=f'{name}_ex1')(sq)
    ex3 = layers.Conv2D(expand, 3, activation='relu', padding='same', name=f'{name}_ex3')(sq)
    return layers.Concatenate(name=f'{name}_cat')([ex1, ex3])

def build_model():
    inputs = keras.Input(shape=(64, 64, 3), name='input')
    x = augmentation(inputs)

    x = layers.Conv2D(32, 3, strides=2, padding='same', use_bias=False)(x)
    x = layers.BatchNormalization()(x)
    x = layers.Activation('relu')(x)
    x = layers.MaxPooling2D(2)(x)

    x = fire_module(x, 8, 32, 'fire2')
    x = fire_module(x, 8, 32, 'fire3')
    x = layers.MaxPooling2D(2)(x)

    x = fire_module(x, 16, 64, 'fire4')
    x = fire_module(x, 16, 64, 'fire5')
    x = layers.Dropout(0.25)(x)   # ↓ dikit biar ga buang info

    x = fire_module(x, 32, 128, 'fire6')

    # FIX penting: BN sebelum classifier
    x = layers.BatchNormalization()(x)

    x = layers.Conv2D(NUM_CLASSES, 1, use_bias=False)(x)  # no relu
    x = layers.GlobalAveragePooling2D()(x)

    out = layers.Activation('softmax', name='output')(x)

    m = keras.Model(inputs, out, name='Model3_SqueezeNet')

    m.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),
        metrics=[
            'accuracy',
            keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc')
        ]
    )
    return m

def main():
    data = np.load(DIR_DATA / 'processed_data.npz')

    ds_train = create_dataset(data['X_train'], data['y_train'], BATCH_SIZE,
                              target_size=(64, 64), num_channels=3)
    ds_val = create_dataset(data['X_val'], data['y_val'], BATCH_SIZE, is_training=False,
                            target_size=(64, 64), num_channels=3)
    ds_test = create_dataset(data['X_test'], data['y_test'], BATCH_SIZE, is_training=False,
                             target_size=(64, 64), num_channels=3)

    result = train_and_save(
        model_name='model_3_squeezenet',
        model=build_model(),
        X_train=ds_train, X_val=ds_val, X_test=ds_test,
        y_train=None, y_val=None, y_test=None
    )

    print(f"\n🏆 SqueezeNet Final Accuracy: {result['acc']*100:.2f}%")

if __name__ == '__main__':
    main()