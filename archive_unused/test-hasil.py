import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2
from pathlib import Path
from config import DIR_DATA, NUM_CLASSES

# ── SliceChannel untuk SketchNN ──────────────────────────────
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

# ── Fire module untuk SqueezeNet ─────────────────────────────
def fire_module(x, squeeze, expand, name):
    sq  = layers.Conv2D(squeeze, 1, activation='relu', padding='same', name=f'{name}_sq')(x)
    ex1 = layers.Conv2D(expand,  1, activation='relu', padding='same', name=f'{name}_ex1')(sq)
    ex3 = layers.Conv2D(expand,  3, activation='relu', padding='same', name=f'{name}_ex3')(sq)
    return layers.Concatenate(name=f'{name}_cat')([ex1, ex3])

def build_squeezenet():
    inputs = keras.Input(shape=(64, 64, 3), name='input')
    x = layers.Conv2D(32, 3, strides=2, activation='relu', padding='same')(inputs)
    x = layers.MaxPooling2D(2)(x)
    x = layers.BatchNormalization()(x)
    x = fire_module(x, 8,  32,  'fire2')
    x = fire_module(x, 8,  32,  'fire3')
    x = layers.MaxPooling2D(2)(x)
    x = fire_module(x, 16, 64,  'fire4')
    x = fire_module(x, 16, 64,  'fire5')
    x = layers.Dropout(0.3)(x)
    x = fire_module(x, 32, 128, 'fire6')
    x = layers.Conv2D(NUM_CLASSES, 1, activation='relu')(x)
    x = layers.GlobalAveragePooling2D()(x)
    out = layers.Activation('softmax', name='output')(x)
    m = keras.Model(inputs, out, name='Model3_SqueezeNet')
    m.compile(optimizer='adam', loss='categorical_crossentropy',
              metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc')])
    return m

def build_mobilenetv2():
    inputs = keras.Input(shape=(96, 96, 3), name='input')
    x    = keras.applications.mobilenet_v2.preprocess_input(inputs * 255.0)
    base = MobileNetV2(include_top=False, weights='imagenet', input_tensor=x, alpha=0.5)
    base.trainable = False
    x   = base.output
    x   = layers.GlobalAveragePooling2D()(x)
    x   = layers.Dense(128, activation='relu')(x)
    x   = layers.Dropout(0.3)(x)
    out = layers.Dense(NUM_CLASSES, activation='softmax', name='output')(x)
    m   = keras.Model(inputs, out, name='Model4_MobileNetV2')
    m.compile(optimizer='adam', loss='categorical_crossentropy',
              metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc')])
    return m

# ── Load data test ────────────────────────────────────────────
data   = np.load(DIR_DATA / 'processed_data.npz')
X_test = data['X_test']
y_test = data['y_test']

DIR_WEIGHTS = Path('weights')

print('\n' + '='*50)
print('  CEK AKURASI SEMUA MODEL')
print('='*50 + '\n')

# ── Model 1: Custom CNN ──────────────────────────────────────
try:
    m = keras.models.load_model(str(DIR_WEIGHTS / 'model_1_custom_cnn_best.keras'))
    X = tf.image.resize(X_test, [28, 28]).numpy()
    _, acc, top3 = m.evaluate(X, y_test, verbose=0)
    print(f'✅ [1] Custom CNN    : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')
except Exception as e:
    print(f'⚠️  [1] Custom CNN    : {e}')

# ── Model 2: EfficientNet ────────────────────────────────────
try:
    m = keras.models.load_model(str(DIR_WEIGHTS / 'model_2_efficientnet_best.keras'))
    X = tf.image.resize(X_test, [224, 224]).numpy()
    X = tf.image.grayscale_to_rgb(tf.constant(X)).numpy()
    _, acc, top3 = m.evaluate(X, y_test, verbose=0)
    print(f'✅ [2] EfficientNet  : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')
except Exception as e:
    print(f'⚠️  [2] EfficientNet  : {e}')

# ── Model 3: SqueezeNet (dari weights.h5) ────────────────────
try:
    m = build_squeezenet()
    m.load_weights(str(DIR_WEIGHTS / 'model_3_squeezenet.weights.h5'))
    X = tf.image.resize(X_test, [64, 64]).numpy()
    X = tf.image.grayscale_to_rgb(tf.constant(X)).numpy()
    _, acc, top3 = m.evaluate(X, y_test, verbose=0)
    print(f'✅ [3] SqueezeNet    : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')
except Exception as e:
    print(f'⚠️  [3] SqueezeNet    : {e}')

# ── Model 4: MobileNetV2 (dari weights.h5) ───────────────────
try:
    m = build_mobilenetv2()
    m.load_weights(str(DIR_WEIGHTS / 'model_4_mobilenetv2.weights.h5'))
    X = tf.image.resize(X_test, [96, 96]).numpy()
    X = tf.image.grayscale_to_rgb(tf.constant(X)).numpy()
    _, acc, top3 = m.evaluate(X, y_test, verbose=0)
    print(f'✅ [4] MobileNetV2   : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')
except Exception as e:
    print(f'⚠️  [4] MobileNetV2   : {e}')

# ── Model 5: ResNet-18 ───────────────────────────────────────
try:
    m = keras.models.load_model(str(DIR_WEIGHTS / 'model_5_resnet18_best.keras'))
    X = tf.image.resize(X_test, [56, 56]).numpy()
    _, acc, top3 = m.evaluate(X, y_test, verbose=0)
    print(f'✅ [5] ResNet-18     : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')
except Exception as e:
    print(f'⚠️  [5] ResNet-18     : {e}')

# ── Model 6: SketchNN ────────────────────────────────────────
try:
    m = keras.models.load_model(
        str(DIR_WEIGHTS / 'model_6_sketchnn_best.keras'),
        safe_mode=False
    )
    from utils import create_dataset
    ds = create_dataset(X_test, y_test, 256, is_training=False, sobel_edge=True)
    _, acc, top3 = m.evaluate(ds, verbose=0)
    print(f'✅ [6] SketchNN      : {acc*100:.2f}%  (top3: {top3*100:.2f}%)')
except Exception as e:
    print(f'⚠️  [6] SketchNN      : {e}')

print('\n' + '='*50)