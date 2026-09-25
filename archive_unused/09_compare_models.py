# 09_compare_models.py
import numpy as np
import matplotlib.pyplot as plt
from config import DIR_WEIGHTS, DIR_OUTPUT

def main():
    """Baca semua hasil training dari weights folder"""
    # Hasil manual (atau bisa load dari file JSON jika disimpan)
    # Ini contoh data, ganti dengan hasil training sebenarnya
    results = {
        'model_1_custom_cnn': {'name': 'Custom CNN', 'acc': 0.92, 'top3': 0.97, 'params': 450000, 'minutes': 15.2},
        'model_2_efficientnet': {'name': 'EfficientNet-B0', 'acc': 0.88, 'top3': 0.95, 'params': 4200000, 'minutes': 20.5},
        'model_3_squeezenet': {'name': 'SqueezeNet', 'acc': 0.85, 'top3': 0.93, 'params': 1200000, 'minutes': 10.8},
        'model_4_mobilenetv2': {'name': 'MobileNetV2', 'acc': 0.78, 'top3': 0.89, 'params': 2300000, 'minutes': 15.5},
        'model_5_resnet18': {'name': 'ResNet-18', 'acc': 0.82, 'top3': 0.91, 'params': 11000000, 'minutes': 18.2},
        'model_6_sketchnn': {'name': 'SketchNN', 'acc': 0.86, 'top3': 0.94, 'params': 680000, 'minutes': 16.5},
    }
    
    print('\n' + '='*65)
    print('  PERBANDINGAN AKURASI SEMUA MODEL')
    print('='*65)
    print(f'  {"No":<4} {"Model":<26} {"Accuracy":>10} {"Top-3":>10} {"Params":>12} {"Menit":>7}')
    print(f'  {"-"*62}')
    
    for i, (key, r) in enumerate(results.items(), 1):
        print(
            f'  {i:<4} {r["name"]:<26} '
            f'{r["acc"]*100:>9.2f}% '
            f'{r["top3"]*100:>9.2f}% '
            f'{r["params"]:>12,} '
            f'{r["minutes"]:>6.1f}m'
        )
    
    best_key = max(results, key=lambda k: results[k]['acc'])
    print(f'  {"-"*62}')
    print(f'  🏆 Model terbaik: {results[best_key]["name"]} '
          f'({results[best_key]["acc"]*100:.2f}%)')
    print('='*65)
    
    # Bar chart perbandingan
    names = [r['name'].replace(' ', '\n') for r in results.values()]
    accs = [r['acc']*100 for r in results.values()]
    top3s = [r['top3']*100 for r in results.values()]
    
    x = np.arange(len(names))
    fig, ax = plt.subplots(figsize=(14, 6))
    b1 = ax.bar(x - 0.2, accs, 0.35, label='Top-1 Accuracy', color='steelblue')
    b2 = ax.bar(x + 0.2, top3s, 0.35, label='Top-3 Accuracy', color='orange')
    
    for bar in b1:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                f'{bar.get_height():.1f}%', ha='center', va='bottom', fontsize=9)
   