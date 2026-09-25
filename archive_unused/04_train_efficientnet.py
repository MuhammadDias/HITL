# 04_train_efficientnet.py
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.applications import EfficientNetB0
from config import NUM_CLASSES, DIR_DATA, BATCH_SIZE
from utils import train_and_save, create_dataset


def build_model():
    inputs = keras.Input(shape=(96, 96, 3), name='input')
    
    base = EfficientNetB0(
        include_top=False, weights='imagenet',
        input_tensor=inputs, pooling='avg'
    )
    base.trainable = True  # freeze backbone
    
    x = base.output
    x = layers.Dense(256, activation='relu')(x)
    x = layers.BatchNormalization()(x)
    x = layers.Dropout(0.4)(x)
    out = layers.Dense(NUM_CLASSES, activation='softmax', name='output')(x)
    
    m = keras.Model(inputs, out, name='Model2_EfficientNetB0')
    m.compile(
        optimizer=keras.optimizers.Adam(1e-4),
        loss='categorical_crossentropy',
        metrics=['accuracy', keras.metrics.TopKCategoricalAccuracy(k=3, name='top3_acc')]
    )
    return m

def main():
    data = np.load(DIR_DATA / 'processed_data.npz')
    
    # Buat dataset dengan resize on-the-fly (hemat RAM)
    ds_train = create_dataset(data['X_train'], data['y_train'], BATCH_SIZE, 
                              target_size=(96, 96), num_channels=3)
    ds_val = create_dataset(data['X_val'], data['y_val'], BATCH_SIZE, is_training=False,
                            target_size=(96, 96), num_channels=3)
    ds_test = create_dataset(data['X_test'], data['y_test'], BATCH_SIZE, is_training=False,
                             target_size=(96, 96), num_channels=3)
    
    result = train_and_save(
        model_name='model_2_efficientnet',
        model=build_model(),
        X_train=ds_train, X_val=ds_val, X_test=ds_test,
        y_train=None, y_val=None, y_test=None
    )
    
    print(f"\n🏆 EfficientNet-B0 Final Accuracy: {result['acc']*100:.2f}%")

if __name__ == '__main__':
    main()