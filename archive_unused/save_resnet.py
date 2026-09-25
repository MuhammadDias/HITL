from tensorflow import keras

m = keras.models.load_model('weights/model_5_resnet18_best.keras')
m.save_weights('weights/model_5_resnet18.weights.h5')
print('✅ Berhasil!')
