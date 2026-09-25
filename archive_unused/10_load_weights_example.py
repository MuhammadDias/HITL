# run_all_training.py
"""
Jalankan semua training model secara berurutan.
"""

import subprocess
import sys

TRAINING_SCRIPTS = [
    '03_train_custom_cnn.py',
    '04_train_efficientnet.py',
    '05_train_squeezenet.py',
    '06_train_mobilenetv2.py',
    '07_train_resnet18.py',
    '08_train_sketchnn.py',
]

def main():
    print('='*60)
    print('  TRAINING 6 MODELS SEQUENTIALLY')
    print('='*60)
    print('\n⚠️  Proses ini akan memakan waktu ~90 menit')
    print('⚠️  Pastikan dataset sudah di-download dan diproses!')
    
    confirm = input('\nLanjutkan? (y/n): ')
    if confirm.lower() != 'y':
        print('Dibatalkan.')
        return
    
    for i, script in enumerate(TRAINING_SCRIPTS, 1):
        print(f'\n{"="*60}')
        print(f'  [{i}/{len(TRAINING_SCRIPTS)}] Menjalankan {script}')
        print(f'{"="*60}')
        
        result = subprocess.run([sys.executable, script])
        
        if result.returncode != 0:
            print(f'\n❌ Error di {script}! Berhenti.')
            break
        else:
            print(f'\n✅ {script} selesai!')
    
    print('\n' + '='*60)
    print('  SEMUA TRAINING SELESAI!')
    print('='*60)
    print('\n📁 Hasil weights tersimpan di folder weights/')
    print('📊 Jalankan 09_compare_models.py untuk lihat perbandingan')

if __name__ == '__main__':
    main()