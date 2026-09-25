import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from config import NUM_CLASSES, LEARNING_RATE, DIR_DATA, BATCH_SIZE
from utils import train_and_save, create_dataset


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


def build_model():
    inputs = keras.Input(shape=(28, 28, 2), name='dual_input')

    raw  = SliceChannel(0)(inputs)
    edge = SliceChannel(1)(inputs)

    def branch(t, prefix):
        t = layers.Conv2D(32, 3, padding='same', use_bias=False)(t)
        t = layers.BatchNormalization()(t)
        t = layers.Activation('relu')(t)
        t = layers.MaxPooling2D(2)(t)

        t = layers.Conv2D(64, 3, padding='same', use_bias=False)(t)
        t = layers.BatchNormalization()(t)
        t = layers.Activation('relu')(t)

        t = layers.GlobalAveragePooling2D()(t)
        t = layers.BatchNormalization()(t)   # FIX: stabilin tiap branch
        return t

    r = branch(raw, 'raw')
    e = branch(edge, 'edge')

    # FIX: balance contribution biar edge ga overpower
    r = layers.Dense(64, activation='relu')(r)
    e = layers.Dense(64, activation='relu')(e)

    x = layers.Concatenate()([r, e])

    x = layers.Dense(128, use_bias=False)(x)
    x = layers.BatchNormalization()(x)      # FIX penting
    x = layers.Activation('relu')(x)
    x = layers.Dropout(0.4)(x)

    out = layers.Dense(NUM_CLASSES, activation='softmax')(x)

    m = keras.Model(inputs, out, name='Model6_SketchNN')

    m.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),  # lebih responsif
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.1),  # anti sok yakin
        metrics=[
            'accuracy',
            keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc')
        ]
    )
    return m


def main():
    data = np.load(DIR_DATA / 'processed_data.npz')

    ds_train = create_dataset(data['X_train'], data['y_train'], BATCH_SIZE, sobel_edge=True)
    ds_val   = create_dataset(data['X_val'],   data['y_val'],   BATCH_SIZE, is_training=False, sobel_edge=True)
    ds_test  = create_dataset(data['X_test'],  data['y_test'],  BATCH_SIZE, is_training=False, sobel_edge=True)

    result = train_and_save(
        model_name='model_6_sketchnn',
        model=build_model(),
        X_train=ds_train, X_val=ds_val, X_test=ds_test,
        y_train=None, y_val=None, y_test=None
    )

    print(f"\n🏆 SketchNN Final Accuracy: {result['acc']*100:.2f}%")


if __name__ == '__main__':
    main()