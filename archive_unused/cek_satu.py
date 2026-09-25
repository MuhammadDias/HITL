import sys
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2
from pathlib import Path
from config import DIR_DATA, NUM_CLASSES

model_num = sys.argv[1] if len(sys.argv) > 1 else '1'

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

def fire_module(x, squeeze, expand, name):
    sq  = layers.Conv2D(squeeze, 1, activation='relu', padding='same', name=f'{name}_sq')(x)
    ex1 = layers.Conv2D(expand,  1, activation='relu', padding='same', name=f'{name}_ex1')(sq)
    ex3 = layers.Conv2D(expand,  3, activation='relu', padding='same', name=f'{name}_ex3')(sq)
    return layers.Concatenate(name=f'{name}_cat')([ex1, ex3])

def build_squeezenet():
    inp = keras.Input(shape=(64, 64, 3))
    x   = layers.Conv2D(32, 3, strides=2, activation='relu', padding='same')(inp)
    x   = layers.MaxPooling2D(2)(x)
    x   = layers.BatchNormalization()(x)
    x   = fire_module(x, 8,  32,  'fire2')
    x   = fire_module(x, 8,  32,  'fire3')
    x   = layers.MaxPooling2D(2)(x)
    x   = fire_module(x, 16, 64,  'fire4')
    x   = fire_module(x, 16, 64,  'fire5')
    x   = layers.Dropout(0.3)(x)
    x   = fire_module(x, 32, 128, 'fire6')
    x   = layers.Conv2D(NUM_CLASSES, 1, activation='relu')(x)
    x   = layers.GlobalAveragePooling2D()(x)
    out = layers.Activation('softmax')(x)
    return keras.Model(inp, out)

def build_mobilenetv2():
    inp  = keras.Input(shape=(96, 96, 3))
    x    = keras.applications.mobilenet_v2.preprocess_input(inp * 255.0)
    base = MobileNetV2(include_top=False, weights='imagenet', input_tensor=x, alpha=0.5)
    base.trainable = False
    x    = base.output
    x    = layers.GlobalAveragePooling2D()(x)
    x    = layers.Dense(128, activation='relu')(x)
    x    = layers.Dropout(0.3)(x)
    out  = layers.Dense(NUM_CLASSES, activation='softmax')(x)
    return keras.Model(inp, out)

DIR_WEIGHTS = Path('weights')
data        = np.load(DIR_DATA / 'processed_data.npz')
X_test      = data['X_test'][:5000]
y_test      = data['y_test'][:5000]
print(f'Test samples: {len(X_test)}')

if model_num == '1':
    m = keras.models.load_model(str(DIR_WEIGHTS / 'model_1_custom_cnn_best.keras'))
    X = tf.image.resize(X_test, [28, 28]).numpy()
    _, acc, top3 = m.evaluate(X, y_test, batch_size=64, verbose=1)
    print(f'✅ [1] Custom CNN   : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')

elif model_num == '2':
    m = keras.models.load_model(str(DIR_WEIGHTS / 'model_2_efficientnet_best.keras'))
    X = tf.image.resize(X_test, [96, 96]).numpy()
    X = tf.image.grayscale_to_rgb(tf.constant(X)).numpy()
    _, acc, top3 = m.evaluate(X, y_test, batch_size=32, verbose=1)
    print(f'✅ [2] EfficientNet : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')

elif model_num == '3':
    m = keras.models.load_model(
        str(DIR_WEIGHTS / 'model_3_squeezenet_best.keras')
    )
    X = tf.image.resize(X_test, [64, 64]).numpy()
    X = tf.image.grayscale_to_rgb(tf.constant(X)).numpy()
    _, acc, top3 = m.evaluate(X, y_test, batch_size=64, verbose=1)
    print(f'✅ [3] SqueezeNet   : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')

elif model_num == '4':
    m = keras.models.load_model(
        str(DIR_WEIGHTS / 'model_4_mobilenetv2_best.keras')
    )
    X = tf.image.resize(X_test, [96, 96]).numpy()
    X = tf.image.grayscale_to_rgb(tf.constant(X)).numpy()
    _, acc, top3 = m.evaluate(X, y_test, batch_size=64, verbose=1)
    print(f'✅ [4] MobileNetV2  : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')

elif model_num == '5':
    m = keras.models.load_model(str(DIR_WEIGHTS / 'model_5_resnet18_best.keras'))
    X = tf.image.resize(X_test, [56, 56]).numpy()
    _, acc, top3 = m.evaluate(X, y_test, batch_size=64, verbose=1)
    print(f'✅ [5] ResNet-18    : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')

elif model_num == '6':
    m = keras.models.load_model(
        str(DIR_WEIGHTS / 'model_6_sketchnn_best.keras'),
        safe_mode=False
    )
    from utils import create_dataset
    ds = create_dataset(X_test, y_test, 64, is_training=False, sobel_edge=True)
    _, acc, top3 = m.evaluate(ds, verbose=1)
    print(f'✅ [6] SketchNN     : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')
