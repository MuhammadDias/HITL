import subprocess

scripts = [
    "03_train_custom_cnn.py",
    "04_train_efficientnet.py",
    "05_train_squeezenet.py",
    "06_train_mobilenetv2.py",
    "07_train_resnet18.py",
    "08_train_sketchcnn.py"
]

for script in scripts:
    print(f"Running {script}...")
    result = subprocess.run(["python", script])

    if result.returncode != 0:
        print(f"{script} error, stop.")
        break

print("Done.")