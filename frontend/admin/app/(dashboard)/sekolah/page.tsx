"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorBox, StatCard } from "@/components/ui";
import { api, type SchoolSummary } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

export default function SchoolsPage() {
  const user = useRequireUser("superadmin");
  const router = useRouter();
  const [schools, setSchools] = useState<SchoolSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.listSchools().then(setSchools).catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;
  const total = (key: keyof Pick<SchoolSummary, "class_count" | "student_count" | "submission_count">) =>
    (schools ?? []).reduce((sum, s) => sum + s[key], 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Sekolah terdaftar</h1>
          <p>Lihat semua sekolah beserta kelas, murid dan akun guru di dalamnya.</p>
        </div>
      </div>

      <ErrorBox error={error} />

      <div className="grid grid-4">
        <StatCard label="Sekolah" value={schools?.length ?? "—"} />
        <StatCard label="Kelas" value={schools ? total("class_count") : "—"} />
        <StatCard label="Murid" value={schools ? total("student_count") : "—"} />
        <StatCard label="Jawaban" value={schools ? total("submission_count") : "—"} />
      </div>

      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const s = await api.createSchool(name, address);
            router.push(`/sekolah/${s.id}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal mendaftarkan sekolah.");
            setBusy(false);
          }
        }}
      >
        <div className="card-head">
          <h2>Daftarkan sekolah</h2>
        </div>
        <div className="form-row">
          <label className="field">
            Nama sekolah
            <input required maxLength={120} placeholder="mis. SMPN 1 Surabaya" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            Alamat (opsional)
            <input maxLength={240} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Menyimpan…" : "Daftarkan"}
          </button>
        </div>
      </form>

      <div className="card">
        {schools === null ? (
          <div className="empty">Memuat…</div>
        ) : schools.length === 0 ? (
          <div className="empty">Belum ada sekolah. Daftarkan sekolah pertama di atas.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Sekolah</th>
                  <th className="num">Guru</th>
                  <th className="num">Kelas</th>
                  <th className="num">Murid</th>
                  <th className="num">Jawaban</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => router.push(`/sekolah/${s.id}`)}>
                    <td>
                      <strong>{s.name}</strong>
                      {s.address && <div className="muted small">{s.address}</div>}
                    </td>
                    <td className="num">{s.admin_count}</td>
                    <td className="num">{s.class_count}</td>
                    <td className="num">{s.student_count}</td>
                    <td className="num">{s.submission_count}</td>
                    <td className="num">
                      <Link href={`/sekolah/${s.id}`} className="btn btn-sm" onClick={(e) => e.stopPropagation()}>
                        Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
