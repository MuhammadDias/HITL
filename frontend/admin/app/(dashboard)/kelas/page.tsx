"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyLink, DecisionBar, ErrorBox } from "@/components/ui";
import { api, classLink, type ClassSummary, type SchoolSummary } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ClassesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isSuper = user?.role === "superadmin";
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [schools, setSchools] = useState<SchoolSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<ClassSummary | null>(null);

  const [name, setName] = useState("");
  const [count, setCount] = useState(30);
  const [schoolId, setSchoolId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.listClasses().then(setClasses).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    if (isSuper) api.listSchools().then(setSchools).catch(() => undefined);
  }, [load, isSuper]);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>{isSuper ? "Semua Kelas" : "Kelas Saya"}</h1>
          <p>Buat kelas, bagikan link-nya ke murid, lalu pantau keputusan mereka terhadap tebakan AI.</p>
        </div>
      </div>

      <ErrorBox error={error} />

      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const c = await api.createClass({
              name,
              student_count: count,
              ...(isSuper ? { school_id: schoolId === "" ? undefined : schoolId } : {}),
            });
            setCreated(c);
            setName("");
            load();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Gagal membuat kelas.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="card-head">
          <h2>Buat kelas baru</h2>
        </div>
        <div className="form-row">
          {isSuper && (
            <label className="field">
              Sekolah
              <select required value={schoolId} onChange={(e) => setSchoolId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Pilih sekolah…</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            Nama kelas
            <input required maxLength={80} placeholder="mis. 7A" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field" style={{ flex: "0 1 160px" }}>
            Jumlah murid
            <input
              type="number"
              required
              min={1}
              max={60}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Membuat…" : "Buat kelas"}
          </button>
        </div>
        {created && (
          <div className="stack" style={{ marginTop: 14, gap: 8 }}>
            <div className="alert alert-ok">
              Kelas {created.name} dibuat. Bagikan link ini ke {created.student_count} murid:
            </div>
            <CopyLink url={classLink(created.join_token)} />
            <p className="muted small" style={{ margin: 0 }}>
              Murid membuka link, memilih nomor absen (1–{created.student_count}) dan menulis nama. Semua jawaban
              mereka otomatis masuk ke grup kelas ini.
            </p>
          </div>
        )}
      </form>

      <div className="card">
        <div className="card-head">
          <h2>Daftar kelas</h2>
          <span className="muted small">{classes?.length ?? 0} kelas</span>
        </div>
        {classes === null ? (
          <div className="empty">Memuat…</div>
        ) : classes.length === 0 ? (
          <div className="empty">Belum ada kelas. Buat kelas pertama di atas.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kelas</th>
                  {isSuper && <th>Sekolah</th>}
                  <th className="num">Murid</th>
                  <th className="num">Jawaban</th>
                  <th>Menerima / Merevisi / Menolak</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => router.push(`/kelas/${c.id}`)}>
                    <td><strong>{c.name}</strong></td>
                    {isSuper && <td>{c.school_name}</td>}
                    <td className="num">{c.students_joined} / {c.student_count}</td>
                    <td className="num">{c.total_submissions}</td>
                    <td style={{ minWidth: 200 }}>
                      <DecisionBar percent={c.percent} />
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {c.total_submissions
                          ? `${c.percent.accept}% · ${c.percent.correct}% · ${c.percent.override}%`
                          : "Belum ada jawaban"}
                      </div>
                    </td>
                    <td className="num">
                      <Link href={`/kelas/${c.id}`} className="btn btn-sm" onClick={(e) => e.stopPropagation()}>
                        Buka
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
