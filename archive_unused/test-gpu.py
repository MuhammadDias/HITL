# cek_gpu.py
import subprocess
import os

# Kosongkan semua env variable TF dulu
for key in list(os.environ.keys()):
    if 'TF' in key or 'CUDA' in key:
        del os.environ[key]

import tensorflow as tf

print("=== DIAGNOSTIK GPU ===")
print(f"TF version: {tf.__version__}")

gpus = tf.config.list_physical_devices('GPU')
print(f"GPU terdeteksi: {gpus}")

if gpus:
    for gpu in gpus:
        tf.config.experimental.set_memory_growth(gpu, True)
    
    details = tf.config.experimental.get_device_details(gpus[0])
    print(f"Detail GPU: {details}")

# Cek berapa VRAM yang TF lihat
with tf.device('/GPU:0'):
    # Coba alokasi tensor besar bertahap
    success_mb = 0
    for mb in [256, 512, 1024, 1500, 2000, 2500, 3000, 3500]:
        try:
            t = tf.Variable(tf.zeros([mb * 1024 * 1024 // 4], dtype=tf.float32))
            del t
            success_mb = mb
            print(f"  ✅ Berhasil alokasi {mb} MB")
        except Exception as e:
            print(f"  ❌ Gagal di {mb} MB: {e}")
            break

print(f"\nMaximum VRAM yang bisa diakses TF: ~{success_mb} MB")