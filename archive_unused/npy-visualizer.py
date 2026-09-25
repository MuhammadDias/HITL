import numpy as np
import matplotlib.pyplot as plt

data_coretan = np.load('/home/asus/project/test training/data/airplane.npy')

# Menyimpan 5 gambar pertama menjadi file PNG terpisah
for i in range(5):
    gambar = data_coretan[i].reshape(28, 28)
    plt.imsave(f'pesawat_{i}.png', gambar, cmap='gray_r')

print("5 File gambar PNG berhasil disimpan di folder projek Anda!")
