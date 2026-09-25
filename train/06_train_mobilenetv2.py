# 06_train_mobilenetv2.py
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2
from config import NUM_CLASSES, DIR_DATA, BATCH_SIZE
from utils import train_and_save, create_dataset


def build_model():
    inputs = keras.Input(shape=(28, 28, 1), name='input')
    
    # 1. Grayscale 1 channel -> RGB 3 channel di GPU
    x = layers.Concatenate()([inputs, inputs, inputs])
    
    # 2. Resize 28x28 -> 96x96 di GPU (Bilinear)
    x = layers.Resizing(96, 96, interpolation='bilinear')(x)
    
    # 3. Data Augmentation di GPU
    x = layers.RandomRotation(0.08)(x)
    x = layers.RandomTranslation(0.08, 0.08)(x)
    x = layers.RandomZoom(0.08)(x)
    
    # 4. Preprocessing MobileNetV2
    x = keras.applications.mobilenet_v2.preprocess_input(x * 255.0)

    base = MobileNetV2(
        include_top=False, weights='imagenet',
        input_tensor=x, alpha=0.75
    )
    base.trainable = True

    x = base.output
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(128, activation='relu')(x)
    x = layers.Dropout(0.3)(x)
    out = layers.Dense(NUM_CLASSES, activation='softmax', name='output')(x)

    m = keras.Model(inputs, out, name='Model4_MobileNetV2')
    m.compile(
        optimizer=keras.optimizers.Adam(1e-4),
        loss=keras.losses.CategoricalCrossentropy(label_smoothing=0.05),
        metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc')]
    )
    return m

def main():
    data = np.load(DIR_DATA / 'processed_data.npz')
    
    # Buat dataset (28x28x1 murni di RAM CPU, diproses sangat cepat)
    ds_train = create_dataset(data['X_train'], data['y_train'], BATCH_SIZE, is_training=True)
    ds_val = create_dataset(data['X_val'], data['y_val'], BATCH_SIZE, is_training=False)
    ds_test = create_dataset(data['X_test'], data['y_test'], BATCH_SIZE, is_training=False)
    
    result = train_and_save(
        model_name='model_4_mobilenetv2',
        model=build_model(),
        X_train=ds_train, X_val=ds_val, X_test=ds_test,
        y_train=None, y_val=None, y_test=None
    )
    
    print(f"\n🏆 MobileNetV2 Final Accuracy: {result['acc']*100:.2f}%")

if __name__ == '__main__':
    main()