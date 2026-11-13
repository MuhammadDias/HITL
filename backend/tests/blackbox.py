"""Black-box tests of the backend API plus a /predict response-time benchmark.

Uses only the Python standard library. Writes a Markdown report to
output/pengujian/laporan-pengujian-<timestamp>.md.

Black-box tests create their own school/class/students, so run them against a
backend with a THROWAWAY database (see backend/tests/run_tests_in_docker.sh).

  python3 backend/tests/blackbox.py --base http://127.0.0.1:8090 \
      --email tester@uji.local --password ujicoba12345 \
      --bench http://localhost:8006 --bench https://xxxx.trycloudflare.com --runs 50
"""
import argparse
import io
import json
import platform
import statistics
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime
from pathlib import Path

LADDER = {"strokes": [
    [{"x": 0.10, "y": 0.0}, {"x": 0.10, "y": 1.0}], [{"x": 0.40, "y": 0.0}, {"x": 0.40, "y": 1.0}],
    [{"x": 0.10, "y": 0.2}, {"x": 0.40, "y": 0.2}], [{"x": 0.10, "y": 0.5}, {"x": 0.40, "y": 0.5}],
    [{"x": 0.10, "y": 0.8}, {"x": 0.40, "y": 0.8}],
], "hasInk": True, "aspectRatio": 0.3}


class Api:
    def __init__(self, base):
        self.base = base.rstrip("/")

    def call(self, method, path, body=None, token=None, raw=False):
        req = urllib.request.Request(self.base + path, method=method)
        req.add_header("User-Agent", "hitl-blackbox-test")
        if body is not None:
            req.data = json.dumps(body).encode()
            req.add_header("content-type", "application/json")
        if token:
            req.add_header("authorization", f"Bearer {token}")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                return r.status, (data if raw else (json.loads(data) if data else None))
        except urllib.error.HTTPError as e:
            data = e.read()
            try:
                return e.code, json.loads(data)
            except ValueError:
                return e.code, data


