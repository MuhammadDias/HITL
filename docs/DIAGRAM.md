# Diagram Sistem Sketchbook Universe

Diagram ditulis dalam **Mermaid**, sehingga tampil otomatis di GitHub. Untuk dimasukkan ke dokumen Word/PDF,
salin blok kode ke [mermaid.live](https://mermaid.live), lalu unduh sebagai PNG atau SVG.

## 1. Arsitektur sistem

```mermaid
flowchart LR
    subgraph Klien["Perangkat pengguna (browser)"]
        S["Siswa<br/>Game Next.js + KAPLAY<br/>kanvas / kamera MediaPipe"]
        G["Guru / Superadmin<br/>Dashboard Next.js"]
    end

    T(["Cloudflare Tunnel<br/>HTTPS publik"])

    subgraph Server["Server (Docker Compose)"]
        C["Caddy<br/>reverse proxy"]
        W["File statis game<br/>( / )"]
        A["Dashboard Next.js<br/>( /admin )"]
        B["Backend FastAPI<br/>( /predict, /api, /health )"]
        M[("Model MobileNetV2<br/>weights/*.keras<br/>+ labels.json")]
        D[("SQLite<br/>momo.sqlite<br/>(volume)")]
    end

    S --> T
    G --> T
    T --> C
    C --> W
    C --> A
    C --> B
    B --> M
    B --> D
```

## 2. Alur gambar sampai keputusan tercatat

```mermaid
sequenceDiagram
    autonumber
    actor Siswa
    participant Game as Game (browser)
    participant API as Backend FastAPI
    participant Model as MobileNetV2
    participant DB as SQLite
    actor Guru

    Siswa->>Game: Menggambar di kanvas
    Note over Game: Normalisasi goresan<br/>(bounding box → 0–1, maks 64 titik/goresan)
    Siswa->>Game: Tekan "Tebak Gambarku"
    Game->>API: POST /predict {drawing.strokes, levelId}
    API->>API: Rasterisasi goresan → citra 28×28
    API->>Model: Inferensi
    Model-->>API: Probabilitas 20 kelas
    API->>DB: Baca kesulitan level
    API->>API: Terapkan kesulitan (perataan + pertukaran bentuk mirip)
    API-->>Game: Top-3 label + confidence
    Game-->>Siswa: Popup "Tebakan Momo"
    Siswa->>Game: Terima / Pilih lain / Bukan semua
    Game->>Game: Label akhir → objek bisa dipijak / berbahaya / netral
    opt Siswa masuk lewat tautan kelas
        Game->>API: POST /api/submissions {goresan, Top-3, keputusan, label akhir}
        API->>DB: Simpan jawaban
    end
    Guru->>API: Buka detail kelas di dashboard
    API->>DB: Baca jawaban & statistik
    API-->>Guru: Rekap Menerima / Merevisi / Menolak + gambar
```

## 3. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    schools ||--o{ users : "memiliki guru"
    schools ||--o{ classes : "memiliki"
    users ||--o{ sessions : "login"
    users |o--o{ classes : "membuat"
    classes ||--o{ students : "berisi"
    classes ||--o{ submissions : "menampung"
    students ||--o{ submissions : "mengirim"

    schools {
        INTEGER id PK
        TEXT name
        TEXT address
        TEXT created_at
    }
    users {
        INTEGER id PK
        TEXT email UK
        TEXT name
        TEXT password_hash "PBKDF2-SHA256"
        TEXT role "superadmin | admin"
        INTEGER school_id FK "NULL untuk superadmin"
        TEXT created_at
    }
    sessions {
        TEXT token PK
        INTEGER user_id FK
        TEXT expires_at "7 hari"
    }
    classes {
        INTEGER id PK
        INTEGER school_id FK
        TEXT name
        INTEGER student_count "1-60"
        TEXT join_token UK "untuk tautan kelas"
        INTEGER created_by FK
        TEXT created_at
    }
    students {
        INTEGER id PK
        INTEGER class_id FK
        INTEGER number "nomor absen, unik per kelas"
        TEXT name
        TEXT created_at
    }
    submissions {
        INTEGER id PK
        INTEGER class_id FK
        INTEGER student_id FK
        TEXT level_id
        TEXT strokes_json "koordinat goresan"
        TEXT candidates_json "Top-3 tebakan AI"
        TEXT decision_type "accept | correct | override"
        INTEGER source_rank "1-3, NULL untuk override"
        TEXT final_label
        TEXT top1_label
        REAL top1_confidence
        TEXT created_at
    }
    level_difficulty {
        TEXT level_id PK
        INTEGER enabled "0 / 1"
        INTEGER difficulty "0-100"
        TEXT updated_at
    }
```

`level_difficulty` berdiri sendiri (tanpa relasi): `level_id` mengacu pada identitas level di game
(`stage-1-foundation`, `stage-2-ambiguity`, `stage-3-validation`).

## 4. Deployment

```mermaid
flowchart TB
    subgraph Laptop["Laptop pengembang"]
        L["Kode + tes"]
    end
    GH[("GitHub<br/>MuhammadDias/HITL<br/>tag v0.x.y")]
    subgraph Srv["Server pa-hitl-server (Ubuntu, 2× RTX A5000)"]
        P["git pull"]
        DC["docker compose up -d --build"]
        TR["train/train_in_docker.sh<br/>(container GPU, terpisah)"]
        WT[("weights/")]
    end
    L -- "git push --follow-tags" --> GH
    GH --> P --> DC
    TR -- "model baru" --> WT
    WT -- "docker compose restart backend" --> DC
```
