"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DecisionBar, ErrorBox, StatCard, formatDate } from "@/components/ui";
import { api, downloadExport, type SchoolDetail } from "@/lib/api";
import { useRequireUser } from "@/lib/auth";

export default function SchoolDetailPage() {
  const user = useRequireUser("superadmin");
  const params = useParams<{ id: string }>();
  const schoolId = Number(params.id);
  const router = useRouter();
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [studentClass, setStudentClass] = useState<number | "">("");

  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.getSchool(schoolId).then(setSchool).catch((e) => setError(e.message));
  }, [schoolId]);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!user) return null;
  if (!school) return error ? <ErrorBox error={error} /> : <div className="empty">Memuat…</div>;

  const students = studentClass === "" ? school.students : school.students.filter((s) => s.class_id === studentClass);
  const totalSubmissions = school.classes.reduce((sum, c) => sum + c.total_submissions, 0);

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <div className="crumb"><Link href="/sekolah">Sekolah</Link></div>
          <h1>{school.name}</h1>
          <p>{school.address ? `${school.address} · ` : ""}terdaftar {formatDate(school.created_at)}</p>
        </div>
      </div>

      <ErrorBox error={error} />
      {notice && <div className="alert alert-ok">{notice}</div>}

      <div className="grid grid-4">
        <StatCard label="Akun guru" value={school.admins.length} />
        <StatCard label="Kelas" value={school.classes.length} />
        <StatCard label="Murid" value={school.students.length} />
        <StatCard label="Jawaban" value={totalSubmissions} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Kelas</h2>
          <Link href="/kelas" className="btn btn-sm">+ Buat kelas</Link>
        </div>
        {school.classes.length === 0 ? (
          <div className="empty">Belum ada kelas di sekolah ini.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th className="num">Murid</th>
                  <th className="num">Jawaban</th>
                  <th>Rata-rata murid (M / R / T)</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {school.classes.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => router.push(`/kelas/${c.id}`)}>
                    <td><strong>{c.name}</strong></td>
                    <td className="num">{c.students_joined} / {c.student_count}</td>
                    <td className="num">{c.total_submissions}</td>
                    <td style={{ minWidth: 200 }}>
                      <DecisionBar percent={c.student_average_percent} />
                      <div className="muted small" style={{ marginTop: 4 }}>
                        {c.total_submissions
                          ? `${c.student_average_percent.accept}% · ${c.student_average_percent.correct}% · ${c.student_average_percent.override}%`
                          : "Belum ada jawaban"}
                      </div>
                    </td>
                    <td className="num" onClick={(e) => e.stopPropagation()}>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => downloadExport(c.id, "csv").catch((e) => setError(e.message))}
                        >
                          CSV
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => downloadExport(c.id, "zip").catch((e) => setError(e.message))}
                        >
                          ZIP
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted small">M = Menerima, R = Merevisi, T = Menolak. Export per kelas: CSV data jawaban, ZIP = CSV + semua gambar.</p>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Semua murid</h2>
          <label className="row small">
            Kelas
            <select value={studentClass} onChange={(e) => setStudentClass(e.target.value ? Number(e.target.value) : "")}>
              <option value="">Semua kelas</option>
              {school.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        </div>
        {students.length === 0 ? (
          <div className="empty">Belum ada murid.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Kelas</th>
                  <th className="num">Absen</th>
                  <th>Nama</th>
                  <th className="num">Jawaban</th>
                  <th>Bergabung</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="clickable" onClick={() => router.push(`/kelas/${s.class_id}`)}>
                    <td>{s.class_name}</td>
                    <td className="num">{s.number}</td>
                    <td><strong>{s.name}</strong></td>
                    <td className="num">{s.submission_count}</td>
                    <td className="muted">{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Akun guru (admin)</h2>
        </div>
        {school.admins.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr><th>Nama</th><th>Email</th><th>Dibuat</th></tr>
              </thead>
              <tbody>
                {school.admins.map((a) => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td>{a.email}</td>
                    <td className="muted">{formatDate(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            setNotice(null);
            try {
              await api.createAdmin(schoolId, { name: adminName, email: adminEmail, password: adminPassword });
              setNotice(`Akun guru ${adminEmail} dibuat. Berikan email & password ini ke guru tersebut.`);
              setAdminName("");
              setAdminEmail("");
              setAdminPassword("");
              load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Gagal membuat akun.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-row">
            <label className="field">
              Nama guru
              <input required maxLength={120} value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            </label>
            <label className="field">
              Email
              <input type="email" required value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            </label>
            <label className="field">
              Password awal
              <input
                type="text"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="min. 8 karakter"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Membuat…" : "Buat akun guru"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
