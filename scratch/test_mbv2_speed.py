import time
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2

print("GPUs:", tf.config.list_physical_devices('GPU'))
for gpu in tf.config.list_physical_devices('GPU'):
    tf.config.experimental.set_memory_growth(gpu, True)

# Create dummy dataset of 1000 images (28, 28, 1)
X_dummy = np.random.rand(1000, 28, 28, 1).astype('float32')
y_dummy = keras.utils.to_categorical(np.random.randint(0, 20, size=1000), 20)

ds = tf.data.Dataset.from_tensor_slices((X_dummy, y_dummy)).batch(64).prefetch(tf.data.AUTOTUNE)

def test_model(use_aug_in_model=True):
    inputs = keras.Input(shape=(28, 28, 1))
    x = layers.Concatenate()([inputs, inputs, inputs])
    x = layers.Resizing(96, 96, interpolation='bilinear')(x)
    if use_aug_in_model:
        x = layers.RandomRotation(0.08)(x)
        x = layers.RandomTranslation(0.08, 0.08)(x)
    x = keras.applications.mobilenet_v2.preprocess_input(x * 255.0)

    base = MobileNetV2(include_top=False, weights=None, input_tensor=x, alpha=0.75)
    base.trainable = True

    x = base.output
    x = layers.GlobalAveragePooling2D()(x)
    out = layers.Dense(20, activation='softmax')(x)

    model = keras.Model(inputs, out)
    model.compile(optimizer='adam', loss='categorical_crossentropy', metrics=['accuracy'])
    
    t0 = time.time()
    model.fit(ds, epochs=1, verbose=1)
    t1 = time.time()
    print(f"Done in {t1-t0:.2f}s")

print("--- Test with Aug in model ---")
test_model(use_aug_in_model=True)

print("--- Test WITHOUT Aug in model ---")
test_model(use_aug_in_model=False)