def run_blackbox(api, email, password):
    rows = []

    def record(no, scenario, steps, expected, ok, actual):
        rows.append({"no": no, "scenario": scenario, "steps": steps, "expected": expected,
                     "actual": actual, "result": "Berhasil" if ok else "GAGAL"})

    s, r = api.call("GET", "/health")
    record(1, "Pemeriksaan status layanan", "GET /health", "200, status ok",
           s == 200 and r == {"status": "ok"}, f"{s} {r}")

    s, r = api.call("POST", "/predict", {"drawing": LADDER})
    ok = s == 200 and len(r.get("candidates", [])) == 3 and all(0 <= c["confidence"] <= 1 for c in r["candidates"])
    record(2, "Prediksi gambar", "POST /predict dengan goresan tangga", "200, tepat 3 kandidat, confidence 0–1",
           ok, f"{s} " + ", ".join(f'{c["label"]} {c["confidence"]*100:.1f}%' for c in r.get("candidates", [])))

    s, r = api.call("POST", "/api/auth/login", {"email": email, "password": "password-salah"})
    record(3, "Login dengan kata sandi salah", "POST /api/auth/login", "401, akses ditolak",
           s == 401, f"{s} {r.get('detail') if isinstance(r, dict) else r}")

    # Setup: superadmin creates two schools with one teacher each.
    s, r = api.call("POST", "/api/auth/login", {"email": email, "password": password})
    if s != 200:
        raise SystemExit(f"Login superadmin gagal ({s}): {r}")
    sup = r["token"]
    stamp = datetime.now().strftime("%H%M%S")
    school_a = api.call("POST", "/api/schools", {"name": f"Sekolah Uji A {stamp}"}, sup)[1]
    school_b = api.call("POST", "/api/schools", {"name": f"Sekolah Uji B {stamp}"}, sup)[1]
    guru = {}
    for key, school in (("a", school_a), ("b", school_b)):
        mail = f"guru-{key}-{stamp}@uji.local"
        api.call("POST", f"/api/schools/{school['id']}/admins", {"name": f"Guru {key.upper()}", "email": mail, "password": "gurupass123"}, sup)
        guru[key] = api.call("POST", "/api/auth/login", {"email": mail, "password": "gurupass123"})[1]["token"]
    cls = api.call("POST", "/api/classes", {"name": "7A", "student_count": 5}, guru["a"])[1]

    s, r = api.call("GET", f"/api/classes/{cls['id']}", token=guru["b"])
    record(4, "Guru mengakses kelas sekolah lain", "Guru sekolah B: GET /api/classes/{id} kelas sekolah A",
           "404, data tidak ditemukan", s == 404, f"{s} {r.get('detail') if isinstance(r, dict) else r}")

    s, r = api.call("GET", "/api/join/token-tidak-ada")
    record(5, "Tautan kelas tidak valid", "GET /api/join/token-tidak-ada", "404, Link kelas tidak valid",
           s == 404, f"{s} {r.get('detail') if isinstance(r, dict) else r}")

    tok = cls["join_token"]
    s, r = api.call("POST", f"/api/join/{tok}/students", {"number": 6, "name": "Lebih"})
    record(6, "Nomor absen melebihi jumlah siswa", "Kelas 5 siswa: daftar dengan nomor 6", "400, ditolak",
           s == 400, f"{s} {r.get('detail') if isinstance(r, dict) else r}")

    st = api.call("POST", f"/api/join/{tok}/students", {"number": 1, "name": "Andi"})[1]
    _, pred = api.call("POST", "/predict", {"drawing": LADDER})
    cands = pred["candidates"]
    decisions = [("accept", 1, cands[0]["label"]), ("correct", 2, cands[1]["label"]), ("override", None, "jembatan")]
    codes = []
    for d, rank, label in decisions:
        s, _ = api.call("POST", "/api/submissions", {
            "join_token": tok, "student_id": st["student_id"], "level_id": "stage-1-foundation",
            "strokes": LADDER["strokes"], "candidates": cands, "decision_type": d, "source_rank": rank, "final_label": label})
        codes.append(s)
    _, detail = api.call("GET", f"/api/classes/{cls['id']}", token=guru["a"])
    counts = detail["stats"]["counts"]
    ok = codes == [201, 201, 201] and counts == {"accept": 1, "correct": 1, "override": 1}
    record(7, "Terima / Pilih lain / Bukan semua tercatat", "3 keputusan dari 1 siswa, lalu buka detail kelas",
           "Masing-masing tercatat 1 (Menerima, Merevisi, Menolak)", ok, f"kode {codes}, rekap {counts}")

    st2 = api.call("POST", f"/api/join/{tok}/students", {"number": 1, "name": "Andi Saputra"})[1]
    _, detail = api.call("GET", f"/api/classes/{cls['id']}", token=guru["a"])
    names = [x["name"] for x in detail["stats"]["students"]]
    ok = st2["student_id"] == st["student_id"] and names == ["Andi Saputra"]
    record(8, "Nomor absen sama dari perangkat lain", "Daftar ulang nomor 1 dengan nama lain",
           "Tetap 1 siswa (ID sama), nama diperbarui", ok, f"ID {st['student_id']}→{st2['student_id']}, siswa {names}")

    s1, csv_bytes = api.call("GET", f"/api/classes/{cls['id']}/export.csv", token=sup, raw=True)
    s2, zip_bytes = api.call("GET", f"/api/classes/{cls['id']}/export.zip", token=sup, raw=True)
    s3, _ = api.call("GET", f"/api/classes/{cls['id']}/export.csv", token=guru["a"], raw=True)
    lines = csv_bytes.decode("utf-8-sig").strip().splitlines() if s1 == 200 else []
    names_zip = zipfile.ZipFile(io.BytesIO(zip_bytes)).namelist() if s2 == 200 else []
    pngs = [n for n in names_zip if n.endswith(".png")]
    ok = s1 == 200 and len(lines) == 4 and s2 == 200 and "data.csv" in names_zip and len(pngs) == 3 and s3 == 403
    record(9, "Export data per kelas", "Superadmin: export CSV & ZIP; guru: export CSV",
           "CSV 3 baris data, ZIP berisi data.csv + 3 PNG; guru ditolak (403)", ok,
           f"CSV {s1} ({len(lines)-1} baris), ZIP {s2} ({len(pngs)} PNG), guru {s3}")

    s, _ = api.call("DELETE", f"/api/classes/{cls['id']}", token=guru["a"], raw=True)
    s_after, _ = api.call("GET", f"/api/classes/{cls['id']}", token=sup)
    s_link, _ = api.call("GET", f"/api/join/{tok}")
    ok = s == 204 and s_after == 404 and s_link == 404
    record(10, "Hapus kelas", "Guru: DELETE /api/classes/{id}, lalu buka kelas & tautannya",
           "204; kelas dan tautannya tidak ditemukan lagi (404)", ok, f"hapus {s}, kelas {s_after}, tautan {s_link}")
    return rows


