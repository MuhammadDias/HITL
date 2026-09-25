import numpy as np
import matplotlib.pyplot as plt

# 1. Buka file .npy yang sudah diunduh (contoh: pizza.npy)
# Ganti nama file sesuai dengan file yang Anda unduh
# Ganti baris 6 pada file open-npy.py Anda menjadi seperti ini:
data_coretan = np.load('/home/asus/project/test training/data/house.npy')

# 2. Lihat dimensi data (Jumlah gambar, Jumlah piksel)
print("Ukuran dataset:", data_coretan.shape) 
# Outputnya akan terlihat seperti: (130371, 784) 
# Artinya ada sekitar 130 ribu gambar pizza, masing-masing 784 piksel.
# Mengambil gambar pertama (indeks 0) dan mengubahnya ke matriks 28x28
matriks_pisang = data_coretan[0].reshape(28, 28)

# Cetak angka mentahnya ke terminal
print(matriks_pisang)

# 3. Ambil salah satu gambar (misal gambar indeks ke-0)
# Kita harus mengubah ukurannya (reshape) dari 1D (784) menjadi 2D (28x28)
gambar_single = data_coretan[0].reshape(28, 28)

# 4. Tampilkan gambar ke layar
plt.imshow(gambar_single, cmap='gray')
plt.title("Isi File NPY Quick Draw")
plt.axis('off') # Menghilangkan sumbu koordinat
plt.show()