def run_benchmark(base, runs):
    api = Api(base)
    api.call("POST", "/predict", {"drawing": LADDER})  # warm-up (not counted)
    times, errors = [], 0
    for _ in range(runs):
        t0 = time.perf_counter()
        s, _ = api.call("POST", "/predict", {"drawing": LADDER})
        ms = (time.perf_counter() - t0) * 1000
        if s == 200:
            times.append(ms)
        else:
            errors += 1
    times.sort()
    pct = lambda p: times[min(len(times) - 1, int(round(p / 100 * (len(times) - 1))))]  # noqa: E731
    return {"base": base, "runs": runs, "ok": len(times), "errors": errors,
            "min": min(times), "avg": statistics.mean(times), "median": statistics.median(times),
            "p95": pct(95), "max": max(times)} if times else {"base": base, "runs": runs, "ok": 0, "errors": errors}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--base", help="backend for black-box tests (throwaway database)")
    ap.add_argument("--email")
    ap.add_argument("--password")
    ap.add_argument("--bench", action="append", default=[], help="base URL to benchmark /predict (repeatable)")
    ap.add_argument("--runs", type=int, default=50)
    ap.add_argument("--out", default=str(Path(__file__).resolve().parents[2] / "output" / "pengujian"))
    a = ap.parse_args()

    now = datetime.now()
    md = [f"# Laporan Pengujian Backend Sketchbook Universe", "",
          f"- Waktu pengujian: {now:%Y-%m-%d %H:%M:%S}",
          f"- Mesin penguji: {platform.node()} ({platform.system()} {platform.release()})", ""]
    failed = 0

    if a.base:
        rows = run_blackbox(Api(a.base), a.email, a.password)
        failed += sum(r["result"] != "Berhasil" for r in rows)
        md += ["## Uji black-box", "", f"Target: `{a.base}` (database uji terpisah)", "",
               "| No | Skenario | Langkah | Hasil yang diharapkan | Hasil sebenarnya | Status |",
               "|---|---|---|---|---|---|"]
        for r in rows:
            md.append(f"| {r['no']} | {r['scenario']} | {r['steps']} | {r['expected']} | {r['actual']} | **{r['result']}** |")
            print(f"[{r['result']}] {r['no']}. {r['scenario']} — {r['actual']}")
        md += ["", f"**{len(rows) - failed} dari {len(rows)} skenario berhasil.**", ""]

    if a.bench:
        md += ["## Waktu respons POST /predict", "",
               f"Gambar uji: tangga (5 goresan). Diukur dari klien (termasuk jaringan), {a.runs} percobaan per target "
               "setelah 1 permintaan pemanasan.", "",
               "| Target | Berhasil | Rata-rata (ms) | Median (ms) | Min (ms) | P95 (ms) | Maks (ms) |",
               "|---|---|---|---|---|---|---|"]
        for base in a.bench:
            b = run_benchmark(base, a.runs)
            if b["ok"]:
                md.append(f"| `{base}` | {b['ok']}/{b['runs']} | {b['avg']:.1f} | {b['median']:.1f} | {b['min']:.1f} | {b['p95']:.1f} | {b['max']:.1f} |")
                print(f"[BENCH] {base}: rata-rata {b['avg']:.1f} ms, min {b['min']:.1f}, maks {b['max']:.1f} ({b['ok']}/{b['runs']})")
            else:
                md.append(f"| `{base}` | 0/{b['runs']} | – | – | – | – | – |")
                print(f"[BENCH] {base}: semua permintaan gagal")
                failed += 1
        md.append("")

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"laporan-pengujian-{now:%Y%m%d-%H%M%S}.md"
    path.write_text("\n".join(md), encoding="utf-8")
    print(f"\nLaporan: {path}")
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
